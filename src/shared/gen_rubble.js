// ============================================================================
// u-fields · VR.Rubble, VR.RubbleGen — the Trümmerschwarm and its small bodies (plan
// docs/superpowers/plans/2026-10-30-u-fields.md §2; U§7.2–§7.3; REFERENCE §1.6–§1.7).
//   · VR.Rubble.swarm()  the swarm: a young collision family compressed 10⁵× (U§7.2) — 60 bodies of 40–600 m in a
//     30 × 30 × 6 km family (nearest neighbours 2–5 km), sizes on N(>D) ∝ D⁻², the shapes of the population (spinning
//     tops with a ridge, contact binaries ~1 in 7, potatoes), metal-rich ~1 in 8, no body over 200 m spinning faster
//     than 2.2 h (the spin barrier). The same for every save (a fixed seed: the swarm is a place on the star chart).
//   · VR.RubbleGen      a body as a world: the shape in a box round x = z = 0, air around, black sky. v1: ≤ 240 m tall,
//     the broad side up, gravity −y (the six-axis walk round a body is wave 7). Per column the shape gives one interval
//     [bottom, top] (the lobes of a binary are joined: they overlap in every column), boulders on top (the largest
//     10–20 % of D, R§1.7), shallow craters; mean slope 15–20°. Blocks: carbon_rubble (albedo ~0.04) with tuff and gravel
//     clasts, water-ice pockets inside a carbon body, iron ore and iron in a metal one; the ring's moonlet (rock.m) is
//     ice under a dusting of ring snow. Versioned by rgen (1).
//   · the dims rock.0 … rock.59 (the swarm) and rock.m (the moonlet in the ring's 5-km gap): u_dim 5, the anchor
//     boots' pull as their gravity (0.35 m/s², U§4.3; the body's own ~10⁻⁴ g in gReal — fields.js drifts the player
//     with it when the boots are off), no village life.
// Columns taller than 256 (bodies up to 600 m, U§7.3): world.js/storage.js keep `256·H` blocks, but the worker's
// generate → light → mesh path is written for 65,536 (worker_main.js: `new Uint16Array(65536)`, light_local.js and
// mesher.js index y < 256) — the plan's §6 lists what is missing.
// ============================================================================
(function (VR) {
  'use strict';
  const M = VR.M, TAU = Math.PI * 2;
  const RGEN = 2;   // u-fields2: 2 — angular boulders, regolith variety, ice at the surface, the ores (rgen 1 kept for old saves)
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  // a small seeded stream (mulberry32)
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // ---------------------------------------------------------------- the swarm (U§7.2)
  const SWARM_SEED = 0x7a5c41;
  let SW = null;
  function swarm() {
    if (SW) return SW;
    const r = rng(SWARM_SEED), out = [];
    // the three landmarks first: the arrival's big top, a contact binary, a metal potato
    const fixed = [{ D: 480, shape: 'top', metal: false }, { D: 360, shape: 'binary', metal: false }, { D: 260, shape: 'potato', metal: true }];
    let tries = 0;
    while (out.length < 60 && tries++ < 20000) {
      const k = out.length, f = fixed[k];
      // places: the landmarks near the family's centre, the rest spread through the 30 × 30 × 6 km family
      const sp = k < 3 ? 0.18 : 1;
      const p = [(r() * 2 - 1) * 15000 * sp, (r() * 2 - 1) * 3000 * sp, (r() * 2 - 1) * 15000 * sp];
      let ok = true;
      for (const b of out) if (Math.hypot(b.p[0] - p[0], b.p[1] - p[1], b.p[2] - p[2]) < 1200) { ok = false; break; }
      if (!ok) continue;
      const u = r();
      const D = f ? f.D : 40 * Math.pow(1 - u * (1 - Math.pow(40 / 600, 2)), -0.5);
      const us = r(), shape = f ? f.shape : us < 0.25 ? 'top' : us < 0.39 ? 'binary' : 'potato';
      const metal = f ? f.metal : r() < 0.125;
      const spinH = D > 200 ? 2.2 + r() * 10 : 0.08 + r() * 8;
      out.push({ k, id: 'rock.' + k, p: p.map(v => Math.round(v)), D: Math.round(D * 10) / 10, shape, metal, spinH: Math.round(spinH * 100) / 100, seed: (SWARM_SEED + k * 7919) >>> 0, axis: [r() * 2 - 1, r() * 2 - 1, r() * 2 - 1] });
    }
    SW = { bodies: out, field: 30000, compression: 1e5 };
    return SW;
  }
  // the ring's moonlet (U§7.1): 300 m of ice in the 5-km gap
  const MOONLET = { k: 'm', id: 'rock.m', D: 300, shape: 'potato', metal: false, ice: true, spinH: 14, seed: 0x3a0011 };
  function bodyOf(id) {
    if (id === 'rock.m') return MOONLET;
    const k = +String(id).slice(5);
    const S = swarm();
    return Number.isInteger(k) && S.bodies[k] ? S.bodies[k] : null;
  }

  // ---------------------------------------------------------------- states, biome
  let S_ = null;
  function S() {
    if (S_) return S_;
    const R = VR.R, s = (n) => (R.byName[n] ? R.S(n) : 0), G = VR.GEN.S();
    S_ = { air: 0, carbon: s('carbon_rubble') || s('gravel'), tuff: s('tuff'), gravel: G.gravel || s('gravel'), ice: s('ice'), packed: s('packed_ice'), blue: s('blue_ice'), snow: s('snow_block') || s('packed_ice'),
      ironOre: s('iron_ore'), iron: s('iron_block'), basalt: s('basalt'),
      nickel: s('nickel_iron') || s('iron_ore'), nodule: s('ice_nodule') || s('ice'), spar: s('glowspar') || s('carbon_rubble'), pond: s('regolith_dark') || s('gravel') };
    return S_;
  }
  if (VR.BIOMES && VR.BIOME && VR.BIOME.rubble_body === undefined) {
    const add = (key, name, col) => { const e = { id: VR.BIOMES.length, key, name, temp: 0.5, down: 0, grass: col, foliage: col, water: 0x3F76E4, sky: 0, fog: null, precip: 'none', moon: 'rock' }; VR.BIOMES.push(e); VR.BIOME[key] = e.id; };
    add('rubble_body', 'Rubble Body', 0x3a3632); add('rubble_ice', 'Ice Moonlet', 0xd8e2ea);
  }

  // ---------------------------------------------------------------- a body's world
  class RubbleGen {
    // opts: {shape, D, metal, ice, k} for a body not in the swarm (the tests); else from the dim id
    constructor(seed, id, opts) {
      opts = opts || {};
      const b = bodyOf(id) || {};
      this.id = id; this.rgen = opts.bgen && opts.bgen.rubble > 0 ? opts.bgen.rubble | 0 : RGEN; this.kind = 'rubble';
      this.shape = opts.shape || b.shape || 'potato';
      this.D = +(opts.D || b.D || 200);
      this.metal = !!(opts.metal !== undefined ? opts.metal : b.metal);
      this.ice = !!(opts.ice !== undefined ? opts.ice : b.ice);
      // the body's shape is the body's (the same in every save, like the swarm); the save's seed only shuffles clasts
      this.s = ((b.seed || 0x51ab) ^ ((opts.k || 0) * 2654435761)) >>> 0;
      this.seed = seed >>> 0;
      const r = rng(this.s), D = this.D, R = D / 2;
      this.R = R;
      // the vertical: relief on top (dome, ~0.1 D → slopes 15–20°), a keel below; ≤ 240 m with the boulders
      this.ht = Math.min(0.1 * D, 60); this.hb = Math.min(0.22 * D, 120);
      this.yMid = Math.round(12 + this.hb);
      // the footprint: lobes (centre x, z, radius a × b, turn)
      const turn = r() * TAU;
      if (this.shape === 'binary') this.lobes = [{ x: -0.38 * R, z: 0, a: 0.62 * R, b: 0.56 * R }, { x: 0.52 * R, z: 0.08 * R, a: 0.46 * R, b: 0.42 * R }];
      else if (this.shape === 'potato') this.lobes = [{ x: 0, z: 0, a: R, b: R * (0.62 + 0.14 * r()) }];
      else this.lobes = [{ x: 0, z: 0, a: R, b: R * 0.96 }];
      this.c = Math.cos(turn); this.sn = Math.sin(turn);
      const F = VR.Fractal;
      this.nLow = new F(this.s ^ 0x11, 2, 1 / Math.max(30, D * 0.35), 0.5);
      this.nMid = new F(this.s ^ 0x22, 2, 1 / 16, 0.5);
      this.nRim = new F(this.s ^ 0x33, 2, 1 / Math.max(20, D * 0.2), 0.5);
      // craters (shallow bowls on top), then boulders sitting on the surface they make
      this.craters = [];
      const nc = 3 + Math.floor(D / 90);
      for (let i = 0; i < nc; i++) { const a = r() * TAU, d = Math.sqrt(r()) * 0.7 * R, cd = D * (0.06 + 0.2 * Math.pow(r(), 2)); this.craters.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, r: cd / 2, depth: cd * 0.11 }); }
      this.boulders = [];
      const nb = 14 + Math.floor(D / 9);
      for (let i = 0, tries = 0; i < nb && tries < 400; i++, tries++) {
        const big = this.boulders.length === 0, a = r() * TAU, d = (big ? 0.15 + 0.35 * r() : Math.sqrt(r()) * 0.92) * R;
        const x = Math.cos(a) * d, z = Math.sin(a) * d;
        // the largest 10–20 % of D (R§1.7), the rest on a steep power law down to 1.5 m
        const rad = big ? D * (0.115 + 0.07 * r()) / 2 : Math.max(1.5, D * 0.045 * Math.pow(r(), 2.2));
        if (this.rho2(x, z) > (big ? 0.5 : 0.95)) { if (big) i--; continue; }
        const base = this.shapeTop(x, z);
        this.boulders.push({ x, z, r: rad, y: base + rad * 0.3, sq: 0.75 + 0.2 * r(), m: r() });
      }
      // ice pockets (carbon bodies: water ice; the moonlet: blue ice), metal veins (metal bodies)
      this.pockets = [];
      const np = this.ice ? 10 : this.metal ? 16 : 7;
      for (let i = 0; i < np; i++) { const a = r() * TAU, d = Math.sqrt(r()) * 0.7 * R, x = Math.cos(a) * d, z = Math.sin(a) * d; if (!this.inside(x, z)) continue; const top = this.shapeTop(x, z), bot = this.shapeBot(x, z); this.pockets.push({ x, z, y: bot + (top - bot) * (0.25 + 0.6 * r()), r: 3 + r() * Math.min(14, D * 0.05) }); }
      if (this.rgen >= 2) this.v2();
    }
  // u-fields2 (rgen 2): a second stream so rgen 1's draws stay as they were — the boulders' facets (half-spaces: a
  // boulder is angular, half buried), the surface's patches, the glowspar clusters
  v2() {
    const r = rng(this.s ^ 0x2b2b2b), F = VR.Fractal, R = this.R;
    for (const b of this.boulders) {
      const pl = [], n = 5 + Math.floor(r() * 3), a0 = r() * TAU, H = b.r * b.sq;
      // the top: a tilted face; the sides: steep faces round it
      const ta = r() * TAU, tt = 0.1 + 0.25 * r();
      pl.push([Math.cos(ta) * tt, Math.sin(ta) * tt, H * (0.75 + 0.2 * r())]);
      for (let i = 0; i < n; i++) { const a = a0 + i * TAU / n + (r() - 0.5) * 0.9, sl = 1.6 + 1.6 * r(); pl.push([Math.cos(a) * sl, Math.sin(a) * sl, H * (1.7 + 0.6 * r())]); }
      b.pl = pl; b.y2 = b.y - b.r * 0.42;
    }
    this.nPat = new F(this.s ^ 0x44, 2, 1 / 22, 0.5);
    this.spar = [];
    const ns = 3 + Math.floor(this.D / 120);
    for (let i = 0, tries = 0; i < ns && tries < 60; tries++) {
      // in crater floors first (the impacts dug them up), else anywhere on top
      const c = this.craters[i % this.craters.length], a = r() * TAU, d = Math.sqrt(r()) * (c && i < this.craters.length ? c.r * 0.6 : 0.75 * R);
      const x = (c && i < this.craters.length ? c.x : 0) + Math.cos(a) * d, z = (c && i < this.craters.length ? c.z : 0) + Math.sin(a) * d;
      if (!this.inside(x, z)) continue;
      const top = this.shapeTop(x, z);
      this.spar.push({ x, z, y: top - (i === 0 ? 0.5 : 1 + 3 * r()), r: 1.6 + 1.6 * r() }); i++;
    }
  }
  // the crater a column lies in: 0 outside, d² (0 the floor's middle … 1 the rim)
  craterAt(x, z) { let best = 9; for (const c of this.craters) { const d2 = ((x - c.x) ** 2 + (z - c.z) ** 2) / (c.r * c.r); if (d2 < best) best = d2; } return best; }
    // the footprint's ρ² (0 at the centre, 1 at the rim) — the lobes' smallest
    rho2(x, z) {
      const u = x * this.c + z * this.sn, v = -x * this.sn + z * this.c;
      let best = 9;
      for (const L of this.lobes) { const du = (u - L.x) / L.a, dv = (v - L.z) / L.b, q = du * du + dv * dv; if (q < best) best = q; }
      // the rim wobbles a little (a rubble pile is never an ellipse)
      return best * (1 + 0.12 * this.nRim.n2(x, z));
    }
    inside(x, z) { return this.rho2(x, z) < 1; }
    // the lobe's own height scale (a binary's small lobe is lower)
    lobeK(x, z) {
      if (this.shape !== 'binary') return 1;
      const u = x * this.c + z * this.sn, v = -x * this.sn + z * this.c, L = this.lobes, q0 = ((u - L[0].x) / L[0].a) ** 2 + ((v - L[0].z) / L[0].b) ** 2, q1 = ((u - L[1].x) / L[1].a) ** 2 + ((v - L[1].z) / L[1].b) ** 2;
      const w0 = Math.max(0, 1 - q0), w1 = Math.max(0, 1 - q1);
      return (w0 * 1 + w1 * 0.78) / Math.max(1e-6, w0 + w1);
    }
    // the shape's top and bottom (no boulders), heights in blocks
    shapeTop(x, z) {
      const q = this.rho2(x, z); if (q >= 1) return -1;
      const k = this.lobeK(x, z), w = 1 - q;
      let h = this.ht * k * Math.pow(w, 0.9) * (this.shape === 'binary' ? 0.45 : this.shape === 'potato' ? 0.4 : 0.8);
      if (this.shape === 'top') h += this.D * 0.022 * Math.exp(-(((Math.sqrt(q) - 0.86) / 0.08) ** 2));   // the equatorial ridge, seen from the pole: a low rim
      // the rim rounds over (a rubble pile's edge is a slope, not a blade)
      h += -this.hb * 0.35 * (1 - Math.pow(w, 0.25)) * 0.5;
      h += this.nLow.n2(x, z) * this.D * 0.016 * Math.pow(w, 0.3) + this.nMid.n2(x, z) * 0.3;
      for (const c of this.craters) { const d2 = ((x - c.x) ** 2 + (z - c.z) ** 2) / (c.r * c.r); if (d2 < 1.6) h += d2 < 1 ? -c.depth * (1 - d2) : c.depth * 0.25 * (1.6 - d2) / 0.6; }
      return this.yMid + h;
    }
    shapeBot(x, z) {
      const q = this.rho2(x, z); if (q >= 1) return 999;
      return this.yMid - this.hb * this.lobeK(x, z) * Math.pow(1 - q, 0.6) - 1;
    }
    // the column: [bottom, top] as integers (top < 0: empty) and which boulder made the top
    column(x, z, o) {
      let top = this.shapeTop(x, z), bot = this.shapeBot(x, z), bb = null;
      for (const b of this.boulders) {
        const dx = x - b.x, dz = z - b.z, d2 = dx * dx + dz * dz;
        if (b.pl) {   // rgen 2: the faces' lowest
          if (d2 >= b.r * b.r * 2.2) continue;
          let h = 1e9; for (const p of b.pl) { const q = p[2] - dx * p[0] - dz * p[1]; if (q < h) h = q; }
          if (h <= 0) continue;
          const t = b.y2 + h;
          if (t > top) { if (top < 0) bot = b.y2 - h * 0.5; top = t; bb = b; }
          continue;
        }
        if (d2 >= b.r * b.r) continue;
        const h = Math.sqrt(b.r * b.r - d2) * b.sq * (0.82 + 0.36 * (0.5 + 0.5 * this.nMid.n2(x * 1.7 + b.m * 97, z * 1.7))), t = b.y + h;   // (lumpy: a boulder is no ball)
        if (t > top) { if (top < 0) bot = b.y - h; top = t; bb = b; }
      }
      o.topF = top; o.top = top < 0 ? -1 : Math.min(250, Math.floor(top)); o.bot = Math.max(2, Math.floor(bot)); o.b = bb;
      return o;
    }
    topF(x, z) { const o = this.column(x, z, this._o || (this._o = {})); return o.top < 0 ? -1 : o.topF; }
    surfaceY(x, z) { const o = this.column(x, z, this._o || (this._o = {})); return o.top; }
    bottomY(x, z) { const o = this.column(x, z, this._o || (this._o = {})); return o.top < 0 ? -1 : o.bot; }
    heightAt(x, z) { return this.surfaceY(Math.floor(x), Math.floor(z)); }
    climateAt(x, z) { const h = this.surfaceY(Math.floor(x), Math.floor(z)); return { bio: this.ice ? 'rubble_ice' : 'rubble_body', h, lava: false, water: false }; }
    biomeFor(cl) { const B = VR.BIOME; return B && B[cl.bio] !== undefined ? B[cl.bio] : 0; }
    biomeAt(x, z) { return this.biomeFor(this.climateAt(x, z)); }
    tints() { const g = VR.rgb565(60, 56, 52), w = VR.rgb565(30, 60, 90); return { grass: new Uint16Array(256).fill(g), foliage: new Uint16Array(256).fill(g), water: new Uint16Array(256).fill(w) }; }
    // the landing: a flat spot on top near the middle, looking over the body toward the largest boulder
    findSpawn() {
      const big = this.boulders[0] || { x: this.R, z: 0 };
      for (let rr = 0; rr < this.R * 0.8; rr += 3) for (let a = 0; a < (rr ? 12 : 1); a++) {
        const x = Math.round(Math.cos(a / 12 * TAU) * rr - big.x * 0.35), z = Math.round(Math.sin(a / 12 * TAU) * rr - big.z * 0.35);
        const h = this.surfaceY(x, z); if (h < 0) continue;
        let flat = true;
        for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) { const q = this.surfaceY(x + dx, z + dz); if (q < 0 || Math.abs(q - h) > 1) { flat = false; break; } }
        if (!flat) continue;
        return [x + 0.5, h + 1, z + 0.5, Math.atan2(-(big.x - x), -(big.z - z)), -0.12];
      }
      return [0.5, Math.max(this.surfaceY(0, 0), this.yMid) + 1, 0.5, 0];
    }
    // ---------------------------------------------------------------- a chunk
    generate(cx, cz) {
      const T = S(), blocks = new Uint16Array(65536), biome = new Uint8Array(256), x0 = cx * 16, z0 = cz * 16;
      const bid = this.biomeFor({ bio: this.ice ? 'rubble_ice' : 'rubble_body' });
      biome.fill(bid);
      const out = { blocks, biome, caveBiome: new Int8Array(256).fill(-1), tints: this.tints(), chests: [], spawns: [] };
      const R = this.R * 1.25 + 4;
      if (x0 > R || x0 + 16 < -R || z0 > R || z0 + 16 < -R) return out;
      // the pockets that reach into this chunk
      const P = this.pockets.filter(p => p.x + p.r > x0 && p.x - p.r < x0 + 16 && p.z + p.r > z0 && p.z - p.r < z0 + 16);
      const o = {}, s = this.s ^ this.seed, v2 = this.rgen >= 2;
      const SP = v2 ? this.spar.filter(p => p.x + p.r > x0 && p.x - p.r < x0 + 16 && p.z + p.r > z0 && p.z - p.r < z0 + 16) : null;
      for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
        const x = x0 + lx, z = z0 + lz;
        this.column(x, z, o); if (o.top < 0) continue;
        const col = lz * 16 + lx, h1 = M.hashf2(x, z, s + 3);
        const bm = o.b ? o.b.m : -1;
        for (let y = o.bot; y <= o.top; y++) {
          const d = o.top - y, hy = M.hashf3(x, y, z, s);
          let st;
          if (this.ice) st = d === 0 ? (h1 < 0.18 ? T.carbon : T.snow) : d < 3 ? T.packed : hy < 0.12 ? T.blue : T.packed;
          else {
            st = T.carbon;
            if (o.b && y > o.top - 2 * o.b.r) st = bm < 0.12 ? T.tuff : bm < 0.2 && this.metal ? T.iron : T.carbon;   // a boulder: carbon, a few pale (tuff), iron ones on metal bodies
            else if (d === 0) st = h1 < 0.02 ? T.gravel : h1 < 0.03 ? T.tuff : (this.metal && h1 > 0.9 ? T.ironOre : T.carbon);
            else if (hy < 0.05) st = T.tuff;
            else if (this.metal && hy > 0.86) st = hy > 0.97 ? T.iron : T.ironOre;
          }
          if (v2 && !this.ice) {
            // u-fields2: the ground less of a lump — pale patches (tuff, gravel), fine regolith ponds in the craters' floors,
            // ice breaking out in their walls; the ores: nickel-iron, ice nodules
            if (!o.b && d <= 1) {
              const pv = this.nPat.n2(x, z), cr = this.craterAt(x, z);
              if (cr < 0.45) st = d === 0 ? T.pond : T.carbon;
              else if (cr < 1.05 && pv < -0.25 && h1 < 0.5) st = T.ice;
              else if (pv > 0.42) st = h1 < 0.45 ? T.tuff : h1 < 0.7 ? T.gravel : T.carbon;
              else if (pv < -0.5 && h1 < 0.3) st = T.gravel;
            }
            if (d >= 1 && hy > (this.metal ? 0.94 : 0.999) && hy < (this.metal ? 0.97 : 1)) st = T.nickel;
            else if (!this.metal && d >= 1 && d < 10 && hy > 0.05 && hy < 0.058) st = T.nodule;
            else if (d === 0 && h1 > 0.995) st = this.metal ? T.nickel : T.nodule;
          }
          blocks[(y << 8) | col] = st;
        }
        // u-fields2: the glowspar clusters (rare; the first of a body breaks the surface)
        if (SP) for (const p of SP) {
          const dx = x - p.x, dz = z - p.z, d2 = p.r * p.r - dx * dx - dz * dz; if (d2 <= 0) continue;
          const hh = Math.sqrt(d2), ya = Math.max(o.bot + 1, Math.ceil(p.y - hh)), yb = Math.min(o.top, Math.floor(p.y + hh));
          for (let y = ya; y <= yb; y++) if (M.hashf3(x, y, z, s + 21) < 0.62) blocks[(y << 8) | col] = T.spar;
        }
        // pockets: water ice in a carbon body, blue ice in the moonlet, iron in a metal one (inside, never the skin)
        for (const p of P) {
          const dx = x - p.x, dz = z - p.z, d2 = p.r * p.r - dx * dx - dz * dz; if (d2 <= 0) continue;
          const hh = Math.sqrt(d2) * 0.7, ya = Math.max(o.bot + 1, Math.ceil(p.y - hh)), yb = Math.min(o.top - 2, Math.floor(p.y + hh));
          for (let y = ya; y <= yb; y++) blocks[(y << 8) | col] = this.metal ? T.iron : this.ice ? T.blue : (M.hashf3(x, y, z, s + 9) < 0.5 ? T.ice : T.packed);
        }
      }
      return out;
    }
  }
  VR.RubbleGen = RubbleGen;
  VR.BodyGenKinds = VR.BodyGenKinds || {};
  VR.BodyGenKinds.rubble = RubbleGen;   // (gen_body.js' family of kinds; a rock dim builds it directly)
  VR.Rubble = { RGEN, swarm, bodyOf, MOONLET, G_BOOTS: 0.35 };

  // ---------------------------------------------------------------- the dims (U§6.1: 'rock.<k>')
  if (VR.DimReg && !VR.DimReg.has('rock.0')) {
    const D = VR.DimReg, sw = swarm().bodies;
    // the body's own pull: g = G·ρ·(4/3)π·r with ρ 1,190 kg/m³ (Bennu, R§1.7) — r the body's real-size radius
    const gReal = (Dm) => 6.674e-11 * 1190 * 4 / 3 * Math.PI * (Dm / 2);
    const tag = (k) => 'TS-' + String(k + 1).padStart(2, '0');
    for (const b of sw) {
      D.add(b.id, { sky: true, code: 5, g: VR.Rubble.G_BOOTS, gReal: gReal(b.D), rock: true, travel: false, mp: 'convoy', gen: (seed, opts) => new RubbleGen(seed, b.id, opts),
        name: ['g.dim.rock.' + b.k, 'Brocken ' + tag(b.k), 'Rock ' + tag(b.k)], veil: ['#ecebe8', '#6e6a66', '#08080b'] });
    }
    D.add('rock.m', { sky: true, code: 5, g: VR.Rubble.G_BOOTS, gReal: gReal(300) * 0.5, rock: true, ring: true, travel: false, mp: 'convoy', gen: (seed, opts) => new RubbleGen(seed, 'rock.m', opts),
      name: ['g.dim.rock.m', 'Spaltmond', 'Gap Moon'], veil: ['#ffffff', '#d8e6f4', '#0c1424'] });
  }
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
