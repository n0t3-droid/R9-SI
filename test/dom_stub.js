// a tiny DOM for node tests (hints.js, ding.js): elements with children, classList, textContent / innerHTML,
// querySelector(All) by class / id / tag with descendant selectors, click(). Installs document, window, navigator (de-DE)
// and a Map-backed localStorage (globalThis.__full = true makes every write throw QuotaExceededError).
const store = new Map();
globalThis.__full = false;
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { if (globalThis.__full) { const e = new Error('The quota has been exceeded.'); e.name = 'QuotaExceededError'; throw e; } store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
  key: (i) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
  clear: () => store.clear(),
};
const mkEl = (tag) => {
  const classes = new Set(), el = { tagName: tag.toUpperCase(), children: [], attrs: {}, listeners: {}, parent: null, _text: '', _html: '' };
  el.classList = { add: (...c) => c.forEach(x => classes.add(x)), remove: (...c) => c.forEach(x => classes.delete(x)), toggle: (c, on) => { if (on === undefined) on = !classes.has(c); if (on) classes.add(c); else classes.delete(c); return on; }, contains: (c) => classes.has(c) };
  Object.defineProperty(el, 'className', { get: () => [...classes].join(' '), set: (v) => { classes.clear(); String(v).split(/\s+/).filter(Boolean).forEach(x => classes.add(x)); } });
  Object.defineProperty(el, 'textContent', { get: () => el._text || el.children.map(c => c.textContent).join(''), set: (v) => { el._text = String(v); el.children.length = 0; } });
  Object.defineProperty(el, 'innerHTML', { get: () => el._html, set: (v) => { el._html = String(v); el.children.length = 0; } });
  el.appendChild = (c) => { c.parent = el; el.children.push(c); return c; };
  el.append = (...cs) => cs.forEach(c => el.appendChild(c));
  el.remove = () => { if (el.parent) el.parent.children = el.parent.children.filter(x => x !== el); el.parent = null; };
  el.setAttribute = (k, v) => { el.attrs[k] = String(v); }; el.getAttribute = (k) => (k in el.attrs ? el.attrs[k] : null);
  el.addEventListener = (t, f) => { (el.listeners[t] || (el.listeners[t] = [])).push(f); };
  el.click = () => { if (el.onclick) el.onclick({ type: 'click', target: el, stopPropagation() {} }); for (const f of el.listeners.click || []) f({ type: 'click', target: el, stopPropagation() {} }); };
  const all = (n, out) => { for (const c of n.children) { out.push(c); all(c, out); } return out; };
  const match = (n, sel) => {
    const am = /^([a-z]*)\[([\w-]+)(?:="([^"]*)")?\]$/i.exec(sel);
    if (am) return (!am[1] || n.tagName === am[1].toUpperCase()) && (am[2] in n.attrs) && (am[3] === undefined || n.attrs[am[2]] === am[3]);
    return sel.startsWith('.') ? n.classList.contains(sel.slice(1)) : sel.startsWith('#') ? n.attrs.id === sel.slice(1) : n.tagName === sel.toUpperCase();
  };
  const up = (n, t) => { let a = n.parent; while (a && a !== el.parent) { if (match(a, t)) return true; a = a.parent; } return false; };
  const find = (sel) => { const toks = sel.trim().split(/\s+/), last = toks.pop(); return all(el, []).filter(n => match(n, last) && toks.every(t => up(n, t))); };
  el.querySelector = (sel) => find(sel)[0] || null;
  el.querySelectorAll = (sel) => find(sel);
  el.getClientRects = () => (classes.has('on') ? [1] : []);
  return el;
};
const body = mkEl('body');
globalThis.document = { body, documentElement: mkEl('html'), createElement: mkEl, getElementById: (id) => { const all = (n, out) => { for (const c of n.children) { out.push(c); all(c, out); } return out; }; return all(body, []).find(n => n.attrs.id === id) || null; }, querySelector: (s) => body.querySelector(s), addEventListener() {} };
Object.defineProperty(globalThis, 'navigator', { value: { language: 'de-DE', languages: ['de-DE'] }, configurable: true });
const winL = {};
globalThis.window = { addEventListener: (t, f) => { (winL[t] || (winL[t] = [])).push(f); }, dispatchEvent: (e) => { for (const f of winL[e.type] || []) f(e); return true; }, parent: null };
globalThis.window.parent = globalThis.window;
module.exports = { store, mkEl, body };
