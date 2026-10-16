// ============================================================================
// Wind in everything (t-motion · WOW III, docs/superpowers/plans/2026-10-15-t-motion.md): the curves the vertex shaders
// add to whatever the wind can move, written once here as JavaScript and once as GLSL from the same numbers (the node
// test test/motion_wind.js compiles the GLSL text back into JavaScript and checks that both give the same values).
//   gust   a travelling gust pattern: bands of stronger wind that run downwind over the land at GUST.speed blocks a
//          second, their fronts bent by a slow field across the wind, swelling with weather.js's gusts — the meadow's
//          waves (not a sine per blade)
//   lean   a plant in a gust leans downwind, its base stiff and its tip free (the square of the sway level's height)
//   hang   a hung thing — a lantern on its hook, a sign under its bracket, laundry on its line, an awning's valance —
//          swings as one piece about its top: one phase for the whole object (a field of low spatial frequency, so a
//          three-block awning bends as one cloth and a lantern stays rigid), the amplitude by the depth under the hook
//          (the mesher's sway level), pushed downwind in the gusts, with a small cloth flutter on top
//   frond  a palm frond: the bend grows with the square of the distance from the crown (props.js sway weights), each
//          frond flaps up and down with its own phase, the gust droops the crown
//   sheen  grass and leaves bent by a gust show their paler side: the faces brighten a little where a gust passes, so
//          the waves read from afar
//   ground the meadow's waves on the ground itself (the third browser run: the bands moved only the tufts, the green
//          tops of the grass blocks stood still): a green block's top brightens — paler, a touch yellow — under a gust
//          and darkens a little in the lull between, centred on the field's mean so the meadow keeps its brightness;
//          drawn per pixel (TERRAIN_FS), as a merged top face spans many blocks
// Pure functions, no state. VR.Wind.glsl() is the shaders' text (shaders.js inserts it under #ifdef MOTION).
// ============================================================================
(function (VR) {
  'use strict';
  const W = VR.Wind = {};
  // the numbers (blocks, seconds, radians)
  const GUST = W.GUST = { speed: 7.5, k1: 0.2417, k2: 0.1030, sp2: 6.0, cross1: 0.045, cross2: 0.11, along2: 0.02, base: 0.45 };
  const LEAN = W.LEAN = 0.22;         // a full gust bends a level-3 tip this far downwind (at wind 1)
  const SHEEN = W.SHEEN = 0.16;       // how much a full gust brightens grass and leaves
  const HANG = W.HANG = { amp: 0.06, w: 2.6, w2: 4.3, kx: 0.09, kz: 0.06, flutter: 0.003, fw: 9.0 };
  const FROND = W.FROND = { amp: 0.16, flap: 0.45, droop: 0.35 };
  // the ground's bands: k the swing per unit of gust; mid the field's mean of g² (0.5 + 0.36·sin + 0.24·sin, squared), so
  // the bands are centred on it at every gust; wind the strongest wind they follow; warm the paler, yellower crest
  const GROUND = W.GROUND = { k: 0.5, mid: 0.344, wind: 1.25, warm: [1.06, 1.04, 0.86], warmK: 1.5, warmMax: 0.4 };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // ---- the travelling gust pattern at (x, z), time t, the wind heading (dx, dz) (unit), weather.js's gust 0..1 → 0..1
  W.gust = function (x, z, t, dx, dz, gust) {
    const s = x * dx + z * dz, c = z * dx - x * dz;          // along the wind, across it
    const bend = 1.6 * Math.sin(c * GUST.cross1 + 1.3) + 0.9 * Math.sin(c * GUST.cross2 - s * GUST.along2);
    const a = Math.sin(GUST.k1 * (s - GUST.speed * t) + bend);
    const b = Math.sin(GUST.k2 * (s - GUST.sp2 * t) + 0.7 * bend + 2.1);
    const g = clamp(0.5 + 0.36 * a + 0.24 * b, 0, 1);
    return g * g * (GUST.base + (1 - GUST.base) * clamp(gust, 0, 1));
  };
  // ---- a plant vertex of sway level lv (0..3) in a gust G (0..1) at wind strength `wind`: how far it leans downwind
  // (blocks) — the base stiff, the tip free — and how far it sinks as it bends
  W.lean = function (lv, wind, G) { const h = clamp(lv, 0, 3) / 3, l = h * h * LEAN * Math.max(0, wind) * G; return { along: l, down: l * 0.3 * h }; };
  // ---- a hung vertex at (x, y, z) of level lv (0..3: its depth under the hook in thirds): its displacement along the wind,
  // across it and up (blocks)
  W.hang = function (x, y, z, t, wind, G, lv) {
    const h = clamp(lv, 0, 3) / 3, A = h * HANG.amp * Math.max(0, wind), ph = x * HANG.kx + z * HANG.kz;
    const sw = Math.sin(HANG.w * t + ph) * (0.75 + 0.5 * G) + 0.3 * Math.sin(HANG.w2 * t + 2 * ph + 1);
    const fl = h * HANG.flutter * Math.max(0, wind) * Math.sin(HANG.fw * t + x * 3.1 + y * 4 + z * 2.3);
    return { along: A * (0.35 + 0.9 * G + sw) + fl, across: A * 0.35 * Math.sin(2.1 * t + ph * 1.3 + 1.7), up: fl * 0.6 };
  };
  // ---- a palm frond vertex: sway weight w (props.js: 0.12 at the crown, 1 at a frond's tip), its frond slot, the palm's
  // phase ph and scale sc, the gust G there: its displacement along the wind, across it and up (palm units)
  W.frond = function (w, slot, ph, sc, t, wind, G, py) {
    const amp = Math.max(0, wind) * w * sc * FROND.amp * (0.75 + 0.6 * G);
    const w1 = 0.6 + 0.4 * Math.sin(t * 1.7 + ph + slot * 0.9);
    const w2 = 0.3 * Math.sin(t * 2.6 + ph * 1.3 + slot * 1.7 + py * 0.7);
    return { along: amp * w1, across: amp * w2, up: amp * (FROND.flap * Math.sin(t * 3.1 + slot * 2.3 + ph) - FROND.droop * G) };
  };
  W.sheen = (G) => SHEEN * clamp(G, 0, 1);
  // ---- the ground's bands: a green top in the gust G (W.gust at its place) with the weather's gust `gust`: how much
  // brighter (+) or darker (−) it is; the caller scales it by the wind (≤ GROUND.wind)
  W.groundSheen = (G, gust) => GROUND.k * (clamp(G, 0, 1) - GROUND.mid * (GUST.base + (1 - GUST.base) * clamp(gust, 0, 1)));
  // a tint (rgb565) that is green: grass and foliage get the sheen, water and white faces do not
  W.greenTint = function (t565) {
    const r = ((t565 >> 11) & 31) / 31, g = ((t565 >> 5) & 63) / 63, b = (t565 & 31) / 31;
    return g > r * 1.08 && g > b * 1.08 ? 1 : 0;
  };

  // ---- the same curves as GLSL (the numbers inserted from the tables above)
  W.glsl = function () {
    const f = (v) => { const s = (+v).toFixed(5); return s; };
    return `
// --- wind (generated from src/shared/wind.js: the same numbers and formulas on the CPU and in the shader)
float windGust(float x, float z, float t, float dx, float dz, float gust) {
  float s = x * dx + z * dz;
  float c = z * dx - x * dz;
  float bend = 1.6 * sin(c * ${f(GUST.cross1)} + 1.3) + 0.9 * sin(c * ${f(GUST.cross2)} - s * ${f(GUST.along2)});
  float a = sin(${f(GUST.k1)} * (s - ${f(GUST.speed)} * t) + bend);
  float b = sin(${f(GUST.k2)} * (s - ${f(GUST.sp2)} * t) + 0.7 * bend + 2.1);
  float g = clamp(0.5 + 0.36 * a + 0.24 * b, 0.0, 1.0);
  return g * g * (${f(GUST.base)} + ${f(1 - GUST.base)} * clamp(gust, 0.0, 1.0));
}
float windLeanAlong(float lv, float wind, float G) {
  float h = clamp(lv, 0.0, 3.0) / 3.0;
  return h * h * ${f(LEAN)} * max(0.0, wind) * G;
}
float windHangAlong(float x, float y, float z, float t, float wind, float G, float lv) {
  float h = clamp(lv, 0.0, 3.0) / 3.0;
  float A = h * ${f(HANG.amp)} * max(0.0, wind);
  float ph = x * ${f(HANG.kx)} + z * ${f(HANG.kz)};
  float sw = sin(${f(HANG.w)} * t + ph) * (0.75 + 0.5 * G) + 0.3 * sin(${f(HANG.w2)} * t + 2.0 * ph + 1.0);
  float fl = h * ${f(HANG.flutter)} * max(0.0, wind) * sin(${f(HANG.fw)} * t + x * 3.1 + y * 4.0 + z * 2.3);
  return A * (0.35 + 0.9 * G + sw) + fl;
}
float windHangAcross(float x, float y, float z, float t, float wind, float G, float lv) {
  float h = clamp(lv, 0.0, 3.0) / 3.0;
  float A = h * ${f(HANG.amp)} * max(0.0, wind);
  float ph = x * ${f(HANG.kx)} + z * ${f(HANG.kz)};
  return A * 0.35 * sin(2.1 * t + ph * 1.3 + 1.7);
}
float windHangUp(float x, float y, float z, float t, float wind, float G, float lv) {
  float h = clamp(lv, 0.0, 3.0) / 3.0;
  float fl = h * ${f(HANG.flutter)} * max(0.0, wind) * sin(${f(HANG.fw)} * t + x * 3.1 + y * 4.0 + z * 2.3);
  return fl * 0.6;
}
float windFrondAmp(float w, float sc, float wind, float G) {
  return max(0.0, wind) * w * sc * ${f(FROND.amp)} * (0.75 + 0.6 * G);
}
float windFrondAlong(float amp, float slot, float ph, float t) {
  return amp * (0.6 + 0.4 * sin(t * 1.7 + ph + slot * 0.9));
}
float windFrondAcross(float amp, float slot, float ph, float t, float py) {
  return amp * 0.3 * sin(t * 2.6 + ph * 1.3 + slot * 1.7 + py * 0.7);
}
float windFrondUp(float amp, float slot, float ph, float t, float G) {
  return amp * (${f(FROND.flap)} * sin(t * 3.1 + slot * 2.3 + ph) - ${f(FROND.droop)} * G);
}
float windSheen(float G) {
  return ${f(SHEEN)} * clamp(G, 0.0, 1.0);
}
float windGroundSheen(float G, float gust) {
  return ${f(GROUND.k)} * (clamp(G, 0.0, 1.0) - ${f(GROUND.mid)} * (${f(GUST.base)} + ${f(1 - GUST.base)} * clamp(gust, 0.0, 1.0)));
}
`;
  };
})(VR);
