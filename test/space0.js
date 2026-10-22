// u-space0 · the space scene's pure parts (docs/superpowers/plans/2026-10-22-u-space0.md §3): the robust impostor and
// the oblate giant, the ring (its optical depth after REFERENCE §4.2, the planet's shadow on it, its shadow on the
// planet), the fallback ephemeris (the numbers of U§2.1, Herzwelt's spin against the world clock), Herzwelt's chart, the
// views of /raum, and the bodytex jobs (their shape, their colours, their time: ≤ 0.8 s a body at 512×256).
//   bash test/wt_run.sh space0.js 300
const V = require('./load_shared.js');
require('../src/shared/bodytex.js');
require('../src/main/space_shaders.js');
require('../src/main/spacescene.js');
const BT = V.BodyTex, SS = V.SpaceScene, SH = V.SpaceShaders;
let fails = 0;
const check = (ok, msg) => { console.log((ok ? '  ✓ ' : '  ✗ ') + msg); if (!ok) fails++; };
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const cpuMs = (f) => { const c0 = process.cpuUsage(); const r = f(); const c = process.cpuUsage(c0); return { r, ms: (c.user + c.system) / 1000 }; };
check(!!BT && !!SS && !!SS.math && !!SH, 'VR.BodyTex, VR.SpaceScene (with its math) and VR.SpaceShaders load in node');
if (!BT || !SS || !SS.math) { console.log('FAILED ' + fails); process.exit(1); }
const M = SS.math;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = (a) => Math.hypot(a[0], a[1], a[2]);
const nrm = (a) => { const l = len(a); return [a[0] / l, a[1] / l, a[2] / l]; };

// ---------------------------------------------------------------- 1 · the impostor: one quad, analytic ray–sphere
console.log('impostor');
{
  // the impostor frame: the body at distance d (radii) along +w; a ray (u, v, w) from the camera
  const h0 = M.impostorHit(10, 0, 0, 1);
  check(h0.hit && near(h0.t, 9, 1e-9) && near(h0.N[2], -1, 1e-9), `the centre ray of a body 10 radii off hits at 9 radii, facing the camera (t ${h0.t.toFixed(6)})`);
  const a = Math.asin(1 / 10);
  check(M.impostorHit(10, Math.sin(a * 0.999), 0, Math.cos(a * 0.999)).hit && !M.impostorHit(10, Math.sin(a * 1.001), 0, Math.cos(a * 1.001)).hit, 'the silhouette sits at asin(1/d) (inside hits, outside misses)');
  // far away: the closest approach |q| = d·sin α without cancellation (floats in the shader; here the same formula in doubles
  // against the exact one, and in float32 rounding)
  const f32 = Math.fround, d = 1e5, s = 0.6 / d, c = Math.sqrt(1 - s * s);
  const exact = d * s;   // 0.6
  const naive = (() => { const O = [0, 0, f32(d)], D = [f32(s), 0, f32(c)]; const b = f32(f32(O[2] * D[2])); const cc = f32(f32(O[2] * O[2]) - 1); return Math.sqrt(Math.max(0, f32(cc - f32(b * b)) + 1)); })();
  const robust = M.impostorHit(f32(d), f32(s), 0, f32(c));
  check(robust.hit && near(robust.q, exact, 1e-4), `at 10⁵ radii the robust form keeps the closest approach (${robust.q.toFixed(6)} for ${exact}; the naive float form gives ${naive.toFixed(3)})`);
  check(near(len(robust.N), 1, 1e-6) && robust.N[2] < 0, 'its normal is a unit vector on the near side');
  // Amarant: 9.8 % oblate — seen from the equator plane its silhouette is 0.902 as tall as wide
  const fl = SS.BODIES.amarant.Rp / SS.BODIES.amarant.R;
  check(near(fl, 0.902, 0.001), `Amarant's polar radius is ${(fl * 100).toFixed(1)} % of the equatorial (9.8 % oblate)`);
  const O = [0, 0, -5];   // 5 equatorial radii off, in the equator plane, the axis = y
  const edge = (dir) => { let lo = 0, hi = 0.5; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; const D = nrm(dir === 'x' ? [m, 0, 1] : [0, m, 1]); if (M.ellipsoidHit(O, D, fl).hit) lo = m; else hi = m; } return lo; };
  const ex = edge('x'), ey = edge('y');
  // the tangents from 5 radii: a circle of radius 1 → 1/√24; the ellipse's semi-axis fl across → fl/√24 (the tangent from
  // (0, −5) to z² + y²/fl² = 1 has the slope fl/√(25 − 1))
  const wantX = 1 / Math.sqrt(24), wantY = fl / Math.sqrt(24);
  check(near(ex, wantX, 2e-4) && near(ey, wantY, 2e-4), `its silhouette: ${ex.toFixed(4)} wide, ${ey.toFixed(4)} tall (tan; ${wantX.toFixed(4)} / ${wantY.toFixed(4)})`);
}

// ---------------------------------------------------------------- 2 · the ring
console.log('ring');
{
  const tau = BT.ringTau;
  check(tau(1.1) === 0 && tau(2.4) === 0, 'no ring inside 1.24 R and outside 2.27 R');
  let cmax = 0, cmin = 9; for (let r = 1.26; r < 1.52; r += 0.005) { cmax = Math.max(cmax, tau(r)); cmin = Math.min(cmin, tau(r)); }
  let bmax = 0, bmin = 9; for (let r = 1.55; r < 1.94; r += 0.005) { bmax = Math.max(bmax, tau(r)); bmin = Math.min(bmin, tau(r)); }
  let gmax = 0; for (let r = 1.96; r < 2.02; r += 0.002) gmax = Math.max(gmax, tau(r));
  let amax = 0, amin = 9; for (let r = 2.05; r < 2.26; r += 0.003) { if (Math.abs(r - BT.RING.gap5) < 0.004) continue; amax = Math.max(amax, tau(r)); amin = Math.min(amin, tau(r)); }
  check(cmin >= 0.04 && cmax <= 0.4, `the C ring is translucent: τ ${cmin.toFixed(2)}–${cmax.toFixed(2)} (REFERENCE §4.2: 0.05–0.35)`);
  check(bmin >= 0.4 && bmax >= 1.8 && bmax <= 2.6, `the B ring is opaque: τ ${bmin.toFixed(2)}–${bmax.toFixed(2)} (0.4–2.5)`);
  check(gmax <= 0.12, `the Cassini gap (73 km = ${(BT.RING.cassini[1] - BT.RING.cassini[0]).toFixed(3)} R) is nearly empty: τ ≤ ${gmax.toFixed(3)}`);
  check(amin >= 0.3 && amax <= 1.05, `the A ring: τ ${amin.toFixed(2)}–${amax.toFixed(2)} (0.4–1.0)`);
  check(tau(BT.RING.gap5) < 0.05 && near((BT.RING.cassini[1] - BT.RING.cassini[0]) * SS.BODIES.amarant.R, 73000, 3000), 'the 5-km gap is empty, the Cassini gap 73 km wide');
  const fl = SS.BODIES.amarant.Rp / SS.BODIES.amarant.R;
  // the planet's shadow on the ring: Helia in the ring plane along +x; a ring point behind the planet (−x) is dark, one in front lit
  const L = [1, 0, 0];
  check(M.planetShadowOnRing([-1.5, 0, 0], L, fl) < 0.05 && M.planetShadowOnRing([1.5, 0, 0], L, fl) > 0.95 && M.planetShadowOnRing([0, 0, 1.5], L, fl) > 0.95, 'the planet shades the ring behind it, not in front or beside it');
  // the shadow's edge is soft by Helia's 0.21° (penumbra ≤ 0.02 R wide at 1.5 R), sharp otherwise
  let soft = 0; for (let z = 0.95; z < 1.05; z += 0.001) { const v = M.planetShadowOnRing([-1.5, 0, z], L, fl); if (v > 0.05 && v < 0.95) soft++; }
  check(soft > 0 && soft <= 20, `the shadow's penumbra is narrow (${soft} steps of 0.001 R)`);
  // the ring's shadow on the planet: Helia 12° above the ring plane (north): the light crosses the ring going south, the
  // shadow falls on the southern hemisphere; a northern point is not touched
  const Ls = [Math.cos(12 * D2R), Math.sin(12 * D2R), 0];
  let darkest = 1, darkLat = 0;
  for (let lat = -60; lat <= 0; lat += 0.5) { const N = [Math.cos(lat * D2R), Math.sin(lat * D2R), 0]; const tr = M.ringShadowOnPlanet(N, Ls, BT.ringTau); if (tr < darkest) { darkest = tr; darkLat = lat; } }
  check(darkest < 0.3 && darkLat < -5, `the ring's shadow darkens a southern band (transmittance ${darkest.toFixed(3)} at ${darkLat}°)`);
  check(M.ringShadowOnPlanet([Math.cos(20 * D2R), Math.sin(20 * D2R), 0], Ls, BT.ringTau) === 1, 'the northern hemisphere is not shaded');
}

// ---------------------------------------------------------------- 3 · the fallback ephemeris (U§2.1)
console.log('ephemeris');
const E0 = SS.fallback(0, {});
{
  const B = SS.BODIES, P = (id, e) => (e || E0).bodies[id].p;
  const ang = (from, id, e) => { const d = len(sub(P(id, e), from)); return 2 * Math.asin(B[id].R / d) * R2D; };
  const surf = (id, toward, e) => { const c = P(id, e), dir = nrm(sub(P(toward, e), c)); return [c[0] + dir[0] * B[id].R, c[1] + dir[1] * B[id].R, c[2] + dir[2] * B[id].R]; };
  const rel = (a, b) => Math.abs(a - b) / b;
  const aH = ang(surf('herz', 'amarant'), 'amarant'), qH = ang(surf('herz', 'aqua'), 'aqua'), aZ = ang(surf('zinn', 'amarant'), 'amarant');
  const hA = 2 * Math.asin(B.helia.R / len(sub(P('helia'), P('amarant')))) * R2D;
  check(rel(aH, 14.0) < 0.005, `Amarant from Herzwelt ${aH.toFixed(2)}° (U§2.1: 14.0°)`);
  check(rel(qH, 9.8) < 0.005, `Aquamarin from Herzwelt ${qH.toFixed(2)}° (9.8°)`);
  check(rel(aZ, 37.2) < 0.005, `Amarant from Zinnober ${aZ.toFixed(2)}° (37.2°)`);
  check(rel(hA, 0.42) < 0.01, `Helia from Amarant ${hA.toFixed(3)}° (0.42°)`);
  const n = E0.bodies.amarant.axis, s = nrm(sub(P('helia'), P('amarant')));
  const el = Math.asin(dot(s, n)) * R2D;
  check(near(el, 12, 0.05), `at t 0 Helia stands ${el.toFixed(2)}° above the ring plane (12°)`);
  const E1 = SS.fallback(86400, {}), s1 = nrm(sub(E1.bodies.helia.p, E1.bodies.amarant.p)), el1 = Math.asin(dot(s1, E1.bodies.amarant.axis)) * R2D;
  check(near(el1 - el, 0.4, 0.06), `it drifts ${(el1 - el).toFixed(2)}° a day (0.4°)`);
  // Kepler: the moons' periods follow from Amarant's μ = g·R² (35 m/s² at the cloud tops)
  const mu = 35 * B.amarant.R * B.amarant.R, T = (a) => 2 * Math.PI * Math.sqrt(a * a * a / mu);
  let kep = 0; for (const id of ['herz', 'zinn', 'opal', 'basalt', 'ocker']) kep = Math.max(kep, rel(T(B[id].a), B[id].P));
  check(kep < 0.01, `Kepler's third law holds for Amarant's moons (worst ${(kep * 100).toFixed(2)} %)`);
  // the bodies move on their orbits: Herzwelt's distance to Amarant stays a, its period is P
  const dH = (t) => len(sub(SS.fallback(t, {}).bodies.herz.p, SS.fallback(t, {}).bodies.amarant.p));
  check(near(dH(0), B.herz.a, 1) && near(dH(5000), B.herz.a, 1), 'Herzwelt circles Amarant at 7,792 km');
  const ph = (t) => { const e = SS.fallback(t, {}); return sub(e.bodies.herz.p, e.bodies.amarant.p); };
  check(len(sub(ph(B.herz.P), ph(0))) < 10, 'and comes round after 6.83 h');
  // Herzwelt's spin against the world clock: the Heartland's noon at tick 6000 (Helia 24.06° high), sunrise at tick 0
  // in the true east, sunset at tick 12000 in the west
  const sunAt = (day, ticks) => { const e = SS.fallback(SS.worldTime(day, ticks), {}); return SS.localSun(e, BT.CHART.thetaH, 0); };
  const noon = sunAt(3, 6000), rise = sunAt(3, 0), set = sunAt(7, 12000), night = sunAt(2, 18000);
  check(near(noon.el * R2D, 24.06, 0.3), `the Heartland's noon (tick 6000): Helia ${(noon.el * R2D).toFixed(2)}° high (env.js 0.42 rad = 24.06°)`);
  check(near(rise.el * R2D, 0, 0.3) && near(rise.az * R2D, 90, 2.6), `sunrise (tick 0): ${(rise.el * R2D).toFixed(2)}° high in the true east (azimuth ${(rise.az * R2D).toFixed(1)}°)`);
  check(near(set.el * R2D, 0, 0.3) && near(set.az * R2D, 270, 2.6), `sunset (tick 12000): ${(set.el * R2D).toFixed(2)}° in the west (azimuth ${(set.az * R2D).toFixed(1)}°)`);
  check(near(night.el * R2D, -24.06, 0.3), `midnight (tick 18000): Helia ${(night.el * R2D).toFixed(2)}° below the horizon`);
  // the ephemeris takes VR.Universe when it is there (u-orbit, the same wave) and falls back without it
  const keep = V.Universe;
  V.Universe = { state: (t) => ({ t, bodies: { amarant: { p: [1, 2, 3] } } }) };
  const eU = SS.ephemeris(0, {});
  check(eU && eU.bodies && eU.bodies.herz && len(eU.bodies.herz.p) > 1e9, 'an incomplete VR.Universe.state falls back to the table (the merge swaps SS.fromUniverse)');
  V.Universe = keep;
}

// ---------------------------------------------------------------- 4 · Herzwelt's chart (U§4.5)
console.log('chart');
{
  const C = BT.CHART;
  check(near(C.thetaH * R2D, 24.06, 0.01) && near(90 - C.thetaH * R2D, 65.94, 0.01), `the Heartland lies at ${(90 - C.thetaH * R2D).toFixed(2)}° N, 41.8 km from the pole`);
  const s0 = BT.toSphere(0, 0);
  check(near(s0[0], C.thetaH, 1e-9) && near(s0[1], 0, 1e-9), 'the Heartland (0, 0) is λ 0');
  let worst = 0;
  for (const [x, z] of [[0, 0], [1234.5, -987.25], [-250000, 120000], [180000, 240000], [16264.123, -38504.5 + 300000]]) {
    const [th, lam] = BT.toSphere(x, z), [x2, z2] = BT.toPlane(th, lam);
    worst = Math.max(worst, Math.hypot(x2 - x, z2 - z));
  }
  check(worst < 0.001, `plane → sphere → plane round trips within ${(worst * 1000).toFixed(4)} mm (< 1 mm)`);
  // the map's true north at the Heartland is 22.9° east of map north (env.js's noon sun stands due true south)
  const [thN] = BT.toSphere(Math.sin(22.9 * D2R) * 100, -Math.cos(22.9 * D2R) * 100);
  check(near(C.thetaH - thN, 100 / C.R, 1e-6), 'walking 100 blocks toward true north (22.9° east of map north) brings the pole 100 blocks nearer');
}

// ---------------------------------------------------------------- 5 · the views of /raum
console.log('views');
{
  const t = SS.worldTime(2, 6000);
  const e = SS.fallback(t, {});
  const B = SS.BODIES;
  const vH = SS.view('herz', e, { x: 0, z: 0, yaw: 0 });
  const altH = len(sub(vH.pos, e.bodies.herz.p)) - B.herz.R;
  check(near(altH, 3000, 1), `herz: 3 km over the Heartland (${altH.toFixed(1)} m)`);
  const upH = nrm(sub(vH.pos, e.bodies.herz.p)), dip = Math.acos(B.herz.R / (B.herz.R + 3000));
  const fwdEl = Math.asin(dot(vH.fwd, upH));
  check(fwdEl < -dip && fwdEl > -dip - 0.35, `herz: the view looks ${(-fwdEl * R2D).toFixed(1)}° down — the limb (dip ${(dip * R2D).toFixed(1)}°) in the upper half`);
  check(near(dot(vH.up, upH), Math.cos(fwdEl), 1e-6), 'herz: the horizon is level (the camera\'s up lies in the plane of the local vertical)');
  const vZ = SS.view('zinn', e, {});
  const toA = sub(e.bodies.amarant.p, vZ.pos), aZ = 2 * Math.asin(B.amarant.R / len(toA)) * R2D, offZ = Math.acos(dot(nrm(toA), vZ.fwd)) * R2D;
  const altZ = len(sub(vZ.pos, e.bodies.zinn.p)) - B.zinn.R;
  check(near(altZ, 3000, 1) && aZ > 35 && aZ < 39 && offZ < 12, `zinn: 3 km over Zinnober, Amarant ${aZ.toFixed(1)}° wide, ${offZ.toFixed(1)}° off the view's centre`);
  const vA = SS.view('amarant', e, { x: 0, z: 0 });
  const toAm = sub(e.bodies.amarant.p, vA.pos), elA = Math.asin(dot(nrm(toAm), nrm(sub(vA.pos, e.bodies.herz.p)))) * R2D, offA = Math.acos(dot(nrm(toAm), vA.fwd)) * R2D;
  check(near(len(sub(vA.pos, e.bodies.herz.p)) - B.herz.R, 3000, 1) && elA > -6 && elA < 6 && offA < 10, `amarant: 3 km over Herzwelt, Amarant ${elA.toFixed(1)}° high (just over the limb), ${offA.toFixed(1)}° off centre`);
  const vQ = SS.view('aqua', e, {});
  const cQ = Math.acos(dot(nrm(sub(e.bodies.aqua.p, vQ.pos)), vQ.fwd)) * R2D, cHz = Math.acos(dot(nrm(sub(e.bodies.herz.p, vQ.pos)), vQ.fwd)) * R2D;
  const sQ = 2 * Math.asin(B.aqua.R / len(sub(e.bodies.aqua.p, vQ.pos))) * R2D, sHz = 2 * Math.asin(B.herz.R / len(sub(e.bodies.herz.p, vQ.pos))) * R2D;
  check(cQ + sQ / 2 < vQ.fov * R2D * 0.5 * 1.55 && cHz + sHz / 2 < vQ.fov * R2D * 0.5 * 1.55 && sQ > sHz, `aqua: Aquamarin (${sQ.toFixed(1)}°) and Herzwelt behind it (${sHz.toFixed(1)}°) both in the picture`);
  // the times that give each view its light (the browser test asks for them): a lit giant, a lit pair
  const tz = SS.findTime('zinn', t), ta = SS.findTime('aqua', t);
  check(tz >= t && tz < t + 6 * 3600 && ta >= t && ta < t + 6 * 3600, `findTime finds a moment for zinn (+${((tz - t) / 60).toFixed(0)} min) and aqua (+${((ta - t) / 60).toFixed(0)} min)`);
}

// ---------------------------------------------------------------- 6 · the bodytex jobs
console.log('bodytex');
{
  const g = new V.OverworldGen(1234567, { vgen: 11 });
  const gen = () => g;
  const lum = (a, i) => 0.2126 * a[i] + 0.7152 * a[i + 1] + 0.0722 * a[i + 2];
  // warm the generator and the jit (a worker has made chunks before anyone opens the view)
  BT.job({ type: 'bodytex', body: 'herz', w: 64, h: 32, y0: 0, y1: 32 }, gen);
  const J = cpuMs(() => BT.job({ type: 'bodytex', body: 'herz', w: 512, h: 256, y0: 0, y1: 256 }, gen));
  const r = J.r;
  check(r.type === 'bodytex' && r.w === 512 && r.h === 256 && r.y0 === 0 && r.y1 === 256 && r.a.length === 512 * 256 * 4 && r.b.length === 512 * 256 * 4, 'herz: 512×256 rows of two RGBA textures (albedo + water, lights · clouds · relief · kind)');
  check(J.ms <= 800, `herz: ${J.ms.toFixed(0)} ms of CPU for 512×256 (budget 800 ms)`);
  let water = 0, n = 512 * 256; for (let i = 0; i < n; i++) if (r.a[i * 4 + 3] > 127) water++;
  check(water / n > 0.2 && water / n < 0.42, `herz: ${(water / n * 100).toFixed(1)} % water (the generator's ~30 %)`);
  let cl = 0; for (let i = 0; i < n; i++) cl += r.b[i * 4 + 1]; cl /= n * 255;
  check(cl > 0.2 && cl < 0.6, `herz: clouds cover ${(cl * 100).toFixed(0)} % on average`);
  const hi = Math.floor(BT.CHART.thetaH / Math.PI * 256) * 512 * 4 + 256 * 4;
  check(r.a[hi + 3] < 128, 'herz: the Heartland\'s texel is land');
  check(r.transfer && r.transfer.length === 2, 'herz: both buffers are handed over (transfer)');
  // rows: a job for part of the rows gives the same texels
  const part = BT.job({ type: 'bodytex', body: 'herz', w: 512, h: 256, y0: 100, y1: 140 }, gen);
  let same = part.a.length === 40 * 512 * 4; for (let i = 0; same && i < part.a.length; i += 97) if (part.a[i] !== r.a[100 * 512 * 4 + i]) same = false;
  check(same, 'herz: a job for rows 100–140 gives the same texels as the whole');
  // the patch round a nadir: the world's own mosaic at 100 m a texel, the villages' lights
  const P = cpuMs(() => BT.job({ type: 'bodytex', body: 'patch', w: 512, h: 512, y0: 0, y1: 128, cx: 0, cz: 0, step: 100 }, gen));
  check(P.r.w === 512 && P.r.y1 - P.r.y0 === 128 && P.r.a.length === 512 * 128 * 4, 'patch: 128 rows of 512 texels');
  check(P.ms <= 800, `patch: ${P.ms.toFixed(0)} ms of CPU for 128 rows (a job; the 512² patch is four of them)`);
  const Pc = BT.job({ type: 'bodytex', body: 'patch', w: 512, h: 512, y0: 248, y1: 264, cx: 0, cz: 0, step: 100 }, gen);
  let lights = 0, lit = 0; for (let i = 0; i < Pc.b.length; i += 4) { lights = Math.max(lights, Pc.b[i]); if (Pc.b[i] > 20) lit++; }
  const mid = (8 * 512 + 256) * 4;
  check(Pc.a[mid + 3] < 128 && Pc.b[mid] > 60, `patch: the Heartland is land with its lights on (${Pc.b[mid]})`);
  let pw = 0; for (let i = 0; i < P.r.a.length; i += 4) if (P.r.a[i + 3] > 127) pw++;
  check(pw / (512 * 128) > 0.15 && pw / (512 * 128) < 0.45, `patch: ${(pw / 512 / 128 * 100).toFixed(1)} % water`);
  const Pv = BT.job({ type: 'bodytex', body: 'patch', w: 256, h: 256, y0: 0, y1: 256, cx: 20000, cz: 9000, step: 200 }, gen);
  let vl = 0; for (let i = 0; i < Pv.b.length; i += 4) if (Pv.b[i] > 40) vl++;
  check(vl > 40, `patch: villages light up the night far from the Heartland too (${vl} lit texels of 65,536 on 51 × 51 km)`);
  // Amarant: zones and belts by latitude
  const A = cpuMs(() => BT.job({ type: 'bodytex', body: 'amarant', w: 512, h: 256, y0: 0, y1: 256 }, gen));
  const rowL = (k) => { let s = 0; for (let i = 0; i < 512; i++) s += lum(A.r.a, (k * 512 + i) * 4); return s / 512; };
  let rmin = 1e9, rmax = 0; for (let k = 40; k < 216; k++) { const v = rowL(k); rmin = Math.min(rmin, v); rmax = Math.max(rmax, v); }
  check(rmax - rmin > 30, `amarant: bands — the rows' brightness runs ${rmin.toFixed(0)}–${rmax.toFixed(0)}`);
  let lilac = 0; for (let i = 0; i < A.r.a.length; i += 4) if (A.r.a[i + 2] > A.r.a[i + 1] + 12 && A.r.a[i] > A.r.a[i + 1]) lilac++;
  check(lilac / (512 * 256) > 0.15, `amarant: lilac-violet belts (${(lilac / 512 / 256 * 100).toFixed(0)} % of the texels)`);
  check(A.ms <= 800, `amarant: ${A.ms.toFixed(0)} ms of CPU for 512×256 (a job's budget 800 ms; High's 1024×512 is cut into rows)`);
  // the ring's profile: its colour and τ (alpha = τ / 3)
  const Rg = BT.job({ type: 'bodytex', body: 'ring', w: 2048, h: 1, y0: 0, y1: 1 }, gen);
  let rok = true; for (let i = 0; i < 2048; i += 7) { const rr = BT.RING.r0 + (i + 0.5) / 2048 * (BT.RING.r1 - BT.RING.r0); const t = Rg.a[i * 4 + 3] / 255 * 3; if (Math.abs(t - Math.min(3, BT.ringTau(rr))) > 0.03 + 0.25 * BT.ringTau(rr)) { rok = false; console.log('     ring texel', i, rr.toFixed(3), t.toFixed(3), BT.ringTau(rr).toFixed(3)); break; } }
  check(Rg.a.length === 2048 * 4 && rok, 'ring: 2048 radial texels, τ in alpha (the fine ringlets within 25 % of the profile)');
  // the moons, from palette noise on the sphere
  const moon = (id) => BT.job({ type: 'bodytex', body: id, w: 256, h: 128, y0: 0, y1: 128 }, gen);
  const stat = (a) => { let r = 0, gg = 0, b = 0, l2 = 0, l = 0; const n = a.length / 4; for (let i = 0; i < a.length; i += 4) { r += a[i]; gg += a[i + 1]; b += a[i + 2]; const L = lum(a, i); l += L; l2 += L * L; } return { r: r / n, g: gg / n, b: b / n, l: l / n, sd: Math.sqrt(Math.max(0, l2 / n - (l / n) ** 2)) }; };
  const q = stat(moon('aqua').a), z = stat(moon('zinn').a), o = stat(moon('opal').a), ba = stat(moon('basalt').a), ok = stat(moon('ocker').a);
  check(q.b > q.r + 20, `aqua: blue-green seas (r ${q.r.toFixed(0)} g ${q.g.toFixed(0)} b ${q.b.toFixed(0)})`);
  check(z.r > z.b + 40 && z.g > z.b + 20, `zinn: sulfur yellows (r ${z.r.toFixed(0)} g ${z.g.toFixed(0)} b ${z.b.toFixed(0)})`);
  check(o.l > 165, `opal: bright ice (luminance ${o.l.toFixed(0)})`);
  check(Math.abs(ba.r - ba.b) < 25 && ba.sd > 8, `basalt: grey, maria and highlands (r ${ba.r.toFixed(0)} b ${ba.b.toFixed(0)}, spread ${ba.sd.toFixed(1)})`);
  check(ok.r > ok.b + 40, `ocker: rust dust (r ${ok.r.toFixed(0)} b ${ok.b.toFixed(0)})`);
  for (const [id, s] of [['aqua', q], ['zinn', z], ['opal', o], ['basalt', ba], ['ocker', ok]]) if (s.sd < 4) check(false, id + ' is a flat colour');
  // the jobs of a texture: rows split so no job runs longer than the budget, the sizes by tier
  const jl = BT.jobs('herz', 3), jp = BT.jobs('patch', 0, { cx: 0, cz: 0 });
  check(jl.length >= 2 && jl.every(j => j.y1 > j.y0 && j.w === BT.size('herz', 3)[0]) && jp.length >= 2, `High's Herzwelt in ${jl.length} jobs of rows, Very Low's patch in ${jp.length}`);
  check(BT.size('herz', 0)[0] === 512 && BT.size('herz', 0)[1] === 256 && BT.size('moon', 0)[0] === 256, 'Very Low: Herzwelt 512×256, the moons 256×128');
}

// ---------------------------------------------------------------- 7 · the shaders are there and the budget holds
console.log('shaders and budgets');
{
  const progs = SH.programs ? SH.programs() : null;
  check(progs && ['bg', 'herz', 'giant', 'ring', 'moon', 'glare'].every(k => progs[k] && /void main\s*\(/.test(progs[k].fs) && /void main\s*\(/.test(progs[k].vs)), 'VR.SpaceShaders has the six programs (background, Herzwelt, the giant, the ring, a moon, the glare)');
  // GLSL ES 3.0 has no int → float conversion: a bare integer where a float goes is a compile error (lint the usual places)
  const bad = [];
  if (progs) for (const k in progs) for (const part of ['vs', 'fs']) {
    const src = progs[k][part];
    for (const m of src.matchAll(/\b(float|vec[234])\s+\w+\s*=\s*(-?\d+)\s*;/g)) bad.push(k + '.' + part + ': ' + m[0]);
    for (const m of src.matchAll(/\bvec[234]\(\s*(-?\d+)\s*[,)]/g)) bad.push(k + '.' + part + ': ' + m[0]);
    const o = (src.match(/\{/g) || []).length, c = (src.match(/\}/g) || []).length;
    if (o !== c) bad.push(k + '.' + part + ': braces ' + o + '/' + c);
  }
  check(!bad.length, 'the GLSL lint finds no bare integer in a float place and balanced braces' + (bad.length ? ': ' + bad.slice(0, 6).join(' · ') : ''));
  const mb0 = BT.gpuBytes(0) / 1048576, mb3 = BT.gpuBytes(3) / 1048576;
  check(mb0 <= 24 && mb3 <= 96, `the space layer's textures: ${mb0.toFixed(1)} MB on Very Low (≤ 24), ${mb3.toFixed(1)} MB on High (≤ 96)`);
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
