// ============================================================================
// f-first2 · VR.First2 — the v0.53 review's top five (docs/reviews/v0.53.md R54-01…06; plan
// docs/superpowers/plans/2026-10-30-f-first2.md). Pure parts (node: test/first2.js) above the line, the game's glue below.
//   1 · the held block smaller and lower (HAND, read by entities.drawHand), hidden in cinematic scenes (cine)
//   2 · an Abenteuer start says Abenteuer: the badge, the welcome line with the outpost's distance, the adventurer's
//       starter bag (advKit), a pointer to the outpost (pointText)
//   3 · a new world's spawn on open ground (openGround: the way ahead free, one-block steps); a form field let go
//   4 · the swarm's trip ends near a lit rock (swarmEnd); the ring's entry ends on the day side (fields2 wrap)
//   5 · ⚙ Einfach: the live preview and three sliders (simple), all else behind „Alle Einstellungen"; J and O answer
// Cost: nothing per frame on any tier but a few flag checks; Helligkeit ≠ 100 % lays a CSS filter on the canvas (🟡).
// ============================================================================
(function (VR) {
  'use strict';
  const F = VR.First2 = {};
  const tx = (k, v, de, en) => (VR.I18N && VR.I18N.tx ? VR.I18N.tx(k, v, de, en) : de);
  const hasDoc = typeof document !== 'undefined' && !!document.createElement;
  const game = () => VR.game || null;

  // ---------------------------------------------------------------- 1 · the held block
  // camera space (entities.drawHand): the fist, the block's offset from it, its turn and size. Before: off
  // (−0.035, 0.115, −0.06), size 0.235 — a block ≈ 5–6 % of a 16:9 frame; now ≈ 2.2 % (≤ 3 % at 4:3 too), lower in the corner
  F.HAND_OLD = { off: [-0.035, 0.115, -0.06], ry: 0.78, rx: -0.18, s: 0.235 };
  F.HAND = { off: [0.01, 0.045, -0.02], ry: 0.78, rx: -0.22, s: 0.15 };
  // f-first3 (R55-13): the held block 30 % darker (entities.drawHand scales its light), and the kit's slot 5 a calm
  // sandstone, not the neon magenta that pulled the eye (game.giveKit, a vgen ≥ 9 world's new kit)
  F.HAND_DIM = 0.7; F.KIT5 = 'sandstone';
  // (Very Low's mesh program has no u_desat: the hand's lights tinted by handTint(mean, keep) — per channel the factor that
  //  moves the block's mean colour to luma + keep × (colour − luma), within 0.4 … 2.5; pure, test/polish6.js)
  F.handTint = function (c, keep) {
    const L = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2], out = [1, 1, 1];
    for (let i = 0; i < 3; i++) { const want = L + keep * (c[i] - L); out[i] = c[i] > 1e-4 ? Math.max(0.4, Math.min(2.5, want / c[i])) : 1; }
    return out;
  };
  // f-polish7 (R56-13 on Very Low: the shared light tint moved the screen's saturation only 0.691 → 0.679): each face of
  // the held block its own tint — the face's mean colour (its texture's mean A[l] × its tint, as far as the texture's
  // tint mask k reaches) moved to its luma + keep × (colour − luma); the new per-vertex tint (pure, test/polish7.js).
  // A = the textures' mean colours (rgba per layer, a = the mask's share), l = the layer, t = the face's tint, sh its
  // shade (< 0: an opaque texture whose alpha is the tint mask)
  F.HAND_KEEP_VL = 0.45;
  F.faceTint = function (A, l, t, sh, keep) {
    const o = [t[0], t[1], t[2]]; if (!A || l * 4 + 3 >= A.length) return o;
    const k = sh < 0 ? A[l * 4 + 3] : 1; if (!(k > 0.08)) return o;
    const c = [0, 1, 2].map(i => A[l * 4 + i] * (1 + (t[i] - 1) * k)), L = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
    for (let i = 0; i < 3; i++) { const a = A[l * 4 + i]; if (!(a > 1e-4)) continue; const want = L + keep * (c[i] - L); o[i] = Math.max(0, Math.min(3, 1 + (want / a - 1) / k)); }
    return o;
  };
  F.HAND_SAT = 0.7;   // f-polish6 (R56-13: sandstone at 0.604, the goal ≤ 0.55): the held block keeps 70 % of its chroma (≈ 20 % less HSV saturation) (entities.drawHand, u_desat)
  F.FOV = 70;   // the hand's own projection (entities.drawHand)
  // the fist at rest (no bob, no swing), a block held — drawHand's S, F and d·0.9
  F.fistRest = () => {
    const S = [0.64, -0.8, -0.16], Fp = [0.34, -0.40, -0.8], d = [Fp[0] - S[0], Fp[1] - S[1], Fp[2] - S[2]];
    return [S[0] + d[0] * 0.9, S[1] + d[1] * 0.9, S[2] + d[2] * 0.9];
  };
  // the share of the frame the held block covers: its 8 corners projected, their hull clipped to the screen
  F.handCover = function (H, aspect) {
    H = H || F.HAND; aspect = aspect || 16 / 9;
    const fist = F.fistRest(), f = 1 / Math.tan(F.FOV * Math.PI / 360), cy = Math.cos(H.ry), sy = Math.sin(H.ry), cx = Math.cos(H.rx), sx = Math.sin(H.rx);
    const pts = [];
    for (let i = 0; i < 8; i++) {
      let x = ((i & 1) ? 0.5 : -0.5) * H.s, y = ((i & 2) ? 0.5 : -0.5) * H.s, z = ((i & 4) ? 0.5 : -0.5) * H.s;
      const y1 = y * cx - z * sx, z1 = y * sx + z * cx; y = y1; z = z1;            // rotX
      const x2 = x * cy + z * sy, z2 = -x * sy + z * cy; x = x2; z = z2;           // rotY
      x += fist[0] + H.off[0]; y += fist[1] + H.off[1]; z += fist[2] + H.off[2];
      if (z > -0.01) z = -0.01;
      pts.push([f / aspect * x / -z, f * y / -z]);
    }
    let poly = hull(pts);
    for (const [ax, sgn] of [[0, 1], [0, -1], [1, 1], [1, -1]]) poly = clip(poly, ax, sgn);
    let a = 0; for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; a += p[0] * q[1] - q[0] * p[1]; }
    return Math.abs(a) / 2 / 4;   // NDC spans 2 × 2
  };
  function hull(P) {
    const p = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }
  function clip(poly, ax, sgn) {   // keep sgn·p[ax] ≤ 1
    const out = [], ins = (p) => sgn * p[ax] <= 1;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length], ia = ins(a), ib = ins(b);
      if (ia) out.push(a);
      if (ia !== ib) { const t = (sgn - a[ax]) / (b[ax] - a[ax]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
    return out;
  }
  // a cinematic scene: no hand. The story's scene (body.storyon), the boss's entrance, the freeing moment's camera, photo
  // mode, the arrival's veil, the director's and the wow moment's cameras, Funke's shot, the Zeitraffer
  F.cine = function (g) {
    if (!g) return false;
    if (g.photo || (g.photoCam && g.photoCam.on)) return true;
    if (g.arrival && g.arrival.holds && g.arrival.holds()) return true;
    if ((g.director && g.director.active) || (g.wow && g.wow.active) || (g.funke && g.funke.shot) || (VR.Zeit && VR.Zeit.active)) return true;
    const L = VR.Liberate; if (L && (L.mcam || L.moment)) return true;
    const B = VR.RPGBoss, C = B && B.cur; if (C && C.b && C.b.st === 'intro') return true;
    if (hasDoc && document.body && document.body.classList && document.body.classList.contains('storyon')) return true;
    return false;
  };

  // ---------------------------------------------------------------- 2 · the Abenteuer start
  // the adventurer's bag: tools, light and food — no creative stacks of 64 (the bar's slot 1 is the sword)
  F.ADV_KIT = [['stone_sword', 1], ['stone_pickaxe', 1], ['stone_axe', 1], ['torch', 16], ['bread', 8], ['oak_planks', 32], ['apple', 4], ['compass', 1], ['spyglass', 1]];
  F.ADV_EXTRA = [['shuttle_beacon', 1], ['jetpack', 1], ['hoverbike', 1], ['builder_wand', 1], ['water_bucket', 1], ['lantern', 4]];
  F.ARROWS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'];
  // the way from p (yaw: the camera's) to a place: metres and an arrow as the wonder compass draws it
  F.bearing = function (p, yaw, to) {
    const dx = to[0] - p[0], dz = to[2] - p[2], d = Math.hypot(dx, dz);
    const a = Math.atan2(dx, -dz), rel = ((Math.round((a + yaw) * 180 / Math.PI) % 360) + 540) % 360 - 180;
    return { d, rel, arrow: F.ARROWS[((Math.round(rel / 45) % 8) + 8) % 8] };
  };
  F.pointText = function (p, yaw, to) {
    const b = F.bearing(p, yaw, to), m = b.d < 100 ? Math.round(b.d) : Math.round(b.d / 10) * 10;
    return '⚔ ' + tx('g.first2.outpost', { m }, 'Außenposten {m} m', 'Outpost {m} m') + ' ' + b.arrow;
  };

  // ---------------------------------------------------------------- 3 · open ground
  // solid(x, y, z) → bool. A place to stand: two blocks of air on a solid one. The way ahead along yaw (forward
  // (−sin, −cos)): each metre's ground at most one block up (auto step-up takes it) and at most DROP down.
  F.WAY = 12; F.DROP = 5; F.SEARCH = 12;
  F.groundAt = function (solid, x, z, y0) {
    for (let y = y0 + 1; y >= y0 - F.DROP; y--) if (!solid(x, y, z) && !solid(x, y + 1, z) && solid(x, y - 1, z)) return y;
    return null;
  };
  F.wayLen = function (solid, x0, z0, y0, yaw) {
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw); let y = y0, n = 0;
    for (let i = 1; i <= F.WAY; i++) {
      const x = Math.floor(x0 + fx * i), z = Math.floor(z0 + fz * i);
      const g = F.groundAt(solid, x, z, y);
      if (g === null || g > y + 1) break;
      if (g === y + 1 && solid(Math.floor(x0 + fx * (i - 1)), y + 2, Math.floor(z0 + fz * (i - 1)))) break;   // (no head room for the step)
      y = g; n = i;
    }
    return n;
  };
  // the spawn as it is when its way is free, else the nearest place (rings of 1…SEARCH m) whose way is; null: keep it
  F.openGround = function (solid, pos, yaw) {
    const px = Math.floor(pos[0]), pz = Math.floor(pos[2]), py = Math.floor(pos[1] + 0.01);
    const here = F.wayLen(solid, pos[0], pos[2], py, yaw);
    if (here >= F.WAY) return null;
    let best = null;
    for (let r = 1; r <= F.SEARCH; r++) {
      const n = Math.max(8, Math.round(r * 6));
      for (let k = 0; k < n; k++) {
        const a = k / n * Math.PI * 2, x = px + Math.round(Math.cos(a) * r), z = pz + Math.round(Math.sin(a) * r);
        const y = F.groundAt(solid, x, z, py + 1);
        if (y === null || Math.abs(y - py) > 1) continue;   // (the ground beside, not the bench's or the parapet's top)
        const L = F.wayLen(solid, x + 0.5, z + 0.5, y, yaw);
        if (L >= F.WAY) return { pos: [x + 0.5, y, z + 0.5], way: L, r };
        if (L > here + 2 && (!best || L > best.way)) best = { pos: [x + 0.5, y, z + 0.5], way: L, r };
      }
    }
    // (f-first2 restart: the vista spur on a cliff's edge — nothing ahead within reach) the nearest place with a free way
    // nearest the view's direction, the player turned to it
    for (let r = 0; r <= F.SEARCH; r++) {
      const n = r ? Math.max(8, Math.round(r * 6)) : 1;
      for (let k = 0; k < n; k++) {
        const a = k / n * Math.PI * 2, x = px + Math.round(Math.cos(a) * r), z = pz + Math.round(Math.sin(a) * r);
        const y = r ? F.groundAt(solid, x, z, py + 1) : py;
        if (y === null || Math.abs(y - py) > 1) continue;
        for (const d of F.TURNS) if (F.wayLen(solid, x + 0.5, z + 0.5, y, yaw + d) >= F.WAY) return { pos: [x + 0.5, y, z + 0.5], way: F.WAY, r, yaw: yaw + d };
      }
    }
    return best;   // (no full way anywhere near: the longest one facing the view)
  };
  F.TURNS = [Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, 3 * Math.PI / 4, -3 * Math.PI / 4, Math.PI];
  // a wall, a fence, a pane: one block that collides 1.5 high — no step (the cell above it counts as solid)
  F.solidTall = (solid, tall) => (x, y, z) => solid(x, y, z) || tall(x, y - 1, z);

  // ---------------------------------------------------------------- 4 · the swarm's end: near a lit rock
  F.SWARM_GAP = 800;   // m off the rock's surface, on its sunlit side
  // rel: the ship's place in Helia's frame; rocks: [{k, q (Helia's frame), D}]; → {r, nose, k} or null
  F.swarmEnd = function (rel, rocks) {
    let best = null, bd = Infinity;
    for (const b of rocks) { const d = Math.hypot(b.q[0] - rel[0], b.q[1] - rel[1], b.q[2] - rel[2]) - b.D / 2; if (d < bd) { bd = d; best = b; } }
    if (!best) return null;
    const q = best.q, l = Math.hypot(q[0], q[1], q[2]) || 1, sd = [-q[0] / l, -q[1] / l, -q[2] / l];   // toward Helia
    // the sunlit side, turned a little toward where the ship came from (the light from behind the shoulder)
    const c = [rel[0] - q[0], rel[1] - q[1], rel[2] - q[2]], cl = Math.hypot(c[0], c[1], c[2]) || 1;
    let w = [sd[0] * 0.85 + c[0] / cl * 0.3, sd[1] * 0.85 + c[1] / cl * 0.3, sd[2] * 0.85 + c[2] / cl * 0.3];
    const wl = Math.hypot(w[0], w[1], w[2]) || 1; w = [w[0] / wl, w[1] / wl, w[2] / wl];
    const R = best.D / 2 + F.SWARM_GAP;
    return { k: best.k, r: [q[0] + w[0] * R, q[1] + w[1] * R, q[2] + w[2] * R], nose: [-w[0], -w[1], -w[2]], sun: sd };
  };

  // ---------------------------------------------------------------- 5 · ⚙ Einfach
  F.GFX = ['potato', 'low', 'balanced', 'high', 'ultra'];
  F.gfxIndex = (p) => { const i = F.GFX.indexOf(p); return i >= 0 ? i : p === 'ultraLite' ? 3 : 2; };
  F.BRIGHT = { min: 0.7, max: 1.4, step: 0.05, def: 1 };
  F.brightCss = (v) => (Number.isFinite(+v) && Math.abs(+v - 1) > 0.001 ? 'brightness(' + (+v).toFixed(2) + ')' : '');
  // the simple page's rows (three sliders) — test/first2.js counts the controls
  F.SIMPLE = ['gfx', 'bright', 'uiScale'];
  F.simpleOn = (ui) => !(VR.UIPrefs && VR.UIPrefs.get && VR.UIPrefs.get().pro) && !(ui && ui.setAll);

  F.KEYS = ['g.first2.outpost', 'g.first2.advWelcome', 'g.first2.advWelcome0', 'g.first2.hud', 'g.first2.jTitle', 'g.first2.jNote', 'g.first2.oTitle', 'g.first2.oNote',
    'g.first2.simple', 'g.first2.all', 'g.first2.gfx', 'g.first2.gfxTip', 'g.first2.bright', 'g.first2.brightTip', 'g.first2.scale', 'g.first2.scaleTip', 'g.first2.back'];

  // ============================================================================ the game's glue
  if (!hasDoc || typeof window === 'undefined') return;
  const G = VR.Game, UI = VR.UI;

  // 2 · the welcome line: an Abenteuer world says Abenteuer (not „Zen-Bauen"), the outpost's distance named
  F.advWorld = (g) => { try { return !!(g && g.meta && !g.meta.guest && ((VR.First && VR.First.advWorld && VR.First.advWorld(g.meta)) || (VR.Adventure && VR.Adventure.on && VR.Adventure.on()))); } catch (e) { return false; } };
  if (UI && UI.prototype.chatLine && !UI.prototype.chatLine.__f2) {
    const oc = UI.prototype.chatLine;
    UI.prototype.chatLine = function (text, col) {
      const g = this.game;
      if (g && text === (VR.I18N && VR.I18N.t ? VR.I18N.t('g.chat.zen') : '') && F.advWorld(g)) {
        const st = g.meta.advStart, m = st && st.d ? Math.round(st.d / 10) * 10 : 0;
        text = m ? tx('g.first2.advWelcome', { m }, 'Abenteuer! Der erste Außenposten liegt {m} m vor dir — folge ⚔ oben am Bildschirm.', 'Adventure! The first outpost lies {m} m ahead — follow ⚔ at the top of the screen.') : tx('g.first2.advWelcome0', null, 'Abenteuer! Erkunde die Gegend — ⚔ im Pausenmenü zeigt deinen Weg.', 'Adventure! Explore the land — ⚔ in the pause menu shows your way.');
        col = '#ffd98a';
      }
      return oc.call(this, text, col);
    };
    UI.prototype.chatLine.__f2 = true;
  }
  // the badge: ABENTEUER in an Abenteuer world (its mode is zen underneath: peaceful, A§1)
  if (UI && UI.prototype.updateHUD && !UI.prototype.updateHUD.__f2) {
    const ou = UI.prototype.updateHUD;
    UI.prototype.updateHUD = function (force) {
      const r = ou.apply(this, arguments);
      try {
        const g = this.game, mb = document.getElementById('modebadge');
        if (mb && g && g.player && g.player.mode === 'zen' && F.advWorld(g)) { const t = tx('g.first2.hud', null, 'ABENTEUER', 'ADVENTURE'); if (mb.textContent !== t) { mb.textContent = t; mb.classList.add('f2adv'); } }
        else if (mb && mb.classList.contains('f2adv')) mb.classList.remove('f2adv');
      } catch (e) { /* the badge stays */ }
      return r;
    };
    UI.prototype.updateHUD.__f2 = true;
  }
  // the starter bag
  if (G && G.prototype.giveKit && !G.prototype.giveKit.__f2) {
    const ok = G.prototype.giveKit;
    G.prototype.giveKit = function (meta) {
      const r = ok.apply(this, arguments);
      try {
        if (meta && meta.mode === 'zen' && VR.First && VR.First.advWorld && VR.First.advWorld(meta)) {
          const inv = this.player.inv, R = VR.R, has = (id) => !!((R && R.byName && R.byName[id]) || (VR.ITEMS && VR.ITEMS[id]));
          for (let i = 0; i < inv.slots.length; i++) inv.slots[i] = null;
          let i = 0; for (const [id, n] of F.ADV_KIT) if (has(id)) inv.slots[i++] = { id, n: Math.min(n, VR.maxStack ? VR.maxStack(id) : n) };
          i = 9; for (const [id, n] of F.ADV_EXTRA) if (has(id)) inv.slots[i++] = { id, n: Math.min(n, VR.maxStack ? VR.maxStack(id) : n) };
          inv.changed = true;
        }
      } catch (e) { console.warn('first2 kit', e); }
      return r;
    };
    G.prototype.giveKit.__f2 = true;
  }
  // the pointer: „⚔ Außenposten 240 m ↗" until the player stands there (or it is freed)
  F.point = { el: null, t: 0, text: '' };
  F.pointFrame = function (g, dt) {
    const P = F.point; P.t -= dt; if (P.t > 0) return; P.t = 0.25;
    let text = '';
    const st = g.meta && g.meta.advStart, p = g.player;
    if (st && st.out && p && !g.hideHud && !g.photo && !(g.ui && g.ui.screen) && F.advWorld(g) && !F.cine(g)) {
      const site = VR.StoryPlay && VR.StoryPlay.nearSite ? VR.StoryPlay.nearSite(g, false) : null;
      const to = site && site.s ? [site.s.x, 0, site.s.z] : st.out, b = F.bearing(p.pos, p.yaw, to);
      P.goal = (site && site.s ? 's' : 'o') + Math.round(to[0]) + ',' + Math.round(to[2]);   // (f-quiet2)
      if (b.d > 24 && b.d < 2000 && !st.reached) text = F.pointText(p.pos, p.yaw, to);
      else if (b.d <= 24) st.reached = true;
    }
    if (!P.el && text) { P.el = document.createElement('div'); P.el.id = 'f2point'; (document.getElementById('hud') || document.body).appendChild(P.el); }
    if (P.el && text && P.el.dataset && P.el.dataset.goal !== P.goal) P.el.dataset.goal = P.goal;   // (f-quiet2: the goal, for the fade — quiet.js)
    if (P.el && text !== P.text) { P.text = text; P.el.textContent = text; P.el.style.display = text ? 'block' : 'none'; }
  };

  // 3 · the spawn on open ground (a new world's first start, when the land is there) and no form field holding the keys
  F.solidOf = (w) => {
    const R = VR.R, T = R.T.flags, S = VR.F ? VR.F.SOLID : (VR.FLAGS && VR.FLAGS.SOLID), SH = VR.SHAPE || {}, shp = R.T.shape;
    const solid = (x, y, z) => !!(T[w.getBlock(x, y, z)] & S);
    const tall = (x, y, z) => { const b = w.getBlock(x, y, z); if (!(T[b] & S) || !shp) return false; const h = shp[b]; return h === SH.FENCE || h === SH.WALL || h === SH.PANE; };
    return F.solidTall(solid, tall);
  };
  // f-first4 (f-first3's self-review: the spawn picture's lower corners filled by the walk's first wall cells): a vista
  // start steps STEP_BACK further back on the way (against the walk's direction u) when that cell is the way's paving with
  // air for the body — the walls smaller, the way leading in; else it stays. Pure: feet [x, y, z], get(x, y, z) → a state,
  // isPave(state), solid(state) → the new feet or null (test/first4.js)
  F.STEP_BACK = 1;
  F.PAVE_RE = /flagstone|floor_plaza|dirt_path|coarse_dirt|gravel|path/;
  F.LAND_RE = /grass|^dirt$|^sand$|^red_sand$|snow|moss|podzol|mud|mycel|^stone$|^clay$/;   // (f-polish4: the land's own ground, never 'the way')
  F.stepBack = function (feet, u, get, isPave, solid) {
    if (!feet || !u) return null;
    const x = feet[0] - u[0] * F.STEP_BACK, z = feet[2] - u[1] * F.STEP_BACK, y = feet[1], X = Math.floor(x), Y = Math.floor(y + 0.01), Z = Math.floor(z);
    if (!isPave(get(X, Y - 1, Z)) || solid(get(X, Y, Z)) || solid(get(X, Y + 1, Z))) return null;
    return [x, y, z];
  };
  // f-polish4: the step back onto open ground — k blocks back (the first of steps that works): the ground under each cell
  // on the way back isGround and at the feet's level, the body's two cells free; pure (test/polish4.js b)
  F.OPEN_STEPS = [2, 1];
  F.stepBackOpen = function (feet, u, get, isGround, solid, steps) {
    if (!feet || !u) return null;
    const y = feet[1], Y = Math.floor(y + 0.01);
    for (const k of steps || F.OPEN_STEPS) {
      let ok = true;
      for (let j = 1; j <= k && ok; j++) { const X = Math.floor(feet[0] - u[0] * j), Z = Math.floor(feet[2] - u[1] * j); ok = isGround(get(X, Y - 1, Z)) && !solid(get(X, Y, Z)) && !solid(get(X, Y + 1, Z)); }
      if (ok) return [feet[0] - u[0] * k, y, feet[2] - u[1] * k];
    }
    return null;
  };
  // f-polish4: the arrival's camera (v.eye, when it stands over the old feet) moved by the feet's step
  F.shiftEye = function (v, from, to) {
    if (!v || !Array.isArray(v.eye) || v._eyeFrom === from[0] + ',' + from[2] || Math.hypot(v.eye[0] - from[0], v.eye[2] - from[2]) > 3) return false;
    v.eye = [v.eye[0] + to[0] - from[0], v.eye[1], v.eye[2] + to[2] - from[2]]; v._eyeFrom = to[0] + ',' + to[2];
    return true;
  };
  // (once, on a vista start's own first arrival, the feet still on the spawn: from the loading screen's last moments
  //  (First.holdLoading, the world there, the screen still the loading screen), else under the arrival's white (settle))
  F.vistaBack = function (g, v0) {
    const m = g && g.meta, A = g && g.arrival, v = v0 || (A && A.v), p = g && g.player;
    if (!m || m.guest || m.f4back || !m.vistaId || !v || !Array.isArray(v.u) || !p || !g.world || !Array.isArray(p.spawn)) return null;
    // f-polish4: the back cell's column not loaded yet (the loading screen's first call came before it) → asked again at
    // the next call (the arrival's settle), not given up; F.backWhy says why a start stayed where it was
    const w = g.world, bx = Math.floor(p.pos[0] - v.u[0] * F.STEP_BACK), bz = Math.floor(p.pos[2] - v.u[1] * F.STEP_BACK);
    if (w.isLoaded && !w.isLoaded(bx, bz)) { F.backWhy = 'unloaded'; return null; }
    m.f4back = 1;
    if (Math.hypot(p.pos[0] - p.spawn[0], p.pos[2] - p.spawn[2]) > 0.5) { F.backWhy = 'moved'; return null; }
    const R = VR.R, T = R.T.flags, S = VR.F ? VR.F.SOLID : 1;
    // (f-polish4: the way's paving is also whatever made block the feet stand on — a walk of bricks or terracotta — but
    // never the land's own ground: grass behind still keeps the start where it is)
    const nmOf = (b) => (b ? (R.types[R.T.type[b]] || {}).name || '' : ''), under = w.getBlock(Math.floor(p.pos[0]), Math.floor(p.pos[1] + 0.01) - 1, Math.floor(p.pos[2]));
    const own = under && (T[under] & S) && !F.LAND_RE.test(nmOf(under)) ? under : 0;
    const r = F.stepBack(p.pos, v.u, (x, y, z) => w.getBlock(x, y, z), (b) => !!b && (b === own || F.PAVE_RE.test(nmOf(b))), (b) => !!(T[b] & S));
    // (f-polish4: the browser showed the walk's first cell under the feet and the meadow behind — the start never moved;
    // now it steps back onto the land's own plain ground too, two blocks where both are free, else one)
    const isGround = (b) => !!b && (b === own || F.PAVE_RE.test(nmOf(b)) || F.LAND_RE.test(nmOf(b)));
    const r2 = r || F.stepBackOpen(p.pos, v.u, (x, y, z) => w.getBlock(x, y, z), isGround, (b) => !!(T[b] & S), F.OPEN_STEPS);
    if (!r && !r2) { const b = w.getBlock(bx, Math.floor(p.pos[1] + 0.01) - 1, bz); F.backWhy = 'stays:' + (b ? (R.types[R.T.type[b]] || {}).name : 'air'); return null; }
    // (run 3: the feet moved but the first seconds' picture did not — the wow moment's camera is the vista's own eye
    // (FI.arrivalOf: the sight test's), standing at the feet: it steps back with them)
    const to = r || r2;
    F.shiftEye(v, p.pos, to); if (A && A.v && A.v !== v) F.shiftEye(A.v, p.pos, to);
    { const W = g.wow, b = W && W.active && W.b; if (b && Math.hypot(b.x - p.pos[0], b.z - p.pos[2]) < 3) { b.x += to[0] - p.pos[0]; b.z += to[2] - p.pos[2]; } }   // (the moment already playing: its camera too)
    if (!r) { p.teleport(to[0], to[1], to[2]); p.spawn = to.slice(); if (Array.isArray(m.worldSpawn)) m.worldSpawn = to.slice(); F.backed = to; F.backWhy = 'back:ground'; return to; }
    F.backWhy = 'back';
    p.teleport(r[0], r[1], r[2]); p.spawn = r.slice(); if (Array.isArray(m.worldSpawn)) m.worldSpawn = r.slice();
    F.backed = r; return r;
  };
  F.settle = function (g) {
    try {
      try { F.vistaBack(g); } catch (e) { /* the spawn stays */ }
      if (!g || !g.meta || !g.f2new || g.meta.guest || g.meta.f2open || !g.world || !g.player) return null;   // (f2new: no player record when the world opened — an autosave writes one within seconds)
      g.meta.f2open = 1;
      const p = g.player, r = F.openGround(F.solidOf(g.world), p.pos, p.yaw);
      if (!r) return null;
      p.teleport(r.pos[0], r.pos[1], r.pos[2]); p.spawn = r.pos.slice(); if (Number.isFinite(r.yaw)) p.yaw = r.yaw;
      if (Array.isArray(g.meta.worldSpawn)) g.meta.worldSpawn = r.pos.slice();
      F.moved = r;
      return r;
    } catch (e) { console.warn('first2 open ground', e); return null; }
  };
  // (f-hud) the settle under the arrival's white: the veil still thick, or the wow moment holding its composition (the
  // eyes not on the screen) — the move is not seen; the swing back lands on the new place
  F.underVeil = function (g) {
    const A = g && g.arrival; if (!A) return false;
    if (A.phase === 'veil') return A.veilNow() >= 0.5;
    if (A.phase === 'full') return true;
    if (A.phase === 'moment') { const W = g.wow, WM = VR.WowMoment; return !!(W && W.active && W.t <= (WM && WM.RISE !== undefined ? WM.RISE + WM.HOLD : 4)); }
    return false;
  };
  F.letGo = function () {
    const a = document.activeElement;
    if (a && a !== document.body && /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(a.tagName) && a.blur) a.blur();
    const c = document.getElementById('gl'); if (c && c.focus) { try { if (!c.hasAttribute('tabindex')) c.setAttribute('tabindex', '-1'); c.focus({ preventScroll: true }); } catch (e) { /* no focus */ } }
  };

  // 3b · W on a slow machine (critic_ux at ~0.2 fps: a 1-s W met no frame, and a frame walked 0.1 s): the player keeps
  // the wall clock — a slow frame walks up to CATCH_MAX (1) s in steps of ≤ STEP (the extra steps read no look, no press, no
  // click) — and a movement key tapped and let go between two frames counts for the next one. A fast frame: no step.
  F.CATCH_MAX = 1; F.STEP = 0.1; F.CATCH_GAP = 10;
  F.MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'Space'];
  F.catchSteps = function (gap, dt) {
    const out = []; if (!(gap > dt + 0.02) || gap > F.CATCH_GAP) return out;
    let rest = Math.min(gap, F.CATCH_MAX) - dt;
    while (rest > 1e-6) { const s = Math.min(F.STEP, rest); out.push(s); rest -= s; }
    return out;
  };
  F.stepPlayer = function (pl, upd, dt, I) {
    const added = [];
    if (I && I.keys && I.pressed) for (const k of F.MOVE_KEYS) if (I.pressed.has(k) && !I.keys.has(k)) { I.keys.add(k); added.push(k); }
    try {
      const r = upd.call(pl, dt, I);
      const steps = F.catchSteps(pl.game && pl.game.f2gap || 0, dt);
      if (steps.length && I && I.mouse) {
        const m = I.mouse, sv = { dx: m.dx, dy: m.dy, wheel: m.wheel, clicked: m.clicked, pressed: I.pressed, dbl: I.doubleTap, pp: I.padPressed, tp: I.tPressed };
        m.dx = 0; m.dy = 0; m.wheel = 0; m.clicked = [false, false, false]; I.pressed = new Set(); I.doubleTap = new Set();
        if (sv.pp) I.padPressed = new Set(); if (sv.tp) I.tPressed = new Set();
        try { for (const s of steps) upd.call(pl, s, I); }
        finally { m.dx = sv.dx; m.dy = sv.dy; m.wheel = sv.wheel; m.clicked = sv.clicked; I.pressed = sv.pressed; I.doubleTap = sv.dbl; if (sv.pp) I.padPressed = sv.pp; if (sv.tp) I.tPressed = sv.tp; }
      }
      return r;
    } finally { for (const k of added) I.keys.delete(k); }
  };
  const P = VR.Player;
  if (P && P.prototype.update && !P.prototype.update.__f2) {
    const ou = P.prototype.update;
    P.prototype.update = function (dt, input) { return F.stepPlayer(this, ou, dt, input); };
    P.prototype.update.__f2 = true;
  }

  // the frame hook: the play state's first frame (settle, let go), the pointer
  if (G && G.prototype.playFrame && !G.prototype.playFrame.__f2) {
    const op = G.prototype.playFrame;
    G.prototype.playFrame = function (dt) {
      if (this.f2meta !== this.meta) { this.f2meta = this.meta; F.letGo(); this.f2t = 0; this.f2wait = 3; this.f2new = !!this.meta && !this.meta.player; }
      if (this.f2wait > 0 && this.arrival && this.arrival.phase !== 'full' && F.underVeil(this)) { this.f2wait = 0; const r = F.settle(this); if (r) r.phase = this.arrival.phase; }   // (f-hud: under the white)
      if (this.f2wait > 0 && !this.arrival && !(this.wow && this.wow.active) && !(this.ui && this.ui.screen) && --this.f2wait === 0) F.settle(this);
      { const n = performance.now(); this.f2gap = this.f2t && !(this.ui && this.ui.screen) ? (n - this.f2t) / 1000 : 0; this.f2t = n; }
      const r = op.apply(this, arguments);
      try { F.pointFrame(this, dt); } catch (e) { /* the pointer waits */ }
      return r;
    };
    G.prototype.playFrame.__f2 = true;
  }

  // 4 · the swarm's end near a lit rock, the ring's entry ending on the day side
  const C = VR.Cruise, F2 = VR.Fields2, U = VR.Universe;
  if (C && F2 && C.finish && !C.finish.__f2) {
    const of = C.finish;
    C.finish = function (fl, a, c) {
      const sw = c && c.end && c.end.frame === 'swarm';
      const r = of.apply(this, arguments);
      if (sw) try { F.swarmArrive(fl, a); } catch (e) { console.warn('first2 swarm', e); }
      return r;
    };
    C.finish.__f2 = true;
  }
  F.swarmArrive = function (fl, a) {
    const st = a && a.st; if (!st || st.frame !== 'helia' || !VR.Rubble || !U) return null;
    const S = U.home, t = st.t, h = S.pos('helia', t, new Float64Array(3)), rocks = [];
    for (const b of VR.Rubble.swarm().bodies) { const q = F2.rockPos(b.k, t); rocks.push({ k: b.k, D: b.D, q: [q[0] - h[0], q[1] - h[1], q[2] - h[2]] }); }
    const e = F.swarmEnd(st.r, rocks); if (!e) return null;
    const v = S.state(t).b.swarm.v;
    st.r.set(e.r); if (v) st.v.set(v);
    if (U.verletInit) U.verletInit(st, S.body('helia').mu);
    const AS = VR.Ascent, AM = AS && AS.math;
    if (AS && AS.slew) {
      const n = e.nose, up0 = Math.abs(n[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0], k = up0[0] * n[0] + up0[1] * n[1] + up0[2] * n[2];
      let up = [up0[0] - n[0] * k, up0[1] - n[1] * k, up0[2] - n[2] * k]; const ul = Math.hypot(up[0], up[1], up[2]) || 1; up = [up[0] / ul, up[1] / ul, up[2] / ul];
      for (let i = 0; i < 3; i++) AS.slew(a.S, n, up, Math.PI, Math.PI);
      if (AM && AM.ortho) AM.ortho(a.S);
    }
    F.lastSwarm = e;
    return e;
  };
  if (F2 && F2.entryStart && !F2.entryStart.__f2) {
    const oe = F2.entryStart;
    F2.entryStart = function (c, kind) {
      const E = oe.apply(this, arguments);
      try { if (kind === 'ring' && E) F.ringDay(c, E); } catch (e) { /* the old way */ }
      return E;
    };
    F2.entryStart.__f2 = true;
  }
  // the ring's way swung so the entry ends 55° from the subsolar point (Helia behind the shoulder, the sheet lit, out of
  // the giant's shadow) — as fields2 does for the cloud tops
  F.ringDay = function (c, E) {
    const S = U.home, A = S.body('amarant'), q = S.pos('amarant', c.t, new Float64Array(3)), hs = S.state(c.t).b.helia.r;
    const sd = [hs[0] - q[0], hs[1] - q[1], hs[2] - q[2]], l = Math.hypot(sd[0], sd[1], sd[2]) || 1;
    const d1 = (sd[0] * E.e1[0] + sd[1] * E.e1[1] + sd[2] * E.e1[2]) / l, d2 = (sd[0] * E.e2[0] + sd[1] * E.e2[1] + sd[2] * E.e2[2]) / l;
    const ths = Math.atan2(d2, d1), rm = (E.rho0 + E.rT) / 2, thN = (Math.sqrt(A.mu / (rm * rm * rm)) + (F2.RING_DV || 0) / rm) * F2.ENTRY_S;
    let x = ths - 55 * Math.PI / 180 - thN; x = ((x % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI; E.thX = x;
    return x;
  };

  // 1 · the hand: entities.drawHand reads F.HAND and F.cine (no wrap needed)

  // 5 · ⚙ Einfach: three sliders and the live preview; „Alle Einstellungen" for the rest
  if (VR.Settings && VR.Settings.add) VR.Settings.add({ key: 'bright', g: 'img', sec: 'show', t: 'slider', lab: 'g.first2.bright', tip: 'g.first2.brightTip', def: 1, min: F.BRIGHT.min, max: F.BRIGHT.max, step: F.BRIGHT.step, fmt: 'pct', cost: 'mid' });
  F.applyBright = function (g) { const c = g && g.canvas; if (c && c.style) { const f = F.brightCss(g.settings && g.settings.bright); if (c.style.filter !== f) c.style.filter = f; } };
  if (G && G.prototype.applySettings && !G.prototype.applySettings.__f2) {
    const oa = G.prototype.applySettings;
    G.prototype.applySettings = function (key) { const r = oa.apply(this, arguments); try { F.applyBright(this); } catch (e) { /* */ } return r; };
    G.prototype.applySettings.__f2 = true;
  }
  // the preview: drawn from the frame just made; a black copy (a drawing buffer already handed on) is read back instead
  F.previewTries = 0;
  if (G && G.prototype.capturePreview && !G.prototype.capturePreview.__f2) {
    G.prototype.capturePreview = function () {
      if (!this.previewAt || this.frame < this.previewAt) return;
      this.previewAt = 0;
      const c = this.ui && this.ui.previewCtx;
      if (!c || !this.canvas || !this.canvas.width) return;
      let ok = false;
      try { c.drawImage(this.canvas, 0, 0, c.canvas.width, c.canvas.height); ok = F.lit(c); } catch (e) { ok = false; }
      if (!ok) { try { ok = F.readBack(this, c); } catch (e) { ok = false; } }
      if (!ok && F.previewTries++ < 12) this.previewAt = this.frame + 1; else F.previewTries = 0;
      F.lastPreview = ok;
    };
    G.prototype.capturePreview.__f2 = true;
  }
  F.lit = function (c) {
    const W = c.canvas.width, H = c.canvas.height, d = c.getImageData(0, 0, W, H).data; let s = 0, n = 0;
    for (let i = 0; i < d.length; i += 4 * 97) { s += d[i] + d[i + 1] + d[i + 2]; n++; }
    return n > 0 && s / n > 12;
  };
  F.readBack = function (g, c) {
    const gl = g.renderer && g.renderer.gl; if (!gl) return false;
    const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight; if (!W || !H) return false;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const px = new Uint8Array(W * H * 4); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const w = c.canvas.width, h = c.canvas.height, img = c.createImageData(w, h), o = img.data;
    for (let y = 0; y < h; y++) {
      const sy = H - 1 - Math.floor((y + 0.5) * H / h);
      for (let x = 0; x < w; x++) { const sx = Math.floor((x + 0.5) * W / w), i = (sy * W + sx) * 4, j = (y * w + x) * 4; o[j] = px[i]; o[j + 1] = px[i + 1]; o[j + 2] = px[i + 2]; o[j + 3] = 255; }
    }
    c.putImageData(img, 0, 0);
    return F.lit(c);
  };
  F.renderSimple = function (ui) {
    const g = ui.game, S = g.settings, tabs = document.getElementById('settabs'), body = document.getElementById('setbody');
    if (!tabs || !body) return false;
    const bar = document.getElementById('setbar'); if (bar) bar.style.display = 'none';
    tabs.innerHTML = ''; body.innerHTML = '';
    const mkb = (cls, text, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = cls; b.textContent = text; b.onclick = fn; return b; };
    tabs.appendChild(mkb('on', tx('g.first2.simple', null, 'Einfach', 'Simple'), () => {}));
    tabs.appendChild(mkb('', tx('g.first2.all', null, 'Alle Einstellungen …', 'All settings …'), () => { ui.setAll = true; ui.showSettings('img'); }));
    const pv = document.createElement('div'); pv.className = 'pvwrap f2pv';
    pv.innerHTML = '<canvas class="pv" width="320" height="180"></canvas>';
    body.appendChild(pv);
    ui.previewCtx = pv.querySelector('canvas').getContext('2d');
    if (F.paintThumb) F.paintThumb(ui.previewCtx);   // f-first3: the world at once (the copy kept when the menu opened)
    const row = (lab, tip, val, min, max, step, show, set) => {
      const d = document.createElement('div'); d.className = 'setrow f2row';
      d.innerHTML = '<div class="sethead"><label></label><span class="val"></span></div>';
      d.querySelector('label').textContent = lab; const vEl = d.querySelector('.val'); vEl.textContent = show(val);
      const inp = document.createElement('input'); inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step; inp.value = val; inp.setAttribute('aria-label', lab);
      inp.oninput = () => { const v = +inp.value; vEl.textContent = show(v); set(v); if (g.requestPreview) g.requestPreview(); };
      inp.onchange = () => { if (g.saveSettings) g.saveSettings(); };
      d.appendChild(inp);
      const t = document.createElement('div'); t.className = 'setip'; t.textContent = tip; d.appendChild(t);
      body.appendChild(d);
    };
    const pn = (i) => { const k = { potato: 'g.set.pVeryLow', low: 'g.set.pLow', balanced: 'g.set.pBalanced', high: 'g.set.pHigh', ultra: 'g.set.pUltra' }[F.GFX[i]]; return VR.I18N && VR.I18N.t ? VR.I18N.t(k) : F.GFX[i]; };
    row(tx('g.first2.gfx', null, 'Grafik', 'Graphics'), tx('g.first2.gfxTip', null, 'Links: schneller auf schwachen Rechnern. Rechts: schöner.', 'Left: faster on weak computers. Right: prettier.'), F.gfxIndex(S.preset), 0, 4, 1, pn, (v) => { if (g.applyPreset) g.applyPreset(F.GFX[v]); });
    row(tx('g.first2.bright', null, 'Helligkeit', 'Brightness'), tx('g.first2.brightTip', null, 'Heller oder dunkler — für deinen Bildschirm.', 'Lighter or darker — for your screen.'), S.bright || 1, F.BRIGHT.min, F.BRIGHT.max, F.BRIGHT.step, (v) => Math.round(v * 100) + ' %', (v) => { S.bright = v; F.applyBright(g); });
    const X = VR.UX;
    row(tx('g.first2.scale', null, 'UI-Größe', 'UI size'), tx('g.first2.scaleTip', null, 'Knöpfe und Schrift größer oder kleiner.', 'Buttons and text bigger or smaller.'), S.uiScale || 1, X ? X.SCALE_MIN : 0.9, X ? X.SCALE_MAX : 1.4, 0.05, (v) => Math.round(v * 100) + ' %', (v) => { if (X && X.setScale) X.setScale(v); else S.uiScale = v; });
    if (g.requestPreview) { g.requestPreview(); g.previewAt = g.frame + 1; }   // (f-first3: the next frame, not two later)
    return true;
  };
  if (UI && UI.prototype.showSettings && !UI.prototype.showSettings.__f2) {
    const os = UI.prototype.showSettings;
    UI.prototype.showSettings = function (group) {
      if (F.simpleOn(this) && !this.settingsKeys) { this.show('settings'); if (F.renderSimple(this)) return; }
      const bar = document.getElementById('setbar'); if (bar) bar.style.display = '';
      const r = os.apply(this, arguments);
      try {   // (Einfach's way back from „Alle Einstellungen")
        const tabs = document.getElementById('settabs');
        if (this.setAll && !(VR.UIPrefs && VR.UIPrefs.get().pro) && tabs && !tabs.querySelector('.f2back')) {
          const b = document.createElement('button'); b.type = 'button'; b.className = 'f2back'; b.textContent = '← ' + tx('g.first2.back', null, 'Einfach', 'Simple');
          b.onclick = () => { this.setAll = false; this.showSettings(); }; tabs.insertBefore(b, tabs.firstChild);
        }
      } catch (e) { /* the tabs as they are */ }
      return r;
    };
    UI.prototype.showSettings.__f2 = true;
  }
  // ---- f-first3 (R55-10, critic_ux_v054_10_settings: the preview box empty in the picture — under a slow GPU the two frames
  // the capture waited for came after the look): a menu opened over the game (the pause, ⚙) keeps a 320 × 180 copy of the
  // next frame (F.thumb: one drawImage when the menu opens, nothing per frame), and ⚙ Einfach paints it into its preview at
  // once, then asks for a fresh one on the next frame (not two later)
  F.thumb = null; F.thumbOk = false;
  F.keepThumb = function (g) {
    if (!hasDoc || !g || !g.canvas || !g.canvas.width) return false;
    const T = F.thumb || (F.thumb = document.createElement('canvas')); if (T.width !== 320) { T.width = 320; T.height = 180; }
    const c = T.getContext('2d'); let ok = false;
    try { c.drawImage(g.canvas, 0, 0, T.width, T.height); ok = F.lit(c); } catch (e) { ok = false; }
    if (!ok) { try { ok = F.readBack(g, c); } catch (e) { ok = false; } }
    F.thumbOk = ok; return ok;
  };
  F.paintThumb = function (ctx) { if (!F.thumbOk || !F.thumb || !ctx || !ctx.canvas) return false; try { ctx.drawImage(F.thumb, 0, 0, ctx.canvas.width, ctx.canvas.height); return true; } catch (e) { return false; } };
  if (G && G.prototype.capturePreview && !G.prototype.capturePreview.__f3) {
    const oc = G.prototype.capturePreview;
    G.prototype.capturePreview = function () {
      if (this.thumbAt && this.frame >= this.thumbAt) { this.thumbAt = 0; if (!F.keepThumb(this) && (this.thumbTries = (this.thumbTries || 0) + 1) < 6) this.thumbAt = this.frame + 1; else this.thumbTries = 0; }
      return oc.apply(this, arguments);
    };
    G.prototype.capturePreview.__f3 = true;
  }
  if (UI && UI.prototype.show && !UI.prototype.show.__f3) {
    const osh = UI.prototype.show;
    UI.prototype.show = function (id) {
      const g = this.game, was = this.screen;
      if (g && g.state === 'play' && id && (!was || was === 'hud') && (id === 'pause' || id === 'settings')) g.thumbAt = g.frame;   // (the frame drawn next: the world as it was)
      return osh.apply(this, arguments);
    };
    UI.prototype.show.__f3 = true;
  }
  // the pause menu forgets „Alle Einstellungen" (the next ⚙ opens Einfach again)
  if (UI && UI.prototype.resume && !UI.prototype.resume.__f2) { const orr = UI.prototype.resume; UI.prototype.resume = function () { this.setAll = false; return orr.apply(this, arguments); }; UI.prototype.resume.__f2 = true; }

  // 5 · J and O answer in a world without the Abenteuer (after quests.js's and rpg.js's own listeners)
  F.keyNote = function (g, code) {
    if (!g || g.state !== 'play' || !g.ui || g.ui.screen || g.ui.typing || g.studioOpen || g.flight || g.photo) return false;
    if (VR.Adventure && VR.Adventure.on && VR.Adventure.on()) return false;
    if (code === 'KeyJ') g.ui.toast(tx('g.first2.jTitle', null, '📖 Tagebuch', '📖 Journal'), tx('g.first2.jNote', null, 'Das Tagebuch sammelt Aufträge in Abenteuer-Welten. Hier baust du frei — Esc → ⚔ Abenteuer schaltet es ein.', 'The journal collects tasks in adventure worlds. Here you build freely — Esc → ⚔ Adventure turns it on.'));
    else g.ui.toast(tx('g.first2.oTitle', null, '🧭 Charakter', '🧭 Character'), tx('g.first2.oNote', null, 'Charakter und Ausrüstung gibt es in Abenteuer-Welten. Esc → ⚔ Abenteuer schaltet es hier ein.', 'Character and gear live in adventure worlds. Esc → ⚔ Adventure turns them on here.'));
    return true;
  };
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
    const B = VR.Binds && VR.Binds.current, isJ = B && B.codesFor ? (B.codesFor('KeyJ') || ['KeyJ']).indexOf(e.code) >= 0 : e.code === 'KeyJ', isO = false;   // (O: since u-stars2 the star map answers it in every world)
    if (!isJ && !isO) return;
    const t = e.target; if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
    const g = game(); if (!g || g.state !== 'play' || (g.ui && g.ui.screen)) return;
    setTimeout(() => { try { if (!(g.ui && g.ui.screen)) F.keyNote(g, isJ ? 'KeyJ' : 'KeyO'); } catch (err) { /* silent */ } }, 0);
  });

  // the pointer's and the badge's look
  const CSS = `#f2point { position: absolute; left: 50%; top: 46px; transform: translateX(-50%); z-index: 6; pointer-events: none; display: none; font: 800 16px/1 var(--font, system-ui, sans-serif); color: #ffe2a0; padding: 6px 12px; border-radius: 12px; background: rgba(28, 18, 4, .55); border: 1px solid rgba(255, 209, 102, .45); text-shadow: 0 1px 2px #000; letter-spacing: .5px; }
#modebadge.f2adv { color: #ffe2a0; border-color: rgba(255, 209, 102, .55); background: rgba(60, 38, 6, .6); }
#settings .f2pv canvas { width: 100%; max-width: 480px; height: auto; aspect-ratio: 16 / 9; display: block; margin: 0 auto 10px; border-radius: 10px; background: #0d1220; }
#settings .f2row input[type=range] { width: 100%; }
body.storyon #f2point { visibility: hidden !important; }`;
  const css = () => { if (document.getElementById('f2css') || !document.head) return; const s = document.createElement('style'); s.id = 'f2css'; s.textContent = CSS; document.head.appendChild(s); };
  if (document.head) css(); else document.addEventListener('DOMContentLoaded', css);
})(VR);
