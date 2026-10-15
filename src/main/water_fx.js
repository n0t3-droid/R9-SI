// ============================================================================
// t-material · the trailer's water (plan docs/superpowers/plans/2026-10-15-t-material.md, step 7): the colour that follows
// the depth (turquoise over the bright floor of the shallows → deep blue; the red is absorbed first), the foam on the banks
// (a noise mask by the shore distance — the depth under the surface) and on the wave crests (the Gerstner height), the
// caustics' pattern (warped sines, two octaves on tier 1, three on tier 2, none on Very Low). One table, the same functions
// in JS (the tests) and as GLSL text (TRANS_FS includes glsl(), as it includes water_wave.js's). Our own numbers.
// ============================================================================
(function (VR) {
  'use strict';
  const FX = VR.WaterFx = {
    ABS: [0.42, 0.075, 0.05],            // per block of path: red, green, blue (the floor fades to turquoise, then blue)
    SHALLOW: [0.04, 0.58, 0.62],         // the water's own colour in the shallows (turquoise) …
    DEEP: [0.012, 0.11, 0.30],           // … and deep (blue), lit by the sky
    TD: 0.2,                             // how fast the own colour turns deep, per block
    SHORE_D: 1.0,                        // the bank's foam reaches this deep (blocks under the surface)
    // the noise threshold at the bank and how far it rises by SHORE_D; its soft edge (run 2: a threshold of 0.05 at the
    // bank drew a solid white band along the river like snow — now about half the noise foams at the waterline)
    SHORE_THR: [0.46, 0.66], SHORE_SOFT: 0.08,
    CREST: [0.5, 0.86], CREST_AK: [0.35, 1.0], CREST_N: [0.3, 0.62],   // foam on crests: the height (−1…1), the body·storm factor, the noise
    CAUSTIC_OCT: [0, 2, 3],              // the caustics' octaves per water tier (0 Very Low: none)
  };
  const sat = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const ss = (a, b, x) => { const t = sat((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  // the transmittance of a path of d blocks through the water (rgb)
  FX.absorb = (d) => FX.ABS.map((a) => Math.exp(-a * Math.max(0, d)));
  // the water's own colour at a depth (before the light)
  FX.tint = (d) => { const k = 1 - Math.exp(-Math.max(0, d) * FX.TD); return FX.SHALLOW.map((s, i) => s + (FX.DEEP[i] - s) * k); };
  // the bank's foam: the noise n (0..1) above a threshold that rises with the depth d — solid right at the bank, broken
  // further out, gone by SHORE_D
  FX.shore = (d, n) => { const thr = FX.SHORE_THR[0] + FX.SHORE_THR[1] * ss(0, FX.SHORE_D, d); return ss(thr - FX.SHORE_SOFT, thr + FX.SHORE_SOFT, n); };
  // the crests' foam: hn the surface height over its amplitude (−1…1), ak the body·storm factor, n a noise
  FX.crest = (hn, ak, n) => ss(FX.CREST[0], FX.CREST[1], hn) * ss(FX.CREST_AK[0], FX.CREST_AK[1], ak) * ss(FX.CREST_N[0], FX.CREST_N[1], n);
  // the caustics' light network at p (x, z) and time t with oct octaves (0: none): bright where the fold lines cross
  FX.caustic = (x, z, t, oct) => {
    if (!oct) return 0;
    let qx = x * 0.7, qz = z * 0.7, c = 0;
    for (let i = 0; i < oct; i++) {
      const ax = 0.55 * Math.sin(qz * 1.4 + t * 0.6 + i), az = 0.55 * Math.sin(qx * 1.2 - t * 0.5 + i * 1.9);
      qx += ax; qz += az;
      c += 1 - Math.abs(Math.sin(qx * 2.2) * Math.sin(qz * 2.2));
    }
    c /= oct; return c * c * c * c * c;
  };
  // the sines one caustics call evaluates per pixel (the cost tier)
  FX.causticSines = (oct) => oct * 4;
  // the GLSL text (the same table)
  FX.glsl = function () {
    const f = (v) => (+v).toFixed(5), v3 = (a) => `vec3(${a.map(f).join(', ')})`;
    return `
// --- the trailer's water (generated from src/main/water_fx.js: the same table in the tests and in the shader)
const vec3 WFX_ABS = ${v3(FX.ABS)};
const vec3 WFX_SHALLOW = ${v3(FX.SHALLOW)};
const vec3 WFX_DEEP = ${v3(FX.DEEP)};
vec3 wfxTint(float d) { return mix(WFX_SHALLOW, WFX_DEEP, 1.0 - exp(-max(d, 0.0) * ${f(FX.TD)})); }
float wfxShore(float d, float n) { float thr = ${f(FX.SHORE_THR[0])} + ${f(FX.SHORE_THR[1])} * smoothstep(0.0, ${f(FX.SHORE_D)}, d); return smoothstep(thr - ${f(FX.SHORE_SOFT)}, thr + ${f(FX.SHORE_SOFT)}, n); }
float wfxCrest(float hn, float ak, float n) { return smoothstep(${f(FX.CREST[0])}, ${f(FX.CREST[1])}, hn) * smoothstep(${f(FX.CREST_AK[0])}, ${f(FX.CREST_AK[1])}, ak) * smoothstep(${f(FX.CREST_N[0])}, ${f(FX.CREST_N[1])}, n); }
float wfxCaustic(vec2 p, float t, int oct) {
  vec2 q = p * 0.7; float c = 0.0;
  for (int i = 0; i < 3; i++) {
    if (i >= oct) break;
    q += 0.55 * vec2(sin(q.y * 1.4 + t * 0.6 + float(i)), sin(q.x * 1.2 - t * 0.5 + float(i) * 1.9));
    c += 1.0 - abs(sin(q.x * 2.2) * sin(q.y * 2.2));
  }
  c /= float(max(oct, 1)); return c * c * c * c * c;
}
`;
  };
})(VR);
