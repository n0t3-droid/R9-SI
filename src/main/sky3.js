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
  // VR.Sky's day / dusk / night palettes and, between the day and the dusk, the golden hour's (t-sky3: the frames t1_07 /
  // t1_09 — a luminous pastel sky, white-gold at the horizon toward the sun, pink, lavender, violet at the top, the space
  // faint). The dusk refitted to t1_01 / t1_03 / t3_01 / t3_02 (lavender-blue away from the sun, the warmth gathered round
  // it). Each: hor, mid, zen (linear HDR before the exposure), stops [h1, h2a, h2b, halo]; space: the share of the day's
  // space over the top (stars, nebula); sunset: the warm glow's strength (env.js E.sunset's factor). Fitted offline
  // through the real sky shader, the composite and t-light2's grade (plan §7)
  const PAL = S3.PAL = {
    gold: { hor: [0.9, 0.76, 0.78], mid: [0.52, 0.44, 0.62], zen: [0.2, 0.17, 0.42], stops: [0.36, 0.26, 0.78, 0.5], space: 0.3, sunset: 1.0 },
    dusk: { hor: [0.36, 0.33, 0.56], mid: [0.19, 0.17, 0.34], zen: [0.006, 0.026, 0.13], stops: [0.407, 0.499, 0.658, 0.45], space: 0.9, sunset: 0.75 },
  };
  // the weights by the sun's height: the day above ~17°, the golden hour from ~4° down to the horizon (fading by −1°), the
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
    const space = [sd[0] + (sp[0] - sd[0]) * (w.day + w.gold), sd[1] + (sp[1] - sd[1]) * (w.day + w.gold), sp[2] * w.day + sp[2] * G.space * w.gold + sd[2] * (w.dusk + w.night), SKY.nebDay * (w.day + w.gold) + sd[3] * (w.dusk + w.night)];
    return { hor: m('hor'), mid: m('mid'), zen: m('zen'), stops, space, sunset: w.day + G.sunset * w.gold + K.sunset * w.dusk + w.night, w };
  };
  // ---------------------------------------------------------------- the sky's layers by the hour (u_s3Warm …, SKY3)
  // warm / warm2: the sun-side band — gold at the horizon toward the sun, peach-pink over it (band height: dir.y) — its
  // strength by the sun's elevation: from the golden hour through the sunset into the afterglow (gone by −9°); shade /
  // belt: the earth's shadow opposite the sun at dusk and dawn, a blue-grey band rising as the sun sinks, the pink belt
  // over it; sun: the disc's radius (rad), its limb's softness, its brightness, the corona
  const SKYL = S3.SKYL = {
    warm: [[-9, [0, 0, 0]], [-4, [0.5, 0.18, 0.12]], [-0.5, [1.0, 0.45, 0.2]], [3, [1.1, 0.62, 0.3]], [9, [0.85, 0.62, 0.42]], [16, [0, 0, 0]]],
    warm2: [[-9, [0, 0, 0]], [-4, [0.35, 0.12, 0.22]], [-0.5, [0.75, 0.32, 0.42]], [3, [0.7, 0.4, 0.5]], [9, [0.45, 0.35, 0.45]], [16, [0, 0, 0]]],
    height: [[-9, 0.06], [0, 0.12], [9, 0.2], [16, 0.25]],
    reach: [[-9, 6], [0, 6], [6, 3.5], [16, 3]],
    shade: [0.13, 0.15, 0.3], belt: [0.38, 0.2, 0.3], shadeK: [[-12, 0], [-8, 0.55], [-2, 0.8], [1.5, 0.35], [4, 0]],
    sun: { r: 0.0215, soft: 0.0035, k: 9, corona: 1.1 },
  };
  const stop1 = (tab, el) => {
    if (el <= tab[0][0]) return tab[0][1];
    for (let i = 1; i < tab.length; i++) if (el <= tab[i][0]) { const a = tab[i - 1], b = tab[i], t = sstep(0, 1, (el - a[0]) / (b[0] - a[0])); return a[1] + (b[1] - a[1]) * t; }
    return tab[tab.length - 1][1];
  };
  S3.skyLayers = function (E) {
    const el = Math.asin(clamp(E.sunDir[1], -1, 1)) * 180 / Math.PI, clear = 1 - clamp(E.rain || 0, 0, 1) * 0.85;
    const warm = stops(SKYL.warm, el).map(v => v * clear), warm2 = stops(SKYL.warm2, el).map(v => v * clear);
    const hgt = stop1(SKYL.height, el), sk = stop1(SKYL.shadeK, el) * clear, reach = stop1(SKYL.reach, el);
    // the earth's shadow's top: low at the sunset, rising as the sun sinks (dir.y)
    const top = 0.025 + 0.011 * Math.max(0, -el + 1);
    return { warm, warm2, hgt, reach, shade: SKYL.shade, belt: SKYL.belt, shadeK: sk, top, el };
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
    sun: [[-9, [0, 0, 0]], [-5, [0.5, 0.26, 0.32]], [-1.5, [1.1, 0.58, 0.48]], [2, [1.3, 0.84, 0.55]], [8, [1.34, 1.1, 0.84]], [16, [1.3, 1.24, 1.14]]],
    top: [[-12, [0.05, 0.06, 0.11]], [-4, [0.3, 0.27, 0.45]], [2, [0.5, 0.45, 0.62]], [8, [0.56, 0.54, 0.68]], [16, [0.56, 0.62, 0.78]]],
    low: [[-12, [0.03, 0.035, 0.06]], [-4, [0.2, 0.15, 0.24]], [2, [0.3, 0.24, 0.32]], [8, [0.32, 0.29, 0.38]], [16, [0.34, 0.36, 0.44]]],
    moon: [0.2, 0.24, 0.34], rainGrey: [0.4, 0.42, 0.46], k: [2.0, 1.0, 0.3, 0.5],
  };
  const stops = (tab, el) => {
    if (el <= tab[0][0]) return tab[0][1].slice();
    for (let i = 1; i < tab.length; i++) if (el <= tab[i][0]) { const a = tab[i - 1], b = tab[i], t = sstep(0, 1, (el - a[0]) / (b[0] - a[0])); return mix3(a[1], b[1], t); }
    return tab[tab.length - 1][1].slice();
  };
  S3.cloudLight = function (E) {
    const sy = clamp(E.sunDir[1], -1, 1), el = Math.asin(sy) * 180 / Math.PI, rain = clamp(E.rain || 0, 0, 1);
    let sun = stops(CL.sun, el), L = E.sunDir;
    const moonK = 1 - sstep(-9, -5, el);
    if (moonK > 0) { const m = E.sky3 && E.sky3.moons ? 0.35 + 0.65 * E.sky3.moons[0].k : 1; sun = mix3(sun, CL.moon.map(v => v * m), moonK); if (moonK > 0.5) L = E.moonDir; }
    let top = stops(CL.top, el), low = stops(CL.low, el);
    const dayK = sstep(-6, 6, el), grey = CL.rainGrey.map(v => v * (0.25 + 0.75 * dayK));
    sun = sun.map(v => v * (1 - 0.88 * rain)); top = mix3(top, grey, rain * 0.85); low = mix3(low, grey.map(v => v * 0.8), rain * 0.85);
    return { sun, top, low, L, el };
  };

  // ---------------------------------------------------------------- the per-frame values (env.js calls it last)
  // env: the Env (its day, ticks, weather seed); E: its frame. E.sky3 holds what the uniforms need; nothing of E's own
  // values changes unless the sky's level is on (then the palette of the golden hour and the dusk: S3.palette)
  S3.frame = function (E, env) {
    const lv = S3.level();
    const o = E.sky3 || (E.sky3 = { level: 0, moons: null, meteor: null, aurora: 0, bodies: [] });
    o.level = lv;
    if (!lv) { o.moons = null; o.meteor = null; o.aurora = 0; o.bodies.length = 0; return o; }
    const A = (env.day | 0) * DAY + env.timeOfDay, seed = env.wx ? env.wx.seed : 0;
    o.A = A;
    o.moons = S3.moonsAt(A, E.sunDir);
    o.bodies.length = 0; for (const m of o.moons) o.bodies.push([m.dir[0], m.dir[1], m.dir[2], m.r]);
    const vis = S3.meteorVis(E.night) * (1 - clamp(E.rain || 0, 0, 1)) * (1 - sstep(0.6, 0.9, E.cloudCover || 0));
    const m = vis > 0.001 ? S3.meteorAt(seed, A) : null;
    o.meteor = m ? Object.assign(m, { vis: m.bright * vis }) : null;
    o.aurora = lv >= 2 ? S3.auroraAt(seed, A, E.sunDir[1], E.rain, E.cloudCover) : 0;
    o.auroraSeed = o.aurora > 0 ? S3.auroraSeed(seed, Math.floor(A / DAY)) : 0;
    return o;
  };
  // ---------------------------------------------------------------- the uniforms (sky3_gl.js uploads them; the offline
  // renderer mirrors them). cam: {x, y, z, yaw, pitch} (the renderer's camera: yaw 0 looks along −z); prog: 'puff' | 'sky'
  // | 'cloud'. Returns name → numbers
  S3.camAxes = function (cam) {
    const cy = Math.cos(cam.yaw || 0), sy = Math.sin(cam.yaw || 0), cp = Math.cos(cam.pitch || 0), sp = Math.sin(cam.pitch || 0);
    return { right: [cy, 0, -sy], up: [sy * sp, cp, cy * sp], fwd: [-sy * cp, sp, -cy * cp] };
  };
  S3.uniforms = function (E, q, cam, prog, out) {
    out = out || {};
    if (prog === 'sky') {
      const Y = S3.skyLayers(E), U = SKYL.sun;
      out.u_s3Warm = [Y.warm[0], Y.warm[1], Y.warm[2], Y.reach];
      out.u_s3Warm2 = [Y.warm2[0], Y.warm2[1], Y.warm2[2], Y.hgt];
      out.u_s3Shade = [Y.shade[0], Y.shade[1], Y.shade[2], Y.top];
      out.u_s3Belt = [Y.belt[0], Y.belt[1], Y.belt[2], Y.shadeK];
      out.u_s3Sun = [U.r, U.soft, U.k, U.corona];
    }
    if (prog === 'puff' || prog === 'cloud') {
      const C = S3.cloudLight(E), ax = S3.camAxes(cam || {}), L = C.L;
      out.u_c3Sun = C.sun; out.u_c3Top = C.top; out.u_c3Low = C.low;
      out.u_c3L = [dot(L, ax.right), dot(L, ax.up), -dot(L, ax.fwd)];
      out.u_c3Ld = [L[0], L[1], L[2]];
      out.u_c3K = CL.k.slice();
      const h = E.horizon || [0.6, 0.7, 0.8], m = E.skyMid || h;
      out.u_c3Haze = [h[0] * 0.8 + m[0] * 0.2, h[1] * 0.8 + m[1] * 0.2, h[2] * 0.8 + m[2] * 0.2];
    }
    return out;
  };

  // ---------------------------------------------------------------- GLSL: the sky pass (skyColor includes it, SKY3)
  // s3Layers: the sun-side band (gold at the horizon toward the sun, peach-pink over it, falling off with the azimuth), the
  // earth's shadow opposite the sun with the pink belt over it; s3SunDisc: the sun a disc with a soft limb (a little limb
  // darkening) in a warm corona, bright down to the horizon
  S3.glslSky = () => `
uniform vec4 u_s3Warm;     // rgb the sun-side band's colour at the horizon (gold), w its reach round the sky (an exponent of the azimuth)
uniform vec4 u_s3Warm2;    // rgb the colour over it (peach-pink), w the band's height (dir.y)
uniform vec4 u_s3Shade;    // rgb the earth's shadow, w its top (dir.y)
uniform vec4 u_s3Belt;     // rgb the belt of Venus over it, w the shadow's strength
uniform vec4 u_s3Sun;      // x the disc's radius (rad), y the limb's softness, z the disc's brightness, w the corona
vec3 s3Layers(vec3 col, vec3 dir, float h) {
  vec2 sh = normalize(u_sunDir.xz + vec2(1e-5, 0.0)), dh = normalize(dir.xz + vec2(1e-5, 0.0));
  float az = 0.5 + 0.5 * dot(sh, dh);
  float side = pow(az, u_s3Warm.w);   // (how far round from the sun the band reaches: wide at the golden hour, gathered at dusk)
  float hk = h / max(u_s3Warm2.w, 1e-3);
  float low = exp(-hk * hk * 2.2), up = exp(-(hk - 1.1) * (hk - 1.1) * 1.3);
  col += (u_s3Warm.rgb * low + u_s3Warm2.rgb * up * 0.65) * side * u_s3Warm.w;
  if (u_s3Belt.w > 0.001) {
    float anti = smoothstep(0.15, 0.85, 1.0 - az);
    float top = u_s3Shade.w, sh0 = 1.0 - smoothstep(top * 0.75, top * 1.12, h);
    col = mix(col, u_s3Shade.rgb, sh0 * anti * u_s3Belt.w);
    float bt = (h - top * 1.4) / max(top * 0.5, 1e-3);
    col += u_s3Belt.rgb * exp(-bt * bt) * anti * u_s3Belt.w;
  }
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
`;
  // ---------------------------------------------------------------- GLSL: the cumulus sprites (PUFF_FS includes it, CLOUD3)
  // the sprite's texel: R the thickness, GB the front's normal, A the occlusion (S3.atlas). The light in the billboard's
  // frame (u_c3L: x right, y up, z toward the eye; renderer: the camera's axes), wrapped; the self-shadow from three taps
  // of the thickness toward the light within the sprite and through its depth when the light is behind it (Beer: the
  // thick cores dark, the thin edges lit); the silver lining — forward scattering round the light's direction (u_c3Ld,
  // world) through the thin parts; the sky's light from above and the low light from below by the normal, the creases
  // darker; far ones take the sky's horizon colour. Returns the colour and the coverage (a < 0: nothing)
  S3.glslPuff = () => `
uniform vec3 u_c3Sun;      // the direct light on the clouds (colour × strength, S3.cloudLight)
uniform vec3 u_c3Top;      // the sky's light from above
uniform vec3 u_c3Low;      // the light from below (the ground's bounce, the horizon)
uniform vec3 u_c3L;        // toward the light in the billboard's frame (x right, y up, z toward the eye)
uniform vec3 u_c3Ld;       // toward the light, world
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
  od = od * lxy * 2.2 + th * max(-L.z, 0.0) * 3.0;
  float T = exp(-u_c3K.x * od);
  float ndl = clamp((dot(N, L) + u_c3K.z) / (1.0 + u_c3K.z), 0.0, 1.0);
  float powder = 1.0 - exp(-th * 14.0);
  vec3 sun = u_c3Sun * ndl * T * mix(1.0, powder, u_c3K.w * max(L.z, 0.0));
  float cs = dot(vdir, u_c3Ld), g2 = 0.5625, ph = (1.0 - g2) / pow(max(1.0 + g2 - 1.5 * cs, 1e-3), 1.5);
  sun += u_c3Sun * (ph * 0.08 * u_c3K.y) * exp(-th * 9.0) * smoothstep(0.0, 0.04, th);
  vec3 amb = mix(u_c3Low, u_c3Top, clamp(N.y * 0.5 + 0.5, 0.0, 1.0)) * (0.35 + 0.65 * ao);
  vec3 col = sun * (0.55 + 0.45 * ao) + amb;
  col = mix(col, u_c3Haze, smoothstep(260.0, 700.0, dist) * 0.45);
  return vec4(col, cov);
}
`;
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
