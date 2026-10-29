// ============================================================================
// u-cruise · VR.Cruise — the Reiseantrieb between the worlds of Helia (docs/superpowers/plans/2026-10-29-u-cruise.md;
// U§5.5, §5.6, §6.2, §10). Picked by intent (the body the camera looks at, G), the drive takes hold with a punch, the ship
// climbs out of the body it leaves, cruises at 0.25 s⁻¹ × the distance to the nearest surface (no cap: the bodies swell
// and slide, the stars stay), and drops into a circular orbit round the target; Landen there flies the descent into the
// target's world (VR.Travel with the ship), the streaming hidden in the hover over the landing site.
//   · pure part (node: test/cruise.js) above the line: the law, the phases, the trip times, the target pick, presence
//   · the game's glue below it: the space frame's step, G and V, the descent, the plume, the HUD line, multiplayer
// ============================================================================
(function (VR) {
  'use strict';
  const C = VR.Cruise = {};
  const UNI = () => VR.Universe;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const T = (k, v) => (VR.I18N ? VR.I18N.t(k, v) : k);
  const v3 = () => new Float64Array(3);
  const set3 = (o, x, y, z) => { o[0] = x; o[1] = y; o[2] = z; return o; };
  const len = (a) => Math.hypot(a[0], a[1], a[2]);
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const unit = (a, o) => { const l = len(a) || 1; o = o || a; o[0] = a[0] / l; o[1] = a[1] / l; o[2] = a[2] / l; return o; };
  const cross = (a, b, o) => set3(o || v3(), a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]);
  const D2R = Math.PI / 180;
  const sstep = (u) => { u = clamp(u, 0, 1); return u * u * u * (u * (u * 6 - 15) + 10); };

  // ---------------------------------------------------------------- the law (U§5.5)
  C.K = 0.25;          // s⁻¹: speed = K × the distance to the nearest surface
  C.KD = 0.6;          // s⁻¹: the climb out inside 2 R of the body left (a low orbit's 3 km → 1 R in ≈ 6 s)
  C.ALIGN = 2.5;       // s at most for the nose to come round
  C.PUNCH = 0.6;       // s: the drive takes hold
  C.ARRIVE = 2;        // s: the arrival burn blends the velocity into the circular orbit
  C.TO = ['aqua', 'zinn', 'opal', 'basalt', 'ocker', 'amarant', 'herz'];   // the bodies the drive reaches (the far planets later)
  C.SKIP = { swarm: 1 };                                            // (no surface: the swarm's bodies are metres)
  // U§5.5's trips end at 2 R of the target (Amarant: at its cloud tops' 1.5 R — its arrival orbit)
  C.tripEnd = (to) => (to === 'amarant' ? 1.5 : 2);
  C.speed = (d) => C.K * Math.max(0, d);
  // the arrival orbit's radius in the target's radii (spaceflight.js's: 2, Amarant 1.5, inside a small moon's sphere)
  C.arrivalK = (to) => { const B = UNI().home.body(to); return to === 'amarant' ? 1.5 : Math.min(2, 1 + 0.5 * (B.soi / B.R - 1)); };
  // the nearest surface to the system point P in a state st (U.home.state): {id, d}
  C.nearest = (st, P, out, only) => {
    const S = UNI().home; out = out || { id: null, d: Infinity };
    out.id = null; out.d = Infinity;
    for (const id of only || S.ids) {
      if (C.SKIP[id]) continue;
      const r = st.b[id].r, d = Math.hypot(P[0] - r[0], P[1] - r[1], P[2] - r[2]) - S.body(id).R;
      if (d < out.d) { out.d = d; out.id = id; }
    }
    return out;
  };
  // the cruise's own trip time between two bodies at their closest (U§5.5's numbers: from 2 R of the one to the drop-out
  // at the other, the two bodies alone): (1/K)·[ln(d_m / R_from) + ln(d_m / (rArr − R_to))], d_m the middle's distance
  C.tripEstimate = (from, to, D) => {
    const S = UNI().home, A = S.body(from), B = S.body(to), d0 = A.R, d1 = (C.tripEnd(to) - 1) * B.R;
    const dm = (D - A.R - B.R) / 2;
    return (Math.log(Math.max(1, dm / d0)) + Math.log(Math.max(1, dm / d1))) / C.K;
  };

  // ---------------------------------------------------------------- a cruise: the state and the step
  // P, V: the ship's place and velocity in the system frame; nose: where the ship points (the step turns it); from, to
  // the bodies; t the system clock. Phases: align → punch → depart (inside 2 R of `from`) → cruise → arrive → done
  C.create = (P, V, from, to, t, nose) => {
    const S = UNI().home;
    const c = {
      P: Float64Array.from(P), V: Float64Array.from(V), V0: Float64Array.from(V), from, to, t, t0: t,
      phase: 'align', s: 0, total: 0, times: { align: 0, punch: 0, depart: 0, cruise: 0, arrive: 0 },
      nose: Float64Array.from(nose || [1, 0, 0]), dir: v3(), dom: from, end: null, near: { id: null, d: 0 },
      rArr: C.arrivalK(to) * S.body(to).R, t2R: undefined, st: null, arr: null, speed: 0, dist: 0, eta: 0, frameLog: null, minClear: Infinity,
    };
    c.st = S.state(t);
    return c;
  };
  const _toT = v3(), _vr = v3(), _push = v3(), _up = v3(), _rel = v3(), _n = v3(), _tg = v3();
  // the way to steer: toward the target, pushed off every other body the line comes near (≥ 1.5 R clear)
  function steer(c, st, out) {
    const S = UNI().home, q = st.b[c.to].r, P = c.P;
    set3(out, q[0] - P[0], q[1] - P[1], q[2] - P[2]); unit(out);
    set3(_push, 0, 0, 0);
    for (const id of S.ids) {
      if (id === c.to || C.SKIP[id] || id === 'helia') continue;
      const r = st.b[id].r, R = S.body(id).R;
      set3(_rel, P[0] - r[0], P[1] - r[1], P[2] - r[2]);
      const d = len(_rel); if (d > 6 * R) continue;
      unit(_rel);
      const ahead = -dot(_rel, out);   // (the body ahead of us: > 0)
      if (ahead < -0.2 && id !== c.from) continue;
      const k = Math.pow(1.6 * R / d, 3) * (id === c.from ? 1.2 : 2);
      _push[0] += _rel[0] * k; _push[1] += _rel[1] * k; _push[2] += _rel[2] * k;
    }
    out[0] += _push[0]; out[1] += _push[1]; out[2] += _push[2];
    return unit(out);
  }
  // the turn of the nose toward d at `rate` rad/s (returns the angle left)
  function turn(nose, d, rate, h) {
    const c0 = clamp(dot(nose, d), -1, 1), ang = Math.acos(c0);
    if (ang < 1e-6) { nose.set(d); return 0; }
    const k = Math.min(1, rate * h / ang);
    if (c0 < -0.999) { // (exactly behind: any perpendicular first)
      cross(nose, Math.abs(nose[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0], _n); unit(_n);
      nose[0] += _n[0] * k; nose[1] += _n[1] * k; nose[2] += _n[2] * k; unit(nose); return ang;
    }
    nose[0] += (d[0] - nose[0]) * k; nose[1] += (d[1] - nose[1]) * k; nose[2] += (d[2] - nose[2]) * k; unit(nose);
    return ang * (1 - k);
  }
  C.step = (c, h) => {
    if (c.phase === 'done') return c;
    const S = UNI().home;
    c.t += h; c.s += h; c.total += h; c.times[c.phase] = (c.times[c.phase] || 0) + h;
    const st = c.st = S.state(c.t, c.st), P = c.P, V = c.V;
    const Bf = S.body(c.from), Bt = S.body(c.to), rf = st.b[c.from].r, rt = st.b[c.to].r, vf = st.b[c.from].v, vt = st.b[c.to].v;
    const dFrom = Math.hypot(P[0] - rf[0], P[1] - rf[1], P[2] - rf[2]) - Bf.R, D = Math.hypot(P[0] - rt[0], P[1] - rt[1], P[2] - rt[2]), dTo = D - Bt.R;
    const near = C.nearest(st, P, c.near, c.only);
    c.minClear = Math.min(c.minClear, near.id === c.to ? Infinity : near.d / S.body(near.id).R);
    steer(c, st, c.dir);
    // the frame the law's speed is measured in: from the body left to the one ahead
    const w = clamp(dTo / Math.max(1, dFrom + dTo), 0, 1);
    set3(_vr, w * vf[0] + (1 - w) * vt[0], w * vf[1] + (1 - w) * vt[1], w * vf[2] + (1 - w) * vt[2]);
    if (c.phase === 'align' || c.phase === 'punch') {
      // coasting on the old velocity while the nose comes round, then the punch: the drive's speed rising in 0.6 s
      const left = turn(c.nose, c.dir, 1.6, h);
      if (c.phase === 'align') {
        P[0] += V[0] * h; P[1] += V[1] * h; P[2] += V[2] * h;
        if (left < 0.05 || c.s >= C.ALIGN) { c.phase = 'punch'; c.s = 0; c.V0.set(V); for (let k = 0; k < 3; k++) c.V0[k] -= vf[k]; }
        c.speed = len(V); c.dist = dTo; c.eta = c.estimate(dTo, near.d);
        return c;
      }
    } else if (c.phase !== 'arrive') turn(c.nose, c.dir, 2.4, h);
    if (c.phase === 'punch' || c.phase === 'depart' || c.phase === 'cruise') {
      const inside = dFrom < Bf.R && c.phase !== 'cruise';
      const k = inside ? Math.max(C.KD * dFrom, C.K * near.d) : C.K * near.d;
      const ramp = c.phase === 'punch' ? sstep(c.s / C.PUNCH) : 1;
      // the ship's own velocity before the drive fades through the punch and the first second after it
      const keep = c.phase === 'punch' ? 1 - ramp : 0;
      // (the ship flies along the nose; inside 2 R the nose keeps clear of the ground: steer() pushes off `from`)
      for (let k3 = 0; k3 < 3; k3++) V[k3] = _vr[k3] + c.nose[k3] * k * ramp + c.V0[k3] * keep;
      P[0] += V[0] * h; P[1] += V[1] * h; P[2] += V[2] * h;
      c.speed = k * ramp; c.dist = dTo; c.eta = c.estimate(dTo, near.d);
      // (U§5.5's trip: from 2 R of the one to 2 R of the other — a small moon's orbit lies closer in, its sphere is smaller)
      const kEnd = C.tripEnd(c.to);
      if (c.t2R === undefined && D <= kEnd * Bt.R && c.phase !== 'punch') c.t2R = c.total;
      if (c.phase === 'punch' && c.s >= C.PUNCH) { c.phase = dFrom < Bf.R ? 'depart' : 'cruise'; c.s = 0; }
      else if (c.phase === 'depart' && dFrom >= Bf.R) { c.phase = 'cruise'; c.s = 0; }
      // the drop-out: early by the way the arrival burn still drifts in (half the radial speed over its 2 s)
      const trig = (c.rArr - C.K * Bt.R * C.ARRIVE / 2) / (1 - C.K * C.ARRIVE / 2);
      if (c.phase !== 'punch' && D <= Math.max(trig, c.rArr)) {
        c.phase = 'arrive'; c.s = 0;
        // (dropped out before 2 R — Aquamarin's orbit at 2 R needs the burn's drift: the law's own time to there counted)
        if (c.t2R === undefined) c.t2R = c.total + Math.log(Math.max(1, dTo / ((C.tripEnd(c.to) - 1) * Bt.R))) / C.K;
        set3(_rel, P[0] - rt[0], P[1] - rt[1], P[2] - rt[2]);
        const vrel0 = Float64Array.from([V[0] - vt[0], V[1] - vt[1], V[2] - vt[2]]);
        // the orbit's plane: the one of the way in (its normal r × v), else the body's equator
        cross(_rel, vrel0, _n);
        if (len(_n) < 1e-6 * len(_rel) * (len(vrel0) + 1)) { const ax = Bt.spin && Bt.spin.axis ? Bt.spin.axis : [0, 0, 1]; set3(_n, ax[0], ax[1], ax[2]); }
        unit(_n);
        c.arr = { vrel0, n: Float64Array.from(_n) };
      }
      return c;
    }
    if (c.phase === 'arrive') {
      const A = c.arr, u = sstep(c.s / C.ARRIVE);
      set3(_rel, P[0] - rt[0], P[1] - rt[1], P[2] - rt[2]);
      const r = len(_rel), vc = Math.sqrt(Bt.mu / r);
      cross(A.n, _rel, _tg); unit(_tg);
      for (let k = 0; k < 3; k++) V[k] = vt[k] + A.vrel0[k] * (1 - u) + _tg[k] * vc * u;
      P[0] += V[0] * h; P[1] += V[1] * h; P[2] += V[2] * h;
      // the nose along the orbit's way at the end (prograde)
      set3(_up, V[0] - vt[0], V[1] - vt[1], V[2] - vt[2]); unit(_up); turn(c.nose, _up, 1.2, h);
      c.speed = len(_up) ? Math.hypot(V[0] - vt[0], V[1] - vt[1], V[2] - vt[2]) : 0; c.dist = dTo; c.eta = Math.max(0, C.ARRIVE - c.s);
      if (c.s >= C.ARRIVE) {
        // the end: exactly circular at the radius reached, in the target's frame
        set3(_rel, P[0] - rt[0], P[1] - rt[1], P[2] - rt[2]);
        const rr = len(_rel), vc2 = Math.sqrt(Bt.mu / rr);
        cross(A.n, _rel, _tg); unit(_tg);
        c.end = { frame: c.to, r: Float64Array.from(_rel), v: Float64Array.from([_tg[0] * vc2, _tg[1] * vc2, _tg[2] * vc2]), t: c.t };
        c.phase = 'done';
      }
    }
    return c;
  };
  // the time left, roughly: out to the middle and in again on the law (the HUD's ETA)
  C.eta = (c, dTo, dNear) => {
    const d1 = Math.max(1, c.rArr - UNI().home.body(c.to).R);
    if (c.phase === 'arrive') return Math.max(0, C.ARRIVE - c.s);
    const dm = Math.max(dNear, dTo / 2);
    return (Math.log(Math.max(1, dm / Math.max(1, dNear))) + Math.log(Math.max(1, Math.min(dm, dTo) / d1))) / C.K + C.ARRIVE;
  };
  const proto = { estimate(dTo, dNear) { return C.eta(this, dTo, dNear); } };
  const _create = C.create;
  C.create = (...a) => Object.assign(Object.create(proto), _create(...a));
  // the dominant body at the ship's place and the state relative to it (the HUD; the SOI hand-over's continuity)
  C.dominant = (c) => UNI().home.dominant(c.P, c.t);
  C.inFrame = (c, frame, r, v) => UNI().home.toFrame('helia', frame, c.P, c.V, c.t, r || v3(), v || v3());

  // a whole trip flown in steps of h from a point 2 R off `from` toward `to` (or P, V given): the phase times, the end
  C.fly = (from, to, t0, o) => {
    o = o || {}; const S = UNI().home, h = o.h || 1 / 30, st = S.state(t0);
    let P = o.P, V = o.V;
    if (!P) {
      const rf = st.b[from].r, rt = st.b[to].r, d = unit(set3(v3(), rt[0] - rf[0], rt[1] - rf[1], rt[2] - rf[2]));
      const R = S.body(from).R * (o.k || 2);
      P = [rf[0] + d[0] * R, rf[1] + d[1] * R, rf[2] + d[2] * R]; V = Array.from(st.b[from].v);
    }
    const nose = o.nose || unit(set3(v3(), st.b[to].r[0] - P[0], st.b[to].r[1] - P[1], st.b[to].r[2] - P[2]));
    const c = C.create(P, V, from, to, t0, nose);
    if (o.twoBody) c.only = [from, to];
    let n = 0; const max = (o.max || 400) / h;
    while (c.phase !== 'done' && n++ < max) { C.step(c, h); if (o.each) o.each(c); }
    return c;
  };
  // the time two bodies come closest within a span (the trip times of U§5.5 are made there)
  C.closest = (a, b, t0, span, n) => {
    const S = UNI().home; let best = t0, bd = Infinity; const ra = v3(), rb = v3();
    for (let pass = 0, lo = t0, hi = t0 + span; pass < 3; pass++) {
      const N = n || 400;
      for (let i = 0; i <= N; i++) { const t = lo + (hi - lo) * i / N; S.pos(a, t, ra); S.pos(b, t, rb); const d = Math.hypot(ra[0] - rb[0], ra[1] - rb[1], ra[2] - rb[2]); if (d < bd) { bd = d; best = t; } }
      const w = (hi - lo) / N * 2; lo = best - w; hi = best + w;
    }
    return { t: best, d: bd };
  };

  // ---------------------------------------------------------------- travel by intent: the body the camera looks at
  // P the eye (system), dir its unit forward (system), st a state: the body whose disc (+5°) holds the view's middle,
  // else the nearest to it within 12° — {id, ang} or null; `skip` the body round which the ship is (its own world)
  C.pick = (st, P, dir, skip, ids) => {
    const S = UNI().home; let best = null, bs = Infinity;
    for (const id of ids || C.TO) {
      if (id === skip || !st.b[id]) continue;
      const r = st.b[id].r, dx = r[0] - P[0], dy = r[1] - P[1], dz = r[2] - P[2], d = Math.hypot(dx, dy, dz);
      const ang = Math.acos(clamp((dx * dir[0] + dy * dir[1] + dz * dir[2]) / d, -1, 1)), rad = Math.asin(clamp(S.body(id).R / d, 0, 1));
      // (a small moon before the giant's disc wins: the angle in units of the disc's size plus 2°)
      if (ang < rad + 5 * D2R || ang < 12 * D2R) { const score = ang / (rad + 2 * D2R); if (score < bs) { bs = score; best = { id, ang, rad }; } }
    }
    return best;
  };

  // ---------------------------------------------------------------- multiplayer phase 1 (U§10): the space presence
  // `d` (the dim, or 'space'), `sp` {f: frame, r, v (m and m/s, rounded to 1 m and 0.1 m/s), q (4 decimals)} — at 10 Hz, or a
  // coasting ship's conic once (c: 1, the guest propagates it)
  const rd = (x, k) => Math.round(x * k) / k;
  C.presence = (g) => {
    const fl = g && g.flight, a = fl && fl.asc;
    if (!a || !fl.regime || fl.regime !== 'space') return { d: g && g.dim || 'overworld', sp: null };
    const st = a.st, q = VR.Universe.matToQuat ? VR.Universe.matToQuat(a.S, [0, 0, 0, 1]) : [0, 0, 0, 1];
    return { d: 'space', sp: C.spOf(st, q) };
  };
  C.spOf = (st, q) => ({ f: st.frame, r: [rd(st.r[0], 1), rd(st.r[1], 1), rd(st.r[2], 1)], v: [rd(st.v[0], 10), rd(st.v[1], 10), rd(st.v[2], 10)], q: [rd(q[0], 1e4), rd(q[1], 1e4), rd(q[2], 1e4), rd(q[3], 1e4)], t: rd(st.t, 100), c: st.coast ? 1 : 0 });
  // a space presence's bytes a second: 10 Hz under way, the conic once a 10 s while coasting
  C.presenceRate = (sp) => { const b = JSON.stringify(sp).length + 8; return sp && sp.c ? b / 10 : b * 10; };
  // the host's travel message (topic 'travel'): {dim, at, host} — guests are asked „Mitreisen?"
  C.travelMsg = (dim, at, host) => ({ type: 'travel', dim, at: at ? at.map((x) => Math.round(x * 10) / 10) : null, host: host || null });

  // ================================================================ the game's glue (a page with the game)
  if (typeof window === 'undefined' || !VR.Game) return;
  C.page = true;
})(typeof VR !== 'undefined' ? VR : (globalThis.VR = globalThis.VR || {}));
