// u-folk3 · the CPU cost of VR.Folk3 per frame (the High blocker: High ~2× with Folk3 on in folk3.mjs's cost run):
// Herzwelt's Nova Haven in the villages' simulation (folk3_dance.js's stand-in game), the player on the plaza, every
// frame what the game does for the people — mgr.update, a pose per person, the draw's options (F3.drawOpts) — with
// Folk3 off and on, alternating twice; then each of Folk3's switches (F3.sw) alone.
//   · Folk3 on costs ≤ 0.25 ms a frame more than off (15+ people)
//   · no switch alone costs more than 0.15 ms a frame
// usage: bash test/wt_run.sh folk3_cost.js 300
require('./dom_stub.js');
const V = require('./load_shared.js');
globalThis.VR = V;
for (const f of ['i18n', 'lang_en', 'lang_de']) require(__dirname + '/../src/main/' + f + '.js');
require('../src/shared/smoothvox.js'); require('../src/shared/folksmooth.js');
for (const f of ['voxmodels', 'villagers', 'folkmodel', 'villages', 'folklife', 'festival', 'folkjoy', 'worldlife', 'natives', 'folk3']) require('../src/main/' + f + '.js');
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
// one frame of what the game does for the people (villages.js draw's opts, without the GL)
const frame = () => {
  g.time += dt; mgr.update(dt);
  for (const a of mgr.agents) {
    const P = mgr.pose(a, g.time);
    const d2 = (a.pos[0] - player.pos[0]) ** 2 + (a.pos[2] - player.pos[2]) ** 2;
    const o = { flash: 0, scale: 1, shade: 0, expr: a.expr || null, hide: { lids: !(a.blinkOn || a.eyesClosed), mouth: !a.mouthOn || !!a.expr, item_r: false, item_l: false } };
    F3.drawOpts(a, o, d2);
    if (!P) throw new Error('no pose');
  }
};
const run = (n) => { const t = process.hrtime.bigint(); for (let i = 0; i < n; i++) frame(); return Number(process.hrtime.bigint() - t) / 1e6 / n; };
const N = 300;
for (let i = 0; i < 900; i++) frame();   // (warm: the JIT, the moods' first round)
// A against B, alternating three times (the least of each: the machine is shared)
const pair = (A, B) => { let a = 1e9, b = 1e9; for (let i = 0; i < 3; i++) { A(); a = Math.min(a, run(N)); B(); b = Math.min(b, run(N)); } return [a, b]; };
const allSw = (v) => { for (const k in F3.sw) F3.sw[k] = v; };
const [off, on] = pair(() => { F3.off = true; }, () => { F3.off = false; });
console.log(`  · a frame for ${mgr.agents.length} people: Folk3 off ${off.toFixed(3)} ms, on ${on.toFixed(3)} ms`);
check(on <= off + 0.25, `Folk3 on ≤ off + 0.25 ms a frame (${off.toFixed(3)} → ${on.toFixed(3)} ms)`);
if (F3.sw) {
  const keys = Object.keys(F3.sw);
  for (const s of keys) {
    const [t0, t1] = pair(() => allSw(false), () => { allSw(false); F3.sw[s] = true; });
    console.log(`  · ${s}: ${t1 - t0 >= 0 ? '+' : ''}${(t1 - t0).toFixed(3)} ms`);
    check(t1 - t0 <= 0.15, `the switch ${s} alone ≤ 0.15 ms a frame`);
  }
  allSw(true);
} else check(false, 'F3.sw: the per-feature switches');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
