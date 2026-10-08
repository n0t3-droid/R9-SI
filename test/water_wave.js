// Water waves (F7 · Wasser): the Gerstner-like surface (src/shared/water_wave.js) — bounded height, unit normals that
// lean against the slope, a normal that matches the height's gradient, deterministic, the body-size curve — and the
// planar reflection's mirror and oblique clip matrices, plus the wind heading of weather.js.
//   bash test/wt_run.sh water_wave.js
require('./load_shared.js');
require('../src/shared/water_wave.js');
require('../src/main/weather.js');
const WW = VR.WaterWave, M4 = VR.mat4;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
let seed = 12345;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const TAU = Math.PI * 2;

// ---- the body-size curve: ponds calm, the open sea rolls, storms make it bigger (bounded)
const bk = (d) => WW.bodyK(d);
let mono = true, lo = 1, hi = 0;
for (let d = 0; d <= 12.0001; d += 0.1) {
  const v = bk(d); if (v < lo) lo = v; if (v > hi) hi = v;
  if (d > 0.05 && v < bk(d - 0.1) - 1e-12) mono = false;
}
check(bk(0) === 0 && bk(12) === 1 && lo >= 0 && hi <= 1, 'body strength runs 0 at the shore to 1 in deep water');
check(mono, 'body strength never falls with depth');
check(bk(1.0) < 0.05, 'a pond one block deep stays calm (body strength ' + bk(1.0).toFixed(3) + ')');
check(WW.stormK(1) >= 0.6 && WW.stormK(3) <= 2.2 && WW.stormK(0) >= 0.6 && WW.stormK(3) > WW.stormK(1), 'storm factor is bounded and grows with wind');
check(WW.ampK(8, 1) > WW.ampK(1, 1) * 5 && WW.ampK(8, 3) > WW.ampK(8, 1), 'deep water rolls more than a pond, and more in a storm');

// ---- height and normals over random samples
const wind = [Math.cos(0.7), Math.sin(0.7)];
let worstH = 0, minNy = 9, worstLen = 0, worstFD = 0, leanOk = true, leanN = 0, reachesHalf = false, moves = false;
for (let i = 0; i < 6000; i++) {
  const x = (rnd() - 0.5) * 400, z = (rnd() - 0.5) * 400, t = rnd() * 600;
  const depth = rnd() * 12, ak = WW.ampK(depth, 1 + rnd() * 2);
  const s = WW.sample(x, z, t, wind[0], wind[1], ak);
  const bound = WW.maxAmplitude(ak);
  worstH = Math.max(worstH, Math.abs(s.h) / Math.max(bound, 1e-9));
  if (Math.abs(s.h) > 0.3 * bound) reachesHalf = true;
  const len = Math.hypot(s.nx, s.ny, s.nz);
  worstLen = Math.max(worstLen, Math.abs(len - 1));
  minNy = Math.min(minNy, s.ny);
  if (i < 300) {
    const e = 1e-4;
    const hx = (WW.sample(x + e, z, t, wind[0], wind[1], ak).h - WW.sample(x - e, z, t, wind[0], wind[1], ak).h) / (2 * e);
    const hz = (WW.sample(x, z + e, t, wind[0], wind[1], ak).h - WW.sample(x, z - e, t, wind[0], wind[1], ak).h) / (2 * e);
    worstFD = Math.max(worstFD, Math.abs(hx - s.gx) / (1 + Math.abs(s.gx)), Math.abs(hz - s.gz) / (1 + Math.abs(s.gz)));
    if (Math.abs(s.gx) > 1e-3) { leanN++; if (Math.sign(s.nx) !== -Math.sign(s.gx)) leanOk = false; }
    const s2 = WW.sample(x, z, t, wind[0], wind[1], ak);
    if (s2.h !== s.h || s2.nx !== s.nx || s2.ny !== s.ny || s2.nz !== s.nz) leanOk = false;   // determinism
    if (WW.sample(x, z, t + 0.37, wind[0], wind[1], ak).h !== s.h) moves = true;
  }
}
check(worstH <= 1 + 1e-9, 'height stays inside the amplitude sum (worst ' + worstH.toFixed(4) + ' of the bound)');
check(reachesHalf, 'the waves really reach their bound in places (not a flat sea)');
check(worstLen < 1e-9, 'every normal has unit length (worst error ' + worstLen.toExponential(2) + ')');
check(minNy > 0.7, 'every normal points up (smallest y ' + minNy.toFixed(3) + ')');
check(worstFD < 1e-3, 'the normal’s slope is the height’s gradient (finite differences, worst ' + worstFD.toExponential(2) + ')');
check(leanN > 200 && leanOk, 'normals lean against the slope, and the same inputs give the same output');
check(moves, 'the surface moves with time');

// ---- the shallow edge is flat, the open water is not
let flatEdge = true;
for (let i = 0; i < 200; i++) { const x = rnd() * 50, z = rnd() * 50, t = rnd() * 60; const s = WW.sample(x, z, t, wind[0], wind[1], WW.ampK(0.2, 1)); if (Math.abs(s.h) > 0.01 || s.ny < 0.999) flatEdge = false; }
check(flatEdge, 'at the shore (0.2 blocks deep) the surface is flat');

// ---- the GLSL text is generated from the same table: the constants and the functions are in it
const g = WW.glsl();
check(g.includes('gerstnerN(') && g.includes('waterBody(') && g.includes('WV_K[3]') && g.includes('WV_T[3]'), 'the GLSL text carries the functions and the tables');
check(WW.OCT.every((o) => g.includes((TAU / o.lam).toFixed(5))), 'the GLSL text carries every wavelength of the table');

// ---- planar reflection: the mirror matrix (column-major, mirror about y = d) and the oblique near plane
const d = 5;
const Mm = WW.mirrorY(M4.create(), d);
const pm = [Mm[0] * 1 + Mm[4] * 2 + Mm[8] * 3 + Mm[12], Mm[1] * 1 + Mm[5] * 2 + Mm[9] * 3 + Mm[13], Mm[2] * 1 + Mm[6] * 2 + Mm[10] * 3 + Mm[14]];
check(Math.abs(pm[0] - 1) < 1e-9 && Math.abs(pm[1] - (2 * d - 2)) < 1e-9 && Math.abs(pm[2] - 3) < 1e-9, 'the mirror maps y to 2d − y and keeps x and z');

const V = M4.lookAt(M4.create(), 0, 0, 0, 0.3, -0.4, -0.866, 0, 1, 0);
const P = M4.perspective(M4.create(), 75 * Math.PI / 180, 16 / 9, 0.06, 1200);
const eyeToWater = -1.62;                                   // the water plane lies 1.62 blocks below the eye
const c = WW.planeInView(M4.create(), V, eyeToWater);
const Po = WW.obliqueProj(M4.create(), P, c);
const VMP = M4.mul(M4.create(), Po, M4.mul(M4.create(), V, WW.mirrorY(M4.create(), eyeToWater)));
let clipOk = true, above = 0, below = 0;
for (let i = 0; i < 4000; i++) {
  const r = [(rnd() - 0.5) * 60, (rnd() - 0.5) * 30, (rnd() - 0.5) * 60];
  const cl = [0, 0, 0, 0];
  for (let k = 0; k < 4; k++) cl[k] = VMP[k] * r[0] + VMP[4 + k] * r[1] + VMP[8 + k] * r[2] + VMP[12 + k];
  const keep = r[1] > eyeToWater;                           // above the water (relative to the eye)
  const zNear = cl[2] + cl[3];                              // OpenGL: inside the near plane when z + w ≥ 0
  if (keep) above++; else below++;
  if (Math.abs(zNear) > 1e-6 && (zNear > 0) !== keep) clipOk = false;
}
check(clipOk && above > 500 && below > 500, 'the oblique near plane clips exactly what lies under the water (' + above + ' kept, ' + below + ' clipped)');
const tp = [0, eyeToWater, 0];                             // a point on the plane itself
const cp = [0, 0, 0, 0];
for (let k = 0; k < 4; k++) cp[k] = VMP[k] * tp[0] + VMP[4 + k] * tp[1] + VMP[8 + k] * tp[2] + VMP[12 + k];
check(Math.abs(cp[2] + cp[3]) < 1e-6, 'points on the water plane sit exactly on the near plane');

// ---- weather: a wind heading per world seed, slow and deterministic
const w1 = new VR.Weather(), w2 = new VR.Weather(), w3 = new VR.Weather();
w1.setSeed(424242); w2.setSeed(424242); w3.setSeed(7);
let same = true, diff = false, unit = true, maxStep = 0, prev = null;
for (let i = 0; i < 2000; i++) {
  const ticks = i * 53;
  w1.update(0.5, { day: 0, ticks, biome: null, dim: 'overworld' });
  w2.update(0.5, { day: 0, ticks, biome: null, dim: 'overworld' });
  w3.update(0.5, { day: 0, ticks, biome: null, dim: 'overworld' });
  const a = w1.windDir, b = w2.windDir;
  if (!a || Math.abs(Math.hypot(a[0], a[1]) - 1) > 1e-9) unit = false;
  if (a[0] !== b[0] || a[1] !== b[1]) same = false;
  if (Math.abs(a[0] - w3.windDir[0]) > 1e-6 || Math.abs(a[1] - w3.windDir[1]) > 1e-6) diff = true;
  const ang = Math.atan2(a[1], a[0]);
  if (prev !== null) { let dA = ang - prev; while (dA > Math.PI) dA -= TAU; while (dA < -Math.PI) dA += TAU; maxStep = Math.max(maxStep, Math.abs(dA)); }
  prev = ang;
}
check(unit, 'the wind heading is a unit vector');
check(same, 'the same world seed gives the same wind at the same time');
check(diff, 'another world seed blows another way');
check(maxStep / 0.5 < 0.05, 'the wind turns slowly (at most ' + (maxStep / 0.5).toFixed(4) + ' rad a second)');

console.log(fails ? fails + ' FAILED' : 'ALL OK');
