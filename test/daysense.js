// Lichträtsel · the daylight detector reads the real light (src/main/daysense.js). Before, its power never changed.
//   a  power: 15 at full sun in the open, 0 at night; inverted the other way round; a ramp at dawn
//   b  where the Schattenuhr has baked the cell above the detector, its shadow decides (a pillar's shadow at a known time)
//   c  without a clock: the sky light of the cell above (a roof → 0)
//   d  the sim: a placed detector is found, its power follows the sun every second, the circuit is told (volt)
//   e  a right click turns it round (inverted), the power flips at once
//   f  detectors in a loaded column are found (an old world's detectors work too)
//   g  the texts in both tables
const V = require('./load_shared.js');
for (const f of ['i18n', 'lang_en', 'lang_de']) require(__dirname + '/../src/main/' + f + '.js');
const R = V.R, DT = R.byName.daylight_detector;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
// the sim and a world, small stubs
const blocks = new Map(), light = new Map();
const K = (x, y, z) => x + ',' + y + ',' + z;
const world = { dim: 'overworld', getBlock: (x, y, z) => blocks.get(K(x, y, z)) || 0, setBlock(x, y, z, s) { const o = this.getBlock(x, y, z); blocks.set(K(x, y, z), s); if (sim) sim.onBlockChanged(x, y, z, o, s); return true; }, getLight: (x, y, z) => light.has(K(x, y, z)) ? light.get(K(x, y, z)) : 0xf000, col: () => null };
const game = { world, player: { pos: [0, 64, 0] }, env: { E: { sunDir: [0, 1, 0] } }, settings: {}, audio: { play() {} }, ui: { chatLine(t) { game.said = t; } } };
const sched = [];
V.Sim = class { constructor(g) { this.game = g; this.tick = 0; } onBlockChanged() {} onColumnLoaded() {} step() { this.tick++; } interact() { return false; } schedule(x, y, z, d, k) { sched.push([x, y, z, k]); } };
require('../src/main/daysense.js');
const DS = V.DaySense;
let sim = null;
check(!!DS, 'DaySense loaded');
if (DS) {
  check(DS.power(1, 1, false) === 15 && DS.power(1, -0.3, false) === 0, 'a  full sun 15, night 0');
  check(DS.power(1, 1, true) === 0 && DS.power(1, -0.3, true) === 15, 'a  inverted');
  const dawn = DS.power(1, 0.1, false); check(dawn > 0 && dawn < 15, 'a  dawn in between (' + dawn + ')');
  check(DS.power(0.4, 1, false) === 6, 'a  in part shade 6');
  // b  a clock
  V.ClockVol = { on: () => true, arcTime: () => 0.5, visAt: (w, x, y, z) => (x < 5 ? 0 : 1) };
  check(DS.lightAt(game, 3, 64, 0) === 0 && DS.lightAt(game, 7, 64, 0) === 1, 'b  the clock decides (shadow at x < 5)');
  V.ClockVol.visAt = () => null;
  light.set(K(9, 65, 0), 0x0000);
  check(DS.lightAt(game, 9, 64, 0) === 0 && DS.lightAt(game, 11, 64, 0) === 1, 'c  no clock: the sky light above (a roof → 0)');
  delete V.ClockVol;
  // d
  sim = new V.Sim(game);
  world.setBlock(2, 64, 0, DT.defaultState);
  check(sim.daySense && sim.daySense.size === 1, 'd  the placed detector is known');
  game.env.E.sunDir = [0, 1, 0];
  for (let i = 0; i < 21; i++) sim.step();
  check(DT.get(world.getBlock(2, 64, 0), 'power') === 15 && sched.some(s => s[3] === 'volt'), 'd  noon: power 15, the circuit told');
  game.env.E.sunDir = [0, -1, 0]; sched.length = 0;
  for (let i = 0; i < 21; i++) sim.step();
  check(DT.get(world.getBlock(2, 64, 0), 'power') === 0 && sched.length > 0, 'd  night: 0');
  // e
  const s = world.getBlock(2, 64, 0);
  const took = sim.interact(2, 64, 0, s, R.types[DT.id], { inv: { held: null } });
  const s2 = world.getBlock(2, 64, 0);
  check(took && DT.get(s2, 'inverted') === 1 && DT.get(s2, 'power') === 15, 'e  turned round: inverted, at night 15');
  // f
  sim.daySense.clear();
  const c = { cx: 1, cz: 0, blocks: new Uint16Array(16 * 16 * 80) }; c.blocks[(70 << 8) | (3 << 4) | 5] = DT.defaultState;
  sim.onColumnLoaded(c);
  check(sim.daySense.has(K(21, 70, 3)), 'f  found in a loaded column');
  world.setBlock(2, 64, 0, 0);
  check(!sim.daySense.has(K(2, 64, 0)), 'd  a broken detector is forgotten');
}
const miss = ['g.day.inv', 'g.day.norm'].filter(k => !(V.I18N.dict.de[k] && V.I18N.dict.en[k]));
check(!miss.length, 'g  texts in both tables ' + miss.join(','));
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
