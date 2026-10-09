// ============================================================================
// Ships that stay (t-life, docs/superpowers/plans/2026-10-09-t-life.md §3.1). The owner: "ich finde es doof, dass die
// Shuttles ingame verschwinden". A pad is now a schedule, not a flash: a craft comes in from the horizon, waits beside
// the pad while the one before it is still parked, slides over, settles, and stays 60–180 s — its engines cooling (the
// plume dies down, a thin vapour, the metal ticks), the ramp down, a crew of 2–3 in flight clothes walking out, talking,
// checking the gear and an engine, a service drone circling — then the crew walks back, the ramp closes, it lifts, turns
// and climbs away to the horizon, fading in the haze. The next craft is already holding when one lifts: the pad is never
// empty for more than 10 s, at least 85 % of any ten minutes occupied. No warp flash anywhere: a craft appears and goes
// 980 blocks from its pad (fading over its first and last 5 %), and a pad is drawn only while the eye is within 620
// of it: a craft fades in and out ≥ 300 blocks from the eye.
//   Pads: the Gate Temple's apron (in front of the portal), and every pad where a world ship is parked (outposts, tech
//   villages): there the parked ship gets a ground crew and the drone (it is the player's ship: it never leaves), and
//   visitors use the pad only while it is free. A craft with a ramp (the shuttles) brings its own crew down the ramp; a
//   craft without one (dropship, freighter) is met by two of the pad's ground crew walking out from behind it (at the
//   apron: out of the portal).
//   Flight: the approach and the departure are flown along their curves by distance (a cruise at ≤ 30 m/s, a steady
//   braking to the hold point; a departure that leaves at 5 m/s and accelerates at 3 m/s², clear of the pad before the
//   next craft slides over).
//   The schedule is pure (PL.visitAt, PL.pose, PL.crew, PL.drone: test/life_sched.js) and runs on the world's clock (the
//   trams' clock: the world time at the start, then real seconds), so every guest sees the same visit.
//   Cost: tier 0 (Very Low) the visiting craft only (no plume, no crew); tier 1 + a crew of two, the drone, the dust,
//   the plumes; tier 2+ a crew of up to three, vapour, ticking, the landing lights at night. Switch: settings.padLife
//   (⚙ Bild · Dinge & Effekte).
// ============================================================================
(function (VR) {
  'use strict';
  const LK = VR.LifeKit, h = LK.h, TAU = Math.PI * 2;
  const PL = VR.PadLife = {};
  // the timeline of a visit (seconds): GAP = SLIDE0 + SLIDE + SETTLE — from the lift of one craft to the touchdown of the next
  Object.assign(PL, { GAP: 10, STAY0: 60, STAY1: 180, APP: 45, HOLDT: 14, LIFT: 2, SLIDE0: 4.5, SLIDE: 2.5, SETTLE: 3, DEP: 45, FAR: 980, LIFTH: 6, FADE0: 420, FADE1: 600, VIS: 620, BRAKE: 1.6, ACC: 3, V0: 5 });
  PL.CREW = { exit0: 6.5, exitStep: 1.7, speed: 1.6, rampOpen: 4, rampClose: 6, margin: 0.8 };
  PL.ARCHS = [['shuttle', 0.6], ['dropship', 0.25], ['freighter', 0.15]];
  PL.PALS = ['starforge', null, null];

  PL.stay = (seed, n, o) => { const a = (o && o.stay0) || PL.STAY0, b = (o && o.stay1) || PL.STAY1; return a + (b - a) * h(seed, n, 0x5a7); };
  PL.t0 = (seed) => h(seed, 7, 0x77) * 60;
  PL.arch = (seed, n) => { const r = h(seed, n, 0xa2c); let a = 0; for (const [k, w] of PL.ARCHS) { a += w; if (r < a) return k; } return 'shuttle'; };
  PL.craftSeed = (seed, n) => (Math.floor(h(seed, n, 0x3e1) * 4294967295) >>> 0);
  // the visit whose turn it is at clock t (from the lift of the one before to its own lift): {n, T (its touchdown)}. A cache
  // object makes successive calls cheap (it walks forward or back from the last answer; the stays are a pure function of n)
  PL.visitAt = function (seed, t, c, o) {
    if (!c || c.seed !== seed) c = { seed, n: 0, T: PL.t0(seed) };
    let n = c.n, T = c.T;
    for (let k = 0; k < 400000; k++) { const T1 = T + PL.stay(seed, n, o) + PL.GAP; if (t >= T1 - PL.GAP) { T = T1; n++; } else break; }
    for (let k = 0; k < 400000; k++) { if (t < T - PL.GAP) { n--; T = T - PL.stay(seed, n, o) - PL.GAP; } else break; }
    c.n = n; c.T = T;
    return c;
  };
  // the times of visit m whose touchdown is T: the approach (A0 … A1), the hold (… H1), the slide (… S1), the settle (… T),
  // the stay S (… L), the lift (… L1), the departure (… D1)
  PL.times = function (seed, m, T, o) {
    const Lp = T - PL.GAP, S = PL.stay(seed, m, o), L = T + S;
    return { A0: Lp + PL.SLIDE0 - PL.HOLDT - PL.APP, A1: Lp + PL.SLIDE0 - PL.HOLDT, H1: Lp + PL.SLIDE0, S1: Lp + PL.SLIDE0 + PL.SLIDE, T, S, L, L1: L + PL.LIFT, D1: L + PL.LIFT + PL.DEP };
  };
  // ---------------------------------------------------------------- the speed along a leg (pure)
  // braking in: a cruise, then a steady braking (BRAKE m/s²) to a stop at the end; L metres in T seconds → metres flown at t
  PL.brakeAt = function (L, T, a, t) {
    const VC = a * (T - Math.sqrt(Math.max(0, T * T - 2 * L / a))), t1 = T - VC / a;
    if (t <= 0) return 0;
    if (t <= t1) return VC * t;
    const u = Math.min(t, T) - t1;
    return VC * t1 + VC * u - a * u * u / 2;
  };
  // leaving: off at v0, a steady acceleration (ACC m/s²) to the cruise, then the cruise; L metres in T seconds
  PL.accelAt = function (L, T, a, v0, t) {
    const w = a * T - Math.sqrt(Math.max(0, a * a * T * T - 2 * a * (L - v0 * T))), t1 = w / a, VC = v0 + w;
    if (t <= 0) return 0;
    if (t <= t1) return v0 * t + a * t * t / 2;
    return v0 * t1 + a * t1 * t1 / 2 + VC * (Math.min(t, T) - t1);
  };
  const rot = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
  // the points of visit m at a pad: pad = {x, y, z, yaw (parked heading), out: [dx, dz] (the open side, unit), spread (the
  // half-angle of its lanes in and out, default 0.85 rad), holdSide (±1: the side its next craft waits on, else alternating)}
  PL.points = function (pad, seed, m) {
    const P = [pad.x, pad.y, pad.z], f = pad.out, right = [-f[1], f[0]], side = pad.holdSide || ((m & 1) ? 1 : -1), sp = (pad.spread || 0.85) * 2;
    const dIn = rot(f, (h(seed, m, 11) - 0.5) * sp), dOut = rot(f, (h(seed, m, 13) - 0.5) * sp);
    const Hd = [P[0] + right[0] * side * 24 + f[0] * 6, P[1] + 10, P[2] + right[1] * side * 24 + f[1] * 6];
    return {
      P, Hd, Hv: [P[0], P[1] + PL.LIFTH, P[2]], D0: [P[0], P[1] + PL.LIFTH, P[2]],
      Q0: [P[0] + dIn[0] * PL.FAR, P[1] + 70 + 40 * h(seed, m, 17), P[2] + dIn[1] * PL.FAR], C0: [Hd[0] + dIn[0] * 140, Hd[1] + 45, Hd[2] + dIn[1] * 140],
      C1: [P[0] + f[0] * 90, P[1] + 62, P[2] + f[1] * 90], Q1: [P[0] + dOut[0] * PL.FAR, P[1] + 90 + 40 * h(seed, m, 19), P[2] + dOut[1] * PL.FAR],
    };
  };
  // the Gate Temple's apron as a pad (PadLife.Actor.findTemple; the tests): a world seed → its pad record
  PL.APRON = { x: 47, y: 81, z: 62, bearing: 66 * Math.PI / 180, spread: 14 * Math.PI / 180, service: [27.5, 40] };
  PL.apron = function (wseed) {
    const A = PL.APRON, f = [Math.cos(A.bearing), Math.sin(A.bearing)];
    return { key: 'apron', kind: 'apron', seed: (Math.imul(wseed | 0, 0x9e3779b1) ^ 0x7e3a11) | 0, x: A.x, y: A.y, z: A.z, yaw: LK.yawOf(f[0], f[1]), out: f, spread: A.spread, holdSide: -1, serviceAt: A.service, cache: null, crafts: new Map() };
  };
  // a world point → ship-local (x, z) for a craft parked at pad (its yaw)
  PL.toLocal = (pad, wx, wz) => { const c = Math.cos(pad.yaw), s = Math.sin(pad.yaw), dx = wx - pad.x, dz = wz - pad.z; return [dx * c - dz * s, dx * s + dz * c]; };
  // the curves of visit m as walkable polylines (cached on the pad: a few visits at a time)
  const bezPath = (A, C, B, n) => { const pts = []; for (let i = 0; i <= n; i++) { const u = i / n, w = 1 - u; pts.push([w * w * A[0] + 2 * w * u * C[0] + u * u * B[0], w * w * A[1] + 2 * w * u * C[1] + u * u * B[1], w * w * A[2] + 2 * w * u * C[2] + u * u * B[2]]); } return LK.path(pts); };
  PL.legs = function (pad, seed, m) {
    const cache = pad._legs || (pad._legs = new Map());
    let L = cache.get(m);
    if (L && L.seed === seed) return L;
    const Q = PL.points(pad, seed, m);
    L = { seed, Q, app: bezPath(Q.Q0, Q.C0, Q.Hd, 48), dep: bezPath(Q.D0, Q.C1, Q.Q1, 48) };
    cache.set(m, L);
    if (cache.size > 8) for (const k of [...cache.keys()]) if (k < m - 3 || k > m + 3) cache.delete(k);
    return L;
  };
  const TMP = [0, 0, 0, 0], TMP2 = [0, 0, 0, 0];
  // the bank of a craft flying a path at d metres with speed v: from how fast the heading turns there
  const bankOn = (path, d, v) => { LK.along(path, d, TMP); LK.along(path, Math.min(path.L, d + 15), TMP2); return Math.max(-0.45, Math.min(0.45, LK.wrap(TMP2[3] - TMP[3]) / 15 * v * 1.2)); };
  // the pose of visit m's craft at time t (null when it is not around): {phase, pos (the ground point under the hull: the
  // gear's feet), yaw, pitch, roll, gear, thrust, speed, u (seconds since the touchdown), S, padFade (0 … 1: it fades in and
  // out at its horizon points)}
  PL.pose = function (pad, seed, m, T, t, out, o) {
    const W = PL.times(seed, m, T, o);
    if (t < W.A0 || t >= W.D1) return null;
    const G = PL.legs(pad, seed, m), Q = G.Q;
    out = out || {};
    const p = out.pos || (out.pos = [0, 0, 0]);
    out.S = W.S; out.u = t - W.T; out.m = m; out.T = T; out.pitch = 0; out.roll = 0; out.padFade = 1; out.speed = 0;
    const yawP = pad.yaw;
    if (t < W.A1) {
      const P = G.app, tau = t - W.A0, d = PL.brakeAt(P.L, PL.APP, PL.BRAKE, tau), d2 = PL.brakeAt(P.L, PL.APP, PL.BRAKE, tau + 0.1);
      LK.along(P, d, TMP); p[0] = TMP[0]; p[1] = TMP[1]; p[2] = TMP[2];
      out.phase = 'approach'; out.yaw = TMP[3]; out.gear = 0; out.speed = (d2 - d) / 0.1;
      out.thrust = 0.55 + 0.35 * Math.min(1, out.speed / 25);
      out.padFade = LK.smooth(d / (0.05 * P.L));
      out.roll = bankOn(P, d, out.speed);
      out.pitch = 0.1 * (1 - Math.min(1, out.speed / 25)) * LK.smooth(tau / 4);   // the flare as it brakes
    } else if (t < W.H1) {
      const u = t - W.A1;
      LK.along(G.app, G.app.L - 0.5, TMP);
      const y0 = TMP[3];
      p[0] = Q.Hd[0]; p[1] = Q.Hd[1] + Math.sin(u * 1.1) * 0.35; p[2] = Q.Hd[2];
      out.phase = 'hold'; out.yaw = y0 + LK.wrap(yawP - y0) * LK.smooth(u / 6); out.gear = 0; out.thrust = 0.5;
    } else if (t < W.S1) {
      const u = LK.smooth((t - W.H1) / PL.SLIDE);
      p[0] = Q.Hd[0] + (Q.Hv[0] - Q.Hd[0]) * u; p[1] = Q.Hd[1] + (Q.Hv[1] - Q.Hd[1]) * u; p[2] = Q.Hd[2] + (Q.Hv[2] - Q.Hd[2]) * u;
      out.phase = 'slide'; out.yaw = yawP; out.gear = 0.3 * u; out.thrust = 0.55;
    } else if (t < W.T) {
      const u = LK.smooth((t - W.S1) / PL.SETTLE);
      p[0] = Q.P[0]; p[1] = Q.Hv[1] + (Q.P[1] - Q.Hv[1]) * u; p[2] = Q.P[2];
      out.phase = 'settle'; out.yaw = yawP; out.gear = 0.3 + 0.7 * u; out.thrust = 0.45 - 0.2 * u;
    } else if (t < W.L) {
      const u = t - W.T;
      p[0] = Q.P[0]; p[1] = Q.P[1]; p[2] = Q.P[2];
      out.phase = 'parked'; out.yaw = yawP; out.gear = 1;
      // the engines cool: the plume dies down over 15 s; they spool up again in the last 4 s
      out.thrust = u < 15 ? 0.25 * (1 - u / 15) : u > W.S - 4 ? 0.25 * (u - (W.S - 4)) / 4 : 0;
    } else if (t < W.L1) {
      const u = LK.smooth((t - W.L) / PL.LIFT);
      p[0] = Q.P[0]; p[1] = Q.P[1] + PL.LIFTH * u; p[2] = Q.P[2];
      out.phase = 'lift'; out.yaw = yawP; out.gear = 1 - u; out.thrust = 0.6;
    } else {
      const P = G.dep, tau = t - W.L1, d = PL.accelAt(P.L, PL.DEP, PL.ACC, PL.V0, tau), d2 = PL.accelAt(P.L, PL.DEP, PL.ACC, PL.V0, tau + 0.1);
      LK.along(P, d, TMP); p[0] = TMP[0]; p[1] = TMP[1]; p[2] = TMP[2];
      out.phase = 'depart'; out.speed = (d2 - d) / 0.1; out.gear = 0; out.thrust = 0.9;
      out.yaw = yawP + LK.wrap(TMP[3] - yawP) * LK.smooth(tau / 2.5);   // it turns from its parked heading onto the climb-out
      out.padFade = 1 - LK.smooth((d - 0.95 * P.L) / (0.05 * P.L));
      out.pitch = -0.06 * Math.min(1, tau / 3);
      out.roll = bankOn(P, d, out.speed) * LK.smooth(tau / 2.5);
    }
    return out;
  };
  // the craft around a pad at time t (at most three: the one leaving, the one on the pad, the one coming): poses
  PL.active = function (pad, seed, t, cache, outs, o, into) {
    const c = PL.visitAt(seed, t, cache, o), list = into || []; list.length = 0;
    const Tm1 = c.T - PL.stay(seed, c.n - 1, o) - PL.GAP, Tp1 = c.T + PL.stay(seed, c.n, o) + PL.GAP;
    const ms = [[c.n - 1, Tm1], [c.n, c.T], [c.n + 1, Tp1]];
    for (let k = 0; k < 3; k++) { const q = PL.pose(pad, seed, ms[k][0], ms[k][1], t, outs ? outs[k] : null, o); if (q) list.push(q); }
    return list;
  };

  // ---------------------------------------------------------------- the crew and the drone (ship-local, then the parked pose)
  // geom (ship-local metres, already scaled): {bounds [x0, y0, z0, x1, y1, z1] (the nose at −z), ramp: {hinge [x, y, z],
  // len, open} or null, gears [[x, z] …], engines [[x, y, z, r] …], occ (the worker's 1-m occupancy) and org (its origin)}
  PL.geom = function (meta, scale, occ) {
    const k = scale || 1, B = meta.bounds, C = meta.cabin;
    const g = { bounds: B.map(v => v * k), ramp: null, floor: 0, gears: (meta.gear || []).map(q => [q[0] * k, q[1] * k]), engines: (meta.exhaust || []).map(e => [e[0] * k, e[1] * k, e[2] * k, e[3] * k]), scale: k, occ: occ || null, org: meta.origin || [0, 0, 0] };
    if (C && C.ramp) g.ramp = { hinge: [C.ramp.hinge[0] * k, C.ramp.hinge[1] * k, C.ramp.hinge[2] * k], len: C.ramp.len * k, open: C.ramp.open, w: (C.ramp.w || 1) * k };
    g.floor = C ? C.floor * k : 0;
    return g;
  };
  // is the ship-local point (x, y, z) inside the hull? (the worker's occupancy: 1-m cells at least 30 % full)
  PL.solid = function (G, x, y, z) {
    const o = G.occ; if (!o) return false;
    const k = G.scale || 1, org = G.org;
    const i = Math.floor(x / k - org[0]), j = Math.floor(y / k - org[1]), kk = Math.floor(z / k - org[2]);
    if (i < 0 || j < 0 || kk < 0 || i >= o.bx || j >= o.by || kk >= o.bz) return false;
    return !!o.occ[(j * o.bz + kk) * o.bx + i];
  };
  // a person can stand at (x, z) on the ground: nothing of the hull from the feet to the head (a body 0.6 wide, 1.8 tall)
  PL.standClear = function (G, x, z) {
    for (const dx of [-0.3, 0.3]) for (const dz of [-0.3, 0.3]) for (const y of [0.1, 0.7, 1.3, 1.8]) if (PL.solid(G, x + dx, y, z + dz)) return false;
    return true;
  };
  // the crew's paths: out of the ship down the ramp (or, without a ramp, a ground crew of two from the service point
  // behind it), round the hull to their places — the captain beside the hull, the engineer behind an engine, the co-pilot
  // under the wing at a gear leg (as far in as the hull lets a person stand). service: [x, z] ship-local, or null
  PL.crewPlan = function (seed, m, G, service) {
    const B = G.bounds, hw = Math.max(-B[0], B[3]), z0 = B[2], z1 = B[5], off = hw + 1.4;
    if (!G.ramp && !service) return { N: 0, side: 1, plans: [], ramp: false };
    const ramp = !!G.ramp, N = ramp ? 2 + (h(seed, m, 21) > 0.4 ? 1 : 0) : 2, side = h(seed, m, 23) < 0.5 ? -1 : 1;
    let head;
    if (ramp) {
      const R0 = G.ramp, a = R0.open || 2.09;
      const top = [0, R0.hinge[1], R0.hinge[2]], inside = [0, R0.hinge[1], R0.hinge[2] - 1.6];
      const foot = [0, Math.max(0, R0.hinge[1] + R0.len * Math.cos(a)), R0.hinge[2] + R0.len * Math.sin(a)];
      head = [inside, top, foot, [0, 0, Math.max(foot[2], z1) + 1.0]];
    } else head = [[service[0], 0, service[1]]];
    const behind = head[head.length - 1], zb = Math.max(behind[2], z1 + 1.4);
    // the engineer: behind an outer engine (the middle one is over the ramp)
    const outer = G.engines.filter(e => Math.abs(e[0]) > 0.8), engs = outer.length ? outer : G.engines;
    const eng = engs.length ? engs[Math.floor(h(seed, m, 25) * engs.length)] : [side * hw * 0.5, 1, z1, 0.5];
    // the co-pilot: from beside the hull straight in toward a gear leg, as far as a person can stand
    // (the ground crew walks from behind the craft: it checks the rear gear; a crew off the ramp any gear on its side)
    const gs0 = G.gears.filter(q => q[0] * side >= 0), gs = (gs0.length ? gs0 : G.gears).slice().sort((a, b) => b[1] - a[1]);
    const gear = (ramp ? gs[Math.floor(h(seed, m, 27) * Math.max(1, gs.length))] : gs[0]) || [side * hw * 0.6, z0 * 0.4];
    let gx = side * off;
    for (let x = side * off; Math.abs(x) > Math.abs(gear[0]) + 0.7; x -= side * 0.25) { if (!PL.standClear(G, x, gear[1])) break; gx = x; }
    const stations = [
      [side * off, 0, z1 - 0.32 * (z1 - z0)],     // the captain: by the hull's side, toward the tail
      [eng[0], 0, z1 + 1.4],                      // the engineer: behind an engine
      [gx, 0, gear[1]],                           // the co-pilot: at a gear leg
    ];
    const plans = [];
    for (let i = 0; i < N; i++) {
      const st = stations[ramp ? i : i === 0 ? 1 : 2], pts = head.map(q => q.slice());
      if (st === stations[1]) pts.push([st[0], 0, zb], st);
      else { pts.push([side * off, 0, zb]); pts.push([side * off, 0, st[2]]); if (Math.abs(st[0] - side * off) > 0.05) pts.push(st); }
      plans.push({ i, path: LK.path(pts), st, look: st === stations[1] ? [eng[0], 0, eng[2]] : st === stations[2] ? [gear[0], 0, gear[1]] : [0, 0, (z0 + z1) * 0.5], role: st === stations[1] ? 'engineer' : st === stations[2] ? 'gear' : 'captain' });
    }
    return { N, side, plans, ramp, stations };
  };
  // the crew's timetable in a stay of S seconds: out one after the other; the gear checker joins the captain to talk when
  // the stay is long enough; back in turn, the farthest first, everyone aboard (or gone behind the ship) a margin before
  // the ramp starts to close. A member whose walk does not fit the stay stays aboard (skip)
  PL.crewTimes = function (pl, S) {
    const C = PL.CREW, cap = pl.plans.find(p => p.role === 'captain'), meet = cap ? cap.st : null, T = [];
    const st2 = meet ? [meet[0] + (meet[0] >= 0 ? -1 : 1) * 0.2, 0, meet[2] - 1.3] : null;
    const end = S - C.rampClose - C.margin;
    for (let i = 0; i < pl.N; i++) {
      const P = pl.plans[i], e = C.exit0 + C.exitStep * i, arrive = e + P.path.L / C.speed, order = 0.6 * (pl.N - 1 - i);
      let checkEnd = arrive, moveEnd = arrive, dj = 0, join = false;
      if (P.role === 'gear' && st2) {
        const dj2 = Math.hypot(st2[0] - P.st[0], st2[2] - P.st[2]);
        if (arrive + 7 + dj2 / C.speed + 6 + (P.path.L + dj2) / C.speed + order <= end) { join = true; dj = dj2; checkEnd = arrive + 7; moveEnd = checkEnd + dj / C.speed; }
      }
      // the walk back: from where it stands (beside the captain: that stretch first), the whole path
      const b = end - (P.path.L + dj) / C.speed - order;
      T.push({ e, arrive, checkEnd, moveEnd, b, dj, join, skip: b < moveEnd + 2 });
    }
    return { T, st2 };
  };
  PL.crew = function (seed, m, u, S, G, plan, out) {
    const C = PL.CREW, pl = plan || PL.crewPlan(seed, m, G), N = pl.N, CT = PL.crewTimes(pl, S), st2 = CT.st2;
    out = out || [];
    out.length = N;
    const cap = pl.plans.findIndex(p => p.role === 'captain'), gi = pl.plans.findIndex(p => p.role === 'gear');
    for (let i = 0; i < N; i++) {
      const P = pl.plans[i], W = CT.T[i], o = out[i] || (out[i] = { i, pos: [0, 0, 0], yaw: 0 });
      const L = P.path.L, tmp = o.tmp || (o.tmp = [0, 0, 0, 0]);
      o.on = false; o.state = 'idle'; o.walk = 0; o.walkAmt = 0; o.talking = false; o.role = P.role;
      if (W.skip || u < W.e || u > S) continue;
      if (u < W.arrive) { o.walk = (u - W.e) * C.speed; LK.along(P.path, o.walk, tmp); o.walkAmt = 1; }
      else if (u < W.b) {
        if (W.join && u >= W.checkEnd) {
          if (u < W.moveEnd) { const k = (u - W.checkEnd) / Math.max(0.01, W.moveEnd - W.checkEnd); tmp[0] = P.st[0] + (st2[0] - P.st[0]) * k; tmp[1] = 0; tmp[2] = P.st[2] + (st2[2] - P.st[2]) * k; tmp[3] = LK.yawOf(st2[0] - P.st[0], st2[2] - P.st[2]); o.walk = (u - W.checkEnd) * C.speed; o.walkAmt = 1; }
          else { const m0 = pl.plans[cap].st; tmp[0] = st2[0]; tmp[1] = 0; tmp[2] = st2[2]; tmp[3] = LK.yawOf(m0[0] - st2[0], m0[2] - st2[2]); o.state = 'talk'; o.talking = (u - W.moveEnd) % 7 > 3.5; }
        } else {
          tmp[0] = P.st[0]; tmp[1] = 0; tmp[2] = P.st[2];
          // the captain turns to the co-pilot once they stand together, else looks at the ship
          const together = P.role === 'captain' && gi >= 0 && CT.T[gi].join && u >= CT.T[gi].moveEnd && u < CT.T[gi].b;
          const lk = together ? st2 : P.look;
          tmp[3] = LK.yawOf(lk[0] - P.st[0], lk[2] - P.st[2]);
          const k = (u - W.arrive) % 14;
          if (P.role === 'captain') { o.state = k < 9 ? 'talk' : k < 11 ? 'point' : 'idle'; o.talking = k < 9 && (!together || (u - CT.T[gi].moveEnd) % 7 <= 3.5); }
          else if (P.role === 'engineer') o.state = k < 6 ? 'crouch' : k < 8.5 ? 'idle' : k < 10.5 ? 'point' : 'crouch';
          else o.state = 'crouch';
        }
      } else {
        // back to the ship along the way out (the co-pilot from beside the captain first)
        const d = (u - W.b) * C.speed, from = W.join ? st2 : P.st;
        const dj = Math.hypot(from[0] - P.st[0], from[2] - P.st[2]);
        if (d < dj) { const k = d / dj; tmp[0] = from[0] + (P.st[0] - from[0]) * k; tmp[1] = 0; tmp[2] = from[2] + (P.st[2] - from[2]) * k; tmp[3] = LK.yawOf(P.st[0] - from[0], P.st[2] - from[2]); }
        else { const dd = L - (d - dj); if (dd <= 0) continue; LK.along(P.path, dd, tmp); tmp[3] += Math.PI; }
        o.walk = d; o.walkAmt = 1;
      }
      o.on = true;
      o.pos[0] = tmp[0]; o.pos[1] = tmp[1]; o.pos[2] = tmp[2]; o.yaw = tmp[3];
    }
    return out;
  };
  // the ramp: down from 4 s into the stay, up again 6 s before the end (0 … 1)
  PL.ramp = (u, S) => LK.smooth((u - PL.CREW.rampOpen) / 2) * (1 - LK.smooth((u - (S - PL.CREW.rampClose)) / 2));
  // the service drone: up from the roof 9 s into the stay, round the hull, home again 9 s before the end
  PL.drone = function (seed, m, u, S, G, out) {
    out = out || { pos: [0, 0, 0], yaw: 0 };
    const B = G.bounds, top = B[4] + 0.3, zc = (B[2] + B[5]) * 0.5, rx = Math.max(Math.abs(B[0]), Math.abs(B[3])) + 2.4, rz = (B[5] - B[2]) * 0.5 + 2.4;
    out.on = u > 9 && u < S - 9;
    if (!out.on) return out;
    const up = LK.smooth((u - 9) / 2) * (1 - LK.smooth((u - (S - 11)) / 2));
    const a = h(seed, m, 31) * TAU + (u - 9) * 0.42;
    out.pos[0] = Math.cos(a) * rx * up; out.pos[1] = top + 2.2 * up + Math.sin(u * 1.7) * 0.15; out.pos[2] = zc + Math.sin(a) * rz * up;
    out.yaw = LK.yawOf(-Math.sin(a), Math.cos(a));
    return out;
  };
  // ship-local → world for a parked craft (pos, yaw)
  PL.toWorld = (pos, yaw, l, out) => { const c = Math.cos(yaw), s = Math.sin(yaw); out = out || [0, 0, 0]; out[0] = pos[0] + l[0] * c + l[2] * s; out[1] = pos[1] + l[1]; out[2] = pos[2] - l[0] * s + l[2] * c; return out; };
  // the tier of a settings record (as the living air's): 0 Very Low … 4 Ultra
  PL.tierOf = (S) => LK.tierOf(S);
  // the alpha a craft is drawn with: its own fade at the horizon points times the haze between it and the eye
  PL.alphaOf = (padFade, dist) => padFade * (1 - LK.smooth((dist - PL.FADE0) / (PL.FADE1 - PL.FADE0)));

  // ---------------------------------------------------------------- in the game
  PL.Actor = class {
    constructor(game) {
      this.g = game;
      const E = game.env;
      this.clock = E ? ((E.day || 0) * 24000 + (E.ticks || 0)) / 20 : 0;   // the world's clock (as the trams')
      this.pads = new Map();                                                // key → pad
      this.scanT = 0; this.templeT = 0; this.on = true; this.tier = 2;
      this.st = { pads: 0, crafts: 0, parked: 0, crew: 0, drones: 0, drawn: 0, visible: 0 };
    }
    // the Gate Temple's apron: the east side of the Gate Plaza (x 47, z 62: clear of the runway, where the hall's two
    // shuttles fly in and out, of the lawns, the trees and the bushes). Its lanes in and out lie between the canyon's
    // teardrop (where the hall's shuttles hold) and the Sky Isles: bearings 52°–80° from east toward south. A craft parks
    // nose out along its lane; the next one waits east of it; a craft without a ramp is met by two of the temple's ground
    // crew, who come down the east terrace stairs (their foot at x 27.5, z 40). Once the temple's chunk is there.
    findTemple() {
      const w = this.g.world, R = VR.R; if (!w || !R || !R.byName.portal_veil || this.pads.has('apron')) return;
      const b = w.getBlock(0, 81, 20);
      if (b && R.T.type[b] === R.byName.portal_veil.id) this.pads.set('apron', PL.apron((this.g.meta && this.g.meta.seed) | 0));
    }
    // the pads with a parked world ship (outposts, tech villages): their crew does its rounds; visitors while it is gone
    scanShips() {
      const SS = this.g.starships; if (!SS) return;
      for (const s of SS.ships) {
        if (!s.key || s.hangar || this.pads.has(s.key)) continue;
        const k = s.key.split(',').map(Number); if (k.length < 3 || k.some(v => !isFinite(v))) continue;
        const seed = (Math.imul(k[0] | 0, 0x1f1f1f1f) ^ Math.imul(k[2] | 0, 0x2545f491) ^ ((this.g.meta && this.g.meta.seed) | 0)) | 0;
        // (a visitor parks as the world ship stood and leaves nose first: out is the nose's direction)
        this.pads.set(s.key, { key: s.key, kind: 'outpost', seed, x: k[0] + 0.5, y: k[1], z: k[2] + 0.5, yaw: s.yaw, out: [-Math.sin(s.yaw), -Math.cos(s.yaw)], ship: s, serviceAt: null, cache: null, crafts: new Map() });
      }
    }
    // a world ship stands on this pad (parked where it was spawned, nobody at its controls)
    occupied(pad) { const s = pad.ship; if (!s) return false; const SS = this.g.starships; return SS.ships.includes(s) && SS.pilot !== s && s.state === 'parked' && Math.hypot(s.pos[0] - pad.x, s.pos[2] - pad.z) < 6; }
    update(dt) {
      const g = this.g, S = g.settings || {}, pl = g.player;
      this.clock += dt;
      this.on = S.padLife !== false && g.dim === 'overworld' && g.state === 'play';
      this.tier = PL.tierOf(S);
      const st = this.st; st.pads = this.pads.size; st.crafts = 0; st.parked = 0; st.crew = 0; st.drones = 0; st.visible = 0;
      if (!this.on || !pl || !g.starships) { for (const p of this.pads.values()) { p.live = null; p.ground = null; } return; }
      if ((this.templeT -= dt) <= 0) { this.templeT = 2; this.findTemple(); }
      if ((this.scanT -= dt) <= 0) { this.scanT = 3; this.scanShips(); }
      const E = g.env && g.env.E, night = E ? E.night || 0 : 0;
      for (const pad of this.pads.values()) {
        const d = Math.hypot(pad.x - pl.pos[0], pad.z - pl.pos[2]);
        if (d > PL.VIS) { pad.live = null; pad.ground = null; continue; }
        if (pad.kind === 'outpost' && pad.ship && this.occupied(pad)) { pad.live = null; this.groundCrew(pad, dt, d); continue; }
        pad.ground = null;
        pad.outs = pad.outs || [{}, {}, {}];
        const list = PL.active(pad, pad.seed, this.clock, pad.cache || (pad.cache = { seed: pad.seed, n: 0, T: PL.t0(pad.seed) }), pad.outs, null, pad.list || (pad.list = []));
        pad.live = list;
        for (const q of list) this.craft(pad, q, dt, d, night);
      }
    }
    // the visiting craft of visit q.m: its design (built in a worker once), its parked pose, its crew, its drone, its fx
    craft(pad, q, dt, dPad, night) {
      const g = this.g, SS = g.starships, st = this.st;
      let c = pad.crafts.get(q.m);
      if (!c) {
        const arch = PL.arch(pad.seed, q.m), seed = PL.craftSeed(pad.seed, q.m);
        c = { m: q.m, arch, d: SS.design(seed, arch, PL.PALS[q.m % 3]), inst: { d: null, pos: [0, 0, 0], yaw: 0, pitch: 0, roll: 0, gear: 0, hatch: { ramp: 0, door: 0, cdoor: 0 }, kneel: 0 }, tid: 'pl' + pad.key + ':' + q.m, crew: null, folk: [], drone: { pos: [0, 0, 0], yaw: 0 }, tick: 0, alpha: 0 };
        pad.crafts.set(q.m, c);
        for (const k of [...pad.crafts.keys()]) if (k < q.m - 2 || k > q.m + 2) pad.crafts.delete(k);
      }
      c.seen = this.clock; c.q = q;
      const d = c.d; d.last = performance.now();
      const I = c.inst; I.d = d;
      // (the pose is the ground under the gear; the craft's own y is its feet)
      I.pos[0] = q.pos[0]; I.pos[1] = q.pos[1]; I.pos[2] = q.pos[2]; I.yaw = q.yaw; I.pitch = q.pitch; I.roll = q.roll; I.gear = q.gear;
      const pl = g.player.pos, dist = Math.hypot(q.pos[0] - pl[0], q.pos[1] - pl[1], q.pos[2] - pl[2]);
      c.alpha = PL.alphaOf(q.padFade, dist);
      c.dist = dist;
      st.crafts++;
      if (c.alpha > 0.5) st.visible++;
      if (q.phase === 'parked') st.parked++;
      if (!d.meta) return;
      if (!c.G) { c.G = PL.geom(d.meta, 1, d.occ); c.plan = PL.crewPlan(pad.seed, q.m, c.G, pad.serviceAt ? PL.toLocal(pad, pad.serviceAt[0], pad.serviceAt[1]) : null); }
      I.hatch.ramp = q.phase === 'parked' && c.G.ramp ? PL.ramp(q.u, q.S) : 0;
      // the crew and the drone (tier 1 and up, near the eye)
      c.crewOn = q.phase === 'parked' && this.tier >= 1 && dist < 90 && c.plan.N > 0;
      if (c.crewOn) {
        c.crew = PL.crew(pad.seed, q.m, q.u, q.S, c.G, c.plan, c.crew || []);
        const maxN = this.tier >= 2 ? 3 : 2;
        for (let i = 0; i < c.crew.length; i++) {
          const o = c.crew[i], role = c.plan.ramp ? (o.role === 'engineer' ? 'operator' : 'pilot') : 'operator';
          const f = c.folk[i] || (c.folk[i] = { look: LK.folk(PL.craftSeed(pad.seed, q.m) + i * 7919, role, 'adult'), pos: [0, 0, 0], yaw: 0, seed: i * 1.7 });
          f.on = o.on && i < maxN;
          if (!f.on) continue;
          PL.toWorld(I.pos, I.yaw, o.pos, f.pos);
          f.yaw = o.yaw + I.yaw; f.state = o.state; f.walk = o.walk; f.walkAmt = o.walkAmt; f.talking = o.talking;
          st.crew++;
        }
      }
      const D = q.phase === 'parked' && this.tier >= 1 && dist < 140 ? PL.drone(pad.seed, q.m, q.u, q.S, c.G, c.drone) : null;
      c.droneOn = !!(D && D.on);
      if (c.droneOn) { c.dronePos = PL.toWorld(I.pos, I.yaw, D.pos, c.dronePos); c.droneYaw = D.yaw + I.yaw; st.drones++; }
      this.fx(pad, c, q, dt, dist, night);
    }
    // a parked world ship's ground crew (outposts): the same scene round a ship that never leaves (its stay repeats)
    groundCrew(pad, dt, dPad) {
      const s = pad.ship, st = this.st;
      if (this.tier < 1 || dPad > 90 || !s.d.meta) { pad.ground = null; return; }
      const S = 150, cyc = Math.floor(this.clock / (S + 30)), u = this.clock - cyc * (S + 30);
      let G = pad.ground;
      if (!G || G.cyc !== cyc) {
        const geo = PL.geom(s.d.meta, 1, s.d.occ);
        geo.ramp = null;   // (the ship's own ramp stays as the player left it: a ground crew comes from behind it)
        G = pad.ground = { cyc, G: geo, plan: PL.crewPlan(pad.seed, cyc, geo, [3, geo.bounds[5] + 8]), folk: [], crew: [], drone: { pos: [0, 0, 0], yaw: 0 } };
      }
      const crew = PL.crew(pad.seed, cyc, u, S, G.G, G.plan, G.crew);
      for (let i = 0; i < crew.length; i++) {
        const o = crew[i], f = G.folk[i] || (G.folk[i] = { look: LK.folk((pad.seed ^ cyc * 31) + i * 7919, 'operator', 'adult'), pos: [0, 0, 0], yaw: 0, seed: i });
        f.on = o.on; if (!f.on) continue;
        PL.toWorld(s.pos, s.yaw, o.pos, f.pos); f.yaw = o.yaw + s.yaw; f.state = o.state; f.walk = o.walk; f.walkAmt = o.walkAmt; f.talking = o.talking; st.crew++;
      }
      const D = PL.drone(pad.seed, cyc, u, S, G.G, G.drone);
      G.droneOn = D.on; if (D.on) { G.dronePos = PL.toWorld(s.pos, s.yaw, D.pos, G.dronePos); G.droneYaw = D.yaw + s.yaw; st.drones++; }
      void dt;
    }
    // the engines (a plume while flying, cooling down on the pad), vapour and ticking while they cool, dust as it settles
    // and lifts, the landing lights at night — only near the eye, by tier
    fx(pad, c, q, dt, dist, night) {
      const g = this.g, m = c.d.meta, P = g.particles, Tr = g.trails, I = c.inst;
      if (!m || this.tier < 1 || dist > 260 || c.alpha < 0.05) return;
      const wpos = c.wp || (c.wp = [0, 0, 0]), loc = c.loc || (c.loc = [0, 0, 0]);
      const air = q.phase === 'approach' || q.phase === 'depart';
      if (Tr && q.thrust > 0.01) for (let ei = 0; ei < m.exhaust.length; ei++) {
        const e = m.exhaust[ei]; loc[0] = e[0]; loc[1] = e[1]; loc[2] = e[2] + 0.3; PL.toWorld(I.pos, I.yaw, loc, wpos);
        const cool = q.phase === 'parked' ? Math.min(1, q.thrust * 4) : 1;
        Tr.engine(c.tid + ei, wpos.slice(), air ? Math.max(8, q.speed) : 0, { thrust: q.thrust, size: e[3] * (air ? 1.4 : 1), col: air ? [0.5, 0.85, 1] : [1, 0.42 + 0.26 * cool, 0.2 + 0.12 * cool], minor: ei > 1, smokeLife: 5 });
      }
      if (!P) return;
      // the pad's dust as it settles and lifts
      if ((q.phase === 'settle' || q.phase === 'lift') && dist < 140 && Math.random() < 0.7) for (let k = 0; k < 3; k++) {
        const a = Math.random() * TAU, r = 3 + Math.random() * 6;
        P.spawn(pad.x + Math.cos(a) * r, pad.y + 0.15, pad.z + Math.sin(a) * r, Math.cos(a) * 5, 0.3 + Math.random() * 0.6, Math.sin(a) * 5, { life: 0.9 + Math.random() * 0.6, size: 0.3 + Math.random() * 0.3, grav: -0.15, col: [0.7, 0.66, 0.58], drag: 1.4, grow: 1.4, collide: false });
      }
      // cooling on the pad: vapour curling off the engines (the first 40 s), the metal ticking (within 25 blocks)
      if (q.phase === 'parked' && this.tier >= 2 && q.u < 40 && dist < 120) {
        const k = 1 - q.u / 40;
        for (const e of m.exhaust) if (Math.random() < dt * 5 * k) {
          loc[0] = e[0]; loc[1] = e[1]; loc[2] = e[2] + 0.2; PL.toWorld(I.pos, I.yaw, loc, wpos);
          P.spawn(wpos[0] + (Math.random() - 0.5) * e[3], wpos[1] + 0.2, wpos[2] + (Math.random() - 0.5) * e[3], (Math.random() - 0.5) * 0.15, 0.35 + Math.random() * 0.3, (Math.random() - 0.5) * 0.15, { life: 2.2 + Math.random(), size: 0.12 + e[3] * 0.25, grav: -0.05, col: [0.86, 0.88, 0.92], drag: 0.6, grow: 0.5, collide: false });
        }
        if (dist < 25 && g.audio && g.audio.ctx && g.audio.tone && (c.tick -= dt) <= 0) { c.tick = 0.35 + Math.random() * 1.2 / Math.max(0.2, k); g.audio.tone(2600 + Math.random() * 1800, 0.012 * k * (1 - dist / 25), 0.03, 'triangle'); }
      }
      // the landing lights at night: the nose light, red and green at the wingtips, a soft cone under the hull as it settles
      if (night > 0.4 && this.tier >= 2 && q.phase !== 'parked' && dist < 420) {
        const B = m.bounds, blink = (this.clock * 1.3 + q.m) % 1 < 0.18;
        loc[0] = 0; loc[1] = B[4] * 0.4; loc[2] = B[2] - 0.3; PL.toWorld(I.pos, I.yaw, loc, wpos); P.glow(wpos[0], wpos[1], wpos[2], [1, 0.96, 0.85], 0.06, 0.55, 0);
        if (blink) { loc[0] = B[0] - 0.2; loc[1] = B[4] * 0.45; loc[2] = (B[2] + B[5]) * 0.5; PL.toWorld(I.pos, I.yaw, loc, wpos); P.glow(wpos[0], wpos[1], wpos[2], [1, 0.2, 0.15], 0.12, 0.4, 0); loc[0] = B[3] + 0.2; PL.toWorld(I.pos, I.yaw, loc, wpos); P.glow(wpos[0], wpos[1], wpos[2], [0.2, 1, 0.35], 0.12, 0.4, 0); }
        if ((q.phase === 'slide' || q.phase === 'settle' || q.phase === 'hold') && Math.random() < dt * 8) P.spawn(I.pos[0] + (Math.random() - 0.5) * 3, I.pos[1] - Math.random() * 4, I.pos[2] + (Math.random() - 0.5) * 3, 0, -0.5, 0, { life: 0.5, size: 1.2, grav: 0, col: [0.5, 0.48, 0.42], emis: 1, drag: 0, collide: false, grow: 1.5 });
      }
    }
    draw(r, E, layer, cam) {
      const g = this.g, SS = g.starships;
      if (!this.on || !SS) return;
      cam = cam || r.cam;
      let prog = null, n = 0;
      for (const pad of this.pads.values()) {
        if (!pad.live) continue;
        for (const q of pad.live) {
          const c = pad.crafts.get(q.m); if (!c || !c.d.gpu || c.alpha < 0.02) continue;
          const I = c.inst, m = c.d.meta, rad = Math.max(m.length, m.width, m.height) * 0.6;
          const dx = I.pos[0] - cam.x, dy = I.pos[1] + m.height * 0.5 - cam.y, dz = I.pos[2] - cam.z;
          if (!VR.mat4.boxInFrustum(r.planes, dx - rad, dy - rad, dz - rad, dx + rad, dy + rad, dz + rad)) continue;
          const light = SS.lightAt(I.pos[0], I.pos[1] + m.height + 1, I.pos[2]);
          if (c.alpha >= 0.99) {
            if (layer !== 'opaque' && !c.d.gpu.glass) continue;
            if (!prog) prog = SS.begin(r, E, layer);
            if (prog.u.u_clipNear) r.gl.uniform1f(prog.u.u_clipNear, 0);
            SS.drawOne(r, prog, I, cam, layer, light, 1, false);
            n++;
          } else if (layer !== 'opaque' && SS.drawAlpha) {
            if (prog) { SS.end(r, layer); prog = null; }
            SS.drawAlpha(r, E, I, cam, c.alpha, light);
            n++;
          }
        }
      }
      if (prog) SS.end(r, layer);
      if (layer === 'opaque') this.drawFolk(r, E, cam);
      if (layer === 'opaque') this.st.drawn = n;
    }
    // the crews and the drones (the villagers' vox program)
    drawFolk(r, E, cam) {
      const g = this.g, ent = g.entities; if (!ent || this.tier < 1) return;
      let p = null;
      const t = g.time || 0;
      const one = (f) => { if (!f.on) return; if (!p) p = ent.beginVox(r, E); LK.drawFolk(g, r, p, f, cam, t); };
      const pose = this.dronePose || (this.dronePose = { rotor_l: [0, 0, 0], rotor_r: [0, 0, 0] });
      pose.rotor_l[1] = t * 30; pose.rotor_r[1] = -t * 30;
      const drone = (pos, yaw) => { if (!p) p = ent.beginVox(r, E); LK.drawModel(g, r, p, 'hover_drone', pos, yaw, cam, { pose }); };
      for (const pad of this.pads.values()) {
        if (pad.ground) { for (const f of pad.ground.folk) one(f); if (pad.ground.droneOn) drone(pad.ground.dronePos, pad.ground.droneYaw); }
        if (!pad.live) continue;
        for (const q of pad.live) {
          const c = pad.crafts.get(q.m); if (!c) continue;
          if (c.crewOn) for (const f of c.folk) one(f);
          if (c.droneOn) drone(c.dronePos, c.droneYaw);
        }
      }
    }
    stats() {
      const s = Object.assign({}, this.st);
      let crewOn = 0, phases = [];
      for (const pad of this.pads.values()) { if (pad.live) for (const q of pad.live) { phases.push(pad.key + ':' + q.phase); const c = pad.crafts.get(q.m); if (c && c.crewOn) for (const f of c.folk) if (f.on) crewOn++; } }
      s.crewOn = crewOn; s.clock = +this.clock.toFixed(1); s.phases = phases;
      return s;
    }
    // put a pad's current visit at a moment of its stay (a camera director, the picture test): 'crew' — 32 s in
    jump(key, what) {
      if (!this.pads.get(key)) this.findTemple();
      const p = this.pads.get(key); if (!p) return false;
      const c = PL.visitAt(p.seed, this.clock, p.cache || (p.cache = { seed: p.seed, n: 0, T: PL.t0(p.seed) }));
      const want = what === 'crew' ? 32 : what === 'land' ? -6 : 0;
      this.clock = c.T + want;
      const Tr = this.g.trails; if (Tr && Tr.map) for (const k of [...Tr.map.keys()]) if (String(k).startsWith('pl')) Tr.map.delete(k);
      return true;
    }
    destroy() { this.pads.clear(); }
  };
})(VR);
