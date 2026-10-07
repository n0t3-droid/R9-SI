// ============================================================================
// 📽 Zeitraffer (VR.Zeit) — a time-lapse of how your world was built. The recorder (zeit_rec.js) keeps every
// building change of the player's own world; here the busiest place nearby is played back: the land as it was, then
// block after block at ×10 … ×1000 with a scrubber and ⏯, the director's camera circling the build and framing each
// burst, the sky frozen in the golden hour (or as it was). ⏺ Video records it with a title and an end card (WebM) and
// offers it for saving. Esc returns to the game exactly as it was.
//
// How (docs/superpowers/plans/2026-10-08-zeitraffer.md): the columns of the place get replay copies (blocks copied,
// tints shared, fresh sections) in which the recorded changes are undone newest → oldest, lit in the workers, and then
// swapped into world.cols for the time of the replay — the rest of the world, the sky and the renderer are the game's
// own. The originals wait aside untouched (their meshes too: the way back is instant); the world is saved before the
// swap; a copy (c.zr) is never saved; the game's own frame (player, sim, villagers, gadgets, autosave) does not run
// meanwhile — only streaming/meshing, the replay and the picture. Changed copies are relit at most every 150 ms and
// only sections whose blocks or light changed are meshed again.
// ============================================================================
(function (VR) {
  'use strict';
  const ZR = VR.ZeitRec; if (!ZR) return;
  const tx = (k, v, de, en) => (VR.I18N && VR.I18N.tx ? VR.I18N.tx(k, v, de, en) : (en !== undefined ? en : de));
  const ck = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const GOLD = 11200;                                    // the golden hour (ticks: 0 sunrise, 6000 noon, 12000 sunset)
  const MAX_COLS = 64, RADIUS = 4, LIMIT = 1500000, RELIGHT_MS = 150, INTRO_S = 1.8;
  const Z = VR.Zeit = { active: false, busy: false, S: null, pending: null, lastVideo: null, ui: null, cfg: { titleS: 2, endS: 2.5, maxBodyS: 45 } };
  const loc = () => (VR.I18N && VR.I18N.locale ? VR.I18N.locale() : undefined);
  const num = (n) => Math.round(n).toLocaleString(loc());

  // ---------------------------------------------------------------- the recorder on the player's own worlds
  Z.attach = function (g) {
    if (!g || !g.world || !g.meta || g.meta.guest || !g.meta.id) return;
    if (g.zeitRec) g.zeitRec.close();
    const rec = g.zeitRec = ZR.forWorld(g.meta.id);
    rec.ticks = () => (g.env ? g.env.ticks : 0);
    g.world.zr = rec;
  };
  Z.detach = function (g) {
    if (Z.active || (Z.ui && Z.ui.on)) Z.close(true);
    if (g && g.zeitRec) { g.zeitRec.close(); g.zeitRec = null; }
  };
  // why the time-lapse cannot run now (null: it can)
  Z.blocked = function (g) {
    if (!g || !g.meta || g.meta.guest || !g.zeitRec) return tx('g.zr.guest', null, 'Den Zeitraffer gibt es in deinen eigenen Welten.', 'The time-lapse is there in your own worlds.');
    if (g.mp && g.mp.isHost && g.mp.remote && g.mp.remote.size > 0) return tx('g.zr.mp', null, 'Mit Freunden in der Welt wartet der Zeitraffer, bis du allein bist.', 'With friends in the world the time-lapse waits until you are alone.');
    if (g.gadgets && g.gadgets.controlling) return tx('g.zr.ride', null, 'Steig erst aus — dann läuft der Zeitraffer.', 'Get out first — then the time-lapse runs.');
    return null;
  };

  // ---------------------------------------------------------------- open: the busiest place, its copies, the swap
  Z.open = async function (from) {
    const g = VR.game;
    if (!g || Z.active || Z.busy || g.state !== 'play' || !g.world) return false;
    const why = Z.blocked(g);
    if (why) { if (g.ui && g.ui.hint) g.ui.hint(why, 3200); return false; }
    if (g.director && g.director.active) g.director.stop();
    Z.busy = true; Z.pending = null;
    const tok = Z.tok = {};
    Z.from = from || null; Z.meinsFrom = VR.Start ? VR.Start.meinsFrom : null;
    Z.mount().show('loading');
    g.ui.show('zeitraffer');
    hud(false);
    try { return (await prepare(g, tok)) === 'ok'; }
    catch (e) { console.error('Zeitraffer', e); if (Z.tok === tok) Z.close(); return false; }
    finally { Z.busy = false; }
  };
  async function prepare(g, tok) {
    const w = g.world, p = g.player, rec = g.zeitRec;
    // the world is saved first: nothing of it waits only in memory while its columns are swapped
    try { await Promise.all([g.saveMeta(), w.saveAll()]); } catch (e) { /* the replay never writes the world anyway */ }
    const gone = () => Z.tok !== tok || g.world !== w || g.state !== 'play';
    if (gone()) return 'gone';
    const segs = await rec.snapshot();
    if (gone()) return 'gone';
    const sc = ZR.scan(segs, w.dim);
    if (!sc.n) { Z.ui.show('empty'); return 'empty'; }
    const pcx = Math.floor(p.pos[0]) >> 4, pcz = Math.floor(p.pos[2]) >> 4, rd = Math.max(2, w.renderDist - 1);
    const loaded = (cx, cz) => {
      if ((cx - pcx) * (cx - pcx) + (cz - pcz) * (cz - pcz) > rd * rd) return false;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (!w.col(cx + dx, cz + dz)) return false;
      return true;
    };
    const area = ZR.pickArea(sc.cols, { loaded, maxCols: MAX_COLS, radius: RADIUS, near: [pcx, pcz] });
    if (!area) {
      // built only far from here: where, and a way there
      const far = ZR.pickArea(sc.cols, { maxCols: 9, radius: 1, near: [pcx, pcz] });
      const Cf = ZR.collect(segs, w.dim, (cx, cz) => far.keys.has(ck(cx, cz)), 200000);
      const bb = bounds(Cf);
      Z.far = { x: bb.c[0], y: bb.y1 + 14, z: bb.c[2], d: Math.hypot(bb.c[0] - p.pos[0], bb.c[2] - p.pos[2]) };
      Z.ui.show('far');
      return 'far';
    }
    const C = ZR.collect(segs, w.dim, (cx, cz) => area.keys.has(ck(cx, cz)), LIMIT);
    if (!C.n) { Z.ui.show('empty'); return 'empty'; }
    // the copies, every recorded change undone newest → oldest: the land as it was
    const cols = new Map();
    for (const k of area.keys) { const c = w.cols.get(k); if (c && c.ready) cols.set(k, { key: k, orig: c, rc: copyCol(c), touched: false, inflight: false, ds: null, de: null }); }
    const undo = setter(cols);
    ZR.move(C, C.n, 0, undo);
    for (const e of cols.values()) { recount(w, e.rc); e.ds = new Uint8Array(e.rc.sec.length); e.de = new Uint8Array(e.rc.sec.length); }
    await Promise.all([...cols.values()].map((e) => lightOnce(w, e.rc)));
    if (gone()) return 'gone';
    // the neighbours whose light the seams touch (restored on the way back), then the swap
    const ring = [], seen = new Set(cols.keys());
    for (const e of cols.values()) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const k = ck(e.rc.cx + dx, e.rc.cz + dz); if (seen.has(k)) continue; seen.add(k);
      const c = w.cols.get(k); if (!c || !c.ready) continue;
      ring.push({ c, ref: c.light, copy: c.light.slice(), vers: c.sec.map((s) => s.ver) });
    }
    for (const e of cols.values()) { w.cols.set(e.key, e.rc); w.shDirty.add(e.key); }
    w.lastCol = null;
    for (const e of cols.values()) w.seamLight(e.rc);
    w.flushChanged();
    for (const e of cols.values()) for (const s of e.rc.sec) { s.dirty = true; s.ver++; }
    // a neighbour's mesh shows 2 cells of the copy: where those differ from the original, it is meshed again
    for (const e of cols.values()) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const n = w.cols.get(ck(e.rc.cx + dx, e.rc.cz + dz)); if (!n || n.zr) continue;
      for (let sy = 0; sy < n.sec.length; sy++) if (stripDiff(e.rc, e.orig, dx, dz, sy)) { n.sec[sy].dirty = true; n.sec[sy].ver++; }
    }
    w.visDirty = true; if (g.renderer) g.renderer.visDirty = true;
    // the timeline, the camera, the sky
    const T = ZR.timeline(C), bb = bounds(C);
    const S = Z.S = {
      g, w, C, T, cols, ring, tok, cursor: 0, clock: 0, speed: ZR.speedFor(T.total), playing: false, phase: 'intro', introT: 0,
      gold: true, center: bb.c, radius: bb.r, burst: { c: bb.c.slice(), r: bb.r, t: -1e9 }, relightAt: 0, fps: 0, lastNow: 0, sparkAt: 0, soundAt: 0, uiAt: 0,
      styleEpoch: w.styleEpoch || 0, world: g.meta.name || '', span: spanText(C),
      saved: { ticks: g.env.ticks, freeze: g.zenFreezeTime, freezeW: g.zenFreezeWeather, forced: g.env.wx ? g.env.wx.forced : null, hideHud: g.hideHud, camMode: g.camMode },
    };
    S.set = setter(cols);
    g.env.setTime(GOLD); if (g.env.wx) g.env.wx.force('klar');
    g.camMode = 0; g.zoom = false;
    if (g.director) { g.director.orbitReset(); }
    Z.active = true;
    Z.ui.show('play');
    return 'ok';
  }
  // a replay copy of a column: its blocks, fresh sections; tints, biomes shared (nobody writes them)
  function copyCol(c) {
    const Sec = c.sec[0].constructor, rc = new VR.Column(c.cx, c.cz);
    rc.blocks = c.blocks.slice(); rc.light = c.light.slice();
    rc.biome = c.biome; rc.caveBiome = c.caveBiome; rc.grass = c.grass; rc.foliage = c.foliage; rc.water = c.water;
    rc.H = c.H; rc.sv = c.sv; rc.saved = c.saved; rc.lastSeen = c.lastSeen;
    rc.height = c.height.slice(); rc.sh = c.sh.slice();
    while (rc.sec.length < c.sec.length) rc.sec.push(new Sec());
    rc.ready = true; rc.modified = false; rc.zr = true;
    return rc;
  }
  // block counts per section, the height map and the sun-blocking layer (shadows) of a column
  function recount(w, c) {
    const B = c.blocks;
    for (let sy = 0; sy < c.sec.length; sy++) { let n = 0; const o = sy << 12; for (let i = 0; i < 4096; i++) if (B[o + i]) n++; c.sec[sy].count = n; }
    heights(w, c);
  }
  function heights(w, c) {
    const B = c.blocks, T = VR.R.T, M = VR.F.SOLID | VR.F.FLUID | VR.F.LEAVES;
    for (let col = 0; col < 256; col++) { let y = c.H - 1; while (y > 0) { const s = B[(y << 8) | col]; if (s && (T.flags[s] & M)) break; y--; } c.height[col] = y; w.shadowCol(c, col); }
    w.shDirty.add(c.key);
  }
  // a column's light from a worker (resolves when it is there, or after 8 s with the old light)
  function lightOnce(w, rc) {
    return new Promise((res) => {
      const copy = rc.blocks.slice(); let done = false;
      const fin = () => { if (!done) { done = true; res(); } };
      w.pool.submit({ type: 'lightonly', dim: w.dim, blocks: copy }, [copy.buffer], (m) => { if (m && m.type === 'lightonly' && m.light && m.light.length === rc.blocks.length) rc.light = m.light; fin(); }, -1e8);
      w.pool.pump();
      setTimeout(fin, 8000);
    });
  }
  // do two columns differ in the 2 cells next to the neighbour at (dx, dz), in the rows a section sy of it shows?
  function stripDiff(a, b, dx, dz, sy) {
    const x0 = dx < 0 ? 0 : dx > 0 ? 14 : 0, x1 = dx < 0 ? 1 : 15, z0 = dz < 0 ? 0 : dz > 0 ? 14 : 0, z1 = dz < 0 ? 1 : 15;
    const y0 = Math.max(0, sy * 16 - 2), y1 = Math.min(Math.min(a.H, b.H), sy * 16 + 18) - 1;
    const A = a.blocks, B = b.blocks, AL = a.light, BL = b.light;
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) { const o = (y << 8) | (z << 4); for (let x = x0; x <= x1; x++) if (A[o + x] !== B[o + x] || AL[o + x] !== BL[o + x]) return true; }
    return false;
  }
  // the cell writer of the replay: the copies only, with what each change touched (sections, borders) for the relight
  function setter(cols) {
    let lcx = 1e9, lcz = 1e9, le = null;
    return (x, y, z, s) => {
      const cx = x >> 4, cz = z >> 4;
      if (cx !== lcx || cz !== lcz) { lcx = cx; lcz = cz; le = cols.get(ck(cx, cz)) || null; }
      const e = le; if (!e) return;
      const c = e.rc; if (y < 0 || y >= c.H) return;
      const i = (y << 8) | ((z & 15) << 4) | (x & 15), old = c.blocks[i];
      if (old === s) return;
      c.blocks[i] = s;
      const sy = y >> 4, sec = c.sec[sy];
      if (!old && s) sec.count++; else if (old && !s) sec.count--;
      if (e.ds) {
        const lx = x & 15, lz = z & 15, ly = y & 15;
        e.ds[sy] = 1;
        e.de[sy] |= (lx < 2 ? 1 : lx > 13 ? 2 : 0) | (lz < 2 ? 4 : lz > 13 ? 8 : 0) | (ly < 2 ? 16 : ly > 13 ? 32 : 0);
        e.touched = true;
      }
    };
  }
  // the box of the changes: centre, radius, top
  function bounds(C) {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
    const step = Math.max(1, Math.floor(C.n / 200000));
    for (let i = 0; i < C.n; i += step) { const x = C.x[i], y = C.y[i], z = C.z[i]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z; }
    if (x0 > x1) { x0 = x1 = y0 = y1 = z0 = z1 = 0; }
    return { c: [(x0 + x1 + 1) / 2, (y0 + y1 + 1) / 2, (z0 + z1 + 1) / 2], r: 0.5 * Math.hypot(x1 - x0 + 1, (y1 - y0 + 1) * 0.8, z1 - z0 + 1), y1 };
  }
  function spanText(C) {
    if (!C.nb) return '';
    const d = Math.max(1, Math.round((C.bt[C.nb - 1] - C.bt[0]) / 86400000) + 1);
    return d <= 1 ? tx('g.zr.oneDay', null, 'an einem Tag', 'in one day') : tx('g.zr.days', { d }, 'in {d} Tagen', 'in {d} days');
  }

  // ---------------------------------------------------------------- playing
  Z.toggle = function () {
    const S = Z.S; if (!S) return;
    if (S.phase === 'intro') { S.phase = 'play'; S.playing = true; return; }
    if (!S.playing && S.clock >= S.T.total) { Z.seek(0); }
    S.playing = !S.playing; S.phase = 'play';
    Z.ui.update(true);
  };
  Z.seek = function (t) {
    const S = Z.S; if (!S || (S.rec && S.rec.phase !== 'end')) return;
    S.clock = Math.max(0, Math.min(S.T.total, t));
    if (S.phase === 'intro') S.phase = 'play';
    moveTo(S, S.T.index(S.clock));
    Z.ui.update(true);
  };
  Z.setSpeed = function (v) { const S = Z.S; if (!S) return; S.speed = ZR.SPEEDS.includes(+v) ? +v : S.speed; Z.ui.update(true); };
  Z.speedStep = function (d) { const S = Z.S; if (!S) return; const L = ZR.SPEEDS, i = L.indexOf(S.speed); Z.setSpeed(L[Math.max(0, Math.min(L.length - 1, (i < 0 ? 2 : i) + d))]); };
  Z.sky = function () { const S = Z.S; if (!S) return; S.gold = !S.gold; if (S.gold) S.g.env.setTime(GOLD); Z.ui.update(true); };
  // the replay from change `S.cursor` to `want` (forward: new states, back: old ones); where it happens is the burst
  function moveTo(S, want) {
    const C = S.C, from = S.cursor; if (want === from) return 0;
    const set = S.set, k = Math.abs(want - from);
    if (want > from) for (let i = from; i < want; i++) set(C.x[i], C.y[i], C.z[i], C.s[i]);
    else for (let i = from - 1; i >= want; i--) set(C.x[i], C.y[i], C.z[i], C.o[i]);
    S.cursor = want;
    const a = Math.min(from, want), b = Math.max(from, want), step = Math.max(1, Math.floor(k / 64));
    let sx = 0, sy = 0, sz = 0, n = 0, x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let i = a; i < b; i += step) { const x = C.x[i], y = C.y[i], z = C.z[i]; sx += x; sy += y; sz += z; n++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z; }
    if (n) {
      const B = S.burst, c = [sx / n + 0.5, sy / n + 0.5, sz / n + 0.5], r = 0.5 * Math.hypot(x1 - x0 + 1, y1 - y0 + 1, z1 - z0 + 1);
      const fresh = performance.now() - B.t > 1500, q = fresh ? 1 : 0.2;
      for (let j = 0; j < 3; j++) B.c[j] += (c[j] - B.c[j]) * q;
      B.r = fresh ? r : Math.max(r, B.r * 0.97); B.t = performance.now();
      if (want > from) S.lastNew = [C.x[b - 1], C.y[b - 1], C.z[b - 1], C.s[b - 1]];
    }
    return k;
  }
  // changed copies: relit in a worker at most every RELIGHT_MS; then the sections whose blocks or light changed (and
  // the neighbours' that show them) are meshed again — once, with the new light
  function relight(S, force) {
    const w = S.w, now = performance.now();
    if (!force && now - S.relightAt < RELIGHT_MS) return;
    S.relightAt = now;
    let n = 0;
    for (const e of S.cols.values()) {
      if (!e.touched || e.inflight) continue;
      e.touched = false; e.inflight = true; n++;
      const rc = e.rc, ds = e.ds, de = e.de, copy = rc.blocks.slice(), tok = S.tok;
      e.ds = new Uint8Array(rc.sec.length); e.de = new Uint8Array(rc.sec.length);
      w.pool.submit({ type: 'lightonly', dim: w.dim, blocks: copy }, [copy.buffer], (m) => {
        e.inflight = false;
        if (Z.S !== S || S.tok !== tok || w.cols.get(e.key) !== rc) return;
        if (!m || m.type !== 'lightonly' || !m.light || m.light.length !== rc.blocks.length) { for (let i = 0; i < ds.length; i++) { e.ds[i] |= ds[i]; e.de[i] |= de[i]; } e.touched = true; return; }
        const L0 = rc.light; rc.light = m.light;
        w.seamLight(rc); w.flushChanged();
        heights(w, rc);
        const mark = (c, sy) => { if (c && sy >= 0 && sy < c.sec.length) { const s = c.sec[sy]; s.dirty = true; s.ver++; } };
        const nb = (dx, dz) => w.cols.get(ck(rc.cx + dx, rc.cz + dz));
        for (let sy = 0; sy < rc.sec.length; sy++) {
          let lit = false;
          if (!ds[sy]) { const o = sy << 12, A = m.light; for (let i = 0; i < 4096; i++) if (A[o + i] !== L0[o + i]) { lit = true; break; } }
          if (!ds[sy] && !lit) continue;
          mark(rc, sy);
          const b = lit ? 63 : de[sy];
          if (b & 16) mark(rc, sy - 1); if (b & 32) mark(rc, sy + 1);
          const W = b & 1, E = b & 2, N = b & 4, So = b & 8;
          if (W) mark(nb(-1, 0), sy); if (E) mark(nb(1, 0), sy); if (N) mark(nb(0, -1), sy); if (So) mark(nb(0, 1), sy);
          if (W && N) mark(nb(-1, -1), sy); if (E && N) mark(nb(1, -1), sy); if (W && So) mark(nb(-1, 1), sy); if (E && So) mark(nb(1, 1), sy);
        }
        w.visDirty = true;
      }, -1e8);
    }
    if (n) w.pool.pump();
  }
  function meshed(S) { for (const e of S.cols.values()) for (const s of e.rc.sec) if (s.dirty || s.pending) return false; return true; }
  // the replay's own frame (instead of the game's while it runs)
  Z.frame = function (g, dt) {
    const S = Z.S, w = g.world;
    if (!S || w !== S.w || g.state !== 'play') { Z.close(true); return; }
    const now = performance.now();
    if (S.lastNow) { const d = now - S.lastNow; if (d > 0) S.fps = S.fps ? S.fps * 0.9 + (1000 / d) * 0.1 : 1000 / d; }
    S.lastNow = now;
    g.time += dt;
    const I = g.input;
    if (I.hit('Space')) Z.toggle();
    if (I.hit('ArrowRight')) Z.seek(S.clock + S.T.total * 0.05);
    if (I.hit('ArrowLeft')) Z.seek(S.clock - S.T.total * 0.05);
    if (I.hit('Equal') || I.hit('NumpadAdd') || I.hit('BracketRight')) Z.speedStep(1);
    if (I.hit('Minus') || I.hit('NumpadSubtract') || I.hit('Slash')) Z.speedStep(-1);
    if (I.hit('Home')) Z.seek(0);
    if (I.hit('End')) Z.seek(S.T.total);
    // the video's phases (title · body · end card) on the wall clock
    const RC = S.rec;
    if (RC) {
      RC.t = (now - RC.t0) / 1000;
      if (RC.phase === 'title' && RC.t >= Z.cfg.titleS) { RC.phase = 'body'; S.playing = true; S.phase = 'play'; }
      else if (RC.phase === 'body' && S.cursor >= S.C.n && S.clock >= S.T.total) { RC.phase = 'end'; RC.tEnd = RC.t; }
      else if (RC.phase === 'end' && RC.t - RC.tEnd >= Z.cfg.endS) recFinish(S, false);
    }
    // the clock
    // (the intro waits under the title until the land as it was is meshed — at most 6 s on a slow machine)
    if (S.phase === 'intro') { S.introT += dt; if (S.introT >= INTRO_S && !RC && (S.introT > 6 || meshed(S))) { S.phase = 'play'; S.playing = true; } }
    else if (S.playing) {
      S.clock = Math.min(S.T.total, S.clock + dt * 1000 * S.speed);
      const k = moveTo(S, S.T.index(S.clock));
      if (k && S.lastNew && S.lastNew[3]) {
        const q = S.lastNew;
        if (g.particles && now - S.sparkAt > 90) { S.sparkAt = now; g.particles.spark(q[0] + 0.5, q[1] + 0.6, q[2] + 0.5, [1, 0.82, 0.45], 4, 1.6, 0.25); }
        if (g.audio && now - S.soundAt > 140 && S.speed <= 300) { S.soundAt = now; try { g.audio.place(q[3]); } catch (e) { /* no sound */ } }
      }
      if (S.clock >= S.T.total) { S.playing = false; S.done = true; }
    }
    relight(S, false);
    // the camera: the director's orbit around the build, drawn to where it changes now
    const B = S.burst, live = now - B.t < 1600 && S.phase === 'play' && S.playing;
    const focus = live ? [S.center[0] + (B.c[0] - S.center[0]) * 0.8, S.center[1] + (B.c[1] - S.center[1]) * 0.8, S.center[2] + (B.c[2] - S.center[2]) * 0.8] : S.center;
    const end = !S.playing && S.clock >= S.T.total;
    const o = { center: S.center, radius: S.radius, focus, extent: live ? Math.max(6, B.r) : S.radius, end, ground: (x, z) => w.topAt(Math.floor(x), Math.floor(z)), fov: 62 };
    const cam = g.director && g.director.orbit ? g.director.orbit(dt, o) : { x: S.center[0] + 30, y: S.center[1] + 20, z: S.center[2] + 30, yaw: 0.8, pitch: -0.4, fov: 1.1 };
    cam.far = g.farFor(w, 220);
    g.cam = cam;
    // streaming and meshing around the player (who stays where he is)
    const p = g.player;
    w.update(p.pos[0], p.pos[1], p.pos[2], now);
    // the sky: the golden hour, or the time of day each change was made
    if (!S.gold && S.C.nb) {
      const C = S.C, b = S.T.batchOf(Math.max(0, S.cursor - 1)), t0 = C.btk[b] * 10;
      let t = t0;
      if (b + 1 < C.nb && S.T.E[b + 1] > S.T.E[b]) { const u = Math.max(0, Math.min(1, (S.clock - S.T.E[b]) / (S.T.E[b + 1] - S.T.E[b]))); const d = (C.btk[b + 1] * 10 - t0 + 24000) % 24000; t = t0 + d * u; }
      g.env.ticks = t;
    }
    const E = g.envFor([cam.x, cam.y, cam.z], dt, { freezeTime: true, freezeWeather: false });
    if (g.particles) g.particles.update(dt, [cam.x, cam.y, cam.z]);
    if (g.traffic) g.traffic.update(dt);
    if (g.trails) g.trails.update(dt);
    if (g.horizon) g.horizon.update(cam);
    const tr = g.traffic, ss = g.starships;
    g.renderer.render({
      cam, world: w, env: E, horizon: g.horizon, particles: g.particles,
      drawOpaque: (r, E2) => { if (ss) ss.draw(r, E2, 'opaque'); if (tr) tr.draw(r, E2, 'opaque'); },
      drawTranslucent: (r, E2) => { if (ss) ss.draw(r, E2, 'trans'); if (tr) tr.draw(r, E2, 'trans'); if (g.trails) g.trails.draw(r, E2); },
    });
    if (S.rec) compose(S, g);
    if (now - S.uiAt > 120) { S.uiAt = now; Z.ui.update(false); }
  };

  // ---------------------------------------------------------------- the way back
  Z.close = function (abort) {
    const g = VR.game, S = Z.S;
    Z.tok = null;
    if (S) {
      if (S.rec) recFinish(S, true);
      Z.active = false; Z.S = null;
      const w = S.w, rr = g && g.renderer;
      for (const e of S.cols.values()) {
        for (const s of e.rc.sec) if (rr && (s.hasMesh || s.vxData || s.mesh.some(Boolean))) rr.freeSection(s);
        if (w.cols.get(e.key) === e.rc || !w.cols.has(e.key)) w.cols.set(e.key, e.orig);
        for (const s of e.orig.sec) if (s.meshVer !== s.ver && !s.pending) s.dirty = true;
        w.shDirty.add(e.key);
      }
      for (const r of S.ring) {
        const c = r.c; if (w.cols.get(c.key) !== c) continue;
        if (c.light === r.ref && c.light.length === r.copy.length) c.light.set(r.copy);
        r.vers.forEach((v, i) => { const s = c.sec[i]; if (s && s.ver !== v) { s.dirty = true; s.ver++; } });
      }
      w.lastCol = null; w.visDirty = true; if (rr) rr.visDirty = true;
      if ((w.styleEpoch || 0) !== S.styleEpoch && !w.dead) w.restyle();
      const sv = S.saved;
      g.env.ticks = sv.ticks; g.zenFreezeTime = sv.freeze; g.zenFreezeWeather = sv.freezeW; if (g.env.wx) g.env.wx.forced = sv.forced;
      g.hideHud = sv.hideHud; g.camMode = sv.camMode;
      if (g.director && g.director.orbitReset) g.director.orbitReset();
      g.last = performance.now();
    }
    Z.active = false;
    if (Z.ui) Z.ui.hide();
    if (!g) return;
    hud(true);
    if (abort || g.state !== 'play') return;
    if (Z.from === 'pause') g.ui.pause();
    else if (Z.from === 'meins' && VR.Start && VR.Start.meins) VR.Start.meins(Z.meinsFrom || 'pause');
    else g.ui.resume();
  };
  // the HUD and the villagers' name tags step aside while the replay runs
  function hud(on) {
    const g = VR.game, h = document.getElementById('hud'), f = document.getElementById('folk'), l = document.getElementById('lockhint');
    if (h) h.style.visibility = on && !(g && g.hideHud) ? 'visible' : 'hidden';
    if (f) f.style.visibility = on ? '' : 'hidden';
    if (l && !on) l.style.display = 'none';
  }
  // built only far away: fly there (your own choice), then it opens by itself once the land is loaded
  Z.goFar = function () {
    const g = VR.game, f = Z.far; if (!g || !f || !g.player) return;
    const from = Z.from;
    Z.close(true);
    g.player.flying = true;
    g.player.safeTeleport(f.x, Math.min(VR.MAXY - 4, f.y), f.z + 12, { fly: true });
    g.ui.resume();
    Z.pending = { t: 0, from, id: g.meta && g.meta.id };
  };
  // 🎒 Meins → 📽 on a world that is not open: it opens, and the time-lapse starts once the land is there
  Z.openWorld = function (w) {
    const g = VR.game; if (!g || !w) return;
    if (g.state === 'play' && g.meta && g.meta.id === w.id) { Z.open('meins'); return; }
    if (g.state !== 'title') return;
    Z.pending = { t: 0, from: null, id: w.id };
    g.loadWorld(w);
  };
  Z.poll = function (g, dt) {
    const P = Z.pending; if (!P) return;
    if (P.id && g.meta && g.meta.id !== P.id) { Z.pending = null; return; }
    P.t += dt;
    const busy = (g.world ? g.world.pending.size : 0) + (g.pool ? g.pool.busy : 0);
    if ((P.t > 2.5 && busy < 4) || P.t > 12) { Z.pending = null; Z.open(P.from); }
  };

  // ---------------------------------------------------------------- ⏺ Video
  Z.canRecord = () => typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream;
  Z.record = function () {
    const S = Z.S, g = VR.game; if (!S || !g) return false;
    if (S.rec) { if (S.rec.phase !== 'end') { S.rec.phase = 'end'; S.rec.tEnd = S.rec.t; S.rec.short = true; Z.seek(S.T.total); } return true; }   // ⏹: finish now
    if (!Z.canRecord()) { Z.ui.note(tx('g.zr.recNo', null, 'Dieser Browser kann keine Videos aufnehmen.', 'This browser cannot record videos.')); return false; }
    const src = g.canvas, hd = S.fps >= 30 && src.width >= 1280 && src.height >= 720;
    const W = hd ? 1280 : 854, H = hd ? 720 : 480;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    let stream, mr;
    const prefer = hd && S.fps >= 40 ? ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'] : ['video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm'];
    const mime = prefer.find((t) => { try { return MediaRecorder.isTypeSupported(t); } catch (e) { return false; } }) || '';
    try {
      stream = cv.captureStream(30);
      mr = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: hd ? 6000000 : 2800000 } : undefined);
    } catch (e) { console.warn('Zeitraffer video', e); Z.ui.note(tx('g.zr.recNo', null, 'Dieser Browser kann keine Videos aufnehmen.', 'This browser cannot record videos.')); return false; }
    const chunks = [];
    S.clock = 0; moveTo(S, 0); S.phase = 'play'; S.playing = false;
    const RC = S.rec = { cv, ctx, mr, W, H, hd, mime, chunks, phase: 'title', t: 0, t0: performance.now(), tEnd: 0, stream, cancelled: false };
    mr.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    mr.onstop = () => {
      try { for (const tk of stream.getTracks()) tk.stop(); } catch (e) { /* */ }
      if (RC.cancelled) return;
      const blob = new Blob(chunks, { type: 'video/webm' });
      Z.lastVideo = blob; Z.lastVideoInfo = { w: W, h: H, mime: mr.mimeType || mime, s: Math.round(RC.t), size: blob.size };
      if (Z.S === S || !Z.S) Z.ui.video(blob, RC);
    };
    // from the beginning (above): the land as it was under the title card, then the build, then the end card
    S.speed = Math.max(S.speed, ZR.speedFor(S.T.total, Z.cfg.maxBodyS * 1000));
    if (g.director) g.director.orbitReset();
    try { mr.start(1000); } catch (e) { S.rec = null; Z.ui.note(tx('g.zr.recNo', null, 'Dieser Browser kann keine Videos aufnehmen.', 'This browser cannot record videos.')); return false; }
    Z.ui.update(true);
    return true;
  };
  function recFinish(S, cancel) {
    const RC = S.rec; if (!RC) return;
    S.rec = null; RC.cancelled = !!cancel;
    try { if (RC.mr.state !== 'inactive') RC.mr.stop(); } catch (e) { /* */ }
    if (Z.ui) Z.ui.update(true);
  }
  // one frame of the video: the view cut to 16:9, the cards over it
  function compose(S, g) {
    const RC = S.rec, ctx = RC.ctx, W = RC.W, H = RC.H, src = g.canvas, sw = src.width, sh = src.height;
    if (!sw || !sh) return;
    let cw = sw, chh = Math.round(sw * H / W); if (chh > sh) { chh = sh; cw = Math.round(sh * W / H); }
    try { ctx.drawImage(src, (sw - cw) >> 1, (sh - chh) >> 1, cw, chh, 0, 0, W, H); } catch (e) { return; }
    const t = RC.t, fade = (a, b, x) => Math.max(0, Math.min(1, (x - a) / (b - a)));
    if (RC.phase === 'title') { const a = Math.min(fade(0, 0.35, t), 1 - fade(Z.cfg.titleS - 0.5, Z.cfg.titleS, t)); card(ctx, W, H, a, 'title', S); }
    else if (RC.phase === 'end') { const a = fade(RC.tEnd, RC.tEnd + 0.6, t); card(ctx, W, H, a, 'end', S); }
    ctx.save(); ctx.globalAlpha = 0.55; ctx.font = `700 ${Math.round(H / 34)}px Orbitron, Rajdhani, sans-serif`; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,.8)'; ctx.shadowBlur = 6; ctx.fillText('R9-SI', W - H / 36, H - H / 40); ctx.restore();
  }
  function card(ctx, W, H, a, kind, S) {
    if (a <= 0) return;
    ctx.save(); ctx.globalAlpha = a;
    const gr = ctx.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(5,7,14,0.15)'); gr.addColorStop(0.5, 'rgba(5,7,14,0.72)'); gr.addColorStop(1, 'rgba(5,7,14,0.15)');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.shadowColor = 'rgba(0,0,0,.85)'; ctx.shadowBlur = H / 60;
    const big = (txt, y, px, fill) => { ctx.font = `900 ${Math.round(px)}px Orbitron, Rajdhani, sans-serif`; let s = px; while (ctx.measureText(txt).width > W * 0.9 && s > 12) { s *= 0.9; ctx.font = `900 ${Math.round(s)}px Orbitron, Rajdhani, sans-serif`; } ctx.fillStyle = fill; ctx.fillText(txt, W / 2, y); };
    const line = (txt, y, px, col) => { ctx.font = `600 ${Math.round(px)}px Rajdhani, 'Segoe UI', sans-serif`; ctx.fillStyle = col; ctx.fillText(txt, W / 2, y); };
    const logo = ctx.createLinearGradient(W * 0.3, 0, W * 0.7, 0); logo.addColorStop(0, '#7af8ff'); logo.addColorStop(0.45, '#b77aff'); logo.addColorStop(0.8, '#ff4ad8'); logo.addColorStop(1, '#ffd166');
    const n = num(S.C.n), sub = tx('g.zr.sub', { n, span: S.span }, '{n} Blöcke · {span}', '{n} blocks · {span}');
    if (kind === 'title') {
      big('R9-SI · ' + (S.world || ''), H * 0.44, H / 11, logo);
      line(tx('g.zr.title', null, '📽 Zeitraffer', '📽 Time-lapse') + ' · ' + sub, H * 0.56, H / 24, '#e8f0ff');
    } else {
      big('R9-SI', H * 0.38, H / 6, logo);
      line(S.world || '', H * 0.53, H / 15, '#ffd166');
      line(sub, H * 0.62, H / 24, '#e8f0ff');
      line(tx('g.zr.built', null, 'Gebaut in R9-SI', 'Built in R9-SI'), H * 0.7, H / 30, 'rgba(232,240,255,.75)');
    }
    ctx.restore();
  }
  // the video to the player: the host's downloads where the page has them (claude.ai), else a normal download
  Z.save = async function (blob) {
    blob = blob || Z.lastVideo; if (!blob) return null;
    const g = VR.game, wn = String((g && g.meta && g.meta.name) || 'Welt').replace(/[^\w\-äöüÄÖÜß ]+/g, '').trim().replace(/\s+/g, '_') || 'Welt';
    const d = new Date(), name = 'R9-SI_Zeitraffer_' + wn + '_' + d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + '.webm';
    let host = null, HW = window;
    try { if (window.claude && window.claude.use) host = window.claude; else if (window.parent !== window && window.parent.claude && window.parent.claude.use) { host = window.parent.claude; HW = window.parent; } } catch (e) { host = null; }
    if (host) {
      try { const dl = await host.use('downloads'); if (dl) { const req = new HW.Object(); req.filename = name; req.data = blob; await dl.save(req); return { how: 'downloads', name }; } }
      catch (e) { if (e && e.code === 'declined') return { how: 'declined', name }; console.warn('Zeitraffer downloads', e); }
    }
    /*DL*/try { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); return { how: 'download', name }; } catch (e) { /* the preview stays */ }/*/DL*/
    return null;
  };

  // ---------------------------------------------------------------- the overlay
  Z.mount = function () {
    if (Z.ui && Z.ui.el && Z.ui.el.isConnected) return Z.ui;
    const el = document.createElement('div'); el.id = 'zr';
    el.innerHTML = `<div class="zr-bar zr-top"></div><div class="zr-bar zr-bot"></div>
      <div class="zr-head"><b class="zr-t"></b><span class="zr-name"></span><span class="zr-when"></span></div>
      <div class="zr-recb"></div>
      <div class="zr-card"><div class="zr-logo">R9-SI</div><div class="zr-cname"></div><div class="zr-csub"></div></div>
      <div class="zr-msg" role="dialog"><div class="zr-mt"></div><div class="zr-mv"></div><div class="zr-mb"></div></div>
      <div class="zr-ctl">
        <button type="button" class="zr-btn zr-play" data-zr="play"></button>
        <input type="range" class="zr-scrub" min="0" max="1000" step="1" value="0">
        <span class="zr-count"></span>
        <span class="zr-speeds">${ZR.SPEEDS.map((s) => `<button type="button" class="zr-sp" data-zr="sp" data-v="${s}">×${s}</button>`).join('')}</span>
        <button type="button" class="zr-btn zr-sky" data-zr="sky"></button>
        <button type="button" class="zr-btn zr-rec" data-zr="rec"></button>
        <button type="button" class="zr-btn zr-x" data-zr="close"></button>
      </div>
      <div class="zr-keys"></div>`;
    (document.getElementById('app') || document.body).appendChild(el);
    const q = (s) => el.querySelector(s);
    const scrub = q('.zr-scrub');
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-zr]'); if (!b) return;
      const a = b.dataset.zr;
      if (a === 'play') Z.toggle();
      else if (a === 'sp') Z.setSpeed(+b.dataset.v);
      else if (a === 'sky') Z.sky();
      else if (a === 'rec') Z.record();
      else if (a === 'close') { if (U.mode === 'video' && Z.S) U.show('play'); else Z.close(); }
      else if (a === 'go') Z.goFar();
      else if (a === 'save') Z.save().then((r) => { const t = q('.zr-mnote'); if (t) t.textContent = r && (r.how === 'download' || r.how === 'downloads') ? tx('g.zr.saved', { name: r.name }, '⬇ {name} — gespeichert', '⬇ {name} — saved') : r && r.how === 'declined' ? '' : tx('g.zr.saveNo', null, 'Speichern geht hier nicht — rechte Maustaste auf das Video: „Video speichern unter …“', "Saving doesn't work here — right-click the video: “Save video as …”"); });
      try { b.blur(); } catch (er) { /* */ }
    });
    scrub.addEventListener('input', () => { const S = Z.S; if (S) Z.seek(+scrub.value / 1000 * S.T.total); });
    scrub.addEventListener('change', () => { try { scrub.blur(); } catch (er) { /* */ } });
    const U = Z.ui = {
      el, on: false, mode: null,
      texts() {
        q('.zr-t').textContent = tx('g.zr.title', null, '📽 Zeitraffer', '📽 Time-lapse');
        q('.zr-play').title = tx('g.zr.playTip', null, 'Abspielen / Anhalten (Leertaste)', 'Play / pause (Space)');
        scrub.title = tx('g.zr.scrubTip', null, 'Zeitleiste — ziehen zum Spulen (← →)', 'Timeline — drag to scrub (← →)');
        q('.zr-speeds').title = tx('g.zr.speedTip', null, 'Tempo (+ −)', 'Speed (+ −)');
        q('.zr-rec').title = tx('g.zr.recTip', null, 'Nimmt den Zeitraffer als Video auf (WebM) und bietet es zum Speichern an', 'Records the time-lapse as a video (WebM) and offers it for saving');
        q('.zr-x').textContent = '✕'; q('.zr-x').title = tx('g.zr.close', null, 'Zurück (Esc)', 'Back (Esc)');
        q('.zr-keys').textContent = tx('g.zr.keys', null, 'Leertaste ⏯ · ← → spulen · + − Tempo · Esc zurück', 'Space ⏯ · ← → scrub · + − speed · Esc back');
      },
      show(mode) {
        U.mode = mode; U.on = true;
        el.className = 'on m-' + mode;
        U.texts();
        const mt = q('.zr-mt'), mb = q('.zr-mb'), mv = q('.zr-mv');
        mv.innerHTML = '';
        const close = `<button type="button" class="zr-btn" data-zr="close">✕ ${esc(tx('g.zr.close', null, 'Zurück (Esc)', 'Back (Esc)'))}</button>`;
        if (mode === 'loading') { mt.textContent = tx('g.zr.loading', null, 'Der Zeitraffer wird vorbereitet …', 'Preparing the time-lapse …'); mb.innerHTML = close; }
        else if (mode === 'empty') { mt.textContent = tx('g.zr.empty', null, 'Noch nichts aufgenommen. Bau etwas — dann zeigt der Zeitraffer, wie es entstand.', 'Nothing recorded yet. Build something — then the time-lapse shows how it came to be.'); mb.innerHTML = close; }
        else if (mode === 'far') {
          const f = Z.far, d = f ? (f.d < 1000 ? num(f.d) + ' m' : (f.d / 1000).toLocaleString(loc(), { maximumFractionDigits: 1 }) + ' km') : '?';
          mt.textContent = tx('g.zr.far', { d }, 'Hier in der Nähe ist noch nichts entstanden. Dein größtes Bauwerk ist {d} entfernt.', 'Nothing has been built near here yet. Your biggest build is {d} away.');
          mb.innerHTML = `<button type="button" class="zr-btn primary" data-zr="go">${esc(tx('g.zr.go', null, '📍 Hinfliegen und abspielen', '📍 Fly there and play'))}</button>` + close;
        }
        const S = Z.S;
        q('.zr-name').textContent = S ? S.world : '';
        q('.zr-cname').textContent = S ? S.world : '';
        q('.zr-csub').textContent = S ? tx('g.zr.sub', { n: num(S.C.n), span: S.span }, '{n} Blöcke · {span}', '{n} blocks · {span}') : '';
        U.update(true);
      },
      hide() { U.on = false; U.mode = null; el.className = ''; const v = el.querySelector('video'); if (v) { try { v.pause(); } catch (e) { /* */ } } el.querySelector('.zr-mv').innerHTML = ''; },
      note(t) { const g = VR.game; if (g && g.ui && g.ui.hint) g.ui.hint(t, 3200); },
      // the finished video: a preview, ⬇ Speichern, back to the replay
      video(blob, RC) {
        if (!U.on) return;
        U.show('video');
        const mb = (blob.size / 1048576).toLocaleString(loc(), { maximumFractionDigits: 1 });
        q('.zr-mt').textContent = tx('g.zr.recDone', { mb, s: Math.round(RC.t) }, '🎬 Dein Video ist fertig — {mb} MB, {s} s', '🎬 Your video is ready — {mb} MB, {s} s');
        const v = document.createElement('video'); v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true; v.controls = true;
        try { v.src = URL.createObjectURL(blob); } catch (e) { /* no preview */ }
        q('.zr-mv').appendChild(v);
        q('.zr-mb').innerHTML = `<button type="button" class="zr-btn primary" data-zr="save">${esc(tx('g.zr.save', null, '⬇ Speichern', '⬇ Save'))}</button><button type="button" class="zr-btn" data-zr="close">✕ ${esc(tx('g.zr.close', null, 'Zurück (Esc)', 'Back (Esc)'))}</button><div class="zr-mnote"></div>`;
      },
      update(force) {
        const S = Z.S; if (!U.on || !S || U.mode !== 'play') return;
        const C = S.C;
        q('.zr-play').textContent = S.playing ? '⏸' : '▶';
        if (document.activeElement !== scrub) scrub.value = String(Math.round(S.T.total ? S.clock / S.T.total * 1000 : 0));
        scrub.disabled = !!(S.rec && S.rec.phase !== 'end');
        q('.zr-count').textContent = tx('g.zr.count', { n: num(S.cursor), all: num(C.n) }, '{n} von {all} Blöcken', '{n} of {all} blocks');
        for (const b of el.querySelectorAll('.zr-sp')) b.classList.toggle('on', +b.dataset.v === S.speed);
        const sk = q('.zr-sky'); sk.textContent = S.gold ? tx('g.zr.gold', null, '🌅 Goldene Stunde', '🌅 Golden hour') : tx('g.zr.real', null, '🌗 Tageszeit von damals', '🌗 The sky as it was');
        const rb = q('.zr-rec'); rb.classList.toggle('on', !!S.rec); rb.textContent = S.rec ? tx('g.zr.recStop', null, '⏹ Fertig', '⏹ Finish') : tx('g.zr.rec', null, '⏺ Video', '⏺ Video');
        rb.disabled = !Z.canRecord();
        el.classList.toggle('rec', !!S.rec);
        if (S.rec) { const s = Math.floor(S.rec.t); q('.zr-recb').textContent = tx('g.zr.recOn', { t: Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') }, '⏺ Aufnahme {t}', '⏺ Recording {t}'); }
        const b = C.nb ? S.T.batchOf(Math.max(0, S.cursor - 1)) : 0;
        q('.zr-when').textContent = C.nb ? new Date(C.bt[b]).toLocaleString(loc(), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
        q('.zr-card').classList.toggle('on', S.phase === 'intro' || !!(S.rec && S.rec.phase === 'title'));
        void force;
      },
    };
    if (VR.I18N && VR.I18N.on) VR.I18N.on(() => { if (U.on) { U.texts(); U.update(true); } });
    return U;
  };
  // Esc leaves (also from the slider or a message); Space and the arrows do not scroll or press a button meanwhile
  if (typeof window !== 'undefined') window.addEventListener('keydown', (e) => {
    if (!Z.ui || !Z.ui.on) return;
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (Z.ui.mode === 'video' && Z.S) Z.ui.show('play'); else Z.close(); return; }
    const t = e.target, field = t && /INPUT|TEXTAREA|SELECT/.test(t.tagName || '');
    if (!field && (e.code === 'Space' || e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'Home' || e.code === 'End')) e.preventDefault();
  }, true);
  // the open segment goes to the database when the tab is hidden or closed
  if (typeof document !== 'undefined') {
    const flush = () => { const g = VR.game; if (g && g.zeitRec) g.zeitRec.flush(); };
    document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
    window.addEventListener('pagehide', flush);
  }

  // ---------------------------------------------------------------- hooks into game.js (one wrapper each)
  const G = VR.Game && VR.Game.prototype;
  if (G) {
    const startWorld = G.startWorld;
    G.startWorld = async function (meta, fresh) { const r = await startWorld.call(this, meta, fresh); Z.attach(this); return r; };
    const teardown = G.teardownWorld;
    G.teardownWorld = function () { Z.detach(this); return teardown.call(this); };
    const saveMeta = G.saveMeta;
    G.saveMeta = function () { if (this.zeitRec) this.zeitRec.flush(); return saveMeta.call(this); };
    const playFrame = G.playFrame;
    G.playFrame = function (dt) { if (Z.active) { Z.frame(this, dt); return; } if (Z.pending) Z.poll(this, dt); return playFrame.call(this, dt); };
    // /zeitraffer (Profi, like every command)
    const chat = G.chat;
    G.chat = function (text) {
      if (typeof text === 'string' && /^\/(zeitraffer|timelapse)\b/i.test(text) && (!VR.UIPrefs || VR.UIPrefs.get().pro)) { Z.open(null); return; }
      return chat.call(this, text);
    };
  }
})(VR);
