// f-first4 (docs/superpowers/plans/2026-10-31-f-first4.md): the pure parts.
//  1 · the murmuration's step rate: W.MURM_FAR is the near/far distance of the steps (a number, 120 blocks) — f-first3's
//      pale-with-distance band lives in its own name (W.MURM_PALE), so a far flock steps at 12 Hz with every fourth boid
//      steering again (the name clash made `d > [60, 240]` always false: every flock stepped as a near one)
//  2 · the flock off the spawn's view line: in a new world's first minutes the murmuration's stage stands ≥ 60° off a vista
//      start's view (W.stageAside: turned about the spawn, its distance kept); a stage already aside stays
//  3 · the spawn picture: a vista start steps one block further back on the way when that cell is paving with air for
//      the body (First2.stepBack) — the walk's first wall cells smaller in the frame's lower corners
//  4 · the landmark first: a horizon tile near a vista start's landmark (the arrival's aim) is asked for and uploaded before
//      the coarse ring and the nearer tiles (Horizon.prio) — under a starved machine the far landmark is the first far thing
// usage: bash test/wt_run.sh first4.js 300
require('./dom_stub.js');
const V = require('./load_shared.js');
globalThis.VR = V;
global.performance = global.performance || require('perf_hooks').performance;
for (const f of ['i18n', 'lang_en', 'lang_de', 'settings_reg', 'first', 'funke', 'first2', 'wildsim']) require(__dirname + '/../src/main/' + f + '.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const W = V.Wild, F2 = V.First2, FI = V.First;

console.log('1 · the far flock steps as a far one');
check(W && typeof W.MURM_FAR === 'number' && W.MURM_FAR > 0, 'W.MURM_FAR is the step-rate distance (a number): ' + JSON.stringify(W && W.MURM_FAR));
check(W && Array.isArray(W.MURM_PALE) && W.murmFar(30) === 1 && W.murmFar(600) <= 0.25, 'the pale-with-distance band in W.MURM_PALE, murmFar unchanged: ' + JSON.stringify(W && W.MURM_PALE));
check(W && 250 > W.MURM_FAR, 'a flock at 250 m counts as far (12 Hz, every fourth boid steers)');

console.log('2 · the flock off the spawn\'s view line');
check(W && typeof W.stageAside === 'function', 'VR.Wild.stageAside');
if (W && W.stageAside) {
  const sp = [100, 70, -40], ang = (yaw, st) => { const fx = -Math.sin(yaw), fz = -Math.cos(yaw), dx = st.x - sp[0], dz = st.z - sp[2], l = Math.hypot(dx, dz); return Math.acos(Math.max(-1, Math.min(1, (dx * fx + dz * fz) / l))) * 180 / Math.PI; };
  for (const yaw of [0, 1.2, -2.9, 3.1]) for (const off of [0, 12, -30, 59, 61, 140, -170]) for (const dist of [80, 280]) {
    const a = yaw - off * Math.PI / 180, st0 = { x: sp[0] - Math.sin(a) * dist, y: 110, z: sp[2] - Math.cos(a) * dist, lake: false };
    const st = W.stageAside(Object.assign({}, st0), sp, yaw, 60), A = ang(yaw, st), d = Math.hypot(st.x - sp[0], st.z - sp[2]);
    const same = Math.abs(off) >= 60 ? (st.x === st0.x && st.z === st0.z) : true;
    check(A >= 60 - 1e-6 && Math.abs(d - dist) < 1e-6 && st.y === 110 && same, `yaw ${yaw} off ${off}° at ${dist} m → ${A.toFixed(1)}° off the view, ${d.toFixed(1)} m${Math.abs(off) >= 60 ? ' (kept)' : ''}`);
  }
  // the side it goes to: the nearer one
  const yaw = 0.5, s1 = W.stageAside({ x: sp[0] - Math.sin(yaw - 0.1) * 200, y: 1, z: sp[2] - Math.cos(yaw - 0.1) * 200 }, sp, yaw, 60), r = [Math.cos(yaw), -Math.sin(yaw)];
  check((s1.x - sp[0]) * r[0] + (s1.z - sp[2]) * r[1] > 0, 'a stage a little right of the view goes right');
}

console.log('3 · the spawn picture: one block further back on the way');
check(F2 && typeof F2.stepBack === 'function', 'VR.First2.stepBack');
if (F2 && F2.stepBack) {
  // a way along -z (u = [0, 1] points into the walk), the feet at (10.5, 71, 20.5); the way's paving at y 70
  const PAVE = 1, GRASS = 2, cells = new Map(), key = (x, y, z) => x + ',' + y + ',' + z;
  const get = (x, y, z) => cells.get(key(x, y, z)) || 0;
  const pave = (z) => cells.set(key(10, 70, z), PAVE);
  const isPave = (b) => b === PAVE, solid = (b) => b === PAVE || b === GRASS;
  const feet = [10.5, 71, 20.5], u = [0, 1];
  pave(20); pave(19);
  let r = F2.stepBack(feet, u, get, isPave, solid);
  check(r && Math.abs(r[0] - 10.5) < 1e-9 && r[1] === 71 && Math.abs(r[2] - 19.5) < 1e-9, 'paving behind, air for the body → one block back: ' + JSON.stringify(r));
  cells.set(key(10, 71, 19), GRASS);
  check(F2.stepBack(feet, u, get, isPave, solid) === null, 'a block where the body would stand → stays');
  cells.delete(key(10, 71, 19)); cells.set(key(10, 70, 19), GRASS);
  check(F2.stepBack(feet, u, get, isPave, solid) === null, 'grass, not the way, behind → stays');
  check(F2.STEP_BACK === 1, 'the step: 1 block (FI.WALK_T −1 → −2 where the way allows): ' + F2.STEP_BACK);
}

console.log('4 · the landmark\'s horizon tiles first');
try { require(__dirname + '/../src/main/horizon.js'); } catch (e) { console.log('  (horizon.js: ' + e.message + ')'); }
const HZ = V.Horizon;
check(HZ && typeof HZ.prio === 'function' && typeof HZ.focusD === 'function', 'VR.Horizon.prio and focusD');
if (HZ && HZ.prio) {
  const S = (L) => 32 * (4 << L), F = [-420, 380];
  // without a focus: the old order (coarse and near first, relative to the tile's size)
  check(HZ.prio(300, 1, Infinity) === 300 / S(1) - 0.6 && HZ.prio(0, 4, Infinity) === -2.4, 'no focus: d / S − 0.6 L, as before');
  // the landmark's tile at 300 m (level 1, 256 wide, holding the aim) and its siblings before the coarse ring and a near tile
  const fd = HZ.focusD(F, 1, Math.floor(-420 / S(1)), Math.floor(380 / S(1))), fs = HZ.focusD(F, 1, Math.floor(-420 / S(1)) + 1, Math.floor(380 / S(1)));
  check(fd === 0 && fs < S(1), 'the tile holding the aim is 0 from it, its sibling within one tile (' + fs.toFixed(0) + ')');
  const lm = HZ.prio(300, 1, fd), sib = HZ.prio(330, 1, fs), coarse = HZ.prio(0, 4, HZ.focusD(F, 4, 5, 5)), near0 = HZ.prio(40, 0, HZ.focusD(F, 0, -3, 0));
  check(lm < coarse && lm < near0 && sib < coarse && sib < near0, `the landmark's tile ${lm.toFixed(2)} and its sibling ${sib.toFixed(2)} before the coarse ring ${coarse.toFixed(2)} and a near tile ${near0.toFixed(2)}`);
  check(HZ.focusD(null, 1, 0, 0) === Infinity, 'no landmark → no focus');
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
