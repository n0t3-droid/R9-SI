// ============================================================================
// Far-terrain horizon, worker side. Cheap samples straight from the
// generator's climate + density functions (no chunk generation) become
// "mega-voxel" tiles: columns with top and side faces in real surface
// colours (grass tinted per biome, sand, snow caps, stone cliffs, badland
// bands), water / lava / aether surfaces, tree canopies, floating sky islands
// and the realm's giant glowing crystal spires.
// Tile = 32 x 32 cells; level L has cells of (4 << L) blocks.
// Vertex (12 bytes): int16 x,y,z (1/8 block, tile-relative xz) · u8 face|kind<<3
//                    · u8 aux (water depth / tint) · u8 r,g,b,shade
// kinds: 0 land 1 water 2 lava 3 aether 4 glow 5 leaves 6 ice/snow 7 window (lit at night)
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R, M = VR.M;
  const LOD = VR.LOD = {};
  let AVG = null;
  const cc = new Map();
  LOD.setAvg = (a) => { AVG = a; cc.clear(); };
  const hexc = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
  // a block with its own colour (B1 „🎨 Aussehen", T.rc): that colour; the cache follows the looks (VR.Looks.ver)
  let ccVer = 0;
  const looksSync = () => { const v = VR.Looks ? VR.Looks.ver | 0 : 0; if (v !== ccVer) { cc.clear(); ccVer = v; } };
  const rcCol = (s) => { const rc = R.T.rc ? R.T.rc[s] : 0; if (!rc || !VR.Looks) return null; const v = VR.Looks.from565(rc); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
  // average colour of a block face (sRGB 0..255) from the texture atlas, with a fallback
  function bcol(name, face, fb) {
    looksSync();
    const k = name + ':' + face;
    let c = cc.get(k); if (c) return c;
    c = hexc(fb);
    const t = R.byName[name], own = t ? rcCol(t.defaultState) : null;
    if (own) c = own;
    else if (AVG && t) {
      const layer = R.T.tex[t.defaultState * 6 + face] & 0xfff;
      if (AVG[layer * 4 + 3] > 0.05) c = [AVG[layer * 4] * 255, AVG[layer * 4 + 1] * 255, AVG[layer * 4 + 2] * 255];
    }
    cc.set(k, c); return c;
  }
  function scol(state, fb) {
    looksSync();
    const k = 's' + state;
    let c = cc.get(k); if (c) return c;
    c = hexc(fb);
    const own = state ? rcCol(state) : null;
    if (own) c = own;
    else if (AVG && state) { const layer = R.T.tex[state * 6 + 2] & 0xfff; if (AVG[layer * 4 + 3] > 0.05) c = [AVG[layer * 4] * 255, AVG[layer * 4 + 1] * 255, AVG[layer * 4 + 2] * 255]; }
    cc.set(k, c); return c;
  }
  const tint = (c, h, k) => [c[0] * ((h >> 16) & 255) / 255 * (k || 1), c[1] * ((h >> 8) & 255) / 255 * (k || 1), c[2] * (h & 255) / 255 * (k || 1)];
  const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const hh = (x, z, s) => (M.hash2(x, z, s) >>> 0) / 4294967296;

  // top-of-terrain height from the density column exactly like the generator's surfaceY at a sample point
  function surfTop(g, cl, X, Z) {
    const H = cl.H, A = cl.A;
    const hiY = H + A * 1.2 + 8, loY = H - A * 1.2 - 8;
    const dens = (i) => { const y = i * 8; if (y > hiY || y < loY) return H - y; return (H - y) + A * g.n3.n3(X, y * 1.15, Z); };
    let i = Math.min(31, Math.max(0, Math.floor(hiY / 8) + 1));
    let d1 = dens(i + 1);
    for (; i >= 0; i--) {
      const d0 = dens(i);
      if (d0 > 0 || d1 > 0) for (let y = i * 8 + 7; y >= i * 8; y--) { const f = (y & 7) / 8; if (d0 * (1 - f) + d1 * f > 0) return y; }
      d1 = d0;
    }
    return 0;
  }

  // trees: canopy cover and look per biome
  const TREES = {
    forest: [0.62, 'oak', 7], flower_forest: [0.3, 'oak', 7], birch_forest: [0.62, 'birch', 8], old_growth_birch_forest: [0.66, 'birch', 11], dark_forest: [0.85, 'dark_oak', 8], pale_garden: [0.7, 'pale_oak', 8],
    taiga: [0.6, 'spruce', 10], old_growth_pine_taiga: [0.7, 'spruce', 16], old_growth_spruce_taiga: [0.72, 'spruce', 18], snowy_taiga: [0.45, 'spruce', 9], grove: [0.4, 'spruce', 9],
    jungle: [0.85, 'jungle', 13], sparse_jungle: [0.35, 'jungle', 10], bamboo_jungle: [0.5, 'jungle', 9], savanna: [0.1, 'acacia', 7], savanna_plateau: [0.12, 'acacia', 7], windswept_savanna: [0.08, 'acacia', 7],
    plains: [0.012, 'oak', 6], sunflower_plains: [0.01, 'oak', 6], meadow: [0.012, 'oak', 6], cherry_grove: [0.3, 'cherry', 8], swamp: [0.18, 'oak', 7], mangrove_swamp: [0.5, 'mangrove', 9],
    wooded_badlands: [0.3, 'oak', 6], windswept_forest: [0.5, 'spruce', 9], windswept_hills: [0.05, 'oak', 6], dappled_forest: [0.66, 'poplar', 10], prism_fields: [0.1, 'cherry', 8], crystal_highlands: [0.06, 'cherry', 7],
  };
  const LEAF = { oak: ['oak_leaves', 'fol'], birch: ['birch_leaves', 0x80A755], dark_oak: ['dark_oak_leaves', 'fol'], pale_oak: ['pale_oak_leaves', 0], spruce: ['spruce_leaves', 0x619961], jungle: ['jungle_leaves', 'fol'], acacia: ['acacia_leaves', 'fol'], cherry: ['cherry_leaves', 0], mangrove: ['mangrove_leaves', 'fol'], poplar: ['orange_poplar_leaves', 0] };
  function leafCol(kind, B) {
    const L = LEAF[kind] || LEAF.oak;
    const c = bcol(L[0], 2, 0x5a8a3a);
    if (L[1] === 'fol') return tint(c, B.foliage, 1.05);
    if (L[1]) return tint(c, L[1], 1.05);
    return c;
  }


  // ---------------------------------------------------------------- villages seen from afar
  // The village's real plan (same deterministic generator the chunks use) is voxelised at
  // 1-block resolution: every home & workshop with its walls, windows, doors, roofs and
  // chimneys, the plaza well and the street lamps. Only faces that touch the open air
  // outside are kept (rooms are sealed, so furniture and inner walls cost nothing), then
  // greedy-merged. Cached per site: a village is meshed once per worker and reused by
  // every tile level that shows it.
  const VQ = new Map();
  const WIN_C = [0x86, 0x9c, 0xae];
  const FURN = /^vx_(bed|table|chair|bench|shelf|stove|counter|rug|lantern|floorlamp|crate|cargo|barrel|potplant|hay|sign|planter|windowbox|awning)|torch|carpet|flower|sapling|_bed$|grass$|fern|rail|button|pressure|lever|ladder/;
  function hexcA(h) { return [(h >> 16) & 255, (h >> 8) & 255, h & 255]; }
  // one small voxel grid per building: walls, windows, doors, roof, chimney, foundation
  function meshBuilding(bx, cells, pal, q) {
    const X0 = bx[0] - 1, Z0 = bx[2] - 1, Y0 = bx[1] - 9;
    const W = bx[3] - bx[0] + 3, D = bx[5] - bx[2] + 3, H = bx[4] - Y0 + 5;
    if (W <= 2 || D <= 2 || H <= 2 || W * D * H > 200000) return;
    const at = (x, y, z) => (y * D + z) * W + x;
    const grid = new Int16Array(W * H * D).fill(-1);
    for (let i = 0; i < cells.length; i += 4) {
      const x = cells[i] - X0, y = cells[i + 1] - Y0, z = cells[i + 2] - Z0;
      if (x < 0 || z < 0 || y < 0 || x >= W || z >= D || y >= H) continue;
      grid[at(x, y, z)] = cells[i + 3];
    }
    // foundations reach 4 blocks deeper so a house never floats over the coarse far terrain
    for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) for (let y = 4; y < H; y++) {
      const m = grid[at(x, y, z)]; if (m < 0) continue;
      if (pal[m].k === 0) for (let t = y - 4; t < y; t++) grid[at(x, t, z)] = m;
      break;
    }
    // air reachable from outside; rooms stay sealed so nothing inside is meshed
    const out = new Uint8Array(W * H * D), Q = new Int32Array(W * H * D);
    let qh = 0, qt = 0;
    const WD = W * D;
    const seed = (i) => { if (!out[i] && grid[i] < 0) { out[i] = 1; Q[qt++] = i; } };
    for (let y = 0; y < H; y++) { for (let x = 0; x < W; x++) { seed(at(x, y, 0)); seed(at(x, y, D - 1)); } for (let z = 0; z < D; z++) { seed(at(0, y, z)); seed(at(W - 1, y, z)); } }
    for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) seed(at(x, H - 1, z));
    while (qh < qt) {
      const i = Q[qh++], x = i % W, z = ((i / W) | 0) % D, y = (i / WD) | 0;
      if (x > 0) seed(i - 1); if (x < W - 1) seed(i + 1);
      if (z > 0) seed(i - W); if (z < D - 1) seed(i + W);
      if (y > 0) seed(i - WD); if (y < H - 1) seed(i + WD);
    }
    const isOpen = (x, y, z) => x < 0 || z < 0 || x >= W || z >= D || y >= H || (y >= 0 && out[at(x, y, z)] === 1);
    const mask = new Int16Array(Math.max(W, D) * Math.max(D, H) + W * H);
    const greedy = (A, B, emit) => {
      for (let b = 0; b < B; b++) for (let a = 0; a < A; a++) {
        const m = mask[b * A + a]; if (m < 0) continue;
        let w = 1; while (a + w < A && mask[b * A + a + w] === m) w++;
        let h = 1; grow: while (b + h < B) { for (let t = 0; t < w; t++) if (mask[(b + h) * A + a + t] !== m) break grow; h++; }
        for (let bb = 0; bb < h; bb++) mask.fill(-1, (b + bb) * A + a, (b + bb) * A + a + w);
        emit(a, b, w, h, m);
      }
    };
    const floorY = bx[1] + 1 - Y0; // bottoms below the floor are underground
    for (let y = 0; y < H; y++) for (let dir = 0; dir < 2; dir++) {
      const ny = dir === 0 ? y + 1 : y - 1;
      if (dir === 1 && y < floorY) continue;
      for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) { const m = grid[at(x, y, z)]; mask[z * W + x] = m >= 0 && isOpen(x, ny, z) ? m : -1; }
      const Y = Y0 + y + (dir === 0 ? 1 : 0), f = dir === 0 ? 2 : 3;
      greedy(W, D, (a, b, w, h, m) => q.push(f, m, X0 + a, Y, Z0 + b, X0 + a + w, Y, Z0 + b + h));
    }
    for (let x = 0; x < W; x++) for (let dir = 0; dir < 2; dir++) {
      const nx = dir === 0 ? x + 1 : x - 1;
      for (let y = 0; y < H; y++) for (let z = 0; z < D; z++) { const m = grid[at(x, y, z)]; mask[y * D + z] = m >= 0 && isOpen(nx, y, z) ? m : -1; }
      const X = X0 + x + (dir === 0 ? 1 : 0), f = dir === 0 ? 0 : 1;
      greedy(D, H, (a, b, w, h, m) => q.push(f, m, X, Y0 + b, Z0 + a, X, Y0 + b + h, Z0 + a + w));
    }
    for (let z = 0; z < D; z++) for (let dir = 0; dir < 2; dir++) {
      const nz = dir === 0 ? z + 1 : z - 1;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const m = grid[at(x, y, z)]; mask[y * W + x] = m >= 0 && isOpen(x, y, nz) ? m : -1; }
      const Z = Z0 + z + (dir === 0 ? 1 : 0), f = dir === 0 ? 4 : 5;
      greedy(W, H, (a, b, w, h, m) => q.push(f, m, X0 + a, Y0 + b, Z, X0 + a + w, Y0 + b + h, Z));
    }
  }
  function villageMesh(g, site) {
    let vm = VQ.get(site.id); if (vm) return vm;
    if (VQ.size > 28) VQ.delete(VQ.keys().next().value);
    const VG = VR.VillageGen, VX = VR.VX;
    // the town's plan: the chunks' (kept) or the horizon's own (g._vilLodPlans), released once the mesh is cached
    const plan = VG.plan(g, site, true);
    const RADp = (VG.siteRad ? VG.siteRad(g, site) : VG.rad(g)) + 3, W = RADp * 2 + 1, gx0 = site.x - RADp, gz0 = site.z - RADp;
    // which building owns each column (footprint incl. eaves & chimney); the plaza well is one more "building"
    const boxes = plan.homes.concat(plan.work).map(b => b.box).filter(Boolean);
    const pl = plan.plaza;
    if (pl) boxes.push([pl.x - 2, pl.y - 1, pl.z - 2, pl.x + 2, pl.y + 3, pl.z + 2]);
    const wellK = pl ? boxes.length : -1;
    const own = new Int16Array(W * W);
    boxes.forEach((bx, k) => { for (let z = bx[2]; z <= bx[5]; z++) for (let x = bx[0]; x <= bx[3]; x++) { const lx = x - gx0, lz = z - gz0; if (lx >= 0 && lz >= 0 && lx < W && lz < W) own[lz * W + lx] = k + 1; } });
    // materials: one per (colour, kind)
    const pal = [], pmap = new Map(), cmap = new Map();
    const matOf = (s) => {
      let m = pmap.get(s); if (m !== undefined) return m;
      m = -1;
      const t = R.types[R.T.type[s]], nm = t ? t.name : '';
      let c = null, k = 0;
      if (!t || FURN.test(nm) || /^vx_lamppost/.test(nm)) c = null;
      else if (/^vx_window_glow/.test(nm)) { c = hexcA(0x7ADFFF); k = 4; }
      else if (/^vx_window/.test(nm)) { c = WIN_C; k = 7; }
      else if (/^vx_crystal_(violet|azure|rose)/.test(nm)) { c = hexcA(VX.faceColor(s)); k = 4; }
      else if (/^vx_/.test(nm) && VX) c = hexcA(VX.faceColor(s));
      else if (t.o.solid !== false) c = scol(s, 0x8a6a40);
      if (c) {
        const r = Math.round(c[0]), gg = Math.round(c[1]), b = Math.round(c[2]), ck = ((r << 16) | (gg << 8) | b) * 8 + k;
        m = cmap.get(ck);
        if (m === undefined) { m = pal.length; pal.push({ c: [r, gg, b], k }); cmap.set(ck, m); }
      }
      pmap.set(s, m); return m;
    };
    // one pass over the plan's block ops (in order: later ops win inside each building grid)
    const cells = boxes.map(() => []);
    const lamps = [];
    for (const b of plan.chunks.values()) {
      const o = b.o;
      for (let i = 0; i < o.length; i += 4) {
        const x = o[i], y = o[i + 1], z = o[i + 2], s = o[i + 3];
        const lx = x - gx0, lz = z - gz0;
        if (lx < 0 || lz < 0 || lx >= W || lz >= W) continue;
        const k = own[lz * W + lx];
        if (k) { if (k === wellK && y < pl.y) continue; cells[k - 1].push(x, y, z, s ? matOf(s) : -1); continue; }
        if (s) { const t = R.types[R.T.type[s]]; if (t && /^vx_lamppost/.test(t.name)) lamps.push(x, y, z, t.get(s, 'head'), /crystal/.test(t.name) ? 1 : 0); }
      }
    }
    const q = [];
    boxes.forEach((bx, k) => { if (cells[k].length) meshBuilding(bx, cells[k], pal, q); });
    // street lamps: slim posts with a glowing head
    const post = pal.length; pal.push({ c: [58, 61, 68], k: 0 });
    const warm = pal.length; pal.push({ c: [255, 210, 122], k: 4 });
    const violet = pal.length; pal.push({ c: [192, 138, 255], k: 4 });
    for (let i = 0; i < lamps.length; i += 5) {
      const x = lamps[i], y = lamps[i + 1], z = lamps[i + 2], head = lamps[i + 3];
      if (head) q.push(-1, lamps[i + 4] ? violet : warm, x, y, z, 0, 0, 0);
      else q.push(-2, post, x, y, z, 0, 0, 0);
    }
    vm = { q: Int32Array.from(q), pal, n: q.length / 8 };
    VQ.set(site.id, vm);
    if (g._vilLodPlans) g._vilLodPlans.delete(site.id);
    return vm;
  }
  // village sites whose houses reach into [x0, x1) x [z0, z1)
  function villagesNear(g, x0, z0, x1, z1) {
    const VG = VR.VillageGen; if (!VG || g.singleBiome >= 0) return [];
    const C = VG.cell(g), pad = VG.rad(g) + 8, res = [];
    for (let j = Math.floor((z0 - pad) / C); j <= Math.floor((z1 + pad) / C); j++) for (let i = Math.floor((x0 - pad) / C); i <= Math.floor((x1 + pad) / C); i++) {
      const s = VG.site(g, i, j);
      if (s && s.x > x0 - pad && s.x < x1 + pad && s.z > z0 - pad && s.z < z1 + pad) res.push(s);
    }
    return res;
  }
  LOD.villageMesh = villageMesh;
  // (F-Far) the helpers ring 1 shares with the horizon tiles: colours from the atlas, the tree table, the hash
  const TRUNKS = { birch: ['birch_log', 0xd8d2c0], spruce: ['spruce_log', 0x3d2c1a], jungle: ['jungle_log', 0x584419], acacia: ['acacia_log', 0x676158], dark_oak: ['dark_oak_log', 0x3c2e1a], cherry: ['cherry_log', 0x4a2b2e], pale_oak: ['pale_oak_log', 0x8a8580], mangrove: ['mangrove_log', 0x5a3a2a], poplar: ['oak_log', 0x6b5033], oak: ['oak_log', 0x6b5033] };
  // the look of a block state seen from afar: { c: [r, g, b], k: kind } (k 0 solid, 4 glowing, 7 window), or null for
  // what does not show at a distance (furniture, plants, torches, rails); cached per state (follows the looks' version)
  const SLK = new Map(); let slkVer = -1;
  LOD.stateLook = function (s) {
    if (!s) return null;
    const v = (VR.Looks ? VR.Looks.ver | 0 : 0) * 1 + (AVG ? 1e6 : 0);
    if (v !== slkVer) { SLK.clear(); slkVer = v; }
    let r = SLK.get(s); if (r !== undefined) return r;
    const t = R.types[R.T.type[s]], nm = t ? t.name : '', VX = VR.VX;
    r = null;
    if (!t || FURN.test(nm) || /^vx_lamppost/.test(nm)) r = null;
    else if (/^vx_window_glow/.test(nm)) r = { c: hexcA(0x7ADFFF), k: 4 };
    else if (/^vx_window|glass|viewport/.test(nm)) r = { c: WIN_C, k: 7 };
    else if (/^vx_crystal_(violet|azure|rose)/.test(nm) && VX) r = { c: hexcA(VX.faceColor(s)), k: 4 };
    else if (/^vx_/.test(nm) && VX) r = { c: hexcA(VX.faceColor(s)), k: 0 };
    else if (t.o.solid !== false || (R.T.flags[s] & VR.F.LEAVES)) r = { c: scol(s, 0x8a6a40), k: (R.T.emit && R.T.emit[s]) ? 4 : 0 };
    // a texture the mesher colours by the biome or a fixed tint (grass tops, leaves): that colour here, the plains' or
    // the forest's for the biome ones (r.tint says which: a caller may prefer the land's own colour then)
    const tc = R.T.tint ? R.T.tint[s] : 0;
    if (r && tc) {
      const h = tc >= 8 ? R.tintColors[tc - 8] : (STATE_TINT[tc] || 0x7fbf55);
      r = { c: tint(r.c, typeof h === 'number' ? h : 0x7fbf55, 1.0), k: r.k, tint: tc };
    }
    SLK.set(s, r);
    return r;
  };
  const STATE_TINT = [0, 0x7fbf55, 0x5fa83a, 0x3f76e4, 0x80a755, 0x619961, 0xb38a55, 0x6fae3a];   // (grass, foliage, water as the plains; birch, spruce, dry as the mesher's fixed ones)
  LOD.util = { bcol, scol, tint, mixc, hh, leafCol, TREES, TRUNKS };
  // the site cells a tile's villages are looked up in (villagesNear's cells; the worker computes the cold ones first)
  LOD.tileCells = function (g, job) {
    const VG = VR.VillageGen; if (!VG || g.singleBiome >= 0 || job.level > 1) return [];
    const L = job.level, step = 4 << L, n = 32, T = n * step;
    const x0 = job.tx * n * step, z0 = job.tz * n * step, x1 = x0 + T, z1 = z0 + T;
    const C = VG.cell(g), pad = VG.rad(g) + 8, out = [];
    for (let j = Math.floor((z0 - pad) / C); j <= Math.floor((z1 + pad) / C); j++) for (let i = Math.floor((x0 - pad) / C); i <= Math.floor((x1 + pad) / C); i++) out.push([i, j]);
    return out;
  };
  // the town plans a tile needs that are not built yet (the worker builds them before the tile, see worker_main.js):
  // the villages whose plaza lies in the tile and whose mesh is not cached
  LOD.plansNeeded = function (g, job) {
    const VG = VR.VillageGen;
    if (!VG || !g.computeClimate || !g.n3 || job.level > 1) return [];
    const L = job.level, step = 4 << L, n = 32, T = n * step;
    const x0 = job.tx * n * step, z0 = job.tz * n * step;
    let vs = [];
    try { vs = villagesNear(g, x0, z0, x0 + T, z0 + T); } catch (e) { vs = []; }
    return vs.filter(st => st.x >= x0 && st.x < x0 + T && st.z >= z0 && st.z < z0 + T && !VQ.has(st.id) && !VG.planReady(g, st, true));
  };

  // ---------------------------------------------------------------- the surface look of a cell
  // The colours of the far land, from the texture atlas' averages (the same for every tile of a frame; F-Far's ring 1
  // shares them, so the two far rings and the near blocks agree).
  LOD.palette = function () {
    return {
      stone: bcol('stone', 2, 0x7d7d7d), dirt: bcol('dirt', 2, 0x8a5f3c), sand: bcol('sand', 2, 0xdbcf9f), gravel: bcol('gravel', 2, 0x837d7a),
      snow: bcol('snow_block', 2, 0xf4f8fb), redsand: bcol('red_sand', 2, 0xbe6621), sandstone: bcol('sandstone', 0, 0xd8c890),
      clay: bcol('clay', 2, 0xa0a6b3), ice: bcol('packed_ice', 2, 0x8db4e8), mud: bcol('mud', 2, 0x3c3837), myc: bcol('mycelium', 2, 0x6f6265),
      podzol: bcol('podzol', 2, 0x5b3d1e), coarse: bcol('coarse_dirt', 2, 0x77553b), calcite: bcol('calcite', 2, 0xdfe0dc), powder: bcol('powder_snow', 2, 0xf6fafc),
      grassTop: bcol('grass_block', 2, 0x9a9a9a), ochre: bcol('ochre_rock', 2, 0xb8743a), umber: bcol('umber_rock', 2, 0x6a4430), duskrock: bcol('duskrock', 2, 0x3a3450),
      terr: bcol('orange_terracotta', 2, 0xa0531e),
    };
  };
  // The surface of one cell (terrain top y at (X, Z), its climate cl and biome B with key, the steepest neighbour step per
  // block `slope`, the cell size `step`): o.t, o.s, o.cliff = top, side and cliff colours; o.kd = kind (0 land, 1 water,
  // 2 lava, 3 aether, 6 snow / ice); o.h = the top face's height; o.ax = aux (water depth and tint); o.water, o.cold.
  // Everything LOD.build decides for a cell before its trees — ring 1 (far.js) calls it for its own cells.
  LOD.look = function (g, P, B, key, cl, X, Z, y, slope, step, o) {
    const SEA = VR.C.SEA;
    const { stone, dirt, sand, gravel, snow, redsand, sandstone, clay, ice, mud, myc, podzol, coarse, calcite, powder, grassTop, ochre, umber, duskrock, terr } = P;
    const pn = g.patchN ? g.patchN.n2(X, Z) : 0;
    const cold = (B.temp - Math.max(0, y - 90) * 0.0025) < 0.15;
    let t = mixc(tint(grassTop, B.grass, 1.0), dirt, 0), s = mixc(dirt, t, 0.18), cliff = stone;
    let kd = 0, h = y + 1, ax = 0;
    const water = y < SEA;
    const ember = cl.ember > 0.45 || key === 'ember_canyons';
    if (water) {
      const deep = SEA - y > 6;
      t = deep ? (B.warm ? sand : gravel) : (pn > 0.25 ? clay : sand);
      s = t; cliff = deep ? gravel : sandstone;
      if (ember) { if (y < 59) { kd = 2; h = 60; t = [255, 120, 30]; } else { t = redsand; } }
      else if ((cl.prism > 0.35 || cl.ember > 0.35) && cl.river > 0.25) { kd = 3; h = SEA + 1; t = [70, 200, 255]; }
      else if (cold || B.frozen) { kd = 6; h = SEA + 1; t = ice; ax = 0; }
      else { kd = 1; h = SEA + 0.9; ax = Math.min(62, (SEA - y + 1) & ~1) | ((B.warm ? 1 : key.indexOf('swamp') >= 0 ? 3 : (key.indexOf('cold') >= 0 || key.indexOf('frozen') >= 0) ? 2 : 0) << 6); }
    } else if (key === 'desert' || key === 'beach' || key === 'snowy_beach') { t = sand; s = sand; cliff = sandstone; }
    else if (key === 'stony_shore') { t = pn > 0 ? stone : gravel; s = t; }
    else if (key.indexOf('badlands') >= 0) {
      const band = g.bands ? scol(g.bands[M.clamp(y + Math.round((g.stripN ? g.stripN.n3(X * 0.01, 0, Z * 0.01) : 0) * 7), 0, 255)], 0xa0531e) : terr;
      t = y < 80 ? redsand : band; s = terr; cliff = band;
      if (key === 'wooded_badlands' && y > 94) t = mixc(tint(grassTop, B.grass), coarse, 0.4);
    }
    else if (key === 'mushroom_fields') t = myc;
    else if (key === 'mangrove_swamp') { t = mud; s = mud; }
    else if (key === 'ice_spikes') { t = snow; s = snow; }
    else if (key === 'jagged_peaks' || key === 'frozen_peaks') { t = slope > 0.9 ? stone : (key === 'frozen_peaks' && pn > 0.2 ? ice : snow); s = stone; }
    else if (key === 'snowy_slopes' || key === 'grove') { t = slope > 0.9 ? stone : (pn > 0.3 ? powder : snow); if (key === 'grove' && pn < -0.2) t = tint(grassTop, B.grass); s = stone; }
    else if (key === 'stony_peaks') { t = (g.stripN && g.stripN.n3(X * 0.02, y * 0.2, Z * 0.02) > 0.2) ? calcite : stone; s = t; }
    else if (key === 'windswept_hills' || key === 'windswept_forest') { if (pn > 0.15) { t = stone; s = stone; } }
    else if (key === 'windswept_gravelly_hills') { if (pn > 0.1) { t = gravel; s = gravel; } else if (pn < -0.3) { t = stone; s = stone; } }
    else if (key === 'windswept_savanna') { if (pn > 0.2) { t = stone; s = stone; } else if (pn < -0.2) t = coarse; }
    else if (key === 'old_growth_pine_taiga' || key === 'old_growth_spruce_taiga') t = pn > 0.25 ? coarse : pn > -0.1 ? podzol : t;
    else if (key === 'dappled_forest') { if (pn > 0.15) t = coarse; }
    else if (ember) { const bandc = ((y + Math.round(hh(X >> 5, Z >> 5, 7) * 4)) % 5) < 2 ? umber : ochre; const capGreen = cl.hz1 > 0.4 && key === 'sky_meadow'; t = (y > 70 && cl.canyon < 0.25) ? (capGreen ? tint(grassTop, B.grass) : redsand) : bandc; s = bandc; cliff = bandc;
      if (y > 66 && cl.canyon < 0.3 && g.nCrack && step <= 8) { const cr = g.nCrack.n2(X, Z), cr2 = g.nCrack2.n2(X, Z), wdt = 0.028 + cl.ember * 0.02 + step * 0.004; if (Math.abs(cr) < wdt || Math.abs(cr2) < wdt * 0.6) { kd = 2; t = [255, 120, 30]; } } }
    else if (key === 'prism_fields' || key === 'crystal_highlands') { cliff = duskrock; s = mixc(duskrock, t, 0.3); }
    if (!water && t === t && slope > 1.25 && y > 95 && kd === 0 && key.indexOf('badlands') < 0 && !ember) { t = stone; s = stone; }
    const duskPeak = (cl.hz3 || 0) > 0.45;   // the Mountain Station's peaks are dark dusk-rock, never snow
    if (duskPeak) { t = duskrock; s = duskrock; cliff = duskrock; }
    if (!water && cold && kd === 0 && key !== 'stony_shore' && !duskPeak) { t = snow; s = mixc(s, snow, 0.5); kd = 6; }
    o.t = t; o.s = s; o.cliff = cliff; o.kd = kd; o.h = h; o.ax = ax; o.water = water; o.cold = cold;
    return o;
  };

  // ---------------------------------------------------------------- one tile
  LOD.build = function (g, job) {
    if (!g.computeClimate || !g.n3) return null;
    const BIOMES = VR.BIOMES, SEA = VR.C.SEA;
    const L = job.level, step = 4 << L, n = 32, N = n + 2;
    const x0 = job.tx * n * step, z0 = job.tz * n * step, T = n * step;
    const idx = (i, j) => (j + 1) * N + (i + 1);
    // villages (near & middle levels): their houses replace the trees on their ground
    let vsites = [];
    if (L <= 1) { try { vsites = villagesNear(g, x0, z0, x0 + T, z0 + T); } catch (e) { vsites = []; } }
    const VRAD = VR.VillageGen ? VR.VillageGen.rad(g) : 58;
    const inVil = (X, Z, pad) => { for (const s of vsites) if ((s.x - X) * (s.x - X) + (s.z - Z) * (s.z - Z) < (VRAD + pad) * (VRAD + pad)) return true; return false; };
    const Hs = new Int16Array(N * N), BIO = new Uint8Array(N * N), CL = new Array(N * N);
    for (let j = -1; j <= n; j++) for (let i = -1; i <= n; i++) {
      const X = x0 + i * step + (step >> 1), Z = z0 + j * step + (step >> 1);
      const cl = g.computeClimate(X, Z);
      const y = surfTop(g, cl, X, Z);
      const k = idx(i, j);
      Hs[k] = y; CL[k] = cl; BIO[k] = g.biomeFor(cl, y);
    }
    // ---- per-cell surface: height of the top face, kind, colours
    const top = new Float32Array(N * N), kind = new Uint8Array(N * N), aux = new Uint8Array(N * N);
    const trees = [];
    const cTop = new Array(N * N), cSide = new Array(N * N), cCliff = new Array(N * N);
    const P = LOD.palette(), lk = {};
    const { stone, dirt, snow, redsand, grassTop, ochre, duskrock } = P;   // (the islands below use them)
    for (let j = -1; j <= n; j++) for (let i = -1; i <= n; i++) {
      const k = idx(i, j), y = Hs[k], cl = CL[k], B = BIOMES[BIO[k]], key = B.key;
      const X = x0 + i * step + (step >> 1), Z = z0 + j * step + (step >> 1);
      let slope = 0;
      if (i > -1) slope = Math.max(slope, Math.abs(y - Hs[k - 1])); if (i < n) slope = Math.max(slope, Math.abs(y - Hs[k + 1]));
      if (j > -1) slope = Math.max(slope, Math.abs(y - Hs[k - N])); if (j < n) slope = Math.max(slope, Math.abs(y - Hs[k + N]));
      slope /= step;
      LOD.look(g, P, B, key, cl, X, Z, y, slope, step, lk);
      let t = lk.t, s = lk.s, kd = lk.kd, h = lk.h;
      const ax = lk.ax, cliff = lk.cliff, water = lk.water, cold = lk.cold;
      // trees: near levels get little voxel trees (trunk + canopy), far levels blend canopy colour & height into the cell
      const tr = TREES[key];
      if (!water && tr && kd !== 6 || (!water && tr && (key === 'snowy_taiga' || key === 'grove'))) {
        const cover = tr[0];
        if (step <= 8) {
          if (i >= 0 && j >= 0 && i < n && j < n && hh(X, Z, 91) < cover * (step === 4 ? 1 : 1.15) && !(vsites.length && inVil(X, Z, 4))) {
            const th = tr[2] * (0.75 + hh(X, Z, 92) * 0.5);
            let lc = leafCol(tr[1], B); if (cold) lc = mixc(lc, snow, 0.55);
            trees.push({ i, j, g: y + 1, th, lc, kind: tr[1], jx: (hh(X, Z, 93) - 0.5) * step * 0.3, jz: (hh(X, Z, 94) - 0.5) * step * 0.3 });
          }
        } else if (cover > 0.05 && !(vsites.length && inVil(X, Z, 0))) {
          const lc = leafCol(tr[1], B);
          t = mixc(t, lc, Math.min(1, cover * 1.1)); s = mixc(s, lc, cover * 0.6);
          h = y + 1 + cover * tr[2] * 0.7; if (cover > 0.4) kd = 5;
          if (cold) t = mixc(t, snow, 0.5);
        }
      }
      // far levels: terrace heights (2 / 4 blocks) — invisible at that distance, but many more faces merge
      if (L >= 2 && kd !== 1 && kd !== 2 && kd !== 3) { const q = L >= 3 ? 4 : 2; h = Math.round(h / q) * q; }
      top[k] = h; kind[k] = kd; aux[k] = ax; cTop[k] = t; cSide[k] = s; cCliff[k] = cliff;
    }
    // ---- mesh: vertices are written straight into their final 12-byte layout (growable typed buffers, no number arrays)
    let vcap = 16384, vbuf = new ArrayBuffer(vcap * 12), vi16 = new Int16Array(vbuf), vu8 = new Uint8Array(vbuf), nv = 0;
    let icap = 32768, I = new Uint32Array(icap), ni = 0;
    let minY = 1e9, maxY = -1e9, bx0 = 0, bz0 = 0, bx1 = T, bz1 = T;
    const push = (x, y, z, face, kd, ax, c, shade) => {
      if (nv === vcap) { vcap *= 2; const nb = new ArrayBuffer(vcap * 12); new Uint8Array(nb).set(vu8); vbuf = nb; vi16 = new Int16Array(vbuf); vu8 = new Uint8Array(vbuf); }
      const o6 = nv * 6, o12 = nv * 12;
      vi16[o6] = Math.round(x * 8); vi16[o6 + 1] = Math.round(y * 8); vi16[o6 + 2] = Math.round(z * 8);
      vu8[o12 + 6] = face | (kd << 3); vu8[o12 + 7] = ax;
      vu8[o12 + 8] = c[0] < 0 ? 0 : c[0] > 255 ? 255 : c[0]; vu8[o12 + 9] = c[1] < 0 ? 0 : c[1] > 255 ? 255 : c[1]; vu8[o12 + 10] = c[2] < 0 ? 0 : c[2] > 255 ? 255 : c[2]; vu8[o12 + 11] = shade;
      nv++;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (z < bz0) bz0 = z; if (z > bz1) bz1 = z;
    };
    const quad = (p0, p1, p2, p3, face, kd, ax, c, shade) => {
      const b = nv;
      push(p0[0], p0[1], p0[2], face, kd, ax, c, shade); push(p1[0], p1[1], p1[2], face, kd, ax, c, shade); push(p2[0], p2[1], p2[2], face, kd, ax, c, shade); push(p3[0], p3[1], p3[2], face, kd, ax, c, shade);
      if (ni + 6 > icap) { icap *= 2; const n2 = new Uint32Array(icap); n2.set(I); I = n2; }
      I[ni++] = b; I[ni++] = b + 1; I[ni++] = b + 2; I[ni++] = b; I[ni++] = b + 2; I[ni++] = b + 3;
    };
    const S = step;
    // greedy top faces: merge runs of equal (height, kind, colour) along x
    // quantised colours so flat stretches (plains, deserts, snowfields, seas) merge into big quads;
    // the shader's per-block speckle keeps them from looking flat. Cell keys are plain numbers (no strings).
    for (let k = 0; k < N * N; k++) { const c = cTop[k]; if (c) cTop[k] = [Math.round(c[0] / 8) * 8, Math.round(c[1] / 8) * 8, Math.round(c[2] / 8) * 8]; }
    const ckeys = new Float64Array(N * N);
    for (let k = 0; k < N * N; k++) {
      const c = cTop[k]; if (!c) continue;
      const cq = kind[k] === 1 ? 32768 + aux[k] : ((Math.min(255, c[0]) >> 3) << 10) | ((Math.min(255, c[1]) >> 3) << 5) | (Math.min(255, c[2]) >> 3);
      ckeys[k] = ((cq * 8 + kind[k]) * 4096 + Math.max(0, Math.round(top[k] * 8))) * 1;
    }
    const done = new Uint8Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      if (done[j * n + i]) continue;
      const k = idx(i, j), ck = ckeys[k];
      let w = 1, d = 1;
      if (kind[k] !== 5) {
        while (i + w < n && !done[j * n + i + w] && ckeys[idx(i + w, j)] === ck) w++;
        grow: while (j + d < n) { for (let t = 0; t < w; t++) if (done[(j + d) * n + i + t] || ckeys[idx(i + t, j + d)] !== ck) break grow; d++; }
      }
      for (let b = 0; b < d; b++) for (let a = 0; a < w; a++) done[(j + b) * n + i + a] = 1;
      const h = top[k], x = i * S, z = j * S;
      // top face (+y), counter-clockwise seen from above
      quad([x, h, z], [x, h, z + d * S], [x + w * S, h, z + d * S], [x + w * S, h, z], 2, kind[k], aux[k], cTop[k], 255);
    }
    // side faces toward lower neighbours (and deep skirts on the tile border so level seams never gap);
    // identical wall pieces along a row/column are merged into one long quad
    const NB = [[1, 0, 0], [-1, 0, 1], [0, 1, 4], [0, -1, 5]];
    const runs = [];
    const lineMaps = new Map();
    const piece = (face, line, along, y0, y1, kd, ax, c, shade) => {
      if (y1 <= y0 + 0.01) return;
      // numeric run keys (no strings): one map per face·line, then heights · kind · aux · colour (4 bits per channel) · shade
      const lk = face * 64 + line;
      let lm = lineMaps.get(lk); if (!lm) { lm = new Map(); lineMaps.set(lk, lm); }
      const key = ((((Math.max(0, Math.round(y0 * 8)) * 4096 + Math.max(0, Math.round(y1 * 8))) * 8 + kd) * 256 + ax) * 4096 + ((((c[0] | 0) >> 4) << 8) | (((c[1] | 0) >> 4) << 4) | ((c[2] | 0) >> 4))) * 2 + (shade === 200 ? 0 : 1);
      let r = lm.get(key); if (!r) { r = { face, line, y0, y1, kd, ax, c, shade, list: [] }; lm.set(key, r); runs.push(r); }
      r.list.push(along);
    };
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const k = idx(i, j), h = top[k], kd = kind[k];
      for (const [dx, dz, face] of NB) {
        const ni = i + dx, nj = j + dz, nk = idx(ni, nj);
        const border = ni < 0 || nj < 0 || ni >= n || nj >= n;
        let nh = top[nk];
        if (border) nh = Math.min(nh, h) - 10;
        if (nh >= h - 0.01) continue;
        const shade = face <= 1 ? 200 : 225;
        const sideKd = kd === 1 || kd === 2 || kd === 3 ? kd : kd === 5 ? 5 : 0;
        const line = face <= 1 ? i : j, along = face <= 1 ? j : i;
        const ax = kd === 1 ? aux[k] : 0;
        if (kd === 5) { const ground = Math.max(nh, Hs[k] + 1); piece(face, line, along, ground, h, sideKd, ax, cSide[k], shade); piece(face, line, along, nh, ground, 0, 0, cCliff[k], shade); }
        else if (kd === 0 || kd === 6) { const cap = Math.min(h - nh, 3); piece(face, line, along, h - cap, h, sideKd, ax, kd === 6 ? mixc(cSide[k], cTop[k], 0.4) : cSide[k], shade); piece(face, line, along, nh, h - cap, 0, 0, cCliff[k], shade); }
        else piece(face, line, along, nh, h, sideKd, ax, cTop[k], shade);
      }
    }
    for (const r of runs) {
      const L0 = r.list.sort((p, q) => p - q);
      let a0 = L0[0], prev = a0;
      const flush = (s0, s1) => {
        const f = r.face, ln = r.line;
        let A, Bp;
        if (f === 0) { A = [(ln + 1) * S, (s1 + 1) * S]; Bp = [(ln + 1) * S, s0 * S]; }
        else if (f === 1) { A = [ln * S, s0 * S]; Bp = [ln * S, (s1 + 1) * S]; }
        else if (f === 4) { A = [s0 * S, (ln + 1) * S]; Bp = [(s1 + 1) * S, (ln + 1) * S]; }
        else { A = [(s1 + 1) * S, ln * S]; Bp = [s0 * S, ln * S]; }
        quad([A[0], r.y1, A[1]], [A[0], r.y0, A[1]], [Bp[0], r.y0, Bp[1]], [Bp[0], r.y1, Bp[1]], f, r.kd, r.ax, r.c, r.shade);
      };
      for (let t = 1; t < L0.length; t++) { if (L0[t] === prev + 1) { prev = L0[t]; continue; } flush(a0, prev); a0 = prev = L0[t]; }
      flush(a0, prev);
    }
    // ---- little voxel trees on the near levels
    const box = (x0b, y0b, z0b, x1b, y1b, z1b, c, kd, faces, cb) => {
      if (faces & 1) quad([x0b, y1b, z0b], [x0b, y1b, z1b], [x1b, y1b, z1b], [x1b, y1b, z0b], 2, kd, 0, c, 255);
      if (faces & 2) quad([x0b, y0b, z0b], [x1b, y0b, z0b], [x1b, y0b, z1b], [x0b, y0b, z1b], 3, kd, 0, cb || c, 150);
      quad([x1b, y1b, z1b], [x1b, y0b, z1b], [x1b, y0b, z0b], [x1b, y1b, z0b], 0, kd, 0, c, 200);
      quad([x0b, y1b, z0b], [x0b, y0b, z0b], [x0b, y0b, z1b], [x0b, y1b, z1b], 1, kd, 0, c, 200);
      quad([x0b, y1b, z1b], [x0b, y0b, z1b], [x1b, y0b, z1b], [x1b, y1b, z1b], 4, kd, 0, c, 225);
      quad([x1b, y1b, z0b], [x1b, y0b, z0b], [x0b, y0b, z0b], [x0b, y1b, z0b], 5, kd, 0, c, 225);
    };
    const LOG = { birch: ['birch_log', 0xd8d2c0], spruce: ['spruce_log', 0x3d2c1a], jungle: ['jungle_log', 0x584419], acacia: ['acacia_log', 0x676158], dark_oak: ['dark_oak_log', 0x3c2e1a], cherry: ['cherry_log', 0x4a2b2e], pale_oak: ['pale_oak_log', 0x8a8580], mangrove: ['mangrove_log', 0x5a3a2a], poplar: ['oak_log', 0x6b5033], oak: ['oak_log', 0x6b5033] };
    for (const t of trees) {
      const cx = t.i * S + S / 2 + t.jx, cz = t.j * S + S / 2 + t.jz, g0 = t.g;
      const lg = LOG[t.kind] || LOG.oak, trunkC = bcol(lg[0], 0, lg[1]);
      const tw = S <= 4 ? 0.5 : 0.8;
      if (t.kind === 'spruce') {
        const w0 = S <= 4 ? 1.8 : 2.8, top0 = g0 + t.th;
        box(cx - tw, g0, cz - tw, cx + tw, g0 + 2, cz + tw, trunkC, 0, 0);
        box(cx - w0, g0 + 2, cz - w0, cx + w0, g0 + t.th * 0.6, cz + w0, t.lc, 5, 3);
        box(cx - w0 * 0.6, g0 + t.th * 0.6, cz - w0 * 0.6, cx + w0 * 0.6, top0, cz + w0 * 0.6, t.lc, 5, 1);
      } else if (t.kind === 'acacia') {
        const w0 = S <= 4 ? 2.6 : 3.6;
        box(cx - tw, g0, cz - tw, cx + tw, g0 + t.th - 1.5, cz + tw, trunkC, 0, 0);
        box(cx - w0, g0 + t.th - 1.5, cz - w0, cx + w0, g0 + t.th, cz + w0, t.lc, 5, 3);
      } else {
        const w0 = (S <= 4 ? 2.1 : 3.2) * (t.kind === 'jungle' || t.kind === 'dark_oak' ? 1.25 : 1);
        const trunkH = Math.max(1.5, t.th * 0.42);
        box(cx - tw, g0, cz - tw, cx + tw, g0 + trunkH, cz + tw, trunkC, 0, 0);
        box(cx - w0, g0 + trunkH, cz - w0, cx + w0, g0 + t.th, cz + w0, t.lc, 5, 3);
      }
    }
    // ---- villages whose plaza lies in this tile (each village is drawn by exactly one tile per level)
    for (const st of vsites) {
      if (st.x < x0 || st.x >= x0 + T || st.z < z0 || st.z >= z0 + T) continue;
      let vm = null; try { vm = villageMesh(g, st); } catch (e) { if (VR.VillageGen && VR.VillageGen.probe && e === VR.VillageGen.probe) throw e; vm = null; }
      if (!vm) continue;
      const qd = vm.q;
      for (let o = 0; o < qd.length; o += 8) {
        const f = qd[o], mt = vm.pal[qd[o + 1]], c = mt.c, kd = mt.k;
        const xa = qd[o + 2] - x0, ya = qd[o + 3], za = qd[o + 4] - z0, xb = qd[o + 5] - x0, yb = qd[o + 6], zb = qd[o + 7] - z0;
        if (f === -1) { box(xa + 0.2, ya + 0.15, za + 0.2, xa + 0.8, ya + 0.75, za + 0.8, c, kd, 3); continue; }
        if (f === -2) { box(xa + 0.38, ya, za + 0.38, xa + 0.62, ya + 1, za + 0.62, c, kd, 0); continue; }
        if (f === 2) quad([xa, ya, za], [xa, ya, zb], [xb, ya, zb], [xb, ya, za], 2, kd, 0, c, 255);
        else if (f === 3) quad([xa, ya, za], [xb, ya, za], [xb, ya, zb], [xa, ya, zb], 3, kd, 0, c, 150);
        else if (f === 0) quad([xa, yb, zb], [xa, ya, zb], [xa, ya, za], [xa, yb, za], 0, kd, 0, c, 200);
        else if (f === 1) quad([xa, yb, za], [xa, ya, za], [xa, ya, zb], [xa, yb, zb], 1, kd, 0, c, 200);
        else if (f === 4) quad([xa, yb, za], [xa, ya, za], [xb, ya, za], [xb, yb, za], 4, kd, 0, c, 225);
        else quad([xb, yb, za], [xb, ya, za], [xa, ya, za], [xa, yb, za], 5, kd, 0, c, 225);
      }
    }
    // ---- citadels on the mountain tops (every level: they are the landmarks of the horizon)
    if (VR.CitadelGen && g.climateAt) {
      let cits = []; try { cits = VR.CitadelGen.near(g, x0, z0, x0 + T, z0 + T, 0); } catch (e) { cits = []; }
      for (const s of cits) {
        if (s.x < x0 || s.x >= x0 + T || s.z < z0 || s.z >= z0 + T) continue; // drawn by the tile holding the centre
        // the terrace
        const tx = s.x - x0, tz = s.z - z0, Rr = s.R, ty = s.y + 1;
        const tc = s.pal === 1 ? [0xD8, 0xC0, 0x90] : [0x9A, 0x9A, 0x96];
        box(tx - Rr, s.y - 6, tz - Rr, tx + Rr, ty, tz + Rr, tc, 0, 1);
        for (const b of VR.CitadelGen.lodBoxes(s)) {
          const bx = b.x - x0, bz = b.z - z0;
          if (b.slits) { const r = b.r, ww = b.w; box(bx - ww, b.y0, bz - r - 0.6, bx + ww, b.y1, bz + r + 0.6, b.c, b.kd, 0); box(bx - r - 0.6, b.y0, bz - ww, bx + r + 0.6, b.y1, bz + ww, b.c, b.kd, 0); continue; }
          box(bx - b.r, b.y0, bz - b.r, bx + b.r, b.y1, bz + b.r, b.c, b.kd, b.kd === 0 ? 1 : 3);
        }
      }
    }
    // ---- floating sky islands
    if (g.islandAt) {
      const isl = new Array(N * N);
      for (let j = -1; j <= n; j++) for (let i = -1; i <= n; i++) { const X = x0 + i * S + (S >> 1), Z = z0 + j * S + (S >> 1); isl[idx(i, j)] = g.islandAt(X, Z); }
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const I0 = isl[idx(i, j)]; if (!I0) continue;
        const k = idx(i, j), B = BIOMES[BIO[k]], cl = CL[k];
        const t0 = cl.ember > 0.45 ? redsand : cl.t < -0.35 ? snow : tint(grassTop, B.grass);
        const side = cl.ember > 0.45 ? ochre : cl.prism > 0.45 ? duskrock : stone;
        const x = i * S, z = j * S, yt = I0.top + 1, yb = I0.bottom;
        quad([x, yt, z], [x, yt, z + S], [x + S, yt, z + S], [x + S, yt, z], 2, 0, 0, t0, 255);
        quad([x, yb, z], [x + S, yb, z], [x + S, yb, z + S], [x, yb, z + S], 3, 0, 0, mixc(side, [20, 20, 30], 0.35), 150);
        for (const [dx, dz, face] of NB) {
          const o = isl[idx(i + dx, j + dz)];
          let a, b;
          if (face === 0) { a = [x + S, 0, z + S]; b = [x + S, 0, z]; } else if (face === 1) { a = [x, 0, z]; b = [x, 0, z + S]; } else if (face === 4) { a = [x, 0, z + S]; b = [x + S, 0, z + S]; } else { a = [x + S, 0, z]; b = [x, 0, z]; }
          const wall = (y0, y1, c, sh) => { if (y1 > y0 + 0.01) quad([a[0], y1, a[2]], [a[0], y0, a[2]], [b[0], y0, b[2]], [b[0], y1, b[2]], face, 0, 0, c, sh); };
          const oTop = o ? o.top + 1 : -1, oBot = o ? o.bottom : 1e9;
          // exposed above the neighbour's top and below its bottom
          const upper0 = Math.max(yb, oTop);
          if (upper0 < yt) { const cap = Math.min(3, yt - upper0); wall(yt - cap, yt, mixc(dirt, t0, 0.3), face <= 1 ? 200 : 225); wall(upper0, yt - cap, side, face <= 1 ? 190 : 215); }
          const lower1 = Math.min(yt, oBot);
          if (o && lower1 > yb) wall(yb, Math.min(lower1, upper0), side, 180);
        }
      }
    }
    // ---- giant crystal spires (exact, from the realm feature generator) on nearer tiles
    if (L <= 2 && VR.RealmFeatures && g.climateAt) {
      let any = false;
      for (let k = 0; k < N * N && !any; k++) { const key = BIOMES[BIO[k]].key; if (key === 'prism_fields' || key === 'crystal_highlands') any = true; }
      if (any) {
        const cols = new Map();
        const rec = {
          ok: () => true, get: () => 0,
          set(x, y, z, s) { if (!s) return; const t = R.types[R.T.type[s]]; if (!t || t.name.indexOf('crystal_block') < 0) return; const ck = (x >> 1) * 65536 + (z >> 1); let c = cols.get(ck); if (!c) { c = { x: x >> 1, z: z >> 1, y0: y, y1: y, s }; cols.set(ck, c); } else { if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y; } },
          place(x, y, z, s) { this.set(x, y, z, s); return true; },
        };
        const cx0 = Math.floor(x0 / 16), cz0 = Math.floor(z0 / 16), cn = (n * S) >> 4;
        for (let cz = cz0; cz < cz0 + cn; cz++) for (let cx = cx0; cx < cx0 + cn; cx++) {
          const ci = Math.floor(((cx * 16 + 8) - x0) / S), cj = Math.floor(((cz * 16 + 8) - z0) / S);
          const key = BIOMES[BIO[idx(M.clamp(ci, 0, n - 1), M.clamp(cj, 0, n - 1))]].key;
          if (key !== 'prism_fields' && key !== 'crystal_highlands') continue;
          try { VR.RealmFeatures(g, rec, cx, cz, [], true); } catch (e) { /* keep going */ }
        }
        for (const c of cols.values()) {
          const col = scol(c.s, 0x9a6aff);
          const x = c.x * 2 - x0, z = c.z * 2 - z0;
          if (x < -2 || z < -2 || x > n * S + 2 || z > n * S + 2) continue;
          const y0 = c.y0, y1 = c.y1 + 1;
          quad([x, y1, z], [x, y1, z + 2], [x + 2, y1, z + 2], [x + 2, y1, z], 2, 4, 0, col, 255);
          quad([x + 2, y1, z + 2], [x + 2, y0, z + 2], [x + 2, y0, z], [x + 2, y1, z], 0, 4, 0, col, 210);
          quad([x, y1, z], [x, y0, z], [x, y0, z + 2], [x, y1, z + 2], 1, 4, 0, col, 210);
          quad([x, y1, z + 2], [x, y0, z + 2], [x + 2, y0, z + 2], [x + 2, y1, z + 2], 4, 4, 0, col, 230);
          quad([x + 2, y1, z], [x + 2, y0, z], [x, y0, z], [x, y1, z], 5, 4, 0, col, 230);
        }
      }
    }
    if (!nv) return { empty: true, minY: 0, maxY: 0 };
    const buf = vbuf.slice(0, nv * 12);
    const ib = nv > 65535 ? I.slice(0, ni) : Uint16Array.from(I.subarray(0, ni));
    return { verts: buf, idx: ib, count: ni, minY, maxY, big: nv > 65535, bx0, bz0, bx1, bz1 };
  };
})(VR);
