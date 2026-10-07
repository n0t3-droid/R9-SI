// W1 · 🧭 Hints (VR.Hints, src/shared/hints.js): one line at a time, never on a timer. A hint leaves when its action
// was done (done) or ✕ was pressed (dismiss); an undone one may return next session, at most three times in all.
// 'r9si.hints' = { v:1, seen:{id:t}, done:{id:t}, n:{id:count} }
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
  key: (i) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
  clear: () => store.clear(),
};
// a tiny DOM: elements with children, classList, textContent, querySelector by class / tag
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
  const match = (n, sel) => sel.startsWith('.') ? n.classList.contains(sel.slice(1)) : sel.startsWith('#') ? n.attrs.id === sel.slice(1) : n.tagName === sel.toUpperCase();
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
globalThis.window = { addEventListener() {}, dispatchEvent() { return true; } };
globalThis.VR = {};
require('../src/main/i18n.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };

require('../src/shared/hints.js');
const H = VR.Hints;
console.log('1 · one hint at a time');
check(!!H && ['want', 'show', 'done', 'dismiss', 'current', 'read', 'reset'].every(k => typeof H[k] === 'function') && H.KEY === 'r9si.hints', 'VR.Hints: want / show / done / dismiss / current / read / reset, key r9si.hints');
if (!H) { console.log('FAILED ' + fails); process.exit(1); }
check(H.want('move') === true && H.current() === null, 'a fresh store wants "move"; nothing is showing');
check(H.show('move', { text: '🖱 bewegen = umschauen · W A S D = gehen', picto: ['W', 'A', 'S', 'D', 'mouse'] }) === true, 'show("move") → true');
const box = document.getElementById('hints');
check(!!box && box.classList.contains('on') && box.textContent.includes('W A S D'), '#hints is on and carries the text');
check(box.querySelectorAll('.hint').length === 1 && box.querySelectorAll('kbd').length === 4 && box.querySelectorAll('.mouse').length === 1, 'one .hint with the pictograms: four key caps and a mouse');
check(H.show('fly', { text: 'Leertaste 2× = fliegen' }) === false && H.current() === 'move', 'a second hint while one shows is refused (never two at once)');
const st1 = H.read();
check(st1.seen.move > 0 && st1.n.move === 1 && !st1.done.move && !st1.seen.fly, 'seen.move and n.move = 1 are stored; fly was never shown');
check(JSON.parse(store.get('r9si.hints')).v === 1, 'the record is r9si.hints v1');

console.log('2 · done hides it; dismiss (✕) only hides');
H.done('move');
check(H.current() === null && !box.classList.contains('on') && H.read().done.move > 0, 'done("move") hides the hint and stores done.move');
check(H.want('move') === false, 'a done hint is never wanted again');
check(H.show('fly', { text: 'Leertaste 2× = fliegen', picto: ['Space', 'Space'] }) === true && H.current() === 'fly', 'the next hint can show now');
const x = box.querySelector('.x');
check(!!x, 'the hint has a ✕');
x.click();
check(H.current() === null && !box.classList.contains('on') && !H.read().done.fly && H.read().n.fly === 1, '✕ hides it, fly is not done');
check(H.want('fly') === false, 'but not again in this session');
H.done('fly');
check(H.read().done.fly > 0, 'done after a dismiss still counts');

console.log('3 · at most three times across sessions');
H.reset();
check(H.read().n.fly === undefined && H.want('fly') === true, 'reset() clears the record');
for (let s = 0; s < 3; s++) { H._newSession(); check(H.want('fly') === true && H.show('fly', { text: 'x' }) === true, 'session ' + (s + 1) + ': shown'); H.dismiss(); }
H._newSession();
check(H.read().n.fly === 3 && H.want('fly') === false, 'after three dismissals it stays away (n.fly = 3)');
check(H.show('fly', { text: 'x' }) === false, 'show() refuses it too');

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
