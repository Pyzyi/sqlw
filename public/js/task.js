// Aufgaben-Arbeitsplatz für alle Aufgabentypen (Lernen, Wiederholen, Klausur).
import { h, md, mdEl, icon, levelDots, resultPanel, dataTable, toast, shuffle } from './ui.js';
import { createEditor, codeBlock } from './editor.js';
import * as engine from './engine.js';
import * as store from './store.js';
import { XP_BY_LEVEL } from './content/index.js';
import { formelsammlungButton } from './formelsammlung.js';

export const TYPE_LABEL = { mc: 'Auswahl', sql: 'SQL schreiben', fix: 'Fehler finden', dml: 'Daten ändern', predict: 'Ergebnis bestimmen', grid: 'Ergebnistabelle', order: 'Reihenfolge', classify: 'Zuordnen', text: 'Freitext' };
const isSqlType = (t) => ['sql', 'fix', 'dml'].includes(t.type);

// ---------------- Typ-Renderer ----------------
// Jeder Renderer liefert { el, answer(), answered(), check() -> {ok, score, reason}, reveal(res), restore(a) }

function mcRenderer(task, seed) {
  const order = shuffle(task.options.map((_, i) => i), seed);
  const sel = new Set();
  let locked = false;
  const btns = order.map((oi, pos) => {
    const b = h('button', { class: `option${task.multi ? ' multi' : ''}`, type: 'button', 'aria-pressed': 'false', onclick: () => {
      if (locked) return;
      if (task.multi) { sel.has(oi) ? sel.delete(oi) : sel.add(oi); } else { sel.clear(); sel.add(oi); }
      btns.forEach((x, j) => x.setAttribute('aria-pressed', String(sel.has(order[j]))));
    } }, h('span', { class: 'key' }, String.fromCharCode(65 + pos)), h('span', { html: md(task.options[oi]) }));
    return b;
  });
  const correct = new Set(task.multi ? task.correct : [task.correct]);
  return {
    el: h('div', null, task.multi ? h('p', { class: 'small muted', style: { marginTop: '10px' } }, 'Mehrere Antworten können richtig sein.') : null, h('div', { class: 'options', role: 'group' }, btns)),
    answer: () => [...sel],
    answered: () => sel.size > 0,
    restore: (a) => { (a || []).forEach((i) => sel.add(i)); btns.forEach((x, j) => x.setAttribute('aria-pressed', String(sel.has(order[j])))); },
    check: () => {
      const right = [...sel].filter((i) => correct.has(i)).length;
      const wrong = sel.size - right;
      const ok = right === correct.size && wrong === 0;
      const score = task.multi ? Math.max(0, (right - wrong) / correct.size) : ok ? 1 : 0;
      return { ok, score, reason: ok ? null : task.multi ? `${right} von ${correct.size} richtigen Antworten gewählt${wrong ? `, ${wrong} falsche dabei` : ''}.` : 'Diese Antwort ist nicht richtig.' };
    },
    reveal: () => { locked = true; btns.forEach((b, j) => { const oi = order[j]; b.disabled = true; if (correct.has(oi)) b.classList.add('right'); else if (sel.has(oi)) b.classList.add('wrong'); }); },
  };
}

function classifyRenderer(task, seed) {
  const items = shuffle(task.items.map((it, i) => ({ ...it, i })), seed);
  const choice = {};
  let locked = false;
  const rows = items.map((it) => {
    const opts = task.categories.map((c, ci) => h('button', { type: 'button', 'aria-pressed': 'false', onclick: () => {
      if (locked) return;
      choice[it.i] = ci;
      opts.forEach((o, k) => o.setAttribute('aria-pressed', String(k === ci)));
    } }, c));
    return { it, opts, el: h('div', { class: 'cl-item' }, mdEl('div', it.t, { class: 'cl-text' }), h('div', { class: 'cl-opts', role: 'group' }, opts)) };
  });
  return {
    el: h('div', { class: 'classify' }, rows.map((r) => r.el)),
    answer: () => ({ ...choice }),
    answered: () => Object.keys(choice).length === task.items.length,
    restore: (a) => { Object.assign(choice, a || {}); rows.forEach((r) => r.opts.forEach((o, k) => o.setAttribute('aria-pressed', String(choice[r.it.i] === k)))); },
    check: () => {
      const right = task.items.filter((it, i) => choice[i] === it.c).length;
      return { ok: right === task.items.length, score: right / task.items.length, reason: `${right} von ${task.items.length} richtig zugeordnet.` };
    },
    reveal: () => {
      locked = true;
      rows.forEach((r) => r.opts.forEach((o, k) => {
        o.disabled = true;
        if (k === r.it.c && choice[r.it.i] === k) o.classList.add('right');
        else if (choice[r.it.i] === k) o.classList.add('wrong');
        else if (k === r.it.c) o.classList.add('should');
      }));
    },
  };
}

function orderRenderer(task, seed) {
  let pool = shuffle(task.items.map((t, i) => i), seed);
  if (pool.every((v, i) => v === i)) pool = pool.reverse();
  let picked = [];
  let locked = false;
  const left = h('div', { class: 'order-list' });
  const right = h('div', { class: 'order-list target' });
  const draw = () => {
    left.replaceChildren(...pool.filter((i) => !picked.includes(i)).map((i) => h('button', { type: 'button', onclick: () => { if (!locked) { picked.push(i); draw(); } } }, h('span', { class: 'idx' }, '+'), h('span', { html: md(task.items[i]) }))));
    right.replaceChildren(...picked.map((i, pos) => h('button', { type: 'button', title: 'Zurücklegen', onclick: () => { if (!locked) { picked = picked.filter((x) => x !== i); draw(); } } }, h('span', { class: 'idx' }, String(pos + 1)), h('span', { html: md(task.items[i]) }))),
      ...Array.from({ length: task.items.length - picked.length }, () => h('div', { class: 'order-slot' })));
  };
  draw();
  return {
    el: h('div', { class: 'order-wrap' },
      h('div', { class: 'order-col' }, h('h4', null, 'Bausteine – antippen'), left),
      h('div', { class: 'order-col' }, h('h4', null, 'Deine Reihenfolge'), right)),
    answer: () => picked.slice(),
    answered: () => picked.length === task.items.length,
    restore: (a) => { picked = (a || []).slice(); draw(); },
    check: () => {
      const right = picked.filter((v, i) => v === i).length;
      return { ok: right === task.items.length, score: right / task.items.length, reason: `${right} von ${task.items.length} Positionen richtig.` };
    },
    reveal: () => { locked = true; [...right.children].forEach((b, pos) => { if (b.tagName === 'BUTTON') b.classList.add(picked[pos] === pos ? 'right' : 'wrong'); }); },
  };
}

function predictRenderer(task) {
  const db = engine.scratchDb(task.setup);
  const tables = engine.tableNames(db).map((t) => ({ t, r: engine.run(db, `SELECT * FROM "${t}"`).last }));
  db.close();
  const input = h('input', { class: 'input mono', type: 'text', placeholder: 'Deine Antwort', 'aria-label': 'Antwort', autocomplete: 'off' });
  return {
    el: h('div', null,
      tables.map(({ t, r }) => h('div', { class: 'runner' }, h('div', { class: 'result-meta' }, h('span', null, `Tabelle ${t}`)), dataTable(r))),
      h('div', { class: 'predict-src' }, h('p', { class: 'eyebrow', style: { marginBottom: '6px' } }, 'Abfrage'), h('div', { class: 'runner' }, codeBlock(task.sql))),
      h('div', { class: 'predict-input' }, input)),
    input,
    answer: () => input.value,
    answered: () => input.value.trim() !== '',
    restore: (a) => { input.value = a || ''; },
    check: () => {
      const ok = engine.normalizeAnswer(input.value) === engine.normalizeAnswer(task.answer);
      return { ok, score: ok ? 1 : 0, reason: ok ? null : 'Das stimmt nicht. Geh die Abfrage Klausel für Klausel in Ausführungsreihenfolge durch.' };
    },
    reveal: () => { input.disabled = true; },
  };
}

function sqlRenderer(task, { allowRun = true, onRunHook } = {}) {
  const out = h('div');
  const startVal = task.start || '';
  const ed = createEditor({
    value: startVal, minLines: 6, chips: true,
    placeholder: task.type === 'dml' ? 'UPDATE … / INSERT … / DELETE …' : 'SELECT …',
    onRun: () => allowRun && runIt(),
    onSubmit: () => onRunHook && onRunHook('submit'),
  });
  const runIt = () => {
    const db = engine.freshDb(task.db);
    const r = engine.run(db, ed.value);
    let after = null;
    if (r.ok && task.type === 'dml' && !r.last) after = engine.run(db, task.check);
    db.close();
    out.replaceChildren(resultPanel(r, engine.translateError));
    if (after && after.ok) out.appendChild(h('div', { class: 'result' }, h('div', { class: 'result-meta' }, h('span', null, 'Bestand nach deiner Änderung (Prüfabfrage)')), dataTable(after.last)));
  };
  let lastGrade = null;
  return {
    el: h('div', { class: 'runner', style: { margin: 0 } }, ed.el, out),
    editor: ed, runIt, out,
    answer: () => ed.value,
    answered: () => ed.value.trim() !== '' && ed.value.trim() !== (startVal || '').trim(),
    restore: (a) => { if (a != null) ed.value = a; },
    check: () => {
      lastGrade = engine.grade(task, ed.value);
      if (lastGrade.result || lastGrade.error) out.replaceChildren(resultPanel(lastGrade.error ? { ok: false, error: lastGrade.error } : { ok: true, last: lastGrade.result }, engine.translateError));
      return { ok: lastGrade.ok, score: lastGrade.ok ? 1 : lastGrade.almost ? 0.75 : 0, reason: lastGrade.reason, almost: lastGrade.almost };
    },
    reveal: () => {},
  };
}


// Freitext mit Erwartungshorizont und Selbstkontrolle
function textRenderer(task) {
  const ta = h('textarea', { class: 'input textanswer', rows: 8, placeholder: 'Deine Antwort – in ganzen Sätzen oder Stichpunkten, wie in der Klausur.', 'aria-label': 'Antwort' });
  const tableEl = task.table ? h('div', { class: 'runner' }, dataTable({ columns: task.table.head, values: task.table.rows })) : null;
  const selfBox = h('div');
  let ticks = null;
  const api = {
    el: h('div', null, tableEl, ta, selfBox),
    textarea: ta,
    answer: () => ta.value,
    answered: () => ta.value.trim().length > 0,
    restore: (a) => { ta.value = typeof a === 'object' && a ? a.text || '' : a || ''; },
    check: () => {
      if (!ticks) return { pending: true, ok: false, score: 0 };
      const score = ticks.filter(Boolean).length / task.points.length;
      return { ok: score >= (task.pass || 0.6), score, reason: `${ticks.filter(Boolean).length} von ${task.points.length} Punkten des Erwartungshorizonts genannt.` };
    },
    /** Zeigt den Erwartungshorizont; onDone(result) nach dem Abhaken. */
    selfCheck: (onDone, { label = 'Bewerten' } = {}) => {
      ta.readOnly = true;
      const boxes = task.points.map((pt) => h('input', { type: 'checkbox' }));
      selfBox.replaceChildren(h('div', { class: 'selfcheck' },
        h('p', { class: 'eyebrow accent' }, 'Erwartungshorizont – hake ehrlich ab, was du genannt hast'),
        h('div', { class: 'stack' }, task.points.map((pt, i) => h('label', { class: 'switch' }, boxes[i], h('span', { html: md(pt) })))),
        h('div', { class: 'actions' }, h('button', { class: 'btn primary', type: 'button', onclick: () => {
          ticks = boxes.map((b) => b.checked);
          boxes.forEach((b) => { b.disabled = true; });
          onDone(api.check());
        } }, icon('check'), label))));
      selfBox.querySelector('input')?.focus();
    },
    setTicks: (t) => { ticks = t; },
    getTicks: () => ticks,
    reveal: () => { ta.readOnly = true; },
  };
  return api;
}

// Ergebnistabelle selbst ausfüllen
function gridRenderer(task) {
  const exp = engine.predictActual(task);
  const db = engine.freshDb(task.db);
  const tables = (task.showTables || []).map((t) => ({ t, r: engine.run(db, `SELECT * FROM "${t}"`).last }));
  db.close();
  const inputs = exp.values.map(() => exp.columns.map((c) => h('input', { class: 'input mono', type: 'text', 'aria-label': c, autocomplete: 'off' })));
  const grid = h('table', { class: 'data gridinput' },
    h('thead', null, h('tr', null, exp.columns.map((c) => h('th', null, c)))),
    h('tbody', null, inputs.map((row) => h('tr', null, row.map((inp) => h('td', null, inp))))));
  const rows = () => inputs.map((r) => r.map((i) => i.value)).filter((r) => r.some((v) => v.trim() !== ''));
  let last = null;
  return {
    el: h('div', null,
      tables.map(({ t, r }) => h('details', { class: 'drawer', style: { marginBottom: '8px' } }, h('summary', null, icon('db'), `Tabelle ${t}`), h('div', { class: 'drawer-body flush' }, dataTable(r)))),
      h('div', { class: 'predict-src' }, h('p', { class: 'eyebrow', style: { marginBottom: '6px' } }, 'Abfrage'), h('div', { class: 'runner' }, codeBlock(task.sql))),
      h('p', { class: 'eyebrow', style: { margin: '14px 0 6px' } }, 'Dein Ergebnis'),
      h('div', { class: 'runner', style: { margin: 0 } }, h('div', { class: 'result-scroll' }, grid))),
    answer: () => inputs.map((r) => r.map((i) => i.value)),
    answered: () => rows().length > 0,
    restore: (a) => { (a || []).forEach((r, i) => r.forEach((v, j) => { if (inputs[i] && inputs[i][j]) inputs[i][j].value = v; })); },
    check: () => {
      last = engine.gradeGrid(task, rows());
      return { ok: last.ok, score: last.score, reason: `${last.hits} von ${last.total} Zeilen richtig. Reihenfolge egal, Zahlen ohne Tausenderpunkt.` };
    },
    reveal: () => { inputs.flat().forEach((i) => { i.readOnly = true; }); },
  };
}

export function makeRenderer(task, opts = {}) {
  const seed = opts.seed || [...task.key].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
  switch (task.type) {
    case 'mc': return mcRenderer(task, seed);
    case 'classify': return classifyRenderer(task, seed);
    case 'order': return orderRenderer(task, seed);
    case 'predict': return predictRenderer(task);
    case 'text': return textRenderer(task);
    case 'grid': return gridRenderer(task);
    default: return sqlRenderer(task, opts);
  }
}

// ---------------- Schema-Anzeige ----------------
export function schemaPanel(tables, onPick, dbName) {
  const db = engine.freshDb(dbName);
  const list = tables.map((t) => ({ t, cols: engine.tableInfo(db, t) }));
  db.close();
  return h('div', { class: 'schema' }, list.map(({ t, cols }) => h('div', { class: 'tbl' },
    h('div', { class: 'tname' }, icon('db'), t, onPick ? h('button', { class: 'btn ghost sm', type: 'button', onclick: () => onPick(t, true), title: 'Tabellennamen einfügen' }, '+') : null),
    cols.map((c) => h('div', { class: 'col', role: onPick ? 'button' : null, tabindex: onPick ? '0' : null, onclick: () => onPick && onPick(c.name), onkeydown: (e) => { if (e.key === 'Enter' && onPick) onPick(c.name); } },
      h('span', { class: `k${c.fk && !c.pk ? ' fk' : ''}` }, c.pk ? 'PK' : c.fk ? 'FK' : ''),
      h('span', null, c.name),
      c.fk ? h('span', { class: 'ref' }, `→ ${c.fk}`) : null,
      h('span', { class: 'ty' }, c.type.toLowerCase()))))));
}

// ---------------- Lern-Arbeitsplatz ----------------
/**
 * renderTaskWorkspace(task, { mode: 'learn'|'review', onNext, nav })
 */
export function renderTaskWorkspace(task, { mode = 'learn', onNext, position, onSolved } = {}) {
  const ts = store.taskState(task.key);
  const R = makeRenderer(task, { onRunHook: (k) => k === 'submit' && submit() });
  if (isSqlType(task) && store.state.drafts[task.key]) R.restore(store.state.drafts[task.key]);
  if (isSqlType(task)) R.editor.textarea.addEventListener('input', () => store.setDraft(task.key, R.editor.value));

  const feedback = h('div', { 'aria-live': 'polite' });
  let hintUsed = !!ts?.hint;
  let revealedWrong = false;
  let done = false;

  const btnCheck = h('button', { class: 'btn primary', type: 'button', onclick: () => submit() }, icon('check'), task.type === 'text' ? 'Abgeben & vergleichen' : 'Prüfen');
  const btnRun = isSqlType(task) ? h('button', { class: 'btn', type: 'button', onclick: () => R.runIt() }, icon('play'), 'Ausführen', h('kbd', null, 'Strg ↵')) : null;
  const btnRetry = h('button', { class: 'btn', type: 'button', hidden: true, onclick: () => rerender() }, icon('reset'), 'Nochmal versuchen');
  const btnShow = h('button', { class: 'btn ghost', type: 'button', hidden: !isSqlType(task) && !['predict', 'grid'].includes(task.type), onclick: () => showSolution() }, icon('eye'), 'Lösung zeigen');
  const btnNext = onNext ? h('button', { class: 'btn accent', type: 'button', hidden: true, onclick: onNext }, 'Weiter', icon('chev')) : null;

  const hintBox = h('div');
  const hintDrawer = task.hint ? h('details', { class: 'drawer', ontoggle: (e) => {
    if (e.target.open && !hintUsed && store.taskState(task.key)?.status !== 'solved') { hintUsed = true; toast(h('span', null, 'Hinweis genutzt – diese Aufgabe gibt nur noch ', h('b', null, 'halbe XP'))); }
  } }, h('summary', null, icon('bulb'), 'Hinweis', h('span', { class: 'small muted', style: { marginLeft: '6px', fontWeight: 400 } }, '(halbe XP)')), h('div', { class: 'drawer-body', html: md(task.hint) })) : null;

  function submit() {
    if (done && mode !== 'review') return;
    if (!R.answered()) { feedback.replaceChildren(fb('info', 'Noch keine Antwort', task.type === 'order' ? 'Lege alle Bausteine in eine Reihenfolge.' : task.type === 'classify' ? 'Ordne jeden Befund einer Kategorie zu.' : task.start ? 'Du hast die fehlerhafte Anweisung noch nicht verändert. Finde den Fehler und korrigiere ihn im Editor.' : 'Gib zuerst eine Antwort ein.')); return; }
    if (task.type === 'text') {
      btnCheck.hidden = true;
      feedback.replaceChildren(h('div', { class: 'feedback info' }, h('div', { class: 'fb-title' }, icon('bulb'), 'Musterantwort'), h('div', { class: 'fb-body', html: String(task.model).split('\n').filter(Boolean).map((p) => `<p>${md(p)}</p>`).join('') })));
      R.selfCheck((res) => {
        const r = store.recordAttempt(task, { correct: res.ok, hintUsed });
        done = true;
        feedback.appendChild(fb(res.ok ? 'ok' : 'bad', res.ok ? 'Gut beantwortet' : 'Noch Lücken', `${res.reason}\n\n${task.explain}`, res.ok ? r.xp : 0));
        if (btnNext) { btnNext.hidden = false; }
        btnRetry.hidden = res.ok;
        if (res.ok) { celebrate(r); onSolved && onSolved(); }
      });
      return;
    }
    const res = R.check();
    const autoReveal = ['mc', 'classify', 'order', 'grid'].includes(task.type);
    if (res.ok) {
      const r = store.recordAttempt(task, { correct: true, hintUsed: hintUsed || revealedWrong, fromReview: mode === 'review' });
      done = true;
      R.reveal(res);
      feedback.replaceChildren(fb('ok', 'Richtig', task.explain, r.xp));
      btnCheck.hidden = true; btnShow.hidden = true; btnRetry.hidden = true;
      if (btnNext) { btnNext.hidden = false; btnNext.focus(); }
      celebrate(r);
      onSolved && onSolved();
    } else {
      store.recordAttempt(task, { correct: false });
      if (autoReveal) {
        R.reveal(res); revealedWrong = true;
        feedback.replaceChildren(fb('bad', 'Nicht ganz', `${res.reason || ''}\n\n${task.explain}`));
        btnCheck.hidden = true; btnRetry.hidden = false;
        if (btnNext) btnNext.hidden = false;
      } else {
        feedback.replaceChildren(fb('bad', res.almost ? 'Fast!' : 'Noch nicht richtig', res.reason || ''));
        btnShow.hidden = false;
      }
    }
  }

  function showSolution() {
    if (store.taskState(task.key)?.status !== 'solved') store.markShown(task);
    done = true;
    const sol = task.type === 'predict' ? h('p', null, 'Ergebnis: ', h('code', null, task.answer))
      : task.type === 'grid' ? h('div', { class: 'runner' }, dataTable(engine.predictActual(task)))
      : h('div', { class: 'solution-code' }, codeBlock(task.solution));
    const take = isSqlType(task) ? h('button', { class: 'btn sm', type: 'button', onclick: () => { R.editor.value = task.solution; R.runIt(); } }, 'In den Editor übernehmen') : null;
    feedback.replaceChildren(h('div', { class: 'feedback info' },
      h('div', { class: 'fb-title' }, icon('eye'), 'Musterlösung', h('span', { class: 'small muted', style: { fontWeight: 400, marginLeft: 'auto' } }, 'ohne XP · kommt in die Wiederholung')),
      sol, mdEl('p', task.explain, { class: 'fb-body', style: { marginTop: '10px' } }), take));
    btnCheck.hidden = true; btnShow.hidden = true;
    if (btnNext) btnNext.hidden = false;
    if (isSqlType(task)) {
      // Erneuter Versuch bleibt möglich (ohne XP)
      btnCheck.hidden = false; done = false;
    }
  }

  let root;
  function rerender() { const n = renderTaskWorkspace(task, { mode, onNext, position, onSolved }); root.replaceWith(n); }

  const meta = h('div', { class: 'task-meta' },
    position ? h('span', { class: 'eyebrow' }, position) : null,
    h('span', { class: 'pill' }, TYPE_LABEL[task.type]),
    levelDots(task.level),
    h('span', { class: 'pill' }, `${XP_BY_LEVEL[task.level]} XP`),
    ts?.status === 'solved' ? h('span', { class: 'pill ok' }, icon('check'), 'gelöst') : null,
    mode === 'review' ? h('span', { class: 'pill accent' }, `Wiederholung · Fach ${ts?.box || 1}`) : null,
    task.zusatz ? h('span', { class: 'pill warn', title: 'Geht über die Formelsammlung hinaus – nicht Teil der Probeklausur' }, 'Vertiefung') : null,
    h('span', { class: 'spacer' }),
    isSqlType(task) || ['grid', 'predict'].includes(task.type) ? formelsammlungButton() : null);

  const question = h('div', { class: 'task-q', html: task.q.split('\n\n').map((p) => `<p>${md(p)}</p>`).join('') });
  const actions = h('div', { class: 'actions' }, btnRun, btnCheck, btnRetry, h('span', { class: 'spacer' }), btnShow, btnNext);

  if (isSqlType(task)) {
    const side = h('div', { class: 'task-side' },
      h('details', { class: 'drawer', open: true }, h('summary', null, icon('db'), 'Tabellen'), h('div', { class: 'drawer-body flush' }, schemaPanel(task.tables || [], (name, isTable) => R.editor.insert(name + (isTable ? ' ' : '')), task.db))),
      targetDrawer(task),
      hintDrawer);
    root = h('div', { class: 'task-layout' },
      h('div', { class: 'task-brief' }, meta, question, side),
      h('div', null, R.el, actions, feedback));
  } else {
    root = h('div', { class: 'task-layout single' },
      h('div', null, meta, question, R.el, hintDrawer ? h('div', { style: { marginTop: '14px' } }, hintDrawer) : null, actions, feedback));
  }
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && task.type === 'predict' && e.target === R.input) submit();
  });
  return root;
}

function targetDrawer(task) {
  const body = h('div', { class: 'drawer-body flush' });
  const d = h('details', { class: 'drawer', ontoggle: (e) => {
    if (!e.target.open || body.childElementCount) return;
    const exp = engine.expectedResult(task);
    body.appendChild(h('div', { class: 'result-meta' }, h('span', null, task.type === 'dml' ? `So soll der Bestand danach aussehen` : `${exp.values.length} Zeilen · ${exp.columns.length} Spalten`)));
    body.appendChild(dataTable(exp));
  } }, h('summary', null, icon('grid'), task.type === 'dml' ? 'Ziel-Bestand' : 'Zielergebnis'), body);
  return d;
}

function fb(kind, title, text, xp) {
  return h('div', { class: `feedback ${kind}` },
    h('div', { class: 'fb-title' }, icon(kind === 'ok' ? 'check' : kind === 'bad' ? 'x' : 'bulb'), title, xp ? h('span', { class: 'xp-gain' }, `+${xp} XP`) : null),
    h('div', { class: 'fb-body', html: String(text).split('\n\n').filter(Boolean).map((p) => `<p>${md(p)}</p>`).join('') }));
}

let celebrateHook = null;
export const onCelebrate = (fn) => { celebrateHook = fn; };
function celebrate(r) { celebrateHook && celebrateHook(r); }
