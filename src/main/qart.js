// ============================================================================
// q-art · Bildregie (review docs/reviews/q-art.md, plan docs/superpowers/plans/2026-11-06-q-art.md): the three things
// that made the first minutes look cheap, fixed with our own procedural work — Balanced and up; Very Low and Low as
// before (no define, no program, no pass, the same sky values).
// Pure (no GL): the switches and their defaults per preset, the settings rows, the defines by program, the GLSL, the
// sky's colour script (env.js calls QA.skyScript) and the JS mirrors the node test checks (test/qart.js). The GL side is
// qart_gl.js (the programs' key). This file loads before shaders.js (build.js MAIN).
//   qLeaf   Laubkronen: the leaves as clumped masses — a world-space field of rounded leaf clumps gives every leaf face a
//           volume normal (light to dark across the crown, darker inside a clump, warm on the lit side, cool in the shade),
//           a rim and the sun through the leaves from behind; the corners of every leaf face cut along a ragged,
//           texel-snapped edge, so the crown's outline breaks into clusters. Shader only (the cut-out terrain): the mesh,
//           the saved blocks, the generator as they were. Needs fancy leaves (the inner faces show through the cuts).
//                                                                             (Q_LEAF: terrain, terrainCut, terrainCutZ)
//   qSky    Farbdrehbuch: a colour script for the day — a warm haze at the horizon, a clear blue that is blue (not violet),
//           a deep blue top, the space and the nebula only faintly high up; the sky's fill light and the far haze in the
//           same palette. Values only (no shader, no cost).                                           (env.js)
//   qPlaza  Platzbelag: the light plaza floors (top faces of the floor blocks in PLAZA) brought down to a warm stone
//           mid-tone, the slabs varied in tone, soft wear and darker joints — the people on it become the subject.
//                                                                             (Q_PLAZA: terrain)
// ============================================================================
(function (VR) {
  'use strict';
  const QA = VR.QArt = VR.QArt || {};
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const sstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  const fract = (x) => x - Math.floor(x);
  const mix = (a, b, t) => a + (b - a) * t;
  const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

  // ---------------------------------------------------------------- the switches
  QA.SW = ['qLeaf', 'qSky', 'qPlaza'];
  const OFF = { qLeaf: false, qSky: false, qPlaza: false };
  const ON = { qLeaf: true, qSky: true, qPlaza: true };
  const TIERS = { potato: OFF, low: OFF, balanced: ON, high: ON, ultra: ON, ultraLite: ON };
  QA.defaults = (preset) => Object.assign({}, TIERS[preset] || OFF);
  QA.off = () => Object.assign({}, OFF);
  QA.ROWS = [
    { key: 'qLeaf', g: 'img', sec: 'light', t: 'switch', lab: 'g.set.qLeaf', tip: 'g.set.qLeaf.tip', cost: 'low', def: false },
    { key: 'qSky', g: 'img', sec: 'light', t: 'switch', lab: 'g.set.qSky', tip: 'g.set.qSky.tip', cost: 'low', def: false },
    { key: 'qPlaza', g: 'img', sec: 'light', t: 'switch', lab: 'g.set.qPlaza', tip: 'g.set.qPlaza.tip', cost: 'low', def: false },
  ];
  // the programs' key (qart_gl.js rebuilds them when it changes); fancy: the leaves' inner faces are meshed
  QA.key = (q, fancy) => (q ? [q.qLeaf && fancy !== false ? 1 : 0, q.qSky ? 1 : 0, q.qPlaza ? 1 : 0] : [0, 0, 0]).join('');
  QA.q = OFF; QA.fancy = true;
  QA.use = function (q, fancy) { QA.q = q || OFF; if (fancy !== undefined) QA.fancy = fancy !== false; return QA.q; };

  // ---------------------------------------------------------------- Laubkronen: the numbers
  //   cell   the clump lattice (blocks; y × 0.85) · rad the clumps' radius (× 0.8 … 1.2 by clump) · k the blend's softness
  //   inR    the signed distances over which a fragment goes from the clump's skin to its inside (the field's median ~0)
//   nrm    how much of the volume normal the leaf face takes (0 the flat face) · inner the light deep in a clump ×
  //   sky    the sky's light inside the crown lifted this far toward the open sky (the inner faces the cuts show: a deep
  //          green, not black — browser run 1: black crosses in the cherry's crown)
  //   corner the corners' cut radius (blocks) · cutP the share of the face corners cut (each block's corner on its own:
  //          run 1 cut all four round a grid vertex — a '+' hole in every flat wall) · rag the share of ragged rim texels
  //   far    the cut fades out between these distances (m; texels under a pixel would shimmer)
  QA.LEAF = { cell: 3.2, rad: 1.5, k: 3.5, nrm: 0.85, inner: 0.55, inR: [0.1, -0.7], sky: 0.45, corner: [0.22, 0.44], cutP: 0.55, rag: 0.18, far: [64, 110] };
  // the hash (shaders.js hash13, the same arithmetic)
  const hash13 = (x, y, z) => {
    let a = fract(x * 0.1031), b = fract(y * 0.1031), c = fract(z * 0.1031);
    const s = a * (c + 31.32) + b * (b + 31.32) + c * (a + 31.32);
    a += s; b += s; c += s;
    return fract((a + b) * c);
  };
  QA.hash13 = hash13;
  // the clump field at p (world): [nx, ny, nz, signed distance] — the normal of the blended clumps, negative inside
  QA.clump = function (p) {
    const L = QA.LEAF, s = [L.cell, L.cell * 0.85, L.cell], b = [0, 1, 2].map(i => Math.floor(p[i] / s[i] - 0.5));
    let acc = 0; const nn = [0, 0, 0];
    for (let i = 0; i < 8; i++) {
      const c = [b[0] + (i & 1), b[1] + ((i >> 1) & 1), b[2] + ((i >> 2) & 1)];
      const h = [hash13(c[0], c[1], c[2]), hash13(c[0] + 17, c[1] + 31, c[2] + 47), hash13(c[0] + 59, c[1] + 13, c[2] + 71)];
      const d = [0, 1, 2].map(k => p[k] - (c[k] + 0.5 + (h[k] - 0.5) * 0.6) * s[k]);
      const l = Math.hypot(d[0], d[1], d[2]) + 1e-4, sd = l - L.rad * (0.8 + 0.4 * h[0]), w = Math.exp(-L.k * sd);
      acc += w; for (let k = 0; k < 3; k++) nn[k] += w * d[k] / l;
    }
    nn[1] += 0.15 * acc;
    const nl = Math.hypot(nn[0], nn[1], nn[2]) || 1;
    return [nn[0] / nl, nn[1] / nl, nn[2] / nl, -Math.log(acc) / L.k];
  };
  // how green a leaf colour is (0 … 1): the cut and the hue's shift only on green crowns — blossom, autumn and frosted
  // leaves keep their colour and their blocks (browser run 2: the cherry's pink went beige, the cuts showed its dark inside)
  QA.green = (c) => clamp((c[1] - Math.max(c[0], c[2])) / Math.max(c[1], 1e-3) * 6, 0, 1);
  // the in-plane coordinates of a face (face 0/1 ±x, 2/3 ±y, 4/5 ±z): [u, v, the plane]
  QA.plane = (w, face) => (face <= 1 ? [w[1], w[2], w[0]] : face <= 3 ? [w[2], w[0], w[1]] : [w[0], w[1], w[2]]);
  // is the leaf face's fragment at world w cut away? (dist: from the eye, m)
  QA.cut = function (w, face, dist) {
    const L = QA.LEAF, pp = QA.plane(w, face), pl = Math.floor(pp[2] + 0.5);
    const tq = [Math.floor(pp[0] * 16), Math.floor(pp[1] * 16)];
    const f = [(tq[0] + 0.5) / 16 - Math.floor(pp[0]), (tq[1] + 0.5) / 16 - Math.floor(pp[1])];   // the texel's centre in the block
    const g = [Math.floor(pp[0] + 0.5) - Math.floor(pp[0]), Math.floor(pp[1] + 0.5) - Math.floor(pp[1])];   // the nearest corner (0 or 1)
    const dd = [Math.abs(f[0] - g[0]), Math.abs(f[1] - g[1])];
    const fade = 1 - sstep(L.far[0], L.far[1], dist);
    const hv = hash13(Math.floor(pp[0]) + g[0] * 0.5 + 0.13, Math.floor(pp[1]) + g[1] * 0.5 + 0.29, pl);   // this block's corner
    const r = hv < L.cutP ? mix(L.corner[0], L.corner[1], hv / L.cutP) * fade : 0;
    const n = hash13(tq[0] + 0.5, tq[1] + 0.5, pl * 1.37 + 0.11);
    if (r <= 0) return false;
    if (dd[0] < r && dd[1] < r && Math.hypot(r - dd[0], r - dd[1]) > r * (0.7 + 0.6 * n)) return true;   // the rounded, ragged corner
    return Math.min(dd[0], dd[1]) < 1 / 16 && n > 1 - L.rag * fade && Math.max(dd[0], dd[1]) < 0.5 - 1 / 16;   // a leaf missing on the rim
  };

  // ---------------------------------------------------------------- Platzbelag: the numbers and the floors
  //   knee  the albedo's luma above which it is compressed · keep its share kept above the knee
  //   vary  the slabs' tone (±) · wear the mottling (±) · joint the joints' darkening
  QA.PLAZA = { knee: 0.2, keep: 0.25, vary: 0.14, wear: 0.2, joint: 0.5 };   // (run 6: 0.3 / 0.38 / 0.09 / 0.12 / 0.4 read too subtle under the noon sun)
  QA.PLAZA_BLOCKS = ['vx_floor_plaza', 'vx_floor_plaza_line', 'vx_floor_marble', 'vx_floor_checker', 'vx_floor_tile', 'vx_floor_hex', 'travertine', 'granite_paver', 'vollton_white_gloss', 'smooth_quartz', 'polished_andesite'];
  QA.plazaLum = (l) => (l > QA.PLAZA.knee ? QA.PLAZA.knee + (l - QA.PLAZA.knee) * QA.PLAZA.keep : l);
  // the albedo layers of the floors' top faces (the registry's tex table; the main thread has it at start)
  QA.plazaLayers = function () {
    const R = VR.R; if (!R || !R.T || !R.T.tex || !R.byName) return [];
    const out = new Set();
    for (const n of QA.PLAZA_BLOCKS) {
      const t = R.byName[n]; if (!t) continue;
      for (let id = t.base, n = Math.min(t.nstates | 0, 16); id < t.base + n; id++) { const L = R.T.tex[id * 6 + 2]; if (L !== undefined && L >= 0) out.add(L & 4095); }
    }
    return [...out].sort((a, b) => a - b).slice(0, 24);
  };
  // the voxel blocks' shared surfaces (voxarch.js: every vx block — the plaza's vx_floor_plaza among them — is drawn from
  // these few layers, its colour per voxel in the tint; browser run 2's probe: the plaza is a VOXEL block, its block
  // layer never drawn): only their top faces at a block's full height count as floor (QA.vxFloor)
  QA.PLAZA_VX = ['vx_tile', 'vx_tile_gloss', 'vx_smooth', 'vx_smooth_gloss', 'vx_mat_marble', 'vx_mat_stone'];
  QA.plazaVxLayers = function () {
    const R = VR.R; if (!R || !R.texIndex) return [];
    return QA.PLAZA_VX.map(n => R.texIndex[n]).filter(l => l > 0).sort((a, b) => a - b);
  };
  // a voxel top face at world height y is a floor when it lies on the block grid (a full block's top, not a table's)
  QA.vxFloor = (y) => Math.abs(y - Math.round(y)) < 0.01;

  // ---------------------------------------------------------------- Farbdrehbuch: the day's colour script
  // linear HDR before the exposure, as env.js's VR.Sky: hor (the horizon's haze), mid (the blue), zen (the top);
  // stops [h1, h2a, h2b, halo]; space [from, to, day share, the nebula by day]; amb the sky's fill light; fog the far
  // haze between hor and mid (classic_v2: hor 0.62 and fog 0.22 washed the Klassisch block grid out at 10–13 blocks —
  // the haze a shade darker and bluer: hor 0.57, fog 0.5 — 3 of 4 rows again). The day only: the golden hour, the dusk and the night keep t-sky3's / f-sky4's palette.
  QA.SKY = {
    hor: [0.57, 0.585, 0.56], mid: [0.12, 0.27, 0.56], zen: [0.04, 0.105, 0.33], stops: [0.34, 0.28, 0.88, 0.22],
    space: [0.6, 1.0, 0.3, 0.22], amb: [0.42, 0.45, 0.56], fog: 0.5,
  };
  // the share of the day palette at the sun's height sy (as env.js's wDay) and the weather's hold (rain: the grey wins)
  QA.dayW = (sy) => sstep(0.03, 0.2, sy);
  // env.js (the overworld, after its own sky): pulls E's sky toward the script by the day's share; nothing at night
  QA.skyScript = function (E, sy, rain, dark) {
    const S = QA.SKY, k = QA.dayW(sy) * (1 - clamp(rain || 0, 0, 1) * 0.85) * (1 - clamp(dark || 0, 0, 1) * 0.6);
    if (!(k > 0.001)) return E;
    E.horizon = mix3(E.horizon, S.hor, k); E.skyMid = mix3(E.skyMid, S.mid, k); E.zenith = mix3(E.zenith, S.zen, k);
    if (E.skyStops) E.skyStops = E.skyStops.map((v, i) => mix(v, S.stops[i], k));
    if (E.skySpace) E.skySpace = E.skySpace.map((v, i) => mix(v, S.space[i], k));
    if (E.ambSky) { const l0 = E.ambSky[0] * 0.3 + E.ambSky[1] * 0.59 + E.ambSky[2] * 0.11, l1 = S.amb[0] * 0.3 + S.amb[1] * 0.59 + S.amb[2] * 0.11; E.ambSky = mix3(E.ambSky, S.amb.map(v => v * l0 / l1), k); }   // (the hue, not the level)
    if (E.fogColor) E.fogColor = mix3(E.fogColor, mix3(S.hor, S.mid, S.fog), k);
    return E;
  };

  // ---------------------------------------------------------------- the defines, by program
  const LEAF_PROGS = { terrain: 1, terrainCut: 1, terrainCutZ: 1 };
  const f3 = (x) => x.toFixed(3);
  QA.definesFor = function (name, q, fancy) {
    q = q || QA.q; if (fancy === undefined) fancy = QA.fancy;
    const out = [];
    if (q.qLeaf && fancy && LEAF_PROGS[name]) {
      const L = QA.LEAF;
      out.push('Q_LEAF', 'Q_CELL ' + f3(L.cell), 'Q_RAD ' + f3(L.rad), 'Q_K ' + f3(L.k), 'Q_LEAF_N ' + f3(L.nrm), 'Q_LEAF_IN ' + f3(L.inner), 'Q_LEAF_SKY ' + f3(L.sky));
    }
    if (q.qPlaza && name === 'terrain') {
      // (the floors' layers as a macro made when the program is built: the registry's tex table is not there yet when
      //  shaders.js makes its text at load)
      const lay = QA.plazaLayers(), vx = QA.plazaVxLayers(), or = (a) => (a.length ? a.map(x => 'l == ' + x.toFixed(1)).join(' || ') : 'false');
      out.push('Q_PLAZA', 'Q_PLAZA_L(l) (' + or(lay) + ')', 'Q_PLAZA_V(l) (' + or(vx) + ')');
    }
    return out;
  };
  QA.hook = function (name, defines) {
    const extra = QA.definesFor(name);
    if (!extra.length) return defines || [];
    return (defines || []).concat(extra.filter(d => !(defines || []).includes(d)));
  };
  if (VR.GL) { const prev = VR.GL.defineHook || null; VR.GL.defineHook = (name, defines) => QA.hook(name, prev ? prev(name, defines) : (defines || [])); }

  // the vertex side (TERRAIN_VS, before its main): the clump field per vertex — it varies over metres, the faces are one
  // (browser run 5: per fragment it cost Balanced a fifth of its frame on SwiftShader, the fancy leaves' inner faces
  // shading it again and again)
  QA.glslVS = function () {
    return `
#if defined(Q_LEAF) && !defined(MODEL)
// q-art · Laubkronen (qart.js QA.clump)
out vec4 v_qC;
float qH13(vec3 p3) { p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
// the clump field: xyz the blended clumps' normal, w the signed distance (negative inside)
vec4 qClump(vec3 p) {
  vec3 s = vec3(Q_CELL, Q_CELL * 0.85, Q_CELL), b = floor(p / s - 0.5), nn = vec3(0.0);
  float acc = 0.0;
  for (int i = 0; i < 8; i++) {
    vec3 c = b + vec3(float(i & 1), float((i >> 1) & 1), float((i >> 2) & 1));
    vec3 h = vec3(qH13(c), qH13(c + vec3(17.0, 31.0, 47.0)), qH13(c + vec3(59.0, 13.0, 71.0)));
    vec3 d = p - (c + 0.5 + (h - 0.5) * 0.6) * s;
    float l = length(d) + 1e-4, w = exp(-Q_K * (l - Q_RAD * (0.8 + 0.4 * h.x)));
    acc += w; nn += d * (w / l);
  }
  return vec4(normalize(nn + vec3(0.0, 0.15 * acc, 0.0)), -log(acc) / Q_K);
}
#endif
`;
  };
  // ---------------------------------------------------------------- the GLSL (TERRAIN_FS, before its main)
  QA.glslTerrain = function () {
    const L = QA.LEAF, P = QA.PLAZA;
    return `
#if defined(Q_LEAF) && !defined(MODEL)
// q-art · Laubkronen (qart.js QA.clump, QA.cut): a waving leaf face (the leaf bit, no sway level, no glass frame)
float qGreen(vec3 c) { return clamp((c.g - max(c.r, c.b)) / max(c.g, 1e-3) * 6.0, 0.0, 1.0); }
bool qLeafF() { return ((v_w5 >> 7u) & 1u) == 1u && ((v_w5 >> 5u) & 3u) == 0u && ((v_w5 >> 14u) & 1u) == 0u; }
in vec4 v_qC;   // the clump field at the vertices (glslVS)
// the leaf face's corners cut along a ragged, texel-snapped rim (the same on both sides of a shared face)
bool qCut(vec3 w, uint face, float dist) {
  vec3 pp = face <= 1u ? w.yzx : face <= 3u ? w.zxy : w.xyz;
  float pl = floor(pp.z + 0.5);
#ifdef Q_CROWN
  // q-art2 · Fernkronen (qart2.js Q2.cutFar): beyond ~40 m the corners on a 4-texel grid, larger and rounder, to ~260 m
  vec2 bl = floor(pp.xy);
  float QS = dist > 40.0 + 12.0 * hash13(vec3(bl, pl + 0.7)) ? 4.0 : 16.0;
  vec2 tq = floor(pp.xy * QS);
  vec2 f = (tq + 0.5) / QS - bl, g = floor(pp.xy + 0.5) - bl, dd = abs(f - g);
  float fade = 1.0 - smoothstep(200.0, 260.0, dist);
  float hv = hash13(vec3(bl + g * 0.5 + vec2(0.13, 0.29), pl));
  float r = hv < ${f3(L.cutP)} ? mix(${f3(L.corner[0])}, ${f3(L.corner[1])}, hv / ${f3(L.cutP)}) * fade * (QS < 8.0 ? 1.35 : 1.0) : 0.0;
  float n = hash13(vec3(tq + 0.5, pl * 1.37 + 0.11));
  if (r <= 0.0) return false;
  if (dd.x < r && dd.y < r && length(vec2(r) - dd) > r * (QS < 8.0 ? 0.55 + 0.5 * n : 0.7 + 0.6 * n)) return true;
  return QS > 8.0 && min(dd.x, dd.y) < 1.0 / QS && n > 1.0 - ${f3(L.rag)} * fade && max(dd.x, dd.y) < 0.5 - 1.0 / QS;
#else
  vec2 tq = floor(pp.xy * 16.0), bl = floor(pp.xy);
  vec2 f = (tq + 0.5) / 16.0 - bl, g = floor(pp.xy + 0.5) - bl, dd = abs(f - g);
  float fade = 1.0 - smoothstep(${L.far[0].toFixed(1)}, ${L.far[1].toFixed(1)}, dist);
  float hv = hash13(vec3(bl + g * 0.5 + vec2(0.13, 0.29), pl));
  float r = hv < ${f3(L.cutP)} ? mix(${f3(L.corner[0])}, ${f3(L.corner[1])}, hv / ${f3(L.cutP)}) * fade : 0.0;
  float n = hash13(vec3(tq + 0.5, pl * 1.37 + 0.11));
  if (r <= 0.0) return false;
  if (dd.x < r && dd.y < r && length(vec2(r) - dd) > r * (0.7 + 0.6 * n)) return true;
  return min(dd.x, dd.y) < 0.0625 && n > 1.0 - ${f3(L.rag)} * fade && max(dd.x, dd.y) < 0.4375;
#endif
}
#ifdef Q_CROWN
// q-art2 · Fernkronen (qart2.js Q2.carve): far away an outer leaf face (open to the sky) outside the clumps is carved away —
// the crown's outline breaks into rounded masses instead of a cube; the inner faces behind it fill the notch
bool qCarve(float sd, float dist, float sky) { float f = smoothstep(${f3(VR.QArt2 ? VR.QArt2.CROWN.carve[0] : 30)}, ${f3(VR.QArt2 ? VR.QArt2.CROWN.carve[1] : 55)}, dist); return f > 0.0 && sky > 0.97 && sd > mix(4.0, ${f3(VR.QArt2 ? VR.QArt2.CROWN.carveT : 0.25)}, f); }
#endif
// the crown's light: deep in a clump its own shade, the hue with the value (warm light, cool shade), the rim and the sun
// through the leaves from behind
vec3 qCanopy(vec3 col, vec3 alb, vec4 c, vec3 V, vec3 L, vec3 sun, vec3 amb) {
  float inner = smoothstep(${f3(QA.LEAF.inR[0])}, ${f3(QA.LEAF.inR[1])}, c.w);
#ifdef Q_CROWN
  // q-art2 · Fernkronen: a blossom or autumn crown (now cut too) lighter inside — petals pass the light; a soft glow of its
  // own colour from the sun through it
  float qNg = 1.0 - qGreen(alb);
  col *= mix(1.0, mix(Q_LEAF_IN, 0.86, qNg), inner);
  col += alb * sun * 0.16 * qNg * inner;
  col = max(col, alb * (u_ambSky * 0.65 + u_sunColor * (0.12 * max(u_sunDir.y, 0.0))) * qNg);   // (run 1: the cut showed the cherry's inner faces near black)
#else
  col *= mix(1.0, Q_LEAF_IN, inner);
#endif
  float lit = clamp(dot(c.xyz, L) * 0.5 + 0.5, 0.0, 1.0);
  col *= mix(0.83, 1.06, lit) * mix(vec3(1.0), mix(vec3(0.89, 1.01, 1.14), vec3(1.06, 1.01, 0.87), lit), qGreen(alb));
  float rim = 1.0 - clamp(dot(c.xyz, V), 0.0, 1.0); rim = rim * rim * rim;
  float back = clamp(dot(-V, L), 0.0, 1.0); back *= back; back *= back;
  col += alb * sun * vec3(1.0, 1.0, 0.55) * (rim * 0.35 + back * 0.45 * (1.0 - inner));
  col += alb * amb * rim * 0.25;
  return col;
}
#endif
#if defined(Q_PLAZA) && !defined(MODEL)
// q-art · Platzbelag (qart.js QA.plazaLum): the light floors to a warm stone mid-tone, slabs, wear, joints
bool qPlazaL(float l, float y) { return Q_PLAZA_L(l) || (Q_PLAZA_V(l) && abs(y - floor(y + 0.5)) < 0.01); }
vec3 qPlaza(vec3 a, vec3 w) {
  float l = dot(a, vec3(0.2126, 0.7152, 0.0722)) + 1e-4;
  float lt = l > ${f3(P.knee)} ? ${f3(P.knee)} + (l - ${f3(P.knee)}) * ${f3(P.keep)} : l;
  float h = hash13(vec3(floor(w.xz), 7.0));
  vec2 f = fract(w.xz), e = min(f, 1.0 - f);
  float joint = 1.0 - smoothstep(0.012, 0.05, min(e.x, e.y));
  float mott = texture(u_noise, w.xz * 0.043).r * 0.6 + texture(u_noise, w.xz * 0.19 + vec2(0.31, 0.77)).g * 0.4;
  vec3 c = a * (lt / l) * mix(vec3(1.08, 0.99, 0.84), vec3(1.0, 0.97, 0.92), h);
  c *= 1.0 + (h - 0.5) * ${f3(P.vary * 2)};
  c *= 1.0 + (mott - 0.5) * ${f3(P.wear * 2)};
  return c * (1.0 - ${f3(P.joint)} * joint);
}
#endif
`;
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
