// ============================================================================
// Worker entry: world generation, lighting and meshing jobs
// ============================================================================
(function (VR) {
  'use strict';
  let seed = 0, opts = {};
  const gens = {};
  // the world's style (v0.34): rules + water colour for the overworld / flat land the game generates
  let STYLE = null, STYLE_MAP = null;
  const STYLE_ON = (dim) => !!(STYLE && VR.WorldStyle && (dim === 'overworld' || dim === 'flat'));
  function setStyle(st) { STYLE = st && (st.sv || (st.rules && st.rules.length) || st.water) ? st : null; STYLE_MAP = STYLE && VR.WorldStyle ? VR.WorldStyle.compile(STYLE.rules) : null; }
  const getGen = (dim) => gens[dim] || (gens[dim] = VR.makeGen(dim, seed, opts));
  // expand quads (4 verts) into triangle lists (6 verts) for drawArrays/multiDraw: vertices 0 1 2, then 0 2 3
  // (plain index loops: three subarray views per quad were a third of a mesh job's garbage, and three times slower)
  function toTris(q) {
    const nq = q.length >> 5, out = new Uint16Array(nq * 48);
    for (let i = 0; i < nq; i++) {
      const s = i * 32, d = i * 48;
      for (let k = 0; k < 24; k++) out[d + k] = q[s + k];
      for (let k = 0; k < 8; k++) out[d + 24 + k] = q[s + k];
      for (let k = 0; k < 16; k++) out[d + 32 + k] = q[s + 16 + k];
    }
    return out;
  }
  VR.quadsToTris = toTris;
  // light + mesh an arbitrary block grid (ships / contraptions)
  function shipMesh(m) {
    const { sx, sy, sz, blocks } = m;
    const R = VR.R, T = R.T;
    const N = sx * sy * sz, idx = (x, y, z) => (y * sz + z) * sx + x;
    const light = new Uint16Array(N);
    const q = new Int32Array(N * 4 + 16); let qh = 0, qt = 0;
    // sky: flood from grid boundary
    for (let y = 0; y < sy; y++) for (let z = 0; z < sz; z++) for (let x = 0; x < sx; x++) {
      if (x && y && z && x < sx - 1 && y < sy - 1 && z < sz - 1) continue;
      const i = idx(x, y, z);
      if (T.filter[blocks[i]] < 15) { light[i] = 14 << 12; q[qt++] = i; }
    }
    const DXs = [1, -1, 0, 0, 0, 0], DYs = [0, 0, 1, -1, 0, 0], DZs = [0, 0, 0, 0, 1, -1];
    while (qh < qt) { const i = q[qh++]; const s = light[i] >>> 12; if (s <= 1) continue; const x = i % sx, z = Math.floor(i / sx) % sz, y = Math.floor(i / (sx * sz)); for (let d = 0; d < 6; d++) { const nx = x + DXs[d], ny = y + DYs[d], nz = z + DZs[d]; if (nx < 0 || ny < 0 || nz < 0 || nx >= sx || ny >= sy || nz >= sz) continue; const n = idx(nx, ny, nz); const f = T.filter[blocks[n]]; if (f >= 15) continue; const v = s - 1 - f; if (v > (light[n] >>> 12)) { light[n] = (light[n] & 0xfff) | (v << 12); q[qt++] = n; } } }
    qh = qt = 0;
    for (let i = 0; i < N; i++) { const e = T.emit[blocks[i]]; if (e) { light[i] = (light[i] & 0xf000) | e; q[qt++] = i; } }
    while (qh < qt) { const i = q[qh++]; const l = light[i]; const r = (l >> 8) & 15, g = (l >> 4) & 15, b = l & 15; if (r <= 1 && g <= 1 && b <= 1) continue; const x = i % sx, z = Math.floor(i / sx) % sz, y = Math.floor(i / (sx * sz)); for (let d = 0; d < 6; d++) { const nx = x + DXs[d], ny = y + DYs[d], nz = z + DZs[d]; if (nx < 0 || ny < 0 || nz < 0 || nx >= sx || ny >= sy || nz >= sz) continue; const n = idx(nx, ny, nz); const f = T.filter[blocks[n]]; if (f >= 15) continue; const dec = 1 + f; const nl = light[n]; const nr = r - dec, ng = g - dec, nb = b - dec, cr = (nl >> 8) & 15, cg = (nl >> 4) & 15, cb = nl & 15; if (nr > cr || ng > cg || nb > cb) { light[n] = (nl & 0xf000) | (Math.max(nr, cr) << 8) | (Math.max(ng, cg) << 4) | Math.max(nb, cb); if (qt < q.length) q[qt++] = n; } } }
    const out = [];
    const PAD = VR.MESH_PAD || 2, PS = 16 + PAD * 2, PSS = PS * PS;
    const tint = VR.rgb565(127, 191, 85), fol = VR.rgb565(95, 168, 58), wat = VR.rgb565(63, 118, 228);
    for (let oy = 0; oy < sy; oy += 16) for (let oz = 0; oz < sz; oz += 16) for (let ox = 0; ox < sx; ox += 16) {
      const pb = new Uint16Array(PS * PS * PS), pl = new Uint16Array(PS * PS * PS);
      let any = false;
      for (let py = 0; py < PS; py++) for (let pz = 0; pz < PS; pz++) for (let px = 0; px < PS; px++) {
        const x = ox + px - PAD, y = oy + py - PAD, z = oz + pz - PAD, o = py * PSS + pz * PS + px;
        if (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz) { pl[o] = 14 << 12; continue; }
        const i = idx(x, y, z); pb[o] = blocks[i]; pl[o] = light[i];
        if (blocks[i] && px >= PAD && py >= PAD && pz >= PAD && px < 16 + PAD && py < 16 + PAD && pz < 16 + PAD) any = true;
      }
      if (!any) continue;
      const tints = new Uint16Array(PS * PS);
      const r = VR.meshSection({ blocks: pb, light: pl, grass: tints.fill(tint), foliage: new Uint16Array(PS * PS).fill(fol), water: new Uint16Array(PS * PS).fill(wat), sy: 0, ox: 0, oz: 0, fancyLeaves: true, smooth: true });
      out.push({ ox, oy, oz, opaque: toTris(r.opaque), cutout: toTris(r.cutout), trans: toTris(r.trans) });
    }
    return out;
  }
  // ---- town plans, the Gate Temple and the village sites, in slices (gen_village.js, gen_temple.js) -------------
  // A job that needs a town's plan, the Heartland's Gate Temple, or a site cell (a cell of the village grid)
  // that the worker has not computed yet waits instead of holding the worker: it answers {type:'waiting'} (the pool
  // keeps its slot and its time), one slice of that work is built (PLAN_SLICE_MS, or one cell) and the job is looked
  // at again on a later turn, so the worker's other jobs run in between. The needs of a job are known before it runs
  // (needsOf); a need that a run finds missing anyway (VG.probe) ends that run unanswered and the job waits the same
  // way. A home city's plan is built after the temple it stands on.
  // init and custom replace the generators: a job still waiting then is answered {type:'cancelled'} (its owner asks
  // again if it still wants it).
  const PLAN_SLICE_MS = 20, PLAN_JOBS = { gen: 1, relight: 1, lod: 1, spawn: 1, villageplan: 1 };
  let epoch = 0;
  const post = (msg, tr) => { if (VR.VillageGen && VR.VillageGen.probe && VR.VillageGen.probe.miss) return; self.postMessage(msg, tr); };
  // the needs of a job, in the order they are met: {temple: true}, or {site, lod} for a town's plan
  function needsOf(m, g) {
    const VG = VR.VillageGen, out = [];
    if (!VG || !(g instanceof VR.OverworldGen) || !(g.singleBiome < 0)) return out;
    // the site cells the job reads come first: a cold cell is computed in a turn of its own (VG.site); the plans below
    // read the cells, so they are looked at once every cell is there
    let cells = [];
    if (m.type === 'gen' || m.type === 'relight') cells = VG.cellsFor(g, m.cx, m.cz);
    else if (m.type === 'lod' && m.dim === 'overworld' && VR.LOD) cells = VR.LOD.tileCells(g, m);
    for (const [i, j] of cells) if (!VG.siteKnown(g, i, j)) out.push({ cell: true, i, j });
    if (out.length) return out;
    let chunks = false, plans = [];
    if (m.type === 'gen') { chunks = true; plans = VG.sitesFor(g, m.cx, m.cz).map(s => [s, false]); }
    else if (m.type === 'relight') { chunks = true; const sv = m.sv || 0; if (STYLE_ON(m.dim) && sv !== STYLE.sv && VR.WorldStyle.rulesAt(STYLE, sv)) plans = VG.sitesFor(g, m.cx, m.cz).map(s => [s, false]); }
    else if (m.type === 'lod') { if (m.dim === 'overworld' && VR.LOD) plans = VR.LOD.plansNeeded(g, m).map(s => [s, true]); }
    if (chunks && VR.Heart && VR.Heart.on(g) && !g._temple) {
      const B = VR.TempleGen.box, x0 = m.cx * 16, z0 = m.cz * 16;   // the chunk's stamp of the temple (gen_temple.js)
      if (!(x0 + 16 <= B.x0 || x0 > B.x1 || z0 + 16 <= B.z0 || z0 > B.z1)) out.push({ temple: true });
    }
    for (const [site, lod] of plans) out.push({ site, lod });
    return out;
  }
  const needReady = (g, n) => n.cell ? VR.VillageGen.siteKnown(g, n.i, n.j) : n.temple ? !!g._temple : VR.VillageGen.planReady(g, n.site, n.lod);
  // one slice of the work a need stands for
  function advance(g, n) {
    if (n.cell) { VR.VillageGen.site(g, n.i, n.j); return; }
    if (n.temple) { VR.TempleGen.advance(g, PLAN_SLICE_MS); return; }
    if (!g._temple && VR.Heart && VR.Heart.on(g) && n.site.home) { VR.TempleGen.advance(g, PLAN_SLICE_MS); return; }
    VR.VillageGen.planAdvance(g, n.site, PLAN_SLICE_MS, n.lod);
  }
  function park(m, g, n) {
    self.postMessage({ type: 'waiting', id: m.id });
    const t0 = performance.now();
    try { advance(g, n); }
    catch (err) { self.postMessage({ type: 'error', id: m.id, msg: String(err && err.stack || err) }); return; }
    m.planMs = (m.planMs || 0) + (performance.now() - t0);
    setTimeout(() => self.onmessage({ data: m }), 0);
  }
  function run(m) {
    try {
      if (m.type === 'init') {
        seed = m.seed >>> 0; opts = m.opts || {}; epoch++;
        if (m.custom !== undefined && VR.Custom) VR.Custom.apply(m.custom);   // the player's Studio designs
        setStyle(m.style);
        for (const k in gens) delete gens[k];
        post({ type: 'ready' });
      } else if (m.type === 'style') {
        setStyle(m.style);
      } else if (m.type === 'custom') {
        if (VR.Custom) VR.Custom.apply(m.custom);
        for (const k in gens) delete gens[k];
        epoch++;
      } else if (m.type === 'gen') {
        const t0 = performance.now();
        const g = getGen(m.dim);
        const col = g.generate(m.cx, m.cz);
        // the world's own style: its rules on everything generated, its water colour
        if (STYLE_ON(m.dim)) { VR.WorldStyle.applyGen(col.blocks, STYLE_MAP); if (STYLE.water) VR.WorldStyle.applyWater(col.tints.water, STYLE.water); }
        const sky = m.dim === 'overworld' || m.dim === 'drift' || m.dim === 'flat';
        const light = VR.computeColumnLight(col.blocks, sky);
        post({ type: 'gen', id: m.id, dim: m.dim, cx: m.cx, cz: m.cz, blocks: col.blocks, light, biome: col.biome, caveBiome: col.caveBiome, grass: col.tints.grass, foliage: col.tints.foliage, water: col.tints.water, chests: col.chests, spawns: col.spawns || [], sv: STYLE_ON(m.dim) ? STYLE.sv : 0, ms: performance.now() - t0 + (m.planMs || 0) },
          [col.blocks.buffer, light.buffer, col.tints.grass.buffer, col.tints.foliage.buffer, col.tints.water.buffer]);
      } else if (m.type === 'relight') {
        const sky = m.dim === 'overworld' || m.dim === 'drift' || m.dim === 'flat';
        const g = getGen(m.dim);
        let tints = null, biome = null, caveBiome = null;
        // a saved column made under other rules: what the generator put there (and the player left alone) takes the
        // current rules; what the player built stays exactly as it is
        let sv = m.sv || 0, restyled = 0;
        if (STYLE_ON(m.dim) && sv !== STYLE.sv) {
          const old = VR.WorldStyle.rulesAt(STYLE, sv);
          if (old) { const raw = g.generate(m.cx, m.cz); tints = raw.tints; restyled = VR.WorldStyle.reconcile(m.blocks, raw.blocks, VR.WorldStyle.compile(old), STYLE_MAP); sv = STYLE.sv; }
        } else if (!STYLE_ON(m.dim) && sv && STYLE === null) { /* the style was removed in another way: leave the column as it is */ }
        const light = VR.computeColumnLight(m.blocks, sky);
        // tints/biome for saved columns come from the generator (cheap climate only)
        if (!tints && g.tints) { tints = g.tints(m.cx, m.cz); }
        if (g.climateAt) {
          biome = new Uint8Array(256);
          for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) { const x = m.cx * 16 + lx, z = m.cz * 16 + lz; const cl = g.climateAt(x, z); biome[lz * 16 + lx] = g.biomeFor(cl, g.surfaceY(x, z)); }
        } else if (g.biomeAt) { biome = new Uint8Array(256); for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) biome[lz * 16 + lx] = g.biomeAt(m.cx * 16 + lx, m.cz * 16 + lz); }
        else biome = new Uint8Array(256);
        if (!tints) { const t = g.generate(m.cx, m.cz).tints; tints = t; }
        if (STYLE_ON(m.dim) && STYLE.water) VR.WorldStyle.applyWater(tints.water, STYLE.water);
        caveBiome = new Int8Array(256).fill(-1);
        post({ type: 'gen', id: m.id, dim: m.dim, cx: m.cx, cz: m.cz, blocks: m.blocks, light, biome, caveBiome, grass: tints.grass, foliage: tints.foliage, water: tints.water, chests: [], saved: true, sv, restyled },
          [m.blocks.buffer, light.buffer]);
      } else if (m.type === 'mesh') {
        const t0 = performance.now();
        const r = VR.meshSection(m);
        const o = toTris(r.opaque), c = toTris(r.cutout), t = toTris(r.trans);
        const vx = r.vx ? toTris(r.vx) : null, vxFar = r.vxFar ? toTris(r.vxFar) : null;
        const tr = [o.buffer, c.buffer, t.buffer]; if (vx) tr.push(vx.buffer); if (vxFar) tr.push(vxFar.buffer);
        post({ type: 'mesh', id: m.id, key: m.key, sy: m.sy, ver: m.ver, opaque: o, cutout: c, trans: t, vx, vxFar, vis: r.vis, ms: performance.now() - t0 }, tr);
      } else if (m.type === 'lightonly') {
        const sky = m.dim === 'overworld' || m.dim === 'drift' || m.dim === 'flat';
        const light = VR.computeColumnLight(m.blocks, sky);
        post({ type: 'lightonly', id: m.id, light }, [light.buffer]);
      } else if (m.type === 'shipmesh') {
        const out = shipMesh(m);
        const tr = []; for (const s of out) tr.push(s.opaque.buffer, s.cutout.buffer, s.trans.buffer);
        post({ type: 'shipmesh', id: m.id, sections: out }, tr);
      } else if (m.type === 'starship') {
        const r = VR.Starship.build(m.seed, m.arch, { palette: m.palette, allow: m.allow, preview: m.preview });
        const tr = [r.hull.data.buffer, r.glass.data.buffer, r.gear.data.buffer, r.occ.occ.buffer];
        if (r.preview) tr.push(r.preview.rgba.buffer);
        post({ type: 'starship', id: m.id, meta: r.meta, hull: r.hull, glass: r.glass, gear: r.gear, occ: r.occ, preview: r.preview || null }, tr);
      } else if (m.type === 'lodinit') {
        if (VR.LOD) VR.LOD.setAvg(m.avg);
        return;
      } else if (m.type === 'lod') {
        const t0 = performance.now();
        const g = getGen(m.dim);
        const r = VR.LOD && m.dim === 'overworld' ? VR.LOD.build(g, m) : null;
        if (!r || r.empty) { post({ type: 'lod', id: m.id, empty: true, ms: performance.now() - t0 + (m.planMs || 0) }); return; }
        post({ type: 'lod', id: m.id, verts: r.verts, idx: r.idx, count: r.count, minY: r.minY, maxY: r.maxY, big: r.big, bx0: r.bx0, bz0: r.bz0, bx1: r.bx1, bz1: r.bz1, ms: performance.now() - t0 + (m.planMs || 0) }, [r.verts, r.idx.buffer]);
      } else if (m.type === 'look') {
        // the block look (Klassisch / Nahtlos): the next meshes follow it (the main thread re-meshes)
        if (VR.setLook) VR.setLook(m.mode);
      } else if (m.type === 'textures') {
        const R = VR.R, mk = VR.textureMasks();
        // bevelAll = the Klassisch look (the rim on the seamless materials; v2: chunky natural recipes, the outline on every cube and leaf)
        const out = VR.buildTextureArrays({ names: R.texNames, cubeMask: mk.cube, cutoutMask: mk.cut, leafMask: mk.leaf, blockMask: mk.block, bevel: m.bevel === undefined ? 1 : m.bevel, bevelAll: !!m.bevelAll, classic: m.classic !== undefined ? !!m.classic : !!m.bevelAll });
        const noise = VR.buildNoiseTexture();
        const tr = [noise.buffer, out.avgColor.buffer];
        for (const a of out.albedo) tr.push(a.buffer); for (const a of out.material) tr.push(a.buffer);
        post({ type: 'textures', id: m.id, albedo: out.albedo, material: out.material, levels: out.levels, size: out.size, layers: out.layers, missing: out.missing, avgColor: out.avgColor, noise }, tr);
      } else if (m.type === 'spawn') {
        const g = getGen(m.dim);
        const p = m.near && g.findSpawn.length >= 2 ? g.findSpawn(m.near[0], m.near[1]) : g.findSpawn();
        post({ type: 'spawn', id: m.id, pos: p });
      } else if (m.type === 'surface') {
        const g = getGen(m.dim);
        const res = m.points.map(([x, z]) => g.surfaceY ? g.surfaceY(x, z) : 64);
        post({ type: 'surface', id: m.id, res });
      } else if (m.type === 'villageplan') {
        const g = getGen(m.dim), VG = VR.VillageGen;
        let plan = null;
        if (VG && g.climateAt && g.singleBiome < 0) { const ij = String(m.vid).split('_').map(Number); const site = VG.site(g, ij[0], ij[1]); if (site && site.id === m.vid) plan = VG.summary(VG.plan(g, site)); }
        post({ type: 'villageplan', id: m.id, vid: m.vid, plan });
      } else if (m.type === 'villages') {
        const g = getGen(m.dim), VG = VR.VillageGen, list = [];
        if (VG && g.climateAt && g.singleBiome < 0) {
          const C = VG.cell(g), R0 = Math.ceil(m.r / C), ci = Math.floor(m.x / C), cj = Math.floor(m.z / C);
          for (let di = -R0; di <= R0; di++) for (let dj = -R0; dj <= R0; dj++) { const s = VG.site(g, ci + di, cj + dj); if (s && Math.hypot(s.x - m.x, s.z - m.z) <= m.r) list.push({ id: s.id, name: s.name, style: s.style, x: s.x, y: s.y, z: s.z, rad: VG.siteRad ? VG.siteRad(g, s) : VG.rad(g) }); }
        }
        post({ type: 'villages', id: m.id, list });
      } else if (m.type === 'railways') {
        const g = getGen(m.dim), RG = VR.RailGen;
        const lines = RG && g.climateAt && g.singleBiome < 0 ? RG.near(g, m.x, m.z, m.r) : [];
        post({ type: 'railways', id: m.id, lines }, lines.map(l => l.pts.buffer));
      } else if (m.type === 'blueprint') {
        // a catalogue house (or the player's design of it) on a flat lot, lot-local (x = u, z = v, y relative to the
        // floor), every cell once (the builder's last write wins) — the main thread levels the ground and lays it down
        const VG = VR.VillageGen, PLAN = VG && VG.plan2, cat = PLAN && PLAN.CATALOGUE[m.index];
        if (!cat) { post({ type: 'blueprint', id: m.id, error: 'unknown house' }); return; }
        const F = 64, W = cat.lot[0], D = cat.lot[1], M = 16, SX = W + M * 2, SZ = D + M * 2, cells = new Map();
        const L = VG.makeLot((x, y, z, s) => { if (x < -M || z < -M || x >= W + M || z >= D + M || y < 0) return; cells.set(((y * SZ) + z + M) * SX + x + M, s); }, 0, 0, 0);
        const o = { index: m.index, rng: new VR.RNG(m.seed || 7), ground: () => F - 1, beds: 3 };
        if (m.skin) o.skin = m.skin; if (m.mirror !== undefined) o.mirror = !!m.mirror;
        const info = PLAN.build(L, { w: W, d: D, F, r: 0, ox: 0, oz: 0, kind: 'home' }, o);
        if (!info) { post({ type: 'blueprint', id: m.id, error: 'house did not build' }); return; }
        const ops = new Int32Array(cells.size * 4); let k = 0, top = 0, bottom = 0;
        for (const [key, s] of cells) {
          const x = key % SX - M, z = Math.floor(key / SX) % SZ - M, y = Math.floor(key / (SX * SZ)) - F;
          ops[k++] = x; ops[k++] = y; ops[k++] = z; ops[k++] = s;
          if (s && y > top) top = y; if (y < bottom) bottom = y;
        }
        const H = info.plan;
        post({ type: 'blueprint', id: m.id, index: m.index, ops, lot: [W, D], house: [H.u0, H.v0, H.w, H.d], top, bottom, custom: !!info.custom, skin: info.skin, mirror: !!H.mirrored, beds: info.beds.length }, [ops.buffer]);
      } else if (m.type === 'locate') {
        const g = getGen(m.dim);
        let found = null;
        if (m.biome === 'village') { const s = g.nearestVillage ? g.nearestVillage(m.x, m.z, 4000) : null; found = s ? [s.x, s.y + 1, s.z] : null; }
        else if (m.biome === 'outpost') { const o = g.nearestOutpost ? g.nearestOutpost(m.x, m.z) : null; found = o ? [o.x, o.y, o.z] : null; }
        else if (g.climateAt && VR.BIOME[m.biome] !== undefined) {
          const target = VR.BIOME[m.biome];
          outer: for (let r = 0; r < 6000; r += 32) for (let a = 0; a < Math.max(8, r / 16); a++) {
            const ang = a / Math.max(8, r / 16) * Math.PI * 2;
            const x = Math.round(m.x + Math.cos(ang) * r), z = Math.round(m.z + Math.sin(ang) * r);
            const y = g.surfaceY(x, z);
            if (g.biomeFor(g.climateAt(x, z), y) === target) { found = [x, y + 1, z]; break outer; }
          }
        }
        post({ type: 'locate', id: m.id, pos: found });
      }
    } catch (err) {
      if (VR.VillageGen && VR.VillageGen.probe && VR.VillageGen.probe.miss) return;   // a probe run that met a missing plan
      post({ type: 'error', id: m.id, msg: String(err && err.stack || err) });
    }
  }
  self.onmessage = function (e) {
    const m = e.data, VG = VR.VillageGen;
    if (!PLAN_JOBS[m.type] || !VG) { run(m); return; }
    try {
      if (m.epoch === undefined) m.epoch = epoch;
      if (m.epoch !== epoch) { self.postMessage({ type: 'cancelled', id: m.id }); return; }   // the worlds were replaced
      const g = getGen(m.dim);
      for (const n of needsOf(m, g)) if (!needReady(g, n)) { park(m, g, n); return; }
      const pr = VG.probe = { miss: null };
      run(m);
      VG.probe = null;
      if (pr.miss) park(m, g, pr.miss.temple ? { temple: true } : { site: pr.miss.site, lod: pr.miss.lod });
    } catch (err) {
      VG.probe = null;
      self.postMessage({ type: 'error', id: m.id, msg: String(err && err.stack || err) });
    }
  };
})(VR);
