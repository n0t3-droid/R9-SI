// ============================================================================
// q-art4 · Runde Inseln — a floating isle seen from afar as one rounded rocky form (plan
// docs/superpowers/plans/2026-11-07-q-art4.md). The far land drew an isle cell by cell (lod.js: a slab per 4–64-block
// cell; far.js ring 1: a slab per 2–4-block cell) — stepped boxes that filled the upper third of every sky view. Here an
// isle is a shell made from the generator's own pure island shape (gen_realm.js islandShape: outline, dome, inverted
// cone), in polar rows: the grassy dome, a moss lip that bulges a little over the rim, the soil wall, then the underside
// tapering softly to its tip in bands of the isle's strata, moss and tuff at the tip, and (detail 2) hanging vines at the
// rim and roots under it as thin double-sided cards. Its faces carry face 7 (the lit normal from the geometry, LOD_FS
// under Q_ISLEFORM); the shade byte bakes the rim's light and the tip's darkness.
// Render only and opt-in (the job's isleForm, src/main/qart4.js): generation, the chunks' blocks and the old per-cell
// slabs (lod_same, far_forms) stay exactly as they are. The same isle and detail always gives the same mesh (a tile
// draws every isle whose centre lies in it — one draw per isle, whatever tile its rim reaches).
// Pure (main thread, workers, node: test/qart4.js).
// ============================================================================
(function (VR) {
  'use strict';
  const M = VR.M;
  const IS = VR.IsleShell = {};
  const TAU = Math.PI * 2;
  // the rows per detail: top rings (fractions of the outline, centre first), underside rings (rim → tip); seg = segments
  // round the rim (detail 2: by the isle's size); vines: cards at the rim and under it
  IS.DET = [
    { seg: 7, top: [], und: [0.78, 0.4], vines: false },
    { seg: 11, top: [0.6], und: [0.86, 0.62, 0.34], vines: false },
    { seg: 0, top: [0.42, 0.76], und: [0.93, 0.82, 0.68, 0.52, 0.36, 0.2], vines: true },
  ];
  IS.segs = (I, det) => (det >= 2 ? Math.max(14, Math.min(30, Math.round(I.r * 0.85))) : IS.DET[Math.max(0, det)].seg);
  // the detail a horizon tile of level L draws its isles with (ring 1 and the near levels: 2)
  IS.detFor = (L) => (L <= 1 ? 2 : L <= 2 ? 1 : 0);
  const hf = (a, b, s) => (M.hash2(a | 0, b | 0, s) >>> 0) / 4294967296;
  const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const mulc = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

  // the outline's radius along angle th (the last distance islandShape still answers; the warp is a noise of the point)
  IS.outline = function (g, I, th) {
    const cx = Math.cos(th), sz = Math.sin(th), max = I.r * 1.35 + 1;
    let lo = 0, hi = max;
    for (let d = 1; d <= max; d += 1) { if (!g.islandShape(I, I.x + cx * d, I.z + sz * d)) { hi = d; break; } lo = d; }
    for (let k = 0; k < 4; k++) { const m = (lo + hi) / 2; if (g.islandShape(I, I.x + cx * m, I.z + sz * m)) lo = m; else hi = m; }
    return Math.max(1, lo + 0.5);   // (to the outer edge of the last block)
  };
  // the smooth top (block top face) and bottom (block bottom face) at (x, z) with t = 1 − d / R: islandShape's formula
  // without the rounding, the bottom's per-column jag averaged over ±1.5 blocks (its lumps, not its one-block spikes)
  IS.top = (g, I, x, z, t) => I.y + Math.min(1, t * 2.4) * I.dome + g.nVein.n2(x * 0.5, z * 0.5) * 1.2 + 1;
  IS.jag = function (g, I, x, z) {
    let s = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) s += 0.5 + 0.5 * Math.abs(g.nIsleH.n2((x + i * 1.5) * 7 + I.seed, (z + j * 1.5) * 7));
    return s / 9;
  };
  IS.bottom = (g, I, x, z, t) => I.y - 2 - Math.pow(Math.min(t, 0.97), 0.75) * I.r * I.deep * IS.jag(g, I, x, z);

  // the isle's colours: top (grass in its biome, snow, red sand), the strata bands, the moss, the soil
  IS.palette = function (g, I) {
    const LOD = VR.LOD, P = LOD.palette(), U = LOD.util;
    const cl = g.climateAt ? g.climateAt(I.x, I.z) : g.computeClimate(I.x, I.z);
    const B = VR.BIOMES[g.biomeFor(cl, 90)] || VR.BIOMES[0];
    const ember = cl.ember > 0.45 && !I.designed, prism = cl.prism > 0.45 && !I.designed, cold = cl.t < -0.35;
    const top = ember ? P.redsand : cold ? P.snow : U.tint(P.grassTop, B.grass);
    let bands;
    if (prism) bands = [P.duskrock, mulc(P.duskrock, 1.15), P.duskrock];
    else if (ember) bands = [P.ochre, P.ochre, P.umber];
    else if ((g.vgen | 0) >= 9) bands = [P.ochre, P.umber, P.terr, P.ochre, mixc(P.terr, P.umber, 0.5), P.umber, mixc(P.terr, [150, 60, 40], 0.4)].map(c => mixc(c, P.stone, 0.22));
    else bands = [P.stone, mulc(P.stone, 0.86), mixc(P.stone, P.dirt, 0.2)];
    const moss = cold ? mixc(P.snow, [80, 100, 70], 0.4) : ember ? mixc(P.umber, [90, 110, 50], 0.35) : [74, 104, 48];
    return { top, bands, moss, dirt: P.dirt, tuff: [76, 74, 70], vine: cold ? [70, 92, 72] : [52, 88, 34], root: [92, 70, 50] };
  };

  // the mesh of isle I at detail det, in world coordinates: { pos: Float32Array (x, y, z), col: Uint8Array (r, g, b, shade),
  // kind: Uint8Array, idx: Uint16Array, nv, ni }. Cached per worker (an isle's mesh serves every tile and level that asks)
  const CACHE = new Map();
  IS.clearCache = () => CACHE.clear();
  IS.mesh = function (g, I, det) {
    const key = (g.seed | 0) + ':' + (g.vgen | 0) + ':' + I.x.toFixed(2) + ':' + I.z.toFixed(2) + ':' + I.r.toFixed(2) + ':' + det;
    let m = CACHE.get(key); if (m) return m;
    if (CACHE.size > 900) CACHE.clear();
    m = IS.build(g, I, det, IS.palette(g, I));
    CACHE.set(key, m);
    return m;
  };
  IS.build = function (g, I, det, pal) {
    g.islandShape(I, I.x, I.z);   // (makes the realm noise: nVein, nIsleH)
    const D = IS.DET[Math.max(0, Math.min(2, det))], seg = IS.segs(I, det);
    const pos = [], col = [], kind = [], idx = [];
    const vert = (x, y, z, c, sh, kd) => { pos.push(x, y, z); col.push(Math.round(c[0]), Math.round(c[1]), Math.round(c[2]), sh); kind.push(kd | 0); return pos.length / 3 - 1; };
    const R = new Float32Array(seg), CS = new Float32Array(seg), SN = new Float32Array(seg);
    for (let s = 0; s < seg; s++) { const th = (s + 0.5) / seg * TAU + (I.seed % 7) * 0.13; CS[s] = Math.cos(th); SN[s] = Math.sin(th); R[s] = IS.outline(g, I, th); }
    const at = (s, f) => [I.x + CS[s] * R[s] * f, I.z + SN[s] * R[s] * f];
    const sd = I.seed | 0, nb = pal.bands.length;
    // rows: each an array of seg vertex indices (a centre is one vertex repeated)
    const rows = [];
    const ring = (fn) => { const r = new Array(seg); for (let s = 0; s < seg; s++) r[s] = fn(s); rows.push(r); return r; };
    // the top: the dome's centre, its rings, the rim
    { const yc = IS.top(g, I, I.x, I.z, 1); const c = vert(I.x, yc, I.z, mixc(pal.top, [255, 255, 230], 0.04), 255, 0); rows.push(new Array(seg).fill(c)); }
    for (const f of D.top) ring((s) => { const p = at(s, f); return vert(p[0], IS.top(g, I, p[0], p[1], 1 - f), p[1], pal.top, 255, 0); });
    const rimY = new Float32Array(seg);
    ring((s) => { const p = at(s, 1); rimY[s] = IS.top(g, I, p[0], p[1], 0); return vert(p[0], rimY[s], p[1], mixc(pal.top, pal.moss, 0.35), 244, 0); });
    // the moss lip: a little out over the rim and down
    const lip = ring((s) => { const p = at(s, 1.03); return vert(p[0], rimY[s] - 1.25, p[1], pal.moss, 222, 0); });
    // the soil wall down to the underside's start (islandShape's bottom at the rim: y − 2)
    ring((s) => { const p = at(s, 0.99); return vert(p[0], Math.min(rimY[s] - 2.2, I.y - 1.6), p[1], mixc(pal.dirt, pal.bands[sd % nb], 0.45), 205, 0); });
    // the underside: bands of strata, moss and tuff at the tip; the shade falls toward the tip (its own shadow)
    const U = D.und, last = U.length - 1;
    // (browser run 2: a calm world's isles — vgen 16 — and the designed gardens are green from below: the bottom two blocks
    //  of every column are moss in big patches, the strata show on the steps between columns — gen_realm.js calmCell)
    const GN = VR.GEN, calm = !!(GN && ((GN.isleCalm && GN.isleCalm(g)) || (I.designed && GN.isleGarden && GN.isleGarden(g))));
    U.forEach((f, k) => ring((s) => {
      const p = at(s, f), t = 1 - f, y = IS.bottom(g, I, p[0], p[1], t);
      let c = pal.bands[(k + sd) % nb];
      if (calm) { const m = g.nVein.n2(p[0] * 0.09 + sd * 0.37, p[1] * 0.09 - sd * 0.21); c = mixc(c, pal.moss, m > -0.12 ? 0.72 : 0.22); }
      if (k >= last - (det >= 2 ? 1 : 0)) c = hf(s, k, sd + 5) < 0.55 ? pal.moss : mixc(pal.tuff, pal.moss, 0.3);
      return vert(p[0], y, p[1], c, Math.round(200 - 38 * (k / Math.max(1, last))), 0);
    }));
    { const y = IS.bottom(g, I, I.x, I.z, 1); const c = vert(I.x, y, I.z, mixc(pal.tuff, pal.moss, 0.5), 158, 0); rows.push(new Array(seg).fill(c)); }
    // the faces between consecutive rows (counter-clockwise seen from outside: the rows run from the top's centre out and
    // down to the tip, the segments with the angle)
    for (let r = 0; r + 1 < rows.length; r++) {
      const A = rows[r], B = rows[r + 1];
      for (let s = 0; s < seg; s++) {
        const s1 = (s + 1) % seg, a0 = A[s], a1 = A[s1], b0 = B[s], b1 = B[s1];
        if (a0 !== a1) idx.push(a0, a1, b1);
        if (b0 !== b1) idx.push(a0, b1, b0);
      }
    }
    // hanging vines from the lip and roots under the underside: thin tapered cards, both sides
    if (D.vines) {
      const card = (x, y, z, ux, uz, w, len, c, kd) => {
        const a = vert(x - ux * w, y, z - uz * w, c, 200, kd), b = vert(x + ux * w, y, z + uz * w, c, 200, kd);
        const tip = vert(x + (hf(x * 8, z * 8, 3) - 0.5) * 0.6, y - len, z + (hf(z * 8, x * 8, 4) - 0.5) * 0.6, mulc(c, 0.8), 170, kd);
        idx.push(a, b, tip, a, tip, b);
      };
      const calm = !!(VR.GEN && VR.GEN.isleCalm && VR.GEN.isleCalm(g));
      for (let s = 0; s < seg; s++) {
        const h = hf(s, sd, 11); if (h > (calm ? 0.4 : 0.55)) continue;
        const L = lip[s], x = pos[L * 3] + CS[s] * 0.15, y = pos[L * 3 + 1] + 0.2, z = pos[L * 3 + 2] + SN[s] * 0.15;
        const len = 1.6 + hf(s, sd, 12) * Math.min(7, 1 + (I.y - IS.bottom(g, I, I.x, I.z, 1)) * 0.25);
        card(x, y, z, -SN[s], CS[s], 0.42, len, pal.vine, 5);
      }
      const k = Math.max(1, Math.floor(U.length / 2));
      for (let s = 0; s < seg; s += 2) {
        if (hf(s, sd, 13) > 0.5) continue;
        const p = at(s, U[k]), t = 1 - U[k], y = IS.bottom(g, I, p[0], p[1], t);
        card(p[0], y + 0.3, p[1], -SN[s], CS[s], 0.3, 1.5 + hf(s, sd, 14) * 3.5, pal.root, 0);
      }
    }
    return { pos: Float32Array.from(pos), col: Uint8Array.from(col), kind: Uint8Array.from(kind), idx: Uint16Array.from(idx), nv: pos.length / 3, ni: idx.length };
  };
  // the mesh into a builder with vert(x, y, z, face, kind, aux, c, shade) → index and tri(a, b, c) (far.js Builder, lod.js's
  // adapter), positions relative to (ox, oz); every face is face 7 (the normal from the geometry)
  IS.emit = function (m, B, ox, oz) {
    const base = new Array(m.nv), c = [0, 0, 0];
    for (let v = 0; v < m.nv; v++) { c[0] = m.col[v * 4]; c[1] = m.col[v * 4 + 1]; c[2] = m.col[v * 4 + 2]; base[v] = B.vert(m.pos[v * 3] - ox, m.pos[v * 3 + 1], m.pos[v * 3 + 2] - oz, 7, m.kind[v], 0, c, m.col[v * 4 + 3]); }
    for (let i = 0; i < m.ni; i += 3) B.tri(base[m.idx[i]], base[m.idx[i + 1]], base[m.idx[i + 2]]);
  };
  // the near isles' columns for the mesher (Runde Inseln near the eye, mesher.js bit 16): per padded column of the section
  // grid at (ox, oz) the isle's bottom and top (world y; none: 32767, −32768) — cached per chunk column
  const COLS = new Map();
  IS.columns = function (g, ox, oz) {
    const key = (g.seed | 0) + ':' + ox + ':' + oz;
    let a = COLS.get(key); if (a) return a;
    if (COLS.size > 256) COLS.clear();
    const PAD = VR.MESH_PAD, PS = VR.MESH_PS;
    a = new Int16Array(PS * PS * 2);
    for (let z = 0; z < PS; z++) for (let x = 0; x < PS; x++) {
      const c = z * PS + x, sh = g.islandAt(ox + x - PAD, oz + z - PAD);
      a[c * 2] = sh ? sh.bottom : 32767; a[c * 2 + 1] = sh ? sh.top : -32768;
    }
    COLS.set(key, a);
    return a;
  };
  // the isles whose centre lies in [x0, x1) × [z0, z1): the realm's island lattice (72-block cells) and the designed ones
  IS.anchored = function (g, x0, z0, x1, z1) {
    const out = [];
    if (!g.islandCell || !g.islandShape || !g.islandAt || g.singleBiome >= 0) return out;
    g.islandAt(x0, z0);   // (its realm noise made first: islandCell reads it)
    const IC = 72, inT = (I) => I.x >= x0 && I.x < x1 && I.z >= z0 && I.z < z1;
    for (let cj = Math.floor(z0 / IC); cj <= Math.floor((z1 - 1e-6) / IC); cj++) for (let ci = Math.floor(x0 / IC); ci <= Math.floor((x1 - 1e-6) / IC); ci++) { const I = g.islandCell(ci, cj); if (I && inT(I)) out.push(I); }
    const H = VR.Heart && VR.Heart.ISLES;
    if (g.designedIslands && H) {
      const D = g.designedIslands(Math.max(x0, Math.min(x1 - 1, H.x)), Math.max(z0, Math.min(z1 - 1, H.z)));
      if (D) for (const I of D) if (inT(I)) out.push(I);
    }
    return out;
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
