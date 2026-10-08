// ============================================================================
// The Gate Temple's shuttle (TRAILER.md shots D and E: t1_10, t1_11, t3_03 the approach, t1_19 the hangar mouth,
// t1_13, t1_16, t1_17 over the pad): one shuttle flies a loop — low down the runway from the canyon, in through the
// portal, a flare over the Hangar Hall's pad, a few seconds on the pad with its thrusters burning and dust blowing, a lift
// and a turn on the spot, out through the portal and round over the canyon again. A runtime actor like the sky traffic:
// no block, no save, no collision, in every world whose Gate Temple stands (vgen ≥ 3). When a ship other than the
// hangar's own stands on the pad, it lands on the runway in front of the portal instead ('apron').
// Cost: Animierte Anzeigen (settings.anim) off — Very Low — or the player more than 120 blocks from the hangar mouth:
// nothing is built, moved or drawn, and the hangar's parked shuttle stays on its pad.
// HangarFlight.plan / .at are the pure path (test/t_temple.js); HangarFlight.Actor runs it in the game (hall.js owns it).
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

  // ---------------------------------------------------------------- the air loop: a centripetal Catmull-Rom spline
  // sampled into a polyline with times (the speed runs linearly between the key points' speeds)
  function airTrack() {
    const P = AIR, n = P.length, pts = [];
    const at = (i) => i < 0 ? P[0].map((v, k) => 2 * v - P[1][k]) : i >= n ? P[n - 1].map((v, k) => 2 * v - P[n - 2][k]) : P[i];
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
    // times along the polyline
    const time = [0];
    for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], ds = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); time.push(time[i - 1] + ds / ((a[3] + b[3]) * 0.5)); }
    return { pts, time, T: time[time.length - 1] };
  }
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

  // ---------------------------------------------------------------- in the game
  const wrapA = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
  HF.Actor = class {
    constructor(game) {
      this.g = game; this.t = 0; this.d = null; this.plan = null; this.variant = null;
      this.active = false; this.st = {}; this.tid = 'hf' + (Math.random() * 1e9 | 0);
      this.inst = { d: null, pos: [AX, 120, 300], yaw: 0, pitch: 0, roll: 0, gear: 0, scale: HF.SCALE };
      this.hidden = null;      // the hangar's parked shuttle while it is "out flying" (hall variant)
      this.seenT = 0; this.templeOK = false;
    }
    // the Gate Temple stands here: its portal veil fills the mouth's foot (any world whose Heartland was generated)
    templeHere() {
      const w = this.g.world, R = VR.R; if (!w || !R) return false;
      const b = w.getBlock(0, DECK, MOUTH), t = R.byName.portal_veil;
      return !!(b && t && R.T.type[b] === t.id);
    }
    want() {
      const g = this.g, pl = g.player;
      if (g.state !== 'play' || (g.dim && g.dim !== 'overworld') || !pl || !g.starships) return false;
      if (g.settings && g.settings.anim === false) return false;
      return Math.hypot(pl.pos[0] - AX, pl.pos[2] - MOUTH) < HF.RANGE;
    }
    // the hangar's own shuttle, parked on the pad and not flown by anyone
    homeShip() {
      const SS = this.g.starships; if (!SS) return null;
      for (const s of SS.ships) if (s.hangar && s !== SS.pilot && s.state === 'parked' && Math.abs(s.pos[0]) < 3 && Math.abs(s.pos[2] - PADZ) < 3 && Math.abs(s.pos[1] - DECK) < 2) return s;
      return null;
    }
    // another ship stands on the pad (an older world's pad ship, a player's ship): the shuttle lands on the apron
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
    // which way this loop ends: on the pad when it is free (the hangar's own parked shuttle is "out flying" meanwhile),
    // else on the runway in front of the mouth
    choose() {
      this.variant = this.padTaken(this.hidden || this.homeShip()) ? 'apron' : 'hall';
      this.plan = HF.plan(this.variant);
    }
    update(dt) {
      const g = this.g;
      if (!this.want()) { this.active = false; this.showHome(); return; }
      // the temple check is cheap but needs the mouth's chunk; look again every 2 s
      if ((this.seenT -= dt) <= 0) { this.seenT = 2; this.templeOK = this.templeHere(); }
      if (!this.templeOK) { this.active = false; this.showHome(); return; }
      const SS = g.starships;
      if (!this.d || !SS.designs.has(this.d.key)) { this.d = SS.design(HF.SEED, 'shuttle', HF.PALETTE); this.inst.d = this.d; }
      this.d.last = performance.now();
      let snap = !!this.snap; this.snap = false;
      if (!this.active) {
        // (re)starting: the shuttle is far out over the canyon, half way round its loop
        this.active = true; snap = true;
        this.choose(); this.t = this.plan.ground + this.plan.air.T * 0.45;
      }
      this.t += dt;
      // a new loop begins as the shuttle turns onto the runway: choose where it lands this time
      if (this.t >= this.plan.T) { this.t -= this.plan.T; this.choose(); }
      this.hideHome(this.variant === 'hall');
      const s = HF.at(this.plan, this.t, this.st), I = this.inst;
      // the angles follow the path softly (the flare and the bank targets step between the path's legs)
      const k = snap ? 1 : 1 - Math.exp(-dt * 5);
      I.pos[0] = s.pos[0]; I.pos[1] = s.pos[1]; I.pos[2] = s.pos[2]; I.gear = s.gear;
      I.yaw += wrapA(s.yaw - I.yaw) * k; I.pitch += (s.pitch - I.pitch) * k; I.roll += (s.roll - I.roll) * k;
      this.fx(s, dt);
    }
    // ship-local metres (the design's own) → world, through the scale and the angles
    toWorld(l) {
      const I = this.inst, S = HF.SCALE, cy = Math.cos(I.yaw), sy = Math.sin(I.yaw), cp = Math.cos(I.pitch), sp = Math.sin(I.pitch), cr = Math.cos(I.roll), sr = Math.sin(I.roll);
      // roll about z, then pitch about x, then yaw about y (starships.js rotOf: rotY · rotX · rotZ)
      let x = l[0] * S, y = l[1] * S, z = l[2] * S;
      let x1 = x * cr - y * sr, y1 = x * sr + y * cr, z1 = z;
      let y2 = y1 * cp - z1 * sp, z2 = y1 * sp + z1 * cp, x2 = x1;
      return [I.pos[0] + x2 * cy + z2 * sy, I.pos[1] + y2, I.pos[2] - x2 * sy + z2 * cy];
    }
    // thrusters (the engine plumes of the sky traffic), lift jets under the hull and dust off the deck while it is low
    fx(s, dt) {
      const g = this.g, m = this.d && this.d.meta, pl = g.player;
      if (!m || !pl) return;
      const near = Math.hypot(this.inst.pos[0] - pl.pos[0], this.inst.pos[2] - pl.pos[2]);
      if (near > 260) return;
      if (g.trails) for (let ei = 0; ei < m.exhaust.length; ei++) { const e = m.exhaust[ei]; g.trails.engine(this.tid + ei, this.toWorld([e[0], e[1], e[2] + 0.3]), s.speed, { thrust: s.thrust, size: e[3] * HF.SCALE * 1.25, col: s.phase === 'air' ? [0.45, 0.75, 1] : [1, 0.68, 0.32], minor: ei > 1, smokeLife: 4, minSmoke: 14 }); }
      if (!g.particles || near > 120) return;
      const low = s.pos[1] - DECK, P = g.particles;
      // lift jets: two hot cones under the hull while it hovers, settles and lifts
      if (s.phase !== 'air' && s.phase !== 'pad' && Math.random() < 0.8) for (const lx of [-3, 3]) for (const lz of [-3, 4]) {
        const w = this.toWorld([lx, 0.2, lz]);
        P.spawn(w[0] + (Math.random() - 0.5) * 0.4, w[1], w[2] + (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.6, -6 - Math.random() * 4, (Math.random() - 0.5) * 0.6, { life: 0.18 + Math.random() * 0.12, size: 0.35 + Math.random() * 0.25, grav: 0, col: [1, 0.72, 0.36], emis: 1, drag: 2, grow: 1.2, collide: false });
      }
      // dust (or the hangar's haze) blown off the deck under it — outdoors warm grey, in the hall a cool haze
      if (low < 7 && Math.abs(s.pos[0] - AX) < 14 && Math.random() < 0.6) {
        const inHall = s.pos[2] < MOUTH, col = inHall ? [0.58, 0.66, 0.76] : [0.66, 0.6, 0.52], n = s.phase === 'pad' ? 1 : 3;
        for (let k = 0; k < n; k++) {
          const a = Math.random() * TAU, r = 2 + Math.random() * 3, sp = 2.5 + (7 - low) * 0.6;
          P.spawn(s.pos[0] + Math.cos(a) * r, DECK + 0.15, s.pos[2] + Math.sin(a) * r, Math.cos(a) * sp, 0.15 + Math.random() * 0.35, Math.sin(a) * sp, { life: 0.9 + Math.random() * 0.7, size: 0.3 + Math.random() * 0.3, grav: -0.1, col, emis: 0, drag: 1.4, grow: 1.6, collide: false });
        }
      }
    }
    draw(r, E, layer) {
      const g = this.g, SS = g.starships, d = this.d, I = this.inst;
      if (!this.active || !SS || !d || !d.gpu) return;
      if (layer !== 'opaque' && !d.gpu.glass) return;
      const cam = r.cam, m = d.meta, rad = Math.max(m.length, m.width, m.height) * 0.6 * HF.SCALE;
      const dx = I.pos[0] - cam.x, dy = I.pos[1] + m.height * 0.5 * HF.SCALE - cam.y, dz = I.pos[2] - cam.z;
      if (dx * dx + dz * dz > 420 * 420) return;
      if (!VR.mat4.boxInFrustum(r.planes, dx - rad, dy - rad, dz - rad, dx + rad, dy + rad, dz + rad)) return;
      const prog = SS.begin(r, E, layer);
      if (prog.u.u_clipNear) r.gl.uniform1f(prog.u.u_clipNear, 0);
      SS.drawOne(r, prog, I, cam, layer, SS.lightAt(I.pos[0], I.pos[1] + m.height * HF.SCALE + 1, I.pos[2]), 1, false);
      SS.end(r, layer);
      this.draws = (this.draws || 0) + 1;
    }
    // put the shuttle at time t of its loop (a camera director, the picture tests): the angles snap to the path there and
    // its engine plumes start afresh (no streak from where it was)
    jump(t) {
      this.t = t; this.snap = true;
      const T = this.g.trails;
      if (T && T.map) for (const k of [...T.map.keys()]) if (k.startsWith(this.tid)) T.map.delete(k);
    }
    destroy() { this.showHome(); this.active = false; }
  };
})(VR);
