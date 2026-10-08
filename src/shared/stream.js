// ============================================================================
// Far horizon and streaming, the pure parts (F8 · Sichtweite). No DOM, no GL: the game's main thread (world.js,
// horizon.js, game.js) and the node tests share these functions, and the shaders carry the same formulas.
//   fadeCurve(ms)              smoothstep of a chunk's fade-in (300 ms): 0 when it appears, 1 when it is whole
//   bayer4(x, y)               4x4 ordered-dither threshold in [0, 15/16] (the shaders' bayer4, same closed form)
//   chunkKeeps(fade, x, y)     a chunk fragment is drawn iff its dither threshold is under the fade
//   lodCover(near, bilinear)   the far tile's cut: min(bilinear mask, the nearest chunk's fade). Never above the
//                              chunk's own fade, so every pixel is drawn by the chunk or by the tile (no holes)
//   maskSample(tex, n, u, v)   the GPU's bilinear read of the n×n mask (texel centres at i + 0.5)
//   viewPrio(dx, dz, vx, vz)   streaming priority: distance, ×1.0 straight ahead … ×2.2 straight behind
//   UploadScheduler            queued uploads run under a per-frame budget, strictly in priority order
//   streamRung(ms, target, r)  the streaming rate steps 1 → ½ → ¼ under frame-time pressure (never the view distance)
// ============================================================================
(function (VR) {
  'use strict';
  const S = VR.Stream = {};
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  S.FADE_MS = 300;
  S.fadeCurve = function (ms, dur) { const t = clamp01(ms / (dur || S.FADE_MS)); return t * t * (3 - 2 * t); };
  // McGuire's closed form for the 4x4 Bayer matrix, the same arithmetic as the GLSL (floor, fract, dot)
  const bayer2 = (x, y) => { const a = Math.floor(x), b = Math.floor(y); const f = (a * 0.5 + b * b * 0.75) % 1; return f < 0 ? f + 1 : f; };
  S.bayer4 = function (x, y) { return bayer2(0.5 * x, 0.5 * y) * 0.25 + bayer2(x, y); };
  S.chunkKeeps = function (fade, x, y) { return S.bayer4(x, y) < fade; };
  S.lodCover = function (near, bilinear) { const n = clamp01(near), b = clamp01(bilinear); return b < n ? b : n; };
  S.maskSample = function (tex, n, u, v) {
    const x = u - 0.5, y = v - 0.5;
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const cl = (i) => (i < 0 ? 0 : i >= n ? n - 1 : i);
    const at = (i, j) => tex[cl(j) * n + cl(i)] / 255;
    const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * fx;
    const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * fx;
    return a + (b - a) * fy;
  };
  // (dx, dz): the chunk's offset from the camera in blocks; (vx, vz): the unit view direction (flat)
  S.viewPrio = function (dx, dz, vx, vz) {
    const d = Math.hypot(dx, dz);
    if (!(vx || vz) || d < 1e-9) return d;
    const c = (dx * vx + dz * vz) / d;          // -1 behind … +1 ahead
    return d * (1.6 - 0.6 * c);
  };

  // ---- upload scheduler. A frame has `budgetMs` for uploads. Items run in view priority order and only while the
  // estimated cost still fits: the first item that does not fit stops the frame (nothing overtakes it). An item
  // bigger than the whole budget runs alone once it has waited four frames, and the run is reported as forced.
  // The estimate is ms per byte: it rises at once to a measured higher rate and falls slowly to a lower one.
  class UploadScheduler {
    constructor(opts) { this.items = []; this.msPerByte = (opts && opts.msPerByte) || 2e-6; this.last = null; }
    get size() { return this.items.length; }
    // an item: run() does the upload; bytes size its estimate; x, z (absolute blocks) or dx, dz (relative) place it
    push(item) { this.items.push({ key: item.key, col: item.col, x: item.x, z: item.z, bytes: item.bytes || 0, dx: item.dx || 0, dz: item.dz || 0, run: item.run, age: 0 }); }
    // drops the queued items the predicate rejects (a column unloaded while its mesh waited)
    prune(keep) { this.items = this.items.filter(it => keep(it)); }
    drain(budgetMs, clock, vx, vz) {
      const now = clock || (() => 0);
      const order = this.items.map((it) => ({ it, p: S.viewPrio(it.dx, it.dz, vx || 0, vz || 0) }));
      order.sort((a, b) => a.p - b.p);
      const keep = [];
      let spent = 0, ran = 0, forced = 0, blocked = false;
      for (const { it } of order) {
        if (blocked) { it.age++; keep.push(it); continue; }
        const est = it.bytes * this.msPerByte;
        if (spent + est > budgetMs + 1e-9) {
          if (spent === 0 && est > budgetMs && it.age >= 4) forced++;
          else { blocked = true; it.age++; keep.push(it); continue; }
        }
        const t0 = now();
        it.run();
        const ms = Math.max(0, now() - t0);
        spent += ms; ran++;
        if (it.bytes > 0) {
          const per = ms / it.bytes;
          this.msPerByte = per > this.msPerByte ? per : this.msPerByte * 0.8 + per * 0.2;
        }
      }
      this.items = keep;
      this.last = { ran, spentMs: spent, forced, left: keep.length };
      return this.last;
    }
  }
  S.UploadScheduler = UploadScheduler;

  // the streaming rate under frame-time pressure: one rung down per slow window, one up per fine window (the caller
  // decides the window; this is the rule). The view distance is not an input: it is never reduced.
  S.streamRung = function (frameMs, targetMs, rung) {
    const r = rung | 0;
    if (frameMs > targetMs * 1.25) return Math.min(2, r + 1);
    if (frameMs < targetMs * 0.7) return Math.max(0, r - 1);
    return Math.max(0, Math.min(2, r));
  };
  S.streamScale = function (rung) { return [1, 0.5, 0.25][Math.max(0, Math.min(2, rung | 0))]; };
})(VR);
