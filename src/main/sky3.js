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
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
