// ============================================================================
// 🪞 Spiegel-Bauen (wave 2, W-C): the pure part — where the copies of a block go and what state each copy gets.
// A mirror is a mode and a centre. Modes: 'x' (x is mirrored: the plane x = centre, its line on the ground runs along
// z), 'z', 'xz' (4-fach: X, Z and the half turn) and 'r8' (8-fach, rund: the eight symmetries of a square — three
// turns, four reflections). The centre is kept doubled (c2x, c2z): odd = ON a block (2b + 1 is block b's middle), even
// = BETWEEN two blocks (2b is the line between b − 1 and b). A quarter turn needs both on or both between (M.center).
// A transform is a 2×2 integer matrix on (u, v) = (x, z) offsets from the centre; it maps facings by their direction
// vector, and a reflection (det −1) also swaps the hand of a state: a door's hinge, a low hip roof's corner side.
// No DOM, no game: the game (src/main/mirrorbuild.js) applies the copies through its own edit path.
// ============================================================================
(function (VR) {
  'use strict';
  const M = VR.Mirror = {};
  const R = VR.R;
  const DX = [0, 1, 0, -1], DZ = [-1, 0, 1, 0];   // horizontal facings 0 north, 1 east, 2 south, 3 west (VR.HF_DX/HF_DZ)
  const HF = ['north', 'east', 'south', 'west'];

  // ---- the transforms: u' = a·u + b·v, v' = c·u + d·v (x east, z south; r90 turns clockwise seen from above)
  const TR = M.T = {};
  function def(name, a, b, c, d) {
    const t = { name, a, b, c, d, det: a * d - b * c, swap: a === 0, f4: [0, 0, 0, 0], id: name === 'id' };
    for (let f = 0; f < 4; f++) {
      const u = a * DX[f] + b * DZ[f], v = c * DX[f] + d * DZ[f];
      for (let g = 0; g < 4; g++) if (DX[g] === u && DZ[g] === v) t.f4[f] = g;
    }
    TR[name] = t;
  }
  def('id', 1, 0, 0, 1); def('fx', -1, 0, 0, 1); def('fz', 1, 0, 0, -1); def('r180', -1, 0, 0, -1);
  def('r90', 0, -1, 1, 0); def('r270', 0, 1, -1, 0); def('fd', 0, 1, 1, 0); def('fa', 0, -1, -1, 0);
  const tr = (t) => (typeof t === 'string' ? TR[t] : t) || null;

  // ---- modes
  M.MODES = ['x', 'z', 'xz', 'r8'];
  const SETS = { x: ['fx'], z: ['fz'], xz: ['fx', 'fz', 'r180'], r8: ['r90', 'r180', 'r270', 'fx', 'fz', 'fd', 'fa'] };
  M.next = (mode) => { const i = M.MODES.indexOf(mode); return i < 0 ? 'x' : (i + 1 < M.MODES.length ? M.MODES[i + 1] : null); };
  M.transforms = (mode) => (SETS[mode] || []).slice();
  M.lines = (mode) => (mode === 'x' ? ['x'] : mode === 'z' ? ['z'] : mode === 'xz' ? ['x', 'z'] : mode === 'r8' ? ['x', 'z', 'd', 'a'] : []);
  // the centre a mode works with: 8-fach turns need both coordinates on a block or both between (a mixed one: the
  // between-coordinate moves onto its block, half a block on)
  M.center = function (mode, c2x, c2z) {
    if (mode === 'r8' && ((c2x ^ c2z) & 1)) { if (!(c2x & 1)) c2x += 1; else c2z += 1; }
    return [c2x, c2z];
  };

  // ---- positions: a block (x, z) to its mirrored block; y never changes (every mirror plane stands upright)
  M.pos = function (t, c2x, c2z, x, z) {
    const T = tr(t); if (!T) return [x, z];
    const u = 2 * x + 1 - c2x, v = 2 * z + 1 - c2z;
    return [(T.a * u + T.b * v + c2x - 1) / 2, (T.c * u + T.d * v + c2z - 1) / 2];
  };
  // the mirrored spots of one block for a mode (not the block itself, no spot twice) — for breaking
  M.points = function (mode, c2x, c2z, x, z) {
    const c = M.center(mode, c2x, c2z), out = [], seen = new Set([x + ',' + z]);
    for (const t of SETS[mode] || []) { const p = M.pos(t, c[0], c[1], x, z), k = p[0] + ',' + p[1]; if (!seen.has(k)) { seen.add(k); out.push(p); } }
    return out;
  };

  // ---- states
  const swapHand = (v) => v.split('_').map(w => (w === 'l' ? 'r' : w === 'r' ? 'l' : w === 'vl' ? 'vr' : w === 'vr' ? 'vl' : w === 'left' ? 'right' : w === 'right' ? 'left' : w)).join('_');
  // rails: 0 ns, 1 ew, 2 asc_e, 3 asc_w, 4 asc_n, 5 asc_s, 6 se, 7 sw, 8 nw, 9 ne (models.js railModel)
  const ASC_DIR = { 2: 1, 3: 3, 4: 0, 5: 2 }, ASC_SHAPE = { 1: 2, 3: 3, 0: 4, 2: 5 };
  const CURVES = { 6: [2, 1], 7: [2, 3], 8: [0, 3], 9: [0, 1] };
  function railShape(T, v) {
    if (v <= 1) return T.swap ? 1 - v : v;
    if (v <= 5) return ASC_SHAPE[T.f4[ASC_DIR[v]]];
    const c = CURVES[v]; if (!c) return v;
    const a = T.f4[c[0]], b = T.f4[c[1]];
    for (const k in CURVES) { const d = CURVES[k]; if ((d[0] === a && d[1] === b) || (d[0] === b && d[1] === a)) return +k; }
    return v;
  }
  // a face bit mask (vines, lichen …): 1 north, 2 east, 4 south, 8 west move with the transform; 16 up, 32 down stay
  function faceMask(T, m) {
    let out = m & ~15;
    for (let f = 0; f < 4; f++) if (m & (1 << f)) out |= 1 << T.f4[f];
    return out;
  }
  // a 16-step rotation (signs: 0 north, 4 east, 8 south, 12 west, clockwise)
  M.rot16 = function (t, r) {
    const T = tr(t); if (!T) return r;
    const k = 4 * T.f4[0];
    return T.det > 0 ? (r + k) % 16 : ((k - r) % 16 + 16) % 16;
  };
  // the mirrored state of one cell (a state the registry has; anything the table does not know keeps its value)
  M.state = function (t, s) {
    const T = tr(t); if (!T || T.id || !s) return s;
    const type = R.types[R.T.type[s]]; if (!type) return s;
    let out = s;
    for (const p of type.props) {
      const v = Math.floor((s - type.base) / p.mul) % p.n, val = p.values[v];
      let nv = v;
      switch (p.name) {
        case 'facing': { const f = HF.indexOf(val); if (f >= 0) nv = p.values.indexOf(HF[T.f4[f]]); break; }
        case 'axis': if (T.swap && (val === 'x' || val === 'z')) nv = p.values.indexOf(val === 'x' ? 'z' : 'x'); break;
        case 'rotation': if (p.n === 16) nv = M.rot16(T, v); break;
        case 'faces': nv = p.values.indexOf(faceMask(T, val)); break;
        case 'face': if (typeof val === 'number' && p.n === 5 && v > 0) nv = 1 + T.f4[v - 1]; break;   // torches: 0 floor, 1..4 the wall facing
        case 'attach': if (p.n === 5 && v > 0) { const d = T.f4[v % 4]; nv = d === 0 ? 4 : d; } break;   // stems: 1..4 east, south, west, north
        case 'shape': if (type.o.kind === 'rail') { const k = railShape(T, v); nv = k < p.n ? k : v; } break;
        default: if (T.det < 0 && typeof val === 'string') { const w = swapHand(val); if (w !== val) { const k = p.values.indexOf(w); if (k >= 0) nv = k; } }
      }
      if (nv >= 0 && nv !== v) out += (nv - v) * p.mul;
    }
    return out;
  };

  // ---- pieces: the cells of one action ({x, y, z, state}: a block, a door's two halves, a bed, a VM model)
  const vmOf = (type) => (type && type.has('part') && type.has('facing') && VR.VM && VR.VM.MODELS && VR.VM.MODELS[type.name]) || null;
  M.group = function (t, c2x, c2z, cells) {
    const T = tr(t), out = [];
    if (!T || !cells || !cells.length) return out;
    const s0 = cells[0].state, type = R.types[R.T.type[s0]], m = vmOf(type);
    if (m && T.det < 0 && cells.length === m.parts.length && cells.every(c => R.T.type[c.state] === type.id)) {
      // a VM model in a mirror: the same model with the mirrored facing, re-anchored on the mirrored cells' bounding box
      // (exactly the mirrored cells for a left/right-symmetric model; a valid model on the same box otherwise)
      const f2 = T.f4[type.get(s0, 'facing') & 3], fp = VR.VM.footprint(m, f2);
      let x0 = Infinity, y0 = Infinity, z0 = Infinity, a0 = Infinity, b0 = Infinity, e0 = Infinity;
      for (const c of cells) { const p = M.pos(T, c2x, c2z, c.x, c.z); x0 = Math.min(x0, p[0]); y0 = Math.min(y0, c.y); z0 = Math.min(z0, p[1]); }
      for (const o of fp) { a0 = Math.min(a0, o[0]); b0 = Math.min(b0, o[1]); e0 = Math.min(e0, o[2]); }
      const byPart = new Map(); for (const c of cells) byPart.set(type.get(c.state, 'part'), c.state);
      for (const [dx, dy, dz, i] of fp) {
        const src = byPart.has(i) ? byPart.get(i) : s0;
        out.push({ x: x0 - a0 + dx, y: y0 - b0 + dy, z: z0 - e0 + dz, state: type.with(type.with(M.state(T, src), 'facing', f2), 'part', i) });
      }
      return out;
    }
    for (const c of cells) { const p = M.pos(T, c2x, c2z, c.x, c.z); out.push({ x: p[0], y: c.y, z: p[1], state: M.state(T, c.state) }); }
    return out;
  };
  const keyOf = (g) => g.map(c => c.x + ',' + c.y + ',' + c.z).sort().join(';');
  // every copy of one action for a mode: a list of pieces (each the cells of one copy); a copy that lands exactly on the
  // original or on an earlier copy is left out (a block on the axis mirrors onto itself)
  M.copies = function (mode, c2x, c2z, cells) {
    const out = []; if (!cells || !cells.length) return out;
    const c = M.center(mode, c2x, c2z), seen = new Set([keyOf(cells)]);
    for (const t of SETS[mode] || []) { const g = M.group(t, c[0], c[1], cells), k = keyOf(g); if (!g.length || seen.has(k)) continue; seen.add(k); out.push(g); }
    return out;
  };

  // ---- the axis guide: per mirror line a wide faint strip and a thin bright one on the ground, and an upright plane;
  // triangles (x, y, z) relative to the centre point (c2x / 2, ground, c2z / 2), written into `out` (no allocation)
  const LEN = M.GUIDE_LEN = 20, H = M.GUIDE_H = 12, HALO = 0.34, CORE = 0.07, LIFT = 0.035;
  M.GUIDE_FLOATS = 4 * 3 * 6 * 3;
  const DIRS = { x: [0, 1], z: [1, 0], d: [Math.SQRT1_2, Math.SQRT1_2], a: [Math.SQRT1_2, -Math.SQRT1_2] };
  const vtx = (out, i, x, y, z) => { out[i] = x; out[i + 1] = y; out[i + 2] = z; return i + 3; };
  // two triangles a b c, a c d
  function quad(out, i, ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz) {
    i = vtx(out, i, ax, ay, az); i = vtx(out, i, bx, by, bz); i = vtx(out, i, cx, cy, cz);
    i = vtx(out, i, ax, ay, az); i = vtx(out, i, cx, cy, cz); return vtx(out, i, dx, dy, dz);
  }
  function strip(out, i, L, w) {
    const d = DIRS[L], nx = -d[1] * w / 2, nz = d[0] * w / 2, ex = d[0] * LEN, ez = d[1] * LEN;
    return quad(out, i, -ex + nx, LIFT, -ez + nz, -ex - nx, LIFT, -ez - nz, ex - nx, LIFT, ez - nz, ex + nx, LIFT, ez + nz);
  }
  // returns res: lines, and [first vertex, vertex count] of the halo strips, the core strips and the planes
  M.guide = function (mode, out, res) {
    const lines = M.lines(mode), n = lines.length;
    let i = 0;
    for (let k = 0; k < n; k++) i = strip(out, i, lines[k], HALO);
    for (let k = 0; k < n; k++) i = strip(out, i, lines[k], CORE);
    for (let k = 0; k < n; k++) { const d = DIRS[lines[k]], ex = d[0] * LEN, ez = d[1] * LEN; i = quad(out, i, -ex, 0, -ez, -ex, H, -ez, ex, H, ez, ex, 0, ez); }
    res.lines = n; res.halo = [0, 6 * n]; res.core = [6 * n, 6 * n]; res.plane = [12 * n, 6 * n];
    return res;
  };
})(VR);
