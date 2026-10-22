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
//   veil     light motes drifting out of the portal veils (the gate, the hangar's mouth, the station) onto the floor
// The living landmarks (step 5) keep their numbers here too: the citadel beam's pulse and ring (vents.js), the
// watchtower ring's running lights (vents.js), the veil's ripples and the holo screens' cycle (the shaders' MOTION
// blocks), the trams' lights and sparks (trams.js).
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
  // the halo itself (particles.js lampGlows, Balanced and up): a soft disc round the lamp's head, wider than the head (the
  // third browser run: the 0.44-block disc sat inside the cyan lamps' heads and never showed) and thin, so it reads as the
  // light in the air round the lamp, not a ball
  // (v0.48, the merged build's night pictures: with t-light2's night level the halo came out a hard white ball — the lamp's
  // colour times the flicker, times the particles' emissive ×4; now no emissive boost and a gentler disc: it never saturates)
  // (t-polish2, gap 2: the vista balconies' four small lanterns each wore a 2-block disc — as big as their post is tall —
  // and drew the eye from the landmark: a small lantern, a candle, a torch, a sconce, a bollard's head keeps `small` of
  // the size (particles.js Particles.HALO_SMALL); the lamp posts' heads the full size)
  M.HALO = { size: 1.0, alpha: 0.36, emis: 0, gain: 0.9, small: 0.6 };
  M.hash3 = function (x, y, z) { let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(z | 0, 0x9e3779b1); h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; return (h >>> 0) / 4294967296; };

  // ---- the rainbow (Wetter-Drama; the sky shader's WXDRAMA block, the same numbers): th degrees from the antisolar point.
  // The primary from 40.6° (violet) to 42.4° (red outside), the secondary from 50.1° (red inside) to 53° (violet), 0.38 of
  // the primary's strength; the sky inside the primary a little brighter, Alexander's dark band between the two
  const BOWG = M.BOW = { p1: [40.6, 1.8], p2: [53.0, 2.9], k2: 0.38, inside: [38.0, 40.8], alex: [42.2, 43.5, 49.0, 50.2], hueSpan: 0.78 };
  const ssm = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const hue = (p) => { const h = (1 - clamp01(p)) * BOWG.hueSpan * 6; return [0, 4, 2].map(o => clamp01(Math.abs(((h + o) % 6) - 3) - 1)); };
  M.rainbowAt = function (th) {
    const p1 = (th - BOWG.p1[0]) / BOWG.p1[1], p2 = (BOWG.p2[0] - th) / BOWG.p2[1];
    const b1 = ssm(0, 0.18, p1) * (1 - ssm(0.82, 1, p1)), b2 = ssm(0, 0.18, p2) * (1 - ssm(0.82, 1, p2)) * BOWG.k2;
    const h1 = hue(p1), h2 = hue(p2);
    return { r: h1[0] * b1 + h2[0] * b2, g: h1[1] * b1 + h2[1] * b2, b: h1[2] * b1 + h2[2] * b2, b1, b2, inside: 1 - ssm(BOWG.inside[0], BOWG.inside[1], th), alex: ssm(BOWG.alex[0], BOWG.alex[1], th) * (1 - ssm(BOWG.alex[2], BOWG.alex[3], th)) };
  };

  // ---- the falls' mist column (landlife.js: the land's falls, the 'mist' spawns at their foot; with Wind in allem): puffs a
  // second per unit of the spawn's strength (Low, Balanced+), their spread, rise (blocks/s), life (s), size and growth
  // (blocks, blocks/s), opacity, turbulence and wind (particles.js), and the chance of a spray droplet with each (not Low)
  M.FALLS = { rate: [4, 10], spread: 2.8, vy: [1.0, 2.2], life: [3.2, 4.8], size: [0.7, 1.3], grow: 0.9, alpha: 0.55, turb: 1.6, wind: 0.15, spray: 0.5 };
  // ---- the storm's look (Wetter-Drama: the sky shader, the puff clouds and env.js use these numbers; the third browser run
  // showed the storm's side black and its clouds white against it): the sky darkens by front·(d0 + d1·side + d2·wall) — at
  // most 0.7, a deep slate, never black — its colour drained toward a cool grey (slate) by front·drain; a storm's clouds
  // (the front, or the rain) go a slate grey (cloud, by cloudK), dim at night, and the bolt's flash lights them from within
  // (flash: most round its heading and on their bases); the far land's haze darkens by fog·front (half of it before the
  // rain, all of it in the rain), a little cooler (fogTint), so the hills stand dark against the bolt's sky
  const STORM = M.STORM = { d: [0.22, 0.3, 0.18], drain: 0.55, slate: [0.78, 0.86, 1.0], cloud: [0.16, 0.18, 0.22], cloudK: 0.82, flash: [0.7, 0.72, 0.95], fog: 0.45, fogTint: [0.92, 0.96, 1.04] };
  M.stormSky = function (front, side, wall) { return 1 - clamp01(front) * (STORM.d[0] + STORM.d[1] * clamp01(side) + STORM.d[2] * clamp01(wall)); };
  M.stormFog = function (fog, front, rain, out) { const k = clamp01(front) * (0.5 + 0.5 * clamp01(rain)) * STORM.fog, o = out || [0, 0, 0]; for (let i = 0; i < 3; i++) o[i] = fog[i] * (1 - k) * (1 + (STORM.fogTint[i] - 1) * k); return o; };

  // ---- step 5 · the living landmarks (vents.js, trams.js and the shaders' MOTION blocks use these numbers; Low and up)
  // the citadel's beam breathes on a 4 s cycle (pulse 0 … 1): its stream runs at 0.45 + 1.1·pulse of the old 46 sparks a
  // second — the same number on average — brighter at the peak, and at each peak a ring of sparks shoots up the beam
  const BEAM = M.BEAM = { period: 4, rate: [0.45, 1.1], bright: [0.75, 0.5], ring: 24, ringR: 1.8, ringV: 26, ringOut: 2.2, ringLife: 3.2 };
  M.beamPulse = function (t) { const ph = ((t / BEAM.period) % 1 + 1) % 1; return 0.5 - 0.5 * Math.cos(ph * 2 * Math.PI); };
  // the watchtower's saucer ring (gen_citadel.js watchTower: its widest rows an octagon of 10 — max(|dx|, |dz|,
  // (|dx| + |dz|)·0.7071) ≤ 10, the outer faces at 10.5 —, 27 and 28 under the tip beacon's spawn): RING.n running lights
  // RING.off outside its rim at the window row, a chase of RING.speed lights a second, each glowing on for RING.tail s
  // (a fading tail of four)
  const RING = M.RING = { n: 16, oct: 10.5, off: 0.5, dy: -27, speed: 6, tail: 0.7, size: 0.55, col: [0.5, 1.4, 1.6] };
  M.ringHead = function (t, h) { return Math.floor(t * RING.speed + (h || 0) * RING.n) % RING.n; };
  M.ringLight = function (k, bx, by, bz, out) {
    const a = k / RING.n * 2 * Math.PI, c = Math.cos(a), s = Math.sin(a), o = out || [0, 0, 0];
    const r = RING.oct / Math.max(Math.abs(c), Math.abs(s), (Math.abs(c) + Math.abs(s)) * 0.7071) + RING.off;   // (the octagon's rim at this angle)
    o[0] = bx + 0.5 + c * r; o[1] = by + RING.dy + 0.5; o[2] = bz + 0.5 + s * r; return o;
  };
  // the portal veil (TRANS_FS, MOTION): rings run out from its middle to its rim — rd is a point's distance to the rim, so
  // the crests of sin(rd·k + t·w) move outward at w/k blocks a second — bright where the veil is clear (rd past rd0 … rd1),
  // and its energy breathes (b0 + b1·sin(t·bw))
  const VEIL = M.VEIL = { k: 3.2, w: 2.2, lo: 0.55, rd0: 0.9, rd1: 2.4, amp: 0.3, b0: 0.9, b1: 0.1, bw: 1.7 };
  M.veilRipple = function (rd, t) { return ssm(VEIL.lo, 1, Math.sin(rd * VEIL.k + t * VEIL.w)) * ssm(VEIL.rd0, VEIL.rd1, rd); };
  // the holo screens (TERRAIN_FS, MOTION): every 9 s a 3 × 3 m panel switches between the radar, the map and the readouts;
  // a scan line wipes down it in 0.6 s (above the line the new picture, below the old one); each panel keeps its phase (hc)
  const HOLO = M.HOLO = { period: 9, phase: 2.7, wipe: 5.0, modes: 3 };
  M.holoMode = function (t, hc, dy) {
    const cyc = t / HOLO.period + hc * HOLO.phase, cf = (cyc - Math.floor(cyc)) * HOLO.period, wy = 1.5 - cf * HOLO.wipe;
    return ((Math.floor(cyc) - (dy > wy ? 0 : 1)) % HOLO.modes + HOLO.modes) % HOLO.modes;
  };
  // the light lines run (TERRAIN_FS, MOTION, with Animierte Anzeigen): a bright packet travels along every upward light —
  // the plazas' floor lines, the tiers' light bars, the landing strip's bars — one every 1/k blocks along x + z at w/k
  // blocks a second (a line along x or along z carries its packets along itself), the rest a little dimmer: b0 + b1·e^(−q²),
  // q the distance from the packet in its widths (sharp); the mean stays the old light (b0 + b1·√π/sharp ≈ 0.99)
  const FLOW = M.FLOW = { k: 0.0625, w: 0.5, sharp: 12, b0: 0.9, b1: 0.6 };
  M.flowLight = function (s, t) { const p = s * FLOW.k - t * FLOW.w, q = (p - Math.floor(p) - 0.5) * FLOW.sharp; return FLOW.b0 + FLOW.b1 * Math.exp(-q * q); };
  // the trams at dusk and night: the leading nose white, the trailing one red, the four window bays of each side lit; the
  // pantograph sparks now and then while a tram runs (TRAM.spark a second per car). Car places (blocks): the noses 2.95 ahead
  // of the car's centre, the bays along it (voxmodels.js tramCar: z 6–41 of 48 at 8 a block), 1.9 up, just outside the sides
  const TRAM = M.TRAM = { nose: 2.95, lamp: 0.85, bays: [1.875, 0.75, -0.625, -1.75], side: 1.32, winY: 1.9, spark: 0.35, sparkV: 4 };
  // which nose leads: car 0's nose points to the first station, car 1's to the second; v the line's heading (+1 to the
  // second station, -1 back, 0 standing: both noses white)
  M.tramLead = function (idx, v) { return v === 0 ? true : (v > 0) === (idx === 1); };

  // ---- the new air's caps per tier (live particles of each kind at most): 0 Very Low · 1 Low · 2 Balanced · 3 High · 4 Ultra
  const KINDS = ['steam', 'tmote', 'sparkle', 'leaf', 'splash', 'veil'];
  const CAPS = [
    { steam: 8, tmote: 0, sparkle: 0, leaf: 0, splash: 0, veil: 0 },
    { steam: 20, tmote: 24, sparkle: 16, leaf: 24, splash: 30, veil: 16 },
    { steam: 40, tmote: 60, sparkle: 36, leaf: 48, splash: 70, veil: 32 },
    { steam: 60, tmote: 90, sparkle: 56, leaf: 72, splash: 110, veil: 48 },
    { steam: 80, tmote: 120, sparkle: 80, leaf: 96, splash: 150, veil: 64 },
  ];
  // the life of each kind (s): the caps hold the spawn rate to cap / life a second
  const LIFE = { steam: 2.6, tmote: 6, sparkle: 0.12, leaf: 6, splash: 0.35, veil: 4 };
  // t-polish2 · gap 7 (docs/superpowers/plans/2026-10-16-t-polish2.md): the café's steam reads by day — bigger, denser
  // wisps in a light grey that shows on the bright stone (the white 0.96 vanished on the travertine) — and at night as
  // v0.48's merge set it (half as bright, lit by the lamps, not emissive). steamLook sets EVERY field of the shared spawn
  // object: the merge's comment had swallowed fade, alpha, grow, wind and turb, so the steam took whatever the kind
  // spawned before it left there (the constructor's or the motes' alpha 1, no growth: small opaque white balls)
  const STEAM = M.STEAM = {
    day: { size: 0.085, sizeR: 0.04, col: [0.78, 0.79, 0.82], emis: 0.05, alpha: 0.5, grow: 0.3 },
    night: { size: 0.055, sizeR: 0.03, col: [0.48, 0.48, 0.49], emis: 0, alpha: 0.38, grow: 0.22 },
    grav: -0.06, drag: 0.9, wind: 0.5, turb: 0.35,
  };
  M.steamLook = function (sunUp, O, r) {
    const L = sunUp ? STEAM.day : STEAM.night;
    O.life = LIFE.steam * (0.8 + r * 0.4); O.size = L.size + r * L.sizeR; O.grav = STEAM.grav; O.drag = STEAM.drag;
    O.col = L.col; O.emis = L.emis; O.fade = true; O.alpha = L.alpha; O.grow = L.grow; O.wind = STEAM.wind; O.turb = STEAM.turb;
    return O;
  };
  const VEIL_COOL = [0.65, 0.95, 1.3], VEIL_WARM = [1.3, 0.85, 0.45];   // the veil's motes: its blue-white energy, a few warm off the rim
  const VEIL_SCAN = M.VEIL_SCAN = { r: 30, rLow: 18, ry: 8 };   // how far round the eye the veils are looked for (blocks: across — Balanced and up, Low —, up and down)
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
      this.acc = { steam: 0, tmote: 0, sparkle: 0, leaf: 0, splash: 0, veil: 0 };
      this.drawn = { steam: 0, tmote: 0, sparkle: 0, leaf: 0, splash: 0, veil: 0 };   // spawns per kind (the tests read them)
      this.tables = []; this.tableT = 0;
      this.veils = []; this.veilT = 0;   // the portal veils' cells round the eye: x, y, z, nx, ny, nz (findVeils)
      this.ms = 0;
      this.o = { life: 1, size: 0.1, grav: 0, drag: 0.5, col: [1, 1, 1], emis: 0, collide: false, fade: true, alpha: 1, grow: 0, wind: 0, turb: 0, force: true };
    }
    setOn(on, tier) { this.on = on !== false; if (tier !== undefined) this.tier = Math.max(0, Math.min(4, tier | 0)); }
    // the café tables within 40 blocks of the eye (from the hall cities' plans: a café seat faces its table), every 2 s
    findTables(eye) {
      const V = this.g.villages, out = [];
      if (V && V.known) for (const v of V.known.values()) {
        const P = v && v.plan; if (!P || Math.hypot(P.x - eye[0], P.z - eye[2]) > 260) continue;
        // (the hall city keeps its café's seats on the café's workplace, plan.work — plan.shops lists its shops without
        // seats: the final browser run's street had no wisp)
        for (const sh of (P.work || []).concat(P.shops || [])) if (sh && sh.kind === 'cafe' && sh.seats) for (const s of sh.seats) {
          const f = s[3] & 3, tx = s[0] + VR.HF_DX[f], tz = s[2] + VR.HF_DZ[f];
          if (Math.hypot(tx - eye[0], tz - eye[2]) > 40) continue;
          if (!out.some(t => t[0] === tx && t[2] === tz)) out.push([tx, s[1], tz]);
        }
      }
      out.sort((a, b) => Math.hypot(a[0] - eye[0], a[2] - eye[2]) - Math.hypot(b[0] - eye[0], b[2] - eye[2]));
      this.tables = out.slice(0, 16);
    }
    // the portal veils round the eye (every 2.5 s: a 2-block grid over 61 × 17 × 61 blocks, 8649 reads, on Low 37 × 17 × 37; at most 48 cells),
    // each with its plane's normal from its neighbours (a veil running along x faces ±z, along z ±x, a flat one up). (The
    // third browser run: the gate's veil stood 33 blocks from the plaza's eye, out of the old 18-block reach — no motes)
    findVeils(w, eye) {
      const R = VR.R, T = R && R.T, vt = R && R.byName && R.byName.portal_veil, V = this.veils, VR2 = this.tier >= 2 ? VEIL_SCAN.r : VEIL_SCAN.rLow, VY = VEIL_SCAN.ry;   // (Low: the old 18 — 3249 reads; Balanced+: 30 — 8649, about 1 ms every 2.5 s)
      V.length = 0;
      if (!vt || !T || !T.type) return;
      const id = vt.id, is = (x, y, z) => { const s = w.getBlock(x, y, z); return !!s && T.type[s] === id; };
      const ex = Math.floor(eye[0]), ey = Math.floor(eye[1]), ez = Math.floor(eye[2]);
      for (let y = ey - VY; y <= ey + VY && V.length < 48 * 6; y += 2) for (let z = ez - VR2; z <= ez + VR2 && V.length < 48 * 6; z += 2) for (let x = ex - VR2; x <= ex + VR2 && V.length < 48 * 6; x += 2) {
        if (!is(x, y, z)) continue;
        const ax = is(x + 1, y, z) || is(x - 1, y, z), az = is(x, y, z + 1) || is(x, y, z - 1);
        if (ax && az) V.push(x, y, z, 0, 1, 0); else if (az) V.push(x, y, z, 1, 0, 0); else V.push(x, y, z, 0, 0, 1);
      }
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
          // (wisps that read from across the street: the third run's 0.035-block ones were a pixel at ten blocks)
          M.steamLook(sunUp, O, Math.random());   // (t-polish2: the whole look, by day and by night — M.STEAM)
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
      // ---- light out of the portal veils: motes, blue-white and a few warm ones off the rim, drift out of the veil's
      // plane on both sides and settle slowly onto the floor before it (the veil throws light; Low and up)
      if (cap.veil > 0) {
        if ((this.veilT -= dt) <= 0) { this.veilT = 2.5; this.findVeils(w, eye); }
        const V = this.veils, nv = V.length / 6;
        if (nv) {
          this.acc.veil = Math.min(4, this.acc.veil + cap.veil / LIFE.veil * dt);
          for (let k = 0; k < 4 && this.acc.veil >= 1; k++) {
            this.acc.veil -= 1; this.drawn.veil++;
            const i = ((Math.random() * nv) | 0) * 6, nx = V[i + 3], ny = V[i + 4], nz = V[i + 5], sd = ny || Math.random() < 0.5 ? 1 : -1;   // (a flat veil: up only)
            const u = Math.random() - 0.5, v = Math.random() - 0.5, sp = 0.3 + Math.random() * 0.5, warm = Math.random() < 0.3;
            // a point on the cell's face, just off the veil (the in-plane axes are the two the normal does not use)
            const x = V[i] + 0.5 + (nx ? sd * 0.55 : u), y = V[i + 1] + 0.5 + (ny ? sd * 0.55 : v), z = V[i + 2] + 0.5 + (nz ? sd * 0.55 : (nx ? u : v));
            O.life = LIFE.veil * (0.7 + Math.random() * 0.6); O.size = 0.07 + Math.random() * 0.06;   // (big enough to read from across the plaza)
            O.grav = 0.03; O.drag = 0.35; O.col = warm ? VEIL_WARM : VEIL_COOL; O.emis = 1; O.fade = true; O.alpha = 1; O.grow = 0; O.wind = 0.05; O.turb = 0.25;
            this.spawn(P, x, y, z, nx * sd * sp + (Math.random() - 0.5) * 0.1, ny * sd * sp - 0.08, nz * sd * sp + (Math.random() - 0.5) * 0.1);
          }
        } else this.acc.veil = 0;
      }
      this.ms = this.ms * 0.9 + (performance.now() - t0) * 0.1;
    }
  }
  VR.MotionAir = MotionAir;
})(VR);
