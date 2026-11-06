// ============================================================================
// q-art2 · Bildregie II (plan docs/superpowers/plans/2026-11-06-q-art2.md; review docs/reviews/q-art.md items 4 and 5,
// q-art's self-review 1 and 2): the next three things that made the frames look cheap — Balanced and up; Very Low and
// Low as before (no define, no program, no pass).
// Pure (no GL): the switches and their defaults per preset, the settings rows, the defines by program, the GLSL, the isles
// near the eye (from the overworld generator's own pure functions) and the JS mirrors the node test checks
// (test/qart2.js). The GL side is qart2_gl.js. This file loads after qart.js, before shaders.js (build.js MAIN).
//   qGrass  Wiese: a green top (the grass) as a meadow — the texel noise calmed toward the texture's mean with distance (no
//           tiling), soft colour patches over metres to tens of metres, and near the eye a parallax blade layer (a short
//           ray march through 11 cm of blade tufts: dark roots, light warm tips that sway in the wind). Never in the
//           Klassisch look.                                                  (Q_GRASS, Q_TUFT_N: terrain)
//   qIsle   Schwebeinseln: the floating isles' rock lit as a rounded mass (a volume normal from the isle's inverted cone,
//           per vertex), strata bands, moss under the rim and in veins, darker toward the tip, the land's green bounce
//           light from below; on the land under an isle its soft shadow along the sun.  (Q_ISLE: terrain, terrainCut)
//   qCrown  Fernkronen: the leaf corners' cut beyond ~40 m on a coarser grid that lasts to ~240 m (q-art's faded at
//           64–110 m: cubes again far away), the cut in the shadow pass (no square shadows), the blossom and autumn
//           crowns cut too with lighter insides.     (Q_CROWN with Q_LEAF: terrain, terrainCut, terrainCutZ; shadowCut)
// ============================================================================
(function (VR) {
  'use strict';
  const Q2 = VR.QArt2 = VR.QArt2 || {};
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const sstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  const fract = (x) => x - Math.floor(x);
  const mix = (a, b, t) => a + (b - a) * t;
  const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

  // ---------------------------------------------------------------- the switches
  Q2.SW = ['qGrass', 'qIsle', 'qCrown'];
  const OFF = { qGrass: false, qIsle: false, qCrown: false };
  const ON = { qGrass: true, qIsle: true, qCrown: true };
  const TIERS = { potato: OFF, low: OFF, balanced: ON, high: ON, ultra: ON, ultraLite: ON };
  Q2.defaults = (preset) => Object.assign({}, TIERS[preset] || OFF);
  Q2.off = () => Object.assign({}, OFF);
  Q2.ROWS = [
    { key: 'qGrass', g: 'img', sec: 'light', t: 'switch', lab: 'g.set.qGrass', tip: 'g.set.qGrass.tip', cost: 'mid', def: false },
    { key: 'qIsle', g: 'img', sec: 'light', t: 'switch', lab: 'g.set.qIsle', tip: 'g.set.qIsle.tip', cost: 'low', def: false },
    { key: 'qCrown', g: 'img', sec: 'light', t: 'switch', lab: 'g.set.qCrown', tip: 'g.set.qCrown.tip', cost: 'low', def: false },
  ];
  // the blade layer's ray-march steps by preset (Balanced the cheaper one; a hand-made preset: Balanced's)
  const STEPS = { potato: 0, low: 0, balanced: 6, high: 8, ultra: 8, ultraLite: 6 };
  Q2.tuftSteps = (preset) => (STEPS[preset] !== undefined ? STEPS[preset] : 4);
  // the programs' key (qart2_gl.js rebuilds them when it changes)
  Q2.key = (q, preset, fancy) => (q ? [q.qGrass ? 1 + Q2.tuftSteps(preset) : 0, q.qIsle ? 1 : 0, q.qCrown && q.qLeaf && fancy !== false ? 1 : 0] : [0, 0, 0]).join('');
  Q2.q = OFF; Q2.o = { fancy: true, leaf: false, preset: 'balanced' };
  Q2.use = function (q, o) { Q2.q = q || OFF; if (o) Q2.o = Object.assign({}, Q2.o, o); return Q2.q; };

  // ---------------------------------------------------------------- Schwebeinseln: the isles near the eye
  Q2.MAX = 8;
  Q2.REACH = 330;   // (m: an isle's rim within this of the eye — its rock in view, its shadow on the land seen)
  // the isles whose rim lies within REACH of the eye: the generator's island lattice (72-block cells) and its designed
  // isles, nearest first, at most MAX
  Q2.islesNear = function (g, cam) {
    if (!g || !g.islandCell || !cam) return [];
    const out = [], C = 72, k = Math.ceil(Q2.REACH / C) + 1, ci = Math.floor(cam[0] / C), cj = Math.floor(cam[2] / C);
    const d = (I) => Math.hypot(I.x - cam[0], I.z - cam[2]) - I.r;
    try {
      if (g.islandAt) g.islandAt(cam[0], cam[2]);   // (its realm noise made first: islandCell reads it — browser run 1 found none)
      // (the designed isles answer only within 220 blocks of their centre: asked round the eye too — browser run 2 stood
      //  316 m from the Heartland's Sky Isles and found none)
      if (g.designedIslands) for (const [ox, oz] of [[0, 0], [200, 0], [-200, 0], [0, 200], [0, -200]]) { const D = g.designedIslands(cam[0] + ox, cam[2] + oz); if (D) for (const I of D) if (d(I) < Q2.REACH && out.indexOf(I) < 0) out.push(I); }
      for (let j = cj - k; j <= cj + k; j++) for (let i = ci - k; i <= ci + k; i++) { const I = g.islandCell(i, j); if (I && d(I) < Q2.REACH && out.indexOf(I) < 0) out.push(I); }
    } catch (e) { return []; }
    out.sort((a, b) => d(a) - d(b));
    return out.slice(0, Q2.MAX);
  };
  // as uniforms: A (x, y, z relative to the camera's block, r), B (deep, dome, 0, 0)
  Q2.pack = function (L, ci, out) {
    const P = out || { A: new Float32Array(4 * Q2.MAX), B: new Float32Array(4 * Q2.MAX), n: 0 };
    P.n = Math.min(L.length, Q2.MAX);
    for (let i = 0; i < P.n; i++) {
      const I = L[i];
      P.A[i * 4] = I.x - ci[0]; P.A[i * 4 + 1] = I.y - ci[1]; P.A[i * 4 + 2] = I.z - ci[2]; P.A[i * 4 + 3] = I.r;
      P.B[i * 4] = I.deep || 1; P.B[i * 4 + 1] = I.dome !== undefined ? I.dome : 3; P.B[i * 4 + 2] = 0; P.B[i * 4 + 3] = 0;
    }
    return P;
  };
  // the underside's normal at p (the mirror of qIsleV): the isle's rounded inverted cone (gen_realm islandShape's
  // bottom = y − 2 − t^0.75·r·deep·jag, the jag's mean ~0.8; flattened at the middle: a round bottom, not a spike),
  // outward and then up at the rim; null beside or above the isle
  Q2.isleNormal = function (I, p) {
    const dx = p[0] - I.x, dz = p[2] - I.z, d = Math.hypot(dx, dz), R = I.r * 1.12, top = I.y - 2, D = I.r * (I.deep || 1) * 0.8;
    if (d > I.r * 1.4 || p[1] > I.y + (I.dome !== undefined ? I.dome : 3) + 1.5 || p[1] < top - D * 1.35 - 2) return null;
    const t = clamp(1 - d / R, 0.02, 1), s = Math.min(0.75 * Math.pow(t, -0.25) * D / R * sstep(0, 0.35, 1 - t), 4);
    const ux = dx / Math.max(d, 1e-3), uz = dz / Math.max(d, 1e-3);
    const nU = norm([ux * s, -1, uz * s]), nR = norm([ux, 0.6, uz]), rim = sstep(top - 1, top + 2, p[1]);
    return norm([mix(nU[0], nR[0], rim), mix(nU[1], nR[1], rim), mix(nU[2], nR[2], rim)]);
  };
  // the sun's light left on the land at p under the isles L (the mirror of qIsleShadow): each isle's disc projected
  // along the sun, soft at its edge, fainter the deeper below; 1 where none falls
  Q2.SHADOW = { k: 0.55, edge: [0.45, 1.05], fall: 220 };
  Q2.isleShadow = function (L, p, sun) {
    if (sun[1] < 0.1) return 1;
    let s = 0;
    for (const I of L) {
      const h = I.y - 3 - p[1]; if (h < 2) continue;
      const qx = p[0] + sun[0] / sun[1] * h - I.x, qz = p[2] + sun[2] / sun[1] * h - I.z, dd = Math.hypot(qx, qz) / (I.r * 0.95);
      s = Math.max(s, (1 - sstep(Q2.SHADOW.edge[0], Q2.SHADOW.edge[1], dd)) * clamp(1.15 - h / Q2.SHADOW.fall, 0.35, 1));
    }
    return 1 - Q2.SHADOW.k * s;
  };

  // ---------------------------------------------------------------- Fernkronen: the far cut (the mirror of qart.js
  // qCut with Q_CROWN): beyond ~40 m (± a block's hash) the corner cut on a 4-texel grid, its corners a fifth larger, no
  // ragged rim (the rounding a little deeper); it fades out at 200–260 m
  Q2.CROWN = { near: 40, far: [200, 260], qs: 4, grow: 1.35, k: [0.55, 0.5], carve: [30, 55], carveT: 0.25 };
  // far away an outer leaf face (sky light ~full) where the clump field (qart.js QA.clump, per vertex) lies outside the
  // clumps by more than carveT is carved (fading in over carve m): the crown's outline in rounded masses (browser run 1:
  // the coarse corner cut alone is a pixel or two at 80 m — the cubes stayed cubes)
  Q2.carve = function (sd, dist, sky) { const f = sstep(Q2.CROWN.carve[0], Q2.CROWN.carve[1], dist); return f > 0 && sky > 0.97 && sd > mix(4, Q2.CROWN.carveT, f); };
  const h13 = (x, y, z) => VR.QArt && VR.QArt.hash13 ? VR.QArt.hash13(x, y, z) : 0.5;
  Q2.cutFar = function (w, face, dist) {
    const L = VR.QArt.LEAF, C = Q2.CROWN, pp = VR.QArt.plane(w, face), pl = Math.floor(pp[2] + 0.5);
    const bl = [Math.floor(pp[0]), Math.floor(pp[1])];
    const QS = dist > C.near + 12 * h13(bl[0], bl[1], pl + 0.7) ? C.qs : 16;
    const fade = 1 - sstep(C.far[0], C.far[1], dist);
    const tq = [Math.floor(pp[0] * QS), Math.floor(pp[1] * QS)];
    const f = [(tq[0] + 0.5) / QS - bl[0], (tq[1] + 0.5) / QS - bl[1]];
    const g = [Math.floor(pp[0] + 0.5) - bl[0], Math.floor(pp[1] + 0.5) - bl[1]];
    const dd = [Math.abs(f[0] - g[0]), Math.abs(f[1] - g[1])];
    const hv = h13(bl[0] + g[0] * 0.5 + 0.13, bl[1] + g[1] * 0.5 + 0.29, pl);
    const r = hv < L.cutP ? mix(L.corner[0], L.corner[1], hv / L.cutP) * fade * (QS < 8 ? C.grow : 1) : 0;
    const n = h13(tq[0] + 0.5, tq[1] + 0.5, pl * 1.37 + 0.11);
    if (r <= 0) return false;
    const k0 = QS < 8 ? C.k[0] : 0.7, k1 = QS < 8 ? C.k[1] : 0.6;
    if (dd[0] < r && dd[1] < r && Math.hypot(r - dd[0], r - dd[1]) > r * (k0 + k1 * n)) return true;
    return QS > 8 && Math.min(dd[0], dd[1]) < 1 / QS && n > 1 - L.rag * fade && Math.max(dd[0], dd[1]) < 0.5 - 1 / QS;
  };
  void fract;

  // ---------------------------------------------------------------- Wiese: the numbers
  //   mean  the blade layer's mean shade (its roots' and tips' mix over a lawn; divided out, so the near grass is not
  //         darker than the far — run 1: it was)
  Q2.GRASS = { mean: 0.9 };   // (a simulation of the march over independent blades: 0.88 with 6 steps, 0.91 with 8)

  // ---------------------------------------------------------------- the defines, by program
  const ISLE_PROGS = { terrain: 1, terrainCut: 1 };
  const CROWN_PROGS = { terrain: 1, terrainCut: 1, terrainCutZ: 1, shadowCut: 1 };
  Q2.definesFor = function (name, q, o) {
    q = q || Q2.q; o = o || Q2.o;
    const out = [];
    if (q.qGrass && name === 'terrain') out.push('Q_GRASS', 'Q_TUFT_N ' + Q2.tuftSteps(o.preset));
    if (q.qIsle && ISLE_PROGS[name]) out.push('Q_ISLE');
    if (q.qCrown && o.fancy !== false && o.leaf && CROWN_PROGS[name]) out.push('Q_CROWN');
    return out;
  };
  Q2.hook = function (name, defines) {
    const extra = Q2.definesFor(name);
    if (!extra.length) return defines || [];
    return (defines || []).concat(extra.filter(d => !(defines || []).includes(d)));
  };
  if (VR.GL) { const prev = VR.GL.defineHook || null; VR.GL.defineHook = (name, defines) => Q2.hook(name, prev ? prev(name, defines) : (defines || [])); }

  // ---------------------------------------------------------------- the GLSL
  const f3 = (x) => x.toFixed(3);
  const ISLE_U = `uniform vec4 u_qIsleA[${Q2.MAX}];   // q-art2 · the isles near the eye: x, y, z relative to the camera's block, r
uniform vec4 u_qIsleB[${Q2.MAX}];   // deep, dome
uniform int u_qIsleN;
`;
  // TERRAIN_VS, before its main
  Q2.glslVS = function () {
    return `
#if defined(Q_ISLE) && !defined(MODEL)
// q-art2 · Schwebeinseln (qart2.js Q2.isleNormal): the isle a vertex belongs to and its rounded underside's normal
${ISLE_U}out vec4 v_qI;   // xyz the volume normal, w the isle's share
out vec2 v_qJ;   // x the depth under the rim (0 … 1 the tip), y blocks under the dome's top
void qIsleV(vec3 p) {
  v_qI = vec4(0.0, -1.0, 0.0, 0.0); v_qJ = vec2(0.0, 99.0);
  for (int i = 0; i < ${Q2.MAX}; i++) {
    if (i >= u_qIsleN) break;
    vec4 A = u_qIsleA[i], B = u_qIsleB[i];
    vec2 d2 = p.xz - A.xz;
    float d = length(d2), R = A.w * 1.12, top = A.y - 2.0, D = A.w * B.x * 0.8;
    if (d > A.w * 1.4 || p.y > A.y + B.y + 1.5 || p.y < top - D * 1.35 - 2.0) continue;
    float t = clamp(1.0 - d / R, 0.02, 1.0), s = min(0.75 * pow(t, -0.25) * D / R * smoothstep(0.0, 0.35, 1.0 - t), 4.0);
    vec2 u = d2 / max(d, 1e-3);
    vec3 nU = normalize(vec3(u.x * s, -1.0, u.y * s)), nR = normalize(vec3(u.x, 0.6, u.y));
    v_qI = vec4(normalize(mix(nU, nR, smoothstep(top - 1.0, top + 2.0, p.y))), 1.0 - smoothstep(A.w * 1.2, A.w * 1.4, d));
    v_qJ = vec2(clamp((top - p.y) / max(D, 1.0), 0.0, 1.0), A.y + B.y - p.y);
    return;
  }
}
#endif
`;
  };
  // TERRAIN_FS, before its main
  Q2.glslTerrain = function () {
    const S = Q2.SHADOW;
    return `
#if defined(Q_GRASS) && !defined(MODEL)
// q-art2 · Wiese: the meadow — calm with distance, patches, and near the eye the blade layer
#ifdef MOTION
#define Q_WIND u_windDir
#else
#define Q_WIND vec2(0.8, 0.6)
#endif
vec3 qGrass(vec3 a, vec3 mean, vec2 q, vec3 rel) {
  float dist = length(rel);
  a = mix(a, mean, 0.3 + 0.45 * smoothstep(5.0, 40.0, dist));   // the texel noise toward the texture's mean (the tiles go)
  // (the noise texture: R fbm of 8 cells, G of 16 a tile, A white — the tiles 128 m, 512 m and 16 m: patches of ~16 m,
  //  ~32 m and ~1 m; every period divides 4096, the camera block's wrap)
  float p1 = texture(u_noise, q * 0.0078125).r, p2 = texture(u_noise, q * 0.001953125 + vec2(0.37, 0.61)).g;
  float pt = smoothstep(0.3, 0.7, p1 * 0.55 + p2 * 0.45);
  a *= mix(vec3(0.78, 0.92, 0.9), vec3(1.15, 1.09, 0.78), pt);   // deep cool green ↔ warm light green
  a *= 1.0 + (texture(u_noise, q * 0.0625 + vec2(0.11, 0.53)).g - 0.5) * 0.35;   // spots of ~a metre
#if Q_TUFT_N > 0
  float k = 1.0 - smoothstep(7.0, 14.0, dist);
  if (k > 0.0) {
    // the blade layer (browser run 1: 4 steps through 2.5 cm blades read as darker noise, not blades): blades of ~4 cm
    // (the white channel, a 10.24 m tile), taller in tufts of ~half a metre (fbm), the ray through 15 cm of them —
    // seen at a slant each blade is drawn as a streak up the screen, its foot dark, its tip light
    vec3 V = normalize(-rel);
    vec2 run = -V.xz / max(V.y, 0.25) * 0.15;
    vec2 sw = Q_WIND * (sin(u_time * 1.4 + q.x * 0.6 + q.y * 0.45) * 0.025 + 0.02);   // the tips lean and sway
    float cl = texture(u_noise, q * 0.125 + 0.5).g;
    float tuft = 0.55 + 0.9 * smoothstep(0.35, 0.7, cl);
    float hh = 0.0, tp = 0.0, dp = 1.0;
    for (int i = 0; i < Q_TUFT_N; i++) {
      float t = (float(i) + 0.5) / float(Q_TUFT_N);   // 0 the tips' layer … 1 the roots
      vec2 s = q + run * t + sw * (1.0 - t) * (1.0 - t);
      float d = smoothstep(0.3, 1.0, texture(u_noise, s * 0.09765625).a) * tuft - (1.0 - t);   // ≥ 0: inside a blade
      if (d >= 0.0) { float u = dp / max(dp - d, 1e-3); hh = 1.0 - mix(tp, t, clamp(u, 0.0, 1.0)); break; }
      tp = t; dp = d;
    }
    vec3 bf = mix(vec3(0.4, 0.47, 0.42), vec3(1.32, 1.27, 1.0), hh) * ${f3(1 / Q2.GRASS.mean)};   // dark roots, light warm tips (the mean kept)
    a = mix(a, a * bf, k);
  }
#endif
  return a;
}
#endif
#if defined(Q_ISLE) && !defined(MODEL)
// q-art2 · Schwebeinseln (qart2.js): the rock as a rounded mass, strata, moss, the tip's shade, the land's bounce; the
// isle's shadow on the land below
${ISLE_U}in vec4 v_qI;
in vec2 v_qJ;
vec3 qIsleAlb(vec3 a, vec3 w) {
  float k = v_qI.w;
  float nz = texture(u_noise, w.xz * 0.031 + vec2(w.y * 0.004, 0.0)).r;
  float band = sin(w.y * 1.7 + nz * 7.0);
  vec3 c = a * (1.0 + 0.14 * band * k) * mix(vec3(1.0), vec3(1.08, 0.97, 0.84), k * smoothstep(0.2, 0.9, band) * 0.8);
  float mv = texture(u_noise, w.xz * 0.02 + vec2(w.y * 0.03, 0.37)).g;   // (veins of ~3 m)
  float moss = (1.0 - smoothstep(1.5, 5.5, v_qJ.y)) * 0.85 + smoothstep(0.6, 0.72, mv) * 0.6;
  float l = dot(c, vec3(0.3, 0.59, 0.11));
  c = mix(c, vec3(0.15, 0.26, 0.07) * (0.6 + l * 1.4), clamp(moss, 0.0, 0.85) * k);
  return c * mix(1.0, 0.8, v_qJ.x * k);   // (run 2: 0.66 with the downward normal made the whole isle a dark lump)
}
float qIsleShadow(vec3 p, vec3 L) {
  if (L.y < 0.1) return 1.0;
  float s = 0.0;
  for (int i = 0; i < ${Q2.MAX}; i++) {
    if (i >= u_qIsleN) break;
    vec4 A = u_qIsleA[i];
    float h = A.y - 3.0 - p.y;
    if (h < 2.0) continue;
    float dd = length(p.xz + L.xz / L.y * h - A.xz) / (A.w * 0.95);
    s = max(s, (1.0 - smoothstep(${f3(S.edge[0])}, ${f3(S.edge[1])}, dd)) * clamp(1.15 - h / ${f3(S.fall)}, 0.35, 1.0));
  }
  return 1.0 - ${f3(S.k)} * s;
}
#endif
`;
  };
  // SHADOW_VS / SHADOW_FS (before their main): the leaf faces' corners cut in the shadow pass too (the coarse cut)
  Q2.glslShadowVS = function () {
    return `
#ifdef Q_CROWN
uniform vec3 u_qCamF;   // q-art2 · Fernkronen: the camera's fraction (the origins are relative to it)
out vec3 v_qW;
#endif
`;
  };
  Q2.glslShadowFS = function () {
    const L = VR.QArt ? VR.QArt.LEAF : { cutP: 0.55, corner: [0.22, 0.44] }, C = Q2.CROWN;
    return `
#if defined(Q_CROWN) && defined(CUTOUT)
uniform ivec3 u_qCamI;   // q-art2 · Fernkronen: the camera's block
in vec3 v_qW;
float qH13s(vec3 p3) { p3 = fract(p3 * .1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
bool qCutS(vec3 w, uint face) {
  vec3 pp = face <= 1u ? w.yzx : face <= 3u ? w.zxy : w.xyz;
  float pl = floor(pp.z + 0.5);
  vec2 bl = floor(pp.xy), tq = floor(pp.xy * ${C.qs.toFixed(1)});
  vec2 f = (tq + 0.5) / ${C.qs.toFixed(1)} - bl, g = floor(pp.xy + 0.5) - bl, dd = abs(f - g);
  float hv = qH13s(vec3(bl + g * 0.5 + vec2(0.13, 0.29), pl));
  float r = hv < ${f3(L.cutP)} ? mix(${f3(L.corner[0])}, ${f3(L.corner[1])}, hv / ${f3(L.cutP)}) * ${f3(C.grow)} : 0.0;
  float n = qH13s(vec3(tq + 0.5, pl * 1.37 + 0.11));
  return r > 0.0 && dd.x < r && dd.y < r && length(vec2(r) - dd) > r * (${f3(C.k[0])} + ${f3(C.k[1])} * n);
}
#endif
`;
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
