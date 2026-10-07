// ============================================================================
// 📽 Zeitraffer — the recorder (VR.ZeitRec). Every building change of the player's own world — the hand, the tools,
// blueprints, plans and Forge builds, the Werkbank, undo, a friend's edit at the host — arrives here from the two
// places every edit goes through (world.js: setBlock with VR.SB_EDIT, bulkSet with a kind) as (time, x, y, z, old,
// new), packed into bytes as it comes (a few comparisons and byte writes per change: the frame only appends).
//
// Format of a segment (self-contained: positions and states start at zero, times at the segment's t0):
//   0x00–0x07  a change; bit 0: the position is the previous one + (1, 0, 0), bit 1: the old state as before, bit 2:
//              the new state as before — then zigzag varints dx dy dz and varints old, new for the bits that are clear
//   0x08       a run: varint n — n changes of the kind 0x07 (a row of the same block over the same ground)
//   0x09       a batch: varint ms since the previous batch, kind byte, varint dimension index, varint sky ticks / 10
// Storage: a database of its own ('r9si-history'; the worlds' 'r9si' is never touched): 'seg' [world, id] →
// {v, id, t0, t1, n, nb, dims, b} and 'idx' [world, id] → {t0, t1, n, bytes}. The open segment is check-pointed under
// its key every few seconds while it changes and sealed at segBytes; after a seal the oldest segments go until the
// world holds at most maxN changes and maxBytes (a ring buffer). Writes run from timers and promises, never inside
// the frame. Without IndexedDB (a private window) the history stays in memory for the session.
// ============================================================================
(function (VR) {
  'use strict';
  const DB = 'r9si-history';
  const K = { HAND: 1, TOOL: 2, PLAN: 3, BENCH: 4, UNDO: 5, GUEST: 6 };   // = VR.EDIT (world.js)
  const LIMITS = { segBytes: 131072, maxN: 2000000, maxBytes: 20 * 1024 * 1024, checkMs: 5000, joinMs: 40 };
  // the replay's clock: idle gaps are capped, a batch of more than `small` changes is spread at `per` ms per change
  const TIME = { gap: 3000, per: 3, small: 4, tail: 600 };
  const SPEEDS = [10, 30, 100, 300, 1000];
  const ck = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);   // = VR.ckey

  // ---------------------------------------------------------------- packing
  class Writer {
    constructor(t0) {
      this.b = new Uint8Array(1024); this.len = 0;
      this.t0 = t0; this.t1 = t0; this.tl = t0;
      this.px = 0; this.py = 0; this.pz = 0; this.po = 0; this.pn = 0;
      this.p7 = 0; this.n = 0; this.nb = 0;
      this.dims = []; this.dimLast = undefined; this.dimI = 0;
    }
    room(k) {
      if (this.len + k <= this.b.length) return;
      let m = this.b.length * 2; while (m < this.len + k) m *= 2;
      const nb = new Uint8Array(m); nb.set(this.b.subarray(0, this.len)); this.b = nb;
    }
    uv(v) { const b = this.b; let l = this.len; while (v > 127) { b[l++] = (v & 127) | 128; v >>>= 7; } b[l++] = v; this.len = l; }
    big(v) { const b = this.b; let l = this.len; while (v > 127) { b[l++] = (v % 128) | 128; v = Math.floor(v / 128); } b[l++] = v; this.len = l; }
    zz(v) { this.uv(v >= 0 ? v * 2 : -v * 2 - 1); }
    run() { const k = this.p7; this.p7 = 0; this.room(8); if (k === 1) this.b[this.len++] = 7; else { this.b[this.len++] = 8; this.uv(k); } }
    // a batch: its time (ms), kind, dimension and the sky's time (game ticks)
    batch(t, kind, dim, ticks) {
      if (this.p7) this.run();
      this.room(24);
      this.b[this.len++] = 9;
      t = Math.floor(+t || 0);
      this.big(Math.max(0, t - this.tl));
      if (t > this.tl) this.tl = t;
      this.t1 = this.tl;
      this.b[this.len++] = kind & 255;
      let di = this.dimI;
      if (dim !== this.dimLast) { di = this.dims.indexOf(dim); if (di < 0) { di = this.dims.length; this.dims.push(dim); } this.dimLast = dim; this.dimI = di; }
      this.uv(di);
      const tk = ((Math.round(+ticks || 0) % 24000) + 24000) % 24000;
      this.uv(Math.min(2399, Math.round(tk / 10)));
      this.nb++;
    }
    change(x, y, z, o, n) {
      const nx = x === this.px + 1 && y === this.py && z === this.pz, so = o === this.po, sn = n === this.pn;
      if (nx && so && sn) this.p7++;
      else {
        if (this.p7) this.run();
        this.room(20);
        this.b[this.len++] = (nx ? 1 : 0) | (so ? 2 : 0) | (sn ? 4 : 0);
        if (!nx) { this.zz(x - this.px); this.zz(y - this.py); this.zz(z - this.pz); }
        if (!so) this.uv(o);
        if (!sn) this.uv(n);
      }
      this.px = x; this.py = y; this.pz = z; this.po = o; this.pn = n; this.n++;
    }
    bytes() { if (this.p7) this.run(); return this.b.subarray(0, this.len); }
    // the segment as it is stored (a copy of the bytes)
    record(id) { const b = this.bytes(); return { v: 1, id, t0: this.t0, t1: this.t1, n: this.n, nb: this.nb, dims: this.dims.slice(), b: b.slice() }; }
  }

  // a segment's batches and changes, in order: sink.batch(t, kind, dim, ticks), sink.change(x, y, z, old, new).
  // A cut-off or foreign segment stops where it stops making sense (false); nothing throws.
  function decode(seg, sink) {
    const b = seg && seg.b; if (!b || !b.length) return true;
    const L = b.length, dims = seg.dims || [];
    let i = 0, t = +seg.t0 || 0, px = 0, py = 0, pz = 0, po = 0, pn = 0, on = false;
    const uv = () => {
      let c = b[i++], v = c & 127;
      if (c & 128) { c = b[i++]; v |= (c & 127) << 7; if (c & 128) { c = b[i++]; v |= (c & 127) << 14; if (c & 128) { c = b[i++]; v |= (c & 127) << 21; if (c & 128) { c = b[i++]; v += (c & 127) * 268435456; } } } }
      return v;
    };
    const zz = () => { const v = uv(); return (v & 1) ? -((v + 1) / 2) : v / 2; };
    const big = () => { let v = 0, m = 1, c; do { c = b[i++]; v += (c & 127) * m; m *= 128; } while ((c & 128) && i < L); return v; };
    while (i < L) {
      const op = b[i++];
      if (op < 8) {
        if (op & 1) px++; else { px += zz(); py += zz(); pz += zz(); }
        if (!(op & 2)) po = uv();
        if (!(op & 4)) pn = uv();
        if (i > L || !on) return false;
        sink.change(px, py, pz, po, pn);
      } else if (op === 8) {
        const k = uv(); if (i > L || !on) return false;
        for (let j = 0; j < k; j++) { px++; sink.change(px, py, pz, po, pn); }
      } else if (op === 9) {
        t += big(); const kind = b[i++], dim = dims[uv()], ticks = uv() * 10;
        if (i > L) return false;
        on = true;
        sink.batch(t, kind, dim, ticks);
      } else return false;
    }
    return true;
  }

  // ---------------------------------------------------------------- the recorder of one world
  class Rec {
    constructor(w, be, o) {
      this.w = w; this.be = be; this.o = Object.assign({}, LIMITS, o || {});
      this.cur = null;          // the open segment {id (null until first written), w: Writer}
      this.dirty = false; this.timer = null; this.lastId = 0; this.inB = false;
      this.L = { t0: -1e15, kind: 0, dim: undefined };   // the hand batch that is still open (changes within joinMs join it)
      this.q = Promise.resolve();
      this.now = () => Date.now(); this.ticks = () => 0;
      this.ready = be && be.lastId ? Promise.resolve().then(() => be.lastId(w)).then((id) => { if (id > this.lastId) this.lastId = id; }, () => {}) : Promise.resolve();
    }
    open(t) { if (!this.cur) this.cur = { id: null, w: new Writer(t) }; return this.cur.w; }
    // a bulk edit: begin, add per changed cell, end (one batch; a full segment is sealed before a new batch starts)
    begin(kind, dim) {
      if (this.cur && this.cur.w.len >= this.o.segBytes) this.sealNow();
      const t = this.now();
      this.open(t).batch(t, kind, dim, this.ticks());
      this.inB = true; this.L.kind = 0;
    }
    add(x, y, z, o, n) { this.cur.w.change(x, y, z, o, n); }
    end() { this.inB = false; this.touch(); }
    // one change of the hand (or a friend's): changes within joinMs of the batch's start join it (a door's two halves)
    one(x, y, z, o, n, dim, kind) {
      if (this.inB) { this.cur.w.change(x, y, z, o, n); return; }
      const L = this.L, t = this.now();
      if (!this.cur || L.kind !== kind || L.dim !== dim || t - L.t0 > this.o.joinMs) {
        if (this.cur && this.cur.w.len >= this.o.segBytes) this.sealNow();
        this.open(t).batch(t, kind, dim, this.ticks());
        L.kind = kind; L.dim = dim; L.t0 = t;
      }
      this.cur.w.change(x, y, z, o, n);
      this.touch();
    }
    // the next check-point in checkMs (the frame only appends; writing happens from the timer)
    touch() {
      this.dirty = true;
      if (this.cur.w.len >= this.o.segBytes) { if (!this.sealT) this.sealT = setTimeout(() => { this.sealT = null; if (this.cur && this.cur.w.len >= this.o.segBytes) this.sealNow(); }, 0); }
      else if (!this.timer) this.timer = setTimeout(() => { this.timer = null; this.flush(); }, this.o.checkMs);
    }
    // write the open segment as it is now (under its key; the next check-point overwrites it)
    flush() {
      const c = this.cur; if (!c || !this.dirty || !c.w.n) return this.q;
      this.dirty = false;
      return this.put(c, c.w.record(c.id), false);
    }
    // close the open segment: written once more, then the ring buffer is trimmed; the next change opens a new one
    sealNow() {
      clearTimeout(this.timer); this.timer = null;
      const c = this.cur; if (!c) return this.q;
      this.cur = null; this.dirty = false; this.L.kind = 0;
      if (!c.w.n) return this.q;
      return this.put(c, c.w.record(c.id), true);
    }
    seal() { return this.sealNow(); }
    close() { clearTimeout(this.sealT); this.sealT = null; return this.sealNow(); }
    idle() { return this.q; }
    put(c, rec, sealed) {
      this.q = this.q.then(async () => {
        await this.ready;
        if (c.id == null) { c.id = Math.max(Math.floor(c.w.t0), this.lastId + 1); this.lastId = c.id; }
        rec.id = c.id;
        await this.be.put(this.w, rec);
        if (sealed) await this.cap();
      }).catch((e) => { this.err = e; if (typeof console !== 'undefined') console.warn('Zeitraffer: history not written', e); });
      return this.q;
    }
    // the ring buffer: the oldest segments go until the world holds at most maxN changes and maxBytes
    async cap() {
      const list = await this.be.idx(this.w);
      let n = 0, by = 0; for (const [, v] of list) { n += v.n; by += v.bytes; }
      const open = this.cur && this.cur.id;
      for (const [id, v] of list) {
        if (n <= this.o.maxN && by <= this.o.maxBytes) break;
        if (id === open) break;
        await this.be.del(this.w, id);
        n -= v.n; by -= v.bytes;
      }
    }
    // everything recorded so far: the stored segments (by id) and the open one as it is now
    async snapshot() {
      await this.q; await this.ready;
      let segs = [];
      try { segs = await this.be.list(this.w); } catch (e) { segs = []; }
      const c = this.cur;
      if (c && c.w.n) {
        const rec = c.w.record(c.id); rec.id = c.id == null ? Infinity : c.id;
        const k = segs.findIndex((s) => s.id === rec.id);
        if (k >= 0) segs[k] = rec; else segs.push(rec);
      }
      return segs.sort((a, b) => a.id - b.id);
    }
  }

  // ---------------------------------------------------------------- backends
  class MemBackend {
    constructor() { this.m = new Map(); }
    of(w) { let x = this.m.get(w); if (!x) { x = new Map(); this.m.set(w, x); } return x; }
    sorted(w) { return [...this.of(w).values()].sort((a, b) => a.id - b.id); }
    put(w, rec) { this.of(w).set(rec.id, Object.assign({}, rec, { b: rec.b.slice(), dims: rec.dims.slice() })); return Promise.resolve(); }
    list(w) { return Promise.resolve(this.sorted(w).map((r) => Object.assign({}, r))); }
    idx(w) { return Promise.resolve(this.sorted(w).map((r) => [r.id, { t0: r.t0, t1: r.t1, n: r.n, bytes: r.b.length }])); }
    del(w, id) { this.of(w).delete(id); return Promise.resolve(); }
    drop(w) { this.m.delete(w); return Promise.resolve(); }
    lastId(w) { let m = 0; for (const id of this.of(w).keys()) if (id > m) m = id; return Promise.resolve(m); }
  }
  class IdbBackend {
    constructor(db) { this.db = db; }
    range(w) { return IDBKeyRange.bound([w, -Infinity], [w, Infinity]); }
    done(t) { return new Promise((res, rej) => { t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }); }
    req(r) { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
    put(w, rec) {
      const t = this.db.transaction(['seg', 'idx'], 'readwrite');
      t.objectStore('seg').put(rec, [w, rec.id]);
      t.objectStore('idx').put({ t0: rec.t0, t1: rec.t1, n: rec.n, bytes: rec.b.byteLength }, [w, rec.id]);
      return this.done(t);
    }
    async both(store, w) {
      const s = this.db.transaction(store, 'readonly').objectStore(store), r = this.range(w);
      const [keys, vals] = await Promise.all([this.req(s.getAllKeys(r)), this.req(s.getAll(r))]);
      return [keys, vals];
    }
    async list(w) { const [keys, vals] = await this.both('seg', w); return vals.map((v, i) => Object.assign(v, { id: keys[i][1] })); }
    async idx(w) { const [keys, vals] = await this.both('idx', w); return keys.map((k, i) => [k[1], vals[i]]); }
    del(w, id) { const t = this.db.transaction(['seg', 'idx'], 'readwrite'); t.objectStore('seg').delete([w, id]); t.objectStore('idx').delete([w, id]); return this.done(t); }
    drop(w) { const t = this.db.transaction(['seg', 'idx'], 'readwrite'); t.objectStore('seg').delete(this.range(w)); t.objectStore('idx').delete(this.range(w)); return this.done(t); }
    async lastId(w) { const c = await this.req(this.db.transaction('idx', 'readonly').objectStore('idx').openCursor(this.range(w), 'prev')); return c ? c.key[1] : 0; }
  }
  // the page's backend: IndexedDB when it answers, else memory (once per page)
  let beP = null;
  function backend() {
    if (beP) return beP;
    beP = new Promise((resolve) => {
      const mem = () => resolve(new MemBackend());
      if (typeof indexedDB === 'undefined' || !indexedDB) { mem(); return; }
      let req, done = false;
      const fin = (b) => { if (!done) { done = true; resolve(b); } };
      try { req = indexedDB.open(DB, 1); } catch (e) { mem(); return; }
      req.onupgradeneeded = () => { try { const db = req.result; if (!db.objectStoreNames.contains('seg')) db.createObjectStore('seg'); if (!db.objectStoreNames.contains('idx')) db.createObjectStore('idx'); } catch (e) { /* */ } };
      req.onsuccess = () => { const db = req.result; try { db.onversionchange = () => db.close(); } catch (e) { /* */ } fin(new IdbBackend(db)); };
      req.onerror = () => fin(new MemBackend());
      req.onblocked = () => fin(new MemBackend());
      setTimeout(() => fin(new MemBackend()), 4000);
    });
    return beP;
  }
  // a backend that is there at once (the recorder is made synchronously; its first write waits for the database)
  const lazy = { put: (w, r) => backend().then((b) => b.put(w, r)), list: (w) => backend().then((b) => b.list(w)), idx: (w) => backend().then((b) => b.idx(w)), del: (w, id) => backend().then((b) => b.del(w, id)), drop: (w) => backend().then((b) => b.drop(w)), lastId: (w) => backend().then((b) => b.lastId(w)) };
  function forWorld(id) { return new Rec(id, lazy); }
  function forget(id) { return id ? lazy.drop(id).catch(() => {}) : Promise.resolve(); }

  // ---------------------------------------------------------------- reading the history
  // the changes per column of one dimension (where it was built most), and the time span
  function scan(segs, dim) {
    const cols = new Map(); let n = 0, t0 = Infinity, t1 = -Infinity, on = false, lk = -1, lc = 0, lcx = 1e9, lcz = 1e9;
    const sink = {
      batch(t, kind, d) { on = d === dim; if (on) { if (t < t0) t0 = t; if (t > t1) t1 = t; } },
      change(x, y, z) {
        if (!on) return;
        n++;
        const cx = x >> 4, cz = z >> 4;
        if (cx === lcx && cz === lcz) { lc++; return; }
        if (lk >= 0) cols.set(lk, (cols.get(lk) || 0) + lc);
        lcx = cx; lcz = cz; lk = ck(cx, cz); lc = 1;
      },
    };
    for (const s of segs) decode(s, sink);
    if (lk >= 0) cols.set(lk, (cols.get(lk) || 0) + lc);
    return { cols, n, t0, t1 };
  }
  // the busiest place: the loaded column with the most changes within `radius` columns around it (ties: nearer to
  // o.near), and the columns with changes around it (busiest first, at most maxCols)
  function pickArea(cols, o) {
    o = o || {};
    const R = o.radius || 4, max = o.maxCols || 64, near = o.near || null;
    let cand = [];
    for (const [k, n] of cols) { const cx = Math.floor(k / 65536) - 32768, cz = (k % 65536) - 32768; if (!o.loaded || o.loaded(cx, cz)) cand.push([cx, cz, n]); }
    if (!cand.length) return null;
    if (cand.length > 600) cand = cand.sort((a, b) => b[2] - a[2]).slice(0, 600);
    let best = null;
    for (const a of cand) {
      let s = 0; for (const b of cand) if (Math.abs(b[0] - a[0]) <= R && Math.abs(b[1] - a[1]) <= R) s += b[2];
      const d = near ? (a[0] - near[0]) * (a[0] - near[0]) + (a[1] - near[1]) * (a[1] - near[1]) : 0;
      if (!best || s > best.s || (s === best.s && d < best.d)) best = { s, d, cx: a[0], cz: a[1] };
    }
    const area = cand.filter((b) => Math.abs(b[0] - best.cx) <= R && Math.abs(b[1] - best.cz) <= R).sort((a, b) => b[2] - a[2]).slice(0, max);
    return { keys: new Set(area.map((b) => ck(b[0], b[1]))), center: [best.cx, best.cz], n: area.reduce((a, b) => a + b[2], 0) };
  }
  // the changes of one dimension inside the kept columns, in order: x y z old (o) new (s) per change, and per batch
  // its time (bt), kind (bk), sky ticks (btk) and first change (bi; bi[nb] = n). Batches out of time order (two tabs
  // recorded the same world) are put in order.
  function collect(segs, dim, keep, limit) {
    let cap = 4096, n = 0, nb = 0, bcap = 256;
    let X = new Int32Array(cap), Y = new Int32Array(cap), Zz = new Int32Array(cap), O = new Uint16Array(cap), S = new Uint16Array(cap);
    let BT = new Float64Array(bcap), BK = new Uint8Array(bcap), BTK = new Uint16Array(bcap), BI = new Uint32Array(bcap + 1);
    let on = false, pt = 0, pk = 0, ptk = 0, emitted = false, lcx = 1e9, lcz = 1e9, lkeep = false;
    const growC = () => { cap *= 2; const g = (A) => { const B = new A.constructor(cap); B.set(A); return B; }; X = g(X); Y = g(Y); Zz = g(Zz); O = g(O); S = g(S); };
    const growB = () => { bcap *= 2; const g = (A, k) => { const B = new A.constructor(bcap + k); B.set(A); return B; }; BT = g(BT, 0); BK = g(BK, 0); BTK = g(BTK, 0); BI = g(BI, 1); };
    const sink = {
      batch(t, kind, d, ticks) { on = d === dim; pt = t; pk = kind; ptk = ticks; emitted = false; },
      change(x, y, z, o, s) {
        if (!on) return;
        const cx = x >> 4, cz = z >> 4;
        if (cx !== lcx || cz !== lcz) { lcx = cx; lcz = cz; lkeep = !keep || !!keep(cx, cz); }
        if (!lkeep) return;
        if (!emitted) { if (nb >= bcap) growB(); BT[nb] = pt; BK[nb] = pk; BTK[nb] = Math.round(ptk / 10); BI[nb] = n; nb++; emitted = true; }
        if (n >= cap) growC();
        X[n] = x; Y[n] = y; Zz[n] = z; O[n] = o; S[n] = s; n++;
      },
    };
    for (const sg of segs) decode(sg, sink);
    BI[nb] = n;
    let C = { n, nb, x: X.subarray(0, n), y: Y.subarray(0, n), z: Zz.subarray(0, n), o: O.subarray(0, n), s: S.subarray(0, n), bt: BT.subarray(0, nb), bk: BK.subarray(0, nb), btk: BTK.subarray(0, nb), bi: BI.subarray(0, nb + 1) };
    let sorted = true; for (let b = 1; b < nb; b++) if (C.bt[b] < C.bt[b - 1]) { sorted = false; break; }
    if (!sorted) C = reorder(C);
    // too much for this machine: the newest `limit` changes (the start is then a later moment)
    if (limit && C.n > limit) C = tail(C, limit);
    return C;
  }
  function reorder(C) {
    const ord = Array.from({ length: C.nb }, (_, i) => i).sort((a, b) => (C.bt[a] - C.bt[b]) || (a - b));
    const D = { n: C.n, nb: C.nb, x: new Int32Array(C.n), y: new Int32Array(C.n), z: new Int32Array(C.n), o: new Uint16Array(C.n), s: new Uint16Array(C.n), bt: new Float64Array(C.nb), bk: new Uint8Array(C.nb), btk: new Uint16Array(C.nb), bi: new Uint32Array(C.nb + 1) };
    let k = 0;
    ord.forEach((b, j) => {
      D.bt[j] = C.bt[b]; D.bk[j] = C.bk[b]; D.btk[j] = C.btk[b]; D.bi[j] = k;
      for (let i = C.bi[b]; i < C.bi[b + 1]; i++, k++) { D.x[k] = C.x[i]; D.y[k] = C.y[i]; D.z[k] = C.z[i]; D.o[k] = C.o[i]; D.s[k] = C.s[i]; }
    });
    D.bi[C.nb] = k;
    return D;
  }
  function tail(C, limit) {
    let b0 = 0; while (b0 < C.nb && C.n - C.bi[b0] > limit) b0++;
    const i0 = C.bi[b0], bi = new Uint32Array(C.nb - b0 + 1);
    for (let b = b0; b <= C.nb; b++) bi[b - b0] = C.bi[b] - i0;
    return { n: C.n - i0, nb: C.nb - b0, x: C.x.subarray(i0), y: C.y.subarray(i0), z: C.z.subarray(i0), o: C.o.subarray(i0), s: C.s.subarray(i0), bt: C.bt.subarray(b0), bk: C.bk.subarray(b0), btk: C.btk.subarray(b0), bi };
  }
  // the replay's clock: E[b] = when batch b starts (ms of replay time at ×1), at(i) = when change i appears, total
  function timeline(C) {
    const nb = C.nb, E = new Float64Array(nb), D = new Float64Array(nb);
    let e = 0;
    for (let b = 0; b < nb; b++) {
      if (b) e += D[b - 1] + Math.min(TIME.gap, Math.max(0, C.bt[b] - C.bt[b - 1]));
      E[b] = e;
      const k = C.bi[b + 1] - C.bi[b];
      D[b] = k > TIME.small ? k * TIME.per : 0;
    }
    const total = nb ? E[nb - 1] + D[nb - 1] + TIME.tail : 0;
    const batchOf = (i) => { let lo = 0, hi = nb - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (C.bi[m] <= i) lo = m; else hi = m - 1; } return lo; };
    const at = (i) => { const b = batchOf(i); return E[b] + (D[b] ? (i - C.bi[b]) * TIME.per : 0); };
    // the first change that appears after time t (the cursor for a clock at t)
    const index = (t) => {
      if (t <= 0) return 0;
      if (t >= total) return C.n;
      let lo = 0, hi = nb - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (E[m] <= t) lo = m; else hi = m - 1; }
      const b = lo, k = C.bi[b + 1] - C.bi[b];
      if (E[b] > t) return C.bi[b];
      if (!D[b]) return C.bi[b + 1];
      return C.bi[b] + Math.min(k, Math.floor((t - E[b]) / TIME.per) + 1);
    };
    return { E, D, total, at, index, batchOf };
  }
  // a speed that shows the whole replay in about `want` ms (the next step up, at most ×1000)
  function speedFor(total, want) { want = want || 30000; for (const s of SPEEDS) if (total / s <= want) return s; return SPEEDS[SPEEDS.length - 1]; }
  // move the replay from change `from` to change `to`: forward sets the new states, back the old ones
  function move(C, from, to, set) {
    if (to > from) for (let i = from; i < to; i++) set(C.x[i], C.y[i], C.z[i], C.s[i]);
    else for (let i = from - 1; i >= to; i--) set(C.x[i], C.y[i], C.z[i], C.o[i]);
  }

  VR.ZeitRec = { DB, K, LIMITS, TIME, SPEEDS, Writer, decode, Rec, MemBackend, IdbBackend, backend, forWorld, forget, scan, pickArea, collect, timeline, speedFor, move };
})(typeof VR !== 'undefined' ? VR : (globalThis.VR = globalThis.VR || {}));
