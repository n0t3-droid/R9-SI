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
})(VR);
