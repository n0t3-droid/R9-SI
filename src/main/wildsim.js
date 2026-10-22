// ============================================================================
// Die Tierwelt (t-wild, WOW VI; docs/superpowers/plans/2026-10-16-t-wild.md) — the pure parts: no GL, no world, no
// Math.random (node-tested: test/wild_sim.js). The owner: a peaceful world where „immer etwas los ist" — nothing here
// hunts, nothing is hostile, nothing collides; it is presentation only and nothing is saved.
//   · Wild.CAPS — the ONE table of caps per tier (0 Very Low · 1 Low · 2 Balanced · 3 High · 4 Ultra); Wild.SWITCH —
//     the five settings switches and the pieces each one holds; Wild.budget(settings) → {tier, cap} (a switch off: 0)
//   · Wild.Flock — boids in typed arrays (separation, alignment, cohesion over the ≤ K nearest found in a hashed grid,
//     a wandering target, speeds held between vmin and vmax, a vertical cohesion stronger than the horizontal: thin
//     sheets that darken where they turn edge-on, and now and then a turning wave that sweeps through the cloud); the
//     same class swims the shoals (a cylinder of water to stay in, a fear point to scatter from)
//   · Wild.Swarm — butterflies at home on a flower drift: they fly to a flower, sit, fly on; a walk through makes the near
//     ones rise, and they settle again
//   · Wild.sched — the hours of every piece, a pure function of (seed, day, ticks): the same for host and guests;
//     Wild.stageOf — where the murmuration plays; Wild.murmTarget / shoalTarget — the seeded wandering targets
//   · Wild.rayLoop / rayAt / rayState — the sky rays' circuit between the Sky Isles (clear of their rock) and where each
//     ray is at a world clock (the same for every guest)
// ============================================================================
(function (VR) {
  'use strict';
  const W = VR.Wild = VR.Wild || {};
  const TAU = Math.PI * 2;

  // ---------------------------------------------------------------- the caps (one table) and the switches
  // per tier: 0 Very Low · 1 Low · 2 Balanced · 3 High · 4 Ultra. Very Low: nothing new drawn; Low: the small things;
  // Balanced and up: all of it
  W.CAPS = {
    murm: [0, 0, 200, 300, 360],     // the murmuration's boids (one flock; each drawn as MURM_K birds)
    gull: [0, 3, 5, 7, 9],           // gulls over the lake by day
    heron: [0, 1, 1, 2, 2],          // herons at the ponds
    fish: [0, 32, 48, 64, 80],       // fish in a shoal
    shoals: [0, 1, 2, 3, 3],         // shoals near the eye
    carp: [0, 3, 4, 5, 6],           // carp in a pond
    bfly: [0, 18, 36, 48, 60],       // butterflies in a swarm
    swarms: [0, 1, 1, 2, 2],         // swarms near the eye
    dfly: [0, 3, 5, 6, 8],           // dragonflies over a pond
    ray: [0, 0, 3, 4, 4],            // the sky rays between the isles
    motes: [0, 0, 6, 10, 14],        // light motes a second from each ray
    rabbit: [0, 3, 5, 6, 8],         // rabbits at the field edges
    fox: [0, 0, 1, 1, 1],            // the fox at dusk
    deerLine: [0, 1, 1, 1, 1],       // the deer cross the meadow in a line at dawn (1 on)
  };
  W.SWITCH = {
    wildBirds: ['murm', 'gull', 'heron'],
    wildFish: ['fish', 'shoals', 'carp'],
    wildBugs: ['bfly', 'swarms', 'dfly'],
    wildRays: ['ray', 'motes'],
    wildHerds: ['rabbit', 'fox', 'deerLine'],
  };
  W.KEYS = Object.keys(W.SWITCH);
  // the murmuration's boid is drawn as a party of MURM_K birds round it (wildgpu.js 'flock': in the boid's own frame,
  // flattened into its sheet, each its own beat and a little drift) — thousands of birds for the cost of a few hundred
  // boids; the sheets turn with the boids' bank, so the cloud darkens where they turn edge-on
  W.MURM_K = 20; W.MURM_RC = 3.0;
  const PRESET_TIER = { potato: 0, low: 1, balanced: 2, high: 3, ultra: 4, ultraLite: 4 };
  // the tier of a settings record: its preset, or for a custom setup its particle level (0 … 2) — as the living air's
  W.tierOf = function (S) {
    if (!S) return 2;
    if (PRESET_TIER[S.preset] !== undefined) return PRESET_TIER[S.preset];
    const p = Number.isFinite(S.particles) ? Math.round(S.particles) : 2;
    return Math.max(0, Math.min(2, p));
  };
  // the caps this settings record allows: the tier's, 0 where the piece's switch is off
  W.budget = function (S, out) {
    const tier = W.tierOf(S), cap = (out && out.cap) || {};
    for (const k of W.KEYS) { const on = !!(S && S[k]); for (const c of W.SWITCH[k]) cap[c] = on ? W.CAPS[c][tier] : 0; }
    if (out) { out.tier = tier; return out; }
    return { tier, cap };
  };
  W.any = (b) => { for (const k in b.cap) if (b.cap[k] > 0) return true; return false; };

  // ---------------------------------------------------------------- hashes and a seeded generator
  // a hash of up to three integers in [0, 1) (the same in every browser)
  W.h = function (a, b, c) {
    let h = Math.imul((a | 0) ^ 0x2c1b3c6d, 0x297a2d39) ^ Math.imul((b | 0) + 0x632be5ab, 0x85ebca6b) ^ Math.imul((c | 0) + 0x5bd1e995, 0xc2b2ae35);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  };
  // a small seeded generator (mulberry32): r() in [0, 1)
  W.rng = function (seed) {
    let a = (seed >>> 0) || 0x9e3779b9;
    return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  };

  // ---------------------------------------------------------------- the boids
  // P: r (neighbour radius) · K (neighbours at most) · sepR, wSep (separation) · wAli (alignment, 1/s) · wCoh, cohY
  // (cohesion, its vertical factor) · wTgt (the target's pull, blocks/s²) · flat (the climb's damping, 1/s) · vmin, vmax,
  // amax · stride (steering every n-th bird a step) · wave ([min, max] s between turning waves, or null), waveV, waveW,
  // waveA · fearR, fearA (the scatter from a fear point)
  // roost (the murmuration): the target pulls only beyond tgtR and only across (the flock roams its stage free and keeps
  // its own shape), heights held in a band of ±bandY round it (wY); lobes: the flock parts into wings (murmLobes)
  W.FLOCK = { roost: 1, r: 11, K: 7, maxC: 32, sepR: 6, wSep: 30, wAli: 2.2, wCoh: 0.25, cohY: 4, wTgt: 8, tgtR: 40, bandY: 6, wY: 0.6, lobes: 3, lobeR: 34, flat: 1.2, vmin: 7, vmax: 12, amax: 34, stride: 2, wave: [5, 10], waveV: 26, waveW: 4.5, waveMax: 110, waveA: 22, fearR: 6, fearA: 30 };
  W.SHOAL = { roost: 0, lobes: 0, r: 2.0, K: 8, maxC: 24, sepR: 0.85, wSep: 22, wAli: 2.8, wCoh: 0.7, cohY: 1.4, wTgt: 2.0, tgtR: 1.8, flat: 2.4, vmin: 0.5, vmax: 2.4, amax: 10, stride: 1, wave: null, waveV: 0, waveW: 0, waveA: 0, fearR: 3.5, fearA: 16 };
  const GN = 1024, GM = GN - 1;   // the grid's hash table (a power of two)
  class Flock {
    constructor(n, seed, P) {
      this.n = n; this.P = Object.assign({}, W.FLOCK, P || {});
      this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3); this.acc = new Float32Array(n * 3);
      this.phase = new Float32Array(n);   // the wing beat's (or the tail's) phase
      this.flap = new Float32Array(n);    // 0 a glide … 1 a full beat (climbing, speeding up)
      this.bank = new Float32Array(n);    // the roll into a turn (rad)
      this.head = new Int32Array(GN); this.next = new Int32Array(n); this.cell = new Int32Array(n * 3);
      this.tgt = new Float32Array(3); this.ctr = new Float32Array(3);
      this.rand = W.rng(seed); this.frame = 0; this.time = 0;
      this.bound = null;                  // a cylinder of water to stay in: {x, z, r, y0, y1}
      this.fear = null;                   // a point to scatter from ([x, y, z])
      // lobes: bird i follows the target moved by its lobe's offset (lobe i % lobes; murmLobes sets them from the clock)
      // — the cloud parts into two or three wings that swing apart and fold back into one
      this.lobes = this.P.lobes | 0; this.lofs = this.lobes > 1 ? new Float32Array(this.lobes * 3) : null;
      this.waveT = this.P.wave ? this.P.wave[0] + this.rand() * (this.P.wave[1] - this.P.wave[0]) : 1e9;
      this.wv = { on: false, x: 0, y: 0, z: 0, r: 0, dir: 1 }; this.waves = 0;
    }
    // the birds in a ball of radius r round (x, y, z), each flying a seeded heading at a cruising speed
    place(x, y, z, r) {
      const R = this.rand, P = this.P;
      for (let i = 0; i < this.n; i++) {
        const u = R() * TAU, v = Math.acos(2 * R() - 1), d = r * Math.cbrt(R());
        this.pos[i * 3] = x + Math.sin(v) * Math.cos(u) * d; this.pos[i * 3 + 1] = y + Math.cos(v) * d * 0.5; this.pos[i * 3 + 2] = z + Math.sin(v) * Math.sin(u) * d;
        const a = R() * 0.6 + 0.3, s = (P.vmin + P.vmax) / 2;
        this.vel[i * 3] = Math.cos(a) * s; this.vel[i * 3 + 1] = 0; this.vel[i * 3 + 2] = Math.sin(a) * s;
        this.phase[i] = R() * TAU;
      }
      this.tgt[0] = x; this.tgt[1] = y; this.tgt[2] = z;
    }
    key(ix, iy, iz) { return (Math.imul(ix, 73856093) ^ Math.imul(iy, 19349663) ^ Math.imul(iz, 83492791)) & GM; }
    step(dt) {
      if (!(dt > 0)) return;
      dt = Math.min(dt, 0.1);
      const n = this.n, P = this.P, p = this.pos, v = this.vel, A = this.acc, C = this.cell, head = this.head, next = this.next;
      const r = P.r, r2 = r * r, inv = 1 / r, s2 = P.sepR * P.sepR, K = P.K, MAXC = P.maxC || 48;
      this.time += dt; this.frame++;
      // the grid: each bird in its cell's list
      head.fill(-1);
      for (let i = 0; i < n; i++) {
        const ix = Math.floor(p[i * 3] * inv), iy = Math.floor(p[i * 3 + 1] * inv), iz = Math.floor(p[i * 3 + 2] * inv);
        C[i * 3] = ix; C[i * 3 + 1] = iy; C[i * 3 + 2] = iz;
        const k = this.key(ix, iy, iz); next[i] = head[k]; head[k] = i;
      }
      // a turning wave now and then: a shell that runs out from a bird and turns the ones it passes
      const wv = this.wv;
      if (P.wave) {
        if (!wv.on && (this.waveT -= dt) <= 0) {
          const i0 = Math.floor(this.rand() * n) % n;
          wv.on = true; wv.x = p[i0 * 3]; wv.y = p[i0 * 3 + 1]; wv.z = p[i0 * 3 + 2]; wv.r = 0; wv.dir = this.rand() < 0.5 ? -1 : 1; this.waves++;
          this.waveT = P.wave[0] + this.rand() * (P.wave[1] - P.wave[0]);
        }
        if (wv.on) { wv.r += P.waveV * dt; if (wv.r > (P.waveMax || 70)) wv.on = false; }
      }
      const tg = this.tgt, B = this.bound, fe = this.fear, stride = P.stride, ph = this.frame % stride;
      for (let i = 0; i < n; i++) {
        if ((i % stride) !== ph) continue;
        const px = p[i * 3], py = p[i * 3 + 1], pz = p[i * 3 + 2], vx = v[i * 3], vy = v[i * 3 + 1], vz = v[i * 3 + 2];
        let cnt = 0, seen = 0, mx = 0, my = 0, mz = 0, ax = 0, ay = 0, az = 0, sx = 0, sy = 0, sz = 0, ux = 0, uy = 0, uz = 0;
        const cx = C[i * 3], cy = C[i * 3 + 1], cz = C[i * 3 + 2];
        scan: for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          for (let j = head[this.key(cx + dx, cy + dy, cz + dz)]; j >= 0; j = next[j]) {
            if (j === i) continue;
            const ex = p[j * 3] - px, ey = p[j * 3 + 1] - py, ez = p[j * 3 + 2] - pz, d2 = ex * ex + ey * ey + ez * ez;
            if (d2 > r2) continue;
            // (separation from every one met — the nearest may be the last; alignment and cohesion from the first K)
            if (d2 < s2) { const d = Math.sqrt(d2) + 1e-4, k = (P.sepR - d) / (d * P.sepR); sx -= ex * k; sy -= ey * k; sz -= ez * k; }
            if (cnt < K) { cnt++; mx += ex; my += ey; mz += ez; ux += v[j * 3]; uy += v[j * 3 + 1]; uz += v[j * 3 + 2]; }
            if (++seen >= MAXC) break scan;
          }
        }
        if (cnt) {
          const q = 1 / cnt;
          ax += (ux * q - vx) * P.wAli + mx * q * P.wCoh + sx * P.wSep;
          ay += (uy * q - vy) * P.wAli + my * q * P.wCoh * P.cohY + sy * P.wSep;
          az += (uz * q - vz) * P.wAli + mz * q * P.wCoh + sz * P.wSep;
        }
        // the target's pull (stronger the farther), the climb's damping (they fly level: sheets)
        // (none within tgtR of it: the cloud is not drawn to a point — the birds sweep through the target's zone and turn)
        const lo = this.lofs ? (i % this.lobes) * 3 : -1, lx = lo >= 0 ? this.lofs[lo] : 0, ly = lo >= 0 ? this.lofs[lo + 1] : 0, lz = lo >= 0 ? this.lofs[lo + 2] : 0;
        const tx = tg[0] + lx - px, ty = tg[1] + ly - py, tz = tg[2] + lz - pz;
        if (P.roost) {
          // the roost's pull (the murmuration): only beyond a wide circle round the target and only across (the birds turn
          // back in, their speed held), a band of heights — the flock roams the stage free and keeps its own shape
          const dh = Math.sqrt(tx * tx + tz * tz) + 1e-4;
          if (dh > P.tgtR) { const k = P.wTgt * Math.min(1.5, (dh - P.tgtR) / 16) / dh; ax += tx * k; az += tz * k; }
          if (ty > P.bandY) ay += (ty - P.bandY) * P.wY; else if (ty < -P.bandY) ay += (ty + P.bandY) * P.wY;
        } else {
          const td = Math.sqrt(tx * tx + ty * ty + tz * tz) + 1e-4, kt = td > P.tgtR ? P.wTgt * Math.min(1.6, 0.25 + (td - P.tgtR) / 18) / td : 0;
          ax += tx * kt; ay += ty * kt * 1.2; az += tz * kt;
        }
        ay -= vy * P.flat;
        // the turning wave: a lateral push where its shell passes
        if (wv.on) {
          const ex = px - wv.x, ey = py - wv.y, ez = pz - wv.z, d = Math.sqrt(ex * ex + ey * ey + ez * ez);
          if (Math.abs(d - wv.r) < P.waveW) { const hv = Math.hypot(vx, vz) + 1e-4, k = P.waveA * wv.dir / hv; ax += -vz * k; az += vx * k; ay += P.waveA * 0.15; }
        }
        // the fear point: away from it (they scatter), faster
        if (fe) { const ex = px - fe[0], ez = pz - fe[2], d = Math.hypot(ex, ez) + 1e-4; if (d < P.fearR) { const k = P.fearA * (1 - d / P.fearR) / d; ax += ex * k; az += ez * k; } }
        // the water to stay in: back toward the middle near the wall, up or down near the band's ends
        if (B) {
          const ex = px - B.x, ez = pz - B.z, d = Math.hypot(ex, ez) + 1e-4, edge = B.r - 0.7;
          if (d > edge) { const k = -14 * (d - edge) / d; ax += ex * k; az += ez * k; }
          if (py < B.y0 + 0.25) ay += 10 * (B.y0 + 0.25 - py); else if (py > B.y1 - 0.25) ay -= 10 * (py - B.y1 + 0.25);
        }
        const am = Math.sqrt(ax * ax + ay * ay + az * az);
        if (am > P.amax) { const k = P.amax / am; ax *= k; ay *= k; az *= k; }
        A[i * 3] = ax; A[i * 3 + 1] = ay; A[i * 3 + 2] = az;
      }
      // integrate every bird: the speed held between its limits; the bank from the turn; the beat while climbing
      let ox = 0, oy = 0, oz = 0;
      const vmax = fe ? P.vmax * 1.5 : P.vmax;
      for (let i = 0; i < n; i++) {
        const o = i * 3, hx0 = v[o], hz0 = v[o + 2];
        v[o] += A[o] * dt; v[o + 1] += A[o + 1] * dt; v[o + 2] += A[o + 2] * dt;
        let s = Math.sqrt(v[o] * v[o] + v[o + 1] * v[o + 1] + v[o + 2] * v[o + 2]);
        if (s < 1e-6) { v[o] = P.vmin; s = P.vmin; }
        const lim = s < P.vmin ? P.vmin / s : s > vmax ? vmax / s : 1;
        if (lim !== 1) { v[o] *= lim; v[o + 1] *= lim; v[o + 2] *= lim; s *= lim; }
        p[o] += v[o] * dt; p[o + 1] += v[o + 1] * dt; p[o + 2] += v[o + 2] * dt;
        if (B) {   // (the water's wall and band hold, whatever the push)
          const ex = p[o] - B.x, ez = p[o + 2] - B.z, d = Math.hypot(ex, ez);
          if (d > B.r) { p[o] = B.x + ex / d * B.r; p[o + 2] = B.z + ez / d * B.r; const vr = (v[o] * ex + v[o + 2] * ez) / d; if (vr > 0) { v[o] -= ex / d * vr; v[o + 2] -= ez / d * vr; } }
          if (p[o + 1] < B.y0) { p[o + 1] = B.y0; if (v[o + 1] < 0) v[o + 1] = 0; } else if (p[o + 1] > B.y1) { p[o + 1] = B.y1; if (v[o + 1] > 0) v[o + 1] = 0; }
        }
        // the turn rate (the heading's change) banks the bird; climbing and speeding up beat the wings
        const h0 = Math.atan2(hz0, hx0), h1 = Math.atan2(v[o + 2], v[o]);
        let dh = h1 - h0; if (dh > Math.PI) dh -= TAU; else if (dh < -Math.PI) dh += TAU;
        const bk = Math.max(-0.9, Math.min(0.9, dh / dt * 0.35));
        this.bank[i] += (bk - this.bank[i]) * Math.min(1, dt * 5);
        const climb = v[o + 1] / s, want = Math.max(0, Math.min(1, 0.35 + climb * 2.5 + (A[o] * v[o] + A[o + 2] * v[o + 2]) / (s * P.amax)));
        this.flap[i] += (want - this.flap[i]) * Math.min(1, dt * 3);
        this.phase[i] += dt * (P.vmax > 4 ? 20 + 14 * this.flap[i] : 3 + 3.2 * s);   // (birds 3–5 beats a second: a shimmer at a distance; fish: the tail with the speed)
        if (this.phase[i] > 1000) this.phase[i] -= 1000 - (1000 % TAU);
        ox += p[o]; oy += p[o + 1]; oz += p[o + 2];
      }
      this.ctr[0] = ox / n; this.ctr[1] = oy / n; this.ctr[2] = oz / n;
    }
    centroid() { return this.ctr; }
    // the RMS distance from the middle
    spread() {
      const c = this.ctr, p = this.pos; let s = 0;
      for (let i = 0; i < this.n; i++) { const x = p[i * 3] - c[0], y = p[i * 3 + 1] - c[1], z = p[i * 3 + 2] - c[2]; s += x * x + y * y + z * z; }
      return Math.sqrt(s / this.n);
    }
    // the cloud's long axis (the principal component: power iteration on the covariance)
    axis() {
      const c = this.ctr, p = this.pos, n = this.n;
      let xx = 0, xy = 0, xz = 0, yy = 0, yz = 0, zz = 0;
      for (let i = 0; i < n; i++) { const x = p[i * 3] - c[0], y = p[i * 3 + 1] - c[1], z = p[i * 3 + 2] - c[2]; xx += x * x; xy += x * y; xz += x * z; yy += y * y; yz += y * z; zz += z * z; }
      let a = [0.577, 0.577, 0.577];
      for (let k = 0; k < 24; k++) { const b = [xx * a[0] + xy * a[1] + xz * a[2], xy * a[0] + yy * a[1] + yz * a[2], xz * a[0] + yz * a[1] + zz * a[2]], l = Math.hypot(b[0], b[1], b[2]) || 1; a = [b[0] / l, b[1] / l, b[2] / l]; }
      return a;
    }
  }
  W.Flock = Flock;

  // ---------------------------------------------------------------- the wandering targets
  // the murmuration's: a seeded loop of two sines round the stage (out to ~60 blocks, 0 … 20 over the stage's height)
  W.murmTarget = function (seed, t, st, out) {
    const h = (k) => W.h(seed, k, 0x6d);
    const R1 = 28 + 12 * h(1), R2 = 10 + 8 * h(2), w1 = 0.1 + 0.04 * h(3), w2 = 0.21 + 0.08 * h(4), p1 = TAU * h(5), p2 = TAU * h(6);
    out[0] = st.x + R1 * Math.cos(w1 * t + p1) + R2 * Math.cos(w2 * t + p2);
    out[2] = st.z + R1 * 0.85 * Math.sin(w1 * t + p1) + R2 * Math.sin(w2 * 1.3 * t + p2);
    out[1] = st.y + 6 + 5 * Math.sin(0.17 * t + p1) + 3 * Math.sin(0.41 * t + p2);
    return out;
  };
  // the murmuration's lobes: n offsets (out: n × 3) that swing apart up to R and fold back to nothing, slowly (a breath
  // of 26–38 s), each its own way round — the cloud stretches into wings and ribbons and gathers into one again
  W.murmLobes = function (seed, t, n, R, out) {
    const h = (k) => W.h(seed, k, 0x4c), per = 26 + 12 * h(1), br = 0.5 - 0.5 * Math.cos(TAU * t / per + TAU * h(2)), amp = R * br * br * (3 - 2 * br);
    const rot = t * (0.05 + 0.03 * h(3)) * (h(4) < 0.5 ? 1 : -1);
    for (let k = 0; k < n; k++) {
      const a = rot + k * TAU / n + 0.6 * Math.sin(t * 0.07 + k * 2.1);
      out[k * 3] = Math.cos(a) * amp; out[k * 3 + 1] = Math.sin(t * 0.11 + k * 1.7) * amp * 0.22; out[k * 3 + 2] = Math.sin(a) * amp * 0.8;
    }
    return out;
  };
  // a shoal's: a slow loop round the middle of its water
  W.shoalTarget = function (seed, t, B, out) {
    const h = (k) => W.h(seed, k, 0x5f), R = B.r * (0.3 + 0.2 * h(1)), w = (0.25 + 0.15 * h(2)) * (h(3) < 0.5 ? 1 : -1);
    out[0] = B.x + R * Math.cos(w * t + TAU * h(4)); out[2] = B.z + R * Math.sin(w * t * 1.1 + TAU * h(4));
    out[1] = (B.y0 + B.y1) / 2 + (B.y1 - B.y0) * 0.25 * Math.sin(t * 0.3 + h(5) * TAU);
    return out;
  };

  // ---------------------------------------------------------------- the swarm (butterflies at home on a flower drift)
  // state: 0 flying to a flower · 1 sitting on it · 2 startled (rising, away from the eye)
  class Swarm {
    constructor(n, seed, home, flowers) {
      this.n = n; this.home = home; this.flowers = flowers && flowers.length ? flowers : [[home.x, home.y, home.z]];
      this.pos = new Float32Array(n * 3); this.vel = new Float32Array(n * 3); this.state = new Uint8Array(n);
      this.tgt = new Int32Array(n); this.timer = new Float32Array(n); this.phase = new Float32Array(n); this.kind = new Uint8Array(n); this.seedOf = new Float32Array(n);
      this.rand = W.rng(seed); this.time = 0;
      const R = this.rand, F = this.flowers;
      for (let i = 0; i < n; i++) {
        const k = Math.floor(R() * F.length) % F.length, f = F[k];
        this.tgt[i] = k; this.kind[i] = Math.floor(R() * 5) % 5; this.seedOf[i] = R() * 100; this.phase[i] = R() * TAU;
        if (R() < 0.5) { this.state[i] = 1; this.timer[i] = 1 + R() * 6; this.pos[i * 3] = f[0]; this.pos[i * 3 + 1] = f[1] + 0.55; this.pos[i * 3 + 2] = f[2]; }
        else { this.state[i] = 0; this.pos[i * 3] = f[0] + (R() - 0.5) * 3; this.pos[i * 3 + 1] = f[1] + 0.8 + R() * 1.2; this.pos[i * 3 + 2] = f[2] + (R() - 0.5) * 3; }
      }
    }
    // a new flower: mostly one near the last (a drift is worked through, not crossed at random)
    pick(i) {
      const R = this.rand, F = this.flowers, o = i * 3;
      let best = Math.floor(R() * F.length) % F.length;
      for (let t = 0; t < 3; t++) { const k = Math.floor(R() * F.length) % F.length; if (Math.hypot(F[k][0] - this.pos[o], F[k][2] - this.pos[o + 2]) < 4) { best = k; break; } }
      this.tgt[i] = best;
    }
    // eye: [x, y, z] (the eye's height: they rise only from a walk at their level); moving: the player walks
    step(dt, eye, moving) {
      if (!(dt > 0)) return;
      dt = Math.min(dt, 0.1); this.time += dt;
      const H = this.home, F = this.flowers, R = this.rand, T = this.time;
      for (let i = 0; i < this.n; i++) {
        const o = i * 3, s = this.seedOf[i];
        let x = this.pos[o], y = this.pos[o + 1], z = this.pos[o + 2];
        const ex = x - eye[0], ez = z - eye[2], ed = Math.hypot(ex, ez);
        if (this.state[i] !== 2 && moving && ed < 4 && Math.abs(y - (eye[1] - 1)) < 3) {
          this.state[i] = 2; this.timer[i] = 5 + R() * 4;
          const k = (1.4 + R()) / (ed + 0.3); this.vel[o] = ex * k; this.vel[o + 1] = 2.2 + R() * 0.8; this.vel[o + 2] = ez * k;
        }
        const st = this.state[i];
        if (st === 1) {   // on its flower: the wings open and close (wildlife.js reads the state)
          this.phase[i] += dt * 2.2;
          if ((this.timer[i] -= dt) <= 0) { this.state[i] = 0; this.pick(i); this.vel[o + 1] = 0.9; }
          continue;
        }
        this.phase[i] += dt * (st === 2 ? 30 : 22);
        if (st === 0) {
          const f = F[this.tgt[i]], tx = f[0] - x, ty = f[1] + 0.55 - y, tz = f[2] - z, d = Math.hypot(tx, ty, tz) + 1e-4;
          // the flutter: a steady pull to the flower and a wobble of their own (three sines)
          const sp = Math.min(1.5, 0.4 + d * 0.6);
          const wx = Math.sin(T * 3.1 + s) * 1.3 + Math.sin(T * 7.3 + s * 2) * 0.5, wy = Math.sin(T * 4.7 + s * 3) * 1.2 + (d > 1.2 ? 0.5 : 0), wz = Math.cos(T * 2.9 + s * 1.7) * 1.3;
          this.vel[o] += (tx / d * sp + wx - this.vel[o]) * Math.min(1, dt * 4);
          this.vel[o + 1] += (ty / d * sp + wy - this.vel[o + 1]) * Math.min(1, dt * 4);
          this.vel[o + 2] += (tz / d * sp + wz - this.vel[o + 2]) * Math.min(1, dt * 4);
          if (d < 0.32) { this.state[i] = 1; this.timer[i] = 2 + R() * 5; x = f[0]; y = f[1] + 0.55; z = f[2]; this.vel[o] = this.vel[o + 1] = this.vel[o + 2] = 0; }
        } else {          // startled: up and away, slowing, then back to a flower
          this.vel[o + 1] += (0.5 - this.vel[o + 1]) * Math.min(1, dt * 0.8);
          this.vel[o] += Math.sin(T * 5 + s) * 2 * dt; this.vel[o + 2] += Math.cos(T * 4.4 + s) * 2 * dt;
          if ((this.timer[i] -= dt) <= 0) { this.state[i] = 0; this.pick(i); }
        }
        x += this.vel[o] * dt; y += this.vel[o + 1] * dt; z += this.vel[o + 2] * dt;
        // home: soft back toward the drift, held within its reach and a few blocks over it
        const hx = x - H.x, hz = z - H.z, hd = Math.hypot(hx, hz), lim = H.r + 3.8;
        if (hd > H.r + 2) { this.vel[o] -= hx / hd * 3 * dt; this.vel[o + 2] -= hz / hd * 3 * dt; }
        if (hd > lim) { x = H.x + hx / hd * lim; z = H.z + hz / hd * lim; }
        y = Math.max(H.y + 0.15, Math.min(H.y + 5.8, y));
        this.pos[o] = x; this.pos[o + 1] = y; this.pos[o + 2] = z;
      }
    }
  }
  W.Swarm = Swarm;

  // ---------------------------------------------------------------- the schedule (ticks: 0 sunrise, 6000 noon, 12000 sunset)
  const tod = (t) => ((t % 24000) + 24000) % 24000;
  // the murmuration's phase: 'swirl' at dusk (from the golden hour), 'roost' (landing in the tree line), 'perch' through
  // the night, 'rise' at dawn, 'leave' (off over the land), 'off' by day
  W.murmPhase = function (t) {
    t = tod(t);
    if (t >= 10400 && t < 13400) return 'swirl';
    if (t >= 13400 && t < 14300) return 'roost';
    if (t >= 14300 && t < 22600) return 'perch';
    if (t >= 22600 || t < 1300) return 'rise';
    if (t < 1900) return 'leave';
    return 'off';
  };
  W.sched = function (seed, day, ticks) {
    const t = tod(ticks);
    void seed; void day;   // (the hours are the world's: seed and day choose the places — stageOf — not the hours)
    return {
      murm: W.murmPhase(t),
      gulls: t >= 300 && t < 11800,
      heron: t >= 23000 || t < 13000,
      bugs: t >= 600 && t < 11400,
      dfly: t >= 800 && t < 11000,
      rabbits: t >= 22800 || t < 13200,
      fox: t >= 10800 && t < 13800,
      deerLine: t >= 22300 || t < 1700,
      rays: true,
    };
  };
  // where the murmuration plays: over the lake when it is near (the same for every client near it), else over the land in
  // the eye's 256-block cell (a seeded spot of the cell: the same for everyone in it), another one each day. y: over the
  // lake its height; on land null (the game puts it 40 over the ground there)
  W.stageOf = function (seed, day, phase, eye, nearLake) {
    const d = (day | 0) * 2 + (phase === 'dawn' ? 1 : 0);
    if (nearLake) {
      const L = (VR.Land && VR.Land.LAKE) || { x: 345, z: 150 }, SEA = (VR.C && VR.C.SEA) || 63;
      // (low over the water: 20–26 blocks, well under the Sky Isles' rock — seen from the shores against the evening sky)
      return { x: L.x + (W.h(seed, d, 11) - 0.5) * 60, y: SEA + 20 + W.h(seed, d, 12) * 6, z: L.z + (W.h(seed, d, 13) - 0.5) * 44, lake: true };
    }
    const cx = Math.floor(eye[0] / 256), cz = Math.floor(eye[2] / 256);
    return { x: cx * 256 + 128 + (W.h(seed ^ cx, d, cz) - 0.5) * 120, y: null, z: cz * 256 + 128 + (W.h(seed ^ cz, d + 7, cx) - 0.5) * 120, lake: false };
  };

  // ---------------------------------------------------------------- the sky rays' circuit
  // RAY: the mesh's span is 1 (wingtip to wingtip); a great ray 15–22 of it, its young one beside it 0.6 of that; speed
  // blocks/s; the wing wave's period (s); the circuit's height (alt ± altA: under the isles' lowest rock, between them)
  W.RAY = { span: 1, minScale: 15, maxScale: 22, young: 0.6, speed: 5.4, period: 4.6, alt: 107, altA: 5, side: 4.5, up: 3, pairBack: 7, pairSide: 15 };
  // the rock of an island at a height: the widest it can be there (gen_realm islandShape at its worst: the warp's 1.28,
  // the underside's jag 1) — an inverted cone from y − 2 down to y − 2 − r·deep; up to the dome and the trees the full disc
  W.coneR = function (I, y) {
    const top = I.y - 2;
    if (y >= top) return y <= I.y + (I.dome || 4) + 10 ? I.r * 1.28 : 0;
    const u = (top - y) / (I.r * (I.deep || 1));
    return u >= 1 ? 0 : I.r * 1.28 * (1 - Math.pow(u, 4 / 3));
  };
  // the closed circuit round the centre isle: three lobes, a slow rise and fall, pushed clear of every isle's rock by the
  // ray's half span, its side drift and a margin, then smoothed. → {pts: [[x, y, z]], s: [arc length], L}
  W.rayLoop = function (isles) {
    const L0 = isles && isles.length ? isles : [];
    let C = L0.find(I => I.name === 'C') || L0[0];
    if (!C) C = { x: 330, z: 140, y: 158, r: 42, deep: 1 };
    const N = 120, pts = [], R = W.RAY, half = R.span * R.maxScale / 2, clear = half + R.side + R.pairSide + 4;
    for (let k = 0; k < N; k++) {
      const a = k / N * TAU;
      const r = 72 + 14 * Math.sin(3 * a + 0.6);
      pts.push([C.x + Math.cos(a) * r, R.alt + R.altA * Math.sin(2 * a + 1.1), C.z + Math.sin(a) * r]);
    }
    for (let pass = 0; pass < 6; pass++) {
      for (const q of pts) for (const I of L0) {
        const need = W.coneR(I, q[1]) + clear, dx = q[0] - I.x, dz = q[2] - I.z, d = Math.hypot(dx, dz) || 1e-3;
        if (need > clear && d < need) { q[0] = I.x + dx / d * need; q[2] = I.z + dz / d * need; }
      }
      // smooth (closed): each point toward its neighbours' mean
      for (let it = 0; it < 4; it++) {
        const cp = pts.map(q => q.slice());
        for (let k = 0; k < N; k++) { const a = cp[(k + N - 1) % N], b = cp[(k + 1) % N], q = pts[k]; q[0] = q[0] * 0.5 + (a[0] + b[0]) * 0.25; q[1] = q[1] * 0.5 + (a[1] + b[1]) * 0.25; q[2] = q[2] * 0.5 + (a[2] + b[2]) * 0.25; }
      }
    }
    // a last push without smoothing (the clearance holds exactly), then the arc lengths
    for (const q of pts) for (const I of L0) { const need = W.coneR(I, q[1]) + clear, dx = q[0] - I.x, dz = q[2] - I.z, d = Math.hypot(dx, dz) || 1e-3; if (need > clear && d < need) { q[0] = I.x + dx / d * need; q[2] = I.z + dz / d * need; } }
    const s = [0];
    for (let k = 1; k <= N; k++) { const a = pts[k - 1], b = pts[k % N]; s.push(s[k - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])); }
    return { pts, s, L: s[N], N };
  };
  // the point s along the circuit (wrapped), Catmull-Rom between the samples: out = [x, y, z, yaw, pitch, curvature]
  // (yaw: the heading as the models' — they face −z; curvature: the turn per block, + to the left)
  const cr = (a, b, c, d, t) => { const t2 = t * t, t3 = t2 * t; return 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3); };
  const at3 = (loop, s, o) => {
    const N = loop.N, L = loop.L, S = loop.s, P = loop.pts;
    s = ((s % L) + L) % L;
    let lo = 0, hi = N;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] <= s) lo = m; else hi = m; }
    const t = (s - S[lo]) / ((S[lo + 1] - S[lo]) || 1e-6);
    const a = P[(lo + N - 1) % N], b = P[lo % N], c = P[(lo + 1) % N], d = P[(lo + 2) % N];
    o[0] = cr(a[0], b[0], c[0], d[0], t); o[1] = cr(a[1], b[1], c[1], d[1], t); o[2] = cr(a[2], b[2], c[2], d[2], t);
    return o;
  };
  const T0 = [0, 0, 0], T1 = [0, 0, 0], T2 = [0, 0, 0];
  W.rayAt = function (loop, s, out) {
    at3(loop, s, out); at3(loop, s - 1.5, T0); at3(loop, s + 1.5, T1);
    const dx = T1[0] - T0[0], dy = T1[1] - T0[1], dz = T1[2] - T0[2], hl = Math.hypot(dx, dz) || 1e-6;
    out[3] = Math.atan2(-dx, -dz);
    out[4] = Math.atan2(dy, hl);
    at3(loop, s + 4.5, T2); at3(loop, s - 4.5, T0);
    const h0 = Math.atan2(out[2] - T0[2], out[0] - T0[0]), h1 = Math.atan2(T2[2] - out[2], T2[0] - out[0]);
    let dh = h1 - h0; if (dh > Math.PI) dh -= TAU; else if (dh < -Math.PI) dh += TAU;
    out[5] = dh / 4.5;
    return out;
  };
  // where ray k of n is at the world clock (s): out = [x, y, z, yaw, pitch, bank, phase, scale] — the same for every guest.
  // They fly in pairs: ray 2j a great one, ray 2j + 1 its young one gliding beside it (a little behind, to its right),
  // the pairs spread evenly round the circuit
  const RS = [0, 0, 0, 0, 0, 0];
  W.rayState = function (seed, clock, k, n, loop, out) {
    const R = W.RAY, L = loop.L, j = k >> 1, young = (k & 1) === 1, pairs = Math.max(1, (n + 1) >> 1);
    const s = clock * R.speed + j * L / pairs + W.h(seed, 0, 0x7a) * L - (young ? R.pairBack : 0);
    W.rayAt(loop, s, RS);
    // (the pair drifts as one: the leader's side and up drift; the young one its own small one on top)
    const side = R.side * Math.sin(clock * 0.05 + j * 1.7) + (young ? R.pairSide + 2.5 * Math.sin(clock * 0.21 + j) : 0);
    const up = R.up * Math.sin(clock * 0.07 + j * 2.3) + (young ? 1.2 * Math.sin(clock * 0.17 + 1 + j) : 0);
    // the side drift: across the heading (yaw: the model's −z is forward → its right is (cos yaw, −sin yaw) in x, z)
    const cy = Math.cos(RS[3]), sy = Math.sin(RS[3]);
    out[0] = RS[0] + cy * side; out[1] = RS[1] + up; out[2] = RS[2] - sy * side;
    // (the pitch: the circuit's climb and the up drift's; the bank: into the turn — a right turn, dh > 0 in x-z, dips the
    // right wing, a negative roll about the model's z)
    out[3] = RS[3]; out[4] = RS[4] + Math.atan(R.up * 0.07 * Math.cos(clock * 0.07 + j * 2.3) / R.speed);
    out[5] = Math.max(-0.55, Math.min(0.55, -RS[5] * 22));
    out[6] = clock * TAU / R.period + k * 1.9 + (young ? 0.8 : 0);
    const big = R.minScale + (R.maxScale - R.minScale) * W.h(seed, j, 0x5c);
    out[7] = young ? big * R.young : big;
    return out;
  };
})(typeof VR !== 'undefined' ? VR : (globalThis.VR = globalThis.VR || {}));
