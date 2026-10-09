// ============================================================================
// Ships that stay (t-life, docs/superpowers/plans/2026-10-09-t-life.md §3.1). The owner: "ich finde es doof, dass die
// Shuttles ingame verschwinden". A pad is now a schedule, not a flash: a craft comes in from the horizon, waits beside
// the pad while the one before it is still parked, slides over, settles, and stays 60–180 s — its engines cooling (the
// plume dies down, a thin vapour, the metal ticks), the ramp down, a crew of 2–3 in flight clothes walking out, talking,
// checking the gear and an engine, a service drone circling — then the crew walks back, the ramp closes, it lifts, turns
// and climbs away to the horizon, fading in the haze. The next craft is already holding when one lifts: the pad is never
// empty for more than 10 s, at least 85 % of any ten minutes occupied. No warp flash anywhere.
//   Pads: the Gate Temple's apron (in front of the portal), and every pad where a world ship is parked (outposts, tech
//   villages): there the parked ship gets the ground crew and the drone (it is the player's ship: it never leaves), and
//   visitors use the pad only while it is free.
//   The schedule is pure (PL.visitAt, PL.pose, PL.crew, PL.drone: test/life_sched.js) and runs on the world's clock (the
//   trams' clock: the world time at the start, then real seconds), so every guest sees the same visit.
//   Cost: tier 0 (Very Low) the visiting craft only; tier 1 + a crew of two, the drone, the dust; tier 2+ a crew of up to
//   three, vapour, ticking, the landing lights at night. Switch: settings.padLife (⚙ Bild · Dinge & Effekte).
// ============================================================================
(function (VR) {
  'use strict';
  const LK = VR.LifeKit, h = LK.h, TAU = Math.PI * 2;
  const PL = VR.PadLife = {};
  // the timeline of a visit (seconds): GAP = SLIDE0 + SLIDE + SETTLE — from the lift of one craft to the touchdown of the next
  Object.assign(PL, { GAP: 10, STAY0: 60, STAY1: 180, APP: 45, HOLDT: 14, LIFT: 2.5, SLIDE0: 4.5, SLIDE: 2.5, SETTLE: 3, DEP: 45, FAR: 700, LIFTH: 6, FADE0: 420, FADE1: 600 });
  PL.ACT = PL.FAR + PL.FADE1;   // a pad's craft are simulated within this many blocks of the eye (beyond, all of them are faded out)
  PL.CREW = { exit0: 6.5, exitStep: 1.7, speed: 1.6, back: 22, backStep: 0.8, rampOpen: 4, rampClose: 6 };
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
  // the times of visit m whose touchdown is T: the approach, the hold, the slide, the settle, the stay, the lift, the departure
  PL.times = function (seed, m, T, o) {
    const Lp = T - PL.GAP, S = PL.stay(seed, m, o), L = T + S;
    return { A0: Lp + PL.SLIDE0 - PL.HOLDT - PL.APP, A1: Lp + PL.SLIDE0 - PL.HOLDT, H1: Lp + PL.SLIDE0, S1: Lp + PL.SLIDE0 + PL.SLIDE, T, S, L, L1: L + PL.LIFT, D1: L + PL.LIFT + PL.DEP };
  };
  const rot = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
  const bez = (A, C, B, u, o) => { const w = 1 - u; o[0] = w * w * A[0] + 2 * w * u * C[0] + u * u * B[0]; o[1] = w * w * A[1] + 2 * w * u * C[1] + u * u * B[1]; o[2] = w * w * A[2] + 2 * w * u * C[2] + u * u * B[2]; return o; };
  const bezD = (A, C, B, u) => [2 * (1 - u) * (C[0] - A[0]) + 2 * u * (B[0] - C[0]), 2 * (1 - u) * (C[2] - A[2]) + 2 * u * (B[2] - C[2])];
  // the points of visit m at a pad: pad = {x, y, z, yaw (parked heading), out: [dx, dz] (the open side, unit)}
  PL.points = function (pad, seed, m) {
    const P = [pad.x, pad.y, pad.z], f = pad.out, right = [-f[1], f[0]], side = (m & 1) ? 1 : -1;
    const dIn = rot(f, (h(seed, m, 11) - 0.5) * 1.7), dOut = rot(f, (h(seed, m, 13) - 0.5) * 1.7);
    const Hd = [P[0] + right[0] * side * 24 + f[0] * 6, P[1] + 10, P[2] + right[1] * side * 24 + f[1] * 6];
    return {
      P, Hd, Hv: [P[0], P[1] + PL.LIFTH, P[2]], D0: [P[0], P[1] + PL.LIFTH, P[2]],
      Q0: [P[0] + dIn[0] * PL.FAR, P[1] + 70 + 40 * h(seed, m, 17), P[2] + dIn[1] * PL.FAR], C0: [Hd[0] + dIn[0] * 140, Hd[1] + 24, Hd[2] + dIn[1] * 140],
      C1: [P[0] + f[0] * 90, P[1] + 20, P[2] + f[1] * 90], Q1: [P[0] + dOut[0] * PL.FAR, P[1] + 90 + 40 * h(seed, m, 19), P[2] + dOut[1] * PL.FAR],
    };
  };
  // the pose of visit m's craft at time t (null when it is not around): {phase, pos (the ground point under the hull: the
  // gear's feet), yaw, pitch, roll, gear, thrust, u (seconds since the touchdown, while parked), S, padFade (0 … 1: it
  // fades in and out at its horizon points)}
  PL.pose = function (pad, seed, m, T, t, out, o) {
    const W = PL.times(seed, m, T, o);
    if (t < W.A0 || t >= W.D1) return null;
    const Q = PL.points(pad, seed, m);
    out = out || {};
    const p = out.pos || (out.pos = [0, 0, 0]);
    out.S = W.S; out.u = t - W.T; out.m = m; out.T = T; out.pitch = 0; out.roll = 0; out.padFade = 1;
    const yawP = pad.yaw;
    if (t < W.A1) {
      const u = (t - W.A0) / PL.APP, e = 1 - (1 - u) * (1 - u);
      bez(Q.Q0, Q.C0, Q.Hd, e, p); const d = bezD(Q.Q0, Q.C0, Q.Hd, Math.min(0.999, e));
      out.phase = 'approach'; out.yaw = LK.yawOf(d[0], d[1]); out.gear = 0; out.thrust = 0.85;
      out.padFade = LK.smooth(u / 0.12);
      const d2 = bezD(Q.Q0, Q.C0, Q.Hd, Math.min(0.999, 1 - (1 - Math.min(1, u + 0.02)) ** 2));
      out.roll = Math.max(-0.45, Math.min(0.45, LK.wrap(LK.yawOf(d2[0], d2[1]) - out.yaw) * 12));
      out.pitch = 0.08 * u * u;
    } else if (t < W.H1) {
      const u = t - W.A1, Q2 = bezD(Q.Q0, Q.C0, Q.Hd, 0.999), y0 = LK.yawOf(Q2[0], Q2[1]);
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
      out.thrust = u < 15 ? 0.25 * (1 - u / 15) : u > W.S - 4 ? 0.25 * (u - (W.S - 4)) / 4 : 0;
    } else if (t < W.L1) {
      const u = LK.smooth((t - W.L) / PL.LIFT);
      p[0] = Q.P[0]; p[1] = Q.P[1] + PL.LIFTH * u; p[2] = Q.P[2];
      out.phase = 'lift'; out.yaw = yawP; out.gear = 1 - u; out.thrust = 0.6;
    } else {
      const u = (t - W.L1) / PL.DEP, e = u * u;
      bez(Q.D0, Q.C1, Q.Q1, e, p); const d = bezD(Q.D0, Q.C1, Q.Q1, Math.max(0.001, e));
      out.phase = 'depart'; out.yaw = LK.yawOf(d[0], d[1]); out.gear = 0; out.thrust = 0.9;
      out.padFade = 1 - LK.smooth((u - 0.88) / 0.12);
      out.pitch = -0.06 * Math.min(1, u * 4);
      const d2 = bezD(Q.D0, Q.C1, Q.Q1, Math.min(1, (u + 0.02) * (u + 0.02)));
      out.roll = Math.max(-0.45, Math.min(0.45, LK.wrap(LK.yawOf(d2[0], d2[1]) - out.yaw) * 12));
    }
    return out;
  };
  // the craft around a pad at time t (at most three: the one leaving, the one on the pad, the one coming): poses
  PL.active = function (pad, seed, t, cache, outs, o) {
    const c = PL.visitAt(seed, t, cache, o), list = [];
    const Tm1 = c.T - PL.stay(seed, c.n - 1, o) - PL.GAP, Tp1 = c.T + PL.stay(seed, c.n, o) + PL.GAP;
    const ms = [[c.n - 1, Tm1], [c.n, c.T], [c.n + 1, Tp1]];
    for (let k = 0; k < 3; k++) { const q = PL.pose(pad, seed, ms[k][0], ms[k][1], t, outs ? outs[k] : null, o); if (q) list.push(q); }
    return list;
  };

  // ---------------------------------------------------------------- the crew and the drone (ship-local, then the parked pose)
  // geom (ship-local metres, already scaled): {bounds [x0, y0, z0, x1, y1, z1] (the nose at −z), ramp: {hinge [x, y, z],
  // len} or null, floor, gears [[x, z] …], engines [[x, y, z, r] …]}
  PL.geom = function (meta, scale) {
    const k = scale || 1, B = meta.bounds, C = meta.cabin;
    const g = { bounds: B.map(v => v * k), ramp: null, floor: 0, gears: (meta.gear || []).map(q => [q[0] * k, q[1] * k]), engines: (meta.exhaust || []).map(e => [e[0] * k, e[1] * k, e[2] * k, e[3] * k]), scale: k };
    if (C && C.ramp) g.ramp = { hinge: [C.ramp.hinge[0] * k, C.ramp.hinge[1] * k, C.ramp.hinge[2] * k], len: C.ramp.len * k, open: C.ramp.open };
    g.floor = C ? C.floor * k : 0;
    return g;
  };
  // the crew's paths: out of the ship (down the ramp, or out of a side hatch) and round the hull to their places
  PL.crewPlan = function (seed, m, G) {
    const B = G.bounds, hw = Math.max(Math.abs(B[0]), Math.abs(B[3])), z0 = B[2], z1 = B[5], off = hw + 1.6;
    const N = 2 + (h(seed, m, 21) > 0.4 ? 1 : 0), side = h(seed, m, 23) < 0.5 ? -1 : 1;
    let inside, top, foot;
    if (G.ramp) {
      const R0 = G.ramp, a = R0.open || 2.09;
      top = [0, R0.hinge[1], R0.hinge[2]]; inside = [0, R0.hinge[1], R0.hinge[2] - 1.6];
      foot = [0, Math.max(0, R0.hinge[1] + R0.len * Math.cos(a)), R0.hinge[2] + R0.len * Math.sin(a)];
    } else {
      const zm = (z0 + z1) * 0.5 + (z1 - z0) * 0.15;
      inside = [side * (hw - 0.6), 0, zm]; top = [side * (hw + 0.2), 0, zm]; foot = [side * (hw + 0.9), 0, zm];
    }
    const back = [foot[0], 0, Math.max(foot[2], z1) + 1.6], corner = [side * off, 0, z1 + 1.6];
    const eng = G.engines.length ? G.engines[Math.floor(h(seed, m, 25) * G.engines.length)] : [side * hw * 0.5, 1, z1, 0.5];
    const gear = G.gears.length ? G.gears[Math.floor(h(seed, m, 27) * G.gears.length)] : [side * hw * 0.6, z0 * 0.4];
    const stations = [
      [side * off, 0, z1 - 0.32 * (z1 - z0)],                                                    // the captain: by the hull's side, toward the tail
      [eng[0] + (eng[0] >= 0 ? 0.9 : -0.9), 0, z1 + 1.5],                                          // the engineer: behind an engine
      [gear[0] + (gear[0] >= 0 ? 1.1 : -1.1), 0, gear[1]],                                         // the co-pilot: at a gear foot
    ];
    const plans = [];
    for (let i = 0; i < N; i++) {
      const st = stations[i], pts = [inside, top, foot];
      if (i === 1) pts.push([st[0], 0, Math.max(st[2], foot[2] + 0.5)], st);   // straight back to the engine
      else { pts.push(back, corner); if (Math.abs(st[0]) < hw + 0.5) pts.push([side * off, 0, st[2]]); pts.push(st); }
      plans.push({ i, path: LK.path(pts.map(q => q.slice())), st, look: i === 1 ? [eng[0], 0, eng[2]] : i === 2 ? [gear[0], 0, gear[1]] : [0, 0, (z0 + z1) * 0.5] });
    }
    return { N, side, plans, foot, inside };
  };
  // the crew at u seconds into a stay of S seconds: [{i, on, pos (local), yaw (local), state, walk, walkAmt, talking}]
  // (out of the ship one after the other, round the hull to their places; the co-pilot checks the gear and then joins the
  // captain to talk; back the same way in turn, all aboard before the ramp closes)
  PL.crewTimes = function (pl, S) {
    const C = PL.CREW, meet = pl.plans[0].st, st2 = [meet[0] + (meet[0] >= 0 ? -1 : 1) * 0.2, 0, meet[2] - 1.3], T = [];
    for (let i = 0; i < pl.N; i++) {
      const P = pl.plans[i], e = C.exit0 + C.exitStep * i, arrive = e + P.path.L / C.speed;
      let checkEnd = arrive, moveEnd = arrive;
      if (i === 2) { checkEnd = arrive + 7; moveEnd = checkEnd + Math.hypot(st2[0] - P.st[0], st2[2] - P.st[2]) / C.speed; }
      const b = Math.max(arrive, S - C.back + C.backStep * i);
      T.push({ e, arrive, checkEnd, moveEnd, b });
    }
    return { T, st2 };
  };
  PL.crew = function (seed, m, u, S, G, plan, out) {
    const C = PL.CREW, pl = plan || PL.crewPlan(seed, m, G), N = pl.N, CT = PL.crewTimes(pl, S), st2 = CT.st2;
    out = out || [];
    out.length = N;
    for (let i = 0; i < N; i++) {
      const P = pl.plans[i], W = CT.T[i], o = out[i] || (out[i] = { i, pos: [0, 0, 0], yaw: 0 });
      const L = P.path.L, tmp = o.tmp || (o.tmp = [0, 0, 0, 0]);
      o.on = false; o.state = 'idle'; o.walk = 0; o.walkAmt = 0; o.talking = false;
      if (u < W.e || u > S) continue;
      if (u < W.arrive) { o.walk = (u - W.e) * C.speed; LK.along(P.path, o.walk, tmp); o.walkAmt = 1; }
      else if (u < W.b) {
        if (i === 2 && u >= W.checkEnd) {
          if (u < W.moveEnd) { const k = (u - W.checkEnd) / Math.max(0.01, W.moveEnd - W.checkEnd); tmp[0] = P.st[0] + (st2[0] - P.st[0]) * k; tmp[1] = 0; tmp[2] = P.st[2] + (st2[2] - P.st[2]) * k; tmp[3] = LK.yawOf(st2[0] - P.st[0], st2[2] - P.st[2]); o.walk = (u - W.checkEnd) * C.speed; o.walkAmt = 1; }
          else { const m0 = pl.plans[0].st; tmp[0] = st2[0]; tmp[1] = 0; tmp[2] = st2[2]; tmp[3] = LK.yawOf(m0[0] - st2[0], m0[2] - st2[2]); o.state = 'talk'; o.talking = (u - W.moveEnd) % 7 > 3.5; }
        } else {
          tmp[0] = P.st[0]; tmp[1] = 0; tmp[2] = P.st[2];
          // the captain turns to the co-pilot once they stand together, else looks at the ship
          const lk = i === 0 && N > 2 && u >= CT.T[2].moveEnd ? st2 : P.look;
          tmp[3] = LK.yawOf(lk[0] - P.st[0], lk[2] - P.st[2]);
          const k = (u - W.arrive) % 14;
          if (i === 0) { o.state = k < 9 ? 'talk' : k < 11 ? 'point' : 'idle'; o.talking = k < 9 && (N < 3 || (u - CT.T[2].moveEnd) % 7 <= 3.5); }
          else if (i === 1) o.state = k < 6 ? 'crouch' : k < 8.5 ? 'idle' : k < 10.5 ? 'point' : 'crouch';
          else o.state = 'crouch';
        }
      } else {
        // back to the ship along the way out (the co-pilot from beside the captain first)
        const d = (u - W.b) * C.speed, from = i === 2 && W.b >= W.moveEnd ? st2 : P.st;
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
    const ox = Math.cos(a) * rx * up, oz = zc + Math.sin(a) * rz * up + (1 - up) * 0;
    out.pos[0] = ox; out.pos[1] = top + 2.2 * up + Math.sin(u * 1.7) * 0.15; out.pos[2] = oz;
    out.yaw = LK.yawOf(-Math.sin(a), Math.cos(a));
    return out;
  };
  // ship-local → world for a parked craft (pos, yaw)
  PL.toWorld = (pos, yaw, l, out) => { const c = Math.cos(yaw), s = Math.sin(yaw); out = out || [0, 0, 0]; out[0] = pos[0] + l[0] * c + l[2] * s; out[1] = pos[1] + l[1]; out[2] = pos[2] - l[0] * s + l[2] * c; return out; };
  // the tier of a settings record (as the living air's): 0 Very Low … 4 Ultra
  PL.tierOf = (S) => (VR.AirLife && VR.AirLife.tierOf ? VR.AirLife.tierOf(S) : 2);

  // ---------------------------------------------------------------- in the game
  PL.Actor = class {
    constructor(game) {
      this.g = game;
      const E = game.env;
      this.clock = E ? ((E.day || 0) * 24000 + (E.ticks || 0)) / 20 : 0;   // the world's clock (as the trams')
      this.pads = new Map();                                                // key → pad
      this.scanT = 0; this.templeT = 0; this.on = true; this.tier = 2;
      this.st = { pads: 0, crafts: 0, parked: 0, crew: 0, drones: 0, drawn: 0 };
    }
    // the Gate Temple's apron (the runway in front of the portal: its veil stands at z 20) once the temple's chunk is there
    findTemple() {
      const w = this.g.world, R = VR.R; if (!w || !R || !R.byName.portal_veil) return;
      const b = w.getBlock(0, 81, 20);
      if (b && R.T.type[b] === R.byName.portal_veil.id && !this.pads.has('apron')) {
        const seed = (Math.imul((this.g.meta && this.g.meta.seed) | 0, 0x9e3779b1) ^ 0x7e3a11) | 0;
        this.pads.set('apron', { key: 'apron', kind: 'apron', seed, x: 0.5, y: 81, z: 38, yaw: Math.PI, out: [0, 1], cache: null, crafts: new Map() });
      }
    }
    // the pads with a parked world ship (outposts, tech villages): their crew does its rounds; visitors while it is gone
    scanShips() {
      const SS = this.g.starships; if (!SS) return;
      for (const s of SS.ships) {
        if (!s.key || s.hangar || this.pads.has(s.key)) continue;
        const k = s.key.split(',').map(Number); if (k.length < 3 || k.some(v => !isFinite(v))) continue;
        const seed = (Math.imul(k[0] | 0, 0x1f1f1f1f) ^ Math.imul(k[2] | 0, 0x2545f491) ^ ((this.g.meta && this.g.meta.seed) | 0)) | 0;
        // (a visitor parks as the world ship stood and leaves nose first: out is the nose's direction)
        this.pads.set(s.key, { key: s.key, kind: 'outpost', seed, x: k[0] + 0.5, y: k[1], z: k[2] + 0.5, yaw: s.yaw, out: [-Math.sin(s.yaw), -Math.cos(s.yaw)], ship: s, cache: null, crafts: new Map() });
      }
    }
    // a world ship stands on this pad (parked where it was spawned, nobody at its controls)
    occupied(pad) { const s = pad.ship; if (!s) return false; const SS = this.g.starships; return SS.ships.includes(s) && SS.pilot !== s && s.state === 'parked' && Math.hypot(s.pos[0] - pad.x, s.pos[2] - pad.z) < 6; }
    update(dt) {
      const g = this.g, S = g.settings || {}, pl = g.player;
      this.clock += dt;
      this.on = S.padLife !== false && g.dim === 'overworld' && g.state === 'play';
      this.tier = PL.tierOf(S);
      const st = this.st; st.pads = this.pads.size; st.crafts = 0; st.parked = 0; st.crew = 0; st.drones = 0;
      if (!this.on || !pl || !g.starships) { for (const p of this.pads.values()) p.live = null; return; }
      if ((this.templeT -= dt) <= 0) { this.templeT = 2; this.findTemple(); }
      if ((this.scanT -= dt) <= 0) { this.scanT = 3; this.scanShips(); }
      const E = g.env && g.env.E, night = E ? E.night || 0 : 0;
      for (const pad of this.pads.values()) {
        const d = Math.hypot(pad.x - pl.pos[0], pad.z - pl.pos[2]);
        if (d > PL.ACT) { pad.live = null; continue; }
        if (pad.kind === 'outpost' && pad.ship && this.occupied(pad)) { this.groundCrew(pad, dt, d); continue; }
        pad.ground = null;
        pad.outs = pad.outs || [{}, {}, {}];
        const list = PL.active(pad, pad.seed, this.clock, pad.cache || (pad.cache = { seed: pad.seed, n: 0, T: PL.t0(pad.seed) }), pad.outs);
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
        for (const k of pad.crafts.keys()) if (k < q.m - 2 || k > q.m + 2) pad.crafts.delete(k);
      }
      c.seen = this.clock; c.q = q;
      const d = c.d; d.last = performance.now();
      const I = c.inst; I.d = d;
      I.pos[0] = q.pos[0]; I.pos[1] = q.pos[1]; I.pos[2] = q.pos[2]; I.yaw = q.yaw; I.pitch = q.pitch; I.roll = q.roll; I.gear = q.gear;
      const pl = g.player.pos, dist = Math.hypot(q.pos[0] - pl[0], q.pos[1] - pl[1], q.pos[2] - pl[2]);
      c.alpha = q.padFade * (1 - LK.smooth((dist - PL.FADE0) / (PL.FADE1 - PL.FADE0)));
      c.dist = dist;
      st.crafts++;
      if (q.phase === 'parked') st.parked++;
      if (!d.meta) return;
      if (!c.G) { c.G = PL.geom(d.meta, 1); c.plan = PL.crewPlan(pad.seed, q.m, c.G); }
      I.hatch.ramp = q.phase === 'parked' && c.G.ramp ? PL.ramp(q.u, q.S) : 0;
      // the crew and the drone (tier 1 and up, near the eye)
      c.crewOn = q.phase === 'parked' && this.tier >= 1 && dist < 90;
      if (c.crewOn) {
        c.crew = PL.crew(pad.seed, q.m, q.u, q.S, c.G, c.plan, c.crew || []);
        const maxN = this.tier >= 2 ? 3 : 2;
        for (let i = 0; i < c.crew.length; i++) {
          const o = c.crew[i], f = c.folk[i] || (c.folk[i] = { look: LK.folk(PL.craftSeed(pad.seed, q.m) + i * 7919, i === 1 ? 'operator' : 'pilot', 'adult'), pos: [0, 0, 0], yaw: 0, seed: i * 1.7 });
          f.on = o.on && i < maxN;
          if (!f.on) continue;
          PL.toWorld(I.pos, I.yaw, o.pos, f.pos);
          // on the ramp the figure walks up its slope (the ramp's local height under its feet)
          f.yaw = o.yaw + I.yaw; f.state = o.state; f.walk = o.walk; f.walkAmt = o.walkAmt; f.talking = o.talking;
          st.crew++;
        }
        const D = PL.drone(pad.seed, q.m, q.u, q.S, c.G, c.drone);
        c.droneOn = D.on && this.tier >= 1;
        if (c.droneOn) { c.dronePos = PL.toWorld(I.pos, I.yaw, D.pos, c.dronePos); c.droneYaw = D.yaw + I.yaw; st.drones++; }
      } else { c.droneOn = false; }
      this.fx(pad, c, q, dt, dist, night);
    }
    // a parked world ship's ground crew (outposts): the same scene round a ship that never leaves (its stay repeats)
    groundCrew(pad, dt, dPad) {
      const g = this.g, s = pad.ship, st = this.st;
      pad.live = null;
      if (this.tier < 1 || dPad > 90 || !s.d.meta) { pad.ground = null; return; }
      const S = 150, cyc = Math.floor(this.clock / (S + 30)), u = this.clock - cyc * (S + 30);
      let G = pad.ground;
      if (!G || G.cyc !== cyc) G = pad.ground = { cyc, G: PL.geom(s.d.meta, 1), folk: [], crew: [], drone: { pos: [0, 0, 0], yaw: 0 } };
      // (the ship's own ramp stays as the player left it: the crew uses a side hatch)
      const geo = Object.assign({}, G.G, { ramp: null });
      if (!G.plan2 || G.plan2.cyc !== cyc) G.plan2 = Object.assign(PL.crewPlan(pad.seed, cyc, geo), { cyc });
      const crew = PL.crew(pad.seed, cyc, u, S, geo, G.plan2, G.crew);
      const maxN = this.tier >= 2 ? 3 : 2;
      for (let i = 0; i < crew.length; i++) {
        const o = crew[i], f = G.folk[i] || (G.folk[i] = { look: LK.folk((pad.seed ^ cyc * 31) + i * 7919, i === 1 ? 'operator' : 'pilot', 'adult'), pos: [0, 0, 0], yaw: 0, seed: i });
        f.on = o.on && i < maxN; if (!f.on) continue;
        PL.toWorld(s.pos, s.yaw, o.pos, f.pos); f.yaw = o.yaw + s.yaw; f.state = o.state; f.walk = o.walk; f.walkAmt = o.walkAmt; f.talking = o.talking; st.crew++;
      }
      const D = PL.drone(pad.seed, cyc, u, S, G.G, G.drone);
      G.droneOn = D.on; if (D.on) { G.dronePos = PL.toWorld(s.pos, s.yaw, D.pos, G.dronePos); G.droneYaw = D.yaw + s.yaw; st.drones++; }
      void dt;
    }
    // the engines (a plume while flying, cooling down on the pad), vapour and ticking while they cool, dust as it settles
    // and lifts, the landing lights at night — only near the eye, by tier
    fx(pad, c, q, dt, dist, night) {
      const g = this.g, m = c.d.meta, P = g.particles, T = g.trails, I = c.inst;
      if (!m || this.tier < 1 || dist > 260 || c.alpha < 0.05) return;
      const cY = Math.cos(I.yaw), sY = Math.sin(I.yaw), wpos = c.wp || (c.wp = [0, 0, 0]);
      const air = q.phase === 'approach' || q.phase === 'depart';
      if (T && q.thrust > 0.01) for (let ei = 0; ei < m.exhaust.length; ei++) {
        const e = m.exhaust[ei]; PL.toWorld(I.pos, I.yaw, [e[0], e[1], e[2] + 0.3], wpos);
        const cool = q.phase === 'parked' ? Math.min(1, q.thrust * 4) : 1;
        T.engine(c.tid + ei, wpos.slice(), air ? 40 : 0, { thrust: q.thrust, size: e[3] * (air ? 1.4 : 1), col: air ? [0.5, 0.85, 1] : [1, 0.42 + 0.26 * cool, 0.2 + 0.12 * cool], minor: ei > 1, smokeLife: 5 });
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
          PL.toWorld(I.pos, I.yaw, [e[0], e[1], e[2] + 0.2], wpos);
          P.spawn(wpos[0] + (Math.random() - 0.5) * e[3], wpos[1] + 0.2, wpos[2] + (Math.random() - 0.5) * e[3], (Math.random() - 0.5) * 0.15, 0.35 + Math.random() * 0.3, (Math.random() - 0.5) * 0.15, { life: 2.2 + Math.random(), size: 0.12 + e[3] * 0.25, grav: -0.05, col: [0.86, 0.88, 0.92], drag: 0.6, grow: 0.5, collide: false });
        }
        if (dist < 25 && g.audio && g.audio.tone && (c.tick -= dt) <= 0) { c.tick = 0.35 + Math.random() * 1.2 / Math.max(0.2, k); if (g.audio.ctx) g.audio.tone(2600 + Math.random() * 1800, 0.012 * k * (1 - dist / 25), 0.03, 'triangle'); }
      }
      // the landing lights at night: the nose light, red and green at the wingtips, a soft cone under the hull as it settles
      if (night > 0.4 && this.tier >= 2 && q.phase !== 'parked' && dist < 420) {
        const B = m.bounds, blink = (this.clock * 1.3 + q.m) % 1 < 0.18;
        PL.toWorld(I.pos, I.yaw, [0, B[4] * 0.4, B[2] - 0.3], wpos); P.glow(wpos[0], wpos[1], wpos[2], [1, 0.96, 0.85], 0.06, 0.55, 0);
        if (blink) { PL.toWorld(I.pos, I.yaw, [B[0] - 0.2, B[4] * 0.45, (B[2] + B[5]) * 0.5], wpos); P.glow(wpos[0], wpos[1], wpos[2], [1, 0.2, 0.15], 0.12, 0.4, 0); PL.toWorld(I.pos, I.yaw, [B[3] + 0.2, B[4] * 0.45, (B[2] + B[5]) * 0.5], wpos); P.glow(wpos[0], wpos[1], wpos[2], [0.2, 1, 0.35], 0.12, 0.4, 0); }
        if ((q.phase === 'slide' || q.phase === 'settle' || q.phase === 'hold') && Math.random() < dt * 8) P.spawn(I.pos[0] + (Math.random() - 0.5) * 3, I.pos[1] - Math.random() * 4, I.pos[2] + (Math.random() - 0.5) * 3, 0, -0.5, 0, { life: 0.5, size: 1.2, grav: 0, col: [0.5, 0.48, 0.42], emis: 1, drag: 0, collide: false, grow: 1.5 });
      }
      void cY; void sY;
    }
    draw(r, E, layer, cam) {
      const g = this.g, SS = g.starships;
      if (!this.on || !SS) return;
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
          } else if (layer !== 'opaque') {
            if (prog) { SS.end(r, layer); prog = null; }
            SS.drawAlpha(r, E, I, cam, c.alpha, light);
            n++;
          }
        }
      }
      if (prog) SS.end(r, layer);
      if (layer === 'opaque') this.drawFolk(r, E, cam);
      this.st.drawn = n;
    }
    // the crews and the drones (the villagers' vox program)
    drawFolk(r, E, cam) {
      const g = this.g, ent = g.entities; if (!ent || this.tier < 1) return;
      let p = null;
      const t = g.time || 0;
      const one = (f) => { if (!f.on) return; if (!p) p = ent.beginVox(r, E); LK.drawFolk(g, r, p, f, cam, t); };
      const drone = (pos, yaw) => { if (!p) p = ent.beginVox(r, E); LK.drawModel(g, r, p, 'hover_drone', pos, yaw, cam, { pose: { rotor_l: [0, t * 30, 0], rotor_r: [0, -t * 30, 0] } }); };
      for (const pad of this.pads.values()) {
        if (pad.ground) { for (const f of pad.ground.folk) one(f); if (pad.ground.droneOn) drone(pad.ground.dronePos, pad.ground.droneYaw); }
        if (!pad.live) continue;
        for (const q of pad.live) {
          const c = pad.crafts.get(q.m); if (!c || !c.crewOn) continue;
          for (const f of c.folk) one(f);
          if (c.droneOn) drone(c.dronePos, c.droneYaw);
        }
      }
    }
    stats() {
      const s = Object.assign({}, this.st);
      let crewDrawnable = 0; for (const pad of this.pads.values()) { if (pad.live) for (const q of pad.live) { const c = pad.crafts.get(q.m); if (c && c.crewOn) for (const f of c.folk) if (f.on) crewDrawnable++; } }
      s.crewOn = crewDrawnable; s.clock = +this.clock.toFixed(1);
      return s;
    }
    // put a pad's current visit at a moment of its stay (a camera director, the picture test): 'crew' — 32 s in
    jump(key, what) {
      const pad = this.pads.get(key); if (!pad) { this.findTemple(); }
      const p = this.pads.get(key); if (!p) return false;
      const c = PL.visitAt(p.seed, this.clock, p.cache || (p.cache = { seed: p.seed, n: 0, T: PL.t0(p.seed) }));
      const want = what === 'crew' ? 32 : what === 'land' ? -6 : 0;
      this.clock = c.T + want;
      const Tr = this.g.trails; if (Tr && Tr.map) for (const k of [...Tr.map.keys()]) if (k.startsWith('pl')) Tr.map.delete(k);
      return true;
    }
    destroy() { this.pads.clear(); }
  };
})(VR);
