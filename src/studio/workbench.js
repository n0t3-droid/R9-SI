// ============================================================================
// R9 Studio · Welt → 🧰 Werkbank (v0.35): edit the world itself, like a world
// editor (MCEdit / Amulet / WorldEdit / Axiom) — right in the region of your world.
// ⛏ Bauen: left breaks, right places the hotbar block, middle takes a block.
// ⬚ Auswahl: two clicks set a box (Bild ↑/↓ its height), 🪄 Zauberstab selects
// what hangs together; then Füllen, Ersetzen, Wände, Hohl, Leeren, Kopieren,
// Ausschneiden, 🧩 als Bauteil. 📋 Einfügen: the piece follows the pointer, R turns
// it, M mirrors it, Bild ↑/↓ lifts it, a click puts it down. 🖌 Pinsel: paint,
// add, carve, smooth, raise and lower the ground. Every change goes into the game
// as soon as it is open (VR.Edits batches) — with the game's undo — and Strg+Z /
// Strg+Y here take every step back.
// ============================================================================
(function () {
  'use strict';
  const C = window.__studioCore, WM = VR.StudioWorld, E = VR.Edits;
  if (!C || !WM || !E) return;
  const { S, HOOK, $ } = C;
  const R = VR.R, T = R.T, F = VR.F, PH = VR.PHYS, VM = VR.VM, CU = VR.Custom;
  const CRF = () => VR.Crafter || {};
  const L = (k, de, v) => (VR.I18N && VR.I18N.t ? VR.I18N.t(k, v, de) : String(de).replace(/\{(\w+)\}/g, (m, x) => (v && v[x] !== undefined ? v[x] : m)));
  const IC = (n, sz) => (window.__studioIcons ? window.__studioIcons.svg(n, sz) : '');
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nameOf = (n) => { const f = CRF().nameOf; return f ? f(n) : ((R.byName[n] && R.byName[n].display) || n); };
  const fmtN = (n) => n.toLocaleString('de-DE');
  const KEEP = 0xffff, MAXOP = 400000, WAND_MAX = 60000;
  const DX = VR.DX, DY = VR.DY, DZ = VR.DZ;
  const WB = WM.wb = { tool: 'build', sel: null, mask: null, clip: null, pasteDy: 0, undo: [], redo: [], brush: { mode: 'paint', r: 3 }, hover: null, region: null, pendingN: 0, inTab: false, listKey: '', cat: 'modern', stroke: null, from: null };
  WM.benchUI = true;
  const active = () => WM.on && S.mode === 'world' && !!WM.world && WM.tab === 'bench';
  const tip = (t, ok) => WM.tipW(t, ok);

  // ---------------------------------------------------------------- the hotbar (the Crafter's, shared across the Studio)
  const hot = () => CRF().hot || (CRF().hot = []);
  const slot = () => CRF().slot || 0;
  function heldState() {
    const id = hot()[slot()], t = id && R.byName[id];
    if (!t || t.o.noItem) return null;
    return t;
  }
  const iconOf = (id) => { const f = CRF().iconOf; return f ? f(id) : null; };
  function paint(cv, id, sz) { const ic = id && iconOf(id); const x = cv.getContext('2d'); x.clearRect(0, 0, sz, sz); if (ic) { x.imageSmoothingEnabled = false; x.drawImage(ic, 0, 0, sz, sz); } }

  // ---------------------------------------------------------------- picking: any block, with the face the ray came through
  function pick(ray) {
    const B = WM.regionBox(); if (!B) return null;
    const [ox, oy, oz] = ray.o, [dx, dy, dz] = ray.d;
    const e = PH.rayBox(ox, oy, oz, dx, dy, dz, B, 0, 0, 0); if (!e) return null;
    const t0 = Math.max(0, e[0]) + 1e-4;
    let px = ox + dx * t0, py = oy + dy * t0, pz = oz + dz * t0;
    let x = Math.floor(px), y = Math.floor(py), z = Math.floor(pz), face = e[1];
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const tdx = Math.abs(1 / dx), tdy = Math.abs(1 / dy), tdz = Math.abs(1 / dz);
    let tx = (dx > 0 ? (x + 1 - px) : (px - x)) * tdx, ty = (dy > 0 ? (y + 1 - py) : (py - y)) * tdy, tz = (dz > 0 ? (z + 1 - pz) : (pz - z)) * tdz, t = t0;
    for (let i = 0; i < 4000; i++) {
      if (x < B[0] || z < B[2] || x >= B[3] || z >= B[5] || y < -1 || y > 520) return null;
      const s = WM.getBlock(x, y, z);
      // fluids only for building (a block on the water); the other tools look through them to the ground
      if (s && !(T.flags[s] & F.INVISIBLE) && (!(T.flags[s] & F.FLUID) || WB.tool === 'build')) return { x, y, z, face, state: s, t, px: ox + dx * t, py: oy + dy * t, pz: oz + dz * t };
      if (tx < ty && tx < tz) { t = t0 + tx; x += sx; tx += tdx; face = sx > 0 ? 1 : 0; } else if (ty < tz) { t = t0 + ty; y += sy; ty += tdy; face = sy > 0 ? 3 : 2; } else { t = t0 + tz; z += sz; tz += tdz; face = sz > 0 ? 5 : 4; }
    }
    return null;
  }
  const inRegion = (x, y, z) => { const B = WM.regionBox(); return !!B && x >= B[0] && z >= B[2] && x < B[3] && z < B[5] && y >= 0 && y < 512; };

  // ---------------------------------------------------------------- edits: the region at once, the worker meshes, the game builds
  let editQ = Promise.resolve();
  function setLocal(list) {
    for (const [x, y, z, s] of list) {
      const c = WM.cols.get((x >> 4) + ',' + (z >> 4)); if (!c || y < 0 || y >= c.H) continue;
      const i = (y << 8) | ((z & 15) << 4) | (x & 15);
      // the 🎨 Stil tab's "what was it made of": a cell you changed is yours now
      if (c.orig && !c.om) { const m = new Map(), o = c.orig; for (let k = 0; k < o.length; k += 2) m.set(o[k], o[k + 1]); c.om = m; }
      c.orig = null; if (c.om) c.om.delete(i);
      c.blocks[i] = s;
    }
    if (WM.st) { WM.st.counts = null; WM.st.glowGen = (WM.st.glowGen || 0) + 1; }
  }
  function swapSections(secs, empty) {
    const key = (g) => g.ox + ',' + g.oy + ',' + g.oz, idx = new Map();
    WM.gpu.forEach((g, i) => idx.set(key(g), i));
    const drop = new Set();
    for (const e of empty || []) { const i = idx.get(e.join(',')); if (i !== undefined) drop.add(i); }
    for (const g of C.uploadSections(secs || [])) { const i = idx.get(key(g)); if (i !== undefined) { C.freeSections([WM.gpu[i]]); WM.gpu[i] = g; } else { WM.gpu.push(g); idx.set(key(g), WM.gpu.length - 1); } }
    if (drop.size) { const gone = [], keep = WM.gpu.filter((g, i) => { if (drop.has(i)) { gone.push(g); return false; } return true; }); C.freeSections(gone); WM.gpu.length = 0; for (const g of keep) WM.gpu.push(g); }
  }
  function applyLocal(list) {
    if (!list.length) return;
    setLocal(list);
    const flat = new Int32Array(list.length * 4); list.forEach((c, k) => { flat[k * 4] = c[0]; flat[k * 4 + 1] = c[1]; flat[k * 4 + 2] = c[2]; flat[k * 4 + 3] = c[3]; });
    const meta = WM.world, region = WM.region;
    editQ = editQ.then(() => C.call({ type: 'world_edit', changes: flat }, [flat.buffer])).then((m) => {
      if (!m || m.type !== 'world_edit' || WM.world !== meta || WM.region !== region) return;
      setLocal(list);                     // (a style preview may have handed back the blocks from before)
      swapSections(m.sections, m.empty);
    }).catch((e) => console.warn('world_edit', e));
  }
  // changes → the region (now), the game (a batch), the undo
  function edit(changes, label, opts) {
    if (!WM.world || !WM.region) return 0;
    const map = new Map();
    for (const c of changes) { if (!inRegion(c[0], c[1], c[2])) continue; map.set(c[0] + ',' + c[1] + ',' + c[2], c); }
    const list = [], undo = [];
    for (const c of map.values()) { const old = WM.getBlock(c[0], c[1], c[2]); if (old === c[3]) continue; list.push([c[0], c[1], c[2], c[3]]); undo.push([c[0], c[1], c[2], old]); }
    if (!list.length) { if (label) tip(L('wb.nothing', 'Nichts zu ändern'), false); return 0; }
    applyLocal(list);
    const sent = send(list);
    WM.editT = Date.now();          // 🕘: this world was worked on
    if (!(opts && opts.noUndo)) { WB.undo.push({ list, undo, label: label || '' }); if (WB.undo.length > 120) WB.undo.shift(); WB.redo = []; }
    if (label) tip(label + ' · ' + fmtN(list.length) + ' ' + L('wb.blocks', 'Blöcke') + (sent ? '' : ' — ⚠ ' + L('wb.onlyHere', 'nur hier: Browser-Speicher voll')), sent);
    later();
    // 📍 something new in the world (not an ⟲): where ▶ Spielen takes you
    if (!(opts && opts.noUndo) && WB.onEdit) { try { WB.onEdit(list, label || ''); } catch (e) { console.warn('landing', e); } }
    return list.length;
  }
  // → the game (a batch in the browser's storage); a full storage keeps it here only — and says so, never "✓ im Spiel"
  function send(list) {
    if (E.push(WM.world.id, E.pack(list))) return true;
    if (WB.lostWorld !== WM.world.id) { WB.lost = 0; WB.lostWorld = WM.world.id; }
    WB.lost += list.length;
    C.full('edits');
    C.sys('⚠ ' + L('wb.full2', 'Browser-Speicher voll — {n} Änderungen nur hier im Studio, das Spiel bekommt sie nicht', { n: fmtN(WB.lost) }), 'err');
    later();
    return false;
  }
  function undo(redo) {
    const from = redo ? WB.redo : WB.undo, to = redo ? WB.undo : WB.redo, e = from.pop();
    if (!e) { tip(redo ? L('wb.noRedo', 'Nichts zu wiederholen') : L('wb.noUndo', 'Nichts zurückzunehmen'), false); return; }
    edit(redo ? e.list : e.undo, null, { noUndo: true }); to.push(e);
    tip((redo ? '⟳ ' : '⟲ ') + (e.label || '') + ' · ' + fmtN(e.list.length), true);
  }
  // a region read anew: what the game has not built yet shows here too
  function regionCheck() {
    if (WB.region === WM.region) return;
    if (!WM.region || WM.loading || !WM.world) return;
    WB.region = WM.region; WB.undo = []; WB.redo = []; WB.sel = null; WB.mask = null; WB.hover = null; WB.stroke = null; WB.lost = 0;
    E.prune(WM.world.id);
    const all = []; for (const b of E.pending(WM.world.id)) for (const c of E.unpack(b)) all.push(c);
    if (all.length) applyLocal(all);
    countPending(true);
  }
  let pendT = 0;
  function countPending(force) {
    const now = performance.now(); if (!force && now - pendT < 1500) return; pendT = now;
    if (!WM.world) return;
    E.prune(WM.world.id);
    const n = E.pending(WM.world.id).length;
    if (n !== WB.pendingN) { WB.pendingN = n; if (WM.on) { C.chips(); if (active()) C.parts(); } }
  }
  window.addEventListener('storage', (e) => { if (WM.world && e.key === E.doneKey(WM.world.id)) countPending(true); });

  // ---------------------------------------------------------------- the selection
  function selBox() {
    const s = WB.sel; if (!s || !s.a) return null;
    const b = s.b || s.a, top = Math.max(s.a[1], b[1]) + (s.dy || 0);
    return [Math.min(s.a[0], b[0]), Math.max(0, Math.min(s.a[1], b[1])), Math.min(s.a[2], b[2]), Math.max(s.a[0], b[0]), Math.max(Math.min(s.a[1], b[1]), top), Math.max(s.a[2], b[2])];
  }
  const selVol = (B) => (B[3] - B[0] + 1) * (B[4] - B[1] + 1) * (B[5] - B[2] + 1);
  function eachCell(fn) {
    const B = selBox(); if (!B) return 0;
    if (WB.mask) { for (const k of WB.mask) { const p = k.split(',').map(Number); fn(p[0], p[1], p[2]); } return WB.mask.size; }
    for (let y = B[1]; y <= B[4]; y++) for (let z = B[2]; z <= B[5]; z++) for (let x = B[0]; x <= B[3]; x++) fn(x, y, z);
    return selVol(B);
  }
  function selSize() { const B = selBox(); if (!B) return 0; return WB.mask ? WB.mask.size : selVol(B); }
  function tooBig() { const n = selSize(); if (n > MAXOP) { tip(L('wb.tooBig', 'Zu groß ({n} Blöcke, höchstens {m})', { n: fmtN(n), m: fmtN(MAXOP) }), false); return true; } return false; }
  // the magic wand: what hangs together with the clicked block (same kind), up to 60 000 blocks
  function wand(hit, add) {
    const t0 = T.type[hit.state], seen = add && WB.mask ? WB.mask : new Set(), q = [[hit.x, hit.y, hit.z]];
    const key = (x, y, z) => x + ',' + y + ',' + z;
    seen.add(key(hit.x, hit.y, hit.z));
    let n = 0;
    while (q.length && seen.size < WAND_MAX) {
      const [x, y, z] = q.pop(); n++;
      for (let d = 0; d < 6; d++) {
        const nx = x + DX[d], ny = y + DY[d], nz = z + DZ[d], k = key(nx, ny, nz);
        if (seen.has(k) || !inRegion(nx, ny, nz)) continue;
        const s = WM.getBlock(nx, ny, nz); if (!s || T.type[s] !== t0) continue;
        seen.add(k); q.push([nx, ny, nz]);
      }
    }
    let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9;
    for (const k of seen) { const [x, y, z] = k.split(',').map(Number); if (x < x0) x0 = x; if (y < y0) y0 = y; if (z < z0) z0 = z; if (x > x1) x1 = x; if (y > y1) y1 = y; if (z > z1) z1 = z; }
    WB.mask = seen; WB.sel = { a: [x0, y0, z0], b: [x1, y1, z1], dy: 0 };
    tip(L('wb.wanded', '🪄 {n} Blöcke ausgewählt{max}', { n: fmtN(seen.size), max: seen.size >= WAND_MAX ? ' (' + L('wb.max', 'Höchstgrenze') + ')' : '' }), true);
    void n;
  }

  // ---------------------------------------------------------------- operations on the selection
  function op(kind, from) {
    const B = selBox(); if (!B) { tip(L('wb.noSel', 'Erst eine Auswahl: ⬚ Auswahl oder 🪄 Zauberstab'), false); return; }
    if (tooBig()) return;
    const t = heldState(), s = t ? t.defaultState : 0;
    if ((kind === 'fill' || kind === 'walls' || kind === 'hollow' || kind === 'replace') && !t) { tip(L('wb.noBlock', 'Wähle unten einen Block'), false); return; }
    if (t && (t.o.kind === 'door' || t.o.kind === 'bed' || t.o.tall || (t.has && t.has('part'))) && kind !== 'replace') { tip(L('wb.noPiece', 'Füllen geht mit einfachen Blöcken — Türen, Betten und Möbel einzeln setzen'), false); return; }
    const out = [];
    if (kind === 'fill') eachCell((x, y, z) => out.push([x, y, z, s]));
    else if (kind === 'clear') eachCell((x, y, z) => out.push([x, y, z, 0]));
    else if (kind === 'walls' || kind === 'hollow') {
      for (let y = B[1]; y <= B[4]; y++) for (let z = B[2]; z <= B[5]; z++) for (let x = B[0]; x <= B[3]; x++) {
        const ex = x === B[0] || x === B[3], ez = z === B[2] || z === B[5], ey = y === B[1] || y === B[4];
        if (kind === 'walls' ? (ex || ez) : (ex || ey || ez)) out.push([x, y, z, s]);
        else if (kind === 'hollow') out.push([x, y, z, 0]);
      }
    } else if (kind === 'replace') {
      const fromT = from !== undefined ? from : WB.from !== null && WB.from !== undefined ? WB.from : topTypes()[0] && topTypes()[0][0];
      if (fromT === undefined || fromT === null) { tip(L('wb.noFrom', 'In der Auswahl ist nichts zum Ersetzen'), false); return; }
      const ft = R.types[fromT], map = VR.WorldStyle && ft && ft.name !== t.name ? VR.WorldStyle.compile([[ft.name, t.name]]) : null;
      eachCell((x, y, z) => { const c = WM.getBlock(x, y, z); if (c && T.type[c] === fromT) out.push([x, y, z, map ? map[c] : s]); });
      if (!out.length) { tip(L('wb.noneOf', 'Kein {b} in der Auswahl', { b: nameOf(ft.name) }), false); return; }
    }
    const labels = { fill: L('wb.op.fill', 'Gefüllt'), clear: L('wb.op.clear', 'Geleert'), walls: L('wb.op.walls', 'Wände'), hollow: L('wb.op.hollow', 'Hohl'), replace: L('wb.op.replace', 'Ersetzt') };
    edit(out, labels[kind]);
  }
  // the kinds in the selection, most first (for Ersetzen)
  let topMemo = { key: '', list: [] };
  function topTypes() {
    const B = selBox(); if (!B) return [];
    const key = B.join(',') + '|' + (WB.mask ? WB.mask.size : 0) + '|' + WB.undo.length;
    if (topMemo.key === key) return topMemo.list;
    const n = new Map(); let k = 0;
    eachCell((x, y, z) => { if (++k > MAXOP) return; const s = WM.getBlock(x, y, z); if (!s) return; const t = T.type[s]; n.set(t, (n.get(t) || 0) + 1); });
    topMemo = { key, list: [...n.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8) };
    return topMemo.list;
  }

  // ---------------------------------------------------------------- the clipboard: copy, cut, turn, mirror, place
  function copy(cut) {
    const B = selBox(); if (!B) { tip(L('wb.noSel', 'Erst eine Auswahl: ⬚ Auswahl oder 🪄 Zauberstab'), false); return; }
    if (tooBig()) return;
    const sx = B[3] - B[0] + 1, sy = B[4] - B[1] + 1, sz = B[5] - B[2] + 1, blocks = new Uint16Array(sx * sy * sz).fill(WB.mask ? KEEP : 0);
    const out = [];
    eachCell((x, y, z) => { const s = WM.getBlock(x, y, z); blocks[((y - B[1]) * sz + (z - B[2])) * sx + (x - B[0])] = s; if (cut) out.push([x, y, z, 0]); });
    setClip({ sx, sy, sz, blocks, name: L('wb.clipName', 'Kopie {a}×{b}×{c}', { a: sx, b: sy, c: sz }) });
    if (cut) edit(out, L('wb.op.cut', 'Ausgeschnitten'));
    else tip(L('wb.copied', '📋 Kopiert {a}×{b}×{c} — 📋 Einfügen (V) setzt es', { a: sx, b: sy, c: sz }), true);
  }
  function setClip(c) {
    if (WB.clip && WB.clip.gpu) C.freeSections(WB.clip.gpu);
    WB.clip = c; c.gpu = null; c.ver = (c.ver || 0) + 1;
    meshClip(c);
    C.parts(); drawTools();
  }
  function meshClip(c) {
    const ver = c.ver, b = c.blocks.slice(); for (let i = 0; i < b.length; i++) if (b[i] === KEEP) b[i] = 0;
    C.call({ type: 'clip_mesh', sx: c.sx, sy: c.sy, sz: c.sz, blocks: b }, [b.buffer]).then((m) => {
      if (m.type !== 'clip_mesh' || WB.clip !== c || c.ver !== ver) return;
      if (c.gpu) C.freeSections(c.gpu);
      c.gpu = C.uploadSections(m.sections);
    });
  }
  // a turn by 90° about the vertical (the game's own turn: facing, axis, sign rotation)
  function turnClip(c) {
    const { sx, sy, sz, blocks } = c, nx = sz, nz = sx, out = new Uint16Array(nx * sy * nz);
    for (let y = 0; y < sy; y++) for (let z = 0; z < sz; z++) for (let x = 0; x < sx; x++) {
      const s = blocks[(y * sz + z) * sx + x];
      // (u, v) → (−v, u), then moved to start at 0: x' = sz − 1 − z, z' = x
      out[(y * nz + x) * nx + (sz - 1 - z)] = s === KEEP ? KEEP : CU.rotState(s, 1);
    }
    c.sx = nx; c.sz = nz; c.blocks = out; c.ver++; meshClip(c);
  }
  // a mirror left ↔ right (x): facing east ↔ west, hinges swap, furniture pieces are laid out again so they stay whole
  function mirrorState(s) {
    if (!s || s === KEEP) return s;
    const t = R.types[T.type[s]]; if (!t) return s;
    if (t.has('facing')) { const f = t.get(s, 'facing'), n = t.props[t.propIndex.facing].n; if ((n === 4 || n >= 5) && (f === 1 || f === 3)) s = t.with(s, 'facing', f ^ 2); }
    if (t.has('hinge')) s = t.with(s, 'hinge', t.get(s, 'hinge') ? 0 : 1);
    if (t.has('rotation') && t.props[t.propIndex.rotation].n === 16) s = t.with(s, 'rotation', (16 - t.get(s, 'rotation')) & 15);
    return s;
  }
  function mirrorClip(c) {
    const { sx, sy, sz, blocks } = c, out = new Uint16Array(sx * sy * sz);
    for (let y = 0; y < sy; y++) for (let z = 0; z < sz; z++) for (let x = 0; x < sx; x++) out[(y * sz + z) * sx + (sx - 1 - x)] = mirrorState(blocks[(y * sz + z) * sx + x]);
    // multi-cell furniture: each piece's cells get their parts again from the model's footprint
    const seen = new Uint8Array(out.length), idx = (x, y, z) => (y * sz + z) * sx + x;
    for (let i = 0; i < out.length; i++) {
      const s = out[i]; if (!s || s === KEEP || seen[i]) continue;
      const t = R.types[T.type[s]]; if (!(t && t.has('part') && VM.MODELS[t.name])) continue;
      const x = i % sx, z = Math.floor(i / sx) % sz, y = Math.floor(i / (sx * sz)), f = t.get(s, 'facing');
      const fp = VM.footprint(VM.MODELS[t.name], f);
      // the piece's cells: same model, connected
      const cells = [], q = [[x, y, z]]; seen[i] = 1;
      while (q.length && cells.length < 64) {
        const p = q.pop(); cells.push(p);
        for (let d = 0; d < 6; d++) { const ax = p[0] + DX[d], ay = p[1] + DY[d], az = p[2] + DZ[d]; if (ax < 0 || ay < 0 || az < 0 || ax >= sx || ay >= sy || az >= sz) continue; const j = idx(ax, ay, az); if (seen[j]) continue; const s2 = out[j]; if (s2 && s2 !== KEEP && T.type[s2] === t.id && t.get(s2, 'facing') === f) { seen[j] = 1; q.push([ax, ay, az]); } }
      }
      if (cells.length !== fp.length) continue;
      const set = new Set(cells.map(p => p.join(',')));
      for (const p of cells) {
        let ok = true; const a = [p[0] - fp[0][0], p[1] - fp[0][1], p[2] - fp[0][2]];
        for (const o of fp) if (!set.has((a[0] + o[0]) + ',' + (a[1] + o[1]) + ',' + (a[2] + o[2]))) { ok = false; break; }
        if (!ok) continue;
        for (const o of fp) { const j = idx(a[0] + o[0], a[1] + o[1], a[2] + o[2]); out[j] = t.with(out[j], 'part', o[3]); }
        break;
      }
    }
    c.blocks = out; c.ver++; meshClip(c);
  }
  // where the piece in hand goes: its bottom centre on the cell in front of the face the pointer is on
  function pasteAt(hit) {
    const c = WB.clip; if (!c || !hit) return null;
    const ax = hit.x + DX[hit.face], ay = hit.y + DY[hit.face], az = hit.z + DZ[hit.face];
    return [ax - (c.sx >> 1), ay + (WB.pasteDy || 0) + (c.dy || 0), az - (c.sz >> 1)];
  }
  function paste(at) {
    const c = WB.clip; if (!c || !at) return;
    const out = [];
    for (let y = 0; y < c.sy; y++) for (let z = 0; z < c.sz; z++) for (let x = 0; x < c.sx; x++) { const s = c.blocks[(y * c.sz + z) * c.sx + x]; if (s === KEEP) continue; out.push([at[0] + x, at[1] + y, at[2] + z, s]); }
    edit(out, '📋 ' + (c.name || L('wb.op.paste', 'Eingefügt')));
  }
  WM.extraInst = function () {
    if (!active() || WB.tool !== 'paste' || !WB.clip || !WB.clip.gpu || !WB.ghostAt) return [];
    const at = WB.ghostAt, c = WB.clip, B = WM.regionBox(), ok = B && at[0] >= B[0] && at[2] >= B[2] && at[0] + c.sx <= B[3] && at[2] + c.sz <= B[5];
    return [{ gpu: c.gpu, pre: [-1, -1, -1], rc: [1, 0], t: at, mul: ok ? [0.84, 1.06, 1.26] : [1.45, 0.55, 0.5] }];
  };

  // ---------------------------------------------------------------- the brush
  const BRUSH = [['paint', 'brush', 'wb.b.paint', 'Malen'], ['add', 'plus', 'wb.b.add', 'Auftragen'], ['carve', 'eraser', 'wb.b.carve', 'Abtragen'], ['smooth', 'walls', 'wb.b.smooth', 'Glätten'], ['raise', 'height', 'wb.b.raise', 'Heben'], ['lower', 'minus', 'wb.b.lower', 'Senken']];
  const solidAt = (x, y, z) => { const s = WM.getBlock(x, y, z); return s && (T.flags[s] & (F.SOLID | F.FLUID)) && !(T.flags[s] & F.REPLACE) ? s : 0; };
  function topSolid(x, z, yMax) { for (let y = Math.min(yMax, 400); y > 0; y--) { const s = WM.getBlock(x, y, z); if (s && (T.flags[s] & F.SOLID) && !(T.flags[s] & (F.LEAVES | F.REPLACE))) return y; } return 0; }
  function brushAt(hit) {
    const b = WB.brush, r = b.r, t = heldState(), out = [], cx = hit.x, cy = hit.y, cz = hit.z, r2 = (r + 0.4) * (r + 0.4);
    const st = WB.stroke; if (!st) return;
    const put = (x, y, z, s) => { const k = x + ',' + y + ',' + z; if (!st.undo.has(k)) st.undo.set(k, [x, y, z, WM.getBlock(x, y, z)]); st.cells.set(k, [x, y, z, s]); out.push([x, y, z, s]); };
    if (b.mode === 'paint' || b.mode === 'add' || b.mode === 'carve') {
      if (b.mode !== 'carve' && !t) { tip(L('wb.noBlock', 'Wähle unten einen Block'), false); return; }
      const s = t ? t.defaultState : 0;
      // what a painted cell becomes: the held block with the old one's turn, half, axis … where it has them
      const maps = st.maps || (st.maps = new Map());
      const paintAs = (cur) => {
        const ct = T.type[cur]; if (!VR.WorldStyle || !t || ct === t.id) return s;
        let m = maps.get(ct); if (m === undefined) { const ft = R.types[ct]; m = ft ? VR.WorldStyle.compile([[ft.name, t.name]]) : null; maps.set(ct, m); }
        return m ? m[cur] : s;
      };
      for (let y = cy - r; y <= cy + r; y++) for (let z = cz - r; z <= cz + r; z++) for (let x = cx - r; x <= cx + r; x++) {
        const d2 = (x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2; if (d2 > r2 || !inRegion(x, y, z)) continue;
        const cur = WM.getBlock(x, y, z);
        if (b.mode === 'carve') { if (cur) put(x, y, z, 0); continue; }
        if (b.mode === 'paint') {
          // the skin: solid blocks with an open side
          if (!cur || cur === s || T.type[cur] === t.id) continue;
          let open = false; for (let d = 0; d < 6 && !open; d++) { const n = WM.getBlock(x + DX[d], y + DY[d], z + DZ[d]); if (!n || !(T.flags[n] & F.OPAQUE)) open = true; }
          if (open) put(x, y, z, paintAs(cur));
          continue;
        }
        // add: air next to something
        if (cur && !(T.flags[cur] & F.REPLACE)) continue;
        let touch = false; for (let d = 0; d < 6 && !touch; d++) if (solidAt(x + DX[d], y + DY[d], z + DZ[d])) touch = true;
        if (touch) put(x, y, z, s);
      }
    } else {
      // the ground: smooth / raise / lower the top surface of every column in the circle
      const hs = new Map();
      for (let z = cz - r - 1; z <= cz + r + 1; z++) for (let x = cx - r - 1; x <= cx + r + 1; x++) if (inRegion(x, 0, z)) hs.set(x + ',' + z, topSolid(x, z, cy + r + 6));
      for (let z = cz - r; z <= cz + r; z++) for (let x = cx - r; x <= cx + r; x++) {
        const d2 = (x - cx) ** 2 + (z - cz) ** 2; if (d2 > r2 || !inRegion(x, 0, z)) continue;
        const h = hs.get(x + ',' + z); if (!h) continue;
        let want = h;
        if (b.mode === 'raise') want = h + (d2 <= (r * 0.5) ** 2 + 0.5 ? 1 : (Math.random() < 0.5 ? 1 : 0));
        else if (b.mode === 'lower') want = h - (d2 <= (r * 0.5) ** 2 + 0.5 ? 1 : (Math.random() < 0.5 ? 1 : 0));
        else { let sum = 0, n = 0; for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const v = hs.get((x + dx) + ',' + (z + dz)); if (v) { sum += v; n++; } } want = Math.round(sum / Math.max(1, n)); }
        if (want === h) continue;
        const top = WM.getBlock(x, h, z), below = WM.getBlock(x, h - 1, z);
        if (want > h) { put(x, h, z, below && (T.flags[below] & F.SOLID) ? below : top); for (let y = h + 1; y <= want; y++) put(x, y, z, top); if (WM.getBlock(x, want + 1, z) && (T.flags[WM.getBlock(x, want + 1, z)] & F.REPLACE)) put(x, want + 1, z, 0); }
        else { for (let y = h; y > want; y--) put(x, y, z, 0); if (want > 0) put(x, want, z, top); }
      }
    }
    if (out.length) applyLocal(out.filter(c => WM.getBlock(c[0], c[1], c[2]) !== c[3]));
  }
  function strokeEnd() {
    const st = WB.stroke; WB.stroke = null; if (!st) return;
    const list = [], undo = [];
    for (const [k, c] of st.cells) { const u = st.undo.get(k); if (u[3] === c[3]) continue; list.push(c); undo.push(u); }
    if (!list.length) return;
    send(list);
    WM.editT = Date.now();
    WB.undo.push({ list, undo, label: '🖌 ' + L(BRUSH.find(b => b[0] === WB.brush.mode)[2], BRUSH.find(b => b[0] === WB.brush.mode)[3]) }); WB.redo = [];
    later();
  }

  // ---------------------------------------------------------------- Bauteile: pieces you keep (every world, every session)
  const LIB_KEY = 'r9si.library';
  function libLoad() { const d = E.ls.get(LIB_KEY); return d && Array.isArray(d.items) ? d.items : []; }
  function libSave(items) { return E.ls.set(LIB_KEY, { v: 1, items, t: Date.now() }); }
  function libAdd() {
    const c = WB.clip; if (!c) { tip(L('wb.noClip', 'Erst etwas kopieren'), false); return; }
    const pal = [0, 'air'], map = new Map(), idx = new Uint16Array(c.blocks.length);
    for (let i = 0; i < c.blocks.length; i++) { const s = c.blocks[i]; if (s === KEEP) continue; if (!s) { idx[i] = 1; continue; } let k = map.get(s); if (k === undefined) { k = pal.length; pal.push(CU.portable(s)); map.set(s, k); } idx[i] = k; }
    const items = libLoad(), n = items.length + 1;
    const def = c.name && !/^Kopie /.test(c.name) ? c.name : L('wb.libDefault', 'Bauteil {n}', { n });
    const name = (window.prompt ? window.prompt(L('wb.libName', 'Name für das Bauteil'), def) : null) || def;
    items.unshift({ id: 'b' + Date.now().toString(36), name, t: Date.now(), sx: c.sx, sy: c.sy, sz: c.sz, dy: c.dy || 0, pal, rle: CU.b64(CU.vrle(idx)) });
    if (!libSave(items)) { C.full('library'); tip('⚠ ' + L('wb.libFull', 'Nicht behalten — der Browser-Speicher ist voll'), false); return; }
    c.name = name; tip('🧩 ' + name, true); C.parts();
  }
  function libClip(it) {
    const pal = it.pal.map((p, i) => (i === 0 ? KEEP : i === 1 ? 0 : CU.fromPortable(p))), idx = CU.unvrle(CU.unb64(it.rle), it.sx * it.sy * it.sz), blocks = new Uint16Array(idx.length);
    for (let i = 0; i < idx.length; i++) { const s = pal[idx[i]]; blocks[i] = s === undefined || s < 0 ? 0 : s; }
    return { sx: it.sx, sy: it.sy, sz: it.sz, blocks, name: it.name, dy: it.dy || 0 };
  }
  WB.libClip = libClip; WB.setClip = setClip;

  // ---------------------------------------------------------------- files: other editors' structures in, the piece out
  const FILE_TYPES = '.schem,.schematic,.nbt,.litematic,.vox,.json,.png,.jpg,.jpeg,.webp,.gif,.bmp';
  function openFile() {
    let inp = document.getElementById('benchFile');
    if (!inp) { inp = document.createElement('input'); inp.type = 'file'; inp.id = 'benchFile'; inp.accept = FILE_TYPES; inp.multiple = false; inp.style.display = 'none'; document.body.appendChild(inp); inp.onchange = () => { const f = inp.files && inp.files[0]; inp.value = ''; if (f) importFile(f); }; }
    inp.click();
  }
  async function importFile(file) {
    const name = file.name || 'datei';
    if (/\.(png|jpe?g|webp|gif|bmp)$/i.test(name) || /^image\//.test(file.type || '')) { if (WM.imagine) WM.imagine.open(file); else tip(L('wb.noImg', 'Bilder kommen mit dem Bild-Assistenten'), false); return; }
    let g = null;
    try {
      const u8 = new Uint8Array(await file.arrayBuffer());
      const BCol = VR.BlockColors;
      g = await VR.Schem.read(name, u8, (r, gg, b) => (BCol && BCol.ready() ? BCol.nearest(r, gg, b, 'all') : R.byName.white_concrete ? R.byName.white_concrete.defaultState : 1));
    } catch (e) { console.warn('import', e); tip('📂 ' + name + ': ' + (e && e.message ? e.message : L('wb.badFile', 'nicht lesbar')), false); return; }
    const n = g.sx * g.sy * g.sz;
    if (n > 4000000) { tip(L('wb.bigFile', '{n} Blöcke sind zu viel für die Werkbank (höchstens 4 Mio.)', { n: fmtN(n) }), false); return; }
    g.name = g.name || name.replace(/\.[^.]+$/, '');
    setClip(g); setTool('paste');
    const unk = Object.entries(g.unknown || {}).sort((a, b) => b[1] - a[1]);
    tip('📂 ' + g.name + ` · ${g.sx}×${g.sy}×${g.sz}` + (unk.length ? ' · ' + L('wb.unknown', '{n} unbekannte Blockarten (Luft)', { n: unk.length }) : ''), !unk.length);
    if (unk.length) C.sys(L('wb.unknownList', 'Unbekannt: {l}', { l: unk.slice(0, 6).map(([k, v]) => k.replace('minecraft:', '') + ' ×' + v).join(', ') }), 'err');
  }
  // the host's own saving where there is one (claude.ai: some types only — the others in a .zip), a download otherwise
  async function saveFile(name, bytes, mime) {
    // the Studio's own window.claude, or the game's when the Studio runs in the game's overlay; the request is made in
    // that window (its plain object, its Uint8Array) so its runtime takes it as its own
    let host = null, HW = window; try { if (window.claude && window.claude.use) host = window.claude; else if (window.parent !== window && window.parent.claude && window.parent.claude.use) { host = window.parent.claude; HW = window.parent; } } catch (e) { host = null; }
    if (host && host.use) {
      try {
        const dl = await host.use('downloads');
        if (dl) {
          const plain = /\.(json|png|zip|txt)$/i.test(name), fname = plain ? name : name.replace(/\.[^.]+$/, '') + '.zip';
          const data = plain ? bytes : VR.Schem.zip([{ name, data: bytes }]), req = new HW.Object();
          req.filename = fname; req.data = new HW.Uint8Array(data);
          await dl.save(req);
          tip('⬇ ' + fname, true); return;
        }
      } catch (e) { if (e && e.code === 'declined') return; console.warn('save', e); }
    }
    try {
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes], { type: mime || 'application/octet-stream' })); a.download = name;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 3000);
      tip('⬇ ' + name, true);
    } catch (e) { tip(L('wb.noSave', 'Speichern geht hier nicht'), false); }
  }
  async function exportClip(kind) {
    const c = WB.clip; if (!c) { tip(L('wb.noClip', 'Erst etwas kopieren'), false); return; }
    const base = (c.name || 'bauteil').replace(/[^\w\-äöüÄÖÜß ]+/g, '').trim().replace(/\s+/g, '_') || 'bauteil';
    if (kind === 'schem') await saveFile(base + '.schem', await VR.Schem.writeSchem(c, c.name), 'application/octet-stream');
    else if (kind === 'vox') await saveFile(base + '.vox', VR.Schem.writeVox(c, (s) => (VR.BlockColors ? VR.BlockColors.colorOf(s) : [160, 160, 160])), 'application/octet-stream');
    else await saveFile(base + '.json', new TextEncoder().encode(JSON.stringify(VR.Schem.toJSON(c, c.name))), 'application/json');
  }
  // drop a file on the view
  (function dropZone() {
    const main = $('main'); if (!main) { setTimeout(dropZone, 500); return; }
    main.addEventListener('dragover', (e) => { if (!active()) return; e.preventDefault(); main.classList.add('dropping'); });
    main.addEventListener('dragleave', () => main.classList.remove('dropping'));
    main.addEventListener('drop', (e) => { main.classList.remove('dropping'); if (!active()) return; e.preventDefault(); const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) importFile(f); });
  })();
  // paste a picture from the clipboard (Strg+V with an image on it)
  window.addEventListener('paste', (e) => {
    if (!active() || /TEXTAREA|INPUT/.test(document.activeElement.tagName)) return;
    const it = [...((e.clipboardData && e.clipboardData.items) || [])].find(i => /^image\//.test(i.type));
    if (it) { e.preventDefault(); const f = it.getAsFile(); if (f && WM.imagine) WM.imagine.open(f); }
  });
  WB.importFile = importFile; WB.exportClip = exportClip;

  // ---------------------------------------------------------------- tools
  const TOOLS = [['build', 'hammer', 'wb.t.build', 'Bauen', 'B'], ['select', 'area', 'wb.t.select', 'Auswahl', 'U'], ['wand', 'pick', 'wb.t.wand', 'Zauberstab', 'Z'], ['brush', 'brush', 'wb.t.brush', 'Pinsel', 'P'], ['paste', 'upload', 'wb.t.paste', 'Einfügen', 'V']];
  function setTool(t) {
    if (t === 'paste' && !WB.clip) { tip(L('wb.noClip', 'Erst etwas kopieren'), false); return; }
    WB.tool = t; WB.ghostAt = null; WB.stroke = null;
    drawTools(); C.parts(); help();
    const d = TOOLS.find(x => x[0] === t); if (d) tip(L(d[2], d[3]), true);
  }
  function ensureUI() {
    const main = $('main'); if (!main || $('#benchTools')) return;
    for (const id of ['benchTools', 'benchBar', 'benchHelp']) { const e = document.createElement('div'); e.id = id; main.appendChild(e); }
  }
  function drawTools() {
    ensureUI();
    const el = $('#benchTools'), on = active(); el.classList.toggle('on', on);
    if (!on) { el.innerHTML = ''; return; }
    const b = (cls, icon, label, key, title, fn) => `<button class="${cls}" title="${esc(title)}" data-fn="${fn}">${IC(icon, 26)}<span>${esc(label)}</span>${key ? '<kbd>' + key + '</kbd>' : ''}</button>`;
    let h = '';
    for (const [id, icon, k, de, key] of TOOLS) {
      h += b('tool' + (WB.tool === id ? ' on' : '') + (id === 'paste' && !WB.clip ? ' off' : ''), icon, L(k, de), key, L(k + '.tip', de), 'tool:' + id);
      if (id === 'brush' && WB.tool === 'brush') {
        h += '<div class="sub">' + BRUSH.map(([bid, icon2, bk, bde]) => `<button class="scope${WB.brush.mode === bid ? ' on' : ''}" data-fn="brush:${bid}" title="${esc(L(bk, bde))}">${IC(icon2, 20)}<span>${esc(L(bk, bde))}</span></button>`).join('')
          + `<div class="size"><button data-fn="size:-1" title="[">−</button><b>${WB.brush.r}</b><button data-fn="size:1" title="]">+</button></div></div>`;
      }
    }
    h += '<i class="sep"></i>' + b('tool', 'undo', L('wb.undo', 'Zurück'), 'Strg+Z', L('wb.undo', 'Zurück'), 'undo') + b('tool', 'redo', L('wb.redo', 'Vor'), 'Strg+Y', L('wb.redo', 'Vor'), 'redo');
    el.innerHTML = h;
    for (const x of el.querySelectorAll('button')) x.onclick = (e) => { e.stopPropagation(); action(x.dataset.fn); };
  }
  function action(fn) {
    const [a, v] = fn.split(':');
    if (a === 'tool') setTool(v);
    else if (a === 'brush') { WB.brush.mode = v; drawTools(); help(); }
    else if (a === 'size') { WB.brush.r = Math.max(1, Math.min(10, WB.brush.r + (+v))); drawTools(); }
    else if (a === 'undo') undo(false);
    else if (a === 'redo') undo(true);
  }
  function drawBar() {
    ensureUI();
    const bar = $('#benchBar'), on = active(); bar.classList.toggle('on', on);
    if (!on) { bar.innerHTML = ''; return; }
    bar.innerHTML = '';
    hot().slice(0, 9).forEach((id, i) => {
      const s = document.createElement('div'); s.className = 'slot' + (i === slot() ? ' on' : ''); s.title = id ? nameOf(id) : '—';
      const cv = document.createElement('canvas'); cv.width = cv.height = 40; s.appendChild(cv);
      const k = document.createElement('i'); k.textContent = i + 1; s.appendChild(k);
      s.onclick = () => { CRF().slot = i; drawBar(); C.list(); };
      bar.appendChild(s); if (id) paint(cv, id, 40);
    });
    const nm = document.createElement('div'); nm.className = 'nm'; const id = hot()[slot()]; nm.textContent = id ? nameOf(id) : '—'; bar.appendChild(nm);
  }
  function help() {
    ensureUI();
    const el = $('#benchHelp'), on = active(); el.classList.toggle('on', on); if (!on) return;
    const k = (a, b) => `<b>${a}</b> ${b}`;
    const lines = {
      build: [k('L', L('wb.h.break', 'abbauen')), k('R', L('wb.h.place', 'setzen')), k(L('wb.h.mid', 'Mitte'), L('wb.h.take', 'Block nehmen')), k('1–9', 'Hotbar')],
      select: [k('L', WB.sel && WB.sel.a && !WB.sel.b ? L('wb.h.corner2', 'Ecke 2') : L('wb.h.corner1', 'Ecke 1')), k('R', L('wb.h.unsel', 'Auswahl weg')), k('Bild ↑/↓', L('wb.h.height', 'Höhe')), k('F G H J Entf', L('wb.h.ops', 'Füllen · Ersetzen · Hohl · Wände · Leeren')), k('Strg+C/X/V', '')],
      wand: [k('L', L('wb.h.wand', 'zusammenhängendes wählen')), k('Shift+L', L('wb.h.wandAdd', 'dazu')), k('R', L('wb.h.unsel', 'Auswahl weg'))],
      brush: [k(L('wb.h.drag', 'L ziehen'), L('wb.h.brush', 'pinseln')), k('[ ]', L('wb.h.size', 'Größe')), k('R', L('wb.h.take', 'Block nehmen'))],
      paste: [k('L', L('wb.h.put', 'hinsetzen')), k('R', L('wb.h.turn', 'drehen')), k('M', L('wb.h.mirror', 'spiegeln')), k('Bild ↑/↓', L('wb.h.lift', 'höher/tiefer')), k('Esc', L('wb.h.done', 'fertig'))],
    }[WB.tool] || [];
    el.innerHTML = lines.join(' · ') + ' · ' + k(L('wb.h.dragView', 'Ziehen'), WB.tool === 'brush' ? L('wb.h.viewR', 'mit rechts: Ansicht drehen') : L('wb.h.view', 'Ansicht drehen · Shift schiebt'));
  }

  // ---------------------------------------------------------------- the left side: the blocks (the hotbar slot takes the click)
  const CATS = [['fav', '★'], ['modern', 'Modern'], ['build', 'Bauen'], ['arch', 'Voxel Homes'], ['vtech', 'Möbel'], ['nature', 'Natur'], ['func', 'Funktion'], ['all', 'Alle']];
  CATS.splice(2, 0, ['vmodern', '✨ Modern Living']);   // the Modern Living pack (voxmodern.js)
  let byCat = null;
  function cats() {
    if (byCat) return byCat;
    byCat = { all: [] };
    for (const t of R.types) {
      if (!t || !t.cat || t.o.noItem || t.o.cutOf || t.name === 'air') continue;
      if (t.has && t.has('part') && !VM.MODELS[t.name]) continue;
      let c = t.cat; if (c === 'creative') c = 'func'; if (c === 'vlife' || c === 'vshop') c = 'vtech'; if (c === 'color') c = 'build';
      (byCat[c] || (byCat[c] = [])).push(t.name); byCat.all.push(t.name);
    }
    return byCat;
  }
  const iconQ = [];
  // (until the textures are forged no icon can be drawn: the queue waits)
  (function pump() { let n = 0; while (iconQ.length && n < 24) { const [cv, id] = iconQ[0]; if (!cv.isConnected) { iconQ.shift(); continue; } if (!C.texInfo()) break; iconQ.shift(); paint(cv, id, 48); n++; } requestAnimationFrame(pump); })();
  function listBlocks(el) {
    const seg = document.createElement('div'); seg.className = 'seg';
    const FV = VR.Favs, inAll = new Set(cats().all), favs = FV ? FV.list().filter(id => inAll.has(id)) : [];
    for (const [id, label] of CATS) { const b = document.createElement('button'); b.className = WB.cat === id ? 'on' : ''; b.dataset.wcat = id; b.textContent = id === 'fav' ? '★ ' + L('wb.cat.fav', 'Favoriten') + (favs.length ? ' ' + favs.length : '') : L('wb.cat.' + id, label); b.onclick = () => { WB.cat = id; C.list(); }; seg.appendChild(b); }
    el.appendChild(seg);
    const f = (S.filter || '').trim().toLowerCase(), all = cats();
    const CATL = VR.StudioCatalog;
    let arr = f ? (CATL && CATL.search ? CATL.search(all.all, f) : all.all.filter(n => n.includes(f.replace(/ /g, '_')) || nameOf(n).toLowerCase().includes(f))) : WB.cat === 'fav' ? favs : (all[WB.cat] || all.all);
    arr = arr.slice(0, 700);
    if (!f && WB.cat === 'fav' && !arr.length) { const d = document.createElement('div'); d.className = 'note dim'; d.textContent = L('wb.favEmpty', 'Noch keine Favoriten — ☆ auf einer Kachel (oder Rechtsklick) legt sie hierher. Sie gelten überall: Teile, Crafter, Welt, Spiel.'); el.appendChild(d); }
    const cur = hot()[slot()];
    for (const id of arr) {
      const d = document.createElement('div'); d.className = 'tile' + (cur === id ? ' on' : ''); d.title = nameOf(id); d.dataset.id = id;
      const cv = document.createElement('canvas'); cv.width = cv.height = 48; d.appendChild(cv); iconQ.push([cv, id]);
      d.onclick = () => { hot()[slot()] = id; if (CRF().useRecent) CRF().useRecent(id); drawBar(); for (const x of document.querySelectorAll('#list .tile')) x.classList.toggle('on', x.dataset.id === id); C.parts(); };
      if (FV) {
        const fb = document.createElement('button'); const on = FV.has(id); fb.className = 'favb sm' + (on ? ' on' : ''); fb.textContent = on ? '★' : '☆'; fb.title = on ? L('fav.off', 'Aus den Favoriten nehmen') : L('fav.onR', 'Zu den Favoriten (Rechtsklick geht auch)');
        // (a ☆ the storage refused holds for this page only: said so, never shown as done)
        const tog = (ev) => { ev.stopPropagation(); ev.preventDefault(); const now = FV.toggle(id); fb.classList.toggle('on', now); fb.textContent = now ? '★' : '☆'; if (FV.ok === false) tip('⚠ ' + nameOf(id) + ' — ' + L('fav.unsaved', 'nur bis zum Schließen: Browser-Speicher voll'), false); else tip((now ? '★ ' : '☆ ') + nameOf(id), true); if (WB.cat === 'fav') C.list(); else { const b = el.querySelector('[data-wcat="fav"]'); if (b) b.textContent = '★ ' + L('wb.cat.fav', 'Favoriten') + (FV.list().length ? ' ' + FV.list().filter(x => inAll.has(x)).length : ''); } };
        fb.onclick = tog; d.oncontextmenu = tog; d.appendChild(fb);
      }
      el.appendChild(d);
    }
  }

  // ---------------------------------------------------------------- the right side
  function panel() {
    const el = $('#partsBody'); el.innerHTML = ''; el.classList.remove('empty');
    const H = (t, b) => { const d = document.createElement('div'); d.className = 'ph'; d.innerHTML = t + (b !== undefined ? ' <b>' + b + '</b>' : ''); el.appendChild(d); };
    const btn = (label, cls, fn, title) => { const b = document.createElement('button'); b.className = 'cbtn ' + (cls || ''); b.innerHTML = label; if (title) b.title = title; b.onclick = fn; return b; };
    const row = (...bs) => { const r = document.createElement('div'); r.className = 'crow'; for (const b of bs) if (b) r.appendChild(b); el.appendChild(r); return r; };
    const note = (html, cls) => { const p = document.createElement('div'); p.className = 'note' + (cls ? ' ' + cls : ''); p.innerHTML = html; el.appendChild(p); };
    H('🧰 ' + L('wb.title', 'Werkbank'), esc(WM.world.name));
    // where the changes are: in the game already, or waiting for it
    const lost = WB.lost && WB.lostWorld === WM.world.id ? WB.lost : 0;
    const live = lost ? `<span class="warn">⚠ ${lost === 1 ? L('wb.lost1', '1 Änderung nur hier im Studio') : L('wb.lost', '{n} Änderungen nur hier im Studio', { n: fmtN(lost) })}</span> — ${L('wb.lostHow', 'der Browser-Speicher ist voll, das Spiel bekommt sie nicht. 🧹 Platz schaffen (oben), dann neu machen.')}`
      : WB.pendingN ? `<span class="warn">⏳ ${L('wb.pending', '{n} Änderungen warten aufs Spiel', { n: WB.pendingN })}</span> — ${L('wb.pendingHow', 'es baut sie, sobald die Welt dort offen ist')}` : `<span class="good">✓ ${L('wb.inGame', 'Alles ist im Spiel')}</span>`;
    note(live, 'wbLive');
    row(btn('⟲ ' + L('wb.undo', 'Zurück'), '', () => undo(false), 'Strg+Z'), btn('⟳ ' + L('wb.redo', 'Vor'), '', () => undo(true), 'Strg+Y'));
    // ✨ make something new: a house from the Baukasten, anything from the Genie, a picture as blocks
    if (WM.imagine) {
      H('✨ ' + L('wb.create', 'Erschaffen'));
      const mk = document.createElement('div'); mk.className = 'wbMake';
      const m = (ic, label, sub, fn, cls) => { const b = document.createElement('button'); b.className = cls || ''; b.innerHTML = `<i>${ic}</i><span>${esc(label)}</span><small>${esc(sub)}</small>`; b.onclick = fn; mk.appendChild(b); };
      m('🏠', L('wb.mkHouse', 'Haus'), L('wb.mkHouseS', 'Baukasten'), () => WM.imagine.open(null, 'house'));
      if (WM.imagine.aiOK) m('✨', L('wb.mkGenie', 'Genie'), L('wb.mkGenieS', 'Foto / Text → 3D'), () => WM.imagine.open(null, 'genie'), 'hot');
      m('🖼', L('wb.mkImg', 'Bild → 3D'), L('wb.mkImgS', 'Blockbild, Ansichten'), () => WM.imagine.open(null, WM.imagine.mode === 'solid' ? 'solid' : 'flat'));
      el.appendChild(mk);
    }
    // the selection and what to do with it
    const B = selBox();
    if (B) {
      H('⬚ ' + L('wb.sel', 'Auswahl'), `${B[3] - B[0] + 1} × ${B[4] - B[1] + 1} × ${B[5] - B[2] + 1}` + (WB.mask ? ' · 🪄 ' + fmtN(WB.mask.size) : ''));
      const ops = document.createElement('div'); ops.className = 'wbOps';
      const o = (icon, label, key, fn) => { const b = document.createElement('button'); b.innerHTML = `${IC(icon, 20)}<span>${esc(label)}</span>${key ? '<kbd>' + key + '</kbd>' : ''}`; b.onclick = fn; ops.appendChild(b); };
      o('fill', L('wb.o.fill', 'Füllen'), 'F', () => op('fill'));
      o('palette', L('wb.o.replace', 'Ersetzen'), 'G', () => op('replace'));
      o('walls', L('wb.o.walls', 'Wände'), 'J', () => op('walls'));
      o('hollow', L('wb.o.hollow', 'Hohl'), 'H', () => op('hollow'));
      o('eraser', L('wb.o.clear', 'Leeren'), 'Entf', () => op('clear'));
      o('one', L('wb.o.copy', 'Kopieren'), 'Strg+C', () => copy(false));
      o('trash', L('wb.o.cut', 'Ausschneiden'), 'Strg+X', () => copy(true));
      el.appendChild(ops);
      // Ersetzen: which kind (the most common first) → the hotbar block
      const tt = topTypes();
      if (tt.length) {
        const r = document.createElement('div'); r.className = 'wbFrom'; r.innerHTML = `<span>${L('wb.replaceWhat', 'Ersetzen:')}</span>`;
        tt.forEach(([tid, n]) => { const t = R.types[tid], b = document.createElement('button'); const on = (WB.from !== null && WB.from !== undefined ? WB.from : tt[0][0]) === tid; b.className = on ? 'on' : ''; b.title = nameOf(t.name) + ' × ' + fmtN(n); const cv = document.createElement('canvas'); cv.width = cv.height = 26; b.appendChild(cv); paint(cv, t.name, 26); b.onclick = () => { WB.from = tid; C.parts(); }; r.appendChild(b); });
        const held = heldState(); const ar = document.createElement('i'); ar.textContent = '→'; r.appendChild(ar);
        const cv2 = document.createElement('canvas'); cv2.width = cv2.height = 26; cv2.className = 'to'; r.appendChild(cv2); if (held) paint(cv2, held.name, 26);
        el.appendChild(r);
      }
      row(btn('✕ ' + L('wb.unsel', 'Auswahl weg'), '', () => { WB.sel = null; WB.mask = null; WB.from = null; C.parts(); C.hud(); }));
    }
    // the clipboard
    if (WB.clip) {
      const c = WB.clip;
      H('📋 ' + L('wb.clip', 'Zwischenablage'), `${c.sx} × ${c.sy} × ${c.sz}`);
      note(esc(c.name || ''), 'dim');
      row(btn('📋 ' + L('wb.o.paste', 'Einfügen') + ' · V', WB.tool === 'paste' ? 'pri' : '', () => setTool('paste')), btn('↻ ' + L('wb.h.turn', 'drehen'), '', () => { turnClip(c); C.parts(); }, 'R'), btn('⇋ ' + L('wb.h.mirror', 'spiegeln'), '', () => { mirrorClip(c); C.parts(); }, 'M'));
      row(btn('🧩 ' + L('wb.toLib', 'Als Bauteil behalten'), '', libAdd));
      row(btn('⬇ .schem', '', () => exportClip('schem'), L('wb.expSchem', 'Für WorldEdit, Amulet, Axiom, MCEdit')), btn('⬇ .vox', '', () => exportClip('vox'), L('wb.expVox', 'Für MagicaVoxel')), btn('⬇ .json', '', () => exportClip('json'), L('wb.expJson', 'Als R9-Bauteil')));
    }
    H('📂 ' + L('wb.files', 'Dateien & Bilder'));
    row(btn('📂 ' + L('wb.open', 'Öffnen …'), '', openFile, '.schem · .nbt · .litematic · .vox · .json · Bild'));
    note(L('wb.filesHow', 'Strukturen aus WorldEdit, Amulet, Axiom, Litematica oder MagicaVoxel — oder ein Bild. Auch per Ziehen ins Bild oder Strg+V.'), 'dim');
    // the pieces you keep
    const items = libLoad();
    H('🧩 ' + L('wb.lib', 'Bauteile'), items.length || '');
    if (!items.length) note(L('wb.libEmpty', 'Noch keine — eine Auswahl kopieren und „🧩 Als Bauteil behalten“. Bauteile gibt es in jeder Welt.'), 'dim');
    for (const it of items.slice(0, 40)) {
      const d = document.createElement('div'); d.className = 'design' + (WB.clip && WB.clip.libId === it.id ? ' on' : '');
      d.innerHTML = `<span class="ic">🧩</span><span class="n">${esc(it.name)}<small>${it.sx} × ${it.sy} × ${it.sz}</small></span><button class="cbtn mini x" title="${esc(L('wb.libDel', 'Löschen'))}">✕</button>`;
      d.onclick = (e) => { if (e.target.classList.contains('x')) return; const c = libClip(it); c.libId = it.id; setClip(c); setTool('paste'); };
      d.querySelector('.x').onclick = (e) => { e.stopPropagation(); if (!d.dataset.sure) { d.dataset.sure = 1; e.target.textContent = '?'; setTimeout(() => { if (d.isConnected) { delete d.dataset.sure; e.target.textContent = '✕'; } }, 2500); return; } libSave(libLoad().filter(x => x.id !== it.id)); C.parts(); };
      el.appendChild(d);
    }
    note(L('wb.how', 'Alles hier landet sofort im Spiel, sobald die Welt dort offen ist — mit seinem eigenen Rückgängig (/undo). Was die Welt noch nicht hat, zeigt die Werkbank trotzdem schon.'), 'dim');
  }
  function hud() {
    const B = selBox(), hv = WB.hover;
    $('#hudName').textContent = '🧰 ' + WM.world.name;
    $('#hudMeta').innerHTML = `${esc(L(TOOLS.find(t => t[0] === WB.tool)[2], TOOLS.find(t => t[0] === WB.tool)[3]))}` + (B ? ` · ⬚ <b>${B[3] - B[0] + 1}×${B[4] - B[1] + 1}×${B[5] - B[2] + 1}</b>` : '') + (WB.pendingN ? ` · <span class="warn">⏳ ${WB.pendingN}</span>` : '') + (hv ? ` · <span class="dim">${esc(nameOf(R.types[T.type[hv.state]].name))} ${hv.x} · ${hv.y} · ${hv.z}</span>` : '');
  }
  let laterT = 0;
  function later() { clearTimeout(laterT); laterT = setTimeout(() => { countPending(true); if (active()) { C.parts(); C.hud(); } }, 200); }
  function redraw() {
    if (!active()) return;
    const el = $('#list'); const key = WB.cat + '|' + (S.filter || ''); if (el) el.classList.toggle('still', key === WB.listKey); WB.listKey = key;
    C.chips(); C.list(); C.parts(); C.hud(); drawTools(); drawBar(); help();
  }

  // ---------------------------------------------------------------- input
  function SW(name, fn) {
    const prev = HOOK[name];
    HOOK[name] = function (...a) { if (active()) { const r = fn.apply(null, a); if (r !== false) return r; } return prev ? prev.apply(null, a) : false; };
  }
  let ptr = null;
  function hover(e) {
    const hit = pick(WM.rayFromMouse(e));
    WB.hover = hit;
    if (WB.tool === 'paste') WB.ghostAt = hit ? pasteAt(hit) : null;
    C.hud();
  }
  SW('pointer', function (e, type) {
    const cv = C.view();
    if (type === 'down') {
      ptr = { x: e.clientX, y: e.clientY, b: e.button, shift: e.shiftKey, moved: false, view: e.button === 2 || e.shiftKey && e.button !== 0 };
      try { cv.setPointerCapture(e.pointerId); } catch (er) { /* */ }
      if (e.button === 0 && WB.tool === 'brush' && !e.shiftKey) { hover(e); if (WB.hover) { WB.stroke = { cells: new Map(), undo: new Map(), last: null }; brushAt(WB.hover); WB.stroke.last = [WB.hover.x, WB.hover.y, WB.hover.z]; } }
      return true;
    }
    if (type === 'move') {
      if (!ptr) { hover(e); return true; }
      const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y;
      if (WB.stroke && ptr.b === 0) {
        hover(e); const h = WB.hover;
        if (h && (!WB.stroke.last || Math.hypot(h.x - WB.stroke.last[0], h.y - WB.stroke.last[1], h.z - WB.stroke.last[2]) >= Math.max(1, WB.brush.r * 0.6))) { brushAt(h); WB.stroke.last = [h.x, h.y, h.z]; }
        return true;
      }
      if (!ptr.moved && Math.hypot(dx, dy) < 6) return true;
      ptr.moved = true; ptr.x = e.clientX; ptr.y = e.clientY;
      if (ptr.shift || ptr.b === 1) C.CAM.pan(dx, dy); else C.CAM.rotate(dx, dy);
      return true;
    }
    if (type === 'up') {
      const p0 = ptr; ptr = null;
      if (WB.stroke) { strokeEnd(); hover(e); return true; }
      if (p0 && !p0.moved) { hover(e); click(p0.b, p0.shift); }
      return true;
    }
    if (type === 'leave') { WB.hover = null; WB.ghostAt = null; if (WB.stroke) strokeEnd(); }
    return true;
  });
  function click(b, shift) {
    const h = WB.hover;
    if (WB.tool === 'build') {
      if (!h) return;
      if (b === 0) { const t = R.types[T.type[h.state]], out = [[h.x, h.y, h.z, 0]].concat(partners(h.x, h.y, h.z, h.state).map(p => [p[0], p[1], p[2], 0])); edit(out, '⛏ ' + nameOf(t ? t.name : '')); }
      else if (b === 2) {
        const t = heldState(); if (!t) { tip(L('wb.noBlock', 'Wähle unten einen Block'), false); return; }
        let x = h.x, y = h.y, z = h.z; const cur = h.state;
        if (!(T.flags[cur] & F.REPLACE)) { x += DX[h.face]; y += DY[h.face]; z += DZ[h.face]; }
        const tgt = WM.getBlock(x, y, z); if (tgt && !(T.flags[tgt] & (F.REPLACE | F.FLUID))) return;
        const cam = C.camFor(S.scene, S.cam, 1, 1), eye = cam.eye, tg = cam.target, yaw = Math.atan2(-(tg[0] - eye[0]), -(tg[2] - eye[2])), pitch = Math.atan2(tg[1] - eye[1], Math.hypot(tg[0] - eye[0], tg[2] - eye[2]));
        let out = null;
        const ms = VR.Place.slabMerge ? VR.Place.slabMerge(t, cur, h.face, h.py - h.y) : -1;
        if (ms >= 0) { edit([[h.x, h.y, h.z, ms]], '▣ ' + nameOf(t.name)); return; }
        try { out = VR.Place.compute(t, { world: { getBlock: (a, b2, c) => WM.getBlock(a, b2, c) }, face: h.face, fx: h.px - h.x, fy: h.py - h.y, fz: h.pz - h.z, yaw, pitch, x, y, z }); } catch (er) { out = [{ x, y, z, state: t.defaultState }]; }
        if (!out || !out.length) { tip(L('wb.noFit', 'Passt hier nicht hin'), false); return; }
        edit(out.map(o => [o.x, o.y, o.z, o.state]), '▣ ' + nameOf(t.name));
      } else if (b === 1) takeBlock(h);
      return;
    }
    if (WB.tool === 'select') {
      if (b === 2) { WB.sel = null; WB.mask = null; WB.from = null; C.parts(); C.hud(); help(); return; }
      if (b !== 0 || !h) return;
      const p = [h.x, h.y, h.z];
      if (!WB.sel || WB.sel.b || shift) { if (shift && WB.sel && WB.sel.a) { WB.sel.b = p; } else WB.sel = { a: p, b: null, dy: 0 }; }
      else { WB.sel.b = p; WB.sel.dy = 0; }
      WB.mask = null; WB.from = null;
      C.parts(); C.hud(); help();
      return;
    }
    if (WB.tool === 'wand') {
      if (b === 2) { WB.sel = null; WB.mask = null; WB.from = null; C.parts(); C.hud(); return; }
      if (b === 0 && h) { wand(h, shift); WB.from = null; C.parts(); C.hud(); }
      return;
    }
    if (WB.tool === 'brush') { if (b === 2 && h) takeBlock(h); return; }
    if (WB.tool === 'paste') {
      if (b === 2) { turnClip(WB.clip); if (WB.hover) WB.ghostAt = pasteAt(WB.hover); return; }
      if (b === 0 && h) paste(pasteAt(h));
    }
  }
  // the other cells of a piece (door halves, tall plants, both halves of a bed, every part of a furniture model)
  function partners(x, y, z, s) {
    const t = R.types[T.type[s]], out = [];
    if (!t) return out;
    if (t.o.kind === 'door' || (t.o.tall && t.has('half'))) { const oy = t.get(s, 'half') ? -1 : 1; if (T.type[WM.getBlock(x, y + oy, z)] === t.id) out.push([x, y + oy, z]); }
    if (t.has('part') && VM.MODELS[t.name]) {
      const f = t.get(s, 'facing'), pi = t.get(s, 'part'), fp = VM.footprint(VM.MODELS[t.name], f), me = fp.find(o => o[3] === pi) || [0, 0, 0, 0];
      for (const [dx, dy, dz] of fp) { const bx = x - me[0] + dx, by = y - me[1] + dy, bz = z - me[2] + dz; if ((bx !== x || by !== y || bz !== z) && T.type[WM.getBlock(bx, by, bz)] === t.id) out.push([bx, by, bz]); }
    }
    if (t.o.kind === 'bed') { const f = t.get(s, 'facing'), head = t.get(s, 'part'), d = head ? -1 : 1, ox = x + VR.HF_DX[f] * d, oz = z + VR.HF_DZ[f] * d; if (T.type[WM.getBlock(ox, y, oz)] === t.id) out.push([ox, y, oz]); }
    return out;
  }
  function takeBlock(h) {
    const t = R.types[T.type[h.state]]; if (!t || t.o.noItem) return;
    hot()[slot()] = t.name; drawBar(); C.list(); tip('◉ ' + nameOf(t.name), true);
  }
  SW('key', function (e, down) {
    if (!down) return false;
    const k = e.key.toLowerCase(), ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && k === 'z') { undo(e.shiftKey); return true; }
    if (ctrl && k === 'y') { undo(true); return true; }
    if (ctrl && k === 'c') { copy(false); return true; }
    if (ctrl && k === 'x') { copy(true); return true; }
    if (ctrl && k === 'v') { setTool('paste'); return true; }
    if (ctrl || e.altKey) return false;
    if (k >= '1' && k <= '9') { CRF().slot = +k - 1; drawBar(); C.list(); C.parts(); return true; }
    if (k === 'b') { setTool('build'); return true; }
    if (k === 'u') { setTool('select'); return true; }
    if (k === 'z') { setTool('wand'); return true; }
    if (k === 'p') { setTool('brush'); return true; }
    if (k === 'v') { setTool('paste'); return true; }
    if (k === 'escape') { if (WB.tool === 'paste') setTool('build'); else if (WB.sel) { WB.sel = null; WB.mask = null; C.parts(); C.hud(); } return true; }
    if (k === '[' || k === ']') { WB.brush.r = Math.max(1, Math.min(10, WB.brush.r + (k === ']' ? 1 : -1))); drawTools(); return true; }
    if (WB.tool === 'paste' && WB.clip) {
      if (k === 'r') { turnClip(WB.clip); if (WB.hover) WB.ghostAt = pasteAt(WB.hover); return true; }
      if (k === 'm') { mirrorClip(WB.clip); return true; }
      if (k === 'pageup' || k === 'pagedown') { WB.pasteDy = (WB.pasteDy || 0) + (k === 'pageup' ? 1 : -1); if (WB.hover) WB.ghostAt = pasteAt(WB.hover); tip(L('wb.lift', 'Höhe {n}', { n: (WB.pasteDy > 0 ? '+' : '') + WB.pasteDy }), true); return true; }
    }
    if (WB.sel && (k === 'pageup' || k === 'pagedown')) { WB.sel.dy = (WB.sel.dy || 0) + (k === 'pageup' ? 1 : -1); WB.mask = null; C.parts(); C.hud(); return true; }
    if (WB.sel) {
      if (k === 'f') { op('fill'); return true; }
      if (k === 'g') { op('replace'); return true; }
      if (k === 'h') { op('hollow'); return true; }
      if (k === 'j') { op('walls'); return true; }
      if (k === 'delete' || k === 'backspace') { op('clear'); return true; }
    }
    if (k === 'r' || k === 'f' || k === 'delete' || k === 'backspace') return true;   // the plan's keys do nothing here
    return false;   // WASD / Q / E: the Welt mode flies
  });
  SW('list', function () { const el = $('#list'); el.innerHTML = ''; el.classList.remove('houses'); el.classList.add('palette'); listBlocks(el); return true; });
  SW('parts', function () { panel(); return true; });
  SW('hud', function () { hud(); return true; });
  SW('dblclick', function () { return true; });   // clicks edit here: no fly-to
  // the overlay: the hovered block, where a block would go, the selection, the brush
  const box12 = (b, c, out) => {
    const [x0, y0, z0, x1, y1, z1] = b, P = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]];
    for (const [a, d] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) out.push(...P[a], ...P[d], c[0], c[1], c[2]);
  };
  SW('overlay', function (sc, eye, vp) {
    if (sc.type !== 'world') return false;
    const segs = [], h = WB.hover, e = 0.004;
    if (h && WB.tool !== 'paste') box12([h.x - e, h.y - e, h.z - e, h.x + 1 + e, h.y + 1 + e, h.z + 1 + e], [1, 1, 1], segs);
    if (h && WB.tool === 'build') { const cur = h.state, ax = (T.flags[cur] & F.REPLACE) ? h.x : h.x + DX[h.face], ay = (T.flags[cur] & F.REPLACE) ? h.y : h.y + DY[h.face], az = (T.flags[cur] & F.REPLACE) ? h.z : h.z + DZ[h.face]; box12([ax + 0.03, ay + 0.03, az + 0.03, ax + 0.97, ay + 0.97, az + 0.97], [0.36, 1, 0.8], segs); }
    const B = selBox();
    if (B) box12([B[0] - 0.02, B[1] - 0.02, B[2] - 0.02, B[3] + 1.02, B[4] + 1.02, B[5] + 1.02], WB.mask ? [0.75, 0.5, 1] : [1, 0.84, 0.25], segs);
    if (WB.sel && WB.sel.a && !WB.sel.b) { const a = WB.sel.a; box12([a[0] - 0.05, a[1] - 0.05, a[2] - 0.05, a[0] + 1.05, a[1] + 1.05, a[2] + 1.05], [1, 0.5, 0.15], segs); }
    if (h && WB.tool === 'brush') {
      const r = WB.brush.r + 0.5, cx = h.x + 0.5, cy = h.y + 1.02, cz = h.z + 0.5, n = 32, c = [0.36, 0.95, 1];
      for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2; segs.push(cx + Math.cos(a0) * r, cy, cz + Math.sin(a0) * r, cx + Math.cos(a1) * r, cy, cz + Math.sin(a1) * r, ...c); }
    }
    if (WB.tool === 'paste' && WB.ghostAt && WB.clip) { const a = WB.ghostAt, c = WB.clip; box12([a[0], a[1], a[2], a[0] + c.sx, a[1] + c.sy, a[2] + c.sz], [0.36, 1, 1], segs); }
    if (segs.length) C.drawLines(segs, vp, eye, true);
    return false;   // the region's edge and the plans (Welt mode) as well
  });
  // every tab of the Welt mode: what the game has not built yet, and whether it has
  const prevTick = HOOK.tick;
  HOOK.tick = function () { if (WM.on && S.mode === 'world' && WM.world) { regionCheck(); countPending(false); } return prevTick ? prevTick() : false; };
  let texReady = false;
  (function watch() {
    const on = active();
    if (!texReady && C.texInfo && C.texInfo()) { texReady = true; if (on) { drawBar(); C.parts(); } }
    if (on !== WB.inTab) {
      WB.inTab = on;
      const st = $('#studio'); if (st) st.classList.toggle('benching', on);
      if (on) { WM.tool = null; WM.ghost = null; WM.sel = null; WB.listKey = ''; redraw(); }
      else { WB.hover = null; WB.ghostAt = null; drawTools(); drawBar(); help(); }
    }
    requestAnimationFrame(watch);
  })();
  Object.assign(WB, { edit, undoStep: undo, op, copy, paste, pasteAt, turnClip, mirrorClip, wand, pick, selBox, setTool, libAdd, libLoad, KEEP, brushAt, strokeEnd });
})();
