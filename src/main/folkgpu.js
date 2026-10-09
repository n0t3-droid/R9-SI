// ============================================================================
// FolkGPU (t-folk, the owner: „natürlich keine Lego-Villagers, wir wollen schon Realismus") — the villagers drawn smooth.
// A villager's rig (folkmodel.js buildPerson: real proportions at 32 voxels a block) goes to a worker as its parts' grids,
// cut to what they hold; the worker makes every part a surface-nets mesh (folksmooth.js, kept in its LRU by the grid's
// hash: the villagers share sleeves, trousers and shoes) and hands back ONE buffer for the whole person, each vertex
// naming its part. The game draws it with one draw a person (shaders.js VOX_VS with BONES: the rig's matrices as an
// array), the same light as the voxel people (the vox program's shading, the CPU's terrain shade, the block light).
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
    PER_FRAME: 2,        // new requests a frame (each builds the rig's grids on the main thread: ~1–3 ms)
    INFLIGHT: 6,         // requests in the worker queue at most
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
    FG.asked++;
    const t0 = performance.now(), FS = VR.FolkSmooth;
    let def;
    try { def = VR.Folk.buildHiRes(rec.look); } catch (e) { rec.fails = 3; rec.state = 3; return false; }
    if (!def || !def.person) { rec.state = 3; rec.fails = 3; return false; }   // (the trailer heroes keep their own build)
    const parts = [], tr = [], seen = new Map();
    def.order.forEach((name, bone) => {
      const pr = def.parts[name]; if (!pr) return;
      const g0 = pr.grid || pr;
      let key = seen.get(g0);
      if (key === undefined) {
        const c = FS.crop(g0);
        if (!c) { seen.set(g0, null); return; }
        key = FS.keyOf(c); seen.set(g0, key);
        parts.push({ key, bone, sx: c.sx, sy: c.sy, sz: c.sz, ox: c.ox, oy: c.oy, oz: c.oz, c: c.c }); tr.push(c.c.buffer);
      } else if (key !== null) parts.push({ key, bone });
    });
    // (what the draw needs of the rig; the grids are dropped)
    rec.def = { unit: def.unit, layout: def.layout, rig: def.rig, order: def.order, kid: def.kid, h: def.h };
    rec.state = 1; FG.inflight++; FG.stats.asked++; FG.stats.buildMs += performance.now() - t0;
    const prio = 8 + d2 / 256;
    g.world.pool.submit({ type: 'folkmesh', parts }, tr, (m) => FG.got(g, rec, m), prio);
    return true;
  };
  FG.got = function (g, rec, m) {
    FG.inflight = Math.max(0, FG.inflight - 1);
    if (!m || m.type !== 'folkmesh' || !m.data || !m.idx) { rec.fails++; rec.state = rec.fails >= 3 ? 3 : 0; FG.stats.failed++; return; }
    const r = g && g.renderer, gl = r && r.gl;
    if (!gl) { rec.state = 0; return; }
    FG.upload(gl, rec, m);
    FG.stats.got++; FG.stats.workerMs += m.ms || 0; FG.stats.hits += m.hits | 0; FG.stats.miss += m.miss | 0;
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
  const IDENT = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const BONES = new Float32Array(16 * 16), base = new Float32Array(16), mats = {};
  FG.flush = function (r, E, cam) {
    const n = FG.n; FG.n = 0;
    FG.stats.drawn = 0; FG.stats.tris = 0;
    if (!n) return 0;
    const gl = r.gl, p = FG.program(r);
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

  // ---------------------------------------------------------------- the setting (⚙ Bild · Dinge & Effekte)
  if (VR.Settings && VR.Settings.add) VR.Settings.add({ key: 'smoothFolk', g: 'img', sec: 'objects', t: 'switch', lab: 'g.set.smoothFolk', tip: 'g.set.smoothFolk.tip', cost: 'mid', def: true });
})(VR);
