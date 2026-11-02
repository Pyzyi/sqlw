// Lernstand-Logik: XP, Wiederholung (Karteikasten), Klausur-Effekte.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../public/js/store.js';
import { ALL_TASKS } from '../public/js/content/index.js';

const t = ALL_TASKS.find((x) => x.key === 'select/s1');
const u = ALL_TASKS.find((x) => x.key === 'select/s2');

test('Erster Versuch richtig: XP + Bonus, keine Wiederholung', () => {
  store.resetState();
  const r = store.recordAttempt(t, { correct: true });
  assert.equal(r.xp, 10 + 5);
  assert.equal(store.taskState(t.key).box, undefined);
});

test('Erneut richtig (z. B. in der Probeklausur) landet NICHT in der Wiederholung', () => {
  const r = store.recordAttempt(t, { correct: true });
  assert.equal(r.xp, 0, 'keine doppelten XP');
  assert.equal(store.taskState(t.key).box, undefined);
  assert.equal(store.dueReviews().length, 0);
});

test('Falsch, dann richtig: kommt in die Wiederholung', () => {
  store.recordAttempt(u, { correct: false });
  assert.equal(store.taskState(u.key).box, 1);
  store.recordAttempt(u, { correct: true });
  assert.ok(store.taskState(u.key).box >= 1);
});
