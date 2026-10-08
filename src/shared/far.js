// ============================================================================
// F-Far · die echte Ferne: three rings of land around the camera, the pure parts (main thread, workers, node tests).
//   ring 0  the chunks, full detail (renderDist; as before)
//   ring 1  the forms: coarse meshes of 4 x 4 chunk columns out to ~1 km (64 chunks) — a smooth height field from the
//           generator's cheap pass with the horizon's colours, water as a plane, trees as crowns, buildings and the
//           Heartland's set pieces as slabs and spires (VR.Far.form, built in the workers)
//   ring 2  the horizon tiles beyond (horizon.js, lod.js; as before)
// The bookkeeping (RingSet) says which ring-1 tiles are wanted, kept and freed as the camera moves; the far mask decides
// per pixel which ring draws (draws(): every pixel by one ring at least, a settled column by exactly one).
// ============================================================================
(function (VR) {
  'use strict';
  const F = VR.Far = {};
  F.TILE = 4;               // chunk columns per tile side (a tile is 64 x 64 blocks)
  F.R1 = 64;                // ring 1's outer radius in chunks (the High and Ultra presets)
  F.NEAR = 32;              // tiles within this many chunks get 2-block cells, beyond 4-block cells
  F.IN = 2; F.IN_KEEP = 4;  // a tile is wanted from rd − 2 (its chunks may leave ring 0 any moment), kept to rd − 4
  F.OUT_KEEP = 2;           // … and kept to r1 + 2.5 (hysteresis at the outer edge)
  const MB = 1048576;
  const CAP = [0, 56, 84, 128, 192];   // the horizon's byte cap per level (horizon.js): ring 1 and ring 2 share it
  F.capBytes = (level) => (CAP[Math.max(0, Math.min(4, level | 0))] || 0) * MB;
  // room for one more form of about est bytes: ring 1 and ring 2 together stay under 92 % of the cap (the eviction margin)
  F.canAsk = (ring1Bytes, ring2Bytes, est, cap) => ring1Bytes + ring2Bytes + (est || 0) <= cap * 0.92;

  // ---- which ring a column is in: d = its distance in chunks (column centre to the camera's column)
  F.ringOf = function (d, rd, r1) { if (d <= rd + 0.5) return 0; if (r1 > 0 && d <= r1 + 0.5) return 1; return 2; };
  // the nearest and farthest column centre of tile (tx, tz) from the camera's column (ccx, ccz), in chunks
  const TD = new Float64Array(2);
  F.tileDistInto = function (tx, tz, ccx, ccz, out) {
    const T = F.TILE, x0 = tx * T, z0 = tz * T;
    const ax = ccx < x0 ? x0 - ccx : ccx > x0 + T - 1 ? ccx - (x0 + T - 1) : 0;
    const az = ccz < z0 ? z0 - ccz : ccz > z0 + T - 1 ? ccz - (z0 + T - 1) : 0;
    const bx = Math.max(Math.abs(ccx - x0), Math.abs(ccx - (x0 + T - 1))), bz = Math.max(Math.abs(ccz - z0), Math.abs(ccz - (z0 + T - 1)));
    out[0] = Math.sqrt(ax * ax + az * az); out[1] = Math.sqrt(bx * bx + bz * bz);
    return out;
  };
  F.tileDist = (tx, tz, ccx, ccz) => Array.from(F.tileDistInto(tx, tz, ccx, ccz, TD));
  F.cellFor = (dmin) => (dmin <= F.NEAR ? 2 : 4);
  // tile keys: exact integers for |tx|, |tz| < 2^20
  F.key = (tx, tz) => (tx + 1048576) * 2097152 + (tz + 1048576);
  F.unkey = (k) => [Math.floor(k / 2097152) - 1048576, (k % 2097152) - 1048576];
  const wantOf = (dmin, dmax, rd, r1) => r1 > 0 && dmax >= rd - F.IN && dmin <= r1 + 0.5;
  const keepOf = (dmin, dmax, rd, r1) => r1 > 0 && dmax >= rd - F.IN_KEEP && dmin <= r1 + 0.5 + F.OUT_KEEP;
  // how many tiles the band holds around a camera column (the same rule as RingSet)
  F.bandTiles = function (rd, r1) {
    if (!(r1 > 0)) return 0;
    const R = Math.ceil((r1 + 1) / F.TILE) + 1;
    let n = 0;
    for (let tz = -R; tz <= R; tz++) for (let tx = -R; tx <= R; tx++) { F.tileDistInto(tx, tz, 0, 0, TD); if (wantOf(TD[0], TD[1], rd, r1)) n++; }
    return n;
  };

  // ---- the far mask's rule (shaders.js FORM / FAR1 carry the same arithmetic). t: the pixel's 4x4 dither threshold;
  // nR, bR: the chunk fade of the pixel's column (nearest texel) and its bilinear read; nG, bG: the same for the form.
  //   ring 0 draws iff t < nR (the chunk's own fade-in, F8)
  //   ring 1 draws iff t ≥ min(bR, nR) and t < nG (cut where the chunk is, dithered in by its own fade)
  //   ring 2 draws iff t ≥ max(min(bR, nR), min(bG, nG))
  F.bayerLevels = Array.from({ length: 16 }, (_, k) => k / 16);
  F.draws = function (t, nR, bR, nG, bG) {
    const cR = Math.min(bR, nR), cG = Math.min(bG, nG);
    return { r0: t < nR, r1: t >= cR && t < nG, r2: t >= Math.max(cR, cG) };
  };

  // ---- the ring-1 tiles around the camera. update() rescans the band only when the camera's column, rd or r1 change
  // (into arrays kept from scan to scan: no allocation while the camera stays in its column). After a scan:
  //   requestOrder()  keys of wanted tiles that do not exist yet or want another cell size, nearest first
  //   freeList()      existing tiles no longer kept (out to ring 2, or wholly inside ring 0)
  // add(tx, tz, cell) makes a tile record (state 0 = asked), ready(t, bytes) books its bytes, free(t) drops it.
  class RingSet {
    constructor() {
      this.tiles = new Map();
      this.bytes = 0;
      this.ccx = NaN; this.ccz = NaN; this.rd = -1; this.r1 = -1;
      this.scanCount = 0;
      this._req = []; this._free = []; this._wanted = [];
      this._sort = new Float64Array(64); this._keys = new Float64Array(64);
      this.stamp = 0;
    }
    update(ccx, ccz, rd, r1) {
      if (ccx === this.ccx && ccz === this.ccz && rd === this.rd && r1 === this.r1) return false;
      this.ccx = ccx; this.ccz = ccz; this.rd = rd; this.r1 = r1;
      this.scanCount++;
      const st = ++this.stamp, req = this._req, fr = this._free, wa = this._wanted;
      req.length = 0; fr.length = 0; wa.length = 0;
      let nq = 0;
      if (r1 > 0) {
        const T = F.TILE, R = Math.ceil((r1 + 1 + F.OUT_KEEP) / T) + 1;
        const tcx = Math.floor(ccx / T), tcz = Math.floor(ccz / T);
        const need = (2 * R + 1) * (2 * R + 1);
        if (this._sort.length < need) { this._sort = new Float64Array(need); this._keys = new Float64Array(need); }
        const so = this._sort, ks = this._keys;
        for (let tz = tcz - R; tz <= tcz + R; tz++) for (let tx = tcx - R; tx <= tcx + R; tx++) {
          F.tileDistInto(tx, tz, ccx, ccz, TD);
          const dmin = TD[0], dmax = TD[1], k = F.key(tx, tz), t = this.tiles.get(k);
          const want = wantOf(dmin, dmax, rd, r1);
          if (want) wa.push(k);
          if (t) {
            t.seen = st;
            t.want = want;
            if (!keepOf(dmin, dmax, rd, r1)) { fr.push(t); continue; }
            // a tile whose cell size no longer fits (it came closer or went farther) is asked again: the old mesh draws
            // until the new one is up (3 chunks of hysteresis around the switch)
            if (want && t.state !== 0 && t.cell !== F.cellFor(dmin) && Math.abs(dmin - F.NEAR) > 3 && !t.redo) { so[nq] = Math.floor(dmin * 1024) * 65536 + nq; ks[nq] = k; nq++; }
          } else if (want) { so[nq] = Math.floor(dmin * 1024) * 65536 + nq; ks[nq] = k; nq++; }
        }
        // nearest first: the distance (1/1024 chunk) is the high part of the sort value, the slot the low 16 bits (a numeric
        // sort in place: no comparator, no allocation)
        const view = so.subarray(0, nq); view.sort();
        for (let i = 0; i < nq; i++) req.push(ks[view[i] % 65536]);
      }
      // tiles out of the scanned square
      for (const t of this.tiles.values()) if (t.seen !== st) fr.push(t);
      return true;
    }
    wantedKeys() { return this._wanted; }
    requestOrder() { return this._req; }
    freeList() { return this._free; }
    get(tx, tz) { return this.tiles.get(F.key(tx, tz)); }
    add(tx, tz, cell) {
      const k = F.key(tx, tz);
      let t = this.tiles.get(k);
      if (t) { t.redo = cell; return t; }     // a new cell size for a tile that stays: the old mesh draws meanwhile
      t = { key: k, tx, tz, cell, state: 0, bytes: 0, seen: this.stamp, want: true, redo: 0, fade: 0, shownAt: -1, gpu: null, job: 0 };
      this.tiles.set(k, t);
      return t;
    }
    ready(t, bytes) {
      if (this.tiles.get(t.key) !== t) return false;
      this.bytes += (bytes || 0) - (t.bytes || 0);
      t.bytes = bytes || 0; t.state = 1;
      if (t.redo) { t.cell = t.redo; t.redo = 0; }
      return true;
    }
    free(t) {
      if (this.tiles.get(t.key) !== t) return false;
      this.tiles.delete(t.key);
      this.bytes -= t.bytes || 0; t.bytes = 0; t.state = 3;
      return true;
    }
    // over the budget: the farthest ready tiles go first, until the bytes fit (returns the evicted tiles; the caller
    // frees their GPU buffers)
    evictOver(budget) {
      const out = [];
      if (this.bytes <= budget) return out;
      const list = [];
      for (const t of this.tiles.values()) if (t.state === 1) { F.tileDistInto(t.tx, t.tz, this.ccx, this.ccz, TD); list.push([TD[0], t]); }
      list.sort((a, b) => b[0] - a[0]);
      for (const [, t] of list) { if (this.bytes <= budget) break; this.free(t); out.push(t); }
      return out;
    }
    clear() { this.tiles.clear(); this.bytes = 0; this.ccx = NaN; this.ccz = NaN; this.rd = -1; this.r1 = -1; this._req.length = 0; this._free.length = 0; this._wanted.length = 0; }
  }
  F.RingSet = RingSet;

  // ================================================================ ring 1's mesher (the workers build the forms)
  // vertex, 12 bytes (the horizon tiles' layout, so the LOD program draws both): int16 x, y, z in 1/8 block relative to
  // the tile's corner · u8 face | kind << 3 · u8 aux · u8 r, g, b, shade. face 0..5 = the box faces (+x −x +y −y +z −z),
  // 6 = the height field (the shader takes its normal from the geometry). kinds as lod.js: 0 land 1 water 2 lava
  // 3 aether 4 glow 5 leaves 6 snow / ice 7 window.
  class Builder {
    constructor() {
      this.vcap = 4096; this.vbuf = new ArrayBuffer(this.vcap * 12); this.i16 = new Int16Array(this.vbuf); this.u8 = new Uint8Array(this.vbuf); this.nv = 0;
      this.icap = 8192; this.I = new Uint32Array(this.icap); this.ni = 0;
      this.minY = 1e9; this.maxY = -1e9; this.bx0 = 0; this.bz0 = 0; this.bx1 = 64; this.bz1 = 64;
      this.parts = { field: 0, water: 0, skirt: 0, slab: 0, tree: 0, box: 0 }; this.part = 'field';
    }
    vert(x, y, z, face, kind, aux, c, shade) {
      if (this.nv === this.vcap) { this.vcap *= 2; const nb = new ArrayBuffer(this.vcap * 12); new Uint8Array(nb).set(this.u8); this.vbuf = nb; this.i16 = new Int16Array(nb); this.u8 = new Uint8Array(nb); }
      const o6 = this.nv * 6, o12 = this.nv * 12, u8 = this.u8;
      this.i16[o6] = Math.round(x * 8); this.i16[o6 + 1] = Math.round(y * 8); this.i16[o6 + 2] = Math.round(z * 8);
      u8[o12 + 6] = face | (kind << 3); u8[o12 + 7] = aux;
      const r = c[0], g = c[1], b = c[2];
      u8[o12 + 8] = r < 0 ? 0 : r > 255 ? 255 : r; u8[o12 + 9] = g < 0 ? 0 : g > 255 ? 255 : g; u8[o12 + 10] = b < 0 ? 0 : b > 255 ? 255 : b; u8[o12 + 11] = shade;
      if (y < this.minY) this.minY = y; if (y > this.maxY) this.maxY = y;
      if (x < this.bx0) this.bx0 = x; if (x > this.bx1) this.bx1 = x; if (z < this.bz0) this.bz0 = z; if (z > this.bz1) this.bz1 = z;
      return this.nv++;
    }
    tri(a, b, c) {
      if (this.ni + 3 > this.icap) { this.icap *= 2; const n2 = new Uint32Array(this.icap); n2.set(this.I); this.I = n2; }
      this.I[this.ni++] = a; this.I[this.ni++] = b; this.I[this.ni++] = c;
      this.parts[this.part]++;
    }
    // four corners in counter-clockwise order seen from the front: triangles (0 1 2) (0 2 3)
    quad(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, face, kind, aux, c, shade) {
      const v = this.vert(ax, ay, az, face, kind, aux, c, shade);
      this.vert(bx, by, bz, face, kind, aux, c, shade); this.vert(cx, cy, cz, face, kind, aux, c, shade); this.vert(dx, dy, dz, face, kind, aux, c, shade);
      this.tri(v, v + 1, v + 2); this.tri(v, v + 2, v + 3);
    }
    // a box: faces bit 1 = top, 2 = bottom; the four sides always (as lod.js)
    box(x0, y0, z0, x1, y1, z1, ct, cs, kind, faces) {
      if (faces & 1) this.quad(x0, y1, z0, x0, y1, z1, x1, y1, z1, x1, y1, z0, 2, kind, 0, ct, 255);
      if (faces & 2) this.quad(x0, y0, z0, x1, y0, z0, x1, y0, z1, x0, y0, z1, 3, kind, 0, cs, 150);
      this.quad(x1, y1, z1, x1, y0, z1, x1, y0, z0, x1, y1, z0, 0, kind, 0, cs, 200);
      this.quad(x0, y1, z0, x0, y0, z0, x0, y0, z1, x0, y1, z1, 1, kind, 0, cs, 200);
      this.quad(x0, y1, z1, x0, y0, z1, x1, y0, z1, x1, y1, z1, 4, kind, 0, cs, 225);
      this.quad(x1, y1, z0, x1, y0, z0, x0, y0, z0, x0, y1, z0, 5, kind, 0, cs, 225);
    }
    finish() {
      if (!this.nv) return { empty: true, count: 0, minY: 0, maxY: 0, parts: this.parts };
      const verts = this.vbuf.slice(0, this.nv * 12);
      const big = this.nv > 65535;
      const idx = big ? this.I.slice(0, this.ni) : Uint16Array.from(this.I.subarray(0, this.ni));
      return { verts, idx, count: this.ni, big, minY: this.minY, maxY: this.maxY, bx0: this.bx0, bz0: this.bz0, bx1: this.bx1, bz1: this.bz1, parts: this.parts };
    }
  }
  F.Builder = Builder;

  // ---- the height field: (n + 3)² vertices (one ring beyond the tile for slopes and shading), index (i + 1, j + 1)
  // h: the top face's height · col / cliff: the surface and the rock colour · kd: kind · wet: a water (lava, aether, ice)
  // surface over the vertex (wh, wkd, wax, wcol) or none
  F.newField = function (n, cell) {
    const W = n + 3, N = W * W;
    return { n, cell, W, h: new Float32Array(N), col: new Uint8Array(N * 3), cliff: new Uint8Array(N * 3), kd: new Uint8Array(N), wet: new Uint8Array(N), wh: new Float32Array(N), wkd: new Uint8Array(N), wax: new Uint8Array(N), wcol: new Uint8Array(N * 3) };
  };
  F.fieldFrom = function (n, cell, fn) {
    const f = F.newField(n, cell), W = f.W;
    for (let j = -1; j <= n + 1; j++) for (let i = -1; i <= n + 1; i++) {
      const k = (j + 1) * W + (i + 1), v = fn(i, j);
      f.h[k] = v.h; f.kd[k] = v.kd || 0;
      f.col[k * 3] = v.c[0]; f.col[k * 3 + 1] = v.c[1]; f.col[k * 3 + 2] = v.c[2];
      const cl = v.cliff || v.c; f.cliff[k * 3] = cl[0]; f.cliff[k * 3 + 1] = cl[1]; f.cliff[k * 3 + 2] = cl[2];
      if (v.wet) { f.wet[k] = 1; f.wh[k] = v.wet.h; f.wkd[k] = v.wet.kd; f.wax[k] = v.wet.ax || 0; f.wcol[k * 3] = v.wet.c[0]; f.wcol[k * 3 + 1] = v.wet.c[1]; f.wcol[k * 3 + 2] = v.wet.c[2]; }
    }
    return f;
  };
  const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const q8 = (v) => (Math.round(v / 8) * 8) | 0;
  // the field's mesh: flat runs merged into quads (face 2), the rest as triangles over shared vertices (face 6), the
  // water as merged planes, skirts hanging 12 blocks from the tile's border (no cracks toward coarser tiles or ring 2)
  const RGB = [0, 0, 0];   // (one colour handed to the builder at a time: no array per vertex)
  const rgbOf = (arr, k) => { RGB[0] = arr[k * 3]; RGB[1] = arr[k * 3 + 1]; RGB[2] = arr[k * 3 + 2]; return RGB; };
  F.meshField = function (B, f) {
    const n = f.n, cell = f.cell, W = f.W, H = f.h, col = f.col, cliff = f.cliff, wet = f.wet, kd = f.kd;
    // per vertex: the colour after the cliff blend (steep → rock), and a shade from the neighbours above (hollows darker)
    const vc = new Uint8Array(W * W * 3), sh = new Uint8Array(W * W), ck = new Int32Array(W * W);
    const rk = 1 / (8 * cell) * 0.6;
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
      const k = (j + 1) * W + i + 1, h = H[k];
      const e = H[k + 1] - h, w = H[k - 1] - h, s2 = H[k + W] - h, nn = H[k - W] - h;
      const slope = Math.max(e < 0 ? -e : e, w < 0 ? -w : w, s2 < 0 ? -s2 : s2, nn < 0 ? -nn : nn);
      let rise = (e > 0 ? e : 0) + (w > 0 ? w : 0) + (s2 > 0 ? s2 : 0) + (nn > 0 ? nn : 0);
      const d1 = H[k + W + 1] - h, d2 = H[k + W - 1] - h, d3 = H[k - W + 1] - h, d4 = H[k - W - 1] - h;
      rise += ((d1 > 0 ? d1 : 0) + (d2 > 0 ? d2 : 0) + (d3 > 0 ? d3 : 0) + (d4 > 0 ? d4 : 0)) * 0.7071;
      const x = slope / cell, t = x <= 0.9 ? 0 : x >= 2.2 ? 1 : (x - 0.9) / 1.3, kc = t * t * (3 - 2 * t);
      const k3 = k * 3;
      const r = (col[k3] + (cliff[k3] - col[k3]) * kc + 0.5) | 0, g = (col[k3 + 1] + (cliff[k3 + 1] - col[k3 + 1]) * kc + 0.5) | 0, b = (col[k3 + 2] + (cliff[k3 + 2] - col[k3 + 2]) * kc + 0.5) | 0;
      vc[k3] = r; vc[k3 + 1] = g; vc[k3 + 2] = b;
      const a = 1 - Math.min(0.45, rise * rk);
      sh[k] = (255 * (a < 0.55 ? 0.55 : a) + 0.5) | 0;
      ck[k] = ((((r + 4) >> 3) << 10) | (((g + 4) >> 3) << 5) | ((b + 4) >> 3)) * 2048 + kd[k] * 32 + (sh[k] >> 3);
    }
    // the cells: 0 = under water only, 1 = flat (one height, one colour), 2 = sloped
    const kindOf = new Uint8Array(n * n), flatKey = new Float64Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const a = (j + 1) * W + i + 1, b = a + 1, c = a + W + 1, d = a + W, ci = j * n + i;
      if (wet[a] && wet[b] && wet[c] && wet[d]) { kindOf[ci] = 0; continue; }
      const h = H[a], q = ck[a];
      if (H[b] === h && H[c] === h && H[d] === h && ck[b] === q && ck[c] === q && ck[d] === q) { kindOf[ci] = 1; flatKey[ci] = Math.round(h * 8) * 67108864 + q; continue; }
      kindOf[ci] = 2;
    }
    // flat cells: greedy rectangles of one key
    B.part = 'field';
    const done = new Uint8Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const ci = j * n + i; if (done[ci] || kindOf[ci] !== 1) continue;
      const key = flatKey[ci];
      let w = 1; while (i + w < n && !done[ci + w] && kindOf[ci + w] === 1 && flatKey[ci + w] === key) w++;
      let d = 1; grow: while (j + d < n) { for (let t = 0; t < w; t++) { const c2 = (j + d) * n + i + t; if (done[c2] || kindOf[c2] !== 1 || flatKey[c2] !== key) break grow; } d++; }
      for (let b = 0; b < d; b++) for (let a = 0; a < w; a++) done[(j + b) * n + i + a] = 1;
      const k = (j + 1) * W + i + 1, h = H[k], x = i * cell, z = j * cell;
      B.quad(x, h, z, x, h, z + d * cell, x + w * cell, h, z + d * cell, x + w * cell, h, z, 2, kd[k], 0, rgbOf(vc, k), sh[k]);
    }
    // sloped cells: two triangles over shared vertices, split along the flatter diagonal
    const vid = new Int32Array(W * W).fill(-1);
    const V = (i, j) => { const k = (j + 1) * W + i + 1; let v = vid[k]; if (v < 0) v = vid[k] = B.vert(i * cell, H[k], j * cell, 6, kd[k], 0, rgbOf(vc, k), sh[k]); return v; };
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      if (kindOf[j * n + i] !== 2) continue;
      const ka = (j + 1) * W + i + 1, ha = H[ka], hb = H[ka + 1], hc = H[ka + W + 1], hd = H[ka + W];
      const a = V(i, j), b = V(i + 1, j), c = V(i + 1, j + 1), d = V(i, j + 1);
      if (Math.abs(ha - hc) <= Math.abs(hb - hd)) { B.tri(a, d, c); B.tri(a, c, b); } else { B.tri(a, d, b); B.tri(b, d, c); }
    }
    // water: one plane per run of cells with the same surface (the lowest wet corner's). The depth (aux bits 0–5) only
    // matters to the shader's colour down to ~10 blocks and the floor's colour only in the shallows: both are rounded for
    // the merge, so a sea is a few big quads
    B.part = 'water';
    const wk = new Float64Array(n * n), wsrc = new Int32Array(n * n).fill(-1), wax = new Uint8Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const a = (j + 1) * W + i + 1;
      let best = -1;
      if (wet[a]) best = a;
      if (wet[a + 1] && (best < 0 || H[a + 1] < H[best])) best = a + 1;
      if (wet[a + W + 1] && (best < 0 || H[a + W + 1] < H[best])) best = a + W + 1;
      if (wet[a + W] && (best < 0 || H[a + W] < H[best])) best = a + W;
      if (best < 0) continue;
      const ci = j * n + i, ax0 = f.wax[best], depth = Math.min(10, ax0 & 63) & ~1, ax = (ax0 & 192) | depth;
      wsrc[ci] = best; wax[ci] = ax;
      const cq = depth >= 8 ? 0 : (q8(f.wcol[best * 3]) << 16) | (q8(f.wcol[best * 3 + 1]) << 8) | q8(f.wcol[best * 3 + 2]);
      wk[ci] = ((Math.round(f.wh[best] * 8) * 8 + f.wkd[best]) * 256 + ax) * 16777216 + cq;
    }
    done.fill(0);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const ci = j * n + i; if (done[ci] || wsrc[ci] < 0) continue;
      const key = wk[ci];
      let w = 1; while (i + w < n && !done[ci + w] && wsrc[ci + w] >= 0 && wk[ci + w] === key) w++;
      let d = 1; grow2: while (j + d < n) { for (let t = 0; t < w; t++) { const c2 = (j + d) * n + i + t; if (done[c2] || wsrc[c2] < 0 || wk[c2] !== key) break grow2; } d++; }
      for (let b = 0; b < d; b++) for (let a = 0; a < w; a++) done[(j + b) * n + i + a] = 1;
      const k = wsrc[ci], h = f.wh[k], x = i * cell, z = j * cell;
      B.quad(x, h, z, x, h, z + d * cell, x + w * cell, h, z + d * cell, x + w * cell, h, z, 2, f.wkd[k], wax[ci], rgbOf(f.wcol, k), 255);
    }
    // skirts: outward walls along the four borders, 0.05 inside the tile (the far mask reads them as this tile's columns);
    // runs of equal height merge, segments under water are left out
    B.part = 'skirt';
    const T = n * cell, eps = 0.05, DROP = 12;
    // side: 0 west (−x, face 1), 1 east (+x, face 0), 2 north (−z, face 5), 3 south (+z, face 4)
    const kAt = (sd, t) => (sd === 0 ? (t + 1) * W + 1 : sd === 1 ? (t + 1) * W + n + 1 : sd === 2 ? W + t + 1 : (n + 1) * W + t + 1);
    const flush = (sd, a, b) => {
      if (a < 0 || b <= a) return;
      const ka = kAt(sd, a), kb = kAt(sd, b), ya = H[ka], yb = H[kb], bot = Math.min(ya, yb) - DROP, c = rgbOf(cliff, ka);
      if (sd === 0) B.quad(eps, ya, a * cell, eps, bot, a * cell, eps, bot, b * cell, eps, yb, b * cell, 1, 0, 0, c, 200);
      else if (sd === 1) B.quad(T - eps, yb, b * cell, T - eps, bot, b * cell, T - eps, bot, a * cell, T - eps, ya, a * cell, 0, 0, 0, c, 200);
      else if (sd === 2) B.quad(b * cell, yb, eps, b * cell, bot, eps, a * cell, bot, eps, a * cell, ya, eps, 5, 0, 0, c, 200);
      else B.quad(a * cell, ya, T - eps, a * cell, bot, T - eps, b * cell, bot, T - eps, b * cell, yb, T - eps, 4, 0, 0, c, 200);
    };
    for (let sd = 0; sd < 4; sd++) {
      let s0 = -1;
      for (let t = 0; t < n; t++) {
        const k0 = kAt(sd, t), k1 = kAt(sd, t + 1);
        if (wet[k0] && wet[k1]) { flush(sd, s0, t); s0 = -1; continue; }
        if (s0 < 0) { s0 = t; continue; }
        if (!(H[k0] === H[kAt(sd, s0)] && H[k1] === H[k0])) { flush(sd, s0, t); s0 = t; }
      }
      flush(sd, s0, n);
    }
  };

  // ---- slabs: per cell of a grid (n × n cells of `cell` blocks) a block of structure from bot to top (ground: the
  // terrain under it), roof = the top colour, wall = the side colour, kind of the sides (7 = windows, lit at night)
  F.slabGrid = function (n, cell) { const N = n * n; return { n, cell, on: new Uint8Array(N), ground: new Float32Array(N), bot: new Float32Array(N), top: new Float32Array(N), roof: new Uint8Array(N * 3), wall: new Uint8Array(N * 3), kind: new Uint8Array(N), any: 0 }; };
  F.setSlab = function (S, i, j, o) {
    const c = j * S.n + i; S.on[c] = 1; S.any = 1; S.ground[c] = o.ground; S.bot[c] = o.bot; S.top[c] = o.top; S.kind[c] = o.kind || 0;
    S.roof[c * 3] = o.roof[0]; S.roof[c * 3 + 1] = o.roof[1]; S.roof[c * 3 + 2] = o.roof[2]; S.wall[c * 3] = o.wall[0]; S.wall[c * 3 + 1] = o.wall[1]; S.wall[c * 3 + 2] = o.wall[2];
  };
  F.meshSlabs = function (B, S) {
    if (!S.any) return;
    const n = S.n, cell = S.cell, on = S.on, top = S.top, bot = S.bot, gr = S.ground, kind = S.kind;
    B.part = 'slab';
    const ckey = (arr, c) => (q8(arr[c * 3]) << 16) | (q8(arr[c * 3 + 1]) << 8) | q8(arr[c * 3 + 2]);
    // tops and floating bottoms: greedy rectangles of one height and colour (keys precomputed, −1 = none)
    const tk = new Float64Array(n * n).fill(-1), bk = new Float64Array(n * n).fill(-1);
    for (let c = 0; c < n * n; c++) {
      if (!on[c]) continue;
      const k4 = kind[c] === 4 ? 4 : 0;
      tk[c] = (Math.round(top[c] * 8) * 8 + k4) * 16777216 + ckey(S.roof, c);
      if (bot[c] > gr[c] + 1.5) bk[c] = Math.round(bot[c] * 8) * 16777216 + ckey(S.wall, c);
    }
    const done = new Uint8Array(n * n);
    const rects = (keys, emit) => {
      done.fill(0);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const ci = j * n + i, key = keys[ci]; if (done[ci] || key < 0) continue;
        let w = 1; while (i + w < n && !done[ci + w] && keys[ci + w] === key) w++;
        let d = 1; grow: while (j + d < n) { for (let t = 0; t < w; t++) { const c2 = (j + d) * n + i + t; if (done[c2] || keys[c2] !== key) break grow; } d++; }
        for (let b = 0; b < d; b++) for (let a = 0; a < w; a++) done[(j + b) * n + i + a] = 1;
        emit(ci, i * cell, j * cell, (i + w) * cell, (j + d) * cell);
      }
    };
    rects(tk, (c, x0, z0, x1, z1) => { const y = top[c]; B.quad(x0, y, z0, x0, y, z1, x1, y, z1, x1, y, z0, 2, kind[c] === 4 ? 4 : 0, 0, rgbOf(S.roof, c), 255); });
    rects(bk, (c, x0, z0, x1, z1) => { const y = bot[c]; B.quad(x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1, 3, 0, 0, rgbOf(S.wall, c), 150); });
    // sides: per face and line, the part of each cell's side its neighbour does not cover — an upper piece (above a lower
    // neighbour) and a lower piece (under a floating one) — merged with the same piece of the cell before along the line
    const emit = (f, ln, s0, s1, y0, y1, c) => {
      const k = kind[c], cc = rgbOf(S.wall, c), sh = f <= 1 ? 200 : 225;
      if (f === 0) { const x = (ln + 1) * cell; B.quad(x, y1, (s1 + 1) * cell, x, y0, (s1 + 1) * cell, x, y0, s0 * cell, x, y1, s0 * cell, 0, k, 0, cc, sh); }
      else if (f === 1) { const x = ln * cell; B.quad(x, y1, s0 * cell, x, y0, s0 * cell, x, y0, (s1 + 1) * cell, x, y1, (s1 + 1) * cell, 1, k, 0, cc, sh); }
      else if (f === 4) { const z = (ln + 1) * cell; B.quad(s0 * cell, y1, z, s0 * cell, y0, z, (s1 + 1) * cell, y0, z, (s1 + 1) * cell, y1, z, 4, k, 0, cc, sh); }
      else { const z = ln * cell; B.quad((s1 + 1) * cell, y1, z, (s1 + 1) * cell, y0, z, s0 * cell, y0, z, s0 * cell, y1, z, 5, k, 0, cc, sh); }
    };
    const FACES = [0, 1, 4, 5], DX = [1, -1, 0, 0], DZ = [0, 0, 1, -1];
    for (let fi = 0; fi < 4; fi++) {
      const f = FACES[fi], dx = DX[fi], dz = DZ[fi];
      for (let ln = 0; ln < n; ln++) {
        // two runs (upper, lower): start, end, y0, y1, the cell whose colour and kind they carry, its key
        let us = -1, ue = -1, uy0 = 0, uy1 = 0, uc = -1, uk = -1, ls = -1, le = -1, ly0 = 0, ly1 = 0, lc = -1, lk2 = -1;
        for (let al = 0; al <= n; al++) {
          let pu0 = 0, pu1 = 0, pl0 = 0, pl1 = 0, hasU = false, hasL = false, c = -1, key = -1;
          if (al < n) {
            const i = f <= 1 ? ln : al, j = f <= 1 ? al : ln;
            c = j * n + i;
            if (on[c]) {
              const tp = top[c], floating = bot[c] > gr[c] + 1.5, ni = i + dx, nj = j + dz, inside = ni >= 0 && nj >= 0 && ni < n && nj < n, nc = nj * n + ni;
              let b = bot[c];
              if (!floating && inside && !on[nc]) b = Math.min(b, gr[c]);
              key = kind[c] * 16777216 + ckey(S.wall, c);
              if (inside && on[nc]) {
                const nt = top[nc], nb = bot[nc];
                if (nt < tp) { pu0 = Math.max(b, nt); pu1 = tp; hasU = pu1 > pu0 + 0.01; }
                if (nb > b) { pl0 = b; pl1 = Math.min(tp, nb); hasL = pl1 > pl0 + 0.01; }
              } else { pu0 = b; pu1 = tp; hasU = pu1 > pu0 + 0.01; }
            }
          }
          if (hasU && us >= 0 && ue === al - 1 && uy0 === pu0 && uy1 === pu1 && uk === key) ue = al;
          else { if (us >= 0) emit(f, ln, us, ue, uy0, uy1, uc); us = -1; if (hasU) { us = ue = al; uy0 = pu0; uy1 = pu1; uc = c; uk = key; } }
          if (hasL && ls >= 0 && le === al - 1 && ly0 === pl0 && ly1 === pl1 && lk2 === key) le = al;
          else { if (ls >= 0) emit(f, ln, ls, le, ly0, ly1, lc); ls = -1; if (hasL) { ls = le = al; ly0 = pl0; ly1 = pl1; lc = c; lk2 = key; } }
        }
      }
    }
  };

  // ---- a tree as its crown (and on 2-block cells its trunk): the shapes of the near horizon tiles (lod.js, 4-block cells)
  F.meshTree = function (B, x, z, g0, kind, th, lc, tc, cell) {
    B.part = 'tree';
    const tw = 0.5;
    if (kind === 'spruce') {
      const w0 = 1.8;
      if (cell <= 2) B.box(x - tw, g0, z - tw, x + tw, g0 + 2, z + tw, tc, tc, 0, 0);
      B.box(x - w0, g0 + 2, z - w0, x + w0, g0 + th * 0.6, z + w0, lc, lc, 5, 1);
      B.box(x - w0 * 0.6, g0 + th * 0.6, z - w0 * 0.6, x + w0 * 0.6, g0 + th, z + w0 * 0.6, lc, lc, 5, 1);
    } else if (kind === 'acacia') {
      const w0 = 2.6;
      if (cell <= 2) B.box(x - tw, g0, z - tw, x + tw, g0 + th - 1.5, z + tw, tc, tc, 0, 0);
      B.box(x - w0, g0 + th - 1.5, z - w0, x + w0, g0 + th, z + w0, lc, lc, 5, 1);
    } else {
      const w0 = 2.1 * (kind === 'jungle' || kind === 'dark_oak' ? 1.25 : 1), trunkH = Math.max(1.5, th * 0.42);
      if (cell <= 2) B.box(x - tw, g0, z - tw, x + tw, g0 + trunkH, z + tw, tc, tc, 0, 0);
      B.box(x - w0, g0 + trunkH, z - w0, x + w0, g0 + th, z + w0, lc, lc, 5, 1);
    }
  };
  // (the trunk box above has faces 0: its sides only — the crown covers its top, the ground its bottom)

  // ---- structures seen from afar: a skyline per structure (a town's plan, the Heartland's set pieces), built once from
  // its block ops per world in a worker: per 2-block cell the highest and lowest block above the land, the top block's
  // colour, the commonest side colour and how much of it is window; and the paving at ground level
  const SKY_MAX = 40;
  function skyline(g, id, chunks) {
    const cache = g._farSky || (g._farSky = new Map());
    let sk = cache.get(id); if (sk) return sk;
    const LOD = VR.LOD;
    let cx0 = Infinity, cz0 = Infinity, cx1 = -Infinity, cz1 = -Infinity;
    for (const k of chunks.keys()) { const c = k.indexOf(','), a = +k.slice(0, c), b = +k.slice(c + 1); if (a < cx0) cx0 = a; if (a > cx1) cx1 = a; if (b < cz0) cz0 = b; if (b > cz1) cz1 = b; }
    if (!(cx1 >= cx0)) { sk = { id, X0: 0, Z0: 0, W: 0, D: 0 }; cache.set(id, sk); return sk; }
    const X0 = cx0 * 16, Z0 = cz0 * 16, W = (cx1 - cx0 + 1) * 8, D = (cz1 - cz0 + 1) * 8, N = W * D;
    const ground = new Int16Array(N).fill(-32768), top = new Int16Array(N).fill(-1), bot = new Int16Array(N).fill(32767);
    const topS = new Uint16Array(N), gS = new Uint16Array(N), gY = new Int16Array(N).fill(-32768);
    const m1 = new Uint16Array(N), n1 = new Uint16Array(N), m2 = new Uint16Array(N), n2 = new Uint16Array(N), win = new Uint16Array(N), tot = new Uint16Array(N);
    const groundAt = (c) => { let y = ground[c]; if (y === -32768) { const i = c % W, j = (c / W) | 0; y = ground[c] = g.surfaceY(X0 + i * 2 + 1, Z0 + j * 2 + 1); } return y; };
    const add = (x, y, z, s) => {
      const L = LOD.stateLook(s); if (!L) return;
      const i = (x - X0) >> 1, j = (z - Z0) >> 1; if (i < 0 || j < 0 || i >= W || j >= D) return;
      const c = j * W + i, gy = groundAt(c);
      if (y <= gy + 2) { if (y >= gy - 2 && y >= gY[c]) { gY[c] = y; gS[c] = s; } return; }
      if (y > top[c]) { top[c] = y; topS[c] = s; }
      if (y < bot[c]) bot[c] = y;
      if (tot[c] < 65535) tot[c]++;
      if (L.k === 7) { if (win[c] < 65535) win[c]++; return; }
      // the commonest side state: two counters (Misra–Gries)
      if (m1[c] === s) { if (n1[c] < 65535) n1[c]++; } else if (m2[c] === s) { if (n2[c] < 65535) n2[c]++; } else if (!n1[c]) { m1[c] = s; n1[c] = 1; } else if (!n2[c]) { m2[c] = s; n2[c] = 1; } else { n1[c]--; n2[c]--; }
    };
    for (const b of chunks.values()) {
      const f = b.f, o = b.o;
      if (f) for (let i = 0; i < f.length; i += 5) {
        const x = f[i], z = f[i + 1], y0 = f[i + 2], y1 = f[i + 3], s = f[i + 4];
        if (y1 - y0 > 6) { add(x, y1, z, s); add(x, Math.max(y0, y1 - 6), z, s); add(x, y0, z, s); } else for (let y = y0; y <= y1; y++) add(x, y, z, s);
      }
      if (o) for (let i = 0; i < o.length; i += 4) add(o[i], o[i + 1], o[i + 2], o[i + 3]);
    }
    sk = { id, X0, Z0, W, D, ground, top, bot, topS, gS, gY, side: m1, n1, m2, n2, win, tot };
    if (cache.size >= SKY_MAX) cache.delete(cache.keys().next().value);
    cache.set(id, sk);
    return sk;
  }
  F.skyline = skyline;
  // the structures whose skyline may reach into [x0, x1) × [z0, z1): the Heartland's set pieces by their boxes, the towns
  // by their sites (a cold site cell or a plan the worker has not built yet ends the job's run: worker_main.js waits)
  function structuresNear(g, x0, z0, x1, z1) {
    const out = [], HEART = VR.Heart;
    const hit = (B, pad) => B && !(x1 + pad <= B.x0 || x0 - pad > B.x1 || z1 + pad <= B.z0 || z0 - pad > B.z1);
    if (HEART && HEART.on(g)) {
      if (VR.TempleGen && hit(VR.TempleGen.box, 4)) out.push(['temple', () => VR.TempleGen.build(g).chunks]);
      if (VR.HillsGen && hit(VR.HillsGen.box, 4)) out.push(['hills', () => VR.HillsGen.build(g)]);
      if (VR.StationGen && hit(VR.StationGen.box, 4)) out.push(['station', () => VR.StationGen.build(g)]);
      if (VR.CanyonGen && hit(VR.CanyonGen.box, 24)) out.push(['canyon', () => VR.CanyonGen.build(g)]);
      if (VR.IslesGen && hit({ x0: HEART.ISLES.x - 240, x1: HEART.ISLES.x + 240, z0: HEART.ISLES.z - 240, z1: HEART.ISLES.z + 240 }, 0)) out.push(['isles', () => VR.IslesGen.build(g)]);
    }
    const VG = VR.VillageGen;
    if (VG && g.singleBiome < 0) {
      const C = VG.cell(g), pad = VG.rad(g) + 16;
      for (let j = Math.floor((z0 - pad - 240) / C); j <= Math.floor((z1 + pad + 240) / C); j++) for (let i = Math.floor((x0 - pad - 240) / C); i <= Math.floor((x1 + pad + 240) / C); i++) {
        const s = VG.site(g, i, j); if (!s) continue;
        const R = VG.siteRad ? VG.siteRad(g, s) : VG.rad(g);
        if (s.x + R + 16 < x0 || s.x - R - 16 > x1 || s.z + R + 16 < z0 || s.z - R - 16 > z1) continue;
        out.push(['v' + s.id, () => VG.plan(g, s, true).chunks, s]);
      }
    }
    return out;
  }
  F.structuresNear = structuresNear;
  // the site cells a form tile reads (the worker computes the cold ones first, a slice at a time)
  F.tileCells = function (g, job) {
    const VG = VR.VillageGen; if (!VG || g.singleBiome >= 0) return [];
    const x0 = job.tx * 64, z0 = job.tz * 64, x1 = x0 + 64, z1 = z0 + 64, C = VG.cell(g), pad = VG.rad(g) + 16, out = [];
    for (let j = Math.floor((z0 - pad - 240) / C); j <= Math.floor((z1 + pad + 240) / C); j++) for (let i = Math.floor((x0 - pad - 240) / C); i <= Math.floor((x1 + pad + 240) / C); i++) out.push([i, j]);
    return out;
  };

  // ---- one form tile: { tx, tz, cell } → the mesh (Builder.finish) and its parts' triangle counts
  const NB4 = [[0, 0], [1, 0], [0, 1], [1, 1]];
  // the floating islands that may reach into a tile: the realm's island cells around it and the designed ones
  function islesNear(g, x0, z0, x1, z1) {
    const out = [];
    if (!g.islandCell || !g.islandShape || g.singleBiome >= 0) return out;
    const IC = 72, reach = (I) => { const r = I.r * 1.35 + 2; return I.x + r > x0 && I.x - r < x1 && I.z + r > z0 && I.z - r < z1; };
    for (let cj = Math.floor(z0 / IC) - 1; cj <= Math.floor(z1 / IC) + 1; cj++) for (let ci = Math.floor(x0 / IC) - 1; ci <= Math.floor(x1 / IC) + 1; ci++) { const I = g.islandCell(ci, cj); if (I && reach(I)) out.push(I); }
    const D = g.designedIslands ? g.designedIslands((x0 + x1) / 2, (z0 + z1) / 2) : null;
    if (D) for (const I of D) if (reach(I) && out.indexOf(I) < 0) out.push(I);
    return out;
  }
  F.form = function (g, job) {
    if (!g.computeClimate || !g.surfaceY || !VR.LOD || !VR.LOD.look) return null;
    const LOD = VR.LOD, U = LOD.util, BIOMES = VR.BIOMES, SEA = VR.C.SEA;
    const cell = job.cell === 4 ? 4 : 2, T = 64, n = T / cell, x0 = job.tx * T, z0 = job.tz * T, x1 = x0 + T, z1 = z0 + T;
    const P = LOD.palette(), lk = {};
    // (job.prof: an object the phases add their milliseconds to — the node test's cost breakdown)
    const PR = job.prof || null; let tp = PR ? performance.now() : 0;
    const lap = (k) => { if (!PR) return; const t = performance.now(); PR[k] = (PR[k] || 0) + t - tp; tp = t; };
    // 1. the land: the top face's height at every vertex and one ring beyond (the slopes and the shading at the border),
    // then the look of the tile's own vertices (the horizon tiles' colour code, LOD.look)
    const f = F.newField(n, cell), W = f.W, H = f.h;
    for (let j = -1; j <= n + 1; j++) { const Z = z0 + j * cell, o = (j + 1) * W + 1; for (let i = -1; i <= n + 1; i++) H[o + i] = g.surfaceY(x0 + i * cell, Z) + 1; }
    const bio = new Uint8Array(W * W), cold = new Uint8Array(W * W);
    const clo = g.climateAt(x0, z0);   // one climate object, written over for every vertex (climateAt(x, z, out))
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
      const X = x0 + i * cell, Z = z0 + j * cell, k = (j + 1) * W + i + 1, y = H[k] - 1;
      const e = H[k + 1] - H[k], w = H[k - 1] - H[k], s2 = H[k + W] - H[k], nn = H[k - W] - H[k];
      const slope = Math.max(e < 0 ? -e : e, w < 0 ? -w : w, s2 < 0 ? -s2 : s2, nn < 0 ? -nn : nn) / cell;
      const cl = g.climateAt(X, Z, clo), bi = g.biomeFor(cl, y), B = BIOMES[bi];
      LOD.look(g, P, B, B.key, cl, X, Z, y, slope, cell, lk);
      bio[k] = bi; cold[k] = lk.cold ? 1 : 0;
      const t = lk.t, c = lk.cliff, k3 = k * 3;
      f.col[k3] = t[0]; f.col[k3 + 1] = t[1]; f.col[k3 + 2] = t[2];
      f.cliff[k3] = c[0]; f.cliff[k3 + 1] = c[1]; f.cliff[k3 + 2] = c[2];
      if (lk.water) { f.wet[k] = 1; f.wh[k] = lk.h; f.wkd[k] = lk.kd; f.wax[k] = lk.ax; f.wcol[k3] = t[0]; f.wcol[k3 + 1] = t[1]; f.wcol[k3 + 2] = t[2]; f.kd[k] = 0; }
      else f.kd[k] = lk.kd === 6 || lk.kd === 2 ? lk.kd : 0;
    }
    // the ring beyond: the border's skirts and water read only its heights; it keeps the next vertex' colours
    for (let j = -1; j <= n + 1; j++) for (let i = -1; i <= n + 1; i++) {
      if (i >= 0 && i <= n && j >= 0 && j <= n) continue;
      const k = (j + 1) * W + i + 1, kk = (Math.max(0, Math.min(n, j)) + 1) * W + Math.max(0, Math.min(n, i)) + 1;
      for (let c = 0; c < 3; c++) { f.col[k * 3 + c] = f.col[kk * 3 + c]; f.cliff[k * 3 + c] = f.cliff[kk * 3 + c]; }
    }
    lap('land');
    // 2. structures: their skylines over the tile's cells (the towns, the Heartland's set pieces); a skyline is looked up
    // before its plan is touched (the plan may be gone from the worker's caches by now: only a missing skyline needs it)
    const S = F.slabGrid(n, cell), sites = [], cache = g._farSky;
    for (const [id, get, site] of structuresNear(g, x0, z0, x1, z1)) {
      if (site) sites.push(site);
      const sk = (cache && cache.get(id)) || skyline(g, id, get());
      if (!sk.W) continue;
      if (sk.X0 >= x1 || sk.Z0 >= z1 || sk.X0 + sk.W * 2 <= x0 || sk.Z0 + sk.D * 2 <= z0) continue;
      const scale = cell >> 1;   // skyline cells per form cell (1 or 2)
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        let best = -1, bTop = -1, bBot = 32767, wins = 0, tot = 0, gbest = -1;
        for (let b = 0; b < scale; b++) for (let a = 0; a < scale; a++) {
          const si = ((x0 + i * cell - sk.X0) >> 1) + a, sj = ((z0 + j * cell - sk.Z0) >> 1) + b;
          if (si < 0 || sj < 0 || si >= sk.W || sj >= sk.D) continue;
          const c = sj * sk.W + si;
          if (sk.gY[c] > -32768 && (gbest < 0 || sk.gY[c] > sk.gY[gbest])) gbest = c;
          if (sk.top[c] < 0) continue;
          if (sk.top[c] > bTop) { bTop = sk.top[c]; best = c; }
          if (sk.bot[c] < bBot) bBot = sk.bot[c];
          wins += sk.win[c]; tot += sk.tot[c];
        }
        if (gbest >= 0) {   // the paving at ground level colours the land under it
          const L = LOD.stateLook(sk.gS[gbest]);
          if (L) for (let q = 0; q < 4; q++) { const k = (j + NB4[q][1] + 1) * W + i + NB4[q][0] + 1; if (!f.wet[k]) { f.col[k * 3] = L.c[0]; f.col[k * 3 + 1] = L.c[1]; f.col[k * 3 + 2] = L.c[2]; f.cliff[k * 3] = L.c[0]; f.cliff[k * 3 + 1] = L.c[1]; f.cliff[k * 3 + 2] = L.c[2]; } }
        }
        if (best < 0) continue;
        const ci = j * n + i, gy = sk.ground[best] + 1;
        if (S.on[ci] && S.top[ci] >= bTop + 1) continue;
        const roof = LOD.stateLook(sk.topS[best]), side = LOD.stateLook(sk.side[best] || sk.topS[best]);
        const kind = tot && wins / tot >= 0.2 ? 7 : (roof && roof.k === 4 ? 4 : 0);
        F.setSlab(S, i, j, { ground: gy, bot: bBot > gy + 1 ? bBot : gy - 1, top: bTop + 1, roof: roof ? roof.c : GREY, wall: side ? side.c : (roof ? roof.c : GREY), kind });
      }
    }
    lap('structures');
    // 3. floating islands: a slab per cell from the island's bottom to its top (grass, snow or red sand over rock)
    const I = F.slabGrid(n, cell), isles = islesNear(g, x0, z0, x1, z1);
    if (isles.length) {
      // each island over the cells of its own outline box only; the highest top wins a cell
      const iTop = new Float32Array(n * n).fill(-1e9), iBot = new Float32Array(n * n);
      for (const J of isles) {
        const r = J.r * 1.35 + 1, h = cell >> 1;
        const i0 = Math.max(0, Math.floor((J.x - r - x0) / cell)), i1 = Math.min(n - 1, Math.floor((J.x + r - x0) / cell));
        const j0 = Math.max(0, Math.floor((J.z - r - z0) / cell)), j1 = Math.min(n - 1, Math.floor((J.z + r - z0) / cell));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const sh = g.islandShape(J, x0 + i * cell + h, z0 + j * cell + h);
          if (sh && sh.top > iTop[j * n + i]) { iTop[j * n + i] = sh.top; iBot[j * n + i] = sh.bottom; }
        }
      }
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const c = j * n + i; if (iTop[c] < -1e8) continue;
        const X = x0 + i * cell + (cell >> 1), Z = z0 + j * cell + (cell >> 1);
        const cl = g.climateAt(X, Z, clo), B = BIOMES[g.biomeFor(cl, 90)];
        const t0 = cl.ember > 0.45 ? P.redsand : cl.t < -0.35 ? P.snow : U.tint(P.grassTop, B.grass);
        const sd = cl.ember > 0.45 ? P.ochre : cl.prism > 0.45 ? P.duskrock : P.stone;
        F.setSlab(I, i, j, { ground: -100, bot: iBot[c], top: iTop[c] + 1, roof: t0, wall: U.mixc(sd, ISLE_SHADE, 0.2), kind: 0 });
      }
    }
    lap('islands');
    // 4. meshes: the land, the structures, the islands
    const Bd = new Builder();
    F.meshField(Bd, f);
    lap('meshField');
    F.meshSlabs(Bd, S);
    F.meshSlabs(Bd, I);
    lap('meshSlabs');
    // 5. trees on a 4-block grid (the near horizon tiles' density): the biome of the nearest vertex, never in a town, on a
    // slab or in the water
    const RAD = VR.VillageGen ? VR.VillageGen.rad(g) : 58;
    const inVil = (X, Z, pad) => { for (const s of sites) { const r = (VR.VillageGen.siteRad ? VR.VillageGen.siteRad(g, s) : RAD) + pad; if ((s.x - X) * (s.x - X) + (s.z - Z) * (s.z - Z) < r * r) return true; } return false; };
    for (let v = 0; v < 16; v++) for (let u = 0; u < 16; u++) {
      const X = x0 + u * 4 + 2, Z = z0 + v * 4 + 2;
      const vi = Math.round((u * 4 + 2) / cell), vj = Math.round((v * 4 + 2) / cell), k = (vj + 1) * W + vi + 1;
      const B = BIOMES[bio[k]], key = B.key, tr = U.TREES[key];
      if (!tr || f.wet[k] || !(U.hh(X, Z, 91) < tr[0])) continue;
      if (f.kd[k] === 6 && key !== 'snowy_taiga' && key !== 'grove') continue;
      const ci = Math.min(n - 1, ((v * 4 + 2) / cell) | 0) * n + Math.min(n - 1, ((u * 4 + 2) / cell) | 0);
      if (S.on[ci] || I.on[ci]) continue;
      if (sites.length && inVil(X, Z, 4)) continue;
      const th = tr[2] * (0.75 + U.hh(X, Z, 92) * 0.5);
      let lc = U.leafCol(tr[1], B); if (cold[k]) lc = U.mixc(lc, P.snow, 0.55);
      const lg = U.TRUNKS[tr[1]] || U.TRUNKS.oak, tc = U.bcol(lg[0], 0, lg[1]);
      F.meshTree(Bd, u * 4 + 2 + (U.hh(X, Z, 93) - 0.5) * 1.2, v * 4 + 2 + (U.hh(X, Z, 94) - 0.5) * 1.2, H[k], tr[1], th, lc, tc, cell);
    }
    lap('trees');
    // 6. citadels: the spires the far horizon draws (lod.js), from the tile that holds the centre
    if (VR.CitadelGen && g.climateAt) {
      let cits = []; try { cits = VR.CitadelGen.near(g, x0, z0, x1, z1, 0); } catch (e) { if (VR.VillageGen && VR.VillageGen.probe && e === VR.VillageGen.probe) throw e; cits = []; }
      Bd.part = 'box';
      for (const s of cits) {
        if (s.x < x0 || s.x >= x1 || s.z < z0 || s.z >= z1) continue;
        const tx = s.x - x0, tz = s.z - z0, Rr = s.R, ty = s.y + 1, tcol = s.pal === 1 ? [0xD8, 0xC0, 0x90] : [0x9A, 0x9A, 0x96];
        Bd.box(tx - Rr, s.y - 6, tz - Rr, tx + Rr, ty, tz + Rr, tcol, tcol, 0, 1);
        for (const b of VR.CitadelGen.lodBoxes(s)) {
          const bx = b.x - x0, bz = b.z - z0;
          if (b.slits) { const r = b.r, ww = b.w; Bd.box(bx - ww, b.y0, bz - r - 0.6, bx + ww, b.y1, bz + r + 0.6, b.c, b.c, b.kd, 0); Bd.box(bx - r - 0.6, b.y0, bz - ww, bx + r + 0.6, b.y1, bz + ww, b.c, b.c, b.kd, 0); continue; }
          Bd.box(bx - b.r, b.y0, bz - b.r, bx + b.r, b.y1, bz + b.r, b.c, b.c, b.kd, b.kd === 0 ? 1 : 3);
        }
      }
    }
    const out = Bd.finish();
    out.tris = out.count / 3;
    lap('citadels');
    return out;
  };
  const GREY = [128, 128, 128], ISLE_SHADE = [20, 20, 30];
})(VR);
