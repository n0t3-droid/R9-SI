// ============================================================================
// Edits from the R9 Studio's Werkbank (v0.35): block changes made in the Studio's view of a world travel to the game
// as batches in the browser's storage. A batch is a list of boxes, one per 16×16 column it touches; each box holds a
// palette (0 keep · 1 air · then portable block states) and its cells run-length coded — a filled room is a few bytes.
// The Studio owns the list of batches ('r9si.edits.<world>'), the game owns the list of those it has built
// ('r9si.edits.done.<world>'), so the two never write the same key; the game builds a batch as soon as its columns
// are loaded (at once when the world is open), with its own undo, and the Studio then drops it.
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R;
  const E = VR.Edits = {};
  E.listKey = (w) => 'r9si.edits.' + w;
  E.doneKey = (w) => 'r9si.edits.done.' + w;
  E.batchKey = (w, id) => 'r9si.edit.' + w + '.' + id;
  E.newId = () => 'e' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  const ls = {
    get(k) { try { const t = localStorage.getItem(k); return t ? JSON.parse(t) : null; } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* */ } },
  };
  E.ls = ls;

  // changes [[x, y, z, state], …] (the last one for a cell wins) → { id, t, n, boxes }
  E.pack = function (changes, id) {
    const C = VR.Custom, cols = new Map();
    for (const c of changes) {
      const k = (c[0] >> 4) + ',' + (c[2] >> 4); let g = cols.get(k);
      if (!g) { g = { cx: c[0] >> 4, cz: c[2] >> 4, y0: c[1], y1: c[1], list: [] }; cols.set(k, g); }
      if (c[1] < g.y0) g.y0 = c[1]; if (c[1] > g.y1) g.y1 = c[1];
      g.list.push(c);
    }
    const boxes = [];
    let n = 0;
    for (const g of cols.values()) {
      let x0 = 16, z0 = 16, x1 = -1, z1 = -1;
      for (const c of g.list) { const lx = c[0] & 15, lz = c[2] & 15; if (lx < x0) x0 = lx; if (lx > x1) x1 = lx; if (lz < z0) z0 = lz; if (lz > z1) z1 = lz; }
      const sx = x1 - x0 + 1, sy = g.y1 - g.y0 + 1, sz = z1 - z0 + 1, idx = new Uint16Array(sx * sy * sz), pal = [0, 'air'], map = new Map();
      for (const c of g.list) {
        let k = 1;
        if (c[3]) { k = map.get(c[3]); if (k === undefined) { k = pal.length; pal.push(C.portable(c[3])); map.set(c[3], k); } }
        const i = ((c[1] - g.y0) * sz + ((c[2] & 15) - z0)) * sx + ((c[0] & 15) - x0);
        if (!idx[i]) n++;
        idx[i] = k;
      }
      boxes.push({ o: [g.cx * 16 + x0, g.y0, g.cz * 16 + z0], s: [sx, sy, sz], pal, rle: C.b64(C.vrle(idx)) });
    }
    return { v: 1, id: id || E.newId(), t: Date.now(), n, boxes };
  };
  // a batch → [[x, y, z, state], …] (blocks this build does not know are left out)
  E.unpack = function (b) {
    const C = VR.Custom, out = [];
    for (const bx of b.boxes || []) {
      const [ox, oy, oz] = bx.o, [sx, sy, sz] = bx.s, pal = bx.pal.map((p, i) => (i === 0 ? -1 : i === 1 ? 0 : C.fromPortable(p)));
      const idx = C.unvrle(C.unb64(bx.rle), sx * sy * sz);
      for (let y = 0; y < sy; y++) for (let z = 0; z < sz; z++) for (let x = 0; x < sx; x++) {
        const k = idx[(y * sz + z) * sx + x]; if (!k) continue;
        const s = pal[k]; if (s === undefined || s < 0) continue;
        out.push([ox + x, oy + y, oz + z, s]);
      }
    }
    return out;
  };
  // the columns a batch touches (the game builds it once they are all loaded)
  E.columns = (b) => (b.boxes || []).map(bx => [bx.o[0] >> 4, bx.o[2] >> 4]);

  // ---------------------------------------------------------------- the Studio's side
  E.list = (w) => { const d = ls.get(E.listKey(w)); return d && Array.isArray(d.ids) ? d.ids : []; };
  E.done = (w) => { const d = ls.get(E.doneKey(w)); return d && Array.isArray(d.ids) ? d.ids : []; };
  E.push = function (w, batch) {
    if (!ls.set(E.batchKey(w, batch.id), batch)) return false;
    const ids = E.list(w); ids.push(batch.id);
    return ls.set(E.listKey(w), { v: 1, ids, t: Date.now() });
  };
  // batches the game has not built yet (oldest first)
  E.pending = function (w) {
    const done = new Set(E.done(w)), out = [];
    for (const id of E.list(w)) { if (done.has(id)) continue; const b = ls.get(E.batchKey(w, id)); if (b) out.push(b); }
    return out;
  };
  // the Studio drops what the game has built (the game's done list keeps the ids, so nothing is built twice)
  E.prune = function (w) {
    const done = new Set(E.done(w)), ids = E.list(w), keep = ids.filter(id => !done.has(id));
    if (keep.length === ids.length) return 0;
    for (const id of ids) if (done.has(id)) ls.del(E.batchKey(w, id));
    ls.set(E.listKey(w), { v: 1, ids: keep, t: Date.now() });
    return ids.length - keep.length;
  };

  // ---------------------------------------------------------------- the game's side
  E.markDone = function (w, id) {
    const d = ls.get(E.doneKey(w)) || { v: 1, ids: [] };
    if (!d.ids.includes(id)) d.ids.push(id);
    if (d.ids.length > 400) d.ids = d.ids.slice(-400);
    d.t = Date.now();
    return ls.set(E.doneKey(w), d);
  };
})(VR);
