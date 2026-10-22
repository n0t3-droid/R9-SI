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
      const ph = k ? h(4) * TAU : 0, sc = k ? 0.85 + 0.3 * h(5) : 1;
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
    const back = lin(carp ? [0.95, 0.45, 0.10] : [0.20, 0.28, 0.36]), flank = lin(carp ? [0.98, 0.62, 0.18] : [0.78, 0.84, 0.90]), belly = lin(carp ? [0.98, 0.92, 0.82] : [0.94, 0.95, 0.96]), fin = lin(carp ? [0.95, 0.55, 0.25] : [0.55, 0.62, 0.70]);
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
  // the Himmelsrochen: a smooth lofted manta, span 1 — u ∈ [−1, 1] across (x = u/2), v ∈ [0, 1] along the chord from the
  // leading edge (it sweeps back to the tips) to the trailing edge (forward to the tips); thickness a smooth bulge;
  // the back deep indigo-teal with glowing chevron lines (emission), the underside pale; two short lobes in front and a
  // whip tail. The wing weight |u|^1.15 (0 on the body, 1 at the tips): the wave runs out along it
  WG.RAY_SHAPE = { NU: 36, NV: 10 };
  function ray() {
    const B = new Builder(), NU = WG.RAY_SHAPE.NU, NV = WG.RAY_SHAPE.NV;
    const zf = (u) => -0.2 + 0.27 * Math.pow(Math.abs(u), 1.35), zb = (u) => 0.27 - 0.21 * Math.pow(Math.abs(u), 0.8);
    const th = (u, v) => 0.085 * (1 - Math.pow(Math.abs(u), 1.7)) * Math.pow(Math.sin(Math.PI * v), 0.75) + 0.004;
    const topC = (u, v) => { const k = Math.abs(u); return lin([0.09 + 0.06 * k, 0.13 + 0.16 * k, 0.30 + 0.12 * k + 0.05 * v]); };
    // (the underside a dusky periwinkle, paler at the belly: from below against a bright sky a ray must read as a shape,
    //  not vanish as a white sheet — run 2's afternoon picture)
    const botC = (u, v) => { const k = Math.abs(u), b = Math.max(0, 1 - k * 2.2) * 0.16; return lin([0.34 + b, 0.36 + b, 0.58 + b * 0.6 - 0.03 * v]); };
    // the glowing chevrons: bands across the back that point forward, and a line along the spine
    const glowAt = (u, v) => { const k = Math.abs(u), c = (k * 2.6 + v * 1.4) % 1; return (c < 0.13 && k > 0.12 && k < 0.92 ? 1 : 0) + (k < 0.04 && v > 0.15 && v < 0.85 ? 0.8 : 0); };
    // (the underside: a soft luminous rim along the leading edge — seen from below against the sky, the outline glows)
    const rimAt = (u, v) => { const k = Math.abs(u); return v < 0.05 && k > 0.1 && k < 0.97 ? 0.55 : 0; };
    const P = (u, v, top) => { const x = u * 0.5, z = zf(u) + (zb(u) - zf(u)) * v, t = th(u, v); return [x, top ? t * 0.62 : -t * 0.38, z, Math.pow(Math.abs(u), 1.15), top ? glowAt(u, v) : rimAt(u, v)]; };
    // two surfaces on one (NU+1) × (NV+1) grid, with smooth normals
    for (const top of [true, false]) {
      const G = [], Nn = [];
      for (let i = 0; i <= NU; i++) { G.push([]); Nn.push([]); for (let j = 0; j <= NV; j++) { G[i].push(P(-1 + 2 * i / NU, j / NV, top)); Nn[i].push([0, 0, 0]); } }
      const face = (a, b, c) => { const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2]; return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]; };
      const add = (n, f) => { n[0] += f[0]; n[1] += f[1]; n[2] += f[2]; };
      const tris = [];
      for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) {
        // (top: wound so the normal points up; the underside the other way)
        const q = top ? [[i, j], [i, j + 1], [i + 1, j + 1], [i, j], [i + 1, j + 1], [i + 1, j]] : [[i, j], [i + 1, j + 1], [i, j + 1], [i, j], [i + 1, j], [i + 1, j + 1]];
        for (let t = 0; t < 6; t += 3) { const f = face(G[q[t][0]][q[t][1]], G[q[t + 1][0]][q[t + 1][1]], G[q[t + 2][0]][q[t + 2][1]]); for (let k = 0; k < 3; k++) add(Nn[q[t + k][0]][q[t + k][1]], f); tris.push(q[t], q[t + 1], q[t + 2]); }
      }
      for (const [i, j] of tris) {
        const p = G[i][j], n = Nn[i][j], l = Math.hypot(n[0], n[1], n[2]) || 1, u = -1 + 2 * i / NU, v = j / NV;
        B.vert(p, [n[0] / l, n[1] / l, n[2] / l], top ? topC(u, v) : botC(u, v), p[3], p[4]);
      }
    }
    // the lobes (two short forward horns, glowing at their tips) and the whip tail (a thin ribbon, a glow at its end)
    const lobe = lin([0.12, 0.2, 0.36]), glow = lin([0.4, 0.95, 1.0]);
    for (const s of [1, -1]) {
      const m = (p) => (s > 0 ? p : mirror(p));
      B.tri(m([0.03, 0.02, -0.19, 0]), m([0.075, 0.015, -0.185, 0.04]), m([0.06, 0.008, -0.275, 0.03, 1]), lobe, lobe, glow);
      B.tri(m([0.03, 0.02, -0.19, 0]), m([0.06, 0.008, -0.275, 0.03, 1]), m([0.035, 0.0, -0.2, 0]), lobe, glow, lobe);
    }
    const tailC = lin([0.1, 0.14, 0.26]);
    for (let k = 0; k < 6; k++) {
      const z0 = 0.25 + k * 0.1, z1 = z0 + 0.1, w0 = 0.03 * (1 - k / 6) + 0.006, w1 = 0.03 * (1 - (k + 1) / 6) + 0.006, e1 = k === 5 ? 1 : 0;   // (wide enough to stay a line, not dots, at a distance)
      B.quad([-w0, 0.006, z0, 0], [w0, 0.006, z0, 0], [w1, 0.004, z1, 0, e1], [-w1, 0.004, z1, 0, e1], tailC, tailC, e1 ? glow : tailC, e1 ? glow : tailC);
    }
    return B.v;
  }
  // the kinds: mode 0 wings (a hinge on the body's axis, the wave out along them), 1 swim (the body bends side to side),
  // 2 a party of birds (the wings' hinge per bird, the party spread round the boid)
  WG.KINDS = {
    bird: { make: () => bird(false), mode: 0 },
    flock: { make: party, mode: 2 },
    gull: { make: () => bird(true), mode: 0 },
    fish: { make: () => fish(false), mode: 1 },
    carp: { make: () => fish(true), mode: 1 },
    bfly: { make: butterfly, mode: 0 },
    dfly: { make: dragonfly, mode: 0, pale: 1 },
    ray: { make: ray, mode: 0 },
  };
  WG.mesh = (name) => WG.KINDS[name].make();

  // ---------------------------------------------------------------- the program
  const WILD_VS = `
layout(location=0) in vec3 a_pos;
layout(location=1) in vec3 a_nrm;
layout(location=2) in vec4 a_col;   // rgb (linear), a: the wing's (or the body's bend) weight
layout(location=3) in float a_em;   // the emission (the rays' lines)
layout(location=4) in vec4 i_p;     // x, y, z relative to the camera, scale
layout(location=5) in vec4 i_a;     // yaw, pitch, bank, phase
layout(location=6) in vec4 i_c;     // tint rgb, sky light
layout(location=7) in vec4 i_x;     // amplitude, wave, rest angle, bend
layout(location=8) in vec4 i_y;     // glow, glint
uniform mat4 u_viewProj;
uniform int u_mode;
uniform float u_pale;               // 1: the wings keep their own pale colour (a dragonfly's), not the tint
uniform float u_time;               // (COMMON's: the parties' birds drift round their places)
out vec3 v_n;
out vec3 v_col;
out vec3 v_rel;
out float v_em;
flat out vec4 v_l;                  // sky, glow, glint, the glow's hue (0 cyan … 1 violet)
void main() {
  vec3 p = a_pos, n = a_nrm;
  float w = a_col.a, em = a_em;
  if (u_mode == 2) {
    // a party of birds: this vertex's bird beats a_em later than the boid, sits at a_nrm in the party (spread i_x.w: 1 in
    // the sky, small on the perch) and drifts a little round its place
    float ph = i_a.w + a_em;
    n = vec3(0.0, 1.0, 0.0);
    if (w > 0.0) {
      float side = p.x < 0.0 ? -1.0 : 1.0;
      float ang = side * (i_x.z * w + i_x.x * w * sin(ph));
      float c = cos(ang), s = sin(ang);
      p.xy = vec2(p.x * c - p.y * s, p.x * s + p.y * c);
      n.xy = vec2(-s, c);
    }
    float dr = u_time * 1.1 + a_em * 3.0;
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
flat in vec4 v_l;
out vec4 o;
void main() {
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
  // the glint: the sun (or the moon) mirrored on a flank or a back — a fish flashes as it turns into the light
  col += lc * pow(max(dot(reflect(-L, n), V), 0.0), 18.0) * v_l.z * outdoor;
  // the glow: the rays' lines (brighter at night: the instance's glow)
  col = mix(col, mix(vec3(0.35, 0.95, 1.0), vec3(0.85, 0.55, 1.0), v_l.w) * 1.6, clamp(v_em * v_l.y, 0.0, 1.0));
  col = applyFog(col, v_rel, length(v_rel));
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
    K = { gl, name, mode: def.mode, pale: def.pale || 0, count: verts.length / VS, cap: Math.max(8, cap | 0), vao: gl.createVertexArray(), vbo: gl.createBuffer(), ibo: gl.createBuffer() };
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
  // the draws of a frame: list = [[K, n], …] (n instances written in K.data); one instanced draw each. → draws made
  WG.draw = function (r, E, list) {
    let p = null, draws = 0;
    for (const [K, n] of list) {
      if (!K || !(n > 0)) continue;
      if (!p) {
        p = WG.program(r); if (!p) return 0;
        const gl = r.gl; gl.useProgram(p.p); r.common(p, E);
        gl.uniformMatrix4fv(p.u.u_viewProj, false, r.viewProj);
        gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
      }
      const gl = r.gl;
      gl.uniform1i(p.u.u_mode, K.mode); gl.uniform1f(p.u.u_pale, K.pale);
      gl.bindVertexArray(K.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, K.ibo); gl.bufferSubData(gl.ARRAY_BUFFER, 0, K.data, 0, n * WG.STRIDE);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, K.count, n);
      draws++;
      if (r.stats) { r.stats.draws++; r.stats.tris += K.count / 3 * n; }
    }
    if (p) { r.gl.bindVertexArray(null); r.gl.enable(r.gl.CULL_FACE); }
    return draws;
  };
  void TAU;
})(VR);
