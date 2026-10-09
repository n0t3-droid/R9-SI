// Ships that stay (docs/superpowers/plans/2026-10-09-t-life.md §3.1), the pure schedules on their own:
//  · the Gate Temple's apron (padlife.js): over ten simulated minutes (four windows, three worlds) a craft stands on the
//    pad ≥ 85 % of the time, the pad is never empty for more than 20 s, never two craft on it (and never two hulls within
//    14 m of each other), they come and go at the horizon (FAR blocks from the pad, faded out; the pad is drawn only
//    while the eye is within VIS of it, and FAR − VIS ≥ 300: no craft appears or goes within 300 blocks of the eye),
//    every move is smooth (≤ 40 m/s), the speed profiles reach their ends exactly;
//  · the crew (real designs from the worker's generator, with their occupancy grids: a shuttle down its ramp, a dropship
//    and a freighter met by the pad's ground crew): two or three out in the middle of the stay, all aboard (or gone
//    behind the craft) before the ramp closes, never standing where the hull is (the 1-m occupancy from the feet to the
//    head), the drone always clear of the hull;
//  · the hall (hangarflight.js): two craft share the pad, each parked 45–90 s, the other one holding over the canyon,
//    never both in the hangar mouth;
//  · the sky (traffic.js): flights from horizon to horizon keep a craft within 550 blocks of a plaza ≥ 95 % of the time,
//    no flash within 300 blocks;
//  · in a game (stand-ins for the renderer and the worker: real designs): the apron's actor lands its craft, the crew
//    walks and is drawn, the drone flies, a far craft is drawn see-through; the hall's two craft fly, park and their ground
//    crew is drawn; Very Low (tier 0) draws the craft only; the switch off spends nothing.
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
const apron = PL.apron(0);   // the Gate Temple's apron: the east side of the Gate Plaza
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
      const d = q ? Math.hypot(q.pos[0] - apron.x, q.pos[2] - apron.z) : 0;
      if (!q || q.phase !== ph || d < PL.VIS + 300 || q.padFade > 0.05) { edgeBad++; console.log('    edge', m, ph, q && q.phase, d.toFixed(0), q && q.padFade.toFixed(2)); }
    }
  }
}
check(worstOcc >= 0.85, `the apron is occupied ≥ 85 % of every ten minutes (worst window ${(worstOcc * 100).toFixed(1)} %)`);
check(worstGap <= 20.05, `the pad is never empty for more than 20 s (longest gap ${worstGap.toFixed(1)} s)`);
check(maxOn <= 1, `never two craft on the pad (most at once: ${maxOn})`);
check(minSep >= 14, `two craft never come within 14 m of each other (closest ${minSep.toFixed(1)} m)`);
check(maxStep < 4, `every move is smooth (largest step in 0.1 s: ${maxStep.toFixed(2)} m)`);
check(edgeBad === 0 && PL.FAR - PL.VIS >= 300, `every craft appears and leaves at the horizon, faded out (${PL.FAR} blocks from the pad, drawn within ${PL.VIS} of it: never within 300 of the eye; ${edges - edgeBad} of ${edges})`);
// the speed profiles: a leg of L metres in T seconds ends exactly at L, never faster than 30 m/s, never backwards
{
  let bad = 0, top = 0;
  for (const L of [800, 1000, 1050]) {
    let prevB = 0, prevA = 0;
    for (let t = 0; t <= 45.001; t += 0.05) {
      const b = PL.brakeAt(L, 45, PL.BRAKE, t), a = PL.accelAt(L, 45, PL.ACC, PL.V0, t);
      if (b < prevB - 1e-9 || a < prevA - 1e-9) bad++;
      top = Math.max(top, (b - prevB) / 0.05, (a - prevA) / 0.05); prevB = b; prevA = a;
    }
    if (Math.abs(PL.brakeAt(L, 45, PL.BRAKE, 45) - L) > 0.01 || Math.abs(PL.accelAt(L, 45, PL.ACC, PL.V0, 45) - L) > 0.01) bad++;
  }
  check(!bad && top <= 30, `the approach brakes and the departure accelerates smoothly to their ends (top speed ${top.toFixed(1)} m/s)`);
}

// ---------------------------------------------------------------- the crew and the drone round real designs
const designs = [];
for (const [arch, seed] of [['shuttle', 11], ['shuttle', 0x5e7a11], ['dropship', 22], ['freighter', 33]]) { const d = V.Starship.build(seed, arch, null); designs.push([arch, d.meta, d.occ]); }
for (const [arch, meta, occ] of designs) {
  const G = PL.geom(meta, 1, occ), B = G.bounds, service = G.ramp ? null : [3, B[5] + 8];
  let midOk = 0, midN = 0, lateOn = 0, inHull = 0, droneIn = 0, droneOn = 0, N0 = 0, samples = 0;
  for (let m = 0; m < 40; m++) {
    const S = PL.stay(777, m), plan = PL.crewPlan(777, m, G, service), out = [];
    N0 = Math.max(N0, plan.N);
    const mid = PL.crew(777, m, S * 0.5, S, G, plan, out).filter(o => o.on).length; midN++; if (mid >= 2) midOk++;
    for (let u = S - PL.CREW.rampClose; u <= S; u += 0.5) lateOn += PL.crew(777, m, u, S, G, plan, out).filter(o => o.on).length;
    for (let u = 0; u < S; u += 0.25) {
      for (const o of PL.crew(777, m, u, S, G, plan, out)) {
        if (!o.on || o.pos[1] > 0.25) continue;   // on the ground (not on the ramp, not inside on the cabin floor)
        samples++;
        if (!PL.standClear(G, o.pos[0], o.pos[2])) inHull++;
      }
      const D = PL.drone(777, m, u, S, G);
      if (D.on) { droneOn++; if (D.pos[1] < B[4] + 0.2 && D.pos[0] > B[0] - 0.5 && D.pos[0] < B[3] + 0.5 && D.pos[2] > B[2] - 0.5 && D.pos[2] < B[5] + 0.5 && Math.hypot(D.pos[0], D.pos[2] - (B[2] + B[5]) / 2) > 0.5) droneIn++; }
    }
  }
  check(midOk === midN, `${arch}: two or three of the crew are out in the middle of every stay (${midOk} of ${midN}; up to ${N0}${G.ramp ? ', down the ramp' : ', the ground crew'})`);
  check(lateOn === 0, `${arch}: the whole crew is aboard before the ramp closes (${lateOn} outside in the last ${PL.CREW.rampClose} s)`);
  check(inHull === 0 && samples > 1000, `${arch}: nobody stands where the hull is (${inHull} of ${samples} samples on the ground)`);
  check(droneOn > 0 && droneIn === 0, `${arch}: the drone circles clear of the hull (${droneIn} of ${droneOn} samples inside)`);
  if (G.ramp) { const R = PL.ramp; check(R(2, 90) === 0 && R(10, 90) === 1 && R(86, 90) === 0, `${arch}: the ramp is down from 6 s and up again 4 s before the lift`); }
}

// ---------------------------------------------------------------- the hall: two craft, 45–90 s each, one holding
const HF = V.HangarFlight;
if (HF && HF.sched) {
  let stays = [], holdSeen = 0, mouthBoth = 0, parked2 = 0, padT = 0, minSep = 1e9, maxStep = 0, prev = null, phases = new Set();
  const cache = { n: 0, T: HF.T0 };
  for (let t = 0; t < 1800; t += 0.25) {
    const s = HF.sched(t, cache);
    let pad = 0, mouth = 0, hold = 0;
    for (const c of s) { phases.add(c.phase); if (c.phase === 'pad') pad++; if (c.phase === 'hold') hold++; if ((c.phase === 'in' || c.phase === 'out' || c.phase === 'settle' || c.phase === 'lift' || c.phase === 'turn') && c.pos[2] > -8 && c.pos[2] < 40) mouth++; }
    if (pad > 1) parked2++;
    if (pad) padT += 0.25;
    if (pad && hold) holdSeen++;
    if (mouth > 1) mouthBoth++;
    minSep = Math.min(minSep, Math.hypot(s[0].pos[0] - s[1].pos[0], s[0].pos[1] - s[1].pos[1], s[0].pos[2] - s[1].pos[2]));
    const now = {}; for (const c of s) { now[c.c] = c.pos.slice(); if (prev && prev[c.c]) maxStep = Math.max(maxStep, Math.hypot(c.pos[0] - prev[c.c][0], c.pos[1] - prev[c.c][1], c.pos[2] - prev[c.c][2])); }
    prev = now;
  }
  for (let n = 0; n < 60; n++) stays.push(HF.stay(n));
  check(Math.min(...stays) >= 45 && Math.max(...stays) <= 90, `the hall parks 45–90 s (${Math.min(...stays).toFixed(1)}–${Math.max(...stays).toFixed(1)})`);
  check(parked2 === 0, `never two craft on the hall's pad (${parked2})`);
  check(mouthBoth === 0, `never two craft in the hangar mouth at once (${mouthBoth})`);
  check(holdSeen > 1800 * 4 * 0.3, `while one is parked the other one holds over the canyon (${(holdSeen / 4).toFixed(0)} s of 1800; the pad is taken ${(padT / 18).toFixed(0)} %)`);
  check(minSep >= 14, `the two never come within 14 m of each other (closest ${minSep.toFixed(1)} m)`);
  check(maxStep < 32 * 0.25 + 0.5, `the two fly smoothly (largest step in 0.25 s: ${maxStep.toFixed(2)} m)`);
  check(['pad', 'lift', 'turn', 'out', 'air', 'hold', 'inbound', 'wait', 'slide', 'in', 'settle'].every(q => phases.has(q)), `a round: pad, lift, turn, out, the loop, the hold circle, the way back, the wait beside the runway, the slide, in and settle (${[...phases].join(' ')})`);
  // the new tracks keep 10 m above the canyon's ground in every world (its mesas vary with the seed)
  const R = HF.tracks();
  let clear = Infinity, where = null;
  const pts = R.ob.pts.concat(R.ib.pts);
  for (let k = 0; k < 64; k++) { const th = k / 64 * 2 * Math.PI, B = R.orb; pts.push([B.C[0] + 40 * (Math.cos(th) * B.a[0] + Math.sin(th) * B.hd[0]), B.C[1] - 1.5, B.C[2] + 40 * (Math.cos(th) * B.a[1] + Math.sin(th) * B.hd[1])]); }
  for (const seed of [4242, 1, 777]) {
    const gs = V.makeGen('overworld', seed, { vgen: 9 });
    for (const p of pts) { if (p[2] < 120) continue; const gy = gs.surfaceY(Math.floor(p[0]), Math.floor(p[2])); if (p[1] - gy < clear) { clear = p[1] - gy; where = [seed, Math.round(p[0]), Math.round(p[2])]; } }
  }
  check(clear >= 10, `the hold circle and the way back keep ${clear.toFixed(1)} m above the canyon at least (seed ${where && where[0]}, at ${where && where[1]}, ${where && where[2]})`);
  // the apron's lanes stay clear of the Sky Isles, of the hall's tracks and of the canyon
  const gi = V.makeGen('overworld', 4242, { vgen: 9 }), isles = V.IslesGen ? V.IslesGen.list(gi) : [];
  let isleHit = 0, hallMin = Infinity, laneClear = Infinity;
  const hallPts = pts.filter((p, i) => i % 3 === 0);
  for (let m = 0; m < 160; m++) {
    const L = PL.legs(apron, 4242, m);
    for (const path of [L.app, L.dep]) for (let i = 0; i < path.pts.length; i++) {
      const q = path.pts[i];
      for (const I of isles) if (Math.hypot(q[0] - I.x, q[2] - I.z) < I.r + 20 && q[1] > I.y - 55 && q[1] < I.y + 25) isleHit++;
      if (i % 2 === 0) for (const h of hallPts) hallMin = Math.min(hallMin, Math.hypot(q[0] - h[0], q[1] - h[1], q[2] - h[2]));
      if (q[2] > 110 && i % 4 === 0 && m < 40) laneClear = Math.min(laneClear, q[1] - gi.surfaceY(Math.floor(q[0]), Math.floor(q[2])));
    }
  }
  check(isles.length >= 7 && isleHit === 0, `the apron's craft never fly into a Sky Isle (${isleHit} samples near one of ${isles.length})`);
  check(hallMin >= 30, `the apron's craft keep ≥ 30 m from the hall's two tracks (closest ${hallMin.toFixed(1)} m)`);
  check(laneClear >= 10, `over the canyon the apron's craft keep ${laneClear.toFixed(1)} m above the ground at least`);
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
// ---------------------------------------------------------------- in a game: the actors' update and draw paths
{
  const R = V.R, veil = R.byName.portal_veil.defaultState;
  V.Folk = V.Folk || {}; V.Folk.look = V.Folk.look || ((seed, role) => ({ role })); V.Folk.model = () => ({ def: {} }); V.getVoxModel = V.getVoxModel || (() => ({ def: { radius: 1 }, parts: {} }));
  const built = new Map(), calls = { design: 0, drawOne: 0, drawAlpha: 0, folk: 0, model: 0, trail: 0, part: 0, glow: 0 };
  const mkGame = (preset, playerPos) => {
    const SS = {
      ships: [], pilot: null, designs: new Map(),
      design(seed, arch, pal, cb) {
        const key = seed + ':' + arch + ':' + pal; let d = this.designs.get(key);
        if (!d) { calls.design++; let b = built.get(arch + seed); if (!b) { b = V.Starship.build(seed, arch, pal); built.set(arch + seed, b); } d = { key, seed, arch, meta: b.meta, occ: b.occ, gpu: { hull: {}, glass: {}, gear: {} }, last: 0 }; this.designs.set(key, d); }
        if (cb) cb(d); return d;
      },
      begin: () => ({ u: {} }), end() { }, drawOne() { calls.drawOne++; }, drawAlpha() { calls.drawAlpha++; }, lightAt: () => ({ sky: 1, bl: [0, 0, 0] }),
    };
    const g = { state: 'play', dim: 'overworld', settings: { preset, anim: preset !== 'potato' }, meta: { seed: 4242 }, env: { day: 2, ticks: 3000, E: { night: 0 } }, time: 0,
      player: { pos: playerPos.slice() }, world: { getBlock: (x, y, z) => (x === 0 && y === 81 && z === 20 ? veil : 0), getLight: () => 0xf000 }, starships: SS,
      trails: { engine() { calls.trail++; }, map: new Map() }, particles: { spawn() { calls.part++; }, glow() { calls.glow++; } }, audio: {},
      entities: { beginVox: () => ({ u: {} }), drawModel() { calls.model++; }, lightAt: () => ({ sky: 1, bl: [0, 0, 0] }), sunShade: () => 0 } };
    return g;
  };
  const planes = new Float32Array(24); for (let i = 0; i < 6; i++) planes[i * 4 + 3] = 1;
  const rr = { planes, gl: { uniform1f() { } }, cam: { x: 47, y: 90, z: 30 } };
  for (const k in calls) calls[k] = 0;
  const g = mkGame('balanced', [40, 81, 40]), A = new PL.Actor(g);
  let crewMax = 0, parked = 0, drones = 0, ok = true, far = 0;
  try {
    A.jump('apron', 'land'); for (const k in calls) calls[k] = 0;
    for (let i = 0; i < 60 * 20; i++) {
      g.time += 0.05; A.update(0.05);
      const st = A.stats(); crewMax = Math.max(crewMax, st.crewOn); parked = Math.max(parked, st.parked); drones = Math.max(drones, st.drones);
      if (i % 10 === 0) { A.draw(rr, {}, 'opaque', rr.cam); A.draw(rr, {}, 'trans', rr.cam); }
    }
    // the eye 560 blocks away: the craft fades (drawn see-through)
    g.player.pos = [47 + 500, 81, 62 + 250]; for (let i = 0; i < 40; i++) { A.update(0.05); A.draw(rr, {}, 'opaque', rr.cam); A.draw(rr, {}, 'trans', rr.cam); }
    far = calls.drawAlpha;
  } catch (e) { ok = false; console.log(e.stack); }
  check(ok && parked >= 1 && crewMax >= 2 && drones >= 1 && calls.drawOne > 0 && calls.folk + calls.model > 0 && calls.trail > 0, `the apron's actor: a craft lands and parks, ${crewMax} of its crew walk and are drawn (${calls.model} figure and drone draws), the drone flies, the engines burn (${calls.trail})`);
  check(ok && far > 0, `far away the craft is drawn see-through (${far} draws)`);
  // Very Low: the craft only
  for (const k in calls) calls[k] = 0;
  const g0 = mkGame('potato', [40, 81, 40]), A0 = new PL.Actor(g0); let crew0 = 0;
  A0.jump('apron', 'crew'); for (let i = 0; i < 400; i++) { A0.update(0.05); crew0 = Math.max(crew0, A0.stats().crewOn); if (i % 10 === 0) { A0.draw(rr, {}, 'opaque', rr.cam); A0.draw(rr, {}, 'trans', rr.cam); } }
  check(calls.drawOne > 0 && crew0 === 0 && calls.model === 0 && calls.trail === 0 && calls.part === 0, `Very Low: the visiting craft only (drawn ${calls.drawOne}; crew ${crew0}, figures ${calls.model}, plumes ${calls.trail}, particles ${calls.part})`);
  // the switch off: nothing
  for (const k in calls) calls[k] = 0;
  const g1 = mkGame('high', [40, 81, 40]); g1.settings.padLife = false; const A1 = new PL.Actor(g1);
  for (let i = 0; i < 200; i++) { A1.update(0.05); A1.draw(rr, {}, 'opaque', rr.cam); A1.draw(rr, {}, 'trans', rr.cam); }
  check(calls.design === 0 && calls.drawOne === 0 && calls.trail === 0, 'padLife off: no design is built, nothing is drawn or spent');
  // an outpost: a world ship parked on its pad gets a ground crew at its places and the drone; flown away, visitors come
  for (const k in calls) calls[k] = 0;
  const go = mkGame('balanced', [210, 70, 205]);
  const wd = go.starships.design(99, 'dropship', null);
  const ship = { key: '200,64,200', d: wd, pos: [200.5, 64, 200.5], yaw: 0.5, state: 'parked' };
  go.starships.ships.push(ship);
  const AO = new PL.Actor(go); let oc = 0, od = 0, ok2 = true, vis = 0;
  try {
    for (let i = 0; i < 400; i++) { AO.update(0.05); oc = Math.max(oc, AO.stats().crew); od = Math.max(od, AO.stats().drones); if (i % 10 === 0) { AO.draw(rr, {}, 'opaque', rr.cam); AO.draw(rr, {}, 'trans', rr.cam); } }
    go.starships.ships.length = 0;   // the player flies it away: visitors use the pad
    for (let i = 0; i < 4000; i++) { AO.update(0.05); vis = Math.max(vis, AO.stats().parked); }
  } catch (e) { ok2 = false; console.log(e.stack); }
  check(ok2 && oc >= 2 && od >= 1 && vis >= 1, `an outpost: the parked ship's ground crew stands at its places (${oc}) with the drone (${od}); with the ship gone, a visitor parks (${vis})`);
  // the hall's two craft in a game: they fly, one parks, its ground crew walks and is drawn
  for (const k in calls) calls[k] = 0;
  const gh = mkGame('balanced', [0.5, 81, 6]);
  gh.starships.ships.push({ hangar: true, state: 'parked', pos: [0, 81, -10], hidden: false, hitbox: () => [-7.5, 81.3, -21.25, 7.5, 89, 1.75] });
  const H = new HF.Actor(gh); let hcrew = 0, hpad = 0, hok = true;
  try {
    H.update(0.05); H.jumpPhase('pad', 0.05);
    for (let i = 0; i < 2400; i++) { gh.time += 0.05; H.update(0.05); if (H.crafts.some(C => C.phase === 'pad')) hpad++; if (H.crafts.some(C => C.crewOn)) hcrew++; if (i % 10 === 0) { H.draw(rr, {}, 'opaque'); H.draw(rr, {}, 'trans'); } }
  } catch (e) { hok = false; console.log(e.stack); }
  check(hok && hpad > 0 && hcrew > 0 && calls.model > 0 && H.crafts.every(C => C.d && C.d.meta), `the hall: the two fly and park (${(hpad / 20).toFixed(0)} s on the pad of 120), the ground crew walks and is drawn (${(hcrew / 20).toFixed(0)} s, ${calls.model} draws)`);
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
