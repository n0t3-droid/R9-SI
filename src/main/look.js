// ============================================================================
// v-look · Filmblick (plan docs/superpowers/plans/2026-11-01-v-look.md): the picture as a frame of an animated film.
// Pure (no GL): the switches and their defaults per preset, the settings rows, the per-frame values by the hour, the JS
// mirrors the node test checks against the GLSL, and the GLSL itself (the composite's part, under #ifdefs: with every
// switch off the composite compiles from the same text as before). The GL side — the soft copy, the uniforms — is
// look_gl.js (loaded after renderer.js); this file loads before shaders.js (build.js MAIN).
//   lvHaze  Sonnendunst: the air between the eye and the land lit by the sun — toward the sun a warm veil over the far
//           land, away from it a cool one; the far layers separate like painted planes            (LV_HAZE)   ALU only
//   lvPal   Filmpalette: the greens of a film — the lime of the meadows calmed toward a warm sap green in the light and a
//           teal in the shade; skin, wood, lamps and the sky's warm hues untouched                 (LV_PAL)    ALU only
//   lvSoft  Weite Ferne: the far land softer (a lens's depth), from a quarter-res soft copy of the scene  (LV_SOFT)
//   lvWrap  Lichtsaum: the bright sky behind a silhouette spills a little over its edge (the compositor's light wrap)
//                                                                                                      (LV_WRAP)
// Very Low and Low: none of them (their programs and passes as before). Balanced: the two ALU-only ones. High and up:
// all four (the soft copy is one ¼ × ¼ pass).
// ============================================================================
(function (VR) {
  'use strict';
  const L = VR.Look = VR.Look || {};
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const sstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

  // ---------------------------------------------------------------- the switches
  L.SW = ['lvHaze', 'lvPal', 'lvSoft', 'lvWrap'];
  const OFF = { lvHaze: false, lvPal: false, lvSoft: false, lvWrap: false };
  const ALL = { lvHaze: true, lvPal: true, lvSoft: true, lvWrap: true };
  const TIERS = {
    potato: OFF, low: OFF,
    balanced: { lvHaze: true, lvPal: true, lvSoft: false, lvWrap: false },
    high: ALL, ultra: ALL, ultraLite: ALL,
  };
  L.defaults = (preset) => Object.assign({}, TIERS[preset] || TIERS.balanced);
  L.off = () => Object.assign({}, OFF);
  L.ROWS = [
    { key: 'lvHaze', g: 'img', sec: 'light', t: 'switch', lab: 'g.set.lvHaze', tip: 'g.set.lvHaze.tip', cost: 'low', def: true },
    { key: 'lvPal', g: 'img', sec: 'light', t: 'switch', lab: 'g.set.lvPal', tip: 'g.set.lvPal.tip', cost: 'low', def: true },
    { key: 'lvSoft', g: 'img', sec: 'light', t: 'switch', lab: 'g.set.lvSoft', tip: 'g.set.lvSoft.tip', cost: 'mid', def: false },
    { key: 'lvWrap', g: 'img', sec: 'light', t: 'switch', lab: 'g.set.lvWrap', tip: 'g.set.lvWrap.tip', cost: 'mid', def: false },
  ];
  L.key = (q) => L.SW.map(k => (q && q[k]) ? 1 : 0).join('');
  L.on = (q) => !!(q && (q.lvHaze || q.lvPal || q.lvSoft || q.lvWrap));
  L.needSoft = (q) => !!(q && (q.lvSoft || q.lvWrap));
  L.q = OFF;
  L.use = function (q) { L.q = q || OFF; return L.q; };
  L.definesFor = function (name, q) {
    q = q || L.q;
    if (name !== 'composite') return [];
    const out = [];
    if (q.lvHaze) out.push('LV_HAZE');
    if (q.lvPal) out.push('LV_PAL');
    if (q.lvSoft) out.push('LV_SOFT');
    if (q.lvWrap) out.push('LV_WRAP');
    if (out.length) out.push('LOOKV');
    return out;
  };
  L.hook = function (name, defines) {
    const extra = L.definesFor(name);
    if (!extra.length) return defines || [];
    return (defines || []).concat(extra.filter(d => !(defines || []).includes(d)));
  };
  if (VR.GL) { const prev = VR.GL.defineHook || null; VR.GL.defineHook = (name, defines) => L.hook(name, prev ? prev(name, defines) : (defines || [])); }

  // ---------------------------------------------------------------- the hour's values
  // the moods by the sun's height (as light2.js: day · gold · dusk · night)
  L.moods = function (sy) {
    const wDay = sstep(-0.01, 0.1, sy), wNight = 1 - sstep(-0.28, -0.1, sy), wDusk = (1 - wDay) * (1 - wNight);
    const g = 1 - sstep(0.1, 0.3, sy);
    return { day: wDay * (1 - g), gold: wDay * g, dusk: wDusk, night: wNight };
  };
  // per mood: haze — the veil's reach (m to half), its strength toward the sun and away, its warm and cool colour (×
  // the sun's and the sky's light); pal — the greens' calm (0…1), the warm lean in the light, the teal lean in the shade;
  // soft — where the far softening starts and is full (m), its strength; wrap — its strength
  const MOOD = {
    day: { half: 260, sunK: 0.32, skyK: 0.18, warm: [1.0, 0.92, 0.78], cool: [0.78, 0.86, 1.0], calm: 0.32, lean: 0.03, teal: 0.035, s0: 70, s1: 220, sK: 0.55, wK: 0.5 },
    gold: { half: 170, sunK: 0.45, skyK: 0.2, warm: [1.0, 0.8, 0.58], cool: [0.72, 0.76, 1.0], calm: 0.38, lean: 0.06, teal: 0.05, s0: 60, s1: 200, sK: 0.6, wK: 0.75 },
    dusk: { half: 150, sunK: 0.42, skyK: 0.26, warm: [1.0, 0.66, 0.5], cool: [0.55, 0.68, 1.0], calm: 0.3, lean: 0.035, teal: 0.07, s0: 55, s1: 180, sK: 0.6, wK: 0.65 },
    night: { half: 200, sunK: 0.0, skyK: 0.22, warm: [0.8, 0.85, 1.0], cool: [0.62, 0.74, 1.0], calm: 0.22, lean: 0.0, teal: 0.04, s0: 50, s1: 170, sK: 0.5, wK: 0.55 },
  };
  L.MOOD = MOOD;
  const MK = ['day', 'gold', 'dusk', 'night'];
  const blend = (m, k) => {
    const a = MOOD.day[k];
    if (Array.isArray(a)) { const o = [0, 0, 0]; for (const n of MK) for (let i = 0; i < 3; i++) o[i] += MOOD[n][k][i] * m[n]; return o; }
    let s = 0; for (const n of MK) s += MOOD[n][k] * m[n]; return s;
  };
  // the frame's values from env.js's E (out reused: no allocation a frame once made)
  L.frame = function (E, out) {
    const o = out || { haze: [0, 0, 0, 0], warm: [0, 0, 0], cool: [0, 0, 0], pal: [0, 0, 0, 0], soft: [0, 0, 0, 0] };
    const m = L.moods(E.sunDir[1]);
    const sc = E.sunColor || [1, 1, 1], fc = E.fogColor || [0.6, 0.7, 0.9];
    const sl = Math.min(1.5, 0.2126 * sc[0] + 0.7152 * sc[1] + 0.0722 * sc[2]);
    const rain = clamp(E.rain || 0, 0, 1), dim = E.dimId === 0 ? 1 : 0;
    o.haze[0] = blend(m, 'half'); o.haze[1] = blend(m, 'sunK') * (1 - rain * 0.7) * dim; o.haze[2] = blend(m, 'skyK') * dim; o.haze[3] = E.sunDir[1] > -0.05 ? 1 : 0;
    const w = blend(m, 'warm'), c = blend(m, 'cool');
    // (both colours at luma 1: the veil's brightness is the land's own, lifted a little — the far land lighter, never darker)
    for (let i = 0; i < 3; i++) { o.warm[i] = w[i] * sc[i]; o.cool[i] = c[i] * fc[i]; }
    const lw = Math.max(1e-3, lum(o.warm)), lc = Math.max(1e-3, lum(o.cool));
    for (let i = 0; i < 3; i++) { o.warm[i] /= lw; o.cool[i] /= lc; }
    o.pal[0] = blend(m, 'calm'); o.pal[1] = blend(m, 'lean') * (1 - rain); o.pal[2] = blend(m, 'teal'); o.pal[3] = dim;
    o.soft[0] = blend(m, 's0'); o.soft[1] = blend(m, 's1'); o.soft[2] = blend(m, 'sK') * dim; o.soft[3] = blend(m, 'wK') * dim;
    return o;
  };

  // ---------------------------------------------------------------- the JS mirrors (node test: the GLSL's arithmetic)
  // the greens' weight of a display colour: hue within the yellow-green … green band, by its chroma
  L.greenW = function (c) {
    const mx = Math.max(c[0], c[1], c[2]), mn = Math.min(c[0], c[1], c[2]), ch = mx - mn;
    if (ch < 1e-4 || mx !== c[1]) return 0;
    const h = 60 * (((c[2] - c[0]) / ch) + 2);   // (the hue when green is the largest: 60 … 180)
    return sstep(62, 85, h) * (1 - sstep(150, 172, h)) * sstep(0.08, 0.3, ch);
  };
  // the palette on a display colour: the green's chroma calmed, its hue leaned (warm in the light, teal in the shade),
  // the luma kept
  L.pal = function (c, p) {
    const w = L.greenW(c) * p[3]; if (w <= 0) return c.slice();
    const l = lum(c), lit = sstep(0.18, 0.62, l);
    const k = 1 - p[0] * w;
    const o = [l + (c[0] - l) * k, l + (c[1] - l) * k, l + (c[2] - l) * k];
    o[0] += (p[1] * lit - p[2] * 0.5 * (1 - lit)) * w; o[2] += (p[2] * (1 - lit) - p[1] * 0.6 * lit) * w; o[1] += p[2] * 0.25 * (1 - lit) * w;
    const dl = lum(o) - l;
    return [clamp(o[0] - dl, 0, 1), clamp(o[1] - dl, 0, 1), clamp(o[2] - dl, 0, 1)];
  };
  // the haze's share at distance d (m) and cosine cs to the sun: 1 − 2^(−d/half), weighted toward the sun and away
  L.hazeK = function (d, cs, h) {
    const f = 1 - Math.pow(2, -d / h[0]);
    const toward = Math.pow(Math.max(cs, 0), 6) * h[3];
    return { sun: f * h[1] * toward, sky: f * h[2] * (1 - toward * 0.6) };
  };
  L.softK = (d, s) => sstep(s[0], s[1], d) * s[2];
  // the wrap at a pixel: the near pixel's edge against a far neighbour (the depth ratio), the brighter soft copy's excess
  L.wrapK = (zSelf, zFar, s) => sstep(1.6, 4.0, zFar / Math.max(0.05, zSelf)) * s[3];

  // ---------------------------------------------------------------- the GLSL (COMPOSITE_FS includes it)
  L.glslComposite = function () {
    return `
#ifdef LOOKV
// v-look · Filmblick (look.js): the haze, the palette, the far softening, the light wrap
uniform vec4 u_lvHaze;     // x the half distance (m), y toward the sun, z the sky's veil, w the sun up
uniform vec3 u_lvWarm;
uniform vec3 u_lvCool;
uniform vec4 u_lvPal;      // x the greens' calm, y the warm lean, z the teal lean, w on
uniform vec4 u_lvSoft;     // x start (m), y full (m), z the softening, w the wrap
uniform vec3 u_lvSun;      // the sun's direction
uniform vec2 u_lvNF;       // near, far
uniform mat4 u_lvInvVP;    // the pixel's view ray (no jitter)
uniform highp sampler2D u_lvDepth;
uniform sampler2D u_lvSoftTex;
uniform vec2 u_lvTexel;    // the depth's texel
float lvLin(float d) { float z = d * 2.0 - 1.0; return 2.0 * u_lvNF.x * u_lvNF.y / (u_lvNF.y + u_lvNF.x - z * (u_lvNF.y - u_lvNF.x)); }
vec3 lvRay(vec2 uv) { vec4 a = u_lvInvVP * vec4(uv * 2.0 - 1.0, -1.0, 1.0), b = u_lvInvVP * vec4(uv * 2.0 - 1.0, 1.0, 1.0); return normalize(b.xyz / b.w - a.xyz / a.w); }
// HDR, before the exposure: the far softening, the wrap, the haze
vec3 lvHdr(vec3 c, vec2 uv) {
  float d0 = texture(u_lvDepth, uv).r;
  if (d0 >= 0.99999) return c;   // the sky: as it is
  float z = lvLin(d0);
#if defined(LV_SOFT) || defined(LV_WRAP)
  vec3 sc = texture(u_lvSoftTex, uv).rgb;
#endif
#ifdef LV_SOFT
  c = mix(c, sc, smoothstep(u_lvSoft.x, u_lvSoft.y, z) * u_lvSoft.z);
#endif
#ifdef LV_WRAP
  {
    vec2 t = u_lvTexel * 3.0;
    float zf = max(max(lvLin(texture(u_lvDepth, uv + vec2(t.x, 0.0)).r), lvLin(texture(u_lvDepth, uv - vec2(t.x, 0.0)).r)),
                   max(lvLin(texture(u_lvDepth, uv + vec2(0.0, t.y)).r), lvLin(texture(u_lvDepth, uv - vec2(0.0, t.y)).r)));
    float e = smoothstep(1.6, 4.0, zf / max(0.05, z)) * u_lvSoft.w;
    c += max(sc - c, vec3(0.0)) * e;
  }
#endif
#ifdef LV_HAZE
  {
    vec3 rd = lvRay(uv);
    float f = 1.0 - exp2(-z / u_lvHaze.x);
    float toward = pow(max(dot(rd, u_lvSun), 0.0), 6.0) * u_lvHaze.w;
    float lc = dot(c, vec3(0.2126, 0.7152, 0.0722));
    // (the veil carries the light of the land under it, lifted: its colour (luma 1) times the land's own brightness — the
    // far land lighter and bluer (warmer toward the sun), never darker; a dark far ridge gets at least a soft veil)
    float veil = min(max(lc, 0.3), 4.0);
    c = mix(c, u_lvWarm * (veil * 1.3 + 0.1), f * u_lvHaze.y * toward);
    c = mix(c, u_lvCool * (veil * 1.15 + 0.06), f * u_lvHaze.z * (1.0 - toward * 0.6));
  }
#endif
  return c;
}
// display space, after the grade: the film's greens
vec3 lvPal(vec3 c) {
#ifdef LV_PAL
  float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b)), ch = mx - mn;
  if (ch < 1e-4 || mx > c.g) return c;
  float h = 60.0 * ((c.b - c.r) / ch + 2.0);
  float w = smoothstep(62.0, 85.0, h) * (1.0 - smoothstep(150.0, 172.0, h)) * smoothstep(0.08, 0.3, ch) * u_lvPal.w;
  if (w <= 0.0) return c;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722)), lit = smoothstep(0.18, 0.62, l);
  vec3 o = vec3(l) + (c - vec3(l)) * (1.0 - u_lvPal.x * w);
  o.r += (u_lvPal.y * lit - u_lvPal.z * 0.5 * (1.0 - lit)) * w;
  o.b += (u_lvPal.z * (1.0 - lit) - u_lvPal.y * 0.6 * lit) * w;
  o.g += u_lvPal.z * 0.25 * (1.0 - lit) * w;
  o -= dot(o, vec3(0.2126, 0.7152, 0.0722)) - l;
  return clamp(o, 0.0, 1.0);
#else
  return c;
#endif
}
#endif`;
  };
  // the soft copy's pass: the scene at ¼ × ¼, nine bilinear taps in a tent (≈ a 12-pixel soft disc of the full picture)
  L.SOFT_FS = `
uniform sampler2D u_src;
uniform vec2 u_texel;   // the source's texel
in vec2 v_uv;
out vec4 o;
void main() {
  vec2 t = u_texel * 2.0;
  vec3 c = texture(u_src, v_uv).rgb * 4.0;
  c += (texture(u_src, v_uv + vec2(t.x, 0.0)).rgb + texture(u_src, v_uv - vec2(t.x, 0.0)).rgb + texture(u_src, v_uv + vec2(0.0, t.y)).rgb + texture(u_src, v_uv - vec2(0.0, t.y)).rgb) * 2.0;
  c += texture(u_src, v_uv + t).rgb + texture(u_src, v_uv - t).rgb + texture(u_src, v_uv + vec2(t.x, -t.y)).rgb + texture(u_src, v_uv + vec2(-t.x, t.y)).rgb;
  o = vec4(min(c / 16.0, vec3(64.0)), 1.0);
}`;
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
