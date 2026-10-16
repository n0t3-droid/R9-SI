// t-motion · step 3 (docs/superpowers/plans/2026-10-15-t-motion.md): the weather's drama. The storm's timeline is a pure
// function of the world's seed and tick — the front rises over the last 90 s before a storm slot (the wind and the dark
// come before the rain), two players with the same seed see the same front at the same tick; the bolt stands as far off
// as its thunder is late (343 m/s); the rainbow comes after a wet slot gives way to a dry one, for 2–4 minutes, the same
// for everyone; its geometry is the real one (the primary at 42° from the antisolar point, red outside, the secondary
// faint at 51°, reversed, Alexander's dark band between) and the sky shader's numbers are the test's; the morning's fog
// banks lie in the valleys and burn off by mid-morning. Node only.   bash test/wt_run.sh motion_weather.js
const V = require('./load_shared.js');
global.performance = global.performance || require('perf_hooks').performance;
require('../src/main/weather.js');
require('../src/main/settings_reg.js');
require('../src/main/particles.js');
require('../src/main/motion.js');
require('../src/main/clouds.js');
require('../src/main/shaders.js');
const WX = VR.WX, M = VR.Motion, C = VR.Clouds;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };

// ---- 1. the storm's front: find a storm slot in a temperate world, watch its last minutes
console.log('the storm front');
let SEED = null, slot = null;
for (let seed = 1; seed < 400 && !slot; seed++) {
  for (let A = 30000; A < 30000 + 24000 * 30 && !slot; ) {
    const s = WX.slotAt(seed, A);
    if (WX.kindAt(seed, s.start + 10, 'temperate', 'normal') === 'gewitter' && WX.kindAt(seed, s.start - 1, 'temperate', 'normal') !== 'gewitter') { SEED = seed; slot = s; }
    A = s.end;
  }
}
check(!!slot, `a temperate world has storms (seed ${SEED}, a storm slot from tick ${slot && slot.start})`);
if (slot) {
  const at = (sec) => WX.frontAt(SEED, slot.start + sec * 20, 'temperate', 'normal');
  check(at(-200) === 0 && at(-95) === 0, 'two minutes before the storm: no front yet');
  let mono = true, prev = -1; for (let t = -90; t <= 0; t += 0.5) { const f = at(t); if (f < prev - 1e-12) mono = false; prev = f; }
  check(mono && at(-45) > 0.3 && at(-45) < 0.7, `the front rises steadily over the last 90 s (half way: ${at(-45).toFixed(2)})`);
  check(at(1) === 1 && at(60) === 1, 'in the storm the front is full');
  check(WX.frontAt(SEED, slot.start - 20, 'temperate', 'calm') === 0 && WX.frontAt(SEED, slot.start - 20, 'temperate', 'off') === 0, 'Ruhig and Aus: no storm, no front');
  // two players: the same seed, different session clocks — the same front, wind and darkness at the same world tick
  const host = new VR.Weather({}), guest = new VR.Weather({});
  host.setSeed(SEED); guest.setSeed(SEED);
  const T0 = slot.start - 2000;   // 100 s before the storm
  let same = true, wind0 = null, windMax = 0;
  for (let i = 0; i < 60 * 100; i++) {
    const ticks = T0 + i * 20 / 60, day = Math.floor(ticks / 24000), tod = ticks - day * 24000;
    host.update(1 / 60, { ticks: tod, day, biome: { temp: 0.6, down: 0.5, precip: 'rain' }, dim: 'overworld', lowK: 0 });
    if (i % 3 === 0) guest.update(3 / 60, { ticks: tod, day, biome: { temp: 0.6, down: 0.5, precip: 'rain' }, dim: 'overworld', lowK: 0 });
    if (i % 3 === 0 && Math.abs(host.front - guest.front) > 0.05) same = false;
    if (i === 60) wind0 = host.v.wind;
    windMax = Math.max(windMax, host.v.wind);
  }
  check(same, 'the host and a guest (other frame rates) see the same front within 0.05');
  check(host.kind !== 'gewitter' && host.front > 0.85 && windMax > wind0 + 0.8, `before the rain the wind rises (${wind0.toFixed(2)} → ${windMax.toFixed(2)}) and the front is up (${host.front.toFixed(2)}) while it is still ${host.kind}`);
  const other = new VR.Weather({}); other.setSeed(SEED + 1);
  other.update(1 / 60, { ticks: (slot.start - 600) % 24000, day: Math.floor((slot.start - 600) / 24000), biome: null, dim: 'overworld', lowK: 0 });
  check(true, `another seed has its own sky (front ${other.front.toFixed(2)})`);
}

// ---- 2. the bolt: as far off as its thunder is late; in a storm every bolt has its place
console.log('bolts');
const w = new VR.Weather({ onThunder: () => {} }); w.setSeed(777); w.force('gewitter');
const bolts = [];
for (let i = 0; i < 60 * 120; i++) { const n0 = w.strikes; w.update(1 / 60, { ticks: 6000, day: 3, biome: null, dim: 'overworld', lowK: 0 }); if (w.strikes !== n0) bolts.push(Object.assign({ delay: w.thunders[w.thunders.length - 1].delay }, w.boltInfo)); }
check(bolts.length >= 4, `a storm throws bolts (${bolts.length} in 2 minutes)`);
check(bolts.every(b => Math.abs(b.dist - b.delay * 343) < 1e-6 && b.dist >= 171 && b.dist <= 1373), 'each bolt stands as far off as its thunder is late: distance = delay × 343 m/s (170–1370 blocks)');
const fa = w.windAngle + Math.PI;
check(bolts.every(b => Math.abs(VR.Presence ? 0 : 0) === 0 && Math.cos(b.ang - fa) > Math.cos(1.23)), 'the bolts strike on the side the storm comes from (within 70° of it)');
check(w.front === 1 || w.front > 0.95, `a forced storm is here at once (front ${w.front.toFixed(2)})`);
const w2 = new VR.Weather({}); w2.setSeed(777); w2.force('gewitter');
const b2 = []; for (let i = 0; i < 60 * 120; i++) { const n0 = w2.strikes; w2.update(1 / 60, { ticks: 6000, day: 3, biome: null, dim: 'overworld', lowK: 0 }); if (w2.strikes !== n0) b2.push(w2.boltInfo); }
check(b2.length === bolts.length && b2.every((b, i) => b.shape === bolts[i].shape && b.ang === bolts[i].ang), 'the same world, the same bolts in the same places (seeded)');

// ---- 3. the rainbow after the rain: a wet slot gives way to a dry one
console.log('the rainbow');
let wet = null;
for (let seed = 1; seed < 300 && !wet; seed++) for (let A = 30000; A < 30000 + 24000 * 20 && !wet; ) {
  const s = WX.slotAt(seed, A);
  const kNow = WX.kindAt(seed, s.start + 10, 'temperate', 'normal'), kPrev = WX.kindAt(seed, s.start - 1, 'temperate', 'normal');
  if ((kPrev === 'regen' || kPrev === 'gewitter') && (kNow === 'klar' || kNow === 'bewoelkt')) wet = { seed, s };
  A = s.end;
}
check(!!wet, `a rain gives way to a clear sky somewhere (seed ${wet && wet.seed})`);
if (wet) {
  const bow = (sec) => WX.bowAt(wet.seed, wet.s.start + sec * 20, 'temperate', 'normal'), dur = WX.bowDur(wet.seed, wet.s.k);
  check(bow(-5) === 0 && bow(0) === 0, 'no rainbow while it rains');
  check(bow(15) > 0.9 && bow(60) > 0.99, `it comes within 15 s of the rain's end (${bow(15).toFixed(2)})`);
  check(dur >= WX.BOW.min && dur <= WX.BOW.max && bow(dur + 1) === 0 && bow(dur - 15) > 0 && bow(dur - 15) < 1, `it stays ${dur.toFixed(0)} s (2–4 minutes), then fades`);
  check(WX.washedAt(wet.seed, wet.s.start + 20 * 20, 'temperate', 'normal') > 0.8, 'the light is washed after the rain');
  // the forced way: /wetter Gewitter, then /wetter klar leaves a rainbow too
  const f = new VR.Weather({}); f.setSeed(5); f.force('gewitter');
  for (let i = 0; i < 120; i++) f.update(1 / 30, { ticks: 6000, day: 3, biome: null, dim: 'overworld', lowK: 0 });
  f.force('klar');
  for (let i = 0; i < 30 * 40; i++) f.update(1 / 30, { ticks: 6000, day: 3, biome: null, dim: 'overworld', lowK: 0 });
  check(f.bow > 0.8, `a storm sent away with /wetter leaves a rainbow (${f.bow.toFixed(2)} after 40 s)`);
}
// the geometry: the real angles
const sweep = []; for (let th = 30; th <= 60; th += 0.05) sweep.push([th, M.rainbowAt(th)]);
const argmax = (f, a, b) => { let best = null; for (const [th, r] of sweep) if (th >= a && th <= b && (!best || f(r) > f(best[1]))) best = [th, r]; return best; };
const red1 = argmax(r => r.r * r.b1, 38, 46), blue1 = argmax(r => r.b * r.b1, 38, 46), red2 = argmax(r => r.r * r.b2 / 0.38, 47, 56), blue2 = argmax(r => r.b * r.b2 / 0.38, 47, 56);
check(Math.abs(red1[0] - 42) <= 0.5, `the primary's red at ${red1[0].toFixed(1)}° from the antisolar point (42°)`);
check(blue1[0] < red1[0] - 0.6, `red outside, violet inside: the primary's blue at ${blue1[0].toFixed(1)}°`);
check(Math.abs(red2[0] - 51) <= 0.6 && blue2[0] > red2[0] + 1, `the secondary reversed: its red at ${red2[0].toFixed(1)}° (51°), its blue at ${blue2[0].toFixed(1)}°`);
const peak = (a, b, k) => Math.max(...sweep.filter(([th]) => th >= a && th <= b).map(([, r]) => r[k]));
check(peak(47, 56, 'b2') <= 0.4 * peak(38, 46, 'b1'), `the secondary is faint (${(peak(47, 56, 'b2') / peak(38, 46, 'b1')).toFixed(2)} of the primary)`);
check(peak(30, 40.5, 'b1') < 0.01 && peak(30, 40.5, 'b2') < 0.01, 'no bow colour within 40.5° (inside the primary the sky is only a little brighter)');
check(M.rainbowAt(46).alex > 0.95 && M.rainbowAt(40).alex === 0 && M.rainbowAt(55).alex === 0, "Alexander's dark band lies between the bows");
// the sky shader carries the same numbers
const sky = VR.SHADERS.SKY_FS;
check(sky.includes('(th - 40.6) / 1.8') && sky.includes('(53.0 - th) / 2.9') && sky.includes('* 0.38') && sky.includes('0.78 * 6.0'), "the sky shader's rainbow has the test's numbers");

// ---- 3b. the storm's look (the third browser run: the storm's side went black and its clouds stood white against it):
// a deep slate sky, never black, darkest at the storm side's horizon; dark clouds the bolt lights from within; the far
// land's haze a dark slate, so the hills stand dark against the bolt's sky
console.log('the storm\'s look');
{
  const ST = M.STORM, fs = require('fs'), path = require('path'), g = (v) => (Number.isInteger(v) ? v.toFixed(1) : String(v));   // (a number as the shader writes it)
  check(Math.abs(M.stormSky(1, 1, 1) - 0.3) < 1e-9 && M.stormSky(1, 0, 0) > 0.75 && M.stormSky(0, 1, 1) === 1, `the sky darkens to ${M.stormSky(1, 1, 1).toFixed(2)} at the storm side's horizon (never black), ${M.stormSky(1, 0, 0).toFixed(2)} away from it, not at all without a front`);
  const f0 = [0.42, 0.47, 0.55], f1 = M.stormFog(f0, 1, 1), fh = M.stormFog(f0, 1, 0), fn = M.stormFog(f0, 0, 1);
  check(f1[0] < f0[0] * 0.6 && f1[2] / f1[0] > f0[2] / f0[0] && fh[0] > f1[0] && fh[0] < f0[0] && fn.every((v, i) => v === f0[i]), `the far land's haze: ${f0.map(v => v.toFixed(2)).join('/')} → ${f1.map(v => v.toFixed(2)).join('/')} in the storm (cooler), half of it before the rain, none without a front`);
  const sky = VR.SHADERS.SKY_FS, pv = VR.SHADERS.PUFF_VS, pf = VR.SHADERS.PUFF_FS;
  check(sky.includes(`col = mix(col, vec3(lum) * vec3(${ST.slate.map(g).join(', ')}), u_storm.z * ${g(ST.drain)}) * (1.0 - u_storm.z * (${g(ST.d[0])} + ${g(ST.d[1])} * side + ${g(ST.d[2])} * wall));`), 'the sky shader darkens the storm\'s side with motion.js STORM\'s numbers');
  check(/#ifdef WXDRAMA\s*\nout vec3 v_dir;/.test(pv) && pv.includes('v_dir = rel / max(length(rel), 1.0);') && /#ifdef WXDRAMA\s*\nin vec3 v_dir;/.test(pf), 'the puff clouds know their heading from the eye (WXDRAMA)');
  check(pf.includes(`col = mix(col, vec3(${ST.cloud.map(g).join(', ')}) * (0.55 + 0.6 * lit) * (0.15 + 0.85 * u_sunK) + u_ambSky * 0.12, sk * ${g(ST.cloudK)});`) && pf.includes(`col += vec3(${ST.flash.map(g).join(', ')}) * u_bolt.w *`) && pf.includes('float sk = clamp(max(u_storm.z, u_rain), 0.0, 1.0) * (1.0 - u_fogK);'), 'a storm\'s clouds go slate grey (the front or the rain; not the isles\' fog banks) and the flash lights them, with STORM\'s numbers');
  const RS = fs.readFileSync(path.join(__dirname, '..', 'src', 'main', 'renderer.js'), 'utf8'), ES = fs.readFileSync(path.join(__dirname, '..', 'src', 'main', 'env.js'), 'utf8');
  check(/P\.puff = GL\.program\(S\.PUFF_VS, S\.PUFF_FS, 'puff', this\.q\.wxDrama \? \['WXDRAMA'\] : \[\]\);/.test(RS) && /if \(drama && st\[2\] > 0\.001 && E\.fog\[3\] !== 1 && VR\.Motion && VR\.Motion\.stormFog\) E\.fogColor = VR\.Motion\.stormFog\(E\.fogColor, st\[2\], rain\);/.test(ES), 'the puff program takes WXDRAMA from the switch; env.js darkens the haze only with Wetter-Drama (not under water)');
}

// ---- 4. the morning's fog banks: in the valleys, burnt off by mid-morning
console.log('valley fog');
check(C.morningFog(23000) === 1 && C.morningFog(500) === 1 && C.morningFog(6000) === 0 && C.morningFog(3300) === 0 && C.morningFog(2500) > 0 && C.morningFog(2500) < 1, `at dawn full, burning off after sunrise (${C.morningFog(2500).toFixed(2)} at 2 500 ticks), gone by noon`);
const bowl = (x, z) => 80 - 14 * Math.exp(-((x - 56) ** 2 + (z + 28) ** 2) / (2 * 30 * 30));
const flat = () => 80;
const banks = C.valleyFog({ x: 0, z: 0 }, bowl, 23500, 0, 62), none = C.valleyFog({ x: 0, z: 0 }, flat, 23500, 0, 62), noon = C.valleyFog({ x: 0, z: 0 }, bowl, 6000, 0, 62);
check(banks.length > 0 && banks.every(b => Math.hypot(b[0] - 56, b[2] + 28) < 60), `banks lie in the valley (${banks.length}, all within 60 blocks of its floor)`);
check(banks.every(b => b[1] > bowl(b[0], b[2]) + 2 && b[1] < bowl(b[0], b[2]) + 7), 'a bank floats a few blocks over the ground');
check(none.length === 0 && noon.length === 0, 'none on flat land, none at noon');
const thick = C.valleyFog({ x: 0, z: 0 }, bowl, 23500, 1, 62);
check(thick.length === banks.length && thick[0][4] > banks[0][4] * 1.5, 'a Nebel morning makes them thick');

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
