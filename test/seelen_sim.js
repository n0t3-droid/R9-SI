// r-seelen · villagers with memory in a simulated village (node, no browser): Herzwelt's Nova Haven (seed 4242) as in
// test/folk4.js, with VR.SeelenGame wrapping villages.js:
//   a · the plans feed the schedule (a meeting of two friends: both walk to the same spot and talk)
//   b · a quarrel over two days: the spat (they face each other, then turn their backs), the shared bench, the peace
//       gift; memories and the graph after it
//   c · a storm-fearing villager hurries home when the front comes (faster), a calm one does not
//   d · a greeting with a memory („Danke nochmal für den Honig“), a friend walking up to you
//   e · the Wanderbuch's „Menschen“, the save's round trip, the main thread's cost per frame
// Run: bash test/wt_run.sh seelen_sim.js 300
require('./dom_stub.js');
const V = require('./load_shared.js');
globalThis.VR = V;
for (const f of ['i18n', 'lang_en', 'lang_de']) require(__dirname + '/../src/main/' + f + '.js');
require('../src/shared/smoothvox.js'); require('../src/shared/folksmooth.js');
for (const f of ['voxmodels', 'villagers', 'folkmodel', 'villages', 'folklife', 'festival', 'folkjoy', 'worldlife', 'folk3', 'gossip', 'folk4', 'folk5', 'seelen_game']) require('../src/main/' + f + '.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const S = V.Seelen, SG = V.SeelenGame, F4 = V.Folk4;
check(!!SG && !!SG.test, 'VR.SeelenGame loads over villages.js');
if (!SG || !SG.test) { console.log('FAILED ' + (fails || 1)); process.exit(1); }
const VG = V.VillageGen, Vs = V.Villages;
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
const gen = new V.OverworldGen(4242, { worldType: 'default', vgen: 14 });
const site = VG.site(gen, 0, -1), plan = VG.plan(gen, site), sum = VG.summary(plan), world = worldOf(gen);
const pz = sum.plaza, C = [pz.x + 0.5, pz.y, pz.z + 0.5];
const player = { pos: [C[0] + 4.5, pz.y, C[2] + 4.5], vel: [0, 0, 0], onGround: true, flying: false, mode: 'creative', yaw: 0, pitch: 0,
  eyePos() { return [this.pos[0], this.pos[1] + 1.62, this.pos[2]]; }, lookDir() { return [0, 0, -1]; }, inv: { add() { return true; } } };
const g = { world, player, env: { timeOfDay: 4000, day: 3, rain: 0, thunder: 0, wx: { front: 0 } }, settings: { preset: 'balanced', toasts: false }, playerName: 'Mira', meta: { id: 'w1', seed: 4242 }, entities: { mobs: [] },
  particles: new Proxy({}, { get: () => () => {} }), audio: { play() {}, tone() {} }, ui: { chatLine() {}, toast() {} }, codex: null, pool: { direct() {} }, mp: null, folkBase: 100, state: 'play', dim: 'overworld' };
V.game = g;
const mgr = Object.create(Vs.prototype);
Object.assign(mgr, { g, meta: g.meta, known: new Map(), pending: new Set(), agents: [], sites: [], siteT: 1e9, siteAt: [player.pos[0], player.pos[2]], doors: new Map(), selfEdit: false, pathBudget: 0, time: 0, bubs: [] });
mgr.meta.villages = {}; mgr.st = mgr.meta.villages; mgr.updateBubbles = () => {}; mgr.chirp = () => {}; mgr.talkText = () => {};
mgr.joyTier = () => 2;
g.villages = mgr;
mgr.addVillage(sum);
F4.auto = false; F4.off = true;   // (no moments of their own: the scenes here are r-seelen's)
const dt = 1 / 30, run = (s) => { for (let f = 0; f < s * 30; f++) mgr.update(dt); };
run(4);
const vil = mgr.agents[0] && mgr.agents[0].vil;
check(!!vil && vil.agents.length > 10, `the village lives (${mgr.agents.length} people)`);
const lid = SG.test.lid, dist = (a, b) => Math.hypot(a.pos[0] - b.pos[0], a.pos[2] - b.pos[2]);
const adults = vil.agents.filter(a => a.p.age === 'adult' && !a.guest);
const facing = (x, y) => { const t = Math.atan2(-(y.pos[0] - x.pos[0]), -(y.pos[2] - x.pos[2])); return Math.abs(Math.atan2(Math.sin(t - x.yaw), Math.cos(t - x.yaw))); };

console.log('a · a meeting of two friends');
{
  const [A, B] = [adults[2], adults[5]];
  const G = SG.graph(g, vil);
  for (let k = 0; k < 4; k++) S.share(G, lid(A.p), lid(B.p), 'picnic');
  g.env.timeOfDay = 10700;
  const PL = SG.test.plans(vil);
  const pa = PL.by[lid(A.p)], pb = PL.by[lid(B.p)];
  const sa = pa.find(s => s.a === 'meet'), sb = pb.find(s => s.a === 'meet');
  check(!!sa && !!sb && sa.w === lid(B.p) && sb.w === lid(A.p) && pa.indexOf(sa) === pb.indexOf(sb), `both plans hold the same meeting (${sa && sa.f}–${sa && sa.u})`);
  check(Object.values(PL.by).every(P => !S.planValid(P)), 'every villager\'s plan is valid');
  let met = false, both = 0;
  for (let k = 0; k < 90 && !met; k++) { run(1); if (A.act && A.act.type === 'se_meet' && B.act && B.act.type === 'se_meet') both++; if (A.act && A.act.met && B.act && B.act.met) met = true; }
  check(both > 0, 'the executor (schedule → think → runAct) runs the meeting act for both');
  check(met && dist(A, B) < 3.2, `they meet at the plaza and talk (${dist(A, B).toFixed(1)} m apart)`);
  check(met && facing(A, B) < 0.8, 'facing each other');
  const m = SG.mind(g, A);
  check(m.m.some(e => e.k === 'hug' && e.w === lid(B.p)), 'a memory of the meeting');
}

console.log('b · a quarrel over two days');
{
  const [A, B] = [adults[0], adults[3]];
  g.env.timeOfDay = 10700;
  const q = SG.test.quarrel(vil, A, B, 'spat');
  const v0 = S.relV(SG.graph(g, vil), q.a, q.b);
  let faced = false, backs = false, spoke = 0;
  for (let k = 0; k < 120 && q.ph === 'spat'; k++) {
    run(1);
    const both = A.act && A.act.type === 'se_meet' && B.act && B.act.type === 'se_meet' && A.act.tw > 0 && B.act.tw > 0;
    if (both && A.act.tw < 5 && facing(A, B) < 0.9) faced = true;
    if (both && A.act.tw > 12 && facing(A, B) > 2.2 && facing(B, A) > 2.2) backs = true;
  }
  spoke = SG.log.filter(l => l.kind === 'q.spat' || l.kind === 'q.cold').length;
  check(faced, 'the spat: they face each other');
  check(backs, 'then they turn their backs on each other');
  check(q.ph === 'cold', 'the spat played → cold (' + q.ph + ')');
  check(SG.mind(g, A).m.some(e => e.k === 'quarrel') && S.relV(SG.graph(g, vil), q.a, q.b) < v0, 'remembered, and the graph cooled');
  void spoke;
  g.env.day++; g.env.timeOfDay = 10800;
  run(2);
  check(q.ph === 'bench', 'the next dusk → the bench (' + q.ph + ')');
  let sat = false;
  let together = false;
  for (let k = 0; k < 140 && q.ph === 'bench'; k++) { run(1); if (A.pose === 'sit' && B.pose === 'sit' && dist(A, B) < 1.6) sat = true; if (A.act && A.act.tw > 2 && dist(A, B) < 2.5) together = true; }
  const seats = (vil.plan.plaza.seats || []).length;
  const S2 = vil.plan.plaza.seats || [], two = S2.some((x, i) => S2.some((y, j) => j > i && (x[3] | 0) === (y[3] | 0) && x[1] === y[1] && Math.abs(x[0] - y[0]) + Math.abs(x[2] - y[2]) === 1));
  check(two ? sat : together, two ? 'they share one bench, side by side' : `no bench for two on this plaza (${seats} seats): they stand together instead`);
  check(q.ph === 'gift', 'the bench → the gift (' + q.ph + ')');
  g.env.day++; g.env.timeOfDay = 5800;
  for (let k = 0; k < 140 && q.ph === 'gift'; k++) { run(1); if (process.env.DBG && k % 5 === 0) console.log('   ', k, q.ph, q.d, g.env.day, A.act && A.act.type, A.seSlot && A.seSlot.a, B.act && B.act.type, B.seSlot && B.seSlot.a, dist(A, B).toFixed(1), A.act && A.act.tw); }
  check(q.ph === 'done', 'the peace gift → reconciled (' + q.ph + ')');
  const ma = SG.mind(g, A), mb = SG.mind(g, B);
  check(ma.m.some(e => e.k === 'made_up') && mb.m.some(e => e.k === 'made_up'), 'both remember making up');
  check(S.relV(SG.graph(g, vil), q.a, q.b) > v0, `closer than before the quarrel (${v0.toFixed(2)} → ${S.relV(SG.graph(g, vil), q.a, q.b).toFixed(2)})`);
  console.log('    log: ' + SG.log.map(l => l.kind).join(','));
  check(SG.log.some(l => l.kind === 'q.gift') && SG.log.some(l => l.kind === 'q.thanks'), 'the gift and the thanks are said');
}

console.log('c · a storm');
{
  g.env.day++; g.env.timeOfDay = 3000; SG.test.storm(0);
  const R = SG.test.R(); R.d.q[vil.id] = null;
  const shy = adults.find(a => a.p.role === 'farmer' || a.p.role === 'gardener') || adults[6], calm = adults.find(a => a !== shy && a.role !== 'ranger' && a.p.role !== 'farmer') || adults[7];
  const ms = SG.mind(g, shy), t = SG.test.now();
  S.note(ms, 'storm', t - 600, { i: 8 }); S.note(ms, 'storm', t - 2000, { i: 8 }); S.reflect(ms, t, g.env.day);
  SG.mind(g, calm).b = [];
  check(!!S.has(ms, 'fearStorm'), 'a villager who saw two storms is afraid of them');
  SG.test.plans(vil);
  run(3);
  const before = shy.act && shy.act.type;
  SG.test.storm(0.5);
  run(4);
  check(shy.act && shy.act.type === 'home' && shy.seHurry, `the front comes: they hurry home (${before} → ${shy.act && shy.act.type}, hurry ${!!shy.seHurry})`);
  check(shy.speed > (shy.seSpeed0 || 9), 'faster than they walk');
  check(!calm.seHurry, 'a calm neighbour does not hurry');
  SG.test.storm(0); run(3);
  check(!shy.seHurry && Math.abs(shy.speed - shy.seSpeed0) < 1e-9, 'the storm gone: their own pace again');
}

console.log('d · greetings and friends');
{
  const a = adults[8] || adults[1];
  const m = SG.mind(g, a), t = SG.test.now();
  S.plMeet(m, t - 3000); S.note(m, 'gift', t - 900, { a: 'honey_bottle', w: 'pl' }); S.plAdd(m, 'g', t - 900);
  a.bubble = null; SG.test.greet(a);
  check(a.bubble && /Honig/.test(a.bubble.text), 'the greeting remembers the gift: „' + (a.bubble && a.bubble.text) + '“');
  check(m.pl.lw === (a.bubble && a.bubble.text), 'the last words are kept');
  // a friend walks up to you
  const f = adults.find(o => o !== a && o.act && o.act.type !== 'se_meet' && dist(o, player) > 9 && dist(o, player) < 26) || adults[9];
  const mf = SG.mind(g, f); mf.pl = S.newPl(); mf.pl.n = 6; mf.pl.g = 3; mf.cd = -1;
  const d0 = dist(f, player);
  g.env.timeOfDay = 3500; SG.test.R().comeT = -1e9;
  let came = false;
  for (let k = 0; k < 30 && !came; k++) { run(1); if (dist(f, player) < 2.6 && f.bubble) came = true; }
  check(came, `a friend walks up to you and greets you (${d0.toFixed(0)} m → ${dist(f, player).toFixed(1)} m: „${f.bubble ? f.bubble.text : ''}“)`);
  run(10);
  check(!f.seCome, 'and goes back to the day after');
}

console.log('e · the book, the save, the cost');
{
  const h = SG.html(g);
  check(/Menschen/.test(h) && /Honig/.test(h) && /♥/.test(h), 'the Wanderbuch\'s „Menschen“: names, hearts, last words');
  const o = S.save(SG.test.R().d), js = JSON.stringify(o);
  const back = S.load(JSON.parse(js));
  check(Object.keys(back.p).length === Object.keys(o.p).length && js.length < 40000, `the save: ${Object.keys(o.p).length} villagers, ${(js.length / 1024).toFixed(1)} KB`);
  SG.cost.frames = 0; SG.cost.ms = 0; SG.cost.max = 0;
  g.env.timeOfDay = 4000; run(20);
  const avg = SG.cost.ms / Math.max(1, SG.cost.frames);
  check(avg < 0.05, `main thread: ${avg.toFixed(4)} ms a frame on average (max ${SG.cost.max.toFixed(2)} ms; node)`);
  g.settings.seelen = false; const n0 = SG.cost.frames; run(1);
  check(SG.cost.frames === n0, 'the switch off: nothing runs');
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
