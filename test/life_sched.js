// regress: skip  (WIP: the pad schedule lands with t-life; the test runs green on that branch when finished)
// Ships that stay (docs/superpowers/plans/2026-10-09-t-life.md §3.1), the pure schedules on their own:
//  · the Gate Temple's apron (padlife.js): over ten simulated minutes (four windows, three worlds) a craft stands on the
//    pad ≥ 85 % of the time, the pad is never empty for more than 20 s, never two craft on it (and never two hulls within
//    a hull's length of each other), they come and go at the horizon (≥ 650 blocks from the pad, faded out: no warp-out
//    within 300 blocks of a player near the pad), every move is smooth;
//  · the crew (real designs from the worker's generator: a shuttle with its ramp, a dropship and a freighter with a side
//    hatch): two or three out in the middle of the stay, all aboard before the ramp closes, never standing inside the hull,
//    the drone always clear of it;
//  · the hall (hangarflight.js): two craft share the pad, each parked 45–90 s, the other one holding over the canyon,
//    never both in the hangar mouth;
//  · the sky (traffic.js): flights from horizon to horizon keep a craft within 550 blocks of a plaza ≥ 95 % of the time,
//    no flash within 300 blocks.
//   bash test/wt_run.sh life_sched.js 600
const V = require('./load_shared.js');
global.window = global.window || {};
global.document = global.document || { getElementById: () => null, createElement: () => ({ style: {}, getContext: () => null }) };
global.performance = global.performance || { now: () => Date.now() };
const fs = require('fs');
for (const f of ['peace', 'lifekit', 'padlife', 'traffic', 'hangarflight']) { const p = __dirname + '/../src/main/' + f + '.js'; if (fs.existsSync(p)) require(p); }
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const PL = V.PadLife;
check(!!PL && !!PL.pose && !!PL.crew, 'the pad schedule exists (VR.PadLife)');
if (!PL) { console.log('FAILED ' + fails); process.exit(1); }

// ---------------------------------------------------------------- the apron: occupancy, gaps, one craft at a time
const apron = { x: 0.5, y: 81, z: 38, yaw: Math.PI, out: [0, 1] };
const ON = { slide: 1, settle: 1, parked: 1, lift: 1 };
let worstOcc = 1, worstGap = 0, maxOn = 0, minSep = 1e9, maxStep = 0, edgeBad = 0, edges = 0;
for (const seed of [12345, -778899, 0x5eed]) for (const t0 of [0, 5000, 123456.7, 1.2e6]) {
  const cache = { seed, n: 0, T: PL.t0(seed) }, outs = [{}, {}, {}];
  let occ = 0, n = 0, gap = 0, prev = new Map();
  for (let t = t0; t < t0 + 600; t += 0.1) {
    const list = PL.active(apron, seed, t, cache, outs);
    let on = 0, parked = false;
    for (const q of list) { if (ON[q.phase]) on++; if (q.phase === 'parked') parked = true; }
    maxOn = Math.max(maxOn, on);
    if (parked) { occ++; gap = 0; } else { gap += 0.1; worstGap = Math.max(worstGap, gap); }
    n++;
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) { const a = list[i].pos, b = list[j].pos; minSep = Math.min(minSep, Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])); }
    const now = new Map();
    for (const q of list) { const p = prev.get(q.m); if (p) maxStep = Math.max(maxStep, Math.hypot(q.pos[0] - p[0], q.pos[1] - p[1], q.pos[2] - p[2])); now.set(q.m, q.pos.slice()); }
    prev = now;
  }
  worstOcc = Math.min(worstOcc, occ / n);
  // the ends of every visit in the window: at the horizon, faded out
  const c2 = PL.visitAt(seed, t0, null);
  for (let m = c2.n; m < c2.n + 6; m++) {
    let T = c2.T; for (let k = c2.n; k < m; k++) T += PL.stay(seed, k) + PL.GAP;
    const W = PL.times(seed, m, T);
    for (const [t, ph] of [[W.A0 + 0.05, 'approach'], [W.D1 - 0.05, 'depart']]) {
      const q = PL.pose(apron, seed, m, T, t, {}); edges++;
      const d = Math.hypot(q.pos[0] - apron.x, q.pos[2] - apron.z);
      if (!q || q.phase !== ph || d < 650 || q.padFade > 0.05) { edgeBad++; console.log('    edge', m, ph, q && q.phase, d.toFixed(0), q && q.padFade.toFixed(2)); }
    }
  }
}
check(worstOcc >= 0.85, `the apron is occupied ≥ 85 % of every ten minutes (worst window ${(worstOcc * 100).toFixed(1)} %)`);
check(worstGap <= 20.05, `the pad is never empty for more than 20 s (longest gap ${worstGap.toFixed(1)} s)`);
check(maxOn <= 1, `never two craft on the pad (most at once: ${maxOn})`);
check(minSep >= 14, `two craft never come within 14 m of each other (closest ${minSep.toFixed(1)} m)`);
check(maxStep < 4, `every move is smooth (largest step in 0.1 s: ${maxStep.toFixed(2)} m)`);
check(edgeBad === 0, `every craft appears and leaves at the horizon, faded out (≥ 650 blocks from the pad: no warp-out within 300 of a player near it; ${edges - edgeBad} of ${edges})`);

// ---------------------------------------------------------------- the crew and the drone round real designs
const designs = [];
for (const [arch, seed] of [['shuttle', 11], ['dropship', 22], ['freighter', 33]]) { const d = V.Starship.build(seed, arch, null); designs.push([arch, d.meta]); }
for (const [arch, meta] of designs) {
  const G = PL.geom(meta, 1), B = G.bounds;
  let midOk = 0, midN = 0, lateOn = 0, inHull = 0, droneIn = 0, droneOn = 0, N0 = 0;
  for (let m = 0; m < 40; m++) {
    const S = PL.stay(777, m), plan = PL.crewPlan(777, m, G), out = [];
    N0 = Math.max(N0, plan.N);
    const mid = PL.crew(777, m, S * 0.5, S, G, plan, out).filter(o => o.on).length; midN++; if (mid >= 2) midOk++;
    for (let u = S - 5.9; u <= S; u += 0.5) lateOn += PL.crew(777, m, u, S, G, plan, out).filter(o => o.on).length;
    for (let u = 0; u < S; u += 0.25) {
      for (const o of PL.crew(777, m, u, S, G, plan, out)) {
        if (!o.on || o.pos[1] > 0.25) continue;   // on the ground (not on the ramp, not inside on the cabin floor)
        if (o.pos[0] > B[0] + 0.1 && o.pos[0] < B[3] - 0.1 && o.pos[2] > B[2] + 0.1 && o.pos[2] < B[5] - 0.1) inHull++;
      }
      const D = PL.drone(777, m, u, S, G);
      if (D.on) { droneOn++; if (D.pos[1] < B[4] + 0.2 && D.pos[0] > B[0] - 0.5 && D.pos[0] < B[3] + 0.5 && D.pos[2] > B[2] - 0.5 && D.pos[2] < B[5] + 0.5 && Math.hypot(D.pos[0], D.pos[2] - (B[2] + B[5]) / 2) > 0.5) droneIn++; }
    }
  }
  check(midOk === midN, `${arch}: two or three of the crew are out in the middle of every stay (${midOk} of ${midN}; up to ${N0})`);
  check(lateOn === 0, `${arch}: the whole crew is aboard before the ramp closes (${lateOn} outside in the last 6 s)`);
  check(inHull === 0, `${arch}: nobody stands inside the hull (${inHull} samples)`);
  check(droneOn > 0 && droneIn === 0, `${arch}: the drone circles clear of the hull (${droneIn} of ${droneOn} samples inside)`);
  if (G.ramp) { const R = PL.ramp; check(R(2, 90) === 0 && R(10, 90) === 1 && R(86, 90) === 0, `${arch}: the ramp is down from 6 s and up again 4 s before the lift`); }
}

// ---------------------------------------------------------------- the hall: two craft, 45–90 s each, one holding
const HF = V.HangarFlight;
if (HF && HF.sched) {
  let stays = [], both = 0, holdSeen = 0, mouthBoth = 0, parked2 = 0;
  for (let t = 0; t < 1800; t += 0.25) {
    const s = HF.sched(t);
    let pad = 0, mouth = 0, hold = 0;
    for (const c of s) { if (c.phase === 'pad') pad++; if (c.phase === 'hold') hold++; if ((c.phase === 'in' || c.phase === 'out') && c.pos[2] > -8 && c.pos[2] < 40) mouth++; }
    if (pad > 1) parked2++;
    if (pad && hold) holdSeen++;
    if (mouth > 1) mouthBoth++;
    if (s.length === 2) both++;
  }
  for (let n = 0; n < 60; n++) stays.push(HF.stay(n));
  check(Math.min(...stays) >= 45 && Math.max(...stays) <= 90, `the hall parks 45–90 s (${Math.min(...stays).toFixed(1)}–${Math.max(...stays).toFixed(1)})`);
  check(parked2 === 0, `never two craft on the hall's pad (${parked2})`);
  check(mouthBoth === 0, `never two craft in the hangar mouth at once (${mouthBoth})`);
  check(holdSeen > 1800 * 4 * 0.3, `while one is parked the other one holds over the canyon (${(holdSeen / 4).toFixed(0)} s of 1800)`);
} else check(false, 'the hall schedule exists (HangarFlight.sched)');

// ---------------------------------------------------------------- the sky over a plaza: a craft is always up there
{
  const fake = (arch) => ({ key: 'k' + arch, seed: 1, meta: { arch, height: 4, length: 16, width: 10, exhaust: [[0, 1, 6, 0.6]], bounds: [-5, 0, -8, 5, 4, 8] }, gpu: null, last: 0 });
  const g = { state: 'play', dim: 'overworld', player: { pos: [0.5, 82, -50], mode: 'creative' }, difficulty: 'peaceful', raidActive: false, settings: { preset: 'balanced' }, env: { E: { night: 0 } },
    particles: { spawn() { } }, audio: { play() { }, loop() { } }, ui: { chatLine() { } }, trails: null, padLife: { on: true },
    starships: { design: (seed, arch, pal, cb) => { const d = fake(arch || 'interceptor'); if (cb) cb(d); return d; }, ships: [] }, entities: { mobs: [], bolts: [] } };
  for (const preset of ['balanced', 'potato']) {
    g.settings.preset = preset;
    const T = new V.Traffic(g);
    const flashes0 = []; const f0 = T.flash.bind(T); T.flash = (s, arrive) => { const fp = g.player.pos; flashes0.push(Math.hypot(s.pos[0] - fp[0], s.pos[2] - fp[2])); return f0(s, arrive); };
    let seen = 0, n = 0, most = 0;
    for (let i = 0; i < 6000; i++) {
      T.update(0.1);
      if (i < 100) continue;
      let k = 0; for (const s of T.ships) if (!s.dead && s.t >= 0 && !s.dock && Math.hypot(s.pos[0] - g.player.pos[0], s.pos[2] - g.player.pos[2]) < 550 && (s.alpha === undefined || s.alpha > 0.5)) k++;
      n++; if (k) seen++; most = Math.max(most, k);
    }
    const near = flashes0.filter(d => d < 300).length;
    check(seen / n >= (preset === 'potato' ? 0.8 : 0.95), `${preset}: a craft is in the sky over the plaza ${(seen / n * 100).toFixed(1)} % of ten minutes (up to ${most} at once)`);
    check(near === 0, `${preset}: no flash within 300 blocks (${near} of ${flashes0.length})`);
  }
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
