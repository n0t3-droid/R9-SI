// o-wander2 — the pacing and the staging rules (docs/superpowers/plans/2026-11-01-o-wander2.md, src/main/wander.js):
//  · W.Pacer: nothing of ours within 10 s of any weighted event (clumps deferred); a moment due 15–23 s after the last;
//    a beat fills from 27 s anywhere (on foot, flying) — a 5-minute walk with clumpy outside events and a flight:
//    no start within 8 s of another event, the longest gap ≤ 35 s;
//  · W.share / W.stageRange: the main figure ≥ 6 % of the frame's height, 8–18 m ahead; W.clearLine: a voxel raycast;
//    W.stageCands: inside the view cone; the beats exist, tier 0, short; their keys in both tables.
//   bash test/wt_run.sh wander2.js 300
const V = require('./load_shared.js');
for (const f of ['i18n', 'lang_en', 'lang_de']) require(__dirname + '/../src/main/' + f + '.js');
global.window = global.window || {};
global.performance = global.performance || { now: () => Date.now() };
for (const f of ['lifekit', 'lifedirector', 'wander']) require(__dirname + '/../src/main/' + f + '.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const W = V.Wander;
check(!!(W.PACE && W.Pacer && W.paceSim && W.share && W.stageRange && W.clearLine && W.stageCands && W.BEATS), 'the pacer, the staging rules and the beats exist');

// ---------------------------------------------------------------- the pacing
if (W.Pacer) {
  const P = new W.Pacer(4242);
  P.seen(0, 2);
  check(P.want(5) === null && P.want(9.9) === null, 'nothing within 10 s of a weighted event');
  let due = null; for (let t = 10; t < 40 && !due; t += 0.25) if (P.want(t) === 'moment') due = t;
  check(due !== null && due >= 15 && due <= 23, `a moment due 15–23 s after the last (${due})`);
  check(P.want(27.5, { foot: false }) === 'beat', 'from 27 s a beat fills when no moment can start (flying)');
  check(P.want(27.5, { foot: true, coming: true }) === null && P.want(31.5, { foot: true, coming: true }) === 'beat', 'something coming (a craft closing in): ours waits, only the hard beat at 31 s');
  P.seen(20, 3);
  check(P.want(25) === null, 'an outside event at 20 s defers ours (clump avoided)');
  // the scout: PACE.look before the target
  const Q = new W.Pacer(7); Q.seen(0, 2); let sc = null; for (let t = 10; t < 30 && sc === null; t += 0.25) if (Q.scout(t)) sc = t;
  let dm = null; for (let t = 10; t < 30 && dm === null; t += 0.25) if (Q.want(t) === 'moment') dm = t;
  check(sc !== null && dm !== null && Math.abs(dm - sc - W.PACE.look) < 0.6, `the stage is scouted ${W.PACE.look} s ahead (${sc} → ${dm})`);
}
if (W.paceSim) {
  // the builder's v0.55 5 minutes: outside events in pairs (Funke, the balloon, birds, discoveries), a flight over the Sky
  // Isles from 180 to 245 s (no moment on foot), a forest 60–100 s where half the stages are blocked
  // (Funke's two lines at 12 and 130 s ask no one: fixed; the rest ask the Regie, which keeps them clear of ours)
  const FIXED = [12, 130], ext = [12, 15, 41, 44, 47, 88, 91, 130, 133, 150, 152, 154, 260, 263].map(t => (FIXED.indexOf(t) >= 0 ? t : { t, ask: true }));
  let fixedAfter = 0;
  const foot = (t) => !(t >= 180 && t < 245);
  const stage = (t) => !(t >= 60 && t < 100) || Math.floor(t) % 2 === 0;
  let worstGap = 0, worstSpace = 1e9, starts = 0, beats = 0;
  for (const seed of [1, 4242, -77, 99, 31337]) {
    const R = W.paceSim(seed, 300, ext, { foot, stage });
    starts += R.starts.length; beats += R.starts.filter(s => s.kind === 'beat').length;
    const all = R.all; let gap = all.length ? all[0] : 300;
    for (let i = 1; i < all.length; i++) gap = Math.max(gap, all[i] - all[i - 1]);
    gap = Math.max(gap, 300 - all[all.length - 1]);
    worstGap = Math.max(worstGap, gap);
    for (const s of R.starts) for (const e of all) { if (e === s.t) continue; const fx = FIXED.indexOf(e) >= 0 && e > s.t; if (fx) { if (e - s.t < 8) fixedAfter++; continue; } if (Math.abs(e - s.t) < worstSpace) worstSpace = Math.abs(e - s.t); }
    if (seed === 4242) console.log('    timeline 4242: ' + R.starts.map(s => `${s.t.toFixed(0)}${s.kind === 'beat' ? 'b' : 'm'}`).join(' '));
  }
  check(worstSpace >= 8, `none of ours within 8 s of another event (closest ${worstSpace.toFixed(1)} s)`);
  check(fixedAfter <= 3, `a source that asks no one (Funke) lands < 8 s after one of ours at most three times in five walks (${fixedAfter})`);
  check(worstGap <= 35, `the longest gap ≤ 35 s over five seeds, incl. the flight and the forest (${worstGap.toFixed(1)} s)`);
  check(beats > 0 && starts / 5 >= 8, `the flight is filled with beats (${beats}), ${(starts / 5).toFixed(1)} of ours per 5 minutes`);
}

// ---------------------------------------------------------------- the staging
if (W.share && W.stageRange) {
  const fov = 70 * Math.PI / 180;
  check(Math.abs(W.share(1.8, 10, fov) - 1.8 / (20 * Math.tan(fov / 2))) < 1e-9, 'the share: height ÷ the frame height at that distance');
  const R = W.stageRange(1.8, fov);
  check(R[0] === W.STAGE.near && R[1] <= W.STAGE.far && R[0] >= 8 && W.share(1.8, R[1], fov) >= 0.06, `a grown-up stages ${R[0]}–${R[1].toFixed(1)} m (share at the far end ${(W.share(1.8, R[1], fov) * 100).toFixed(1)} %, staged for ${W.STAGE.share * 100} %)`);
  let bad = []; for (const n of W.NAMES) { const K = W.KINDS[n], r = W.stageRange(K.fig * (K.fam === 'animal' ? W.STAGE.animal : 1), fov); if (!(K.fig > 0) || W.share(K.fig * (K.fam === 'animal' ? W.STAGE.animal : 1), r[1], fov) < 0.06 - 1e-9 || r[1] > 18 || r[0] < 8) bad.push(n); }
  check(!bad.length, `every moment has a main figure and stages at a distance where it reads ≥ 6 % (${bad.join(',') || 'all'})`);
  const C = W.stageCands(R);
  check(C.length >= 8 && C.every(([d, a]) => d >= 8 && d <= 18 && Math.abs(a) <= W.STAGE.cone), `the stage's candidates inside 8–18 m and the cone ± ${W.STAGE.cone} rad (${C.length})`);
}
if (W.clearLine) {
  const wall = new Set(['5,1,0', '5,2,0']);
  const solid = (x, y, z) => wall.has(`${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`);
  check(W.clearLine(solid, [0, 1.6, 0.5], [10, 1.6, 0.5]) === false, 'the raycast: a wall between eye and figure blocks');
  check(W.clearLine(solid, [0, 1.6, 2.5], [10, 1.6, 2.5]) === true, 'the raycast: a free line is clear');
  check(W.clearLine((x, y, z) => Math.floor(x) === 10 && Math.floor(y) === 0, [0, 1.6, 0.5], [10.5, 1.0, 0.5]) === true, 'the raycast: the ground the figure stands on does not block');
}
if (W.BEATS) {
  const B = Object.keys(W.BEATS);
  check(B.length >= 5 && B.every(n => W.BEATS[n].tier === 0 && W.BEATS[n].dur <= 14), `≥ 5 ambient beats, tier 0, short (${B.join(', ')})`);
  check(B.some(n => W.BEATS[n].fly) && B.some(n => !W.BEATS[n].fly), 'beats on foot and beats in flight');
  check(B.every(n => W.BEATS[n].fig > 0 && W.BEATS[n].hours.length), 'each beat has a figure and its hours (beats are silent on screen: no toast, no line)');
}

console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);
