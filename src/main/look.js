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
//   v-look2 (plan docs/superpowers/plans/2026-11-01-v-look2.md):
//   lvTone  Mondlicht & Weltenfarben: the night as a film's moonlight (silver-blue shade, warm lamps kept warm and — High —
//           glowing softly, the sky never pitch black so silhouettes read) and every world its own palette (Aquamarin
//           turquoise-gold, Ocker amber dust, Zinnober ember-rose at night, Opal pearl, Basalt blue-violet, the station's
//           warm lamps over teal shade)                                                            (LV_TONE)   ALU only
//   lvMeadow Wiesenruhe: the near meadow calmed — the grass texture's texel noise partly replaced by its own mean (one
//           coarse-mip tap), large soft colour patches over tens of metres (the painted field)  (LV_MEADOW, terrain)
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
  L.SW = ['lvHaze', 'lvPal', 'lvSoft', 'lvWrap', 'lvTone', 'lvMeadow'];
  const OFF = { lvHaze: false, lvPal: false, lvSoft: false, lvWrap: false, lvTone: false, lvMeadow: false };
  const ALL = { lvHaze: true, lvPal: true, lvSoft: true, lvWrap: true, lvTone: true, lvMeadow: true };
  const TIERS = {
    potato: OFF, low: OFF,
    balanced: { lvHaze: true, lvPal: true, lvSoft: false, lvWrap: false, lvTone: true, lvMeadow: true },
    high: ALL, ultra: ALL, ultraLite: ALL,
  };
  L.defaults = (preset) => Object.assign({}, TIERS[preset] || TIERS.balanced);
  L.off = () => Object.assign({}, OFF);
  L.ROWS = [
    { key: 'lvHaze', g: 'img', sec: 'light', t: 'switch', lab: 'g.set.lvHaze', tip: 'g.set.lvHaze.tip', cost: 'low', def: true },
    { key: 'lvPal', g: 'img', sec: 'light', t: 'switch', lab: 'g.set.lvPal', tip: 'g.set.lvPal.tip', cost: 'low', def: true },
    { key: 'lvSoft', g: 'img', sec: 'light', t: 'switch', lab: 'g.set.lvSoft', tip: 'g.set.lvSoft.tip', cost: 'mid', def: false },
    { key: 'lvWrap', g: 'img', sec: 'light', t: 'switch', lab: 'g.set.lvWrap', tip: 'g.set.lvWrap.tip', cost: 'mid', def: false },
    { key: 'lvTone', g: 'img', sec: 'light', t: 'switch', lab: 'g.set.lvTone', tip: 'g.set.lvTone.tip', cost: 'low', def: true },
    { key: 'lvMeadow', g: 'img', sec: 'light', t: 'switch', lab: 'g.set.lvMeadow', tip: 'g.set.lvMeadow.tip', cost: 'low', def: true },
  ];
  L.key = (q) => L.SW.map(k => (q && q[k]) ? 1 : 0).join('');
  L.on = (q) => !!(q && (q.lvHaze || q.lvPal || q.lvSoft || q.lvWrap || q.lvTone || q.lvMeadow));
  L.compOn = (q) => !!(q && (q.lvHaze || q.lvPal || q.lvSoft || q.lvWrap || q.lvTone));
  L.needSoft = (q) => !!(q && (q.lvSoft || q.lvWrap));
  L.q = OFF;
  L.use = function (q) { L.q = q || OFF; return L.q; };
  L.definesFor = function (name, q) {
    q = q || L.q;
    if (name === 'terrain') return q.lvMeadow ? ['LV_MEADOW'] : [];   // (v-look2: the opaque terrain only — not the cutout, the ships, the water)
    if (name !== 'composite') return [];
    const out = [];
    if (q.lvHaze) out.push('LV_HAZE');
    if (q.lvPal) out.push('LV_PAL');
    if (q.lvSoft) out.push('LV_SOFT');
    if (q.lvWrap) out.push('LV_WRAP');
    if (q.lvTone) out.push('LV_TONE');
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
  // (browser run 2: toward the sun at the golden hour the veil hid the hill at 120 m and the softening started too near —
  // the veils' reach longer and their strength down, the softening from ~85 m; the greens' calm was too shy at noon)
  const MOOD = {
    day: { half: 320, sunK: 0.24, skyK: 0.18, warm: [1.0, 0.92, 0.78], cool: [0.78, 0.86, 1.0], calm: 0.45, lean: 0.045, teal: 0.04, s0: 90, s1: 300, sK: 0.42, wK: 0.5 },
    gold: { half: 230, sunK: 0.32, skyK: 0.2, warm: [1.0, 0.8, 0.58], cool: [0.72, 0.76, 1.0], calm: 0.45, lean: 0.06, teal: 0.055, s0: 85, s1: 280, sK: 0.45, wK: 0.75 },
    dusk: { half: 200, sunK: 0.3, skyK: 0.26, warm: [1.0, 0.66, 0.5], cool: [0.55, 0.68, 1.0], calm: 0.42, lean: 0.035, teal: 0.09, s0: 80, s1: 260, sK: 0.45, wK: 0.65 },
    night: { half: 240, sunK: 0.0, skyK: 0.22, warm: [0.8, 0.85, 1.0], cool: [0.62, 0.74, 1.0], calm: 0.3, lean: 0.0, teal: 0.05, s0: 70, s1: 240, sK: 0.4, wK: 0.55 },
  };
  L.MOOD = MOOD;
  const MK = ['day', 'gold', 'dusk', 'night'];
  const blend = (m, k) => {
    const a = MOOD.day[k];
    if (Array.isArray(a)) { const o = [0, 0, 0]; for (const n of MK) for (let i = 0; i < 3; i++) o[i] += MOOD[n][k][i] * m[n]; return o; }
    let s = 0; for (const n of MK) s += MOOD[n][k] * m[n]; return s;
  };
  // ---------------------------------------------------------------- v-look2: the worlds
  // which palette a dim gets: Herzwelt (and a flat world) 'home', the five bodies by their dim, the stations 'station';
  // the other dims (Unterschmiede, Hohlwelt, Driftinseln, the rubble) none — as before
  L.world = function (dim) {
    if (!dim || dim === 'overworld' || dim === 'flat') return 'home';
    if (dim === 'aqua' || dim === 'ocker' || dim === 'zinn' || dim === 'opal' || dim === 'basalt') return dim;
    if (/^stn\./.test(dim)) return 'station';
    return null;
  };
  // per world: air (the haze's factor: 0 airless — no air, no veil), veil (the haze's two colours instead of the sun's and
  // the sky's: Ocker's dust), soft (the far softening and the wrap), and the tone by day and by night (E.night):
  //   S / H  the shade's and the light's tint (luma 1 after normalising) and their strength · lift the land's black (a
  //   screen lift) · sky the sky's floor (screen) · de the desaturation · keep how much warm lamps are spared · glow the
  //   lamps' soft glow (High, from the soft copy)
  // (real science where it applies: Aquamarin's and Ocker's air veils the far land, the airless worlds' far land stands
  // as hard as the near; Ocker's dust scatters amber; the moonlit night's eye sees blue and less colour — the Purkinje shift)
  const T0 = { S: [1, 1, 1, 0], H: [1, 1, 1, 0], lift: [0, 0, 0], sky: [0, 0, 0], de: 0, keep: 1, glow: 0 };
  const MOON = { S: [0.78, 0.94, 1.3, 0.55], H: [0.92, 0.98, 1.1, 0.32], lift: [0.016, 0.024, 0.045], sky: [0.07, 0.1, 0.17], de: 0.3, keep: 1, glow: 0.6 };
  const WORLDS = {
    home: { air: 1, veil: null, soft: 1, day: T0, night: MOON },
    aqua: { air: 0.8, veil: null, soft: 1,
      day: { S: [0.72, 1.06, 1.14, 0.38], H: [1.14, 1.0, 0.76, 0.3], lift: [0.008, 0.018, 0.022], sky: [0, 0, 0], de: 0, keep: 1, glow: 0.3 },
      night: { S: [0.66, 1.0, 1.25, 0.5], H: [1.06, 1.0, 0.9, 0.25], lift: [0.012, 0.026, 0.034], sky: [0.04, 0.08, 0.1], de: 0.2, keep: 1, glow: 0.6 } },
    ocker: { air: 0.9, veil: [[1.0, 0.78, 0.52], [1.0, 0.84, 0.64]], soft: 1,
      day: { S: [1.06, 0.92, 0.78, 0.3], H: [1.14, 0.98, 0.76, 0.32], lift: [0.02, 0.012, 0.006], sky: [0, 0, 0], de: 0.05, keep: 1, glow: 0.3 },
      night: { S: [0.86, 0.9, 1.2, 0.4], H: [1.1, 0.96, 0.82, 0.2], lift: [0.014, 0.012, 0.016], sky: [0.04, 0.035, 0.05], de: 0.25, keep: 1, glow: 0.6 } },
    zinn: { air: 0, veil: null, soft: 1,
      day: { S: [1.04, 0.92, 1.04, 0.22], H: [1.1, 1.02, 0.8, 0.22], lift: [0.012, 0.008, 0.01], sky: [0, 0, 0], de: 0, keep: 1, glow: 0.3 },
      night: { S: [1.3, 0.78, 1.0, 0.55], H: [1.24, 0.9, 0.7, 0.35], lift: [0.05, 0.018, 0.034], sky: [0.07, 0.026, 0.05], de: 0.1, keep: 0.8, glow: 0.7 } },   // (run 1: the land too black — lifted)
    opal: { air: 0, veil: null, soft: 1,
      day: { S: [0.94, 0.97, 1.1, 0.3], H: [1.03, 1.0, 1.02, 0.25], lift: [0.06, 0.06, 0.07], sky: [0, 0, 0], de: 0.2, keep: 1, glow: 0.3 },
      night: { S: [0.9, 0.95, 1.2, 0.4], H: [1.0, 1.0, 1.04, 0.25], lift: [0.04, 0.042, 0.055], sky: [0, 0, 0], de: 0.25, keep: 1, glow: 0.5 } },
    basalt: { air: 0, veil: null, soft: 1,
      day: { S: [0.9, 0.8, 1.32, 0.5], H: [0.98, 0.98, 1.05, 0.15], lift: [0.014, 0.012, 0.03], sky: [0, 0, 0], de: 0.2, keep: 1, glow: 0.3 },
      night: { S: [0.9, 0.8, 1.4, 0.6], H: [0.96, 0.96, 1.08, 0.2], lift: [0.014, 0.012, 0.034], sky: [0, 0, 0], de: 0.3, keep: 1, glow: 0.6 } },
    station: { air: 0, veil: null, soft: 0,
      day: { S: [0.84, 0.99, 1.14, 0.3], H: [1.12, 1.0, 0.84, 0.3], lift: [0.018, 0.02, 0.026], sky: [0, 0, 0], de: 0, keep: 1, glow: 0.5 },
      night: { S: [0.84, 0.99, 1.14, 0.3], H: [1.12, 1.0, 0.84, 0.3], lift: [0.018, 0.02, 0.026], sky: [0, 0, 0], de: 0, keep: 1, glow: 0.5 } },
  };
  L.WORLDS = WORLDS;
  const nrm = (c, o, i0) => { const l = Math.max(1e-3, lum(c)); for (let i = 0; i < 3; i++) o[i0 + i] = c[i] / l; };
  // the frame's values from env.js's E (out reused: no allocation a frame once made); E.lvWorld (look_gl.js) picks the
  // world, else Herzwelt when dimId is 0
  L.frame = function (E, out, wk0) {
    const o = out || { haze: [0, 0, 0, 0], warm: [0, 0, 0], cool: [0, 0, 0], pal: [0, 0, 0, 0], soft: [0, 0, 0, 0], toneS: [1, 1, 1, 0], toneH: [1, 1, 1, 0], lift: [0, 0, 0, 1], skyF: [0, 0, 0, 0], tone: [0, 0, 0, 0] };
    const wk = wk0 !== undefined ? wk0 : E.lvWorld !== undefined ? E.lvWorld : (E.dimId === 0 ? 'home' : null);
    const W = WORLDS[wk] || null, home = wk === 'home' ? 1 : 0;
    const m = L.moods(E.sunDir[1]);
    const sc = E.sunColor || [1, 1, 1], fc = E.fogColor || [0.6, 0.7, 0.9];
    const rain = clamp(E.rain || 0, 0, 1), air = W ? W.air : 0, sf = W ? W.soft : 0;
    o.haze[0] = blend(m, 'half'); o.haze[1] = blend(m, 'sunK') * (1 - rain * 0.7) * air; o.haze[2] = blend(m, 'skyK') * air; o.haze[3] = E.sunDir[1] > -0.05 ? 1 : 0;
    const w = blend(m, 'warm'), c = blend(m, 'cool');
    // (both colours at luma 1: the veil's brightness is the land's own, lifted a little — the far land lighter, never darker)
    if (W && W.veil) { for (let i = 0; i < 3; i++) { o.warm[i] = W.veil[0][i] * sc[i]; o.cool[i] = W.veil[1][i]; } }
    else for (let i = 0; i < 3; i++) { o.warm[i] = w[i] * sc[i]; o.cool[i] = c[i] * fc[i]; }
    const lw = Math.max(1e-3, lum(o.warm)), lc = Math.max(1e-3, lum(o.cool));
    for (let i = 0; i < 3; i++) { o.warm[i] /= lw; o.cool[i] /= lc; }
    o.pal[0] = blend(m, 'calm'); o.pal[1] = blend(m, 'lean') * (1 - rain); o.pal[2] = blend(m, 'teal'); o.pal[3] = home;
    o.soft[0] = blend(m, 's0'); o.soft[1] = blend(m, 's1'); o.soft[2] = blend(m, 'sK') * sf; o.soft[3] = blend(m, 'wK') * sf;
    // the tone: day and night by the hour (home: light2's moods — the night, a third of the dusk; the bodies: their E.night)
    const n = !W ? 0 : home ? clamp(m.night + m.dusk * 0.35, 0, 1) : clamp(E.night || 0, 0, 1);
    const A = W ? W.day : T0, B = W ? W.night : T0, mx = (a, b) => a + (b - a) * n;
    const S = [mx(A.S[0], B.S[0]), mx(A.S[1], B.S[1]), mx(A.S[2], B.S[2])], H = [mx(A.H[0], B.H[0]), mx(A.H[1], B.H[1]), mx(A.H[2], B.H[2])];
    nrm(S, o.toneS, 0); nrm(H, o.toneH, 0);
    o.toneS[3] = W ? mx(A.S[3], B.S[3]) : 0; o.toneH[3] = W ? mx(A.H[3], B.H[3]) : 0;
    for (let i = 0; i < 3; i++) { o.lift[i] = W ? mx(A.lift[i], B.lift[i]) : 0; o.skyF[i] = W ? mx(A.sky[i], B.sky[i]) : 0; }
    o.lift[3] = W ? mx(A.keep, B.keep) : 1; o.skyF[3] = W ? mx(A.de, B.de) : 0;
    o.tone[0] = W ? mx(A.glow, B.glow) : 0; o.tone[3] = W ? 1 : 0;
    return o;
  };
  // the meadow's values (terrain, LV_MEADOW): the texel noise's calm, the patches' scale (the noise texture's tiles a metre), their
  // strength
  L.MEADOW = { calm: 0.45, scale: 1 / 173, k: 1.0 };   // (scale: the noise texture's tile per metre — its cells some 20–50 m)
  // the world of this frame: Herzwelt by dimId 0; a body or a station by the game's dim (u_dim code 5); else none
  L.worldOf = function (E, dim) {
    if (!E) return null;
    if (E.dimId === 0) return 'home';
    if (E.dimId !== 5) return null;
    const w = L.world(dim); return w === 'home' ? null : w;
  };
  // the tone on a display colour c (sky 1 for a sky pixel) — the GLSL's lvTone
  // (run 1: the plaza's cyan neon lost its colour at night — every bright saturated light is spared too, the warm ones
  // from a lower brightness: lamp-lit ground keeps its warm pool)
  L.warmW = function (c) {
    const mx = Math.max(c[0], c[1], c[2]), ch = mx - Math.min(c[0], c[1], c[2]);
    const w = c[0] > c[2] ? sstep(0.12, 0.4, (c[0] - c[2]) / Math.max(c[0], 1e-3)) * sstep(0.15, 0.5, c[0]) : 0;
    return Math.max(w, sstep(0.3, 0.6, ch / Math.max(mx, 1e-3)) * sstep(0.55, 0.85, mx));
  };
  L.tone = function (c, f, sky) {
    const l = lum(c), k = 1 - L.warmW(c) * f.lift[3];
    const de = f.skyF[3] * k, t = sstep(0.04, 0.55, l);
    const o = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      let v = c[i] + (l - c[i]) * de;
      const tint = f.toneS[i] + (f.toneH[i] - f.toneS[i]) * t, s = (f.toneS[3] + (f.toneH[3] - f.toneS[3]) * t) * k;
      v = v + (v * tint - v) * s;
      const fl = sky ? f.skyF[i] : f.lift[i];
      o[i] = clamp(1 - (1 - clamp(v, 0, 1)) * (1 - fl), 0, 1);
    }
    return o;
  };
  // the lamps' soft glow weight on an HDR colour (the soft copy's): warm and bright
  L.glowW = function (c) { return c[0] > c[2] ? sstep(0.15, 0.5, (c[0] - c[2]) / Math.max(c[0], 1e-3)) * sstep(0.12, 0.6, c[0]) : 0; };

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
#ifdef LV_TONE
uniform vec4 u_lvToneS;    // v-look2: the shade's tint (luma 1), its strength
uniform vec4 u_lvToneH;    // the light's tint, its strength
uniform vec4 u_lvLift;     // the land's floor (screen), w how much warm lamps are spared
uniform vec4 u_lvSkyF;     // the sky's floor (screen), w the desaturation
uniform vec4 u_lvTone;     // x the lamps' glow (from the soft copy)
#endif
float lvSkyPx = 0.0;       // (lvHdr → lvTone: this pixel is sky)
float lvLin(float d) { float z = d * 2.0 - 1.0; return 2.0 * u_lvNF.x * u_lvNF.y / (u_lvNF.y + u_lvNF.x - z * (u_lvNF.y - u_lvNF.x)); }
vec3 lvRay(vec2 uv) { vec4 a = u_lvInvVP * vec4(uv * 2.0 - 1.0, -1.0, 1.0), b = u_lvInvVP * vec4(uv * 2.0 - 1.0, 1.0, 1.0); return normalize(b.xyz / b.w - a.xyz / a.w); }
// HDR, before the exposure: the far softening, the wrap, the haze
vec3 lvHdr(vec3 c, vec2 uv) {
  float d0 = texture(u_lvDepth, uv).r;
  if (d0 >= 0.99999) { lvSkyPx = 1.0; return c; }   // the sky: as it is
  float z = lvLin(d0);
#if defined(LV_SOFT) || defined(LV_WRAP)
  vec3 sc = texture(u_lvSoftTex, uv).rgb;
#if defined(LV_TONE)
  // v-look2: warm lamps glow softly into the dark round them (the soft copy's warm excess; 0 without the soft copy)
  if (u_lvTone.x > 0.0) { float gw = sc.r > sc.b ? smoothstep(0.15, 0.5, (sc.r - sc.b) / max(sc.r, 1e-3)) * smoothstep(0.12, 0.6, sc.r) : 0.0; c += max(sc - c, vec3(0.0)) * gw * u_lvTone.x; }
#endif
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
    // (v-look2: only where the light behind is clearly brighter than the edge — a bright sky, not the next leaf: the
    // halo read as blur on ridges against a sky only a little brighter)
    c += max(sc - c * 1.2, vec3(0.0)) * e;
  }
#endif
#if defined(X_CLAR) && (defined(LV_SOFT) || defined(LV_WRAP))
  c = xClar(c, sc, z);   // x-top · Klarheit (xtop.js): local contrast against the soft copy, near land only
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
// v-look2 · display space: the night's moonlight and the worlds' palettes (L.tone mirrors it)
vec3 lvTone(vec3 c) {
#ifdef LV_TONE
  if (u_lvToneS.w + u_lvToneH.w + u_lvSkyF.w + u_lvLift.x + u_lvLift.y + u_lvLift.z + u_lvSkyF.x + u_lvSkyF.y + u_lvSkyF.z <= 0.0) return c;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float wm = c.r > c.b ? smoothstep(0.12, 0.4, (c.r - c.b) / max(c.r, 1e-3)) * smoothstep(0.15, 0.5, c.r) : 0.0;
  float lmx = max(c.r, max(c.g, c.b));
  wm = max(wm, smoothstep(0.3, 0.6, (lmx - min(c.r, min(c.g, c.b))) / max(lmx, 1e-3)) * smoothstep(0.55, 0.85, lmx));
  float k = 1.0 - wm * u_lvLift.w, t = smoothstep(0.04, 0.55, l);
  vec3 v = mix(c, vec3(l), u_lvSkyF.w * k);
  v = mix(v, v * mix(u_lvToneS.rgb, u_lvToneH.rgb, t), mix(u_lvToneS.w, u_lvToneH.w, t) * k);
  vec3 fl = lvSkyPx > 0.5 ? u_lvSkyF.rgb : u_lvLift.rgb;
  return clamp(1.0 - (1.0 - clamp(v, 0.0, 1.0)) * (1.0 - fl), 0.0, 1.0);
#else
  return c;
#endif
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
