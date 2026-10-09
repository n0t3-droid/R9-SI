// ============================================================================
// F-Far · ring 1 on the main thread: the forms (coarse meshes of 4 x 4 chunk columns, built by the workers with
// VR.Far.form) between the chunks (ring 0) and the horizon tiles (ring 2), out to ~1 km on High and Ultra.
// The horizon owns it (horizon.js: this.far) and calls update(cam) every frame and draw(r, E) before its own tiles.
//   - which tiles: VR.Far.RingSet (rescanned only when the camera's column, renderDist or the radius change)
//   - jobs on the far lane, nearest first: the nearest forms right after the coarsest horizon tiles (levels 3 and 4), the
//     farthest before the horizon's finer tiles far out; a few per worker in flight; a tile the camera has left cancels
//     itself before a worker touches it
//   - uploads through the world's upload queue (the F8 budget per frame); a form fades in over 300 ms
//   - the far mask: maskG holds each column's form fade (136 x 136 columns around the camera's); the shaders cut ring 1
//     where the chunks are and ring 2 where the forms are (VR.Far.draws is the rule)
//   - memory: ring 1 and ring 2 share the horizon level's byte cap; ring 1 asks for no more when they reach it
// No allocation per frame in the bookkeeping: live and fading tiles are kept in arrays, the request order is the
// RingSet's own array, the mask a fixed buffer.
// ============================================================================
(function (VR) {
  'use strict';
  const F = VR.Far, mat4 = VR.mat4;
  const MASK_N = 136;   // columns of the far mask while ring 1 is on (± 68 around the camera's: ring 1 is 64 + 2.5)
  class FarRing {
    constructor(hz) {
      this.hz = hz; this.g = hz.g;
      this.set = new F.RingSet();
      this.r1 = 0; this.gen = 1; this.inflight = 0; this.reqIdx = 0; this.scanSeen = -1;
      this.live = []; this.fading = []; this.failed = [];
      this.maskG = new Uint8Array(MASK_N * MASK_N); this.maskDirty = true; this.mcx = NaN; this.mcz = NaN;
      this.stats = { tiles: 0, ready: 0, cols: 0, bytes: 0, drawn: 0, tris: 0, inflight: 0, requested: 0, empty: 0, uploads: 0 };
      this.t0 = -1; this.firstAt = -1; this.firstUpAt = -1; this.allAt = -1;
    }
    static get MASK_N() { return MASK_N; }
    // the preset's ring-1 radius in chunks (0 = off)
    setRadius(r1) {
      r1 = Math.max(0, r1 | 0);
      if (r1 === this.r1) return;
      this.r1 = r1;
      this.reset();
    }
    on() { return this.r1 > 0 && this.hz.enabled(); }
    free(t) {
      const gl = this.g.renderer && this.g.renderer.gl;
      if (t.gpu && gl) { gl.deleteVertexArray(t.gpu.vao); gl.deleteBuffer(t.gpu.vbo); gl.deleteBuffer(t.gpu.ibo); }
      t.gpu = null;
      let i = this.live.indexOf(t); if (i >= 0) { this.live[i] = this.live[this.live.length - 1]; this.live.pop(); }
      i = this.fading.indexOf(t); if (i >= 0) { this.fading[i] = this.fading[this.fading.length - 1]; this.fading.pop(); }
      if (t.state === 2) { i = this.failed.indexOf(t); if (i >= 0) this.failed.splice(i, 1); }
      this.set.free(t);
      this.maskDirty = true;
    }
    reset() {
      for (let i = this.live.length - 1; i >= 0; i--) this.free(this.live[i]);
      this.live.length = 0; this.fading.length = 0; this.failed.length = 0;
      this.set.clear(); this.gen++; this.inflight = 0; this.reqIdx = 0;
      this.maskG.fill(0); this.maskDirty = true;
      this.t0 = this.r1 > 0 ? performance.now() : -1; this.firstAt = -1; this.firstUpAt = -1; this.allAt = -1;
    }
    // ---------------------------------------------------------------- per frame
    update(cam) {
      const g = this.g, w = g.world;
      if (!this.on() || !w) { if (this.set.tiles.size) this.reset(); return; }
      if (this.t0 < 0) this.t0 = performance.now();
      const ccx = Math.floor(cam.x) >> 4, ccz = Math.floor(cam.z) >> 4;
      if (this.set.update(ccx, ccz, w.renderDist, this.r1)) {
        const fl = this.set.freeList();
        for (let i = fl.length - 1; i >= 0; i--) this.free(fl[i]);
        this.reqIdx = 0;
      }
      if (ccx !== this.mcx || ccz !== this.mcz) { this.mcx = ccx; this.mcz = ccz; this.maskDirty = true; }
      if (this.failed.length && performance.now() - this.failed[0].failedAt > 10000) { const t = this.failed.shift(); this.set.free(t); this.set.ccx = NaN; }
      this.ask();
      this.stepFades(performance.now());
      if (this.maskDirty) this.writeMask();
    }
    // the next requests: nearest first, while there is room in flight and in the byte budget
    ask() {
      const g = this.g, order = this.set.requestOrder(), maxIn = 2 + g.pool.workers.length * 2;
      const cap = F.capBytes(this.hz.level);
      while (this.reqIdx < order.length && this.inflight < maxIn) {
        const k = order[this.reqIdx];
        const tx = Math.floor(k / 2097152) - 1048576, tz = (k % 2097152) - 1048576;
        let t = this.set.tiles.get(k);
        F.tileDistInto(tx, tz, this.set.ccx, this.set.ccz, TD);
        const cell = F.cellFor(TD[0]);
        if (t && (t.state === 0 || t.redo)) { this.reqIdx++; continue; }            // already on its way
        if (!F.canAsk(this.set.bytes, this.hz.bytes || 0, cell === 2 ? 90000 : 40000, cap)) break;   // the budget is full
        this.reqIdx++;
        t = this.set.add(tx, tz, cell);
        this.request(t, cell, TD[0]);
      }
    }
    request(t, cell, dmin) {
      const g = this.g, gen = this.gen, set = this.set;
      this.inflight++; this.stats.requested++;
      // stale: the tile left the set, ring 1 was switched off or reset
      const cancel = () => set.tiles.get(t.key) !== t || this.gen !== gen || !this.on();
      g.pool.submit({ type: 'form', dim: 'overworld', tx: t.tx, tz: t.tz, cell, lane: 1, cancel }, null, (m) => {
        if (this.gen !== gen) return;
        this.inflight = Math.max(0, this.inflight - 1);
        if (set.tiles.get(t.key) !== t) return;
        if (m.type === 'cancelled') { if (t.state === 0) set.free(t); else t.redo = 0; set.ccx = NaN; return; }   // (asked again if still wanted)
        if (m.type !== 'form') {   // failed (a worker that threw or died): the tile rests 10 s before it is asked for again
          if (t.state === 0) { t.state = 2; t.failedAt = performance.now(); this.failed.push(t); } else t.redo = 0;
          return;
        }
        if (m.empty) { set.ready(t, 0); t.empty = true; this.stats.empty++; return; }
        // the upload waits in the world's queue: the frame's upload budget (F8) covers every ring. (key null: the queue
        // keeps an item whose column it cannot find — world.js drainUploads compares cols.get(key) with col, both empty)
        const w = g.world, bytes = m.verts.byteLength + m.idx.byteLength;
        const run = () => { if (this.gen === gen && set.tiles.get(t.key) === t) this.upload(t, m, bytes); };
        if (w && w.uploadQ) w.uploadQ.push({ key: null, col: undefined, x: t.tx * 64 + 32, z: t.tz * 64 + 32, bytes, run });
        else run();
      }, -1.4 + 1.6 * dmin / Math.max(1, this.r1));   // (far lane: after the coarsest horizon tiles, before the finer ones far out)
    }
    upload(t, m, bytes) {
      const r = this.g.renderer, gl = r.gl;
      const old = t.gpu;
      const vao = gl.createVertexArray(), vbo = gl.createBuffer(), ibo = gl.createBuffer();
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(m.verts), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.SHORT, false, 12, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribIPointer(1, 2, gl.UNSIGNED_BYTE, 12, 6);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, 12, 8);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, m.idx, gl.STATIC_DRAW);
      gl.bindVertexArray(null);
      t.gpu = { vao, vbo, ibo, count: m.count, type: m.big ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, minY: m.minY, maxY: m.maxY, bx0: m.bx0, bz0: m.bz0, bx1: m.bx1, bz1: m.bz1, tris: m.tris || m.count / 3 };
      if (old) { gl.deleteVertexArray(old.vao); gl.deleteBuffer(old.vbo); gl.deleteBuffer(old.ibo); }
      else this.live.push(t);
      this.set.ready(t, bytes);
      this.stats.uploads++;
      if (this.firstUpAt < 0) this.firstUpAt = performance.now();
      if (t.shownAt < 0) { t.shownAt = performance.now(); t.fade = 0; this.fading.push(t); }
      this.maskDirty = true;
    }
    stepFades(now) {
      const fa = this.fading;
      for (let i = fa.length - 1; i >= 0; i--) {
        const t = fa[i], f = Math.round(255 * VR.Stream.fadeCurve(now - t.shownAt)) / 255;
        if (f !== t.fade) { t.fade = f; this.maskDirty = true; }
        if (f >= 1) { fa[i] = fa[fa.length - 1]; fa.pop(); }
      }
    }
    // the far mask's ring-1 half: each column of a live form holds its fade (0..255)
    writeMask() {
      const m = this.maskG, N = MASK_N, H = N >> 1, ccx = this.mcx, ccz = this.mcz, T = F.TILE;
      m.fill(0);
      for (let i = 0; i < this.live.length; i++) {
        const t = this.live[i], v = Math.round(255 * t.fade);
        if (!v) continue;
        for (let dz = 0; dz < T; dz++) {
          const mz = t.tz * T + dz - ccz + H; if (mz < 0 || mz >= N) continue;
          for (let dx = 0; dx < T; dx++) { const mx = t.tx * T + dx - ccx + H; if (mx >= 0 && mx < N) m[mz * N + mx] = v; }
        }
      }
      this.maskDirty = false; this.maskUp = true;
    }
    // ---------------------------------------------------------------- drawing (after the chunks, before the horizon tiles)
    draw(r, E, mask0, mask1) {
      const list = this.live; if (!list.length) { this.stats.drawn = 0; this.stats.tris = 0; return; }
      const gl = r.gl, p = r.farProgram('form'), cam = r.cam;
      if (!p) return;
      gl.useProgram(p.p); r.common(p, E);
      gl.uniformMatrix4fv(p.u.u_viewProj, false, r.viewProj);
      gl.uniform3f(p.u.u_camFrac, r.camFrac[0], r.camFrac[1], r.camFrac[2]);
      gl.uniform3i(p.u.u_camInt, r.camInt[0], r.camInt[1], r.camInt[2]);
      if (p.u.u_emissiveBoost) gl.uniform1f(p.u.u_emissiveBoost, E.emissiveBoost);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, mask0); gl.uniform1i(p.u.u_mask, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, r.texNoise); gl.uniform1i(p.u.u_noise, 1);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, mask1); gl.uniform1i(p.u.u_mask1, 2);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); gl.enable(gl.CULL_FACE);
      // (a form wholly under ring 0 — kept for the moment its chunks leave — would only be thrown away pixel by pixel)
      const mF = this.hz.maskF, ccx = this.mcx, ccz = this.mcz;
      let n = 0, tris = 0;
      for (let i = 0; i < list.length; i++) {
        const t = list[i], m = t.gpu;
        if (!m || !(t.fade > 0)) continue;
        if (mF && F.underRing0(mF, MASK_N, t.tx, t.tz, ccx, ccz)) continue;
        const ox = t.tx * 64 - cam.x, oz = t.tz * 64 - cam.z;
        if (!mat4.boxInFrustum(r.planes, ox + m.bx0, m.minY - cam.y, oz + m.bz0, ox + m.bx1, m.maxY - cam.y, oz + m.bz1)) continue;
        gl.uniform3f(p.u.u_tileOrigin, ox, -cam.y, oz);
        gl.bindVertexArray(m.vao);
        gl.drawElements(gl.TRIANGLES, m.count, m.type, 0);
        n++; tris += m.tris;
      }
      gl.bindVertexArray(null);
      this.stats.drawn = n; this.stats.tris = tris;
      r.stats.draws += n; r.stats.tris += tris;
      if (n && this.firstAt < 0) this.firstAt = performance.now();
      if (this.allAt < 0 && !this.inflight && this.reqIdx >= this.set.requestOrder().length && this.live.length) this.allAt = performance.now();
    }
    // over the shared byte cap: the farthest forms go (called by the horizon at most every 30 frames, only when over)
    evict(budget) {
      if (this.set.bytes <= budget) return 0;
      const cx = this.set.ccx, cz = this.set.ccz, d = (t) => F.tileDistInto(t.tx, t.tz, cx, cz, TD)[0];
      const list = this.live.slice().sort((a, b) => d(b) - d(a));
      let n = 0;
      for (const t of list) { if (this.set.bytes <= budget) break; this.free(t); n++; }
      return n;
    }
    // numbers for the ⚙ line and the tests
    report() {
      let ready = 0, cols = 0;
      for (const t of this.set.tiles.values()) if (t.state === 1) { ready++; cols += 16; }
      return { radius: this.r1, on: this.on(), tiles: this.set.tiles.size, ready, cols, bytes: this.set.bytes, drawn: this.stats.drawn, tris: this.stats.tris, inflight: this.inflight,
        want: Math.max(0, this.set.requestOrder().length - this.reqIdx), requested: this.stats.requested, uploads: this.stats.uploads,
        firstFrameMs: this.firstAt >= 0 && this.t0 >= 0 ? this.firstAt - this.t0 : -1, firstUploadMs: this.firstUpAt >= 0 && this.t0 >= 0 ? this.firstUpAt - this.t0 : -1,
        allMs: this.allAt >= 0 && this.t0 >= 0 ? this.allAt - this.t0 : -1 };
    }
    destroy() { this.reset(); }
  }
  const TD = new Float64Array(2);
  VR.FarRing = FarRing;
})(VR);
