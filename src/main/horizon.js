// ============================================================================
// Far-terrain horizon, main thread: a quadtree of LOD tiles (built by the
// workers, see shared/lod.js) is kept around the camera — 4-block cells near
// the loaded chunks, then 8, 16 and 32-block cells out to the horizon. A
// 64x64 mask of the chunks that are really drawn lets the shader cut the
// LOD away exactly where real terrain exists, so the two never overlap and
// unloaded chunks are never holes.
// ============================================================================
(function (VR) {
  'use strict';
  const mat4 = VR.mat4;
  const N = 32;
  const tileSize = (L) => N * (4 << L);
  // horizon setting → radius in blocks: 1 km, 2 km, 3 km, 5 km (level 4 tiles are 2 km wide with 64-block cells)
  const RADII = [0, 1024, 2048, 3072, 5120];
  const TOP = [0, 2, 3, 3, 4];           // coarsest tile level per setting
  const SPLIT = [1.2, 1.2, 1.35, 1.6, 1.6];

  class Horizon {
    constructor(g) {
      this.g = g; this.tiles = new Map(); this.radius = 0; this.inflight = 0; this.frame = 0;
      this.mask = new Uint8Array(64 * 64); this.maskTex = null;
      this.drawList = []; this.sentAvg = false; this.worldKey = ''; this.split = 1.35; this.level = 0;
      this.stats = { tiles: 0, drawn: 0, tris: 0, mb: 0, done: 0, want: 0 }; this.bytes = 0;
      // F-Far · ring 1 (farring.js): the forms between the chunks and these tiles, on High and Ultra (setFar)
      this.far = VR.FarRing ? new VR.FarRing(this) : null;
      this.maskF = null; this.maskTexF = null; this.maskTex1 = null;
    }
    // the preset's ring-1 radius in chunks (0 = off: the horizon works exactly as before)
    setFar(r1) { if (this.far) this.far.setRadius(r1); }
    farOn() { return !!(this.far && this.far.on()); }
    static radiusFor(level) { return RADII[Math.max(0, Math.min(4, level | 0))]; }
    setLevel(level) { this.level = Math.max(0, Math.min(4, level | 0)); const r = Horizon.radiusFor(this.level); this.split = SPLIT[this.level]; if (r !== this.radius) { this.radius = r; } }
    key(L, tx, tz) { return L + ':' + tx + ':' + tz; }
    free(t) { const gl = this.g.renderer.gl; if (t.vao) { gl.deleteVertexArray(t.vao); gl.deleteBuffer(t.vbo); gl.deleteBuffer(t.ibo); t.vao = null; this.bytes -= t.bytes || 0; t.bytes = 0; } }
    reset() { for (const t of this.tiles.values()) this.free(t); this.tiles.clear(); this.drawList.length = 0; this.inflight = 0; this.bytes = 0; if (this.far) this.far.reset(); }
    // how much of the horizon around the camera is built (1 = every wanted tile is on the GPU)
    progress() { const s = this.stats; return s.want + s.done > 0 ? s.done / (s.want + s.done) : 1; }
    enabled() { const g = this.g, w = g.world; return this.radius > 0 && w && (g.dim || 'overworld') === 'overworld' && w.dim === 'overworld'; }
    // ---------------------------------------------------------------- per frame
    update(cam) {
      const g = this.g, w = g.world, r = g.renderer;
      this.drawList.length = 0;
      if (!this.enabled() || !r) return;
      // the mask is filtered linearly: the cut between far tiles and chunks is a soft band over a chunk (F8), not a step
      if (!this.maskTex) { const gl = r.gl; this.maskTex = VR.GL.tex2D(64, 64, gl.R8, gl.RED, gl.UNSIGNED_BYTE, { data: this.mask, filter: gl.LINEAR }); }
      if (!this.sentAvg && g.tex && g.tex.avgColor) { g.pool.broadcast({ type: 'lodinit', avg: g.tex.avgColor }); this.sentAvg = true; }
      const wk = w.seed + ':' + (w.genOpts && w.genOpts.worldType || '') + ':' + (w.genOpts && w.genOpts.vgen || 1);
      if (wk !== this.worldKey) { this.reset(); this.worldKey = wk; }
      // (F-Far) another world object (a dimension and back) took the old upload queue with it: the tiles and forms that
      // waited in it are asked for again
      if (w !== this.qWorld) { if (this.qWorld) this.dropQueued(); this.qWorld = w; }
      this.frame++;
      // F-Far: ring 1 first (it frees and asks for its forms), then the masks: with ring 1 on, the far mask covers 136 x 136
      // columns and carries ring 1's fades (updateMaskFar); without it, the 64 x 64 mask as before
      const far1 = this.farOn();
      if (this.far) this.far.update(cam);
      if (far1) this.updateMaskFar(cam); else this.updateMask(cam);
      // ---- quadtree selection (with ring 1 on, no tile finer than level 2: ring 1 is the land within 1 km)
      const R = this.radius, Lr = TOP[this.level] || 2, Sr = tileSize(Lr), Lmin = far1 ? Math.min(2, Lr) : 0;
      const cx = cam.x, cz = cam.z;
      const want = [];
      const list = this.drawList;
      let done = 0;
      const dist = (L, tx, tz) => { const S = tileSize(L), x0 = tx * S, z0 = tz * S; const dx = Math.max(x0 - cx, 0, cx - (x0 + S)), dz = Math.max(z0 - cz, 0, cz - (z0 + S)); return Math.hypot(dx, dz); };
      const ready = (t) => t && t.state === 1;
      // a failed tile is forgotten after a while and asked for again
      const get = (L, tx, tz) => { const k = this.key(L, tx, tz), t = this.tiles.get(k); if (t && t.state === 2 && this.frame - t.failedAt > 300) { this.tiles.delete(k); return undefined; } return t; };
      const visit = (L, tx, tz) => {
        const d = dist(L, tx, tz);
        if (d > R) return;
        const S = tileSize(L);
        const t = get(L, tx, tz);
        if (t) t.used = this.frame;
        if (L > Lmin && d < this.split * S) {
          const kids = [[tx * 2, tz * 2], [tx * 2 + 1, tz * 2], [tx * 2, tz * 2 + 1], [tx * 2 + 1, tz * 2 + 1]];
          const kt = kids.map(([a, b]) => (dist(L - 1, a, b) > R ? 'out' : get(L - 1, a, b)));
          const allReady = kt.every(k => k === 'out' || ready(k));
          if (allReady || !ready(t)) {
            // descend: children draw themselves (or request themselves)
            for (let i = 0; i < 4; i++) if (kt[i] !== 'out') visit(L - 1, kids[i][0], kids[i][1]);
            if (!allReady && !t) want.push([d, L, tx, tz]);
            return;
          }
          // parent stands in until every child is ready
          for (let i = 0; i < 4; i++) { const k = kt[i]; if (k === 'out') continue; if (!k) want.push([dist(L - 1, kids[i][0], kids[i][1]), L - 1, kids[i][0], kids[i][1]]); else k.used = this.frame; }
          if (!t.empty) list.push(t);
          done++;
          return;
        }
        if (!t) { want.push([d, L, tx, tz]); return; }
        if (ready(t)) { done++; if (!t.empty) list.push(t); }
      };
      const a0 = Math.floor((cx - R) / Sr), a1 = Math.floor((cx + R) / Sr), b0 = Math.floor((cz - R) / Sr), b1 = Math.floor((cz + R) / Sr);
      for (let tz = b0; tz <= b1; tz++) for (let tx = a0; tx <= a1; tx++) visit(Lr, tx, tz);
      // the coarse ring: is every top-level tile around the camera on the GPU (itself or through its children)?
      let topN = 0, topOk = 0;
      const covered = (L, tx, tz) => { const t = this.tiles.get(this.key(L, tx, tz)); if (ready(t)) return true; if (L <= Lmin) return false; for (let i = 0; i < 4; i++) { const a = tx * 2 + (i & 1), b = tz * 2 + (i >> 1); if (dist(L - 1, a, b) > R) continue; if (!covered(L - 1, a, b)) return false; } return true; };
      for (let tz = b0; tz <= b1; tz++) for (let tx = a0; tx <= a1; tx++) { if (dist(Lr, tx, tz) > R) continue; topN++; if (covered(Lr, tx, tz)) topOk++; }
      this.stats.coarse = topN ? topOk / topN : 1;
      // ---- requests: coarse and near first (relative to tile size); the pool's far lane keeps them flowing
      // beside the chunk work, and a request the camera has left behind cancels itself before it runs
      const maxInflight = 4 + g.pool.workers.length * 2;
      let asked = 0;
      if (want.length && this.inflight < maxInflight) {
        want.sort((p, q) => (p[0] / tileSize(p[1]) - p[1] * 0.6) - (q[0] / tileSize(q[1]) - q[1] * 0.6));
        for (const [d, L, tx, tz] of want) { if (this.inflight >= maxInflight) break; if (!this.tiles.has(this.key(L, tx, tz))) { this.request(L, tx, tz, d); asked++; } }
      }
      this.stats.want = want.length - asked; this.stats.done = done;
      // ---- eviction: a tile cap and a memory budget that grow with the horizon level (F-Far: ring 1's forms count in the
      // same budget — the old unused tiles go first, then the farthest forms)
      const lv = this.level;
      const capN = [0, 150, 210, 290, 400][lv], capB = [0, 56, 84, 128, 192][lv] * 1048576, fb = far1 ? this.far.set.bytes : 0;
      if ((this.tiles.size > capN || this.bytes + fb > capB) && this.frame % 30 === 0) {
        const old = [...this.tiles.values()].filter(t => t.state !== 0 && this.frame - t.used > 90).sort((p, q) => p.used - q.used);
        let n = this.tiles.size, b = this.bytes;
        for (const t of old) { if (n <= capN - 10 && b + fb <= capB * 0.92) break; b -= t.bytes || 0; n--; this.free(t); this.tiles.delete(this.key(t.L, t.tx, t.tz)); }
        if (far1 && this.bytes + this.far.set.bytes > capB * 0.92) this.far.evict(capB * 0.92 - this.bytes);
      }
      this.stats.tiles = this.tiles.size; this.stats.mb = this.bytes / 1048576;
    }
    request(L, tx, tz, d) {
      const g = this.g, key = this.key(L, tx, tz), S = tileSize(L);
      const t = { L, tx, tz, S, x0: tx * S, z0: tz * S, state: 0, used: this.frame, empty: false };
      this.tiles.set(key, t);
      this.inflight++;
      // stale when nobody has wanted it for a while (the camera moved on) or the world changed
      const cancel = () => this.tiles.get(key) !== t || this.frame - t.used > 45;
      g.pool.submit({ type: 'lod', dim: 'overworld', level: L, tx, tz, lane: 1, cancel }, null, (m) => {
        this.inflight = Math.max(0, this.inflight - 1);
        if (this.tiles.get(key) !== t) return;
        if (m.type === 'cancelled') { this.tiles.delete(key); return; }
        if (m.type !== 'lod') { t.state = 2; t.failedAt = this.frame; return; }
        if (m.empty) { t.state = 1; t.empty = true; return; }
        // (F-Far) with ring 1 on, the tile goes up within the frame's upload budget (the world's queue), like every ring
        const w = g.world;
        if (this.farOn() && w && w.uploadQ && !t.queued) { t.queued = true; w.uploadQ.push({ key: null, col: undefined, x: t.x0 + S / 2, z: t.z0 + S / 2, bytes: m.verts.byteLength + m.idx.byteLength, run: () => { if (this.tiles.get(key) === t && !t.vao) this.put(t, m, S); } }); return; }
        this.put(t, m, S);
      }, d / S - L * 0.6);
    }
    // (F-Far) the tiles whose mesh waited in a world's upload queue that is gone: asked for again; ring 1 likewise
    dropQueued() {
      for (const [k, t] of this.tiles) if (t.queued && !t.vao) this.tiles.delete(k);
      if (this.far) this.far.dropQueued();
    }
    // a tile's mesh onto the GPU (at once, or from the upload queue while ring 1 is on)
    put(t, m, S) {
      const g = this.g, gl = g.renderer.gl;
      t.vao = gl.createVertexArray(); t.vbo = gl.createBuffer(); t.ibo = gl.createBuffer();
      gl.bindVertexArray(t.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, t.vbo); gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(m.verts), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.SHORT, false, 12, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribIPointer(1, 2, gl.UNSIGNED_BYTE, 12, 6);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, 12, 8);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, t.ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, m.idx, gl.STATIC_DRAW);
      gl.bindVertexArray(null);
      t.count = m.count; t.type = m.big ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT; t.minY = m.minY; t.maxY = m.maxY;
      t.bx0 = m.bx0 !== undefined ? m.bx0 : 0; t.bz0 = m.bz0 !== undefined ? m.bz0 : 0; t.bx1 = m.bx1 !== undefined ? m.bx1 : S; t.bz1 = m.bz1 !== undefined ? m.bz1 : S;
      t.bytes = m.verts.byteLength + m.idx.byteLength; this.bytes += t.bytes;
      t.state = 1;
    }
    // chunk sections that are really drawn → the far tiles are cut there. Each texel holds its chunk column's fade
    // (0..255; 255 = whole, 0 = not drawn): the cut follows the same dither thresholds as the chunk's fade-in (shaders.js
    // LOD_FS). The texel is set only for a column with a drawable section in the renderer's visible list — the list the
    // frame draws (collectVisible is cached by the camera's section, so this call costs the render nothing). A column that
    // is shown but whose sections the renderer culls (no line of sight) keeps its far tile, so no hole can open.
    // Rebuilt every frame: the list changes with the camera's section and with every upload.
    updateMask(cam) {
      const w = this.g.world, r = this.g.renderer, gl = r.gl;
      const ccx = Math.floor(cam.x) >> 4, ccz = Math.floor(cam.z) >> 4;
      const m = this.mask; m.fill(0);
      const list = w ? r.collectVisible(w, cam) : [];
      for (const s of list) {
        if (!s.hasMesh || !(s.fade > 0)) continue;
        const dx = (s.ox >> 4) - ccx, dz = (s.oz >> 4) - ccz;
        if (dx < -32 || dz < -32 || dx > 31 || dz > 31) continue;
        m[(dz + 32) * 64 + dx + 32] = Math.round(255 * s.fade);
      }
      gl.bindTexture(gl.TEXTURE_2D, this.maskTex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 64, 64, gl.RED, gl.UNSIGNED_BYTE, m);
    }
    // F-Far: the far mask while ring 1 is on — 136 x 136 columns around the camera's (ring 0 reaches 32 chunks on Ultra,
    // ring 1 64): maskF = the chunks' fades (rebuilt every frame from the renderer's visible list, as updateMask),
    // maskTex1 = the forms' fades (farring.js writes them when they change)
    updateMaskFar(cam) {
      const w = this.g.world, r = this.g.renderer, gl = r.gl, N = VR.FarRing.MASK_N, H = N >> 1;
      if (!this.maskF) {
        this.maskF = new Uint8Array(N * N);
        this.maskTexF = VR.GL.tex2D(N, N, gl.R8, gl.RED, gl.UNSIGNED_BYTE, { data: this.maskF, filter: gl.LINEAR });
        this.maskTex1 = VR.GL.tex2D(N, N, gl.R8, gl.RED, gl.UNSIGNED_BYTE, { data: this.far.maskG, filter: gl.LINEAR });
      }
      const ccx = Math.floor(cam.x) >> 4, ccz = Math.floor(cam.z) >> 4;
      const m = this.maskF; m.fill(0);
      const list = w ? r.collectVisible(w, cam) : [];
      for (let i = 0; i < list.length; i++) {
        const s = list[i];
        if (!s.hasMesh || !(s.fade > 0)) continue;
        const dx = (s.ox >> 4) - ccx, dz = (s.oz >> 4) - ccz;
        if (dx < -H || dz < -H || dx >= H || dz >= H) continue;
        m[(dz + H) * N + dx + H] = Math.round(255 * s.fade);
      }
      gl.bindTexture(gl.TEXTURE_2D, this.maskTexF);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, N, N, gl.RED, gl.UNSIGNED_BYTE, m);
      if (this.far.maskUp) { gl.bindTexture(gl.TEXTURE_2D, this.maskTex1); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, N, N, gl.RED, gl.UNSIGNED_BYTE, this.far.maskG); this.far.maskUp = false; }
    }
    // ---------------------------------------------------------------- drawing (after the opaque terrain)
    draw(r, E) {
      // F-Far: ring 1 first (not in the water's mirror: the mirror shows the horizon tiles there instead)
      const far1 = this.farOn() && this.maskF, refl = !!(r.viewProjR && r.viewProj === r.viewProjR);
      if (far1 && !refl) this.far.draw(r, E, this.maskTexF, this.maskTex1);
      const list = this.drawList; if (!list.length) { this.stats.drawn = 0; return; }
      const gl = r.gl, p = (far1 && r.farProgram('lodFar')) || r.P.lod, cam = r.cam;
      gl.useProgram(p.p); r.common(p, E);
      gl.uniformMatrix4fv(p.u.u_viewProj, false, r.viewProj);
      gl.uniform3f(p.u.u_camFrac, r.camFrac[0], r.camFrac[1], r.camFrac[2]);
      gl.uniform3i(p.u.u_camInt, r.camInt[0], r.camInt[1], r.camInt[2]);
      if (p.u.u_emissiveBoost) gl.uniform1f(p.u.u_emissiveBoost, E.emissiveBoost);
      // coarse cells stay out of the player's immediate surroundings — unless nothing real is there yet (a long jump,
      // a flight outrunning the loader): then the horizon fills the view right down to the ground
      const w = this.g.world, rd = (w && w.renderDist) || 8;
      const near = Math.max(24, Math.min(80, rd * 8)), R = Math.ceil(near / 16);
      // (F8) inside `near` blocks of the eye the far tiles give way to the chunks, so every column there must be drawn whole:
      // the mask says 255 only for a column whose sections are in the frame's list and fully faded in (a column still
      // waiting for its upload, dissolving in, or culled would leave a hole around the eye)
      const ccx = Math.floor(cam.x) >> 4, ccz = Math.floor(cam.z) >> 4;
      let under = !!w;
      if (far1 && p !== r.P.lod) {
        const N = VR.FarRing.MASK_N, H = N >> 1;
        for (let dz = -R; dz <= R && under; dz++) for (let dx = -R; dx <= R && under; dx++) if (this.maskF[(dz + H) * N + dx + H] !== 255) under = false;
        gl.uniform1f(p.u.u_lodNear, under ? near : 4);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.maskTexF); gl.uniform1i(p.u.u_mask, 0);
        gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.maskTex1); gl.uniform1i(p.u.u_mask1, 2);
        gl.uniform1f(p.u.u_g1, refl ? 0 : 1);
      } else {
        for (let dz = -R; dz <= R && under; dz++) for (let dx = -R; dx <= R && under; dx++) if (this.mask[(dz + 32) * 64 + dx + 32] !== 255) under = false;
        gl.uniform1f(p.u.u_lodNear, under ? near : 4);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.maskTex); gl.uniform1i(p.u.u_mask, 0);
      }
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, r.texNoise); gl.uniform1i(p.u.u_noise, 1);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); gl.enable(gl.CULL_FACE);
      let n = 0, tris = 0;
      for (const t of list) {
        const ox = t.x0 - cam.x, oz = t.z0 - cam.z;
        if (!mat4.boxInFrustum(r.planes, ox + t.bx0, t.minY - cam.y, oz + t.bz0, ox + t.bx1, t.maxY - cam.y, oz + t.bz1)) continue;
        gl.uniform3f(p.u.u_tileOrigin, ox, -cam.y, oz);
        gl.bindVertexArray(t.vao);
        gl.drawElements(gl.TRIANGLES, t.count, t.type, 0);
        n++; tris += t.count / 3;
      }
      gl.bindVertexArray(null);
      this.stats.drawn = n; this.stats.tris = tris;
      r.stats.draws += n; r.stats.tris += tris;
    }
    farPlane() { return this.enabled() ? this.radius + 400 : 0; }
    destroy() { this.reset(); }
  }
  VR.Horizon = Horizon;
})(VR);
