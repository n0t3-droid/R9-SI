// ============================================================================
// Die Läden des Abenteuers (a-quests; plan docs/superpowers/plans/2026-10-22-a-quests.md, spec
// docs/superpowers/specs/2026-10-22-abenteuer-design.md §4). VR.Shop — Sterntaler earned in the world, spent here:
//   🛒 Supermarkt  the cashiers (and the clerk) sell the groceries catalogue (groceries.js 50–77, VR.SHOP) at its own
//                  prices — 1 credit of the catalogue is 1 Sterntaler; the offers (Angebote) are cheaper
//   🛠 Werkstatt   the smith, the crafter, the factory worker: tools, the suit modules and the boots of A§4
//   🚀 Hangar      the pilot and the flight controller: engine, shield, jump core (in steps), Funke's modules, things
//                  that fly
//   🧱 Baumarkt    the builder: building kits — sets of our own blocks for a corner of the world
//   Selling        the Werkstatt and the Hangar buy metals and crystals at A§4's prices (VR.Adv.SELL); the supermarket and
//                  the Baumarkt buy nothing; in Kreativ and Zen nobody buys (everything is free there)
//   Refusals       said in plain words: too few Taler (how many are missing), the top step, bought already, a full
//                  backpack (checked before paying — nothing is ever paid for what does not fit)
// Only in Abenteuer worlds (VR.Adventure.on()); a builder's world keeps its cashiers as decoration. Never real money: the
// Sterntaler are whole numbers that come from quests, levels and selling, and never go below zero.
// The pure part (catalogues, quote, buy, sell) is node-tested (test/shop.js); the screen #shop, the talk button and the
// cashier's invitation at the till are the glue (villages.js has one marked line at the till; talkOptions is wrapped).
// ============================================================================
(function (VR) {
  'use strict';
  const S = VR.Shop = {};
  const T = (k, v) => (VR.I18N ? VR.I18N.t(k, v) : k);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hasDoc = typeof document !== 'undefined' && !!document.createElement;
  const game = () => VR.game || null;
  const Adv = () => VR.Adv;
  const exists = (id) => !!((VR.itemDef && VR.itemDef(id)) || (VR.R && VR.R.byName && VR.R.byName[id]));
  const fmt = (n) => { try { return Number(n).toLocaleString(VR.I18N && VR.I18N.locale ? VR.I18N.locale() : undefined); } catch (e) { return String(n); } };

  S.SHOPS = ['supermarkt', 'werkstatt', 'hangar', 'baumarkt'];
  const ROLE = { cashier: 'supermarkt', clerk: 'supermarkt', smith: 'werkstatt', crafter: 'werkstatt', worker: 'werkstatt', pilot: 'hangar', operator: 'hangar', builder: 'baumarkt' };
  S.shopOf = (role) => (Object.prototype.hasOwnProperty.call(ROLE, role) ? ROLE[role] : null);
  S.ICON = { supermarkt: '🛒', werkstatt: '🛠', hangar: '🚀', baumarkt: '🧱' };
  // the Werkstatt's tools (Sterntaler; the tech items at the catalogue's prices where it has them)
  const TOOLS = [['iron_pickaxe', 40], ['iron_axe', 30], ['iron_shovel', 25], ['shears', 15], ['compass', 15], ['clock', 15], ['spyglass', 25], ['scanner', 60], ['diamond_pickaxe', 150], ['builder_wand', 120], ['jetpack', 300]];
  const WERK_UPS = ['suitHeat', 'suitCold', 'suitPressure', 'suitRad', 'boots', 'anchor'];
  const HANGAR_UPS = ['engine', 'shield', 'jump', 'scanner', 'repair', 'camera'];
  const HANGAR_ITEMS = [['energy_cell', 12], ['photo_drone', 80], ['hoverbike', 180], ['shuttle_beacon', 250]];
  // the Baumarkt's kits: sets of our own blocks, each for a corner of the world
  const KITS = [
    { id: 'lanterns', price: 40, parts: [['vx_lamppost', 4], ['vx_lantern', 4]] },
    { id: 'lights', price: 45, parts: [['vx_garden_lamp', 6], ['vx_bollard', 4]] },
    { id: 'well', price: 50, parts: [['vx_well', 1], ['vx_bench', 2]] },
    { id: 'garden', price: 60, parts: [['vx_planter', 4], ['vx_flowerbed', 4], ['vx_bench', 2]] },
    { id: 'glass', price: 70, parts: [['vx_glass_wall', 32]] },
    { id: 'terrace', price: 80, parts: [['vm_garden_table', 1], ['vm_garden_chair', 4], ['vm_garden_parasol_sand', 1]] },
    { id: 'fountain', price: 90, parts: [['vx_fountain', 1], ['vx_flowerbed_roses', 4]] },
  ];
  // the categories' order on the supermarket's chips (the offers first)
  const CAT_ORDER = ['promo', 'fruit', 'veg', 'bakery', 'dairy', 'pantry', 'drinks', 'snacks', 'cereal', 'sweets', 'frozen', 'deli', 'flowers', 'home', 'pharmacy', 'toys', 'tech'];

  // ---------------------------------------------------------------- the catalogues (built once, only what exists)
  const cache = {};
  S.catalog = function (shop) {
    if (cache[shop]) return cache[shop];
    const out = [], A = Adv();
    if (shop === 'supermarkt') {
      const C = VR.SHOP && VR.SHOP.CATS;
      if (C) for (const k of CAT_ORDER.concat(Object.keys(C).filter(x => CAT_ORDER.indexOf(x) < 0))) {
        if (!C[k]) continue;
        for (const [id, p] of C[k].products) if (exists(id) && p > 0) out.push({ key: k + ':' + id, kind: 'item', id, price: Math.round(p), cat: k });
      }
    } else if (shop === 'werkstatt' || shop === 'hangar') {
      const ups = shop === 'werkstatt' ? WERK_UPS : HANGAR_UPS, items = shop === 'werkstatt' ? TOOLS : HANGAR_ITEMS;
      if (A) for (const id of ups) if (A.PRICES[id]) out.push({ key: 'up:' + id, kind: 'up', id, price: A.PRICES[id][0], cat: 'up' });
      for (const [id, p] of items) if (exists(id)) out.push({ key: 'item:' + id, kind: 'item', id, price: p, cat: 'item' });
    } else if (shop === 'baumarkt') {
      for (const k of KITS) if (k.parts.every(([id]) => exists(id))) out.push({ key: 'kit:' + k.id, kind: 'kit', id: k.id, price: k.price, parts: k.parts.map(p => p.slice()), cat: 'kit' });
    }
    return (cache[shop] = out);
  };
  S.entry = (shop, key) => { if (S.SHOPS.indexOf(shop) < 0) return null; for (const e of S.catalog(shop)) if (e.key === key) return e; return null; };
  // what an entry costs now: {price (null at the top), step, steps, max, owned}
  S.quote = function (me, shop, key) {
    const e = S.entry(shop, key); if (!e) return null;
    if (e.kind !== 'up') return { key, price: e.price, step: 0, steps: 0, max: false, owned: false };
    const A = Adv(), steps = A.PRICES[e.id].length, step = Math.min(steps, (me && me.owned && me.owned[e.id]) | 0);
    return { key, price: step < steps ? A.PRICES[e.id][step] : null, step, steps, max: step >= steps, owned: steps === 1 && step >= 1 };
  };
  // how many of an item fit into the backpack (36 slots, stacks of VR.maxStack)
  S.room = function (inv, id, n) {
    const max = VR.maxStack ? VR.maxStack(id) : 64; let r = 0;
    for (let i = 0; i < 36; i++) { const s = inv.slots[i]; if (!s) r += max; else if (s.id === id && !s.dmg) r += Math.max(0, max - s.n); if (r >= n) return n; }
    return r;
  };
  // do all the parts fit at once (a copy of the slots filled in turn)
  S.fits = function (inv, parts) {
    const slots = inv.slots.map(s => (s ? { id: s.id, n: s.n, dmg: s.dmg } : null));
    for (const [id, n] of parts) {
      const max = VR.maxStack ? VR.maxStack(id) : 64; let left = n;
      for (let i = 0; i < 36 && left > 0; i++) { const s = slots[i]; if (s && s.id === id && !s.dmg && s.n < max) { const k = Math.min(max - s.n, left); s.n += k; left -= k; } }
      for (let i = 0; i < 36 && left > 0; i++) if (!slots[i]) { const k = Math.min(max, left); slots[i] = { id, n: k }; left -= k; }
      if (left > 0) return false;
    }
    return true;
  };
  // buy: {ok, why: 'unknown' | 'poor' (missing) | 'max' | 'owned' | 'full', price}
  S.buy = function (me, inv, shop, key, mode) {
    const A = Adv(), e = S.entry(shop, key);
    if (!e || !A || !me) return { ok: false, why: 'unknown' };
    const tal = me.taler | 0;
    if (e.kind === 'up') {
      const q = S.quote(me, shop, key);
      if (q.max) return { ok: false, why: q.steps === 1 ? 'owned' : 'max', step: q.step };
      if (tal < q.price) return { ok: false, why: 'poor', price: q.price, missing: q.price - tal };
      const r = A.buy(me, e.id);
      return r.ok ? { ok: true, kind: 'up', id: e.id, price: r.price, step: r.step } : { ok: false, why: r.why, price: r.price, missing: r.why === 'poor' ? r.price - tal : 0 };
    }
    if (tal < e.price) return { ok: false, why: 'poor', price: e.price, missing: e.price - tal };
    const parts = e.kind === 'kit' ? e.parts : [[e.id, 1]];
    if (!inv || !S.fits(inv, parts)) return { ok: false, why: 'full', price: e.price };
    if (!A.pay(me, e.price)) return { ok: false, why: 'poor', price: e.price, missing: e.price - tal };
    for (const [id, n] of parts) inv.add(id, n);
    return { ok: true, kind: e.kind, id: e.id, price: e.price, parts };
  };
  // the shops that buy: the Werkstatt and the Hangar (metals, crystals — VR.Adv.SELL)
  S.BUYS = { werkstatt: true, hangar: true };
  S.sellable = function (shop, inv) {
    if (!S.BUYS[shop] || !inv) return [];
    const A = Adv(), seen = {}, out = [];
    for (const s of inv.slots) { if (!s || seen[s.id]) continue; seen[s.id] = 1; const p = A ? A.sellPrice(s.id) : 0; if (p > 0) out.push({ id: s.id, have: inv.count(s.id), price: p }); }
    return out;
  };
  // sell: {ok, why: 'nobuy' | 'mode' | 'none', got}
  S.sell = function (me, inv, shop, id, n, mode) {
    const A = Adv(); if (!A || !me || !inv) return { ok: false, why: 'nobuy' };
    const price = A.sellPrice(id);
    if (!S.BUYS[shop] || !(price > 0)) return { ok: false, why: 'nobuy' };
    if (mode && mode !== 'survival') return { ok: false, why: 'mode' };
    const have = inv.count(id); if (have <= 0) return { ok: false, why: 'none' };
    const k = Math.max(1, Math.min(have, Math.floor(n) || 1));
    if (!inv.remove(id, k)) return { ok: false, why: 'none' };
    const got = A.earn(me, k * price);
    return { ok: true, id, n: k, got };
  };

  // ---------------------------------------------------------------- the words
  const UP_FX = (id, me) => {
    const A = Adv(), q = me ? Math.min(A.PRICES[id].length, (me.owned && me.owned[id]) | 0) : 0, nx = Math.min(A.PRICES[id].length, q + 1);
    switch (id) {
      case 'engine': return T('g.shop.upx.engine', { p: 15 * nx });
      case 'shield': return T('g.shop.upx.shield', { s: A.SHIELD_SEC[nx] });
      case 'jump': return T('g.shop.upx.jump', { ly: A.JUMP_LY[nx] });
      default: return T('g.shop.upx.' + id);
    }
  };
  S.name = (e) => (e.kind === 'up' ? T('g.shop.up.' + e.id) : e.kind === 'kit' ? T('g.shop.kit.' + e.id) : (VR.itemName ? VR.itemName(e.id) : e.id));
  S.why = function (r, e) {
    if (!r) return '';
    if (r.ok) return r.got !== undefined ? T('g.shop.sold', { n: r.n, item: VR.itemName ? VR.itemName(r.id) : r.id, t: fmt(r.got) }) : T('g.shop.bought', { item: e ? S.name(e) : r.id, t: fmt(r.price) });
    switch (r.why) {
      case 'poor': return T('g.shop.poor', { n: fmt(r.missing) });
      case 'max': return T('g.shop.max');
      case 'owned': return T('g.shop.owned');
      case 'full': return T('g.shop.full');
      case 'mode': return T('g.shop.mode');
      case 'none': return T('g.shop.none');
      case 'nobuy': return T('g.shop.nobuy');
      default: return T('g.shop.unknown');
    }
  };
  const KEYS = ['g.shop.title.supermarkt', 'g.shop.title.werkstatt', 'g.shop.title.hangar', 'g.shop.title.baumarkt', 'g.shop.btn.supermarkt', 'g.shop.btn.werkstatt', 'g.shop.btn.hangar', 'g.shop.btn.baumarkt',
    'g.shop.keeper', 'g.shop.have', 'g.shop.buyTab', 'g.shop.sellTab', 'g.shop.buy', 'g.shop.sell1', 'g.shop.sellAll', 'g.shop.top', 'g.shop.done1', 'g.shop.back', 'g.shop.note', 'g.shop.nothingToSell', 'g.shop.each',
    'g.shop.poor', 'g.shop.max', 'g.shop.owned', 'g.shop.full', 'g.shop.mode', 'g.shop.none', 'g.shop.nobuy', 'g.shop.unknown', 'g.shop.bought', 'g.shop.sold', 'g.shop.till', 'g.shop.hello', 'g.shop.kitHas'];
  S.keys = function () {
    const k = KEYS.slice();
    for (const id of WERK_UPS.concat(HANGAR_UPS)) k.push('g.shop.up.' + id, 'g.shop.upx.' + id);
    for (const kit of KITS) k.push('g.shop.kit.' + kit.id);
    for (const c of CAT_ORDER) k.push('g.shop.cat.' + c);
    return k;
  };

  // ---------------------------------------------------------------- the glue
  const on = () => !!(VR.Adventure && VR.Adventure.on && VR.Adventure.on());
  const rec = () => (VR.Adventure && VR.Adventure.rec) || null;
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; if (!e.dataset) e.dataset = {}; return e; };
  S.st = { shop: null, keeper: null, mgr: null, tab: 'buy', cat: 'promo', lastMsg: '', lastOk: true };
  Object.defineProperty(S, 'lastMsg', { get: () => S.st.lastMsg });
  // the talk panel: the keeper's shop button (Abenteuer worlds only), first in the row
  S.talkButtons = function (mgr, a, box) {
    if (!box || !a || !on()) return 0;
    const shop = S.shopOf(a.role || (a.p && a.p.role)); if (!shop) return 0;
    const b = mk('button', 'btn small shopbtn', T('g.shop.btn.' + shop));
    b.dataset.shop = shop; if (b.setAttribute) b.setAttribute('data-shop', shop);
    b.onclick = () => { if (mgr && mgr.chirp) mgr.chirp(a); S.open(shop, a, mgr); };
    if (box.insertBefore && box.firstChild) box.insertBefore(b, box.firstChild); else box.appendChild(b);
    return 1;
  };
  function screen() {
    if (!hasDoc) return null;
    let s = document.getElementById('shop');
    if (!s) {
      css();
      s = mk('div', 'screen'); s.setAttribute('id', 'shop');
      const p = mk('div', 'panel box shopcard'); s.appendChild(p);
      const root = document.getElementById('ui') || document.body; root.appendChild(s);
    }
    return s;
  }
  S.open = function (shop, keeper, mgr) {
    const g = game(); if (!g || !g.ui || S.SHOPS.indexOf(shop) < 0 || !on()) return false;
    S.st.shop = shop; S.st.keeper = keeper || null; S.st.mgr = mgr || null; S.st.tab = 'buy'; S.st.cat = shop === 'supermarkt' ? 'promo' : null;
    S.st.lastMsg = keeper ? T('g.shop.hello', { n: keeper.p ? keeper.p.name : '' }) : ''; S.st.lastOk = true;
    screen(); g.ui.show('shop'); S.render();
    return true;
  };
  S.close = function () {
    const g = game(); if (!g || !g.ui) return;
    const k = S.st.keeper, mgr = S.st.mgr; S.st.shop = null;
    if (k && mgr && mgr.talking === k && g.ui.show) { g.ui.show('talk'); if (mgr.talkOptions) mgr.talkOptions(k); if (mgr.talkText) mgr.talkText(T('g.shop.done1')); }
    else if (g.ui.resume) g.ui.resume();
  };
  const inv = () => { const g = game(); return g && g.player && g.player.inv; };
  const mode = () => { const g = game(); return g && g.player ? g.player.mode || 'survival' : 'survival'; };
  S.act = function (what, key, n) {
    const r0 = rec(), g = game(); if (!r0 || !g || !S.st.shop) return null;
    let r = null;
    if (what === 'buy') { const e = S.entry(S.st.shop, key); r = S.buy(r0.me, inv(), S.st.shop, key, mode()); S.st.lastMsg = S.why(r, e); }
    else if (what === 'sell') { r = S.sell(r0.me, inv(), S.st.shop, key, n || 1, mode()); S.st.lastMsg = S.why(r); }
    else if (what === 'tab') S.st.tab = key === 'sell' ? 'sell' : 'buy';
    else if (what === 'cat') S.st.cat = key;
    else if (what === 'close') { S.close(); return null; }
    if (r) {
      S.st.lastOk = !!r.ok;
      if (r.ok) { if (g.audio && g.audio.play) g.audio.play('pop'); if (VR.Adventure.renderHud) VR.Adventure.renderHud(); if (g.saveMeta) { try { const p = g.saveMeta(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* the autosave keeps it */ } } }
      else if (g.audio && g.audio.play) g.audio.play('click');
    }
    S.render();
    return r;
  };
  const COIN = '<svg class="coin" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#ffc83d" stroke="#8a5208" stroke-width="1"/><circle cx="12" cy="12" r="8.4" fill="none" stroke="#fff1a8" stroke-opacity=".6" stroke-width=".8"/><path d="M12 5.8L13.47 9.98 17.9 10.08 14.38 12.77 15.64 17.02 12 14.5 8.36 17.02 9.62 12.77 6.1 10.08 10.53 9.98Z" fill="#fff6c8" stroke="#b86b0c" stroke-width=".6" stroke-linejoin="round"/></svg>';
  S.render = function () {
    const s = screen(), r0 = rec(), sh = S.st.shop; if (!s || !r0 || !sh) return;
    const p = s.querySelector('.panel'), me = r0.me, g = game(), k = S.st.keeper;
    let h = `<div class="shophead"><div><h2>${esc(T('g.shop.title.' + sh))}</h2>` + (k && k.p ? `<div class="note">${esc(T('g.shop.keeper', { n: k.name || k.p.name }))}</div>` : '') + `</div>`;
    h += `<div class="shoptal">${COIN}<b>${esc(fmt(me.taler))}</b><span>${esc(T('g.shop.have'))}</span></div></div>`;
    if (S.BUYS[sh]) h += `<div class="seg shoptabs"><button type="button" data-sact="tab" data-key="buy"${S.st.tab === 'buy' ? ' class="on"' : ''}>${esc(T('g.shop.buyTab'))}</button><button type="button" data-sact="tab" data-key="sell"${S.st.tab === 'sell' ? ' class="on"' : ''}>${esc(T('g.shop.sellTab'))}</button></div>`;
    if (S.st.lastMsg) h += `<div class="shopmsg${S.st.lastOk ? '' : ' no'}">${esc(S.st.lastMsg)}</div>`;
    const list = S.catalog(sh);
    if (S.st.tab === 'sell' && S.BUYS[sh]) {
      const items = S.sellable(sh, inv());
      h += '<div class="shopgrid">';
      if (!items.length) h += `<div class="note shopempty">${esc(T('g.shop.nothingToSell'))}</div>`;
      for (const it of items) h += `<div class="shopitem"><canvas width="40" height="40" data-icon="${esc(it.id)}"></canvas><div class="si"><b>${esc(VR.itemName ? VR.itemName(it.id) : it.id)}</b><small>× ${it.have} · ${esc(T('g.shop.each', { t: it.price }))}</small></div><div class="sb"><button type="button" class="btn small" data-sact="sell" data-key="${esc(it.id)}" data-n="1">${esc(T('g.shop.sell1'))}</button><button type="button" class="btn small" data-sact="sell" data-key="${esc(it.id)}" data-n="${it.have}">${esc(T('g.shop.sellAll'))}</button></div></div>`;
      h += '</div>';
    } else {
      if (sh === 'supermarkt') {
        const cats = []; for (const e of list) if (cats.indexOf(e.cat) < 0) cats.push(e.cat);
        if (cats.indexOf(S.st.cat) < 0) S.st.cat = cats[0];
        h += '<div class="shopcats">' + cats.map(c => `<button type="button" data-sact="cat" data-key="${c}"${c === S.st.cat ? ' class="on"' : ''}>${esc(T('g.shop.cat.' + c))}</button>`).join('') + '</div>';
      }
      h += '<div class="shopgrid">';
      for (const e of list) {
        if (sh === 'supermarkt' && e.cat !== S.st.cat) continue;
        const q = S.quote(me, sh, e.key), poor = q.price !== null && (me.taler | 0) < q.price;
        let sub = '';
        if (e.kind === 'up') sub = UP_FX(e.id, me);
        else if (e.kind === 'kit') sub = T('g.shop.kitHas', { list: e.parts.map(([id, n]) => n + ' × ' + (VR.itemName ? VR.itemName(id) : id)).join(', ') });
        let pips = '';
        if (e.kind === 'up' && q.steps > 1) { pips = '<span class="pips">'; for (let i = 0; i < q.steps; i++) pips += `<i${i < q.step ? ' class="on"' : ''}></i>`; pips += '</span>'; }
        const btn = q.max ? `<button type="button" class="btn small" disabled>${esc(T(q.owned ? 'g.shop.owned' : 'g.shop.top'))}</button>` : `<button type="button" class="btn small${poor ? ' poor' : ' primary'}" data-sact="buy" data-key="${esc(e.key)}">${esc(T('g.shop.buy'))}</button>`;
        const icon = e.kind === 'item' ? `<canvas width="40" height="40" data-icon="${esc(e.id)}"></canvas>` : `<span class="sico">${e.kind === 'up' ? (sh === 'hangar' ? '🚀' : '🛡') : '🧱'}</span>`;
        h += `<div class="shopitem${poor ? ' poor' : ''}${q.max ? ' max' : ''}">${icon}<div class="si"><b>${esc(S.name(e))}</b>${sub ? `<small>${esc(sub)}</small>` : ''}${pips}</div><div class="sb"><span class="price">${COIN}${q.price === null ? '—' : esc(fmt(q.price))}</span>${btn}</div></div>`;
      }
      h += '</div>';
    }
    h += `<div class="shopfoot"><span class="note">${esc(T('g.shop.note'))}</span><button type="button" class="btn small" data-sact="close">← ${esc(T('g.shop.back'))}</button></div>`;
    p.innerHTML = h;
    // the buttons (the panel is drawn again on every change: one handler each)
    if (p.querySelectorAll) for (const b of p.querySelectorAll('[data-sact]')) b.onclick = () => S.act(b.getAttribute('data-sact'), b.getAttribute('data-key'), +(b.getAttribute('data-n') || 1));
    if (g && g.icons && g.icons.paint && p.querySelectorAll) for (const c of p.querySelectorAll('canvas[data-icon]')) { try { g.icons.paint(c, c.getAttribute('data-icon'), 40); } catch (err) { /* no icon */ } }
  };
  // the cashier at the till (villages.js's one line): once per visit an invitation, when the player comes near
  const invited = new Set();
  S.reset = () => invited.clear();
  S.till = function (mgr, a, till, dt) {
    void dt;
    const g = mgr && mgr.g, p = g && g.player; if (!p || !a || !till || !on()) return false;
    const L = till.lane || till.cashier, d = Math.hypot(p.pos[0] - L[0] - 0.5, p.pos[2] - L[2] - 0.5);
    const id = a.p ? a.p.id : '';
    if (d > 12) { invited.delete(id); return false; }
    if (d > 6 || invited.has(id)) return false;
    invited.add(id);
    if (a.say) a.say(T('g.shop.till', { n: a.p ? a.p.name : '' }), 4);
    if (a.lookAt !== undefined) a.lookAt = [p.pos[0], p.pos[1] + 1.5, p.pos[2]];
    return true;
  };
  // Esc on the shop: back to the talk (or the game)
  if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('keydown', (e) => {
    const g = game(); if (e.key !== 'Escape' || !g || !g.ui || g.ui.screen !== 'shop') return;
    e.preventDefault(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); S.close();
  }, true);
  // the talk panel's buttons (villages.js talkOptions, wrapped: the original row, then the shop first)
  if (VR.Villages && VR.Villages.prototype.talkOptions && !VR.Villages.prototype.talkOptions.__shop) {
    const ot = VR.Villages.prototype.talkOptions;
    const nt = function (a) { const r = ot.apply(this, arguments); try { S.talkButtons(this, a, hasDoc ? document.querySelector('#tk_opts') : null); } catch (e) { console.warn('shop', e); } return r; };
    nt.__shop = true; VR.Villages.prototype.talkOptions = nt;
  }

  // ---------------------------------------------------------------- the look (the game's palette, injected once)
  let cssDone = false;
  function css() {
    if (cssDone || !hasDoc || !document.head) return; cssDone = true;
    const s = document.createElement('style'); s.id = 'shopcss'; s.textContent = CSS; document.head.appendChild(s);
  }
  const CSS = `
#shop { align-items: center; justify-content: center; background: radial-gradient(ellipse at 50% 35%, rgba(30, 24, 8, .3), rgba(3, 5, 12, .62)); }
.shopcard { width: min(880px, 96vw); display: flex; flex-direction: column; gap: 10px; }
.shopcard .shophead { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
.shopcard h2 { margin: 0; font-size: 26px; color: #ffe7a6; text-shadow: 0 0 14px rgba(255, 186, 76, .4); }
.shopcard .shoptal { display: flex; align-items: center; gap: 8px; padding: 6px 14px 6px 8px; border-radius: 999px; background: rgba(8, 12, 26, .7); border: 1px solid rgba(255, 209, 102, .45); }
.shopcard .shoptal b { font: 800 22px/1 var(--font); color: #ffe9b0; } .shopcard .shoptal span { color: var(--muted); font-size: 14px; }
.shopcard .coin { width: 22px; height: 22px; flex: none; filter: drop-shadow(0 0 3px rgba(255, 196, 80, .55)); }
.shopcard .shoptabs { max-width: 360px; }
.shopcard .shopmsg { padding: 9px 14px; border-radius: 12px; background: rgba(120, 220, 160, .14); border: 1px solid rgba(120, 220, 160, .45); color: #eafff2; font-size: 16px; }
.shopcard .shopmsg.no { background: rgba(255, 150, 90, .14); border-color: rgba(255, 170, 110, .55); color: #fff0e2; }
.shopcard .shopcats { display: flex; flex-wrap: wrap; gap: 6px; }
.shopcard .shopcats button { font: 600 14px var(--font); color: var(--text); background: var(--slot); border: 1px solid var(--line); border-radius: 999px; padding: 6px 12px; cursor: pointer; }
.shopcard .shopcats button.on { border-color: #ffd166; background: rgba(255, 209, 102, .18); color: #fff3cf; }
.shopcard .shopgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 8px; max-height: min(52vh, 460px); overflow: auto; padding-right: 4px; }
.shopcard .shopitem { display: grid; grid-template-columns: 44px 1fr auto; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 12px; background: var(--slot); border: 1px solid var(--line); }
.shopcard .shopitem.max { opacity: .7; }
.shopcard .shopitem canvas { width: 40px; height: 40px; image-rendering: pixelated; }
.shopcard .shopitem .sico { font-size: 28px; text-align: center; }
.shopcard .shopitem .si { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.shopcard .shopitem .si b { font: 700 16px/1.15 var(--font); color: #fff; }
.shopcard .shopitem .si small { font-size: 13px; color: var(--muted); line-height: 1.25; }
.shopcard .shopitem .pips { display: flex; gap: 3px; margin-top: 3px; } .shopcard .shopitem .pips i { width: 14px; height: 6px; border-radius: 3px; background: rgba(255, 255, 255, .12); } .shopcard .shopitem .pips i.on { background: #ffd166; box-shadow: 0 0 6px rgba(255, 209, 102, .7); }
.shopcard .shopitem .sb { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; }
.shopcard .shopitem .price { display: inline-flex; align-items: center; gap: 4px; font: 800 16px/1 var(--font); color: #ffe7a6; } .shopcard .shopitem .price .coin { width: 17px; height: 17px; }
.shopcard .shopitem.poor .price { color: #ffb08a; }
.shopcard .shopitem .btn.poor { opacity: .75; }
.shopcard .shopempty { grid-column: 1 / -1; padding: 12px; }
.shopcard .shopfoot { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.shopcard .shopfoot .note { font-size: 13px; }
.tkopts .shopbtn { border-color: rgba(255, 209, 102, .7); }
@media (max-width: 700px) { .shopcard .shopgrid { grid-template-columns: 1fr; } }
`;
})(VR);
