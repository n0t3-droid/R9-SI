// F3 · Da-Sein: the living air sheds the agents of a lower tier at once. After a switch from High to Very Low no bird and
// no butterfly is left alive, and the fireflies stay within the cap; a higher tier keeps what it has. Node only.
// bash test/wt_run.sh airlife_tiers.js
require('./load_shared.js');
require('../src/main/particles.js');
require('../src/main/airlife.js');
const A = VR.AirLife;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
// a flat world with air (the ground at 0, the eye 10 up), a day with the sun high, no wind, no rain, no snow
const w = { topAt: () => 0, getBlock: () => 0 };
const P = { n: 0, spawn() { return 1; } };
const DAY = { night: 0, sunDir: [0, 1, 0], wind: 1, windDir: [1, 0], rain: 0, snow: 0 };
const frame = (a, tier) => { a.setOn(true, tier); a.update(1 / 60, { w, eye: [0, 10, 0], E: DAY, underwater: false, particles: P }); };
function fill(a) {
  a.bf = []; for (let i = 0; i < 10; i++) a.bf.push({ hx: 0, hy: 1, hz: 0, ph: i, sp: 1, col: [1, 1, 1], life: 20 });
  a.flocks = [{ x: 0, y: 25, z: 0, dx: 1, dz: 0, speed: 10, n: 7, ph: 0, life: 20 }];
  a.ff = []; for (let i = 0; i < 20; i++) a.ff.push({ x: i * 0.1, y: 1.5, z: 0, ph: i, fr: 1.5, wx: 0, wz: 0, life: 20 });
}
const tiers = [0, 1, 2, 3, 4].map(t => VR.AirLife.budgetFor(t).cap);

// 1. High (tier 3) holds its butterflies, birds and fireflies (the fireflies are within the cap)
let a = new A({});
a.tier = 3; fill(a);
let before = { ...a.drawn };
frame(a, 3);
check(a.bf.length === 10 && a.flocks.length === 1 && a.ff.length === 20 && a.drawn.butterfly > before.butterfly && a.drawn.bird > before.bird,
  'High keeps its butterflies (' + a.bf.length + '), flock (' + a.birds() + ' birds) and fireflies (' + a.ff.length + ')');

// 2. the switch to Very Low sheds the butterflies and the flock at once; no bird or butterfly is drawn in that frame
fill(a);
a.tier = 3; frame(a, 3);
before = { ...a.drawn };
frame(a, 0);
check(a.bf.length === 0 && a.flocks.length === 0 && a.drawn.butterfly === before.butterfly && a.drawn.bird === before.bird,
  'Very Low sheds the butterflies (' + a.bf.length + ' left) and the flock (' + a.birds() + ' birds left), none drawn');
check(a.ff.length <= tiers[0].firefly, 'Very Low keeps the fireflies within its cap (' + a.ff.length + ' of ' + tiers[0].firefly + ')');

// 3. Low (tier 1): the flock of 7 is above its 5 birds, so it goes; the butterflies are cut to the cap of 6
fill(a);
frame(a, 1);
check(a.flocks.length === 0 && a.bf.length === tiers[1].butterfly && a.ff.length <= tiers[1].firefly,
  'Low: the flock of 7 goes (cap ' + tiers[1].bird + ' birds), butterflies cut to ' + a.bf.length + ' (cap ' + tiers[1].butterfly + ')');

// 4. every tier: the caps are never exceeded in one frame
for (let t = 0; t <= 4; t++) {
  const b = new A({}); b.tier = t; fill(b); frame(b, t);
  check(b.bf.length <= tiers[t].butterfly && b.birds() <= tiers[t].bird && b.ff.length <= tiers[t].firefly,
    'tier ' + t + ' stays within its caps (butterflies ' + b.bf.length + '/' + tiers[t].butterfly + ', birds ' + b.birds() + '/' + tiers[t].bird + ', fireflies ' + b.ff.length + '/' + tiers[t].firefly + ')');
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
