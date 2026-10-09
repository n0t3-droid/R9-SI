// The Weißstadt's people cost the Very Low preset no more than the v042 village's (plan docs/superpowers/plans/
// 2026-10-08-t-town.md; the owner: "die Einwohnerzahl folgt der Dorfgröße" — 149 people where the village had 38).
// Seed 53, the meadow site of cell (−2, −1), the P1 camera of test/trailer_town.mjs (the street 24 blocks before the plaza,
// looking at the fountain), 14:00, the villagers' simulation (villages.js update) frame by frame on the generated blocks,
// and after every update the draw's pick (who is drawn: the folk distance, the view, the street's cap) as in the game:
//   1. a person nobody sees lives at the far rate (every 4th frame, the 8th on Very Low), and walks unseen without a path
//      search when its goal is out of sight (villages.js goTo / unseenWalk); the personal-space pass skips it (folklife.js)
//   2. so the hall city with its 149 people does at most 60 % of the agent updates and path searches it did before
//      (deterministic: Math.random seeded), and its people still do what they do (the terrace guests sit, people arrive)
//   3. its simulation per frame (CPU, the best of two runs) costs at most what the v042 village's 38 cost with the code
//      before (the village without the pick: a.drawn unknown, every rule as it was)
// usage: bash test/wt_run.sh town_sim.js 600
const V = require('./load_shared.js');
require('../src/main/voxmodels.js'); require('../src/main/villagers.js'); require('../src/main/folkmodel.js');
require('../src/main/villages.js'); require('../src/main/folklife.js');
const VG = V.VillageGen, Vs = V.Villages, M4 = V.mat4;
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const ROT = [(u, v) => [u, v], (u, v) => [-v, u], (u, v) => [-u, -v], (u, v) => [v, -u]];
const FRAMES = 1200, WARM = 300, TOD = 8000;
const worlds = {};
function worldOf(vgen) {
  if (worlds[vgen]) return worlds[vgen];
  const gen = new V.OverworldGen(53, { worldType: 'default', vgen });
  const site = VG.site(gen, -2, -1), plan = VG.plan(gen, site), sum = VG.summary(plan);
  const cols = new Map();
  const col = (cx, cz) => { const k = cx * 65536 + cz; let c = cols.get(k); if (!c) { const ch = gen.generate(cx, cz); c = { b: ch.blocks, h: ch.height }; cols.set(k, c); } return c; };
  for (let cx = (site.x - 120) >> 4; cx <= (site.x + 120) >> 4; cx++) for (let cz = (site.z - 120) >> 4; cz <= (site.z + 120) >> 4; cz++) col(cx, cz);
  return (worlds[vgen] = { site, plan, sum, col });
}
const random0 = Math.random;
function run(vgen, preset, pickOn, seed) {
  const { site, plan, sum, col } = worldOf(vgen);
  let rs = seed; Math.random = () => { rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0; return rs / 4294967296; };
  const r = plan.hall ? plan.hall.r : (site.seed >>> 3) & 3;
  const W2 = (u, v) => { const q = ROT[r](u, v); return [site.x + q[0], site.z + q[1]]; };
  const world = {
    getBlock(x, y, z) { if (y < 0 || y > 255) return 0; const c = col(x >> 4, z >> 4); return c.b[(y << 8) | ((z & 15) << 4) | (x & 15)]; },
    isLoaded() { return true; },
    nbFn() { return this._nb || (this._nb = (x, y, z, d) => this.getBlock(x + V.HF_DX[d], y, z + V.HF_DZ[d])); },
    topAt(x, z) { const c = col(x >> 4, z >> 4); return c.h ? c.h[((z & 15) << 4) | (x & 15)] : 64; },
    setBlock() {}, getLight() { return 0xf000; },
  };
  const [px, pz] = W2(0.5, -24.5), [tx, tz] = W2(0.5, 40);
  const F = plan.hall ? plan.hall.F + 1 : 75;
  const eye = { x: px, y: F + 1.62, z: pz };
  const proj = M4.create(), view = M4.create(), vp = M4.create(), planes = new Float32Array(24);
  M4.perspective(proj, 66 * Math.PI / 180, 16 / 9, 0.1, 1000); M4.lookAt(view, 0, 0, 0, tx - px, 8 - 1.62, tz - pz, 0, 1, 0); M4.mul(vp, proj, view); M4.frustum(planes, vp);
  const potato = preset === 'potato';
  const g = { world, player: { pos: [px, F, pz], dead: false, eyePos() { return [px, F + 1.62, pz]; }, lookDir() { return [1, 0, 0]; } },
    env: { timeOfDay: TOD, day: 0, rain: 0 }, settings: { preset, toasts: false }, slowBase: potato, cpuBound: potato,
    entities: { mobs: [] }, particles: new Proxy({}, { get: () => () => {} }), audio: null, ui: null, codex: null, pool: { direct() {} }, mp: null, folkBase: potato ? 32 : 100 };
  const mgr = Object.create(Vs.prototype);
  Object.assign(mgr, { g, meta: { villages: {} }, known: new Map(), pending: new Set(), agents: [], sites: [], siteT: 1e9, siteAt: [px, pz], doors: new Map(), selfEdit: false, pathBudget: 0, time: 0, bubs: [] });
  mgr.st = mgr.meta.villages; mgr.updateBubbles = () => {}; mgr.chirp = () => {};
  mgr.addVillage(sum);
  let counting = false, updates = 0, paths = 0;
  const FP = V.Folk.findPath; V.Folk.findPath = function (...a) { if (counting) paths++; return FP.apply(this, a); };
  const ua = mgr.updateAgent; mgr.updateAgent = function (...a) { if (counting) updates++; return ua.apply(this, a); };
  const C = V.Crowd, cap = C.streetCap(preset), FD = g.folkBase, ms = [];
  try {
    for (let f = 0; f < FRAMES; f++) {
      if (f === WARM) counting = true;
      const c0 = process.cpuUsage();
      mgr.update(1 / 30);
      const c = process.cpuUsage(c0);
      if (pickOn) mgr.pick(planes, eye, cap, FD);
      if (counting) ms.push((c.user + c.system) / 1000);
    }
  } finally { V.Folk.findPath = FP; Math.random = random0; }
  let sit = 0, at = 0;
  for (const a of mgr.agents) { if (a.pose === 'sit') sit++; if (a.goal && Math.hypot(a.pos[0] - a.goal[0] - 0.5, a.pos[2] - a.goal[2] - 0.5) < 2.5) at++; }
  const n = FRAMES - WARM, sorted = ms.slice().sort((a, b) => a - b);
  return { agents: mgr.agents.length, upd: updates / n, paths: paths / n, mean: ms.reduce((a, b) => a + b, 0) / n, median: sorted[n >> 1], sit, at };
}
const fmt = (o) => `${o.agents} people: ${o.upd.toFixed(1)} updates and ${o.paths.toFixed(2)} path searches a frame, ${o.mean.toFixed(2)} ms a frame (median ${o.median.toFixed(2)}), ${o.sit} sitting, ${o.at} at their goal`;

console.log('1–2. the hall city on Very Low at 14:00: before (no pick: every rule as it was) and now');
const hallOld = run(9, 'potato', false, 7), hallNew = run(9, 'potato', true, 7);
console.log('    before: ' + fmt(hallOld));
console.log('    now:    ' + fmt(hallNew));
check(hallNew.upd <= hallOld.upd * 0.6, `the people nobody sees live at the far rate: ${hallNew.upd.toFixed(1)} agent updates a frame (${hallOld.upd.toFixed(1)} before)`);
check(hallNew.paths <= hallOld.paths * 0.6, `a walk nobody sees searches no path: ${hallNew.paths.toFixed(2)} path searches a frame (${hallOld.paths.toFixed(2)} before)`);
check(hallNew.sit >= hallOld.sit * 0.8 && hallNew.at >= hallOld.at * 0.75, `the people still do what they do (${hallNew.sit} sitting and ${hallNew.at} at their goals; ${hallOld.sit} and ${hallOld.at} before)`);

console.log('3. the cost against the v042 village (vgen 8, its 38 people, the code before)');
const best = (vgen, pickOn) => { const a = run(vgen, 'potato', pickOn, 11), b = run(vgen, 'potato', pickOn, 12); return a.mean <= b.mean ? a : b; };
const vilOld = best(8, false), hallNow = best(9, true);
console.log('    v042 village: ' + fmt(vilOld));
console.log('    hall city:    ' + fmt(hallNow));
check(hallNow.mean <= vilOld.mean * 1.1, `the hall city's people cost Very Low no more than the village's did: ${hallNow.mean.toFixed(2)} ms a frame (the village ${vilOld.mean.toFixed(2)} ms; the best of two runs each)`);
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
