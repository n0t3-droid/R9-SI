// ============================================================================
// t-light2 · WOW I · Das Licht (plan docs/superpowers/plans/2026-10-15-t-light2.md): the light of the picture.
// Pure (no GL): the switches and their defaults per preset, the settings rows, the per-frame values the shaders read
// (computed from env.js's E), the models the node test checks against the GLSL (the hemispheric ambient, the lamps'
// pools, the height fog, the grade's curves, the SAO taps, the flare's ghosts, the blue noise), and the GLSL text itself:
// the COMMON block's part (glslCommon, under #ifdefs: with every switch off the shaders compile from the same text as
// before) and the light's own passes (contact shadows, their blur, the volumetric light). The GL side — targets, passes,
// uniforms — is light2_gl.js (loaded after renderer.js); this file loads before shaders.js (build.js MAIN).
//   l2Light  Licht-Modell: the sky from above and the ground's bounce from below, a soft wrap on leaves and skin, the
//            lamps' light in pools, the moon a cool key light                                          (LIGHT2)
//   l2Ssao   Kontaktschatten 0 · 1 · 2 · 3: half-res scalable ambient obscurance, 4 / 8 / 12 taps, into the ambient
//            only (the next frame reads it at its reprojected place)                                   (L2AO)
//   l2Vol    Lichtstrahlen im Raum: the sun's light in the air through the shadow map, quarter res    (L2VOL)
//   l2Air    Luft & Dunst: height fog in the valleys and over water, the morning layer, aerial perspective  (AIR2)
//   l2Grade  Farbstimmung: a grade by the hour (tone curve, split toning), a soft vignette, the sun's flare, the
//            glow by the hour                                                                           (GRADE2)
// ============================================================================
(function (VR) {
  'use strict';
  const L2 = VR.Light2 = VR.Light2 || {};
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const sstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const mix = (a, b, t) => a + (b - a) * t;
  const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

  // ---------------------------------------------------------------- the switches
  L2.SW = ['l2Light', 'l2Ssao', 'l2Vol', 'l2Air', 'l2Grade'];
  L2.MAX = { l2Ssao: 3 };
  const OFF = { l2Light: false, l2Ssao: 0, l2Vol: false, l2Air: false, l2Grade: false };
  const ON = { l2Light: true, l2Air: true, l2Grade: true };
  // the tiers (the plan's table): Very Low none of them (its programs and passes as before); Low the cheap ones and the
  // 4-tap contact shadows; Balanced 8 taps; High and Ultra 12 taps and the volumetric light (with the god rays' switch);
  // Ultra · Leicht (the integrated GPUs' Ultra) 8 taps and the volumetric light
  const TIERS = {
    potato: OFF,
    low: Object.assign({}, ON, { l2Ssao: 1, l2Vol: false }),
    balanced: Object.assign({}, ON, { l2Ssao: 2, l2Vol: false }),
    high: Object.assign({}, ON, { l2Ssao: 3, l2Vol: true }),
    ultra: Object.assign({}, ON, { l2Ssao: 3, l2Vol: true }),
    ultraLite: Object.assign({}, ON, { l2Ssao: 2, l2Vol: true }),
  };
  L2.defaults = (preset) => Object.assign({}, TIERS[preset] || TIERS.balanced);
  L2.off = () => Object.assign({}, OFF);
  // the settings rows (settings_reg.js adds them: Bild · Licht & Schatten), each with its cost
  L2.ROWS = [
    { key: 'l2Light', g: 'img', sec: 'light', t: 'switch', lab: 'g.set.l2Light', tip: 'g.set.l2Light.tip', cost: 'low', def: true },
    { key: 'l2Ssao', g: 'img', sec: 'light', t: 'slider', lab: 'g.set.l2Ssao', tip: 'g.set.l2Ssao.tip', cost: 'mid', def: 2, min: 0, max: 3, step: 1, vals: 'g.set.l2SsaoV' },
    { key: 'l2Vol', g: 'img', sec: 'light', t: 'switch', lab: 'g.set.l2Vol', tip: 'g.set.l2Vol.tip', cost: 'mid', def: false },
    { key: 'l2Air', g: 'img', sec: 'light', t: 'switch', lab: 'g.set.l2Air', tip: 'g.set.l2Air.tip', cost: 'low', def: true },
    { key: 'l2Grade', g: 'img', sec: 'light', t: 'switch', lab: 'g.set.l2Grade', tip: 'g.set.l2Grade.tip', cost: 'low', def: true },
  ];
  // the renderer's settings this frame (renderer.buildPrograms hands them over: L2.use)
  L2.q = OFF;
  L2.use = function (q) { L2.q = q || OFF; return L2.q; };
  L2.on = (q) => { q = q || L2.q; return !!(q.l2Light || q.l2Ssao || q.l2Vol || q.l2Air || q.l2Grade); };

  // ---------------------------------------------------------------- the defines, by program (gl.js asks: GL.defineHook)
  // The terrain, the props and the furniture read the contact shadows (their vertex shaders write the reprojected place);
  // every program that calls applyFog gets the air's fog (the same haze on the land, the water, the people and the far
  // terrain); the composite gets the grade and the volumetric light's upsample.
  const AO_PROGS = { terrain: 1, terrainCut: 1, terrainCutZ: 1, prop: 1, furn: 1 };
  const LIGHT_PROGS = { terrain: 1, terrainCut: 1, terrainCutZ: 1, shipOpaque: 1, shipCutout: 1, prop: 1, furn: 1, vox: 1, voxInst: 1, mesh: 1, lod: 1, form: 1, lodFar: 1, folk: 1, folkSun: 1 };
  const FOG_PROGS = Object.assign({ trans: 1, shipTrans: 1, part: 1, trail: 1 }, LIGHT_PROGS);
  L2.definesFor = function (name, q) {
    q = q || L2.q;
    const out = [];
    if (q.l2Light && LIGHT_PROGS[name]) out.push('LIGHT2');
    if ((q.l2Ssao | 0) > 0 && AO_PROGS[name]) out.push('L2AO');
    if (q.l2Air && FOG_PROGS[name]) out.push('AIR2');
    if (name === 'composite') { if (q.l2Grade) out.push('GRADE2'); if (q.l2Vol) out.push('L2VOL'); }
    return out;
  };
  // gl.js: every program passes through here — a renderer without the switches (or with them all off) gets its defines
  // unchanged, so its shaders are the same text as before
  L2.hook = function (name, defines) {
    const extra = L2.definesFor(name);
    if (!extra.length) return defines;
    return (defines || []).concat(extra.filter(d => !(defines || []).includes(d)));
  };
  if (VR.GL) VR.GL.defineHook = L2.hook;

  // ---------------------------------------------------------------- the hour's moods
  // the weights of the four looks, from the sun's height (the sun climbs to ~24° at noon): the day above ~6°, the golden
  // hour its low part (the sun under ~17°, down to the horizon), dusk from the sunset to ~−12°, night under ~−16°
  L2.moods = function (sy) {
    const wDay = sstep(-0.01, 0.1, sy), wNight = 1 - sstep(-0.28, -0.1, sy), wDusk = (1 - wDay) * (1 - wNight);
    const g = 1 - sstep(0.1, 0.3, sy);
    return { day: wDay * (1 - g), gold: wDay * g, dusk: wDusk, night: wNight };
  };
  // a value per mood (a number or a colour) blended by the hour's weights
  const MOODS = ['day', 'gold', 'dusk', 'night'];
  const byMood = (m, tab) => {
    if (!Array.isArray(tab.day)) { let s = 0; for (const k of MOODS) s += tab[k] * m[k]; return s; }
    const out = [0, 0, 0];
    for (const k of MOODS) { const v = tab[k], w = m[k]; out[0] += v[0] * w; out[1] += v[1] * w; out[2] += v[2] * w; }
    return out;
  };
  L2.byMood = byMood;

  // ---------------------------------------------------------------- step 1 · the light model
  // the shade's colour (the sky's light) per mood, over env.js's sky light: by day a cool neutral — env's is lavender (blue
  // over red 1.76 at noon) and the town lies in the low sun's long shadows most of the day, so this colour IS the
  // picture; the frames' shade is a cool grey (b* −6 … +6) — at the golden hour a cool neutral, at dusk violet, at night
  // a cyan-blue (run 3's tuning against the on2 pictures; a greener teal turned the people's faces green at night); the
  // ground's bounce warm (the sunlit ground)
  const SKYTINT = { day: [1.08, 1.0, 0.82], gold: [1.05, 1.0, 0.84], dusk: [1.06, 0.92, 1.0], night: [0.8, 1.0, 1.0] };
  // the sky light's level over env's: the frames' shade is lighter than the game's (their darkest land L* 15–22 by day,
  // the game's 7–12) — the light lifted here, in the light, so the sky's own fit (t-sky2) is not touched by the grade
  const SKYK = { day: 1.3, gold: 1.4, dusk: 1.45, night: 1.15 };
  const GROUND = { day: [1.06, 1.0, 0.72], gold: [1.18, 0.96, 0.66], dusk: [1.02, 0.86, 0.9], night: [0.9, 0.95, 1.0] };
  const GROUNDK = { day: 0.62, gold: 0.58, dusk: 0.54, night: 0.5 };   // the bounce's luminance over the sky's
  // the afterglow: the bright sky round the low sun (env's E.sunset) lights the faces toward it — at the golden hour and
  // most at dusk, when the sun itself is gone and this is the warm light of the picture (t1_01: the faces toward the
  // sunset ochre, the faces away violet-navy)
  const GLOWK = { day: 0, gold: 0.9, dusk: 1.6, night: 0 };
  L2.K = { dir: 0.08, xFace: 0.94, wrapLeaf: 0.45, wrapSkin: 0.42, poolHot: 2.6, poolK: 0.13, poolTail: 0.2, poolHue: 1.25, moon: 1.0 };
  L2.skyK = (m) => byMood(m, SKYK);
  // the sun's light on the lit things by the hour (the sky keeps env.js's sun): by day env.js's own a little stronger,
  // in the golden hour gold and stronger, at dusk a warm rose
  const SUNTINT = { day: [1, 1, 1], gold: [1.18, 1.0, 0.8], dusk: [1.15, 0.92, 0.85], night: [1, 1, 1] };
  const SUNK = { day: 1.06, gold: 1.25, dusk: 1.1, night: 1.0 };
  L2.sunTint = function (m) { const t = byMood(m, SUNTINT), k = byMood(m, SUNK); return [t[0] * k, t[1] * k, t[2] * k]; };
  // a colour with the luminance of another
  const toLum = (c, L) => { const l = lum(c) || 1; return [c[0] * L / l, c[1] * L / l, c[2] * L / l]; };
  // the hemisphere's colours this frame: sky (from above), ground (from below), from E.ambSky; the afterglow from
  // E.sunset
  L2.hemiColors = function (E) {
    const m = L2.moods(E.sunDir[1]), a = E.ambSky, La = lum(a) * L2.skyK(m);
    const st = byMood(m, SKYTINT), gt = byMood(m, GROUND), gk = byMood(m, GROUNDK), s = E.sunset || [0, 0, 0], gw = byMood(m, GLOWK);
    const sky = toLum([a[0] * st[0], a[1] * st[1], a[2] * st[2]], La);
    const ground = toLum([a[0] * gt[0], a[1] * gt[1], a[2] * gt[2]], La * gk);
    return { sky, ground, glow: [s[0] * gw, s[1] * gw, s[2] * gw], moods: m };
  };
  // the hemispheric ambient for a normal (JS mirror of l2Hemi): the sky from above, the ground from below, linear in n.y
  // (a Lambert surface under two half-spheres), a little brighter on the side of the sky toward the light, and the
  // afterglow on the faces toward the low sun
  L2.hemi = function (n, sky, ground, az, dirK, glow) {
    const k = clamp(0.5 + 0.5 * n[1], 0, 1), side = 1 - Math.abs(n[1]);
    const d = (az ? (n[0] * az[0] + n[2] * az[1]) : 0) * side;
    const f = 1 + (dirK === undefined ? L2.K.dir : dirK) * d, g = glow || [0, 0, 0], gd = Math.max(d, 0);
    return [mix(ground[0], sky[0], k) * f + g[0] * gd, mix(ground[1], sky[1], k) * f + g[1] * gd, mix(ground[2], sky[2], k) * f + g[2] * gd];
  };
  // the lamps' light (JS mirror of l2Pool): the brightest channel's level m (0..1: 15 at the lamp, −1/15 a block) gives
  // the distance d = 15 (1 − m); the light falls like a lamp's, 1 / (1 + d²·k), a hot spot at the lamp, the tail faded
  // out before the flood fill's end; the hue is the channels over the brightest, a little more saturated
  L2.pool = function (level, K) {
    K = K || L2.K;
    if (level <= 0) return 0;
    const d = 15 * (1 - level);
    return K.poolHot / (1 + d * d * K.poolK) * sstep(0, K.poolTail, level);
  };
  L2.poolOld = (level) => 1.35 * Math.pow(Math.max(0, level), 1.7);   // (the curve of before: shaders.js blockL)

  // ---------------------------------------------------------------- step 4 · the air
  // the height fog: density ρ(y) = ρ0 · exp(−k (y − base)); its optical depth along a ray from the eye (height ye) over
  // the distance D rising by dy: ρ0 · exp(−k (ye − base)) · D · (1 − exp(−k dy)) / (k dy)
  // Below the valley floor the haze stops thickening: from FLOOR blocks under its base down it keeps that density (the
  // deepest valley; the march's light in the air the same). And far below the sea level there is no valley haze at all:
  // an eye 12 … 24 blocks under the base fades it out (L2.fogEye — the flat world's ground at y 4, the deep caves; with
  // the old clamp at 40 under the base the flat world stood in 17 times the valley's haze, 16 % of it 11 blocks off
  // by day: classic_v2's block grid washed out). The Heartland's eyes and valleys (≥ the base − 8) are unchanged. The
  // ray's two ends are held at the floor (a ray all under it: the floor's density along its whole length; one that
  // dips under it: never denser than the floor).
  L2.FOG_FLOOR = 8;
  L2.fogEye = (eyeY, base) => sstep(base - 24, base - 12, eyeY);
  L2.fogOD = function (ye, dy, D, rho0, k, base) {
    const fy = base - L2.FOG_FLOOR, e = Math.max(ye, fy);
    dy = Math.max(ye + dy, fy) - e;
    const y0 = e - base;
    const kd = k * dy;
    const g = Math.abs(kd) > 1e-4 ? (1 - Math.exp(-kd)) / kd : 1 - kd * 0.5;
    return rho0 * Math.exp(-k * y0) * D * g;
  };
  // the same by marching (the test's reference)
  L2.fogODMarch = function (ye, dy, D, rho0, k, base, n) {
    n = n || 2000; let s = 0;
    for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, y = ye + dy * t; s += rho0 * Math.exp(-k * Math.max(y - base, -L2.FOG_FLOOR)); }
    return s * D / n;
  };
  // the air by the hour: the haze's density at the valley floor (per block), its scale height, its base, the aerial
  // perspective's distance, the morning layer (thicker and lower round sunrise); the sea level is the Heartland's 62
  // (by day a light haze — the far shore stays crisp at noon; the valleys fill toward evening, at night and at dawn)
  const FOG = { day: [0.0007, 1 / 14, 62], gold: [0.0016, 1 / 13, 62], dusk: [0.0022, 1 / 12, 60], night: [0.0016, 1 / 12, 60] };
  L2.FOG = FOG;   // (f-sky4: open to the tests — sky3.mjs's palette variants try the golden valley haze too)
  L2.air = function (E, ticks) {
    const m = L2.moods(E.sunDir[1]);
    const f = byMood(m, FOG);
    // the morning layer: round sunrise (the sun rising in the east, ticks 23000 … 2500) a dense low layer that burns off
    const t = ((ticks % 24000) + 24000) % 24000, mt = t > 20000 ? t - 24000 : t;
    const morning = sstep(-1800, -200, mt) * (1 - sstep(1200, 3000, mt));
    const rho = f[0] * (1 + 2.2 * morning), k = f[1] * (1 + 0.8 * morning), base = f[2] - 1.5 * morning;
    const rain = E.rain || 0;
    // the mist toward the sun glows (forward scattering): a little by day, most in the golden hour (f-sky4, R50-01: halved
    // at the golden hour — 0.3 veiled the far land toward the sun in pink)
    const sunK = byMood(m, { day: 0.12, gold: 0.15, dusk: 0.2, night: 0 });
    // the aerial perspective: 1 − exp(−(d / apDist)²) of apMax — the near and the middle ground clear, the far planes
    // a step paler each (t1_05, t3_06). (f-sky4, R50-01 after sky3.mjs run 1: at the golden hour 0.55 of the luminous
    // horizon washed the far land to a pink-white; the frames' far islands keep their green under a blue haze — 0.35)
    return { rho: rho * (1 + 1.5 * rain), k, base, apDist: 1100 * (1 - 0.4 * rain), apMax: byMood(m, AP), sunK, morning, moods: m };
  };
  const AP = { day: 0.55, gold: 0.35, dusk: 0.55, night: 0.55 };
  // t-polish2 · the room's air (gap 8, the Hangar Hall: t1_12, t1_13 — the hall's air holds the cyan of its strips): where
  // the eye stands indoors (its sky light low) the air takes the colour of the lamps round it — the block light of a few
  // cells round the eye, averaged and eased — thin: col → mix(col, room, 1 − e^(−min(d, max)·rho)). Outdoors nothing (the
  // valley haze and the volumetric light are the open air's). One mix in l2Fog (AIR2), no pass.
  // (the first polish2.mjs run: a mix toward the dim cyan — k 0.34, HDR ≈ 0.18 — only darkened the hangar's lit far end, by
  // 2.6 L*, and the air read as nothing. The air glows: it lifts what is darker than its light and never dims what is
  // brighter — max(col, mix(col, room, haze)) — the room's light at full strength (k 1: the hangar's cyan ≈ 0.3, 0.5),
  // a third of the way at the hall's 40 blocks)
  L2.ROOM = { rho: 0.008, max: 48, k: 1.0, sky: [0.25, 0.85], pts: [[0, 0, 0], [4, 0, 0], [-4, 0, 0], [0, 0, 4], [0, 0, -4], [0, 3, 0], [0, -1, 0]] };
  L2.roomIndoor = (eyeSky) => 1 - sstep(L2.ROOM.sky[0], L2.ROOM.sky[1], eyeSky);
  L2.roomHaze = (d, rho) => 1 - Math.exp(-Math.min(Math.max(d, 0), L2.ROOM.max) * rho);
  // the JS mirror of l2Fog's room air: a colour at d blocks in the room's air of colour `room` and density rho
  L2.roomAir = (col, room, d, rho) => { const h = L2.roomHaze(d, rho); return col.map((c, i) => Math.max(c, c + (room[i] - c) * h)); };
  // the haze's colour (HDR) from the block light at the sample points: [r, g, b] 0..15 each
  L2.roomColor = function (samples, out) {
    out = out || [0, 0, 0]; out[0] = out[1] = out[2] = 0;
    if (!samples.length) return out;
    for (const s of samples) for (let i = 0; i < 3; i++) { const v = s[i] / 15; out[i] += v * v; }
    for (let i = 0; i < 3; i++) out[i] = out[i] / samples.length * L2.ROOM.k;
    return out;
  };
  // t-polish2 · the far lights at night (gap 2: the landmarks' lights did not read from afar — one-pixel lines, dim, eaten by
  // the haze): in the far land's program (LOD_FS, under LIGHT2) the glowing kinds and the lit windows shine ×(1 + night ·
  // night weight) — at night over the bloom's threshold (GRADE.night.bThr) — and keep exp(−d / pierce) of themselves
  // through the fog (L2.farLight: the factor, L2.farPierce: the share kept at d blocks)
  L2.FARLIT = { night: 1.6, pierce: 1600 };
  L2.farLight = (nightW) => 1 + L2.FARLIT.night * clamp(nightW, 0, 1);
  L2.farPierce = (d) => Math.exp(-Math.max(d, 0) / L2.FARLIT.pierce);
  // the valley mist's colour: between the horizon's and the fog's, a little lighter by day.
  // (f-sky4, R50-01 after sky3.mjs run 1: at the golden hour that was the luminous horizon's pink-white — 229,216,217 on
  // the screen — and the far land and the valleys under the isles read as milk; the frames' far land is blue 109,148,189
  // away from their sun and a pale blue-lilac 192,198,227 beside it. So at the golden hour the mist takes a pale blue-lilac
  // of its own (MIST_GOLD, ~188,195,228 through the golden grade), less in rain; toward the sun it still glows warm: l2Fog
  // adds the sun's colour × sunK there)
  L2.MIST_GOLD = [0.42, 0.49, 0.8];
  // f-sky5 (docs/reviews/v0.51.md R52-03: the far land and the isles drowned in a white-pink haze): the aerial
  // perspective and the end fog took the luminous horizon's pink-white (hazeColor) — at the golden hour they take the
  // golden far air instead: away from the sun a blue-lilac darker than the sky over it (the frames' far land 109,148,189),
  // beside the sun the pale lilac of the mist (192,198,227); k: its share at the golden hour (less in rain)
  L2.AIRGOLD = { away: [0.2, 0.29, 0.55], side: [0.46, 0.47, 0.72], k: 0.75 };
  L2.airGold = (t) => { const A = L2.AIRGOLD, q = clamp(t, 0, 1); return [0, 1, 2].map(i => A.away[i] + (A.side[i] - A.away[i]) * q); };
  L2.airGoldK = (E) => L2.moods(E.sunDir[1]).gold * (1 - clamp(E.rain || 0, 0, 1)) * L2.AIRGOLD.k;
  L2.mistColor = function (E) {
    const h = E.horizon || [0.6, 0.7, 0.8], f = E.fogColor || h, m = L2.moods(E.sunDir[1]), lift = 1 + 0.08 * m.day;
    const w = m.gold * (1 - clamp(E.rain || 0, 0, 1)), c = L2.MIST_GOLD, o = [0, 0, 0];
    for (let i = 0; i < 3; i++) { const v = (h[i] + f[i]) * 0.5 * lift; o[i] = v + (c[i] - v) * w; }
    return o;
  };

  // ---------------------------------------------------------------- step 5 · the grade
  // a 3-point tone curve (JS mirror of l2Curve): the darks lifted to `toe`, the mid-point moved to `mid` (a gamma), an
  // S of strength `s` round it, the lights pressed to `sh`; per channel, monotone, 0 → toe, 1 → sh
  L2.curve = function (x, c) {
    x = clamp(x, 0, 1);
    const g = Math.log(c.mid) / Math.log(0.5);
    let y = Math.pow(x, g);
    y = mix(y, y * y * (3 - 2 * y), c.s);
    return c.toe + (c.sh - c.toe) * y;
  };
  // the grade per mood: the curve (toe, mid, s, sh), the split toning (the darks' and the lights' leaning, in display
  // space), the mid-tones' saturation, the vignette, the bloom's threshold and strength
  const GRADE = {
    // (the day's leaning from the frames' land, test/land_ref.js: their sunlit paving and walls white-cyan, their darks the
    // warm greens — so by day the lights lean a little cool and the darks a little warm; from the golden hour the light
    // is warm over a cool shade, at dusk more so)
    // (run 3's tuning: the on2 pictures were 3–8 L* darker than the light off and greyer (C* down to half at dusk) — the
    // S eased (0.45 → 0.3: it pressed the shaded lawns down), the curve's middle kept so the sky keeps t-sky2's fit (test
    // e: within 3.5 L* of the old curve), the mid-tones' saturation up, the vignette lighter, the glow by day wider;
    // after run 3: the golden hour's split 10.1 against the frames' 6.2 — its lights' lean eased; at night the many light
    // lines' glow washed the avenue's paving cyan — the night's glow narrower, threshold 0.62, strength 0.25)
    // (t-polish2, gap 4: v0.48's golden land against the frames' — its mid-tones ran more saturated than theirs: the
    // saturation 1.16 → 1.04, the S 0.32 → 0.26. The split of warm light over cool shade held at the frames' 6.2: the first
    // fit halved the lights' lean on t-light2's pictures (split 9.2), but polish2.mjs's run 1 measured v0.48 at 5.8 and
    // the halved lean at 2.3 — over both sets (test/land_grade.js, 320 × 180) v0.48 sits at 6.2; now the lights ×0.85 and
    // the shade's cool lean ×1.5: split 6.1, bands ΔE 30.9 / 29.8 → 29.3 / 28.3)
    day: { toe: 0.014, mid: 0.5, s: 0.3, sh: 0.985, dark: [0.008, 0.004, -0.012], light: [-0.008, 0.002, 0.014], sat: 1.1, vig: 0.16, bThr: 1.05, bStr: 0.13 },
    // (f-sky4, docs/reviews/v0.49.md R50-01: with t-sky3's band fit on top, 1.04 / 0.26 left the golden hour grey — the land's
    // saturation 115 in the frames, 69 in v0.49's lake; refitted together with the sky (sky3.js PAL.gold): the saturation
    // 1.2, the S back to 0.32, the shoulder at white (the sun's core and the trailer's whites reach 255), the bloom's
    // threshold over the sky (1.3: at 0.9 the whole bright horizon bloomed into a veil))
    gold: { toe: 0.016, mid: 0.5, s: 0.32, sh: 1.0, dark: [-0.03, 0.0, 0.06], light: [0.0527, 0.0187, -0.0383], sat: 1.2, vig: 0.2, bThr: 1.3, bStr: 0.17 },
    dusk: { toe: 0.022, mid: 0.5, s: 0.28, sh: 0.975, dark: [0.01, -0.014, 0.05], light: [0.065, 0.018, -0.035], sat: 1.15, vig: 0.24, bThr: 0.75, bStr: 0.22 },
    night: { toe: 0.026, mid: 0.48, s: 0.25, sh: 0.97, dark: [-0.026, 0.016, 0.042], light: [0.055, 0.022, -0.028], sat: 1.08, vig: 0.28, bThr: 0.62, bStr: 0.25 },
  };
  L2.GRADE = GRADE;
  L2.grade = function (E) {
    const m = L2.moods(E.sunDir[1]), o = {};
    for (const k of ['toe', 'mid', 's', 'sh', 'sat', 'vig', 'bThr', 'bStr']) o[k] = m.day * GRADE.day[k] + m.gold * GRADE.gold[k] + m.dusk * GRADE.dusk[k] + m.night * GRADE.night[k];
    o.dark = byMood(m, { day: GRADE.day.dark, gold: GRADE.gold.dark, dusk: GRADE.dusk.dark, night: GRADE.night.dark });
    o.light = byMood(m, { day: GRADE.day.light, gold: GRADE.gold.light, dusk: GRADE.dusk.light, night: GRADE.night.light });
    o.moods = m;
    return o;
  };
  // the split toning on a display colour (JS mirror of l2Split): the darks lean to `dark`, the lights to `light`,
  // weighted by the luma's distance from the middle; the luma itself kept
  L2.split = function (c, dark, light) {
    const l = lum(c), wd = (1 - l) * (1 - l), wl = l * l;
    const o = [c[0] + dark[0] * wd + light[0] * wl, c[1] + dark[1] * wd + light[1] * wl, c[2] + dark[2] * wd + light[2] * wl];
    const dl = lum(o) - l;
    return [clamp(o[0] - dl, 0, 1), clamp(o[1] - dl, 0, 1), clamp(o[2] - dl, 0, 1)];
  };
  // the sun's flare: ghosts along the axis from the sun through the screen's centre (uv 0..1), mirrored past it —
  // [x, y, radius (screen heights), r, g, b]
  const GHOSTS = [[0.55, 0.035, 1.0, 0.72, 0.42], [0.8, 0.02, 0.5, 0.9, 1.0], [1.25, 0.06, 0.62, 0.8, 1.0], [1.55, 0.028, 1.0, 0.6, 0.36], [1.9, 0.09, 0.42, 0.66, 1.0]];
  L2.ghosts = function (sx, sy) {
    return GHOSTS.map(([t, r, R, G, B]) => [sx + (0.5 - sx) * t, sy + (0.5 - sy) * t, r, R, G, B]);
  };

  // ---------------------------------------------------------------- step 2 · the contact shadows' taps
  // scalable ambient obscurance (McGuire et al. 2012): tap i of n on a spiral of `turns` turns in the unit disc, rotated
  // by phi — the radius grows linearly with the index (more taps near the centre, where the near geometry weighs most)
  L2.saoTap = function (i, n, turns, phi) {
    const a = (i + 0.5) / n, ang = a * turns * Math.PI * 2 + phi;
    return [Math.cos(ang) * a, Math.sin(ang) * a];
  };
  L2.TAPS = [0, 4, 8, 12];
  L2.TURNS = [0, 2, 5, 7];
  // by the level (1 Low · 2 Balanced · 3 High and Ultra): the disc's radius (blocks), the strength (fewer taps, more of it:
  // the near taps weigh most — the levels darken a corner alike, test/light2.js g); the bias (blocks: a
  // flat floor does not shade itself); where it is read: the depth's tolerance (relative) and the lamps' share
  L2.AO = { radius: [0, 1.2, 1.2, 1.2], strength: [0, 1.1, 0.9, 0.82], bias: 0.03, tol: 0.05, block: 0.5 };

  // ---------------------------------------------------------------- step 3 · the light in the air
  // the march: its steps, its reach (blocks; at most the shadow map's), the phase's g (forward: the shafts toward the sun
  // brightest); the strength over the air's haze for the sun and for the moon; indoors more (the dust in a sunbeam through a
  // window: the eye's sky light low); a ray to the sky a part of it (the sky's glow is the sky shader's); the haze's scale
  // height longer than the fog's (the shafts reach up the trees)
  // shaft: the shafts' boost — a ray part in the light and mostly in shadow shows the air most (a shaft between dark
  // trunks, under a vault's ribs, between houses), a ray all lit or all dark as the haze (the open land's air stays
  // clear); fade: the far air counts less (blocks: e^(−t / fade) — the far haze is the air's, l2Fog); cover: the light in
  // the air denser where the eye stands in shadow (in a wood, under the vault, in a street's shade: the lit air beside it
  // glows), ×(1 + cover). g: forward — the shafts toward the light bright, the air away from it clear (run 3: the
  // symmetric weight and g 0.35 veiled the open lake and the temple's plaza, while the wood showed nothing)
  // The moon (run 4: at dusk, the moon 4° up, the eye's shade and the new weight drew a grainy blue fan over the villa's
  // lawn): its phase run 3's (gMoon 0.35), no eye's shade, its strength 0.7 — its light in the air under run 3's for
  // every ray (test/light2.js h)
  L2.VOL = { steps: 16, reach: 120, g: 0.55, gMoon: 0.35, sun: 0.4, moon: 0.7, indoor: 2.5, sky: 0.25, kScale: 0.7, shaft: 20, fade: 64, cover: 1.5 };
  L2.volG = (sunUp) => (sunUp ? L2.VOL.g : L2.VOL.gMoon);
  L2.volCover = (sunUp) => (sunUp ? L2.VOL.cover : 0);
  L2.volK = function (sunUp, rain, eyeSky) {
    const V = L2.VOL, e = eyeSky === undefined ? 1 : clamp(eyeSky, 0, 1);
    return (sunUp ? V.sun : V.moon) * (1 - 0.6 * clamp(rain || 0, 0, 1)) * (1 + V.indoor * (1 - e));
  };
  // (JS mirror of the march's weight: lit = the share of the ray in the light, its density-weighted length; the weight
  // 6.75 · lit · (1 − lit)² peaks at a third lit)
  L2.volShaft = (lit) => 1 + L2.VOL.shaft * 6.75 * lit * (1 - lit) * (1 - lit);
  // (t-polish2 tried a canopy weight on top — the air of a ray crossing light and shade under leaves ×13 at noon: in its
  // second browser run it drew nothing under the canopy and turned a wood's opening toward the sunlit land into a white,
  // blocky veil; taken back — the march is v0.48's. Plan 2026-10-16-t-polish2.md §3 Results)
  // the sun's flare: its strength (HDR, before the exposure) and the disc's radius (screen heights) its visibility is read in
  L2.FLARE = { k: 0.05, disc: 0.012 };
  // blue noise (void and cluster, Ulichney 1993): an N × N tiling threshold map whose values are spread with no low
  // frequencies — the per-pixel rotation of the taps and the volumetric march's start. Made once (~10 ms for 64²)
  L2.blueNoise = function (N, seed) {
    N = N || 64; const n = N * N, R = 7, W = 2 * R + 1, sig = 1.9;
    const lut = new Float32Array(W * W);
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) lut[(dy + R) * W + dx + R] = Math.exp(-(dx * dx + dy * dy) / (2 * sig * sig));
    const E = new Float32Array(n), on = new Uint8Array(n), rank = new Int32Array(n);
    const splat = (i, s) => { const x = i % N, y = (i / N) | 0; for (let dy = -R; dy <= R; dy++) { const yy = (y + dy + N) % N; for (let dx = -R; dx <= R; dx++) { const xx = (x + dx + N) % N; E[yy * N + xx] += s * lut[(dy + R) * W + dx + R]; } } };
    let a = (seed || 7) >>> 0 || 1; const rnd = () => { a ^= a << 13; a >>>= 0; a ^= a >>> 17; a ^= a << 5; a >>>= 0; return a / 4294967296; };
    const m0 = Math.max(1, Math.floor(n * 0.1));
    for (let c = 0; c < m0;) { const i = Math.floor(rnd() * n); if (!on[i]) { on[i] = 1; splat(i, 1); c++; } }
    const tight = () => { let b = -1, bv = -1e30; for (let i = 0; i < n; i++) if (on[i] && E[i] > bv) { bv = E[i]; b = i; } return b; };
    const vacant = () => { let b = -1, bv = 1e30; for (let i = 0; i < n; i++) if (!on[i] && E[i] < bv) { bv = E[i]; b = i; } return b; };
    for (let it = 0; it < n; it++) { const t = tight(); on[t] = 0; splat(t, -1); const v = vacant(); if (v === t) { on[t] = 1; splat(t, 1); break; } on[v] = 1; splat(v, 1); }
    const on0 = on.slice(), E0 = E.slice();
    for (let r = m0 - 1; r >= 0; r--) { const t = tight(); on[t] = 0; splat(t, -1); rank[t] = r; }
    on.set(on0); E.set(E0);
    for (let r = m0; r < n; r++) { const v = vacant(); on[v] = 1; splat(v, 1); rank[v] = r; }
    const out = new Uint8Array(n); for (let i = 0; i < n; i++) out[i] = Math.min(255, Math.floor((rank[i] + 0.5) / n * 256));
    return out;
  };

  // ---------------------------------------------------------------- the per-frame values (light2_gl.js uploads them)
  // E: env.js's frame; q: the renderer's settings. Kept in one object (no allocation a frame after the first)
  L2.frame = function (E, q, ticks, out) {
    out = out || {};
    const h = L2.hemiColors(E), K = L2.K;
    out.sky = h.sky; out.ground = h.ground; out.glow = h.glow; out.moods = h.moods;
    // the brighter side of the sky: toward the sun by day and at dusk, toward the moon at night
    const L = E.sunDir[1] > -0.1 ? E.sunDir : E.moonDir, hl = Math.hypot(L[0], L[2]) || 1;
    out.az = [L[0] / hl, L[2] / hl];
    out.k = [K.dir, K.xFace, K.wrapLeaf, K.wrapSkin];
    out.pool = [K.poolHot, K.poolK, K.poolTail, K.poolHue];
    out.air = L2.air(E, ticks || 0);
    out.mist = L2.mistColor(E);
    out.airK = L2.airGoldK(E);   // (f-sky5)
    out.sunTint = L2.sunTint(h.moods);
    out.grade = L2.grade(E);
    return out;
  };

  // ---------------------------------------------------------------- GLSL: the COMMON block's part (shaders.js includes it
  // right before applyFog; everything under its define, so a program without the switches compiles the same text)
  L2.glslCommon = function () {
    return `
#ifdef LIGHT2
// t-light2 · the light model (light2.js): the hemispheric ambient, the lamps' pools, the wrap
uniform vec3 u_l2Sky;      // the sky's light from above: the colour of the shade
uniform vec3 u_l2Ground;   // the ground's bounce from below
uniform vec4 u_l2K;        // x the sky's lean toward the light's azimuth, y the x-faces' shade, z the leaves' wrap, w the skin's
uniform vec2 u_l2Az;       // the light's azimuth (unit, x z)
uniform vec4 u_l2Pool;     // the lamps: x the hot spot, y the falloff (1/blocks²), z the tail's fade (level), w the hue's power
uniform vec3 u_l2Glow;     // the afterglow: the bright sky round the low sun, on the faces toward it (the golden hour, dusk)
vec3 l2Hemi(vec3 n) {
  vec3 c = mix(u_l2Ground, u_l2Sky, clamp(0.5 + 0.5 * n.y, 0.0, 1.0));
  float d = dot(n.xz, u_l2Az) * (1.0 - abs(n.y));
  return c * (1.0 + u_l2K.x * d) + u_l2Glow * max(d, 0.0);
}
vec3 l2Pool(vec3 bl) {
  float m = max(bl.r, max(bl.g, bl.b));
  if (m <= 0.0) return vec3(0.0);
  float d = 15.0 * (1.0 - m);
  float f = u_l2Pool.x / (1.0 + d * d * u_l2Pool.y) * smoothstep(0.0, u_l2Pool.z, m);
  return pow(bl / m, vec3(u_l2Pool.w)) * f * u_blockLightTint;
}
float l2Wrap(float nl, float w) { return clamp((nl + w) / (1.0 + w), 0.0, 1.0); }
#endif
#ifdef L2AO
// t-light2 · the contact shadows (light2_gl.js l2Ssao): last frame's, read where this fragment was then; the texture keeps
// the depth beside the occlusion, a fragment whose depth does not match (it was hidden then) takes none
uniform sampler2D u_l2Ao;
uniform vec4 u_l2AoK;      // x strength (0: not read — the mirror, the far cache), y the depth's tolerance (relative), z the block light's share
in vec4 v_l2AoClip;
float l2Ao() {
  if (u_l2AoK.x <= 0.0 || v_l2AoClip.w <= 0.07) return 1.0;
  vec2 uv = v_l2AoClip.xy / v_l2AoClip.w * 0.5 + 0.5;
  if (uv.x <= 0.0 || uv.y <= 0.0 || uv.x >= 1.0 || uv.y >= 1.0) return 1.0;
  vec2 a = texture(u_l2Ao, uv).rg;
  float e = abs(a.g - v_l2AoClip.w) / v_l2AoClip.w;
  return mix(1.0, a.r, u_l2AoK.x * (1.0 - smoothstep(u_l2AoK.y, u_l2AoK.y * 2.5, e)));
}
#endif
#ifdef AIR2
// t-light2 · the air: the distance haze as before, an exponential height fog integrated along the ray (dense in the
// valleys and over the water, a low morning layer), aerial perspective (the far land takes the horizon's colour, its
// contrast fades), the sun's light in the haze toward it
uniform vec4 u_l2Fog;      // x the density at the base (per block), y k (1 / scale height), z the base's height, w the eye's height
uniform vec4 u_l2Fog2;     // x 1 / the aerial perspective's distance, y its most, z the sun's in-scatter, w the night's dimming
uniform vec3 u_l2FogCol;   // the valley haze's colour
uniform vec4 u_l2Air;      // f-sky5: rgb the golden far air away from the sun, w its share (L2.airGoldK)
uniform vec3 u_l2Air2;     // f-sky5: the golden far air beside the sun
uniform vec4 u_l2Room;     // t-polish2: the room's air — rgb its colour (the lamps round the eye), w its density (0 outdoors)
vec3 l2Fog(vec3 col, vec3 rel, float dist) {
  vec3 dir = rel / max(dist, 0.001);
  if (u_fog.w > 0.5) return mix(col, u_fogColor, clamp(1.0 - exp(-dist * 0.07), 0.0, 1.0));
  vec3 hz = hazeColor(dir);
  // f-sky5 (R52-03): at the golden hour the far air a blue-lilac of its own (L2.AIRGOLD), not the horizon's pink-white
  if (u_l2Air.w > 0.0) { float ts = max(dot(dir, u_sunDir), 0.0); hz = mix(hz, mix(u_l2Air.rgb, u_l2Air2, ts * ts), u_l2Air.w); }
  vec3 fc = u_dim == 1 || u_dim == 2 ? u_fogColor : mix(hz, u_fogColor, 0.35);
  float hd = max(length(rel.xz), abs(rel.y) * 0.35);
  float f = smoothstep(u_fog.x, u_fog.y, hd);
  f = max(f, (1.0 - exp(-dist * u_fog.z)) * 0.85);
  if (u_dim != 0) return mix(col, fc, clamp(f, 0.0, 1.0));
  // aerial perspective: toward the horizon's colour with the distance (the far hills a step paler and bluer per plane)
  float ad = dist * u_l2Fog2.x, ap = (1.0 - exp(-ad * ad)) * u_l2Fog2.y;
  col = mix(col, hz, ap);
  // the height fog along the ray
  // (under the valley floor, L2.FOG_FLOOR blocks below the base, the haze keeps the floor's density: the ray's ends held there)
  float k = u_l2Fog.y, fy = u_l2Fog.z - ${L2.FOG_FLOOR.toFixed(1)}, ye = max(u_l2Fog.w, fy), dy = max(u_l2Fog.w + rel.y, fy) - ye, kd = k * dy;
  float g = abs(kd) > 1e-4 ? (1.0 - exp(-kd)) / kd : 1.0 - kd * 0.5;
  float od = u_l2Fog.x * exp(-k * (ye - u_l2Fog.z)) * dist * g;
  float hf = 1.0 - exp(-od);
  float toSun = max(dot(dir, u_sunDir), 0.0), t2 = toSun * toSun, t4 = t2 * t2;
  vec3 mist = u_l2FogCol + u_sunColor * (t4 * t4 * u_l2Fog2.z);
  col = mix(col, mist, clamp(hf, 0.0, 0.92));
  // t-polish2 · the room's air (light2.js ROOM): indoors the air glows with the lamps' colour — it lifts what is darker
  // than its light, never dims what is brighter (0 outdoors: w = 0)
  if (u_l2Room.w > 0.0) col = max(col, mix(col, u_l2Room.rgb, 1.0 - exp(-min(dist, ${L2.ROOM.max.toFixed(1)}) * u_l2Room.w)));
  return mix(col, fc, clamp(f, 0.0, 1.0));
}
#endif
`;
  };
  // the vertex shaders' part (TERRAIN_VS, PROP_VS, FURN_VS): where this vertex was in the last frame's view (the contact
  // shadows are read there)
  L2.glslVS = function () {
    return `
#if defined(L2AO) && !defined(MODEL)
uniform mat4 u_l2AoVP;     // the last frame's view-projection (as it was drawn, its jitter included)
uniform vec3 u_l2AoDelta;  // the eye's move since: this eye − that eye
out vec4 v_l2AoClip;
#endif
`;
  };

  // ---------------------------------------------------------------- GLSL: the light's own passes (light2_gl.js)
  // the contact shadows at half resolution: the depth → the view position, the normal from the depth's neighbours (the
  // smaller difference each way: no smear over an edge), n taps on a spiral in a disc of u_ao.x blocks, rotated by the
  // blue noise; out: R the obscurance (1 = open), G the linear depth (for the reprojection's test)
  L2.AO_FS = `
uniform highp sampler2D u_depth;
uniform sampler2D u_blue;
uniform vec4 u_proj;       // 1/P00, 1/P11, P8, P9 (the projection as drawn, its jitter included)
uniform vec2 u_nf;         // near, far
uniform vec2 u_texel;      // the full-res texel
uniform vec4 u_ao;         // x the radius (blocks), y the strength, z the bias (blocks), w the projected scale: P11 · (half the height in texels)
uniform float u_phase;     // the noise's turn this frame (the TSR accumulates the turns)
in vec2 v_uv;
out vec4 o;
float linZ(float d) { float z = d * 2.0 - 1.0; return 2.0 * u_nf.x * u_nf.y / (u_nf.y + u_nf.x - z * (u_nf.y - u_nf.x)); }
vec3 viewAt(vec2 uv, float zl) { vec2 ndc = uv * 2.0 - 1.0; return vec3((ndc.x + u_proj.z) * zl * u_proj.x, (ndc.y + u_proj.w) * zl * u_proj.y, -zl); }
vec3 posAt(vec2 uv) { return viewAt(uv, linZ(texture(u_depth, uv).r)); }
void main() {
  float d0 = texture(u_depth, v_uv).r;
  if (d0 >= 0.999999) { o = vec4(1.0, 1e4, 0.0, 1.0); return; }
  float z0 = linZ(d0);
  vec3 P = viewAt(v_uv, z0);
  vec3 pr = posAt(v_uv + vec2(u_texel.x, 0.0)), pl = posAt(v_uv - vec2(u_texel.x, 0.0));
  vec3 pu = posAt(v_uv + vec2(0.0, u_texel.y)), pd = posAt(v_uv - vec2(0.0, u_texel.y));
  vec3 dx = abs(pr.z - P.z) < abs(P.z - pl.z) ? pr - P : P - pl;
  vec3 dy = abs(pu.z - P.z) < abs(P.z - pd.z) ? pu - P : P - pd;
  vec3 N = normalize(cross(dx, dy));
  if (N.z < 0.0) N = -N;
  float rs = u_ao.x * u_ao.w / z0;                 // the disc's radius in texels (full res)
  if (rs < 1.5) { o = vec4(1.0, z0, 0.0, 1.0); return; }
  rs = min(rs, 160.0);
  float phi = (texture(u_blue, gl_FragCoord.xy / 64.0).r + u_phase) * 6.2831853;
  float R2 = u_ao.x * u_ao.x, sum = 0.0;
  for (int i = 0; i < TAPS; i++) {
    float a = (float(i) + 0.5) / float(TAPS), ang = a * TURNS * 6.2831853 + phi;
    vec2 uv = v_uv + vec2(cos(ang), sin(ang)) * (a * rs) * u_texel;
    vec3 Q = posAt(uv);
    vec3 v = Q - P;
    float vv = dot(v, v), vn = dot(v, N);
    float fall = max(R2 - vv, 0.0) / R2;
    sum += fall * fall * max(vn - u_ao.z, 0.0) / (vv + 0.01);
  }
  float ao = max(0.0, 1.0 - sum * u_ao.y * (2.0 / float(TAPS)));
  o = vec4(ao, z0, 0.0, 1.0);
}`;
  // the bilateral blur, one direction a pass (u_dir): 7 taps, Gaussian, each weighed by how close its depth is
  L2.BLUR_FS = `
uniform sampler2D u_src;   // R the obscurance, G the depth
uniform vec2 u_dir;        // one texel of the half-res target, along the pass
in vec2 v_uv;
out vec4 o;
void main() {
  vec2 c = texture(u_src, v_uv).rg;
  float s = c.r, w = 1.0;
  for (int i = 1; i <= 3; i++) {
    float g = exp(-float(i * i) / 8.0);
    for (int k = -1; k <= 1; k += 2) {
      vec2 t = texture(u_src, v_uv + u_dir * float(i * k)).rg;
      float wt = g * max(0.0, 1.0 - abs(t.g - c.g) / (c.g * 0.04 + 0.05));
      s += t.r * wt; w += wt;
    }
  }
  o = vec4(s / w, c.g, 0.0, 1.0);
}`;
  // the volumetric light at quarter resolution: along the ray to the scene's depth (at most u_vol.y), u_vol.x steps
  // started at a blue-noise offset and spaced quadratically (denser near the eye, where a shaft is widest on the screen),
  // the light's visibility from the shadow map at each (the map is affine along the ray: its coordinates are
  // interpolated), the density of the air at the step's height, a Henyey-Greenstein phase; a ray to the sky takes
  // u_volSky of it (the sky's own glow is the sky shader's); out: the in-scattered light (rgb) and the linear depth (a)
  // for the composite's depth-aware upsample
  L2.VOL_FS = `
uniform highp sampler2D u_depth;
uniform highp sampler2DShadow u_shadowMap;
uniform sampler2D u_blue;
uniform mat4 u_invVP;      // NDC → camera-relative (this frame, as drawn)
uniform mat4 u_shadowMat;  // camera-relative → the shadow map's clip space
uniform vec2 u_shadowOff;  // F9 · Schatten-Takt's toroidal offset (0: the plain map)
uniform vec2 u_nf;
uniform vec4 u_vol;        // x the steps, y the march's reach (blocks), z the density at the eye, w the phase's g
uniform vec4 u_volH;       // x the eye's height, y k (1 / the haze's scale height), z the haze's base, w the shadow map's bias
uniform vec3 u_volCol;     // the light's colour × strength
uniform vec3 u_volL;       // toward the light
uniform float u_volSky;    // the share of a ray to the sky
uniform float u_volShaft;  // the shafts' boost (L2.volShaft): a ray part lit, mostly in shadow shows the air most
uniform vec2 u_volF;       // x 1 / the far air's fade (blocks), y the eye's shade: the air ×(1 + y) where the eye is in shadow
uniform float u_phase;
in vec2 v_uv;
out vec4 o;
float linZ(float d) { float z = d * 2.0 - 1.0; return 2.0 * u_nf.x * u_nf.y / (u_nf.y + u_nf.x - z * (u_nf.y - u_nf.x)); }
void main() {
  float d = texture(u_depth, v_uv).r;
  vec4 pf = u_invVP * vec4(v_uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  vec3 P = pf.xyz / pf.w;
  float len = length(P);
  vec3 dir = P / max(len, 1e-4);
  float T = min(len, u_vol.y);
  float n = u_vol.x, dt = T / n;
  float j = fract(texture(u_blue, gl_FragCoord.xy / 64.0).r + u_phase);
  vec3 s0 = (u_shadowMat * vec4(0.0, 0.0, 0.0, 1.0)).xyz, s1 = (u_shadowMat * vec4(dir * T, 1.0)).xyz;
  float acc = 0.0, tot = 0.0, eye = 1.0;
  for (int i = 0; i < 16; i++) {
    if (float(i) >= n) break;
    float u = (float(i) + j) / n, f = u * u, t = f * T;
    vec3 sc = mix(s0, s1, f) * 0.5 + 0.5;
    float vis = 1.0;
    if (sc.x > 0.0 && sc.y > 0.0 && sc.x < 1.0 && sc.y < 1.0 && sc.z < 1.0) vis = texture(u_shadowMap, vec3(fract(sc.xy + u_shadowOff), sc.z - u_volH.w));
    if (i == 0) eye = vis;
    float h = u_volH.x + dir.y * t;
    float w = exp(-u_volH.y * max(h - u_volH.z, ${(-L2.FOG_FLOOR).toFixed(1)})) * exp(-t * u_volF.x) * 2.0 * u * dt;
    acc += vis * w; tot += w;
  }
  // the shafts: weighed by how much of the ray is in shadow (a ray all lit or all dark: the haze as it is; most where a
  // third is lit), denser where the eye itself stands in shadow
  float lit = acc / max(tot, 1e-6);
  acc *= (1.0 + u_volShaft * 6.75 * lit * (1.0 - lit) * (1.0 - lit)) * (1.0 + u_volF.y * (1.0 - eye));
  float c = dot(dir, u_volL), g = u_vol.w, g2 = g * g;
  float ph = (1.0 - g2) / pow(max(1.0 + g2 - 2.0 * g * c, 1e-4), 1.5);
  o = vec4(u_volCol * (acc * u_vol.z * ph * (d >= 0.999999 ? u_volSky : 1.0)), linZ(d));
}`;
  // the composite's part (COMPOSITE_FS includes it): the grade, the vignette, the flare, the volumetric light's upsample
  L2.glslComposite = function () {
    return `
#ifdef GRADE2
// t-light2 · the grade by the hour (light2.js L2.grade): a 3-point tone curve, split toning, the mid-tones' saturation,
// a soft vignette (round on the screen, whatever its aspect), the sun's flare (ghosts along the axis through the centre)
uniform vec4 u_l2Curve;    // x the toe, y the mid-point's gamma, z the S's strength, w the shoulder
uniform vec3 u_l2Dark;     // the darks lean to (display space)
uniform vec3 u_l2Light;    // the lights lean to
uniform vec4 u_l2Vig;      // x the vignette's strength, y the aspect, z the mid-tones' saturation, w the flare's strength
uniform vec4 u_l2Sun;      // xy the sun's place on the screen (uv), z the flare's gate (0: none), w the sun disc's radius (uv)
uniform vec4 u_l2Ghost[5]; // per ghost: xy its place, z its radius (screen heights), w unused
uniform vec3 u_l2GhostC[5];
vec3 l2Curve(vec3 x) {
  x = clamp(x, 0.0, 1.0);
  vec3 y = pow(x, vec3(u_l2Curve.y));
  y = mix(y, y * y * (3.0 - 2.0 * y), u_l2Curve.z);
  return u_l2Curve.x + (u_l2Curve.w - u_l2Curve.x) * y;
}
vec3 l2Grade(vec3 c, vec2 uv) {
  c = l2Curve(c);
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float wd = (1.0 - l) * (1.0 - l), wl = l * l;
  vec3 s = c + u_l2Dark * wd + u_l2Light * wl;
  s -= dot(s, vec3(0.2126, 0.7152, 0.0722)) - l;
  float mid = 1.0 - abs(2.0 * l - 1.0);
  s = mix(vec3(l), s, 1.0 + (u_l2Vig.z - 1.0) * mid);
  vec2 v = (uv - 0.5) * vec2(u_l2Vig.y, 1.0);
  s *= 1.0 - u_l2Vig.x * smoothstep(0.25, 0.95, dot(v, v) * 2.2);
  return clamp(s, 0.0, 1.0);
}
// the flare (added in HDR before the tone map, only with the sun in the frame and seen): how much of the sun's disc is
// seen, from the scene's brightness there (a cloud, a roof or a tree in front of it dims it — the same five texels for
// every pixel), then the ghosts
vec3 l2Flare(vec2 uv) {
  if (u_l2Sun.z <= 0.0) return vec3(0.0);
  float seen = 0.0;
  for (int i = 0; i < 5; i++) {
    float a = float(i) * 1.5707963;
    vec2 off = i == 0 ? vec2(0.0) : vec2(cos(a) / u_l2Vig.y, sin(a)) * u_l2Sun.w * 0.6;
    seen += smoothstep(1.5, 5.0, dot(texture(u_scene, u_l2Sun.xy + off).rgb, vec3(0.2126, 0.7152, 0.0722)));
  }
  seen *= 0.2;
  if (seen <= 0.0) return vec3(0.0);
  vec3 f = vec3(0.0);
  for (int i = 0; i < 5; i++) {
    vec2 d = (uv - u_l2Ghost[i].xy) * vec2(u_l2Vig.y, 1.0);
    float r = length(d) / u_l2Ghost[i].z;
    f += u_l2GhostC[i] * (1.0 - smoothstep(0.55, 1.0, r)) * (0.6 + 0.4 * smoothstep(0.3, 0.95, r));
  }
  return f * seen * u_l2Sun.z * u_l2Vig.w;
}
#endif
#ifdef L2VOL
// t-light2 · the volumetric light, upsampled: the four quarter-res texels round the pixel, each weighed bilinearly and by
// how close its depth is to the pixel's own
uniform float u_l2VolOn;            // this frame (the light up and its shadow map there)
uniform sampler2D u_l2Vol;          // rgb the in-scattered light, a the linear depth
uniform highp sampler2D u_l2Depth;  // the full-res depth
uniform vec2 u_l2VolSize;           // the quarter-res target's size (texels)
uniform vec2 u_l2nf;
vec3 l2VolAt(vec2 uv) {
  float zd = texture(u_l2Depth, uv).r * 2.0 - 1.0;
  float z = 2.0 * u_l2nf.x * u_l2nf.y / (u_l2nf.y + u_l2nf.x - zd * (u_l2nf.y - u_l2nf.x));
  vec2 t = uv * u_l2VolSize - 0.5, f = fract(t), b = (floor(t) + 0.5) / u_l2VolSize, e = 1.0 / u_l2VolSize;
  vec4 a = texture(u_l2Vol, b), bb = texture(u_l2Vol, b + vec2(e.x, 0.0)), c = texture(u_l2Vol, b + vec2(0.0, e.y)), d = texture(u_l2Vol, b + e);
  vec4 w = vec4((1.0 - f.x) * (1.0 - f.y), f.x * (1.0 - f.y), (1.0 - f.x) * f.y, f.x * f.y);
  vec4 dz = abs(vec4(a.a, bb.a, c.a, d.a) - z) / (z * 0.06 + 0.3);
  w *= 1.0 / (1.0 + dz * dz) + 1e-4;
  return (a.rgb * w.x + bb.rgb * w.y + c.rgb * w.z + d.rgb * w.w) / (w.x + w.y + w.z + w.w);
}
#endif
`;
  };
  // ---------------------------------------------------------------- step 6 · the lighthouse's beams (light2_gl.js l2Beams)
  // two beams from the lamp, opposite each other, sweeping round (a turn every BEAM.period seconds), a little below the
  // horizon; each an open cone drawn additively (no depth write): bright through its middle, soft at its edges (the
  // facing ratio), fading along its length and with the distance. At night and late dusk.
  L2.BEAM = { len: 150, r0: 0.35, r1: 7, tilt: -0.045, period: 9, k: 0.55, reach: 460, col: [1.0, 0.93, 0.74], seg: 20 };
  // the beams' strength by the night's weight (0 by day; full from E.night 0.6)
  L2.beamK = (night) => L2.BEAM.k * sstep(0.25, 0.6, night || 0);
  // the heading of beam i (0, 1) at time t (seconds)
  L2.beamAngle = (t, i) => (t / L2.BEAM.period) * Math.PI * 2 + i * Math.PI;
  // the cone as a mesh: x along the axis (0 at the lamp, 1 at the end), yz the unit ring
  L2.beamMesh = function (seg) {
    seg = seg || L2.BEAM.seg;
    const v = [], idx = [];
    for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI * 2; v.push(0, Math.cos(a), Math.sin(a), 1, Math.cos(a), Math.sin(a)); }
    for (let i = 0; i < seg; i++) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, b, d, a, d, c); }
    return { v: new Float32Array(v), i: new Uint16Array(idx) };
  };
  L2.BEAM_VS = `
in vec3 a_pos;
uniform mat4 u_viewProj;
uniform vec3 u_origin;     // the lamp, camera-relative
uniform vec3 u_axis;       // the beam's direction (unit)
uniform vec3 u_shape;      // its length, its radius at the lamp, at the end
out float v_t;
out vec3 v_rel;
out vec3 v_n;
void main() {
  vec3 ax = u_axis, side = normalize(vec3(-ax.z, 0.0, ax.x)), up = cross(side, ax);
  float r = mix(u_shape.y, u_shape.z, a_pos.x);
  v_n = side * a_pos.y + up * a_pos.z;
  v_rel = u_origin + ax * (a_pos.x * u_shape.x) + v_n * r;
  v_t = a_pos.x;
  gl_Position = u_viewProj * vec4(v_rel, 1.0);
}`;
  L2.BEAM_FS = `
uniform vec3 u_col;        // the light × the night's strength
in float v_t;
in vec3 v_rel;
in vec3 v_n;
out vec4 o;
void main() {
  vec3 V = normalize(-v_rel);
  float face = abs(dot(normalize(v_n), V));
  float along = (1.0 - v_t) * (1.0 - v_t) * smoothstep(0.0, 0.02, v_t);
  o = vec4(u_col * (face * face * along * exp(-length(v_rel) / 520.0)), 1.0);
}`;

  // the light's programs and their define sets (the offline compile check and test/light2.js)
  L2.passDefines = (taps) => ['TAPS ' + (taps | 0), 'TURNS ' + (L2.TURNS[L2.TAPS.indexOf(taps)] || 5) + '.0'];
  L2.programs = function (S) {
    return [
      ['l2ao', S.FS_VS, L2.AO_FS, [L2.passDefines(4), L2.passDefines(8), L2.passDefines(12)]],
      ['l2blur', S.FS_VS, L2.BLUR_FS, [[]]],
      ['l2vol', S.FS_VS, L2.VOL_FS, [[]]],
      ['l2beam', L2.BEAM_VS, L2.BEAM_FS, [[]]],
    ];
  };
  // the define sets of the terrain-like programs (the offline check compiles every one)
  L2.defineSets = () => [[], ['LIGHT2'], ['LIGHT2', 'AIR2'], ['LIGHT2', 'L2AO', 'AIR2'], ['AIR2']];
  L2.compositeSets = () => [[], ['GRADE2'], ['GRADE2', 'L2VOL'], ['L2VOL']];
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
