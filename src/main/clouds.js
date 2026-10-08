// ============================================================================
// Clouds (t-clouds · TRAILER.md §2.1): the trailer's cumulus, the fog banks under the Sky Isles and the cloud anchors
// round the Spire Citadel, as sprites the renderer draws (renderer.js drawPuffs, shaders PUFF_VS / PUFF_FS).
//   cumulus  a cell of CELL blocks holds a cloud when the cover says so (about one cell in five in clear weather):
//            2–4 billboards, a big one and its lobes, the sunlit tops and the flat base; they drift with the wind at
//            y 206–214, so the lowest part of a cloud stays above y 190. Cloud space: the wind moves the drawing,
//            not the cells, so a cloud keeps its place in the sky while it drifts.
//   fog      wide, flat banks at y 104–114 within 300 blocks of the Sky Isles' centre (world space, they stay put)
//   anchors  ten cumulus billboards round the citadel's spires at y 207–212 (world space): the spires pierce them
// Deterministic: a cell always holds the same cloud, so the sky is the same on every visit. Pure functions; the
// sprite texture (atlas) is built here too. test/trailer_sky.js checks them in node.
// ============================================================================
(function (VR) {
  'use strict';
  const CELL = 56;                   // the cumulus cell (blocks)
  const RANGE = 8;                   // cells each side of the camera (448 blocks)
  const MAX_CUMULUS = 260;           // sprites per frame at most (the nearest ones: overcast skies keep the cost flat)
  const FOG = { x: 330, z: 140, reach: 300, cell: 90, y0: 104, y1: 114 };
  const ANCHOR = { x: -420, z: 380, n: 10, d: 110 };
  const SPRITE_FLOATS = 8;           // x, y, z, radius | alpha, squash, variant, 0 — in the renderer's instance buffer

  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  // a hash of two integers and a salt, in [0, 1)
  function hash(a, b, s) {
    let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul((s | 0) + 0x9e3779b9, 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d); h = Math.imul(h ^ (h >>> 12), 0x297a2d39); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  // smooth value noise in [0, 1)
  function vnoise(x, y, s) {
    const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = hash(i, j, s), b = hash(i + 1, j, s), c = hash(i, j + 1, s), d = hash(i + 1, j + 1, s);
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
  }
  // the cover: a cell is on when its score clears 1 − 1.8·cover (the score is clustered: a slow noise and a random part)
  function cellOn(gx, gz, cover) {
    const score = 0.55 * vnoise(gx * 0.23, gz * 0.23, 11) + 0.45 * hash(gx, gz, 7);
    return score > 1 - cover * 1.8;
  }
  // the sprites of one cumulus cell, in cloud space (the big one first, then 1–3 lobes); every centre sits at y ≥ 206 and
  // no sprite reaches below y 190 (its flat base is 0.45 of its radius under the centre, radius ≤ 36)
  function cumulusCell(gx, gz) {
    const out = [];
    const cx = (gx + 0.5) * CELL + (hash(gx, gz, 21) - 0.5) * CELL * 0.4;
    const cz = (gz + 0.5) * CELL + (hash(gx, gz, 22) - 0.5) * CELL * 0.4;
    const n = 2 + Math.floor(hash(gx, gz, 24) * 3);
    const R0 = 22 + hash(gx, gz, 23) * 14;
    const y0 = 209 + hash(gx, gz, 25) * 3;
    for (let k = 0; k < n; k++) {
      const a = hash(gx, gz, 30 + k) * Math.PI * 2;
      const dd = k === 0 ? 0 : R0 * (0.5 + 0.5 * hash(gx, gz, 40 + k));
      const r = k === 0 ? R0 : R0 * (0.55 + 0.35 * hash(gx, gz, 50 + k));
      const y = k === 0 ? y0 : y0 + (hash(gx, gz, 60 + k) - 0.3) * 4;
      out.push([cx + Math.cos(a) * dd, y, cz + Math.sin(a) * dd, r, 0.92, 0.8 + 0.2 * hash(gx, gz, 70 + k), Math.floor(hash(gx, gz, 80 + k) * 4) % 4]);
    }
    return out;
  }
  // the fog banks round the Sky Isles' centre, world space (cells of FOG.cell blocks; about a third of them hold a bank)
  function fogBanks(cam) {
    const out = [];
    const reach = FOG.reach + 60;
    const g0 = Math.floor((FOG.x - reach) / FOG.cell), g1 = Math.floor((FOG.x + reach) / FOG.cell);
    const h0 = Math.floor((FOG.z - reach) / FOG.cell), h1 = Math.floor((FOG.z + reach) / FOG.cell);
    for (let gz = h0; gz <= h1; gz++) for (let gx = g0; gx <= g1; gx++) {
      const x = gx * FOG.cell + FOG.cell / 2 + (hash(gx, gz, 90) - 0.5) * 50, z = gz * FOG.cell + FOG.cell / 2 + (hash(gx, gz, 91) - 0.5) * 50;
      if (Math.hypot(x - FOG.x, z - FOG.z) > FOG.reach) continue;
      if (hash(gx, gz, 92) < 0.33) continue;
      const r = 70 + hash(gx, gz, 93) * 60;
      out.push([x, FOG.y0 + hash(gx, gz, 94) * (FOG.y1 - FOG.y0), z, r, 0.28 + 0.12 * hash(gx, gz, 95), 0.3 + 0.12 * hash(gx, gz, 96), Math.floor(hash(gx, gz, 97) * 4) % 4]);
    }
    return out;
  }
  // the citadel's cloud anchors: a golden-angle ring round the spire cluster, world space
  function anchors() {
    const out = [];
    for (let i = 0; i < ANCHOR.n; i++) {
      const a = i * 2.39996323, d = 30 + 70 * ((i * 0.618034) % 1);
      out.push([ANCHOR.x + Math.cos(a) * d, 207 + ((i * 0.37) % 1) * 5, ANCHOR.z + Math.sin(a) * d, 24 + 10 * ((i * 0.77) % 1), 0.9, 0.85, i % 4]);
    }
    return out;
  }
  // the field round the camera. cam: {x, z}; wind: the drift (blocks), the cumulus is drawn at cloud space − wind;
  // opt.cover: 0..1 (the sky's cover; 0.2 in clear weather). Returns the sprites as plain arrays, far to near:
  //   cumulus  [x, y, z, r, alpha, squash, variant] in cloud space (y ≥ 206 for every centre)
  //   fog      the same, world space (the fog banks and the anchors), y ≤ 118 for the banks
  function field(cam, wind, opt) {
    const cover = clamp(opt && opt.cover !== undefined ? opt.cover : 0.2, 0, 1);
    const cx = cam.x + wind, cz = cam.z;
    const ocx = Math.floor(cx / CELL), ocz = Math.floor(cz / CELL);
    let cu = [];
    for (let gz = ocz - RANGE; gz <= ocz + RANGE; gz++) for (let gx = ocx - RANGE; gx <= ocx + RANGE; gx++) {
      if ((gx - ocx) * (gx - ocx) + (gz - ocz) * (gz - ocz) > RANGE * RANGE) continue;
      if (!cellOn(gx, gz, cover)) continue;
      for (const s of cumulusCell(gx, gz)) cu.push(s);
    }
    // the nearest MAX_CUMULUS, then far to near (the blend needs the far ones first)
    const dist = (s) => (s[0] - cx) * (s[0] - cx) + (s[2] - cz) * (s[2] - cz);
    if (cu.length > MAX_CUMULUS) cu = cu.sort((a, b) => dist(a) - dist(b)).slice(0, MAX_CUMULUS);
    cu.sort((a, b) => dist(b) - dist(a));
    const fog = fogBanks(cam).concat(anchors());
    const near = (s) => (s[0] - cam.x) * (s[0] - cam.x) + (s[2] - cam.z) * (s[2] - cam.z);
    fog.sort((a, b) => near(b) - near(a));
    return { cumulus: cu, fog };
  }
  // the packed instance data of a sprite list (SPRITE_FLOATS per sprite): the renderer uploads this
  function pack(list) {
    const out = new Float32Array(list.length * SPRITE_FLOATS);
    for (let i = 0; i < list.length; i++) {
      const s = list[i], o = i * SPRITE_FLOATS;
      out[o] = s[0]; out[o + 1] = s[1]; out[o + 2] = s[2]; out[o + 3] = s[3];
      out[o + 4] = s[4]; out[o + 5] = s[5]; out[o + 6] = s[6]; out[o + 7] = 0;
    }
    return out;
  }

  // ---- the sprite texture: four variants of a cumulus in a 2×2 grid of 128² cells (256² RGBA8). R = density; G, B = the
  // outward normal in the sprite's plane (0.5 = none, 1 = +x / up); A = 255. Row j is v = (j + 0.5) / 128: the top is up.
  const LOBES = [[0, -0.05, 0.62], [-0.42, -0.2, 0.44], [0.42, -0.18, 0.46], [-0.18, 0.28, 0.42], [0.22, 0.3, 0.44], [0, 0.5, 0.3], [-0.6, -0.35, 0.3], [0.62, -0.38, 0.3]];
  function density(px, py, seed) {
    let m = 0;
    for (let q = 0; q < LOBES.length; q++) { const L = LOBES[q], dx = px - L[0], dy = py - L[1]; const d = Math.sqrt(dx * dx + dy * dy) / L[2]; const k = 1 - smooth(0.55, 1, d); if (k > m) m = k; }
    m *= smooth(-0.62, -0.42, py);                                  // the flat base
    const n = 0.6 * vnoise(px * 2.6 + seed * 13.1 + 4, py * 2.6 - seed * 7.7, 301) + 0.4 * vnoise(px * 6.2 - seed * 3.3, py * 6.2 + seed, 302);
    return clamp((m - 0.28) * 1.6 + (n - 0.5) * 0.7, 0, 1);
  }
  function atlas() {
    const S = 256, N = 128, out = new Uint8Array(S * S * 4);
    for (let k = 0; k < 4; k++) {
      const ox = (k % 2) * N, oy = Math.floor(k / 2) * N, seed = k * 0.37 + 1.3;
      const d = new Float32Array(N * N);
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) d[j * N + i] = density((i + 0.5) / N * 2 - 1, (j + 0.5) / N * 2 - 1, seed);
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const i0 = Math.max(0, i - 1), i1 = Math.min(N - 1, i + 1), j0 = Math.max(0, j - 1), j1 = Math.min(N - 1, j + 1);
        let nx = -(d[j * N + i1] - d[j * N + i0]), ny = -(d[j1 * N + i] - d[j0 * N + i]);
        const len = Math.hypot(nx, ny) || 1; nx /= len; ny /= len;
        const o = ((oy + j) * S + (ox + i)) * 4;
        out[o] = Math.round(d[j * N + i] * 255);
        out[o + 1] = Math.round((nx * 0.5 + 0.5) * 255);
        out[o + 2] = Math.round((ny * 0.5 + 0.5) * 255);
        out[o + 3] = 255;
      }
    }
    return out;
  }

  VR.Clouds = { CELL, RANGE, MAX_CUMULUS, FOG, ANCHOR, SPRITE_FLOATS, hash, vnoise, cellOn, cumulusCell, fogBanks, anchors, field, pack, density, atlas };
})(VR);
