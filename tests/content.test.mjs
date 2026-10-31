// Prüft jede Aufgabe gegen die echte SQL-Engine (ISO 25010: funktionale Korrektheit).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import * as engine from '../public/js/engine.js';
import { MODULES, ALL_TASKS } from '../public/js/content/index.js';

const require = createRequire(import.meta.url);
const initSqlJs = require('../public/vendor/sql-wasm.js');
const SQL = await initSqlJs({ locateFile: (f) => new URL(`../public/vendor/${f}`, import.meta.url).pathname });
engine.setup(SQL, readFileSync(new URL('../public/data/seed.sql', import.meta.url), 'utf8'));

const TYPES = ['mc', 'sql', 'fix', 'dml', 'predict', 'order', 'classify'];

test('Aufgaben-IDs sind eindeutig', () => {
  const keys = ALL_TASKS.map((t) => t.key);
  assert.equal(new Set(keys).size, keys.length);
});

for (const m of MODULES) {
  test(`Modul ${m.id}: Struktur`, () => {
    assert.ok(m.title && m.lessons.length && m.tasks.length);
  });
  for (const t of m.tasks) {
    test(`${m.id}/${t.id} (${t.type})`, () => {
      t.key = `${m.id}/${t.id}`;
      assert.ok(TYPES.includes(t.type), 'unbekannter Typ');
      assert.ok(t.q && t.q.length > 10, 'Fragetext fehlt');
      assert.ok([1, 2, 3].includes(t.level), 'level 1-3');
      assert.ok(t.explain, 'Erklärung fehlt');
      if (t.type === 'mc') {
        assert.ok(t.options.length >= 2);
        const c = t.multi ? t.correct : [t.correct];
        assert.ok(c.every((i) => i >= 0 && i < t.options.length));
        assert.equal(!!t.multi, Array.isArray(t.correct));
      }
      if (t.type === 'classify') assert.ok(t.items.every((i) => i.c >= 0 && i.c < t.categories.length));
      if (t.type === 'order') assert.ok(t.items.length >= 3);
      if (['sql', 'fix'].includes(t.type)) {
        const exp = engine.expectedResult(t);
        assert.ok(exp && exp.values.length > 0, 'Musterlösung liefert leeres Ergebnis');
        const g = engine.grade(t, t.solution);
        assert.ok(g.ok, `Musterlösung besteht eigene Prüfung nicht: ${g.reason}`);
        if (t.alias) for (const a of t.alias) assert.ok(exp.columns.map((c) => c.toLowerCase()).includes(a), `Alias ${a} fehlt in Lösung`);
        if (t.type === 'fix') {
          const bad = engine.grade(t, t.start);
          assert.ok(!bad.ok, 'Fehlerhafte Startabfrage wird fälschlich als korrekt bewertet');
        }
      }
      if (t.type === 'dml') {
        const g = engine.grade(t, t.solution);
        assert.ok(g.ok, `Musterlösung besteht nicht: ${g.reason || g.error}`);
        // Ohne Änderung darf es nicht bestehen
        const db = engine.freshDb();
        const before = engine.run(db, t.check).last;
        const after = g.check.expected;
        assert.notDeepEqual(before.values, after.values, 'DML-Aufgabe ändert den geprüften Bestand nicht');
      }
      if (t.type === 'predict') {
        const r = engine.predictActual(t);
        const actual = /Zeilen/.test(t.q) ? String(r ? r.values.length : 0) : String(r.values[(t.cell || [0, 0])[0]][(t.cell || [0, 0])[1]]);
        assert.equal(engine.normalizeAnswer(actual), engine.normalizeAnswer(t.answer), `Vorhersage stimmt nicht: Ergebnis ist ${actual}`);
      }
    });
  }
}

test('Bewertung erkennt typische Fehler', () => {
  const t = ALL_TASKS.find((x) => x.key === 'select/s5');
  assert.ok(!engine.grade(t, 'SELECT bezeichnung, vk_preis FROM artikel ORDER BY vk_preis ASC LIMIT 3;').ok);
  assert.ok(!engine.grade(t, 'SELECT bezeichnung FROM artikel ORDER BY vk_preis DESC LIMIT 3;').ok);
  assert.ok(engine.grade(t, 'select bezeichnung, vk_preis from artikel order by 2 desc limit 3').ok);
  const a = ALL_TASKS.find((x) => x.key === 'aggregat/a1');
  const r = engine.grade(a, 'SELECT COUNT(*) FROM kunde');
  assert.ok(!r.ok && r.almost, 'Alias-Hinweis erwartet');
  const err = engine.grade(a, 'SELECT COUNT(*) AS anzahl FROM kunden');
  assert.match(err.reason, /Tabelle „kunden“/);
});

test('Gesamtumfang', () => {
  assert.ok(ALL_TASKS.length >= 100, `nur ${ALL_TASKS.length} Aufgaben`);
});
