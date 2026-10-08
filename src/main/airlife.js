// ============================================================================
// Living air (F3 · Da-Sein): dust motes in the sunbeams indoors, pollen over the meadows by day, fireflies in the grass
// at night, leaves falling under a canopy in the wind, snow that settles on the ground, a flock of birds now and then,
// butterflies over the flowers. All of it goes through the existing particle system (particles.js, `force` spawns), and
// each kind has a cap per tier: Very Low (potato) has fireflies and snow only. Birds, butterflies and fireflies are
// agents: their motion is computed here and they are spawned again every frame with a life of 1.5 frames, so each one
// is drawn once per frame and nothing is left alive between frames.
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R, F = VR.F;
  const KINDS = ['mote', 'pollen', 'firefly', 'leaf', 'snow', 'butterfly', 'bird'];
  // the most live particles (or agents) of each kind, per tier: 0 Very Low · 1 Low · 2 Balanced · 3 High · 4 Ultra
  const CAPS = [
    { mote: 0, pollen: 0, firefly: 12, leaf: 0, snow: 48, butterfly: 0, bird: 0 },
    { mote: 36, pollen: 40, firefly: 16, leaf: 16, snow: 64, butterfly: 6, bird: 5 },
    { mote: 80, pollen: 80, firefly: 28, leaf: 32, snow: 110, butterfly: 12, bird: 9 },
    { mote: 120, pollen: 120, firefly: 40, leaf: 48, snow: 160, butterfly: 18, bird: 18 },
    { mote: 160, pollen: 160, firefly: 56, leaf: 64, snow: 200, butterfly: 24, bird: 27 },
  ];
  const PRESET_TIER = { potato: 0, low: 1, balanced: 2, high: 3, ultra: 4 };
  // the tier of a settings object: its preset, or for a custom setup its particle level (0 · 1 · 2)
  function tierOf(S) {
    if (!S) return 2;
    if (PRESET_TIER[S.preset] !== undefined) return PRESET_TIER[S.preset];
    const p = Number.isFinite(S.particles) ? Math.round(S.particles) : 2;
    return Math.max(0, Math.min(2, p));
  }
  // the budget of a tier: the caps and the kinds that are on at all (a cap of 0 is off)
  function budgetFor(tier) {
    const t = Math.max(0, Math.min(CAPS.length - 1, tier | 0));
    const cap = Object.assign({}, CAPS[t]);
    return { tier: t, cap, kinds: KINDS.filter(k => cap[k] > 0) };
  }

  // ---- block names by type id (built once from the registry): flowers, grass
  const FLOWER = /flower|tulip|poppy|dandelion|allium|bluet|cornflower|lavender|lilac|orchid|lily_of|rose|sunflower|peony|daisy|oxeye/;
  const NOT_PLANT = /pot|block|bouquet|crystal|lilacite|leaves|stem|sapling|petal|pillar/;
  const GRASS = /^(grass_block|moss_block|grass|short_grass)$/;
  const masks = {};
  function typeIs(key, re, t) {
    let m = masks[key];
    if (!m) {
      m = masks[key] = new Uint8Array(R.types.length);
      for (let i = 0; i < R.types.length; i++) { const ty = R.types[i]; if (ty && re.test(ty.name) && (key !== 'flower' || !NOT_PLANT.test(ty.name))) m[i] = 1; }
    }
    return t < m.length && m[t] === 1;
  }
  const isFlower = (w, x, y, z) => typeIs('flower', FLOWER, R.T.type[w.getBlock(x, y, z)]);
  const isGrass = (w, x, y, z) => typeIs('grass', GRASS, R.T.type[w.getBlock(x, y, z)]);

  // a point in the air the sun reaches although it is under a roof: a sunbeam through a window or a hole. Null when the
  // point is outdoors (the sky is above it), or when a solid block stands between it and the sun.
  function sunPoint(w, ex, ey, ez, sd) {
    const x = ex + (Math.random() * 2 - 1) * 7, z = ez + (Math.random() * 2 - 1) * 7, y = ey + (Math.random() * 2 - 1) * 2.5;
    const top = w.topAt(Math.floor(x), Math.floor(z));
    if (!(y < top + 0.5)) return null;
    const T = R.T.flags;
    for (let s = 0.5; s < 48; s += 0.5) {
      const b = w.getBlock(Math.floor(x + sd[0] * s), Math.floor(y + sd[1] * s), Math.floor(z + sd[2] * s));
      if (T[b] & F.OPAQUE) return null;
    }
    return [x, y, z];
  }

  const PALETTE_BUTTERFLY = [[1.0, 0.78, 0.25], [0.95, 0.5, 0.85], [0.55, 0.8, 1.0], [1.0, 0.55, 0.2]];
  const PALETTE_LEAF = [[0.55, 0.3, 0.1], [0.7, 0.45, 0.12], [0.42, 0.5, 0.16], [0.62, 0.25, 0.08]];
  const d2 = (x, z, eye) => (x - eye[0]) ** 2 + (z - eye[2]) ** 2;   // squared ground distance from the eye

  class AirLife {
    constructor(game) {
      this.game = game;
      this.tier = 2; this.on = true; this.time = 0;
      this.acc = { mote: 0, pollen: 0, leaf: 0, snow: 0 };
      this.ff = []; this.bf = []; this.flocks = []; this.flowers = []; this.flowerT = 0; this.birdT = 25;
      this.ms = 0;            // the CPU time of an update (a moving average, ms): the cost the test reads
    }
    setOn(on, tier) {
      this.on = on !== false;
      if (tier !== undefined) this.tier = Math.max(0, Math.min(4, tier | 0));
      if (!this.on) { this.ff.length = 0; this.bf.length = 0; this.flocks.length = 0; }
    }
    birds() { let n = 0; for (const f of this.flocks) n += f.n; return n; }
    // one frame: o = {w (world), eye ([x,y,z]), E (environment), underwater, particles}; call before particles.update
    update(dt, o) {
      if (!this.on || !o || !o.w || !o.particles || !(dt > 0)) return;
      const t0 = performance.now();
      dt = Math.min(dt, 0.1);
      this.time += dt;
      const P = o.particles, w = o.w, E = o.E || {}, eye = o.eye, cap = CAPS[this.tier];
      if (o.underwater || P.n > 3400) { this.ff.length = 0; this.bf.length = 0; this.flocks.length = 0; return; }
      const ex = Math.floor(eye[0]), ez = Math.floor(eye[2]);
      const outdoor = eye[1] > w.topAt(ex, ez) + 1.0;          // the sky is above the eye (not under a roof)
      const sd = E.sunDir || [0, 1, 0];
      const sunUp = sd[1] > 0.12 && (E.night || 0) < 0.3;      // a day with the sun up
      const rain = (E.rain || 0) > 0.05, snow = E.snow || 0;
      const wind = E.wind || 1, dir = E.windDir || [1, 0];
      const spawn = (x, y, z, vx, vy, vz, col, size, o2) => P.spawn(x, y, z, vx, vy, vz, Object.assign({ col, size, force: true }, o2));

      // ---- dust motes in the sunbeams indoors (stateful: they drift about 6 s)
      if (sunUp && !rain && cap.mote > 0 && !outdoor) {
        this.acc.mote = Math.min(3, this.acc.mote + cap.mote / 6 * dt);
        for (let k = 0; k < 6 && this.acc.mote >= 1; k++) {
          const p = sunPoint(w, eye[0], eye[1], eye[2], sd);
          if (!p) continue;
          this.acc.mote -= 1;
          spawn(p[0], p[1], p[2], (Math.random() - 0.5) * 0.1 + dir[0] * wind * 0.02, (Math.random() - 0.5) * 0.04, (Math.random() - 0.5) * 0.1 + dir[1] * wind * 0.02,
            [1.0, 0.96, 0.82], 0.03 + Math.random() * 0.025, { life: 6 + Math.random() * 3, grav: 0, drag: 0.4, emis: 0.6, collide: false, fade: true });
        }
      } else this.acc.mote = 0;

      // ---- pollen over the meadows by day (stateful, about 7 s)
      if (sunUp && !rain && cap.pollen > 0 && outdoor) {
        this.acc.pollen = Math.min(4, this.acc.pollen + cap.pollen / 7 * dt);
        for (let k = 0; k < 6 && this.acc.pollen >= 1; k++) {
          const x = eye[0] + (Math.random() * 2 - 1) * 9, z = eye[2] + (Math.random() * 2 - 1) * 9;
          const top = w.topAt(Math.floor(x), Math.floor(z));
          if (!isGrass(w, Math.floor(x), top, Math.floor(z))) continue;
          this.acc.pollen -= 1;
          spawn(x, top + 1 + Math.random() * 1.6, z, dir[0] * wind * 0.25 + (Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.05, dir[1] * wind * 0.25 + (Math.random() - 0.5) * 0.12,
            [1.0, 0.93, 0.5], 0.03 + Math.random() * 0.02, { life: 5 + Math.random() * 4, grav: 0.05, drag: 0.5, emis: 0.15, collide: false });
        }
      } else this.acc.pollen = 0;

      // ---- falling leaves under a canopy in the wind (stateful: they land and stay for a while)
      if (outdoor && !rain && cap.leaf > 0 && wind > 1.15 && snow < 0.1) {
        this.acc.leaf = Math.min(4, this.acc.leaf + cap.leaf / 6 * dt);
        for (let k = 0; k < 4 && this.acc.leaf >= 1; k++) {
          const x = eye[0] + (Math.random() * 2 - 1) * 11, z = eye[2] + (Math.random() * 2 - 1) * 11;
          const fx = Math.floor(x), fz = Math.floor(z), top = w.topAt(fx, fz);
          if (!(R.T.flags[w.getBlock(fx, top, fz)] & F.LEAVES) || top < eye[1] + 2) continue;   // a canopy above
          const y = eye[1] + 0.5 + Math.random() * (top - eye[1] - 1.5);
          if (R.T.flags[w.getBlock(fx, Math.floor(y), fz)] & F.SOLID) continue;
          this.acc.leaf -= 1;
          const pc = PALETTE_LEAF[(Math.random() * PALETTE_LEAF.length) | 0];
          spawn(x, y, z, dir[0] * wind * 1.4 + (Math.random() - 0.5), -0.3, dir[1] * wind * 1.4 + (Math.random() - 0.5), pc, 0.09 + Math.random() * 0.05,
            { life: 8 + Math.random() * 4, grav: 0.9, drag: 1.3, collide: true, fade: false });
        }
      } else this.acc.leaf = 0;

      // ---- snow that settles: flakes fall slowly, drift with the wind and stay where they land
      if (outdoor && snow > 0.12 && cap.snow > 0) {
        this.acc.snow = Math.min(6, this.acc.snow + cap.snow / 9 * snow * dt);
        for (let k = 0; k < 8 && this.acc.snow >= 1; k++) {
          this.acc.snow -= 1;
          const x = eye[0] + (Math.random() * 2 - 1) * 16, z = eye[2] + (Math.random() * 2 - 1) * 16, y = eye[1] + 5 + Math.random() * 8;
          spawn(x, y, z, dir[0] * wind * 0.7 + (Math.random() - 0.5) * 0.4, -0.5 - Math.random() * 0.4, dir[1] * wind * 0.7 + (Math.random() - 0.5) * 0.4,
            [0.96, 0.97, 1.0], 0.05 + Math.random() * 0.03, { life: 12, grav: 1.6, drag: 1.1, collide: true, fade: false });
        }
      } else this.acc.snow = 0;

      // ---- fireflies in the grass at night (agents: they blink, with a little wander)
      if (outdoor && (E.night || 0) > 0.55 && !rain && cap.firefly > 0) {
        if (this.ff.length < cap.firefly && Math.random() < dt * 5) {
          const x = eye[0] + (Math.random() * 2 - 1) * 14, z = eye[2] + (Math.random() * 2 - 1) * 14, top = w.topAt(Math.floor(x), Math.floor(z));
          if (isGrass(w, Math.floor(x), top, Math.floor(z))) this.ff.push({ x, y: top + 1.2 + Math.random() * 1.6, z, ph: Math.random() * 6.28, fr: 1.2 + Math.random() * 1.0, wx: (Math.random() - 0.5) * 0.4, wz: (Math.random() - 0.5) * 0.4, life: 10 + Math.random() * 8 });
        }
      }
      for (let i = this.ff.length - 1; i >= 0; i--) {
        const f = this.ff[i];
        f.life -= dt;
        if (f.life <= 0 || d2(f.x, f.z, eye) > 26 * 26) { this.ff.splice(i, 1); continue; }
        const s = this.time * 0.31 + f.ph;
        f.x += (Math.sin(s) * 0.35 + f.wx) * dt; f.z += (Math.cos(s * 1.1) * 0.35 + f.wz) * dt; f.y += Math.sin(this.time * 0.7 + f.ph) * 0.12 * dt;
        const b = Math.pow(Math.max(0, Math.sin(this.time * f.fr + f.ph)), 10);   // on for a moment, then dark
        if (b > 0.04) spawn(f.x, f.y, f.z, 0, 0, 0, [0.85 * b * 0.7, 1.0 * b * 0.7, 0.35 * b * 0.7], 0.08, { life: dt * 1.5 + 1e-4, grav: 0, drag: 0, emis: 1, collide: false, fade: false });
      }

      // ---- butterflies over the flowers by day (agents: they wander around a flower)
      if (sunUp && outdoor && !rain && cap.butterfly > 0) {
        this.flowerT -= dt;
        if (this.flowerT <= 0) {
          this.flowerT = 1.5;
          this.flowers = this.flowers.filter(f => d2(f.x, f.z, eye) < 14 * 14);
          for (let k = 0; k < 40 && this.flowers.length < 14; k++) {
            const x = Math.floor(eye[0] + (Math.random() * 2 - 1) * 12), z = Math.floor(eye[2] + (Math.random() * 2 - 1) * 12);
            const top = w.topAt(x, z);
            if (isFlower(w, x, top + 1, z)) this.flowers.push({ x: x + 0.5, y: top + 1.2, z: z + 0.5 });
          }
        }
        if (this.bf.length < cap.butterfly && this.flowers.length && Math.random() < dt * 1.2) {
          const h = this.flowers[(Math.random() * this.flowers.length) | 0];
          this.bf.push({ hx: h.x, hy: h.y, hz: h.z, ph: Math.random() * 6.28, sp: 0.5 + Math.random() * 0.5, col: PALETTE_BUTTERFLY[(Math.random() * PALETTE_BUTTERFLY.length) | 0], life: 14 + Math.random() * 10 });
        }
      }
      for (let i = this.bf.length - 1; i >= 0; i--) {
        const b = this.bf[i];
        b.life -= dt;
        if (b.life <= 0 || !sunUp || rain) { this.bf.splice(i, 1); continue; }
        const t = this.time * b.sp + b.ph;
        const x = b.hx + Math.sin(t * 1.3) * 1.8 + Math.cos(t * 0.5) * 0.8, z = b.hz + Math.cos(t * 1.1) * 1.8;
        const y = b.hy + 0.6 + Math.sin(t * 2.7) * 0.35 + Math.sin(t * 0.6) * 0.4;
        spawn(x, y, z, 0, 0, 0, b.col.map(c => c * 0.9), 0.13, { life: dt * 1.5 + 1e-4, grav: 0, drag: 0, emis: 0.25, collide: false, fade: false });
      }

      // ---- a flock of 5–9 birds crossing the sky now and then (agents in a V; the wings flap)
      if (outdoor && sunUp && !rain && snow < 0.05 && cap.bird > 0) {
        this.birdT -= dt;
        const n = 5 + Math.floor(Math.random() * 5);
        if (this.birdT <= 0 && this.birds() + n <= cap.bird) {
          this.birdT = 50 + Math.random() * 70;
          const a = Math.random() * Math.PI * 2, Dx = Math.cos(a), Dz = Math.sin(a);
          this.flocks.push({ x: eye[0] - Dx * 75, y: eye[1] + 22 + Math.random() * 18, z: eye[2] - Dz * 75, dx: Dx, dz: Dz, speed: 9 + Math.random() * 3, n, ph: Math.random() * 6.28, life: 26 });
        }
      } else if (!sunUp || rain) this.flocks.length = 0;
      for (let fi = this.flocks.length - 1; fi >= 0; fi--) {
        const fl = this.flocks[fi];
        fl.life -= dt;
        if (fl.life <= 0) { this.flocks.splice(fi, 1); continue; }
        fl.x += fl.dx * fl.speed * dt; fl.z += fl.dz * fl.speed * dt;
        const Rx = -fl.dz, Rz = fl.dx;
        for (let i = 0; i < fl.n; i++) {
          const li = i - (fl.n - 1) / 2, ai = Math.abs(li);
          const bx = fl.x + Rx * li * 1.7 - fl.dx * ai * 1.1, bz = fl.z + Rz * li * 1.7 - fl.dz * ai * 1.1, by = fl.y + 0.25 * ai;
          const flap = Math.sin(this.time * 8 + i * 0.9 + fl.ph) * 0.45;
          const col = [0.1, 0.1, 0.12];
          spawn(bx, by, bz, 0, 0, 0, col, 0.8, { life: dt * 1.5 + 1e-4, grav: 0, drag: 0, emis: 0, collide: false, fade: false });
          spawn(bx + Rx * 0.55, by + flap, bz + Rz * 0.55, 0, 0, 0, col, 0.55, { life: dt * 1.5 + 1e-4, grav: 0, drag: 0, emis: 0, collide: false, fade: false });
          spawn(bx - Rx * 0.55, by + flap, bz - Rz * 0.55, 0, 0, 0, col, 0.55, { life: dt * 1.5 + 1e-4, grav: 0, drag: 0, emis: 0, collide: false, fade: false });
        }
      }
      const ms = performance.now() - t0;
      this.ms = this.ms * 0.9 + ms * 0.1;
    }
  }
  VR.AirLife = Object.assign(AirLife, { KINDS, CAPS, tierOf, budgetFor });
})(VR);
