// ============================================================================
// Overworld generator — multi-noise terrain inspired by the research notes:
// continentalness / erosion / weirdness(peaks & valleys) / temperature / humidity,
// 3D density with coarse 4x8x4 interpolation, cheese+spaghetti caves, aquifers,
// ores & veins, surface rules per biome, cave biomes, features & structures.
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R, GEN = VR.GEN, M = VR.M, BI = VR.BIOME, BIOMES = VR.BIOMES;
  const SEA = VR.C.SEA;
  const smoothstep = M.smoothstep, lerp = M.lerp, clamp = M.clamp;
  const st = (n, p) => R.S(n, p);

  function spline(x, pts) {
    if (x <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      if (x <= pts[i][0]) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; const t = (x - x0) / (x1 - x0); return y0 + (y1 - y0) * (t * t * (3 - 2 * t)); }
    }
    return pts[pts.length - 1][1];
  }
  // the cave field n at (fx, fz) inside a cell: bilinear over the cell's four corners in grid index i00 (i00 + 1: +x, + 5: +z)
  function cornerLerp(grid, i00, n, fx, fz) {
    const g000 = grid[i00][n], g100 = grid[i00 + 1][n], g010 = grid[i00 + 5][n], g110 = grid[i00 + 6][n];
    return (g000 * (1 - fx) + g100 * fx) * (1 - fz) + (g010 * (1 - fx) + g110 * fx) * fz;
  }
  const BASE = [[-1, 22], [-0.6, 26], [-0.4, 38], [-0.24, 50], [-0.15, 58], [-0.09, 62], [-0.04, 65], [0.1, 68], [0.3, 74], [0.55, 84], [1, 96]];

  // trees per 16 x 16 chunk by biome key (features)
  const TREE_DENS = {
        forest: 9, flower_forest: 3, birch_forest: 9, old_growth_birch_forest: 9, dark_forest: 14, pale_garden: 10, taiga: 9, old_growth_pine_taiga: 10, old_growth_spruce_taiga: 11,
        snowy_taiga: 6, jungle: 14, sparse_jungle: 4, bamboo_jungle: 6, savanna: 1.2, savanna_plateau: 1.5, windswept_savanna: 1, plains: 0.12, sunflower_plains: 0.1, meadow: 0.12,
        cherry_grove: 3, grove: 6, swamp: 2, mangrove_swamp: 7, snowy_plains: 0.2, wooded_badlands: 4, windswept_forest: 7, windswept_hills: 0.6, windswept_gravelly_hills: 0.5,
        dappled_forest: 10, mushroom_fields: 0.6, snowy_slopes: 0.3, river: 0, beach: 0
      };
  // the plants of each biome: [block name, chance per column] in order of the rolls (vegetation)
  const FLORA = {
        plains: [['short_grass', 0.28], ['tall_grass', 0.04], ['dandelion', 0.01], ['poppy', 0.01], ['oxeye_daisy', 0.004], ['azure_bluet', 0.004], ['cornflower', 0.004], ['red_tulip', 0.002], ['bush', 0.004]],
        sunflower_plains: [['short_grass', 0.25], ['sunflower', 0.05], ['tall_grass', 0.03]],
        forest: [['short_grass', 0.12], ['leaf_litter', 0.05], ['bush', 0.02], ['dandelion', 0.006], ['poppy', 0.006], ['lily_of_the_valley', 0.003], ['brown_mushroom', 0.002], ['fern', 0.02]],
        flower_forest: [['short_grass', 0.08], ['allium', 0.03], ['azure_bluet', 0.03], ['red_tulip', 0.02], ['orange_tulip', 0.02], ['white_tulip', 0.02], ['pink_tulip', 0.02], ['oxeye_daisy', 0.03], ['cornflower', 0.03], ['lily_of_the_valley', 0.03], ['lilac', 0.01], ['rose_bush', 0.01], ['peony', 0.01]],
        birch_forest: [['short_grass', 0.12], ['wildflowers', 0.08], ['bush', 0.01]], old_growth_birch_forest: [['short_grass', 0.12], ['wildflowers', 0.1], ['fern', 0.03]],
        dark_forest: [['short_grass', 0.1], ['brown_mushroom', 0.01], ['red_mushroom', 0.006], ['leaf_litter', 0.04]],
        pale_garden: [['pale_moss_carpet', 0.25], ['moon_eye', 0.02], ['short_grass', 0.03]],
        taiga: [['fern', 0.12], ['large_fern', 0.03], ['short_grass', 0.08], ['sweet_berry_bush', 0.006]],
        old_growth_pine_taiga: [['fern', 0.15], ['large_fern', 0.05], ['brown_mushroom', 0.005], ['dead_bush', 0.004], ['sweet_berry_bush', 0.004]],
        old_growth_spruce_taiga: [['fern', 0.15], ['large_fern', 0.05], ['red_mushroom', 0.004]],
        snowy_taiga: [['fern', 0.05], ['sweet_berry_bush', 0.002]], grove: [], snowy_plains: [['short_grass', 0.02]],
        jungle: [['short_grass', 0.2], ['fern', 0.1], ['tall_grass', 0.05], ['large_fern', 0.03], ['melon', 0.006]],
        sparse_jungle: [['short_grass', 0.2], ['fern', 0.1], ['melon', 0.004]],
        bamboo_jungle: [['bamboo', 0.12], ['short_grass', 0.1], ['podzol_patch', 0]],
        savanna: [['short_grass', 0.25], ['tall_grass', 0.15]], savanna_plateau: [['short_grass', 0.25], ['tall_grass', 0.12]], windswept_savanna: [['short_grass', 0.2]],
        desert: [['dead_bush', 0.006], ['short_dry_grass', 0.012], ['tall_dry_grass', 0.004], ['cactus', 0.006]],
        badlands: [['dead_bush', 0.01], ['short_dry_grass', 0.01], ['cactus', 0.004]], wooded_badlands: [['short_grass', 0.08], ['dead_bush', 0.01]], eroded_badlands: [['dead_bush', 0.01]],
        swamp: [['short_grass', 0.1], ['blue_orchid', 0.01], ['brown_mushroom', 0.005], ['dead_bush', 0.004], ['firefly_bush', 0.004], ['lily_pad', 0.05]],
        mangrove_swamp: [['short_grass', 0.05], ['lily_pad', 0.03], ['firefly_bush', 0.003]],
        meadow: [['short_grass', 0.3], ['tall_grass', 0.06], ['dandelion', 0.02], ['poppy', 0.02], ['allium', 0.02], ['azure_bluet', 0.02], ['oxeye_daisy', 0.02], ['cornflower', 0.02], ['wildflowers', 0.04]],
        cherry_grove: [['pink_petals', 0.3], ['short_grass', 0.08]],
        dappled_forest: [['leaf_litter', 0.18], ['red_shrub', 0.05], ['short_grass', 0.08], ['brown_mushroom', 0.01], ['bush', 0.01]],
        mushroom_fields: [['red_mushroom', 0.01], ['brown_mushroom', 0.01]],
        windswept_hills: [['short_grass', 0.1]], windswept_forest: [['short_grass', 0.1], ['fern', 0.05]],
        river: [['sugar_cane', 0.04]], beach: [['sugar_cane', 0.02]],
};
  // the middle biomes by temperature (rows) and humidity (columns), and their variants (weirdness > 0.35): the tables
  // are made on the first use (after every layer's biomes are registered), not on every call
  let BIOME_TABLES = null;
  function biomeTables() {
    return BIOME_TABLES || (BIOME_TABLES = {
      MID: [
        [BI.snowy_plains, BI.snowy_plains, BI.snowy_plains, BI.snowy_taiga, BI.snowy_taiga],
        [BI.plains, BI.plains, BI.forest, BI.taiga, BI.old_growth_spruce_taiga],
        [BI.flower_forest, BI.plains, BI.forest, BI.birch_forest, BI.dark_forest],
        [BI.savanna, BI.savanna, BI.forest, BI.jungle, BI.jungle],
        [BI.desert, BI.desert, BI.desert, BI.desert, BI.desert]],
      VAR: [
        [BI.ice_spikes, BI.snowy_plains, BI.snowy_taiga, BI.snowy_taiga, BI.snowy_taiga],
        [BI.dappled_forest, BI.dappled_forest, BI.forest, BI.taiga, BI.old_growth_pine_taiga],
        [BI.sunflower_plains, BI.plains, BI.forest, BI.old_growth_birch_forest, BI.pale_garden],
        [BI.savanna, BI.savanna, BI.plains, BI.sparse_jungle, BI.bamboo_jungle],
        [BI.desert, BI.desert, BI.badlands, BI.wooded_badlands, BI.eroded_badlands]] });
  }

  // the climates of a chunk's columns, by the output of generate (the layers' post passes read them: no second lookup)
  const CLIMATE_OF = new WeakMap();

  class OverworldGen {
    constructor(seed, opts) {
      opts = opts || {};
      this.seed = seed >>> 0;
      this.vgen = opts.vgen || 1; // village generator version (see gen_village.js)
      this.amplified = opts.worldType === 'amplified';
      this.large = opts.worldType === 'large';
      this.singleBiome = opts.worldType === 'single' ? (BI[opts.biome] !== undefined ? BI[opts.biome] : BI.plains) : -1;
      const sc = this.large ? 4 : 1, s = this.seed;
      const F = VR.Fractal;
      this.nC = new F(s ^ 0x1a2b3c, 5, 1 / (1100 * sc), 0.5);
      this.nE = new F(s ^ 0x2b3c4d, 4, 1 / (850 * sc), 0.5);
      this.nW = new F(s ^ 0x3c4d5e, 4, 1 / (620 * sc), 0.5);
      this.nT = new F(s ^ 0x4d5e6f, 3, 1 / (1700 * sc), 0.5);
      this.nH = new F(s ^ 0x5e6f70, 3, 1 / (1300 * sc), 0.5);
      this.nWarp = new F(s ^ 0x6f7081, 2, 1 / 280, 0.5);
      this.n3 = new F(s ^ 0x708192, 3, 1 / 96, 0.5);
      this.cheese = new F(s ^ 0x8192a3, 2, 1 / 78, 0.45);
      this.sp1 = new F(s ^ 0x92a3b4, 2, 1 / 120, 0.4);
      this.sp2 = new F(s ^ 0xa3b4c5, 2, 1 / 120, 0.4);
      this.entr = new F(s ^ 0xb4c5d6, 2, 1 / 150, 0.5);
      this.surfN = new F(s ^ 0xc5d6e7, 2, 1 / 28, 0.5);
      this.patchN = new F(s ^ 0xd6e7f8, 3, 1 / 36, 0.5);
      this.stripN = new VR.Simplex(s ^ 0xe7f809);
      this.caveBN = new F(s ^ 0xf8091a, 2, 1 / 180, 0.5);
      this.aqN = new VR.Simplex(s ^ 0x091a2b);
      this.corners = new Map();      // by X, then by Z (a Smi key each: a double key is boxed at every lookup)
      this.nCorners = 0;
      this.caveGrid = new Map();     // by X, then by Z and Y
      this.nCave = 0;
      // badlands terracotta bands (hoodoo layers)
      const rng = new VR.RNG(s ^ 0x5eed);
      const cols = ['orange', 'yellow', 'brown', 'red', 'white', 'light_gray'];
      this.bands = new Uint16Array(256);
      for (let y = 0; y < 256; y++) this.bands[y] = rng.chance(0.55) ? st('terracotta') : st(rng.pick(cols) + '_terracotta');
      for (let i = 0; i < 40; i++) { const y = rng.int(256), c = rng.pick(cols); for (let k = 0; k < 1 + rng.int(3) && y + k < 256; k++) this.bands[y + k] = st(c + '_terracotta'); }
    }

    // ---------------- climate & height at a corner (multiples of 4) ----------------
    corner(X, Z) {
      let row = this.corners.get(X);
      if (row !== undefined) { const hit = row.get(Z); if (hit !== undefined) return hit; }
      if (this.nCorners > 60000) { this.corners.clear(); this.nCorners = 0; row = undefined; }
      const c = this.computeClimate(X, Z);
      // the density column (33 noise samples) is computed on first use (densOf): climate-only lookups (biome
      // maps, structure site searches, the far horizon) never pay for it
      c.X = X; c.Z = Z; c.dens = null;
      if (row === undefined) { row = new Map(); this.corners.set(X, row); }
      row.set(Z, c); this.nCorners++;
      return c;
    }
    densOf(c) {
      if (c.dens) return c.dens;
      const dens = c.dens = new Float32Array(33);
      const A = c.A, H = c.H, X = c.X, Z = c.Z;
      for (let i = 0; i <= 32; i++) {
        const y = i * 8;
        if (y > H + A * 1.2 + 8) { dens[i] = H - y; continue; }
        if (y < H - A * 1.2 - 8) { dens[i] = H - y; continue; }
        dens[i] = (H - y) + A * this.n3.n3(X, y * 1.15, Z);
      }
      return dens;
    }
    computeClimate(X, Z) {
      const wx = X + this.nWarp.n2(X, Z) * 60, wz = Z + this.nWarp.n2(X + 5000, Z - 5000) * 60;
      const c = clamp(this.nC.n2(wx, wz) * 1.75 + 0.1, -1, 1);
      const e = clamp(this.nE.n2(wx, wz) * 1.7, -1, 1);
      const w = clamp(this.nW.n2(X, Z) * 1.8, -1, 1);
      const t = clamp(this.nT.n2(X, Z) * 1.8, -1, 1);
      const h = clamp(this.nH.n2(X, Z) * 1.8, -1, 1);
      const pv = 1 - Math.abs(3 * Math.abs(w) - 2);
      const base = spline(c, BASE);
      const inland = smoothstep(-0.12, 0.3, c);
      const mountain = smoothstep(0.1, -0.62, e);
      const peak = Math.max(0, pv * 0.6 + 0.4);
      let H = base + inland * mountain * (18 + 108 * peak * peak) + inland * (1 - mountain) * pv * 11 * (1 - smoothstep(-0.2, 0.6, e));
      // plateaus: moderate erosion + high continentalness
      const plateau = smoothstep(0.35, 0.7, c) * smoothstep(-0.45, -0.2, e) * (1 - smoothstep(-0.1, 0.2, e));
      H = lerp(H, Math.max(H, 118 + pv * 10), plateau * 0.6);
      const riverW = 1 - smoothstep(0.018, 0.085, Math.abs(w));
      const riverAllowed = smoothstep(-0.16, -0.04, c) * (1 - mountain * 0.8);
      const river = riverW * riverAllowed;
      if (river > 0) H = lerp(H, SEA - 4, river);
      const swampy = smoothstep(0.45, 0.75, e) * inland * (1 - mountain);
      H = lerp(H, Math.min(H, 64.3), swampy * 0.85);
      const windswept = smoothstep(0.25, 0.5, e) * (1 - smoothstep(0.62, 0.8, e)) * smoothstep(0.35, 0.65, Math.abs(w));
      let A = 3.5 + inland * (mountain * 24 + windswept * 16);
      if (this.amplified) { if (H > SEA) H = SEA + (H - SEA) * 1.9; A *= 1.7; }
      H = clamp(H, 8, 238);
      return { c, e, w, t, h, pv, H, A, river, mountain, windswept, swampy, inland, plateau };
    }
    // interpolated climate at block (x,z) from 4 corners
    climateAt(x, z) {
      const X0 = Math.floor(x / 4) * 4, Z0 = Math.floor(z / 4) * 4;
      const fx = (x - X0) / 4, fz = (z - Z0) / 4;
      const a = this.corner(X0, Z0), b = this.corner(X0 + 4, Z0), c = this.corner(X0, Z0 + 4), d = this.corner(X0 + 4, Z0 + 4);
      const bil = (k) => (a[k] * (1 - fx) + b[k] * fx) * (1 - fz) + (c[k] * (1 - fx) + d[k] * fx) * fz;
      return { c: bil('c'), e: bil('e'), w: bil('w'), t: bil('t'), h: bil('h'), pv: bil('pv'), H: bil('H'), river: bil('river'), mountain: bil('mountain'), windswept: bil('windswept'), swampy: bil('swampy'), inland: bil('inland'), plateau: bil('plateau') };
    }
    // ---------------- biome selection ----------------
    biomeFor(cl, height) {
      if (this.singleBiome >= 0) return this.singleBiome;
      const ti = cl.t < -0.45 ? 0 : cl.t < -0.15 ? 1 : cl.t < 0.2 ? 2 : cl.t < 0.55 ? 3 : 4;
      const hi = cl.h < -0.35 ? 0 : cl.h < -0.1 ? 1 : cl.h < 0.1 ? 2 : cl.h < 0.3 ? 3 : 4;
      const wpos = cl.w > 0;
      // oceans
      if (height < SEA - 2 && cl.river < 0.3 && cl.c < -0.1) {
        if (cl.c < -0.85 && cl.h > 0.2 && height > SEA - 18) return BI.mushroom_fields;
        const deep = cl.c < -0.42;
        if (ti === 0) return deep ? BI.deep_frozen_ocean : BI.frozen_ocean;
        if (ti === 1) return deep ? BI.deep_cold_ocean : BI.cold_ocean;
        if (ti === 2) return deep ? BI.deep_ocean : BI.ocean;
        if (ti === 3) return deep ? BI.deep_lukewarm_ocean : BI.lukewarm_ocean;
        return BI.warm_ocean;
      }
      if (cl.river > 0.55 && height < SEA + 2) return ti === 0 ? BI.frozen_river : BI.river;
      if (cl.c < -0.85 && cl.h > 0.2) return BI.mushroom_fields;
      // coast
      if (cl.c < -0.03 && height < SEA + 4 && cl.mountain < 0.4) {
        if (cl.e < -0.35) return BI.stony_shore;
        return ti === 0 ? BI.snowy_beach : BI.beach;
      }
      // peaks & slopes
      if (height > 168 && cl.mountain > 0.4) {
        if (ti <= 2) return wpos ? BI.jagged_peaks : BI.frozen_peaks;
        return BI.stony_peaks;
      }
      if (height > 118 && (cl.mountain > 0.3 || cl.plateau > 0.3)) {
        if (ti <= 1) return hi >= 3 ? BI.grove : BI.snowy_slopes;
        if (ti === 2) return (cl.w > 0.25 && hi >= 2) ? BI.cherry_grove : (hi >= 3 ? BI.grove : BI.meadow);
        if (ti === 3) return cl.plateau > 0.3 ? BI.savanna_plateau : BI.meadow;
        return cl.w > 0 ? BI.badlands : BI.savanna_plateau;
      }
      // windswept
      if (cl.windswept > 0.5 && height > 72) {
        if (ti <= 1) return wpos ? BI.windswept_gravelly_hills : BI.windswept_hills;
        if (ti === 2) return BI.windswept_forest;
        return BI.windswept_savanna;
      }
      // swamps
      if (cl.swampy > 0.5 && height < 67 && ti >= 2 && ti <= 3 && hi >= 2) return ti === 3 ? BI.mangrove_swamp : BI.swamp;
      // middle biomes
      const useVar = cl.w > 0.35;
      if (ti === 4 && height > 80 && hi >= 2) return hi >= 4 ? BI.eroded_badlands : hi >= 3 ? BI.wooded_badlands : BI.badlands;
      const T = biomeTables();
      return (useVar ? T.VAR : T.MID)[ti][hi];
    }
    caveBiomeFor(cl, y, x, z) {
      if (this.singleBiome >= 0) return -1;
      const n = this.caveBN.n3(x, y * 1.5, z);
      if (y < 30 && cl.e < -0.35 && cl.c > 0.05 && n > -0.1) return BI.deep_dark;
      if (cl.t < -0.4 && y > 18 && y < 56 && n > -0.2) return BI.ice_caves;
      if (cl.w < -0.4 && cl.e > 0.2 && y > 12 && y < 54 && n > 0) return BI.sulfur_caves;
      if (cl.c > 0.42 && y > 10 && y < 72 && n > -0.2) return BI.dripstone_caves;
      if (cl.h > 0.4 && y > 10 && y < 58 && n > -0.2) return BI.lush_caves;
      return -1;
    }

    // ---------------- cave fields on 4x4x4 grid ----------------
    caveSample(X, Y, Z) {
      const inner = (Z / 4 + 500000) * 70 + (Y / 4);
      let row = this.caveGrid.get(X);
      if (row !== undefined) { const hit = row.get(inner); if (hit !== undefined) return hit; }
      if (this.nCave > 200000) { this.caveGrid.clear(); this.nCave = 0; row = undefined; }
      const v = new Float32Array(3);
      v[0] = this.cheese.n3(X, Y * 1.55, Z);
      v[1] = this.sp1.n3(X, Y * 1.3, Z);
      v[2] = this.sp2.n3(X + 777, Y * 1.3, Z - 777);
      if (row === undefined) { row = new Map(); this.caveGrid.set(X, row); }
      row.set(inner, v); this.nCave++;
      return v;
    }

    // ---------------- main generation ----------------
    generate(cx, cz) {
      const S = GEN.S();
      const blocks = new Uint16Array(65536);
      const x0 = cx * 16, z0 = cz * 16;
      const rng = new VR.RNG(M.hash2(cx, cz, this.seed));
      // 5x5 corners
      const cor = [];
      let yLim = 0;   // above this the density of every corner is plain H − y (densOf): nothing up there can be solid
      for (let j = 0; j <= 4; j++) for (let i = 0; i <= 4; i++) { const cc = this.corner(x0 + i * 4, z0 + j * 4); this.densOf(cc); cor.push(cc); const yl = cc.H + cc.A * 1.2 + 8; if (yl > yLim) yLim = yl; }
      const yStart = Math.min(255, (Math.floor(yLim / 8) + 1) * 8 - 1);   // the last block of the highest density sample that may be positive
      // per-column density profile + climate
      const H = new Float32Array(256), climate = new Array(256), biome = new Uint8Array(256);
      const dcol = new Float32Array(33);
      let maxY = 0;
      const solidMask = this._solid || (this._solid = new Uint8Array(65536)); // 1 = terrain solid
      solidMask.fill(0);
      for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
        const ci = lx >> 2, cj = lz >> 2, fx = (lx & 3) / 4, fz = (lz & 3) / 4;
        const a = cor[cj * 5 + ci], b = cor[cj * 5 + ci + 1], c = cor[(cj + 1) * 5 + ci], d = cor[(cj + 1) * 5 + ci + 1];
        const w00 = (1 - fx) * (1 - fz), w10 = fx * (1 - fz), w01 = (1 - fx) * fz, w11 = fx * fz;
        for (let i = 0; i <= 32; i++) dcol[i] = a.dens[i] * w00 + b.dens[i] * w10 + c.dens[i] * w01 + d.dens[i] * w11;
        const col = lz * 16 + lx;
        let top = 0;
        for (let y = yStart; y >= 1; y--) {
          const i = y >> 3, f = (y & 7) / 8;
          const dv = dcol[i] * (1 - f) + dcol[i + 1] * f;
          if (dv > 0) { solidMask[(y << 8) | col] = 1; if (!top) top = y; }
        }
        H[col] = top;
        if (top > maxY) maxY = top;
        const cl = this.climateAt(x0 + lx, z0 + lz);
        climate[col] = cl;
        biome[col] = this.biomeFor(cl, top);
      }
      // stone / deepstone / bedrock / water
      for (let y = 0; y <= Math.max(maxY, SEA); y++) {
        const yo = y << 8;
        for (let col = 0; col < 256; col++) {
          const i = yo | col;
          if (y === 0 || (y < 5 && M.hash3(x0 + (col & 15), y, z0 + (col >> 4), this.seed) / 4294967296 < (5 - y) / 5)) { blocks[i] = S.bedrock; continue; }
          if (solidMask[i]) {
            if (y < 16 || (y < 24 && M.hash3(x0 + (col & 15), y, z0 + (col >> 4), this.seed + 1) / 4294967296 < (24 - y) / 8)) blocks[i] = S.deep;
            else blocks[i] = S.stone;
          } else if (y <= SEA) blocks[i] = S.water;
        }
      }
      // caves
      this.carveCaves(blocks, cx, cz, H, climate, biome);
      this.carveRavines(blocks, cx, cz, H);
      // surface
      const topY = new Uint8Array(256);
      this.surface(blocks, cx, cz, H, climate, biome, topY);
      // ores, blobs, veins
      this.ores(blocks, cx, cz, biome, rng);
      // cave biomes decoration
      const caveBiome = new Int8Array(4 * 4 * 16).fill(-1);
      this.decorateCaves(blocks, cx, cz, topY, climate, caveBiome);
      // features & structures from 3x3 neighborhood
      const chests = [];
      const w = new GEN.ColumnWriter(cx, cz, blocks);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) this.features(w, cx + dx, cz + dz, chests);
      // vegetation (own column)
      this.vegetation(blocks, cx, cz, biome, climate, rng);
      // freeze / snow
      this.freeze(blocks, cx, cz, biome);
      // tints
      const tints = this.tints(cx, cz);
      const out = { blocks, biome, caveBiome, tints, chests };
      CLIMATE_OF.set(out, climate);
      return out;
    }

    carveCaves(blocks, cx, cz, H, climate, biome) {
      const S = GEN.S();
      const x0 = cx * 16, z0 = cz * 16;
      // sample grid 5x5 x (maxY/4)
      let maxH = 0; for (let i = 0; i < 256; i++) if (H[i] > maxH) maxH = H[i];
      const ny = Math.min(64, Math.ceil((maxH + 4) / 4));
      const grid = new Array(25 * (ny + 1));
      for (let j = 0; j <= 4; j++) for (let i = 0; i <= 4; i++) for (let k = 0; k <= ny; k++) grid[(k * 5 + j) * 5 + i] = this.caveSample(x0 + i * 4, k * 4, z0 + j * 4);
      const lo = new Float64Array(3), hi = new Float64Array(3);   // a field's values in the cell's two layers (k, k + 1)
      for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
        const col = lz * 16 + lx, h = H[col], cl = climate[col];
        const underWater = h < SEA + 1;
        const ent = this.entr.n2(x0 + lx, z0 + lz);
        const entrance = ent > 0.42 && !underWater && cl.river < 0.2;
        const protect = entrance ? 0 : (underWater ? 10 : 5);
        const ci = lx >> 2, cj = lz >> 2, fx = (lx & 3) / 4, fz = (lz & 3) / 4;
        const top = Math.min(h - protect, ny * 4 - 1);
        let kc = -1, i00 = 0, aqY = -1000, aqV = 0;
        for (let y = 5; y <= top; y++) {
          const bi = (y << 8) | col;
          const b = blocks[bi];
          if (b !== S.stone && b !== S.deep) continue;
          // the four blocks of a cell layer share the xz interpolation of the layer's corners: computed once per cell
          const k = y >> 2, fy = (y & 3) / 4;
          if (k !== kc) {
            kc = k; i00 = (k * 5 + cj) * 5 + ci;
            for (let n = 0; n < 3; n++) { lo[n] = cornerLerp(grid, i00, n, fx, fz); hi[n] = cornerLerp(grid, i00 + 25, n, fx, fz); }
          }
          const depth = h - y;
          const thr = 0.36 + (y > 60 ? (y - 60) * 0.004 : 0) + (depth < 12 ? (12 - depth) * 0.02 : 0);
          const cheese = Math.fround(lo[0] * (1 - fy) + hi[0] * fy) > thr;
          // the spaghetti fields only matter where the cheese does not carve the block already
          let spag = false;
          if (!cheese) {
            const v1 = Math.fround(lo[1] * (1 - fy) + hi[1] * fy), v2 = Math.fround(lo[2] * (1 - fy) + hi[2] * fy);
            const r = v1 * v1 + v2 * v2;
            const width = 0.0026 + (y < 40 ? 0.0012 : 0) + (entrance ? 0.0015 : 0);
            spag = r < width;
          }
          if (cheese || spag) {
            if (y < 11) blocks[bi] = S.lava;
            else if (y < 40 && cheese) {
              // aquifer: regional water level
              const ax = Math.floor((x0 + lx) / 48), ay = Math.floor(y / 20), az = Math.floor((z0 + lz) / 48);
              if (ay !== aqY) { aqY = ay; aqV = M.hash3(ax, ay, az, this.seed + 99) / 4294967296; }
              const hv = aqV;
              if (hv < 0.3 && y <= ay * 20 + 6 + Math.floor(hv * 30)) blocks[bi] = S.water; else blocks[bi] = 0;
            } else blocks[bi] = 0;
          }
        }
      }
    }
    carveRavines(blocks, cx, cz, H) {
      const S = GEN.S();
      const x0 = cx * 16, z0 = cz * 16;
      for (let rz = cz - 5; rz <= cz + 5; rz++) for (let rx = cx - 5; rx <= cx + 5; rx++) {
        const h0 = M.hash2(rx, rz, this.seed + 4242);
        if (h0 % 60 !== 0) continue;
        const rng = new VR.RNG(h0);
        let px = rx * 16 + rng.int(16), pz = rz * 16 + rng.int(16), py = 20 + rng.int(30);
        let yaw = rng.next() * Math.PI * 2, pitch = (rng.next() - 0.5) * 0.25;
        const len = 70 + rng.int(60), wmax = 2 + rng.next() * 2.5;
        for (let s = 0; s < len; s++) {
          const t = s / len; const wdt = 1 + Math.sin(t * Math.PI) * wmax, hgt = wdt * 3;
          px += Math.cos(yaw); pz += Math.sin(yaw); py += Math.sin(pitch) * 0.6;
          yaw += (rng.next() - 0.5) * 0.12; pitch *= 0.8; pitch += (rng.next() - 0.5) * 0.08;
          if (px < x0 - 12 || px > x0 + 28 || pz < z0 - 12 || pz > z0 + 28) continue;
          const ix0 = Math.max(x0, Math.floor(px - wdt)), ix1 = Math.min(x0 + 15, Math.ceil(px + wdt));
          const iz0 = Math.max(z0, Math.floor(pz - wdt)), iz1 = Math.min(z0 + 15, Math.ceil(pz + wdt));
          for (let x = ix0; x <= ix1; x++) for (let z = iz0; z <= iz1; z++) {
            const dx = (x + 0.5 - px) / wdt, dz = (z + 0.5 - pz) / wdt;
            const dd = dx * dx + dz * dz; if (dd >= 1) continue;
            const col = (z - z0) * 16 + (x - x0), surf = H[col];
            const y0 = Math.max(5, Math.floor(py - hgt)), y1 = Math.min(Math.floor(py + hgt), surf - 6);
            for (let y = y0; y <= y1; y++) {
              const dy = (y + 0.5 - py) / hgt; if (dd + dy * dy * 0.7 >= 1) continue;
              const bi = (y << 8) | col; const b = blocks[bi];
              if (b === S.stone || b === S.deep || b === S.dirt || b === S.gravel) blocks[bi] = y < 11 ? S.lava : 0;
            }
          }
        }
      }
    }

    surface(blocks, cx, cz, H, climate, biome, topY) {
      const S = GEN.S();
      const x0 = cx * 16, z0 = cz * 16;
      for (let col = 0; col < 256; col++) {
        const lx = col & 15, lz = col >> 4, x = x0 + lx, z = z0 + lz;
        let y = 255;
        while (y > 0) { const b = blocks[(y << 8) | col]; if (b !== 0 && b !== S.water && b !== S.lava) break; y--; }
        topY[col] = y;
        const bio = biome[col], B = BIOMES[bio];
        const water = y < 255 && blocks[((y + 1) << 8) | col] === S.water;
        const sn = this.surfN.n2(x, z), pn = this.patchN.n2(x, z);
        const depth = 3 + Math.floor((sn + 0.6) * 2.5);
        let topB = S.grass, fill = S.dirt, deepFill = -1, deepDepth = 0;
        const key = B.key;
        const deepWater = water && y < SEA - 6;
        if (B.ocean || key === 'river' || key === 'frozen_river') {
          if (deepWater) { topB = S.gravel; fill = S.gravel; if (B.warm || key.indexOf('lukewarm') >= 0) { topB = S.sand; fill = S.sand; deepFill = S.sandstone; deepDepth = 3; } }
          else { topB = pn > 0.25 ? S.clay : S.sand; fill = S.sand; deepFill = S.sandstone; deepDepth = 2; }
          if (!water) { topB = S.sand; fill = S.sand; }
        } else if (key === 'desert' || key === 'beach') { topB = S.sand; fill = S.sand; deepFill = S.sandstone; deepDepth = key === 'desert' ? 6 : 3; }
        else if (key === 'snowy_beach') { topB = S.sand; fill = S.sand; deepFill = S.sandstone; deepDepth = 2; }
        else if (key === 'stony_shore') { topB = pn > 0 ? S.stone : S.gravel; fill = S.stone; }
        else if (key.indexOf('badlands') >= 0) { this.badlandsColumn(blocks, col, y, x, z, key); continue; }
        else if (key === 'mushroom_fields') { topB = S.mycelium; }
        else if (key === 'mangrove_swamp') { topB = S.mud; fill = S.mud; }
        else if (key === 'ice_spikes') { topB = S.snowblock; fill = S.dirt; }
        else if (key === 'jagged_peaks' || key === 'frozen_peaks') {
          topB = S.snowblock; fill = S.stone;
          if (key === 'frozen_peaks' && pn > 0.2) topB = S.packed; else if (key === 'frozen_peaks' && pn < -0.35) topB = S.ice;
          if (this.steep(H, col) > 3) { topB = S.stone; }
        }
        else if (key === 'snowy_slopes' || key === 'grove') { topB = pn > 0.3 ? S.powder : S.snowblock; if (key === 'grove' && pn < -0.2) topB = S.grass; if (this.steep(H, col) > 3) topB = S.stone; }
        else if (key === 'stony_peaks') { const strip = this.stripN.n3(x * 0.02, y * 0.2, z * 0.02) > 0.2; topB = strip ? S.calcite : S.stone; fill = strip ? S.calcite : S.stone; }
        else if (key === 'windswept_hills' || key === 'windswept_forest') { if (pn > 0.15) { topB = S.stone; fill = S.stone; } }
        else if (key === 'windswept_gravelly_hills') { if (pn > 0.1) { topB = S.gravel; fill = S.gravel; } else if (pn < -0.3) { topB = S.stone; fill = S.stone; } }
        else if (key === 'windswept_savanna') { if (pn > 0.2) { topB = S.stone; fill = S.stone; } else if (pn < -0.2) topB = S.coarse; }
        else if (key === 'old_growth_pine_taiga' || key === 'old_growth_spruce_taiga') { topB = pn > 0.25 ? S.coarse : pn > -0.1 ? S.podzol : S.grass; }
        else if (key === 'dappled_forest') { topB = pn > 0.15 ? S.coarse : S.grass; }
        else if (key === 'swamp' && y === SEA && pn > 0.2) { topB = S.grass; }
        if (water && topB === S.grass) topB = S.dirt;
        // cliffs: steep terrain shows stone
        if (!water && topB === S.grass && this.steep(H, col) > 5 && y > 95) { topB = S.stone; fill = S.stone; }
        // write layers
        let d = 0;
        for (let yy = y; yy > 0 && d < depth + deepDepth; yy--) {
          const bi = (yy << 8) | col, b = blocks[bi];
          if (b === 0 || b === S.water) break;
          if (b !== S.stone && b !== S.deep) break;
          if (d === 0) blocks[bi] = topB;
          else if (d < depth) blocks[bi] = (topB === S.sand && d === depth - 1 && deepFill < 0) ? S.sand : fill;
          else if (deepFill >= 0) blocks[bi] = deepFill;
          d++;
        }
        // floating sand/gravel → sandstone/stone
        if ((topB === S.sand || topB === S.gravel)) {
          const below = blocks[((y - 1) << 8) | col];
          if (below === 0 && y > 1) blocks[(y << 8) | col] = topB === S.sand ? S.sandstone : S.stone;
        }
      }
    }
    steep(H, col) {
      const lx = col & 15, lz = col >> 4;
      const h = H[col];
      let m = 0;
      if (lx > 0) m = Math.max(m, Math.abs(h - H[col - 1])); if (lx < 15) m = Math.max(m, Math.abs(h - H[col + 1]));
      if (lz > 0) m = Math.max(m, Math.abs(h - H[col - 16])); if (lz < 15) m = Math.max(m, Math.abs(h - H[col + 16]));
      return m;
    }
    badlandsColumn(blocks, col, y, x, z, key) {
      const S = GEN.S();
      const shift = Math.round(this.stripN.n3(x * 0.01, 0, z * 0.01) * 7);
      let d = 0;
      for (let yy = y; yy > 30; yy--) {
        const bi = (yy << 8) | col, b = blocks[bi];
        if (b === 0 || b === S.water) { if (d > 0) break; else continue; }
        if (b !== S.stone && b !== S.deep) break;
        if (d === 0 && yy < 80) blocks[bi] = S.redsand;
        else if (d < 2 && yy < 80) blocks[bi] = st('orange_terracotta');
        else blocks[bi] = this.bands[M.clamp(yy + shift, 0, 255)];
        if (d === 0 && key === 'wooded_badlands' && yy > 94) blocks[bi] = (M.hash2(x, z, 5) & 1) ? S.grass : S.coarse;
        d++;
      }
    }

    ores(blocks, cx, cz, biome, rng) {
      const S = GEN.S();
      const b = biome[136], key = BIOMES[b].key;
      const mountainous = /peaks|slopes|windswept|meadow|grove|cherry/.test(key);
      const blob = (oreName, count, size, y0, y1, peak, replaceOnly) => {
        const ore = st(oreName + '_ore'), dore = st('deepstone_' + oreName + '_ore');
        for (let n = 0; n < count; n++) {
          let y = peak !== undefined ? Math.round(peak + (rng.next() + rng.next() - 1) * (y1 - y0) * 0.5) : rng.irange(y0, y1);
          if (y < y0 || y > y1) continue;
          const lx = 2 + rng.int(12), lz = 2 + rng.int(12);
          let px = lx, py = y, pz = lz;
          for (let k = 0; k < size; k++) {
            if (px >= 0 && px < 16 && pz >= 0 && pz < 16 && py > 0 && py < 256) {
              const bi = (py << 8) | (pz << 4) | px, cur = blocks[bi];
              if (cur === S.stone) blocks[bi] = ore; else if (cur === S.deep) blocks[bi] = dore;
              else if (replaceOnly && cur === replaceOnly) blocks[bi] = ore;
            }
            const d = rng.int(6); px += VR.DX[d]; py += VR.DY[d]; pz += VR.DZ[d];
            if (px < 0 || px > 15 || pz < 0 || pz > 15) { px = lx; pz = lz; py = y; }
          }
        }
      };
      const rockBlob = (s, count, size, y0, y1) => {
        for (let n = 0; n < count; n++) {
          const cxx = rng.int(16), cyy = rng.irange(y0, y1), czz = rng.int(16), r = size;
          for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) for (let dz = -r; dz <= r; dz++) {
            const px = cxx + dx, py = cyy + dy, pz = czz + dz;
            if (px < 0 || px > 15 || pz < 0 || pz > 15 || py < 1 || py > 255) continue;
            if (dx * dx + dy * dy * 1.4 + dz * dz > r * r * (0.7 + rng.next() * 0.3)) continue;
            const bi = (py << 8) | (pz << 4) | px; if (blocks[bi] === S.stone || (s === S.tuff && blocks[bi] === S.deep)) blocks[bi] = s;
          }
        }
      };
      rockBlob(S.granite, 1, 3 + rng.int(2), 5, 90); rockBlob(S.diorite, 1, 3 + rng.int(2), 5, 90); rockBlob(S.andesite, 1, 3 + rng.int(2), 5, 90);
      if (rng.chance(0.5)) rockBlob(S.tuff, 1, 3, 2, 20);
      if (rng.chance(0.4)) rockBlob(S.dirt, 1, 2, 10, 100); if (rng.chance(0.4)) rockBlob(S.gravel, 1, 2, 5, 100);
      blob('coal', 18, 12, 10, 190, 96); blob('coal', mountainous ? 10 : 0, 14, 130, 240);
      blob('iron', 11, 8, 2, 80, 24); if (mountainous) blob('iron', 9, 8, 120, 240, 190);
      blob('copper', key === 'dripstone_caves' ? 22 : 9, 11, 2, 110, 48);
      blob('gold', 4, 7, 2, 40, 16); if (key.indexOf('badlands') >= 0) blob('gold', 16, 7, 32, 90);
      blob('lapis', 3, 6, 2, 50, 18);
      blob('voltite', 6, 7, 2, 22);
      blob('diamond', 5, 5, 2, 18, 4);
      if (mountainous) for (let n = 0; n < 8; n++) { const x = rng.int(16), z = rng.int(16), y = rng.irange(80, 235); const bi = (y << 8) | (z << 4) | x; if (blocks[bi] === S.stone) blocks[bi] = st('emerald_ore'); }
      // ore veins (copper+granite high, iron+tuff deep)
      if (rng.chance(0.14)) {
        const deep = rng.chance(0.4);
        let px = rng.int(16), py = deep ? rng.irange(3, 18) : rng.irange(20, 55), pz = rng.int(16);
        const fill = deep ? S.tuff : S.granite, ore = deep ? st('deepstone_iron_ore') : st('copper_ore'), raw = deep ? st('raw_iron_block') : st('raw_copper_block');
        let a = rng.next() * 6.28;
        for (let s = 0; s < 60; s++) {
          px += Math.cos(a) * 0.8; pz += Math.sin(a) * 0.8; py += (rng.next() - 0.5) * 0.8; a += (rng.next() - 0.5) * 0.5;
          for (let k = 0; k < 3; k++) {
            const ix = Math.round(px + rng.next() * 2 - 1), iy = Math.round(py + rng.next() * 2 - 1), iz = Math.round(pz + rng.next() * 2 - 1);
            if (ix < 0 || ix > 15 || iz < 0 || iz > 15 || iy < 1) continue;
            const bi = (iy << 8) | (iz << 4) | ix, cur = blocks[bi];
            if (cur === S.stone || cur === S.deep || cur === S.tuff || cur === S.granite) { const r = rng.next(); blocks[bi] = r < 0.02 ? raw : r < 0.3 ? ore : fill; }
          }
        }
      }
    }

    decorateCaves(blocks, cx, cz, topY, climate, caveBiome) {
      const S = GEN.S();
      const x0 = cx * 16, z0 = cz * 16;
      const rng = new VR.RNG(M.hash2(cx, cz, this.seed + 17));
      // cave biome per 4x4 xz cell per section
      for (let sy = 0; sy < 16; sy++) for (let cj = 0; cj < 4; cj++) for (let ci = 0; ci < 4; ci++) {
        const lx = ci * 4 + 2, lz = cj * 4 + 2, y = sy * 16 + 8;
        const col = lz * 16 + lx;
        caveBiome[(sy * 4 + cj) * 4 + ci] = y < topY[col] - 8 ? this.caveBiomeFor(climate[col], y, x0 + lx, z0 + lz) : -1;
      }
      const cb = (lx, y, lz) => caveBiome[((y >> 4) * 4 + (lz >> 2)) * 4 + (lx >> 2)];
      const glow = st('glow_lichen', { faces: 0 });
      for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
        const col = lz * 16 + lx, top = topY[col] - 4;
        for (let y = 4; y < top; y++) {
          const bi = (y << 8) | col, b = blocks[bi];
          const bio = cb(lx, y, lz);
          if (bio === BI.sulfur_caves && (b === S.stone || b === S.deep || b === S.tuff)) {
            const layer = Math.floor((y + this.stripN.n3((x0 + lx) * 0.05, y * 0.1, (z0 + lz) * 0.05) * 3) / 3) % 3;
            blocks[bi] = layer === 0 ? S.sulfur : layer === 1 ? S.cinnabar : (rng.chance(0.5) ? S.sulfur : S.tuff);
            continue;
          }
          if (b !== 0) continue;
          const below = blocks[((y - 1) << 8) | col], above = blocks[((y + 1) << 8) | col];
          const belowSolid = below !== 0 && below !== S.water && below !== S.lava && (R.T.flags[below] & VR.F.OPAQUE);
          const aboveSolid = above !== 0 && above !== S.water && above !== S.lava && (R.T.flags[above] & VR.F.OPAQUE);
          if (bio === BI.lush_caves) {
            if (belowSolid) {
              blocks[((y - 1) << 8) | col] = rng.chance(0.08) ? S.clay : S.moss;
              const r = rng.next();
              if (r < 0.25) blocks[bi] = st('moss_carpet'); else if (r < 0.35) blocks[bi] = S.shortgrass; else if (r < 0.38) blocks[bi] = st(rng.chance(0.5) ? 'azalea' : 'flowering_azalea');
              else if (r < 0.43) blocks[bi] = st('small_dripleaf');
            } else if (aboveSolid) {
              blocks[((y + 1) << 8) | col] = S.moss;
              const r = rng.next();
              if (r < 0.12) { const len = 1 + rng.int(6); for (let k = 0; k < len; k++) { const yy = y - k; if (blocks[(yy << 8) | col] !== 0) break; blocks[(yy << 8) | col] = st('glow_berry_vine', { berries: rng.chance(0.3) ? 1 : 0, tip: k === len - 1 ? 1 : 0 }); } }
              else if (r < 0.14) blocks[bi] = st('spore_blossom'); else if (r < 0.2) blocks[bi] = st('hanging_roots');
            }
          } else if (bio === BI.dripstone_caves) {
            if (belowSolid && rng.chance(0.12)) { blocks[((y - 1) << 8) | col] = S.dripblock; const len = 1 + rng.int(3); for (let k = 0; k < len; k++) { if (blocks[((y + k) << 8) | col] !== 0) break; blocks[((y + k) << 8) | col] = st('pointed_dripstone', { dir: 0 }); } }
            else if (aboveSolid && rng.chance(0.14)) { blocks[((y + 1) << 8) | col] = S.dripblock; const len = 1 + rng.int(4); for (let k = 0; k < len; k++) { if (blocks[((y - k) << 8) | col] !== 0) break; blocks[((y - k) << 8) | col] = st('pointed_dripstone', { dir: 1 }); } }
            else if (belowSolid && rng.chance(0.25)) blocks[((y - 1) << 8) | col] = S.dripblock;
          } else if (bio === BI.deep_dark) {
            if (belowSolid) {
              const n = this.patchN.n2((x0 + lx) * 2, (z0 + lz) * 2);
              if (n > -0.1) { blocks[((y - 1) << 8) | col] = S.echomoss; const r = rng.next(); if (r < 0.012) blocks[bi] = st('echo_sensor'); else if (r < 0.018) blocks[bi] = st('echo_horn'); else if (r < 0.03) blocks[((y - 1) << 8) | col] = st('echo_heart'); }
              else if (n > -0.25) blocks[bi] = st('echo_vein', { faces: 32 });
            }
          } else if (bio === BI.sulfur_caves) {
            if (belowSolid && rng.chance(0.08)) { const len = 1 + rng.int(3); for (let k = 0; k < len; k++) { if (blocks[((y + k) << 8) | col] !== 0) break; blocks[((y + k) << 8) | col] = st('sulfur_spike', { dir: 0 }); } }
            else if (aboveSolid && rng.chance(0.1)) { const len = 1 + rng.int(3); for (let k = 0; k < len; k++) { if (blocks[((y - k) << 8) | col] !== 0) break; blocks[((y - k) << 8) | col] = st('sulfur_spike', { dir: 1 }); } }
            else if (belowSolid && rng.chance(0.05)) { blocks[bi] = S.water; blocks[((y - 1) << 8) | col] = S.fuming; }
          } else if (bio === BI.ice_caves) {
            const belowB = blocks[((y - 1) << 8) | col];
            if (belowSolid) {
              if (belowB === S.stone || belowB === S.deep) blocks[((y - 1) << 8) | col] = rng.chance(0.1) ? S.calcite : S.packed;
              const r = rng.next(); if (r < 0.3) blocks[bi] = st('snow', { layers: rng.int(3) }); else if (r < 0.36) blocks[bi] = st('ice_crystal', { facing: 4, size: rng.int(3) });
            } else if (aboveSolid) {
              const ab = blocks[((y + 1) << 8) | col]; if (ab === S.stone || ab === S.deep) blocks[((y + 1) << 8) | col] = S.packed;
              if (rng.chance(0.12)) { const len = 1 + rng.int(3); for (let k = 0; k < len; k++) { if (blocks[((y - k) << 8) | col] !== 0) break; blocks[((y - k) << 8) | col] = st('icicle', { dir: 1 }); } }
            }
            // walls
            for (let f = 0; f < 4; f++) { const nx = lx + VR.HF_DX[f], nz = lz + VR.HF_DZ[f]; if (nx < 0 || nx > 15 || nz < 0 || nz > 15) continue; const ni = (y << 8) | (nz << 4) | nx; if (blocks[ni] === S.stone || blocks[ni] === S.deep) blocks[ni] = S.packed; }
          } else {
            // generic caves: glow lichen on ceilings, rare cobweb
            if (aboveSolid && y < 50 && rng.chance(0.015)) blocks[bi] = st('glow_lichen', { faces: 16 });
            else if (belowSolid && y < 40 && rng.chance(0.004)) blocks[bi] = st('cobweb');
          }
        }
      }
    }

    // ---------------- features & structures for column (fx,fz), clipped by writer ----------------
    surfaceY(x, z) {
      // top of terrain density (ignoring caves: caves are protected near surface except entrances)
      const X0 = Math.floor(x / 4) * 4, Z0 = Math.floor(z / 4) * 4;
      const fx = (x - X0) / 4, fz = (z - Z0) / 4;
      const a = this.densOf(this.corner(X0, Z0)), b = this.densOf(this.corner(X0 + 4, Z0)), c = this.densOf(this.corner(X0, Z0 + 4)), d = this.densOf(this.corner(X0 + 4, Z0 + 4));
      const w00 = (1 - fx) * (1 - fz), w10 = fx * (1 - fz), w01 = (1 - fx) * fz, w11 = fx * fz;
      for (let i = 31; i >= 0; i--) {
        const d0 = a[i] * w00 + b[i] * w10 + c[i] * w01 + d[i] * w11;
        const d1 = a[i + 1] * w00 + b[i + 1] * w10 + c[i + 1] * w01 + d[i + 1] * w11;
        if (d0 > 0 || d1 > 0) {
          for (let y = i * 8 + 7; y >= i * 8; y--) { const f = (y & 7) / 8; if (d0 * (1 - f) + d1 * f > 0) return y; }
        }
      }
      return 0;
    }
    features(w, fcx, fcz, chests) {
      const rng = new VR.RNG(M.hash2(fcx, fcz, this.seed + 1234));
      const fx0 = fcx * 16, fz0 = fcz * 16;
      const cl0 = this.climateAt(fx0 + 8, fz0 + 8);
      const h0 = this.surfaceY(fx0 + 8, fz0 + 8);
      const bio0 = this.biomeFor(cl0, h0), key0 = BIOMES[bio0].key;
      const T = GEN.TREES, SS = GEN.STRUCT;
      const S = GEN.S();
      // how many trees
      const dens = TREE_DENS[key0] || 0;
      let n = Math.floor(dens) + (rng.next() < dens % 1 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const x = fx0 + rng.int(16), z = fz0 + rng.int(16);
        if (this.entr.n2(x, z) > 0.38) continue;
        const y = this.surfaceY(x, z) + 1;
        if (y <= SEA + 1 && key0 !== 'mangrove_swamp' && key0 !== 'swamp') continue;
        if (y <= SEA - 1) continue;
        const cl = this._treeCl = this.climateAt(x, z, this._treeCl);
        const bio = this.biomeFor(cl, y - 1), key = BIOMES[bio].key;
        if (key.indexOf('ocean') >= 0 || key === 'river' || key === 'beach' || key === 'stony_shore' || key === 'desert') continue;
        this.tree(w, key, x, y, z, rng);
      }
      // special vegetation / rocks
      if ((key0 === 'old_growth_pine_taiga' || key0 === 'old_growth_spruce_taiga') && rng.chance(0.5)) { const x = fx0 + rng.int(16), z = fz0 + rng.int(16); T.boulder(w, x, this.surfaceY(x, z) + 1, z, rng); }
      if (key0 === 'ice_spikes') for (let i = 0; i < 2; i++) if (rng.chance(0.6)) { const x = fx0 + 3 + rng.int(10), z = fz0 + 3 + rng.int(10); T.spike(w, x, this.surfaceY(x, z) + 1, z, rng); }
      if (key0 === 'dappled_forest' && rng.chance(0.5)) { const x = fx0 + 2 + rng.int(8), z = fz0 + 2 + rng.int(8); T.fallenLog(w, x, this.surfaceY(x, z) + 1, z, rng); }
      if ((key0 === 'dark_forest' || key0 === 'mushroom_fields') && rng.chance(0.4)) { const x = fx0 + 3 + rng.int(10), z = fz0 + 3 + rng.int(10); const y = this.surfaceY(x, z) + 1; if (y > SEA + 1) T.hugeMushroom(w, x, y, z, rng, rng.chance(0.5)); }
      if (key0.indexOf('frozen_ocean') >= 0 && rng.chance(0.3)) { const x = fx0 + 3 + rng.int(10), z = fz0 + 3 + rng.int(10); for (let i = 0; i < 1; i++) { const h = 5 + rng.int(12), r = 3 + rng.int(4); for (let dy = -6; dy < h; dy++) { const rr = Math.round(r * (1 - Math.max(0, dy) / h)); for (let dx = -rr; dx <= rr; dx++) for (let dz = -rr; dz <= rr; dz++) if (dx * dx + dz * dz <= rr * rr + rng.next()) w.set(x + dx, SEA + dy, z + dz, dy > h - 3 && rng.chance(0.5) ? S.snowblock : rng.chance(0.08) ? S.blueice : S.packed); } } }
      // structures (rare)
      const sr = rng.next();
      // vgen 9 (t-beauty): no random ruin, well, camp or tower on the surface of the Heartland's designed land — 244 of
      // its 5 664 chunks carried an obsidian ruined gate (beside the temple, at the crescent's end, on the plaza's rim),
      // and where the city or the terraces levelled the ground over one, its obsidian was left hanging in the air
      const designed = this.vgen >= 9 && VR.Heart && VR.Heart.noRandom && VR.Heart.noRandom(this, fx0 + 8, fz0 + 8);
      if (sr < 0.11) { const x = fx0 + 4 + rng.int(8), z = fz0 + 4 + rng.int(8), y = 12 + rng.int(40); if (y < this.surfaceY(x, z) - 10) SS.dungeon(w, x, y, z, rng, chests); }
      else if (designed) { /* the designed land keeps its own pieces */ }
      else if (sr < 0.14 && key0 === 'desert') { const x = fx0 + 8, z = fz0 + 8; SS.well(w, x, this.surfaceY(x, z) + 1, z, rng); }
      else if (sr < 0.16 && h0 > SEA + 2 && key0 !== 'river') { const x = fx0 + 6, z = fz0 + 6; SS.ruinedGate(w, x, this.surfaceY(x, z) + 1, z, rng, chests); }
      else if (sr < 0.2 && key0 === 'dappled_forest') { const x = fx0 + 8, z = fz0 + 8; SS.camp(w, x, this.surfaceY(x, z) + 1, z, rng, chests); }
      else if (sr < 0.215 && (key0 === 'plains' || key0 === 'meadow' || key0 === 'forest' || key0 === 'windswept_hills') && h0 > SEA + 3) { const x = fx0 + 8, z = fz0 + 8; SS.tower(w, x, this.surfaceY(x, z) + 1, z, rng, chests); }
      if (rng.chance(0.045)) { const x = fx0 + 5 + rng.int(6), z = fz0 + 5 + rng.int(6), y = 12 + rng.int(36); if (y < this.surfaceY(x, z) - 12) SS.geode(w, x, y, z, rng); }
      if ((cl0.w < -0.4 && cl0.e > 0.2) && rng.chance(0.12) && h0 > SEA + 1 && h0 < 110) { const x = fx0 + 6 + rng.int(4), z = fz0 + 6 + rng.int(4); SS.sulfurSpring(w, x, this.surfaceY(x, z), z, rng); }
    }
    tree(w, key, x, y, z, rng) {
      const T = GEN.TREES;
      switch (key) {
        case 'forest': case 'flower_forest': case 'windswept_forest': return rng.chance(0.25) ? T.birch(w, x, y, z, rng) : rng.chance(0.1) ? T.fancyOak(w, x, y, z, rng) : T.oak(w, x, y, z, rng);
        case 'plains': case 'sunflower_plains': case 'windswept_hills': case 'wooded_badlands': case 'savanna_plateau': case 'windswept_gravelly_hills': return rng.chance(0.3) ? T.fancyOak(w, x, y, z, rng) : T.oak(w, x, y, z, rng);
        case 'meadow': return rng.chance(0.5) ? T.birch(w, x, y, z, rng, { beeNest: 1 }) : T.oak(w, x, y, z, rng, { beeNest: 1 });
        case 'birch_forest': return T.birch(w, x, y, z, rng);
        case 'old_growth_birch_forest': return T.birch(w, x, y, z, rng, { tall: true });
        case 'dark_forest': return rng.chance(0.8) ? T.darkOak(w, x, y, z, rng) : T.oak(w, x, y, z, rng);
        case 'pale_garden': return T.paleOak(w, x, y, z, rng);
        case 'taiga': case 'grove': case 'snowy_taiga': case 'snowy_plains': case 'snowy_slopes': return rng.chance(0.3) ? T.spruce(w, x, y, z, rng, { pine: true }) : T.spruce(w, x, y, z, rng);
        case 'old_growth_pine_taiga': return rng.chance(0.35) ? T.megaSpruce(w, x, y, z, rng, { pine: true }) : T.spruce(w, x, y, z, rng, { pine: rng.chance(0.5) });
        case 'old_growth_spruce_taiga': return rng.chance(0.4) ? T.megaSpruce(w, x, y, z, rng) : T.spruce(w, x, y, z, rng);
        case 'jungle': case 'bamboo_jungle': return rng.chance(0.12) ? T.megaJungle(w, x, y, z, rng) : rng.chance(0.4) ? T.bush(w, x, y, z, rng, 'jungle_log', 'oak_leaves') : T.jungle(w, x, y, z, rng);
        case 'sparse_jungle': return rng.chance(0.5) ? T.bush(w, x, y, z, rng, 'jungle_log', 'oak_leaves') : T.jungle(w, x, y, z, rng);
        case 'savanna': case 'windswept_savanna': return rng.chance(0.8) ? T.acacia(w, x, y, z, rng) : T.oak(w, x, y, z, rng);
        case 'cherry_grove': return T.cherry(w, x, y, z, rng);
        case 'swamp': return T.oak(w, x, y, z, rng, { vines: true });
        case 'mangrove_swamp': return T.mangrove(w, x, y, z, rng);
        case 'dappled_forest': return rng.chance(0.1) ? T.spruce(w, x, y, z, rng) : T.poplar(w, x, y, z, rng);
        case 'mushroom_fields': return T.hugeMushroom(w, x, y, z, rng, rng.chance(0.5));
      }
    }
    vegetation(blocks, cx, cz, biome, climate, rng) {
      const S = GEN.S();
      const x0 = cx * 16, z0 = cz * 16;
      const put = (bi, s) => { blocks[bi] = s; };
      for (let col = 0; col < 256; col++) {
        const key = BIOMES[biome[col]].key;
        let y = 254; while (y > 1 && blocks[(y << 8) | col] === 0) y--;
        const ground = blocks[(y << 8) | col], ai = ((y + 1) << 8) | col;
        if (blocks[ai] !== 0) continue;
        // underwater plants
        if (ground === S.water) {
          let floor = y; while (floor > 1 && blocks[(floor << 8) | col] === S.water) floor--;
          const depth = y - floor;
          const fb = ((floor + 1) << 8) | col;
          if (key.indexOf('ocean') >= 0 || key.indexOf('river') >= 0) {
            const warm = key === 'warm_ocean';
            const r = rng.next();
            if (warm && depth > 3 && r < 0.2) {
              const c = rng.pick(VR.CORALS);
              if (rng.chance(0.4)) { blocks[(floor << 8) | col] = st(c + '_coral_block'); const hh = rng.int(3); for (let k = 0; k < hh && floor + 1 + k < y; k++) blocks[((floor + 1 + k) << 8) | col] = st(c + '_coral_block'); if (floor + 1 + hh < y) blocks[((floor + 1 + hh) << 8) | col] = st(rng.chance(0.5) ? c + '_coral' : c + '_coral_fan'); }
              else blocks[fb] = st(rng.chance(0.5) ? c + '_coral' : c + '_coral_fan');
            } else if (warm && r < 0.24 && depth > 1) blocks[fb] = st('sea_pickle', { pickles: rng.int(4), wet: 1 });
            else if (!warm && key.indexOf('frozen') < 0 && depth > 4 && r < 0.12) {
              const len = Math.min(depth - 1, 3 + rng.int(12));
              for (let k = 0; k < len; k++) blocks[((floor + 1 + k) << 8) | col] = st('kelp', { tip: k === len - 1 ? 1 : 0, age: 0 });
            } else if (r < 0.35 && depth > 1) {
              if (depth > 2 && rng.chance(0.2)) { blocks[fb] = st('tall_seagrass', { half: 0 }); blocks[fb + 256] = st('tall_seagrass', { half: 1 }); }
              else blocks[fb] = st('seagrass');
            }
          } else if ((key === 'swamp' || key === 'mangrove_swamp') && depth <= 2 && rng.chance(0.08)) blocks[ai] = st('lily_pad');
          continue;
        }
        const list = FLORA[key]; if (!list) continue;
        const soilOk = ground === S.grass || ground === S.podzol || ground === S.coarse || ground === S.dirt || ground === S.mud || ground === S.moss || ground === S.mycelium;
        const sandOk = ground === S.sand || ground === S.redsand || R.T.type[ground] === R.byName.terracotta.id || (R.types[R.T.type[ground]] && /terracotta$/.test(R.types[R.T.type[ground]].name));
        for (const [name, p] of list) {
          if (rng.next() >= p) continue;
          const t = R.byName[name]; if (!t) continue;
          const dry = name === 'cactus' || name === 'dead_bush' || name.indexOf('dry') >= 0;
          if (dry ? !sandOk && name !== 'dead_bush' : !soilOk) break;
          if (name === 'sugar_cane') {
            // needs water adjacent
            let wet = false; const lx = col & 15, lz = col >> 4;
            for (let f = 0; f < 4; f++) { const nx = lx + VR.HF_DX[f], nz = lz + VR.HF_DZ[f]; if (nx >= 0 && nx < 16 && nz >= 0 && nz < 16 && blocks[(y << 8) | (nz << 4) | nx] === S.water) wet = true; }
            if (!wet || ground === S.water) break;
            const hh = 1 + rng.int(3); for (let k = 0; k < hh; k++) blocks[((y + 1 + k) << 8) | col] = st('sugar_cane');
          } else if (name === 'cactus') {
            const hh = 1 + rng.int(3); for (let k = 0; k < hh; k++) blocks[((y + 1 + k) << 8) | col] = st('cactus');
            if (rng.chance(0.25)) blocks[((y + 1 + hh) << 8) | col] = st('cactus_flower');
          } else if (name === 'bamboo') {
            const hh = 4 + rng.int(10); for (let k = 0; k < hh; k++) blocks[((y + 1 + k) << 8) | col] = st('bamboo', { leaves: k >= hh - 1 ? 2 : k >= hh - 3 ? 1 : 0, age: 1 });
            if (ground === S.grass) blocks[(y << 8) | col] = S.podzol;
          } else if (t.o.tall) {
            if (blocks[ai + 256] !== 0) break;
            put(ai, t.state({ half: 0 })); put(ai + 256, t.state({ half: 1 }));
          } else if (name === 'leaf_litter' || name === 'pink_petals' || name === 'wildflowers') {
            put(ai, t.state({ count: rng.int(4), facing: rng.int(4) }));
          } else if (name === 'sweet_berry_bush') put(ai, t.state({ age: 2 + rng.int(2) }));
          else if (name === 'melon') put(ai, t.defaultState);
          else put(ai, t.defaultState);
          break;
        }
      }
    }
    freeze(blocks, cx, cz, biome) {
      const S = GEN.S();
      for (let col = 0; col < 256; col++) {
        const B = BIOMES[biome[col]];
        let y = 254; while (y > 1 && blocks[(y << 8) | col] === 0) y--;
        const t = B.temp - Math.max(0, y - 90) * 0.0025;
        if (t >= 0.15) continue;
        const bi = (y << 8) | col, b = blocks[bi];
        if (b === S.water) { blocks[bi] = S.ice; continue; }
        const fl = R.T.flags[b];
        if (b === S.lava || b === S.ice || b === S.packed || b === S.snowblock) { if (b !== S.lava && y < 254) blocks[bi + 256] = S.snow1; continue; }
        if ((fl & VR.F.PLANT) && !(fl & VR.F.SOLID)) { // snow replaces short plants
          const tt = R.types[R.T.type[b]];
          if (tt && tt.o.tall) continue;
          if (b === S.shortgrass || b === S.fern) blocks[bi] = S.snow1;
          continue;
        }
        if ((fl & VR.F.OPAQUE) || (fl & VR.F.LEAVES)) blocks[bi + 256] = S.snow1;
      }
    }
    tints(cx, cz) {
      const x0 = cx * 16, z0 = cz * 16;
      // biome colors on 4-block grid from -8..+24 (9x9), blurred
      const N = 9, grass = new Float32Array(N * N * 3), fol = new Float32Array(N * N * 3), wat = new Float32Array(N * N * 3);
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const X = x0 - 8 + i * 4, Z = z0 - 8 + j * 4;
        const cl = this.corner(X, Z);
        const b = BIOMES[this.biomeFor(cl, cl.H)];
        const k = (j * N + i) * 3;
        const g = b.grass, f = b.foliage, wv = b.water;
        // subtle variation from temperature / humidity
        const vt = 1 + (cl.h - cl.t) * 0.04;
        grass[k] = ((g >> 16) & 255) * (2 - vt); grass[k + 1] = ((g >> 8) & 255) * vt; grass[k + 2] = (g & 255);
        fol[k] = (f >> 16) & 255; fol[k + 1] = (f >> 8) & 255; fol[k + 2] = f & 255;
        wat[k] = (wv >> 16) & 255; wat[k + 1] = (wv >> 8) & 255; wat[k + 2] = wv & 255;
      }
      const out = { grass: new Uint16Array(256), foliage: new Uint16Array(256), water: new Uint16Array(256) };
      const sample = (arr, lx, lz, o) => {
        // gaussian-ish blend over 3x3 corner neighborhood at fractional position
        const gx = (lx + 8) / 4, gz = (lz + 8) / 4;
        let r = 0, g = 0, b = 0, ws = 0;
        const ix = Math.floor(gx), iz = Math.floor(gz);
        for (let dj = -1; dj <= 2; dj++) for (let di = -1; di <= 2; di++) {
          const i = M.clamp(ix + di, 0, N - 1), j = M.clamp(iz + dj, 0, N - 1);
          const dx = gx - (ix + di), dz = gz - (iz + dj);
          const wgt = Math.max(0, 1 - Math.sqrt(dx * dx + dz * dz) / 2.2);
          const k = (j * N + i) * 3; r += arr[k] * wgt; g += arr[k + 1] * wgt; b += arr[k + 2] * wgt; ws += wgt;
        }
        return VR.rgb565(Math.min(255, r / ws) | 0, Math.min(255, g / ws) | 0, Math.min(255, b / ws) | 0);
      };
      for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
        const i = lz * 16 + lx;
        out.grass[i] = sample(grass, lx, lz); out.foliage[i] = sample(fol, lx, lz); out.water[i] = sample(wat, lx, lz);
      }
      return out;
    }
    // spawn point search helper
    findSpawn() {
      for (let r = 0; r < 4000; r += 16) {
        for (let a = 0; a < 8; a++) {
          const x = Math.round(Math.cos(a * 0.785) * r), z = Math.round(Math.sin(a * 0.785) * r);
          const y = this.surfaceY(x, z);
          const cl = this.climateAt(x, z);
          const b = BIOMES[this.biomeFor(cl, y)];
          if (y > SEA + 1 && !b.ocean && !b.river && b.key !== 'stony_shore' && y < 120 && this.entr.n2(x, z) < 0.38) return [x + 0.5, y + 1, z + 0.5];
        }
      }
      return [0.5, 100, 0.5];
    }
  }
  // the climates of a chunk's columns, as generate made them (the post passes of the layers read them)
  OverworldGen.climateOf = (out) => CLIMATE_OF.get(out);
  VR.OverworldGen = OverworldGen;
})(VR);
