// ============================================================================
// FolkSmooth (t-folk, the owner: „natürlich keine Lego-Villagers, wir wollen schon Realismus") — a villager's rig part,
// a voxel grid at 32 a block (src/main/folkmodel.js), as a smooth surface: the surface nets of src/shared/smoothvox.js at
// the part's own resolution, creases where skin meets cloth, hair or leather (the material tags folkmodel.js puts in
// bits 26–28 of every voxel: a cuff stays apart from the hand, the hair from the forehead), the painted detail (eyes,
// brows, lips, buttons, seams, the apron's edge, the soles) kept as the colours of the voxels the faces cover. The mesh
// comes out in the vertex layout of the voxel models (voxmodels.js meshGrid: position, normal, colour with the
// occlusion baked in; 20 bytes) with Uint16 indices, so the game draws it with the vox program the voxel people use.
// Shared: the worker meshes ('folkmesh' job: its LRU ≤ 24 MB keyed by the grid's hash — many villagers wear the same
// sleeve, the same trousers, the same shoes), the node test measures it (test/folk_real.js).
// ============================================================================
(function (VR) {
  'use strict';
  const FS = VR.FolkSmooth = VR.FolkSmooth || {};
  // the material tags of folkmodel.js (VoxGrid voxel: colour | emissive << 24 | present << 25 | tag << 26)
  FS.TAG = { skin: 1, hair: 2, cloth: 3, leather: 4, metal: 5, other: 6, eye: 7 };
  // a tag → the smoothvox material class (bits 29–31: 1 fabric, 2 leather, 3 wood, 4 marble, 5 metal, 6 plant, 7 stone):
  // only the regions matter here (two tags never smooth into one another); the eye is a class of its own so a dark
  // iris keeps its colour on any skin
  const CLS = [0, 4, 6, 1, 2, 5, 3, 7];
  // the smoothing of a body part: three passes, a vertex moves at most 0.45 voxel (a one-voxel nose stays a nose)
  FS.OPTS = { passes: 3, lambda: 0.6, clamp: 0.45 };

  // ---------------------------------------------------------------- the grid's key: dimensions, origin, two hashes
  FS.keyOf = function (g) {
    const c = g.c; let h1 = 2166136261, h2 = 0x9E3779B9 | 0;
    for (let i = 0; i < c.length; i++) {
      const v = c[i]; if (!v) continue;
      h1 = Math.imul(h1 ^ i, 16777619); h1 = Math.imul(h1 ^ v, 16777619);
      h2 = Math.imul(h2 ^ (v + i * 0x45D9F3B), 0x2C1B3C6D); h2 ^= h2 >>> 15;
    }
    return g.sx + 'x' + g.sy + 'x' + g.sz + '@' + g.ox + ',' + g.oy + ',' + g.oz + ':' + (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
  };

  // ---------------------------------------------------------------- a part's grid → the smooth mesh
  // g: { sx, sy, sz, ox, oy, oz, c: Uint32Array } (a VoxGrid or its copy); opts: the smoothing (FS.OPTS)
  // → { data: Uint8Array (20 bytes a vertex), idx: Uint16Array, nv, nt, ms } in the part's own units (a voxel x spans
  // [x − ox, x − ox + 1], as meshGrid); null when the grid is empty or too big for 16-bit indices
  const SVB = () => VR.SmoothVox && VR.SmoothVox.BITS;
  FS.mesh = function (g, opts) {
    const SV = VR.SmoothVox; if (!SV) return null;
    const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const B = SVB(), n = g.sx * g.sy * g.sz, V = new Uint32Array(n);
    let any = false;
    for (let i = 0; i < n; i++) {
      const v = g.c[i]; if (!v) continue;
      const tag = (v >>> 26) & 7;
      V[i] = ((v & 0xffffff) | B.PRESENT | ((v >>> 24) & 1 ? B.EMIS : 0) | (CLS[tag] << 29)) >>> 0;
      any = true;
    }
    if (!any) return null;
    const o = Object.assign({}, FS.OPTS, opts || {});
    let m = SV.nets({ NX: g.sx, NY: g.sy, NZ: g.sz, V, step: 1 }, o);
    if (o.flat !== false) m = SV.flatten(m);
    if (m.nv > 65535) return null;
    // the voxel models' vertex: position (float × 3), normal (int8 × 3, a pad), colour (sRGB bytes × the occlusion and
    // the faces' soft key — the same shade a voxel face gets by its direction: 0.72 under, 0.9 at the sides, 1 on top),
    // the emissive flag in the alpha byte
    const nv = m.nv, buf = new ArrayBuffer(nv * 20), f32 = new Float32Array(buf), i8 = new Int8Array(buf), u8 = new Uint8Array(buf);
    for (let i = 0; i < nv; i++) {
      f32[i * 5] = m.pos[i * 3] - g.ox; f32[i * 5 + 1] = m.pos[i * 3 + 1] - g.oy; f32[i * 5 + 2] = m.pos[i * 3 + 2] - g.oz;
      const nx = m.nrm[i * 3], ny = m.nrm[i * 3 + 1], nz = m.nrm[i * 3 + 2];
      i8[i * 20 + 12] = Math.round(nx * 127); i8[i * 20 + 13] = Math.round(ny * 127); i8[i * 20 + 14] = Math.round(nz * 127);
      const em = (m.val[i] & B.EMIS) !== 0;
      const key = em ? 1 : (ny >= 0 ? 0.91 + 0.09 * ny : 0.91 + 0.19 * ny) * (0.96 - 0.01 * Math.abs(nx)) * Math.max(0.55, m.ao[i]);
      u8[i * 20 + 16] = Math.min(255, Math.round(m.rgb[i * 3] * key)); u8[i * 20 + 17] = Math.min(255, Math.round(m.rgb[i * 3 + 1] * key)); u8[i * 20 + 18] = Math.min(255, Math.round(m.rgb[i * 3 + 2] * key));
      u8[i * 20 + 19] = em ? 255 : 0;
    }
    const idx = new Uint16Array(m.idx.length); idx.set(m.idx);
    const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    return { data: new Uint8Array(buf), idx, nv, nt: idx.length / 3, ms: t1 - t0 };
  };

  // ---------------------------------------------------------------- the rig: every part's matrix
  // The matrices entities.js drawModel builds for a rigged model, without drawing: base (the model's place, its turn and
  // its scale), then per part in def.order its parent's matrix and the joint (def.rig) or the base and its layout
  // position, then the pose ([rx, ry, rz, tx, ty, tz]: translate, rotY, rotX, rotZ). out: { name: Float32Array(16) },
  // reused from call to call (no allocation once warm). The game's smooth people and the node tests use it.
  FS.rigMats = function (def, base, pose, out) {
    const m4 = VR.mat4, lay = def.layout || {}, rig = def.rig || {}, order = def.order || Object.keys(def.parts);
    for (let i = 0; i < order.length; i++) {
      const name = order[i];
      let t = out[name]; if (!t) t = out[name] = new Float32Array(16);
      const par = rig[name];
      if (par && out[par[0]] && out[par[0]].done === FS.stamp) { t.set(out[par[0]]); const J = par[1]; m4.translate(t, t, J[0], J[1], J[2]); }
      else { const L = lay[name] || Z3; t.set(base); m4.translate(t, t, L[0], L[1], L[2]); }
      const q = pose && pose[name];
      if (q) { if (q.length > 3 && (q[3] || q[4] || q[5])) m4.translate(t, t, q[3] || 0, q[4] || 0, q[5] || 0); if (q[1]) m4.rotY(t, t, q[1]); if (q[0]) m4.rotX(t, t, q[0]); if (q[2]) m4.rotZ(t, t, q[2]); }
      t.done = FS.stamp;
    }
    FS.stamp = (FS.stamp + 1) & 0x3fffffff;
    return out;
  };
  const Z3 = [0, 0, 0]; FS.stamp = 1;

  // ---------------------------------------------------------------- a part's grid cut to what it holds
  // (the rig's grids are generous — a robe's hips 33 × 37 × 27 for some 2 000 voxels): the box round its voxels, the
  // origin moved with it, so the key and the mesh do not depend on how big the part was laid out. null when empty
  FS.crop = function (g) {
    const SX = g.sx, SY = g.sy, SZ = g.sz, C = g.c;
    let x0 = SX, y0 = SY, z0 = SZ, x1 = -1, y1 = -1, z1 = -1;
    for (let y = 0; y < SY; y++) for (let z = 0; z < SZ; z++) {
      const row = (y * SZ + z) * SX;
      for (let x = 0; x < SX; x++) if (C[row + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z; }
    }
    if (x1 < 0) return null;
    const sx = x1 - x0 + 1, sy = y1 - y0 + 1, sz = z1 - z0 + 1, c = new Uint32Array(sx * sy * sz);
    for (let y = 0; y < sy; y++) for (let z = 0; z < sz; z++) { const s = ((y + y0) * SZ + z + z0) * SX + x0; c.set(C.subarray(s, s + sx), (y * sz + z) * sx); }
    return { sx, sy, sz, ox: g.ox - x0, oy: g.oy - y0, oz: g.oz - z0, c };
  };

  // ---------------------------------------------------------------- a person: every part's mesh in one buffer
  // The game draws a villager with ONE draw: its parts' meshes one after the other in one vertex buffer, each vertex
  // carrying its part's index (the bone, in the vertex's pad byte 15 — the voxel models' layout has it free), the shader
  // (shaders.js VOX_VS, BONES) takes the part's matrix from an array the rig fills (folkgpu.js). m.parts: [{ key, bone,
  // and the cropped grid (sx … c) the first time a key appears in the job }] (the left and the right arm are one grid: one
  // mesh, merged twice with their two bones). Each part's mesh is kept in the thread's LRU (≤ 24 MB) by its key — the
  // villagers share sleeves, trousers and shoes. → { data, idx (Uint16, Uint32 past 65 535 vertices), nv, nt, hits,
  // miss, ms, cacheBytes, transfer }
  FS.person = function (m) {
    const SV = VR.SmoothVox, t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const cache = FS.cache || (FS.cache = SV && SV.LRU ? new SV.LRU(1024, 24 << 20) : null);
    const got = new Map(), list = [];
    let nv = 0, ni = 0, hits = 0, miss = 0, ms = 0;
    for (const p of m.parts || []) {
      let r = got.get(p.key);
      if (r === undefined) {
        r = cache ? cache.get(p.key) : undefined;
        if (r !== undefined) hits++;
        else if (p.c) { r = FS.mesh(p, m.opts); if (cache) cache.set(p.key, r, (r ? r.data.byteLength + r.idx.byteLength : 0) + 64); miss++; if (r) ms += r.ms; }
        else return { error: 'part ' + p.key + ' not sent', transfer: [] };
        got.set(p.key, r);
      }
      if (!r) continue;
      list.push(r, p.bone | 0); nv += r.nv; ni += r.idx.length;
    }
    if (!nv) return { error: 'empty person', transfer: [] };
    const data = new Uint8Array(nv * 20), idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let vo = 0, io = 0;
    for (let k = 0; k < list.length; k += 2) {
      const r = list[k], bone = list[k + 1], n = r.nv, I = r.idx;
      data.set(r.data, vo * 20);
      for (let i = 0; i < n; i++) data[(vo + i) * 20 + 15] = bone;
      for (let i = 0; i < I.length; i++) idx[io + i] = I[i] + vo;
      vo += n; io += I.length;
    }
    FS.stats.hits += hits; FS.stats.miss += miss; FS.stats.ms += ms;
    const t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    return { data, idx, nv, nt: ni / 3, hits, miss, ms, total: t1 - t0, cacheBytes: cache ? cache.bytes : 0, transfer: [data.buffer, idx.buffer] };
  };

  // ---------------------------------------------------------------- the worker's job: several parts, one LRU
  // m.parts: [{ key, sx, sy, sz, ox, oy, oz, c }] → { parts: [{ key, data, idx, nv, nt, ms, hit }], hits, miss, ms, transfer }
  FS.cache = null; FS.stats = { hits: 0, miss: 0, ms: 0 };
  const bytes = (r) => (r ? r.data.byteLength + r.idx.byteLength : 0);
  FS.job = function (m) {
    const SV = VR.SmoothVox, tr = [], out = [];
    const cache = FS.cache || (FS.cache = SV && SV.LRU ? new SV.LRU(1024, 24 << 20) : null);
    let hits = 0, miss = 0, ms = 0;
    for (const p of m.parts || []) {
      let r = cache ? cache.get(p.key) : undefined;
      const hit = r !== undefined;
      if (!hit) { r = FS.mesh(p); if (cache) cache.set(p.key, r, bytes(r) + 64); miss++; if (r) ms += r.ms; } else hits++;
      if (!r) { out.push({ key: p.key, empty: true }); continue; }
      const data = r.data.slice(), idx = r.idx.slice(); tr.push(data.buffer, idx.buffer);
      out.push({ key: p.key, data, idx, nv: r.nv, nt: r.nt, ms: hit ? 0 : r.ms, hit });
    }
    FS.stats.hits += hits; FS.stats.miss += miss; FS.stats.ms += ms;
    return { parts: out, hits, miss, ms, cacheBytes: cache ? cache.bytes : 0, transfer: tr };
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
