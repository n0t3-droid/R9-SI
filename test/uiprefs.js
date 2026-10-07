// W1 · r9si.ui (VR.UIPrefs, src/shared/uiprefs.js): the Einfach / Profi switch, the language and the text size, one
// record for the game and the Studio. The old 'r9si.studio.pro' is migrated and kept mirrored (the Studio's ⚙ Profi
// reads it); a write the browser refuses still applies for this page and is reported (false); another tab's change
// arrives by the storage event; apply() marks the document (html.pro / html.einfach, --ui-scale).
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
const listeners = {};
globalThis.window = {
  addEventListener: (t, f) => { (listeners[t] || (listeners[t] = [])).push(f); },
  dispatchEvent: (e) => { for (const f of listeners[e.type] || []) f(e); return true; },
};
Object.defineProperty(globalThis, 'navigator', { value: { language: 'de-DE', languages: ['de-DE'] }, configurable: true });   // (node 22 has its own, read-only navigator)
const mkClassList = () => { const s = new Set(); return { add: (...c) => c.forEach(x => s.add(x)), remove: (...c) => c.forEach(x => s.delete(x)), toggle: (c, on) => { if (on === undefined) on = !s.has(c); if (on) s.add(c); else s.delete(c); return on; }, contains: (c) => s.has(c), has: (c) => s.has(c) }; };
globalThis.document = { documentElement: { classList: mkClassList(), dataset: {}, style: { props: {}, setProperty(k, v) { this.props[k] = v; } } } };
globalThis.VR = {};
require('../src/main/i18n.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };

console.log('1 · migration from r9si.studio.pro');
store.set('r9si.studio.pro', '1');
require('../src/shared/uiprefs.js');
const U = VR.UIPrefs;
check(!!U && typeof U.get === 'function' && typeof U.set === 'function' && typeof U.on === 'function' && typeof U.apply === 'function', 'VR.UIPrefs has get / set / on / apply');
if (!U) { console.log('FAILED ' + fails); process.exit(1); }
check(U.KEY === 'r9si.ui', 'the key is r9si.ui');
const p0 = U.get();
check(p0.pro === true && p0.scale === 1.15 && p0.lang === 'de', 'r9si.studio.pro = 1 becomes pro: true; scale 1.15; the language follows I18N (' + JSON.stringify(p0) + ')');
const raw = JSON.parse(store.get('r9si.ui') || 'null');
check(raw && raw.v === 1 && raw.pro === true, 'the migrated record is written at once (' + store.get('r9si.ui') + ')');
check(document.documentElement.classList.contains('pro') && !document.documentElement.classList.contains('einfach') && document.documentElement.dataset.ui === 'pro', 'apply(): html.pro, data-ui="pro"');
check(document.documentElement.style.props['--ui-scale'] === '1.15', 'apply(): --ui-scale 1.15');

console.log('2 · set mirrors the old key and tells the listeners');
let seen = null; const off = U.on((p) => { seen = p.pro; });
check(U.set({ pro: false }) === true, 'set({pro:false}) → true');
check(store.get('r9si.studio.pro') === '0' && JSON.parse(store.get('r9si.ui')).pro === false, 'r9si.studio.pro mirrors it ("0"), r9si.ui says pro: false');
check(seen === false, 'the listener heard pro: false');
check(document.documentElement.classList.contains('einfach') && !document.documentElement.classList.contains('pro') && document.documentElement.dataset.ui === 'einfach', 'apply(): html.einfach');

console.log('3 · a refused write still applies here and is reported');
globalThis.__full = true;
check(U.set({ pro: true }) === false, 'set returns false when the storage throws');
check(U.get().pro === true && seen === true, 'the page still switched (get → pro: true, the listener heard it)');
globalThis.__full = false;
check(U.set({ scale: 1.3 }) === true && U.get().scale === 1.3 && document.documentElement.style.props['--ui-scale'] === '1.3', 'set({scale:1.3}) → --ui-scale 1.3');
check(U.set({ scale: 9 }) === true && U.get().scale === 1.3, 'a scale outside 0.8 … 2 is ignored (kept 1.3)');

console.log('4 · another tab wrote it: the storage event reloads');
store.set('r9si.ui', JSON.stringify({ v: 1, pro: false, lang: 'de', scale: 1.0 }));
window.dispatchEvent({ type: 'storage', key: 'r9si.ui', newValue: store.get('r9si.ui') });
check(U.get().pro === false && U.get().scale === 1 && seen === false, 'the storage event reloads r9si.ui and tells the listeners (' + JSON.stringify(U.get()) + ')');
check(document.documentElement.style.props['--ui-scale'] === '1', 'and applies it');
off();
U.set({ pro: true });
check(seen === false, 'an unsubscribed listener hears nothing more');

console.log('5 · the language is mirrored from I18N');
VR.I18N.set('en');
check(U.get().lang === 'en' && JSON.parse(store.get('r9si.ui')).lang === 'en', 'I18N.set("en") → r9si.ui.lang = "en"');
check(document.documentElement.lang === 'en', 'documentElement.lang follows');

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
