// ============================================================================
// VR.BodyGen — the world generator of a body of Helia (u-moons1 · docs/superpowers/specs/2026-10-22-universe-design.md
// §6.3; the plan docs/superpowers/plans/2026-10-22-u-moons1.md; the facts docs/universe/REFERENCE.md §5.1–§5.8). The same
// interface as every generator (gen_dims.js, gen_overworld.js): generate(cx, cz) → {blocks Uint16Array(65536), biome,
// caveBiome, tints, chests, spawns}, surfaceY, biomeAt, climateAt/biomeFor, tints, findSpawn(x, z) → [x, y, z, yaw].
// Versioned by bgen (opts.bgen[id], else VR.Bodies.BGEN): a later change of a body's world goes behind a new bgen and
// test/body_same.js keeps the old one's chunks.
//
// Two kinds, from VR.Bodies.profile(id):
//   airless (Basalt, the Moon's kind, R§5.1–§5.2): maria (dark lava plains, lower) and highlands (bright, rough, old);
//     the crater population — ten octaves on cell grids, N(>D) ∝ D^−2.9, six times denser on the highlands — each crater
//     shaped by its real-equivalent size (VR.Bodies.crater: bowls, complex craters with flat floors, central peaks and
//     terraces, peak rings), worn by its age, younger ones over older ones (a fresh crater's floor holds no older pits);
//     rays and bright ejecta round the youngest 8 %, boulders round the youngest 15 %, bare rock in fresh walls;
//     regolith 3–5 blocks on the highlands, 1–2 on the maria; sinuous rilles in the maria; the landmark — a young
//     complex crater by the landing.
//   ice (Opal, R§5.6): bright smooth ice plains, three families of lineae (16–31 m: a tholin-dark trough between two low
//     ridges), packed-ice ridges, chaos (tilted plates in a darker matrix), few craters, and four tiger stripes south of
//     the landing — troughs 31 m wide and 8 m deep between frosted ridges, their vents (vents()) where the geysers fire.
// Heights: the ground lies round y 72 (the chart's datum 63 is the sphere's radius; 72 leaves the craters' depth).
// ============================================================================
(function (VR) {
  'use strict';
  const M = VR.M, B = VR.Bodies;
  const ss = (a, b, x) => { let t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
  const TAU = Math.PI * 2;
  const ID_SEED = { basalt: 0xba5a17, opal: 0x0a1c3e, zinn: 0x217b0b, ocker: 0x0c4e12, aqua: 0x0a9a3a };   // (u-moons2: the last three)
  let S_ = null;
  // the states, resolved once the registry is complete
  function S() {
    if (S_) return S_;
    const R = VR.R, s = (n, p) => R.S(n, p), G = VR.GEN.S();
    S_ = {
      bedrock: G.bedrock, basalt: s('basalt'), smoothBasalt: G.smoothbasalt, gravel: G.gravel,
      // the highlands' crust (anorthosite, albedo ~0.3: andesite's grey; the freshest, deepest crust a little brighter:
      // diorite) — never calcite, which is white and burns out under an airless sun
      crust: s('andesite'), crustDark: s('stone'), crustBright: s('diorite'),
      reg: s('regolith'), regDark: s('regolith_dark'), tholin: s('tholin_ice'),
      snow: G.snowblock, snow1: G.snow1, packed: G.packed, blue: G.blueice, ice: G.ice,
    };
    return S_;
  }
  // the biomes of the bodies, flag moon = the body: no air, so no precipitation and no weather. Appended after every older
  // biome (biomes.js, gen_realm.js, gen_heart.js run before this file), so a save's biome bytes keep their meaning
  if (VR.BIOMES && VR.BIOME && VR.BIOME.basalt_mare === undefined) {
    const add = (key, name, col, moon) => { const e = { id: VR.BIOMES.length, key, name, temp: 0.5, down: 0, grass: col, foliage: col, water: 0x3F76E4, sky: 0, fog: null, precip: 'none', moon }; VR.BIOMES.push(e); VR.BIOME[key] = e.id; };
    add('basalt_mare', 'Mare', 0x8c8a86, 'basalt'); add('basalt_highlands', 'Highlands', 0xa6a39d, 'basalt'); add('basalt_crater', 'Young Crater', 0x9a9792, 'basalt');
    add('opal_plains', 'Ice Plains', 0xe8eef4, 'opal'); add('opal_lineae', 'Lineae', 0xb0806a, 'opal'); add('opal_chaos', 'Chaos Terrain', 0xc8c4c4, 'opal'); add('opal_stripes', 'Tiger Stripes', 0x9ab8d8, 'opal');
  }
  const BIO = () => VR.BIOME;
  let TINTS = null;
  function tintsConst() {
    if (TINTS) return TINTS;
    const g = VR.rgb565(150, 148, 142), w = VR.rgb565(90, 110, 130);
    TINTS = { g, w };
    return TINTS;
  }

  class BodyGen {
    constructor(seed, id, opts) {
      this.seed = seed >>> 0;
      this.id = id; this.prof = B.profile(id);
      if (!this.prof) throw new Error('BodyGen: no such body ' + id);
      this.kind = this.prof.kind; this.ice = !!this.prof.ice;
      // u-moons2: the kinds of gen_body2.js (volcanic, dust, ocean) are subclasses — `new BodyGen(…)` hands one back
      if (new.target === BodyGen && VR.BodyGenKinds && VR.BodyGenKinds[this.kind]) return new VR.BodyGenKinds[this.kind](seed, id, opts);
      const bg = opts && opts.bgen && opts.bgen[id];
      this.bgen = bg > 0 ? bg : B.BGEN;
      const s = (this.seed ^ ID_SEED[id]) >>> 0, F = VR.Fractal;
      this.s = s;
      this.oct = B.octaves(this.prof);
      this.cells = new Map(); this.nCells = 0;
      this.level = this.prof.level;
      if (this.kind === 'airless') {
        const P = this.prof;
        this.nMare = new F(s ^ 0x11, 3, 1 / P.maria.scale, 0.5);
        this.nHigh = new F(s ^ 0x22, 3, 1 / 320, 0.5);
        this.nHigh2 = new F(s ^ 0x33, 2, 1 / 70, 0.5);
        this.nWrin = new F(s ^ 0x44, 2, 1 / 900, 0.5);
        this.nRil = new F(s ^ 0x55, 2, 1 / P.rilles.scale, 0.5);
        this.nRilM = new F(s ^ 0x66, 2, 1 / 3500, 0.5);
        this.nRilW = new F(s ^ 0x77, 1, 1 / 2500, 0.5);
        this.nPatch = new F(s ^ 0x88, 2, 1 / 18, 0.5);
        this.nRay = new F(s ^ 0x99, 2, 1 / 40, 0.5);
        const L = P.landmark;
        this.landmark = this.makeCrater(L.x, L.z, L.D, L.age, -1, 0x1a2b);
        this.landmark.mare = 1; this.landmark.landmark = true;
      } else if (this.kind === 'ice') {   // (u-moons2: the other kinds set themselves up in gen_body2.js)
        this.nBase = new F(s ^ 0x11, 3, 1 / 700, 0.5);
        this.nFine = new F(s ^ 0x12, 2, 1 / 90, 0.5);
        this.nLin = [0, 1, 2].map(j => new F(s ^ (0x21 + j), 2, 1, 0.5));
        this.nLinW = [0, 1, 2].map(j => new F(s ^ (0x31 + j), 1, 1 / 4000, 0.5));
        this.nLinM = [0, 1, 2].map(j => new F(s ^ (0x41 + j), 1, 1 / 5000, 0.5));
        this.lin = [0, 1, 2].map(j => { const a = (j * 61 + 17 + (M.hashf2(j, 7, s) - 0.5) * 20) * Math.PI / 180; return { c: Math.cos(a), s: Math.sin(a) }; });
        this.nRidge = new F(s ^ 0x51, 2, 1, 0.5);
        this.nRidgeM = new F(s ^ 0x52, 1, 1 / 3000, 0.5);
        this.nChaos = new F(s ^ 0x61, 2, 1 / 2600, 0.5);
        this.nPatch = new F(s ^ 0x71, 2, 1 / 22, 0.5);
        this.ventList = this.makeVents();
      }
    }

    // ================================================================ craters
    // one crater: its place, size, age and shape (VR.Bodies.crater), its rays and its wall's terrace phase
    makeCrater(x, z, D, age, k, h) {
      const c = B.crater(D, this.prof);
      const P = this.prof.craters;
      return {
        x, z, D, R: D / 2, k, age, rays: age < P.young, fresh: age < (P.boulders || 0), kind: c.kind, shape: c, h: h >>> 0, mare: 1,
        rayN: 9 + (h % 9), rayPh: (h >>> 8) % 628 / 100, rayPh2: (h >>> 16) % 628 / 100, rayLen: D / 2 * (6 + ((h >>> 4) % 100) / 100 * 6),
        tph: ((h >>> 12) % 628) / 100,
      };
    }
    // the craters of one cell of octave k (cached): floor(p) and one more with the chance frac(p), p by the ground at the
    // crater's centre (maria / highlands); the candidates are the same whatever the ground, so the population is stable
    cellCraters(k, i, j) {
      const key = (k * 8192 + (i & 8191)) * 8192 + (j & 8191);
      let hit = this.cells.get(key);
      if (hit) return hit;
      if (this.nCells > 40000) { this.cells.clear(); this.nCells = 0; }
      const o = this.oct[k], out = [], s = this.s + k * 7919;
      const nMax = Math.ceil(o.pHigh);
      for (let m = 0; m < nMax; m++) {
        const h = M.hash3(i, j, m, s);
        const ux = M.hashf3(i, j, m * 4 + 1, s + 1), uz = M.hashf3(i, j, m * 4 + 2, s + 2), ud = M.hashf3(i, j, m * 4 + 3, s + 3), ua = M.hashf3(i, j, m * 4 + 4, s + 4), uk = M.hashf3(i, j, m * 4 + 5, s + 5);
        const x = (i + ux) * o.S, z = (j + uz) * o.S;
        const mare = this.kind === 'airless' ? this.mareAt(x, z) : 1;
        const p = o.pMare + (o.pHigh - o.pMare) * (1 - mare);
        if (!(uk < p - m)) continue;
        const c = this.makeCrater(x, z, B.sizeIn(o.d0, ud), ua, k, h);
        c.mare = mare;
        out.push(c);
      }
      this.cells.set(key, out); this.nCells++;
      return out;
    }
    // every crater whose ground (3 R) — or, with rays, whose rays — reach into the box; the landmark too
    cratersBox(x0, z0, x1, z1, all, rays) {
      const out = [];
      for (const o of this.oct) {
        const reach = rays && o.k >= 1 ? 12 * o.d0 : 3 * o.d0;
        const i0 = Math.floor((x0 - reach) / o.S), i1 = Math.floor((x1 + reach) / o.S), j0 = Math.floor((z0 - reach) / o.S), j1 = Math.floor((z1 + reach) / o.S);
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          for (const c of this.cellCraters(o.k, i, j)) {
            if (all) { out.push(c); continue; }
            const r = c.rays && rays && c.D >= 12 ? Math.max(3 * c.R, c.rayLen) : 3 * c.R;
            if (c.x + r < x0 || c.x - r > x1 || c.z + r < z0 || c.z - r > z1) continue;
            out.push(c);
          }
        }
      }
      const L = this.landmark;
      if (L) { const r = Math.max(3 * L.R, L.rayLen); if (all || !(L.x + r < x0 || L.x - r > x1 || L.z + r < z0 || L.z - r > z1)) out.push(L); }
      out.sort((a, b) => a.age - b.age || b.D - a.D);   // the youngest first: each crater is covered by those before it (column)
      return out;
    }

    // ================================================================ Basalt's ground
    // the maria's share: 1 lava plain … 0 highlands; the landing lies in one (the plain round the chart's origin)
    mareAt(x, z) {
      if (this.kind !== 'airless') return 0;
      const d = Math.sqrt(x * x + z * z), n = this.nMare.n2(x, z);
      const m = ss(0.06, 0.14, n);
      return d < 1700 ? Math.max(m, 1 - ss(1100, 1700, d)) : m;
    }
    // a rille: the line where a slow noise crosses zero (its distance by the gradient), only in the maria and where a mask
    // lets it run; 16–46 m wide (1–3 km real), 3–6 m deep, a U across. → depth (m, ≥ 0)
    rilleDepth(x, z) {
      if (this.kind !== 'airless') return 0;
      const m = this.mareAt(x, z); if (m < 0.75) return 0;
      const mk = ss(0.12, 0.3, this.nRilM.n2(x, z)); if (mk <= 0) return 0;
      const n = this.nRil.n2(x, z);
      if (Math.abs(n) > 0.06) return 0;
      const e = 6, gx = (this.nRil.n2(x + e, z) - this.nRil.n2(x - e, z)) / (2 * e), gz = (this.nRil.n2(x, z + e) - this.nRil.n2(x, z - e)) / (2 * e), g = Math.sqrt(gx * gx + gz * gz);
      if (g < 2.5e-4) return 0;
      const P = this.prof.rilles, hw = (P.w[0] + (P.w[1] - P.w[0]) * (0.5 + 0.5 * this.nRilW.n2(x, z))) / 2, d = Math.abs(n) / g;
      if (d >= hw) return 0;
      const q = d / hw, dep = P.depth[0] + (P.depth[1] - P.depth[0]) * (0.5 + 0.5 * this.nRilW.n2(z, x));
      return dep * (1 - q * q) * mk * ss(0.75, 0.9, m);
    }
    rilleAt(x, z) { return this.rilleDepth(x, z) > 0.8 ? 1 : 0; }
    rilleWidth() { return this.prof.rilles ? this.prof.rilles.w.slice() : [0, 0]; }
    // the ground before the craters: the maria low and flat with wrinkle ridges, the highlands higher and rough
    baseAirless(x, z, m) {
      const P = this.prof, hi = 1 - m;
      let h = this.level + hi * P.maria.drop;
      if (hi > 0) h += hi * (this.nHigh.n2(x, z) * 7 + this.nHigh2.n2(x, z) * 1.6);
      if (m > 0) { const w = this.nWrin.n2(x, z); h += m * (Math.max(0, 1 - Math.abs(w) * 9) * 1.2 + this.nHigh2.n2(x, z) * 0.35); }
      return h;
    }

    // ================================================================ Opal's ground
    // a linea of family j at (x, z): the band's half width and the distance from its centre line (Infinity: none)
    linea(j, x, z, out) {
      const L = this.lin[j], u = x * L.c + z * L.s, v = -x * L.s + z * L.c, sp = this.prof.lineae.spacing;
      const f = this.nLin[j].n2(u / (sp * 9), v / sp);
      out.d = Infinity; out.hw = 0;
      if (Math.abs(f) > 0.08) return out;
      if (this.nLinM[j].n2(x, z) < -0.25) return out;            // (a family's lines break off here and there)
      const e = 4, g = Math.abs(this.nLin[j].n2(u / (sp * 9), (v + e) / sp) - this.nLin[j].n2(u / (sp * 9), (v - e) / sp)) / (2 * e);
      if (g < 1e-5) return out;
      const W = this.prof.lineae.w;
      out.hw = (W[0] + (W[1] - W[0]) * (0.5 + 0.5 * this.nLinW[j].n2(u, j * 1000))) / 2;
      out.d = Math.abs(f) / g;
      return out;
    }
    lineaAt(x, z) { const o = this._lo || (this._lo = { d: 0, hw: 0 }); for (let j = 0; j < 3; j++) { this.linea(j, x, z, o); if (o.d < o.hw) return 1; } return 0; }
    // the widths of the lineae met on a few long transects (for the test: the generator's own parameter)
    lineaWidths(x0, z0, span) {
      const out = [], o = { d: 0, hw: 0 };
      for (let t = 0; t < 6; t++) for (let k = 0; k < 4000; k++) {
        const x = x0 + (t + 0.5) * span / 6, z = z0 + k * span / 4000;
        for (let j = 0; j < 3; j++) { this.linea(j, x, z, o); if (o.d < 0.5) { out.push(o.hw * 2); k += 20; break; } }
      }
      return out;
    }
    // chaos: Voronoi plates of ~26 m tilted and shifted in a darker matrix, where a slow mask lets it → {id, h, matrix} | null
    chaosAt(x, z) {
      if (!this.ice) return null;
      const m = this.nChaos.n2(x, z), thr = 0.28;
      if (m < thr) return null;
      const d = Math.sqrt(x * x + z * z); if (d < 260) return null;   // (the landing stays a plain)
      const C = this.prof.chaos.cell, ci = Math.floor(x / C), cj = Math.floor(z / C);
      let d1 = 1e9, d2 = 1e9, id = 0, sx = 0, sz = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const i = ci + di, j = cj + dj, px = (i + 0.15 + 0.7 * M.hashf2(i, j, this.s + 5)) * C, pz = (j + 0.15 + 0.7 * M.hashf2(i, j, this.s + 6)) * C;
        const dd = Math.hypot(x - px, z - pz);
        if (dd < d1) { d2 = d1; d1 = dd; id = M.hash2(i, j, this.s + 7); sx = px; sz = pz; } else if (dd < d2) d2 = dd;
      }
      const k = ss(thr, thr + 0.08, m), u1 = (id & 1023) / 1023, u2 = ((id >>> 10) & 1023) / 1023, u3 = ((id >>> 20) & 1023) / 1023;
      const matrix = d2 - d1 < 3.2;
      const h = matrix ? -1.6 * k : ((u1 - 0.4) * 6 + ((u2 - 0.5) * (x - sx) + (u3 - 0.5) * (z - sz)) * 0.16) * k;
      return { id, h, matrix, k };
    }
    // the four tiger stripes: a curve across the plain south of the landing each; d the distance from its centre line,
    // e the fade at its ends → {j, d, e} of the nearest, or null
    stripeAt(x, z) {
      if (!this.ice) return null;
      const P = this.prof.stripes;
      if (Math.abs(x) > P.half + 60) return null;
      let best = null;
      for (let j = 0; j < P.n; j++) {
        const zc = this.stripeZ(j, x), d = z - zc;
        if (Math.abs(d) > 60) continue;
        if (!best || Math.abs(d) < Math.abs(best.d)) best = { j, d, e: ss(P.half, P.half - 220, Math.abs(x)) };
      }
      return best;
    }
    stripeZ(j, x) { const P = this.prof.stripes; return P.z0 + j * P.spacing + 45 * Math.sin(x / 650 + 1.3 * j) + 18 * Math.sin(x / 230 + 2.1 * j); }
    // the profile across a stripe: a trough 31 m wide and 8 m deep, ridges on its flanks
    stripeDrop(d, e) {
      const P = this.prof.stripes, hw = P.width / 2, a = Math.abs(d);
      if (a < hw) { const q = a / hw; return -P.depth * Math.pow(1 - q * q, 0.6) * e; }
      const f = (a - hw - 8.5) / 10;
      return f > -1 && f < 1 ? P.flank * (1 - f * f) * (1 - f * f) * e : 0;
    }
    stripeProfile(j, x) { const P = this.prof.stripes; return { width: P.width, depth: -this.stripeDrop(0, 1), flank: this.stripeDrop(P.width / 2 + 8.5, 1) }; }
    // the vents: eight along each stripe (every ~270 m), in the trough's floor
    makeVents() {
      const P = this.prof.stripes, out = [];
      for (let j = 0; j < P.n; j++) for (let k = 0; k < P.vents; k++) {
        const x = Math.round(-945 + 270 * k + (M.hashf2(j, k, this.s + 77) - 0.5) * 80) + 0.5, z = Math.round(this.stripeZ(j, x)) + 0.5;
        out.push({ x, z, y: 0, stripe: j, k, id: j * 16 + k, seed: M.hash2(j, k, this.s + 78) });
      }
      for (const v of out) v.y = Math.floor(this.heightAt(Math.floor(v.x), Math.floor(v.z))) - 2;   // (inside the hole: the air of the shaft, before the holes exist)
      return out;
    }
    vents() { return this.ventList ? this.ventList.slice() : []; }
    ventsNear(x, z, r) { return (this.ventList || []).filter(v => Math.hypot(v.x - x, v.z - z) <= r); }
    // the vent hole at (x, z): its extra depth (a 3 × 3 shaft 5 m into the trough's floor)
    ventDepth(x, z) {
      if (!this.ventList || Math.abs(x) > 1200) return 0;
      for (const v of this.ventList) { if (Math.abs(x + 0.5 - v.x) <= 1.1 && Math.abs(z + 0.5 - v.z) <= 1.1) return 5; }
      return 0;
    }
    baseIce(x, z) {
      let h = this.level + this.nBase.n2(x, z) * 2.6 + this.nFine.n2(x, z) * 0.5;
      // ridges: broad packed-ice ridges along a slow field's zero line, where a mask lets them run
      if (this.nRidgeM.n2(x, z) > 0.1) { const n = this.nRidge.n2(x / 6000, z / 1300); if (Math.abs(n) < 0.05) { const q = Math.abs(n) / 0.05; h += this.prof.ridges.h * (1 - q * q) * (1 - q * q); } }
      return h;
    }

    // ================================================================ one column
    // everything a column needs: o = {h, m, ray, fresh, freshR, freshKind, freshFloor, freshPeak, rille, linea, chaos,
    // stripe, vent}; list: the craters near (sorted, biggest first)
    column(x, z, list, o) {
      o = o || {};
      o.fresh = null; o.freshQ = 0; o.ray = 0; o.rille = 0; o.linea = 0; o.lineaD = 0; o.chaos = null; o.stripe = null; o.vent = 0; o.m = 0;
      let h;
      if (this.kind === 'airless') { o.m = this.mareAt(x, z); h = this.baseAirless(x, z, o.m); const rd = this.rilleDepth(x, z); if (rd > 0) { h -= rd; o.rille = rd; } }
      else {
        h = this.baseIce(x, z);
        const lo = this._lc || (this._lc = { d: 0, hw: 0 });
        for (let j = 0; j < 3; j++) {
          this.linea(j, x, z, lo);
          if (lo.d < lo.hw * 1.35) {
            // the double ridge (Europa's, ÷ 64): a trough in the middle (−1.2 m), a ridge on each side cresting at 0.9 of
            // the half width (+1.8 m) and gone at 1.35 — the band of tholin ice is the trough and the ridges' inner slopes
            const q = lo.d / lo.hw;
            h += q < 0.45 ? -1.2 * (1 - (q / 0.45) * (q / 0.45)) : 1.8 * Math.sin(Math.PI * (q - 0.45) / 0.9);
            if (q < 1) { o.linea = 1; o.lineaD = q; }
          }
        }
        const ch = this.chaosAt(x, z); if (ch) { h += ch.h; o.chaos = ch; }
        const st = this.stripeAt(x, z); if (st) { h += this.stripeDrop(st.d, st.e); o.stripe = st; }
        const vd = st ? this.ventDepth(x, z) : 0; if (vd) { h -= vd; o.vent = vd; }
      }
      // the craters, youngest first (cratersBox): each one shows as much as the younger ones over this column leave of it —
      // inside a younger crater nothing older remains, under its ejecta 40 % of it, whatever their sizes (a small fresh
      // crater on the floor of a great old one, never the old one's wall through a young one's floor)
      let add = 0, w = 1, fr = null, frQ = 0;
      for (let k = 0; k < list.length && w > 0.001; k++) {
        const c = list[k], dx = x - c.x, dz = z - c.z, r2 = dx * dx + dz * dz, R3 = 3 * c.R;
        if (c.rays && c.D >= 12) { const rr = Math.sqrt(r2); if (rr < c.rayLen && rr > c.R * 0.9) { const ry = this.rayOf(c, dx, dz, rr) * w; if (ry > o.ray) o.ray = ry; } }
        if (r2 >= R3 * R3) continue;
        const r = Math.sqrt(r2);
        const shift = c.kind !== 'simple' ? 0.5 * Math.sin(3 * Math.atan2(dz, dx) + c.tph) : 0;
        add += w * B.craterHeight(c.shape, r, c.age, shift);
        // the youngest fresh crater over this column decides the ground's material inside it
        if (c.fresh && r < c.R * 0.98 && w > 0.5 && !fr) { fr = c; frQ = r / c.R; }
        if (r < 2 * c.R) w = Math.min(w, 1 - Math.max(1 - ss(0.9 * c.R, 1.05 * c.R, r), 0.6 * (1 - ss(c.R, 2 * c.R, r))));
      }
      o.fresh = fr; o.freshQ = frQ;
      o.h = h + add;
      return o;
    }
    // a young crater's rays at (dx, dz) from its centre: the bright halo to 1.7 R, then 9–17 main rays and as many thin
    // ones between them (two angular waves: the rays of unequal width), narrowing and breaking into streaks with the
    // distance out to 6–12 R (R§5.1: Tycho's rays run across the near side) — run 1's map showed even spokes, a starburst
    rayOf(c, dx, dz, r) {
      if (r < 1.7 * c.R) return 1;   // (the halo: all bright)
      const th = Math.atan2(dz, dx), w3 = Math.sin(3 * th + c.rayPh2);
      const p = 0.5 + 0.3 * Math.cos(c.rayN * th + c.rayPh + 0.8 * w3) + 0.2 * Math.cos((2 * c.rayN + 5) * th + 1.7 * c.rayPh2 + 0.5 * w3);
      const t = (r - 1.7 * c.R) / (c.rayLen - 1.7 * c.R);
      const cut = 0.68 + 0.22 * t;
      let v = ss(cut, cut + 0.1, p) * (1 - ss(0.45, 1, t));
      if (v > 0 && this.nRay) v *= ss(-0.25 - 0.3 * (1 - t), 0.2, this.nRay.n2(c.x + dx, c.z + dz));
      return v;
    }
    rayAt(x, z) { const o = this.column(x, z, this.cratersBox(x, z, x, z, false, true), {}); return o.ray; }
    inFreshCrater(x, z) { const list = this.cratersBox(x, z, x, z, false, true); for (const c of list) { if (c.fresh && Math.hypot(x - c.x, z - c.z) < c.R * 1.25) return true; } return false; }
    craterAt(x, z) { const list = this.cratersBox(x, z, x, z, false, false); let best = null; for (const c of list) if (Math.hypot(x - c.x, z - c.z) < c.R && (!best || c.D > best.D)) best = c; return best; }

    // ================================================================ boulders (Basalt)
    // round a fresh crater (≥ 12 m): up to D × 0.7 boulders between 0.85 R and 2.2 R (most near the rim), 0.5–2.1 m in
    // radius (few large) — real size (U§6.3: things at walking size keep their size); the ground's rock
    bouldersOf(c) {
      if (!c.fresh || c.D < 12) return [];
      if (c._b) return c._b;
      const out = [], n = Math.min(280, Math.round(c.D * 0.7 * (1 - c.age / this.prof.craters.boulders)));
      const rng = new VR.RNG(c.h ^ 0xb01d);
      for (let k = 0; k < n; k++) {
        const a = rng.next() * TAU, u = rng.next(), rr = c.R * (0.85 + 1.35 * u * u), br = 0.5 + 1.6 * Math.pow(rng.next(), 3);
        out.push({ x: c.x + Math.cos(a) * rr, z: c.z + Math.sin(a) * rr, r: br, kind: rng.next(), c });
      }
      return (c._b = out);
    }
    bouldersNear(x, z, r) { const out = []; for (const c of this.cratersBox(x - r, z - r, x + r, z + r, false, false)) for (const b of this.bouldersOf(c)) if (Math.hypot(b.x - x, b.z - z) <= r) out.push(b); return out; }
    boulderAt(x, z) { for (const c of this.cratersBox(x, z, x, z, false, false)) for (const b of this.bouldersOf(c)) if (Math.hypot(b.x - (x + 0.5), b.z - (z + 0.5)) <= b.r + 0.75) return true; return false; }

    // ================================================================ the worker's interface
    heightAt(x, z) { return this.column(x, z, this.cratersBox(x, z, x, z, false, false), this._ho || (this._ho = {})).h; }
    surfaceY(x, z) { return Math.floor(this.heightAt(x, z)); }
    climateAt(x, z) { const o = this.column(x, z, this.cratersBox(x, z, x, z, false, false), {}); return { m: o.m, fresh: !!o.fresh, linea: o.linea, chaos: !!o.chaos, stripe: !!(o.stripe && Math.abs(o.stripe.d) < 60) }; }
    biomeFor(cl) {
      const BI = BIO();
      if (this.kind === 'airless') return cl.fresh ? BI.basalt_crater : cl.m >= 0.5 ? BI.basalt_mare : BI.basalt_highlands;
      return cl.stripe ? BI.opal_stripes : cl.linea ? BI.opal_lineae : cl.chaos ? BI.opal_chaos : BI.opal_plains;
    }
    biomeAt(x, z) { return this.biomeFor(this.climateAt(x, z)); }
    tints() { const T = tintsConst(); return { grass: new Uint16Array(256).fill(T.g), foliage: new Uint16Array(256).fill(T.g), water: new Uint16Array(256).fill(T.w) }; }
    // a standable, flat spot near (x, z) — off crater rims, rilles, lineae, stripes, chaos and boulders — and the way to
    // look: Basalt toward its landmark, Opal toward Amarant (south) and the stripes
    findSpawn(x, z) {
      x = Number.isFinite(x) ? x : this.prof.spawn.x; z = Number.isFinite(z) ? z : this.prof.spawn.z;
      for (let r = 0; r < 600; r += 6) for (let a = 0; a < (r ? 16 : 1); a++) {
        const px = Math.round(x + Math.cos(a / 16 * TAU) * r), pz = Math.round(z + Math.sin(a / 16 * TAU) * r);
        const list = this.cratersBox(px - 4, pz - 4, px + 4, pz + 4, false, false), o = {};
        const h0 = this.column(px, pz, list, o).h;
        if (o.rille || o.linea || o.chaos || o.vent || (o.stripe && Math.abs(o.stripe.d) < 45)) continue;
        let flat = true;
        for (const [dx, dz] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) if (Math.abs(this.column(px + dx, pz + dz, list, {}).h - h0) > 1.2) { flat = false; break; }
        if (!flat) continue;
        if (list.some(c => Math.hypot(px - c.x, pz - c.z) < c.R * 1.15 && c.D > 8)) continue;
        if (this.kind === 'airless' && this.boulderNearSpawn(px, pz)) continue;
        const y = Math.floor(h0) + 1;
        let yaw;
        if (this.kind === 'airless') { const L = this.landmark; yaw = Math.atan2(-(L.x - px), -(L.z - pz)); }
        else yaw = Math.PI;
        return [px + 0.5, y, pz + 0.5, yaw];
      }
      return [x + 0.5, this.surfaceY(Math.round(x), Math.round(z)) + 1, z + 0.5, 0];
    }
    boulderNearSpawn(x, z) { for (const b of this.bouldersNear(x, z, 4)) if (Math.hypot(b.x - x, b.z - z) < b.r + 2) return true; return false; }

    // ================================================================ a chunk
    generate(cx, cz) {
      const T = S(), BI = BIO();
      const blocks = new Uint16Array(65536), biome = new Uint8Array(256);
      const x0 = cx * 16, z0 = cz * 16;
      const list = this.cratersBox(x0 - 1, z0 - 1, x0 + 16, z0 + 16, false, true);
      // the heights of the chunk and a border of one (the slopes at its edges)
      const H = this._H || (this._H = new Float32Array(18 * 18)), info = this._info || (this._info = []);
      for (let j = 0; j < 18; j++) for (let i = 0; i < 18; i++) {
        const k = j * 18 + i, o = info[k] || (info[k] = {});
        this.column(x0 + i - 1, z0 + j - 1, list, o);
        H[k] = o.h;
      }
      const air = this.kind === 'airless';
      for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
        const k = (lz + 1) * 18 + lx + 1, o = info[k], col = lz * 16 + lx, x = x0 + lx, z = z0 + lz;
        const top = Math.max(2, Math.min(250, Math.floor(H[k])));
        const slope = Math.max(Math.abs(H[k + 1] - H[k - 1]), Math.abs(H[k + 18] - H[k - 18])) * 0.5;
        const hp = M.hashf2(x, z, this.s + 31), pn = this.nPatch.n2(x, z);
        blocks[col] = T.bedrock;
        if (air) {
          const mare = o.m >= 0.5 + (pn * 0.08);
          const rockDeep = T.basalt, rock = mare ? (pn > 0.35 ? T.smoothBasalt : T.basalt) : (pn > 0.3 ? T.crust : T.crustDark);
          let reg = mare ? 1 + (hp < 0.5 ? 1 : 0) : 3 + Math.floor(hp * 3);
          let topB = mare ? T.regDark : T.reg;
          const fr = o.fresh;
          if (fr) {
            // inside a fresh crater: bare rock in the walls, gravel on the benches; a complex crater's floor of dark melt,
            // its central peak of bright deep crust
            reg = 0;
            const s = fr.shape, rr = o.freshQ * fr.R;
            if (fr.kind !== 'simple' && rr < s.floorR) topB = s.peakR > 0 && rr < s.peakR * 1.05 ? T.crustBright : (s.ringR > 0 && Math.abs(rr - s.ringR) < s.ringW ? T.crustBright : T.smoothBasalt);
            else topB = slope > 0.45 || hp < 0.55 ? rock : T.gravel;
          } else if (o.ray > 0.5) { topB = mare ? T.reg : (o.ray > 0.8 && hp < 0.4 ? T.crustBright : T.reg); reg = Math.max(reg, 1); }
          if (!fr && slope > 1.25) { topB = rock; reg = 0; }
          if (o.rille > 0.5 && slope > 0.6) { topB = T.basalt; reg = 0; }
          for (let y = 1; y <= top; y++) {
            const d = top - y;
            blocks[(y << 8) | col] = d === 0 ? topB : d < reg ? (mare ? T.regDark : T.reg) : y < 30 ? rockDeep : rock;
          }
          biome[col] = fr ? BI.basalt_crater : mare ? BI.basalt_mare : BI.basalt_highlands;
        } else {
          const st = o.stripe, inTrough = st && Math.abs(st.d) < this.prof.stripes.width / 2, flank = st && !inTrough && Math.abs(st.d) < 46;
          let surf = T.snow, sub = T.packed, depth = 2;
          if (inTrough) { surf = slope > 0.5 ? T.blue : (hp < 0.6 ? T.blue : T.ice); sub = T.blue; depth = 3; }
          else if (o.chaos) { if (o.chaos.matrix) { surf = T.tholin; sub = T.tholin; } else { surf = slope > 0.5 ? T.packed : T.snow; sub = T.packed; } }
          else if (o.linea) { surf = T.tholin; sub = T.tholin; depth = 2; }
          else if (o.fresh) { surf = slope > 0.45 ? T.blue : T.snow; }
          else if (slope > 0.9) surf = T.packed;
          for (let y = 1; y <= top; y++) {
            const d = top - y;
            blocks[(y << 8) | col] = d === 0 ? surf : d < depth ? sub : T.packed;
          }
          // frost: snow layers on the flanks round the vents (the plumes' fall-back)
          if (flank && !o.linea && hp < 0.55 * st.e && top < 250) blocks[((top + 1) << 8) | col] = T.snow1;
          if (o.vent) for (let y = top; y >= top - 1; y--) blocks[(y << 8) | col] = T.ice;   // (the shaft's floor of clear ice)
          biome[col] = st && Math.abs(st.d) < 60 ? BI.opal_stripes : o.linea ? BI.opal_lineae : o.chaos ? BI.opal_chaos : BI.opal_plains;
        }
      }
      this.lastInfo = info;   // (the columns' facts of the last chunk, for the tests: info[(lz + 1) * 18 + lx + 1])
      // the vent shafts' walls of blue ice round the open hole (Opal)
      if (!air) this.ventWalls(blocks, x0, z0, T);
      // boulders on the ground (Basalt)
      if (air) this.placeBoulders(blocks, x0, z0, list, H, T);
      const TT = tintsConst();
      return { blocks, biome, caveBiome: new Int8Array(256).fill(-1), tints: { grass: new Uint16Array(256).fill(TT.g), foliage: new Uint16Array(256).fill(TT.g), water: new Uint16Array(256).fill(TT.w) }, chests: [], spawns: [] };
    }
    ventWalls(blocks, x0, z0, T) {
      for (const v of this.ventList) {
        if (v.x < x0 - 3 || v.x > x0 + 19 || v.z < z0 - 3 || v.z > z0 + 19) continue;
        for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
          const x = Math.floor(v.x) + dx, z = Math.floor(v.z) + dz, lx = x - x0, lz = z - z0;
          if (lx < 0 || lx > 15 || lz < 0 || lz > 15 || (Math.abs(dx) < 2 && Math.abs(dz) < 2)) continue;
          const col = lz * 16 + lx;
          let y = 250; while (y > 1 && !blocks[(y << 8) | col]) y--;
          for (let k = 0; k < 4 && y - k > 0; k++) blocks[((y - k) << 8) | col] = T.blue;
        }
      }
    }
    placeBoulders(blocks, x0, z0, list, H, T) {
      for (const c of list) {
        if (!c.fresh || c.D < 12) continue;
        for (const b of this.bouldersOf(c)) {
          const R0 = b.r, ri = Math.ceil(R0);
          if (b.x + ri < x0 || b.x - ri > x0 + 16 || b.z + ri < z0 || b.z - ri > z0 + 16) continue;
          // its seat: the ground under its centre (a boulder sits a little sunk in, an ellipsoid 0.8 as high as wide)
          const cxI = Math.floor(b.x), czI = Math.floor(b.z), lxc = cxI - x0, lzc = czI - z0;
          const base = lxc >= -1 && lxc <= 16 && lzc >= -1 && lzc <= 16 ? H[(lzc + 1) * 18 + lxc + 1] : this.heightAt(cxI, czI);
          const st = c.mare > 0.5 ? (b.kind < 0.6 ? T.basalt : T.smoothBasalt) : (b.kind < 0.65 ? T.crust : T.crustBright);
          for (let dz = -ri; dz <= ri; dz++) for (let dx = -ri; dx <= ri; dx++) {
            const x = cxI + dx, z = czI + dz, lx = x - x0, lz = z - z0;
            if (lx < 0 || lx > 15 || lz < 0 || lz > 15) continue;
            const ex = x + 0.5 - b.x, ez = z + 0.5 - b.z, q = 1 - (ex * ex + ez * ez) / (R0 * R0);
            if (q <= 0) continue;
            const hgt = Math.sqrt(q) * R0 * 1.6, y0 = Math.floor(base + 0.5), y1 = Math.floor(base - 0.3 * R0 + hgt);
            for (let y = y0; y <= y1 && y < 254; y++) blocks[(y << 8) | (lz * 16 + lx)] = st;
          }
        }
      }
    }
  }
  VR.BodyGen = BodyGen;
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
