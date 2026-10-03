// ============================================================================
// Sky traffic: mini-voxel starships drop out of hyperspace, cross the sky in
// formations (fighters, freighters, cruisers, the odd capital carrier), bank
// through gentle curves and jump away again. When raider drones attack, a
// defence wing arrives and fights them.
// ============================================================================
(function (VR) {
  'use strict';
  const M = VR.M;
  const TAU = Math.PI * 2;
  const TYPES = [['interceptor', 30], ['racer', 12], ['gunship', 16], ['freighter', 16], ['dropship', 10], ['shuttle', 10], ['cruiser', 6], ['carrier', 2.5]];
  const SPEED = { interceptor: [38, 55], racer: [48, 66], gunship: [30, 40], freighter: [20, 28], dropship: [26, 34], shuttle: [26, 34], cruiser: [16, 22], carrier: [10, 14] };

  class Traffic {
    constructor(g) {
      this.g = g;
      this.ships = [];
      this.t = 6 + Math.random() * 8;
      this.time = 0;
    }
    focus() { const g = this.g; if (g.state === 'play' && g.player) return g.player.pos; if (g.titleCam) return [g.titleCam.x, g.titleCam.y - 30, g.titleCam.z]; return null; }
    pickType(rng) { let tot = 0; for (const t of TYPES) tot += t[1]; let r = rng.next() * tot; for (const t of TYPES) { r -= t[1]; if (r <= 0) return t[0]; } return 'interceptor'; }
    spawnFlight(opts) {
      opts = opts || {};
      const g = this.g, SS = g.starships;
      if (!SS || !this.focus()) return;
      const rng = new VR.RNG((Math.random() * 4294967295) >>> 0);
      const arch = opts.arch && VR.Starship.ARCH[opts.arch] ? opts.arch : this.pickType(rng);
      SS.design((Math.random() * 4294967295) >>> 0, arch, null, (d) => this.launch(d, rng, opts));
    }
    launch(d, rng, opts) {
      const fp = this.focus(); if (!fp) return;
      const m = d.meta, arch = m.arch;
      const big = arch === 'carrier' || arch === 'cruiser';
      const sp = SPEED[arch] || [30, 40], speed = rng.range(sp[0], sp[1]);
      const a = rng.range(0, TAU), pass = rng.range(big ? 60 : 30, big ? 140 : 110) * (rng.chance(0.5) ? 1 : -1), D = rng.range(150, 230);
      const fx = Math.cos(a), fz = Math.sin(a), rx = -fz, rz = fx;
      const alt = M.clamp(fp[1] + rng.range(big ? 55 : 25, big ? 110 : 75), 96, big ? 236 : 226);
      const A = [fp[0] - fx * D + rx * pass, alt + rng.range(-8, 8), fp[2] - fz * D + rz * pass];
      const B = [fp[0] + fx * D + rx * pass * 0.4, alt + rng.range(-12, 12), fp[2] + fz * D + rz * pass * 0.4];
      const C = [(A[0] + B[0]) / 2 + rx * rng.range(-60, 60), (A[1] + B[1]) / 2 + rng.range(-10, 14), (A[2] + B[2]) / 2 + rz * rng.range(-60, 60)];
      const len = Math.hypot(B[0] - A[0], B[2] - A[2]) * 1.1;
      const squad = !opts.defender && !opts.circle && (arch === 'interceptor' || arch === 'racer' || arch === 'gunship') && rng.chance(0.5);
      const n = opts.defender ? 1 : squad ? rng.irange(3, 5) : arch === 'interceptor' || arch === 'racer' ? (rng.chance(0.55) ? rng.irange(2, 3) : 1) : arch === 'gunship' && rng.chance(0.3) ? 2 : 1;
      for (let k = 0; k < n; k++) {
        // a V formation: wingmen fall back and out, staggered in height
        const off = k === 0 ? [0, 0, 0] : [(k % 2 ? -1 : 1) * (m.width + (squad ? 6 : 3)) * Math.ceil(k / 2), (squad ? -1.5 : 0) * Math.ceil(k / 2) + rng.range(-1, 1), (m.length + (squad ? 7 : 4)) * Math.ceil(k / 2)];
        this.ships.push({ d, A, B, C, off, t: -k * 0.02, dur: len / speed, speed, age: 0, heading: 0, roll: 0, pitch: 0, gear: 0, prevYaw: null, pos: A.slice(), arch, big, fire: rng.range(1, 3), defender: !!opts.defender, circle: opts.circle || null, life: opts.life || 0 });
      }
    }
    spawnDefenders() {
      const g = this.g, p = g.player; if (!p) return;
      for (let k = 0; k < 2; k++) this.spawnFlight({ arch: 'interceptor', defender: true, circle: { r: 34 + k * 6, h: p.pos[1] + 16 + k * 4, w: (k ? -1 : 1) * 0.55, a0: k * Math.PI }, life: 150 });
      g.ui.chatLine('✦ A defence wing drops out of hyperspace!', '#9affd8');
    }
    update(dt) {
      const g = this.g, fp = this.focus();
      this.time += dt;
      if (!fp || (g.state === 'play' && g.dim !== 'overworld')) return;
      this.t -= dt;
      const maxShips = g.settings.preset === 'potato' ? 2 : g.settings.preset === 'low' ? 4 : 9;
      if (this.t <= 0) { this.t = 11 + Math.random() * 22; if (this.ships.length < maxShips) this.spawnFlight(); }
      if (g.state === 'play' && g.raidActive && !this.ships.some(s => s.defender) && !this.defended) { this.defended = true; this.spawnDefenders(); }
      if (!g.raidActive) this.defended = false;
      let near = 1e9;
      for (let i = this.ships.length - 1; i >= 0; i--) {
        const s = this.ships[i];
        s.age += dt;
        if (s.circle) this.flyCircle(s, dt, fp); else this.flyPath(s, dt);
        if (s.dead) { this.ships.splice(i, 1); continue; }
        const d = Math.hypot(s.pos[0] - fp[0], s.pos[1] - fp[1], s.pos[2] - fp[2]);
        near = Math.min(near, d);
        this.exhaust(s, d);
        if (s.defender) this.dogfight(s, dt);
      }
      g.audio.loop('flyby', near < 90 ? (1 - near / 90) * 0.45 : 0, near < 90 ? 0.6 + (1 - near / 90) * 0.6 : 0.5);
    }
    bez(s, t) { const u = 1 - t, A = s.A, B = s.B, C = s.C; return [u * u * A[0] + 2 * u * t * C[0] + t * t * B[0], u * u * A[1] + 2 * u * t * C[1] + t * t * B[1], u * u * A[2] + 2 * u * t * C[2] + t * t * B[2]]; }
    flyPath(s, dt) {
      s.t += dt / s.dur;
      if (s.t < 0) return;
      if (s.t >= 1 && !s.warpOut) { s.warpOut = true; s.wt = 0; this.flash(s, false); }
      const t = Math.min(1, s.t), P = this.bez(s, t), P2 = this.bez(s, Math.min(1, t + 0.01));
      const yaw = Math.atan2(-(P2[0] - P[0]), -(P2[2] - P[2]));
      if (s.prevYaw !== null) { let dy = yaw - s.prevYaw; while (dy > Math.PI) dy -= TAU; while (dy < -Math.PI) dy += TAU; s.roll += (M.clamp(dy / Math.max(dt, 1e-3) * 2.5, -0.6, 0.6) - s.roll) * Math.min(1, dt * 2); }
      s.prevYaw = yaw; s.heading = yaw;
      const c = Math.cos(yaw), sn = Math.sin(yaw);
      s.pos = [P[0] + s.off[0] * c + s.off[2] * sn, P[1] + s.off[1] + Math.sin(s.age * 0.7) * 0.6, P[2] - s.off[0] * sn + s.off[2] * c];
      if (!s.arrived) { s.arrived = true; s.wt = 0; this.flash(s, true); }
      if (s.warpOut) { s.wt += dt; const k = s.wt * s.wt * 260; s.pos[0] += -Math.sin(yaw) * k; s.pos[2] += -Math.cos(yaw) * k; if (s.wt > 0.7) s.dead = true; }
      else s.wt += dt;
    }
    flyCircle(s, dt, fp) {
      const g = this.g, C = s.circle;
      if (!s.arrived) { s.arrived = true; s.wt = 0; C.a = C.a0; this.flash(s, true); }
      s.wt += dt; C.a += dt * C.w;
      const target = [fp[0] + Math.cos(C.a) * C.r, C.h + Math.sin(s.age * 0.8) * 3, fp[2] + Math.sin(C.a) * C.r];
      if (!s.warpOut && (s.age > s.life || (!g.raidActive && s.age > 20))) { s.warpOut = true; s.wt = 0; this.flash(s, false); }
      const prev = s.pos;
      if (s.age < 0.05) s.pos = target; else { const k = Math.min(1, dt * 1.5); s.pos = [prev[0] + (target[0] - prev[0]) * k, prev[1] + (target[1] - prev[1]) * k, prev[2] + (target[2] - prev[2]) * k]; }
      const dx = s.pos[0] - prev[0], dz = s.pos[2] - prev[2];
      if (Math.abs(dx) + Math.abs(dz) > 1e-4) { const yaw = Math.atan2(-dx, -dz); let dy = yaw - s.heading; while (dy > Math.PI) dy -= TAU; while (dy < -Math.PI) dy += TAU; s.heading += dy * Math.min(1, dt * 4); s.roll += (M.clamp(dy * 3, -0.7, 0.7) - s.roll) * Math.min(1, dt * 3); }
      if (s.warpOut) { const k = s.wt * s.wt * 260; s.pos[0] += -Math.sin(s.heading) * k; s.pos[2] += -Math.cos(s.heading) * k; if (s.wt > 0.7) s.dead = true; }
    }
    dogfight(s, dt) {
      const g = this.g, ents = g.entities;
      if (!ents || s.warpOut) return;
      s.fire -= dt; if (s.fire > 0) return;
      let best = null, bd = 60 * 60;
      for (const m of ents.mobs) { if (m.dead || !m.def.hostile) continue; const d2 = (m.pos[0] - s.pos[0]) ** 2 + (m.pos[1] - s.pos[1]) ** 2 + (m.pos[2] - s.pos[2]) ** 2; if (d2 < bd) { bd = d2; best = m; } }
      if (!best) { s.fire = 0.5; return; }
      s.fire = 0.45 + Math.random() * 0.4;
      const o = [s.pos[0], s.pos[1] + 1, s.pos[2]], t = [best.pos[0] - o[0], best.pos[1] + best.h * 0.5 - o[1], best.pos[2] - o[2]], L = Math.hypot(t[0], t[1], t[2]) || 1;
      ents.bolts.push({ pos: o, vel: [t[0] / L * 90, t[1] / L * 90, t[2] / L * 90], dmg: 8, owner: s, friendly: true, life: 1.5, col: [0.4, 1, 0.6] });
      if (g.player && Math.hypot(o[0] - g.player.pos[0], o[2] - g.player.pos[2]) < 60) g.audio.play('laser');
    }
    flash(s, arrive) {
      const g = this.g, fp = this.focus() || s.pos;
      const d = Math.hypot(s.pos[0] - fp[0], s.pos[2] - fp[2]);
      if (d > 320) return;
      const f = [-Math.sin(s.heading), 0, -Math.cos(s.heading)];
      for (let k = 0; k < 26; k++) { const b = (Math.random() - (arrive ? 1 : 0)) * 30; g.particles.spawn(s.pos[0] + f[0] * b, s.pos[1] + 1 + (Math.random() - 0.5) * 2, s.pos[2] + f[2] * b, f[0] * (arrive ? 30 : 60), 0, f[2] * (arrive ? 30 : 60), { life: 0.35 + Math.random() * 0.3, size: 0.6 + Math.random() * 0.8, grav: 0, col: [0.7, 0.9, 1], emis: 1, drag: 3, collide: false }); }
      g.particles.spawn(s.pos[0], s.pos[1] + 1, s.pos[2], 0, 0, 0, { life: 0.35, size: 6, grav: 0, col: [0.8, 0.95, 1], emis: 1, collide: false, grow: 4 });
      if (d < 200) g.audio.play('warp');
    }
    exhaust(s, dist) {
      const g = this.g, m = s.d.meta;
      if (dist > 260 || s.t < 0 || !m) return;
      const c = Math.cos(s.heading), sn = Math.sin(s.heading), f = [-sn, -c];
      if (g.trails && !s.warpOut) { if (!s.tid) s.tid = 'tr' + (Math.random() * 1e9 | 0); for (let ei = 0; ei < m.exhaust.length; ei++) { const e = m.exhaust[ei]; g.trails.engine(s.tid + ei, [s.pos[0] + e[0] * c + e[2] * sn, s.pos[1] + e[1], s.pos[2] - e[0] * sn + e[2] * c], 40, { thrust: 0.8, size: e[3] * (s.big ? 1.2 : 0.9), col: s.defender ? [0.4, 1, 0.6] : [0.6, 0.5, 1], minor: ei > 1, smokeLife: s.big ? 4.5 : 7, smokeK: 1.15 }); } }
      for (const e of m.exhaust) {
        if (Math.random() > 0.55) continue;
        const x = s.pos[0] + e[0] * c + e[2] * sn, z = s.pos[2] - e[0] * sn + e[2] * c;
        g.particles.spawn(x, s.pos[1] + e[1], z, -f[0] * 12, 0, -f[1] * 12, { life: 0.25 + Math.random() * 0.2, size: e[3] * (s.big ? 1.2 : 0.8), grav: 0, col: [1, 0.6, 0.3], emis: 1, drag: 3, grow: 0.8, collide: false });
      }
    }
    draw(r, E, layer) {
      const SS = this.g.starships;
      if (!this.ships.length || !SS) return;
      const cam = r.cam;
      let prog = null;
      for (const s of this.ships) {
        const d = s.d; if (!d.gpu || s.t < 0) continue;
        if (layer !== 'opaque' && !d.gpu.glass) continue;
        const m = d.meta, rad = Math.max(m.length, m.width, m.height) * 0.75;
        const dx = s.pos[0] - cam.x, dy = s.pos[1] - cam.y, dz = s.pos[2] - cam.z;
        if (dx * dx + dz * dz > 650 * 650) continue;
        if (!VR.mat4.boxInFrustum(r.planes, dx - rad, dy - rad, dz - rad, dx + rad, dy + rad, dz + rad)) continue;
        let stretch = 1;
        if (s.warpOut) stretch = 1 + s.wt * 14; else if (s.wt !== undefined && s.wt < 0.35) stretch = 1 + (0.35 - s.wt) * 20;
        if (!prog) prog = SS.begin(r, E, layer);
        const inst = { d, pos: [s.pos[0], s.pos[1] - m.height * 0.5, s.pos[2]], yaw: s.heading, pitch: 0, roll: s.roll, gear: 0 };
        SS.drawOne(r, prog, inst, cam, layer, { sky: 1, bl: [0, 0, 0] }, stretch, false);
      }
      if (prog) SS.end(r, layer);
    }
    destroy() { this.ships = []; }
  }
  VR.Traffic = Traffic;
})(VR);
