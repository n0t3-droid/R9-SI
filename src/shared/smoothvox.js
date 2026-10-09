// ============================================================================
// SmoothVox — Glatt-Modelle (t-form, the owner's „Form trotz Voxel"): a smooth surface from any voxel volume.
// The mesher is naive surface nets: one vertex per surface cell (a cell of the dual grid whose eight voxel corners are
// neither all set nor all empty), placed at the mean of the midpoints of its sign-changing edges; one quad per voxel
// edge that changes sign, between the four cells round it, split along its shorter diagonal. Then 2–3 Laplacian
// passes move the vertices toward their neighbours' mean, clamped to ±0.35 voxel of where they started, so a thin leg
// never collapses. Creases stay where the material or the colour changes sharply: every palette value belongs to a
// region (its material class and a colour cluster); a cell whose faces belong to several regions is split — a vertex
// per region with its own normal and colour — and it smooths only along the other crease cells (a lamp shade stays
// apart from its stem, a cushion from its frame). Glass is a pass of its own: its faces only where it meets empty
// space, so what stands behind glass keeps its own surface. Normals come from the smoothed faces (area weighted),
// colours from the voxels the faces cover, a cheap ambient occlusion from the volume.
// Input: a VM model (vol + pal, res 8 / 16 / 32 per block) or any grid of packed VX voxels (colour, PRESENT, EMIS,
// GLASS, GLOSS, HOLO, material bits 29–31). Output: a generic mesh (SV.mesh) and the layouts of the game's furniture
// pass (SV.toFurn: props.js' 14 floats a vertex, centred on the footprint) and of the Studio's model view (SV.toStudio).
// The game builds them lazily in its workers (worker_main.js 'smoothvox'), the Studio in its worker; every thread that
// meshes keeps an LRU of ~256 models. The game's tables (which block states get a smooth mesh, which are ready) are at
// the end of this file.
// ============================================================================
(function (VR) {
  'use strict';
  const SV = VR.SmoothVox = VR.SmoothVox || {};
  const PRESENT = 1 << 24, EMIS = 1 << 25, GLASS = 1 << 26, GLOSS = 1 << 27, HOLO = 1 << 28;
  SV.BITS = { PRESENT, EMIS, GLASS, GLOSS, HOLO };
  // the furniture pass's materials (props.js PR.MAT)
  const FM = SV.MAT = { fabric: 0, wood: 1, metal: 2, glass: 3, light: 4, matte: 5, gloss: 6, leaf: 7, marble: 8, leather: 9, shade: 10, shadow: 11 };
  // the VX material bits (voxarch.js VX.MAT: 1 fabric, 2 leather, 3 wood, 4 marble, 5 metal, 6 plant, 7 stone) → the pass's
  const MATB = [-1, FM.fabric, FM.leather, FM.wood, FM.marble, FM.metal, FM.leaf, FM.matte];
  const matOf = SV.matOf = (v) => (v & GLASS) ? FM.glass : (v & (EMIS | HOLO)) ? FM.light : ((v >>> 29) & 7) ? MATB[(v >>> 29) & 7] : (v & GLOSS) ? FM.gloss : FM.matte;
  SV.SMOOTH = { passes: 3, lambda: 0.6, clamp: 0.35, crease2: 50 * 50 };
  const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

  // ---------------------------------------------------------------- the corner table
  // corner c of a dual cell = (c & 1, c >> 1 & 1, c >> 2 & 1) in (x, y, z); for each of the 256 corner masks the mean of
  // the midpoints of the edges whose two corners differ (relative to the cell's first corner)
  const EDGES = []; for (let a = 0; a < 8; a++) for (let b = a + 1; b < 8; b++) { const d = a ^ b; if (d === 1 || d === 2 || d === 4) EDGES.push([a, b]); }
  const MP = new Float32Array(256 * 3);
  for (let m = 1; m < 255; m++) {
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of EDGES) { if (((m >> a) & 1) === ((m >> b) & 1)) continue; sx += ((a & 1) + (b & 1)) / 2; sy += (((a >> 1) & 1) + ((b >> 1) & 1)) / 2; sz += (((a >> 2) & 1) + ((b >> 2) & 1)) / 2; n++; }
    MP[m * 3] = sx / n; MP[m * 3 + 1] = sy / n; MP[m * 3 + 2] = sz / n;
  }

  // ---------------------------------------------------------------- growable typed arrays
  function GF(n) { this.a = new Float32Array(n); this.n = 0; }
  GF.prototype.need = function (k) { if (this.n + k > this.a.length) { const b = new Float32Array(Math.max(this.a.length * 2, this.n + k)); b.set(this.a); this.a = b; } };
  function GI(n) { this.a = new Int32Array(n); this.n = 0; }
  GI.prototype.need = function (k) { if (this.n + k > this.a.length) { const b = new Int32Array(Math.max(this.a.length * 2, this.n + k)); b.set(this.a); this.a = b; } };
  GI.prototype.push = function (v) { this.need(1); this.a[this.n++] = v; };

  // ---------------------------------------------------------------- a volume from a model (or a raw grid), at a step
  // V: packed voxels, cells NX × NY × NZ; step s merges s³ voxels into a cell: it is set when at least thr of them are,
  // and takes the most frequent value among them (an opaque value wins over glass when the opaque ones reach thr)
  SV.volume = function (src, step, thr) {
    const s = step || 1, VW = src.VW, VH = src.VH, VD = src.VD, vol = src.vol || null, pal = src.pal, RV = src.V;
    const NX = Math.ceil(VW / s), NY = Math.ceil(VH / s), NZ = Math.ceil(VD / s), V = new Uint32Array(NX * NY * NZ);
    if (s === 1) { if (vol) { for (let i = 0; i < V.length; i++) { const k = vol[i]; if (k) V[i] = pal[k]; } } else V.set(RV.subarray(0, V.length)); return { NX, NY, NZ, V, step: 1 }; }
    const T = thr || 1, S3 = s * s * s, vals = new Uint32Array(S3), cnt = new Int32Array(S3);
    // (step 2 from a palette volume with even sides: the eight indices are read straight; an empty or uniform 2³ — most
    // of them — is decided without counting)
    if (s === 2 && vol && !(VW & 1) && !(VH & 1) && !(VD & 1)) {
      const dy = VW * VD, dz = VW;
      for (let cy = 0; cy < NY; cy++) for (let cz = 0; cz < NZ; cz++) {
        let i0 = (cy * 2 * VD + cz * 2) * VW, o = (cy * NZ + cz) * NX;
        for (let cx = 0; cx < NX; cx++, i0 += 2, o++) {
          const k0 = vol[i0], k1 = vol[i0 + 1], k2 = vol[i0 + dz], k3 = vol[i0 + dz + 1], k4 = vol[i0 + dy], k5 = vol[i0 + dy + 1], k6 = vol[i0 + dy + dz], k7 = vol[i0 + dy + dz + 1];
          if (!(k0 | k1 | k2 | k3 | k4 | k5 | k6 | k7)) continue;
          if (k0 && k0 === k1 && k0 === k2 && k0 === k3 && k0 === k4 && k0 === k5 && k0 === k6 && k0 === k7) { V[o] = pal[k0]; continue; }
          let nd = 0, nOp = 0, nGl = 0;
          for (const k of [k0, k1, k2, k3, k4, k5, k6, k7]) {
            if (!k) continue; const v = pal[k];
            if (v & GLASS) nGl++; else nOp++;
            let j = 0; while (j < nd && vals[j] !== v) j++;
            if (j === nd) { vals[nd] = v; cnt[nd++] = 1; } else cnt[j]++;
          }
          const wantGlass = nOp < T;
          if ((wantGlass ? nGl : nOp) < T) continue;
          let best = -1, bc = 0;
          for (let j = 0; j < nd; j++) { if (((vals[j] & GLASS) !== 0) !== wantGlass) continue; if (cnt[j] > bc) { bc = cnt[j]; best = j; } }
          if (best >= 0) V[o] = vals[best];
        }
      }
      return { NX, NY, NZ, V, step: s };
    }
    for (let cy = 0; cy < NY; cy++) {
      const y0 = cy * s, y1 = Math.min(VH, y0 + s);
      for (let cz = 0; cz < NZ; cz++) {
        const z0 = cz * s, z1 = Math.min(VD, z0 + s);
        for (let cx = 0; cx < NX; cx++) {
          const x0 = cx * s, x1 = Math.min(VW, x0 + s);
          let nd = 0, nOp = 0, nGl = 0;
          for (let y = y0; y < y1; y++) for (let z = z0; z < z1; z++) {
            const row = (y * VD + z) * VW;
            for (let x = x0; x < x1; x++) {
              let v;
              if (vol) { const k = vol[row + x]; if (!k) continue; v = pal[k]; } else { v = RV[row + x]; if (!v) continue; }
              if (v & GLASS) nGl++; else nOp++;
              let k = 0; while (k < nd && vals[k] !== v) k++;
              if (k === nd) { vals[nd] = v; cnt[nd++] = 1; } else cnt[k]++;
            }
          }
          if (!nd) continue;
          const wantGlass = nOp < T;
          if ((wantGlass ? nGl : nOp) < T) continue;
          let best = -1, bc = 0;
          for (let k = 0; k < nd; k++) { if (((vals[k] & GLASS) !== 0) !== wantGlass) continue; if (cnt[k] > bc) { bc = cnt[k]; best = k; } }
          if (best >= 0) V[(cy * NZ + cz) * NX + cx] = vals[best];
        }
      }
    }
    return { NX, NY, NZ, V, step: s };
  };
  // a coarser volume from a finer one (the far mesh from the near one: a factor f more per cell, every voxel counts)
  SV.coarser = (vol, f) => { const r = SV.volume({ V: vol.V, VW: vol.NX, VH: vol.NY, VD: vol.NZ }, f, 1); r.step = vol.step * f; return r; };

  // ---------------------------------------------------------------- the mesher
  // SV.nets(vol, opts) → { nv, pos, nrm, rgb, mat, val, ao, idx, nOpaque, cells } in the volume's cell units
  // (a voxel spans [x, x + 1]); opts: passes, lambda, clamp, ao (false: no occlusion), glass (false: no glass pass)
  SV.nets = function (vol, o) {
    o = o || {};
    const t0 = now();
    const NX = vol.NX, NY = vol.NY, NZ = vol.NZ, V = vol.V;
    const PX = NX + 2, PY = NY + 2, PZ = NZ + 2, PXZ = PX * PZ;
    const DX = NX + 1, DY = NY + 1, DZ = NZ + 1, DXZ = DX * DZ;
    // the occupancy, padded with an empty border: 1 opaque, 2 glass
    const occ = new Uint8Array(PX * PY * PZ);
    let anyGlass = false;
    for (let y = 0; y < NY; y++) for (let z = 0; z < NZ; z++) {
      const row = (y * NZ + z) * NX, prow = ((y + 1) * PZ + z + 1) * PX + 1;
      for (let x = 0; x < NX; x++) { const v = V[row + x]; if (!v) continue; if (v & GLASS) { occ[prow + x] = 2; anyGlass = true; } else occ[prow + x] = 1; }
    }
    const cellV = new Int32Array(DX * DY * DZ);
    const P = new GF(4096 * 3);   // the cell vertices' positions (cell units)
    // the output vertices (a cell vertex per region), the faces
    const outCell = new GI(4096), outReg = new GI(4096), outNext = new GI(4096);
    const quads = new GI(4096 * 6);   // per quad: 4 cell vertices, region, the voxel value
    const qStart = [0, 0];            // the opaque quads, then the glass quads
    // regions: a palette value → region (its material class and a colour cluster)
    const regVal = [], regMat = [], regCol = [], regOf = new Map();
    const C2 = o.crease2 || SV.SMOOTH.crease2;
    let lastV = -1, lastR = -1;
    const regionOf = (v) => {
      if (v === lastV) return lastR;
      let r = regOf.get(v);
      if (r === undefined) {
        const m = matOf(v), c = v & 0xffffff, cr = (c >> 16) & 255, cg = (c >> 8) & 255, cb = c & 255;
        r = -1;
        for (let k = 0; k < regVal.length; k++) { if (regMat[k] !== m) continue; const q = regCol[k], dr = ((q >> 16) & 255) - cr, dg = ((q >> 8) & 255) - cg, db = (q & 255) - cb; if (dr * dr + dg * dg + db * db <= C2) { r = k; break; } }
        if (r < 0) { r = regVal.length; regVal.push(v); regMat.push(m); regCol.push(c); }
        regOf.set(v, r);
      }
      lastV = v; lastR = r;
      return r;
    };
    // a pass over one kind of matter: which = 1 (opaque) or 2 (glass); the cells and quads of that surface
    const S = new Uint8Array(occ.length);
    const pass = (which) => {
      for (let i = 0; i < occ.length; i++) S[i] = occ[i] === which ? 1 : 0;
      cellV.fill(-1);
      // the cell vertices (the corner mask slides along x: the cell's +x corners are the next cell's −x corners)
      for (let j = 0; j < DY; j++) for (let k = 0; k < DZ; k++) {
        const s0row = (j * PZ + k) * PX, drow = (j * DZ + k) * DX;
        let m = S[s0row] | (S[s0row + PXZ] << 2) | (S[s0row + PX] << 4) | (S[s0row + PXZ + PX] << 6);
        for (let i = 0; i < DX; i++) {
          const s1 = s0row + i + 1;
          m = (m & 0x55) | (S[s1] << 1) | (S[s1 + PXZ] << 3) | (S[s1 + PX] << 5) | (S[s1 + PXZ + PX] << 7);
          if (m !== 0 && m !== 255) {
            const vi = P.n / 3;
            P.need(3); P.a[P.n++] = i - 0.5 + MP[m * 3]; P.a[P.n++] = j - 0.5 + MP[m * 3 + 1]; P.a[P.n++] = k - 0.5 + MP[m * 3 + 2];
            cellV[drow + i] = vi;
          }
          m = (m >> 1) & 0x55;
        }
      }
      // the quads: every voxel edge whose ends differ — this matter against empty space (and opaque matter against glass:
      // what stands behind glass keeps its surface) — between the four cells round it, wound so it looks out of the matter
      const emit = (sp, vIdx, c0, c1, c2, c3) => {
        if (c0 < 0 || c1 < 0 || c2 < 0 || c3 < 0) return;
        const v = V[vIdx];
        quads.need(6);
        const Q = quads.a, n = quads.n;
        if (sp) { Q[n] = c0; Q[n + 1] = c1; Q[n + 2] = c2; Q[n + 3] = c3; } else { Q[n] = c0; Q[n + 1] = c3; Q[n + 2] = c2; Q[n + 3] = c1; }
        Q[n + 4] = regionOf(v); Q[n + 5] = v | 0; quads.n = n + 6;
      };
      const glassPass = which === 2;
      // x edges: p = (x, y, z) padded, q = p + 1; the cells (x, y−1…y, z−1…z)
      for (let y = 1; y <= NY; y++) for (let z = 1; z <= NZ; z++) {
        const row = (y * PZ + z) * PX, a = ((y - 1) * DZ + z - 1) * DX, b = (y * DZ + z - 1) * DX, vrow = ((y - 1) * NZ + z - 1) * NX - 1;
        for (let x = 0; x <= NX; x++) {
          const p = row + x, sp = S[p], sq = S[p + 1];
          if (sp === sq) continue;
          if (glassPass && occ[sp ? p + 1 : p] !== 0) continue;
          emit(sp, vrow + x + (sp ? 0 : 1), cellV[a + x], cellV[b + x], cellV[b + DX + x], cellV[a + DX + x]);
        }
      }
      // y edges: q = p + PXZ; the cells (x−1…x, y, z−1…z)
      for (let y = 0; y <= NY; y++) for (let z = 1; z <= NZ; z++) {
        const row = (y * PZ + z) * PX, r0 = (y * DZ + z - 1) * DX, r1 = r0 + DX, vrow = ((y - 1) * NZ + z - 1) * NX - 1;
        for (let x = 1; x <= NX; x++) {
          const p = row + x, sp = S[p], sq = S[p + PXZ];
          if (sp === sq) continue;
          if (glassPass && occ[sp ? p + PXZ : p] !== 0) continue;
          emit(sp, vrow + x + (sp ? 0 : NX * NZ), cellV[r0 + x - 1], cellV[r1 + x - 1], cellV[r1 + x], cellV[r0 + x]);
        }
      }
      // z edges: q = p + PX; the cells (x−1…x, y−1…y, z)
      for (let y = 1; y <= NY; y++) for (let z = 0; z <= NZ; z++) {
        const row = (y * PZ + z) * PX, a = ((y - 1) * DZ + z) * DX, b = (y * DZ + z) * DX, vrow = ((y - 1) * NZ + z - 1) * NX - 1;
        for (let x = 1; x <= NX; x++) {
          const p = row + x, sp = S[p], sq = S[p + PX];
          if (sp === sq) continue;
          if (glassPass && occ[sp ? p + PX : p] !== 0) continue;
          emit(sp, vrow + x + (sp ? 0 : NX), cellV[a + x - 1], cellV[a + x], cellV[b + x], cellV[b + x - 1]);
        }
      }
    };
    pass(1); qStart[1] = quads.n;
    if (anyGlass && o.glass !== false) pass(2);
    const nCell = P.n / 3, nQ = quads.n / 6, Q = quads.a;
    // the output vertices: (cell vertex, region) pairs; first per cell in cellOut, the rest chained
    const cellOut = new Int32Array(nCell).fill(-1);
    const qOut = new Int32Array(nQ * 4);
    outCell.need(nCell + 64); outReg.need(nCell + 64); outNext.need(nCell + 64);
    for (let q = 0; q < nQ; q++) {
      const r = Q[q * 6 + 4];
      for (let e = 0; e < 4; e++) {
        const c = Q[q * 6 + e];
        let v = cellOut[c];
        while (v >= 0 && outReg.a[v] !== r) v = outNext.a[v];
        if (v < 0) { outCell.need(1); outReg.need(1); outNext.need(1); v = outCell.n; outCell.a[outCell.n++] = c; outReg.a[outReg.n++] = r; outNext.a[outNext.n++] = cellOut[c]; cellOut[c] = v; }
        qOut[q * 4 + e] = v;
      }
    }
    const nOut = outCell.n;
    // crease cells: more than one region meets there
    const crease = new Uint8Array(nCell);
    for (let c = 0; c < nCell; c++) { const v = cellOut[c]; if (v >= 0 && outNext.a[v] >= 0) crease[c] = 1; }
    // smoothing: the neighbours of a cell vertex are the next corners of its quads (each edge once each way)
    const deg = new Int32Array(nCell + 1);
    for (let q = 0; q < nQ; q++) for (let e = 0; e < 4; e++) deg[Q[q * 6 + e] + 1]++;
    for (let c = 0; c < nCell; c++) deg[c + 1] += deg[c];
    const adj = new Int32Array(deg[nCell]), fillAt = deg.slice(0, nCell);
    for (let q = 0; q < nQ; q++) for (let e = 0; e < 4; e++) adj[fillAt[Q[q * 6 + e]]++] = Q[q * 6 + ((e + 1) & 3)];
    const P0 = P.a.slice(0, P.n);
    let A = P.a.slice(0, P.n), B = new Float32Array(P.n);
    const passes = o.passes === undefined ? SV.SMOOTH.passes : o.passes, lam = o.lambda || SV.SMOOTH.lambda, cl = o.clamp === undefined ? SV.SMOOTH.clamp : o.clamp;
    for (let it = 0; it < passes; it++) {
      for (let c = 0; c < nCell; c++) {
        let sx = 0, sy = 0, sz = 0, n = 0;
        const cr = crease[c];
        for (let e = deg[c]; e < deg[c + 1]; e++) { const d = adj[e]; if (cr && !crease[d]) continue; sx += A[d * 3]; sy += A[d * 3 + 1]; sz += A[d * 3 + 2]; n++; }
        for (let k = 0; k < 3; k++) {
          const p = A[c * 3 + k];
          let t = n ? p + lam * ((k === 0 ? sx : k === 1 ? sy : sz) / n - p) : p;
          const o0 = P0[c * 3 + k];
          if (t > o0 + cl) t = o0 + cl; else if (t < o0 - cl) t = o0 - cl;
          B[c * 3 + k] = t;
        }
      }
      const T = A; A = B; B = T;
    }
    // the faces' normals (the diagonals' cross product: twice the area) into their output vertices; the colours
    const N = new Float32Array(nOut * 3), csum = new Float32Array(nOut * 3), ccnt = new Float32Array(nOut);
    for (let q = 0; q < nQ; q++) {
      const a = Q[q * 6], b = Q[q * 6 + 1], c = Q[q * 6 + 2], d = Q[q * 6 + 3];
      const ux = A[c * 3] - A[a * 3], uy = A[c * 3 + 1] - A[a * 3 + 1], uz = A[c * 3 + 2] - A[a * 3 + 2];
      const vx = A[d * 3] - A[b * 3], vy = A[d * 3 + 1] - A[b * 3 + 1], vz = A[d * 3 + 2] - A[b * 3 + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const v = Q[q * 6 + 5], r8 = (v >> 16) & 255, g8 = (v >> 8) & 255, b8 = v & 255;
      for (let e = 0; e < 4; e++) { const w = qOut[q * 4 + e]; N[w * 3] += nx; N[w * 3 + 1] += ny; N[w * 3 + 2] += nz; csum[w * 3] += r8; csum[w * 3 + 1] += g8; csum[w * 3 + 2] += b8; ccnt[w]++; }
    }
    // the output arrays
    const pos = new Float32Array(nOut * 3), nrm = new Float32Array(nOut * 3), rgb = new Uint8Array(nOut * 3), mat = new Uint8Array(nOut), val = new Uint32Array(nOut), ao = new Float32Array(nOut);
    for (let w = 0; w < nOut; w++) {
      const c = outCell.a[w];
      pos[w * 3] = A[c * 3]; pos[w * 3 + 1] = A[c * 3 + 1]; pos[w * 3 + 2] = A[c * 3 + 2];
      let nx = N[w * 3], ny = N[w * 3 + 1], nz = N[w * 3 + 2]; const l = Math.hypot(nx, ny, nz);
      if (l > 1e-12) { nx /= l; ny /= l; nz /= l; } else { nx = 0; ny = 1; nz = 0; }
      nrm[w * 3] = nx; nrm[w * 3 + 1] = ny; nrm[w * 3 + 2] = nz;
      const k = ccnt[w] || 1; rgb[w * 3] = Math.round(csum[w * 3] / k); rgb[w * 3 + 1] = Math.round(csum[w * 3 + 1] / k); rgb[w * 3 + 2] = Math.round(csum[w * 3 + 2] / k);
      const r = outReg.a[w]; mat[w] = regMat[r]; val[w] = regVal[r];
    }
    // ambient occlusion: point samples of the opaque matter along the normal and four rays tilted from it
    if (o.ao !== false) {
      const sc = o.aoScale || 1, DD = [1.6 * sc, 4 * sc], DIR = new Float32Array(15);
      for (let w = 0; w < nOut; w++) {
        const px = pos[w * 3] + 1, py = pos[w * 3 + 1] + 1, pz = pos[w * 3 + 2] + 1, nx = nrm[w * 3], ny = nrm[w * 3 + 1], nz = nrm[w * 3 + 2];
        // the normal and four rays tilted 45° from it (a tangent frame)
        let tx = -nz, ty = 0, tz = nx; if (ny > 0.9 || ny < -0.9) { tx = 1; ty = 0; tz = 0; }
        const tl = Math.sqrt(tx * tx + ty * ty + tz * tz); tx /= tl; ty /= tl; tz /= tl;
        const bx = ny * tz - nz * ty, by = nz * tx - nx * tz, bz = nx * ty - ny * tx;
        DIR[0] = nx; DIR[1] = ny; DIR[2] = nz;
        DIR[3] = (nx + tx) * 0.7; DIR[4] = (ny + ty) * 0.7; DIR[5] = (nz + tz) * 0.7; DIR[6] = (nx - tx) * 0.7; DIR[7] = (ny - ty) * 0.7; DIR[8] = (nz - tz) * 0.7;
        DIR[9] = (nx + bx) * 0.7; DIR[10] = (ny + by) * 0.7; DIR[11] = (nz + bz) * 0.7; DIR[12] = (nx - bx) * 0.7; DIR[13] = (ny - by) * 0.7; DIR[14] = (nz - bz) * 0.7;
        let hit = 0;
        for (let di = 0; di < 2; di++) {
          const d = DD[di];
          for (let r = 0; r < 15; r += 3) {
            const ix = Math.floor(px + DIR[r] * d), iy = Math.floor(py + DIR[r + 1] * d), iz = Math.floor(pz + DIR[r + 2] * d);
            if (ix >= 0 && iy >= 0 && iz >= 0 && ix < PX && iy < PY && iz < PZ && occ[(iy * PZ + iz) * PX + ix] === 1) hit++;
          }
        }
        ao[w] = 1 - 0.06 * hit;
      }
    } else ao.fill(1);
    // the triangles: each quad along its shorter diagonal; the opaque quads first
    const idx = new Uint32Array(nQ * 6);
    let ni = 0, nOpaque = 0;
    for (let q = 0; q < nQ; q++) {
      if (q * 6 === qStart[1]) nOpaque = ni;
      const a = Q[q * 6], b = Q[q * 6 + 1], c = Q[q * 6 + 2], d = Q[q * 6 + 3];
      const wa = qOut[q * 4], wb = qOut[q * 4 + 1], wc = qOut[q * 4 + 2], wd = qOut[q * 4 + 3];
      const d02 = (A[c * 3] - A[a * 3]) ** 2 + (A[c * 3 + 1] - A[a * 3 + 1]) ** 2 + (A[c * 3 + 2] - A[a * 3 + 2]) ** 2;
      const d13 = (A[d * 3] - A[b * 3]) ** 2 + (A[d * 3 + 1] - A[b * 3 + 1]) ** 2 + (A[d * 3 + 2] - A[b * 3 + 2]) ** 2;
      if (d02 <= d13) { idx[ni++] = wa; idx[ni++] = wb; idx[ni++] = wc; idx[ni++] = wa; idx[ni++] = wc; idx[ni++] = wd; }
      else { idx[ni++] = wa; idx[ni++] = wb; idx[ni++] = wd; idx[ni++] = wb; idx[ni++] = wc; idx[ni++] = wd; }
    }
    if (qStart[1] >= quads.n) nOpaque = ni;
    return { nv: nOut, pos, nrm, rgb, mat, val, ao, idx, nOpaque, cells: nCell, quads: nQ, regions: regVal.length, ms: now() - t0, NX, NY, NZ };
  };

  // the default resolution: res-32 models at 16 cells a block (the dominant voxel of each 2³, set when ≥ 2 of 8 are);
  // res 8 and 16 at their own; the far mesh at 4 a block (every voxel counts, so thin parts stay visible)
  SV.stepFor = (res) => (res >= 32 ? 2 : 1);
  SV.farStep = (res) => Math.max(1, Math.round(res / 4));
  // a model's (or a grid's) generic mesh at a step (opts.step), in the model's voxel units (×step: the volume's cells)
  SV.mesh = function (src, opts) {
    opts = opts || {};
    const res = src.res || 16, step = opts.step || SV.stepFor(res);
    const vol = opts.vol || SV.volume(src, step, opts.thr || (step > 1 ? 2 : 1));
    const g = SV.nets(vol, opts);
    g.vol = vol;
    // positions in model voxels (the volume's cells × step)
    if (step !== 1) for (let i = 0; i < g.pos.length; i++) g.pos[i] *= step;
    g.step = step; g.res = res;
    return g;
  };
  // a palette with the lamps switched off (voxmodel.js lightsOff: the glowing voxels go to their frosted, unlit glass)
  SV.offPal = function (pal) {
    const VM = VR.VM, out = Uint32Array.from(pal);
    for (let i = 1; i < out.length; i++) { const v = out[i]; if (v & EMIS) out[i] = (((VM && VM.offColor ? VM.offColor(v) : v) & 0xffffff) | PRESENT | (v & (GLASS | GLOSS | 0xE0000000))) >>> 0; }
    return out;
  };

  // ---------------------------------------------------------------- the game's layout (props.js, 14 floats a vertex)
  // pos (block units, centred on the footprint: x −W/2…W/2, y from the floor of part 0, z −D/2…D/2), normal, uv (the
  // atlas's white quarter), colour (linear), material, tint slot 0 (its own colour), ambient occlusion (× 0.78 facing
  // down, as the hand-built pieces); opaque triangles first, then glass and the soft contact shadow
  const LIN = new Float32Array(256); for (let i = 0; i < 256; i++) LIN[i] = Math.pow(i / 255, 2.2);
  SV.VSTRIDE = 14;
  function furnPart(g, W, D, y0, scale, withGlass, shadow) {
    const nv = g.nv, S = SV.VSTRIDE, verts = new Float32Array((nv + (shadow ? 4 : 0)) * S);
    let mnx = Infinity, mny = Infinity, mnz = Infinity, mxx = -Infinity, mxy = -Infinity, mxz = -Infinity;
    for (let i = 0; i < nv; i++) {
      const o = i * S, x = g.pos[i * 3] * scale - W / 2, y = g.pos[i * 3 + 1] * scale - y0, z = g.pos[i * 3 + 2] * scale - D / 2;
      verts[o] = x; verts[o + 1] = y; verts[o + 2] = z;
      const ny = g.nrm[i * 3 + 1];
      verts[o + 3] = g.nrm[i * 3]; verts[o + 4] = ny; verts[o + 5] = g.nrm[i * 3 + 2];
      verts[o + 6] = 0.875; verts[o + 7] = 0.875;
      verts[o + 8] = LIN[g.rgb[i * 3]]; verts[o + 9] = LIN[g.rgb[i * 3 + 1]]; verts[o + 10] = LIN[g.rgb[i * 3 + 2]];
      verts[o + 11] = g.mat[i]; verts[o + 12] = 0; verts[o + 13] = Math.max(0.35, g.ao[i]) * (ny < -0.6 ? 0.78 : 1);
      if (x < mnx) mnx = x; if (x > mxx) mxx = x; if (y < mny) mny = y; if (y > mxy) mxy = y; if (z < mnz) mnz = z; if (z > mxz) mxz = z;
    }
    const nOp = g.nOpaque, nTr = withGlass ? g.idx.length - nOp : 0;
    const floorY = -y0, shadowOn = shadow && nv > 0 && mny < floorY + 0.08;   // a piece standing on the floor
    const idx = new Uint16Array(nOp + nTr + (shadowOn ? 6 : 0));
    for (let t = 0; t < nOp; t++) idx[t] = g.idx[t];
    for (let t = 0; t < nTr; t++) idx[nOp + t] = g.idx[nOp + t];
    let nvOut = nv;
    if (shadowOn) {
      // the soft contact shadow on the floor (props.js F.shadow): a quad a little wider than the piece, uv 0…1 (the
      // shader fades its edges)
      const e = 1 / 16, x0 = mnx - e, x1 = mxx + e, z0 = mnz - e, z1 = mxz + e, Y = floorY + 0.12 / 16;
      const P4 = [[x0, Y, z1, 0, 1], [x1, Y, z1, 1, 1], [x1, Y, z0, 1, 0], [x0, Y, z0, 0, 0]];
      for (let k = 0; k < 4; k++) { const o = (nv + k) * S, p = P4[k]; verts[o] = p[0]; verts[o + 1] = p[1]; verts[o + 2] = p[2]; verts[o + 4] = 1; verts[o + 6] = p[3]; verts[o + 7] = p[4]; verts[o + 8] = verts[o + 9] = verts[o + 10] = 1; verts[o + 11] = FM.shadow; verts[o + 13] = 1; }
      const b = nOp + nTr; idx[b] = nv; idx[b + 1] = nv + 1; idx[b + 2] = nv + 2; idx[b + 3] = nv; idx[b + 4] = nv + 2; idx[b + 5] = nv + 3;
      nvOut += 4;
    }
    return { verts: nvOut === nv + (shadow ? 4 : 0) ? verts : verts.slice(0, nvOut * S), idx, nv: nvOut, nt: idx.length / 3, nOpaque: nOp, min: [mnx, mny, mnz], max: [mxx, mxy, mxz] };
  }
  // a model's game record: { near, far, size, cell, key } — the near mesh at the default step (coarser when it would
  // need more than 65 535 vertices), the far mesh at 4 a block (opaque only), the anchor part's cell offset
  SV.forModel = function (m, opts) {
    opts = opts || {};
    const t0 = now(), res = m.res, p0 = m.parts && m.parts[0] ? m.parts[0] : { px: 0, py: 0, pz: 0 };
    const src = opts.off ? { vol: m.vol, pal: SV.offPal(m.pal), VW: m.VW, VH: m.VH, VD: m.VD, res } : m;
    let step = opts.step || SV.stepFor(res), g = null;
    for (;;) { g = SV.mesh(src, { step, aoScale: res / step / 16 }); if (g.nv + 4 <= 65535 || step >= res) break; step *= 2; }
    const fs = Math.max(step, SV.farStep(res)), fv = fs > step ? SV.coarser(g.vol, Math.round(fs / step)) : g.vol;
    const far = SV.mesh(src, { step: fs, vol: fv, passes: 1, glass: false, ao: false });
    g.vol = null;
    const scale = 1 / res;
    const near = furnPart(g, m.W, m.D, p0.py, scale, true, true);
    const farM = far.nv ? furnPart(far, m.W, m.D, p0.py, scale, false, false) : null;
    return { near, far: farM, size: [m.W, m.H, m.D], cell: [p0.px, p0.pz], step, ms: now() - t0, cells: g.cells };
  };

  // ---------------------------------------------------------------- the Studio's layout (studio.js meshModel, 15 floats)
  // pos, normal, colour (sRGB 0…1), uv (the dominant axis' plane, one tile a block), ao, face (the dominant axis, for
  // the material texture's frame), layer, flags (1 glowing, 2 glass); { verts, glass, tri, quads } like meshModel
  const LAYERM = [0, 4, 5, 6, 7, 8, 9, 10];   // studio.js MATL: the VX material bits → the Studio's texture layers
  SV.toStudio = function (g, scale, off) {
    const S = 15, o3 = off || [0, 0, 0], k = scale || 1 / 16;
    const opq = [], gl = [];
    const put = (arr, w) => {
      const x = g.pos[w * 3] * k + o3[0], y = g.pos[w * 3 + 1] * k + o3[1], z = g.pos[w * 3 + 2] * k + o3[2];
      const nx = g.nrm[w * 3], ny = g.nrm[w * 3 + 1], nz = g.nrm[w * 3 + 2], ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
      const face = ax >= ay && ax >= az ? (nx > 0 ? 0 : 1) : ay >= az ? (ny > 0 ? 2 : 3) : (nz > 0 ? 4 : 5);
      const u = face < 2 ? z : x, v = face < 2 || face > 3 ? y : z;
      const v0 = g.val[w], glass = (v0 & GLASS) !== 0, emis = (v0 & (EMIS | HOLO)) !== 0, mid = (v0 >>> 29) & 7;
      const layer = glass ? 2 : mid ? LAYERM[mid] : (v0 & HOLO) ? 3 : (v0 & GLOSS) ? 1 : 0;
      arr.push(x, y, z, nx, ny, nz, g.rgb[w * 3] / 255, g.rgb[w * 3 + 1] / 255, g.rgb[w * 3 + 2] / 255, u, v, Math.max(0.35, g.ao[w]), face, layer, (emis ? 1 : 0) | (glass ? 2 : 0));
    };
    for (let t = 0; t < g.idx.length; t++) put(t < g.nOpaque ? opq : gl, g.idx[t]);
    return { verts: new Float32Array(opq), glass: new Float32Array(gl), tri: g.idx.length / 3, quads: g.quads, smooth: true, stride: S };
  };

  // ---------------------------------------------------------------- the LRU cache (every thread that meshes keeps one)
  SV.CACHE_MAX = 256; SV.CACHE_BYTES = 24 << 20;
  SV.LRU = function (max, bytes) { this.max = max || SV.CACHE_MAX; this.maxBytes = bytes || SV.CACHE_BYTES; this.map = new Map(); this.bytes = 0; };
  SV.LRU.prototype.get = function (k) { const e = this.map.get(k); if (!e) return undefined; this.map.delete(k); this.map.set(k, e); return e.v; };
  SV.LRU.prototype.set = function (k, v, b) {
    const old = this.map.get(k); if (old) { this.bytes -= old.b; this.map.delete(k); }
    this.map.set(k, { v, b: b || 0 }); this.bytes += b || 0;
    while (this.map.size > 1 && (this.map.size > this.max || this.bytes > this.maxBytes)) { const k0 = this.map.keys().next().value; this.bytes -= this.map.get(k0).b; this.map.delete(k0); }
  };
  SV.LRU.prototype.clear = function () { this.map.clear(); this.bytes = 0; };

  // ================================================================ the game: which pieces, when ready, the lazy meshes
  // The pieces that get a surface-nets mesh: every VM model (vxModel) without a hand-built smooth mesh (not in
  // VR.PROP_FURN — hand-built meshes win), that is no prop of its own (the palms), does not join its neighbours into one
  // form (the windows, gutters, downpipes, the garage door, the Nova tread) and is not one of the plants pack's crowns,
  // bushes, tufts and crops (the terrain's own plants). A switch (o.toggle) has a second entry: its switched-off look.
  // The list follows the registry, so every thread makes the same one: an entry's index means the same piece in the
  // workers and on the main thread; its prop kind is AUTO0 + the index (the mesher's anchors, props.js PR.AUTO).
  const AUTO0 = SV.AUTO0 = 4096;
  SV.SKIP = /^vm_(win_|gutter|downpipe|garage_door|nova_tread|palm_crown|tree_round|bush_blossom|flower_cluster|tuft_grass|crop_rows)/;
  SV.enabled = true;                    // (the tests hold it back to take the „before" picture)
  let AT = null;
  SV.autoTables = function () {
    if (AT) return AT;
    const R = VR.R, VM = VR.VM; if (!R || !R.types || !VM) return null;
    const furn = new Set(VR.PROP_FURN || []), n = R.stateCount + 1;
    const list = [], idx = new Int32Array(n).fill(-1), anchor = new Uint8Array(n), facing = new Uint8Array(n), states = [];
    for (const t of R.types) {
      const o = t.o || {}, m = VM.MODELS[t.name];
      if (!m || !o.vxModel || furn.has(t.name) || o.prop || o.propStem || SV.SKIP.test(t.name)) continue;
      const i0 = list.length, tog = !!o.toggle && t.has('lit');
      list.push({ name: t.name, off: false });
      if (tog) list.push({ name: t.name, off: true });
      for (let st = t.base; st < t.base + t.nstates && st < n; st++) {
        idx[st] = tog && !t.get(st, 'lit') ? i0 + 1 : i0;
        anchor[st] = !t.has('part') || t.get(st, 'part') === 0 ? 1 : 0;
        facing[st] = t.has('facing') ? t.get(st, 'facing') & 3 : 0;
        states.push(st);
      }
    }
    AT = { list, idx, anchor, facing, states: Int32Array.from(states), n: list.length };
    return AT;
  };
  SV.indexOf = (name, off) => { const A = SV.autoTables(); if (!A) return -1; for (let i = 0; i < A.n; i++) if (A.list[i].name === name && A.list[i].off === !!off) return i; return -1; };
  // the ready bits (one per entry): the main thread sets them as the meshes arrive; every mesh job carries them
  SV.ready = { ver: 0, bits: null };
  const isReady = SV.isReady = (bits, i) => !!bits && ((bits[i >> 3] >> (i & 7)) & 1) === 1;

  // ---------------------------------------------------------------- the worker: the mesher's tables, the job's bits, the wants
  // mesher.js propTables() hands its tables over once (one additive line): every state of an eligible piece that is no
  // prop already gets its auto kind (an Int32 copy of the kind table), its anchor (part 0) and its facing; its group stays
  // 0 — the mesher draws its voxels — until its mesh is ready, then it is furniture (the furniture pass draws it)
  let PT = null, GFURN = 2, applied = -1;
  SV.tables = function (T, GROUP) {
    if (!SV.enabled) return;
    const A = SV.autoTables(); if (!A) return;
    GFURN = (GROUP && GROUP.furniture) || 2;
    const kind = new Int32Array(T.kind.length); kind.set(T.kind);
    const mine = [];
    for (let k = 0; k < A.states.length; k++) {
      const st = A.states[k]; if (st >= kind.length || T.kind[st] || T.group[st]) continue;
      kind[st] = AUTO0 + A.idx[st]; T.anchor[st] = A.anchor[st]; T.facing[st] = A.facing[st]; mine.push(st);
    }
    T.kind = kind; T.autoStates = Int32Array.from(mine);
    PT = T; applyReady();
  };
  function applyReady() {
    if (!PT || !PT.autoStates || !AT) return;
    const bits = SV.ready.bits, G = PT.group, S = PT.autoStates;
    for (let k = 0; k < S.length; k++) { const st = S[k]; G[st] = isReady(bits, AT.idx[st]) ? GFURN : 0; }
    applied = SV.ready.ver;
  }
  // worker_main.js 'mesh', before the mesher: the job's ready bits, then the pieces in the section's own 16³ that are not
  // ready yet (the main thread asks for their meshes) — only for a job that draws the furniture smooth (never Very Low)
  // and has its detail (a far section waits until the player comes close)
  SV.prep = function (job) {
    if (!SV.enabled || !((job.smoothProps | 0) & 2)) return null;
    const A = SV.autoTables(); if (!A) return null;
    const r = job.svReady;
    if (r && r.bits && r.ver !== SV.ready.ver) SV.ready = { ver: r.ver, bits: r.bits };
    if (PT && applied !== SV.ready.ver) applyReady();
    if (job.vxDetail === false || !job.blocks) return null;
    const B = job.blocks, PS = VR.MESH_PS || 20, PAD = VR.MESH_PAD || 2, PSS = PS * PS, bits = SV.ready.bits, I = A.idx;
    let want = null;
    for (let y = 0; y < 16; y++) for (let z = 0; z < 16; z++) {
      const row = (y + PAD) * PSS + (z + PAD) * PS + PAD;
      for (let x = 0; x < 16; x++) {
        const st = B[row + x]; if (!st) continue;
        const i = I[st]; if (i < 0 || isReady(bits, i)) continue;
        if (!want) want = [i]; else if (want.indexOf(i) < 0) want.push(i);
      }
    }
    return want;
  };
  // the 'smoothvox' job: one model's meshes — the game's layout (near, far, size, the anchor's cell) or the Studio's
  // (m.layout 'studio'); a model by name (its design version in m.ver), or a raw volume (m.vol + m.pal, the Crafter's
  // edit). Kept in the thread's LRU; what goes back is a copy (its buffers are transferred)
  SV.cache = null;
  const bytesOf = (r) => { let b = 0; for (const k of ['near', 'far']) if (r[k]) b += r[k].verts.byteLength + r[k].idx.byteLength; if (r.verts) b += r.verts.byteLength + r.glass.byteLength; return b; };
  const copyPart = (p, tr) => { if (!p) return null; const q = Object.assign({}, p, { verts: p.verts.slice(), idx: p.idx.slice() }); tr.push(q.verts.buffer, q.idx.buffer); return q; };
  SV.studioMesh = function (src, opts) {
    const res = src.res || 16, g = SV.mesh(src, Object.assign({ step: res >= 32 ? 1 : 1, aoScale: res / 16 }, opts || {}));
    return SV.toStudio(g, 1 / res, [0, 0, 0]);
  };
  SV.job = function (m) {
    const t0 = now(), VM = VR.VM, tr = [];
    const cache = SV.cache || (SV.cache = new SV.LRU());
    let r = null, key = null;
    if (m.name) {
      const model = VM && VM.MODELS[m.name];
      if (!model) return { error: 'unknown model ' + m.name, transfer: tr };
      key = m.name + (m.off ? ':off' : '') + '#' + (m.ver | 0) + (m.layout === 'studio' ? ':studio' : '');
      r = cache.get(key);
      if (!r) { r = m.layout === 'studio' ? SV.studioMesh(model, { off: !!m.off }) : SV.forModel(model, { off: !!m.off }); cache.set(key, r, bytesOf(r)); }
    } else if (m.vol && m.pal) {
      const src = { vol: m.vol, pal: m.pal, VW: m.VW, VH: m.VH, VD: m.VD, res: m.res || 16 };
      r = m.layout === 'furn' ? SV.forModel(Object.assign({ W: m.W, H: m.H, D: m.D, parts: null }, src)) : SV.studioMesh(src);
    } else return { error: 'nothing to mesh', transfer: tr };
    const out = { ver: m.ver | 0, name: m.name || null, ms: now() - t0, transfer: tr };
    if (r.near) { out.near = copyPart(r.near, tr); out.far = copyPart(r.far, tr); out.size = r.size; out.cell = r.cell; out.step = r.step; }
    else { out.verts = r.verts.slice(); out.glass = r.glass.slice(); out.tri = r.tri; out.quads = r.quads; tr.push(out.verts.buffer, out.glass.buffer); }
    return out;
  };

  // ---------------------------------------------------------------- the main thread: ask, register, mesh again
  // world.js tags every mesh job with the ready bits (tagJob) and hands a mesh answer's wants here (want): an entry not
  // asked for yet is asked from the worker pool ('smoothvox'); its mesh is registered in props.js (PR.registerAuto), its
  // bit set, and the sections that wanted it are made dirty — they come back with the smooth anchor. A design changed in
  // the Studio (custom.js refreshModel) takes the model's meshes back: a new version is asked for.
  const MAIN = SV.main = { asked: new Set(), waiting: new Map(), ver: {}, world: null, stats: { asked: 0, got: 0, ms: 0, bytes: 0, redo: 0 } };
  SV.verOf = (name) => MAIN.ver[name] | 0;
  const bitsFor = (n) => new Uint8Array((n + 7) >> 3);
  SV.tagJob = function (job) {
    if (!SV.enabled || !((job.smoothProps | 0) & 2)) return;
    const A = SV.autoTables(); if (!A) return;
    if (!SV.ready.bits) { SV.ready.bits = bitsFor(A.n); SV.ready.ver = 1; }
    job.svReady = SV.ready;   // (cloned when the pool posts the job: the bits of that moment)
  };
  SV.want = function (list, world, c, sy) {
    if (!list || !list.length || !SV.enabled || !world) return;
    const A = SV.autoTables(); if (!A) return;
    if (MAIN.world !== world) {   // another world: what was asked for and never came is asked again
      MAIN.world = world; MAIN.waiting.clear();
      for (const i of [...MAIN.asked]) if (!isReady(SV.ready.bits, i)) MAIN.asked.delete(i);
    }
    let redo = false;
    for (const i of list) {
      if (i < 0 || i >= A.n) continue;
      if (isReady(SV.ready.bits, i)) { redo = true; continue; }   // the job left before the mesh came: mesh the section again
      let w = MAIN.waiting.get(i); if (!w) MAIN.waiting.set(i, w = new Map());
      w.set(c.key + ':' + sy, [c, sy]);
      if (!MAIN.asked.has(i)) { MAIN.asked.add(i); SV.ask(i, world); }
    }
    if (redo) { const sc = c.sec && c.sec[sy]; if (sc && (sc.svRedo = (sc.svRedo | 0) + 1) <= 3) { sc.dirty = true; sc.ver++; MAIN.stats.redo++; } }
  };
  SV.ask = function (i, world) {
    const e = AT.list[i];
    MAIN.stats.asked++;
    world.pool.submit({ type: 'smoothvox', name: e.name, off: e.off, ver: SV.verOf(e.name) }, null, (m) => SV.got(i, m, world), 1);
  };
  SV.got = function (i, m, world) {
    const e = AT && AT.list[i], PR = VR.Props;
    if (!e || !m || m.type !== 'smoothvox' || !m.near || m.ver !== SV.verOf(e.name) || !PR || !PR.registerAuto) { MAIN.asked.delete(i); return; }   // failed, cancelled or out of date: asked again with the next want
    PR.registerAuto(AUTO0 + i, e.name + (e.off ? ':off' : '') + '#' + m.ver, m.size, m.cell, { near: m.near, far: m.far });
    if (!SV.ready.bits) SV.ready.bits = bitsFor(AT.n);
    SV.ready.bits[i >> 3] |= 1 << (i & 7); SV.ready.ver++;
    MAIN.stats.got++; MAIN.stats.ms += m.ms || 0; MAIN.stats.bytes += bytesOf(m);
    const w = MAIN.waiting.get(i); MAIN.waiting.delete(i);
    if (w) for (const [c, sy] of w.values()) { if (world.dead || world.cols.get(c.key) !== c) continue; const sc = c.sec[sy]; if (sc) { sc.dirty = true; sc.ver++; } }
  };
  // a model's design changed (custom.js): its entries are not ready any more and its next mesh is a new version
  SV.invalidate = function (name) {
    if (SV.cache) for (const k of [...SV.cache.map.keys()]) if (k.startsWith(name + '#') || k.startsWith(name + ':off#')) { SV.cache.bytes -= SV.cache.map.get(k).b; SV.cache.map.delete(k); }
    if (!AT) return;
    MAIN.ver[name] = (MAIN.ver[name] | 0) + 1;
    let any = false;
    for (let i = 0; i < AT.n; i++) if (AT.list[i].name === name) { MAIN.asked.delete(i); if (SV.ready.bits && isReady(SV.ready.bits, i)) { SV.ready.bits[i >> 3] &= ~(1 << (i & 7)); any = true; } }
    if (any) { SV.ready.ver++; const g = typeof window !== 'undefined' && VR.game; if (g && g.renderer) g.renderer.furnByKind = null; }   // (the renderer's slot of the old version is looked up again)
  };
  if (VR.Custom && VR.Custom.refreshModel && !VR.Custom.refreshModel.sv) {
    const rf = VR.Custom.refreshModel;
    VR.Custom.refreshModel = function (m) { const r = rf.apply(this, arguments); try { if (m && m.name) SV.invalidate(m.name); } catch (e) { /* never in the way of a design */ } return r; };
    VR.Custom.refreshModel.sv = true;
  }
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
