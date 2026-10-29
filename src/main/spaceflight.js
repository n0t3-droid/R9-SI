// ============================================================================
// u-ascent · VR.SpaceFlight — the space regime's autopilot, the Reisesprung, Heimkehr from space and the space frame
// (docs/superpowers/plans/2026-10-22-u-ascent.md §3.3–§3.6; U§4.2, §5.4, §5.5, §9). The physics is ascent.js's (one state,
// one step); this file flies it and draws it.
//   · the autopilot's space modes (fl.auto.space): 'orbit' — Zum Orbit, the gravity turn of U§5.2 (pitch 80° → 10° from
//     300 to 2,500 m at 2 g toward true east, no jets) and the level burn until the orbit's low point reaches 3 km;
//     'circ' — Kreisbahn, thrust along v_circ·prograde − v until the difference is under 0.5 m/s; 'land' — entry.js;
//     'jump' / 'home' — the 6-s Reisesprung to a body of U§2.1, Heimkehr to the Gate Temple's apron
//   · patched conics: the frame follows the sphere of influence (VR.Universe's soi, toFrame)
//   · the ghost path (S.ghost: the conic, 128 points, one patch) for the nav tile
//   · the space frame: playFrame wrapped (as spacescene.js does for /raum) while the ship is in 'space' or jumping — the
//     ship's flight update, the clock, the space scene through u-space0's draw list with the camera where the ship's eye is,
//     the ship and its cockpit drawn on their map spot, the voxel world frozen and its chunks freed after 60 s
//   · pure part (node: test/ascent.js) above the line
// ============================================================================
(function (VR) {
  'use strict';
  const SF = VR.SpaceFlight = {};
  const A = VR.Ascent, UNI = () => VR.Universe;
  const PI = Math.PI, D2R = PI / 180;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const T = (k, v, fb) => (VR.I18N ? VR.I18N.t(k, v, fb) : (fb !== undefined ? fb : k));
  const M = A.math, dot = M.dot, len = M.len, cross = M.cross, unit = M.unit, v3 = M.v3;
  const set3 = (o, x, y, z) => { o[0] = x; o[1] = y; o[2] = z; return o; };

  // ---------------------------------------------------------------- the places a ship can go from orbit
  // the bodies of U§2.1 a Reisesprung reaches (the swarm and the far planets wait for u-cruise); their dims (u-moons1 adds
  // Basalt and Opal: a dim registered with that id makes the body landable)
  SF.JUMP_TO = ['aqua', 'zinn', 'opal', 'basalt', 'ocker', 'amarant'];
  SF.DIM_OF = { herz: 'overworld', aqua: 'aqua', zinn: 'zinn', opal: 'opal', basalt: 'basalt', ocker: 'ocker' };
  SF.landable = (body) => { const d = SF.DIM_OF[body]; return !!(d && d !== 'overworld' && VR.DimReg && VR.DimReg.has && VR.DimReg.has(d)); };
  SF.ORBIT = 3063;                 // the parking orbit's height on the map (3 km over the sea: 11.0 min round)
  SF.JUMP_S = 6;                   // the Reisesprung and the home jump (U§9: six seconds)

  // ---------------------------------------------------------------- guidance helpers (system axes)
  const _up = v3(), _e = v3(), _h = v3(), _n = v3(), _d = v3(), _va = v3(), _w = v3();
  // true east at the state (round Herzwelt: the turning ground's way; elsewhere the body's spin axis, else the orbit's)
  function eastOf(st, out) {
    const b = UNI().home.body(st.frame), ax = b.spin && b.spin.axis ? b.spin.axis : [0, 0, 1];
    unit(st.r, _up); cross(ax, _up, out);
    if (len(out) < 1e-6) set3(out, 1, 0, 0);
    return unit(out, out);
  }
  // the horizontal part of v (inertial), unit — prograde over the ground below
  function progradeOf(st, out) {
    unit(st.r, _up); const vu = dot(st.v, _up);
    set3(out, st.v[0] - _up[0] * vu, st.v[1] - _up[1] * vu, st.v[2] - _up[2] * vu);
    if (len(out) < 1e-3) return eastOf(st, out);
    return unit(out, out);
  }
  SF.eastOf = eastOf; SF.progradeOf = progradeOf;
  // a nose `pitch` above the horizontal toward the unit horizontal direction hd
  function noseAt(hd, pitch, out) { const c = Math.cos(pitch), s = Math.sin(pitch); return unit(set3(out, hd[0] * c + _up[0] * s, hd[1] * c + _up[1] * s, hd[2] * c + _up[2] * s), out); }
  // how well the nose points along d (1 aligned … 0 at 60° and beyond): thrust waits for the turn
  const aligned = (S, d) => { const c = -(S[2] * d[0] + S[5] * d[1] + S[8] * d[2]); return clamp((c - 0.5) / 0.5, 0, 1); };
  SF.aligned = aligned;

  // ---------------------------------------------------------------- Zum Orbit (U§5.2)
  // the pitch program: 80° at 300 m to 10° at 2,500 m (exponent 0.6: tuned so the burn ends in a circle at 3 km —
  // plan §2, test/ascent.js e)
  SF.pitchProgram = (y) => (80 - 70 * Math.pow(clamp((y - 300) / 2200, 0, 1), 0.6)) * D2R;
  const G = { nose: v3(), up: null, throttle: 0, boost: false, jets: 'off', sink: null, keepClimb: false };
  const out0 = () => { G.up = null; G.throttle = 0; G.boost = false; G.jets = 'off'; G.sink = null; G.keepClimb = false; return G; };
  SF.orbitGuide = (fl, h, a) => {
    const st = a.st, A_ = fl.auto, y = A.mapY(st), o = out0();
    const target = A_.target || SF.ORBIT;
    const orb = A.orbitOf(st);
    if (!A_.phase) A_.phase = 'climb';
    if (A_.phase === 'climb' && orb.apo >= target) A_.phase = 'raise';
    if (A_.phase === 'raise' && orb.peri >= target - 60) A_.phase = 'done';
    unit(st.r, _up);
    if (A_.phase === 'climb') {
      eastOf(st, _e); noseAt(_e, SF.pitchProgram(y), o.nose);
      o.throttle = 2 / 3; o.keepClimb = true;
    } else if (A_.phase === 'raise') {
      progradeOf(st, _h);
      const vUp = dot(st.v, _up), err = (target - orb.apo) / 200;
      noseAt(_h, clamp(err * 0.6 - vUp * 0.004, -0.35, 0.5), o.nose);
      o.throttle = 2 / 3; o.keepClimb = true;
    } else {
      progradeOf(st, _h); noseAt(_h, 0, o.nose);
      o.throttle = 0; o.done = true;
    }
    return o;
  };
  // ---------------------------------------------------------------- Kreisbahn: thrust along v_circ·prograde − v
  SF.circGuide = (fl, h, a) => {
    const st = a.st, b = UNI().home.body(st.frame), o = out0();
    const r = len(st.r), vc = Math.sqrt(b.mu / r);
    progradeOf(st, _h);
    set3(_d, _h[0] * vc - st.v[0], _h[1] * vc - st.v[1], _h[2] * vc - st.v[2]);
    const dv = len(_d);
    if (dv < 0.5) { progradeOf(st, _h); unit(st.r, _up); noseAt(_h, 0, o.nose); o.done = true; return o; }
    unit(_d, o.nose);
    o.throttle = aligned(a.S, o.nose) * clamp(dv / 25, 0.03, 2 / 3);
    return o;
  };
  // the dispatcher: ascent.js asks it every frame while a space mode flies (null: the pilot's stick)
  SF.guide = (fl, h, a) => {
    const A_ = fl.auto; if (!A_ || !A_.space) return null;
    A_.t = (A_.t || 0) + h;
    let o = null;
    if (A_.space === 'orbit') o = SF.orbitGuide(fl, h, a);
    else if (A_.space === 'circ') o = SF.circGuide(fl, h, a);
    else if ((A_.space === 'land' || A_.space === 'descend') && VR.Entry) o = VR.Entry.guide(fl, h, a);
    else if (A_.space === 'arm') {
      // a jump armed: the countdown (G moves on to the next target), the ship holds its attitude
      o = out0(); set3(o.nose, -a.S[2], -a.S[5], -a.S[8]); o.up = null; o.keepClimb = true;
      A_.armT -= h;
      if (A_.armT <= 0) { const to = A_.to; fl.auto = null; if (to === 'home') SF.homeJump(fl); else SF.jumpStart(fl, to); return null; }
      return o;
    }
    if (o && o.done) SF.done(fl, A_);
    return o;
  };
  A.guide = SF.guide;
  // a mode finished: the next one (Zum Orbit → a last Kreisbahn polish) or the pilot's hands back
  SF.done = (fl, A_) => {
    if (A_.space === 'orbit') { A_.space = 'circ'; A_.phase = null; SF.say(fl, 'g.asc.inOrbit', SF.orbitText(fl)); return; }
    if (A_.space === 'circ') { fl.auto = null; SF.say(fl, A_.quiet ? null : 'g.asc.circDone', SF.orbitText(fl)); return; }
    if (A_.offWorld) SF.hint(fl, 'g.asc.noLand', { name: SF.nameOf(A.ascOf(fl).st.frame) });
    fl.auto = null;
  };
  SF.say = (fl, key, vars) => { const g = fl.g; if (!key || !g || !g.ui) return; if (g.ui.chatLine) g.ui.chatLine(T(key, vars), '#9affd8'); };
  SF.hint = (fl, key, vars, ms) => { const g = fl.g; if (key && g && g.ui && g.ui.hint) g.ui.hint(T(key, vars), ms || 3200); };
  SF.nameOf = (id) => { const b = UNI().home.body(id); if (!b) return id; const L = VR.I18N && VR.I18N.lang, en = (typeof L === 'function' ? L() : L) === 'en'; return en ? b.name.en : b.name.de; };
  SF.orbitText = (fl) => {
    const a = A.ascOf(fl), o = A.orbitOf(a.st);
    return { ap: Math.round(o.apo - A.DATUM), pe: Math.round(o.peri - A.DATUM), min: (o.period / 60).toFixed(1) };
  };

  // ---------------------------------------------------------------- starting the modes (G, V, the commands, the test)
  // fl.auto for a space mode carries a pseudo-site (the HUD, the nav tile and the cockpit's lamps read auto.site)
  SF.start = (fl, mode, opts) => {
    const why = A.mayClimb(fl);
    if (why) { SF.hint(fl, why); return false; }
    if (!fl.running && fl.autoStart) fl.autoStart();
    const b = fl.b, to = opts && opts.to;
    const label = mode === 'arm' ? (to === 'home' ? T('g.asc.site.home') : SF.nameOf(to)) : T('g.asc.site.' + mode);
    fl.auto = Object.assign({ space: mode, phase: null, t: 0, site: { id: 'space:' + mode + (to ? ':' + to : ''), name: label, x: b.pos[0], y: b.pos[1], z: b.pos[2] }, spot: null, dist: 0, eta: 0, landing: false }, opts || {});
    if (fl.state !== 'flying') { fl.state = 'flying'; fl.holdAlt = null; }
    fl.ctl.speed = null; fl.ctl.strafe = 0;
    if (mode !== 'arm') SF.say(fl, 'g.asc.go.' + mode);
    return true;
  };
  // G: in the air above 150 m Zum Orbit comes first (then the villages, flight.js's own cycle); in the climb Zum Orbit and
  // Landen; in space Kreisbahn → Landen → Heimkehr → the Reisesprung to Aquamarin … Amarant (each armed for 2 s) → off
  SF.CYCLE = ['circ', 'land', 'home'].concat(SF.JUMP_TO.map(id => 'jump:' + id));
  SF.toggle = (fl) => {
    const r = fl.regime || 'air', A_ = fl.auto;
    if (r === 'air') {
      if (A_ && A_.space === 'orbit') { fl.auto = null; return false; }   // (flight.js goes on with the nearest village)
      if (A_ || fl.b.pos[1] < 150 || A.mayClimb(fl)) return false;
      return SF.start(fl, 'orbit');
    }
    if (A.ascOf(fl).jump) return true;
    const list = r === 'climb' ? ['orbit', 'descend'] : SF.CYCLE;
    const cur = !A_ || !A_.space ? -1 : A_.space === 'arm' ? list.indexOf(A_.to === 'home' ? 'home' : 'jump:' + A_.to) : list.indexOf(A_.space === 'land' && r === 'climb' ? 'descend' : A_.space);
    const next = list[cur + 1];
    if (!next) { fl.auto = null; SF.hint(fl, 'g.fl.autoOff2'); return true; }
    if (next === 'home') return SF.start(fl, 'arm', { to: 'home', armT: 2 }) && (SF.hint(fl, 'g.asc.armHome', null, 2200), true);
    if (next.startsWith('jump:')) { const to = next.slice(5); SF.start(fl, 'arm', { to, armT: 2 }); SF.hint(fl, 'g.asc.armJump', { name: SF.nameOf(to) }, 2200); return true; }
    return SF.start(fl, next);
  };
  // V in the climb or in space: Landen (from orbit the entry, in the climb straight down); V again: the hands back
  SF.land = (fl) => {
    const r = fl.regime || 'air';
    if (r === 'air') return false;
    const A_ = fl.auto;
    if (A_ && (A_.space === 'land' || A_.space === 'descend')) { fl.auto = null; SF.hint(fl, 'g.fl.autoOff'); return true; }
    const st = A.ascOf(fl).st;
    if (st.frame !== 'herz') {
      if (SF.landable(st.frame) && SF.onLandBody) SF.onLandBody(fl, st.frame);
      else SF.hint(fl, 'g.asc.noLand', { name: SF.nameOf(st.frame) });
      return true;
    }
    SF.start(fl, r === 'space' ? 'land' : 'descend');
    // the entry's heating peak, flown ahead once (≈ 1–2 ms; the tick refines it every 3 s): the plasma's own scale
    if (r === 'space' && fl.auto && VR.Entry && VR.Entry.predict) { const P = VR.Entry.predict(st, 'deorbit'); if (P && P.qMax > 0) fl.auto.qRef = P.qMax; }
    return true;
  };

  // ---------------------------------------------------------------- patched conics: the frame follows the spheres
  SF.patch = (st) => {
    const S = UNI().home, b = S.body(st.frame);
    const r = len(st.r);
    if (b.parent && b.soi && r > b.soi) { S.toFrame(st.frame, b.parent, st.r, st.v, st.t, st.r, st.v); st.frame = b.parent; UNI().verletInit(st, S.body(st.frame).mu); return true; }
    for (const c of S.children[st.frame] || []) {
      const cb = S.body(c); if (!(cb.soi > 0)) continue;
      const rc = S.rel(c, st.t, v3(), null);
      if (Math.hypot(st.r[0] - rc[0], st.r[1] - rc[1], st.r[2] - rc[2]) < cb.soi) { S.toFrame(st.frame, c, st.r, st.v, st.t, st.r, st.v); st.frame = c; UNI().verletInit(st, cb.mu); return true; }
    }
    return false;
  };
  A.afterStep = (st) => SF.patch(st);

  // ---------------------------------------------------------------- the ghost path (U§4.2): the conic and one patch
  SF.ghost = (st, out) => UNI().home.ghost(st.frame, st.r, st.v, st.t, out);

  // ---------------------------------------------------------------- the Reisesprung and the home jump (6 s)
  // from the ship's place (system frame) along a curve lifted off the ring plane, the nearest the path comes to Amarant at
  // least 1.5 of its radii; the end a circular orbit round the target at 2 R (Amarant 1.5 R) on its lit side — or, home, the
  // map spot over the Gate Temple's apron at 2,400 m, resting on the ground's turn
  const qb = (p0, c, p1, u, o) => { const a = (1 - u) * (1 - u), b = 2 * u * (1 - u), d = u * u; return set3(o, a * p0[0] + b * c[0] + d * p1[0], a * p0[1] + b * c[1] + d * p1[1], a * p0[2] + b * c[2] + d * p1[2]); };
  SF.jumpPlan = (from, to, t0, opts) => {
    const U = UNI(), S = U.home, st = S.state(t0), B = S.body(to);
    opts = opts || {};
    const P0 = Float64Array.from(from.r), tb = st.b[to].r, sun = st.b.helia.r;
    let P1, end;
    if (opts.home) {
      // the home jump: over the apron (opts.at = [x, y, z] on Herzwelt's map), at the world's time of arrival
      const t1 = t0 + SF.JUMP_S, r = v3(), v = v3();
      S.chartToInertial('herz', opts.at, [0, 0, 0], t1, r, v);
      const pH = S.pos('herz', t1, v3());
      P1 = Float64Array.from([pH[0] + r[0], pH[1] + r[1], pH[2] + r[2]]);
      end = { frame: 'herz', r, v, t: t1 };
    } else {
      const k = SF.arrivalK(to), rad = B.R * k;
      // the arrival point: between the way we come from and the sun, so the target is lit as it grows
      const dFrom = unit(set3(v3(), P0[0] - tb[0], P0[1] - tb[1], P0[2] - tb[2]), v3()), dSun = unit(set3(v3(), sun[0] - tb[0], sun[1] - tb[1], sun[2] - tb[2]), v3());
      const dir = unit(set3(v3(), dFrom[0] + dSun[0], dFrom[1] + dSun[1], dFrom[2] + dSun[2]), v3());
      const t1 = t0 + SF.JUMP_S, st1 = S.state(t1), tb1 = st1.b[to].r;
      P1 = Float64Array.from([tb1[0] + dir[0] * rad, tb1[1] + dir[1] * rad, tb1[2] + dir[2] * rad]);
      // the circular orbit there: speed √(μ/r), in the plane of the way we came (prograde about the body's own axis)
      const r = Float64Array.from([dir[0] * rad, dir[1] * rad, dir[2] * rad]);
      const ax = B.spin && B.spin.axis ? B.spin.axis : [0, 0, 1];
      let tang = cross(ax, dir, v3()); if (len(tang) < 1e-6) tang = cross([1, 0, 0], dir, v3()); unit(tang, tang);
      const vc = Math.sqrt(B.mu / rad), v = Float64Array.from([tang[0] * vc, tang[1] * vc, tang[2] * vc]);
      end = { frame: to, r, v, t: t1 };
    }
    // the control point: the middle lifted along the ecliptic north by 0.35 of the way, more until Amarant stays clear
    const pA = S.pos('amarant', t0, v3()), RA = S.body('amarant').R;
    const D = Math.hypot(P1[0] - P0[0], P1[1] - P0[1], P1[2] - P0[2]);
    let C = null, lift = 0.35, minA = 0;
    for (let k = 0; k < 8; k++) {
      C = Float64Array.from([(P0[0] + P1[0]) / 2, (P0[1] + P1[1]) / 2, (P0[2] + P1[2]) / 2 + D * lift]);
      minA = Infinity; const q = v3();
      for (let i = 0; i <= 64; i++) { qb(P0, C, P1, i / 64, q); minA = Math.min(minA, Math.hypot(q[0] - pA[0], q[1] - pA[1], q[2] - pA[2])); }
      if (minA > 1.5 * RA || to === 'amarant') break;
      lift *= 1.6;
    }
    return { from: P0, to, t0, dur: SF.JUMP_S, P0, C, P1, end, minAmarant: minA, home: !!opts.home };
  };
  // the arrival orbit's radius in the target's radii: 2 (Amarant 1.5), inside half the way to the edge of a small moon's
  // sphere of influence (Opal's reaches 1.74 R, Zinnober's 1.94 R: there 1.37 and 1.47 R)
  SF.arrivalK = (to) => { const B = UNI().home.body(to); return to === 'amarant' ? 1.5 : Math.min(2, 1 + 0.5 * (B.soi / B.R - 1)); };
  // where the jump is at s seconds in (system frame): the turn (1 s), the flight (4 s, eased), the settling (1 s)
  SF.jumpAt = (J, s, out) => {
    const u = clamp((s - 1) / (J.dur - 2), 0, 1), e = u * u * u * (u * (u * 6 - 15) + 10);
    return qb(J.P0, J.C, J.P1, e, out || v3());
  };
  // the flash at both ends: 0…1
  SF.jumpFlash = (J, s) => Math.max(Math.exp(-Math.pow((s - 1) / 0.35, 2)), Math.exp(-Math.pow((s - (J.dur - 1)) / 0.35, 2)) * 0.8);

  // the jump flown: the ship rides the path in the system frame (st.frame 'helia'), its nose along the way; at the end the
  // state is the plan's circular orbit (or, home, the rest over the apron: the climb, then the descent onto it)
  const _jp = v3(), _jd = v3(), _ec = [0, 0, 1];
  SF.jumpStart = (fl, to, opts) => {
    const a = A.ascOf(fl), st = a.st, S = UNI().home;
    const p = S.pos(st.frame, st.t, v3());
    const J = SF.jumpPlan({ r: [p[0] + st.r[0], p[1] + st.r[1], p[2] + st.r[2]] }, to, st.t, opts);
    a.jump = { J, s: 0, to, home: !!(opts && opts.home), site: opts && opts.site };
    st.frame = 'helia'; st.r.set(J.P0); st.v.fill(0); st.coast = false;
    fl.auto = null; fl.regime = 'space';
    if (SF.onJump) SF.onJump(fl, 'start', a.jump);
    return a.jump;
  };
  SF.jumpStep = (fl, h) => {
    const a = A.ascOf(fl), st = a.st, j = a.jump, J = j.J;
    j.s += h; st.t += h;
    if (j.s < J.dur) {
      SF.jumpAt(J, j.s, _jp);
      set3(st.v, (_jp[0] - st.r[0]) / h, (_jp[1] - st.r[1]) / h, (_jp[2] - st.r[2]) / h);
      st.r.set(_jp);
      // the nose along the way (the first second turns toward the target), the ship's up toward the ecliptic's north
      SF.jumpAt(J, Math.min(J.dur, Math.max(j.s, 1) + 0.25), _jd);
      set3(_jd, _jd[0] - st.r[0], _jd[1] - st.r[1], _jd[2] - st.r[2]);
      if (len(_jd) < 1e-6) set3(_jd, J.P1[0] - J.P0[0], J.P1[1] - J.P0[1], J.P1[2] - J.P0[2]);
      unit(_jd, _jd);
      A.slew(a.S, _jd, _ec, 2.4 * h, 1.2 * h); M.ortho(a.S);
      return;
    }
    // arrival
    const e = J.end;
    st.frame = e.frame; st.r.set(e.r); st.v.set(e.v); st.t = e.t; st.coast = true;
    UNI().verletInit(st, UNI().home.body(st.frame).mu);
    a.jump = null;
    unit(st.r, _up);
    if (j.home) {
      // over the apron at 2,400 m, at rest on the ground's turn: the climb takes the ship, the descent puts it down there
      progradeOf(st, _jd); A.frameFrom(_jd, _up, a.S);   // (level, nose east: the climb's Euler angles come from it)
      unit(st.r, a.prevUp);
      A.toClimb(fl);
      SF.start(fl, 'descend', j.site ? { site: j.site, target: j.site } : null);
    } else {
      progradeOf(st, _jd); A.frameFrom(_jd, _up, a.S);
      unit(st.r, a.prevUp);
      fl.regime = 'space';
      SF.say(fl, 'g.asc.arrived', { name: SF.nameOf(j.to) });
      if (!SF.landable(j.to)) SF.hint(fl, 'g.asc.noLand', { name: SF.nameOf(j.to) }, 4200);
    }
    if (SF.onJump) SF.onJump(fl, 'end', j);
  };
  // Heimkehr from the sky: the home jump to 2,400 m over the Gate Temple's apron, then down onto it (the temple's dock)
  SF.apron = () => {
    const H = VR.Heart;
    return H ? { id: 'temple', name: T('g.fl.templeName'), x: H.TEMPLE.x, z: H.TEMPLE.front + 10, y: H.PLAT + 1, dock: true } : { id: 'temple', name: T('g.fl.templeName'), x: 0, z: 40, y: 80, dock: true };
  };
  SF.homeJump = (fl) => {
    const site = SF.apron();
    return SF.jumpStart(fl, 'herz', { home: true, at: [site.x + 0.5, 2400, site.z + 0.5], site });
  };

  // ---------------------------------------------------------------- the space programs with a fade and Herzwelt's near cut
  // (a wrapper, so space_shaders.js stays u-space0's and u-moons1's): u_fadeOut = (1 − the colour's share, 1 − the alpha's,
  // log2 of an exposure gain) — all 0, as drawn: /raum sets nothing — and in Herzwelt's program u_cut (the sines of the
  // ground arcs from the camera's nadir where the impostor starts and where it is whole; z on) with u_nadirB (that nadir in
  // the body frame). The climb draws the land beyond the horizon tiles with it; the tiles dissolve on the band after it
  const CUT = `
  if (u_cut.z > 0.5) {
    vec3 Dc = normalize(v_dir);
    vec3 Dq = vec3(dot(Dc, u_bu), dot(Dc, u_bv), dot(Dc, u_cdir));
    float s2c = Dq.x * Dq.x + Dq.y * Dq.y, qc = u_d * sqrt(s2c);
    if (qc < 1.0 && Dq.z > 0.0) {
      float sqc = sqrt(1.0 - qc * qc);
      vec3 Nq = vec3(u_d * Dq.z * Dq.x, u_d * Dq.z * Dq.y, -u_d * s2c) - Dq * sqc;
      vec3 Nc = normalize(u_toBody * (Nq.x * u_bu + Nq.y * u_bv + Nq.z * u_cdir));
      o *= smoothstep(u_cut.x, u_cut.y, length(cross(Nc, u_nadirB)));
    }
  }`;
  const wrapFS = (name, fs) => !/\bout\s+(?:(?:high|medium|low)p\s+)?vec4\s+o\s*;/.test(fs) || (fs.match(/void main\(\)\s*\{/g) || []).length !== 1 ? fs : fs.replace(/void main\(\)\s*\{/, 'void spaceMain() {') + `
uniform vec4 u_fadeOut;   // u-ascent (spaceflight.js)
${name === 'herz' || name === 'herz_vl' ? 'uniform vec4 u_cut;\nuniform vec3 u_nadirB;' : ''}
void main() {
  spaceMain();${name === 'herz' || name === 'herz_vl' ? CUT : ''}
  o.rgb *= (1.0 - u_fadeOut.x) * exp2(u_fadeOut.z);
  o.a *= 1.0 - u_fadeOut.y;
}`;
  SF.wrapFS = wrapFS;
  SF.wrapPrograms = () => {
    const SH = VR.SpaceShaders;
    if (!SH || !SH.programs || SH.ascentWrapped) return false;
    const orig = SH.programs; SH.ascentWrapped = true;
    SH.programs = () => { const P = orig(), o = {}; for (const k in P) o[k] = { vs: P[k].vs, fs: wrapFS(k, P[k].fs) }; return o; };
    return true;
  };
  SF.wrapPrograms();


  // ================================================================ the game's glue (a page with the game)
  if (typeof window === 'undefined' || !VR.Game) return;
  SF.page = true;
  const Game = VR.Game, SSm = () => VR.SpaceScene;
  const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const toScene = (v, o) => { o = o || [0, 0, 0]; o[0] = v[1]; o[1] = v[2]; o[2] = v[0]; return o; };   // (scene (x, y, z) = universe (y, z, x))

  // ---------------------------------------------------------------- the space scene's frame for a camera on the map
  // the camera's place on Herzwelt's map (or, away from it, the state's own place) → the scene's pose: the session axes
  // are the map's there (east, up, south), so the renderer's camera — the ship's cockpit, chase and cinematic views,
  // unchanged — looks into it the way it looks over the map
  const _M = M.m9(), _r = v3(), _v = v3(), _o = v3(), _q = [0, 0, 0];
  SF.eph = {};
  SF.S = { anc: null };
  SF.cameraFrame = function (g, cam, t, st, b) {
    const S = UNI().home, SS = SSm(), r = g.renderer;
    SS.ephemeris(t, SF.eph);
    const eph = SF.eph;
    let body = 'herz';
    if (!st || st.frame === 'herz') {
      S.chartToInertial('herz', [cam.x, cam.y, cam.z], null, t, _r, _v);
      A.localM(cam.x, cam.z, t, _M);
    } else {
      // away from Herzwelt (a moon's orbit, the jump): the state's place, the camera's offset from the ship in its frame
      body = st.frame === 'helia' ? 'herz' : st.frame;
      A.localFrame(st, _M);
      const dx = cam.x - b.pos[0], dy = cam.y - b.pos[1], dz = cam.z - b.pos[2];
      M.mulv(_M, [dx, dy, dz], _o);
      const pB = S.pos(st.frame, t, v3()), pRef = S.pos(body, t, v3());
      set3(_r, pB[0] + st.r[0] + _o[0] - pRef[0], pB[1] + st.r[1] + _o[1] - pRef[1], pB[2] + st.r[2] + _o[2] - pRef[2]);
    }
    const ref = eph.bodies[body], pos = [ref.p[0] + _r[1], ref.p[1] + _r[2], ref.p[2] + _r[0]];
    const up = toScene([_M[1], _M[4], _M[7]]), south = toScene([_M[2], _M[5], _M[8]]);
    // the patch round the nadir: on a 4-km grid a little ahead of the way (a new one every few kilometres, not every frame)
    let nadir = null;
    if (body === 'herz' && (!st || st.frame === 'herz')) {
      const vx = b && b.vel ? b.vel[0] : 0, vz = b && b.vel ? b.vel[2] : 0, lead = Math.min(12000, Math.hypot(vx, vz) * 6) / Math.max(1, Math.hypot(vx, vz));
      nadir = { x: Math.round((cam.x + vx * lead) / 4000) * 4000, z: Math.round((cam.z + vz * lead) / 4000) * 4000 };
    }
    const anc = SS.anchor({ name: 'ship', ref: body, pos, fwd: [-south[0], -south[1], -south[2]], up, fov: cam.fov || 1.2, nadir, body }, eph);
    const tier = SS.tier(g);
    if ((SF.needT = (SF.needT || 0) - 1) <= 0) { SF.needT = 15; SS.needs(g, anc, tier); }
    SF.S.anc = anc;
    const fr = SS.frameSetup(SF.S, eph, { H: r.H, tier, bloom: !!(r.q.bloom && r.hdr), patch: SS.state.patch });
    if (VR.PlanetLODGL && fr.bodies.herz && r.gl) VR.PlanetLODGL.update(g, r.gl, fr.bodies.herz.camB, tier);   // u-orbitlod: the planet tiles asked for every frame the scene is set up
    // the nadir in Herzwelt's body frame (BodyTex: x the prime meridian, y the pole, z = x × y) for the impostor's cut
    const n = S.chart('herz').toSphere(cam.x, cam.z, v3());
    fr.nadirB = [n[0], n[2], -n[1]];
    return fr;
  };

  // ---------------------------------------------------------------- drawing the scene's layers (the climb, the space frame)
  // L: { bg, bodies, herz: [colour share, alpha share, exposure gain, additive] | null, cut: [sin a0, sin a1, on] | null,
  //      strict: skip a draw whose texture is not there yet }
  let blankT = null;
  function prog(name) {
    const ST = SSm().state; if (ST.progs[name] !== undefined) return ST.progs[name];
    const src = VR.SpaceShaders.programs()[name];
    try { ST.progs[name] = VR.GL.program(src.vs, src.fs, 'space.' + name, []); } catch (e) { console.error('space shader ' + name + ' failed: ' + (e && e.message)); ST.progs[name] = null; }
    return ST.progs[name];
  }
  SF.prog = prog;
  function setU(gl, p, k, v) {
    const loc = p.u[k]; if (loc === undefined || loc === null) return;
    if (typeof v === 'number') gl.uniform1f(loc, v);
    else if (v.length === 2) gl.uniform2f(loc, v[0], v[1]);
    else if (v.length === 3) gl.uniform3f(loc, v[0], v[1], v[2]);
    else if (v.length === 4) gl.uniform4f(loc, v[0], v[1], v[2], v[3]);
    else if (v.length === 9) gl.uniformMatrix3fv(loc, false, v);
    else if (v.length === 16) gl.uniformMatrix4fv(loc, false, v);
  }
  SF.drawLayers = function (r, fr, L) {
    const gl = r.gl, ST = SSm().state, map = SSm().texMap || {};
    if (!blankT) blankT = VR.GL.tex2D(1, 1, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, { data: new Uint8Array([60, 70, 80, 255]) });
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(r.emptyVAO);
    let n = 0;
    for (const d of fr.draws) {
      const lay = d.prog === 'bg' ? L.bg : d.prog === 'herz' ? L.herz : L.bodies;
      if (!lay || !(lay[0] > 0.001 || lay[1] > 0.001)) continue;
      if (L.strict) { let miss = false; for (const k in d.tex) if (!ST.tex[map[d.tex[k]]]) miss = true; if (miss) continue; }
      const p = prog(VR.SpaceShaders.progFor(d)); if (!p) continue;
      const tn = d.prog === 'herz' && VR.PlanetLODGL ? VR.PlanetLODGL.draw(r, d, fr.bodies.herz, lay, L.tcut || null, map, (k) => ST.tex[k] || blankT) : 0;   // u-orbitlod: the planet tiles first, the impostor at the far plane behind them
      gl.useProgram(p.p);
      if (d.prog === 'bg' && !lay[3]) gl.disable(gl.BLEND);
      else { gl.enable(gl.BLEND); if (d.add || lay[3]) gl.blendFunc(gl.ONE, gl.ONE); else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); }
      setU(gl, p, 'u_viewProj', r.viewProj); setU(gl, p, 'u_invViewProj', r.invViewProj);
      for (const k in d.u) setU(gl, p, k, d.u[k]);
      setU(gl, p, 'u_fadeOut', [1 - lay[0], 1 - lay[1], Math.log2(Math.max(1e-6, lay[2] || 1)), 0]);
      if (d.prog === 'herz') { setU(gl, p, 'u_cut', L.cut || [0, 0, 0, 0]); setU(gl, p, 'u_nadirB', fr.nadirB || [0, 1, 0]); }
      let unit = 0;
      for (const k in d.tex) { if (!p.u[k]) continue; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, ST.tex[map[d.tex[k]]] || blankT); gl.uniform1i(p.u[k], unit); unit++; }
      if (tn) VR.PlanetLODGL.before(gl, p, tn, setU);   // u-orbitlod
      gl.drawArrays(gl.TRIANGLES, 0, d.full ? 3 : 6);
      if (tn) VR.PlanetLODGL.after(gl, p, tn, setU);   // u-orbitlod
      r.stats.draws++; r.stats.tris += d.full ? 1 : 2; n++;
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.disable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
    return n;
  };
  // the cut where the horizon tiles end (their radius in metres, the share of it the tiles keep; 0: no cut)
  SF.cutFor = (hzR) => { const R = A.R(); return hzR > 0 ? [Math.sin(0.3 * hzR / R), Math.sin(0.45 * hzR / R), 1, 0] : null; };   // (u-orbitlod: whole before the tiles' soft band begins, 0.45–0.95)

  // the climb's layers (renderer.js, right after its sky pass → VR.Ascent.drawSky): Herzwelt beyond the tiles from 400 m,
  // space's background behind the thinning air from 1,200 m (added: the air's light stays), the true bodies over the
  // postcard's from 2,150 m — each brought to the world's exposure (the space scene is made for its own)
  SF.climbLayers = function (g, r, E, cam) {
    const c = E.climb; if (!c) return 0;
    if (c.space) return SF.spaceLayers(g, r, E, cam);
    if (!(c.imp > 0.001 || c.bg > 0.001 || c.body > 0.001)) return 0;
    const fl = g.flight, a = fl && fl.asc;
    const fr = SF.cameraFrame(g, cam, c.t, a ? a.st : null, fl ? fl.b : null);
    const Gn = fr.look.exposure / Math.max(0.05, E.exposure || 1);
    return SF.drawLayers(r, fr, { bg: c.bg > 0.001 ? [c.bg, c.bg, Gn, 1] : null, bodies: c.body > 0.001 ? [c.body, c.body, Gn, 0] : null, herz: c.imp > 0.001 ? [c.imp, c.imp, Gn, 0] : null, cut: SF.cutFor(c.hzR), tcut: c.hzR > 0 ? [c.hzR * 0.3, c.hzR * 0.45] : null, strict: true });   // (u-orbitlod: tcut — the planet tiles whole under the horizon tiles' soft band)
  };
  // the space frame's layers: all of them whole; Herzwelt's cut only while the horizon tiles still fade out
  SF.spaceLayers = function (g, r, E, cam) {
    const fr = SF.cur; if (!fr) return 0;
    return SF.drawLayers(r, fr, { bg: [1, 1, 1, 0], bodies: [1, 1, 1, 0], herz: [1, 1, 1, 0], cut: E.climb.hzR > 0 ? SF.cutFor(E.climb.hzR) : null, tcut: E.climb.hzR > 0 ? [E.climb.hzR * 0.3, E.climb.hzR * 0.45] : null, strict: false });   // (u-orbitlod: tcut)
  };

  // ---------------------------------------------------------------- the space frame (the play frame while the ship is in space)
  // the ship's flight (controls, the space regime, sound, shake), the clock and the pool, the camera the ship's own; the
  // render without the voxel world: space's layers, then (the first seconds) the horizon tiles dissolving into Herzwelt's
  // impostor, the ship and its cockpit; the cockpit's screens and the HUD. The voxel world waits; after 60 s its chunks
  // are let go (saved first where changed) — the horizon tiles stay for the way back
  const ES2 = {};
  SF.inSpace = (g) => { const fl = g && g.flight; return !!(fl && fl.asc && (fl.regime === 'space' || fl.asc.jump)); };
  SF.frame = function (g, dt) {
    const fl = g.flight, a = A.ascOf(fl), st = a.st, r = g.renderer, p = g.player, input = g.input, ui = g.ui, b = fl.b;
    g.time += dt;
    g.handleKeys();
    const gad = g.gadgets;
    if (gad && gad.controlling) gad.drive(dt, input, ui.blocking);
    if (!SF.inSpace(g)) return;   // (back in the climb this very frame: the next frame is the play frame)
    if (!a.spaceT0) a.spaceT0 = performance.now();
    const since = (performance.now() - a.spaceT0) / 1000;
    const eye = p.eyePos ? p.eyePos() : [b.pos[0], b.pos[1] + 2, b.pos[2]];
    const Ew = g.envFor(eye, dt, { freezeTime: g.zenFreezeTime, freezeWeather: g.zenFreezeWeather });
    if (g.pool && g.pool.pump) g.pool.pump();
    if (g.starships) g.starships.update(dt);
    if (g.particles) g.particles.update(dt, eye);
    if (g.trails) g.trails.update(dt);
    if (VR.Entry && VR.Entry.tick) VR.Entry.tick(g, fl, dt);
    A.drawAttitude(fl);
    let cam = { x: eye[0], y: eye[1], z: eye[2], yaw: p.yaw, pitch: p.pitch, roll: 0, fov: (g.settings.fov || 75) * Math.PI / 180, far: 12000 };
    if (g.vehicleCam) { const vc = g.vehicleCam(cam); if (vc) cam = vc; }
    cam.far = Math.max(cam.far || 0, 12000);
    g.cam = cam;
    const t = st.t;
    const fr = SF.cur = SF.cameraFrame(g, cam, t, st, b);
    // the env: space's (u-space0's look), the sun the scene's, the ship lit as in the last of the climb
    const SE = SSm().env;
    Object.assign(ES2, SE);
    ES2.fog = [1e7, 2e7, 0, 0]; ES2.fogColor = [0, 0, 0];
    ES2.sunDir = fr.sunS; ES2.moonDir = [-fr.sunS[0], -fr.sunS[1], -fr.sunS[2]];
    ES2.exposure = fr.look.exposure; ES2.time = g.env.anim || g.time;
    ES2.bloomStrength = 0.06; ES2.bloomThreshold = 1.4;
    const k = 2.2 / Math.max(0.5, ES2.exposure) * (fr.sunVis === undefined ? 1 : 0.3 + 0.7 * fr.sunVis);
    ES2.sunColor = [k, k, k * 1.02];
    const pk = 0.04 * fr.look.dayK / Math.max(0.5, ES2.exposure);
    ES2.ambSky = [pk * 0.7, pk * 0.85, pk * 1.2];   // (Herzwelt's light from below)
    // the horizon tiles of the hand-off fade out over the first five seconds (their cut shrinks from the edge in)
    const hz = g.horizon, onHerz = st.frame === 'herz', tilesK = onHerz && hz && hz.enabled() && !a.jump ? 1 - ss(1.5, 5, since) : 0;
    const hzR = tilesK > 0.01 ? (A.view.hzR || 0) * tilesK : 0;
    ES2.climb = { space: true, y: A.mapY(st), curve: hzR > 0 && A.view.curve !== false ? 0.5 / A.R() : 0, cut0: hzR * 0.45, cut1: hzR * 0.95, hzR, t };   // (u-orbitlod: the wide soft band)
    ES2.bodies = null;
    if (hzR > 0) hz.update(cam);
    r.render({ cam, world: null, env: ES2, noSky: true, horizon: hzR > 0 ? hz : null, particles: g.particles,
      drawOpaque: (r2, E2) => { if (g.starships) g.starships.draw(r2, E2, 'opaque'); },
      drawTranslucent: (r2, E2) => { if (g.starships) g.starships.draw(r2, E2, 'trans'); if (g.trails) g.trails.draw(r2, E2); } });
    if (g.cockpit) g.cockpit.updateHud(dt);
    if (g.audio && g.audio.listen) g.audio.listen(eye, p.yaw, null, false);
    if (g.audio && g.audio.updateMusic) g.audio.updateMusic(dt, { night: 1, cave: false, danger: false, space: true, festival: false, enabled: true, day: g.env.day, mobs: null, agents: null });
    ui.updateHUD();
    if (g.settings.showFps) ui.fps(T('g.hud.fps', { n: Math.round(g.fps || 0) }));
    SF.fx(g, fl);
    // the voxel world let go after a minute up here (the take-off's columns; the way back streams what it needs)
    const w = g.world;
    if (w && !a.freed && since > 60) { a.freed = true; for (const c of [...w.cols.values()]) w.unloadColumn(c); }
    void Ew;
  };
  // the play frame: the space frame while the ship is up there (a /raum view keeps its own wrapper, spacescene.js)
  const origPlay = Game.prototype.playFrame;
  Game.prototype.playFrame = function (dt) {
    if (VR.Ascent && !VR.Ascent.game) VR.Ascent.game = this;   // (a ship put straight into orbit never ran the climb's frame: space drew black — a-story's finding)
    if (!this.space && SF.inSpace(this)) return SF.frame(this, dt);
    if (this.flight && this.flight.asc && VR.Ascent.frame) VR.Ascent.frame(this, dt);
    return origPlay.call(this, dt);
  };
  // Heimkehr (🏠, /home) in the sky: the six-second home jump (game.js goHome's first line)
  SF.goHome = function (g) {
    const fl = g && g.flight; if (!fl || !fl.regime || fl.regime === 'air') return false;
    if (A.ascOf(fl).jump) return true;
    SF.say(fl, 'g.asc.homeGo');
    SF.homeJump(fl);
    return true;
  };
  SF.onJump = function (fl, what, j) {
    const g = fl.g; if (!g) return;
    if (what === 'start') { if (g.audio && g.audio.play) g.audio.play('boost'); if (g.ui && g.ui.chatLine) g.ui.chatLine(T(j.home ? 'g.asc.homeGo' : 'g.asc.jumpGo', { name: SF.nameOf(j.to) }), '#9affd8'); }
    if (what === 'end' && !j.home && SF.landable(j.to) && SF.onLandBody) { /* (u-moons1: Landen travels there; until then the orbit) */ }
  };
  // a moon with its own world (u-moons1 registers Opal and Basalt): Landen there is the trip with the ship (VR.Travel)
  SF.onLandBody = function (fl, body) {
    const g = fl.g, dim = SF.DIM_OF[body];
    if (!g || !VR.Travel || !VR.Travel.go || !dim) return false;
    const a = A.ascOf(fl);
    fl.regime = 'air'; fl.auto = null; a.jump = null;
    try { VR.Travel.go(g, dim); } catch (e) { console.warn(e); SF.hint(fl, 'g.asc.noLand', { name: SF.nameOf(body) }); }
    return true;
  };

  // ---------------------------------------------------------------- the screen's light: the plasma, the jump's flash
  // one 2D canvas over the game's (no shader changes, the same on Very Low): the entry's plasma — a white-yellow core where
  // the nose meets the air, a violet-blue sheath at its edge, orange wake streaks — and the jump's white-blue flash
  let fxC = null, fxX = null, fxOn = false;
  SF.fx = function (g, fl) {
    const a = fl && fl.asc, I = a && a.info;
    const glow = I ? A.glowFl(fl) : 0, j = a && a.jump, flash = j ? SF.jumpFlash(j.J, j.s) : 0;
    if (glow < 0.01 && flash < 0.01) { if (fxOn) { fxX.clearRect(0, 0, fxC.width, fxC.height); fxC.style.display = 'none'; fxOn = false; } return; }
    if (!fxC) {
      fxC = document.createElement('canvas'); fxC.id = 'ascFx';
      Object.assign(fxC.style, { position: 'fixed', left: '0', top: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '4' });
      document.body.appendChild(fxC); fxX = fxC.getContext('2d');
    }
    const W = Math.max(320, Math.round(window.innerWidth / 2)), H = Math.max(180, Math.round(window.innerHeight / 2));
    if (fxC.width !== W || fxC.height !== H) { fxC.width = W; fxC.height = H; }
    fxC.style.display = 'block'; fxOn = true;
    const x = fxX; x.clearRect(0, 0, W, H);
    if (glow > 0.01) {
      // u-orbit2 (R52-09: no true entry glow): the shock layer as it hugs the ship — the stagnation point where the hull
      // meets the air (the velocity's side, else the nose), a white-yellow core there, the sheath an elongated envelope
      // of orange to rose drawn back along the flow, the wake's ribbons streaming from its rim and curling behind
      const r = g.renderer, b = fl.b, cam = r.cam || g.cam || {};
      let sx = W / 2, sy = H * 0.45, rad = Math.max(W, H) * 0.75, ang = Math.PI / 2;
      if (fl.view !== 0 && r.viewProj && cam.x !== undefined) {
        const vl = Math.hypot(b.vel[0], b.vel[1], b.vel[2]);
        const n = vl > 40 ? [b.vel[0] / vl, b.vel[1] / vl, b.vel[2] / vl] : fl.dirWorld([0, 0, -1]), Lb = (b.length || 12) * 0.55, m = r.viewProj;
        const scr = (wx, wy, wz) => { const px = wx - cam.x, py = wy - cam.y, pz = wz - cam.z, cw = m[3] * px + m[7] * py + m[11] * pz + m[15]; return cw > 0.1 ? [((m[0] * px + m[4] * py + m[8] * pz + m[12]) / cw * 0.5 + 0.5) * W, (0.5 - (m[1] * px + m[5] * py + m[9] * pz + m[13]) / cw * 0.5) * H] : null; };
        const cy0 = b.pos[1] + (b.height || 4) * 0.4, s0 = scr(b.pos[0] + n[0] * Lb, cy0 + n[1] * Lb, b.pos[2] + n[2] * Lb), s1 = scr(b.pos[0] - n[0] * Lb, cy0 - n[1] * Lb, b.pos[2] - n[2] * Lb);
        if (s0) { sx = s0[0]; sy = s0[1]; rad = Math.max(W, H) * 0.3; if (s1) { ang = Math.atan2(s1[1] - s0[1], s1[0] - s0[0]); rad = Math.max(rad * 0.6, Math.min(rad * 1.6, Math.hypot(s1[0] - s0[0], s1[1] - s0[1]) * 1.1)); } }
      }
      const t = performance.now() / 1000, fl1 = 0.85 + 0.15 * Math.sin(t * 37) * Math.sin(t * 13.1);
      x.globalCompositeOperation = 'lighter';
      // the sheath: a radial glow stretched back along the flow (the stagnation point at its front)
      x.save(); x.translate(sx, sy); x.rotate(ang); x.scale(1.9, 1);
      const sh = x.createRadialGradient(rad * 0.18, 0, 0, rad * 0.32, 0, rad * 0.62);
      sh.addColorStop(0, `rgba(255,236,190,${0.75 * glow * fl1})`);
      sh.addColorStop(0.25, `rgba(255,170,90,${0.5 * glow * fl1})`);
      sh.addColorStop(0.6, `rgba(255,96,120,${0.26 * glow})`);
      sh.addColorStop(1, 'rgba(140,60,200,0)');
      x.fillStyle = sh; x.fillRect(-rad * 0.6, -rad, rad * 2.2, rad * 2);
      x.restore();
      // the core at the stagnation point
      const co = x.createRadialGradient(sx, sy, 0, sx, sy, rad * 0.16);
      co.addColorStop(0, `rgba(255,252,236,${0.9 * glow * fl1})`); co.addColorStop(1, 'rgba(255,200,140,0)');
      x.fillStyle = co; x.fillRect(sx - rad * 0.2, sy - rad * 0.2, rad * 0.4, rad * 0.4);
      // the wake: ribbons from the sheath's rim, bending back along the flow and fading
      const ca = Math.cos(ang), sa = Math.sin(ang);
      x.lineCap = 'round';
      for (let i = 0; i < 20; i++) {
        const side = i % 2 ? 1 : -1, u = ((i * 0.618) % 1), off = (0.1 + 0.26 * u) * rad * side, ph = t * 2.3 + i * 1.7;
        const L = rad * (0.45 + 0.6 * (((i * 0.37) + t * 0.9) % 1)), wob = Math.sin(ph) * rad * 0.04;
        const p0x = sx + ca * rad * 0.1 - sa * off, p0y = sy + sa * rad * 0.1 + ca * off;
        const p1x = p0x + ca * L * 0.5 - sa * (off * 0.5 + wob), p1y = p0y + sa * L * 0.5 + ca * (off * 0.5 + wob);
        const p2x = p0x + ca * L - sa * (off * 0.2 - wob), p2y = p0y + sa * L + ca * (off * 0.2 - wob);
        x.strokeStyle = `rgba(255,${120 + (i % 5) * 22},${60 + (i % 3) * 20},${(0.1 + 0.14 * (1 - u)) * glow})`; x.lineWidth = 0.8 + (i % 3) * 0.6;
        x.beginPath(); x.moveTo(p0x, p0y); x.quadraticCurveTo(p1x, p1y, p2x, p2y); x.stroke();
      }
      x.globalCompositeOperation = 'source-over';
    }
    if (flash > 0.01) { x.fillStyle = `rgba(225,238,255,${Math.min(1, flash)})`; x.fillRect(0, 0, W, H); }
  };

  // ---------------------------------------------------------------- the nav tile in the climb and in space (cockpit.js)
  // the planet as a disc, the orbit in its own plane seen from above it (its normal toward the viewer), Ap / Pe / the
  // period, the patched conic dashed; the ship a marker. Every half second (the ghost path is a few hundred Kepler solves)
  const nav = { t: 0, g: null, ok: false };
  SF.navTile = function (x, I, b, g, fl, TW, TH) {
    if (!fl || !fl.regime || fl.regime === 'air' || !fl.asc) return false;
    const a = fl.asc, st = a.st, now = performance.now();
    if (now - nav.t > 500) { nav.t = now; try { nav.g = SF.ghost(st, nav.g); nav.ok = true; } catch (e) { nav.ok = false; } }
    const B = UNI().home.body(st.frame) || { R: 1 };
    x.fillStyle = '#06101a'; x.fillRect(0, 0, TW, TH);
    const cx = TW / 2, cy = TH / 2 + 4;
    // the orbit's plane: x along the ship's place, y along its way (the normal toward us)
    const r = st.r, h = cross(r, st.v, v3()); unit(h, h);
    const ex = unit(r, v3()), ey = cross(h, ex, v3());
    let maxR = B.R * 1.05;
    const pts = nav.ok && nav.g ? nav.g.pts : null;
    if (pts) for (let i = 0; i < pts.length; i += 3) maxR = Math.max(maxR, Math.hypot(pts[i], pts[i + 1], pts[i + 2]));
    const k = (Math.min(TW, TH) * 0.42) / maxR;
    x.fillStyle = st.frame === 'herz' ? '#1d4f6e' : '#5a4a3a';
    x.beginPath(); x.arc(cx, cy, B.R * k, 0, 6.2832); x.fill();
    x.strokeStyle = 'rgba(160,220,255,0.5)'; x.lineWidth = 1; x.stroke();
    if (pts) {
      x.strokeStyle = '#9affd8'; x.lineWidth = 1.4; x.beginPath();
      for (let i = 0; i < pts.length; i += 3) { const px = pts[i] * ex[0] + pts[i + 1] * ex[1] + pts[i + 2] * ex[2], py = pts[i] * ey[0] + pts[i + 1] * ey[1] + pts[i + 2] * ey[2]; if (i) x.lineTo(cx + px * k, cy - py * k); else x.moveTo(cx + px * k, cy - py * k); }
      if (nav.g.closed) x.closePath();
      x.stroke();
      const pt = nav.g.patch;
      if (pt && pt.pts) {
        x.setLineDash([3, 3]); x.strokeStyle = '#ffd88a'; x.beginPath();
        const an = pt.anchor;
        for (let i = 0; i < pt.pts.length; i += 3) { const qx = pt.pts[i] + an[0], qy = pt.pts[i + 1] + an[1], qz = pt.pts[i + 2] + an[2]; const px = qx * ex[0] + qy * ex[1] + qz * ex[2], py = qx * ey[0] + qy * ey[1] + qz * ey[2]; if (i) x.lineTo(cx + px * k, cy - py * k); else x.moveTo(cx + px * k, cy - py * k); }
        x.stroke(); x.setLineDash([]);
      }
    }
    // the ship
    x.fillStyle = '#ffffff'; x.beginPath(); x.arc(cx + len(r) * k, cy, 2.6, 0, 6.2832); x.fill();
    x.font = 'bold 9px monospace'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#9affd8';
    const o = A.orbitOf(st), base = st.frame === 'herz' ? A.DATUM : 0;
    if (o.e < 1) x.fillText(T('g.asc.nav.orbit', { ap: Math.round(o.apo - base), pe: Math.round(o.peri - base), min: (o.period / 60).toFixed(1) }), cx, 8);
    else x.fillText(T('g.asc.nav.escape'), cx, 8);
    x.font = '8px monospace'; x.fillStyle = '#9ad8ff';
    x.fillText(SF.nameOf(st.frame) + ' · ' + Math.round(I.speed) + ' m/s', cx, TH - 6);
    return true;
  };

  // ---------------------------------------------------------------- the debug and test hooks (test/ascent.mjs)
  SF.debug = {
    // the ship in a circular orbit over a map point (x, z) at height y (map)
    orbit(g, x, z, y) { const fl = g.flight; if (!fl) return false; A.orbitAt(fl, [x, y || SF.ORBIT, z]); return true; },
    // the ship in the climb at height y over its place, at rest (the hover hold keeps it), the nose pitched `pitch` degrees
    climb(g, y, pitch, heading) {
      const fl = g.flight; if (!fl) return false; const b = fl.b;
      if (!fl.running) { fl.power = 'running'; fl.startT = 3; }
      fl.state = 'flying'; fl.throttle = 0; fl.auto = null;
      if (heading !== undefined) b.heading = heading;
      A.enterClimb(fl, [b.pos[0], y, b.pos[2]], [0, 0, 0]);
      fl.pitch = (pitch || 0) * Math.PI / 180; b.setAttitude(fl.pitch, 0); fl.orient();
      return true;
    },
    state(g) { const fl = g.flight; if (!fl || !fl.asc) return { regime: fl ? fl.regime || 'air' : null }; const a = fl.asc, o = A.orbitOf(a.st); return { regime: fl.regime || 'air', frame: a.st.frame, y: +A.mapY(a.st).toFixed(1), speed: +a.info.speed.toFixed(1), q: a.info.q, glow: A.glowFl(fl), qRef: fl.auto && fl.auto.qRef || null, ap: o.apo, pe: o.peri, e: o.e, period: o.period, auto: fl.auto ? fl.auto.space || 'village' : null, phase: fl.auto ? fl.auto.phase || null : null, jump: !!a.jump, pos: fl.b.pos.slice(), t: a.st.t }; },
  };
})(VR);
