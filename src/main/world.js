// ============================================================================
// Client world: column storage, worker pool, generation & mesh scheduling,
// cross-column light propagation (increase + removal), block get/set API.
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R, F = VR.F;
  const ckey = VR.ckey = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);
  const PAD = 2, PS = 16 + PAD * 2, PSS = PS * PS;   // the mesher's padded section (mesher.js MESH_PAD)
  // 📽 Zeitraffer: every building change passes one of two doors here — setBlock with SB_EDIT (the player's hand;
  // SB_GUEST: a friend's edit at the host) and bulkSet with a kind (tools, blueprints and plans, the Werkbank, undo).
  // Both hand (x, y, z, old, new) of each real change to world.zr (zeit_rec.js), which only the player's own worlds have.
  VR.SB_EDIT = 8; VR.SB_GUEST = 16;
  VR.EDIT = { HAND: 1, TOOL: 2, PLAN: 3, BENCH: 4, UNDO: 5, GUEST: 6 };

  // ----------------------------------------------------------------- worker pool
  // Two lanes share the workers: lane 0 is the terrain around the player (generate, light, mesh), lane 1 the far
  // horizon tiles. While both have work, the far lane gets a fixed share of the workers' time (so the horizon keeps
  // filling in during a flight instead of waiting behind every chunk); an idle lane hands its time to the other.
  // A queued job may carry msg.cancel(): if it says so when its turn comes, the job is dropped and its callback
  // hears {type:'cancelled'} — stale requests (the player flew on) never cost worker time.
  // A worker that throws (an uncaught error in a job) answers nothing for the jobs it held: their owners would wait
  // forever (a section never meshed, a column never loaded) and the slots would stay counted as busy. A worker that
  // died outright (out of memory, a crashed process) says nothing at all. So: an error frees the worker's slots and
  // answers its jobs with {type:'error'}; a job that has had no answer for stuckMs means a dead worker — it is
  // terminated and a fresh one takes its place, told the world again (the last init, custom, style, look and
  // lodinit broadcasts are kept for that).
  class WorkerPool {
    constructor(src, n) {
      this.workers = [];
      this.cb = new Map();
      this.nextId = 1;
      this.queue = [];        // lane 0
      this.queueFar = [];     // lane 1
      this.farShare = 0.3;    // fraction of worker time the far lane gets while lane 0 has work
      this.laneMs = [0, 0];   // recent worker time per lane (decayed)
      this.started = new Map();
      this.state = new Map(); // the broadcasts a new worker must hear, by type
      this.stuckMs = 45000;   // a job unanswered this long = a dead worker (a town column takes 2 s, the textures 3–8 s)
      this.replaced = 0;
      this.url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
      for (let i = 0; i < n; i++) this.workers.push(this.spawn(i));
    }
    spawn(i) {
      const w = new Worker(this.url);
      w.inflight = 0; w.idx = i;
      w.onmessage = (e) => this.onMsg(w, e.data);
      w.onerror = (e) => { console.error('Worker error', e && (e.message || e)); if (e && e.preventDefault) e.preventDefault(); this.failWorker(w, 'error'); };
      return w;
    }
    // every job this worker holds is answered with an error (its owner asks again) and its slots are free
    failWorker(w, why) {
      const ids = [];
      for (const [id, st] of this.started) if (st.w === w) ids.push(id);
      w.inflight = 0;
      for (const id of ids) {
        this.started.delete(id);
        const cb = this.cb.get(id);
        if (cb) { this.cb.delete(id); try { cb({ type: 'error', id, msg: 'worker ' + why }); } catch (err) { console.error(err); } }
      }
      this.pump();
    }
    // a worker that has answered nothing for stuckMs is dead: a fresh one takes its place
    replaceWorker(w) {
      const i = this.workers.indexOf(w); if (i < 0) return;
      try { w.terminate(); } catch (e) { /* already gone */ }
      const nw = this.spawn(w.idx);
      this.workers[i] = nw;
      this.replaced++;
      // a machine this slow (a weak PC, a crowded test box) is not a dead worker: each replacement doubles the patience,
      // up to five minutes, so the same long job is not killed again and again in a loop
      this.stuckMs = Math.min(300000, this.stuckMs * 2);
      for (const t of ['init', 'custom', 'looks', 'style', 'look', 'lodinit']) { const m = this.state.get(t); if (m) nw.postMessage(m); }
      console.warn('Worker', w.idx, 'did not answer for', (this.stuckMs / 1000) | 0, 's — replaced');
      this.failWorker(w, 'replaced');
    }
    onMsg(w, m) {
      if (m.type === 'log') { console.log('[worker]', m.msg); return; }
      if (!this.workers.includes(w)) return;   // a late word from a worker already replaced
      // a job waits for a town plan the worker is building a slice at a time (worker_main.js): it keeps its slot, and
      // its time out restarts (the plan is progressing, the worker is not stuck)
      if (m.type === 'waiting') { const st = this.started.get(m.id); if (st) st.t0 = performance.now(); return; }
      w.inflight = Math.max(0, w.inflight - 1);
      const st = this.started.get(m.id);
      if (st) { this.started.delete(m.id); if (!st.direct) { const ms = m.ms !== undefined ? m.ms : Math.min(400, (performance.now() - st.t0) / Math.max(1, st.q)); this.laneMs[st.lane] += ms; } }
      const cb = this.cb.get(m.id);
      if (cb) { this.cb.delete(m.id); try { cb(m); } catch (err) { console.error(err); } }
      if (m.type === 'error') console.error('Worker job failed:', m.msg);
      this.pump();
    }
    // job: {msg, transfer, cb, prio}; msg.lane = 1 puts it on the far lane
    submit(msg, transfer, cb, prio) { (msg.lane === 1 ? this.queueFar : this.queue).push({ msg, transfer, cb, prio: prio || 0 }); this.queueDirty = true; }
    broadcast(msg) { if (msg && msg.type && msg.type !== 'textures') this.state.set(msg.type, msg); for (const w of this.workers) w.postMessage(msg); }
    direct(wi, msg, transfer, cb) {
      const id = this.nextId++; msg.id = id; if (cb) this.cb.set(id, cb);
      const w = this.workers[wi]; w.inflight++; this.started.set(id, { lane: 0, t0: performance.now(), q: 1, w, direct: true }); w.postMessage(msg, transfer || []);
    }
    // jobs unanswered for too long: their workers are dead — replaced (checked from pump, i.e. every frame)
    watchdog() {
      if (!this.started.size) return;
      const now = performance.now();
      let dead = null;
      for (const st of this.started.values()) if (now - st.t0 > this.stuckMs) { (dead || (dead = new Set())).add(st.w); }
      if (dead) for (const w of dead) this.replaceWorker(w);
    }
    // the next job to run: the far lane when it is owed time (or lane 0 is empty), lane 0 otherwise; cancelled jobs are skipped
    _next() {
      for (;;) {
        const q0 = this.queue, q1 = this.queueFar;
        if (!q0.length && !q1.length) return null;
        let lane = 0;
        if (q1.length) {
          if (!q0.length) lane = 1;
          else { const tot = this.laneMs[0] + this.laneMs[1]; if (tot < 1 || this.laneMs[1] < tot * this.farShare) lane = 1; }
        }
        const job = (lane ? q1 : q0).shift();
        if (job.msg.cancel && job.msg.cancel()) { delete job.msg.cancel; if (job.cb) { try { job.cb({ type: 'cancelled' }); } catch (err) { console.error(err); } } continue; }
        job.lane = lane;
        return job;
      }
    }
    pump(maxInflight) {
      const lim = maxInflight || this.maxInflight || 2;
      this.watchdog();
      if (!this.queue.length && !this.queueFar.length) return;
      if (this.queueDirty) { this.queue.sort((a, b) => a.prio - b.prio); this.queueFar.sort((a, b) => a.prio - b.prio); this.queueDirty = false; }
      // the lane clock forgets: recent seconds count, not the whole session
      const tot = this.laneMs[0] + this.laneMs[1];
      if (tot > 3000) { this.laneMs[0] *= 0.5; this.laneMs[1] *= 0.5; }
      for (;;) {
        let best = null;
        for (const w of this.workers) if (w.inflight < lim && (!best || w.inflight < best.inflight)) best = w;
        if (!best) return;
        const job = this._next();
        if (!job) return;
        const id = this.nextId++; job.msg.id = id;
        delete job.msg.cancel;
        if (job.cb) this.cb.set(id, job.cb);
        this.started.set(id, { lane: job.lane, t0: performance.now(), q: best.inflight + 1, w: best });
        best.inflight++;
        best.postMessage(job.msg, job.transfer || []);
      }
    }
    get busy() { let n = this.queue.length + this.queueFar.length; for (const w of this.workers) n += w.inflight; return n; }
    get queued() { return this.queue.length + this.queueFar.length; }
    // drop every queued job (a world is torn down); running jobs finish and are ignored by their owners
    clear() { for (const q of [this.queue, this.queueFar]) { for (const job of q) { delete job.msg.cancel; } q.length = 0; } }
    terminate() { for (const w of this.workers) w.terminate(); this.workers = []; this.started.clear(); this.cb.clear(); }
  }
  VR.WorkerPool = WorkerPool;
  // The number of workers: one generation/mesh worker on a 2-core machine (the main thread needs the other core), two
  // on 3–4 cores, cores − 2 above that (at most 6). The quality preset caps it: potato 2, low 3 (less terrain to make
  // at those render distances, and every worker keeps caches of its own — up to ~120 MB of pieces each).
  VR.poolSize = function (cores, preset) {
    const c = cores >= 1 ? Math.floor(cores) : 4;
    const base = c <= 2 ? 1 : c <= 4 ? 2 : Math.min(c - 2, 6);
    const cap = preset === 'potato' ? 2 : preset === 'low' ? 3 : 6;
    return Math.max(1, Math.min(base, cap));
  };

  // ----------------------------------------------------------------- column / section
  class Section {
    constructor() { this.count = 0; this.dirty = true; this.ver = 1; this.meshVer = 0; this.pending = false; this.vis = 0x7fff; this.mesh = [null, null, null, null, null]; this.hasMesh = false; this.meshed = false; }
  }
  class Column {
    constructor(cx, cz) {
      this.cx = cx; this.cz = cz; this.key = ckey(cx, cz);
      this.blocks = null; this.light = null; this.biome = null; this.caveBiome = null;
      this.grass = null; this.foliage = null; this.water = null; this.height = new Uint16Array(256);
      this.H = 256;                   // storage height (blocks/light hold H × 256 cells; grows where the player builds higher)
      this.sh = new Uint8Array(512);  // per column: top of the sun-blocking layer, bottom of it (heightmap shadows)
      this.sec = []; for (let i = 0; i < 16; i++) this.sec.push(new Section());
      this.shownAt = -1; this.fade = 0;   // F8: when the column was shown (all sections meshed) and its fade-in (0..1)
      this.ready = false; this.modified = false; this.lastSeen = 0; this.blockEntities = new Map();
      this.seamed = 0; // bitmask of neighbor seams done (1 N,2 E,4 S,8 W)
    }
  }
  VR.Column = Column;

  // ----------------------------------------------------------------- world
  class World {
    constructor(game, o) {
      this.game = game;
      if (game.vents) game.vents.reset();   // a new world brings its own vents (vents.js)
      this.dim = o.dim || 'overworld';
      this.seed = o.seed >>> 0;
      this.genOpts = o.genOpts || {};
      this.hasSky = this.dim === 'overworld' || this.dim === 'drift' || this.dim === 'flat';
      this.cols = new Map();
      this.pending = new Map();       // key → true (gen requested)
      this.pool = o.pool;
      this.renderer = o.renderer;
      this.store = o.store;           // persistence (may be null)
      this.savedKeys = o.savedKeys || new Set();
      this.renderDist = o.renderDist || 8;
      // F8 · Sichtweite: finished meshes wait in a queue and go up a few milliseconds a frame (uploadBudget), columns in
      // their 300 ms fade-in are listed in `fading`, and the streaming rung is set by the governor (game.js)
      this.uploadQ = new VR.Stream.UploadScheduler({ msPerByte: 2e-6 });
      // F10: what an upload costs on this machine — measured once as the world starts (1 MB, gl.finish before and after;
      // renderer.calibrateUploads), then followed through the frames' fences (renderer.upGauge)
      if (this.renderer && this.renderer.calibrateUploads) { const cal = this.renderer.calibrateUploads(); if (cal) this.uploadQ.calibrate(cal.ms, cal.bytes); }
      this.fading = new Set(); this.streamRung = 0; this.viewDir = null; this.viewCos = 0.6;   // (viewCos: the cosine of the horizontal half field of view, game.js)
      this.listeners = [];
      this.frame = 0;
      this.stats = { gen: 0, mesh: 0, genMs: 0, meshMs: 0 };
      // light BFS queues
      this.qA = new Int32Array(1 << 16); this.qB = new Int32Array(1 << 16);
      this.changed = new Set();
      this.fancyLeaves = true; this.smooth = true;
      this.smoothProps = 0;   // t-smooth: the prop groups drawn smooth (1 palms, 2 furniture; game.js propMask)
      this.meshBudget = 6;
      this.lastCol = null;
      this.shDirty = new Set(); this.shGone = new Set(); // columns whose shadow heights must reach the GPU
    }
    // the sun-blocking layer at the top of a column: [top, bottom] of the highest run of solid blocks or
    // leaves (water and air let light through) — the renderer marches sun rays through these
    shadowCol(c, col) {
      const B = c.blocks, T = R.T, M = F.SOLID | F.LEAVES;
      const occ = (s) => s && (T.flags[s] & M) && !(T.flags[s] & F.FLUID);
      let y = c.height[col];
      while (y > 0 && !occ(B[(y << 8) | col])) y--;
      let b = y;
      while (b > 0 && occ(B[((b - 1) << 8) | col])) b--;
      c.sh[col * 2] = Math.min(255, y); c.sh[col * 2 + 1] = Math.min(255, b);
    }
    // ---------- access ----------
    col(cx, cz) {
      const lc = this.lastCol;
      if (lc && lc.cx === cx && lc.cz === cz) return lc;
      const c = this.cols.get(ckey(cx, cz));
      if (c && c.ready) { this.lastCol = c; return c; }
      return null;
    }
    getBlock(x, y, z) {
      if (y < 0) return 0;
      const c = this.col(x >> 4, z >> 4);
      if (!c || y >= c.H) return 0;
      return c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)];
    }
    getLight(x, y, z) {
      if (y < 0) return 0;
      const c = this.col(x >> 4, z >> 4);
      if (!c) return this.hasSky ? 0xf000 : 0;
      if (y >= c.H) return 0xf000;
      return c.light[(y << 8) | ((z & 15) << 4) | (x & 15)];
    }
    // make room above a column's storage (the player builds higher than anything there): air in daylight, empty
    // sections; 32 blocks of headroom so a tower does not reallocate on every block
    growColumn(c, y) {
      if (y < c.H || y >= VR.MAXY) return y < c.H;
      const H = Math.min(VR.MAXY, Math.ceil((y + 33) / 16) * 16);
      const nb = new Uint16Array(H << 8), nl = new Uint16Array(H << 8);
      nb.set(c.blocks); nl.set(c.light);
      if (this.hasSky) nl.fill(0xf000, c.H << 8);
      c.blocks = nb; c.light = nl;
      for (let sy = c.H >> 4; sy < H >> 4; sy++) { const s = new Section(); s.dirty = false; s.meshed = true; c.sec.push(s); }
      c.H = H;
      if ((H >> 4) > (this.maxSec || 16)) this.maxSec = H >> 4;
      this.visDirty = true;
      return true;
    }
    isLoaded(x, z) { return !!this.col(x >> 4, z >> 4); }
    // how much terrain shades a point from the sun (0 = full sun, 1 = shade): the same heightmap ray
    // march the shaders do, for characters and props that are drawn as one piece
    sunShade(x, y, z, L) {
      if (!this.hasSky || L[1] < 0.02) return 0;
      const hs = Math.hypot(L[0], L[2]);
      let dt = Math.max(0.3, Math.min(1, 1 / Math.max(hs, 1e-3), 0.75 / L[1])), t = dt * 0.5, res = 1;
      const yTop = (this.shTop || 255) + 1;
      for (let i = 0; i < 48; i++) {
        const qx = x + L[0] * t, qy = y + L[1] * t, qz = z + L[2] * t;
        if (qy > yTop || t > 80) break;
        const fx = Math.floor(qx), fz = Math.floor(qz);
        const c = this.col(fx >> 4, fz >> 4);
        if (c) {
          const k = (((fz & 15) << 4) | (fx & 15)) * 2, h = c.sh[k];
          if (h > 0) {
            const top = h + 1, bot = c.sh[k + 1], hw = L[1] * dt * 0.5;
            if (qy - hw < top && qy + hw > bot) return 1;
            res = Math.min(res, (qy >= top ? qy - top : bot - qy) * 7 / t);
          }
        }
        t += dt; dt = Math.min(dt * 1.07, 4);
      }
      return 1 - Math.max(0, Math.min(1, res));
    }
    biomeAt(x, z) { const c = this.col(x >> 4, z >> 4); return c ? c.biome[((z & 15) << 4) | (x & 15)] : 0; }
    topAt(x, z) { const c = this.col(x >> 4, z >> 4); return c ? c.height[((z & 15) << 4) | (x & 15)] : 0; }
    sectionAt(cx, sy, cz) { const c = this.col(cx, cz); return c && sy >= 0 && sy < c.sec.length ? c.sec[sy] : null; }
    nbFn() { return this._nb || (this._nb = (x, y, z, d) => this.getBlock(x + VR.HF_DX[d], y, z + VR.HF_DZ[d])); }

    // ---------- streaming ----------
    // The loading centre runs ahead of a moving player (up to half the radius, in the direction of travel), so a
    // flight finds its terrain ready in front and lets go of it behind; the priority of a request is its distance,
    // discounted for columns ahead. Requests that drift out of range are cancelled before a worker touches them.
    update(px, py, pz, now) {
      this.frame++;
      // F10: the interval since the last update is the frame the last uploads shared: the scheduler's frame factor, its
      // adaptive scale and the hitch meter learn from it
      if (this.lastUpd !== undefined && now > this.lastUpd) this.uploadQ.frame(now - this.lastUpd, now);
      this.lastUpd = now;
      this.stepFades(now);
      this.drainUploads(px, pz, now);
      const pcx = Math.floor(px) >> 4, pcz = Math.floor(pz) >> 4;
      this.center = [pcx, pcz];
      const rd = this.renderDist, loadR = rd + 1;
      // smoothed movement (blocks per second) → look-ahead
      const lp = this.lastPos;
      if (lp && now > lp[3]) {
        const dt = Math.min(0.25, (now - lp[3]) / 1000);
        if (dt > 0) { const vx = (px - lp[0]) / dt, vz = (pz - lp[2]) / dt; const sp = Math.hypot(vx, vz); const k = Math.hypot(px - lp[0], pz - lp[2]) > 64 ? 1 : 0.15; this.mvx = (this.mvx || 0) + ((sp < 200 ? vx : 0) - (this.mvx || 0)) * k; this.mvz = (this.mvz || 0) + ((sp < 200 ? vz : 0) - (this.mvz || 0)) * k; }
      }
      this.lastPos = [px, py, pz, now];
      const speed = Math.hypot(this.mvx || 0, this.mvz || 0);
      const ahead = speed > 2 ? Math.min(rd * 0.5, speed * 1.6 / 16) : 0;   // chunks of look-ahead (1.6 s of travel)
      const ux = ahead ? (this.mvx / speed) : 0, uz = ahead ? (this.mvz / speed) : 0;
      const lcx = Math.round(pcx + ux * ahead), lcz = Math.round(pcz + uz * ahead);
      this.loadCenter = [lcx, lcz];
      // request missing columns (nearest first, bounded) — the scan runs every other frame
      const want = [];
      if (this.frame & 1) for (let dz = -loadR; dz <= loadR; dz++) for (let dx = -loadR; dx <= loadR; dx++) {
        const d2 = dx * dx + dz * dz;
        if (d2 > (loadR + 0.5) * (loadR + 0.5)) continue;
        const cx = lcx + dx, cz = lcz + dz, k = ckey(cx, cz);
        const c = this.cols.get(k);
        if (c) { c.lastSeen = now; continue; }
        if (this.pending.has(k)) continue;
        if (this.failed && this.retryAfter(k, now) > now) continue;
        // columns ahead of the flight come first: their distance is measured from a point further ahead
        const ex = cx - pcx, ez = cz - pcz;
        const along = ahead ? Math.max(0, ex * ux + ez * uz) : 0;
        want.push([ex * ex + ez * ez - along * along * 0.5, cx, cz, k]);
      }
      if (want.length > 1) want.sort((a, b) => a[0] - b[0]);
      if (this.frame & 1) this.lastWant = want.length;
      const maxReq = Math.max(6, this.pool.workers.length * 4);
      let inflight = this.pending.size;
      for (const [d2, cx, cz, k] of want) {
        if (inflight >= maxReq) break;
        this.requestColumn(cx, cz, k, d2);
        inflight++;
      }
      // unload far columns (measured from the player and from the loading centre, so look-ahead never thrashes)
      if (this.frame % 30 === 0) {
        const ur = rd + 3, ur2 = ur * ur, ul2 = (loadR + 2) * (loadR + 2);
        for (const [k, c] of this.cols) {
          const dx = c.cx - pcx, dz = c.cz - pcz, ex = c.cx - lcx, ez = c.cz - lcz;
          if (dx * dx + dz * dz > ur2 && ex * ex + ez * ez > ul2) this.unloadColumn(c);
        }
      }
      // sections meshed without their mini-voxel detail get it back once the player is close (nearest first)
      if (this.frame % 8 === 0) this.detailReturn(px, py, pz);
      // schedule meshing (block edits mark sections dirty and ask for an urgent mesh themselves)
      this.scheduleMeshes(pcx, Math.floor(py) >> 4, pcz, lcx, lcz, [px, py, pz]);
      this.pool.pump();
    }
    // when a column whose generation failed may be asked for again (5 s after the failure; a failed worker is
    // replaced meanwhile, a bug in one column costs a job every few seconds instead of every frame)
    retryAfter(k, now) { const t = this.failed && this.failed.get(k); if (t === undefined) return now; if (now - t > 5000) { this.failed.delete(k); return now; } return t + 5000; }
    requestColumn(cx, cz, k, prio) {
      this.pending.set(k, true);
      const epoch = this.styleEpoch || 0;
      const onGen = (m) => {
        this.pending.delete(k);
        if (m.type === 'error') { (this.failed || (this.failed = new Map())).set(k, performance.now()); return; }   // asked again after a pause
        if (m.type !== 'gen') return;
        if (!this.pending && !this.cols) return;
        if (this.dead) return;
        if (epoch !== (this.styleEpoch || 0)) return;   // made under the old style: asked for again by the streaming
        this.onColumn(m);
      };
      // a request the player has flown away from is dropped when its turn comes
      const cancel = () => { if (this.dead) return true; const lc = this.loadCenter || this.center; if (!lc) return false; const dx = cx - lc[0], dz = cz - lc[1], r = this.renderDist + 3; return dx * dx + dz * dz > r * r; };
      if (this.savedKeys.has(k) && this.store) {
        this.store.loadColumn(this.dim, cx, cz).then((blocks) => {
          if (this.dead) return;
          if (!blocks) { this.pool.submit({ type: 'gen', dim: this.dim, cx, cz, cancel }, null, onGen, prio); return; }
          const be = blocks.blockEntities, sv = blocks.sv || 0;
          this.pool.submit({ type: 'relight', dim: this.dim, cx, cz, blocks, sv, cancel }, [blocks.buffer], (m) => { if (m.type === 'gen') { m.saved = true; m.be = be; } onGen(m); }, prio);
        }).catch(() => { this.pool.submit({ type: 'gen', dim: this.dim, cx, cz, cancel }, null, onGen, prio); });
      } else {
        this.pool.submit({ type: 'gen', dim: this.dim, cx, cz, cancel }, null, onGen, prio);
      }
    }
    onColumn(m) {
      const k = ckey(m.cx, m.cz);
      if (this.cols.has(k)) return;
      const c = new Column(m.cx, m.cz);
      c.blocks = m.blocks; c.light = m.light; c.biome = m.biome; c.caveBiome = m.caveBiome;
      c.H = m.blocks.length >> 8;
      for (let sy = 16; sy < c.H >> 4; sy++) c.sec.push(new Section());
      if ((c.H >> 4) > (this.maxSec || 16)) this.maxSec = c.H >> 4;
      c.grass = m.grass; c.foliage = m.foliage; c.water = m.water;
      c.modified = !!m.saved; c.saved = !!m.saved;
      c.sv = m.sv || 0;
      c.lastSeen = performance.now();
      // section counts + heightmap
      const B = c.blocks, T = R.T;
      for (let sy = 0; sy < c.sec.length; sy++) {
        let n = 0; const o = sy << 12;
        for (let i = 0; i < 4096; i++) if (B[o + i]) n++;
        c.sec[sy].count = n;
      }
      for (let col = 0; col < 256; col++) {
        let y = c.H - 1;
        while (y > 0) { const s = B[(y << 8) | col]; if (s && (T.flags[s] & (F.SOLID | F.FLUID | F.LEAVES))) break; y--; }
        c.height[col] = y;
      }
      for (let col = 0; col < 256; col++) this.shadowCol(c, col);
      this.shDirty.add(c.key); this.shGone.delete(c.key);
      c.ready = true;
      this.checkShown(c, performance.now());   // a column with nothing to mesh is shown at once
      c.spawns = m.spawns && m.spawns.length ? m.spawns : null;
      if (c.spawns && this.game.vents) this.game.vents.absorb(c.spawns);   // the lava vents of the canyon (vents.js)
      this.cols.set(k, c);
      this.lastCol = null;
      if (m.be) for (const [k2, v] of m.be) c.blockEntities.set(k2, v);
      if (m.chests && m.chests.length) for (const ch of m.chests) c.blockEntities.set(((ch[1] << 8) | ((ch[2] & 15) << 4) | (ch[0] & 15)), { type: 'chest', loot: ch[3] || 'dungeon', items: null });
      // seam light with ready neighbors
      this.seamLight(c);
      this.flushChanged();
      for (const s of c.sec) { s.dirty = true; s.ver++; }
      // neighbor border sections need remesh
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const n = this.col(c.cx + dx, c.cz + dz);
        if (n) for (const s of n.sec) { s.dirty = true; s.ver++; }
      }
      for (const l of this.listeners) if (l.onColumnLoaded) l.onColumnLoaded(c);
    }
    unloadColumn(c) {
      // (a construction site in it is finished first — baustelle.js: the save holds the whole building)
      for (const l of this.listeners) if (l.onColumnUnloading) l.onColumnUnloading(c);
      // a saved column comes back from the save when the player returns (it was regenerated before: edits vanished)
      // (a 📽 replay copy — c.zr — is never saved)
      if (c.modified && this.store && !c.zr) { this.store.saveColumn(this.dim, c); this.savedKeys.add(c.key); }
      for (const s of c.sec) if (s.hasMesh) this.renderer.freeSection(s);
      this.cols.delete(c.key); this.fading.delete(c);
      this.lastCol = null;
      this.shDirty.delete(c.key); this.shGone.add(c.key);
      for (const l of this.listeners) if (l.onColumnUnloaded) l.onColumnUnloaded(c);
    }
    // the world's style changed (v0.34): every loaded column is brought up to the new rules in place — the worker
    // compares it with what the generator makes and changes only what the player left alone — then lit and meshed
    // again; columns still on their way are asked for again
    restyle() {
      this.styleEpoch = (this.styleEpoch || 0) + 1;
      const epoch = this.styleEpoch;
      for (const k of [...this.pending.keys()]) this.pending.delete(k);
      const p = this.center || [0, 0];
      const cols = [...this.cols.values()].sort((a, b) => ((a.cx - p[0]) ** 2 + (a.cz - p[1]) ** 2) - ((b.cx - p[0]) ** 2 + (b.cz - p[1]) ** 2));
      cols.forEach((c, i) => {
        const blocks = c.blocks.slice();
        this.pool.submit({ type: 'relight', dim: this.dim, cx: c.cx, cz: c.cz, blocks, sv: c.sv || 0 }, [blocks.buffer], (m) => {
          if (m.type !== 'gen' || this.dead || epoch !== this.styleEpoch || this.cols.get(c.key) !== c) return;
          c.blocks = m.blocks; c.light = m.light; c.water = m.water; c.grass = m.grass; c.foliage = m.foliage;
          if (m.restyled) c.modified = true;
          c.sv = m.sv || 0;
          const B = c.blocks, T = R.T;
          for (let sy = 0; sy < c.sec.length; sy++) { let n = 0; const o = sy << 12; for (let j = 0; j < 4096; j++) if (B[o + j]) n++; c.sec[sy].count = n; }
          for (let col = 0; col < 256; col++) { let y = c.H - 1; while (y > 0) { const s = B[(y << 8) | col]; if (s && (T.flags[s] & (F.SOLID | F.FLUID | F.LEAVES))) break; y--; } c.height[col] = y; this.shadowCol(c, col); }
          this.shDirty.add(c.key);
          for (const s of c.sec) { s.dirty = true; s.ver++; }
          for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const n = this.col(c.cx + dx, c.cz + dz); if (n && n !== c) for (const s of n.sec) { s.dirty = true; s.ver++; } }
          for (const l of this.listeners) if (l.onColumnRestyled) l.onColumnRestyled(c);
        }, (c.cx - p[0]) * (c.cx - p[0]) + (c.cz - p[1]) * (c.cz - p[1]));
        void i;
      });
    }
    saveAll() {
      if (!this.store) return Promise.resolve();
      // the listeners finish what is half done first (a construction site: the save holds the whole building)
      for (const l of this.listeners) if (l.onBeforeSave) l.onBeforeSave(this);
      const ps = []; for (const c of this.cols.values()) if (c.modified && !c.zr) { ps.push(this.store.saveColumn(this.dim, c)); this.savedKeys.add(c.key); } return Promise.all(ps);
    }
    destroy() { this.dead = true; this.uploadQ.clear(); for (const c of this.cols.values()) for (const s of c.sec) if (s.hasMesh) this.renderer.freeSection(s); this.cols.clear(); }   // (F10: what waited in parts gives its ranges back)

    // ---------- streaming: the fade-in and the upload budget (F8 · Sichtweite) ----------
    // A column is shown once every one of its sections is meshed (or known empty). From then on it fades in over 300 ms:
    // the terrain shader dithers its sections in and the far tiles under it are cut by the same thresholds (horizon.js,
    // shaders.js), so nothing pops and no hole shows. Until it is shown its sections stay invisible (fade 0) and the far
    // tiles stand in for it.
    checkShown(c, now) {
      if (c.shownAt >= 0) return;
      for (let i = 0; i < c.sec.length; i++) if (!c.sec[i].meshed) return;
      c.shownAt = now; c.fade = 0; this.fading.add(c);
      for (let i = 0; i < c.sec.length; i++) c.sec[i].fade = 0;
    }
    stepFades(now) {
      if (!this.fading.size) return;
      for (const c of this.fading) {
        const f = Math.round(255 * VR.Stream.fadeCurve(now - c.shownAt)) / 255;   // 8-bit: the value the far mask holds
        if (f === c.fade) continue;
        c.fade = f;
        for (let i = 0; i < c.sec.length; i++) c.sec[i].fade = f;
        if (f >= 1) this.fading.delete(c);
      }
    }
    // the upload budget of one frame, in ms: the preset's (renderer.q.upload) times the streaming rung the governor set
    uploadBudget() {
      const base = (this.renderer && this.renderer.q && this.renderer.q.upload) || 2.5;
      return base * VR.Stream.streamScale(this.streamRung);
    }
    // uploads go up in view order (F10: the columns in the view first, nearest first, behind last) within the frame's
    // bytes; the rest waits. An item whose column was unloaded (or whose section has a newer mesh) drops out of the queue
    // and gives its staged ranges back. The numbers land in renderer.stats for the ⚙ line (F3) and the tests.
    drainUploads(px, pz, now) {
      const q = this.uploadQ, a = q.items;
      for (let i = 0; i < a.length; i++) { const it = a[i]; it.dx = it.x - px; it.dz = it.z - pz; }
      const vd = this.viewDir;
      const r = q.drain(this.uploadBudget(), this._clk || (this._clk = () => performance.now()), vd ? vd[0] : 0, vd ? vd[1] : 0, this.viewCos);
      this.stats.uploadMs = r.spentMs; this.stats.uploadQueue = r.left;
      this.stats.uploaded = (this.stats.uploaded || 0) + r.ran;
      const rs = this.renderer && this.renderer.stats;
      if (rs) {
        rs.uploadMs = r.spentMs; rs.uploadKB = r.bytes / 1024; rs.upBudgetKB = r.budgetBytes / 1024; rs.upQueue = r.left;
        rs.upMBs = q.mbps(); rs.upScale = q.scale; rs.hitches = q.hitches(now !== undefined ? now : performance.now());
      }
    }

    // ---------- meshing ----------
    // Dirty sections inside the render radius (around the player and around the loading centre ahead) are meshed
    // nearest first. The budget follows the workers, not the frame rate: the queue is topped up to a few jobs per
    // worker whenever it runs low, so a slow frame never starves them. Sections far from the player are meshed
    // without their mini-voxel detail (the averaged boxes draw there anyway) and get it when the player comes close.
    scheduleMeshes(pcx, pcy, pcz, lcx, lcz, pos) {
      const nw = this.pool.workers.length;
      const room = nw * 10 - (this.meshInflight || 0);      // ~two frames of mesh work per worker in flight, never more
      let budget = Math.min(room, 8 + nw * 8);
      if (this.meshBudget <= 3) budget = Math.min(budget, this.meshBudget * 2);   // smart quality asked for less main-thread work
      // F8: a job starts on the main thread (its padded block copy), so the starts share the frame's streaming budget too:
      // four jobs per millisecond of the upload budget (6 on Very Low), fewer as the governor drops the streaming rung
      budget = Math.min(budget, Math.max(2, Math.round(this.uploadBudget() * 4)));
      if (budget <= 0) return;                               // the workers are full: not even a look around (most frames while the world streams in)
      const rd = this.renderDist, r2 = (rd + 0.5) * (rd + 0.5);
      if (lcx === undefined) { lcx = pcx; lcz = pcz; }
      // the `budget` nearest dirty sections, kept in a short sorted list while the columns are scanned (a sort of every
      // dirty section — thousands after a look switch — cost more than a frame on a small machine); ties keep scan
      // order, as the stable sort did
      const best = this._best || (this._best = []);
      best.length = 0;
      let worst = Infinity;
      for (const c of this.cols.values()) {
        const dx = c.cx - pcx, dz = c.cz - pcz, ex = c.cx - lcx, ez = c.cz - lcz;
        const d2 = Math.min(dx * dx + dz * dz, ex * ex + ez * ez);
        if (d2 > r2) continue;
        if (best.length === budget && d2 >= worst) continue;   // nothing in this column can beat the list
        let anyDirty = false;
        for (let sy = 0; sy < c.sec.length; sy++) { const s = c.sec[sy]; if (s.dirty && !s.pending) { anyDirty = true; break; } }
        if (!anyDirty) continue;
        // all 8 neighbors must be ready
        let ok = true;
        for (let oz = -1; oz <= 1 && ok; oz++) for (let ox = -1; ox <= 1; ox++) { if (!ox && !oz) continue; if (!this.col(c.cx + ox, c.cz + oz)) { ok = false; break; } }
        if (!ok) continue;
        for (let sy = 0; sy < c.sec.length; sy++) {
          const s = c.sec[sy];
          if (!s.dirty || s.pending) continue;
          const dy = sy - pcy, prio = d2 + dy * dy * 0.5;
          if (best.length === budget) { if (prio >= worst) continue; best.pop(); }
          let i = best.length;
          while (i > 0 && best[i - 1][0] > prio) i--;
          best.splice(i, 0, [prio, c, sy]);
          if (best.length === budget) worst = best[budget - 1][0];
        }
      }
      for (let i = 0; i < best.length; i++) { const b = best[i]; this.meshSection(b[1], b[2], false, b[0], pos); }   // same scale as the generation requests: nearest work first, whatever its kind
      best.length = 0;
    }
    // far-meshed sections inside the inner part of the keep ring are re-meshed with their detail
    detailReturn(px, py, pz) {
      const D = (this.renderer && this.renderer.q && this.renderer.q.vxLod) || 48, back = (D * 1.5 + 16) * 0.8, back2 = back * back;
      const cr = Math.ceil(back / 16) + 1, pcx = Math.floor(px) >> 4, pcz = Math.floor(pz) >> 4;
      for (const c of this.cols.values()) {
        const dx = c.cx - pcx, dz = c.cz - pcz;
        if (dx * dx + dz * dz > cr * cr) continue;
        const ex = c.cx * 16 + 8 - px, ez = c.cz * 16 + 8 - pz;
        for (let sy = 0; sy < c.sec.length; sy++) {
          const s = c.sec[sy];
          if (!s.vxDropped || s.pending) continue;
          const ey = sy * 16 + 8 - py;
          if (ex * ex + ey * ey * 0.5 + ez * ez < back2) { s.vxDropped = false; s.dirty = true; s.ver++; }
        }
      }
    }
    // does the section want its mini-voxel detail meshed? (inside the renderer's detail keep ring)
    wantDetail(c, sy, pos) {
      if (!pos) return true;
      const D = (this.renderer && this.renderer.q && this.renderer.q.vxLod) || 48, keep = D * 1.5 + 16;
      const dx = c.cx * 16 + 8 - pos[0], dy = sy * 16 + 8 - pos[1], dz = c.cz * 16 + 8 - pos[2];
      return dx * dx + dy * dy * 0.5 + dz * dz < keep * keep;
    }
    meshSection(c, sy, urgent, prio, pos, hand) {
      const s = c.sec[sy];
      s.dirty = false;
      // empty section with empty neighbors above/below → no geometry
      if (s.count === 0) {
        s.uTok = (s.uTok || 0) + 1;   // a queued upload of an older mesh must not bring it back
        if (s.hasMesh) this.renderer.freeSection(s);
        s.vis = 0x7fff; s.meshVer = s.ver; s.meshed = true; s.vxDropped = false;
        this.checkShown(c, performance.now());
        return;
      }
      const detail = urgent || this.wantDetail(c, sy, pos || (this.lastPos ? this.lastPos : null));
      const job = this.buildJob(c, sy);
      job.vxDetail = detail;
      s.pending = true;
      const ver = s.ver;
      job.cancel = () => { if (this.dead || this.cols.get(c.key) !== c) { s.pending = false; return true; } return false; };
      this.meshInflight = (this.meshInflight || 0) + 1;
      this.pool.submit(job, [job.blocks.buffer, job.light.buffer, job.grass.buffer, job.foliage.buffer, job.water.buffer], (m) => {
        s.pending = false;
        this.meshInflight = Math.max(0, this.meshInflight - 1);
        if (m.type !== 'mesh') {
          if (m.type === 'cancelled') s.dirty = true;
          // a job that failed (a worker that died or threw) is tried again — a few times, not forever
          else if (m.type === 'error') { s.fails = (s.fails || 0) + 1; if (s.fails <= 3) s.dirty = true; }
          return;
        }
        if (this.cols.get(c.key) !== c || this.dead) return;
        s.fails = 0;
        this.stats.mesh++; this.stats.meshMs += m.ms || 0;
        s.vis = m.vis;
        const tok = s.uTok = (s.uTok || 0) + 1;   // only the newest queued mesh of a section is uploaded
        // the upload waits in the streaming queue (drainUploads spends the frame's bytes on it, in view order): meshing
        // itself never blocks; a newer mesh of the section makes this one stale (alive), so an older mesh never lands
        // after a newer one
        const R = this.renderer, alive = () => !this.dead && this.cols.get(c.key) === c && s.uTok === tok;
        const done = () => {
          if (!detail && m.vxFar && m.vxFar.length) s.vxDropped = true;   // comes back for its detail when the player gets close
          s.meshVer = ver; s.meshed = true;
          s.fade = c.shownAt >= 0 ? c.fade : 0;
          if (s.ver !== ver) s.dirty = true;
          this.checkShown(c, performance.now());
          this.visDirty = true;
        };
        const it = { key: c.key, col: c, x: c.cx * 16 + 8, z: c.cz * 16 + 8, urgent: !!hand, alive };   // (hand: the player's own edit goes first and whole)
        if (R.newStage) {
          // F10: in packets that may straddle frames; the section draws its old mesh until the last byte is up
          const st = R.newStage(m.opaque, m.cutout, m.trans, m.vx, m.vxFar, m.props);
          it.bytes = st.bytes;
          it.step = (max) => R.stagePart(st, max);
          it.commit = () => { R.commitStage(st, s, c, sy); done(); };
          it.abort = () => R.dropStage(st);
        } else {
          const bl = (a) => (a ? (a.byteLength !== undefined ? a.byteLength : a.length * 4) : 0);
          it.bytes = bl(m.opaque) + bl(m.cutout) + bl(m.trans) + bl(m.vx) + bl(m.vxFar);
          it.run = () => { if (!alive()) return; R.uploadSection(s, c, sy, m.opaque, m.cutout, m.trans, m.vx, m.vxFar, m.props); done(); };
        }
        this.uploadQ.push(it);
      }, urgent ? -1e9 : (prio || 0));
    }
    // the padded section for the mesher: 20³ blocks and light (16 + 2 of the neighbours on every side), 20² tints.
    // A row of 16 blocks along x is one contiguous run in a column (y-major, then z, then x), so the middle of every
    // padded row is one straight copy; only the two pad cells at each end come from the side neighbours one by one.
    buildJob(c, sy) {
      const blocks = new Uint16Array(PS * PS * PS), light = new Uint16Array(PS * PS * PS);
      const grass = new Uint16Array(PS * PS), foliage = new Uint16Array(PS * PS), water = new Uint16Array(PS * PS);
      const nb = [];
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) nb.push(this.col(c.cx + dx, c.cz + dz));
      const y0 = sy * 16 - PAD;
      const skyFull = this.hasSky ? 0xf000 : 0;
      for (let pz = 0; pz < PS; pz++) {
        const lz = pz - PAD, cz = lz < 0 ? 0 : lz > 15 ? 2 : 1, iz = (lz + 16) & 15;
        const nL = nb[cz * 3], nM = nb[cz * 3 + 1], nR = nb[cz * 3 + 2];
        // tints
        const tz = pz * PS;
        for (let px = 0; px < PS; px++) {
          const lx = px - PAD, n = lx < 0 ? nL : lx > 15 ? nR : nM, ix = (lx + 16) & 15;
          if (n) { const ci = (iz << 4) | ix, ti = tz + px; grass[ti] = n.grass[ci]; foliage[ti] = n.foliage[ci]; water[ti] = n.water[ci]; }
        }
        for (let py = 0; py < PS; py++) {
          const y = y0 + py, o = py * PSS + tz;
          if (y < 0) continue;   // below the world: air, no light (the arrays start at zero)
          // the middle 16: the column itself
          if (nM && y < nM.H) { const i = (y << 8) | (iz << 4), mb = nM.blocks, ml = nM.light, d = o + PAD; for (let k = 0; k < 16; k++) { blocks[d + k] = mb[i + k]; light[d + k] = ml[i + k]; } }
          else { const v = nM ? 0xf000 : skyFull, d = o + PAD; for (let k = 0; k < 16; k++) light[d + k] = v; }
          // the pads: PAD cells of the west and east neighbours
          for (let k = 0; k < PAD; k++) {
            const iL = (y << 8) | (iz << 4) | (16 - PAD + k), iR = (y << 8) | (iz << 4) | k;
            if (nL && y < nL.H) { blocks[o + k] = nL.blocks[iL]; light[o + k] = nL.light[iL]; } else light[o + k] = nL ? 0xf000 : skyFull;
            if (nR && y < nR.H) { blocks[o + PAD + 16 + k] = nR.blocks[iR]; light[o + PAD + 16 + k] = nR.light[iR]; } else light[o + PAD + 16 + k] = nR ? 0xf000 : skyFull;
          }
        }
      }
      return { type: 'mesh', key: c.key, sy, ver: c.sec[sy].ver, blocks, light, grass, foliage, water, ox: c.cx * 16, oz: c.cz * 16, fancyLeaves: this.fancyLeaves, smooth: this.smooth, smoothProps: this.smoothProps === true ? 1 : (this.smoothProps | 0), vxLod: true };
    }
    markDirty(x, y, z) {
      const sy = y >> 4;
      const c = this.col(x >> 4, z >> 4);
      if (!c) return;
      const s = c.sec[sy]; if (!s) return; s.dirty = true; s.ver++;
    }
    markDirtyAround(x, y, z) {
      const lx = x & 15, ly = y & 15, lz = z & 15;
      this.markDirty(x, y, z);
      if (lx === 0) this.markDirty(x - 1, y, z); else if (lx === 15) this.markDirty(x + 1, y, z);
      if (lz === 0) this.markDirty(x, y, z - 1); else if (lz === 15) this.markDirty(x, y, z + 1);
      if (ly === 0 && y > 0) this.markDirty(x, y - 1, z); else if (ly === 15) this.markDirty(x, y + 1, z);
      // diagonal neighbors for AO/smooth light at corners
      if ((lx === 0 || lx === 15) && (lz === 0 || lz === 15)) this.markDirty(x + (lx === 0 ? -1 : 1), y, z + (lz === 0 ? -1 : 1));
    }

    // ---------- block set ----------
    // flags: 1 = no light update, 2 = no neighbor notify, 4 = urgent remesh, 8 = a building change (VR.SB_EDIT:
    // recorded for 📽), 16 = by a friend (VR.SB_GUEST)
    setBlock(x, y, z, state, flags) {
      if (y < 0 || y >= VR.MAXY) return false;
      const c = this.col(x >> 4, z >> 4);
      if (!c) return false;
      if (y >= c.H) { if (!state) return false; this.growColumn(c, y); }
      const i = (y << 8) | ((z & 15) << 4) | (x & 15);
      const old = c.blocks[i];
      if (old === state) return false;
      c.blocks[i] = state;
      c.modified = true;
      if ((flags & 8) && this.zr) this.zr.one(x, y, z, old, state, this.dim, (flags & 16) ? 6 : 1);
      const s = c.sec[y >> 4];
      if (!old && state) s.count++; else if (old && !state) s.count--;
      // heightmap
      const T = R.T, col = i & 255;
      const blocksRain = (st) => st && (T.flags[st] & (F.SOLID | F.FLUID | F.LEAVES));
      if (blocksRain(state) && y > c.height[col]) c.height[col] = y;
      else if (y === c.height[col] && !blocksRain(state)) { let yy = y - 1; while (yy > 0 && !blocksRain(c.blocks[(yy << 8) | col])) yy--; c.height[col] = yy; }
      if (y + 1 >= c.sh[col * 2 + 1]) { const t0 = c.sh[col * 2], b0 = c.sh[col * 2 + 1]; this.shadowCol(c, col); if (c.sh[col * 2] !== t0 || c.sh[col * 2 + 1] !== b0) this.shDirty.add(c.key); }
      if (!(flags & 1)) this.updateLight(x, y, z, old, state);
      this.markDirtyAround(x, y, z);
      this.flushChanged();
      if (flags & 4) this.urgentRemesh(x, y, z, (flags & 8) !== 0);   // (8 = SB_EDIT: the player's own edit — its upload goes whole, F10)
      if (!(flags & 2)) for (const l of this.listeners) if (l.onBlockChanged) l.onBlockChanged(x, y, z, old, state);
      return true;
    }
    // bulk edit without per-block light updates; columns are relit in workers afterwards. kind (VR.EDIT): a building
    // change, recorded as one batch for 📽 — or, with defer (a Set), the touched columns go into it and the caller
    // relights them once (a wonder rising in thirty slices). bulkSet(list, notify, kindOrDefer, defer)
    bulkSet(list, notify, kind, defer) {
      if (kind && typeof kind === 'object' && typeof kind.add === 'function') { defer = kind; kind = undefined; }
      const touched = new Map();
      const T = R.T, Z = kind ? this.zr : null;
      let zb = false;
      for (const [x, y, z, state] of list) {
        if (y < 0 || y >= VR.MAXY) continue;
        const c = this.col(x >> 4, z >> 4); if (!c) continue;
        if (y >= c.H) { if (!state) continue; this.growColumn(c, y); }
        const i = (y << 8) | ((z & 15) << 4) | (x & 15);
        const old = c.blocks[i]; if (old === state) continue;
        c.blocks[i] = state; c.modified = true;
        if (Z) { if (!zb) { Z.begin(kind, this.dim); zb = true; } Z.add(x, y, z, old, state); }
        const s = c.sec[y >> 4];
        if (!old && state) s.count++; else if (old && !state) s.count--;
        const col = i & 255;
        const br = (st) => st && (T.flags[st] & (F.SOLID | F.FLUID | F.LEAVES));
        if (br(state) && y > c.height[col]) c.height[col] = y;
        else if (y === c.height[col] && !br(state)) { let yy = y - 1; while (yy > 0 && !br(c.blocks[(yy << 8) | col])) yy--; c.height[col] = yy; }
        if (y + 1 >= c.sh[col * 2 + 1]) { this.shadowCol(c, col); this.shDirty.add(c.key); }
        touched.set(c.key, c);
        if (notify) for (const l of this.listeners) if (l.onBlockChanged) l.onBlockChanged(x, y, z, old, state);
      }
      if (zb) Z.end();
      if (defer) { for (const c of touched.values()) defer.add(c); return touched.size; }
      this.relightColumns([...touched.values()]);
      return touched.size;
    }
    // 🏗 the Baustelle's write (baustelle.js): cells a … b of a list, a layer at a time — blocks, height map, sun-shadow
    // columns and the sections to remesh, without the whole-column relight bulkSet does (that twenty times a second
    // would remesh the world twenty times a second): the touched columns (collected in `touched`, key → column) are
    // relit once when the building stands. A cell opened to the sky gets the sky's light at once, so a hill dug away
    // from the top never shows black faces meanwhile; returns how many cells changed.
    buildSet(list, a, b, touched) {
      const T = R.T, flags = T.flags, filter = T.filter, MASK = F.SOLID | F.FLUID | F.LEAVES;
      let n = 0;
      for (let k = a; k < b; k++) {
        const e = list[k], x = e[0], y = e[1], z = e[2], state = e[3];
        if (y < 0 || y >= VR.MAXY) continue;
        const c = this.col(x >> 4, z >> 4); if (!c) continue;
        if (y >= c.H) { if (!state) continue; this.growColumn(c, y); }
        const i = (y << 8) | ((z & 15) << 4) | (x & 15);
        const old = c.blocks[i]; if (old === state) continue;
        c.blocks[i] = state; c.modified = true; n++;
        const s = c.sec[y >> 4];
        if (!old && state) s.count++; else if (old && !state) s.count--;
        const col = i & 255;
        if (state && (flags[state] & MASK) && y > c.height[col]) c.height[col] = y;
        else if (y === c.height[col] && !(state && (flags[state] & MASK))) { let yy = y - 1; while (yy > 0 && !(c.blocks[(yy << 8) | col] && (flags[c.blocks[(yy << 8) | col]] & MASK))) yy--; c.height[col] = yy; }
        if (y + 1 >= c.sh[col * 2 + 1]) { this.shadowCol(c, col); this.shDirty.add(c.key); }
        if (!state && filter[old] > 0) c.light[i] = y > c.height[col] ? (c.light[i] & 0x0fff) | 0xf000 : (y + 1 < c.H ? c.light[i + 256] : 0xf000);
        this.markDirtyAround(x, y, z);
        if (touched) touched.set(c.key, c);
      }
      return n;
    }
    relightColumns(cols) {
      for (const c of cols) {
        const copy = c.blocks.slice();
        this.pool.submit({ type: 'lightonly', dim: this.dim, blocks: copy }, [copy.buffer], (m) => {
          if (m.type !== 'lightonly' || !this.cols.has(c.key)) return;
          if (m.light.length !== c.blocks.length) return;   // the column grew meanwhile: its own light updates cover it
          c.light = m.light;
          this.seamLight(c);
          this.flushChanged();
          for (const s of c.sec) { s.dirty = true; s.ver++; }
          for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const n = this.col(c.cx + dx, c.cz + dz); if (n && n !== c) for (const s of n.sec) { s.dirty = true; s.ver++; } }
        }, -1e8);
        for (const s of c.sec) { s.dirty = true; s.ver++; }
      }
      this.pool.queueDirty = true;
    }
    urgentRemesh(x, y, z, hand) {
      // remesh the edited section (and touched neighbors) immediately, bypassing the queue
      const cx = x >> 4, cz = z >> 4, sy = y >> 4;
      const touch = [[cx, sy, cz]];
      const lx = x & 15, ly = y & 15, lz = z & 15;
      if (lx === 0) touch.push([cx - 1, sy, cz]); if (lx === 15) touch.push([cx + 1, sy, cz]);
      if (lz === 0) touch.push([cx, sy, cz - 1]); if (lz === 15) touch.push([cx, sy, cz + 1]);
      if (ly === 0 && sy > 0) touch.push([cx, sy - 1, cz]); if (ly === 15) touch.push([cx, sy + 1, cz]);
      for (const [a, b, d] of touch) {
        const c = this.col(a, d); if (!c || b >= c.sec.length) continue;
        let ok = true;
        for (let oz = -1; oz <= 1 && ok; oz++) for (let ox = -1; ox <= 1; ox++) if (!this.col(a + ox, d + oz)) { ok = false; break; }
        if (!ok) continue;
        const s = c.sec[b];
        if (s.pending) { s.dirty = true; continue; }
        this.meshSection(c, b, true, undefined, undefined, hand);
      }
    }

    // ---------- light ----------
    _grow(q) { const n = new Int32Array(q.length * 2); n.set(q); return n; }
    // sky light seam + block light seam between column c and ready neighbors
    seamLight(c) {
      let q = this.qA, qt = 0;
      const push = (x, y, z) => { if (qt + 3 >= q.length) { q = this.qA = this._grow(q); } q[qt++] = x; q[qt++] = y; q[qt++] = z; };
      const T = R.T, filter = T.filter;
      const x0 = c.cx * 16, z0 = c.cz * 16;
      const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
      for (let d = 0; d < 4; d++) {
        const n = this.col(c.cx + dirs[d][0], c.cz + dirs[d][1]);
        if (!n) continue;
        // border cells: in c along edge d, and in n along opposite edge
        for (let k = 0; k < 16; k++) {
          let ax, az, bx, bz; // world coords of pair (a in c, b in n)
          if (d === 0) { ax = x0 + k; az = z0; bx = ax; bz = z0 - 1; }
          else if (d === 1) { ax = x0 + 15; az = z0 + k; bx = x0 + 16; bz = az; }
          else if (d === 2) { ax = x0 + k; az = z0 + 15; bx = ax; bz = z0 + 16; }
          else { ax = x0; az = z0 + k; bx = x0 - 1; bz = az; }
          const ai0 = ((az & 15) << 4) | (ax & 15), bi0 = ((bz & 15) << 4) | (bx & 15);
          const yTop = Math.min(c.H, n.H);
          for (let y = 0; y < yTop; y++) {
            const ai = (y << 8) | ai0, bi = (y << 8) | bi0;
            const la = c.light[ai], lb = n.light[bi];
            if (la === lb) continue;
            // a → b
            if (this._spread(la, n, bi, filter[n.blocks[bi]], false)) { push(bx, y, bz); this._touch(n, bx, y, bz); }
            if (this._spread(n.light[bi], c, ai, filter[c.blocks[ai]], false)) push(ax, y, az);
          }
        }
      }
      this.qA = q;
      this._propagate(qt);
    }
    // record a light/geometry change at world cell → section ids to remesh (incl. neighbors on borders)
    _touch(col, x, y, z) {
      const lx = x & 15, lz = z & 15, ly = y & 15, sy = y >> 4, k = col.key, ch = this.changed, SC = VR.SECS;
      ch.add(k * SC + sy);
      if (ly === 0 && sy > 0) ch.add(k * SC + sy - 1); else if (ly === 15 && sy < SC - 1) ch.add(k * SC + sy + 1);
      const ex = lx === 0 ? -1 : lx === 15 ? 1 : 0, ez = lz === 0 ? -1 : lz === 15 ? 1 : 0;
      if (ex) ch.add((k + ex * 65536) * SC + sy);
      if (ez) ch.add((k + ez) * SC + sy);
      if (ex && ez) ch.add((k + ex * 65536 + ez) * SC + sy);
    }
    // try spreading light value l into cell (col n, index i) with filter f. returns true if increased
    _spread(l, n, i, f, down) {
      if (f >= 15) return false;
      const cur = n.light[i];
      const s = l >>> 12, r = (l >> 8) & 15, g = (l >> 4) & 15, b = l & 15;
      const dec = 1 + f;
      let ns = (down && s === 15 && f === 0) ? 15 : s - dec;
      let nr = r - dec, ng = g - dec, nb = b - dec;
      const cs = cur >>> 12, cr = (cur >> 8) & 15, cg = (cur >> 4) & 15, cb = cur & 15;
      if (ns > cs || nr > cr || ng > cg || nb > cb) {
        n.light[i] = (Math.max(ns, cs) << 12) | (Math.max(nr, cr) << 8) | (Math.max(ng, cg) << 4) | Math.max(nb, cb);
        return true;
      }
      return false;
    }
    // increase BFS over queue qA[0..qt) of world coords
    _propagate(qt) {
      let q = this.qA, qh = 0;
      const T = R.T, filter = T.filter;
      const DX = [1, -1, 0, 0, 0, 0], DY = [0, 0, 1, -1, 0, 0], DZ = [0, 0, 0, 0, 1, -1];
      let guard = 0;
      while (qh < qt) {
        const x = q[qh], y = q[qh + 1], z = q[qh + 2]; qh += 3;
        if (++guard > 4000000) break;
        const c = this.col(x >> 4, z >> 4); if (!c) continue;
        const l = y >= c.H ? 0xf000 : c.light[(y << 8) | ((z & 15) << 4) | (x & 15)];   // above the storage: open daylight
        if (l === 0) continue;
        for (let d = 0; d < 6; d++) {
          const nx = x + DX[d], ny = y + DY[d], nz = z + DZ[d];
          if (ny < 0 || ny >= VR.MAXY) continue;
          const n = this.col(nx >> 4, nz >> 4); if (!n) continue;
          if (ny >= n.H) {
            // open air in full daylight up there: only block light needs the cell stored (room is made for it)
            if (!(l & 0x0fff) || (((l >> 8) & 15) <= 1 && ((l >> 4) & 15) <= 1 && (l & 15) <= 1)) continue;
            if (!this.growColumn(n, ny)) continue;
          }
          const ni = (ny << 8) | ((nz & 15) << 4) | (nx & 15);
          if (this._spread(l, n, ni, filter[n.blocks[ni]], d === 3)) {
            this._touch(n, nx, ny, nz);
            if (qt + 3 >= q.length) { q = this.qA = this._grow(q); }
            q[qt++] = nx; q[qt++] = ny; q[qt++] = nz;
          }
        }
        // compact queue occasionally
        if (qh > 1 << 20 && qh > qt / 2) { q.copyWithin(0, qh, qt); qt -= qh; qh = 0; }
      }
    }
    // Light update after block change at (x,y,z)
    updateLight(x, y, z, oldS, newS) {
      const T = R.T, filter = T.filter, emit = T.emit;
      const c = this.col(x >> 4, z >> 4); if (!c) return;
      const i = (y << 8) | ((z & 15) << 4) | (x & 15);
      const cur = c.light[i];
      const fOld = filter[oldS], fNew = filter[newS], eOld = emit[oldS], eNew = emit[newS];
      const seeds = [];
      // removal when the cell becomes darker (more opaque or lost emission)
      if (fNew > fOld || eOld) {
        for (let ch = 0; ch < 4; ch++) this._removeChannel(x, y, z, ch, seeds);
      }
      // new emitter
      if (eNew) {
        const l = c.light[i];
        const r = Math.max((l >> 8) & 15, (eNew >> 8) & 15), g = Math.max((l >> 4) & 15, (eNew >> 4) & 15), b = Math.max(l & 15, eNew & 15);
        c.light[i] = (l & 0xf000) | (r << 8) | (g << 4) | b;
        seeds.push(x, y, z);
      }
      // cell became more transparent: pull light from neighbors
      if (fNew < fOld || fNew < 15) {
        for (let d = 0; d < 6; d++) {
          const nx = x + VR.DX[d], ny = y + VR.DY[d], nz = z + VR.DZ[d];
          if (ny < 0 || ny >= VR.MAXY) continue;
          seeds.push(nx, ny, nz);
        }
      }
      // sky: if cell opened to sky straight above, re-seed from above
      let q = this.qA, qt = 0;
      for (let k = 0; k < seeds.length; k += 3) { if (qt + 3 >= q.length) q = this.qA = this._grow(q); q[qt++] = seeds[k]; q[qt++] = seeds[k + 1]; q[qt++] = seeds[k + 2]; }
      this._touch(c, x, y, z);
      this._propagate(qt);
      void cur;
    }
    // removal BFS for channel ch (0 sky, 1 r, 2 g, 3 b). Collects re-propagation seeds.
    _removeChannel(x, y, z, ch, seeds) {
      const shift = ch === 0 ? 12 : ch === 1 ? 8 : ch === 2 ? 4 : 0;
      const mask = ~(15 << shift) & 0xffff;
      const c0 = this.col(x >> 4, z >> 4); if (!c0) return;
      const i0 = (y << 8) | ((z & 15) << 4) | (x & 15);
      const v0 = (c0.light[i0] >> shift) & 15;
      if (!v0) return;
      c0.light[i0] &= mask;
      let q = this.qB, qt = 0, qh = 0;
      q[qt++] = x; q[qt++] = y; q[qt++] = z; q[qt++] = v0;
      const DX = [1, -1, 0, 0, 0, 0], DY = [0, 0, 1, -1, 0, 0], DZ = [0, 0, 0, 0, 1, -1];
      let guard = 0;
      while (qh < qt) {
        const px = q[qh], py = q[qh + 1], pz = q[qh + 2], pv = q[qh + 3]; qh += 4;
        if (++guard > 2000000) break;
        for (let d = 0; d < 6; d++) {
          const nx = px + DX[d], ny = py + DY[d], nz = pz + DZ[d];
          if (ny < 0 || ny >= VR.MAXY) continue;
          const n = this.col(nx >> 4, nz >> 4); if (!n || ny >= n.H) continue;   // above the storage: open daylight, depends on nothing
          const ni = (ny << 8) | ((nz & 15) << 4) | (nx & 15);
          const nv = (n.light[ni] >> shift) & 15;
          if (!nv) continue;
          const dependent = nv < pv || (ch === 0 && d === 3 && pv === 15 && nv === 15);
          if (dependent) {
            // emitters keep their own emission
            const e = ch === 0 ? 0 : (R.T.emit[n.blocks[ni]] >> shift) & 15;
            n.light[ni] = (n.light[ni] & mask) | (e << shift);
            this._touch(n, nx, ny, nz);
            if (e) seeds.push(nx, ny, nz);
            if (qt + 4 >= q.length) q = this.qB = this._grow(q);
            q[qt++] = nx; q[qt++] = ny; q[qt++] = nz; q[qt++] = nv;
          } else if (nv >= pv) {
            seeds.push(nx, ny, nz);
          }
        }
      }
      this.qB = q;
    }
    flushChanged() {
      if (!this.changed.size) return;
      const SC = VR.SECS;
      for (const v of this.changed) {
        const key = Math.floor(v / SC), sy = v - key * SC;
        const c = this.cols.get(key); if (!c) continue;
        const s = c.sec[sy]; if (!s) continue; s.dirty = true; s.ver++;
      }
      this.changed.clear();
    }
  }
  VR.World = World;
})(VR);
