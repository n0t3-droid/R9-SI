// ============================================================================
// ★ Favoriten (v0.37): the blocks and pieces you like best, kept in this browser
// and the same everywhere — the Studio's catalogues (🧱 Teile, Möbel, Fassade),
// the 🎯 picker, the Crafter's palette, the Werkbank, the world's furniture and
// the game's creative inventory (★ tab, F on a slot).
// VR.Favs.list() → [id, …] (newest first) · has(id) · toggle(id) → true when added
// · on(fn) → unsubscribe. An id is a block or item name (VM furniture included,
// a whole catalogue house as its blueprint item: blueprint_<i>).
// Another page of the game (the Studio in its overlay, another tab) changing them
// is seen at once (storage event) and, as a fallback, within a second.
// VR.Favs.ok: did the last change reach the browser's storage? (false: full — the
// change holds for this page only; a 'r9-storage-full' event tells the page)
// ============================================================================
(function () {
  'use strict';
  const KEY = 'r9si.favs', MAX = 300;
  const F = VR.Favs = { ok: true };
  let cache = null, raw = null;
  const subs = new Set();
  const read = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  const parse = (r) => { try { const o = JSON.parse(r || 'null'); return o && Array.isArray(o.items) ? o.items.filter(x => typeof x === 'string' && x).slice(0, MAX) : []; } catch (e) { return []; } };
  const load = () => { if (!cache) { raw = read(); cache = parse(raw); } return cache; };
  const tell = () => { for (const f of subs) { try { f(cache.slice()); } catch (e) { /* a listener's own problem */ } } };
  const full = () => { try { window.dispatchEvent(new CustomEvent('r9-storage-full', { detail: { what: 'favs' } })); } catch (e) { /* no page here */ } };
  // storage full: kept for this session, and said so (F.ok, the event)
  const save = () => { const r = JSON.stringify({ v: 1, items: cache }); let ok = true; try { localStorage.setItem(KEY, r); raw = r; } catch (e) { ok = false; } F.ok = ok; if (!ok) full(); tell(); return ok; };
  // what another page wrote: take it over and tell the listeners (only when it really changed)
  const sync = () => { const r = read(); if (r === raw) return false; raw = r; cache = parse(r); tell(); return true; };
  F.list = () => { if (cache) sync(); return load().slice(); };   // (a list is read when something is drawn: take what another page wrote)
  F.has = (id) => load().includes(id);
  F.add = (id) => { if (!id) return false; sync(); if (F.has(id)) return false; cache.unshift(id); if (cache.length > MAX) cache.length = MAX; save(); return true; };
  F.remove = (id) => { sync(); const i = load().indexOf(id); if (i < 0) return false; cache.splice(i, 1); save(); return true; };
  F.toggle = (id) => { sync(); return F.has(id) ? (F.remove(id), false) : F.add(id); };
  F.on = (fn) => { subs.add(fn); return () => subs.delete(fn); };
  F.sync = sync;
  try {
    window.addEventListener('storage', (e) => { if (e.key === KEY || e.key === null) sync(); });
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });   // back to this tab
    // a fallback for pages that miss the storage event: one cheap look a second while someone listens
    setInterval(() => { if (subs.size) sync(); }, 1000);
  } catch (e) { /* no window here */ }
})();
