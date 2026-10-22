// t-sky3 · WOW V · Der Himmel (docs/superpowers/plans/2026-10-16-t-sky3.md): the sky's pure parts, node only.
//  a · the switches: Himmel (sky3 0 · 1 · 2) and Wolken mit Volumen (cloudVol) by preset — Very Low none of them, Low the
//      cheap sky, Balanced and up the full set; the defines by program (Very Low's programs carry none); the settings
//      rows and their texts in German and English
//  b · Very Low keeps its shaders: SKY_FS, PUFF_VS/FS and CLOUD_VS/FS with LITE alone, after the preprocessor, are the text
//      without sky3.js; every define set of the new blocks has balanced #if/#endif
//  c · the moons' phases from the sun's direction: the illuminated fraction (1 − cos e) / 2 of the elongation e, the lit
//      limb toward the sun (the shader's per-pixel test mirrored: its lit pixels lie on the sun's side, their share the
//      fraction); the big moon near full most nights (gibbous to full: the night's light comes from its side), the small
//      one through every phase, a thin crescent beside the setting sun on some evenings
//  d · the shooting stars: a seeded schedule of the world (the same for the host and every guest at the same tick), about
//      one in 90 s, each a short streak (0.5–1.5 s) high in the sky moving down, its head brightest and its tail fading;
//      only in a dark sky
//  e · the aurora: seeded per night, about one night in three, at the north horizon, faded in after dusk and out before
//      the dawn, none under clouds or rain
//  f · the clouds' light by the hour (white by day, gold at the golden hour, rose round the sunset, moon-grey-blue at
//      night, grey in the rain) and the volume atlas (four cumulus: a flat base, lobes heaped on top, the normals out of the
//      cloud, thick in the middle, the creases darker); the frame's uniforms (every name the GLSL declares, filled, finite;
//      off the overworld the layers off)
//  g · the band model (test/sky3_model.js: the gradient, the glows, the cirrus and t-sky3's layers through the composite
//      and t-light2's grade, sampled as test/sky3.mjs measures, plus run 1's measured residual — the space, the bloom):
//      ΔE per band before (v0.48: the switch off) and after against the frames' targets — the golden hour and the dusk
//      far nearer the frames, every band within ΔE 12, the day unchanged
// usage: node test/sky3.js   (bash test/wt_run.sh sky3.js 300)
const V = require('./load_shared.js');
const fs = require('fs'), path = require('path');
global.performance = global.performance || require('perf_hooks').performance;
const SRC = path.join(__dirname, '..', 'src', 'main');
require(SRC + '/weather.js');
require(SRC + '/skybodies.js');
// the shaders twice: without sky3.js (as before) and with it
require(SRC + '/gl.js');
require(SRC + '/light2.js');
require(SRC + '/shaders.js');
const S0 = VR.SHADERS;
delete require.cache[require.resolve(SRC + '/shaders.js')];
require(SRC + '/sky3.js');
require(SRC + '/shaders.js');
const S1 = VR.SHADERS;
require(SRC + '/clouds.js');
require(SRC + '/env.js');
require(SRC + '/settings_reg.js');
const S3 = VR.Sky3, WX = VR.WX;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const deg = (r) => r * 180 / Math.PI;

// ---------------------------------------------------------------- a · the switches
console.log('a · the switches');
{
  check(!!S3 && Array.isArray(S3.SW) && S3.SW.join() === 'sky3,cloudVol', 'VR.Sky3 holds the two switches (sky3, cloudVol)');
  const d = (p) => S3.defaults(p);
  check(d('potato').sky3 === 0 && d('potato').cloudVol === false, 'Very Low (potato): none of them');
  check(d('low').sky3 === 1 && d('low').cloudVol === false, 'Low: the cheap sky (level 1), the box clouds as they are');
  check(['balanced', 'high', 'ultra', 'ultraLite'].every(p => d(p).sky3 === 2 && d(p).cloudVol === true), 'Balanced and up: the full sky (level 2) and the clouds with volume');
  const defs = (name, q) => S3.definesFor(name, q);
  const QV = { sky3: 0, cloudVol: false, clouds: 1, lite: true }, QL = { sky3: 1, cloudVol: false, clouds: 1 }, QB = { sky3: 2, cloudVol: true, clouds: 2 };
  check(['sky', 'puff', 'cloud', 'terrain', 'composite'].every(n => defs(n, QV).length === 0), 'Very Low: no sky define in any program');
  check(defs('sky', QL).join() === 'SKY3' && defs('cloud', QL).join() === 'SKY3' && defs('puff', QL).length === 0, 'Low: SKY3 in the sky and the box clouds');
  check(defs('sky', QB).join() === 'SKY3,SKY3HI' && defs('puff', QB).join() === 'CLOUD3' && defs('terrain', QB).length === 0, 'Balanced+: SKY3 + SKY3HI in the sky, CLOUD3 in the cumulus sprites; nothing on the land');
  check(defs('puff', { sky3: 2, cloudVol: true, clouds: 1 }).length === 0, 'the volume needs the sprite clouds (clouds 2)');
  // the hook chains the light's (gl.js asks GL.defineHook once per program)
  S3.use(QB); const hk = VR.GL && VR.GL.defineHook ? VR.GL.defineHook('sky', ['WXDRAMA']) : null; S3.use(QV);
  check(!VR.GL || (hk && hk.includes('WXDRAMA') && hk.includes('SKY3') && hk.includes('SKY3HI')), 'the define hook adds the sky\'s defines and keeps the program\'s own (and the light\'s hook)');
  check(S3.key(QV) !== S3.key(QL) && S3.key(QL) !== S3.key(QB) && S3.key(QB) === S3.key(Object.assign({}, QB)), 'the switches\' key changes with them (the renderer rebuilds its programs)');
  const rows = S3.ROWS || [];
  check(rows.length === 2 && rows.every(r => VR.Settings.byKey(r.key)) && rows[0].t === 'slider' && rows[0].max === 2 && rows[1].t === 'switch', 'the settings rows: Himmel (0 · 1 · 2) and Wolken mit Volumen, in the panel');
  const DE = fs.readFileSync(SRC + '/lang_de.js', 'utf8'), EN = fs.readFileSync(SRC + '/lang_en.js', 'utf8');
  const keys = rows.flatMap(r => [r.lab, r.tip].concat(r.vals ? [r.vals] : []));
  check(keys.every(k => DE.includes(`'${k}'`) && EN.includes(`'${k}'`)), 'their labels and tips in German and English: ' + keys.join(' '));
  // game.js hands the switches to the presets, to the saved settings and to the renderer (as t-light2's): without it every
  // preset drew the old sky (the first lab run: sky3 0 on High)
  const G = fs.readFileSync(SRC + '/game.js', 'utf8');
  check(/for \(const p in PRESETS\) Object\.assign\(PRESETS\[p\], VR\.Sky3\.defaults\(p\)\)/.test(G), 'game.js: every preset takes its sky switches (VR.Sky3.defaults)');
  check(/for \(const k of S3_SW\) if \(s\[k\] === undefined && s\.preset\)/.test(G), 'game.js: settings saved before follow their preset');
  check(/for \(const k of S3_SW\) qb\[k\] =/.test(G), 'game.js: the renderer gets the switches (its defines)');
}

// ---------------------------------------------------------------- b · Very Low keeps its shaders
console.log('b · Very Low keeps its shaders');
{
  const pp = (src, defs) => {
    const out = [], st = [], ev = (e) => !!eval(e.replace(/defined\s*\(\s*(\w+)\s*\)/g, (_, d) => defs.includes(d) ? 'true' : 'false'));
    for (const line of src.split('\n')) { const t = line.trim(); let m;
      if ((m = /^#ifdef\s+(\w+)/.exec(t))) { const v = defs.includes(m[1]); st.push({ on: v, done: v }); continue; }
      if ((m = /^#ifndef\s+(\w+)/.exec(t))) { const v = !defs.includes(m[1]); st.push({ on: v, done: v }); continue; }
      if ((m = /^#if\s+(.*)$/.exec(t))) { const v = ev(m[1]); st.push({ on: v, done: v }); continue; }
      if ((m = /^#elif\s+(.*)$/.exec(t))) { const q = st[st.length - 1], v = !q.done && ev(m[1]); q.on = v; q.done = q.done || v; continue; }
      if (/^#else/.test(t)) { const q = st[st.length - 1]; q.on = !q.done; q.done = true; continue; }
      if (/^#endif/.test(t)) { st.pop(); continue; }
      if (st.every(q => q.on)) out.push(line); }
    return out.join('\n');
  };
  const tidy = (t) => t.split('\n').map((l) => l.replace(/\s+$/, '')).filter((l) => l.length).join('\n');
  for (const k of ['SKY_FS', 'PUFF_VS', 'PUFF_FS', 'CLOUD_VS', 'CLOUD_FS', 'TERRAIN_FS', 'COMPOSITE_FS']) {
    for (const defs of [['LITE'], ['WXDRAMA', 'MOTION'], ['WXDRAMA']]) {
      const a = tidy(pp(S1[k], defs)), b = tidy(pp(S0[k], defs));
      check(a === b, `${k} with ${defs.join('+')} alone is the text without sky3.js (${a.length} characters)`);
    }
  }
  const balanced = (src) => { let d = 0; for (const l of src.split('\n')) { const t = l.trim(); if (/^#if/.test(t)) d++; else if (/^#endif/.test(t)) { d--; if (d < 0) return false; } } return d === 0; };
  check(['SKY_FS', 'PUFF_VS', 'PUFF_FS', 'CLOUD_FS', 'CLOUD_VS'].every(k => balanced(S1[k])), 'every new block\'s #if / #endif balanced');
  check(/#ifdef SKY3/.test(S1.SKY_FS) && /#ifdef CLOUD3/.test(S1.PUFF_FS) && /#ifdef SKY3/.test(S1.CLOUD_FS), 'the new code is behind SKY3 (sky, box clouds) and CLOUD3 (cumulus sprites)');
}

// ---------------------------------------------------------------- c · the moons' phases
console.log('c · the moons');
{
  // the phase of a body at C lit from L: the shader's frame (shaders.js moonlet: X = cross(up, C), Y = cross(C, X)),
  // the per-pixel lit test (the sphere's normal facing the viewer, lit where N·L > 0) counted over the disc
  const disc = (C, L) => {
    const up = Math.abs(C[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0], X = norm(cross(up, C)), Y = cross(C, X);
    let n = 0, lit = 0, cx = 0, cy = 0;
    for (let j = -40; j <= 40; j++) for (let i = -40; i <= 40; i++) {
      const qx = i / 40, qy = j / 40, r2 = qx * qx + qy * qy; if (r2 >= 1) continue;
      const zz = Math.sqrt(1 - r2), N = [X[0] * qx + Y[0] * qy - C[0] * zz, X[1] * qx + Y[1] * qy - C[1] * zz, X[2] * qx + Y[2] * qy - C[2] * zz];
      n++; if (dot(N, L) > 0) { lit++; cx += qx; cy += qy; }
    }
    return { k: lit / n, dir: Math.hypot(cx, cy) > 1e-9 ? [cx / Math.hypot(cx, cy), cy / Math.hypot(cx, cy)] : [0, 0], X, Y };
  };
  let worst = 0, side = 0, total = 0;
  for (const e of [20, 45, 70, 90, 110, 140, 165]) for (const rot of [0, 1.1, 2.3, 4.0]) {
    const L = norm([Math.cos(rot), 0.25, Math.sin(rot)]);
    // a moon e degrees from the sun, turned round it
    const a = norm(cross(L, [0, 1, 0])), b = cross(L, a), er = e * Math.PI / 180, ph = rot * 1.7;
    const C = norm([L[0] * Math.cos(er) + (a[0] * Math.cos(ph) + b[0] * Math.sin(ph)) * Math.sin(er), L[1] * Math.cos(er) + (a[1] * Math.cos(ph) + b[1] * Math.sin(ph)) * Math.sin(er), L[2] * Math.cos(er) + (a[2] * Math.cos(ph) + b[2] * Math.sin(ph)) * Math.sin(er)]);
    const ph3 = S3.moonPhase(C, L), d = disc(C, L);
    worst = Math.max(worst, Math.abs(ph3.k - (1 - Math.cos(er)) / 2), Math.abs(d.k - ph3.k));
    // the lit limb toward the sun: the sun's direction in the disc's frame
    const sl = [dot(L, d.X), dot(L, d.Y)], sll = Math.hypot(sl[0], sl[1]);
    if (sll > 0.05 && ph3.k < 0.97) { total++; if (d.dir[0] * sl[0] / sll + d.dir[1] * sl[1] / sll > 0.9 && ph3.lit[0] * sl[0] / sll + ph3.lit[1] * sl[1] / sll > 0.99) side++; }
  }
  check(worst < 0.03, `the illuminated fraction is (1 − cos e) / 2 of the elongation, and the shader's lit test gives it (worst ${worst.toFixed(3)})`);
  check(total > 10 && side === total, `the lit limb faces the sun (${side} of ${total} phases; a crescent's bright edge on the sun's side)`);
  // over 24 days at the hours of the night: the big moon gibbous to full, the small one every phase
  const big = [], small = [];
  for (let day = 0; day < 24; day++) for (const tod of [13500, 16000, 18000, 20000, 22500]) {
    const env = new VR.Env(); env.setTime(tod); env.day = day; env.wx.setSeed(4242); env.wx.force('klar');
    S3.use({ sky3: 2, cloudVol: true, clouds: 2 });
    const E = env.update(0, { dim: 'overworld', biome: null, eyeSky: 1, renderDist: 8, horizon: 0, freezeTime: true, freezeWeather: true });
    const m = E.sky3 && E.sky3.moons;
    if (!m) continue;
    big.push(m[0].k); small.push(m[1].k);
    // the night's light is the env's as before (t-light2: the land's light keeps its direction)
    if (day === 3 && tod === 18000) check(Math.abs(dot(E.moonDir, E.sunDir) + 1) < 1e-9, 'the moon\'s light on the land keeps its direction (opposite the sun: E.moonDir as before)');
  }
  S3.use({ sky3: 0, cloudVol: false });
  const mn = (v) => Math.min(...v), mx = (v) => Math.max(...v);
  check(big.length > 50 && mn(big) > 0.72 && mx(big) > 0.97, `the big moon at night gibbous to full (fraction ${mn(big).toFixed(2)} … ${mx(big).toFixed(2)})`);
  check(small.length > 50 && mn(small) < 0.15 && mx(small) > 0.9, `the small moon through every phase (fraction ${mn(small).toFixed(2)} … ${mx(small).toFixed(2)})`);
  // the crescent beside the setting sun: some evening has the small moon a thin crescent low over the west
  let cres = null;
  for (let day = 0; day < 30 && !cres; day++) {
    const env = new VR.Env(); env.setTime(12300); env.day = day; env.wx.setSeed(4242); env.wx.force('klar');
    S3.use({ sky3: 2 });
    const E = env.update(0, { dim: 'overworld', biome: null, eyeSky: 1, renderDist: 8, horizon: 0, freezeTime: true, freezeWeather: true });
    const m = E.sky3 && E.sky3.moons && E.sky3.moons[1];
    if (m && m.k < 0.3 && m.dir[1] > 0.05 && deg(Math.acos(dot(m.dir, E.sunDir))) < 60) cres = { day, k: m.k, el: deg(Math.asin(m.dir[1])) };
  }
  S3.use({ sky3: 0 });
  check(!!cres, `an evening with a crescent beside the setting sun (${cres ? `day ${cres.day}: fraction ${cres.k.toFixed(2)}, ${cres.el.toFixed(0)}° up` : 'none in 30 days'})`);
}

// ---------------------------------------------------------------- d · the shooting stars
console.log('d · the shooting stars');
{
  const seed = 4242, A0 = 3 * 24000 + 12000, N = 24000 * 20;   // twenty nights' and days' worth of ticks
  let n = 0, lenOK = 0, downOK = 0, highOK = 0, last = -1, gaps = [];
  for (let A = A0; A < A0 + N; ) {
    const m = S3.meteorNext(seed, A, 4);
    if (!m) { A += 1600 * 4; continue; }
    n++; if (last >= 0) gaps.push((m.A - last) / 20); last = m.A;
    if (m.dur >= 0.5 && m.dur <= 1.5) lenOK++;
    if (m.to[1] < m.from[1]) downOK++;
    if (Math.asin(m.from[1]) > 20 * Math.PI / 180) highOK++;
    A = m.A + m.dur * 20 + 1;
  }
  const meanGap = gaps.reduce((a, b) => a + b, 0) / Math.max(1, gaps.length);
  check(n > 100 && meanGap > 70 && meanGap < 110, `about one in 90 s (${n} in ${N / 20 / 60} minutes of the world's time, the mean gap ${meanGap.toFixed(0)} s)`);
  check(lenOK === n && downOK === n && highOK === n, `each a short streak (0.5–1.5 s: ${lenOK}/${n}) starting high (over 20°: ${highOK}/${n}) and falling (${downOK}/${n})`);
  // the same for the host and a guest at the same tick (the schedule is a pure function of the seed and the tick)
  const m1 = S3.meteorNext(seed, A0, 8), m2 = S3.meteorNext(seed, A0, 8), m3 = S3.meteorNext(seed + 1, A0, 8);
  check(JSON.stringify(m1) === JSON.stringify(m2) && JSON.stringify(m1) !== JSON.stringify(m3), 'the same streak for the same world at the same tick; another world has its own');
  // mid-flight: the head and the tail along the path, the head brightest
  const mid = S3.meteorAt(seed, m1.A + m1.dur * 20 * 0.5), none = S3.meteorAt(seed, m1.A - 5);
  check(!!mid && mid.p > 0.4 && mid.p < 0.6 && mid.bright > 0.5 && (!none || none.A !== m1.A), `mid-flight its head half way (${mid ? mid.p.toFixed(2) : '—'}), bright (${mid ? mid.bright.toFixed(2) : '—'}); before its start nothing`);
  const fade = S3.meteorAt(seed, m1.A + m1.dur * 20 * 0.95);
  check(!!fade && fade.bright < mid.bright, 'it fades at the end of its flight');
  check(S3.meteorVis(0) === 0 && S3.meteorVis(1) === 1 && S3.meteorVis(0.4) < 0.5, 'only in a dark sky (none by day, full at night)');
}

// ---------------------------------------------------------------- e · the aurora
console.log('e · the aurora');
{
  const seed = 4242;
  let on = 0; const N = 300;
  for (let n = 0; n < N; n++) if (S3.auroraNight(seed, n) > 0) on++;
  check(on / N > 0.25 && on / N < 0.42, `about one night in three (${on} of ${N})`);
  check([0, 1, 2, 3, 4, 5, 6, 7].map(n => S3.auroraNight(seed, n)).join() === [0, 1, 2, 3, 4, 5, 6, 7].map(n => S3.auroraNight(seed, n)).join() && [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].some(n => S3.auroraNight(seed, n) !== S3.auroraNight(seed + 7, n)), 'seeded per night: the same for everyone in the world, another world has other nights');
  let n0 = 0; while (S3.auroraNight(seed, n0) <= 0 && n0 < 50) n0++;
  const at = (tod, rain, cover) => S3.auroraAt(seed, n0 * 24000 + tod, VR.Env ? sunYAt(tod) : 0, rain || 0, cover === undefined ? 0.2 : cover);
  function sunYAt(tod) { const th = tod / 24000 * Math.PI * 2; return Math.sin(Math.sin(th) * 0.42); }
  check(at(6000) === 0 && at(12100) === 0, 'none by day or at the sunset');
  check(at(17000) > 0.3 && at(18000) > 0.3, `in the deep night it shows (${at(17000).toFixed(2)} at 23:00)`);
  check(at(23900) < at(18000) * 0.5, 'it fades before the dawn');
  check(at(17000, 1) === 0 && at(17000, 0, 0.95) < 0.1, 'none under rain or a closed sky');
  const dir = S3.AURORA;
  check(dir && dir.az === 0 && dir.span > 0 && dir.span < Math.PI && dir.el[0] > 0 && dir.el[1] < 0.8, 'at the north horizon (yaw 0 looks along −z: the curtains round it, low over the horizon)');
}

// ---------------------------------------------------------------- f · the clouds' light and the atlas
console.log('f · the clouds\' light and the volume atlas');
{
  const th = (tod) => tod / 24000 * Math.PI * 2, sunAt = (tod) => { const t = th(tod), el = Math.sin(t) * 0.42, az = t + 0.4; return [Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)]; };
  const CLAt = (tod, rain) => { const s = sunAt(tod); return S3.cloudLight({ sunDir: s, moonDir: s.map(v => -v), rain: rain || 0, sky3: { moons: [{ k: 1 }] } }); };
  const noon = CLAt(6000), gold = CLAt(10800), dusk = CLAt(11900), night = CLAt(17000), wet = CLAt(6000, 1);
  const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], fmt = (c) => c.map(v => v.toFixed(2)).join(',');
  check(lum(noon.sun) > 1 && noon.sun[2] / noon.sun[0] > 0.8, `noon: the sun's light on the clouds near white (${fmt(noon.sun)})`);
  check(gold.sun[0] > gold.sun[1] && gold.sun[1] > gold.sun[2] && gold.sun[2] / gold.sun[0] < 0.7, `the golden hour: gold (${fmt(gold.sun)})`);
  check(dusk.sun[0] > dusk.sun[1] * 1.4 && dusk.sun[2] > dusk.sun[1] * 0.55, `the sunset: rose-orange (${fmt(dusk.sun)})`);
  check(lum(night.sun) < 0.2 && night.sun[2] > night.sun[0] && night.L[1] > 0, `night: the moon's dim grey-blue from above (${fmt(night.sun)})`);
  check(lum(wet.sun) < lum(noon.sun) * 0.2 && Math.abs(wet.top[0] - wet.top[2]) < 0.1, `rain: the sun dimmed, the sky's light grey (${fmt(wet.top)})`);
  const A = S3.atlas(), S = 256, N = 128;
  let ok = 0;
  const rep = [];
  for (let k = 0; k < 4; k++) {
    const ox = (k % 2) * N, oy = Math.floor(k / 2) * N, at = (i, j, c) => A[((oy + j) * S + ox + i) * 4 + c] / 255;
    let base = [], tops = [], nL = 0, nR = 0, nT = 0, nB = 0, thC = 0, thE = 0, cE = 0, aoBase = 0, aoTop = 0, nb = 0, nt = 0;
    for (let i = 4; i < N - 4; i++) { let lo = -1, hi = -1; for (let j = 0; j < N; j++) if (at(i, j, 0) > 0.04) { if (lo < 0) lo = j; hi = j; } if (lo >= 0) { base.push(lo); tops.push(hi); } }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      if (at(i, j, 0) <= 0.04) continue;
      const l = i > 0 && at(i - 1, j, 0) <= 0.04, r = i < N - 1 && at(i + 1, j, 0) <= 0.04, t = j < N - 1 && at(i, j + 1, 0) <= 0.04, b = j > 0 && at(i, j - 1, 0) <= 0.04;
      const nx = at(i, j, 1) * 2 - 1, ny = at(i, j, 2) * 2 - 1;
      if (l && !r && !t && !b) nL += nx < 0 ? 1 : 0; if (r && !l && !t && !b) nR += nx > 0 ? 1 : 0;
      if (t && !b) nT += ny > 0 ? 1 : 0; if (b && !t) nB += ny < 0 ? 1 : 0;
      const edge = l || r || t || b; if (edge) { thE += at(i, j, 0); cE++; }
    }
    const mid = (j) => at(N >> 1, j, 0);
    let jm = -1; for (let j = 0; j < N; j++) if (mid(j) > 0.04) { jm = j; break; }
    thC = jm >= 0 ? mid(Math.min(N - 1, jm + 20)) : 0;
    for (let i = 0; i < N; i++) { const lo = base[i]; if (lo === undefined) continue; }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { if (at(i, j, 0) <= 0.04) continue; if (j < N * 0.32) { aoBase += at(i, j, 3); nb++; } else if (j > N * 0.6) { aoTop += at(i, j, 3); nt++; } }
    const sd = (v) => { const m = v.reduce((a, b) => a + b, 0) / v.length; return Math.sqrt(v.reduce((a, b) => a + (b - m) * (b - m), 0) / v.length); };
    const flat = sd(base.slice(Math.floor(base.length * 0.15), Math.ceil(base.length * 0.85))), lumpy = sd(tops);
    const good = flat < 2.5 && lumpy > 6 && nL > 0 && nR > 0 && nT > nB * 0.5 && thC > thE / Math.max(1, cE) && aoBase / nb < aoTop / nt;
    rep.push(`${k}: base ±${flat.toFixed(1)} px, tops ±${lumpy.toFixed(1)} px, thickness middle ${thC.toFixed(2)} / edge ${(thE / Math.max(1, cE)).toFixed(2)}, occlusion base ${(aoBase / nb).toFixed(2)} / top ${(aoTop / nt).toFixed(2)}`);
    if (good) ok++;
  }
  check(A.length === S * S * 4 && ok === 4, `the atlas: four cumulus, each a flat base under heaped lobes, the normals out of the cloud, thick in the middle, darker low down (${rep.join('; ')})`);
  check(S3.atlas() === A, 'the atlas is made once');
  // the frame's uniforms: every name the GLSL declares, filled and finite; off the overworld the layers off; nothing with the switches off
  const glsl = S3.glslSky() + S3.glslPuff();
  const names = S3.U4.concat(S3.U3);
  check(names.every(n => new RegExp('uniform vec[34] ' + n + ';').test(glsl)), `every uniform the frame fills is declared in the GLSL (${names.length})`);
  const env = new VR.Env(); env.setTime(11900); env.wx.setSeed(4242); env.wx.force('klar');
  S3.use({ sky3: 2, cloudVol: true, clouds: 2 });
  let E = env.update(0, { dim: 'overworld', biome: null, eyeSky: 1, renderDist: 8, horizon: 0, freezeTime: true, freezeWeather: true });
  const u = E.sky3.u;
  check(names.every(n => u[n] && Array.from(u[n]).every(Number.isFinite)) && u.u_s3Warm[3] === 1 && u.u_s3Glow[0] > 0.3 && u.u_s3MoonA[3] > 0, 'at the sunset on the overworld: the uniforms filled (the sun-side band on, the aureole, the moons)');
  E = env.update(0, { dim: 'hollow', biome: null, eyeSky: 1, renderDist: 8, horizon: 0, freezeTime: true, freezeWeather: true });
  check(E.sky3.u.u_s3Warm[3] === 0 && E.sky3.u.u_s3Glow[0] === 0 && E.sky3.u.u_s3Belt[3] === 0 && E.sky3.u.u_s3MoonA[3] === 0 && E.sky3.u.u_s3Aur[0] === 0, 'off the overworld the layers, the moons and the aurora are off');
  S3.use({ sky3: 0, cloudVol: false });
  E = env.update(0, { dim: 'overworld', biome: null, eyeSky: 1, renderDist: 8, horizon: 0, freezeTime: true, freezeWeather: true });
  check(E.sky3.level === 0 && E.sky3.moons === null, 'with the switches off the frame does nothing (Very Low)');
}

// ---------------------------------------------------------------- g · the band model against the frames
console.log('g · the band model: golden hour and dusk against the frames');
{
  const M = require('./sky3_model.js'), SR = require('./sky_ref.js');
  const ref = JSON.parse(fs.readFileSync(SR.REF, 'utf8'));
  // run 1's residual (test/sky3.mjs on v0.48, the measured bands less this model's: the space, the bloom, the light in
  // the air), CIELAB per band; at the golden hour t-sky3 shows a seventh of the space it showed (its residual ×0.2)
  const RES = {"canyon_noon": {"H": 225, "yaw": 1.36, "kind": "day", "d": [[0.2, 0.8, 0.3], [0.6, 0.9, 0.9], [2, 0, 1.7], [6.6, -1.6, 1.7], [9.5, -1.7, -2.4], [10.7, -0.7, -5.4], [21.1, -0.2, -12.1], [24.9, 2.8, -16.5]]}, "canyon_golden": {"H": 225, "yaw": 1.36, "kind": "golden", "d": [[0.2, 0.7, 0.3], [0.1, 0.2, 0.6], [0.1, -0.1, 0.2], [-0.3, -1.2, -0.2], [2.9, -1, 0.7], [3.7, -0.2, -0.4], [10.1, -0.6, -5.8], [14.1, 0.5, -7.8]]}, "canyon_dusk": {"H": 226, "yaw": 1.36, "kind": "dusk", "d": [[-0.1, 0.6, 0], [0.2, 0.2, 0.9], [-0.9, -0.2, -0.6], [-0.6, -0.4, -0.7], [2.4, -0.3, 0.8], [3.5, -0.9, 0.1], [5.2, -3, -2.5], [5.5, -2.8, -3.2]]}, "city_noon": {"H": 205, "yaw": -0.35, "kind": "day", "d": [[1.7, 0.8, -0.3], [0.6, 1.1, 0.1], [5.2, 0, 1.9], [12.2, 0.2, 0.6], [16.2, 1.2, -0.7], [17, 2.8, -6.3], [18.8, 3, -7.4], [13.2, 4.5, -8.4]]}, "city_golden": {"H": 205, "yaw": -0.35, "kind": "golden", "d": [[2.2, 1.1, -0.4], [0.8, 1.3, 0.2], [2.4, 0.3, 1.5], [5.7, 0.5, 1.9], [8.1, 1, 1.8], [9.9, 1.6, -1.3], [10.6, 1.2, -1.8], [8.6, 1.5, -2.3]]}, "city_dusk": {"H": 206, "yaw": -0.35, "kind": "dusk", "d": [[1.9, 1.2, -1.5], [0.5, 0.9, 0.1], [0.7, 0.7, 0.8], [0.7, 0.8, 0.8], [1.5, 1.1, 0.3], [2.7, 1.4, 1.4], [3.1, 1.7, 0.8], [3.1, 1.1, 0.5]]}, "isles_noon": {"H": 230, "yaw": 1.36, "kind": "day", "d": [[-0.4, 0.8, 0.5], [0.4, 0.7, 0.4], [0.6, 0.7, 0.2], [6, -1, 1.5], [9.5, -1.8, -2.1], [10.5, -0.5, -5.6], [20.5, -0.3, -11.7], [25.1, 3.2, -16.7]]}, "isles_golden": {"H": 230, "yaw": 1.36, "kind": "golden", "d": [[-0.7, 0.4, 0], [0.3, 0.6, 0.5], [0.4, 0.5, 0.4], [1.4, 0, 0.6], [2.9, -1, 0.6], [3.3, -0.1, -0.4], [9.8, -0.1, -5.9], [13.2, 0.8, -7.7]]}, "isles_dusk": {"H": 231, "yaw": 1.36, "kind": "dusk", "d": [[-0.8, 0.1, 0.4], [0.4, 0.6, 0.5], [0.6, 0.6, 0.5], [1.4, 0.3, 0.7], [2.4, -0.3, 0.7], [3.1, -0.8, -0.1], [6.3, -2.3, -0.8], [7, -2.5, -2.2]]}};
  const azOf = (yaw) => Math.atan2(-Math.cos(yaw), -Math.sin(yaw));
  const HOUR = { noon: 6000, golden: 10800, dusk: 11900 };
  const bandsOf = (view, on) => {
    const R = RES[view], [place, hour] = view.split('_');
    S3.use(on ? { sky3: 2, cloudVol: true, clouds: 2 } : { sky3: 0, cloudVol: false });
    const env = new VR.Env(); env.setTime(HOUR[hour]); env.wx.setSeed(4242); env.wx.force('klar');
    env.planetsOverride = { az: azOf(R.yaw - 30 * Math.PI / 180), el: 24, az2: azOf(R.yaw + 30 * Math.PI / 180), el2: 36 };
    let E; for (let i = 0; i < 3; i++) E = env.update(0.033, { dim: 'overworld', biome: null, eyeSky: 1, renderDist: 8, horizon: 4096, freezeTime: true, freezeWeather: true, drama: true, motion: true });
    const B = E.bodies, bodies = [[E.planetDir, B.radius.giant * 2.6], [E.planet2Dir, B.radius.blue * 1.6], [E.moonDir, 0.06], ...B.moons.map(m => [[m[0], m[1], m[2]], m[3] * 1.8]), ...(E.sky3 && E.sky3.bodies ? E.sky3.bodies.map(m => [[m[0], m[1], m[2]], m[3] * 1.8]) : [])];
    const b = M.bands(E, { yaw: R.yaw, pitch: 12 * Math.PI / 180, H: R.H, kind: R.kind, bodies }, on ? E.sky3.u : null, VR.Light2.grade(E), { stepX: 10, stepY: 3 });
    // (f-sky4: the residual is mostly the space's (the nebula over the top bands) — at the golden hour it scales with the
    // space shown: t-sky3's 0.15 of the day's → ×0.2, f-sky4's refit shows it whole again → ×1)
    const rk = on && hour === 'golden' ? Math.min(1, 0.2 * S3.PAL.gold.space / 0.15) : 1, T = ref.targets[R.kind].bands;
    S3.use({ sky3: 0, cloudVol: false });
    return b.map((x, k) => SR.dE(x.lab.map((v, i) => v + R.d[k][i] * rk), T[k].lab));
  };
  const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length;
  const hours = {};
  for (const view of Object.keys(RES)) {
    const a = bandsOf(view, false), b = bandsOf(view, true), h = view.split('_')[1];
    (hours[h] = hours[h] || { a: [], b: [], worst: 0 }).a.push(mean(a)); hours[h].b.push(mean(b)); hours[h].worst = Math.max(hours[h].worst, ...b);
    console.log(`   ${view.padEnd(14)} ΔE ${a.map(v => v.toFixed(0).padStart(2)).join(' ')} (${mean(a).toFixed(1)})  →  ${b.map(v => v.toFixed(0).padStart(2)).join(' ')} (${mean(b).toFixed(1)})`);
  }
  const H = (h) => ({ a: mean(hours[h].a), b: mean(hours[h].b), w: hours[h].worst });
  const g = H('golden'), d = H('dusk'), n = H('noon');
  // (f-sky4: the golden hour refitted for the structure the band means cannot see — R50-01: t-sky3's fit to the means, 6.8
  // here, was the pink milk. The frames' band 4 is the magenta beside their sun, which a view away from the sun cannot show
  // without pink everywhere; this model (no nebula, the residual a proxy) reads the refit 2–3 ΔE worse than the offline
  // renderer does (test/sky_offline.js: canyon 8.1, city 9.6) — the browser's numbers decide (test/sky_ref.js --runs
  // gates); here the guard against a broken palette: far under v0.48's, the mean under 12.5, every band within 25)
  check(g.b < 12.5 && g.b < g.a * 0.5 && g.w <= 25, `the golden hour: the mean ΔE ${g.a.toFixed(1)} → ${g.b.toFixed(1)} (under 12.5, every band within 25 — the browser's gates decide: worst ${g.w.toFixed(1)})`);
  check(d.b < 6 && d.b < d.a * 0.6 && d.w <= 12, `the dusk: the mean ΔE ${d.a.toFixed(1)} → ${d.b.toFixed(1)} (under 6, every band within 12: worst ${d.w.toFixed(1)})`);
  check(Math.abs(n.b - n.a) < 0.6, `the day as it was: noon's mean ΔE ${n.a.toFixed(1)} → ${n.b.toFixed(1)}`);
}

// ---------------------------------------------------------------- h · f-sky4: the golden hour with structure, the storm
// (docs/reviews/v0.49.md R50-01: the golden hour fitted to the band means turned into pink milk — no space, no disc, the
// grade flat; R50-11: storm clouds bright white slabs). The parts the band means cannot see, checked in the model
console.log('h · f-sky4: the golden hour with structure (R50-01), the storm\'s clouds (R50-11)');
{
  const M = require('./sky3_model.js'), SR = require('./sky_ref.js'), L2 = VR.Light2;
  const envAt = (tod, wx, rain) => {
    S3.use({ sky3: 2, cloudVol: true, clouds: 2 });
    const env = new VR.Env(); env.setTime(tod); env.wx.setSeed(4242); env.wx.force(wx || 'klar');
    if (wx && VR.WX && VR.WX.VIS[wx]) Object.assign(env.wx.v, VR.WX.VIS[wx]);
    let E; for (let i = 0; i < 3; i++) E = env.update(0.033, { dim: 'overworld', biome: null, eyeSky: 1, renderDist: 8, horizon: 4096, freezeTime: true, freezeWeather: true, drama: true, motion: true });
    return E;
  };
  const E = envAt(10800), G = L2.grade(E), U = E.sky3.u;
  // the nebula and the stars over the top at the golden hour (t-sky3 cut them to 15 %; the frames show the nebula and planets)
  const P = S3.palette(E.sunDir[1], VR.Sky);
  check(P.space[2] >= 0.5 * VR.Sky.space[2], `the nebula and the stars at the golden hour: space ${P.space[2].toFixed(2)} of the day's ${VR.Sky.space[2]} (≥ half)`);
  // the sun a white-hot disc in a warm glow (the trailer's t1_07: a white core ~0.6° across, gold, peach, pink within ~5°):
  // the core displays ≥ 250 luma over ≥ 0.4° (SR.SUN_CORE), the glow 3° out a step down (≤ 228), 5° out ≤ 215
  const prof = M.sunProfile(E, U, G, [0, 0.1, 0.2, 0.3, 0.5, 1, 2, 3, 5]), at = (a) => prof.find(p => p.a === a);
  let core = 0; for (const p of prof) if (p.luma >= SR.SUN_CORE) core = Math.max(core, p.a);
  check(core >= 0.2, `the sun's white core: luma ≥ ${SR.SUN_CORE} out to ${core}° from its centre (≥ 0.2°: ≥ 0.4° wide; centre ${at(0).rgb.map(Math.round).join(',')})`);
  // (the glow down to the sky's own light within ~3°: in the canyon's view the sun stands in the bands whose targets are
  // L* 82–91 — the sky round it ~225 luma — so the trailer's 155 at 3° cannot be had with the band means kept)
  check(at(2).luma <= 233 && at(5).luma <= 228 && at(0).luma - at(3).luma >= 20, `the glow falls away from the disc: luma ${prof.map(p => p.a + '° ' + p.luma.toFixed(0)).join(', ')}`);
  // the sky's hue structure (the frames: blue away from the sun, magenta-pink beside it; their band means the violet of the
  // target): at 20° up, 15° of azimuth from the sun magenta-pink or salmon, 100° from it blue-violet, both saturated
  const hueAt = (dAz, el) => {
    const s = E.sunDir, az0 = Math.atan2(s[2], s[0]) + dAz * Math.PI / 180, e = el * Math.PI / 180;
    const dir = [Math.cos(az0) * Math.cos(e), Math.sin(e), Math.sin(az0) * Math.cos(e)];
    const d = M.display(M.skyWithSun(E, dir, U), E, G, [0.5, 0.5], 16 / 9), c = SR.lch(SR.lab(d));
    return { rgb: d.map(Math.round), C: c.C, h: c.h, L: c.L };
  };
  const near = hueAt(15, 20), far = hueAt(100, 20), top = hueAt(60, 45);
  check((near.h >= 315 || near.h <= 30) && near.C >= 22, `beside the sun magenta-pink: 20° up, 15° from it ${near.rgb.join(',')} (h ${near.h.toFixed(0)}°, C* ${near.C.toFixed(0)})`);
  // (bluer than beside it: the frames' blue there is h 280; the band means' violet h 303–316 — the refit sits between)
  check(far.h >= 262 && far.h <= 318 && far.h < near.h - 10 && far.C >= 25, `away from the sun blue-violet, bluer than beside it: 20° up, 100° from it ${far.rgb.join(',')} (h ${far.h.toFixed(0)}°, C* ${far.C.toFixed(0)})`);
  check(top.C >= 28 && top.L <= 62, `the high sky saturated and not milky: 45° up ${top.rgb.join(',')} (L* ${top.L.toFixed(0)}, C* ${top.C.toFixed(0)})`);
  // the grade at the golden hour as v0.48's (t-polish2 took it to 1.04 / 0.26: the land and the sky lost their colour), its
  // shoulder at white (the disc's core and the trailer's whites reach 255)
  const GG = L2.GRADE.gold;
  check(GG.sat >= 1.16 && GG.s >= 0.3 && GG.sh >= 0.995, `the golden grade: saturation ${GG.sat} (≥ 1.16), S ${GG.s} (≥ 0.3), shoulder ${GG.sh} (≥ 0.995)`);
  // the sun-side mist halved (the review: 0.3 veiled the far land toward the sun)
  const air = L2.air(E, 10800);
  check(air.sunK <= 0.155, `the mist toward the sun halved at the golden hour (sunK ${air.sunK.toFixed(3)} ≤ 0.155)`);
  // R50-11 · a storm's clouds have weight: in a thunderstorm the clouds' light (S3.cloudLight) is an overcast grey — the
  // sun's light on them nearly gone, the base ≈ 0.25 of a fair cloud's lit top, the base under 0.55 of the storm cloud's
  // own top — and the puffs carry a gradient and ragged bases (CLOUD3)
  const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const tod = 9500, fair = envAt(tod), storm = envAt(tod, 'gewitter');
  const Cf = S3.cloudLight(fair), Cs = S3.cloudLight(storm);
  const fairTop = lum(Cf.top) + lum(Cf.sun), stTop = lum(Cs.top) + lum(Cs.sun), stBase = lum(Cs.low);
  check(storm.rain > 0.5 && (storm.cloudCover || 0) > 0.6, `the thunderstorm forced (rain ${storm.rain.toFixed(2)}, cover ${(storm.cloudCover || 0).toFixed(2)})`);
  check(stBase / fairTop >= 0.15 && stBase / fairTop <= 0.32, `a storm cloud's base ≈ 0.25 of a fair cloud's lit top (${(stBase / fairTop).toFixed(3)})`);
  check(stBase / stTop <= 0.55, `a storm cloud's base under 0.55 of its own top (${(stBase / stTop).toFixed(3)})`);
  const Us = storm.sky3.u;
  check(!!Us.u_c3Storm && Us.u_c3Storm[0] > 0.6 && envAt(tod).sky3.u.u_c3Storm[0] < 0.05, `the puffs know the storm (u_c3Storm.x ${Us.u_c3Storm ? Us.u_c3Storm[0].toFixed(2) : '—'} in the thunderstorm, ${envAt(tod).sky3.u.u_c3Storm ? envAt(tod).sky3.u.u_c3Storm[0].toFixed(2) : '—'} in clear weather)`);
  const PU = S3.glslPuff();
  check(/u_c3Storm/.test(PU) && /ragged|c3Rag/.test(PU), 'the puff shader darkens a storm cloud from its top to its base and frays its base (CLOUD3)');
  S3.use({ sky3: 0, cloudVol: false });
}

console.log(fails === 0 ? 'ALL OK' : 'FAILED ' + fails);
process.exit(fails ? 1 : 0);
