// SQL-Lernwerkstatt – Einstieg, Router und Ansichten.
import { h, md, mdEl, icon, bar, toast, modal, confirmDialog, levelDots, resultPanel, svgEl, todayISO, daysBetween } from './ui.js';
import * as engine from './engine.js';
import * as store from './store.js';
import { MODULES, MODULE_BY_ID, ALL_TASKS, TASK_BY_KEY, XP_BY_LEVEL } from './content/index.js';
import { renderBlocks, erDiagram, refTable } from './widgets.js';
import { renderTaskWorkspace, schemaPanel, onCelebrate, TYPE_LABEL } from './task.js';
import { renderExam } from './exam.js';
import { createEditor, highlight } from './editor.js';

const app = document.getElementById('app');
let view, crumbsEl, statsEl, navEl, mobileEl;

// ---------- Start ----------
async function boot() {
  applyTheme();
  try {
    const [SQL, seed] = await Promise.all([
      window.initSqlJs({ locateFile: (f) => `vendor/${f}` }),
      fetch('data/seed.sql').then((r) => { if (!r.ok) throw new Error('seed'); return r.text(); }),
    ]);
    engine.setup(SQL, seed);
  } catch (e) {
    app.replaceChildren(h('div', { class: 'boot' }, h('div', null, h('div', { class: 'brand-mark' }, 'SQL', h('em', null, 'werkstatt')), h('p', null, 'Die Datenbank-Engine konnte nicht geladen werden.'), h('p', { class: 'small' }, String(e.message || e)))));
    return;
  }
  buildShell();
  store.subscribe(() => { refreshChrome(); });
  onCelebrate(celebrate);
  window.addEventListener('hashchange', route);
  store.pullFromServer().then(refreshChrome);
  route();
  if (!store.state.name) onboarding();
}

function applyTheme() {
  const t = store.state.theme;
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}

// ---------- Rahmen ----------
const NAV = [
  { href: '#/', t: 'Übersicht', i: 'home' },
  { href: '#/wiederholen', t: 'Wiederholen', i: 'repeat', badge: () => store.dueReviews().length || null },
  { href: '#/klausur', t: 'Probeklausur', i: 'exam' },
  { href: '#/spielwiese', t: 'Spielwiese', i: 'terminal' },
  { href: '#/spickzettel', t: 'Spickzettel', i: 'sheet' },
  { href: '#/erfolge', t: 'Erfolge', i: 'trophy' },
  { href: '#/einstellungen', t: 'Einstellungen', i: 'gear' },
];

function buildShell() {
  navEl = h('nav', { class: 'nav', 'aria-label': 'Hauptnavigation' });
  crumbsEl = h('div', { class: 'crumbs' });
  statsEl = h('div', { class: 'top-stats' });
  view = h('main', { class: 'content', id: 'main', tabindex: '-1' });
  mobileEl = h('nav', { class: 'mobile-bar', 'aria-label': 'Navigation mobil' });
  app.replaceChildren(
    h('a', { class: 'skip', href: '#main', onclick: (e) => { e.preventDefault(); view.focus(); } }, 'Zum Inhalt springen'),
    h('div', { class: 'shell' },
      h('aside', { class: 'sidebar' },
        h('a', { class: 'brand', href: '#/' }, h('span', { class: 'brand-mark' }, 'SQL', h('em', null, 'werkstatt'))),
        h('div', { class: 'brand-sub' }, 'Lernen · Üben · Bestehen'),
        navEl,
        h('div', { class: 'side-foot', id: 'side-foot' })),
      h('div', { class: 'main' },
        h('header', { class: 'topbar' },
          h('a', { class: 'brand brand-mobile', href: '#/', style: { padding: 0 } }, h('span', { class: 'brand-mark', style: { fontSize: '19px' } }, 'SQL', h('em', null, 'werkstatt'))),
          crumbsEl, statsEl),
        view)),
    mobileEl);
  refreshChrome();
}

function refreshChrome() {
  if (!navEl) return;
  const hash = location.hash || '#/';
  const cur = (href) => (href === '#/' ? hash === '#/' || hash === '' : hash.startsWith(href)) ? 'page' : null;
  const bereiche = [...new Set(MODULES.map((m) => m.bereich))];
  navEl.replaceChildren(
    ...NAV.slice(0, 3).map((n) => navLink(n, cur(n.href))),
    ...bereiche.flatMap((b) => [h('div', { class: 'nav-label' }, b), ...MODULES.filter((m) => m.bereich === b).map((m) => {
      const p = store.moduleProgress(m);
      return h('a', { href: `#/modul/${m.id}`, class: p.solved === p.total ? 'done' : '', 'aria-current': hash.startsWith(`#/modul/${m.id}`) || hash.startsWith(`#/aufgabe/${m.id}/`) ? 'page' : null },
        h('span', { class: 'num' }, m.nr), m.title, h('span', { class: 'pct' }, p.solved === p.total ? '✓' : `${p.solved}/${p.total}`));
    })]),
    h('div', { class: 'nav-label' }, 'Werkzeuge'),
    ...NAV.slice(3).map((n) => navLink(n, cur(n.href))));
  const lv = store.levelInfo();
  const foot = document.getElementById('side-foot');
  foot.replaceChildren(h('div', { class: 'card', style: { padding: '14px' } },
    h('div', { class: 'row', style: { justifyContent: 'space-between' } }, h('span', { class: 'eyebrow' }, `Stufe ${lv.idx + 1}`), h('span', { class: 'mono small muted' }, `${store.state.xp} XP`)),
    h('div', { style: { font: '600 19px/1.3 var(--font-serif)', margin: '6px 0 10px' } }, lv.name),
    bar(lv.pct, 'accent thin'),
    h('div', { class: 'small muted', style: { marginTop: '6px' } }, lv.next ? `${lv.next - store.state.xp} XP bis ${lv.nextName}` : 'Höchste Stufe erreicht')));
  const s = store.streak();
  statsEl.replaceChildren(
    h('span', { class: `stat-chip${s > 0 ? ' hot' : ''}`, title: 'Lerntage in Folge' }, icon('flame'), `${s}`),
    h('span', { class: 'stat-chip', title: 'Erfahrungspunkte' }, icon('bolt'), `${store.state.xp} XP`),
    h('span', { class: 'stat-chip hide-sm', title: store.sync.status === 'on' ? 'Lernstand wird auf dem Server gespeichert' : 'Lernstand nur in diesem Browser' }, h('span', { class: `sync-dot ${store.sync.status === 'on' ? 'on' : store.sync.status === 'err' ? 'err' : ''}` }), store.sync.status === 'on' ? 'Sync' : 'Lokal'));
  const due = store.dueReviews().length;
  mobileEl.replaceChildren(...[
    { href: '#/', t: 'Start', i: 'home' }, { href: '#/lernen', t: 'Lernen', i: 'book' }, { href: '#/wiederholen', t: due ? `Wdh. (${due})` : 'Wdh.', i: 'repeat' },
    { href: '#/klausur', t: 'Klausur', i: 'exam' }, { href: '#/mehr', t: 'Mehr', i: 'menu' },
  ].map((n) => h('a', { href: n.href, 'aria-current': cur(n.href) || (n.href === '#/lernen' && (hash.startsWith('#/modul') || hash.startsWith('#/aufgabe')) ? 'page' : null) }, icon(n.i), n.t)));
}
const navLink = (n, cur) => h('a', { href: n.href, 'aria-current': cur }, icon(n.i), n.t, n.badge && n.badge() ? h('span', { class: 'badge' }, String(n.badge())) : null);

function setCrumbs(parts) {
  crumbsEl.replaceChildren(...parts.flatMap((p, i) => [i ? h('span', { 'aria-hidden': 'true' }, '/') : '', typeof p === 'string' ? h('span', null, p) : h('a', { href: p[1] }, p[0])]));
  document.title = `${parts.map((p) => (typeof p === 'string' ? p : p[0])).slice(-1)[0] || 'Übersicht'} · SQL-Werkstatt`;
}

// ---------- Router ----------
function route() {
  const hash = location.hash.slice(1) || '/';
  const parts = hash.split('/').filter(Boolean);
  view.className = 'content';
  window.scrollTo({ top: 0 });
  refreshChrome();
  try {
    if (!parts.length) return dashboard();
    switch (parts[0]) {
      case 'modul': return moduleView(parts[1], parts[2] || 'lernen', Number(parts[3] || 0));
      case 'aufgabe': return taskView(parts[1], parts[2]);
      case 'wiederholen': return reviewView();
      case 'klausur': view.className = 'content wide'; return renderExam(view, setCrumbs);
      case 'spielwiese': view.className = 'content wide'; return playground();
      case 'spickzettel': return cheatsheet();
      case 'erfolge': return achievements();
      case 'einstellungen': return settings();
      case 'lernen': return learnIndex();
      case 'mehr': return moreView();
      default: return notFound();
    }
  } catch (e) {
    console.error(e);
    view.replaceChildren(h('div', { class: 'card' }, h('h2', { class: 'h2' }, 'Da ist etwas schiefgelaufen.'), h('p', { class: 'muted' }, String(e.message || e)), h('a', { class: 'btn', href: '#/' }, 'Zur Übersicht')));
  }
}
const notFound = () => { setCrumbs(['Nicht gefunden']); view.replaceChildren(h('h1', { class: 'display' }, 'Seite nicht gefunden.'), h('p', null, h('a', { class: 'btn', href: '#/' }, 'Zur Übersicht'))); };

// ---------- Übersicht ----------
function greeting() {
  const hr = new Date().getHours();
  return hr < 11 ? 'Guten Morgen' : hr < 18 ? 'Hallo' : 'Guten Abend';
}

function dashboard() {
  setCrumbs(['Übersicht']);
  const s = store.state;
  const r = store.readiness();
  const lv = store.levelInfo();
  const days = store.daysToExam();
  const open = ALL_TASKS.filter((t) => !store.isSolved(t.key)).length;
  const next = store.nextTask();
  const due = store.dueReviews().length;
  const perDay = days && days > 0 ? Math.ceil(open / days) : null;

  const countdown = days !== null && days >= 0
    ? h('div', { class: 'countdown' },
      h('p', { class: 'eyebrow' }, 'Bis zur Klausur'),
      h('div', { class: 'big' }, String(days), h('small', null, days === 1 ? 'Tag' : 'Tage')),
      h('p', { class: 'plan-line' }, open === 0 ? 'Alle Aufgaben gelöst – jetzt Probeklausuren schreiben.' : perDay ? `Plan: ${perDay} Aufgabe${perDay === 1 ? '' : 'n'} pro Tag + 1 Probeklausur alle 2 Tage.` : 'Heute ist Klausurtag. Viel Erfolg!'))
    : h('div', { class: 'countdown' }, h('p', { class: 'eyebrow' }, 'Klausurtermin'), h('p', { class: 'plan-line' }, 'Trage dein Klausurdatum ein – dann bekommst du einen Tagesplan.'), h('a', { class: 'btn sm', href: '#/einstellungen' }, 'Datum festlegen'));

  view.replaceChildren(
    h('section', { class: 'hero' },
      h('div', null,
        h('p', { class: 'eyebrow accent' }, new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })),
        h('h1', { class: 'display' }, `${greeting()}${s.name ? `, ${s.name}` : ''}.`, h('br'), next ? h('em', null, 'Weiter geht’s.') : h('em', null, 'Alles gelöst.')),
        h('p', { class: 'lead' }, next
          ? h('span', null, 'Als Nächstes: ', h('strong', null, MODULE_BY_ID[next.module].title), ' – ', TYPE_LABEL[next.type], '.')
          : 'Du hast alle Aufgaben gelöst. Festige dein Wissen mit Probeklausuren und der Wiederholung.'),
        h('div', { class: 'hero-actions' },
          next ? h('a', { class: 'btn accent lg', href: `#/aufgabe/${next.module}/${next.id}` }, icon('play'), 'Weiterlernen') : h('a', { class: 'btn accent lg', href: '#/klausur' }, icon('exam'), 'Probeklausur'),
          due ? h('a', { class: 'btn lg', href: '#/wiederholen' }, icon('repeat'), `${due} wiederholen`) : null)),
      countdown),

    h('section', { class: 'section grid g-4' },
      h('div', { class: 'card kpi' },
        h('div', { class: 'eyebrow' }, 'Klausurreife'),
        h('div', { class: 'kpi-val' }, String(r.score), h('small', null, '%')),
        h('div', { class: 'readiness-seg', title: 'Beherrschung je Modul' }, r.mastery.map((v) => { const i = h('i', { class: v >= 0.99 ? 'full' : '' }); i.style.height = `${Math.round(v * 100)}%`; return h('span', null, i); })),
        h('div', { class: 'readiness-legend' }, MODULES.map((m) => h('span', null, m.nr))),
        h('p', null, r.exam === null ? 'Schreib eine Probeklausur, um über 85 % zu kommen.' : r.weakest.v < 1 ? h('span', null, 'Schwächstes Thema: ', h('a', { href: `#/modul/${r.weakest.m.id}` }, r.weakest.m.title)) : 'Stark in allen Themen.')),
      h('div', { class: 'card kpi' },
        h('div', { class: 'eyebrow' }, `Stufe ${lv.idx + 1} von 6`),
        h('div', { class: 'kpi-val', style: { fontSize: '30px', margin: '14px 0 16px' } }, lv.name),
        bar(lv.pct, 'accent'),
        h('p', null, lv.next ? `${s.xp} XP · noch ${lv.next - s.xp} bis ${lv.nextName}` : `${s.xp} XP · Höchste Stufe`)),
      h('div', { class: 'card kpi' },
        h('div', { class: 'eyebrow' }, 'Lernserie'),
        h('div', { class: 'kpi-val' }, String(store.streak()), h('small', null, store.streak() === 1 ? 'Tag' : 'Tage')),
        streakDays(),
        h('p', null, s.days.includes(todayISO()) ? 'Heute schon gelernt.' : 'Heute noch nichts gelernt – eine Aufgabe reicht.')),
      h('div', { class: 'card kpi' },
        h('div', { class: 'eyebrow' }, 'Fortschritt'),
        h('div', { class: 'kpi-val' }, String(ALL_TASKS.length - open), h('small', null, `/ ${ALL_TASKS.length}`)),
        bar(((ALL_TASKS.length - open) / ALL_TASKS.length) * 100, 'ok'),
        h('p', null, `${due} fällig in der Wiederholung · ${s.exams.length} Probeklausur${s.exams.length === 1 ? '' : 'en'}`))),

    ...[...new Set(MODULES.map((m) => m.bereich))].map((b) => h('section', { class: 'section' },
      h('div', { class: 'section-head' }, h('h2', { class: 'h2' }, b), h('span', { class: 'rule-fill' }), h('span', { class: 'eyebrow' }, `${MODULES.filter((m) => m.bereich === b).length} Module`)),
      h('div', { class: 'mod-list' }, MODULES.filter((m) => m.bereich === b).map(moduleRow)))));
}

function moduleRow(m) {
  const p = store.moduleProgress(m);
  return h('a', { class: `mod-row${p.solved === p.total ? ' complete' : ''}`, href: `#/modul/${m.id}` },
    h('span', { class: 'nr' }, m.nr),
    h('span', null, h('div', { class: 't' }, m.title), h('div', { class: 's' }, m.short)),
    bar(p.pct, p.solved === p.total ? 'ok thin' : 'thin'),
    h('span', { class: 'cnt' }, `${p.solved}/${p.total}`),
    icon('chev'));
}

function streakDays() {
  const out = [];
  const set = new Set(store.state.days);
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const iso = todayISO(d);
    out.push(h('span', { class: `${set.has(iso) ? 'on' : ''}${i === 0 ? ' today' : ''}`, title: d.toLocaleDateString('de-DE') }, d.toLocaleDateString('de-DE', { weekday: 'narrow' })));
  }
  return h('div', { class: 'streak-days' }, out);
}

function learnIndex() {
  setCrumbs(['Lernen']);
  view.replaceChildren(h('h1', { class: 'display' }, 'Module'),
    ...[...new Set(MODULES.map((m) => m.bereich))].map((b) => h('section', { class: 'section' },
      h('div', { class: 'section-head' }, h('h2', { class: 'h2' }, b), h('span', { class: 'rule-fill' })),
      h('div', { class: 'mod-list' }, MODULES.filter((m) => m.bereich === b).map(moduleRow)))));
}
function moreView() {
  setCrumbs(['Mehr']);
  view.replaceChildren(h('h1', { class: 'display' }, 'Werkzeuge'),
    h('div', { class: 'mod-list section' }, NAV.slice(3).map((n) => h('a', { class: 'mod-row', href: n.href, style: { gridTemplateColumns: '36px 1fr 16px' } }, icon(n.i), h('span', { class: 't' }, n.t), icon('chev')))));
}

// ---------- Modul ----------
function moduleView(id, tab, lessonIdx) {
  const m = MODULE_BY_ID[id];
  if (!m) return notFound();
  setCrumbs([['Übersicht', '#/'], `${m.nr} ${m.title}`]);
  const p = store.moduleProgress(m);
  const tabs = [['lernen', 'Lernen', `${p.lessons}/${p.lessonTotal}`], ['aufgaben', 'Aufgaben', `${p.solved}/${p.total}`]];
  view.replaceChildren(
    h('header', { class: 'mod-head' },
      h('div', { class: 'bignr' }, m.nr),
      h('div', null, h('p', { class: 'eyebrow' }, m.bereich), h('h1', { class: 'display' }, m.title), h('p', { class: 'lead', style: { marginTop: '8px' } }, m.short)),
      h('div', { style: { minWidth: '200px' } }, h('div', { class: 'row', style: { justifyContent: 'space-between', marginBottom: '6px' } }, h('span', { class: 'eyebrow' }, 'Fortschritt'), h('span', { class: 'mono small' }, `${Math.round(p.pct)} %`)), bar(p.pct, p.solved === p.total ? 'ok' : 'accent'))),
    h('div', { class: 'tabs', role: 'tablist' }, tabs.map(([k, t, c]) => h('button', { role: 'tab', 'aria-selected': String(tab === k), onclick: () => { location.hash = `#/modul/${id}/${k}`; } }, t, h('span', { class: 'pill' }, c)))),
    tab === 'aufgaben' ? taskList(m) : lessonView(m, Math.min(lessonIdx, m.lessons.length - 1)));
}

function lessonView(m, idx) {
  const L = m.lessons[idx];
  const read = (i) => !!store.state.lessons[`${m.id}/${i}`];
  const finish = () => {
    const xp = store.markLesson(m.id, idx);
    if (xp) toast(h('span', null, 'Lerneinheit abgeschlossen ', h('b', null, `+${xp} XP`)));
    location.hash = idx < m.lessons.length - 1 ? `#/modul/${m.id}/lernen/${idx + 1}` : `#/modul/${m.id}/aufgaben`;
  };
  return h('div', { class: 'lesson-layout' },
    h('nav', { class: 'lesson-toc', 'aria-label': 'Lerneinheiten' }, m.lessons.map((l, i) => h('button', { type: 'button', 'aria-current': String(i === idx), onclick: () => { location.hash = `#/modul/${m.id}/lernen/${i}`; } },
      h('span', { class: 'n' }, `${m.nr}.${i + 1}`), l.title, read(i) ? h('span', { class: 'check', 'aria-label': 'gelesen' }, '✓') : null))),
    h('article', { class: 'lesson' },
      h('p', { class: 'eyebrow accent' }, `Lerneinheit ${m.nr}.${idx + 1}`),
      h('h2', null, L.title),
      renderBlocks(L.blocks),
      h('div', { class: 'lesson-nav' },
        idx > 0 ? h('a', { class: 'btn ghost', href: `#/modul/${m.id}/lernen/${idx - 1}` }, icon('chevL'), m.lessons[idx - 1].title) : h('span'),
        h('button', { class: 'btn primary', type: 'button', onclick: finish }, idx < m.lessons.length - 1 ? `Verstanden – weiter` : 'Verstanden – zu den Aufgaben', icon('chev')))));
}

function taskList(m) {
  const firstOpen = m.tasks.find((t) => !store.isSolved(`${m.id}/${t.id}`));
  return h('div', null,
    h('div', { class: 'row', style: { marginBottom: '16px' } },
      h('p', { class: 'muted', style: { margin: 0 } }, `${m.tasks.length} Aufgaben · Punkte: leicht ${XP_BY_LEVEL[1]}, mittel ${XP_BY_LEVEL[2]}, schwer ${XP_BY_LEVEL[3]} XP · +5 beim ersten Versuch`),
      h('span', { class: 'spacer' }),
      firstOpen ? h('a', { class: 'btn accent', href: `#/aufgabe/${m.id}/${firstOpen.id}` }, icon('play'), 'Nächste offene Aufgabe') : h('span', { class: 'pill ok' }, icon('check'), 'Modul abgeschlossen')),
    h('div', { class: 'task-grid' }, m.tasks.map((t, i) => {
      const ts = store.taskState(`${m.id}/${t.id}`);
      return h('a', { class: `task-tile${ts?.status === 'solved' ? ' solved' : ''}`, href: `#/aufgabe/${m.id}/${t.id}` },
        h('div', { class: 'tt-head' }, h('span', null, `${m.nr}.${String(i + 1).padStart(2, '0')}`), h('span', null, TYPE_LABEL[t.type]), levelDots(t.level),
          h('span', { class: `st st-dot ${ts?.status || ''}`, title: ts?.status === 'solved' ? 'gelöst' : ts?.status === 'tried' ? 'versucht' : 'offen' })),
        h('div', { class: 'tt-q', html: md(t.q) }));
    })));
}

// ---------- Aufgabe ----------
function taskView(mid, tid) {
  const m = MODULE_BY_ID[mid];
  const t = m && TASK_BY_KEY[`${mid}/${tid}`];
  if (!t) return notFound();
  const i = m.tasks.findIndex((x) => x.id === tid);
  setCrumbs([['Übersicht', '#/'], [`${m.nr} ${m.title}`, `#/modul/${m.id}/aufgaben`], `Aufgabe ${i + 1}`]);
  view.className = 'content wide';
  const nextT = m.tasks[i + 1];
  const onNext = () => { location.hash = nextT ? `#/aufgabe/${m.id}/${nextT.id}` : `#/modul/${m.id}/aufgaben`; };
  view.replaceChildren(
    renderTaskWorkspace(t, { onNext, position: `${m.nr}.${String(i + 1).padStart(2, '0')} · ${i + 1} von ${m.tasks.length}` }),
    h('div', { class: 'lesson-nav' },
      i > 0 ? h('a', { class: 'btn ghost', href: `#/aufgabe/${m.id}/${m.tasks[i - 1].id}` }, icon('chevL'), 'Vorherige') : h('span'),
      h('a', { class: 'btn ghost', href: `#/modul/${m.id}/aufgaben` }, 'Alle Aufgaben'),
      nextT ? h('a', { class: 'btn ghost', href: `#/aufgabe/${m.id}/${nextT.id}` }, 'Überspringen', icon('chev')) : h('span')));
}

// ---------- Wiederholung ----------
function reviewView() {
  setCrumbs(['Wiederholen']);
  const due = store.dueReviews();
  const all = store.inReview();
  if (!due.length) {
    view.replaceChildren(
      h('p', { class: 'eyebrow accent' }, 'Wiederholung'),
      h('h1', { class: 'display' }, all.length ? 'Für heute erledigt.' : 'Nichts zu wiederholen.'),
      h('p', { class: 'lead' }, all.length
        ? `${all.length} Aufgabe${all.length === 1 ? '' : 'n'} ${all.length === 1 ? 'liegt' : 'liegen'} im Karteikasten und ${all.length === 1 ? 'kommt' : 'kommen'} in den nächsten Tagen wieder.`
        : 'Aufgaben, die du falsch beantwortet, nur mit Hinweis gelöst oder dir hast zeigen lassen, landen hier. Sie kommen nach 1, 3 und 7 Tagen wieder – bis sie sitzen.'),
      boxOverview(all),
      h('div', { class: 'hero-actions' }, h('a', { class: 'btn primary', href: '#/' }, 'Zur Übersicht'), h('a', { class: 'btn', href: '#/klausur' }, 'Probeklausur schreiben')));
    return;
  }
  view.className = 'content wide';
  const t = due[0];
  view.replaceChildren(
    h('div', { class: 'row', style: { marginBottom: '22px' } },
      h('div', null, h('p', { class: 'eyebrow accent' }, 'Wiederholung'), h('h1', { class: 'h2' }, `Noch ${due.length} fällig`)),
      h('span', { class: 'spacer' }), boxOverview(all, true)),
    renderTaskWorkspace(t, { mode: 'review', onNext: () => route(), position: MODULE_BY_ID[t.module].title }));
}
function boxOverview(all, compact) {
  const boxes = [1, 2, 3].map((b) => all.filter((t) => store.taskState(t.key).box === b).length);
  return h('div', { class: 'row', style: compact ? {} : { margin: '24px 0' } }, boxes.map((n, i) => h('span', { class: 'pill' }, `Fach ${i + 1}: ${n}`)));
}

// ---------- Spielwiese ----------
let pgDb = null;
function playground() {
  setCrumbs(['Spielwiese']);
  if (!pgDb) pgDb = engine.freshDb();
  const out = h('div');
  const hist = JSON.parse(sessionStorage.getItem('sqlwork.hist') || '[]');
  const histEl = h('div', { class: 'stack' });
  const drawHist = () => histEl.replaceChildren(...hist.slice(0, 8).map((q) => h('button', { class: 'btn ghost sm', type: 'button', style: { justifyContent: 'flex-start', height: 'auto', padding: '6px 10px', whiteSpace: 'normal', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: '12px' }, onclick: () => { ed.value = q; ed.focus(); } }, q.length > 90 ? q.slice(0, 90) + '…' : q)));
  const exec = () => {
    const q = ed.value.trim();
    if (!q) return;
    const r = engine.run(pgDb, q);
    out.replaceChildren(resultPanel(r, engine.translateError));
    if (r.ok) { const i = hist.indexOf(q); if (i >= 0) hist.splice(i, 1); hist.unshift(q); hist.length = Math.min(hist.length, 20); try { sessionStorage.setItem('sqlwork.hist', JSON.stringify(hist)); } catch { /* */ } drawHist(); }
    store.state.playgroundRuns = (store.state.playgroundRuns || 0) + 1;
  };
  const ed = createEditor({ value: store.state.drafts.__pg || 'SELECT k.firma, COUNT(b.bestell_id) AS bestellungen\nFROM kunde k\nLEFT JOIN bestellung b ON b.kunde_id = k.kunde_id\nGROUP BY k.firma\nORDER BY bestellungen DESC;', minLines: 8, chips: true, onRun: exec, onChange: (v) => store.setDraft('__pg', v) });
  drawHist();
  const db0 = engine.freshDb();
  const tables = engine.tableNames(db0);
  db0.close();
  view.replaceChildren(
    h('div', { class: 'row', style: { marginBottom: '20px' } },
      h('div', null, h('p', { class: 'eyebrow accent' }, 'Spielwiese'), h('h1', { class: 'h2' }, 'Freies Experimentieren')),
      h('span', { class: 'spacer' }),
      h('button', { class: 'btn', type: 'button', onclick: () => { pgDb.close(); pgDb = engine.freshDb(); out.replaceChildren(h('div', { class: 'empty-res' }, 'Datenbank auf Ausgangszustand zurückgesetzt.')); } }, icon('reset'), 'Datenbank zurücksetzen')),
    h('div', { class: 'task-layout' },
      h('div', { class: 'task-brief' },
        h('p', { class: 'muted small' }, 'Alles ist erlaubt – auch INSERT, UPDATE, DELETE und CREATE TABLE. Änderungen bleiben bis zum Zurücksetzen bestehen. Klick auf eine Spalte fügt sie ein.'),
        h('details', { class: 'drawer', open: true }, h('summary', null, icon('db'), 'Tabellen'), h('div', { class: 'drawer-body flush' }, schemaPanel(tables, (name, isTable) => { if (isTable) { ed.value = `SELECT *\nFROM ${name}\nLIMIT 20;`; exec(); } else ed.insert(name); }))),
        h('details', { class: 'drawer' }, h('summary', null, icon('grid'), 'ER-Diagramm'), h('div', { class: 'drawer-body' }, h('a', { class: 'btn sm', href: '#/spickzettel' }, 'Im Spickzettel öffnen'))),
        hist.length || true ? h('details', { class: 'drawer' }, h('summary', null, icon('clock'), 'Verlauf'), h('div', { class: 'drawer-body' }, histEl)) : null),
      h('div', null,
        h('div', { class: 'runner', style: { margin: 0 } }, ed.el, out),
        h('div', { class: 'actions' }, h('button', { class: 'btn primary', type: 'button', onclick: exec }, icon('play'), 'Ausführen', h('kbd', null, 'Strg ↵'))))));
  ed.focus();
}

// ---------- Spickzettel ----------
function cheatsheet() {
  setCrumbs(['Spickzettel']);
  const c = (title, ...children) => h('div', { class: 'card' }, h('h3', null, title), ...children);
  const pre = (s) => { const p = h('pre'); p.innerHTML = highlight(s).trimEnd(); return p; };
  view.replaceChildren(
    h('div', { class: 'row no-print', style: { marginBottom: '22px' } },
      h('div', null, h('p', { class: 'eyebrow accent' }, 'Spickzettel'), h('h1', { class: 'display' }, 'Alles auf einen Blick.')),
      h('span', { class: 'spacer' }), h('button', { class: 'btn', type: 'button', onclick: () => window.print() }, 'Drucken')),
    h('h2', { class: 'h2', style: { margin: '10px 0 12px' } }, 'Die Lerndatenbank'),
    erDiagram(),
    h('div', { class: 'cheat section' },
      c('Grundgerüst', pre("SELECT spalte, AVG(x) AS alias\nFROM tabelle t\nJOIN andere a ON a.id = t.a_id\nWHERE bedingung          -- Zeilen\nGROUP BY spalte\nHAVING COUNT(*) > 1      -- Gruppen\nORDER BY alias DESC\nLIMIT 10;"), mdEl('p', 'Ausführung: **FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT**', { class: 'small' })),
      c('WHERE-Operatoren', refTable({ head: ['Operator', 'Beispiel'], rows: [['`= <> < > <= >=`', '`preis >= 10`'], ['`BETWEEN … AND …`', 'inkl. Grenzen'], ['`IN (…)`', "`ort IN ('A','B')`"], ['`LIKE`', "`'%GmbH'` · `_` = 1 Zeichen"], ['`IS NULL`', 'nie `= NULL`!'], ['`AND` vor `OR`', 'Klammern setzen']] })),
      c('Aggregate', refTable({ head: ['Funktion', 'NULL'], rows: [['`COUNT(*)`', 'zählt alle Zeilen'], ['`COUNT(sp)`', 'ohne NULL'], ['`COUNT(DISTINCT sp)`', 'verschiedene Werte'], ['`SUM` `AVG` `MIN` `MAX`', 'ignorieren NULL']] }), mdEl('p', '**Regel:** Jede Spalte im SELECT steht in GROUP BY oder in einer Aggregatfunktion.', { class: 'small' })),
      c('JOINs', refTable({ head: ['Art', 'Ergebnis'], rows: [['`INNER JOIN`', 'nur Zeilen mit Partner'], ['`LEFT JOIN`', 'alle links, rechts ggf. NULL'], ['ohne Bedingung', 'kartesisches Produkt (n × m)'], ['n Tabellen', 'n − 1 Join-Bedingungen']] }), pre('SELECT k.firma\nFROM kunde k\nLEFT JOIN bestellung b ON b.kunde_id = k.kunde_id\nWHERE b.bestell_id IS NULL;  -- ohne Bestellung')),
      c('Unterabfragen', pre('WHERE preis > (SELECT AVG(preis) FROM artikel)\nWHERE id IN (SELECT kunde_id FROM bestellung)\nWHERE id NOT IN (SELECT kunde_id FROM bestellung)'), mdEl('p', 'Mehrere Werte → `IN`, nicht `=`.', { class: 'small' })),
      c('Daten ändern', pre("INSERT INTO t (a, b) VALUES (1, 'x');\nUPDATE t SET b = 'y' WHERE a = 1;\nDELETE FROM t WHERE a = 1;"), mdEl('p', '**Ohne WHERE trifft es alle Zeilen.** Vorher mit SELECT prüfen. Abhängige Datensätze (FK) zuerst löschen.', { class: 'small' })),
      c('Bereinigen', refTable({ head: ['Funktion', 'Zweck'], rows: [['`TRIM(x)`', 'Leerzeichen am Rand'], ['`UPPER` / `LOWER`', 'Schreibweise'], ['`REPLACE(x,a,b)`', 'ersetzen'], ['`LENGTH(x)`', 'Länge prüfen'], ['`SUBSTR(x,s,l)`', 'Teilstück'], ['`COALESCE(x,y)`', 'Ersatz für NULL'], ['`CASE WHEN … END`', 'zuordnen']] })),
      c('Fehlerarten → Maßnahmen', refTable({ head: ['Art', 'Maßnahme'], rows: [['fehlend', 'ergänzen, erfragen, Pflichtfeld'], ['ungültig', 'korrigieren, Validierung/CHECK'], ['uneinheitlich', 'standardisieren (TRIM, CASE, ISO-Datum)'], ['doppelt', 'zusammenführen, löschen, UNIQUE']] })),
      c('Datenqualität', mdEl('p', '**K**orrekt · **V**ollständig · **K**onsistent · **E**indeutig · **E**inheitlich · **G**ültig · **A**ktuell (+ Relevanz, Genauigkeit, Verständlichkeit)'), mdEl('p', 'DSGVO Art. 5: **Richtigkeit**, Datenminimierung, Speicherbegrenzung, Zweckbindung. Rechte: Auskunft (15), Berichtigung (16), Löschung (17).', { class: 'small' })),
      c('Auffällige Buchungen', h('ul', { class: 'small' }, ['doppelte Belegnummer', 'fehlender Beleg', 'Wochenende / Feiertag', 'knapp unter Freigabegrenze', 'runde, hohe Beträge', 'negative Beträge ohne Grund', 'unberechtigte Person', 'Datum in der Zukunft', 'Ausreißer (> 3 × Durchschnitt)'].map((x) => h('li', null, x)))),
      c('Kanban', mdEl('p', '**Pull-Prinzip:** Arbeit wird geholt, wenn Kapazität frei ist (nicht zugeschoben). **WIP-Limit:** max. Karten pro Spalte → keine Überlastung, Engpässe sichtbar, kürzere Durchlaufzeit. *Stop starting, start finishing.*', { class: 'small' })),
      c('Typische Fehler', h('ul', { class: 'small' }, ['Komma fehlt/zu viel', "Text ohne ' '", '= NULL statt IS NULL', 'Aggregat in WHERE → HAVING', 'Spalte fehlt in GROUP BY', 'Klauseln falsch sortiert', 'mehrdeutige Spalte → Alias', 'Join-Bedingung fehlt', 'AND/OR ohne Klammern', 'LIKE ohne %', '= statt IN bei Liste'].map((x) => h('li', null, x))))));
}

// ---------- Erfolge ----------
function achievements() {
  setCrumbs(['Erfolge']);
  const s = store.state;
  const solved = ALL_TASKS.filter((t) => store.isSolved(t.key));
  const first = solved.filter((t) => s.tasks[t.key].firstTry).length;
  const got = store.BADGES.filter((b) => s.badges[b.id]).length;
  view.replaceChildren(
    h('p', { class: 'eyebrow accent' }, 'Erfolge'),
    h('h1', { class: 'display' }, `${got} von ${store.BADGES.length} Abzeichen.`),
    h('section', { class: 'section grid g-4' },
      statCard('Gelöst', `${solved.length}`, `von ${ALL_TASKS.length} Aufgaben`),
      statCard('Erster Versuch', solved.length ? `${Math.round((first / solved.length) * 100)} %` : '–', 'ohne Fehler und Hinweis'),
      statCard('Beste Serie', String(s.bestCombo || 0), 'richtige Antworten in Folge'),
      statCard('Probeklausuren', String(s.exams.length), s.exams.length ? `Bestnote ${Math.min(...s.exams.map((e) => e.grade))}` : 'noch keine')),
    h('section', { class: 'section' },
      h('div', { class: 'section-head' }, h('h2', { class: 'h2' }, 'Abzeichen'), h('span', { class: 'rule-fill' })),
      h('div', { class: 'badges' }, store.BADGES.map((b) => h('div', { class: `badge-card${s.badges[b.id] ? '' : ' locked'}` }, stamp(b.sym, !!s.badges[b.id]), h('div', { class: 'bt' }, b.t), h('div', { class: 'bd' }, b.d),
        s.badges[b.id] ? h('div', { class: 'bd mono' }, new Date(s.badges[b.id]).toLocaleDateString('de-DE')) : null)))),
    h('section', { class: 'section' },
      h('div', { class: 'section-head' }, h('h2', { class: 'h2' }, 'Stufen'), h('span', { class: 'rule-fill' })),
      h('div', { class: 'mod-list' }, store.LEVELS.map((l, i) => {
        const need = Math.round(l.at * store.MAX_XP);
        const reached = s.xp >= need;
        return h('div', { class: `mod-row${reached ? ' complete' : ''}`, style: { gridTemplateColumns: '56px 1fr 120px' } }, h('span', { class: 'nr' }, String(i + 1)), h('span', { class: 't' }, l.name), h('span', { class: 'cnt' }, `${need} XP`));
      }))));
}
const statCard = (k, v, sub) => h('div', { class: 'card kpi' }, h('div', { class: 'eyebrow' }, k), h('div', { class: 'kpi-val' }, v), h('p', null, sub));

function stamp(sym, on) {
  const col = on ? 'var(--accent)' : 'var(--ink-3)';
  const svg = svgEl('svg', { class: 'stamp', viewBox: '0 0 80 80', 'aria-hidden': 'true' },
    svgEl('circle', { cx: 40, cy: 40, r: 36, fill: 'none', stroke: col, 'stroke-width': 2 }),
    svgEl('circle', { cx: 40, cy: 40, r: 30, fill: 'none', stroke: col, 'stroke-width': 1, 'stroke-dasharray': '2 3' }),
    svgEl('text', { x: 40, y: 47, 'text-anchor': 'middle', fill: col, 'font-family': 'Fraunces, Georgia, serif', 'font-size': sym.length > 2 ? 17 : 22, 'font-weight': 600 }, sym));
  return svg;
}

// ---------- Einstellungen ----------
function settings() {
  setCrumbs(['Einstellungen']);
  const s = store.state;
  const name = h('input', { class: 'input', value: s.name || '', maxlength: 40 });
  const date = h('input', { class: 'input', type: 'date', value: s.examDate || '' });
  const theme = h('select', { class: 'select' }, [['system', 'Wie System'], ['light', 'Hell'], ['dark', 'Dunkel']].map(([v, t]) => h('option', { value: v, selected: s.theme === v }, t)));
  const fileIn = h('input', { type: 'file', accept: 'application/json', class: 'sr-only', onchange: async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { store.importState(await f.text()); toast('Lernstand importiert.'); route(); } catch (err) { toast(String(err.message)); }
  } });
  view.replaceChildren(
    h('p', { class: 'eyebrow accent' }, 'Einstellungen'),
    h('h1', { class: 'display' }, 'Deine Werkstatt.'),
    h('section', { class: 'section grid g-2' },
      h('div', { class: 'card stack' },
        h('h2', { class: 'h3' }, 'Profil'),
        h('label', { class: 'field' }, 'Name', name),
        h('label', { class: 'field' }, 'Klausurdatum', date),
        h('label', { class: 'field' }, 'Darstellung', theme),
        h('div', { class: 'actions' }, h('button', { class: 'btn primary', type: 'button', onclick: () => {
          const n = name.value.trim();
          if (n && n !== s.name) { s.name = n; if (!s.profile) s.profile = store.slug(n); }
          s.examDate = date.value; s.theme = theme.value; applyTheme(); store.save(); toast('Gespeichert.');
        } }, 'Speichern'))),
      h('div', { class: 'card stack' },
        h('h2', { class: 'h3' }, 'Speicherung & Sync'),
        mdEl('p', store.sync.status === 'on'
          ? `Dein Lernstand wird automatisch auf deinem Server gespeichert (Profil **${s.profile}**). Öffne die Werkstatt auf einem anderen Gerät mit demselben Namen, um weiterzulernen.`
          : 'Der Lernstand wird in diesem Browser gespeichert. Läuft die Werkstatt per Docker, wird zusätzlich automatisch auf dem Server gespeichert.', { class: 'small muted' }),
        s.profile ? h('label', { class: 'field' }, 'Profil-Kennung (für andere Geräte)', h('div', { class: 'row' },
          h('input', { class: 'input mono', id: 'profile-in', value: s.profile, style: { flex: 1 } }),
          h('button', { class: 'btn', type: 'button', onclick: async () => {
            const v = store.slug(document.getElementById('profile-in').value);
            if (v === s.profile) return;
            if (await confirmDialog('Profil wechseln?', `Der Lernstand von „${v}“ wird vom Server geladen, falls vorhanden. Der aktuelle Stand bleibt unter „${s.profile}“ gespeichert.`, 'Wechseln')) {
              s.profile = v; s.updatedAt = 0; store.save({ touch: false }); await store.pullFromServer(); route();
            }
          } }, 'Laden'))) : null,
        h('div', { class: 'actions' },
          h('button', { class: 'btn', type: 'button', onclick: () => {
            const blob = new Blob([store.exportState()], { type: 'application/json' });
            const a = h('a', { href: URL.createObjectURL(blob), download: `sqlwerkstatt-${s.profile || 'lernstand'}-${todayISO()}.json` });
            document.body.appendChild(a); a.click(); a.remove();
          } }, 'Exportieren'),
          h('button', { class: 'btn', type: 'button', onclick: () => fileIn.click() }, 'Importieren'), fileIn)),
      h('div', { class: 'card stack' },
        h('h2', { class: 'h3' }, 'Tastenkürzel'),
        refTable({ head: ['Kürzel', 'Aktion'], rows: [['`Strg` + `Enter`', 'Abfrage ausführen'], ['`Strg` + `⇧` + `Enter`', 'Aufgabe prüfen'], ['`Tab`', 'Einrücken im Editor'], ['`Esc`', 'Editor verlassen / Dialog schließen']] })),
      h('div', { class: 'card stack' },
        h('h2', { class: 'h3' }, 'Zurücksetzen'),
        h('p', { class: 'small muted' }, 'Löscht XP, gelöste Aufgaben, Abzeichen und Probeklausuren. Name und Klausurdatum bleiben.'),
        h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', onclick: async () => {
          if (await confirmDialog('Wirklich alles zurücksetzen?', 'Dein gesamter Lernfortschritt wird gelöscht. Das lässt sich nicht rückgängig machen – exportiere ihn vorher, falls du ihn behalten willst.', 'Zurücksetzen', true)) { store.resetState(); toast('Lernstand zurückgesetzt.'); route(); }
        } }, 'Lernstand zurücksetzen')))),
    h('p', { class: 'small muted section' }, `SQL-Werkstatt · ${ALL_TASKS.length} Aufgaben in ${MODULES.length} Modulen · SQLite ${sqliteVersion()} im Browser (WebAssembly)`));
}

function sqliteVersion() { const db = engine.freshDb(); const v = engine.run(db, 'SELECT sqlite_version()').last.values[0][0]; db.close(); return v; }

// ---------- Onboarding & Feiern ----------
function onboarding() {
  const name = h('input', { class: 'input', placeholder: 'Vorname', maxlength: 40, autocomplete: 'given-name' });
  const date = h('input', { class: 'input', type: 'date' });
  modal((close) => h('form', { class: 'stack', onsubmit: (e) => {
    e.preventDefault();
    const n = name.value.trim() || 'Lernende:r';
    store.state.name = n;
    store.state.profile = store.slug(n);
    store.state.examDate = date.value;
    store.save();
    close();
    store.pullFromServer().then(() => route());
  } },
  h('p', { class: 'eyebrow accent' }, 'Willkommen in der'),
  h('h2', { class: 'display', style: { fontSize: '34px' } }, 'SQL', h('em', null, 'werkstatt')),
  h('p', { class: 'muted' }, '7 Module, über 150 Aufgaben, Probeklausuren mit IHK-Notenschlüssel. Erst verstehen, dann üben, dann unter Zeitdruck bestehen.'),
  h('label', { class: 'field' }, 'Wie heißt du?', name),
  h('label', { class: 'field' }, 'Wann ist deine Klausur? (optional)', date),
  h('p', { class: 'small muted', style: { margin: 0 } }, 'Dein Name dient als Profil – damit kannst du auf anderen Geräten weiterlernen.'),
  h('div', { class: 'actions' }, h('button', { class: 'btn accent lg', type: 'submit' }, 'Los geht’s'))), { dismissable: false });
}

function celebrate(r) {
  refreshChrome();
  r.newBadges.forEach((b) => toast(h('span', null, 'Abzeichen freigeschaltet: ', h('b', null, b.t)), 4200));
  if (r.levelUp) {
    modal((close) => h('div', { class: 'stack levelup', style: { textAlign: 'center', alignItems: 'center' } },
      stamp(String(r.levelUp.idx + 1), true),
      h('p', { class: 'eyebrow accent' }, 'Neue Stufe'),
      h('h2', { class: 'display' }, r.levelUp.name),
      h('p', { class: 'muted' }, r.levelUp.next ? `Nächste Stufe: ${r.levelUp.nextName} bei ${r.levelUp.next} XP.` : 'Du hast die höchste Stufe erreicht.'),
      h('button', { class: 'btn primary', type: 'button', onclick: close }, 'Weiter')));
  }
}

boot();
