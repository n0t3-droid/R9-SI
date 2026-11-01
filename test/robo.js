// x-robo · the people's motion borrowed from robotics and physics (src/main/folkrobo.js, VR.Robo):
//   a  the two-bone leg solve: reach, limits, the knee bends forward, FK∘IK = identity
//   b  feet planted: a foot on a stair step lifts, the hips drop when the ground falls away, never stretched past reach
//   c  ground under a foot: flat block top, a slab, a stair's two heights, nothing → NaN
//   d  ORCA: 40 agents swap across a circle, 1000 steps — no two overlap, all arrive; 40 agents crossing at random
//   e  the player: villagers yield fully, nobody walks into the player standing in a corridor of walkers
//   f  springs: bounded under a step input, settle; a pendulum excited by a stop swings and comes to rest
//   g  the gaze: fixations 0.3–2.5 s, blinks 8–30 a minute, a big gaze shift blinks more often than not
//   h  tiers: Very Low (anim off) 0, Low 1 (avoidance), Balanced and up 2
// usage: bash test/wt_run.sh robo.js 300
const V = require('./load_shared.js');
globalThis.VR = V;
require('../src/main/folkrobo.js');
const Rb = V.Robo;
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
let rs = 7; const rnd = () => { rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0; return rs / 4294967296; };
check(!!Rb, 'VR.Robo exists');
if (!Rb) { console.log('FAILED ' + fails); process.exit(1); }

// ---- a: two-bone IK
{
  const Lt = 13, Ls = 15, o = [0, 0], f = [0, 0];
  let worst = 0, kneeOk = true;
  for (let i = 0; i < 400; i++) {
    const ang = (rnd() - 0.5) * 1.6, d = 4 + rnd() * 23;
    const fx = Math.sin(ang) * d, fy = Math.cos(ang) * d;
    Rb.legIK(Lt, Ls, fx, fy, o); Rb.legFK(Lt, Ls, o[0], o[1], f);
    worst = Math.max(worst, Math.hypot(f[0] - fx, f[1] - fy));
    if (o[1] < -1e-9 || o[1] > Math.PI) kneeOk = false;
  }
  check(worst < 1e-6, `FK(IK(foot)) = foot within reach (worst ${worst.toExponential(1)})`);
  check(kneeOk, 'the knee bends one way only (0 … π)');
  Rb.legIK(Lt, Ls, 40, 40, o); Rb.legFK(Lt, Ls, o[0], o[1], f);
  check(Math.hypot(f[0], f[1]) <= Lt + Ls + 1e-6 && o[1] >= 0 && o[1] < 0.05, 'out of reach: the leg straight toward the target, no NaN');
  Rb.legIK(Lt, Ls, 0, 0, o);
  check(isFinite(o[0]) && isFinite(o[1]), 'a foot at the hip: finite');
  // the knee is in front of the hip–foot line (a human knee)
  Rb.legIK(Lt, Ls, 0, 22, o);
  check(Math.sin(o[0]) * Lt > 0, 'the knee comes forward');
}

// ---- b: plant
{
  const G = V.FolkAnim.gait({ unit: 32, scale: 1, hip: 29, thigh: 14, shin: 15, stride: 0.6 });
  const pose = () => { const P = {}; for (const j of V.FolkAnim.JOINTS) P[j] = [0, 0, 0, 0, 0, 0]; return P; };
  const footY = (P, s) => { const f = [0, 0]; Rb.legFK(G.thigh, G.shin, P['leg_' + s][0], -P['shin_' + s][0], f); return G.hip + P['leg_' + s][4] - f[1]; };
  let P = pose(); Rb.plant(G, P, 0, 0);
  check(Math.abs(footY(P, 'l')) < 1e-6 && Math.abs(footY(P, 'r')) < 1e-6, 'flat ground: both feet on it');
  P = pose(); Rb.plant(G, P, 0, 8);
  check(Math.abs(footY(P, 'l')) < 0.05 && Math.abs(footY(P, 'r') - 8) < 0.05, `a stair step under the right foot: it stands 8 units up (${footY(P, 'r').toFixed(2)})`);
  check(-P.shin_r[0] > 0.3 && Math.abs(P.hips[4]) < 0.05, 'the right knee bends, the hips stay');
  P = pose(); Rb.plant(G, P, -6, -6);
  check(Math.abs(P.hips[4] + 6) < 0.05 && Math.abs(footY(P, 'l') + 6) < 0.05, `the ground falls away under both: the hips drop with it (${P.hips[4].toFixed(2)})`);
  P = pose(); Rb.plant(G, P, -30, 0);
  check(footY(P, 'l') > -12 && footY(P, 'l') <= 0.01, 'a hole under a foot: no leg stretched off into it');
  // the walk's own pose stays a walk: plant on flat ground changes nothing
  const W = V.FolkAnim.walkPerson(Object.assign(G, { ph: 1.1, S: 0.7 }), 1, {}); const W0 = JSON.stringify(W);
  Rb.plant(G, W, 0, 0);
  let dmax = 0; const W1 = JSON.parse(W0); for (const j in W1) for (let i = 0; i < 6; i++) dmax = Math.max(dmax, Math.abs(W1[j][i] - W[j][i]));
  check(dmax < 1e-6, `flat ground: the walk is untouched (${dmax.toExponential(1)})`);
}

// ---- c: ground under a foot
{
  const R = V.R, by = R.byName;
  const stone = by.stone.defaultState;
  const slabName = Object.keys(by).find(n => /_slab$/.test(n) && R.T.shape[by[n].defaultState] !== undefined);
  const stairName = Object.keys(by).find(n => /_stairs$/.test(n));
  const blocks = new Map(), key = (x, y, z) => x + ',' + y + ',' + z;
  for (let x = -2; x < 6; x++) for (let z = -2; z < 3; z++) blocks.set(key(x, 63, z), stone);
  if (slabName) blocks.set(key(2, 64, 0), by[slabName].defaultState);
  if (stairName) blocks.set(key(4, 64, 0), by[stairName].defaultState);
  const get = (x, y, z) => blocks.get(key(x, y, z)) || 0;
  const C = {};
  check(Math.abs(Rb.footGround(get, 0.5, 64, 0.5, C) - 64) < 1e-6, 'a block top: 64');
  if (slabName) check(Math.abs(Rb.footGround(get, 2.5, 64, 0.5, {}) - 64.5) < 1e-6, `a slab (${slabName}): 64.5`);
  if (stairName) { const a = Rb.footGround(get, 4.2, 64, 0.2, {}), b = Rb.footGround(get, 4.8, 64, 0.8, {}); check(Math.abs(a - b) > 0.4, `a stair (${stairName}): two heights (${a}, ${b})`); }
  check(Number.isNaN(Rb.footGround(get, 20.5, 64, 0.5, {})), 'nothing under the foot: NaN');
  check(Math.abs(Rb.footGround(get, 0.7, 64, 0.5, C) - 64) < 1e-6, 'the cache: the same cell again');
}

// ---- d: ORCA
const runCrowd = (A, steps, dt, extra) => {
  const nb = []; for (let i = 0; i < A.length; i++) nb.push({ x: 0, z: 0, vx: 0, vz: 0, r: 0, resp: 0.5 });
  let minGap = 1e9; const out = [0, 0];
  for (let s = 0; s < steps; s++) {
    const nv = [];
    for (let i = 0; i < A.length; i++) {
      const a = A[i]; let n = 0;
      for (let j = 0; j < A.length; j++) { if (j === i) continue; const b = A[j]; if ((b.x - a.x) ** 2 + (b.z - a.z) ** 2 > 9) continue; const q = nb[n++]; q.x = b.x; q.z = b.z; q.vx = b.vx; q.vz = b.vz; q.r = b.r; q.resp = b.fixed ? 1 : 0.5; }
      if (a.fixed) { nv.push([a.vx, a.vz]); continue; }
      const dx = a.gx - a.x, dz = a.gz - a.z, d = Math.hypot(dx, dz), sp = Math.min(a.vmax, d / 0.5);
      a.pvx = d > 1e-6 ? dx / d * sp : 0; a.pvz = d > 1e-6 ? dz / d * sp : 0;
      Rb.orca(a, nb, n, 2, dt, out); nv.push([out[0], out[1]]);
    }
    for (let i = 0; i < A.length; i++) { const a = A[i]; a.vx = nv[i][0]; a.vz = nv[i][1]; a.x += a.vx * dt; a.z += a.vz * dt; }
    if (extra) extra(s);
    for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) { const a = A[i], b = A[j]; minGap = Math.min(minGap, Math.hypot(a.x - b.x, a.z - b.z) - a.r - b.r); }
  }
  return minGap;
};
{
  const A = [];
  for (let i = 0; i < 40; i++) { const t = i / 40 * Math.PI * 2; A.push({ x: Math.cos(t) * 10, z: Math.sin(t) * 10, gx: -Math.cos(t) * 10, gz: -Math.sin(t) * 10, vx: 0, vz: 0, r: 0.3, vmax: 1.4 }); }
  const t0 = process.hrtime.bigint();
  const gap = runCrowd(A, 1000, 1 / 30);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const arrived = A.filter(a => Math.hypot(a.gx - a.x, a.gz - a.z) < 0.3).length;
  check(gap > -0.02, `circle swap (a plaza 20 b across), 40 agents × 1000 steps: no overlap (closest gap ${gap.toFixed(3)} b)`);
  check(arrived >= 38, `… and they arrive (${arrived}/40)`);
  console.log(`  · ${(ms / 1000 / 40 * 1000).toFixed(1)} µs per agent-step`);
  const B = [];
  for (let i = 0; i < 40; i++) { const side = i & 1; B.push({ x: side ? -5 : 5, z: (rnd() - 0.5) * 8, gx: side ? 5 : -5, gz: (rnd() - 0.5) * 8, vx: 0, vz: 0, r: 0.3, vmax: 1.2 + rnd() * 0.4 }); }
  // separate starting places (a market's two crowds)
  for (let i = 0; i < 40; i++) { B[i].z = ((i >> 1) - 10) * 0.75; B[i].x += (i & 2 ? 0.8 : 0) * (i & 1 ? -1 : 1); B[i].gz = B[i].z + (rnd() - 0.5) * 0.3; }
  const gap2 = runCrowd(B, 1000, 1 / 30);
  const arr2 = B.filter(a => Math.hypot(a.gx - a.x, a.gz - a.z) < 0.4).length;
  check(gap2 > -0.02, `two crowds crossing, 40 agents × 1000 steps: no overlap (closest gap ${gap2.toFixed(3)} b)`);
  check(arr2 >= 36, `… and they get through (${arr2}/40)`);
}

// ---- e: the player
{
  const A = [];
  for (let i = 0; i < 12; i++) A.push({ x: -6 - (i % 3) * 0.9, z: ((i / 3) | 0) * 0.8 - 1.2, gx: 8, gz: ((i / 3) | 0) * 0.8 - 1.2, vx: 0, vz: 0, r: 0.3, vmax: 1.4 });
  const pl = { x: 0, z: 0, vx: 0, vz: 0, r: 0.45, fixed: true, gx: 0, gz: 0 };
  A.push(pl);
  let worst = 1e9;
  runCrowd(A, 400, 1 / 30, () => { pl.x = 0; pl.z = 0; for (const a of A) if (a !== pl) worst = Math.min(worst, Math.hypot(a.x, a.z) - a.r - pl.r); });
  check(worst > -0.02, `a stream of walkers round the player standing: nobody walks into the player (gap ${worst.toFixed(3)})`);
  check(A.filter(a => a !== pl && a.x > 7).length >= 10, 'they all get past');
  // a person standing yields to a walker on a collision course: its ORCA velocity is a step aside, not zero
  const s = { x: 0, z: 0, vx: 0, vz: 0, r: 0.3, pvx: 0, pvz: 0, vmax: 0.8 };
  const w = [{ x: -1.5, z: 0.05, vx: 1.3, vz: 0, r: 0.3, resp: 1 }], o = [0, 0];
  Rb.orca(s, w, 1, 2, 1 / 30, o);
  check(Math.hypot(o[0], o[1]) > 0.1 && Math.hypot(o[0], o[1]) <= 0.8 + 1e-9, `a person standing steps aside for an oncoming walker (${o[0].toFixed(2)}, ${o[1].toFixed(2)})`);
}

// ---- f: springs
{
  const s = { x: 0, v: 0 };
  let peak = 0, nan = false;
  for (let i = 0; i < 600; i++) { Rb.spring(s, 1, 9, 0.35, 1 / 60); peak = Math.max(peak, s.x); if (!isFinite(s.x)) nan = true; }
  check(!nan && peak < 1.5 && peak > 1.05, `an underdamped spring overshoots a little (peak ${peak.toFixed(2)}) …`);
  check(Math.abs(s.x - 1) < 1e-3 && Math.abs(s.v) < 1e-2, '… and settles');
  // stability with a huge time step (a far person's pose waits half a second)
  const q = { x: 0, v: 0 }; for (let i = 0; i < 50; i++) Rb.spring(q, 1, 14, 0.3, 0.5);
  check(isFinite(q.x) && Math.abs(q.x - 1) < 0.2, `stable at dt 0.5 s (x ${q.x.toFixed(3)})`);
  // a pendulum (a lantern) carried at 1.4 b/s that stops: it swings forward, then rests
  const p = { x: 0, v: 0 };
  let swing = 0;
  for (let i = 0; i < 60; i++) Rb.pendulum(p, 0, 4.2, 0.18, 1 / 60);
  for (let i = 0; i < 10; i++) Rb.pendulum(p, -1.4 / (10 / 60), 4.2, 0.18, 1 / 60);   // the stop: −1.4 b/s in 1/6 s
  for (let i = 0; i < 600; i++) { Rb.pendulum(p, 0, 4.2, 0.18, 1 / 60); if (i < 60) swing = Math.max(swing, p.x); }
  check(swing > 0.12 && swing < 0.9, `a lantern swings forward when its carrier stops (${swing.toFixed(2)} rad)`);
  check(Math.abs(p.x) < 0.01, 'and comes to rest');
}

// ---- g: the gaze
{
  const R = {}; rs = 99;
  const r2 = () => rnd();
  let blinks = 0, fix = [], last = 0, prevBlink = false, T = 0, bigShift = 0, bigBlink = 0;
  const dt = 1 / 60;
  for (let i = 0; i < 60 * 600; i++) {
    T += dt;
    const ty = ((i / 600) | 0) % 2 ? 0.9 : -0.2;   // every 10 s the target jumps by 1.1 rad
    const shift0 = R.nfix || 0;
    Rb.gaze(R, ty + Math.sin(T * 0.7) * 0.05, 0, dt, r2);
    if ((R.nfix || 0) !== shift0) { fix.push(T - last); last = T; }
    if (R.blink && !prevBlink) blinks++;
    if (i % 600 === 0 && i) { bigShift++; let b = false; const R2 = Object.assign({}, R); for (let k = 0; k < 30; k++) { Rb.gaze(R2, ((((i + 1) / 600) | 0) % 2 ? 0.9 : -0.2), 0, dt, r2); if (R2.blink) b = true; } if (b) bigBlink++; }
    prevBlink = !!R.blink;
  }
  const perMin = blinks / 10;
  fix.sort((a, b) => a - b);
  const med = fix[fix.length >> 1] || 0;
  check(perMin >= 8 && perMin <= 30, `blinks: ${perMin.toFixed(1)} a minute`);
  check(med >= 0.3 && med <= 2.5, `fixations: median ${med.toFixed(2)} s (${fix.length})`);
  check(bigBlink / Math.max(1, bigShift) > 0.5, `a big gaze shift blinks more often than not (${bigBlink}/${bigShift})`);
  check(Math.abs(R.hy - 0.9) < 0.15 || Math.abs(R.hy + 0.2) < 0.15, `the head reaches its target (${R.hy.toFixed(2)})`);
}

// ---- h: tiers
{
  const g = (preset, anim) => ({ settings: { preset, anim } });
  check(Rb.tier(g('potato', false)) === 0, 'Very Low: none');
  check(Rb.tier(g('low', true)) === 1, 'Low: avoidance only');
  check(Rb.tier(g('balanced', true)) === 2 && Rb.tier(g('high', true)) === 2 && Rb.tier(g('ultra', true)) === 2, 'Balanced, High, Ultra: everything');
  check(Rb.tier(g('high', false)) === 0, 'the animation switch off: none');
  Rb.off = true; check(Rb.tier(g('high', true)) === 0, 'VR.Robo.off: none'); Rb.off = false;
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
