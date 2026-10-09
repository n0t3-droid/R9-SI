// ============================================================================
// The Pod Hills (TRAILER.md §3.3): the green hills behind the Palm City wear
// white pod houses (a dome cap on a slim stem with a glowing door), long white
// tube houses lying on the slopes, and white ribbon paths that wind up the
// hill with little lights — the trailer's backdrop behind the city.
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R, M = VR.M, HEART = VR.Heart;
  const OG = VR.OverworldGen && VR.OverworldGen.prototype;
  if (!HEART || !OG) return;
  const HILLS = VR.HillsGen = {};
  const stCache = new Map();
  const st = (name, props) => { const key = props ? name + JSON.stringify(props) : name; let s = stCache.get(key); if (s !== undefined) return s; const t = R.byName[name]; s = t ? (props ? t.state(props) : t.defaultState) : 0; stCache.set(key, s); return s; };
  HILLS.box = { x0: -270, x1: 270, z0: -430, z1: -200 };

  HILLS.build = function (g) {
    if (g._hillsOps) return g._hillsOps;
    const K = { STEM: st('vx_pod_stem'), WHITE: st('hull_plating'), GRAY: st('hull_plating_gray'), GLASS: st('viewport'), GLOW: st('tech_panel'), PATH: st('vx_floor_plaza'), LINE: st('vx_floor_plaza_line'), LAMP0: st('vx_lamppost_tech', { head: 0 }), LAMP1: st('vx_lamppost_tech', { head: 1 }), GRASS: st('grass_block'), DIRT: st('dirt'), PLANTER: st('vx_tech_planter'), BUSH: st('vx_bush'), HEDGE: st('vx_hedge_light') || st('vx_hedge'), DOOR: st('neon_lime') || st('tech_panel') };
    const chunks = new Map();
    const bucket = (x, z) => { const k = (x >> 4) + ',' + (z >> 4); let b = chunks.get(k); if (!b) { b = { f: [], o: [] }; chunks.set(k, b); } return b; };
    const fill = (x, z, y0, y1, s) => { if (y1 >= y0) bucket(x, z).f.push(x, z, y0, y1, s); };
    const put = (x, y, z, s) => { bucket(x, z).o.push(x, y, z, s); };
    const rng = new VR.RNG(g.seed ^ 0x9111);
    const gy = (x, z) => g.surfaceY(x, z);
    const used = [];
    const freeSpot = (x, z, r) => !used.some(u => Math.hypot(u[0] - x, u[1] - z) < r + u[2]);
    const onHill = (x, z) => { const cl = g.climateAt(x, z); return cl.heart > 0.5 && gy(x, z) >= 86 && !(g.villageNear && g.villageNear(x, z, 4)) && !(g.vgen >= 8 && HILLS.inT8(x, z)); };   // (vgen 8: the terraces' face is the terraces')
    // ---- ribbon paths: three winding tracks from the city's north edge up over the hills, 3 wide, with lights
    const paths = [];
    for (let k = 0; k < 3; k++) {
      let x = -120 + k * 120 + rng.int(40), z = -215, ang = -Math.PI / 2 + (rng.next() - 0.5) * 0.6;
      const pts = [];
      for (let t = 0; t < 190; t++) {
        ang += (rng.next() - 0.5) * 0.09 + Math.sin(t * 0.05 + k) * 0.02;
        x += Math.cos(ang); z += Math.sin(ang);
        if (z < HILLS.box.z0 + 8 || Math.abs(x) > HILLS.box.x1 - 8) break;
        pts.push([Math.round(x), Math.round(z), ang]);
      }
      paths.push(pts);
      const hs = pts.map(p => gy(p[0], p[1]));
      const sm = hs.map((h, i) => { let s2 = 0, n2 = 0; for (let q = -4; q <= 4; q++) { const v = hs[i + q]; if (v !== undefined) { s2 += v; n2++; } } return Math.round(s2 / n2); });
      let last = null;
      for (let i = 0; i < pts.length; i++) {
        const [px, pz, a] = pts[i], y = sm[i], nx = -Math.sin(a), nz = Math.cos(a);
        for (let v = -1; v <= 1; v++) {
          const qx = Math.round(px + nx * v), qz = Math.round(pz + nz * v);
          if (!onHill(qx, qz)) continue;
          const g0 = gy(qx, qz);
          if (g0 < y) fill(qx, qz, g0 + 1, y - 1, K.DIRT);
          put(qx, y, qz, (v === 0 && (i % 7 === 0)) ? K.LINE : K.PATH);
          fill(qx, qz, y + 1, Math.max(y + 4, g0 + 3), 0);
          used.push([qx, qz, 1.2]);
        }
        if (i % 16 === 8) { const lx = Math.round(px + nx * 2.2), lz = Math.round(pz + nz * 2.2); if (onHill(lx, lz)) { const ly = Math.max(gy(lx, lz), y); put(lx, ly + 1, lz, K.LAMP0); put(lx, ly + 2, lz, K.LAMP1); } }
        last = [px, pz];
      }
      void last;
    }
    // ---- pod houses: a white mushroom cap (radius 3–4) with a ring of cyan windows on a slim stem, in loose
    // groups beside the paths
    let pods = 0;
    for (let k = 0; k < 600 && pods < 30; k++) {
      const P = paths[rng.int(paths.length)], p = P[rng.int(P.length)];
      if (!p) continue;
      const side = rng.chance(0.5) ? 1 : -1, off = 6 + rng.int(12);
      const x = Math.round(p[0] - Math.sin(p[2]) * off * side), z = Math.round(p[1] + Math.cos(p[2]) * off * side);
      const rad = 3 + rng.int(2);
      if (!onHill(x, z) || !freeSpot(x, z, rad + 2)) continue;
      const y = gy(x, z);
      const h = 4 + rng.int(3);
      fill(x, z, y + 1, y + h, K.STEM);
      put(x, y + 1, z, K.DOOR);
      const cy = y + h;   // cap base
      for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
        const d = Math.hypot(dx, dz);
        if (d > rad + 0.4) continue;
        const hh = Math.sqrt(Math.max(0, (rad + 0.5) * (rad + 0.5) - d * d)) * 0.7;  // flattened dome
        const top = cy + Math.max(1, Math.round(hh));
        const g0 = gy(x + dx, z + dz);
        for (let yy = cy; yy <= top; yy++) {
          const rim = yy === cy && d > rad - 1.2;
          put(x + dx, yy, z + dz, rim ? K.GLASS : (yy === top && d < 1 ? K.GLOW : K.WHITE));
        }
        fill(x + dx, z + dz, top + 1, Math.max(top + 4, g0 + 3), 0);
      }
      if (rng.chance(0.6)) put(x + rad, y + 1, z + rad, K.BUSH);
      used.push([x, z, rad + 1]); pods++;
    }
    // ---- tube houses: white half-cylinders (5 wide, 8–14 long) lying along x or z, a glowing doorway at one end
    let tubes = 0;
    for (let k = 0; k < 400 && tubes < 9; k++) {
      const x = -230 + rng.int(460), z = HILLS.box.z0 + 20 + rng.int(HILLS.box.z1 - HILLS.box.z0 - 40);
      const alongX = rng.chance(0.5), len = 8 + rng.int(7);
      if (!onHill(x, z) || !freeSpot(x, z, len / 2 + 4)) continue;
      const y = gy(x, z);
      let ok = true;
      for (let t = 0; t < len; t++) { const px = alongX ? x + t : x, pz = alongX ? z : z + t; if (!onHill(px, pz) || Math.abs(gy(px, pz) - y) > 3) { ok = false; break; } }
      if (!ok) continue;
      for (let t = 0; t < len; t++) for (let v = -2; v <= 2; v++) {
        const px = alongX ? x + t : x + v, pz = alongX ? z + v : z + t;
        const g0 = gy(px, pz);
        fill(px, pz, g0 + 1, y, K.GRASS);
        const hh = Math.round(Math.sqrt(Math.max(0, 6.25 - v * v)));   // half-cylinder radius 2.5
        for (let yy = 1; yy <= hh; yy++) {
          const end = t === 0 || t === len - 1;
          let s = K.WHITE;
          if (end && Math.abs(v) <= 1 && yy <= 2 && t === 0) s = K.DOOR;            // doorway
          else if (!end && yy === 2 && Math.abs(v) === 2 && (t % 3 === 1)) s = K.GLASS; // portholes
          else if (!end && yy === hh && v === 0 && t % 4 === 2) s = K.GLASS;
          put(px, y + yy, pz, s);
        }
        fill(px, pz, y + hh + 1, Math.max(y + hh + 4, g0 + 3), 0);
      }
      put(alongX ? x - 1 : x + 3, y + 1, alongX ? z + 3 : z - 1, K.PLANTER);
      used.push([x + (alongX ? len / 2 : 0), z + (alongX ? 0 : len / 2), len / 2 + 3]); tubes++;
    }
    g._hillsOps = chunks;
    return chunks;
  };

  HEART.builders.push(function (g, cx, cz, out) {
    const x0 = cx * 16, z0 = cz * 16, B = HILLS.box;
    if (x0 + 16 <= B.x0 || x0 > B.x1 || z0 + 16 <= B.z0 || z0 > B.z1) return;
    const chunks = HILLS.build(g);
    const b = chunks.get(cx + ',' + cz);
    if (!b) return;
    const blocks = out.blocks;
    for (let i = 0; i < b.f.length; i += 5) {
      const lx = b.f[i] - x0, lz = b.f[i + 1] - z0, s = b.f[i + 4];
      const y0 = Math.max(1, b.f[i + 2]), y1 = Math.min(254, b.f[i + 3]);
      for (let y = y0; y <= y1; y++) blocks[(y << 8) | (lz << 4) | lx] = s;
    }
    for (let i = 0; i < b.o.length; i += 4) {
      const lx = b.o[i] - x0, lz = b.o[i + 2] - z0, y = b.o[i + 1];
      if (y < 1 || y > 254) continue;
      blocks[(y << 8) | (lz << 4) | lx] = b.o[i + 3];
    }
  });

  // ============================================================================ vgen 8: the terraced hill face
  // (TRAILER.md shot F, frames t3_07 · t3_08 · t3_09; plan docs/superpowers/plans/2026-10-08-t-city2.md) The face of
  // the hills behind Nova Haven is cut into terraces: the natural height is lowered to the level below it — levels 4
  // and 5 blocks apart from y 82, the city's level land being 80–81 — so the slope becomes flat green treads and
  // risers; the riser faces are moss (green from the side), the treads grass, every terrace edge a cyan light line (the
  // contour lines of the frames), small round trees on the treads; a Villa Nova of the family (gen_nova.js) stands on
  // every second terrace where the hill is gentle enough (its lot cut level into the slope), and three stairways climb
  // from the city's hill foot over every riser, paved across the treads with light lines on both sides. The cut leaves
  // every cell the city laid out as it is (plan.nova.owns). The edges of the region blend into the natural hills.
  const T8 = HILLS.T8 = { x0: -170, x1: 170, z0: -285, z1: -150, base: 82, blend: 18, stairsX: [-64, 0, 64] };
  T8.levels = (() => { const L = [T8.base]; while (L[L.length - 1] < 140) L.push(L[L.length - 1] + ((L.length & 1) ? 4 : 5)); return L; })();
  HILLS.inT8 = (x, z) => x >= T8.x0 && x <= T8.x1 && z >= T8.z0 && z <= T8.z1;
  const ss = M.smoothstep;
  // the terraced surface of a column: {h natural top, y terraced top, k level index (−1: not a terrace), w mask}
  const cityOwns = (g) => {
    if (g._t8owns !== undefined) return g._t8owns;
    let f = null;
    try { const VG = VR.VillageGen, s = VG && VG.sitesFor(g, 0, -9).find(q => q.home); const p = s && VG.plan(g, s); f = p && p.nova && p.nova.owns ? p.nova.owns : null; } catch (e) { if (VR.VillageGen && VR.VillageGen.probe && e === VR.VillageGen.probe) throw e; f = null; }
    g._t8owns = f; return f;
  };
  HILLS.cellT8 = function (g, x, z) {
    const cache = g._t8cells || (g._t8cells = new Map()), key = x * 65536 + z;
    let c = cache.get(key); if (c) return c;
    const h = g.surfaceY(x, z);
    c = { h, y: h, k: -1, w: 0 };
    if (HILLS.inT8(x, z) && h >= T8.base) {
      const B = T8.blend, w = ss(T8.x0, T8.x0 + B, x) * (1 - ss(T8.x1 - B, T8.x1, x)) * ss(T8.z0, T8.z0 + B, z);
      const own = cityOwns(g);
      if (w > 0 && !(own && own(x, z))) {
        let k = 0; while (k + 1 < T8.levels.length && T8.levels[k + 1] <= h) k++;
        c.y = Math.round(h - w * (h - T8.levels[k])); c.w = w; c.k = w >= 0.999 ? k : -1;
      }
    }
    if (cache.size > 400000) cache.clear();
    cache.set(key, c);
    return c;
  };
  // an edge: a terrace cell whose neighbour lies a riser lower (the line runs along the top of every riser)
  HILLS.edgeT8 = function (g, x, z) {
    const c = HILLS.cellT8(g, x, z); if (c.k < 0) return false;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = HILLS.cellT8(g, x + dx, z + dz); if (n.y <= c.y - 3) return true; }
    return false;
  };
  // the terraces' set pieces, once per world: the villa sites, the stairways, the trees, the samples for the test
  HILLS.terraces = function (g) {
    if (!(g.vgen >= 8) || !HEART.on(g)) return null;
    if (g._terr) return g._terr;
    const VG = VR.VillageGen, PLAN = VG && VG.plan2;
    const ops = new Map();
    const bucket = (x, z) => { const k = (x >> 4) + ',' + (z >> 4); let b = ops.get(k); if (!b) { b = { o: [] }; ops.set(k, b); } return b; };
    const put = (x, y, z, s) => { bucket(x, z).o.push(x, y, z, s); };
    const C = (x, z) => HILLS.cellT8(g, x, z);
    const T = { levels: T8.levels.slice(), villas: [], stairs: [], samples: [], ops, lots: [] };
    // ---- the villas: on the even levels 2, 4, 6, 8 (91, 100, 109, 118), facing the city (the street side south)
    const LW = PLAN ? PLAN.NOVA.LOT[0] : 25, LD = PLAN ? PLAN.NOVA.LOT[1] : 31;
    const taken = [];
    const free = (x0, z0, x1, z1) => !taken.some(t => x0 <= t[2] + 8 && x1 >= t[0] - 8 && z0 <= t[3] + 8 && z1 >= t[1] - 8);
    const rng = new VR.RNG((g.seed ^ 0x7e88a5) >>> 0), comps = ['long', 'bungalow', 'classic', 'tower', 'corner'];
    if (PLAN) for (const k of [2, 4, 6, 8]) {
      const L = T8.levels[k]; let n = 0;
      for (let xc = T8.x0 + 30; xc <= T8.x1 - 30 && n < 3; xc += 4) {
        // the tread's south edge at this x: the first cell north of the city at level k
        let zf = null; for (let z = T8.z1; z >= T8.z0 + 10; z--) { const c = C(xc, z); if (c.k === k) { zf = z; break; } if (c.k > k) break; }
        if (zf === null) continue;
        const ox = xc + 12, oz = zf - 1, x0 = ox - LW + 1, x1 = ox, z0 = oz - LD + 1, z1 = oz;
        if (!free(x0, z0, x1, z1)) continue;
        // gentle enough: the cut into the slope behind the house at most 13 blocks (the moss under every tread runs 14
        // deep, so the cut face is green), the fill under the front at most 5
        let ok = true, cut = 0;
        for (let z = z0; z <= z1 && ok; z++) for (let x = x0; x <= x1; x++) { const c = C(x, z); if (c.k < 0 && c.y >= T8.base) { ok = false; break; } if (c.y > L + 13 || c.y < L - 5) { ok = false; break; } cut += Math.max(0, c.y - L); }
        if (!ok) continue;
        const comp = comps[(rng.int(comps.length) + T.villas.length) % comps.length];
        T.villas.push({ level: k, L, ox, oz, r: 2, comp, mirror: rng.chance(0.5), cut, built: false });
        taken.push([x0, z0, x1, z1]); n++; xc += 40;
      }
    }
    // ---- the stairways: three wide flights from the hill foot over every riser, paved across the treads
    const ST_UP = st('vollton_light_grey_stairs', { facing: 0, half: 0 }), ST_BODY = st('vollton_light_grey'), PAVE = st('vx_floor_plaza'), LINE = st('vx_floor_plaza_line');
    const inLot = (x, z) => taken.some(t => x >= t[0] - 1 && x <= t[2] + 1 && z >= t[1] - 1 && z <= t[3] + 1);
    for (const sx of T8.stairsX) {
      const flights = [];
      let z = T8.z1;
      while (z > T8.z0 + 2) {
        const a = C(sx, z), b = C(sx, z - 1);
        if (b.y - a.y >= 3 && a.k >= -1) flights.push([z, a.y, b.y]);
        z--;
      }
      // a flight stands on the lower tread in front of its riser: step i at height low + i, one cell further north each
      let prevTop = null;
      for (const [ze, low, high] of flights) {
        const d = high - low;
        let room = true; for (let i = 0; i < d; i++) for (let dx = -1; dx <= 1; dx++) { const c = C(sx + dx, ze + i); if (Math.abs(c.y - low) > 1 || inLot(sx + dx, ze + i)) room = false; }
        if (!room) { prevTop = null; continue; }
        for (let i = 1; i <= d; i++) {
          const zz = ze + d - i;
          for (let dx = -1; dx <= 1; dx++) { for (let y = low + 1; y < low + i; y++) put(sx + dx, y, zz, ST_BODY); put(sx + dx, low + i, zz, ST_UP); for (let y = low + i + 1; y <= high + 3; y++) put(sx + dx, y, zz, 0); }
        }
        // the paving across the tread below, from the last flight's top to the foot of this one
        if (prevTop !== null) for (let zz = prevTop; zz >= ze + d; zz--) { for (let dx = -2; dx <= 2; dx++) { if (inLot(sx + dx, zz)) continue; const c = C(sx + dx, zz); if (Math.abs(c.y - low) > 0) continue; put(sx + dx, low, zz, Math.abs(dx) === 2 ? LINE : PAVE); } }
        prevTop = ze - 1;
        T.stairs.push({ x: sx, z: ze, low, high });
      }
    }
    // ---- round trees on the treads (every so often, never on an edge, a stair or a lot)
    const TREE = R.byName.vm_tree_round_s ? 'vm_tree_round_s' : null;
    if (TREE && VR.VM && VR.VM.MODELS[TREE]) {
      const VM = VR.VM;
      for (let z = T8.z0 + 8; z <= T8.z1 - 4; z += 3) for (let x = T8.x0 + 8; x <= T8.x1 - 8; x += 3) {
        const hv = (M.hash2(x, z, g.seed + 4401) >>> 0) % 1000; if (hv >= 22) continue;
        const c = C(x, z); if (c.k < 1 || inLot(x, z) || T8.stairsX.some(s => Math.abs(s - x) <= 3)) continue;
        let flat = true; for (let dx = -2; dx <= 2 && flat; dx++) for (let dz = -2; dz <= 2; dz++) { const n = C(x + dx, z + dz); if (n.y !== c.y || HILLS.edgeT8(g, x + dx, z + dz)) { flat = false; break; } }
        if (!flat) continue;
        VM.put((xx, yy, zz, n, pr) => put(xx, yy, zz, st(n, pr)), x, c.y + 1, z, TREE, 0);
      }
    }
    // ---- samples for test/trailer_city.js: tread and edge cells spread over the face, as many of each
    const tread = [], edge = [];
    for (let z = T8.z1 - 4; z >= T8.z0 + 20; z -= 1) for (let x = T8.x0 + 24 + ((z * 3) & 7); x <= T8.x1 - 24; x += 9) {
      const c = C(x, z); if (c.k < 0 || inLot(x, z) || T8.stairsX.some(s => Math.abs(s - x) <= 3)) continue;
      (HILLS.edgeT8(g, x, z) ? edge : tread).push([x, z, c.k, HILLS.edgeT8(g, x, z) ? 1 : 0]);
    }
    for (let i = 0; i < 150; i++) { if (edge[Math.floor(i * edge.length / 150)]) T.samples.push(edge[Math.floor(i * edge.length / 150)]); if (tread[Math.floor(i * tread.length / 150)]) T.samples.push(tread[Math.floor(i * tread.length / 150)]); }
    T.lots = taken;
    g._terr = T;
    return T;
  };
  // a terrace villa's blocks, built the first time a chunk under it is generated (then kept for the world)
  const villaOps = (g, T, v) => {
    if (v.ops) return v.ops;
    const VG = VR.VillageGen, PLAN = VG.plan2, chunks = new Map();
    const bucket = (x, z) => { const k = (x >> 4) + ',' + (z >> 4); let b = chunks.get(k); if (!b) { b = { o: [] }; chunks.set(k, b); } return b; };
    const L = VG.makeLot((x, y, z, s) => bucket(x, z).o.push(x, y, z, s), v.ox, v.oz, v.r);
    const ground = (u, w) => { const q = VG.rot(v.r, u, w); return HILLS.cellT8(g, v.ox + q[0], v.oz + q[1]).y; };
    PLAN.build(L, { w: PLAN.NOVA.LOT[0], d: PLAN.NOVA.LOT[1], F: v.L + 1, r: v.r, ox: v.ox, oz: v.oz, kind: 'home' }, { index: PLAN.TRAILER, comp: v.comp, novaMirror: v.mirror, rng: new VR.RNG((g.seed ^ (v.ox * 73 + v.oz * 977)) >>> 0), ground, beds: 3, noCustom: v.comp !== 'classic' });
    v.ops = chunks; v.built = true;
    return chunks;
  };
  HEART.builders.push(function (g, cx, cz, out) {
    if (!(g.vgen >= 8)) return;
    const x0 = cx * 16, z0 = cz * 16;
    if (x0 + 16 <= T8.x0 || x0 > T8.x1 || z0 + 16 <= T8.z0 || z0 > T8.z1) return;
    const T = HILLS.terraces(g); if (!T) return;
    const blocks = out.blocks, K = { GRASS: st('grass_block'), MOSS: st('moss_block'), LINE: st('vx_floor_plaza_line') };
    const RT = R.T, FL = VR.F;
    // the cut: every terrace column lowered to its level — the top grass (a light line on an edge), moss under it
    for (let lz = 0; lz < 16; lz++) for (let lx = 0; lx < 16; lx++) {
      const x = x0 + lx, z = z0 + lz, c = HILLS.cellT8(g, x, z);
      if (c.y === c.h && c.k < 0) continue;
      for (let y = c.y + 1; y <= Math.min(254, c.h + 14); y++) { const i = (y << 8) | (lz << 4) | lx; const b = blocks[i]; if (b && !(RT.flags[b] & FL.FLUID)) blocks[i] = 0; }
      blocks[(c.y << 8) | (lz << 4) | lx] = HILLS.edgeT8(g, x, z) ? K.LINE : K.GRASS;
      for (let y = Math.max(1, c.y - 14); y < c.y; y++) { const i = (y << 8) | (lz << 4) | lx; if (blocks[i] && (RT.flags[blocks[i]] & FL.OPAQUE)) blocks[i] = K.MOSS; }
    }
    // the stairways and trees, then the villas over this chunk
    const key = cx + ',' + cz, b = T.ops.get(key);
    const stamp = (o) => { for (let i = 0; i < o.length; i += 4) { const lx = o[i] - x0, lz = o[i + 2] - z0, y = o[i + 1]; if (lx < 0 || lz < 0 || lx > 15 || lz > 15 || y < 1 || y > 254) continue; blocks[(y << 8) | (lz << 4) | lx] = o[i + 3]; } };
    if (b) stamp(b.o);
    for (const v of T.villas) {
      if (x0 + 16 <= v.ox - 25 || x0 > v.ox + 1 || z0 + 16 <= v.oz - 31 || z0 > v.oz + 1) continue;
      const vb = villaOps(g, T, v).get(key); if (vb) stamp(vb.o);
    }
  });
})(VR);
