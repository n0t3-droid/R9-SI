// ============================================================================
// The Heartland — the trailer's world composition around the origin (TRAILER.md §3).
// Every new world (vgen ≥ 3) starts here: a flat green Gate Plateau with the Gate
// Temple at (0, 0) facing south, the Palm City north of it, the Pod Hills behind
// that, the Ember Canyon (mesas, lava cracks, an aether river) to the south, the
// Sky Isles floating over a misty lowland to the east, the Spire Citadel on its
// mountain to the south-west and the Mountain Station's jagged peaks to the
// north-west. Beyond ~700 blocks the designed land blends into the procedural
// biome world. This file shapes the terrain and picks the biomes; the temple,
// the city, the citadel and the other structures are built by their own modules
// through the hooks registered here.
// ============================================================================
(function (VR) {
  'use strict';
  const M = VR.M, SEA = VR.C.SEA, BI = VR.BIOME, B = VR.BIOMES, R = VR.R, F = VR.F;
  const OG = VR.OverworldGen && VR.OverworldGen.prototype;
  if (!OG) return;
  const ss = M.smoothstep, lerp = M.lerp;
  const HEART = VR.Heart = {};
  HEART.R0 = 680; HEART.R1 = 900;          // designed → procedural blend
  HEART.PLAT = 80;                          // plateau ground level
  HEART.on = (g) => !!(g && g.vgen >= 3 && g.singleBiome < 0 && !g.flat);
  // fixed sites (world coordinates)
  HEART.TEMPLE = { x: 0, z: -10, front: 20, back: -40 };
  HEART.CITY = { x: 0, z: -140, rad: 100 };
  HEART.CITADEL = { x: -420, z: 380, y: 112 };
  HEART.STATION = { x: -380, z: -150 };
  HEART.ISLES = { x: 330, z: 140, y: 155 };

  // a new biome for the green Heartland: saturated grass, round trees, tech-city villages
  function addBiome(key, name, temp, down, grass, foliage, water, sky, o) {
    const e = Object.assign({ id: B.length, key, name, temp, down, grass, foliage, water, sky, fog: null, precip: 'rain' }, o || {});
    B.push(e); BI[key] = e.id; return e;
  }
  if (BI.sky_meadow === undefined) addBiome('sky_meadow', 'Sky Meadow', 0.85, 0.5, 0x5fd13a, 0x3fa02a, 0x3ac8ff, 0x9aa8ff, { realm: 1 });

  // ---------------------------------------------------------------- designed terrain
  const sbox = (v, a, b, m) => ss(a - m, a, v) * (1 - ss(b, b + m, v));
  function noises(g) {
    if (g.nHeart) return;
    const Fr = VR.Fractal, s = g.seed;
    g.nHeart = new Fr(s ^ 0x4ea27, 3, 1 / 140, 0.5);
    g.nHeart2 = new Fr(s ^ 0x5fb38, 2, 1 / 46, 0.5);
    if (!g.nMesa) { g.nMesa = new Fr(s ^ 0x6b28f4, 2, 1 / 90, 0.5); }
    if (!g.nCanyon) { g.nCanyon = new Fr(s ^ 0x7c3905, 3, 1 / 260, 0.5); }
    if (!g.nWarp) { g.nWarp = new Fr(s ^ 0x6f7081, 2, 1 / 280, 0.5); }
    g.nRidge = new Fr(s ^ 0x7d4a16, 2, 1 / 18, 0.5);
    g.nAether = new Fr(s ^ 0x1e9c3b, 1, 1 / 27, 0.5);   // smooth sheets → thin glowing vein lines where they cut the rock face
  }
  // returns null outside the Heartland, else the designed climate fields
  HEART.design = function (g, X, Z) {
    const d = Math.hypot(X, Z);
    if (d > HEART.R1) return null;
    noises(g);
    const heart = 1 - ss(HEART.R0, HEART.R1, d);
    const wx = g.nWarp.n2(X + 3000, Z - 3000) * 28, wz = g.nWarp.n2(X - 3000, Z + 3000) * 28;
    const Xw = X + wx, Zw = Z + wz;
    const n1 = g.nHeart.n2(X, Z), n2 = g.nHeart2.n2(X, Z);
    // zone weights
    const plat = 1 - ss(150, 190, d);
    const city = sbox(Xw, -200, 200, 60) * sbox(Zw, -240, -30, 50);
    const hills = sbox(Xw, -280, 280, 90) * sbox(Zw, -430, -205, 70);
    const hump = sbox(Zw, -390, -255, 70);
    const dc = Math.hypot(X - HEART.CITADEL.x, Z - HEART.CITADEL.z);
    const mount = 1 - ss(24, 120, dc);
    const isleLow = sbox(Xw, 205, 480, 70) * sbox(Zw, 15, 290, 70);
    const cz = ss(120, 165, Zw) * sbox(Xw, -380, 380, 130) * (1 - ss(540, 640, Zw)) * (1 - ss(0.15, 0.75, mount)) * (1 - isleLow);
    const dsn = Math.hypot(X - HEART.STATION.x, Z - HEART.STATION.z);
    const peak = 1 - ss(26, 100, dsn);
    // heights
    let H = 82 + n1 * 5 + n2 * 1.5;                                       // gentle green land
    H = lerp(H, 81 + n1 * 2.5 + n2 * 0.8, city);                          // the city sits on near-flat lawns
    H = lerp(H, 84 + 34 * hump + n1 * 7 + Math.max(0, n2) * 2, hills);   // the rounded Pod Hills
    const cn = Math.abs(g.nCanyon.n2(X, Z));
    const cnv = 1 - ss(0.07, 0.2, cn);                                   // broad canyons between the mesas
    const mesaTop = 98 + g.nMesa.n2(X, Z) * 8 + n2 * 2;
    const Hcan = lerp(mesaTop, 58 + (1 - cnv) * 4, Math.pow(cnv, 0.8));
    H = lerp(H, Hcan, cz);
    H = lerp(H, 62 + 50 * (1 - ss(18, 112, dc)) + n2 * 2.5, mount);      // the citadel's mountain
    const pk = Math.pow(peak, 1.4);
    // jagged station peaks: a broad cone with sharp ridge lines (the folded nHeart2 field) and fine rock noise on top
    const rg = g.nHeart2.n2(X + 777, Z - 777), ridge = Math.pow(Math.max(0, 1 - Math.abs(rg) * 2.6), 1.6);
    H = lerp(H, 96 + 68 * pk + (ridge * 16 + Math.abs(n2) * 8 + g.nRidge.n2(X, Z) * 4) * peak + n1 * 6, peak);
    H = lerp(H, 66 + n1 * 9 + n2 * 2, isleLow);                          // misty lowland under the Sky Isles
    H = lerp(H, HEART.PLAT, plat);                                       // the Gate Plateau is flat
    let A = 2.2;
    A = lerp(A, 1.2, plat); A = lerp(A, 3.2, hills); A = lerp(A, 2.6, cz); A = lerp(A, 20, peak); A = lerp(A, 1.6, city);
    const ember = cz * (1 - plat);
    const canyon = cnv * cz * (1 - plat);
    const river = cz * (1 - ss(0.025, 0.06, cn)) * (1 - plat) + isleLow * (1 - ss(-0.15, 0.1, n1)) * 0.6;
    // zone tags for the biome pick: meadow (green), canyon floor/walls (ochre), peaks (rock)
    const hz2 = Math.max(canyon, cz * ss(0.35, 0.7, cnv)), hz3 = peak * ss(0.35, 0.6, pk);
    return { heart, H, A, ember, canyon, river, mountain: peak, hz1: Math.max(0, 1 - hz2 - hz3), hz2, hz3, plat, city, hills, cz, mount, peak, isleLow };
  };
  const prevCompute = OG.computeClimate;
  OG.computeClimate = function (X, Z) {
    const c = prevCompute.call(this, X, Z);
    c.heart = 0; c.hz1 = 0; c.hz2 = 0; c.hz3 = 0;
    if (!HEART.on(this)) return c;
    const D = HEART.design(this, X, Z);
    if (!D) return c;
    const k = D.heart;
    c.H = M.clamp(lerp(c.H, D.H, k), 8, 238);
    c.A = lerp(c.A, D.A, k);
    c.ember = lerp(c.ember || 0, D.ember, k); c.canyon = lerp(c.canyon || 0, D.canyon, k); c.prism = (c.prism || 0) * (1 - k);
    c.river = lerp(c.river, D.river, k); c.mountain = lerp(c.mountain, D.mountain, k);
    c.swampy *= (1 - k); c.windswept *= (1 - k); c.plateau *= (1 - k); c.inland = lerp(c.inland, 1, k);
    c.t = lerp(c.t, 0.45, k); c.h = lerp(c.h, 0.1, k);
    c.heart = k; c.hz1 = D.hz1 * k; c.hz2 = D.hz2 * k; c.hz3 = D.hz3 * k;
    return c;
  };
  const HKEYS = ['heart', 'hz1', 'hz2', 'hz3'];
  // the Heartland's values ride along in the realm's one pass over the corners (every corner carries them — zero
  // outside the Heartland — so a second lookup of the four corners per block, 800 blocks a column, is spared)
  if (OG.CLIMATE_KEYS) { for (const k of HKEYS) if (!OG.CLIMATE_KEYS.includes(k)) OG.CLIMATE_KEYS.push(k); }
  else {
    const prevClimateAt = OG.climateAt;
    OG.climateAt = function (x, z) {
      const o = prevClimateAt.call(this, x, z);
      if (!HEART.on(this)) { o.heart = 0; return o; }
      const X0 = Math.floor(x / 4) * 4, Z0 = Math.floor(z / 4) * 4;
      const fx = (x - X0) / 4, fz = (z - Z0) / 4;
      const a = this.corner(X0, Z0), b = this.corner(X0 + 4, Z0), c = this.corner(X0, Z0 + 4), d = this.corner(X0 + 4, Z0 + 4);
      const w00 = (1 - fx) * (1 - fz), w10 = fx * (1 - fz), w01 = (1 - fx) * fz, w11 = fx * fz;
      for (const k of HKEYS) o[k] = (a[k] || 0) * w00 + (b[k] || 0) * w10 + (c[k] || 0) * w01 + (d[k] || 0) * w11;
      return o;
    };
  }
  const prevBiome = OG.biomeFor;
  OG.biomeFor = function (cl, height) {
    if (cl.heart > 0.5) {
      if (cl.hz3 > 0.45) return height > 150 ? BI.jagged_peaks : BI.stony_peaks;
      if (cl.hz2 > 0.5 && cl.river < 0.55) return BI.ember_canyons;
      if (height < SEA - 1 && cl.river < 0.3) return BI.lukewarm_ocean;
      if (cl.river > 0.55 && height < SEA + 2) return BI.river;
      return BI.sky_meadow;
    }
    return prevBiome.call(this, cl, height);
  };
  // trees of the sky meadow: round oaks, sparse; none inside the plateau's designed grounds
  const prevTree = OG.tree;
  OG.tree = function (w, key, x, y, z, rng) {
    if (key === 'sky_meadow') {
      if (HEART.on(this) && HEART.reserved(this, x, z)) return;
      if (this.villageNear && this.villageNear(x, z, 4)) return;
      const T = VR.GEN.TREES;
      return rng.chance(0.75) && T.fancyOak ? T.fancyOak(w, x, y, z, rng) : T.oak(w, x, y, z, rng);
    }
    return prevTree.call(this, w, key, x, y, z, rng);
  };
  // designed grounds where no random tree, spire, pillar, outpost or crater may appear
  HEART.reserved = function (g, x, z) {
    if (!HEART.on(g)) return false;
    const d = Math.hypot(x, z);
    if (d < 160) return true;                                            // Gate Plateau: temple & plaza
    if (Math.hypot(x - HEART.CITY.x, z - HEART.CITY.z) < HEART.CITY.rad + 6) return true;
    return false;
  };
  HEART.noRandom = function (g, x, z) { return HEART.on(g) && Math.hypot(x, z) < HEART.R0; };

  // ---------------------------------------------------------------- per-chunk post pass
  const st = (n, p) => { const t = R.byName[n]; return t ? (p ? t.state(p) : t.defaultState) : 0; };
  let SB = null;
  const states = () => SB || (SB = { grass: st('grass_block'), dirt: st('dirt'), redsand: st('red_sand'), ochre: st('ochre_rock'), umber: st('umber_rock'), ember: st('ember_ochre'), stone: st('stone'), aether: st('dusk_aether') || st('aether_stone'), dusk: st('duskrock'),
    cover: new Set([st('snow_block'), st('calcite'), st('packed_ice'), st('ice'), st('gravel'), st('powder_snow'), st('stone'), st('cobblestone'), st('andesite'), st('diorite'), st('granite'), st('tuff'), st('deepslate')].filter(Boolean)), snowT: R.byName.snow ? R.byName.snow.id : -1 });
  HEART.post = function (g, cx, cz, out) {
    const S = states(), blocks = out.blocks, x0 = cx * 16, z0 = cz * 16;
    const T = R.T;
    for (let col = 0; col < 256; col++) {
      const x = x0 + (col & 15), z = z0 + (col >> 4);
      const cl = g.climateAt(x, z);
      if (cl.heart < 0.5) continue;
      // the station peaks: dark blue-grey rock shot through with glowing aether veins (the trailer's cyan-veined mountains)
      if (cl.hz3 > 0.45 && g.nAether) {
        for (let y = 60; y < 254; y++) {
          const i = (y << 8) | col, b = blocks[i];
          if (!b) continue;
          if (T.type[b] === S.snowT) { blocks[i] = 0; continue; }     // no snow on the dusk peaks
          if (!S.cover.has(b)) continue;
          const v = g.nAether.n3(x, y * 1.6, z);
          blocks[i] = Math.abs(v) < 0.022 ? S.aether : S.dusk;
        }
      }
      // mesa caps in the canyon stay green (the trailer's grass-topped mesas): the banded rock only shows on the walls
      if (cl.ember > 0.45 && cl.hz1 > 0.4 && cl.canyon < 0.3) {
        let y = 254; while (y > 1 && (!blocks[(y << 8) | col] || (T.flags[blocks[(y << 8) | col]] & (F.PLANT | F.FLUID)))) y--;
        if (y > 70) {
          const top = blocks[(y << 8) | col];
          const isBand = (b) => { const tp = R.types[T.type[b]]; return b === S.redsand || b === S.ochre || b === S.umber || b === S.ember || (tp && /terracotta$/.test(tp.name)); };
          if (isBand(top)) {
            blocks[(y << 8) | col] = S.grass;
            for (let k = 1; k <= 2; k++) { const b = blocks[((y - k) << 8) | col]; if (isBand(b)) blocks[((y - k) << 8) | col] = S.dirt; }
          }
        }
      }
    }
    // designed structures (each module registers a per-chunk builder)
    for (const fn of HEART.builders) { try { fn(g, cx, cz, out); } catch (e) { if (VR.VillageGen && VR.VillageGen.probe && e === VR.VillageGen.probe) throw e; if (!g._heartErr) { g._heartErr = 1; console.warn('heartland gen', e); } } }
  };
  HEART.builders = [];
  const prevGen = OG.generate;
  OG.generate = function (cx, cz) {
    const out = prevGen.call(this, cx, cz);
    if (HEART.on(this)) HEART.post(this, cx, cz, out);
    return out;
  };

  // ---------------------------------------------------------------- random features keep out
  // no random sky islands inside the Heartland (the Sky Isles are designed), no random citadels
  const prevIsland = OG.islandCell;
  OG.islandCell = function (i, j) {
    if (HEART.on(this)) {
      const x = i * 72 + 36, z = j * 72 + 36;
      if (Math.hypot(x, z) < HEART.R0) return null;
    }
    return prevIsland.call(this, i, j);
  };
  const CIT = VR.CitadelGen;
  if (CIT) {
    const prevSite = CIT.site;
    CIT.site = function (g, i, j) {
      if (HEART.on(g)) {
        const key = 'h' + i + '_' + j;
        if (!g._citSites) g._citSites = new Map();
        if (g._citSites.has(key)) return g._citSites.get(key);
        const C = HEART.CITADEL, CELL = CIT.CELL;
        let site = null;
        if (Math.floor(C.x / CELL) === i && Math.floor(C.z / CELL) === j) site = CIT.heartSite ? CIT.heartSite(g, C) : null;
        else {
          const x = i * CELL + CELL / 2, z = j * CELL + CELL / 2;
          if (Math.hypot(x, z) < HEART.R0 + CELL * 0.7) site = null; else site = prevSite.call(this, g, i, j);
        }
        g._citSites.set(key, site);
        return site;
      }
      return prevSite.call(this, g, i, j);
    };
  }
  // the home city is fixed north of the temple
  const VG = VR.VillageGen;
  if (VG) {
    const prevVSite = VG.site;
    VG.site = function (g, i, j) {
      if (HEART.on(g)) {
        g._homeFound = true; // the home city is placed here, never by the random site search
        if (!g._vilSites) g._vilSites = new Map();
        const key = (i + 1048576) * 2097152 + (j + 1048576);
        if (g._vilSites.has(key)) return g._vilSites.get(key);
        const { CELL } = VG.par(g);
        let site;
        const C = HEART.CITY;
        if (Math.floor(C.x / CELL) === i && Math.floor(C.z / CELL) === j) {
          const rng = new VR.RNG(M.hash2(7, 7, g.seed + 90210));
          site = { id: i + '_' + j, i, j, x: C.x, z: C.z, y: HEART.PLAT + 1, style: 'tech', biome: 'sky_meadow', seed: rng.int(1 << 30), name: null, home: true, rad: C.rad };
          site.name = 'Nova Haven';
          g._homeFound = true;
        } else {
          const x = i * CELL + CELL / 2, z = j * CELL + CELL / 2;
          site = Math.hypot(x, z) < 720 ? null : prevVSite.call(this, g, i, j); // the Heartland has one city: Nova Haven
        }
        g._vilSites.set(key, site);
        return site;
      }
      return prevVSite.call(this, g, i, j);
    };
  }
})(VR);
