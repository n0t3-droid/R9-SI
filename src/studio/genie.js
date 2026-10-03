// ============================================================================
// R9 Studio · ✨ Genie (v0.37): a photo, a sketch or a sentence → a buildable
// design, worked out right here in the page by the Genie's own brain
// (genie_brain.js) — no account, no limit, the same for every player:
//  · a building → the 🏠 Haus-Baukasten's choices (size, roof, walls, windows,
//    door, extras), which the Baukasten builds with rooms, stairs and furniture,
//    and which stay editable in the 🏠 tab;
//  · anything else (a car, a ship, a tree, an animal, a figure, a tower …) → a
//    handful of shapes (boxes, cylinders, balls, cones, ramps, rods, pictures with
//    depth) in colours, which become blocks here (the colour → the nearest block,
//    glass for glass, lamps for light).
// ============================================================================
(function () {
  'use strict';
  const R = VR.R, KEEP = 0xffff; if (!R) return;
  const G = VR.Genie = {};
  const num = (v) => (typeof v === 'number' ? v : parseFloat(v));

  // ---------------------------------------------------------------- always here
  const LOCAL = Object.freeze({ local: true, images: true, maxImages: 1 });
  G.available = () => Promise.resolve(LOCAL);
  G.forget = () => {};

  // ---------------------------------------------------------------- the answer → something buildable
  G.parse = function (o) {
    if (Array.isArray(o)) o = o.find(x => x && typeof x === 'object') || null;
    if (!o || typeof o !== 'object') throw { code: 'invalid_json', message: 'no object' };
    const house = o.kind === 'house' || (o.kind !== 'model' && (o.roof || o.walls || o.floors));
    if (house && VR.HouseKit) { const spec = VR.HouseKit.normalize(o.house && typeof o.house === 'object' ? Object.assign({}, o, o.house) : o); return { kind: 'house', spec, name: spec.name, notes: String(o.notes || '').slice(0, 300) }; }
    const parts = Array.isArray(o.parts) ? o.parts : Array.isArray(o.shapes) ? o.shapes : [];
    if (!parts.length) throw { code: 'invalid_json', message: 'no parts' };
    return { kind: 'model', model: { size: o.size, parts }, name: String(o.name || 'Modell').slice(0, 40), notes: String(o.notes || '').slice(0, 300) };
  };

  // ---------------------------------------------------------------- shapes → blocks
  const rgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || '').trim()); if (!m) return null; const v = parseInt(m[1], 16); return [v >> 16 & 255, v >> 8 & 255, v & 255]; };
  // the stained glass of the game and its colours (the textures are mostly see-through, so they are named here)
  const GLASS = { glass: 0xdbeef5, white_stained_glass: 0xf9fffe, light_gray_stained_glass: 0x9d9d97, gray_stained_glass: 0x474f52, black_stained_glass: 0x1d1d21, brown_stained_glass: 0x835432, red_stained_glass: 0xb02e26, orange_stained_glass: 0xf9801d, yellow_stained_glass: 0xfed83d, lime_stained_glass: 0x80c71f, green_stained_glass: 0x5e7c16, cyan_stained_glass: 0x169c9c, light_blue_stained_glass: 0x3ab3da, blue_stained_glass: 0x3c44aa, purple_stained_glass: 0x8932b8, magenta_stained_glass: 0xc74ebd, pink_stained_glass: 0xf38baa, tinted_glass: 0x2b2830 };
  const WATER = { light_blue_stained_glass: 0x3ab3da, blue_stained_glass: 0x3c44aa, cyan_stained_glass: 0x169c9c };
  const grepNames = (re, not) => R.types.filter(t => t && !t.o.noItem && re.test(t.name) && !(not && not.test(t.name))).map(t => t.name);
  const FAMS = {};
  const famOf = (mat) => FAMS[mat] || (FAMS[mat] = ({
    light: () => grepNames(/^(glowstone|sea_lantern|shroomlight|light_panel|ochre_mire_light|verdant_mire_light|pearl_mire_light|.*froglight|jack_o_lantern)$/).filter(n => R.T.emit && R.T.emit[R.byName[n].defaultState]),
    metal: () => grepNames(/^(iron_block|gold_block|copper_block|exposed_copper|weathered_copper|oxidized_copper|netherite_block|black_metal|tech_panel|diamond_block|emerald_block|lapis_block)$/).concat(grepNames(/^vollton_[a-z_]+_gloss$/)),
    wood: () => grepNames(/_planks$|_log$|_wood$/, /^vx_|stripped/),
    leaves: () => grepNames(/_leaves$/),
  }[mat] || (() => []))());
  const memo = new Map();
  function nearestIn(names, c, table) {
    const BC = VR.BlockColors; if (!names.length) return 0;
    const key = names[0] + names.length + ':' + c.join(',');
    if (memo.has(key)) return memo.get(key);
    const L = BC.toLab(c[0], c[1], c[2]); let best = names[0], bd = Infinity;
    for (const n of names) {
      if (!R.byName[n]) continue;
      let q;
      if (table) { const h = table[n]; q = BC.toLab(h >> 16 & 255, h >> 8 & 255, h & 255); }
      else { const k = BC.colorOf(R.byName[n].defaultState, 'side'); q = BC.toLab(k[0], k[1], k[2]); }
      const d = (q[0] - L[0]) ** 2 * 0.7 + (q[1] - L[1]) ** 2 + (q[2] - L[2]) ** 2;
      if (d < bd) { bd = d; best = n; }
    }
    const s = R.byName[best] ? R.byName[best].defaultState : 0;
    if (memo.size > 4000) memo.clear(); memo.set(key, s); return s;
  }
  // the block for a part: its material, its colour
  function blockFor(mat, color, set) {
    const BC = VR.BlockColors;
    if (color === 'air' || mat === 'air') return 0;
    const c = rgb(color) || [160, 160, 160];
    if (!BC || !BC.ready || !BC.ready()) return R.byName.stone.defaultState;
    if (mat === 'glass') return nearestIn(Object.keys(GLASS), c, GLASS);
    if (mat === 'water') return nearestIn(Object.keys(WATER), c, WATER);
    if (mat === 'stone') return BC.nearest(c[0], c[1], c[2], 'nature', 'side');
    if (mat === 'light' || mat === 'metal' || mat === 'wood' || mat === 'leaves') { const s = nearestIn(famOf(mat), c); if (s) return s; }
    return BC.nearest(c[0], c[1], c[2], set || 'all', 'side');
  }
  // every part as a test "is this cell inside?" plus its box (lo/hi: the whole cells it covers) and its bounds bl/bh in
  // continuous coordinates. W = half a block of the finished grid in the plan's units: when a plan is scaled down,
  // a part thinner than one finished block (a mast, a window pane, a stripe) still gets its row of blocks.
  const AX = { x: 0, y: 1, z: 2, '+x': 0, '+y': 1, '+z': 2, '-x': 0, '-y': 1, '-z': 2 };
  function boxBounds(lo, hi, W) {
    const bl = [0, 0, 0], bh = [0, 0, 0];
    for (let i = 0; i < 3; i++) { if (hi[i] - lo[i] + 1 < 2 * W) { const c = (lo[i] + hi[i]) / 2; bl[i] = c - W; bh[i] = c + W; } else { bl[i] = lo[i] - 0.5; bh[i] = hi[i] + 0.5; } }
    return { bl, bh };
  }
  const grow = (lo, hi, W) => ({ bl: lo.map(v => v - 0.5 - Math.max(0, W - 0.5)), bh: hi.map(v => v + 0.5 + Math.max(0, W - 0.5)) });
  function shapeOf(p, W) {
    W = W || 0.5;
    const a = (k) => (Array.isArray(p[k]) ? p[k].map(num) : null);
    let v;
    if (p.relief && typeof p.relief === 'object') {
      // a picture with depth: w × h pixels (rows top → bottom, one character each: 0 = empty, 1… = pal[i-1]) and for every
      // pixel how far it reaches to the front and the back of the middle (same encoding) — photos, hearts, letters
      const V = p.relief, w = Math.round(num(V.w)), h = Math.round(num(V.h)), d = Math.max(1, Math.round(num(V.d)) || 1), at = Array.isArray(V.at) ? V.at.map(n => Math.round(num(n)) || 0) : [0, 0, 0];
      const px = String(V.px || ''), hf = String(V.half || '');
      if (!(w > 0 && h > 0) || px.length < w * h || !Array.isArray(V.pal)) return null;
      const zc = (d - 1) / 2, lo = at.slice(), hi = [at[0] + w - 1, at[1] + h - 1, at[2] + d - 1];
      const cell = (q) => { const x = Math.round(q[0]) - at[0], y = Math.round(q[1]) - at[1], z = Math.round(q[2]) - at[2]; if (x < 0 || y < 0 || z < 0 || x >= w || y >= h || z >= d) return 0; const i = (h - 1 - y) * w + x, c = px.charCodeAt(i) - 48; if (!(c > 0)) return 0; const k = hf.length > i ? hf.charCodeAt(i) - 48 : zc; return Math.abs(z - zc) <= k + 0.01 ? c : 0; };
      return { lo, hi, bl: lo.map(v => v - 0.5), bh: hi.map(v => v + 0.5), inside: (q) => cell(q) > 0, cell, vox: V };
    }
    if ((v = a('box')) && v.length >= 6 && v.slice(0, 6).every(Number.isFinite)) {
      const [x0, y0, z0, x1, y1, z1] = v.map(Math.round), lo = [Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)], hi = [Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)];
      return Object.assign({ lo, hi, inside: () => true }, boxBounds(lo, hi, W));
    }
    if ((v = a('cyl')) && v.length >= 5 && v.slice(0, 5).every(Number.isFinite)) {
      const [x, y, z, r0, len0] = v, ax = AX[String(p.axis || 'y').toLowerCase()] ?? 1, r = Math.max(0.5, r0), len = Math.max(1, Math.round(len0)), c = [x, y, z];
      const lo = [0, 1, 2].map(i => i === ax ? Math.round(c[i]) : Math.floor(c[i] - r)), hi = [0, 1, 2].map(i => i === ax ? Math.round(c[i]) + len - 1 : Math.ceil(c[i] + r));
      const ro = Math.max(r + 0.42, W), rr = ro ** 2, B = grow(lo, hi, W), BB = boxBounds(lo, hi, W); B.bl[ax] = BB.bl[ax]; B.bh[ax] = BB.bh[ax];
      // "inner": a ring (a wheel, a railing, a rainbow band) — at least one finished block thick
      const inr = Number.isFinite(num(p.inner)) && num(p.inner) > 0 ? Math.min(num(p.inner) + 0.42, ro - 2 * W) : -1, ir = inr > 0 ? inr * inr : -1;
      return Object.assign({ lo, hi, inside: (q) => { let d = 0; for (let i = 0; i < 3; i++) if (i !== ax) d += (q[i] - c[i]) ** 2; return d <= rr && d > ir; } }, B);
    }
    if ((v = a('ball')) && v.length >= 4 && v.slice(0, 4).every(Number.isFinite)) {
      const [x, y, z, rx0] = v, ry0 = Number.isFinite(v[4]) ? v[4] : rx0, rz0 = Number.isFinite(v[5]) ? v[5] : rx0;
      const R3 = [Math.max(Math.max(0.5, rx0) + 0.42, W), Math.max(Math.max(0.5, ry0) + 0.42, W), Math.max(Math.max(0.5, rz0) + 0.42, W)], c = [x, y, z];
      const lo = [0, 1, 2].map(i => Math.floor(c[i] - R3[i])), hi = [0, 1, 2].map(i => Math.ceil(c[i] + R3[i]));
      return Object.assign({ lo, hi, inside: (q) => ((q[0] - c[0]) / R3[0]) ** 2 + ((q[1] - c[1]) / R3[1]) ** 2 + ((q[2] - c[2]) / R3[2]) ** 2 <= 1 }, grow(lo, hi, W));
    }
    if ((v = a('cone')) && v.length >= 5 && v.slice(0, 5).every(Number.isFinite)) {
      const [x, y, z, r0, h0] = v, axs = String(p.axis || 'y').toLowerCase(), ax = AX[axs] ?? 1, dir = axs[0] === '-' ? -1 : 1, r = Math.max(0.5, r0), h = Math.max(1, Math.round(h0)), c = [x, y, z];
      const lo = [0, 1, 2].map(i => i === ax ? (dir > 0 ? Math.round(c[i]) : Math.round(c[i]) - h + 1) : Math.floor(c[i] - r)), hi = [0, 1, 2].map(i => i === ax ? (dir > 0 ? Math.round(c[i]) + h - 1 : Math.round(c[i])) : Math.ceil(c[i] + r));
      return Object.assign({ lo, hi, inside: (q) => { const t = (q[ax] - Math.round(c[ax])) * dir; if (t < -0.5 || t > h - 0.5) return false; const rr = Math.max(r * (h - Math.max(0, t)) / h + 0.42, W); let d = 0; for (let i = 0; i < 3; i++) if (i !== ax) d += (q[i] - c[i]) ** 2; return d <= rr * rr; } }, grow(lo, hi, W));
    }
    if ((v = a('line')) && v.length >= 6 && v.slice(0, 6).every(Number.isFinite)) {
      const p0 = v.slice(0, 3), p1 = v.slice(3, 6), r = Math.max(0.3, Number.isFinite(num(p.r)) ? num(p.r) : 0.5), rr = Math.max(r + 0.42, W) ** 2;
      const d = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]], L2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2] || 1;
      const lo = [0, 1, 2].map(i => Math.floor(Math.min(p0[i], p1[i]) - r)), hi = [0, 1, 2].map(i => Math.ceil(Math.max(p0[i], p1[i]) + r));
      return Object.assign({ lo, hi, inside: (q) => { let t = ((q[0] - p0[0]) * d[0] + (q[1] - p0[1]) * d[1] + (q[2] - p0[2]) * d[2]) / L2; t = Math.max(0, Math.min(1, t)); const e0 = q[0] - p0[0] - d[0] * t, e1 = q[1] - p0[1] - d[1] * t, e2 = q[2] - p0[2] - d[2] * t; return e0 * e0 + e1 * e1 + e2 * e2 <= rr; } }, grow(lo, hi, W));
    }
    if ((v = a('wedge')) && v.length >= 6 && v.slice(0, 6).every(Number.isFinite)) {
      const [x0, y0, z0, x1, y1, z1] = v.map(Math.round), lo = [Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)], hi = [Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)];
      const dn = String(p.down || '+z').toLowerCase(), ax = dn.includes('x') ? 0 : 2, neg = dn[0] === '-';
      const span = Math.max(1, hi[ax] - lo[ax]);
      return Object.assign({ lo, hi, inside: (q) => { let t = (Math.min(hi[ax], Math.max(lo[ax], q[ax])) - lo[ax]) / span; if (neg) t = 1 - t; const top = hi[1] - (hi[1] - lo[1]) * t; return q[1] <= top + 0.5; } }, boxBounds(lo, hi, W));
    }
    return null;
  }
  function clipped(p, W) {
    const sh = shapeOf(p, W); if (!sh || !Array.isArray(p.clip) || p.clip.length < 6) return sh;
    const c = p.clip.map(num); if (!c.slice(0, 6).every(v => Number.isFinite(v))) return sh;
    for (let i = 0; i < 3; i++) {
      const a = Math.min(c[i], c[i + 3]), b = Math.max(c[i], c[i + 3]);
      sh.lo[i] = Math.max(sh.lo[i], Math.ceil(a)); sh.hi[i] = Math.min(sh.hi[i], Math.floor(b)); sh.bl[i] = Math.max(sh.bl[i], a - 0.5); sh.bh[i] = Math.min(sh.bh[i], b + 0.5);
      if (sh.lo[i] > sh.hi[i]) return null;
    }
    return sh;
  }
  // the whole model → a block grid that only touches the cells the shapes fill (carved cells become air).
  // opts.fit (or model.fit): the longest side in blocks — the plan is scaled up or down to it (at most opts.max);
  // without it a plan keeps its own size and is only scaled down when it is bigger than opts.max.
  G.raster = function (model, opts) {
    opts = opts || {};
    const MAX = opts.max || 96, parts = (model.parts || []).slice(0, 600);
    // "mirror": the part again, flipped left ↔ right across the middle of the model's width
    const sizeX = Array.isArray(model.size) && Number.isFinite(num(model.size[0])) ? num(model.size[0]) : null;
    let maxX = 0; for (const p of parts) { if (!p || typeof p !== 'object') continue; for (const k of ['box', 'wedge', 'line']) if (Array.isArray(p[k])) maxX = Math.max(maxX, num(p[k][0]) || 0, num(p[k][3]) || 0); for (const k of ['cyl', 'ball', 'cone']) if (Array.isArray(p[k])) maxX = Math.max(maxX, (num(p[k][0]) || 0) + (num(p[k][3]) || 0)); }
    const X1 = (sizeX || maxX + 1) - 1, mx = (x) => X1 - num(x);
    const flip = (p) => {
      const q = Object.assign({}, p); delete q.mirror;
      if (Array.isArray(p.box)) { const b = p.box.map(num); q.box = [mx(b[3]), b[1], b[2], mx(b[0]), b[4], b[5]]; }
      else if (Array.isArray(p.wedge)) { const b = p.wedge.map(num); q.wedge = [mx(b[3]), b[1], b[2], mx(b[0]), b[4], b[5]]; const dn = String(p.down || '+z').toLowerCase(); q.down = dn === '+x' ? '-x' : dn === '-x' ? '+x' : dn; }
      else if (Array.isArray(p.line)) { const b = p.line.map(num); q.line = [mx(b[0]), b[1], b[2], mx(b[3]), b[4], b[5]]; }
      else if (Array.isArray(p.ball)) { const b = p.ball.map(num); q.ball = [mx(b[0])].concat(b.slice(1)); }
      else if (Array.isArray(p.cyl)) { const b = p.cyl.map(num), ax = String(p.axis || 'y').toLowerCase(); q.cyl = [ax.includes('x') ? mx(b[0]) - (Math.max(1, Math.round(b[4])) - 1) : mx(b[0])].concat(b.slice(1)); }
      else if (Array.isArray(p.cone)) { const b = p.cone.map(num), ax = String(p.axis || 'y').toLowerCase(); q.cone = [mx(b[0])].concat(b.slice(1)); if (ax.includes('x')) q.axis = ax[0] === '-' ? 'x' : '-x'; }
      else return null;
      if (Array.isArray(p.clip) && p.clip.length >= 6) { const b = p.clip.map(num); q.clip = [mx(b[3]), b[1], b[2], mx(b[0]), b[4], b[5]]; }
      return q;
    };
    const all = []; for (const p of parts) { if (!p || typeof p !== 'object') continue; all.push(p); if (p.mirror) { const f = flip(p); if (f) all.push(f); } }
    // where the shapes are (an answer may start below 0 or overrun its size: everything is shifted to fit)
    const pre = all.map(p => clipped(p, 0.5));
    if (!pre.some(Boolean)) return null;
    const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    for (let j = 0; j < pre.length; j++) { const p = all[j], sh = pre[j]; if (!sh || p.color === 'air' || p.mat === 'air') continue; for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], sh.lo[i]); hi[i] = Math.max(hi[i], sh.hi[i]); } }
    if (lo[0] > hi[0]) return null;
    const ext = [0, 1, 2].map(i => hi[i] - lo[i] + 1), big = Math.max(...ext);
    const fit = num(opts.fit) > 0 ? num(opts.fit) : num(model.fit) > 0 ? num(model.fit) : 0;
    const k = fit ? Math.min(MAX, Math.max(2, fit)) / big : big > MAX ? MAX / big : 1;
    const D = ext.map(e => Math.max(1, Math.round(e * k))), [X, Y, Z] = D, cen = [0, 1, 2].map(i => (lo[i] + hi[i]) / 2);
    const W = k < 1 ? 0.5 / k : 0.5;
    const shapes = []; for (const p of all) { const air = p.color === 'air' || p.mat === 'air', sh = clipped(p, air ? 0.5 : W); if (sh) shapes.push([p, sh]); }
    const grid = new Uint16Array(X * Y * Z).fill(KEEP), idx = (x, y, z) => (y * Z + z) * X + x;
    const q = [0, 0, 0], toQ = (g, i) => cen[i] + (g + 0.5 - D[i] / 2) / k, toG = (v, i) => (v - cen[i]) * k + D[i] / 2 - 0.5;
    for (const [p, sh] of shapes) {
      const pal = sh.vox ? sh.vox.pal.map((hex, i) => blockFor(String((sh.vox.mats && sh.vox.mats[i]) || p.mat || '').toLowerCase(), hex, opts.set)) : null;
      const s = pal ? 1 : blockFor(String(p.mat || '').toLowerCase(), p.color, opts.set);
      const hollow = !!p.hollow && s !== 0;
      // the cells of the grid whose centre (in the plan's coordinates) is inside the shape
      const g0 = [0, 1, 2].map(i => Math.max(0, Math.ceil(toG(sh.bl[i], i) - 1e-6))), g1 = [0, 1, 2].map(i => Math.min(D[i] - 1, Math.floor(toG(sh.bh[i], i) + 1e-6)));
      const inAt = (x, y, z) => { q[0] = toQ(x, 0); q[1] = toQ(y, 1); q[2] = toQ(z, 2); if (k === 1) { q[0] = Math.round(q[0]); q[1] = Math.round(q[1]); q[2] = Math.round(q[2]); } for (let i = 0; i < 3; i++) if (q[i] < sh.bl[i] - 1e-6 || q[i] > sh.bh[i] + 1e-6) return false; return sh.inside(q); };
      for (let y = g0[1]; y <= g1[1]; y++) for (let z = g0[2]; z <= g1[2]; z++) for (let x = g0[0]; x <= g1[0]; x++) {
        if (!inAt(x, y, z)) continue;
        if (hollow && inAt(x + 1, y, z) && inAt(x - 1, y, z) && inAt(x, y + 1, z) && inAt(x, y - 1, z) && inAt(x, y, z + 1) && inAt(x, y, z - 1)) continue;
        const b = pal ? pal[sh.cell(q) - 1] : s;
        if (b === undefined) continue;
        if (p.paint && (grid[idx(x, y, z)] === KEEP || grid[idx(x, y, z)] === 0)) continue;   // "paint": only recolours what is there (spots, stripes, a face)
        if (b === 0 && grid[idx(x, y, z)] === KEEP) continue;   // carving takes away from the model, never from the world around it
        grid[idx(x, y, z)] = b;
      }
    }
    // trimmed to the cells that hold something (a wheel's box reaches below the ground it stands on)
    let n = 0; const a0 = [X, Y, Z], a1 = [-1, -1, -1];
    for (let y = 0; y < Y; y++) for (let z = 0; z < Z; z++) for (let x = 0; x < X; x++) { const s = grid[idx(x, y, z)]; if (s === KEEP) continue; if (s) n++; if (x < a0[0]) a0[0] = x; if (y < a0[1]) a0[1] = y; if (z < a0[2]) a0[2] = z; if (x > a1[0]) a1[0] = x; if (y > a1[1]) a1[1] = y; if (z > a1[2]) a1[2] = z; }
    if (!n) return null;
    const sx = a1[0] - a0[0] + 1, sy = a1[1] - a0[1] + 1, sz = a1[2] - a0[2] + 1, out = new Uint16Array(sx * sy * sz);
    for (let y = 0; y < sy; y++) for (let z = 0; z < sz; z++) for (let x = 0; x < sx; x++) out[(y * sz + z) * sx + x] = grid[idx(x + a0[0], y + a0[1], z + a0[2])];
    return { sx, sy, sz, blocks: out, n, name: model.name || 'Modell', dy: 0 };
  };

  // ---------------------------------------------------------------- one wish
  // ask({text, image (a canvas), size, base (the design to change), want: 'house'}) → {kind:'house', spec, …} |
  // {kind:'model', model, recipe, …}; throws {code: 'empty' | 'unknown' | 'nochange' | 'image_rejected' | 'cancelled'}
  let running = false, stopAsked = false;
  G.busy = () => running;
  G.stop = () => { stopAsked = true; };
  G.ask = async function (req, onStatus) {
    running = true; stopAsked = false;
    try {
      onStatus && onStatus('think', 0);
      await new Promise(r => setTimeout(r, 16));   // the page shows "…" for a moment
      if (stopAsked) throw { code: 'cancelled' };
      const B = VR.GenieBrain; if (!B) throw { code: 'unknown', suggestions: [] };
      return B.design({ text: req.text, image: req.image, size: req.size, base: req.base, want: req.want });
    } finally { running = false; }
  };
  // what to tell the player when nothing came out, and what to offer instead (chips: ready-made wishes)
  G.explain = function (e) {
    const c = e && e.code, chips = (e && e.suggestions) || [];
    if (c === 'unknown') return { text: (e.word ? '„' + e.word + '“ kenne ich noch nicht.' : 'Das kenne ich noch nicht.') + ' Vielleicht eins davon?', chips, word: e.word || '' };
    if (c === 'nochange') return { text: 'Was soll anders werden? Zum Beispiel:', chips };
    if (c === 'empty') return { text: 'Erst ein Foto, eine Skizze oder ein paar Worte.', chips: [] };
    if (c === 'image_rejected') return { text: 'Mit diesem Bild komme ich nicht zurecht — ein anderes Foto (JPG oder PNG)?', chips: [] };
    if (c === 'cancelled') return { text: 'Abgebrochen.', chips: [] };
    if (c === 'no_area') return { text: 'Erst eine Welt öffnen — dann plane ich dort.', chips: [] };
    return { text: 'Das hat nicht geklappt — noch einmal, vielleicht etwas anders beschrieben?', chips: [] };
  };
})();
