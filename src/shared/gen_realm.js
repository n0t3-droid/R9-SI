// ============================================================================
// Realm layer for the Overworld — the look of the concept art:
//  · Prism Fields / Crystal Highlands: violet grass, giant glowing crystal spires
//  · Ember Canyons: red-ochre mesas cut by lava rivers, basalt & ember veins
//  · Aether rivers: glowing blue energy instead of water in realm biomes
//  · Sky islands with waterfalls / aetherfalls drifting over every biome
//  · Starforge outposts: landing pad + docked shuttle, control tower, turrets,
//    elevated maglev rails; crystal meteor craters
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R, GEN = VR.GEN, M = VR.M, SEA = VR.C.SEA, F = VR.F;
  const st = (n, p) => R.S(n, p);
  const B = VR.BIOMES, BI = VR.BIOME;
  function addBiome(key, name, temp, down, grass, foliage, water, sky, o) {
    const e = Object.assign({ id: B.length, key, name, temp, down, grass, foliage, water, sky, fog: null, precip: temp < 0.15 ? 'snow' : (down <= 0 ? 'none' : 'rain') }, o || {});
    B.push(e); BI[key] = e.id; return e;
  }
  addBiome('prism_fields', 'Prism Fields', 0.6, 0.7, 0x9c84ff, 0xd07cff, 0x5ae8ff, 0x9aa4ff, { realm: 1 });
  addBiome('crystal_highlands', 'Crystal Highlands', 0.35, 0.6, 0x8aa0ff, 0xb08aff, 0x5ae8ff, 0xa0b0ff, { realm: 1 });
  addBiome('ember_canyons', 'Ember Canyons', 2.0, 0.0, 0xc8a060, 0xb08040, 0x3ac8ff, 0xffb080, { realm: 1, fog: 0x9a5a3a });

  let S = null;
  function states() {
    if (S) return S;
    S = Object.assign({}, GEN.S(), {
      aether: st('aether'), duskrock: st('duskrock'), ochre: st('ochre_rock'), umber: st('umber_rock'), emberOchre: st('ember_ochre'), aetherStone: st('aether_stone'), skySoil: st('skyroot_soil'),
      terraOrange: st('orange_terracotta'), terraRed: st('red_terracotta'), terraBrown: st('brown_terracotta'), terraYellow: st('yellow_terracotta'),
      hull: st('hull_plating'), hullGray: st('hull_plating_gray'), hullDark: st('hull_plating_dark'), pad: st('landing_pad'), hazard: st('hazard_stripes'),
      viewport: st('viewport'), neonCyan: st('neon_cyan'), neonMag: st('neon_magenta'), neonAmber: st('neon_amber'), panel: st('tech_panel'), panelA: st('tech_panel_amber'), panelV: st('tech_panel_violet'),
      lightPanel: st('light_panel', { facing: 5 }), lightPanelUp: st('light_panel', { facing: 4 }), vent: st('vent'), grate: st('metal_grate'), reactor: st('reactor_core'),
      hullSlab: st('hull_slab', { type: 0 }), darkSlab: st('dark_hull_slab', { type: 0 }), darkSlabTop: st('dark_hull_slab', { type: 1 }), beacon: st('launch_beacon'), turret: st('turret'),
      antenna: st('antenna'), prail: st('powered_rail', { shape: 0, powered: 1 }), prailX: st('powered_rail', { shape: 1, powered: 1 }), stripeO: st('hull_stripe_orange', { axis: 2 }), stripeB: st('hull_stripe_blue', { axis: 2 }),
      magma: st('magma_block'), obsidian: st('obsidian'),
    });
    return S;
  }
  const CRY = ['violet', 'azure', 'verdant', 'rose', 'amber'];
  const cryBlock = (c) => st(c + '_crystal_block');
  const cryCluster = (c, facing, big) => st(c + '_crystal_cluster', { facing, size: big ? 1 : 0 });

  const OG = VR.OverworldGen.prototype;
  function realmNoise(g) {
    if (g.nRealm) return;
    const s = g.seed, Fr = VR.Fractal;
    g.nRealm = new Fr(s ^ 0x5a17e3, 3, 1 / 820, 0.5);
    g.nMesa = new Fr(s ^ 0x6b28f4, 2, 1 / 90, 0.5);
    g.nCanyon = new Fr(s ^ 0x7c3905, 3, 1 / 260, 0.5);
    g.nIsle = new Fr(s ^ 0x8d4a16, 3, 1 / 120, 0.55);
    g.nIsleR = new Fr(s ^ 0x9e5b27, 2, 1 / 700, 0.5);
    g.nIsleH = new Fr(s ^ 0xaf6c38, 2, 1 / 400, 0.5);
    g.nVein = new Fr(s ^ 0xb07d49, 2, 1 / 18, 0.5);
    g.nCry = new Fr(s ^ 0xc18e5a, 2, 1 / 160, 0.5);
    g.nCrack = new Fr(s ^ 0xd29f6b, 2, 1 / 70, 0.5);
    g.nCrack2 = new Fr(s ^ 0xe3a07c, 2, 1 / 44, 0.5);
  }
  VR.realmNoise = realmNoise;   // (the vents of the Ember Canyon read the crack noise: gen_canyon.js)

  // ---------------- climate & terrain shaping ----------------
  const origCompute = OG.computeClimate;
  OG.computeClimate = function (X, Z) {
    const c = origCompute.call(this, X, Z);
    realmNoise(this);
    c.ember = 0; c.prism = 0; c.canyon = 0;
    if (this.singleBiome >= 0 || this.flat) return c;
    const r = M.clamp(this.nRealm.n2(X, Z) * 1.9, -1, 1);
    const warm = M.smoothstep(-0.05, 0.3, c.t) * (1 - M.smoothstep(0.35, 0.6, c.h));
    const inland = M.smoothstep(-0.02, 0.18, c.c);
    const ember = M.smoothstep(0.34, 0.5, r) * warm * inland;
    const prism = M.smoothstep(0.34, 0.5, -r) * inland * (1 - M.smoothstep(0.55, 0.8, c.mountain));
    c.ember = ember; c.prism = prism;
    if (ember > 0.001) {
      const mesa = 90 + this.nMesa.n2(X, Z) * 14 + c.pv * 8;
      let H = M.lerp(c.H, Math.max(c.H, mesa), ember * 0.92);
      const cn = Math.abs(this.nCanyon.n2(X, Z));
      const canyon = (1 - M.smoothstep(0.04, 0.12, cn)) * ember;
      c.canyon = canyon;
      H = M.lerp(H, 53, canyon);
      c.H = H; c.A = M.lerp(c.A, 2.2, ember * 0.8);
    }
    if (prism > 0.001) { c.H = M.lerp(c.H, c.H + 5 + Math.max(0, c.pv) * 10, prism * 0.7); c.A += prism * 3; }
    return c;
  };
  // every value of a corner that a block's climate interpolates (a later layer — the Heartland — adds its own here,
  // so one pass over the four corners serves them all)
  const KEYS = OG.CLIMATE_KEYS = ['c', 'e', 'w', 't', 'h', 'pv', 'H', 'river', 'mountain', 'windswept', 'swampy', 'inland', 'plateau', 'ember', 'prism', 'canyon'];
  // written out field by field (the same sums as a loop over KEYS, the same order): a loop reads and writes every value
  // by a computed name, which cost more than the rest of a column (800 climates a column)
  // a block's climate (climateAt): the fields the layers interpolate
  class Climate {
    constructor() {
      this.c = 0; this.e = 0; this.w = 0; this.t = 0; this.h = 0; this.pv = 0; this.H = 0; this.river = 0; this.mountain = 0;
      this.windswept = 0; this.swampy = 0; this.inland = 0; this.plateau = 0; this.ember = 0; this.prism = 0; this.canyon = 0;
      this.heart = 0; this.hz1 = 0; this.hz2 = 0; this.hz3 = 0;
    }
  }
  // out (optional): the object to write the climate into (a caller that reads it at once passes its own)
  OG.climateAt = function (x, z, out) {
    const X0 = Math.floor(x / 4) * 4, Z0 = Math.floor(z / 4) * 4;
    const fx = (x - X0) / 4, fz = (z - Z0) / 4;
    const a = this.corner(X0, Z0), b = this.corner(X0 + 4, Z0), c = this.corner(X0, Z0 + 4), d = this.corner(X0 + 4, Z0 + 4);
    const w00 = (1 - fx) * (1 - fz), w10 = fx * (1 - fz), w01 = (1 - fx) * fz, w11 = fx * fz;
    const o = out || new Climate();
    o.c = (a.c || 0) * w00 + (b.c || 0) * w10 + (c.c || 0) * w01 + (d.c || 0) * w11;
    o.e = (a.e || 0) * w00 + (b.e || 0) * w10 + (c.e || 0) * w01 + (d.e || 0) * w11;
    o.w = (a.w || 0) * w00 + (b.w || 0) * w10 + (c.w || 0) * w01 + (d.w || 0) * w11;
    o.t = (a.t || 0) * w00 + (b.t || 0) * w10 + (c.t || 0) * w01 + (d.t || 0) * w11;
    o.h = (a.h || 0) * w00 + (b.h || 0) * w10 + (c.h || 0) * w01 + (d.h || 0) * w11;
    o.pv = (a.pv || 0) * w00 + (b.pv || 0) * w10 + (c.pv || 0) * w01 + (d.pv || 0) * w11;
    o.H = (a.H || 0) * w00 + (b.H || 0) * w10 + (c.H || 0) * w01 + (d.H || 0) * w11;
    o.river = (a.river || 0) * w00 + (b.river || 0) * w10 + (c.river || 0) * w01 + (d.river || 0) * w11;
    o.mountain = (a.mountain || 0) * w00 + (b.mountain || 0) * w10 + (c.mountain || 0) * w01 + (d.mountain || 0) * w11;
    o.windswept = (a.windswept || 0) * w00 + (b.windswept || 0) * w10 + (c.windswept || 0) * w01 + (d.windswept || 0) * w11;
    o.swampy = (a.swampy || 0) * w00 + (b.swampy || 0) * w10 + (c.swampy || 0) * w01 + (d.swampy || 0) * w11;
    o.inland = (a.inland || 0) * w00 + (b.inland || 0) * w10 + (c.inland || 0) * w01 + (d.inland || 0) * w11;
    o.plateau = (a.plateau || 0) * w00 + (b.plateau || 0) * w10 + (c.plateau || 0) * w01 + (d.plateau || 0) * w11;
    o.ember = (a.ember || 0) * w00 + (b.ember || 0) * w10 + (c.ember || 0) * w01 + (d.ember || 0) * w11;
    o.prism = (a.prism || 0) * w00 + (b.prism || 0) * w10 + (c.prism || 0) * w01 + (d.prism || 0) * w11;
    o.canyon = (a.canyon || 0) * w00 + (b.canyon || 0) * w10 + (c.canyon || 0) * w01 + (d.canyon || 0) * w11;
    o.heart = (a.heart || 0) * w00 + (b.heart || 0) * w10 + (c.heart || 0) * w01 + (d.heart || 0) * w11;
    o.hz1 = (a.hz1 || 0) * w00 + (b.hz1 || 0) * w10 + (c.hz1 || 0) * w01 + (d.hz1 || 0) * w11;
    o.hz2 = (a.hz2 || 0) * w00 + (b.hz2 || 0) * w10 + (c.hz2 || 0) * w01 + (d.hz2 || 0) * w11;
    o.hz3 = (a.hz3 || 0) * w00 + (b.hz3 || 0) * w10 + (c.hz3 || 0) * w01 + (d.hz3 || 0) * w11;
    return o;
  };
  const origBiome = OG.biomeFor;
  OG.biomeFor = function (cl, height) {
    if (this.singleBiome >= 0) return this.singleBiome;
    if (cl.ember > 0.5 && height > SEA - 14 && cl.river < 0.6) return BI.ember_canyons;
    if (cl.prism > 0.5 && height > SEA - 1 && cl.river < 0.55) return height > 112 ? BI.crystal_highlands : BI.prism_fields;
    return origBiome.call(this, cl, height);
  };
  const origSpawn = OG.findSpawn;
  OG.findSpawn = function () {
    // prefer a scenic realm spawn: prism fields near ember canyons, else anything nice
    realmNoise(this);
    let best = null;
    for (let r = 0; r < 3000 && !best; r += 48) {
      for (let a = 0; a < 12; a++) {
        const x = Math.round(Math.cos(a * 0.5236 + r * 0.01) * r), z = Math.round(Math.sin(a * 0.5236 + r * 0.01) * r);
        const cl = this.climateAt(x, z);
        const y = this.surfaceY(x, z);
        const b = B[this.biomeFor(cl, y)];
        if (b.key === 'prism_fields' && y > SEA + 2 && y < 110 && cl.river < 0.2 && this.entr.n2(x, z) < 0.3) { best = [x + 0.5, y + 1, z + 0.5]; break; }
      }
    }
    return best || origSpawn.call(this);
  };

  // ---------------- sky islands ----------------
  // archipelagos of floating islands (as in the trailer): each 72-block cell of an island region may hold
  // one island — a grassy, slightly domed top over a deep, jagged, inverted-mountain underside; big ones
  // are rarer, heights vary from 125 to 195. Outlines are domain-warped so no island is a disc.
  const ICELL = 72;
  OG.islandCell = function (i, j) {
    // by i, then j: Smi keys (a double key is boxed at every lookup)
    const cache = this._isleCells || (this._isleCells = { rows: new Map(), n: 0 });
    let row = cache.rows.get(i);
    if (row !== undefined) { const hit = row.get(j); if (hit !== undefined) return hit; }
    if (cache.n > 4000) { cache.rows.clear(); cache.n = 0; row = undefined; }
    let c = null;
    const h = (k) => (M.hash2(i * 7 + k, j * 13 - k, this.seed + 31337) >>> 0) / 4294967296;
    const x = i * ICELL + 14 + h(1) * (ICELL - 28), z = j * ICELL + 14 + h(2) * (ICELL - 28);
    const region = this.nIsleR.n2(x, z);
    if (region > 0.02 && h(3) < 0.35 + region * 1.4) {
      const big = Math.pow(h(4), 1.6);
      c = { x, z, r: 8 + big * 24, y: 128 + h(5) * 64, dome: 1.5 + h(6) * 4, deep: 1.0 + h(7) * 1.1, seed: (h(8) * 1000) | 0, falls: big > 0.15 ? 1 + Math.floor(h(9) * 2.99) : (h(9) < 0.4 ? 1 : 0) };
    }
    if (row === undefined) { row = new Map(); cache.rows.set(i, row); }
    row.set(j, c); cache.n++;
    return c;
  };
  // the column of one island at (x, z): its top and bottom, or null outside its (domain-warped) outline
  OG.islandShape = function (I, x, z) {
    realmNoise(this);
    const dx = x - I.x, dz = z - I.z;
    if (Math.abs(dx) > I.r * 1.35 || Math.abs(dz) > I.r * 1.35) return null;
    const warp = this.nIsle.n2(x * 0.9 + I.seed, z * 0.9) * (I.warp !== undefined ? I.warp : 0.28);
    const R = I.r * (1 + warp);
    const d = Math.hypot(dx, dz);
    if (d >= R) return null;
    const t = 1 - d / R;
    const top = Math.round(I.y + Math.min(1, t * 2.4) * I.dome + this.nVein.n2(x * 0.5, z * 0.5) * 1.2);
    const jag = 0.5 + 0.5 * Math.abs(this.nIsleH.n2(x * 7 + I.seed, z * 7));
    const bottom = Math.round(I.y - 2 - Math.pow(t, 0.75) * I.r * I.deep * jag);
    return { top, bottom: Math.min(bottom, top - 2), k: t, isle: I };
  };
  OG.islandAt = function (x, z) {
    realmNoise(this);
    if (this.singleBiome >= 0) return null;
    let best = null;
    // designed islands (the Heartland's Sky Isles) come first
    const D = this.designedIslands ? this.designedIslands(x, z) : null;
    if (D) for (const I of D) { const sh = this.islandShape(I, x, z); if (sh && (!best || sh.top > best.top)) best = sh; }
    const ci = Math.floor(x / ICELL), cj = Math.floor(z / ICELL);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const I = this.islandCell(ci + di, cj + dj);
      if (!I) continue;
      const sh = this.islandShape(I, x, z);
      if (sh && (!best || sh.top > best.top)) best = sh;
    }
    return best;
  };
  // every island whose outline may reach the chunk at (x0, z0): the 3×3 cells around it plus designed ones
  OG.islandsNear = function (x0, z0) {
    const out = [];
    const D = this.designedIslands ? this.designedIslands(x0 + 8, z0 + 8) : null;
    if (D) for (const I of D) out.push(I);
    const ci = Math.floor((x0 + 8) / ICELL), cj = Math.floor((z0 + 8) / ICELL);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const I = this.islandCell(ci + di, cj + dj); if (I) out.push(I); }
    return out;
  };

  // ---------------- post-generation ----------------
  const origGen = OG.generate;
  OG.generate = function (cx, cz) {
    const out = origGen.call(this, cx, cz);
    if (this.singleBiome < 0) realmPost(this, cx, cz, out);
    return out;
  };

  function topSolid(blocks, col) {
    let y = 254;
    while (y > 1) { const b = blocks[(y << 8) | col]; if (b && !(R.T.flags[b] & (F.FLUID | F.REPLACE | F.PLANT | F.LEAVES)) && (R.T.flags[b] & F.SOLID)) break; y--; }
    return y;
  }

  function realmPost(g, cx, cz, out) {
    const S = states();
    const blocks = out.blocks, biome = out.biome;
    const x0 = cx * 16, z0 = cz * 16;
    const cls = VR.OverworldGen.climateOf(out);   // the columns' climates, as generate made them (the same values as climateAt)
    const rng = new VR.RNG(M.hash2(cx, cz, g.seed + 777));
    const T = R.T;
    const bands = g.realmBands || (g.realmBands = (() => { const r = new VR.RNG(g.seed ^ 0xbadc0de); const arr = new Uint16Array(256); const pal = [S.ochre, S.ochre, S.umber, S.terraOrange, S.terraRed, S.ochre, S.terraBrown, S.umber, S.terraYellow]; for (let y = 0; y < 256; y++) arr[y] = pal[r.int(pal.length)]; for (let i = 0; i < 30; i++) { const y = r.int(256); for (let k = 0; k < 2 + r.int(3) && y + k < 256; k++) arr[y + k] = r.chance(0.5) ? S.ochre : S.umber; } return arr; })());
    for (let col = 0; col < 256; col++) {
      const lx = col & 15, lz = col >> 4, x = x0 + lx, z = z0 + lz;
      const key = B[biome[col]].key;
      const cl = cls ? cls[col] : g.climateAt(x, z);
      if (key === 'ember_canyons' || cl.ember > 0.45) {
        // lava rivers in canyon floors, dry above; the Heartland's river channel runs cyan aether instead (the trailer's
        // glowing river, TRAILER.md §2.2)
        const aetherRiver = cl.heart > 0.5 && cl.river > 0.5;
        for (let y = SEA; y > 20; y--) {
          const i = (y << 8) | col, b = blocks[i];
          if (b === S.water) blocks[i] = y <= 59 ? (aetherRiver ? S.aether : S.lava) : 0;
        }
        // banded ochre walls
        const top = topSolid(blocks, col);
        const shift = Math.round(g.stripN.n3(x * 0.012, 0, z * 0.012) * 6);
        const steep = g.steep ? 0 : 0;
        void steep;
        let d = 0;
        for (let y = top; y > Math.max(8, top - 60); y--) {
          const i = (y << 8) | col, b = blocks[i];
          if (!b) { if (d > 0) d = 0; continue; }
          const fl = T.flags[b];
          if (fl & F.FLUID) continue;
          if (b === S.stone || b === S.dirt || b === S.grass || b === S.sand || b === S.gravel || b === S.deep || b === S.coarse || b === S.sandstone || b === S.andesite || b === S.diorite || b === S.granite || b === S.tuff) {
            let s = bands[M.clamp(y + shift, 0, 255)];
            if (d === 0) { const above = blocks[((y + 1) << 8) | col]; s = (above === 0 || (T.flags[above] & F.PLANT)) && cl.canyon < 0.25 && y > 70 ? S.redsand : s; }
            if (g.nVein.n3 ? false : false) s = S.emberOchre;
            if (d > 2 && rng.chance(0.012)) s = S.emberOchre;
            blocks[i] = s;
            d++;
          } else d++;
        }
        // lava banks → magma / basalt
        for (let y = 50; y <= 60; y++) {
          const i = (y << 8) | col;
          if (blocks[i] !== S.lava) continue;
          const below = ((y - 1) << 8) | col;
          if (blocks[below] && blocks[below] !== S.lava && !(T.flags[blocks[below]] & F.FLUID)) blocks[below] = rng.chance(0.35) ? S.magma : S.basalt;
        }
        // glowing lava cracks across the mesa tops (the trailer's orange lines): magma seams along a noise ridge,
        // with a few open lava pools where two cracks meet
        const ty = topSolid(blocks, col), ai = ((ty + 1) << 8) | col;
        if (ty > 66 && cl.canyon < 0.3 && blocks[ai] === 0) {
          const cr = g.nCrack.n2(x, z), cr2 = g.nCrack2.n2(x, z);
          const wdt = 0.028 + cl.ember * 0.02;
          if (Math.abs(cr) < wdt || Math.abs(cr2) < wdt * 0.6) {
            const pool = Math.abs(cr) < 0.012 && Math.abs(cr2) < 0.012;
            blocks[(ty << 8) | col] = pool ? S.lava : S.magma;
            if (pool) blocks[((ty - 1) << 8) | col] = S.magma;
            if (Math.abs(cr) < wdt * 0.35 && !pool) blocks[((ty - 1) << 8) | col] = S.magma;
          } else if (Math.abs(cr) < wdt * 2.2 && rng.chance(0.5)) blocks[(ty << 8) | col] = S.basalt; // scorched rim
        }
        // dry vegetation
        if (blocks[ai] === 0 && (blocks[(ty << 8) | col] === S.redsand || blocks[(ty << 8) | col] === S.ochre)) {
          const r = rng.next();
          if (r < 0.012) blocks[ai] = S.deadbush; else if (r < 0.02) blocks[ai] = st('short_dry_grass');
        }
      } else if (key === 'prism_fields' || key === 'crystal_highlands') {
        const top = topSolid(blocks, col);
        // duskrock under the soil with glowing aether veins
        for (let y = top - 3; y > Math.max(4, top - 26); y--) {
          const i = (y << 8) | col;
          if (blocks[i] === S.stone) {
            const v = g.nVein.n3(x, y * 1.3, z);
            blocks[i] = Math.abs(v) < 0.045 ? S.aetherStone : S.duskrock;
          }
        }
        // vegetation: violet grass, flowers, small crystals
        const ai = ((top + 1) << 8) | col, gb = blocks[(top << 8) | col];
        if (blocks[ai] === 0 && gb === S.grass) {
          const r = rng.next();
          const cc = CRY[Math.floor((g.nCry.n2(x, z) * 0.5 + 0.5) * 4.999)];
          if (r < 0.018) blocks[ai] = cryCluster(cc, 4, rng.chance(0.4));
          else if (r < 0.26) blocks[ai] = S.shortgrass;
          else if (r < 0.3 && blocks[ai + 256] === 0) { blocks[ai] = st('tall_grass', { half: 0 }); blocks[ai + 256] = st('tall_grass', { half: 1 }); }
          else if (r < 0.315) blocks[ai] = st('allium');
          else if (r < 0.33) blocks[ai] = st('azure_bluet');
          else if (r < 0.334) blocks[ai] = st('sunstone');
        }
      }
      // aether rivers & lakes in realm regions
      if ((cl.prism > 0.35 || cl.ember > 0.35) && cl.river > 0.25) {
        for (let y = SEA; y > 30; y--) { const i = (y << 8) | col; if (blocks[i] === S.water) blocks[i] = S.aether; else if (blocks[i] && !(T.flags[blocks[i]] & F.FLUID)) break; }
      }
    }
    // ---- sky islands (terrain) ----
    const ISL = g._islStates || (g._islStates = { tuff: st('tuff') || S.stone, andesite: st('andesite') || S.stone, granite: st('granite') || S.stone,
      moss: st('moss_block') || S.dirt, strata: [S.ochre, S.umber, S.terraOrange, S.ochre, S.terraBrown, S.umber, S.terraRed].map(s => s || S.dirt) });
    const isl = new Array(256);
    for (let col = 0; col < 256; col++) {
      const x = x0 + (col & 15), z = z0 + (col >> 4);
      const I = g.islandAt(x, z);
      isl[col] = I;
      if (!I) continue;
      const cl = g.climateAt(x, z);
      const ember = (cl.ember > 0.45 && !(I.isle && I.isle.designed)) || !!(I.isle && I.isle.lava && I.k > 0.9), prism = cl.prism > 0.45 && !(I.isle && I.isle.designed), cold = cl.t < -0.35;
      for (let y = Math.max(1, I.bottom); y <= Math.min(250, I.top); y++) {
        const i = (y << 8) | col;
        let s;
        if (y === I.top) s = ember ? S.redsand : cold ? S.snowblock : S.grass;
        else if (y >= I.top - 3) s = ember ? S.ochre : S.dirt;
        else {
          // layered underside: soil, warm sandstone-like bands, grey rock, dark tuff at the dangling tips
          const v = g.nVein.n3(x, y * 1.5, z);
          const depth = I.top - y, band = (y + ((I.isle ? I.isle.seed : 0) & 7)) % 9;
          if (prism) s = Math.abs(v) < 0.05 ? S.aetherStone : S.duskrock;
          else if (ember) s = band < 3 ? S.ochre : S.umber;
          else if (g.vgen >= 9 && !(I.isle && I.isle.designed) && depth > 4 && (depth <= 4 + 6 + ((I.isle ? I.isle.seed : 0) % 5) || y - I.bottom <= 2)) {
            // vgen 9 (t-beauty): the trailer's islands (TRAILER.md §3.6, t1_07 · t1_09): under four of soil, six to ten
            // bands of warm strata (ochre, umber, terracotta), and at the dangling tips moss among the dark tuff — seen
            // from a ridge, vgen 8's islands hung as grey cones of stone over the horizon (beauty_audit run 2, far_2)
            s = y - I.bottom <= 2 && depth > 10 ? (rng.chance(0.55) ? ISL.moss : ISL.tuff) : ISL.strata[(y + ((I.isle ? I.isle.seed : 0) & 7)) % ISL.strata.length];
          }
          else if (depth <= 6) s = band < 2 ? S.coarse || S.dirt : S.dirt;
          else if (y - I.bottom <= 3) s = ISL.tuff;
          else s = Math.abs(v) < 0.05 ? ISL.andesite : band === 0 ? ISL.granite : band === 4 ? ISL.andesite : S.stone;
          if (rng.chance(0.004)) s = st(rng.chance(0.6) ? 'iron_ore' : 'diamond_ore');
          if (!prism && !ember && y - I.bottom <= 2 && rng.chance(0.05)) s = cryBlock(CRY[rng.int(5)]); // glowing crystal tips
        }
        blocks[i] = s;
      }
      // hanging roots & glow vines under islands
      if (I.k > 0.3 && rng.chance(0.08)) { const len = 1 + rng.int(4); for (let k = 1; k <= len; k++) { const i = ((I.bottom - k) << 8) | col; if (blocks[i]) break; blocks[i] = k === len ? st('hanging_roots') : st('hanging_roots'); } }
      // surface plants on islands
      const ai = ((I.top + 1) << 8) | col;
      if (blocks[ai] === 0 && !ember && !cold && rng.chance(0.3)) blocks[ai] = rng.chance(0.85) ? S.shortgrass : st(rng.pick(['poppy', 'dandelion', 'cornflower', 'allium']));
    }
    // waterfalls / aetherfalls / lavafalls: 2×2 columns pouring off chosen rim points all the way down
    {
      for (const I of g.islandsNear(x0, z0)) {
        if (!I || !I.falls) continue;
        for (let f = 0; f < I.falls; f++) {
          const a = ((I.seed * 0.618 + f * 0.37) % 1) * Math.PI * 2;
          // walk outward from the centre to the last island column in that direction
          let fx = 0, fz = 0, ft = null;
          for (let r = 0; r < I.r * 1.4; r += 1) {
            const px = Math.round(I.x + Math.cos(a) * r), pz = Math.round(I.z + Math.sin(a) * r);
            const J = g.islandAt(px, pz);
            if (J && J.isle === I) { fx = px; fz = pz; ft = J; } else if (ft) break;
          }
          if (!ft) continue;
          const cl = g.climateAt(fx, fz);
          const fluid = I.lava ? S.lava : cl.ember > 0.45 ? S.lava : cl.prism > 0.35 ? S.aether : S.water;
          const typ = R.types[R.T.type[fluid]];
          const out1 = [Math.round(Math.cos(a)), Math.round(Math.sin(a))];
          for (const [ox, oz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
            // spring pool on the rim, falling curtain just outside it
            const sx = fx + ox - (out1[0] > 0 ? 1 : 0), sz = fz + oz - (out1[1] > 0 ? 1 : 0);
            const lx = sx - x0, lz = sz - z0;
            if (lx >= 0 && lx < 16 && lz >= 0 && lz < 16) {
              const J = g.islandAt(sx, sz);
              if (J && J.isle === I) {
                const pi = ((J.top) << 8) | (lz << 4) | lx;
                blocks[pi] = fluid;
                // vgen 9 (t-beauty): the grass and flowers the top grew there go with the soil — vgen 8 left them
                // standing on the pool's water (the audit's lake scan: nothing hovers)
                if (g.vgen >= 9) {
                  const PL = g._poolPlants || (g._poolPlants = new Set(['short_grass', 'tall_grass', 'fern', 'poppy', 'dandelion', 'cornflower', 'allium', 'azure_bluet'].map(n => R.byName[n] && R.byName[n].id).filter(v => v !== undefined)));
                  for (let k = pi + 256; k < pi + 768 && k < blocks.length && blocks[k] && PL.has(R.T.type[blocks[k]]); k += 256) blocks[k] = 0;
                }
              }
            }
            const cx2 = fx + out1[0] + ox - (out1[0] > 0 ? 1 : 0), cz2 = fz + out1[1] + oz - (out1[1] > 0 ? 1 : 0);
            const qx = cx2 - x0, qz = cz2 - z0;
            if (qx < 0 || qx >= 16 || qz < 0 || qz >= 16) continue;
            const col = (qz << 4) | qx;
            for (let y = ft.top; y > 2; y--) {
              const i = (y << 8) | col, b = blocks[i];
              if (b && (R.T.flags[b] & F.SOLID)) break;
              if (b && (R.T.flags[b] & F.FLUID) && y < ft.bottom) break;
              blocks[i] = typ.state({ level: 8 });
            }
          }
        }
      }
    }
    // ---- multi-column features from the 3x3 neighbourhood ----
    const w = new GEN.ColumnWriter(cx, cz, blocks);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) realmFeatures(g, w, cx + dx, cz + dz, out.chests);
    // ---- large structures (outposts, craters) ----
    structures(g, w, cx, cz, out);
  }

  // ---------------- per-column features ----------------
  VR.RealmFeatures = (g, w, fcx, fcz, chests) => realmFeatures(g, w, fcx, fcz, chests);
  function realmFeatures(g, w, fcx, fcz, chests) {
    const rng = new VR.RNG(M.hash2(fcx, fcz, g.seed + 4242));
    const fx0 = fcx * 16, fz0 = fcz * 16;
    const cl0 = g.climateAt(fx0 + 8, fz0 + 8);
    const h0 = g.surfaceY(fx0 + 8, fz0 + 8);
    const key0 = B[g.biomeFor(cl0, h0)].key;
    // villages keep their streets clear: no spires, giant trees or basalt pillars inside them
    const inVillage = (x, z, pad) => !!(g.villageNear && g.villageNear(x, z, pad));
    if (key0 === 'prism_fields' || key0 === 'crystal_highlands') {
      const spires = rng.chance(key0 === 'crystal_highlands' ? 0.55 : 0.32) ? 1 + (rng.chance(0.3) ? 1 : 0) : 0;
      for (let i = 0; i < spires; i++) {
        const x = fx0 + 3 + rng.int(10), z = fz0 + 3 + rng.int(10);
        const y = g.surfaceY(x, z) + 1;
        if (y <= SEA + 1 || inVillage(x, z, 12)) continue;
        const cc = CRY[Math.floor((g.nCry.n2(x, z) * 0.5 + 0.5) * 4.999)];
        spire(w, x, y, z, rng, cc, key0 === 'crystal_highlands' ? 1.25 : 1);
      }
      const trees = rng.chance(0.7) ? 1 + rng.int(3) : 0;
      for (let i = 0; i < trees; i++) {
        const x = fx0 + rng.int(16), z = fz0 + rng.int(16), y = g.surfaceY(x, z) + 1;
        if (y <= SEA + 1 || inVillage(x, z, 6)) continue;
        prismTree(w, x, y, z, rng);
      }
    } else if (key0 === 'ember_canyons') {
      if (rng.chance(0.18)) { const x = fx0 + 4 + rng.int(8), z = fz0 + 4 + rng.int(8), y = g.surfaceY(x, z) + 1; if (!inVillage(x, z, 8)) basaltPillar(w, x, y, z, rng); }
    }
    // island decorations
    for (let k = 0; k < 3; k++) {
      const x = fx0 + rng.int(16), z = fz0 + rng.int(16);
      const I = g.islandAt(x, z);
      if (!I || I.k < 0.35 || (I.isle && I.isle.designed)) continue; // the Sky Isles plant their own gardens
      const cl = g.climateAt(x, z);
      if (cl.ember > 0.45) continue;
      if (cl.prism > 0.45 && rng.chance(0.35)) spire(w, x, I.top + 1, z, rng, CRY[rng.int(5)], 0.6);
      else if (rng.chance(0.75)) { if (rng.chance(0.3)) GEN.TREES.cherry(w, x, I.top + 1, z, rng); else if (cl.t < -0.3) GEN.TREES.spruce(w, x, I.top + 1, z, rng); else GEN.TREES.fancyOak ? GEN.TREES.fancyOak(w, x, I.top + 1, z, rng) : GEN.TREES.oak(w, x, I.top + 1, z, rng); }
    }
    void chests;
  }
  // giant faceted crystal spire (glows; true colored light)
  function spire(w, x, y, z, rng, color, scale) {
    const blockS = cryBlock(color);
    const h = Math.round((12 + rng.next() * 26) * scale);
    const r0 = (1.6 + rng.next() * 1.8) * Math.sqrt(scale);
    const la = rng.next() * Math.PI * 2, lean = rng.next() * 0.22;
    const ldx = Math.cos(la) * lean, ldz = Math.sin(la) * lean;
    const build = (bx, by, bz, hh, rr, ox, oz) => {
      for (let t = -2; t <= hh; t++) {
        const f = Math.max(0, t) / hh;
        const r = rr * Math.pow(1 - f, 0.85) + 0.45;
        const cx = bx + ox * t, cz = bz + oz * t;
        const ri = Math.ceil(r);
        for (let dx = -ri; dx <= ri; dx++) for (let dz = -ri; dz <= ri; dz++) {
          const px = Math.round(cx + dx), pz = Math.round(cz + dz);
          const ex = px - cx, ez = pz - cz;
          const d = Math.max(Math.abs(ex) * 0.87 + Math.abs(ez) * 0.5, Math.abs(ez)); // hexagonal cross-section
          if (d <= r) w.set(px, by + t, pz, blockS);
        }
        if (t === hh) w.place(Math.round(cx), by + t + 1, Math.round(cz), cryCluster(color, 4, true));
      }
    };
    build(x, y, z, h, r0, ldx, ldz);
    const subs = 2 + rng.int(3);
    for (let i = 0; i < subs; i++) {
      const a = rng.next() * Math.PI * 2, d = r0 + 1.5 + rng.next() * 2;
      const sx = Math.round(x + Math.cos(a) * d), sz = Math.round(z + Math.sin(a) * d);
      build(sx, y, sz, Math.round(h * (0.25 + rng.next() * 0.35)), r0 * 0.45, Math.cos(a) * 0.25, Math.sin(a) * 0.25);
    }
    // scattered shards around the base
    for (let i = 0; i < 10; i++) {
      const a = rng.next() * Math.PI * 2, d = r0 + 1 + rng.next() * 4;
      const sx = Math.round(x + Math.cos(a) * d), sz = Math.round(z + Math.sin(a) * d);
      for (let yy = y + 3; yy > y - 5; yy--) { const b = w.get(sx, yy - 1, sz); if (b > 0 && (R.T.flags[b] & F.OPAQUE)) { w.place(sx, yy, sz, cryCluster(color, 4, rng.chance(0.4))); break; } }
    }
  }
  function prismTree(w, x, y, z, rng) {
    const log = st('stripped_birch_log', { axis: 0 }), leaf = GEN.leafState(rng.chance(0.5) ? 'cherry_leaves' : 'azalea_leaves');
    const h = 5 + rng.int(4);
    for (let i = 0; i < h; i++) w.place(x, y + i, z, log, 1);
    GEN.blob(w, x, y + h, z, 3, 2, 3, leaf, rng, 0.6);
    GEN.blob(w, x + 1, y + h + 1, z - 1, 2, 2, 2, leaf, rng, 0.6);
    if (rng.chance(0.5)) w.place(x, y + h + 2, z, st('glow_lichen', { faces: 32 }));
  }
  function basaltPillar(w, x, y, z, rng) {
    const S = states();
    const h = 4 + rng.int(12), r = 1 + rng.int(2);
    for (let t = -2; t < h; t++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      if (dx * dx + dz * dz > r * r + 0.5) continue;
      w.set(x + dx, y + t, z + dz, t === h - 1 && rng.chance(0.5) ? S.magma : S.basalt);
    }
  }

  // ---------------- large structures ----------------
  const OUT_CELL = 384;
  function outpostSite(g, i, j) {
    const key = (i + 1048576) * 2097152 + (j + 1048576); // exact pairing (the old xor hash collided for mirrored cells)
    if (g._outCache && g._outCache.has(key)) return g._outCache.get(key);
    if (!g._outCache || g._outCache.size > 400) g._outCache = new Map();
    const rng = new VR.RNG(M.hash2(i, j, g.seed + 31337));
    let site = null;
    const keepOut = VR.Heart && VR.Heart.noRandom(g, i * OUT_CELL + OUT_CELL / 2, j * OUT_CELL + OUT_CELL / 2);
    if (!keepOut && rng.chance(0.85)) {
      const x = i * OUT_CELL + 80 + rng.int(OUT_CELL - 160), z = j * OUT_CELL + 80 + rng.int(OUT_CELL - 160);
      const cl = g.climateAt(x, z);
      const hs = [];
      for (const [dx, dz] of [[0, 0], [-10, -10], [10, -10], [-10, 10], [10, 10], [20, 0], [0, 12], [0, -12]]) hs.push(g.surfaceY(x + dx, z + dz));
      const mn = Math.min(...hs), mx = Math.max(...hs);
      const bk = B[g.biomeFor(cl, hs[0])];
      if (mn > SEA + 1 && mx - mn < 14 && hs[0] < 140 && !bk.ocean && !bk.river && cl.canyon < 0.2) {
        site = { x, z, y: Math.round(hs.reduce((a, b) => a + b, 0) / hs.length) + 2, dir: rng.int(4), rail: rng.chance(0.75), railLen: 120 + rng.int(160), seed: rng.int(1 << 30) };
      }
    }
    g._outCache.set(key, site);
    return site;
  }
  OG.nearestOutpost = function (x, z) {
    const ci = Math.floor(x / OUT_CELL), cj = Math.floor(z / OUT_CELL);
    let best = null, bd = 1e18;
    for (let r = 0; r <= 4; r++) for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
      const s = outpostSite(this, ci + di, cj + dj);
      if (!s) continue;
      const d = (s.x - x) ** 2 + (s.z - z) ** 2;
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  };
  function structures(g, w, cx, cz, out) {
    const x0 = cx * 16, z0 = cz * 16;
    const ci = Math.floor(x0 / OUT_CELL), cj = Math.floor(z0 / OUT_CELL);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const s = outpostSite(g, ci + di, cj + dj);
      if (!s) continue;
      // bounding check (outpost radius 28 + rail length)
      const reach = 30 + (s.rail ? s.railLen : 0);
      if (x0 + 16 < s.x - reach || x0 > s.x + reach || z0 + 16 < s.z - reach || z0 > s.z + reach) continue;
      buildOutpost(g, w, s, out);
    }
    // meteor craters
    const CR = 256;
    const mi = Math.floor(x0 / CR), mj = Math.floor(z0 / CR);
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const rng = new VR.RNG(M.hash2(mi + di, mj + dj, g.seed + 555));
      if (!rng.chance(0.28)) continue;
      const x = (mi + di) * CR + 30 + rng.int(CR - 60), z = (mj + dj) * CR + 30 + rng.int(CR - 60);
      if (VR.Heart && VR.Heart.noRandom(g, x, z)) continue;
      const r = 5 + rng.int(6);
      if (x0 + 16 < x - r - 3 || x0 > x + r + 3 || z0 + 16 < z - r - 3 || z0 > z + r + 3) continue;
      crater(g, w, x, z, r, rng, out);
    }
  }
  function crater(g, w, x, z, r, rng, out) {
    const S = states();
    const y = g.surfaceY(x, z);
    if (y <= SEA) return;
    const cc = CRY[rng.int(5)];
    for (let dx = -r - 2; dx <= r + 2; dx++) for (let dz = -r - 2; dz <= r + 2; dz++) {
      const d = Math.hypot(dx, dz);
      const px = x + dx, pz = z + dz;
      if (!w.ok(px, 10, pz)) continue;
      if (d <= r) {
        const depth = Math.round((1 - (d / r) * (d / r)) * r * 0.55);
        const sy = g.surfaceY(px, pz);
        for (let yy = sy + 3; yy > y - depth; yy--) w.set(px, yy, pz, 0);
        const fy = y - depth;
        w.set(px, fy, pz, (M.hash2(px, pz, 7) & 3) === 0 ? S.aetherStone : S.duskrock);
        if (d < 1.6) { for (let k = 0; k < 3; k++) w.set(px, fy + 1 + k, pz, cryBlock(cc)); w.set(px, fy + 4, pz, cryCluster(cc, 4, true)); }
        else if ((M.hash2(px, pz, 9) & 7) === 0) w.set(px, fy + 1, pz, cryCluster(cc, 4, false));
      } else if (d <= r + 2) {
        const sy = g.surfaceY(px, pz);
        w.set(px, sy + 1, pz, (M.hash2(px, pz, 5) & 1) ? S.duskrock : S.gravel);
      }
    }
    void out;
  }

  // Outpost: landing pad with docked shuttle, control tower, turrets, maglev rail
  function buildOutpost(g, w, s, out) {
    const S = states();
    const rng = new VR.RNG(s.seed);
    const y = s.y;
    // orientation: rotate local (u,v) → world by dir (0: +z forward)
    const rot = (u, v) => { switch (s.dir) { case 0: return [u, v]; case 1: return [-v, u]; case 2: return [-u, -v]; default: return [v, -u]; } };
    const P = (u, yy, v, st2) => { const [dx, dz] = rot(u, v); w.set(s.x + dx, yy, s.z + dz, st2); };
    const facingRot = (f) => (f + s.dir) % 4;
    const ground = (u, v) => { const [dx, dz] = rot(u, v); return g.surfaceY(s.x + dx, s.z + dz); };
    // --- foundation & pad (13x13), centered at (0,0) ---
    for (let u = -7; u <= 7; u++) for (let v = -7; v <= 7; v++) {
      const edge = Math.abs(u) === 7 || Math.abs(v) === 7;
      const gy = ground(u, v);
      for (let yy = gy + 1; yy < y; yy++) P(u, yy, v, (Math.abs(u) === 7 && Math.abs(v) === 7) || (edge && (u + v) % 4 === 0) ? S.hullDark : (yy < y - 1 ? S.hullGray : S.hullDark));
      P(u, y, v, edge ? S.hazard : S.pad);
      for (let yy = y + 1; yy < y + 12; yy++) P(u, yy, v, 0);
    }
    for (const [u, v] of [[-7, -7], [7, -7], [-7, 7], [7, 7]]) { P(u, y + 1, v, S.hullDark); P(u, y + 2, v, S.hullDark); P(u, y + 3, v, S.turret); }
    P(-6, y + 1, 6, S.beacon);
    // edge lights
    for (let k = -6; k <= 6; k += 3) { P(k, y, -8, S.neonCyan); P(k, y, 8, S.neonCyan); P(-8, y, k, S.neonCyan); P(8, y, k, S.neonCyan); }
    // --- a docked mini-voxel starship on the pad (a vehicle spawned by the game) ---
    for (let u = -9; u <= 9; u++) for (let v = -12; v <= 12; v++) for (let yy = 1; yy <= 11; yy++) if (Math.abs(u) > 7 || Math.abs(v) > 7) P(u, y + yy, v, 0);
    if (!out.spawns) out.spawns = [];
    if (w.ok(s.x, 10, s.z)) out.spawns.push(['starship', (s.seed ^ 0x5eed5) >>> 0, s.x, y + 1, s.z, s.dir]);
    void facingRot; void outpostShip;
    // --- control tower at u = 11..19 ---
    const tx0 = 10, tx1 = 19, tv0 = -5, tv1 = 5, floors = 3, fh = 4;
    for (let u = tx0; u <= tx1; u++) for (let v = tv0; v <= tv1; v++) {
      const gy = ground(u, v);
      for (let yy = gy + 1; yy < y; yy++) P(u, yy, v, S.hullDark);
      for (let f = 0; f <= floors; f++) {
        const fy = y + f * fh;
        const wall = u === tx0 || u === tx1 || v === tv0 || v === tv1;
        // floor / roof
        P(u, fy, v, f === floors ? S.hullDark : (wall ? S.hullDark : S.hullGray));
        if (f === floors) continue;
        for (let yy = fy + 1; yy < fy + fh; yy++) {
          if (wall) {
            const corner = (u === tx0 || u === tx1) && (v === tv0 || v === tv1);
            const window = !corner && (yy === fy + 2) && ((u + v) & 1) === 0;
            const door = f === 0 && u === tx0 && Math.abs(v) <= 1 && yy <= fy + 2;
            P(u, yy, v, door ? 0 : window ? S.viewport : corner ? S.hullDark : (yy === fy + 3 ? S.stripeB : S.hull));
          } else P(u, yy, v, 0);
        }
        if (!(u === tx0 || u === tx1 || v === tv0 || v === tv1)) { if (((u + v) & 3) === 0) P(u, fy + fh - 1, v, S.lightPanel); }
      }
    }
    // interior: consoles, crates, stairs (ladder shaft)
    for (let f = 0; f < floors; f++) {
      const fy = y + f * fh;
      P(tx1 - 1, fy + 1, 0, st('console', { facing: facingRot(1) }));
      P(tx1 - 1, fy + 1, -2, S.panel); P(tx1 - 1, fy + 2, -2, S.panelA);
      if (f === 0) { P(tx1 - 1, fy + 1, 3, st('cargo_crate', { facing: facingRot(3) })); const [dx, dz] = rot(tx1 - 1, 3); out.chests.push([s.x + dx, fy + 1, s.z + dz, 'outpost']); }
      if (f === 1) { P(tx0 + 2, fy + 1, -3, st('cargo_crate', { facing: facingRot(1) })); const [dx, dz] = rot(tx0 + 2, -3); out.chests.push([s.x + dx, fy + 1, s.z + dz, 'outpost_rare']); P(tx0 + 3, fy + 1, 3, S.reactor); }
      // ladder shaft at (tx0+1, tv1-1)
      for (let yy = fy + 1; yy <= fy + fh; yy++) { P(tx0 + 1, yy, tv1 - 1, st('ladder', { facing: facingRot(0) })); }
      P(tx0 + 1, fy + fh, tv1 - 1, st('ladder', { facing: facingRot(0) }));
    }
    // roof gear
    const ry = y + floors * fh;
    P(tx0 + 2, ry + 1, tv0 + 2, S.antenna); P(tx1 - 2, ry + 1, tv1 - 2, st('satellite_dish', { facing: facingRot(2) }));
    P(tx1 - 2, ry + 1, tv0 + 2, S.turret); P(tx0 + 4, ry + 1, 0, S.neonMag);
    for (let u = tx0; u <= tx1; u++) { P(u, ry + 1, tv0, S.darkSlab); P(u, ry + 1, tv1, S.darkSlab); }
    // walkway from pad to tower
    for (let u = 8; u < tx0; u++) for (let v = -1; v <= 1; v++) { const gy = ground(u, v); for (let yy = gy + 1; yy < y; yy++) P(u, yy, v, S.hullGray); P(u, y, v, v === 0 ? S.grate : S.hullDark); for (let yy = y + 1; yy < y + 4; yy++) P(u, yy, v, 0); }
    // --- elevated maglev rail heading -u ---
    if (s.rail) {
      const deckY = y + 5;
      for (let u = -9; u >= -9 - s.railLen; u--) {
        const [dx, dz] = rot(u, 0);
        if (!w.ok(s.x + dx, 10, s.z + dz) && !w.ok(s.x + rot(u, 1)[0], 10, s.z + rot(u, 1)[1]) && !w.ok(s.x + rot(u, -1)[0], 10, s.z + rot(u, -1)[1])) continue;
        for (let v = -1; v <= 1; v++) P(u, deckY, v, v === 0 ? S.hullDark : S.darkSlabTop);
        P(u, deckY + 1, 0, (s.dir % 2 === 0) ? S.prailX : S.prail);
        if (u % 4 === 0) { P(u, deckY, -2, S.neonCyan); P(u, deckY, 2, S.neonCyan); }
        if (u % 12 === 0) {
          const gy = Math.min(ground(u, 0), deckY - 1);
          for (let yy = Math.max(2, gy - 2); yy < deckY; yy++) P(u, yy, 0, (yy % 6 === 0) ? S.stripeO : S.hullGray);
        }
        if (u === -9 - s.railLen) { for (let v = -3; v <= 3; v++) for (let uu = u - 5; uu <= u; uu++) P(uu, deckY, v, S.hullDark); P(u - 2, deckY + 1, 0, S.beacon); }
      }
    }
    // entity spawns (turret heads, parked hoverbike)
    if (!out.spawns) out.spawns = [];
    const [hx, hz] = rot(-12, 8);
    if (w.ok(s.x + hx, 10, s.z + hz)) out.spawns.push(['hoverbike', s.x + hx + 0.5, y + 1, s.z + hz + 0.5]);
  }
  // pick a procedural ship that fits the outpost pad without touching its pillars, lights or walkway
  const shipCache = new Map();
  function outpostShip(seed) {
    const SG = VR.ShipGen; if (!SG) return null;
    if (shipCache.has(seed)) return shipCache.get(seed);
    let found = null;
    for (let k = 0; k < 12 && !found; k++) {
      const bp = SG.design((seed + k * 1013) >>> 0, null, { allow: ['interceptor', 'gunship', 'racer', 'dropship', 'shuttle'] });
      const b = SG.bounds(bp);
      if (!bp.helm || b.x0 < -7 || b.x1 > 7 || b.z0 < -11 || b.z1 > 9) continue;
      let ok = true;
      for (let ly = 0; ly < bp.sy && ok; ly++) for (let lz = 0; lz < bp.sz && ok; lz++) for (let lx = 0; lx < bp.sx; lx++) {
        if (!bp.blocks[(ly * bp.sz + lz) * bp.sx + lx]) continue;
        const x = lx - bp.ox, z = lz - bp.oz;
        if ((Math.abs(x) >= 6 && Math.abs(z) >= 6) || (ly === 0 && (Math.abs(x) > 5 || Math.abs(z) > 6))) { ok = false; break; }
      }
      if (ok) found = bp;
    }
    if (shipCache.size > 32) shipCache.clear();
    shipCache.set(seed, found);
    return found;
  }
  // Shuttle blueprint (local coords: u across, yy up from pad+1, v along; nose at v=-9)
  function buildShuttle(P, facingRot, rng) {
    const S = states();
    const L = 9; // half length
    for (let v = -L; v <= L; v++) {
      // body cross-section: half width & height vary along length
      const t = (v + L) / (2 * L); // 0 nose .. 1 tail
      const hw = v < -5 ? 1.2 + (v + L) * 0.6 : v > 6 ? 3.2 - (v - 6) * 0.35 : 3.5;
      const hh = v < -5 ? Math.min(2.5, 1.5 + (v + L) * 0.4) : 2.6; // nose never reaches the pad (keeps the ship separable)
      const cyy = 2.8;
      for (let u = -5; u <= 5; u++) for (let yy = 0; yy <= 6; yy++) {
        const e = Math.pow(Math.abs(u) / (hw + 0.01), 2) + Math.pow(Math.abs(yy - cyy) / (hh + 0.01), 2);
        if (e > 1.12) continue;
        const shell = e > 0.52 || yy <= 1;
        if (!shell) { P(u, yy, v, 0); continue; }
        let s = S.hull;
        if (yy >= cyy + 0.8 && v <= -3 && v >= -8) s = S.viewport; // cockpit canopy
        else if (yy <= 1) s = S.hullDark;
        else if (Math.abs(u) >= Math.floor(hw) && (v % 3 === 0)) s = S.stripeO;
        else if (yy === Math.round(cyy) && Math.abs(u) >= Math.floor(hw)) s = S.stripeB;
        P(u, yy, v, s);
      }
      void t;
    }
    // interior floor & fittings
    for (let v = -6; v <= 7; v++) for (let u = -2; u <= 2; u++) P(u, 1, v, S.hullDark);
    P(0, 2, -6, st('helm', { facing: facingRot(0) }));
    P(0, 2, -5, st('pilot_seat', { facing: facingRot(0) }));
    P(-2, 2, -5, st('console', { facing: facingRot(1) })); P(2, 2, -5, st('console', { facing: facingRot(3) }));
    P(0, 4, -2, S.lightPanel); P(0, 4, 3, S.lightPanel);
    P(2, 2, 5, st('cargo_crate', { facing: facingRot(3) })); P(-2, 2, 5, S.reactor);
    P(-2, 2, 2, st('pilot_seat', { facing: facingRot(1) })); P(2, 2, 2, st('pilot_seat', { facing: facingRot(3) }));
    // side door opening (port side)
    for (let yy = 2; yy <= 3; yy++) for (let v = 0; v <= 1; v++) { P(-3, yy, v, 0); P(-4, yy, v, 0); }
    // wings
    // (wing tips stay >= 2 blocks away from pad turrets & the tower so the ship's flood-fill stays clean)
    for (let v = 0; v <= 5; v++) { const span = 3 + Math.floor(v * 0.5); for (let u = 4; u <= span + 3; u++) { P(u, 2, v, S.hullGray); P(-u, 2, v, S.hullGray); } P(span + 3, 2, v, S.neonCyan); P(-(span + 3), 2, v, S.neonCyan); }
    // tail fin
    for (let v = 5; v <= 9; v++) for (let yy = 6; yy <= 6 + (v - 5); yy++) P(0, yy, v, v === 9 ? S.neonMag : S.hull);
    // thrusters (facing aft)
    for (const u of [-2, 0, 2]) P(u, 3, L + 1, st('thruster', { facing: facingRot(2), lit: 1 }));
    // landing gear
    for (const [u, v] of [[-2, -4], [2, -4], [-2, 5], [2, 5]]) P(u, 0, v, S.hullDark);
    void rng;
  }
  VR.buildShuttle = buildShuttle;
})(VR);
