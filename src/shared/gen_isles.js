// ============================================================================
// The Sky Isles — the trailer's floating archipelago (TRAILER.md §3.6): seven
// designed islands east of the Gate Plateau, grass domes over layered rock
// with waterfalls (one lava island), round trees, crystals, asphalt loop roads
// with yellow dashes, wooden trestle bridges from rim to rim, a small stepped
// stone temple on the centre island and a hoodoo island with a cave arch.
// The islands are generated through the realm island system (shape, soil,
// falls); this module lists them and stamps the roads, bridges and buildings.
// New worlds (vgen ≥ 9, VR.GEN.noCry): no crystals — big round trees with bushes at their foot where the crystals stood,
// glow-berry vines and hanging roots under the islands where the crystal stalactites hung.
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R, M = VR.M, HEART = VR.Heart, GEN = VR.GEN;
  const OG = VR.OverworldGen && VR.OverworldGen.prototype;
  if (!HEART || !OG || !GEN) return;
  const ISLES = VR.IslesGen = {};
  const stCache = new Map();
  const st = (name, props) => { const key = props ? name + JSON.stringify(props) : name; let s = stCache.get(key); if (s !== undefined) return s; const t = R.byName[name]; s = t ? (props ? t.state(props) : t.defaultState) : 0; stCache.set(key, s); return s; };
  const C = HEART.ISLES;

  // ---------------------------------------------------------------- the seven islands
  ISLES.list = function (g) {
    if (g._isles) return g._isles;
    const rng = new VR.RNG(M.hash2(3, 3, g.seed + 0x15135));
    const mk = (dx, dz, r, y, o) => Object.assign({ x: C.x + dx, z: C.z + dz, r, y, dome: 3 + rng.next() * 1.5, deep: 0.85 + rng.next() * 0.25, seed: rng.int(1000), falls: 2 + rng.int(2), warp: 0.22, designed: true }, o || {});
    const L = [
      mk(0, 0, 42, 158, { name: 'C', temple: true }),
      mk(-20, -95, 30, 164, { name: 'N' }),
      mk(72, -70, 26, 150, { name: 'NE', falls: 1 }),
      mk(96, 15, 34, 156, { name: 'E' }),
      mk(10, 90, 36, 152, { name: 'S', lava: true, falls: 2 }),
      mk(-80, 55, 24, 166, { name: 'SW', hoodoo: true, falls: 1 }),
      mk(-92, -25, 28, 160, { name: 'W' }),
    ];
    // bridges between neighbours (island indices)
    ISLES.LINKS = [[0, 1], [0, 3], [0, 4], [0, 6], [1, 2], [3, 4], [6, 5], [2, 3]];
    ISLES.LOOP = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 4]];   // the rail loop C → N → NE → E → S → C rides a stone viaduct
    g._isles = L;
    return L;
  };
  OG.designedIslands = function (x, z) {
    if (!HEART.on(this)) return null;
    if (Math.abs(x - C.x) > 220 || Math.abs(z - C.z) > 220) return null;
    return ISLES.list(this);
  };
  ISLES.near = (x, z) => Math.abs(x - C.x) < 240 && Math.abs(z - C.z) < 240;

  // ---------------------------------------------------------------- roads, bridges, buildings (ops per chunk)
  function mats() {
    return {
      ASPH: st('asphalt'), DASHZ: st('asphalt_dash', { axis: 2 }), DASHX: st('asphalt_dash', { axis: 1 }), PLANK: st('oak_planks') || st('vx_planks'), LOG: st('oak_log', { axis: 0 }) || st('oak_log'),
      FENCE: st('oak_fence') || st('vx_fence_wood'), LAMP0: st('vx_lamppost', { head: 0 }), LAMP1: st('vx_lamppost', { head: 1 }), LAVA: st('lava'), MAGMA: st('magma_block'), BASALT: st('basalt'),
      WALL: st('temple_stone'), SMOOTH: st('temple_stone_smooth'), BAND: st('temple_stone_band'), SLIT: st('temple_slit'), BAR: st('temple_light_bar'), FRAME: st('vx_portal_frame', { facing: 0 }), BEACON: st('beacon_red'),
      OCHRE: st('ochre_rock'), UMBER: st('umber_rock'), TERRA: st('orange_terracotta'), TERRAB: st('brown_terracotta'), GRASS: st('grass_block'), DIRT: st('dirt'),
      CRY: (c, big) => st(c + '_crystal_cluster', { facing: 4, size: big ? 1 : 0 }), CRYB: (c) => st(c + '_crystal_block'), FERN: st('vx_fern_lush'), BUSH: st('vx_bush'),
      VSTONE: st('spire_stone'), VRAIL: st('vx_tech_railing'), VLINE: st('vx_floor_plaza_line'),
      ROOTS: st('hanging_roots'), VINE: (berries, tip) => st('glow_berry_vine', { berries: berries ? 1 : 0, tip: tip ? 1 : 0 }), TUFT: st('vm_tuft_grass', { part: 'p000', facing: 0 }) || st('vx_fern_lush'),
    };
  }
  ISLES.build = function (g) {
    if (g._islesOps) return g._islesOps;
    const K = mats(), L = ISLES.list(g);
    const chunks = new Map(), tracks = [];
    const bucket = (x, z) => { const k = (x >> 4) + ',' + (z >> 4); let b = chunks.get(k); if (!b) { b = { f: [], o: [] }; chunks.set(k, b); } return b; };
    const fill = (x, z, y0, y1, s) => { if (y1 >= y0) bucket(x, z).f.push(x, z, y0, y1, s); };
    const put = (x, y, z, s) => { bucket(x, z).o.push(x, y, z, s); };
    // (vgen ≥ 6) a bridge's track: a rail on the deck's centre, one block up (on the island's top where the island carries
    // the bridge); its shapes ramp like the village lines'; the points become the bridge's tram line (ISLES.trackLines)
    const bridgeTrack = (A, B, ia, ib, tr, dx, dz) => {
      const alongX = Math.abs(dx) >= Math.abs(dz), dir = alongX ? Math.sign(dx) : Math.sign(dz), pts = [];
      for (let i = 0; i < tr.length; i++) {
        const [x, y, z] = tr[i], prev = tr[Math.max(0, i - 1)][1], next = tr[Math.min(tr.length - 1, i + 1)][1];
        let shp = alongX ? 1 : 0;
        if (next > y) shp = alongX ? (dir > 0 ? 2 : 3) : (dir > 0 ? 5 : 4);
        else if (prev > y) shp = alongX ? (dir > 0 ? 3 : 2) : (dir > 0 ? 4 : 5);
        put(x, y + 1, z, st('rail', { shape: shp }));
        const last = pts[pts.length - 1];
        if (last && last[0] === x && last[1] === z) last[2] = y + 1; else pts.push([x, z, y + 1]);
      }
      tracks.push({ key: 'isle-' + ia + '-' + ib, names: ['Isle ' + A.name, 'Isle ' + B.name], pts });
    };
    const shape = (x, z) => { let best = null; for (const I of L) { const sh = g.islandShape(I, x, z); if (sh && (!best || sh.top > best.top)) best = sh; } return best; };
    const rng = new VR.RNG(g.seed ^ 0x151e);
    const placed = new Map();
    const pk = (x, y, z) => (x + 1024) * 1048576 + (z + 1024) * 512 + y;
    const w = { set: (x, y, z, s) => { placed.set(pk(x, y, z), s); put(x, y, z, s); }, place: (x, y, z, s) => { const k = pk(x, y, z); if (placed.get(k)) return false; placed.set(k, s); put(x, y, z, s); return true; }, get: (x, y, z) => placed.get(pk(x, y, z)) || 0, ok: () => true };
    const roadCells = new Set();
    // ---- loop roads on every island top: a wobbly ring at ~0.6 r, flattened to the island's top level
    const road = (pts, closed) => {
      let last = null;
      const n = pts.length;
      for (let k = 0; k < (closed ? n : n - 1); k++) {
        const a = pts[k], b = pts[(k + 1) % n];
        const len = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1])));
        for (let t = 0; t <= len; t++) {
          const x = Math.round(a[0] + (b[0] - a[0]) * t / len), z = Math.round(a[1] + (b[1] - a[1]) * t / len);
          if (last && last[0] === x && last[1] === z) continue;
          const nx = -(b[1] - a[1]) / len, nz = (b[0] - a[0]) / len, alongZ = Math.abs(b[1] - a[1]) >= Math.abs(b[0] - a[0]);
          for (let v = -1; v <= 1; v++) {
            const px = Math.round(x + nx * v), pz = Math.round(z + nz * v);
            const sh = shape(px, pz); if (!sh) continue;
            const key = px + ',' + pz; if (roadCells.has(key)) continue; roadCells.add(key);
            const y = sh.top;
            put(px, y, pz, v === 0 && ((t >> 1) & 1) ? (alongZ ? K.DASHZ : K.DASHX) : K.ASPH);
            fill(px, pz, y + 1, y + 5, 0);
          }
          last = [x, z];
        }
      }
    };
    for (const I of L) {
      const n = 14, pts = [];
      for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2, rr = I.r * (0.55 + 0.12 * Math.sin(a * 3 + I.seed)); pts.push([Math.round(I.x + Math.cos(a) * rr), Math.round(I.z + Math.sin(a) * rr)]); }
      I.ring = pts;
      road(pts, true);
    }
    // ---- bridges: from the rim of one island to the rim of the next, sloping between their heights
    const rimPoint = (I, toward) => {
      const a = Math.atan2(toward.z - I.z, toward.x - I.x);
      let best = null;
      for (let r = I.r * 0.5; r < I.r * 1.4; r += 1) { const px = Math.round(I.x + Math.cos(a) * r), pz = Math.round(I.z + Math.sin(a) * r); const sh = shape(px, pz); if (sh && sh.isle === I) best = [px, pz, sh.top]; else if (best) break; }
      return best;
    };
    // the rail loop (TRAILER §3.6: "one stone-arch viaduct carrying the Isles rail loop"): a 5-wide stone deck with rails
    // and a cyan line, piers 3 wide every 10 blocks, a round arch of stone in every span; where the land carries the deck
    // the viaduct is not built
    const VIA_H = 6;
    const viaduct = (pa, pb, len, dx, dz, nx, nz) => {
      for (let t = 0; t <= len; t++) {
        const x = pa[0] + dx * t, z = pa[1] + dz * t, y = Math.round(pa[2] + (pb[2] - pa[2]) * t / len);
        const rise = Math.round(VIA_H * (1 - Math.sin(Math.PI * (t % 10) / 10)));   // the arch's rise under the deck
        const landAt = (px, pz) => { const sh = shape(px, pz); return !!sh && sh.top >= y - 1; };
        for (let v = -2; v <= 2; v++) {
          const px = Math.round(x + nx * v), pz = Math.round(z + nz * v);
          if (t > 2 && t < len - 2 && landAt(px, pz)) continue;
          put(px, y, pz, K.VSTONE);
          if (Math.abs(v) === 2) put(px, y + 1, pz, K.VRAIL); else if (v === 0) put(px, y + 1, pz, K.VLINE);
          put(px, y - 1 - rise, pz, K.VSTONE); put(px, y - 2 - rise, pz, K.VSTONE);   // the arch ring
        }
        if (t % 10 === 0) for (let v = -1; v <= 1; v++) {   // a pier: from the deck down into the void
          const px = Math.round(x + nx * v), pz = Math.round(z + nz * v);
          if (landAt(px, pz)) continue;
          for (let yy = y - 1; yy >= y - 12; yy--) put(px, yy, pz, K.VSTONE);
        }
        if (t % 20 === 10) { const px = Math.round(x + nx * 2), pz = Math.round(z + nz * 2); put(px, y + 1, pz, K.LAMP0); put(px, y + 2, pz, K.LAMP1); }
      }
    };
    for (const [ia, ib] of ISLES.LINKS) {
      const A = L[ia], B = L[ib];
      const pa = rimPoint(A, B), pb = rimPoint(B, A);
      if (!pa || !pb) continue;
      // a spur road from each ring to its rim point
      const nearest = (I, p) => I.ring.reduce((best, q) => (Math.hypot(q[0] - p[0], q[1] - p[1]) < Math.hypot(best[0] - p[0], best[1] - p[1]) ? q : best), I.ring[0]);
      road([nearest(A, pa), [pa[0], pa[1]]], false); road([nearest(B, pb), [pb[0], pb[1]]], false);
      const len = Math.max(1, Math.round(Math.hypot(pb[0] - pa[0], pb[1] - pa[1])));
      const dx = (pb[0] - pa[0]) / len, dz = (pb[1] - pa[1]) / len, nx = -dz, nz = dx, tr = [];
      // the rail loop's links ride t-world's stone-arch viaduct (the deck at the same height); the tram track (t-infra) still runs on it
      const loop = ISLES.LOOP.some(([p, q]) => (p === ia && q === ib) || (p === ib && q === ia));
      if (loop) viaduct(pa, pb, len, dx, dz, nx, nz);
      for (let t = 0; t <= len; t++) {
        const x = pa[0] + dx * t, z = pa[1] + dz * t, y = Math.round(pa[2] + (pb[2] - pa[2]) * t / len);
        if (!loop) {
          for (let v = -2; v <= 2; v++) {
            const px = Math.round(x + nx * v), pz = Math.round(z + nz * v);
            const sh = shape(px, pz);
            if (sh && sh.top >= y - 1 && t > 2 && t < len - 2) continue;   // the island itself carries the road here
            if (Math.abs(v) === 2) { put(px, y + 1, pz, K.FENCE); put(px, y, pz, K.PLANK); }
            else { put(px, y, pz, K.PLANK); fill(px, pz, y + 1, y + 4, 0); }
            if (t % 6 === 0 && Math.abs(v) === 1) for (let k = 1; k <= 12; k++) put(px, y - k, pz, K.LOG); // trestle posts into the void
          }
          if (t % 12 === 6) { const px = Math.round(x + nx * 2), pz = Math.round(z + nz * 2); put(px, y + 1, pz, K.LAMP0); put(px, y + 2, pz, K.LAMP1); }
        }
        const cx = Math.round(x), cz = Math.round(z), sh = shape(cx, cz);
        tr.push([cx, sh && sh.top >= y - 1 && t > 2 && t < len - 2 ? Math.max(y, sh.top) : y, cz]);
      }
      if (g.vgen >= 6) bridgeTrack(A, B, ia, ib, tr, dx, dz);
    }
    // ---- the Isle Temple on the centre island: three stepped tiers of slate stone, an octagon door, a beacon
    {
      const I = L[0], sh = shape(I.x, I.z);
      const y0 = sh ? sh.top + 1 : I.y + 3, cx = I.x, cz = I.z + 2;
      for (let x = -9; x <= 9; x++) for (let z = -9; z <= 9; z++) {
        const ax = Math.abs(x), az = Math.abs(z), m = Math.max(ax, az);
        const s0 = shape(cx + x, cz + z); if (!s0) continue;
        fill(cx + x, cz + z, s0.top, y0 - 1, K.SMOOTH);
        const tiers = m <= 3 ? 3 : m <= 6 ? 2 : 1;
        for (let k = 0; k < tiers; k++) {
          const ya = y0 + k * 5, yb = ya + 4;
          const edge = (k === 0 && m === 9) || (k === 1 && m === 6) || (k === 2 && m === 3);
          for (let y = ya; y <= yb; y++) {
            let s = K.SMOOTH;
            if (edge) s = y === yb ? K.BAR : ((x + z + y) % 5 === 0 ? K.SLIT : (y === ya ? K.BAND : K.WALL));
            put(cx + x, y, cz + z, s);
          }
        }
        fill(cx + x, cz + z, y0 + tiers * 5, y0 + 22, 0);
      }
      // door on the south face of the lowest tier
      for (let x = -1; x <= 1; x++) for (let y = y0; y <= y0 + 2; y++) put(cx + x, y, cz + 9, y === y0 + 2 && x !== 0 ? K.FRAME : 0);
      for (const [x, y] of [[-2, y0], [2, y0], [-2, y0 + 1], [2, y0 + 1], [-1, y0 + 3], [1, y0 + 3], [0, y0 + 3]]) put(cx + x, y, cz + 9, K.FRAME);
      for (let y = y0 + 15; y <= y0 + 19; y++) put(cx, y, cz, y === y0 + 19 ? K.BEACON : K.SMOOTH);
    }
    // ---- the hoodoo: a banded rock stack on the SW island with a cave arch through it
    {
      const I = L[5], sh = shape(I.x, I.z);
      const y0 = sh ? sh.top + 1 : I.y + 3, cx = I.x, cz = I.z, H = 26;
      for (let x = -7; x <= 7; x++) for (let z = -7; z <= 7; z++) {
        const d = Math.hypot(x, z) + Math.sin(x * 0.9) * 0.6 + Math.cos(z * 1.1) * 0.6;
        for (let y = 0; y < H; y++) {
          const r = 6.5 * (1 - Math.pow(y / H, 2.2)) + 1;
          if (d > r) continue;
          // the arch: an opening 5 wide × 7 tall along x through the middle
          if (Math.abs(z) <= 2 && y >= 1 && y <= 7 && (y <= 5 || Math.abs(z) <= 1)) continue;
          const band = (y + I.seed) % 7;
          put(cx + x, y0 + y, cz + z, band < 2 ? K.UMBER : band < 4 ? K.OCHRE : band === 4 ? K.TERRAB : K.TERRA);
        }
        if (d <= 1.5) put(cx + x, y0 + H, cz + z, K.GRASS);
      }
      for (let x = -3; x <= 3; x++) for (let z = -2; z <= 2; z++) { const s0 = shape(cx + x, cz + z); if (s0) put(cx + x, s0.top, cz + z, K.ASPH); }
    }
    // ---- lava river on the S island: a winding channel from the centre pool to the rim (its fall pours off there)
    {
      const I = L[4], a = ((I.seed * 0.618) % 1) * Math.PI * 2;
      for (let r = 0; r < I.r * 1.2; r += 0.5) {
        const wob = Math.sin(r * 0.35 + I.seed) * 2.5;
        const x = Math.round(I.x + Math.cos(a) * r - Math.sin(a) * wob), z = Math.round(I.z + Math.sin(a) * r + Math.cos(a) * wob);
        const sh = shape(x, z); if (!sh) break;
        for (let v = -1; v <= 1; v++) { const px = x + (v * Math.round(-Math.sin(a))), pz = z + (v * Math.round(Math.cos(a))); const s2 = shape(px, pz); if (!s2) continue; put(px, s2.top, pz, v === 0 || r < 3 ? K.LAVA : K.MAGMA); put(px, s2.top - 1, pz, K.BASALT); fill(px, pz, s2.top + 1, s2.top + 3, 0); }
      }
    }
    // ---- trees, bushes, crystals (kept off the roads)
    const noCry = VR.GEN.noCry(g);
    const free = (x, z) => !roadCells.has(x + ',' + z) && !roadCells.has((x + 1) + ',' + z) && !roadCells.has(x + ',' + (z + 1)) && !roadCells.has((x - 1) + ',' + z) && !roadCells.has(x + ',' + (z - 1));
    const CRYS = ['violet', 'azure', 'verdant', 'rose'];
    // (vgen 9) a big round tree where a crystal would stand (vm_tree_round_l, its trunk on the spot) with bushes on the three
    // cells beside it the crystal covered; not on the temple (its tiers stand there) and not in the hoodoo's rock; off
    // the roads. A world without the trailer's plants (the title panorama) grows a round leaf tree instead
    const trng = new VR.RNG(g.seed ^ 0x7ee5);
    const inTemple = (I, x, z) => I.temple && Math.abs(x - I.x) <= 9 && Math.abs(z - I.z - 2) <= 9;
    const inHoodoo = (I, x, z) => I.hoodoo && Math.hypot(x - I.x, z - I.z) + Math.sin((x - I.x) * 0.9) * 0.6 + Math.cos((z - I.z) * 1.1) * 0.6 <= 7.6;
    const nearTemple = (I, x, z) => I.temple && Math.abs(x - I.x) < 12 && Math.abs(z - I.z - 2) < 12, nearHoodoo = (I, x, z) => I.hoodoo && Math.abs(x - I.x) < 9 && Math.abs(z - I.z) < 9;
    const bigTree = (I, x, y, z, h) => {
      if (inTemple(I, x, z) || inHoodoo(I, x, z)) return;                                   // (their stone stands there)
      if (nearTemple(I, x, z) || nearHoodoo(I, x, z)) { put(x, y, z, K.BUSH); return; }    // (no crown against their walls)
      if (VR.Plants) for (const [px, py, pz, s] of VR.Plants.parts(h >= 8 ? 'vm_tree_round_l' : 'vm_tree_round_s', x - (h >= 8 ? 2 : 1), y, z - (h >= 8 ? 2 : 1), 0)) put(px, py, pz, s);
      else GEN.TREES.roundTree(w, x, y, z, trng);
      for (const [dx, dz] of [[1, 0], [0, 1], [1, 1]]) {
        const s2 = shape(x + dx, z + dz);
        if (!s2 || s2.isle !== I || roadCells.has((x + dx) + ',' + (z + dz)) || inTemple(I, x + dx, z + dz) || inHoodoo(I, x + dx, z + dz)) continue;
        put(x + dx, s2.top + 1, z + dz, ((x + dx + z + dz) & 1) ? K.BUSH : K.FERN);
      }
    };
    for (const I of L) {
      const nT = Math.round(I.r * 0.5);
      for (let k = 0; k < nT; k++) {
        const a = rng.next() * Math.PI * 2, d = rng.next() * I.r * 0.85;
        const x = Math.round(I.x + Math.cos(a) * d), z = Math.round(I.z + Math.sin(a) * d);
        const sh = shape(x, z); if (!sh || sh.isle !== I || !free(x, z)) continue;
        if (I.temple && Math.abs(x - I.x) < 12 && Math.abs(z - I.z - 2) < 12) continue;
        if (I.hoodoo && Math.abs(x - I.x) < 9 && Math.abs(z - I.z) < 9) continue;
        if (VR.Plants && VR.Plants.on(g)) {   // vgen 7: the trailer's round trees (voxel crowns, dense leaf balls), tufts and flower clusters
          const r = rng.next();
          if (r < 0.45) { const big = rng.chance(0.4), o = big ? 2 : 1; for (const [px, py, pz, st] of VR.Plants.parts(big ? 'vm_tree_round_l' : 'vm_tree_round_s', x - o, sh.top + 1, z - o, 0)) put(px, py, pz, st); }
          else put(x, sh.top + 1, z, VR.R.S(r < 0.75 ? 'vm_tuft_grass' : 'vm_flower_cluster', { part: 'p000', facing: 0 }));
        } else if (rng.chance(0.7)) GEN.TREES.roundTree(w, x, sh.top + 1, z, rng); else put(x, sh.top + 1, z, rng.chance(0.5) ? K.BUSH : K.FERN);
      }
      const nC = 1 + rng.int(3);
      for (let k = 0; k < nC; k++) {
        const a = rng.next() * Math.PI * 2, d = I.r * (0.2 + rng.next() * 0.6);
        const x = Math.round(I.x + Math.cos(a) * d), z = Math.round(I.z + Math.sin(a) * d);
        const sh = shape(x, z); if (!sh || sh.isle !== I || !free(x, z)) continue;
        const c = CRYS[rng.int(CRYS.length)], h = 5 + rng.int(9), y = sh.top + 1;
        if (noCry) { bigTree(I, x, y, z, h); continue; }   // vgen 9: a big round tree (the same draws)
        for (let t = 0; t < h; t++) { put(x, y + t, z, K.CRYB(c)); if (t < h - 3) { put(x + 1, y + t, z, K.CRYB(c)); put(x, y + t, z + 1, K.CRYB(c)); } if (t < h - 6) put(x + 1, y + t, z + 1, K.CRYB(c)); }
        put(x, y + h, z, K.CRY(c, true)); put(x + 1, y + h - 3, z, K.CRY(c, false)); put(x - 1, y, z, K.CRY(c, false));
      }
    }
    // ---- hanging crystals: the undersides drip crystal stalactites (the trailer's violet and cyan spikes below the isles)
    for (const I of L) {
      const nH = Math.round(I.r * 0.35);
      for (let k = 0; k < nH; k++) {
        const a = rng.next() * Math.PI * 2, d = rng.next() * I.r * 0.75;
        const x = Math.round(I.x + Math.cos(a) * d), z = Math.round(I.z + Math.sin(a) * d);
        const sh = shape(x, z); if (!sh || sh.isle !== I) continue;
        if (I.hoodoo && Math.abs(x - I.x) < 9 && Math.abs(z - I.z) < 9) continue;
        const c = CRYS[rng.int(CRYS.length)], len = 4 + rng.int(6), yb = sh.bottom - 1;
        if (noCry) {
          // vgen 9: a glow-berry vine as long as the crystal was (every third leaf with berries: a warm light under the isle)
          // and hanging roots beside it, each from its own column's underside
          for (let t = 0; t < len; t++) put(x, yb - t, z, K.VINE((M.hash2(x, yb - t, z) % 3) === 0, t === len - 1));
          const s1 = shape(x + 1, z);
          if (s1 && s1.isle === I) for (let t = 0; t < len * 0.5; t++) put(x + 1, s1.bottom - 1 - t, z, K.ROOTS);
          continue;
        }
        for (let t = 0; t < len; t++) { put(x, yb - t, z, K.CRYB(c)); if (t < len * 0.5) put(x + 1, yb - t, z, K.CRYB(c)); }
      }
    }
    g._islesOps = chunks; g._isleTracks = tracks;
    return chunks;
  };

  // (vgen ≥ 6) every bridge between two isles is a tram line, from rim to rim (its track is laid by ISLES.build)
  ISLES.trackLines = function (g, x, z, r) {
    if (!(g.vgen >= 6) || !HEART.on(g) || Math.abs(x - C.x) > 240 + r || Math.abs(z - C.z) > 240 + r) return null;
    ISLES.build(g);
    const out = [];
    for (const t of g._isleTracks || []) {
      let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
      for (const q of t.pts) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); z0 = Math.min(z0, q[1]); z1 = Math.max(z1, q[1]); }
      if (Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(z0 - z, 0, z - z1)) > r) continue;
      const P = new Int32Array(t.pts.length * 3);
      t.pts.forEach((q, i) => { P[i * 3] = q[0]; P[i * 3 + 1] = q[2]; P[i * 3 + 2] = q[1]; });
      out.push({ key: t.key, pts: P, tech: true, names: t.names });
    }
    return out;
  };
  if (VR.RailGen && VR.RailGen.providers) VR.RailGen.providers.push(ISLES.trackLines);

  HEART.builders.push(function (g, cx, cz, out) {
    const x0 = cx * 16, z0 = cz * 16;
    if (!ISLES.near(x0 + 8, z0 + 8)) return;
    const chunks = ISLES.build(g);
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
})(VR);
