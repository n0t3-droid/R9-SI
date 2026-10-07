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
      if (this.w !== w) { if (this.B.slices === this) this.B.slices = null; this.phase = 'gone'; BS.hudOff(); return; }   // another world now
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
      BS.hudOff();
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
      this.phase = 'cancel'; BS.hudOff();
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
      if (typeof setTimeout !== 'undefined') { clearTimeout(B.editSave); const save = () => { if (B.siteBusy()) { B.editSave = setTimeout(save, 1000); return; } if (g.world === w && w.saveAll) w.saveAll(); }; B.editSave = setTimeout(save, 800); }   // (not while the next site builds)
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
      if (site.show) {
        // (the site before it still celebrates: its office goes now — it may stand on this one's lot)
        if (this.sites) for (const s of this.sites) if (s.show && s.show.office) s.show.office = null;
        (this.sites || (this.sites = [])).push(site); site.show.start();
      }
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
    BP.siteOutlines = function (out) { const S = this.slices; if (S instanceof Site && S.show && S.show.outline && !S.tiny && S.o.nStruct && (S.phase === 'earth' || S.phase === 'build')) out.push(S.show.outline); };
    BP.drawSites = function (r, E, cam) { const L = this.sites; if (!L || !L.length || !BS.draw) return; BS.draw(this, r, E, cam); };
  }

  // ================================================================ the show (main thread; nothing of it is in the world)
  // A site's look: rings of scaffolding around the structure, two blocks a level, hugging its box at that height (a
  // setback steps in), built once into instance lists and drawn with the instanced vox program; the working deck
  // rises with the build front and carries the builders (the villagers' builders: hard hat, vest, hammer, the 'work'
  // clip); a tower crane for anything taller than 12 blocks. A tall one keeps a climbing band of six levels under the
  // deck (like a real high-rise: the floors below are finished), a house is scaffolded to the ground.
  const UV0 = [0, 0, 1, 1];
  const CREW = { potato: 1, low: 2, balanced: 3, high: 4, ultra: 5 };
  const C = { steel: 0xB3BAC2, steelD: 0x838C96, wood: 0xC8964E, woodL: 0xD9AA62, woodD: 0xAE7F40, toe: 0xF0A830, yellow: 0xF2B90F, yellowD: 0xC99406, black: 0x26282C, red: 0xD8322A, white: 0xF2F2EE, orange: 0xEE6A26, glass: 0x34566E, concrete: 0xB9B7AF, grey: 0x50545C, lamp: 0xFFE9A8, cable: 0x2E3036 };
  const rnd = Math.random;
  // ---------------------------------------------------------------- vox meshes from boxes and beams (the vox vertex: pos, normal, colour, glow)
  class MeshBuf {
    constructor() { this.v = []; }
    vert(x, y, z, nx, ny, nz, col, k, e) { this.v.push(x, y, z, nx, ny, nz, ((col >> 16) & 255) * k, ((col >> 8) & 255) * k, (col & 255) * k, e ? 1 : 0); }
    // a quad c, c+u, c+u+v, c+v (counter-clockwise from outside: u × v points along the normal)
    quad(c, u, v, n, col, e) {
      const k = e ? 1 : n[1] > 0.5 ? 1 : n[1] < -0.5 ? 0.72 : Math.abs(n[0]) > Math.abs(n[2]) ? 0.88 : 0.95;
      const p = [c, [c[0] + u[0], c[1] + u[1], c[2] + u[2]], [c[0] + u[0] + v[0], c[1] + u[1] + v[1], c[2] + u[2] + v[2]], [c[0] + v[0], c[1] + v[1], c[2] + v[2]]];
      for (const i of [0, 1, 2, 0, 2, 3]) this.vert(p[i][0], p[i][1], p[i][2], n[0], n[1], n[2], col, k, e);
    }
    // an axis-aligned box; o.skip: faces left out (1 +x, 2 −x, 4 +y, 8 −y, 16 +z, 32 −z), o.e: glows
    box(x0, y0, z0, x1, y1, z1, col, o) {
      const skip = (o && o.skip) || 0, e = !!(o && o.e), dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
      if (!(skip & 1)) this.quad([x1, y0, z1], [0, 0, -dz], [0, dy, 0], [1, 0, 0], col, e);
      if (!(skip & 2)) this.quad([x0, y0, z0], [0, 0, dz], [0, dy, 0], [-1, 0, 0], col, e);
      if (!(skip & 4)) this.quad([x0, y1, z1], [dx, 0, 0], [0, 0, -dz], [0, 1, 0], col, e);
      if (!(skip & 8)) this.quad([x0, y0, z0], [dx, 0, 0], [0, 0, dz], [0, -1, 0], col, e);
      if (!(skip & 16)) this.quad([x0, y0, z1], [dx, 0, 0], [0, dy, 0], [0, 0, 1], col, e);
      if (!(skip & 32)) this.quad([x1, y0, z0], [-dx, 0, 0], [0, dy, 0], [0, 0, -1], col, e);
      return this;
    }
    // a square beam from a to b (w thick), the four long sides
    beam(ax, ay, az, bx, by, bz, w, col, e) {
      let dx = bx - ax, dy = by - ay, dz = bz - az; const L = Math.hypot(dx, dy, dz) || 1; dx /= L; dy /= L; dz /= L;
      const up = Math.abs(dy) > 0.9 ? [1, 0, 0] : [0, 1, 0];
      let s1 = [dy * up[2] - dz * up[1], dz * up[0] - dx * up[2], dx * up[1] - dy * up[0]]; const l1 = Math.hypot(s1[0], s1[1], s1[2]); s1 = s1.map(q => q / l1);
      const s2 = [dy * s1[2] - dz * s1[1], dz * s1[0] - dx * s1[2], dx * s1[1] - dy * s1[0]];
      const h = w / 2, B = [bx - ax, by - ay, bz - az], S1 = s1.map(q => q * w), S2 = s2.map(q => q * w);
      const at = (k1, k2) => [ax + s1[0] * h * k1 + s2[0] * h * k2, ay + s1[1] * h * k1 + s2[1] * h * k2, az + s1[2] * h * k1 + s2[2] * h * k2];
      this.quad(at(1, -1), S2, B, s1, col, e);
      this.quad(at(-1, -1), B, S2, s1.map(q => -q), col, e);
      this.quad(at(-1, 1), B, S1, s2, col, e);
      this.quad(at(-1, -1), S1, B, s2.map(q => -q), col, e);
      return this;
    }
    pack() {
      const n = this.v.length / 10, buf = new ArrayBuffer(n * 20), f32 = new Float32Array(buf), i8 = new Int8Array(buf), u8 = new Uint8Array(buf), v = this.v;
      for (let i = 0; i < n; i++) {
        const o = i * 10;
        f32[i * 5] = v[o]; f32[i * 5 + 1] = v[o + 1]; f32[i * 5 + 2] = v[o + 2];
        i8[i * 20 + 12] = Math.round(v[o + 3] * 127); i8[i * 20 + 13] = Math.round(v[o + 4] * 127); i8[i * 20 + 14] = Math.round(v[o + 5] * 127);
        u8[i * 20 + 16] = Math.min(255, v[o + 6]); u8[i * 20 + 17] = Math.min(255, v[o + 7]); u8[i * 20 + 18] = Math.min(255, v[o + 8]); u8[i * 20 + 19] = v[o + 9] ? 255 : 0;
      }
      return { data: new Uint8Array(buf), count: n, raw: v };
    }
  }
  BS.MeshBuf = MeshBuf;
  // ---------------------------------------------------------------- the modules (local: x along the side 0…2, z outward 0…1.3, y up 0…2)
  function planks(M, x0, x1, z0, z1, y0, y1, n) { const w = (z1 - z0) / n; for (let i = 0; i < n; i++) M.box(x0 + 0.02, y0, z0 + i * w + 0.014, x1 - 0.02, y1, z0 + (i + 1) * w - 0.014, [C.wood, C.woodL, C.woodD][i % 3]); }
  function hazard(M, x0, x1, y0, y1, z0, z1) { const n = Math.max(1, Math.round((x1 - x0) / 0.25)), w = (x1 - x0) / n; for (let i = 0; i < n; i++) M.box(x0 + i * w, y0, z0, x0 + (i + 1) * w, y1, z1, i & 1 ? C.black : C.toe, { skip: 3 }); }
  const TUBE = 0.05;
  BS.MOD = {
    bay() {   // one bay of scaffolding: two standards, ledgers and a transom under the deck, three planks, toe board and two rails outside
      const M = new MeshBuf(), t = TUBE;
      for (const zc of [0.1, 1.2]) M.box(-t, 0, zc - t, t, 2, zc + t, C.steel, { skip: 12 });
      for (const zc of [0.1, 1.2]) M.box(0, -0.08, zc - t, 2, 0.03, zc + t, C.steelD, { skip: 3 });
      M.box(-t, -0.08, 0.1, t, 0.03, 1.2, C.steelD, { skip: 48 });
      planks(M, 0, 2, 0.14, 1.26, 0.03, 0.11, 3);
      M.box(0, 0.11, 1.22, 2, 0.3, 1.25, C.toe, { skip: 3 });
      for (const yc of [0.56, 1.06]) M.box(0, yc - 0.035, 1.2 - 0.035, 2, yc + 0.035, 1.2 + 0.035, C.steel, { skip: 3 });
      return M.pack();
    },
    brace() { return new MeshBuf().beam(0.06, 0.14, 1.29, 1.94, 1.96, 1.29, 0.06, C.steelD).pack(); },
    // the climbing screen of a tall one: a closed orange panel with a white band outside the scaffold
    screen() {
      const M = new MeshBuf();
      for (let i = 0; i < 5; i++) M.box(0.04 + i * 0.4, 0.04, 1.3, 0.3 + i * 0.4, 1.96, 1.34, C.orange, { skip: 12 });
      M.box(0.01, 0.9, 1.341, 1.99, 1.08, 1.36, C.white, { skip: 47 });
      M.box(0.01, 1.86, 1.341, 1.99, 1.97, 1.36, C.black, { skip: 47 });
      return M.pack();
    },
    // the scaffold's corner square (1.3 × 1.3): standards, planks, toe boards and rails on both outer sides
    corner(deck) {
      const M = new MeshBuf(), t = TUBE, h = deck ? 1.12 : 2;
      for (const [xc, zc] of [[1.2, 1.2], [0.1, 1.2], [1.2, 0.1], [0.1, 0.1]]) M.box(xc - t, deck ? -0.4 : 0, zc - t, xc + t, h, zc + t, C.steel, { skip: 12 });
      planks(M, 0, 1.3, 0.04, 1.3, 0.03, 0.11, 3);
      if (deck) { hazard(M, 0, 1.3, 0.11, 0.3, 1.22, 1.25); M.box(1.22, 0.11, 0, 1.25, 0.3, 1.3, C.toe, { skip: 48 }); }
      else { M.box(0, 0.11, 1.22, 1.3, 0.3, 1.25, C.toe, { skip: 3 }); M.box(1.22, 0.11, 0, 1.25, 0.3, 1.3, C.toe, { skip: 48 }); }
      for (const yc of [0.56, 1.06]) { M.box(0, yc - 0.035, 1.165, 1.3, yc + 0.035, 1.235, C.steel, { skip: 3 }); M.box(1.165, yc - 0.035, 0, 1.235, yc + 0.035, 1.3, C.steel, { skip: 48 }); }
      if (deck) { M.box(1.17, 1.12, 1.17, 1.23, 1.55, 1.23, C.black, { skip: 12 }); M.box(1.08, 1.55, 1.08, 1.32, 1.72, 1.32, C.lamp, { e: true }); }   // a work light
      return M.pack();
    },
    // the working deck (one bay of it): planks on short posts, hazard-striped toe board, rails out- and inside
    deck() {
      const M = new MeshBuf(), t = TUBE;
      for (const zc of [0.1, 1.2]) M.box(-t, -0.4, zc - t, t, 1.12, zc + t, C.steel, { skip: 12 });
      for (const zc of [0.1, 1.2]) M.box(0, -0.08, zc - t, 2, 0.03, zc + t, C.steelD, { skip: 3 });
      planks(M, 0, 2, 0.14, 1.26, 0.03, 0.11, 3);
      hazard(M, 0, 2, 0.11, 0.3, 1.22, 1.25);
      for (const yc of [0.56, 1.06]) M.box(0, yc - 0.035, 1.2 - 0.035, 2, yc + 0.035, 1.2 + 0.035, C.steel, { skip: 3 });
      M.box(0, 1.06 - 0.03, 0.1 - 0.03, 2, 1.06 + 0.03, 0.1 + 0.03, C.toe, { skip: 3 });
      return M.pack();
    },
    // the crane's mast: two blocks of lattice, 1.6 wide, centred
    mast() {
      const M = new MeshBuf(), a = 0.72, t = 0.07;
      for (const [x, z] of [[-a, -a], [a, -a], [a, a], [-a, a]]) M.box(x - t, 0, z - t, x + t, 2, z + t, C.yellow, { skip: 12 });
      for (const [x0, z0, x1, z1] of [[-a, -a, a, -a], [a, -a, a, a], [a, a, -a, a], [-a, a, -a, -a]]) { M.beam(x0, 0.05, z0, x1, 0.05, z1, 0.08, C.yellowD); M.beam(x0, 0.08, z0, x1, 1.95, z1, 0.06, C.yellow); }
      return M.pack();
    },
    // the barrier (a panel two blocks long): feet, posts, a red and white board, a lamp on every other one
    fence() {
      const M = new MeshBuf();
      for (const x of [0.06, 1.94]) { M.box(x - 0.2, 0, -0.14, x + 0.2, 0.14, 0.14, C.concrete); M.box(x - 0.04, 0.14, -0.04, x + 0.04, 1.05, 0.04, C.steel, { skip: 12 }); }
      for (let i = 0; i < 8; i++) M.box(0.06 + i * 0.235, 0.62, -0.025, 0.06 + (i + 1) * 0.235, 0.86, 0.025, i & 1 ? C.white : C.red);
      M.box(0.06, 0.25, -0.02, 1.94, 0.3, 0.02, C.steelD, { skip: 3 });
      M.box(1.88, 1.05, -0.07, 2.0, 1.17, 0.07, 0xFFB020, { e: true });
      return M.pack();
    },
    trolley() { const M = new MeshBuf(); M.box(-0.55, -0.35, -0.6, 0.55, 0, 0.6, C.grey); M.box(-0.2, -0.5, -0.3, 0.2, -0.35, 0.3, C.black); return M.pack(); },
    cable() { const M = new MeshBuf(); for (const z of [-0.22, 0.22]) M.box(-0.035, -1, z - 0.035, 0.035, 0, z + 0.035, C.cable, { skip: 12 }); return M.pack(); },
    hook() {
      const M = new MeshBuf();
      M.box(-0.36, -0.62, -0.28, 0.36, 0, 0.28, C.yellow); for (let i = 0; i < 3; i++) M.box(-0.37, -0.56 + i * 0.2, -0.29, 0.37, -0.48 + i * 0.2, 0.29, C.black, { skip: 12 });
      M.box(-0.05, -0.95, -0.05, 0.05, -0.62, 0.05, C.grey); M.box(-0.05, -1.0, -0.05, 0.22, -0.92, 0.05, C.grey);
      for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [0.6, 0.6], [-0.6, 0.6]]) M.beam(0, -0.95, 0, x, -1.85, z, 0.035, C.cable);   // the slings
      return M.pack();
    },
    pallet() { const M = new MeshBuf(); M.box(-0.75, 0, -0.75, 0.75, 0.08, 0.75, C.woodL); for (const x of [-0.6, 0, 0.6]) M.box(x - 0.08, -0.12, -0.75, x + 0.08, 0, 0.75, C.woodD); return M.pack(); },
    // the load: two by two by two blocks on the pallet, white (the draw tints them with the layer's colour)
    cubes() { const M = new MeshBuf(), s = 0.31; for (const x of [-s, s]) for (const z of [-s, s]) for (const y of [0.08, 0.7]) M.box(x - s + 0.01, y, z - s + 0.01, x + s - 0.01, y + 0.6, z + s - 0.01, y < 0.5 ? 0xE8E8E8 : 0xFFFFFF); return M.pack(); },
    blink() { const M = new MeshBuf(); M.box(-0.16, 0, -0.16, 0.16, 0.26, 0.16, 0xFF3020, { e: true }); return M.pack(); },
    // the topping-out tree (Richtbaum) put on the roof when it stands: a little fir with ribbons in the party's colours
    tree() {
      const M = new MeshBuf();
      M.box(-0.07, 0, -0.07, 0.07, 2.25, 0.07, 0x7A5230, { skip: 8 });
      const tiers = [[0.45, 0.62, 0.95, 0x2F7A3A], [0.85, 0.5, 1.3, 0x37884A], [1.22, 0.38, 1.62, 0x2B6E36], [1.55, 0.26, 1.92, 0x3C9450], [1.86, 0.13, 2.22, 0x2F7A3A]];
      for (const [y0, r, y1, col] of tiers) M.box(-r, y0, -r, r, y1, r, col);
      const rib = [0xD8322A, 0xF2B90F, 0x2E6FD8, 0xF2F2EE, 0x3CB44B, 0xE85BB0];
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.4, ca = Math.cos(a), sa = Math.sin(a); M.beam(ca * 0.1, 2.1, sa * 0.1, ca * 0.86, 0.62, sa * 0.86, 0.07, rib[i]); }
      return M.pack();
    },
    // the site office: a container (white, blue posts) with two windows, a door and a step at the front (+z), centred
    office() {
      const M = new MeshBuf(), BL = 0x2F5FA8, WH = 0xE6E9EC, hx = 3, hz = 1.22;
      M.box(-hx, 0, -hz, hx, 0.22, hz, C.grey);
      M.box(-hx + 0.06, 0.22, -hz + 0.06, hx - 0.06, 2.5, hz - 0.06, WH);
      for (const [x, z] of [[-hx, -hz], [hx - 0.16, -hz], [hx - 0.16, hz - 0.16], [-hx, hz - 0.16]]) M.box(x, 0.22, z, x + 0.16, 2.6, z + 0.16, BL);
      M.box(-hx, 2.5, -hz, hx, 2.62, hz, BL);
      for (const x of [-2.3, 0.9]) { M.box(x, 1.05, hz - 0.06, x + 1.4, 2.0, hz - 0.02, C.glass, { skip: 47 }); M.box(x - 0.06, 0.98, hz - 0.06, x + 1.46, 1.05, hz + 0.02, BL, { skip: 32 }); }
      M.box(-0.6, 0.22, hz - 0.06, 0.35, 2.2, hz - 0.02, 0x3D4C5E, { skip: 47 });
      M.box(0.18, 1.14, hz - 0.02, 0.28, 1.22, hz + 0.06, C.steel);
      M.box(-0.75, 0, hz, 0.5, 0.18, hz + 0.5, C.grey, { skip: 32 });
      return M.pack();
    },
    // the slewing part for a jib of length Lj and a counter-jib of Lc: turntable, cab, tower head, lattice jib,
    // counter-jib with its counterweight, pendants (local +x = the jib)
    top(Lj, Lc) {
      const M = new MeshBuf();
      M.box(-1.0, 0, -1.0, 1.0, 0.55, 1.0, C.grey);
      M.box(0.2, 0.55, 0.95, 1.5, 1.75, 2.05, C.yellow); M.box(1.5, 0.95, 1.05, 1.53, 1.6, 1.95, C.glass, { skip: 62 }); M.box(0.3, 0.95, 2.05, 1.4, 1.6, 2.08, C.glass, { skip: 47 });
      for (const [x, z] of [[-0.8, -0.8], [0.8, -0.8], [0.8, 0.8], [-0.8, 0.8]]) M.beam(x, 0.55, z, 0, 4.6, 0, 0.12, C.yellow);
      // the jib: two bottom chords, a top chord, diagonals every two blocks
      const y0 = 0.6, y1 = 2.0, zb = 0.62;
      for (const z of [-zb, zb]) M.box(0.8, y0, z - 0.06, Lj, y0 + 0.12, z + 0.06, C.yellow, { skip: 0 });
      M.box(0.8, y1 - 0.06, -0.06, Lj - 1, y1 + 0.06, 0.06, C.yellow);
      for (let x = 0.8; x < Lj - 1.2; x += 2) { for (const z of [-zb, zb]) { M.beam(x, y0 + 0.1, z, x + 1, y1, 0, 0.06, C.yellowD); M.beam(x + 1, y1, 0, x + 2, y0 + 0.1, z, 0.06, C.yellowD); } M.beam(x, y0 + 0.06, -zb, x, y0 + 0.06, zb, 0.05, C.yellowD); }
      M.beam(Lj - 1, y1, 0, Lj, y0 + 0.12, 0, 0.08, C.yellow);
      // the counter-jib and its weights (concrete, a red and white end)
      M.box(-Lc, 0.45, -0.7, -0.8, 0.7, 0.7, C.yellow);
      M.box(-Lc + 0.15, -1.1, -0.75, -Lc + 2.4, 0.45, 0.75, C.concrete);
      for (let i = 0; i < 4; i++) M.box(-Lc + 0.12, -1.1 + i * 0.39, -0.76, -Lc + 0.15, -0.9 + i * 0.39, 0.76, i & 1 ? C.white : C.red, { skip: 61 });
      M.beam(0, 4.6, 0, Lj * 0.68, y1, 0, 0.05, C.cable); M.beam(0, 4.6, 0, -Lc + 1.2, 0.7, 0, 0.05, C.cable);
      return M.pack();
    },
  };
  // the instanced vox program needs the renderer's 'voxInst' (shaders.js VOX_VS with INST); the meshes are made once per context
  function gpu(r) {
    const gl = r.gl;
    if (BS.gpuFor === gl && BS.gpuSet) return BS.gpuSet;
    const up = (m) => { const o = VR.VoxGPU.upload(gl, m); o.data = null; return o; };
    const G = {};
    for (const k of ['bay', 'brace', 'screen', 'deck', 'mast', 'fence', 'trolley', 'cable', 'hook', 'pallet', 'cubes', 'blink', 'tree', 'office']) G[k] = up(BS.MOD[k]());
    G.corner = up(BS.MOD.corner(false)); G.deckCorner = up(BS.MOD.corner(true));
    BS.gpuFor = gl; BS.gpuSet = G;
    return G;
  }
  function instVAO(gl, mesh, buf) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.BYTE, true, 20, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, 20, 16);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 16, 0); gl.vertexAttribDivisor(3, 1);
    gl.bindVertexArray(null);
    return vao;
  }
  // instances a … b of a list (WebGL2 has no base instance: the pointer starts there)
  function drawInst(gl, vao, buf, mesh, a, b) {
    if (b <= a) return 0;
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 16, a * 16);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, mesh.count, b - a);
    return b - a;
  }

  // ---------------------------------------------------------------- one site's show
  const PI = Math.PI, TAU = PI * 2, SND = { vol: 1 };
  const wrapA = (a) => { while (a > PI) a -= TAU; while (a < -PI) a += TAU; return a; };
  const arrived = (c) => Math.abs(wrapA(c.slewT - c.slew)) < 0.05 && Math.abs(c.r - c.rT) < 0.3 && Math.abs(c.slewV) < 0.1;   // (the jib and the trolley are where they should be)
  class Show {
    constructor(site) {
      this.site = site; const o = site.o, g = site.g;
      this.t = 0; this.doneT = -1; this.cancelT = -1; this.gone = false;
      this.tiny = site.tiny; this.scaffold = site.scaffold;
      const sb = o.sbox || o.box;
      this.ox = sb[0]; this.oz = sb[2]; this.oy = o.H ? o.yMin : sb[1];
      this.H = o.H; this.top = o.H ? o.yMax + 1 : sb[4] + 1;
      this.cx = (sb[0] + sb[3] + 1) / 2; this.cz = (sb[2] + sb[5] + 1) / 2; this.sw = sb[3] + 1 - sb[0]; this.sd = sb[5] + 1 - sb[2];
      this.deck = 0; this.deckV = 0;                     // the deck's height over the origin (its planks)
      this.band = this.H > 24 ? 6 : 1e9;                 // levels of scaffold under the deck
      this.light = new Float32Array(4); this.lightT = -1;
      this.mm = new Float32Array(16); this.tint = new Float32Array(3);
      this.pt = [0, 0, 0, 0];                            // a ring point (x, z, inward yaw, perimeter)
      this.crew = []; this.crane = null; this.inst = null; this.gl = null;
      this.hits = 0; this.knockT = -1; this.motor = 0;
      const S = g.settings || {};
      this.preset = S.preset || 'balanced';
      // the plan's volume as a blueprint ghost while it is built (gadgets.js outlines)
      this.outline = { x: sb[0], y: sb[1], z: sb[2], boxes: [[0, 0, 0, sb[3] + 1 - sb[0], sb[4] + 1 - sb[1], sb[5] + 1 - sb[2]]], color: [0.35, 0.95, 1, 0.5] };
      // (the barrier, the office and the crane stand on the ground as the earthworks leave it: placed again then)
      this.grounded = !o.nEarth; this.office = null; this.tree = null;
      if (this.scaffold) {
        this.rings();
        this.fence();
        if (VR.Folk && VR.FolkAnim) this.makeCrew();
        if (this.top - site.F > 12 && this.preset !== 'potato') this.makeCrane();
        if (this.grounded) this.placeOffice();
      }
    }
    // the earthworks are done: the barrier on the new ground, the office, the crane (it goes up only now)
    ground() {
      if (this.gl) this.dispose();
      this.fence();
      this.placeOffice();
      if (this.crane && this.crane.rise <= 0) this.makeCrane();
    }
    // ---- rings and the instance lists
    rings() {
      const o = this.site.o, H = o.H, LB = o.layerBox, K = this.K = Math.max(1, Math.ceil(H / 2) + 1), sb = o.sbox;
      const ring = this.ring = new Float32Array(K * 4);
      // every column's height (a low wall, a fence, a lamp in the yard is not scaffolded: a level takes the columns
      // that reach at least its rail)
      const L = this.site.list, colH = new Map(), y0 = o.yMin;
      for (let i = o.nEarth; i < L.length; i++) { const e = L[i], k = e[0] + ',' + e[2], h = e[1] - y0; if (!(colH.get(k) >= h)) colH.set(k, h); }
      const cols = []; for (const [k, h] of colH) { const c = k.indexOf(','); cols.push(+k.slice(0, c), +k.slice(c + 1), h); }
      for (let k = 0; k < K; k++) {
        let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
        for (let i = 0; i < cols.length; i += 3) { if (cols[i + 2] < 2 * k + 2) continue; const x = cols[i], z = cols[i + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
        if (x0 === Infinity) for (let h = 2 * k - 1; h <= 2 * k + 2; h++) { if (h < 0 || h >= H) continue; const b = h * 4; if (LB[b] > LB[b + 1]) continue; if (LB[b] < x0) x0 = LB[b]; if (LB[b + 1] > x1) x1 = LB[b + 1]; if (LB[b + 2] < z0) z0 = LB[b + 2]; if (LB[b + 3] > z1) z1 = LB[b + 3]; }
        if (x0 === Infinity) { if (k) { ring[k * 4] = ring[k * 4 - 4]; ring[k * 4 + 1] = ring[k * 4 - 3]; ring[k * 4 + 2] = ring[k * 4 - 2]; ring[k * 4 + 3] = ring[k * 4 - 1]; continue; } x0 = sb[0]; x1 = sb[3]; z0 = sb[2]; z1 = sb[5]; }
        ring[k * 4] = x0 - this.ox; ring[k * 4 + 1] = x1 + 1 - this.ox; ring[k * 4 + 2] = z0 - this.oz; ring[k * 4 + 3] = z1 + 1 - this.oz;
      }
      const G = 0.06, bays = [], braces = [], corners = [], bayStart = new Int32Array(K + 1), braceStart = new Int32Array(K + 1);
      for (let k = 0; k < K; k++) {
        bayStart[k] = bays.length / 4; braceStart[k] = braces.length / 4;
        const X0 = ring[k * 4], X1 = ring[k * 4 + 1], Z0 = ring[k * 4 + 2], Z1 = ring[k * 4 + 3], y = 2 * k;
        const side = (L, rot, fx) => { const n = Math.max(1, Math.ceil(L / 2.4)), w = L / n, enc = rot + 4 * Math.round(w / 2 * 256); for (let i = 0; i < n; i++) { const p = fx(i * w); bays.push(p[0], y, p[1], enc); if (i % 3 === 1) braces.push(p[0], y, p[1], enc); } };
        side(X1 - X0, 0, (d) => [X0 + d, Z1 + G]);
        side(Z1 - Z0, 1, (d) => [X1 + G, Z1 - d]);
        side(X1 - X0, 2, (d) => [X1 - d, Z0 - G]);
        side(Z1 - Z0, 3, (d) => [X0 - G, Z0 + d]);
        corners.push(X1 + G, y, Z1 + G, 0, X1 + G, y, Z0 - G, 1, X0 - G, y, Z0 - G, 2, X0 - G, y, Z1 + G, 3);
      }
      bayStart[K] = bays.length / 4; braceStart[K] = braces.length / 4;
      this.inst = { bays: new Float32Array(bays), braces: new Float32Array(braces), corners: new Float32Array(corners), bayStart, braceStart };
    }
    // the barrier around the site on the ground (a gap where the crew comes in, toward the player), each panel on the
    // ground under it
    fence() {
      const R = this.ring, g = this.site.g, w = g.world, p = g.player && g.player.pos, D = 5.2, out = [];
      const X0 = R[0] - D, X1 = R[1] + D, Z0 = R[2] - D, Z1 = R[3] + D;
      const gx = p ? p[0] - this.ox : 0, gz = p ? p[2] - this.oz : 1e9;   // (the gate: the panels nearest the player stay open)
      const near = [];
      // (a panel over a wall, a roof or a pit next door is left out: the barrier stands only on open ground)
      const side = (L, rot, fx) => { const n = Math.max(1, Math.round(L / 2)), wd = L / n, enc = rot + 4 * Math.round(wd / 2 * 256); for (let i = 0; i < n; i++) { const q = fx(i * wd), mx = q[0] + (rot === 0 ? wd / 2 : rot === 2 ? -wd / 2 : 0), mz = q[1] + (rot === 1 ? -wd / 2 : rot === 3 ? wd / 2 : 0); const y = w && w.topAt ? w.topAt(Math.floor(this.ox + mx), Math.floor(this.oz + mz)) + 1 - this.oy : 0; if (!(Math.abs(y) < 4)) continue; near.push([(mx - gx) ** 2 + (mz - gz) ** 2, out.length]); out.push(q[0], y, q[1], enc); } };
      side(X1 - X0, 0, (d) => [X0 + d, Z1]); side(Z1 - Z0, 1, (d) => [X1, Z1 - d]); side(X1 - X0, 2, (d) => [X1 - d, Z0]); side(Z1 - Z0, 3, (d) => [X0, Z0 + d]);
      near.sort((a, b) => a[0] - b[0]);
      const gap = new Set(near.slice(0, 2).map(q => q[1]));
      const keep = []; for (let i = 0; i < out.length; i += 4) if (!gap.has(i)) keep.push(out[i], out[i + 1], out[i + 2], out[i + 3]);
      this.fenceInst = new Float32Array(keep);
    }
    // the site office: a container beside the gate, outside the barrier and the plan's lot, its door toward the
    // player — only on level, open ground (nothing solid where it stands), else there is none
    placeOffice() {
      this.office = null;
      const g = this.site.g, w = g.world, R0 = this.ring, TT = VR.R && VR.R.T, FF = VR.F, p = g.player && g.player.pos, pb = this.site.o.box;
      if (!w || !w.getBlock || !w.topAt || !R0 || !TT || !TT.flags || !FF || !p) return;
      const D = 5.2, X0 = this.ox + R0[0] - D, X1 = this.ox + R0[1] + D, Z0 = this.oz + R0[2] - D, Z1 = this.oz + R0[3] + D;
      const dx = p[0] - this.cx, dz = p[2] - this.cz;
      let nx = 0, nz = 0; if (Math.abs(dx) * (Z1 - Z0) > Math.abs(dz) * (X1 - X0)) nx = dx < 0 ? -1 : 1; else nz = dz < 0 ? -1 : 1;
      const yaw = nz > 0 ? 0 : nz < 0 ? PI : nx > 0 ? PI / 2 : -PI / 2;
      // its centre line: 0.8 off the barrier, clear of the lot
      const n = nx || nz, at = nz ? (n > 0 ? Math.max(Z1 + 2.0, pb[5] + 2.6) : Math.min(Z0 - 2.0, pb[2] - 1.6)) : (n > 0 ? Math.max(X1 + 2.0, pb[3] + 2.6) : Math.min(X0 - 2.0, pb[0] - 1.6));
      const gateU = nz ? clamp(p[0], X0, X1) : clamp(p[2], Z0, Z1);
      const c = this.crane, solid = FF.SOLID;
      for (const off of [6.5, -6.5, 10.5, -10.5]) {
        const u = gateU + off, ox = nz ? u : at, oz = nz ? at : u;
        if (c && (Math.hypot(ox - c.bx, oz - c.bz) < 6 || Math.hypot(ox - c.yard[0], oz - c.yard[1]) < 6)) continue;
        const ax = nz ? 3 : 1.25, az = nz ? 1.25 : 3;
        if (Math.abs(p[0] - ox) < ax + 1 && Math.abs(p[2] - oz) < az + 1) continue;   // (not where the player stands)
        let gy = null, ok = true;
        for (let x = Math.floor(ox - ax); ok && x <= Math.floor(ox + ax - 0.01); x++) for (let z = Math.floor(oz - az); ok && z <= Math.floor(oz + az - 0.01); z++) {
          const t = w.topAt(x, z); if (gy === null) gy = t; else if (t !== gy) { ok = false; break; }
          for (let y = t + 1; y <= t + 3; y++) { const s = w.getBlock(x, y, z); if (s && (TT.flags[s] & solid)) { ok = false; break; } }
        }
        if (!ok || gy === null || Math.abs(gy + 1 - this.oy) > 3) continue;
        this.office = { x: ox, y: gy + 1, z: oz, yaw };
        return;
      }
    }
    // a point on the deck's walk around level k at s (0…1): out = [x, z, the yaw that faces the wall, the walk's length]
    ringPoint(k, s, out) {
      const R = this.ring, i = clamp(k, 0, this.K - 1) * 4, d = 0.72;
      const X0 = R[i] - d, X1 = R[i + 1] + d, Z0 = R[i + 2] - d, Z1 = R[i + 3] + d, a = X1 - X0, b = Z1 - Z0, P = 2 * (a + b);
      let q = (s - Math.floor(s)) * P;
      if (q < a) { out[0] = X0 + q; out[1] = Z1; out[2] = 0; }
      else if ((q -= a) < b) { out[0] = X1; out[1] = Z1 - q; out[2] = PI / 2; }
      else if ((q -= b) < a) { out[0] = X1 - q; out[1] = Z0; out[2] = PI; }
      else { q -= a; out[0] = X0; out[1] = Z0 + q; out[2] = -PI / 2; }
      out[3] = P;
      return out;
    }
    level() { return clamp(Math.floor(this.deck / 2), 0, this.K - 1); }
    // ---- the crew: the villagers' builders, walking in from the side the player looks from
    makeCrew() {
      const g = this.site.g, P = this.ringPoint(0, 0, this.pt)[3];
      const n = Math.max(1, Math.min(CREW[this.preset] || 3, Math.round(P / 14)));
      const p = g.player && g.player.pos, dx = p ? p[0] - this.cx : 1, dz = p ? p[2] - this.cz : 0, dl = Math.hypot(dx, dz) || 1;
      const rad = Math.max(this.ring[1] - this.ring[0], this.ring[3] - this.ring[2]) * 0.6 + 7;
      this.gate = [this.cx + dx / dl * rad, this.cz + dz / dl * rad];
      for (let i = 0; i < n; i++) {
        const seed = (Math.floor(this.cx * 7919 + this.cz * 104729 + i * 31337) >>> 0) || 1;
        const look = VR.Folk.look(seed, 'builder', 'adult');
        this.crew.push({
          look, seed, s: (i + 0.5) / n + (rnd() - 0.5) * 0.08, sT: 0, mode: 'walkin', delay: 0.25 + i * 0.55, timer: 0, work: false,
          pos: [this.gate[0] + (rnd() - 0.5) * 2, this.oy, this.gate[1] + (rnd() - 0.5) * 2], yaw: 0, walk: rnd() * 6, walkAmt: 0, lx: 0, lz: 0,
          state: 'idle', poseOut: {}, hitPh: 0, opts: { flash: 0, scale: 1, shade: 0, noFog: false, hide: { lids: true, mouth: true } },
        });
      }
    }
    // ---- the crane: at the corner of the structure away from the player, its jib reaching every corner
    makeCrane() {
      const g = this.site.g, w = g.world, o = this.site.o, sb = o.sbox, p = g.player && g.player.pos;
      const cs = [[sb[0], sb[2], -1, -1], [sb[3] + 1, sb[2], 1, -1], [sb[3] + 1, sb[5] + 1, 1, 1], [sb[0], sb[5] + 1, -1, 1]];
      let best = cs[0], bd = -1;
      for (const c of cs) { const d = p ? (c[0] - p[0]) ** 2 + (c[1] - p[2]) ** 2 : rnd(); if (d > bd) { bd = d; best = c; } }
      const bx = best[0] + best[2] * 3.6, bz = best[1] + best[3] * 3.6;
      let by = w && w.topAt ? w.topAt(Math.floor(bx), Math.floor(bz)) + 1 : this.oy;
      if (!(by > this.oy - 40)) by = this.oy;
      const want = this.top + 5.5, n = Math.max(3, Math.ceil((want - by) / 2)), mastTop = by + n * 2;
      let Lj = 10; for (const c of cs) Lj = Math.max(Lj, Math.hypot(c[0] - bx, c[1] - bz) + 2.5); Lj = Math.min(72, Math.ceil(Lj));
      const Lc = clamp(Math.round(Lj * 0.3), 5, 16);
      const out = [bx - this.cx, bz - this.cz], ol = Math.hypot(out[0], out[1]) || 1;
      // the yard (where the loads wait): beside the mast, a quarter turn from the building, on the player's side
      let sx = -out[1] / ol, sz = out[0] / ol; if (p && (p[0] - bx) * sx + (p[2] - bz) * sz < 0) { sx = -sx; sz = -sz; }
      const yard = [bx + sx * 6 + out[0] / ol * 1.5, bz + sz * 6 + out[1] / ol * 1.5];
      const toC = Math.atan2(-(this.cz - bz), this.cx - bx);
      const mast = new Float32Array(n * 4); for (let i = 0; i < n; i++) { mast[i * 4] = bx - this.ox; mast[i * 4 + 1] = by - this.oy + i * 2; mast[i * 4 + 2] = bz - this.oz; mast[i * 4 + 3] = 0; }
      this.crane = { slew0: Math.atan2(out[1], out[0]), bx, by, bz, n, mastTop, Lj, Lc, yard, yardY: (w && w.topAt ? w.topAt(Math.floor(yard[0]), Math.floor(yard[1])) + 1 : this.oy), mast,
        slew: toC, slewV: 0, slewT: toC, r: Lj * 0.5, rT: Lj * 0.5, hook: mastTop - 4, hookT: mastTop - 4, st: 'rest', tm: 0.5, load: false, col: [0.8, 0.8, 0.8],
        sway: 0, swayV: 0, rise: 0, top: null, aimX: 0, aimZ: 0, aimY: 0, segs: Math.min(n, 4), top0: mastTop };
      this.crane.mastTop = by + this.crane.segs * 2; this.crane.hook = this.crane.hookT = this.crane.mastTop - 4;
    }
    // ---- events from the job
    start() {
      const g = this.site.g;
      if (g.ui && g.ui.toast && !this.tiny) g.ui.toast(T('g.bau.start', null, '🏗 Baustelle', '🏗 Construction site'), T('g.bau.startSub', { name: this.site.name }, '{name} entsteht — Klick drauf: sofort fertig', '{name} is being built — click it: done at once'));
      this.sound('bau_start', this.cx, this.oy + 2, this.cz, 1);
    }
    onWrite(a, b) {
      const g = this.site.g, P = g.particles; if (!P) return;
      const L = this.site.list, earth = a < this.site.o.nEarth, n = Math.min(this.tiny ? 6 : 4, 1 + ((b - a) >> 7));
      for (let i = 0; i < n; i++) {
        const e = L[a + Math.floor(rnd() * (b - a))];
        if (this.tiny) { sparkle(P, e[0] + 0.5, e[1] + 0.5, e[2] + 0.5); continue; }
        dust(P, e[0] + 0.5, e[1] + (e[3] ? 0.9 : 0.5), e[2] + 0.5, earth && !e[3] ? 0 : earth ? 1 : 2);
      }
      if (!this.tiny && this.t - this.knockT > 0.22) { this.knockT = this.t; const e = L[b - 1]; this.sound(earth ? 'thud' : 'place', e[0] + 0.5, e[1], e[2] + 0.5, 0.5, e[3]); }
    }
    onDone() {
      this.doneT = 0;
      const g = this.site.g, P = g.particles, x = this.cx, y = this.top + 1, z = this.cz;
      this.sound(this.tiny ? 'twinkle' : 'fanfare', x, this.oy + 2, z, 1);   // (heard from the street, not from the roof)
      if (P) {
        if (this.tiny) for (let i = 0; i < 24; i++) sparkle(P, x + (rnd() - 0.5) * 2, this.oy + rnd() * Math.max(1, this.H), z + (rnd() - 0.5) * 2);
        else confetti(P, x, y, z, [70, 140, 240][clamp((g.settings && g.settings.particles) | 0, 0, 2)], Math.max(4, (this.ring ? Math.max(this.ring[1] - this.ring[0], this.ring[3] - this.ring[2]) : 8) * 0.5));
        // a glint runs up the corners of the new building
        if (!this.tiny && this.sw) for (let i = 0; i < 48; i++) { const cx = this.ox + (i & 1 ? this.sw : 0), cz = this.oz + (i & 2 ? this.sd : 0); SPARKLE.col[0] = 1; SPARKLE.col[1] = 0.92; SPARKLE.col[2] = 0.6; P.spawn(cx + (rnd() - 0.5) * 0.4, this.oy + rnd() * Math.max(2, this.H) * 0.3, cz + (rnd() - 0.5) * 0.4, 0, 4 + rnd() * Math.max(4, this.H / 3), 0, SPARKLE); }
        SPARKLE.col[2] = 1;
      }
      // Richtfest: the topping-out tree on the roof (the highest layer of four or more cells — over a spire or a flag
      // pole it stands on the roof under it), the cell nearest the middle
      if (this.scaffold && !this.tiny && this.H >= 4) {
        const o = this.site.o, L = this.site.list;
        let h = o.H - 1; while (h > 0 && o.layerStart[h + 1] - o.layerStart[h] < 4) h--;
        let best = -1, bd = Infinity;
        for (let i = o.nEarth + o.layerStart[h]; i < o.nEarth + o.layerStart[h + 1]; i++) { const e = L[i], d = (e[0] + 0.5 - this.cx) ** 2 + (e[2] + 0.5 - this.cz) ** 2; if (d < bd) { bd = d; best = i; } }
        if (best >= 0) {
          const e = L[best]; this.tree = { x: e[0] + 0.5, y: e[1] + 1, z: e[2] + 0.5, s: clamp(this.H / 18, 1, 2.6) };
          if (P) for (let i = 0; i < 14; i++) sparkle(P, this.tree.x, this.tree.y + rnd() * 2 * this.tree.s, this.tree.z);
        }
      }
      for (const b of this.crew) { if (b.mode === 'gone') continue; if (b.delay > 0) { b.mode = 'gone'; continue; } if (b.mode === 'walkin') { b.mode = 'leave'; continue; } b.mode = 'cheer'; b.timer = 1.6 + rnd() * 0.4; }
      if (g.ui && g.ui.hint && !this.tiny && this.site.kind !== 'blueprint') g.ui.hint(T('g.bau.done', { name: this.site.name }, '✨ {name} steht!', '✨ {name} is done!'), 2600);
    }
    onCancel() { this.cancelT = 0; this.tree = null; for (const b of this.crew) { if (b.mode === 'gone') continue; if (b.delay > 0) { b.mode = 'gone'; continue; } b.mode = b.mode === 'walkin' ? 'leave' : 'ride'; b.timer = 0.8; } }
    // ---- every frame
    tick(dt) {
      const site = this.site; this.t += dt;
      if (site.phase === 'gone') return;
      if (!this.grounded && site.phase !== 'earth') { this.grounded = true; if (this.scaffold) this.ground(); }
      const o = site.o;
      // the build front over the origin (layers), smooth; the deck a little under it (hands at the newest layer)
      let front = 0;
      if (site.phase === 'earth' || site.phase === 'build') {
        if (site.t > site.Te && site.Tb > 0) front = clamp((site.t - site.Te) / site.Tb, 0, 1) * this.H;
        const want = Math.max(0, front - 1.25);
        this.deck += (want - this.deck) * Math.min(1, dt * 6);
      } else {
        // done / cancelled: a short celebration, then the deck rides down and the scaffold folds above it
        const tt = this.doneT >= 0 ? (this.doneT += dt) : (this.cancelT += dt), wait = this.doneT >= 0 ? 2.0 : 0.8;
        if (this.doneT >= 0 && this.deck < this.H - 1.25 && tt < 0.1) this.deck = Math.max(this.deck, this.H - 1.25);
        if (tt > wait) { const v = Math.max(7, this.H / 2.6); this.deck = Math.max(-0.11, this.deck - v * dt); }
        if (this.deck <= -0.1) {
          if (this.endT === undefined) { this.endT = tt; for (const b of this.crew) if (b.mode !== 'gone') b.mode = 'leave'; this.sound('clatter', this.cx, this.oy + 1, this.cz, 0.8); if (site.g.particles && this.scaffold) for (let i = 0; i < 10; i++) { const k = this.ringPoint(0, rnd(), this.pt); dust(site.g.particles, this.ox + k[0], this.oy + 0.4, this.oz + k[1], 1); } }
          if (tt - this.endT > 3.5 || !this.crew.length) site.phase = 'gone';
        }
        if (!this.scaffold && tt > 0.8) site.phase = 'gone';
      }
      if (this.crew.length) this.tickCrew(dt);
      if (this.crane) this.tickCrane(dt, front);
    }
    tickCrew(dt) {
      const site = this.site, pt = this.pt, k = this.level(), y = this.oy + this.deck + 0.11, FA = VR.FolkAnim;
      const building = site.phase === 'earth' || site.phase === 'build';
      for (const b of this.crew) {
        if (b.mode === 'gone') continue;
        if (b.delay > 0) { b.delay -= dt; continue; }
        let tx = b.pos[0], tz = b.pos[2], ty = b.pos[1], speed = 2.3, state = 'idle';
        if (b.mode === 'walkin') {
          this.ringPoint(k, b.s, pt); tx = this.ox + pt[0]; tz = this.oz + pt[1]; ty = y;
          if (Math.hypot(tx - b.pos[0], tz - b.pos[2]) < 0.25) { b.mode = building ? 'deck' : 'cheer'; b.timer = 0.5; b.sT = b.s; }
        } else if (b.mode === 'deck') {
          this.ringPoint(k, b.s, pt); const P = pt[3];
          if (!b.work) {
            const ds = b.sT - b.s, step = 1.6 * dt / P;
            if (Math.abs(ds) <= step) { b.s = b.sT; b.work = true; b.timer = 1.8 + rnd() * 2.4; }
            else b.s += Math.sign(ds) * step;
          } else {
            state = 'work'; b.timer -= dt;
            if (b.timer <= 0) { b.work = false; b.sT = b.s + (rnd() - 0.5) * Math.min(0.35, 18 / P); }
          }
          if (!building) { b.work = false; }
          this.ringPoint(k, b.s, pt); tx = this.ox + pt[0]; tz = this.oz + pt[1]; ty = y;
          if (b.work) b.faceYaw = pt[2];
        } else if (b.mode === 'cheer' || b.mode === 'ride') {
          this.ringPoint(k, b.s, pt); tx = this.ox + pt[0]; tz = this.oz + pt[1]; ty = y;
          if (b.mode === 'cheer') { state = 'cheer'; b.timer -= dt; if (b.timer <= 0) b.mode = 'ride'; b.faceYaw = pt[2] + PI; }
          else { b.faceYaw = pt[2]; }
        } else if (b.mode === 'leave') {
          const gx = this.gate[0], gz = this.gate[1], ax = gx - this.cx, az = gz - this.cz, al = Math.hypot(ax, az) || 1;
          if (!b.away) { b.away = [gx + ax / al * 9 + (rnd() - 0.5) * 6, gz + az / al * 9 + (rnd() - 0.5) * 6]; }
          tx = b.away[0]; tz = b.away[1]; ty = this.oy;
          const w = site.g.world; if (w && w.topAt) { const gy = w.topAt(Math.floor(b.pos[0]), Math.floor(b.pos[2])) + 1; if (gy > this.oy - 6 && gy < this.oy + 6) ty = gy; }
          if (Math.hypot(tx - b.pos[0], tz - b.pos[2]) < 0.4) { b.mode = 'gone'; continue; }
        }
        // move (on the deck the walk sets the place; off it a straight walk), the walk cycle from the distance covered
        const dx = tx - b.pos[0], dz = tz - b.pos[2], dist = Math.hypot(dx, dz);
        let moved = 0;
        if (b.mode === 'deck' || b.mode === 'cheer' || b.mode === 'ride') { const k = Math.min(1, dt * 12); b.pos[0] += (tx - b.pos[0]) * k; b.pos[2] += (tz - b.pos[2]) * k; b.pos[1] = ty; moved = Math.hypot(b.pos[0] - b.lx, b.pos[2] - b.lz); }   // (where the deck steps in at a setback they walk over, no jump)
        else if (dist > 0.01) { const st = Math.min(dist, speed * dt); b.pos[0] += dx / dist * st; b.pos[2] += dz / dist * st; moved = st; b.pos[1] += (ty - b.pos[1]) * Math.min(1, dt * 8); }
        const mv = moved / Math.max(dt, 1e-3);
        if (moved > 0.002) { const yw = Math.atan2(-(b.pos[0] - b.lx), -(b.pos[2] - b.lz)); if (isFinite(yw) && moved > 0.01) b.yaw += wrapA(yw - b.yaw) * Math.min(1, dt * 10); }
        else if (b.faceYaw !== undefined) b.yaw += wrapA(b.faceYaw - b.yaw) * Math.min(1, dt * 6);
        b.lx = b.pos[0]; b.lz = b.pos[2];
        b.walk += moved * 1.15; b.walkAmt += ((mv > 0.3 ? 1 : 0) - b.walkAmt) * Math.min(1, dt * 8);
        b.state = state;
        if (FA) FA.pose(b, state, dt, b.walk * 3, b.walkAmt, false, b.poseOut);
        // the hammer comes down (the 'work' clip: the arm is lowest at 0.33 of its 0.75 s): sparks and a knock
        if (state === 'work' && b.anim) {
          const ph = (b.anim.t % 0.75) / 0.75;
          if (b.hitPh < 0.44 && ph >= 0.44) this.hammer(b);
          b.hitPh = ph;
        }
      }
    }
    hammer(b) {
      const P = this.site.g.particles, fx = -Math.sin(b.yaw), fz = -Math.cos(b.yaw), x = b.pos[0] + fx * 0.75, y = b.pos[1] + 0.95, z = b.pos[2] + fz * 0.75;
      if (P) spark(P, x, y, z, 3);
      if ((this.hits++ & 1) === 0) this.sound('hammer', x, y, z, 0.55);
    }
    tickCrane(dt, front) {
      const c = this.crane, site = this.site, building = site.phase === 'earth' || site.phase === 'build';
      // up when the earthworks are done (the mast is put together in a second and a half), down when the scaffold folds
      if ((building && this.grounded) || (c.rise > 0 && ((this.doneT >= 0 && this.doneT < 2.0) || (this.cancelT >= 0 && this.cancelT < 0.8)))) c.rise = Math.min(1, c.rise + dt / 1.5);
      else { c.rise = Math.max(0, c.rise - dt / 2.4); c.load = false; c.st = 'rest'; c.slewT = c.slew; c.hookT = c.mastTop - 4; }
      const deckY = this.oy + this.deck;
      if (building && c.rise >= 1) {
        c.tm -= dt;
        switch (c.st) {
          case 'rest': if (c.tm <= 0) c.st = 'toYard'; break;
          case 'toYard': c.slewT = Math.atan2(-(c.yard[1] - c.bz), c.yard[0] - c.bx); c.rT = clamp(Math.hypot(c.yard[0] - c.bx, c.yard[1] - c.bz), 2.5, c.Lj - 1); c.hookT = c.mastTop - 4; if (arrived(c)) c.st = 'down'; break;
          case 'down': c.hookT = c.yardY + 1.9; if (Math.abs(c.hook - c.hookT) < 0.12) { c.st = 'attach'; c.tm = 0.6; } break;
          case 'attach': if (c.tm <= 0) { c.load = true; this.loadColor(c.col); c.st = 'lift'; } break;
          case 'lift': c.hookT = Math.min(c.mastTop - 3, Math.max(deckY + 6, c.yardY + 6)); if (Math.abs(c.hook - c.hookT) < 0.3 || c.hook > deckY + 5) { this.aim(c); c.st = 'toDrop'; } break;
          case 'toDrop': c.hookT = Math.min(c.mastTop - 3, Math.max(deckY + 5, c.hook)); c.slewT = Math.atan2(-(c.aimZ - c.bz), c.aimX - c.bx); c.rT = clamp(Math.hypot(c.aimX - c.bx, c.aimZ - c.bz), 2.5, c.Lj - 1); if (arrived(c)) c.st = 'lower'; break;
          case 'lower': c.hookT = deckY + 2.05; if (Math.abs(c.hook - c.hookT) < 0.15) { c.st = 'release'; c.tm = 0.5; } break;
          case 'release': if (c.tm <= 0) { c.load = false; if (site.g.particles) dust(site.g.particles, c.aimX, deckY + 0.3, c.aimZ, 2); this.sound('clang', c.aimX, deckY, c.aimZ, 0.5); c.st = 'up'; } break;
          case 'up': c.hookT = Math.min(c.mastTop - 3, deckY + 7); if (Math.abs(c.hook - c.hookT) < 0.4 || c.hook >= c.mastTop - 3.5) c.st = 'toYard'; break;
        }
      }
      // slewing (eased), the trolley, the hook; the load swings a little behind the jib's turn
      const err = wrapA(c.slewT - c.slew), want = clamp(err * 1.9, -0.62, 0.62), acc = (want - c.slewV) * Math.min(1, dt * 2.6);
      c.slewV += acc; c.slew = wrapA(c.slew + c.slewV * dt);
      // (a climbing crane: the mast grows with the building, a few blocks over its deck; at the end it is all there)
      const segs = building ? Math.min(c.n, Math.max(4, Math.ceil((this.oy + this.deck + 10 - c.by) / 2))) : c.n;
      if (segs > c.segs) c.segs = segs;
      c.mastTop = c.by + c.segs * 2;
      c.r += clamp(c.rT - c.r, -3.4 * dt, 3.4 * dt);
      const hv = Math.max(10, (c.mastTop - c.yardY) / 2);   // (a tall one hoists fast: the show is minutes of building in seconds)
      c.hook += clamp(c.hookT - c.hook, -hv * dt, hv * dt);
      const Lh = Math.max(2, c.mastTop - c.hook), push = acc / Math.max(dt, 1e-3) * c.r;
      c.swayV += (-9.8 / Lh * Math.sin(c.sway) - c.swayV * 0.9 - push / Lh * 0.5) * dt; c.sway = clamp(c.sway + c.swayV * dt, -0.3, 0.3);
      const loud = Math.abs(c.slewV) > 0.06 || Math.abs(c.r - c.rT) > 0.3;
      this.motor = loud ? 1 : 0;
    }
    // where the next load goes: a point on the deck's walk
    aim(c) { this.ringPoint(this.level(), rnd(), this.pt); c.aimX = this.ox + this.pt[0]; c.aimZ = this.oz + this.pt[1]; }
    // the colour of what is built now (most common block of the layer at the front), for the load on the hook
    loadColor(out) {
      const site = this.site, o = site.o, g = site.g, A = g.tex && g.tex.avgColor, TT = VR.R && VR.R.T;
      if (!A || !TT || !o.H) { out[0] = 0.8; out[1] = 0.78; out[2] = 0.74; return; }
      const h = clamp(Math.floor(this.deck + 2), 0, o.H - 1), a = o.nEarth + o.layerStart[h], b = o.nEarth + o.layerStart[Math.min(o.H, h + 3)];
      let best = 0, bn = 0; const cnt = this.cnt || (this.cnt = new Map()); cnt.clear();
      for (let i = 0; i < 24 && b > a; i++) { const s = site.list[a + Math.floor(rnd() * (b - a))][3]; const n = (cnt.get(s) || 0) + 1; cnt.set(s, n); if (n > bn) { bn = n; best = s; } }
      if (!best) { out[0] = 0.8; out[1] = 0.78; out[2] = 0.74; return; }
      const layer = TT.tex[best * 6 + 4] & 0xfff; out[0] = Math.min(1, A[layer * 4] * 1.15 + 0.05); out[1] = Math.min(1, A[layer * 4 + 1] * 1.15 + 0.05); out[2] = Math.min(1, A[layer * 4 + 2] * 1.15 + 0.05);
    }
    // how loud from here (0 … 1): the player's distance
    near(x, y, z) { const p = this.site.g.player && this.site.g.player.pos; if (!p) return 0; const d = Math.hypot(x - p[0], (y - p[1]) * 0.6, z - p[2]); return d > 70 ? 0 : Math.pow(1 - d / 70, 1.6); }
    sound(name, x, y, z, v, state) {
      const a = this.site.g.audio; if (!a || !a.play) return;
      const k = this.near(x, y, z) * v; if (k < 0.02) return;
      if (name === 'place') { if (a.ctx && state && a.place) a.place(state); return; }
      SND.vol = k; a.play(name, SND);
    }
    // ---- drawing (the renderer's opaque pass)
    draw(r, E, cam, ent) {
      const gl = r.gl, P = r.P, site = this.site;
      if (!P.vox) return;
      const far = 260, dx = this.cx - cam.x, dz = this.cz - cam.z;
      if (dx * dx + dz * dz > far * far) return;
      // one light for all of it, read four times a second at the top of the site
      if (this.t - this.lightT > 0.25) { this.lightT = this.t; const w = site.g.world, l = w && w.getLight ? w.getLight(Math.floor(this.cx), Math.floor(this.oy + this.deck + 2), Math.floor(this.cz)) : 0xf000; this.light[0] = Math.max(0.35, (l >>> 12) / 15); this.light[1] = ((l >> 8) & 15) / 15; this.light[2] = ((l >> 4) & 15) / 15; this.light[3] = (l & 15) / 15; }
      const G = gpu(r);
      if (this.scaffold && this.inst && P.voxInst) this.drawScaffold(r, E, cam, G);
      if (this.crane && this.crane.rise > 0.01) this.drawCrane(r, E, cam, G);
      if ((this.office && this.endT === undefined) || this.tree) this.drawExtras(r, E, cam, G);
      if (this.crew.length && ent && VR.Folk) this.drawCrew(r, E, cam, ent);
    }
    // the plain vox program for single meshes (this.one)
    voxBegin(r, E) {
      const gl = r.gl, p = r.P.vox; gl.useProgram(p.p); r.common(p, E);
      gl.uniformMatrix4fv(p.u.u_viewProj, false, r.viewProj); gl.uniform1f(p.u.u_alpha, 1);
      if (p.u.u_clipNear) gl.uniform1f(p.u.u_clipNear, 0);
      gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE);
      this.uniforms(gl, p, null);
      this.dp = p;
      return p;
    }
    // the site office by the gate; the Richtbaum on the roof (it pops up, sways in the wind, shrinks away at the end)
    drawExtras(r, E, cam, G) {
      const gl = r.gl; let on = false;
      const f = this.office;
      if (f && this.endT === undefined && VR.mat4.boxInFrustum(r.planes, f.x - 3.2 - cam.x, f.y - cam.y, f.z - 3.2 - cam.z, f.x + 3.2 - cam.x, f.y + 2.8 - cam.y, f.z + 3.2 - cam.z)) {
        this.voxBegin(r, E); on = true;
        this.one(gl, G.office, this.model(f.x, f.y, f.z, cam, f.yaw));
      }
      const T0 = this.tree;
      if (T0 && this.doneT >= 0) {
        const tt = this.doneT, u = Math.min(1, tt / 0.45), pop = 1 + 2.2 * (u - 1) * (u - 1) * (u - 1) + 1.2 * (u - 1) * (u - 1);   // (ease out with a little overshoot)
        const end = this.endT === undefined ? 1 : clamp(1 - (tt - this.endT) / 0.8, 0, 1), s = T0.s * Math.max(0, Math.min(1.15, pop)) * end;
        if (s > 0.02) {
          if (!on) this.voxBegin(r, E);
          const a = 0.07 * Math.sin(this.t * 2.3) + 0.03 * Math.sin(this.t * 5.1), ca = Math.cos(a), sa = Math.sin(a), m = this.mm;
          m.fill(0); m[0] = ca * s; m[1] = sa * s; m[4] = -sa * s; m[5] = ca * s; m[10] = s; m[15] = 1;
          m[12] = T0.x - cam.x; m[13] = T0.y - cam.y; m[14] = T0.z - cam.z;
          this.one(gl, G.tree, m);
        }
      }
      gl.bindVertexArray(null);
    }
    uniforms(gl, p, tint) {
      const L = this.light;
      gl.uniform1f(p.u.u_sky, L[0]); gl.uniform3f(p.u.u_blockLight, L[1], L[2], L[3]);
      if (p.u.u_sunShadow) gl.uniform1f(p.u.u_sunShadow, 0);
      gl.uniform1f(p.u.u_flash, 0); gl.uniform1f(p.u.u_noFog, 0); if (p.u.u_clipNear) gl.uniform1f(p.u.u_clipNear, 0);
      if (tint) gl.uniform3f(p.u.u_tint, tint[0], tint[1], tint[2]); else gl.uniform3f(p.u.u_tint, 1, 1, 1);
    }
    model(x, y, z, cam, yaw, sy) {
      const m = this.mm; m.fill(0); m[0] = m[5] = m[10] = m[15] = 1;
      if (yaw) { const c = Math.cos(yaw), s = Math.sin(yaw); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; }
      if (sy !== undefined) { m[4] *= sy; m[5] *= sy; m[6] *= sy; }
      m[12] = x - cam.x; m[13] = y - cam.y; m[14] = z - cam.z;
      return m;
    }
    ensureGL(r, G) {
      const gl = r.gl;
      if (this.gl === gl && this.vaos) return;
      this.gl = gl; const I = this.inst, V = this.vaos = {};
      const buf = (a) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, a.length ? a : new Float32Array(4), gl.STATIC_DRAW); return b; };
      this.bufs = { bays: buf(I.bays), braces: buf(I.braces), corners: buf(I.corners), fence: buf(this.fenceInst || new Float32Array(0)) };
      V.bay = instVAO(gl, G.bay, this.bufs.bays); V.screen = instVAO(gl, G.screen, this.bufs.bays); V.deck = instVAO(gl, G.deck, this.bufs.bays);
      V.fence = instVAO(gl, G.fence, this.bufs.fence); V.brace = instVAO(gl, G.brace, this.bufs.braces); V.corner = instVAO(gl, G.corner, this.bufs.corners); V.deckCorner = instVAO(gl, G.deckCorner, this.bufs.corners);
      if (this.crane) { this.bufs.mast = buf(this.crane.mast); V.mast = instVAO(gl, G.mast, this.bufs.mast); }
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }
    drawScaffold(r, E, cam, G) {
      const gl = r.gl, p = r.P.voxInst, I = this.inst;
      this.ensureGL(r, G);
      const kd = this.level(), deckOn = this.deck > -0.1;
      // the levels below the deck (a band of six on a tall one), then the deck itself at its height
      const top = deckOn ? kd : -1, low = Math.max(0, top - this.band + 1);
      if (!VR.mat4.boxInFrustum(r.planes, this.ox - 3 - cam.x, this.oy - 2 - cam.y, this.oz - 3 - cam.z, this.ox + this.sw + 3 - cam.x, this.oy + this.deck + 4 - cam.y, this.oz + this.sd + 3 - cam.z)) return;
      gl.useProgram(p.p); r.common(p, E);
      gl.uniformMatrix4fv(p.u.u_viewProj, false, r.viewProj); gl.uniform1f(p.u.u_alpha, 1);
      gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE);
      this.uniforms(gl, p, null);
      gl.uniformMatrix4fv(p.u.u_model, false, this.model(this.ox, this.oy, this.oz, cam));
      const V = this.vaos, B = this.bufs;
      if (top >= low) {
        drawInst(gl, V.bay, B.bays, G.bay, I.bayStart[low], I.bayStart[top]);
        drawInst(gl, V.brace, B.braces, G.brace, I.braceStart[low], I.braceStart[top]);
        drawInst(gl, V.corner, B.corners, G.corner, low * 4, top * 4);
        if (this.band < 1e9) drawInst(gl, V.screen, B.bays, G.screen, I.bayStart[Math.max(low, top - 3)], I.bayStart[top]);
      }
      if (this.fenceInst && this.endT === undefined) drawInst(gl, V.fence, B.fence, G.fence, 0, this.fenceInst.length / 4);
      if (deckOn) {
        gl.uniformMatrix4fv(p.u.u_model, false, this.model(this.ox, this.oy + this.deck - kd * 2, this.oz, cam));
        drawInst(gl, V.deck, B.bays, G.deck, I.bayStart[kd], I.bayStart[kd + 1]);
        drawInst(gl, V.deckCorner, B.corners, G.deckCorner, kd * 4, kd * 4 + 4);
      }
      gl.bindVertexArray(null);
    }
    drawCrane(r, E, cam, G) {
      const gl = r.gl, c = this.crane, P = r.P;
      const shown = Math.max(1, Math.round(c.segs * c.rise)), topY = c.by + shown * 2;
      if (!VR.mat4.boxInFrustum(r.planes, c.bx - c.Lj - cam.x, c.by - cam.y, c.bz - c.Lj - cam.z, c.bx + c.Lj - cam.x, topY + 6 - cam.y, c.bz + c.Lj - cam.z)) return;
      this.ensureGL(r, G);
      // the mast (instanced segments)
      if (P.voxInst) {
        const p = P.voxInst; gl.useProgram(p.p); r.common(p, E);
        gl.uniformMatrix4fv(p.u.u_viewProj, false, r.viewProj); gl.uniform1f(p.u.u_alpha, 1); this.uniforms(gl, p, null);
        gl.uniformMatrix4fv(p.u.u_model, false, this.model(this.ox, this.oy, this.oz, cam));
        drawInst(gl, this.vaos.mast, this.bufs.mast, G.mast, 0, shown);
        gl.bindVertexArray(null);
      }
      const p = this.voxBegin(r, E);
      if (!c.top || c.topKey !== c.Lj) { if (c.top && c.top.vbo) { gl.deleteBuffer(c.top.vbo); gl.deleteVertexArray(c.top.vao); } c.top = VR.VoxGPU.upload(gl, BS.MOD.top(c.Lj, c.Lc)); c.topKey = c.Lj; }
      this.one(gl, c.top, this.model(c.bx, topY, c.bz, cam, c.slew));
      // the trolley; the cables swing (a pendulum across the jib, pushed by its turns); the hook and the load hang at their end
      const cs = Math.cos(c.slew), sn = Math.sin(c.slew), tx = c.bx + cs * c.r, tz = c.bz - sn * c.r, ty = topY + 0.55;
      const hookY = Math.min(c.hook, ty - 1.2) - (c.mastTop - topY), len = Math.max(0.6, ty - hookY), ph = c.sway;
      const tX = sn, tZ = cs, sp = Math.sin(ph), cp = Math.cos(ph);   // (the jib's sideways direction)
      const hx = tx + tX * sp * len, hy = ty - cp * len, hz = tz + tZ * sp * len;
      this.one(gl, G.trolley, this.model(tx, ty, tz, cam, c.slew));
      // the cable's frame: x along the jib, y up the cable (its length), z across
      const m = this.mm; m.fill(0); m[15] = 1;
      m[0] = cs; m[2] = -sn; m[4] = -tX * sp * len; m[5] = cp * len; m[6] = -tZ * sp * len; m[8] = tX * cp; m[9] = sp; m[10] = tZ * cp;
      m[12] = tx - cam.x; m[13] = ty - cam.y; m[14] = tz - cam.z;
      this.one(gl, G.cable, m);
      this.one(gl, G.hook, this.model(hx, hy, hz, cam, c.slew));
      if (c.load) {
        this.one(gl, G.pallet, this.model(hx, hy - 1.95, hz, cam, c.slew));
        this.uniforms(gl, p, c.col); this.one(gl, G.cubes, this.model(hx, hy - 1.95, hz, cam, c.slew)); this.uniforms(gl, p, null);
      }
      // the piles at the yard (the loads come from there)
      if (c.rise > 0.5) {
        if (!c.pileCol) { c.pileCol = [0.8, 0.78, 0.74]; this.loadColor(c.pileCol); }
        for (let i = 0; i < 2; i++) {
          const px = c.yard[0] + (i ? 1.7 : -1.7) * Math.cos(c.slew0), pz = c.yard[1] + (i ? 1.7 : -1.7) * Math.sin(c.slew0), py = c.yardY + 0.12;
          this.one(gl, G.pallet, this.model(px, py, pz, cam, c.slew0)); this.uniforms(gl, p, c.pileCol); this.one(gl, G.cubes, this.model(px, py, pz, cam, c.slew0)); this.uniforms(gl, p, null);
        }
      }
      // the red light on top blinks
      if ((this.t % 1.2) < 0.55) this.one(gl, G.blink, this.model(c.bx, topY + 4.6, c.bz, cam));
      gl.bindVertexArray(null);
    }
    one(gl, mesh, M) { gl.uniformMatrix4fv(this.dp.u.u_model, false, M); gl.bindVertexArray(mesh.vao); gl.drawArrays(gl.TRIANGLES, 0, mesh.count); }
    drawCrew(r, E, cam, ent) {
      const g = this.site.g, gl = r.gl, FD = g.folkDist || g.folkBase || 100;
      let p = null;
      for (const b of this.crew) {
        if (b.mode === 'gone' || b.delay > 0) continue;
        const dx = b.pos[0] - cam.x, dy = b.pos[1] - cam.y, dz = b.pos[2] - cam.z, d2 = dx * dx + dz * dz;
        if (d2 > FD * FD) continue;
        if (!VR.mat4.boxInFrustum(r.planes, dx - 1, dy - 0.5, dz - 1, dx + 1, dy + 2.2, dz + 1)) continue;
        // (a builder's model is made the first time it is drawn: at most one new one a frame, no hitch on a small PC)
        const far = d2 > 24 * 24, mk = far ? 'lo' : 'hi';
        if (!b[mk]) { if (BS.madeThisFrame) continue; BS.madeThisFrame = true; b[mk] = true; }
        const model = VR.Folk.model(gl, b.look, far); if (!model) continue;
        if (!p) p = ent.beginVox(r, E);
        const L = this.light, lt = b.lt || (b.lt = { sky: 1, bl: [0, 0, 0] }); lt.sky = Math.max(0.45, L[0]); lt.bl[0] = L[1]; lt.bl[1] = L[2]; lt.bl[2] = L[3];
        ent.drawModel(r, p, model, b.pos, cam, b.yaw, b.poseOut, lt, b.opts);
      }
    }
    dispose() {
      const gl = this.gl; if (!gl) return;
      if (this.vaos) for (const k in this.vaos) gl.deleteVertexArray(this.vaos[k]);
      if (this.bufs) for (const k in this.bufs) gl.deleteBuffer(this.bufs[k]);
      const c = this.crane; if (c && c.top && c.top.vbo) { gl.deleteBuffer(c.top.vbo); gl.deleteVertexArray(c.top.vao); c.top = null; }
      this.vaos = null; this.bufs = null;
    }
  }
  BS.Show = Show;
  // ---------------------------------------------------------------- particles with options objects kept (no garbage per frame)
  const DUST = [{ life: 1.6, size: 0.34, grav: -0.25, col: [0.56, 0.47, 0.36], drag: 1.6, collide: false, grow: 0.55, uv: UV0 }, { life: 1.4, size: 0.3, grav: -0.2, col: [0.62, 0.55, 0.45], drag: 1.6, collide: false, grow: 0.5, uv: UV0 }, { life: 1.2, size: 0.24, grav: -0.15, col: [0.8, 0.78, 0.74], drag: 1.8, collide: false, grow: 0.42, uv: UV0 }];
  function dust(P, x, y, z, kind) { const o = DUST[kind]; for (let i = 0; i < 3; i++) P.spawn(x + (rnd() - 0.5) * 0.8, y + rnd() * 0.3, z + (rnd() - 0.5) * 0.8, (rnd() - 0.5) * 0.9, 0.3 + rnd() * 0.5, (rnd() - 0.5) * 0.9, o); }
  const SPARK = { life: 0.45, size: 0.05, grav: 7, col: [1, 0.84, 0.45], emis: 1, drag: 2, uv: UV0 };
  function spark(P, x, y, z, n) { for (let i = 0; i < n; i++) { const a = rnd() * TAU, s = 1.2 + rnd() * 2; SPARK.life = 0.25 + rnd() * 0.3; P.spawn(x, y, z, Math.cos(a) * s, 1 + rnd() * 2, Math.sin(a) * s, SPARK); } }
  const SPARKLE = { life: 1.1, size: 0.07, grav: -0.4, col: [0.7, 0.95, 1], emis: 1, drag: 1.2, collide: false, uv: UV0 };
  function sparkle(P, x, y, z) { SPARKLE.col[0] = 0.6 + rnd() * 0.4; SPARKLE.col[1] = 0.85 + rnd() * 0.15; P.spawn(x + (rnd() - 0.5) * 0.6, y, z + (rnd() - 0.5) * 0.6, (rnd() - 0.5) * 0.6, 0.6 + rnd(), (rnd() - 0.5) * 0.6, SPARKLE); }
  const CONF = { life: 4, size: 0.1, grav: 2.4, col: [1, 1, 1], emis: 0.35, drag: 1.3, uv: UV0 };
  const CONF_COL = [[1, 0.25, 0.3], [1, 0.82, 0.2], [0.25, 0.6, 1], [0.3, 0.9, 0.45], [1, 0.45, 0.85], [1, 1, 1], [1, 0.55, 0.15]];
  function confetti(P, x, y, z, n, spread) {
    for (let i = 0; i < n; i++) {
      const c = CONF_COL[i % CONF_COL.length]; CONF.col[0] = c[0]; CONF.col[1] = c[1]; CONF.col[2] = c[2];
      CONF.life = 2.8 + rnd() * 2.4; CONF.size = 0.07 + rnd() * 0.07;
      const a = rnd() * TAU, s = 1.5 + rnd() * 5;
      P.spawn(x + Math.cos(a) * spread * rnd() * 0.5, y + rnd(), z + Math.sin(a) * spread * rnd() * 0.5, Math.cos(a) * s, 5 + rnd() * 7, Math.sin(a) * s, CONF);
    }
    // three bursts of light above it
    for (let k = 0; k < 3; k++) { const bx = x + (rnd() - 0.5) * spread, by = y + 6 + rnd() * 6, bz = z + (rnd() - 0.5) * spread, c = CONF_COL[(k * 2) % CONF_COL.length]; for (let i = 0; i < 26; i++) { const a = rnd() * TAU, b = rnd() * PI - PI / 2, s = 3 + rnd() * 3; SPARK.life = 0.7 + rnd() * 0.6; SPARK.col[0] = c[0]; SPARK.col[1] = c[1]; SPARK.col[2] = c[2]; P.spawn(bx, by, bz, Math.cos(a) * Math.cos(b) * s, Math.sin(b) * s + 1, Math.sin(a) * Math.cos(b) * s, SPARK); } }
    SPARK.col[0] = 1; SPARK.col[1] = 0.84; SPARK.col[2] = 0.45;
  }
  // ---------------------------------------------------------------- every site of a world, drawn in the opaque pass
  BS.draw = function (B, r, E, cam) {
    const ent = B.g.entities; BS.madeThisFrame = false;
    for (const s of B.sites) if (s.show && s.phase !== 'gone') s.show.draw(r, E, cam, ent);
    // the crane's motor: the loudest one
    const a = B.g.audio; if (a && a.loop) { let m = 0; for (const s of B.sites) if (s.show && s.show.crane && s.show.motor) m = Math.max(m, s.show.near(s.show.crane.bx, s.show.crane.mastTop, s.show.crane.bz)); if (m > 0.02 || B.motorOn) { a.loop('crane', m * 0.32, 0.6); B.motorOn = m > 0.02; } }
  };
  // ---------------------------------------------------------------- the HUD: 🏗 name · 42 % ▰▰▱ ⏩ Fertig (top centre)
  BS.hudOff = function () { const el = BS.hudEl; if (el && el.style.display !== 'none') el.style.display = 'none'; };
  // the world goes (to the title, another world): the bar goes, the sites' GPU things are freed
  BS.reset = function (B) { BS.hudOff(); const L = B && B.sites; if (L) { for (const s of L) if (s.show) s.show.dispose(); L.length = 0; } };
  BS.hud = function (B) {
    if (typeof document === 'undefined') return;
    const g = B.g, S = B.slices, on = S instanceof Site && S.show && (S.phase === 'earth' || S.phase === 'build') && g.state === 'play' && !g.hideHud && !g.photo && (!g.ui || !g.ui.screen || g.ui.screen === 'pause');
    let el = BS.hudEl;
    if (!on) { if (el && el.style.display !== 'none') el.style.display = 'none'; return; }
    if (!el || !el.isConnected) {
      el = BS.hudEl = document.createElement('div'); el.id = 'bauhud';
      el.innerHTML = '<div class="bh-row"><span class="bh-t"></span><button class="bh-skip" type="button"></button></div><div class="bh-bar"><i></i></div>';
      const root = document.getElementById('ui') || document.body; root.appendChild(el);
      el.querySelector('.bh-skip').addEventListener('click', (e) => { e.stopPropagation(); const blue = VR.game && VR.game.gadgets && VR.game.gadgets.blue; if (blue && blue.siteSkip) blue.siteSkip(); });
      BS.hudS = null;
    }
    const pc = Math.floor(S.progress * 100), lang = VR.I18N ? VR.I18N.lang : '';
    if (pc !== BS.hudP || S !== BS.hudS || lang !== BS.hudL) {
      BS.hudP = pc; BS.hudS = S; BS.hudL = lang;
      el.querySelector('.bh-t').textContent = T('g.bau.progress', { name: S.name, p: pc }, '🏗 {name} · {p} % gebaut', '🏗 {name} · {p} % built');
      const b = el.querySelector('.bh-skip'); b.textContent = T('g.bau.skip', null, '⏩ Fertig', '⏩ Finish'); b.title = T('g.bau.skipTip', null, 'Sofort fertig bauen (auch: Klick auf die Baustelle oder /bau fertig)', 'Finish at once (also: click the site or /bau fertig)');
      el.querySelector('.bh-bar i').style.width = pc + '%';
    }
    if (el.style.display !== 'block') el.style.display = 'block';
  };
})(VR);
