// ============================================================================
// 📦 r9-paket (v0.39): what you made in one R9 Studio, for another place — the
// standalone Studio (published on its own: its own browser storage, it can never
// reach the game's) → the Studio in the game, or the game's title screen. One file:
//   { r9pack: 1, at, from: 'standalone' | 'game', favs: [id, …],
//     studio: { v, houses, models }   (the designs, as in 'r9si.studio'),
//     lib: [Bauteil, …] }              (the Werkbank's pieces, 'r9si.library')
// VR.Pack.make(from) · fileName(date) · read(text | object) → pack | null (the older
// text export {houses, models, favs} too; anything broken is left out) ·
// summary(pack) → {favs, houses, models, lib, text} · merge(pack) → what changed:
//   ★ union (the new ones first, in the file's order) · designs: the newer `t` wins
//   (counted as replaced) · Bauteile appended unless an identical one is there.
// A write that fails (full storage) makes ok false — nothing claims what did not
// happen. Shared by the game (title screen) and the Studio (📦 / 📥).
// ============================================================================
(function () {
  'use strict';
  const P = VR.Pack = {};
  const LIB = 'r9si.library';
  const lsGet = (k) => { try { const t = localStorage.getItem(k); return t ? JSON.parse(t) : null; } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const obj = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? o : null);
  const copy = (o) => JSON.parse(JSON.stringify(o));
  P.LIB = LIB;
  const two = (n) => String(n).padStart(2, '0');
  P.fileName = (d) => { d = d || new Date(); return `r9-paket-${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}.json`; };
  P.libLoad = () => { const d = lsGet(LIB); return d && Array.isArray(d.items) ? d.items : []; };

  // ---------------------------------------------------------------- what may come in
  // a favourite: a block of this game (furniture included), an item, or a whole catalogue house (blueprint_<i>)
  P.idOK = (id) => {
    if (typeof id !== 'string' || !id || id.length > 80 || !/^[a-z0-9_:.-]+$/i.test(id) || id === 'air') return false;
    if (VR.R && VR.R.byName[id]) return true;
    if (VR.ITEMS && VR.ITEMS[id]) return true;
    return /^blueprint_\d{1,2}$/.test(id);
  };
  // a house design: a template (v2), the changed cells (v1) or only a facade / mirror choice
  const b64OK = (s) => { if (typeof s !== 'string' || s.length > 4e6) return false; try { return !!(VR.Custom && VR.Custom.unb64 ? VR.Custom.unb64(s) : atob(s)); } catch (e) { return false; } };
  const tplOK = (t) => obj(t) && Array.isArray(t.pal) && Array.isArray(t.box) && t.box.length >= 4 && t.box.every(Number.isFinite) && b64OK(t.rle);
  const houseOK = (h) => !!obj(h) && (tplOK(h.tpl) || (Array.isArray(h.cells) && Array.isArray(h.pal)) || typeof h.skin === 'string' || h.mirror === true);
  const modelOK = (m) => !!obj(m) && b64OK(m.rle) && Array.isArray(m.pal) && [m.W, m.H, m.D, m.res].every(Number.isFinite);
  const libOK = (it) => !!obj(it) && [it.sx, it.sy, it.sz].every(v => Number.isInteger(v) && v > 0 && v <= 1024) && it.sx * it.sy * it.sz <= (1 << 22) && Array.isArray(it.pal) && b64OK(it.rle);

  // ---------------------------------------------------------------- out
  P.make = function (from) {
    const st = (VR.Custom && VR.Custom.load()) || {};
    return { r9pack: 1, at: Date.now(), from: from === 'standalone' ? 'standalone' : 'game', favs: VR.Favs ? VR.Favs.list() : [], studio: { v: 1, houses: obj(st.houses) || {}, models: obj(st.models) || {} }, lib: P.libLoad() };
  };

  // ---------------------------------------------------------------- in
  P.read = function (src) {
    let d = src;
    if (typeof src === 'string') { try { d = JSON.parse(src); } catch (e) { return null; } }
    if (!obj(d)) return null;
    let favs, houses, models, lib;
    if (d.r9pack) { const s = obj(d.studio) || {}; favs = d.favs; houses = s.houses; models = s.models; lib = d.lib; }
    else if (obj(d.houses) || obj(d.models) || Array.isArray(d.favs)) { favs = d.favs; houses = d.houses; models = d.models; lib = null; }   // the older text export
    else return null;
    const out = { r9pack: 1, at: +d.at || 0, from: d.from === 'standalone' ? 'standalone' : d.from === 'game' ? 'game' : '', favs: [], studio: { v: 1, houses: {}, models: {} }, lib: [] };
    const seen = new Set();
    for (const id of Array.isArray(favs) ? favs.slice(0, 300) : []) if (P.idOK(id) && !seen.has(id)) { seen.add(id); out.favs.push(id); }
    for (const [k, h] of Object.entries(obj(houses) || {})) if (/^\d{1,2}$/.test(k) && houseOK(h)) out.studio.houses[String(+k)] = Object.assign(copy(h), { name: String(h.name || '').slice(0, 60) });
    for (const [k, m] of Object.entries(obj(models) || {})) if (/^[a-z0-9_]{1,80}$/.test(k) && VR.VM && Object.prototype.hasOwnProperty.call(VR.VM.MODELS, k) && modelOK(m)) out.studio.models[k] = copy(m);
    for (const it of Array.isArray(lib) ? lib.slice(0, 500) : []) if (libOK(it)) out.lib.push(Object.assign(copy(it), { name: String(it.name || 'Bauteil').slice(0, 60) }));
    return out;
  };

  // ---------------------------------------------------------------- what is in it (one line)
  const n = (k, one, many) => k + ' ' + (k === 1 ? one : many);
  P.summary = function (pk) {
    const s = { favs: (pk.favs || []).length, houses: Object.keys((pk.studio && pk.studio.houses) || {}).length, models: Object.keys((pk.studio && pk.studio.models) || {}).length, lib: (pk.lib || []).length };
    const parts = [];
    if (s.favs) parts.push(n(s.favs, 'Favorit', 'Favoriten'));
    if (s.houses) parts.push(n(s.houses, 'Haus', 'Häuser'));
    if (s.models) parts.push(n(s.models, 'Möbel', 'Möbel'));
    if (s.lib) parts.push(n(s.lib, 'Bauteil', 'Bauteile'));
    s.text = parts.length ? parts.join(' · ') : 'leer';
    return s;
  };

  // ---------------------------------------------------------------- take it over
  P.merge = function (pk) {
    const out = { ok: true, favs: 0, houses: { added: 0, replaced: 0, kept: 0 }, models: { added: 0, replaced: 0, kept: 0 }, lib: { added: 0, same: 0 }, houseIdx: [], modelNames: [] };
    // ★ union: the ones not here yet go first, in the file's order
    const F = VR.Favs;
    if (F && pk.favs && pk.favs.length) {
      if (F.addMany) { out.favs = F.addMany(pk.favs); if (out.favs && F.ok === false) out.ok = false; }
      else { const add = pk.favs.filter(id => !F.has(id)); for (let i = add.length - 1; i >= 0; i--) if (F.add(add[i])) { out.favs++; if (F.ok === false) out.ok = false; } }
    }
    // designs: the newer one wins
    const CU = VR.Custom, inH = (pk.studio && pk.studio.houses) || {}, inM = (pk.studio && pk.studio.models) || {};
    if (CU && (Object.keys(inH).length || Object.keys(inM).length)) {
      const cur = obj(CU.load()) || { v: 1 }; cur.houses = obj(cur.houses) || {}; cur.models = obj(cur.models) || {};
      let changed = false;
      const take = (here, from, res, list, key) => {
        for (const [k, d] of Object.entries(from)) {
          const c = here[k];
          if (!c) { here[k] = d; res.added++; list.push(key(k)); changed = true; }
          else if ((+d.t || 0) > (+c.t || 0)) { here[k] = d; res.replaced++; list.push(key(k)); changed = true; }
          else res.kept++;
        }
      };
      take(cur.houses, inH, out.houses, out.houseIdx, (k) => +k);
      take(cur.models, inM, out.models, out.modelNames, (k) => k);
      if (changed && !CU.save(cur)) { out.ok = false; out.houses.added = out.houses.replaced = out.models.added = out.models.replaced = 0; out.houseIdx = []; out.modelNames = []; }
    }
    // Bauteile: appended, unless the same piece is there already
    if (pk.lib && pk.lib.length) {
      const items = P.libLoad().slice(), sig = (it) => [it.sx, it.sy, it.sz, it.dy || 0, JSON.stringify(it.pal), it.rle].join('|');
      const have = new Set(items.map(sig)), ids = new Set(items.map(it => it.id));
      let add = 0;
      for (const it of pk.lib) {
        const s = sig(it); if (have.has(s)) { out.lib.same++; continue; }
        const c = copy(it); if (!c.id || ids.has(c.id)) c.id = 'b' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36) + add;
        ids.add(c.id); have.add(s); items.push(c); add++;
      }
      if (add) { if (lsSet(LIB, { v: 1, items, t: Date.now() })) out.lib.added = add; else out.ok = false; }
    }
    out.text = P.report(out);
    return out;
  };
  // what a merge did, in one line ("2 Favoriten · 2 Häuser (1 ersetzt) · 1 Bauteil")
  P.report = function (r) {
    const parts = [];
    if (r.favs) parts.push(n(r.favs, 'Favorit', 'Favoriten'));
    const h = r.houses.added + r.houses.replaced, m = r.models.added + r.models.replaced;
    if (h) parts.push(n(h, 'Haus', 'Häuser') + (r.houses.replaced ? ' (' + r.houses.replaced + ' ersetzt)' : ''));
    if (m) parts.push(n(m, 'Möbel', 'Möbel') + (r.models.replaced ? ' (' + r.models.replaced + ' ersetzt)' : ''));
    if (r.lib.added) parts.push(n(r.lib.added, 'Bauteil', 'Bauteile'));
    const kept = r.houses.kept + r.models.kept;
    let t = parts.length ? parts.join(' · ') : 'nichts Neues';
    if (kept) t += ' · ' + kept + ' hier neuer, behalten';
    return t;
  };
})();
