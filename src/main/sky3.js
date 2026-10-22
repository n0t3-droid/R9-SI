// ============================================================================
// t-sky3 · WOW V · Der Himmel (plan docs/superpowers/plans/2026-10-16-t-sky3.md): the sky perfected — the clouds with
// volume, the golden hour, the dusk and the dawn in layered bands with a sun disc and the afterglow, the earth's shadow,
// the night with its two moons in their phases, shooting stars and on some nights an aurora, the giant pale in the day
// sky, the scud under a rain deck. Pure (no GL): the switches and their defaults per preset, the settings rows, the
// seeded schedules (the same for the host and every guest: VR.WX's hash of the world's seed and tick), the moons'
// places and phases, the light the clouds get by the hour, the per-frame values (env.js calls S3.frame), the uniforms
// (sky3_gl.js uploads them, the offline renderer mirrors them) and the GLSL text the shaders include under their
// defines (with the switches off every program compiles from the same text as before: test/sky3.js b). Loads before
// shaders.js (build.js MAIN, after light2).
//   sky3      Himmel 0 · 1 · 2 — 1 (Low, 🟢): the golden and dusk bands, the sun's disc, the afterglow, the earth's shadow,
//             the moons in their phases, the shooting stars, the bright stars twinkling, the giant pale by day (SKY3);
//             2 (Balanced and up): and the aurora, the far cloud decks, the sun's ray fan through the cloud gaps (SKY3HI)
//   cloudVol  Wolken mit Volumen — the cumulus sprites lit as volumes: sunlit tops, shadowed bases, the silver lining,
//             powder edges, the colour of the hour; the scud under a rain deck (CLOUD3; where the clouds are sprites)
// ============================================================================
(function (VR) {
  'use strict';
  const S3 = VR.Sky3 = VR.Sky3 || {};
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const sstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  const mix = (a, b, t) => a + (b - a) * t;
  const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
  const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const TAU = Math.PI * 2, DAY = 24000;
  // the world's hash (weather.js VR.WX.hash01 — the same numbers on every machine); a copy when weather.js is not loaded
  const mix32 = (h) => { h = Math.imul(h ^ (h >>> 16), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); return (h ^ (h >>> 16)) >>> 0; };
  function hash01(seed, a, b, c) {
    if (VR.WX && VR.WX.hash01) return VR.WX.hash01(seed, a, b, c);
    let h = mix32((seed ^ 0x2545f491) >>> 0);
    h = mix32((h ^ Math.imul((a | 0) + 0x9e37, 0x27d4eb2d)) >>> 0);
    h = mix32((h ^ Math.imul((b | 0) + 0x85eb, 0x165667b1)) >>> 0);
    h = mix32((h ^ Math.imul((c | 0) + 0xc2b2, 0x9e3779b1)) >>> 0);
    return h / 4294967296;
  }

  // ---------------------------------------------------------------- the switches
  S3.SW = ['sky3', 'cloudVol'];
  S3.MAX = { sky3: 2 };
  const OFF = { sky3: 0, cloudVol: false };
  const TIERS = {
    potato: OFF,
    low: { sky3: 1, cloudVol: false },
    balanced: { sky3: 2, cloudVol: true },
    high: { sky3: 2, cloudVol: true },
    ultra: { sky3: 2, cloudVol: true },
    ultraLite: { sky3: 2, cloudVol: true },
  };
  S3.defaults = (preset) => Object.assign({}, TIERS[preset] || TIERS.balanced);
  S3.off = () => Object.assign({}, OFF);
  // the settings rows (settings_reg.js adds them): Bild · Licht & Schatten — Himmel; Bild · Dinge & Effekte — the clouds
  S3.ROWS = [
    { key: 'sky3', g: 'img', sec: 'light', t: 'slider', lab: 'g.set.sky3', tip: 'g.set.sky3.tip', cost: 'low', def: 2, min: 0, max: 2, step: 1, vals: 'g.set.sky3V' },
    { key: 'cloudVol', g: 'img', sec: 'objects', t: 'switch', lab: 'g.set.cloudVol', tip: 'g.set.cloudVol.tip', cost: 'mid', def: true },
  ];
  // the renderer's settings (renderer.buildPrograms hands them over: S3.use)
  S3.q = OFF;
  S3.use = function (q) { S3.q = q || OFF; return S3.q; };
  S3.level = (q) => { q = q || S3.q; return q && !q.lite ? Math.max(0, Math.min(2, q.sky3 | 0)) : 0; };
  S3.vol = (q) => { q = q || S3.q; return !!(q && !q.lite && q.cloudVol && (q.clouds | 0) >= 2); };
  S3.key = (q) => S3.level(q) + ':' + (S3.vol(q) ? 1 : 0) + ':' + ((q && q.clouds) | 0);
  // the defines by program: the sky pass and the box clouds take SKY3 (the cheap set), the sky SKY3HI too (the full
  // set), the cumulus sprites CLOUD3; nothing else (the land's light stays t-light2's)
  S3.definesFor = function (name, q) {
    q = q || S3.q;
    const lv = S3.level(q), out = [];
    if (name === 'sky') { if (lv >= 1) out.push('SKY3'); if (lv >= 2) out.push('SKY3HI'); }
    else if (name === 'cloud') { if (lv >= 1) out.push('SKY3'); }
    else if (name === 'puff') { if (S3.vol(q)) out.push('CLOUD3'); }
    return out;
  };
  // gl.js asks GL.defineHook once per program: the light's hook (light2.js) first, then the sky's
  S3.hook = function (name, defines) {
    const extra = S3.definesFor(name);
    if (!extra.length) return defines;
    return (defines || []).concat(extra.filter(d => !(defines || []).includes(d)));
  };
  if (VR.GL && !VR.GL.__s3) {
    const prev = VR.GL.defineHook || null;
    VR.GL.defineHook = (name, defines) => S3.hook(name, prev ? prev(name, defines) : (defines || []));
    VR.GL.__s3 = true;
  }

  // ---------------------------------------------------------------- the sun's path and the two moons
  // the sun's direction at the day's angle th (env.js: 0 sunrise, π/2 noon — its elevation peaks at 0.42 rad)
  const sunPath = (th) => { const el = Math.sin(th) * 0.42, az = th + 0.4; return [Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)]; };
  S3.sunPath = sunPath;
  // the moons ride the sun's path, each with its own month: δ, its place along the path from the antisolar point (0 =
  // opposite the sun: full; ±π: with the sun: new), and a small tilt off the path. The big moon (Mond) swings ±amp round
  // the antisolar point — gibbous to full every night, the night's light from its side (env.js keeps E.moonDir, the land's
  // light, opposite the sun); the small one (Trabant) runs a full month of `period` days, so it passes every phase — a
  // thin crescent beside the setting sun on some evenings, a half moon high in the late afternoon on others
  const MOONS = S3.MOONS = [
    { r: 0.044, period: 8, amp: 0.75, tilt: 0.1, tiltP: 5.3, ph: 0.6, albedo: [0.86, 0.85, 0.88] },
    { r: 0.0235, period: 3.1, amp: Math.PI, tilt: 0.16, tiltP: 7.7, ph: 2.1, albedo: [0.94, 0.86, 0.78] },
  ];
  // the illuminated fraction and the lit limb of a body at C lit from the direction L (both unit, from the eye): the
  // fraction (1 − cos e) / 2 of the elongation e; the lit limb's direction in the disc's frame (the shader's: X =
  // cross(up, C), Y = cross(C, X)) — the sun's direction projected on the disc
  S3.moonPhase = function (C, L) {
    const e = Math.acos(clamp(dot(C, L), -1, 1)), k = (1 - Math.cos(e)) / 2;
    const up = Math.abs(C[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0], X = norm(cross(up, C)), Y = cross(C, X);
    const lx = dot(L, X), ly = dot(L, Y), l = Math.hypot(lx, ly);
    return { k, e, lit: l > 1e-6 ? [lx / l, ly / l] : [1, 0] };
  };
  // the moons at the world's tick A (day × 24 000 + the time of day): direction, angular radius, phase, lit limb
  S3.moonsAt = function (A, sunDir) {
    const d = A / DAY, th = (((A % DAY) + DAY) % DAY) / DAY * TAU, out = [];
    for (const M of MOONS) {
      const del = M.amp >= Math.PI ? ((d / M.period + M.ph / TAU) % 1) * TAU - Math.PI : M.amp * Math.sin(d / M.period * TAU + M.ph);
      const p = sunPath(th + Math.PI + del), tl = M.tilt * Math.sin(d / M.tiltP * TAU + M.ph * 1.7);
      const dir = norm([p[0], p[1] + tl, p[2]]);
      const ph = S3.moonPhase(dir, sunDir);
      out.push({ dir, r: M.r, k: ph.k, lit: ph.lit, del });
    }
    return out;
  };

  // ---------------------------------------------------------------- the shooting stars
  // a slot of MET.slot ticks (80 s) holds one with the chance MET.p (one in ~89 s), starting somewhere in it and ending in
  // it: dur seconds long, from a point high in the sky (24°–69°) along an arc of 7°–20° down the sky (within ±55° of
  // straight down); bright 0.6–1, now and then a fireball (×1.7). Seen only in a dark sky (meteorVis)
  const MET = S3.MET = { slot: 1600, p: 0.9, dur: [0.5, 1.5], arc: [0.12, 0.35], el: [0.42, 1.2], fire: 0.12 };
  function meteorSlot(seed, k) {
    const s = seed == null ? 0 : seed;
    if (hash01(s, k, 0x6d1, 0) >= MET.p) return null;
    const dur = MET.dur[0] + hash01(s, k, 0x6d2, 0) * (MET.dur[1] - MET.dur[0]);
    const A = k * MET.slot + hash01(s, k, 0x6d3, 0) * (MET.slot - dur * 20 - 1);
    const az = hash01(s, k, 0x6d4, 0) * TAU, el = MET.el[0] + hash01(s, k, 0x6d5, 0) * (MET.el[1] - MET.el[0]);
    const from = [Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)];
    const tUp = norm([-from[0] * from[1], 1 - from[1] * from[1], -from[2] * from[1]]), tSide = cross(from, tUp);
    const a = (hash01(s, k, 0x6d6, 0) - 0.5) * 1.9, arc = MET.arc[0] + hash01(s, k, 0x6d7, 0) * (MET.arc[1] - MET.arc[0]);
    const dirT = [-tUp[0] * Math.cos(a) + tSide[0] * Math.sin(a), -tUp[1] * Math.cos(a) + tSide[1] * Math.sin(a), -tUp[2] * Math.cos(a) + tSide[2] * Math.sin(a)];
    const to = norm([from[0] * Math.cos(arc) + dirT[0] * Math.sin(arc), from[1] * Math.cos(arc) + dirT[1] * Math.sin(arc), from[2] * Math.cos(arc) + dirT[2] * Math.sin(arc)]);
    const bright = (0.6 + 0.4 * hash01(s, k, 0x6d8, 0)) * (hash01(s, k, 0x6d9, 0) < MET.fire ? 1.7 : 1);
    return { k, A, dur, from, to, bright, hue: hash01(s, k, 0x6da, 0) };
  }
  S3.meteorSlot = meteorSlot;
  // the shooting star in flight at tick A (null when none): its slot's record, its progress p (0..1) and its brightness
  // now (a quick rise, a long fade)
  S3.meteorAt = function (seed, A) {
    const m = meteorSlot(seed, Math.floor(A / MET.slot));
    if (!m || A < m.A || A >= m.A + m.dur * 20) return null;
    const p = (A - m.A) / (m.dur * 20);
    return Object.assign({}, m, { p, bright: m.bright * sstep(0, 0.12, p) * (1 - sstep(0.6, 1, p)) });
  };
  // the next one that has not ended at tick A, within `slots` slots (the test and the browser test aim at it)
  S3.meteorNext = function (seed, A, slots) {
    const k0 = Math.floor(A / MET.slot);
    for (let k = k0; k <= k0 + (slots || 1); k++) { const m = meteorSlot(seed, k); if (m && m.A + m.dur * 20 > A) return m; }
    return null;
  };
  // how much of it a sky shows: none by day, all of it in the night (E.night)
  S3.meteorVis = (night) => sstep(0.5, 0.9, night || 0);

  // ---------------------------------------------------------------- the aurora
  // seeded per night (the night of day n: its sunset at n × 24 000 + 12 000 to the next sunrise): about one in three
  // (AUR.p) has one, its strength 0.55–1 and its own curtains (a seed); it rises after dusk once the sun is ~10° under the
  // horizon, breathes over minutes, fades before the dawn; rain or a closed sky hides it. At the north horizon (yaw 0
  // looks along −z): the curtains over ±span round north, from el[0] to el[1] (radians) over the horizon
  const AUR = S3.AURORA = { p: 0.34, az: 0, span: 1.45, el: [0.03, 0.62], k: [0.55, 1] };
  S3.auroraNight = function (seed, n) {
    const s = seed == null ? 0 : seed;
    if (hash01(s, n, 0xa51, 0) >= AUR.p) return 0;
    return AUR.k[0] + hash01(s, n, 0xa52, 0) * (AUR.k[1] - AUR.k[0]);
  };
  S3.auroraSeed = (seed, n) => hash01(seed == null ? 0 : seed, n, 0xa53, 0) * 100;
  S3.auroraAt = function (seed, A, sunY, rain, cover) {
    const tod = ((A % DAY) + DAY) % DAY;
    if (tod < 12000) return 0;
    const k = S3.auroraNight(seed, Math.floor(A / DAY));
    if (!(k > 0)) return 0;
    const dark = 1 - sstep(-0.24, -0.12, sunY), breathe = 0.78 + 0.22 * Math.sin(A / 20 / 170 * TAU + k * 9);
    return k * dark * breathe * (1 - clamp(rain || 0, 0, 1)) * (1 - sstep(0.55, 0.9, cover || 0));
  };

  // ---------------------------------------------------------------- the palette by the hour (env.js asks with the level on)
  // VR.Sky's day and night palettes and, between them, t-sky3's golden hour and dusk: the golden hour (the frames t1_07 /
  // t1_09) a luminous pastel sky — a pink-white horizon, pink, lavender, violet at the top (L* 51: the space faint); the
  // dusk (t1_01 / t1_03 / t3_01 / t3_02) a lavender-white horizon away from the sun, violet, a navy top with the nebula.
  // Each: hor, mid, zen (linear HDR before the exposure), stops [h1, h2a, h2b, halo]; space: the share of the day's space
  // over the top (stars, nebula); sunset: the warm glow's strength (env.js E.sunset's factor). Fitted through this
  // model of the sky (test/sky3_model.js: the gradient, the glows and t-sky3's layers through the composite and
  // t-light2's grade, sampled as test/sky3.mjs measures) to the frames' bands (docs/trailer/sky_ref.json)
  const PAL = S3.PAL = {
    gold: { hor: [1.44, 1.147, 1.652], mid: [0.5, 0.323, 0.541], zen: [0.114, 0.141, 0.381], stops: [0.386, 0.297, 0.837, 0.5], space: 0.15, sunset: 0.6 },
    dusk: { hor: [0.476, 0.504, 1.522], mid: [0.247, 0.279, 0.639], zen: [0.019, 0.046, 0.122], stops: [0.265, 0.373, 0.629, 0.45], space: 0.9, sunset: 0.2 },
  };
  // the weights by the sun's height: the day above ~17°, the golden hour from ~10° down to the horizon (fading by −1°), the
  // dusk round the sunset and after it, the night (env.js's) under ~−16°
  S3.weights = function (sy) {
    const el = Math.asin(clamp(sy, -1, 1)) * 180 / Math.PI;
    const night = 1 - sstep(-0.28, -0.1, sy), day = sstep(10, 17, el), gold = (1 - day) * sstep(-1, 4, el);
    return { day, gold, dusk: Math.max(0, 1 - day - gold - night), night, el };
  };
  // the palette at the sun's height sy: SKY = VR.Sky (its day and night palettes, its space); returns {hor, mid, zen,
  // stops, space (u_skySpace's four), sunset (factor)}
  S3.palette = function (sy, SKY) {
    const w = S3.weights(sy), D = SKY.day, N = SKY.night, G = PAL.gold, K = PAL.dusk;
    const m = (k) => [0, 1, 2].map(i => D[k][i] * w.day + G[k][i] * w.gold + K[k][i] * w.dusk + N[k][i] * w.night);
    const stops = [0, 1, 2, 3].map(i => D.stops[i] * w.day + G.stops[i] * w.gold + K.stops[i] * w.dusk + N.stops[i] * w.night);
    // the space: by day VR.Sky.space (full over the blue band), the golden hour a share of it, at dusk t-sky's spaceDusk
    const sd = SKY.spaceDusk, sp = SKY.space;
    const space = [sd[0] + (sp[0] - sd[0]) * (w.day + w.gold), sd[1] + (sp[1] - sd[1]) * (w.day + w.gold), sp[2] * w.day + sp[2] * G.space * w.gold + K.space * w.dusk + sd[2] * w.night, SKY.nebDay * (w.day + w.gold) + sd[3] * (w.dusk + w.night)];
    return { hor: m('hor'), mid: m('mid'), zen: m('zen'), stops, space, sunset: w.day + G.sunset * w.gold + K.sunset * w.dusk + w.night, w };
  };
  // ---------------------------------------------------------------- the sky's layers by the hour (SKY3)
  // warm / warm2: the sun-side band — gold at the horizon toward the sun, peach-pink over it (band height: dir.y) — its
  // strength by the sun's elevation: from the golden hour through the sunset into the afterglow (gone by −9°); reach: how
  // far round the sky it reaches (an exponent of the azimuth's distance: wide at the golden hour, gathered at dusk) and the
  // whole sky's lean toward the sun's side (lean, leanR); shade / belt: the earth's shadow opposite the sun at dusk and
  // dawn, a blue-grey band rising as the sun sinks, the pink belt over it; sun: the disc's radius (rad; larger at the
  // horizon), its limb's softness, its brightness, the corona
  const SKYL = S3.SKYL = {
    warm: [[-9, [0, 0, 0]], [-4, [0.36, 0.13, 0.1]], [-0.5, [0.8, 0.36, 0.17]], [3, [0.7, 0.42, 0.22]], [9, [0.45, 0.36, 0.26]], [16, [0, 0, 0]]],
    warm2: [[-9, [0, 0, 0]], [-4, [0.26, 0.09, 0.17]], [-0.5, [0.52, 0.22, 0.3]], [3, [0.48, 0.27, 0.34]], [9, [0.3, 0.22, 0.3]], [16, [0, 0, 0]]],
    height: [[-9, 0.06], [0, 0.12], [9, 0.2], [16, 0.25]],
    reach: [[-9, 12], [0, 30], [6, 18], [16, 12]],
    lean: [[-6, 0], [-1, 0.02], [4, 0.03], [10, 0.02], [16, 0]], leanR: 1.6,
    shade: [0.13, 0.15, 0.3], belt: [0.34, 0.17, 0.26], shadeK: [[-12, 0], [-8, 0.5], [-2, 0.72], [1.5, 0.3], [4, 0]],
    sun: { r: 0.0185, rHor: 0.006, soft: 0.0035, k: 9, corona: 1.1 },
    // the aureole: a wide soft glow round the sun (exp((cos θ − 1)·k): k 30 is ~15° to half), white-gold by day's end,
    // gold-peach at the sunset, rose in the afterglow
    glow: [[-7, [0, 0, 0]], [-3, [0.3, 0.1, 0.08]], [0, [1.0, 0.5, 0.22]], [4, [1.2, 0.85, 0.5]], [9, [0.9, 0.74, 0.52]], [16, [0, 0, 0]]],
    glowK: [[-6, 10], [0, 20], [8, 36], [16, 50]],
  };
  const stops = (tab, el) => {
    if (el <= tab[0][0]) return tab[0][1].slice();
    for (let i = 1; i < tab.length; i++) if (el <= tab[i][0]) { const a = tab[i - 1], b = tab[i], t = sstep(0, 1, (el - a[0]) / (b[0] - a[0])); return mix3(a[1], b[1], t); }
    return tab[tab.length - 1][1].slice();
  };
  const stop1 = (tab, el) => {
    if (el <= tab[0][0]) return tab[0][1];
    for (let i = 1; i < tab.length; i++) if (el <= tab[i][0]) { const a = tab[i - 1], b = tab[i], t = sstep(0, 1, (el - a[0]) / (b[0] - a[0])); return a[1] + (b[1] - a[1]) * t; }
    return tab[tab.length - 1][1];
  };
  S3.stops = stops; S3.stop1 = stop1;
  S3.skyLayers = function (E) {
    const el = Math.asin(clamp(E.sunDir[1], -1, 1)) * 180 / Math.PI, clear = 1 - clamp(E.rain || 0, 0, 1) * 0.85;
    const warm = stops(SKYL.warm, el).map(v => v * clear), warm2 = stops(SKYL.warm2, el).map(v => v * clear);
    const hgt = stop1(SKYL.height, el), sk = stop1(SKYL.shadeK, el) * clear, reach = stop1(SKYL.reach, el), lean = stop1(SKYL.lean, el) * clear;
    const glow = stops(SKYL.glow, el).map(v => v * clear), glowK = stop1(SKYL.glowK, el);
    // the earth's shadow's top: low at the sunset, rising as the sun sinks (dir.y)
    const top = 0.025 + 0.011 * Math.max(0, -el + 1);
    return { warm, warm2, hgt, reach, lean, leanR: SKYL.leanR, glow, glowK, shade: SKYL.shade, belt: SKYL.belt, shadeK: sk, top, el };
  };

  // ---------------------------------------------------------------- the clouds with volume: the atlas
  // Four cumulus in a 2 × 2 grid of 128² cells (256² RGBA8, the layout of clouds.js atlas: a sprite keeps its variant).
  // Each is a 3-D cumulus seen from the side: a flat base, a row of big core lobes on it, smaller lobes heaped on top
  // (taller in the middle), and the cauliflower's small bumps on the big ones; per texel the view ray (along −z) meets the
  // lobes analytically: R the cloud's thickness along the ray (0..1 of 2.4 radii: the coverage and the light through it),
  // G and B the outward normal of its front surface (x right, y up; 0.5 none; its z from them), A the occlusion (the
  // creases where lobes meet and the base darker; 1 open). Made once (~30 ms), deterministic.
  const ATL = S3.ATLAS = { size: 256, cell: 128, base: -0.44, thick: 2.4 };
  function vn2(x, y, s) {   // smooth value noise in [0, 1)
    const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const h = (a, b) => hash01(s, a, b, 0x5c3);
    return (h(i, j) + (h(i + 1, j) - h(i, j)) * u) * (1 - v) + (h(i, j + 1) + (h(i + 1, j + 1) - h(i, j + 1)) * u) * v;
  }
  // the lobes of variant k: [x, y, z, r]
  S3.cloudLobes = function (k) {
    const R = (a) => hash01(0x51c3 + k * 7919, a, k, 0x77);
    const L = [], base = ATL.base;
    // the core: three to five big lobes sitting on the base
    const nc = 3 + Math.floor(R(1) * 3), w = 0.5 + R(2) * 0.18;
    for (let i = 0; i < nc; i++) {
      const t = nc === 1 ? 0 : i / (nc - 1) * 2 - 1, r = 0.27 + 0.1 * R(10 + i) + 0.07 * (1 - Math.abs(t));
      L.push([t * w + (R(20 + i) - 0.5) * 0.08, base + r * 0.62, (R(30 + i) - 0.5) * 0.24, r]);
    }
    // the heap: smaller lobes on top, taller toward the middle (a tower at a seeded place)
    const tx = (R(3) - 0.5) * 0.4, nh = 5 + Math.floor(R(4) * 4);
    for (let i = 0; i < nh; i++) {
      const a = (i + 0.5) / nh * 2 - 1, x = a * (w * 0.85) + (R(40 + i) - 0.5) * 0.12, tall = Math.exp(-((x - tx) * (x - tx)) / 0.12);
      const r = 0.17 + 0.09 * R(50 + i) + 0.06 * tall;
      L.push([x, base + 0.38 + tall * (0.26 + 0.2 * R(60 + i)) + (R(70 + i) - 0.5) * 0.08, (R(80 + i) - 0.5) * 0.3, r]);
    }
    // the cauliflower: small bumps on the upper surfaces of the lobes so far
    const big = L.slice(), nb = 22 + Math.floor(R(5) * 12);
    for (let i = 0; i < nb; i++) {
      const p = big[Math.floor(R(90 + i) * big.length)], th = (R(100 + i) * 0.9 + 0.05) * Math.PI, ph = (R(110 + i) - 0.5) * 1.2;
      const dx = Math.cos(th) * Math.cos(ph), dy = Math.sin(th) * Math.cos(ph), dz = Math.sin(ph);
      const r = 0.07 + 0.08 * R(120 + i);
      L.push([p[0] + dx * p[3] * 0.88, p[1] + dy * p[3] * 0.88, p[2] + dz * p[3] * 0.88, r]);
    }
    // inside the sprite: x, y within ±(1 − r) (the quad spans ±1)
    const ymax = Math.max(...L.map(l => l[1] + l[3])), xmax = Math.max(...L.map(l => Math.abs(l[0]) + l[3]));
    const sc = Math.min(1, 0.96 / Math.max(xmax, ymax - base * 0 + 0.001), 0.96 / Math.max(0.5, ymax));
    return L.map(l => [l[0] * sc, base + (l[1] - base) * sc, l[2] * sc, l[3] * sc]);
  };
  // the front and back surfaces as a smooth union of the lobes (a polynomial smooth max of their heights: the creases
  // where lobes meet are rounded valleys, not seams), the normals from the front's slopes, the creases' occlusion from the
  // front under its own blur, a fine noise for the powder; thickness = front − back
  const smax = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.max(a, b) + h * h * k * 0.25; };
  S3.atlas = function () {
    if (S3._atlas) return S3._atlas;
    const S = ATL.size, N = ATL.cell, out = new Uint8Array(S * S * 4), base = ATL.base, K = 0.07, NEG = -9;
    const F = new Float32Array(N * N), B = new Float32Array(N * N), FB = new Float32Array(N * N), tmp = new Float32Array(N * N);
    for (let k = 0; k < 4; k++) {
      const L = S3.cloudLobes(k), ox = (k % 2) * N, oy = Math.floor(k / 2) * N, seed = 0x77 + k;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const x = (i + 0.5) / N * 2 - 1, y = (j + 0.5) / N * 2 - 1, q0 = j * N + i;
        const wob = 1 + 0.07 * (vn2(x * 9 + k * 3.1, y * 9 - k, seed) - 0.5) + 0.04 * (vn2(x * 23, y * 23, seed + 5) - 0.5);
        let f = NEG, b = -NEG;
        for (let q = 0; q < L.length; q++) {
          const l = L[q], dx = x - l[0], dy = y - l[1], r = l[3] * wob, d2 = dx * dx + dy * dy;
          if (d2 >= r * r) continue;
          const h = Math.sqrt(r * r - d2);
          f = f === NEG ? l[2] + h : smax(f, l[2] + h, K);
          b = b === -NEG ? l[2] - h : -smax(-b, -(l[2] - h), K);
        }
        // a fine relief on the front (the powder's small puffs)
        if (f !== NEG) f += 0.009 * (vn2(x * 12 + k, y * 12, seed + 11) - 0.5) + 0.004 * (vn2(x * 27, y * 27 + k, seed + 12) - 0.5);
        F[q0] = f; B[q0] = b;
      }
      // the front blurred (a box of ±6 texels, separable; outside the cloud the front counts as the base plane)
      const R6 = 6, val = (q) => (F[q] === NEG ? -0.3 : F[q]);
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { let a = 0, n = 0; for (let d = -R6; d <= R6; d++) { const ii = i + d; if (ii < 0 || ii >= N) continue; a += val(j * N + ii); n++; } tmp[j * N + i] = a / n; }
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { let a = 0, n = 0; for (let d = -R6; d <= R6; d++) { const jj = j + d; if (jj < 0 || jj >= N) continue; a += tmp[jj * N + i]; n++; } FB[j * N + i] = a / n; }
      const h2 = 2 / N;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const q0 = j * N + i, o = ((oy + j) * S + (ox + i)) * 4, y = (j + 0.5) / N * 2 - 1;
        const cut = clamp((y - base - 0.025 * (vn2((i + 0.5) / N * 11 + k, 3.7, seed + 13) - 0.5)) / 0.025, 0, 1);
        if (F[q0] === NEG || cut <= 0) { out[o] = 0; out[o + 1] = 128; out[o + 2] = 128; out[o + 3] = 255; continue; }
        const at = (ii, jj) => { ii = clamp(ii, 0, N - 1); jj = clamp(jj, 0, N - 1); const v = F[jj * N + ii]; return v === NEG ? F[q0] - 0.06 : v; };
        const gx = (at(i + 1, j) - at(i - 1, j)) / (2 * h2), gy = (at(i, j + 1) - at(i, j - 1)) / (2 * h2);
        let nx = -gx, ny = -gy, nz = 1;
        // near the base the surface turns down (the flat bottom seen at a slant)
        const bt = 1 - clamp((y - base) / 0.16, 0, 1);
        ny = ny * (1 - bt) - bt * 1.4;
        const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl;
        const cav = Math.max(0, FB[q0] - F[q0]);
        const ao = clamp(1 - 6.5 * cav - 0.3 * bt, 0.22, 1);
        const th = clamp((F[q0] - B[q0]) / ATL.thick, 0, 1) * (cut < 1 ? cut * cut : 1);   // (the base stays thick to its edge: a dark flat bottom, not a thin glowing rim)
        out[o] = Math.round(th * 255);
        out[o + 1] = Math.round((nx * 0.5 + 0.5) * 255);
        out[o + 2] = Math.round((ny * 0.5 + 0.5) * 255);
        out[o + 3] = Math.round(ao * 255);
      }
    }
    return (S3._atlas = out);
  };

  // ---------------------------------------------------------------- the clouds' light by the hour
  // The sun's light on the clouds by its elevation (degrees): white by day, gold at the golden hour, deep gold-orange at
  // the horizon, rose round the sunset and for a while after it (the clouds high up still see the sun), gone by −9°; then
  // the moon's grey-blue. The sky's light on their upper sides (top) and the light from below — the ground's bounce and the
  // horizon (low) — by the same hour. Rain greys and dims it all (the deck's diffuse light).
  const CL = S3.CLOUDLIGHT = {
    sun: [[-9, [0, 0, 0]], [-5, [0.42, 0.22, 0.28]], [-1.5, [0.95, 0.48, 0.42]], [2, [1.2, 0.7, 0.5]], [8, [1.28, 0.92, 0.72]], [16, [1.22, 1.14, 1.04]]],
    top: [[-12, [0.05, 0.06, 0.11]], [-4, [0.28, 0.25, 0.42]], [2, [0.46, 0.41, 0.58]], [8, [0.52, 0.5, 0.64]], [16, [0.5, 0.56, 0.72]]],
    low: [[-12, [0.035, 0.04, 0.07]], [-4, [0.2, 0.15, 0.24]], [2, [0.32, 0.25, 0.34]], [8, [0.35, 0.31, 0.42]], [16, [0.39, 0.37, 0.5]]],   // (the bases lavender-grey, t1_05)
    moon: [0.1, 0.12, 0.19], rainGrey: [0.42, 0.44, 0.48], k: [1.0, 1.0, 0.3, 0.5],
  };
  S3.cloudLight = function (E) {
    const sy = clamp(E.sunDir[1], -1, 1), el = Math.asin(sy) * 180 / Math.PI, rain = clamp(E.rain || 0, 0, 1);
    let sun = stops(CL.sun, el), L = E.sunDir;
    const moonK = 1 - sstep(-9, -5, el);
    if (moonK > 0) { const m = E.sky3 && E.sky3.moons ? 0.35 + 0.65 * E.sky3.moons[0].k : 1; sun = mix3(sun, CL.moon.map(v => v * m), moonK); if (moonK > 0.5) L = E.moonDir; }
    let top = stops(CL.top, el), low = stops(CL.low, el);
    const dayK = sstep(-6, 6, el), grey = CL.rainGrey.map(v => v * (0.25 + 0.75 * dayK));
    sun = sun.map(v => v * (1 - 0.88 * rain)); top = mix3(top, grey, rain * 0.85); low = mix3(low, grey.map(v => v * 0.8), rain * 0.85);
    return { sun, top, low, L, el, grey };
  };

  // ---------------------------------------------------------------- the per-frame values (env.js calls it last)
  // env: the Env (its day, ticks, weather seed); E: its frame. E.sky3 holds the schedules' state and the uniforms (o.u:
  // name → Float32Array, filled in place: no allocation per frame for them); nothing of E's own values changes (with the
  // sky's level on env.js takes the palette of the golden hour and the dusk from S3.palette)
  const U4 = S3.U4 = ['u_s3Warm', 'u_s3Warm2', 'u_s3Reach', 'u_s3Glow', 'u_s3Shade', 'u_s3Belt', 'u_s3Sun', 'u_s3MoonA', 'u_s3MoonB', 'u_s3Night', 'u_s3Met', 'u_s3MetT', 'u_s3Neb', 'u_s3Rain', 'u_s3Drift', 'u_s3Aur', 'u_s3Bank', 'u_s3Fan', 'u_s3Cir', 'u_s3Field', 'u_c3K'];
  const U3 = S3.U3 = ['u_c3Sun', 'u_c3Top', 'u_c3Low', 'u_c3Ld', 'u_c3Haze'];
  S3.state = function () {
    const u = {};
    for (const k of U4) u[k] = new Float32Array(4);
    for (const k of U3) u[k] = new Float32Array(3);
    return { level: 0, vol: false, moons: null, meteor: null, aurora: 0, auroraSeed: 0, bodies: [], u };
  };
  const set4 = (a, x, y, z, w) => { a[0] = x; a[1] = y; a[2] = z; a[3] = w; };
  const set3 = (a, v, k) => { k = k === undefined ? 1 : k; a[0] = v[0] * k; a[1] = v[1] * k; a[2] = v[2] * k; };
  // the slerp of two unit directions
  const slerp = (a, b, t) => { const c = clamp(dot(a, b), -1, 1), w = Math.acos(c); if (w < 1e-5) return a.slice(); const s = Math.sin(w), p = Math.sin((1 - t) * w) / s, q = Math.sin(t * w) / s; return norm([a[0] * p + b[0] * q, a[1] * p + b[1] * q, a[2] * p + b[2] * q]); };
  S3.frame = function (E, env) {
    const lv = S3.level(), vol = S3.vol();
    const o = E.sky3 || (E.sky3 = S3.state()), u = o.u;
    o.level = lv; o.vol = vol;
    if (!lv && !vol) { o.moons = null; o.meteor = null; o.aurora = 0; o.bodies.length = 0; return o; }
    const A = (env.day | 0) * DAY + env.timeOfDay, seed = env.wx ? env.wx.seed : 0, over = (E.dimId | 0) === 0;
    const rain = clamp(E.rain || 0, 0, 1), cover = clamp(E.cloudCover || 0, 0, 1), night = E.night || 0;
    o.A = A;
    // the sky's layers and the sun's disc
    const Y = S3.skyLayers(E), Su = SKYL.sun, k0 = over ? 1 : 0;
    set4(u.u_s3Warm, Y.warm[0], Y.warm[1], Y.warm[2], k0);
    set4(u.u_s3Warm2, Y.warm2[0], Y.warm2[1], Y.warm2[2], Y.hgt);
    set4(u.u_s3Reach, Y.reach, Y.lean * k0, Y.leanR, 0);
    set4(u.u_s3Glow, Y.glow[0] * k0, Y.glow[1] * k0, Y.glow[2] * k0, Y.glowK);
    set4(u.u_s3Shade, Y.shade[0], Y.shade[1], Y.shade[2], Y.top);
    set4(u.u_s3Belt, Y.belt[0], Y.belt[1], Y.belt[2], Y.shadeK * k0);
    set4(u.u_s3Sun, Su.r + Su.rHor * (1 - sstep(0, 0.2, E.sunDir[1])), Su.soft, Su.k, Su.corona);
    // the two moons in their phases (lit from the sun's true direction); by day pale in the blue
    o.moons = lv ? S3.moonsAt(A, E.sunDir) : null;
    o.bodies.length = 0;
    if (o.moons) for (const m of o.moons) o.bodies.push([m.dir[0], m.dir[1], m.dir[2], m.r]);
    const mA = o.moons ? o.moons[0] : null, mB = o.moons ? o.moons[1] : null;
    set4(u.u_s3MoonA, mA ? mA.dir[0] : 0, mA ? mA.dir[1] : -1, mA ? mA.dir[2] : 0, mA && over ? mA.r : 0);
    set4(u.u_s3MoonB, mB ? mB.dir[0] : 0, mB ? mB.dir[1] : -1, mB ? mB.dir[2] : 0, mB && over ? mB.r : 0);
    const occ = sstep(0.15, 0.75, night);
    set4(u.u_s3Night, occ, 0.035 + 0.03 * occ, (0.35 + 0.65 * night) * (1 - rain), over ? (1 - night) * (E.skyDay ? E.skyDay[2] : 0) : 0);
    // the shooting star: its head and its tail's end along its arc, its brightness (a dark sky only)
    const vis = S3.meteorVis(night) * (1 - rain) * (1 - sstep(0.6, 0.9, cover)) * k0;
    const m = vis > 0.001 && lv ? S3.meteorAt(seed, A) : null;
    o.meteor = m ? Object.assign(m, { vis: m.bright * vis }) : null;
    if (m) {
      const head = slerp(m.from, m.to, m.p), tail = slerp(m.from, m.to, Math.max(0, m.p - 0.4));
      set4(u.u_s3Met, head[0], head[1], head[2], m.bright * vis); set4(u.u_s3MetT, tail[0], tail[1], tail[2], m.hue < 0.25 ? 1 : 0);
    } else { set4(u.u_s3Met, 0, 1, 0, 0); set4(u.u_s3MetT, 0, 1, 0, 0); }
    // the nebula as smoke (the filaments faint, the swirl eased, the lanes soft); the rain's closed deck and its scud
    set4(u.u_s3Neb, 0.22, 0.4, over ? sstep(0.12, 0.55, rain) : 0, 0.35);
    // the high streaks by the hour: lit by the clouds' light from the afternoon through the afterglow, more of them round the sunset
    const elc = Math.asin(clamp(E.sunDir[1], -1, 1)) * 180 / Math.PI, golden = sstep(-6, -1, elc) * (1 - sstep(10, 18, elc));
    set4(u.u_s3Cir, 0.3 + 0.7 * golden * (1 - night), 0.55 * golden * (1 - rain), 0, 0);
    const C = S3.cloudLight(E);
    const deck = mix3(C.grey, C.top, 0.35);
    set4(u.u_s3Rain, deck[0], deck[1], deck[2], 0);
    const dr = E.cloudDrift, dx = dr ? dr[0] : (E.time || 0) * 0.9, dz = dr ? dr[1] : 0;
    set4(u.u_s3Drift, dx / 900, dz / 900, dx / 340, dz / 340);
    // the aurora (level 2): its strength, its curtains' seed, the time, its span round north
    o.aurora = lv >= 2 && over ? S3.auroraAt(seed, A, E.sunDir[1], rain, cover) : 0;
    o.auroraSeed = o.aurora > 0 ? S3.auroraSeed(seed, Math.floor(A / DAY)) : 0;
    set4(u.u_s3Aur, o.aurora, o.auroraSeed, (E.time || 0) % 10000, AUR.span);
    // the far banks (level 2): their cover, their drift (azimuth), the warmth of the sun's side; the ray fan round a low
    // sun through the cloud gaps (stronger the more cloud there is, none in the rain)
    const el = Y.el;
    set4(u.u_s3Bank, lv >= 2 && over ? clamp(0.12 + 0.8 * cover, 0, 0.95) * (1 - 0.95 * rain) : 0, dx / 2600, dz / 2600, 0);
    // the cumulus field beyond the sprites' window, in perspective on the cloud plane (y 210): the plane's height over the
    // eye and the eye in cloud space are the renderer's (sky3_gl.js sets x, y, z each frame); w the cover (level 2)
    u.u_s3Field[3] = lv >= 2 && over ? cover * (1 - 0.95 * rain) : 0;   // (in the rain the deck closes the sky: no far field, no banks)
    set4(u.u_s3Fan, lv >= 2 && over ? (1 - sstep(5, 14, el)) * sstep(-2.5, 0.5, el) * sstep(0.12, 0.45, cover) * (1 - rain) * 0.5 : 0, (E.time || 0) * 0.004, 0, 0);
    // the clouds' light (the sprites, the box clouds, the far banks)
    set3(u.u_c3Sun, C.sun); set3(u.u_c3Top, C.top); set3(u.u_c3Low, C.low); set3(u.u_c3Ld, C.L);
    const h = E.horizon || [0.6, 0.7, 0.8], mi = E.skyMid || h;
    u.u_c3Haze[0] = h[0] * 0.8 + mi[0] * 0.2; u.u_c3Haze[1] = h[1] * 0.8 + mi[1] * 0.2; u.u_c3Haze[2] = h[2] * 0.8 + mi[2] * 0.2;
    set4(u.u_c3K, CL.k[0], CL.k[1], CL.k[2], CL.k[3]);
    return o;
  };
  // the camera's axes (the renderer's camera: yaw 0 looks along −z): the billboards' frame
  S3.camAxes = function (cam) {
    const cy = Math.cos(cam.yaw || 0), sy = Math.sin(cam.yaw || 0), cp = Math.cos(cam.pitch || 0), sp = Math.sin(cam.pitch || 0);
    return { right: [cy, 0, -sy], up: [sy * sp, cp, cy * sp], fwd: [-sy * cp, sp, -cy * cp] };
  };
  // the light's direction in the billboard's frame (x right, y up, z toward the eye) — sky3_gl.js uploads it as u_c3L
  S3.billboardL = function (L, cam, out) {
    cam = cam || {};
    const cy = Math.cos(cam.yaw || 0), sy = Math.sin(cam.yaw || 0), cp = Math.cos(cam.pitch || 0), sp = Math.sin(cam.pitch || 0);
    out = out || [0, 0, 0];
    out[0] = L[0] * cy - L[2] * sy;                                   // · right (cy, 0, −sy)
    out[1] = L[0] * sy * sp + L[1] * cp + L[2] * cy * sp;             // · up (sy·sp, cp, cy·sp)
    out[2] = L[0] * sy * cp - L[1] * sp + L[2] * cy * cp;             // − · forward (−sy·cp, sp, −cy·cp)
    return out;
  };
  // the uniforms of this frame (name → numbers) for the offline mirror (test/sky3_model.js)
  S3.uniforms = function (E) { return E.sky3 ? E.sky3.u : null; };

  // ---------------------------------------------------------------- GLSL: the sky (COMMON includes it under SKY3)
  // s3Layers: the sun-side band (gold at the horizon toward the sun, peach-pink over it, falling off with the azimuth), the
  // whole sky's lean toward the sun, the earth's shadow opposite the sun with the pink belt over it, the rain's closed deck
  // with its scud; s3SunDisc: the sun a disc with a soft limb (a little limb darkening) in a warm corona, bright down to the
  // horizon; s3Moons: the two moons lit from the sun's direction (their phases), by day pale in the blue; s3Meteor: the
  // seeded shooting star, a head and a fading tail; s3Sparkle: a few bright stars twinkling with a soft cross; s3Pale: the
  // planets by day behind the sky's light. SKY3HI: s3Aurora (curtains over the north horizon), s3Banks (the far cloud banks
  // along the horizon, lit by the hour), s3Fan (the low sun's rays through the cloud gaps)
  S3.glslSky = () => `
uniform vec4 u_s3Warm;     // rgb the sun-side band's colour at the horizon (gold), w on (1) / off (0)
uniform vec4 u_s3Warm2;    // rgb the colour over it (peach-pink), w the band's height (dir.y)
uniform vec4 u_s3Reach;    // x how far round the sky the band reaches (an exponent), y the whole sky's lean toward the sun, z its reach
uniform vec4 u_s3Glow;     // rgb the aureole round the sun by the hour, w its tightness (exp((cos θ − 1)·w))
uniform vec4 u_s3Shade;    // rgb the earth's shadow, w its top (dir.y)
uniform vec4 u_s3Belt;     // rgb the belt over it, w the shadow's strength
uniform vec4 u_s3Sun;      // x the disc's radius (rad), y the limb's softness, z the disc's brightness, w the corona
uniform vec4 u_s3MoonA;    // the big moon: its direction, its angular radius (0: not drawn)
uniform vec4 u_s3MoonB;    // the small moon
uniform vec4 u_s3Night;    // x the night (the moons occlude the sky behind them), y the earthshine, z the bright stars' sparkle, w the bodies' paleness by day
uniform vec4 u_s3Met;      // the shooting star's head (direction), w its brightness (0: none)
uniform vec4 u_s3MetT;     // its tail's end (direction), w its hue (0 white-gold, 1 green)
uniform vec4 u_s3Neb;      // x the filaments' share, y the swirl's share, z the rain's closed deck, w the lit rims' share
uniform vec4 u_s3Rain;     // rgb the deck's underside
uniform vec4 u_s3Drift;    // xy the deck's drift, zw the scud's (faster, lower)
uniform vec4 u_s3Cir;      // the high streaks: x lit by the hour (the clouds' light), y more of them at the golden hour and the sunset
uniform vec3 u_c3Sun;      // the clouds' light (sky3.js cloudLight): the sun's on them, the sky's from above, the light from below, toward the light
uniform vec3 u_c3Top;
uniform vec3 u_c3Low;
uniform vec3 u_c3Ld;
float s3h1(float n) { n = fract(n * 0.1031); n *= n + 33.33; n *= n + n; return fract(n); }
float s3n1(float x) { float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(s3h1(i), s3h1(i + 1.0), f); }
vec3 s3Deck(vec3 col, vec3 dir) {
  float y = max(dir.y, 0.0) + 0.07;
  vec2 q = dir.xz / y * 0.32 + u_s3Drift.xy;
  float n = vnoise(q) * 0.6 + vnoise(q * 2.3 + 7.1) * 0.3 + vnoise(q * 5.1 - 3.7) * 0.1;
  float hz = 1.0 - smoothstep(0.0, 0.35, dir.y);
  vec3 c = u_s3Rain.rgb * (0.76 + 0.48 * n);
  c = mix(c, u_skyHorizon * 1.08, hz * 0.5);
  // the scud: torn darker rags under the deck, lower and faster with the wind, drawn out along it, their edges frayed
  vec2 wd = normalize(u_s3Drift.zw + vec2(1e-4, 0.0)), qw = dir.xz / y * 0.75 + u_s3Drift.zw;
  vec2 qs = vec2(dot(qw, wd) * 0.42, dot(qw, vec2(-wd.y, wd.x)));
  float sn = vnoise(qs) * 0.62 + vnoise(qs * 2.7 + 3.3) * 0.38 + (vnoise(qs * 7.0 - 1.9) - 0.5) * 0.2;
  float scud = smoothstep(0.56, 0.72, sn) * (1.0 - hz * 0.7);
  c = mix(c, u_s3Rain.rgb * 0.52, scud * 0.75);
  return mix(col, c, u_s3Neb.z * smoothstep(-0.04, 0.06, dir.y));
}
vec3 s3Layers(vec3 col, vec3 dir, float h) {
  vec2 sh = normalize(u_sunDir.xz + vec2(1e-5, 0.0)), dh = normalize(dir.xz + vec2(1e-5, 0.0));
  float az = 0.5 + 0.5 * dot(sh, dh);
  float side = exp(-(1.0 - az) * u_s3Reach.x);
  float hk = h / max(u_s3Warm2.w, 1e-3);
  float low = exp(-hk * hk * 2.2), up = exp(-(hk - 1.1) * (hk - 1.1) * 1.3);
  float broad = exp(-(1.0 - az) * u_s3Reach.z) * u_s3Reach.y * (1.0 - smoothstep(0.0, 0.7, h) * 0.6);
  col += (u_s3Warm.rgb * low + u_s3Warm2.rgb * (up * 0.65)) * (side * u_s3Warm.w) + u_s3Warm.rgb * broad;
  col += u_s3Glow.rgb * exp((dot(dir, u_sunDir) - 1.0) * u_s3Glow.w);   // the aureole
  if (u_s3Belt.w > 0.001) {
    float anti = smoothstep(0.15, 0.85, 1.0 - az);
    float top = u_s3Shade.w, sh0 = 1.0 - smoothstep(top * 0.75, top * 1.12, h);
    col = mix(col, u_s3Shade.rgb, sh0 * anti * u_s3Belt.w);
    float bt = (h - top * 1.4) / max(top * 0.5, 1e-3);
    col += u_s3Belt.rgb * (exp(-bt * bt) * anti * u_s3Belt.w);
  }
  if (u_s3Neb.z > 0.001) col = s3Deck(col, dir);
  return col;
}
vec3 s3SunDisc(vec3 dir, float sd) {
  float e = 1.0 - sd, th = sqrt(2.0 * e), r = u_s3Sun.x;
  float sl = dot(u_sunColor, vec3(0.3, 0.59, 0.11));
  vec3 sc = u_sunColor * (max(sl, 0.9) / max(sl, 1e-3));
  float disc = 1.0 - smoothstep(r - u_s3Sun.y, r + u_s3Sun.y, th);
  float q = clamp(th / r, 0.0, 1.0), limb = 0.72 + 0.28 * sqrt(1.0 - q * q);
  float t = th / (r * 4.0);
  return sc * (disc * limb * u_s3Sun.z + vec3(1.05, 0.82, 0.55) * u_s3Sun.w * (exp(-t * t * 3.0) * 0.6 + exp(-t * 1.6) * 0.25));
}
// one moon at M (direction, radius) lit from the sun: rgb its light, a its coverage
vec4 s3Moon(vec3 dir, vec4 M, float seed) {
  if (M.w <= 0.0 || 1.0 - dot(dir, M.xyz) > M.w * M.w * 0.6) return vec4(0.0);
  vec3 up = abs(M.y) < 0.95 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 X = normalize(cross(up, M.xyz)), Y = cross(M.xyz, X);
  vec2 q = vec2(dot(dir, X), dot(dir, Y)) / M.w;
  float r2 = dot(q, q);
  if (r2 >= 1.0) return vec4(0.0);
  float zz = sqrt(1.0 - r2);
  vec3 N = X * q.x + Y * q.y - M.xyz * zz;
  float ndl = dot(N, u_sunDir);
  float lit = smoothstep(-0.03, 0.1, ndl);
  // the face: soft dark plains and small bright craters
  float m1 = vnoise(q * 2.2 + seed), m2 = vnoise(q * 5.3 - seed * 1.7), m3 = vnoise(q * 12.0 + seed * 0.3);
  float alb = 0.84 - 0.24 * smoothstep(0.42, 0.68, m1 * 0.7 + m2 * 0.3) + 0.1 * (m3 - 0.5);
  vec3 tint = seed > 10.0 ? vec3(1.0, 0.92, 0.82) : vec3(0.92, 0.95, 1.0);
  return vec4(tint * alb * (lit * 1.25 + u_s3Night.y), smoothstep(1.0, 0.93, sqrt(r2)));
}
vec3 s3Moons(vec3 col, vec3 dir, float clear) {
  float n = u_s3Night.x;
  vec4 a = s3Moon(dir, u_s3MoonA, 3.1);
  col = mix(col, a.rgb * mix(0.5, 1.0, n) + col * (1.0 - n), a.a * clear);
  vec4 b = s3Moon(dir, u_s3MoonB, 17.3);
  col = mix(col, b.rgb * mix(0.5, 1.0, n) + col * (1.0 - n), b.a * clear);
  return col;
}
vec3 s3Meteor(vec3 dir) {
  if (u_s3Met.w <= 0.0) return vec3(0.0);
  vec3 head = u_s3Met.xyz, tail = u_s3MetT.xyz, ab = head - tail;
  float t = clamp(dot(dir - tail, ab) / max(dot(ab, ab), 1e-8), 0.0, 1.0);
  vec3 dd = dir - (tail + ab * t), dh = dir - head;
  float w2 = 5e-6;   // (the streak's core about 0.13° wide: a pixel or two)
  float core = exp(-dot(dd, dd) / w2) * t * t, glow = exp(-dot(dh, dh) / (w2 * 6.0));
  vec3 c = mix(vec3(1.0, 0.95, 0.84), vec3(0.62, 1.0, 0.78), u_s3MetT.w);
  return c * (core * 2.6 + glow * 5.0) * u_s3Met.w;
}
vec3 s3Sparkle(vec3 dir) {
  vec3 sp = dir * 40.0, g = floor(sp);
  float s = hash13(g + 71.0);
  if (s < 0.994) return vec3(0.0);
  vec3 c = g + 0.5 + (vec3(hash13(g + 2.1), hash13(g + 4.7), hash13(g + 6.3)) - 0.5) * 0.3;
  vec3 v = sp - c;
  vec3 t1 = normalize(cross(dir, vec3(0.0, 1.0, 0.0)) + vec3(1e-4, 0.0, 0.0)), t2 = cross(t1, dir);
  float x = dot(v, t1), y = dot(v, t2);
  float tw = 0.6 + 0.4 * sin(u_time * (1.7 + 2.6 * fract(s * 97.0)) + s * 911.0);
  float core = exp(-(x * x + y * y) * 260.0);
  float cr = exp(-abs(x) * 6.0 - y * y * 900.0) + exp(-abs(y) * 6.0 - x * x * 900.0);   // (the arms ~7 px at 720p, half a pixel thin)
  vec3 sc = mix(vec3(0.82, 0.9, 1.0), vec3(1.0, 0.88, 0.74), hash13(g + 9.9));
  return sc * (core * 6.0 + cr * 1.2) * tw * u_s3Night.z;
}
vec4 s3Pale(vec4 b, vec3 air) {
  float p = u_s3Night.w;
  vec3 c = b.a > 0.0 ? mix(b.rgb, air + b.rgb * 0.55, p) : b.rgb * (1.0 - 0.45 * p);   // (a glow round a body: fainter by day, no air added)
  return vec4(c, b.a * (1.0 - 0.3 * p));
}
// the box clouds (Low) lit by the hour: the sky from above, the light from below, the sun on the faces toward it
vec3 s3BoxCloud(vec3 n, float vh, float shade) {
  float ndl = max(dot(n, u_c3Ld), 0.0);
  vec3 amb = mix(u_c3Low, u_c3Top, clamp(n.y * 0.5 + 0.5, 0.0, 1.0) * (0.6 + 0.4 * vh));
  return amb * (0.6 + 0.4 * shade) + u_c3Sun * (ndl * 0.8 * (0.7 + 0.3 * vh));
}
#ifdef SKY3HI
uniform vec4 u_s3Aur;      // x the aurora's strength (0: none), y its curtains' seed, z the time (s), w its span round north (rad)
uniform vec4 u_s3Bank;     // x the far banks' cover (0: none), yz their drift
uniform vec4 u_s3Fan;      // x the ray fan's strength, y its drift
uniform vec4 u_s3Field;    // the cumulus field beyond the sprites: x the cloud plane over the eye (blocks), yz the eye in cloud space, w the cover
float s3BankA = 0.0;       // (the far banks' coverage of this pixel: the sky probe leaves them out — they are clouds)
vec3 s3Aurora(vec3 dir) {
  if (u_s3Aur.x <= 0.001 || dir.y < 0.0) return vec3(0.0);
  float az = atan(dir.x, -dir.z), span = u_s3Aur.w;
  float side = 1.0 - smoothstep(span * 0.55, span, abs(az));
  if (side <= 0.0) return vec3(0.0);
  float t = u_s3Aur.z, sd = u_s3Aur.y;
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    float x = az * (2.2 + fi * 0.9) + sd + fi * 3.7;
    float foot = 0.07 + fi * 0.05 + 0.035 * sin(x * 1.3 + t * 0.021) + 0.03 * (s3n1(x * 2.7 + t * 0.015) - 0.5);
    float above = dir.y - foot;
    if (above < -0.02) continue;
    float fold = az * (26.0 + fi * 9.0) + 3.0 * sin(az * 3.1 + t * 0.03 + fi) + sd * 2.0;
    float rays = s3n1(fold) * 0.6 + s3n1(fold * 2.7 + t * 0.05) * 0.4;
    rays = 0.25 + 0.75 * rays * rays;
    float hh = max(above, 0.0);
    float body = smoothstep(-0.012, 0.004, above) * exp(-hh / (0.09 + 0.05 * fi));
    vec3 c = mix(vec3(0.16, 1.0, 0.5), vec3(0.62, 0.24, 0.95), smoothstep(0.03, 0.22, hh));
    acc += c * (body * rays * (1.0 - fi * 0.35));
  }
  return acc * (u_s3Aur.x * side * 0.75);
}
vec3 s3Banks(vec3 col, vec3 dir) {
  float e = dir.y;
  if (u_s3Bank.x < 0.01 || e < -0.01 || e > 0.17) return col;
  float a = atan(dir.z, dir.x);
  vec2 sh = normalize(u_sunDir.xz + vec2(1e-5, 0.0));
  float sa = dot(normalize(dir.xz + vec2(1e-5, 0.0)), sh);   // 1 toward the sun's azimuth
  float up = smoothstep(-0.1, 0.05, u_sunDir.y);
  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    // the azimuth in cells (the far layer's wider), one heaped cloud in a cell that holds one: a flat base, a rounded top
    // with the cauliflower's lobes on it
    float x = a * (7.0 + fi * 5.0) + u_s3Bank.y * (0.6 + fi * 0.6) + fi * 37.0;
    float cell = floor(x), f = fract(x);
    if (s3h1(cell * 1.7 + fi * 13.0) < 1.0 - u_s3Bank.x) continue;
    float wv = 0.7 + 0.3 * s3h1(cell + 5.3), uu = (f - 0.5) / (0.5 * wv);
    if (abs(uu) >= 1.0) continue;
    float dome = sqrt(1.0 - uu * uu);
    float lobes = s3n1(x * 6.0 + 11.0) * 0.6 + s3n1(x * 14.0 - 3.0) * 0.4;
    float base = 0.006 + fi * 0.014, hgt = (0.026 + fi * 0.04) * (0.6 + 0.4 * s3h1(cell + 9.1)) * dome * (0.72 + 0.28 * lobes);
    float top = base + hgt, soft = 0.0025 + 0.004 * fi;
    float inside = smoothstep(top + soft * 0.5, top - soft, e) * smoothstep(base - 0.004, base + 0.002, e) * smoothstep(1.0, 0.85, abs(uu));
    if (inside <= 0.0) continue;
    float v = clamp((e - base) / max(hgt, 1e-4), 0.0, 1.0);
    // the tops lit, the flat bases in shade; toward the sun a darker body with a bright rim (the light behind it)
    float back = smoothstep(0.4, 1.0, sa) * up;
    float rim = smoothstep(top - soft * 5.0, top, e) * back;
    vec3 bc = mix(u_c3Low, u_c3Top, v) * (1.0 - 0.35 * back) + u_c3Sun * (v * 0.75 * (1.0 - back * 0.7) + rim * 1.4) * up;
    bc = mix(bc, u_skyHorizon * 1.02, 0.42 - 0.22 * fi);
    col = mix(col, bc, inside * (0.88 - 0.12 * fi));
    s3BankA = max(s3BankA, inside);
  }
  return col;
}
// the cumulus field in perspective: where the ray meets the cloud plane beyond the sprites' window, clumps of a noise in
// cloud space by the cover, lit by the hour, hazed toward the horizon, blurred into a band far out
vec3 s3Field(vec3 col, vec3 dir) {
  if (u_s3Field.w < 0.02 || u_s3Field.x < 4.0 || dir.y < 0.003 || dir.y > 0.32) return col;
  float t = u_s3Field.x / dir.y, D = t * length(dir.xz);
  float vis = smoothstep(380.0, 560.0, D);
  if (vis <= 0.0) return col;
  vec2 q = (u_s3Field.yz + dir.xz * t) / 150.0;
  float n = vnoise(q) * 0.62 + vnoise(q * 2.6 + 3.1) * 0.38;
  float thr = 1.0 - u_s3Field.w * 0.85;
  float c = smoothstep(thr, thr + 0.18, n);
  float far = smoothstep(1800.0, 7000.0, D);
  c = mix(c, smoothstep(0.1, 0.9, u_s3Field.w) * 0.75, far * 0.75);
  float up = smoothstep(-0.1, 0.05, u_sunDir.y);
  vec3 fc = mix(u_c3Low, u_c3Top, 0.5 + 0.3 * (1.0 - smoothstep(thr, 1.0, n))) + u_c3Sun * ((0.35 + 0.4 * (1.0 - smoothstep(thr, thr + 0.5, n))) * up);
  fc = mix(fc, u_skyHorizon * 1.02, 0.25 + 0.55 * smoothstep(600.0, 6000.0, D));
  float a = c * vis * 0.9;
  s3BankA = max(s3BankA, a);
  return mix(col, fc, a);
}
vec3 s3Fan(vec3 dir) {
  if (u_s3Fan.x <= 0.001) return vec3(0.0);
  float c = dot(dir, u_sunDir);
  if (c < 0.6) return vec3(0.0);
  vec3 t1 = normalize(cross(u_sunDir, vec3(0.0, 1.0, 0.0)) + vec3(1e-4, 0.0, 0.0)), t2 = cross(t1, u_sunDir);
  vec2 p = vec2(dot(dir, t1), dot(dir, t2));
  float ang = atan(p.y, p.x), r = length(p);
  float n = s3n1(ang * 9.0 + u_s3Fan.y) * 0.6 + s3n1(ang * 23.0 - u_s3Fan.y * 1.7) * 0.4;
  float rays = smoothstep(0.45, 0.85, n);
  float fall = exp(-r * 4.5) * smoothstep(0.02, 0.09, r) * smoothstep(-0.08, 0.2, dir.y - u_sunDir.y * 0.5);
  return u_sunColor * (rays * fall * u_s3Fan.x);
}
#endif
`;
  // ---------------------------------------------------------------- GLSL: the cumulus sprites (PUFF_FS includes it, CLOUD3)
  // the sprite's texel: R the thickness, GB the front's normal, A the occlusion (S3.atlas). The light in the billboard's
  // frame (u_c3L: x right, y up, z toward the eye; renderer: the camera's axes), wrapped; the self-shadow from three taps
  // of the thickness toward the light within the sprite and through its depth when the light is behind it (Beer: the
  // thick cores dark, the thin edges lit); the silver lining — forward scattering round the light's direction (u_c3Ld,
  // world) through the thin parts; the sky's light from above and the low light from below by the normal, the creases
  // darker; far ones take the sky's horizon colour. Returns the colour and the coverage (a < 0: nothing)
  S3.glslPuff = () => `
#ifndef SKY3
uniform vec3 u_c3Sun;      // the direct light on the clouds (colour × strength, S3.cloudLight)
uniform vec3 u_c3Top;      // the sky's light from above
uniform vec3 u_c3Low;      // the light from below (the ground's bounce, the horizon)
uniform vec3 u_c3Ld;       // toward the light, world
#endif
uniform vec3 u_c3L;        // toward the light in the billboard's frame (x right, y up, z toward the eye)
uniform vec4 u_c3K;        // x the self-shadow's density, y the silver lining, z the wrap, w the powder
uniform vec3 u_c3Haze;     // the far ones' colour (the sky at the horizon)
vec2 c3At(vec2 cell, vec2 uv) { return cell + clamp(uv, vec2(0.5 / 128.0), vec2(1.0 - 0.5 / 128.0)) * 0.5; }
vec4 c3Shade(vec2 cell, vec2 uv, float dist, vec3 vdir) {
  vec4 t = texture(u_cloudTex, c3At(cell, uv));
  float th = t.r;
  if (u_fogK > 0.5) {
    // the mist (the fog banks under the isles, the citadel's anchors, the valley banks): a soft silhouette in the haze's light
    vec2 e = vec2(0.03);
    th = th * 0.4 + 0.15 * (texture(u_cloudTex, c3At(cell, uv + vec2(e.x, 0.0))).r + texture(u_cloudTex, c3At(cell, uv - vec2(e.x, 0.0))).r + texture(u_cloudTex, c3At(cell, uv + vec2(0.0, e.y))).r + texture(u_cloudTex, c3At(cell, uv - vec2(0.0, e.y))).r);
    float d = smoothstep(0.0, 0.22, th);
    if (d < 0.02) return vec4(0.0, 0.0, 0.0, -1.0);
    vec3 mc = mix(u_c3Low, u_c3Top, 0.6) + u_c3Sun * 0.35;
    return vec4(mix(mc, u_c3Haze, 0.45), d);
  }
  float cov = smoothstep(0.0, 0.08, th);
  if (cov < 0.01) return vec4(0.0, 0.0, 0.0, -1.0);
  vec3 N = vec3(t.gb * 2.0 - 1.0, 0.0);
  N.z = sqrt(max(0.0, 1.0 - dot(N.xy, N.xy)));
  float ao = t.a;
  vec3 L = u_c3L;
  float lxy = length(L.xy);
  vec2 ld = L.xy / max(lxy, 1e-3);
  float od = texture(u_cloudTex, c3At(cell, uv + ld * 0.06)).r + texture(u_cloudTex, c3At(cell, uv + ld * 0.14)).r * 0.8 + texture(u_cloudTex, c3At(cell, uv + ld * 0.26)).r * 0.6;
  od = od * lxy * 1.2 + th * max(-L.z, 0.0) * 2.0;
  float T = 0.22 + 0.78 * exp(-u_c3K.x * od);   // (the light scattered on inside: a cloud's shaded side is never black)
  float ndl = clamp((dot(N, L) + u_c3K.z) / (1.0 + u_c3K.z), 0.0, 1.0);
  float powder = 1.0 - exp(-th * 14.0);
  vec3 sun = u_c3Sun * ndl * T * mix(1.0, powder, u_c3K.w * max(L.z, 0.0));
  // a low sun lights the upper lobes; the lower parts lie in the shade of the lobes in front and of the haze
  float lowSun = clamp(1.0 - u_c3Ld.y * 3.0, 0.0, 1.0);
  sun *= mix(1.0, 0.25 + 0.75 * smoothstep(0.05, 0.8, uv.y), lowSun * 0.7);
  // against the light: the body dark, the thin edges bright (the silver lining: forward scattering round the light)
  float cs = dot(vdir, u_c3Ld), g2 = 0.5625, ph = (1.0 - g2) / pow(max(1.0 + g2 - 1.5 * cs, 1e-3), 1.5);
  float back = smoothstep(0.55, 0.97, cs), edge = 1.0 - smoothstep(0.02, 0.3, th);
  sun += u_c3Sun * ((ph * 0.11 * exp(-th * 7.0) + edge * edge * 2.6 * smoothstep(0.7, 0.995, cs)) * u_c3K.y * smoothstep(0.0, 0.04, th));
  vec3 amb = mix(u_c3Low, u_c3Top, clamp(N.y * 0.5 + 0.5, 0.0, 1.0)) * (0.35 + 0.65 * ao) * (1.0 - 0.55 * back);
  vec3 col = sun * (0.55 + 0.45 * ao) + amb;
  col = mix(col, u_c3Haze, smoothstep(260.0, 700.0, dist) * 0.45);
  return vec4(col, cov);
}
`;
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
