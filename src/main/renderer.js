// ============================================================================
// Renderer: arena-allocated section meshes, multi-draw, cave+frustum culling,
// shadow map, HDR scene, sky with cosmic layer, water refraction, clouds,
// particles, voxel models, decals, bloom / god rays / ACES / FXAA, dynamic res.
// ============================================================================
(function (VR) {
  'use strict';
  const GL = VR.GL, S = VR.SHADERS, mat4 = VR.mat4;
  const VSTRIDE = 16;

  // ----------------------------------------------------------------- arena allocator
  class Arena {
    constructor(gl, capVerts) {
      this.gl = gl; this.cap = capVerts;
      this.buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
      gl.bufferData(gl.ARRAY_BUFFER, capVerts * VSTRIDE, gl.DYNAMIC_DRAW);
      this.vao = gl.createVertexArray();
      gl.bindVertexArray(this.vao);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.UNSIGNED_SHORT, false, 16, 0);
      for (let i = 1; i <= 5; i++) { gl.enableVertexAttribArray(i); gl.vertexAttribIPointer(i, 1, gl.UNSIGNED_SHORT, 16, 4 + i * 2); }
      gl.bindVertexArray(null);
      this.free = [[0, capVerts]];
      this.used = 0;
    }
    alloc(n) {
      const f = this.free;
      for (let i = 0; i < f.length; i++) {
        const b = f[i];
        if (b[1] >= n) {
          const off = b[0];
          if (b[1] === n) f.splice(i, 1); else { b[0] += n; b[1] -= n; }
          this.used += n;
          return off;
        }
      }
      return -1;
    }
    release(off, n) {
      const f = this.free;
      this.used -= n;
      let lo = 0, hi = f.length;
      while (lo < hi) { const m = (lo + hi) >> 1; if (f[m][0] < off) lo = m + 1; else hi = m; }
      f.splice(lo, 0, [off, n]);
      // coalesce with next / prev
      if (lo + 1 < f.length && f[lo][0] + f[lo][1] === f[lo + 1][0]) { f[lo][1] += f[lo + 1][1]; f.splice(lo + 1, 1); }
      if (lo > 0 && f[lo - 1][0] + f[lo - 1][1] === f[lo][0]) { f[lo - 1][1] += f[lo][1]; f.splice(lo, 1); }
    }
  }

  // ----------------------------------------------------------------- renderer
  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      const gl = this.gl = GL.init(canvas);
      if (!gl) throw new Error('WebGL2 is not available on this device/browser.');
      this.multi = !!GL.ext.multiDraw;
      this.hdr = !!(GL.ext.cbf || GL.ext.cbhf);
      this.arenas = [];
      this.arenaSize = 1 << 21; // 2M vertices = 32 MB
      this.proj = mat4.create(); this.view = mat4.create(); this.viewProj = mat4.create(); this.invViewProj = mat4.create();
      this.planes = new Float32Array(24);
      this.shadowPlanes = new Float32Array(24);
      this.shadowMat = mat4.create(); this.shadowBase = mat4.create(); this.shadowCam = [0, 0, 0];
      this.frameNo = 0;
      this.stats = { draws: 0, tris: 0, sections: 0, shadowDraws: 0, ms: 0 };
      this.q = { scale: 1, shadows: 2048, shadowDist: 64, bloom: true, rays: true, fxaa: true, clouds: 2, water: 2, bevel: 1, particles: 1, renderDist: 10, magic: 0.8 };
      this.visList = []; this.visDirty = true; this.visKey = '';
      this.firsts = new Int32Array(512); this.counts = new Int32Array(512); this.origins = new Float32Array(512 * 4);
      this.tmpM = mat4.create(); this.tmpM2 = mat4.create();
      this.prof = null;   // pass profiling (test/light.mjs sets {}): the time of each pass, GPU work included
    }
    // profiling: the pass named by the previous mark ends here (gl.finish() makes its GPU work part of the time)
    mark(name) {
      const P = this.prof; if (!P) return;
      this.gl.finish();
      const t = performance.now();
      if (P.cur) P[P.cur] = (P[P.cur] || 0) + (t - P.t);
      P.cur = name; P.t = t;
    }

    // ------------------------------------------------ setup
    init(tex) {
      const gl = this.gl;
      this.layers = tex.layers;
      // texture arrays
      const mk = (levels, srgb) => {
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
        gl.texStorage3D(gl.TEXTURE_2D_ARRAY, tex.levels, srgb ? gl.SRGB8_ALPHA8 : gl.RGBA8, tex.size, tex.size, tex.layers);
        for (let lv = 0; lv < tex.levels; lv++) { const n = tex.size >> lv; gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, lv, 0, 0, 0, n, n, tex.layers, gl.RGBA, gl.UNSIGNED_BYTE, levels[lv]); }
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
        return t;
      };
      this.texAlbedo = mk(tex.albedo, true);
      this.texMaterial = mk(tex.material);
      this.setAniso(4);
      // noise
      this.texNoise = GL.tex2D(256, 256, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, { data: tex.noise, wrap: gl.REPEAT, filter: gl.LINEAR });
      // the average luminance per texture layer (64 × 64, R32F) for recoloured blocks (B1 „🎨 Aussehen", looks.js) —
      // filled by the game for the layers a look uses; never part of the cached textures
      this.texAvgLum = GL.tex2D(64, 64, gl.R32F, gl.RED, gl.FLOAT, { data: new Float32Array(4096).fill(0.5), filter: gl.NEAREST });
      // height texture for precipitation occlusion (128x128 R8)
      this.heightData = new Uint8Array(128 * 128);
      this.texHeights = GL.tex2D(128, 128, gl.R8, gl.RED, gl.UNSIGNED_BYTE, { data: this.heightData, filter: gl.NEAREST });
      // F1: the sky table (Very Low; rebuilt by updateAtmo) and the exposure (1×1, ping-pong; float targets when the device has them)
      this.atmoTex = GL.tex2D(64, 32, gl.RGBA16F, gl.RGBA, gl.FLOAT, { data: new Float32Array(64 * 32 * 4), filter: gl.LINEAR, wrap: gl.CLAMP_TO_EDGE });
      this.atmoKey = null;
      this.expTex = [0, 1].map(() => GL.tex2D(1, 1, gl.RGBA16F, gl.RGBA, gl.FLOAT, { data: new Float32Array([1, 1, 1, 1]), filter: gl.NEAREST, wrap: gl.CLAMP_TO_EDGE }));
      this.expFB = this.hdr ? this.expTex.map((t) => GL.fbo([t])) : [null, null];
      this.expOK = !!(this.expFB[0] && this.expFB[1]);
      this.expCur = 0;
      this.buildPrograms();
      this.buildStatic();
      this.initPuffs();
      // origins UBO
      if (this.multi) {
        this.ubo = gl.createBuffer();
        gl.bindBuffer(gl.UNIFORM_BUFFER, this.ubo);
        gl.bufferData(gl.UNIFORM_BUFFER, 512 * 16, gl.DYNAMIC_DRAW);
        gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, this.ubo);
      }
      this.emptyVAO = gl.createVertexArray();
      this.resize(true);
    }
    setAvgLum(table) {
      const gl = this.gl; if (!this.texAvgLum || !table) return;
      gl.bindTexture(gl.TEXTURE_2D, this.texAvgLum);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 64, 64, gl.RED, gl.FLOAT, table);
    }
    setAniso(level) {
      const gl = this.gl, ext = GL.ext.aniso;
      if (!ext) return;
      const mx = gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
      for (const t of [this.texAlbedo, this.texMaterial]) { gl.bindTexture(gl.TEXTURE_2D_ARRAY, t); gl.texParameterf(gl.TEXTURE_2D_ARRAY, ext.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(mx, level)); }
    }
    buildPrograms() {
      const md = this.multi ? ['MULTIDRAW'] : [];
      // F1: shadow tiers (SHQ2 = 3×3 PCF on balanced, SHQ3 = a rotated 16-tap disc on high and ultra, else one hard tap)
      // and the sky table on Very Low (ATMO_LUT: the sky formula baked into a 64×32 texture)
      const sq = this.q.shadowQ | 0, atmo = this.q.atmoLUT ? ['ATMO_LUT'] : [];
      const sh = (this.q.shadows ? ['SHADOWS'] : []).concat(this.q.hshadow ? ['HSHADOW'] : []).concat(this.q.lite ? ['LITE'] : []).concat(sq === 3 ? ['SHQ3'] : sq === 2 ? ['SHQ2'] : []).concat(atmo);   // LITE: flat materials, no normal map / specular / macro noise (very low PCs)
      const P = this.P = {};
      const bindUBO = (p) => { if (this.multi) { const gl = this.gl; const bi = gl.getUniformBlockIndex(p.p, 'Origins'); if (bi !== 0xffffffff && bi !== -1) gl.uniformBlockBinding(p.p, bi, 0); } return p; };
      // FADE: the chunk terrain programs dither a column's sections in over 300 ms (the ship programs stay whole)
      P.opaque = bindUBO(GL.program(S.TERRAIN_VS, S.TERRAIN_FS, 'terrain', [...md, ...sh, 'FADE']));
      P.cutout = bindUBO(GL.program(S.TERRAIN_VS, S.TERRAIN_FS, 'terrainCut', [...md, ...sh, 'CUTOUT', 'FADE']));
      P.trans = bindUBO(GL.program(S.TERRAIN_VS, S.TRANS_FS, 'trans', [...md, ...sh, 'FADE']));
      P.shipOpaque = GL.program(S.TERRAIN_VS, S.TERRAIN_FS, 'shipOpaque', [...sh, 'MODEL']);
      P.shipCutout = GL.program(S.TERRAIN_VS, S.TERRAIN_FS, 'shipCutout', [...sh, 'MODEL', 'CUTOUT']);
      P.shipTrans = GL.program(S.TERRAIN_VS, S.TRANS_FS, 'shipTrans', [...sh, 'MODEL']);
      P.shadow = bindUBO(GL.program(S.SHADOW_VS, S.SHADOW_FS, 'shadow', [...md]));
      P.shadowCut = bindUBO(GL.program(S.SHADOW_VS, S.SHADOW_FS, 'shadowCut', [...md, 'CUTOUT']));
      P.sky = GL.program(S.SKY_VS, S.SKY_FS, 'sky', atmo.concat(this.q.lite ? ['LITE'] : []));   // LITE: two-octave nebula, no dust (Very Low)
      P.expose = GL.program(S.FS_VS, S.EXPOSE_FS, 'expose');
      P.cloud = GL.program(S.CLOUD_VS, S.CLOUD_FS, 'cloud');
      P.puff = GL.program(S.PUFF_VS, S.PUFF_FS, 'puff');   // t-clouds: cumulus, fog banks, anchors (balanced and above)
      P.bloomPre = GL.program(S.FS_VS, S.BLOOM_PRE_FS, 'bloomPre');
      P.down = GL.program(S.FS_VS, S.DOWN_FS, 'down');
      P.up = GL.program(S.FS_VS, S.UP_FS, 'up');
      P.rays = GL.program(S.FS_VS, S.RAYS_FS, 'rays');
      P.composite = GL.program(S.FS_VS, S.COMPOSITE_FS, 'composite');
      P.fxaa = GL.program(S.FS_VS, S.FXAA_FS, 'fxaa');
      P.tsr = GL.program(S.FS_VS, S.TSR_FS, 'tsr');
      P.copy = GL.program(S.FS_VS, S.COPY_FS, 'copy');
      P.mesh = GL.program(S.MESH_VS, S.MESH_FS, 'mesh');
      P.vox = GL.program(S.VOX_VS, S.VOX_FS, 'vox');
      P.part = GL.program(S.PART_VS, S.PART_FS, 'part');
      P.line = GL.program(S.LINE_VS, S.LINE_FS, 'line');
      P.rain = GL.program(S.RAIN_VS, S.RAIN_FS, 'rain');
      P.decal = GL.program(S.DECAL_VS, S.DECAL_FS, 'decal');
      P.lod = GL.program(S.LOD_VS, S.LOD_FS, 'lod');
    }
    rebuildShadowPrograms() { this.buildPrograms(); }

    // ------------------------------------------------ heightmap shadows (see hShadow in the shaders)
    ensureHmap() {
      if (this.hmapTex) return;
      const gl = this.gl;
      this.hmapTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.hmapTex);
      gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RG8, 1024, 1024);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 1024, 1024, gl.RG, gl.UNSIGNED_BYTE, new Uint8Array(1024 * 1024 * 2));
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
      this.hmapOwner = new Map(); this.hmapZero = new Uint8Array(512); this.hTop = 0; this.hmapWorld = null;
    }
    // stream changed columns into the texture (a 16×16 patch each); texel = world x,z & 1023
    updateHmap(world) {
      if (!this.q.hshadow || !world) return;
      this.ensureHmap();
      const gl = this.gl;
      if (this.hmapWorld !== world) { // a new world: every slot is stale
        this.hmapWorld = world; this.hmapOwner.clear(); this.hTop = 0;
        for (const k of world.cols.keys()) world.shDirty.add(k);
        gl.bindTexture(gl.TEXTURE_2D, this.hmapTex); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 1024, 1024, gl.RG, gl.UNSIGNED_BYTE, new Uint8Array(1024 * 1024 * 2));
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
      }
      if (!world.shDirty.size && !world.shGone.size) return;
      gl.bindTexture(gl.TEXTURE_2D, this.hmapTex); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      let n = 0;
      const slot = (cx, cz) => (cx & 63) | ((cz & 63) << 6);
      for (const k of world.shGone) {
        world.shGone.delete(k);
        const cx = Math.floor(k / 65536) - 32768, cz = (k % 65536) - 32768, sl = slot(cx, cz);
        if (this.hmapOwner.get(sl) !== k) continue; // the slot already holds a newer column
        this.hmapOwner.delete(sl);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, (cx * 16) & 1023, (cz * 16) & 1023, 16, 16, gl.RG, gl.UNSIGNED_BYTE, this.hmapZero);
        if (++n >= 48) break;
      }
      let top = this.hTop;
      for (const k of world.shDirty) {
        world.shDirty.delete(k);
        const c = world.cols.get(k); if (!c || !c.ready) continue;
        gl.texSubImage2D(gl.TEXTURE_2D, 0, (c.cx * 16) & 1023, (c.cz * 16) & 1023, 16, 16, gl.RG, gl.UNSIGNED_BYTE, c.sh);
        this.hmapOwner.set(slot(c.cx, c.cz), k);
        let m = 0; for (let i = 0; i < 512; i += 2) if (c.sh[i] > m) m = c.sh[i];
        if (m > top) top = m;
        if (++n >= 96) break;
      }
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
      this.hTop = top; world.shTop = top;
    }

    buildStatic() {
      const gl = this.gl;
      // cloud cube (36 verts: corner + normal)
      const cube = [];
      const F = [[[1, 0, 0], [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 0], [1, 1, 1], [1, 0, 1]]], [[-1, 0, 0], [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 0, 0], [0, 1, 1], [0, 1, 0]]],
      [[0, 1, 0], [[0, 1, 0], [0, 1, 1], [1, 1, 1], [0, 1, 0], [1, 1, 1], [1, 1, 0]]], [[0, -1, 0], [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 0], [1, 0, 1], [0, 0, 1]]],
      [[0, 0, 1], [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 0, 1], [1, 1, 1], [0, 1, 1]]], [[0, 0, -1], [[0, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 0], [1, 1, 0], [1, 0, 0]]]];
      for (const [n, vs] of F) for (const v of vs) cube.push(v[0], v[1], v[2], n[0], n[1], n[2]);
      this.cloudVBO = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.cloudVBO); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(cube), gl.STATIC_DRAW);
      this.cloudInst = gl.createBuffer();
      this.cloudVAO = gl.createVertexArray(); gl.bindVertexArray(this.cloudVAO);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.cloudVBO);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.cloudInst);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 16, 0); gl.vertexAttribDivisor(2, 1);
      gl.bindVertexArray(null);
      this.cloudCount = 0; this.cloudKey = '';
      // particle quad + instance buffer
      this.partVBO = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.partVBO); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
      this.partInst = gl.createBuffer(); this.partCap = 4096; this.partData = new Float32Array(this.partCap * 14);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.partInst); gl.bufferData(gl.ARRAY_BUFFER, this.partData.byteLength, gl.DYNAMIC_DRAW);
      this.partVAO = gl.createVertexArray(); gl.bindVertexArray(this.partVAO);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.partVBO); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.partInst);
      const pst = 14 * 4;
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, pst, 0); gl.vertexAttribDivisor(1, 1);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, pst, 16); gl.vertexAttribDivisor(2, 1);
      gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, pst, 32); gl.vertexAttribDivisor(3, 1);
      gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 2, gl.FLOAT, false, pst, 48); gl.vertexAttribDivisor(4, 1);
      gl.bindVertexArray(null);
      // rain: seeds × quad
      const nR = 6000, seeds = new Float32Array(nR * 3);
      for (let i = 0; i < nR; i++) { seeds[i * 3] = Math.random(); seeds[i * 3 + 1] = Math.random(); seeds[i * 3 + 2] = Math.random(); }
      this.rainCount = nR;
      this.rainSeed = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.rainSeed); gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
      this.rainVAO = gl.createVertexArray(); gl.bindVertexArray(this.rainVAO);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.rainSeed); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0); gl.vertexAttribDivisor(0, 1);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.partVBO); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 8, 0);
      gl.bindVertexArray(null);
      // lines (outline box)
      this.lineVBO = gl.createBuffer(); this.lineVAO = gl.createVertexArray();
      gl.bindVertexArray(this.lineVAO); gl.bindBuffer(gl.ARRAY_BUFFER, this.lineVBO); gl.bufferData(gl.ARRAY_BUFFER, 4096 * 12, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
      gl.bindVertexArray(null);
      // decal quads (pos3 uv2)
      this.decalVBO = gl.createBuffer(); this.decalVAO = gl.createVertexArray();
      gl.bindVertexArray(this.decalVAO); gl.bindBuffer(gl.ARRAY_BUFFER, this.decalVBO); gl.bufferData(gl.ARRAY_BUFFER, 1024 * 20, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);
      gl.bindVertexArray(null);
    }

    // ------------------------------------------------ framebuffers
    resize(force) {
      const gl = this.gl;
      const dpr = Math.min(window.devicePixelRatio || 1, this.q.maxDpr || 1.5);
      const W = Math.max(2, Math.floor(this.canvas.clientWidth * dpr)), H = Math.max(2, Math.floor(this.canvas.clientHeight * dpr));
      const sc = this.q.scale;
      const w = Math.max(2, Math.floor(W * sc)), h = Math.max(2, Math.floor(H * sc));
      if (!force && W === this.W && H === this.H && w === this.w && h === this.h) return;
      // only touch the canvas when its size really changes: re-assigning width/height reallocates the drawing buffer
      if (this.canvas.width !== W) this.canvas.width = W;
      if (this.canvas.height !== H) this.canvas.height = H;
      this.W = W; this.H = H; this.w = w; this.h = h;
      const del = (k) => { if (this[k]) { if (this[k] instanceof WebGLFramebuffer) gl.deleteFramebuffer(this[k]); else gl.deleteTexture(this[k]); this[k] = null; } };
      for (const k of ['sceneFB', 'sceneCol', 'sceneDepth', 'copyFB', 'copyCol', 'copyDepth', 'ldrFB', 'ldrTex', 'raysFB', 'raysTex']) del(k);
      // the upscaler's history is kept at screen size: it survives changes of the internal resolution
      const outChanged = this.histW !== W || this.histH !== H || !this.q.tsr || force;
      if (outChanged) for (const k of ['histFB0', 'histTex0', 'histFB1', 'histTex1']) del(k);
      if (this.bloom) for (const b of this.bloom) { gl.deleteFramebuffer(b.fb); gl.deleteTexture(b.tex); }
      const cfmt = this.hdr ? gl.RGBA16F : gl.RGBA8, ctype = this.hdr ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;
      this.sceneCol = GL.tex2D(w, h, cfmt, gl.RGBA, ctype, {});
      this.sceneDepth = GL.tex2D(w, h, gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, { filter: gl.NEAREST });
      this.sceneFB = GL.fbo([this.sceneCol], this.sceneDepth);
      if (!this.sceneFB && this.hdr) { this.hdr = false; return this.resize(true); }
      this.copyCol = GL.tex2D(w, h, cfmt, gl.RGBA, ctype, {});
      this.copyDepth = GL.tex2D(w, h, gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, { filter: gl.NEAREST });
      this.copyFB = GL.fbo([this.copyCol], this.copyDepth);
      this.ldrTex = GL.tex2D(W, H, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, {});
      this.ldrFB = GL.fbo([this.ldrTex]);
      // R9 Super Resolution: two full-size history images, written in turn
      if (this.q.tsr && !this.histFB0) {
        this.histTex0 = GL.tex2D(W, H, cfmt, gl.RGBA, ctype, {}); this.histFB0 = GL.fbo([this.histTex0]);
        this.histTex1 = GL.tex2D(W, H, cfmt, gl.RGBA, ctype, {}); this.histFB1 = GL.fbo([this.histTex1]);
        if (!this.histFB0 || !this.histFB1) this.q.tsr = false;
        this.histW = W; this.histH = H; this.tsrReset = true;
      }
      // bloom chain (half res and below)
      this.bloom = [];
      let bw = Math.max(1, w >> 1), bh = Math.max(1, h >> 1);
      for (let i = 0; i < 5; i++) {
        const t = GL.tex2D(bw, bh, cfmt, gl.RGBA, ctype, {});
        this.bloom.push({ tex: t, fb: GL.fbo([t]), w: bw, h: bh });
        bw = Math.max(1, bw >> 1); bh = Math.max(1, bh >> 1);
      }
      const rw = Math.max(1, w >> 2), rh = Math.max(1, h >> 2);
      this.raysTex = GL.tex2D(rw, rh, cfmt, gl.RGBA, ctype, {}); this.raysFB = GL.fbo([this.raysTex]); this.raysW = rw; this.raysH = rh;
      this.ensureShadowMap();
    }
    ensureShadowMap() {
      const gl = this.gl, size = this.q.shadows;
      if (this.shadowSize === size) return;
      if (this.shadowFB) { gl.deleteFramebuffer(this.shadowFB); gl.deleteTexture(this.shadowTex); this.shadowFB = null; }
      this.shadowSize = size;
      if (!size) return;
      this.shadowTex = GL.tex2D(size, size, gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, { filter: gl.LINEAR, compare: true });
      this.shadowFB = GL.fbo([], this.shadowTex);
      if (!this.shadowFB) { this.shadowSize = 0; this.q.shadows = 0; }
    }
    setQuality(q) {
      this.qBase = Object.assign(this.qBase || {}, q);
      this.applyQ(true);
    }
    // R9 Smart Quality: the game lays temporary overrides (shadow cadence, ray/cloud/VX-detail cuts, a
    // small resolution step) over the chosen settings; the settings themselves stay untouched
    setOverride(o) {
      const prev = JSON.stringify(this.qOver || null), next = JSON.stringify(o || null);
      if (prev === next) return false;
      this.qOver = o ? Object.assign({}, o) : null;
      this.applyQ(false);
      return true;
    }
    applyQ(full) {
      const prevSh = !!this.q.shadows, prevH = !!this.q.hshadow, prevScale = this.q.scale, prevSize = this.q.shadows, prevLite = !!this.q.lite;
      const prevTier = (this.q.shadowQ | 0) * 2 + (this.q.atmoLUT ? 1 : 0);
      Object.assign(this.q, this.qBase || {}, this.qOver || {});
      if (!!this.q.shadows !== prevSh || !!this.q.hshadow !== prevH || !!this.q.lite !== prevLite || (this.q.shadowQ | 0) * 2 + (this.q.atmoLUT ? 1 : 0) !== prevTier) this.buildPrograms();
      this.shadowValid = false;
      if (full || this.q.shadows !== prevSize) this.ensureShadowMap();
      this.resize(full || this.q.scale !== prevScale);
    }
    // GPU frame time (EXT_disjoint_timer_query_webgl2): tells the smart-quality controller whether the GPU or
    // the main thread is the bottleneck; undefined when the browser does not expose it
    gpuTimerBegin() {
      const gl = this.gl, ext = this.gpuExt;
      if (ext === undefined) { this.gpuExt = gl.getExtension('EXT_disjoint_timer_query_webgl2') || null; this.gpuQ = []; this.gpuFree = []; return this.gpuTimerBegin(); }
      if (!ext || this.gpuActive) return;
      // read back finished queries (oldest first)
      while (this.gpuQ.length) {
        const q = this.gpuQ[0];
        const done = gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE);
        if (!done) break;
        this.gpuQ.shift();
        const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
        if (!disjoint) { const ns = gl.getQueryParameter(q, gl.QUERY_RESULT); const ms = ns / 1e6; if (ms > 0 && ms < 1000) this.gpuMs = this.gpuMs === undefined ? ms : this.gpuMs + (ms - this.gpuMs) * 0.1; }
        this.gpuFree.push(q);
      }
      if (this.gpuQ.length >= 4) return;   // never stall on results
      const q = this.gpuFree.pop() || gl.createQuery();
      gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
      this.gpuActive = q;
    }
    gpuTimerEnd() {
      if (!this.gpuActive) return;
      this.gl.endQuery(this.gpuExt.TIME_ELAPSED_EXT);
      this.gpuQ.push(this.gpuActive); this.gpuActive = null;
    }

    // ------------------------------------------------ section meshes
    allocMesh(n) {
      const gl = this.gl;
      const cap = Math.ceil(n / 96) * 96;
      for (const a of this.arenas) { const off = a.alloc(cap); if (off >= 0) return { arena: a, off, cap, count: n }; }
      const a = new Arena(gl, Math.max(this.arenaSize, cap));
      this.arenas.push(a);
      const off = a.alloc(cap);
      return { arena: a, off, cap, count: n };
    }
    uploadSection(sec, col, sy, opaque, cutout, trans, vx, vxFar) {
      const gl = this.gl;
      const data = [opaque, cutout, trans, vx, vxFar];
      if (sec.mesh.length < 5) sec.mesh.push(null, null);
      for (let l = 0; l < 5; l++) {
        if (sec.mesh[l]) { sec.mesh[l].arena.release(sec.mesh[l].off, sec.mesh[l].cap); sec.mesh[l] = null; }
        const d = data[l];
        const n = d ? d.length >> 3 : 0;
        if (l === 3) { sec.vxData = n ? d : null; sec.vxDropped = false; continue; }   // mini-voxel detail stays in RAM; vxResidency uploads it within the detail distance
        if (!n) continue;
        const m = this.allocMesh(n);
        gl.bindBuffer(gl.ARRAY_BUFFER, m.arena.buf);
        gl.bufferSubData(gl.ARRAY_BUFFER, m.off * VSTRIDE, d);
        sec.mesh[l] = m;
      }
      sec.hasMesh = !!(sec.mesh[0] || sec.mesh[1] || sec.mesh[2] || sec.vxData || sec.mesh[4]);
      sec.ox = col.cx * 16; sec.oy = sy * 16; sec.oz = col.cz * 16;
      this.visDirty = true;
      this.nearShadow(sec);
    }
    // a changed section inside the cached shadow map's area: redraw the map next frame
    nearShadow(sec) {
      const c = this.shadowCam; if (!c || this.shadowDirty) return;
      const R = (this.q.shadowDist || 64) + 24;
      if (Math.abs(sec.ox + 8 - c[0]) < R && Math.abs(sec.oz + 8 - c[2]) < R) this.shadowDirty = true;
    }
    freeSection(sec) {
      if (sec.hasMesh) this.nearShadow(sec);
      for (let l = 0; l < sec.mesh.length; l++) if (sec.mesh[l]) { sec.mesh[l].arena.release(sec.mesh[l].off, sec.mesh[l].cap); sec.mesh[l] = null; }
      sec.vxData = null;
      sec.hasMesh = false; sec.meshed = false;
      this.visDirty = true;
    }
    // VX detail residency: the detailed furniture/facade meshes live on the GPU only for sections inside the detail
    // distance (plus a hysteresis band); beyond it the averaged boxes draw and the data waits in RAM. A few uploads per
    // frame, nearest first, keep the hitches small; video memory stays bounded whatever the town size.
    vxResidency(list, camPos) {
      const D = this.q.vxLod || 48, up2 = D * D, down2 = (D * 1.35 + 8) * (D * 1.35 + 8);
      // the RAM copy is kept within a wider ring; beyond it the data is dropped and the section re-meshes when it comes back
      const keep = D * 1.5 + 16, keep2 = keep * keep, back2 = keep * 0.8 * keep * 0.8;
      let uploads = 0, best = null, bestD = 1e18;
      for (const s of list) {
        if (!s.vxData && !s.mesh[3]) { if (s.vxDropped) { const dx = s.ox + 8 - camPos[0], dy = s.oy + 8 - camPos[1], dz = s.oz + 8 - camPos[2]; if (dx * dx + dy * dy * 0.5 + dz * dz < back2) { s.vxDropped = false; s.dirty = true; } } continue; }
        const dx = s.ox + 8 - camPos[0], dy = s.oy + 8 - camPos[1], dz = s.oz + 8 - camPos[2], d2 = dx * dx + dy * dy * 0.5 + dz * dz;
        if (s.mesh[3]) { if (d2 > down2) { s.mesh[3].arena.release(s.mesh[3].off, s.mesh[3].cap); s.mesh[3] = null; } continue; }
        if (d2 > keep2) { s.vxData = null; s.vxDropped = true; continue; }
        if (d2 < up2) {
          if (uploads < 4) { this.uploadVx(s); uploads++; }
          else if (d2 < bestD) { best = s; bestD = d2; }
        }
      }
      if (best && uploads < 6) this.uploadVx(best);
    }
    uploadVx(s) {
      const gl = this.gl, d = s.vxData, n = d.length >> 3;
      const m = this.allocMesh(n);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.arena.buf);
      gl.bufferSubData(gl.ARRAY_BUFFER, m.off * VSTRIDE, d);
      s.mesh[3] = m;
      this.nearShadow(s);
    }
    gpuMemoryMB() { let u = 0; for (const a of this.arenas) u += a.used; return (u * VSTRIDE / 1048576); }

    // ------------------------------------------------ visibility (cave culling BFS + frustum)
    collectVisible(world, cam) {
      const rd = world.renderDist;
      const scx = Math.floor(cam.x) >> 4, scz = Math.floor(cam.z) >> 4;
      let scy = Math.floor(cam.y) >> 4;
      const topSec = (world.maxSec || 16) - 1;
      const outside = scy < 0 || scy > topSec;
      scy = Math.max(0, Math.min(topSec, scy));
      const key = scx + ',' + scy + ',' + scz + ',' + rd;
      if (!this.visDirty && !world.visDirty && key === this.visKey && this.frameNo % 20 !== 0) return this.visList;
      this.visKey = key; this.visDirty = false; world.visDirty = false;
      const list = this.visList; list.length = 0;
      const start = world.sectionAt(scx, scy, scz);
      const rd2 = (rd + 0.5) * (rd + 0.5);
      const cam0 = [cam.x, cam.y, cam.z];
      if (!start || outside || this.q.noCaveCull) {
        // fallback: all loaded sections in range
        for (const c of world.cols.values()) {
          const dx = c.cx - scx, dz = c.cz - scz;
          if (dx * dx + dz * dz > rd2) continue;
          for (let sy = 0; sy < c.sec.length; sy++) { const s = c.sec[sy]; if (s.hasMesh) list.push(s); }
        }
        list.sort((a, b) => ((a.ox - cam0[0]) ** 2 + (a.oy - cam0[1]) ** 2 + (a.oz - cam0[2]) ** 2) - ((b.ox - cam0[0]) ** 2 + (b.oy - cam0[1]) ** 2 + (b.oz - cam0[2]) ** 2));
        return list;
      }
      // the flood through the sections: a byte per section of the (2rd+3)² × (topSec+1) box around the camera says
      // "seen", the columns of that box are looked up once each, the queue is a reused Int32Array (5 ints per entry).
      // (A Set of big numbers and a growing array for the same walk cost 3 ms a frame at render distance 10 — and the
      // walk runs every frame while sections arrive.)
      const W = 2 * rd + 3, NS = topSec + 1, cells = W * W;
      const need = cells * NS, needQ = need * 5;
      if (!this.visSeen || this.visSeen.length < need) { this.visSeen = new Uint8Array(need); this.visQ = new Int32Array(needQ); this.visCols = new Array(cells); this.visColSeen = new Uint8Array(cells); }
      const seen = this.visSeen, q = this.visQ, colsAt = this.visCols, colSeen = this.visColSeen;
      seen.fill(0, 0, need); colSeen.fill(0, 0, cells);
      const colOf = (cx, cz) => {
        const ci = (cz - scz + rd + 1) * W + (cx - scx + rd + 1);
        if (!colSeen[ci]) { colSeen[ci] = 1; colsAt[ci] = world.col(cx, cz); }
        return colsAt[ci];
      };
      let qt = 0, qh = 0;
      // the start
      seen[(scy * W + rd + 1) * W + rd + 1] = 1;
      q[0] = scx; q[1] = scy; q[2] = scz; q[3] = -1; q[4] = 0; qt = 5;
      const DXs = VR.DX, DYs = VR.DY, DZs = VR.DZ, OPP = VR.OPP;
      while (qh < qt) {
        const cx = q[qh], sy = q[qh + 1], cz = q[qh + 2], from = q[qh + 3], mask = q[qh + 4]; qh += 5;
        const c = colOf(cx, cz);
        const s = c && sy < c.sec.length ? c.sec[sy] : null;
        if (!s) continue;
        if (s.hasMesh) list.push(s);
        const vis = s.meshed ? s.vis : 0x7fff;
        for (let d = 0; d < 6; d++) {
          if (mask & (1 << OPP[d])) continue; // never walk back toward the camera
          if (from >= 0 && from !== d && !(vis & (1 << VR.visPair(Math.min(from, d), Math.max(from, d))))) continue;
          const nx = cx + DXs[d], ny = sy + DYs[d], nz = cz + DZs[d];
          if (ny < 0 || ny > topSec) continue;
          const dx = nx - scx, dz = nz - scz;
          if (dx * dx + dz * dz > rd2) continue;
          const si = (ny * W + dz + rd + 1) * W + dx + rd + 1;
          if (seen[si]) continue;
          seen[si] = 1;
          q[qt] = nx; q[qt + 1] = ny; q[qt + 2] = nz; q[qt + 3] = OPP[d]; q[qt + 4] = mask | (1 << d); qt += 5;
        }
      }
      for (let i = 0; i < cells; i++) colsAt[i] = null;   // no column kept alive by the cache
      return list;
    }

    // ------------------------------------------------ camera
    setupCamera(cam) {
      const aspect = this.W / this.H;
      mat4.perspective(this.proj, cam.fov, aspect, 0.06, cam.far || 1200);
      const v = this.view;
      // the upscaler only runs when the scene really is rendered below screen size; at 100 % the picture stays native (+ FXAA)
      const tsr = !!(this.q.tsr && this.histFB0 && this.w < this.W - 2);
      const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
      // forward vector
      const fx = -sy * cp, fyy = sp, fz = -cy * cp;
      mat4.lookAt(v, 0, 0, 0, fx, fyy, fz, 0, 1, 0);
      if (cam.roll) { mat4.rotZ(this.tmpM, mat4.create(), cam.roll); mat4.mul(v, this.tmpM, v); }
      if (!this.vpNJ) { this.vpNJ = mat4.create(); this.invVPNJ = mat4.create(); this.prevVP = mat4.create(); }
      mat4.mul(this.vpNJ, this.proj, v);
      mat4.invert(this.invVPNJ, this.vpNJ);
      this.jit = null;
      if (tsr) {
        // sub-pixel jitter (Halton 2,3 over 8 frames), in clip space of the low-res target
        const k = (this.frameNo % 8) + 1, hal = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
        const jx = (hal(k, 2) - 0.5) * 2 / this.w, jy = (hal(k, 3) - 0.5) * 2 / this.h;
        this.proj[8] += jx; this.proj[9] += jy;
        this.jit = [jx * 0.5, jy * 0.5];
      }
      mat4.mul(this.viewProj, this.proj, v);
      mat4.invert(this.invViewProj, this.viewProj);
      mat4.frustum(this.planes, this.viewProj);
      this.camFwd = [fx, fyy, fz];
      this.camRight = [cy, 0, -sy];
      const up = [this.camRight[1] * fz - this.camRight[2] * fyy, this.camRight[2] * fx - this.camRight[0] * fz, this.camRight[0] * fyy - this.camRight[1] * fx];
      this.camUp = up;
      this.camInt = [Math.floor(cam.x), Math.floor(cam.y), Math.floor(cam.z)];
      this.camFrac = [cam.x - this.camInt[0], cam.y - this.camInt[1], cam.z - this.camInt[2]];
      this.cam = cam;
    }

    // ------------------------------------------------ uniforms
    // ------------------------------------------------ sky and light (F1)
    // the sky state of this frame (atmos.js): the packed Perez numbers for the analytic sky, and on Very Low the 64×32
    // table, rebuilt when the sun has moved about half a degree, or the turbidity or the tint has changed
    updateAtmo(E) {
      const A = VR.Atmos, gl = this.gl, sun = E.sunDir;
      const T = E.skyT === undefined ? 2.5 : E.skyT, tint = E.skyTint || [1, 1, 1];
      const st = A.prepare(sun, { T, tint });
      this.atmoP = A.glParams(st);
      if (!this.q.atmoLUT || !this.atmoTex) return;
      const k = this.atmoKey;
      if (k && 1 - (k[0] * sun[0] + k[1] * sun[1] + k[2] * sun[2]) < 3.8e-5 && Math.abs(k[3] - T) < 0.02 && Math.abs(k[4] - tint[0]) + Math.abs(k[5] - tint[1]) + Math.abs(k[6] - tint[2]) < 0.002) return;
      gl.activeTexture(gl.TEXTURE7); gl.bindTexture(gl.TEXTURE_2D, this.atmoTex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, A.LUT_W, A.LUT_H, gl.RGBA, gl.FLOAT, A.buildLUT(st));
      this.atmoKey = [sun[0], sun[1], sun[2], T, tint[0], tint[1], tint[2]];
    }
    // the exposure (F1): this frame's log-average luminance of the scene, eased toward the middle grey (EXPOSE_FS, 1×1)
    updateExposure(E) {
      const gl = this.gl, p = this.P.expose, dst = 1 - this.expCur;
      gl.useProgram(p.p);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.expFB[dst]); gl.viewport(0, 0, 1, 1);
      this.tex(0, this.sceneCol, p.u.u_scene); this.tex(1, this.expTex[this.expCur], p.u.u_prev);
      gl.uniform1f(p.u.u_dt, Math.min(0.25, E.dt || 0.016));
      gl.uniform3f(p.u.u_expParams, 0.8, 1.35, 0.3);
      this.fs(p);
      this.expCur = dst;
    }

    common(p, E) {
      const gl = this.gl, u = p.u;
      const v3 = (n, a) => { if (u[n]) gl.uniform3f(u[n], a[0], a[1], a[2]); };
      v3('u_sunDir', E.sunDir); v3('u_moonDir', E.moonDir); v3('u_sunColor', E.sunColor); v3('u_moonColor', E.moonColor);
      v3('u_ambSky', E.ambSky); v3('u_skyZenith', E.zenith); v3('u_skyHorizon', E.horizon); v3('u_sunset', E.sunset);
      v3('u_fogColor', E.fogColor); v3('u_blockLightTint', E.blockTint); v3('u_planetDir', E.planetDir); v3('u_planet2Dir', E.planet2Dir); v3('u_ringNormal', E.ringNormal);
      if (u.u_fog) gl.uniform4f(u.u_fog, E.fog[0], E.fog[1], E.fog[2], E.fog[3]);
      if (u.u_rain) gl.uniform1f(u.u_rain, E.rain);
      if (u.u_wet) gl.uniform1f(u.u_wet, E.wet || 0);     // wet ground (weather.js via env): the terrain's top faces darken in the rain
      if (u.u_time) gl.uniform1f(u.u_time, E.time);
      if (u.u_night) gl.uniform1f(u.u_night, E.night);
      if (u.u_dim) gl.uniform1i(u.u_dim, E.dimId);
      if (u.u_skyMagic) gl.uniform1f(u.u_skyMagic, this.q.magic);
      // the sky bodies (skybodies.js): directions and angular radii of the giant, the blue planet and the four moons
      const B = E.bodies;
      if (B) {
        const v4 = (n, a) => { if (u[n]) gl.uniform4f(u[n], a[0], a[1], a[2], a[3]); };
        v4('u_giant', [B.giant[0], B.giant[1], B.giant[2], B.radius.giant]);
        v4('u_blue', [B.blue[0], B.blue[1], B.blue[2], B.radius.blue]);
        for (let mi = 0; mi < 4; mi++) v4('u_moon' + mi, B.moons[mi]);
      }
      // the block look (Klassisch v2): natural blocks shaded per block, normal maps turned with the tile, still water
      // and the far terrain per block
      if (u.u_blockVar) gl.uniform1f(u.u_blockVar, VR.LOOK && VR.LOOK.vary ? 1 : 0);
      // F1 sky and light: the packed sky (formula or table), the moon's phase, the cloud shadows on the ground
      if (this.atmoP) {
        if (u.u_skyPer) gl.uniform1fv(u.u_skyPer, this.atmoP.per);
        if (u.u_skyK) gl.uniform4f(u.u_skyK, this.atmoP.k[0], this.atmoP.k[1], this.atmoP.k[2], this.atmoP.k[3]);
        if (u.u_skyK2) gl.uniform2f(u.u_skyK2, this.atmoP.k2[0], this.atmoP.k2[1]);
        if (u.u_skyTint) gl.uniform3f(u.u_skyTint, this.atmoP.tint[0], this.atmoP.tint[1], this.atmoP.tint[2]);
      }
      if (u.u_atmoLUT && this.atmoTex) { gl.activeTexture(gl.TEXTURE7); gl.bindTexture(gl.TEXTURE_2D, this.atmoTex); gl.uniform1i(u.u_atmoLUT, 7); }
      if (u.u_moonPh) gl.uniform1f(u.u_moonPh, E.moonPh || 0);
      if (u.u_moonIllum) gl.uniform1f(u.u_moonIllum, E.moonIllum === undefined ? 1 : E.moonIllum);
      if (u.u_cloudSh) gl.uniform1f(u.u_cloudSh, this.q.cloudSh ? (E.cloudSh || 0) : 0);
    }
    bindTerrainTextures(p) {
      const gl = this.gl;
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.texAlbedo); if (p.u.u_albedo) gl.uniform1i(p.u.u_albedo, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.texMaterial); if (p.u.u_material) gl.uniform1i(p.u.u_material, 1);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.texNoise); if (p.u.u_noise) gl.uniform1i(p.u.u_noise, 2);
      if (p.u.u_avgLum && this.texAvgLum) { gl.activeTexture(gl.TEXTURE7); gl.bindTexture(gl.TEXTURE_2D, this.texAvgLum); gl.uniform1i(p.u.u_avgLum, 7); }
      if (p.u.u_shadowMap) { gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, this.shadowTex); gl.uniform1i(p.u.u_shadowMap, 3); }
      if (p.u.u_holoLayer) { if (this.holoLayer === undefined) this.holoLayer = (VR.R && VR.R.texIndex && VR.R.texIndex['vx_holo']) || 0; gl.uniform1f(p.u.u_holoLayer, this.holoLayer); }
      if (p.u.u_hmap && this.hmapTex) {
        gl.activeTexture(gl.TEXTURE6); gl.bindTexture(gl.TEXTURE_2D, this.hmapTex); gl.uniform1i(p.u.u_hmap, 6);
        gl.uniform4f(p.u.u_hsh, this.q.hshadowDist || 72, this.hTop || 255, 7, 0);
      }
    }

    // sections with mini-voxel pieces, split by distance: near ones draw the detailed VX mesh, far ones the LOD boxes
    splitVx(list, camPos, maxD) {
      const near = this._vxNear || (this._vxNear = []), far = this._vxFar || (this._vxFar = []);
      near.length = 0; far.length = 0;
      const D = Math.min(this.q.vxLod || 48, maxD || 1e9), D2 = D * D;
      for (const s of list) {
        if (!s.mesh[3] && !s.mesh[4]) continue;
        const dx = s.ox + 8 - camPos[0], dy = s.oy + 8 - camPos[1], dz = s.oz + 8 - camPos[2];
        if (dx * dx + dy * dy * 0.5 + dz * dz < D2) { if (s.mesh[3]) near.push(s); else far.push(s); } else { if (s.mesh[4]) far.push(s); else near.push(s); }
      }
      return { near, far };
    }
    // ------------------------------------------------ section drawing
    drawSections(list, layer, prog, originsFrom, planes, reverse) {
      const gl = this.gl, cam = this.cam;
      const n = list.length;
      let batchArena = null, cnt = 0;
      const firsts = this.firsts, counts = this.counts, org = this.origins;
      const flush = () => {
        if (!cnt) return;
        gl.bindVertexArray(batchArena.vao);
        if (this.multi) {
          gl.bindBuffer(gl.UNIFORM_BUFFER, this.ubo);
          gl.bufferSubData(gl.UNIFORM_BUFFER, 0, org, 0, cnt * 4);
          GL.ext.multiDraw.multiDrawArraysWEBGL(gl.TRIANGLES, firsts, 0, counts, 0, cnt);
        } else {
          for (let i = 0; i < cnt; i++) { gl.uniform3f(prog.u.u_origin, org[i * 4], org[i * 4 + 1], org[i * 4 + 2]); if (prog.u.u_fade) gl.uniform1f(prog.u.u_fade, org[i * 4 + 3]); gl.drawArrays(gl.TRIANGLES, firsts[i], counts[i]); }
        }
        this.stats.draws += this.multi ? 1 : cnt;
        cnt = 0;
      };
      for (let k = 0; k < n; k++) {
        const s = list[reverse ? n - 1 - k : k];
        const m = s.mesh[layer];
        if (!m) continue;
        // a chunk section in its fade-in (s.fade, 0..1) is dithered in by the terrain shader; one not shown yet (0) is
        // skipped: it is invisible and casts no shadow. Sections without a fade (ships, props) are whole.
        const fade = s.fade === undefined ? 1 : s.fade;
        if (fade <= 0) continue;
        const ox = s.ox - originsFrom[0], oy = s.oy - originsFrom[1], oz = s.oz - originsFrom[2];
        if (planes && !mat4.boxInFrustum(planes, ox, oy, oz, ox + 16, oy + 16, oz + 16)) continue;
        if (m.arena !== batchArena || cnt === 512) { flush(); batchArena = m.arena; }
        firsts[cnt] = m.off; counts[cnt] = m.count;
        org[cnt * 4] = ox; org[cnt * 4 + 1] = oy; org[cnt * 4 + 2] = oz; org[cnt * 4 + 3] = fade;
        cnt++;
        this.stats.tris += m.count / 3;
      }
      flush();
      void cam;
    }

    // ------------------------------------------------ shadows
    renderShadows(world, E) {
      const gl = this.gl;
      if (!this.q.shadows || !this.shadowFB) return false;
      const sunUp = E.sunDir[1] > 0.02;
      const L0 = sunUp ? E.sunDir : E.moonDir;
      if (L0[1] < 0.06) return false;
      // step the light angle (~0.25°) so shadow edges don't crawl/shimmer while the sun moves
      const qe = Math.round(Math.asin(Math.max(-1, Math.min(1, L0[1]))) / 0.0044) * 0.0044, qz = Math.round(Math.atan2(L0[2], L0[0]) / 0.0044) * 0.0044;
      const L = [Math.cos(qz) * Math.cos(qe), Math.sin(qe), Math.sin(qz) * Math.cos(qe)];
      const qa = qe * 1000 + qz;
      const cam = this.cam, R = this.q.shadowDist, size = this.shadowSize;
      // cached: the map is only redrawn when the sun stepped, the camera left the well-covered middle of
      // the map, or blocks nearby changed — most frames skip the whole shadow pass (render() slides the
      // kept map along with the camera)
      const key = qa.toFixed(4) + (sunUp ? 's' : 'm');
      const c0 = this.shadowCam;
      const moved = c0 ? Math.hypot(cam.x - c0[0], cam.z - c0[2]) + Math.abs(cam.y - c0[1]) * 0.5 : 1e9;
      if (this.shadowValid && key === this.shadowKey && moved < R * 0.18 && !this.shadowDirty && this.shadowFor === this.shadowSize) return true;
      this.shadowKey = key; this.shadowDirty = false; this.shadowFor = this.shadowSize;
      this.stats.shadowRenders = (this.stats.shadowRenders || 0) + 1;
      // light view (rotation only)
      const lv = this.tmpM;
      mat4.lookAt(lv, 0, 0, 0, -L[0], -L[1], -L[2], Math.abs(L[1]) > 0.99 ? 1 : 0, Math.abs(L[1]) > 0.99 ? 0 : 1, 0);
      // snap camera position in light space to texel grid
      const texel = (2 * R) / size;
      const wx = cam.x, wy = cam.y, wz = cam.z;
      const lx = lv[0] * wx + lv[4] * wy + lv[8] * wz, ly = lv[1] * wx + lv[5] * wy + lv[9] * wz, lz = lv[2] * wx + lv[6] * wy + lv[10] * wz;
      const sx = Math.floor(lx / texel) * texel, sy = Math.floor(ly / texel) * texel;
      const ox = lx - sx, oy = ly - sy;
      const pr = this.tmpM2;
      mat4.ortho(pr, -R, R, -R, R, -260, 260);
      // shadowMat = ortho * T(ox,oy,0) * lv   (applied to camera-relative positions)
      const t = mat4.create(); t[12] = ox; t[13] = oy; t[14] = 0;
      const m1 = mat4.create(); mat4.mul(m1, t, lv);
      mat4.mul(this.shadowMat, pr, m1);
      mat4.frustum(this.shadowPlanes, this.shadowMat);
      this.shadowBase.set(this.shadowMat); this.shadowCam = [cam.x, cam.y, cam.z];
      void lz;
      // gather casters around camera
      const list = this.shadowList || (this.shadowList = []);
      list.length = 0;
      const rs = Math.ceil(R / 16) + 1;
      const pcx = Math.floor(cam.x) >> 4, pcz = Math.floor(cam.z) >> 4;
      for (let dz = -rs; dz <= rs; dz++) for (let dx = -rs; dx <= rs; dx++) {
        const c = world.col(pcx + dx, pcz + dz); if (!c) continue;
        for (let s = 0; s < c.sec.length; s++) { const sec = c.sec[s]; if (sec.hasMesh && (sec.mesh[0] || sec.mesh[1] || sec.mesh[3] || sec.mesh[4])) list.push(sec); }
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFB);
      gl.viewport(0, 0, size, size);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true);
      gl.disable(gl.CULL_FACE);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1.6, 3.0);
      const camPos = [cam.x, cam.y, cam.z];
      const draws0 = this.stats.draws;
      const vxSplit = this.splitVx(list, camPos, 28);   // shadows of furniture detail only close by; boxes cast the rest
      for (const [p, layer] of [[this.P.shadow, 0], [this.P.shadowCut, 1]]) {
        gl.useProgram(p.p);
        gl.uniformMatrix4fv(p.u.u_viewProj, false, this.shadowMat);
        if (layer === 1) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.texAlbedo); gl.uniform1i(p.u.u_albedo, 0); }
        this.drawSections(list, layer, p, camPos, this.shadowPlanes, false);
        if (layer === 0) { this.drawSections(vxSplit.near, 3, p, camPos, this.shadowPlanes, false); this.drawSections(vxSplit.far, 4, p, camPos, this.shadowPlanes, false); }
      }
      gl.disable(gl.POLYGON_OFFSET_FILL);
      this.stats.shadowDraws = this.stats.draws - draws0;
      return true;
    }

    // ------------------------------------------------ clouds
    updateClouds(E, cam) {
      const cell = 12, R = (this.q.clouds >= 2 ? 44 : 30) + (this.q.horizon ? 20 : 0); // cells radius
      const wind = E.time * 0.9;
      const ocx = Math.floor((cam.x + wind) / cell), ocz = Math.floor(cam.z / cell);
      const cov = Math.round(E.cloudCover * 20) / 20;
      const key = ocx + ',' + ocz + ',' + cov.toFixed(2) + ',' + R;
      if (key !== this.cloudKey) {
        this.cloudKey = key;
        const inst = [];
        const nz = VR.cloudNoise || (VR.cloudNoise = new VR.Simplex(9173));
        const thr = 0.72 - cov * 0.36;
        // cumulus: every run of cloud cells is a flat base slab; where the cloud noise peaks, narrower and
        // taller boxes stack on top of it (instance w = yOffset·8 + thickness, in cells of 4 blocks)
        const push = (x0, z, len, yo, th) => inst.push(x0, z, len, yo * 8 + Math.min(7.9, th));
        for (let z = -R; z <= R; z++) {
          let run = 0, runStart = 0, ex = 0;
          for (let x = -R; x <= R + 1; x++) {
            let on = false, v = 0;
            if (x <= R && x * x + z * z <= R * R) {
              const gx = ocx + x, gz = ocz + z;
              v = (nz.n2(gx * 0.085, gz * 0.085) * 0.65 + nz.n2(gx * 0.27 + 50, gz * 0.27) * 0.35) * 0.5 + 0.5;
              on = v > thr;
            }
            if (on) { if (!run) { runStart = x; ex = 0; } run++; ex = Math.max(ex, v - thr); }
            else if (run) {
              const gz = ocz + z, alt = (gz * 7 + runStart * 13) & 1;
              push(runStart, z, run, 0, 1.2 + alt * 0.4);
              const puff = Math.min(1, ex / 0.14);
              if (run >= 3 && puff > 0.15) push(runStart + 1, z, run - 2, 1.2 + alt * 0.4, 0.8 + puff * 2.6);
              if (run >= 5 && puff > 0.45) push(runStart + 2, z, run - 4, 2.0 + alt * 0.4 + puff * 2.6, 0.6 + puff * 2.2);
              run = 0;
            }
          }
        }
        // front-to-back so that (with depth writes on) each pixel blends about one cloud face, not dozens
        const cxr = (cam.x + wind) / cell - ocx, czr = cam.z / cell - ocz, runs = [];
        for (let i = 0; i < inst.length; i += 4) { const mx = inst[i] + inst[i + 2] * 0.5, d = (mx - cxr) ** 2 + (inst[i + 1] + 0.5 - czr) ** 2 + Math.floor(inst[i + 3] / 8) * 0.3; runs.push([d, inst[i], inst[i + 1], inst[i + 2], inst[i + 3]]); }
        runs.sort((a, b) => a[0] - b[0]);
        inst.length = 0; for (const r of runs) inst.push(r[1], r[2], r[3], r[4]);
        const gl = this.gl;
        const data = new Float32Array(inst);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.cloudInst);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
        this.cloudCount = inst.length / 4;
        this.cloudCell = cell; this.cloudBase = [ocx, ocz]; this.cloudR = R * cell;
      }
      return { cell, wind };
    }
    drawClouds(E) {
      if (!this.q.clouds || E.dimId !== 0 && E.dimId !== 3) return;
      // balanced and above (t-clouds): the cumulus as sprites, the fog banks under the Sky Isles and the citadel's anchors
      if (this.q.clouds >= 2 && E.dimId === 0) { this.drawPuffs(E); return; }
      const gl = this.gl, cam = this.cam;
      const { cell, wind } = this.updateClouds(E, cam);
      if (!this.cloudCount) return;
      const p = this.P.cloud;
      gl.useProgram(p.p);
      this.common(p, E);
      gl.uniformMatrix4fv(p.u.u_viewProj, false, this.viewProj);
      const cloudY = E.dimId === 3 ? 60 : 250;   // above the Mountain Station's mast; the citadel spire tip pierces the deck
      const ox = this.cloudBase[0] * cell - wind - cam.x, oz = this.cloudBase[1] * cell - cam.z;
      gl.uniform3f(p.u.u_cloudOrigin, ox, cloudY - cam.y, oz);
      gl.uniform3f(p.u.u_cell, cell, 4, cell);
      gl.uniform1f(p.u.u_cloudAlpha, 0.86);
      if (p.u.u_cloudR) gl.uniform1f(p.u.u_cloudR, this.cloudR || 500);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.enable(gl.CULL_FACE);
      gl.depthMask(true); gl.depthFunc(gl.LESS);
      gl.bindVertexArray(this.cloudVAO);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 36, this.cloudCount);
      gl.depthFunc(gl.LEQUAL);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }

    // ------------------------------------------------ puffs (t-clouds, balanced and above): sprites, see clouds.js
    initPuffs() {
      const gl = this.gl;
      this.puffCorner = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.puffCorner);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
      // 0: the fog banks and anchors (world space), 1: the cumulus (cloud space, drawn at − wind)
      this.puffVAO = [0, 1].map(() => {
        const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.puffCorner); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 0); gl.vertexAttribDivisor(1, 1);
        gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 32, 16); gl.vertexAttribDivisor(2, 1);
        gl.bindVertexArray(null);
        return { vao, buf, n: 0 };
      });
      this.puffKey = ''; this.puffCount = 0;
    }
    updatePuffs(E, cam) {
      const cov = Math.round(E.cloudCover * 20) / 20, wind = E.time * 0.9, cell = VR.Clouds.CELL;
      const ocx = Math.floor((cam.x + wind) / cell), ocz = Math.floor(cam.z / cell);
      const key = ocx + ',' + ocz + ',' + cov.toFixed(2) + ',' + Math.floor(cam.x / 96) + ',' + Math.floor(cam.z / 96);
      if (key === this.puffKey) return;
      this.puffKey = key;
      const f = VR.Clouds.field(cam, wind, { cover: cov }), gl = this.gl;
      const lists = [VR.Clouds.pack(f.fog), VR.Clouds.pack(f.cumulus)];
      for (let i = 0; i < 2; i++) {
        const v = this.puffVAO[i];
        gl.bindBuffer(gl.ARRAY_BUFFER, v.buf); gl.bufferData(gl.ARRAY_BUFFER, lists[i], gl.DYNAMIC_DRAW);
        v.n = lists[i].length / VR.Clouds.SPRITE_FLOATS;
      }
    }
    drawPuffs(E) {
      const gl = this.gl, cam = this.cam;
      if (!this.cloudAtlas) this.cloudAtlas = GL.tex2D(256, 256, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, { data: VR.Clouds.atlas(), filter: gl.LINEAR });
      this.updatePuffs(E, cam);
      const p = this.P.puff, u = p.u;
      gl.useProgram(p.p); this.common(p, E);
      gl.uniformMatrix4fv(u.u_viewProj, false, this.viewProj);
      // the billboard axes of the game's camera (player.lookDir: yaw 0 looks along −z)
      const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
      const right = [cy, 0, -sy], up = [sy * sp, cp, cy * sp];
      gl.uniform3f(u.u_camRight, right[0], right[1], right[2]); gl.uniform3f(u.u_camUp, up[0], up[1], up[2]);
      const L = E.sunDir, lx = L[0] * right[0] + L[2] * right[2], ly = L[0] * up[0] + L[1] * up[1] + L[2] * up[2];
      const ll = Math.hypot(lx, ly) || 1, sk = Math.min(1, Math.max(0, (L[1] + 0.12) / 0.24));
      gl.uniform2f(u.u_sunScreen, lx / ll, ly / ll); gl.uniform1f(u.u_sunK, sk * sk * (3 - 2 * sk));
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.disable(gl.CULL_FACE); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(false);
      this.tex(0, this.cloudAtlas, u.u_cloudTex);
      const fog = this.puffVAO[0], cu = this.puffVAO[1];
      // the fade radius: the fog banks are fixed in the world (they reach 300 blocks from the islands), the cumulus fades at
      // the edge of its window (clouds.js RANGE cells), so no cloud pops in or out at the window's edge
      gl.uniform1f(u.u_fogK, 1); gl.uniform1f(u.u_cloudR, 640); gl.uniform3f(u.u_origin, -cam.x, -cam.y, -cam.z);
      if (fog.n) { gl.bindVertexArray(fog.vao); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, fog.n); }
      gl.uniform1f(u.u_fogK, 0); gl.uniform1f(u.u_cloudR, VR.Clouds.RANGE * VR.Clouds.CELL * 1.04);
      gl.uniform3f(u.u_origin, -E.time * 0.9 - cam.x, -cam.y, -cam.z);
      if (cu.n) { gl.bindVertexArray(cu.vao); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, cu.n); }
      this.puffCount = fog.n + cu.n;
      gl.bindVertexArray(null); gl.depthMask(true); gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE); gl.depthFunc(gl.LEQUAL);
    }

    // ------------------------------------------------ ships (block grids with a model matrix)
    uploadShip(sections) {
      const out = [];
      for (const sec of sections) {
        const o = { ox: sec.ox, oy: sec.oy, oz: sec.oz, mesh: [null, null, null] };
        this.uploadSection(o, { cx: 0, cz: 0 }, 0, sec.opaque, sec.cutout, sec.trans);
        o.ox = sec.ox; o.oy = sec.oy; o.oz = sec.oz;
        out.push(o);
      }
      return out;
    }
    freeShip(list) { for (const o of list) this.freeSection(o); }
    drawShip(ship, E, layerSet) {
      const gl = this.gl, cam = this.cam;
      const model = ship.modelMat, nm = ship.normalMat;
      const progs = layerSet === 'trans' ? [[this.P.shipTrans, 2]] : [[this.P.shipOpaque, 0], [this.P.shipCutout, 1]];
      for (const [p, layer] of progs) {
        gl.useProgram(p.p);
        this.common(p, E);
        this.bindTerrainTextures(p);
        if (layer === 2) { this.tex(4, this.copyCol, p.u.u_sceneColor); this.tex(5, this.copyDepth, p.u.u_sceneDepth); gl.uniform2f(p.u.u_screen, this.w, this.h); gl.uniform2f(p.u.u_nearFar, 0.06, cam.far || 1200); if (p.u.u_underwater) gl.uniform1f(p.u.u_underwater, 0); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); }
        gl.uniformMatrix4fv(p.u.u_viewProj, false, this.viewProj);
        gl.uniform3f(p.u.u_camFrac, this.camFrac[0], this.camFrac[1], this.camFrac[2]);
        gl.uniform3i(p.u.u_camInt, this.camInt[0], this.camInt[1], this.camInt[2]);
        gl.uniformMatrix4fv(p.u.u_model, false, model);
        gl.uniformMatrix3fv(p.u.u_normalMat, false, nm);
        if (p.u.u_wind) gl.uniform1f(p.u.u_wind, 0);
        if (p.u.u_emissiveBoost) gl.uniform1f(p.u.u_emissiveBoost, E.emissiveBoost);
        if (p.u.u_normalStrength) gl.uniform1f(p.u.u_normalStrength, 1);
        if (p.u.u_clipNear) gl.uniform1f(p.u.u_clipNear, ship.clipNear || 0);
        if (p.u.u_shadowMat) gl.uniformMatrix4fv(p.u.u_shadowMat, false, this.shadowMat);
        if (p.u.u_shadowTexel) gl.uniform1f(p.u.u_shadowTexel, 1 / (this.shadowSize || 1024));
        gl.disable(gl.CULL_FACE);
        for (const s of ship.gpu) {
          const m = s.mesh[layer]; if (!m) continue;
          gl.bindVertexArray(m.arena.vao);
          gl.uniform3f(p.u.u_origin, s.ox, s.oy, s.oz);
          gl.drawArrays(gl.TRIANGLES, m.off, m.count);
          this.stats.draws++;
        }
        gl.enable(gl.CULL_FACE);
        if (layer === 2) gl.disable(gl.BLEND);
      }
    }

    // ------------------------------------------------ fullscreen helpers
    fs(p) { const gl = this.gl; gl.bindVertexArray(this.emptyVAO); gl.drawArrays(gl.TRIANGLES, 0, 3); void p; if (this.prof) this.prof.fs = (this.prof.fs || 0) + 1; }
    tex(unit, t, loc) { const gl = this.gl; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); if (loc) gl.uniform1i(loc, unit); }

    // ------------------------------------------------ main frame
    // F: {cam, world, env E, entities, particles, outline, crack, hand, underwater, damage, portal, fps}
    render(F) {
      const gl = this.gl, E = F.env, world = F.world;
      const t0 = performance.now();
      this.frameNo++;
      this.updateAtmo(E);
      this.gpuTimerBegin();
      this.stats.draws = 0; this.stats.tris = 0; this.stats.guide = 0;
      this.resize(false);
      this.setupCamera(F.cam);
      const camPos = [F.cam.x, F.cam.y, F.cam.z];
      this.mark('cull');
      // visibility
      const vis = world ? this.collectVisible(world, F.cam) : [];
      this.stats.sections = vis.length;
      if (world) this.updateHmap(world);
      this.mark('shadow');
      // shadows
      const shadowOn = world && (this.frameNo % (this.q.shadowEvery || 1) === 0 || !this.shadowValid) ? this.renderShadows(world, E) : this.shadowValid;
      this.shadowValid = shadowOn;
      // a shadow map kept from an earlier frame was made around the old camera position: shift its matrix
      // by the camera movement so shadows stay glued to the world instead of flickering every other frame
      if (shadowOn) { const c0 = this.shadowCam, t = mat4.create(); t[12] = F.cam.x - c0[0]; t[13] = F.cam.y - c0[1]; t[14] = F.cam.z - c0[2]; mat4.mul(this.shadowMat, this.shadowBase, t); }
      // ---------------- scene
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFB);
      gl.viewport(0, 0, this.w, this.h);
      gl.depthMask(true);
      gl.clearColor(E.fogColor[0], E.fogColor[1], E.fogColor[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true);
      gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
      this.mark('terrain');
      // terrain opaque + cutout
      if (world) {
        for (const [p, layer] of [[this.P.opaque, 0], [this.P.cutout, 1]]) {
          gl.useProgram(p.p);
          this.common(p, E);
          this.bindTerrainTextures(p);
          gl.uniformMatrix4fv(p.u.u_viewProj, false, this.viewProj);
          gl.uniform3f(p.u.u_camFrac, this.camFrac[0], this.camFrac[1], this.camFrac[2]);
          gl.uniform3i(p.u.u_camInt, this.camInt[0], this.camInt[1], this.camInt[2]);
          if (p.u.u_wind) gl.uniform1f(p.u.u_wind, E.wind);
          if (p.u.u_emissiveBoost) gl.uniform1f(p.u.u_emissiveBoost, E.emissiveBoost);
          if (p.u.u_normalStrength) gl.uniform1f(p.u.u_normalStrength, this.q.normals === 0 ? 0 : 1);
          if (p.u.u_mipScale) gl.uniform1f(p.u.u_mipScale, this.jit && !this.q.lite ? Math.sqrt(Math.max(0.35, this.w / this.W)) : 1);   // lite: natural mips (cheaper texture reads on weak GPUs)
          if (p.u.u_shadowMat) gl.uniformMatrix4fv(p.u.u_shadowMat, false, this.shadowMat);
          if (p.u.u_shadowTexel) gl.uniform1f(p.u.u_shadowTexel, 1 / (this.shadowSize || 1024));
          if (layer === 1) gl.disable(gl.CULL_FACE);
          this.drawSections(vis, layer, p, camPos, this.planes, false);
          if (layer === 0) {
            // mini-voxel pieces: full detail up close, averaged boxes beyond the VX detail distance
            this.vxResidency(vis, camPos);
            const sp = this.splitVx(vis, camPos);
            this.drawSections(sp.near, 3, p, camPos, this.planes, false);
            this.drawSections(sp.far, 4, p, camPos, this.planes, false);
          }
          gl.enable(gl.CULL_FACE);
        }
      }
      this.mark('horizon');
      // far-terrain horizon (cut away where real chunks are drawn)
      if (F.horizon) F.horizon.draw(this, E);
      this.mark('objects');
      // voxel models & meshes
      if (F.drawOpaque) F.drawOpaque(this, E);
      // sky (F1): drawn after the land, at the far plane, so only the pixels nothing covers take the sky (early depth test)
      this.mark('sky');
      {
        gl.disable(gl.CULL_FACE); gl.depthMask(false);
        const p = this.P.sky; gl.useProgram(p.p); this.common(p, E);
        if (p.u.u_skyProbe) gl.uniform1f(p.u.u_skyProbe, this.skyProbe ? 1 : 0);   // test hook: the sky paints magenta for a hole check
        gl.uniformMatrix4fv(p.u.u_invViewProj, false, this.invViewProj);
        if (p.u.u_cirrus) gl.uniform1f(p.u.u_cirrus, this.q.clouds >= 2 ? 1 : 0);   // t-clouds: cirrus from balanced up
        this.fs(p);
        gl.depthMask(true); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
      }
      this.mark('copy');
      // ---------------- copy scene for refraction
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.sceneFB);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.copyFB);
      gl.blitFramebuffer(0, 0, this.w, this.h, 0, 0, this.w, this.h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
      gl.blitFramebuffer(0, 0, this.w, this.h, 0, 0, this.w, this.h, gl.DEPTH_BUFFER_BIT, gl.NEAREST);
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneFB);
      this.mark('clouds');
      // clouds (behind translucent terrain; depth tested)
      this.drawClouds(E);
      this.mark('trans');
      // translucent terrain
      if (world) {
        const p = this.P.trans;
        gl.useProgram(p.p);
        this.common(p, E);
        this.bindTerrainTextures(p);
        this.tex(4, this.copyCol, p.u.u_sceneColor);
        this.tex(5, this.copyDepth, p.u.u_sceneDepth);
        gl.uniform2f(p.u.u_screen, this.w, this.h);
        gl.uniform2f(p.u.u_nearFar, 0.06, F.cam.far || 1200);
        gl.uniformMatrix4fv(p.u.u_viewProj, false, this.viewProj);
        gl.uniform3f(p.u.u_camFrac, this.camFrac[0], this.camFrac[1], this.camFrac[2]);
        gl.uniform3i(p.u.u_camInt, this.camInt[0], this.camInt[1], this.camInt[2]);
        if (p.u.u_wind) gl.uniform1f(p.u.u_wind, E.wind);
        if (p.u.u_underwater) gl.uniform1f(p.u.u_underwater, F.underwater ? 1 : 0);
        if (p.u.u_shadowMat) gl.uniformMatrix4fv(p.u.u_shadowMat, false, this.shadowMat);
        if (p.u.u_shadowTexel) gl.uniform1f(p.u.u_shadowTexel, 1 / (this.shadowSize || 1024));
        gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.disable(gl.CULL_FACE);
        this.drawSections(vis, 2, p, camPos, this.planes, true);
        gl.disable(gl.BLEND);
        gl.enable(gl.CULL_FACE);
      }
      if (F.drawTranslucent) F.drawTranslucent(this, E);
      this.mark('fx');
      // precipitation
      if (F.precip && F.precip.amount > 0.01) this.drawPrecip(F, E);
      // particles
      if (F.particles && F.particles.count) this.drawParticles(F.particles, E);
      // selection outline + crack
      if (F.outline) this.drawOutline(F.outline);
      if (F.outlines) for (const o of F.outlines) this.drawOutline(o);
      if (F.guide) this.drawGuide(F.guide);
      if (F.crack) this.drawCrack(F.crack);
      this.mark('hand');
      // first-person hand (separate depth range)
      if (F.drawHand) { gl.clear(gl.DEPTH_BUFFER_BIT); F.drawHand(this, E); }
      this.mark('tsr');
      // ---------------- R9 Super Resolution
      this.upTex = null;
      if (this.jit) this.superRes(F);
      this.mark('post');
      // ---------------- post
      this.post(F, E);
      this.gpuTimerEnd();
      this.mark(null);
      this.stats.ms = performance.now() - t0;
    }

    drawPrecip(F, E) {
      const gl = this.gl, p = this.P.rain, cam = this.cam;
      gl.useProgram(p.p);
      gl.uniformMatrix4fv(p.u.u_viewProj, false, this.viewProj);
      gl.uniform3f(p.u.u_camPos, cam.x, cam.y, cam.z);
      if (p.u.u_camFrac) gl.uniform3f(p.u.u_camFrac, this.camFrac[0], this.camFrac[1], this.camFrac[2]);
      gl.uniform1f(p.u.u_time, E.time);
      gl.uniform1f(p.u.u_snow, F.precip.snow ? 1 : 0);
      gl.uniform3f(p.u.u_right, this.camRight[0], this.camRight[1], this.camRight[2]);
      gl.uniform3f(p.u.u_ambSky, E.ambSky[0], E.ambSky[1], E.ambSky[2]);
      // upload heights
      if (F.precip.heights) {
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.texHeights);
        // re-upload only when the height field was refreshed (a per-frame upload stalls some drivers)
        if (F.precip.dirty || this.precipOrigin !== F.precip.hx + ',' + F.precip.hz) { gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 128, 128, gl.RED, gl.UNSIGNED_BYTE, F.precip.heights); this.precipOrigin = F.precip.hx + ',' + F.precip.hz; }
        gl.uniform1i(p.u.u_heights, 0); gl.uniform2f(p.u.u_heightOrigin, F.precip.hox, F.precip.hoz);
      }
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.disable(gl.CULL_FACE);
      gl.bindVertexArray(this.rainVAO);
      // the drop budget of the Partikel setting (potato draws about a third of the drops; see game.js)
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, Math.floor(this.rainCount * Math.min(1, F.precip.amount) * (F.precip.budget || 1)));
      gl.depthMask(true); gl.disable(gl.BLEND);
    }
    drawParticles(P, E) {
      const gl = this.gl, p = this.P.part;
      const n = Math.min(P.count, this.partCap);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.partInst);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, P.data, 0, n * 14);
      gl.useProgram(p.p); this.common(p, E);
      gl.uniformMatrix4fv(p.u.u_viewProj, false, this.viewProj);
      gl.uniform3f(p.u.u_right, this.camRight[0], this.camRight[1], this.camRight[2]);
      gl.uniform3f(p.u.u_up, this.camUp[0], this.camUp[1], this.camUp[2]);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.texAlbedo); gl.uniform1i(p.u.u_albedo, 0);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.disable(gl.CULL_FACE);
      gl.bindVertexArray(this.partVAO);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, n);
      gl.depthMask(true); gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE);
    }
    drawOutline(o) {
      const gl = this.gl, p = this.P.line, cam = this.cam;
      const pts = [];
      for (const b of o.boxes) {
        const e = 0.002;
        const x0 = b[0] - e, y0 = b[1] - e, z0 = b[2] - e, x1 = b[3] + e, y1 = b[4] + e, z1 = b[5] + e;
        const c = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]];
        for (const [a, bb] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) pts.push(...c[a], ...c[bb]);
      }
      // (W2: plain segments too — the Bauhand's dashed lot and its footprint grid: x y z x y z …, from o.x o.y o.z)
      if (o.lines) { const n = o.lines.length - (o.lines.length % 6); for (let i = 0; i < n && pts.length < 4096 * 3; i++) pts.push(o.lines[i]); }
      if (pts.length > 4096 * 3) pts.length = 4096 * 3;
      gl.useProgram(p.p);
      gl.uniformMatrix4fv(p.u.u_viewProj, false, this.viewProj);
      gl.uniform3f(p.u.u_offset, o.x - cam.x, o.y - cam.y, o.z - cam.z);
      if (o.xray) gl.disable(gl.DEPTH_TEST);
      gl.uniform4f(p.u.u_color, o.color ? o.color[0] : 0.05, o.color ? o.color[1] : 0.05, o.color ? o.color[2] : 0.08, o.color ? o.color[3] : 0.75);
      gl.bindVertexArray(this.lineVAO);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lineVBO);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(pts));
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.drawArrays(gl.LINES, 0, pts.length / 3);
      gl.disable(gl.BLEND);
      if (o.xray) gl.enable(gl.DEPTH_TEST);
    }
    // 🪞 the mirror's axis (mirrorbuild.js): translucent triangles with the outline's line program, in a small buffer of
    // its own that is filled only when the mirror changes (G.ver) — per frame three draws, no upload, no allocation;
    // depth-tested (walls hide it), no depth writes (it never hides anything)
    drawGuide(G) {
      const gl = this.gl, p = this.P.line, cam = this.cam, parts = G.parts;
      if (!this.guideVBO) {
        this.guideVBO = gl.createBuffer(); this.guideVAO = gl.createVertexArray();
        gl.bindVertexArray(this.guideVAO); gl.bindBuffer(gl.ARRAY_BUFFER, this.guideVBO); gl.bufferData(gl.ARRAY_BUFFER, G.verts.byteLength, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
        gl.bindVertexArray(null); this.guideVer = -1;
      }
      gl.bindVertexArray(this.guideVAO);
      if (this.guideVer !== G.ver || this.guideOf !== G) { gl.bindBuffer(gl.ARRAY_BUFFER, this.guideVBO); gl.bufferSubData(gl.ARRAY_BUFFER, 0, G.verts); this.guideVer = G.ver; this.guideOf = G; }   // (a new world brings a new guide)
      gl.useProgram(p.p);
      gl.uniformMatrix4fv(p.u.u_viewProj, false, this.viewProj);
      gl.uniform3f(p.u.u_offset, G.ox - cam.x, G.oy - cam.y, G.oz - cam.z);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.disable(gl.CULL_FACE);
      let n = 0;
      for (let i = 0; i < parts.length; i++) { const q = parts[i]; if (!q.n) continue; gl.uniform4f(p.u.u_color, q.c[0], q.c[1], q.c[2], q.c[3]); gl.drawArrays(gl.TRIANGLES, q.at, q.n); n += q.n; }
      gl.depthMask(true); gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE);
      gl.bindVertexArray(null);
      this.stats.guide = n;   // (test/mirror.mjs: the axis was drawn)
    }
    drawCrack(c) {
      const gl = this.gl, p = this.P.decal, cam = this.cam;
      const verts = [];
      const e = 0.004;
      for (const b of c.boxes) {
        const x0 = b[0] - e, y0 = b[1] - e, z0 = b[2] - e, x1 = b[3] + e, y1 = b[4] + e, z1 = b[5] + e;
        const faces = [
          [[x1, y1, z1], [x1, y0, z1], [x1, y0, z0], [x1, y1, z0]], [[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]],
          [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], [[x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1]],
          [[x0, y1, z1], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1]], [[x1, y1, z0], [x1, y0, z0], [x0, y0, z0], [x0, y1, z0]]];
        const uvs = [[0, 0], [0, 1], [1, 1], [1, 0]];
        for (const f of faces) for (const k of [0, 1, 2, 0, 2, 3]) verts.push(f[k][0], f[k][1], f[k][2], uvs[k][0], uvs[k][1]);
      }
      gl.useProgram(p.p);
      gl.uniformMatrix4fv(p.u.u_viewProj, false, this.viewProj);
      gl.uniform3f(p.u.u_offset, c.x - cam.x, c.y - cam.y, c.z - cam.z);
      gl.uniform1f(p.u.u_layer, c.layer);
      gl.uniform4f(p.u.u_color, 0.0, 0.0, 0.0, 0.7);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.texAlbedo); gl.uniform1i(p.u.u_albedo, 0);
      gl.bindVertexArray(this.decalVAO);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.decalVBO);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Float32Array(verts));
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -2);
      gl.depthMask(false);
      gl.drawArrays(gl.TRIANGLES, 0, verts.length / 5);
      gl.depthMask(true);
      gl.disable(gl.POLYGON_OFFSET_FILL); gl.disable(gl.BLEND);
    }

    superRes(F) {
      const gl = this.gl, p = this.P.tsr, c = F.cam;
      const src = this.histFlip ? this.histTex1 : this.histTex0, dstFB = this.histFlip ? this.histFB0 : this.histFB1, dst = this.histFlip ? this.histTex0 : this.histTex1;
      const pc = this.prevCam || [c.x, c.y, c.z];
      const d = [c.x - pc[0], c.y - pc[1], c.z - pc[2]];
      const reset = this.tsrReset || Math.hypot(d[0], d[1], d[2]) > 24;
      gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
      gl.bindFramebuffer(gl.FRAMEBUFFER, dstFB);
      gl.viewport(0, 0, this.W, this.H);
      gl.useProgram(p.p);
      this.tex(0, this.sceneCol, p.u.u_cur);
      this.tex(1, this.copyDepth, p.u.u_depth);
      this.tex(2, src, p.u.u_hist);
      gl.uniformMatrix4fv(p.u.u_invVP, false, this.invVPNJ);
      gl.uniformMatrix4fv(p.u.u_prevVP, false, this.prevVP);
      gl.uniform3f(p.u.u_camDelta, d[0], d[1], d[2]);
      gl.uniform2f(p.u.u_jit, this.jit[0], this.jit[1]);
      gl.uniform2f(p.u.u_lowTexel, 1 / this.w, 1 / this.h);
      gl.uniform2f(p.u.u_outTexel, 1 / this.W, 1 / this.H);
      gl.uniform1f(p.u.u_reset, reset ? 1 : 0);
      // fast camera moves converge quicker (less smear), slow looks converge sharper
      const pv = this.prevView || [c.yaw, c.pitch]; const rot = Math.abs(c.yaw - pv[0]) + Math.abs(c.pitch - pv[1]); this.prevView = [c.yaw, c.pitch];
      gl.uniform1f(p.u.u_camSpeed, Math.min(1, Math.hypot(d[0], d[1], d[2]) * 1.5 + rot * 6));
      this.fs(p);
      this.histFlip = !this.histFlip;
      this.tsrReset = false;
      this.prevVP.set(this.vpNJ);
      this.prevCam = [c.x, c.y, c.z];
      this.upTex = dst;
    }
    post(F, E) {
      const gl = this.gl;
      gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
      // the adaptive exposure (F1): this frame's scene luminance eased in; the composite reads it
      if (this.expOK && this.P.expose) this.updateExposure(E);
      const useBloom = this.q.bloom && this.hdr;
      // bloom
      if (useBloom) {
        let p = this.P.bloomPre; gl.useProgram(p.p);
        const b0 = this.bloom[0];
        gl.bindFramebuffer(gl.FRAMEBUFFER, b0.fb); gl.viewport(0, 0, b0.w, b0.h);
        this.tex(0, this.sceneCol, p.u.u_src);
        gl.uniform2f(p.u.u_texel, 1 / this.w, 1 / this.h);
        gl.uniform1f(p.u.u_threshold, E.bloomThreshold || 1.1);
        this.fs(p);
        p = this.P.down; gl.useProgram(p.p);
        for (let i = 1; i < this.bloom.length; i++) {
          const src = this.bloom[i - 1], dst = this.bloom[i];
          gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb); gl.viewport(0, 0, dst.w, dst.h);
          this.tex(0, src.tex, p.u.u_src); gl.uniform2f(p.u.u_texel, 1 / src.w, 1 / src.h);
          this.fs(p);
        }
        p = this.P.up; gl.useProgram(p.p);
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
        for (let i = this.bloom.length - 1; i > 0; i--) {
          const src = this.bloom[i], dst = this.bloom[i - 1];
          gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb); gl.viewport(0, 0, dst.w, dst.h);
          this.tex(0, src.tex, p.u.u_src); gl.uniform2f(p.u.u_texel, 1 / src.w, 1 / src.h); gl.uniform1f(p.u.u_radius, 1.0);
          this.fs(p);
        }
        gl.disable(gl.BLEND);
      }
      // god rays
      let raysOn = false;
      if (this.q.rays && E.dimId === 0 && !F.underwater) {
        const L = E.sunDir[1] > 0 ? E.sunDir : E.moonDir;
        const c = [L[0] * 100, L[1] * 100, L[2] * 100, 1];
        const m = this.viewProj;
        const cx = m[0] * c[0] + m[4] * c[1] + m[8] * c[2] + m[12], cy = m[1] * c[0] + m[5] * c[1] + m[9] * c[2] + m[13], cw = m[3] * c[0] + m[7] * c[1] + m[11] * c[2] + m[15];
        if (cw > 0) {
          const sx = (cx / cw) * 0.5 + 0.5, sy = (cy / cw) * 0.5 + 0.5;
          const fade = Math.max(0, 1 - Math.max(Math.abs(sx - 0.5), Math.abs(sy - 0.5)) * 1.6) * Math.min(1, L[1] * 4) * (1 - E.rain);
          if (fade > 0.02) {
            raysOn = true;
            const p = this.P.rays; gl.useProgram(p.p);
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.raysFB); gl.viewport(0, 0, this.raysW, this.raysH);
            this.tex(0, this.copyDepth, p.u.u_depth); this.tex(1, this.sceneCol, p.u.u_color);
            gl.uniform2f(p.u.u_sunScreen, sx, sy);
            gl.uniform1f(p.u.u_raysStrength, fade * (E.sunDir[1] > 0 ? 0.55 : 0.2));
            this.fs(p);
          }
        }
      }
      // composite → ldr (or screen)
      const fx = this.q.fxaa && !this.upTex;
      const p = this.P.composite; gl.useProgram(p.p);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fx ? this.ldrFB : null);
      gl.viewport(0, 0, this.W, this.H);
      this.tex(0, this.upTex || this.sceneCol, p.u.u_scene);
      this.tex(1, useBloom ? this.bloom[0].tex : this.sceneCol, p.u.u_bloom);
      this.tex(2, this.raysTex, p.u.u_rays);
      this.tex(3, this.expTex[this.expCur], p.u.u_expTex);
      if (p.u.u_lift) { const L = E.lift || [0, 0, 0]; gl.uniform3f(p.u.u_lift, L[0], L[1], L[2]); }
      gl.uniform1f(p.u.u_exposure, E.exposure);
      gl.uniform1f(p.u.u_bloomStrength, useBloom ? (E.bloomStrength || 0.06) : 0);
      gl.uniform1f(p.u.u_useRays, raysOn ? 1 : 0);
      gl.uniform1f(p.u.u_vignette, F.photo ? F.photo.vignette : 0.3);
      gl.uniform1f(p.u.u_saturation, (F.photo && F.photo.saturation) || E.saturation || 1.12);
      gl.uniform3f(p.u.u_grade, E.grade[0], E.grade[1], E.grade[2]);
      if (p.u.u_vivid) gl.uniform1f(p.u.u_vivid, E.vivid === undefined ? 0 : E.vivid);
      gl.uniform1f(p.u.u_underwaterFx, F.underwater ? 1 : 0);
      gl.uniform1f(p.u.u_time, E.time);
      gl.uniform1f(p.u.u_damage, F.damage || 0);
      gl.uniform1f(p.u.u_portal, F.portal || 0);
      gl.uniform2f(p.u.u_screen, this.W, this.H);
      gl.uniform2f(p.u.u_sceneTexel, this.upTex ? 1 / this.W : 1 / this.w, this.upTex ? 1 / this.H : 1 / this.h);
      // sharpen more when the scene was rendered below screen resolution (less after super resolution)
      const up = Math.max(0, 1 - this.w / this.W) * (this.upTex ? 0.5 : 1);
      gl.uniform1f(p.u.u_sharpen, this.q.sharpen === 0 ? 0 : Math.min(1, (this.q.sharpen || 0.35) + up * 1.6));
      this.fs(p);
      if (fx) {
        const q = this.P.fxaa; gl.useProgram(q.p);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, this.W, this.H);
        this.tex(0, this.ldrTex, q.u.u_src);
        gl.uniform2f(q.u.u_texel, 1 / this.W, 1 / this.H);
        this.fs(q);
      }
    }
  }
  VR.Renderer = Renderer;
})(VR);
