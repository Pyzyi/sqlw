// Lerneinheiten-Bausteine: Text, Tabellen, ausführbarer Code, Kanban-Simulator, ER-Diagramm.
import { h, md, mdEl, icon, resultPanel, svgEl } from './ui.js';
import { createEditor } from './editor.js';
import * as engine from './engine.js';

export function renderBlocks(blocks) {
  return blocks.map((b) => {
    if (b.p) return mdEl('p', b.p);
    if (b.h) return mdEl('h3', b.h);
    if (b.note) return mdEl('div', b.note, { class: 'note' });
    if (b.list) return h('ul', null, b.list.map((li) => mdEl('li', li)));
    if (b.table) return refTable(b.table);
    if (b.code) return runner(b.code, { db: b.db });
    if (b.kanban) return kanbanSim();
    if (b.erd) return erDiagram();
    return null;
  });
}

export function refTable({ head, rows }) {
  return h('div', { class: 'table-scroll' }, h('table', { class: 'ref-table' },
    h('thead', null, h('tr', null, head.map((c) => mdEl('th', c, { scope: 'col' })))),
    h('tbody', null, rows.map((r) => h('tr', null, r.map((c) => h('td', { html: md(c) })))))));
}

/** Ausführbares Beispiel – editierbar, läuft auf einer frischen Kopie. */
export function runner(code, { minLines, db: dbName } = {}) {
  const out = h('div');
  const ed = createEditor({ value: code, minLines: minLines || Math.min(code.split('\n').length, 4), onRun: () => exec(), hint: false });
  const exec = () => {
    const db = engine.freshDb(dbName);
    const r = engine.run(db, ed.value);
    db.close();
    out.replaceChildren(resultPanel(r, engine.translateError));
  };
  return h('div', { class: 'runner' },
    ed.el,
    h('div', { class: 'runner-bar' },
      h('span', { class: 'eyebrow' }, 'Beispiel · editierbar'),
      h('button', { class: 'btn ghost sm', type: 'button', onclick: () => { ed.value = code; out.replaceChildren(); } }, icon('reset'), 'Zurücksetzen'),
      h('button', { class: 'btn primary sm', type: 'button', onclick: exec }, icon('play'), 'Ausführen')),
    out);
}

// ---------- Kanban-Simulator ----------
export function kanbanSim() {
  const COLS = [
    { id: 'todo', t: 'To Do', wip: null },
    { id: 'doing', t: 'In Arbeit', wip: 2 },
    { id: 'review', t: 'Review', wip: 1 },
    { id: 'done', t: 'Erledigt', wip: null },
  ];
  const START = [['PLZ prüfen', 'todo'], ['E-Mails validieren', 'todo'], ['Dubletten suchen', 'todo'], ['Datumsformat', 'todo'], ['Kundentyp vereinheitlichen', 'doing']];
  let cards, moves;
  const msg = h('p', { class: 'kb-msg', 'aria-live': 'polite' });
  const board = h('div', { class: 'kanban' });
  const reset = () => { cards = START.map(([t, c], i) => ({ id: i, t, c })); moves = 0; msg.className = 'kb-msg'; msg.textContent = 'Ziehe Karten nach rechts – so wie im Pull-Prinzip: Nur, wenn in der Zielspalte Platz ist.'; draw(); };
  const draw = (blocked) => {
    board.replaceChildren(...COLS.map((col, ci) => {
      const inCol = cards.filter((c) => c.c === col.id);
      const full = col.wip && inCol.length >= col.wip;
      const el = h('div', { class: `kb-col${full ? ' full' : ''}${blocked === col.id ? ' blocked' : ''}` },
        h('h5', null, h('span', null, col.t), h('span', null, col.wip ? `${inCol.length}/${col.wip}` : String(inCol.length))),
        inCol.map((c) => h('button', { class: 'kb-card', type: 'button', disabled: ci === COLS.length - 1, onclick: () => move(c, ci) }, c.t)));
      return el;
    }));
  };
  const move = (card, ci) => {
    const target = COLS[ci + 1];
    const count = cards.filter((c) => c.c === target.id).length;
    if (target.wip && count >= target.wip) {
      msg.className = 'kb-msg bad';
      msg.textContent = `WIP-Limit von „${target.t}“ erreicht (${target.wip}). Erst dort eine Karte fertigstellen – „Stop starting, start finishing“.`;
      draw(target.id);
      return;
    }
    card.c = target.id; moves++;
    const done = cards.filter((c) => c.c === 'done').length;
    msg.className = done === cards.length ? 'kb-msg ok' : 'kb-msg';
    msg.textContent = done === cards.length
      ? `Alles erledigt in ${moves} Zügen. Beachte: Das Review-Limit 1 war der Engpass – dort staut sich Arbeit.`
      : `„${card.t}“ → ${target.t}. ${target.id === 'doing' ? 'Gezogen, weil Kapazität frei war.' : ''}`;
    draw();
  };
  reset();
  return h('div', { class: 'card flat', style: { margin: '16px 0' } },
    h('div', { class: 'row' }, h('span', { class: 'eyebrow accent' }, 'Simulator'), h('span', { class: 'spacer' }), h('button', { class: 'btn ghost sm', type: 'button', onclick: reset }, icon('reset'), 'Neu')),
    board, msg);
}

// ---------- ER-Diagramm ----------
const ERD = {
  filiale: [20, 20], mitarbeiter: [20, 150], buchung: [20, 360],
  kunde: [270, 20], bestellung: [270, 250],
  bestellposition: [520, 250], artikel: [770, 150], kategorie: [770, 20],
};
const W = 200, HEAD = 26, ROW = 18;
export function erDiagram() {
  const db = engine.freshDb();
  const info = Object.fromEntries(Object.keys(ERD).map((t) => [t, engine.tableInfo(db, t)]));
  db.close();
  const svg = svgEl('svg', { class: 'erd', viewBox: '0 0 990 560', role: 'img', 'aria-label': 'ER-Diagramm der Lerndatenbank' });
  const rowY = (t, col) => ERD[t][1] + HEAD + info[t].findIndex((c) => c.name === col) * ROW + ROW / 2 + 4;
  const rels = svgEl('g');
  svg.appendChild(rels);
  for (const [t, [x, y]] of Object.entries(ERD)) {
    const cols = info[t];
    const g = svgEl('g');
    g.appendChild(svgEl('rect', { class: 'box', x, y, width: W, height: HEAD + cols.length * ROW + 8, rx: 5 }));
    g.appendChild(svgEl('path', { class: 'head', d: `M${x} ${y + 5}a5 5 0 0 1 5 -5h${W - 10}a5 5 0 0 1 5 5v${HEAD - 5}h${-W}z` }));
    g.appendChild(svgEl('text', { class: 'head-t', x: x + 10, y: y + 17 }, t));
    cols.forEach((c, i) => {
      const cy = y + HEAD + i * ROW + 14;
      if (c.pk) g.appendChild(svgEl('text', { class: 'pk-t', x: x + 8, y: cy }, 'PK'));
      else if (c.fk) g.appendChild(svgEl('text', { class: 'fk-t', x: x + 8, y: cy }, 'FK'));
      if (c.pk && c.fk) g.appendChild(svgEl('text', { class: 'fk-t', x: x + 8, y: cy + 8 }, 'FK'));
      g.appendChild(svgEl('text', { class: 'col-t', x: x + 30, y: cy }, c.name));
    });
    svg.appendChild(g);
    // Beziehungen (FK → PK)
    for (const c of cols.filter((c) => c.fk)) {
      const [rt, rc] = c.fk.split('.');
      if (!ERD[rt]) continue;
      const y1 = rowY(t, c.name), y2 = rowY(rt, rc);
      const fromRight = ERD[rt][0] > x;
      const x1 = fromRight ? x + W : x;
      const x2 = ERD[rt][0] === x ? x : (fromRight ? ERD[rt][0] : ERD[rt][0] + W);
      let d;
      if (ERD[rt][0] === x) { const ox = x - 14; d = `M${x1} ${y1} H${ox} V${y2} H${x2}`; }
      else { const mx = (x1 + x2) / 2; d = `M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`; }
      rels.appendChild(svgEl('path', { class: 'rel', d }));
      rels.appendChild(svgEl('text', { class: 'card-t', x: x1 + (fromRight ? 5 : -12), y: y1 - 4 }, 'n'));
      rels.appendChild(svgEl('text', { class: 'card-t', x: x2 + (ERD[rt][0] === x ? -12 : fromRight ? -12 : 5), y: y2 - 4 }, '1'));
    }
  }
  return h('div', { class: 'erd-wrap' }, svg);
}
