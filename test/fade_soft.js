// f-stipple · R50-08: no screen-door anywhere. The fade-in of arriving columns and far forms dithered with a fixed 4x4
// Bayer pattern — trees as gridded ghosts, translucent green walls. Now (src/shared/stream.js, world.js, farring.js,
// the terrain and far shaders):
//   (a) where the upscaler (TSR) runs and „Sanftes Einblenden" is on, the dither's threshold turns with the frame
//       (fadeT = fract(ign + phase): interleaved gradient noise, phase = the frame's golden-ratio step): over the frames every pixel is drawn in
//       the fade's share of them — the TSR's history resolves it into a soft blend, no fixed pattern stays
//   (b) a column arriving within two chunks of the player never fades: it is whole at once and grows up from the
//       ground in 150 ms (the origins' w carries 2 + growth; the vertex shader scales it about the feet)
//   (c) without the TSR, or with the switch off (Very Low's default), things pop: whole at once, no dither at all
//   (d) world.js and farring.js follow the plan (their own methods, a fake world); the far mask holds the same values
//   (e) the shaders: Very Low's text untouched (the soft path behind SOFTFADE), the soft path in every fade discard
//   (f) the switch: settings_reg's fadeIn (on from Low, off on Very Low), its words in both languages
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const V = require('./load_shared.js');
global.window = global.window || {}; global.performance = global.performance || { now: () => Date.now() };
const VR = global.VR || V, S = VR.Stream;
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };

console.log('(a) the turning threshold');
check(typeof S.fadeT === 'function' && typeof S.fadePhase === 'function', 'Stream.fadeT and Stream.fadePhase exist');
if (typeof S.fadeT === 'function') {
  check(S.fadeT(1, 2, 0) === S.ign(1, 2), 'phase 0 is the plain interleaved-gradient threshold');
  // no 2-px period: a fade of ½ drawn by it is no checkerboard (test/stipple.js on a synthetic frame)
  { const St = require('./stipple.js'), W = 320, H = 180, L = new Float32Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) L[y * W + x] = S.fadeT(x, y, S.fadePhase(3)) < 0.5 ? 200 : 40;
    const sh = St.measureRaw(L, W, H); check(sh < 0.01, 'one frame of it at fade ½ is no screen-door (the detector)', (sh * 100).toFixed(1) + ' %');
    const B = new Float32Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) B[y * W + x] = S.bayer4(x, y) < 0.5 ? 200 : 40;
    check(St.measureRaw(B, W, H) > 0.9, '… where the Bayer dither was one (' + (St.measureRaw(B, W, H) * 100).toFixed(0) + ' %)'); }
  let worst = 0;
  for (const f of [0.1, 0.25, 0.5, 0.75, 0.9]) for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    let k = 0; const N = 64;
    for (let i = 0; i < N; i++) if (S.fadeT(x, y, S.fadePhase(i)) < f) k++;
    worst = Math.max(worst, Math.abs(k / N - f));
  }
  check(worst <= 0.05, 'over 64 frames every pixel is drawn in the fade\'s share of them (no fixed pattern)', 'worst ' + worst.toFixed(3));
  // within any 8 frames (the TSR's reach) the share is near the fade too
  let w8 = 0;
  for (const f of [0.25, 0.5, 0.75]) for (let s0 = 0; s0 < 16; s0++) for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) {
    let k = 0; for (let i = 0; i < 8; i++) if (S.fadeT(x, y, S.fadePhase(s0 + i)) < f) k++;
    w8 = Math.max(w8, Math.abs(k / 8 - f));
  }
  check(w8 <= 0.25, '… and within any 8 frames', 'worst ' + w8.toFixed(3));
}

console.log('(b)(c) the plan of an arriving column');
check(typeof S.fadePlan === 'function' && S.NEAR_COLS === 2 && S.GROW_MS === 150, 'Stream.fadePlan, NEAR_COLS 2, GROW_MS 150');
if (typeof S.fadePlan === 'function') {
  const near = S.fadePlan(2, -1, true), far = S.fadePlan(3, 0, true), pop = S.fadePlan(5, 5, false), nearPop = S.fadePlan(1, 1, false);
  check(near.fade === 1 && near.grow === true, '(b) within two chunks: whole at once, growing', JSON.stringify(near));
  check(far.fade === 0 && far.grow === false, '(a) beyond: the soft fade from 0', JSON.stringify(far));
  check(pop.fade === 1 && !pop.grow, '(c) without the soft fade: whole at once', JSON.stringify(pop));
  check(nearPop.fade === 1 && nearPop.grow === true, '(b) near grows with the switch off too (no dither in it)', JSON.stringify(nearPop));
  check(S.growCurve(0) === 0 && S.growCurve(150) === 1 && S.growCurve(75) > 0.3 && S.growCurve(75) < 0.7, 'growCurve: 0 → 1 over 150 ms');
  check(S.originW(1, 0.5) === 2.5 && S.originW(0.4, 1) === 0.4 && S.originW(1, 1) === 1, 'originW: 2 + growth while growing, else the fade');
}

console.log('(d) world.js and farring.js');
{
  for (const f of ['world', 'farring']) { try { require(path.join(ROOT, 'src/main', f + '.js')); } catch (e) { check(false, f + '.js loads', e.message); } }
  const Wp = VR.World && VR.World.prototype;
  if (Wp && typeof S.fadePlan === 'function') {
    const mk = (cx, cz) => ({ cx, cz, shownAt: -1, fade: 0, sec: [{ meshed: true }, { meshed: true }] });
    const w = { fading: new Set(), lastPos: [8, 70, 8, 0], renderer: { fadeSoft: true } };
    const cN = mk(1, -2), cF = mk(6, 0);
    Wp.checkShown.call(w, cN, 1000); Wp.checkShown.call(w, cF, 1000);
    check(cN.fade === 1 && cN.sec[0].fade === 1 && cN.sec[1].grow === 0, 'a near column: whole, growth 0', JSON.stringify({ f: cN.fade, g: cN.sec[1].grow }));
    check(cF.fade === 0 && cF.sec[0].fade === 0 && cF.sec[0].grow === 1, 'a far column: the soft fade from 0', JSON.stringify({ f: cF.fade, g: cF.sec[0].grow }));
    Wp.stepFades.call(w, 1075);
    check(cN.sec[0].grow > 0.3 && cN.sec[0].grow < 0.7 && cN.fade === 1, 'half way: growing (75 ms)', cN.sec[0].grow);
    Wp.stepFades.call(w, 1400);
    check(cN.sec[0].grow === 1 && cF.fade === 1 && !w.fading.size, 'done: both whole, nothing fading');
    const w2 = { fading: new Set(), lastPos: [8, 70, 8, 0], renderer: { fadeSoft: false } }, cP = mk(6, 0);
    Wp.checkShown.call(w2, cP, 1000);
    check(cP.fade === 1 && cP.sec[0].grow === 1 && !w2.fading.size, 'no soft fade (no TSR / Very Low): a far column pops in whole');
  } else check(false, 'VR.World with checkShown/stepFades');
  const Fp = VR.FarRing && VR.FarRing.prototype;
  if (Fp && /fadeSoft/.test(String(Fp.ready || '') + String(Fp.onReady || '') + fs.readFileSync(path.join(ROOT, 'src/main/farring.js'), 'utf8'))) check(true, 'farring.js: a form pops in whole without the soft fade');
  else check(false, 'farring.js: a form pops in whole without the soft fade');
}

console.log('(e) the shaders');
{
  const sh = fs.readFileSync(path.join(ROOT, 'src/main/shaders.js'), 'utf8'), rd = fs.readFileSync(path.join(ROOT, 'src/main/renderer.js'), 'utf8');
  const plain = (sh.match(/bayer4\(gl_FragCoord\.xy\)/g) || []).length, soft = (sh.match(/fadeT\(gl_FragCoord\.xy\)/g) || []).length;
  check(plain >= 4 && soft === plain, 'every fade/cut threshold has its soft twin behind SOFTFADE', plain + ' plain, ' + soft + ' soft');
  check(/#ifdef SOFTFADE[\s\S]{0,500}uniform float u_fadePhase;[\s\S]{0,200}float fadeT\(vec2 a\)/.test(sh), 'COMMON: u_fadePhase and fadeT only under SOFTFADE');
  check(/SOFTFADE[\s\S]{0,300}v_fade > 1\.5[\s\S]{0,200}rel\.y/.test(sh), 'TERRAIN_VS: the growth about the feet under SOFTFADE');
  check(/const sf = this\.q\.lite \? \[\] : \['SOFTFADE'\]/.test(rd), 'renderer: SOFTFADE never on the lite look (Very Low)');
  check(/this\.fadePhase = /.test(rd) && /u_fadePhase/.test(rd) && /this\.fadeSoft = /.test(rd), 'renderer: the phase turns with the TSR, fadeSoft for the world');
}

console.log('(f) the switch');
{
  const reg = fs.readFileSync(path.join(ROOT, 'src/main/settings_reg.js'), 'utf8'), game = fs.readFileSync(path.join(ROOT, 'src/main/game.js'), 'utf8');
  check(/key: 'fadeIn'/.test(reg), "settings_reg: fadeIn");
  const pot = /potato: \{[^}]*\}/.exec(game), low = /low: \{[^}]*\}/.exec(game);
  check(pot && /fadeIn: false/.test(pot[0]) && low && /fadeIn: true/.test(low[0]), 'off on Very Low, on from Low');
  const de = fs.readFileSync(path.join(ROOT, 'src/main/lang_de.js'), 'utf8'), en = fs.readFileSync(path.join(ROOT, 'src/main/lang_en.js'), 'utf8');
  check(/'g\.set\.fadeIn': 'Sanftes Einblenden'/.test(de) && /'g\.set\.fadeIn':/.test(en) && /'g\.set\.fadeIn\.tip':/.test(de) && /'g\.set\.fadeIn\.tip':/.test(en), 'its words: „Sanftes Einblenden", both languages');
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
