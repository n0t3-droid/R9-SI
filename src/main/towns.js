// ============================================================================
// u-worlds5 · VR.Towns — reasons to stay in a native town (plan docs/superpowers/plans/2026-10-31-u-worlds5.md):
//   · the species market: a town's traders (bgen 6's and 5's towns, worldeco.js townPlan) keep a shop of their own in
//     Abenteuer worlds — three things of that world (each world its own) and the species' building set (its walls,
//     band, roof, floor, windows, door, light and both pavings), paid in Heliataler through VR.Shop (shop.js: catalog,
//     quote, buy, the screen). A plain village's trader keeps the old talk.
//   · the landmark's view: bgen 6's landmarks are climbable (worldeco.js climbOps: a ladder to a deck); standing on the
//     deck once per world shows the view's toast and gives a small reward — in Abenteuer XP and Heliataler (the
//     awards 'wow' and 'chest', once per id), elsewhere two of the species' crystals or lanterns.
// The record: meta.towns = {[kind]: {view: 1}} (additive; an odd record reads as new). Cost 🟢: one box test a frame
// while a town is awake.
// ============================================================================
(function (VR) {
  'use strict';
  const T = (k, v) => (VR.I18N ? VR.I18N.t(k, v) : k), nm = (id) => (VR.itemName ? VR.itemName(id) : id);
  const TW = VR.Towns = {};
  const KINDS = TW.KINDS = ['aqua', 'ocker', 'zinn', 'basalt', 'opal'];
  // three things of each world (only there), Heliataler
  TW.GOODS = {
    aqua: [['tide_lantern', 30], ['tube_coral_block', 18], ['sea_pickle', 12]],
    ocker: [['amber_crystal_block', 35], ['orange_terracotta', 10], ['cactus', 8]],
    zinn: [['glowing_obsidian', 40], ['sulfur_bricks', 18], ['polished_sulfur', 15]],
    basalt: [['azure_crystal_block', 35], ['regolith_dark', 10], ['regolith', 8]],
    opal: [['rose_crystal_block', 35], ['tholin_ice', 16], ['ice_crystal', 14]],
  };
  TW.SET_PRICE = 120;
  // the building set: the species' kit (bgen 6), counts per part, the same block merged
  TW.setParts = function (kind) {
    const E = VR.WorldEco, K = E && E.kit(kind, 6); if (!K) return [];
    const want = [[K.wall, 32], [K.band, 16], [K.roof, 24], [K.floor, 24], [K.window, 8], [K.door, 2], [K.light, 4], [K.pave4[0], 24], [K.pave4[1], 24]];
    const m = new Map(); for (const [id, n] of want) if (id && VR.R && VR.R.byName[id]) m.set(id, (m.get(id) || 0) + n);
    return [...m.entries()];
  };
  TW.REWARD = { aqua: { id: 'tide_lantern', n: 2 }, ocker: { id: 'amber_crystal_block', n: 2 }, zinn: { id: 'glowing_obsidian', n: 2 }, basalt: { id: 'azure_crystal_block', n: 2 }, opal: { id: 'rose_crystal_block', n: 2 } };
  TW.VIEW_TALER = 30;
  TW.shopId = (kind) => 'sp_' + kind;
  // the shop a native keeps: a town's trader the species market, anyone else none of ours
  TW.shopFor = function (a) {
    const P = a && a.vil && a.vil.plan, role = a && (a.role || (a.p && a.p.role));
    return P && P.town && role === 'trader' && KINDS.indexOf(P.species) >= 0 ? TW.shopId(P.species) : null;
  };

  // ---------------------------------------------------------------- the market inside VR.Shop (its catalogue, its words)
  const S = VR.Shop;
  if (S && !S.__towns) {
    S.__towns = true;
    for (const k of KINDS) { S.SHOPS.push(TW.shopId(k)); S.ICON[TW.shopId(k)] = '🏺'; }
    const cat0 = S.catalog, cache = {};
    S.catalog = function (shop) {
      const k = typeof shop === 'string' && shop.slice(0, 3) === 'sp_' ? shop.slice(3) : null;
      if (!k || !TW.GOODS[k]) return cat0.apply(this, arguments);
      if (cache[shop]) return cache[shop];
      const out = [];
      for (const [id, price] of TW.GOODS[k]) if (VR.R && VR.R.byName[id]) out.push({ key: 'item:' + id, kind: 'item', id, price, cat: 'item' });
      const parts = TW.setParts(k);
      if (parts.length) out.push({ key: 'kit:' + shop, kind: 'kit', id: shop, price: TW.SET_PRICE, parts, cat: 'kit' });
      return (cache[shop] = out);
    };
    // a town's trader: the market's button first in the talk's row (Abenteuer only, as every shop)
    const tb = S.talkButtons;
    S.talkButtons = function (mgr, a, box) {
      const sh = TW.shopFor(a);
      if (!sh || !box || !(VR.Adventure && VR.Adventure.on && VR.Adventure.on())) return tb.apply(this, arguments);
      const b = document.createElement('button');
      b.className = 'btn small shopbtn'; b.textContent = T('g.shop.btn.' + sh); b.setAttribute('data-shop', sh);
      b.onclick = () => { if (mgr && mgr.chirp) mgr.chirp(a); S.open(sh, a, mgr); };
      if (box.insertBefore && box.firstChild) box.insertBefore(b, box.firstChild); else box.appendChild(b);
      return 1;
    };
  }

  // ---------------------------------------------------------------- the view from the landmark
  // on the deck: within its gallery (4.5 from the shaft), at the deck's height (not at its foot, not in the shaft)
  TW.onDeck = function (P, pos) {
    const C = P && P.landmark && P.landmark.climb; if (!C || !pos) return false;
    return Math.max(Math.abs(pos[0] - C.x - 0.5), Math.abs(pos[2] - C.z - 0.5)) <= 4.5 && pos[1] >= C.deck - 0.3 && pos[1] <= C.deck + 2.5;
  };
  TW.rec = function (meta, kind) {
    const m = meta.towns && typeof meta.towns === 'object' ? meta.towns : (meta.towns = {});
    const r = m[kind] && typeof m[kind] === 'object' ? m[kind] : (m[kind] = {});
    return r;
  };
  // {first} the first time in this world, then {first: false}
  TW.view = function (meta, kind) {
    const r = TW.rec(meta, kind);
    if (r.view) return { first: false };
    r.view = 1;
    return { first: true, reward: TW.REWARD[kind] };
  };
  TW.reward = function (g, kind, P) {
    const A = VR.Adventure, inv = g.player && g.player.inv, rw = TW.REWARD[kind], id = 'view:' + kind + ':' + (P.id || '');
    let sub = '';
    if (A && A.on && A.on()) {
      const a = A.award('wow', { id }), b = A.award('chest', { id, taler: TW.VIEW_TALER });
      sub = T('g.town.rewardAdv', { xp: (a && a.xp) | 0, t: (b && b.taler) | 0 });
    } else if (inv && rw) { inv.add(rw.id, rw.n); sub = T('g.town.reward', { n: rw.n, item: nm(rw.id) }); if (g.ui && g.ui.updateHUD) g.ui.updateHUD(true); }
    return sub;
  };
  const Vs = VR.Villages;
  if (Vs && !Vs.prototype.__towns) {
    const VP = Vs.prototype; VP.__towns = true;
    const up = VP.update;
    VP.update = function (dt) {
      const r = up.apply(this, arguments);
      const g = this.g, p = g && g.player; if (!p || !g.meta) return r;
      for (const vil of this.known.values()) {
        const P = vil.active && vil.plan; if (!P || !P.town || !P.landmark || !P.landmark.climb) continue;
        if (!TW.onDeck(P, p.pos)) { vil._deckT = 0; continue; }
        if ((vil._deckT = (vil._deckT || 0) + dt) < 0.6 || vil._viewed) continue;
        vil._viewed = true;
        const kind = P.species, v = TW.view(g.meta, kind);
        const title = '🔭 ' + T('g.town.view', { lm: T('g.town.lm.' + kind), town: P.name || vil.name || '' });
        if (g.ui && g.ui.toast) g.ui.toast(title, v.first ? TW.reward(g, kind, P) : T('g.town.again'), null);
        TW.last = { kind, first: v.first, t: Date.now() };
      }
      return r;
    };
  }
  // the player-facing words (lang_de.js / lang_en.js)
  TW.keys = function () {
    const k = ['g.town.view', 'g.town.reward', 'g.town.rewardAdv', 'g.town.again'];
    for (const kind of KINDS) k.push('g.shop.title.sp_' + kind, 'g.shop.btn.sp_' + kind, 'g.shop.kit.sp_' + kind, 'g.town.lm.' + kind);
    return k;
  };
})(VR);
