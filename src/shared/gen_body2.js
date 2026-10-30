// ============================================================================
// u-moons2 · VR.BodyGenKinds — the world generators of Zinnober, Ocker and Aquamarin (plan docs/superpowers/plans/
// 2026-10-30-u-moons2.md §1; U§6.3; R§2.3, §5.4, §5.5). Subclasses of gen_body.js's BodyGen: `new VR.BodyGen(seed, id)`
// hands back the right one, so the worker, the dims and the tests know one name. The same interface (generate,
// surfaceY, heightAt, biomeAt, climateAt, biomeFor, tints, findSpawn), versioned by bgen (test/body_same.js pins bgen
// 1's chunks of all five bodies). Landforms the size of the world are 1/64 replicas (picked by their real size); things
// at walking size (dunes, rocks, vents, sea stacks) keep their real size (U§6.3).
//   volcanic (Zinnober, Io's kind): sulfur plains in four colours (yellow sulfur, white SO₂ frost, orange, red), paterae
//     with steep walls and flat dark floors — a quarter of them lava lakes (glowing lava under drifting black crust
//     plates) with lobate flows out of them, their heads still molten in places — tilted crustal mountain blocks
//     125–265 m with steep flanks (the world top caps the highest), six active vents with red rings and white frost
//     halos (the plumes: bodylife2.js), the Glutsee (a lava lake 260 m wide, 430 m north of the landing)
//   dust (Ocker, Mars' kind): the plain at y 150; barchan dunes at real size (crescents 60–160 m, slip faces downwind),
//     mesas with layered walls and talus aprons, worn craters, the Rostschlucht (145 m deep, 1.4 km wide, layered walls
//     with benches and gullies, dunes on its floor) its rim 450 m south, the Ockerdom (240 m — its basal scarp and its gentle
//     flanks, the summit soft-capped under the world top: a stated compression) 5.3 km north, the dust devils' dark
//     tracks, scattered rocks
//   ocean (Aquamarin): the sea at y 63 over a floor 20–30 m down; archipelagos (an elevation field whose zero line is
//     the coast: beaches, basalt cliffs, clay hollows), drowned-crater atolls (a ring island 2–3 m over the sea round a
//     shallow lagoon, cut by passes), sea stacks off the coasts; the water blue-green, the lagoons turquoise
// ============================================================================
(function (VR) {
  'use strict';
  const M = VR.M, B = VR.Bodies, Base = VR.BodyGen;
  if (!Base || !B) return;
  const ss = (a, b, x) => { let t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
  const TAU = Math.PI * 2;
  let S_ = null;
  function S() {
    if (S_) return S_;
    const R = VR.R, s = (n) => R.S(n), G = VR.GEN.S();
    S_ = {
      bedrock: G.bedrock, basalt: s('basalt'), smoothBasalt: G.smoothbasalt, obsidian: s('obsidian'), lava: s('lava'), tuff: s('tuff'),
      sulfur: s('sulfur'), sulfurRed: s('sulfur_red'), frost: s('so2_frost'), orange: s('orange_terracotta'), fuming: s('fuming_sulfur'),
      redSand: s('red_sand'), ochre: s('ochre_rock'), terracotta: s('terracotta'), sandstone: s('sandstone'), redSandstone: s('red_sandstone'),
      coarse: s('coarse_dirt'), gravel: G.gravel, dust: s('ocker_dust'), sand: s('sand'), clay: s('clay'), water: s('water'), andesite: s('andesite'),
    };
    return S_;
  }
  // the biomes of the three worlds (appended after u-moons1's: a save's biome bytes keep their meaning). water: the sea's
  // colour (Aquamarin: deep blue-green, the lagoons turquoise)
  if (VR.BIOMES && VR.BIOME && VR.BIOME.zinn_plains === undefined) {
    const add = (key, name, col, moon, water) => { const e = { id: VR.BIOMES.length, key, name, temp: 0.5, down: 0, grass: col, foliage: col, water: water || 0x3F76E4, sky: 0, fog: null, precip: 'none', moon }; VR.BIOMES.push(e); VR.BIOME[key] = e.id; };
    add('zinn_plains', 'Sulfur Plains', 0xd8c050, 'zinn'); add('zinn_patera', 'Patera', 0x4a4038, 'zinn'); add('zinn_lava', 'Lava Lake', 0xff6020, 'zinn'); add('zinn_mountains', 'Mountain Block', 0x9a8a60, 'zinn');
    add('ocker_plains', 'Dust Plains', 0xb06a3a, 'ocker'); add('ocker_dunes', 'Dune Field', 0x9a5530, 'ocker'); add('ocker_mesa', 'Mesas', 0xb88050, 'ocker'); add('ocker_canyon', 'Canyon', 0x8a5034, 'ocker'); add('ocker_shield', 'Shield Volcano', 0x7a5a48, 'ocker');
    add('aqua_sea', 'Open Sea', 0x2a7a80, 'aqua', 0x167884); add('aqua_island', 'Islands', 0xb8a888, 'aqua', 0x1f8f96); add('aqua_lagoon', 'Lagoon', 0x40c0b0, 'aqua', 0x34c4b6); add('aqua_atoll', 'Atoll', 0xd8ccaa, 'aqua', 0x28a8a8);
  }
  const BIO = () => VR.BIOME;

  // ================================================================ the common frame of the three kinds
  class Kind2 extends Base {
    constructor(seed, id, opts) {
      super(seed, id, opts);
      this.fc = new Map();   // the features near a chunk (cached by the chunk's box)
      this._o = {};
      this.init();
    }
    // the features whose reach meets the box (x0, z0)–(x1, z1): per kind (this.featsBox), cached for the chunks
    feats(x0, z0, x1, z1) {
      const key = x0 + ',' + z0 + ',' + x1 + ',' + z1;
      let f = this.fc.get(key);
      if (!f) { if (this.fc.size > 256) this.fc.clear(); f = this.featsBox(x0, z0, x1, z1); this.fc.set(key, f); }
      return f;
    }
    heightAt(x, z) { return this.col(x, z, this._o, this.feats(x, z, x, z)).h; }
    surfaceY(x, z) { return Math.floor(this.heightAt(x, z)); }
    climateAt(x, z) { const o = this.col(x, z, {}, this.feats(x, z, x, z)); return { bio: o.bio, h: o.h, lava: !!o.lava, water: o.h < (this.prof.sea || -1) }; }
    biomeFor(cl) { return BIO()[cl.bio] !== undefined ? BIO()[cl.bio] : 0; }
    biomeAt(x, z) { return this.biomeFor(this.climateAt(x, z)); }
    tints() { const w = VR.rgb565(30, 120, 132), g = VR.rgb565(150, 140, 120); return { grass: new Uint16Array(256).fill(g), foliage: new Uint16Array(256).fill(g), water: new Uint16Array(256).fill(w) }; }
    // a standable, flat, dry spot near (x, z) — and the way to look (toward the kind's landmark)
    findSpawn(x, z) {
      x = Number.isFinite(x) ? x : this.prof.spawn.x; z = Number.isFinite(z) ? z : this.prof.spawn.z;
      // u-moons3 (bgen 2): the landing faces the world's best view — this.land {x, z, look, pitch} (asked for the
      // profile's spawn: the travel's own search); bgen 1 lands where it did
      const LD = this.bgen >= 2 && this.land && x === this.prof.spawn.x && z === this.prof.spawn.z ? this.land : null;
      if (LD) {
        for (let r = 0; r < 120; r += 2) for (let a = 0; a < (r ? 12 : 1); a++) {
          const px = Math.round(LD.x + Math.cos(a / 12 * TAU) * r), pz = Math.round(LD.z + Math.sin(a / 12 * TAU) * r);
          const F = this.feats(px - 4, pz - 4, px + 4, pz + 4), o = this.col(px, pz, {}, F), h0 = o.h;
          if (!this.okSpawn(o)) continue;
          let flat = true;
          for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) { const q = this.col(px + dx, pz + dz, {}, F); if (Math.abs(q.h - h0) > 1.2 || !this.okSpawn(q)) { flat = false; break; } }
          if (!flat) continue;
          return [px + 0.5, Math.floor(h0) + 1, pz + 0.5, Math.atan2(-(LD.look.x - px), -(LD.look.z - pz)), LD.pitch];
        }
      }
      for (let r = 0; r < 900; r += 6) for (let a = 0; a < (r ? 16 : 1); a++) {
        const px = Math.round(x + Math.cos(a / 16 * TAU) * r), pz = Math.round(z + Math.sin(a / 16 * TAU) * r);
        const F = this.feats(px - 4, pz - 4, px + 4, pz + 4), o = this.col(px, pz, {}, F), h0 = o.h;
        if (!this.okSpawn(o)) continue;
        let flat = true;
        for (const [dx, dz] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) { const q = this.col(px + dx, pz + dz, {}, F); if (Math.abs(q.h - h0) > 1.2 || !this.okSpawn(q)) { flat = false; break; } }
        if (!flat) continue;
        const L = this.look || { x: px, z: pz - 100 };
        return [px + 0.5, Math.floor(h0) + 1 + (o.rock ? 1 : 0), pz + 0.5, Math.atan2(-(L.x - px), -(L.z - pz))];
      }
      return [x + 0.5, this.surfaceY(Math.round(x), Math.round(z)) + 1, z + 0.5, 0];
    }
    okSpawn(o) { return !o.lava && !o.rock && !(this.prof.sea && o.h < this.prof.sea + 1); }
    // ---------------------------------------------------------------- a chunk
    generate(cx, cz) {
      const T = S(), BI = BIO();
      const blocks = new Uint16Array(65536), biome = new Uint8Array(256);
      const x0 = cx * 16, z0 = cz * 16;
      const F = this.feats(x0 - 1, z0 - 1, x0 + 16, z0 + 16);
      const H = this._H || (this._H = new Float32Array(18 * 18)), info = this._info || (this._info = []);
      for (let j = 0; j < 18; j++) for (let i = 0; i < 18; i++) {
        const k = j * 18 + i, o = info[k] || (info[k] = {});
        this.col(x0 + i - 1, z0 + j - 1, o, F);
        H[k] = o.h;
      }
      const wat = new Uint16Array(256);
      for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
        const k = (lz + 1) * 18 + lx + 1, o = info[k], col = lz * 16 + lx, x = x0 + lx, z = z0 + lz;
        const top = Math.max(2, Math.min(250, Math.floor(H[k])));
        const slope = Math.max(Math.abs(H[k + 1] - H[k - 1]), Math.abs(H[k + 18] - H[k - 18])) * 0.5;
        blocks[col] = T.bedrock;
        this.fill(blocks, col, top, o, slope, M.hashf2(x, z, this.s + 31), x, z, T);
        const b = BI[o.bio];
        biome[col] = b !== undefined ? b : 0;
        const wc = VR.BIOMES[biome[col]] && VR.BIOMES[biome[col]].water;
        wat[col] = VR.rgb565((wc >> 16) & 255, (wc >> 8) & 255, wc & 255);
      }
      this.lastInfo = info;
      this.post(blocks, x0, z0, H, info, F, T);
      const g = VR.rgb565(150, 140, 120);
      return { blocks, biome, caveBiome: new Int8Array(256).fill(-1), tints: { grass: new Uint16Array(256).fill(g), foliage: new Uint16Array(256).fill(g), water: wat }, chests: [], spawns: [] };
    }
    post() { /* per kind */ }
    // the cells of a grid of size C whose feature (reach r) meets the box → [i, j] pairs
    cellsIn(C, reach, x0, z0, x1, z1, out) {
      const i0 = Math.floor((x0 - reach) / C), i1 = Math.floor((x1 + reach) / C), j0 = Math.floor((z0 - reach) / C), j1 = Math.floor((z1 + reach) / C);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) out.push(i, j);
      return out;
    }
  }

  // ================================================================ Zinnober — volcanic
  class Volcanic extends Kind2 {
    init() {
      const F = VR.Fractal, s = this.s, P = this.prof;
      this.nBase = new F(s ^ 0x101, 3, 1 / 900, 0.5); this.nFine = new F(s ^ 0x102, 2, 1 / 60, 0.5);
      this.nCol = new F(s ^ 0x103, 3, 1 / 1400, 0.55); this.nCol2 = new F(s ^ 0x104, 2, 1 / 160, 0.5);
      this.nRidge = new F(s ^ 0x105, 3, 1 / 140, 0.5); this.nEdge = new F(s ^ 0x106, 2, 1 / 45, 0.5);
      const L = P.landmark;
      this.glut = { x: L.x, z: L.z, R: L.D / 2, depth: L.depth, lake: true, h: 0x61a7, rot: 0.6, flows: [] };
      this.glut.flows = this.flowsOf(this.glut, 0x5eed);
      this.look = this.glut;
      // u-moons3 (bgen 2): the landing on the Glutsee's lip on the side of the old landing, the eye lowered a little (the lava below, the steady plume over the far shore)
      { const G = this.glut, dl = Math.hypot(P.spawn.x - G.x, P.spawn.z - G.z) || 1; this.land = { x: G.x + (P.spawn.x - G.x) / dl * G.R * 1.1, z: G.z + (P.spawn.z - G.z) / dl * G.R * 1.1, look: G, pitch: -0.12 }; }
      // the six active vents (the plumes, bodylife2.js): one 2.2 km north-east in sight of the landing, the rest 1.5–6 km
      const V = [], rng = new VR.RNG(s ^ 0x7e47);
      // (u-moons3, bgen 2: the vents 7–16 km off — a plume is seen from the side, a fountain with its umbrella, not from
      // under its canopy — the first 11.6 km north-north-east, beside the Glutsee in the landing's view)
      const far2 = this.bgen >= 2;
      V.push(far2 ? { x: 3200, z: -11400 } : { x: 1500, z: -1700 });
      for (let k = 1; k < P.plume.n; k++) { const a = rng.next() * TAU, r = far2 ? 7000 + 9000 * rng.next() : 1500 + 4500 * rng.next(); V.push({ x: Math.round(Math.cos(a) * r), z: Math.round(Math.sin(a) * r) }); }
      this.ventList = V.map((v, k) => ({ x: v.x + 0.5, z: v.z + 0.5, y: 0, k, id: k, seed: M.hash2(k, 31, s + 91), ring: 300 + 120 * M.hashf2(k, 3, s), steady: far2 && k === 0 }));
      // a mountain block in sight of the landing (west-north-west) — Io's are tilted crustal blocks, not volcanoes
      this.landMtn = { x: -1500, z: -900, r: 640, h: 205, ph1: 0.7, ph2: 2.1, tx: 0.8, tz: -0.6 };
      for (const v of this.ventList) v.y = Math.floor(this.heightAt(Math.floor(v.x), Math.floor(v.z)));
    }
    vents() { return this.ventList.slice(); }
    // a patera of cell (i, j) or null: its centre, size, depth, lake or not, flows
    patera(i, j) {
      const P = this.prof.paterae, s = this.s, C = P.cell;
      if (M.hashf2(i, j, s + 201) >= P.p) return null;
      const x = (i + 0.15 + 0.7 * M.hashf2(i, j, s + 202)) * C, z = (j + 0.15 + 0.7 * M.hashf2(i, j, s + 203)) * C;
      if (x * x + z * z < 420 * 420) return null;                                   // (the landing's plain stays open)
      const u = M.hashf2(i, j, s + 204), D = P.D[0] + (P.D[1] - P.D[0]) * u * u, h = M.hash2(i, j, s + 205);
      const p = { x, z, R: D / 2, depth: P.depth[0] + (P.depth[1] - P.depth[0]) * M.hashf2(i, j, s + 206), lake: M.hashf2(i, j, s + 207) < P.lake, h, rot: (h % 628) / 100, flows: [] };
      if (p.lake) p.flows = this.flowsOf(p, h);
      return p;
    }
    // two lobate flows out of a lava lake: direction, length 2–5 R, width 0.3 R
    flowsOf(p, h) {
      const out = [];
      for (let k = 0; k < 2; k++) {
        const a = ((h >>> (k * 8)) % 628) / 100, L = p.R * (2 + 3 * (((h >>> (k * 5 + 3)) % 100) / 100));
        out.push({ c: Math.cos(a), s: Math.sin(a), L, w: p.R * 0.32, ph: (h >>> 11) % 100 });
      }
      return out;
    }
    mountain(i, j) {
      const P = this.prof.mountains, s = this.s, C = P.cell;
      if (M.hashf2(i, j, s + 301) >= P.p) return null;
      const x = (i + 0.2 + 0.6 * M.hashf2(i, j, s + 302)) * C, z = (j + 0.2 + 0.6 * M.hashf2(i, j, s + 303)) * C;
      if (x * x + z * z < 1800 * 1800) return null;
      const r = P.r[0] + (P.r[1] - P.r[0]) * M.hashf2(i, j, s + 304), hgt = P.h[0] + (P.h[1] - P.h[0]) * M.hashf2(i, j, s + 305);
      const a = M.hashf2(i, j, s + 306) * TAU;
      return { x, z, r, h: hgt, ph1: M.hashf2(i, j, s + 307) * TAU, ph2: M.hashf2(i, j, s + 308) * TAU, tx: Math.cos(a), tz: Math.sin(a) };
    }
    featsBox(x0, z0, x1, z1) {
      const P = this.prof, f = { pat: [], mtn: [], vent: [] }, c = [];
      this.cellsIn(P.paterae.cell, P.paterae.D[1] * 3, x0, z0, x1, z1, c);
      for (let k = 0; k < c.length; k += 2) {
        const p = this.patera(c[k], c[k + 1]); if (!p) continue;
        const reach = p.lake ? Math.max(p.R * 1.2, ...p.flows.map(q => q.L + q.w)) : p.R * 1.2;
        if (p.x + reach < x0 || p.x - reach > x1 || p.z + reach < z0 || p.z - reach > z1) continue;
        f.pat.push(p);
      }
      const G = this.glut, gr = Math.max(G.R * 1.2, ...G.flows.map(q => q.L + q.w));
      if (!(G.x + gr < x0 || G.x - gr > x1 || G.z + gr < z0 || G.z - gr > z1)) f.pat.push(G);
      c.length = 0; this.cellsIn(P.mountains.cell, P.mountains.r[1] * 1.5, x0, z0, x1, z1, c);
      for (let k = 0; k < c.length; k += 2) { const m = this.mountain(c[k], c[k + 1]); if (m && !(m.x + m.r * 1.5 < x0 || m.x - m.r * 1.5 > x1 || m.z + m.r * 1.5 < z0 || m.z - m.r * 1.5 > z1)) f.mtn.push(m); }
      const L = this.landMtn; if (!(L.x + L.r * 1.5 < x0 || L.x - L.r * 1.5 > x1 || L.z + L.r * 1.5 < z0 || L.z - L.r * 1.5 > z1)) f.mtn.push(L);
      for (const v of this.ventList || []) if (!(v.x + v.ring * 1.3 < x0 || v.x - v.ring * 1.3 > x1 || v.z + v.ring * 1.3 < z0 || v.z - v.ring * 1.3 > z1)) f.vent.push(v);
      return f;
    }
    // one column: o = {h, bio, lava, crust, floor, wall, flow, head, mtn, mtnTop, ring, frost, vent}
    col(x, z, o, F) {
      const P = this.prof;
      let h = this.level + this.nBase.n2(x, z) * 4 + this.nFine.n2(x, z) * 0.7;
      o.lava = 0; o.crust = 0; o.floor = 0; o.wall = 0; o.flow = 0; o.head = 0; o.mtn = 0; o.mtnTop = 0; o.ring = 0; o.frost = 0; o.vent = 0; o.rock = 0;
      o.bio = 'zinn_plains';
      // the mountain blocks: a lobed outline, steep flanks (gullied), a tilted, ridged top; the world top caps them
      for (const m of F.mtn) {
        const dx = x - m.x, dz = z - m.z, r = Math.sqrt(dx * dx + dz * dz);
        if (r > m.r * 1.5) continue;
        const th = Math.atan2(dz, dx), rad = m.r * (1 + 0.22 * Math.sin(3 * th + m.ph1) + 0.12 * Math.sin(5 * th + m.ph2) + 0.05 * this.nEdge.n2(x, z));
        const q = r / rad + 0.05 * this.nRidge.n2(z, x);
        if (q >= 1.12) continue;
        const tilt = 0.78 + 0.22 * (dx * m.tx + dz * m.tz) / m.r, top = m.h * tilt + 12 * (this.nRidge.ridged2(x, z) - 0.5);
        const k = ss(1.12, 0.74, q), talus = ss(1.12, 0.98, q) * 0.12;   // (the talus apron at the foot)
        const add = top * Math.max(k * k * (3 - 2 * k) * 0.92 + 0.08 * k, talus);
        if (add > 0.5) { h = Math.max(h, this.level + add); o.mtn = 1; o.mtnTop = q < 0.74 ? 1 : 0; o.bio = 'zinn_mountains'; }
      }
      // the paterae: steep walls round a flat floor, a low lip; a lake's lava up to the floor with crust plates
      for (const p of F.pat) {
        const dx = x - p.x, dz = z - p.z, r = Math.sqrt(dx * dx + dz * dz);
        if (r < p.R * 1.25) {
          const q = r / p.R * (1 + 0.05 * this.nEdge.n2(x * 0.7, z * 0.7));
          const drop = p.depth * (1 - ss(0.86, 1.0, q)), lip = 2.2 * Math.exp(-((q - 1.06) / 0.08) * ((q - 1.06) / 0.08));
          h += lip - drop;
          if (q < 1.0) { o.bio = 'zinn_patera'; if (q > 0.86) o.wall = 1; else o.floor = 1; }
          if (p.lake && q < 0.84) {
            o.lava = 1; o.bio = 'zinn_lava';
            // the crust: plates of ~7 m drifting on the lake (a Voronoi of hashed cells), glowing cracks between them,
            // the shore a crust rim; the middle more open
            const C = 7, ci = Math.floor(x / C), cj = Math.floor(z / C);
            let d1 = 1e9, d2 = 1e9;
            for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const px = (ci + a + M.hashf2(ci + a, cj + b, this.s + 401)) * C, pz = (cj + b + M.hashf2(ci + a, cj + b, this.s + 402)) * C, d = Math.hypot(x - px, z - pz); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
            const crustK = 0.35 + 0.55 * ss(0.45, 0.84, q);
            o.crust = (d2 - d1 > 1.1 && M.hashf2(ci, cj, this.s + 403) < crustK) || q > 0.8 ? 1 : 0;
          }
        }
        // the flows: lobes 1.5 m thick, their heads molten here and there
        if (p.lake) for (const fl of p.flows) {
          const u = dx * fl.c + dz * fl.s, v = -dx * fl.s + dz * fl.c;
          if (u < p.R * 0.8 || u > fl.L) continue;
          const t = (u - p.R * 0.8) / (fl.L - p.R * 0.8), w = fl.w * (0.55 + 0.45 * Math.sin(u / 23 + fl.ph)) * (1 - 0.45 * t) + 4 * this.nEdge.n2(x, z);
          if (Math.abs(v + 9 * Math.sin(u / 41 + fl.ph)) < w) { h += 1.5 * ss(fl.L, fl.L - 12, u); o.flow = 1; if (t > 0.86) o.head = 1; }
        }
      }
      // the vents: a low cone with a pit, a white SO₂ halo inside, a red ring at the plume's fall-out radius
      for (const v of F.vent) {
        const r = Math.hypot(x - v.x, z - v.z);
        if (r < 70) { h += 8 * (1 - r / 70) - (r < 6 ? 6 * (1 - r / 6) : 0); o.vent = r < 6 ? 2 : 1; }
        const q = r / v.ring + 0.08 * this.nCol2.n2(x, z);
        if (q > 0.72 && q < 1.0) o.ring = 1; else if (q < 0.72 && r >= 70) o.frost = 1;
      }
      o.h = Math.min(250, h);
      return o;
    }
    // the plains: four colours by a slow field, patches at 160 m, a speckle — u-moons3 (bgen 2): six, brighter and more
    // varied — white SO₂ frost, yellow sulfur, the yellow-green of fresh sulfur, orange, red, and dark silicate spots
    // (Io's plains: the frost bright, the sulfur in every shade from its quench, the dark spots warm lava under crust)
    plainsBlock(x, z, o, hp) {
      const T = S(), OR = T.redSand, v = this.nCol.n2(x, z) + 0.12 * this.nCol2.n2(x, z) + (hp - 0.5) * 0.05;
      if (this.bgen < 2) return v > 0.3 ? T.frost : v > -0.08 ? T.sulfur : v > -0.22 ? T.orange : T.sulfurRed;
      const w = this.nCol2.n2(z * 1.7 + 311, x * 1.7) + (hp - 0.5) * 0.1;   // (a second field across the first: patches inside the zones)
      if (v > 0.26) return w > 0.35 ? T.sulfur : T.frost;
      if (v > 0.02) return w > 0.3 ? T.frost : w < -0.32 ? T.fuming : T.sulfur;
      if (v > -0.16) return w > 0.25 ? T.sulfur : w < -0.38 ? T.sulfurRed : OR;
      return w > 0.4 ? T.basalt : w > 0.1 ? OR : T.sulfurRed;
    }
    fill(blocks, col, top, o, slope, hp, x, z, T) {
      let surf, sub = T.tuff, deep = T.basalt, n = 3;
      const OR = this.bgen >= 2 ? T.redSand : T.orange;   // (u-moons3: bgen 2's orange a natural sand, not the tiles of orange terracotta)
      if (o.lava) surf = o.crust ? (hp < 0.6 ? T.obsidian : T.basalt) : T.lava;
      else if (o.vent === 2) surf = T.obsidian;
      else if (o.vent) surf = hp < 0.5 ? T.basalt : T.fuming;
      else if (o.floor) surf = hp < 0.55 ? T.obsidian : (hp < 0.8 ? T.basalt : T.sulfurRed);
      else if (o.wall) surf = slope > 0.9 ? T.basalt : (hp < 0.5 ? T.sulfurRed : OR);
      else if (o.flow) surf = o.head && hp < 0.3 ? T.lava : (hp < 0.6 ? T.basalt : T.obsidian);
      else if (o.mtn) { surf = slope > 1.1 ? (hp < 0.5 ? T.basalt : T.tuff) : o.mtnTop ? (hp < 0.75 ? T.frost : T.sulfur) : T.sulfur; sub = T.tuff; }
      else if (o.ring) surf = hp < 0.85 ? T.sulfurRed : OR;
      else if (o.frost) surf = hp < 0.8 ? T.frost : T.sulfur;
      else {
        surf = this.plainsBlock(x, z, o, hp);
        sub = T.sulfur;
      }
      for (let y = 1; y <= top; y++) { const d = top - y; blocks[(y << 8) | col] = d === 0 ? surf : d < n ? sub : y < 40 ? deep : (o.mtn ? T.tuff : deep); }
      // (a lava lake: two more blocks of lava under the open melt, so the glow has depth)
      if (o.lava && !o.crust) for (let y = top - 1; y >= top - 2 && y > 0; y--) blocks[(y << 8) | col] = T.lava;
    }
  }

  // ================================================================ Ocker — dust
  class Dust extends Kind2 {
    init() {
      const F = VR.Fractal, s = this.s, P = this.prof;
      this.nBase = new F(s ^ 0x201, 3, 1 / 1100, 0.5); this.nFine = new F(s ^ 0x202, 2, 1 / 70, 0.5);
      this.nDune = new F(s ^ 0x203, 2, 1 / 1600, 0.5); this.nGul = new F(s ^ 0x204, 3, 1 / 90, 0.5);
      this.nStr = new F(s ^ 0x205, 2, 1 / 400, 0.5); this.nPatch = new F(s ^ 0x206, 2, 1 / 24, 0.5);
      this.nEdge = new F(s ^ 0x207, 2, 1 / 55, 0.5);
      const W = P.dunes.wind; this.wind = { c: Math.cos(W), s: Math.sin(W) };
      this.look = { x: 0, z: 400 };   // (toward the canyon's rim, south)
      // u-moons3 (bgen 2): the ground butterscotch (ocker_dust) with rust (red sand) and umber (terracotta) patches; the
      // landing on the Rostschlucht's floor before its north wall, the eye lifted to the layered rock
      this.nRust = new F(s ^ 0x208, 2, 1 / 260, 0.5);
      { const zc = this.canyonZ(0), hw = this.canyonHalf(0); this.land = { x: 0, z: Math.round(zc - 0.6 * hw), look: { x: 0, z: -2000 }, pitch: 0.28 }; }
    }
    // the canyon's centre line and half width at x
    canyonZ(x) { const C = this.prof.canyon; return C.z0 + 120 * Math.sin(x / 1500 + 0.4) + 40 * Math.sin(x / 430 + 1.1); }
    canyonHalf(x) { return this.prof.canyon.half * (1 + 0.2 * Math.sin(x / 2300 + 2.0)); }
    // the drop into the canyon at (x, z): a flat floor (62 % of the width), walls with two benches, gullies (noise on q)
    canyonDrop(x, z, o) {
      const C = this.prof.canyon, zc = this.canyonZ(x), hw = this.canyonHalf(x), d = Math.abs(z - zc);
      if (d > hw * 1.1) return 0;
      const q = d / hw + 0.05 * this.nGul.n2(x, z) + 0.03 * this.nGul.n2(z * 3, x * 3);
      if (q >= 1) return 0;
      let f;
      if (q < 0.62) f = 1;
      else {
        const u = (q - 0.62) / 0.38;   // 0 at the floor's edge … 1 at the rim (the wall ~270 m across, its cliffs steep)
        // the wall: a talus slope (0 … 0.3), a cliff, a bench at ⅓, a cliff, a bench at ⅔, the rim's cliff
        const steps = [[0, 1], [0.3, 0.82], [0.42, 0.6], [0.55, 0.56], [0.68, 0.3], [0.8, 0.26], [0.92, 0.04], [1, 0]];
        let k = 0; while (k < steps.length - 2 && u > steps[k + 1][0]) k++;
        const [u0, f0] = steps[k], [u1, f1] = steps[k + 1], t = (u - u0) / (u1 - u0);
        f = f0 + (f1 - f0) * (f0 - f1 > 0.1 ? t * t * (3 - 2 * t) : t);
        o.wall = f > 0.05 && f < 0.95 ? 1 : 0;
      }
      o.canyon = 1;
      return C.depth * f;
    }
    // the shield: a basal scarp, gentle flanks, the summit's caldera; soft-capped under the world top (a stated compression)
    shieldAdd(x, z, o) {
      const S = this.prof.shield, r = Math.hypot(x - S.x, z - S.z);
      if (r > S.R * 1.02) return 0;
      const q = r / S.R + 0.01 * this.nEdge.n2(x, z);
      let a;
      if (q > 0.92) a = S.scarp * ss(1.0, 0.94, q);
      else a = S.scarp + (S.h - S.scarp) * Math.pow(ss(0.92, 0.0, q), 0.85);
      o.shield = 1;
      return a;
    }
    // a barchan of cell (i, j): a crescent whose horns point downwind
    dune(i, j) {
      const P = this.prof.dunes, s = this.s, C = P.cell;
      if (M.hashf2(i, j, s + 501) > 0.62) return null;
      const L = P.L[0] + (P.L[1] - P.L[0]) * M.hashf2(i, j, s + 502);
      return { x: (i + 0.2 + 0.6 * M.hashf2(i, j, s + 503)) * C, z: (j + 0.2 + 0.6 * M.hashf2(i, j, s + 504)) * C, R: L / 2, H: L * P.hk };
    }
    duneH(d, x, z) {
      const dx = x - d.x, dz = z - d.z, u = dx * this.wind.c + dz * this.wind.s, v = -dx * this.wind.s + dz * this.wind.c, R = d.R;
      const q1 = (u * u * 1.6 + v * v) / (R * R);   // (the body: an ellipse, shorter along the wind)
      if (q1 >= 1) return 0;
      // the slip face's hollow: a circle downwind; the crest along its rim, the horns where it cuts the body
      const hu = u - 0.42 * R, q2 = (hu * hu + v * v) / (0.82 * R * 0.82 * R);
      const crest = 1 - 0.75 * Math.min(1, Math.abs(v) / R);
      let h = d.H * Math.pow(1 - q1, 0.6) * crest;
      if (q2 < 1) h *= ss(0.55, 1.0, q2);   // (the slip face: a steep fall into the hollow)
      return h;
    }
    // the dust devils' tracks: per cell 2–3 wandering lines (a few hundred metres), 5–12 m wide
    tracksAt(x, z, F) {
      for (const t of F.trk) {
        const dx = x - t.x, dz = z - t.z, u = dx * t.c + dz * t.s;
        if (u < 0 || u > t.L) continue;
        const v = -dx * t.s + dz * t.c, cv = t.A * Math.sin(u / t.l1 + t.p1) + t.A * 0.5 * Math.sin(u / t.l2 + t.p2);
        if (Math.abs(v - cv) < t.w * (0.6 + 0.4 * Math.sin(u / 9 + t.p2))) return 1;
      }
      return 0;
    }
    mesa(i, j) {
      const P = this.prof.mesas, s = this.s, C = P.cell;
      if (M.hashf2(i, j, s + 601) >= P.p) return null;
      const x = (i + 0.2 + 0.6 * M.hashf2(i, j, s + 602)) * C, z = (j + 0.2 + 0.6 * M.hashf2(i, j, s + 603)) * C;
      if (x * x + z * z < 450 * 450) return null;
      return { x, z, r: P.r[0] + (P.r[1] - P.r[0]) * M.hashf2(i, j, s + 604), h: P.h[0] + (P.h[1] - P.h[0]) * M.hashf2(i, j, s + 605), ph1: M.hashf2(i, j, s + 606) * TAU, ph2: M.hashf2(i, j, s + 607) * TAU };
    }
    featsBox(x0, z0, x1, z1) {
      const P = this.prof, f = { dun: [], mes: [], trk: [], cr: null }, c = [];
      this.cellsIn(P.dunes.cell, P.dunes.L[1], x0, z0, x1, z1, c);
      for (let k = 0; k < c.length; k += 2) { const d = this.dune(c[k], c[k + 1]); if (d && !(d.x + d.R < x0 || d.x - d.R > x1 || d.z + d.R < z0 || d.z - d.R > z1)) f.dun.push(d); }
      c.length = 0; this.cellsIn(P.mesas.cell, P.mesas.r[1] * 1.6, x0, z0, x1, z1, c);
      for (let k = 0; k < c.length; k += 2) { const m = this.mesa(c[k], c[k + 1]); if (m && !(m.x + m.r * 1.6 < x0 || m.x - m.r * 1.6 > x1 || m.z + m.r * 1.6 < z0 || m.z - m.r * 1.6 > z1)) f.mes.push(m); }
      const T = P.devils.tracks; c.length = 0; this.cellsIn(T.cell, 1000, x0, z0, x1, z1, c);
      for (let k = 0; k < c.length; k += 2) {
        const i = c[k], j = c[k + 1], n = M.hash2(i, j, this.s + 701) % 3;
        for (let m = 0; m < n; m++) {
          const hh = M.hash3(i, j, m, this.s + 702), a = (hh % 628) / 100, L = 300 + (hh >>> 10) % 600;
          const t = { x: (i + M.hashf3(i, j, m, this.s + 703)) * T.cell, z: (j + M.hashf3(i, j, m, this.s + 704)) * T.cell, c: Math.cos(a), s: Math.sin(a), L, A: 10 + (hh >>> 4) % 30, l1: 60 + (hh >>> 7) % 90, l2: 23 + (hh >>> 13) % 20, p1: (hh >>> 3) % 7, p2: (hh >>> 9) % 7, w: (T.w[0] + (T.w[1] - T.w[0]) * M.hashf3(i, j, m, this.s + 705)) / 2 };
          const ex = t.x + t.c * L, ez = t.z + t.s * L, pad = 50;
          if (Math.max(t.x, ex) + pad < x0 || Math.min(t.x, ex) - pad > x1 || Math.max(t.z, ez) + pad < z0 || Math.min(t.z, ez) - pad > z1) continue;
          f.trk.push(t);
        }
      }
      f.cr = this.cratersBox(x0, z0, x1, z1, false, false);
      return f;
    }
    col(x, z, o, F) {
      const P = this.prof;
      o.canyon = 0; o.wall = 0; o.shield = 0; o.dune = 0; o.mesa = 0; o.mesaWall = 0; o.track = 0; o.rock = 0; o.crater = 0; o.lava = 0;
      let h = this.level + this.nBase.n2(x, z) * 6 + this.nFine.n2(x, z) * 0.8;
      // the worn craters (the airless laws, softened: Ocker's air and dust filled and rounded them)
      let add = 0;
      for (const c of F.cr) {
        const dx = x - c.x, dz = z - c.z, r2 = dx * dx + dz * dz; if (r2 >= 9 * c.R * c.R) continue;
        const r = Math.sqrt(r2); add += B.craterHeight(c.shape, r, 0.55 + 0.45 * c.age, 0) * 0.8; if (r < c.R) o.crater = 1;
      }
      h += add;
      // the mesas: a lobed outline, a flat top, steep walls, a talus apron
      for (const m of F.mes) {
        const dx = x - m.x, dz = z - m.z, r = Math.sqrt(dx * dx + dz * dz); if (r > m.r * 1.6) continue;
        const th = Math.atan2(dz, dx), rad = m.r * (1 + 0.2 * Math.sin(2 * th + m.ph1) + 0.12 * Math.sin(5 * th + m.ph2) + 0.06 * this.nEdge.n2(x, z));
        const q = r / rad;
        if (q < 1) { h = Math.max(h, this.level + m.h + this.nFine.n2(z, x) * 0.6); o.mesa = 1; if (q > 0.97) o.mesaWall = 1; }
        else if (q < 1.4) { const a = m.h * 0.42 * Math.pow(1 - (q - 1) / 0.4, 1.6); if (this.level + a > h) { h = this.level + a; o.mesaWall = 1; } }
      }
      // the shield
      const sh = this.shieldAdd(x, z, o); if (sh > 0) h += sh;
      // the canyon (cut after everything that stands on the plain)
      const cd = this.canyonDrop(x, z, o); if (cd > 0) h = Math.max(8, h - cd);
      // the dunes (on the plain and on the canyon's floor; not on the walls, the mesas or the shield)
      if (!o.wall && !o.mesa && !o.mesaWall && !o.shield && this.nDune.n2(x, z) > (o.canyon ? -0.2 : 0.08)) {
        let dh = 0; for (const d of F.dun) dh = Math.max(dh, this.duneH(d, x, z));
        if (dh > 0.3) { h += dh; o.dune = 1; }
      }
      if (!o.dune && !o.wall && !o.mesa && !o.canyon && this.tracksAt(x, z, F)) o.track = 1;
      // the soft cap under the world top (the shield): above 210 the height approaches 250 and never reaches it
      if (h > 210) h = 210 + 40 * (1 - Math.exp(-(h - 210) / 40));
      o.rock = !o.dune && !o.wall && M.hashf2(Math.floor(x), Math.floor(z), this.s + 801) < 0.0025 ? 1 : 0;
      o.bio = o.canyon ? 'ocker_canyon' : o.shield ? 'ocker_shield' : o.mesa || o.mesaWall ? 'ocker_mesa' : o.dune ? 'ocker_dunes' : 'ocker_plains';
      o.h = h;
      return o;
    }
    fill(blocks, col, top, o, slope, hp, x, z, T) {
      const pn = this.nPatch.n2(x, z);
      let surf = T.redSand, dust = 2, dB = T.redSand;
      if (this.bgen >= 2) { const rn = this.nRust.n2(x, z) + 0.15 * pn; dB = surf = rn > 0.28 ? T.redSand : rn < -0.34 ? T.terracotta : T.dust; }
      if (o.dune) { surf = this.bgen >= 2 ? T.dust : T.redSand; dust = 4; if (this.bgen >= 2) dB = T.dust; }
      else if (o.wall || o.mesaWall || slope > 1.3) { surf = null; dust = 0; }
      else if (o.shield) { surf = slope > 0.5 || pn > 0.3 ? T.basalt : dB; dust = surf === T.basalt ? 0 : 1; }
      else if (o.canyon) { surf = pn > 0.35 ? T.gravel : dB; }
      else if (o.track) surf = T.coarse;
      else if (pn > 0.42) { surf = T.ochre; dust = 0; }
      else if (pn < -0.45) surf = T.gravel;
      for (let y = 1; y <= top; y++) {
        const d = top - y;
        let b;
        if (d < dust || (d === 0 && surf)) b = d === 0 && surf ? surf : dB;
        else if (o.shield && y > 150) b = T.basalt;
        else if (y < (this.bgen >= 2 ? 6 : 22)) b = T.basalt;   // (the canyon's floor rock; above it the layers — u-moons3, bgen 2: the talus at the wall's foot layered too, not dark basalt lumps)
        else {
          // the layers: red sandstone, terracotta, sandstone, ochre rock — bands of 3–7 m that wander slowly
          const v = (y + this.nStr.n2(x, z) * 6) / 5.3, band = ((Math.floor(v) % 4) + 4) % 4;
          b = band === 0 ? T.redSandstone : band === 1 ? T.terracotta : band === 2 ? T.sandstone : T.ochre;
        }
        blocks[(y << 8) | col] = b;
      }
      if (o.rock && top < 250) blocks[((top + 1) << 8) | col] = hp < 0.5 ? T.basalt : T.andesite;
    }
  }

  // ================================================================ Aquamarin — ocean
  class Ocean extends Kind2 {
    init() {
      const F = VR.Fractal, s = this.s, P = this.prof;
      this.nIsl = new F(s ^ 0x301, 4, 1 / P.islands.scale, 0.5); this.nArch = new F(s ^ 0x302, 2, 1 / 4200, 0.5);
      this.nFloor = new F(s ^ 0x303, 3, 1 / 700, 0.5); this.nFine = new F(s ^ 0x304, 2, 1 / 40, 0.5);
      this.nGap = new F(s ^ 0x305, 1, 1 / 120, 0.5); this.nRidge = new F(s ^ 0x306, 3, 1 / 160, 0.5);
      this.look = { x: P.landmark.x, z: P.landmark.z };
      this.sea = P.sea;
      // u-moons3 (bgen 2): the landing on a reef ring of its own in open sea (140 m across), its lagoon toward Herzwelt
      // (+z: the near side's Herzwelt stands 32° up there), the eye lifted to it
      if (this.bgen >= 2) { const Q = this.land2 = { x: 0, z: 72, R: 70, w: 16, ph: 3 }; this.land = { x: Q.x, z: Q.z - Q.R + 11, look: Q, pitch: 0.2 }; }   // (on the crest's inner beach, the water a few steps ahead, the far ring 130 m off, Herzwelt in the frame)
    }
    // the elevation field: its zero line is the coast (an island round the landing)
    elev(x, z) {
      const r = Math.hypot(x, z), L = this.prof.landmark, rl = Math.hypot(x - L.x, z - L.z);
      // (the landing's island; the landmark atoll in open sea, whatever the seed)
      const Q = this.land2;
      if (Q) { const rq = Math.hypot(x - Q.x, z - Q.z); return this.nArch.n2(x, z) * 0.55 + this.nIsl.n2(x, z) * 0.75 - this.prof.islands.thr * 0.62 - 0.6 * (1 - ss(L.R + 80, L.R + 320, rl)) - 0.7 * (1 - ss(Q.R + 60, Q.R + 260, rq)); }   // (bgen 2: the landing's ring in open sea)
      return this.nArch.n2(x, z) * 0.55 + this.nIsl.n2(x, z) * 0.75 - this.prof.islands.thr * 0.62 + 0.5 * (1 - ss(60, 300, r)) - 0.6 * (1 - ss(L.R + 80, L.R + 320, rl));
    }
    atoll(i, j) {
      const P = this.prof.atolls, s = this.s, C = P.cell;
      if (M.hashf2(i, j, s + 901) >= P.p) return null;
      const x = (i + 0.2 + 0.6 * M.hashf2(i, j, s + 902)) * C, z = (j + 0.2 + 0.6 * M.hashf2(i, j, s + 903)) * C;
      if (x * x + z * z < 700 * 700) return null;
      return { x, z, R: P.R[0] + (P.R[1] - P.R[0]) * M.hashf2(i, j, s + 904), w: 12 + 12 * M.hashf2(i, j, s + 905), ph: M.hashf2(i, j, s + 906) * 100 };
    }
    featsBox(x0, z0, x1, z1) {
      const P = this.prof, f = { at: [] }, c = [];
      this.cellsIn(P.atolls.cell, P.atolls.R[1] + 140, x0, z0, x1, z1, c);
      for (let k = 0; k < c.length; k += 2) { const a = this.atoll(c[k], c[k + 1]); if (a && !(a.x + a.R + 140 < x0 || a.x - a.R - 140 > x1 || a.z + a.R + 140 < z0 || a.z - a.R - 140 > z1)) f.at.push(a); }
      const L = P.landmark, A = this._lm || (this._lm = { x: L.x, z: L.z, R: L.R, w: 20, ph: 7 });
      if (!(A.x + A.R + 140 < x0 || A.x - A.R - 140 > x1 || A.z + A.R + 140 < z0 || A.z - A.R - 140 > z1)) f.at.push(A);
      const Q = this.land2;
      if (Q && !(Q.x + Q.R + 140 < x0 || Q.x - Q.R - 140 > x1 || Q.z + Q.R + 140 < z0 || Q.z - Q.R - 140 > z1)) f.at.push(Q);
      return f;
    }
    col(x, z, o, F) {
      const sea = this.sea;
      o.atoll = 0; o.lagoon = 0; o.stack = 0; o.cliff = 0; o.lava = 0; o.rock = 0;
      const e = this.elev(x, z);
      let h = e > 0 ? sea - 1.5 + e * 95 + (this.nRidge.ridged2(x, z) - 0.6) * 10 * ss(0.05, 0.25, e) : sea - 1.5 + e * 70;
      h = Math.max(h, sea - 30 + this.nFloor.n2(x, z) * 5);   // (the sea floor)
      h += this.nFine.n2(x, z) * 0.6;
      o.coast = e;
      // the atolls: the drowned crater's rim a ring island, the lagoon shallow inside, the outer slope down to the floor
      for (const a of F.at) {
        const r = Math.hypot(x - a.x, z - a.z); if (r > a.R + 140) continue;
        const d = (r - a.R) / a.w;
        let ha;
        if (this.bgen >= 2) {
          // u-moons3: a smooth reef ring — a sand crest 2.5–3 m over the sea all round, the beach down into the lagoon
          // over ~40 m (0.6–6 m deep), the outer slope a smooth fall to the floor; no passes cut through
          const dl = (r - (a.R - a.w)) / 40;   // (0 at the crest's inner foot, −1 forty metres into the lagoon)
          if (d < -1) ha = sea + 0.6 - 6.4 * ss(0, -1, dl) + this.nFine.n2(z, x) * 0.5 * ss(0, -1, dl);
          else if (d < 1) ha = sea + 0.6 + 2.3 * (1 - d * d) * (0.85 + 0.15 * this.nFine.n2(x, z));
          else ha = sea + 0.6 - 34.6 * ss(1, 1 + 120 / a.w, d);
        }
        else if (d < -1) ha = sea - 3 - 4 * ss(-1, -6, d) + this.nFine.n2(z, x) * 0.8;   // (the lagoon: 3–7 m)
        else if (d < 1) { const gap = this.nGap.n2(Math.atan2(z - a.z, x - a.x) * a.R, a.ph * 1000) > 0.38; ha = gap ? sea - 2 : sea + 0.6 + 2.6 * (1 - d * d) * (0.7 + 0.3 * this.nFine.n2(x, z)); }
        else ha = sea - 2 - (32) * ss(1, 1 + 120 / a.w, d);
        if (r < a.R + a.w) { h = e > 0.05 ? Math.max(h, ha) : ha; if (d < -1) o.lagoon = 1; else o.atoll = 1; }
        else if (ha > h) h = ha;
      }
      // the sea stacks: pillars of basalt in the shallows off a coast (4–10 m of water), 1.5–4.5 m wide, 6–22 m high
      if (e > -0.09 && e < -0.015) {
        const C = 34, ci = Math.floor(x / C), cj = Math.floor(z / C);
        if (M.hashf2(ci, cj, this.s + 951) < 0.22) {
          const px = (ci + 0.25 + 0.5 * M.hashf2(ci, cj, this.s + 952)) * C, pz = (cj + 0.25 + 0.5 * M.hashf2(ci, cj, this.s + 953)) * C, R = 1.5 + 3 * M.hashf2(ci, cj, this.s + 954);
          const r = Math.hypot(x - px, z - pz);
          if (r < R) { h = sea + 6 + 16 * M.hashf2(ci, cj, this.s + 955) - (r / R) * (r / R) * 3; o.stack = 1; }
        }
      }
      o.bio = o.lagoon ? 'aqua_lagoon' : o.atoll ? 'aqua_atoll' : h >= sea ? 'aqua_island' : 'aqua_sea';
      o.h = Math.min(250, h);
      return o;
    }
    fill(blocks, col, top, o, slope, hp, x, z, T) {
      const sea = this.sea;
      let surf, sub = T.sand, n = 3;
      if (o.stack) { surf = T.basalt; sub = T.basalt; }
      else if (o.atoll) { surf = hp < (this.bgen >= 2 ? 0.97 : 0.85) ? T.sand : T.gravel; }   // (u-moons3: bgen 2's beaches clean sand)
      else if (o.lagoon) { surf = hp < 0.9 ? T.sand : T.clay; }
      else if (top < sea - 6) { surf = hp < 0.6 ? T.sand : hp < 0.85 ? T.gravel : T.clay; }
      else if (slope > 1.0) { surf = T.basalt; sub = T.basalt; }
      else if (top <= sea + 2) surf = T.sand;
      else if (this.bgen >= 2) surf = slope > 0.55 ? (hp < 0.5 ? T.gravel : T.basalt) : (hp < 0.55 ? T.sand : hp < 0.85 ? T.coarse : T.gravel);   // (u-moons3: the islands' tops sand, soil and gravel — the clay's pale tiles read as a pavement)
      else surf = slope > 0.55 ? T.gravel : (hp < 0.75 ? T.clay : T.gravel);
      for (let y = 1; y <= top; y++) { const d = top - y; blocks[(y << 8) | col] = d === 0 ? surf : d < n ? sub : T.basalt; }
      for (let y = top + 1; y <= sea; y++) blocks[(y << 8) | col] = T.water;
    }
  }

  VR.BodyGenKinds = { volcanic: Volcanic, dust: Dust, ocean: Ocean };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
