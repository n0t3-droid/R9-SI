// ============================================================================
// u-fields2 · VR.Fields2 — fly into the fields yourself, asteroid to asteroid (plan
// docs/superpowers/plans/2026-10-30-u-fields2.md; u-fields' self-review).
//   · the Reiseantrieb's new targets: Amarant's ring (G with the view on the annulus: the cruise to the giant, then an
//     8-s entry down into the 10-m sheet at 1.70 R, 25 m/s faster than the co-orbit — the chunks stream past), the
//     Trümmerschwarm (G toward it: the cruise ends 2.5 km off its centre, at rest there), the cloud tops (V in orbit
//     round Amarant: 8 s down to 15 km over the tops; below 1 km the autopilot pulls up)
//   · in the swarm: V lands on the rubble body looked at (else the nearest) — 4 s on to it, then the trip by ship; on a
//     rubble body G on a neighbour seen in the sky hops there
//   · the neighbours in a rubble body's sky: the five biggest-looking, through the body sky's five discs, flagged rubble
//     (Bc.w < 0: space_shaders.js bends the disc into an irregular polygon)
//   · the miners' reward: nickel_iron, ice_nodule, glowspar (fields_blocks.js, gen_rubble.js rgen 2) sell at the Hangar
//     (and the Werkstatt: VR.Adv.SELL); the codex milestone `spar`
// Pure part (node: test/fields2.js) above the line; the game's glue below it.
// ============================================================================
(function (VR) {
  'use strict';
  const F2 = VR.Fields2 = {};
  const UNI = () => VR.Universe;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const v3 = () => new Float64Array(3);
  const len = (a) => Math.hypot(a[0], a[1], a[2]);
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const unit = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const sstep = (x) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };

  F2.RING_R = 1.70;            // the entry's radius in Amarant's radii (the B ring, τ > 1)
  F2.RING_DV = 25;             // m/s faster than the co-orbit: the chunks stream past
  F2.ENTRY_S = 8;              // s: the ring's and the cloud tops' entry
  F2.CLOUD_H = 15000;          // m over the tops (fields.js FLY_H)
  F2.FLOOR = 1000;             // m: below it the autopilot pulls up (fields.js FLOOR)
  F2.PULL_V = 60;              // m/s: the climb the pull-up holds at least
  F2.SWARM_R = 2500;           // m off the swarm's centre: the cruise's end
  F2.LAND_S = 4;               // s: on to the rubble body chosen
  F2.SELL = { nickel_iron: 10, ice_nodule: 6, glowspar: 25 };
  F2.ORES = Object.keys(F2.SELL);
  F2.KEYS = ['g.fields2.ring', 'g.fields2.ringIn', 'g.fields2.clouds', 'g.fields2.cloudsIn', 'g.fields2.swarmIn', 'g.fields2.land', 'g.fields2.noRock',
    'g.fields2.hop', 'g.fields2.hopFar', 'g.codex.m.spar'];
  if (VR.Adv && VR.Adv.SELL) Object.assign(VR.Adv.SELL, F2.SELL);

  // ---------------------------------------------------------------- Amarant: its frame, the ring, the cloud tops
  const amarant = () => UNI().home.body('amarant');
  F2.axis = () => { const A = amarant(); return A.axis || (A.spin && A.spin.axis) || [0, 0, 1]; };
  // the local radius of the cloud tops under the direction of rel (the oblate giant: f 0.098)
  F2.topR = (rel) => { const A = amarant(), n = F2.axis(), s = dot(unit(rel), n), c2 = 1 - s * s, a = A.R, b = A.Rp || A.R * (1 - (A.f || 0)); return a * b / Math.sqrt(b * b * c2 + a * a * s * s); };
  F2.cloudAlt = (rel) => len(rel) - F2.topR(rel);
  // the view's ray from P along dir (system frame) on the ring's annulus before the disc: {rR, s} or null
  F2.ringHit = (st, P, dir) => {
    const A = amarant(), q = st.b.amarant.r, n = F2.axis();
    const rel = [q[0] - P[0], q[1] - P[1], q[2] - P[2]], dn = dot(dir, n);
    if (Math.abs(dn) < 1e-9) return null;
    const s = dot(rel, n) / dn; if (s <= 0) return null;
    const h = [P[0] + dir[0] * s - q[0], P[1] + dir[1] * s - q[1], P[2] + dir[2] * s - q[2]], rR = len(h) / A.R;
    if (rR < 1.24 || rR > 2.27) return null;
    const sc = dot(rel, dir), dc = Math.sqrt(Math.max(0, dot(rel, rel) - sc * sc));
    if (dc < A.R && sc > 0 && sc - Math.sqrt(A.R * A.R - dc * dc) < s) return null;   // (the disc first)
    return { rR, s };
  };
  // the entry: from the cruise's end (or an orbit round Amarant) down into the ring's sheet or to 15 km over the tops,
  // co-rotating with the orbit's way. c: a cruise ({P, V, t}); kind 'ring' | 'clouds'
  F2.entryStart = (c, kind) => {
    const S = UNI().home, A = amarant(), q = S.pos('amarant', c.t, v3()), qv = S.state(c.t).b.amarant.v;
    const rel = [c.P[0] - q[0], c.P[1] - q[1], c.P[2] - q[2]];
    let n, e1, rho0, h0, rT;
    if (kind === 'ring') {
      n = F2.axis(); h0 = dot(rel, n);
      const ip = [rel[0] - n[0] * h0, rel[1] - n[1] * h0, rel[2] - n[2] * h0]; rho0 = len(ip); e1 = unit(ip); rT = F2.RING_R * A.R;
      // (the way round: the orbit's sense, prograde with the ring)
    } else {
      // the orbit's own plane (r × v), the radius falling to the tops + 15 km under a latitude kept within ±35°
      const vr = qv ? [c.V[0] - qv[0], c.V[1] - qv[1], c.V[2] - qv[2]] : [0, 0, 0];
      n = unit(cross(rel, vr)); if (!(len(cross(rel, vr)) > 1e-6)) n = F2.axis();
      if (dot(n, F2.axis()) < 0) n = n.map(x => -x);
      h0 = 0; rho0 = len(rel); e1 = unit(rel); rT = F2.topR(rel) + F2.CLOUD_H;
    }
    c.entry = { kind, n, e1, e2: cross(n, e1), rho0, h0, rT, th: 0, s: 0, q0: Array.from(q), thX: 0, k: 0 };
    if (kind === 'clouds') {
      // the day side: the way swung so the pass ends 65° past the subsolar point, Helia low behind (the heads lit toward the
      // eye, their shadows long ahead) — the extra angle spread over the entry
      const E = c.entry, hs = S.state(c.t).b.helia.r, sd = unit([hs[0] - q[0], hs[1] - q[1], hs[2] - q[2]]);
      const ths = Math.atan2(dot(sd, E.e2), dot(sd, E.e1)) + 130 * Math.PI / 180, rm = (rho0 + rT) / 2, thN = Math.sqrt(A.mu / (rm * rm * rm)) * F2.ENTRY_S;
      let x = ths - 65 * Math.PI / 180 - thN; x = ((x % TAU) + TAU + Math.PI) % TAU - Math.PI; E.thX = x;
    }
    c.phase = 'entry'; c.s = 0;
    return c.entry;
  };
  const _q = v3(), _qv = v3();
  F2.entryRel = (E, u) => {
    const k = sstep(u), rho = E.rho0 + (E.rT - E.rho0) * k, h = E.h0 * (1 - k), ca = Math.cos(E.th), sa = Math.sin(E.th);
    return [(E.e1[0] * ca + E.e2[0] * sa) * rho + E.n[0] * h, (E.e1[1] * ca + E.e2[1] * sa) * rho + E.n[1] * h, (E.e1[2] * ca + E.e2[2] * sa) * rho + E.n[2] * h];
  };
  F2.entryStep = (c, h) => {
    const E = c.entry, S = UNI().home, A = amarant();
    c.t += h; c.total = (c.total || 0) + h; E.s += h; if (c.times) c.times.entry = (c.times.entry || 0) + h;
    const u = Math.min(1, E.s / F2.ENTRY_S), k = sstep(u), rho = E.rho0 + (E.rT - E.rho0) * k;
    const vc = Math.sqrt(A.mu / rho), dv = E.kind === 'ring' ? F2.RING_DV * k : 0;
    E.th += (vc + dv) / rho * h + E.thX * (k - E.k); E.k = k;
    const rel = F2.entryRel(E, u), q = S.pos('amarant', c.t, _q);
    const Pn = [q[0] + rel[0], q[1] + rel[1], q[2] + rel[2]];
    for (let i = 0; i < 3; i++) { c.V[i] = (Pn[i] - c.P[i]) / h; c.P[i] = Pn[i]; }
    if (c.nose) { const qv = S.state(c.t).b.amarant.v, w = unit([c.V[0] - qv[0], c.V[1] - qv[1], c.V[2] - qv[2]]); c.nose[0] = w[0]; c.nose[1] = w[1]; c.nose[2] = w[2]; }
    c.dist = Math.abs(rho - E.rT) + Math.abs(E.h0 * (1 - k)); c.eta = Math.max(0, F2.ENTRY_S - E.s); c.speed = vc + dv;
    if (u >= 1) {
      const er = unit(rel), et = cross(E.n, er), w = vc + (E.kind === 'ring' ? F2.RING_DV : 0);
      c.end = { frame: 'amarant', r: Float64Array.from(rel), v: Float64Array.from([et[0] * w, et[1] * w, et[2] * w]), t: c.t, goal: E.kind };
      c.phase = 'done';
    }
    return c;
  };
  // the pull-up over the cloud tops: the radial speed the autopilot holds below the floor (null: the pilot's own)
  F2.pull = (alt, vr) => (alt < F2.FLOOR && vr < F2.PULL_V ? F2.PULL_V + (F2.FLOOR - alt) * 0.05 : null);

  // ---------------------------------------------------------------- the swarm
  const swarmB = () => VR.Rubble.swarm().bodies;
  // a body of the swarm in the system frame (its offset is kept in the space scene's axes: universe = (s.z, s.x, s.y))
  F2.rockOff = (k) => { const p = swarmB()[k].p; return [p[2], p[0], p[1]]; };
  F2.rockPos = (k, t, out) => { const c = UNI().home.pos('swarm', t, out || v3()), o = F2.rockOff(k); c[0] += o[0]; c[1] += o[1]; c[2] += o[2]; return c; };
  // f-polish: the arrival near the swarm's biggest body, on its lit side (the cruise's end 2.5 km off the centre left the
  // rocks dots): rel the end off the centre, sun the direction to Helia (unit) → {k, r: the new end off the centre, look:
  // unit from there to the body, d: the distance to its centre}; the side half toward where we came from, all toward Helia
  F2.swarmEnd = (rel, sun) => {
    const B = swarmB(); let k = 0; for (let i = 1; i < B.length; i++) if (B[i].D > B[k].D) k = i;
    const o = F2.rockOff(k), rl = Math.hypot(rel[0], rel[1], rel[2]) || 1, d = B[k].D / 2 + 700;
    const s = unit([sun[0] + 0.5 * rel[0] / rl, sun[1] + 0.5 * rel[1] / rl, sun[2] + 0.5 * rel[2] / rl]);
    return { k, d, r: [o[0] + s[0] * d, o[1] + s[1] * d, o[2] + s[2] * d], look: [-s[0], -s[1], -s[2]] };
  };
  F2.inSwarm = (P, t, far) => { const c = UNI().home.pos('swarm', t, v3()); return Math.hypot(P[0] - c[0], P[1] - c[1], P[2] - c[2]) < (far || 40000); };
  // the body the view points at (its disc + 3°, else within 10° the nearest to the middle), else null; skip: a k
  F2.pickRock = (P, dir, t, skip) => {
    const B = swarmB(), q = v3(); let best = null, bs = Infinity;
    for (const b of B) {
      if (b.k === skip) continue;
      F2.rockPos(b.k, t, q);
      const d = [q[0] - P[0], q[1] - P[1], q[2] - P[2]], D = len(d), ang = Math.acos(clamp(dot(d, dir) / D, -1, 1)), rad = Math.asin(clamp(b.D / 2 / D, 0, 1));
      if (ang < rad + 3 * Math.PI / 180 || ang < 10 * Math.PI / 180) { const sc = ang / (rad + 0.02); if (sc < bs) { bs = sc; best = { k: b.k, ang, rad, D }; } }
    }
    return best;
  };
  F2.nearestRock = (P, t) => { const q = v3(); let best = null, bd = Infinity; for (const b of swarmB()) { F2.rockPos(b.k, t, q); const d = Math.hypot(q[0] - P[0], q[1] - P[1], q[2] - P[2]) - b.D / 2; if (d < bd) { bd = d; best = { k: b.k, D: d }; } } return best; };
  // the swarm's landing: 4 s on from P to a point beside the body (its radius + 150 m, on the side we come from)
  F2.landStart = (c, k) => {
    const q = F2.rockPos(k, c.t, v3()), b = swarmB()[k], d = unit([c.P[0] - q[0], c.P[1] - q[1], c.P[2] - q[2]]), off = b.D / 2 + 150;
    c.land = { k, s: 0, P0: Array.from(c.P), off: [d[0] * off, d[1] * off, d[2] * off] };
    c.kind = 'swarmland'; c.phase = 'swarmland'; c.near = { id: 'swarm', d: len([c.P[0] - q[0], c.P[1] - q[1], c.P[2] - q[2]]) };
    return c.land;
  };
  F2.landStep = (c, h) => {
    const L = c.land; c.t += h; L.s += h;
    const u = sstep(L.s / F2.LAND_S), q = F2.rockPos(L.k, c.t, v3());
    for (let i = 0; i < 3; i++) { const p = L.P0[i] + (q[i] + L.off[i] - L.P0[i]) * u; c.V[i] = (p - c.P[i]) / h; c.P[i] = p; }
    c.near.d = Math.hypot(c.P[0] - q[0], c.P[1] - q[1], c.P[2] - q[2]) - swarmB()[L.k].D / 2;
    return L.s >= F2.LAND_S;
  };
  // the neighbours in a rubble body's sky: the body's frame (its axis up, turned by its spin angle H) — the five that look
  // biggest above the horizon: {k, dir (the world's x, y, z: y up), rad, metal}
  F2.frameOf = (k, H) => {
    const b = swarmB()[k], up = unit(b.axis), a = Math.abs(up[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const x0 = unit(cross(a, up)), z0 = cross(x0, up), c = Math.cos(H), s = Math.sin(H);
    return { up, ex: [x0[0] * c + z0[0] * s, x0[1] * c + z0[1] * s, x0[2] * c + z0[2] * s], ez: [z0[0] * c - x0[0] * s, z0[1] * c - x0[1] * s, z0[2] * c - x0[2] * s] };
  };
  F2.neighbours = (k, H, max) => {
    const B = swarmB(), me = B[k], fr = F2.frameOf(k, H || 0), out = [];
    if (!me) return out;
    for (const b of B) {
      if (b.k === k) continue;
      const d = [b.p[0] - me.p[0], b.p[1] - me.p[1], b.p[2] - me.p[2]], D = len(d), u = [d[0] / D, d[1] / D, d[2] / D];
      const dir = [dot(u, fr.ex), dot(u, fr.up), dot(u, fr.ez)];
      if (dir[1] < 0.02) continue;
      out.push({ k: b.k, dir, rad: Math.asin(clamp(b.D / 2 / D, 0, 1)), metal: !!b.metal, D });
    }
    out.sort((a, b) => b.rad - a.rad);
    return out.slice(0, max || 5);
  };
  // G on a rubble body: the neighbour the view (world frame) points at — its disc + 2°, else null
  F2.lookNeighbour = (k, H, look) => {
    let best = null, bs = Infinity;
    for (const n of F2.neighbours(k, H, 5)) { const ang = Math.acos(clamp(dot(n.dir, look), -1, 1)); if (ang < n.rad + 2 * Math.PI / 180) { const sc = ang / (n.rad + 0.01); if (sc < bs) { bs = sc; best = n; } } }
    return best;
  };
  // a rubble body's spin angle at world seconds t (fields.js rockSky's)
  F2.spinH = (k, t) => { const b = k === 'm' ? VR.Rubble.MOONLET : swarmB()[k]; const P = Math.max(600, b.spinH * 3600 / 8); return TAU * t / P + (b.seed % 628) / 100; };

  // ---------------------------------------------------------------- the cruise learns the targets (node and page)
  const C = VR.Cruise;
  if (C && !C.__fields2) {
    C.__fields2 = true;
    if (C.TO.indexOf('swarm') < 0) C.TO.push('swarm');
    const pick0 = C.pick;
    C.pick = (st, P, dir, skip, ids) => {
      const p = pick0(st, P, dir, skip, ids);
      if (ids || !st.b.amarant) return p;
      // the ring before Amarant's disc (and before nothing nearer: a moon's disc in front wins)
      if (p && p.id !== 'amarant' && p.id !== 'swarm') return p;
      const r = F2.ringHit(st, P, dir);
      return r ? { id: 'ring', ang: 0, rad: 0, rR: r.rR } : p;
    };
    const create0 = C.create;
    C.create = (P, V, from, to, t, nose) => {
      const c = create0(P, V, from, to, t, nose);
      if (to === 'swarm') c.rArr = F2.SWARM_R;
      return c;
    };
    const step0 = C.step;
    C.step = (c, h) => {
      if (c.phase === 'entry') return F2.entryStep(c, h);
      const sk = C.SKIP.swarm; if (c.to === 'swarm') C.SKIP.swarm = 0;
      try { step0(c, h); } finally { C.SKIP.swarm = sk; }
      if (c.phase === 'done' && c.goal && !c.entry) F2.entryStart(c, c.goal);
      return c;
    };
  }

  // ================================================================ the game's glue (the page only)
  if (typeof window === 'undefined' || !VR.Game || !VR.Ascent || !VR.SpaceFlight || !C || !C.page) return;
  const A = VR.Ascent, SF = VR.SpaceFlight, AM = A.math, Fd = VR.Fields;
  const T = (k, v) => (VR.I18N ? VR.I18N.t(k, v) : k);
  const nameOf0 = SF.nameOf;
  SF.nameOf = (id) => (id === 'ring' ? T('g.fields2.ring') : /^rock\./.test(String(id)) && VR.Travel ? VR.Travel.dimName(id) : nameOf0(id));

  // C.start(fl, 'ring'): the cruise to Amarant with the entry after it (or the entry alone from Amarant's orbit)
  const start0 = C.start;
  C.start = (fl, to, quiet) => {
    if (to !== 'ring') {
      const ok = start0(fl, to, quiet);
      if (ok && to === 'swarm') SF.say(fl, 'g.fields2.swarmIn');
      return ok;
    }
    const a = A.ascOf(fl), st = a.st;
    if (fl.regime !== 'space' || a.jump || a.cruise) return false;
    if (st.frame !== 'amarant') {
      const ok = start0(fl, 'amarant', true);
      if (ok) { a.cruise.goal = 'ring'; SF.say(fl, 'g.fields2.ringIn', { s: Math.round((fl.auto && fl.auto.eta || 20) + F2.ENTRY_S) }); }
      return ok;
    }
    return local(fl, 'ring');
  };
  // an entry flown from an orbit round Amarant (the ring from there, the cloud tops by V)
  function local(fl, kind) {
    const g = fl.g, a = A.ascOf(fl), st = a.st, S = UNI().home;
    C.ensureScene(g);
    const pf = S.pos(st.frame, st.t, v3()), vf = S.state(st.t).b[st.frame].v;
    const P = [pf[0] + st.r[0], pf[1] + st.r[1], pf[2] + st.r[2]], V = [vf[0] + st.v[0], vf[1] + st.v[1], vf[2] + st.v[2]];
    const c = C.create(P, V, 'amarant', 'amarant', st.t, [-a.S[2], -a.S[5], -a.S[8]]);
    F2.entryStart(c, kind);
    a.cruise = c; c.local = true;
    C.tripM = null; C.blend = { a: 'amarant', b: 'amarant', s: 0, dur: 1e9 };
    st.frame = 'helia'; st.r.set(c.P); st.v.set(c.V); st.coast = false;
    fl.auto = { space: 'cruise', phase: 'entry', t: 0, to: kind, site: { id: 'space:entry:' + kind, name: SF.nameOf(kind === 'ring' ? 'ring' : 'amarant'), x: fl.b.pos[0], y: fl.b.pos[1], z: fl.b.pos[2] }, spot: null, dist: 0, eta: F2.ENTRY_S, landing: false };
    if (fl.state !== 'flying') { fl.state = 'flying'; fl.holdAlt = null; }
    SF.say(fl, kind === 'ring' ? 'g.fields2.ring' : 'g.fields2.clouds');
    if (g.audio && g.audio.play) g.audio.play('boost');
    fl.bump = Math.max(fl.bump || 0, 0.5);
    C.last = { from: 'amarant', to: kind, t0: performance.now(), est: F2.ENTRY_S, phases: null, total: 0 };
    return true;
  }
  F2.local = local;
  const stepFl0 = C.stepFl;
  C.stepFl = (fl, h) => {
    const a = A.ascOf(fl), c = a.cruise;
    if (c && c.kind === 'swarmland') return landFl(fl, a, c, h);
    if (c && c.phase === 'entry') {
      // the giant's own frame through the entry (the cameras turn into it in 2.5 s, then stay with it)
      const B = C.blend;
      if (!B || B.b !== 'amarant') C.blend = { a: 'ecl', b: 'amarant', s: 0, dur: 2.5 };
      else if (B.a !== 'amarant' && B.s >= B.dur - 0.05) C.blend = { a: 'amarant', b: 'amarant', s: 0, dur: 1e9 };
    }
    const r = stepFl0(fl, h);
    if (c && c.phase === 'entry' && C.last) C.last.phase = 'entry';
    return r;
  };
  const finish0 = C.finish;
  C.finish = (fl, a, c) => {
    // (the swarm has no frame of its own in the space scene: the end is kept in Helia's)
    const sw = c.end && c.end.frame === 'swarm';
    let se = null;
    if (sw) {
      const S = UNI().home, b = S.state(c.end.t).b.swarm;
      if (!(VR.Polish && VR.Polish.off && VR.Polish.off.swarm)) {   // f-polish: end by the biggest body's lit side
        const bl = Math.hypot(b.r[0], b.r[1], b.r[2]) || 1, old = [c.end.r[0], c.end.r[1], c.end.r[2]]; se = F2.swarmEnd(c.end.r, [-b.r[0] / bl, -b.r[1] / bl, -b.r[2] / bl]); se.old = old;
        for (let i = 0; i < 3; i++) c.end.r[i] = se.r[i];
        F2.stats = F2.stats || {}; F2.stats.swarmEnd = { k: se.k, d: Math.round(se.d), old: se.old };   // (old: u-fields2's end off the swarm's centre — the tests' before)
      }
      for (let i = 0; i < 3; i++) { c.end.r[i] += b.r[i]; c.end.v[i] += b.v[i]; } c.end.frame = 'helia';
    }
    finish0(fl, a, c);
    if (sw) {
      C.blend = null;
      if (se && a.st) { const up = unit(a.st.r); for (let i = 0; i < 3; i++) A.slew(a.S, se.look, up, Math.PI, Math.PI); AM.ortho(a.S); }   // (the nose on the body)
      SF.hint(fl, 'g.fields2.land', null, 5200); return;
    }
    const e = c.end || {};
    if (e.goal) {
      C.blend = null;
      // the ship level along the way, its up away from the giant
      const st = a.st, nz = unit(st.v), up = unit(st.r);
      for (let i = 0; i < 3; i++) A.slew(a.S, nz, up, Math.PI, Math.PI);
      AM.ortho(a.S);
      if (e.goal === 'ring') SF.hint(fl, 'g.fields.ring', { tau: (Fd ? Fd.tauAt(F2.RING_R) : 1).toFixed(1) }, 5200);
      else SF.hint(fl, 'g.fields2.cloudsIn', null, 5200);
      F2.pass = { goal: e.goal, t0: performance.now() };
    }
  };
  // G: the ring and the swarm by intent (the arm's two seconds as for a world)
  const toggle0 = SF.toggle;
  SF.toggle = (fl) => {
    const g = fl.g;
    if (g && F2.isRock(g.dim) && F2.hop(g, true)) return true;
    const r = fl.regime || 'air', a = fl.asc, A_ = fl.auto;
    if (r === 'space' && !(a && (a.jump || a.cruise)) && !A_) {
      const p = C.lookPick(g, fl);
      if (p && p.id === 'ring') {
        SF.start(fl, 'arm', { to: 'amarant', armT: 2, cruiseTo: 'ring', byIntent: true });
        SF.hint(fl, 'g.cr.arm', { name: SF.nameOf('ring') }, 2200); return true;
      }
    }
    return toggle0(fl);
  };
  // V: the cloud tops round Amarant; the rubble body looked at in the swarm
  const land0 = SF.land;
  SF.land = (fl) => {
    const r = fl.regime || 'air', a = A.ascOf(fl), st = a && a.st;
    if (r === 'space' && st && !a.cruise && !a.jump) {
      if (st.frame === 'amarant') { fl.auto = null; return local(fl, 'clouds'); }
      const S = UNI().home, pf = S.pos(st.frame, st.t, v3()), P = [pf[0] + st.r[0], pf[1] + st.r[1], pf[2] + st.r[2]];
      if (st.frame === 'swarm' || F2.inSwarm(P, st.t)) { fl.auto = null; return swarmLand(fl, P); }
    }
    return land0(fl);
  };
  // the camera's forward in the system frame (cruise.js lookPick's, in space)
  const _m9 = new Float64Array(9);
  F2.lookDir = (g, fl) => {
    const cam = g && g.cam, st = fl && fl.asc && fl.asc.st; if (!cam || !st) return null;
    const cp = Math.cos(cam.pitch || 0), f = [-Math.sin(cam.yaw) * cp, Math.sin(cam.pitch || 0), -Math.cos(cam.yaw) * cp], d = [0, 0, 0];
    A.localFrame(st, _m9); AM.mulv(_m9, f, d); return unit(d);
  };
  function swarmLand(fl, P) {
    const g = fl.g, a = A.ascOf(fl), st = a.st, S = UNI().home;
    const dir = F2.lookDir(g, fl), p = (dir && F2.pickRock(P, dir, st.t)) || F2.nearestRock(P, st.t);
    if (!p || !VR.Travel) { SF.hint(fl, 'g.fields2.noRock'); return true; }
    const dim = 'rock.' + p.k, why = VR.Travel.canGo(g, dim);
    if (why) { SF.hint(fl, why); return true; }
    C.ensureScene(g);
    const vf = S.state(st.t).b[st.frame].v;
    const c = C.create(P, [vf[0] + st.v[0], vf[1] + st.v[1], vf[2] + st.v[2]], 'swarm', 'swarm', st.t, [-a.S[2], -a.S[5], -a.S[8]]);
    F2.landStart(c, p.k); c.dim = dim; c.body = dim;
    a.cruise = c;
    st.frame = 'helia'; st.r.set(c.P); st.v.set(c.V); st.coast = false;
    fl.auto = { space: 'cruise', phase: 'descent', t: 0, to: dim, site: { id: 'space:rock:' + p.k, name: SF.nameOf(dim), x: fl.b.pos[0], y: fl.b.pos[1], z: fl.b.pos[2] }, spot: null, dist: c.near.d, eta: F2.LAND_S, landing: true };
    SF.say(fl, 'g.cr.descent', { name: SF.nameOf(dim) });
    if (g.audio && g.audio.play) g.audio.play('boost');
    return true;
  }
  F2.swarmLand = swarmLand;
  const _nd = [0, 0, 0];
  function landFl(fl, a, c, h) {
    const st = a.st, g = fl.g;
    if (c.phase === 'wait') { st.v.fill(0); return; }
    const end = F2.landStep(c, h);
    st.frame = 'helia'; st.r.set(c.P); st.v.set(c.V); st.t = c.t; st.coast = false;
    const q = F2.rockPos(c.land.k, c.t, v3()); _nd[0] = q[0] - c.P[0]; _nd[1] = q[1] - c.P[1]; _nd[2] = q[2] - c.P[2];
    A.slew(a.S, unit(_nd), [0, 0, 1], 1.6 * h, 1.2 * h); AM.ortho(a.S);
    a.cruiseThr = 2.2;
    if (fl.auto) { fl.auto.dist = c.near.d; fl.auto.eta = Math.max(0, F2.LAND_S - c.land.s); }
    if (!end) return;
    c.phase = 'wait'; a.cruiseThr = 0.3;
    C.landing = { dim: c.dim, body: c.dim, t0: performance.now() };
    let p0 = null;
    try { p0 = VR.Travel.go(g, { dim: c.dim, via: 'ship' }); } catch (e) { console.warn(e); }
    const back = () => { if (a.cruise !== c) return; a.cruise = null; a.cruiseThr = 0; fl.auto = null; st.v.fill(0); st.coast = true; SF.hint(fl, 'g.fields2.noRock'); };
    if (p0 && p0.then) p0.then((ok) => { if (!ok) back(); }, back); else if (!p0) back();
  }
  // the pull-up over the cloud tops (after every step of the space regime round Amarant)
  const after0 = A.afterStep;
  let pullSaid = 0;
  A.afterStep = (st) => {
    if (after0) after0(st);
    if (st.frame !== 'amarant') return;
    const alt = F2.cloudAlt(st.r); F2.alt = alt;
    const up = unit(st.r), vr = dot(st.v, up), want = F2.pull(alt, vr);
    if (want === null) return;
    for (let i = 0; i < 3; i++) st.v[i] += up[i] * (want - vr);
    if (UNI().verletInit) UNI().verletInit(st, amarant().mu);
    F2.pulls = (F2.pulls || 0) + 1;
    const g = VR.game, fl = g && g.flight, now = performance.now();
    if (fl && now - pullSaid > 4000) { pullSaid = now; SF.hint(fl, 'g.fields.pull', null, 3200); if (fl.bump !== undefined) fl.bump = Math.max(fl.bump || 0, 0.6); }
  };

  // ---------------------------------------------------------------- on a rubble body: the neighbours, the hop
  F2.isRock = (dim) => /^rock\.\d+$/.test(String(dim || ''));
  const rockK = (dim) => +String(dim).slice(5);
  const worldT = (g) => (VR.Universe && g && g.env ? VR.Universe.worldSeconds(g.env.day | 0, g.env.ticks) : 0);
  if (Fd && Fd.rockSky) {
    const rockSky0 = Fd.rockSky;
    Fd.rockSky = function (E, env, d) {
      const r = rockSky0.call(this, E, env, d);
      const S = E.bodySky;
      if (!S || !S.B || !F2.isRock(d.id)) return r;
      const k = rockK(d.id), t = VR.Universe ? VR.Universe.worldSeconds(env.day | 0, env.ticks) : 0, N = F2.neighbours(k, F2.spinH(k, t), VR.BodySky && VR.BodySky.tier === 0 ? 2 : 5);   // (Very Low: the two biggest)
      const SUN = VR.SpaceScene ? VR.SpaceScene.SUN : [0.95, 0.96, 1];
      S.B.fill(0); if (S.Bc) S.Bc.fill(0);
      F2.sky = N;
      for (let i = 0; i < N.length; i++) {
        const n = N[i], L = n.metal ? [0.22, 0.22, 0.24] : [0.13, 0.12, 0.11];   // (the eye adapted to the dark ground: a shade over their albedo)
        S.B.set([n.dir[0], n.dir[1], n.dir[2], n.rad], i * 4);
        if (S.Bc) S.Bc.set([L[0] * SUN[0], L[1] * SUN[1], L[2] * SUN[2], -(1 + (n.k % 17))], i * 4);   // (w < 0: a rubble body — the shader's angular outline, seeded)
      }
      return r;
    };
  }
  // G on a rubble body: the neighbour looked at → the hop there (by ship when piloting, else in the suit)
  F2.hop = (g, quiet) => {
    if (!g || !F2.isRock(g.dim) || !g.cam || !VR.Travel) return false;
    const k = rockK(g.dim), cp = Math.cos(g.cam.pitch || 0);
    const look = [-Math.sin(g.cam.yaw) * cp, Math.sin(g.cam.pitch || 0), -Math.cos(g.cam.yaw) * cp];
    const n = F2.lookNeighbour(k, F2.spinH(k, worldT(g)), look);
    if (!n) { if (!quiet && g.ui && g.ui.hint) g.ui.hint(T('g.fields2.hopFar'), 2600); return false; }
    const dim = 'rock.' + n.k, why = VR.Travel.canGo(g, dim);
    if (why) { if (g.ui && g.ui.hint) g.ui.hint(T(why), 2600); return true; }
    const ship = !!(g.starships && g.starships.pilot);
    if (g.ui && g.ui.hint) g.ui.hint(T('g.fields2.hop', { name: VR.Travel.dimName(dim), km: (n.D / 1000).toFixed(1) }), 3600);
    if (ship) C.landing = { dim, body: dim, t0: performance.now() };
    F2.lastHop = { from: g.dim, to: dim, ship, t: performance.now() };
    try { VR.Travel.go(g, { dim, via: ship ? 'ship' : 'cmd' }); } catch (e) { console.warn(e); }
    return true;
  };
  const G = VR.Game, play0 = G.prototype.playFrame;
  G.prototype.playFrame = function (dt) {
    // (G on foot on a rubble body; flying, SF.toggle's wrapper above takes it)
    if (this.dim && this.dim.charCodeAt(0) === 114 && !this.space && F2.isRock(this.dim)) {
      const i = this.input, ui = this.ui;
      if (i && ui && !ui.typing && !ui.screen && !(this.starships && this.starships.pilot) && i.hit && i.hit('KeyG')) F2.hop(this, false);
    }
    return play0.call(this, dt);
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
