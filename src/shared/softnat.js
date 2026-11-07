// ============================================================================
// r-gemalt · Weiche Natur (plan docs/superpowers/plans/2026-11-07-r-gemalt.md; vision principle 1: "Natur ist weich,
// Handwerk ist scharf"). The natural ground of a section — grass, earth, sand, gravel, snow, clay, moss, mud, the natural
// rocks and ores — meshed as ONE sculpted surface instead of cubes:
//   * surface nets over the natural blocks' occupancy (one vertex per dual cell, cell c = the grid corner c + 1);
//   * a Laplacian relaxation over the cell's surface neighbours (face 1, edge ½), clamped to the cell;
//   * smooth per-vertex normals: the gradient of a 1-2-1 blurred occupancy field;
//   * rock noses: steep rock swells and dips along its normal by a world-space noise (grass a little);
//   * a painted colour per vertex (our own palette): grass on the tops, earth on the slopes, rock on the cliffs, snow
//     caps up high — interpolated across the surface, so materials blend instead of stepping block by block;
//   * crisp snap: a cell touching a man-made block (any solid non-natural block) sits on its grid corner, so floors,
//     walls and paths meet the ground with no gap; their cubes are meshed as before.
// Seams: everything a cell's vertex depends on lies in its 4 × 4 × 4 voxel window (voxels c − 1 … c + 2), which the
// mesher's pad of 2 gives both sections at a border alike — one relaxation pass over the 3 × 3 × 3 cells is the most the
// pad allows (a second pass would read voxels three out). Offsets are kept relative to the cell's corner, so both
// sections compute bit-identical vertices.
// Render only: saved blocks, generation, light and collision are untouched (physics keeps its block / height-field
// ground; the column heights `hOut` let the game lift the drawn bodies onto the drawn surface, gemalt.js).
// Vertex: w4 holds the octahedral normal (u | v << 8), w5 face 6 (the marker: TERRAIN_* with GEMALT), w7 the painted
// colour (rgb565), w3 the block's top texture layer (the F2 material family).
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R, F = VR.F, SH = VR.SHAPE;
  const PAD = VR.MESH_PAD, PS = VR.MESH_PS, PSS = PS * PS, N = PSS * PS;
  const SN = VR.SoftNat = VR.SoftNat || {};
  SN.FACE = 6;                 // the vertex marker (w5 & 7)
  SN.relax = 0.9;              // the relaxation's step toward the neighbours' mean
  SN.bumpRock = 0.38;          // rock noses: the swell along the normal on steep rock (blocks)
  SN.bumpSoft = 0.1;           // and on the soft ground's slopes
  SN.snowLine = 150;           // snow caps above this height (world y), ragged by noise
  // the natural blocks (cube states only; the "_cut" twins a shovel makes stay cubes, as do paths, pavers and roads)
  SN.SOFT = /^(grass_block|dirt|coarse_dirt|podzol|mycelium|mud|clay|gravel|sand|red_sand|moss_block|pale_moss_block|snow_block|snow|rooted_dirt|stone|granite|diorite|andesite|deepstone|tuff|basalt|calcite|dripstone_block|packed_ice|bedrock|terracotta|(white|light_gray|gray|brown|red|orange|yellow)_terracotta|sandstone|red_sandstone|cinnabar|sulfur|\w*_ore|gloom_sand|gloom_soil|echo_moss|ochre_rock|umber_rock|duskrock|emberrock|tidestone|abyssal_tidestone|skyroot_soil|aether_stone|buried_sand|buried_gravel|muddy_mangrove_roots|exo_moss|tholin_ice)$/;
  // the painter's palette (sRGB): our own colours; mat 1 grass-like (slopes → earth → rock), 2 snow (steep → rock),
  // 3 rock (noses), 0 earth/sand (steep → rock)
  const PAL = {
    grass_block: [-1, 1], podzol: [0x6e5236, 1], mycelium: [0x8c7c88, 1], moss_block: [0x5f8a3a, 1], pale_moss_block: [0x9aa58a, 1], echo_moss: [0x4f7a5a, 1], exo_moss: [0x5a8a6a, 1], skyroot_soil: [0x6f8f4a, 1],
    dirt: [0x7a5a3c, 0], coarse_dirt: [0x80644a, 0], rooted_dirt: [0x7e6046, 0], mud: [0x4e3f34, 0], clay: [0x9aa3ad, 0], gravel: [0x8e8a84, 0], buried_gravel: [0x8e8a84, 0],
    sand: [0xdcc896, 0], buried_sand: [0xdcc896, 0], red_sand: [0xc0703a, 0], gloom_sand: [0x5e5246, 0], gloom_soil: [0x4c4038, 0], muddy_mangrove_roots: [0x5a4634, 0],
    snow_block: [0xeef3fa, 2], snow: [0xeef3fa, 2], packed_ice: [0x9cc0ec, 2], tholin_ice: [0xc8a888, 2],
    stone: [0x8b8d91, 3], granite: [0xa07a6a, 3], diorite: [0xc8c8c4, 3], andesite: [0x8a8c88, 3], deepstone: [0x5a5a62, 3], tuff: [0x6c6c62, 3], basalt: [0x4a4a52, 3], calcite: [0xe0e0dc, 3],
    dripstone_block: [0x8a7060, 3], bedrock: [0x3c3c40, 3], ochre_rock: [0xb88a4a, 3], umber_rock: [0x6a4a34, 3], duskrock: [0x5a4a62, 3], emberrock: [0x6a3a30, 3], tidestone: [0x6a8a8c, 3],
    abyssal_tidestone: [0x3a5a62, 3], aether_stone: [0xb8c8e0, 3],
    terracotta: [0x985e43, 3], white_terracotta: [0xd2b2a1, 3], light_gray_terracotta: [0x876a61, 3], gray_terracotta: [0x3a2a24, 3], brown_terracotta: [0x4d3323, 3],
    sandstone: [0xd8c48e, 3], red_sandstone: [0xb8642e, 3], cinnabar: [0x9a3a32, 3], sulfur: [0xd8c84a, 3],
    red_terracotta: [0x8f3d2e, 3], orange_terracotta: [0xa1531d, 3], yellow_terracotta: [0xba8423, 3],
  };
  const EARTH = [0x6e / 255, 0x52 / 255, 0x36 / 255], ROCK = [0x78 / 255, 0x70 / 255, 0x68 / 255], SNOW = [0.93, 0.95, 0.98];

  // ---- tables per registry size: SOFT (1 natural), PIN (1 a crisp block the ground snaps to), COL (rgb, −1 the grass
  // tint), MAT (palette kind)
  let TB = null;
  SN.tables = function () {
    if (TB && TB.soft.length === R.stateCount) return TB;
    const n = R.stateCount, soft = new Uint8Array(n), pin = new Uint8Array(n), col = new Int32Array(n), mat = new Uint8Array(n);
    const T = R.T, TF = T.flags, TSH = T.shape;
    for (let s = 1; s < n; s++) {
      const t = R.types[T.type[s]]; if (!t) continue;
      const nm = t.name, sh = TSH[s], fl = TF[s];
      if (sh === SH.CUBE && (fl & F.OPAQUE) && SN.SOFT.test(nm)) {
        soft[s] = 1;
        const p = PAL[nm] || (/_ore$/.test(nm) ? (/^deepstone/.test(nm) ? PAL.deepstone : PAL.stone) : PAL.stone);
        col[s] = p[0]; mat[s] = p[1];
        continue;
      }
      // a crisp block: anything solid that is not a plant, a leaf, a fluid, a snow layer or a wire
      if (sh === SH.NONE || sh === SH.CROSS || sh === SH.TALLCROSS || sh === SH.CROP || sh === SH.FLUID || sh === SH.WIRE) continue;
      if (fl & (F.LEAVES | F.FLUID | F.PLANT)) continue;
      if (nm === 'snow' || nm === 'powder_snow') continue;
      if ((fl & F.OPAQUE) || (fl & F.SOLID)) pin[s] = 1;
    }
    TB = { soft, pin, col, mat };
    return TB;
  };

  // ---- scratch (one section at a time per worker; never allocated per job)
  const S_ = new Uint8Array(N), AIR = new Uint8Array(N), BF = new Float32Array(N), BT = new Float32Array(N);
  const CN = 19, CNN = CN * CN, CC = CNN * CN;   // cells −2 … 16 on each axis
  const ci = (cx, cy, cz) => ((cy + 2) * CN + (cz + 2)) * CN + (cx + 2);
  const ACT = new Uint8Array(CC), PINC = new Uint8Array(CC), P0 = new Float32Array(CC * 3), P1 = new Float32Array(CC * 3), NRM = new Float32Array(CC * 3);
  const DONE = new Uint8Array(CC), VCOL = new Uint16Array(CC), VLIT = new Uint16Array(CC), VAO = new Uint8Array(CC), VOCT = new Uint16Array(CC);
  const P = (x, y, z) => (y + PAD) * PSS + (z + PAD) * PS + (x + PAD);
  const hsh = (x, y, z) => { let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1274126177); h = Math.imul(h ^ (h >>> 13), 1103515245); return ((h ^ (h >>> 16)) & 0xffff) / 65535; };
  const s3 = (t) => t * t * (3 - 2 * t);
  // smooth value noise in [0, 1] on a lattice of `c` blocks (world coordinates)
  SN.noise = function (x, y, z, c) {
    const X = x / c, Y = y / c, Z = z / c, x0 = Math.floor(X), y0 = Math.floor(Y), z0 = Math.floor(Z);
    const fx = s3(X - x0), fy = s3(Y - y0), fz = s3(Z - z0);
    let v = 0;
    for (let i = 0; i < 8; i++) { const a = i & 1, b = (i >> 1) & 1, d = (i >> 2) & 1; v += hsh(x0 + a, y0 + b, z0 + d) * (a ? fx : 1 - fx) * (b ? fy : 1 - fy) * (d ? fz : 1 - fz); }
    return v;
  };
  // octahedral normal → two bytes (TERRAIN_VS decodes it)
  SN.oct = function (x, y, z) {
    const l = Math.abs(x) + Math.abs(y) + Math.abs(z) || 1;
    let u = x / l, v = z / l;
    if (y < 0) { const ou = u; u = (1 - Math.abs(v)) * (ou >= 0 ? 1 : -1); v = (1 - Math.abs(ou)) * (v >= 0 ? 1 : -1); }
    return Math.round((u * 0.5 + 0.5) * 255) | (Math.round((v * 0.5 + 0.5) * 255) << 8);
  };
  SN.unoct = function (w) {
    let u = (w & 255) / 255 * 2 - 1, v = (w >> 8) / 255 * 2 - 1;
    const y = 1 - Math.abs(u) - Math.abs(v);
    if (y < 0) { const ou = u; u = (1 - Math.abs(v)) * (ou >= 0 ? 1 : -1); v = (1 - Math.abs(ou)) * (v >= 0 ? 1 : -1); }
    const l = Math.hypot(u, y, v) || 1; return [u / l, y / l, v / l];
  };
  const rgb565 = (r, g, b) => ((Math.max(0, Math.min(31, Math.round(r * 31))) << 11) | (Math.max(0, Math.min(63, Math.round(g * 63))) << 5) | Math.max(0, Math.min(31, Math.round(b * 31))));
  const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  // ---- the solve: occupancy, cells, positions, normals (cells −2 … 16; the section uses −1 … 15)
  let J = null;
  SN.solve = function (job, TB_) {
    const B = job.blocks, TF = R.T.flags, tb = TB_ || SN.tables(), soft = tb.soft, pin = tb.pin;
    for (let i = 0; i < N; i++) { const b = B[i]; S_[i] = soft[b]; AIR[i] = soft[b] || (TF[b] & F.OPAQUE) ? 0 : 1; BF[i] = AIR[i] ? 0 : 1; }
    // the blur (1-2-1 per axis; an edge voxel keeps its own value along the cut axis)
    const pass = (src, dst, st, ax) => {
      for (let y = 0; y < PS; y++) for (let z = 0; z < PS; z++) for (let x = 0; x < PS; x++) {
        const i = y * PSS + z * PS + x, c = ax === 0 ? x : ax === 1 ? y : z;
        dst[i] = ((c > 0 ? src[i - st] : src[i]) + 2 * src[i] + (c < PS - 1 ? src[i + st] : src[i])) * 0.25;
      }
    };
    pass(BF, BT, 1, 0); pass(BT, BF, PSS, 1); pass(BF, BT, PS, 2);   // (the blurred field in BT)
    ACT.fill(0); PINC.fill(0); DONE.fill(0);
    for (let cy = -2; cy <= 16; cy++) for (let cz = -2; cz <= 16; cz++) for (let cx = -2; cx <= 16; cx++) {
      const k = ci(cx, cy, cz);
      let sx = 0, sy = 0, sz = 0, n = 0, pn = 0;
      for (let c = 0; c < 8; c++) { const b = B[P(cx + (c & 1), cy + ((c >> 1) & 1), cz + ((c >> 2) & 1))]; if (pin[b]) pn = 1; }
      for (let e = 0; e < 12; e++) {
        const ax = e >> 2, u = e & 1, w = (e >> 1) & 1;
        const ax0 = cx + (ax === 0 ? 0 : u), ay0 = cy + (ax === 1 ? 0 : (ax === 0 ? u : w)), az0 = cz + (ax === 2 ? 0 : w);
        const ia = P(ax0, ay0, az0), ib = P(ax0 + (ax === 0 ? 1 : 0), ay0 + (ax === 1 ? 1 : 0), az0 + (ax === 2 ? 1 : 0));
        if (!((S_[ia] && AIR[ib]) || (S_[ib] && AIR[ia]))) continue;
        // the edge's middle relative to the cell's corner
        sx += ax === 0 ? 0 : (ax0 - cx) - 0.5; sy += ax === 1 ? 0 : (ay0 - cy) - 0.5; sz += ax === 2 ? 0 : (az0 - cz) - 0.5; n++;
      }
      if (!n) continue;
      ACT[k] = 1; PINC[k] = pn;
      if (pn) { P0[k * 3] = 0; P0[k * 3 + 1] = 0; P0[k * 3 + 2] = 0; }
      else { P0[k * 3] = sx / n; P0[k * 3 + 1] = sy / n; P0[k * 3 + 2] = sz / n; }
    }
    J = { job, tb, B };
    return J;
  };
  // the relaxed position of cell (cx, cy, cz) (−1 … 15), relative to its corner, into P1 (lazy)
  function relaxed(cx, cy, cz) {
    const k = ci(cx, cy, cz);
    if (DONE[k]) return k;
    DONE[k] = 1;
    // normal: the blurred field's falling gradient over the cell's 8 voxels
    let gx = 0, gy = 0, gz = 0;
    for (let c = 0; c < 8; c++) { const v = BT[P(cx + (c & 1), cy + ((c >> 1) & 1), cz + ((c >> 2) & 1))]; gx += (c & 1) ? v : -v; gy += ((c >> 1) & 1) ? v : -v; gz += ((c >> 2) & 1) ? v : -v; }
    let gl = Math.hypot(gx, gy, gz);
    let nx = 0, ny = 1, nz = 0;
    if (gl > 1e-6) { nx = -gx / gl; ny = -gy / gl; nz = -gz / gl; }
    NRM[k * 3] = nx; NRM[k * 3 + 1] = ny; NRM[k * 3 + 2] = nz;
    if (PINC[k]) { P1[k * 3] = 0; P1[k * 3 + 1] = 0; P1[k * 3 + 2] = 0; return k; }
    // the neighbours' mean (face 1, edge ½; corners left out), positions relative to this cell's corner
    let mx = 0, my = 0, mz = 0, wsum = 0;
    for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const m = (dx !== 0) + (dy !== 0) + (dz !== 0);
      if (m === 0 || m === 3) continue;
      const q = ci(cx + dx, cy + dy, cz + dz);
      if (!ACT[q]) continue;
      const w = m === 1 ? 1 : 0.5;
      mx += (P0[q * 3] + dx) * w; my += (P0[q * 3 + 1] + dy) * w; mz += (P0[q * 3 + 2] + dz) * w; wsum += w;
    }
    let px = P0[k * 3], py = P0[k * 3 + 1], pz = P0[k * 3 + 2];
    if (wsum > 0) { const a = SN.relax; px += (mx / wsum - px) * a; py += (my / wsum - py) * a; pz += (mz / wsum - pz) * a; }
    // the rolling ground (r1: one relaxation left gentle slopes a washboard of rounded steps): where the cell is height-
    // field-like (no overhang in it), its height is the column tops' B-spline mean over the 4 × 4 columns of its window
    // (weights 1 3 3 1 — a step spreads over four blocks, its riser's cells meet at one height; clamped to the cell), and
    // its normal the gradient of that mean; a cliff's wall (steep, or clamped) keeps the blurred field's normal
    if (hfLike(cx, cy, cz)) {
      let H = 0, gx2 = 0, gz2 = 0;
      for (let b = 0; b < 4; b++) for (let a = 0; a < 4; a++) {
        const h = colTop(cx - 1 + a, cy, cz - 1 + b) - (cy + 1), wa = HW[a], wb = HW[b];
        H += h * wa * wb; gx2 += h * HD[a] * wb; gz2 += h * wa * HD[b];
      }
      py = H < -0.5 ? -0.5 : H > 0.5 ? 0.5 : H;
      // (a slope steeper than the cell can follow: the clamped corner slides along the slope to where the mean surface
      //  passes its height — a stack of clamped corners becomes a straight slope, not a zigzag)
      const g2 = gx2 * gx2 + gz2 * gz2;
      if (py !== H && g2 > 0.05) { const t = (py - H) / g2; px = gx2 * t; pz = gz2 * t; }
      if (H >= -0.5 && H <= 0.5 && gx2 * gx2 + gz2 * gz2 < 2.6) {
        // (a gentle slope: the corner stays on its column line — a sideways pull would stack the riser's cells into a
        //  half-block staircase again)
        px = 0; pz = 0;
        const l = Math.hypot(gx2, 1, gz2); nx = -gx2 / l; ny = 1 / l; nz = -gz2 / l;
        NRM[k * 3] = nx; NRM[k * 3 + 1] = ny; NRM[k * 3 + 2] = nz;
      }
    }
    // rock noses (and a soft swell on the earth's slopes): along the normal by world noise, steep ground only
    const mt = matAt(cx, cy, cz), steep = 1 - Math.abs(ny);
    const amp = (mt === 3 ? SN.bumpRock : SN.bumpSoft) * sstep(0.15, 0.6, steep);
    if (amp > 0.001) {
      const jb = J.job, wx = jb.ox + cx + 1, wy = (jb.sy | 0) * 16 + cy + 1, wz = jb.oz + cz + 1;
      const d = ((SN.noise(wx, wy, wz, 3.1) - 0.5) * 1.4 + (SN.noise(wx + 17, wy, wz - 9, 1.3) - 0.5) * 0.6) * 2 * amp;
      px += nx * d; py += ny * d; pz += nz * d;
    }
    const lim = 0.5;
    P1[k * 3] = px < -lim ? -lim : px > lim ? lim : px;
    P1[k * 3 + 1] = py < -lim ? -lim : py > lim ? lim : py;
    P1[k * 3 + 2] = pz < -lim ? -lim : pz > lim ? lim : pz;
    return k;
  }
  // the height field: B-spline weights over a window of four columns (sum 1) and their derivative (per block)
  const HW = [1 / 8, 3 / 8, 3 / 8, 1 / 8], HD = [-0.25, -0.25, 0.25, 0.25];
  // the top of the solid in column (x, z) within the window's four voxels cy − 1 … cy + 2 (one past them when all solid,
  // cy − 1 when none)
  function colTop(x, cy, z) {
    for (let y = cy + 2; y >= cy - 1; y--) if (!AIR[P(x, y, z)]) return y + 1;
    return cy - 1;
  }
  // no overhang in the cell: none of its four columns has air under solid
  function hfLike(cx, cy, cz) {
    for (let c = 0; c < 4; c++) { const x = cx + (c & 1), z = cz + (c >> 1); if (AIR[P(x, cy, z)] && !AIR[P(x, cy + 1, z)]) return false; }
    return true;
  }
  // the cell's palette kind: the exposed natural voxel's (air above it), else any natural one
  function matAt(cx, cy, cz) {
    const B = J.B, tb = J.tb; let best = -1;
    for (let c = 0; c < 8; c++) { const i = P(cx + (c & 1), cy + ((c >> 1) & 1), cz + ((c >> 2) & 1)); if (!S_[i]) continue; const m = tb.mat[B[i]]; if (AIR[i + PSS]) return m; if (best < 0) best = m; }
    return best < 0 ? 0 : best;
  }
  // the vertex attributes of cell k: painted colour, light, AO (lazy)
  function attrs(cx, cy, cz, k) {
    if (DONE[k] === 2) return;
    DONE[k] = 2;
    const B = J.B, tb = J.tb, jb = J.job, L = jb.light, GR = jb.grass;
    let r = 0, g = 0, b = 0, wsum = 0, ss = 0, rr = 0, gg = 0, bb = 0, ln = 0, solid = 0, grassW = 0, snowW = 0, rockW = 0;
    for (let c = 0; c < 8; c++) {
      const vx = cx + (c & 1), vy = cy + ((c >> 1) & 1), vz = cz + ((c >> 2) & 1), i = P(vx, vy, vz), st = B[i];
      if (AIR[i]) { const l = L[i]; ss += l >>> 12; rr += (l >> 8) & 15; gg += (l >> 4) & 15; bb += l & 15; ln++; continue; }
      solid++;
      if (!S_[i]) continue;
      const w = AIR[i + PSS] ? 3 : 1;
      let col = tb.col[st], cr, cg, cb;
      if (col < 0) {   // the grass: the biome's tint at this column, as a painted green
        const t = GR[(vz + PAD) * PS + (vx + PAD)];
        cr = ((t >> 11) & 31) / 31 * 0.52; cg = ((t >> 5) & 63) / 63 * 0.54; cb = (t & 31) / 31 * 0.4;
      } else { cr = ((col >> 16) & 255) / 255; cg = ((col >> 8) & 255) / 255; cb = (col & 255) / 255; }
      r += cr * w; g += cg * w; b += cb * w; wsum += w;
      const m = tb.mat[st]; if (m === 1) grassW += w; else if (m === 2) snowW += w; else if (m === 3) rockW += w;
    }
    if (wsum > 0) { r /= wsum; g /= wsum; b /= wsum; grassW /= wsum; snowW /= wsum; rockW /= wsum; }
    // slope: grass gives way to earth, then to rock; snow to rock; earth and sand to rock on the steepest
    const ny = NRM[k * 3 + 1], wy = (jb.sy | 0) * 16 + cy + 1;
    const wx = jb.ox + cx + 1, wz = jb.oz + cz + 1, nz1 = SN.noise(wx, 0, wz, 5.3);
    const eT = grassW * sstep(0.84 + nz1 * 0.08, 0.6, ny);
    r += (EARTH[0] - r) * eT; g += (EARTH[1] - g) * eT; b += (EARTH[2] - b) * eT;
    const rT = (1 - rockW) * sstep(0.36, 0.1, ny) * (wsum > 0 ? 1 : 0);   // (r3: rock from 0.5 washed every steep bank grey)
    r += (ROCK[0] - r) * rT; g += (ROCK[1] - g) * rT; b += (ROCK[2] - b) * rT;
    // snow caps: above the snow line, on the gentle tops
    const sT = sstep(SN.snowLine - 6 + nz1 * 14, SN.snowLine + 10 + nz1 * 14, wy) * sstep(0.55, 0.85, ny) * (1 - snowW);
    r += (SNOW[0] - r) * sT; g += (SNOW[1] - g) * sT; b += (SNOW[2] - b) * sT;
    VCOL[k] = rgb565(r, g, b);
    if (!ln) { const l = L[P(cx, cy + 1, cz)]; ss = l >>> 12; rr = (l >> 8) & 15; gg = (l >> 4) & 15; bb = l & 15; ln = 1; }
    const inv = 1 / ln;
    VLIT[k] = (Math.round(ss * inv) << 12) | (Math.round(rr * inv) << 8) | (Math.round(gg * inv) << 4) | Math.round(bb * inv);
    VAO[k] = solid > 4 ? Math.min(3, solid - 4) : 0;
    VOCT[k] = SN.oct(NRM[k * 3], NRM[k * 3 + 1], NRM[k * 3 + 2]);
  }
  // the vertex of corner (X, Y, Z) (section-local grid corner; cell X − 1 …) in section-local block units
  SN.vert = function (X, Y, Z, out) {
    const k = relaxed(X - 1, Y - 1, Z - 1);
    out[0] = X + P1[k * 3]; out[1] = Y + P1[k * 3 + 1]; out[2] = Z + P1[k * 3 + 2];
    return out;
  };
  SN.normal = function (X, Y, Z, out) { const k = relaxed(X - 1, Y - 1, Z - 1); out[0] = NRM[k * 3]; out[1] = NRM[k * 3 + 1]; out[2] = NRM[k * 3 + 2]; return out; };
  // the drawn surface's height over the top of natural voxel (x, y, z) at (fx, fz) inside its column (0 … 1)
  SN.topAt = function (x, y, z, fx, fz) {
    const a = relaxed(x - 1, y, z - 1), b = relaxed(x - 1, y, z), c = relaxed(x, y, z), d = relaxed(x - 1 + 1, y, z - 1);
    const ha = y + 1 + P1[a * 3 + 1], hb = y + 1 + P1[b * 3 + 1], hc = y + 1 + P1[c * 3 + 1], hd = y + 1 + P1[d * 3 + 1];
    return ha * (1 - fx) * (1 - fz) + hb * (1 - fx) * fz + hc * fx * fz + hd * fx * (1 - fz);
  };
  SN.isSoft = (b) => (TB ? TB.soft[b] : SN.tables().soft[b]) === 1;

  // facePos corner order (TL, BL, BR, TR) of face d of the unit box at the origin (mesher.js facePosInto)
  const FPC = [
    [1, 1, 1, 1, 0, 1, 1, 0, 0, 1, 1, 0], [0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1],
    [0, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 0], [0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 1],
    [0, 1, 1, 0, 0, 1, 1, 0, 1, 1, 1, 1], [1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0],
  ];
  const DOFF = [1, -1, PSS, -PSS, PS, -PS];
  const vk = new Int32Array(4), vp = new Float64Array(12);
  const MK = new Int32Array(256), MC = new Uint16Array(256), ML = new Uint16Array(256), MW = new Uint16Array(256);

  // ---- the mesh: every natural voxel's faces toward the air as quads of cell vertices; flat tops merged greedily.
  // buf: the mesher's opaque Buf; w3For(state, d): the texture word; hOut: Int16Array(256) column heights × 64 (world y,
  // −32768 none) — the highest drawn top in this section
  SN.mesh = function (job, buf, w3For, hOut) {
    const B = job.blocks, TF = R.T.flags, sy = job.sy | 0;
    if (!J || J.job !== job) SN.solve(job);
    if (hOut) hOut.fill(-32768);
    let quads = 0;
    for (let y = 0; y < 16; y++) {
      MK.fill(0);
      for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
        const bi = P(x, y, z);
        if (!S_[bi]) continue;
        const b = B[bi];
        for (let d = 0; d < 6; d++) {
          if (!AIR[bi + DOFF[d]]) continue;
          const C = FPC[d];
          let flat = d === 2;
          for (let q = 0; q < 4; q++) {
            const X = x + C[q * 3], Y = y + C[q * 3 + 1], Z = z + C[q * 3 + 2];
            const k = relaxed(X - 1, Y - 1, Z - 1); attrs(X - 1, Y - 1, Z - 1, k); vk[q] = k;
            vp[q * 3] = X + P1[k * 3]; vp[q * 3 + 1] = Y + P1[k * 3 + 1]; vp[q * 3 + 2] = Z + P1[k * 3 + 2];
            if (flat && (P1[k * 3] !== 0 || P1[k * 3 + 1] !== 0 || P1[k * 3 + 2] !== 0 || NRM[k * 3 + 1] < 0.99999 || VAO[k] !== 0)) flat = false;
          }
          if (d === 2 && hOut) {
            const h = (vp[1] + vp[4] + vp[7] + vp[10]) * 0.25 + sy * 16, hv = Math.round(h * 64);
            const ti = z * 16 + x; if (hv > hOut[ti]) hOut[ti] = Math.max(-32767, Math.min(32767, hv));
          }
          if (flat && VCOL[vk[0]] === VCOL[vk[1]] && VCOL[vk[1]] === VCOL[vk[2]] && VCOL[vk[2]] === VCOL[vk[3]] && VLIT[vk[0]] === VLIT[vk[1]] && VLIT[vk[1]] === VLIT[vk[2]] && VLIT[vk[2]] === VLIT[vk[3]]) {
            const mi = z * 16 + x; MK[mi] = 1; MC[mi] = VCOL[vk[0]]; ML[mi] = VLIT[vk[0]]; MW[mi] = w3For(b, 2);
            continue;
          }
          // the split along the shorter diagonal (the crease follows the surface)
          const d02 = (vp[0] - vp[6]) ** 2 + (vp[1] - vp[7]) ** 2 + (vp[2] - vp[8]) ** 2, d13 = (vp[3] - vp[9]) ** 2 + (vp[4] - vp[10]) ** 2 + (vp[5] - vp[11]) ** 2;
          const start = d02 <= d13 ? 0 : 1, w3 = w3For(b, d);
          buf.ensure(4);
          for (let kk = 0; kk < 4; kk++) {
            const q = (kk + start) & 3, k = vk[q], o = VOCT[k];
            buf.v(vp[q * 3], vp[q * 3 + 1], vp[q * 3 + 2], w3, o & 255, o >> 8, SN.FACE | (VAO[k] << 3), VLIT[k], VCOL[k]);
          }
          quads++;
        }
      }
      // the flat tops of this layer, merged (all four corners on the grid, the normal straight up, one colour and light)
      const up = SN.oct(0, 1, 0);
      for (let z = 0; z < 16; z++) for (let x = 0; x < 16;) {
        const mi = z * 16 + x;
        if (MK[mi] !== 1) { x++; continue; }
        const c0 = MC[mi], l0 = ML[mi], w0 = MW[mi];
        let w = 1;
        while (x + w < 16) { const mj = mi + w; if (MK[mj] !== 1 || MC[mj] !== c0 || ML[mj] !== l0 || MW[mj] !== w0) break; w++; }
        let h = 1;
        outer: while (z + h < 16) { for (let k = 0; k < w; k++) { const mj = (z + h) * 16 + x + k; if (MK[mj] !== 1 || MC[mj] !== c0 || ML[mj] !== l0 || MW[mj] !== w0) break outer; } h++; }
        for (let hh = 0; hh < h; hh++) for (let k = 0; k < w; k++) MK[(z + hh) * 16 + x + k] = 2;
        const Y = y + 1;
        buf.ensure(4);
        buf.v(x, Y, z, w0, up & 255, up >> 8, SN.FACE, l0, c0);
        buf.v(x, Y, z + h, w0, up & 255, up >> 8, SN.FACE, l0, c0);
        buf.v(x + w, Y, z + h, w0, up & 255, up >> 8, SN.FACE, l0, c0);
        buf.v(x + w, Y, z, w0, up & 255, up >> 8, SN.FACE, l0, c0);
        quads++; x += w;
      }
    }
    return quads;
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
