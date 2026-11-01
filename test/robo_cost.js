// x-robo · the cost and the effect of VR.Robo (folkrobo.js) in a town: Nova Haven in the villages' simulation (as
// folk3_cost.js), the player on the plaza, every frame what the game does for the people (mgr.update, a pose each).
//   · High: Robo's hooks take ≤ 6 µs a person a frame (every person posed every frame: the worst case)
//   · Low: the avoiding only · Very Low: Robo is never called
//   · the effect: walkers touching each other or the player (closer than their bodies) less often with Robo on
// usage: bash test/wt_run.sh robo_cost.js 300
require('./dom_stub.js');
const V = require('./load_shared.js');
globalThis.VR = V;
for (const f of ['i18n', 'lang_en', 'lang_de']) require(__dirname + '/../src/main/' + f + '.js');
require('../src/shared/smoothvox.js'); require('../src/shared/folksmooth.js');
for (const f of ['voxmodels', 'villagers', 'folkmodel', 'folkrobo', 'villages', 'folklife', 'festival', 'folkjoy', 'worldlife', 'natives', 'folk3']) require('../src/main/' + f + '.js');
const VG = V.VillageGen, Vs = V.Villages, F3 = V.Folk3;
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const SEED = 4242;
function worldOf(gen) {
  const cols = new Map();
  const col = (cx, cz) => { const k = cx * 65536 + cz; let c = cols.get(k); if (!c) { const ch = gen.generate(cx, cz); c = { b: ch.blocks, h: ch.height }; cols.set(k, c); } return c; };
  return {
    getBlock(x, y, z) { if (y < 0 || y > 255) return 0; const c = col(x >> 4, z >> 4); return c.b[(y << 8) | ((z & 15) << 4) | (x & 15)]; },
    isLoaded() { return true; },
    nbFn() { return this._nb || (this._nb = (x, y, z, d) => this.getBlock(x + V.HF_DX[d], y, z + V.HF_DZ[d])); },
    topAt(x, z) { const c = col(x >> 4, z >> 4); if (c.h) return c.h[((z & 15) << 4) | (x & 15)]; for (let y = 200; y > 0; y--) if (this.getBlock(x, y, z)) return y; return 64; },
    setBlock() {}, getLight() { return 0xf000; },
  };
}
let rs = 11; Math.random = () => { rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0; return rs / 4294967296; };
const gen = new V.OverworldGen(SEED, { worldType: 'default', vgen: 14 });
const site = VG.site(gen, 0, -1), plan = VG.plan(gen, site), sum = VG.summary(plan), world = worldOf(gen);
const pz = sum.plaza, C = [pz.x + 0.5, pz.y, pz.z + 0.5];
const player = { pos: [C[0] + 2.5, pz.y, C[2] + 2.5], vel: [0, 0, 0], onGround: true, flying: false, mode: 'creative', yaw: 0, pitch: 0,
  eyePos() { return [this.pos[0], this.pos[1] + 1.62, this.pos[2]]; }, lookDir() { return [0, 0, -1]; }, inv: { add() { return true; } } };
const g = { world, player, env: { timeOfDay: 4000, day: 1, rain: 0 }, settings: { preset: 'high', toasts: false }, meta: {}, entities: { mobs: [] },
  particles: new Proxy({}, { get: () => () => {} }), audio: { play() {}, tone() {} }, ui: { chatLine() {}, toast() {} }, codex: null, pool: { direct() {} }, mp: null, folkBase: 100, time: 0 };
const mgr = Object.create(Vs.prototype);
Object.assign(mgr, { g, meta: g.meta, known: new Map(), pending: new Set(), agents: [], sites: [], siteT: 1e9, siteAt: [player.pos[0], player.pos[2]], doors: new Map(), selfEdit: false, pathBudget: 0, time: 0, bubs: [] });
mgr.meta.villages = {}; mgr.st = mgr.meta.villages; mgr.updateBubbles = () => {}; mgr.chirp = () => {}; mgr.talkText = () => {};
mgr.joyTier = () => 2;
mgr.addVillage(sum);
const dt = 1 / 30;
for (let f = 0; f < 240; f++) mgr.update(dt);
console.log(`  · Nova Haven: ${mgr.agents.length} people`);
check(mgr.agents.length >= 12, `enough people for the measure (${mgr.agents.length})`);
const RB = V.Robo;
const frame = () => {
  g.time += dt; mgr.update(dt);
  for (const a of mgr.agents) { const P = mgr.pose(a, g.time); if (!P) throw new Error('no pose'); }
};
const run = (n) => { const t = process.hrtime.bigint(); for (let i = 0; i < n; i++) frame(); return Number(process.hrtime.bigint() - t) / 1e6 / n; };
const N = 300;
for (let i = 0; i < 600; i++) frame();
// the time inside VR.Robo's hooks: how often the game calls each (counted over 900 frames), times what one call costs
// (each hook called 400× in a row on every person as the town stands — timers round single calls would cost more
// than the calls themselves)
const PART = {}, RAW = {};
for (const k of ['avoid', 'makeWay', 'body', 'gaze']) {
  const f = RAW[k] = RB[k]; PART[k] = { n: 0, us: 0 };
  RB[k] = function (x1, x2, x3, x4, x5, x6) { PART[k].n++; return f(x1, x2, x3, x4, x5, x6); };
}
const OUT2 = [0, 0];
const bench = () => {
  const A = mgr.agents, K = 400, hr = () => process.hrtime.bigint();
  // (the least of five: the machine is shared)
  const go = (fn) => { let best = 1e9; for (let r = 0; r < 5; r++) { const t0 = hr(); for (const a of A) for (let i = 0; i < K; i++) fn(a, i); best = Math.min(best, Number(hr() - t0) / 1000 / (K * A.length)); } return best; };
  PART.avoid.us = go((a) => RAW.avoid(mgr, a, 1.1, 0.4, 1 / 30, OUT2));
  PART.makeWay.us = go((a) => RAW.makeWay(mgr, a, 1 / 30, OUT2));
  const saved = new Map(A.map(a => [a, JSON.stringify(a.poseOut || {})]));
  PART.body.us = go((a) => { if (a.poseOut && a.gait) RAW.body(mgr, a, a.poseOut, a.gait, 1 / 30); });
  for (const a of A) if (a.poseOut) Object.assign(a.poseOut, JSON.parse(saved.get(a)));
  const R = {}; PART.gaze.us = go((a, i) => RAW.gaze(R, Math.sin(i * 0.05), 0.1, 1 / 30, Math.random));
};
const n = mgr.agents.length;
const measure = (frames) => { for (const k in PART) PART[k].n = 0; for (let i = 0; i < frames; i++) frame(); let us = 0, calls = 0; for (const k in PART) { us += PART[k].n * PART[k].us; calls += PART[k].n; } return { us: us / frames / n, calls }; };
bench();
RB.off = false;
const H = measure(900);
console.log(`  · High, ${n} people, every one posed every frame: Robo ${H.us.toFixed(2)} µs a person a frame (${(H.us * n / 1000).toFixed(3)} ms a frame)`);
for (const k in PART) console.log(`    ${k}: ${PART[k].n} calls, ${PART[k].us.toFixed(2)} µs a call`);
check(H.us <= 6, 'High: ≤ 6 µs a person a frame');
check(PART.body.n > 0 && PART.gaze.n > 0 && PART.avoid.n > 0, 'High: the hooks run');
g.settings.preset = 'low';
const L = measure(300);
check(PART.body.n === 0 && PART.gaze.n === 0, `Low: only the avoiding (${L.us.toFixed(2)} µs a person)`);
g.settings.preset = 'potato'; g.settings.anim = false;
const VL = measure(600);
console.log(`  · Very Low: ${VL.calls} calls into Robo`);
check(VL.calls === 0, 'Very Low: Robo is never called (the frame does one compare more)');
g.settings.preset = 'high'; delete g.settings.anim;
// the effect: contacts between walkers (both moving, closer than 0.5 b) and with the player, frames counted
const contacts = (offFlag) => {
  RB.off = offFlag; let c = 0, cp = 0;
  for (let f = 0; f < 1800; f++) {
    // the player walks a figure of eight across the plaza
    const T = f * dt; player.pos[0] = C[0] + Math.sin(T * 0.35) * 7; player.pos[2] = C[2] + Math.sin(T * 0.7) * 4; player.vel[0] = Math.cos(T * 0.35) * 2.45; player.vel[2] = Math.cos(T * 0.7) * 2.8;
    frame();
    const A = mgr.agents;
    for (let i = 0; i < A.length; i++) {
      const a = A[i]; if (a.pose === 'sit' || a.pose === 'sleep' || a.inBoat) continue;
      if (Math.hypot(a.pos[0] - player.pos[0], a.pos[2] - player.pos[2]) < 0.62 && Math.abs(a.pos[1] - player.pos[1]) < 1.5) cp++;
      if (Math.hypot(a.vel[0], a.vel[2]) < 0.3) continue;
      for (let j = i + 1; j < A.length; j++) { const b = A[j]; if (Math.hypot(b.vel[0], b.vel[2]) < 0.3 || b.pose === 'sit') continue; if (Math.hypot(a.pos[0] - b.pos[0], a.pos[2] - b.pos[2]) < 0.5 && Math.abs(a.pos[1] - b.pos[1]) < 1.5) c++; }
    }
  }
  return [c, cp];
};
const [c0, p0] = contacts(true), [c1, p1] = contacts(false);
console.log(`  · contacts in 60 s (walker–walker, with the player): off ${c0}, ${p0} · on ${c1}, ${p1}`);
check(c1 + p1 < c0 + p0 || c0 + p0 === 0, 'fewer contacts with Robo on');
const stuck = mgr.agents.filter(a => a.fails > 3).length;
check(stuck <= 2, `nobody stuck by the avoiding (${stuck} with > 3 failed paths)`);
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
