// Lernstand: lokal (localStorage) + optionaler Abgleich mit dem Server.
import { ALL_TASKS, MODULES, XP_BY_LEVEL, TASK_BY_KEY } from './content/index.js';
import { todayISO, daysBetween } from './ui.js';

const LS_KEY = 'sqlwork.state.v1';
const listeners = new Set();

export const LEVELS = [
  { name: 'Lehrling', at: 0 },
  { name: 'Geselle', at: 0.1 },
  { name: 'Vorarbeiter', at: 0.25 },
  { name: 'Polier', at: 0.45 },
  { name: 'Meister', at: 0.7 },
  { name: 'Baumeister', at: 0.9 },
];
export const LESSON_XP = 5;
export const MAX_XP = ALL_TASKS.reduce((s, t) => s + XP_BY_LEVEL[t.level] + 5, 0) + MODULES.reduce((s, m) => s + m.lessons.length * LESSON_XP, 0);

const blank = () => ({
  v: 1, createdAt: Date.now(), updatedAt: 0,
  profile: null, name: '', examDate: '', theme: 'system', paperMode: true,
  xp: 0, tasks: {}, lessons: {}, days: [], exams: [], badges: {}, drafts: {}, lastTask: null, combo: 0, bestCombo: 0,
});

export let state = load();

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...blank(), ...JSON.parse(raw) };
  } catch { /* privater Modus o. Ä. */ }
  return blank();
}

let syncTimer = null;
export const sync = { status: 'local', lastError: null };

export function save({ silent = false, touch = true } = {}) {
  if (touch) state.updatedAt = Date.now();
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  if (!silent) listeners.forEach((fn) => fn(state));
  scheduleSync();
}
export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

export function slug(name) {
  return String(name).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'lernende';
}

// ---------- Server-Abgleich ----------
export async function pullFromServer() {
  if (!state.profile) return;
  try {
    const r = await fetch(`api/state/${state.profile}`, { cache: 'no-store' });
    if (r.status === 204 || r.status === 404) { sync.status = 'on'; scheduleSync(0); return; }
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const remote = await r.json();
    if (remote.updatedAt > state.updatedAt) {
      state = { ...blank(), ...remote };
      try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch { /* ignore */ }
      listeners.forEach((fn) => fn(state));
    } else if (remote.updatedAt < state.updatedAt) scheduleSync(0);
    sync.status = 'on';
  } catch (e) { sync.status = 'local'; sync.lastError = String(e); }
  listeners.forEach((fn) => fn(state));
}

function scheduleSync(delay = 1200) {
  if (!state.profile || sync.status === 'off') return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(pushToServer, delay);
}
async function pushToServer() {
  try {
    const r = await fetch(`api/state/${state.profile}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    sync.status = 'on';
  } catch (e) { sync.status = sync.status === 'on' ? 'err' : 'local'; sync.lastError = String(e); }
}

// ---------- Tage / Streak ----------
export function markActive() {
  const t = todayISO();
  if (!state.days.includes(t)) { state.days.push(t); state.days = state.days.slice(-400); }
}
export function streak() {
  const set = new Set(state.days);
  let d = new Date();
  if (!set.has(todayISO(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (set.has(todayISO(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

// ---------- Level ----------
export function levelInfo(xp = state.xp) {
  let idx = 0;
  LEVELS.forEach((l, i) => { if (xp >= Math.round(l.at * MAX_XP)) idx = i; });
  const cur = Math.round(LEVELS[idx].at * MAX_XP);
  const next = LEVELS[idx + 1] ? Math.round(LEVELS[idx + 1].at * MAX_XP) : null;
  return { idx, name: LEVELS[idx].name, cur, next, nextName: LEVELS[idx + 1]?.name, pct: next ? ((xp - cur) / (next - cur)) * 100 : 100 };
}

// ---------- Aufgaben ----------
export const taskState = (key) => state.tasks[key] || null;
export const isSolved = (key) => state.tasks[key]?.status === 'solved';

/**
 * Ergebnis einer Abgabe verbuchen.
 * Liefert { xp, levelUp, newBadges }
 */
export function recordAttempt(task, { correct, hintUsed = false, shown = false, fromReview = false }) {
  const key = task.key;
  const ts = state.tasks[key] || { status: 'open', attempts: 0, hint: false, shown: false };
  const beforeLevel = levelInfo().idx;
  ts.attempts++;
  ts.hint = ts.hint || hintUsed;
  ts.shown = ts.shown || shown;
  markActive();
  let xp = 0;
  if (correct) {
    const first = ts.status !== 'solved';
    if (first && !ts.shown) {
      xp = XP_BY_LEVEL[task.level];
      if (ts.hint) xp = Math.round(xp / 2);
      if (ts.attempts === 1 && !ts.hint) { xp += 5; ts.firstTry = true; }
    }
    if (first) { ts.status = 'solved'; ts.solvedAt = Date.now(); }
    state.combo = (state.combo || 0) + 1;
    state.bestCombo = Math.max(state.bestCombo || 0, state.combo);
    // Wiederholung (Leitner)
    if (ts.box) {
      if (fromReview) {
        ts.box++;
        if (ts.box > 3) { delete ts.box; delete ts.due; ts.reviewDone = (ts.reviewDone || 0) + 1; state.reviewCleared = (state.reviewCleared || 0) + 1; }
        else ts.due = addDays(todayISO(), [0, 1, 3, 7][ts.box]);
      }
    } else if (ts.attempts > 1 || ts.hint || ts.shown) {
      ts.box = 1; ts.due = addDays(todayISO(), 1);
    }
  } else {
    state.combo = 0;
    if (ts.status !== 'solved') ts.status = 'tried';
    ts.box = 1; ts.due = todayISO();
  }
  state.tasks[key] = ts;
  state.lastTask = key;
  state.xp += xp;
  const newBadges = checkBadges();
  save();
  return { xp, levelUp: levelInfo().idx > beforeLevel ? levelInfo() : null, newBadges };
}

export function markShown(task) {
  const ts = state.tasks[task.key] || { status: 'open', attempts: 0 };
  ts.shown = true;
  if (ts.status !== 'solved') ts.status = 'tried';
  ts.box = 1; ts.due = todayISO();
  state.tasks[task.key] = ts;
  state.combo = 0;
  save();
}

export function markLesson(moduleId, idx) {
  const k = `${moduleId}/${idx}`;
  if (state.lessons[k]) return 0;
  state.lessons[k] = Date.now();
  state.xp += LESSON_XP;
  markActive();
  checkBadges();
  save();
  return LESSON_XP;
}

const addDays = (iso, n) => { const d = new Date(iso + 'T12:00'); d.setDate(d.getDate() + n); return todayISO(d); };

export function dueReviews() {
  const t = todayISO();
  return ALL_TASKS.filter((x) => { const s = state.tasks[x.key]; return s && s.box && s.due <= t; });
}
export function inReview() {
  return ALL_TASKS.filter((x) => state.tasks[x.key]?.box);
}

export function moduleProgress(m) {
  const solved = m.tasks.filter((t) => isSolved(`${m.id}/${t.id}`)).length;
  const lessons = m.lessons.filter((_, i) => state.lessons[`${m.id}/${i}`]).length;
  return { solved, total: m.tasks.length, lessons, lessonTotal: m.lessons.length, pct: (solved / m.tasks.length) * 100 };
}

/** Beherrschung 0..1 eines Moduls (Hinweis/Lösung zählen weniger). */
export function moduleMastery(m) {
  let s = 0;
  for (const t of m.tasks) {
    const ts = state.tasks[`${m.id}/${t.id}`];
    if (!ts || ts.status !== 'solved') continue;
    s += ts.shown ? 0.3 : ts.hint ? 0.7 : ts.box ? 0.85 : 1;
  }
  return s / m.tasks.length;
}

export function readiness() {
  const mastery = MODULES.map(moduleMastery);
  const avg = mastery.reduce((a, b) => a + b, 0) / mastery.length;
  const recent = state.exams.slice(-2);
  const exam = recent.length ? Math.max(...recent.map((e) => e.score / e.max)) : null;
  const score = exam === null ? Math.min(avg, 0.85) : avg * 0.6 + exam * 0.4;
  const weakest = MODULES.map((m, i) => ({ m, v: mastery[i] })).sort((a, b) => a.v - b.v)[0];
  return { score: Math.round(score * 100), mastery, exam, weakest };
}

export function nextTask() {
  const last = state.lastTask && TASK_BY_KEY[state.lastTask];
  if (last) {
    const m = MODULES.find((x) => x.id === last.module);
    const after = m.tasks.slice(m.tasks.findIndex((t) => t.id === last.id) + 1).find((t) => !isSolved(`${m.id}/${t.id}`));
    if (after) return { ...after, module: m.id, key: `${m.id}/${after.id}` };
  }
  return ALL_TASKS.find((t) => !isSolved(t.key)) || null;
}

export function daysToExam() {
  if (!state.examDate) return null;
  return daysBetween(todayISO(), state.examDate);
}

// ---------- Prüfungen ----------
export function recordExam(result) {
  state.exams.push(result);
  markActive();
  const newBadges = checkBadges();
  save();
  return newBadges;
}

// ---------- Abzeichen ----------
export const BADGES = [
  { id: 'erste', t: 'Erster Spatenstich', d: 'Erste Aufgabe gelöst', sym: '1', test: (s) => solvedCount(s) >= 1 },
  { id: 'zehn', t: 'Fundament', d: '10 Aufgaben gelöst', sym: '10', test: (s) => solvedCount(s) >= 10 },
  { id: 'fuenfzig', t: 'Rohbau', d: '50 Aufgaben gelöst', sym: '50', test: (s) => solvedCount(s) >= 50 },
  { id: 'alle', t: 'Richtfest', d: 'Alle Aufgaben gelöst', sym: '∑', test: (s) => solvedCount(s) >= ALL_TASKS.length },
  { id: 'serie5', t: 'Im Fluss', d: '5 richtige Antworten in Folge', sym: '5×', test: (s) => (s.bestCombo || 0) >= 5 },
  { id: 'serie15', t: 'Akkordarbeit', d: '15 richtige Antworten in Folge', sym: '15×', test: (s) => (s.bestCombo || 0) >= 15 },
  { id: 'putz', t: 'Datenputzer', d: 'Modul „Daten bereinigen“ komplett', sym: 'DQ', test: () => modDone('bereinigung') },
  { id: 'kanban', t: 'Pull statt Push', d: 'Modul „Projektarbeit“ komplett', sym: 'WIP', test: () => modDone('projekt') },
  { id: 'join', t: 'Brückenbauer', d: 'Modul „Mehrere Tabellen“ komplett', sym: '⋈', test: () => modDone('joins') },
  { id: 'fix', t: 'Fehlerjäger', d: 'Alle Fehler-finden-Aufgaben gelöst', sym: '!', test: (s) => ALL_TASKS.filter((t) => t.type === 'fix').every((t) => s.tasks[t.key]?.status === 'solved') },
  { id: 'streak3', t: 'Drei Tage am Stück', d: '3 Tage in Folge gelernt', sym: '3d', test: () => streak() >= 3 },
  { id: 'streak7', t: 'Wochenschicht', d: '7 Tage in Folge gelernt', sym: '7d', test: () => streak() >= 7 },
  { id: 'klausur', t: 'Probe bestanden', d: 'Probeklausur mit mind. 50 %', sym: '✓', test: (s) => s.exams.some((e) => e.score / e.max >= 0.5) },
  { id: 'eins', t: 'Meisterstück', d: 'Probeklausur mit Note 1', sym: '1,0', test: (s) => s.exams.some((e) => e.score / e.max >= 0.92) },
  { id: 'review', t: 'Nachgebessert', d: '10 Aufgaben aus der Wiederholung abgeschlossen', sym: '↻', test: (s) => (s.reviewCleared || 0) >= 10 },
  { id: 'theorie', t: 'Belesen', d: 'Alle Lerneinheiten gelesen', sym: '¶', test: (s) => MODULES.every((m) => m.lessons.every((_, i) => s.lessons[`${m.id}/${i}`])) },
];
const solvedCount = (s) => Object.values(s.tasks).filter((t) => t.status === 'solved').length;
const modDone = (id) => MODULES.find((m) => m.id === id).tasks.every((t) => isSolved(`${id}/${t.id}`));

export function checkBadges() {
  const fresh = [];
  for (const b of BADGES) {
    if (!state.badges[b.id] && b.test(state)) { state.badges[b.id] = Date.now(); fresh.push(b); }
  }
  return fresh;
}

// ---------- Verwaltung ----------
export function exportState() { return JSON.stringify(state, null, 2); }
export function importState(json) {
  const parsed = JSON.parse(json);
  if (!parsed || typeof parsed !== 'object' || !parsed.tasks) throw new Error('Keine gültige Lernstand-Datei.');
  state = { ...blank(), ...parsed, updatedAt: Date.now() };
  save();
}
export function resetState() {
  const keep = { profile: state.profile, name: state.name, examDate: state.examDate, theme: state.theme };
  state = { ...blank(), ...keep };
  save();
}
export function setDraft(key, sql) { state.drafts[key] = sql; save({ silent: true }); }
