// ============================================================================
// FolkGPU (t-folk, the owner: „natürlich keine Lego-Villagers, wir wollen schon Realismus") — the villagers drawn smooth.
// A villager's look goes to a worker, which builds its rig (folkmodel.js buildPerson: real proportions at 32 voxels a
// block — the rig's files are in the worker's bundle), cuts every part's grid to what it holds, makes it a surface-nets
// mesh (folksmooth.js, kept in its LRU by the grid's hash: the villagers share sleeves, trousers and shoes) and hands back
// ONE buffer for the whole person, each vertex naming its part, with the rig's joints.
// t-folk2 (the owner's next look: one draw a person): every smooth person's mesh lives in ONE arena — a vertex buffer and
// a 32-bit index buffer, first-fit ranges grown by copy — and their bones in a float texture, a row a person (FG.MAXB
// matrices, then the person's light), so the whole crowd is ONE multiDrawElementsWEBGL: the people's own program (FOLK_VS
// / FOLK_FS below) takes its row by gl_DrawID. Without WEBGL_multi_draw: one drawElements a person, the row a uniform.
// The parts are shared only some 2.5× between a town's people (their colours are baked), so an instanced draw per shared
// part would have stayed ~5 draws a person; the arena makes it one draw for everyone.
// The same light as the voxel people (the vox program's shading, the CPU's terrain shade, the block light), and the eye's
// own: the eye's vertices (folksmooth.js marks them) take the light's brightness, not its colour — the whites stay white
// by a lantern and at dusk.
// Until its mesh is there a villager shows its voxel self; beyond NEAR blocks it is the half-resolution voxel LOD as
// before. The switch: Echte Menschen (settings.smoothFolk; off on Very Low and Low — game.js PRESETS — where nothing
// here runs and no program is compiled). The meshes live on the GPU while they are used: past MAX_BYTES the ones not
// drawn for a while go (asked again when needed).
// Public: VR.FolkGPU.on(game) · recFor(look) · want(game, rec, d2) · queue(rec, pos, yaw, pose, light, opts) ·
// flush(r, E, cam) · stats · clear(gl) · Ranges (the arena's allocator, node-tested)
// ============================================================================
(function (VR) {
  'use strict';
  const FG = VR.FolkGPU = {
    NEAR: 24,            // smooth within this many blocks (the voxel LOD beyond, as villages.js draws it)
    ASK: 30,             // a mesh is asked for from this distance (ready before the person reaches NEAR)
    PER_FRAME: 4,        // new requests a frame (a request is a look posted: the worker builds and meshes)
    INFLIGHT: 8,         // requests in the worker queue at most
    MAX_BYTES: 32 << 20, // the GPU meshes kept (a person ~ 0.1–0.2 MB)
    KEEP_MS: 4000,       // a mesh drawn within this time is never evicted
    MAXB: 20,            // bones a person at most (the smooth rig: 13 parts, the hands, what they hold)
    recs: new Map(), bytes: 0, inflight: 0, asked: 0, frame: -1,
    stats: { asked: 0, got: 0, failed: 0, workerMs: 0, buildMs: 0, hits: 0, miss: 0, bytes: 0, drawn: 0, tris: 0, evicted: 0, people: 0, draws: 0, full: 0 },
    items: [], n: 0,
  };
  const BW = FG.BW = FG.MAXB * 4 + 2;   // the bone texture's row: the matrices (4 texels each), the light (2 texels)
  // the switch (Very Low and Low: off, game.js PRESETS)
  FG.on = (g) => !!(g && g.settings && g.settings.smoothFolk && VR.FolkSmooth && VR.Folk && VR.Folk.buildPerson && g.world && g.world.pool);

  // ---------------------------------------------------------------- a look's record
  // state: 0 not asked · 1 asked · 2 ready · 3 failed (three failures: the voxel self stays)
  FG.recFor = function (look) {
    const key = VR.Folk.lookKey(look);
    let rec = FG.recs.get(key);
    if (!rec) { rec = { key, look, state: 0, fails: 0, vOff: -1, nv: 0, iOff: -1, count: 0, bytes: 0, used: 0, def: null }; FG.recs.set(key, rec); }
    return rec;
  };
  FG.ready = (rec) => !!rec && rec.state === 2;

  // ---------------------------------------------------------------- asking the worker
  // d2: the squared distance; called by the draw for a person in view within ASK blocks
  FG.want = function (g, rec, d2) {
    if (!rec || rec.state !== 0 || rec.fails >= 3) return false;
    if (FG.frame !== g.frame) { FG.frame = g.frame; FG.asked = 0; }
    if (FG.asked >= FG.PER_FRAME || FG.inflight >= FG.INFLIGHT || d2 > FG.ASK * FG.ASK) return false;
    if (rec.look && rec.look.role === 'hero') { rec.state = 3; rec.fails = 3; return false; }   // (the trailer heroes keep their own build)
    FG.asked++;
    // the worker builds the rig from the look, cuts and meshes its parts (folksmooth.js FS.personFromLook): the main
    // thread only posts the look (building the grids here cost some 6 ms a person, cutting and hashing them as much)
    rec.state = 1; FG.inflight++; FG.stats.asked++;
    g.world.pool.submit({ type: 'folkmesh', look: rec.look }, null, (m) => FG.got(g, rec, m), 8 + d2 / 256);
    return true;
  };
  FG.got = function (g, rec, m) {
    FG.inflight = Math.max(0, FG.inflight - 1);
    if (!m || m.type !== 'folkmesh' || !m.data || !m.idx || !m.rig) { rec.fails++; rec.state = rec.fails >= 3 ? 3 : 0; FG.stats.failed++; return; }
    const r = g && g.renderer, gl = r && r.gl;
    if (!gl) { rec.state = 0; return; }
    if (m.rig.order && m.rig.order.length > FG.MAXB) { rec.fails = 3; rec.state = 3; FG.stats.failed++; return; }
    rec.def = m.rig;   // (what the draw needs of the rig: its units, layout, joints and order)
    if (!FG.upload(gl, rec, m)) return;
    FG.stats.buildMs += m.buildMs || 0;
    FG.stats.got++; FG.stats.workerMs += m.ms || 0; FG.stats.hits += m.hits | 0; FG.stats.miss += m.miss | 0; FG.stats.lru = Math.max(FG.stats.lru || 0, m.cacheBytes || 0);
  };

  // ---------------------------------------------------------------- the arena's ranges (first fit, neighbours merged)
  // Ranges(cap): alloc(n) → the offset or −1 · release(off, n) · grow(cap) (the new tail free) · free (sorted [off, len])
  class Ranges {
    constructor(cap) { this.cap = cap; this.free = cap > 0 ? [[0, cap]] : []; this.used = 0; }
    alloc(n) {
      const F = this.free;
      for (let i = 0; i < F.length; i++) { const f = F[i]; if (f[1] < n) continue; const off = f[0]; f[0] += n; f[1] -= n; if (!f[1]) F.splice(i, 1); this.used += n; return off; }
      return -1;
    }
    release(off, n) {
      if (n <= 0) return;
      const F = this.free; let i = 0;
      while (i < F.length && F[i][0] < off) i++;
      F.splice(i, 0, [off, n]); this.used -= n;
      // (with the next, then with the previous)
      if (i + 1 < F.length && F[i][0] + F[i][1] === F[i + 1][0]) { F[i][1] += F[i + 1][1]; F.splice(i + 1, 1); }
      if (i > 0 && F[i - 1][0] + F[i - 1][1] === F[i][0]) { F[i - 1][1] += F[i][1]; F.splice(i, 1); }
    }
    grow(cap) { if (cap <= this.cap) return; const add = cap - this.cap, old = this.cap; this.cap = cap; this.used += add; this.release(old, add); }
    largest() { let m = 0; for (const f of this.free) m = Math.max(m, f[1]); return m; }
  }
  FG.Ranges = Ranges;

  // ---------------------------------------------------------------- the arena: one vertex buffer, one index buffer
  // 20 bytes a vertex (the voxel models' layout: position, normal, the bone in the pad byte, colour) and Uint32 indices
  // already offset by the person's first vertex (multiDrawElements has no base vertex)
  const AR = FG.ar = { vbo: null, ibo: null, vao: null, v: null, i: null, gl: null };
  const V0 = 1 << 17, I0 = 1 << 19, VMAX = (FG.MAX_BYTES * 1.5 / 20) | 0, IMAX = (FG.MAX_BYTES * 1.5 / 4) | 0;
  function attrs(gl) {
    gl.bindVertexArray(AR.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, AR.vbo);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.BYTE, true, 20, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, 20, 16);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.UNSIGNED_BYTE, false, 20, 15);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, AR.ibo);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
  }
  function arenaInit(gl) {
    if (AR.vao && AR.gl === gl) return true;
    AR.gl = gl; AR.vao = gl.createVertexArray(); AR.vbo = gl.createBuffer(); AR.ibo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, AR.vbo); gl.bufferData(gl.ARRAY_BUFFER, V0 * 20, gl.STATIC_DRAW);
    gl.bindVertexArray(null); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, AR.ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, I0 * 4, gl.STATIC_DRAW); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    AR.v = new Ranges(V0); AR.i = new Ranges(I0);
    attrs(gl);
    return true;
  }
  // a bigger buffer of a kind ('v' or 'i'), the old one copied in; false past the cap
  function arenaGrow(gl, kind, need) {
    const R = AR[kind], unit = kind === 'v' ? 20 : 4, max = kind === 'v' ? VMAX : IMAX;
    const cap = Math.min(max, Math.max(R.cap * 2, R.cap + need * 2));
    if (cap <= R.cap) return false;
    const old = kind === 'v' ? AR.vbo : AR.ibo, nu = gl.createBuffer(), T = kind === 'v' ? gl.ARRAY_BUFFER : gl.ELEMENT_ARRAY_BUFFER;
    // (bound to its own target first: WebGL 2 fixes a buffer's type at its first binding — an index buffer first bound
    // as a copy target could never hold indices)
    gl.bindVertexArray(null);
    gl.bindBuffer(T, nu); gl.bufferData(T, cap * unit, gl.STATIC_DRAW); gl.bindBuffer(T, null);
    gl.bindBuffer(gl.COPY_WRITE_BUFFER, nu);
    gl.bindBuffer(gl.COPY_READ_BUFFER, old); gl.copyBufferSubData(gl.COPY_READ_BUFFER, gl.COPY_WRITE_BUFFER, 0, 0, R.cap * unit);
    gl.bindBuffer(gl.COPY_READ_BUFFER, null); gl.bindBuffer(gl.COPY_WRITE_BUFFER, null);
    gl.deleteBuffer(old);
    if (kind === 'v') AR.vbo = nu; else AR.ibo = nu;
    R.grow(cap); attrs(gl);
    FG.stats.grown = (FG.stats.grown || 0) + 1;
    return true;
  }
  // n of a kind: from the free ranges, else by growing, else by evicting what has not been drawn for a while
  function arenaAlloc(gl, kind, n) {
    let off = AR[kind].alloc(n);
    if (off < 0 && arenaGrow(gl, kind, n)) off = AR[kind].alloc(n);
    if (off < 0) { evict(gl, performance.now(), true); off = AR[kind].alloc(n); }
    return off;
  }
  FG.upload = function (gl, rec, m) {
    FG.free(gl, rec);
    arenaInit(gl);
    const nv = m.nv, ni = m.idx.length;
    const vOff = arenaAlloc(gl, 'v', nv); if (vOff < 0) { rec.state = 0; FG.stats.full++; return false; }
    const iOff = arenaAlloc(gl, 'i', ni); if (iOff < 0) { AR.v.release(vOff, nv); rec.state = 0; FG.stats.full++; return false; }
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, AR.vbo); gl.bufferSubData(gl.ARRAY_BUFFER, vOff * 20, m.data);
    const ix = new Uint32Array(ni), I = m.idx; for (let k = 0; k < ni; k++) ix[k] = I[k] + vOff;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, AR.ibo); gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, iOff * 4, ix); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    rec.vOff = vOff; rec.nv = nv; rec.iOff = iOff; rec.count = ni;
    rec.bytes = nv * 20 + ni * 4; rec.state = 2; rec.used = performance.now();
    FG.bytes += rec.bytes; FG.stats.bytes = FG.bytes; FG.stats.people++;
    return true;
  };
  FG.free = function (gl, rec) {
    if (rec.vOff < 0) return;
    if (AR.v) { AR.v.release(rec.vOff, rec.nv); AR.i.release(rec.iOff, rec.count); }
    rec.vOff = -1; rec.iOff = -1; FG.bytes -= rec.bytes; rec.bytes = 0; FG.stats.bytes = FG.bytes; FG.stats.people--;
  };
  // every mesh back to the worker's care (a lost context, the tests' „before" picture)
  FG.clear = function (gl) {
    for (const rec of FG.recs.values()) { if (gl) FG.free(gl, rec); rec.state = 0; rec.fails = 0; }
    FG.recs.clear(); FG.inflight = 0;
    if (gl && AR.vao && AR.gl === gl) { gl.deleteVertexArray(AR.vao); gl.deleteBuffer(AR.vbo); gl.deleteBuffer(AR.ibo); }
    AR.vao = AR.vbo = AR.ibo = null; AR.v = AR.i = null; AR.gl = null; FG.bytes = 0; FG.stats.bytes = 0; FG.stats.people = 0;
  };
  // past MAX_BYTES (or with the arena full: hard) the meshes not drawn for KEEP_MS go, the longest unused first
  function evict(gl, now, hard) {
    if (!hard && FG.bytes <= FG.MAX_BYTES) return;
    const old = [];
    for (const rec of FG.recs.values()) if (rec.state === 2 && now - rec.used > FG.KEEP_MS) old.push(rec);
    old.sort((a, b) => a.used - b.used);
    const goal = hard ? FG.bytes * 0.7 : FG.MAX_BYTES * 0.85;
    for (const rec of old) { if (FG.bytes <= goal) break; FG.free(gl, rec); rec.state = 0; FG.stats.evicted++; }
  }

  // ---------------------------------------------------------------- the bones: a float texture, a row a person
  const BT = FG.bt = { tex: null, rows: 0, data: null, gl: null };
  function bonesTex(gl, n) {
    if (BT.tex && BT.gl === gl && BT.rows >= n) return BT;
    const rows = Math.max(64, 1 << Math.ceil(Math.log2(Math.max(1, n))));
    if (BT.tex && BT.gl === gl) gl.deleteTexture(BT.tex);
    BT.gl = gl; BT.rows = rows; BT.data = new Float32Array(BW * 4 * rows);
    BT.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, BT.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, BW, rows, 0, gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return BT;
  }
  FG.BONE_UNIT = 10;

  // ---------------------------------------------------------------- the people's program
  // FOLK_VS: the bone's matrix from the person's row (gl_DrawID under multi-draw, u_person without), the person's light
  // from the row's end; FOLK_FS: the vox program's light (soft wrap, sky and ground, a rim, the block light, the CPU's
  // terrain shade), the eye's neutral light, the emissive bytes
  const FOLK_VS = (multi) => `${multi ? '#extension GL_ANGLE_multi_draw : require' : ''}
layout(location=0) in vec3 a_pos;
layout(location=1) in vec3 a_normal;
layout(location=2) in vec4 a_color;
layout(location=3) in float a_bone;
uniform mat4 u_viewProj;
uniform highp sampler2D u_bones;
#ifdef MULTIDRAW
#define PERSON gl_DrawID
#else
uniform int u_person;
#define PERSON u_person
#endif
out vec3 v_n;
out vec4 v_color;
out vec3 v_rel;
flat out vec4 v_light;
flat out vec3 v_bl;
void main() {
  int b = int(a_bone + 0.5) * 4, p = PERSON;
  mat4 M = mat4(texelFetch(u_bones, ivec2(b, p), 0), texelFetch(u_bones, ivec2(b + 1, p), 0), texelFetch(u_bones, ivec2(b + 2, p), 0), texelFetch(u_bones, ivec2(b + 3, p), 0));
  vec4 wp = M * vec4(a_pos, 1.0);
  v_rel = wp.xyz;
  v_n = mat3(M) * a_normal;
  v_color = vec4(pow(a_color.rgb, vec3(2.2)), a_color.a);
  v_light = texelFetch(u_bones, ivec2(${BW - 2}, p), 0);
  v_bl = texelFetch(u_bones, ivec2(${BW - 1}, p), 0).xyz;
  gl_Position = u_viewProj * wp;
}`;
  const FOLK_FS = () => `
${'__COMMON__'}
in vec3 v_n;
in vec4 v_color;
in vec3 v_rel;
flat in vec4 v_light;   // the sky light, the terrain's shade (0 sun … 1 shaded), the hurt flash, no fog
flat in vec3 v_bl;      // the block light
out vec4 o;
void main() {
  vec3 alb = v_color.rgb;
  // (the alpha byte: 255 emissive, 128 the eye — folksmooth.js)
  float em = step(0.75, v_color.a), eye = step(0.25, v_color.a) * (1.0 - em);
  vec3 n = normalize(v_n);
  float sunUp = smoothstep(-0.12, 0.12, u_sunDir.y);
  vec3 L = sunUp > 0.001 ? u_sunDir : u_moonDir;
  vec3 lc = sunUp > 0.001 ? u_sunColor * sunUp : u_moonColor;
  float sk = v_light.x * v_light.x;
  float outdoor = smoothstep(0.5, 0.95, v_light.x);
  float wrapL = max((dot(n, L) + 0.3) / 1.3, 0.0);
  vec3 hemi = mix(u_ambSky * vec3(0.62, 0.56, 0.5), u_ambSky * 1.06, n.y * 0.5 + 0.5);
  vec3 light = hemi * sk + lc * wrapL * outdoor * 0.9 * (1.0 - v_light.y) + pow(v_bl, vec3(1.7)) * 1.35 * u_blockLightTint + 0.03;
  // t-folk2: an eye takes the light's brightness, not its colour, and a little of its own — the whites stay white (a
  // shade cool) by a lantern and at dusk, the iris dark (the owner: amber eyes under warm light)
  if (eye > 0.5) { float l = dot(light, vec3(0.2126, 0.7152, 0.0722)); light = mix(light, vec3(l) * vec3(0.95, 0.985, 1.05), 0.85) + vec3(0.045, 0.05, 0.058); }
  vec3 col = alb * light;
  vec3 V = normalize(-v_rel);
  float rim = pow(1.0 - max(dot(n, V), 0.0), 3.0);
  col += (u_skyHorizon * 0.5 + lc * 0.08) * rim * 0.22 * sk * alb;
  col += lc * pow(max(dot(n, normalize(L + V)), 0.0), 28.0) * 0.05 * outdoor;
  col = mix(col, alb * 2.2, em);
  col = mix(col, vec3(1.0, 0.2, 0.15), v_light.z * 0.6);
  if (v_light.w < 0.5) col = applyFog(col, v_rel, length(v_rel));
  o = vec4(col, 1.0);
}`;
  FG.program = function (r) {
    const P = r.P, key = 'folk2';
    if (P[key] !== undefined) return P[key];
    const multi = !!(VR.GL.ext && VR.GL.ext.multiDraw), S = VR.SHADERS;
    try { P[key] = VR.GL.program(FOLK_VS(multi), FOLK_FS().replace('__COMMON__', S.COMMON), 'folk', multi ? ['MULTIDRAW'] : []); P[key].multi = multi; }
    catch (e) { console.error(e); P[key] = null; }
    return P[key];
  };

  // ---------------------------------------------------------------- the draw
  // The people of a frame are queued while the voxel ones are drawn (villages.js), then drawn here at once: their rows
  // written (the rig's matrices — folksmooth.js rigMats, the same as entities.js drawModel builds — and the light), the
  // texture updated, one multi-draw over their ranges of the arena
  FG.queue = function (rec, pos, yaw, pose, light, opts) {
    let it = FG.items[FG.n];
    if (!it) it = FG.items[FG.n] = { rec: null, pos: [0, 0, 0], yaw: 0, pose: null, sky: 0, bl: [0, 0, 0], opts: null };
    it.rec = rec; it.pos[0] = pos[0]; it.pos[1] = pos[1]; it.pos[2] = pos[2]; it.yaw = yaw; it.pose = pose;
    it.sky = light.sky; it.bl[0] = light.bl[0]; it.bl[1] = light.bl[1]; it.bl[2] = light.bl[2]; it.opts = opts;
    FG.n++;
  };
  const IDENT = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const base = new Float32Array(16), mats = {};
  let counts = new Int32Array(64), offsets = new Int32Array(64);
  // the rows of the queued people (camera-relative), into BT.data; → the number written (the ready ones, in order)
  FG.rows = function (cam, n) {
    const m4 = VR.mat4, FS = VR.FolkSmooth, D = BT.data;
    let k = 0;
    for (let i = 0; i < n; i++) {
      const it = FG.items[i], rec = it.rec, def = rec.def, o = it.opts || {};
      if (rec.state !== 2 || !def) continue;
      base.set(IDENT);
      m4.translate(base, base, it.pos[0] - cam.x, it.pos[1] - cam.y, it.pos[2] - cam.z);
      m4.rotY(base, base, it.yaw);
      if (o.roll) m4.rotZ(base, base, o.roll);
      if (o.pitch) m4.rotX(base, base, o.pitch);
      const s = (o.scale || 1) / (def.unit || 32);
      m4.scale(base, base, s, s, s);
      FS.rigMats(def, base, it.pose, mats);
      const order = def.order, hide = o.hide, row = k * BW * 4;
      for (let b = 0; b < order.length && b < FG.MAXB; b++) {
        const M = mats[order[b]], off = row + b * 16;
        if (!M) continue;
        for (let q = 0; q < 16; q++) D[off + q] = M[q];
        // a hidden part (the lids while the eyes are open, the talking mouth, a seated guest's bag): its vertices fall onto
        // its pivot
        if (hide && hide[order[b]]) for (let q = 0; q < 12; q++) D[off + q] = 0;
      }
      const L = row + (BW - 2) * 4;
      D[L] = it.sky; D[L + 1] = o.shade || 0; D[L + 2] = o.flash || 0; D[L + 3] = o.noFog ? 1 : 0;
      D[L + 4] = it.bl[0]; D[L + 5] = it.bl[1]; D[L + 6] = it.bl[2]; D[L + 7] = 0;
      if (k >= counts.length) { const c = new Int32Array(counts.length * 2); c.set(counts); counts = c; const f = new Int32Array(offsets.length * 2); f.set(offsets); offsets = f; }
      counts[k] = rec.count; offsets[k] = rec.iOff * 4;
      rec.used = performance.now();
      k++;
    }
    return k;
  };
  FG.flush = function (r, E, cam) {
    const n = FG.n; FG.n = 0;
    FG.stats.drawn = 0; FG.stats.tris = 0; FG.stats.draws = 0;
    if (!n) return 0;
    const gl = r.gl, p = FG.program(r);
    if (!p || !AR.vao) { if (!p) for (let i = 0; i < n; i++) FG.items[i].rec.state = 3; return 0; }
    bonesTex(gl, n);
    const k = FG.rows(cam, n);
    if (!k) return 0;
    gl.activeTexture(gl.TEXTURE0 + FG.BONE_UNIT); gl.bindTexture(gl.TEXTURE_2D, BT.tex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, BW, k, gl.RGBA, gl.FLOAT, BT.data, 0);
    gl.useProgram(p.p); r.common(p, E);
    gl.uniformMatrix4fv(p.u.u_viewProj, false, r.viewProj);
    gl.uniform1i(p.u.u_bones, FG.BONE_UNIT);
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE);
    gl.bindVertexArray(AR.vao);
    const ext = p.multi ? VR.GL.ext.multiDraw : null;
    let tris = 0; for (let i = 0; i < k; i++) tris += counts[i] / 3;
    if (ext) { ext.multiDrawElementsWEBGL(gl.TRIANGLES, counts, 0, gl.UNSIGNED_INT, offsets, 0, k); FG.stats.draws = 1; }
    else { for (let i = 0; i < k; i++) { gl.uniform1i(p.u.u_person, i); gl.drawElements(gl.TRIANGLES, counts[i], gl.UNSIGNED_INT, offsets[i]); } FG.stats.draws = k; }
    gl.bindVertexArray(null);
    FG.stats.drawn = k; FG.stats.tris = tris;
    if (r.stats) { r.stats.draws += FG.stats.draws; r.stats.tris += tris; }
    evict(gl, performance.now());
    return k;
  };

  // ---------------------------------------------------------------- the people's shadows on the ground
  // A soft dark ellipse under each person drawn (smooth or voxel) within SH_D blocks, stretched away from the sun the lower
  // it stands, multiplied over the ground: one instanced draw for all of them, with Echte Menschen (the shadow map is
  // kept for many frames — moving people in it would leave their shadows behind — and the people take the CPU's terrain
  // shade for their own light, as before). k: the shadow's depth (weaker in the shade of the terrain, at night).
  FG.SH_D = 32;
  const SH_VS = `
layout(location=0) in vec2 a_corner;
layout(location=1) in vec4 a_inst;
layout(location=2) in float a_k;
uniform mat4 u_viewProj;
uniform vec3 u_light;
uniform float u_kMul;
out vec2 v_q;
out float v_a;
void main() {
  vec2 s = -normalize(u_light.xz + vec2(1e-4, 0.0));
  float len = clamp(0.5 / max(0.12, u_light.y), 1.0, 2.6);
  vec2 t = vec2(-s.y, s.x);
  vec2 c = a_inst.xz + s * a_inst.w * (len - 1.0) * 0.85;
  vec2 p = c + s * a_corner.y * a_inst.w * len + t * a_corner.x * a_inst.w;
  v_q = a_corner;
  v_a = a_k * u_kMul * (1.0 - smoothstep(22.0, 32.0, length(vec3(p.x, a_inst.y, p.y))));
  gl_Position = u_viewProj * vec4(p.x, a_inst.y + 0.03, p.y, 1.0);
}`;
  const SH_FS = `
in vec2 v_q;
in float v_a;
out vec4 o;
void main() { float r = dot(v_q, v_q); if (r > 1.0) discard; float a = 1.0 - r; o = vec4(0.0, 0.0, 0.0, a * a * v_a); }`;
  const SH = { n: 0, data: new Float32Array(5 * 64), vao: null, vbo: null, ibuf: null, cap: 0, prog: undefined };
  FG.shadow = function (pos, cam, r, k) {
    const d = SH.data, n = SH.n;
    if ((n + 1) * 5 > d.length) { const b = new Float32Array(d.length * 2); b.set(d); SH.data = b; }
    const o = n * 5, D = SH.data;
    D[o] = pos[0] - cam.x; D[o + 1] = pos[1] - cam.y; D[o + 2] = pos[2] - cam.z; D[o + 3] = r; D[o + 4] = k;
    SH.n = n + 1;
  };
  FG.drawShadows = function (r, E) {
    const n = SH.n; SH.n = 0;
    if (!n) return 0;
    const gl = r.gl;
    if (SH.prog === undefined) { try { SH.prog = VR.GL.program(SH_VS, SH_FS, 'folkShadow'); } catch (e) { console.error(e); SH.prog = null; } }
    const p = SH.prog; if (!p) return 0;
    if (!SH.vao) {
      SH.vao = gl.createVertexArray(); gl.bindVertexArray(SH.vao);
      SH.vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, SH.vbo); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
      SH.ibuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, SH.ibuf);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 20, 0); gl.vertexAttribDivisor(1, 1);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 20, 16); gl.vertexAttribDivisor(2, 1);
      gl.bindVertexArray(null);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, SH.ibuf);
    if (SH.cap < SH.data.length) { gl.bufferData(gl.ARRAY_BUFFER, SH.data.byteLength, gl.DYNAMIC_DRAW); SH.cap = SH.data.length; }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, SH.data, 0, n * 5);
    gl.useProgram(p.p);
    gl.uniformMatrix4fv(p.u.u_viewProj, false, r.viewProj);
    const sun = E.sunDir[1] > 0.02, L = sun ? E.sunDir : E.moonDir;
    gl.uniform3f(p.u.u_light, L[0], Math.max(0.05, L[1]), L[2]);
    // (by day the sun's; at dusk it fades; by night a faint one under the moon)
    gl.uniform1f(p.u.u_kMul, sun ? 0.45 + 0.55 * Math.min(1, (E.sunDir[1] - 0.02) / 0.2) : 0.4);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -2);
    gl.bindVertexArray(SH.vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
    gl.bindVertexArray(null);
    gl.disable(gl.POLYGON_OFFSET_FILL); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.BLEND); gl.depthMask(true); gl.enable(gl.CULL_FACE);
    if (r.stats) r.stats.draws++;
    FG.stats.shadows = n;
    return n;
  };

  // ---------------------------------------------------------------- the setting (⚙ Bild · Dinge & Effekte)
  if (VR.Settings && VR.Settings.add) VR.Settings.add({ key: 'smoothFolk', g: 'img', sec: 'objects', t: 'switch', lab: 'g.set.smoothFolk', tip: 'g.set.smoothFolk.tip', cost: 'mid', def: true });
})(VR);
