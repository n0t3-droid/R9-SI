// ============================================================================
// r9si.ui (W1): what the player chose for the whole game and the R9 Studio —
// Einfach or Profi, the language, the text size. One record in the browser's
// storage, read by both pages, shared the moment it changes (storage event):
//   'r9si.ui' = { v: 1, pro: false, lang: 'de', scale: 1.15 }
// The older 'r9si.studio.pro' (the Studio's ⚙ Profi) is migrated on the first
// read and kept mirrored. apply() marks the document: html.pro / html.einfach,
// data-ui, and --ui-scale for the big text of the Einfach screens.
// VR.UIPrefs.get() · set(patch) → false when the storage refused it (the page
// still switches) · on(fn) → unsubscribe · apply()
// ============================================================================
(function (VR) {
  'use strict';
  const KEY = 'r9si.ui', OLD = 'r9si.studio.pro';
  const U = VR.UIPrefs = { KEY };
  const subs = new Set();
  let cur = null, raw = null;
  const lang = () => (VR.I18N && VR.I18N.lang) || 'en';
  const scaleOK = (s) => Number.isFinite(s) && s >= 0.8 && s <= 2;
  const read = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  const parse = (r) => {
    let o = null; try { o = JSON.parse(r || 'null'); } catch (e) { o = null; }
    if (!o || typeof o !== 'object') return null;
    return { pro: !!o.pro, lang: typeof o.lang === 'string' ? o.lang : lang(), scale: scaleOK(+o.scale) ? +o.scale : 1.15 };
  };
  const write = (p) => {
    raw = JSON.stringify({ v: 1, pro: p.pro, lang: p.lang, scale: p.scale });
    let ok = true;
    try { localStorage.setItem(KEY, raw); } catch (e) { ok = false; }
    try { localStorage.setItem(OLD, p.pro ? '1' : '0'); } catch (e) { /* the mirror is a courtesy */ }
    return ok;
  };
  function load() {
    if (cur) return cur;
    raw = read();
    cur = parse(raw);
    if (!cur) {
      // the first read: the Studio's old ⚙ Profi choice carries over
      let old = null; try { old = localStorage.getItem(OLD); } catch (e) { old = null; }
      cur = { pro: old === '1', lang: lang(), scale: 1.15 };
      write(cur);
    }
    return cur;
  }
  const tell = () => { const p = U.get(); for (const f of subs) { try { f(p); } catch (e) { console.warn('ui prefs listener', e); } } };
  U.get = () => Object.assign({}, load());
  U.set = function (patch) {
    const p = load(), next = Object.assign({}, p);
    if (patch && typeof patch === 'object') {
      if (patch.pro !== undefined) next.pro = !!patch.pro;
      if (typeof patch.lang === 'string') next.lang = patch.lang;
      if (patch.scale !== undefined && scaleOK(+patch.scale)) next.scale = +patch.scale;
    }
    cur = next;
    const ok = write(next);
    U.apply(); tell();
    return ok;
  };
  U.on = (fn) => { subs.add(fn); return () => subs.delete(fn); };
  U.apply = function () {
    if (typeof document === 'undefined' || !document.documentElement) return;
    const p = load(), de = document.documentElement;
    de.classList.toggle('pro', p.pro); de.classList.toggle('einfach', !p.pro);
    if (de.dataset) de.dataset.ui = p.pro ? 'pro' : 'einfach';
    if (de.style && de.style.setProperty) de.style.setProperty('--ui-scale', String(p.scale));
  };
  // what another page wrote (the Studio next to the game, another tab)
  const sync = () => { const r = read(); if (r === raw) return false; raw = r; const p = parse(r); if (!p) return false; cur = p; U.apply(); tell(); return true; };
  U.sync = sync;
  if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('storage', (e) => { if (e.key === KEY || e.key === null) sync(); });
  // the language lives with I18N ('r9si.lang'); the record mirrors it
  if (VR.I18N && VR.I18N.on) VR.I18N.on((code) => { if (load().lang !== code) U.set({ lang: code }); });
  U.apply();
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
