// ============================================================================
// Other dimensions: Underforge (Nether analog), Hollow (End analog),
// Drift (our own floating sky archipelago), Superflat.
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R, GEN = VR.GEN, M = VR.M, BI = VR.BIOME, BIOMES = VR.BIOMES;
  const st = (n, p) => R.S(n, p);
  const smoothstep = M.smoothstep;

  function emptyTints(biome) {
    const b = BIOMES[biome];
    const g = VR.rgb565((b.grass >> 16) & 255, (b.grass >> 8) & 255, b.grass & 255), f = VR.rgb565((b.foliage >> 16) & 255, (b.foliage >> 8) & 255, b.foliage & 255), w = VR.rgb565((b.water >> 16) & 255, (b.water >> 8) & 255, b.water & 255);
    return { grass: new Uint16Array(256).fill(g), foliage: new Uint16Array(256).fill(f), water: new Uint16Array(256).fill(w) };
  }

  // =============================== UNDERFORGE ===============================
  class UnderforgeGen {
    constructor(seed) {
      this.seed = seed >>> 0;
      const F = VR.Fractal, s = this.seed;
      this.n3 = new F(s ^ 0x11, 3, 1 / 72, 0.5);
      this.n3b = new F(s ^ 0x22, 2, 1 / 26, 0.5);
      this.bT = new F(s ^ 0x33, 2, 1 / 260, 0.5);
      this.bH = new F(s ^ 0x44, 2, 1 / 260, 0.5);
      this.patch = new F(s ^ 0x55, 2, 1 / 20, 0.5);
      this.pillar = new VR.Simplex(s ^ 0x66);
    }
    biomeAt(x, z) {
      const t = this.bT.n2(x, z) * 1.8, h = this.bH.n2(x, z) * 1.8;
      if (t > 0.35) return h > 0 ? BI.crimson_grove : BI.basalt_deltas;
      if (t < -0.35) return h > 0 ? BI.teal_grove : BI.gloom_valley;
      if (h > 0.45) return BI.gloom_valley;
      return BI.ember_wastes;
    }
    density(x, y, z) {
      const f = y < 34 ? Math.pow((34 - y) / 18, 1.6) : 0;
      const c = y > 92 ? Math.pow((y - 92) / 20, 1.6) : 0;
      return this.n3.n3(x, y * 1.4, z) + this.n3b.n3(x, y, z) * 0.25 + f + c - 0.12;
    }
    generate(cx, cz) {
      const S = GEN.S();
      const blocks = new Uint16Array(65536), biome = new Uint8Array(256);
      const x0 = cx * 16, z0 = cz * 16;
      const rng = new VR.RNG(M.hash2(cx, cz, this.seed));
      // coarse density 5x5x17 (8 vertical)
      const dens = new Float32Array(25 * 17);
      for (let j = 0; j <= 4; j++) for (let i = 0; i <= 4; i++) for (let k = 0; k <= 16; k++) dens[(k * 5 + j) * 5 + i] = this.density(x0 + i * 4, k * 8, z0 + j * 4);
      for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
        const col = lz * 16 + lx;
        biome[col] = this.biomeAt(x0 + lx, z0 + lz);
        const ci = lx >> 2, cj = lz >> 2, fx = (lx & 3) / 4, fz = (lz & 3) / 4;
        for (let y = 0; y < 128; y++) {
          const bi = (y << 8) | col;
          if (y === 0 || y === 127 || (y < 4 && M.hashf3(x0 + lx, y, z0 + lz, this.seed) < (4 - y) / 4) || (y > 123 && M.hashf3(x0 + lx, y, z0 + lz, this.seed + 1) < (y - 123) / 4)) { blocks[bi] = S.bedrock; continue; }
          const k = y >> 3, fy = (y & 7) / 8;
          const g = (kk, jj, ii) => dens[(kk * 5 + jj) * 5 + ii];
          const a0 = (g(k, cj, ci) * (1 - fx) + g(k, cj, ci + 1) * fx) * (1 - fz) + (g(k, cj + 1, ci) * (1 - fx) + g(k, cj + 1, ci + 1) * fx) * fz;
          const a1 = (g(k + 1, cj, ci) * (1 - fx) + g(k + 1, cj, ci + 1) * fx) * (1 - fz) + (g(k + 1, cj + 1, ci) * (1 - fx) + g(k + 1, cj + 1, ci + 1) * fx) * fz;
          const d = a0 * (1 - fy) + a1 * fy;
          if (d > 0) blocks[bi] = S.emberrock;
          else if (y <= 31) blocks[bi] = S.lava;
        }
      }
      // surfaces per biome
      for (let col = 0; col < 256; col++) {
        const key = BIOMES[biome[col]].key, lx = col & 15, lz = col >> 4, x = x0 + lx, z = z0 + lz;
        const pn = this.patch.n2(x, z);
        for (let y = 1; y < 126; y++) {
          const bi = (y << 8) | col;
          if (blocks[bi] !== S.emberrock) continue;
          const up = blocks[bi + 256];
          const floor = up === 0;
          const ceil = blocks[bi - 256] === 0;
          if (key === 'gloom_valley' && (floor || blocks[bi + 512] === 0)) blocks[bi] = pn > 0 ? S.gloomsand : S.gloomsoil;
          else if (key === 'basalt_deltas') { if (floor || ceil) blocks[bi] = pn > 0.1 ? S.basalt : S.scoria; if (floor && rng.chance(0.04)) blocks[bi] = S.magma; }
          else if (key === 'crimson_grove' && floor) blocks[bi] = S.crimsonmycel;
          else if (key === 'teal_grove' && floor) blocks[bi] = S.tealmycel;
          else if (key === 'ember_wastes' && floor && pn > 0.45) blocks[bi] = S.gravel;
          // ores
          if (blocks[bi] === S.emberrock) {
            const r = rng.next();
            if (r < 0.012) blocks[bi] = st('ember_quartz_ore'); else if (r < 0.017) blocks[bi] = st('ember_gold_ore');
            else if (y > 8 && y < 22 && r < 0.0175) blocks[bi] = st('relic_ore');
            else if (r < 0.018 && y > 26 && y < 36) blocks[bi] = S.magma;
          }
        }
      }
      const w = new GEN.ColumnWriter(cx, cz, blocks);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) this.features(w, cx + dx, cz + dz);
      // small vegetation & fire
      for (let col = 0; col < 256; col++) {
        const key = BIOMES[biome[col]].key;
        for (let y = 32; y < 124; y++) {
          const bi = (y << 8) | col, b = blocks[bi];
          if (b === 0 || blocks[bi + 256] !== 0) continue;
          const r = rng.next();
          if (b === S.crimsonmycel) { if (r < 0.12) blocks[bi + 256] = st('crimson_roots'); else if (r < 0.14) blocks[bi + 256] = st('crimson_fungus'); }
          else if (b === S.tealmycel) { if (r < 0.1) blocks[bi + 256] = st('teal_roots'); else if (r < 0.16) blocks[bi + 256] = st('ember_sprouts'); else if (r < 0.18) blocks[bi + 256] = st('teal_fungus'); else if (r < 0.19) { const len = 1 + rng.int(6); for (let k = 1; k <= len; k++) { if (blocks[bi + 256 * k] !== 0) break; blocks[bi + 256 * k] = st('twisting_vines', { tip: k === len ? 1 : 0 }); } } }
          else if (b === S.emberrock && key === 'ember_wastes' && r < 0.006) blocks[bi + 256] = st('fire');
          else if ((b === S.gloomsand || b === S.gloomsoil) && r < 0.004) blocks[bi + 256] = st('spirit_fire');
          else if (b === S.gloomsand && r < 0.01) { // bone fossils
            for (let k = 1; k < 4; k++) blocks[bi + 256 * k] = st('bone_block', { axis: 0 });
          }
        }
      }
      return { blocks, biome, caveBiome: new Int8Array(256).fill(-1), tints: emptyTints(BI.ember_wastes), chests: [] };
    }
    features(w, fcx, fcz) {
      const rng = new VR.RNG(M.hash2(fcx, fcz, this.seed + 77));
      const S = GEN.S();
      const x0 = fcx * 16, z0 = fcz * 16;
      const key = BIOMES[this.biomeAt(x0 + 8, z0 + 8)].key;
      // find floors via density scan (deterministic)
      const floorAt = (x, z) => { for (let y = 100; y > 33; y--) if (this.density(x, y, z) > 0 && this.density(x, y + 1, z) <= 0 && this.density(x, y + 2, z) <= 0) return y; return -1; };
      if (key === 'crimson_grove' || key === 'teal_grove') {
        for (let i = 0; i < 4; i++) { const x = x0 + rng.int(16), z = z0 + rng.int(16); const y = floorAt(x, z); if (y > 0) GEN.TREES.hugeFungus(w, x, y + 1, z, rng, key === 'crimson_grove' ? 'crimson' : 'teal'); }
      }
      if (key === 'basalt_deltas' || key === 'gloom_valley') {
        for (let i = 0; i < 2; i++) if (rng.chance(0.6)) {
          const x = x0 + rng.int(16), z = z0 + rng.int(16); const y = floorAt(x, z); if (y < 0) continue;
          const h = 4 + rng.int(12);
          for (let k = 1; k <= h; k++) w.place(x, y + k, z, st('basalt', { axis: 0 }), 2);
        }
      }
      // sunstone clusters on ceilings
      for (let i = 0; i < 3; i++) if (rng.chance(0.5)) {
        const x = x0 + rng.int(16), z = z0 + rng.int(16);
        for (let y = 118; y > 50; y--) {
          if (this.density(x, y, z) > 0 && this.density(x, y - 1, z) <= 0) {
            const ss = st('sunstone');
            for (let n = 0; n < 30; n++) w.place(x + rng.irange(-2, 2), y - 1 - rng.int(4), z + rng.irange(-2, 2), ss);
            break;
          }
        }
      }
      // ember brick bridge (rare)
      if (rng.chance(0.04)) {
        const y = 70 + rng.int(20), dir = rng.int(2);
        const eb = st('ember_bricks'), fence = st('ember_brick_fence');
        for (let i = 0; i < 16; i++) for (let s = -2; s <= 2; s++) {
          const x = x0 + (dir ? i : 8 + s), z = z0 + (dir ? 8 + s : i);
          w.set(x, y, z, eb);
          if (Math.abs(s) === 2) w.set(x, y + 1, z, fence);
          else w.set(x, y + 1, z, 0), w.set(x, y + 2, z, 0), w.set(x, y + 3, z, 0);
        }
      }
    }
    findSpawn(x, z) { for (let r = 0; r < 200; r += 3) for (let a = 0; a < 12; a++) { const px = Math.round(x + Math.cos(a) * r), pz = Math.round(z + Math.sin(a) * r); for (let y = 40; y < 110; y++) if (this.density(px, y, pz) > 0 && this.density(px, y + 1, pz) <= 0 && this.density(px, y + 2, pz) <= 0 && this.density(px, y + 3, pz) <= 0) return [px + 0.5, y + 1, pz + 0.5]; } return [x + 0.5, 70, z + 0.5]; }
  }
  VR.UnderforgeGen = UnderforgeGen;

  // ================================ HOLLOW =================================
  class HollowGen {
    constructor(seed) {
      this.seed = seed >>> 0;
      this.isl = new VR.Fractal(this.seed ^ 0x77, 3, 1 / 90, 0.5);
      this.det = new VR.Fractal(this.seed ^ 0x88, 2, 1 / 24, 0.5);
      this.pillars = [];
      const rng = new VR.RNG(this.seed ^ 0xabc);
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; this.pillars.push({ x: Math.round(Math.cos(a) * 42), z: Math.round(Math.sin(a) * 42), r: 2 + rng.int(3), h: 76 + rng.int(28) }); }
    }
    islandTop(x, z) {
      const d = Math.sqrt(x * x + z * z);
      if (d < 180) { const f = 1 - d / 180; const n = this.isl.n2(x, z) * 8; return f > 0 ? { top: 62 + f * 4 + n * f, bottom: 62 - f * 44 - n * 2 } : null; }
      if (d > 700) {
        const n = this.isl.n2(x, z), m = this.det.n2(x, z);
        const v = n * 1.8 + m * 0.3 - 0.35;
        if (v > 0) return { top: 58 + v * 10 + m * 3, bottom: 58 - v * 40 };
      }
      return null;
    }
    generate(cx, cz) {
      const S = GEN.S();
      const blocks = new Uint16Array(65536), biome = new Uint8Array(256);
      const x0 = cx * 16, z0 = cz * 16;
      for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
        const x = x0 + lx, z = z0 + lz, col = lz * 16 + lx;
        const d = Math.sqrt(x * x + z * z);
        biome[col] = d < 200 ? BI.hollow_core : d > 900 ? BI.hollow_highlands : BI.hollow_barrens;
        const t = this.islandTop(x, z);
        if (!t) continue;
        const top = Math.floor(t.top), bot = Math.max(1, Math.floor(t.bottom));
        for (let y = bot; y <= top && y < 250; y++) blocks[(y << 8) | col] = S.voidstone;
      }
      const w = new GEN.ColumnWriter(cx, cz, blocks);
      // pillars near center
      for (const p of this.pillars) {
        if (Math.abs(p.x - (x0 + 8)) > 16 || Math.abs(p.z - (z0 + 8)) > 16) continue;
        for (let dx = -p.r; dx <= p.r; dx++) for (let dz = -p.r; dz <= p.r; dz++) if (dx * dx + dz * dz <= p.r * p.r + 0.5) for (let y = 55; y <= p.h; y++) w.set(p.x + dx, y, p.z + dz, S.obsidian);
        w.set(p.x, p.h + 1, p.z, st('light_rod', { facing: 4 }));
        w.set(p.x, p.h + 2, p.z, st('beacon'));
      }
      // central gate back home
      if (Math.abs(x0 + 8) < 24 && Math.abs(z0 + 8) < 24) {
        for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
          const r = dx * dx + dz * dz;
          if (r <= 12) w.set(dx, 64, dz, st('bedrock'));
          if (r <= 6 && r > 0) w.set(dx, 65, dz, st('void_gate'));
          if (r > 6 && r <= 12) w.set(dx, 65, dz, st('bedrock'));
        }
        for (let y = 65; y < 69; y++) w.set(0, y, 0, st('bedrock'));
        w.set(0, 69, 0, st('light_rod', { facing: 4 }));
      }
      // outer islands: starfruit plants & lilacite spires
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const fx = cx + dx, fz = cz + dz, rng = new VR.RNG(M.hash2(fx, fz, this.seed + 5));
        const X = fx * 16 + 8, Z = fz * 16 + 8;
        if (Math.sqrt(X * X + Z * Z) < 700) continue;
        for (let i = 0; i < 2; i++) {
          const x = fx * 16 + rng.int(16), z = fz * 16 + rng.int(16); const t = this.islandTop(x, z); if (!t || t.top - t.bottom < 4) continue;
          const y = Math.floor(t.top) + 1;
          if (rng.chance(0.7)) this.starfruit(w, x, y, z, rng);
        }
        if (rng.chance(0.06)) { const t = this.islandTop(X, Z); if (t && t.top - t.bottom > 8) this.spire(w, X, Math.floor(t.top) + 1, Z, rng); }
      }
      return { blocks, biome, caveBiome: new Int8Array(256).fill(-1), tints: emptyTints(BI.hollow_core), chests: [] };
    }
    starfruit(w, x, y, z, rng) {
      const plant = st('starfruit_plant'), flower = st('starfruit_flower', { age: 0 });
      const grow = (px, py, pz, depth) => {
        const h = 1 + rng.int(4);
        for (let i = 0; i < h; i++) w.place(px, py + i, pz, plant);
        if (depth < 3 && rng.chance(0.8)) {
          const n = 1 + rng.int(3);
          for (let b = 0; b < n; b++) { const f = rng.int(4); const bx = px + VR.HF_DX[f], bz = pz + VR.HF_DZ[f]; w.place(bx, py + h - 1, bz, plant); grow(bx, py + h, bz, depth + 1); }
        } else w.place(px, py + h, pz, flower);
      };
      grow(x, y, z, 0);
    }
    spire(w, x, y, z, rng) {
      const blk = st('lilacite_block'), pil = st('lilacite_pillar', { axis: 0 }), vb = st('voidstone_bricks');
      const h = 14 + rng.int(12);
      for (let i = 0; i < h; i++) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
        const edge = Math.abs(dx) === 2 || Math.abs(dz) === 2;
        if (Math.abs(dx) === 2 && Math.abs(dz) === 2) { w.set(x + dx, y + i, z + dz, pil); continue; }
        if (i === 0 || i % 6 === 5) w.set(x + dx, y + i, z + dz, vb);
        else w.set(x + dx, y + i, z + dz, edge ? (i % 6 === 3 && (dx === 0 || dz === 0) ? st('purple_stained_glass') : blk) : 0);
      }
      w.set(x, y + h, z, st('light_rod', { facing: 4 }));
      w.set(x, y + 1, z, st('chest', { facing: 2 }));
    }
    findSpawn() { return [0.5, 66, 8.5]; }
  }
  VR.HollowGen = HollowGen;

  // ================================ DRIFT ==================================
  class DriftGen {
    constructor(seed) {
      this.seed = seed >>> 0;
      const F = VR.Fractal, s = this.seed;
      this.mask = new F(s ^ 0x91, 3, 1 / 130, 0.5);
      this.top = new F(s ^ 0x92, 3, 1 / 60, 0.5);
      this.bot = new F(s ^ 0x93, 2, 1 / 40, 0.5);
      this.lvl = new F(s ^ 0x94, 2, 1 / 400, 0.5);
      this.bio = new F(s ^ 0x95, 2, 1 / 300, 0.5);
    }
    shape(x, z) {
      const m = this.mask.n2(x, z) * 1.9 - 0.12;
      if (m <= 0) return null;
      const base = 110 + this.lvl.n2(x, z) * 60;
      const f = Math.min(1, m * 2.2);
      const top = base + f * 6 + this.top.n2(x, z) * 5 * f;
      const bottom = base - f * (14 + this.bot.n2(x, z) * 10) * Math.min(1, m * 3) - m * 22;
      return { top, bottom, m };
    }
    biomeAt(x, z) { const b = this.bio.n2(x, z) * 1.8; return b > 0.35 ? BI.prism_reach : b < -0.2 ? BI.drift_meadow : BI.drift_isles; }
    generate(cx, cz) {
      const S = GEN.S();
      const blocks = new Uint16Array(65536), biome = new Uint8Array(256);
      const x0 = cx * 16, z0 = cz * 16;
      const rng = new VR.RNG(M.hash2(cx, cz, this.seed));
      for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
        const x = x0 + lx, z = z0 + lz, col = lz * 16 + lx;
        biome[col] = this.biomeAt(x, z);
        const sh = this.shape(x, z);
        if (!sh) continue;
        const top = Math.floor(sh.top), bot = Math.floor(sh.bottom);
        const prism = biome[col] === BI.prism_reach;
        for (let y = Math.max(1, bot); y <= top && y < 250; y++) {
          const d = top - y;
          blocks[(y << 8) | col] = d === 0 ? (prism ? S.calcite : S.grass) : d < 3 ? (prism ? S.calcite : S.dirt) : (prism && rng.chance(0.05) ? st('amethyst_block') : S.stone);
        }
        // ore sprinkle
        for (let y = Math.max(1, bot); y < top - 3; y++) if (rng.chance(0.004)) blocks[(y << 8) | col] = st(rng.pick(['coal_ore', 'iron_ore', 'copper_ore', 'lapis_ore', 'gold_ore', 'diamond_ore']));
      }
      const w = new GEN.ColumnWriter(cx, cz, blocks);
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const fx = cx + dx, fz = cz + dz, r = new VR.RNG(M.hash2(fx, fz, this.seed + 9));
        for (let i = 0; i < 4; i++) {
          const x = fx * 16 + r.int(16), z = fz * 16 + r.int(16); const sh = this.shape(x, z);
          if (!sh || sh.m < 0.12) continue;
          const y = Math.floor(sh.top) + 1, bk = BIOMES[this.biomeAt(x, z)].key;
          if (bk === 'prism_reach') { if (r.chance(0.5)) this.crystal(w, x, y, z, r); }
          else if (bk === 'drift_meadow') { if (r.chance(0.4)) GEN.TREES.azalea(w, x, y, z, r); }
          else { const k = r.int(3); if (k === 0) GEN.TREES.cherry(w, x, y, z, r); else if (k === 1) GEN.TREES.poplar(w, x, y, z, r); else GEN.TREES.birch(w, x, y, z, r); }
        }
        // waterfall springs on island edges
        if (r.chance(0.35)) { const x = fx * 16 + r.int(16), z = fz * 16 + r.int(16); const sh = this.shape(x, z); if (sh && sh.m < 0.2 && sh.m > 0.05) w.set(x, Math.floor(sh.top), z, S.water); }
      }
      // grass & flowers
      for (let col = 0; col < 256; col++) {
        let y = 250; while (y > 1 && blocks[(y << 8) | col] === 0) y--;
        if (blocks[(y << 8) | col] !== S.grass || blocks[((y + 1) << 8) | col] !== 0) continue;
        const r = rng.next();
        if (r < 0.3) blocks[((y + 1) << 8) | col] = S.shortgrass;
        else if (r < 0.36) blocks[((y + 1) << 8) | col] = st(rng.pick(['allium', 'azure_bluet', 'cornflower', 'pink_tulip', 'white_tulip', 'lily_of_the_valley', 'oxeye_daisy']));
        else if (r < 0.4) blocks[((y + 1) << 8) | col] = st('wildflowers', { count: rng.int(4), facing: rng.int(4) });
      }
      return { blocks, biome, caveBiome: new Int8Array(256).fill(-1), tints: emptyTints(BI.drift_isles), chests: [] };
    }
    crystal(w, x, y, z, rng) {
      const kinds = ['amethyst_block', 'amethyst_block', 'calcite'];
      const h = 3 + rng.int(7);
      for (let i = 0; i < h; i++) { const r = Math.max(0, Math.round((1 - i / h) * 1.5)); for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) w.place(x + dx, y + i, z + dz, st(kinds[rng.int(3)]), 2); }
      w.place(x, y + h, z, st('amethyst_cluster', { facing: 4 }));
      for (let n = 0; n < 4; n++) { const f = rng.int(4); w.place(x + VR.HF_DX[f] * 2, y, z + VR.HF_DZ[f] * 2, st('ice_crystal', { facing: 4, size: rng.int(3) })); }
    }
    findSpawn() {
      for (let r = 0; r < 3000; r += 8) for (let a = 0; a < 16; a++) {
        const x = Math.round(Math.cos(a * 0.39) * r), z = Math.round(Math.sin(a * 0.39) * r);
        const sh = this.shape(x, z); if (sh && sh.m > 0.25) return [x + 0.5, Math.floor(sh.top) + 2, z + 0.5];
      }
      return [0.5, 140, 0.5];
    }
  }
  VR.DriftGen = DriftGen;

  // ================================ FLAT ===================================
  class FlatGen {
    constructor() { }
    generate() {
      const S = GEN.S();
      const blocks = new Uint16Array(65536);
      for (let col = 0; col < 256; col++) { blocks[col] = S.bedrock; blocks[256 + col] = S.dirt; blocks[512 + col] = S.dirt; blocks[768 + col] = S.grass; }
      return { blocks, biome: new Uint8Array(256).fill(BI.plains), caveBiome: new Int8Array(256).fill(-1), tints: emptyTints(BI.plains), chests: [] };
    }
    findSpawn() { return [0.5, 5, 0.5]; }
    surfaceY() { return 3; }
  }
  VR.FlatGen = FlatGen;

  VR.makeGen = function (dim, seed, opts) {
    if (dim === 'underforge') return new UnderforgeGen(seed);
    if (dim === 'hollow') return new HollowGen(seed);
    if (dim === 'drift') return new DriftGen(seed);
    if (opts && opts.worldType === 'flat') return new FlatGen();
    return new VR.OverworldGen(seed, opts);
  };
  VR.DIMS = {
    overworld: { name: 'Overworld', sky: true, ceiling: false, minY: 0 },
    underforge: { name: 'The Underforge', sky: false, ceiling: true, scale: 8 },
    hollow: { name: 'The Hollow', sky: false, ceiling: false, dark: true },
    drift: { name: 'The Drift', sky: true, ceiling: false, void: true },
  };
})(VR);
