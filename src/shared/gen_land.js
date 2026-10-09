// ============================================================================
// The land between (t-land, vgen 10; docs/superpowers/plans/2026-10-09-t-land.md). The Heartland's sites — the Gate
// Temple, Nova Haven, the terraced hills, the station, the citadel, the canyon, the Sky Isles — stood on one empty
// green plain: the sky meadow had no tree, no grass tuft, no flower, no path. New worlds (vgen ≥ 10) get a landscape
// between them, procedural and deterministic from the seed:
//   · terrain shapes in the Heartland's design (HEART.design, so the chunks, the far ring and the horizon all see
//     them): a river valley from the Pod Hills' east shoulder (a waterfall over the cirque at its head) to a lake under
//     the Sky Isles, the lake with its beaches, a rocky ridge in the west
//   · the land plan, once per world: the sites and a path network between them (A* over the designed land, a slope
//     limit, bridges), lanterns, benches and milestones along the ways, the farmsteads, the set pieces (lookout,
//     shrine, lighthouse, fishing hut, camps, ponds)
//   · per chunk: the plan's pieces stamped over natural ground only, woods and groves with undergrowth, meadows with
//     tall grass and flower drifts, boulders, banks; spawn anchors for the animals and the waterfall's mist
// Older worlds keep every chunk (test/land_v9_same.js: the Heartland of vgen 9 and 8 with and without this file).
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R, M = VR.M, HEART = VR.Heart, GEN = VR.GEN, F = VR.F, SEA = VR.C.SEA;
  const OG = VR.OverworldGen && VR.OverworldGen.prototype;
  if (!HEART || !OG || !GEN) return;
  const LAND = VR.Land = {};
  LAND.VGEN = 10;
  LAND.on = (g) => !!(g && g.vgen >= LAND.VGEN && HEART.on(g));
  const ss = M.smoothstep, lerp = M.lerp;
  const h01 = (x, z, s) => (M.hash2(x | 0, z | 0, s | 0) >>> 0) / 4294967296;
  LAND.h01 = h01;
  const stCache = new Map();
  const st = (name, props) => { const key = props ? name + JSON.stringify(props) : name; let s = stCache.get(key); if (s !== undefined) return s; const t = R.byName[name]; s = t ? (props ? t.state(props) : t.defaultState) : 0; stCache.set(key, s); return s; };
  LAND.st = st;
  const ck = (x, z) => x * 65536 + z;                     // a block column's key (|x|, |z| < 32768)
  const chunkKey = (x, z) => (x >> 4) * 4096 + (z >> 4);  // a chunk's key from a block column (|cx|, |cz| < 2048)

  function noises(g) {
    if (g.nLand) return;
    const Fr = VR.Fractal, s = g.seed;
    g.nLand = new Fr(s ^ 0x1a4d01, 3, 1 / 240, 0.5);      // the woods
    g.nLand2 = new Fr(s ^ 0x1a4d02, 2, 1 / 70, 0.5);      // the woods' ragged edges
    g.nLandK = new Fr(s ^ 0x1a4d03, 2, 1 / 160, 0.5);     // which wood: birch, mixed, dark
    g.nLandD = new Fr(s ^ 0x1a4d04, 2, 1 / 34, 0.5);      // the flower drifts
    g.nLandW = new Fr(s ^ 0x1a4d05, 2, 1 / 90, 0.5);      // the lake's shore
    g.nLandR = new Fr(s ^ 0x1a4d06, 2, 1 / 16, 0.5);      // rock, ground patches
  }
  LAND.noises = noises;

  // ---------------------------------------------------------------- the river
  // A fixed course from the Pod Hills' east shoulder (its head: a round pool under a cliff, the waterfall) south past
  // Nova Haven's east side to the lake under the Sky Isles, jittered by the seed and meandering (two sines along the arc,
  // faded at both ends). Sampled about every block; a 32-block grid of the samples answers the distance queries. The
  // water stands at sea level all the way (the valley is cut down to it: the generator fills it).
  const RIVER_CP = [[335, -258], [352, -205], [338, -150], [360, -95], [344, -45], [330, 0], [320, 42], [328, 86]];
  LAND.river = function (g) {
    if (g._landRiver) return g._landRiver;
    const rng = new VR.RNG((g.seed ^ 0x51a7e) >>> 0);
    const CP = RIVER_CP.map((p, i) => (i === 0 || i >= RIVER_CP.length - 2) ? p.slice() : [p[0] + (rng.next() - 0.5) * 20, p[1] + (rng.next() - 0.5) * 12]);
    const cr = (p0, p1, p2, p3, t) => { const t2 = t * t, t3 = t2 * t; return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); };
    const raw = [];
    for (let i = 0; i < CP.length - 1; i++) {
      const a = CP[Math.max(0, i - 1)], b = CP[i], c = CP[i + 1], d = CP[Math.min(CP.length - 1, i + 2)];
      const steps = Math.max(2, Math.round(Math.hypot(c[0] - b[0], c[1] - b[1]) * 2));
      for (let k = 0; k < steps; k++) { const t = k / steps; raw.push([cr(a[0], b[0], c[0], d[0], t), cr(a[1], b[1], c[1], d[1], t)]); }
    }
    raw.push(CP[CP.length - 1].slice());
    let L0 = 0; const sRaw = [0];
    for (let i = 1; i < raw.length; i++) { L0 += Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]); sRaw.push(L0); }
    const ph1 = rng.next() * 6.283, ph2 = rng.next() * 6.283;
    const off = [];
    for (let i = 0; i < raw.length; i++) {
      const s = sRaw[i], fade = ss(0, 50, s) * (1 - ss(L0 - 60, L0 - 10, s));
      const a = raw[Math.max(0, i - 1)], b = raw[Math.min(raw.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
      const m = (9 * Math.sin(s / 41 + ph1) + 4 * Math.sin(s / 15 + ph2)) * fade;
      off.push([raw[i][0] - dz / l * m, raw[i][1] + dx / l * m]);
    }
    const pts = [[off[0][0], off[0][1], 0]];
    let s = 0, acc = 0;
    for (let i = 1; i < off.length; i++) {
      const ax = off[i - 1][0], az = off[i - 1][1], bx = off[i][0], bz = off[i][1], l = Math.hypot(bx - ax, bz - az);
      let u = 1 - acc;
      while (u <= l) { const f = u / l; s += 1; pts.push([ax + (bx - ax) * f, az + (bz - az) * f, s]); u += 1; }
      acc = l - (u - 1);
    }
    const len = s, grid = new Map(), CELL = 32;
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    pts.forEach((p, i) => {
      const k = Math.floor(p[0] / CELL) * 100000 + Math.floor(p[1] / CELL);
      let a = grid.get(k); if (!a) { a = []; grid.set(k, a); } a.push(i);
      x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]);
    });
    const head = pts[0], h2 = pts[Math.min(pts.length - 1, 8)], hl = Math.hypot(h2[0] - head[0], h2[1] - head[1]) || 1;
    g._landRiver = { pts, len, grid, CELL, box: [x0, z0, x1, z1], head: [head[0], head[1]], dir0: [(h2[0] - head[0]) / hl, (h2[1] - head[1]) / hl] };
    return g._landRiver;
  };
  // the river's cross-section at arc t (0 head … 1 mouth): the water's half width and the bed
  LAND.riverWb = (t) => 2.3 + 2 * t;
  LAND.riverBed = (t) => SEA - 2.2 - 1.8 * t;
  LAND.HEAD_R = 7;                                  // the pool under the waterfall
  const RQ = { d: 0, s: 0, t: 0, i: 0 };
  // the nearest point of the river's line within `reach` blocks: {d, s, t, i} (shared object), or null
  LAND.riverAt = function (g, X, Z, reach) {
    const Rv = LAND.river(g), b = Rv.box, rr = reach || 70;
    if (X < b[0] - rr || X > b[2] + rr || Z < b[1] - rr || Z > b[3] + rr) return null;
    const C = Rv.CELL, ci = Math.floor(X / C), cj = Math.floor(Z / C), n = Math.ceil(rr / C);
    let best = rr * rr, bi = -1;
    for (let di = -n; di <= n; di++) for (let dj = -n; dj <= n; dj++) {
      const a = Rv.grid.get((ci + di) * 100000 + cj + dj); if (!a) continue;
      for (let k = 0; k < a.length; k++) { const p = Rv.pts[a[k]], dx = p[0] - X, dz = p[1] - Z, d2 = dx * dx + dz * dz; if (d2 < best) { best = d2; bi = a[k]; } }
    }
    if (bi < 0) return null;
    RQ.d = Math.sqrt(best); RQ.i = bi; RQ.s = Rv.pts[bi][2]; RQ.t = RQ.s / Rv.len;
    return RQ;
  };

  // ---------------------------------------------------------------- the lake under the Sky Isles
  // a warped ellipse round (345, 150): q is the shore-normalised distance (1 = the waterline), the bed shelves from 53
  // in the middle to 61 near the shore, a beach of about ten blocks, then the land
  LAND.LAKE = { x: 345, z: 150, rx: 122, rz: 104, a: 0.25 };
  LAND.lakeQ = function (g, X, Z) {
    const L = LAND.LAKE, dx = X - L.x, dz = Z - L.z;
    if (Math.abs(dx) > L.rx * 1.6 || Math.abs(dz) > L.rx * 1.6) return 9;
    noises(g);
    const ca = Math.cos(L.a), sa = Math.sin(L.a), u = dx * ca + dz * sa, v = -dx * sa + dz * ca;
    const q = Math.sqrt((u / L.rx) ** 2 + (v / L.rz) ** 2), th = Math.atan2(v, u), ph = (g.seed & 1023) / 163;
    return q * (1 + 0.09 * Math.sin(3 * th + ph) + 0.06 * Math.sin(5 * th + 2 * ph) + 0.17 * g.nLandW.n2(X * 1.3 + 900, Z * 1.3 - 900));
  };
  LAND.lakeH = (q, Hl) => q < 0.95 ? 53 + 8 * ss(0.2, 0.95, q) : q < 1.04 ? lerp(61, SEA + 1.4, (q - 0.95) / 0.09) : lerp(SEA + 1.4, Hl, ss(1.04, 1.22, q));

  // ---------------------------------------------------------------- the rocky ridge in the west
  LAND.RIDGE = [[-655, -75], [-618, 40], [-582, 168]];
  const RG = { d: 0, s: 0, t: 0 };
  LAND.ridgeAt = function (X, Z) {
    const P = LAND.RIDGE;
    if (X < -730 || X > -500 || Z < -150 || Z > 245) return null;
    let best = 1e9, bs = 0, acc = 0, total = 0;
    for (let i = 0; i + 1 < P.length; i++) total += Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]);
    for (let i = 0; i + 1 < P.length; i++) {
      const ax = P[i][0], az = P[i][1], bx = P[i + 1][0], bz = P[i + 1][1], vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz, l = Math.sqrt(l2);
      let f = ((X - ax) * vx + (Z - az) * vz) / l2; f = f < 0 ? 0 : f > 1 ? 1 : f;
      const px = ax + vx * f, pz = az + vz * f, d = Math.hypot(X - px, Z - pz);
      if (d < best) { best = d; bs = acc + f * l; }
      acc += l;
    }
    RG.d = best; RG.s = bs; RG.t = bs / total;
    return RG;
  };
  LAND.RIDGE_W = 58;
  LAND.ridgeLift = function (g, X, Z) {
    const q = LAND.ridgeAt(X, Z); if (!q || q.d > LAND.RIDGE_W) return 0;
    const hR = 34 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, q.t))), 0.6), f = 1 - ss(0, LAND.RIDGE_W, q.d);
    return hR * Math.pow(f, 1.6) + 6 * Math.abs(g.nLandR.n2(X * 0.5, Z * 0.5)) * Math.pow(f, 4) * (hR / 34);
  };

  // ---------------------------------------------------------------- the shapes in the Heartland's design
  // (after gen_hills' wrapper: the T8 hills lift first). The ridge lifts the land; the lake and the river valley lower
  // it — never raise it; the channel and its shelf are `river` (sand bed, the horizon's water), the bed's noise calmed.
  // At the river's head the valley ends in a round pool under a wall: upstream of the head nothing is lowered but the
  // pool, so the land stands as a cliff over it and the waterfall drops straight in.
  LAND.shape = function (g, X, Z, D) {
    noises(g);
    const lift = LAND.ridgeLift(g, X, Z);
    if (lift > 0) { D.H += lift; D.A = lerp(D.A, 3.4, Math.min(1, lift / 20)); D.ridge = lift; }
    const q = LAND.lakeQ(g, X, Z);
    if (q < 1.22) {
      const Hl = LAND.lakeH(q, D.H);
      if (Hl < D.H) { D.H = Hl; D.A = lerp(D.A, 0.8, 1 - ss(1.0, 1.22, q)); }
      D.lake = q;
    }
    const rq = LAND.riverAt(g, X, Z, 72);
    if (rq) {
      const Rv = LAND.river(g), t = rq.t, wb = LAND.riverWb(t), bed = LAND.riverBed(t), Hl = D.H;
      const hx = Rv.head[0], hz = Rv.head[1], along = (X - hx) * Rv.dir0[0] + (Z - hz) * Rv.dir0[1], dh = Math.hypot(X - hx, Z - hz);
      if (rq.s < 1 && along < 0) {
        // behind the head: only the pool (a near-vertical wall round it)
        if (dh < LAND.HEAD_R + 1.5) {
          const H = dh <= LAND.HEAD_R ? bed : lerp(bed, Hl, ss(LAND.HEAD_R, LAND.HEAD_R + 1.5, dh));
          if (H < D.H) D.H = H;
          D.river = Math.max(D.river, 1 - ss(LAND.HEAD_R - 1, LAND.HEAD_R + 0.5, dh)); D.A = lerp(D.A, 0.3, 1 - ss(LAND.HEAD_R, LAND.HEAD_R + 6, dh)); D.valley = dh / (LAND.HEAD_R + 1.5);
        } else if (dh < LAND.HEAD_R + 8) D.A = lerp(D.A, 0.4, 1 - ss(LAND.HEAD_R + 1.5, LAND.HEAD_R + 8, dh));   // (a clean wall: no noise in it)
      } else {
        const depth = Math.max(0, Hl - SEA), head = 1 - ss(0, 40, rq.s);
        const ws = lerp(Math.min(46, Math.max(12, 1.9 * depth)), Math.max(7, 0.42 * depth), head);
        const wbH = Math.max(wb, rq.s < 14 ? LAND.HEAD_R * (1 - ss(4, 14, rq.s)) : 0);   // the pool widens the head
        const d1 = wbH + 3, d2 = d1 + ws;
        if (rq.d < d2) {
          const H = rq.d <= wbH ? bed : rq.d <= d1 ? lerp(bed, SEA + 1.2, ss(wbH, d1, rq.d)) : lerp(SEA + 1.2, Hl, ss(d1, d2, rq.d));
          if (H < D.H) D.H = H;
          D.river = Math.max(D.river, 1 - ss(wbH + 1.5, wbH + 3.5, rq.d));
          D.A = lerp(D.A, 0.5, 1 - ss(d1, d2, rq.d));
          D.valley = rq.d / d2;
        }
      }
    }
    return D;
  };
  if (HEART.design && !HEART._landShape) {
    const prevDesign = HEART.design;
    HEART.design = function (g, X, Z) { const D = prevDesign(g, X, Z); if (D && LAND.on(g)) LAND.shape(g, X, Z, D); return D; };
    HEART._landShape = true;
  }

  // ---------------------------------------------------------------- the designed grounds
  // The land's pieces keep out of the sites the other modules build: 0 open land, else the reason — the fixed boxes of
  // the temple, the city, the hills, the station (exact), and from the design on a 16-block grid (made once per world
  // and worker, no village plan asked: every worker answers the same) the canyon's mesas, the citadel's mountain, the
  // station's peaks and the lake.
  const TB = () => VR.TempleGen && VR.TempleGen.box;
  LAND.CITYBOX = { x0: -132, x1: 128, z0: -186, z1: -4 };           // Nova Haven's owned cells (x −124…120, z −176…−10) and a margin
  const ZC = 16, ZN = 96, Z0 = -ZC * ZN / 2;
  LAND.zones = function (g) {
    if (g._landZones) return g._landZones;
    const Zr = new Uint8Array(ZN * ZN);
    for (let j = 0; j < ZN; j++) for (let i = 0; i < ZN; i++) {
      const X = Z0 + i * ZC + ZC / 2, Z = Z0 + j * ZC + ZC / 2;
      if (X * X + Z * Z > 780 * 780) { Zr[j * ZN + i] = 9; continue; }
      const D = HEART.design(g, X, Z);
      Zr[j * ZN + i] = !D ? 9 : D.peak > 0.15 ? 4 : D.mount > 0.12 ? 6 : (D.cz > 0.22 && D.plat < 0.5) ? 5 : (D.lake !== undefined && D.lake < 1.03) ? 7 : 0;
    }
    return (g._landZones = Zr);
  };
  LAND.zoneAt = function (g, x, z) {
    const d2 = x * x + z * z;
    if (d2 > 760 * 760) return 9;
    const T = TB(); if (T && x >= T.x0 - 6 && x <= T.x1 + 6 && z >= T.z0 - 6 && z <= T.z1 + 6) return 1;
    const C = LAND.CITYBOX; if (x >= C.x0 && x <= C.x1 && z >= C.z0 && z <= C.z1) return 2;
    const HB = VR.HillsGen && VR.HillsGen.box; if (HB && x >= HB.x0 - 4 && x <= HB.x1 + 4 && z >= HB.z0 - 4 && z <= HB.z1 + 4) return 3;
    const T8 = VR.HillsGen && VR.HillsGen.T8; if (T8 && x >= T8.x0 - 4 && x <= T8.x1 + 4 && z >= T8.z0 - 4 && z <= T8.z1 + 4) return 3;
    const SB = VR.StationGen && VR.StationGen.box; if (SB && x >= SB.x0 && x <= SB.x1 && z >= SB.z0 && z <= SB.z1) return 4;
    const Ci = HEART.CITADEL; if ((x - Ci.x) ** 2 + (z - Ci.z) ** 2 < 126 * 126) return 6;
    const i = Math.floor((x - Z0) / ZC), j = Math.floor((z - Z0) / ZC);
    if (i < 0 || j < 0 || i >= ZN || j >= ZN) return 9;
    const zr = LAND.zones(g)[j * ZN + i];
    if (zr === 5) { const CB = VR.CanyonGen && VR.CanyonGen.box; if (!CB || (x >= CB.x0 - 40 && x <= CB.x1 + 140 && z >= CB.z0 - 30)) return 5; }
    return zr === 7 ? 0 : zr;   // (the lake is water: its own rules)
  };
  // the citadel's viaducts run low near its plinth: no tree, path or piece under their first stretch
  const nearViaduct = (g, x, z) => {
    const C = HEART.CITADEL;
    if ((x - C.x) ** 2 + (z - C.z) ** 2 > 330 * 330) return false;
    for (const [tx, tz] of [[0, 150], [C.x + 300, C.z + 60]]) {
      const a = Math.atan2(tz - C.z, tx - C.x), ux = Math.cos(a), uz = Math.sin(a), rx = x - C.x, rz = z - C.z, along = rx * ux + rz * uz;
      if (along > 20 && along < 340 && Math.abs(-rx * uz + rz * ux) < 8) return true;
    }
    return false;
  };
  LAND.nearViaduct = nearViaduct;

  // ---------------------------------------------------------------- no rubble in the land
  // The overworld's random ruined gates (obsidian frames on rubble) stood about the empty meadow like litter: in the land
  // between (vgen ≥ 10, inside the designed Heartland) the features of a chunk build none (their draws are made all the
  // same: the rest of the chunk's features stay where they were).
  const STR = GEN.STRUCT;
  if (STR && STR.ruinedGate && !STR._landRuin) {
    const prevRuin = STR.ruinedGate;
    STR.ruinedGate = function () { if (LAND._noRuin) return; return prevRuin.apply(this, arguments); };
    STR._landRuin = true;
    const prevFeat = OG.features;
    OG.features = function (w, fcx, fcz, chests) {
      if (!LAND.on(this) || !HEART.noRandom(this, fcx * 16 + 8, fcz * 16 + 8)) return prevFeat.call(this, w, fcx, fcz, chests);
      LAND._noRuin = true;
      try { return prevFeat.call(this, w, fcx, fcz, chests); } finally { LAND._noRuin = false; }
    };
  }

  // ============================================================================ the land plan
  // Built once per world (per worker) from the terrain functions alone — no village site or plan is asked (a worker
  // job that met a missing one would stop: VG.probe), so the plan is the same in every thread.
  // A site: [id, x, z, kind]. The temple's plaza joins its two anchors, Nova Haven's crescent its two ends: the network
  // routes no way between them. The crossroads are junctions in the open land (the shrine stands at the west one).
  LAND.SITES = [
    ['temple_w', -72, 82, 'temple'], ['temple_e', 90, 82, 'temple'], ['city_w', -118, -96, 'city'], ['city_e', 119, -96, 'city'],
    ['hills_w', -296, -300, 'hills'], ['hills_e', 292, -322, 'hills'], ['station', -290, -126, 'station'], ['canyon', -246, 112, 'canyon'],
    ['citadel', -506, 288, 'citadel'], ['beach', 0, 0, 'beach'], ['falls', 0, 0, 'falls'],
    ['farm_c', 214, -52, 'farm'], ['farm_w', -478, 38, 'farm'], ['farm_n', -96, -556, 'farm'], ['farm_e', 528, -236, 'farm'],
    ['lookout', -618, 40, 'lookout'], ['cross_w', -336, 28, 'cross'], ['cross_n', -262, -470, 'cross'], ['cross_e', 246, -150, 'cross'],
    ['meadow_e', 446, -108, 'cross'], ['east', 590, 40, 'grove'], ['shore_s', 0, 0, 'shore'],
  ];
  LAND.JOINED = [['temple_w', 'temple_e'], ['city_w', 'city_e']];
  LAND.MUST = [['cross_e', 'meadow_e']];       // (a way over the river: its stone bridge)
  // the cost grid for the routes: 16-block cells over the Heartland
  const GC = 16, GN = 88, G0 = -GC * GN / 2;
  const inBox = (x, z, b, m) => x >= b.x0 - m && x <= b.x1 + m && z >= b.z0 - m && z <= b.z1 + m;
  function costGrid(g) {
    const H = new Float32Array(GN * GN), K = new Float32Array(GN * GN), W = new Uint8Array(GN * GN);
    for (let j = 0; j < GN; j++) for (let i = 0; i < GN; i++) {
      const X = G0 + i * GC + GC / 2, Z = G0 + j * GC + GC / 2, k = j * GN + i;
      const D = Math.hypot(X, Z) > 660 ? null : HEART.design(g, X, Z);
      let kk = 1;
      if (!D) kk = Infinity;
      else {
        H[k] = D.H;
        const zn = LAND.zoneAt(g, X, Z);
        if (zn) kk = Infinity;
        else if (D.peak > 0.2 || D.mount > 0.3) kk = Infinity;
        else if (D.cz > 0.25 && D.plat < 0.5) kk = Infinity;
        else if (D.lake !== undefined && D.lake < 1.06) kk = Infinity;
        else if (nearViaduct(g, X, Z)) kk = Infinity;
        else if (D.H < SEA + 0.5) { W[k] = D.river > 0.5 ? 1 : 2; kk = W[k] === 1 ? 4 : 6; }
        else if (D.ridge > 8) kk = 1.5;
      }
      K[k] = kk;
    }
    return { H, K, W };
  }
  // A* from cell a to cell b (8 neighbours), the cost of a step its length times the cell factor and a slope charge;
  // cells already on a path cost less (the routes merge into a network)
  const AS = { gs: null, from: null, shut: null, hk: null, hv: null };
  function astar(G, a, b, used) {
    const N = GN * GN;
    if (!AS.gs) { AS.gs = new Float64Array(N); AS.from = new Int32Array(N); AS.shut = new Uint8Array(N); AS.hk = new Int32Array(N * 8); AS.hv = new Float64Array(N * 8); }
    const gs = AS.gs.fill(Infinity), from = AS.from.fill(-1), shut = AS.shut.fill(0), hk = AS.hk, hv = AS.hv;
    let hn = 0;
    const push = (k, f) => { let i = hn++; while (i > 0) { const p = (i - 1) >> 1; if (hv[p] <= f) break; hk[i] = hk[p]; hv[i] = hv[p]; i = p; } hk[i] = k; hv[i] = f; };
    const pop = () => { const top = hk[0]; hn--; if (hn > 0) { const lk = hk[hn], lv = hv[hn]; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = -1, mv = lv; if (l < hn && hv[l] < mv) { m = l; mv = hv[l]; } if (r < hn && hv[r] < mv) { m = r; mv = hv[r]; } if (m < 0) break; hk[i] = hk[m]; hv[i] = hv[m]; i = m; } hk[i] = lk; hv[i] = lv; } return top; };
    const bi = b % GN, bj = (b / GN) | 0, hz = (k) => Math.hypot((k % GN) - bi, ((k / GN) | 0) - bj) * GC * 0.5;
    gs[a] = 0; push(a, hz(a));
    while (hn > 0) {
      const k = pop(); if (shut[k]) continue; shut[k] = 1;
      if (k === b) break;
      const i = k % GN, j = (k / GN) | 0, hk0 = G.H[k];
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= GN || nj >= GN) continue;
        const n = nj * GN + ni; if (shut[n]) continue;
        const kf = n === b ? 1 : G.K[n]; if (kf === Infinity) continue;
        // (a diagonal step may not cut the corner of a blocked cell)
        if (di && dj && (G.K[j * GN + ni] === Infinity || G.K[nj * GN + i] === Infinity) && n !== b) continue;
        const len = (di && dj) ? GC * 1.4142 : GC, sl = Math.abs(G.H[n] - hk0) / len;
        if (sl > 0.62 && n !== b && k !== a) continue;
        let c = len * kf * (1 + 7 * Math.max(0, sl - 0.06) + 30 * Math.max(0, sl - 0.3));
        if (G.W[n] === 1) c += 36; else if (G.W[n] === 2) c += 90;
        if (used && used[n]) c *= 0.5;
        const ng = gs[k] + c; if (ng < gs[n] && hn < hk.length) { gs[n] = ng; from[n] = k; push(n, ng + hz(n)); }
      }
    }
    if (!(gs[b] < Infinity)) return null;
    const cells = []; for (let k = b; k >= 0; k = from[k]) { cells.push(k); if (k === a) break; }
    return { cost: gs[b], cells: cells.reverse() };
  }
  const cellOf = (x, z) => Math.max(0, Math.min(GN - 1, Math.floor((z - G0) / GC))) * GN + Math.max(0, Math.min(GN - 1, Math.floor((x - G0) / GC)));
  const cellXZ = (k) => [G0 + (k % GN) * GC + GC / 2, G0 + ((k / GN) | 0) * GC + GC / 2];

  // the lake's shore point in a direction (from its centre), q = qWant: the beach, the lighthouse, the fishing hut
  LAND.shoreAt = function (g, ang, qWant) {
    const L = LAND.LAKE;
    let lo = 20, hi = 260;
    for (let it = 0; it < 30; it++) { const r = (lo + hi) / 2, q = LAND.lakeQ(g, L.x + Math.cos(ang) * r, L.z + Math.sin(ang) * r); if (q < qWant) lo = r; else hi = r; }
    const r = (lo + hi) / 2;
    return [Math.round(L.x + Math.cos(ang) * r), Math.round(L.z + Math.sin(ang) * r)];
  };
  // the waterfall over the river's head: the rim behind the pool, the spring there and the line the water drops on
  LAND.falls = function (g) {
    if (g._landFalls) return g._landFalls;
    const Rv = LAND.river(g), [hx, hz] = Rv.head, [ux, uz] = Rv.dir0;
    // the wall's top: walking back from the head, the first block whose ground stands 8 over the pool's water
    let r = LAND.HEAD_R, top = 0;
    for (; r < LAND.HEAD_R + 12; r++) { top = g.surfaceY(Math.round(hx - ux * r), Math.round(hz - uz * r)); if (top > SEA + 8) break; }
    const ex = Math.round(hx - ux * (r - 1)), ez = Math.round(hz - uz * (r - 1));      // the first cell out over the pool
    const sx = Math.round(hx - ux * (r + 3)), sz = Math.round(hz - uz * (r + 3));      // the spring
    const sy = Math.min(g.surfaceY(sx, sz), top) - 1;                                    // its water's level
    g._landFalls = { head: [Math.round(hx), Math.round(hz)], dir: [ux, uz], edge: [ex, ez], spring: [sx, sz], top: sy, rim: r };
    return g._landFalls;
  };
  // the sites of a world: the fixed ones, the farms a little moved by the seed, the beach and the falls found on the
  // lake's shore and over the river's head
  LAND.sites = function (g) {
    const rng = new VR.RNG((g.seed ^ 0x5173) >>> 0), Fa = LAND.falls(g);
    return LAND.SITES.map(([id, x, z, kind]) => {
      const j = kind === 'farm' ? 22 : 0;
      let sx = Math.round(x + (rng.next() - 0.5) * j), sz = Math.round(z + (rng.next() - 0.5) * j);
      if (kind === 'beach') { const L = LAND.LAKE; [sx, sz] = LAND.shoreAt(g, Math.atan2(30 - L.z, 230 - L.x), 1.2); }
      if (kind === 'shore') { const L = LAND.LAKE; [sx, sz] = LAND.shoreAt(g, Math.atan2(290 - L.z, 420 - L.x), 1.22); }
      if (kind === 'falls') { const [ux, uz] = Fa.dir; sx = Math.round(Fa.spring[0] - uz * 9 - ux * 2); sz = Math.round(Fa.spring[1] + ux * 9 - uz * 2); }
      return { id, x: sx, z: sz, kind };
    });
  };
  // the network: the 3 nearest sites of every site are candidates, routed by A*; a minimum spanning tree over the
  // routes' costs (the joined pairs count as one), then the shortcuts that save more than 40 % of the way round the
  // tree; then every route again in order, merging into the ways laid before it: a route ends where it meets one
  LAND.network = function (g, sites) {
    const G = costGrid(g), n = sites.length, cand = new Map();
    const key = (a, b) => a < b ? a * 100 + b : b * 100 + a;
    const idx = (id) => sites.findIndex(s => s.id === id);
    const joined = new Set(LAND.JOINED.map(([p, q]) => key(idx(p), idx(q))));
    for (let a = 0; a < n; a++) {
      const near = sites.map((s, b) => [Math.hypot(s.x - sites[a].x, s.z - sites[a].z), b]).filter(q => q[1] !== a && !joined.has(key(a, q[1]))).sort((p, q) => p[0] - q[0]).slice(0, 3);
      for (const [, b] of near) cand.set(key(a, b), [Math.min(a, b), Math.max(a, b)]);
    }
    for (const [p, q] of LAND.MUST) { const a = idx(p), b = idx(q); if (a >= 0 && b >= 0) cand.set(key(a, b), [Math.min(a, b), Math.max(a, b)]); }
    const routes = [];
    for (const [a, b] of cand.values()) {
      const r = astar(G, cellOf(sites[a].x, sites[a].z), cellOf(sites[b].x, sites[b].z), null);
      if (r) routes.push({ a, b, cost: r.cost, cells: r.cells });
    }
    // Kruskal (the joined pairs start as one)
    const par = sites.map((_, i) => i), find = (i) => par[i] === i ? i : (par[i] = find(par[i]));
    for (const [p, q] of LAND.JOINED) { const a = find(idx(p)), b = find(idx(q)); if (a !== b) par[a] = b; }
    const tree = [], rest = [];
    for (const r of routes.slice().sort((p, q) => p.cost - q.cost)) { const fa = find(r.a), fb = find(r.b); if (fa !== fb) { par[fa] = fb; tree.push(r); } else rest.push(r); }
    const adj = sites.map(() => []);
    for (const r of tree) { adj[r.a].push([r.b, r.cost]); adj[r.b].push([r.a, r.cost]); }
    for (const [p, q] of LAND.JOINED) { adj[idx(p)].push([idx(q), 0]); adj[idx(q)].push([idx(p), 0]); }
    const treeCost = (a, b) => { const best = new Map([[a, 0]]), stk = [a]; while (stk.length) { const u = stk.pop(); for (const [v, w] of adj[u]) { const c = best.get(u) + w; if (!(best.get(v) <= c)) { best.set(v, c); stk.push(v); } } } return best.has(b) ? best.get(b) : Infinity; };
    const edges = tree.slice();
    for (const [p, q] of LAND.MUST) { const k = key(idx(p), idx(q)); let r = rest.find(e => key(e.a, e.b) === k); if (r) rest.splice(rest.indexOf(r), 1); else r = tree.find(e => key(e.a, e.b) === k); if (r) { r.must = true; if (!edges.includes(r)) edges.push(r); } }
    for (const r of rest.sort((p, q) => p.cost - q.cost)) { if (edges.length >= tree.length + 3 + LAND.MUST.length) break; if (r.cost < 0.6 * treeCost(r.a, r.b)) edges.push(r); }
    // the final routes, cheapest first, each merging into the ways laid before it
    const used = new Int16Array(GN * GN).fill(-1), out = [];
    edges.sort((p, q) => p.cost - q.cost).forEach((r) => {
      const rr = astar(G, cellOf(sites[r.a].x, sites[r.a].z), cellOf(sites[r.b].x, sites[r.b].z), r.must ? null : used.map(v => v >= 0 ? 1 : 0)) || r;
      const cells = rr.cells, m = cells.length;
      // the runs of cells no way has yet (the route's own ends always count as new), each with the used cell before
      // and after it: a run that does not start (end) at a site starts (ends) on the way it meets
      const isNew = (k) => r.must || k === 0 || k === m - 1 || used[cells[k]] < 0;
      for (let k = 0; k < m;) {
        if (!isNew(k)) { k++; continue; }
        let j = k; while (j + 1 < m && isNew(j + 1)) j++;
        const s0 = k > 0 ? k - 1 : 0, s1 = j < m - 1 ? j + 1 : j;
        if (s1 > s0 || k === 0 || j === m - 1) {
          const id = out.length;
          out.push({ a: r.a, b: r.b, cells: cells.slice(s0, s1 + 1), endA: s0 === 0 ? r.a : -1, endB: s1 === m - 1 ? r.b : -1 });
          for (let q = s0; q <= s1; q++) if (used[cells[q]] < 0) used[cells[q]] = id;
        }
        k = j + 1;
      }
    });
    return out;
  };
  // a route's line: its ends (a site, or the nearest point of a way laid before) and the cell centres between, smoothed
  // three times (Chaikin), then a point every block
  function routeLine(sites, r, snap) {
    const first = r.endA >= 0 ? [sites[r.endA].x, sites[r.endA].z] : snap(cellXZ(r.cells[0]));
    const last = r.endB >= 0 ? [sites[r.endB].x, sites[r.endB].z] : snap(cellXZ(r.cells[r.cells.length - 1]));
    let P = [first];
    for (let i = 1; i < r.cells.length - 1; i++) P.push(cellXZ(r.cells[i]));
    P.push(last);
    for (let it = 0; it < 3; it++) {
      const Q = [P[0]];
      for (let i = 0; i + 1 < P.length; i++) { const a = P[i], b = P[i + 1]; Q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); }
      Q.push(P[P.length - 1]); P = Q;
    }
    const out = [[P[0][0], P[0][1]]];
    let acc = 0;
    for (let i = 1; i < P.length; i++) {
      const ax = P[i - 1][0], az = P[i - 1][1], bx = P[i][0], bz = P[i][1], l = Math.hypot(bx - ax, bz - az);
      let u = 1 - acc;
      while (u <= l) { const f = u / l; out.push([ax + (bx - ax) * f, az + (bz - az) * f]); u += 1; }
      acc = l - (u - 1);
    }
    const e = P[P.length - 1]; if (Math.hypot(out[out.length - 1][0] - e[0], out[out.length - 1][1] - e[1]) > 0.3) out.push([e[0], e[1]]);
    return out;
  }
  LAND.SLOPE = 0.4;   // the path's grade along its line: one block up in two and a half
  // the profile of a line over the land: the ground smoothed, a bridge deck over water (over the river a stone arch at
  // SEA + 5, else a boardwalk at SEA + 2), the grade limited both ways (the decks are floors the limit keeps)
  function profile(g, pts) {
    const n = pts.length, gr = new Float64Array(n), wet = new Uint8Array(n), floor = new Float64Array(n).fill(-1e9);
    for (let i = 0; i < n; i++) {
      const x = Math.round(pts[i][0]), z = Math.round(pts[i][1]);
      if ((i & 1) && i < n - 1) continue;
      const y = g.surfaceY(x, z);
      gr[i] = y;
      if (y < SEA) { const rq = LAND.riverAt(g, x, z, 14); wet[i] = rq && rq.d < Math.max(LAND.riverWb(rq.t), rq.s < 14 ? LAND.HEAD_R : 0) + 2.5 ? 1 : 2; }
    }
    for (let i = 1; i < n - 1; i += 2) { gr[i] = (gr[i - 1] + gr[i + 1]) / 2; const a = wet[i - 1], b = wet[i + 1]; wet[i] = a && b ? Math.min(a, b) : (a || b); }
    for (let i = 0; i < n; i++) if (wet[i]) floor[i] = SEA + (wet[i] === 1 ? 5 : 2);
    for (let i = 0; i < n; i++) if (wet[i] === 1) for (let k = -3; k <= 3; k++) { const q = i + k; if (q >= 0 && q < n && !wet[q]) floor[q] = Math.max(floor[q], SEA + 5); }
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) { let s = 0, c = 0; for (let k = -4; k <= 4; k++) { const q = i + k; if (q >= 0 && q < n) { s += wet[q] ? floor[q] : gr[q]; c++; } } y[i] = s / c; }
    const env = new Float64Array(n).fill(-1e9), L = LAND.SLOPE;
    for (let i = 0; i < n; i++) if (floor[i] > -1e8) { const r = Math.ceil(30 / L); for (let q = Math.max(0, i - r); q < Math.min(n, i + r); q++) { const v = floor[i] - L * Math.abs(q - i); if (v > env[q]) env[q] = v; } }
    for (let i = 0; i < n; i++) if (y[i] < env[i]) y[i] = env[i];
    for (let i = 1; i < n; i++) y[i] = Math.min(Math.max(y[i], y[i - 1] - L), y[i - 1] + L);
    for (let i = n - 2; i >= 0; i--) y[i] = Math.min(Math.max(y[i], y[i + 1] - L), y[i + 1] + L);
    return { gr, wet, y };
  }
  LAND._profile = profile;
  function nearWet(wet, i) { for (let k = -6; k <= 6; k++) if (wet[i + k] === 1) return true; return false; }

  // ---------------------------------------------------------------- the keep raster
  // 2-block cells over the Heartland: what the woods and the meadows leave alone (bits: 1 a way, 2 a piece, 4 a field,
  // 8 a clearing, 16 a pond's water)
  const KC = 2, KN = 760, K0 = -KC * KN / 2;
  LAND.KEEP = { WAY: 1, PIECE: 2, FIELD: 4, CLEAR: 8, POND: 16 };
  const keepIdx = (x, z) => { const i = Math.floor((x - K0) / KC), j = Math.floor((z - K0) / KC); return i < 0 || j < 0 || i >= KN || j >= KN ? -1 : j * KN + i; };
  LAND.keepAt = (P, x, z) => { const k = keepIdx(x, z); return k < 0 ? 0 : P.keep[k]; };
  const markKeep = (P, x0, z0, x1, z1, bit) => { for (let z = Math.floor(z0); z <= z1; z += KC) for (let x = Math.floor(x0); x <= x1; x += KC) { const k = keepIdx(x, z); if (k >= 0) P.keep[k] |= bit; } const k = keepIdx(x1, z1); if (k >= 0) P.keep[k] |= bit; };
  const markDisc = (P, x, z, r, bit) => { for (let dz = -r; dz <= r; dz += KC) for (let dx = -r; dx <= r; dx += KC) if (dx * dx + dz * dz <= r * r) { const k = keepIdx(x + dx, z + dz); if (k >= 0) P.keep[k] |= bit; } };
  LAND._markKeep = markKeep; LAND._markDisc = markDisc;

  // ---------------------------------------------------------------- the ops of the pieces, per chunk
  // a piece writes through put(x, y, z, state) (0: air); the ops land in the chunk's bucket and are stamped in order
  function opsOf(P) {
    const put = (x, y, z, s) => { if (y < 1 || y > 254) return; const k = chunkKey(x, z); let b = P.ops.get(k); if (!b) { b = []; P.ops.set(k, b); } b.push(x, y, z, s); };
    const fill = (x, z, y0, y1, s) => { for (let y = y0; y <= y1; y++) put(x, y, z, s); };
    return { put, fill };
  }
  LAND._opsOf = opsOf;
  // the ground under a column, natural (the generator's density top; cached per plan)
  function groundOf(g, P) { return (x, z) => { const k = ck(x, z); let y = P.gy.get(k); if (y === undefined) { y = g.surfaceY(x, z); P.gy.set(k, y); } return y; }; }

  // ---------------------------------------------------------------- the plan
  LAND.PIECES = [];          // the set pieces' makers (later sections): fn(g, P, K) → pushes into P.pieces, writes ops
  LAND.plan = function (g) {
    if (g._landPlan) return g._landPlan;
    noises(g);
    const t0 = Date.now();
    const sites = LAND.sites(g);
    const routes = LAND.network(g, sites);
    const P = { sites, routes, lines: [], cells: new Map(), byChunk: new Map(), ops: new Map(), spawns: new Map(), furn: [], pieces: [], keep: new Uint8Array(KN * KN), gy: new Map(), ms: 0 };
    const cells = P.cells;
    // the ways laid so far (their points, every 4th, on a 16-block grid): a route that meets one snaps to its nearest point
    const wayPts = new Map();
    const snap = (p) => { let best = 1e18, bp = p; const ci = Math.floor(p[0] / 16), cj = Math.floor(p[1] / 16); for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) { const a = wayPts.get((ci + di) * 4096 + cj + dj); if (!a) continue; for (const q of a) { const d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2; if (d < best) { best = d; bp = q; } } } return [bp[0], bp[1]]; };
    const addWay = (pts) => { for (let i = 0; i < pts.length; i += 2) { const k = Math.floor(pts[i][0] / 16) * 4096 + Math.floor(pts[i][1] / 16); let a = wayPts.get(k); if (!a) { a = []; wayPts.set(k, a); } a.push(pts[i]); } };
    const near = (kinds, x, z, r) => sites.some(s => kinds.includes(s.kind) && (s.x - x) ** 2 + (s.z - z) ** 2 < r * r);
    routes.forEach((r, ri) => {
      const pts = routeLine(sites, r, snap); addWay(pts);
      const pr = profile(g, pts);
      const deck = new Uint8Array(pts.length);
      for (let i = 0; i < pts.length; i++) deck[i] = pr.wet[i] ? (pr.wet[i] === 1 ? 2 : 1) : pr.y[i] - pr.gr[i] > 3 ? (nearWet(pr.wet, i) ? 2 : 1) : 0;
      // the surface along the way: the city's white paving near its ends and the temple's, flagstones a little further
      // and at the farms, then the earth path
      const pave = new Uint8Array(pts.length);
      for (let i = 0; i < pts.length; i++) { const [px, pz] = pts[i]; pave[i] = near(['temple', 'city'], px, pz, 26) ? 2 : near(['temple', 'city'], px, pz, 64) || near(['farm'], px, pz, 34) ? 1 : 0; }
      const L = { a: r.a, b: r.b, pts, y: pr.y, wet: pr.wet, gr: pr.gr, deck, pave };
      P.lines.push(L);
      for (let i = 0; i < pts.length; i++) {
        const [px, pz] = pts[i];
        for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
          const x = Math.round(px) + dx, z = Math.round(pz) + dz, d = Math.hypot(x - px, z - pz);
          if (d > 1.45) continue;
          if (LAND.zoneAt(g, x, z) && !near(['temple', 'city'], x, z, 14)) continue;   // (the plaza and the streets are the way there)
          const k = ck(x, z), c = cells.get(k);
          if (c && c.d <= d) continue;
          cells.set(k, { x, z, d, y: Math.round(pr.y[i]), line: ri, i, deck: deck[i], pave: pave[i] });
        }
      }
    });
    // no step of more than one block between neighbouring cells: the decks' heights are floors (raised to, never
    // lowered from), every other cell is lowered to one over its lowest neighbour
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const lb = new Map(), q = [];
    for (const c of cells.values()) if (c.deck) { lb.set(ck(c.x, c.z), c.y); q.push(c); }
    for (let qi = 0; qi < q.length; qi++) { const c = q[qi], v = lb.get(ck(c.x, c.z)) - 1; for (const [dx, dz] of nb) { const n = cells.get(ck(c.x + dx, c.z + dz)); if (!n) continue; const k = ck(n.x, n.z); if (!(lb.get(k) >= v)) { lb.set(k, v); q.push(n); } } }
    for (const c of cells.values()) { const v = lb.get(ck(c.x, c.z)); if (v !== undefined && c.y < v) c.y = v; }
    for (let it = 0, ch = 1; ch && it < 80; it++) {
      ch = 0;
      for (const c of cells.values()) {
        let m = Infinity; for (const [dx, dz] of nb) { const n = cells.get(ck(c.x + dx, c.z + dz)); if (n && n.y < m) m = n.y; }
        if (c.y > m + 1) { const v = Math.max(m + 1, lb.has(ck(c.x, c.z)) ? lb.get(ck(c.x, c.z)) : -1e9); if (v < c.y) { c.y = v; ch = 1; } }
      }
    }
    for (const c of cells.values()) { const k = chunkKey(c.x, c.z); let a = P.byChunk.get(k); if (!a) { a = []; P.byChunk.set(k, a); } a.push(c); markKeep(P, c.x - 1, c.z - 1, c.x + 1, c.z + 1, LAND.KEEP.WAY); }
    // ---- along the ways: a lantern every 12 blocks (sides in turn), a bench and a milestone every 40
    furnish(g, P);
    // ---- the set pieces (farms, water, rocks — the later sections)
    const K = opsOf(P);
    for (const fn of LAND.PIECES) { try { fn(g, P, K); } catch (e) { if (VR.VillageGen && VR.VillageGen.probe && e === VR.VillageGen.probe) throw e; if (!g._landErr) { g._landErr = 1; console.warn('land piece', e); } } }
    P.ms = Date.now() - t0;
    g._landPlan = P;
    return P;
  };
  const FACE4 = (dx, dz) => Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 1 : 3) : (dz > 0 ? 2 : 0);   // north 0 (−z), east 1, south 2, west 3
  LAND.FACE4 = FACE4;
  function furnish(g, P) {
    const gy = groundOf(g, P);
    const free = (x, z) => !P.cells.has(ck(x, z)) && !LAND.zoneAt(g, x, z);
    P.lines.forEach((L, li) => {
      const n = L.pts.length;
      const tan = (i) => { const a = L.pts[Math.max(0, i - 2)], b = L.pts[Math.min(n - 1, i + 2)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; return [dx / l, dz / l]; };
      for (let i = 6; i < n - 4; i++) {
        const lamp = (i - 6) % 12 === 0, rest = (i - 20) % 40 === 0;
        if (!lamp && !rest) continue;
        const [tx, tz] = tan(i), nx = -tz, nz = tx, side = (((i / 12) | 0) & 1) ? 1 : -1, [px, pz] = L.pts[i], y = Math.round(L.y[i]);
        if (L.deck[i]) {
          // on a bridge: the lantern on the parapet (its edge cell), nothing else
          if (!lamp) continue;
          for (const sd of [side, -side]) {
            const x = Math.round(px + nx * sd * 1.2), z = Math.round(pz + nz * sd * 1.2), c = P.cells.get(ck(x, z));
            if (c && c.deck && c.d > 0.9) { P.furn.push({ kind: 'lamp_deck', x, z, y: c.y }); break; }
          }
          continue;
        }
        const place = (kind, sd, face) => {
          for (const off of [2.6, 3.4]) {
            const x = Math.round(px + nx * sd * off), z = Math.round(pz + nz * sd * off);
            if (!free(x, z)) continue;
            const g0 = gy(x, z); if (Math.abs(g0 - y) > 2 || g0 <= SEA) continue;
            P.furn.push({ kind, x, z, y: g0, face, line: li, i });
            P.keep[keepIdx(x, z)] |= LAND.KEEP.PIECE;
            return true;
          }
          return false;
        };
        if (lamp) place('lamp', side, 0);
        if (rest) { place('bench', -side, FACE4(nx * side, nz * side)); place('stone', side, 0); }
      }
    });
  }

  // ---------------------------------------------------------------- per chunk: the plan's pieces stamped
  // The land's own blocks go over natural ground only: what another module built stays as it is.
  let NAT = null;
  const natural = () => {
    if (NAT) return NAT;
    const names = ['grass_block', 'dirt', 'coarse_dirt', 'podzol', 'rooted_dirt', 'mud', 'clay', 'sand', 'red_sand', 'gravel', 'stone', 'deepstone', 'andesite', 'diorite', 'granite', 'tuff', 'calcite', 'sandstone', 'moss_block', 'snow', 'snow_block', 'dirt_path'];
    const T = R.T, n = T.type.length, ids = new Set(names.map(nm => R.byName[nm] && R.byName[nm].id).filter(v => v !== undefined));
    NAT = new Uint8Array(n);
    for (let s = 1; s < n; s++) { const fl = T.flags[s]; if (ids.has(T.type[s])) NAT[s] = 1; else if ((fl & F.PLANT) && !(fl & F.SOLID)) NAT[s] = 2; }
    return NAT;
  };
  LAND.natural = natural;
  let MAT = null;
  const mats = () => MAT || (MAT = {
    PATH: st('dirt_path'), COARSE: st('coarse_dirt'), GRAVEL: st('gravel'), DIRT: st('dirt'), GRASS: st('grass_block'), FLAG: st('flagstone'), PLAZA: st('vx_floor_plaza') || st('flagstone'),
    PLANK: st('spruce_planks'), PFENCE: st('spruce_fence'), PLOG: st('spruce_log', { axis: 0 }), BRICK: st('stone_bricks'), MBRICK: st('mossy_stone_bricks'), BWALL: st('stone_brick_wall'), STONE: st('stone'),
    FENCE: st('oak_fence'), LANTERN: st('lantern', { hanging: 0 }), MILE: st('chiseled_stone_bricks'), MOSSC: st('moss_carpet'), WATER: st('water'),
    BENCH: [0, 1, 2, 3].map(f => st('vx_bench', { facing: f })),
  });
  LAND.mats = mats;
  // the top of a column (the highest block that is not air, a plant or leaves), from y0 down
  const topOf = (blocks, col, y0) => { const T = R.T; for (let y = y0; y > 1; y--) { const b = blocks[(y << 8) | col]; if (b && !((T.flags[b] & F.PLANT) && !(T.flags[b] & F.SOLID)) && !(T.flags[b] & F.LEAVES)) return y; } return 0; };
  LAND.topOf = topOf;
  function stampWays(g, P, cx, cz, blocks) {
    const list = P.byChunk.get(cx * 4096 + cz); if (!list) return;
    const NATv = natural(), K = mats(), x0 = cx * 16, z0 = cz * 16, T = R.T;
    for (const c of list) {
      const lx = c.x - x0, lz = c.z - z0, col = (lz << 4) | lx, y = c.y;
      if (y < 2 || y > 250) continue;
      if (c.deck) { stampDeck(g, P, c, blocks, col, K); continue; }
      const yT = topOf(blocks, col, Math.min(254, y + 14));
      const top = blocks[(yT << 8) | col];
      if (top && NATv[top] !== 1 && !(T.flags[top] & F.FLUID)) continue;          // a designed block: not ours
      if (T.flags[top] & F.FLUID) continue;                                         // (water: a deck's job)
      // fill up to the way, or cut down to it (natural blocks only)
      for (let yy = yT + 1; yy < y; yy++) { const i = (yy << 8) | col; if (!blocks[i] || NATv[blocks[i]] === 2) blocks[i] = K.DIRT; }
      let ok = true;
      for (let yy = Math.max(yT, y + 1); yy > y; yy--) { const i = (yy << 8) | col, b = blocks[i]; if (b && !NATv[b] && !(T.flags[b] & F.LEAVES)) { ok = false; break; } }
      if (!ok) continue;
      for (let yy = y + 1; yy <= Math.max(yT, y) + 3; yy++) { const i = (yy << 8) | col, b = blocks[i]; if (b && (NATv[b] || (T.flags[b] & F.LEAVES))) blocks[i] = 0; else if (b) break; }
      const h = h01(c.x, c.z, 77);
      let s = K.PATH;
      if (c.pave === 2) s = K.PLAZA;
      else if (c.pave === 1) s = c.d > 1.0 && h < 0.35 ? K.GRAVEL : K.FLAG;
      else if (c.d > 0.85) s = h < 0.2 ? K.GRAVEL : h < 0.42 ? K.COARSE : K.PATH;
      blocks[(y << 8) | col] = s;
      const below = blocks[((y - 1) << 8) | col]; if (below === K.GRASS) blocks[((y - 1) << 8) | col] = K.DIRT;
    }
  }
  // a deck cell: planks on spruce posts over still water and gullies (deck 1), stone over the river (deck 2): a
  // parapet on the edge cells, the arch under it (abutments solid at the ends of the run, a thin crown in the middle)
  function stampDeck(g, P, c, blocks, col, K) {
    const y = c.y, L = P.lines[c.line], n = L.pts.length, T = R.T, NATv = natural();
    let i0 = c.i, i1 = c.i; while (i0 > 0 && L.deck[i0 - 1] === c.deck) i0--; while (i1 < n - 1 && L.deck[i1 + 1] === c.deck) i1++;
    const u = (c.i - i0 + 0.5) / (i1 - i0 + 1), edge = c.d > 0.95;
    // clear the deck's headroom (natural blocks and water above it)
    for (let yy = y + 1; yy <= y + 4; yy++) { const i = (yy << 8) | col, b = blocks[i]; if (b && (NATv[b] || (T.flags[b] & (F.LEAVES | F.FLUID)))) blocks[i] = 0; }
    if (c.deck === 2) {
      blocks[(y << 8) | col] = h01(c.x, c.z, 5) < 0.18 ? K.MBRICK : K.BRICK;
      if (edge) blocks[((y + 1) << 8) | col] = K.BWALL;
      const crown = 1 + Math.round(5 * Math.pow(Math.abs(u - 0.5) * 2, 3)), solid = u < 0.1 || u > 0.9;
      for (let yy = y - 1; yy > 1; yy--) {
        const i = (yy << 8) | col, b = blocks[i];
        if (b && !(T.flags[b] & F.FLUID) && !NATv[b]) break;
        if (b && NATv[b] === 1 && !solid && y - yy > crown) break;                // the ground: the arch stands on it
        if (solid || y - yy <= crown) blocks[i] = K.BRICK; else if (b && NATv[b] === 2) blocks[i] = 0;
        if (b && NATv[b] === 1) break;
      }
    } else {
      blocks[(y << 8) | col] = K.PLANK;
      if (edge) blocks[((y + 1) << 8) | col] = K.PFENCE;
      const post = edge && (c.i % 4 === 0 || c.i === i0 || c.i === i1);
      if (post) for (let yy = y - 1; yy > 1; yy--) { const i = (yy << 8) | col, b = blocks[i]; if (b && !(T.flags[b] & F.FLUID) && NATv[b] !== 2) break; blocks[i] = K.PLOG; }
      else for (let yy = y - 1; yy >= y - 2 && yy > 1; yy--) { const i = (yy << 8) | col, b = blocks[i]; if (b && NATv[b] === 2) blocks[i] = 0; }
    }
  }
  // the lanterns, benches and milestones of the chunk (on the column's own top)
  function stampFurn(g, P, cx, cz, blocks) {
    const x0 = cx * 16, z0 = cz * 16, K = mats(), NATv = natural();
    if (!P.furnBy) { P.furnBy = new Map(); for (const f of P.furn) { const k = chunkKey(f.x, f.z); let a = P.furnBy.get(k); if (!a) { a = []; P.furnBy.set(k, a); } a.push(f); } }
    const list = P.furnBy.get(cx * 4096 + cz); if (!list) return;
    for (const f of list) {
      const lx = f.x - x0, lz = f.z - z0, col = (lz << 4) | lx;
      if (f.kind === 'lamp_deck') { const i = ((f.y + 2) << 8) | col; if (!blocks[i]) blocks[i] = K.LANTERN; continue; }
      const y = topOf(blocks, col, Math.min(250, f.y + 6)), top = blocks[(y << 8) | col];
      if (!top || NATv[top] !== 1 || y <= SEA) continue;
      const put = (yy, s) => { const i = (yy << 8) | col; if (!blocks[i] || NATv[blocks[i]] === 2) blocks[i] = s; };
      if (f.kind === 'lamp') { put(y + 1, K.FENCE); put(y + 2, K.FENCE); put(y + 3, K.LANTERN); }
      else if (f.kind === 'bench') put(y + 1, K.BENCH[f.face]);
      else if (f.kind === 'stone') { put(y + 1, K.MILE); if (h01(f.x, f.z, 9) < 0.5) put(y + 2, K.MOSSC); }
    }
  }
  function stampOps(P, cx, cz, blocks) {
    const b = P.ops.get(cx * 4096 + cz); if (!b) return;
    const x0 = cx * 16, z0 = cz * 16;
    for (let i = 0; i < b.length; i += 4) { const lx = b[i] - x0, lz = b[i + 2] - z0; blocks[(b[i + 1] << 8) | (lz << 4) | lx] = b[i + 3]; }
  }
  LAND.DRESS = [];           // the per-chunk dressing (woods, meadows, banks — the later sections): fn(g, P, cx, cz, out)
  HEART.builders.push(function (g, cx, cz, out) {
    if (!LAND.on(g)) return;
    const x0 = cx * 16, z0 = cz * 16;
    if (Math.hypot(x0 + 8, z0 + 8) > 800) return;
    const P = LAND.plan(g), blocks = out.blocks;
    stampWays(g, P, cx, cz, blocks);
    stampOps(P, cx, cz, blocks);
    stampFurn(g, P, cx, cz, blocks);
    for (const fn of LAND.DRESS) fn(g, P, cx, cz, out);
    const sp = P.spawns.get(cx * 4096 + cz);
    if (sp) { if (!out.spawns) out.spawns = []; for (const s of sp) out.spawns.push(s.slice()); }
  });
  LAND.addSpawn = (P, s, x, z) => { const k = chunkKey(x, z); let a = P.spawns.get(k); if (!a) { a = []; P.spawns.set(k, a); } a.push(s); };
})(VR);
