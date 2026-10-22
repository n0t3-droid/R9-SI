// The orbital mechanics core (u-orbit · U = docs/superpowers/specs/2026-10-22-universe-design.md §2–§4, §8.1, §13;
// waves §3.1; R = docs/universe/REFERENCE.md): VR.Universe in node, the orbital test bench of the universe fronts.
//  (a) Kepler's equation: |E − e sin E − M| < 1e-12 for e ≤ 0.97 in ≤ 6 Newton steps; the hyperbolic one
//  (b) elements ↔ state round trips
//  (c) every number of U§2.1 and U§3 against the module (0.5 %, or half the last written digit of a number given with
//      fewer than three significant digits) — and the home-system table, printed
//  (d) state(t): radii, periods by return, Kepler III, determinism, the in-place `out`
//  (e) spin and tidal lock: the Heartland's noon at t ≡ 300 (tick 6000), the 1,200-s solar day, locked parents fixed,
//      the days of Basalt and Ocker, Amarant rising every ~1.1 h on Basalt
//  (f) spheres of influence and the dominant body
//  (g) universal-variable coasting: energy and angular momentum over 100 orbits (rel. < 1e-12)
//  (h) velocity Verlet at 1/120 s: drift < 1e-5 over 10 orbits; a burn against a fine reference
//  (i) the SOI hand-over: continuous to 1e-9 (exit and entry)
//  (j) the ghost path: 128 points on the conic, closed ellipses, an escape patched round Amarant, an Opal encounter
//  (k) R§1.9 at scale 1: LEO→GEO 3.86 km/s (5.3 h), Earth→Mars 259 d (v∞ 2.95 / 2.65, Δv 3.57), low orbits, SOI radii
//  (l) the Heartland's sun against env.js (el = 0.42 sin th, az = th + 0.4): the mean sun within 2.6° / 0.3° on every day,
//      the true sun (with Herzwelt's orbital parallax round Amarant, ±0.10°) within 2.61° / 0.35°
//  (m) the charts: plane → sphere → plane < 1 mm out to 300 km, the Heartland at 65.94° N with the pole 41.8 km away and
//      true north 22.9° east of map north, arcs = plane distances from the pole, orthonormal local frames, local time
//  (n) local skies on every world: the parent's size, ~35° high at a moon's spawn, phases, the eclipses at the start
//      (Zinnober ~7 min, Opal ~5 min, Herzwelt none), the rare seasons of Herzwelt's eclipses, the cost of a call
//  (o) TRIAD and the postcard blend
//  (p) the wiring: build.js SHARED (and out of the texture key), test/load_shared.js; the module runs in a bare context
// usage: node test/universe.js
const fs = require('fs'), path = require('path'), vm = require('vm');
globalThis.VR = globalThis.VR || {};
require('../src/shared/core.js');
const SRC = path.join(__dirname, '..', 'src', 'shared', 'universe.js');
if (fs.existsSync(SRC)) require(SRC);
const VR = globalThis.VR, U = VR.Universe;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const section = (s) => console.log('\n' + s);
if (!U) { check(false, 'src/shared/universe.js defines VR.Universe'); console.log('\nFAILED ' + fails); process.exit(1); }

const D = Math.PI / 180, deg = (r) => r / D;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => scl(a, 1 / len(a));
const angle = (a, b) => Math.atan2(len(cross(a, b)), dot(a, b));
const mv = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
const mtv = (m, v) => [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]];
const f3 = (x, n) => Number(x).toFixed(n === undefined ? 3 : n);
const ex = (x) => Number(x).toExponential(1);
const rng = (() => { let s = 1234567; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; })();
// a number as the spec writes it: rel. ≤ 0.5 %, or half its last written digit when it has fewer than three significant
// digits (so "7 min" means 6.5–7.5 and "0.42°" means 0.415–0.425)
function num(label, got, spec, unitTxt) {
  const s = String(spec).replace(/,/g, ''), want = parseFloat(s);
  const dec = (s.split('.')[1] || '').length, sig = s.replace('.', '').replace(/^0+/, '').length;
  const tol = Math.max(Math.abs(want) * 0.005, sig < 3 ? 0.5 * Math.pow(10, -dec) : 0);
  const u = unitTxt ? ' ' + unitTxt : '';
  check(Math.abs(got - want) <= tol + 1e-12, `${label}: ${Number(got.toPrecision(5))}${u} (spec ${spec}${u}, ±${Number(tol.toPrecision(2))})`);
}

const S = U.home;
check(!!S && typeof S.state === 'function', 'U.home is the compiled Helia system');

// ============================================================================================ (a) Kepler's equation
section('(a) Kepler');
{
  let maxRes = 0, maxSteps = 0, worst = '';
  const es = [0, 1e-4, 0.001, 0.01, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.93, 0.95, 0.96, 0.97];
  const Ms = [];
  for (let k = 0; k < 4000; k++) Ms.push(2 * Math.PI * k / 4000);
  for (const m of [1e-12, 1e-9, 1e-6, 1e-3, Math.PI - 1e-9, Math.PI + 1e-9, 2 * Math.PI - 1e-9]) Ms.push(m);
  for (const e of es) for (const M of Ms) {
    const E = U.kepler(M, e), steps = U.kepler.steps;
    const res = Math.abs(E - e * Math.sin(E) - M);
    if (res > maxRes) { maxRes = res; worst = `e ${e} M ${M}`; }
    if (steps > maxSteps) maxSteps = steps;
  }
  check(maxRes < 1e-12, `Kepler: max |E − e sin E − M| = ${ex(maxRes)} over ${es.length} × ${Ms.length} (e ≤ 0.97; worst ${worst}) < 1e-12`);
  check(maxSteps <= 6, `Newton from Mikkola's cubic start: at most ${maxSteps} steps (≤ 6)`);
  // any M (negative, many turns): E − M = e sin E repeats with every turn
  let maxTurn = 0;
  for (const e of [0.1, 0.5, 0.97]) for (const M of [-0.3, -7.5, 1234.5678, 5e4]) {
    const m = M - 2 * Math.PI * Math.floor(M / (2 * Math.PI)), d = (U.kepler(M, e) - M) - (U.kepler(m, e) - m);
    maxTurn = Math.max(maxTurn, Math.abs(d));
  }
  check(maxTurn < 1e-10, `… for any M (negative, thousands of turns) the same solution turn by turn (${ex(maxTurn)})`);
  let maxH = 0;
  for (const e of [1.0001, 1.01, 1.1, 1.5, 2, 5, 30]) for (const M of [1e-9, 0.01, 0.5, 1, 3, 10, 100, 1e4, -2]) {
    const H = U.keplerH(M, e); const res = Math.abs(e * Math.sinh(H) - H - M) / Math.max(1, Math.abs(M));
    if (res > maxH) maxH = res;
  }
  check(maxH < 1e-12, `the hyperbolic equation e sinh H − H = M: max rel. residual ${ex(maxH)} < 1e-12`);
}

// ============================================================================================ (b) elements ↔ state
section('(b) elements and state');
{
  let worst = 0, worstPos = 0;
  const mu = 9.72e10;
  for (let k = 0; k < 400; k++) {
    const el = { a: 1.2e5 + rng() * 6e5, e: rng() * 0.97, i: rng() * Math.PI, node: rng() * 2 * Math.PI, peri: rng() * 2 * Math.PI, M0: rng() * 2 * Math.PI, t0: 0 };
    const r = [0, 0, 0], v = [0, 0, 0];
    U.elToState(el, mu, 0, r, v);
    const b = U.stateToEl(r, v, mu);
    const dA = (x, y) => { let d = Math.abs(x - y) % (2 * Math.PI); return Math.min(d, 2 * Math.PI - d); };
    const errs = [Math.abs(b.a - el.a) / el.a, Math.abs(b.e - el.e), Math.abs(b.i - el.i)];
    if (Math.sin(el.i) > 1e-3) errs.push(dA(b.node, el.node));
    if (el.e > 1e-3 && Math.sin(el.i) > 1e-3) errs.push(dA(b.peri, el.peri));
    if (el.e > 1e-3) errs.push(dA(b.M, el.M0));
    const err = Math.max(...errs);
    if (err > worst) worst = err;
    // and back from the recovered elements to the same position
    const r2 = [0, 0, 0], v2 = [0, 0, 0];
    U.elToState({ a: b.a, e: b.e, i: b.i, node: b.node, peri: b.peri, M0: b.M, t0: 0 }, mu, 0, r2, v2);
    worstPos = Math.max(worstPos, len(sub(r2, r)) / len(r), len(sub(v2, v)) / len(v));
  }
  check(worst < 1e-9, `400 random orbits (e ≤ 0.97, i 0–180°): elements → state → elements, max error ${ex(worst)} < 1e-9`);
  check(worstPos < 1e-10, `… and back to the same position and velocity, max rel. error ${ex(worstPos)} < 1e-10`);
  // vis-viva on rails
  const el = { a: 4e5, e: 0.5, i: 0.3, node: 1, peri: 2, M0: 0.7, t0: 0 }, r = [0, 0, 0], v = [0, 0, 0];
  U.elToState(el, mu, 1234, r, v);
  const vv = Math.abs(dot(v, v) - mu * (2 / len(r) - 1 / el.a)) / (mu / el.a);
  check(vv < 1e-12, `vis-viva v² = μ(2/r − 1/a) holds on rails (${ex(vv)})`);
}

// ============================================================================================ (c) the numbers of U§2.1 and U§3
section('(c) the Helia system — every number of U§2.1 and U§3');
const B = (id) => S.body(id);
const KM = 1e3;
{
  const ids = ['helia', 'amarant', 'herz', 'aqua', 'zinn', 'opal', 'basalt', 'ocker', 'bernstein', 'coelestin', 'swarm'];
  check(ids.every(id => !!B(id)), 'the bodies: ' + ids.join(', '));
  check(U.SCALE && U.SCALE.L === 64 && Math.abs(U.SCALE.length - 1 / 64) < 1e-15, 'SCALE: lengths 1/64');
  check(ids.filter(id => B(id).mu > 0).every(id => Math.abs(B(id).mu - B(id).g * B(id).R * B(id).R) / B(id).mu < 1e-12), 'μ = g·R² for every body with mass');
  const H = B('helia'), A = B('amarant'), Hz = B('herz'), Aq = B('aqua'), Z = B('zinn'), O = B('opal'), Ba = B('basalt'), Oc = B('ocker'), Be = B('bernstein'), Co = B('coelestin'), Sw = B('swarm');
  // the table, row by row
  num('Helia: 1.5 R☉ real-equivalent → game radius', H.R / KM, '16,305', 'km');
  num('Helia: 1.33 M☉ (μ real ÷ 4096)', H.mu * 4096 / U.MU_SUN, '1.33', 'M☉');
  num('Amarant: equatorial radius (60,000 km ÷ 64)', A.R / KM, '937.5', 'km');
  num('Amarant: polar radius (oblate 9.8 %)', A.Rp / KM, '845.6', 'km');
  num('Amarant: flattening', A.f * 100, '9.8', '%');
  num('Amarant: Jupiter\'s mass', A.mu * 4096 / U.MU_JUP, '1.00');
  num('Amarant: orbit 1.9 AU (game)', A.orbit.a / KM / 1e6, '4.44', '·10⁶ km');
  num('Amarant: period', A.orbit.T / 86400, '103.7', 'days');
  num('Amarant: g at the cloud tops', A.g, '35', 'm/s²');
  num('Helia in Amarant\'s sky (diameter)', deg(2 * Math.asin(H.R / A.orbit.a)), '0.42', '°');
  num('Herzwelt: radius', Hz.R / KM, '99.55', 'km');
  num('Herzwelt: orbit', Hz.orbit.a / KM, '7,792', 'km');
  num('Herzwelt: period', Hz.orbit.T / 3600, '6.83', 'h');
  num('Herzwelt: g', Hz.g, '9.81', 'm/s²');
  num('Herzwelt: the day (the world clock)', Hz.day / 60, '20', 'min');
  num('Amarant from Herzwelt\'s facing surface', deg(2 * Math.asin(A.R / (Hz.orbit.a - Hz.R))), '14.0', '°');
  num('Aquamarin from Herzwelt\'s facing surface', deg(2 * Math.asin(Aq.R / (Aq.orbit.a - Hz.R))), '9.8', '°');
  num('Aquamarin: radius', Aq.R / KM, '37.5', 'km');
  num('Aquamarin: distance from Herzwelt', Aq.orbit.a / KM, '539', 'km');
  num('Aquamarin: in Hill radii of Herzwelt', Aq.orbit.a / S.hill('herz'), '0.68');
  num('Aquamarin: period', Aq.orbit.T / 3600, '2.21', 'h');
  num('Aquamarin: g', Aq.g, '2.01', 'm/s²');
  num('Aquamarin: day (locked)', Aq.day / 3600, '2.21', 'h');
  num('Herzwelt from Aquamarin', deg(2 * Math.asin(Hz.R / (Aq.orbit.a - Aq.R))), '22.9', '°');
  check(Aq.orbit.i > Math.PI / 2 && Aq.spin.locked, 'Aquamarin orbits retrograde (i ' + f3(deg(Aq.orbit.i), 1) + '°) and is tidally locked');
  for (const [b, nm, R, a, T, g, sky] of [[Z, 'Zinnober', '28.4', '2,969', '1.61', '1.80', '37.2'], [O, 'Opal', '17.2', '4,062', '2.57', '0.49', '26.8'], [Ba, 'Basalt', '27.2', '10,938', '11.35', '1.62', '9.9'], [Oc, 'Ocker', '53.0', '17,188', '22.36', '3.72', '6.3']]) {
    num(nm + ': radius', b.R / KM, R, 'km'); num(nm + ': orbit', b.orbit.a / KM, a, 'km'); num(nm + ': period', b.orbit.T / 3600, T, 'h');
    num(nm + ': g', b.g, g, 'm/s²'); num('Amarant from ' + nm + '\'s facing surface', deg(2 * Math.asin(A.R / (b.orbit.a - b.R))), sky, '°');
  }
  check(Z.spin.locked && O.spin.locked && !Ba.spin.locked && !Oc.spin.locked, 'Zinnober and Opal tidally locked, Basalt and Ocker spinning (a young system)');
  num('Zinnober: day (locked)', Z.day / 3600, '1.61', 'h'); num('Opal: day (locked)', O.day / 3600, '2.57', 'h');
  num('Basalt: day', Ba.day / 60, '60', 'min'); num('Ocker: day', Oc.day / 60, '40', 'min');
  const ring = A.ring;
  num('the ring: inner edge', ring.inner / A.R, '1.24', 'R'); num('the ring: outer edge', ring.outer / A.R, '2.27', 'R');
  num('the ring: inner edge', ring.inner / KM, '1,162', 'km'); num('the ring: outer edge', ring.outer / KM, '2,128', 'km');
  const cas = ring.gaps.find(g => g.name === 'cassini'), enk = ring.gaps.find(g => g.name === 'encke');
  num('the Cassini gap', (cas.r1 - cas.r0) / KM, '73', 'km'); num('the gap with a moonlet', (enk.r1 - enk.r0) / KM, '5', 'km');
  check(ring.thickness === 10 && ring.moonlet && ring.moonlet.R === 150, 'the ring sheet is 10 m thick (real, not scaled); a 300-m moonlet in the 5-km gap');
  num('Trümmerschwarm: orbit', Sw.orbit.a * 64 / U.AU, '3.4', 'AU');
  num('Bernstein: radius', Be.R / KM, '94.5', 'km'); num('Bernstein: orbit', Be.orbit.a * 64 / U.AU, '0.9', 'AU');
  num('Bernstein: period', Be.orbit.T / 86400, '33.8', 'days'); num('Bernstein: g', Be.g, '8.9', 'm/s²');
  num('Cölestin: radius', Co.R / KM, '390', 'km'); num('Cölestin: orbit', Co.orbit.a * 64 / U.AU, '12', 'AU');
  // the text of §2.1
  num('Helia\'s light at Amarant', S.flux('amarant'), '1,357', 'W/m²');
  num('Amarant\'s equator and ring to the ecliptic', deg(Math.acos(A.spin.axis[2])), '14', '°');
  const sunElev = (t) => { const s = unit(scl(S.state(t).b.amarant.r, -1)); return deg(Math.asin(dot(s, A.spin.axis))); };
  num('Helia above the ring plane at the start', sunElev(0), '12', '°');
  const rate = (sunElev(-600) - sunElev(600)) / 1200 * 86400;
  num('… drifting per day of play at the start (toward the ring-plane crossing)', rate, '0.4', '°');
  let cross0 = 0; for (let d = 0; d < 60; d += 0.25) if (sunElev(d * 86400) <= 0) { cross0 = d; break; }
  check(rate > 0 && cross0 > 10, `the sun sinks toward the ring plane (eclipses grow; the ring edge-on to the sun after ${cross0} days of play)`);
  const incl = (b) => deg(Math.acos(Math.min(1, dot(S.orbitNormal(b.id), A.spin.axis))));
  num('Herzwelt\'s orbit to the ring plane', incl(Hz), '8', '°'); num('Opal\'s orbit to the ring plane', incl(O), '3', '°');
  check(incl(Z) < 1e-9, 'Zinnober orbits in the ring plane');
  num('the ring seen from Herzwelt: long', deg(2 * Math.asin(ring.outer / Hz.orbit.a)), '31.7', '°');
  num('… and at most this wide (Herzwelt 8° off the ring plane)', deg(2 * Math.atan(ring.outer * Math.sin(8 * D) / Hz.orbit.a)), '4.4', '°');
  num('the ring seen from Opal: an ellipse round the giant', deg(2 * Math.asin(ring.outer / O.orbit.a)), '63', '°');
  // the four grey moons seen truly from Herzwelt's surface (over 30 days of their motion)
  {
    let lo = 1e9, hi = 0;
    const st = S.state(0);
    for (let t = 0; t < 30 * 86400; t += 60) {
      S.state(t, st);
      for (const id of ['zinn', 'opal', 'basalt', 'ocker']) {
        const d = len(sub(st.b[id].r, st.b.herz.r));
        hi = Math.max(hi, deg(2 * Math.asin(B(id).R / (d - Hz.R)))); lo = Math.min(lo, deg(2 * Math.asin(B(id).R / (d + Hz.R))));
      }
    }
    num('the four grey moons from Herzwelt: the smallest', lo, '0.2', '°'); num('… the largest', hi, '1.0', '°');
  }
  // U§3
  num('§3 Herzwelt–Amarant 498,700 km real-equivalent', Hz.orbit.a * 64 / KM, '498,700', 'km');
  num('§3 low orbit (h 3 km): speed', U.vCirc(Hz.mu, Hz.R + 3000), '974', 'm/s');
  num('§3 low orbit (h 3 km): period', U.period(Hz.mu, Hz.R + 3000) / 60, '11.0', 'min');
  num('§3 … the same orbit real (h 192 km) takes 8× as long', U.period(Hz.mu * 4096, (Hz.R + 3000) * 64) / U.period(Hz.mu, Hz.R + 3000), '8.00');
  num('§3 Herzwelt escape speed', U.vEsc(Hz.mu, Hz.R), '1,398', 'm/s');
  num('§3 the ascent\'s 1,120 m/s at 2 g', 1120 / (2 * 9.81), '57', 's');
  {
    // the ascent: the impulsive minimum from rest to a 3-km circular orbit, and the spec's 1,120 m/s as that plus losses
    const ho = U.hohmann(Hz.mu, Hz.R, Hz.R + 3000), vSurf = Math.sqrt(Hz.mu * (2 / Hz.R - 2 / (2 * Hz.R + 3000)));
    const dvMin = vSurf + ho.dv2;
    check(dvMin < 1120 && 1120 < 1.15 * dvMin, `§3 the ascent ≈ 1,120 m/s = the impulsive minimum from rest (${f3(dvMin, 0)} m/s) + ${f3((1120 / dvMin - 1) * 100, 0)} % losses; an eastward start saves ${f3(S.surfaceSpeed('herz', 0, 0), 0)} m/s at the Heartland`);
  }
  for (const [b, nm, v, T] of [[Oc, 'Ocker', '444', '12.5'], [Aq, 'Aquamarin', '275', '14.3'], [Z, 'Zinnober', '226', '13.2'], [Ba, 'Basalt', '210', '13.6'], [O, 'Opal', '92', '19.6']]) {
    num('§3 ' + nm + ': low orbit speed', U.vCirc(b.mu, b.R), v, 'm/s'); num('§3 ' + nm + ': low orbit period', U.period(b.mu, b.R) / 60, T, 'min');
  }
  num('§3 Opal\'s escape speed', U.vEsc(O.mu, O.R), '130', 'm/s');
  check(144 > U.vEsc(O.mu, O.R), '§3 the shuttle\'s boost (144 m/s) beats Opal\'s escape speed — a low flight there is a hop into space');
  num('§3 Amarant\'s cloud tops: orbit speed', U.vCirc(A.mu, A.R), '5,744', 'm/s');
  num('§3 Amarant\'s cloud tops: period', U.period(A.mu, A.R) / 60, '17.1', 'min');
  const geo = S.geoRadius('herz');
  num('§3 Herzwelt\'s geostationary ring: height', (geo - Hz.R) / KM, '52.9', 'km');
  num('§3 … the planet seen from there', deg(2 * Math.asin(Hz.R / geo)), '81.5', '°');
  num('§3 a world nobody walks round in a day', 2 * Math.PI * Hz.R / KM, '625', 'km');
  num('§3 the atmosphere seen from orbit: 100 km of 6,371', 100 / 6371 * 100, '1.6', '%');
  num('§3 … 1.6 % of the game radius', 100 / 6371 * Hz.R / KM, '1.6', 'km');
  check(U.SCALE.betaOrbit === 64, '§3 the air seen from orbit: β × 64 (optical depths along matching rays are equal)');
  num('§3 the moons round Amarant: the fastest', Z.orbit.T / 3600, '1.6', 'h'); num('§3 … the slowest', Oc.orbit.T / 3600, '22', 'h');
  check(Math.abs(U.SCALE.walk * 9.81 - 30) < 1e-12 && Math.abs(U.SCALE.walk * O.g - 1.4985) < 1e-3, '§3 walking gravity 30 m/s² × (g/9.81): Opal ' + f3(U.SCALE.walk * O.g, 2) + ' m/s²');
  check(U.worldSeconds(2, 6000) === 2700 && U.DAY === 1200, '§3 the ephemeris runs on world seconds (day·24000 + ticks)/20; a day is 1,200 s');
  num('§3 4.24 ly at Voyager\'s 61,000 km/h (R§6.8)', 4.24 * 9.4607e12 / 61000 / 8766, '75,000', 'years');
  num('§5.4 Herzwelt seen from a 3-km orbit', deg(2 * Math.asin(Hz.R / (Hz.R + 3000))), '152', '°');
  num('§5.4 a sunrise or a sunset every', U.period(Hz.mu, Hz.R + 3000) / 2 / 60, '5.5', 'min');
  num('§5.4 the terminator (18° of arc)', 18 * D * Hz.R / KM, '31', 'km');
  num('§16 the giant rises every (the true home sky)', S.synodic('herz', 'amarant') / 60, '21', 'min');
  num('§16 Aquamarin crosses the sky every', S.synodic('herz', 'aqua') / 60, '17', 'min');
  // U§4.3 for the walking fronts (the spec's Aquamarin jump used the rounded 6.1 m/s²)
  const jump = (g) => 9.1 * 9.1 / (2 * 30 * g / 9.81);
  num('§4.3 a jump on Opal', jump(O.g), '27.6', 'm'); num('§4.3 a jump on Basalt', jump(Ba.g), '8.4', 'm'); num('§4.3 a jump on Ocker', jump(Oc.g), '3.6', 'm');
  console.log('    (§4.3 Aquamarin: ' + f3(jump(Aq.g), 2) + ' m with the exact game gravity ' + f3(30 * Aq.g / 9.81, 3) + ' m/s²; the spec\'s 6.8 m used 6.1)');
}

// the home-system table
section('the home system (game scale: lengths ÷ 64; periods ÷ 8)');
{
  const rows = S.table();
  const pad = (s, n) => String(s).padStart(n), padE = (s, n) => String(s).padEnd(n);
  console.log('  ' + padE('body', 15) + padE('kind', 10) + pad('R real km', 14) + pad('R km', 10) + pad('a km', 10) + pad('period', 10) + pad('g', 8) + pad('v_low', 7) + pad('T_low', 7) + pad('v_esc', 7) + pad('SOI km', 10) + pad('day', 17) + '  parent in its sky');
  for (const r of rows) console.log('  ' + padE(r.name, 15) + padE(r.kind, 10) + pad(r.Rreal, 14) + pad(r.R, 10) + pad(r.a, 10) + pad(r.period, 10) + pad(r.g, 8) + pad(r.vLow, 7) + pad(r.tLow, 7) + pad(r.vEsc, 7) + pad(r.soi, 10) + pad(r.day, 17) + '  ' + r.sky);
  console.log('  (g m/s², v m/s, T_low min — a low orbit at the surface; SOI = a (μ/μ_parent)^0.4; the parent\'s size from the facing surface)');
  check(rows.length === 11, 'the table has a row per body (' + rows.length + ')');
}

// ============================================================================================ (d) state(t)
section('(d) state(t)');
{
  const st = S.state(0);
  let worstR = 0;
  for (const id of S.ids) { const b = B(id); if (!b.orbit || b.orbit.e > 0) continue; const r = st.b[id].rel; worstR = Math.max(worstR, Math.abs(Math.hypot(r[0], r[1], r[2]) - b.orbit.a) / b.orbit.a); }
  check(worstR < 1e-14, 'circular orbits keep their radius (' + ex(worstR) + ')');
  let worstT = 0;
  for (const id of ['zinn', 'opal', 'herz', 'aqua', 'basalt', 'ocker', 'amarant', 'bernstein']) {
    const b = B(id), r0 = S.rel(id, 777, [0, 0, 0], [0, 0, 0]).slice(), r1 = S.rel(id, 777 + b.orbit.T, [0, 0, 0], [0, 0, 0]);
    worstT = Math.max(worstT, len(sub(r1, r0)) / b.orbit.a);
  }
  check(worstT < 1e-9, 'every body returns to its place after one period (' + ex(worstT) + ')');
  const k3 = ['zinn', 'opal', 'herz', 'basalt', 'ocker'].map(id => B(id).orbit.T ** 2 / B(id).orbit.a ** 3);
  check(Math.max(...k3) / Math.min(...k3) - 1 < 1e-12, 'Kepler III: T²/a³ is one number for all moons of Amarant');
  const a = S.state(123456.789), b2 = S.state(123456.789);
  check(S.ids.every(id => len(sub(a.b[id].r, b2.b[id].r)) === 0), 'state(t) is deterministic');
  const keep = a.b.opal.r; S.state(5, a);
  check(a.b.opal.r === keep && a.t === 5 && len(sub(a.b.opal.r, S.state(5).b.opal.r)) === 0, 'state(t, out) refills the same arrays (no allocation in the frame loop)');
  check(len(st.b.helia.r) === 0, 'Helia sits at the origin of the system frame');
  const herzSys = add(add(S.rel('amarant', 0, [0, 0, 0], [0, 0, 0]), [0, 0, 0]), S.rel('herz', 0, [0, 0, 0], [0, 0, 0]));
  check(len(sub(herzSys, st.b.herz.r)) < 1e-6, 'system positions are the sums of the relative ones along the tree');
  // velocities: finite differences of the positions
  const h = 0.5, p1 = S.state(1000 - h), p2 = S.state(1000 + h), pv = S.state(1000);
  let worstV = 0;
  for (const id of ['herz', 'aqua', 'opal', 'amarant']) { const fd = scl(sub(p2.b[id].r, p1.b[id].r), 1 / (2 * h)); worstV = Math.max(worstV, len(sub(fd, pv.b[id].v)) / len(pv.b[id].v)); }
  check(worstV < 1e-6, 'velocities match the motion (central differences, ' + ex(worstV) + ')');
}

// ============================================================================================ (e) spin and lock
section('(e) spin and tidal lock');
const C = U.chart('herz');
const localOf = (chart, id, x, z, t, vSys) => { const Bm = S.spin(id, t, new Float64Array(9)), F = chart.frame(x, z, new Float64Array(9)); return mv(F, mtv(Bm, vSys)); };
{
  // the Heartland's noon: the mean sun (seen from Amarant) due true south at t = 300 + 1200 k
  let worstH = 0;
  for (const k of [0, 1, 2, 7, 30, 100, 365, 1000, 10000]) {
    const t = 300 + 1200 * k, st = S.state(t);
    const s = localOf(C, 'herz', 0, 0, t, unit(scl(st.b.amarant.r, -1)));
    // true east on the map is map east turned 0.4 rad toward map south; at noon the sun has no true-east component
    const ps = 0.4, east = [Math.cos(ps), 0, Math.sin(ps)];
    worstH = Math.max(worstH, Math.abs(Math.asin(dot(s, east))));
  }
  check(deg(worstH) < 1e-6, `the mean sun crosses the Heartland's meridian at t ≡ 300 (tick 6000) on day 0 … 10,000 (worst ${ex(deg(worstH))}°)`);
  num('the solar day of Herzwelt (sidereal ' + f3(B('herz').spin.T, 2) + ' s)', S.solarDay('herz'), '1,200', 's');
  check(Math.abs(S.solarDay('herz') - 1200) < 1e-6, 'Herzwelt\'s mean solar day is 1,200 s to the microsecond (no drift against env.js over any number of days)');
  // a locked moon's parent stands still in its sky
  for (const id of ['zinn', 'opal', 'aqua']) {
    const b = B(id), par = b.parent, d0 = [], d1 = [];
    const at = (t) => { const st = S.state(t); const Bm = S.spin(id, t, new Float64Array(9)); return unit(mtv(Bm, sub(st.b[par].r, st.b[id].r))); };
    let worst = 0; const ref = at(0);
    for (let k = 1; k <= 24; k++) worst = Math.max(worst, angle(ref, at(k * b.orbit.T / 24 + 13.7)));
    check(deg(worst) < 0.01, `${b.name.de}: ${B(par).name.de} hangs fixed in its sky over a whole orbit (moves ${ex(deg(worst))}°)`);
  }
  // Basalt's and Ocker's days: the time between two local noons
  for (const [id, want] of [['basalt', '60'], ['ocker', '40']]) num(`${B(id).name.de}: from noon to noon`, S.solarDay(id) / 60, want, 'min');
  // Amarant rises every ~1.1 h on Basalt (its synodic period): risings at Basalt's spawn
  {
    const out = U.localSky('basalt', [0, 63, 0], 0);
    let prev = out.parent.dir[1], rises = [];
    for (let t = 10; t < 6 * 3600; t += 10) { U.localSky('basalt', [0, 63, 0], t, out); const y = out.parent.dir[1]; if (prev < 0 && y >= 0) rises.push(t); prev = y; }
    const gaps = rises.slice(1).map((t, i) => t - rises[i]);
    check(rises.length >= 4 && gaps.every(g => Math.abs(g - S.synodic('basalt', 'amarant')) < 30), `Amarant rises on Basalt every ${f3((gaps[0] || 0) / 3600, 2)} h (${rises.length} risings in 6 h; the spec: "every hour")`);
  }
}

// ============================================================================================ (f) SOI and the dominant body
section('(f) spheres of influence and the dominant body');
{
  for (const [id, want] of [['herz', '777'], ['aqua', '131'], ['zinn', '55.2'], ['opal', '30.0'], ['basalt', '188'], ['ocker', '702'], ['amarant', '245,500']]) {
    const b = B(id), p = B(b.parent);
    num(`r_SOI = a (μ/μ_parent)^(2/5): ${b.name.de}`, S.soi(id) / KM, want, 'km');
    check(Math.abs(S.soi(id) - U.soiRadius(b.orbit.a, b.mu, p.mu)) < 1e-6, `… the same as U.soiRadius (${b.name.de})`);
  }
  check(S.soi('helia') === Infinity && S.soi('swarm') === 0, 'Helia\'s sphere is everything; the swarm has no sphere of its own (μ 0)');
  const t = 4321, st = S.state(t);
  const at = (id, off) => add(st.b[id].r, off);
  const cases = [
    [at('herz', [0, 0, B('herz').R + 3000]), 'herz', '3 km over Herzwelt'],
    [at('herz', [600e3, 0, 0]), 'herz', '600 km from Herzwelt (inside its 777 km)'],
    [at('herz', [1000e3, 0, 0]), 'amarant', '1,000 km from Herzwelt'],
    [at('aqua', [20e3, 0, 50e3]), 'aqua', 'beside Aquamarin'],
    [at('opal', [0, 25e3, 0]), 'opal', '25 km from Opal\'s centre'],
    [at('opal', [0, 40e3, 0]), 'amarant', '40 km from Opal (its sphere is 30 km)'],
    [at('amarant', [0, 0, 100000e3]), 'amarant', '100,000 km over Amarant'],
    [at('amarant', [300000e3, 0, 0]), 'helia', '300,000 km from Amarant'],
    [at('bernstein', [0, 5e6, 0]), 'bernstein', '5,000 km from Bernstein'],
  ];
  for (const [p, want, nm] of cases) check(S.dominant(p, t) === want, `dominant at ${nm}: ${S.dominant(p, t)} (${want})`);
}

// ============================================================================================ (g) coasting
section('(g) universal-variable coasting');
{
  const Hz = B('herz'), mu = Hz.mu;
  const energy = (r, v) => dot(v, v) / 2 - mu / len(r), hmag = (r, v) => len(cross(r, v));
  const cases = [
    ['circular, 3 km', [Hz.R + 3000, 0, 0], [0, U.vCirc(mu, Hz.R + 3000), 0]],
    ['ellipse e 0.3', [Hz.R + 3000, 0, 0], [0, U.vCirc(mu, Hz.R + 3000) * Math.sqrt(1.3), 0]],
    ['ellipse e 0.9, inclined', [Hz.R + 3000, 0, 0], [0, U.vCirc(mu, Hz.R + 3000) * Math.sqrt(1.9) * 0.8, U.vCirc(mu, Hz.R + 3000) * Math.sqrt(1.9) * 0.6]],
  ];
  for (const [nm, r0, v0] of cases) {
    const el = U.stateToEl(r0, v0, mu), T = el.period, E0 = energy(r0, v0), h0 = hmag(r0, v0);
    let dE = 0, dH = 0, r = [0, 0, 0], v = [0, 0, 0];
    for (let k = 1; k <= 1000; k++) { U.coast(r0, v0, mu, k * 100 * T / 1000 + 0.123 * k, r, v); dE = Math.max(dE, Math.abs(energy(r, v) - E0) / Math.abs(E0)); dH = Math.max(dH, Math.abs(hmag(r, v) - h0) / h0); }
    check(dE < 1e-12 && dH < 1e-12, `${nm}: 1,000 points over 100 orbits from the epoch — energy ${ex(dE)}, angular momentum ${ex(dH)} (< 1e-12)`);
    // chained: 100 hops of one orbit each, every hop from the last state
    let rc = r0.slice(), vc = v0.slice();
    for (let k = 0; k < 100; k++) { U.coast(rc, vc, mu, T, rc, vc); }
    const cE = Math.abs(energy(rc, vc) - E0) / Math.abs(E0), cH = Math.abs(hmag(rc, vc) - h0) / h0, cR = len(sub(rc, r0)) / len(r0);
    check(cE < 1e-12 && cH < 1e-12 && cR < 1e-9, `${nm}: chained 100 × one orbit — energy ${ex(cE)}, angular momentum ${ex(cH)}, back at the start to ${ex(cR)}`);
  }
  // coasting = Kepler on rails
  {
    const el = { a: 3.1e5, e: 0.6, i: 0.4, node: 2.2, peri: 0.9, M0: 0.3, t0: 0 }, r0 = [0, 0, 0], v0 = [0, 0, 0], r1 = [0, 0, 0], v1 = [0, 0, 0], r = [0, 0, 0], v = [0, 0, 0];
    U.elToState(el, mu, 0, r0, v0);
    let worst = 0;
    for (const dt of [1, 77.7, 1234.5, 9876.5, -555.5, 1e6]) { U.elToState(el, mu, dt, r1, v1); U.coast(r0, v0, mu, dt, r, v); worst = Math.max(worst, len(sub(r, r1)) / el.a); }
    check(worst < 1e-10, `coasting agrees with Kepler's equation on rails, forward and backward (${ex(worst)})`);
  }
  // open orbits: hyperbolic and near-parabolic
  for (const k of [1.2, 1.0001, 0.9999, 3]) {
    const r0 = [Hz.R + 3000, 0, 0], v0 = scl(unit([0.1, 1, 0.2]), U.vEsc(mu, Hz.R + 3000) * k), E0 = energy(r0, v0), h0 = hmag(r0, v0);
    let dE = 0, dH = 0; const r = [0, 0, 0], v = [0, 0, 0];
    for (const dt of [10, 100, 1000, 5000, 20000, -300]) { U.coast(r0, v0, mu, dt, r, v); dE = Math.max(dE, Math.abs(energy(r, v) - E0) / Math.max(Math.abs(E0), dot(v0, v0) / 2)); dH = Math.max(dH, Math.abs(hmag(r, v) - h0) / h0); }
    // and the way back: forward then backward lands at the start
    U.coast(r0, v0, mu, 4000, r, v); const rb = [0, 0, 0], vb = [0, 0, 0]; U.coast(r, v, mu, -4000, rb, vb);
    const back = len(sub(rb, r0)) / len(r0);
    check(dE < 1e-12 && dH < 1e-12 && back < 1e-9, `${k > 1 ? 'open' : 'closed'} orbit at ${k} × escape speed: energy ${ex(dE)}, angular momentum ${ex(dH)}, there and back ${ex(back)}`);
  }
}

// ============================================================================================ (h) Verlet
section('(h) velocity Verlet under thrust (1/120 s)');
{
  const Hz = B('herz'), mu = Hz.mu, r0 = Hz.R + 3000, dt = 1 / 120;
  for (const [nm, ecc] of [['circular 3 km orbit', 0], ['ellipse e 0.2', 0.2]]) {
    const v0 = U.vCirc(mu, r0) * Math.sqrt(1 + ecc);
    const s = { r: new Float64Array([r0, 0, 0]), v: new Float64Array([0, v0, 0]), a: new Float64Array(3) };
    U.verletInit(s, mu, 0, 0, 0);
    const T = U.stateToEl([r0, 0, 0], [0, v0, 0], mu).period, n = Math.round(10 * T / dt);
    const E0 = v0 * v0 / 2 - mu / r0;
    let dE = 0;
    for (let k = 0; k < n; k++) { U.verlet(s, dt, mu, 0, 0, 0); if (k % 997 === 0) dE = Math.max(dE, Math.abs((dot(s.v, s.v) / 2 - mu / len(s.r)) - E0) / Math.abs(E0)); }
    const r = [0, 0, 0], v = [0, 0, 0]; U.coast([r0, 0, 0], [0, v0, 0], mu, n * dt, r, v);
    const dR = len(sub(Array.from(s.r), r)) / r0;
    check(dE < 1e-5 && dR < 1e-5, `${nm}: ${n} steps over 10 orbits — energy drift ${ex(dE)}, position off the exact conic by ${ex(dR)} (< 1e-5)`);
  }
  // a 5-s burn at 2 g with the nose held (attitude hold: a fixed direction in space) against a fine reference (RK4 at 1/4,800 s)
  {
    const v0 = U.vCirc(mu, r0), aT = [0, 2 * 9.81, 0];
    const s = { r: new Float64Array([r0, 0, 0]), v: new Float64Array([0, v0, 0]), a: new Float64Array(3) };
    U.verletInit(s, mu, aT[0], aT[1], aT[2]);
    for (let k = 0; k < 5 * 120; k++) U.verlet(s, dt, mu, aT[0], aT[1], aT[2]);
    let y = [r0, 0, 0, 0, v0, 0]; const h = 1 / 4800;
    const f = (y) => { const r = [y[0], y[1], y[2]], rr = len(r), a = add(scl(r, -mu / (rr * rr * rr)), aT); return [y[3], y[4], y[5], a[0], a[1], a[2]]; };
    for (let k = 0; k < 5 * 4800; k++) { const k1 = f(y), k2 = f(y.map((x, i) => x + h / 2 * k1[i])), k3 = f(y.map((x, i) => x + h / 2 * k2[i])), k4 = f(y.map((x, i) => x + h * k3[i])); y = y.map((x, i) => x + h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])); }
    const dR = len(sub(Array.from(s.r), y.slice(0, 3))), dV = len(sub(Array.from(s.v), y.slice(3)));
    check(dR < 0.01 && dV < 0.001, `a 5-s burn at 2 g: Verlet ends ${ex(dR)} m and ${ex(dV)} m/s from the RK4 reference (Δv ${f3(len(Array.from(s.v)) - v0, 1)} m/s)`);
    const el = U.stateToEl(Array.from(s.r), Array.from(s.v), mu);
    check(el.ra > r0 + 40e3, `speeding up raises the far side: apoapsis ${f3((el.ra - Hz.R) / KM, 1)} km after the burn, periapsis ${f3((el.rp - Hz.R) / KM, 2)} km (R§1.9)`);
  }
}

// ============================================================================================ (i) the SOI hand-over
section('(i) the SOI hand-over');
const escapeState = () => { const Hz = B('herz'), r = [Hz.R + 3000, 0, 0], v = [0, U.vEsc(Hz.mu, Hz.R + 3000) * 1.15, 120]; return { r, v }; };
{
  const t0 = 5000, { r, v } = escapeState();
  const exit = S.soiExit('herz', r, v, t0);
  check(!!exit && exit.t > t0, 'a ship at 1.15 × escape speed leaves Herzwelt\'s sphere' + (exit ? ` after ${f3((exit.t - t0) / 60, 1)} min` : ''));
  if (exit) {
    const rs = S.soi('herz');
    check(Math.abs(len(exit.r) - rs) / rs < 1e-9, `… exactly on the sphere: |r| − r_SOI = ${ex(len(exit.r) - rs)} m`);
    const rc = [0, 0, 0], vc = [0, 0, 0]; U.coast(r, v, B('herz').mu, exit.t - t0, rc, vc);
    check(len(sub(rc, exit.r)) / rs < 1e-12, '… on the ship\'s own conic');
    const rA = [0, 0, 0], vA = [0, 0, 0], rH = [0, 0, 0], vH = [0, 0, 0];
    S.toFrame('herz', 'amarant', exit.r, exit.v, exit.t, rA, vA);
    S.toFrame('amarant', 'herz', rA, vA, exit.t, rH, vH);
    const back = Math.max(len(sub(rH, exit.r)) / rs, len(sub(vH, exit.v)) / len(exit.v));
    check(back < 1e-12, `to Amarant's frame and back: ${ex(back)}`);
    const st = S.state(exit.t);
    const p1 = add(st.b.herz.r, exit.r), p2 = add(st.b.amarant.r, rA);
    const jump = len(sub(p1, p2)) / rs;
    check(jump < 1e-9, `the hand-over is continuous in the system frame: ${ex(jump)} of the sphere's radius (< 1e-9)`);
    const vj = len(sub(add(st.b.herz.v, exit.v), add(st.b.amarant.v, vA))) / len(exit.v);
    check(vj < 1e-9, `… and in velocity: ${ex(vj)}`);
    // one second on: the two frames' predictions part only by the tide (no jump)
    const r1 = [0, 0, 0], v1 = [0, 0, 0], r2 = [0, 0, 0], v2 = [0, 0, 0];
    U.coast(exit.r, exit.v, B('herz').mu, 1, r1, v1); U.coast(rA, vA, B('amarant').mu, 1, r2, v2);
    const st1 = S.state(exit.t + 1), q1 = add(st1.b.herz.r, r1), q2 = add(st1.b.amarant.r, r2);
    console.log(`    (one second after the hand-over the two-body predictions differ by ${f3(len(sub(q1, q2)), 3)} m — the tide of the other body)`);
    check(len(sub(q1, q2)) < 1, '… one second later the two frames\' predictions differ only by the tide (< 1 m)');
  }
}

// ============================================================================================ (j) the ghost path
section('(j) the ghost path');
{
  const Hz = B('herz'), mu = Hz.mu, r0 = Hz.R + 3000, t = 1000;
  const g1 = S.ghost('herz', [r0, 0, 0], [0, U.vCirc(mu, r0), 0], t);
  check(g1.pts.length === 128 * 3 && g1.closed && !g1.event && !g1.patch, 'a circular orbit: 128 points, closed, no event, no patch');
  let worst = 0; for (let i = 0; i < 128; i++) worst = Math.max(worst, Math.abs(Math.hypot(g1.pts[i * 3], g1.pts[i * 3 + 1], g1.pts[i * 3 + 2]) - r0));
  check(worst < 1e-6, `… every point at r = R + 3 km (${ex(worst)} m)`);
  // an inclined ellipse: every point on the conic and in the plane
  const rr = [r0, 0, 0], vv = [0, U.vCirc(mu, r0) * 1.1, U.vCirc(mu, r0) * 0.3];
  const el = U.stateToEl(rr, vv, mu), g2 = S.ghost('herz', rr, vv, t), hv = unit(cross(rr, vv));
  let wc = 0, wp = 0;
  for (let i = 0; i < 128; i++) { const p = [g2.pts[i * 3], g2.pts[i * 3 + 1], g2.pts[i * 3 + 2]], d = len(p), cnu = (el.p / d - 1) / el.e; const pe = unit(el.evec); const nu = Math.atan2(dot(p, cross(hv, pe)), dot(p, pe)); wc = Math.max(wc, Math.abs(d - el.p / (1 + el.e * Math.cos(nu))) / d); wp = Math.max(wp, Math.abs(dot(p, hv)) / d); }
  check(g2.closed && wc < 1e-9 && wp < 1e-12, `an inclined ellipse (e ${f3(el.e)}): 128 points on r = p/(1 + e cos ν) (${ex(wc)}) and in the plane (${ex(wp)})`);
  check(Math.abs(g2.pts[0] - rr[0]) + Math.abs(g2.pts[1] - rr[1]) + Math.abs(g2.pts[2] - rr[2]) < 1e-6, '… starting where the ship is');
  // an escape: the conic to the sphere's edge, patched round Amarant
  const { r, v } = escapeState();
  const g3 = S.ghost('herz', r, v, t);
  check(!g3.closed && g3.event && g3.event.kind === 'exit' && g3.event.frame === 'amarant', 'an escape: the conic ends at the sphere, the event is the exit into Amarant\'s frame');
  if (g3.event) {
    const last = [g3.pts[381], g3.pts[382], g3.pts[383]];
    check(Math.abs(len(last) - S.soi('herz')) / S.soi('herz') < 1e-9, '… the last point lies on Herzwelt\'s sphere');
    check(!!g3.patch && g3.patch.frame === 'amarant' && g3.patch.pts.length === 128 * 3, '… one patch: 128 points round Amarant');
    if (g3.patch) {
      const p0 = [g3.patch.pts[0], g3.patch.pts[1], g3.patch.pts[2]];
      check(len(sub(p0, g3.event.r)) < 1e-6, '… the patch starts at the hand-over point (Amarant\'s frame)');
      const ea = U.stateToEl(g3.event.r, g3.event.v, B('amarant').mu);
      let wcp = 0; for (let i = 0; i < 128; i++) { const p = [g3.patch.pts[i * 3], g3.patch.pts[i * 3 + 1], g3.patch.pts[i * 3 + 2]]; const pe = unit(ea.evec), hh = unit(ea.h); const nu = Math.atan2(dot(p, cross(hh, pe)), dot(p, pe)); wcp = Math.max(wcp, Math.abs(len(p) - ea.p / (1 + ea.e * Math.cos(nu))) / len(p)); }
      check(wcp < 1e-9, `… and on the conic the hand-over state gives there (${ex(wcp)})`);
    }
  }
  // an encounter: from Amarant's frame into Opal's sphere (aimed 6 km from Opal's centre 5,000 s ahead, within one orbit)
  {
    const tE = 5000, A = B('amarant');
    const st = S.state(t + tE), target = add(sub(st.b.opal.r, st.b.amarant.r), [5e3, 3e3, 2e3]);
    const vT = scl(unit(cross([0, 0, 1], target)), U.vCirc(A.mu, len(target)) * 0.98);
    const rS = [0, 0, 0], vS = [0, 0, 0]; U.coast(target, vT, A.mu, -tE, rS, vS);
    const g4 = S.ghost('amarant', rS, vS, t);
    check(!!g4.event && g4.event.kind === 'enter' && g4.event.frame === 'opal', 'a path through Opal\'s sphere: the event is the entry into Opal\'s frame' + (g4.event ? ` (${f3((g4.event.t - t) / 60, 1)} min ahead)` : ''));
    if (g4.event && g4.event.frame === 'opal') {
      check(g4.event.t < t + tE, '… before the ship would pass Opal\'s centre');
      check(Math.abs(len(g4.event.r) - S.soi('opal')) / S.soi('opal') < 1e-9, `… exactly on Opal's sphere (${ex(len(g4.event.r) - S.soi('opal'))} m)`);
      const sE = S.state(g4.event.t), rA = [0, 0, 0], vA = [0, 0, 0]; U.coast(rS, vS, A.mu, g4.event.t - t, rA, vA);
      const pA = add(sE.b.amarant.r, rA), pO = add(sE.b.opal.r, g4.event.r);
      check(len(sub(pA, pO)) / S.soi('opal') < 1e-9, `… continuous with the ship's conic round Amarant (${ex(len(sub(pA, pO)))} m)`);
      check(!!g4.patch && g4.patch.frame === 'opal' && !!g4.patch.anchor && g4.patch.anchor.length === 3, '… the patch: the conic round Opal and where Opal will be then (its anchor)');
    }
  }
  // the ghost path's cost (best of five rounds)
  {
    const { r, v } = escapeState(), out = S.ghost('herz', r, v, t);
    let best = 1e9;
    for (let round = 0; round < 5; round++) {
      const n = 40, t0 = process.hrtime.bigint();
      for (let k = 0; k < n; k++) S.ghost('herz', r, v, t + round * n + k, out);
      best = Math.min(best, Number(process.hrtime.bigint() - t0) / 1e6 / n);
    }
    check(best < 2, `a ghost path with its patch takes ${f3(best, 3)} ms (≤ 2 ms: a few a second, not every frame)`);
  }
}

// ============================================================================================ (k) R§1.9 at scale 1
section('(k) REFERENCE §1.9 at scale 1 (the same functions, real Earth and Sun)');
{
  const muE = U.MU_EARTH, RE = 6371e3, rL = RE + 400e3, rG = 42164e3;
  const ho = U.hohmann(muE, rL, rG);
  const within = (got, want, nm, u) => check(Math.abs(got - want) / want <= 0.01, `${nm}: ${f3(got, 3)}${u} (R§1.9 ${want}${u}, ±1 %)`);
  within(U.vCirc(muE, rL) / 1e3, 7.67, 'LEO 400 km: speed', ' km/s'); within(U.period(muE, rL) / 60, 92.4, 'LEO 400 km: period', ' min');
  within(ho.dv1 / 1e3, 2.40, 'LEO → GEO: first burn', ' km/s'); within(ho.dv2 / 1e3, 1.46, 'LEO → GEO: second burn', ' km/s');
  within(ho.dv / 1e3, 3.86, 'LEO → GEO: total', ' km/s'); within(ho.t / 3600, 5.3, 'LEO → GEO: transfer time', ' h');
  const mars = U.hohmann(U.MU_SUN, 149.6e9, 228.0e9);
  within(mars.t / 86400, 259, 'Earth → Mars: Hohmann time', ' d');
  within(mars.dv1 / 1e3, 2.95, 'Earth → Mars: v∞ at departure', ' km/s'); within(mars.dv2 / 1e3, 2.65, 'Earth → Mars: v∞ at arrival', ' km/s');
  within(U.dvFromOrbit(mars.dv1, muE, rL) / 1e3, 3.57, 'Earth → Mars: Δv from LEO', ' km/s');
  const ven = U.hohmann(U.MU_SUN, 149.6e9, 108.2e9); within(ven.t / 86400, 146, 'Earth → Venus: Hohmann time', ' d');
  // low orbits 5 % above the surface (R§1.9's escape column is the surface's)
  for (const [nm, mu, R, v, ve, T] of [['Earth', muE, 6371e3, 7.72, 11.19, 1.51], ['Moon', 4.9048695e12, 1737.4e3, 1.64, 2.38, 1.94], ['Mars', 4.282837e13, 3389.5e3, 3.47, 5.03, 1.79]]) {
    within(U.vCirc(mu, 1.05 * R) / 1e3, v, nm + ': low orbit speed (5 % up)', ' km/s'); within(U.vEsc(mu, R) / 1e3, ve, nm + ': escape speed', ' km/s'); within(U.period(mu, 1.05 * R) / 3600, T, nm + ': low orbit period', ' h');
  }
  within(U.soiRadius(149.6e9, muE, U.MU_SUN) / 1e3, 925000, 'Earth\'s sphere of influence', ' km');
  within(U.soiRadius(384.4e6, 4.9048695e12, muE) / 1e3, 66000, 'the Moon\'s (vs Earth)', ' km');
  within(U.soiRadius(228.0e9, 4.282837e13, U.MU_SUN) / 1e3, 577000, 'Mars\'s', ' km');
}

// ============================================================================================ (l) the Heartland's sun
section('(l) the Heartland\'s sun against env.js');
{
  const envSun = (ticks) => { const th = ticks / 24000 * 2 * Math.PI, el = Math.sin(th) * 0.42, az = th + 0.4; return unit([Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)]); };
  const days = Math.ceil(B('herz').orbit.T / 1200) + 1;
  let mDir = 0, mEl = 0, tDir = 0, tEl = 0, d0Dir = 0, d0El = 0;
  const sky = U.localSky('overworld', [0, 63, 0], 0);
  for (let day = 0; day < days; day++) {
    for (let tick = 0; tick < 24000; tick += 20) {
      const t = U.worldSeconds(day, tick), env = envSun(tick);
      const st = S.state(t);
      const mean = localOf(C, 'herz', 0, 0, t, unit(scl(st.b.amarant.r, -1)));
      U.localSky('overworld', [0, 63, 0], t, sky);
      const tru = Array.from(sky.sun.dir);
      const dm = deg(angle(mean, env)), em = Math.abs(deg(Math.asin(mean[1]) - Math.asin(env[1])));
      const dt = deg(angle(tru, env)), et = Math.abs(deg(Math.asin(tru[1]) - Math.asin(env[1])));
      if (dm > mDir) mDir = dm; if (em > mEl) mEl = em; if (dt > tDir) tDir = dt; if (et > tEl) tEl = et;
      if (day === 0) { d0Dir = Math.max(d0Dir, dt); d0El = Math.max(d0El, et); }
    }
  }
  check(mDir <= 2.6 && mEl <= 0.3, `the mean sun on every day of a full Herzwelt orbit (${days} days): direction ${f3(mDir)}° (≤ 2.6°), height ${f3(mEl)}° (≤ 0.3°) — U§2.2's 2.5° / 0.28°`);
  check(tDir <= 2.61 && tEl <= 0.35, `the true sun (Herzwelt's centre circles Amarant: ±0.10° parallax): direction ${f3(tDir)}°, height ${f3(tEl)}° (≤ 2.61° / 0.35°)`);
  console.log(`    (day 0: the true sun ${f3(d0Dir)}° / ${f3(d0El)}°)`);
  const lat = C.latLon(0, 0, [0, 0])[0];
  num('the Heartland\'s latitude', deg(lat), '65.94', '°');
}

// ============================================================================================ (m) the charts
section('(m) the charts — azimuthal equidistant, plane ↔ sphere');
{
  const Hz = B('herz');
  num('Herzwelt\'s pole from the Heartland', Math.hypot(C.P[0], C.P[1]) / KM, '41.8', 'km');
  num('true north east of the map\'s north', deg(Math.atan2(C.P[0], -C.P[1])), '22.9', '°');
  check(Math.abs(C.edge - Math.PI * Hz.R) < 1e-6, 'the edge of the map: the antipode circle ' + f3(C.edge / KM, 1) + ' km from the pole');
  // round trips
  for (const id of ['herz', 'aqua', 'zinn', 'opal', 'basalt', 'ocker']) {
    const ch = U.chart(id), b = B(id), reach = id === 'herz' ? 300e3 : 0.95 * Math.PI * b.R;
    let worst = 0, worstArc = 0, n = 0;
    const p = new Float64Array(3), q = [0, 0];
    for (let k = 0; k < 4000; k++) {
      const rho = reach * Math.sqrt(rng()), az = rng() * 2 * Math.PI, x = ch.P[0] + rho * Math.cos(az), z = ch.P[1] + rho * Math.sin(az);
      ch.toSphere(x, z, p); ch.toPlane(p, q);
      worst = Math.max(worst, Math.hypot(q[0] - x, q[1] - z));
      worstArc = Math.max(worstArc, Math.abs(b.R * angle(Array.from(p), Array.from(ch.pole)) - rho)); n++;
    }
    check(worst < 1e-3, `${b.name.de}: plane → sphere → plane over ${n} points out to ${f3(reach / KM, 1)} km from the pole: ${ex(worst)} m (< 1 mm)`);
    check(worstArc < 1e-6, `${b.name.de}: the distance from the pole on the plane is the arc on the sphere (${ex(worstArc)} m)`);
  }
  // the Heartland's own frame: north, up, right-handed
  {
    const F = C.frame(0, 0, new Float64Array(9)), X = [F[0], F[1], F[2]], Y = [F[3], F[4], F[5]], Z = [F[6], F[7], F[8]];
    const n0 = C.toSphere(0, 0, new Float64Array(3)), pole = Array.from(C.pole);
    check(len(sub(Y, Array.from(n0))) < 1e-12, 'up at the Heartland is the sphere\'s normal there');
    const north = unit(sub(pole, scl(Y, dot(pole, Y))));
    const nLocal = [dot(north, X), dot(north, Y), dot(north, Z)];
    check(Math.abs(deg(Math.atan2(nLocal[0], -nLocal[2])) - deg(0.4)) < 1e-9, `true north points ${f3(deg(Math.atan2(nLocal[0], -nLocal[2])), 3)}° east of map north at the Heartland`);
    check(len(sub(cross(X, Y), Z)) < 1e-12, 'the local frame is right-handed (x east, y up, z south)');
  }
  // orthonormal everywhere, continuous across the pole
  {
    let worst = 0;
    for (let k = 0; k < 2000; k++) {
      const x = (rng() - 0.5) * 500e3, z = (rng() - 0.5) * 500e3, F = C.frame(x, z, new Float64Array(9));
      const X = [F[0], F[1], F[2]], Y = [F[3], F[4], F[5]], Z = [F[6], F[7], F[8]];
      worst = Math.max(worst, Math.abs(len(X) - 1), Math.abs(len(Y) - 1), Math.abs(len(Z) - 1), Math.abs(dot(X, Y)), Math.abs(dot(Y, Z)), Math.abs(dot(X, Z)), len(sub(cross(X, Y), Z)));
    }
    const Fa = C.frame(C.P[0] + 0.01, C.P[1], new Float64Array(9)), Fb = C.frame(C.P[0], C.P[1], new Float64Array(9)), Fc = C.frame(C.P[0] - 0.007, C.P[1] + 0.004, new Float64Array(9));
    const jump = Math.max(...[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => Math.max(Math.abs(Fa[i] - Fb[i]), Math.abs(Fc[i] - Fb[i]))));
    check(worst < 1e-12 && jump < 1e-6, `local frames orthonormal and right-handed at 2,000 points (${ex(worst)}), continuous through the pole (${ex(jump)})`);
  }
  // local time: the Heartland keeps the world clock; true east the sun comes earlier
  {
    check(C.localTicks(0, 0, 6000) === 6000, 'local time at the Heartland = the world clock');
    // two points on the equator 1 km apart (true east), through the chart
    const R = Hz.R, a = [R, 0, 0].map((x, i) => [Math.cos(0.3), Math.sin(0.3), 0][i]), b = [Math.cos(0.3 + 1000 / R), Math.sin(0.3 + 1000 / R), 0];
    const pa = C.toPlane(a, [0, 0]), pb = C.toPlane(b, [0, 0]);
    const ds = (C.localTicks(pb[0], pb[1], 6000) - C.localTicks(pa[0], pa[1], 6000)) / 20;
    num('local time: seconds per km east on the equator (U§4.5)', ds, '1.9', 's');
    const q = C.frame(0, 0, new Float64Array(9));
    // 1 km of map true east at the Heartland (the chart's azimuthal scale there is sin c / c = 0.971: 1 km of map is 0.971 km of sphere)
    const east = unit(cross(Array.from(C.pole), [q[3], q[4], q[5]]));
    const eMap = [dot(east, [q[0], q[1], q[2]]), dot(east, [q[6], q[7], q[8]])];
    const dh = (C.localTicks(eMap[0] * 1000, eMap[1] * 1000, 6000) - 6000) / 20;
    check(Math.abs(dh - 1200 * 1000 / (2 * Math.PI * Hz.R * 0.42)) < 0.01, `… ${f3(dh, 2)} s per km of map east at the Heartland (65.9° N: the sun comes earlier there)`);
  }
}

// ============================================================================================ (n) local skies
section('(n) local skies');
{
  const A = B('amarant');
  // the parent's size at the sub-parent point (the table's "in its sky", observer on the facing surface)
  for (const [id, par, want] of [['herz', 'amarant', '14.0'], ['herz', 'aqua', '9.8'], ['aqua', 'herz', '22.9'], ['zinn', 'amarant', '37.2'], ['opal', 'amarant', '26.8'], ['basalt', 'amarant', '9.9'], ['ocker', 'amarant', '6.3']]) {
    const t = 777, st = S.state(t), Bm = S.spin(id, t, new Float64Array(9));
    const dirFixed = unit(mtv(Bm, sub(st.b[par].r, st.b[id].r))), rFixed = scl(dirFixed, B(id).R);
    const sk = S.skyAt(id, rFixed, t);
    const e = sk.bodies.find(x => x.id === par);
    num(`${B(id).name.de}: ${B(par).name.de} overhead`, deg(2 * e.ang), want, '°');
  }
  // the moons' spawns: the parent ~35° high and fixed; the sun's disc, its light
  for (const id of ['aqua', 'zinn', 'opal']) {
    const sk = U.localSky(id, [0, 63, 0], 1000), el = deg(Math.asin(sk.parent.dir[1]));
    check(el > 30 && el < 36, `${B(id).name.de}: from the spawn ${B(sk.parent.id).name.de} stands ${f3(el, 1)}° high (the postcard 35°, minus the parallax)`);
    check(sk.parent.dir[2] > 0.5, `… toward map south (${f3(deg(Math.atan2(sk.parent.dir[0], sk.parent.dir[2])), 1)}° off it)`);
  }
  {
    const sk = U.localSky('overworld', [0, 63, 0], 300);
    num('Helia\'s disc from Herzwelt', deg(2 * sk.sun.ang), '0.42', '°');
    num('its light at Herzwelt', sk.sun.flux, '1,357', 'W/m²');
    check(sk.parent.id === 'amarant' && sk.bodies.length === S.ids.length - 2, 'Herzwelt\'s sky: the parent Amarant and every other body (' + sk.bodies.map(b => b.id).join(', ') + ')');
    check(sk.sun.dir[1] > 0.4 && Math.abs(deg(Math.asin(sk.sun.dir[1])) - 24.06) < 0.4, `at noon the sun stands ${f3(deg(Math.asin(sk.sun.dir[1])), 2)}° high over the Heartland (0.42 rad = 24.06°)`);
  }
  // phases: the parent's lit fraction over an orbit, new when the sun is behind it
  {
    const out = U.localSky('opal', [0, 63, 0], 0); let lo = 2, hi = -1;
    for (let t = 0; t < B('opal').orbit.T; t += 60) { U.localSky('opal', [0, 63, 0], t, out); lo = Math.min(lo, out.parent.phase); hi = Math.max(hi, out.parent.phase); }
    check(lo < 0.02 && hi > 0.98, `Opal: Amarant goes from new (${f3(lo, 3)}) to full (${f3(hi, 3)}) once an orbit`);
  }
  // eclipses at the start: at the sub-parent point (the chart's pole), fraction of the sun's disc ≥ 0.5
  const eclipses = (id, span, step) => {
    const ch = U.chart(id), out = U.localSky(id, [ch.P[0], 63, ch.P[1]], 0), list = []; let on = -1, peak = 0;
    for (let t = 0; t <= span; t += step) {
      U.localSky(id, [ch.P[0], 63, ch.P[1]], t, out);
      if (out.eclipse >= 0.5 && on < 0) on = t; if (out.eclipse > peak) peak = out.eclipse;
      if (out.eclipse < 0.5 && on >= 0) { list.push([on, t - on]); on = -1; }
    }
    return { list, peak, by: out.eclipseBy };
  };
  {
    const z = eclipses('zinn', 3 * 3600 + 600, 1);
    check(z.list.length >= 1, `Zinnober: ${z.list.length} eclipses in the first 3 h (peak ${f3(z.peak, 2)})`);
    if (z.list.length) num('Zinnober: an eclipse lasts', z.list[0][1] / 60, '7', 'min');
    if (z.list.length > 1) num('… every', (z.list[1][0] - z.list[0][0]) / 3600, '1.61', 'h');
    const o = eclipses('opal', 5 * 3600 + 900, 1);
    check(o.list.length >= 1, `Opal: ${o.list.length} eclipses in the first 5 h (peak ${f3(o.peak, 2)})`);
    if (o.list.length) num('Opal: an eclipse lasts', o.list[0][1] / 60, '5', 'min');
    if (o.list.length > 1) num('… every', (o.list[1][0] - o.list[0][0]) / 3600, '2.57', 'h');
    // Herzwelt: no eclipse by Amarant at the start, its eclipse seasons are rare
    let anyStart = 0;
    for (let t = 0; t < 10 * 86400; t += 30) { const e = S.eclipseAt('herz', t, 'amarant'); if (e > 0) { anyStart = t; break; } }
    check(anyStart === 0, 'Herzwelt: no eclipse by Amarant in the first 10 days of play (the sun 20° off its orbit plane)');
    let orbits = 0, withEcl = 0, withAq = 0; const Th = B('herz').orbit.T, year = A.orbit.T;
    for (let t0 = 0; t0 < year; t0 += Th) {
      orbits++; let hit = false, aq = false;
      for (let t = t0; t < t0 + Th; t += 120) { if (!hit && S.eclipseAt('herz', t, 'amarant') > 0.5) hit = true; if (!aq && S.eclipseAt('herz', t, 'aqua') > 0) aq = true; if (hit && aq) break; }
      if (hit) withEcl++; if (aq) withAq++;
    }
    check(withEcl > 0 && withEcl / orbits < 0.35, `Herzwelt in Amarant's shadow on ${withEcl} of ${orbits} orbits of a year (${f3(100 * withEcl / orbits, 0)} %: "only in rare seasons")`);
    console.log(`    (Aquamarin crosses the sun as seen from Herzwelt's centre on ${withAq} of ${orbits} Herzwelt orbits: its shadow sweeps Herzwelt in those seasons)`);
  }
  // close by: 5 % over Amarant's cloud tops on its night side the sun is gone, on its day side it shines; the sun's disc
  // half behind the limb seen from 1.05 R
  {
    const t = 777, st = S.state(t), pA = st.b.amarant.r, s = unit(scl(pA, -1));
    const night = add(pA, scl(s, -1.05 * A.R)), day = add(pA, scl(s, 1.05 * A.R));
    const en = S.eclipseFrom(night, t, null, null), ed = S.eclipseFrom(day, t, null, null);
    check(en.frac === 1 && en.by === 'amarant' && ed.frac === 0, `5 % over Amarant: night side ${en.frac} (by ${en.by}), day side ${ed.frac}`);
    // the observer whose line to the sun's centre grazes Amarant's equator (1.05 R from the centre)
    const ax = A.spin.axis, d = 1.05 * A.R, Lg = Math.sqrt(d * d - A.R * A.R);
    let sl = s, limbPt = pA;
    for (let it = 0; it < 4; it++) { const side = unit(cross(ax, sl)); limbPt = add(add(pA, scl(side, A.R)), scl(sl, -Lg)); sl = unit(scl(limbPt, -1)); }
    const el = S.eclipseFrom(limbPt, t, null, null);
    check(Math.abs(el.frac - 0.5) < 0.05, `… with the sun's centre on the limb, half its disc is hidden (${f3(el.frac, 3)})`);
  }
  // the cost of a call (in place; a new moment every call, two worlds in turn): the best of five rounds, so a busy machine
  // (other fronts' browsers on two CPUs) measures the code rather than the queue
  {
    const out = U.localSky('opal', [100, 70, -40], 0), n = 4000;
    for (let k = 0; k < 4000; k++) U.localSky(k & 1 ? 'opal' : 'overworld', [100, 70, -40], k, out);
    let best = 1e9;
    for (let round = 0; round < 5; round++) {
      const t0 = process.hrtime.bigint();
      for (let k = 0; k < n; k++) U.localSky(k & 1 ? 'opal' : 'overworld', [100, 70, -40], 1000 + round * n + k * 0.37, out);
      best = Math.min(best, Number(process.hrtime.bigint() - t0) / 1e6 / n);
    }
    check(best <= 0.02, `localSky: ${f3(best * 1000, 2)} µs a call (≤ 0.02 ms; best of five rounds of ${n})`);
  }
  // the fixed ↔ inertial helpers (the rotating ground and space)
  {
    const t = 1234, rF = C.toSphere(0, 0, new Float64Array(3)), rf = [rF[0] * B('herz').R, rF[1] * B('herz').R, rF[2] * B('herz').R];
    const r = [0, 0, 0], v = [0, 0, 0]; S.fixedToInertial('herz', rf, [0, 0, 0], t, r, v);
    num('the ground at the Heartland moves eastward through space at', len(v), '212.6', 'm/s');
    const r2 = [0, 0, 0], v2 = [0, 0, 0]; S.inertialToFixed('herz', r, v, t, r2, v2);
    check(len(sub(r2, rf)) < 1e-6 && len(v2) < 1e-9, '… and back: at rest on the ground');
  }
}

// ============================================================================================ (o) TRIAD
section('(o) TRIAD and the postcard blend');
{
  // a known rotation recovered from two exact vector pairs
  let worst = 0;
  for (let k = 0; k < 200; k++) {
    const q = unit([rng() - 0.5, rng() - 0.5, rng() - 0.5]).concat([]); const ang = rng() * Math.PI;
    const R = new Float64Array(9); U.quatToMat([q[0] * Math.sin(ang / 2), q[1] * Math.sin(ang / 2), q[2] * Math.sin(ang / 2), Math.cos(ang / 2)], R);
    const a1 = unit([rng() - 0.5, rng() - 0.5, rng() - 0.5]), a2 = unit([rng() - 0.5, rng() - 0.5, rng() - 0.5]);
    const T = U.triad(a1, a2, mv(R, a1), mv(R, a2), new Float64Array(9));
    worst = Math.max(worst, ...Array.from(T).map((x, i) => Math.abs(x - R[i])));
  }
  check(worst < 1e-12, `TRIAD recovers 200 random rotations from two vector pairs (${ex(worst)})`);
  // the postcard → truth: the primary (the sun) exact, the secondary (the giant) in its plane
  const sunP = unit([0.3, 0.4, 0.8]), giantP = unit([-0.6, 0.55, 0.2]), sunT = unit([0.32, 0.38, 0.8]), giantT = unit([0.1, -0.2, 0.95]);
  const R = U.triad(sunP, giantP, sunT, giantT, new Float64Array(9));
  check(len(sub(mv(R, sunP), sunT)) < 1e-12, 'the primary anchor (the sun) is carried exactly');
  check(Math.abs(dot(mv(R, cross(sunP, giantP)), unit(cross(sunT, giantT))) - len(cross(sunP, giantP))) < 1e-12, '… the secondary (the giant) into its plane');
  const I = U.slerpRot(R, 0, new Float64Array(9)), H1 = U.slerpRot(R, 1, new Float64Array(9)), Hh = U.slerpRot(R, 0.5, new Float64Array(9));
  check(Array.from(I).every((x, i) => Math.abs(x - [1, 0, 0, 0, 1, 0, 0, 0, 1][i]) < 1e-12) && Array.from(H1).every((x, i) => Math.abs(x - R[i]) < 1e-12), 'the blend: identity at k 0, the TRIAD rotation at k 1');
  const HH = new Float64Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) HH[i * 3 + j] = Hh[i * 3] * Hh[j] + Hh[i * 3 + 1] * Hh[3 + j] + Hh[i * 3 + 2] * Hh[6 + j];
  check(Array.from(HH).every((x, i) => Math.abs(x - R[i]) < 1e-12), '… half the blend twice is the whole (a true slerp)');
  // a body's glide along its great circle
  const a = unit([1, 0.2, 0]), b = unit([0, 0.3, 1]), m = U.slerpDir(a, b, 0.5, [0, 0, 0]);
  check(Math.abs(angle(a, m) - angle(m, b)) < 1e-12 && Math.abs(dot(m, unit(cross(a, b)))) < 1e-12, 'slerpDir glides along the great circle (halfway is halfway)');
  check(U.climbK(250) === 0 && U.climbK(300) === 0 && U.climbK(2500) === 1 && Math.abs(U.climbK(1400) - 0.5) < 1e-12, 'the climb\'s blend: smootherstep(300, 2,500 m) — 0 below the clouds, 1 at the edge');
}

// ============================================================================================ (p) wiring
section('(p) the wiring');
{
  const build = fs.readFileSync(path.join(__dirname, '..', 'build.js'), 'utf8');
  const shared = (build.match(/const SHARED = \[([^\]]*)\]/) || [])[1] || '';
  check(/'universe'/.test(shared), 'build.js: universe in SHARED (main thread and workers)');
  check(/texHash[^\n]*f !== 'universe'/.test(build), 'build.js: universe stays out of the texture cache key (a change to the orbits forges no texture)');
  check(/'universe'/.test(fs.readFileSync(path.join(__dirname, 'load_shared.js'), 'utf8')), 'test/load_shared.js loads universe');
  const ctx = {}; vm.createContext(ctx); vm.runInContext(fs.readFileSync(SRC, 'utf8'), ctx, { filename: 'universe.js' });
  const U2 = ctx.VR && ctx.VR.Universe;
  check(!!U2, 'the module runs alone in a bare context (a worker without core.js)');
  if (U2) { const a = U2.home.state(98765.4321), b = S.state(98765.4321); check(S.ids.every(id => len(sub(Array.from(a.b[id].r), Array.from(b.b[id].r))) === 0), '… and computes the same sky, to the bit'); }
  const src = fs.readFileSync(SRC, 'utf8');
  check(!/\b(document|window|localStorage|fetch|XMLHttpRequest)\b/.test(src.replace(/\/\/.*$/gm, '')), 'pure: no DOM, no storage, no network');
}

console.log('');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
