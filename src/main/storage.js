// ============================================================================
// Persistence: IndexedDB worlds + RLE-compressed modified columns.
// Falls back to in-memory storage when IndexedDB is unavailable.
// ============================================================================
(function (VR) {
  'use strict';
  const DB_NAME = 'r9si', DB_VER = 1;
  function rleEncode(a) {
    const out = [];
    let i = 0;
    while (i < a.length) { const v = a[i]; let n = 1; while (i + n < a.length && a[i + n] === v && n < 65535) n++; out.push(v, n); i += n; }
    return new Uint16Array(out);
  }
  function rleDecode(r, len) {
    const a = new Uint16Array(len);
    let o = 0;
    for (let i = 0; i < r.length; i += 2) { a.fill(r[i], o, o + r[i + 1]); o += r[i + 1]; }
    return a;
  }
  VR.rleEncode = rleEncode; VR.rleDecode = rleDecode;

  class Store {
    constructor() { this.db = null; this.mem = { worlds: new Map(), chunks: new Map() }; this.ok = false; }
    open() {
      return new Promise((resolve) => {
        let req;
        try { req = indexedDB.open(DB_NAME, DB_VER); } catch (e) { resolve(false); return; }
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('worlds')) db.createObjectStore('worlds', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('chunks')) db.createObjectStore('chunks');
        };
        req.onsuccess = () => { this.db = req.result; this.ok = true; resolve(true); };
        req.onerror = () => resolve(false);
        req.onblocked = () => resolve(false);
        setTimeout(() => resolve(this.ok), 2500);
      });
    }
    tx(store, mode) { return this.db.transaction(store, mode).objectStore(store); }
    p(req) { return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }
    async listWorlds() {
      if (!this.ok) return [...this.mem.worlds.values()];
      try { return await this.p(this.tx('worlds', 'readonly').getAll()); } catch (e) { return []; }
    }
    async saveWorld(meta) {
      if (!this.ok) { this.mem.worlds.set(meta.id, meta); return; }
      try { await this.p(this.tx('worlds', 'readwrite').put(meta)); } catch (e) { console.warn('saveWorld', e); }
    }
    async deleteWorld(id) {
      this.mem.worlds.delete(id);
      for (const k of [...this.mem.chunks.keys()]) if (k.startsWith(id + ':')) this.mem.chunks.delete(k);
      if (!this.ok) return;
      try {
        await this.p(this.tx('worlds', 'readwrite').delete(id));
        await this.p(this.tx('chunks', 'readwrite').delete(IDBKeyRange.bound(id + ':', id + ':￿')));
      } catch (e) { console.warn(e); }
    }
    bind(worldId) { this.worldId = worldId; }
    key(dim, cx, cz) { return this.worldId + ':' + dim + ':' + cx + ':' + cz; }
    async savedKeys(dim) {
      const pre = this.worldId + ':' + dim + ':';
      const set = new Set();
      const add = (k) => { const p = k.slice(pre.length).split(':'); set.add(VR.ckey(+p[0], +p[1])); };
      if (!this.ok) { for (const k of this.mem.chunks.keys()) if (k.startsWith(pre)) add(k); return set; }
      try { const keys = await this.p(this.tx('chunks', 'readonly').getAllKeys(IDBKeyRange.bound(pre, pre + '￿'))); for (const k of keys) add(k); } catch (e) { console.warn(e); }
      return set;
    }
    saveColumn(dim, col) {
      // sv: the version of the world's style the generated part of this column was made with (v0.34)
      const rec = { b: rleEncode(col.blocks), h: (col.blocks.length >> 8), be: col.blockEntities && col.blockEntities.size ? [...col.blockEntities.entries()] : null, sv: col.sv || 0 };
      col.modified = false;
      const k = this.key(dim, col.cx, col.cz);
      if (!this.ok) { this.mem.chunks.set(k, rec); return Promise.resolve(); }
      try { return this.p(this.tx('chunks', 'readwrite').put(rec, k)).catch(e => console.warn(e)); } catch (e) { return Promise.resolve(); }
    }
    async loadColumn(dim, cx, cz) {
      const k = this.key(dim, cx, cz);
      let rec = null;
      if (!this.ok) rec = this.mem.chunks.get(k);
      else { try { rec = await this.p(this.tx('chunks', 'readonly').get(k)); } catch (e) { rec = null; } }
      if (!rec) return null;
      // columns taller than the generated 256 (the player built higher) carry their height
      let len = rec.h ? rec.h << 8 : 0;
      if (!len) { for (let i = 1; i < rec.b.length; i += 2) len += rec.b[i]; len = Math.max(65536, Math.ceil(len / 4096) * 4096); }
      const blocks = rleDecode(rec.b, len);
      blocks.blockEntities = rec.be;
      blocks.sv = rec.sv || 0;
      return blocks;
    }
  }
  VR.Store = Store;
})(VR);
