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
//   viewTier(dx, dz, vx, vz, c) the upload order's tier (F10): 0 in the view or under the player, 1 beside, 2 behind
//   UploadScheduler            queued uploads run under a per-frame byte budget from the measured cost per byte (F10)
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

  // ---- upload scheduler (F8, measured and adaptive since F10 · streaming without hitches on a weak GPU).
  // One queue for everything that goes to the GPU while the world streams: the section meshes and their mini-voxel
  // detail (the near lane), the horizon tiles and the far forms (the far lane). A frame gets a budget in BYTES: the
  // frame's milliseconds divided by the measured cost per byte of THIS machine.
  //   cost per byte   msPerByte = the larger of the CPU-side estimate (the GL calls timed: rises at once to a solid
  //                   higher measurement, falls slowly) and the GPU-side one: calibrate() at world start (1 MB with a
  //                   gl.finish before and after, renderer.calibrateUploads), then gpuSample() — the GPU's lag of a
  //                   frame (its fence, polled at the next frames) fitted as lag = a + b · bytes over the recent frames;
  //                   the slope b eases the estimate (held within ½ … 8x of the calibration). An integrated GPU that
  //                   shares the system memory copies the bytes after the JS call has returned: the CPU side alone
  //                   would never see it.
  //   the frame's ms  the caller's budget (the preset's ms × the governor's rung) × scale × frameK, minus the debt
  //                   frameK = max(1, the median frame ÷ the 30 fps target): a machine whose usual frame is longer
  //                   spends the same share of it (the preset's ms are for a 33 ms frame)
  //                   scale (frame(), AIMD): a frame over max(target, 1.25 × median) with an upload in the last three
  //                   frames halves it (never below SCALE_MIN), a frame under 85 % of that adds 0.05 (up to 1)
  //                   debt: what a forced frame spent over its budget is paid back from the next frames
  //   order           the player's edit first (whole, even over the budget), then an item in progress, then by lane:
  //                   near by view (viewTier: in the view, beside, behind; nearest first within), far by its own
  //                   priority (the horizon's: coarse and near first). While both lanes wait the far lane gets FAR_SHARE
  //                   of the bytes; each lane takes what the other leaves. The queue sorts in place (insertion sort: the
  //                   last frame's order is nearly right), so a turn of the camera re-sorts at once.
  //   items           { bytes, x, z (or dx, dz, set by the caller each frame), lane (0 near, 1 far), prio (far lane; a near item
  //                     with its own: before every column),
  //                     urgent, alive() (false: dropped, abort() called), and either run() (atomic: all at once — the
  //                     first one that does not fit stops its lane, nothing overtakes it; one bigger than the whole
  //                     budget goes alone after waiting four frames, reported as forced) or step(maxBytes) → bytes
  //                     written, commit() when the last byte is up, abort() (parted: a big mesh straddles frames, its
  //                     old version draws until the commit) }
  //   hitches         frame() counts frames longer than 2 × the usual frame (the median of the last 64, at least
  //                   2 × 16.7 ms); hitches(now) = how many in the last 10 s
  // No allocation per frame: the items are kept and sorted in place, the result object and the scratch arrays reused.
  S.TARGET_MS = 1000 / 30;   // the frame the presets' upload milliseconds are meant for
  S.SCALE_MIN = 0.25;        // the adaptive scale never takes the budget below a quarter
  S.FAR_SHARE = 0.3;         // the far lane's share of the bytes while both lanes wait
  S.HITCH_MS = 10000;        // the hitch meter's window
  S.NEAR_BLOCKS = 24;        // columns this close come first, whatever the view (the ground under the player)
  const RING = 64;
  // the view tier of a column at (dx, dz) blocks from the camera: 0 in the view (its centre within the horizontal half
  // field of view widened by its own half width as seen from the camera) or within NEAR_BLOCKS, 1 beside, 2 behind.
  // (vx, vz): the unit view direction (flat); cosHalf: the cosine of the horizontal half field of view
  S.viewTier = function (dx, dz, vx, vz, cosHalf, sinHalf) {
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < S.NEAR_BLOCKS || !(vx || vz)) return 0;
    const c = (dx * vx + dz * vz) / d;
    const ch = cosHalf > 0 && cosHalf < 1 ? cosHalf : 0.6, sh = sinHalf !== undefined ? sinHalf : Math.sqrt(1 - ch * ch);
    const m = 12 / d;                                    // a column's half width seen from the camera (radians, d ≥ 24)
    if (c >= ch * (1 - m * m * 0.5) - sh * m) return 0;  // cos(half + m), to second order
    return c >= 0 ? 1 : 2;
  };
  class UploadScheduler {
    constructor(opts) {
      const o = opts || {};
      this.items = [];
      this.cpuEst = o.msPerByte || 2e-6;   // the JS side of an upload, ms per byte
      this.gpuEst = 0;                     // the GPU side (calibration, then the fence fit); 0 = not known
      this.cal = 0;                        // the calibration, ms per byte (0 = none)
      this.msPerByte = this.cpuEst;        // the estimate in use
      this.targetMs = o.targetMs || S.TARGET_MS;
      this.scale = 1; this.frameK = 1; this.debtMs = 0.5; this.medianMs = 0.5; this.debtMs = 0; this.medianMs = 0;   // (doubles from the start, see last)
      this.fr = new Float32Array(RING); this.frS = new Float32Array(RING); this.frN = 0; this.frI = 0; this.frC = 0;
      this.hit = new Float64Array(RING).fill(-Infinity); this.hitI = 0;
      this.sinceUp = 1e9;                  // frames since the last one that uploaded
      this.fit = { w: 0, x: 0, y: 0, xx: 0, xy: 0, n: 0 };   // the fence fit's weighted sums
      // (the number fields start as doubles, so V8 keeps their values in place: no boxed number per frame)
      this.last = { ran: 0, spentMs: 0.5, forced: 0, left: 0, bytes: 0, budgetBytes: 0.5, gauged: true };
      this.last.spentMs = 0; this.last.budgetBytes = 0;
      this._spent = 0.5; this._cap = 0.5; this._clock = null;
    }
    get size() { return this.items.length; }
    // the queue keeps a record of one shape per item (made once, here): its hot loops stay monomorphic whatever mix of
    // sections, mini-voxel detail, tiles and forms waits; the item's own functions are called on the item (it)
    push(item) {
      const prio = item.prio;
      this.items.push({ it: item, x: item.x || 0, z: item.z || 0, dx: item.dx || 0, dz: item.dz || 0, bytes: item.bytes || 0, left: item.bytes || 0,
        lane: item.lane === 1 ? 1 : 0, prio: typeof prio === 'number' ? prio : NaN, urgent: !!item.urgent, parted: typeof item.step === 'function', age: 0, p: 0.5, done: false });
    }
    // drops the queued items the predicate rejects (it gets the item); their staging is given back
    prune(keep) {
      const a = this.items; let n = 0;
      for (let i = 0; i < a.length; i++) { const r = a[i]; if (keep(r.it)) a[n++] = r; else if (r.it.abort) r.it.abort(); }
      a.length = n;
    }
    // everything waiting is dropped (a world torn down): staged ranges go back to the arenas
    clear() { const a = this.items; for (let i = 0; i < a.length; i++) if (a[i].it.abort) a[i].it.abort(); a.length = 0; this.debtMs = 0; }
    // ---- the cost per byte
    _est() { this.msPerByte = this.gpuEst > this.cpuEst ? this.gpuEst : this.cpuEst; }
    // a CPU-side timing (a run or a step): a solid slower one (≥ 0.5 ms) counts at once, the rest eases in; timings under
    // the clock's resolution say nothing
    _cpu(bytes, ms) {
      if (!(bytes > 0) || !(ms >= 0) || (ms < 0.25 && bytes < 262144)) return;
      const per = ms / bytes;
      this.cpuEst = per > this.cpuEst && ms >= 0.5 ? per : this.cpuEst * 0.8 + per * 0.2;
      this._est();
    }
    // one measurement with gl.finish before and after: the whole path of `bytes` (the JS call, the GPU process, the copy)
    // took `ms` — it replaces the constant both estimates started from
    calibrate(ms, bytes) {
      if (!(bytes > 0) || !(ms > 0)) return;
      this.cal = ms / bytes; this.gpuEst = this.cal; this.cpuEst = this.cal;
      const f = this.fit; f.w = 0; f.x = 0; f.y = 0; f.xx = 0; f.xy = 0; f.n = 0;
      this._est();
    }
    // a frame's fence was seen signalled `lagMs` after it was set; the frame had uploaded `bytes` (0: a base-line frame)
    gpuSample(bytes, lagMs) {
      if (!(lagMs >= 0) || !(bytes >= 0)) return;
      const f = this.fit, L = 0.995;   // (a memory of ~200 frames: the cost of the upload path is a property of the machine)
      f.w = f.w * L + 1; f.x = f.x * L + bytes; f.y = f.y * L + lagMs; f.xx = f.xx * L + bytes * bytes; f.xy = f.xy * L + bytes * lagMs; f.n++;
      if (f.n < 12) return;
      const mx = f.x / f.w, vx = f.xx / f.w - mx * mx, sd = 0.2 * Math.max(mx, 16384);
      if (!(vx > sd * sd)) return;                 // the frames' volumes too alike: no slope to tell
      let b = (f.xy / f.w - mx * (f.y / f.w)) / vx;
      const ref = this.cal || this.cpuEst;
      b = b < ref * 0.5 ? ref * 0.5 : b > ref * 8 ? ref * 8 : b;
      this.gpuEst = this.gpuEst ? this.gpuEst + (b - this.gpuEst) * 0.02 : b;
      this._est();
    }
    // ---- the frame's budget
    budgetMs(base) { return base > 0 ? base * this.scale * this.frameK : 0; }
    budgetBytes(base) { return this.budgetMs(base) / this.msPerByte; }
    // once a frame: the interval since the last frame (the frame the uploads of the frames before shared)
    frame(ms, now) {
      if (!(ms > 0) || ms > 4000) return;   // (a tab that slept, a breakpoint: nothing to learn)
      const recent = this.sinceUp <= 3;
      this.sinceUp++;
      this.fr[this.frI] = ms; this.frI = (this.frI + 1) % RING; if (this.frN < RING) this.frN++;
      if (this.frN < RING || (++this.frC & 7) === 0) {
        const n = this.frN, s = this.frS;
        for (let i = 0; i < RING; i++) s[i] = i < n ? this.fr[i] : Infinity;
        s.sort();
        this.medianMs = s[n >> 1];
      }
      const med = this.medianMs, T = this.targetMs;
      this.frameK = med > T ? med / T : 1;
      if (this.frN < 8) return;
      const ref = med * 1.25 > T ? med * 1.25 : T;
      if (ms > ref) { if (recent) this.scale = Math.max(S.SCALE_MIN, this.scale * 0.5); }
      else if (ms < ref * 0.85) this.scale = Math.min(1, this.scale + 0.05);
      if (ms > 2 * (med > 1000 / 60 ? med : 1000 / 60)) { this.hit[this.hitI] = now; this.hitI = (this.hitI + 1) % RING; }
    }
    hitches(now) { let k = 0; for (let i = 0; i < RING; i++) if (now - this.hit[i] <= S.HITCH_MS) k++; return k; }
    mbps() { return 1 / (this.msPerByte * 1000); }   // MB/s at the estimate (decimal: bytes per µs)
    // ---- the frame's uploads: budgetMs is the caller's (preset × rung); clock times the GL calls (none: not measured);
    // (vx, vz) the unit view direction, cosHalf the cosine of the horizontal half field of view
    drain(budgetMs, clock, vx, vz, cosHalf) {
      const a = this.items, L = this.last;
      L.ran = 0; L.spentMs = 0; L.forced = 0; L.bytes = 0; L.gauged = false;   // (gauged: renderer.upGauge has read this frame's bytes)
      // the dead go first, without spending bytes: their staging is given back
      let n = 0;
      for (let i = 0; i < a.length; i++) { const r = a[i], it = r.it; if (it.alive && !it.alive()) { if (it.abort) it.abort(); continue; } a[n++] = r; }
      a.length = n;
      const avail0 = budgetMs > 0 ? budgetMs * this.scale * this.frameK : 0;   // (= budgetMs(), inlined: no boxed return)
      if (!n) { L.left = 0; L.budgetBytes = avail0 / this.msPerByte; if (this.debtMs > 0) this.debtMs = Math.max(0, this.debtMs - avail0); return L; }
      // the order, in place (insertion sort: the last frame's order is nearly right)
      const ch = cosHalf > 0 && cosHalf < 1 ? cosHalf : 0.6, sh = Math.sqrt(1 - ch * ch), ux = vx || 0, uz = vz || 0, view = ux !== 0 || uz !== 0;
      let far = false;
      for (let i = 0; i < n; i++) {
        const r = a[i];
        let p;
        if (r.urgent) p = -3e9;
        else if (r.parted && r.left > 0 && r.left < r.bytes) p = -2e9;   // in progress: finish what was started
        else {
          const dx = r.dx, dz = r.dz, d = Math.sqrt(dx * dx + dz * dz);
          if (r.lane === 1) p = r.prio === r.prio ? r.prio : d / 1024;
          else if (r.prio === r.prio) p = r.prio;   // (a near item with its own priority: the look's textures, -1, ahead of every column)
          else if (d < S.NEAR_BLOCKS || !view) p = d;
          else {   // = viewTier, inlined (the distance once): in the view, beside, behind
            const c = (dx * ux + dz * uz) / d, m = 12 / d;
            p = c >= ch * (1 - m * m * 0.5) - sh * m ? d : (c >= 0 ? 1e7 : 2e7) + d;
          }
        }
        r.p = p;
        if (r.lane === 1) far = true;
      }
      for (let i = 1; i < n; i++) { const r = a[i], p = r.p; let j = i - 1; while (j >= 0 && a[j].p > p) { a[j + 1] = a[j]; j--; } a[j + 1] = r; }
      // the frame's milliseconds after the debt of a forced frame
      let avail = avail0 - this.debtMs;
      if (avail < 0) { this.debtMs = -avail; avail = 0; } else this.debtMs = 0;
      this._clock = clock || null; this._spent = 0;
      if (far) { this._cap = avail * (1 - S.FAR_SHARE); this._lane(0); this._cap = avail; this._lane(1); this._lane(0); }
      else { this._cap = avail; this._lane(0); }
      // the done ones out, the rest a frame older
      let m = 0;
      for (let i = 0; i < n; i++) { const r = a[i]; if (r.done) continue; r.age++; a[m++] = r; }
      a.length = m;
      if (this._spent > avail) this.debtMs += this._spent - avail;
      if (L.bytes > 0) this.sinceUp = 0;
      L.left = m; L.budgetBytes = avail / this.msPerByte;
      this._clock = null;
      return L;
    }
    // one pass over a lane, in order, until its cap (this._cap, cumulative over the frame) is spent
    _lane(lane) {
      const a = this.items, L = this.last, clk = this._clock, cap = this._cap;
      for (let i = 0; i < a.length; i++) {
        const r = a[i];
        if (r.done || r.lane !== lane) continue;
        const it = r.it, urgent = r.urgent, rem = cap - this._spent;
        if (r.parted) {
          if (r.left > 0) {
            let max = Infinity;
            if (!urgent) { if (rem <= 0) return; max = Math.floor(rem / this.msPerByte); if (max < 16) return; }
            const t0 = clk ? clk() : 0;
            const b = it.step(max) || 0;
            const ms = clk ? Math.max(0, clk() - t0) : 0;
            if (b > 0) { r.left -= b; L.bytes += b; L.ran++; this._account(b, ms); }
            if (r.left > 0) { if (urgent && b > 0) { i--; continue; } return; }
          }
          it.commit(); r.done = true;
        } else {
          const bytes = r.bytes, est = bytes * this.msPerByte;
          if (!urgent && est > rem + 1e-9) {
            if (this._spent === 0 && est > cap && r.age >= 4) L.forced++;
            else return;   // the first that does not fit stops its lane: nothing overtakes it
          }
          const t0 = clk ? clk() : 0;
          it.run();
          const ms = clk ? Math.max(0, clk() - t0) : 0;
          r.done = true; L.ran++; L.bytes += bytes;
          this._account(bytes, ms);
        }
      }
    }
    _account(bytes, ms) {
      const est = bytes * this.msPerByte;
      if (this._clock) this._cpu(bytes, ms);
      this._spent += ms > est ? ms : est;
      this.last.spentMs += ms;
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
