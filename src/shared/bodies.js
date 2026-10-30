// ============================================================================
// VR.Bodies — the worlds of Helia one can stand on, as data, and the morphology of their craters (u-moons1 ·
// docs/superpowers/specs/2026-10-22-universe-design.md §6.3; the plan docs/superpowers/plans/2026-10-22-u-moons1.md; the
// facts docs/universe/REFERENCE.md §5.1–§5.8). Pure: the main thread, the workers and the Studio run it. The generator
// that builds a world from a profile is gen_body.js (VR.BodyGen).
//
// The scale (U§3): a world's landforms are 1/64 replicas — a crater of D metres in the game stands for one of 64·D in
// reality, and its shape is chosen by that real-equivalent size (simple bowls below the transition diameter, complex
// craters with flat floors, central peaks and terraces above it, peak rings above nine times it); things at walking size
// (boulders, vents, the regolith's layers) keep their real size.
//
//   Bodies.profile(id)                     the table of U§6.3 for 'basalt' and 'opal'
//   Bodies.transition(g, ice) · kind(Dreal, g, ice)
//   Bodies.crater(Dgame, profile)          a crater's shape (depth, rim, floor, peak, terraces) from its size
//   Bodies.craterHeight(c, r, age)         its height over the ground it struck at the distance r from its centre
//   Bodies.octaves(profile)                the population: per octave the cell size and the chance for maria and highlands
//   Bodies.stamp(meta) · bgenOf(meta)      a save's bgen per body (old worlds keep their moons, like vgen)
// Also here (it must run before blocks4.js closes the registry): the three blocks the bodies are made of, appended after
// every older block — regolith, regolith_dark, tholin_ice.
// ============================================================================
(function (VR) {
  'use strict';
  const L = 64;                                     // U§3: real-equivalent lengths = 64 × game lengths
  const BGEN = 1;                                   // the bodies' generator version (gen_body.js); test/body_same.js pins it
  const walk = (g) => 30 * g / 9.81;                // the walking gravity (U§4.3): the genre's 30 at home, every world in its ratio

  // ---------------------------------------------------------------- morphology (R§5.2)
  // the simple → complex transition diameter (real, metres): D_T ∝ 1/g — rock from the Moon's 18 km at 1.62 m/s², ice from
  // Mars' 2.7 km at 3.72 m/s² (R§5.2)
  function transition(g, ice) { return ice ? 2700 * 3.72 / g : 18000 * 1.62 / g; }
  // the progression with size: pit → bowl → central peak → peak ring (Schrödinger) → multi-ring basin (Orientale)
  function kind(Dreal, g, ice) { const T = transition(g, ice); return Dreal < T ? 'simple' : Dreal < 9 * T ? 'complex' : Dreal < 30 * T ? 'peakring' : 'basin'; }
  // a crater's shape from its game diameter. Simple: rim-to-floor depth 0.2 D (R§5.2), the rim 0.036 D over the old ground
  // (Pike 1977). Complex: Pike's lunar fits in km of the real-equivalent size — depth 1.044·D^0.301, rim 0.236·D^0.399,
  // floor 0.187·D^1.249 (at most ¾ of D) — the central peak 0.0049·D^1.297 high (Hale & Head 1979; at most half the
  // floor's depth) and 0.22 D wide; 2 terraces at the transition, 4 at 3·D_T and above. A peak ring: the ring of peaks
  // half way out, 0.6 of the peak's height. Ice (Opal) the same laws with its own transition.
  function crater(Dg, prof) {
    const Dreal = Dg * L, Dk = Dreal / 1000, g = prof ? prof.g : 1.62, ice = !!(prof && prof.ice);
    const k = kind(Dreal, g, ice), R = Dg / 2, km = 1000 / L;   // (km real → game metres)
    const c = { D: Dg, R, Dreal, kind: k, depth: 0, rim: 0, floor: 0, floorR: 0, peakH: 0, peakR: 0, terraces: 0, ringR: 0, ringH: 0 };
    if (k === 'simple') { c.depth = 0.2 * Dg; c.rim = 0.036 * Dg; c.floor = c.rim - c.depth; return c; }
    c.depth = 1.044 * Math.pow(Dk, 0.301) * km;
    c.rim = 0.236 * Math.pow(Dk, 0.399) * km;
    c.floor = c.rim - c.depth;
    c.floorR = Math.min(0.75 * Dg, 0.187 * Math.pow(Dk, 1.249) * km) / 2;
    const DT = transition(g, ice);
    c.terraces = 2 + Math.max(0, Math.min(2, Math.floor(1.4 * Math.log2(Dreal / DT))));
    const ph = Math.min(0.0049 * Math.pow(Dk, 1.297) * km, 0.5 * (c.rim - c.floor));
    if (k === 'complex') { c.peakH = ph; c.peakR = Math.min(0.11 * Dg, c.floorR * 0.75); }
    else { c.ringR = 0.48 * R; c.ringH = 0.6 * ph; c.ringW = 0.07 * R; }
    return c;
  }
  // the wall of a complex crater: from the floor's edge (u 0) to the rim's crest (u 1), steeper toward the rim; each
  // terrace a riser and a flat bench (the first riser starts at the floor). bench: the terraces' phase shift (−0.5 … 0.5:
  // the generator turns it with the azimuth, so a wall is never the same all round)
  function wallAt(u, n, shift) {
    const s = Math.pow(u, 1.4);
    if (!n) return s;
    const v = Math.max(0, Math.min(n + 1, s * (n + 1) + (shift || 0) * 0.35)), i = Math.floor(v), f = v - i;
    const g = f < 0.45 ? (f / 0.45) * (f / 0.45) * (3 - 2 * f / 0.45) : 1;
    return Math.min(1, (i + g) / (n + 1));
  }
  // the height over the ground it struck at the distance r (game m) from the centre; age 0 fresh … 1 worn (depths and rims
  // softened, terraces slumped, the crest rounded); shift: the terraces' azimuthal phase (−0.5 … 0.5)
  function craterHeight(c, r, age, shift) {
    age = age || 0;
    if (age > 0.02) {
      // a worn crater: its radial profile averaged over a width that grows with age (the crest rounds, the bowl fills)
      const w = c.R * 0.3 * age;
      return (heightRaw(c, Math.abs(r - w), age, shift) + heightRaw(c, r, age, shift) + heightRaw(c, r + w, age, shift)) / 3;
    }
    return heightRaw(c, r, age, shift);
  }
  function heightRaw(c, r, age, shift) {
    const R = c.R, kd = 1 - 0.55 * age, kr = 1 - 0.8 * age;
    const rim = c.rim * kr, floor = c.floor * kd;
    if (r >= R) {
      // the continuous ejecta blanket: ∝ (R/r)³ out to ~3 R (R§5.2: about one crater radius thick … thin)
      if (r >= 3 * R) return 0;
      const q = R / r, f = r > 2.5 * R ? 1 - smooth((r - 2.5 * R) / (0.5 * R)) : 1;
      return rim * q * q * q * f;
    }
    if (c.kind === 'simple') { const q = r / R; return rim - (rim - floor) * (1 - q * q); }
    // complex and peak-ring: the flat floor, the peak or the ring, the terraced wall
    const fr = c.floorR;
    if (r > fr) {
      const u = (r - fr) / (R - fr), terr = Math.max(0, 1 - 1.6 * age);
      const s = wallAt(u, c.terraces, shift), s0 = Math.pow(u, 1.4);
      return floor + (rim - floor) * (s0 + (s - s0) * terr);
    }
    let z = floor;
    if (c.peakR > 0 && r < c.peakR) { const q = r / c.peakR, b = 1 - q * q; z += c.peakH * kd * b * b; }
    if (c.ringR > 0) { const d = (r - c.ringR) / c.ringW; if (d > -1 && d < 1) { const b = 1 - d * d; z += c.ringH * kd * b * b; } }
    return z;
  }
  const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

  // ---------------------------------------------------------------- the population (R§5.2: N(>D) ∝ D^−2.9)
  // ten octaves from D 6 m (6 … 12, 12 … 24, … 3,072 … 6,144 m: 384 m … 393 km real), each a grid of cells four times its
  // smallest D wide; a cell holds floor(p) craters and one more with the chance frac(p), where p = the octave's density ×
  // the cell's area — A·(D₀^−2.9 − (2D₀)^−2.9) per m² (the cumulative law's octave), A by the ground (the maria, the
  // highlands six times as old and dense, Opal's young ice a tenth of the maria). Within an octave D follows the same law.
  const SLOPE = 2.9, D0 = 6, OCT = 10;
  function octaves(prof) {
    const out = [], P = prof.craters;
    for (let k = 0; k < OCT; k++) {
      const d0 = D0 * Math.pow(2, k), S = 4 * d0, c = Math.pow(d0, -SLOPE) * (1 - Math.pow(2, -SLOPE));
      out.push({ k, d0, d1: 2 * d0, S, pMare: P.A * c * S * S, pHigh: P.A * P.highland * c * S * S });
    }
    return out;
  }
  // a diameter within an octave by the power law, u ∈ [0, 1)
  const sizeIn = (d0, u) => d0 * Math.pow(1 - u * (1 - Math.pow(2, -SLOPE)), -1 / SLOPE);

  // ---------------------------------------------------------------- the profiles (U§2.1, §6.3)
  const PROFILES = {};
  function def(id, o) {
    const U = VR.Universe, b = U && U.home && U.home.by[id];
    const p = Object.assign({ id, body: id, R: b ? b.R : o.R, bgen: BGEN, L }, o);
    p.walk = walk(p.g); p.DT = transition(p.g, p.ice) / L;
    PROFILES[id] = p;
    return p;
  }
  // Basalt: the Moon-like airless world (R§5.1). Albedo 0.11 (Bond, the Moon); maria dark basalt, highlands bright
  // anorthosite-like crust; 60 min a day (U§2.1); Amarant 9.9° rising and setting.
  def('basalt', {
    kind: 'airless', ice: false, g: 1.62, R: 27187.5, level: 72, day: 3600, albedo: 0.11,
    name: { de: 'Basalt', en: 'Basalt' },
    craters: { A: 0.1862, highland: 6, young: 0.08, boulders: 0.15 },   // A: N(>D) per m² = A·D^−2.9 in the maria (N(>16 m) = 60 per km²)
    maria: { share: 0.3, drop: 5, scale: 7000 },                           // the lava plains: ~30 % (the Moon's near side 31 %), 5 m lower
    rilles: { w: [16, 46], depth: [3, 6], scale: 1600 },                   // sinuous rilles 1–3 km wide real (R§5.1)
    landmark: { x: 300, z: 395, D: 360, age: 0.02 },                       // a young complex crater 23 km real by the landing (Copernicus-like)
    spawn: { x: 0, z: 0 },
    sky: { parent: 'amarant', ground: [0.11, 0.11, 0.12] },
  });
  // Opal: the ice moon with geysers (R§5.6): albedo ~1 (Enceladus), lineae 1–2 km wide real → 16–31 m, ridges, chaos, four
  // tiger stripes (~135 km long real → 2.1 km, ~35 km apart → 550 m) whose vents fire; few craters (young ice); locked,
  // Amarant 26.8° fixed 35° high in the south of the landing.
  def('opal', {
    kind: 'ice', ice: true, g: 0.49, R: 17187.5, level: 72, day: 9251, albedo: 0.9,
    name: { de: 'Opal', en: 'Opal' },
    craters: { A: 0.01862, highland: 1, young: 0.08, boulders: 0 },
    lineae: { w: [16, 31], families: 3, spacing: 900 },
    ridges: { h: 4, w: 30 },
    chaos: { share: 0.08, cell: 26 },
    stripes: { n: 4, z0: 380, spacing: 550, half: 1100, width: 31, depth: 8, flank: 2.5, vents: 8 },
    geyser: { every: [40, 90], dur: [10, 18], height: [2000, 3000] },       // U§6.3: a vent fires every 40–90 s, jets 2–3 km
    spawn: { x: 0, z: 0 },
    sky: { parent: 'amarant', ground: [0.86, 0.88, 0.92] },
  });

  // ---- u-moons2: the three worlds of wave 5 (gen_body2.js builds them; plan docs/superpowers/plans/2026-10-30-u-moons2.md)
  // Zinnober: Io's kind (R§5.5) — paterae 6–27 km real (90–420 m), a quarter with lava lakes, flows, sulfur plains in four
  // colours, crustal mountain blocks 8–17 km real (125–265 m; the world top caps the highest), umbrella plumes 300–400 km
  // real (5–6 km) from six active vents, one every ~2 min; locked, Amarant 37.2° fixed high in the south-west; 1.61 h a day
  def('zinn', {
    kind: 'volcanic', ice: false, g: 1.80, R: 28437.5, level: 64, day: 5796, albedo: 0.6,
    name: { de: 'Zinnober', en: 'Cinnabar' },
    craters: { A: 0.0004, highland: 1, young: 0, boulders: 0 },        // (Io: no impact crater seen — the surface is young)
    paterae: { cell: 900, p: 0.55, D: [90, 420], depth: [12, 34], lake: 0.25 },
    mountains: { cell: 3200, p: 0.32, h: [125, 265], r: [260, 820] },
    landmark: { x: 60, z: -430, D: 260, depth: 22 },                    // the Glutsee: a lava lake 17 km real by the landing
    plume: { n: 6, every: [100, 140], dur: [40, 60], height: [5000, 6000], canopy: 1.15 },
    spawn: { x: 0, z: 0 },
    sky: { parent: 'amarant', ground: [0.62, 0.55, 0.3] },
  });
  // Ocker: Mars' kind (R§2.3, §5.4) — the plain at y 150 so the Rostschlucht fits (145 m = Valles' 9.3 km ÷ 64), barchans
  // at real size (4–9 m high), mesas, softened craters, the Ockerdom (240 m = 15 km real, 5.3 km north; the world top caps it — a stated
  // compression), dust devils with dark tracks; 6 mbar CO₂ and dust (atmo_lut.js); 40 min a day
  def('ocker', {
    kind: 'dust', ice: false, g: 3.72, R: 52968.75, level: 150, day: 2400, albedo: 0.25, air: true,
    name: { de: 'Ocker', en: 'Ochre' },
    craters: { A: 0.0093, highland: 1, young: 0, boulders: 0 },
    dunes: { cell: 170, L: [60, 160], hk: 0.06, wind: 0.35 },
    mesas: { cell: 1500, p: 0.42, r: [70, 260], h: [25, 55] },
    canyon: { z0: 1150, half: 700, depth: 145 },
    shield: { x: 500, z: -5300, R: 4300, h: 240, scarp: 60, caldera: 1250 },
    devils: { every: 60, w: [16, 40], h: [300, 800], tracks: { cell: 520, w: [5, 12] } },
    storm: { tauClear: 0.5, tauStorm: 4.5 },
    spawn: { x: 0, z: 0 },
    sky: { parent: 'amarant', ground: [0.5, 0.3, 0.17] },
  });
  // Aquamarin: the ocean moon — the sea at y 63, archipelagos, drowned-crater atolls (ring islands round lagoons), sea
  // stacks; 0.5 bar, 2.4× Earth's air column; locked to Herzwelt (22.9° overhead); 2.21 h a day
  def('aqua', {
    kind: 'ocean', ice: false, g: 2.01, R: 37500, level: 63, day: 7956, albedo: 0.1, air: true, sea: 63,
    name: { de: 'Aquamarin', en: 'Aquamarine' },
    craters: { A: 0.0004, highland: 1, young: 0, boulders: 0 },
    atolls: { cell: 1700, p: 0.55, R: [110, 380] },
    landmark: { x: 520, z: -260, R: 230 },                              // an atoll in sight of the landing
    islands: { scale: 900, thr: 0.3 },
    spawn: { x: 0, z: 0 },
    sky: { parent: 'herz', ground: [0.06, 0.14, 0.18] },
  });
  // ---- end u-moons2

  const Bodies = VR.Bodies = {
    BGEN, L, ids: Object.keys(PROFILES), SLOPE, D0, OCT,
    // (the radius from VR.Universe once it is there: universe.js loads after this file)
    profile: (id) => { const p = PROFILES[id]; if (!p) return null; if (!p._u && VR.Universe && VR.Universe.home) { const b = VR.Universe.home.by[id]; if (b) p.R = b.R; p._u = true; } return p; },
    transition, kind, crater, craterHeight, wallAt, octaves, sizeIn, walk,
    // a save's bgen per body: every body this build knows gets the current bgen in a save that has none (as vgen at a
    // world's creation); what a save has stays (an old world keeps its moons when a later bgen comes)
    stamp(meta) {
      if (!meta || meta.guest) return meta;
      const u = meta.universe || (meta.universe = { v: 1 }), b = u.bodies || (u.bodies = {});
      for (const id of Bodies.ids) { const e = b[id] || (b[id] = {}); if (!(e.bgen > 0)) e.bgen = BGEN; }
      return meta;
    },
    bgenOf(meta) { const b = meta && meta.universe && meta.universe.bodies, out = {}; for (const id of Bodies.ids) out[id] = b && b[id] && b[id].bgen > 0 ? b[id].bgen : BGEN; return out; },
  };

  // ---------------------------------------------------------------- the blocks of the bodies (appended late)
  // regolith: the highlands' bright dust (and fresh ejecta, the rays on dark ground) · regolith_dark: the maria's dust ·
  // tholin_ice: the reddish-brown ice of Opal's lineae and chaos matrix (organic-rich ices redden, R§5.8). The dusts are
  // natural ground (smooth slopes in the Nahtlos look); their footsteps are sand's, the ice's glass's (klang.js).
  if (VR.BL && !(VR.R && VR.R.T)) {
    VR.BL.late = VR.BL.late || [];
    VR.BL.late.push(function () {
      const R = VR.R, T = R.tex, def0 = VR.BL.def, G = VR.BL.G || {};
      const dust = { cat: 'nature', group: G.SOIL, hard: 0.5, blast: 0.5, tool: 'shovel', sound: 'sand', smooth: true, flags: VR.F.RANDROT };
      def0('regolith', Object.assign({ display: 'Regolith', tex: () => T('regolith') }, dust));
      def0('regolith_dark', Object.assign({ display: 'Dark Regolith', tex: () => T('regolith_dark') }, dust));
      def0('tholin_ice', { display: 'Tholin Ice', cat: 'nature', group: G.FLUID, tex: () => T('tholin_ice'), hard: 0.6, blast: 0.6, tool: 'pick', sound: 'glass', slip: 0.98, flags: VR.F.RANDROT });
    });
  }
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
