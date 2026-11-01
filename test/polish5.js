// f-polish5 (docs/superpowers/plans/2026-11-01-f-polish5.md): the placement and staging rules of the newest wonders' polish.
//  1 · Märchenorte (fairy.js): a place keeps 40 m off villages, outposts and machines (F.clearOf); the Schwebegarten's
//      bridge side chosen so the garden is seen against open land (F.gardenYaw); its soft flowers (F.blooms) on the
//      lawn, off the tree and the fountain; the halos' strength by darkness (F.haloA)
//  2 · Wanderregisseur (wander.js): the far cue (W.cue) — nothing close by, a soft glow from ~16 m, stronger at night,
//      gone past the moment's range; a spot's front turned toward the walker (W.stageYaw); the balloon's calm pulse
//  3 · Einzug (movein.js): the way in from the nearest village (MI.approach: 40–60 m toward it), its waypoints
//      (MI.wayPoints: ≤ 10 m apart, ending at the doorstep); the gentle framing (MI.frameK: in, hold, out; a skip eases
//      out from where it stands); the festival's lantern strings between the doorsteps (MI.festLights) and the fire ring
//   bash test/wt_run.sh polish5.js 300
const V = require('./load_shared.js');
for (const f of ['i18n', 'lang_en', 'lang_de']) require(__dirname + '/../src/main/' + f + '.js');
global.window = global.window || {};
global.performance = global.performance || { now: () => Date.now() };
for (const f of ['fairy', 'lifekit', 'lifedirector', 'wander', 'movein']) require(__dirname + '/../src/main/' + f + '.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const F = V.Fairy, W = V.Wander, MI = V.MoveIn;
const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-6);
const wrap = (a) => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };

// ---------------------------------------------------------------- 1 · fairy
check(typeof F.clearOf === 'function' && F.AVOID === 40, 'F.clearOf exists, the margin 40 m');
if (F.clearOf) {
  const avoid = [{ x: 0, z: 0, r: 50 }, { x: 300, z: 0, r: 6 }];
  check(!F.clearOf(80, 0, avoid), 'a spot 80 m from a village of radius 50 is too near (50 + 40)');
  check(F.clearOf(95, 0, avoid), 'a spot 95 m from it is clear');
  check(!F.clearOf(270, 0, avoid), 'a machine 30 m off is too near (6 + 40)');
  check(F.clearOf(120, 200, avoid) && F.clearOf(5, 5, []), 'far from all · nothing to avoid: clear');
}
check(typeof F.gardenYaw === 'function', 'F.gardenYaw exists');
if (F.gardenYaw) {
  // a hill rising toward +x: the bridge (the viewer's side) on the high side, the garden seen against the low land (−x)
  const hill = (x, z) => 70 + Math.max(0, x) * 0.4;
  const a = F.gardenYaw((x, z) => hill(x, z), 0, 0, 70 + 24);
  check(Math.cos(a) > 0.7, 'on a slope the bridge stands on the high side, the view looks out over the low land (yaw ' + a.toFixed(2) + ')');
  // …unless the high side rises over the garden's top (the viewer would look down on it): then the next best
  const cliff = (x, z) => (x > 20 ? 130 : 70);
  const b = F.gardenYaw(cliff, 0, 0, 94);
  check(Math.cos(b) < 0.9, 'never from a cliff higher than the garden (yaw ' + b.toFixed(2) + ')');
  const flat = F.gardenYaw(() => 70, 0, 0, 94, 1.3);
  check(near(flat, 1.3, 1e-9), 'flat land keeps the planned yaw');
}
check(typeof F.blooms === 'function', 'F.blooms exists');
if (F.blooms) {
  const site = { id: 'overworld:garden', x: 10, z: 20, yaw: 0.5 }, B = F.blooms(4242, site), B2 = F.blooms(4242, site);
  check(B.length >= 12 && B.length <= 20, B.length + ' flower clumps on the lawn');
  check(JSON.stringify(B) === JSON.stringify(B2), 'deterministic');
  check(B.every(q => Math.hypot(q.x - site.x, q.z - site.z) <= 6.6), 'all on the lawn (≤ 6.6 m from the middle)');
  check(B.every(q => q.v >= 0 && q.v < 3), 'three kinds');
  // the model's tree (local 23.5, 22.5) and fountain (12, 13) at 0.5 m a voxel round the pivot (17, 17), turned by yaw
  const loc = (q) => { const dx = q.x - site.x, dz = q.z - site.z, c = Math.cos(site.yaw), s = Math.sin(site.yaw); return [dx * c - dz * s, dx * s + dz * c]; };
  void loc;
  check(B.every((q, i) => B.every((o, j) => i === j || Math.hypot(o.x - q.x, o.z - q.z) >= 0.9)), 'apart (≥ 0.9 m)');
}
check(typeof F.haloA === 'function' && F.haloA(0) < F.haloA(1) && F.haloA(1) <= 1 && F.haloA(0) > 0, 'the halos: faint by day, full at night');

// ---------------------------------------------------------------- 2 · wander
check(typeof W.cue === 'function', 'W.cue exists');
if (W.cue) {
  check(W.cue(8, 0) === 0 && W.cue(14, 1) === 0, 'no cue close by (you see the moment itself)');
  check(W.cue(35, 0) > 0.2 && W.cue(35, 1) > W.cue(35, 0), 'a soft glow from afar, stronger at night');
  check(W.cue(24, 0) < W.cue(35, 0) + 1e-9, 'it grows with the distance');
  check(W.cue(200, 1) === 0, 'gone past the moment\'s range');
  check(W.cue(35, 1) <= 0.75, 'calm: never bright (≤ 0.75)');
}
check(typeof W.stageYaw === 'function', 'W.stageYaw exists');
if (W.stageYaw) {
  for (const [r, f] of [[0, 2], [3, -1], [-2.5, 0.4]]) { const y = W.stageYaw(r, f); check(Math.abs(wrap(y - f)) <= 0.36, `a spot's front within 20° of the walker (rnd ${r}, face ${f} → ${y.toFixed(2)})`); }
  check(W.stageYaw(1, 1.1) !== W.stageYaw(-2, 1.1), 'still its own small turn');
}
check(typeof W.balloonPulse === 'function' && (() => { let lo = 9, hi = 0; for (let t = 0; t < 20; t += 0.05) { const v = W.balloonPulse(t); lo = Math.min(lo, v); hi = Math.max(hi, v); } return hi - lo < 0.3 && lo > 0.5; })(), 'the Wegballon\'s glow breathes slowly and gently (± < 0.15)');

// ---------------------------------------------------------------- 3 · movein
check(typeof MI.approach === 'function', 'MI.approach exists');
if (MI.approach) {
  const door = [100, 70, 100], out = [0, 1];
  const c = MI.approach(door, out, [{ x: 100, z: -100 }, { x: 600, z: 600 }]);
  const d0 = Math.hypot(c[0][0] - door[0], c[0][1] - door[2]);
  check(c.length >= 8 && d0 >= 40 && d0 <= 60, c.length + ' candidates, the first ' + d0.toFixed(0) + ' m out');
  check((c[0][1] - door[2]) / d0 < -0.9, 'the first toward the nearest village (north)');
  check(c.every(p => { const d = Math.hypot(p[0] - door[0], p[1] - door[2]); return d >= 38 && d <= 62; }), 'all 40–60 m out');
  const c2 = MI.approach(door, out, []);
  check((c2[0][1] - door[2]) / Math.hypot(c2[0][0] - door[0], c2[0][1] - door[2]) > 0.9, 'no village: out from the door');
  const c3 = MI.approach(door, out, [{ x: 100, z: -2000 }]);
  check((c3[0][1] - door[2]) > 0, 'a village too far (> 900 m): out from the door');
}
check(typeof MI.wayPoints === 'function', 'MI.wayPoints exists');
if (MI.wayPoints) {
  const P = MI.wayPoints([0, 0], [47, 0]);
  check(P.length >= 5 && near(P[P.length - 1][0], 47) && near(P[P.length - 1][1], 0), P.length + ' waypoints, the last the doorstep');
  let ok = true, prev = [0, 0]; for (const q of P) { if (Math.hypot(q[0] - prev[0], q[1] - prev[1]) > 10.01) ok = false; prev = q; }
  check(ok, '≤ 10 m apart');
}
check(typeof MI.frameK === 'function', 'MI.frameK exists');
if (MI.frameK) {
  check(MI.frameK(0) === 0 && MI.frameK(MI.FRAME.dur) === 0 && near(MI.frameK(MI.FRAME.dur / 2), 1), 'the framing: 0 → 1 → 0');
  check(MI.FRAME.dur >= 3.5 && MI.FRAME.dur <= 6 && MI.FRAME.rise >= 1.2, 'short (' + MI.FRAME.dur + ' s) and gentle (' + MI.FRAME.rise + ' s in)');
  let jolt = 0; for (let t = 0; t < MI.FRAME.dur; t += 0.02) jolt = Math.max(jolt, Math.abs(MI.frameK(t + 0.02) - MI.frameK(t)));
  check(jolt < 0.04, 'no jolt (largest step per 20 ms ' + jolt.toFixed(3) + ')');
  const t = MI.FRAME.rise * 0.5, k = MI.frameK(t), t2 = MI.frameSkip(t);
  check(near(MI.frameK(t2), k, 1e-6) && t2 > t, 'a skip eases out from where it stands (' + k.toFixed(2) + ')');
  check(typeof MI.framePose === 'function', 'MI.framePose exists');
  if (MI.framePose) {
    const o = MI.framePose([10, 70, 0], [0, 70, 0], {});
    const dl = Math.hypot(o.x - 5, o.z - 0);
    check(dl > 6 && dl < 16 && o.y > 71 && o.y < 78, 'the camera beside the way, a little up (' + [o.x, o.y, o.z].map(v => v.toFixed(1)).join(', ') + ')');
    const lx = -Math.sin(o.yaw), lz = -Math.cos(o.yaw), tx = 7 - o.x, tz = 0 - o.z, tl = Math.hypot(tx, tz);
    check((lx * tx + lz * tz) / tl > 0.95 && o.pitch < 0, 'it looks at the family between the doorstep and them, a little down');
  }
}
check(typeof MI.festLights === 'function', 'MI.festLights exists');
if (MI.festLights) {
  const doors = [[0, 70, 0], [15, 70, 2], [-15, 70, 3]], pz = { x: 0, y: 70, z: 1.7 };
  const L = MI.festLights(doors, pz);
  check(L.strings.length === 3, 'three strings between three doorsteps (a ring): ' + L.strings.length);
  check(L.lamps.length >= 12 && L.lamps.length <= 40, L.lamps.length + ' lanterns');
  check(L.lamps.every(q => q[1] > 71.5 && q[1] < 74), 'hung over the heads (1.5–4 m), sagging between the doors');
  const mid = L.lamps.filter(q => q[3] === 0); const ends = mid.length ? [mid[0][1], mid[Math.floor(mid.length / 2)][1]] : [0, 0];
  check(ends[1] < ends[0], 'the string sags in the middle');
  check(L.fire && near(L.fire[0], pz.x, 0.01) && near(L.fire[2], pz.z, 0.01), 'the fire ring on the plaza');
  check(MI.festLights([[0, 70, 0]], { x: 0, y: 70, z: 0 }).strings.length === 0, 'one home: no string');
  const far = MI.festLights([[0, 70, 0], [80, 70, 0]], { x: 40, y: 70, z: 0 });
  check(far.strings.length === 0, 'no string longer than 32 m');
  const two = MI.festLights([[0, 70, 0], [12, 70, 0]], { x: 6, y: 70, z: 0 });
  check(two.strings.length === 1, 'two homes: one string');
}
// keys
const de = V.I18N && V.I18N.tables ? V.I18N.tables.de : null;
void de;
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
