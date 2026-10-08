// ============================================================================
// Sky trams: a two-car tram shuttles along every rail line the world places —
// the sky-rail viaducts between towns, the Canyon Loop and the Heartland's
// citadel viaducts (the lines come from the world generator: gen_rails.js and
// its providers). Their timetable follows a clock, so a tram is always where it
// should be when you arrive. A tram stops at each end (its station) and waits
// there. Riding (the state machine, see board()):
//   · right-click a car while it waits at a station: you board
//   · right-click (or Shift) at a station: you get off onto the platform
//   · Shift while it moves: the hint; Shift again climbs onto the roof
//   · a tram that is still moving cannot be boarded
// At dusk and at night the headlights glint, and a soft rail hum swells as a tram
// comes near (both cost a few particles and one audio loop, nothing per block).
// ============================================================================
(function (VR) {
  'use strict';
  // the player's language (lang_de.js / lang_en.js)
  const T = (k, v, fb) => (VR.I18N ? VR.I18N.t(k, v, fb) : (fb !== undefined ? fb : k));
  const mat4 = VR.mat4;
  const CAR = 6, GAP = 0.5, BOGIE = 2.2, VMAX = 13, ACC = 2.4, DWELL = 10;
  const HUM_NEAR = 70, GLINT_NEAR = 140;   // the hum swells within 70 blocks of a tram; headlight glints within 140
  const OFF = CAR / 2 + GAP / 2;
  const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

  class Line {
    constructor(d) {
      this.key = d.key; this.tech = !!d.tech; this.names = d.names || ['?', '?'];
      const P = d.pts, n = P.length / 3;
      const Y = []; for (let i = 0; i < n; i++) Y.push(P[i * 3 + 1]);
      // the rail surface (a step block is half way up), smoothed so the cars glide over the steps
      const surf = Y.map((y, i) => y + ((Y[i + 1] > y) || (Y[i - 1] > y) ? 0.5 : 0));
      this.p = [];
      for (let i = 0; i < n; i++) {
        let s = 0; for (let k = -2; k <= 2; k++) s += surf[Math.max(0, Math.min(n - 1, i + k))];
        this.p.push([P[i * 3] + 0.5, s / 5 + 0.08, P[i * 3 + 2] + 0.5]);
      }
      this.s = [0];
      for (let i = 1; i < n; i++) { const a = this.p[i - 1], b = this.p[i]; this.s.push(this.s[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])); }
      this.L = this.s[n - 1];
      let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
      for (const q of this.p) { x0 = Math.min(x0, q[0]); z0 = Math.min(z0, q[2]); x1 = Math.max(x1, q[0]); z1 = Math.max(z1, q[2]); }
      this.box = [x0, z0, x1, z1];
      // timetable: dwell, run, dwell, run back (trapezoid speed profile)
      const D = this.L, ta = VMAX / ACC, da = 0.5 * ACC * ta * ta;
      if (D >= 2 * da) this.T = 2 * ta + (D - 2 * da) / VMAX; else this.T = 2 * Math.sqrt(D / ACC);
      this.period = 2 * (DWELL + this.T);
      this.off = (hashStr(this.key) % 1000) / 1000 * this.period;
      this.cars = [new Car(this, 0), new Car(this, 1)];
      this.c = 0; this.v = 0; this.stop = 0;
    }
    dist(t) {
      const D = this.L, ta = VMAX / ACC, da = 0.5 * ACC * ta * ta, T = this.T;
      if (D >= 2 * da) { if (t < ta) return 0.5 * ACC * t * t; if (t < T - ta) return da + VMAX * (t - ta); const r = T - t; return D - 0.5 * ACC * r * r; }
      const tp = T / 2; if (t < tp) return 0.5 * ACC * t * t; const r = T - t; return D - 0.5 * ACC * r * r;
    }
    // train centre along the track at a clock time; stop: 0 moving, 1 at the first station, 2 at the second
    state(clock) {
      const ph = ((clock + this.off) % this.period + this.period) % this.period, T = this.T;
      if (ph < DWELL) return { c: 0, v: 0, stop: 1, left: DWELL - ph };
      if (ph < DWELL + T) { const t = ph - DWELL; return { c: this.dist(t), v: 1, stop: 0, left: T - t }; }
      if (ph < 2 * DWELL + T) return { c: this.L, v: 0, stop: 2, left: 2 * DWELL + T - ph };
      const t = ph - 2 * DWELL - T; return { c: this.L - this.dist(t), v: -1, stop: 0, left: T - t };
    }
    // a point on the track at arc length s (straight on past both ends, over the station platforms)
    at(s, out) {
      const p = this.p, S = this.s, n = p.length;
      if (s <= 0) { const a = p[0], b = p[1]; const k = s / (S[1] || 1); out[0] = a[0] + (b[0] - a[0]) * k; out[1] = a[1]; out[2] = a[2] + (b[2] - a[2]) * k; return out; }
      if (s >= this.L) { const a = p[n - 2], b = p[n - 1]; const k = (s - this.L) / ((S[n - 1] - S[n - 2]) || 1); out[0] = b[0] + (b[0] - a[0]) * k; out[1] = b[1]; out[2] = b[2] + (b[2] - a[2]) * k; return out; }
      let lo = 0, hi = n - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] <= s) lo = m; else hi = m; }
      const k = (s - S[lo]) / ((S[hi] - S[lo]) || 1), a = p[lo], b = p[hi];
      out[0] = a[0] + (b[0] - a[0]) * k; out[1] = a[1] + (b[1] - a[1]) * k; out[2] = a[2] + (b[2] - a[2]) * k;
      return out;
    }
    place(clock) {
      const st = this.state(clock);
      this.c = st.c; this.v = st.v; this.stop = st.stop; this.left = st.left;
      for (const car of this.cars) car.place(this.c);
    }
    distTo(x, z) { const b = this.box; const dx = Math.max(b[0] - x, 0, x - b[2]), dz = Math.max(b[1] - z, 0, z - b[3]); return Math.hypot(dx, dz); }
  }

  class Car {
    constructor(line, idx) {
      this.line = line; this.idx = idx; this.kind = 'tram';
      this.pos = [0, 0, 0]; this.yaw = 0; this.pitch = 0;
      this.f = [0, 0, 0]; this.r = [0, 0, 0];
    }
    place(c) {
      const L = this.line, m = this.idx === 0 ? c - OFF : c + OFF;
      L.at(m + BOGIE, this.f); L.at(m - BOGIE, this.r);
      const f = this.f, r = this.r;
      this.pos[0] = (f[0] + r[0]) / 2; this.pos[1] = (f[1] + r[1]) / 2; this.pos[2] = (f[2] + r[2]) / 2;
      // noses point outward: the first car toward the first station, the second toward the other one
      const s = this.idx === 0 ? -1 : 1;
      const dx = (f[0] - r[0]) * s, dy = (f[1] - r[1]) * s, dz = (f[2] - r[2]) * s;
      this.yaw = Math.atan2(-dx, -dz);
      this.pitch = Math.atan2(dy, Math.hypot(dx, dz) || 1);
    }
    hitbox() {
      const p = this.pos, cy = Math.abs(Math.cos(this.yaw)), sy = Math.abs(Math.sin(this.yaw));
      const hx = sy * CAR / 2 + cy * 1.25, hz = cy * CAR / 2 + sy * 1.25;
      return [p[0] - hx, p[1], p[2] - hz, p[0] + hx, p[1] + 3.2, p[2] + hz];
    }
    onUse() { const g = VR.game; if (g && g.trams) g.trams.board(this); }
    // the nose's forward and right vectors (the seats and the headlights use them)
    forward() { return [-Math.sin(this.yaw), -Math.cos(this.yaw)]; }
  }

  class Trams {
    constructor(g) {
      this.g = g;
      this.lines = new Map();
      this.cars = [];
      const E = g.env;
      this.clock = E ? ((E.day || 0) * 24000 + (E.ticks || 0)) / 20 : 0;
      this.pollT = 0; this.pollAt = null; this.busy = false;
      this.announce = null;
      this.glowT = 0;
    }
    destroy() { this.lines.clear(); this.cars.length = 0; }
    poll(dt) {
      const g = this.g, p = g.player;
      this.pollT -= dt;
      if (this.pollT > 0 || this.busy || !p || g.dim !== 'overworld') return;
      this.pollT = 4;
      if (this.pollAt && Math.hypot(p.pos[0] - this.pollAt[0], p.pos[2] - this.pollAt[1]) < 160) return;
      this.busy = true;
      const at = [p.pos[0], p.pos[2]];
      g.pool.direct(0, { type: 'railways', dim: g.dim, x: Math.floor(at[0]), z: Math.floor(at[1]), r: 700 }, null, (m) => {
        this.busy = false;
        if (!m.lines || this.g.trams !== this) return;
        this.pollAt = at;
        for (const d of m.lines) if (!this.lines.has(d.key)) this.lines.set(d.key, new Line(d));
        const ride = this.ridingCar();
        for (const [k, L] of this.lines) if (L.distTo(at[0], at[1]) > 1300 && !(ride && ride.line === L)) this.lines.delete(k);
      });
    }
    ridingCar() { const gd = this.g.gadgets, r = gd && gd.riding; return r && r.type === 'tram' ? r.car : null; }
    update(dt) {
      const g = this.g, p = g.player;
      if (!p) return;
      this.clock += dt;
      this.poll(dt);
      this.cars.length = 0;
      const ride = this.ridingCar();
      for (const L of this.lines.values()) {
        if (L.distTo(p.pos[0], p.pos[2]) > 320 && !(ride && ride.line === L)) continue;
        const was = L.stop;
        L.place(this.clock);
        for (const c of L.cars) this.cars.push(c);
        if (ride && ride.line === L && L.stop && !was) {
          const name = L.names[L.stop - 1];
          g.ui.chatLine(T('g.tram.arriving', { name: name || T('g.tram.station') }), '#9affd8');
          g.audio && g.audio.play && g.audio.play('click');
        }
      }
      this.atmosphere(dt, p);
    }
    // the rail hum (one audio loop, its level by the nearest car) and the headlight glints at dusk and night (a few
    // particles every 20th of a second for the cars near the player)
    atmosphere(dt, p) {
      const g = this.g, E = g.env, night = E ? (E.night || 0) : 0;
      let near = 1e9;
      for (const c of this.cars) { const d = Math.hypot(c.pos[0] - p.pos[0], c.pos[2] - p.pos[2]); if (d < near) near = d; }
      if (g.audio && g.audio.loop) g.audio.loop('hum', near < HUM_NEAR ? (1 - near / HUM_NEAR) * 0.09 : 0, 0.4);
      if (night < 0.12 || !g.particles) return;
      this.glowT -= dt;
      if (this.glowT > 0) return;
      this.glowT = 0.05;
      const col = [1, 0.93, 0.74];
      for (const c of this.cars) {
        const dx = c.pos[0] - p.pos[0], dz = c.pos[2] - p.pos[2];
        if (dx * dx + dz * dz > GLINT_NEAR * GLINT_NEAR) continue;
        const F = c.forward(), R = [Math.cos(c.yaw), -Math.sin(c.yaw)], y = c.pos[1] + 0.9;
        for (const side of [-0.85, 0.85]) {
          const hx = c.pos[0] + F[0] * 2.95 + R[0] * side, hz = c.pos[2] + F[1] * 2.95 + R[1] * side;
          g.particles.glow(hx, y, hz, col, 0.12, 0.3, 0);
          g.particles.glow(hx + F[0] * 3.2, y, hz + F[1] * 3.2, col, 0.1, 0.2, 0);
        }
      }
    }
    // ---------------------------------------------------------------- riding (through the gadgets' riding slot)
    // the state machine: idle → (right-click a car that waits at a station) → riding; riding → (right-click or Shift at a
    // station) → off onto the platform; a car that moves can't be boarded (and a click while riding it asks you to wait)
    board(car) {
      const g = this.g, gd = g.gadgets, p = g.player;
      if (!gd || p.dead) return;
      const r = gd.riding;
      if (r) {
        if (r.type !== 'tram') return;
        if (r.car.line.stop) gd.dismount(); else g.ui.hint(T('g.tram.moving'), 2200);
        return;
      }
      if (!car.line.stop) { g.ui.hint(T('g.tram.wait'), 2200); return; }
      gd.riding = { type: 'tram', car, seat: car.idx === 0 ? 1.1 : -1.1 };
      p.flying = false; p.target = null; p.breaking = null;
      const L = car.line, to = L.v > 0 || (L.stop === 1) ? L.names[1] : L.names[0];
      g.ui.hint(T('g.tram.to', { name: to || T('g.tram.nextTown') }), 3000);
      if (g.codex && g.codex.event) g.codex.event('tram');
    }
    seatPos(r) {
      const c = r.car, fx = -Math.sin(c.yaw), fz = -Math.cos(c.yaw);
      return [c.pos[0] + fx * r.seat, c.pos[1] + 0.62, c.pos[2] + fz * r.seat];
    }
    driveRide(dt, input, blocked, r) {
      const g = this.g, p = g.player, c = r.car;
      if (!this.lines.has(c.line.key)) { g.gadgets.dismount(); return; }
      const sp = this.seatPos(r);
      p.pos = sp; p.vel = [0, 0, 0]; p.fallStart = null; p.onGround = true;
      if (blocked) return;
      const mouse = input.mouse, rc = mouse && (input.dragLook ? input.clickAction(2) : mouse.clicked[2]);
      if (rc) { mouse.clicked[2] = false; if (mouse.releasedBtn) mouse.releasedBtn[2] = false; this.board(c); return; }
      if (input.hit('ShiftLeft') || input.hit('ShiftRight') || input.hit('KeyV')) {
        if (c.line.stop) { g.gadgets.dismount(); return; }
        if (r.roofAsk && this.clock - r.roofAsk < 2.5) { g.gadgets.dismount(); return; }
        r.roofAsk = this.clock;
        g.ui.hint(T('g.tram.moving'), 2200);
      }
    }
    // where to put the rider down: the platform beside the car at a station, else the roof
    exitSpot(r) {
      const c = r.car, L = c.line, rx = Math.cos(c.yaw), rz = -Math.sin(c.yaw);
      const base = c.pos;
      if (L.stop) {
        const out = [];
        for (const side of [1, -1]) for (const k of [2.2, 2.6]) out.push([base[0] + rx * side * k, Math.round(base[1]), base[2] + rz * side * k]);
        return out;
      }
      return [[base[0], base[1] + 3.3, base[2]]];
    }
    camera(cam, r) {
      const g = this.g, p = g.player, c = r.car;
      const sp = this.seatPos(r);
      if (g.camMode === 0) return Object.assign(cam, { x: sp[0], y: sp[1] + 1.05, z: sp[2], roll: 0, fixed: true });
      const ch = g.gadgets.chase([c.pos[0], c.pos[1] + 2.2, c.pos[2]], g.camMode === 1 ? 9 : 16, 1.6, p);
      return Object.assign(cam, { x: ch[0], y: ch[1], z: ch[2], roll: 0, fixed: true, far: cam.far + 40 });
    }
    hud(r) {
      const L = r.car.line;
      if (L.stop) return T('g.tram.hudStop', { name: L.names[L.stop - 1] || T('g.tram.station'), s: Math.ceil(L.left) });
      const to = L.v > 0 ? L.names[1] : L.names[0];
      return T('g.tram.hudGo', { name: to || T('g.tram.next'), s: Math.ceil(L.left) });
    }
    // ---------------------------------------------------------------- drawing (inside the entities' voxel pass)
    draw(r, E, cam, prog) {
      if (!this.cars.length) return;
      const g = this.g, ents = g.entities, gl = r.gl, w = g.world;
      const ride = this.ridingCar();
      for (const c of this.cars) {
        const dx = c.pos[0] - cam.x, dy = c.pos[1] - cam.y, dz = c.pos[2] - cam.z;
        if (dx * dx + dz * dz > 260 * 260) continue;
        if (!w.isLoaded(Math.floor(c.pos[0]), Math.floor(c.pos[2])) && c !== ride) continue;
        if (!mat4.boxInFrustum(r.planes, dx - 4, dy - 1, dz - 4, dx + 4, dy + 4, dz + 4)) continue;
        const model = VR.getVoxModel(gl, c.line.tech ? 'tram_car' : 'tram_car_classic');
        const light = ents.lightAt(c.pos[0], c.pos[1] + 1.5, c.pos[2]);
        ents.drawModel(r, prog, model, c.pos, cam, c.yaw, null, light, { pitch: c.pitch, shadeH: 3 });
      }
      if (ride && g.camMode !== 0 && g.gadgets) {
        const rr = g.gadgets.riding, sp = this.seatPos(rr);
        g.gadgets.drawRider(r, prog, [sp[0], sp[1] - 0.75, sp[2]], cam, ride.yaw, ents.lightAt(sp[0], sp[1] + 1, sp[2]), 0);
      }
    }
  }
  VR.Trams = Trams;
  // the line and the car, for the node tests (tram_sched.js) — the game itself builds them through Trams
  Trams.Line = Line; Trams.Car = Car;
})(VR);
