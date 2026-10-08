// F3 · Da-Sein (realism wave): the presence curves are bounded, smooth and zero at rest; the FOV kick reaches its value
// in 150 ms; the wind follows the weather (direction drifts slowly, gusts come and go); the living-air budget holds only
// fireflies and snow on Very Low and grows with the tier; a particle spawned with `force` ignores the global budget.
// Node only, no browser.   bash test/wt_run.sh presence.js
require('./load_shared.js');
require('../src/main/weather.js');
require('../src/main/presence.js');
require('../src/main/particles.js');
require('../src/main/airlife.js');
const P = VR.Presence, A = VR.AirLife, WX = VR.WX;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const near = (a, b, e) => Math.abs(a - b) <= (e === undefined ? 1e-9 : e);
const FPS = 60, DT = 1 / FPS;

// ---- FOV: default 75, settable 60–110, the sprint kick is +8 degrees, eased 150 ms
console.log('FOV');
check(P.FOV_DEF === 75 && P.FOV_MIN === 60 && P.FOV_MAX === 110, 'default 75, settable 60–110');
check(P.clampFov(10) === 60 && P.clampFov(500) === 110 && P.clampFov(NaN) === 75 && P.clampFov(90) === 90, 'clampFov keeps the range (NaN takes the default)');
check(P.fovDeg(75, 0) === 75 && near(P.fovDeg(75, 1), 83) && near(P.fovDeg(60, 0.5), 64), 'fovDeg: rest 75, full sprint 83 (+8), half 64 from 60');
check(P.fovDeg(75, 7) === 83 && P.fovDeg(75, -3) === 75, 'the kick stays inside 0..1');
let k = 0, prev = -1, mono = true, peak = 0;
for (let i = 0; i < 60; i++) { const n = P.easeKick(k, 1, DT); if (n < prev - 1e-12) mono = false; prev = n; k = n; peak = Math.max(peak, n); }
check(mono && peak <= 1 && peak > 0.99, 'the kick rises monotonically and never passes 1');
k = 0; for (let i = 0; i < 9; i++) k = P.easeKick(k, 1, DT);
check(k >= 0.95, 'after 150 ms of sprint the kick is at least 95 % (' + k.toFixed(3) + ')');
k = 1; for (let i = 0; i < 9; i++) k = P.easeKick(k, 0, DT);
check(k <= 0.05, 'after 150 ms of walking the kick is back under 5 % (' + k.toFixed(3) + ')');
check(P.easeKick(0, 0, DT) === 0, 'at rest the kick stays at zero');

// ---- head bob: zero at rest, bounded, smooth; the same numbers as the game had before
console.log('bob');
let zeroBob = true; for (let i = 0; i < 200; i++) { const b = P.bobAt(i * 0.37, 0); if (b.x !== 0 || b.y !== 0) zeroBob = false; }
check(zeroBob && P.rollAt(1.3, 0) === 0, 'zero at rest (amount 0), no roll');
let maxX = 0, maxY = 0, maxStep = 0, last = null;
for (let i = 0; i < 6 * FPS; i++) {
  const phase = 2 * (4.3 * (i * DT) * 1.55);       // a walk at 4.3 blocks/s: the phase the player advances
  const b = P.bobAt(phase, 1);
  maxX = Math.max(maxX, Math.abs(b.x)); maxY = Math.max(maxY, b.y);
  if (last) maxStep = Math.max(maxStep, Math.abs(b.x - last.x), Math.abs(b.y - last.y));
  last = b;
}
check(maxX <= 0.035 + 1e-12 && maxY <= 0.05 + 1e-12 && maxY > 0.03, 'bob is bounded (|x| ≤ 0.035, y ≤ 0.05) and reaches its size (x ' + maxX.toFixed(3) + ', y ' + maxY.toFixed(3) + ')');
check(maxStep < 0.012, 'bob is smooth: the largest change between frames is ' + maxStep.toFixed(4) + ' (< 0.012)');
check(Math.abs(P.rollAt(Math.PI / 2, 1)) <= 0.004 + 1e-12, 'roll stays under 0.004 rad');
check(near(P.bobAt(0.5, 0.5).x, P.bobAt(0.5, 1).x * 0.5, 1e-12), 'the bob scales with its amount');

// ---- hand sway: zero at rest, follows the walking speed, bounded and smooth
console.log('hand');
check(P.handSwayAt(0, 1.7).x === 0 && P.handSwayAt(0, 1.7).y === 0, 'the hand does not sway at rest');
let hMax = 0, hStep = 0, hl = null;
for (let i = 0; i < 4 * FPS; i++) { const h = P.handSwayAt(5.6, i * 0.23); hMax = Math.max(hMax, Math.abs(h.x), Math.abs(h.y)); if (hl) hStep = Math.max(hStep, Math.abs(h.x - hl.x), Math.abs(h.y - hl.y)); hl = h; }
check(hMax <= 0.02 + 1e-12 && hMax > 0.01, 'the hand sway is bounded (max ' + hMax.toFixed(4) + ')');
check(hStep < 0.01, 'the hand sway is smooth (largest step ' + hStep.toFixed(4) + ')');
check(Math.abs(P.handSwayAt(40, 2).x) <= 0.02 + 1e-12, 'a very fast walk does not throw the hand off screen');

// ---- landing dip after a fall, bounded and eased back
console.log('landing');
check(P.landingDip(0) === 0 && P.landingDip(0.5) === 0, 'no dip for a step or no fall');
check(P.landingDip(3) > 0.05 && P.landingDip(3) < 0.14, 'a 3-block fall dips the eye ' + P.landingDip(3).toFixed(3) + ' blocks');
check(P.landingDip(200) === 0.14, 'the dip is capped at 0.14 blocks');
const amp = 0.1; let dmax = 0; for (let i = 0; i <= 60; i++) dmax = Math.max(dmax, Math.abs(P.dipAt(i * DT, amp)));
check(dmax <= amp + 1e-12 && dmax > 0.9 * amp, 'the dip curve peaks at the amplitude and never passes it');
check(P.dipAt(0, amp) === 0 && P.dipAt(-1, amp) === 0, 'the dip starts from zero');
check(Math.abs(P.dipAt(0.6, amp)) < 0.002, 'the dip is back to about zero within 0.6 s');

// ---- view nudge (placing and breaking) and the hand push
console.log('feel');
check(P.nudgeAt(0, 0.012) === 0, 'the nudge starts from zero');
let nmax = 0; for (let i = 0; i <= 60; i++) nmax = Math.max(nmax, Math.abs(P.nudgeAt(i * DT, 0.012)));
check(nmax <= 0.012 + 1e-12 && nmax > 0.008, 'the nudge is bounded by its amplitude (max ' + nmax.toFixed(4) + ')');
check(Math.abs(P.nudgeAt(0.3, 0.012)) < 0.0001, 'the nudge is gone after 0.3 s');
let pmax = 0; for (let i = 0; i <= 60; i++) pmax = Math.max(pmax, P.pushAt(i * DT));
check(pmax <= 1 + 1e-12 && pmax > 0.9 && P.pushAt(0) === 0 && P.pushAt(0.6) < 0.01, 'the hand push peaks at 1 and dies away');

// ---- turn inertia: optional, the drawn yaw trails the real yaw by at most 0.03 rad, and catches up at rest
console.log('turn inertia');
check(P.turnFollow(0.2, 1.4, DT, false) === 1.4, 'off: the drawn yaw is the real yaw');
let view = 0, yaw = 0, worst = 0;
for (let i = 0; i < 40; i++) { yaw += 0.12; view = P.turnFollow(view, yaw, DT, true); worst = Math.max(worst, Math.abs(P.wrapPi(yaw - view))); }
check(worst <= 0.03 + 1e-9 && worst > 0.01, 'a fast turn lags by at most 0.03 rad (worst ' + worst.toFixed(4) + ')');
for (let i = 0; i < 120; i++) view = P.turnFollow(view, yaw, DT, true);
check(Math.abs(P.wrapPi(yaw - view)) < 1e-4, 'at rest the drawn yaw catches up within 2 s');
check(Math.abs(P.wrapPi(P.wrapPi(3.1) - P.wrapPi(-3.1)) - P.wrapPi(6.2)) < 1e-9 && Math.abs(P.wrapPi(4) - (4 - 2 * Math.PI)) < 1e-9, 'wrapPi maps angles into (-π, π]');

// ---- wind sway (the mirror of the terrain shader): zero at rest, bounded, follows the wind, gusts swell it
console.log('wind sway');
const z0 = P.windOffset(10.5, 3.2, 4.1, 0, 1, 1, 0, 1, 0), zl = P.windOffset(10.5, 3.2, 4.1, 2, 0, 1, 0, 1, 0);
check(z0.x === 0 && z0.z === 0 && z0.y === 0, 'no sway channel: no movement');
check(zl.x === 0 && zl.z === 0, 'no wind strength: no movement');
const d1 = 0.6, d2 = Math.SQRT1_2;
let wmax = 0, wstep = 0, wl = null, turnErr = 0;
for (let i = 0; i < 6 * FPS; i++) {
  const o = P.windOffset(7.5, -2.25, i * DT, 3, 1.2, d2, d2, 0.0, 0);
  wmax = Math.max(wmax, Math.hypot(o.x, o.z));
  if (wl) wstep = Math.max(wstep, Math.abs(o.x - wl.x), Math.abs(o.z - wl.z));
  wl = o;
  // the sway follows the wind: turning the wind by 45 degrees turns the whole displacement by 45 degrees
  const base = P.windOffset(7.5, -2.25, i * DT, 3, 1.2, 1, 0, 0.0, 0);
  const rx = base.x * d2 - base.z * d2, rz = base.x * d2 + base.z * d2;
  turnErr = Math.max(turnErr, Math.abs(rx - o.x), Math.abs(rz - o.z));
}
check(wmax <= 1.6 * 0.11 * 1.2 + 1e-9 && wmax > 0.05, 'wind sway is bounded (max ' + wmax.toFixed(3) + ' blocks)');
check(wstep < 0.02, 'wind sway is smooth (largest step ' + wstep.toFixed(4) + ')');
check(turnErr < 1e-12, 'the sway follows the wind: a 45-degree wind turns the sway by 45 degrees (error ' + turnErr.toExponential(1) + ')');
// the old formula: with the wind on +x and no gust the sway is exactly the old one (x along, z across)
const t0 = 1.7, ph0 = 10.5 * 0.37 + 3.2 * 0.29, t = t0 * 1.6, amp0 = 2 / 3 * 0.11 * 1.5;
const oldX = Math.sin(t + ph0) * amp0 + Math.sin(t * 2.3 + ph0 * 1.7) * amp0 * 0.35, oldZ = Math.cos(t * 0.9 + ph0 * 1.3) * amp0 * 0.8;
const nw = P.windOffset(10.5, 3.2, t0, 2, 1.5, 1, 0, 0, 0);
check(near(nw.x, oldX, 1e-12) && near(nw.z, oldZ, 1e-12), 'wind on +x, no gust: exactly the old sway formula');
const g0 = P.windOffset(10.5, 3.2, 1.7, 2, 1.5, 1, 0, 0, 0), g1 = P.windOffset(10.5, 3.2, 1.7, 2, 1.5, 1, 0, 1, 0);
check(Math.hypot(g1.x, g1.z) > Math.hypot(g0.x, g0.z) * 1.2 && Math.hypot(g1.x, g1.z) <= Math.hypot(g0.x, g0.z) * 1.5 + 1e-9, 'a full gust swells the sway by up to 50 %');
const lf = P.windOffset(4, 4, 2.2, 0, 1, 1, 0, 0, 1);
check(lf.y !== 0 && Math.abs(lf.y) <= 0.015 + 1e-12 && lf.x !== 0, 'leaves also flutter in height, by at most 0.015');

// ---- weather wind: the direction drifts slowly, gusts come and go, both bounded, the same for the same seed
console.log('weather wind');
const wx = new VR.Weather({});
wx.setSeed(12345);
let angPrev = null, angMax = 0, gMax = 0, gMin = 1, gOn = 0, gSteps = 0, gRuns = [], run = 0;
for (let i = 0; i < 90 * FPS; i++) {
  wx.update(DT, { ticks: 6000 + i * DT * 20, day: 1, biome: null, dim: 'overworld', lowK: 0 });
  const a = wx.windAng;
  if (!Number.isFinite(a) || !Number.isFinite(wx.gust)) { check(false, 'wind angle and gust are finite'); break; }
  if (angPrev !== null) angMax = Math.max(angMax, Math.abs(P.wrapPi(a - angPrev)));
  angPrev = a;
  gMax = Math.max(gMax, wx.gust); gMin = Math.min(gMin, wx.gust);
  if (wx.gust > 0.2) { gOn++; run++; } else if (run) { gRuns.push(run); run = 0; }
  gSteps++;
}
check(gMin >= 0 && gMax <= 1 && gMax > 0.5 && gMin === 0, 'gust is in 0..1 and comes (max ' + gMax.toFixed(2) + ', min ' + gMin + ')');
const longest = Math.max(0, ...gRuns) / FPS;
check(longest < 4, 'a gust lasts under 4 s (longest ' + longest.toFixed(2) + ' s)');
check(gOn / gSteps < 0.5, 'gusts are the exception, not the rule (' + Math.round(100 * gOn / gSteps) + ' % of the time)');
check(angMax < 0.05, 'the direction turns slowly (largest turn in one frame ' + angMax.toFixed(4) + ' rad)');
const wy = new VR.Weather({}); wy.setSeed(12345);
wy.update(DT, { ticks: 6000, day: 1, biome: null, dim: 'overworld', lowK: 0 });
const wz = new VR.Weather({}); wz.setSeed(777);
wz.update(DT, { ticks: 6000, day: 1, biome: null, dim: 'overworld', lowK: 0 });
const wsame = new VR.Weather({}); wsame.setSeed(12345); wsame.update(DT, { ticks: 6000, day: 1, biome: null, dim: 'overworld', lowK: 0 });
check(wy.windAng === wsame.windAng && wy.windAng !== wz.windAng, 'the same seed gives the same wind; another seed another wind');
check(WX.windDirVec(0).every((v, i) => near(v, [1, 0][i], 1e-12)), 'windDirVec(0) points along +x');

// ---- the living air budget per tier: Very Low holds fireflies and snow only; caps grow with the tier
console.log('air budget');
const KINDS = ['mote', 'pollen', 'firefly', 'leaf', 'snow', 'butterfly', 'bird'];
const b0 = A.budgetFor(0), b4 = A.budgetFor(4);
check(b0.kinds.slice().sort().join() === 'firefly,snow', 'Very Low: fireflies and snow only (' + b0.kinds.join(',') + ')');
check(KINDS.every(k => b4.kinds.includes(k)), 'Ultra: every kind is on');
let mono2 = true;
for (let tier = 1; tier <= 4; tier++) for (const k of KINDS) { if ((A.budgetFor(tier).cap[k] || 0) < (A.budgetFor(tier - 1).cap[k] || 0)) mono2 = false; }
check(mono2, 'every cap is monotone in the tier');
const tot0 = Object.values(b0.cap).reduce((a, c) => a + c, 0);
check(tot0 <= 80, 'Very Low air budget is small (' + tot0 + ' live agents at most)');
check(A.tierOf({ preset: 'potato', particles: 0 }) === 0 && A.tierOf({ preset: 'low', particles: 1 }) === 1 && A.tierOf({ preset: 'balanced', particles: 2 }) === 2 && A.tierOf({ preset: 'high', particles: 2 }) === 3 && A.tierOf({ preset: 'ultra', particles: 2 }) === 4, 'tierOf: the presets map to tiers 0–4');
check(A.tierOf({ preset: 'custom', particles: 0 }) === 0 && A.tierOf({ preset: 'custom', particles: 2 }) === 2, 'tierOf: a custom setup uses its particle level');
check(A.tierOf({}) === 2 && A.tierOf(null) === 2, 'tierOf: an unknown setup is balanced');

// ---- the particle system: a spawn with force ignores the global budget, a spawn without it does not
console.log('particles');
const ps = new VR.Particles({ world: null });
ps.budget = 0;
const iForce = ps.spawn(1, 2, 3, 0, 0, 0, { life: 1, force: true });
const iPlain = ps.spawn(1, 2, 3, 0, 0, 0, { life: 1 });
check(iForce >= 0 && iPlain === -1 && ps.n === 1, 'force spawns through a zero budget, a plain spawn does not');

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
