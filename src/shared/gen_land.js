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
  // (the shore: the waterline at q ≈ 1, a flat sand beach to q 1.13, then the bank up to the land at q 1.32)
  LAND.LAKE_OUT = 1.32;
  LAND.lakeH = (q, Hl) => q < 0.95 ? 53 + 8 * ss(0.2, 0.95, q) : q < 1.03 ? lerp(61, SEA + 1.2, (q - 0.95) / 0.08) : q < 1.13 ? lerp(SEA + 1.2, SEA + 2.6, (q - 1.03) / 0.1) : lerp(SEA + 2.6, Hl, ss(1.13, LAND.LAKE_OUT, q));

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
    if (q < LAND.LAKE_OUT) {
      const Hl = LAND.lakeH(q, D.H);
      if (Hl < D.H) { D.H = Hl; D.A = lerp(D.A, 0.6, 1 - ss(1.05, LAND.LAKE_OUT, q)); }
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
    // the wall behind the pool: walking back from the head, its top is where the ground stops climbing steeply
    const gyr = (r) => g.surfaceY(Math.round(hx - ux * r), Math.round(hz - uz * r));
    let plateau = 0; for (let q = LAND.HEAD_R + 8; q <= LAND.HEAD_R + 14; q++) plateau = Math.max(plateau, gyr(q));
    let r = LAND.HEAD_R;
    while (r < LAND.HEAD_R + 14 && gyr(r) < plateau - 3) r++;
    const top = gyr(r) - 1;                                                              // the spring's water level
    const ex = Math.round(hx - ux * r), ez = Math.round(hz - uz * r);                   // the lip
    const sx = Math.round(hx - ux * (r + 4)), sz = Math.round(hz - uz * (r + 4));       // the spring
    g._landFalls = { head: [Math.round(hx), Math.round(hz)], dir: [ux, uz], edge: [ex, ez], spring: [sx, sz], top: Math.min(top, g.surfaceY(sx, sz) - 1), rim: r };
    return g._landFalls;
  };
  // the sites of a world: the fixed ones, the farms a little moved by the seed, the beach and the falls found on the
  // lake's shore and over the river's head
  LAND.sites = function (g) {
    const rng = new VR.RNG((g.seed ^ 0x5173) >>> 0), Fa = LAND.falls(g);
    return LAND.SITES.map(([id, x, z, kind]) => {
      const j = kind === 'farm' ? 22 : 0;
      let sx = Math.round(x + (rng.next() - 0.5) * j), sz = Math.round(z + (rng.next() - 0.5) * j);
      if (kind === 'beach') { const L = LAND.LAKE; [sx, sz] = LAND.shoreAt(g, Math.atan2(30 - L.z, 230 - L.x), 1.16); }
      if (kind === 'shore') { const L = LAND.LAKE; [sx, sz] = LAND.shoreAt(g, Math.atan2(290 - L.z, 420 - L.x), 1.18); }
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
  LAND.DRESS = [];           // the per-chunk dressing (woods, meadows, banks — the later sections): fn(g, P, cx, cz, out)
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
    for (const fn of LAND.PIECES.slice().sort((a, b) => (a.order || 9) - (b.order || 9))) { try { fn(g, P, K); } catch (e) { if (VR.VillageGen && VR.VillageGen.probe && e === VR.VillageGen.probe) throw e; if (!g._landErr) { g._landErr = 1; console.warn('land piece', e); } } }
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
    BENCH: [0, 1, 2, 3].map(f => st('vx_bench', { facing: f })), HEDGE: st('oak_leaves', { persistent: 1, distance: 1 }),
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
      else if (f.kind === 'hedge') { put(y + 1, K.HEDGE); if (f.h > 1) put(y + 2, K.HEDGE); }
    }
  }
  function stampOps(P, cx, cz, blocks) {
    const b = P.ops.get(cx * 4096 + cz); if (!b) return;
    const x0 = cx * 16, z0 = cz * 16;
    for (let i = 0; i < b.length; i += 4) { const lx = b[i] - x0, lz = b[i + 2] - z0; blocks[(b[i + 1] << 8) | (lz << 4) | lx] = b[i + 3]; }
  }
  // ============================================================================ the woods and the meadows
  // One wood field over the land (two noises: the woods' blobs and their ragged edges), biased by region — deep woods
  // in the north-west and on the ridge, open parkland round the temple, fields kept open round the farms — and a kind
  // from a slower noise: mixed broadleaf, birch, dark, conifers (the ridge, the north-west), cherry groves in patches.
  // Groves stand in the open where the edge noise peaks. Everything here is a function of the world position alone:
  // a tree that reaches over a chunk border is the same tree on both sides.
  const WQ = { d: 0, kind: 0 };
  LAND.WOOD = { T: 0.04, KINDS: ['mixed', 'birch', 'dark', 'conifer', 'cherry'] };
  const siteList = (g) => g._landSites || (g._landSites = LAND.sites(g));
  LAND.woodAt = function (g, x, z) {
    noises(g);
    let n = g.nLand.n2(x, z) + 0.32 * g.nLand2.n2(x, z);
    const d0 = Math.sqrt(x * x + z * z);
    n -= 0.42 * (1 - ss(200, 320, d0));                                   // the plateau round the temple: parkland
    n += 0.2 * ss(-250, -420, z) * ss(-180, -360, x);                     // the north-west: deep woods
    n += 0.12 * ss(-100, -260, z) * ss(330, 440, x);                      // the slopes east of the river's head
    let conifer = false;
    if (x < -500 && x > -730 && z > -160 && z < 250) { const lift = LAND.ridgeLift(g, x, z); if (lift > 4) { n += 0.18 * Math.min(1, lift / 14); conifer = lift > 9; } }
    if (x < -300 && z < -330) conifer = conifer || g.nLandK.n2(x + 999, z) > -0.1;
    for (const s of siteList(g)) {
      if (s.kind !== 'farm' && s.kind !== 'lookout' && s.kind !== 'beach' && s.kind !== 'shore') continue;
      const dd = (s.x - x) * (s.x - x) + (s.z - z) * (s.z - z), r = s.kind === 'farm' ? 120 : 40;
      if (dd < r * r) n -= (s.kind === 'farm' ? 0.75 : 0.5) * (1 - ss(r * 0.55, r, Math.sqrt(dd)));
    }
    WQ.d = ss(LAND.WOOD.T, LAND.WOOD.T + 0.16, n);
    if (WQ.d < 0.05) { const gv = g.nLand2.n2(x * 1.7 + 311, z * 1.7 - 177); if (gv > 0.46) WQ.d = Math.max(WQ.d, 0.8 * ss(0.46, 0.6, gv)); }
    const k = g.nLandK.n2(x, z);
    WQ.kind = conifer ? 3 : k < -0.28 ? 1 : k > 0.27 ? 2 : 0;
    if (WQ.kind === 0) { const ci = Math.floor(x / 96), cj = Math.floor(z / 96), hc = h01(ci, cj, g.seed ^ 0xc4e7); if (hc < 0.2) { const px = ci * 96 + 20 + hc * 280 % 56, pz = cj * 96 + 20 + (hc * 977) % 56; if ((x - px) * (x - px) + (z - pz) * (z - pz) < 26 * 26) WQ.kind = 4; } }
    return WQ;
  };
  // may a tree stand here: open land, not on or next to a way, a piece, a field, a clearing, a pond; dry ground
  const KW = 1 | 2 | 4 | 8 | 16;
  const treeOk = (g, P, x, z) => !LAND.zoneAt(g, x, z) && !(LAND.keepAt(P, x, z) & KW) && !LAND.keepAt(P, x + 1, z) && !LAND.keepAt(P, x - 1, z) && !LAND.keepAt(P, x, z + 1) && !LAND.keepAt(P, x, z - 1) && !nearViaduct(g, x, z);
  LAND.treeOk = treeOk;
  function plantTree(w, kind, x, y, z, rng, big) {
    const T = GEN.TREES, r = rng.next();
    switch (kind) {
      case 1: return r < 0.18 ? T.oak(w, x, y, z, rng) : T.birch(w, x, y, z, rng, { tall: rng.chance(0.35) });
      case 2: return r < 0.55 ? T.darkOak(w, x, y, z, rng) : r < 0.85 ? T.oak(w, x, y, z, rng, { h: 5 }) : T.fancyOak(w, x, y, z, rng);
      case 3: return r < 0.12 ? T.birch(w, x, y, z, rng) : T.spruce(w, x, y, z, rng, { pine: r > 0.72 });
      case 4: return r < 0.8 ? T.cherry(w, x, y, z, rng) : T.roundTree(w, x, y, z, rng, { leaf: 'flowering_azalea_leaves' });
      default: return big || r < 0.22 ? T.fancyOak(w, x, y, z, rng) : r < 0.62 ? T.oak(w, x, y, z, rng, { h: 5 }) : r < 0.84 ? T.birch(w, x, y, z, rng) : T.roundTree(w, x, y, z, rng);
    }
  }
  LAND.plantTree = plantTree;
  const SP = 5, SOLO = 22;
  function dressTrees(g, P, cx, cz, out) {
    const x0 = cx * 16, z0 = cz * 16, w = new GEN.ColumnWriter(cx, cz, out.blocks), BIm = VR.BIOME.sky_meadow;
    const meadowAt = (x, z, y) => g.biomeFor(g.climateAt(x, z), y - 1) === BIm;
    // the woods: a jittered grid, one candidate a cell, kept by the wood's density there
    for (let gz = Math.floor((z0 - 7) / SP); gz <= Math.floor((z0 + 22) / SP); gz++) for (let gx = Math.floor((x0 - 7) / SP); gx <= Math.floor((x0 + 22) / SP); gx++) {
      const hx = M.hash2(gx, gz, g.seed ^ 0x7ee51) >>> 0, x = gx * SP + (hx % SP), z = gz * SP + ((hx >>> 8) % SP);
      if (x < x0 - 7 || x > x0 + 22 || z < z0 - 7 || z > z0 + 22) continue;
      const q = LAND.woodAt(g, x, z);
      if (((hx >>> 16) & 1023) / 1024 >= q.d * 0.85) continue;
      if (!treeOk(g, P, x, z)) continue;
      const y = g.surfaceY(x, z) + 1;
      if (y <= SEA + 2 || !meadowAt(x, z, y)) continue;
      plantTree(w, q.kind, x, y, z, new VR.RNG((hx ^ 0x5bd1e995) >>> 0));
    }
    // the parkland: a big tree alone in the meadow now and then (one candidate per 22 blocks)
    for (let gz = Math.floor((z0 - 8) / SOLO); gz <= Math.floor((z0 + 23) / SOLO); gz++) for (let gx = Math.floor((x0 - 8) / SOLO); gx <= Math.floor((x0 + 23) / SOLO); gx++) {
      const hx = M.hash2(gx, gz, g.seed ^ 0x501a) >>> 0;
      if ((hx & 1023) / 1024 > 0.42) continue;
      const x = gx * SOLO + 3 + ((hx >>> 10) % (SOLO - 6)), z = gz * SOLO + 3 + ((hx >>> 18) % (SOLO - 6));
      if (x < x0 - 8 || x > x0 + 23 || z < z0 - 8 || z > z0 + 23) continue;
      if (LAND.woodAt(g, x, z).d > 0.05 || !treeOk(g, P, x, z)) continue;
      if (LAND.keepAt(P, x + 2, z) || LAND.keepAt(P, x - 2, z) || LAND.keepAt(P, x, z + 2) || LAND.keepAt(P, x, z - 2)) continue;
      const y = g.surfaceY(x, z) + 1;
      if (y <= SEA + 2 || !meadowAt(x, z, y)) continue;
      const rng = new VR.RNG((hx ^ 0x2545f491) >>> 0), r = rng.next();
      if (r < 0.5) GEN.TREES.fancyOak(w, x, y, z, rng); else if (r < 0.8) GEN.TREES.roundTree(w, x, y, z, rng, { r: 3.2, h: 4 }); else GEN.TREES.oak(w, x, y, z, rng, { h: 6 });
    }
    // the plan's own trees (the poplar rows along the farm lanes, the orchards' neighbours)
    if (P.treesBy) { const list = P.treesBy.get(cx * 4096 + cz); if (list) for (const t of list) { const rng = new VR.RNG(M.hash2(t.x, t.z, g.seed ^ 0x9091) >>> 0); if (t.kind === 'poplar') GEN.TREES.poplar(w, t.x, t.y, t.z, rng, { color: t.color }); else plantTree(w, t.kind, t.x, t.y, t.z, rng, true); } }
  }
  // the ground: the woods' floor (ferns, litter, moss, mushrooms, podzol and coarse earth under the dark woods and the
  // conifers), the woods' edges (tall grass, bushes), the meadow (grass, tall grass in patches, flower drifts: one kind
  // of flower dominating each drift)
  let PL = null;
  const plants = () => PL || (PL = {
    GRASS: st('grass_block'), PODZOL: st('podzol'), COARSE: st('coarse_dirt'), MOSS: st('moss_block'), SG: st('short_grass'), TG0: st('tall_grass', { half: 0 }), TG1: st('tall_grass', { half: 1 }),
    FERN: st('fern'), LF0: st('large_fern', { half: 0 }), LF1: st('large_fern', { half: 1 }), BUSH: st('bush'), MOSSC: st('moss_carpet'), BROWN: st('brown_mushroom'), RED: st('red_mushroom'),
    BERRY: st('sweet_berry_bush', { age: 3 }), LOTV: st('lily_of_the_valley'), PETALS: [0, 1, 2, 3].map(c => st('pink_petals', { count: c, facing: c })), LITTER: [0, 1, 2, 3].map(c => st('leaf_litter', { count: c, facing: (c * 3) & 3 })),
    WILD: [0, 1, 2, 3].map(c => st('wildflowers', { count: c, facing: (c * 5) & 3 })), FIREFLY: st('firefly_bush'),
    DRIFT: ['poppy', 'oxeye_daisy', 'cornflower', 'dandelion', 'azure_bluet', 'allium', 'red_tulip', 'wildflowers', 'white_tulip', 'lily_of_the_valley', 'orange_tulip', 'pink_tulip'].map(n => n === 'wildflowers' ? -1 : st(n)),
  });
  LAND.plants = plants;
  function dressGround(g, P, cx, cz, out) {
    const blocks = out.blocks, x0 = cx * 16, z0 = cz * 16, S = plants(), BIm = VR.BIOME.sky_meadow, KG = 1 | 2 | 4 | 16;
    for (let col = 0; col < 256; col++) {
      if (out.biome && out.biome[col] !== BIm) continue;
      const x = x0 + (col & 15), z = z0 + (col >> 4);
      if (LAND.zoneAt(g, x, z) || (LAND.keepAt(P, x, z) & KG)) continue;
      const y = topOf(blocks, col, 180);
      if (y < SEA || blocks[(y << 8) | col] !== S.GRASS) continue;
      const ai = ((y + 1) << 8) | col; if (blocks[ai]) continue;
      const free2 = !blocks[ai + 256];
      const q = LAND.woodAt(g, x, z), r = h01(x, z, g.seed ^ 0x6a11), r2 = h01(z, x, g.seed ^ 0x51f3), pn = g.nLandR.n2(x, z);
      if (q.d > 0.38) {
        // the woods' floor
        if ((q.kind === 2 || q.kind === 3) && pn > 0.18) blocks[(y << 8) | col] = pn > 0.5 && q.kind === 2 ? S.MOSS : S.PODZOL;
        else if (pn < -0.5) blocks[(y << 8) | col] = S.COARSE;
        if (r < 0.1) blocks[ai] = S.FERN;
        else if (r < 0.125 && free2) { blocks[ai] = S.LF0; blocks[ai + 256] = S.LF1; }
        else if (r < 0.19 && q.kind !== 3) blocks[ai] = S.LITTER[(r2 * 4) | 0];
        else if (r < 0.215) blocks[ai] = q.kind === 2 || q.kind === 3 ? S.MOSSC : S.BUSH;
        else if (r < 0.222) blocks[ai] = r2 < 0.6 ? S.BROWN : S.RED;
        else if (r < 0.228) blocks[ai] = q.kind === 3 ? S.BERRY : S.LOTV;
        else if (r < 0.232) blocks[ai] = S.FIREFLY;
        else if (r < 0.32) blocks[ai] = S.SG;
        if (q.kind === 4 && r2 < 0.35 && !blocks[ai]) blocks[ai] = S.PETALS[(r * 4) | 0];
      } else if (q.d > 0.06) {
        // the woods' edges
        if (r < 0.06 && free2) { blocks[ai] = S.TG0; blocks[ai + 256] = S.TG1; }
        else if (r < 0.085) blocks[ai] = S.BUSH;
        else if (r < 0.12) blocks[ai] = S.FERN;
        else if (r < 0.145) blocks[ai] = S.DRIFT[(r2 * 6) | 0] || S.WILD[1];
        else if (r < 0.4) blocks[ai] = S.SG;
      } else {
        // the meadow: grass, tall grass in patches, the flower drifts
        const fd = g.nLandD.n2(x, z);
        if (fd > 0.26 && r < 0.1 + 0.48 * ss(0.26, 0.52, fd)) {
          const sp = Math.floor((g.nLandK.n2(x * 0.9 + 500, z * 0.9 - 500) * 0.5 + 0.5) * S.DRIFT.length * 1.6) % S.DRIFT.length;
          const s = S.DRIFT[r2 < 0.78 ? sp : (sp + 1) % S.DRIFT.length];
          blocks[ai] = s < 0 ? S.WILD[(r2 * 4) | 0] : s;
        } else if (pn > 0.42 && r2 < 0.16 && free2) { blocks[ai] = S.TG0; blocks[ai + 256] = S.TG1; }
        else if (r < (pn > 0.15 ? 0.3 : 0.16)) blocks[ai] = S.SG;
      }
    }
  }
  LAND.DRESS_WOODS = [dressTrees, dressGround];

  // ---------------------------------------------------------------- clearings with a camp
  // In the deep woods, within reach of a way: a clearing (no tree within 8), a campfire with log seats, two tents (a
  // pitched roof of coloured canvas over a ridge), a lantern on a post, a barrel
  LAND.PIECES.push(Object.assign(function camps(g, P, K) {
    const gy = groundOf(g, P), rng = new VR.RNG((g.seed ^ 0xca39) >>> 0), got = [];
    const nearWay = (x, z, r0, r1) => { let best = 1e9; for (const c of P.cells.values()) { const d = (c.x - x) ** 2 + (c.z - z) ** 2; if (d < best) best = d; } best = Math.sqrt(best); return best >= r0 && best <= r1; };
    const cand = [];
    for (let z = -640; z <= 640; z += 36) for (let x = -640; x <= 640; x += 36) {
      const px = x + Math.round((h01(x, z, g.seed ^ 77) - 0.5) * 20), pz = z + Math.round((h01(z, x, g.seed ^ 78) - 0.5) * 20);
      if (px * px + pz * pz > 620 * 620 || LAND.zoneAt(g, px, pz) || LAND.keepAt(P, px, pz)) continue;
      const q = LAND.woodAt(g, px, pz); if (q.d < 0.7) continue;
      cand.push([px, pz, h01(px, pz, g.seed ^ 79)]);
    }
    cand.sort((a, b) => a[2] - b[2]);
    for (const [x, z] of cand) {
      if (got.length >= 5) break;
      if (got.some(c => Math.hypot(c[0] - x, c[1] - z) < 170)) continue;
      const y0 = gy(x, z); let flat = y0 > SEA + 2;
      for (let dz = -6; dz <= 6 && flat; dz += 2) for (let dx = -6; dx <= 6; dx += 2) if (Math.abs(gy(x + dx, z + dz) - y0) > 2) { flat = false; break; }
      if (!flat || !nearWay(x, z, 14, 70)) continue;
      got.push([x, z]);
      markDisc(P, x, z, 9, LAND.KEEP.CLEAR); markDisc(P, x, z, 6, LAND.KEEP.PIECE);
      const put = K.put, y = y0;
      put(x, y + 1, z, st('campfire', { facing: 0, lit: 1 }));
      for (const [dx, dz, ax] of [[2, 0, 2], [-2, 0, 2], [0, 2, 1]]) put(x + dx, gy(x + dx, z + dz) + 1, z + dz, st('stripped_spruce_log', { axis: ax }));
      const cols = ['red', 'blue', 'teal', 'green', 'white'], c0 = rng.int(cols.length);
      // the tents: 3 long (along x), a roof of two slopes meeting at a ridge over the middle row
      [[-4, -4], [3, -4]].forEach(([ox, oz], ti) => {
        const col = cols[(c0 + ti * 2) % cols.length], ty = gy(x + ox, z + oz);
        for (let u = 0; u < 3; u++) {
          put(x + ox + u, ty + 1, z + oz - 1, st('vx_roof_' + col, { facing: 0 }));
          put(x + ox + u, ty + 1, z + oz + 1, st('vx_roof_' + col, { facing: 2 }));
          put(x + ox + u, ty + 2, z + oz, st('vx_ridge_' + col, { facing: 1 }));
          put(x + ox + u, ty + 1, z + oz, 0);
        }
      });
      const lx = x + 3, lz = z + 3, ly = gy(lx, lz);
      put(lx, ly + 1, lz, st('oak_fence')); put(lx, ly + 2, lz, st('lantern', { hanging: 0 }));
      put(x - 3, gy(x - 3, z + 3) + 1, z + 3, st('barrel', { facing: 1, open: 0 }));
      P.pieces.push({ kind: 'camp', x, z, y });
    }
  }, { order: 5 }));
  // hedgerows along the ways (one side, in stretches) and poplar rows on the lanes near the farms
  LAND.PIECES.push(Object.assign(function hedges(g, P) {
    P.trees = P.trees || [];
    const gy = groundOf(g, P);
    const farms = P.sites.filter(s => s.kind === 'farm');
    P.lines.forEach((L, li) => {
      const n = L.pts.length;
      for (let i = 4; i < n - 4; i++) {
        const [px, pz] = L.pts[i];
        if (L.deck[i]) continue;
        const a = L.pts[i - 2], b = L.pts[i + 2], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
        const nearFarm = farms.some(f => (f.x - px) ** 2 + (f.z - pz) ** 2 < 90 * 90);
        const hedge = Math.sin(i / 23 + li * 1.7) > 0.35 && !nearFarm, side = Math.sin(i / 61 + li) > 0 ? 1 : -1;
        if (hedge) {
          const x = Math.round(px + nx * side * 3.2), z = Math.round(pz + nz * side * 3.2);
          if (!P.cells.has(ck(x, z)) && !LAND.zoneAt(g, x, z) && !(LAND.keepAt(P, x, z) & (2 | 4 | 16))) { const y = gy(x, z); if (y > SEA + 1 && Math.abs(y - L.y[i]) <= 2) P.furn.push({ kind: 'hedge', x, z, y, h: h01(x, z, 31) < 0.3 ? 2 : 1 }); }
        }
        if (nearFarm && i % 7 === 0 && Math.sin(i / 37 + li) > -0.2) for (const sd of [1, -1]) {
          const x = Math.round(px + nx * sd * 4), z = Math.round(pz + nz * sd * 4);
          if (P.cells.has(ck(x, z)) || LAND.zoneAt(g, x, z) || LAND.keepAt(P, x, z) & 6) continue;
          const y = gy(x, z); if (y <= SEA + 2 || Math.abs(y - L.y[i]) > 2) continue;
          P.trees.push({ x, z, y: y + 1, kind: 'poplar', color: (li + (i / 7 | 0)) % 3 });
        }
      }
    });
    const by = new Map();
    for (const t of P.trees) for (let dz = -4; dz <= 4; dz += 4) for (let dx = -4; dx <= 4; dx += 4) { const k = chunkKey(t.x + dx, t.z + dz); let a = by.get(k); if (!a) { a = []; by.set(k, a); } if (!a.includes(t)) a.push(t); }
    P.treesBy = by;
    P.furnBy = null;
  }, { order: 6 }));

  // ============================================================================ the farmsteads
  // At every farm site (the way ends in its yard): a farmhouse and a barn facing the yard (the villages' own builders,
  // VG.building), a well, two to four crop fields (VG.farm: a fence round each, a gate toward the yard, a water channel
  // down the middle, a scarecrow in the first), a fenced pasture with a trough, hay and a lean-to (its herd an animal
  // anchor), an orchard, at two farms a windmill (its sails round a hub: the pivot, a `windmill` spawn), at one a
  // vineyard on a slope, at the others a field of sunflowers or lavender rows; earth lanes from the yard to the gates.
  // Every piece stands on open land: no way, no other piece, ground within a few blocks of level.
  const ROT4 = [(u, v) => [u, v], (u, v) => [-v, u], (u, v) => [-u, -v], (u, v) => [v, -u]];
  LAND.ROT4 = ROT4;
  const lotRect = (ox, oz, r, w, d) => { const a = ROT4[r](0, 0), b = ROT4[r](w - 1, d - 1); return [ox + Math.min(a[0], b[0]), oz + Math.min(a[1], b[1]), ox + Math.max(a[0], b[0]), oz + Math.max(a[1], b[1])]; };
  LAND.lotRect = lotRect;
  // a free spot for a w × d lot within rMin…rMax of (sx, sz), its front facing (sx, sz): {ox, oz, r, rect, F, lo, hi}
  function findLot(g, P, gy, rng, sx, sz, w, d, rMin, rMax, maxVar, taken, gap) {
    for (let k = 0; k < 220; k++) {
      const ang = rng.next() * Math.PI * 2, dist = rMin + rng.next() * (rMax - rMin), cx = sx + Math.cos(ang) * dist, cz = sz + Math.sin(ang) * dist;
      const dx = sx - cx, dz = sz - cz, r = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 1 : 3) : (dz > 0 ? 2 : 0);
      const c = ROT4[r]((w - 1) / 2, (d - 1) / 2), ox = Math.round(cx - c[0]), oz = Math.round(cz - c[1]);
      const R0 = lotRect(ox, oz, r, w, d);
      if (taken.some(t => R0[0] <= t[2] + gap && R0[2] >= t[0] - gap && R0[1] <= t[3] + gap && R0[3] >= t[1] - gap)) continue;
      let ok = true, lo = 999, hi = -999, sum = 0, n = 0;
      for (let z = R0[1] - 2; z <= R0[3] + 2 && ok; z += 2) for (let x = R0[0] - 2; x <= R0[2] + 2; x += 2) {
        if (LAND.zoneAt(g, x, z) || (LAND.keepAt(P, x, z) & (1 | 2 | 4 | 16)) || nearViaduct(g, x, z)) { ok = false; break; }
        const y = gy(x, z); if (y <= SEA + 2) { ok = false; break; }
        if (x >= R0[0] && x <= R0[2] && z >= R0[1] && z <= R0[3]) { lo = Math.min(lo, y); hi = Math.max(hi, y); sum += y; n++; }
      }
      if (!ok || hi - lo > maxVar) continue;
      for (let z = R0[1] - 1; z <= R0[3] + 1 && ok; z++) for (let x = R0[0] - 1; x <= R0[2] + 1; x++) if (P.cells.has(ck(x, z))) { ok = false; break; }
      if (!ok) continue;
      return { ox, oz, r, rect: R0, F: Math.round(sum / n), lo, hi };
    }
    return null;
  }
  LAND.findLot = findLot;
  LAND.PIECES.push(Object.assign(function farms(g, P, K) {
    const VG = VR.VillageGen; if (!VG || !VG.makeLot || !VG.building || !VG.farm) return;
    const gy = groundOf(g, P), farmSites = P.sites.filter(s => s.kind === 'farm');
    P.farms = [];
    farmSites.forEach((site, fi) => {
      const rng = new VR.RNG((M.hash2(site.x, site.z, g.seed ^ 0xfa53)) >>> 0);
      const style = fi % 2 ? 'taiga' : 'meadow', S = VG.STYLES[style], taken = [], FM = { site, pieces: [], fields: [], gates: [] };
      const put = K.put, LOT = (o) => VG.makeLot(put, o.ox, o.oz, o.r);
      // the yard: gravel and coarse earth round the way's end, kept free
      const yy = gy(site.x, site.z);
      for (let dz = -5; dz <= 5; dz++) for (let dx = -5; dx <= 5; dx++) { if (dx * dx + dz * dz > 27) continue; const x = site.x + dx, z = site.z + dz; if (P.cells.has(ck(x, z))) continue; const y = gy(x, z); if (Math.abs(y - yy) > 2) continue; put(x, y, z, h01(x, z, 41) < 0.55 ? st('coarse_dirt') : st('gravel')); }
      taken.push([site.x - 6, site.z - 6, site.x + 6, site.z + 6]); markKeep(P, site.x - 6, site.z - 6, site.x + 6, site.z + 6, LAND.KEEP.PIECE);
      const claim = (L, kind) => { taken.push(L.rect); markKeep(P, L.rect[0] - 3, L.rect[1] - 3, L.rect[2] + 3, L.rect[3] + 3, kind === 'field' ? LAND.KEEP.FIELD : LAND.KEEP.PIECE); };
      const lane = (L, gu, gv) => {
        // an earth lane from the gate (lot-local gu, gv − 1) back to the yard
        const q = ROT4[L.r](gu, gv - 1), x0 = L.ox + q[0], z0 = L.oz + q[1], n = Math.round(Math.hypot(site.x - x0, site.z - z0));
        for (let i = 0; i <= n; i++) { const x = Math.round(x0 + (site.x - x0) * i / n), z = Math.round(z0 + (site.z - z0) * i / n); if (Math.hypot(x - site.x, z - site.z) < 5) break; if (P.cells.has(ck(x, z)) || taken.some(t => x >= t[0] && x <= t[2] && z >= t[1] && z <= t[3] && t !== L.rect)) continue; put(x, gy(x, z), z, st('dirt_path')); P.keep[keepIdx(x, z)] |= LAND.KEEP.WAY; }
      };
      // ---- the farmhouse and the barn
      const walls = S.walls[rng.int(S.walls.length)], roof = S.roofs[rng.int(S.roofs.length)], win = S.windows[rng.int(S.windows.length)];
      const hw = 7 + rng.int(2) * 2, hd = 7 + rng.int(2);
      const H = findLot(g, P, gy, rng, site.x, site.z, hw, hd, 9, 17, 3, taken, 3);
      if (H) {
        const L = LOT(H); claim(H, 'house');
        const F = H.hi + 1;
        VG.building(L, { w: hw, d: hd, floors: rng.chance(0.5) ? 2 : 1, F, style, rng, kind: 'farmhouse', beds: 2, walls, roof, window: win, wood: S.wood, chimney: true, seed: rng.int(1 << 20), ground: (u, v) => { const q = ROT4[H.r](u, v); return gy(H.ox + q[0], H.oz + q[1]); } });
        { const q = ROT4[H.r]((hw >> 1) - 2, -2), lx = H.ox + q[0], lz = H.oz + q[1], ly = gy(lx, lz); put(lx, ly + 1, lz, st('oak_fence')); put(lx, ly + 2, lz, st('oak_fence')); put(lx, ly + 3, lz, st('lantern', { hanging: 0 })); }
        FM.pieces.push({ kind: 'farmhouse', rect: H.rect, F }); P.pieces.push({ kind: 'farmhouse', x: Math.round((H.rect[0] + H.rect[2]) / 2), z: Math.round((H.rect[1] + H.rect[3]) / 2), y: F, farm: site.id, rect: H.rect });
      }
      const bw = 9 + rng.int(2) * 2, bd = 11 + rng.int(3);
      const Bn = findLot(g, P, gy, rng, site.x, site.z, bw, bd, 12, 26, 3, taken, 4);
      if (Bn) {
        const L = LOT(Bn); claim(Bn, 'barn');
        const F = Bn.hi + 1;
        VG.building(L, { w: bw, d: bd, floors: 1, F, style, rng, kind: 'barn', walls: style === 'taiga' ? 'vx_siding_red' : (rng.chance(0.5) ? 'vx_siding_red' : 'vx_logwall'), roof: style === 'taiga' ? 'slate' : roof, window: 'vx_window_wood', wood: S.wood, seed: rng.int(1 << 20), ground: (u, v) => { const q = ROT4[Bn.r](u, v); return gy(Bn.ox + q[0], Bn.oz + q[1]); } });
        for (const [u, v, h] of [[1, bd - 2, 3], [2, bd - 2, 2], [1, bd - 3, 2], [bw - 2, bd - 2, 2]]) for (let y = F + 1; y < F + 1 + h; y++) L.P(u, y, v, 'vx_hay');
        L.P(bw - 2, F + 1, -1, 'vx_hay'); L.P(bw - 2, F + 2, -1, 'vx_hay'); L.P(1, F + 1, -1, 'vx_wheelbarrow', { facing: 0 });
        FM.pieces.push({ kind: 'barn', rect: Bn.rect, F }); P.pieces.push({ kind: 'barn', x: Math.round((Bn.rect[0] + Bn.rect[2]) / 2), z: Math.round((Bn.rect[1] + Bn.rect[3]) / 2), y: F, farm: site.id, rect: Bn.rect });
      }
      // ---- the well in the yard's edge
      { const a = rng.next() * 6.283, x = Math.round(site.x + Math.cos(a) * 4.5), z = Math.round(site.z + Math.sin(a) * 4.5); if (!P.cells.has(ck(x, z))) { put(x, gy(x, z) + 1, z, st('vx_well')); P.pieces.push({ kind: 'well', x, z, y: gy(x, z) + 1, farm: site.id }); } }
      // ---- the windmill (farm_c and the third farm)
      if (fi === 0 || fi === 2) {
        const Wm = findLot(g, P, gy, rng, site.x, site.z, 5, 5, 16, 34, 2, taken, 4);
        if (Wm) { claim(Wm, 'windmill'); windmill(g, P, K, Wm, gy, rng, site); }
      }
      // ---- the pasture
      const pw = 13 + rng.int(4), pd = 15 + rng.int(5);
      const Pa = findLot(g, P, gy, rng, site.x, site.z, pw, pd, 18, 46, 5, taken, 3);
      if (Pa) { claim(Pa, 'pasture'); pasture(g, P, K, Pa, pw, pd, gy, rng, site); lane(Pa, pw >> 1, 0); }
      // ---- the crop fields (two to four)
      const nf = 2 + rng.int(3);
      for (let k = 0; k < nf; k++) {
        const fw = 11 + rng.int(3) * 2, fd = 13 + rng.int(5);
        const Fl = findLot(g, P, gy, rng, site.x, site.z, fw, fd, 16, 60, 3, taken, 2);
        if (!Fl) continue;
        claim(Fl, 'field');
        const L = LOT(Fl), F = Math.max(Fl.lo, Fl.F);
        const info = VG.farm(L, { w: fw, d: fd, F, rng, style: 'meadow', ground: (u, v) => { const q = ROT4[Fl.r](u, v); return gy(Fl.ox + q[0], Fl.oz + q[1]); } });
        L.P(fw >> 1, F + 1, 0, 'oak_fence_gate', { facing: 0, open: 0 });
        // the field's ground under the fill: what VG.farm leaves above F + 3 on a high corner is cleared too
        for (let u = 0; u < fw; u++) for (let v = 0; v < fd; v++) { const q = ROT4[Fl.r](u, v), x = Fl.ox + q[0], z = Fl.oz + q[1], y0 = gy(x, z); for (let y = F + 4; y <= y0 + 1; y++) put(x, y, z, 0); }
        if (k === 0) L.P((fw >> 1) + 2, F + 1, fd >> 1, 'vx_scarecrow', { facing: 0 });
        const fld = { kind: 'field', crop: info.crop, rect: Fl.rect, F, r: Fl.r, ox: Fl.ox, oz: Fl.oz, w: fw, d: fd, farm: site.id, scarecrow: k === 0 };
        FM.fields.push(fld); P.pieces.push(Object.assign({ x: Math.round((Fl.rect[0] + Fl.rect[2]) / 2), z: Math.round((Fl.rect[1] + Fl.rect[3]) / 2), y: F }, fld));
        lane(Fl, fw >> 1, 0);
      }
      // ---- the orchard
      const ow = 13 + rng.int(2) * 4, od = 13 + rng.int(2) * 4;
      const Or = findLot(g, P, gy, rng, site.x, site.z, ow, od, 18, 60, 6, taken, 2);
      if (Or) { claim(Or, 'orchard'); orchard(g, P, K, Or, ow, od, gy, rng, site); }
      // ---- a vineyard on a slope (one farm), else a flower field (sunflowers, lavender rows)
      if (fi === 1) { const Vy = findLot(g, P, gy, rng, site.x, site.z, 13, 17, 20, 70, 9, taken, 2); if (Vy && Vy.hi - Vy.lo >= 2) { claim(Vy, 'vineyard'); vineyard(g, P, K, Vy, 13, 17, gy, site); } }
      else { const Fw = findLot(g, P, gy, rng, site.x, site.z, 11, 15, 18, 60, 3, taken, 2); if (Fw) { claim(Fw, 'field'); flowerField(g, P, K, Fw, 11, 15, gy, fi % 3 === 0 ? 'sunflower' : 'allium', site); } }
      P.farms.push(FM);
    });
  }, { order: 1 }));
  function pasture(g, P, K, Pa, w, d, gy, rng, site) {
    const put = K.put, at = (u, v) => { const q = ROT4[Pa.r](u, v); return [Pa.ox + q[0], Pa.oz + q[1]]; }, FEN = st('oak_fence');
    const gu = w >> 1, fG = (Pa.r) & 3;
    for (let u = 0; u < w; u++) for (let v = 0; v < d; v++) {
      const [x, z] = at(u, v), y = gy(x, z), edge = u === 0 || v === 0 || u === w - 1 || v === d - 1;
      for (let yy = y + 1; yy <= y + 3; yy++) put(x, yy, z, 0);
      if (edge) put(x, y + 1, z, v === 0 && u === gu ? st('oak_fence_gate', { facing: fG, open: 0 }) : FEN);
      else if (h01(x, z, 61) < 0.18) put(x, y + 1, z, st('short_grass'));
    }
    // trough, hay, a lean-to in the back corner
    for (let u = 2; u <= 4; u++) { const [x, z] = at(u, d - 2); put(x, gy(x, z) + 1, z, st('vx_trough', { facing: fG })); }
    { const [x, z] = at(w - 2, 1); put(x, gy(x, z) + 1, z, st('vx_hay')); const [x2, z2] = at(w - 3, 1); put(x2, gy(x2, z2) + 1, z2, st('vx_hay')); }
    const su = w - 5, sv = d - 5, [bx, bz] = at(su + 1, sv + 1), by = gy(bx, bz);
    for (const [a, b] of [[0, 0], [3, 0], [0, 3], [3, 3]]) { const [x, z] = at(su + a, sv + b); for (let y = gy(x, z) + 1; y <= by + 3; y++) put(x, y, z, st('vx_beam_oak', { axis: 0 })); }
    const roofN = 'vx_roof_' + (rng.chance(0.5) ? 'red' : 'thatch');
    for (let a = -1; a <= 4; a++) for (let b = 0; b <= 3; b++) { const [x, z] = at(su + a, sv + b); put(x, by + 4, z, st(roofN, { facing: (Pa.r + 2) & 3 })); }
    const [cx, cz] = at(w >> 1, d >> 1);
    LAND.addSpawn(P, ['fauna', 'sheep', cx, gy(cx, cz) + 1, cz, 4 + rng.int(3), Pa.rect[0] + 1, Pa.rect[1] + 1, Pa.rect[2] - 1, Pa.rect[3] - 1], cx, cz);
    P.pieces.push({ kind: 'pasture', x: cx, z: cz, y: gy(cx, cz), farm: site.id, rect: Pa.rect });
  }
  function orchard(g, P, K, Or, w, d, gy, rng, site) {
    const put = K.put, at = (u, v) => { const q = ROT4[Or.r](u, v); return [Or.ox + q[0], Or.oz + q[1]]; };
    const fruit = ['apple', 'apple', 'plum', 'cherry', 'orange'][rng.int(5)], TR = st('vx_fruit_trunk'), CR = st('vx_fruit_crown_' + fruit);
    let n = 0;
    for (let u = 2; u <= w - 3; u += 4) for (let v = 2; v <= d - 3; v += 4) {
      const [x, z] = at(u, v), y = gy(x, z);
      put(x, y + 1, z, TR); put(x, y + 2, z, TR);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { put(x + a, y + 3, z + b, CR); if (a === 0 || b === 0) put(x + a, y + 4, z + b, CR); }
      n++;
    }
    for (let u = 0; u < w; u++) for (let v = 0; v < d; v++) { const [x, z] = at(u, v); if (h01(x, z, 63) < 0.12) put(x, gy(x, z) + 1, z, st(h01(x, z, 64) < 0.5 ? 'dandelion' : 'short_grass')); }
    { const [x, z] = at(0, 0); put(x, gy(x, z) + 1, z, st('vx_veg_crate', { facing: 0 })); }
    const [cx, cz] = at(w >> 1, d >> 1);
    P.pieces.push({ kind: 'orchard', x: cx, z: cz, y: gy(cx, cz), fruit, trees: n, farm: site.id, rect: Or.rect });
  }
  function vineyard(g, P, K, Vy, w, d, gy, site) {
    const put = K.put, at = (u, v) => { const q = ROT4[Vy.r](u, v); return [Vy.ox + q[0], Vy.oz + q[1]]; };
    const POST = st('oak_fence'), VINE = st('azalea_leaves', { persistent: 1, distance: 1 }), GRAPE = st('sweet_berry_bush', { age: 3 });
    let rows = 0;
    for (let u = 1; u < w - 1; u += 3) {
      for (let v = 1; v < d - 1; v++) {
        const [x, z] = at(u, v), y = gy(x, z);
        put(x, y, z, st('coarse_dirt'));
        for (let yy = y + 1; yy <= y + 3; yy++) put(x, yy, z, 0);
        if (v % 4 === 1) { put(x, y + 1, z, POST); put(x, y + 2, z, POST); put(x, y + 3, z, VINE); }
        else { put(x, y + 1, z, h01(x, z, 65) < 0.3 ? GRAPE : VINE); put(x, y + 2, z, VINE); }
      }
      rows++;
    }
    const [cx, cz] = at(w >> 1, d >> 1);
    P.pieces.push({ kind: 'vineyard', x: cx, z: cz, y: gy(cx, cz), rows, farm: site.id, rect: Vy.rect });
  }
  function flowerField(g, P, K, Fw, w, d, gy, kind, site) {
    const put = K.put, at = (u, v) => { const q = ROT4[Fw.r](u, v); return [Fw.ox + q[0], Fw.oz + q[1]]; }, F = Math.max(Fw.lo, Fw.F);
    for (let u = 0; u < w; u++) for (let v = 0; v < d; v++) {
      const [x, z] = at(u, v), y0 = gy(x, z);
      for (let y = y0 + 1; y < F; y++) put(x, y, z, st('dirt'));
      for (let y = F + 1; y <= Math.max(F + 3, y0 + 1); y++) put(x, y, z, 0);
      const row = u % 2 === 0;
      put(x, F, z, row ? st('grass_block') : st('coarse_dirt'));
      if (row) { if (kind === 'sunflower') { put(x, F + 1, z, st('sunflower', { half: 0 })); put(x, F + 2, z, st('sunflower', { half: 1 })); } else put(x, F + 1, z, st('allium')); }
    }
    const [cx, cz] = at(w >> 1, d >> 1);
    P.pieces.push({ kind: 'flowers', flower: kind, x: cx, z: cz, y: F, farm: site.id, rect: Fw.rect });
  }
  // the windmill: a white tower on a fieldstone base, a pointed roof, four sails round a hub on the face toward the
  // yard; the hub is the pivot (a `windmill` spawn records it for a later turning)
  function windmill(g, P, K, Wm, gy, rng, site) {
    const put = K.put, at = (u, v) => { const q = ROT4[Wm.r](u, v); return [Wm.ox + q[0], Wm.oz + q[1]]; }, F = Wm.hi + 1, T = 10;
    const roofC = ['red', 'slate', 'terracotta', 'teal'][rng.int(4)], fr = (f) => (f + Wm.r) & 3;
    for (let u = 0; u < 5; u++) for (let v = 0; v < 5; v++) {
      const [x, z] = at(u, v), y0 = gy(x, z), corner = (u === 0 || u === 4) && (v === 0 || v === 4), edge = u === 0 || v === 0 || u === 4 || v === 4;
      for (let y = y0 + 1; y < F; y++) put(x, y, z, st('vx_fieldstone'));
      put(x, F, z, st('vx_floor_oak'));
      for (let y = F + 1; y <= F + T; y++) put(x, y, z, edge && !(corner && y > F + 2) ? (y <= F + 2 ? st('vx_fieldstone') : st('vx_plaster_white')) : 0);
      if (corner) for (let y = F + 3; y <= F + T; y++) put(x, y, z, 0);
    }
    // the corners stepped in above the base: the round tower's octagon
    for (const [u, v] of [[1, 0], [3, 0], [0, 1], [0, 3], [4, 1], [4, 3], [1, 4], [3, 4]]) { const [x, z] = at(u, v); for (let y = F + 3; y <= F + T; y++) put(x, y, z, st('vx_plaster_white')); }
    const [dx, dz] = at(2, 0); put(dx, F + 1, dz, st('oak_door', { facing: fr(0), half: 0, hinge: 0, open: 0 })); put(dx, F + 2, dz, st('oak_door', { facing: fr(0), half: 1, hinge: 0, open: 0 }));
    { const [x, z] = at(2, 0); put(x, F + 5, z, st('vx_window_round', { facing: fr(0) })); }
    for (let u = 0; u < 5; u++) for (let v = 0; v < 5; v++) {
      const ring = Math.max(Math.abs(u - 2), Math.abs(v - 2)), f = Math.abs(u - 2) >= Math.abs(v - 2) ? (u < 2 ? 3 : 1) : (v < 2 ? 0 : 2), [x, z] = at(u, v);
      if (ring === 2) put(x, F + T + 1, z, st('vx_roof_' + roofC, { facing: fr(f) }));
      else if (ring === 1) put(x, F + T + 2, z, st('vx_roof_' + roofC, { facing: fr(f) }));
      else { put(x, F + T + 3, z, st('vx_ridge_' + roofC, { facing: fr(0) })); }
    }
    // the hub (pivot) one out from the front wall's middle, the sails in a cross round it
    const hy = F + T - 2, [hx, hz] = at(2, -1);
    put(hx, hy, hz, st('oak_log', { axis: (Wm.r & 1) ? 1 : 2 }));
    const SAIL = st('vx_windmill_sail', { facing: fr(0) });
    for (let k = 1; k <= 4; k++) {
      const [lx, lz] = at(2 - k, -1), [rx, rz] = at(2 + k, -1);
      put(lx, hy, lz, SAIL); put(rx, hy, rz, SAIL); put(hx, hy + k, hz, SAIL); if (hy - k > F + 1) put(hx, hy - k, hz, SAIL);
    }
    { const [x, z] = at(2, 2); put(x, F + 1, z, st('vx_hay')); put(x, F + 4, z, st('lantern', { hanging: 0 })); }
    LAND.addSpawn(P, ['windmill', hx, hy, hz, fr(0)], hx, hz);
    P.pieces.push({ kind: 'windmill', x: hx, z: hz, y: hy, hub: [hx, hy, hz], farm: site.id, rect: Wm.rect });
  }

  // ============================================================================ the water
  // The lake's sand beach and the river's gravel bars, reed belts in stretches along both, the waterfall over the river's
  // head (a spring on the cliff top, its outlet over the lip, the curtain down into the pool, a cave behind it, mist at
  // its foot), a ford of stepping stones below it, lily ponds in the meadows and the woods (a closed bowl, lily pads,
  // reeds, ducks), a lighthouse on the lake's south-west point, a fishing hut with a pier on its north-west beach, and
  // mist where the Sky Isles' falls meet the lake.
  let WS = null;
  const wstates = () => WS || (WS = { WATER: st('water'), FALL: st('water', { level: 8 }), SAND: st('sand'), GRAVEL: st('gravel'), CLAY: st('clay'), COARSE: st('coarse_dirt'), GRASS: st('grass_block'), DIRT: st('dirt'),
    CANE: st('sugar_cane'), LILY: st('lily_pad'), SEAG: st('seagrass'), MCOB: st('mossy_cobblestone'), MOSS: st('moss_block'), STONE: st('stone') });
  // the banks: per column, near the river's water or on the lake's beach
  function dressWater(g, P, cx, cz, out) {
    const blocks = out.blocks, x0 = cx * 16, z0 = cz * 16, W = wstates(), T = R.T, Rv = LAND.river(g);
    const Lk = LAND.LAKE, nearLake = Math.abs(x0 + 8 - Lk.x) < Lk.rx * 1.6 && Math.abs(z0 + 8 - Lk.z) < Lk.rx * 1.6;
    const b = Rv.box, nearRiver = x0 + 16 > b[0] - 30 && x0 < b[2] + 30 && z0 + 16 > b[1] - 30 && z0 < b[3] + 30;
    if (!nearLake && !nearRiver) return;
    const isW = (col, y) => blocks[(y << 8) | col] === W.WATER;
    for (let col = 0; col < 256; col++) {
      const lx = col & 15, lz = col >> 4, x = x0 + lx, z = z0 + lz;
      if (LAND.zoneAt(g, x, z) || (LAND.keepAt(P, x, z) & (1 | 2 | 16))) continue;
      const y = topOf(blocks, col, 120); if (y < SEA - 1 || y > SEA + 4) continue;
      const top = blocks[(y << 8) | col]; if (top !== W.GRASS && top !== W.SAND && top !== W.DIRT) continue;
      // water next to this column (in the chunk), at the sea's level
      let wet = false; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = lx + dx, nz = lz + dz; if (nx < 0 || nz < 0 || nx > 15 || nz > 15) continue; if (isW((nz << 4) | nx, SEA)) { wet = true; break; } }
      const pn = g.nLandR.n2(x * 0.7, z * 0.7), h = h01(x, z, g.seed ^ 0xbea);
      let kind = 0;   // 1 the beach, 2 a river bank
      if (nearLake) { const q = LAND.lakeQ(g, x, z); if (q > 0.96 && q < 1.16) kind = q < 1.12 || h < (1.16 - q) * 25 ? 1 : 0; }
      if (!kind && nearRiver) { const rq = LAND.riverAt(g, x, z, 14); if (rq && rq.d < Math.max(LAND.riverWb(rq.t), rq.s < 14 ? LAND.HEAD_R : 0) + 5.5) kind = 2; }
      if (!kind) continue;
      const ai = ((y + 1) << 8) | col;
      if (kind === 1) {
        for (let k = 0; k < 3; k++) { const i = ((y - k) << 8) | col; if (blocks[i] === W.GRASS || blocks[i] === W.DIRT) blocks[i] = W.SAND; }
        if (blocks[ai] && (T.flags[blocks[ai]] & F.PLANT)) blocks[ai] = 0;
        if (wet && pn > 0.3 && h < 0.55) { const n = 1 + ((h * 7) | 0) % 3; for (let k = 1; k <= n; k++) if (!blocks[((y + k) << 8) | col]) blocks[((y + k) << 8) | col] = W.CANE; }
      } else {
        const s = pn > 0.25 ? W.GRAVEL : pn > -0.1 ? (h < 0.5 ? W.SAND : W.GRAVEL) : pn > -0.3 ? W.COARSE : 0;
        if (s) { blocks[(y << 8) | col] = s; if (blocks[((y - 1) << 8) | col] === W.DIRT || blocks[((y - 1) << 8) | col] === W.GRASS) blocks[((y - 1) << 8) | col] = s === W.COARSE ? W.DIRT : s; if (blocks[ai] && (T.flags[blocks[ai]] & F.PLANT)) blocks[ai] = 0; }
        if (wet && pn < 0.15 && g.nLandD.n2(x * 1.3, z * 1.3) > -0.05) { const n = 1 + ((h * 11) | 0) % 3; for (let k = 1; k <= n; k++) if (!blocks[((y + k) << 8) | col]) blocks[((y + k) << 8) | col] = W.CANE; }
      }
    }
    // the shallows: seagrass on the lake's sand shelf
    if (nearLake) for (let col = 0; col < 256; col++) {
      const x = x0 + (col & 15), z = z0 + (col >> 4);
      if (!isW(col, SEA)) continue;
      let y = SEA; while (y > 40 && isW(col, y)) y--;
      if (SEA - y < 2 || SEA - y > 5 || !blocks[(y << 8) | col]) continue;
      if (h01(x, z, g.seed ^ 0x5ea) < 0.16 && g.nLandD.n2(x, z) > 0) blocks[((y + 1) << 8) | col] = W.SEAG;
    }
  }
  LAND.DRESS.push(dressWater);

  // ---- the waterfall over the river's head, its cave, the ford below it
  LAND.PIECES.push(Object.assign(function falls(g, P, K) {
    const W = wstates(), gy = groundOf(g, P), Fa = LAND.falls(g), put = K.put;
    const [ux, uz] = Fa.dir, px = -uz, pz = ux, top = Fa.top;
    if (top < SEA + 10) return;
    const at = (k, o) => [Math.round(Fa.spring[0] + ux * k + px * o), Math.round(Fa.spring[1] + uz * k + pz * o)];
    // the spring: a little round pool behind the lip
    for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
      const d = Math.hypot(dx, dz); if (d > 2.6) continue;
      const x = Fa.spring[0] + dx, z = Fa.spring[1] + dz, y0 = gy(x, z);
      put(x, top - 2, z, W.MCOB); put(x, top - 1, z, W.WATER); put(x, top, z, W.WATER);
      for (let y = top + 1; y <= Math.max(y0, top) + 2; y++) put(x, y, z, 0);
    }
    // the outlet to the lip, then the water down the wall: three wide, over every step of the wall from the lip to the
    // pool (a cascade hugging the rock), and a last free curtain over the pool in front of the cave's mouth
    let k = 1; const curtain = [];
    for (; k < 18; k++) {
      const [cx0, cz0] = at(k, 0), g0 = gy(cx0, cz0);
      if (g0 < top - 2) break;
      for (let o = -1; o <= 1; o++) { const [x, z] = at(k, o); put(x, top - 1, z, W.MCOB); put(x, top, z, W.WATER); for (let y = top + 1; y <= gy(x, z) + 2; y++) put(x, y, z, 0); }
    }
    const [hx0, hz0] = Fa.head, rLip = Math.round(Math.hypot(at(k, 0)[0] - hx0, at(k, 0)[1] - hz0));
    const wall = (r, o) => [Math.round(hx0 - ux * r + px * o), Math.round(hz0 - uz * r + pz * o)];
    for (let o = -1; o <= 1; o++) {
      let from = top;
      for (let r = rLip; r >= LAND.HEAD_R - 1; r--) {
        const [x, z] = wall(r, o), g0 = r >= LAND.HEAD_R ? gy(x, z) : SEA;
        const lo = Math.max(g0 + 1, SEA + 1);
        for (let y = from; y >= lo; y--) put(x, y, z, W.FALL);
        if (o === 0 || curtain.length < 2) curtain.push([x, z]);
        else curtain.push([x, z]);
        from = Math.max(lo, g0);
        if (r === LAND.HEAD_R - 1) break;
      }
    }
    // the cave behind the curtain: into the wall at the pool's level, three wide, four high, eight deep
    const [hx, hz] = Fa.head, back = (r, o) => [Math.round(hx - ux * r + px * o), Math.round(hz - uz * r + pz * o)];
    let cave = 0;
    for (let r = LAND.HEAD_R; r <= LAND.HEAD_R + 8; r++) for (let o = -1; o <= 1; o++) {
      const [x, z] = back(r, o), g0 = gy(x, z); if (g0 < SEA + 6) continue;
      put(x, SEA, z, r > LAND.HEAD_R + 6 ? W.MOSS : W.MCOB);
      for (let y = SEA + 1; y <= SEA + 4; y++) put(x, y, z, 0);
      if (o === 0 && r === LAND.HEAD_R + 7) put(x, SEA + 1, z, st('lantern', { hanging: 0 }));
      else if (h01(x, z, 81) < 0.25) put(x, SEA + 1, z, st(h01(x, z, 82) < 0.5 ? 'brown_mushroom' : 'red_mushroom'));
      put(x, SEA + 5, z, h01(x, z, 83) < 0.3 ? W.MOSS : W.STONE);
      cave++;
    }
    const [mx, mz] = curtain.length ? curtain[(curtain.length / 2) | 0] : Fa.edge;
    LAND.addSpawn(P, ['mist', mx, SEA + 1, mz, 3], mx, mz);
    markDisc(P, Fa.spring[0], Fa.spring[1], 5, LAND.KEEP.PIECE);
    P.pieces.push({ kind: 'waterfall', x: mx, z: mz, y: SEA + 1, top, spring: Fa.spring.slice(), curtain, cave });
    // the ford: stepping stones over the river a little below the pool
    const Rv = LAND.river(g), i = Math.min(Rv.pts.length - 2, 46), p0 = Rv.pts[i], p1 = Rv.pts[i + 1], tx = p1[0] - p0[0], tz = p1[1] - p0[1], tl = Math.hypot(tx, tz) || 1;
    const wb = LAND.riverWb(i / Rv.len) + 2.5, stones = [];
    for (let o = -wb; o <= wb; o += 1) {
      const x = Math.round(p0[0] - tz / tl * o), z = Math.round(p0[1] + tx / tl * o);
      if (gy(x, z) >= SEA) continue;
      if ((Math.round(o) & 1) === 0) { put(x, SEA, z, W.MCOB); for (let y = gy(x, z) + 1; y < SEA; y++) put(x, y, z, W.STONE); stones.push([x, z]); }
    }
    P.pieces.push({ kind: 'ford', x: Math.round(p0[0]), z: Math.round(p0[1]), y: SEA, stones });
  }, { order: 2 }));
  // ---- lily ponds: closed bowls in the meadows and the woods, near a way
  LAND.PIECES.push(Object.assign(function ponds(g, P, K) {
    const W = wstates(), gy = groundOf(g, P), put = K.put, got = [];
    const cand = [];
    for (let z = -620; z <= 620; z += 44) for (let x = -620; x <= 620; x += 44) {
      const px = x + Math.round((h01(x, z, g.seed ^ 91) - 0.5) * 30), pz = z + Math.round((h01(z, x, g.seed ^ 92) - 0.5) * 30);
      if (px * px + pz * pz > 610 * 610 || LAND.zoneAt(g, px, pz) || LAND.keepAt(P, px, pz)) continue;
      cand.push([px, pz, h01(px, pz, g.seed ^ 93)]);
    }
    cand.sort((a, b) => a[2] - b[2]);
    for (const [x, z] of cand) {
      if (got.length >= 7) break;
      if (got.some(c => Math.hypot(c[0] - x, c[1] - z) < 160)) continue;
      let dw = 1e9; for (const c of P.cells.values()) { const d = (c.x - x) ** 2 + (c.z - z) ** 2; if (d < dw) dw = d; }
      dw = Math.sqrt(dw); if (dw < 14 || dw > 70) continue;
      const R0 = 4.5 + h01(x, z, 94) * 3, ph = h01(x, z, 95) * 6.283, rad = (a) => R0 * (1 + 0.22 * Math.sin(3 * a + ph) + 0.12 * Math.sin(5 * a + 2 * ph));
      // the level: one under the lowest ground of the ring round the bowl
      let L = 999, hi = -999, ok = true;
      for (let a = 0; a < 6.283; a += 0.2) { const r = rad(a) + 1.6, qx = Math.round(x + Math.cos(a) * r), qz = Math.round(z + Math.sin(a) * r); if (LAND.zoneAt(g, qx, qz) || (LAND.keepAt(P, qx, qz) & 3)) { ok = false; break; } const y = gy(qx, qz); L = Math.min(L, y - 1); hi = Math.max(hi, y); }
      if (!ok || L <= SEA + 2 || hi - L > 6) continue;
      got.push([x, z]);
      const reach = Math.ceil(R0 * 1.4 + 3); let water = 0, lilies = 0, reeds = 0;
      for (let dz = -reach; dz <= reach; dz++) for (let dx = -reach; dx <= reach; dx++) {
        const qx = x + dx, qz = z + dz, d = Math.hypot(dx, dz), a = Math.atan2(dz, dx), r = rad(a), y0 = gy(qx, qz);
        if (d < r) {
          const depth = 1 + Math.round(2.4 * (1 - d / r)), bot = L - depth;
          put(qx, bot, qz, h01(qx, qz, 96) < 0.4 ? W.CLAY : W.DIRT);
          for (let y = bot + 1; y <= L; y++) put(qx, y, qz, W.WATER);
          for (let y = L + 1; y <= y0 + 2; y++) put(qx, y, qz, 0);
          water++;
          if (d < r - 0.8 && h01(qx, qz, 97) < 0.2) { put(qx, L + 1, qz, W.LILY); lilies++; }
        } else if (d < r + 2.5) {
          // the bowl's rim: never lower than one over the water (a closed bowl), reeds and orchids on it
          if (y0 < L + 1) { for (let y = y0 + 1; y < L + 1; y++) put(qx, y, qz, W.DIRT); put(qx, L + 1, qz, W.GRASS); }
          const ry = Math.max(y0, L + 1);
          if (d < r + 1.2 && h01(qx, qz, 98) < 0.4) { const n = 1 + ((h01(qx, qz, 99) * 3) | 0); for (let k = 1; k <= n; k++) put(qx, ry + k, qz, W.CANE); reeds++; }
          else if (h01(qx, qz, 100) < 0.15) put(qx, ry + 1, qz, st(h01(qx, qz, 101) < 0.5 ? 'blue_orchid' : 'azure_bluet'));
        }
      }
      markDisc(P, x, z, Math.ceil(R0 * 1.3) + 3, LAND.KEEP.POND);
      LAND.addSpawn(P, ['fauna', 'duck', x, L + 1, z, 2 + (h01(x, z, 102) * 3 | 0), Math.round(R0)], x, z);
      P.pieces.push({ kind: 'pond', x, z, y: L, r: R0, water, lilies, reeds });
    }
  }, { order: 3 }));
  // ---- the lighthouse on the lake's south-west point, the fishing hut and its pier on the north-west beach
  LAND.PIECES.push(Object.assign(function lakeside(g, P, K) {
    const W = wstates(), gy = groundOf(g, P), put = K.put, Lk = LAND.LAKE;
    // the lighthouse: the driest point of the shore between south and west that has water within four blocks
    let best = null;
    for (let a = 1.75; a <= 2.6; a += 0.05) {
      const [sx, sz] = LAND.shoreAt(g, a, 1.07), y = gy(sx, sz);
      if (y < SEA + 1 || LAND.zoneAt(g, sx, sz) || (LAND.keepAt(P, sx, sz) & 3)) continue;
      let wet = 0; for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) if (gy(sx + dx, sz + dz) < SEA) wet++;
      const score = wet + h01(sx, sz, 103);
      if (wet >= 6 && (!best || score > best.score)) best = { x: sx, z: sz, y, score };
    }
    if (best) {
      const { x, z } = best, F = best.y + 1, H = 20;
      const towards = Math.atan2(Lk.z - z, Lk.x - x), door = FACE4(-Math.cos(towards), -Math.sin(towards));
      for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
        const d = Math.hypot(dx, dz), qx = x + dx, qz = z + dz, y0 = gy(qx, qz);
        if (d <= 3.5) { for (let y = Math.min(y0, SEA - 1); y < F; y++) put(qx, y, qz, st('stone_bricks')); put(qx, F, qz, st('stone_bricks')); }
        if (d <= 3.0) for (let y = F + 1; y <= F + H; y++) {
          const shell = d > 2.0;
          if (!shell) { put(qx, y, qz, 0); continue; }
          const band = ((y - F - 1) >> 2) & 1;
          put(qx, y, qz, y <= F + 2 ? st('stone_bricks') : band ? st('red_concrete') : st('white_concrete'));
        }
      }
      // door, windows, a ladder up the inside
      const dv = [[0, -1], [1, 0], [0, 1], [-1, 0]][door], [ddx, ddz] = [dv[0] * 3, dv[1] * 3];
      put(x + ddx, F + 1, z + ddz, st('oak_door', { facing: door, half: 0, hinge: 0, open: 0 })); put(x + ddx, F + 2, z + ddz, st('oak_door', { facing: door, half: 1, hinge: 0, open: 0 }));
      for (let y = F + 6; y < F + H; y += 5) { put(x - dv[0] * 3, y, z - dv[1] * 3, st('glass_pane')); put(x + dv[1] * 3, y + 2, z - dv[0] * 3, st('glass_pane')); }
      const lad = (door + 2) & 3, lv = [[0, -1], [1, 0], [0, 1], [-1, 0]][lad];
      for (let y = F + 1; y <= F + H; y++) put(x + lv[0], y, z + lv[1], st('ladder', { facing: door }));
      // the gallery: a slab ring with a railing, the lantern room (glass round a cluster of lamps), the cap
      const G = F + H + 1;
      for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) {
        const d = Math.hypot(dx, dz), qx = x + dx, qz = z + dz;
        if (d <= 3.9) put(qx, G, qz, st('stone_brick_slab', { type: 0 }) || st('stone_bricks'));
        if (d > 3.0 && d <= 3.9) put(qx, G + 1, qz, st('oak_fence'));
        if (d <= 1.6) { put(qx, G + 1, qz, d < 0.5 ? st('tide_lantern') : st('glass')); put(qx, G + 2, qz, d < 0.5 ? st('tide_lantern') : st('glass')); put(qx, G + 3, qz, st('red_concrete')); }
        if (d <= 0.5) put(qx, G + 4, qz, st('red_concrete'));
      }
      put(x + lv[0], G, z + lv[1], 0);
      LAND.addSpawn(P, ['lighthouse', x, G + 2, z], x, z);
      markDisc(P, x, z, 7, LAND.KEEP.PIECE);
      P.pieces.push({ kind: 'lighthouse', x, z, y: F, top: G + 4, lamp: [x, G + 1, z] });
    }
    // the fishing hut: on the beach by the 'beach' site, the pier from the waterline out into the lake
    const site = P.sites.find(s => s.kind === 'beach');
    if (site) {
      const a = Math.atan2(site.z - Lk.z, site.x - Lk.x), ux = -Math.cos(a), uz = -Math.sin(a), px = -uz, pz = ux;   // u: toward the lake
      const [wx, wz] = LAND.shoreAt(g, a, 1.0);
      const hx = Math.round(site.x + px * 9), hz = Math.round(site.z + pz * 9);
      // the hut: 5 × 4, spruce, a thatch roof, its door to the lake
      const hy = Math.max(gy(hx, hz), SEA + 2) + 1, face = FACE4(ux, uz);
      const HR = [[-2, 2], [-2, 1]];
      for (let a2 = -2; a2 <= 2; a2++) for (let b2 = -2; b2 <= 1; b2++) {
        const x = Math.round(hx + px * a2 + ux * b2), z = Math.round(hz + pz * a2 + uz * b2), y0 = gy(x, z), edge = Math.abs(a2) === 2 || b2 === -2 || b2 === 1, corner = Math.abs(a2) === 2 && (b2 === -2 || b2 === 1);
        for (let y = Math.min(y0, hy - 1); y < hy; y++) put(x, y, z, st('spruce_log', { axis: 0 }));
        put(x, hy, z, st('spruce_planks'));
        for (let y = hy + 1; y <= hy + 3; y++) put(x, y, z, edge ? (corner ? st('spruce_log', { axis: 0 }) : st('spruce_planks')) : 0);
        put(x, hy + 4, z, st('vx_roof_thatch', { facing: b2 <= -1 ? (face + 2) & 3 : face }));
        if (b2 === -1 || b2 === 0) put(x, hy + 5, z, st('vx_ridge_thatch', { facing: (face + 1) & 3 }));
      }
      void HR;
      const dx0 = Math.round(hx + ux * 1), dz0 = Math.round(hz + uz * 1);
      put(dx0, hy + 1, dz0, st('spruce_door', { facing: face, half: 0, hinge: 0, open: 0 })); put(dx0, hy + 2, dz0, st('spruce_door', { facing: face, half: 1, hinge: 0, open: 0 }));
      { const x = Math.round(hx + px * 2 + ux * 0), z = Math.round(hz + pz * 2 + uz * 0); put(x, hy + 2, z, st('glass_pane')); }
      { const x = Math.round(hx - px * 1), z = Math.round(hz - pz * 1); put(x, hy + 1, z, st('barrel', { facing: 1, open: 0 })); put(Math.round(hx + px), hy + 1, Math.round(hz + pz), st('lantern', { hanging: 0 })); }
      // the pier: three wide, from two blocks behind the waterline to twelve out, on spruce posts, a lantern at its end
      const len = 14, Y = SEA + 1;
      let endX = wx, endZ = wz;
      for (let i = -2; i <= len; i++) for (let o = -1; o <= 1; o++) {
        const x = Math.round(wx + ux * i + px * o), z = Math.round(wz + uz * i + pz * o), y0 = gy(x, z);
        put(x, Y, z, st('spruce_planks'));
        for (let y = Y + 1; y <= Y + 3; y++) put(x, y, z, 0);
        if ((i % 4 === 0 || i === len) && o !== 0) for (let y = Math.min(y0 + 1, Y - 1); y < Y; y++) put(x, y, z, st('spruce_log', { axis: 0 }));
        if (o !== 0 && i > 0 && i % 2 === 0) put(x, Y + 1, z, st('spruce_fence'));
        if (i === len && o === 0) { endX = x; endZ = z; }
      }
      { const x = Math.round(wx + ux * len + px), z = Math.round(wz + uz * len + pz); put(x, Y + 1, z, st('spruce_fence')); put(x, Y + 2, z, st('lantern', { hanging: 0 })); }
      { const x = Math.round(wx + ux * (len - 2) - px), z = Math.round(wz + uz * (len - 2) - pz); put(x, Y + 1, z, st('barrel', { facing: 1, open: 0 })); }
      LAND.addSpawn(P, ['fauna', 'fish', endX, SEA, endZ, 3, 6], endX, endZ);
      markDisc(P, hx, hz, 5, LAND.KEEP.PIECE);
      for (let i = -3; i <= len; i += 2) { const x = Math.round(wx + ux * i), z = Math.round(wz + uz * i); markDisc(P, x, z, 3, LAND.KEEP.PIECE); }
      P.pieces.push({ kind: 'hut', x: hx, z: hz, y: hy }, { kind: 'pier', x: endX, z: endZ, y: Y, from: [wx, wz], dir: [ux, uz], len });
    }
    // the Sky Isles' falls: mist where they meet the lake (the fall's columns as gen_realm lays them)
    const ISL = VR.IslesGen;
    if (ISL && ISL.list && g.islandAt) for (const I of ISL.list(g)) {
      if (!I.falls || I.lava) continue;
      for (let f = 0; f < I.falls; f++) {
        const a = ((I.seed * 0.618 + f * 0.37) % 1) * Math.PI * 2;
        let fx = 0, fz = 0, ft = null;
        for (let r = 0; r < I.r * 1.4; r += 1) { const qx = Math.round(I.x + Math.cos(a) * r), qz = Math.round(I.z + Math.sin(a) * r), J = g.islandAt(qx, qz); if (J && J.isle === I) { fx = qx; fz = qz; ft = J; } else if (ft) break; }
        if (!ft) continue;
        const o1 = [Math.round(Math.cos(a)), Math.round(Math.sin(a))], x = fx + o1[0] - (o1[0] > 0 ? 1 : 0) + 1, z = fz + o1[1] - (o1[1] > 0 ? 1 : 0) + 1;
        const y = gy(x, z); if (y >= SEA) continue;
        LAND.addSpawn(P, ['mist', x, SEA + 1, z, 2], x, z);
        P.pieces.push({ kind: 'islefall', x, z, y: SEA + 1 });
      }
    }
  }, { order: 4 }));

  HEART.builders.push(function (g, cx, cz, out) {
    if (!LAND.on(g)) return;
    const x0 = cx * 16, z0 = cz * 16;
    if (Math.hypot(x0 + 8, z0 + 8) > 800) return;
    const P = LAND.plan(g), blocks = out.blocks;
    stampWays(g, P, cx, cz, blocks);
    stampOps(P, cx, cz, blocks);
    stampFurn(g, P, cx, cz, blocks);
    for (const fn of LAND.DRESS_WOODS) fn(g, P, cx, cz, out);
    for (const fn of LAND.DRESS) fn(g, P, cx, cz, out);
    const sp = P.spawns.get(cx * 4096 + cz);
    if (sp) { if (!out.spawns) out.spawns = []; for (const s of sp) out.spawns.push(s.slice()); }
  });
  LAND.addSpawn = (P, s, x, z) => { const k = chunkKey(x, z); let a = P.spawns.get(k); if (!a) { a = []; P.spawns.set(k, a); } a.push(s); };
})(VR);
