// ============================================================================
// t-motion · WOW III · Alles bewegt sich (docs/superpowers/plans/2026-10-15-t-motion.md): the settings of the motion
// front and the small runtime pieces that do not belong to one older module. The three switches (game.js PRESETS):
//   motion       Wind in allem — the MOTION shaders (wind.js: the gust bands over the meadows, the lean of the plants,
//                the swing of the hung pieces, the palm fronds), the hung pieces' sway levels in the mesh and the new air
//                below; Very Low off
//   cloudShadow  Wolkenschatten — the cumulus' shadows drift over the land (clouds.js shadowMask, renderer u_cloudShadow);
//                where the clouds are sprites (Balanced and up)
//   wxDrama      Wetter-Drama — the storm's front, the bolts, the rain blown sideways, the rainbow after the rain, the
//                valley fog at dawn (weather.js); Very Low off
// The new air (MotionAir, through particles.js, `force` spawns under its own caps per tier — Very Low has the two
// cheapest: the smoke that bends with the wind, which spawns nothing new, and a little steam over the café's cups):
//   steam    wisps off the cups on the café tables (the hall city's terraces and its plaza: the plan's café seats face
//            their tables)
//   tmote    dust motes in the sunbeams under the trees: a point under a canopy that sees the sun through a gap
//   sparkle  glints on water along the sun's glitter path (the points whose mirror ray meets the sun)
//   leaf     leaves torn off and blown along when the wind is strong (the storm's front, weather.js)
//   splash   raindrops bursting on the ground round the eye while it rains
// ============================================================================
(function (VR) {
  'use strict';
  const S = VR.Settings;
  if (S && S.add) {
    S.add({ key: 'motion', g: 'img', sec: 'objects', t: 'switch', lab: 'g.set.motion', tip: 'g.set.motion.tip', cost: 'low', def: true });
    S.add({ key: 'cloudShadow', g: 'img', sec: 'objects', t: 'switch', lab: 'g.set.cloudShadow', tip: 'g.set.cloudShadow.tip', cost: 'low', def: true });
    S.add({ key: 'wxDrama', g: 'img', sec: 'objects', t: 'switch', lab: 'g.set.wxDrama', tip: 'g.set.wxDrama.tip', cost: 'low', def: true });
  }
  const M = VR.Motion = VR.Motion || {};
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

  // ---- a lamp's halo flickers gently: a warm flame (two sines, 0.8 … 1) or a cool tech light that breathes slowly (0.88 … 1);
  // h: the lamp's own phase (0..1, from its place), t seconds
  M.flicker = function (t, h, warm) {
    if (warm) return 0.9 + 0.06 * Math.sin(t * 7.3 + h * 11.0) + 0.04 * Math.sin(t * 13.7 + h * 5.0);
    return 0.94 + 0.06 * Math.sin(t * 1.3 + h * 6.283);
  };
  M.hash3 = function (x, y, z) { let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(z | 0, 0x9e3779b1); h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; return (h >>> 0) / 4294967296; };

  // ---- the new air's caps per tier (live particles of each kind at most): 0 Very Low · 1 Low · 2 Balanced · 3 High · 4 Ultra
  const KINDS = ['steam', 'tmote', 'sparkle', 'leaf', 'splash'];
  const CAPS = [
    { steam: 8, tmote: 0, sparkle: 0, leaf: 0, splash: 0 },
    { steam: 20, tmote: 24, sparkle: 16, leaf: 24, splash: 30 },
    { steam: 40, tmote: 60, sparkle: 36, leaf: 48, splash: 70 },
    { steam: 60, tmote: 90, sparkle: 56, leaf: 72, splash: 110 },
    { steam: 80, tmote: 120, sparkle: 80, leaf: 96, splash: 150 },
  ];
  // the life of each kind (s): the caps hold the spawn rate to cap / life a second
  const LIFE = { steam: 2.6, tmote: 6, sparkle: 0.12, leaf: 6, splash: 0.35 };
  M.AIR_KINDS = KINDS; M.AIR_CAPS = CAPS; M.AIR_LIFE = LIFE;
  M.budgetFor = function (tier) { const t = Math.max(0, Math.min(CAPS.length - 1, tier | 0)); return { tier: t, cap: Object.assign({}, CAPS[t]), kinds: KINDS.filter(k => CAPS[t][k] > 0) }; };

  // the sun's glitter: does the mirror ray of a view from `eye` to a water point at p meet the sun (within the waves' spread)?
  M.glitter = function (eye, p, sun, spread) {
    const vx = p[0] - eye[0], vy = p[1] - eye[1], vz = p[2] - eye[2], l = Math.hypot(vx, vy, vz) || 1;
    const d = (vx * sun[0] - vy * sun[1] + vz * sun[2]) / l;   // the reflected ray (vx, −vy, vz) against the sun
    return d >= Math.cos(spread === undefined ? 0.2 : spread);
  };

  class MotionAir {
    constructor(game) {
      this.g = game; this.tier = 2; this.on = true; this.time = 0;
      this.acc = { steam: 0, tmote: 0, sparkle: 0, leaf: 0, splash: 0 };
      this.drawn = { steam: 0, tmote: 0, sparkle: 0, leaf: 0, splash: 0 };   // spawns per kind (the tests read them)
      this.tables = []; this.tableT = 0;
      this.ms = 0;
      this.o = { life: 1, size: 0.1, grav: 0, drag: 0.5, col: [1, 1, 1], emis: 0, collide: false, fade: true, alpha: 1, grow: 0, wind: 0, turb: 0, force: true };
    }
    setOn(on, tier) { this.on = on !== false; if (tier !== undefined) this.tier = Math.max(0, Math.min(4, tier | 0)); }
    // the café tables within 40 blocks of the eye (from the hall cities' plans: a café seat faces its table), every 2 s
    findTables(eye) {
      const V = this.g.villages, out = [];
      if (V && V.known) for (const v of V.known.values()) {
        const P = v && v.plan; if (!P || !P.shops || Math.hypot(P.x - eye[0], P.z - eye[2]) > 260) continue;
        for (const sh of P.shops) if (sh && sh.kind === 'cafe' && sh.seats) for (const s of sh.seats) {
          const f = s[3] & 3, tx = s[0] + VR.HF_DX[f], tz = s[2] + VR.HF_DZ[f];
          if (Math.hypot(tx - eye[0], tz - eye[2]) > 40) continue;
          if (!out.some(t => t[0] === tx && t[2] === tz)) out.push([tx, s[1], tz]);
        }
      }
      out.sort((a, b) => Math.hypot(a[0] - eye[0], a[2] - eye[2]) - Math.hypot(b[0] - eye[0], b[2] - eye[2]));
      this.tables = out.slice(0, 16);
    }
    spawn(P, x, y, z, vx, vy, vz) { return P.spawn(x, y, z, vx, vy, vz, this.o); }
    // one frame: o = {w, eye, E, underwater, particles}; storm (0..1): the front's wind (weather.js), for the leaves
    update(dt, o) {
      if (!this.on || !o || !o.w || !o.particles || !(dt > 0)) return;
      const t0 = performance.now();
      dt = Math.min(dt, 0.1); this.time += dt;
      const P = o.particles, w = o.w, E = o.E || {}, eye = o.eye, cap = CAPS[this.tier], O = this.o, R = VR.R, F = VR.F;
      if (o.underwater || P.n > 3400) return;
      const sd = E.sunDir || [0, 1, 0], sunUp = sd[1] > 0.06 && (E.night || 0) < 0.4, rain = (E.rain || 0) > 0.05;
      const wd = E.windDir || [1, 0], wind = E.wind || 1;
      const outdoor = eye[1] > w.topAt(Math.floor(eye[0]), Math.floor(eye[2])) + 1.0;
      // ---- steam off the café's cups (every tier: Very Low too)
      if ((this.tableT -= dt) <= 0) { this.tableT = 2; this.findTables(eye); }
      if (cap.steam > 0 && this.tables.length) {
        this.acc.steam = Math.min(4, this.acc.steam + cap.steam / LIFE.steam * dt);
        for (let k = 0; k < 4 && this.acc.steam >= 1; k++) {
          const tb = this.tables[(Math.random() * this.tables.length) | 0];
          this.acc.steam -= 1; this.drawn.steam++;
          O.life = LIFE.steam * (0.8 + Math.random() * 0.4); O.size = 0.035 + Math.random() * 0.02; O.grav = -0.06; O.drag = 0.9; O.col = [0.96, 0.96, 0.98]; O.emis = 0.15; O.fade = true; O.alpha = 0.32; O.grow = 0.14; O.wind = 0.5; O.turb = 0.35;
          this.spawn(P, tb[0] + 0.35 + Math.random() * 0.3, tb[1] + 0.95, tb[2] + 0.35 + Math.random() * 0.3, (Math.random() - 0.5) * 0.04, 0.18 + Math.random() * 0.1, (Math.random() - 0.5) * 0.04);
        }
      }
      // ---- dust motes in the sunbeams under the trees (a canopy overhead, the sun seen through a gap)
      if (cap.tmote > 0 && sunUp && !rain) {   // (under the trees the eye is under the canopy: not 'outdoor' by the column's top)
        this.acc.tmote = Math.min(3, this.acc.tmote + cap.tmote / LIFE.tmote * dt);
        for (let k = 0; k < 6 && this.acc.tmote >= 1; k++) {
          const x = eye[0] + (Math.random() * 2 - 1) * 9, z = eye[2] + (Math.random() * 2 - 1) * 9, y = eye[1] - 1.5 + Math.random() * 4;
          const bx = Math.floor(x), by = Math.floor(y), bz = Math.floor(z);
          if (R.T.flags[w.getBlock(bx, by, bz)] & F.SOLID) continue;
          // under a canopy: leaves overhead here, or round it on three sides of four two blocks off (a point in a sunbeam
          // stands under the canopy's gap; one at the wood's edge in the open sun does not count)
          const leafy = (cx, cz) => { for (let u = 1; u <= 12; u++) if (R.T.flags[w.getBlock(cx, by + u, cz)] & F.LEAVES) return 1; return 0; };
          const canopy = leafy(bx, bz) === 1 || leafy(bx + 2, bz) + leafy(bx - 2, bz) + leafy(bx, bz + 2) + leafy(bx, bz - 2) >= 3;
          if (!canopy) { this.acc.tmote -= 0.25; continue; }
          let lit = true; for (let s = 0.75; s <= 30 && lit; s += 0.75) { const f = R.T.flags[w.getBlock(Math.floor(x + sd[0] * s), Math.floor(y + sd[1] * s), Math.floor(z + sd[2] * s))]; if ((f & F.OPAQUE) || (f & F.LEAVES)) lit = false; }
          if (!lit) { this.acc.tmote -= 0.25; continue; }
          this.acc.tmote -= 1; this.drawn.tmote++;
          O.life = LIFE.tmote * (0.7 + Math.random() * 0.6); O.size = 0.016 + Math.random() * 0.012; O.grav = 0; O.drag = 0.4; O.col = [1.0, 0.95, 0.8]; O.emis = 1; O.fade = true; O.alpha = 1; O.grow = 0; O.wind = 0.08; O.turb = 0.04;
          this.spawn(P, x, y, z, (Math.random() - 0.5) * 0.06, (Math.random() - 0.5) * 0.03, (Math.random() - 0.5) * 0.06);
        }
      } else this.acc.tmote = 0;
      // ---- sparkle on water along the sun's glitter path
      if (cap.sparkle > 0 && sunUp && outdoor) {
        const sl = Math.hypot(sd[0], sd[2]) || 1, ax = sd[0] / sl, az = sd[2] / sl;
        this.acc.sparkle = Math.min(6, this.acc.sparkle + cap.sparkle / LIFE.sparkle * dt);
        for (let k = 0; k < 10 && this.acc.sparkle >= 1; k++) {
          const dist = 3 + Math.pow(Math.random(), 1.6) * 70, lat = (Math.random() * 2 - 1) * (1 + dist * 0.18);
          const x = eye[0] + ax * dist - az * lat, z = eye[2] + az * dist + ax * lat;
          const bx = Math.floor(x), bz = Math.floor(z), top = w.topAt(bx, bz), s = w.getBlock(bx, top, bz);
          this.acc.sparkle -= 0.34;
          if (!s || !(R.T.flags[s] & F.WATER)) continue;
          const p = [x, top + 0.9, z];
          if (!M.glitter(eye, p, sd, 0.18)) continue;
          this.acc.sparkle -= 0.66; this.drawn.sparkle++;
          const b = 1.6 + Math.random() * 1.6;
          O.life = LIFE.sparkle * (0.5 + Math.random()); O.size = 0.05 + dist * 0.0025 + Math.random() * 0.04; O.grav = 0; O.drag = 0; O.col = [b, b * 0.97, b * 0.88]; O.emis = 1; O.fade = false; O.alpha = 1; O.grow = 0; O.wind = 0; O.turb = 0;
          this.spawn(P, p[0], p[1], p[2], 0, 0, 0);
        }
      } else this.acc.sparkle = 0;
      // ---- leaves torn off in a strong wind (the storm's front): they fly with the wind, tumbling
      const storm = clamp01(((E.wind || 1) - 1.6) / 1.2) * (o.drama === false ? 0 : 1);
      if (cap.leaf > 0 && outdoor && storm > 0.05 && (E.snow || 0) < 0.1) {
        this.acc.leaf = Math.min(4, this.acc.leaf + cap.leaf / LIFE.leaf * dt * storm);
        for (let k = 0; k < 4 && this.acc.leaf >= 1; k++) {
          this.acc.leaf -= 1; this.drawn.leaf++;
          const x = eye[0] - wd[0] * 14 + (Math.random() * 2 - 1) * 14, z = eye[2] - wd[1] * 14 + (Math.random() * 2 - 1) * 14, y = eye[1] + 1 + Math.random() * 7;
          const c = Math.random() < 0.5 ? [0.36, 0.5, 0.14] : [0.62, 0.4, 0.12];
          O.life = LIFE.leaf * (0.7 + Math.random() * 0.6); O.size = 0.07 + Math.random() * 0.05; O.grav = 0.7; O.drag = 0.9; O.col = c; O.emis = 0; O.fade = false; O.alpha = 1; O.grow = 0; O.wind = 1.4; O.turb = 2.2;
          this.spawn(P, x, y, z, wd[0] * wind * 2, 0.5 + Math.random(), wd[1] * wind * 2);
        }
      } else this.acc.leaf = 0;
      // ---- raindrops bursting on the ground round the eye (the ground's top under the open sky)
      if (cap.splash > 0 && rain && outdoor && (E.snow || 0) < 0.1) {
        this.acc.splash = Math.min(8, this.acc.splash + cap.splash / LIFE.splash * dt * clamp01(E.rain));
        for (let k = 0; k < 12 && this.acc.splash >= 1; k++) {
          this.acc.splash -= 1;
          const x = eye[0] + (Math.random() * 2 - 1) * 11, z = eye[2] + (Math.random() * 2 - 1) * 11, top = w.topAt(Math.floor(x), Math.floor(z));
          if (Math.abs(top - eye[1]) > 12) continue;
          this.drawn.splash++;
          O.life = LIFE.splash * (0.6 + Math.random() * 0.6); O.size = 0.035 + Math.random() * 0.03; O.grav = 9; O.drag = 0.6; O.col = [0.78, 0.84, 0.92]; O.emis = 0.2; O.fade = true; O.alpha = 0.8; O.grow = 0; O.wind = 0; O.turb = 0;
          for (let q = 0; q < 2; q++) { const a = Math.random() * 6.283; this.spawn(P, x, top + 1.02, z, Math.cos(a) * 0.9, 1.2 + Math.random() * 0.9, Math.sin(a) * 0.9); }
        }
      } else this.acc.splash = 0;
      this.ms = this.ms * 0.9 + (performance.now() - t0) * 0.1;
    }
  }
  VR.MotionAir = MotionAir;
})(VR);
