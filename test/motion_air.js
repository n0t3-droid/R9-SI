// t-motion · step 2 (docs/superpowers/plans/2026-10-15-t-motion.md): the air. The new air's caps per tier (Very Low holds
// the two cheapest: the smoke that takes up the wind — no new particle — and a little steam over the café's cups), the
// particles' wind and turbulence (smoke bends downwind, mist churns but stays bounded), the lamp halos' gentle flicker,
// the sun's glitter test on water, and MotionAir in a small world: steam over the café tables of a plan, motes in a
// sunbeam under a canopy, leaves in a storm, splashes in the rain — each within its cap. Node only.
//   bash test/wt_run.sh motion_air.js
const V = require('./load_shared.js');
global.performance = global.performance || require('perf_hooks').performance;
require('../src/main/settings_reg.js');
require('../src/main/particles.js');
require('../src/main/airlife.js');
require('../src/main/motion.js');
const M = VR.Motion, A = VR.MotionAir;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };

// ---- 1. the caps: Very Low holds the cheapest kind only, every cap grows with the tier, the switches are registered
console.log('caps');
const b0 = M.budgetFor(0);
check(b0.kinds.join() === 'steam' && b0.cap.steam <= 10, `Very Low: only the steam over the cups among the new kinds (${b0.kinds.join(',')}, at most ${b0.cap.steam}) — with the smoke that bends, its two cheapest`);
let mono = true; for (let t = 1; t <= 4; t++) for (const k of M.AIR_KINDS) if (M.budgetFor(t).cap[k] < M.budgetFor(t - 1).cap[k]) mono = false;
check(mono, 'every cap grows with the tier');
check(M.AIR_KINDS.every(k => M.budgetFor(4).cap[k] > 0), 'Ultra has every kind');
check(['motion', 'cloudShadow', 'wxDrama'].every(k => VR.Settings.byKey(k) && VR.Settings.byKey(k).cost === 'low'), 'the three switches are in the settings, each with its cost badge');

// ---- 2. the particles take up the wind and churn, bounded
console.log('wind and turbulence');
const P = new VR.Particles({ world: null, skyBright: 1 });
P.setWind({ windDir: [1, 0], wind: 1 }, 0);
const smoke = P.spawn(0, 70, 0, 0, 0.8, 0, { life: 10, size: 0.1, grav: -0.12, drag: 0.35, collide: false, wind: 0.45 });
const plain = P.spawn(0, 70, 5, 0, 0.8, 0, { life: 10, size: 0.1, grav: -0.12, drag: 0.35, collide: false });
const mist = P.spawn(0, 70, 10, 0, 0.5, 0, { life: 10, size: 0.5, grav: -0.1, drag: 1.1, collide: false, turb: 1.6 });
let vmax = 0;
for (let i = 0; i < 180; i++) { P.setWind({ windDir: [1, 0], wind: 1 }, 1 / 60); P.update(1 / 60, [0, 70, 0]); vmax = Math.max(vmax, Math.hypot(P.v[mist * 3], P.v[mist * 3 + 1], P.v[mist * 3 + 2])); }
check(P.v[smoke * 3] > 0.8 && P.p[smoke * 3] > 1, `smoke with wind 0.45 bends downwind: after 3 s it moves ${P.v[smoke * 3].toFixed(2)} blocks/s along the wind, ${P.p[smoke * 3].toFixed(2)} blocks off`);
check(Math.abs(P.v[plain * 3]) < 1e-9 && Math.abs(P.p[plain * 3]) < 1e-9, 'a particle without wind stays as it was (the older effects unchanged)');
check(vmax > 0.2 && vmax < 3, `the mist churns (turbulence 1.6) and stays bounded: its speed peaks at ${vmax.toFixed(2)} blocks/s`);

// ---- 3. the halos flicker gently, each lamp on its own phase
console.log('flicker');
let wmin = 2, wmax = 0, cmin = 2, cmax = 0, step = 0, prev = null, apart = 0;
for (let i = 0; i < 6000; i++) {
  const t = i / 60, f = M.flicker(t, 0.37, true), c = M.flicker(t, 0.37, false);
  wmin = Math.min(wmin, f); wmax = Math.max(wmax, f); cmin = Math.min(cmin, c); cmax = Math.max(cmax, c);
  if (prev !== null) step = Math.max(step, Math.abs(f - prev)); prev = f;
  apart = Math.max(apart, Math.abs(M.flicker(t, M.hash3(10, 70, 4), true) - M.flicker(t, M.hash3(18, 70, 4), true)));
}
check(wmin >= 0.79 && wmax <= 1.0 + 1e-9 && wmax - wmin > 0.12, `a warm flame flickers between ${wmin.toFixed(3)} and ${wmax.toFixed(3)} (gently: within 0.8 … 1)`);
check(cmin >= 0.879 && cmax <= 1.0 + 1e-9, `a cool tech light breathes between ${cmin.toFixed(3)} and ${cmax.toFixed(3)}`);
check(step < 0.06, `the flicker is smooth from frame to frame (largest step ${step.toFixed(4)})`);
check(apart > 0.05, 'two lamps flicker on their own phases');

// ---- 4. the glitter path: the mirror of the view meets the sun
console.log('glitter');
const sun = [Math.cos(0.3) * Math.cos(0.25), Math.sin(0.25), Math.sin(0.3) * Math.cos(0.25)];
const eye = [0, 66, 0], d = (66 - 63) / Math.tan(0.25), mirror = [Math.cos(0.3) * d, 63, Math.sin(0.3) * d];
check(M.glitter(eye, mirror, sun, 0.05), 'the point on the water where the mirrored view meets the sun glitters');
check(!M.glitter(eye, [-mirror[0], 63, -mirror[2]], sun, 0.2) && !M.glitter(eye, [mirror[2], 63, -mirror[0]], sun, 0.2), 'the water behind the eye and to the side does not');

// ---- 5. MotionAir in a small world
console.log('the air in a small world');
const R = VR.R, Fl = VR.F;
const stOf = (n) => R.byName[n].defaultState;
const STONE = stOf('stone'), LEAF = stOf('oak_leaves'), WATER = stOf('water'), GRASS = stOf('grass_block');
// ground at y 63 (grass), a canopy of leaves at y 72..73 over x 0..8 with a gap at (4, 4), water at x ≥ 20
const world = {
  topAt: (x, z) => (x >= 0 && x <= 8 && z >= 0 && z <= 8 && !(x === 4 && z === 4)) ? 73 : 63,
  getBlock: (x, y, z) => {
    if (y <= 62) return STONE;
    if (y === 63) return x >= 20 ? WATER : GRASS;
    if ((y === 72 || y === 73) && x >= 0 && x <= 8 && z >= 0 && z <= 8 && !(x === 4 && z === 4)) return LEAF;
    return 0;
  },
};
const fakeGame = { villages: { known: new Map([['h', { plan: { x: 0, z: 0, shops: [{ kind: 'cafe', seats: [[2, 64, 10, 1], [4, 64, 10, 3], [2, 64, 14, 1]] }] } }]]) } };
const DAY = { sunDir: [0, 1, 0], night: 0, rain: 0, snow: 0, wind: 1, windDir: [1, 0] };
function run(tier, E, eyeP, frames) {
  const a = new A(fakeGame); a.setOn(true, tier);
  const parts = { n: 0, live: [], spawn(x, y, z, vx, vy, vz, o) { this.n++; this.live.push({ x, y, z, life: o.life, col: o.col.slice() }); return this.n; } };
  for (let i = 0; i < frames; i++) a.update(1 / 30, { w: world, eye: eyeP, E, particles: parts, drama: true });
  return { a, parts };
}
const r0 = run(0, DAY, [4, 65.6, 12], 300);
check(r0.a.drawn.steam > 0 && r0.a.drawn.tmote === 0 && r0.a.drawn.sparkle === 0 && r0.a.drawn.leaf === 0 && r0.a.drawn.splash === 0, `Very Low: steam only (${JSON.stringify(r0.a.drawn)})`);
const steamPts = r0.parts.live;
check(steamPts.length > 0 && steamPts.every(p => (Math.abs(p.x - 3.5) < 0.6 && Math.abs(p.z - 10.5) < 0.6) || (Math.abs(p.x - 3.5) < 0.6 && Math.abs(p.z - 14.5) < 0.6)), `the steam rises over the café tables the seats face (${steamPts.length} wisps, at x ${[...new Set(steamPts.map(p => Math.floor(p.x)))].join(',')})`);
check(r0.a.drawn.steam <= Math.ceil(10 * M.budgetFor(0).cap.steam / M.AIR_LIFE.steam) + 4, `the steam keeps to its cap: ${r0.a.drawn.steam} wisps in 10 s (cap ${M.budgetFor(0).cap.steam} live, life ${M.AIR_LIFE.steam} s)`);
// motes under the canopy: the sun straight up, the eye under the leaves near the gap
const r2 = run(2, DAY, [4.5, 65.6, 3.5], 300);
const motes = r2.parts.live.filter(p => p.col[2] < 0.9 && p.col[0] > 0.99);
check(r2.a.drawn.tmote > 0 && motes.every(p => Math.floor(p.x) === 4 && Math.floor(p.z) === 4), `motes glow only in the sunbeam through the canopy's gap (${r2.a.drawn.tmote} motes, columns ${[...new Set(motes.map(p => Math.floor(p.x) + ',' + Math.floor(p.z)))].join(' ')})`);
// sparkle: a low sun over the water at x ≥ 20
const LOW = { sunDir: [Math.cos(0.25), Math.sin(0.25), 0], night: 0, rain: 0, snow: 0, wind: 1, windDir: [1, 0] };
const r3 = run(2, LOW, [14, 65.6, 0.5], 300);
check(r3.a.drawn.sparkle > 0 && r3.parts.live.filter(p => p.life < 0.3).every(p => p.x >= 20), `glints only on the water along the sun's path (${r3.a.drawn.sparkle})`);
// a storm: leaves fly; rain: splashes; each within its cap's rate
const STORM = { sunDir: [0, 1, 0], night: 0, rain: 1, snow: 0, wind: 3, windDir: [0, 1] };
const r4 = run(3, STORM, [30, 65.6, 30], 300), cap3 = M.budgetFor(3).cap;
check(r4.a.drawn.leaf > 0 && r4.a.drawn.leaf <= Math.ceil(10 * cap3.leaf / M.AIR_LIFE.leaf) + 4, `a storm tears leaves off: ${r4.a.drawn.leaf} in 10 s (cap ${cap3.leaf})`);
check(r4.a.drawn.splash > 0 && r4.a.drawn.splash <= Math.ceil(10 * cap3.splash / M.AIR_LIFE.splash) + 12, `rain bursts on the ground: ${r4.a.drawn.splash} splashes in 10 s (cap ${cap3.splash})`);
const calm = run(3, DAY, [30, 65.6, 30], 300);
check(calm.a.drawn.leaf === 0 && calm.a.drawn.splash === 0, 'a calm dry day: no storm leaves, no splashes');

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
