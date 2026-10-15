// ============================================================================
// FolkGPU (t-folk, the owner: „natürlich keine Lego-Villagers, wir wollen schon Realismus") — the villagers drawn smooth.
// A villager's look goes to a worker, which builds its rig (folkmodel.js buildPerson: real proportions at 32 voxels a
// block — the rig's files are in the worker's bundle), cuts every part's grid to what it holds, makes it a surface-nets
// mesh (folksmooth.js, kept in its LRU by the grid's hash: the villagers share sleeves, trousers and shoes) and hands back
// ONE buffer for the whole person, each vertex naming its part, with the rig's joints. The game draws it with one draw a
// person (shaders.js VOX_VS with BONES: the rig's matrices as an array), the same light as the voxel people (the vox
// program's shading, the CPU's terrain shade, the block light).
// Until its mesh is there a villager shows its voxel self; beyond NEAR blocks it is the half-resolution voxel LOD as
// before. The switch: Echte Menschen (settings.smoothFolk; off on Very Low and Low — game.js PRESETS — where nothing
// here runs and no program is compiled). The meshes live on the GPU while they are used: past MAX_BYTES the ones not
// drawn for a while go (asked again when needed).
// Public: VR.FolkGPU.on(game) · recFor(look) · want(game, rec, d2) · queue(rec, pos, yaw, pose, light, opts) ·
// flush(r, E, cam) · stats · clear(gl)
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
    recs: new Map(), bytes: 0, inflight: 0, asked: 0, frame: -1,
    stats: { asked: 0, got: 0, failed: 0, workerMs: 0, buildMs: 0, hits: 0, miss: 0, bytes: 0, drawn: 0, tris: 0, evicted: 0, people: 0 },
    items: [], n: 0,
  };
  // the switch (Very Low and Low: off, game.js PRESETS)
  FG.on = (g) => !!(g && g.settings && g.settings.smoothFolk && VR.FolkSmooth && VR.Folk && VR.Folk.buildPerson && g.world && g.world.pool);

  // ---------------------------------------------------------------- a look's record
  // state: 0 not asked · 1 asked · 2 ready · 3 failed (three failures: the voxel self stays)
  FG.recFor = function (look) {
    const key = VR.Folk.lookKey(look);
    let rec = FG.recs.get(key);
    if (!rec) { rec = { key, look, state: 0, fails: 0, vao: null, vbo: null, ibo: null, count: 0, type: 0, bytes: 0, used: 0, def: null, nv: 0 }; FG.recs.set(key, rec); }
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
    rec.def = m.rig;   // (what the draw needs of the rig: its units, layout, joints and order)
    rec.ranges = m.ranges || null;   // (each part's indices: the split draw)
    FG.upload(gl, rec, m);
    FG.stats.buildMs += m.buildMs || 0;
    FG.stats.got++; FG.stats.workerMs += m.ms || 0; FG.stats.hits += m.hits | 0; FG.stats.miss += m.miss | 0; FG.stats.lru = Math.max(FG.stats.lru || 0, m.cacheBytes || 0);
  };
  FG.upload = function (gl, rec, m) {
    FG.free(gl, rec);
    const vao = gl.createVertexArray(), vbo = gl.createBuffer(), ibo = gl.createBuffer();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, m.data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.BYTE, true, 20, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, 20, 16);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.UNSIGNED_BYTE, false, 20, 15);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, m.idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    rec.vao = vao; rec.vbo = vbo; rec.ibo = ibo; rec.count = m.idx.length; rec.type = m.idx.BYTES_PER_ELEMENT === 4 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
    rec.bytes = m.data.byteLength + m.idx.byteLength; rec.nv = m.nv; rec.state = 2; rec.used = performance.now();
    FG.bytes += rec.bytes; FG.stats.bytes = FG.bytes; FG.stats.people++;
  };
  FG.free = function (gl, rec) {
    if (!rec.vao) return;
    gl.deleteVertexArray(rec.vao); gl.deleteBuffer(rec.vbo); gl.deleteBuffer(rec.ibo);
    rec.vao = rec.vbo = rec.ibo = null; FG.bytes -= rec.bytes; rec.bytes = 0; FG.stats.bytes = FG.bytes; FG.stats.people--;
  };
  // every mesh back to the worker's care (a lost context, the tests' „before" picture)
  FG.clear = function (gl) { for (const rec of FG.recs.values()) { if (gl) FG.free(gl, rec); rec.state = 0; rec.fails = 0; } FG.recs.clear(); FG.inflight = 0; };
  // past MAX_BYTES: the meshes not drawn for KEEP_MS go, the longest unused first
  function evict(gl, now) {
    if (FG.bytes <= FG.MAX_BYTES) return;
    const old = [];
    for (const rec of FG.recs.values()) if (rec.state === 2 && now - rec.used > FG.KEEP_MS) old.push(rec);
    old.sort((a, b) => a.used - b.used);
    for (const rec of old) { if (FG.bytes <= FG.MAX_BYTES * 0.85) break; FG.free(gl, rec); rec.state = 0; FG.stats.evicted++; }
  }

  // ---------------------------------------------------------------- the draw
  // The people of a frame are queued while the voxel ones are drawn (villages.js), then drawn here with the one program
  // switch: per person its light, its terrain shade and the rig's matrices (folksmooth.js rigMats, the same as
  // entities.js drawModel builds), one drawElements.
  FG.queue = function (rec, pos, yaw, pose, light, opts) {
    let it = FG.items[FG.n];
    if (!it) it = FG.items[FG.n] = { rec: null, pos: [0, 0, 0], yaw: 0, pose: null, sky: 0, bl: [0, 0, 0], opts: null };
    it.rec = rec; it.pos[0] = pos[0]; it.pos[1] = pos[1]; it.pos[2] = pos[2]; it.yaw = yaw; it.pose = pose;
    it.sky = light.sky; it.bl[0] = light.bl[0]; it.bl[1] = light.bl[1]; it.bl[2] = light.bl[2]; it.opts = opts;
    FG.n++;
  };
  FG.program = function (r) {
    const P = r.P;
    if (P.voxBone !== undefined) return P.voxBone;
    try { P.voxBone = VR.GL.program(VR.SHADERS.VOX_VS, VR.SHADERS.VOX_FS, 'voxBone', ['BONES']); } catch (e) { console.error(e); P.voxBone = null; }
    return P.voxBone;
  };
  // split: a person drawn part by part (one drawElements a part over its range of the one buffer, the part's matrix as
  // the vox program's model) — the way when the boned program is missing (it did not compile), and a switch to weigh the
  // two (FG.SPLIT): no bone index in the vertex shader, a draw a part
  FG.SPLIT = false;
  const IDENT = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const BONES = new Float32Array(16 * 16), base = new Float32Array(16), mats = {};
  FG.flush = function (r, E, cam) {
    const n = FG.n; FG.n = 0;
    FG.stats.drawn = 0; FG.stats.tris = 0;
    if (!n) return 0;
    const gl = r.gl, pb = FG.SPLIT ? null : FG.program(r), split = !pb, p = pb || r.P.vox;
    if (!p) { for (let i = 0; i < n; i++) FG.items[i].rec.state = 3; return 0; }
    const m4 = VR.mat4, FS = VR.FolkSmooth, now = performance.now();
    gl.useProgram(p.p); r.common(p, E);
    gl.uniformMatrix4fv(p.u.u_viewProj, false, r.viewProj);
    gl.uniform1f(p.u.u_alpha, 1);
    gl.uniform3f(p.u.u_tint, 1, 1, 1);
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE);
    for (let i = 0; i < n; i++) {
      const it = FG.items[i], rec = it.rec, def = rec.def, o = it.opts || {};
      if (rec.state !== 2) continue;
      gl.uniform1f(p.u.u_sky, it.sky);
      gl.uniform3f(p.u.u_blockLight, it.bl[0], it.bl[1], it.bl[2]);
      if (p.u.u_sunShadow) gl.uniform1f(p.u.u_sunShadow, o.shade || 0);
      gl.uniform1f(p.u.u_flash, o.flash || 0);
      gl.uniform1f(p.u.u_noFog, o.noFog ? 1 : 0);
      base.set(IDENT);
      m4.translate(base, base, it.pos[0] - cam.x, it.pos[1] - cam.y, it.pos[2] - cam.z);
      m4.rotY(base, base, it.yaw);
      if (o.roll) m4.rotZ(base, base, o.roll);
      if (o.pitch) m4.rotX(base, base, o.pitch);
      const s = (o.scale || 1) / (def.unit || 32);
      m4.scale(base, base, s, s, s);
      FS.rigMats(def, base, it.pose, mats);
      const order = def.order, hide = o.hide;
      if (split) {
        const R = rec.ranges; if (!R) continue;
        gl.bindVertexArray(rec.vao);
        const bpe = rec.type === gl.UNSIGNED_INT ? 4 : 2;
        for (let q = 0; q < R.length; q += 3) {
          const name = order[R[q]], M = mats[name];
          if (!M || (hide && hide[name])) continue;
          gl.uniformMatrix4fv(p.u.u_model, false, M);
          gl.drawElements(gl.TRIANGLES, R[q + 2], rec.type, R[q + 1] * bpe);
          if (r.stats) r.stats.draws++;
        }
        rec.used = now; FG.stats.drawn++; FG.stats.tris += rec.count / 3;
        if (r.stats) r.stats.tris += rec.count / 3;
        continue;
      }
      for (let b = 0; b < order.length && b < 16; b++) {
        const M = mats[order[b]], off = b * 16;
        if (!M) continue;
        for (let k = 0; k < 16; k++) BONES[off + k] = M[k];
        // a hidden part (the lids while the eyes are open, the talking mouth): its vertices fall onto its pivot
        if (hide && hide[order[b]]) for (let k = 0; k < 12; k++) BONES[off + k] = 0;
      }
      gl.uniformMatrix4fv(p.u.u_bones, false, BONES, 0, Math.min(16, order.length) * 16);
      gl.bindVertexArray(rec.vao);
      gl.drawElements(gl.TRIANGLES, rec.count, rec.type, 0);
      rec.used = now;
      FG.stats.drawn++; FG.stats.tris += rec.count / 3;
      if (r.stats) { r.stats.draws++; r.stats.tris += rec.count / 3; }
    }
    gl.bindVertexArray(null);
    evict(gl, now);
    return FG.stats.drawn;
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
