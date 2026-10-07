// ============================================================================
// Live-Schleife B1 in the game (docs/superpowers/specs/2026-10-03-live-loop-design.md §2, §3, §5): what the R9
// Studio changes about a block — its colour, its material, a variant of it — is in the running game at once.
// The Studio writes 'r9si.looks'; the game takes it (the storage event, the overlay closing, a host's
// Studio-Paket), applies it here and in every worker (VR.Looks, the same code on every thread) and re-meshes only
// the sections that hold a changed block (a state-mask scan, a few columns a frame) — no reload, no remeshAll.
// From the game into the Studio: VR.LiveLoop.editTarget(target) opens the Studio over the game on that block's
// „🎨 Aussehen" (route #look/<name>) — the pause menu's „✏️ Aussehen ändern" for what the crosshair pointed at,
// and the Bauhand's ✏️ action (W2; registered when VR.Bauhand is there — the B key is the Bauhand's).
// A world keeps a copy of the variants its saved columns contain (meta.vars): a world opened in a browser that
// lost them gets them back. A guest plays with the host's looks for the session, then with its own again.
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R, L = VR.Looks;
  if (!L) return;
  const tx = (k, v, de, en) => (VR.I18N && VR.I18N.tx ? VR.I18N.tx(k, v, de, en) : String(de).replace(/\{(\w+)\}/g, (m, x) => (v && v[x] !== undefined ? v[x] : m)));
  const LL = VR.LiveLoop = { scan: null, lastTarget: null, lum: null, lumAlb: null, lumDone: null, bh: false, stats: { applies: 0, marked: 0, scanMs: 0 } };

  // ---------------------------------------------------------------- the looks in, everywhere
  // → the number of block types whose look changed
  LL.apply = function (g, o) {
    o = o || {};
    let changed = [];
    try { changed = L.apply(L.session || L.load()); } catch (e) { console.warn('looks', e); return 0; }
    if (!changed.length && !o.force) return 0;
    if (g.pool) g.pool.broadcast({ type: 'looks', data: L.current() });
    LL.stats.applies++;
    LL.after(g, changed, o);
    return changed.length;
  };
  // what shows a changed block: its sections (and their neighbours: a window borrows the wall next to it) are meshed
  // again, a few columns a frame; the pictures (icons, the held and dropped items, the inventory, the creative tabs)
  LL.after = function (g, changed, o) {
    const mask = new Uint8Array(R.stateCount);
    for (const id of changed) { const t = R.types[id]; if (t) mask.fill(1, t.base, t.base + t.nstates); }
    if (g.world) LL.scan = { mask, cols: [...g.world.cols.values()], i: 0, t0: performance.now(), n: 0 };
    if (g.icons) { g.icons.cache.clear(); g.icons.faceCache.clear(); }
    const E = g.entities, gl = g.renderer && g.renderer.gl;
    if (E && E.meshCache) { if (gl) for (const m of E.meshCache.values()) { if (m.vao) gl.deleteVertexArray(m.vao); if (m.vbo) gl.deleteBuffer(m.vbo); } E.meshCache.clear(); }
    g._cat = null;
    if (g.player && g.player.inv) g.player.inv.changed = true;
    if (g.ui && g.ui.updateHUD && g.state === 'play') g.ui.updateHUD(true);
    if (g.gadgets && g.gadgets.blue && g.gadgets.blue.reset) g.gadgets.blue.reset();
    LL.updateLum(g);
    if (g.mp && g.mp.isHost && g.mp.sendPack && !(o && o.noPack)) g.mp.sendPack(null);
  };
  // every frame: the scan goes on (≤ 8 columns or 3 ms); the crosshair's block is remembered for the pause menu
  LL.tick = function (g) {
    const p = g.player;
    if (p && g.ui && !g.ui.blocking && g.state === 'play') LL.lastTarget = p.target ? { x: p.target.x, y: p.target.y, z: p.target.z, state: p.target.state } : null;
    if (!LL.bh && VR.Bauhand) LL.hookBauhand(g);
    const S = LL.scan; if (!S || !g.world) return;
    const w = g.world, t0 = performance.now();
    let n = 0;
    const mark = (cx, sy, cz) => { const s = w.sectionAt(cx, sy, cz); if (s && !s.markLook) { s.dirty = true; s.ver++; s.markLook = 1; LL.stats.marked++; S.marked = (S.marked || []); S.marked.push(s); } };
    while (S.i < S.cols.length && n < 8 && performance.now() - t0 < 3) {
      const c = S.cols[S.i++]; n++;
      if (!c.ready || !c.blocks || w.cols.get(c.key) !== c) continue;
      const B = c.blocks, M = S.mask;
      for (let sy = 0; sy < c.sec.length; sy++) {
        if (!c.sec[sy].count) continue;
        const o = sy << 12, end = Math.min(B.length, o + 4096);
        let hit = false;
        for (let j = o; j < end; j++) if (M[B[j]]) { hit = true; break; }
        if (!hit) continue;
        mark(c.cx, sy, c.cz); mark(c.cx, sy - 1, c.cz); mark(c.cx, sy + 1, c.cz);
        mark(c.cx - 1, sy, c.cz); mark(c.cx + 1, sy, c.cz); mark(c.cx, sy, c.cz - 1); mark(c.cx, sy, c.cz + 1);
      }
    }
    S.n += n; LL.stats.scanMs += performance.now() - t0;
    if (S.i >= S.cols.length) { if (S.marked) for (const s of S.marked) s.markLook = 0; LL.scan = null; LL.stats.lastScanMs = performance.now() - S.t0; }
  };
  // the average luminance of the layers recoloured blocks draw with (renderer.setAvgLum): only those, only when needed
  LL.updateLum = function (g) {
    if (!g.renderer || !g.renderer.setAvgLum || !g.tex || !g.tex.albedo) return;
    const alb = g.tex.albedo[0];
    if (LL.lumAlb !== alb) { LL.lumAlb = alb; LL.lum = new Float32Array(4096).fill(0.5); LL.lumDone = new Uint8Array(4096); LL.lumSent = false; }
    if (!L.usesRC()) return;
    const todo = L.rcLayers().filter(l => l >= 0 && l < 4096 && !LL.lumDone[l]);
    if (!todo.length && LL.lumSent) return;
    const masks = VR.textureMasks ? (LL.masks || (LL.masks = VR.textureMasks())) : null;
    L.lumFill(LL.lum, alb, g.tex.size, masks && masks.cut, todo);
    for (const l of todo) LL.lumDone[l] = 1;
    g.renderer.setAvgLum(LL.lum); LL.lumSent = true;
  };

  // ---------------------------------------------------------------- boot, storage, overlay
  LL.boot = function (g) {
    L.relabel();
    if (VR.I18N && VR.I18N.on) VR.I18N.on(() => { L.relabel(); if (g.icons) g.icons.cache.clear(); });
    LL.apply(g, { noPack: true });
    LL.hookBauhand(g);
  };
  LL.onStorage = function (g, e) {
    if (!e || !e.key) return;
    if (e.key === L.KEY && !L.session) LL.apply(g);
    // ✋ In die Hand from the Studio over the game (Creative / Zen, this world): into the selected slot now
    if (e.key === 'r9si.hand' && e.newValue && g.state === 'play' && VR.Start && VR.Start.handIn) VR.Start.handIn(g);
  };

  // ---------------------------------------------------------------- game → Studio: ✏️ Aussehen
  // a target: a state, a block name, a Ding id ('b:…' / 'm:…'), or {state} / {id} / {name}
  LL.nameOf = function (t) {
    if (t === null || t === undefined) return null;
    if (typeof t === 'number') { if (!t) return null; const ty = R.types[R.T.type[t]]; return ty ? ty.name : null; }
    if (typeof t === 'string') { const d = VR.Ding && VR.Ding.parse ? VR.Ding.parse(t) : null; if (d) return d.kind === 'b' || d.kind === 'm' ? d.key : null; return R.byName[t] ? t : null; }
    if (typeof t === 'object') { if (typeof t.state === 'number') return LL.nameOf(t.state); if (typeof t.id === 'string') return LL.nameOf(t.id); if (typeof t.name === 'string') return LL.nameOf(t.name); }
    return null;
  };
  LL.canEdit = function (t, g) { g = g || VR.game; const n = LL.nameOf(t); return !!(n && L.kindOf(n) && g && g.meta && !g.meta.guest); };
  LL.editTarget = function (t, g) {
    g = g || VR.game; if (!g) return false;
    const n = LL.nameOf(t), say = (m) => { if (g.ui && g.ui.hint) g.ui.hint(m, 2800); };
    if (!n) { say(tx('live.noTarget', null, '✏️ Zeig auf einen Block, dann ändere sein Aussehen.', '✏️ Point at a block, then change its look.')); return false; }
    if (!g.meta || g.meta.guest) { say(tx('live.guest', null, 'In der Welt eines Freundes gilt sein Aussehen.', "In a friend's world, their looks apply.")); return false; }
    if (!L.kindOf(n)) { say(tx('live.notHere', { n: VR.itemName ? VR.itemName(n) : n }, '{n}: Aussehen lässt sich nicht ändern.', '{n}: its look cannot be changed.')); return false; }
    return !!g.openStudio('#look/' + encodeURIComponent(n) + '/w/' + encodeURIComponent(g.meta.id));
  };
  // the pause menu: „✏️ Aussehen ändern" for what the crosshair pointed at when the game was paused
  LL.pauseMenu = function (ui) {
    const g = ui.game, root = ui.root || document;
    let b = root.querySelector('#lookedit');
    if (!b) {
      const after = root.querySelector('#studiolive'); if (!after) return;
      b = document.createElement('button'); b.className = 'btn'; b.id = 'lookedit'; b.dataset.act = 'lookedit';
      after.after(b);
    }
    const n = LL.nameOf(LL.lastTarget), ok = !!(n && L.kindOf(n) && g.meta && !g.meta.guest);
    b.style.display = ok ? '' : 'none';
    b.textContent = tx('live.pause.look', null, '✏️ Aussehen ändern', '✏️ Change look') + (ok ? ' · ' + (VR.itemName ? VR.itemName(n) : n) : '');
    b.title = tx('live.pause.lookTip', null, 'Farbe und Material im R9 Studio — für alle deine Welten', 'Colour and material in the R9 Studio — for all your worlds');
  };
  LL.fromPause = function (g) { return LL.editTarget(LL.lastTarget, g); };
  // the Bauhand (W2) owns the B key; its target card gets „🎨 Aussehen ändern" from here (spec §5: „🎨 Aussehen von
  // ‹Block›" — the card shows the name; its own ✏️ Bearbeiten opens the Crafter). Hooked at boot, or when it appears.
  LL.hookBauhand = function (g) {
    const B = VR.Bauhand; if (LL.bh || !B || typeof B.addAction !== 'function') return false;
    try {
      B.addAction({ id: 'look', order: 15, icon: '🎨', label: () => tx('live.bh.look', null, 'Aussehen ändern', 'Change look'),
        when: (t) => LL.canEdit(t, g),
        run: (t) => { if (typeof B.close === 'function') B.close(); LL.editTarget(t, g); } });
      LL.bh = true;
    } catch (e) { console.warn('bauhand action', e); }
    return LL.bh;
  };

  // ---------------------------------------------------------------- a world keeps the variants it contains
  // the column store tells which slots its saved columns hold (storage.js); the meta keeps their definitions
  LL.metaVars = function (g, meta) {
    if (!meta || meta.guest) return;
    const used = new Set(g.store && g.store.slotsUsed ? g.store.slotsUsed : []);
    // the columns about to be saved (the meta is often written first)
    if (g.world) for (const c of g.world.cols.values()) if (c.modified && c.blocks) L.scanSlots(c.blocks, used);
    // a Welt-Stil rule that leads to a variant: the world needs it too
    const st = VR.WorldStyle && VR.WorldStyle.load ? VR.WorldStyle.load(meta.id) : null;
    for (const r of (st && st.rules) || []) for (const n of r) { const m = /^var_(\d+)$/.exec(n || ''); if (m) used.add(+m[1]); }
    if (!used.size && !meta.vars) return;
    meta.vars = L.worldVars(meta.vars, used, L.session ? null : L.current());
  };
  LL.openWorld = function (g, meta) {
    if (!meta || meta.guest || !meta.vars || L.session) return false;
    const r = L.restoreVars(meta.vars, L.load());
    if (r.conflicts.length) console.warn('variants of this world used otherwise in this browser:', r.conflicts.join(', '));
    if (!r.restored.length) return false;
    if (!L.save(r.data)) console.warn('looks: the restored variants could not be stored (storage full)');
    LL.apply(g, { noPack: true });
    const n = r.restored.length;
    if (g.ui && g.ui.toast) g.ui.toast(tx('live.title', null, '🎨 Aussehen', '🎨 Looks'), n === 1 ? tx('live.restored1', null, 'Eine Variante aus dieser Welt wiederhergestellt', 'One variant restored from this world') : tx('live.restored', { n }, '{n} Varianten aus dieser Welt wiederhergestellt', '{n} variants restored from this world'));
    return true;
  };

  // ---------------------------------------------------------------- multiplayer: the host's looks for a guest
  LL.guestPack = function (g, P) {
    if (!P || !P.data) return;
    L.session = P.data;
    if (VR.Custom && P.models && Object.keys(P.models).length) {
      VR.Custom.apply({ houses: (VR.CUSTOM && VR.CUSTOM.houses) || {}, models: P.models });
      if (g.pool) g.pool.broadcast({ type: 'custom', custom: VR.CUSTOM });
      g.remeshAll();
    }
    LL.apply(g, { force: true, noPack: true });
  };
  LL.endSession = function (g) {
    if (!L.session) return;
    L.session = null;
    if (VR.Custom) { VR.Custom.apply(VR.Custom.load()); if (g.pool) g.pool.broadcast({ type: 'custom', custom: VR.CUSTOM }); }
    LL.apply(g, { force: true, noPack: true });
  };
})(VR);
