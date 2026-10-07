// ============================================================================
// R9 Studio → game: the player's own designs.
//   · houses — a catalogue house edited block by block in the Studio's Crafter.
//     v2 (template): the whole edited lot — every cell the house or the player
//     put there (air included), lot-local from below the floor to the top, as a
//     palette + varint runs; cells nobody touched are "keep" (the terrain under
//     the lot stays). The villa builder still runs (rooms, beds and seats for the
//     villagers, the door) but everything it would put inside the template box
//     is dropped and the template is laid down instead — a design looks exactly
//     as saved even after the villa builder changes. v1 (older Studios): only
//     the cells that differ from the generated house of the same variant (seed,
//     beds, skin, mirror), laid onto that variant; still read, and the Studio
//     upgrades them to templates when it starts.
//   · models — a furniture / facade model repainted or reshaped voxel by voxel:
//     stored as its palette + an RLE of the palette-index volume. Applied to the
//     compiled model on the main thread and in every worker before anything is
//     meshed (the parts — and so the block states — stay the same).
// Shared by the game, its workers and the Studio. Persisted by the pages in
// localStorage under 'r9si.studio' (same origin: the game and its studio.html).
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R;
  const C = VR.Custom = {};
  C.KEY = 'r9si.studio';
  VR.CUSTOM = VR.CUSTOM || { v: 1, houses: {}, models: {} };

  // ---------------------------------------------------------------- encodings
  C.b64 = function (u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  C.unb64 = function (str) { const s = atob(str), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
  C.rle = function (vol) { const out = []; let i = 0; while (i < vol.length) { const v = vol[i]; let n = 1; while (i + n < vol.length && vol[i + n] === v && n < 65535) n++; out.push(v, n); i += n; } return new Uint16Array(out); };
  C.unrle = function (r, len) { const a = new Uint16Array(len); let o = 0; for (let i = 0; i + 1 < r.length; i += 2) { const n = Math.min(r[i + 1], len - o); if (n <= 0) break; a.fill(r[i], o, o + n); o += n; } return a; };
  // runs as varint pairs (value, count): a byte or two per run instead of four
  C.vrle = function (arr) {
    const out = []; let i = 0;
    const put = (n) => { while (n >= 128) { out.push((n & 127) | 128); n = Math.floor(n / 128); } out.push(n); };
    while (i < arr.length) { const v = arr[i]; let n = 1; while (i + n < arr.length && arr[i + n] === v) n++; put(v); put(n); i += n; }
    return Uint8Array.from(out);
  };
  C.unvrle = function (u8, len) {
    const a = new Uint16Array(len); let o = 0, p = 0;
    const get = () => { let n = 0, m = 1, b; do { b = u8[p++]; n += (b & 127) * m; m *= 128; } while ((b & 128) && p < u8.length); return n; };
    while (p < u8.length && o < len) { const v = get(), n = get(); if (n <= 0) break; a.fill(v, o, Math.min(len, o + n)); o += n; }
    return a;
  };
  // a block state as [name, {prop: valueIndex}] (survives new blocks being added to the registry) and back
  C.portable = function (s) { if (!s) return null; const t = R.types[R.T.type[s]]; if (!t) return null; const p = t.decode(s); return Object.keys(p).length ? [t.name, p] : [t.name]; };
  C.fromPortable = function (e) { if (!e) return 0; const t = R.byName[e[0]]; if (!t) return -1; return e[1] ? t.state(e[1]) : t.defaultState; };
  // rotate a state by r quarter-turns clockwise (lot rotation): facing, axis, rotation follow; everything else stays
  C.rotState = function (s, r) {
    r &= 3; if (!s || !r) return s;
    const t = R.types[R.T.type[s]]; if (!t) return s;
    if (t.has('facing')) { const n = t.props[t.propIndex.facing].n, f = t.get(s, 'facing'); if (f < 4 && (n === 4 || n >= 5)) s = t.with(s, 'facing', (f + r) & 3); }
    if (t.has('axis') && (r & 1)) { const a = t.get(s, 'axis'); if (a === 1) s = t.with(s, 'axis', 2); else if (a === 2) s = t.with(s, 'axis', 1); }
    if (t.has('rotation') && t.props[t.propIndex.rotation].n === 16) s = t.with(s, 'rotation', (t.get(s, 'rotation') + r * 4) & 15);
    return s;
  };

  // ---------------------------------------------------------------- houses
  C.houseFor = function (index) { const h = VR.CUSTOM && VR.CUSTOM.houses && VR.CUSTOM.houses[index]; return h && ((h.tpl && h.tpl.rle) || (h.cells && h.cells.length) || C.skinOnly(h)) ? h : null; };
  // a design that only chose the facade (skin) or the mirrored plan: the house is built in that variant, block for
  // block as the villa builder makes it (v0.39 — before, such a choice never reached the game)
  C.skinOnly = function (h) { return !!h && !(h.tpl && h.tpl.rle) && !(h.cells && h.cells.length) && (typeof h.skin === 'string' || h.mirror === true); };
  // the decoded template of a v2 design (cached per loaded design): box W × D, y0..y1 relative to the floor,
  // idx = palette index per cell (y, v, u order), st = palette as states (-2 keep, 0 air, -1 unknown block)
  const TPL = new WeakMap();
  C.tplData = function (h) {
    const t = h && h.tpl; if (!t || !t.rle || !t.box || !t.pal) return null;
    let d = TPL.get(t); if (d) return d;
    const W = t.box[0] | 0, D = t.box[1] | 0, y0 = t.box[2] | 0, y1 = t.box[3] | 0, H = y1 - y0 + 1, u0 = t.off ? t.off[0] | 0 : 0, v0 = t.off ? t.off[1] | 0 : 0;
    if (!(W > 0 && D > 0 && H > 0) || W * D * H > 8e6) return null;
    let idx, st;
    try {
      idx = C.unvrle(C.unb64(t.rle), W * D * H);
      st = new Int32Array(t.pal.length);
      for (let k = 0; k < t.pal.length; k++) { const e = t.pal[k]; st[k] = e === 'keep' ? -2 : e === 'air' ? 0 : C.fromPortable(e); }
    } catch (e) { TPL.set(t, null); return null; }   // a corrupted design builds the original house, never a broken town
    d = { W, D, y0, y1, H, u0, v0, idx, st, rot: [] };
    TPL.set(t, d);
    return d;
  };
  // lay a v2 template onto a lot (L: the rotated lot builder, F: floor level). cap: what the villa builder wanted in the
  // box (type id + 1 per cell) — the villagers' spots (beds, seats, desks, lamps) survive only where the design kept them.
  C.applyTemplate = function (h, L, F, info, cap) {
    const T = C.tplData(h); if (!T) return 0;
    const r = (L.r || 0) & 3;
    let rs = T.rot[r]; if (!rs) { rs = T.rot[r] = new Int32Array(T.st.length); for (let k = 0; k < T.st.length; k++) rs[k] = T.st[k] > 0 ? C.rotState(T.st[k], r) : T.st[k]; }
    const yb = F + T.y0; let n = 0;
    for (let yy = 0; yy < T.H; yy++) for (let v = 0; v < T.D; v++) {
      const row = (yy * T.D + v) * T.W;
      for (let u = 0; u < T.W; u++) { const k = T.idx[row + u]; if (!k) continue; const s = rs[k]; if (s < 0) continue; L.P(T.u0 + u, yb + yy, T.v0 + v, s || null); n++; }
    }
    if (info && cap) {
      const kept = (p) => {
        const u = p[0] - T.u0, y = p[1] - yb, v = p[2] - T.v0;
        if (u < 0 || v < 0 || u >= T.W || v >= T.D || y < 0 || y >= T.H) return true;
        const i = (y * T.D + v) * T.W + u, k = T.idx[i], g = cap[i];
        if (!k || !g) return false;
        const s = T.st[k]; return s >= 0 && (s ? R.T.type[s] : 0) === g - 1;
      };
      for (const key of ['beds', 'seats', 'desks', 'lights']) if (Array.isArray(info[key])) info[key] = info[key].filter(kept);
    }
    return n;
  };
  // a v2 template from a Crafter grid: g = {sx, sy, sz, pad, F, lot: [W, D], blocks, base, wrote} (grid index (y·sz + z)·sx + x).
  // A cell is stored when the house wrote it or the player changed it (air included); everything else is "keep". The
  // box covers all of that — the lot and whatever the house puts around it (front steps, a portico, a bay window):
  // box [W, D, y0, y1] from off [u0, v0] in lot cells.
  // a door, gate or trapdoor the house came with that was only opened or closed (walking around as the player) is
  // not a change: designs keep doors the way the house has them
  const playOnly = (s, b) => {
    if (s === b || !s || !b) return false;
    const R = VR.R, T = R.T; if (T.type[s] !== T.type[b]) return false;
    const t = R.types[T.type[s]]; return !!(t && t.has && t.has('open') && t.with(s, 'open', t.get(b, 'open')) === b);
  };
  C.playOnly = playOnly;
  C.makeTemplate = function (g) {
    const { sx, sy, sz, pad, base, wrote } = g;
    let blocks = g.blocks;
    // doors as the house came with them
    for (let i = 0; i < blocks.length; i++) if (blocks[i] !== base[i] && playOnly(blocks[i], base[i])) { if (blocks === g.blocks) blocks = g.blocks.slice(); blocks[i] = base[i]; }
    let yLo = Infinity, yHi = -Infinity, xLo = Infinity, xHi = -Infinity, zLo = Infinity, zHi = -Infinity, changed = 0;
    for (let y = 0; y < sy; y++) for (let z = 0; z < sz; z++) for (let x = 0; x < sx; x++) {
      const i = (y * sz + z) * sx + x, ch = blocks[i] !== base[i];
      if (ch) changed++;
      if (ch || (wrote && wrote[i])) { if (y < yLo) yLo = y; if (y > yHi) yHi = y; if (x < xLo) xLo = x; if (x > xHi) xHi = x; if (z < zLo) zLo = z; if (z > zHi) zHi = z; }
    }
    if (yHi < yLo) return null;
    const W = xHi - xLo + 1, D = zHi - zLo + 1, H = yHi - yLo + 1, idx = new Uint16Array(W * D * H), pal = ['keep', 'air'], map = new Map();
    let top = 0;
    for (let yy = 0; yy < H; yy++) for (let v = 0; v < D; v++) for (let u = 0; u < W; u++) {
      const i = ((yLo + yy) * sz + zLo + v) * sx + xLo + u, s = blocks[i];
      if (!(s !== base[i] || (wrote && wrote[i]))) continue;
      let k = 1;
      if (s) { k = map.get(s); if (k === undefined) { k = pal.length; pal.push(C.portable(s)); map.set(s, k); } if (yLo + yy - g.F > top) top = yLo + yy - g.F; }
      idx[(yy * D + v) * W + u] = k;
    }
    return { tpl: { box: [W, D, yLo - g.F, yHi - g.F], off: [xLo - pad, zLo - pad], pal, rle: C.b64(C.vrle(idx)) }, changed, top };
  };
  // v1: lay the stored edits of catalogue house `index` onto a freshly built lot (L: rotated lot builder, F: floor level)
  C.applyHouse = function (h, L, F, info) {
    if (!Array.isArray(h.cells) || !Array.isArray(h.pal)) return 0;      // a facade-only design: nothing to lay down
    const pal = h.pal.map(C.fromPortable), r = L.r || 0;
    const gone = new Set();
    for (const c of h.cells) {
      const s = pal[c[3]]; if (s < 0) continue;
      L.P(c[0], F + c[1], c[2], s ? C.rotState(s, r) : null);
      gone.add(c[0] + ',' + (F + c[1]) + ',' + c[2]);
    }
    // the villagers' spots that were built over or taken away are dropped (beds, seats, desks)
    if (info) for (const k of ['beds', 'seats', 'desks']) if (Array.isArray(info[k])) info[k] = info[k].filter(p => !gone.has(p[0] + ',' + p[1] + ',' + p[2]));
    return h.cells.length;
  };

  // ---------------------------------------------------------------- models
  const orig = {};   // name → the compiled original (vol, pal, bounds) so an override can be undone in a live page
  // a model made anew under the same name (a variant slot's model, looks.js): its original is the new one
  C.forget = function (name) { delete orig[name]; };
  C.applyModel = function (name, ov) {
    const VM = VR.VM, m = VM && VM.MODELS[name]; if (!m) return false;
    if (!orig[name]) orig[name] = { vol: m.vol, pal: m.pal, col: m.col, vox: m.vox, bounds: m.parts.map(p => p.bounds.slice()) };
    if (!ov) { const o = orig[name]; m.vol = o.vol; m.pal = o.pal; m.col = o.col; m.vox = o.vox; m.parts.forEach((p, i) => { p.bounds = o.bounds[i].slice(); }); C.refreshModel(m); return true; }
    if (ov.W !== m.W || ov.H !== m.H || ov.D !== m.D || ov.res !== m.res) return false;
    const len = m.VW * m.VH * m.VD, idx = C.unrle(new Uint16Array(C.unb64(ov.rle).buffer), len);
    const pal = Uint32Array.from(ov.pal);
    C.setVolume(m, idx, pal);
    return true;
  };
  // install a palette-index volume into a compiled model: part bounds, average colour, voxel count, getter
  C.setVolume = function (m, idx, pal) {
    const R_ = m.res, VW = m.VW, VD = m.VD;
    m.vol = pal.length <= 256 ? Uint8Array.from(idx) : Uint16Array.from(idx); m.pal = pal;
    let r = 0, g = 0, b = 0, n = 0, vox = 0;
    for (let i = 0; i < idx.length; i++) { const k = idx[i]; if (!k) continue; vox++; const v = pal[k]; if (v & VR.VX.GLASS) continue; r += (v >> 16) & 255; g += (v >> 8) & 255; b += v & 255; n++; }
    m.vox = vox; if (n) m.col = (Math.round(r / n) << 16) | (Math.round(g / n) << 8) | Math.round(b / n);
    for (const p of m.parts) {
      let x0 = R_, y0 = R_, z0 = R_, x1 = -1, y1 = -1, z1 = -1;
      const ox = p.px * R_, oy = p.py * R_, oz = p.pz * R_;
      for (let y = 0; y < R_; y++) for (let z = 0; z < R_; z++) { const row = ((oy + y) * VD + oz + z) * VW + ox; for (let x = 0; x < R_; x++) if (m.vol[row + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z; } }
      p.bounds = x1 < 0 ? [0, 0, 0, 0, 0, 0] : [x0, y0, z0, x1 + 1, y1 + 1, z1 + 1];
    }
    C.refreshModel(m);
  };
  C.refreshModel = function (m) {
    const P = m.pal, vol = m.vol, VW = m.VW, VH = m.VH, VD = m.VD;
    m.get = (x, y, z) => (x < 0 || y < 0 || z < 0 || x >= VW || y >= VH || z >= VD) ? 0 : P[vol[(y * VD + z) * VW + x]];
    m.sib = null;
    const t = R.byName[m.name];
    if (t && VR.VX && VR.VX.spec) for (let s = t.base; s < t.base + t.nstates; s++) { const sp = VR.VX.spec(s); if (sp && sp.model === m) sp.col = m.col; }
    if (VR.VX && VR.VX.clearCache) VR.VX.clearCache();
  };

  // ---------------------------------------------------------------- the whole set
  C.apply = function (data) {
    const prev = VR.CUSTOM || { models: {} };
    VR.CUSTOM = data && typeof data === 'object' ? { v: 1, houses: data.houses || {}, models: data.models || {} } : { v: 1, houses: {}, models: {} };
    for (const n in prev.models) if (!VR.CUSTOM.models[n]) C.applyModel(n, null);
    for (const n in VR.CUSTOM.models) { try { C.applyModel(n, VR.CUSTOM.models[n]); } catch (e) { /* a broken entry never stops the game */ } }
    return VR.CUSTOM;
  };
  C.load = function () { try { const t = localStorage.getItem(C.KEY); return t ? JSON.parse(t) : null; } catch (e) { return null; } };
  C.save = function (data) { try { localStorage.setItem(C.KEY, JSON.stringify(data)); return true; } catch (e) { return false; } };
  C.count = function (d) { d = d || VR.CUSTOM; return { houses: Object.keys(d.houses || {}).length, models: Object.keys(d.models || {}).length }; };
})(VR);
