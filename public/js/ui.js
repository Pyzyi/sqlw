// Kleine DOM-Helfer ohne Framework.

export function h(tag, attrs, ...children) {
  const el = tag === 'frag' ? document.createDocumentFragment() : document.createElement(tag);
  if (attrs && tag !== 'frag') {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Mini-Markdown: **fett**, `code`, *kursiv* – sicher escaped. */
export function md(text) {
  let s = esc(text);
  s = s.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  return s;
}
export const mdEl = (tag, text, attrs = {}) => h(tag, { ...attrs, html: md(text) });

const fmtNum = (v) => (Number.isInteger(v) ? String(v) : (Math.round(v * 100) / 100).toLocaleString('de-DE', { maximumFractionDigits: 2 }));

/** Ergebnis-Tabelle aus {columns, values}. */
export function dataTable(res, { max = 500 } = {}) {
  if (!res || !res.columns) return h('div', { class: 'empty-res' }, 'Keine Ergebnistabelle.');
  const rows = res.values.slice(0, max);
  return h('div', { class: 'result-scroll' },
    h('table', { class: 'data' },
      h('thead', null, h('tr', null, res.columns.map((c) => h('th', { scope: 'col' }, c)))),
      h('tbody', null, rows.length
        ? rows.map((r) => h('tr', null, r.map((v) => v === null
          ? h('td', { class: 'null' }, 'NULL')
          : typeof v === 'number' ? h('td', { class: 'num' }, fmtNum(v)) : h('td', null, String(v)))))
        : h('tr', null, h('td', { colspan: res.columns.length, class: 'null' }, '(0 Zeilen)')))));
}

export function resultPanel(r, translate) {
  if (!r) return h('div');
  if (!r.ok) {
    return h('div', { class: 'result', role: 'status' }, h('div', { class: 'err-box' }, translate(r.error), h('span', { class: 'raw' }, r.error)));
  }
  const last = r.last;
  const meta = last
    ? `${last.values.length} Zeile${last.values.length === 1 ? '' : 'n'} · ${last.columns.length} Spalte${last.columns.length === 1 ? '' : 'n'}`
    : `Ausgeführt · ${r.changes} Zeile${r.changes === 1 ? '' : 'n'} geändert`;
  return h('div', { class: 'result', role: 'status' },
    h('div', { class: 'result-meta' }, h('span', null, meta), r.ms !== undefined ? h('span', null, `${r.ms.toFixed(1)} ms`) : null),
    last ? dataTable(last) : null);
}

let toastWrap;
export function toast(content, ms = 2600) {
  if (!toastWrap) { toastWrap = h('div', { class: 'toast-wrap', 'aria-live': 'polite' }); document.body.appendChild(toastWrap); }
  const t = h('div', { class: 'toast' }, content);
  toastWrap.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

export function modal(build, { onClose, dismissable = true, wide = false } = {}) {
  const prev = document.activeElement;
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey); onClose && onClose(); prev && prev.focus && prev.focus(); };
  const box = h('div', { class: `modal${wide ? ' wide' : ''}`, role: 'dialog', 'aria-modal': 'true' });
  const back = h('div', { class: 'modal-back', onclick: (e) => { if (dismissable && e.target === back) close(); } }, box);
  const onKey = (e) => { if (e.key === 'Escape' && dismissable) close(); };
  document.addEventListener('keydown', onKey);
  box.appendChild(build(close));
  document.body.appendChild(back);
  const f = box.querySelector('input, button, [tabindex]');
  f && f.focus();
  return close;
}

export function confirmDialog(title, text, okLabel = 'OK', danger = false) {
  return new Promise((resolve) => {
    let result = false;
    modal((close) => h('frag', null,
      h('h2', { class: 'h2' }, title),
      h('p', { class: 'muted' }, text),
      h('div', { class: 'actions' },
        h('button', { class: 'btn ghost', onclick: close }, 'Abbrechen'),
        h('button', { class: `btn ${danger ? 'accent' : 'primary'}`, onclick: () => { result = true; close(); } }, okLabel))), { onClose: () => resolve(result) });
  });
}

export function levelDots(n) {
  return h('span', { class: 'lvl', title: ['', 'leicht', 'mittel', 'anspruchsvoll'][n], 'aria-label': `Schwierigkeit ${n} von 3` },
    [1, 2, 3].map((i) => h('i', { class: i <= n ? 'on' : '' })));
}

export function bar(pct, cls = '') {
  const span = h('span');
  span.style.width = `${Math.max(0, Math.min(100, pct))}%`;
  return h('div', { class: `bar ${cls}`, role: 'progressbar', 'aria-valuenow': Math.round(pct), 'aria-valuemin': 0, 'aria-valuemax': 100 }, span);
}

// ---------- Icons (eigene, schlichte Linienicons) ----------
const P = {
  home: 'M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z',
  book: 'M4 4.5A1.5 1.5 0 0 1 5.5 3H20v15H5.5A1.5 1.5 0 0 0 4 19.5zM4 19.5A1.5 1.5 0 0 0 5.5 21H20v-3',
  repeat: 'M4 12a8 8 0 0 1 13.7-5.6L20 8.5M20 4v4.5h-4.5M20 12a8 8 0 0 1-13.7 5.6L4 15.5M4 20v-4.5h4.5',
  exam: 'M9 3h6l1 2h3v16H5V5h3zM9 3v3h6V3M8.5 12l2 2 4-4M8 17h8',
  terminal: 'M3 5h18v14H3zM7 10l3 2-3 2M12 15h5',
  sheet: 'M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7',
  trophy: 'M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M10 14.5V18h4v-3.5M8 21h8',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z',
  flame: 'M12 21c-4 0-7-2.7-7-6.5 0-3.3 2.4-5.4 4-7.5.4 1.6 1.2 2.6 2.3 3.2C11.6 7 13 4.4 15.5 3c-.2 2.6.8 4.3 2 5.9 1.1 1.5 1.5 3.1 1.5 4.6 0 4.5-3 7.5-7 7.5z',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
  play: 'M7 4.5v15l12-7.5z',
  check: 'M4.5 12.5 9.5 17.5 19.5 6.5',
  x: 'M6 6l12 12M18 6 6 18',
  chev: 'M9 5l7 7-7 7',
  chevL: 'M15 5l-7 7 7 7',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  reset: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5',
  db: 'M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  menu: 'M4 7h16M4 12h16M4 17h16',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
};
export function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'ic');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', P[name] || '');
  svg.appendChild(p);
  return svg;
}

export function svgEl(tag, attrs = {}, ...children) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) el.setAttribute(k, v);
  for (const c of children) { if (c == null) continue; el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }
  return el;
}

export function shuffle(arr, seed) {
  const a = arr.slice();
  let s = seed || Math.floor(Math.random() * 1e9);
  const rnd = () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export const todayISO = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 864e5);
