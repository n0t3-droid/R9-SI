// No combat (docs/superpowers/plans/2026-10-09-t-life.md §3.2): a new world is peaceful unless the player picks
// otherwise, and a peaceful world never fights — the sky traffic's update over 20 minutes spawns no raider, no defender
// and no bolt (even with a raid flag left over), the raid check never starts a raid, the hostile mobs left from before are
// removed, and the player's own shots are harmless light. The raid code stays behind the difficulty: on Normal the same
// updates still start a raid and send the defence wing (the control).
//   bash test/wt_run.sh life_peace.js 300
const V = require('./load_shared.js');
global.window = global.window || {};
global.document = global.document || { getElementById: () => null, createElement: () => ({ style: {}, getContext: () => null }) };
global.performance = global.performance || { now: () => Date.now() };
const fs = require('fs');
for (const f of ['peace', 'entities', 'gadgets', 'traffic']) { const p = __dirname + '/../src/main/' + f + '.js'; if (fs.existsSync(p)) require(p); }
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };

// ---- the default: a new world is Friedlich
check(!!V.Peace && V.Peace.DEFAULT === 'peaceful', 'new worlds default to Friedlich (VR.Peace.DEFAULT ' + (V.Peace && V.Peace.DEFAULT) + ')');
const src = (f) => fs.readFileSync(__dirname + '/../src/main/' + f, 'utf8');
check(/seg\('cw_diff'[^\n]*\]\],\s*\(VR\.Peace\s*\?\s*VR\.Peace\.DEFAULT/.test(src('start.js')), 'the create form (Profi) marks Friedlich by default');
check(/difficulty:\s*o\.difficulty\s*\|\|\s*\(VR\.Peace/.test(src('game.js')), 'createWorld without a difficulty makes a peaceful world');
check(!!V.Peace && V.Peace.on({ difficulty: 'peaceful', player: { mode: 'survival' } }) && V.Peace.on({ difficulty: 'normal', player: { mode: 'zen' } }) && !V.Peace.on({ difficulty: 'normal', player: { mode: 'survival' } }), 'VR.Peace.on: peaceful or Zen is peace, Normal survival is not');

// ---- the sky traffic over 20 minutes
function trafficRun(difficulty, raidActive, minutes) {
  const hostile = { dead: false, def: { hostile: true }, pos: [10, 90, 10], h: 0.9 };
  const fake = (arch) => ({ key: 'k' + arch, seed: 1, meta: { arch, height: 4, length: 16, width: 10, exhaust: [[0, 1, 6, 0.6]], bounds: [-5, 0, -8, 5, 4, 8] }, gpu: null, last: 0 });
  const g = { state: 'play', dim: 'overworld', player: { pos: [0, 81, 0], mode: 'survival' }, difficulty, raidActive, settings: { preset: 'balanced' }, env: { timeOfDay: 16000, day: 1, ticks: 16000, E: { night: 1 } },
    particles: { spawn() { }, n: 0 }, audio: { play() { }, loop() { } }, ui: { chatLine() { } }, trails: null,
    starships: { design: (seed, arch, pal, cb) => { const d = fake(arch || 'interceptor'); if (cb) cb(d); return d; }, ships: [] },
    entities: { mobs: [hostile], bolts: [] } };
  const T = new V.Traffic(g);
  let defenders = 0, maxDef = 0, gun = 0;
  const steps = Math.round(minutes * 60 / 0.1);
  for (let i = 0; i < steps; i++) {
    T.update(0.1);
    let d = 0; for (const s of T.ships) { if (s.defender) d++; if (s.arch === 'gunship') gun++; }
    maxDef = Math.max(maxDef, d); if (d) defenders++;
  }
  return { defenders: maxDef, bolts: g.entities.bolts.length, gun, ships: T.ships.length };
}
const pe = trafficRun('peaceful', true, 20);
check(pe.defenders === 0, `peaceful, 20 min (a raid flag left on): no defender in the sky (${pe.defenders})`);
check(pe.bolts === 0, `peaceful, 20 min: no bolt (${pe.bolts})`);
check(pe.gun === 0, `peaceful: no gunship among the sky traffic (${pe.gun} gunship-frames)`);
const no = trafficRun('normal', true, 2);
check(no.defenders > 0, `the control: on Normal a raid still brings the defence wing (${no.defenders} defenders)`);

// ---- the raid check over 20 minutes of night
function raidRun(difficulty) {
  let summoned = 0;
  const g = { player: { mode: 'survival', pos: [0, 81, 0] }, env: { E: { night: 1 }, timeOfDay: 16000, day: 3 }, difficulty, dim: 'overworld', world: { topAt: () => 80 }, audio: { play() { } }, mp: null,
    entities: { summon: (kind) => { if (kind === 'raider_drone') summoned++; return { kind }; }, mobs: [] } };
  const self = { g, raid: { active: false, lastDay: -1, checkT: 0, mobs: [] }, say() { } };
  self.startRaid = V.Gadgets.prototype.startRaid.bind(self);
  const R0 = Math.random; Math.random = () => 0;
  try { for (let i = 0; i < 20 * 60; i++) { V.Gadgets.prototype.updateRaid.call(self, 1); if (self.raid.active) { self.raid.active = false; g.raidActive = false; } } } finally { Math.random = R0; }
  return summoned;
}
check(raidRun('peaceful') === 0, 'peaceful, 20 min of night: the raid check summons no raider drone');
check(raidRun('normal') > 0, 'the control: on Normal the raid still comes (the code stays behind the difficulty)');

// ---- the mobs and the bolts
{
  const p = { pos: [0, 81, 0], mode: 'survival', dead: false };
  const g = { player: p, difficulty: 'peaceful', world: { getBlock: () => 0, isLoaded: () => true, nbFn: () => null, topAt: () => 80 }, env: { E: { night: 0 } }, particles: { spark() { } }, audio: { play() { } }, dim: 'overworld' };
  const E = Object.create(V.Entities.prototype);
  E.game = g; E.mobs = []; E.items = []; E.falling = []; E.bolts = []; E.vehicles = []; E.spawnT = 99;
  E.ai = () => { }; E.physics = () => { };
  E.mobs.push({ def: { hostile: true }, pos: [5, 81, 5], age: 0, hurt: 0, dead: false, w: 0.3, h: 1.8 });
  E.mobs.push({ def: { hostile: false }, pos: [6, 81, 5], age: 0, hurt: 0, dead: false, w: 0.3, h: 1.8 });
  E.update(0.05);
  check(E.mobs.length === 1 && !E.mobs[0].def.hostile, `peaceful: a hostile mob left from before is removed, the others stay (${E.mobs.length} left)`);
  E.fireBolt([0, 82, 0], [1, 0, 0], 80, 7, p, [1, 0.3, 0.4]);
  const b = E.bolts[0];
  check(!b || (b.dmg === 0 && b.harmless), `peaceful: the player's own shot is harmless light (${b ? 'dmg ' + b.dmg : 'no bolt'})`);
  E.bolts.length = 0;
  E.fireBolt([0, 82, 0], [1, 0, 0], 38, 3, { def: { hostile: true } }, [1, 0.25, 0.2]);
  check(E.bolts.length === 0, 'peaceful: nothing hostile ever fires (no bolt)');
  g.difficulty = 'normal';
  E.fireBolt([0, 82, 0], [1, 0, 0], 80, 7, p, [1, 0.3, 0.4]);
  check(E.bolts.length === 1 && E.bolts[0].dmg === 7, 'the control: on Normal the shot is a real bolt');
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
