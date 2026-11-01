// ============================================================================
// o-seamless · VR.JourneyCore — the pure part of the journeys you walk or ride (docs/superpowers/plans/
// 2026-11-01-o-seamless.md). No DOM, no game: test/journey.js.
//   · kinds: 'lift' — die Himmelsleiter, Herzwelt → Ringstation in a glass cabin (board → ground → space → arrive → done);
//            'bridge' — a Lichtbrücke, a gate's shining path through space you walk along (board → way → arrive → done);
//            'ride' — a caravan's hover-cart from one place to the next (board → way → arrive → done)
//   · start(kind, o) → a state; step(st, dt, inp) → the events of that step: 'go' (on the way), 'handoff' (the lift
//     leaves the voxel world for the space frame), 'depart' (the world switch starts — under the journey), 'line:<key>'
//     (the driver says something), 'moment' (ask the Wanderregisseur for a moment ahead), 'arrive', 'done'.
//     inp: {fwd, back (bridge: W walks, S slows), loaded (the destination is there), slow (ride: the land ahead not
//     built yet, a moment near)}
//   · at(st) → {phase, alt (lift: m over the base), k (0…1)} · skip(st) (after 2 s: to the end; a ride: off the cart)
//   · the caravan: pickRide(places, [x, z], seen) · ridePath(a, b, seed) · rideLen(path) · rideAt(path, s, out)
//   · snap(st) → a small plain record (meta.journey); resume(rec, here) → {act: 'ride' | 'again' | 'arrived', st} or null
//   · ok(ctx, kind) → null or why not ('off' · 'busy' · 'guest'); mode(ctx, kind) → 'walk' or 'film' (Very Low: the film, but
//     the bridge) · o-seamless2: fx(ctx) · relAz(sun, yaw) · liftLook(k, p0) · greet(k) · chimes(s0, s1, tile) · seat(at, y0, t, sway)
// ============================================================================
(function (VR) {
  'use strict';
  const K = VR.JourneyCore = {};
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const h = (a, b) => { let x = (Math.imul(a | 0, 0x2c1b3c6d) ^ Math.imul((b | 0) + 0x9e37, 0x297a2d39)) >>> 0; x = Math.imul(x ^ (x >>> 15), 0x85ebca6b) >>> 0; x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0; return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };
  const isObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
  const fin = Number.isFinite;

  // the Himmelsleiter: 2 s boarding, 22 s over the voxel world to the climb band's top (2,350 m), 28 s through space to
  // STOP m under the station; the height rises slowly first (the land shrinks), then ever faster, then eases in
  K.LIFT = { board: 2, ground: 24, len: 52, hand: 2350, stop: 300, top: 52900 };
  K.liftAlt = function (t, top) {
    const L = K.LIFT, T = (fin(top) && top > L.hand * 2 ? top : L.top) - L.stop;
    if (t <= L.board) return 0;
    if (t <= L.ground) return L.hand * Math.pow((t - L.board) / (L.ground - L.board), 2.4);
    const v = clamp((t - L.ground) / (L.len - L.ground), 0, 1);
    return L.hand * Math.pow(T / L.hand, 1 - (1 - v) * (1 - v));
  };
  // the Lichtbrücke: 150 m of light; carried at 3.2 m/s, walking 7 m/s, S slows to 1 m/s; the world switch at 18 m
  K.BRIDGE = { board: 1.5, len: 150, depart: 18, glide: 3.2, walk: 7, slow: 1 };
  // the caravan: 7.5 m/s (2.5 m/s where the land ahead is not there yet or a moment is near); 150–900 m to the next place
  K.RIDE = { board: 2, speed: 7.5, slow: 2.5, min: 150, max: 900, step: 6, end: 1.5 };
  K.LINES = ['g.jy.line.0', 'g.jy.line.1', 'g.jy.line.2', 'g.jy.line.3', 'g.jy.line.4', 'g.jy.line.5', 'g.jy.line.6', 'g.jy.line.7', 'g.jy.line.8', 'g.jy.line.9'];
  K.KINDS = { lift: 1, bridge: 1, ride: 1 };

  K.start = function (kind, o) {
    o = o || {};
    const st = { v: 1, kind, from: o.from || 'overworld', to: o.to || null, seed: (o.seed | 0) >>> 0, t: 0, s: 0, ph: 'board', went: false, off: false, at: 0 };
    if (kind === 'lift') st.top = fin(o.top) ? o.top : K.LIFT.top;
    if (kind === 'ride') {
      st.path = o.path || [[0, 0], [0, 0]]; st.len = K.rideLen(st.path); st.name = o.name || null;
      st.lines = K.lines(st.seed, st.len); st.li = 0; st.moment = false;
    }
    return st;
  };
  K.lines = function (seed, L) {
    const n = K.LINES.length, a = Math.floor(h(seed, 1) * n), b = (a + 1 + Math.floor(h(seed, 2) * (n - 1))) % n;
    return [{ at: L * 0.25, key: K.LINES[a] }, { at: L * 0.68, key: K.LINES[b] }];
  };

  K.step = function (st, dt, inp) {
    const ev = [];
    if (!st || st.ph === 'done') return ev;
    inp = inp || {}; dt = Math.max(0, +dt || 0);
    st.t += dt;
    if (st.kind === 'lift') {
      const L = K.LIFT;
      if (st.ph === 'board' && st.t >= L.board) { st.ph = 'ground'; ev.push('go'); }
      if (st.ph === 'ground' && st.t >= L.ground) { st.ph = 'space'; ev.push('handoff'); if (!st.went) { st.went = true; ev.push('depart'); } }
      if (st.ph === 'space' && st.t >= L.len) { st.t = L.len; if (inp.loaded) { st.ph = 'arrive'; st.at = 0; ev.push('arrive'); } }
      else if (st.ph === 'arrive' && (st.at += dt) >= 2) { st.ph = 'done'; ev.push('done'); }
    } else if (st.kind === 'bridge') {
      const B = K.BRIDGE;
      if (st.ph === 'board' && st.t >= B.board) { st.ph = 'way'; ev.push('go'); }
      else if (st.ph === 'way') {
        st.s = Math.min(B.len, st.s + (inp.fwd ? B.walk : inp.back ? B.slow : B.glide) * dt);
        if (!st.went && st.s >= B.depart) { st.went = true; ev.push('depart'); }
        if (st.s >= B.len && inp.loaded) { st.ph = 'arrive'; st.at = 0; ev.push('arrive'); }
      } else if (st.ph === 'arrive' && (st.at += dt) >= 1.5) { st.ph = 'done'; ev.push('done'); }
    } else if (st.kind === 'ride') {
      const R = K.RIDE;
      if (st.ph === 'board' && st.t >= R.board) { st.ph = 'way'; ev.push('go'); }
      else if (st.ph === 'way') {
        st.s = Math.min(st.len, st.s + (inp.slow ? R.slow : R.speed) * dt);
        while (st.lines && st.li < st.lines.length && st.s >= st.lines[st.li].at) ev.push('line:' + st.lines[st.li++].key);
        if (!st.moment && st.s >= st.len * 0.45) { st.moment = true; ev.push('moment'); }
        if (st.s >= st.len) { st.ph = 'arrive'; st.at = 0; ev.push('arrive'); }
      } else if (st.ph === 'arrive' && (st.at += dt) >= R.end) { st.ph = 'done'; ev.push('done'); }
    }
    return ev;
  };

  K.at = function (st) {
    if (!st) return { phase: 'none', alt: 0, k: 0 };
    if (st.kind === 'lift') return { phase: st.ph, alt: K.liftAlt(st.t, st.top), k: clamp(st.t / K.LIFT.len, 0, 1), kg: clamp((st.t - K.LIFT.board) / (K.LIFT.ground - K.LIFT.board), 0, 1), ks: clamp((st.t - K.LIFT.ground) / (K.LIFT.len - K.LIFT.ground), 0, 1) };
    if (st.kind === 'bridge') return { phase: st.ph, alt: 0, k: clamp(st.s / K.BRIDGE.len, 0, 1) };
    return { phase: st.ph, alt: 0, k: st.len > 0 ? clamp(st.s / st.len, 0, 1) : 1 };
  };
  K.skip = function (st) {
    if (!st || st.ph === 'done' || st.ph === 'arrive') return false;
    if (st.kind === 'ride') { st.ph = 'done'; st.off = true; return true; }
    if (st.t < 2) return false;
    if (st.kind === 'lift') { st.t = K.LIFT.len; if (st.ph === 'board') st.ph = 'ground'; return true; }
    if (st.kind === 'bridge') { st.s = K.BRIDGE.len; st.ph = 'way'; return true; }
    return false;
  };

  // ---------------------------------------------------------------- the caravan
  K.pickRide = function (places, pos, seen) {
    seen = seen || {};
    let best = null, bs = Infinity;
    for (const P of places || []) {
      if (!P || !fin(P.x) || !fin(P.z)) continue;
      const d = Math.hypot(P.x - pos[0], P.z - pos[1]);
      if (d < K.RIDE.min || d > K.RIDE.max) continue;
      const sc = d + (seen[P.id] ? 2000 : 0);
      if (sc < bs) { bs = sc; best = P; }
    }
    return best;
  };
  // a gentle bend (a sine arc to one side, up to 40 m or 12 % of the way), a point every 6 m
  K.ridePath = function (a, b, seed) {
    const dx = b[0] - a[0], dz = b[1] - a[1], D = Math.hypot(dx, dz) || 1, nx = -dz / D, nz = dx / D;
    const bend = (h(seed, 7) - 0.5) * 2 * Math.min(40, 0.12 * D), n = Math.max(2, Math.ceil(D / K.RIDE.step) + 1), out = [];
    for (let i = 0; i < n; i++) { const u = i / (n - 1), o = bend * Math.sin(Math.PI * u); out.push([Math.round((a[0] + dx * u + nx * o) * 100) / 100, Math.round((a[1] + dz * u + nz * o) * 100) / 100]); }
    return out;
  };
  K.rideLen = function (P) { let L = 0; for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); return L; };
  K.rideAt = function (P, s, out) {
    out = out || {};
    let i = 1, acc = 0;
    for (; i < P.length; i++) { const l = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); if (acc + l >= s || i === P.length - 1) { const u = l > 0 ? clamp((s - acc) / l, 0, 1) : 1; out.x = P[i - 1][0] + (P[i][0] - P[i - 1][0]) * u; out.z = P[i - 1][1] + (P[i][1] - P[i - 1][1]) * u; out.yaw = Math.atan2(-(P[i][0] - P[i - 1][0]), -(P[i][1] - P[i - 1][1])); return out; } acc += l; }
    out.x = P[0][0]; out.z = P[0][1]; out.yaw = 0; return out;
  };

  // ---------------------------------------------------------------- save / resume
  K.snap = function (st) {
    if (!st) return null;
    const r = { v: 1, kind: st.kind, from: st.from, to: st.to, seed: st.seed, t: +st.t.toFixed(3), s: +st.s.toFixed(3), ph: st.ph, went: !!st.went };
    if (st.kind === 'lift') r.top = st.top;
    if (st.kind === 'ride') { r.path = st.path; r.name = st.name; r.li = st.li; r.moment = !!st.moment; }
    return r;
  };
  K.resume = function (rec, here) {
    if (!isObj(rec) || rec.v !== 1 || !K.KINDS[rec.kind] || typeof rec.from !== 'string' || !fin(rec.t) || !fin(rec.s)) return null;
    const st = K.start(rec.kind, { from: rec.from, to: rec.to, seed: rec.seed, top: rec.top, path: rec.path, name: rec.name });
    st.t = Math.max(0, rec.t); st.s = Math.max(0, rec.s);
    if (rec.kind === 'ride') {
      if (here !== rec.from || !Array.isArray(rec.path) || rec.path.length < 2 || !rec.path.every(p => Array.isArray(p) && fin(p[0]) && fin(p[1]))) return null;
      st.s = Math.min(st.s, st.len); st.li = clamp(rec.li | 0, 0, st.lines.length); st.moment = !!rec.moment; st.ph = 'way';
      return { act: 'ride', st };
    }
    if (here === rec.to) return { act: 'arrived', st };
    if (here !== rec.from) return null;
    if (rec.kind === 'lift') { st.t = Math.min(st.t, K.LIFT.ground); st.ph = st.t < K.LIFT.board ? 'board' : 'ground'; st.went = false; }
    else { st.s = Math.min(st.s, K.BRIDGE.depart - 1); st.ph = 'way'; st.went = false; st.t = Math.max(st.t, K.BRIDGE.board); }
    return { act: 'again', st };
  };

  // ---------------------------------------------------------------- the rules
  K.ok = function (ctx, kind) {
    ctx = ctx || {};
    if (ctx.off) return 'off';
    if (ctx.flight) return 'busy';
    if (ctx.guest && kind !== 'ride') return 'guest';
    return null;
  };
  // (o-seamless2: Very Low walks the Lichtbrücke too — painted, cheap but bright; its lift stays the film)
  K.mode = (ctx, kind) => (ctx && (ctx.off || (ctx.potato && kind !== 'bridge')) ? 'film' : 'walk');

  // ---------------------------------------------------------------- o-seamless2: the sights (docs/superpowers/plans/2026-11-01-o-seamless2.md)
  // the bridge's extras per tier: sparkles drifting up, aurora ribbons, the travellers (Flausel lights, the Sternwal)
  K.fx = (ctx) => (ctx && ctx.potato ? { sparks: 0, ribbons: 0, travellers: false } : ctx && ctx.preset === 'low' ? { sparks: 16, ribbons: 0, travellers: false } : { sparks: 40, ribbons: 2, travellers: true });
  // the heading carried into the space frame: the look's angle from the sun's azimuth about the up axis (voxel world:
  // forward = (-sin yaw, -cos yaw), y up; turning the sun's horizontal direction by it about +y gives the look)
  const wrap = (a) => { a = (a + Math.PI) % (2 * Math.PI); if (a < 0) a += 2 * Math.PI; return a - Math.PI; };
  K.relAz = (sun, yaw) => wrap(Math.atan2(-Math.sin(yaw), -Math.cos(yaw)) - Math.atan2(sun[0], sun[2]));
  // the lift's look in the space phase (pitch over the horizon, rad): your pitch at the switch, easing up so the station
  // (straight up the tether) is in view from 40 % of the phase (the fov's top at 35°), 78° at the berth
  const sm = (t) => t * t * (3 - 2 * t);
  K.liftLook = (k, p0) => { k = clamp(+k || 0, 0, 1); const tg = 1.03 + 0.33 * sm(clamp((k - 0.4) / 0.6, 0, 1)); return p0 + (tg - p0) * sm(clamp(k / 0.4, 0, 1)); };
  // the ring's lights greeting you at the top: 0 until 82 % of the space phase, 1 from 97 %
  K.greet = (k) => (k <= 0.82 ? 0 : k >= 0.97 ? 1 : sm((k - 0.82) / 0.15));
  // footsteps chime: the tiles crossed from s0 to s1
  K.chimes = (s0, s1, tile) => Math.max(0, Math.floor(s1 / tile) - Math.floor(s0 / tile));
  // the caravan's seat: on the bench between the crate rows (the front crates and rail the frame's lower edge), right of the driver (he sits left), eye ~2 m over the cart's floor (under the
  // canopy's fringe at 2.36 m), a gentle sway (roll ≤ 0.032 rad; none with Weniger Bewegung). y0 = the cart's floor
  K.SEAT = { fwd: 0.75, side: 0.62, eye: 1.98, stand: 1.62 };   // (the bench between the crate rows)
  K.seat = function (at, y0, t, sway) {
    const S = K.SEAT, fx = -Math.sin(at.yaw), fz = -Math.cos(at.yaw), rx = Math.cos(at.yaw), rz = -Math.sin(at.yaw);
    const roll = sway ? 0.02 * Math.sin(t * 1.3) + 0.011 * Math.sin(t * 3.1 + 1) : 0, bob = sway ? Math.sin(t * 2.1) * 0.035 : 0;
    return { p: [at.x + fx * S.fwd + rx * S.side, y0 + S.eye - S.stand + bob, at.z + fz * S.fwd + rz * S.side], d: [at.x + fx * S.fwd - rx * S.side, y0 + 0.72 + bob, at.z + fz * S.fwd - rz * S.side], roll, eye: S.eye, bob };
  };
  K.keys = () => ['g.jy.lift.name', 'g.jy.lift.sub', 'g.jy.lift.cabin', 'g.jy.lift.alt', 'g.jy.lift.space', 'g.jy.lift.greet', 'g.jy.bridge.name', 'g.jy.bridge.walk',
    'g.jy.ride.offer', 'g.jy.ride.board', 'g.jy.ride.off', 'g.jy.ride.arrive', 'g.jy.ride.who', 'g.jy.arrive', 'g.set.journeys', 'g.set.journeys.tip'].concat(K.LINES);
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
