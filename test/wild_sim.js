// t-wild · WOW VI · die Tierwelt (docs/superpowers/plans/2026-10-16-t-wild.md) — the pure parts (src/main/wildsim.js):
//  · the one caps table: every piece's caps by tier, monotone, Very Low all 0, Low no murmuration and no rays; the
//    switches name their pieces; a switch off makes its pieces 0; the tier of a settings record
//  · the boids (Wild.Flock): bounded (every bird near the stage after 60 s), cohesive (the cloud's spread stays small,
//    no bird strays), no NaN, the speeds within their limits, deterministic with a seed (the same twice, another seed
//    differs), a turning wave runs through the cloud, the cost of a step for 300 birds
//  · the shoal: every fish inside its disc and its water band; it scatters from the eye and gathers again
//  · the swarm (butterflies): at home over its flowers, they sit and fly on; a walk through makes the near ones rise;
//    they settle again
//  · the schedule: a pure function of (seed, day, ticks) — the same for host and guests; the hours of every piece;
//    the murmuration's stage the same for two clients near each other
//  · the sky rays' circuit: closed and smooth, the same at a clock for every guest, evenly spaced, and clear of the
//    isles' rock (gen_realm's islandShape) by half the span + 4 in three worlds
//   bash test/wt_run.sh wild_sim.js 300
const V = require('./load_shared.js');
global.performance = global.performance || { now: () => Date.now() };
require(__dirname + '/../src/main/wildsim.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const W = V.Wild;
check(!!W && !!W.CAPS && !!W.Flock && !!W.Swarm && !!W.sched && !!W.rayLoop, 'VR.Wild exists (CAPS, Flock, Swarm, sched, rayLoop)');

// ---------------------------------------------------------------- 1. the caps table
{
  const keys = Object.keys(W.CAPS);
  check(keys.length >= 12 && keys.every(k => W.CAPS[k].length === 5), `one table: ${keys.length} caps, five tiers each`);
  check(keys.every(k => W.CAPS[k][0] === 0), 'Very Low: every cap 0 (nothing new drawn)');
  check(keys.every(k => W.CAPS[k].every((v, i) => i === 0 || v >= W.CAPS[k][i - 1])), 'every cap grows with the tier');
  check(W.CAPS.murm[1] === 0 && W.CAPS.ray[1] === 0 && W.CAPS.murm[2] >= 160 && W.CAPS.murm[4] <= 400 && W.CAPS.murm[3] >= 280, `Low: no murmuration, no rays; the murmuration 160–400 boids from Balanced (${W.CAPS.murm.join(' ')})`);
  // each boid of the murmuration is drawn as a little party of birds (wildgpu.js 'flock': MURM_K birds round it, in its
  // own frame, flattened into its sheet): thousands of birds in the sky for the cost of a few hundred boids
  check(W.MURM_K >= 8 && W.MURM_K <= 24 && W.CAPS.murm[3] * W.MURM_K >= 5000, `the murmuration on High: ${W.CAPS.murm[3]} boids × ${W.MURM_K} birds = ${W.CAPS.murm[3] * W.MURM_K} birds in the sky`);
  check(W.CAPS.fish[4] >= 40 && W.CAPS.fish[4] <= 80 && W.CAPS.bfly[4] >= 30 && W.CAPS.bfly[4] <= 60 && W.CAPS.ray[3] >= 3 && W.CAPS.ray[4] <= 4, 'the sizes asked: shoal 40–80, swarm 30–60, three or four rays');
  const all = new Set(); for (const k of W.KEYS) for (const c of W.SWITCH[k]) all.add(c);
  check(W.KEYS.length === 5 && keys.every(k => all.has(k)), `five switches (${W.KEYS.join(', ')}) and every cap belongs to one`);
  const S = { preset: 'high' }; for (const k of W.KEYS) S[k] = true;
  const b = W.budget(S);
  check(b.tier === 3 && b.cap.murm === W.CAPS.murm[3] && b.cap.ray === W.CAPS.ray[3], `High: tier 3, the table's caps (${b.cap.murm} birds, ${b.cap.ray} rays)`);
  S.wildRays = false; const b2 = W.budget(S);
  check(b2.cap.ray === 0 && b2.cap.motes === 0 && b2.cap.murm === W.CAPS.murm[3], 'a switch off makes its pieces 0, the others stay');
  const P = { preset: 'potato' }; for (const k of W.KEYS) P[k] = true;
  check(Object.values(W.budget(P).cap).every(v => v === 0), 'Very Low with the switches on by hand still draws nothing (its caps)');
  check(W.tierOf({ preset: 'ultraLite' }) === 4 && W.tierOf({ preset: 'low' }) === 1 && W.tierOf({ particles: 0 }) === 0 && W.tierOf(null) === 2, 'the tier of a settings record (a preset, or a custom one by its particle level)');
  check(W.any(W.budget(S)) && !W.any(W.budget(P)), 'any(): something to do on High, nothing on Very Low');
}

// ---------------------------------------------------------------- 2. the boids
const stage = { x: 345, y: 86, z: 150 };
const run = (n, seed, secs, o) => {
  const f = new W.Flock(n, seed, o);
  f.place(stage.x, stage.y, stage.z, 12);
  const dt = 1 / 30, steps = Math.round(secs / dt);
  let nan = false, vlo = 1e9, vhi = 0, far = 0, spreadMax = 0;
  for (let s = 0; s < steps; s++) {
    W.murmTarget(4242, s * dt, stage, f.tgt);
    f.step(dt);
    if (s > steps / 4 && (s & 7) === 0) {
      const c = f.centroid();
      spreadMax = Math.max(spreadMax, f.spread());
      for (let i = 0; i < n; i++) {
        const x = f.pos[i * 3], y = f.pos[i * 3 + 1], z = f.pos[i * 3 + 2];
        if (!Number.isFinite(x + y + z)) nan = true;
        const v = Math.hypot(f.vel[i * 3], f.vel[i * 3 + 1], f.vel[i * 3 + 2]); vlo = Math.min(vlo, v); vhi = Math.max(vhi, v);
        far = Math.max(far, Math.hypot(x - c[0], y - c[1], z - c[2]));
      }
    }
  }
  return { f, nan, vlo, vhi, far, spreadMax };
};
{
  const A = run(300, 7, 60);
  const P = A.f.P;
  check(!A.nan, 'no NaN in 60 s of 300 birds');
  check(A.vlo >= P.vmin - 0.05 && A.vhi <= P.vmax + 0.05, `every bird flies between ${P.vmin} and ${P.vmax} blocks/s (${A.vlo.toFixed(2)} – ${A.vhi.toFixed(2)})`);
  let out = 0, blo = 1e9, bhi = -1e9; for (let i = 0; i < 300; i++) { const x = A.f.pos[i * 3], y = A.f.pos[i * 3 + 1], z = A.f.pos[i * 3 + 2]; blo = Math.min(blo, y); bhi = Math.max(bhi, y); if (Math.abs(x - stage.x) > 140 || Math.abs(z - stage.z) > 140 || y < stage.y - 30 || y > stage.y + 40) out++; }
  check(out === 0, `bounded: every bird within the stage's box after 60 s (${out} outside; heights ${(blo - stage.y).toFixed(0)} … +${(bhi - stage.y).toFixed(0)})`);
  check(blo > stage.y - 22 && bhi < 112, `over the water and under the isles' lowest rock (115): ${blo.toFixed(0)} … ${bhi.toFixed(0)}`);
  check(A.spreadMax < 44 && A.far < 110, `cohesive: one cloud (its spread at most ${A.spreadMax.toFixed(1)} blocks, the farthest bird ${A.far.toFixed(1)} from its middle)`);
  // a great cloud: from the beach (150–200 blocks) it spans a good part of the evening sky
  const sp = A.f.spread();
  check(sp >= 14, `a great cloud, not a knot (spread ${sp.toFixed(1)} blocks: ${(sp * 4).toFixed(0)} across)`);
  // flat: sheets, not a ball — the vertical spread a fraction of the horizontal (the sheets darken where they turn edge-on)
  { const c = A.f.ctr; let sh = 0, sv = 0; for (let i = 0; i < 300; i++) { const x = A.f.pos[i * 3] - c[0], y = A.f.pos[i * 3 + 1] - c[1], z = A.f.pos[i * 3 + 2] - c[2]; sh += x * x + z * z; sv += y * y; } const r = Math.sqrt(sv / (sh / 2)); check(r < 0.55, `flat: its height ${(r * 100).toFixed(0)} % of its breadth`); }
  // the lobes: the cloud's wings swing apart and fold back into one (a breath of 26–38 s)
  { const o = new Float32Array(9); let lo = 1e9, hi = 0; for (let t = 0; t < 80; t += 0.25) { W.murmLobes(4242, t, 3, 30, o); const a = Math.hypot(o[0], o[2] / 0.8); lo = Math.min(lo, a); hi = Math.max(hi, a); } check(lo < 3 && hi > 27, `the lobes swing apart to ${hi.toFixed(0)} and fold back to ${lo.toFixed(1)}`); }
  const B = run(300, 7, 20), C = run(300, 7, 20), D = run(300, 8, 20);
  let same = true, diff = false; for (let i = 0; i < 900; i++) { if (B.f.pos[i] !== C.f.pos[i]) same = false; if (B.f.pos[i] !== D.f.pos[i]) diff = true; }
  check(same, 'deterministic: the same seed gives the same flock, bird for bird');
  check(diff, 'another seed gives another flock');
  // the turning wave: a pulse runs through the cloud now and then
  const E = run(240, 3, 40);
  check(E.f.waves >= 2, `turning waves run through the cloud (${E.f.waves} in 40 s)`);
  // the shape turns: the cloud's principal axis changes over time (a murmuration folds, it does not hold one shape)
  {
    const f = new W.Flock(240, 11); f.place(stage.x, stage.y, stage.z, 12);
    const axes = [];
    for (let s = 0; s < 30 * 40; s++) { W.murmTarget(99, s / 30, stage, f.tgt); f.step(1 / 30); if (s % 150 === 149) axes.push(f.axis()); }
    let turned = 0; for (let k = 1; k < axes.length; k++) { const a = axes[k - 1], b = axes[k], d = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2]); if (d < 0.9) turned++; }
    check(turned >= 2, `the cloud's shape turns (its long axis swung over 25° ${turned} times in 40 s)`);
  }
  // the cost: one step of 300 birds
  {
    const f = new W.Flock(300, 5); f.place(stage.x, stage.y, stage.z, 12);
    for (let s = 0; s < 300; s++) { W.murmTarget(1, s / 30, stage, f.tgt); f.step(1 / 30); }
    let best = 1e9;
    for (let r = 0; r < 5; r++) { const t0 = process.hrtime.bigint(); for (let s = 0; s < 60; s++) { W.murmTarget(1, s / 30, stage, f.tgt); f.step(1 / 30); } best = Math.min(best, Number(process.hrtime.bigint() - t0) / 1e6 / 60); }
    console.log(`     a step of 300 birds: ${best.toFixed(3)} ms`);
    check(best < 0.6, 'a step of 300 birds costs under 0.6 ms in node');
  }
  // the target: a seeded loop round the stage, the same for every client
  const t1 = [0, 0, 0], t2 = [0, 0, 0]; W.murmTarget(77, 123.4, stage, t1); W.murmTarget(77, 123.4, stage, t2);
  let rmax = 0, ylo = 1e9, yhi = -1e9; for (let t = 0; t < 600; t += 0.5) { W.murmTarget(77, t, stage, t1); rmax = Math.max(rmax, Math.hypot(t1[0] - stage.x, t1[2] - stage.z)); ylo = Math.min(ylo, t1[1]); yhi = Math.max(yhi, t1[1]); }
  check(t1.length === 3 && rmax <= 66 && rmax >= 25 && ylo >= stage.y - 12 && yhi <= stage.y + 22, `the wandering target loops round the stage (out to ${rmax.toFixed(0)}, ${(ylo - stage.y).toFixed(0)} … +${(yhi - stage.y).toFixed(0)} in height)`);
}

// ---------------------------------------------------------------- 3. the shoal
{
  const home = { x: 276.5, z: 77.5, r: 5, y0: 60.6, y1: 62.4 };
  const f = new W.Flock(64, 21, W.SHOAL);
  f.bound = home; f.place(home.x, (home.y0 + home.y1) / 2, home.z, 2);
  let out = 0, nan = false;
  for (let s = 0; s < 30 * 40; s++) {
    W.shoalTarget(21, s / 30, home, f.tgt); f.step(1 / 30);
    if (s > 60) for (let i = 0; i < 64; i++) { const x = f.pos[i * 3], y = f.pos[i * 3 + 1], z = f.pos[i * 3 + 2]; if (!Number.isFinite(x + y + z)) nan = true; if (Math.hypot(x - home.x, z - home.z) > home.r + 0.6 || y < home.y0 - 0.3 || y > home.y1 + 0.3) out++; }
  }
  check(!nan && out === 0, `the shoal stays in its disc and its water band for 40 s (${out} fish-frames outside)`);
  // the eye comes close: they scatter (the mean distance from the eye grows), then gather again
  const eye = [home.x + 1, home.y1 + 1.2, home.z];
  const meanD = () => { let s = 0; for (let i = 0; i < 64; i++) s += Math.hypot(f.pos[i * 3] - eye[0], f.pos[i * 3 + 2] - eye[2]); return s / 64; };
  f.fear = eye; const d0 = meanD();
  for (let s = 0; s < 45; s++) { W.shoalTarget(21, 40 + s / 30, home, f.tgt); f.step(1 / 30); }
  const d1 = meanD();
  f.fear = null;
  for (let s = 0; s < 300; s++) { W.shoalTarget(21, 42 + s / 30, home, f.tgt); f.step(1 / 30); }
  check(d1 > d0 + 0.5, `the shoal scatters from the eye (mean distance ${d0.toFixed(2)} → ${d1.toFixed(2)})`);
  check(f.spread() < 3.2, `and gathers again (spread ${f.spread().toFixed(2)})`);
}

// ---------------------------------------------------------------- 4. the swarm
{
  const flowers = []; for (let i = 0; i < 24; i++) flowers.push([100 + (i % 6) * 1.5, 81, 200 + Math.floor(i / 6) * 1.5]);
  const home = { x: 103.75, y: 81, z: 202.25, r: 6 };
  const S = new W.Swarm(40, 9, home, flowers);
  const far = [130, 82.6, 230];
  let sat = 0, out = 0, nan = false;
  for (let s = 0; s < 30 * 30; s++) {
    S.step(1 / 30, far, false);
    for (let i = 0; i < S.n; i++) { const x = S.pos[i * 3], y = S.pos[i * 3 + 1], z = S.pos[i * 3 + 2]; if (!Number.isFinite(x + y + z)) nan = true; if (Math.hypot(x - home.x, z - home.z) > home.r + 4 || y < home.y - 0.2 || y > home.y + 6) out++; if (S.state[i] === 1) sat++; }
  }
  check(!nan && out === 0, `the swarm stays over its drift for 30 s (${out} butterfly-frames away)`);
  check(sat > 0.15 * 40 * 900 * 0.3, `they sit on the flowers too (${(sat / (40 * 900) * 100).toFixed(0)} % of the time)`);
  // a walk through the middle: the near ones rise
  const mid = [home.x, home.y + 1.6, home.z];
  const meanY = () => { let s = 0, n = 0; for (let i = 0; i < S.n; i++) if (Math.hypot(S.pos[i * 3] - mid[0], S.pos[i * 3 + 2] - mid[2]) < 5) { s += S.pos[i * 3 + 1]; n++; } return n ? s / n : home.y; };
  const y0 = meanY();
  let up = 0; for (let s = 0; s < 45; s++) { S.step(1 / 30, mid, true); }
  for (let i = 0; i < S.n; i++) if (S.state[i] === 2) up++;
  const y1 = meanY();
  check(up >= 8 && y1 > y0 + 0.8, `a walk through makes them rise (${up} startled, the near ones' height +${(y1 - y0).toFixed(2)})`);
  for (let s = 0; s < 30 * 14; s++) S.step(1 / 30, far, false);
  let still = 0; for (let i = 0; i < S.n; i++) if (S.state[i] === 2) still++;
  check(still === 0, `and settle again within 14 s (${still} still startled)`);
}

// ---------------------------------------------------------------- 5. the schedule
{
  const T = (t) => W.sched(53, 4, t);
  check(T(12000).murm === 'swirl' && T(13800).murm === 'roost' && T(18000).murm === 'perch' && T(23200).murm === 'rise' && T(1500).murm === 'leave' && T(6000).murm === 'off', 'the murmuration: swirling at dusk, roosting, sitting through the night, rising at dawn, leaving, gone by day');
  check(T(6000).gulls && !T(18000).gulls && T(6000).heron && !T(18000).heron && T(6000).bugs && !T(18000).bugs && T(6000).dfly && !T(16000).dfly, 'gulls, the heron, butterflies and dragonflies by day');
  check(T(12000).fox && !T(6000).fox && !T(18000).fox && T(23400).deerLine && T(500).deerLine && !T(6000).deerLine && T(6000).rabbits && !T(18000).rabbits, 'the fox at dusk, the deer line at dawn, rabbits by day');
  let same = true; for (let t = 0; t < 24000; t += 137) { const a = W.sched(53, 9, t), b = W.sched(53, 9, t); if (JSON.stringify(a) !== JSON.stringify(b)) same = false; }
  check(same, 'the schedule is a pure function of (seed, day, ticks): the same for host and guests');
  const s1 = W.stageOf(53, 4, 'dusk', [300, 70, 100], true), s2 = W.stageOf(53, 4, 'dusk', [310, 72, 120], true);
  check(Math.abs(s1.x - s2.x) < 1e-9 && Math.abs(s1.z - s2.z) < 1e-9 && Math.hypot(s1.x - V.Land.LAKE.x, s1.z - V.Land.LAKE.z) < 60, `the stage over the lake is the same for two clients near it (${s1.x.toFixed(0)}, ${s1.z.toFixed(0)})`);
  // low over the water, well under the Sky Isles' rock (their lowest tips at 115): seen from the shore against the evening
  // sky, not lost among the isles' undersides
  check(s1.y >= V.C.SEA + 16 && s1.y <= V.C.SEA + 30, `the stage over the lake: ${(s1.y - V.C.SEA).toFixed(0)} blocks over the water (${s1.y.toFixed(0)})`);
  const s3 = W.stageOf(53, 4, 'dusk', [1000, 80, 1000], false), s4 = W.stageOf(53, 4, 'dusk', [1010, 80, 1020], false), s5 = W.stageOf(53, 5, 'dusk', [1010, 80, 1020], false);
  check(s3.x === s4.x && s3.z === s4.z && (s5.x !== s4.x || s5.z !== s4.z), 'away from the lake: the same stage for clients in one cell; another day, another place');
}

// ---------------------------------------------------------------- 6. the sky rays' circuit
{
  let worst = 1e9, worstAt = null, closed = true, smooth = true, worlds = 0;
  for (const seed of [53, 1, 777]) {
    const g = V.makeGen('overworld', seed, { vgen: 11 }), I = V.IslesGen.list(g), loop = W.rayLoop(I);
    worlds++;
    const p0 = [0, 0, 0, 0, 0, 0], p1 = [0, 0, 0, 0, 0, 0];
    W.rayAt(loop, 0, p0); W.rayAt(loop, loop.L, p1);
    if (Math.hypot(p0[0] - p1[0], p0[1] - p1[1], p0[2] - p1[2]) > 0.01) closed = false;
    // the heading turns smoothly (no kink over 12° within 2 blocks)
    const a = [0, 0, 0, 0, 0, 0], b = [0, 0, 0, 0, 0, 0];
    for (let s = 0; s < loop.L; s += 2) { W.rayAt(loop, s, a); W.rayAt(loop, s + 2, b); const d = Math.abs(Math.atan2(Math.sin(a[3] - b[3]), Math.cos(a[3] - b[3]))); if (d > 0.21) smooth = false; }
    // clearance from the rock: along the circuit, every ray's own line (its offsets), the span's half + 4
    const half = W.RAY.span * W.RAY.maxScale / 2 + 4;
    for (let k = 0; k < 4; k++) for (let t = 0; t < loop.L / W.RAY.speed; t += 0.5) {
      const st = W.rayState(seed, t, k, 4, loop, a);
      for (const isle of I) {
        const dx = st[0] - isle.x, dz = st[2] - isle.z, dh = Math.hypot(dx, dz);
        if (dh > isle.r * 1.4 + half) continue;
        // the rock under the ray (and round it, half a span each way): its column's top and bottom
        for (let ox = -half; ox <= half; ox += 2) for (let oz = -half; oz <= half; oz += 2) {
          if (ox * ox + oz * oz > half * half) continue;
          const sh = g.islandShape(isle, Math.round(st[0] + ox), Math.round(st[2] + oz));
          if (!sh) continue;
          const gap = st[1] < sh.bottom ? sh.bottom - st[1] : st[1] > sh.top + 9 ? st[1] - sh.top - 9 : -1;
          const free = gap - 3;   // (the body's half thickness and the wings' wave)
          if (free < worst) { worst = free; worstAt = [seed, k, +t.toFixed(1), Math.round(st[0]), Math.round(st[1]), Math.round(st[2]), isle.name]; }
        }
      }
    }
    if (seed === 53) {
      const L = loop.L, sp = W.RAY.speed;
      check(L > 300 && L < 700 && L / sp > 50 && L / sp < 140, `the circuit: ${L.toFixed(0)} blocks, a lap in ${(L / sp).toFixed(0)} s`);
      const ys = []; for (let s = 0; s < L; s += 4) { W.rayAt(loop, s, a); ys.push(a[1]); }
      check(Math.min(...ys) >= 96 && Math.max(...ys) <= 124, `under and between the isles' lowest rock, against the sky from the shores (${Math.min(...ys).toFixed(0)} … ${Math.max(...ys).toFixed(0)} high)`);
      check(W.RAY.minScale >= 14 && W.RAY.maxScale <= 26, `great gentle creatures: ${W.RAY.minScale}–${W.RAY.maxScale} blocks from wing tip to wing tip`);
      // the same at a clock for every guest; evenly spaced
      const r1 = W.rayState(53, 1234.5, 2, 4, loop, [0, 0, 0, 0, 0, 0]).slice(), r2 = W.rayState(53, 1234.5, 2, 4, loop, [0, 0, 0, 0, 0, 0]).slice();
      check(JSON.stringify(r1) === JSON.stringify(r2), 'a ray is where the world clock says (the same for every guest)');
      // two pairs: a great ray with a smaller one gliding beside it, the pairs on opposite sides of the circuit
      let pairOk = true, apart = 1e9, side = 1e9;
      for (let t = 0; t < 140; t += 5) {
        const q = []; for (let k = 0; k < 4; k++) q.push(W.rayState(53, t, k, 4, loop, [0, 0, 0, 0, 0, 0, 0, 0]).slice());
        const d01 = Math.hypot(q[0][0] - q[1][0], q[0][2] - q[1][2]), d23 = Math.hypot(q[2][0] - q[3][0], q[2][2] - q[3][2]);
        if (d01 > 34 || d23 > 34 || q[1][7] >= q[0][7] || q[3][7] >= q[2][7]) pairOk = false;
        side = Math.min(side, d01, d23);
        for (const i of [0, 1]) for (const j of [2, 3]) apart = Math.min(apart, Math.hypot(q[i][0] - q[j][0], q[i][2] - q[j][2]));
      }
      check(pairOk && side > 1.1 * W.RAY.maxScale / 2 && apart > 100, `two pairs, a great ray and a smaller one beside it (${side.toFixed(0)}–34 blocks apart), the pairs on opposite sides (${apart.toFixed(0)} apart at the nearest)`);
    }
  }
  check(closed && smooth, 'the circuit is closed and turns smoothly in every world');
  check(worst >= 0, `clear of the isles' rock by the span's half + 4 in ${worlds} worlds (the tightest: ${worst.toFixed(1)} blocks to spare ${JSON.stringify(worstAt)})`);
  // the real blocks of seed 53 (the bridges' pillars, the falls, roots and vines under the isles): nothing solid within
  // a ray's body (its span's half + 1 round its line, ±2 in height) along a whole lap of all four
  {
    const t0 = Date.now(), g = V.makeGen('overworld', 53, { vgen: 11 }), I = V.IslesGen.list(g), loop = W.rayLoop(I), CH = new Map(), RT = V.R.T, FL = V.F;
    const blk = (x, y, z) => { if (y < 0 || y > 255) return 0; const k = (x >> 4) + ',' + (z >> 4); let c = CH.get(k); if (!c) { c = g.generate(x >> 4, z >> 4); CH.set(k, c); } return c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)]; };
    const a = [0, 0, 0, 0, 0, 0, 0, 0];
    let solid = 0, soft = 0, first = null;
    for (let k = 0; k < 4; k++) for (let t = 0; t < loop.L / W.RAY.speed; t += 0.6) {
      const st = W.rayState(53, t, k, 4, loop, a), half = st[7] * W.RAY.span / 2 + 1;
      for (let ox = -half; ox <= half; ox += 1) for (let oz = -half; oz <= half; oz += 1) {
        if (ox * ox + oz * oz > half * half) continue;
        const x = Math.floor(st[0] + ox), z = Math.floor(st[2] + oz);
        for (let y = Math.floor(st[1] - 2); y <= Math.floor(st[1] + 2); y++) {
          const b = blk(x, y, z); if (!b) continue;
          const f = RT.flags[b];
          if ((f & FL.SOLID) && !(f & FL.FLUID) && !(f & FL.LEAVES)) { solid++; if (!first) first = [k, +t.toFixed(1), x, y, z, V.R.types[RT.type[b]].name]; } else soft++;
        }
      }
    }
    console.log(`     the rays' bodies along a lap: ${CH.size} chunks generated in ${((Date.now() - t0) / 1000).toFixed(1)} s, ${soft} soft blocks met (water, leaves, vines)`);
    check(solid === 0, `nothing solid in the rays' way in seed 53's real blocks (${solid}${first ? ' — the first: ' + JSON.stringify(first) : ''})`);
  }
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
