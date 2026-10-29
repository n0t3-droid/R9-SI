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
  // the presence's space part for mp.js publish (10 Hz): null on the ground; a coasting ship keeps the conic it sent (its
  // epoch's r, v, t — the JSON unchanged, so mp.js sends nothing more) until it drifts 5 m off it (a burn)
  let _spLast = null; const _cr = new Float64Array(3), _cv = new Float64Array(3);
  C.spFor = (g) => {
    const fl = g && g.flight, a = fl && fl.asc;
    if (!a || fl.regime !== 'space') { _spLast = null; return null; }
    const st = a.st;
    if (st.coast && _spLast && _spLast.c && _spLast.f === st.frame && VR.Universe.coast) {
      try { VR.Universe.coast(_spLast.r, _spLast.v, VR.Universe.home.body(st.frame).mu, st.t - _spLast.t, _cr, _cv); if (Math.hypot(_cr[0] - st.r[0], _cr[1] - st.r[1], _cr[2] - st.r[2]) < 5) return _spLast; } catch (e) { /* (a new conic below) */ }
    }
    const q = VR.Universe.matToQuat ? VR.Universe.matToQuat(a.S, [0, 0, 0, 1]) : [0, 0, 0, 1];
    return (_spLast = C.spOf(st, q));
  };
  // the host's travel message (topic 'travel'): {dim, at, host} — guests are asked „Mitreisen?"
  C.travelMsg = (dim, at, host) => ({ type: 'travel', dim, at: at ? at.map((x) => Math.round(x * 10) / 10) : null, host: host || null });

  // ================================================================ the game's glue (a page with the game)
  if (typeof window === 'undefined' || !VR.Game || !VR.Ascent || !VR.SpaceFlight) return;
  C.page = true;
  const A = VR.Ascent, SF = VR.SpaceFlight, AM = A.math;
  if (VR.Quests) VR.Quests.TRAVEL_ON = true;   // (the Abenteuer's Reisen: the moons are reached now)
  const fxOn = (g) => !(g && g.settings && g.settings.cruiseFx === false);
  if (VR.Settings && VR.Settings.add) VR.Settings.add({ key: 'cruiseFx', g: 'img', sec: 'show', t: 'switch', lab: 'g.set.cruiseFx', tip: 'g.set.cruiseFx.tip', cost: 'low', def: true });
  const ECL_UP = [0, 0, 1];

  // ---------------------------------------------------------------- the frame the ship and its cameras are drawn in
  // (ascent.js A.localFrame's first line) the cruise and the jump fly in the system frame: there the map's axes are the
  // ecliptic's — up its north, east +x — fixed for the whole way, so the cameras never swing; on the way in and out the
  // frame turns from the body's (its radial frame, Herzwelt's map) to the ecliptic's and back in two seconds
  C.blend = null;   // {a, b: 'ecl' | a body id, s, dur}
  const ecl = (o) => { o[0] = 1; o[3] = 0; o[6] = 0; o[1] = 0; o[4] = 0; o[7] = 1; o[2] = 0; o[5] = -1; o[8] = 0; return o; };
  const _Ma = new Float64Array(9), _Mb = new Float64Array(9), _Mr = new Float64Array(9), _Ms = new Float64Array(9), _pr = v3(), _pb = v3();
  const _tmpSt = { frame: 'herz', r: v3(), v: v3(), t: 0 };
  function frameOf(kind, st, o) {
    if (kind === 'ecl') return ecl(o);
    const S = UNI().home;
    // the ship's place relative to that body
    if (st.frame === kind) _pr.set(st.r);
    else { S.pos(st.frame, st.t, _pb); const q = S.pos(kind, st.t, v3()); set3(_pr, _pb[0] + st.r[0] - q[0], _pb[1] + st.r[1] - q[1], _pb[2] + st.r[2] - q[2]); }
    if (kind === 'herz') { _tmpSt.r.set(_pr); _tmpSt.t = st.t; return A.localAt(_tmpSt, o); }
    const b = S.body(kind), ax = b && b.spin && b.spin.axis ? b.spin.axis : [0, 0, 1], n = unit(_pr, v3());
    let ex = ax[1] * n[2] - ax[2] * n[1], ey = ax[2] * n[0] - ax[0] * n[2], ez = ax[0] * n[1] - ax[1] * n[0], l = Math.hypot(ex, ey, ez);
    if (l < 1e-9) { ex = 1; ey = 0; ez = 0; l = 1; }
    ex /= l; ey /= l; ez /= l;
    o[0] = ex; o[3] = ey; o[6] = ez; o[1] = n[0]; o[4] = n[1]; o[7] = n[2];
    o[2] = ey * n[2] - ez * n[1]; o[5] = ez * n[0] - ex * n[2]; o[8] = ex * n[1] - ey * n[0];
    return o;
  }
  const mm = (a, b, o) => { for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]; return o; };
  const mmT = (a, b, o) => { for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i * 3 + j] = a[i * 3] * b[j * 3] + a[i * 3 + 1] * b[j * 3 + 1] + a[i * 3 + 2] * b[j * 3 + 2]; return o; };   // a · bᵀ
  C.localFrame = (st, out) => {
    const B = C.blend;
    if (!B) return st.frame === 'helia' ? ecl(out) : null;
    const k = sstep(B.s / B.dur);
    if (k >= 1 && B.b !== 'ecl') { C.blend = null; return null; }
    frameOf(B.a, st, _Ma); frameOf(B.b, st, _Mb);
    mmT(_Mb, _Ma, _Mr);                       // the turn from a to b
    UNI().slerpRot(_Mr, k, _Ms);
    return mm(_Ms, _Ma, out);
  };

  // ---------------------------------------------------------------- the space scene, on every way in (a debug start too)
  C.ensureScene = (g) => {
    const SS = VR.SpaceScene; if (!SS || !SS.state) return;
    const seed = ((g && g.meta && g.meta.seed) >>> 0) || 0x5eed;
    if (SS.state.seed !== seed) { if (SS.state.seed && SS.drop) SS.drop(g); SS.state.seed = seed; }
  };

  // ---------------------------------------------------------------- starting, the step, the end
  const _P = v3(), _V = v3();
  C.start = (fl, to, quiet) => {
    const g = fl.g, a = A.ascOf(fl), st = a.st, S = UNI().home;
    if (fl.regime !== 'space' || a.jump || a.cruise || !S.body(to)) return false;
    C.ensureScene(g);
    const sys = S.state(st.t), pf = sys.b[st.frame];
    set3(_P, pf.r[0] + st.r[0], pf.r[1] + st.r[1], pf.r[2] + st.r[2]); set3(_V, pf.v[0] + st.v[0], pf.v[1] + st.v[1], pf.v[2] + st.v[2]);
    const from = st.frame === 'helia' ? S.dominant(_P, st.t) : st.frame;
    if (from === to) { SF.hint(fl, 'g.asc.arrived', { name: SF.nameOf(to) }); return false; }
    const c = C.create(_P, _V, from, to, st.t, [-a.S[2], -a.S[5], -a.S[8]]);
    a.cruise = c;
    C.blend = { a: st.frame === 'helia' ? 'ecl' : st.frame, b: 'ecl', s: 0, dur: 2.2 };
    st.frame = 'helia'; st.r.set(_P); st.v.set(_V); st.coast = false;
    const b = fl.b, name = SF.nameOf(to), D = Math.hypot(sys.b[to].r[0] - _P[0], sys.b[to].r[1] - _P[1], sys.b[to].r[2] - _P[2]);
    const est = Math.round(C.tripEstimate(from, to, D) + 4 + (len(st.r) ? 0 : 0));
    fl.auto = { space: 'cruise', phase: null, t: 0, to, site: { id: 'space:cruise:' + to, name, x: b.pos[0], y: b.pos[1], z: b.pos[2] }, spot: null, dist: D, eta: est, landing: false };
    if (fl.state !== 'flying') { fl.state = 'flying'; fl.holdAlt = null; }
    if (!quiet) SF.say(fl, 'g.cr.go', { name, s: est });
    C.last = { from, to, t0: performance.now(), est, phases: null, total: 0, t2R: null };
    return true;
  };
  // the pilot's hands back where the drive is: coasting in the dominant body's frame on the velocity it had
  C.abort = (fl, key) => {
    const a = A.ascOf(fl), st = a.st, c = a.cruise, S = UNI().home; if (!c) return;
    a.cruise = null;
    if (c.kind === 'descent') return;
    const dom = S.dominant(c.P, c.t);
    S.toFrame('helia', dom, c.P, c.V, c.t, st.r, st.v); st.frame = dom; st.t = c.t; st.coast = true;
    UNI().verletInit(st, S.body(dom).mu);
    unit(st.r, a.prevUp);
    C.blend = { a: 'ecl', b: dom, s: 0, dur: 2.5 };
    if (key) SF.hint(fl, key);
  };
  const punch = (fl) => {
    const g = fl.g;
    if (fxOn(g)) fl.fovKick = 0.16;
    fl.bump = Math.max(fl.bump || 0, 0.9);
    if (g && g.audio && g.audio.play) g.audio.play('boost');
  };
  let hintT = 0;
  C.stepFl = (fl, h) => {
    const a = A.ascOf(fl), st = a.st, c = a.cruise;
    if (C.blend) C.blend.s += h;
    if (c.kind === 'descent') return descentStep(fl, a, c, h);
    if (!fl.auto || fl.auto.space !== 'cruise') { C.abort(fl, 'g.cr.off'); a.cruiseThr = 0; return; }
    const was = c.phase;
    C.step(c, h);
    if (c.phase === 'punch' && was !== 'punch') punch(fl);
    if (c.phase === 'arrive' && was !== 'arrive') fl.bump = Math.max(fl.bump || 0, 0.45);
    st.frame = 'helia'; st.r.set(c.P); st.v.set(c.V); st.t = c.t; st.coast = false;
    A.slew(a.S, c.nose, ECL_UP, 2.4 * h, 1.2 * h); AM.ortho(a.S);
    a.cruiseThr = c.phase === 'punch' || c.phase === 'depart' ? 3 : c.phase === 'cruise' ? 1.4 : c.phase === 'arrive' ? 2.2 : 0.2;
    fl.auto.dist = c.dist; fl.auto.eta = c.eta;
    if (C.last) { C.last.total = c.total; C.last.phases = c.times; C.last.t2R = c.t2R === undefined ? null : c.t2R; C.last.phase = c.phase; }
    if ((hintT -= h) <= 0 && c.phase !== 'done') {
      hintT = 1;
      SF.hint(fl, 'g.cr.hud', { name: SF.nameOf(c.to), km: Math.round(c.dist / 1000).toLocaleString(), v: (c.speed / 1000).toFixed(1), s: Math.max(0, Math.round(c.eta)) }, 1200);
    }
    if (c.phase === 'done') C.finish(fl, a, c);
  };
  C.finish = (fl, a, c) => {
    const st = a.st, e = c.end, S = UNI().home;
    st.frame = e.frame; st.r.set(e.r); st.v.set(e.v); st.t = e.t; st.coast = true;
    UNI().verletInit(st, S.body(st.frame).mu);
    unit(st.r, a.prevUp);
    a.cruise = null; a.cruiseThr = 0; fl.auto = null; fl.regime = 'space';
    C.blend = { a: 'ecl', b: e.frame, s: 0, dur: 2.5 };
    if (C.last) C.last.done = performance.now();
    SF.say(fl, 'g.cr.arrived', { name: SF.nameOf(e.frame) });
    if (!SF.landable(e.frame) && e.frame !== 'herz') SF.hint(fl, 'g.asc.noLand', { name: SF.nameOf(e.frame) }, 4200);
  };
  // the HUD's numbers in a cruise (the system frame's speed means nothing to a pilot): the drive's speed, the way left
  C.hudFix = (fl, a) => {
    const c = a.cruise, I = a.info; if (!c || !I) return;
    if (c.kind !== 'descent') { I.speed = c.speed; I.alt = c.near.d; I.vs = 0; }
  };

  // ---------------------------------------------------------------- travel by intent: G at a world in the sky
  const _m9 = new Float64Array(9), _r = v3(), _vv = v3(), _f = v3(), _d = v3();
  C.lookPick = (g, fl) => {
    const cam = g && g.cam; if (!cam || !fl) return null;
    const S = UNI().home, a = fl.asc, st = a && a.st, cp = Math.cos(cam.pitch || 0);
    set3(_f, -Math.sin(cam.yaw) * cp, Math.sin(cam.pitch || 0), -Math.cos(cam.yaw) * cp);
    let t, skip;
    if (st && fl.regime && fl.regime !== 'air') {
      t = st.t; A.localFrame(st, _m9);
      const pf = S.pos(st.frame, t, v3()); set3(_P, pf[0] + st.r[0], pf[1] + st.r[1], pf[2] + st.r[2]);
      skip = st.frame === 'helia' ? S.dominant(_P, t) : st.frame;
    } else {
      t = A.clock(fl) + (a && a.tOff || 0); A.localM(cam.x, cam.z, t, _m9);
      S.chartToInertial('herz', [cam.x, cam.y, cam.z], null, t, _r, _vv);
      const pf = S.pos('herz', t, v3()); set3(_P, pf[0] + _r[0], pf[1] + _r[1], pf[2] + _r[2]);
      skip = 'herz';
    }
    AM.mulv(_m9, _f, _d); unit(_d);
    return C.pick(S.state(t), _P, _d, skip);
  };
  // G in space: the world looked at → the Reiseantrieb armed (2 s); G again → the Reisesprung there; again → off.
  // High in the air or in the climb with a world looked at: Zum Orbit, then the cruise on its own
  const toggle0 = SF.toggle;
  SF.toggle = (fl) => {
    const r = fl.regime || 'air', a = fl.asc, A_ = fl.auto;
    if (a && a.cruise) { C.abort(fl, 'g.cr.off'); fl.auto = null; return true; }
    if (r === 'space' && !(a && a.jump)) {
      if (A_ && A_.space === 'arm' && A_.cruiseTo) { A_.cruiseTo = null; A_.armT = 2; SF.hint(fl, 'g.cr.armJump', { name: SF.nameOf(A_.to) }, 2200); return true; }
      if (A_ && A_.space === 'arm' && A_.byIntent) { fl.auto = null; SF.hint(fl, 'g.fl.autoOff2'); return true; }
      if (!A_) {
        const p = C.lookPick(fl.g, fl);
        if (p) { SF.start(fl, 'arm', { to: p.id, armT: 2, cruiseTo: p.id, byIntent: true }); SF.hint(fl, 'g.cr.arm', { name: SF.nameOf(p.id) }, 2200); return true; }
      }
    }
    const res = toggle0(fl);
    if ((r === 'air' || r === 'climb') && fl.auto && fl.auto.space === 'orbit' && !fl.auto.then) {
      const p = C.lookPick(fl.g, fl);
      if (p && p.id !== 'herz') { fl.auto.then = p.id; SF.hint(fl, 'g.cr.go', { name: SF.nameOf(p.id), s: '…' }, 2600); }
    }
    return res;
  };
  // the arm's end: the cruise when it was armed for it (the Reisesprung otherwise, spaceflight.js)
  const guide0 = A.guide;
  A.guide = (fl, h, a) => {
    const A_ = fl.auto;
    if (A_ && A_.space === 'arm' && A_.cruiseTo && A_.armT - h <= 0) { const to = A_.cruiseTo; fl.auto = null; C.start(fl, to); return null; }
    return guide0(fl, h, a);
  };
  SF.guide = A.guide;
  // Zum Orbit → Kreisbahn → the cruise to the world looked at when G was pressed
  const done0 = SF.done;
  SF.done = (fl, A_) => {
    const then = A_ && A_.then, wasCirc = A_ && A_.space === 'circ';
    done0(fl, A_);
    if (then && wasCirc && !fl.auto) C.start(fl, then);
  };

  // ---------------------------------------------------------------- Landen round a moon: the descent into its world
  // in space: five seconds down from the orbit toward the ground below, the retro burn lit, the moon swelling; then the
  // trip (VR.Travel, the ship along) — in the moon's world the ship sinks from 420 m over the site (landTick)
  C.DESCENT_S = 5; C.HOVER = 420;
  C.descend = (fl, body) => {
    const g = fl.g, a = A.ascOf(fl), st = a.st, dim = SF.DIM_OF[body];
    if (!g || !VR.Travel || !dim) return false;
    const why = VR.Travel.canGo(g, dim);
    if (why) { SF.hint(fl, why); return true; }
    C.ensureScene(g);
    const B = UNI().home.body(body), r0 = len(st.r);
    const n = cross(st.r, st.v, v3()); unit(n);
    a.cruise = { kind: 'descent', body, dim, s: 0, r0: Float64Array.from(st.r), n, w: len(st.v) / Math.max(1, r0), R0: r0, R1: B.R * 1.1, phase: 'descent' };
    fl.auto = { space: 'cruise', phase: 'descent', t: 0, to: body, site: { id: 'space:descent:' + body, name: SF.nameOf(body), x: fl.b.pos[0], y: fl.b.pos[1], z: fl.b.pos[2] }, spot: null, dist: r0 - B.R, eta: C.DESCENT_S, landing: true };
    SF.say(fl, 'g.cr.descent', { name: SF.nameOf(body) });
    if (g.audio && g.audio.play) g.audio.play('boost');
    fl.bump = Math.max(fl.bump || 0, 0.5);
    return true;
  };
  SF.onLandBody = (fl, body) => C.descend(fl, body);
  const _rot = new Float64Array(9), _nd = v3();
  function descentStep(fl, a, c, h) {
    const st = a.st, g = fl.g;
    c.s += h; st.t += h;
    const u = sstep(c.s / C.DESCENT_S), ang = c.w * c.s * (1 - 0.4 * u);
    // the way round the orbit (the speed kept, the radius falling toward 1.1 R)
    const n = c.n, r0 = c.r0, ca = Math.cos(ang), sa = Math.sin(ang), k = (c.R0 + (c.R1 - c.R0) * u) / c.R0;
    const nx = cross(n, r0, v3());
    const prev = Float64Array.from(st.r);
    set3(st.r, (r0[0] * ca + nx[0] * sa) * k, (r0[1] * ca + nx[1] * sa) * k, (r0[2] * ca + nx[2] * sa) * k);
    set3(st.v, (st.r[0] - prev[0]) / h, (st.r[1] - prev[1]) / h, (st.r[2] - prev[2]) / h);
    st.coast = false;
    // the nose: against the way and down (the retro burn), the ship's up away from the ground
    const up = unit(st.r, v3());
    set3(_nd, -st.v[0], -st.v[1], -st.v[2]); unit(_nd);
    set3(_nd, _nd[0] * 0.75 - up[0] * 0.35, _nd[1] * 0.75 - up[1] * 0.35, _nd[2] * 0.75 - up[2] * 0.35); unit(_nd);
    A.slew(a.S, _nd, up, 1.6 * h, 1.2 * h); AM.ortho(a.S);
    a.cruiseThr = 2.6;
    if (fl.auto) { fl.auto.dist = len(st.r) - c.R1 / 1.1; fl.auto.eta = Math.max(0, C.DESCENT_S - c.s); }
    if (c.s < C.DESCENT_S) return;
    // the trip: the world below starts while the veil is closed; the ship comes along (travel.js switchNow)
    a.cruise = null; a.cruiseThr = 0; fl.auto = null; fl.regime = 'air';
    C.landing = { dim: c.dim, body: c.body, t0: performance.now() };
    try { VR.Travel.go(g, { dim: c.dim, via: 'ship' }); } catch (e) { console.warn(e); }
  }

  // ---------------------------------------------------------------- in the moon's world: the ship over the site
  // travel.js arrived(): a trip by ship puts the ship in the air (its ride: 420 m over the arrival place)
  C.arrived = (g, trip) => { if (trip && trip.via === 'ship' && trip.ride) trip.ride.air = C.HOVER; };
  // travel.js rideTick(): the ship that came along, built — placed over the player, boarded, flying (true: done here)
  C.ride = (g, S, s, R0) => {
    if (!R0 || !R0.air) return false;
    const p = g.player, SS = g.starships;
    // (under flight.js's cap: above 252 m a starship's climb begins)
    const H = (s.d.meta && s.d.meta.height) || 6;
    s.pos[0] = p.pos[0]; s.pos[1] = Math.min(p.pos[1] + R0.air, 246 - H); s.pos[2] = p.pos[2];
    SS.board(s, p);
    const fl = s.flight; if (!fl) return true;
    fl.power = 'running'; fl.startT = 3; fl.state = 'flying'; fl.holdAlt = null; fl.auto = null;
    g.cruiseLand = { s, fl, t: 0, ground: p.pos[1], dim: g.dim, body: (C.landing && C.landing.body) || g.dim, hintT: 0, surveyT: 0, firstK: null };
    if (C.landing) C.landing.tAir = performance.now();
    return true;
  };
  // the near columns there and shown (the 3 × 3 round the ship)
  C.nearReady = (g, x, z) => {
    const w = g.world; if (!w || !w.cols) return false;
    const cx = Math.floor(x) >> 4, cz = Math.floor(z) >> 4;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const c = w.cols.get(VR.ckey(cx + dx, cz + dz));
      if (!c || !c.ready) return false;
      for (const sc of c.sec) if (sc.count > 0 && (sc.dirty || sc.pending || !sc.hasMesh)) return false;
    }
    return true;
  };
  // per frame in the moon's world (travel.js update): sink fast, hover while the site is surveyed, flight.js lands
  C.landTick = (g, dt) => {
    const L = g.cruiseLand, fl = L.fl, b = fl.b, SS = g.starships;
    L.t += dt;
    if (!SS || SS.pilot !== L.s || L.t > 150 || g.dim !== L.dim) { g.cruiseLand = null; return; }
    const top = fl.groundTop ? fl.groundTop(b.pos[0], b.pos[1], b.pos[2], 700) : null;
    const gy = top !== null && top > -1e8 ? top : L.ground, alt = b.pos[1] - gy;
    L.alt = alt;
    const ready = C.nearReady(g, b.pos[0], b.pos[2]);
    if (!L.tReady && ready) L.tReady = L.t;
    if (fl.state === 'landed') {
      g.cruiseLand = null;
      const m = g.meta, U2 = m && (m.universe || (m.universe = { v: 1 })), F = U2 && (U2.firsts || (U2.firsts = {}));
      const name = SF.nameOf(L.body);
      if (F && !F[L.dim]) { F[L.dim] = g.env ? g.env.day | 0 : 1; if (g.ui && g.ui.toast) g.ui.toast(T('g.cr.firstStep', { name }), name, null); else if (g.ui && g.ui.chatLine) g.ui.chatLine(T('g.cr.firstStep', { name }), '#ffd98a'); }
      if (VR.Quests && VR.Quests.emit) { try { VR.Quests.emit('arrive', { dim: L.dim }); } catch (e) { /* (an Abenteuer world only) */ } }
      if (C.landing) C.landing.tLanded = performance.now();
      return;
    }
    if (fl.state === 'landing') { C.plume(g, fl, alt, dt); return; }
    if (!ready && alt < 320) {
      // the site not surveyed yet: hover (flight.js's altitude hold) with the line on the screen
      if (fl.holdAlt === null) fl.holdAlt = b.pos[1];
      if ((L.surveyT -= dt) <= 0) { L.surveyT = 2; if (g.ui && g.ui.hint) g.ui.hint(T('g.cr.survey'), 2100); }
      L.hovered = (L.hovered || 0) + dt;
      return;
    }
    if (alt > 60) {
      const vs = clamp(alt * 0.12, 7, 34);
      b.pos[1] -= vs * dt; b.vel[1] = -vs; fl.holdAlt = null; fl.ctl.climb = 0;
      if (alt < 120) C.plume(g, fl, alt, dt);
      return;
    }
    fl.state = 'landing'; fl.throttle = 0; fl.boost = false; fl.holdAlt = null;
  };
  // the engine's wash on airless ground: regolith thrown out in a widening ring below 50 m (the world's ground colour)
  const _col = [0.6, 0.58, 0.55];
  const DUST = { opal: [0.86, 0.9, 0.96], basalt: [0.56, 0.54, 0.52], zinn: [0.86, 0.76, 0.38], ocker: [0.74, 0.5, 0.33], aqua: [0.72, 0.7, 0.64] };
  C.plume = (g, fl, alt, dt) => {
    const P = g.particles, b = fl.b; if (!P || !fxOn(g) || alt > 50 || alt < 0) return;
    const k = 1 - alt / 50, low = g.settings && g.settings.preset === 'potato', n = Math.round((low ? 3 : 9) * k + 1);
    const gy = b.pos[1] - alt, col = DUST[g.dim] || _col;
    const ring = 3 + alt * 0.25;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.2832, r = ring * (0.6 + Math.random() * 0.6), x = b.pos[0] + Math.cos(a) * r, z = b.pos[2] + Math.sin(a) * r, sp = 8 + Math.random() * 10 * k;
      P.spawn(x, gy + 0.3, z, Math.cos(a) * sp, 0.6 + Math.random() * 2.5 * k, Math.sin(a) * sp, { life: 1.2 + Math.random() * 1.4, size: 0.5 + Math.random() * 0.9 * k, grav: 0.4, col: [col[0] * 0.9, col[1] * 0.9, col[2] * 0.88], drag: 0.9, grow: 1.6, collide: false });
    }
  };
})(typeof VR !== 'undefined' ? VR : (globalThis.VR = globalThis.VR || {}));
