// ============================================================================
// Particles: block debris, sparks, smoke, splashes, glows, fireflies, embers
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R, F = VR.F;
  const CAP = 4096;
  class Particles {
    constructor(game) {
      this.game = game;
      this.n = 0;
      this.p = new Float64Array(CAP * 3); this.v = new Float32Array(CAP * 3);
      this.life = new Float32Array(CAP); this.max = new Float32Array(CAP);
      this.size = new Float32Array(CAP); this.grav = new Float32Array(CAP); this.drag = new Float32Array(CAP);
      this.layer = new Float32Array(CAP); this.uv = new Float32Array(CAP * 4); this.col = new Float32Array(CAP * 3);
      this.emis = new Float32Array(CAP); this.fade = new Uint8Array(CAP); this.collide = new Uint8Array(CAP); this.grow = new Float32Array(CAP);
      this.data = new Float32Array(CAP * 14);
      this.count = 0;
      this.budget = 1;
    }
    spawn(x, y, z, vx, vy, vz, o) {
      if (this.n >= CAP) return -1;
      if (this.budget < 1 && Math.random() > this.budget) return -1;
      const i = this.n++;
      this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
      this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
      this.life[i] = this.max[i] = o.life || 1;
      this.size[i] = o.size || 0.1; this.grav[i] = o.grav === undefined ? 12 : o.grav; this.drag[i] = o.drag || 0.5;
      this.layer[i] = o.layer === undefined ? -1 : o.layer;
      const uv = o.uv || [0, 0, 1, 1]; this.uv.set(uv, i * 4);
      const c = o.col || [1, 1, 1]; this.col[i * 3] = c[0]; this.col[i * 3 + 1] = c[1]; this.col[i * 3 + 2] = c[2];
      this.emis[i] = o.emis || 0; this.fade[i] = o.fade === false ? 0 : 1; this.collide[i] = o.collide === false ? 0 : 1; this.grow[i] = o.grow || 0;
      return i;
    }
    tintFor(state, layer) {
      // a block with its own colour (B1 „🎨 Aussehen"): its chips are that colour on average — the texture's grain stays
      const rc = R.T.rc ? R.T.rc[state] : 0;
      if (rc && VR.Looks) {
        const A = this.game && this.game.tex && this.game.tex.avgColor, c = VR.Looks.from565(rc), out = [1, 1, 1];
        for (let i = 0; i < 3; i++) { const want = Math.pow(((c >> (16 - 8 * i)) & 255) / 255, 2.2), have = A && layer >= 0 ? Math.pow(Math.max(0.03, A[layer * 4 + i]), 2.2) : 0.2; out[i] = Math.min(6, want / have); }
        return out;
      }
      const code = R.T.tint[state];
      if (!code) return [1, 1, 1];
      if (code === 1) return [0.21, 0.52, 0.1]; if (code === 2) return [0.13, 0.43, 0.03]; if (code === 3) return [0.05, 0.18, 0.77];
      return [0.33, 0.61, 0.22];
    }
    breakBlock(x, y, z, state) {
      const layer = R.T.tex[state * 6 + 4] & 0xfff;
      const tint = this.tintFor(state, layer);
      const n = 14 + Math.floor(Math.random() * 6);
      for (let k = 0; k < n; k++) {
        const px = x + 0.15 + Math.random() * 0.7, py = y + 0.15 + Math.random() * 0.7, pz = z + 0.15 + Math.random() * 0.7;
        const u = Math.random() * 0.75, v = Math.random() * 0.75;
        this.spawn(px, py, pz, (px - x - 0.5) * 3 + (Math.random() - 0.5), 2 + Math.random() * 3, (pz - z - 0.5) * 3 + (Math.random() - 0.5), { life: 0.6 + Math.random() * 0.6, size: 0.06 + Math.random() * 0.05, grav: 16, layer, uv: [u, v, u + 0.25, v + 0.25], col: tint, fade: false });
      }
    }
    hitBlock(t, state) {
      const layer = R.T.tex[state * 6 + t.face] & 0xfff;
      const tint = this.tintFor(state, layer);
      for (let k = 0; k < 3; k++) {
        const u = Math.random() * 0.8, v = Math.random() * 0.8;
        this.spawn(t.px + VR.DX[t.face] * 0.05, t.py + VR.DY[t.face] * 0.05, t.pz + VR.DZ[t.face] * 0.05, VR.DX[t.face] * 1.5 + (Math.random() - 0.5) * 2, 1.5 + Math.random() * 2, VR.DZ[t.face] * 1.5 + (Math.random() - 0.5) * 2, { life: 0.4 + Math.random() * 0.3, size: 0.04 + Math.random() * 0.03, grav: 16, layer, uv: [u, v, u + 0.2, v + 0.2], col: tint, fade: false });
      }
    }
    spark(x, y, z, col, n, speed, emis) {
      for (let k = 0; k < (n || 10); k++) {
        const a = Math.random() * 6.28, b = Math.random() * 3.14 - 1.57, s = (speed || 4) * (0.4 + Math.random() * 0.8);
        this.spawn(x, y, z, Math.cos(a) * Math.cos(b) * s, Math.sin(b) * s + 1, Math.sin(a) * Math.cos(b) * s, { life: 0.3 + Math.random() * 0.5, size: 0.05 + Math.random() * 0.05, grav: 6, col: col || [1, 0.7, 0.3], emis: emis === undefined ? 1 : emis, drag: 2 });
      }
    }
    smoke(x, y, z, n, dark) {
      for (let k = 0; k < (n || 4); k++) this.spawn(x + (Math.random() - 0.5) * 0.3, y, z + (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, 0.6 + Math.random() * 0.5, (Math.random() - 0.5) * 0.3, { life: 2 + Math.random(), size: 0.18 + Math.random() * 0.12, grav: -0.2, col: dark ? [0.2, 0.2, 0.22] : [0.75, 0.75, 0.78], drag: 0.8, grow: 0.25, collide: false });
    }
    explosion(x, y, z, r) {
      for (let k = 0; k < 40 * r; k++) { const a = Math.random() * 6.28, b = Math.random() * 3.14 - 1.2, s = 4 + Math.random() * 6 * r; this.spawn(x, y, z, Math.cos(a) * Math.cos(b) * s, Math.sin(b) * s, Math.sin(a) * Math.cos(b) * s, { life: 0.5 + Math.random() * 0.6, size: 0.25 + Math.random() * 0.35, grav: -1, col: [1, 0.6 + Math.random() * 0.3, 0.25], emis: 1, drag: 3, grow: 0.8, collide: false }); }
      this.smoke(x, y, z, 30, true);
    }
    splash(x, y, z, col) { for (let k = 0; k < 24; k++) { const a = Math.random() * 6.28, s = 1 + Math.random() * 3; this.spawn(x, y, z, Math.cos(a) * s, 3 + Math.random() * 4, Math.sin(a) * s, { life: 0.6 + Math.random() * 0.4, size: 0.05 + Math.random() * 0.05, grav: 18, col: col || [0.7, 0.85, 1] }); } }
    glow(x, y, z, col, life, size, vy) { return this.spawn(x, y, z, (Math.random() - 0.5) * 0.3, vy === undefined ? 0.3 : vy, (Math.random() - 0.5) * 0.3, { life: life || 2, size: size || 0.06, grav: 0, col, emis: 1, drag: 0.2, collide: false }); }
    // F6 · lamp glow: after dark, the emissive blocks (lamps, lanterns, windows) near the eye get a soft warm halo.
    // The lamps are found by a scan of a 29 × 11 × 29 box every two seconds (their emission is in R.T.emit).
    lampGlows(dt, eye, night) {
      const w = this.game.world, T = VR.R.T;
      if (!w || !(night > 0.35)) return;
      this.lampT = (this.lampT || 0) - dt;
      if (this.lampT <= 0 || !this.lamps) {
        this.lampT = 2;
        const L = [], ex = Math.floor(eye[0]), ey = Math.floor(eye[1]), ez = Math.floor(eye[2]);
        for (let y = ey - 6; y <= ey + 4 && L.length < 48; y++) for (let z = ez - 14; z <= ez + 14 && L.length < 48; z++) for (let x = ex - 14; x <= ex + 14 && L.length < 48; x++) {
          const s = w.getBlock(x, y, z);
          if (s && T.emit[s]) L.push(x + 0.5, y + 0.5, z + 0.5);
        }
        this.lamps = L;
      }
      const L = this.lamps;
      for (let i = 0; i < L.length; i += 3) if (Math.random() < dt * 1.5) this.glow(L[i], L[i + 1], L[i + 2], [1, 0.74, 0.42], 1.1, 0.42, 0.04);
    }
    update(dt, camPos) {
      const w = this.game.world;
      let i = 0;
      while (i < this.n) {
        this.life[i] -= dt;
        if (this.life[i] <= 0) { this.kill(i); continue; }
        const vi = i * 3;
        this.v[vi + 1] -= this.grav[i] * dt;
        const d = Math.exp(-this.drag[i] * dt);
        this.v[vi] *= d; this.v[vi + 1] *= d; this.v[vi + 2] *= d;
        const nx = this.p[vi] + this.v[vi] * dt, ny = this.p[vi + 1] + this.v[vi + 1] * dt, nz = this.p[vi + 2] + this.v[vi + 2] * dt;
        if (this.collide[i] && w) {
          const s = w.getBlock(Math.floor(nx), Math.floor(ny), Math.floor(nz));
          if (s && (R.T.flags[s] & F.SOLID) && (R.T.flags[s] & F.FULL)) { this.v[vi] *= 0.3; this.v[vi + 2] *= 0.3; this.v[vi + 1] = 0; i++; continue; }
        }
        this.p[vi] = nx; this.p[vi + 1] = ny; this.p[vi + 2] = nz;
        this.size[i] += this.grow[i] * dt;
        i++;
      }
      // build instance data
      const D = this.data;
      let o = 0;
      for (let k = 0; k < this.n; k++) {
        const vi = k * 3;
        const x = this.p[vi], y = this.p[vi + 1], z = this.p[vi + 2];
        let lm = 1;
        if (w && !this.emis[k]) { const l = w.getLight(Math.floor(x), Math.floor(y), Math.floor(z)); const sky = (l >>> 12) / 15, bl = Math.max((l >> 8) & 15, (l >> 4) & 15, l & 15) / 15; lm = Math.max(sky * this.game.skyBright, bl * 0.9) * 0.9 + 0.08; }
        const t = this.life[k] / this.max[k];
        D[o] = x - camPos[0]; D[o + 1] = y - camPos[1]; D[o + 2] = z - camPos[2]; D[o + 3] = this.size[k];
        D[o + 4] = this.uv[k * 4]; D[o + 5] = this.uv[k * 4 + 1]; D[o + 6] = this.uv[k * 4 + 2]; D[o + 7] = this.uv[k * 4 + 3];
        D[o + 8] = this.col[vi] * lm; D[o + 9] = this.col[vi + 1] * lm; D[o + 10] = this.col[vi + 2] * lm; D[o + 11] = this.layer[k];
        D[o + 12] = this.emis[k]; D[o + 13] = this.fade[k] ? Math.min(1, t * 2) : (t < 0.15 ? t / 0.15 : 1);
        o += 14;
      }
      this.count = this.n;
    }
    kill(i) {
      const j = --this.n;
      if (i === j) return;
      const cp3 = (a) => { a[i * 3] = a[j * 3]; a[i * 3 + 1] = a[j * 3 + 1]; a[i * 3 + 2] = a[j * 3 + 2]; };
      cp3(this.p); cp3(this.v); cp3(this.col);
      for (const a of [this.life, this.max, this.size, this.grav, this.drag, this.layer, this.emis, this.fade, this.collide, this.grow]) a[i] = a[j];
      for (let k = 0; k < 4; k++) this.uv[i * 4 + k] = this.uv[j * 4 + k];
    }
  }
  VR.Particles = Particles;
})(VR);
