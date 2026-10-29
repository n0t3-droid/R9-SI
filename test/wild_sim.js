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
//  f-wild2 (R50-10, docs/superpowers/plans/2026-10-23-f-wild2.md): 2–3× the birds at t-wild's CPU + 30 %; the density
//  field and its impostor (the cloud's optical depth from the boids' density and their wings' turn); the figures
//  (ribbon, waist, split, ball — seeded, measured on the flock); the ray's wing curve (a slow wave from the root to the
//  tip) and its body (thick, a head, a tail, a pale underside, glowing edges, not a boomerang); the pass at dusk (once a
//  day, the same for every guest in the cell, within 40 blocks of every eye in it, clear of seed 53's real ground)
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
  check(W.CAPS.murm[1] === 0 && W.CAPS.ray[1] === 0 && W.CAPS.murm[2] >= 160 && W.CAPS.murm[4] <= 900 && W.CAPS.murm[3] >= 280, `Low: no murmuration, no rays; the murmuration 160–900 boids from Balanced (${W.CAPS.murm.join(' ')})`);
  // each boid of the murmuration is drawn as a little party of birds (wildgpu.js 'flock': MURM_K birds round it, in its
  // own frame, flattened into its sheet): thousands of birds in the sky for the cost of a few hundred boids
  check(W.MURM_K >= 8 && W.MURM_K <= 24 && W.CAPS.murm[3] * W.MURM_K >= 5000, `the murmuration on High: ${W.CAPS.murm[3]} boids × ${W.MURM_K} birds = ${W.CAPS.murm[3] * W.MURM_K} birds in the sky`);
  // f-wild2 (R50-10): 2–3× t-wild's birds on Balanced and up (t-wild: 160 / 300 / 360 boids × 20 — the release's table
  // said 200 / 300 / 360), within the same cost tier (the step's cost: § 2)
  { const tw = [0, 0, 200, 300, 360], r = [2, 3, 4].map(t => W.CAPS.murm[t] / tw[t]); check(r.every(q => q >= 2 && q <= 3), `2–3× t-wild's birds on Balanced, High, Ultra (×${r.map(q => q.toFixed(1)).join(' ×')}: ${[2, 3, 4].map(t => W.CAPS.murm[t] * W.MURM_K).join(' / ')} birds)`); }
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
// (f-wild2: the murmuration flies its figures — every bird its own place along the figure's spine, W.murmTargets — as
//  the game's actor does; a flock without the roost (a shoal) only its target)
const run = (n, seed, secs, o) => {
  const f = new W.Flock(n, seed, o);
  f.place(stage.x, stage.y, stage.z, 12);
  const dt = 1 / 30, steps = Math.round(secs / dt), S = W.murmPlaces ? W.murmPlaces(n) : null;
  if (f.P.roost && W.murmTargets) f.bofs = new Float32Array(n * 3);
  let nan = false, vlo = 1e9, vhi = 0, far = 0, spreadMax = 0, own = 0; const OWN = new Float32Array(n);
  for (let s = 0; s < steps; s++) {
    W.murmTarget(4242, s * dt, stage, f.tgt);
    if (f.bofs) W.murmTargets(4242, s * dt, S, n, f.bofs, f.tgt);
    f.step(dt);
    if (s > steps / 4 && (s & 7) === 0) {
      const c = f.centroid();
      spreadMax = Math.max(spreadMax, f.spread());
      for (let i = 0; i < n; i++) {
        const x = f.pos[i * 3], y = f.pos[i * 3 + 1], z = f.pos[i * 3 + 2];
        if (!Number.isFinite(x + y + z)) nan = true;
        const v = Math.hypot(f.vel[i * 3], f.vel[i * 3 + 1], f.vel[i * 3 + 2]); vlo = Math.min(vlo, v); vhi = Math.max(vhi, v);
        far = Math.max(far, Math.hypot(x - c[0], y - c[1], z - c[2]));
        // (how far a bird is from its own place in the figure, horizontally — the median of a frame: the birds can not
        //  hover, they swirl round their places (the pull starts 15 out), and a morph carries them across for a while)
        if (f.bofs) OWN[i] = Math.hypot(x - f.tgt[0] - f.bofs[i * 3], z - f.tgt[2] - f.bofs[i * 3 + 2]);
      }
      if (f.bofs) { const o = Array.from(OWN).sort((p, q) => p - q); own = Math.max(own, o[n >> 1]); }
    }
  }
  return { f, nan, vlo, vhi, far, spreadMax, own };
};
{
  const A = run(300, 7, 60);
  const P = A.f.P;
  check(!A.nan, 'no NaN in 60 s of 300 birds');
  check(A.vlo >= P.vmin - 0.05 && A.vhi <= P.vmax + 0.05, `every bird flies between ${P.vmin} and ${P.vmax} blocks/s (${A.vlo.toFixed(2)} – ${A.vhi.toFixed(2)})`);
  let out = 0, blo = 1e9, bhi = -1e9; for (let i = 0; i < 300; i++) { const x = A.f.pos[i * 3], y = A.f.pos[i * 3 + 1], z = A.f.pos[i * 3 + 2]; blo = Math.min(blo, y); bhi = Math.max(bhi, y); if (Math.abs(x - stage.x) > 140 || Math.abs(z - stage.z) > 140 || y < stage.y - 30 || y > stage.y + 40) out++; }
  check(out === 0, `bounded: every bird within the stage's box after 60 s (${out} outside; heights ${(blo - stage.y).toFixed(0)} … +${(bhi - stage.y).toFixed(0)})`);
  check(blo > stage.y - 22 && bhi < 112, `over the water and under the isles' lowest rock (115): ${blo.toFixed(0)} … ${bhi.toFixed(0)}`);
  // (f-wild2: one flock that takes the figures' shapes — a ribbon 200 long, two balls apart — so the cohesion is each
  //  bird near its own place in the figure, and no bird lost far from the cloud)
  check(A.own < 50 && A.far < 150, `cohesive: the birds swirl round their places in the figure (half of them within ${A.own.toFixed(1)} blocks of it at the worst moment), none lost (the farthest ${A.far.toFixed(1)} from the middle)`);
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
    const S = W.murmPlaces ? W.murmPlaces(240) : null; if (S) f.bofs = new Float32Array(240 * 3);
    const axes = [];
    for (let s = 0; s < 30 * 40; s++) { W.murmTarget(99, s / 30, stage, f.tgt); if (S) W.murmTargets(99, s / 30, S, 240, f.bofs, f.tgt); f.step(1 / 30); if (s % 150 === 149) axes.push(f.axis()); }
    let turned = 0; for (let k = 1; k < axes.length; k++) { const a = axes[k - 1], b = axes[k], d = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2]); if (d < 0.9) turned++; }
    check(turned >= 2, `the cloud's shape turns (its long axis swung over 25° ${turned} times in 40 s)`);
  }
  // the cost (f-wild2): the murmuration's CPU per frame stays in its tier — this flock (High's boids, its figures, the
  // game's step rate when it is seen from afar: W.MURM_HZ[1]) against t-wild's (300 boids, its parameters, 30 steps a
  // second), measured in turns in this process: ≤ 1.3 ×. CPU time, the best of rounds (the machine is shared)
  {
    const TW = { r: 11, maxC: 32, sepR: 6, stride: 2, tgtR: 40, bandY: 6, lobes: 3 };
    const mk = (n, o, fig) => { const f = new W.Flock(n, 5, o); f.place(stage.x, stage.y, stage.z, 12); const S = fig ? W.murmPlaces(n) : null; if (S) f.bofs = new Float32Array(n * 3); return { f, S, n, t: 0 }; };
    const adv = (q, k, dt) => { for (let s = 0; s < k; s++) { q.t += dt; W.murmTarget(1, q.t, stage, q.f.tgt); if (q.S) W.murmTargets(1, q.t, q.S, q.n, q.f.bofs, q.f.tgt); else if (q.f.lofs) W.murmLobes(1, q.t, q.f.lobes, 34, q.f.lofs); q.f.step(dt); } };
    const hz = W.MURM_HZ || [30, 30], A0 = mk(300, TW, false), B0 = mk(W.CAPS.murm[3], {}, true);
    adv(A0, 300, 1 / 30); adv(B0, 300, 1 / hz[1]);
    const cpu = (q, dt) => { const c0 = process.cpuUsage(); adv(q, 30, dt); const c1 = process.cpuUsage(c0); return (c1.user + c1.system) / 1000 / 30; };
    let a = 1e9, b = 1e9; for (let r = 0; r < 9; r++) { a = Math.min(a, cpu(A0, 1 / 30)); b = Math.min(b, cpu(B0, 1 / hz[1])); }
    const fa = a * 30 / 60, fb = b * hz[1] / 60;   // (per frame at 60 frames a second)
    console.log(`     a step: t-wild's 300 boids ${a.toFixed(3)} ms at 30 a second · ${W.CAPS.murm[3]} boids ${b.toFixed(3)} ms at ${hz[1]} a second → per frame ${fa.toFixed(3)} · ${fb.toFixed(3)} ms`);
    check(fb <= fa * 1.3, `the murmuration's CPU per frame on High ≤ t-wild's + 30 % (×${(fb / fa).toFixed(2)})`);
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

// ================================================================ f-wild2 (R50-10): the wild reads at its distance
// ---------------------------------------------------------------- 7. the density field and its impostor
{
  check(typeof W.puffTau === 'function' && typeof W.birdsVisible === 'function' && !!W.PUFF, 'the density cloud: W.PUFF, W.puffTau, W.birdsVisible');
  // each boid counts its neighbours while it steers (Flock.dens, smoothed): the ball's core meets more than its rim
  const n = W.CAPS.murm[3], f = new W.Flock(n, 9), S = W.murmPlaces(n); f.bofs = new Float32Array(n * 3); f.place(stage.x, stage.y, stage.z, 12);
  for (let s = 0; s < 30 * 30; s++) { W.murmTarget(5, s / 30, stage, f.tgt); W.murmTargets(5, s / 30, S, n, f.bofs, f.tgt, 'ball'); f.step(1 / 30); }
  const c = f.ctr, sp = f.spread(); let ci = 0, cn = 0, ri = 0, rn = 0;
  for (let i = 0; i < n; i++) { const d = Math.hypot(f.pos[i * 3] - c[0], f.pos[i * 3 + 1] - c[1], f.pos[i * 3 + 2] - c[2]); if (d < 0.5 * sp) { ci += f.dens[i]; cn++; } else if (d > 1.3 * sp) { ri += f.dens[i]; rn++; } }
  // (what the eye gets: the impostors' depth in the core against the rim's — the core is darker by ≥ 1.8×)
  const tc = W.puffTau ? W.puffTau(ci / Math.max(1, cn), 0.5, 2, W.MURM_K, n) : 0, tr = W.puffTau ? W.puffTau(ri / Math.max(1, rn), 0.5, 2, W.MURM_K, n) : 1;
  check(!!f.dens && cn > 20 && rn > 5 && ci / cn > ri / rn && tc >= 1.8 * tr, `the density field: the core's boids meet more neighbours than the rim's (${(ci / Math.max(1, cn)).toFixed(1)} against ${(ri / Math.max(1, rn)).toFixed(1)}; ${cn} and ${rn} boids) — the core's impostors ${(tc / Math.max(1e-6, tr)).toFixed(2)}× as deep`);
  if (W.puffTau && W.PUFF) {
    // the impostor's optical depth: grows with the density and with the wings turned to the eye; bounded; nothing where
    // every bird of the party is drawn (up close), the party's share where only its sparkle birds are left
    const T = W.puffTau, K = W.MURM_K, P = W.PUFF;
    check(T(30, 0.5, P.kMin, K, n) > T(10, 0.5, P.kMin, K, n) && T(10, 0.5, P.kMin, K, n) > T(3, 0.5, P.kMin, K, n), 'denser → darker');
    check(T(18, 1, P.kMin, K, n) > T(18, 0.1, P.kMin, K, n) * 1.8, 'a banked party (its wings to the eye) darker than a level one seen edge-on: the turning wave sweeps through as a dark band');
    check(T(18, 0.5, K, K, n) === 0 && T(18, 0.5, P.kMin, K, n) > 0, 'no impostor where every bird is drawn; it carries the birds not drawn');
    let mx = 0; for (let d = 0; d < 80; d += 3) for (let v = 0; v <= 1; v += 0.25) mx = Math.max(mx, T(d, v, P.kMin, K, n));
    check(mx > 0.3 && mx < 10, `bounded (≤ 10: smaller impostors since 29 Oct carry their depth on less area; the densest party's depth at its middle ${mx.toFixed(2)})`);
    const B = W.birdsVisible;
    check(B(20) === K && B(P.kFar[0]) === K && Math.abs(B(P.kFar[1]) - P.kMin) < 1e-6 && B(400) === P.kMin && B(130) < K && B(130) > P.kMin, `birds as dashes up close (${K} within ${P.kFar[0]} blocks), the cloud beyond (${P.kMin} sparkle birds from ${P.kFar[1]})`);
    check(Math.abs(T(18, 0.5, P.kMin, K, W.CAPS.murm[2]) / T(18, 0.5, P.kMin, K, n) - n / W.CAPS.murm[2]) < 1e-6, 'Balanced\'s fewer boids each carry more: the same cloud');
  }
}

// ---------------------------------------------------------------- 8. the figures: ribbons, a waist, a ball that splits
{
  check(Array.isArray(W.FIGS) && ['ball', 'ribbon', 'waist', 'split'].every(k => W.FIGS.includes(k)), `the figures: ${W.FIGS && W.FIGS.join(', ')}`);
  if (W.FIGS && W.murmFigure) {
    let same = true; const seen = new Set();
    for (let t = 0; t < 600; t += 1.7) { const a = W.murmFigure(53, t), b = W.murmFigure(53, t); if (JSON.stringify(a) !== JSON.stringify(b)) same = false; seen.add(a.a); }
    check(same && W.FIGS.every(k => seen.has(k)), `the figures are the clock's (the same for every guest); all ${seen.size} come within 10 minutes`);
    const o1 = new Float32Array(30), o2 = new Float32Array(30), S10 = W.murmPlaces(10);
    W.murmTargets(53, 77.7, S10, 10, o1, [345, 86, 150]); W.murmTargets(53, 77.7, S10, 10, o2, [345, 86, 150]);
    check(o1.every((v, i) => v === o2[i]) && o1.some(v => v !== 0), 'each bird\'s place in the figure is the same for every guest');
    // the heights: every place between the water and the isles' rock (the flock never climbs into the isles)
    let ylo = 1e9, yhi = -1e9; const o = new Float32Array(720 * 3), S = W.murmPlaces(720);
    for (let t = 0; t < 400; t += 3.1) { const tg = [345, 86 + 8 * Math.sin(t), 150]; W.murmTargets(53, t, S, 720, o, tg); for (let i = 0; i < 720; i++) { ylo = Math.min(ylo, tg[1] + o[i * 3 + 1]); yhi = Math.max(yhi, tg[1] + o[i * 3 + 1]); } }
    check(ylo >= V.C.SEA + 8 && yhi <= 108, `every place between the water and the isles' rock (${ylo.toFixed(0)} … ${yhi.toFixed(0)})`);
    // each figure's shape, measured on the flock (High's boids, 40 s in the figure)
    const shape = (fig) => {
      const n = W.CAPS.murm[3], f = new W.Flock(n, 21), S = W.murmPlaces(n); f.bofs = new Float32Array(n * 3); f.place(stage.x, stage.y, stage.z, 12);
      for (let s = 0; s < 30 * 40; s++) { W.murmTarget(8, s / 30, stage, f.tgt); W.murmTargets(8, s / 30, S, n, f.bofs, f.tgt, fig); f.step(1 / 30); }
      const c = f.ctr, ax = f.axis(), hl = Math.hypot(ax[0], ax[2]) || 1, ux = ax[0] / hl, uz = ax[2] / hl, along = [];
      let s1 = 0, s2 = 0;
      for (let i = 0; i < n; i++) { const x = f.pos[i * 3] - c[0], z = f.pos[i * 3 + 2] - c[2], a = x * ux + z * uz, b = -x * uz + z * ux; along.push(a); s1 += a * a; s2 += b * b; }
      along.sort((p, q) => p - q);
      const len = along[Math.floor(n * 0.95)] - along[Math.floor(n * 0.05)], m0 = (along[Math.floor(n * 0.95)] + along[Math.floor(n * 0.05)]) / 2;
      const mid = along.filter(a => Math.abs(a - m0) < len * 0.1).length / n;
      return { len, aspect: Math.sqrt(s1 / Math.max(1e-6, s2)), mid, spread: f.spread() };
    };
    const R = shape('ribbon'), Sp = shape('split'), Wa = shape('waist'), Ba = shape('ball');
    console.log('     figures: ' + JSON.stringify({ ribbon: R, split: Sp, waist: Wa, ball: Ba }, (k, v) => (typeof v === 'number' ? +v.toFixed(2) : v)));
    check(R.aspect > 2.5 && R.len > 110, `the ribbon: long and narrow (${R.len.toFixed(0)} blocks, ${R.aspect.toFixed(1)} : 1)`);
    check(Sp.len > 110 && Sp.mid < 0.08, `a ball that splits: two masses ${Sp.len.toFixed(0)} apart, ${(Sp.mid * 100).toFixed(1)} % of the birds in the middle fifth`);
    check(Wa.mid < 0.16 && Wa.mid > Sp.mid, `the waist: pinched in the middle (${(Wa.mid * 100).toFixed(1)} % there), less parted than the split`);
    check(Ba.spread < 0.65 * R.spread && Ba.len < 0.6 * R.len, `the ball: compact (spread ${Ba.spread.toFixed(0)} against the ribbon's ${R.spread.toFixed(0)})`);
  }
}

// ---------------------------------------------------------------- 9. the ray as an animal: the wing curve, the body
{
  const Wg = W.rayWing, R = W.RAY;
  check(typeof Wg === 'function', 'the wing curve W.rayWing(s, phase)');
  if (Wg) {
    // the root still, the tips beating ±25° and more, the wave running out from the root to the tip
    let root = 0, tip = 0; for (let p = 0; p < 6.3; p += 0.05) { root = Math.max(root, Math.abs(Wg(0, p))); tip = Math.max(tip, Math.abs(Wg(1, p) - Wg(1, p + Math.PI)) / 2); }
    check(root < 1e-9 && tip >= 25 * Math.PI / 180 && tip <= 45 * Math.PI / 180, `the root still, the tips beat ±${(tip * 180 / Math.PI).toFixed(0)}°`);
    const peak = (s) => { let best = -1e9, at = 0; for (let p = 0; p < 6.283; p += 0.005) { const v = Wg(s, p) - Wg(s, p + Math.PI); if (v > best) { best = v; at = p; } } return at; };
    const lag = ((peak(1) - peak(0.3)) / (2 * Math.PI) + 2) % 1;
    check(lag > 0.06 && lag < 0.35, `the wave runs out from the root to the tip (the tip ${(lag * 100).toFixed(0)} % of a beat behind)`);
    // (a curve, no kink: the bend's change from one section to the next changes gently — the second difference over
    //  sections 5 % apart under 0.6°)
    let kink = 0; for (let p = 0; p < 6.3; p += 0.3) for (let s = 0.05; s <= 0.95001; s += 0.05) kink = Math.max(kink, Math.abs(Wg(s + 0.05, p) - 2 * Wg(s, p) + Wg(s - 0.05, p)));
    check(kink < 0.6 * Math.PI / 180, `a curved wing, no kink (the bend's change varies by ${(kink * 180 / Math.PI).toFixed(2)}° between sections 5 % apart)`);
  }
  check(R.period >= 3.5 && R.period <= 6, `a slow beat (${R.period} s)`);
}
{
  require(__dirname + '/../src/main/wildgpu.js');
  const WG = V.WildGPU, m = WG.mesh('ray'), VS = 11;
  let top = -1e9, bot = 1e9, zmin = 1e9, zmax = -1e9, bz0 = 1e9, bz1 = -1e9, glowEdge = 0, wBody = 0, topL = 0, topN = 0, belL = 0, belN = 0, area = 0, cxs = 0;
  for (let i = 0; i < m.length; i += VS) {
    const x = m[i], y = m[i + 1], z = m[i + 2], ny = m[i + 4], L = 0.2126 * m[i + 6] + 0.7152 * m[i + 7] + 0.0722 * m[i + 8];
    if (Math.abs(x) < 0.04 && z < 0.3) { top = Math.max(top, y); bot = Math.min(bot, y); bz0 = Math.min(bz0, z); bz1 = Math.max(bz1, z); }
    zmin = Math.min(zmin, z); zmax = Math.max(zmax, z);
    if (ny > 0.6) { topL += L; topN++; } else if (ny < -0.6) { belL += L; belN++; }
    if (m[i + 10] > 0.3 && Math.abs(x) > 0.15) glowEdge++;
    if (Math.abs(x) < 0.08 && m[i + 9] > 0.02) wBody++;
  }
  // the planform from above (the top surface's triangles on x-z): its area, and where it lies across the span
  for (let i = 0; i + 3 * VS <= m.length; i += VS * 3) {
    if (m[i + 4] + m[i + VS + 4] + m[i + 2 * VS + 4] < 1.5) continue;
    const ax = m[i], az = m[i + 2], bx = m[i + VS], bz = m[i + VS + 2], cx = m[i + 2 * VS], cz = m[i + 2 * VS + 2];
    const a = Math.abs((bx - ax) * (cz - az) - (cx - ax) * (bz - az)) / 2; area += a; cxs += a * Math.abs(ax + bx + cx) / 3;
  }
  const thick = top - bot, chord = bz1 - bz0, xc = cxs / Math.max(1e-6, area);
  check(thick >= 0.1, `a body with thickness: ${(thick * 100).toFixed(1)} % of the span at its middle (t-wild's: 8.9 %)`);
  check(chord >= 0.4 && zmin < -0.28 && zmax > 0.6, `a head and a tail: the body ${(chord * 100).toFixed(0)} % of the span long, from ${zmin.toFixed(2)} (the head's fins) to ${zmax.toFixed(2)} (the tail)`);
  check(area >= 0.22 && xc <= 0.24, `an animal's outline, not a boomerang: the area ${area.toFixed(3)} of the span², its weight ${xc.toFixed(2)} out from the body`);
  check(belN > 50 && topN > 50 && belL / belN >= 2 * topL / topN, `a pale underside (its mean luminance ${(belL / Math.max(1, belN)).toFixed(3)} against the back's ${(topL / Math.max(1, topN)).toFixed(3)})`);
  check(glowEdge >= 40, `the glow along the wing edges (${glowEdge} glowing vertices out on the wings)`);
  check(wBody === 0, `the body does not beat: no wing weight on it (${wBody})`);
}

// ---------------------------------------------------------------- 10. the pass at dusk — a young ray within 40 blocks
{
  check(typeof W.passTime === 'function' && typeof W.passPlan === 'function' && typeof W.passAt === 'function', 'the pass: W.passTime, passPlan, passAt');
  if (W.passPlan) {
    let inWin = true, differ = false; const tA = W.passTime(53, 4);
    for (let d = 0; d < 40; d++) { const t = W.passTime(53, d); if (!(t >= 11300 && t <= 12400)) inWin = false; if (t !== tA) differ = true; }
    check(inWin && differ && W.passTime(53, 9) === W.passTime(53, 9), 'once a dusk, between 11 300 and 12 400 ticks, another moment each day, the same for every guest');
    const t0 = Date.now(), g = V.makeGen('overworld', 53, { vgen: 11 }), I = V.IslesGen.list(g), loop = W.rayLoop(I);
    const CH = new Map(), RT = V.R.T, FL = V.F;
    const blk = (x, y, z) => { x = Math.floor(x); y = Math.floor(y); z = Math.floor(z); if (y < 0 || y > 255) return 0; const k = (x >> 4) + ',' + (z >> 4); let c = CH.get(k); if (!c) { c = g.generate(x >> 4, z >> 4); CH.set(k, c); } return c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)]; };
    // (the top a ray must clear under the isles (their rock from 115): the highest block below 112 — the ground, leaves,
    //  the lake's water; a waterfall's falling water above the sea does not count, the ray glides through its spray)
    const SEA = V.C.SEA, TM = new Map(), topAt = (x, z) => { const k = x * 65536 + z; let t = TM.get(k); if (t !== undefined) return t; t = 64; for (let y = 112; y > 30; y--) { const b = blk(x, y, z); if (!b) continue; if ((RT.flags[b] & FL.FLUID) && y > SEA + 2) continue; t = y + 1; break; } TM.set(k, t); return t; };
    const seed = (53 ^ 0x7a11d) >>> 0, day = 4, Tn = (day * 24000 + W.passTime(seed, day)) / 20;
    const places = { beach: [236, 36], pier: [271, 72], lighthouse: [478, 128], meadow: [226, -122] };
    let worstNear = 0, worstClear = 1e9, solid = 0, firstSolid = null, ends = 0, scales = [], durs = [], nearCentre = 0;
    for (const [name, [px, pz]] of Object.entries(places)) {
      // (two players in the same cell: the place and the cell's far corner)
      const cl = W.PASS.cell, md = (v) => ((v % cl) + cl) % cl, qx = Math.floor(px / cl) * cl + (md(px) < cl / 2 ? cl - 2 : 2), qz = Math.floor(pz / cl) * cl + (md(pz) < cl / 2 ? cl - 3 : 3);
      const ey = topAt(px, pz) + 1.62, A = W.passPlan(seed, day, [px, ey, pz], loop, topAt), B = W.passPlan(seed, day, [qx, topAt(qx, qz) + 1.62, qz], loop, topAt);
      check(!!A && JSON.stringify(A) === JSON.stringify(B), `${name}: a pass planned for the cell, the same for two players in it`);
      if (!A) continue;
      const st = [0, 0, 0, 0, 0, 0, 0, 0], cs = [0, 0, 0, 0, 0, 0, 0, 0];
      // the ends: on the circuit where the ray's slot is
      W.passAt(A, loop, seed, A.T0, st); W.rayState(seed, A.T0, A.k, 4, loop, cs); ends = Math.max(ends, Math.hypot(st[0] - cs[0], st[1] - cs[1], st[2] - cs[2]));
      W.passAt(A, loop, seed, A.T1, st); W.rayState(seed, A.T1, A.k, 4, loop, cs); ends = Math.max(ends, Math.hypot(st[0] - cs[0], st[1] - cs[1], st[2] - cs[2]));
      scales.push(A.scale); durs.push(A.T1 - A.T0);
      // the closest approach for every eye in the cell (a 4-block grid, eyes on the ground)
      const cell = W.PASS.cell, cx = Math.floor(px / cell) * cell, cz = Math.floor(pz / cell) * cell;
      for (let ex = cx; ex <= cx + cell; ex += 4) for (let ez = cz; ez <= cz + cell; ez += 4) {
        const eyY = topAt(ex, ez) + 1.62; let dmin = 1e9;
        for (let t = A.T0; t <= A.T1; t += 0.25) { W.passAt(A, loop, seed, t, st); dmin = Math.min(dmin, Math.hypot(st[0] - ex, st[1] - eyY, st[2] - ez)); }
        worstNear = Math.max(worstNear, dmin);
      }
      { let dmin = 1e9; for (let t = A.T0; t <= A.T1; t += 0.25) { W.passAt(A, loop, seed, t, st); dmin = Math.min(dmin, Math.hypot(st[0] - (cx + cell / 2), st[1] - (topAt(cx + cell / 2, cz + cell / 2) + 1.62), st[2] - (cz + cell / 2))); } nearCentre = Math.max(nearCentre, dmin); }
      // clear of the ground, the trees and the water along the whole way (its centre ≥ 3 over the top), nothing solid in
      // its body's way near the ground (the disc of its half span + 0.5, ±1.5 high)
      for (let t = A.T0; t <= A.T1; t += 0.5) {
        W.passAt(A, loop, seed, t, st);
        const top = topAt(st[0], st[2]); worstClear = Math.min(worstClear, st[1] - top);
        if (st[1] - top > 14) continue;
        const half = st[7] / 2 + 0.5;
        for (let ox = -half; ox <= half; ox += 1) for (let oz = -half; oz <= half; oz += 1) {
          if (ox * ox + oz * oz > half * half) continue;
          for (let y = Math.floor(st[1] - 1.5); y <= Math.floor(st[1] + 1.5); y++) { const b = blk(st[0] + ox, y, st[2] + oz); if (b && (RT.flags[b] & FL.SOLID) && !(RT.flags[b] & FL.FLUID)) { solid++; if (!firstSolid) firstSolid = [name, +t.toFixed(1), Math.floor(st[0] + ox), y, Math.floor(st[2] + oz), V.R.types[RT.type[b]].name]; } }
        }
      }
      check(Math.abs(A.Tn - Tn) < 1e-6 && A.T0 < A.Tn && A.Tn < A.T1, `${name}: the closest moment is the day's (${A.T0.toFixed(0)} → ${A.Tn.toFixed(0)} → ${A.T1.toFixed(0)} s)`);
    }
    console.log(`     the passes: ${CH.size} chunks in ${((Date.now() - t0) / 1000).toFixed(1)} s · scales ${scales.map(v => v.toFixed(1)).join(' ')} · ${durs.map(v => v.toFixed(0)).join(' / ')} s`);
    check(worstNear <= 40, `within 40 blocks of every eye in the cell (the farthest eye's closest approach ${worstNear.toFixed(1)}; the cell's middle ${nearCentre.toFixed(1)})`);
    check(nearCentre <= 15, `close enough that its size is felt: ${nearCentre.toFixed(1)} blocks from the middle of the cell`);
    check(ends < 0.6, `it leaves the circuit and rejoins it at its slot (${ends.toFixed(2)} blocks off at the ends)`);
    check(scales.every(s => s >= 6 && s <= 10), `6–10 blocks across (${scales.map(v => v.toFixed(1)).join(', ')})`);
    check(durs.every(d => d >= 25 && d <= 130), `the pass lasts ${durs.map(v => v.toFixed(0)).join(', ')} s`);
    check(worstClear >= 3, `clear of the ground, the trees and the water all the way (${worstClear.toFixed(1)} blocks at the least)`);
    check(solid === 0, `nothing solid in its body's way near the ground (${solid}${firstSolid ? ' — the first: ' + JSON.stringify(firstSolid) : ''})`);
    check(W.passPlan(seed, day, [1400, 80, 1200], loop, topAt) === null, 'no pass far from the isles (it would take minutes to come)');
  }
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
