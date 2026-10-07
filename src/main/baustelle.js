// ============================================================================
// 🏗 Baustelle — the magic moment when something new appears. A planned structure (R9 Forge /bau and 🏭 plans,
// houses and models from the Studio's World mode, blueprint items, Werkbank hand-overs) is built in front of the
// player: scaffolding rises around it, it grows layer by layer from the foundation up, builders work on the
// scaffold's deck and hammer, a tower crane swings loads for anything taller than 12 blocks, dust and building
// sounds, a fanfare and confetti when it stands, then the scaffold folds away and the builders walk off.
//
// The world gets exactly the cells the plan builds today (blueprints.js planAt / opsAt): the list is only put in
// another order — every removal top-down (earthworks), the fill under the floor and then the structure bottom-up,
// each layer swept around its centre — and written a few cells at a time through the old slice job (this.slices:
// {pl, name, list, undo, at, w}). The undo of all of it is one step from the first cell on (Z in the middle stops
// it and puts back what was built); a save in the middle finishes the build first (World.saveAll asks its
// listeners); the session's guests are told every written cell. „Bauen: Sofort" keeps today's way (small pieces at
// once, big ones in 8 000-cell slices). Nothing of the show is in the world: the scaffold, the deck, the crane and
// the builders are entity meshes (an instanced vox program), drawn on top.
// ============================================================================
(function (VR) {
  'use strict';
  const BS = VR.Baustelle = {};
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const SLICE_STEP = 8000, SLICE_T = 0.05, SLICE_MAX = 16000;   // (blueprints.js: Sofort's slices)
  const TINY = 64;                                             // fewer structure cells (and ≤ 4 high): a short magic moment
  const FAR = 150;                                             // a site further from the player than this is built at once
  // the player's language: the texts are in lang_de.js / lang_en.js
  const T = (k, v, de, en) => (VR.I18N && VR.I18N.tx ? VR.I18N.tx(k, v, de, en) : String(en).replace(/\{(\w+)\}/g, (m, x) => (v && v[x] !== undefined ? v[x] : m)));
  BS.T = T;

  // ---------------------------------------------------------------- the order of the cells (pure, node-tested)
  // list [[x, y, z, s], …] and undo [[x, y, z, old], …] (parallel) → the same changes in the order they are built:
  // a cell written twice keeps its last state and its first old value (the world after the list, the world before
  // it), then every removal top-down, the fill under the floor F bottom-up, the structure bottom-up — inside a layer
  // around its centre. Also the layers of the structure: where each starts in the list and its box (the scaffold).
  BS.order = function (list, undo, F) {
    const n = list.length;
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (let i = 0; i < n; i++) { const e = list[i]; if (e[0] < x0) x0 = e[0]; if (e[0] > x1) x1 = e[0]; if (e[2] < z0) z0 = e[2]; if (e[2] > z1) z1 = e[2]; }
    const wide = x1 - x0 >= 65536 || z1 - z0 >= 65536;
    const at = new Map(), L = [], U = [];
    for (let i = 0; i < n; i++) {
      const e = list[i], k = wide ? e[0] + ',' + e[1] + ',' + e[2] : ((e[0] - x0) * 65536 + (e[2] - z0)) * 8192 + e[1];
      const j = at.get(k);
      if (j === undefined) { at.set(k, L.length); L.push(e); U.push(undo[i]); } else L[j] = e;
    }
    const m = L.length, hasF = typeof F === 'number' && isFinite(F);
    const rem = [], fil = [], str = [];
    for (let i = 0; i < m; i++) { const e = L[i]; if (!e[3]) rem.push(i); else if (hasF && e[1] < F) fil.push(i); else str.push(i); }
    rem.sort((a, b) => (L[b][1] - L[a][1]) || (a - b));
    fil.sort((a, b) => (L[a][1] - L[b][1]) || (a - b));
    // the structure: its box, the centre of the sweep
    let sx0 = Infinity, sy0 = Infinity, sz0 = Infinity, sx1 = -Infinity, sy1 = -Infinity, sz1 = -Infinity;
    for (const i of str) { const e = L[i]; if (e[0] < sx0) sx0 = e[0]; if (e[0] > sx1) sx1 = e[0]; if (e[1] < sy0) sy0 = e[1]; if (e[1] > sy1) sy1 = e[1]; if (e[2] < sz0) sz0 = e[2]; if (e[2] > sz1) sz1 = e[2]; }
    const cx = (sx0 + sx1 + 1) / 2, cz = (sz0 + sz1 + 1) / 2, ang = new Float32Array(m);
    for (const i of str) ang[i] = Math.atan2(L[i][2] + 0.5 - cz, L[i][0] + 0.5 - cx);
    str.sort((a, b) => (L[a][1] - L[b][1]) || (ang[a] - ang[b]) || (a - b));
    const H = str.length ? sy1 - sy0 + 1 : 0;
    const layerStart = new Int32Array(H + 1), layerBox = new Int32Array(Math.max(1, H) * 4);
    for (let h = 0; h < H; h++) { layerBox[h * 4] = 2147483647; layerBox[h * 4 + 1] = -2147483647; layerBox[h * 4 + 2] = 2147483647; layerBox[h * 4 + 3] = -2147483647; }
    for (const i of str) {
      const e = L[i], h = e[1] - sy0, b = h * 4; layerStart[h + 1]++;
      if (e[0] < layerBox[b]) layerBox[b] = e[0]; if (e[0] > layerBox[b + 1]) layerBox[b + 1] = e[0];
      if (e[2] < layerBox[b + 2]) layerBox[b + 2] = e[2]; if (e[2] > layerBox[b + 3]) layerBox[b + 3] = e[2];
    }
    for (let h = 0; h < H; h++) layerStart[h + 1] += layerStart[h];
    // every cell's box (the click on the site, the overlap of two sites)
    let y0 = Infinity, y1 = -Infinity; for (let i = 0; i < m; i++) { const y = L[i][1]; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const ord = rem.concat(fil, str);
    return {
      list: ord.map(i => L[i]), undo: ord.map(i => U[i]),
      nRem: rem.length, nFill: fil.length, nEarth: rem.length + fil.length, nStruct: str.length,
      yMin: H ? sy0 : 0, yMax: H ? sy1 : -1, H, layerStart, layerBox, cx, cz,
      box: m ? [x0, y0, z0, x1, y1, z1] : [0, 0, 0, -1, -1, -1], sbox: H ? [sx0, sy0, sz0, sx1, sy1, sz1] : null,
    };
  };
  // how long it takes (s): the earthworks by cells, the structure by its height — a few layers a second, faster for
  // tall ones, 6–20 s in all; a tiny piece 1.2 s; plans waiting behind it make it quicker (never under 2 s)
  BS.pace = function (o, queued) {
    const tiny = o.nStruct < TINY && o.H <= 4;
    let Te = o.nEarth ? clamp(0.6 + o.nEarth / 2500, 0.8, 3.5) : 0;
    let Tb = o.nStruct ? (tiny ? 1.2 : clamp(2.5 + 0.13 * o.H, 4.5, 17)) : 0;
    if (tiny) Te = Math.min(Te, 0.5);
    const T0 = Te + Tb, f = 1 / (1 + 0.6 * (queued || 0));
    if (f < 1 && T0 > 2) { const k = Math.max(2 / T0, f); Te *= k; Tb *= k; }
    return { Te, Tb, T: Te + Tb, tiny };
  };
  // Sofort or Baustelle: the setting, and a site far from the player is built at once (nobody would see it)
  BS.modeFor = function (B, list) {
    const g = B.g, s = g.settings || {};
    if (s.bau === 'instant') return 'instant';
    const p = g.player && g.player.pos;
    if (p && list.length) {
      const a = list[0], b = list[list.length - 1], cx = (a[0] + b[0]) / 2, cz = (a[2] + b[2]) / 2;
      if ((cx - p[0]) * (cx - p[0]) + (cz - p[2]) * (cz - p[2]) > FAR * FAR) return 'instant';
    }
    return 'show';
  };
  // the session hears of every cell (the guests end with the same world): forward (old → new) or back
  function tell(g, list, undo, a, b, back) {
    const mp = g.mp; if (!mp || !mp.active || !mp.onBlockChanged) return;
    for (let k = a; k < b; k++) { const e = list[k], u = undo[k]; if (back) mp.onBlockChanged(u[0], u[1], u[2], e[3], u[3]); else mp.onBlockChanged(e[0], e[1], e[2], u[3], e[3]); }
  }
  BS.tell = tell;

  // ---------------------------------------------------------------- a site: the write job (this.slices) and its show
  class Site {
    constructor(B, job, mode) {
      this.B = B; this.g = B.g; this.w = B.g.world;
      this.kind = job.kind; this.pl = job.pl || null; this.name = job.name || ''; this.batches = job.batches || null; this.mode = mode;
      const o = this.o = BS.order(job.list, job.undo, job.F);
      this.list = o.list; this.undo = o.undo; this.at = 0; this.t = 0; this.st = 0; this.wacc = 1e9;
      this.F = typeof job.F === 'number' ? job.F : (o.sbox ? o.sbox[1] : o.box[1]);
      const P = mode === 'show' ? BS.pace(o, job.queued) : { Te: 0, Tb: 0, T: 0, tiny: false };
      this.Te = P.Te; this.Tb = P.Tb; this.T = P.T; this.tiny = P.tiny;
      this.writeDT = (this.g.settings && this.g.settings.preset === 'low') ? 0.2 : 0.1;
      this.phase = o.nEarth ? 'earth' : 'build';
      this.touched = new Map();
      this.cols = new Set(); for (const e of this.list) this.cols.add((e[0] >> 4) * 65536 + (e[2] >> 4));
      const b = o.box; this.box = [b[0] - 3, b[1] - 1, b[2] - 3, b[3] + 3, b[4] + 3, b[5] + 3];   // (+ the scaffold)
      this.scaffold = mode === 'show' && !this.tiny && o.nStruct > 0;
      this.show = mode === 'show' && BS.Show ? new BS.Show(this) : null;
    }
    get progress() { return this.list.length ? this.at / this.list.length : 1; }
    // how many cells of the list should be in the world at site time t
    target(t) {
      const o = this.o, n = this.list.length;
      if (t >= this.T) return n;
      if (t < this.Te) return Math.floor(o.nEarth * t / this.Te);
      if (!o.H) return n;
      const hf = (t - this.Te) / this.Tb * o.H, h = Math.min(o.H - 1, Math.floor(hf)), fr = hf - h;
      const a = o.layerStart[h], b = o.layerStart[h + 1];
      return o.nEarth + a + Math.floor((b - a) * Math.min(1, fr));
    }
    // the job's tick (blueprints.js tickSlices): Sofort in slices, the Baustelle by its clock, a write at most every 0.1 s
    write(dt) {
      const g = this.g, w = g.world;
      if (this.w !== w) { if (this.B.slices === this) this.B.slices = null; this.phase = 'gone'; return; }   // another world now
      if (!w || g.state !== 'play' || (this.phase !== 'earth' && this.phase !== 'build')) return;
      if (this.mode === 'instant') {
        this.st -= dt; if (this.st > 0) return;
        this.st = SLICE_T;
        this.writeTo(Math.min(this.list.length, this.at + SLICE_STEP));
      } else {
        this.t += dt; this.wacc += dt;
        if (this.wacc < this.writeDT && this.t < this.T) return;
        this.wacc = 0;
        this.writeTo(Math.min(this.target(this.t), this.at + SLICE_STEP));
      }
      if (this.at >= this.list.length) this.complete();
    }
    writeTo(b) {
      const a = this.at; if (b <= a) return;
      const w = this.w, L = this.list;
      if (w.buildSet) w.buildSet(L, a, b, this.touched);
      else { w.bulkSet(L.slice(a, b), false); }
      const gad = this.B.gad;
      if (gad.noteBlock) for (let k = a; k < b; k++) { const e = L[k]; gad.noteBlock(e[0], e[1], e[2], e[3]); }
      tell(this.g, L, this.undo, a, b, false);
      this.at = b;
      if (this.phase === 'earth' && b >= this.o.nEarth) {
        this.phase = 'build';
        // a lot that was dug out a lot gets its light right before the building rises on it
        if (this.o.nRem > 200 && this.touched.size && w.relightColumns) w.relightColumns([...this.touched.values()]);
      }
      // built where you stand? you step out to the nearest free spot
      const p = this.g.player, B = this.box;
      if (p && p.unstick && p.pos && p.pos[0] >= B[0] && p.pos[0] <= B[3] + 1 && p.pos[2] >= B[2] && p.pos[2] <= B[5] + 1 && p.pos[1] >= B[1] - 2 && p.pos[1] <= B[4] + 2) p.unstick();
      if (this.show) this.show.onWrite(a, b);
    }
    // every cell is in the world: relight, the plan is built, the show's finale
    complete() {
      const B = this.B, w = this.w;
      if (B.slices === this) B.slices = null;
      this.phase = 'done';
      if (this.touched.size && w.relightColumns) w.relightColumns([...this.touched.values()]);
      const n = this.list.length;
      if (this.kind === 'plan' && this.pl) B.planDone(this.pl, this.name, n, this.undo);
      else if (this.kind === 'werkbank') this.batchesDone(true);
      else if (this.kind === 'blueprint' && this.g.ui && this.g.ui.hint) this.g.ui.hint(T('g.bp.built', { name: this.name, n: n.toLocaleString() }, '{name} gebaut · {n} Blöcke · Z oder /undo nimmt es zurück', '{name} built · {n} blocks · Z or /undo takes it back'), 3200);
      if (this.show) this.show.onDone(); else this.phase = 'gone';
      if (B.siteDone) B.siteDone(this);
    }
    // ⏩ Fertig, a save, a column that leaves: the rest at once (in 8 000-cell writes), then the finale
    finish(why) {
      if (this.phase !== 'earth' && this.phase !== 'build') return false;
      this.skipped = why || 'skip';
      while (this.at < this.list.length) this.writeTo(Math.min(this.list.length, this.at + SLICE_STEP));
      this.complete();
      return true;
    }
    // Gadgets.undo took this site's step back (every cell is the old one again): a running site stops, the guests
    // are told, the plan counts as built (as after Z on a Sofort build — it is not built again)
    onUndone() {
      const running = this.phase === 'earth' || this.phase === 'build';
      tell(this.g, this.list, this.undo, 0, running ? this.at : this.list.length, true);
      if (!running) { if (this.phase === 'done' && this.show) this.show.onCancel(); return; }   // (taken back while it still celebrates: the party ends)
      if (this.B.slices === this) this.B.slices = null;
      this.phase = 'cancel';
      if (this.kind === 'plan' && this.pl) this.markBuilt();
      else if (this.kind === 'werkbank') this.batchesDone(false);
      if (this.touched.size && this.w.relightColumns) this.w.relightColumns([...this.touched.values()]);
      if (this.show) this.show.onCancel(); else this.phase = 'gone';
      if (this.g.ui && this.g.ui.hint) this.g.ui.hint(T('g.bau.cancel', null, 'Baustelle abgebrochen — alles zurück', 'Construction stopped — all taken back'), 2600);
    }
    // the job was taken away from outside (another world, a cancel elsewhere): its show folds
    lost() {
      if (this.phase !== 'earth' && this.phase !== 'build') return;
      this.phase = 'cancel';
      const st = this.B.gad && this.B.gad.wand && this.B.gad.wand.undo, i = st ? st.indexOf(this.undo) : -1;
      if (i >= 0 && this.at === 0) st.splice(i, 1);
      if (this.show) this.show.onCancel(); else this.phase = 'gone';
    }
    markBuilt() {
      const B = this.B, pl = this.pl;
      pl.status = 'built';
      if (B.plans) for (const q of B.plans) if (q.id === pl.id) q.status = 'built';
      if (B.markPlan) B.markPlan(pl.id, 'built');
    }
    // the Werkbank's batches are built (or taken back): the Studio drops them, the world goes into the save
    batchesDone(toast) {
      const B = this.B, g = this.g, E = VR.Edits, id = B.editWorld && B.editWorld();
      if (E && id && this.batches) for (const bid of this.batches) E.markDone(id, bid);
      if (g.player && g.player.unstick) g.player.unstick();
      const w = this.w;
      if (typeof setTimeout !== 'undefined') { clearTimeout(B.editSave); B.editSave = setTimeout(() => { if (g.world === w && w.saveAll) w.saveAll(); }, 800); }
      if (toast && g.ui && g.ui.toast) { const n = this.list.length; g.ui.toast('R9 Studio', VR.I18N ? VR.I18N.tx('g.studio.edits', { n: n.toLocaleString() }, '{n} Blöcke aus der Werkbank', '{n} blocks from the Werkbank') : n + ' blocks from the Werkbank'); }
    }
  }
  BS.Site = Site;

  // ---------------------------------------------------------------- the Blueprints side (blueprints.js calls these)
  const BP = VR.Blueprints && VR.Blueprints.prototype;
  if (BP) {
    // a build of a plan, a blueprint or the Werkbank: the Baustelle takes it (true) or the old code does (false)
    // job: {kind: 'plan' | 'blueprint' | 'werkbank', pl?, name, list, undo, F?, batches?}
    BP.siteFor = function (job) {
      const g = this.g, w = g.world;
      if (!job || !job.list || !job.list.length || !w || !this.gad) return false;
      if (this.slices && this.slices !== job.site && this.finishSites) this.finishSites('next');   // (never two at once)
      const mode = BS.modeFor(this, job.list);
      if (mode === 'instant' && job.list.length <= SLICE_MAX && job.kind !== 'werkbank') {
        // Sofort, a small one: at once as today — and the session hears of it
        this.gad.applyEdit(job.list, job.undo);
        tell(g, job.list, job.undo, 0, job.list.length, false);
        job.undo.onUndo = () => tell(g, job.list, job.undo, 0, job.list.length, true);
        if (job.kind === 'plan' && job.pl) this.planDone(job.pl, job.name, job.list.length, job.undo);
        this.siteStarted = null;
        return true;
      }
      job.queued = job.kind === 'plan' && this.plans ? this.plans.filter(q => q.status === 'pending' && !q.failed && q !== job.pl).length : 0;
      const site = new Site(this, job, mode);
      // one undo step for all of it, from the first cell on (Gadgets.undo tells the site)
      this.gad.applyEdit([], site.undo);
      site.undo.onUndo = () => site.onUndone();
      this.slices = site;
      if (job.pl) job.pl.status = 'building';
      this.siteListen(w);
      if (site.show) { (this.sites || (this.sites = [])).push(site); site.show.start(); }
      this.siteStarted = site;
      return true;
    };
    // the world asks before it saves (World.saveAll) and before a column leaves (World.unloadColumn)
    BP.siteListen = function (w) {
      if (!this.siteL) this.siteL = { onBeforeSave: () => this.finishSites('save'), onColumnUnloading: (c) => this.siteUnloading(c) };
      if (w.listeners && w.listeners.indexOf(this.siteL) < 0) w.listeners.push(this.siteL);
    };
    BP.finishSites = function (why) { const S = this.slices; return S instanceof Site ? S.finish(why) : false; };
    BP.siteSkip = function () { return this.finishSites('skip'); };
    BP.siteBusy = function () { const S = this.slices; return !!(S instanceof Site && (S.phase === 'earth' || S.phase === 'build') && S.mode === 'show'); };
    BP.siteUnloading = function (c) { const S = this.slices; if (S instanceof Site && S.cols.has(c.cx * 65536 + c.cz)) S.finish('unload'); };
    // every frame (blueprints.js tickPlans): the shows, and a job taken away from outside
    BP.siteTick = function (dt) {
      const L = this.sites;
      if (L && L.length) {
        for (let i = L.length - 1; i >= 0; i--) {
          const s = L[i];
          if ((s.phase === 'earth' || s.phase === 'build') && this.slices !== s) s.lost();
          if (s.show) s.show.tick(dt);
          if (s.phase === 'gone') { if (s.show) s.show.dispose(); L.splice(i, 1); }
        }
      }
      if (BS.hud) BS.hud(this);
    };
    // the Werkbank's batches (Baustelle only): every batch whose columns are there, as one site (in their order: the
    // last write per cell wins, its undo the world before all of them) — a few blocks still go in at once (false)
    BP.editsSite = function () {
      const g = this.g, w = g.world, E = VR.Edits, id = this.editWorld && this.editWorld();
      if (!E || !id || !w || g.state !== 'play' || BS.modeFor(this, []) === 'instant') return false;
      if (this.slices) return true;   // (one after the other: the next batches read the world this one leaves)
      const ids = E.list(id); if (!ids.length) return true;
      const done = new Set(E.done(id)), virt = new Map(), list = [], undo = [], used = [];
      for (const bid of ids) {
        if (done.has(bid)) continue;
        const b = E.ls.get(E.batchKey(id, bid)); if (!b) continue;
        let ready = true;
        for (const [cx, cz] of E.columns(b)) { const c = w.col(cx, cz); if (!c || !c.ready) { ready = false; break; } }
        if (!ready) continue;
        for (const [x, y, z, s] of E.unpack(b)) {
          const k = x + ',' + y + ',' + z, cur = virt.has(k) ? virt.get(k) : w.getBlock(x, y, z);
          if (cur === s) continue;
          list.push([x, y, z, s]); undo.push([x, y, z, cur]); virt.set(k, s);
        }
        used.push(bid);
        if (list.length > 200000) break;
      }
      if (!used.length) return true;
      if (list.length < TINY) return false;   // (a few blocks: the old code builds them at once)
      return this.siteFor({ kind: 'werkbank', name: T('g.bau.bench', null, 'Werkbank', 'Workbench'), list, undo, batches: used });
    };
    // 🖱 a click on the site while it builds: done at once (the held button is not a block break after that)
    BP.siteClick = function (input, p) {
      if (this.siteSwallow) { if (input.mouse.down[0] || input.mouse.down[2]) return true; this.siteSwallow = false; }
      const S = this.slices; if (!(S instanceof Site) || !S.show || (S.phase !== 'earth' && S.phase !== 'build')) return false;
      if (!(input.clickAction(0) || input.clickAction(2))) return false;
      const e = p.eyePos(), d = p.lookDir(), b = S.box;
      let t0 = 0, t1 = 140;
      for (let a = 0; a < 3; a++) {
        const lo = b[a] - (a === 1 ? 0 : 0.5), hi = b[a + 3] + 1 + (a === 1 ? 2 : 0.5);
        if (Math.abs(d[a]) < 1e-6) { if (e[a] < lo || e[a] > hi) return false; continue; }
        let ta = (lo - e[a]) / d[a], tb = (hi - e[a]) / d[a]; if (ta > tb) { const q = ta; ta = tb; tb = q; }
        if (ta > t0) t0 = ta; if (tb < t1) t1 = tb; if (t0 > t1) return false;
      }
      // something closer than the site under the crosshair (a block in front of it): that click is for it
      const tg = p.target;
      if (tg && tg.dist !== undefined && tg.dist < t0 - 0.5 && !(tg.x >= b[0] && tg.x <= b[3] && tg.z >= b[2] && tg.z <= b[5])) return false;
      S.finish('click');
      this.siteSwallow = true;
      return true;
    };
    BP.drawSites = function (r, E, cam) { const L = this.sites; if (!L || !L.length || !BS.draw) return; BS.draw(this, r, E, cam); };
  }
})(VR);
