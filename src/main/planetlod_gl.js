// ============================================================================
// u-orbitlod · VR.PlanetLODGL — the planet tiles drawn (docs/superpowers/plans/2026-10-29-u-orbitlod.md §4; the pure part
// and the worker's job are src/shared/planetlod.js). Called right after Herzwelt's impostor in the space scene's two
// drawers (spacescene.js SS.draw for /raum, spaceflight.js drawLayers for the climb and the space frame) with that
// draw's own uniforms and textures, just before it: the tiles are HERZ_FS under #define PTILE — the same colours, clouds, haze, night
// lights and glint as the impostor round them, the relief their own. The tiles nearest the nadir come first from the
// workers (a few in flight at a time); a tile not there yet is stood in for by its coarser parent, else the impostor
// shows. Own depth (logarithmic); the impostor then drawn at the far plane with the depth test, so the ground under the
// tiles is shaded once (early depth); the depth cleared after it (the ship and the voxel world draw as they always did). Balanced and up (PlanetLOD.on); Very Low and Low never reach it.
// ============================================================================
(function (VR) {
  'use strict';
  if (typeof window === 'undefined' || !VR.GL || !VR.PlanetLOD) return;
  const PL = VR.PlanetLOD, GL = VR.GL;
  const PG = VR.PlanetLODGL = { game: null, tiles: new Map(), inFlight: 0, prog: undefined, ebo: null, stats: { drawn: 0, tiles: 0, ms: 0, maxMs: 0, made: 0, bytes: 0, asked: 0, got: 0, err: 0, lastErr: '' } };
  // Planetenrelief (Bild · Qualität): the tiles on (Balanced and up, with Weltraum-Detail 2+); off: the impostor alone
  if (VR.Settings && VR.Settings.add) VR.Settings.add({ key: 'planetTiles', g: 'img', sec: 'quality', t: 'switch', lab: 'g.set.planetTiles', tip: 'g.set.planetTiles.tip', cost: 'mid', def: true });
  const MAXF = 4;
  let frameNo = 0, sel = [];
  function program() {
    if (PG.prog !== undefined) return PG.prog;
    const src = VR.SpaceShaders && VR.SpaceShaders.programs().ptile;
    try { PG.prog = src ? GL.program(src.vs, src.fs, 'space.ptile', []) : null; }
    catch (e) { console.error('ptile shader failed: ' + (e && e.message)); PG.prog = null; }
    return PG.prog;
  }
  function setU(gl, p, k, v) {
    const loc = p.u[k]; if (loc === undefined || loc === null) return;
    if (typeof v === 'number') gl.uniform1f(loc, v);
    else if (v.length === 2) gl.uniform2f(loc, v[0], v[1]);
    else if (v.length === 3) gl.uniform3f(loc, v[0], v[1], v[2]);
    else if (v.length === 4) gl.uniform4f(loc, v[0], v[1], v[2], v[3]);
    else if (v.length === 9) gl.uniformMatrix3fv(loc, false, v);
    else if (v.length === 16) gl.uniformMatrix4fv(loc, false, v);
  }
  // a finished job → its VAO (interleaved position + normal; the shared index list)
  function upload(gl, t, m) {
    if (!PG.ebo) { PG.ebo = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, PG.ebo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, PL.indices(), gl.STATIC_DRAW); PG.count = PL.indices().length; }
    const n = PL.VERTS, data = new Float32Array(n * 6);
    for (let i = 0; i < n; i++) { data[i * 6] = m.pos[i * 3]; data[i * 6 + 1] = m.pos[i * 3 + 1]; data[i * 6 + 2] = m.pos[i * 3 + 2]; data[i * 6 + 3] = m.nrm[i * 3]; data[i * 6 + 4] = m.nrm[i * 3 + 1]; data[i * 6 + 5] = m.nrm[i * 3 + 2]; }
    t.vao = gl.createVertexArray(); t.vbo = gl.createBuffer();
    gl.bindVertexArray(t.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, t.vbo); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, PG.ebo);
    gl.bindVertexArray(null); gl.bindBuffer(gl.ARRAY_BUFFER, null);
    t.ready = true; PG.stats.made++; PG.stats.bytes += PL.tileBytes();
  }
  function drop(gl, key) {
    const t = PG.tiles.get(key); if (!t) return;
    if (t.vao) { gl.deleteVertexArray(t.vao); gl.deleteBuffer(t.vbo); PG.stats.bytes -= PL.tileBytes(); }
    PG.tiles.delete(key);
  }
  // every tile let go (a new world, a new seed)
  PG.clear = function (gl) { for (const k of [...PG.tiles.keys()]) drop(gl, k); PG.seed = undefined; };
  function want(g, gl, x) {
    let t = PG.tiles.get(x.key);
    if (!t) { t = { key: x.key, s: x.s, x0: x.x0, z0: x.z0, ready: false, asked: false, used: frameNo }; PG.tiles.set(x.key, t); }
    t.used = frameNo;
    if (!t.ready && !t.asked && PG.inFlight < MAXF && g && g.pool) {
      t.asked = true; PG.inFlight++; PG.stats.asked++;
      const seed = PG.seed;
      g.pool.submit({ type: 'ptile', key: x.key, x0: x.x0, z0: x.z0, s: x.s }, null, (m) => {
        PG.inFlight = Math.max(0, PG.inFlight - 1); PG.stats.got++;
        if (PG.seed !== seed || PG.tiles.get(x.key) !== t) return;
        if (!m || m.type !== 'ptile' || !m.pos) { t.asked = false; PG.stats.err++; PG.stats.lastErr = String(m && (m.msg || m.type)).slice(0, 200); return; }
        PG.stats.ms = m.ms; PG.stats.maxMs = Math.max(PG.stats.maxMs, m.ms); const L = PG.msList || (PG.msList = []); L.push(m.ms); if (L.length > 64) L.shift(); PG.stats.medMs = L.slice().sort((a, b) => a - b)[L.length >> 1];
        try { upload(gl, t, m); } catch (e) { PG.stats.err++; PG.stats.lastErr = String(e && e.message).slice(0, 200); }
      }, 2);
    }
    return t;
  }
  // the ready stand-in for a selected tile: itself, else the nearest coarser ancestor that is there
  function standIn(x) {
    const t = PG.tiles.get(x.key); if (t && t.ready) return t;
    for (let s = x.s * 2; s <= PL.LEVELS[PL.LEVELS.length - 1]; s *= 2) {
      const S = s * PL.N, k = s + ':' + Math.floor(x.x0 / S) * S + ':' + Math.floor(x.z0 / S) * S, a = PG.tiles.get(k);
      if (a && a.ready) { a.used = frameNo; return a; }
    }
    return null;
  }
  const _drawn = new Set();
  // d: the impostor's draw (its uniforms and textures), hb: fr.bodies.herz { camB (m, body frame) }, lay: the drawer's
  // layer (colour share, alpha share, exposure gain) or null, cut: the climb's inner cut [from, to] in metres or null,
  // map: the drawer's texture names → keys, texOf(name) → the GL texture
  // the selection round the camera and the workers asked for what is missing — every frame a space frame is set up
  // (spaceflight.js cameraFrame, whether or not it is drawn) and before every draw; camB the camera in Herzwelt's body
  // frame (m). false: no tiles (off, Very Low, Low, too high)
  PG.update = function (g, gl, camB, tier) {
    if (!PL.on(tier, 'herz') || !camB || !gl) return false;
    PG.last = [g, gl, camB, tier];
    if (g && g.settings && g.settings.planetTiles === false) return false;
    const SS = VR.SpaceScene, seed = SS && SS.state ? SS.state.seed : 0;
    if (PG.seed !== seed) { PG.clear(gl); PG.seed = seed; }
    const cb = camB, rr = Math.hypot(cb[0], cb[1], cb[2]), BT = VR.BodyTex, R = BT.CHART.R;
    if (rr - R > 40000) return false;
    frameNo++;
    // the sub-camera point on the map (the chart), the height over the sphere
    const th = Math.acos(Math.max(-1, Math.min(1, cb[1] / rr))), lam = Math.atan2(-cb[2], cb[0]), pl = BT.toPlane(th, lam), alt = rr - R;
    sel = PL.select(pl[0], pl[1], alt, sel);
    // ask nearest first
    sel.sort((a, b) => Math.hypot(a.x0 + a.size / 2 - pl[0], a.z0 + a.size / 2 - pl[1]) - Math.hypot(b.x0 + b.size / 2 - pl[0], b.z0 + b.size / 2 - pl[1]));
    for (const x of sel) want(g || PG.game, gl, x);
    // the cache bounded: the least recently used beyond PL.CACHE go
    if (PG.tiles.size > PL.CACHE) { const old = [...PG.tiles.values()].filter(t => t.used < frameNo).sort((a, b) => a.used - b.used); for (let i = 0; i < old.length && PG.tiles.size > PL.CACHE; i++) drop(gl, old[i].key); }
    PG.stats.tiles = sel.length;
    return true;
  };
  // the drawers' two hooks round the impostor: before it (the tiles drawn first, their depth kept; n tiles) and after it
  // (the depth cleared: the ship and the voxel world draw as they always did)
  PG.before = function (gl, p, n, setU2) { if (!n) return; setU2(gl, p, 'u_zFar', 1); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(false); };
  PG.after = function (gl, p, n, setU2) { if (!n) return; setU2(gl, p, 'u_zFar', 0); gl.depthMask(true); gl.clear(gl.DEPTH_BUFFER_BIT); gl.disable(gl.DEPTH_TEST); gl.depthMask(false); };   // (the mask on for the clear: a masked clear clears nothing)
  // how many of the selected tiles are still on their way (tests)
  PG.again = () => (PG.last ? PG.update.apply(null, PG.last) : false);
  PG.pending = () => sel.filter(x => { const t = PG.tiles.get(x.key); return !(t && t.ready); }).length;
  PG.draw = function (r, d, hb, lay, cut, map, texOf) {
    const tier = d.u.u_air ? d.u.u_air[2] : 0, gl = r.gl;
    if (!hb || !PG.update(PG.game, gl, hb.camB, tier)) return 0;
    const p = program(); if (!p) return 0;
    const cb = hb.camB;
    gl.useProgram(p.p);
    setU(gl, p, 'u_viewProj', r.viewProj);
    for (const k in d.u) setU(gl, p, k, d.u[k]);
    setU(gl, p, 'u_camB', cb);
    setU(gl, p, 'u_tfade', [cut ? cut[0] : 0, cut ? cut[1] : 0, PL.RADIUS * 0.78, PL.RADIUS]);
    setU(gl, p, 'u_fadeOut', lay ? [1 - lay[0], 1 - lay[1], Math.log2(Math.max(1e-6, lay[2] || 1)), 0] : [0, 0, 0, 0]);
    let unit = 0;
    for (const k in d.tex) { if (!p.u[k]) continue; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, texOf(map[d.tex[k]])); gl.uniform1i(p.u[k], unit); unit++; }
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    _drawn.clear();
    let n = 0;
    for (const x of sel) {
      const t = standIn(x); if (!t || _drawn.has(t.key)) continue;
      _drawn.add(t.key);
      gl.bindVertexArray(t.vao);
      gl.drawElements(gl.TRIANGLES, PG.count, gl.UNSIGNED_SHORT, 0);
      n++; r.stats.draws++; r.stats.tris += PG.count / 3;
    }
    gl.bindVertexArray(r.emptyVAO);
    // (the depth stays for the impostor drawn next at the far plane — PG.after clears it)
    gl.depthMask(false);
    gl.activeTexture(gl.TEXTURE0);
    PG.stats.drawn = n; PG.stats.tiles = sel.length;
    return n;
  };
})(VR);
