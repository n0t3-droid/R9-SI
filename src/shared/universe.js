// ============================================================================
// VR.Universe — the orbital mechanics core (u-orbit · docs/superpowers/specs/2026-10-22-universe-design.md §2–§4, §13;
// the plan docs/superpowers/plans/2026-10-22-u-orbit.md; the facts docs/universe/REFERENCE.md §1.9, Appendix A).
// Pure: the main thread and the workers run it; nothing here touches a page, a store or the network. The per-frame calls
// (state, localSky, the Verlet step) allocate nothing when they are handed their `out`.
//
// Units: metres at game scale (real lengths ÷ 64), seconds of world time t = (day·24000 + ticks)/20 (U.worldSeconds).
// Gravity is true per body (μ = g·R², so game μ = real μ ÷ 4096 and every orbital period is the real one ÷ 8).
// Frames:  the system frame — Helia at the origin, Z = ecliptic north (the normal of Amarant's orbit), X the reference
//          direction in the ecliptic; doubles everywhere, offsets between bodies summed along the body tree.
//          a body-fixed frame — z = the spin axis, x = the prime meridian; B (3×3, row-major) maps body-fixed → system.
//          a local frame — x = map east, y = up, z = map south (env.js's axes), from the body's chart.
//
//   U.kepler(M, e) · U.keplerH(M, e)            Kepler's equation, elliptic (Newton from Mikkola's start) and hyperbolic
//   U.elToState(el, μ, t, r, v) · U.stateToEl   elements {a, e, i, node, peri, M0, t0} ↔ position and velocity
//   U.coast(r0, v0, μ, dt, r, v)                coasting on any conic — universal variables, nothing integrated
//   U.verletInit(s, μ) · U.verlet(s, dt, μ, ax, ay, az)   one velocity-Verlet step under thrust (s = {r, v, a})
//   U.vCirc · vEsc · period · hohmann · soiRadius · hillRadius · dvFromOrbit   two-body helpers at any scale
//   U.home (= the compiled Helia system, S) and U.compile(def) for the systems of other stars (u-stars):
//     S.state(t, out?)  every body: r, v (system frame), rel (to the parent: r then v), B (body-fixed → system)
//     S.pos · S.rel · S.spin · S.body(id) · S.ids · S.children
//     S.soi(id) · S.hill(id) · S.dominant(rSys, t) · S.offset(from, to, t, r, v) · S.toFrame(from, to, r, v, t, ro, vo)
//     S.soiExit(frame, r, v, t) · S.ghost(frame, r, v, t, out?)  the ghost path: 128 points + one patch
//     S.fixedToInertial · S.inertialToFixed · S.surfaceSpeed   the turning ground ↔ space (Herzwelt turns in 20 min!)
//     S.chartToInertial(id, [x, y, z], [vx, vy, vz], t, r, v) · S.inertialToChart   a world's map ↔ space (the hand-off)
//     S.skyFrom(rSys, t, out?) · S.skyAt(id, rFixed, t, out?) · S.localSky(dim, chartPos, t, out?)
//     S.eclipseAt(id, t, only?) · S.eclipseFrom(rSys, t, skip, res?, only?)
//     S.chart(id): azimuthal equidistant plane ↔ sphere (toSphere, toPlane, frame, latLon, localTicks)
//     S.solarDay · S.synodic · S.geoRadius · S.flux · S.orbitNormal · S.table()
//   U.triad(a1, a2, b1, b2, m) · U.slerpRot(m, k, out) · U.slerpDir(a, b, k, out) · U.matToQuat · U.quatToMat
//   U.smootherstep(e0, e1, x) · U.climbK(y)       the postcard blend of the climb (U§2.2, §5.1)
// ============================================================================
(function (VR) {
  'use strict';
  const PI = Math.PI, TAU = 2 * PI, D2R = PI / 180;
  // ---------------------------------------------------------------- constants (real values; the game divides lengths by L)
  const AU = 1.495978707e11, MU_SUN = 1.32712440018e20, R_SUN = 6.957e8, MU_JUP = 1.26686534e17, MU_EARTH = 3.986004418e14;
  const L = 64, SOLAR = 1361;
  const SCALE = Object.freeze({ L, length: 1 / L, period: 1 / 8, walk: 30 / 9.81, betaOrbit: L });
  const DAY = 1200, NOON = 300;                          // a world day in seconds; the Heartland's local noon (tick 6000)
  const BANDS = Object.freeze({ air: 252, high: 300, edge: 2500 });   // U§5.1: the climb's bands over Herzwelt (m)
  const DIM_BODY = Object.freeze({ overworld: 'herz', aqua: 'aqua', zinn: 'zinn', opal: 'opal', basalt: 'basalt', ocker: 'ocker' });

  // ---------------------------------------------------------------- small vector helpers (no allocation)
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const len = (a) => Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
  function crossInto(a, b, o) { const x = a[1] * b[2] - a[2] * b[1], y = a[2] * b[0] - a[0] * b[2], z = a[0] * b[1] - a[1] * b[0]; o[0] = x; o[1] = y; o[2] = z; return o; }
  function unitInto(a, o) { const l = len(a) || 1; o[0] = a[0] / l; o[1] = a[1] / l; o[2] = a[2] / l; return o; }
  function set3(o, x, y, z) { o[0] = x; o[1] = y; o[2] = z; return o; }
  function copy3(a, o) { o[0] = a[0]; o[1] = a[1]; o[2] = a[2]; return o; }
  const v3 = () => new Float64Array(3);
  // row-major 3×3: m·v and mᵀ·v
  function mulInto(m, a, o) { const x = m[0] * a[0] + m[1] * a[1] + m[2] * a[2], y = m[3] * a[0] + m[4] * a[1] + m[5] * a[2], z = m[6] * a[0] + m[7] * a[1] + m[8] * a[2]; o[0] = x; o[1] = y; o[2] = z; return o; }
  function mulTInto(m, a, o) { const x = m[0] * a[0] + m[3] * a[1] + m[6] * a[2], y = m[1] * a[0] + m[4] * a[1] + m[7] * a[2], z = m[2] * a[0] + m[5] * a[1] + m[8] * a[2]; o[0] = x; o[1] = y; o[2] = z; return o; }
  const wrapPi = (a) => a - TAU * Math.floor((a + PI) / TAU);
  const clamp1 = (x) => (x < -1 ? -1 : x > 1 ? 1 : x);

  // ================================================================ Kepler's equation
  // elliptic (0 ≤ e < 1): E − e sin E = M. Mikkola's cubic start (1987) is good to ~1e-3; Newton then doubles the digits
  // each step, so four steps reach the double's limit for e ≤ 0.97 (kepler.steps holds the count of the last call)
  function kepler(M, e) {
    if (e < 1e-15) { kepler.steps = 0; return M; }
    const m = wrapPi(M), k = M - m;                       // m in [−π, π): the cubic start wants it there
    const den = 4 * e + 0.5, al = (1 - e) / den, be = 0.5 * m / den;
    const sq = Math.sqrt(be * be + al * al * al);
    const z = be < 0 ? -Math.cbrt(sq - be) : Math.cbrt(be + sq);
    let s = z - al / z;
    s -= 0.078 * s * s * s * s * s / (1 + e);
    let E = m + e * s * (3 - 4 * s * s), steps = 0;
    for (; steps < 12;) {
      const f = E - e * Math.sin(E) - m, fp = 1 - e * Math.cos(E), dE = f / fp;
      E -= dE; steps++;
      if (Math.abs(dE) <= 1e-15 * (1 + Math.abs(E))) break;
    }
    kepler.steps = steps;
    return E + k;
  }
  kepler.steps = 0;
  // hyperbolic: e sinh H − H = M. Newton from the right of the root (f is convex there), so it never overshoots
  function keplerH(M, e) {
    if (M === 0) return 0;
    const m = Math.abs(M), f = (H) => e * Math.sinh(H) - H - m;
    let H = Math.cbrt(6 * m / e);                        // f ≥ 0 here (sinh H ≥ H + H³/6)
    const H2 = Math.asinh(2 * m / e);                     // and here for large M
    if (H2 < H && f(H2) >= 0) H = H2;
    for (let k = 0; k < 60; k++) {
      const fp = e * Math.cosh(H) - 1, dH = f(H) / fp;
      H -= dH;
      if (Math.abs(dH) <= 1e-15 * (1 + Math.abs(H))) break;
    }
    return M < 0 ? -H : H;
  }

  // ================================================================ elements ↔ state
  // el = {a, e, i, node, peri, M0, t0} (radians; elliptic): the perifocal frame P (to periapsis), Q, W (the normal)
  function pqwInto(i, node, peri, P, Q, W) {
    const cO = Math.cos(node), sO = Math.sin(node), cw = Math.cos(peri), sw = Math.sin(peri), ci = Math.cos(i), si = Math.sin(i);
    set3(P, cO * cw - sO * sw * ci, sO * cw + cO * sw * ci, sw * si);
    set3(Q, -cO * sw - sO * cw * ci, -sO * sw + cO * cw * ci, cw * si);
    if (W) set3(W, sO * si, -cO * si, ci);
  }
  const _P = v3(), _Q = v3();
  function elToState(el, mu, t, r, v) {
    const a = el.a, e = el.e, n = Math.sqrt(mu / (a * a * a));
    const E = kepler(el.M0 + n * (t - (el.t0 || 0)), e), cE = Math.cos(E), sE = Math.sin(E), fac = Math.sqrt(1 - e * e);
    const x = a * (cE - e), y = a * fac * sE, rr = a * (1 - e * cE), k = Math.sqrt(mu * a) / rr;
    pqwInto(el.i, el.node, el.peri, _P, _Q, null);
    for (let j = 0; j < 3; j++) { r[j] = x * _P[j] + y * _Q[j]; if (v) v[j] = -k * sE * _P[j] + k * fac * cE * _Q[j]; }
    return r;
  }
  function stateToEl(r, v, mu) {
    const rr = len(r), vv = dot(v, v), rv = dot(r, v);
    const h = crossInto(r, v, [0, 0, 0]), hh = len(h);
    const vxh = crossInto(v, h, [0, 0, 0]);
    const ev = [vxh[0] / mu - r[0] / rr, vxh[1] / mu - r[1] / rr, vxh[2] / mu - r[2] / rr], e = len(ev);
    const energy = vv / 2 - mu / rr, a = -mu / (2 * energy), p = hh * hh / mu;
    const i = Math.acos(clamp1(h[2] / hh));
    const nv = [-h[1], h[0], 0], nn = Math.hypot(nv[0], nv[1]);
    const hu = [h[0] / hh, h[1] / hh, h[2] / hh];
    let node = nn > 1e-12 * hh ? Math.atan2(nv[1], nv[0]) : 0;
    if (node < 0) node += TAU;
    // the reference in the plane: the node line (or X for an orbit in the ecliptic)
    const nref = nn > 1e-12 * hh ? [nv[0] / nn, nv[1] / nn, 0] : [1, 0, 0];
    const ang = (u, w) => { const c = crossInto(u, w, [0, 0, 0]); return Math.atan2(dot(c, hu), dot(u, w)); };
    let peri = 0, nu;
    if (e > 1e-12) { const eu = [ev[0] / e, ev[1] / e, ev[2] / e]; peri = ang(nref, eu); nu = ang(eu, r); }
    else nu = ang(nref, r);
    if (peri < 0) peri += TAU;
    let E = null, H = null, M;
    if (e < 1) { E = Math.atan2(Math.sqrt(1 - e * e) * Math.sin(nu), e + Math.cos(nu)); M = E - e * Math.sin(E); if (M < 0) M += TAU; }
    else { H = Math.asinh(Math.sqrt(e * e - 1) * Math.sin(nu) / (1 + e * Math.cos(nu))); M = e * Math.sinh(H) - H; }
    const n = Math.sqrt(mu / Math.abs(a * a * a));
    return { a, e, i, node, peri, nu, E, H, M, p, n, period: e < 1 ? TAU / n : Infinity, rp: p / (1 + e), ra: e < 1 ? p / (1 - e) : Infinity, h, evec: ev, energy, rv };
  }

  // ================================================================ coasting: universal variables (Stumpff C, S)
  function stumpC(z) {
    if (z > 1e-3) { const s = Math.sin(0.5 * Math.sqrt(z)); return 2 * s * s / z; }
    if (z < -1e-3) { const s = Math.sinh(0.5 * Math.sqrt(-z)); return 2 * s * s / -z; }
    return 0.5 - z * (1 / 24 - z * (1 / 720 - z * (1 / 40320 - z / 3628800)));
  }
  function stumpS(z) {
    if (z > 0.5) { const s = Math.sqrt(z); return (s - Math.sin(s)) / (s * s * s); }
    if (z < -0.5) { const s = Math.sqrt(-z); return (Math.sinh(s) - s) / (s * s * s); }
    return 1 / 6 - z * (1 / 120 - z * (1 / 5040 - z * (1 / 362880 - z * (1 / 39916800 - z * (1 / 6227020800 - z * (1 / 1307674368000 - z / 355687428096000))))));
  }
  const _cr = v3(), _cv = v3();
  // r0, v0 relative to the attracting centre; dt in seconds (either sign); r, v may be r0, v0 themselves
  function coast(r0, v0, mu, dt, r, v) {
    copy3(r0, _cr); copy3(v0, _cv);
    const r0n = len(_cr), rv = dot(_cr, _cv), sqmu = Math.sqrt(mu), alpha = 2 / r0n - dot(_cv, _cv) / mu;
    // an ellipse: within half a period either way (a small step back on a long ellipse must not become a whole orbit on)
    if (alpha > 0) { const T = TAU / (sqmu * alpha * Math.sqrt(alpha)); dt -= T * Math.round(dt / T); }
    if (dt === 0) { copy3(_cr, r); if (v) copy3(_cv, v); return r; }
    const A = rv / sqmu, Bc = 1 - alpha * r0n, sdt = sqmu * dt;
    const F = (x) => { const z = alpha * x * x; return A * x * x * stumpC(z) + Bc * x * x * x * stumpS(z) + r0n * x - sdt; };
    // the bracket (F rises with χ: F' = r > 0)
    let lo, hi, x;
    if (alpha > 0) { hi = TAU / Math.sqrt(alpha); lo = -hi; x = sqmu * alpha * dt; }
    else {
      x = sdt / r0n;
      if (alpha < -1e-12) {
        const a = 1 / alpha, sg = dt > 0 ? 1 : -1;
        const g = sg * Math.sqrt(-a) * Math.log((-2 * mu * alpha * dt) / (rv + sg * Math.sqrt(-mu * a) * (1 - r0n * alpha)));
        if (isFinite(g)) x = g;
      }
      if (dt > 0) { lo = 0; hi = Math.max(Math.abs(x), 1e-6) * 2; while (F(hi) < 0) { lo = hi; hi *= 2; } }
      else { hi = 0; lo = -Math.max(Math.abs(x), 1e-6) * 2; while (F(lo) > 0) { hi = lo; lo *= 2; } }
    }
    if (!(x > lo && x < hi)) x = 0.5 * (lo + hi);
    for (let k = 0; k < 100; k++) {
      const z = alpha * x * x, c = stumpC(z), s = stumpS(z);
      const f = A * x * x * c + Bc * x * x * x * s + r0n * x - sdt;
      const fp = A * x * (1 - z * s) + Bc * x * x * c + r0n;
      if (f > 0) hi = x; else lo = x;
      let xn = x - f / fp;
      if (!(xn > lo && xn < hi)) xn = 0.5 * (lo + hi);
      const dx = Math.abs(xn - x);
      x = xn;
      if (dx <= 1e-15 * Math.abs(x) || hi - lo <= 1e-15 * Math.abs(x)) break;
    }
    const z = alpha * x * x, c = stumpC(z), s = stumpS(z);
    const f = 1 - x * x * c / r0n, g = dt - x * x * x * s / sqmu;
    const rx = f * _cr[0] + g * _cv[0], ry = f * _cr[1] + g * _cv[1], rz = f * _cr[2] + g * _cv[2];
    const rn = Math.sqrt(rx * rx + ry * ry + rz * rz);
    const fd = sqmu / (rn * r0n) * x * (z * s - 1), gd = 1 - x * x * c / rn;
    if (v) set3(v, fd * _cr[0] + gd * _cv[0], fd * _cr[1] + gd * _cv[1], fd * _cr[2] + gd * _cv[2]);
    return set3(r, rx, ry, rz);
  }

  // ================================================================ thrust: velocity Verlet (kick, drift, kick)
  // s = {r, v, a}: a holds the gravity at r (verletInit once, then every step keeps it); the thrust (ax, ay, az) acts in
  // both half kicks; the caller adds drag to it. 1/120 s keeps the energy within 1e-8 over ten low orbits.
  function verletInit(s, mu) { const r = s.r, rr = len(r), k = -mu / (rr * rr * rr); s.a[0] = k * r[0]; s.a[1] = k * r[1]; s.a[2] = k * r[2]; return s; }
  function verlet(s, dt, mu, ax, ay, az) {
    const r = s.r, v = s.v, a = s.a, h = 0.5 * dt;
    ax = ax || 0; ay = ay || 0; az = az || 0;
    v[0] += (a[0] + ax) * h; v[1] += (a[1] + ay) * h; v[2] += (a[2] + az) * h;
    r[0] += v[0] * dt; r[1] += v[1] * dt; r[2] += v[2] * dt;
    const rr = Math.sqrt(r[0] * r[0] + r[1] * r[1] + r[2] * r[2]), k = -mu / (rr * rr * rr);
    a[0] = k * r[0]; a[1] = k * r[1]; a[2] = k * r[2];
    v[0] += (a[0] + ax) * h; v[1] += (a[1] + ay) * h; v[2] += (a[2] + az) * h;
    return s;
  }

  // ================================================================ two-body helpers (any scale; R§1.9, Appendix A)
  const vCirc = (mu, r) => Math.sqrt(mu / r);
  const vEsc = (mu, r) => Math.sqrt(2 * mu / r);
  const period = (mu, a) => TAU * Math.sqrt(a * a * a / mu);
  function hohmann(mu, r1, r2) {
    const at = 0.5 * (r1 + r2), vp = Math.sqrt(mu * (2 / r1 - 1 / at)), va = Math.sqrt(mu * (2 / r2 - 1 / at));
    const dv1 = Math.abs(vp - Math.sqrt(mu / r1)), dv2 = Math.abs(Math.sqrt(mu / r2) - va);
    return { dv1, dv2, dv: dv1 + dv2, t: PI * Math.sqrt(at * at * at / mu), at };
  }
  const soiRadius = (a, mu, muP) => a * Math.pow(mu / muP, 0.4);
  const hillRadius = (a, mu, muP, e) => a * (1 - (e || 0)) * Math.cbrt(mu / (3 * muP));
  const dvFromOrbit = (vInf, mu, r) => Math.sqrt(vInf * vInf + 2 * mu / r) - Math.sqrt(mu / r);

  // ================================================================ rotations: TRIAD, quaternions, the postcard blend
  const _t = [v3(), v3(), v3(), v3(), v3(), v3()];
  // R with R·a1 = b1 exactly and R·(a1×a2) ∥ (b1×b2): the attitude from two observed directions (the sun, the giant)
  function triad(a1, a2, b1, b2, m) {
    const [ta1, ta2, ta3, tb1, tb2, tb3] = _t;
    unitInto(a1, ta1); unitInto(crossInto(a1, a2, ta2), ta2); crossInto(ta1, ta2, ta3);
    unitInto(b1, tb1); unitInto(crossInto(b1, b2, tb2), tb2); crossInto(tb1, tb2, tb3);
    m = m || new Float64Array(9);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) m[i * 3 + j] = tb1[i] * ta1[j] + tb2[i] * ta2[j] + tb3[i] * ta3[j];
    return m;
  }
  // q = [x, y, z, w] (w the scalar part)
  function matToQuat(m, q) {
    q = q || new Float64Array(4);
    const tr = m[0] + m[4] + m[8];
    if (tr > 0) { const s = 2 * Math.sqrt(tr + 1); q[3] = 0.25 * s; q[0] = (m[7] - m[5]) / s; q[1] = (m[2] - m[6]) / s; q[2] = (m[3] - m[1]) / s; }
    else if (m[0] > m[4] && m[0] > m[8]) { const s = 2 * Math.sqrt(1 + m[0] - m[4] - m[8]); q[3] = (m[7] - m[5]) / s; q[0] = 0.25 * s; q[1] = (m[1] + m[3]) / s; q[2] = (m[2] + m[6]) / s; }
    else if (m[4] > m[8]) { const s = 2 * Math.sqrt(1 + m[4] - m[0] - m[8]); q[3] = (m[2] - m[6]) / s; q[0] = (m[1] + m[3]) / s; q[1] = 0.25 * s; q[2] = (m[5] + m[7]) / s; }
    else { const s = 2 * Math.sqrt(1 + m[8] - m[0] - m[4]); q[3] = (m[3] - m[1]) / s; q[0] = (m[2] + m[6]) / s; q[1] = (m[5] + m[7]) / s; q[2] = 0.25 * s; }
    const l = Math.hypot(q[0], q[1], q[2], q[3]); q[0] /= l; q[1] /= l; q[2] /= l; q[3] /= l;
    return q;
  }
  function quatToMat(q, m) {
    m = m || new Float64Array(9);
    const x = q[0], y = q[1], z = q[2], w = q[3];
    m[0] = 1 - 2 * (y * y + z * z); m[1] = 2 * (x * y - z * w); m[2] = 2 * (x * z + y * w);
    m[3] = 2 * (x * y + z * w); m[4] = 1 - 2 * (x * x + z * z); m[5] = 2 * (y * z - x * w);
    m[6] = 2 * (x * z - y * w); m[7] = 2 * (y * z + x * w); m[8] = 1 - 2 * (x * x + y * y);
    return m;
  }
  const _q = new Float64Array(4);
  // the rotation k of the way from the identity to m (k 0 → identity, 1 → m) along the shortest arc
  function slerpRot(m, k, out) {
    matToQuat(m, _q);
    if (_q[3] < 0) { _q[0] = -_q[0]; _q[1] = -_q[1]; _q[2] = -_q[2]; _q[3] = -_q[3]; }
    const sn = Math.hypot(_q[0], _q[1], _q[2]), th = Math.atan2(sn, _q[3]);
    if (sn < 1e-15) { _q[0] = _q[1] = _q[2] = 0; _q[3] = 1; }
    else { const f = Math.sin(k * th) / sn; _q[0] *= f; _q[1] *= f; _q[2] *= f; _q[3] = Math.cos(k * th); }
    return quatToMat(_q, out);
  }
  // a direction gliding along its great circle from a to b (the postcard bodies in the climb)
  function slerpDir(a, b, k, out) {
    out = out || v3();
    const c = crossInto(a, b, _t[0]), sn = len(c), om = Math.atan2(sn, dot(a, b));
    if (sn < 1e-12) { const w = 1 - k; set3(out, a[0] * w + b[0] * k, a[1] * w + b[1] * k, a[2] * w + b[2] * k); return unitInto(out, out); }
    const fa = Math.sin((1 - k) * om) / Math.sin(om), fb = Math.sin(k * om) / Math.sin(om);
    return set3(out, a[0] * fa + b[0] * fb, a[1] * fa + b[1] * fb, a[2] * fa + b[2] * fb);
  }
  const smootherstep = (e0, e1, x) => { let t = (x - e0) / (e1 - e0); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * t * (t * (t * 6 - 15) + 10); };
  const climbK = (y) => smootherstep(BANDS.high, BANDS.edge, y);
  const worldSeconds = (day, ticks) => (day * 24000 + ticks) / 20;

  // ================================================================ the Helia system (real-equivalent; U§2.1)
  // R in metres (real-equivalent: the game divides by 64), g in m/s² (or mu, real), orbits in metres or AU (real), angles in
  // degrees. `ref: 'equator'`: the elements are relative to the parent's equator (Amarant's = the ring plane; x toward the
  // equator's ascending node on the ecliptic). The free choices (nodes, starting anomalies, spin phases) are explained in the
  // plan §3.2: Opal's node puts its orbit 1.12° below the ring plane on the night side at the start (a 5-min eclipse with
  // Amarant's true oblate silhouette), Herzwelt's puts its orbit 8° above it there (no eclipse now; eclipse seasons twice a
  // year), Amarant's start puts Helia 12° above the ring plane, sinking 0.44° a day of play.
  const name = (de, en) => ({ de, en });
  const HELIA = {
    id: 'helia', name: name('Helia', 'Helia'),
    star: { type: 'F5 V', T: 6550, L: 3.6, M: 1.33, R: 1.5, color: '#dddeff' },
    bodies: [
      { id: 'helia', kind: 'star', name: name('Helia', 'Helia'), R: 1.5 * R_SUN, mu: 1.33 * MU_SUN, spin: { tilt: 0, T: 3 * 86400 / 8 } },
      { id: 'amarant', kind: 'giant', name: name('Amarant', 'Amaranth'), parent: 'helia', R: 60000e3, f: 0.098, mu: MU_JUP, air: 'H₂/He', landable: false,
        orbit: { a: 1.9 * AU, e: 0, i: 0, node: 0, peri: 0, start: { sunOverEquator: 12, falling: true } },
        // the pole 14° from the ecliptic's; 5.8 h real-equivalent: Saturn's q = ω²R³/GM with Jupiter's mass (its 9.8 %)
        spin: { tilt: 14, toward: 0, T: 5.8 * 3600 / 8 },
        ring: { inner: 74658 / 60268, outer: 136780 / 60268, thickness: 10,
          bands: [{ name: 'C', r0: 74658, r1: 91975, tau: [0.05, 0.35] }, { name: 'B', r0: 91975, r1: 117507, tau: [0.4, 2.5] }, { name: 'A', r0: 122207, r1: 136780, tau: [0.4, 1.0] }],
          gaps: [{ name: 'cassini', r0: 117507, r1: 122207, tau: [0, 0.1] }, { name: 'encke', r0: 133247.5, r1: 133572.5, tau: [0, 0] }],
          moonlet: { r: 133410, R: 150 }, unit: 60268 } },
      { id: 'herz', kind: 'world', name: name('Herzwelt', 'Heartworld'), parent: 'amarant', R: 6371e3, g: 9.81, air: 1, landable: true,
        orbit: { a: 498700e3, e: 0, i: 8, node: 31.51, peri: 0, M0: 320, ref: 'equator' },
        spin: { tilt: 0, solarDay: DAY, noon: NOON },
        chart: { pole: 'north', c0: 0.42, psi: 0.4 } },
      // Aquamarin's node near the sun's direction at the start: its shadow falls by Herzwelt's equator for the first two months,
      // then sweeps the Heartland's 65.9° N in a five-week eclipse season (a node at 90° gave a total eclipse at the first noon)
      { id: 'aqua', kind: 'ocean', name: name('Aquamarin', 'Aquamarine'), parent: 'herz', R: 2400e3, g: 2.01, air: 0.5, landable: true,
        orbit: { a: 34500e3, e: 0, i: 172, node: 30, peri: 0, M0: 45, ref: 'equator' }, spin: { locked: true },
        chart: { pole: 'sub', c0: 55 * D2R, psi: PI } },
      { id: 'zinn', kind: 'volcanic', name: name('Zinnober', 'Cinnabar'), parent: 'amarant', R: 1820e3, g: 1.80, air: 0, landable: true,
        orbit: { a: 190000e3, e: 0, i: 0, node: 0, peri: 0, M0: 30, ref: 'equator' }, spin: { locked: true },
        chart: { pole: 'sub', c0: 55 * D2R, psi: PI } },
      { id: 'opal', kind: 'ice', name: name('Opal', 'Opal'), parent: 'amarant', R: 1100e3, g: 0.49, air: 0, landable: true,
        orbit: { a: 260000e3, e: 0, i: 3, node: 143.41, peri: 0, M0: 200, ref: 'equator' }, spin: { locked: true },
        chart: { pole: 'sub', c0: 55 * D2R, psi: PI } },
      { id: 'basalt', kind: 'cratered', name: name('Basalt', 'Basalt'), parent: 'amarant', R: 1740e3, g: 1.62, air: 0, landable: true,
        orbit: { a: 700000e3, e: 0, i: 1.5, node: 200, peri: 0, M0: 100, ref: 'equator' }, spin: { axis: 'parent', T: 3600 },
        chart: { pole: 'north', c0: 35 * D2R, psi: 0 } },
      { id: 'ocker', kind: 'dust', name: name('Ocker', 'Ochre'), parent: 'amarant', R: 3390e3, g: 3.72, air: 0.006, landable: true,
        orbit: { a: 1100000e3, e: 0, i: 2.5, node: 60, peri: 0, M0: 250, ref: 'equator' }, spin: { axis: 'parent', T: 2400 },
        chart: { pole: 'north', c0: 35 * D2R, psi: 0 } },
      { id: 'bernstein', kind: 'hothouse', name: name('Bernstein', 'Amber'), parent: 'helia', R: 6050e3, g: 8.9, air: 92, landable: false,
        orbit: { a: 0.9 * AU, e: 0.006, i: 2.1, node: 40, peri: 120, M0: 75 }, spin: { tilt: 177, toward: 30, T: 243 * 86400 / 8 } },
      { id: 'coelestin', kind: 'icegiant', name: name('Cölestin', 'Celestine'), parent: 'helia', R: 25000e3, f: 0.02, g: 9.0, air: 'H₂/He/CH₄', landable: false,
        orbit: { a: 12 * AU, e: 0.04, i: 1.1, node: 110, peri: 300, M0: 200 }, spin: { tilt: 41, toward: 250, T: 16 * 3600 / 8 } },
      // the Trümmerschwarm: a young collision family, 60 bodies of 40–600 m (real size) within 30 km — u-fields builds them;
      // here the swarm's centre and its field
      { id: 'swarm', kind: 'swarm', name: name('Trümmerschwarm', 'Rubble Swarm'), parent: 'helia', Rgame: 300, mu: 0, field: 30e3, landable: true,
        orbit: { a: 3.4 * AU, e: 0.06, i: 4, node: 250, peri: 30, M0: 10 } },
    ],
  };

  // ================================================================ compile a system definition into a working system
  function compile(def) {
    const S = { id: def.id, name: def.name, star: def.star, ids: [], list: [], by: {}, children: {} };
    const Z = [0, 0, 1], X = [1, 0, 0];
    // a frame from an axis: x = the axis' ascending node on the ecliptic (Z × axis), or X when the axis is Z
    const frameOf = (axis) => {
      const q = crossInto(Z, axis, [0, 0, 0]); let ql = len(q);
      const x = ql > 1e-9 ? [q[0] / ql, q[1] / ql, q[2] / ql] : X.slice(), y = crossInto(axis, x, [0, 0, 0]);
      return { x, y, z: [axis[0], axis[1], axis[2]] };
    };
    for (const d of def.bodies) {
      const R = d.Rgame !== undefined ? d.Rgame : d.R / L;
      const mu = d.mu !== undefined ? d.mu / (L * L) : d.g * R * R;
      const b = { id: d.id, kind: d.kind, name: Object.assign({ key: 'uni.' + d.id }, d.name), parent: d.parent || null, R, Rreal: d.Rgame !== undefined ? d.Rgame : d.R,
        f: d.f || 0, Rp: R * (1 - (d.f || 0)), mu, g: R > 0 ? mu / (R * R) : 0, air: d.air || 0, landable: !!d.landable, field: d.field || 0, def: d };
      S.ids.push(b.id); S.list.push(b); S.by[b.id] = b; S.children[b.id] = [];
      if (b.parent) S.children[b.parent].push(b.id);
    }
    // spin axes of the bodies with their own (tilt toward an ecliptic azimuth)
    for (const b of S.list) {
      const sp = b.def.spin || {};
      if (sp.locked || sp.axis === 'parent') continue;
      const t = (sp.tilt || 0) * D2R, a = (sp.toward || 0) * D2R;
      b.axis = [Math.sin(t) * Math.cos(a), Math.sin(t) * Math.sin(a), Math.cos(t)];
    }
    // orbits
    for (const b of S.list) {
      const od = b.def.orbit; if (!od) continue;
      const p = S.by[b.parent], muP = p.mu, a = od.a / L, e = od.e || 0;
      const o = b.orbit = { a, e, i: (od.i || 0) * D2R, node: (od.node || 0) * D2R, peri: (od.peri || 0) * D2R, M0: (od.M0 || 0) * D2R, ref: od.ref || 'ecliptic', muP };
      o.n = Math.sqrt(muP / (a * a * a)); o.T = TAU / o.n; o.fac = Math.sqrt(1 - e * e); o.sqmua = Math.sqrt(muP * a);
      const P = v3(), Q = v3(), W = v3();
      pqwInto(o.i, o.node, o.peri, P, Q, W);
      if (o.ref === 'equator') {
        const F = frameOf(p.axis);
        const toSys = (u) => { const x = u[0], y = u[1], z = u[2]; for (let j = 0; j < 3; j++) u[j] = x * F.x[j] + y * F.y[j] + z * F.z[j]; };
        toSys(P); toSys(Q); toSys(W);
      }
      o.P = P; o.Q = Q; o.W = W;
      // the start rule: the sun stands `sunOverEquator` degrees over the body's equator at t = 0, sinking (or rising) —
      // for a circular orbit in the ecliptic (Amarant): sin β = −sin ε cos(λ − φ), λ the body's longitude
      if (od.start) {
        const ax = b.axis, eps = Math.acos(clamp1(ax[2])), phi = Math.atan2(ax[1], ax[0]);
        const c = -Math.sin(od.start.sunOverEquator * D2R) / Math.sin(eps);
        o.M0 = phi + (od.start.falling ? -1 : 1) * Math.acos(clamp1(c));
      }
    }
    // spins: locked, about the parent's axis, the noon rule, or a sidereal period
    const yearOf = (b) => { let x = b; while (x.parent && S.by[x.parent].parent) x = S.by[x.parent]; return x.orbit ? x : null; };
    for (const b of S.list) {
      const sp = b.def.spin || {};
      const s = b.spin = { locked: !!sp.locked, W0: (sp.W0 || 0) * D2R };
      if (sp.locked) { b.axis = b.orbit.W; s.T = b.orbit.T; s.w = b.orbit.n; }
      else {
        if (sp.axis === 'parent') b.axis = S.by[b.parent].axis.slice();
        if (sp.solarDay) {
          // the mean solar day exactly `solarDay`: the sidereal rate adds the year's mean motion (prograde axis)
          const y = yearOf(b), nY = y ? y.orbit.n : 0, sg = y && dot(b.axis, y.orbit.W) < 0 ? -1 : 1;
          s.w = TAU / sp.solarDay + sg * nY; s.T = TAU / s.w;
        } else if (sp.T) { s.w = TAU / sp.T; s.T = sp.T; }
        else { s.w = 0; s.T = Infinity; }
      }
      s.axis = b.axis;
      const F = frameOf(b.axis); s.q = F.x; s.p = F.y;
    }
    // the noon rule (Herzwelt): the mean sun (seen from the year's planet) on the prime meridian at t = noon
    for (const b of S.list) {
      const sp = b.def.spin || {};
      if (sp.noon === undefined) continue;
      const y = yearOf(b), r = v3(), v = v3();
      relInto(y, sp.noon, r, v);
      const s = [-r[0], -r[1], -r[2]], ax = b.spin.axis, k = dot(s, ax);
      const se = [s[0] - k * ax[0], s[1] - k * ax[1], s[2] - k * ax[2]];
      const lam = Math.atan2(dot(se, b.spin.p), dot(se, b.spin.q));
      b.spin.W0 = lam - b.spin.w * (sp.noon % b.spin.T);
    }
    // spheres of influence and Hill spheres
    for (const b of S.list) {
      if (!b.parent) { b.soi = Infinity; b.hill = Infinity; continue; }
      const p = S.by[b.parent];
      b.soi = b.mu > 0 ? soiRadius(b.orbit.a, b.mu, p.mu) : 0;
      b.hill = b.mu > 0 ? hillRadius(b.orbit.a, b.mu, p.mu, b.orbit.e) : 0;
    }
    // the ring in game metres
    for (const b of S.list) {
      const rd = b.def.ring; if (!rd) continue;
      const k = b.R / rd.unit;
      b.ring = { inner: rd.inner * b.R, outer: rd.outer * b.R, thickness: rd.thickness, normal: b.axis,
        bands: rd.bands.map(x => ({ name: x.name, r0: x.r0 * k, r1: x.r1 * k, tau: x.tau.slice() })),
        gaps: rd.gaps.map(x => ({ name: x.name, r0: x.r0 * k, r1: x.r1 * k, tau: x.tau.slice() })),
        moonlet: { r: rd.moonlet.r * k, R: rd.moonlet.R } };
    }
    // charts and days
    for (const b of S.list) {
      b.day = solarDayOf(S, b);
      if (b.def.chart) b.chartDef = b.def.chart;
    }
    S._charts = {};
    S._st = null;                                   // the kept state of one moment (cached), shared by the skies
    Object.assign(S, SYSTEM_METHODS);
    return S;
  }
  // the mean solar day: the sidereal rate less the sun's mean motion as the body sees it (one turn a year of its planet)
  function solarDayOf(S, b) {
    if (!b.parent) return b.spin.T;
    let y = b; while (y.parent && S.by[y.parent].parent) y = S.by[y.parent];
    const nY = y.orbit.n, sg = dot(b.spin.axis, y.orbit.W) < 0 ? -1 : 1, w = b.spin.w - sg * nY;
    return TAU / Math.abs(w);
  }

  // ---------------------------------------------------------------- the ephemeris of one body (relative to its parent)
  // rel: Float64Array(6) — or r, v given separately (relInto(b, t, r, v))
  function relInto(b, t, r, v) {
    const o = b.orbit;
    const M = o.M0 + o.n * (t % o.T), e = o.e;
    const E = e === 0 ? M : kepler(M, e), cE = Math.cos(E), sE = Math.sin(E);
    const x = o.a * (cE - e), y = o.a * o.fac * sE, rr = o.a * (1 - e * cE), k = o.sqmua / rr, vx = -k * sE, vy = k * o.fac * cE;
    const P = o.P, Q = o.Q;
    if (v === undefined) { // a packed Float64Array(6)
      r[0] = x * P[0] + y * Q[0]; r[1] = x * P[1] + y * Q[1]; r[2] = x * P[2] + y * Q[2];
      r[3] = vx * P[0] + vy * Q[0]; r[4] = vx * P[1] + vy * Q[1]; r[5] = vx * P[2] + vy * Q[2];
    } else {
      r[0] = x * P[0] + y * Q[0]; r[1] = x * P[1] + y * Q[1]; r[2] = x * P[2] + y * Q[2];
      if (v) { v[0] = vx * P[0] + vy * Q[0]; v[1] = vx * P[1] + vy * Q[1]; v[2] = vx * P[2] + vy * Q[2]; }
    }
    return r;
  }
  // the body-fixed → system matrix (rows are the system's x, y, z; columns the body's axes)
  function spinInto(b, t, B) {
    const s = b.spin;
    let xb0, xb1, xb2;
    if (s.locked) {
      // x toward the parent at the mean anomaly (a locked moon on an eccentric orbit librates — real)
      const o = b.orbit, M = o.M0 + o.n * (t % o.T), c = Math.cos(M), sn = Math.sin(M);
      xb0 = -(c * o.P[0] + sn * o.Q[0]); xb1 = -(c * o.P[1] + sn * o.Q[1]); xb2 = -(c * o.P[2] + sn * o.Q[2]);
    } else {
      const W = s.W0 + (s.w ? s.w * (t % s.T) : 0), c = Math.cos(W), sn = Math.sin(W);
      xb0 = c * s.q[0] + sn * s.p[0]; xb1 = c * s.q[1] + sn * s.p[1]; xb2 = c * s.q[2] + sn * s.p[2];
    }
    const z = s.axis;
    const yb0 = z[1] * xb2 - z[2] * xb1, yb1 = z[2] * xb0 - z[0] * xb2, yb2 = z[0] * xb1 - z[1] * xb0;
    B[0] = xb0; B[1] = yb0; B[2] = z[0];
    B[3] = xb1; B[4] = yb1; B[5] = z[1];
    B[6] = xb2; B[7] = yb2; B[8] = z[2];
    return B;
  }

  // ---------------------------------------------------------------- the chart: azimuthal equidistant about a pole P
  // the plane's distance from P is the arc on the sphere, its azimuth the sphere's; the local frame at a point is the
  // sphere's radial/azimuthal frame carried by the plane's own radial/azimuthal directions (orthonormal; continuous at P)
  function makeChart(S, b) {
    const cd = b.chartDef || { pole: 'north', c0: 0, psi: 0 };
    const R = b.R, p = cd.pole === 'sub' ? [1, 0, 0] : [0, 0, 1], tw = cd.pole === 'sub' ? [0, 0, 1] : [1, 0, 0];
    const w = crossInto(p, tw, [0, 0, 0]), ps = cd.psi, sp = Math.sin(ps), cp = Math.cos(ps);
    const ex = [-sp * tw[0] + cp * w[0], -sp * tw[1] + cp * w[1], -sp * tw[2] + cp * w[2]];
    const ez = [cp * tw[0] + sp * w[0], cp * tw[1] + sp * w[1], cp * tw[2] + sp * w[2]];
    const Px = cd.c0 * R * sp, Pz = -cd.c0 * R * cp;
    const datum = cd.datum !== undefined ? cd.datum : 63;
    const n0 = v3();
    const ch = {
      body: b.id, R, c0: cd.c0, psi: ps, P: [Px, Pz], pole: Float64Array.from(p), ex: Float64Array.from(ex), ez: Float64Array.from(ez), datum, edge: PI * R,
      toSphere(x, z, n) {
        n = n || v3();
        const dx = x - Px, dz = z - Pz, rho = Math.sqrt(dx * dx + dz * dz);
        if (rho < 1e-12) return set3(n, p[0], p[1], p[2]);
        const c = rho / R, ux = dx / rho, uz = dz / rho, cc = Math.cos(c), sc = Math.sin(c);
        for (let j = 0; j < 3; j++) n[j] = cc * p[j] + sc * (ux * ex[j] + uz * ez[j]);
        return n;
      },
      toPlane(n, out) {
        out = out || [0, 0];
        const cn = dot(n, p), tx = n[0] - cn * p[0], ty = n[1] - cn * p[1], tz = n[2] - cn * p[2], st = Math.sqrt(tx * tx + ty * ty + tz * tz);
        if (st < 1e-15) { out[0] = Px; out[1] = Pz + (cn < 0 ? PI * R : 0); return out; }
        const c = Math.atan2(st, cn), ux = (tx * ex[0] + ty * ex[1] + tz * ex[2]) / st, uz = (tx * ez[0] + ty * ez[1] + tz * ez[2]) / st;
        out[0] = Px + c * R * ux; out[1] = Pz + c * R * uz;
        return out;
      },
      // rows: map x (east), up, map z (south) as body-fixed unit vectors
      frame(x, z, m) {
        m = m || new Float64Array(9);
        const dx = x - Px, dz = z - Pz, rho = Math.sqrt(dx * dx + dz * dz);
        if (rho < 1e-9) { for (let j = 0; j < 3; j++) { m[j] = ex[j]; m[3 + j] = p[j]; m[6 + j] = ez[j]; } return m; }
        const c = rho / R, ux = dx / rho, uz = dz / rho, cc = Math.cos(c), sc = Math.sin(c);
        for (let j = 0; j < 3; j++) {
          const tang = ux * ex[j] + uz * ez[j], az = -uz * ex[j] + ux * ez[j];
          const n = cc * p[j] + sc * tang, tp = sc * p[j] - cc * tang;      // up; toward P
          m[j] = -ux * tp - uz * az; m[3 + j] = n; m[6 + j] = -uz * tp + ux * az;
        }
        return m;
      },
      latLon(x, z, out) { out = out || [0, 0]; const n = this.toSphere(x, z, n0); out[0] = Math.asin(clamp1(n[2])); out[1] = Math.atan2(n[1], n[0]); return out; },
      // local solar time on Herzwelt: the world clock plus the longitude east of the chart's origin (1.9 s per km on the
      // equator, U§4.5); ticks in [0, 24000)
      localTicks(x, z, ticks) {
        const lon = this.latLon(x, z, [0, 0])[1], lon0 = this.latLon(0, 0, [0, 0])[1];
        const t = ticks + wrapPi(lon - lon0) / TAU * 24000;
        return ((t % 24000) + 24000) % 24000;
      },
    };
    return ch;
  }

  // ---------------------------------------------------------------- the sky from a point: directions, sizes, phases, eclipses
  function makeEntry(id) { return { id, dir: v3(), ang: 0, dist: 0, phase: 0, alpha: 0, pole: v3(), el: 0 }; }
  // a sky: the sun {dir, ang (angular radius), dist, el, flux W/m²}, the parent and every other body {id, dir, ang, dist,
  // phase (lit fraction), alpha (phase angle), pole (its spin axis: a ring's normal, an oblate disc's minor axis), el},
  // the eclipse (the fraction of the sun's disc covered) and by whom; lat, lon of the observer on its body
  function makeSky() {
    return { t: NaN, body: null, dim: null, lat: 0, lon: 0, sun: { dir: v3(), ang: 0, dist: 0, el: 0, flux: 0 }, parent: null, bodies: [], eclipse: 0, eclipseBy: null, _byId: {} };
  }
  // the area of the sun's disc (radius rs) covered by a disc of radius rb at a separation th, as a fraction
  function overlap(rs, rb, th) {
    if (th >= rs + rb) return 0;
    if (th <= Math.abs(rb - rs)) return rb >= rs ? 1 : (rb * rb) / (rs * rs);
    const a1 = rs * rs * Math.acos(clamp1((th * th + rs * rs - rb * rb) / (2 * th * rs)));
    const a2 = rb * rb * Math.acos(clamp1((th * th + rb * rb - rs * rs) / (2 * th * rb)));
    const a3 = 0.5 * Math.sqrt(Math.max(0, (-th + rs + rb) * (th + rs - rb) * (th - rs + rb) * (th + rs + rb)));
    return (a1 + a2 - a3) / (PI * rs * rs);
  }
  const _o = v3(), _d = v3(), _e = v3(), _m = v3(), _sunD = v3();
  // an oblate body against the sun: stretch space along the body's axis by Re/Rp — the spheroid becomes a sphere of radius
  // Re, and lines stay lines, so a ray that grazes the spheroid grazes the sphere (the limb is exact at any distance).
  // d: the unit direction to the body's centre, dist its distance, s: the unit direction to the sun; returns
  // [separation, the sphere's angular radius] in the stretched space (the sun's small disc keeps its radius)
  const _sep = [0, 0];
  function stretched(b, d, dist, s) {
    const k = b.R / b.Rp - 1, a = b.spin.axis;
    // the observer relative to the centre (−d·dist) and the sun's direction, both stretched
    const ra = -dist * dot(d, a);
    set3(_m, -dist * d[0] + k * ra * a[0], -dist * d[1] + k * ra * a[1], -dist * d[2] + k * ra * a[2]);
    const sa = dot(s, a); set3(_o, s[0] + k * sa * a[0], s[1] + k * sa * a[1], s[2] + k * sa * a[2]);
    const om = len(_m), ol = len(_o);
    const c = -(_m[0] * _o[0] + _m[1] * _o[1] + _m[2] * _o[2]) / (om * ol);
    const cx = (_m[1] * _o[2] - _m[2] * _o[1]), cy = (_m[2] * _o[0] - _m[0] * _o[2]), cz = (_m[0] * _o[1] - _m[1] * _o[0]);
    _sep[0] = Math.atan2(Math.sqrt(cx * cx + cy * cy + cz * cz) / (om * ol), c);
    _sep[1] = Math.asin(Math.min(1, b.R / om));
    return _sep;
  }

  const SYSTEM_METHODS = {
    body(id) { return this.by[id]; },
    state(t, out) {
      if (!out) { out = { t: NaN, b: {} }; for (const id of this.ids) out.b[id] = { r: v3(), v: v3(), rel: new Float64Array(6), B: new Float64Array(9) }; }
      out.t = t;
      for (const b of this.list) {
        const o = out.b[b.id];
        if (!b.parent) { o.r.fill(0); o.v.fill(0); o.rel.fill(0); }
        else {
          relInto(b, t, o.rel);
          const p = out.b[b.parent], rel = o.rel;
          o.r[0] = p.r[0] + rel[0]; o.r[1] = p.r[1] + rel[1]; o.r[2] = p.r[2] + rel[2];
          o.v[0] = p.v[0] + rel[3]; o.v[1] = p.v[1] + rel[4]; o.v[2] = p.v[2] + rel[5];
        }
        spinInto(b, t, o.B);
      }
      return out;
    },
    // the state at t, kept (the skies of one moment share it)
    cached(t) { if (!this._st) this._st = this.state(t); else if (this._st.t !== t) this.state(t, this._st); return this._st; },
    rel(id, t, r, v) { return relInto(this.by[id], t, r || v3(), v === undefined ? null : v); },
    pos(id, t, r) {
      r = r || v3(); set3(r, 0, 0, 0);
      const tmp = _e;
      for (let b = this.by[id]; b.parent; b = this.by[b.parent]) { relInto(b, t, tmp, null); r[0] += tmp[0]; r[1] += tmp[1]; r[2] += tmp[2]; }
      return r;
    },
    spin(id, t, B) { return spinInto(this.by[id], t, B || new Float64Array(9)); },
    orbitNormal(id) { const b = this.by[id]; return b.orbit ? Float64Array.from(b.orbit.W) : null; },
    soi(id) { return this.by[id].soi; },
    hill(id) { return this.by[id].hill; },
    solarDay(id) { return this.by[id].day; },
    // the synodic period of `target` in `obs`'s sky (one of them orbits the other): the spin against the orbit
    synodic(obs, target) {
      const o = this.by[obs], g = this.by[target];
      let n, W;
      if (o.parent === target) { n = o.orbit.n; W = o.orbit.W; } else if (g.parent === obs) { n = g.orbit.n; W = g.orbit.W; } else return null;
      const sg = dot(W, o.spin.axis) < 0 ? -1 : 1;
      return TAU / Math.abs(o.spin.w - sg * n);
    },
    // the synchronous orbit's radius (Herzwelt's geostationary ring, U§3)
    geoRadius(id) { const b = this.by[id], T = b.spin.T; return Math.cbrt(b.mu * T * T / (4 * PI * PI)); },
    // the star's light at the body (W/m²): the star's luminosity at the real-equivalent distance
    flux(id) { const b = this.by[id]; const d = len(this.pos(id, 0, v3())) * L / AU; return SOLAR * (this.star ? this.star.L : 1) / (d * d); },
    // the ground's speed through space at a chart point (m/s): ω × the distance from the spin axis
    surfaceSpeed(id, x, z) { const b = this.by[id], n = this.chart(id).toSphere(x, z, v3()); return Math.abs(b.spin.w) * b.R * Math.hypot(n[0], n[1]); },
    // a body-fixed (turning) state → the body-centred inertial one (system axes), and back: v_inertial = B·v_fixed + ω × r
    fixedToInertial(id, rF, vF, t, r, v) {
      const b = this.by[id], B = spinInto(b, t, this._Bs || (this._Bs = new Float64Array(9))), w = b.spin.w, ax = b.spin.axis;
      mulInto(B, rF, r); const vv = vF ? mulInto(B, vF, _e) : set3(_e, 0, 0, 0);
      set3(v, vv[0] + w * (ax[1] * r[2] - ax[2] * r[1]), vv[1] + w * (ax[2] * r[0] - ax[0] * r[2]), vv[2] + w * (ax[0] * r[1] - ax[1] * r[0]));
      return r;
    },
    inertialToFixed(id, r, v, t, rF, vF) {
      const b = this.by[id], B = spinInto(b, t, this._Bs || (this._Bs = new Float64Array(9))), w = b.spin.w, ax = b.spin.axis;
      set3(_e, v[0] - w * (ax[1] * r[2] - ax[2] * r[1]), v[1] - w * (ax[2] * r[0] - ax[0] * r[2]), v[2] - w * (ax[0] * r[1] - ax[1] * r[0]));
      mulTInto(B, r, rF); mulTInto(B, _e, vF);
      return rF;
    },
    // a point and a velocity on a world's map (x, block height y, z; the local frame's x east, y up, z south) ↔ the inertial
    // state round the body's centre (system axes): the climb's hand-off to space and the descent back onto the map
    chartToInertial(id, pos, vel, t, r, v) {
      const b = this.by[id], ch = this.chart(id), n = ch.toSphere(pos[0], pos[2], this._cn || (this._cn = v3())), rad = b.R + (pos[1] - ch.datum);
      const rF = set3(this._crF || (this._crF = v3()), n[0] * rad, n[1] * rad, n[2] * rad);
      const F = ch.frame(pos[0], pos[2], this._cF || (this._cF = new Float64Array(9))), vF = mulTInto(F, vel || [0, 0, 0], this._cvF || (this._cvF = v3()));
      return this.fixedToInertial(id, rF, vF, t, r, v);
    },
    inertialToChart(id, r, v, t, pos, vel) {
      const b = this.by[id], ch = this.chart(id), rF = this._crF || (this._crF = v3()), vF = this._cvF || (this._cvF = v3());
      this.inertialToFixed(id, r, v, t, rF, vF);
      const d = len(rF), n = set3(this._cn || (this._cn = v3()), rF[0] / d, rF[1] / d, rF[2] / d), xz = ch.toPlane(n, this._cxz || (this._cxz = [0, 0]));
      const F = ch.frame(xz[0], xz[1], this._cF || (this._cF = new Float64Array(9)));
      pos[0] = xz[0]; pos[1] = ch.datum + d - b.R; pos[2] = xz[1];
      if (vel) mulInto(F, vF, vel);
      return pos;
    },
    // where `from`'s centre is (and how it moves) relative to `to`'s, summed along the tree (no 10⁹-m cancellation)
    offset(from, to, t, r, v) {
      r = r || v3(); v = v || v3(); set3(r, 0, 0, 0); set3(v, 0, 0, 0);
      const up = (id) => { const a = []; for (let b = this.by[id]; b; b = b.parent ? this.by[b.parent] : null) a.push(b.id); return a; };
      const pf = up(from), pt = up(to), inT = new Set(pt);
      const lca = pf.find(id => inT.has(id));
      const tr = _e, tv = _o;
      for (const id of pf) { if (id === lca) break; relInto(this.by[id], t, tr, tv); r[0] += tr[0]; r[1] += tr[1]; r[2] += tr[2]; v[0] += tv[0]; v[1] += tv[1]; v[2] += tv[2]; }
      for (const id of pt) { if (id === lca) break; relInto(this.by[id], t, tr, tv); r[0] -= tr[0]; r[1] -= tr[1]; r[2] -= tr[2]; v[0] -= tv[0]; v[1] -= tv[1]; v[2] -= tv[2]; }
      return r;
    },
    // a state relative to `from` → relative to `to` (the SOI hand-over)
    toFrame(from, to, r, v, t, ro, vo) {
      const orr = v3(), ov = v3(); this.offset(from, to, t, orr, ov);
      set3(ro, r[0] + orr[0], r[1] + orr[1], r[2] + orr[2]); set3(vo, v[0] + ov[0], v[1] + ov[1], v[2] + ov[2]);
      return ro;
    },
    // the deepest body whose sphere of influence holds a point of the system frame
    dominant(rSys, t) {
      const st = this.cached(t);
      let cur = this.list[0].id;
      for (let go = true; go;) {
        go = false;
        for (const c of this.children[cur]) {
          const b = this.by[c]; if (!(b.soi > 0)) continue;
          const p = st.b[c].r, dx = rSys[0] - p[0], dy = rSys[1] - p[1], dz = rSys[2] - p[2];
          if (dx * dx + dy * dy + dz * dz < b.soi * b.soi) { cur = c; go = true; break; }
        }
      }
      return cur;
    },
    // when a coasting ship (r, v relative to `frame`, at t) leaves the frame's sphere: {t, r, v} or null
    soiExit(frame, r, v, t) {
      const b = this.by[frame], mu = b.mu, rs = b.soi;
      if (!(rs < Infinity)) return null;
      if (len(r) >= rs) return { t, r: Float64Array.from(r), v: Float64Array.from(v) };
      const el = stateToEl(r, v, mu);
      if (el.e < 1 && el.ra <= rs) return null;
      const e = el.e, cx = clamp1((el.p / rs - 1) / e), nux = Math.acos(cx);
      let dt;
      if (Math.abs(e - 1) < 1e-7) {          // Barker's equation for a near-parabola
        const bk = (nu) => { const D = Math.tan(nu / 2); return D + D * D * D / 3; };
        dt = 0.5 * Math.sqrt(el.p * el.p * el.p / mu) * (bk(nux) - bk(el.nu));
      } else if (e < 1) {
        const Ex = Math.atan2(Math.sqrt(1 - e * e) * Math.sin(nux), e + cx), Mx = Ex - e * Math.sin(Ex);
        let M0 = el.M; if (M0 > PI) M0 -= TAU;
        dt = (Mx - M0) / el.n;
      } else {
        const Hx = Math.asinh(Math.sqrt(e * e - 1) * Math.sin(nux) / (1 + e * cx)), Mx = e * Math.sinh(Hx) - Hx;
        dt = (Mx - el.M) / el.n;
      }
      // polish on the ship's own conic: Newton on |r(τ)| = r_SOI
      const rr = v3(), vv = v3();
      for (let k = 0; k < 6; k++) {
        coast(r, v, mu, dt, rr, vv);
        const d = len(rr), rd = dot(rr, vv) / d, err = d - rs;
        if (Math.abs(err) <= 1e-13 * rs || !(rd > 0)) break;
        dt -= err / rd;
      }
      coast(r, v, mu, dt, rr, vv);
      return { t: t + dt, r: rr, v: vv };
    },
    // the first entry of a coasting ship into a child's sphere between t and tEnd: {t, frame, r, v (relative to the child)}
    soiEnter(frame, r, v, t, tEnd) {
      const mu = this.by[frame].mu, kids = this.children[frame].filter(c => this.by[c].soi > 0);
      if (!kids.length || !(tEnd > t)) return null;
      // the ship sampled once (N + 1 points), each child's distance at the same moments; a crossing between two samples or
      // a dip below the sphere between them (golden section on the dip) brackets the entry, which bisection then finds
      const N = 256, h = (tEnd - t) / N, ship = this._ship || (this._ship = new Float64Array((N + 1) * 3)), dd = this._dd || (this._dd = new Float64Array(N + 1));
      const rs = v3(), rc = v3();
      for (let j = 0; j <= N; j++) { coast(r, v, mu, j * h, rs, null); ship[j * 3] = rs[0]; ship[j * 3 + 1] = rs[1]; ship[j * 3 + 2] = rs[2]; }
      const dist = (c, tau) => { coast(r, v, mu, tau - t, rs, null); relInto(this.by[c], tau, rc, null); return Math.sqrt((rs[0] - rc[0]) ** 2 + (rs[1] - rc[1]) ** 2 + (rs[2] - rc[2]) ** 2) - this.by[c].soi; };
      let best = null;
      for (const c of kids) {
        const cb = this.by[c];
        for (let j = 0; j <= N; j++) { relInto(cb, t + j * h, rc, null); dd[j] = Math.sqrt((ship[j * 3] - rc[0]) ** 2 + (ship[j * 3 + 1] - rc[1]) ** 2 + (ship[j * 3 + 2] - rc[2]) ** 2) - cb.soi; }
        if (dd[0] <= 0) { best = { t, c }; break; }
        let hit = null;
        for (let j = 1; j <= N && !hit; j++) {
          if (best && t + (j - 1) * h > best.t) break;
          if (dd[j] <= 0) { hit = [t + (j - 1) * h, t + j * h]; break; }
          if (j < N && dd[j] < dd[j - 1] && dd[j] < dd[j + 1]) {
            let a = t + (j - 1) * h, bb = t + (j + 1) * h; const gr = 0.6180339887498949;
            let x1 = bb - gr * (bb - a), x2 = a + gr * (bb - a), f1 = dist(c, x1), f2 = dist(c, x2);
            for (let k = 0; k < 80 && bb - a > 1e-7 * h; k++) {
              if (f1 < f2) { bb = x2; x2 = x1; f2 = f1; x1 = bb - gr * (bb - a); f1 = dist(c, x1); }
              else { a = x1; x1 = x2; f1 = f2; x2 = a + gr * (bb - a); f2 = dist(c, x2); }
              if (Math.min(f1, f2) <= 0) break;
            }
            if (Math.min(f1, f2) <= 0) hit = [t + (j - 1) * h, f1 <= 0 ? x1 : x2];
          }
        }
        if (!hit) continue;
        let [a, bb] = hit;          // a outside, bb inside: bisect the crossing
        for (let k = 0; k < 200; k++) { const m = 0.5 * (a + bb), dm = dist(c, m); if (dm > 0) a = m; else bb = m; if (Math.abs(dm) <= 1e-13 * cb.soi || bb - a <= 1e-13 * Math.max(1, Math.abs(bb))) break; }
        const tc = Math.abs(dist(c, a)) < Math.abs(dist(c, bb)) ? a : bb;
        if (!best || tc < best.t) best = { t: tc, c };
      }
      if (!best) return null;
      const ro = v3(), vo = v3(), rcc = v3(), vcc = v3();
      coast(r, v, mu, best.t - t, ro, vo);
      relInto(this.by[best.c], best.t, rcc, vcc);
      set3(ro, ro[0] - rcc[0], ro[1] - rcc[1], ro[2] - rcc[2]); set3(vo, vo[0] - vcc[0], vo[1] - vcc[1], vo[2] - vcc[2]);
      return { t: best.t, frame: best.c, r: ro, v: vo };
    },
    // the ghost path (U§4.2): the ship's conic in its frame (n points, from where it is) and, when it crosses a sphere of
    // influence, one patched conic in the next frame (with its anchor: the next frame's centre relative to this one's at
    // the crossing). Points relative to the frame's centre, Float64Array(n·3).
    ghost(frame, r, v, t, out, n) {
      n = n || 128;
      out = out || { frame, pts: new Float64Array(n * 3), closed: false, event: null, patch: null };
      if (out.pts.length !== n * 3) out.pts = new Float64Array(n * 3);
      out.frame = frame; out.event = null; out.patch = null;
      const b = this.by[frame], mu = b.mu, el = stateToEl(r, v, mu);
      const exit = this.soiExit(frame, r, v, t);
      const horizon = el.e < 1 ? el.period : (exit ? exit.t - t : 0);
      let tEnd = exit ? exit.t : t + horizon;
      if (!(tEnd > t)) tEnd = t + 3600;
      const enter = this.soiEnter(frame, r, v, t, tEnd);
      let ev = null;
      if (enter && (!exit || enter.t < exit.t)) ev = { kind: 'enter', t: enter.t, frame: enter.frame, r: enter.r, v: enter.v };
      else if (exit) { const ro = v3(), vo = v3(); this.toFrame(frame, b.parent, exit.r, exit.v, exit.t, ro, vo); ev = { kind: 'exit', t: exit.t, frame: b.parent, r: ro, v: vo, rIn: exit.r }; }
      out.closed = !ev && el.e < 1;
      conicPoints(r, v, mu, ev ? ev.t - t : null, out.pts, n);
      if (ev) {
        out.event = ev;
        const nb = this.by[ev.frame], pe = stateToEl(ev.r, ev.v, nb.mu);
        const nx = this.soiExit(ev.frame, ev.r, ev.v, ev.t);
        const span = nx ? nx.t - ev.t : (pe.e < 1 ? null : 10 * len(ev.r) / Math.max(1, len(ev.v)));
        const pts = new Float64Array(n * 3);
        conicPoints(ev.r, ev.v, nb.mu, span, pts, n);
        const anchor = v3(), av = v3(); this.offset(ev.frame, frame, ev.t, anchor, av);
        out.patch = { frame: ev.frame, pts, closed: !nx && pe.e < 1, anchor };
      }
      return out;
    },
    // ---------------------------------------------------------- skies
    // the eclipse of the star seen from a system point: the fraction of its disc covered (the largest), and by whom
    // (skip: the observer's own body; only: count this occulter alone)
    eclipseFrom(rSys, t, skip, res, only) {
      const st = this.cached(t), star = this.list[0];
      res = res || { frac: 0, by: null };
      res.frac = 0; res.by = null;
      set3(_sunD, -rSys[0], -rSys[1], -rSys[2]);
      const ds = len(_sunD); _sunD[0] /= ds; _sunD[1] /= ds; _sunD[2] /= ds;
      const rsA = Math.asin(Math.min(1, star.R / ds));
      for (const b of this.list) {
        if (b === star || b.id === skip || !(b.R > 0) || (only && b.id !== only)) continue;
        const p = st.b[b.id].r;
        set3(_d, p[0] - rSys[0], p[1] - rSys[1], p[2] - rSys[2]);
        const db = len(_d); if (db >= ds) continue;
        _d[0] /= db; _d[1] /= db; _d[2] /= db;
        const c = dot(_d, _sunD); if (c <= 0) continue;
        // a cheap rejection before the trigonometry: 1 − cos x ≤ x²/2, so this body cannot touch the sun's disc
        const x = b.R / db, reach = rsA + (x > 0.8 ? Math.asin(Math.min(1, x)) : 1.2 * x);   // asin x ≤ 1.2 x below 0.8
        if (1 - c > 0.5 * reach * reach) continue;
        crossInto(_d, _sunD, _o); const sn = len(_o), th = Math.atan2(sn, c);
        const rb0 = Math.asin(Math.min(1, b.R / db));
        if (th >= rsA + rb0) continue;               // outside the equatorial sphere: no part of the body is there
        let f;
        if (b.f) { const sp = stretched(b, _d, db, _sunD); f = overlap(rsA, sp[1], sp[0]); }
        else f = overlap(rsA, rb0, th);
        if (f > res.frac) { res.frac = f; res.by = b.id; }
      }
      return res;
    },
    // the eclipse seen from a body's centre (the fraction of the star's disc; `only`: by that body alone)
    eclipseAt(id, t, only) { const st = this.cached(t); return this.eclipseFrom(st.b[id].r, t, id, this._er || (this._er = { frac: 0, by: null }), only).frac; },
    // the sky from a point of the system frame (rSys): the sun and every body but `skip` (the observer's own world), with
    // directions in the system frame — or M·d when M (row-major, system → output) is given; the space scene's camera
    skyFrom(rSys, t, out, M, skip) {
      const st = this.cached(t), star = this.list[0];
      out = out || makeSky();
      const key = skip || '';
      if (out._key !== key) {
        // one list of entries per observer body, kept in `out` (switching worlds allocates only the first time)
        const pool = out._pool || (out._pool = {});
        let pl = pool[key];
        if (!pl) {
          pl = pool[key] = { bodies: [], byId: {}, parent: null };
          for (const o of this.list) if (o !== star && o.id !== skip) { const e = makeEntry(o.id); pl.bodies.push(e); pl.byId[o.id] = e; }
          const sb = skip ? this.by[skip] : null;
          pl.parent = sb && sb.parent && sb.parent !== star.id ? pl.byId[sb.parent] : null;
        }
        out.bodies = pl.bodies; out._byId = pl.byId; out.parent = pl.parent; out._key = key;
      }
      out.body = skip || null; out.t = t;
      const ox = rSys[0], oy = rSys[1], oz = rSys[2];
      // the star
      set3(_d, -ox, -oy, -oz); const ds = len(_d); _d[0] /= ds; _d[1] /= ds; _d[2] /= ds;
      if (M) mulInto(M, _d, out.sun.dir); else copy3(_d, out.sun.dir);
      out.sun.dist = ds; out.sun.ang = Math.asin(Math.min(1, star.R / ds));
      const dAU = ds * L / AU; out.sun.flux = SOLAR * (this.star ? this.star.L : 1) / (dAU * dAU);
      // every other body
      const bl = out.bodies;
      for (let k = 0; k < bl.length; k++) {
        const e = bl[k], o = this.by[e.id], p = st.b[e.id].r;
        set3(_d, p[0] - ox, p[1] - oy, p[2] - oz); const db = len(_d); _d[0] /= db; _d[1] /= db; _d[2] /= db;
        if (M) { mulInto(M, _d, e.dir); mulInto(M, o.spin.axis, e.pole); } else { copy3(_d, e.dir); copy3(o.spin.axis, e.pole); }
        e.dist = db; e.ang = o.R > 0 ? Math.asin(Math.min(1, o.R / db)) : 0;
        // the phase: the angle at the body between the star (at the origin) and the observer
        const pr = len(p), ca = pr > 0 ? (p[0] * _d[0] + p[1] * _d[1] + p[2] * _d[2]) / pr : 1;
        e.alpha = Math.acos(clamp1(ca)); e.phase = 0.5 * (1 + ca);
      }
      const ec = this.eclipseFrom(rSys, t, skip, this._er2 || (this._er2 = { frac: 0, by: null }));
      out.eclipse = ec.frac; out.eclipseBy = ec.by;
      return out;
    },
    // the sky from a point fixed on body `id` (rFixed in its body frame); directions in the body frame unless `M` (a
    // row-major system → output matrix) is given
    skyAt(id, rFixed, t, out, M) {
      const me = this.cached(t).b[id], B = me.B;
      const obs = mulInto(B, rFixed, this._obs || (this._obs = v3())); obs[0] += me.r[0]; obs[1] += me.r[1]; obs[2] += me.r[2];
      if (!M) { M = this._BT || (this._BT = new Float64Array(9)); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) M[i * 3 + j] = B[j * 3 + i]; }
      return this.skyFrom(obs, t, out, M, id);
    },
    chart(id) { return this._charts[id] || (this._charts[id] = makeChart(this, this.by[id])); },
    // the sky over a chart point of a world (dim id or body id; chartPos [x, z] or [x, y, z] with y the block height, the
    // datum — sea level, 63 — the sphere's surface): directions in the local frame (x map east, y up, z map south)
    localSky(dim, chartPos, t, out) {
      const id = DIM_BODY[dim] || (this.by[dim] ? dim : null);
      if (!id || !this.by[id].parent) return null;
      const b = this.by[id], ch = this.chart(id);
      const x = chartPos[0], z = chartPos.length > 2 ? chartPos[2] : chartPos[1], y = chartPos.length > 2 ? chartPos[1] : ch.datum;
      const n = ch.toSphere(x, z, this._n || (this._n = v3())), rad = b.R + (y - ch.datum);
      const rF = this._rF || (this._rF = v3()); set3(rF, n[0] * rad, n[1] * rad, n[2] * rad);
      const F = ch.frame(x, z, this._F || (this._F = new Float64Array(9)));
      // system → local = F · Bᵀ
      const st = this.cached(t), B = st.b[id].B, M = this._M || (this._M = new Float64Array(9));
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) M[i * 3 + j] = F[i * 3] * B[j * 3] + F[i * 3 + 1] * B[j * 3 + 1] + F[i * 3 + 2] * B[j * 3 + 2];
      out = this.skyAt(id, rF, t, out, M);
      out.dim = dim; out.lat = Math.asin(clamp1(n[2])); out.lon = Math.atan2(n[1], n[0]);
      out.sun.el = Math.asin(clamp1(out.sun.dir[1]));
      for (const e of out.bodies) e.el = Math.asin(clamp1(e.dir[1]));
      return out;
    },
    // the home-system table (the test prints it; the codex may show it)
    table() {
      const fx = (x, d) => Number(x).toFixed(d), km = (m) => (m / 1e3 >= 1000 ? Math.round(m / 1e3).toLocaleString('en-US') : fx(m / 1e3, m / 1e3 >= 100 ? 1 : 2));
      const dur = (s) => (s >= 2 * 86400 ? fx(s / 86400, 1) + ' d' : s >= 2 * 3600 ? fx(s / 3600, 2) + ' h' : fx(s / 60, 1) + ' min');
      return this.list.map(b => {
        const p = b.parent ? this.by[b.parent] : null, top = p && !p.parent;
        const sky = b.parent ? (top ? `${this.list[0].name.de} ${fx(2 * Math.asin(this.list[0].R / b.orbit.a) / D2R, 2)}°` : `${p.name.de} ${fx(2 * Math.asin(p.R / (b.orbit.a - b.R)) / D2R, 1)}°`) : '—';
        return {
          id: b.id, name: b.name.de, kind: b.kind, Rreal: b.def.Rgame !== undefined ? '(real) ' + fx(b.R, 0) + ' m' : km(b.Rreal), R: b.def.Rgame !== undefined ? fx(b.R / 1e3, 1) : km(b.R),
          a: b.orbit ? (top ? fx(b.orbit.a * L / AU, 2) + ' AU' : km(b.orbit.a)) : '—', period: b.orbit ? dur(b.orbit.T) : '—',
          g: b.mu > 0 ? fx(b.g, 2) : '—', vLow: b.mu > 0 ? fx(vCirc(b.mu, b.R), 0) : '—', tLow: b.mu > 0 ? fx(period(b.mu, b.R) / 60, 1) : '—',
          vEsc: b.mu > 0 ? fx(vEsc(b.mu, b.R), 0) : '—', soi: b.soi === Infinity ? '∞' : b.soi > 0 ? km(b.soi) : '—',
          day: b.spin.T === Infinity ? '—' : (b.spin.locked ? 'locked ' : '') + dur(b.day), sky,
        };
      });
    },
  };

  // the conic's points from a state: the whole ellipse (span null) or the arc over `span` seconds, evenly in the anomaly
  function conicPoints(r, v, mu, span, pts, n) {
    const el = stateToEl(r, v, mu), e = el.e;
    const h = el.h, hl = len(h), hu = [h[0] / hl, h[1] / hl, h[2] / hl];
    let Pv;
    if (e > 1e-10) Pv = [el.evec[0] / e, el.evec[1] / e, el.evec[2] / e]; else { const rl = len(r); Pv = [r[0] / rl, r[1] / rl, r[2] / rl]; }
    const Qv = crossInto(hu, Pv, [0, 0, 0]);
    const nu0 = e > 1e-10 ? el.nu : 0;
    const put = (k, x, y) => { pts[k * 3] = x * Pv[0] + y * Qv[0]; pts[k * 3 + 1] = x * Pv[1] + y * Qv[1]; pts[k * 3 + 2] = x * Pv[2] + y * Qv[2]; };
    if (e < 1) {
      const a = el.a, bAx = a * Math.sqrt(1 - e * e);
      const E0 = Math.atan2(Math.sqrt(1 - e * e) * Math.sin(nu0), e + Math.cos(nu0));
      let E1;
      if (span === null || span === undefined) E1 = E0 + TAU * (n - 1) / n;
      else {
        // the end of the arc: where the ship is after `span` (whole periods added back)
        const rr = v3(); coast(r, v, mu, span, rr, null);
        const nu1 = Math.atan2(dot(crossInto(Pv, rr, [0, 0, 0]), hu), dot(Pv, rr));
        let e1 = Math.atan2(Math.sqrt(1 - e * e) * Math.sin(nu1), e + Math.cos(nu1));
        while (e1 < E0) e1 += TAU;
        E1 = e1 + TAU * Math.floor(span / el.period);
      }
      for (let k = 0; k < n; k++) { const E = E0 + (E1 - E0) * k / (n - 1); put(k, a * (Math.cos(E) - e), bAx * Math.sin(E)); }
    } else {
      const a = el.a, bAx = -a * Math.sqrt(e * e - 1);       // a < 0
      const Hof = (nu) => Math.asinh(Math.sqrt(e * e - 1) * Math.sin(nu) / (1 + e * Math.cos(nu)));
      const H0 = Hof(nu0);
      let H1;
      if (span === null || span === undefined) H1 = H0 + 3;
      else { const rr = v3(); coast(r, v, mu, span, rr, null); const nu1 = Math.atan2(dot(crossInto(Pv, rr, [0, 0, 0]), hu), dot(Pv, rr)); H1 = Hof(nu1); }
      for (let k = 0; k < n; k++) { const H = H0 + (H1 - H0) * k / (n - 1); put(k, a * (Math.cosh(H) - e), bAx * Math.sinh(H)); }
    }
    return pts;
  }

  // ================================================================ the module
  const home = compile(HELIA);
  const U = VR.Universe = {
    AU, MU_SUN, R_SUN, MU_JUP, MU_EARTH, SOLAR, SCALE, DAY, NOON, BANDS, DIM_BODY, HELIA,
    kepler, keplerH, elToState, stateToEl, coast, verletInit, verlet, stumpC, stumpS,
    vCirc, vEsc, period, hohmann, soiRadius, hillRadius, dvFromOrbit,
    triad, matToQuat, quatToMat, slerpRot, slerpDir, smootherstep, climbK, worldSeconds,
    compile, home,
    state: (t, out) => home.state(t, out),
    localSky: (dim, pos, t, out) => home.localSky(dim, pos, t, out),
    chart: (id) => home.chart(id),
    dominant: (rSys, t) => home.dominant(rSys, t),
  };
})((typeof globalThis !== 'undefined' ? globalThis : self).VR || ((typeof globalThis !== 'undefined' ? globalThis : self).VR = {}));
