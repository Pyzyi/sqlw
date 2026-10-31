// Leichter SQL-Editor: Textarea über einem hervorgehobenen <pre>.
import { h, esc } from './ui.js';

const KW = new Set(('select from where and or not in is null like between group by having order asc desc limit offset as on join inner left right full outer cross ' +
  'insert into values update set delete distinct union all case when then else end exists create table drop alter primary key foreign references default check unique ' +
  'with top fetch first rows only true false').split(' '));
const FN = new Set('count sum avg min max round trim upper lower replace length substr substring coalesce ifnull strftime date abs cast concat nullif'.split(' '));

export function highlight(src) {
  const re = /(--[^\n]*)|('(?:[^']|'')*'?)|("(?:[^"])*"?)|(\b\d+(?:\.\d+)?\b)|([A-Za-zÄÖÜäöüß_][\wÄÖÜäöüß]*)|([\s\S])/g;
  let out = '';
  let m;
  while ((m = re.exec(src))) {
    if (m[1]) out += `<span class="tok-com">${esc(m[1])}</span>`;
    else if (m[2]) out += `<span class="tok-str">${esc(m[2])}</span>`;
    else if (m[3]) out += esc(m[3]);
    else if (m[4]) out += `<span class="tok-num">${m[4]}</span>`;
    else if (m[5]) {
      const w = m[5].toLowerCase();
      if (KW.has(w)) out += `<span class="tok-kw">${esc(m[5])}</span>`;
      else if (FN.has(w) && src[re.lastIndex] === '(') out += `<span class="tok-fn">${esc(m[5])}</span>`;
      else out += esc(m[5]);
    } else out += esc(m[6]);
  }
  return out + '\n';
}

const CHIPS = ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'GROUP BY', 'HAVING', 'ORDER BY', 'DESC', 'LIMIT', 'JOIN', 'ON', 'AS', 'COUNT(', 'SUM(', 'AVG(', 'IS NULL', "''", '*', ',', ';'];

/**
 * createEditor({ value, onChange, onRun, onSubmit, placeholder, minLines, chips, label })
 */
export function createEditor(opts = {}) {
  const pre = h('pre', { 'aria-hidden': 'true' });
  const ta = h('textarea', {
    spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', autocorrect: 'off',
    placeholder: opts.placeholder || 'SELECT …', 'aria-label': opts.label || 'SQL-Eingabe',
  });
  const wrap = h('div', { class: 'editor' }, pre, ta);
  if (opts.hint) wrap.appendChild(h('span', { class: 'gutter-hint' }, 'Strg + Enter'));
  const minLines = opts.minLines || 5;

  const sync = () => {
    const lines = Math.max(minLines, ta.value.split('\n').length);
    pre.innerHTML = highlight(ta.value || '');
    pre.style.minHeight = `calc(${lines} * 1.6em + 28px)`;
  };
  ta.value = opts.value || '';
  sync();

  ta.addEventListener('input', () => { sync(); opts.onChange && opts.onChange(ta.value); });
  ta.addEventListener('focus', () => wrap.classList.add('focus'));
  ta.addEventListener('blur', () => wrap.classList.remove('focus'));
  ta.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey && opts.onSubmit) opts.onSubmit(ta.value); else opts.onRun && opts.onRun(ta.value);
      return;
    }
    if (e.key === 'Tab' && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      insert('  ');
    }
    if (e.key === 'Escape') ta.blur();
  });

  function insert(text) {
    const s = ta.selectionStart, en = ta.selectionEnd;
    ta.setRangeText(text, s, en, 'end');
    if (text === "''" || text.endsWith('(')) {
      const pos = text === "''" ? s + 1 : s + text.length;
      ta.setSelectionRange(pos, pos);
    }
    sync();
    opts.onChange && opts.onChange(ta.value);
    ta.focus();
  }

  const root = h('div', null, wrap);
  if (opts.chips) {
    root.appendChild(h('div', { class: 'chips', 'aria-label': 'Schnelleingabe' },
      CHIPS.map((c) => h('button', { type: 'button', tabindex: '-1', onmousedown: (e) => e.preventDefault(), onclick: () => {
        const before = ta.value.slice(0, ta.selectionStart);
        const needsSpace = before && !/[\s(]$/.test(before) && !/^[,;)]/.test(c);
        insert((needsSpace ? ' ' : '') + c + (/[(']$/.test(c) || c === "''" ? '' : ' '));
      } }, c))));
  }
  return {
    el: root,
    get value() { return ta.value; },
    set value(v) { ta.value = v; sync(); },
    insert,
    focus: () => ta.focus(),
    textarea: ta,
  };
}

/** Nur-Lese-Codeblock mit Highlighting. */
export function codeBlock(src) {
  const pre = h('pre', { class: 'mono' });
  pre.innerHTML = highlight(src).trimEnd();
  return h('div', { class: 'editor' }, pre);
}
