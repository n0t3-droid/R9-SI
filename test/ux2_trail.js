// f-ux2 — the goal trail walks (plan docs/superpowers/plans/2026-11-02-f-ux2.md): the glue's path search on a small
// stub world (VR.Folk.findPath over real blocks): a wall between you and the goal → the steps go round its end, none
// stands inside the wall; a fork sign at the bend; the search is throttled (moved < 3 m: no new search) and cheap.
//   bash test/wt_run.sh ux2_trail.js 300
const V = require('./load_shared.js');
require('./dom_stub.js');
for (const f of ['i18n', 'lang_en', 'lang_de', 'settings_reg']) require(__dirname + '/../src/main/' + f + '.js');
require('../src/main/villagers.js'); require('../src/main/diegetic.js');
const D = V.Diegetic, R = V.R;
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const stone = R.byName.stone.base, grass = R.byName.grass ? R.byName.grass.base : stone;
// flat ground at y 63 (stand at y 64); a wall x −12..12 at z −8 (3 high); the goal 60 m north (−z)
const wall = (x, y, z) => z === -8 && x >= -12 && x <= 12 && y >= 64 && y <= 66;
const world = { getBlock: (x, y, z) => (y < 64 ? (y === 63 ? grass : stone) : wall(x, y, z) ? stone : 0), topAt: (x, z) => (z === -8 && x >= -12 && x <= 12 ? 66 : 63), isLoaded: () => true };
V.Folk.warm();
const g = { world, player: { pos: [0.5, 64, 0.5] }, settings: { particles: 2, goalTrail: true }, cpuBound: false };
const goal = { x: 0.5, z: -60 };
const way = D._pathFor(g, g.player, goal);
check(Array.isArray(way) && way.length > 10, 'a way was found (' + (way ? way.length : 0) + ' cells)');
if (way) {
  const st = D.trailPath(way);
  check(st.length >= 10, 'steps along it (' + st.length + ')');
  const inWall = st.filter(q => Math.floor(q.z) === -8 && q.x >= -12.2 && q.x <= 13.2);
  check(!inWall.length, 'no step inside the wall (' + inWall.length + ')');
  const cross = way.some((q, i) => i && Math.floor(q[1]) === -8 && Math.floor(q[0]) >= -12 && Math.floor(q[0]) <= 12); if (cross) console.log('    ' + JSON.stringify(way.filter(q => Math.floor(q[1]) === -8)));
  check(!cross, 'the way never crosses the wall');
  check(st.some(q => Math.abs(q.x) > 4), 'the steps go round its end (max |x| ' + Math.max(...st.map(q => Math.abs(q.x))).toFixed(1) + ' m)');
  const fk = D.forks(way, 40);
  check(fk.length >= 1 && fk.length <= 2, 'a Wegweiser where the way bends (' + fk.length + ')');
  check(st.every(q => q.y === 64), 'each step knows its ground (y 64)');
}
const n0 = D.cost.pathN;
g.player.pos = [1.5, 64, -0.5]; D._pathFor(g, g.player, goal);
check(D.cost.pathN === n0, 'moved 1.4 m: no new search (the way is trimmed to where you stand)');
for (let k = 0; k < 8; k++) { D.state.pathT = -1e9; D.state.pFrom = null; D._pathFor(g, g.player, goal); }
const ms = D.cost.pathMs / D.cost.pathN, worst = D.cost.pathWorst;
console.log('    searches ' + D.cost.pathN + ', worst ' + worst.toFixed(2) + ' ms');
check(ms < 8, 'one search ' + ms.toFixed(2) + ' ms (≤ 0.67 Hz: ' + (ms / 90).toFixed(3) + ' ms a frame)');
// an open field: the way goes straight
const open = { getBlock: (x, y, z) => (y < 64 ? stone : 0), topAt: () => 63, isLoaded: () => true };
const g2 = { world: open, player: { pos: [0.5, 64, 0.5] }, settings: { particles: 2 } };
D.state.pathT = -1e9;
const w2 = D._pathFor(g2, g2.player, goal);
check(w2 && D.forks(w2, 40).length === 0 && D.trailPath(w2).every(q => Math.abs(q.x - 0.5) < 0.9), 'open land: a straight way, no fork signs');
{ let t = 0; for (let k = 0; k < 20; k++) { D.state.pathT = -1e9; D.state.pFrom = null; const a = process.hrtime.bigint(); D._pathFor(g2, g2.player, goal); t += Number(process.hrtime.bigint() - a) / 1e6; }
  check(t / 20 < 0.6, 'open land: the straight check only, ' + (t / 20).toFixed(3) + ' ms a search'); }
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
