// ============================================================================
// R9 Studio · Welt → 🎨 Stil (v0.34): how a whole world looks.
// Point at anything the world built itself — a house wall, a roof, a tree, the
// ground, the water: everything of that kind in the region lights up. Click it,
// then pick what it should be instead (left: the best matches first, every block
// below; for water also a colour). The region shows it at once; "⬆ In die Welt"
// hands the rules to the game, which changes everything it generated — what the
// player built stays exactly as it is. With friends in the world only the rules
// for houses, furniture, items and trees count (👥); ground and water rules (👤)
// wait until you play alone again. Nothing is final before "In die Welt", and
// Strg+Z takes every step back.
// ============================================================================
(function () {
  'use strict';
  const C = window.__studioCore, WM = VR.StudioWorld, WS = VR.WorldStyle;
  if (!C || !WM || !WS) return;
  const { S, HOOK, $ } = C;
  const R = VR.R, T = R.T, F = VR.F, PH = VR.PHYS, VM = VR.VM;
  const L = (k, de, v) => (VR.I18N && VR.I18N.t ? VR.I18N.t(k, v, de) : String(de).replace(/\{(\w+)\}/g, (m, x) => (v && v[x] !== undefined ? v[x] : m)));
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const CRF = () => VR.Crafter || {};
  const nameOf = (n) => { const f = CRF().nameOf; return f ? f(n) : ((R.byName[n] && R.byName[n].display) || n); };
  const DRAFT_KEY = (id) => 'r9si.styledraft.' + id;
  const ST = WM.st = { draft: null, from: null, hov: null, undo: [], redo: [], counts: null, y0: 0, busy: null, shown: '', region: null, glow: null, glowKey: '', glowGen: 0, glowT: 0, confirm: 0, mx: 0, my: 0, inTab: false, listKey: '' };
  WM.styleUI = true;

  const active = () => WM.on && S.mode === 'world' && !!WM.world && WM.tab === 'style';
  const saved = () => ({ rules: (WM.style && WM.style.rules) || [], water: (WM.style && WM.style.water) || null });
  const cur = () => ST.draft || saved();
  const sigOf = (st) => JSON.stringify([st.rules || [], st.water || null]);
  const ruleOf = (from) => { const r = cur().rules.find(x => x[0] === from); return r ? r[1] : null; };
  const typeName = (s) => (s ? R.types[T.type[s]].name : 'air');
  const isWater = (t) => !!(t && (T.flags[t.defaultState] & (F.FLUID | F.WATER)) && !(T.flags[t.defaultState] & F.LAVA));

  // ---------------------------------------------------------------- what kind of thing a block is (the list's groups)
  const GROUPS = [['build', '🏠', 'ws.g.build', 'Häuser & Wege'], ['tree', '🌳', 'ws.g.tree', 'Bäume & Pflanzen'], ['ground', '⛰', 'ws.g.ground', 'Boden & Stein'], ['water', '💧', 'ws.g.water', 'Wasser']];
  function groupOf(t) {
    const fl = T.flags[t.defaultState];
    if (fl & (F.FLUID | F.WATER | F.LAVA)) return 'water';
    if (/log$|_wood$|leaves$|sapling$|_stem$|hyphae$|mushroom_block$|_roots$|vine/.test(t.name) || (fl & (F.PLANT | F.LEAVES))) return 'tree';
    if (!WS.mpOK(t)) return 'ground';
    return 'build';
  }
  const solo = (from, to) => WS.check(from, to, true) === 'mp';   // a rule that waits while friends are in the world

  // ---------------------------------------------------------------- the draft: every change can be taken back
  function setDraft(next, label) {
    const before = JSON.stringify(cur()), n = { rules: (next.rules || []).slice(), water: next.water || null };
    if (JSON.stringify(n) === before) return;
    ST.undo.push(before); if (ST.undo.length > 100) ST.undo.shift(); ST.redo = [];
    applyDraft(n);
    if (label) WM.tipW(label, true);
  }
  function applyDraft(n) {
    ST.draft = sigOf(n) === sigOf(saved()) ? null : n;
    WM.styleDraft = ST.draft;
    try { if (ST.draft) localStorage.setItem(DRAFT_KEY(WM.world.id), JSON.stringify(ST.draft)); else localStorage.removeItem(DRAFT_KEY(WM.world.id)); } catch (e) { C.full('style'); /* the draft stays in memory */ }
    ST.glowKey = '';
    redraw();
  }
  function undo(redo) {
    const a = redo ? ST.redo : ST.undo, b = redo ? ST.undo : ST.redo, s = a.pop(); if (!s) return;
    b.push(JSON.stringify(cur())); applyDraft(JSON.parse(s));
    WM.tipW(redo ? L('ws.redo', 'Wiederholt') : L('ws.undo', 'Rückgängig'), true);
  }
  function setRule(from, to) {
    const c = cur(), rules = c.rules.filter(r => r[0] !== from);
    if (to) {
      const why = WS.check(from, to);
      if (why) { WM.tipW(why === 'parts' ? L('ws.no.parts', 'Passt nicht: das Möbel hat eine andere Größe') : why === 'shape' ? L('ws.no.shape', 'Passt nicht: Türen nur zu Türen, Betten zu Betten') : L('ws.no', 'Das geht nicht'), false); return; }
      rules.push([from, to]);
    }
    setDraft({ rules, water: c.water }, to ? '✓ ' + nameOf(from) + ' → ' + nameOf(to) : '↺ ' + nameOf(from) + ' · ' + L('ws.orig', 'Original'));
  }
  function setWater(hex) { const c = cur(); setDraft({ rules: c.rules, water: hex || null }, '💧 ' + (hex ? L('ws.w.set', 'Wasserfarbe') : L('ws.w.orig', 'Wasser wie im Original'))); }
  // into the world: the game takes it at once when the world is open there, otherwise when it opens
  function commit() {
    const c = cur(), st = WS.next(WM.style, c.rules, c.water);
    if (!WS.save(WM.world.id, st)) { C.full('style'); C.sys('⚠ ' + L('ws.saveFail2', 'Nicht in der Welt — der Browser-Speicher ist voll'), 'err'); WM.tipW(L('ws.saveFail2', 'Nicht in der Welt — der Browser-Speicher ist voll'), false); return; }
    WM.style = st; ST.draft = null; WM.styleDraft = null;
    try { localStorage.removeItem(DRAFT_KEY(WM.world.id)); } catch (e) { /* */ }
    C.sys(L('ws.done.sys', 'Welt-Stil übergeben — {n} Ersetzungen', { n: c.rules.length }), 'ok');
    WM.tipW(L('ws.done', '✓ In der Welt — was du gebaut hast, bleibt'), true);
    redraw();
  }
  // ▶ Spielen takes the preview along: into the world open here, or (another world) its stored preview → { n, ok }
  ST.keepNow = function (otherId) {
    if (!otherId) {
      if (!ST.draft || !WM.world) return { n: 0, ok: true };
      const c = cur(), st = WS.next(WM.style, c.rules, c.water);
      if (!WS.save(WM.world.id, st)) { C.full('style'); return { n: 0, ok: false }; }
      WM.style = st; ST.draft = null; WM.styleDraft = null;
      try { localStorage.removeItem(DRAFT_KEY(WM.world.id)); } catch (e) { /* */ }
      return { n: c.rules.length + (c.water ? 1 : 0), ok: true };
    }
    let d = null; try { d = JSON.parse(localStorage.getItem(DRAFT_KEY(otherId)) || 'null'); } catch (e) { d = null; }
    if (!d || !Array.isArray(d.rules)) return { n: 0, ok: true };
    const rules = d.rules.filter(r => Array.isArray(r) && !WS.check(r[0], r[1])), water = typeof d.water === 'string' ? d.water : null;
    if (!WS.save(otherId, WS.next(WS.load(otherId), rules, water))) { C.full('style'); return { n: 0, ok: false }; }
    try { localStorage.removeItem(DRAFT_KEY(otherId)); } catch (e) { /* */ }
    return { n: rules.length + (water ? 1 : 0), ok: true };
  };
  function resetAll() {
    if (ST.confirm > Date.now()) { ST.confirm = 0; setDraft({ rules: [], water: null }, '↺ ' + L('ws.reset.done', 'Alles wie im Original — ⬆ In die Welt übernimmt es')); return; }
    ST.confirm = Date.now() + 3000; C.parts(); setTimeout(() => { if (ST.confirm && ST.confirm <= Date.now()) { ST.confirm = 0; if (active()) C.parts(); } }, 3100);
  }

  // ---------------------------------------------------------------- the region: what each cell was made of
  // a cell that shows what the rules made of the generator's block reports that block (pointing at the new roof means
  // the roof — its rule can be changed); the worker sends those cells as [index, raw state] pairs
  function omOf(c) { if (!c.orig) return null; if (!c.om) { const m = new Map(), o = c.orig; for (let k = 0; k < o.length; k += 2) m.set(o[k], o[k + 1]); c.om = m; } return c.om; }
  function originAt(x, y, z) {
    const c = WM.cols.get((x >> 4) + ',' + (z >> 4)); if (!c || y < 0 || y >= c.H) return 0;
    const i = (y << 8) | ((z & 15) << 4) | (x & 15), om = omOf(c), o = om ? om.get(i) : undefined;
    return o !== undefined ? o : c.blocks[i];
  }
  // how much of every kind the region holds (by what it was made of), from a little below the lowest ground up
  function counts() {
    if (ST.counts) return ST.counts;
    if (!WM.cols.size || WM.loading) return null;
    let minG = 1e9;
    for (const c of WM.cols.values()) { const g = WM.groundAt(c.cx * 16 + 8, c.cz * 16 + 8); if (g !== null && g < minG) minG = g; }
    ST.y0 = Math.max(0, (minG === 1e9 ? 0 : minG) - 24);
    const n = new Uint32Array(R.types.length), s0 = ST.y0 << 8;
    for (const c of WM.cols.values()) {
      const b = c.blocks; for (let i = s0; i < b.length; i++) { const s = b[i]; if (s) n[T.type[s]]++; }
      const o = c.orig; if (o) for (let k = 0; k < o.length; k += 2) { const i = o[k]; if (i < s0) continue; n[T.type[b[i]]]--; n[T.type[o[k + 1]]]++; }
    }
    return (ST.counts = n);
  }
  // the mouse finds everything here (leaves, plants and water too — trees and water are part of the style)
  function pickAny(ray) {
    const B = WM.regionBox(); if (!B) return null;
    const [ox, oy, oz] = ray.o, [dx, dy, dz] = ray.d;
    const e = PH.rayBox(ox, oy, oz, dx, dy, dz, B, 0, 0, 0); if (!e) return null;
    const t0 = Math.max(0, e[0]) + 1e-4;
    let px = ox + dx * t0, py = oy + dy * t0, pz = oz + dz * t0;
    let x = Math.floor(px), y = Math.floor(py), z = Math.floor(pz);
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const tdx = Math.abs(1 / dx), tdy = Math.abs(1 / dy), tdz = Math.abs(1 / dz);
    let tx = (dx > 0 ? (x + 1 - px) : (px - x)) * tdx, ty = (dy > 0 ? (y + 1 - py) : (py - y)) * tdy, tz = (dz > 0 ? (z + 1 - pz) : (pz - z)) * tdz;
    for (let i = 0; i < 4000; i++) {
      if (x < B[0] || z < B[2] || x >= B[3] || z >= B[5] || y < -1 || y > 520) return null;
      const s = WM.getBlock(x, y, z);
      if (s && !(T.flags[s] & F.INVISIBLE)) return { x, y, z, state: s };
      if (tx < ty && tx < tz) { x += sx; tx += tdx; } else if (ty < tz) { y += sy; ty += tdy; } else { z += sz; tz += tdz; }
    }
    return null;
  }

  // ---------------------------------------------------------------- the glow: everything of the pointed-at kind nearby
  const RAD = 40, MAXQ = 9000;
  function faceQuad(x, y, z, d, e, out, c) {
    const X0 = x - (d === 1 ? e : 0), X1 = x + 1 + (d === 0 ? e : 0), Y0 = y - (d === 3 ? e : 0), Y1 = y + 1 + (d === 2 ? e : 0), Z0 = z - (d === 5 ? e : 0), Z1 = z + 1 + (d === 4 ? e : 0);
    if (d === 0) out.push(X1, Y0, Z0, X1, Y1, Z0, X1, Y1, Z1, X1, Y0, Z1);
    else if (d === 1) out.push(X0, Y0, Z0, X0, Y0, Z1, X0, Y1, Z1, X0, Y1, Z0);
    else if (d === 2) out.push(X0, Y1, Z0, X0, Y1, Z1, X1, Y1, Z1, X1, Y1, Z0);
    else if (d === 3) out.push(X0, Y0, Z0, X1, Y0, Z0, X1, Y0, Z1, X0, Y0, Z1);
    else if (d === 4) out.push(X0, Y0, Z1, X1, Y0, Z1, X1, Y1, Z1, X0, Y1, Z1);
    else out.push(X0, Y0, Z0, X0, Y1, Z0, X1, Y1, Z0, X1, Y0, Z0);
    out.push(c[0], c[1], c[2]);
  }
  function glowQuads(name, ctr, col) {
    const t = R.byName[name]; if (!t) return [];
    const ft = t.id, tg = ruleOf(name), tt = tg && R.byName[tg] ? R.byName[tg].id : -1;
    const faces = [], y0 = ST.y0 || 0;
    for (let cz = Math.floor((ctr[2] - RAD) / 16); cz <= Math.floor((ctr[2] + RAD) / 16); cz++) for (let cx = Math.floor((ctr[0] - RAD) / 16); cx <= Math.floor((ctr[0] + RAD) / 16); cx++) {
      const c = WM.cols.get(cx + ',' + cz); if (!c) continue;
      const b = c.blocks, om = omOf(c);
      for (let i = y0 << 8; i < b.length; i++) {
        const s = b[i]; if (!s) continue;
        const ty = T.type[s]; if (ty !== ft && ty !== tt) continue;
        if (om) { const o = om.get(i); if ((o !== undefined ? T.type[o] : ty) !== ft) continue; } else if (ty !== ft) continue;
        const x = cx * 16 + (i & 15), z = cz * 16 + ((i >> 4) & 15), y = i >> 8, dx = x - ctr[0], dz = z - ctr[2], d2 = dx * dx + dz * dz;
        if (d2 > RAD * RAD) continue;
        for (let d = 0; d < 6; d++) {
          const n = WM.getBlock(x + VR.DX[d], y + VR.DY[d], z + VR.DZ[d]);
          if (n && ((T.flags[n] & F.OPAQUE) || T.type[n] === ty)) continue;
          faces.push(d2 + (y - ctr[1]) * (y - ctr[1]), x, y, z, d);
        }
      }
    }
    let n = faces.length / 5, keep = null;
    if (n > MAXQ) { const ds = new Float64Array(n); for (let k = 0; k < n; k++) ds[k] = faces[k * 5]; ds.sort(); keep = ds[MAXQ - 1]; }
    const q = [];
    for (let k = 0; k < faces.length; k += 5) { if (keep !== null && faces[k] > keep) continue; faceQuad(faces[k + 1], faces[k + 2], faces[k + 3], faces[k + 4], 0.012, q, col); }
    return q;
  }
  function freeGlow() { if (ST.glow) C.freeQuadMesh(ST.glow); ST.glow = null; }
  function glowTick() {
    const now = performance.now(); if (now - ST.glowT < 90) return;
    const name = ST.from || (ST.hov && ST.hov.name);
    if (!name || !counts()) { if (ST.glow) { freeGlow(); ST.glowKey = ''; } return; }
    const ctr = ST.from ? (S.scene && S.scene.center) : [ST.hov.x, ST.hov.y, ST.hov.z]; if (!ctr) return;
    const key = name + '|' + (ST.from ? 'F' : 'H') + '|' + Math.round(ctr[0] / 10) + ',' + Math.round(ctr[2] / 10) + '|' + ST.glowGen + '|' + (ruleOf(name) || '');
    if (key === ST.glowKey) return;
    ST.glowKey = key; ST.glowT = now;
    freeGlow();
    const q = glowQuads(name, ctr, ST.from ? [1, 0.78, 0.22] : [0.3, 0.95, 1]);
    ST.glow = q.length ? C.quadMesh(q) : null;
  }

  // ---------------------------------------------------------------- the preview: the region with the draft
  // The worker re-styles the region it keeps (raw generation + saved columns) and meshes it again, centre first; the
  // page swaps a column's sections as soon as its new ones arrive (the old view stays up until then).
  function preview() {
    const meta = WM.world, region = WM.region, c = cur(), sig = sigOf(c);
    const style = WS.next(WM.style, c.rules, c.water);
    const old = new Set(WM.gpu), fresh = new Set();
    const busy = ST.busy = { sig, done: 0, total: 1 };
    const stale = () => WM.world !== meta || WM.region !== region;
    const drop = (k) => {
      const gone = [], keep = [];
      for (const g of WM.gpu) { if (old.has(g) && ((g.ox >> 4) + ',' + (g.oz >> 4)) === k) { gone.push(g); old.delete(g); } else keep.push(g); }
      if (gone.length) { C.freeSections(gone); WM.gpu.length = 0; for (const g of keep) WM.gpu.push(g); }
    };
    const take = (m) => {
      if (stale()) return;
      if (m.cols && m.cols.length) {
        for (const cc of m.cols) { const col = WM.cols.get(cc.cx + ',' + cc.cz); if (col) { col.blocks = cc.blocks; col.H = cc.blocks.length >> 8; col.orig = cc.orig || null; col.om = null; } }
        ST.counts = null; ST.glowGen++;
      }
      if (m.sections && m.sections.length) for (const g of C.uploadSections(m.sections)) { const k = (g.ox >> 4) + ',' + (g.oz >> 4); if (!fresh.has(k)) { fresh.add(k); drop(k); } WM.gpu.push(g); }
      if (m.total) { busy.done = m.done; busy.total = m.total; }
      if (active()) C.hud();
    };
    C.callP({ type: 'world_restyle', style }, take).then((fin) => {
      take(fin);
      if (!stale()) {
        if (old.size) { C.freeSections([...old]); const keep = WM.gpu.filter(g => !old.has(g)); WM.gpu.length = 0; for (const g of keep) WM.gpu.push(g); }
        ST.shown = sig;
      }
      if (ST.busy === busy) ST.busy = null;
      ST.counts = null; ST.glowGen++;
      if (active()) redraw(); else C.hud();
    });
  }
  // a region read anew (another world, "neu laden"): its draft comes back from the browser
  function enterRegion() {
    ST.region = WM.region; ST.from = null; ST.hov = null; ST.undo = []; ST.redo = []; ST.counts = null; ST.busy = null; ST.glowGen++; freeGlow(); ST.glowKey = '';
    ST.shown = sigOf(saved());
    let d = null; try { const t = localStorage.getItem(DRAFT_KEY(WM.world.id)); d = t ? JSON.parse(t) : null; } catch (e) { d = null; }
    ST.draft = d && Array.isArray(d.rules) ? { rules: d.rules.filter(r => Array.isArray(r) && !WS.check(r[0], r[1])), water: typeof d.water === 'string' ? d.water : null } : null;
    if (ST.draft && sigOf(ST.draft) === sigOf(saved())) ST.draft = null;
    WM.styleDraft = ST.draft;
  }
  function pump() {
    if (ST.region !== WM.region) { if (WM.loading) return; enterRegion(); if (active()) redraw(); }
    if (!WM.loading && !ST.busy && ST.shown !== sigOf(cur())) preview();
    if (active()) {
      if (!ST.counts && !WM.loading && WM.cols.size) { counts(); redraw(); }
      glowTick();
    }
  }

  // ---------------------------------------------------------------- icons (painted a few per frame)
  const iconQ = [];
  function queueIcon(cv, id, sz) { iconQ.push([cv, id, sz || 48]); }
  (function pumpIcons() {
    let n = 0;
    while (iconQ.length && n < 20) {
      const [cv, id, sz] = iconQ[0]; if (!cv.isConnected) { iconQ.shift(); continue; }
      const f = CRF().iconOf, ic = f ? f(id) : null;
      if (!ic && !C.texInfo()) break;       // the textures are not forged yet: wait
      iconQ.shift();
      if (ic) { const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.clearRect(0, 0, sz, sz); x.drawImage(ic, 0, 0, sz, sz); }
      n++;
    }
    requestAnimationFrame(pumpIcons);
  })();
  // a few icons right away (the rules, the badge): the list's hundreds go through the queue
  function paintNow(cv, id, sz) { const f = CRF().iconOf, ic = f ? f(id) : null; if (!ic) { queueIcon(cv, id, sz); return; } const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.clearRect(0, 0, sz, sz); x.drawImage(ic, 0, 0, sz, sz); }
  const short = (n) => n >= 10000 ? Math.round(n / 1000) + 'k' : n >= 1000 ? (n / 1000).toFixed(1).replace('.0', '') + 'k' : String(n);
  function tile(name, o) {
    const d = document.createElement('div'); d.className = 'tile' + (o.on ? ' on' : '') + (o.orig ? ' orig' : '');
    d.dataset.id = name; d.title = nameOf(name) + (o.title ? '\n' + o.title : '');
    const cv = document.createElement('canvas'); cv.width = cv.height = 48; d.appendChild(cv); queueIcon(cv, name);
    if (o.n !== undefined) { const b = document.createElement('i'); b.className = 'cnt'; b.textContent = short(o.n); d.appendChild(b); }
    if (o.to) { const t = document.createElement('canvas'); t.className = 'to'; t.width = t.height = 22; d.appendChild(t); queueIcon(t, o.to, 22); }
    if (o.orig) { const b = document.createElement('i'); b.className = 'back'; b.textContent = '↺'; d.appendChild(b); }
    if (o.solo) { const s = document.createElement('i'); s.className = 'solo'; s.textContent = '👤'; s.title = L('ws.mp0', 'nur wenn du allein spielst'); d.appendChild(s); }
    if (o.fn) d.onclick = o.fn;
    return d;
  }
  function grp(el, text, extra) { const g = document.createElement('div'); g.className = 'grp'; g.innerHTML = text + (extra ? ' <span class="tag">' + extra + '</span>' : ''); el.appendChild(g); }
  function note(el, html, cls) { const p = document.createElement('div'); p.className = 'note' + (cls ? ' ' + cls : ''); p.innerHTML = html; el.appendChild(p); }

  // ---------------------------------------------------------------- the left side: ① what · ② by what
  function listWhat(el) {
    const n = counts();
    note(el, '<b>①</b> ' + L('ws.step1', 'Zeig in der Welt auf etwas — oder wähle hier, was anders aussehen soll'), 'step');
    if (!n) { note(el, WM.loading ? L('ws.loading', 'Die Gegend lädt …') : '…', 'dim'); return; }
    const f = (S.filter || '').trim().toLowerCase(), by = { build: [], tree: [], ground: [], water: [] };
    for (let id = 1; id < n.length; id++) {
      if (!n[id]) continue;
      const t = R.types[id]; if (!t || t.name === 'air' || (T.flags[t.defaultState] & F.INVISIBLE)) continue;
      if (f && !(t.name.includes(f.replace(/ /g, '_')) || nameOf(t.name).toLowerCase().includes(f))) continue;
      by[groupOf(t)].push([t.name, n[id]]);
    }
    let any = false;
    for (const [g, ic, k, de] of GROUPS) {
      const arr = by[g]; if (!arr.length) continue; any = true;
      arr.sort((a, b) => b[1] - a[1]);
      grp(el, ic + ' ' + L(k, de), g === 'ground' || g === 'water' ? '👤 ' + L('ws.solo', 'nur allein') : '');
      for (const [name, cnt] of arr) el.appendChild(tile(name, { n: cnt, to: ruleOf(name), on: ST.from === name, fn: () => choose(name) }));
      if (g === 'water') el.appendChild(waterRow());
    }
    if (!any) note(el, L('ws.none', 'Nichts gefunden'), 'dim');
  }
  // the best matches: the same kind of block first (planks for planks, leaves for leaves, stairs for stairs …)
  let palette = null;
  function allTargets() {
    if (palette) return palette;
    palette = [];
    for (const t of R.types) {
      if (!t || !t.cat || t.o.noItem || t.o.cutOf || t.name === 'air') continue;
      if (t.has && t.has('part') && !VM.MODELS[t.name]) continue;
      palette.push(t);
    }
    return palette;
  }
  const lastTok = (n) => n.slice(n.lastIndexOf('_') + 1), firstTok = (n) => n.split('_')[0];
  function suggest(from) {
    const a = R.byName[from]; if (!a) return [];
    const fa = T.flags[a.defaultState], ka = a.o.kind || 'cube', la = lastTok(a.name), out = [];
    for (const b of allTargets()) {
      if (b === a || WS.check(from, b.name)) continue;
      const fb = T.flags[b.defaultState];
      if ((b.o.kind || 'cube') !== ka) continue;
      if (!!(fa & F.FULL) !== !!(fb & F.FULL) || !!(fa & (F.FLUID)) !== !!(fb & F.FLUID)) continue;
      let sc = 0;
      if (lastTok(b.name) === la) sc += 60;
      if (!!(fa & F.LEAVES) === !!(fb & F.LEAVES)) sc += 20; else sc -= 40;
      if (!!(fa & (F.TRANS | F.CUTOUT)) === !!(fb & (F.TRANS | F.CUTOUT))) sc += 20;
      if (a.cat && b.cat === a.cat) sc += 15;
      if (a.group && b.group === a.group) sc += 10;
      if (firstTok(b.name) === firstTok(a.name)) sc += 5;
      if (sc >= 40) out.push([sc, b.name]);
    }
    out.sort((x, y) => y[0] - x[0] || (x[1] < y[1] ? -1 : 1));
    return out.slice(0, 40).map(x => x[1]);
  }
  function listWith(el) {
    const from = ST.from, a = R.byName[from], to = ruleOf(from), soloFrom = !WS.mpOK(a);
    const back = document.createElement('div'); back.className = 'wsBack';
    back.innerHTML = '<button class="b">◂</button><canvas width="34" height="34"></canvas><span><b>' + esc(nameOf(from)) + '</b><small>' + (to ? '→ ' + esc(nameOf(to)) : L('ws.now', 'wie im Original')) + '</small></span>';
    back.querySelector('.b').onclick = () => choose(null); back.title = L('ws.back', 'Zurück (Esc)');
    el.appendChild(back); paintNow(back.querySelector('canvas'), from, 34);
    note(el, '<b>②</b> ' + L('ws.step2', 'Wähle, was es stattdessen sein soll — du siehst es sofort in der Welt'), 'step');
    if (soloFrom) note(el, '👤 ' + L('ws.soloNote', 'Boden und Wasser ändern sich nur, wenn du allein spielst'), 'dim');
    if (isWater(a)) { grp(el, '💧 ' + L('ws.color', 'Farbe')); el.appendChild(waterRow()); grp(el, L('ws.orBlock', 'oder ein Block')); }
    else grp(el, '✨ ' + L('ws.best', 'Passt gut'));
    el.appendChild(tile(from, { orig: true, on: !to, title: L('ws.keep', 'wie im Original'), fn: () => setRule(from, null) }));
    const f = (S.filter || '').trim().toLowerCase(), fq = f.replace(/ /g, '_'), seen = new Set([from]);
    const match = (n) => !f || n.includes(fq) || nameOf(n).toLowerCase().includes(f);
    for (const b of suggest(from)) { if (!match(b)) continue; seen.add(b); el.appendChild(tile(b, { on: to === b, solo: !soloFrom && solo(from, b), fn: () => setRule(from, b) })); }
    grp(el, L('ws.all', 'Alle Blöcke'));
    let k = 0;
    for (const t of allTargets()) {
      if (seen.has(t.name) || !match(t.name) || WS.check(from, t.name)) continue;
      el.appendChild(tile(t.name, { on: to === t.name, solo: !soloFrom && solo(from, t.name), fn: () => setRule(from, t.name) }));
      if (++k >= 600) break;
    }
  }
  function choose(name) {
    ST.from = name || null; ST.glowKey = '';
    redraw();
    const el = $('#list'); if (el) el.scrollTop = 0;
    if (name) WM.tipW(L('ws.pick', '{n}: wähle links, was es werden soll', { n: nameOf(name) }), true);
  }
  // water colours (the biome's own when none)
  const WATERS = [['#3f76e4', 'ws.w.clear', 'Klar'], ['#22b5d8', 'ws.w.turq', 'Türkis'], ['#14a08a', 'ws.w.lagoon', 'Lagune'], ['#4c8f3c', 'ws.w.swamp', 'Sumpf'], ['#6a52d8', 'ws.w.violet', 'Lila'], ['#d0479c', 'ws.w.pink', 'Pink'], ['#c8433a', 'ws.w.red', 'Rot'], ['#e0a530', 'ws.w.gold', 'Gold'], ['#1c2b44', 'ws.w.night', 'Nacht'], ['#dce9f0', 'ws.w.milk', 'Milch']];
  function waterRow() {
    const w = cur().water, row = document.createElement('div'); row.className = 'wsWater';
    const b0 = document.createElement('button'); b0.className = 'orig' + (!w ? ' on' : ''); b0.textContent = '↺'; b0.title = L('ws.w.orig', 'Wasser wie im Original'); b0.onclick = () => setWater(null); row.appendChild(b0);
    for (const [hex, k, de] of WATERS) { const b = document.createElement('button'); b.className = w === hex ? 'on' : ''; b.title = L(k, de); b.style.background = hex; b.onclick = () => setWater(hex); row.appendChild(b); }
    const inp = document.createElement('input'); inp.type = 'color'; inp.value = w || '#3f76e4'; inp.title = L('ws.w.own', 'Eigene Farbe'); inp.onchange = () => setWater(inp.value); row.appendChild(inp);
    return row;
  }

  // ---------------------------------------------------------------- the right side: the rules, the water, ⬆ In die Welt
  function panel() {
    const el = $('#partsBody'); el.innerHTML = ''; el.classList.remove('empty');
    const c = cur(), dirty = !!ST.draft;
    const H = (t, b) => { const d = document.createElement('div'); d.className = 'ph'; d.innerHTML = t + (b !== undefined ? ' <b>' + b + '</b>' : ''); el.appendChild(d); };
    const btn = (label, cls, fn, title) => { const b = document.createElement('button'); b.className = 'cbtn ' + (cls || ''); b.innerHTML = label; if (title) b.title = title; b.onclick = fn; return b; };
    const row = (...bs) => { const r = document.createElement('div'); r.className = 'crow'; for (const b of bs) r.appendChild(b); el.appendChild(r); };
    H('🎨 ' + L('ws.title', 'Stil der Welt'), esc(WM.world.name));
    // the three steps, the one you are at lit
    const step = ST.from ? 2 : dirty ? 3 : 1;
    const steps = document.createElement('div'); steps.className = 'wsSteps';
    steps.innerHTML = [['👆', L('ws.s1', 'Zeigen')], ['🧱', L('ws.s2', 'Neues wählen')], ['⬆', L('ws.s3', 'In die Welt')]].map(([i, t], k) => `<span class="${k + 1 === step ? 'on' : k + 1 < step ? 'done' : ''}"><i>${i}</i>${t}</span>`).join('<em>›</em>');
    el.appendChild(steps);
    row(btn('⬆ ' + L('ws.commit', 'In die Welt') + (dirty ? ' •' : ''), 'pri' + (dirty ? ' glow' : ''), commit, L('ws.commit.tip', 'Das Spiel übernimmt den Stil — sofort, wenn die Welt dort offen ist')));
    row(btn('⟲', '', () => undo(false), L('ws.undo', 'Rückgängig') + ' · Strg+Z'), btn('⟳', '', () => undo(true), L('ws.redo', 'Wiederholt') + ' · Strg+Y'), btn(ST.confirm > Date.now() ? '↺ ' + L('ws.reset.sure', 'Sicher? Nochmal klicken') : '↺ ' + L('ws.reset', 'Alles Original'), ST.confirm > Date.now() ? 'warnb' : '', resetAll));
    if (ST.busy) note(el, '⏳ ' + L('ws.busy', 'Vorschau wird gebaut … {p} %', { p: Math.round(100 * ST.busy.done / Math.max(1, ST.busy.total)) }), 'dim');
    if (dirty) note(el, L('ws.dirty', 'Das ist eine Vorschau. <b>⬆ In die Welt</b> übernimmt es ins Spiel.'), 'warn');
    note(el, L('ws.intro', 'Gilt für alles, was die Welt selbst baut: Häuser, Wege, Bäume, Boden, Wasser. <b>Was du gebaut hast, bleibt.</b>'));
    H(L('ws.rules', 'Deine Ersetzungen'), c.rules.length + (c.water ? 1 : 0));
    if (!c.rules.length && !c.water) note(el, L('ws.empty', 'Noch nichts — zeig in der Welt auf ein Dach, eine Wand, einen Baum oder das Wasser und klick.'), 'dim');
    for (const [g, ic] of GROUPS) {
      for (const [from, to] of c.rules) {
        const ft = R.byName[from]; if (!ft || groupOf(ft) !== g) continue;
        const r = document.createElement('div'); r.className = 'wsRule' + (ST.from === from ? ' on' : '');
        const mp = !solo(from, to);
        r.innerHTML = `<i class="g">${ic}</i><canvas width="28" height="28"></canvas><span class="ar">→</span><canvas width="28" height="28"></canvas><span class="n">${esc(nameOf(from))}<small>${esc(nameOf(to))}</small></span><i class="mp" title="${mp ? L('ws.mp1', 'gilt auch mit Freunden') : L('ws.mp0', 'nur wenn du allein spielst')}">${mp ? '👥' : '👤'}</i><button class="x" title="${L('ws.remove', 'Entfernen')}">✕</button>`;
        const cvs = r.querySelectorAll('canvas'); paintNow(cvs[0], from, 28); paintNow(cvs[1], to, 28);
        r.onclick = (e) => { if (e.target.classList.contains('x')) return; choose(from); };
        r.querySelector('.x').onclick = (e) => { e.stopPropagation(); setRule(from, null); };
        el.appendChild(r);
      }
    }
    H('💧 ' + L('ws.water', 'Wasserfarbe'));
    el.appendChild(waterRow());
    note(el, '👥 ' + L('ws.mp1', 'gilt auch mit Freunden') + ' · 👤 ' + L('ws.mp0', 'nur wenn du allein spielst'), 'dim');
  }
  function hud() {
    const c = cur(), hv = ST.hov;
    $('#hudName').textContent = '🎨 ' + WM.world.name;
    $('#hudMeta').innerHTML = `<b>${c.rules.length}</b> ${L('ws.hud.rules', 'Ersetzungen')}` + (c.water ? ' · 💧' : '') + (ST.busy ? ` · ${L('ws.hud.busy', 'Vorschau')} <b>${Math.round(100 * ST.busy.done / Math.max(1, ST.busy.total))} %</b>` : ST.draft ? ` · <span class="warn">${L('ws.hud.draft', 'Vorschau')}</span>` : '') + (hv ? ` · <span class="dim">${esc(nameOf(hv.name))}</span>` : '');
  }
  function redraw() {
    if (!WM.on || S.mode !== 'world') return;
    if (!active()) { C.chips(); C.hud(); return; }
    const key = (ST.from || '-') + '|' + (ST.counts ? 1 : 0);
    const el = $('#list'); if (el) el.classList.toggle('still', key === ST.listKey);
    ST.listKey = key;
    C.chips(); C.list(); C.parts(); C.hud();
  }

  // ---------------------------------------------------------------- the badge at the pointer
  function badge() {
    let b = $('#styleBadge'); if (!b) { b = document.createElement('div'); b.id = 'styleBadge'; $('main').appendChild(b); }
    const h = ST.hov, on = active() && !!h && !ptr;
    b.classList.toggle('on', on); if (!on) return;
    const to = ruleOf(h.name), n = ST.counts ? ST.counts[R.byName[h.name].id] : 0, key = h.name + '|' + (to || '') + '|' + n + '|' + (ST.from || '');
    if (b.dataset.k !== key) {
      b.dataset.k = key;
      b.innerHTML = `<canvas width="26" height="26"></canvas><b>${esc(nameOf(h.name))}</b>${n ? `<small>× ${short(n)}</small>` : ''}` + (to ? `<span class="ar">→</span><canvas width="26" height="26"></canvas><b>${esc(nameOf(to))}</b>` : `<span class="hint">${ST.from === h.name ? '✓' : L('ws.click', 'Klick: ändern')}</span>`) + (!WS.mpOK(R.byName[h.name]) ? '<i>👤</i>' : '');
      const cvs = b.querySelectorAll('canvas'); paintNow(cvs[0], h.name, 26); if (cvs[1]) paintNow(cvs[1], to, 26);
    }
    const r = $('main').getBoundingClientRect();
    b.style.left = Math.min(r.width - 260, ST.mx - r.left + 18) + 'px'; b.style.top = (ST.my - r.top + 16) + 'px';
  }
  function hover(e) {
    const hit = pickAny(WM.rayFromMouse(e));
    if (!hit) { ST.hov = null; badge(); C.hud(); return; }
    const o = originAt(hit.x, hit.y, hit.z) || hit.state;
    ST.hov = { x: hit.x, y: hit.y, z: hit.z, name: typeName(o) };
    badge(); C.hud();
  }

  // ---------------------------------------------------------------- hooks (on top of the Welt mode, while 🎨 Stil is the tab)
  function SW(name, fn) {
    const prev = HOOK[name];
    HOOK[name] = function (...a) { if (active()) { const r = fn.apply(null, a); if (r !== false) return r; } return prev ? prev.apply(null, a) : false; };
  }
  let ptr = null;
  SW('pointer', function (e, type) {
    const cv = C.view();
    ST.mx = e.clientX; ST.my = e.clientY;
    if (type === 'down') { ptr = { x: e.clientX, y: e.clientY, b: e.button, shift: e.shiftKey, moved: false }; try { cv.setPointerCapture(e.pointerId); } catch (er) { /* */ } badge(); return true; }
    if (type === 'move') {
      if (!ptr) { hover(e); return true; }
      const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y;
      if (!ptr.moved && Math.hypot(dx, dy) < 6) return true;
      ptr.moved = true; ptr.x = e.clientX; ptr.y = e.clientY;
      if (ptr.shift || ptr.b === 1) C.CAM.pan(dx, dy); else C.CAM.rotate(dx, dy);
      return true;
    }
    if (type === 'up') {
      const p0 = ptr; ptr = null;
      hover(e);
      if (p0 && !p0.moved) { if (p0.b === 0) { if (ST.hov) choose(ST.hov.name); } else if (p0.b === 2 && ST.from) choose(null); }
      return true;
    }
    if (type === 'leave') { ST.hov = null; badge(); }
    return true;
  });
  SW('key', function (e, down) {
    if (!down) return false;
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && k === 'z') { undo(e.shiftKey); return true; }
    if ((e.ctrlKey || e.metaKey) && k === 'y') { undo(true); return true; }
    if (k === 'escape') { if (ST.from) choose(null); return true; }
    if (k === 'r' || k === 'f' || k === 'delete' || k === 'backspace') return true;   // the plan's keys do nothing here
    return false;                                                                     // WASD / Q / E: the Welt mode flies
  });
  SW('list', function () { const el = $('#list'); el.innerHTML = ''; el.classList.remove('houses'); el.classList.add('palette'); if (ST.from) listWith(el); else listWhat(el); return true; });
  SW('parts', function () { panel(); return true; });
  SW('hud', function () { hud(); return true; });
  SW('overlay', function (sc, eye, vp) { if (sc.type === 'world' && ST.glow) C.drawQuadMesh(ST.glow, vp, eye, ST.from ? 0.42 : 0.32, 0); return false; });
  SW('dblclick', function () { return false; });
  // the preview runs in every tab of the Welt mode (a draft shows while you place houses too)
  const prevTick = HOOK.tick;
  HOOK.tick = function () { if (WM.on && S.mode === 'world' && WM.world && WM.region) pump(); return prevTick ? prevTick() : false; };
  // entering and leaving the tab
  (function watch() {
    const on = active();
    if (on !== ST.inTab) {
      ST.inTab = on;
      const st = $('#studio'); if (st) st.classList.toggle('styling', on);
      if (on) { WM.tool = null; WM.ghost = null; WM.sel = null; ST.listKey = ''; redraw(); }
      else { ST.hov = null; ST.from = null; freeGlow(); ST.glowKey = ''; }
      badge();
    }
    requestAnimationFrame(watch);
  })();
  Object.assign(WM, { styleCommit: commit, styleSetRule: setRule, styleSetWater: setWater, styleChoose: choose, styleUndo: undo, styleCounts: counts, styleSuggest: suggest, styleOriginAt: originAt });
})();
