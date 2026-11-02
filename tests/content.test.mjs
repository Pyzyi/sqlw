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
const read = (f) => readFileSync(new URL(`../public/data/${f}`, import.meta.url), 'utf8');
engine.setup(SQL, { baustoff: read('seed.sql'), buecherei: read('buecherei.sql') });

const TYPES = ['mc', 'sql', 'fix', 'dml', 'predict', 'order', 'classify', 'text', 'grid'];

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
        if (t.alias) for (const a of t.alias) assert.ok(exp.columns.map((c) => c.toLowerCase()).includes(a.toLowerCase()), `Alias ${a} fehlt in Lösung`);
        if (t.type === 'fix') {
          const bad = engine.grade(t, t.start);
          assert.ok(!bad.ok, 'Fehlerhafte Startabfrage wird fälschlich als korrekt bewertet');
        }
      }
      if (t.type === 'dml') {
        const g = engine.grade(t, t.solution);
        assert.ok(g.ok, `Musterlösung besteht nicht: ${g.reason || g.error}`);
        // Ohne Änderung darf es nicht bestehen
        const db = engine.freshDb(t.db);
        const before = engine.run(db, t.check).last;
        const after = g.check.expected;
        assert.notDeepEqual(before.values, after.values, 'DML-Aufgabe ändert den geprüften Bestand nicht');
        if (t.start) assert.ok(!engine.grade(t, t.start).ok, 'Fehlerhafte Start-Anweisung wird fälschlich als korrekt bewertet');
      }
      if (t.type === 'text') {
        assert.ok(Array.isArray(t.points) && t.points.length >= 3, 'Erwartungshorizont fehlt');
        assert.ok(t.model && t.model.length > 80, 'Musterantwort fehlt');
      }
      if (t.type === 'grid') {
        const exp = engine.predictActual(t);
        assert.ok(exp.values.length > 0);
        const asText = exp.values.map((r) => r.map((v) => String(v)));
        assert.ok(engine.gradeGrid(t, asText).ok, 'eigene Lösung besteht nicht');
        assert.ok(!engine.gradeGrid(t, asText.slice(1)).ok, 'unvollständige Tabelle besteht');
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

test('Jedes Lernziel ist abgedeckt', () => {
  const by = (m) => ALL_TASKS.filter((t) => t.module === m);
  // Joins über genau drei Tabellen
  assert.ok(ALL_TASKS.filter((t) => t.type === 'sql' && t.tables?.length === 3 && /join/i.test(t.solution)).length >= 3, 'zu wenige 3-Tabellen-Joins');
  // Fehler finden auch bei INSERT/UPDATE
  assert.ok(ALL_TASKS.filter((t) => t.type === 'dml' && t.start).length >= 2);
  // Ergebnis bestimmen
  assert.ok(ALL_TASKS.filter((t) => t.type === 'predict').length >= 8);
  // Fehlerarten benennen und Maßnahmen zuordnen
  assert.ok(by('bereinigung').filter((t) => t.type === 'classify').length >= 3);
  for (const m of ['qualitaet', 'bereinigung', 'projekt', 'select', 'aggregat', 'joins', 'dml', 'uebungsblatt']) assert.ok(by(m).length >= 13, m);
});

test('Übungsblatt: Ergebnisse stimmen mit Handrechnung überein', () => {
  const res = (id) => engine.expectedResult(ALL_TASKS.find((t) => t.key === `uebungsblatt/${id}`)).values;
  assert.deepEqual(res('u5a').map((r) => r[0]), ['Kochen mit Kräutern', 'Sterne über Norwegen', 'Python für Einsteiger', 'Der letzte Sommer']);
  assert.deepEqual(res('u5b').map((r) => r[1]), [320, 301, 288, 260]);
  assert.deepEqual(res('u5c').map((r) => r[0]), ['Kochen mit Kräutern', 'Python für Einsteiger']);
  assert.deepEqual(res('u5d').map((r) => r[0]).sort(), ['Das Schweigen der Elbe', 'Nachtzug nach Wien']);
  assert.deepEqual(res('u5e').map((r) => r[1]), [2023, 2022, 2021]);
  assert.deepEqual(res('u6a'), [[2081]]);
  assert.deepEqual(res('u6b'), [[2015, 2023]]);
  assert.deepEqual(res('u6c'), [[4]]);
  assert.deepEqual(res('u6d'), [[1, 3]]);
  assert.deepEqual(res('u6e').map((r) => r[0]), ['Roman', 'Krimi', 'Ratgeber']);
  assert.deepEqual(res('u7d').map((r) => r[0]).sort(), ['Lorenz', 'Wagner']);
  assert.deepEqual(Object.fromEntries(res('u7e')), { Krimi: 84, Ratgeber: 49 });
  assert.deepEqual(res('u8a'), [['Kochen mit Kräutern']]);
  assert.deepEqual(res('u8b').map((r) => r[0]).sort(), ['Lorenz', 'Wagner']);
  assert.equal(engine.predictActual(ALL_TASKS.find((t) => t.key === 'uebungsblatt/u7c')).values.length, 4);
  const z = res('u11a').find((r) => r[0] === 'Frisch');
  assert.equal(z[1], 0);
});

test('Vertiefung: Syntax außerhalb der Formelsammlung ist markiert', () => {
  const zus = (k) => ALL_TASKS.find((t) => t.key === k).zusatz;
  for (const k of ['joins/j9', 'joins/j8', 'uebungsblatt/u11a', 'uebungsblatt/u11b', 'projekt/p13', 'bereinigung/b9']) assert.ok(zus(k), k);
  for (const k of ['joins/j5', 'uebungsblatt/u7d', 'select/s5', 'aggregat/a9']) assert.ok(!zus(k), k);
});

test('Gesamtumfang', () => {
  assert.ok(ALL_TASKS.length >= 100, `nur ${ALL_TASKS.length} Aufgaben`);
});
