// Probeklausur: zufällige Aufgaben, Zeitlimit, Papiermodus, Benotung nach IHK-Schlüssel.
import { h, md, mdEl, icon, levelDots, toast, confirmDialog, shuffle, todayISO } from './ui.js';
import { codeBlock } from './editor.js';
import { makeRenderer, TYPE_LABEL } from './task.js';
import { dataTable } from './ui.js';
import { formelsammlungButton } from './formelsammlung.js';
import * as engine from './engine.js';
import * as store from './store.js';
import { MODULES, MODULE_BY_ID, TASK_BY_KEY } from './content/index.js';

export const FORMATS = {
  blatt: { t: 'Übungsblatt-Klausur', min: 90, fixed: 'uebungsblatt', s: 'Das komplette Übungsblatt (Teil A + B) unter Zeitdruck – so nah an der Klausur wie möglich.' },
  kurz: { t: 'Kurztest', min: 20, per: { qualitaet: 1, bereinigung: 2, projekt: 1, select: 2, aggregat: 1, joins: 2, dml: 1 }, s: '10 Aufgaben · 20 Minuten. Für zwischendurch.' },
  standard: { t: 'Probeklausur', min: 45, per: { qualitaet: 2, bereinigung: 3, projekt: 2, select: 3, aggregat: 3, joins: 4, dml: 3 }, s: '20 Aufgaben · 45 Minuten. Alle Themen wie in der echten Klausur.' },
  voll: { t: 'Generalprobe', min: 90, per: { qualitaet: 3, bereinigung: 5, projekt: 3, select: 5, aggregat: 5, joins: 6, dml: 5 }, s: '32 Aufgaben · 90 Minuten. Ausdauer-Test kurz vor der Prüfung.' },
};

export function points(t) {
  if (t.type === 'text') return t.points.length;
  if (t.type === 'grid') return 4;
  if (['sql', 'fix', 'dml'].includes(t.type)) return 3 + t.level;
  if (t.type === 'mc') return t.multi ? 3 : 2;
  return 3;
}

export function gradeFor(pct) {
  if (pct >= 92) return { n: 1, t: 'sehr gut' };
  if (pct >= 81) return { n: 2, t: 'gut' };
  if (pct >= 67) return { n: 3, t: 'befriedigend' };
  if (pct >= 50) return { n: 4, t: 'ausreichend' };
  if (pct >= 30) return { n: 5, t: 'mangelhaft' };
  return { n: 6, t: 'ungenügend' };
}

function buildExam(fmt) {
  const keys = [];
  const F = FORMATS[fmt];
  if (F.fixed) {
    keys.push(...MODULE_BY_ID[F.fixed].tasks.map((t) => `${F.fixed}/${t.id}`).filter((k) => !TASK_BY_KEY[k].zusatz));
    return { fmt, keys, answers: {}, startedAt: Date.now(), endsAt: Date.now() + F.min * 60e3, paper: store.state.paperMode, seed: Math.floor(Math.random() * 1e9), cur: 0 };
  }
  for (const m of MODULES) {
    const n = F.per[m.id] || 0;
    // Bevorzugt ungelöste/schwache Aufgaben, aber gemischt; nur Klausurstoff (Formelsammlung)
    const pool = shuffle(m.tasks.map((t) => `${m.id}/${t.id}`).filter((k) => !TASK_BY_KEY[k].zusatz && TASK_BY_KEY[k].type !== 'text'));
    pool.sort((a, b) => (store.isSolved(a) ? 1 : 0) - (store.isSolved(b) ? 1 : 0) + (Math.random() - 0.5) * 1.2);
    keys.push(...pool.slice(0, n));
  }
  // Reihenfolge: Theorie zuerst, dann SQL – wie in vielen Klausuren
  return { fmt, keys, answers: {}, startedAt: Date.now(), endsAt: Date.now() + FORMATS[fmt].min * 60e3, paper: store.state.paperMode, seed: Math.floor(Math.random() * 1e9), cur: 0 };
}

export function renderExam(container, setCrumbs) {
  const active = store.state.activeExam;
  if (active) return runExam(container, active, setCrumbs);
  setCrumbs(['Klausur']);
  let fmt = 'standard';
  const cards = Object.entries(FORMATS).map(([k, f]) => h('button', { class: 'choice-card', type: 'button', 'aria-pressed': String(k === fmt), onclick: () => { fmt = k; cards.forEach((c, i) => c.setAttribute('aria-pressed', String(Object.keys(FORMATS)[i] === fmt))); } },
    h('span', { class: 'eyebrow' }, `${f.min} min`), h('div', { class: 'cc-t' }, f.t), h('div', { class: 'cc-s' }, f.s)));
  const paper = h('input', { type: 'checkbox', checked: store.state.paperMode, onchange: (e) => { store.state.paperMode = e.target.checked; store.save({ silent: true }); } });
  const history = store.state.exams.slice(-6).reverse();
  container.replaceChildren(
    h('div', { class: 'hero', style: { gridTemplateColumns: '1fr' } },
      h('div', null,
        h('p', { class: 'eyebrow accent' }, 'Klausur-Simulation'),
        h('h1', { class: 'display' }, 'Unter ', h('em', null, 'echten'), ' Bedingungen üben.'),
        h('p', { class: 'lead' }, 'Zeitlimit, keine Hinweise, kein Feedback bis zur Abgabe – aber mit Formelsammlung, wie in der echten Klausur. Nur Klausurstoff: Aufgaben, die über die Formelsammlung hinausgehen, sind ausgeschlossen. Bewertet nach dem IHK-Notenschlüssel.'))),
    h('div', { class: 'section' },
      h('div', { class: 'choice-cards four' }, cards),
      h('label', { class: 'switch card', style: { marginTop: '16px' } }, paper,
        h('span', null, h('strong', null, 'Papiermodus'), h('br'), h('span', { class: 'small muted' }, 'SQL-Abfragen können nicht ausgeführt werden – du musst sie wie auf Papier im Kopf prüfen. Empfohlen, je näher die Klausur rückt.'))),
      h('div', { class: 'actions' }, h('button', { class: 'btn accent lg', type: 'button', onclick: () => { store.state.activeExam = buildExam(fmt); store.save(); runExam(container, store.state.activeExam, setCrumbs); } }, icon('clock'), 'Klausur starten'))),
    history.length ? h('div', { class: 'section' },
      h('div', { class: 'section-head' }, h('h2', { class: 'h2' }, 'Bisherige Versuche'), h('span', { class: 'rule-fill' })),
      h('div', { class: 'table-scroll' }, h('table', { class: 'ref-table' },
        h('thead', null, h('tr', null, ['Datum', 'Format', 'Punkte', 'Prozent', 'Note', 'Dauer'].map((x) => h('th', null, x)))),
        h('tbody', null, history.map((e) => h('tr', null,
          h('td', null, new Date(e.at).toLocaleDateString('de-DE')), h('td', null, FORMATS[e.fmt]?.t || e.fmt),
          h('td', { class: 'mono' }, `${e.score} / ${e.max}`), h('td', { class: 'mono' }, `${Math.round((e.score / e.max) * 100)} %`),
          h('td', null, h('strong', null, `${e.grade} `), gradeFor((e.score / e.max) * 100).t), h('td', { class: 'mono' }, `${Math.round(e.dur / 60000)} min`))))))) : null);
}

let timerId = null;
function runExam(container, ex, setCrumbs) {
  setCrumbs(['Klausur', FORMATS[ex.fmt].t]);
  const tasks = ex.keys.map((k) => TASK_BY_KEY[k]).filter(Boolean);
  let renderer = null;
  const timer = h('span', { class: 'exam-timer', role: 'timer' });
  const nav = h('div', { class: 'exam-nav' });
  const body = h('div');
  const saveCur = () => { if (renderer) { ex.answers[ex.cur] = renderer.answer(); store.save({ silent: true }); } };
  const drawNav = () => nav.replaceChildren(...tasks.map((t, i) => h('button', { type: 'button', class: ex.answers[i] != null && !emptyAns(ex.answers[i]) ? 'answered' : '', 'aria-current': String(i === ex.cur), 'aria-label': `Aufgabe ${i + 1}`, onclick: () => go(i) }, String(i + 1))));
  const go = (i) => { saveCur(); ex.cur = i; draw(); };
  const draw = () => {
    const t = tasks[ex.cur];
    renderer = makeRenderer(t, { allowRun: !ex.paper, seed: ex.seed + ex.cur });
    if (ex.answers[ex.cur] != null) renderer.restore(ex.answers[ex.cur]);
    const isSql = ['sql', 'fix', 'dml'].includes(t.type);
    body.replaceChildren(h('div', { class: isSql ? 'task-layout' : 'task-layout single' },
      h('div', { class: 'task-brief' },
        h('div', { class: 'task-meta' }, h('span', { class: 'eyebrow' }, `Aufgabe ${ex.cur + 1} / ${tasks.length}`), h('span', { class: 'pill' }, TYPE_LABEL[t.type]), levelDots(t.level), h('span', { class: 'pill accent' }, `${points(t)} Punkte`)),
        h('div', { class: 'task-q', html: t.q.split('\n\n').map((p) => `<p>${md(p)}</p>`).join('') }),
        isSql ? h('p', { class: 'small muted' }, `Tabellen: ${(t.tables || []).join(', ')}${t.db === 'buecherei' ? ' (Bücherei)' : ''}`) : null,
        isSql && ex.paper ? h('p', { class: 'small muted' }, 'Papiermodus: Ausführen ist deaktiviert.') : null),
      h('div', null, renderer.el,
        h('div', { class: 'actions' },
          !ex.paper && isSql ? h('button', { class: 'btn', type: 'button', onclick: () => renderer.runIt() }, icon('play'), 'Ausführen') : null,
          h('span', { class: 'spacer' }),
          ex.cur > 0 ? h('button', { class: 'btn ghost', type: 'button', onclick: () => go(ex.cur - 1) }, icon('chevL'), 'Zurück') : null,
          ex.cur < tasks.length - 1 ? h('button', { class: 'btn primary', type: 'button', onclick: () => go(ex.cur + 1) }, 'Nächste', icon('chev')) : h('button', { class: 'btn accent', type: 'button', onclick: () => finish(false) }, 'Abgeben')))));
    drawNav();
    window.scrollTo({ top: 0 });
  };
  const tick = () => {
    const left = Math.max(0, ex.endsAt - Date.now());
    const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
    timer.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    timer.classList.toggle('low', left < 5 * 60000);
    if (left <= 0) finish(true);
  };
  const finish = async (timeUp) => {
    saveCur();
    if (!timeUp) {
      const open = tasks.filter((_, i) => ex.answers[i] == null || emptyAns(ex.answers[i])).length;
      const ok = await confirmDialog('Klausur abgeben?', open ? `Du hast ${open} Aufgabe${open === 1 ? '' : 'n'} noch nicht bearbeitet.` : 'Alle Aufgaben bearbeitet. Jetzt bewerten lassen?', 'Abgeben');
      if (!ok) return;
    }
    clearInterval(timerId);
    const ticksByIdx = await selfCheckStep(container, tasks, ex);
    const results = tasks.map((t, i) => {
      const r = makeRenderer(t, { seed: ex.seed + i });
      const a = ex.answers[i];
      if (a == null || emptyAns(a)) return { key: t.key, pts: 0, max: points(t), score: 0, answer: a, empty: true };
      r.restore(a);
      if (t.type === 'text') r.setTicks(ticksByIdx[i] || []);
      const c = r.check();
      const pts = Math.round(c.score * points(t) * 2) / 2;
      return { key: t.key, pts, max: points(t), score: c.score, ok: c.ok, answer: a, reason: c.reason };
    });
    // Lernstand aktualisieren
    for (const r of results) {
      if (r.empty) continue;
      const t = TASK_BY_KEY[r.key];
      if (r.ok) store.recordAttempt(t, { correct: true });
      else store.recordAttempt(t, { correct: false });
    }
    const score = results.reduce((s, r) => s + r.pts, 0);
    const max = results.reduce((s, r) => s + r.max, 0);
    const pct = (score / max) * 100;
    const perModule = {};
    for (const r of results) { const m = TASK_BY_KEY[r.key].module; perModule[m] = perModule[m] || { pts: 0, max: 0 }; perModule[m].pts += r.pts; perModule[m].max += r.max; }
    const entry = { at: Date.now(), fmt: ex.fmt, score, max, grade: gradeFor(pct).n, dur: Math.min(Date.now(), ex.endsAt) - ex.startedAt, perModule, paper: ex.paper, day: todayISO() };
    delete store.state.activeExam;
    const badges = store.recordExam(entry);
    badges.forEach((b) => toast(h('span', null, 'Abzeichen: ', h('b', null, b.t)), 4000));
    showResult(container, entry, results, timeUp, setCrumbs);
  };
  const abort = async () => {
    if (await confirmDialog('Klausur abbrechen?', 'Dein Versuch wird verworfen und nicht bewertet.', 'Abbrechen', true)) {
      clearInterval(timerId); delete store.state.activeExam; store.save(); renderExam(container, setCrumbs);
    }
  };
  container.replaceChildren(
    h('div', { class: 'exam-bar' }, icon('clock'), timer, formelsammlungButton(), h('span', { class: 'spacer' }), nav,
      h('button', { class: 'btn ghost sm', type: 'button', onclick: abort }, 'Abbrechen'),
      h('button', { class: 'btn accent sm', type: 'button', onclick: () => finish(false) }, 'Abgeben')),
    body);
  clearInterval(timerId);
  let n = 0;
  timerId = setInterval(() => { if (!document.body.contains(timer)) { saveCur(); clearInterval(timerId); return; } if (++n % 5 === 0) saveCur(); tick(); }, 1000);
  tick();
  draw();
}

/** Freitext-Antworten mit dem Erwartungshorizont abgleichen, bevor bewertet wird. */
function selfCheckStep(container, tasks, ex) {
  const idx = tasks.map((t, i) => i).filter((i) => tasks[i].type === 'text' && ex.answers[i] && String(ex.answers[i]).trim());
  if (!idx.length) return Promise.resolve({});
  return new Promise((resolve) => {
    const boxes = {};
    container.replaceChildren(
      h('p', { class: 'eyebrow accent' }, 'Selbstkontrolle'),
      h('h1', { class: 'display' }, 'Freitext-Antworten abgleichen.'),
      h('p', { class: 'lead' }, 'Vergleiche jede Antwort mit dem Erwartungshorizont und hake ehrlich ab, was du genannt hast. Danach wird die Klausur benotet.'),
      h('div', { class: 'stack section' }, idx.map((i) => {
        const t = tasks[i];
        boxes[i] = t.points.map(() => h('input', { type: 'checkbox' }));
        return h('div', { class: 'card stack' },
          h('div', { class: 'task-q', html: md(t.q.split('\n\n')[0]) }),
          h('p', { class: 'eyebrow' }, 'Deine Antwort'),
          h('div', { class: 'textshow' }, String(ex.answers[i])),
          h('p', { class: 'eyebrow' }, `Erwartungshorizont · ${t.points.length} Punkte`),
          t.points.map((pt, k) => h('label', { class: 'switch' }, boxes[i][k], h('span', { html: md(pt) }))));
      })),
      h('div', { class: 'actions' }, h('button', { class: 'btn accent lg', type: 'button', onclick: () => {
        const out = {};
        for (const i of idx) out[i] = boxes[i].map((b) => b.checked);
        resolve(out);
      } }, 'Klausur auswerten')));
    window.scrollTo({ top: 0 });
  });
}

const emptyAns = (a) => a === '' || (Array.isArray(a) && a.length === 0) || (typeof a === 'object' && a && !Array.isArray(a) && Object.keys(a).length === 0);

function showResult(container, entry, results, timeUp, setCrumbs) {
  setCrumbs(['Klausur', 'Auswertung']);
  const pct = (entry.score / entry.max) * 100;
  const g = gradeFor(pct);
  container.replaceChildren(
    h('div', { class: 'hero' },
      h('div', null,
        h('p', { class: 'eyebrow accent' }, timeUp ? 'Zeit abgelaufen · Auswertung' : 'Auswertung'),
        h('h1', { class: 'display' }, `${String(entry.score).replace('.', ',')} von ${entry.max} Punkten`),
        h('p', { class: 'lead' }, `${Math.round(pct)} % · Note ${g.n} (${g.t}). `, pct >= 50 ? 'Bestanden. ' : 'Noch nicht bestanden. ', 'Falsch beantwortete Aufgaben sind jetzt in deiner Wiederholung.'),
        h('div', { class: 'hero-actions' },
          h('a', { class: 'btn primary', href: '#/wiederholen' }, icon('repeat'), 'Zur Wiederholung'),
          h('button', { class: 'btn', type: 'button', onclick: () => renderExam(container, setCrumbs) }, 'Neue Klausur'))),
      h('div', { class: 'countdown' }, h('div', { class: 'grade-big' }, String(g.n)), h('p', { class: 'eyebrow' }, 'IHK-Notenschlüssel'))),
    h('div', { class: 'section' },
      h('div', { class: 'section-head' }, h('h2', { class: 'h2' }, 'Nach Themen'), h('span', { class: 'rule-fill' })),
      h('div', { class: 'stack' }, MODULES.filter((m) => entry.perModule[m.id]).map((m) => {
        const pm = entry.perModule[m.id];
        const p = (pm.pts / pm.max) * 100;
        return h('div', { class: 'row' }, h('span', { class: 'mono small muted', style: { width: '28px' } }, m.nr), h('span', { style: { width: '220px' } }, m.title),
          h('div', { style: { flex: 1, minWidth: '120px' } }, h('div', { class: `bar ${p >= 67 ? 'ok' : 'accent'}` }, h('span', { style: { width: `${p}%` } }))),
          h('span', { class: 'mono small', style: { width: '80px', textAlign: 'right' } }, `${pm.pts}/${pm.max}`));
      }))),
    h('div', { class: 'section' },
      h('div', { class: 'section-head' }, h('h2', { class: 'h2' }, 'Aufgaben im Detail'), h('span', { class: 'rule-fill' })),
      h('div', { class: 'stack' }, results.map((r, i) => {
        const t = TASK_BY_KEY[r.key];
        const cls = r.pts === r.max ? 'ok' : r.pts > 0 ? 'warn' : 'bad';
        return h('details', { class: 'drawer' },
          h('summary', null, h('span', { class: 'mono small muted' }, String(i + 1).padStart(2, '0')), h('span', { class: `pill ${cls}` }, `${r.pts}/${r.max}`), h('span', { style: { fontWeight: 400 } }, plain(t.q))),
          h('div', { class: 'drawer-body' },
            mdEl('p', t.q),
            h('p', { class: 'eyebrow', style: { marginTop: '14px' } }, 'Deine Antwort'), answerView(t, r),
            r.reason && !r.ok ? mdEl('p', r.reason, { class: 'small muted' }) : null,
            h('p', { class: 'eyebrow', style: { marginTop: '14px' } }, 'Lösung'), solutionView(t),
            mdEl('p', t.explain, { style: { marginTop: '10px' } }),
            h('a', { class: 'btn sm', href: `#/aufgabe/${t.module}/${t.id}` }, 'Aufgabe üben')));
      }))));
  window.scrollTo({ top: 0 });
}

const plain = (q) => { const x = q.replace(/[`*]/g, '').split('\n')[0]; return x.length > 110 ? x.slice(0, 108) + ' …' : x; };

function answerView(t, r) {
  if (r.empty) return h('p', { class: 'muted' }, '— nicht bearbeitet —');
  const a = r.answer;
  if (t.type === 'mc') return h('ul', null, a.map((i) => mdEl('li', t.options[i])));
  if (t.type === 'classify') return h('ul', null, t.items.map((it, i) => h('li', { html: `${md(it.t)} → <strong>${t.categories[a[i]] ?? '—'}</strong>` })));
  if (t.type === 'order') return h('ol', null, a.map((i) => mdEl('li', t.items[i])));
  if (t.type === 'predict') return h('p', null, h('code', null, a));
  if (t.type === 'text') return h('div', { class: 'textshow' }, String(a));
  if (t.type === 'grid') return dataTable({ columns: engine.predictActual(t).columns, values: a.filter((r) => r.some((v) => String(v).trim())) });
  return h('div', { class: 'solution-code' }, codeBlock(a));
}
function solutionView(t) {
  if (t.type === 'mc') return h('ul', null, (t.multi ? t.correct : [t.correct]).map((i) => mdEl('li', t.options[i])));
  if (t.type === 'classify') return h('ul', null, t.items.map((it) => h('li', { html: `${md(it.t)} → <strong>${t.categories[it.c]}</strong>` })));
  if (t.type === 'order') return h('ol', null, t.items.map((x) => mdEl('li', x)));
  if (t.type === 'predict') return h('p', null, h('code', null, t.answer));
  if (t.type === 'text') return h('div', null, h('ul', null, t.points.map((p) => mdEl('li', p))), h('div', { class: 'textshow', html: String(t.model).split('\n').map((p) => md(p)).join('<br>') }));
  if (t.type === 'grid') return dataTable(engine.predictActual(t));
  return h('div', { class: 'solution-code' }, codeBlock(t.solution));
}

export { MODULE_BY_ID };
