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
  SF.nameOf = (id) => { const b = UNI().home.body(id); if (!b) return id; const en = VR.I18N && VR.I18N.lang && VR.I18N.lang() === 'en'; return en ? b.name.en : b.name.de; };
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

  // ================================================================ the game's glue (a page with the game)
  if (typeof window === 'undefined' || !VR.Game) return;
  SF.page = true;
})(VR);
