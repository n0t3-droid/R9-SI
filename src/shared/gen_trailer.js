// ============================================================================
// The endless world in the trailer's look (t-biomes · TRAILER.md §2–§3 · docs/trailer/README.md).
// The Heartland (gen_heart.js) is the designed home region; beyond it the procedural world carries the trailer's
// landscape too — in every world made at vgen ≥ 6 (older worlds keep their terrain byte for byte: every rule here
// is gated by TR.on, and the new biome only ever appears in such worlds):
//  · Terraced Hills — a green biome: rolling land whose surface is stepped onto a global 4-block grid (grass
//    treads, stone risers), round-crown trees on the terraces
//  · Mesa caps — the ember canyons' flat mesa tops are green (the trailer's grass-topped mesas), the banded walls stay
//  · Lava vents — on some mesa tops: a lava throat, a glowing magma ring, a scorched basalt rim and a basalt chimney
//  · Giant crystals — prism fields plant clusters of 30–75 blocks (the trailer's crystal towers) on their cells
//  · Hanging crystals — under the sky isles, crystal tips point down from the rock
//  · Round-crown trees — the green biomes plant TREES.roundTree (the trailer's park trees)
//  · Saturated grass and foliage — the far land's tints are pushed to the trailer's greens
//  · Corridors — the land within 7 blocks of a rail viaduct stays open: no terraces, trees, spires or vents there,
//    so the roads and trams of t-infra run on natural ground (VR.Trail.corridorMask lists them per chunk)
// The palm cities (the 'tech' village style) are placed more often in these worlds: gen_village.js TECH_P6.
// Everything is deterministic from the seed and the chunk; every feature is written into its own column (or
// through a ColumnWriter), so a neighbouring chunk computes the same feature and writes its part of it.
// ============================================================================
(function (VR) {
  'use strict';
  const M = VR.M, SEA = VR.C.SEA, BI = VR.BIOME, B = VR.BIOMES, R = VR.R, F = VR.F;
  const OG = VR.OverworldGen && VR.OverworldGen.prototype;
  if (!OG || !VR.GEN || !VR.GEN.TREES) return;
  const GEN = VR.GEN;
  const TR = VR.Trail = {};
  TR.VGEN = 6;            // the worlds made from v0.41 on (gen_village / game.js use the same number)
  TR.STEP = 4;            // the terrace height
  TR.BAND = 7;            // a corridor's half width (blocks either side of a rail line)
  TR.VENT_CELL = 48;      // one possible lava vent per 48 × 48 cell
  TR.on = (g) => !!(g && g.vgen >= TR.VGEN && g.singleBiome < 0 && !g.flat);
  // the Heartland (gen_heart.js: designed up to HEART.R1) keeps its own look
  const far = (x, z) => Math.hypot(x, z) > (VR.Heart ? VR.Heart.R1 : 900) + 8;
  const st = (n, p) => R.S(n, p);
  const CRY = ['violet', 'azure', 'verdant', 'rose', 'amber'];
  const GREEN_CAP = () => VR.rgb565(0x5f, 0xd1, 0x3a);
  const ROUND = { forest: 1, plains: 1, meadow: 1, flower_forest: 1, sunflower_plains: 1, birch_forest: 1, windswept_forest: 1, windswept_hills: 1, terraced_hills: 1 };

  // ---------------------------------------------------------------- the biome
  function addBiome(key, name, temp, down, grass, foliage, water, sky, o) {
    const e = Object.assign({ id: B.length, key, name, temp, down, grass, foliage, water, sky, fog: null, precip: temp < 0.15 ? 'snow' : (down <= 0 ? 'none' : 'rain') }, o || {});
    B.push(e); BI[key] = e.id; return e;
  }
  if (BI.terraced_hills === undefined) addBiome('terraced_hills', 'Terraced Hills', 0.6, 0.6, 0x6fd64a, 0x3fa02a, 0x3ac8ff, 0x9ec7ff, { realm: 1 });

  // ---------------------------------------------------------------- the climate: where the terraces rise
  function noises(g) {
    if (g.nTerr) return;
    const Fr = VR.Fractal, s = g.seed;
    g.nTerr = new Fr(s ^ 0x9d1c2e, 2, 1 / 380, 0.5);     // the zones of terraced hills
    g.nTerrH = new Fr(s ^ 0x8e2b1f, 2, 1 / 150, 0.5);    // how high their hills rise inside a zone
  }
  const prevCC = OG.computeClimate;
  OG.computeClimate = function (X, Z) {
    const c = prevCC.call(this, X, Z);
    c.terr = 0;
    if (!TR.on(this) || !far(X, Z)) return c;
    noises(this);
    const land = M.smoothstep(SEA + 3, SEA + 12, c.H);
    const zone = M.smoothstep(0.1, 0.3, this.nTerr.n2(X, Z)) * M.smoothstep(0.05, 0.35, c.inland) * land
      * (1 - M.smoothstep(0.2, 0.45, c.ember || 0)) * (1 - M.smoothstep(0.2, 0.45, c.prism || 0)) * (1 - M.smoothstep(0.3, 0.6, c.mountain));
    if (zone > 0.001) {
      const roll = M.clamp(0.5 + 0.8 * this.nTerrH.n2(X, Z), 0, 1);
      c.H = M.clamp(c.H + zone * (10 + 22 * roll), 8, 238);   // the hills rise above the land
      c.A = M.lerp(c.A, Math.min(c.A, 2.6), zone * 0.8);       // and their rock is smooth (few overhangs)
    }
    c.terr = zone;
    return c;
  };
  const prevBiome = OG.biomeFor;
  OG.biomeFor = function (cl, height) {
    if (cl.terr > 0.5 && height > SEA + 4 && cl.river < 0.3 && cl.ember < 0.3 && cl.prism < 0.3) return BI.terraced_hills;
    return prevBiome.call(this, cl, height);
  };
  // round-crown trees in the green biomes (the village and the Heartland keep their own trees: they are called first)
  const prevTree = OG.tree;
  OG.tree = function (w, key, x, y, z, rng) {
    if (this.vgen >= TR.VGEN && ROUND[key] && far(x, z) && rng.chance(0.7) && !(this.villageNear && this.villageNear(x, z, 4))) {
      return GEN.TREES.roundTree(w, x, y, z, rng, { h: 3 + rng.int(2), r: 2.4 + rng.next() * 0.6 });
    }
    return prevTree.call(this, w, key, x, y, z, rng);
  };

  // ---------------------------------------------------------------- states
  let SS = null;
  const states = () => SS || (SS = Object.assign({}, GEN.S(), {
    ochre: st('ochre_rock'), umber: st('umber_rock'), emberOchre: st('ember_ochre'),
  }));
  const isBand = (S, b) => { if (!b) return false; if (b === S.redsand || b === S.ochre || b === S.umber || b === S.emberOchre) return true; const tp = R.types[R.T.type[b]]; return !!(tp && /terracotta$/.test(tp.name)); };
  // the highest solid block of a column (not a plant, leaves or a fluid), 0 if none
  function solidTop(blocks, col) {
    let y = 254;
    while (y > 1) { const b = blocks[(y << 8) | col]; if (b && (R.T.flags[b] & F.SOLID) && !(R.T.flags[b] & (F.PLANT | F.FLUID | F.REPLACE | F.LEAVES))) break; y--; }
    return y;
  }

  // ---------------------------------------------------------------- corridors (the rail viaducts' lines)
  // the rail lines near a chunk: VR.RailGen.near returns them as xyz points, one per block (cached per cell)
  TR.linesNear = function (g, x0, z0, r) {
    const RG = VR.RailGen;
    if (!RG || !RG.near) return [];
    return RG.near(g, x0 + 8, z0 + 8, r || 120);
  };
  // the columns of a chunk within BAND blocks of a line (1 = a corridor column)
  TR.corridorMask = function (lines, cx, cz) {
    const mask = new Uint8Array(256), x0 = cx * 16, z0 = cz * 16, Bd = TR.BAND, B2 = Bd * Bd;
    for (const L of lines) {
      const P = L.pts;
      for (let i = 0; i < P.length; i += 3) {
        const px = P[i], pz = P[i + 2];
        if (px < x0 - Bd || px > x0 + 15 + Bd || pz < z0 - Bd || pz > z0 + 15 + Bd) continue;
        for (let lz = 0; lz < 16; lz++) {
          const dz = z0 + lz - pz; if (dz * dz > B2) continue;
          for (let lx = 0; lx < 16; lx++) { const dx = x0 + lx - px; if (dx * dx + dz * dz <= B2) mask[(lz << 4) | lx] = 1; }
        }
      }
    }
    return mask;
  };
  // whether (x, z) is in a corridor, by the chunk's mask when it has one (the column's own chunk)
  TR.inCorridor = function (lines, x, z) {
    for (const L of lines) {
      const P = L.pts;
      for (let i = 0; i < P.length; i += 3) { const dx = P[i] - x, dz = P[i + 2] - z; if (dx * dx + dz * dz <= TR.BAND * TR.BAND) return true; }
    }
    return false;
  };

  // ---------------------------------------------------------------- terraces
  // the surface stepped onto the global grid: a column above the grid's nearest step is cut down to it (its
  // blocks above go), a column below is filled up to it with dirt; the step gets a grass tread
  function stepColumn(blocks, col, top, S) {
    const T0 = Math.round(top / TR.STEP) * TR.STEP;
    if (T0 === top || T0 < SEA + 2) return;
    const flags = R.T.flags;
    if (T0 < top) {
      for (let y = T0 + 1; y <= top + 2; y++) {
        const i = (y << 8) | col, b = blocks[i];
        if (!b) continue;
        if (flags[b] & F.FLUID) break;
        blocks[i] = 0;
      }
    } else {
      for (let y = top + 1; y < T0; y++) {
        const i = (y << 8) | col, b = blocks[i];
        if (!b || (flags[b] & (F.PLANT | F.REPLACE))) blocks[i] = S.dirt;
      }
      if (blocks[(top << 8) | col] === S.grass) blocks[(top << 8) | col] = S.dirt;
    }
    blocks[(T0 << 8) | col] = S.grass;
    for (let k = 1; k <= 2; k++) {
      const i = ((T0 - k) << 8) | col, b = blocks[i];
      if (b === S.stone || b === S.deep || b === S.gravel || b === S.redsand || b === S.grass) blocks[i] = S.dirt;
    }
  }
  TR.terraceY = (top) => Math.round(top / TR.STEP) * TR.STEP;

  // ---------------------------------------------------------------- lava vents
  // the vent of a 48-block cell: a point on a mesa top (or none). The same answer in every chunk that asks.
  TR.ventAt = function (g, ci, cj) {
    const h = M.hash2(ci, cj, g.seed + 7171) >>> 0;
    if (h % 100 >= 40) return null;
    const C = TR.VENT_CELL;
    const x = ci * C + 8 + ((h >>> 8) % (C - 16)), z = cj * C + 8 + ((h >>> 16) % (C - 16));
    if (!far(x, z)) return null;
    const cl = g.climateAt(x, z);
    if (cl.ember < 0.5 || cl.canyon > 0.3) return null;
    const y = g.surfaceY(x, z);
    return y >= 84 ? { x, z, y } : null;
  };
  function vents(g, out, cx, cz, lines) {
    const S = states(), blocks = out.blocks, x0 = cx * 16, z0 = cz * 16, C = TR.VENT_CELL;
    for (let cj = Math.floor((z0 - 4) / C); cj <= Math.floor((z0 + 19) / C); cj++) {
      for (let ci = Math.floor((x0 - 4) / C); ci <= Math.floor((x0 + 19) / C); ci++) {
        const V = TR.ventAt(g, ci, cj);
        if (!V || TR.inCorridor(lines, V.x, V.z)) continue;
        // the throat's own column, read before the lava takes its top (solidTop skips fluids)
        const tlx = V.x - x0, tlz = V.z - z0, inC = tlx >= 0 && tlx <= 15 && tlz >= 0 && tlz <= 15;
        const throatCol = inC ? ((tlz << 4) | tlx) : -1, throatTop = inC ? solidTop(blocks, throatCol) : 0;
        for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
          const d2 = dx * dx + dz * dz; if (d2 > 9) continue;
          const lx = V.x + dx - x0, lz = V.z + dz - z0;
          if (lx < 0 || lx > 15 || lz < 0 || lz > 15) continue;
          const col = (lz << 4) | lx, top = solidTop(blocks, col);
          if (top < 70) continue;
          blocks[(top << 8) | col] = d2 <= 1 ? S.lava : d2 <= 4 ? S.magma : S.basalt;
        }
        // the chimney: basalt on the throat, up into the air (the smoke's column)
        if (inC && throatTop >= 70) for (let k = 1; k <= 3; k++) { const i = ((throatTop + k) << 8) | throatCol; if (blocks[i] === 0) blocks[i] = S.basalt; }
      }
    }
  }

  // ---------------------------------------------------------------- the features of one chunk (its own and its neighbours')
  // the trees, spires and crystals of a chunk: decided by the chunk's own rng, written through the column writer
  function features(g, w, fcx, fcz, lines) {
    const rng = new VR.RNG(M.hash2(fcx, fcz, g.seed + 6060));
    const fx0 = fcx * 16, fz0 = fcz * 16;
    for (let i = 0; i < 4; i++) {
      const x = fx0 + rng.int(16), z = fz0 + rng.int(16);
      if (rng.next() > 0.45 || !far(x, z)) continue;
      if (g.climateAt(x, z).terr < 0.5 || (g.villageNear && g.villageNear(x, z, 8)) || TR.inCorridor(lines, x, z)) continue;
      const y = TR.terraceY(g.surfaceY(x, z)) + 1;
      if (y > SEA + 4) GEN.TREES.roundTree(w, x, y, z, rng, { h: 2 + rng.int(2), r: 2.4 });
    }
    // the giant crystals of the prism fields (the trailer's crystal towers): two candidates a chunk, 30 % each
    for (let k = 0; k < 2; k++) if (rng.next() < 0.3) {
      const x = fx0 + 3 + rng.int(10), z = fz0 + 3 + rng.int(10);
      const cl = g.climateAt(x, z);
      if (cl.prism > 0.5 && far(x, z) && VR.RealmSpire && !(g.villageNear && g.villageNear(x, z, 14)) && !TR.inCorridor(lines, x, z)) {
        const y = g.surfaceY(x, z) + 1;
        if (y > SEA + 2) VR.RealmSpire(w, x, y, z, rng, CRY[(M.hash2(x, z, g.seed + 3) >>> 0) % 5], 2.3 + rng.next() * 0.6);
      }
    }
  }

  // ---------------------------------------------------------------- the per-chunk pass
  // the grass and the foliage of the far land are more saturated (TRAILER.md §2.2: #5FD13A grass, #2F8A34 crowns)
  const satCache = new Map();
  function saturate(v, k) {
    const key = v * 8 + Math.round(k * 4);
    let r = satCache.get(key);
    if (r !== undefined) return r;
    const R8 = ((v >> 11) & 31) * 255 / 31, G8 = ((v >> 5) & 63) * 255 / 63, B8 = (v & 31) * 255 / 31;
    const L = 0.3 * R8 + 0.59 * G8 + 0.11 * B8;
    const f = (c) => Math.max(0, Math.min(255, Math.round(L + (c - L) * k)));
    r = VR.rgb565(f(R8), f(G8), f(B8));
    if (satCache.size > 4096) satCache.clear();
    satCache.set(key, r);
    return r;
  }
  TR.post = function (g, cx, cz, out) {
    const S = states(), blocks = out.blocks, x0 = cx * 16, z0 = cz * 16;
    const cls = VR.OverworldGen.climateOf(out);
    const tints = out.tints && out.tints.grass;
    if (out.tints) {
      for (let col = 0; col < 256; col++) {
        if (!far(x0 + (col & 15), z0 + (col >> 4))) continue;
        out.tints.grass[col] = saturate(out.tints.grass[col], 1.35);
        out.tints.foliage[col] = saturate(out.tints.foliage[col], 1.2);
      }
    }
    const lines = TR.linesNear(g, x0, z0, 120);
    const mask = lines.length ? TR.corridorMask(lines, cx, cz) : null;
    const hasVillage = !!g.villageNear;
    for (let col = 0; col < 256; col++) {
      const lx = col & 15, lz = col >> 4, x = x0 + lx, z = z0 + lz;
      if (!far(x, z)) continue;
      const cl = cls ? cls[col] : g.climateAt(x, z);
      const inCor = mask !== null && mask[col] === 1;
      if (cl.terr > 0.5 && !inCor) {
        const top = solidTop(blocks, col);
        if (top > SEA + 2 && !(hasVillage && g.villageNear(x, z, 6))) stepColumn(blocks, col, top, S);
      } else if (cl.ember > 0.45 && cl.canyon < 0.3) {
        // the flat mesa tops are green; the banded walls stay (the trailer's grass-topped mesas)
        const top = solidTop(blocks, col);
        if (top > 80 && isBand(S, blocks[(top << 8) | col]) && blocks[((top + 1) << 8) | col] === 0) {
          blocks[(top << 8) | col] = S.grass; blocks[((top - 1) << 8) | col] = S.dirt; blocks[((top - 2) << 8) | col] = S.dirt;
          if (tints) tints[col] = GREEN_CAP();
        }
      }
    }
    // hanging crystals under the sky isles
    if (g.islandsNear && g.islandsNear(x0, z0).length) {
      for (let col = 0; col < 256; col++) {
        const x = x0 + (col & 15), z = z0 + (col >> 4);
        if (!far(x, z) || M.hash2(x, z, g.seed + 61) % 1000 >= 10) continue;
        const I = g.islandAt(x, z);
        if (!I || I.k < 0.5 || (I.isle && I.isle.designed)) continue;
        const yb = I.bottom - 1, i = (yb << 8) | col;
        if (yb > 3 && blocks[i] === 0) blocks[i] = st(CRY[(M.hash2(x, z, g.seed + 62) >>> 0) % 5] + '_crystal_cluster', { facing: 5, size: 1 });
      }
    }
    vents(g, out, cx, cz, lines);
    const w = new GEN.ColumnWriter(cx, cz, blocks);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) features(g, w, cx + dx, cz + dz, lines);
  };
  const prevGen = OG.generate;
  OG.generate = function (cx, cz) {
    const out = prevGen.call(this, cx, cz);
    if (TR.on(this)) {
      try { TR.post(this, cx, cz, out); } catch (e) {
        if (VR.VillageGen && VR.VillageGen.probe && e === VR.VillageGen.probe) throw e;
        if (!this._trErr) { this._trErr = 1; console.warn('trailer gen', e); }
      }
    }
    return out;
  };
})(VR);
