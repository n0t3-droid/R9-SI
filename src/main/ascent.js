// ============================================================================
// u-ascent · VR.Ascent — the climb band and the one flight model's two new regimes (docs/superpowers/plans/
// 2026-10-22-u-ascent.md; U = docs/superpowers/specs/2026-10-22-universe-design.md §4.2, §5.1–§5.3; the facts
// docs/universe/REFERENCE.md §1.9). flight.js stays the one model: below 252 m it flies as it always did ('air'); a
// starship climbing past 252 m enters 'climb', and at 2,500 m 'space' (spaceflight.js draws that frame). Both new regimes
// share one state: inertial, Herzwelt-centred, in VR.Universe's system axes (doubles), entered from the map with
// chartToInertial — the ground's 213 m/s at the Heartland comes along, nothing jumps — and integrated with the body's own
// gravity μ/r² (velocity Verlet at 1/120 s, U.verlet), the main engine along the nose (0–3 g, the boost 5 g, the reverse
// to −1 g), drag ½ρv²/β from the climb's air and the hover jets; coasting (no thrust, no air, no jets) is U.coast —
// analytic, nothing drifts. Each frame the state goes back onto the map with inertialToChart: the ship's place over the
// voxel world, its velocity there (Coriolis and the 20-minute day's centrifugal pull come out by themselves).
//   · the hover jets: they carry what the orbit does not carry yet — the acceleration that keeps the ship's way straight
//     and level on the map (gravity, the turning ground's pulls, the sphere's curve), at most 1.5 g; they fall to nothing
//     as the speed nears the orbit's and go off once the orbit's low point is above the air. So a pilot can stop anywhere
//     in the climb and look, and the honest orbit still comes from speed alone. The autopilot's Zum Orbit flies without them
//     (the gravity turn of U§5.2), its entry with them upright only (the sink).
//   · the climb's picture (VR.Ascent.env, called by env.js): the sky thins with a 400-m scale height above 300 m, the
//     postcard bodies glide to VR.Universe.localSky's places (U§2.2), the world bends (u_curve in the terrain and tile
//     programs), space's own background comes in behind the air and Herzwelt's impostor continues the land beyond the tiles
//   · pure part (node: test/ascent.js) above the line; the game's glue (renderer, horizon, env, saves) below it
// ============================================================================
(function (VR) {
  'use strict';
  const A = VR.Ascent = {};
  const UNI = () => VR.Universe;
  const PI = Math.PI, TAU = 2 * PI, D2R = PI / 180;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const k1 = (rate, dt) => 1 - Math.exp(-rate * dt);
  const wrapA = (a) => { a = (a + PI) % TAU; if (a < 0) a += TAU; return a - PI; };
  const T = (k, v, fb) => (VR.I18N ? VR.I18N.t(k, v, fb) : (fb !== undefined ? fb : k));
  // ---------------------------------------------------------------- small vector helpers (doubles; out arrays, no allocation)
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const len = (a) => Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
  const set3 = (o, x, y, z) => { o[0] = x; o[1] = y; o[2] = z; return o; };
  const cross = (a, b, o) => set3(o, a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]);
  const unit = (a, o) => { const l = len(a) || 1; return set3(o, a[0] / l, a[1] / l, a[2] / l); };
  const v3 = () => new Float64Array(3), m9 = () => new Float64Array(9);
  // row-major 3×3: m·v, mᵀ·v, a·b, the rotation by `ang` about the unit axis k (Rodrigues)
  const mulv = (m, a, o) => set3(o, m[0] * a[0] + m[1] * a[1] + m[2] * a[2], m[3] * a[0] + m[4] * a[1] + m[5] * a[2], m[6] * a[0] + m[7] * a[1] + m[8] * a[2]);
  const mulTv = (m, a, o) => set3(o, m[0] * a[0] + m[3] * a[1] + m[6] * a[2], m[1] * a[0] + m[4] * a[1] + m[7] * a[2], m[2] * a[0] + m[5] * a[1] + m[8] * a[2]);
  function mulm(a, b, o) {
    const r = A._mm || (A._mm = m9());
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
    o.set(r); return o;
  }
  function mulTm(a, b, o) {   // aᵀ·b
    const r = A._mm || (A._mm = m9());
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r[i * 3 + j] = a[i] * b[j] + a[3 + i] * b[3 + j] + a[6 + i] * b[6 + j];
    o.set(r); return o;
  }
  function rotM(k, ang, o) {
    const c = Math.cos(ang), s = Math.sin(ang), t = 1 - c, x = k[0], y = k[1], z = k[2];
    o[0] = t * x * x + c; o[1] = t * x * y - s * z; o[2] = t * x * z + s * y;
    o[3] = t * x * y + s * z; o[4] = t * y * y + c; o[5] = t * y * z - s * x;
    o[6] = t * x * z - s * y; o[7] = t * y * z + s * x; o[8] = t * z * z + c;
    return o;
  }
  // re-orthonormalise a rotation's columns (x, y; z = x × y) — the attitude after many small turns
  function ortho(m) {
    let x0 = m[0], x1 = m[3], x2 = m[6], l = Math.hypot(x0, x1, x2) || 1; x0 /= l; x1 /= l; x2 /= l;
    let y0 = m[1], y1 = m[4], y2 = m[7]; const d = x0 * y0 + x1 * y1 + x2 * y2; y0 -= d * x0; y1 -= d * x1; y2 -= d * x2;
    l = Math.hypot(y0, y1, y2) || 1; y0 /= l; y1 /= l; y2 /= l;
    m[0] = x0; m[3] = x1; m[6] = x2; m[1] = y0; m[4] = y1; m[7] = y2;
    m[2] = x1 * y2 - x2 * y1; m[5] = x2 * y0 - x0 * y2; m[8] = x0 * y1 - x1 * y0;
    return m;
  }
  A.math = { dot, len, cross, unit, mulv, mulTv, mulm, mulTm, rotM, ortho, v3, m9 };

  // ---------------------------------------------------------------- the bands and the air (U§5.1; plan §2)
  // heights are the map's (block height y; the sea, the chart's datum, at 63)
  A.BAND = Object.freeze({ air: 252, high: 300, edge: 2500, back: 2450, down: 248, sink: 600, top: 3000 });
  A.DATUM = 63;
  // the climb's air: Earth's density to 300 m, then the sky's own 400-m scale height, gone between 2,500 and 3,000 m —
  // one curve for the sky's thinning, the drag and the plasma, so an orbit at 3 km (11 minutes) is drag-free
  A.AIR = Object.freeze({ rho0: 1.225, base: 300, H: 400, t0: 2500, t1: 3000 });
  A.rho = (y) => { const a = A.AIR; if (y <= a.base) return a.rho0; if (y >= a.t1) return 0; return a.rho0 * Math.exp(-(y - a.base) / a.H) * (1 - ss(a.t0, a.t1, y)); };
  // what is left of the sky's air above the eye (1 at and below 300 m): the sky's colours fade with it
  A.airK = (y) => (y <= A.AIR.base ? 1 : Math.exp(-(y - A.AIR.base) / A.AIR.H));
  // the ship: the main engine 3 g along the nose (the boost 5 g, the reverse to −1 g), the hover jets ≤ 1.5 g, the
  // ballistic coefficient m/(C_d·A) 500 kg/m² (the entry's plasma then clears near 1,500 m: test/ascent.js f)
  A.SHIP = Object.freeze({ g: 9.81, thrust: 3, boost: 5, rev: 1.5, jets: 1.5, jetsMax: 2, hold: 0.5, beta: 500, pitchRate: 0.95, yawRate: 0.7, slew: 0.75, roll: 0.55 });
  A.herz = () => UNI().home.body('herz');
  A.R = () => A.herz().R;
  // the curve of the world in the terrain and tile programs: y −= u_curve·|xz|², u_curve = climbK(y) / 2R (0 below 300 m)
  A.curve = (y) => (y <= A.BAND.high ? 0 : UNI().climbK(y) * 0.5 / A.R());

  // ---------------------------------------------------------------- the state: inertial, round a body, system axes
  A.newState = () => ({ frame: 'herz', r: v3(), v: v3(), a: v3(), t: 0, jets: v3(), thr: v3(), drag: v3(), q: 0, rho: 0, coast: false });
  // map → inertial (Herzwelt): the place (x, block height y, z) and the map velocity at world time t
  A.fromMap = (st, pos, vel, t) => {
    const U = UNI(), S = U.home;
    S.chartToInertial('herz', pos, vel, t, st.r, st.v);
    st.frame = 'herz'; st.t = t;
    U.verletInit(st, A.herz().mu);
    return st;
  };
  // inertial → map (only while round Herzwelt): pos [x, y, z] and the map velocity (both filled)
  A.toMap = (st, pos, vel) => UNI().home.inertialToChart('herz', st.r, st.v, st.t, pos, vel);
  // the height on the map (block y) of a state round Herzwelt
  A.mapY = (st) => A.DATUM + len(st.r) - A.R();
  const _F = m9(), _B = m9(), _xz = [0, 0], _n = v3();
  // the local frame at a chart point at world time t as a row-major matrix local → system (its columns: map east, up and
  // map south as system vectors): M = B·Fᵀ
  A.localM = (x, z, t, out) => {
    const S = UNI().home, ch = S.chart('herz');
    ch.frame(x, z, _F); S.spin('herz', t, _B);
    out = out || m9();
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) out[i * 3 + j] = _B[i * 3] * _F[j * 3] + _B[i * 3 + 1] * _F[j * 3 + 1] + _B[i * 3 + 2] * _F[j * 3 + 2];
    return out;
  };
  // the local frame under a state (round Herzwelt): its chart point from the state's own position
  A.localAt = (st, out) => {
    const S = UNI().home;
    S.spin('herz', st.t, _B);
    mulTv(_B, st.r, _n);
    const d = len(_n); _n[0] /= d; _n[1] /= d; _n[2] /= d;
    S.chart('herz').toPlane(_n, _xz);
    return A.localM(_xz[0], _xz[1], st.t, out);
  };
  // the frame the ship's model and cameras are drawn in, under a state: round Herzwelt the map's (east, up, south at the
  // ground point under the ship); elsewhere (another body, the jump's system frame) the same axes made from the way up
  // from the body's centre and its spin axis (columns east, up, south; row-major, local → system)
  A.localFrame = (st, out) => {
    out = out || m9();
    if (st.frame === 'herz') return A.localAt(st, out);
    const b = UNI().home.body(st.frame), ax = b && b.spin && b.spin.axis ? b.spin.axis : [0, 0, 1];
    unit(st.r, _n);
    let ex = ax[1] * _n[2] - ax[2] * _n[1], ey = ax[2] * _n[0] - ax[0] * _n[2], ez = ax[0] * _n[1] - ax[1] * _n[0], l = Math.hypot(ex, ey, ez);
    if (l < 1e-9) { ex = 1; ey = 0; ez = 0; l = 1; }
    ex /= l; ey /= l; ez /= l;
    const sx = ey * _n[2] - ez * _n[1], sy = ez * _n[0] - ex * _n[2], sz = ex * _n[1] - ey * _n[0];   // south = east × up
    out[0] = ex; out[3] = ey; out[6] = ez; out[1] = _n[0]; out[4] = _n[1]; out[7] = _n[2]; out[2] = sx; out[5] = sy; out[8] = sz;
    return out;
  };
  // true east on the map at (x, z): [east, south] components of the turning ground's way (the body-fixed pole is z)
  A.mapEast = (x, z, out) => {
    const F = UNI().home.chart('herz').frame(x, z, _F);
    const ux = F[3], uy = F[4];   // up (body-fixed); east = pole × up = (−uy, ux, 0)
    let ex = -uy, ey = ux; const l = Math.hypot(ex, ey) || 1; ex /= l; ey /= l;
    out = out || [0, 0];
    out[0] = ex * F[0] + ey * F[1]; out[1] = ex * F[6] + ey * F[7];
    return out;
  };
  // a circular orbit eastward over a map point at world time t (the test, the debug API, the Heimkehr's arrival)
  A.circularAt = (st, pos, t) => {
    const U = UNI(), b = A.herz();
    U.home.chartToInertial('herz', pos, [0, 0, 0], t, st.r, st.v);
    unit(st.r, _n);
    const ax = b.spin.axis, ex = ax[1] * _n[2] - ax[2] * _n[1], ey = ax[2] * _n[0] - ax[0] * _n[2], ez = ax[0] * _n[1] - ax[1] * _n[0];
    const el = Math.hypot(ex, ey, ez) || 1, vc = Math.sqrt(b.mu / len(st.r));
    set3(st.v, ex / el * vc, ey / el * vc, ez / el * vc);
    st.frame = 'herz'; st.t = t; st.coast = true;
    U.verletInit(st, b.mu);
    return st;
  };
  // a ship's attitude from its nose and its up (system vectors): the columns starboard, up, tail (row-major)
  A.frameFrom = (nose, up, S) => {
    const zx = -nose[0], zy = -nose[1], zz = -nose[2];
    let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
    const l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    S[0] = xx; S[3] = xy; S[6] = xz; S[1] = yx; S[4] = yy; S[7] = yz; S[2] = zx; S[5] = zy; S[8] = zz;
    return S;
  };

  // ---------------------------------------------------------------- forces
  const _w = v3(), _wr = v3(), _va = v3(), _up = v3(), _t1 = v3(), _t2 = v3();
  // the air's velocity at r (it turns with Herzwelt): ω × r
  function airVel(st, out) { const b = A.herz(), w = b.spin.w, ax = b.spin.axis, r = st.r; return set3(out, w * (ax[1] * r[2] - ax[2] * r[1]), w * (ax[2] * r[0] - ax[0] * r[2]), w * (ax[0] * r[1] - ax[1] * r[0])); }
  // the velocity against the air (system axes); 0 away from Herzwelt
  A.airVelocity = (st, out) => { out = out || v3(); if (st.frame !== 'herz') return set3(out, st.v[0], st.v[1], st.v[2]); airVel(st, _wr); return set3(out, st.v[0] - _wr[0], st.v[1] - _wr[1], st.v[2] - _wr[2]); };
  // the heating of the ship's nose ∝ ρ·v³ against the air (W/m², the scale of the glow: U§4.4 by ρ, not by height)
  A.heatOf = (rho, va) => rho * va * va * va;
  // the hover jets for a flat way over the map: the inertial acceleration of a path that keeps its map velocity and its
  // height, less gravity — {radial: only the upright part (the entry's sink)}; at most 1.5 g
  A.jetsFor = (st, out, radialOnly) => {
    out = out || v3();
    const b = A.herz(), r = st.r, v = st.v, rr = len(r), mu = b.mu, w = b.spin.w, ax = b.spin.axis;
    unit(r, _up);
    // map velocity in system axes: v_m = v − ω × r
    airVel(st, _wr); set3(_va, v[0] - _wr[0], v[1] - _wr[1], v[2] - _wr[2]);
    const vu = dot(_va, _up);
    const vh2 = Math.max(0, dot(_va, _va) - vu * vu);
    // required: the sphere's curve (−v_h²/r up), Coriolis 2ω×v_m, centrifugal ω×(ω×r); less gravity (−μ r̂/r²)
    set3(_w, w * ax[0], w * ax[1], w * ax[2]);
    cross(_w, _va, _t1);                     // ω × v_m
    cross(_w, _wr, _t2);                     // ω × (ω × r)
    const g = mu / (rr * rr);
    let jx = 2 * _t1[0] + _t2[0] + _up[0] * (g - vh2 / rr), jy = 2 * _t1[1] + _t2[1] + _up[1] * (g - vh2 / rr), jz = 2 * _t1[2] + _t2[2] + _up[2] * (g - vh2 / rr);
    if (radialOnly) { const k = jx * _up[0] + jy * _up[1] + jz * _up[2]; jx = _up[0] * k; jy = _up[1] * k; jz = _up[2] * k; }
    const L = Math.hypot(jx, jy, jz), lim = A.SHIP.jets * A.SHIP.g;
    if (L > lim) { jx *= lim / L; jy *= lim / L; jz *= lim / L; }
    return set3(out, jx, jy, jz);
  };
  // one step of dt (any length: 1/120-s substeps under thrust, jets or air; an analytic coast otherwise). thr: the main
  // engine's acceleration (system axes) or null; jets: an extra acceleration (system axes) or null. Fills st.q, st.rho,
  // st.drag and keeps st.a (the gravity at r) for the next Verlet step.
  A.step = (st, dt, thr, jets) => {
    const U = UNI(), S = U.home, b = S.body(st.frame), mu = b.mu;
    const onHerz = st.frame === 'herz';
    const y = onHerz ? A.mapY(st) : Infinity;
    const air = onHerz && y < A.AIR.t1;
    const pushing = !!(thr && (thr[0] || thr[1] || thr[2])) || !!(jets && (jets[0] || jets[1] || jets[2]));
    st.thr[0] = thr ? thr[0] : 0; st.thr[1] = thr ? thr[1] : 0; st.thr[2] = thr ? thr[2] : 0;
    st.jets[0] = jets ? jets[0] : 0; st.jets[1] = jets ? jets[1] : 0; st.jets[2] = jets ? jets[2] : 0;
    if (!pushing && !air) {
      // coasting: Kepler, analytic (universal variables) — the energy stays (test/ascent.js d)
      U.coast(st.r, st.v, mu, dt, st.r, st.v);
      st.t += dt; st.coast = true; st.rho = 0; st.q = 0; st.drag.fill(0);
      U.verletInit(st, mu);
      return st;
    }
    st.coast = false;
    const n = Math.max(1, Math.ceil(dt * 120 - 1e-9)), h = dt / n;
    let q = 0, rhoMax = 0;
    for (let i = 0; i < n; i++) {
      let ax0 = st.thr[0] + st.jets[0], ay0 = st.thr[1] + st.jets[1], az0 = st.thr[2] + st.jets[2];
      if (air) {
        const yy = A.mapY(st), rh = A.rho(yy);
        if (rh > 0) {
          A.airVelocity(st, _va);
          const va = len(_va), kd = -rh * va / (2 * A.SHIP.beta);
          ax0 += kd * _va[0]; ay0 += kd * _va[1]; az0 += kd * _va[2];
          st.drag[0] = kd * _va[0]; st.drag[1] = kd * _va[1]; st.drag[2] = kd * _va[2];
          q = Math.max(q, A.heatOf(rh, va)); rhoMax = Math.max(rhoMax, rh);
        } else st.drag.fill(0);
      }
      U.verlet(st, h, mu, ax0, ay0, az0);
    }
    st.t += dt; st.rho = rhoMax; st.q = q;
    return st;
  };
  // the orbit of a state: {a, e, rp, ra, period, peri, apo (map heights round Herzwelt, or heights over the body), energy}
  A.orbitOf = (st) => {
    const U = UNI(), b = U.home.body(st.frame), el = U.stateToEl(st.r, st.v, b.mu);
    const base = st.frame === 'herz' ? A.DATUM - b.R : -b.R;
    return { a: el.a, e: el.e, rp: el.rp, ra: el.ra, period: el.period, peri: el.rp + base, apo: el.ra + base, energy: el.energy, i: el.i };
  };
  // the jets carry the ship while its orbit's low point is in the air (a free orbit coasts)
  A.suborbital = (st) => st.frame === 'herz' && A.orbitOf(st).peri < A.BAND.top - 300;

  // ---------------------------------------------------------------- attitude: the map's Euler angles ↔ a rotation
  // flight.js's ship frame: x starboard, y up, nose −z; its rotation rotY(heading)·rotX(pitch)·rotZ(roll) in the map frame
  // (x east, y up, z south). As a row-major 3×3 whose columns are the ship's axes in the map's.
  A.eulerToM = (h, p, r, out) => {
    out = out || m9();
    const ch = Math.cos(h), sh = Math.sin(h), cp = Math.cos(p), sp = Math.sin(p), cr = Math.cos(r), sr = Math.sin(r);
    // Ry(h) = [[ch,0,sh],[0,1,0],[−sh,0,ch]], Rx(p) = [[1,0,0],[0,cp,−sp],[0,sp,cp]], Rz(r) = [[cr,−sr,0],[sr,cr,0],[0,0,1]]
    const a00 = ch, a01 = sh * sp, a02 = sh * cp, a10 = 0, a11 = cp, a12 = -sp, a20 = -sh, a21 = ch * sp, a22 = ch * cp;   // Ry·Rx
    out[0] = a00 * cr + a01 * sr; out[1] = -a00 * sr + a01 * cr; out[2] = a02;
    out[3] = a10 * cr + a11 * sr; out[4] = -a10 * sr + a11 * cr; out[5] = a12;
    out[6] = a20 * cr + a21 * sr; out[7] = -a20 * sr + a21 * cr; out[8] = a22;
    return out;
  };
  // and back: heading, pitch, roll of a rotation (its nose −z gives heading and pitch; the roll from the up axis)
  A.mToEuler = (m, out) => {
    out = out || [0, 0, 0];
    const fx = -m[2], fy = -m[5], fz = -m[8];
    const p = Math.asin(clamp(fy, -1, 1));
    // the heading from the nose; straight up or down (the gimbal's knot) from the up axis, the roll then 0
    let h;
    if (Math.hypot(fx, fz) > 1e-6) h = Math.atan2(-fx, -fz);
    else h = fy > 0 ? Math.atan2(m[1], m[7]) : Math.atan2(-m[1], -m[7]);
    // the roll: R = Ry(h)Rx(p)Rz(r) → Rz(r) = (Ry Rx)ᵀ R; its [1][0] is sin r, [0][0] cos r
    // ((Ry Rx)ᵀ rows: [ch, 0, −sh], [sh sp, cp, ch sp], [sh cp, −sp, ch cp])
    const ch = Math.cos(h), sh = Math.sin(h), cp = Math.cos(p), sp = Math.sin(p);
    const c00 = ch * m[0] - sh * m[6], c10 = sh * sp * m[0] + cp * m[3] + ch * sp * m[6];
    out[0] = h; out[1] = p; out[2] = Math.atan2(c10, c00);
    return out;
  };

  // ---------------------------------------------------------------- the regime machine for a Flight (flight.js)
  // fl.regime: 'air' (flight.js as always) · 'climb' · 'space'; fl.asc holds the state, the ship's inertial attitude (S:
  // ship → system) in space, the map spot the ship left the ground from, the last map velocity
  const isStarship = (fl) => !!(fl && fl.b && fl.b.kind === 'starship');
  // may this ship climb past 252 m? (a starship; not a guest; not a host with guests — the sky stays theirs, U§10)
  A.mayClimb = (fl) => {
    if (!isStarship(fl)) return 'g.asc.noHelm';
    const g = fl.g, m = g && g.meta;
    if (m && m.guest) return 'g.asc.guest';
    const mp = g && g.mp; if (mp && mp.isHost && mp.remote && mp.remote.size > 0) return 'g.asc.guests';
    if (g && g.dim && g.dim !== 'overworld') return 'g.asc.notHere';
    return null;
  };
  // the world clock in seconds (VR.Universe.worldSeconds) — a Flight's game, else its own clock (node)
  A.clock = (fl) => { const env = fl.g && fl.g.env; return env && env.ticks !== undefined ? UNI().worldSeconds(env.day | 0, env.ticks) : (fl.ascT || 0); };
  function ascOf(fl) {
    return fl.asc || (fl.asc = { st: A.newState(), S: m9(), M: m9(), pos: [0, 0, 0], vel: [0, 0, 0], ground: null, tOff: 0, prevUp: v3(), jump: null, warned: -99, handT: 0, info: { alt: 0, speed: 0, inertial: 0, vs: 0, q: 0, rho: 0, g: 0, thrust: 0, jets: 0 } });
  }
  A.ascOf = ascOf;
  // the ship's top on the map (the air regime's cap counts from it: p[1] + height)
  const topOf = (fl, y) => y + ((fl.b && fl.b.height) || 4);
  // air → climb: the 252-m cap's door (flight.js); true when the climb takes over
  A.lift = (fl, vyT) => {
    if (fl.regime && fl.regime !== 'air') return true;
    const why = A.mayClimb(fl);
    if (why) { const now = fl.t || 0, a = ascOf(fl); if (now - a.warned > 8 && fl.g && fl.g.ui && fl.g.ui.hint) { a.warned = now; fl.g.ui.hint(T(why), 3500); } return false; }
    const b = fl.b, p = b.pos, v = b.vel;
    A.enterClimb(fl, [p[0], p[1], p[2]], [v[0], Math.max(v[1], vyT || 0), v[2]]);
    return true;
  };
  A.enterClimb = (fl, pos, vel) => {
    const a = ascOf(fl), from = fl.regime || 'air';
    if (from === 'air') a.ground = [pos[0], pos[1], pos[2]];
    A.fromMap(a.st, pos, vel, A.clock(fl) + (a.tOff || 0));
    fl.regime = 'climb'; fl.holdAlt = null; a.jump = null;
    if (from === 'air') fl.alt = null;   // (a landed ship set up here kept its 0 m: the climb measures its own clearance)
    a.pos[0] = pos[0]; a.pos[1] = pos[1]; a.pos[2] = pos[2]; a.vel[0] = vel[0]; a.vel[1] = vel[1]; a.vel[2] = vel[2];
    unit(a.st.r, a.prevUp);
    if (A.onRegime) A.onRegime(fl, from, 'climb');
  };
  // climb → air (the ship's top below 248 m, the sink tamed): flight.js's model takes the ship as it is
  A.leaveToAir = (fl) => {
    const b = fl.b, v = b.vel;
    fl.regime = 'air'; fl.holdAlt = b.pos[1];
    const h = b.heading, vF = v[0] * -Math.sin(h) + v[2] * -Math.cos(h);
    fl.throttle = clamp(vF / Math.max(1, fl.cruise), -0.25, 1); fl.vF = vF;
    fl.pitch = clamp(fl.pitch, -0.18, 0.18); fl.roll = clamp(fl.roll, -0.6, 0.6);
    b.setAttitude(fl.pitch, fl.roll); fl.orient();
    if (A.onRegime) A.onRegime(fl, 'climb', 'air');
  };
  // the ship's attitude as a system rotation (both regimes): the climb's from the map's Euler angles, space's its own
  const _loc = m9(), _Rm = m9();
  A.attitudeSys = (fl, out) => {
    const a = ascOf(fl);
    if (fl.regime === 'space') { out.set(a.S); return out; }
    A.eulerToM(fl.b.heading, fl.pitch, fl.roll, _Rm);
    A.localM(a.pos[0], a.pos[2], a.st.t, _loc);
    return mulm(_loc, _Rm, out);
  };

  // the autopilot hook: spaceflight.js sets A.guide = (fl, dt, ctx) → {nose: system unit vector, up: system vector|null,
  // throttle (−1…1 of the main engine's g), boost, jets: 'flat'|'radial'|'off', sink (m/s, the jets hold it), hvel (the map
  // velocity the jets steer toward, system axes), keepClimb (no hand-over to the air yet)} or null
  A.guide = null;
  A.afterStep = null;      // (spaceflight.js: the patched conics — the frame follows the spheres of influence)
  const _nose = v3(), _thr = v3(), _jet = v3(), _tmp = v3(), _ax = v3(), _up0 = v3(), _hv = v3(), _S2 = m9(), _rot = m9(), _mapPos = [0, 0, 0], _mapVel = [0, 0, 0];
  // the jets' last clamp: they push away from the ground only (no pull down: less push is gravity's), at most 2 g in all
  function clampJets(j, up) {
    const jr = dot(j, up); if (jr < 0) { j[0] -= up[0] * jr; j[1] -= up[1] * jr; j[2] -= up[2] * jr; }
    const L = len(j), lim = A.SHIP.jetsMax * A.SHIP.g; if (L > lim) { j[0] *= lim / L; j[1] *= lim / L; j[2] *= lim / L; }
    return j;
  }
  // one frame of the climb or space regime (flight.js simulate's first line). true: done here
  A.simulate = (fl, dt) => {
    if (!fl.regime || fl.regime === 'air') return false;
    const b = fl.b, a = ascOf(fl), st = a.st, SH = A.SHIP, g0 = SH.g;
    fl.ascT = (fl.ascT || 0) + dt;
    // the engines: a cold ship cannot be here, but its spool-up finishes as flight.js would
    if (fl.power === 'starting') { fl.startT += dt; if (fl.startT >= 3) { fl.power = 'running'; fl.startT = 3; } }
    // the boost's energy bar (as flight.js)
    const wantB = fl.boostWant;
    if (wantB && !fl.boost && fl.energy > 0.15) { fl.boost = true; fl.fovKick = 0.05; fl.bump = Math.max(fl.bump, 0.4); fl.sfx('boost'); }
    if (fl.boost && (!wantB || fl.energy <= 0)) { fl.boost = false; fl.boostCool = 0.8; }
    if (fl.boost) fl.energy = Math.max(0, fl.energy - dt / 5); else { fl.boostCool -= dt; if (fl.boostCool <= 0) fl.energy = Math.min(1, fl.energy + dt / 9); }
    fl.gearDown = false; fl.gear = clamp(fl.gear - dt / 1.2, 0, 1); if (b.setGear) b.setGear(fl.gear);
    // the clock: the state follows the world's time (a frame's dt, as the game's clock moves)
    const tNow = A.clock(fl) + (a.tOff || 0);
    let h = tNow - st.t;
    if (!(h > 0) || h > 0.25) h = dt;   // (a paused or a jumping clock: the frame's own time)
    // ---- the Reisesprung and the home jump: the path flies the ship (spaceflight.js)
    if (a.jump && VR.SpaceFlight && VR.SpaceFlight.jumpStep) { VR.SpaceFlight.jumpStep(fl, h); hud(fl, a, 0, null); return true; }
    // ---- guidance (the autopilot) and the pilot's stick
    const G = fl.auto && fl.auto.space && A.guide ? A.guide(fl, h, a) : null;
    const space = fl.regime === 'space';
    if (!space) {
      // the climb: heading, pitch and the bank in the map's frame (the pilot's own, or the autopilot's targets)
      let turn = clamp(fl.ctl.turn, -1, 1), climb = clamp(fl.ctl.climb, -1, 1);
      if (G && G.nose) {
        A.localM(a.pos[0], a.pos[2], st.t, _loc); mulTv(_loc, G.nose, _tmp);
        const hT = Math.atan2(-_tmp[0], -_tmp[2]), pT = Math.asin(clamp(_tmp[1], -1, 1));
        turn = clamp(wrapA(hT - b.heading) * 2.5 * clamp(Math.cos(fl.pitch) * 3, 0.15, 1), -1, 1); climb = clamp((pT - fl.pitch) * 2.5, -1, 1);
      }
      fl.yawRate += (turn * SH.yawRate - fl.yawRate) * k1(1 / 0.25, dt);
      b.heading = b.heading + fl.yawRate * dt;
      if (fl.steering) fl.headYaw = clamp(fl.headYaw - fl.yawRate * dt, -150 * D2R, 150 * D2R);
      fl.pitch = clamp(fl.pitch + climb * SH.pitchRate * dt, -80 * D2R, 89 * D2R);
      const rollT = clamp(fl.yawRate / SH.yawRate, -1, 1) * 30 * D2R * clamp(0.3 + a.info.speed / 120, 0.3, 1);
      fl.roll += (rollT - fl.roll) * k1(1 / 0.3, dt);
      b.setAttitude(fl.pitch, fl.roll); fl.orient();
      A.attitudeSys(fl, _S2); a.S.set(_S2);
    } else {
      // space: the pilot's body rates about the ship's own up (yaw) and right (pitch); the autopilot slews the nose toward
      // its target and the ship's up toward the sky. (The hold against the local vertical comes after the step.)
      const yawR = clamp(fl.ctl.turn, -1, 1) * SH.yawRate * 0.8, pitR = clamp(fl.ctl.climb, -1, 1) * SH.pitchRate * 0.8;
      if (!G && (yawR || pitR)) {
        if (yawR) { set3(_ax, a.S[1], a.S[4], a.S[7]); rotM(_ax, yawR * dt, _rot); mulm(_rot, a.S, a.S); }
        if (pitR) { set3(_ax, a.S[0], a.S[3], a.S[6]); rotM(_ax, pitR * dt, _rot); mulm(_rot, a.S, a.S); }
      }
      if (G && G.nose) { unit(st.r, _tmp); A.slew(a.S, G.nose, G.up || _tmp, SH.slew * dt, SH.roll * dt); }
      ortho(a.S);
    }
    // ---- the main engine along the nose, the hover jets
    set3(_nose, -a.S[2], -a.S[5], -a.S[8]);
    let thrG = G ? clamp(G.throttle || 0, -SH.rev / SH.thrust, 1) * SH.thrust : clamp(fl.throttle, -SH.rev / SH.thrust, 1) * SH.thrust;
    if (fl.boost || (G && G.boost)) thrG = SH.boost;
    if (!fl.running) thrG = 0;
    set3(_thr, _nose[0] * thrG * g0, _nose[1] * thrG * g0, _nose[2] * thrG * g0);
    let jets = null;
    const onHerz = st.frame === 'herz';
    const jetMode = G ? (G.jets || 'off') : (A.suborbital(st) ? 'flat' : 'off');
    if (onHerz) { unit(st.r, _up); A.airVelocity(st, _va); }
    if (onHerz && jetMode !== 'off' && fl.running) {
      A.jetsFor(st, _jet, jetMode === 'radial');
      const vu = dot(_va, _up);
      // the entry's and the descent's sink: the upright jets hold a sink rate
      if (G && G.sink !== undefined && G.sink !== null) { const k = clamp((G.sink - vu) * 0.9, -g0 * 0.6, g0 * 0.6); _jet[0] += _up[0] * k; _jet[1] += _up[1] * k; _jet[2] += _up[2] * k; }
      // toward a place (the descent onto the temple's apron): the map velocity's horizontal part steered to G.hvel
      if (G && G.hvel) {
        set3(_hv, G.hvel[0] - (_va[0] - _up[0] * vu), G.hvel[1] - (_va[1] - _up[1] * vu), G.hvel[2] - (_va[2] - _up[2] * vu));
        const k = 0.8, L = len(_hv) * k, lim = g0 * 0.5, f = L > lim ? lim / L * k : k;
        _jet[0] += _hv[0] * f; _jet[1] += _hv[1] * f; _jet[2] += _hv[2] * f;
      }
      // the hover hold: the lever at zero, no autopilot — the jets take the map speed off (a pilot can stop anywhere)
      if (!G && Math.abs(fl.throttle) < 0.02 && !fl.boost) { const k = SH.hold; _jet[0] -= _va[0] * k; _jet[1] -= _va[1] * k; _jet[2] -= _va[2] * k; }
      jets = clampJets(_jet, _up);
    }
    // the sink limiter (friedlich: no ship arrives at the cap faster than 14 m/s): below 600 m the jets brake a fall
    if (!space && onHerz) {
      const top = topOf(fl, A.mapY(st));
      if (top < A.BAND.sink) {
        const vu = dot(_va, _up), lim = -(Math.sqrt(2 * 12 * Math.max(0, top - A.BAND.air)) + 12);
        if (vu < lim) { if (!jets) { jets = _jet; _jet.fill(0); } const k = Math.min(g0 * 2, (lim - vu) * 3 + g0); jets[0] += _up[0] * k; jets[1] += _up[1] * k; jets[2] += _up[2] * k; }
      }
    }
    // ---- integrate (and the frame follows the spheres of influence)
    const frame0 = st.frame;
    unit(st.r, _up0);
    A.step(st, h, _thr, jets);
    if (A.afterStep) A.afterStep(st);
    // space: the attitude held against the local vertical (LVLH — the frame carried along the way: no hands, no turn
    // against the horizon; the planet stays below)
    if (space && st.frame === frame0) {
      unit(st.r, _tmp);
      const c = clamp(dot(_up0, _tmp), -1, 1);
      cross(_up0, _tmp, _ax);
      const s = len(_ax);
      if (s > 1e-15) { _ax[0] /= s; _ax[1] /= s; _ax[2] /= s; rotM(_ax, Math.atan2(s, c), _rot); mulm(_rot, a.S, a.S); }
    }
    // ---- the regime's edges
    if (st.frame === 'herz') {
      const y = A.mapY(st);
      A.toMap(st, _mapPos, _mapVel);
      if (fl.regime === 'climb' && y >= A.BAND.edge) A.toSpace(fl);
      else if (fl.regime === 'space' && y <= A.BAND.back) A.toClimb(fl);
      // the ship on the map where the state is (in space too: the space frame draws it there, the voxel world waits)
      a.pos[0] = _mapPos[0]; a.pos[1] = _mapPos[1]; a.pos[2] = _mapPos[2]; a.vel[0] = _mapVel[0]; a.vel[1] = _mapVel[1]; a.vel[2] = _mapVel[2];
      b.pos[0] = _mapPos[0]; b.pos[1] = _mapPos[1]; b.pos[2] = _mapPos[2];
      b.vel[0] = _mapVel[0]; b.vel[1] = _mapVel[1]; b.vel[2] = _mapVel[2];
      if (fl.regime === 'climb') {
        // back into the air regime: the top below 248 m (or the ground near: a mountain under the way down), the sink tamed
        const vy = _mapVel[1], tame = vy > -14.5 && vy < 0.5 && !(G && G.keepClimb);
        if (tame && (topOf(fl, y) < A.BAND.down || (fl.alt !== null && fl.alt !== undefined && fl.alt < 25))) A.leaveToAir(fl);
      }
    }
    unit(st.r, a.prevUp);
    hud(fl, a, thrG, jets);
    fl.alt = fl.regime === 'climb' ? fl.clearance() : null;
    fl.vF = a.info.speed;
    fl.lastGood = b.pos.slice();
    return true;
  };
  // what the HUD and the effects read (fl.asc.info)
  function hud(fl, a, thrG, jets) {
    const st = a.st, I = a.info, onHerz = st.frame === 'herz', g0 = A.SHIP.g;
    A.airVelocity(st, _va);
    I.alt = onHerz ? A.mapY(st) : len(st.r) - UNI().home.body(st.frame).R;
    I.speed = onHerz ? len(_va) : len(st.v);
    I.inertial = len(st.v);
    unit(st.r, _up); I.vs = dot(onHerz ? _va : st.v, _up);
    I.q = st.q; I.rho = st.rho;
    I.g = Math.hypot(_thr[0] * (thrG ? 1 : 0) + (jets ? jets[0] : 0) + st.drag[0], _thr[1] * (thrG ? 1 : 0) + (jets ? jets[1] : 0) + st.drag[1], _thr[2] * (thrG ? 1 : 0) + (jets ? jets[2] : 0) + st.drag[2]) / g0;
    I.thrust = thrG; I.jets = jets ? len(jets) / g0 : 0;
  }
  // the autopilot's space modes while the ship is in the air regime (flight.js autoStep's first line): Zum Orbit climbs
  // to the cap (its door opens the climb, where VR.SpaceFlight's guide flies), the way down hands over to the landing
  const _me = [0, 0];
  A.autoAir = (fl, dt) => {
    const A_ = fl.auto; if (!A_ || !A_.space) return false;
    if (fl.regime && fl.regime !== 'air') return true;
    const b = fl.b, c = fl.ctl;
    if (A_.space === 'orbit') {
      A.mapEast(b.pos[0], b.pos[2], _me);
      const hT = Math.atan2(-_me[0], -_me[1]);
      c.turn = clamp(wrapA(hT - b.heading) * 2.2, -1, 1); c.climb = 1; c.speed = fl.cruise * 0.3; c.strafe = 0;
      if (fl.state !== 'flying') { fl.state = 'flying'; fl.holdAlt = null; }
      return true;
    }
    // down in the air: on to a place (Heimkehr: the temple's apron, flown to and docked by the village autopilot) or the
    // landing straight below
    const site = A_.target;
    fl.auto = null; c.speed = null; c.strafe = 0;
    if ((A_.space === 'land' || A_.space === 'descend') && site && fl.startAuto) fl.startAuto(site);
    else if (A_.space === 'land' || A_.space === 'descend') fl.assistLand(true);
    return true;
  };
  // put a ship into a circular orbit over a map point (the test, the debug API): the space regime, the nose prograde
  A.orbitAt = (fl, pos, t) => {
    const a = ascOf(fl), st = a.st, b = fl.b, from = fl.regime || 'air';
    if (t === undefined) t = A.clock(fl) + (a.tOff || 0);
    A.circularAt(st, pos, t);
    a.tOff = t - A.clock(fl); a.jump = null;
    unit(st.r, _up); unit(st.v, _tmp);
    A.frameFrom(_tmp, _up, a.S);
    unit(st.r, a.prevUp);
    fl.regime = 'space'; fl.auto = null; fl.state = 'flying';
    fl.throttle = 0; fl.boost = false; fl.boostWant = false;   // (on the circle the ship coasts)
    if (!fl.running) { fl.power = 'running'; fl.startT = 3; }
    if (from === 'air') a.ground = [b.pos[0], b.pos[1], b.pos[2]];
    a.pos[0] = pos[0]; a.pos[1] = Math.min(pos[1], A.BAND.edge); a.pos[2] = pos[2];
    b.pos[0] = pos[0]; b.pos[1] = Math.min(pos[1], A.BAND.edge); b.pos[2] = pos[2]; b.vel[0] = b.vel[1] = b.vel[2] = 0;
    if (A.onRegime) A.onRegime(fl, from, 'space');
    return st;
  };
  // the autopilot's slew: the nose toward n (unit, system) by at most `rate` radians, the up toward u by `roll`
  A.slew = (S, n, u, rate, roll) => {
    set3(_t1, -S[2], -S[5], -S[8]);
    const c = clamp(dot(_t1, n), -1, 1);
    cross(_t1, n, _ax);
    const s = len(_ax);
    if (s > 1e-9) { _ax[0] /= s; _ax[1] /= s; _ax[2] /= s; rotM(_ax, Math.min(Math.atan2(s, c), rate), _rot); mulm(_rot, S, S); }
    else if (c < 0) { set3(_ax, S[1], S[4], S[7]); rotM(_ax, rate, _rot); mulm(_rot, S, S); }   // (exactly backwards: turn about the up)
    // the roll: the ship's up toward u, about the nose
    set3(_t1, -S[2], -S[5], -S[8]);
    const ud = dot(u, _t1);
    set3(_t2, u[0] - _t1[0] * ud, u[1] - _t1[1] * ud, u[2] - _t1[2] * ud);
    const ul = len(_t2);
    if (ul > 1e-6 && roll > 0) {
      _t2[0] /= ul; _t2[1] /= ul; _t2[2] /= ul;
      set3(_tmp, S[1], S[4], S[7]);
      const cr = clamp(dot(_tmp, _t2), -1, 1);
      cross(_tmp, _t2, _ax);
      const sr = dot(_ax, _t1), ang = Math.atan2(sr, cr);
      if (Math.abs(ang) > 1e-6) { rotM(_t1, clamp(ang, -roll, roll), _rot); mulm(_rot, S, S); }
    }
    return S;
  };
  // climb → space (2,500 m): the attitude becomes the inertial rotation (held against the local vertical from here)
  A.toSpace = (fl) => {
    const a = ascOf(fl);
    A.attitudeSys(fl, _S2); a.S.set(_S2);
    fl.regime = 'space';
    a.handT = fl.ascT || 0;
    if (A.onRegime) A.onRegime(fl, 'climb', 'space');
  };
  // space → climb (2,450 m on the way down): the map place under the ship now (it may be far from where it left) and the
  // map's Euler angles of the inertial attitude
  A.toClimb = (fl) => {
    const a = ascOf(fl), b = fl.b, st = a.st;
    A.toMap(st, _mapPos, _mapVel);
    a.pos[0] = _mapPos[0]; a.pos[1] = _mapPos[1]; a.pos[2] = _mapPos[2];
    A.localM(_mapPos[0], _mapPos[2], st.t, _loc);
    mulTm(_loc, a.S, _Rm);
    const e = A.mToEuler(_Rm, [0, 0, 0]);
    b.heading = e[0]; fl.pitch = clamp(e[1], -80 * D2R, 89 * D2R); fl.roll = clamp(e[2], -0.6, 0.6);
    b.pos[0] = _mapPos[0]; b.pos[1] = _mapPos[1]; b.pos[2] = _mapPos[2];
    b.vel[0] = _mapVel[0]; b.vel[1] = _mapVel[1]; b.vel[2] = _mapVel[2];
    b.setAttitude(fl.pitch, fl.roll); fl.orient();
    fl.regime = 'climb';
    if (A.onRegime) A.onRegime(fl, 'space', 'climb');
  };
  // the ship's attitude as the map's Euler angles in the frame under it (space: for drawing the model and the cameras)
  A.drawAttitude = (fl) => {
    const a = ascOf(fl), b = fl.b;
    A.localFrame(a.st, _loc);
    mulTm(_loc, a.S, _Rm);
    const e = A.mToEuler(_Rm, a.eul || (a.eul = [0, 0, 0]));
    b.heading = e[0]; fl.pitch = e[1]; fl.roll = e[2];
    b.setAttitude(fl.pitch, fl.roll); fl.orient();
    return e;
  };
  // the climb's and space's feel (flight.js effects in these regimes): the engine follows the thrust, the shake the
  // dynamic pressure and the plasma, the wind the air; the FOV stays (no speed rush in a vacuum)
  A.effects = (fl, dt) => {
    const g = fl.g, a = ascOf(fl), I = a.info, S = (g && g.settings) || {};
    fl.speed = I.speed;
    const thrK = clamp(Math.abs(I.thrust || 0) / A.SHIP.thrust + (I.jets || 0) * 0.35, 0, 1.45);
    fl.spool += (Math.max(0.15, thrK) - fl.spool) * k1(fl.spool < thrK ? 1.1 : 0.6, dt);
    const qd = 0.5 * (I.rho || 0) * I.speed * I.speed;   // dynamic pressure (Pa)
    if (g && g.audio) {
      g.audio.loop('engine', 0.06 + fl.spool * 0.2, 0.22 + Math.min(1, qd / 20000) * 0.8);
      if (g.audio.turbine) g.audio.turbine(0.02 + fl.spool * 0.05, fl.spool);
    }
    if (g) g.flightWind = Math.min(0.9, qd / 25000);
    const glow = A.glowFl(fl);
    const amp = S.camShake === false ? 0 : clamp(Math.min(1.6, qd / 15000) * 0.5 + glow * 0.9 + fl.bump + 0.02 * fl.spool, 0, 3);
    fl.bump = Math.max(0, fl.bump - dt * 2.2);
    fl.shakeAmp += (amp - fl.shakeAmp) * k1(5, dt);
    const t = fl.t, Am = fl.shakeAmp, n = (p, q, r) => Math.sin(t * p + q) * 0.5 + Math.sin(t * p * 1.73 + r) * 0.32 + Math.sin(t * p * 2.71 + q * 2.1) * 0.18;
    fl.shake[0] = n(9.3, 1.7, 2.9) * Am * 0.006; fl.shake[1] = n(11.7, 0.3, 4.1) * Am * 0.006; fl.shake[2] = n(7.9, 2.2, 1.3) * Am * 0.007; fl.shake[3] = n(13.1, 3.1, 0.7) * Am * 0.02;
    fl.fovKick += ((fl.boost ? 0.04 : 0) - fl.fovKick) * k1(1.8, dt);
    fl.fovK = 1 + fl.fovKick;
    for (let i = 0; i < 3; i++) { fl.accSm[i] += (0 - fl.accSm[i]) * k1(4, dt); fl.lastV[i] = fl.b.vel[i]; }
    if (fl.fx) fl.fx(dt, Math.min(I.speed, 60));   // (the plume and its trail; in space too — the ship waits on its map spot)
  };
  // the plasma's glow 0…1 from the heating ρv³ (U§4.4: by ρ, not by height): faint from 0.15 MW, full at 0.6 MW (the entry
  // from 3 km over the Heartland peaks near 0.6 MW at ~2,200 m: test/ascent.js f). With qRef (the autopilot's predicted
  // peak of this entry, entry.js) the scale is the entry's own: full at 80 % of its peak, never below 0.2 MW — on this
  // small world a circle's way crosses the ground's turning at an angle that changes with the place, and the air meets
  // the ship at 480–770 m/s; a slow entry (under ~0.08 MW) stays dark
  A.GLOW = Object.freeze({ q0: 0.15e6, q1: 0.6e6, qMin: 0.2e6 });
  A.glowOf = (q, qRef) => {
    const G = A.GLOW; let q0 = G.q0, q1 = G.q1;
    if (qRef > 0) { q1 = clamp(qRef * 0.8, G.qMin, G.q1); q0 = Math.min(G.q0, q1 * 0.4); }
    return clamp(((q || 0) - q0) / (q1 - q0), 0, 1);
  };
  A.glowFl = (fl) => { const a = fl && fl.asc; return a ? A.glowOf(a.info.q, fl.auto && fl.auto.qRef) : 0; };

  // ---------------------------------------------------------------- the climb's sky (env.js → VR.Ascent.env)
  // k = climbK(y) (smootherstep 300 → 2,500): the postcard bodies glide to the true sky (directions on great circles,
  // sizes from the trailer's to the true), the sun its ≤ 2.6°; airK: the sky's colours thin. Pure on an env frame E (the
  // test runs it on a plain object)
  const POST_MOONS = ['zinn', 'opal', 'basalt', 'ocker'];
  A.blendSky = (E, sky, k) => {
    if (!sky || !(k > 0)) return E;
    const U = UNI(), SB = E.bodies;
    const by = sky._byId || {};
    const glide = (dirIn, id, out) => { const e = by[id]; if (!e) return dirIn; return Array.from(U.slerpDir(dirIn, e.dir, k, out || v3())); };
    E.sunDir = Array.from(U.slerpDir(E.sunDir, sky.sun.dir, k, v3()));
    E.moonDir = [-E.sunDir[0], -E.sunDir[1], -E.sunDir[2]];
    if (SB) {
      SB.giant = glide(SB.giant, 'amarant'); E.planetDir = SB.giant;
      if (by.amarant) { SB.ring = Array.from(U.slerpDir(SB.ring, by.amarant.pole, k, v3())); E.ringNormal = SB.ring; SB.radius.giant += (by.amarant.ang - SB.radius.giant) * k; }
      SB.blue = glide(SB.blue, 'aqua'); E.planet2Dir = SB.blue;
      if (by.aqua) SB.radius.blue += (by.aqua.ang - SB.radius.blue) * k;
      for (let i = 0; i < 4 && i < SB.moons.length; i++) {
        const id = POST_MOONS[i], m = SB.moons[i], e = by[id];
        if (!e) continue;
        const d = U.slerpDir([m[0], m[1], m[2]], e.dir, k, v3());
        SB.moons[i] = [d[0], d[1], d[2], m[3] + (e.ang - m[3]) * k];
      }
    }
    return E;
  };
  // the sky's thinning (airK) and space showing through it (fBg: the space background's share, 0…1); ck = climbK(y): the
  // band over the horizon keeps its glow low in the climb and goes faster the higher (the sky's horizon is the flat map's,
  // 0°, while the limb sinks below it — above ~1,200 m a band there reads as a grey wall over the limb; the impostor's own
  // air draws the limb's thin blue line where it is)
  A.thinSky = (E, airK, fBg, ck) => {
    const sc = (c, k) => (c ? c.map((x) => x * k) : c), k = ck || 0;
    const hk = Math.pow(airK, 0.35 + k);
    E.zenith = sc(E.zenith, airK); E.skyMid = sc(E.skyMid, Math.pow(airK, 0.7 + 0.5 * k)); E.horizon = sc(E.horizon, hk);
    E.sunset = sc(E.sunset, Math.pow(airK, 0.5 + k));
    if (E.skyStops) { E.skyStops = E.skyStops.slice(); E.skyStops[0] *= 0.25 + 0.75 * Math.sqrt(airK); E.skyStops[3] *= airK; }
    if (E.skyDay) { E.skyDay = E.skyDay.slice(); E.skyDay[0] *= hk; }
    if (E.skySpace) {
      // space shows from the horizon up as the air goes (by day too); its brightness by day to the night's
      const s = E.skySpace.slice(), f = 1 - airK;
      s[0] += (-0.12 - s[0]) * f; s[1] += (0.02 - s[1]) * f; s[2] += (1 - s[2]) * f;
      E.skySpace = s;
    }
    E.nebula = (E.nebula === undefined ? 1 : E.nebula) * (1 - fBg);
    E.sunDisc = (E.sunDisc === undefined ? 16 : E.sunDisc) * (1 - fBg);
    E.rays = (E.rays || 0) * airK;
    // t-sky3's layers: the golden bands, the aureole and the earth's shadow belong to the air
    const S3 = E.sky3 && (E.sky3.level || E.sky3.vol) ? E.sky3.u : null;   // (rewritten each frame only while t-sky3 is on)
    if (S3) {
      const kk = Math.pow(airK, 0.5 + 0.5 * k);
      for (const n of ['u_s3Warm', 'u_s3Warm2', 'u_s3Glow', 'u_s3Belt']) { const u = S3[n]; if (u) { u[0] *= kk; u[1] *= kk; u[2] *= kk; } }
      if (S3.u_s3Belt) S3.u_s3Belt[3] *= kk;
      if (S3.u_s3Shade) { S3.u_s3Shade[0] *= airK; S3.u_s3Shade[1] *= airK; S3.u_s3Shade[2] *= airK; }
      if (S3.u_s3Sun) { S3.u_s3Sun[2] *= 1 - fBg; S3.u_s3Sun[3] *= airK; }
      // its two decorative moons shrink away (Helia has no such moons: the true ones glide in), the clouds' far field, its
      // banks and the ray fan stay below (seen from above they would be the wrong way round)
      const gone = 1 - (E.climb ? E.climb.k : 0);
      if (S3.u_s3MoonA) S3.u_s3MoonA[3] *= gone;
      if (S3.u_s3MoonB) S3.u_s3MoonB[3] *= gone;
      if (S3.u_s3Field) S3.u_s3Field[3] *= airK * airK;
      if (S3.u_s3Bank) S3.u_s3Bank[0] *= airK * airK;
      if (S3.u_s3Fan) S3.u_s3Fan[0] *= airK;
      if (S3.u_s3Aur) S3.u_s3Aur[0] *= Math.sqrt(airK);
    }
    return E;
  };
  // the far haze: pushed out as the air thins (the land below stays clear to the tiles' edge; the impostor's own air
  // takes over beyond)
  A.thinFog = (E, airK) => {
    if (!E.fog || E.fog[3] > 0.5) return E;
    const s = 1 + 2 * (1 - airK);
    E.fog = [E.fog[0] * s, E.fog[1] * s, E.fog[2] * airK, E.fog[3]];
    return E;
  };
  // space's own background (the space scene's stars, galaxy band and Helia) behind the thinning air: none below 1,200 m
  A.bgK = (y) => ss(1200, 2400, y);
  // the true bodies (Amarant, its ring, the moons, Helia's glare) over the postcard's near the hand-off; Herzwelt's
  // impostor (the land beyond the tiles, the limb) from 400 m
  A.bodyK = (y) => ss(2150, 2450, y);
  A.impK = (y) => ss(400, 700, y);
  // what the game tells the pure part each frame (ascent.js glue): the bend on, the tiles' radius (m), how far they are built
  A.view = { curve: true, hzR: 0, hzK: 1 };
  // space's grade (spacescene.js SS.env / SS.step): the picture turns to it near the hand-off
  A.SPACE_GRADE = Object.freeze({ contrast: 0.05, saturation: 1.12, vignette: 0.3, vivid: 0.45, bloomThreshold: 1.4, bloomStrength: 0.06 });
  // the climb's sky on an env frame (env.js's last line): o.pos the eye on the map, o.t the world's seconds (or the env's
  // clock), o.dim. Nothing below 300 m or in other worlds — the ground's picture is the same picture
  A.env = (E, o, env) => {
    if (!o || !o.pos || (o.dim && o.dim !== 'overworld') || !(o.pos[1] > A.BAND.high)) { if (E.climb) E.climb = null; return E; }
    const y = o.pos[1];
    const U = UNI(), k = U.climbK(y), t = o.t !== undefined ? o.t : U.worldSeconds((env && env.day) | 0, env ? env.ticks : 0);
    const sky = A._sky = U.localSky('overworld', o.pos, t, A._sky || undefined);
    const ak = A.airK(y), bg = A.bgK(y), V = A.view, imp = A.impK(y);
    // (the tiles give their far edge to the impostor only once it is whole there: below 700 m they keep all of it)
    const hzR = imp >= 0.999 ? (V.hzR || 0) * (V.hzK === undefined ? 1 : V.hzK) : 0;
    E.climb = { y, k, airK: ak, bg, body: A.bodyK(y), imp, t, curve: V.curve === false ? 0 : A.curve(y), cut0: hzR * 0.45, cut1: hzR * 0.95, hzR };   // (u-orbitlod: a wide soft band, was 0.75–0.95 dithered)
    E.climb.dip = VR.PlanetLOD ? VR.PlanetLOD.dip(y - ((VR.C && VR.C.SEA) || 64), A.R()) * ss(300, 450, y) : 0;   // u-orbitlod: the band on the limb (the impostor's true horizon; faded in over 300–450 m)
    A.blendSky(E, sky, k);
    A.thinSky(E, ak, bg, k);
    A.thinFog(E, ak);
    // the last of the air's light goes before the hand-off (the space frame has no sky pass); the postcard's bodies go
    // under the true ones; the picture's grade turns to space's
    const end = 1 - ss(2150, 2480, y), sc = (c) => (c ? c.map((x) => x * end) : c);
    if (end < 1) { E.zenith = sc(E.zenith); E.skyMid = sc(E.skyMid); E.horizon = sc(E.horizon); E.sunset = sc(E.sunset); }
    if (E.climb.body >= 1 && E.bodies) { const B = E.bodies; B.radius.giant = 0; B.radius.blue = 0; for (const m of B.moons) m[3] = 0; }
    const gk = ss(1800, 2500, y), SG = A.SPACE_GRADE;
    if (gk > 0) for (const key in SG) if (E[key] !== undefined) E[key] += (SG[key] - E[key]) * gk;
    return E;
  };

  // ================================================================ the game's glue (a page with the game)
  if (typeof window === 'undefined' || !VR.Game) return;
  A.page = true;
  const G = VR.Game, FL = VR.Flight, SP = VR.Starships && VR.Starships.prototype;
  // Krümmung (Bild · Anzeige): the world bends in the climb as it does (off: the flat map out to the tiles' edge)
  if (VR.Settings && VR.Settings.add) VR.Settings.add({ key: 'curvature', g: 'img', sec: 'show', t: 'switch', lab: 'g.set.curvature', tip: 'g.set.curvature.tip', cost: 'low', def: true });
  A.game = null;
  A.precompile = [];

  // ---------------------------------------------------------------- each play frame (spaceflight.js's playFrame wrapper)
  // what the pure part reads (the bend on, the tiles' radius and how far they are built), less to stream high up (the
  // chunks' render distance 2 above 800 m: the tiles and the impostor carry the land), no Fern-Cache in the climb (it
  // keeps the sky of a moment), the entry's landing place and its light
  A.frame = function (g, dt) {
    A.game = g;
    const fl = g.flight, w = g.world, r = g.renderer, hz = g.horizon, S = g.settings || {};
    A.view.curve = S.curvature !== false;
    const hzOn = !!(hz && hz.enabled && hz.enabled());
    A.view.hzR = hzOn ? hz.radius : (w ? w.renderDist * 16 : 0);
    A.view.hzK = hzOn && hz.progress ? clamp((hz.progress() - 0.4) / 0.5, 0, 1) : 1;
    const climb = !!(fl && fl.regime === 'climb' && fl.asc), y = climb ? A.mapY(fl.asc.st) : 0;
    if (w) {
      if (climb && y > 800) { if (w.renderDist !== 2) { A.rdBase = w.renderDist; w.renderDist = 2; } }
      else if (A.rdBase && (!climb || y < 600)) { if (w.renderDist === 2) w.renderDist = A.rdBase; A.rdBase = 0; }
    }
    if (r && r.q) { if (climb && y > A.BAND.high) { if (r.q.farCache) { A.fcBase = true; r.q.farCache = false; } } else if (A.fcBase) { r.q.farCache = true; A.fcBase = false; } }
    // the world's clock jumped (a command, a night's sleep, a test): in the climb the state follows the map (its place and
    // map velocity kept — the sky and the ship agree again), in space the state keeps its own time (its offset moves)
    if (fl && fl.asc && fl.regime && fl.regime !== 'air' && !fl.asc.jump) {
      const a = fl.asc, tc = A.clock(fl);
      if (Math.abs(tc + (a.tOff || 0) - a.st.t) > 2) {
        if (climb && a.st.frame === 'herz') { A.toMap(a.st, _mapPos, _mapVel); A.fromMap(a.st, _mapPos.slice(), _mapVel.slice(), tc); a.tOff = 0; }
        else a.tOff = a.st.t - tc;
      }
    }
    // the space programs compiled one a frame from the door on (by 2,500 m all are there: no hitch at the hand-off)
    if (climb && A.precompile.length && VR.SpaceFlight && VR.SpaceFlight.prog && VR.SpaceScene && VR.SpaceScene.state && r && r.gl) VR.SpaceFlight.prog(A.precompile.shift());
    if (fl && fl.asc) {
      if (climb && VR.Entry && VR.Entry.tick) VR.Entry.tick(g, fl, dt);
      if (VR.SpaceFlight && VR.SpaceFlight.fx) VR.SpaceFlight.fx(g, fl);
    }
  };
  // renderer.js, right after its sky pass: space behind the thinning air, Herzwelt beyond the tiles (spaceflight.js)
  A.drawSky = function (r, E, F) {
    const g = A.game;
    if (!E.climb || !g || !VR.SpaceFlight || !VR.SpaceFlight.climbLayers || !VR.SpaceScene || !VR.SpaceScene.state) return;
    VR.SpaceFlight.climbLayers(g, r, E, F.cam);
  };
  // the far plane in the climb: the tiles seen from up here
  const origFar = G.prototype.farFor;
  G.prototype.farFor = function (w, extra) {
    const f = origFar.call(this, w, extra), fl = this.flight;
    return fl && fl.regime === 'climb' && fl.asc ? Math.max(f, Math.hypot((A.view.hzR || 0) + 600, fl.asc.info.alt) + 300) : f;
  };

  // ---------------------------------------------------------------- the regime's edges: hints, the take-off spot, the frame
  A.onRegime = function (fl, from, to) {
    const g = fl.g, a = ascOf(fl);
    if (!g) return;
    if (from === 'air' && to === 'climb') {
      // where a save puts the ship while it is up there: the ground under the door
      const w = g.world, b = fl.b, x = Math.floor(b.pos[0]), z = Math.floor(b.pos[2]);
      a.ground = [x + 0.5, w && w.isLoaded && w.isLoaded(x, z) ? w.topAt(x, z) + 1 : 70, z + 0.5];
      if (!A.hinted && g.ui && g.ui.hint) { A.hinted = true; g.ui.hint(T('g.asc.climbHint'), 7000); }
      A.precompile = ['herz', 'bg', 'giant', 'ring', 'moon', 'glare'];
    }
    if (to === 'space') {
      a.spaceT0 = performance.now(); a.freed = false;
      if (g.ui && g.ui.chatLine) g.ui.chatLine(T('g.asc.space', { v: Math.round(a.info.inertial || 0) }), '#9affd8');
    }
    if (g.renderer && (to === 'space' || from === 'space')) g.renderer.tsrReset = true;
  };

  // ---------------------------------------------------------------- what the HUD and the cockpit read
  if (FL) {
    const origInfo = FL.prototype.info;
    FL.prototype.info = function () {
      const o = origInfo.call(this);
      if (this.regime && this.regime !== 'air' && this.asc) {
        const I = this.asc.info;
        o.speed = this.regime === 'space' ? I.inertial : I.speed; o.alt = I.alt; o.vs = I.vs; o.agl = null; o.regime = this.regime;
      }
      return o;
    };
  }
  if (SP) {
    const origHud = SP.hudText;
    SP.hudText = function () {
      const s = this.pilot, fl = s && s.flight;
      if (!fl || !fl.regime || fl.regime === 'air' || !fl.asc) return origHud.call(this);
      const a = fl.asc, I = a.info, o = A.orbitOf(a.st), base = a.st.frame === 'herz' ? A.DATUM : 0;
      const n0 = (v) => Math.round(v).toLocaleString(VR.I18N && VR.I18N.lang === 'en' ? 'en-US' : 'de-DE');
      const l1 = T('g.asc.hud', { v: n0(fl.regime === 'space' ? I.inertial : I.speed), alt: n0(I.alt), vs: (I.vs >= 0 ? '▲ ' : '▼ ') + Math.abs(I.vs).toFixed(0), g: (I.g || 0).toFixed(1) });
      const l2 = o.e < 1 && o.peri - base > 0 ? T('g.asc.hudOrbit', { ap: n0(o.apo - base), pe: n0(o.peri - base), min: (o.period / 60).toFixed(1) }) : T('g.asc.hudSub');
      const ap = fl.auto && fl.auto.site ? '<br><b style="color:#9affd8">' + T('g.asc.hudAuto', { site: fl.auto.site.name }) + '</b>' : '';
      return `<b>${l1}</b> · ${s.d.meta.name}<br>${l2}${ap}<br><small>${T('g.asc.hudKeys')}</small>`;
    };
    // up there the pilot stays at the controls (the cabin's walk waits for the ground)
    const origLeave = SP.leavePilot;
    SP.leavePilot = function (s) {
      const fl = s && s.flight;
      if (fl && fl.regime && fl.regime !== 'air') { if (this.g.ui && this.g.ui.hint) this.g.ui.hint(T('g.asc.stay'), 2600); return; }
      return origLeave.apply(this, arguments);
    };
    // quitting up there: the ship is parked on the spot it rose from, you step out beside it (the save stays valid)
    const origShut = SP.shutdown;
    SP.shutdown = function () {
      const s = this.pilot, fl = s && s.flight, a = fl && fl.asc;
      if (fl && fl.regime && fl.regime !== 'air' && a && a.ground) {
        const gd = a.ground;
        fl.regime = 'air'; fl.auto = null; a.jump = null;
        s.pos[0] = gd[0]; s.pos[1] = gd[1]; s.pos[2] = gd[2]; s.vel[0] = s.vel[1] = s.vel[2] = 0;
        fl.state = 'landed'; fl.pitch = 0; fl.roll = 0; fl.b.setAttitude(0, 0); fl.orient();
      }
      return origShut.apply(this, arguments);
    };
  }
  // a save in the climb or in space writes the ship and the player at the spot they rose from (the world stays valid)
  const origSave = G.prototype.saveMeta;
  G.prototype.saveMeta = function () {
    const fl = this.flight, a = fl && fl.asc;
    if (!fl || !fl.regime || fl.regime === 'air' || !a || !a.ground || !this.player) return origSave.apply(this, arguments);
    const s = this.starships && this.starships.pilot, p = this.player, sp = s ? s.pos.slice() : null, pp = p.pos;
    const gd = a.ground;
    if (s) { s.pos[0] = gd[0]; s.pos[1] = gd[1]; s.pos[2] = gd[2]; }
    p.pos = [gd[0] + 3, gd[1], gd[2]];
    try { return origSave.apply(this, arguments); } finally { if (s) { s.pos[0] = sp[0]; s.pos[1] = sp[1]; s.pos[2] = sp[2]; } p.pos = pp; }
  };
})(VR);
