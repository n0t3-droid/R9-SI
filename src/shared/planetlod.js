// ============================================================================
// u-orbitlod · VR.PlanetLOD — Herzwelt's ground from orbit with its real relief (docs/superpowers/plans/
// 2026-10-29-u-orbitlod.md; U§5.4, §11). Pure: the worker runs the job (worker_main.js 'ptile'), node tests too; the GL
// half is src/main/planetlod_gl.js.
//   · a quadtree of tiles on the chart's plane (the map: U§4.5's azimuthal equidistant chart, BodyTex.CHART) round the
//     sub-ship point: 16 × 16 quads a tile, vertex spacing 128 m near the nadir to 2,048 m at the edge, within 30 km
//     (at 3 km up the horizon is 24 km away: the tiles carry the whole ground that is seen; the impostor the limb)
//   · the job: the generator's own height (computeClimate's H, the vista's heights) on a 19 × 19 grid (one ring more
//     for the normals), each vertex put on the sphere through the chart — body frame (x the prime meridian, y the pole),
//     metres from the centre — with its normal; the sea is its surface; skirts hide the cracks between levels
//   · on from Balanced (spaceDetail tier 2) for the worlds with a generator and a chart: Herzwelt. The moons keep their
//     impostors, Very Low and Low too
// ============================================================================
(function (VR) {
  'use strict';
  const PL = VR.PlanetLOD = {};
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  PL.N = 16;                                   // quads a side
  PL.LEVELS = [128, 256, 512, 1024, 2048];     // vertex spacing (m)
  PL.RADIUS = 30000;                           // the tiles' reach round the sub-ship point (m)
  PL.K = 1.0;                                  // a tile splits while the eye is nearer than K × its size
  PL.VERTS = (PL.N + 1) * (PL.N + 1) + 4 * (PL.N + 1);   // the grid + the skirts
  PL.on = (tier, body) => (tier | 0) >= 2 && (body === 'herz' || body === undefined);
  // the horizon's dip below the level (U§5.1; ascent §9.1): the sine of acos(R / (R + h)) — the sky's band sits there
  PL.dip = (h, R) => { const k = R / (R + Math.max(0, h)); return Math.sqrt(Math.max(0, 1 - k * k)); };
  // the tiles for an eye over (cx, cz) at alt metres: [{ key, s, x0, z0, size }] — the coarsest level's grid, split
  // toward the nadir; only tiles that reach into the circle
  PL.select = function (cx, cz, alt, out) {
    const o = out || [], top = PL.LEVELS[PL.LEVELS.length - 1], S0 = top * PL.N, R = PL.RADIUS, a2 = Math.max(0, alt) ** 2;
    o.length = 0;
    const dist = (x0, z0, sz) => { const dx = Math.max(x0 - cx, 0, cx - (x0 + sz)), dz = Math.max(z0 - cz, 0, cz - (z0 + sz)); return Math.hypot(dx, dz); };
    const visit = (x0, z0, s) => {
      const sz = s * PL.N, d = dist(x0, z0, sz);
      if (d > R) return;
      if (s > PL.LEVELS[0] && Math.sqrt(d * d + a2) < PL.K * sz) { const h = sz / 2, s2 = s / 2; visit(x0, z0, s2); visit(x0 + h, z0, s2); visit(x0, z0 + h, s2); visit(x0 + h, z0 + h, s2); return; }
      o.push({ key: s + ':' + x0 + ':' + z0, s, x0, z0, size: sz });
    };
    const i0 = Math.floor((cx - R) / S0), i1 = Math.floor((cx + R) / S0), j0 = Math.floor((cz - R) / S0), j1 = Math.floor((cz + R) / S0);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) visit(i * S0, j * S0, top);
    return o;
  };
  // the GPU bytes of a set of n tiles (positions + normals as floats, the shared index list)
  PL.tileBytes = () => PL.VERTS * 6 * 4;
  PL.indexBytes = () => (PL.N * PL.N * 6 + 4 * PL.N * 6) * 2;
  PL.CACHE = 160;                              // tiles kept (the selection is ~40–70; the rest is the way ahead and back)
  PL.gpuBytes = (tier) => (PL.on(tier) ? PL.CACHE * PL.tileBytes() + PL.indexBytes() : 0);
  // the index list: the grid's quads, then each edge's skirt (the edge's vertices to the skirt's)
  PL.indices = function () {
    const N = PL.N, V = N + 1, out = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * V + i, b = a + 1, c = a + V, d = c + 1; out.push(a, c, b, b, c, d); }
    const base = V * V, edges = [(k) => k, (k) => N * V + (N - k), (k) => (N - k) * V, (k) => k * V + N];   // north, south, west, east (each walked so its skirt faces out)
    const eIdx = [(k) => k, (k) => N * V + k, (k) => k * V, (k) => k * V + N];
    for (let e = 0; e < 4; e++) for (let k = 0; k < N; k++) {
      const a = eIdx[e](k), b = eIdx[e](k + 1), sa = base + e * V + k, sb = sa + 1;
      if (e === 0 || e === 3) out.push(a, b, sa, b, sb, sa); else out.push(a, sa, b, b, sa, sb);
    }
    void edges;
    return new Uint16Array(out);
  };
  // ---------------------------------------------------------------- the job (a worker; node)
  // m: { type: 'ptile', x0, z0, s } → { pos: Float32Array(VERTS × 3) body frame metres, nrm: Float32Array(VERTS × 3),
  //   hMin, hMax (m over the sea), ms }
  PL.job = function (m, getGen) {
    const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
    const BT = VR.BodyTex, C = BT.CHART, R = C.R, N = PL.N, V = N + 1, G = V + 2, s = +m.s || 128, x0 = +m.x0 || 0, z0 = +m.z0 || 0;
    const g = getGen ? getGen('overworld') : null, SEA = (VR.C && VR.C.SEA) || 64;
    const H = new Float32Array(G * G);
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
      const X = x0 + (i - 1) * s, Z = z0 + (j - 1) * s;
      const cl = g && g.computeClimate ? g.computeClimate(Math.round(X), Math.round(Z)) : null;
      let h = cl ? cl.H - SEA : 0;
      if (cl && BT.macroH) h = BT.macroH(X, Z, h, g.seed, cl.c);   // u-orbit2: the continents' seas (bodytex.js BT.macro)
      H[j * G + i] = Math.max(0, h);   // (the sea: its surface)
    }
    const P = new Float32Array(G * G * 3), n3 = [0, 0, 0];
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
      const sp = BT.toSphere(x0 + (i - 1) * s, z0 + (j - 1) * s); BT.normal(sp[0], sp[1], n3);
      const r = R + H[j * G + i], k = (j * G + i) * 3; P[k] = n3[0] * r; P[k + 1] = n3[1] * r; P[k + 2] = n3[2] * r;
    }
    const pos = new Float32Array(PL.VERTS * 3), nrm = new Float32Array(PL.VERTS * 3);
    let hMin = 1e9, hMax = -1e9;
    const nAt = (i, j, o) => {   // grid (i, j) of the inner V × V → the normal from the neighbours (central differences)
      const k = ((j + 1) * G + i + 1) * 3, kx0 = k - 3, kx1 = k + 3, kz0 = k - G * 3, kz1 = k + G * 3;
      const ax = P[kx1] - P[kx0], ay = P[kx1 + 1] - P[kx0 + 1], az = P[kx1 + 2] - P[kx0 + 2];
      const bx = P[kz1] - P[kz0], by = P[kz1 + 1] - P[kz0 + 1], bz = P[kz1 + 2] - P[kz0 + 2];
      let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
      // (outward: the same side as the position)
      if (nx * P[k] + ny * P[k + 1] + nz * P[k + 2] < 0) { nx = -nx; ny = -ny; nz = -nz; }
      const l = Math.hypot(nx, ny, nz) || 1; o[0] = nx / l; o[1] = ny / l; o[2] = nz / l; return o;
    };
    for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) {
      const k = ((j + 1) * G + i + 1) * 3, v = (j * V + i) * 3;
      pos[v] = P[k]; pos[v + 1] = P[k + 1]; pos[v + 2] = P[k + 2];
      nAt(i, j, n3); nrm[v] = n3[0]; nrm[v + 1] = n3[1]; nrm[v + 2] = n3[2];
      const h = H[(j + 1) * G + i + 1]; if (h < hMin) hMin = h; if (h > hMax) hMax = h;
    }
    // the skirts: each edge's vertices again, pulled toward the centre by a quarter of the spacing (below any crack)
    const drop = s * 0.25 + 4, eIdx = [(k) => [k, 0], (k) => [k, N], (k) => [0, k], (k) => [N, k]];
    for (let e = 0; e < 4; e++) for (let k = 0; k < V; k++) {
      const [i, j] = eIdx[e](k), src = (j * V + i) * 3, dst = (V * V + e * V + k) * 3;
      const px = pos[src], py = pos[src + 1], pz = pos[src + 2], l = Math.hypot(px, py, pz), f = (l - drop) / l;
      pos[dst] = px * f; pos[dst + 1] = py * f; pos[dst + 2] = pz * f;
      nrm[dst] = nrm[src]; nrm[dst + 1] = nrm[src + 1]; nrm[dst + 2] = nrm[src + 2];
    }
    const ms = +((typeof performance !== 'undefined' ? performance : Date).now() - t0).toFixed(2);
    return { type: 'ptile', id: m.id, key: m.key, x0, z0, s, pos, nrm, hMin, hMax, ms, transfer: [pos.buffer, nrm.buffer] };
  };
  void clamp;
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
