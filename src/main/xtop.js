// ============================================================================
// x-top · Spitzenbild (plan docs/superpowers/plans/2026-11-06-x-top.md, review docs/reviews/x-top.md): the three gaps
// between the trailer and the top stylized games that cost the least to close — on High and Ultra only.
// Pure (no GL): the switches and their defaults per preset, the settings rows, the defines by program, the JS mirrors
// the node test checks (test/xtop.js) and the GLSL. The GL side is xtop_gl.js (loaded after look_gl.js); this file loads
// before shaders.js (build.js MAIN).
//   xDepth  Tiefe 0 · 1 · 2: the vertex AO deeper, the contact shadows (light2 l2Ssao) wider and stronger, and a share of
//           them on the sun's light too — feet, trunks, wall bases ground in sunlight            (XDEPTH, terrain)
//   xClar   Klarheit: local contrast from v-look's soft copy (the pixel's luma against its surroundings), near land
//           only — dark anchors, separated planes                                                  (X_CLAR, composite)
//   xBlur   Filmkamera: while a director shot plays, the camera's motion blur at a 180° shutter (the depth, this and
//           the last drawn frame's view-projection, the eye's move)                                (X_BLUR, composite)
//   xRange  Tonumfang (normal play, browser run r1: the High frame spanned only 32…194 of 255, the target stills 14…235):
//           after the grade, in display space, the highlights opened up and by day a soft toe under the darks — the
//           middle kept, nothing clipped; ALU only (no pass, no tap)                               (X_RANGE, composite)
// Very Low and Low: none of them (their programs and passes as before); Balanced: Tonumfang only.
// ============================================================================
(function (VR) {
  'use strict';
  const X = VR.XTop = VR.XTop || {};
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const sstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

  // ---------------------------------------------------------------- the switches
  X.SW = ['xDepth', 'xClar', 'xBlur', 'xRange'];
  X.MAX = { xDepth: 2 };
  const OFF = { xDepth: 0, xClar: false, xBlur: false, xRange: false };
  const TIERS = {
    potato: OFF, low: OFF,
    balanced: { xDepth: 0, xClar: false, xBlur: false, xRange: true },
    high: { xDepth: 1, xClar: true, xBlur: true, xRange: true },
    ultra: { xDepth: 2, xClar: true, xBlur: true, xRange: true },
    ultraLite: { xDepth: 1, xClar: true, xBlur: false, xRange: true },
  };
  X.defaults = (preset) => Object.assign({}, TIERS[preset] || OFF);
  X.off = () => Object.assign({}, OFF);
  X.ROWS = [
    { key: 'xDepth', g: 'img', sec: 'light', t: 'slider', lab: 'g.set.xDepth', tip: 'g.set.xDepth.tip', cost: 'low', def: 0, min: 0, max: 2, step: 1, vals: 'g.set.xDepthV' },
    { key: 'xClar', g: 'img', sec: 'light', t: 'switch', lab: 'g.set.xClar', tip: 'g.set.xClar.tip', cost: 'low', def: false },
    { key: 'xBlur', g: 'img', sec: 'light', t: 'switch', lab: 'g.set.xBlur', tip: 'g.set.xBlur.tip', cost: 'mid', def: false },
    { key: 'xRange', g: 'img', sec: 'light', t: 'switch', lab: 'g.set.xRange', tip: 'g.set.xRange.tip', cost: 'low', def: false },
  ];
  X.key = (q) => (q ? [Math.max(0, Math.min(2, q.xDepth | 0)), q.xClar ? 1 : 0, q.xBlur ? 1 : 0, q.xRange ? 1 : 0] : [0, 0, 0, 0]).join('');
  X.q = OFF;
  X.use = function (q) { X.q = q || OFF; return X.q; };

  // ---------------------------------------------------------------- Tiefe: the numbers by level (index 0 unused)
  //   vao   the vertex AO's step (shaders.js: 0.2 a step before)
  //   sun   the share of the contact shadows on the sun's light (0: never the sun, as before)
  //   rad   the contact shadows' reach × (light2 L2.AO.radius 1.2 blocks)
  //   str   their strength ×
  //   amb   the sky's light in the shade × (a firmer key-to-fill ratio: the shade sides darker, the sun as it was)
  // (browser run 1: 0.35 / 1.15 × hardly changed a frame — the std of the meadow +3 %; doubled)
  X.DEPTH = [null, { vao: 0.25, sun: 0.5, rad: 1.5, str: 1.4, amb: 0.88 }, { vao: 0.28, sun: 0.65, rad: 2.0, str: 1.7, amb: 0.8 }];
  const DEPTH_PROGS = { terrain: 1, terrainCut: 1, terrainCutZ: 1 };
  const f3 = (x) => x.toFixed(3);
  // light2's AO numbers for a Tiefe level (xtop_gl.js swaps them in around the AO pass; made once, never per frame)
  X.aoFor = function (AO, lv) {
    const D = X.DEPTH[lv]; if (!D || !AO) return AO;
    return Object.assign({}, AO, { radius: AO.radius.map(r => r * D.rad), strength: AO.strength.map(s => s * D.str) });
  };
  // the vertex AO's light at a corner's level a (0..3)
  X.vao = (a, lv) => 1 - a * (X.DEPTH[lv] ? X.DEPTH[lv].vao : 0.2);
  // the sun's light at a fragment with contact shadow l2a (1 = open)
  X.sunK = (l2a, lv) => 1 + (l2a - 1) * (X.DEPTH[lv] ? X.DEPTH[lv].sun : 0);

  // ---------------------------------------------------------------- Klarheit
  //   pow   the luma ratio's exponent · lo, hi its clamp · near, far (m) the fade out with distance
  // (browser run 1: 0.35 / 0.74…1.35 was invisible at trailer distance — stronger)
  X.CLAR = { pow: 0.6, lo: 0.6, hi: 1.5, near: 70, far: 160 };
  X.clarK = function (lc, ls, z) {
    const C = X.CLAR, r = clamp(Math.pow((lc + 0.02) / (ls + 0.02), C.pow), C.lo, C.hi);
    return 1 + (r - 1) * (1 - sstep(C.near, C.far, z));
  };

  // ---------------------------------------------------------------- Filmkamera
  //   shutter: a 180° shutter at 24 fps (1/48 s); max: the blur's longest streak (share of the screen)
  X.BLUR = { shutter: 1 / 48, max: 0.035 };
  // the share of the motion between two drawn frames that the shutter sees (dt: the game time between them, s); 0 at a
  // cut (cut true), on the first frame (dt ≤ 0) or after a long stall (dt > 0.5)
  X.shutterK = (dt, cut) => (cut || !(dt > 0) || dt > 0.5 ? 0 : Math.min(1, X.BLUR.shutter / dt));

  // ---------------------------------------------------------------- Tonumfang
  //   a  the highlights' opening (x + a·x²·(1 − x): 0 and 1 stay, monotonic while a < 1)
  //   k  the toe's knee (y²·(1 + k)/(y + k)), t its share by full day (× the day: none at night, the night stays readable)
  X.RANGE = { a: 0.75, k: 0.15, t: 0.6 };
  X.rangeK = function (x, day) {
    const R = X.RANGE, y = x + R.a * x * x * (1 - x), toe = y * y * (1 + R.k) / (y + R.k);
    return y + (toe - y) * R.t * clamp(day, 0, 1);
  };
  // the day's share from the sun's height (the toe fades out through the dusk)
  X.dayK = (sunY) => sstep(-0.05, 0.2, sunY);

  // ---------------------------------------------------------------- the defines, by program
  X.definesFor = function (name, q) {
    q = q || X.q;
    const lv = Math.max(0, Math.min(2, q.xDepth | 0));
    if (DEPTH_PROGS[name]) return lv ? ['XDEPTH', 'XD_VAO ' + f3(X.DEPTH[lv].vao), 'XD_SUN ' + f3(X.DEPTH[lv].sun), 'XD_AMB ' + f3(X.DEPTH[lv].amb)] : [];
    if (name !== 'composite') return [];
    const out = [];
    if (q.xClar) out.push('X_CLAR');
    if (q.xBlur) out.push('X_BLUR');
    if (q.xRange) out.push('X_RANGE');
    return out;
  };
  X.hook = function (name, defines) {
    const extra = X.definesFor(name);
    if (!extra.length) return defines || [];
    return (defines || []).concat(extra.filter(d => !(defines || []).includes(d)));
  };
  if (VR.GL) { const prev = VR.GL.defineHook || null; VR.GL.defineHook = (name, defines) => X.hook(name, prev ? prev(name, defines) : (defines || [])); }

  // ---------------------------------------------------------------- the GLSL
  // before v-look's part of the composite: Klarheit's function (lvHdr calls it with the soft copy)
  X.glslPre = function () {
    const C = X.CLAR;
    return `
#ifdef X_CLAR
// x-top · Klarheit (xtop.js X.clarK): the pixel's luma against the soft copy's, near land only
vec3 xClar(vec3 c, vec3 sc, float z) {
  float lc = dot(c, vec3(0.2126, 0.7152, 0.0722)), ls = dot(sc, vec3(0.2126, 0.7152, 0.0722));
  float r = clamp(pow((lc + 0.02) / (ls + 0.02), ${f3(C.pow)}), ${f3(C.lo)}, ${f3(C.hi)});
  return c * mix(1.0, r, 1.0 - smoothstep(${C.near.toFixed(1)}, ${C.far.toFixed(1)}, z));
}
#endif
`;
  };
  // the composite's end, after the grade (display space): Tonumfang (x X.RANGE.a, y its knee, z the toe's share × the day)
  X.glslRange = function () {
    return `
#ifdef X_RANGE
// x-top · Tonumfang (xtop.js X.rangeK): the highlights opened, by day a soft toe under the darks
uniform vec4 u_xRange;
vec3 xRange(vec3 x) {
  vec3 y = x + u_xRange.x * x * x * (1.0 - x);
  return mix(y, y * y * (1.0 + u_xRange.y) / (y + u_xRange.y), u_xRange.z);
}
#endif
`;
  };
  // after v-look's part (it declares the depth, the unjittered inverse view-projection): Filmkamera's function
  X.glslPost = function () {
    return `
#if defined(X_BLUR) && defined(LOOKV)
// x-top · Filmkamera (xtop.js X.shutterK): the camera's motion blur while a director shot plays
uniform mat4 u_xPrevVP;    // the last drawn frame's view-projection (unjittered, round its eye)
uniform vec4 u_xBlur;      // xyz this eye − that eye, w the shutter's share (0: off this frame)
vec3 xBlur(vec3 c, vec2 uv) {
  if (u_xBlur.w <= 0.0) return c;
  float d = texture(u_lvDepth, uv).r;
  vec4 p = u_lvInvVP * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  vec3 P = p.xyz / p.w;
  if (d >= 0.99999) P = normalize(P) * 1.0e4;   // (the sky: its direction only)
  vec4 q = u_xPrevVP * vec4(P + u_xBlur.xyz, 1.0);
  if (q.w <= 0.01) return c;
  vec2 v = (uv - (q.xy / q.w * 0.5 + 0.5)) * u_xBlur.w;
  float L = length(v);
  if (L < 0.0008) return c;
  v *= min(1.0, ${f3(X.BLUR.max)} / L);
  vec3 s = c;
  for (int i = 0; i < 8; i++) s += texture(u_scene, uv + v * ((float(i) + 0.5) / 8.0 - 0.5)).rgb;
  return s / 9.0;
}
#endif
`;
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
