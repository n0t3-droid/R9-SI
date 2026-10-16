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

console.log(fails === 0 ? 'ALL OK' : 'FAILED ' + fails);
process.exit(fails ? 1 : 0);
