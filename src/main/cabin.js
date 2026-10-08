// ============================================================================
// Cabin: walking about inside a ship (the shuttles). Up the hydraulic rear
// ramp or the side stair from outside, or out of the pilot seat (click the
// cockpit door, or the seat's belt release: Shift+V) while the ship stands,
// hovers or the autopilot flies it — then you walk in the ship's own frame on
// its 25 cm grid (shipcabin.js): the floor carries you while it flies, steps
// and the ramp's slope just walk, the cockpit door slides open as you come
// near, the wall buttons work the ramp and the side door, a click on the pilot
// seat (or V) sits you down. Walking off the ramp's foot or the stair's last
// step puts you back in the world. The hatches (ramp, side door with its
// stair, cockpit door) and the kneel live on the ship and move here.
// ============================================================================
(function (VR) {
  'use strict';
  const mat4 = VR.mat4, TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  // the player's language (lang_de.js / lang_en.js)
  const T = (k, v, fb) => (VR.I18N ? VR.I18N.t(k, v, fb) : (fb !== undefined ? fb : k));
  const BW = 0.27, BH = 1.78, EYE = 1.6, STEP = 0.3, REACH = 2.2;
  // the cockpit door: 0.4 s to slide open, triggered 2.6 m away — it is fully open before a running walker (5.2 m/s)
  // reaches it, so nobody ever pushes against a half-open door
  const RAMP_T = 2.4, DOOR_T = 1.4, CDOOR_T = 0.4, CDOOR_NEAR = 2.6, KNEEL = 0.5;

  class Cabin {
    constructor(g, mgr) { this.g = g; this.mgr = mgr; this.w = null; this.C4 = mat4.create(); this.hover = null; }
    get active() { return !!this.w; }
    static of(s) { return s && s.d && s.d.meta && s.d.meta.cabin && s.d.walk ? s.d.meta.cabin : null; }
    // ---------------------------------------------------------------- hatches (every ship with a cabin, every frame)
    hatch(s) { return s.hatch || (s.hatch = { ramp: 0, rampOpen: false, door: 0, doorOpen: false, cdoor: 0, cdoorOpen: false, kneel: 0 }); }
    animate(s, dt) {
      const H = this.hatch(s), fl = s.flight, g = this.g, C = Cabin.of(s);
      // the flight's ramp switch and the hatch agree: while it flies the flight decides, standing the hatch does
      if (fl) { if (s.state === 'flying') H.rampOpen = !!fl.rampOpen; else fl.rampOpen = H.rampOpen; }
      const r0 = H.ramp, d0 = H.door;
      H.ramp = clamp(H.ramp + (H.rampOpen ? 1 : -1) * dt / RAMP_T, 0, 1);
      H.door = clamp(H.door + (H.doorOpen ? 1 : -1) * dt / DOOR_T, 0, 1);
      H.cdoor = clamp(H.cdoor + (H.cdoorOpen ? 1 : -1) * dt / CDOOR_T, 0, 1);
      // on the ground the ship kneels on its gear while the ramp is down (its foot reaches the ground)
      const grounded = s.state === 'parked' || (fl && fl.state === 'landed');
      H.kneel = clamp(H.kneel + ((grounded && H.rampOpen) ? 1 : -1) * dt / RAMP_T, 0, 1);
      s.kneel = H.kneel * KNEEL;
      if (fl) fl.ramp = H.ramp;
      if (C && g.audio && ((r0 === 0 || r0 === 1) && H.ramp !== r0)) g.audio.play('servo', { vol: 0.9 });
      if (C && g.audio && ((d0 === 0 || d0 === 1) && H.door !== d0)) g.audio.play('servo', { vol: 0.6 });
      if (C && g.audio && ((r0 < 1 && H.ramp === 1) || (r0 > 0 && H.ramp === 0))) g.audio.play('clunk', { vol: 0.7 });
    }
    toggleRamp(s, open) {
      const H = this.hatch(s), fl = s.flight;
      if (open === undefined) open = !H.rampOpen;
      if (fl && s.state === 'flying') { if (!fl.setRamp(open)) return false; H.rampOpen = fl.rampOpen; return true; }
      H.rampOpen = open; if (fl) fl.rampOpen = open;
      if (this.g.audio) this.g.audio.play('switch');
      return true;
    }
    toggleDoor(s, open) {
      const H = this.hatch(s), fl = s.flight;
      if (open === undefined) open = !H.doorOpen;
      if (open && fl && s.state === 'flying' && fl.speed > 8) { if (this.g.ui) this.g.ui.hint(T('g.cabin.locked', { v: 8 }), 1500); if (this.g.audio) this.g.audio.play('deny'); return false; }
      H.doorOpen = open; if (this.g.audio) this.g.audio.play('switch');
      return true;
    }
    // ---------------------------------------------------------------- frames
    rot(s) { return s.rot || this.mgr.rotOf(s); }
    toWorld(s, l) { const m = this.rot(s), y0 = s.pos[1] + (s.dip || 0) - (s.kneel || 0); return [s.pos[0] + m[0] * l[0] + m[4] * l[1] + m[8] * l[2], y0 + m[1] * l[0] + m[5] * l[1] + m[9] * l[2], s.pos[2] + m[2] * l[0] + m[6] * l[1] + m[10] * l[2]]; }
    toLocal(s, w) { const m = this.rot(s), dx = w[0] - s.pos[0], dy = w[1] - s.pos[1] - (s.dip || 0) + (s.kneel || 0), dz = w[2] - s.pos[2]; return [m[0] * dx + m[1] * dy + m[2] * dz, m[4] * dx + m[5] * dy + m[6] * dz, m[8] * dx + m[9] * dy + m[10] * dz]; }
    dirLocal(s, d) { const m = this.rot(s); return [m[0] * d[0] + m[1] * d[1] + m[2] * d[2], m[4] * d[0] + m[5] * d[1] + m[6] * d[2], m[8] * d[0] + m[9] * d[1] + m[10] * d[2]]; }
    // ---------------------------------------------------------------- what is solid where you walk (ship metres)
    rampY(C, z) { const R = C.ramp, a = R.open - Math.PI / 2; return R.hinge[1] - (z - R.hinge[2]) * Math.tan(a); }
    rampRun(C) { const R = C.ramp; return R.len * Math.sin(R.open); }
    stairTop(C, x) { const S = C.stair, o = (x * C.door.side) - Math.abs(S.x0); if (o < 0) return C.floor; const n = Math.floor(o / S.run); return n >= S.n ? -9 : C.floor - S.rise * (n + 1); }
    // the player's box with its feet at (x, y, z) runs into something?
    hits(s, x, y, z) {
      const C = Cabin.of(s), W = s.d.walk, H = this.hatch(s), R = W.res, O = W.origin, D = W.dims;
      const x0 = x - BW, x1 = x + BW, y0 = y + 0.002, y1 = y + BH, z0 = z - BW, z1 = z + BW;
      const i0 = Math.floor((x0 - O[0]) * R), i1 = Math.floor((x1 - O[0]) * R), j0 = Math.floor((y0 - O[1]) * R), j1 = Math.floor((y1 - O[1]) * R), k0 = Math.floor((z0 - O[2]) * R), k1 = Math.floor((z1 - O[2]) * R);
      for (let j = Math.max(0, j0); j <= Math.min(D[1] - 1, j1); j++) for (let k = Math.max(0, k0); k <= Math.min(D[2] - 1, k1); k++) for (let i = Math.max(0, i0); i <= Math.min(D[0] - 1, i1); i++) {
        const n = (j * D[2] + k) * D[0] + i; if (W.bits[n >> 3] & (1 << (n & 7))) return true;
      }
      if (j0 < 0 && y0 < O[1]) return true;
      const ov = (a0, a1, b0, b1) => a1 > b0 && a0 < b1;
      // the cockpit door (closed unless open)
      const cd = C.cockpitDoor;
      if (H.cdoor < 0.85 && ov(x0, x1, -cd.w / 2, cd.w / 2) && ov(y0, y1, cd.y0, cd.y0 + cd.h) && ov(z0, z1, cd.z - 0.15, cd.z + 0.1)) return true;
      // the side door
      const dr = C.door, dx = dr.x;
      if (H.door < 0.9 && ov(x0, x1, Math.min(dx, dx - dr.side * 0.6), Math.max(dx, dx - dr.side * 0.6)) && ov(y0, y1, dr.y0, dr.y0 + dr.h) && ov(z0, z1, dr.z - dr.w / 2, dr.z + dr.w / 2)) return true;
      // the ramp: shut, it closes the opening; down, its deck is a slope under your feet
      const rp = C.ramp, zh = rp.hinge[2];
      if (H.ramp < 0.95) { if (ov(x0, x1, -rp.w, rp.w) && ov(y0, y1, rp.hinge[1], rp.hinge[1] + rp.len) && ov(z0, z1, zh - 0.05, zh + 0.3)) return true; }
      else if (ov(x0, x1, -rp.w, rp.w) && z > zh && z < zh + this.rampRun(C)) { const ys = this.rampY(C, z); if (y0 < ys - 0.01 && y0 > ys - 0.7) return true; }
      // the stair (with the door open)
      if (H.door >= 0.9 && ov(z0, z1, C.stair.z0, C.stair.z1) && x * dr.side > Math.abs(C.stair.x0) - 0.05) { const ys = this.stairTop(C, x); if (ys > -9 && y0 < ys - 0.01 && y0 > ys - 0.5) return true; }
      return false;
    }
    // ---------------------------------------------------------------- stepping aboard / ashore
    // from the world: on the ramp's foot or the stair's lowest steps of a parked (or hovering) ship → walk aboard
    // (you step on where the ramp's deck or a step stands 15–55 cm above the ground — you step off where it ends or meets it)
    tryBoard(s, p) {
      const C = Cabin.of(s); if (!C || this.w) return false;
      const H = this.hatch(s), l = this.toLocal(s, p.pos), gy = s.kneel || 0;
      const rp = C.ramp, zh = rp.hinge[2], run = this.rampRun(C);
      let ok = false;
      if (H.ramp > 0.95 && Math.abs(l[0]) < rp.w - 0.15 && l[2] > zh + 0.4 && l[2] < zh + run - 0.1) { const ys = this.rampY(C, l[2]); if (ys > gy + 0.15 && Math.abs(l[1] - ys) < 0.42) { l[1] = Math.max(l[1], ys); ok = true; } }
      const dr = C.door, S = C.stair, o = l[0] * dr.side - Math.abs(S.x0);
      if (!ok && H.door > 0.95 && l[2] > S.z0 + 0.1 && l[2] < S.z1 - 0.1 && o > 0.3 && o < S.n * S.run - 0.1) { const ys = this.stairTop(C, l[0]); if (ys > gy + 0.15 && Math.abs(l[1] - ys) < 0.42) { l[1] = Math.max(l[1], ys); ok = true; } }
      if (!ok) return false;
      this.begin(s, l, p.yaw - s.yaw, p.pitch);
      return true;
    }
    // out of the pilot seat: stand behind it (the ship must stand, hover or fly itself)
    standUp(s) {
      const fl = s.flight, C = Cabin.of(s); if (!fl || !C) return false;
      const steady = fl.state === 'landed' || fl.auto || (fl.speed < 2.5 && Math.abs(fl.throttle) < 0.03);
      if (!steady) { if (this.g.ui) this.g.ui.hint(T('g.cabin.hoverFirst'), 2200); if (this.g.audio) this.g.audio.play('deny'); return false; }
      const ck = s.d.meta.cockpit, [sx, sz] = ck.seats[0], zMax = C.zb - 0.45;
      // the first free spot behind the seats (the seat backs lean aft; the door is shut) — in the middle, else behind a seat;
      // the walker's box must not start inside anything, or it could never move
      let l = null;
      for (let z = sz + 0.55; z <= zMax + 1e-6 && !l; z += 0.05) for (const x of [0, sx, -sx]) if (!this.hits(s, x, ck.floor, z)) { l = [x, ck.floor, z]; break; }
      if (!l) l = [0, ck.floor, Math.min(zMax, sz + 0.55)];
      this.mgr.leavePilot(s);
      this.begin(s, l, Math.PI, 0);
      this.hatch(s).cdoorOpen = true;
      return true;
    }
    begin(s, l, yaw, pitch) {
      const g = this.g, p = g.player;
      this.w = { s, p: l.slice(), v: [0, 0, 0], yaw, pitch: clamp(pitch || 0, -1.5, 1.5), ground: true, bob: 0, stepT: 0 };
      if (g.gadgets) g.gadgets.riding = { type: 'cabin', ship: s };
      p.flying = false; p.target = null; p.breaking = null; p.fallStart = null;
      g.camMode = 0;
      if (g.ui && g.ui.hint) g.ui.hint(T('g.cabin.aboard'), 3500);
      this.sync(0);
    }
    // back into the world where you stand
    end() {
      const g = this.g, p = g.player, w = this.w; if (!w) return;
      const wp = this.toWorld(w.s, w.p), m = this.rot(w.s);
      p.teleport(wp[0], wp[1] + 0.02, wp[2]);
      const v = w.v, sv = w.s.vel || [0, 0, 0];
      p.vel = [m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + sv[0], m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + sv[1], m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + sv[2]];
      p.yaw = w.yaw + w.s.yaw; p.pitch = w.pitch;
      this.w = null;
      if (g.gadgets && g.gadgets.riding && g.gadgets.riding.type === 'cabin') g.gadgets.riding = null;
      if (this.mgr.refreshNear) this.mgr.refreshNear(true);
    }
    // ---------------------------------------------------------------- walking (called by the ship systems while aboard)
    update(dt, input, blocked) {
      const g = this.g, w = this.w; if (!w) return;
      const s = w.s, C = Cabin.of(s), H = this.hatch(s);
      if (!C || this.mgr.ships.indexOf(s) < 0) { this.end(); return; }
      dt = Math.min(0.05, Math.max(1e-4, dt));
      const live = !blocked && !(g.ui && g.ui.typing), cap = live && input.captured;
      // a pilotless flight keeps flying (hover hold / the autopilot)
      if (s.flight && s.state === 'flying' && this.mgr.pilot !== s) s.flight.update(dt, input, true);
      // look
      if (cap) { const sens = input.sensitivity || 0.0024; w.yaw -= input.mouse.dx * sens; w.pitch = clamp(w.pitch - input.mouse.dy * sens * (input.invertY ? -1 : 1), -1.5, 1.5); }
      // walk
      const k = (c) => live && input.down(c);
      let fw = (k('KeyW') ? 1 : 0) - (k('KeyS') ? 1 : 0), st = (k('KeyD') ? 1 : 0) - (k('KeyA') ? 1 : 0);
      // the gamepad's walk stick and the touch stick are analog (input.padMove, F5): they add to the keys, as on foot
      if (live && input.padMove) { fw = clamp(fw + input.padMove.fwd, -1, 1); st = clamp(st + input.padMove.str, -1, 1); }
      const run = k('ControlLeft') || input.dbl && input.dbl('KeyW');
      const cy = Math.cos(w.yaw), sy = Math.sin(w.yaw);
      let wx = -sy * fw + cy * st, wz = -cy * fw - sy * st; const wl = Math.hypot(wx, wz); if (wl > 1) { wx /= wl; wz /= wl; }
      const sp = run ? 5.2 : 3.6, a = 1 - Math.exp(-dt * (w.ground ? 14 : 3)), v = w.v;
      v[0] += (wx * sp - v[0]) * a; v[2] += (wz * sp - v[2]) * a;
      v[1] -= 24 * dt; if (v[1] < -30) v[1] = -30;
      if (live && input.hit('Space') && w.ground) { v[1] = 6.2; w.ground = false; }
      this.move(s, w, v[0] * dt, v[1] * dt, v[2] * dt);
      // the cockpit door opens as you come near, from either side (and shuts behind you)
      const cd = C.cockpitDoor, dz = w.p[2] - cd.z;
      H.cdoorOpen = Math.abs(w.p[0]) < 1.3 && Math.abs(dz) < CDOOR_NEAR;
      // aim + click: the seat, the door buttons, the ramp, the holo table
      this.hover = this.pick(s, w);
      const click = live && (input.dragLook ? input.clickAction(0) : input.mouse.clicked[0]);
      if (click && this.hover) this.use(s, this.hover);
      if (live && input.hit('KeyV')) { this.sit(s); return; }
      if (!this.w) return;
      // stepping off the ramp's foot or the stair's last step (where it ends, or where it meets the ground): back into the world
      const zh = C.ramp.hinge[2], run2 = this.rampRun(C), o = w.p[0] * C.door.side - Math.abs(C.stair.x0), gy = s.kneel || 0, low = w.p[1] < gy + 0.08;
      const offRamp = Math.abs(w.p[0]) < C.ramp.w + 0.6 && w.p[2] > zh + 0.3 && (w.p[2] > zh + run2 + 0.05 || low);
      const offStair = o > 0.25 && w.p[2] > C.stair.z0 - 0.5 && w.p[2] < C.stair.z1 + 0.5 && (o > C.stair.n * C.stair.run + 0.05 || low);
      const lost = w.p[1] < -2 || Math.abs(w.p[0]) > 12 || Math.abs(w.p[2]) > 30;
      if (offRamp || offStair || lost) { this.end(); return; }
      this.sync(dt);
    }
    move(s, w, dx, dy, dz) {
      const p = w.p, wasGround = w.ground;
      // horizontal, axis by axis, climbing steps up to 30 cm
      for (const ax of [0, 2]) {
        const d = ax === 0 ? dx : dz; if (!d) continue;
        const n = Math.max(1, Math.ceil(Math.abs(d) / 0.1));
        for (let t = 0; t < n; t++) {
          const q = p.slice(); q[ax] += d / n;
          if (!this.hits(s, q[0], q[1], q[2])) { p[ax] = q[ax]; continue; }
          let up = 0;
          if (wasGround || w.ground) for (const h of [0.06, 0.13, 0.2, 0.26, STEP]) if (!this.hits(s, q[0], q[1] + h, q[2]) && !this.hits(s, p[0], p[1] + h, p[2])) { up = h; break; }
          if (up) { p[1] += up; p[ax] = q[ax]; }
          else { w.v[ax] = 0; break; }
        }
      }
      // vertical
      w.ground = false;
      if (dy) {
        const n = Math.max(1, Math.ceil(Math.abs(dy) / 0.08));
        for (let t = 0; t < n; t++) {
          if (!this.hits(s, p[0], p[1] + dy / n, p[2])) { p[1] += dy / n; continue; }
          if (dy < 0) { w.ground = true; let lo = 0, hi = Math.abs(dy / n); for (let it = 0; it < 6; it++) { const m = (lo + hi) / 2; if (this.hits(s, p[0], p[1] - m, p[2])) hi = m; else lo = m; } p[1] -= lo; }
          w.v[1] = 0; break;
        }
      }
      // walking down steps and the ramp: stay on the ground
      if (!w.ground && wasGround && w.v[1] <= 0 && !this.hits(s, p[0], p[1] - 0.02, p[2])) {
        for (let h = 0.04; h <= STEP + 0.01; h += 0.04) if (this.hits(s, p[0], p[1] - h, p[2])) { let lo = h - 0.04, hi = h; for (let it = 0; it < 5; it++) { const m = (lo + hi) / 2; if (this.hits(s, p[0], p[1] - m, p[2])) hi = m; else lo = m; } p[1] -= lo; w.ground = true; w.v[1] = 0; break; }
      }
      if (!w.ground && this.hits(s, p[0], p[1] - 0.01, p[2])) w.ground = true;
      // stuck inside something (a hatch shut on you): out upward
      if (this.hits(s, p[0], p[1], p[2])) for (let h = 0.1; h < 2.5; h += 0.1) if (!this.hits(s, p[0], p[1] + h, p[2])) { p[1] += h; break; }
    }
    // the player (world position, look) follows the walker
    sync(dt) {
      const g = this.g, p = g.player, w = this.w, s = w.s;
      const wp = this.toWorld(s, w.p);
      p.pos = [wp[0], wp[1], wp[2]]; p.vel = (s.vel || [0, 0, 0]).slice(); p.fallStart = null;
      const hs = Math.hypot(w.v[0], w.v[2]);
      if (w.ground && hs > 0.3) { w.bob += hs * dt * 1.55; w.stepT += hs * dt; if (w.stepT > 2.2) { w.stepT = 0; if (g.audio && g.audio.step) g.audio.step(0); } }
      const C4 = this.C4; C4.set(this.rot(s)); mat4.rotY(C4, C4, w.yaw); mat4.rotX(C4, C4, w.pitch);
      const e = VR.Flight ? VR.Flight.prototype.euler.call(null, C4) : { yaw: w.yaw + s.yaw, pitch: w.pitch, roll: 0 };
      p.yaw = e.yaw; p.pitch = clamp(e.pitch, -1.55, 1.55);
      this.eul = e;
    }
    camera(cam) {
      const w = this.w; if (!w) return null;
      const s = w.s, bob = Math.sin(w.bob * 2) * 0.03 * (w.ground ? 1 : 0), e = this.toWorld(s, [w.p[0], w.p[1] + EYE + Math.abs(bob), w.p[2]]), a = this.eul || { yaw: 0, pitch: 0, roll: 0 };
      return Object.assign(cam, { x: e[0], y: e[1], z: e[2], yaw: a.yaw, pitch: a.pitch, roll: a.roll, fixed: true });
    }
    // ---------------------------------------------------------------- things to click
    targets(s) {
      const C = Cabin.of(s), ck = s.d.meta.cockpit, out = [];
      if (ck) { const [sx, sz] = ck.seats[0]; out.push({ id: 'seat', label: 'Pilot', icon: 'start', p: [sx, ck.floor + 0.75, sz + 0.05], r: 0.45 }); }
      const cd = C.cockpitDoor; out.push({ id: 'cdoor', label: 'Tür', icon: 'ramp', p: [cd.w / 2 + 0.25, cd.y0 + 1.1, cd.z + 0.55], r: 0.12 });
      const dr = C.door; out.push({ id: 'door', label: 'Tür', icon: 'ramp', p: [dr.x - dr.side * 0.55, dr.y0 + 1.15, dr.z - dr.w / 2 - 0.2], r: 0.12 });
      out.push({ id: 'ramp', label: 'Rampe', icon: 'ramp', p: [-(C.ramp.w + 0.35), C.floor + 1.15, C.zEnd - 0.05], r: 0.13 });
      const tb = C.items.find(q => q.kind === 'table'); if (tb) out.push({ id: 'holo', label: 'Karte', icon: 'auto', p: [tb.x, C.floor + tb.h + 0.2, tb.z], r: 0.5 });
      return out;
    }
    pick(s, w) {
      const o = [w.p[0], w.p[1] + EYE, w.p[2]], cp = Math.cos(w.pitch), d = [-Math.sin(w.yaw) * cp, Math.sin(w.pitch), -Math.cos(w.yaw) * cp];
      let best = null, bt = REACH;
      for (const c of this.targets(s)) {
        const vx = c.p[0] - o[0], vy = c.p[1] - o[1], vz = c.p[2] - o[2], t = vx * d[0] + vy * d[1] + vz * d[2];
        if (t < 0.1 || t > bt) continue;
        if (vx * vx + vy * vy + vz * vz - t * t <= c.r * c.r) { bt = t; best = { c, t }; }
      }
      return best;
    }
    use(s, h) {
      const id = h.c.id, H = this.hatch(s), a = this.g.audio;
      if (id === 'seat') this.sit(s);
      else if (id === 'cdoor') { H.cdoorOpen = !H.cdoorOpen; if (a) a.play('button'); }
      else if (id === 'door') { if (a) a.play('button'); this.toggleDoor(s); }
      else if (id === 'ramp') { if (a) a.play('button'); this.toggleRamp(s); }
      // the holo table: the big map (where to fly next); without one the hologram goes on / off
      else if (id === 'holo') { const M = this.g.map; if (a) a.play('toast'); if (M && M.openBig) M.openBig(); else s.holo = s.holo === false; }
    }
    sit(s) {
      const w = this.w; if (!w) return;
      this.w = null;
      this.hatch(s).cdoorOpen = false;   // the cockpit door slides shut behind you
      if (this.g.gadgets) this.g.gadgets.riding = null;
      this.mgr.takeSeat(s, this.g.player);
    }
  }
  VR.Cabin = Cabin;
})(VR);
