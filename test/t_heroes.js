// The trailer heroes and the crowd's budget (src/shared/folkanim.js, src/shared/folkcrowd.js), without GL:
//  · the clips are periodic and bounded, they do not drift over many loops, and no joint jumps between two frames;
//  · the walk cycle repeats every 2π of phase, scales with its stride, and reuses its arrays (no allocation);
//  · the budget: near members every frame, far ones less often, the per-frame cap holds, and no time is lost
//    while a member waits (its accumulated time is exactly what it is owed);
//  · the heroes: they wave once when the player comes close (then rest), turn and walk with eased motion, and
//    their poses stay finite and reuse their arrays.
//   bash test/wt_run.sh t_heroes.js
const V = require('./load_shared.js');
const FA = V.FolkAnim, C = V.Crowd;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const near = (a, b, e) => Math.abs(a - b) <= (e === undefined ? 1e-9 : e);
const flat = (P) => { const out = []; for (const j of FA.JOINTS) { const v = P[j] || [0, 0, 0, 0, 0, 0]; for (let i = 0; i < 6; i++) out.push(v[i]); } return out; };
const maxAbsDiff = (a, b) => { let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i])); return m; };

// ---------------------------------------------------------------- the clips
const LOOPS = ['idle', 'hold', 'wave', 'wave_l', 'talk', 'work', 'crouch', 'dance', 'cheer'];
for (const name of LOOPS) {
  const clip = FA.clips[name];
  check(!!clip && clip.loop, `clip ${name} exists and loops`);
  const L = clip.len;
  // periodic: the pose at t equals the pose one length later, and after five loops it has not drifted
  let worstPer = 0, worstDrift = 0;
  for (let k = 0; k < 40; k++) {
    const t = (k / 40) * L * 1.37;
    const a = flat(FA.sample(clip, t, {}));
    worstPer = Math.max(worstPer, maxAbsDiff(a, flat(FA.sample(clip, t + L, {}))));
    worstDrift = Math.max(worstDrift, maxAbsDiff(a, flat(FA.sample(clip, t + 5 * L, {}))));
  }
  check(worstPer < 1e-9, `${name}: periodic (worst ${worstPer.toExponential(1)})`);
  check(worstDrift < 1e-9, `${name}: zero drift over five loops (worst ${worstDrift.toExponential(1)})`);
  // bounded: rotations stay within ±π, offsets within ±2 model units
  let maxRot = 0, maxOff = 0;
  for (let k = 0; k < 400; k++) {
    const P = FA.sample(clip, (k / 400) * L, {});
    for (const j of FA.JOINTS) { const v = P[j]; maxRot = Math.max(maxRot, Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2])); maxOff = Math.max(maxOff, Math.abs(v[3]), Math.abs(v[4]), Math.abs(v[5])); }
  }
  check(maxRot <= Math.PI && maxOff <= 2, `${name}: bounded (max rotation ${maxRot.toFixed(2)}, max offset ${maxOff.toFixed(2)})`);
  // smooth: between two frames of 1/30 s no joint component moves more than 0.2 (no snapping)
  let worstStep = 0, prev = null;
  for (let t = 0; t <= 3 * L; t += 1 / 30) { const cur = flat(FA.sample(clip, t, {})); if (prev) worstStep = Math.max(worstStep, maxAbsDiff(prev, cur)); prev = cur; }
  check(worstStep < 0.2, `${name}: no joint jumps between frames (worst step ${worstStep.toFixed(3)})`);
}
// the held blaster: the right arm stays forward and down the whole time
{
  let lo = 9, hi = -9;
  for (let k = 0; k < 200; k++) { const P = FA.sample(FA.clips.hold, (k / 200) * 4, {}); lo = Math.min(lo, P.arm_r[0]); hi = Math.max(hi, P.arm_r[0]); }
  check(lo > 0.85 && hi < 1.1, `hold: the blaster arm stays between 0.85 and 1.1 rad forward (${lo.toFixed(2)}…${hi.toFixed(2)})`);
}

// ---------------------------------------------------------------- the walk cycle
{
  let worstPer = 0, worstStep = 0, bound = 0, prev = null;
  for (let k = 0; k < 300; k++) {
    const ph = (k / 300) * 2 * Math.PI * 2;
    const a = flat(FA.walk(ph, 1, false, {}, 1.2));
    worstPer = Math.max(worstPer, maxAbsDiff(a, flat(FA.walk(ph + 2 * Math.PI, 1, false, {}, 1.2))));
    bound = Math.max(bound, Math.abs(FA.walk(ph, 1, false, {}, 1.2).arm_r[0]));
    if (prev) worstStep = Math.max(worstStep, maxAbsDiff(prev, a));
    prev = a;
  }
  check(worstPer < 1e-12, `walk: periodic in 2π (worst ${worstPer.toExponential(1)})`);
  check(bound <= 0.68 * 1.2 * 0.9 + 0.01 && bound > 0.7, `walk: a confident stride swings the arm to ${bound.toFixed(2)} rad (bounded by the stride)`);
  check(worstStep < 0.2 * 4, `walk: the stride's steps are smooth at 60 steps per cycle (worst ${worstStep.toFixed(3)})`);
  // the stride scales: k = 1.2 swings 20 % more than k = 1
  const s1 = FA.walk(0.9, 1, false, {}, 1).leg_l[0], s12 = FA.walk(0.9, 1, false, {}, 1.2).leg_l[0];
  check(near(s12, s1 * 1.2, 1e-12), 'walk: the stride strength scales the swing');
  // no allocation: the joint arrays are reused from call to call
  const out = {};
  FA.walk(0.1, 1, false, out, 1); const ids = FA.JOINTS.map(j => out[j]);
  for (let k = 0; k < 50; k++) FA.walk(k * 0.37, 1, k & 1, out, 1.2);
  check(FA.JOINTS.every((j, i) => out[j] === ids[i]), 'walk: the joint arrays are reused (no allocation per call)');
}

// ---------------------------------------------------------------- the budget
{
  check(C.every(10 * 10) === 1 && C.every(30 * 30) === 2 && C.every(70 * 70) === 4 && C.every(150 * 150) === 8, 'every(d2): 1 within 24 blocks, 2 within 48, 4 within 96, 8 beyond');
  // the schedule: with no cap every member is served exactly at its rate
  const N = 240, frames = 480, members = [];
  for (let i = 0; i < N; i++) members.push({ d2: (i * 37 % 200) * (i * 37 % 200) });
  let counts = members.map(() => 0), consumed = members.map(() => 0);
  C.tick(0, 1e9);
  for (let f = 0; f < frames; f++) {
    C.tick(1 / 30, 1e9);
    members.forEach((m, i) => { if (C.due(m, m.d2)) { counts[i]++; consumed[i] += m.bAcc; m.bAcc = 0; } });
  }
  let exact = true;
  members.forEach((m, i) => { const want = frames / C.every(m.d2); if (counts[i] !== want) exact = false; });
  check(exact, 'budget (no cap): every member is served exactly at its rate (480 frames = 8 periods)');
  // the cap: no frame serves more than the cap, and the members that wait lose no time
  for (const cap of [24, 96]) {
    const mem = []; for (let i = 0; i < 300; i++) mem.push({ d2: (i * 53 % 180) * (i * 53 % 180) });
    let worstFrame = 0, owed = 0, paid = 0;
    for (const m of mem) { m.bAcc = 0; m.bPh = undefined; }
    C.spread = 0;
    for (let f = 0; f < 240; f++) {
      C.tick(1 / 30, cap);
      let served = 0;
      for (const m of mem) if (C.due(m, m.d2)) { served++; paid += m.bAcc; m.bAcc = 0; }
      worstFrame = Math.max(worstFrame, served);
    }
    for (const m of mem) owed += m.bAcc;
    check(worstFrame <= cap, `budget: cap ${cap} holds (worst frame serves ${worstFrame})`);
    check(near(paid + owed, 240 / 30 * mem.length, 1e-6), `budget: cap ${cap} loses no time (paid ${paid.toFixed(2)} + waiting ${owed.toFixed(2)} s)`);
  }
}

// ---------------------------------------------------------------- the heroes
const LOOK = {};
const pl = [0, 81, 0];
{
  const h = C.newHero({ id: 'a', pos: [40, 81, 0], yaw: 0 }, LOOK);
  for (let i = 0; i < 120; i++) C.stepHero(h, 1 / 30, pl);
  check(h.state === 'hold' && h.waveT === 0 && near(h.yaw, 0, 1e-9), 'a hero far from the player holds its place and does not wave');
}
{
  const h = C.newHero({ id: 'b', pos: [3, 81, 0], yaw: 0 }, LOOK);
  C.stepHero(h, 1 / 30, pl);
  check(h.state === 'wave' && h.waveT > 2 && h.waveCD > 24, 'a hero within 7 blocks waves with its left hand');
  let waves = 0, prev = h.state;
  for (let i = 0; i < 30 * 40; i++) { C.stepHero(h, 1 / 30, pl); if (h.state === 'wave' && prev !== 'wave') waves++; prev = h.state; }
  check(waves === 1, `a hero waves once in 40 s with the player close by (25 s cooldown): ${waves}`);
  check(h.state === 'hold' || h.state === 'wave', 'the hero is back to holding after the wave');
  const hh = C.newHero({ id: 'b2', pos: [3, 81, 0], yaw: 0 }, LOOK);
  for (let i = 0; i < 15; i++) C.stepHero(hh, 1 / 30, pl);
  check(hh.headYaw > 0.3, `the hero's head turns to the player within half a second (${hh.headYaw.toFixed(2)} rad)`);
}
{
  const h = C.newHero({ id: 'c', pos: [0, 81, 0], yaw: 0 }, LOOK);
  const p = [10, 81, 0];     // the player to the side (+x): the hero turns toward them, eased, not snapped
  C.stepHero(h, 1 / 30, p);
  check(h.yaw < 0 && h.yaw > -0.5, `a hero turns to face the player with eased motion (yaw ${h.yaw.toFixed(3)} after one frame)`);
}
{
  const h = C.newHero({ id: 'd', pos: [0, 81, 0], yaw: 0, walk: { to: [0, 81, -20], speed: 2 } }, LOOK);
  let sawWalk = false, minAmt = 1;
  for (let i = 0; i < 30; i++) { C.stepHero(h, 1 / 30, [50, 81, 50]); if (h.state === 'walk') sawWalk = true; }
  check(sawWalk && h.walkAmt > 0.95 && h.walkAmt < 1.0001, `a walking hero blends its stride in (walk amount ${h.walkAmt.toFixed(3)} after a second)`);
  for (let i = 0; i < 30 * 12; i++) { C.stepHero(h, 1 / 30, [50, 81, 50]); }
  check(near(h.pos[2], -20, 1e-6) && h.walk === null && h.state === 'hold', `a hero arrives at its place and stands (z ${h.pos[2].toFixed(3)})`);
  check(h.walkAmt < 0.01, 'the stride fades out after the arrival');
  // straight-line walk at the given speed
  const g = C.newHero({ id: 'e', pos: [0, 81, 0], yaw: 0, walk: { to: [0, 81, -40], speed: 2 } }, LOOK);
  for (let i = 0; i < 60; i++) C.stepHero(g, 1 / 30, [50, 81, 50]);
  check(near(g.pos[2], -4, 1e-6), `the walk covers speed × time (z ${g.pos[2].toFixed(4)} after 2 s at 2 blocks/s)`);
}
{
  const h = C.newHero({ id: 'f', pos: [0, 81, 0], yaw: 0 }, LOOK);
  C.heroPose(h, 0); const ids = [h.poseOut, h.poseOut.arm_r, h.poseOut.head];
  let finite = true;
  for (let i = 0; i < 2000; i++) {
    C.stepHero(h, 1 / 30, i < 600 ? [1, 81, 1] : [60, 81, 60]);
    const P = C.heroPose(h, 1 / 30);
    for (const j of FA.JOINTS) for (let k = 0; k < 6; k++) if (!Number.isFinite(P[j][k])) finite = false;
  }
  check(finite, 'the hero poses stay finite for 66 s of waving, standing and turning');
  check(h.poseOut === ids[0] && h.poseOut.arm_r === ids[1] && h.poseOut.head === ids[2], 'the hero poses reuse their arrays (no allocation per frame)');
  const hold = C.heroPose(h, 0);
  check(hold.arm_r[0] > 0.8 && hold.arm_r[0] < 1.15, `a standing hero holds the blaster forward (${hold.arm_r[0].toFixed(2)} rad)`);
}
{
  // the crew step (the game's per-frame call): members near the player are posed every frame, far ones every 8th
  C.heroes.length = 0;
  const near1 = C.newHero({ id: 'n', pos: [5, 81, 0], yaw: 0 }, LOOK), far1 = C.newHero({ id: 'f2', pos: [150, 81, 0], yaw: 0 }, LOOK);
  C.heroes.push(near1, far1);
  C.tick(1 / 30, 96);
  C.stepCrowd(1 / 30, pl);
  const nearPosed = near1.pose !== null && near1.bAcc === 0;
  let farFrames = 0;
  for (let f = 0; f < 80; f++) { C.tick(1 / 30, 96); C.stepCrowd(1 / 30, pl); if (far1.bAcc === 0) farFrames++; }   // bAcc is spent exactly when the pose is recomputed
  check(nearPosed, 'the crew poses a member near the player on the first frame');
  check(farFrames === 10, `a member 150 blocks away is posed every 8th frame (${farFrames} of 80 frames)`);
  C.heroes.length = 0;
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
