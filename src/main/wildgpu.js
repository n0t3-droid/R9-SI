// ============================================================================
// Die Tierwelt on the GPU (t-wild, WOW VI; docs/superpowers/plans/2026-10-16-t-wild.md): the small creatures and the sky
// rays drawn instanced — ONE drawArraysInstanced per kind in view (the whole murmuration is one draw). The creatures'
// own program (WILD_VS / WILD_FS): per instance its place (camera-relative) and size, its heading, pitch and bank, the
// beat's phase and amplitude, a wave that runs out along the wings (the rays' slow undulation), a rest angle (a sitting
// butterfly's half-open wings), the body's bend (a fish's tail), its tint, the sky light where it is, a glow (the rays'
// lines) and a glint (the sun mirrored on a fish's flank, a gull's back); the vox program's light (soft wrap, sky and
// ground, a rim; t-light2's defines as the vox program gets them), the fog. Two-sided (thin wings): no culling, the back
// face's normal turned. The meshes are procedural and our own, built once in JS (in blocks, the span or the length 1;
// the models face −z): a starling-like bird, a gull with dark wing tips, a fish (the bend weight from the head to the tail),
// a carp, a butterfly (fore- and hindwings), a dragonfly (four narrow wings), and the Himmelsrochen — a smooth lofted
// manta of our own design: a broad diamond wing whose leading edge sweeps back to the tips, two short forward lobes, a
// whip tail, a deep indigo-teal back with luminous chevron lines, a pale underside.
// Compiled on first use (never on Very Low: nothing calls it there); the program lives in renderer.P (rebuilt with it).
// VR.WildGPU: STRIDE · KINDS · kind(gl, name) · draw(r, E, list) · mesh(name) (the raw vertices, node-tested)
// ============================================================================
(function (VR) {
  'use strict';
  const WG = VR.WildGPU = VR.WildGPU || {};
  const TAU = Math.PI * 2;
  // an instance: 20 floats — i_p (x, y, z relative to the camera, scale) · i_a (yaw, pitch, bank, phase) · i_c (tint r, g,
  // b, sky light 0–1) · i_x (amplitude, wave, rest angle, bend) · i_y (glow, glint, the glow's hue, 0)
  WG.STRIDE = 20;
  const VS = 11;   // a vertex: pos 3, normal 3, colour 3 + the wing/bend weight, the emission

  // ---------------------------------------------------------------- the meshes
  function Builder() { this.v = []; }
  Builder.prototype.vert = function (p, n, c, w, em) { this.v.push(p[0], p[1], p[2], n[0], n[1], n[2], c[0], c[1], c[2], w, em || 0); };
  // a flat triangle (its face normal); per corner [x, y, z, w, em] and a colour per corner (or one for all)
  Builder.prototype.tri = function (a, b, c, ca, cb, cc) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const n = [nx, ny, nz];
    this.vert(a, n, ca, a[3] || 0, a[4] || 0); this.vert(b, n, cb || ca, b[3] || 0, b[4] || 0); this.vert(c, n, cc || ca, c[3] || 0, c[4] || 0);
  };
  Builder.prototype.quad = function (a, b, c, d, ca, cb, cc, cd) { this.tri(a, b, c, ca, cb, cc); this.tri(a, c, d, ca, cc || ca, cd || ca); };
  const lin = (c) => c.map(v => Math.pow(v, 2.2));   // (sRGB → linear: the shader lights linear colours, as the vox program)
  const mirror = (p) => [-p[0], p[1], p[2], p[3], p[4]];

  // a bird: span 1 (x ±0.5), the body 0.46 long (beak −z); wing weight 0.6 at the root → 1 at the tip (a rigid hinge
  // that bends a little toward the tip)
  function bird(gull) {
    const B = new Builder();
    const body = lin(gull ? [0.95, 0.95, 0.96] : [0.10, 0.10, 0.12]), back = lin(gull ? [0.88, 0.89, 0.92] : [0.13, 0.12, 0.15]), beak = lin(gull ? [0.96, 0.78, 0.25] : [0.55, 0.45, 0.18]);
    const wing = lin(gull ? [0.70, 0.73, 0.78] : [0.12, 0.11, 0.14]), tip = lin(gull ? [0.08, 0.08, 0.09] : [0.07, 0.07, 0.08]), under = lin(gull ? [0.9, 0.9, 0.92] : [0.16, 0.15, 0.17]);
    const N = [0, 0, -0.25], T = [0, 0.012, 0.17], U = [0, 0.055, -0.03], D = [0, -0.045, -0.02], L = [-0.055, 0.005, -0.03], R = [0.055, 0.005, -0.03];
    B.tri(N, U, R, beak, back, back); B.tri(N, L, U, beak, back, back); B.tri(N, R, D, beak, under, under); B.tri(N, D, L, beak, under, under);
    B.tri(T, R, U, back); B.tri(T, U, L, back); B.tri(T, D, R, under); B.tri(T, L, D, under);
    // the tail: a small fan
    B.tri([-0.045, 0.01, 0.15], [0.045, 0.01, 0.15], [0, 0.012, 0.28], gull ? body : back);
    B.tri([-0.045, 0.01, 0.15], [0, 0.012, 0.28], [-0.07, 0.01, 0.26], gull ? body : back); B.tri([0.045, 0.01, 0.15], [0.07, 0.01, 0.26], [0, 0.012, 0.28], gull ? body : back);
    // the wings: a root, a wrist (forward on a gull: the M of its wings), a swept tip
    const rf = [0.04, 0.015, -0.07, 0.6], rb = [0.04, 0.015, 0.07, 0.6];
    const mf = gull ? [0.24, 0.03, -0.06, 0.8] : [0.25, 0.022, -0.045, 0.8], mb = gull ? [0.23, 0.03, 0.05, 0.8] : [0.24, 0.022, 0.075, 0.8];
    const tp = gull ? [0.5, -0.01, 0.12, 1] : [0.5, 0.0, 0.1, 1], tf = gull ? [0.36, 0.01, 0.0, 0.9] : [0.38, 0.01, 0.02, 0.9];
    for (const s of [1, -1]) {
      const m = (p) => (s > 0 ? p : mirror(p));
      B.tri(m(rf), m(mf), m(mb), wing); B.tri(m(rf), m(mb), m(rb), wing);
      B.tri(m(mf), m(tf), m(mb), wing, gull ? tip : wing, wing); B.tri(m(tf), m(tp), m(mb), gull ? tip : tip, tip, wing);
    }
    return B.v;
  }
  // a party of birds — the murmuration's boid drawn as MURM_K small starlings round its place (mode 2): each vertex
  // relative to its own bird (span about 1, the beak −z: a body cross, two wings with a wrist), its bird's place in the
  // party in the normal's slot (the boid's frame: x across the wings, z along the heading, y up — flattened into the
  // sheet), its bird's beat offset in the emission's slot; the shader spreads the party (i_x.w) and lets each bird drift
  // a little in its place. The first bird sits on the boid itself
  function party() {
    const Wd = VR.Wild || {}, K = Wd.MURM_K || 12, RC = Wd.MURM_RC || 3.5, hh = Wd.h || ((a, b, c) => ((Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453) % 1 + 1) % 1);
    const out = [], body = lin([0.09, 0.09, 0.11]), wing = lin([0.11, 0.10, 0.13]), tipC = lin([0.07, 0.07, 0.08]);
    for (let k = 0; k < K; k++) {
      const h = (q) => hh(k, 77, q);
      const o = k ? [(h(1) - 0.5) * 2 * RC, (h(2) - 0.5) * 2 * RC * 0.2, (h(3) - 0.5) * 2 * RC * 0.8] : [0, 0, 0];
      // (f-wild2: the emission's slot carries the bird's number in the party and its beat: k + phase/2π — the shader
      //  draws the first i_y.w birds of a party, the rest is the density cloud's)
      const ph = k + (k ? h(4) * 0.999 : 0), sc = k ? 0.85 + 0.3 * h(5) : 1;
      const V = (p, c, w) => out.push(p[0] * sc, p[1] * sc, p[2] * sc, o[0], o[1], o[2], c[0], c[1], c[2], w, ph);
      const T = (a, b, c, col, w) => { V(a, col, w ? a[3] : 0); V(b, col, w ? b[3] : 0); V(c, col, w ? c[3] : 0); };
      // (six triangles: a speck at a distance needs no more — the body a flat diamond, each wing an inner and an outer)
      const N = [0, 0.01, -0.24], Tl = [0, 0.01, 0.26], L = [-0.06, 0, -0.02], R = [0.06, 0, -0.02];
      T(N, L, Tl, body); T(N, Tl, R, body);
      for (const sd of [1, -1]) {
        const rf = [0.04 * sd, 0.012, -0.07, 0.6], rb = [0.04 * sd, 0.012, 0.07, 0.6], wr = [0.25 * sd, 0.02, 0.0, 0.8], tp = [0.5 * sd, 0, 0.1, 1];
        T(rf, wr, rb, wing, 1); T(rf, tp, wr, tipC, 1);
      }
    }
    return out;
  }
  // a fish: 1 long (the head at −0.5), 0.26 high, 0.11 wide; the bend weight from 0 (the head) to 1 (the tail fin);
  // a dark back, a silver flank, a pale belly — carp: gold and orange with pale patches
  function fish(carp) {
    const B = new Builder();
    // (f-wild2: a darker blue back — a fish reads against the pale sand from above — and near-white silver flanks that
    //  flash when the fish rolls into a turn)
    const back = lin(carp ? [0.95, 0.45, 0.10] : [0.10, 0.18, 0.30]), flank = lin(carp ? [0.98, 0.62, 0.18] : [0.90, 0.94, 0.98]), belly = lin(carp ? [0.98, 0.92, 0.82] : [0.97, 0.98, 0.99]), fin = lin(carp ? [0.95, 0.55, 0.25] : [0.45, 0.55, 0.68]);
    const patch = lin([0.97, 0.95, 0.9]);
    // the cross-sections: z, half height, half width
    const S = [[-0.5, 0.0, 0.0], [-0.36, 0.09, 0.05], [-0.12, 0.13, 0.055], [0.12, 0.10, 0.042], [0.3, 0.045, 0.02], [0.36, 0.03, 0.012]];
    const bend = (z) => Math.max(0, Math.min(1, (z + 0.25) / 0.75));
    const ring = (s) => { const [z, h, w] = s, b = bend(z); return [[0, h, z, b], [w, h * 0.35, z, b], [w, -h * 0.4, z, b], [0, -h, z, b], [-w, -h * 0.4, z, b], [-w, h * 0.35, z, b]]; };
    const colOf = (k, z, x) => { if (k === 0 || k === 5 || k === 1) { if (carp && Math.sin(z * 23 + x * 40) > 0.55) return patch; return k === 0 ? back : flank; } return k === 3 ? belly : (carp ? flank : flank); };
    for (let i = 0; i < S.length - 1; i++) {
      const A = ring(S[i]), C = ring(S[i + 1]);
      for (let k = 0; k < 6; k++) {
        const k2 = (k + 1) % 6, a = A[k], b = A[k2], c = C[k2], d = C[k];
        const ca = colOf(k, a[2], a[0]), cb = colOf(k2, b[2], b[0]);
        if (i === 0) B.tri(a, c, d, ca, colOf(k2, c[2], c[0]), colOf(k, d[2], d[0]));   // (the nose: one point)
        else B.quad(a, b, c, d, ca, cb, colOf(k2, c[2], c[0]), colOf(k, d[2], d[0]));
      }
    }
    // the tail fin (forked) and a dorsal fin
    B.tri([0, 0.03, 0.34, 1], [0, 0.17, 0.52, 1], [0, 0.02, 0.44, 1], fin); B.tri([0, -0.03, 0.34, 1], [0, -0.02, 0.44, 1], [0, -0.17, 0.52, 1], fin);
    B.tri([0, 0.0, 0.36, 1], [0, 0.02, 0.44, 1], [0, -0.02, 0.44, 1], fin);
    B.tri([0, 0.12, -0.12, bend(-0.12)], [0, 0.2, 0.0, bend(0)], [0, 0.1, 0.08, bend(0.08)], fin);
    return B.v;
  }
  // a butterfly: span 1; fore- and hindwings (the instance's tint is the species' colour: the vertex colours are its
  // pattern — a pale base, dark tips and margins, a light spot), a dark slender body
  function butterfly() {
    const B = new Builder();
    const body = lin([0.12, 0.1, 0.1]), base = [1, 1, 1], edge = [0.18, 0.15, 0.14], spot = [1.35, 1.35, 1.3];
    B.tri([0, 0.015, -0.12], [0.02, 0, 0.0], [-0.02, 0, 0.0], body); B.tri([0.02, 0, 0.0], [0, 0.01, 0.18], [-0.02, 0, 0.0], body);
    B.tri([0, 0.015, -0.12], [-0.02, 0, 0.0], [0, -0.012, 0.02], body); B.tri([0, 0.015, -0.12], [0, -0.012, 0.02], [0.02, 0, 0.0], body);
    for (const s of [1, -1]) {
      const m = (p) => (s > 0 ? p : mirror(p));
      const r0 = [0.02, 0, -0.07, 1], f1 = [0.3, 0.01, -0.2, 1], f2 = [0.5, 0.02, -0.15, 1], f3 = [0.4, 0.01, 0.0, 1], r1 = [0.02, 0, 0.02, 1];
      B.tri(m(r0), m(f1), m(f3), base, edge, base); B.tri(m(f1), m(f2), m(f3), edge, edge, edge); B.tri(m(r0), m(f3), m(r1), base, base, base);
      B.tri(m([0.18, 0.012, -0.1, 1]), m([0.26, 0.012, -0.12, 1]), m([0.24, 0.012, -0.06, 1]), spot);
      const h1 = [0.34, 0, 0.1, 1], h2 = [0.24, 0, 0.27, 1], h3 = [0.06, 0, 0.22, 1];
      B.tri(m(r1), m(f3), m(h1), base, base, base); B.tri(m(r1), m(h1), m(h2), base, base, edge); B.tri(m(r1), m(h2), m(h3), base, edge, base);
    }
    return B.v;
  }
  // a dragonfly: 1 long (the head at −0.18), four narrow pale wings across the thorax, a slender body in the tint's colour
  function dragonfly() {
    const B = new Builder();
    const body = [1, 1, 1], eye = lin([0.15, 0.2, 0.25]), wing = lin([0.86, 0.92, 0.97]);
    B.tri([0, 0.03, -0.18], [0.03, 0, -0.12], [-0.03, 0, -0.12], eye); B.tri([0.03, 0, -0.12], [0, -0.025, -0.14], [-0.03, 0, -0.12], eye);
    for (const [z0, z1, w] of [[-0.12, 0.0, 0.028], [0.0, 0.62, 0.016]]) {
      B.quad([0, w, z0], [w, 0, z0], [w * 0.6, 0, z1], [0, w * 0.6, z1], body); B.quad([-w, 0, z0], [0, w, z0], [0, w * 0.6, z1], [-w * 0.6, 0, z1], body);
      B.quad([w, 0, z0], [0, -w, z0], [0, -w * 0.6, z1], [w * 0.6, 0, z1], body); B.quad([0, -w, z0], [-w, 0, z0], [-w * 0.6, 0, z1], [0, -w * 0.6, z1], body);
    }
    for (const [z, sw] of [[-0.06, 1], [0.02, 0.9]]) for (const s of [1, -1]) {
      const m = (p) => (s > 0 ? p : mirror(p));
      B.quad(m([0.02, 0.02, z - 0.025, 1]), m([0.44 * sw, 0.025, z - 0.04, 1]), m([0.46 * sw, 0.025, z + 0.02, 1]), m([0.02, 0.02, z + 0.03, 1]), wing);
    }
    return B.v;
  }
  // the sky ray (f-wild2, R50-10: "an animal, not a boomerang"), span 1, the head −z — our own design: a body with a
  // hump (12 % of the span thick) and a broad head whose corners carry two short fins that reach forward and curl in
  // and down, small dark eyes at its sides; the wings from the body's edge (s 0) to the tips (s 1) with a convex
  // leading edge that sweeps back, a nearly straight trailing edge, the tips hooked back a little, an airfoil section
  // (thick at the leading edge, thin behind); a slender four-sided tail with a small fin at its root. The back a deep
  // slate blue with two pale crescents on the shoulders; the underside a pale belly, blue-grey out on the wings, dark
  // margins along the edges, five slits each side of the belly; the glow (emission) along the leading edges, softer
  // along the trailing ones, a line down the spine, the tail's tip. The wing weight is s: the shader turns each section
  // of the wing about the body's edge by the wing curve (wildsim.js rayWing) — a slow wave out along the span
  WG.RAY_SHAPE = { NU: 44, NV: 12, body: 0.1 };
  function ray() {
    const B = new Builder(), NU = WG.RAY_SHAPE.NU, NV = WG.RAY_SHAPE.NV, BW = WG.RAY_SHAPE.body;
    const sOf = (x) => Math.max(0, (Math.abs(x) - BW) / (0.5 - BW));
    const hook = (s) => (s > 0.82 ? 0.09 * Math.pow((s - 0.82) / 0.18, 2) : 0);
    const zLe = (x) => { const a = Math.abs(x), s = sOf(x); return a <= BW ? -0.245 + 0.9 * a * a : -0.236 + 0.37 * Math.pow(s, 1.6) + hook(s); };
    const zTe = (x) => { const a = Math.abs(x), s = sOf(x); return a <= BW ? 0.215 + 0.25 * a * a : 0.2175 - 0.075 * s + 0.012 * s * s + hook(s); };
    const thick = (x, v) => {
      const a = Math.abs(x), s = sOf(x), af = 2.6 * Math.sqrt(Math.max(0, v)) * (1 - v);
      const body = Math.max(0, 1 - Math.pow(a / 0.15, 2)) * 0.125 * Math.pow(Math.sin(Math.PI * Math.min(1, v * 1.04)), 0.7);
      return Math.max(body, 0.04 * Math.pow(1 - s, 1.3) * af + 0.003);
    };
    const vAt = (x, z) => (z - zLe(x)) / ((zTe(x) - zLe(x)) || 1e-6);
    const topC = (x, v) => {
      const s = sOf(x), sh = Math.max(0, 1 - Math.abs((s - 0.25) / 0.17)) * Math.max(0, 1 - Math.abs((v - 0.32) / 0.16));
      return lin([0.06 + 0.03 * s + sh * 0.24, 0.11 + 0.06 * s + sh * 0.29, 0.19 + 0.07 * s + sh * 0.3]);
    };
    const botC = (x, v) => {
      const a = Math.abs(x), s = sOf(x), belly = Math.max(0, 1 - a / 0.22), mg = Math.max(v < 0.07 ? 1 - v / 0.07 : 0, v > 0.9 ? (v - 0.9) / 0.1 : 0) * (s > 0 ? 1 : 0.3);
      return lin([(0.46 + 0.34 * belly) * (1 - 0.55 * mg), (0.52 + 0.31 * belly) * (1 - 0.55 * mg), (0.62 + 0.24 * belly) * (1 - 0.5 * mg)]);
    };
    const glowTop = (x, v) => { const a = Math.abs(x), s = sOf(x); return (s > 0.04 && v < 0.09 ? 1 - v / 0.09 * 0.6 : 0) + (s > 0.3 && v > 0.93 ? 0.55 : 0) + (a < 0.018 && v > 0.12 && v < 0.88 ? 0.7 : 0); };
    const glowBot = (x, v) => { const s = sOf(x); return s > 0.04 && v < 0.07 ? 0.85 - v / 0.07 * 0.5 : 0; };
    const P = (i, j, top) => { const x = (-1 + 2 * i / NU) * 0.5, v = Math.pow(j / NV, 1.25), z = zLe(x) + (zTe(x) - zLe(x)) * v, t = thick(x, v); return [x, top ? t * 0.6 : -t * 0.4, z, sOf(x), top ? glowTop(x, v) : glowBot(x, v), v]; };
    // two surfaces on one (NU+1) × (NV+1) grid, with smooth normals
    for (const top of [true, false]) {
      const G = [], Nn = [];
      for (let i = 0; i <= NU; i++) { G.push([]); Nn.push([]); for (let j = 0; j <= NV; j++) { G[i].push(P(i, j, top)); Nn[i].push([0, 0, 0]); } }
      const face = (a, b, c) => { const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]; return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]; };
      const add = (n, f) => { n[0] += f[0]; n[1] += f[1]; n[2] += f[2]; };
      const tris = [];
      for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
        const q = top ? [[i, j], [i, j + 1], [i + 1, j + 1], [i, j], [i + 1, j + 1], [i + 1, j]] : [[i, j], [i + 1, j + 1], [i, j + 1], [i, j], [i + 1, j], [i + 1, j + 1]];
        for (let t = 0; t < 6; t += 3) { const f = face(G[q[t][0]][q[t][1]], G[q[t + 1][0]][q[t + 1][1]], G[q[t + 2][0]][q[t + 2][1]]); for (let k = 0; k < 3; k++) add(Nn[q[t + k][0]][q[t + k][1]], f); tris.push(q[t], q[t + 1], q[t + 2]); }
      }
      for (const [i, j] of tris) {
        const p = G[i][j], n = Nn[i][j], l = Math.hypot(n[0], n[1], n[2]) || 1;
        B.vert(p, [n[0] / l, n[1] / l, n[2] / l], top ? topC(p[0], p[5]) : botC(p[0], p[5]), p[3], p[4]);
      }
    }
    const glow = lin([0.4, 0.95, 1.0]);
    for (const sd of [1, -1]) {
      const m = (p) => (sd > 0 ? p : mirror(p));
      // the head's fins: a curled strip forward from each corner, darker outside, pale inside, a glow at the tip
      const fin = lin([0.08, 0.13, 0.22]), finIn = lin([0.55, 0.6, 0.68]), F = [[0.095, 0.012, -0.236], [0.099, 0.0, -0.272], [0.091, -0.013, -0.305], [0.075, -0.027, -0.332]];
      for (let k = 0; k < 3; k++) {
        const a = F[k], b = F[k + 1], w0 = 0.024 * (1 - k / 3.4), w1 = 0.024 * (1 - (k + 1) / 3.4), e = k === 2 ? 0.6 : 0;
        B.quad(m([a[0] - w0, a[1] + w0 * 0.3, a[2], 0, 0]), m([a[0] + w0 * 0.2, a[1] - w0 * 0.6, a[2], 0, 0]), m([b[0] + w1 * 0.2, b[1] - w1 * 0.6, b[2], 0, e]), m([b[0] - w1, b[1] + w1 * 0.3, b[2], 0, e]), fin, finIn, finIn, fin);
      }
      // the eyes: small dark diamonds on the head's sides
      const eye = lin([0.02, 0.02, 0.03]), ez = -0.212, ey = thick(0.1, vAt(0.1, ez)) * 0.6 + 0.003;
      B.tri(m([0.1, ey, ez - 0.012]), m([0.1, ey, ez + 0.012]), m([0.113, ey - 0.004, ez]), eye); B.tri(m([0.1, ey, ez - 0.012]), m([0.087, ey + 0.002, ez]), m([0.1, ey, ez + 0.012]), eye);
      // five slits each side of the belly (a shade darker than the belly)
      const slit = lin([0.36, 0.40, 0.46]), yb = (x, z) => -thick(x, vAt(x, z)) * 0.4 - 0.002;
      for (let k = 0; k < 5; k++) {
        const z = -0.165 + k * 0.026, x0 = 0.05, x1 = 0.098;
        B.quad(m([x0, yb(x0, z), z]), m([x1, yb(x1, z + 0.012), z + 0.012]), m([x1, yb(x1, z + 0.018), z + 0.018]), m([x0, yb(x0, z + 0.006), z + 0.006]), slit);
      }
    }
    // the tail: a slender four-sided rod from the body's rear to 0.8, a small fin at its root, its tip glowing
    const tailC = lin([0.07, 0.10, 0.17]), tailB = lin([0.5, 0.55, 0.62]), SG = 8;
    for (let k = 0; k < SG; k++) {
      const z0 = 0.2 + k * 0.075, z1 = z0 + 0.075, w0 = 0.024 * (1 - k / SG) + 0.004, w1 = 0.024 * (1 - (k + 1) / SG) + 0.004, y0 = 0.005 - k * 0.002, y1 = y0 - 0.002, e = k === SG - 1 ? 1 : 0;
      B.quad([-w0, y0 + w0, z0], [w0, y0 + w0, z0], [w1, y1 + w1, z1, 0, e], [-w1, y1 + w1, z1, 0, e], tailC, tailC, e ? glow : tailC, e ? glow : tailC);
      B.quad([w0, y0 + w0, z0], [w0, y0 - w0, z0], [w1, y1 - w1, z1, 0, e], [w1, y1 + w1, z1, 0, e], tailC);
      B.quad([w0, y0 - w0, z0], [-w0, y0 - w0, z0], [-w1, y1 - w1, z1, 0, e], [w1, y1 - w1, z1, 0, e], tailB);
      B.quad([-w0, y0 - w0, z0], [-w0, y0 + w0, z0], [-w1, y1 + w1, z1, 0, e], [-w1, y1 - w1, z1, 0, e], tailC);
    }
    B.tri([0, 0.032, 0.2], [0, 0.068, 0.245], [0, 0.03, 0.31], tailC);
    return B.v;
  }
  // an impostor of the density cloud (mode 3): a quad whose corners the shader turns to the camera
  // (f-wild2 cost: an octagon inscribed in the cut disc, not a quad round it — SwiftShader fills every pixel of the
  //  quad, the discarded corners too; the octagon is 0.71 of the quad's area)
  function puff() {
    const v = [], c = (k) => [Math.cos((k + 0.5) * Math.PI / 4), Math.sin((k + 0.5) * Math.PI / 4)];
    for (let k = 1; k < 7; k++) for (const [x, y] of [c(0), c(k), c(k + 1)]) v.push(x, y, 0, 0, 0, 1, 0, 0, 0, 0, 0);
    return v;
  }
  // the kinds: mode 0 wings (a hinge on the body's axis, the wave out along them), 1 swim (the body bends side to side),
  // 2 a party of birds (the wings' hinge per bird, the party spread round the boid, the first i_y.w birds drawn as
  // dashes), 3 the density cloud's impostors (blended, the translucent pass), 4 the sky ray (the wing curve)
  WG.KINDS = {
    bird: { make: () => bird(false), mode: 0 },
    flock: { make: party, mode: 2, fog: 1 },
    gull: { make: () => bird(true), mode: 0 },
    fish: { make: () => fish(false), mode: 1 },
    carp: { make: () => fish(true), mode: 1 },
    bfly: { make: butterfly, mode: 0 },
    dfly: { make: dragonfly, mode: 0, pale: 1 },
    ray: { make: ray, mode: 4, under: 1 },
    puff: { make: puff, mode: 3, fog: 1, blend: 1 },
  };
  WG.mesh = (name) => WG.KINDS[name].make();

  // ---------------------------------------------------------------- the program
  // (f-wild2: the impostor's cut radius and the ray's wing pivot, as GLSL literals)
  const PCUT = (VR.Wild && VR.Wild.PUFF ? VR.Wild.PUFF.cut : 1.6), CUT = PCUT.toFixed(3), CUT2 = (PCUT * PCUT).toFixed(3), PIVOT = WG.RAY_SHAPE.body.toFixed(3);
  const WILD_VS = `
layout(location=0) in vec3 a_pos;
layout(location=1) in vec3 a_nrm;
layout(location=2) in vec4 a_col;   // rgb (linear), a: the wing's (or the body's bend) weight
layout(location=3) in float a_em;   // the emission (the rays' lines); a party's bird: its number + its beat / 2π
layout(location=4) in vec4 i_p;     // x, y, z relative to the camera, scale
layout(location=5) in vec4 i_a;     // yaw, pitch, bank, phase
layout(location=6) in vec4 i_c;     // tint rgb, sky light (an impostor: its optical depth)
layout(location=7) in vec4 i_x;     // amplitude, wave, rest angle, bend
layout(location=8) in vec4 i_y;     // glow (a fish: its flash), glint, the glow's hue, the party's birds drawn
uniform mat4 u_viewProj;
uniform int u_mode;
uniform float u_pale;               // 1: the wings keep their own pale colour (a dragonfly's), not the tint
uniform float u_time;               // (COMMON's: the parties' birds drift round their places)
uniform float u_pxk;                // (f-wild2) pixels per block at a distance of one block: a dash never thinner than ~1.3 px
out vec3 v_n;
out vec3 v_col;
out vec3 v_rel;
out float v_em;
out vec2 v_q;                       // an impostor's place on its disc
flat out vec4 v_l;                  // sky, glow, glint, the glow's hue (0 cyan … 1 violet); an impostor: 1, its depth
void main() {
  vec3 p = a_pos, n = a_nrm;
  float w = a_col.a, em = a_em;
  v_q = vec2(0.0);
  if (u_mode == 3) {
    // f-wild2 · an impostor of the density cloud: a disc of radius i_p.w (cut at ${CUT}) turned to the camera
    vec3 c = i_p.xyz, f = normalize(c), up0 = abs(f.y) > 0.95 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
    vec3 rt = normalize(cross(f, up0)), up = cross(rt, f), rel = c + (rt * a_pos.x + up * a_pos.y) * i_p.w * ${CUT};
    v_q = a_pos.xy * ${CUT}; v_rel = rel; v_n = -f; v_col = i_c.rgb; v_em = 0.0; v_l = vec4(1.0, i_c.w, 0.0, 0.0);
    gl_Position = u_viewProj * vec4(rel, 1.0);
    return;
  }
  if (u_mode == 2) {
    // a party of birds: this vertex's bird (its number in the party a_em's whole part) is drawn when it is among the
    // first i_y.w (the rest of the party is the density cloud's); it beats fract(a_em) of a beat later than the boid,
    // sits at a_nrm in the party (spread i_x.w: 1 in the sky, small on the perch) and drifts a little round its place
    float kb = floor(a_em + 0.001), vis = clamp(i_y.w - kb, 0.0, 1.0);
    if (vis <= 0.0) { v_n = n; v_col = vec3(0.0); v_rel = vec3(0.0); v_em = 0.0; v_l = vec4(0.0); gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
    float ph = i_a.w + fract(a_em) * 6.2832;
    n = vec3(0.0, 1.0, 0.0);
    if (w > 0.0) {
      float side = p.x < 0.0 ? -1.0 : 1.0;
      float ang = side * (i_x.z * w + i_x.x * w * sin(ph));
      float c = cos(ang), s = sin(ang);
      p.xy = vec2(p.x * c - p.y * s, p.x * s + p.y * c);
      n.xy = vec2(-s, c);
    }
    // the dash: the wing's chord and the body's width never thinner than ~1.3 px where it is (a bird at 60–160 blocks
    // a short dark stroke that flickers as it beats, not a lost sliver)
    float px = u_pxk / max(length(i_p.xyz), 0.1), kz = clamp(1.3 / max(px * 0.14 * i_p.w, 1e-3), 1.0, 5.0);
    if (w > 0.0) p.z = (p.z - 0.01) * kz + 0.01; else p.x *= kz;
    p *= vis;
    float dr = u_time * 1.1 + kb * 3.0 + fract(a_em) * 7.0;
    // (the party's places in blocks, whatever the birds' size: the scale below multiplies them back)
    p += (a_nrm + vec3(sin(dr), 0.3 * sin(dr * 1.3 + 1.0), cos(dr * 0.8)) * 0.35) * i_x.w / max(i_p.w, 0.05);
    em = 0.0;
  } else if (u_mode == 0) {
    if (w > 0.0) {
      // the wing about the body's long axis: the beat (and its wave out along the span) and the rest angle, mirrored
      float side = p.x < 0.0 ? -1.0 : 1.0, span = abs(p.x);
      float ang = side * (i_x.z * w + i_x.x * w * sin(i_a.w - span * i_x.y));
      float c = cos(ang), s = sin(ang);
      p.xy = vec2(p.x * c - p.y * s, p.x * s + p.y * c);
      n.xy = vec2(n.x * c - n.y * s, n.x * s + n.y * c);
    }
  } else if (u_mode == 4) {
    // f-wild2 · the sky ray: each section of the wing (s = w, 0 at the body's edge … 1 at the tip) turns about the
    // body's edge by the wing curve (wildsim.js rayWing): rest·s² + A·s^1.4·sin(φ − k·s) — the root still, the tips
    // beating, a slow wave out along the span; the wing curves, it does not hinge
    if (w > 0.0) {
      float side = p.x < 0.0 ? -1.0 : 1.0;
      float ang = side * (i_x.z * w * w + i_x.x * pow(w, 1.4) * sin(i_a.w - i_x.y * w));
      float c = cos(ang), s = sin(ang);
      vec2 q = vec2(p.x - side * ${PIVOT}, p.y);
      p.xy = vec2(q.x * c - q.y * s + side * ${PIVOT}, q.x * s + q.y * c);
      n.xy = vec2(n.x * c - n.y * s, n.x * s + n.y * c);
    }
  } else {
    // the swim: the body bends side to side, more toward the tail (a wave from the head back)
    float b = i_x.w * w * sin(i_a.w + p.z * 5.0);
    p.x += b;
    n.x -= i_x.w * w * 5.0 * cos(i_a.w + p.z * 5.0) * n.z;
  }
  p *= i_p.w;
  // bank (about z), pitch (about x: the nose up), yaw (about y: the models face −z, as entities.js rotY)
  float cb = cos(i_a.z), sb = sin(i_a.z);
  p.xy = vec2(p.x * cb - p.y * sb, p.x * sb + p.y * cb); n.xy = vec2(n.x * cb - n.y * sb, n.x * sb + n.y * cb);
  float cp = cos(i_a.y), sp = sin(i_a.y);
  p.yz = vec2(p.y * cp - p.z * sp, p.y * sp + p.z * cp); n.yz = vec2(n.y * cp - n.z * sp, n.y * sp + n.z * cp);
  float cy = cos(i_a.x), sy = sin(i_a.x);
  p.xz = vec2(p.x * cy + p.z * sy, -p.x * sy + p.z * cy); n.xz = vec2(n.x * cy + n.z * sy, -n.x * sy + n.z * cy);
  vec3 rel = p + i_p.xyz;
  v_rel = rel;
  v_n = n;
  v_col = a_col.rgb * mix(i_c.rgb, vec3(1.0), u_pale * step(0.5, w));
  v_em = em;
  v_l = vec4(i_c.w, i_y.x, i_y.y, i_y.z);
  gl_Position = u_viewProj * vec4(rel, 1.0);
}`;
  const WILD_FS = `
${'__COMMON__'}
in vec3 v_n;
in vec3 v_col;
in vec3 v_rel;
in float v_em;
in vec2 v_q;
flat in vec4 v_l;
uniform int u_mode;
uniform float u_fogK;               // (f-wild2) the share of the distance the air counts (the flock: a dark mass stays dark)
uniform float u_under;              // (f-wild2) the ray's lit underside and its backlit wings
out vec4 o;
void main() {
  if (u_mode == 3) {
    // f-wild2 · an impostor: the optical depth v_l.y at its middle, falling off as e^(−2.2 q²); over the others it
    // blends as 1 − e^(−Στ) (one colour: the order does not matter)
    float q2 = dot(v_q, v_q);
    if (q2 > ${CUT2}) discard;
    float a = 1.0 - exp(-v_l.y * exp(-2.2 * q2));
    if (a < 0.004) discard;
    vec3 c = v_col * (u_ambSky * 0.55 + 0.02);
    c = applyFog(c, v_rel * u_fogK, length(v_rel) * u_fogK);
    o = vec4(c, a);
    return;
  }
  vec3 alb = v_col;
  vec3 n = normalize(v_n);
  if (!gl_FrontFacing) n = -n;
  float sunUp = smoothstep(-0.12, 0.12, u_sunDir.y);
  vec3 L = sunUp > 0.001 ? u_sunDir : u_moonDir;
  vec3 lc = sunUp > 0.001 ? u_sunColor * sunUp : u_moonColor;
  float sk = v_l.x * v_l.x;
  float outdoor = smoothstep(0.5, 0.95, v_l.x);
  float wrapL = max((dot(n, L) + 0.3) / 1.3, 0.0);
  vec3 hemi = mix(u_ambSky * vec3(0.62, 0.56, 0.5), u_ambSky * 1.06, n.y * 0.5 + 0.5);
  vec3 light = hemi * sk + lc * wrapL * outdoor * 0.9 + 0.03;
#ifdef LIGHT2
  hemi = l2Hemi(n) * 1.04; wrapL = l2Wrap(dot(n, L), u_l2K.w);
  light = hemi * sk + lc * wrapL * outdoor * 0.9 + 0.03;
#endif
  vec3 col = alb * light;
  vec3 V = normalize(-v_rel);
  float rim = pow(1.0 - abs(dot(n, V)), 3.0);
  col += (u_skyHorizon * 0.5 + lc * 0.08) * rim * 0.22 * sk * alb;
  if (u_under > 0.0) {
    // f-wild2 · the ray's lit underside: the sky and the water's light from below on its pale belly; its thin wings
    // glow when the sun is behind them
    col += alb * (u_skyHorizon * 0.55 + u_ambSky * 0.35) * max(-n.y, 0.0) * u_under * (0.4 + 0.6 * outdoor);
    col += lc * alb * pow(max(dot(-V, L), 0.0), 4.0) * 0.6 * u_under * outdoor;
  }
  // the glint: the sun (or the moon) mirrored on a flank or a back — a fish flashes as it turns into the light
  col += lc * pow(max(dot(reflect(-L, n), V), 0.0), 18.0) * v_l.z * outdoor;
  // f-wild2 · a fish's flash: its silver flanks light up as it rolls into a turn (the instance's glow slot)
  if (u_mode == 1) col += alb * v_l.y * 2.2 * step(0.45, max(alb.r, max(alb.g, alb.b))) * (0.35 + 0.65 * outdoor);
  // the glow: the rays' lines (brighter at dusk and at night: the instance's glow)
  else col = mix(col, mix(vec3(0.35, 0.95, 1.0), vec3(0.85, 0.55, 1.0), v_l.w) * 1.6, clamp(v_em * v_l.y, 0.0, 1.0));
  col = applyFog(col, v_rel * u_fogK, length(v_rel) * u_fogK);
  o = vec4(col, 1.0);
}`;
  WG.program = function (r) {
    const P = r.P;
    if (P.wild !== undefined) return P.wild;
    const L2 = VR.Light2, defs = L2 && L2.definesFor ? L2.definesFor('vox') : [];   // (the vox program's light and air)
    try { P.wild = VR.GL.program(WILD_VS, WILD_FS.replace("${'__COMMON__'}", VR.SHADERS.COMMON).replace('__COMMON__', VR.SHADERS.COMMON), 'wild', defs); }
    catch (e) { console.error(e); P.wild = null; }
    return P.wild;
  };

  // ---------------------------------------------------------------- the buffers of a kind
  // K = {vao, vbo, ibo, count (vertices), cap (instances), data (Float32Array cap × STRIDE), mode}
  const cache = new Map();
  WG.kind = function (gl, name, cap) {
    let K = cache.get(name);
    if (K && K.gl === gl && K.cap >= cap) return K;
    if (K && K.gl === gl) { gl.deleteBuffer(K.ibo); gl.deleteBuffer(K.vbo); gl.deleteVertexArray(K.vao); }
    const def = WG.KINDS[name], verts = new Float32Array(def.make());
    K = { gl, name, mode: def.mode, pale: def.pale || 0, fog: def.fog || 0, under: def.under || 0, blend: def.blend || 0, count: verts.length / VS, cap: Math.max(8, cap | 0), vao: gl.createVertexArray(), vbo: gl.createBuffer(), ibo: gl.createBuffer() };
    K.data = new Float32Array(K.cap * WG.STRIDE);
    gl.bindVertexArray(K.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, K.vbo); gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    const F4 = 4;
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, VS * F4, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, VS * F4, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, VS * F4, 24);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, VS * F4, 40);
    gl.bindBuffer(gl.ARRAY_BUFFER, K.ibo); gl.bufferData(gl.ARRAY_BUFFER, K.data.byteLength, gl.DYNAMIC_DRAW);
    for (let a = 0; a < 5; a++) { gl.enableVertexAttribArray(4 + a); gl.vertexAttribPointer(4 + a, 4, gl.FLOAT, false, WG.STRIDE * F4, a * 16); gl.vertexAttribDivisor(4 + a, 1); }
    gl.bindVertexArray(null);
    cache.set(name, K);
    return K;
  };
  WG.clear = function (gl) { for (const K of cache.values()) if (K.gl === gl) { gl.deleteBuffer(K.ibo); gl.deleteBuffer(K.vbo); gl.deleteVertexArray(K.vao); } cache.clear(); };
  // write instance i of a kind's data: pos relative to the camera, scale; yaw, pitch, bank, phase; tint, sky; amplitude,
  // wave, rest, bend; glow, glint
  WG.put = function (D, i, x, y, z, s, yaw, pitch, bank, ph, r, g, b, sky, amp, wave, rest, bend, glow, glint, hue) {
    const o = i * WG.STRIDE;
    D[o] = x; D[o + 1] = y; D[o + 2] = z; D[o + 3] = s;
    D[o + 4] = yaw; D[o + 5] = pitch; D[o + 6] = bank; D[o + 7] = ph % 6283.1853;
    D[o + 8] = r; D[o + 9] = g; D[o + 10] = b; D[o + 11] = sky;
    D[o + 12] = amp; D[o + 13] = wave; D[o + 14] = rest; D[o + 15] = bend;
    D[o + 16] = glow; D[o + 17] = glint; D[o + 18] = hue || 0; D[o + 19] = 0;
  };
  // the draws of a frame: list = [[K, n], …] (n instances written in K.data); one instanced draw each. → draws made.
  // (f-wild2: a blended kind — the density cloud's impostors — draws without writing the depth, over what is there)
  WG.draw = function (r, E, list) {
    let p = null, draws = 0, blend = false;
    const gl = r.gl, Wd = VR.Wild, fogK = Wd && Wd.PUFF ? Wd.PUFF.fog : 1;
    for (const [K, n] of list) {
      if (!K || !(n > 0)) continue;
      if (!p) {
        p = WG.program(r); if (!p) return 0;
        gl.useProgram(p.p); r.common(p, E);
        gl.uniformMatrix4fv(p.u.u_viewProj, false, r.viewProj);
        // (pixels per block at a distance of one: the projection's focal length in the frame's pixels)
        if (p.u.u_pxk) gl.uniform1f(p.u.u_pxk, (r.proj ? r.proj[5] : 1.4) * (r.h || 720) * 0.5);
        gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
      }
      if (!!K.blend !== blend) {
        blend = !!K.blend;
        if (blend) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); } else { gl.disable(gl.BLEND); gl.depthMask(true); }
      }
      gl.uniform1i(p.u.u_mode, K.mode); gl.uniform1f(p.u.u_pale, K.pale);
      if (p.u.u_fogK) gl.uniform1f(p.u.u_fogK, K.fog ? fogK : 1);
      if (p.u.u_under) gl.uniform1f(p.u.u_under, K.under || 0);
      gl.bindVertexArray(K.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, K.ibo); gl.bufferSubData(gl.ARRAY_BUFFER, 0, K.data, 0, n * WG.STRIDE);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, K.count, n);
      draws++;
      if (r.stats) { r.stats.draws++; r.stats.tris += K.count / 3 * n; }
    }
    if (p) { gl.bindVertexArray(null); gl.enable(gl.CULL_FACE); if (blend) { gl.disable(gl.BLEND); gl.depthMask(true); } }
    return draws;
  };
  void TAU;
})(VR);
