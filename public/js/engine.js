// SQL-Engine: kapselt sql.js (SQLite als WebAssembly) und die Bewertung von Abgaben.
// Läuft im Browser und in Node (Tests) – das SQL-Modul wird von außen übergeben.

let SQL = null;
let seedBytes = null;

export function setup(sqlModule, seedSql) {
  SQL = sqlModule;
  const db = new SQL.Database();
  db.exec(seedSql);
  seedBytes = db.export();
  db.close();
}

/** Frische Kopie der Lerndatenbank (jede Aufgabe startet sauber). */
export function freshDb() {
  const db = new SQL.Database(seedBytes);
  db.exec('PRAGMA foreign_keys = ON;');
  return db;
}

/** Leere Datenbank, optional mit Setup-SQL (für Vorhersage-Aufgaben). */
export function scratchDb(setupSql = '') {
  const db = new SQL.Database();
  if (setupSql) db.exec(setupSql);
  return db;
}

/**
 * Führt SQL aus. Liefert { ok, results:[{columns, values}], last, changes, error, ms }.
 * `last` ist die letzte Ergebnismenge (falls vorhanden).
 */
export function run(db, sql) {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  try {
    const results = db.exec(sql);
    const changes = db.getRowsModified();
    const ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
    return { ok: true, results, last: results.length ? results[results.length - 1] : null, changes, ms };
  } catch (e) {
    return { ok: false, error: String(e.message || e), results: [], last: null };
  }
}

export function tableNames(db) {
  const r = db.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid");
  return r.length ? r[0].values.map((v) => v[0]) : [];
}

export function tableInfo(db, name) {
  const cols = db.exec(`PRAGMA table_info("${name}")`)[0]?.values || [];
  const fks = db.exec(`PRAGMA foreign_key_list("${name}")`)[0]?.values || [];
  const fkMap = Object.fromEntries(fks.map((f) => [f[3], `${f[2]}.${f[4]}`]));
  return cols.map((c) => ({ name: c[1], type: c[2] || '', notnull: !!c[3], pk: c[5] > 0, fk: fkMap[c[1]] || null }));
}

// ---------- Bewertung ----------

const norm = (v) => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Math.round(v * 100) / 100;
  if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim())) return v; // Text bleibt Text
  return v;
};
const rowKey = (r) => JSON.stringify(r.map(norm));

const sameMultiset = (a, b) => {
  if (a.length !== b.length) return false;
  const count = new Map();
  for (const r of a) { const k = rowKey(r); count.set(k, (count.get(k) || 0) + 1); }
  for (const r of b) { const k = rowKey(r); const c = count.get(k); if (!c) return false; count.set(k, c - 1); }
  return true;
};

export const needsOrder = (sql) => /\border\s+by\b/i.test(sql.replace(/\([^()]*\)/g, ''));

/**
 * Vergleicht zwei Ergebnismengen.
 * opts: { ordered, orderKeys, alias }
 * Liefert { ok, reason }
 */
export function compareResults(user, expected, opts = {}) {
  const u = user || { columns: [], values: [] };
  const e = expected || { columns: [], values: [] };
  if (!user) return { ok: false, reason: 'Deine Anweisung liefert keine Ergebnistabelle. Fehlt ein SELECT?' };
  if (u.columns.length !== e.columns.length) {
    return { ok: false, reason: `Dein Ergebnis hat ${u.columns.length} Spalte${u.columns.length === 1 ? '' : 'n'}, erwartet sind ${e.columns.length}. Prüfe die SELECT-Liste.` };
  }
  if (u.values.length !== e.values.length) {
    return { ok: false, reason: `Dein Ergebnis hat ${u.values.length} Zeile${u.values.length === 1 ? '' : 'n'}, erwartet sind ${e.values.length}. Prüfe die Bedingungen (WHERE / HAVING / JOIN / LIMIT).` };
  }
  if (!sameMultiset(u.values, e.values)) {
    // Spalten evtl. nur in anderer Reihenfolge?
    const perm = permutedMatch(u, e);
    if (perm) return { ok: false, reason: 'Die Werte stimmen, aber die Spalten stehen in einer anderen Reihenfolge als verlangt.' };
    return { ok: false, reason: 'Zeilen- und Spaltenanzahl stimmen, aber einige Werte weichen ab. Vergleiche dein Ergebnis mit dem Zielergebnis.' };
  }
  if (opts.ordered) {
    const keys = opts.orderKeys || null;
    const proj = (rows) => rows.map((r) => (keys ? keys.map((i) => norm(r[i])) : r.map(norm)));
    if (JSON.stringify(proj(u.values)) !== JSON.stringify(proj(e.values))) {
      return { ok: false, reason: 'Richtige Zeilen – aber falsche Reihenfolge. Prüfe ORDER BY (ASC/DESC, Sortierkriterien).' };
    }
  }
  if (opts.alias && opts.alias.length) {
    const have = u.columns.map((c) => c.toLowerCase());
    const missing = opts.alias.filter((a) => !have.includes(a.toLowerCase()));
    if (missing.length) return { ok: false, reason: `Ergebnis stimmt, aber der Alias ${missing.map((m) => `„${m}“`).join(', ')} fehlt. Benenne die Spalte mit AS.`, almost: true };
  }
  return { ok: true };
}

function permutedMatch(u, e) {
  if (u.values.length === 0) return false;
  const n = u.columns.length;
  if (n > 6) return false;
  const sortCols = (rows) => rows.map((r) => r.map(norm).map((x) => JSON.stringify(x)).sort().join('|')).sort().join('\n');
  return sortCols(u.values) === sortCols(e.values);
}

/** Bewertet eine SQL-Abgabe (Typ sql/fix/dml) gegen die Musterlösung. */
export function grade(task, userSql) {
  if (!userSql || !userSql.trim()) return { ok: false, reason: 'Das Eingabefeld ist leer.' };
  if (task.type === 'dml') {
    const dbU = freshDb();
    const rU = run(dbU, userSql);
    if (!rU.ok) { dbU.close(); return { ok: false, error: rU.error, reason: translateError(rU.error) }; }
    if (!/\b(insert|update|delete)\b/i.test(userSql)) { dbU.close(); return { ok: false, reason: 'Hier ist eine Änderung gefragt (INSERT, UPDATE oder DELETE) – ein SELECT allein ändert nichts.' }; }
    const dbS = freshDb();
    run(dbS, task.solution);
    const cu = run(dbU, task.check), cs = run(dbS, task.check);
    dbU.close(); dbS.close();
    const cmp = compareResults(cu.last || { columns: cs.last.columns, values: [] }, cs.last, { ordered: true });
    if (!cmp.ok) return { ok: false, reason: 'Der Datenbestand nach deiner Änderung stimmt nicht mit dem erwarteten überein. Prüfe WHERE-Bedingung und neue Werte.', check: { user: cu.last, expected: cs.last } };
    return { ok: true, check: { user: cu.last, expected: cs.last } };
  }
  const dbU = freshDb();
  const rU = run(dbU, userSql);
  dbU.close();
  if (!rU.ok) return { ok: false, error: rU.error, reason: translateError(rU.error) };
  if (/\b(insert|update|delete|drop|alter|create)\b/i.test(userSql) && !/^\s*select/i.test(userSql)) {
    return { ok: false, reason: 'Hier ist eine Abfrage (SELECT) gefragt, keine Änderung.' };
  }
  const expected = expectedResult(task);
  const cmp = compareResults(rU.last, expected, { ordered: needsOrder(task.solution), orderKeys: task.orderKeys, alias: task.alias });
  return { ...cmp, result: rU.last, expected };
}

const expectedCache = new Map();
export function expectedResult(task) {
  const k = task.key || task.id;
  if (expectedCache.has(k)) return expectedCache.get(k);
  const db = freshDb();
  let r;
  if (task.type === 'dml') { run(db, task.solution); r = run(db, task.check); }
  else r = run(db, task.solution);
  db.close();
  if (!r.ok) throw new Error(`Musterlösung fehlerhaft (${k}): ${r.error}`);
  expectedCache.set(k, r.last);
  return r.last;
}

/** Ergebnis einer Vorhersage-Aufgabe (erste Zelle bzw. Zeilenanzahl). */
export function predictActual(task) {
  const db = scratchDb(task.setup);
  const r = run(db, task.sql);
  db.close();
  return r.last;
}

export function normalizeAnswer(s) {
  return String(s ?? '').trim().toLowerCase().replace(',', '.').replace(/\s+/g, ' ').replace(/^'(.*)'$/, '$1');
}

// ---------- Fehlermeldungen auf Deutsch ----------

const ERRORS = [
  [/no such column: ([\w.]+)/i, (m) => `Die Spalte „${m[1]}“ gibt es nicht. Tippfehler? Fehlen Anführungszeichen um einen Text? Stammt die Spalte aus einer Tabelle, die nicht im FROM/JOIN steht?`],
  [/no such table: (\w+)/i, (m) => `Die Tabelle „${m[1]}“ gibt es nicht. Prüfe den Namen im Schema-Bereich (Singular! z. B. „kunde“, nicht „kunden“).`],
  [/near "(.*?)": syntax error/i, (m) => `Syntaxfehler bei „${m[1]}“. Prüfe direkt davor: fehlendes/überzähliges Komma, Tippfehler im Schlüsselwort, falsche Reihenfolge der Klauseln?`],
  [/incomplete input/i, () => 'Die Anweisung ist unvollständig – fehlt eine schließende Klammer, ein Anführungszeichen oder ein Teil der Abfrage?'],
  [/ambiguous column name: ([\w.]+)/i, (m) => `Die Spalte „${m[1]}“ ist mehrdeutig – sie kommt in mehreren Tabellen vor. Schreibe den Tabellennamen bzw. Alias davor, z. B. „k.${m[1]}“.`],
  [/misuse of aggregate(?: function)? (\w+)/i, (m) => `Aggregatfunktion ${m[1]}() an falscher Stelle. In WHERE sind Aggregate nicht erlaubt – nutze HAVING (nach GROUP BY) oder eine Unterabfrage.`],
  [/misuse of aggregate/i, () => 'Aggregatfunktion an falscher Stelle. In WHERE sind Aggregate nicht erlaubt – nutze HAVING oder eine Unterabfrage.'],
  [/FOREIGN KEY constraint failed/i, () => 'Fremdschlüssel verletzt (referentielle Integrität): Es gibt noch abhängige Datensätze, oder der referenzierte Datensatz existiert nicht.'],
  [/UNIQUE constraint failed: ([\w.]+)/i, (m) => `Eindeutigkeit verletzt: Der Wert in „${m[1]}“ existiert bereits (Primärschlüssel / UNIQUE).`],
  [/NOT NULL constraint failed: ([\w.]+)/i, (m) => `„${m[1]}“ ist ein Pflichtfeld (NOT NULL) und braucht einen Wert.`],
  [/CHECK constraint failed/i, () => 'Der Wert verletzt eine Prüfregel (CHECK), z. B. ist nur „Gewerbe“ oder „Privat“ erlaubt.'],
  [/(\d+) values for (\d+) columns/i, (m) => `Anzahl der Werte (${m[1]}) passt nicht zur Anzahl der Spalten (${m[2]}).`],
  [/table (\w+) has (\d+) columns but (\d+) values were supplied/i, (m) => `Die Tabelle „${m[1]}“ hat ${m[2]} Spalten, du lieferst ${m[3]} Werte. Gib eine Spaltenliste an.`],
  [/no such function: (\w+)/i, (m) => `Die Funktion „${m[1]}“ gibt es in SQLite nicht (Tippfehler oder anderer SQL-Dialekt?).`],
  [/wrong number of arguments to function (\w+)/i, (m) => `Falsche Anzahl Argumente für ${m[1]}().`],
  [/a GROUP BY clause is required before HAVING/i, () => 'HAVING braucht ein vorangehendes GROUP BY.'],
  [/unrecognized token: "(.*?)"/i, (m) => `Unbekanntes Zeichen „${m[1]}“ – vermutlich ein nicht geschlossenes Anführungszeichen.`],
  [/sub-select returns (\d+) columns/i, () => 'Die Unterabfrage liefert mehrere Spalten, erwartet ist genau eine.'],
  [/You can only execute one statement at a time/i, () => 'Bitte nur eine Anweisung ausführen.'],
];

export function translateError(msg) {
  for (const [re, fn] of ERRORS) {
    const m = msg.match(re);
    if (m) return fn(m);
  }
  return `Die Datenbank meldet: ${msg}`;
}
