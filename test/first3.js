// f-first3 (docs/superpowers/plans/2026-10-31-f-first3.md; the v0.54 review's R55-03, -04, -12, -13): the pure parts.
//  1 · Funke (R55-04): in first person his place keeps ≥ 2.5 m from the eye and out of the view's centre third, never
//      between the eye and the aim point; at that distance his screen box ≤ 2 % of the frame
//  2 · the murmuration (R55-03): none in a new world's first minute, in over the next 30 s; from afar thinner (depth ×
//      murmFar ≤ 0.25 beyond 240 m) and an impostor's depth capped — no black blot over the horizon
//  3 · the hand (R55-13): the held block 30 % darker, the kit's slot 5 a calm block (not a neon)
//  4 · the spawn (R55-12): a vista start's feet on the open way 1 m before the walk's mouth, facing the view
require('./dom_stub.js');
const V = require('./load_shared.js');
globalThis.VR = V;
global.performance = global.performance || require('perf_hooks').performance;
for (const f of ['i18n', 'lang_en', 'lang_de', 'settings_reg', 'first', 'funke', 'first2', 'wildsim']) require(__dirname + '/../src/main/' + f + '.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const FK = V.Funke, W = V.Wild, F2 = V.First2, FI = V.First;

// ---------------------------------------------------------------- 1 · Funke
console.log('1 · Funke out of the face');
check(FK && typeof FK.keepClear === 'function' && typeof FK.screenShare === 'function', 'VR.Funke.keepClear and screenShare');
if (FK && FK.keepClear) {
  const eye = [10, 70, 10], view = (yaw, A) => { const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw), dx = A[0] - eye[0], dz = A[2] - eye[2]; return { d: Math.hypot(dx, A[1] - eye[1], dz), ah: dx * fx + dz * fz, ac: dx * rx + dz * rz }; };
  const place = (yaw, ah, ac, up) => { const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw); return [eye[0] + fx * ah + rx * ac, eye[1] + up, eye[2] + fz * ah + rz * ac]; };
  const cases = [['the shoulder (0.78 right, 0.3 behind)', -0.3, 0.78, -0.2], ['peeking while it talks (1.55 ahead, 0.58 right)', 1.55, 0.58, -0.14],
    ['dead ahead at 1 m (between the eye and the aim)', 1, 0, 0], ['ahead at 4 m, 0.3 left', 4, -0.3, 0], ['over the head', -0.2, 0, 0.7], ['in the eye', 0, 0, 0]];
  for (const yaw of [0, 1.1, -2.6]) for (const [name, ah, ac, up] of cases) {
    const A = FK.keepClear(eye, yaw, place(yaw, ah, ac, up), 1), v = view(yaw, A), inThird = v.ah > 0 && Math.abs(v.ac) / v.ah < 0.415;
    check(v.d >= 2.5 - 1e-6 && !inThird && A.every(Number.isFinite), `yaw ${yaw}: ${name} → ${v.d.toFixed(2)} m, across/ahead ${v.ah > 0 ? (Math.abs(v.ac) / v.ah).toFixed(2) : 'behind'}`);
  }
  // a place already clear stays where it is
  const far = place(0.4, 3, 2.5, 0), kept = FK.keepClear(eye, 0.4, far.slice(), 1);
  check(Math.hypot(kept[0] - far[0], kept[1] - far[1], kept[2] - far[2]) < 1e-9, 'a place 3.9 m away beside the view stays');
  const share = FK.screenShare(2.5, 0.64, 75, 16 / 9);
  check(share <= 0.02, `his 64 cm (the rotors' span) at 2.5 m: ${(share * 100).toFixed(2)} % of the frame (≤ 2 %; at 0.86 m it was ${(FK.screenShare(0.86, 0.64, 75, 16 / 9) * 100).toFixed(1)} %)`);
}

// ---------------------------------------------------------------- 2 · the murmuration
console.log('2 · the murmuration reads as birds');
check(W && typeof W.murmFar === 'function' && typeof W.murmStart === 'function', 'VR.Wild.murmFar and murmStart');
if (W && W.murmFar) {
  check(W.murmStart(0, true) === 0 && W.murmStart(59, true) === 0 && W.murmStart(75, true) > 0 && W.murmStart(75, true) < 1 && W.murmStart(95, true) === 1, `a new world: none in the first minute, in over 30 s (${W.murmStart(75, true).toFixed(2)} at 75 s)`);
  check(W.murmStart(0, false) === 1, 'a world opened again: the flock as it is');
  check(W.murmFar(30) === 1 && W.murmFar(60) === 1 && W.murmFar(150) < 0.7 && W.murmFar(240) <= 0.25 && W.murmFar(600) <= 0.25, `from afar thinner: 1 · ${W.murmFar(150).toFixed(2)} · ${W.murmFar(240).toFixed(2)} at 60 · 150 · 240 m`);
  let mono = true; for (let d = 0; d < 400; d += 5) if (W.murmFar(d + 5) > W.murmFar(d) + 1e-12) mono = false;
  check(mono, 'murmFar never grows with the distance');
  // the darkest a far impostor can be: its depth capped, × the grain's 1.6 at most
  const aMax = 1 - Math.exp(-W.MURM_TAU_MAX * W.murmFar(260) * W.PUFF.grain[2]);
  check(W.MURM_TAU_MAX <= 1.6 && aMax < 0.45, `a far impostor covers the sky behind it by ${(aMax * 100).toFixed(0)} % at most (< 45 %; before: up to ${(100 * (1 - Math.exp(-W.puffTau(30, 1, 2, W.MURM_K, W.CAPS.murm[2]) * W.PUFF.grain[2]))).toFixed(0)} %)`);
}

// ---------------------------------------------------------------- 3 · the hand
console.log('3 · the hand');
check(F2 && Math.abs(F2.HAND_DIM - 0.7) < 1e-9, 'the held block 30 % darker (First2.HAND_DIM 0.7)');
const k5 = F2 && F2.KIT5, d5 = k5 && V.R.byName[k5];
check(!!d5 && !/neon|magenta|crystal|glow/.test(k5), 'the kit\'s slot 5: ' + k5 + ' (a block, no neon)');
{
  const src = require('fs').readFileSync(__dirname + '/../src/main/entities.js', 'utf8');
  check(/First2\.HAND_DIM/.test(src), 'entities.drawHand reads First2.HAND_DIM');
}

// ---------------------------------------------------------------- 4 · the spawn
console.log('4 · the spawn on the walk\'s mouth');
check(FI && FI.WALK_T === -1, 'the feet on the open way, 1 m before the walk\'s mouth (FI.WALK_T ' + (FI && FI.WALK_T) + ')');

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
