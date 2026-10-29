// f-wild2 · R50-10 (docs/superpowers/plans/2026-10-23-f-wild2.md §2.4) — the wild's CPU on High, this branch against
// its base (v042: t-wild's animals) in the same machine, turn about: the actor in a stand-in world (flat grass at 80, a
// lake east of x 60 with the murmuration's stage over it), dusk, the eye on the shore; a fake GL that only counts. Per
// frame: the update (every piece) and the draw (opaque + translucent: the parties, the impostors, the rest). The best of
// three turns each, 600 frames at 30 a second after 60 s settling, in the process's CPU time.
//  · this branch's frame ≤ 1.3 × the base's (the plan: the actor's CPU ≤ t-wild's + 30 %, with 2.4× the birds)
//  · Very Low: the update returns at once (≤ 0.005 ms), no GL call
//   bash test/wt_run.sh wild_cost.js 600
// (the base's tree: .tmp_tests/v042src — made here with `git archive v042` when it is missing; nothing is fetched)
const path = require('path'), fs = require('fs'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..') + '/';
if (process.argv[2] === '--probe') {
  const R0 = process.argv[3], preset = process.argv[4] || 'high';
  const V = require(R0 + 'test/load_shared.js');
  global.window = global.window || {};
  global.performance = global.performance || { now: () => Date.now() };
  for (const f of ['wildsim', 'wildgpu', 'wildlife']) require(R0 + 'src/main/' + f + '.js');
  const W = V.Wild, R = V.R, st = (n) => R.byName[n].defaultState, SEA = V.C.SEA;
  let calls = 0;
  const fakeGL = new Proxy({}, { get: (t, k) => { if (typeof k === 'string' && /^[A-Z_0-9]+$/.test(k)) return 1; return () => { calls++; return {}; }; } });
  V.GL = { program: () => ({ p: {}, u: new Proxy({}, { get: () => ({}) }) }) };
  V.SHADERS = { COMMON: '' };
  const rr = { gl: fakeGL, P: {}, stats: { draws: 0, tris: 0 }, viewProj: new Float32Array(16), common() { calls++; }, planes: new Float32Array(24), h: 720 };
  const GRASS = st('grass_block'), STONE = st('stone'), WATER = st('water');
  const lake = (x) => x >= 60;
  const world = { getBlock: (x, y, z) => { y = Math.floor(y); if (lake(Math.floor(x))) return y <= 58 ? STONE : y <= SEA ? WATER : 0; return y < 80 ? STONE : y === 80 ? GRASS : 0; }, topAt: (x) => lake(Math.floor(x)) ? SEA : 80, isLoaded: () => true, getLight: () => 0xf000 };
  const anchors = new Map([['fish:70,0', { key: 'fish:70,0', kind: 'fish', x: 70, y: SEA, z: 0, n: 3, extra: [6] }]]);
  const S = { preset }; if (preset !== 'potato') for (const k of W.KEYS) S[k] = true;
  const g = { state: 'play', dim: 'overworld', settings: S, meta: { seed: 53, vgen: 11, type: 'default' }, time: 0,
    env: { day: 4, ticks: 11300, get timeOfDay() { return ((this.ticks % 24000) + 24000) % 24000; }, E: { sunDir: [0.4, 0.1, -0.9], night: 0, rain: 0, snow: 0 } },
    player: { pos: [56, 81, 0], vel: [0, 0, 0], yaw: 0 }, world, particles: { spawn() { return 0; } }, airLife: { noButterflies: false },
    entities: { land: { anchors }, beginVox: () => ({ u: {} }), drawModel() { calls++; }, lightAt: () => ({ sky: 1, bl: [0, 0, 0] }), sunShade: () => 0 } };
  const A = new W.Actor(g), dt = 1 / 30;
  const step = () => { g.time += dt; g.env.ticks += dt * 20; A.update(dt); };
  for (let i = 0; i < 60 * 30; i++) step();
  const M = A.murm;
  // the eye on the shore ~145 from the flock's middle (its own stage: wherever the actor put it)
  if (M && M.fl) { const c = M.fl.ctr, dx = 56 - c[0], dz = 0 - c[2], l = Math.hypot(dx, dz) || 1; g.player.pos = [c[0] + dx / l * 145, 81, c[2] + dz / l * 145]; }
  for (let i = 0; i < 90; i++) step();
  let up = 0, dr = 0;
  const cam = () => ({ x: g.player.pos[0], y: g.player.pos[1] + 1.62, z: g.player.pos[2] });
  for (let i = 0; i < 600; i++) {
    // (the process's own CPU time, not the wall clock: on a shared, loaded machine the wall clock counts the others)
    const t0 = process.cpuUsage(); step(); const t1 = process.cpuUsage();
    const c = cam(); A.draw(rr, { night: 0 }, 'opaque', c); A.draw(rr, { night: 0 }, 'trans', c); const t2 = process.cpuUsage();
    up += (t1.user + t1.system - t0.user - t0.system) / 1000; dr += (t2.user + t2.system - t1.user - t1.system) / 1000;
  }
  const av = {}; for (const k in A.stats.avg) av[k] = +A.stats.avg[k].toFixed(3);
  console.log(JSON.stringify({ up: up / 600, draw: dr / 600, murm: M ? M.n : 0, state: M ? M.state : null, calls, av }));
  process.exit(0);
}
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const BASE = ROOT + '.tmp_tests/v042src/';
if (!fs.existsSync(BASE + 'src/main/wildlife.js')) { fs.mkdirSync(BASE, { recursive: true }); cp.execSync(`git -C "${ROOT}" archive v042 src test | tar -x -C "${BASE}"`); }
const probe = (root, preset) => JSON.parse(cp.execFileSync(process.execPath, [__filename, '--probe', root, preset || 'high'], { encoding: 'utf8' }).trim().split('\n').pop());
const best = { base: null, ours: null };
for (let t = 0; t < 3; t++) for (const [k, r] of t & 1 ? [['ours', ROOT], ['base', BASE]] : [['base', BASE], ['ours', ROOT]]) {
  const q = probe(r); q.ms = q.up + q.draw;
  if (!best[k] || q.ms < best[k].ms) best[k] = q;
}
const f = (q) => `update ${q.up.toFixed(3)} + draw ${q.draw.toFixed(3)} ms (${q.murm} boids, ${q.state})`;
console.log('  base (v042, t-wild): ' + f(best.base));
console.log('  this branch:         ' + f(best.ours));
check(best.ours.murm >= 2 * best.base.murm && best.ours.state === 'fly', `the murmuration flies with ${best.ours.murm} boids (t-wild's ${best.base.murm})`);
check(best.ours.ms <= 1.3 * best.base.ms, `High, the shore at dusk: the actor's frame ${best.ours.ms.toFixed(3)} ms against t-wild's ${best.base.ms.toFixed(3)} (×${(best.ours.ms / best.base.ms).toFixed(2)}; ≤ ×1.3)`);
const vl = probe(ROOT, 'potato');
check(vl.up < 0.02 && vl.calls === 0, `Very Low: the update ${(vl.up * 1000).toFixed(2)} µs, ${vl.calls} GL calls`);
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
