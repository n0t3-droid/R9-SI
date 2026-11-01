// u-folk2 · the 60-s village walk without a browser (plan docs/superpowers/plans/2026-10-31-u-folk2.md §2): Herzwelt's
// first town of folk2.mjs's world (seed 4242, cell (0, −1): Nova Haven, a tech town of single flats — its children are
// FolkJoy.visitKids') on its generated blocks (the harness of test/town_sim.js),
// the villagers' simulation (villages.js update + folklife.js + folkjoy.js) frame by frame at 30 Hz, the afternoon, and a
// player who walks round the plaza at 7 m: a jump at 12 s and 33 s, a pause of 4 s at 20 s and 44 s, four blocks placed at
// 27 s, a fall of 6.5 blocks at 50 s; an offer or an invitation that waits within 3 m is taken ([use] = openTalk).
//   1. at least four distinct warm moments in the 60 s (the copy of a jump not counted), the people near the player smile
//   2. the moments' CPU per frame (FolkJoy on − off, the same seeded run): Balanced and Very Low, and Very Low draws no pet
// Math.random is seeded: the same run every time.
// usage: bash test/wt_run.sh folk2_walk.js 600
require('./dom_stub.js');
const V = require('./load_shared.js');
globalThis.VR = V;
for (const f of ['i18n', 'lang_en', 'lang_de']) require(__dirname + '/../src/main/' + f + '.js');
require('../src/main/voxmodels.js'); require('../src/main/villagers.js'); require('../src/main/folkmodel.js');
require('../src/main/villages.js'); require('../src/main/folklife.js'); require('../src/main/folkjoy.js');
const VG = V.VillageGen, Vs = V.Villages, FJ = V.FolkJoy;
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };

const gen = new V.OverworldGen(+(process.env.SEED || 4242), { worldType: 'default', vgen: 14 });
const site = VG.site(gen, +(process.env.CI || 0), +(process.env.CJ || -1)), plan = VG.plan(gen, site), sum = VG.summary(plan);
const cols = new Map();
const col = (cx, cz) => { const k = cx * 65536 + cz; let c = cols.get(k); if (!c) { const ch = gen.generate(cx, cz); c = { b: ch.blocks, h: ch.height }; cols.set(k, c); } return c; };
const placed = new Map();
const world = {
  getBlock(x, y, z) { if (y < 0 || y > 255) return 0; const k = x + ',' + y + ',' + z; if (placed.has(k)) return placed.get(k); const c = col(x >> 4, z >> 4); return c.b[(y << 8) | ((z & 15) << 4) | (x & 15)]; },
  isLoaded() { return true; },
  nbFn() { return this._nb || (this._nb = (x, y, z, d) => this.getBlock(x + V.HF_DX[d], y, z + V.HF_DZ[d])); },
  topAt(x, z) { const c = col(x >> 4, z >> 4); return c.h ? c.h[((z & 15) << 4) | (x & 15)] : 64; },
  setBlock(x, y, z, s) { placed.set(x + ',' + y + ',' + z, s); }, getLight() { return 0xf000; },
};
const random0 = Math.random;
const TOD = 7600;

function walk(preset, joyOn, seed) {
  let rs = seed; Math.random = () => { rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0; return rs / 4294967296; };
  placed.clear();
  const pz = sum.plaza, C = [pz.x + 0.5, pz.y, pz.z + 0.5];
  const inv = []; const yaw = { v: 0 };
  const player = { pos: [C[0] + 7, C[1], C[2]], vel: [0, 0, 0], onGround: true, flying: false, dead: false, mode: 'creative', yaw: 0, pitch: -0.08,
    eyePos() { return [this.pos[0], this.pos[1] + 1.62, this.pos[2]]; }, lookDir() { return [-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch)]; },
    inv: { add(id, n) { inv.push([id, n]); return true; } } };
  void yaw;
  const potato = preset === 'potato';
  const g = { world, player, env: { timeOfDay: TOD, day: 0, rain: 0 }, settings: { preset, toasts: false }, slowBase: potato, cpuBound: potato,
    entities: { mobs: [] }, particles: new Proxy({}, { get: () => () => {} }), audio: { play() {} }, ui: null, codex: null, pool: { direct() {} }, mp: null, folkBase: potato ? 32 : 100 };
  const mgr = Object.create(Vs.prototype);
  Object.assign(mgr, { g, meta: { villages: {} }, known: new Map(), pending: new Set(), agents: [], sites: [], siteT: 1e9, siteAt: [player.pos[0], player.pos[2]], doors: new Map(), selfEdit: false, pathBudget: 0, time: 0, bubs: [] });
  mgr.st = mgr.meta.villages; mgr.updateBubbles = () => {}; mgr.chirp = () => {};
  mgr.joyTier = () => (potato ? 0 : 2);
  mgr.addVillage(sum);
  FJ.stats = FJ.newStats(); FJ.off = !joyOn;
  const dt = 1 / 30, ms = [], used = [], smiles = new Set();
  let jumpV = 0;
  try {
    // 10 s of the village's life first (the people out and about), then the 60-s walk
    for (let f = 0; f < 300; f++) { mgr.update(dt); }
    if (mgr.joy) mgr.joy.stats = FJ.stats = FJ.newStats();
    for (let f = 0; f < 1800; f++) {
      const t = f * dt, p = player;
      const pause = (t >= 20 && t < 24) || (t >= 44 && t < 48);
      if (!pause) {
        const an = Math.atan2(p.pos[2] - C[2], p.pos[0] - C[0]) + 2.4 * dt / 7;
        const nx = C[0] + Math.cos(an) * 7, nz = C[2] + Math.sin(an) * 7;
        p.yaw = Math.atan2(-(nx - p.pos[0]), -(nz - p.pos[2])); p.pos[0] = nx; p.pos[2] = nz;
      }
      // a jump (1.25 blocks, 0.6 s); the fall from 6.5 blocks
      if ((t >= 12 && t < 12 + dt) || (t >= 33 && t < 33 + dt)) { jumpV = 6.5; p.onGround = false; }
      if (t >= 50 && t < 50 + dt) { p.pos[1] = C[1] + 6.5; p.onGround = false; jumpV = 0; }
      if (!p.onGround) { jumpV -= 20 * dt; p.pos[1] += jumpV * dt; if (p.pos[1] <= C[1]) { p.pos[1] = C[1]; p.onGround = true; jumpV = 0; } }
      // four blocks before the people
      if (t >= 27 && t < 27 + 4 * dt) { const x = Math.floor(p.pos[0]) + 2, z = Math.floor(p.pos[2]) + 2, y = Math.floor(C[1]) + Math.round((t - 27) / dt); world.setBlock(x, y, z, 1); mgr.onBlockChanged(x, y, z, 0, 1); }
      const c0 = process.cpuUsage();
      mgr.update(dt);
      const c = process.cpuUsage(c0); ms.push((c.user + c.system) / 1000);
      for (const a of mgr.agents) {
        if (a.expr && (a.pos[0] - p.pos[0]) ** 2 + (a.pos[2] - p.pos[2]) ** 2 < 15 * 15) smiles.add(a.p.id);
        if (a.act && a.act.type === 'joy' && a.act.wait && !a.act.done && (a.pos[0] - p.pos[0]) ** 2 + (a.pos[2] - p.pos[2]) ** 2 < 9) { used.push(a.act.kind); mgr.openTalk(a); }
      }
    }
  } finally { Math.random = random0; FJ.off = false; }
  const sorted = ms.slice().sort((a, b) => a - b);
  return { by: Object.assign({}, FJ.stats.by), n: FJ.stats.n, used, inv, smiles: smiles.size, agents: mgr.agents.length, kids: mgr.agents.filter(a => a.kid).length,
    mean: ms.reduce((a, b) => a + b, 0) / ms.length, median: sorted[sorted.length >> 1], pets: mgr.joy ? mgr.joy.pets.length : 0 };
}

console.log('1. the walk (Balanced)');
const W = walk('balanced', true, 7);
const kinds = Object.keys(W.by).filter(k => k !== 'copy');
console.log(`  · ${W.agents} people (${W.kids} children): ${W.n} moments ${JSON.stringify(W.by)}; [use] → ${W.used.join(', ') || '-'}; gifts ${JSON.stringify(W.inv)}; ${W.smiles} smiled`);
check(kinds.length >= 4, `at least four distinct warm moments in 60 s (${kinds.length}: ${kinds.join(', ')})`);
check(W.smiles >= 3, `the people near smile (${W.smiles})`);
check(W.kids >= 2, `children live in the town (${W.kids})`);
check(W.pets >= 1, `village pets follow their families (${W.pets})`);

console.log('2. the cost (CPU per frame, the villagers\' simulation; the moments on − off, the same run)');
const best = (pr, on) => { let r = null; for (let k = 0; k < 3; k++) { const q = walk(pr, on, 7); if (!r || q.mean < r.mean) r = q; } return r; };
const res = {};
for (const pr of ['potato', 'balanced']) {
  const off = best(pr, false), on = best(pr, true);
  res[pr] = { off: +off.mean.toFixed(3), on: +on.mean.toFixed(3), d: +(on.mean - off.mean).toFixed(3), pets: on.pets };
  console.log(`  · ${pr}: off ${off.mean.toFixed(3)} ms (median ${off.median.toFixed(3)}) · on ${on.mean.toFixed(3)} ms (median ${on.median.toFixed(3)}) · pets ${on.pets}`);
}
check(res.potato.pets === 0, 'Very Low: no pets');
check(res.potato.d <= 0.25, `Very Low: the moments cost ≤ 0.25 ms a frame (${res.potato.d} ms)`);
check(res.balanced.d <= 0.5, `Balanced: the moments cost ≤ 0.5 ms a frame (${res.balanced.d} ms)`);
try { require('fs').writeFileSync(__dirname + '/../.tmp_tests/folk2_walk.json', JSON.stringify({ walk: W, cost: res }, null, 1)); } catch (e) { /* a convenience */ }

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
