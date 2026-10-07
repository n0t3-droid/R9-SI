// ============================================================================
// The block texture cache (main thread). The forge (tex_build.js, in a worker) takes 1-2.5 s on a low-end PC, and what it
// makes depends only on this build's texture code (VR.TEX_SRC_HASH, injected by build.js), on the layer names and masks
// the registry has now (tex_layout.js) and on the bevel settings. Its output is kept in IndexedDB ('r9si-cache', one
// record per look), and a later start or look switch with the same key takes it from there. Everything else is a miss,
// and the forge runs as before: no IndexedDB (an old browser, a private window that refuses it), a database that does not
// answer within READ_MS, a record of another key, a damaged one. Nothing here throws; a write never holds up the game.
// ============================================================================
(function (VR) {
  'use strict';
  const DB = 'r9si-cache', STORE = 'tex', VERSION = 1;
  const READ_MS = 500;                  // a read that takes longer is a miss (the forge runs meanwhile)
  const MAX_BYTES = 40 * 1024 * 1024;   // bigger outputs are not kept
  let dbp = null;                       // the database, opened once per page: a promise, resolving null without one

  function open() {
    if (dbp) return dbp;
    if (typeof indexedDB === 'undefined' || !indexedDB) return Promise.resolve(null);
    dbp = new Promise((resolve) => {
      let req;
      try { req = indexedDB.open(DB, VERSION); } catch (e) { resolve(null); return; }
      req.onupgradeneeded = () => { try { const db = req.result; if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE); } catch (e) { /* */ } };
      req.onsuccess = () => { try { req.result.onversionchange = () => req.result.close(); } catch (e) { /* */ } resolve(req.result); };
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    });
    return dbp;
  }

  // the key of the forge's output for these settings. id: the slot (one per look and bevel); text: what a record must match
  function key(o) {
    const src = VR.TEX_SRC_HASH, R = VR.R, TX = VR.TX;
    if (!src || !R || !R.texNames || !TX || !VR.textureMasks) return null;
    const rim = !!o.bevelAll, m = VR.textureMasks();
    return {
      id: (rim ? 'rim' : 'seam') + '-' + o.bevel, layers: R.texNames.length,
      text: JSON.stringify([src, VR.TEX_LEVELS, TX.N, o.bevel, rim, R.texNames, m.cube.join(''), m.cut.join(''), m.leaf ? m.leaf.join('') : '', m.block ? m.block.join('') : '']),   // Klassisch v2 masks too
    };
  }

  // the record as the forge's output, when it is exactly the output for this key (sizes and types checked), else null
  function unpack(rec, k) {
    const N = VR.TX.N, L = k.layers, LV = VR.TEX_LEVELS, NZ = VR.TEX_NOISE;
    if (!rec || rec.text !== k.text || rec.levels !== LV || rec.size !== N || rec.layers !== L) return null;
    if (!Array.isArray(rec.albedo) || !Array.isArray(rec.material) || rec.albedo.length !== LV || rec.material.length !== LV) return null;
    for (let lv = 0; lv < LV; lv++) {
      const want = (N >> lv) * (N >> lv) * 4 * L, a = rec.albedo[lv], b = rec.material[lv];
      if (!(a instanceof Uint8Array) || a.byteLength !== want || !(b instanceof Uint8Array) || b.byteLength !== want) return null;
    }
    if (!(rec.avgColor instanceof Float32Array) || rec.avgColor.length !== L * 4) return null;
    if (!(rec.noise instanceof Uint8Array) || rec.noise.byteLength !== NZ * NZ * 4) return null;
    if (!Array.isArray(rec.missing)) return null;
    return { type: 'textures', albedo: rec.albedo, material: rec.material, levels: LV, size: N, layers: L, missing: rec.missing, avgColor: rec.avgColor, noise: rec.noise };
  }

  // the forge's output for the key, or null (a miss: no database, a read slower than ms, or a record that is not this output)
  function get(k, ms) {
    if (!k) return Promise.resolve(null);
    const read = open().then((db) => db ? new Promise((resolve) => {
      try {
        const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(k.id);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => resolve(null);
      } catch (e) { resolve(null); }
    }) : null);
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), ms === undefined ? READ_MS : ms);
      const done = (rec) => { clearTimeout(timer); let t = null; try { t = unpack(rec, k); } catch (e) { t = null; } resolve(t); };
      read.then(done, () => done(null));
    });
  }

  // the forge's output under the key, written in the background; resolves true once it is stored, false when it cannot be
  // (the arrays are only read: the renderer and the icons keep using them)
  function put(k, tex) {
    if (!k || !tex || tex.type !== 'textures') return Promise.resolve(false);
    let n = 0;
    try { for (const a of [...tex.albedo, ...tex.material, tex.avgColor, tex.noise]) n += a.byteLength; } catch (e) { return Promise.resolve(false); }
    if (n > MAX_BYTES) return Promise.resolve(false);
    return open().then((db) => db ? new Promise((resolve) => {
      try {
        const rec = { id: k.id, text: k.text, levels: tex.levels, size: tex.size, layers: tex.layers, albedo: tex.albedo, material: tex.material, avgColor: tex.avgColor, noise: tex.noise, missing: tex.missing || [] };
        const r = db.transaction(STORE, 'readwrite').objectStore(STORE).put(rec, k.id);
        r.onsuccess = () => resolve(true);
        r.onerror = () => resolve(false);
      } catch (e) { resolve(false); }
    }) : false).then((ok) => ok === true, () => false);
  }

  VR.TexCache = { key, get, put, READ_MS, MAX_BYTES, DB, STORE };
})(VR);
