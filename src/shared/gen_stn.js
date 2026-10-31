// ============================================================================
// u-stations (docs/superpowers/plans/2026-10-31-u-stations.md): the stations as dims. `stn.ring` — the Ringstation
// geostationary over Herzwelt's equator; `stn.basalt`, `stn.opal` — the outposts in low orbits round the two moons. Each
// is a finite world: the R9 Forge's station kind (forge_station.js) stamped into its columns, the void everywhere else.
// Home gravity (the plates, −y), a sky (the open docking deck has sky light; the space scene is drawn as that sky:
// src/main/stations.js), no village life of Herzwelt's kind (the station's own crew, stations.js), reachable by docking
// and by /dim. The grid is built once per thread on first use (≈ 40 ms) and only read after.
// ============================================================================
(function (VR) {
  'use strict';
  const D = VR.DimReg, Forge = VR.Forge;
  if (!D || !Forge || !Forge.Station) return;
  const STA = Forge.Station, BI = VR.BIOME, BIOMES = VR.BIOMES;
  const KIND = { 'stn.ring': 0, 'stn.basalt': 1, 'stn.opal': 1 };
  // u-stations2: the save's station generator version (opts.bgen.stn: src/main/stations.js STN.stampS) — 1 when absent
  const gridOf = (k, v) => STA.grid(k, v);
  function tints() {
    const b = BIOMES[BI.plains], c = (v) => VR.rgb565((v >> 16) & 255, (v >> 8) & 255, v & 255);
    return { grass: new Uint16Array(256).fill(c(b.grass)), foliage: new Uint16Array(256).fill(c(b.foliage)), water: new Uint16Array(256).fill(c(b.water)) };
  }
  class StationGen {
    constructor(seed, dim, opts) { this.seed = seed >>> 0; this.dim = dim; this.k = KIND[dim] | 0; this.box = STA.box(this.k); this.sgen = (opts && opts.bgen && opts.bgen.stn) | 0 || 1; }
    // a column: the grid's cells that fall in it (0xFFFF and air leave the void)
    generate(cx, cz) {
      const blocks = new Uint16Array(65536), B = this.box, x0 = cx * 16, z0 = cz * 16;
      if (x0 + 16 > B.x0 && x0 < B.x0 + B.sx && z0 + 16 > B.z0 && z0 < B.z0 + B.sz) {
        const g = gridOf(this.k, this.sgen), gb = g.blocks, sx = g.sx, sz = g.sz;
        for (let lz = 0; lz < 16; lz++) {
          const gz = z0 + lz - B.z0; if (gz < 0 || gz >= sz) continue;
          for (let lx = 0; lx < 16; lx++) {
            const gx = x0 + lx - B.x0; if (gx < 0 || gx >= sx) continue;
            const col = (lz << 4) | lx;
            for (let gy = 0; gy < g.sy; gy++) { const s = gb[(gy * sz + gz) * sx + gx]; if (s && s !== 0xFFFF) blocks[((B.y0 + gy) << 8) | col] = s; }
          }
        }
      }
      return { blocks, biome: new Uint8Array(256).fill(BI.plains), caveBiome: new Int8Array(256).fill(-1), tints: tints(), chests: [] };
    }
    findSpawn() { const s = STA.place(this.k).spawn; return [s[0], s[1], s[2], s[3] || 0, 0]; }
    surfaceY() { return STA.FY - 1; }
  }
  VR.StationGen2 = StationGen;
  const add = (id, name, veil) => D.add(id, { sky: true, code: 5, travel: true, mp: 'convoy', station: true, gen: (seed, opts) => new StationGen(seed, id, opts), name, veil });
  add('stn.ring', ['g.dim.stnRing', 'Ringstation', 'Ringstation'], ['#eaf6ff', '#7fc8ff', '#0a1230']);
  add('stn.basalt', ['g.dim.stnBasalt', 'Außenposten Basalt', 'Basalt Outpost'], ['#f1efe9', '#9b9892', '#0c0c11']);
  add('stn.opal', ['g.dim.stnOpal', 'Außenposten Opal', 'Opal Outpost'], ['#ffffff', '#cfe4f6', '#0f1a2e']);
})(VR);
