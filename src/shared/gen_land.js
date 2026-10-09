// ============================================================================
// The land between (t-land, vgen 10; docs/superpowers/plans/2026-10-09-t-land.md). The Heartland's sites — the Gate
// Temple, Nova Haven, the terraced hills, the station, the citadel, the canyon, the Sky Isles — stood on one empty
// green plain: the sky meadow had no tree, no grass tuft, no flower, no path. New worlds (vgen ≥ 10) get a landscape
// between them, procedural and deterministic from the seed:
//   · terrain shapes in the Heartland's design (HEART.design, so the chunks, the far ring and the horizon all see
//     them): a river valley from the Pod Hills' east shoulder to a lake under the Sky Isles, the lake with its
//     beaches, a rocky ridge in the west
//   · the land plan, once per world: the sites and a path network between them (A* over the designed land, a slope
//     limit, bridges), the farmsteads, the set pieces (lookout, shrine, lighthouse, fishing hut, camps, ponds)
//   · per chunk: the plan's pieces stamped over natural ground only, woods and groves with undergrowth, meadows with
//     tall grass and flower drifts, boulders, banks; spawn anchors for the animals and the waterfall's mist
// Older worlds keep every chunk (test/land_v9_same.js).
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
  const stCache = new Map();
  const st = (name, props) => { const key = props ? name + JSON.stringify(props) : name; let s = stCache.get(key); if (s !== undefined) return s; const t = R.byName[name]; s = t ? (props ? t.state(props) : t.defaultState) : 0; stCache.set(key, s); return s; };
  LAND.st = st;

  function noises(g) {
    if (g.nLand) return;
    const Fr = VR.Fractal, s = g.seed;
    g.nLand = new Fr(s ^ 0x1a4d01, 3, 1 / 240, 0.5);      // the woods
    g.nLand2 = new Fr(s ^ 0x1a4d02, 2, 1 / 70, 0.5);      // the woods' ragged edges
    g.nLandK = new Fr(s ^ 0x1a4d03, 2, 1 / 160, 0.5);     // which wood: birch, mixed, dark
    g.nLandD = new Fr(s ^ 0x1a4d04, 2, 1 / 34, 0.5);      // the flower drifts
    g.nLandW = new Fr(s ^ 0x1a4d05, 2, 1 / 90, 0.5);      // the lake's shore, the river's meanders
    g.nLandR = new Fr(s ^ 0x1a4d06, 2, 1 / 16, 0.5);      // rock, ground patches
  }
  LAND.noises = noises;

  // ---------------------------------------------------------------- the river
  // A fixed course from the Pod Hills' east shoulder (its head: a cirque with the waterfall) south past Nova Haven's
  // east side to the lake under the Sky Isles, jittered by the seed and meandering (two sines along the arc, faded at
  // both ends). Sampled about every block; a 32-block grid of the samples answers the distance queries.
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
    // arc length of the raw spline, then the meanders: an offset along the normal
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
    // resample every block of the meandering line
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
    const ca = Math.cos(L.a), sa = Math.sin(L.a), u = dx * ca + dz * sa, v = -dx * sa + dz * ca;
    const q = Math.sqrt((u / L.rx) ** 2 + (v / L.rz) ** 2), th = Math.atan2(v, u), ph = (g.seed & 1023) / 163;
    // lobes and bays: three slow waves round the shore and the noise
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
      const t = rq.t, wb = LAND.riverWb(t), bed = LAND.riverBed(t), Hl = D.H;
      const depth = Math.max(0, Hl - SEA), head = 1 - ss(0, 40, rq.s);
      const ws = lerp(Math.min(46, Math.max(12, 1.9 * depth)), Math.max(7, 0.42 * depth), head);
      const d1 = wb + 3, d2 = d1 + ws;
      if (rq.d < d2) {
        const H = rq.d <= wb ? bed : rq.d <= d1 ? lerp(bed, SEA + 1.2, ss(wb, d1, rq.d)) : lerp(SEA + 1.2, Hl, ss(d1, d2, rq.d));
        if (H < D.H) D.H = H;
        D.river = Math.max(D.river, 1 - ss(wb + 1.5, wb + 3.5, rq.d));
        D.A = lerp(D.A, 0.5, 1 - ss(d1, d2, rq.d));
        D.valley = rq.d / d2;
      }
    }
    return D;
  };
  if (HEART.design && !HEART._landShape) {
    const prevDesign = HEART.design;
    HEART.design = function (g, X, Z) { const D = prevDesign(g, X, Z); if (D && LAND.on(g)) LAND.shape(g, X, Z, D); return D; };
    HEART._landShape = true;
  }

  // ============================================================================ the land plan
  // Built once per world (per worker) from the terrain functions alone — no village site or plan is asked (a worker
  // job that met a missing one would stop: VG.probe), so the plan is the same in every thread.
  // A site: [id, x, z, kind]. The four anchors of the temple's plaza and Nova Haven's crescent ends join the network to
  // the designed streets; the crossroads are junctions in the open land (the shrine stands at the west one).
  LAND.SITES = [
    ['temple_w', -62, 80, 'temple'], ['temple_e', 66, 80, 'temple'], ['city_w', -116, -96, 'city'], ['city_e', 117, -96, 'city'],
    ['hills_w', -196, -262, 'hills'], ['hills_e', 196, -262, 'hills'], ['station', -290, -126, 'station'], ['canyon', -214, 124, 'canyon'],
    ['citadel', -452, 140, 'citadel'], ['beach', 262, 30, 'beach'], ['farm_w', -478, 38, 'farm'], ['farm_n', -96, -556, 'farm'],
    ['farm_e', 528, -236, 'farm'], ['lookout', -618, 40, 'lookout'], ['cross_w', -336, 28, 'cross'], ['cross_n', -250, -430, 'cross'],
    ['cross_e', 246, -150, 'cross'],
  ];
  // the cost grid for the routes: 16-block cells over the Heartland
  const GC = 16, GN = 88, G0 = -GC * GN / 2;
  // the designed grounds the routes keep out of: the temple with its plaza, the domed hall, Nova Haven's lots (an
  // ellipse that leaves the lawns beyond the crescent's ends free: the paths join the crescent there)
  const KEEP = [{ x0: -60, x1: 64, z0: -56, z1: 142 }, { x0: 46, x1: 88, z0: -26, z1: 16 }];
  const inBox = (x, z, b, m) => x >= b.x0 - m && x <= b.x1 + m && z >= b.z0 - m && z <= b.z1 + m;
  LAND.inCity = (x, z, m) => ((x - HEART.CITY.x) / (128 + (m || 0))) ** 2 + ((z + 125) / (96 + (m || 0))) ** 2 < 1;
  function costGrid(g) {
    const H = new Float32Array(GN * GN), K = new Float32Array(GN * GN), W = new Uint8Array(GN * GN);
    const T8 = VR.HillsGen && VR.HillsGen.T8;
    for (let j = 0; j < GN; j++) for (let i = 0; i < GN; i++) {
      const X = G0 + i * GC + GC / 2, Z = G0 + j * GC + GC / 2, k = j * GN + i;
      const D = Math.hypot(X, Z) > 650 ? null : HEART.design(g, X, Z);
      let kk = 1;
      if (!D) kk = Infinity;
      else {
        H[k] = D.H;
        if (LAND.inCity(X, Z, 0) || KEEP.some(b => inBox(X, Z, b, 4))) kk = Infinity;
        else if (T8 && inBox(X, Z, T8, 10)) kk = Infinity;
        else if (D.cz > 0.25 && D.plat < 0.5) kk = Infinity;
        else if (D.peak > 0.2 || D.mount > 0.3) kk = Infinity;
        else if (D.lake !== undefined && D.lake < 1.02) kk = Infinity;
        else if (D.H < SEA + 0.5) { W[k] = D.river > 0.5 ? 1 : 2; kk = W[k] === 1 ? 4 : 6; }
        else if (D.hills > 0.5) kk = 1.6;
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
    const bi = b % GN, bj = (b / GN) | 0, hz = (k) => Math.hypot((k % GN) - bi, ((k / GN) | 0) - bj) * GC * 0.9;
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
        const len = (di && dj) ? GC * 1.4142 : GC, sl = Math.abs(G.H[n] - hk0) / len;
        if (sl > 0.62 && n !== b && k !== a) continue;
        let c = len * kf * (1 + 7 * Math.max(0, sl - 0.06) + 30 * Math.max(0, sl - 0.3));
        if (G.W[n] === 1) c += 70; else if (G.W[n] === 2) c += 90;
        if (used && used[n]) c *= 0.55;
        const ng = gs[k] + c; if (ng < gs[n] && hn < hk.length) { gs[n] = ng; from[n] = k; push(n, ng + hz(n)); }
      }
    }
    if (!(gs[b] < Infinity)) return null;
    const cells = []; for (let k = b; k >= 0; k = from[k]) { cells.push(k); if (k === a) break; }
    return { cost: gs[b], cells: cells.reverse() };
  }
  const cellOf = (x, z) => Math.max(0, Math.min(GN - 1, Math.floor((z - G0) / GC))) * GN + Math.max(0, Math.min(GN - 1, Math.floor((x - G0) / GC)));
  const cellXZ = (k) => [G0 + (k % GN) * GC + GC / 2, G0 + ((k / GN) | 0) * GC + GC / 2];

  // the sites of a world: the fixed ones, the farms a little moved by the seed
  LAND.sites = function (g) {
    const rng = new VR.RNG((g.seed ^ 0x5173) >>> 0);
    return LAND.SITES.map(([id, x, z, kind]) => { const j = kind === 'farm' ? 22 : 0; return { id, x: Math.round(x + (rng.next() - 0.5) * j), z: Math.round(z + (rng.next() - 0.5) * j), kind }; });
  };
  // the network: the 3 nearest sites of every site are candidates, routed by A*; a minimum spanning tree over the
  // routes' costs, then the shortcuts that save more than 40 % of the way round the tree
  LAND.network = function (g, sites) {
    const G = costGrid(g), n = sites.length, cand = new Map();
    const key = (a, b) => a < b ? a * 100 + b : b * 100 + a;
    for (let a = 0; a < n; a++) {
      const near = sites.map((s, b) => [Math.hypot(s.x - sites[a].x, s.z - sites[a].z), b]).filter(q => q[1] !== a).sort((p, q) => p[0] - q[0]).slice(0, 3);
      for (const [, b] of near) cand.set(key(a, b), [Math.min(a, b), Math.max(a, b)]);
    }
    const used = new Uint8Array(GN * GN), routes = [];
    // the candidates in order of their straight length (the short ones first lay the trunk the longer ones merge into)
    const list = [...cand.values()].sort((p, q) => Math.hypot(sites[p[0]].x - sites[p[1]].x, sites[p[0]].z - sites[p[1]].z) - Math.hypot(sites[q[0]].x - sites[q[1]].x, sites[q[0]].z - sites[q[1]].z));
    for (const [a, b] of list) {
      const r = astar(G, cellOf(sites[a].x, sites[a].z), cellOf(sites[b].x, sites[b].z), null);
      if (r) routes.push({ a, b, cost: r.cost, cells: r.cells });
    }
    // Kruskal
    const par = sites.map((_, i) => i), find = (i) => par[i] === i ? i : (par[i] = find(par[i]));
    const tree = [], rest = [];
    for (const r of routes.slice().sort((p, q) => p.cost - q.cost)) { const fa = find(r.a), fb = find(r.b); if (fa !== fb) { par[fa] = fb; tree.push(r); } else rest.push(r); }
    // the tree's cost between two sites (a walk over the tree)
    const adj = sites.map(() => []); for (const r of tree) { adj[r.a].push([r.b, r.cost]); adj[r.b].push([r.a, r.cost]); }
    const treeCost = (a, b) => { const seen = new Set([a]), st = [[a, 0]]; while (st.length) { const [u, c] = st.pop(); if (u === b) return c; for (const [v, w] of adj[u]) if (!seen.has(v)) { seen.add(v); st.push([v, c + w]); } } return Infinity; };
    const edges = tree.slice();
    for (const r of rest.sort((p, q) => p.cost - q.cost)) { if (edges.length >= tree.length + 3) break; if (r.cost < 0.6 * treeCost(r.a, r.b)) edges.push(r); }
    // the final routes again, now merging into the ones laid before them
    const out = [];
    for (const r of edges.sort((p, q) => p.cost - q.cost)) {
      const rr = astar(G, cellOf(sites[r.a].x, sites[r.a].z), cellOf(sites[r.b].x, sites[r.b].z), used) || r;
      for (const c of rr.cells) used[c] = 1;
      out.push({ a: r.a, b: r.b, cells: rr.cells });
    }
    return out;
  };
  // a route's line: the anchors and the cell centres, smoothed three times (Chaikin), then a point every block
  function routeLine(sites, r) {
    let P = [[sites[r.a].x, sites[r.a].z]];
    for (let i = 1; i < r.cells.length - 1; i++) P.push(cellXZ(r.cells[i]));
    P.push([sites[r.b].x, sites[r.b].z]);
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
    out.push([P[P.length - 1][0], P[P.length - 1][1]]);
    return out;
  }
  LAND.SLOPE = 0.4;   // the path's grade along its line: one block up in two and a half
  // the profile of a line over the land: the ground smoothed, a bridge deck over water (SEA + 2, over the river a
  // stone arch at SEA + 5), the grade limited both ways (the decks are floors the limit keeps)
  function profile(g, pts) {
    const n = pts.length, gr = new Float64Array(n), wet = new Uint8Array(n), floor = new Float64Array(n).fill(-1e9);
    // the ground every second point (a corner of the generator serves four blocks; the points between take the mean)
    for (let i = 0; i < n; i += 2) {
      const x = Math.round(pts[i][0]), z = Math.round(pts[i][1]), y = g.surfaceY(x, z);
      gr[i] = y;
      if (y < SEA) { const rq = LAND.riverAt(g, x, z, 12); wet[i] = rq && rq.d < LAND.riverWb(rq.t) + 2.5 ? 1 : 2; }
    }
    if (!(n & 1)) { const x = Math.round(pts[n - 1][0]), z = Math.round(pts[n - 1][1]); gr[n - 1] = g.surfaceY(x, z); if (gr[n - 1] < SEA) wet[n - 1] = 2; }
    for (let i = 1; i < n - 1; i += 2) { gr[i] = (gr[i - 1] + gr[i + 1]) / 2; wet[i] = Math.min(wet[i - 1] || 9, wet[i + 1] || 9); if (wet[i] === 9) wet[i] = 0; }
    for (let i = 0; i < n; i++) if (wet[i]) floor[i] = SEA + (wet[i] === 1 ? 5 : 2);
    // (a river crossing's banks belong to the arch: the floor runs on two blocks past the water)
    for (let i = 0; i < n; i++) if (wet[i] === 1) for (let k = -3; k <= 3; k++) { const q = i + k; if (q >= 0 && q < n && !wet[q]) floor[q] = Math.max(floor[q], SEA + 5 - Math.abs(k) * 0); }
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) { let s = 0, c = 0; for (let k = -4; k <= 4; k++) { const q = i + k; if (q >= 0 && q < n) { s += wet[q] ? floor[q] : gr[q]; c++; } } y[i] = s / c; }
    // the floors' envelope (each floor reaches out at the grade), then the grade both ways
    const env = new Float64Array(n).fill(-1e9), L = LAND.SLOPE;
    for (let i = 0; i < n; i++) if (floor[i] > -1e8) for (let q = 0; q < n; q++) { const v = floor[i] - L * Math.abs(q - i); if (v > env[q]) env[q] = v; }
    for (let i = 0; i < n; i++) if (y[i] < env[i]) y[i] = env[i];
    for (let i = 1; i < n; i++) y[i] = Math.min(Math.max(y[i], y[i - 1] - L), y[i - 1] + L);
    for (let i = n - 2; i >= 0; i--) y[i] = Math.min(Math.max(y[i], y[i + 1] - L), y[i + 1] + L);
    return { gr, wet, y };
  }
  LAND._profile = profile;

  // ---------------------------------------------------------------- the plan
  LAND.plan = function (g) {
    if (g._landPlan) return g._landPlan;
    noises(g);
    const t0 = Date.now();
    const sites = LAND.sites(g);
    const routes = LAND.network(g, sites);
    const P = { sites, routes, lines: [], cells: new Map(), ops: new Map(), spawns: new Map(), bridges: [], lanterns: [], benches: [], stones: [], ms: 0 };
    // ---- the path cells: every block within 1.45 of a line point takes that point's height (the nearest point wins)
    const cells = P.cells, ck = (x, z) => x * 65536 + z;
    routes.forEach((r, ri) => {
      const pts = routeLine(sites, r), pr = profile(g, pts);
      const paved = sites[r.a].kind === 'temple' || sites[r.b].kind === 'temple' || sites[r.a].kind === 'city' || sites[r.b].kind === 'city';
      // a point's deck: over water (the river: a stone arch, else wooden), or more than three over its ground
      const deck = new Uint8Array(pts.length);
      for (let i = 0; i < pts.length; i++) deck[i] = pr.wet[i] ? (pr.wet[i] === 1 ? 2 : 1) : pr.y[i] - pr.gr[i] > 3 ? (nearWet(pr.wet, i) ? 2 : 1) : 0;
      P.lines.push({ a: r.a, b: r.b, pts, y: pr.y, wet: pr.wet, gr: pr.gr, deck, paved });
      for (let i = 0; i < pts.length; i++) {
        const [px, pz] = pts[i];
        for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
          const x = Math.round(px) + dx, z = Math.round(pz) + dz, d = Math.hypot(x - px, z - pz);
          if (d > 1.45) continue;
          const k = ck(x, z), c = cells.get(k);
          if (c && c.d <= d) continue;
          cells.set(k, { x, z, d, y: Math.round(pr.y[i]), line: ri, i, deck: deck[i], paved });
        }
      }
    });
    // no step of more than one block between neighbouring cells: the decks' heights are floors (raised to, never
    // lowered from), every other cell is lowered to one over its lowest neighbour
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const lb = new Map();
    const q = []; for (const c of cells.values()) if (c.deck) { lb.set(ck(c.x, c.z), c.y); q.push(c); }
    while (q.length) { const c = q.shift(), v = lb.get(ck(c.x, c.z)) - 1; for (const [dx, dz] of nb) { const n = cells.get(ck(c.x + dx, c.z + dz)); if (!n) continue; const k = ck(n.x, n.z); if (!(lb.get(k) >= v)) { lb.set(k, v); q.push(n); } } }
    for (const c of cells.values()) { const v = lb.get(ck(c.x, c.z)); if (v !== undefined && c.y < v) c.y = v; }
    for (let it = 0, ch = 1; ch && it < 60; it++) {
      ch = 0;
      for (const c of cells.values()) {
        let m = Infinity; for (const [dx, dz] of nb) { const n = cells.get(ck(c.x + dx, c.z + dz)); if (n && n.y < m) m = n.y; }
        if (c.y > m + 1) { const v = Math.max(m + 1, lb.has(ck(c.x, c.z)) ? lb.get(ck(c.x, c.z)) : -1e9); if (v < c.y) { c.y = v; ch = 1; } }
      }
    }
    P.ms = Date.now() - t0;
    g._landPlan = P;
    return P;
  };
  function nearWet(wet, i) { for (let k = -6; k <= 6; k++) if (wet[i + k] === 1) return true; return false; }
})(VR);
