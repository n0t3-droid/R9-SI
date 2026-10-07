// ============================================================================
// R9 Studio · 📍 Wo du landest & ▶ Spielen (v0.38)
// · Whatever you set into a world here (Werkbank, a house, the Genie, a place,
//   a handed-over plan) is noted as the newest thing, with a spot in front of it
//   to stand on and look at it from (VR.Landing).
// · 📍 in the World panel: a click on the ground is your spawn point.
// · In the view: 📍 your spawn point, 🧍 where you were last, ✨ the new thing.
// · ▶ Spielen (top bar, in the Studio that belongs to the game): opens the world
//   you are working on, directly — in front of the new thing, or at your spawn
//   point; over the open game it shows the new thing or lets you play on.
// ============================================================================
(function () {
  'use strict';
  const C = window.__studioCore; if (!C) return;
  const { S, HOOK, $ } = C;
  const R = VR.R, T = R.T, F = VR.F, LD = VR.Landing;
  const WM = VR.StudioWorld; if (!WM || !LD) return;
  const L = (k, de, v) => (VR.I18N && VR.I18N.t ? VR.I18N.t(k, v, de) : String(de).replace(/\{(\w+)\}/g, (m, x) => (v && v[x] !== undefined ? v[x] : m)));
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmtP = (p) => p ? p.slice(0, 3).map(v => Math.floor(v)).join(' · ') : '—';
  // the game this Studio lies over (its overlay), if any
  const host = () => { try { const g = window.parent !== window && window.parent.VR && window.parent.VR.game; return g && g.studioOpen ? g : null; } catch (e) { return null; } };

  // ---------------------------------------------------------------- a spot in front of a box, looking at it
  const solid = (x, y, z) => { const s = WM.getBlock(x, y, z); return !!(s && (T.flags[s] & F.SOLID)); };
  const wet = (x, y, z) => { const s = WM.getBlock(x, y, z); return !!(s && (T.flags[s] & (F.FLUID | F.LAVA))); };
  function viewpoint(box, label, front) {
    const [x0, y0, z0, x1, y1, z1] = box;
    const w = x1 - x0 + 1, d = z1 - z0 + 1, h = y1 - y0 + 1, cx = (x0 + x1 + 1) / 2, cz = (z0 + z1 + 1) / 2, cy = y0 + h * 0.45;
    const RB = WM.regionBox ? WM.regionBox() : null;
    const inR = (x, z) => !RB || (x >= RB[0] + 1 && z >= RB[2] + 1 && x < RB[3] - 1 && z < RB[5] - 1);
    const standable = (x, y, z) => inR(x, z) && solid(x, y - 1, z) && !solid(x, y, z) && !solid(x, y + 1, z) && !wet(x, y, z) && !wet(x, y + 1, z) && !wet(x, y - 1, z);
    const looking = (px, py, pz) => { const hd = Math.hypot(cx - px, cz - pz); return { yaw: Math.atan2(-(cx - px), -(cz - pz)), pitch: Math.max(-0.5, Math.min(0.6, Math.atan2(cy - (py + 1.6), Math.max(1, hd)))) }; };
    const at = (x, z) => { const gy = WM.groundAt(x, z); if (!gy || !standable(x, gy, z)) return null; const lk = looking(x + 0.5, gy, z + 0.5); return { pos: [x + 0.5, gy, z + 0.5], yaw: lk.yaw, pitch: lk.pitch, box: box.slice(), label }; };
    // a whole place (wider than 40): stand in its middle
    if (Math.max(w, d) > 40) for (let r = 0; r <= 8; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) { if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue; const v = at(Math.floor(cx) + dx, Math.floor(cz) + dz); if (v) { v.yaw = 0; v.pitch = 0; return v; } }
    // nothing between your eyes and it (a tree, a wall): the line is walked in half blocks, the thing itself not counted
    const inBox = (x, y, z) => x >= x0 && x <= x1 && y >= y0 && y <= y1 && z >= z0 && z <= z1;
    const clear = (v) => {
      const ex = v.pos[0], ey = v.pos[1] + 1.6, ez = v.pos[2], dx = cx - ex, dy = cy - ey, dz = cz - ez, n = Math.ceil(Math.hypot(dx, dy, dz) * 2);
      for (let k = 1; k < n; k++) { const t = k / n, x = Math.floor(ex + dx * t), y = Math.floor(ey + dy * t), z = Math.floor(ez + dz * t); if (inBox(x, y, z)) return true; if (solid(x, y, z)) return false; }
      return true;
    };
    // in front of it: the side toward where you were first, a few distances and a little to the side
    const base = Math.max(4, Math.min(26, Math.round(Math.max(w, d, h) * 0.6) + 3));
    const pl = WM.world && WM.world.player && Array.isArray(WM.world.player.pos) ? WM.world.player.pos : null;
    const sides = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    if (pl) sides.sort((a, b) => (b[0] * (pl[0] - cx) + b[1] * (pl[2] - cz)) - (a[0] * (pl[0] - cx) + a[1] * (pl[2] - cz)));
    // a house or a Forge structure has a front (its street side, the entrance): stand there first
    if (front) sides.sort((a, b) => (b[0] * front[0] + b[1] * front[1]) - (a[0] * front[0] + a[1] * front[1]));
    let first = null;
    for (const dist of [base, base + 3, Math.max(3, base - 2), base + 7]) for (const s of sides) for (const lat of [0, 3, -3, 6, -6]) {
      const ex = s[0] ? (s[0] > 0 ? x1 + dist : x0 - dist) : Math.floor(cx) + lat;
      const ez = s[1] ? (s[1] > 0 ? z1 + dist : z0 - dist) : Math.floor(cz) + lat;
      const v = at(ex, ez); if (!v) continue;
      if (clear(v)) return v;
      if (!first) first = v;
    }
    if (first) return first;
    // nowhere free around it: on top of it
    return { pos: [Math.floor(cx) + 0.5, y1 + 1, Math.floor(cz) + 0.5], yaw: 0, pitch: -0.3, box: box.slice(), label };
  }
  WM.viewpoint = viewpoint;
  WM.landingBox = (el) => section(el);   // (W1: the Karte view's panel shows it too)

  // ---------------------------------------------------------------- the newest thing set into the world
  function note(box, label, front) {
    if (!WM.world || !box) return;
    const v = viewpoint(box, label || L('land.new', 'Neu'), front);
    if (!LD.note(WM.world.id, v)) C.full('landing');
    WM.landing = LD.read(WM.world.id).landing;
    play.label(); C.parts();
  }
  // the Werkbank: every change that sets blocks (not one block with the hammer, not ⟲)
  if (WM.wb) WM.wb.onEdit = (list, label) => {
    let n = 0, x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9;
    for (const c of list) { if (!c[3]) continue; n++; if (c[0] < x0) x0 = c[0]; if (c[1] < y0) y0 = c[1]; if (c[2] < z0) z0 = c[2]; if (c[0] > x1) x1 = c[0]; if (c[1] > y1) y1 = c[1]; if (c[2] > z1) z1 = c[2]; }
    if (!n || (!label && n < 8)) return;
    note([x0, y0, z0, x1, y1, z1], String(label || '').replace(/\s*·.*$/, '') || L('land.wb', 'Werkbank'));
  };
  // plans handed to the game (houses, furniture): the newest of them
  WM.onCommit = (box, label, front) => note(box, label, front);

  // ---------------------------------------------------------------- 📍 the spawn point
  WM.setSpawn = function (pos) {
    if (!WM.world || !Array.isArray(pos)) return false;
    const p = [Math.floor(pos[0]) + 0.5, Math.floor(pos[1]), Math.floor(pos[2]) + 0.5];
    const stored = LD.setSpawn(WM.world.id, p);
    // the game under this Studio (its overlay) takes it at once; else only the browser's storage carries it to the game
    const g = host(), live = !!(g && g.meta && g.meta.id === WM.world.id && g.player);
    if (live) { g.player.spawn = p.slice(); g.player.spawnBed = null; }
    if (!stored) C.full('spawn');
    if (!stored && !live) { WM.tipW && WM.tipW('⚠ ' + L('land.spawnFail', 'Mein Platz nicht gespeichert — der Browser-Speicher ist voll'), false); C.parts(); return false; }
    WM.tipW && WM.tipW('📍 ' + L('land.spawnSet', 'Mein Platz ist jetzt hier') + ' · ' + fmtP(p), true);
    play.label(); C.parts();
    return true;
  };
  // where the spawn point is: one set here, else the game's (bed, 📍 in the pause menu), else the world's start
  function spawnOf() {
    const w = WM.world; if (!w) return null;
    const o = LD.read(w.id);
    if (LD.freshSpawn(o, w)) return o.spawn.pos;
    const g = host(); if (g && g.meta && g.meta.id === w.id && g.player && Array.isArray(g.player.spawn)) return g.player.spawn;
    if (w.player && Array.isArray(w.player.spawn)) return w.player.spawn;
    return Array.isArray(w.worldSpawn) ? w.worldSpawn : null;
  }
  function lastOf() { const w = WM.world, g = host(); if (g && w && g.meta && g.meta.id === w.id && g.player) return g.player.pos; return w && w.player && Array.isArray(w.player.pos) ? w.player.pos : null; }
  function freshOf(w) { if (!w) return null; const o = LD.read(w.id); return LD.fresh(o, w) ? o.landing : null; }

  // ---------------------------------------------------------------- the right side: where you land
  const prevParts = HOOK.parts;
  HOOK.parts = function (...a) {
    const r = prevParts ? prevParts.apply(null, a) : false;
    if (r && WM.on && S.mode === 'world' && WM.world && !WM.loading) section();
    return r;
  };
  function section(into) {
    const el = into || $('#partsBody'); if (!el || el.querySelector('.landBox')) return;
    const box = document.createElement('div'); box.className = 'landBox';
    const sp = spawnOf(), last = lastOf(), nw = freshOf(WM.world);
    const row = (cls, ic, txt, p, extra) => `<div class="landRow ${cls}"><i></i><span class="t">${ic} ${txt}<small>${fmtP(p)}</small></span>${extra || ''}${p ? `<button class="cbtn mini" data-look="${p.slice(0, 3).join(',')}" title="${esc(L('land.look', 'Ansehen'))}">👁</button>` : ''}</div>`;
    box.innerHTML = `<div class="ph">📍 ${esc(L('land.title', 'Wo du landest'))}</div>`
      + row('sp', '📍', esc(L('land.spawn', 'Mein Platz')), sp, `<button class="cbtn mini${WM.spawnArm ? ' on' : ''}" data-spawn title="${esc(L('land.setT', 'Danach auf den Boden klicken'))}">${WM.spawnArm ? esc(L('land.click', 'Klick auf den Boden …')) : '📍 ' + esc(L('land.set', 'Mein Platz ist hier'))}</button>`)
      + row('la', '🧍', esc(L('land.last', 'Zuletzt warst du hier')), last)
      + (nw ? row('nw', '✨', esc(L('land.newIs', 'Neu: {l}', { l: nw.label || '' })), nw.pos) : '')
      + `<div class="note dim">${nw ? L('land.goNew', '▶ Spielen stellt dich <b>vor das Neue</b>.') : host() ? L('land.goStay', '▶ Spielen: du spielst weiter, wo du warst.') : L('land.goSpawn', '▶ Spielen bringt dich <b>an deinen Platz</b>.')}</div>`;
    el.prepend(box);
    const sb = box.querySelector('[data-spawn]'); if (sb) sb.onclick = () => { WM.spawnArm = !WM.spawnArm; if (WM.spawnArm && WM.tool) { WM.tool = null; WM.ghost = null; } WM.tipW && WM.tipW(WM.spawnArm ? '📍 ' + L('land.armed', 'Klick auf den Boden: dort ist dein Platz (Rechtsklick: abbrechen)') : '', !!WM.spawnArm); WM.refresh ? WM.refresh() : C.parts(); };
    for (const b of box.querySelectorAll('[data-look]')) b.onclick = () => { const p = b.dataset.look.split(',').map(Number), sc = S.scene; if (sc && sc.type === 'world') { sc.center = [p[0], p[1] + 1, p[2]]; S.cam.dist = 34; } };
  }

  // ---------------------------------------------------------------- markers in the view
  const prevOverlay = HOOK.overlay;
  HOOK.overlay = function (sc, eye, vp, W, H) {
    if (WM.on && S.mode === 'world' && sc && sc.type === 'world' && WM.world && !WM.loading) {
      const segs = [], pin = (p, c) => { if (!p) return; const x = Math.floor(p[0]) + 0.5, y = Math.floor(p[1]), z = Math.floor(p[2]) + 0.5, t = y + 7; segs.push(x, y, z, x, t, z, ...c); const d = 0.8; segs.push(x - d, t, z, x, t + d, z, ...c, x, t + d, z, x + d, t, z, ...c, x + d, t, z, x, t - d, z, ...c, x, t - d, z, x - d, t, z, ...c, x, t, z - d, x, t + d, z, ...c, x, t + d, z, x, t, z + d, ...c, x, t, z + d, x, t - d, z, ...c, x, t - d, z, x, t, z - d, ...c); };
      pin(spawnOf(), [0.45, 1, 0.55]);
      pin(lastOf(), [0.45, 0.75, 1]);
      const nw = freshOf(WM.world); if (nw) pin(nw.pos, [1, 0.85, 0.3]);
      if (segs.length) C.drawLines(segs, vp, eye, false);
    }
    return prevOverlay ? prevOverlay(sc, eye, vp, W, H) : false;
  };

  // ---------------------------------------------------------------- ▶ Spielen (the Studio that belongs to the game)
  const play = {
    btn: () => document.getElementById('playBtn'),
    // the world it starts: the one open here, else the game's under this Studio, else the last one played
    target() { if (WM.world) return WM.world; const g = host(); if (g && g.meta) return g.meta; return WM.worlds && WM.worlds[0] ? WM.worlds[0] : null; },
    label() {
      const b = play.btn(); if (!b) return;
      const w = play.target(), g = host();
      let t = '▶ ' + L('land.play', 'Spielen'), tip = L('land.playT', 'Ins Spiel');
      if (w) {
        if (freshOf(w)) { t += ' · ' + L('land.atNew', 'beim Neuen'); tip = L('land.atNewT', 'Du stehst vor dem, was du gerade gesetzt hast'); }
        else if (g && g.meta && g.meta.id === w.id) { t = '▶ ' + L('land.goOn', 'Weiterspielen'); tip = L('land.goOnT', 'Zurück ins Spiel, wo du warst'); }
        else { t += ' · 📍 ' + L('land.atSpawn', 'an meinem Platz'); tip = L('land.atSpawnT', 'Du landest an deinem Platz'); }
        tip += ' — „' + (w.name || 'Welt') + '“';
      }
      const lbl = b.querySelector && b.querySelector('.lbl') || b;   // (W1: the ▶ tile keeps its picture)
      if (lbl.textContent !== t) lbl.textContent = t;
      b.title = tip;
    },
    async go() {
      let w = play.target();
      if (!w && WM.list) { try { await WM.list(); } catch (e) { /* */ } w = play.target(); }
      // everything still waiting here goes along — the plan's drafts, the 🎨 Stil preview — and with the newest piece
      // the 📍 landing in front of it; on both ways out: into the game under this Studio, or the game's page
      if (WM.keepNow) { try { WM.keepNow(w ? w.id : null); } catch (e) { console.warn('▶ keep', e); } }
      const g = host();
      if (g) { g.studioPlay(w ? w.id : null); return; }
      location.href = 'index.html' + (location.search || '') + (w ? '#play=' + encodeURIComponent(w.id) : '');
    },
  };
  WM.play = play;
  const b0 = play.btn();
  if (b0) {
    b0.onclick = (e) => { e.preventDefault(); play.go(); };
    play.label();
    setInterval(play.label, 1500);
    // the list of worlds (for ▶ without an open one)
    if (!WM.worlds && WM.list) setTimeout(() => { WM.list().then(play.label).catch(() => { /* */ }); }, 1500);
  }
})();
