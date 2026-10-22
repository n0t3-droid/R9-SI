// What the quests cost per frame without a UI (a-quests; plan docs/superpowers/plans/2026-10-22-a-quests.md §4):
// in an Abenteuer world with quests open, every frame runs only the wrappers quests.js puts around the game's parts —
// the villagers' think and runAct (an escort check per villager), the ✦ draw hook (an early-out without a mark), the
// minimap's stars (≤ 30 times a second, only with a quest open) and the compass line (5 times a second). Each is
// timed here against the same call without the quests (CPU time, best of five), and the twice-a-second work (the
// marks, the targets, the repair and find checks) as such. The browser's game-loop blocks (test/abenteuer.mjs) are
// too noisy on a shared machine to see microseconds; these are not.
//   bash test/wt_run.sh quests_cost.js 300
require('./dom_stub.js');
require('./load_shared.js');
require('../src/shared/adventure.js');
require('../src/main/i18n.js');
require('../src/main/lang_en.js');
require('../src/main/lang_de.js');
require('../src/main/settings_reg.js');
require('../src/main/binds.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };

// the parts quests.js wraps, as stand-ins with the same methods (the originals' own work is not what is measured)
const ctx2d = () => new Proxy({}, { get: (o, k) => (k in o ? o[k] : () => {}), set: (o, k, v) => { o[k] = v; return true; } });
class Villages { constructor(g) { this.g = g; this.agents = []; } talkOptions() {} think(a) { a.n = (a.n || 0) + 1; } runAct(a, dt) { a.m = (a.m || 0) + dt; } draw() { this.drawn = (this.drawn || 0) + 1; } }
class MapView { constructor(g) { this.g = g; this.mctx = ctx2d(); this.mini = { width: 180, height: 180 }; this.bctx = ctx2d(); this.big = { width: 800, height: 600 }; this.scale = 2; this.center = [0, 0]; this.compass = { innerHTML: '' }; this.lastCompass = 'N 0°'; } drawMini() { this.m = (this.m || 0) + 1; } renderBig() {} updateCompass() { this.c = (this.c || 0) + 1; } }
VR.Villages = Villages; VR.MapView = MapView;
const base = { think: Villages.prototype.think, runAct: Villages.prototype.runAct, draw: Villages.prototype.draw, drawMini: MapView.prototype.drawMini, updateCompass: MapView.prototype.updateCompass };
let lkDraws = 0;
VR.LifeKit = { drawModel() { lkDraws++; return true; }, drawQuad() { lkDraws++; return true; } };
require('../src/main/adventure.js');
require('../src/main/quests.js');
const Q = VR.Quests, A = VR.Adventure;

// a game in an Abenteuer world, a village of 30 at the player's feet
const meta = { id: 'qc', name: 'Q', difficulty: 'peaceful', mode: 'survival', seed: 4242, created: Date.now() - 1e7 };
const inv = { slots: new Array(36).fill(null), count: () => 0, add: () => 1, remove: () => true, held: null };
const g = VR.game = { state: 'play', meta, settings: { advHud: true }, difficulty: 'peaceful', dim: 'overworld', seed: 4242, time: 12.5, folkDist: 32,
  player: { pos: [120, 81, -60], yaw: 0.3, pitch: 0, mode: 'survival', inv }, env: { day: 5, timeOfDay: 6000 },
  ui: { screen: null, toast() {}, hint() {}, show(id) { this.screen = id; }, resume() { this.screen = null; } },
  audio: { play() {}, tone() {} }, particles: { glow() {}, spark() {} }, saveMeta() { return Promise.resolve(); },
  entities: { beginVox() { return {}; } }, world: { getBlock: () => 0, isLoaded: () => true } };
A.bind(); A.setOn(true);
const mgr = g.villages = new Villages(g);
const vil = { id: '1_2', name: 'Lindenau', plan: { id: '1_2', x: 120, y: 80, z: -60, plaza: { x: 118, y: 80, z: -58 } }, st: { rep: 0 }, people: [], fams: [{ members: [] }], agents: [] };
const roles = ['farmer', 'baker', 'smith', 'scholar', 'child', 'elder', 'gardener', 'builder', 'pilot', 'cashier'];
for (let i = 0; i < 30; i++) {
  const p = { id: '1_2:' + (i >> 2) + ':' + (i & 3), name: 'P' + i, role: roles[i % roles.length], age: i % 7 === 0 ? 'child' : 'adult', seed: 1000 + i };
  vil.people.push(p);
  const a = { vil, p, pos: [120 + (i % 6) * 3, 81, -60 + Math.floor(i / 6) * 3], h: 1.75, act: { type: 'work' }, get role() { return p.role; }, get name() { return p.name; }, say() {} };
  vil.agents.push(a); mgr.agents.push(a);
}
mgr.known = new Map([['1_2', vil]]);
Q.placesNow = Q.places({ heart: true, vistas: [{ id: 'v3', x: 200, y: 82, z: -20, lm: 'lighthouse', aim: [420, 120, 60] }, { id: 'v9', x: 150, y: 81, z: -90, lm: 'isles', aim: [330, 170, 140] }], villages: [], vid: '1_2' });
check(Q.on(), 'an Abenteuer world: the quests on, the hooks in place (' + (Villages.prototype.think !== base.think) + ')');
// three quests open (a find, a fetch, a photo): the map's stars and the compass line have work
const village = { x: 120, y: 80, z: -60, name: 'Lindenau', plaza: [118, 80, -58] };
for (const [i, k] of [[0, 'find'], [1, 'fetch'], [2, 'photo']]) Q.accept(A.rec, Q.make({ seed: 4242, vid: '1_2', pid: vil.people[i].id, day: 5, role: vil.people[i].role, name: vil.people[i].name, village, places: Q.placesNow, kinds: [k] }), Date.now() + i);
check(Q.open(A.rec).length === 3, 'three quests open: ' + Q.open(A.rec).map(r => r.k).join(', '));

const cpu = (fn, n) => { let best = Infinity; for (let r = 0; r < 5; r++) { const c0 = process.cpuUsage(); for (let i = 0; i < n; i++) fn(i); const c = process.cpuUsage(c0); best = Math.min(best, (c.user + c.system) / n); } return best; };   // µs a call
const cam = { x: 121, y: 83, z: -55, yaw: 0, pitch: 0 }, r = {}, E = {};
const P = Villages.prototype, MV = MapView.prototype, map = new MapView(g);

// 1 · the villagers' wrappers: think + runAct for 30 villagers, with and without the quests
console.log('1 · every frame: the villagers (30)');
const frameV = (think, runAct) => () => { for (const a of mgr.agents) { think.call(mgr, a); runAct.call(mgr, a, 1 / 60); } };
const vOff = cpu(frameV(base.think, base.runAct), 20000), vOn = cpu(frameV(P.think, P.runAct), 20000);
console.log('     ' + vOff.toFixed(3) + ' µs without, ' + vOn.toFixed(3) + ' µs with the quests');
// 2 · the draw hook: no mark (the early-out) and three marked givers in view
console.log('2 · every drawn frame: the ✦ hook');
Q.mark(mgr); for (const a of mgr.agents) a.qMark = 0; Q.stats.marks = 0; Q.drawTargets = null;
const dOff = cpu(() => base.draw.call(mgr, r, E, cam), 200000), dNone = cpu(() => P.draw.call(mgr, r, E, cam), 200000);
mgr.agents[3].qMark = 1; mgr.agents[4].qMark = 1; mgr.agents[5].qMark = 2; Q.stats.marks = 3; lkDraws = 0;
const dMarks = cpu(() => P.draw.call(mgr, r, E, cam), 50000);
check(lkDraws > 0, 'with three marks near the eye the stars are drawn (' + lkDraws + ' model calls)');
for (const a of mgr.agents) a.qMark = 0; Q.stats.marks = 0;
console.log('     ' + dOff.toFixed(3) + ' µs the villagers\' draw alone, ' + dNone.toFixed(3) + ' µs with the hook and no mark, ' + dMarks.toFixed(3) + ' µs with three stars (JS side)');
// 3 · the map: the minimap's stars (≤ 30 Hz, only when the view changed) and the compass line (5 Hz)
console.log('3 · the map');
const mOff = cpu(() => base.drawMini.call(map), 50000), mOn = cpu(() => MV.drawMini.call(map), 50000);
const cOff = cpu(() => base.updateCompass.call(map), 50000), cOn = cpu(() => MV.updateCompass.call(map), 50000);
check(/✦/.test(map.compass.innerHTML), 'the compass line shows the tracked quest: ' + map.compass.innerHTML.replace(/<[^>]+>/g, '').split('✦').pop().trim());
console.log('     minimap ' + mOff.toFixed(3) + ' → ' + mOn.toFixed(3) + ' µs a call, compass ' + cOff.toFixed(3) + ' → ' + cOn.toFixed(3) + ' µs a call');
// 4 · twice a second: the tick (marks, targets, near checks)
console.log('4 · twice a second');
g.player.pos = [120, 121, -60];   // (in the air: no repair or find spot counts the player as standing there)
const tick = cpu(() => Q.tick(), 2000);
console.log('     the tick ' + tick.toFixed(2) + ' µs');

// the sum per frame at 60 fps: the villagers every frame, the draw hook every drawn frame, the minimap ½ (30 Hz),
// the compass 1⁄12 (5 Hz), the tick 1⁄30 (2 Hz)
const perFrame = (vOn - vOff) + (dNone - dOff) + 0.5 * (mOn - mOff) + (cOn - cOff) / 12 + tick / 30;
console.log('per frame (60 fps, nothing marked in view): ' + perFrame.toFixed(2) + ' µs');
check(perFrame <= 20, 'the quests without a UI cost ' + perFrame.toFixed(2) + ' µs a frame (≤ 20 µs: ' + (perFrame / 16667 * 100).toFixed(3) + ' % of a 60-fps frame)');
check(dNone - dOff <= 0.5, 'the draw hook with nothing marked: ' + Math.max(0, dNone - dOff).toFixed(3) + ' µs (an early-out)');
A.setOn(false);
const offTick = cpu(() => Q.tick(), 2000);
check(Q.stats.marks === 0 && mgr.agents.every(a => !a.qMark), 'the Abenteuer off: no mark left (the tick ' + offTick.toFixed(2) + ' µs)');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
