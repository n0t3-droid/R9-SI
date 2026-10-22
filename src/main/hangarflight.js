// ============================================================================
// The Gate Temple's shuttles (TRAILER.md shots D and E: t1_10, t1_11, t3_03 the approach, t1_19 the hangar mouth,
// t1_13, t1_16, t1_17 over the pad). t-life (docs/superpowers/plans/2026-10-09-t-life.md §3.1, the owner: "die Shuttles
// verschwinden"): two craft share the Hangar Hall's pad — the hangar's own shuttle and a second one. One stands on the pad
// for 45–90 s (its engines ticking down, two of the hall's ground crew walking out to check a gear leg and an engine, a
// service drone circling); then it lifts, turns on the spot and leaves through the portal, out over the canyon. The other
// one is up there meanwhile, holding in a wide circle at the far end of the canyon's teardrop; it comes back along the
// west side, waits hovering beside the runway until the leaving one is through the mouth, slides onto the runway's axis,
// glides in through the portal and settles. Never two on the pad, never two in the mouth, never a warp flash: a craft is
// drawn whenever it is within 330 blocks of the eye, fading out with the distance, so nothing pops in or out.
// A runtime actor like the sky traffic: no block, no save, no collision, in every world whose Gate Temple stands (vgen ≥ 3).
// When a ship other than the hangar's own stands on the pad, the two land on the runway in front of the portal ('apron').
// Cost: Animierte Anzeigen (settings.anim) off — Very Low — nothing is built, moved or drawn and the hangar's parked
// shuttle stays on its pad; the engines' plumes and the dust only near the eye; the crew from Low up.
// HangarFlight.plan / .at: the single loop (test/t_temple.js); HangarFlight.sched / .between / .stay: the two craft's
// pure schedule on the world's clock (test/life_sched.js); HangarFlight.Actor runs it in the game (hall.js owns it).
// ============================================================================
(function (VR) {
  'use strict';
  const HF = VR.HangarFlight = {};
  const TAU = Math.PI * 2;
  // the temple (TRAILER.md §4, gen_temple.js): the deck and the pad are y 81 (plateau 80 + 1), the portal (the hangar
  // mouth) is the plane z 20, the pad's centre z −10; everything is symmetric about x 0.5 (the middle of block column 0)
  const DECK = 81, MOUTH = 20, PADZ = -10, APRONZ = 38, AX = 0.5;
  HF.DECK = DECK; HF.MOUTH = MOUTH; HF.PADZ = PADZ; HF.APRONZ = APRONZ; HF.AX = AX;
  HF.SCALE = 0.62;            // the shuttle archetype at 0.62: 14.3 m long, 9.3 m span, 5 m tall — through the 13 m mouth
  HF.SEED = 0x5e7a11; HF.PALETTE = 'starforge';   // white hull, orange stripes, blue canopy (the trailer's shuttle)
  HF.RANGE = 120;             // the player within this many blocks of the hangar mouth: the loop runs
  // the air loop, from the mouth (heading south) out over the canyon in a teardrop and back down the runway:
  // [x, y of the hull's underside, z, speed m/s] — high over the canyon's mesas (tops ≤ 106), low over the plaza
  const AIR = [[AX, 85.5, 66, 12], [AX, 93, 110, 20], [AX, 116, 175, 26], [16, 121, 235, 26], [50, 122, 285, 22], [42, 123, 335, 22], [AX, 123, 352, 22], [-40, 122, 330, 22], [-46, 121, 280, 22], [-22, 120, 235, 24], [AX, 117, 185, 22], [AX, 98, 120, 16], [AX, 88, 84, 11], [AX, 85, 62, 9]];
  const ease = { lin: (u) => u, smooth: (u) => u * u * (3 - 2 * u), out2: (u) => 1 - (1 - u) * (1 - u), in2: (u) => u * u };
  const lerp = (a, b, u) => a + (b - a) * u;

  // ---------------------------------------------------------------- a flight track: a centripetal Catmull-Rom spline
  // through [x, y, z, speed] points, sampled into a polyline with times (the speed runs linearly between the key points'
  // speeds); pre / post: the neighbours beyond the ends (the curve's tangents there), else extrapolated
  function track(P, pre, post) {
    const n = P.length, pts = [];
    const at = (i) => i < 0 ? (pre || P[0].map((v, k) => 2 * v - P[1][k])) : i >= n ? (post || P[n - 1].map((v, k) => 2 * v - P[n - 2][k])) : P[i];
    const SEG = 48;
    for (let i = 0; i < n - 1; i++) {
      const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
      const d = (a, b) => Math.pow(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) || 1e-3, 0.5);
      const t0 = 0, t1 = t0 + d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
      for (let k = 0; k < SEG; k++) {
        const t = t1 + (t2 - t1) * k / SEG, q = [];
        for (let c = 0; c < 3; c++) {
          const A1 = (t1 - t) / (t1 - t0) * p0[c] + (t - t0) / (t1 - t0) * p1[c];
          const A2 = (t2 - t) / (t2 - t1) * p1[c] + (t - t1) / (t2 - t1) * p2[c];
          const A3 = (t3 - t) / (t3 - t2) * p2[c] + (t - t2) / (t3 - t2) * p3[c];
          const B1 = (t2 - t) / (t2 - t0) * A1 + (t - t0) / (t2 - t0) * A2;
          const B2 = (t3 - t) / (t3 - t1) * A2 + (t - t1) / (t3 - t1) * A3;
          q.push((t2 - t) / (t2 - t1) * B1 + (t - t1) / (t2 - t1) * B2);
        }
        q.push(lerp(p1[3], p2[3], k / SEG));
        pts.push(q);
      }
    }
    pts.push(P[n - 1].slice());
    // times and distances along the polyline
    const time = [0], dist = [0];
    for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], ds = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); time.push(time[i - 1] + ds / Math.max(0.5, (a[3] + b[3]) * 0.5)); dist.push(dist[i - 1] + ds); }
    return { pts, time, dist, T: time[time.length - 1], L: dist[dist.length - 1] };
  }
  const airTrack = () => track(AIR);
  let AIRT = null;

  // ---------------------------------------------------------------- one loop: the legs on the ground, then the air
  // variant 'hall': in through the mouth to the pad · 'apron': onto the runway in front of the mouth
  HF.plan = function (variant) {
    if (!AIRT) AIRT = airTrack();
    const spot = variant === 'apron' ? APRONZ : PADZ;
    const A0 = AIR[0], AE = AIR[AIR.length - 1];
    const hover = variant === 'apron' ? 84.2 : 84.2, lifted = 83.6;
    const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const inFrom = [AE[0], AE[1], AE[2]], inTo = [AX, hover, spot], outFrom = [AX, lifted, spot], outTo = [A0[0], A0[1], A0[2]];
    const legs = [
      // glide in from the runway, braking evenly to a hover (ease-out: it arrives at the air loop's last speed)
      { name: 'in', T: 2 * dist(inFrom, inTo) / AE[3], from: inFrom, to: inTo, e: 'out2', yaw: [0, 0], gear: [0, 0], thrust: [0.6, 0.35] },
      { name: 'settle', T: 3, from: inTo, to: [AX, DECK, spot], e: 'smooth', yaw: [0, 0], gear: [0, 1], thrust: [0.4, 0.25] },
      { name: 'pad', T: 5, from: [AX, DECK, spot], to: [AX, DECK, spot], e: 'lin', yaw: [0, 0], gear: [1, 1], thrust: [0.18, 0.18] },
      { name: 'lift', T: 2.5, from: [AX, DECK, spot], to: outFrom, e: 'smooth', yaw: [0, 0], gear: [1, 0], thrust: [0.6, 0.45] },
      // a half turn on the spot (the hall is 21 wide, the shuttle's turning circle 17.3)
      { name: 'turn', T: 4, from: outFrom, to: outFrom, e: 'smooth', yaw: [0, Math.PI], gear: [0, 0], thrust: [0.4, 0.4] },
      // out through the mouth, speeding up to the air loop's first speed (ease-in)
      { name: 'out', T: 2 * dist(outFrom, outTo) / A0[3], from: outFrom, to: outTo, e: 'in2', yaw: [Math.PI, Math.PI], gear: [0, 0], thrust: [0.6, 0.9] },
    ];
    let t = 0; for (const L of legs) { L.t0 = t; t += L.T; }
    const ground = t;
    return { variant, legs, ground, air: AIRT, T: ground + AIRT.T };
  };

  // the state at time t (seconds into the loop): pos (the hull's underside, x/z its middle), yaw/pitch/roll, gear,
  // thrust, phase, speed (m/s)
  HF.at = function (plan, t, out) {
    const o = out || {};
    t = ((t % plan.T) + plan.T) % plan.T;
    if (!o.pos) o.pos = [0, 0, 0];
    if (t < plan.ground) {
      let L = plan.legs[0]; for (const l of plan.legs) if (t >= l.t0) L = l;
      const u = Math.min(1, (t - L.t0) / L.T), k = ease[L.e](u);
      o.pos[0] = lerp(L.from[0], L.to[0], k); o.pos[1] = lerp(L.from[1], L.to[1], k); o.pos[2] = lerp(L.from[2], L.to[2], k);
      const ku = ease.smooth(u);
      o.yaw = lerp(L.yaw[0], L.yaw[1], ku); o.gear = lerp(L.gear[0], L.gear[1], ku); o.thrust = lerp(L.thrust[0], L.thrust[1], u);
      o.roll = 0; o.phase = L.name;
      // nose up while braking in (the flare), level on the pad
      o.pitch = L.name === 'in' ? 0.12 * (1 - u) * (1 - u) : L.name === 'out' ? -0.04 * u : 0;
      const e2 = 1e-3, k2 = ease[L.e](Math.min(1, u + e2 / L.T)), d = Math.hypot(L.to[0] - L.from[0], L.to[1] - L.from[1], L.to[2] - L.from[2]);
      o.speed = d * Math.abs(k2 - k) / e2;
      return o;
    }
    // in the air
    const A = plan.air, ta = t - plan.ground;
    let lo = 0, hi = A.time.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (A.time[m] <= ta) lo = m; else hi = m; }
    const a = A.pts[lo], b = A.pts[hi], u = (ta - A.time[lo]) / Math.max(1e-6, A.time[hi] - A.time[lo]);
    o.pos[0] = lerp(a[0], b[0], u); o.pos[1] = lerp(a[1], b[1], u); o.pos[2] = lerp(a[2], b[2], u);
    o.speed = lerp(a[3], b[3], u);
    // heading and slope from the neighbouring samples, the bank from how fast the heading turns
    const i0 = Math.max(0, lo - 2), i1 = Math.min(A.pts.length - 1, hi + 2), p = A.pts[i0], q = A.pts[i1];
    const dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2], dh = Math.hypot(dx, dz) || 1e-6;
    o.yaw = Math.atan2(-dx, -dz);
    o.pitch = Math.max(-0.3, Math.min(0.3, Math.atan2(dy, dh) * 0.8));
    const j0 = Math.max(0, lo - 6), j1 = Math.min(A.pts.length - 1, hi + 6);
    const yA = Math.atan2(-(A.pts[i0][0] - A.pts[j0][0]), -(A.pts[i0][2] - A.pts[j0][2])), yB = Math.atan2(-(A.pts[j1][0] - A.pts[i1][0]), -(A.pts[j1][2] - A.pts[i1][2]));
    let dyaw = yB - yA; while (dyaw > Math.PI) dyaw -= TAU; while (dyaw < -Math.PI) dyaw += TAU;
    const dtw = Math.max(1e-3, A.time[j1] - A.time[j0]);
    o.roll = Math.max(-0.7, Math.min(0.7, dyaw / dtw * 1.1));
    o.gear = 0; o.thrust = 0.85; o.phase = 'air';
    return o;
  };

  // ================================================================ two craft share the pad (t-life)
  // Visit n (by craft n & 1) touches down at T_n and stays S_n = 45 … 90 s; the next visit touches down GAPH seconds after
  // this one lifts: its lift (2.5 s), turn (4 s) and run out through the mouth (12.7 s) to the loop's start, a second's
  // margin, then the other craft's slide off its waiting point beside the runway (3 s), its glide in (9 s), its settle (3 s).
  // Between two of its visits a craft flies the loop's outbound half to the teardrop's far tip, holds there in whole
  // circles, flies the inbound track down the west side of the canyon to its waiting point and hovers there until its slide.
  const hh = (a, b) => { let x = Math.imul((a | 0) ^ 0x6b43a9b5, 0x2c1b3c6d) ^ Math.imul((b | 0) + 0x632be5ab, 0x297a2d39); x ^= x >>> 15; x = Math.imul(x, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
  HF.STAY0 = 45; HF.STAY1 = 90;
  HF.stay = (n) => HF.STAY0 + (HF.STAY1 - HF.STAY0) * hh(n, 0x5a7);
  const LIFTED = 83.6, HOVER = 84.2, LIFT_T = 2.5, TURN_T = 4, SLIDE_T = 3, GLIDE_T = 9, SETTLE_T = 3, MARGIN = 1, ORB_R = 40, ORB_V = 22, IB_BRAKE = 1.6;
  const OUT_FROM = (spot) => [AX, LIFTED, spot];
  const OUT_T = 2 * Math.hypot(AIR[0][0] - AX, AIR[0][1] - LIFTED, AIR[0][2] - PADZ) / AIR[0][3];
  const G_OUT = LIFT_T + TURN_T + OUT_T;            // from the lift to the loop's start (A0)
  HF.GAPH = G_OUT + MARGIN + SLIDE_T + GLIDE_T + SETTLE_T;
  // the waiting point beside the runway (west of the axis, over the plaza) and the runway's axis where the glide starts
  const WAIT = [-18, 90, 52], X0 = [AX, 85, 46];
  HF.WAIT = WAIT;
  // the inbound track: from the teardrop's tip down the west side of the canyon (clear of the outbound, which climbs along
  // the axis and swings east) to the waiting point
  const INB = [AIR[6], AIR[7], AIR[8], AIR[9], [-20, 117, 185, 22], [-18, 101, 120, 18], [-17, 93, 82, 12], [WAIT[0], WAIT[1], WAIT[2], 6]];
  let TR = null;
  // the pure parts, built once: the outbound track (A0 → the tip), the hold circle at the tip, the inbound path
  HF.tracks = function () {
    if (TR) return TR;
    const ob = track(AIR.slice(0, 7), null, AIR[7]), ib = track(INB, AIR[5], null);
    // the circle: tangent to the outbound track at the tip, turning the way the teardrop turns next
    const n = ob.pts.length, tip = ob.pts[n - 1], q = ob.pts[n - 4], hx = tip[0] - q[0], hz = tip[2] - q[2], hl = Math.hypot(hx, hz) || 1;
    const hd = [hx / hl, hz / hl], nx = ib.pts[8][0] - tip[0], nz = ib.pts[8][2] - tip[2];
    // the centre lies on the side the inbound track bends to
    let perp = [-hd[1], hd[0]]; if (perp[0] * nx + perp[1] * nz < 0) perp = [hd[1], -hd[0]];
    const C = [tip[0] + perp[0] * ORB_R, tip[1], tip[2] + perp[1] * ORB_R];
    const a = [(tip[0] - C[0]) / ORB_R, (tip[2] - C[2]) / ORB_R];
    const turn = (hd[0] * a[1] - hd[1] * a[0]) >= 0 ? 1 : -1;   // the sense of the turn (its bank)
    TR = { ob, ib, orb: { C, a, hd, P: TAU * ORB_R / ORB_V, turn }, Tib: (() => { const VC = ORB_V, db = VC * VC / (2 * IB_BRAKE); return Math.max(0, ib.L - db) / VC + VC / IB_BRAKE; })() };
    return TR;
  };
  // the visit whose touchdown is the latest at clock t: {n, T}. A cache object walks forward or back from the last answer
  HF.T0 = 17;
  HF.visitAt = function (t, c) {
    if (!c) c = { n: 0, T: HF.T0 };
    let n = c.n, T = c.T;
    for (let k = 0; k < 400000; k++) { const T1 = T + HF.stay(n) + HF.GAPH; if (t >= T1) { T = T1; n++; } else break; }
    for (let k = 0; k < 400000; k++) { if (t < T) { n--; T = T - HF.stay(n) - HF.GAPH; } else break; }
    c.n = n; c.T = T;
    return c;
  };
  const sm = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
  // a point along a track's polyline by time (its own speeds) or by distance; o.pos, o.yaw, o.pitch, o.speed, o.roll
  const onTrack = (A, ta, o, byDist) => {
    const key = byDist ? A.dist : A.time;
    let lo = 0, hi = key.length - 1;
    ta = Math.max(0, Math.min(key[hi], ta));
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (key[m] <= ta) lo = m; else hi = m; }
    const a = A.pts[lo], b = A.pts[hi], u = (ta - key[lo]) / Math.max(1e-6, key[hi] - key[lo]);
    o.pos[0] = lerp(a[0], b[0], u); o.pos[1] = lerp(a[1], b[1], u); o.pos[2] = lerp(a[2], b[2], u);
    if (!byDist) o.speed = lerp(a[3], b[3], u);
    const i0 = Math.max(0, lo - 2), i1 = Math.min(A.pts.length - 1, hi + 2), p = A.pts[i0], q = A.pts[i1];
    const dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2], dh = Math.hypot(dx, dz) || 1e-6;
    o.yaw = Math.atan2(-dx, -dz);
    o.pitch = Math.max(-0.3, Math.min(0.3, Math.atan2(dy, dh) * 0.8));
    const j0 = Math.max(0, lo - 6), j1 = Math.min(A.pts.length - 1, hi + 6);
    const yA = Math.atan2(-(A.pts[i0][0] - A.pts[j0][0]), -(A.pts[i0][2] - A.pts[j0][2])), yB = Math.atan2(-(A.pts[j1][0] - A.pts[i1][0]), -(A.pts[j1][2] - A.pts[i1][2]));
    let dyaw = yB - yA; while (dyaw > Math.PI) dyaw -= TAU; while (dyaw < -Math.PI) dyaw += TAU;
    const len = Math.max(1e-3, A.dist[j1] - A.dist[j0]);
    o.roll = Math.max(-0.7, Math.min(0.7, dyaw / len * (o.speed || 15) * 1.1));
    return o;
  };
  // the pose of a craft that lifted off its spot at L0 and touches down there again at T2 (both clock seconds), at clock t
  // (L0 ≤ t < T2): phase lift · turn · out · air (outbound) · hold (the circle) · inbound · wait · slide · in · settle
  HF.between = function (L0, T2, t, o, spot) {
    const R = HF.tracks(), z = spot === undefined ? PADZ : spot;
    o = o || {}; if (!o.pos) o.pos = [0, 0, 0];
    o.roll = 0; o.pitch = 0; o.speed = 0;
    const tau = t - L0, Tob = R.ob.T, Tib = R.Tib, slide0 = T2 - SLIDE_T - GLIDE_T - SETTLE_T;
    const avail = slide0 - (L0 + G_OUT + Tob) - Tib, laps = Math.max(0, Math.floor((avail - 4) / R.orb.P)), hold = laps * R.orb.P;
    const tOb = L0 + G_OUT, tHold = tOb + Tob, tIb = tHold + hold, tWait = tIb + Tib;
    const set = (x, y, zz) => { o.pos[0] = x; o.pos[1] = y; o.pos[2] = zz; };
    if (tau < LIFT_T) { const u = sm(tau / LIFT_T); set(AX, lerp(DECK, LIFTED, u), z); o.phase = 'lift'; o.yaw = 0; o.gear = 1 - u; o.thrust = lerp(0.6, 0.45, u); return o; }
    if (tau < LIFT_T + TURN_T) { const u = sm((tau - LIFT_T) / TURN_T); set(AX, LIFTED, z); o.phase = 'turn'; o.yaw = Math.PI * u; o.gear = 0; o.thrust = 0.4; return o; }
    if (t < tOb) {
      const u = (tau - LIFT_T - TURN_T) / OUT_T, k = u * u, F = OUT_FROM(z), A0 = AIR[0], d = Math.hypot(A0[0] - F[0], A0[1] - F[1], A0[2] - F[2]);
      set(lerp(F[0], A0[0], k), lerp(F[1], A0[1], k), lerp(F[2], A0[2], k));
      o.phase = 'out'; o.yaw = Math.PI; o.gear = 0; o.thrust = lerp(0.6, 0.9, u); o.pitch = -0.04 * u; o.speed = 2 * d * u / OUT_T; return o;
    }
    if (t < tHold) { onTrack(R.ob, t - tOb, o, false); o.phase = 'air'; o.gear = 0; o.thrust = 0.85; return o; }
    if (t < tIb) {
      const B = R.orb, th = ((t - tHold) / B.P) * TAU, c = Math.cos(th), s = Math.sin(th);
      set(B.C[0] + ORB_R * (c * B.a[0] + s * B.hd[0]), B.C[1] + Math.sin(th * 2) * 1.5, B.C[2] + ORB_R * (c * B.a[1] + s * B.hd[1]));
      const vx = -s * B.a[0] + c * B.hd[0], vz = -s * B.a[1] + c * B.hd[1];
      o.phase = 'hold'; o.yaw = Math.atan2(-vx, -vz); o.roll = -0.5 * B.turn; o.gear = 0; o.thrust = 0.8; o.speed = ORB_V; return o;
    }
    if (t < tWait) {
      // braking along the inbound track: a cruise at the circle's speed, then a steady braking to the waiting point
      const tt = t - tIb, VC = ORB_V, tb = VC / IB_BRAKE, t1 = Tib - tb;
      const dd = tt <= t1 ? VC * tt : VC * t1 + VC * (tt - t1) - IB_BRAKE * (tt - t1) * (tt - t1) / 2;
      onTrack(R.ib, dd, o, true); o.speed = tt <= t1 ? VC : Math.max(0, VC - IB_BRAKE * (tt - t1));
      o.phase = 'inbound'; o.gear = 0; o.thrust = 0.6 + 0.25 * Math.min(1, o.speed / VC); return o;
    }
    if (t < slide0) {
      set(WAIT[0], WAIT[1] + Math.sin((t - tWait) * 1.1) * 0.35, WAIT[2]);
      onTrack(R.ib, R.ib.L, { pos: [0, 0, 0] }, true);
      o.phase = 'wait'; o.yaw = 0; o.gear = 0; o.thrust = 0.5; return o;
    }
    if (t < slide0 + SLIDE_T) { const u = sm((t - slide0) / SLIDE_T); set(lerp(WAIT[0], X0[0], u), lerp(WAIT[1], X0[1], u), lerp(WAIT[2], X0[2], u)); o.phase = 'slide'; o.yaw = 0; o.gear = 0; o.thrust = 0.55; o.roll = 0.12 * Math.sin(Math.PI * u); return o; }
    if (t < T2 - SETTLE_T) {
      const u = (t - slide0 - SLIDE_T) / GLIDE_T, k = sm(u);
      set(AX, lerp(X0[1], HOVER, k), lerp(X0[2], z, k));
      o.phase = 'in'; o.yaw = 0; o.gear = 0; o.thrust = lerp(0.6, 0.35, u); o.pitch = 0.1 * Math.sin(Math.PI * u) * (u > 0.5 ? 1 : 0.3); o.speed = Math.abs(X0[2] - z) * 6 * u * (1 - u) / GLIDE_T; return o;
    }
    const u = sm((t - (T2 - SETTLE_T)) / SETTLE_T);
    set(AX, lerp(HOVER, DECK, u), z); o.phase = 'settle'; o.yaw = 0; o.gear = u; o.thrust = lerp(0.4, 0.25, u);
    return o;
  };
  // both craft at clock t: [{c (0 the hangar's own, 1 the second), n (its visit), phase, pos, yaw, pitch, roll, gear,
  // thrust, speed, u (seconds on the pad), S (the stay)}, …]; cache: a visitAt cache; spot: the pad's z (or the apron's)
  HF.sched = function (t, cache, outs, spot, into) {
    const c = HF.visitAt(t, cache || { n: 0, T: HF.T0 }), n = c.n, T = c.T, S = HF.stay(n), L = T + S, z = spot === undefined ? PADZ : spot;
    const res = into || []; res.length = 0;
    // the one whose visit it is: on the pad, or (lifted) on its way to visit n + 2
    const a = (outs && outs[n & 1]) || { pos: [0, 0, 0] };
    if (t < L) { a.pos[0] = AX; a.pos[1] = DECK; a.pos[2] = z; a.phase = 'pad'; a.yaw = 0; a.pitch = 0; a.roll = 0; a.gear = 1; a.speed = 0; a.u = t - T; a.S = S; a.thrust = a.u < 12 ? 0.25 * (1 - a.u / 12) : a.u > S - 3 ? 0.3 * (a.u - (S - 3)) / 3 : 0; }
    else { const T1 = L + HF.GAPH, T2 = T1 + HF.stay(n + 1) + HF.GAPH; HF.between(L, T2, t, a, z); a.u = -1; a.S = S; }
    a.c = n & 1; a.n = n; res.push(a);
    // the other one: lifted after visit n − 1, it touches down for visit n + 1
    const b = (outs && outs[(n + 1) & 1]) || { pos: [0, 0, 0] };
    const Lm = T - HF.GAPH, T1 = L + HF.GAPH;
    HF.between(Lm, T1, t, b, z); b.u = -1; b.S = HF.stay(n + 1); b.c = (n + 1) & 1; b.n = n + 1; res.push(b);
    return res;
  };

  // ---------------------------------------------------------------- in the game
  const wrapA = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
  HF.FADE0 = 250; HF.FADE1 = 330;   // drawn faded between these distances from the eye: nothing pops in or out
  HF.ON = 360; HF.OFF = 380;        // the eye within ON of the mouth: the schedule runs (the parked shuttle is out); past OFF it rests
  HF.PALS = [HF.PALETTE, null]; HF.SEEDS = [HF.SEED, 0x2b9f17];
  HF.Actor = class {
    constructor(game) {
      this.g = game; this.variant = null; this.active = false; this.st = {};
      const E = game.env;
      this.clock = E ? ((E.day || 0) * 24000 + (E.ticks || 0)) / 20 : 0;   // the world's clock (as the trams'): every guest sees the same
      this.cache = { n: 0, T: HF.T0 };
      this.crafts = [0, 1].map(c => ({ c, d: null, on: false, alpha: 0, tid: 'hf' + c + ':' + (Math.random() * 1e9 | 0), q: { pos: [0, 0, 0] }, inst: { d: null, pos: [AX, 120, 300], yaw: 0, pitch: 0, roll: 0, gear: 0, scale: HF.SCALE, hatch: { ramp: 0, door: 0, cdoor: 0 } }, crew: null, folk: [], drone: { pos: [0, 0, 0], yaw: 0 } }));
      this.hidden = null;      // the hangar's parked shuttle while the two are flying (it is one of them)
      this.seenT = 0; this.templeOK = false; this.fadeIn = 1; this.draws = 0; this.tier = 2;
      // (compatibility with the single loop's readers: the hangar's own craft is inst / d / st / t / plan)
      this.inst = this.crafts[0].inst; this.d = null; this.t = 0; this.plan = null;
    }
    // the Gate Temple stands here: its portal veil fills the mouth's foot (any world whose Heartland was generated)
    templeHere() {
      const w = this.g.world, R = VR.R; if (!w || !R) return false;
      const b = w.getBlock(0, DECK, MOUTH), t = R.byName.portal_veil;
      return !!(b && t && R.T.type[b] === t.id);
    }
    want() {
      const g = this.g, pl = g.player;
      if (g.state !== 'play' || !VR.DimReg.actorsHome(g.dim || 'overworld') || !pl || !g.starships) return false;   // u-moons1: the actors live where the registry says (DimReg.actorsHome: Herzwelt only, never on a moon)
      if (g.settings && g.settings.anim === false) return false;
      const d = Math.hypot(pl.pos[0] - AX, pl.pos[2] - MOUTH);
      return this.active ? d < HF.OFF : d < HF.ON;
    }
    // the hangar's own shuttle, parked on the pad and not flown by anyone
    homeShip() {
      const SS = this.g.starships; if (!SS) return null;
      for (const s of SS.ships) if (s.hangar && s !== SS.pilot && s.state === 'parked' && Math.abs(s.pos[0]) < 3 && Math.abs(s.pos[2] - PADZ) < 3 && Math.abs(s.pos[1] - DECK) < 2) return s;
      return null;
    }
    // another ship stands on the pad (an older world's pad ship, a player's ship): the two land on the apron
    padTaken(home) {
      const SS = this.g.starships; if (!SS) return false;
      for (const s of SS.ships) if (s !== home && s.state === 'parked' && Math.abs(s.pos[0] - AX) < 12 && Math.abs(s.pos[2] - PADZ) < 16 && Math.abs(s.pos[1] - DECK) < 6) return true;
      return false;
    }
    hideHome(on) {
      if (on) { const s = this.homeShip(); if (s && s !== this.hidden) { this.showHome(); s.hidden = true; this.hidden = s; } }
      else this.showHome();
    }
    showHome() {
      const s = this.hidden; if (!s) return;
      // never pop the parked shuttle back over the player's head (it is solid): wait until they stepped off the pad
      const pl = this.g.player, hb = s.hitbox ? s.hitbox() : null;
      if (pl && hb && pl.pos[0] > hb[0] - 0.5 && pl.pos[0] < hb[3] + 0.5 && pl.pos[2] > hb[2] - 0.5 && pl.pos[2] < hb[5] + 0.5 && pl.pos[1] < hb[4] + 1 && pl.pos[1] > hb[1] - 2) return;
      s.hidden = false; this.hidden = null;
    }
    // where the two land: on the pad when it is free (the hangar's own parked shuttle is one of them), else on the runway
    choose() { this.variant = this.padTaken(this.hidden || this.homeShip()) ? 'apron' : 'hall'; this.spot = this.variant === 'apron' ? APRONZ : PADZ; this.plan = this.compatPlan(); }
    update(dt) {
      const g = this.g;
      this.clock += dt;
      if (!this.want()) { if (this.active) for (const C of this.crafts) C.on = false; this.active = false; this.showHome(); return; }
      // the temple check is cheap but needs the mouth's chunk; look again every 2 s (once seen it stands)
      if ((this.seenT -= dt) <= 0) { this.seenT = 2; if (!this.templeOK) { this.templeOK = this.templeHere(); if (this.templeOK && this.started) this.fadeIn = 0; } }
      if (!this.templeOK) { this.active = false; this.showHome(); return; }
      const SS = g.starships;
      this.tier = VR.LifeKit ? VR.LifeKit.tierOf(g.settings) : 2;
      if (!this.active) { this.active = true; this.started = true; this.choose(); this.variantT = 5; }
      if ((this.variantT -= dt) <= 0) { this.variantT = 5; const was = this.variant; this.choose(); if (was !== this.variant) for (const C of this.crafts) this.flush(C); }
      this.fadeIn = Math.min(1, this.fadeIn + dt / 2);
      this.hideHome(this.variant === 'hall');
      const outs = this.outs || (this.outs = this.crafts.map(C => C.q)), list = HF.sched(this.clock, this.cache, outs, this.spot, this.list || (this.list = [])), pl = g.player.pos;
      for (const s of list) {
        const C = this.crafts[s.c];
        if (!C.d || !SS.designs.has(C.d.key)) { C.d = SS.design(HF.SEEDS[C.c], 'shuttle', HF.PALS[C.c]); C.inst.d = C.d; }
        C.d.last = performance.now();
        const I = C.inst, k = C.snap ? 1 : 1 - Math.exp(-dt * 5); C.snap = false;
        I.pos[0] = s.pos[0]; I.pos[1] = s.pos[1]; I.pos[2] = s.pos[2]; I.gear = s.gear;
        I.yaw += wrapA(s.yaw - I.yaw) * k; I.pitch += (s.pitch - I.pitch) * k; I.roll += (s.roll - I.roll) * k;
        const dist = Math.hypot(I.pos[0] - pl[0], I.pos[1] - pl[1], I.pos[2] - pl[2]);
        C.dist = dist; C.alpha = this.fadeIn * (1 - sm((dist - HF.FADE0) / (HF.FADE1 - HF.FADE0)));
        C.on = C.alpha > 0.01; C.phase = s.phase;
        this.crew(C, s, dist);
        if (C.on) this.fx(C, s, dt);
      }
      // (the single loop's readers: the hangar's own craft)
      const c0 = this.crafts[0]; this.d = c0.d; this.st = c0.q; this.t = this.plan ? this.clock - this.plan.ref : 0;
    }
    // the hall's ground crew round a parked craft (two technicians from the console side, a gear leg and an engine), the
    // service drone — Low and up, near the eye
    crew(C, s, dist) {
      C.crewOn = false; C.droneOn = false;
      const PL = VR.PadLife, LK = VR.LifeKit, m = C.d && C.d.meta;
      if (!PL || !LK || !m || s.phase !== 'pad' || this.tier < 1 || dist > 80) return;
      if (!C.G || C.Gd !== C.d) {
        C.G = PL.geom(m, HF.SCALE, C.d.occ); C.Gd = C.d;
        // the technicians come in from the back door (the corridor; at the apron: out of the portal): parked, the craft
        // faces −z (yaw 0), so they come from ahead of its nose and walk round its side
        const svc = [0, (this.spot === APRONZ ? MOUTH + 2 : -36) - this.spot];
        C.plans = [0, 1].map(k => PL.crewPlan(HF.SEEDS[C.c] + k, s.n, C.G, svc));
      }
      const plan = C.plans[s.n & 1];
      C.crew = PL.crew(HF.SEEDS[C.c], s.n, s.u, s.S, C.G, plan, C.crew || []);
      for (let i = 0; i < C.crew.length; i++) {
        const o = C.crew[i], f = C.folk[i] || (C.folk[i] = { look: LK.folk(HF.SEEDS[C.c] * 7 + i * 7919, 'operator', 'adult'), pos: [0, 0, 0], yaw: 0, seed: i * 1.3 });
        f.on = o.on; if (!f.on) continue;
        PL.toWorld(C.inst.pos, 0, o.pos, f.pos); f.yaw = o.yaw; f.state = o.state; f.walk = o.walk; f.walkAmt = o.walkAmt; f.talking = o.talking;
        C.crewOn = true;
      }
      const D = PL.drone(HF.SEEDS[C.c], s.n, s.u, s.S, C.G, C.drone);
      C.droneOn = D.on; if (D.on) { C.dronePos = PL.toWorld(C.inst.pos, 0, D.pos, C.dronePos); C.droneYaw = D.yaw; }
    }
    flush(C) { const T = this.g.trails; if (T && T.map) for (const k of [...T.map.keys()]) if (String(k).startsWith(C.tid)) T.map.delete(k); C.snap = true; }
    // ship-local metres (the design's own) → world, through the scale and the angles
    toWorld(l, I) {
      I = I || this.inst;
      const S = HF.SCALE, cy = Math.cos(I.yaw), sy = Math.sin(I.yaw), cp = Math.cos(I.pitch), sp = Math.sin(I.pitch), cr = Math.cos(I.roll), sr = Math.sin(I.roll);
      // roll about z, then pitch about x, then yaw about y (starships.js rotOf: rotY · rotX · rotZ)
      let x = l[0] * S, y = l[1] * S, z = l[2] * S;
      let x1 = x * cr - y * sr, y1 = x * sr + y * cr, z1 = z;
      let y2 = y1 * cp - z1 * sp, z2 = y1 * sp + z1 * cp, x2 = x1;
      return [I.pos[0] + x2 * cy + z2 * sy, I.pos[1] + y2, I.pos[2] - x2 * sy + z2 * cy];
    }
    // thrusters (the engine plumes of the sky traffic), lift jets under the hull and dust off the deck while it is low
    fx(C, s, dt) {
      const g = this.g, m = C.d && C.d.meta, I = C.inst;
      if (!m || C.dist > 260 || C.alpha < 0.3) return;
      // in the air the engines burn long and blue-white (t1_10, t3_03); hovering, a short orange glow; on the pad they cool
      const air = s.phase === 'air' || s.phase === 'out' || s.phase === 'hold' || s.phase === 'inbound';
      if (g.trails && s.thrust > 0.01) for (let ei = 0; ei < m.exhaust.length; ei++) { const e = m.exhaust[ei]; g.trails.engine(C.tid + ei, this.toWorld([e[0], e[1], e[2] + 0.3], I), s.speed || 0, { thrust: air ? 1 : s.thrust, size: e[3] * HF.SCALE * (air ? 2.2 : 1.25), col: air ? [0.45, 0.75, 1] : [1, 0.68, 0.32], minor: ei > 1, smokeLife: 4, minSmoke: 14 }); }
      if (!g.particles || C.dist > 120) return;
      const low = s.pos[1] - DECK, P = g.particles;
      // lift jets: two hot cones under the hull while it hovers, settles and lifts
      if (!air && s.phase !== 'pad' && Math.random() < 0.8) for (const lx of [-3, 3]) for (const lz of [-3, 4]) {
        const w = this.toWorld([lx, 0.2, lz], I);
        P.spawn(w[0] + (Math.random() - 0.5) * 0.4, w[1], w[2] + (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.6, -6 - Math.random() * 4, (Math.random() - 0.5) * 0.6, { life: 0.18 + Math.random() * 0.12, size: 0.35 + Math.random() * 0.25, grav: 0, col: [1, 0.72, 0.36], emis: 1, drag: 2, grow: 1.2, collide: false });
      }
      // dust (or the hangar's haze) blown off the deck under it — outdoors warm grey, in the hall a cool haze
      const inHall = s.pos[2] < MOUTH;
      if (low < 7 && Math.abs(s.pos[0] - AX) < 14 && s.phase !== 'pad' && Math.random() < (inHall ? 0.4 : 0.6)) {
        const col = inHall ? [0.58, 0.66, 0.76] : [0.66, 0.6, 0.52], n = inHall ? 2 : 3;
        for (let k = 0; k < n; k++) {
          const a = Math.random() * TAU, r = 2 + Math.random() * 3, sp = 2.5 + (7 - low) * 0.6;
          P.spawn(s.pos[0] + Math.cos(a) * r, DECK + 0.15, s.pos[2] + Math.sin(a) * r, Math.cos(a) * sp, 0.15 + Math.random() * 0.35, Math.sin(a) * sp, { life: (inHall ? 0.6 : 0.9) + Math.random() * 0.6, size: (inHall ? 0.22 : 0.3) + Math.random() * (inHall ? 0.2 : 0.3), grav: -0.1, col, emis: 0, drag: 1.4, grow: inHall ? 1.0 : 1.6, collide: false });
        }
      }
      void dt;
    }
    draw(r, E, layer) {
      const g = this.g, SS = g.starships;
      if (!this.active || !SS) return;
      const cam = r.cam;
      let prog = null;
      for (const C of this.crafts) {
        const d = C.d, I = C.inst;
        if (!C.on || !d || !d.gpu) continue;
        const m = d.meta, rad = Math.max(m.length, m.width, m.height) * 0.6 * HF.SCALE;
        const dx = I.pos[0] - cam.x, dy = I.pos[1] + m.height * 0.5 * HF.SCALE - cam.y, dz = I.pos[2] - cam.z;
        if (!VR.mat4.boxInFrustum(r.planes, dx - rad, dy - rad, dz - rad, dx + rad, dy + rad, dz + rad)) continue;
        const light = SS.lightAt(I.pos[0], I.pos[1] + m.height * HF.SCALE + 1, I.pos[2]);
        if (C.alpha >= 0.99) {
          if (layer !== 'opaque' && !d.gpu.glass) continue;
          if (!prog) prog = SS.begin(r, E, layer);
          if (prog.u.u_clipNear) r.gl.uniform1f(prog.u.u_clipNear, 0);
          const far = C.dist > 40;   // (the stand-in seats and the cabin inside the closed hull: not beyond 40 blocks)
          SS.drawOne(r, prog, I, cam, layer, light, 1, false, layer === 'opaque' && far, far);
          this.draws++;
        } else if (layer !== 'opaque' && SS.drawAlpha) {
          if (prog) { SS.end(r, layer); prog = null; }
          SS.drawAlpha(r, E, I, cam, C.alpha, light);
          this.draws++;
        }
      }
      if (prog) SS.end(r, layer);
      if (layer === 'opaque') this.drawCrew(r, E, cam);
    }
    // the ground crew and the drone (the villagers' vox program)
    drawCrew(r, E, cam) {
      const g = this.g, ent = g.entities, LK = VR.LifeKit; if (!ent || !LK) return;
      let p = null;
      const t = g.time || 0, pose = this.dronePose || (this.dronePose = { rotor_l: [0, 0, 0], rotor_r: [0, 0, 0] });
      pose.rotor_l[1] = t * 30; pose.rotor_r[1] = -t * 30;
      for (const C of this.crafts) {
        if (C.crewOn) for (const f of C.folk) { if (!f.on) continue; if (!p) p = ent.beginVox(r, E); LK.drawFolk(g, r, p, f, cam, t); }
        if (C.droneOn) { if (!p) p = ent.beginVox(r, E); LK.drawModel(g, r, p, 'hover_drone', C.dronePos, C.droneYaw, cam, { pose }); }
      }
    }
    // the single loop's view of the hangar's own craft (the picture tests and a camera director address its legs): its
    // visit around the clock, as legs in, settle, pad, lift, turn, out and the air (the rest of its round) from ref
    compatPlan() {
      let c = HF.visitAt(this.clock, { n: this.cache.n, T: this.cache.T });
      if (c.n & 1) c = HF.visitAt(c.T + HF.stay(c.n) + HF.GAPH + 0.01, { n: c.n, T: c.T });   // the hangar's own: the even visits
      const n = c.n, T = c.T, S = HF.stay(n), ref = T - SETTLE_T - GLIDE_T;
      const legs = [['in', GLIDE_T], ['settle', SETTLE_T], ['pad', S], ['lift', LIFT_T], ['turn', TURN_T], ['out', OUT_T]];
      let t0 = 0; const L = legs.map(([name, Tl]) => { const o = { name, t0, T: Tl }; t0 += Tl; return o; });
      const T2 = T + S + HF.GAPH + HF.stay(n + 1) + HF.GAPH;
      const self = this;
      return { variant: this.variant, legs: L, ground: t0, ref, T: T2 - SETTLE_T - GLIDE_T - ref, air: { T: T2 - SETTLE_T - GLIDE_T - ref - t0 }, sched: (tt, out) => { const s = HF.sched(ref + tt, { n, T }, null, self.spot); return Object.assign(out || {}, s.find(q => q.c === 0)); } };
    }
    // put the hangar's own craft at time t of its compat plan (its legs from ref); the angles snap there, the plumes restart
    jump(t) {
      if (!this.plan) this.choose();
      this.clock = this.plan.ref + t;
      for (const C of this.crafts) this.flush(C);
    }
    // put the schedule at a phase of the hangar's own craft: 'pad' (12 s into its stay: the crew out), 'in', 'hold' …
    jumpPhase(phase, at) {
      if (!this.plan) this.choose();
      const L = this.plan.legs.find(l => l.name === phase);
      if (L) return this.jump(L.t0 + L.T * (at === undefined ? (phase === 'pad' ? Math.min(0.5, 24 / L.T) : 0.5) : at));
      return this.jump(this.plan.ground + this.plan.air.T * (at === undefined ? 0.5 : at));
    }
    destroy() { this.showHome(); this.active = false; }
  };
  // (the single loop's at() reads a compat plan through the schedule)
  const at0 = HF.at;
  HF.at = function (plan, t, out) { return plan && plan.sched ? plan.sched(t, out) : at0(plan, t, out); };
})(VR);
