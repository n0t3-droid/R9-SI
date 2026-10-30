// ============================================================================
// Der Weg des Abenteurers in the game (a-rpg; plan docs/superpowers/plans/2026-10-30-a-rpg.md). The glue round the
// rules of src/shared/rpg.js (VR.RPG), only in an Abenteuer world (VR.Adventure on), never for a builder:
//   the character  [O] (or the ring's „Charakter" button on the ⚔ card): the level, the XP bar, the five stats of a-core
//                  with ＋ right there, the gear on a figure in rarity colours, what it all does in numbers, the bag
//   gear           a find when an outpost is freed (its id the seed: the same outpost, the same find), in a chest the
//                  world made (once per chest), from the boss; a find card with the fanfare; an empty slot is filled
//                  at once. Effects by wrapping, nothing edited elsewhere: Kraft → VR.Foes.hurtMob, Schutz →
//                  VR.Foes.hitPlayer, Glück → VR.Adv.award's Taler, Ruhe → VR.Liberate.calmArc, Abbau → A.mineMul
//   Anfängerglück  VR.Adv.award's XP ×2 below level 5, ×1.5 below 10 (VR.RPG.boost) — in the game's own record only
//   the conquest   the map tab: regions, outposts freed and not, the Kernfeuer, the world's percentage, the daily
//                  tribute (Tagesbonus) and Schnellreise (VR.Liberate.fastOpen)
//   the loot burst Heliataler of an award fly from the middle of the screen to the HUD's coin (DOM, 5–28 coins, CSS
//                  transforms only), a short fanfare in the day's key; rarity colours everywhere
//   the save       meta.adventure.rpg (VR.Adv.load keeps it: wrapped here)
// Cost 🟢: no per-frame work — a 2-Hz look (the chests' hook, the key) and DOM only when something happens.
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.RPG, Adv = VR.Adv; if (!R || !Adv) return;
  const T = (k, v) => (VR.I18N ? VR.I18N.t(k, v) : k);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hasDoc = typeof document !== 'undefined' && !!document.createElement;
  const game = () => VR.game || null;
  const A = () => VR.Adventure || null;
  const fmt = (n) => { try { return Number(n).toLocaleString(VR.I18N && VR.I18N.locale ? VR.I18N.locale() : undefined); } catch (e) { return String(n); } };
  const B = R.BAL;
  const RP = VR.RPGame = { ui: null, tab: 'hero', sel: -1, finds: [], stats: { finds: 0, bursts: 0, coins: 0, chests: 0, claims: 0 }, lastFind: null };

  // ---------------------------------------------------------------- the save: VR.Adv.load keeps meta.adventure.rpg
  if (!Adv.load.__rpg) { const ol = Adv.load; Adv.load = function (raw) { const r = ol.apply(this, arguments); if (raw && typeof raw === 'object' && raw.rpg && typeof raw.rpg === 'object') r.rpg = R.load(raw.rpg); return r; }; Adv.load.__rpg = true; }
  const clean = typeof WeakSet === 'function' ? new WeakSet() : null;
  // the world's gear record (sanitised once), null outside an Abenteuer world
  RP.st = function () {
    const a = A(); if (!a || !a.on || !a.on() || !a.rec) return null;
    const rec = a.rec;
    if (!rec.rpg || (clean && !clean.has(rec.rpg))) { rec.rpg = R.load(rec.rpg); if (clean) clean.add(rec.rpg); }
    return rec.rpg;
  };
  RP.save = function () { const g = game(); if (g && g.saveMeta && !(g.meta && g.meta.guest)) { try { const q = g.saveMeta(); if (q && q.catch) q.catch(() => {}); } catch (e) { /* the autosave keeps it */ } } };
  RP.mods = () => { const st = RP.st(); return st ? R.mods(st) : null; };

  // ---------------------------------------------------------------- the effects (wrapped, additive)
  // Anfängerglück and Glück: on the game's own record only (the pure award stays as a-core wrote it everywhere else)
  if (!Adv.award.__rpg) {
    const oa = Adv.award;
    Adv.award = function (me, kind) {
      const r = oa.apply(this, arguments), a = A();
      if (r && a && a.rec && me === a.rec.me && (r.xp > 0 || r.taler > 0)) {
        R.boost(Adv, me, r);
        const m = RP.mods(); if (m && r.taler > 0 && m.taler > 1) { const x = Math.round(r.taler * (m.taler - 1)); if (x > 0) { Adv.earn(me, x); r.taler += x; r.luck = x; } }
      }
      return r;
    };
    Adv.award.__rpg = true;
  }
  function wrapLate() {
    const F = VR.Foes, L = VR.Liberate, a = A();
    if (F && F.hurtMob && !F.hurtMob.__rpg) { const oh = F.hurtMob; F.hurtMob = function (En, m, dmg, from) { const k = RP.mods(); return oh.call(this, En, m, k && dmg > 0 ? dmg * k.dmg : dmg, from); }; F.hurtMob.__rpg = true; }
    if (F && F.hitPlayer && !F.hitPlayer.__rpg) { const op = F.hitPlayer; F.hitPlayer = function (g, h) { const st = RP.st(); if (st && h && h.dmg > 0 && (!h.p || h.p === (g && g.player) || !h.p.peer)) h = Object.assign({}, h, { dmg: R.harm(h.dmg, st) }); return op.call(this, g, h); }; F.hitPlayer.__rpg = true; }
    if (L && L.calmArc && !L.calmArc.__rpg) { const oc = L.calmArc; L.calmArc = function (ges) { const k = RP.mods(); return Math.min(170, oc.call(this, ges) + (k ? k.calm : 0)); }; L.calmArc.__rpg = true; }
    if (a && a.mineMul && !a.mineMul.__rpg) { const om = a.mineMul; a.mineMul = function () { const v = om.call(this), k = RP.mods(); return k ? v * k.mine : v; }; a.mineMul.__rpg = true; }
    if (a && a.award && !a.award.__rpg) {
      const ow = a.award;
      a.award = function (kind, ctx) {
        const r = ow.apply(this, arguments);
        try {
          if (r && (r.xp > 0 || r.taler > 0)) {
            const tl = (r.taler | 0) + (r.gift | 0);
            if (tl >= 15) RP.burst(tl, kind === 'freed' || kind === 'boss' ? 1.6 : 0);
            if (kind === 'freed' && ctx && ctx.id !== undefined) RP.later(() => RP.find('o:' + ctx.id, 'outpost'), 4600);
          }
        } catch (e) { console.warn('rpg', e); }
        return r;
      };
      a.award.__rpg = true;
    }
  }
  wrapLate();

  // ---------------------------------------------------------------- finds
  RP.later = (f, ms) => { if (typeof setTimeout === 'function') setTimeout(f, ms); else f(); };
  const lvl = () => { const a = A(); return a && a.rec ? a.rec.me.level | 0 : 0; };
  // a find: rolled, into the bag (an empty slot is filled at once), the card and the fanfare
  RP.find = function (seed, src, slot) {
    const st = RP.st(); if (!st) return null;
    const m = R.mods(st), it = R.roll(seed, src, lvl(), m ? (m.taler - 1) * 100 : 0, slot);
    const r = R.give(st, it); if (!r.ok) return null;
    let worn = false;
    if (!st.eq[it.s]) { const i = st.bag.indexOf(it); if (i >= 0) { R.equip(st, i); worn = true; } }
    if (r.taler) { const a = A(); Adv.earn(a.rec.me, r.taler); if (a.schedule) { a.floatTaler = (a.floatTaler || 0) + r.taler; a.schedule(); } }
    RP.stats.finds++; RP.lastFind = it;
    RP.card(it, worn, r.better);
    RP.fanfare(it.r);
    RP.save();
    if (RP.ui && RP.ui.screen === 'rpgchar') RP.render();
    return it;
  };
  RP.itemName = (it) => T('g.rpg.it.' + B.variants[it.s][it.v]);
  RP.perkText = (k, v) => T('g.rpg.pk.' + k, { v });
  const ICON = { tool: '✋', head: '⛑', body: '🦺', feet: '🥾' };
  // the chests the world made (a loot table): once each, a few Taler and sometimes a find (crafting.js g.openContainer
  // calls codex.onOpen(name, loot) — the loot tells a made chest from a placed one)
  function wrapChests(g) {
    if (!g || !g.openContainer || g.openContainer.__rpg) return;
    let loot = null;
    const cx = g.codex;
    if (cx && cx.onOpen && !cx.onOpen.__rpg) { const oo = cx.onOpen; cx.onOpen = function (name, l) { loot = l || null; return oo.apply(this, arguments); }; cx.onOpen.__rpg = true; }
    const oc = g.openContainer;
    g.openContainer = function (x, y, z, t) {
      loot = null; const res = oc.apply(this, arguments);
      try {
        if (loot && RP.st() && !(t && t.name === 'void_chest')) {
          const id = (x | 0) + '_' + (y | 0) + '_' + (z | 0), a = A(), rnd = R.rng('chest:' + id);
          const r = a.award('chest', { id, taler: 20 + Math.floor(rnd() * 80) });
          if (r && r.taler > 0) { RP.stats.chests++; if (rnd() < 0.55) RP.later(() => RP.find('c:' + id, 'chest'), 700); }
        }
      } catch (e) { console.warn('rpg', e); }
      return res;
    };
    g.openContainer.__rpg = true;
  }

  // ---------------------------------------------------------------- the sites as the rules want them
  RP.sites = function () {
    const L = VR.Liberate, a = A(); const out = [], seen = {};
    if (L && L.sites) for (const s of L.sites().values()) { seen[s.id] = 1; out.push({ id: s.id, x: s.x, z: s.z, y: s.y, tier: s.tier || 3, free: s.st === 'frei', name: L.nameOf ? L.nameOf(s) : s.id }); }
    const rec = a && a.rec;
    if (rec && rec.sites) for (const id in rec.sites) { if (seen[id]) continue; const o = rec.sites[id]; if (!o || !Number.isFinite(+o.x)) continue; seen[id] = 1; const s = { id, x: +o.x, z: +o.z, y: +o.y || 64, tier: L && L.tierOf ? L.tierOf(+o.x, +o.z) : 3, free: o.st === 'frei' }; s.name = L && L.nameOf ? L.nameOf(s) : id; out.push(s); }
    if (rec && rec.freed) for (const id in rec.freed) { if (seen[id]) continue; const o = rec.freed[id]; if (!o || !Number.isFinite(+o.x)) continue; const s = { id, x: +o.x, z: +o.z, y: +o.y || 64, tier: L && L.tierOf ? L.tierOf(+o.x, +o.z) : 3, free: true }; s.name = L && L.nameOf ? L.nameOf(s) : id; out.push(s); }
    return out;
  };
  RP.today = () => { const g = game(); return g && g.env ? g.env.day | 0 : 0; };
  RP.claim = function () {
    const st = RP.st(); if (!st) return 0;
    const n = R.claim(st, RP.sites(), RP.today(), Date.now()); if (n <= 0) return 0;
    const a = A(); Adv.earn(a.rec.me, n); RP.stats.claims++;
    if (a.schedule) { a.floatTaler = (a.floatTaler || 0) + n; a.schedule(); }
    RP.burst(n, 0); RP.fanfare(1); RP.save();
    return n;
  };
  RP.regionName = (g) => { const s = g.sites.slice().sort((a, b) => (a.id < b.id ? -1 : 1))[0]; return T('g.rpg.map.region', { name: s ? s.name : g.id }); };

  // ---------------------------------------------------------------- the character screen and the map
  const FIG = (st) => {
    const c = (s) => (st.eq[s] ? B.rarCol[st.eq[s].r] : 'rgba(255,255,255,.18)');
    // our own explorer: a rounded helmet with a visor, a suit with a chest light, a glove, boots (no other game's figure)
    return `<svg class="fig" viewBox="0 0 160 220" aria-hidden="true">
<defs><radialGradient id="rpgfg" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#2b3a5c"/><stop offset="1" stop-color="#121a2e"/></radialGradient></defs>
<ellipse cx="80" cy="208" rx="46" ry="7" fill="rgba(0,0,0,.35)"/>
<g stroke-linejoin="round" stroke-width="3">
<rect x="52" y="64" width="56" height="74" rx="16" fill="url(#rpgfg)" stroke="${c('body')}"/>
<circle cx="80" cy="96" r="7" fill="${st.eq.body ? c('body') : '#7fd8ff'}" opacity=".9"/>
<rect x="30" y="70" width="18" height="56" rx="9" fill="#1b2540" stroke="rgba(255,255,255,.18)"/>
<rect x="112" y="70" width="18" height="56" rx="9" fill="#1b2540" stroke="rgba(255,255,255,.18)"/>
<circle cx="121" cy="132" r="12" fill="#1b2540" stroke="${c('tool')}" stroke-width="4"/>
<rect x="58" y="136" width="18" height="52" rx="8" fill="#1b2540" stroke="rgba(255,255,255,.18)"/>
<rect x="84" y="136" width="18" height="52" rx="8" fill="#1b2540" stroke="rgba(255,255,255,.18)"/>
<path d="M54 186h24v14H50a4 4 0 0 1 4-14zM82 186h24a4 4 0 0 1 4 14H82z" fill="#1b2540" stroke="${c('feet')}" stroke-width="4"/>
<circle cx="80" cy="38" r="26" fill="#1b2540" stroke="${c('head')}" stroke-width="4"/>
<path d="M62 36q18-12 36 0v8q-18 8-36 0z" fill="${st.eq.head ? c('head') : '#7fd8ff'}" opacity=".85"/>
</g></svg>`;
  };
  const slotBox = (st, s) => {
    const it = st.eq[s], col = it ? B.rarCol[it.r] : 'rgba(255,255,255,.2)';
    return `<button type="button" class="rslot s-${s}${it ? ' has' : ''}" data-rp="slot" data-s="${s}" style="--rc:${col}" title="${esc(it ? RP.itemName(it) : T('g.rpg.slot.' + s))}"><i>${ICON[s]}</i><b>${esc(it ? RP.itemName(it) : T('g.rpg.slot.' + s))}</b><small>${esc(it ? T('g.rpg.rar.' + B.RAR[it.r]) : T('g.rpg.empty'))}</small></button>`;
  };
  const STAT_COL = { aus: '#ff7f93', ene: '#ffd84d', spu: '#7dffb4', ges: '#ffb35c', pil: '#7cc9ff' };
  const pct = (m) => Math.round((m - 1) * 100);
  RP.heroHtml = function () {
    const a = A(), rec = a.rec, me = rec.me, st = RP.st(), lv = Adv.levelOf(me.xp), p = Adv.points(me), e = Adv.effects(me.pts), S = R.stats(st);
    const top = me.level >= Adv.CAP;
    let h = `<div class="rhero"><div class="rfig">${FIG(st)}${B.SLOTS.map(s => slotBox(st, s)).join('')}<div class="rlv"><b>${me.level}</b><small>${esc(T('g.rpg.lv'))}</small></div></div><div class="rside">`;
    h += `<div class="rxp"><div class="rxpt"><b>${esc(top && me.stars ? T('g.adv.levelMax', { s: me.stars }) : T('g.adv.level', { n: me.level }))}</b><span>${esc(top ? T('g.adv.xpStar', { a: fmt(lv.into), b: fmt(lv.need) }) : T('g.adv.xp', { a: fmt(lv.into), b: fmt(lv.need), n: me.level + 1 }))}</span></div><div class="rbar"><i style="width:${(lv.frac * 100).toFixed(1)}%"></i></div>`;
    const bo = R.boostOf(me.level);
    h += `<div class="rrow"><span class="rtal"><i class="rcoin"></i>${esc(fmt(me.taler))}</span>${bo > 1 ? `<span class="rboost">${esc(T('g.rpg.boost', { k: bo }))}</span>` : ''}<span class="rpts${p ? ' has' : ''}">${esc(p ? T('g.rpg.pts', { n: p }) : T('g.adv.pts0'))}</span></div></div>`;
    const eff = { aus: T('g.adv.eff.aus', { hp: e.hp }), ene: T('g.adv.eff.ene', { e: pct(e.energy), b: pct(e.boost) }), spu: T('g.adv.eff.spu', { r: e.scan }), ges: T('g.adv.eff.ges', { s: pct(e.speed) }), pil: T('g.adv.eff.pil', { b: pct(e.boostTime), t: pct(e.turn) }) };
    h += '<div class="rstats">';
    for (const k of Adv.STATS) {
      const v = me.pts[k] | 0; let pips = ''; for (let i = 0; i < Adv.PT_MAX; i++) pips += `<i${i < v ? ' class="on"' : ''}></i>`;
      h += `<div class="rstat" style="--c:${STAT_COL[k]}"><div class="nm">${esc(T('g.adv.stat.' + k))}<small>${esc(eff[k])}</small></div><div class="pips">${pips}</div><button type="button" class="btn small plus" data-rp="pt" data-stat="${k}" aria-label="${esc(T('g.adv.plusTip'))}"${p && v < Adv.PT_MAX ? '' : ' disabled'}>＋</button></div>`;
    }
    h += '</div>';
    h += `<div class="rgear">${['kraft', 'schutz', 'glueck', 'ruhe', 'abbau'].map(k => `<span class="${S[k] ? 'on' : ''}">${esc(T('g.rpg.sum.' + k, { v: S[k] }))}</span>`).join('')}</div></div></div>`;
    // the bag
    h += `<div class="rbagh">${esc(T('g.rpg.bag', { n: st.bag.length, m: B.BAG }))}</div><div class="rbag">`;
    for (let i = 0; i < B.BAG; i++) { const it = st.bag[i]; h += it ? `<button type="button" class="ritem${i === RP.sel ? ' sel' : ''}" data-rp="pick" data-i="${i}" style="--rc:${B.rarCol[it.r]}" title="${esc(RP.itemName(it))}"><i>${ICON[it.s]}</i><b>${esc(RP.itemName(it))}</b></button>` : '<div class="ritem none"></div>'; }
    h += '</div>';
    const sel = st.bag[RP.sel];
    if (sel) {
      const w = st.eq[sel.s], d = R.power(sel) - R.power(w);
      h += `<div class="rdet" style="--rc:${B.rarCol[sel.r]}"><div><b>${esc(RP.itemName(sel))}</b> <span class="rr">${esc(T('g.rpg.rar.' + B.RAR[sel.r]))}</span><div class="rp">${sel.p.map(([k, v]) => esc(RP.perkText(k, v))).join(' · ')}</div><div class="rcmp ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${esc(w ? T(d > 0 ? 'g.rpg.better' : d < 0 ? 'g.rpg.worse' : 'g.rpg.same') : T('g.rpg.free'))}</div></div>`
        + `<button type="button" class="btn primary small" data-rp="equip">${esc(T('g.rpg.equip'))}</button><button type="button" class="btn small" data-rp="salvage">${esc(T('g.rpg.salvage', { n: B.salvage[sel.r] }))}</button></div>`;
    } else h += `<div class="note rnote">${esc(T(st.n ? 'g.rpg.pickTip' : 'g.rpg.noneYet'))}</div>`;
    return h;
  };
  RP.mapHtml = function () {
    const st = RP.st(), sites = RP.sites(), C = R.conquest(sites, st), q = R.tribute(st, sites, RP.today());
    let h = `<div class="rmap"><canvas id="rpgmapc" width="420" height="420"></canvas><div class="rmside">`;
    h += `<div class="rworld"><svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="27" class="bg"/><circle cx="32" cy="32" r="27" class="arc" pathLength="100" style="stroke-dashoffset:${100 - C.pct}"/></svg><b>${C.pct} %</b><small>${esc(T('g.rpg.map.world'))}</small></div>`;
    h += `<div class="rmsum">${esc(T('g.rpg.map.sum', { f: C.freed, k: C.known, b: C.won }))}</div>`;
    if (!C.regions.length) h += `<div class="note">${esc(T('g.rpg.map.none'))}</div>`;
    for (const g of C.regions) {
      const bs = g.boss === 'won' ? T('g.rpg.map.bossWon') : g.boss === 'ready' ? T('g.rpg.map.bossReady') : g.boss === 'locked' ? T('g.rpg.map.bossLocked', { n: B.bossUnlock - g.freed }) : '';
      h += `<div class="rreg ${g.boss}"><div class="rrn">${esc(RP.regionName(g))}<b>${g.pct} %</b></div><div class="rbar small"><i style="width:${g.pct}%"></i></div><small>${esc(T('g.rpg.map.reg', { f: g.freed, k: g.known }))}${bs ? ' · ' + esc(bs) : ''}</small></div>`;
    }
    const can = q.amount > 0 && !(st.triT && Date.now() - st.triT < B.tributeGap && Date.now() >= st.triT);
    h += `<button type="button" class="btn primary" data-rp="claim"${can ? '' : ' disabled'}>${esc(q.per ? T('g.rpg.map.claim', { n: q.amount || q.per }) : T('g.rpg.map.claimNone'))}</button>`;
    h += `<button type="button" class="btn" data-rp="fast"${C.freed >= 2 ? '' : ' disabled'}>⚡ ${esc(T('g.lib.fast.title'))}</button>`;
    h += `<div class="note">${esc(T('g.rpg.map.note'))}</div></div></div>`;
    return h;
  };
  // the map: the regions as tiles round the known outposts, their share as colour; the player, the Kernfeuer
  RP.drawMap = function () {
    const cv = hasDoc && document.getElementById('rpgmapc'); if (!cv || !cv.getContext) return;
    const ctx = cv.getContext('2d'); if (!ctx) return;
    const g = game(), st = RP.st(), sites = RP.sites(), C = R.conquest(sites, st), W = cv.width, H = cv.height;
    const pp = g && g.player ? g.player.pos : [0, 0, 0];
    let x0 = pp[0], x1 = pp[0], z0 = pp[2], z1 = pp[2];
    for (const s of sites) { x0 = Math.min(x0, s.x); x1 = Math.max(x1, s.x); z0 = Math.min(z0, s.z); z1 = Math.max(z1, s.z); }
    const span = Math.max(600, x1 - x0, z1 - z0) * 1.25, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, k = W / span;
    const X = (x) => W / 2 + (x - cx) * k, Z = (z) => H / 2 + (z - cz) * k;
    const bg = ctx.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, W * 0.7); bg.addColorStop(0, '#1d2b3f'); bg.addColorStop(1, '#0b1220');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(140,180,255,.07)'; ctx.lineWidth = 1;
    for (let i = 0; i <= 8; i++) { ctx.beginPath(); ctx.moveTo(i * W / 8, 0); ctx.lineTo(i * W / 8, H); ctx.stroke(); ctx.beginPath(); ctx.moveTo(0, i * H / 8); ctx.lineTo(W, i * H / 8); ctx.stroke(); }
    for (const r of C.regions) {
      let rx = 0; for (const s of r.sites) rx = Math.max(rx, Math.hypot(s.x - r.cx, s.z - r.cz));
      const px = X(r.cx), pz = Z(r.cz), rad = Math.max(46, (rx + 90) * k), healed = r.boss === 'won', t = r.pct / 100;
      const gr = ctx.createRadialGradient(px, pz, rad * 0.2, px, pz, rad);
      const col = healed ? '255,205,90' : `${Math.round(190 - 140 * t)},${Math.round(80 + 150 * t)},${Math.round(220 + 20 * t)}`;
      gr.addColorStop(0, `rgba(${col},${0.30 + 0.15 * t})`); gr.addColorStop(1, `rgba(${col},0.04)`);
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(px, pz, rad, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(${col},.8)`; ctx.lineWidth = 2; ctx.setLineDash(healed ? [] : [7, 6]); ctx.stroke(); ctx.setLineDash([]);
      const lab = RP.regionName(r) + ' · ' + r.pct + ' %';
      ctx.font = '700 13px sans-serif'; const tw = ctx.measureText(lab).width, ly = Math.max(16, pz - rad - 8);
      ctx.fillStyle = 'rgba(8,12,26,.75)'; ctx.fillRect(px - tw / 2 - 8, ly - 14, tw + 16, 20);
      ctx.fillStyle = healed ? '#ffe08a' : '#e8f4ff'; ctx.fillText(lab, px - tw / 2, ly);
      if (r.core && r.boss !== 'none' && r.boss !== 'locked') {
        const qx = X(r.core[0]), qz = Z(r.core[1]);
        ctx.shadowColor = healed ? '#ffd76a' : '#ff5ea8'; ctx.shadowBlur = 16;
        ctx.fillStyle = healed ? '#ffd76a' : '#ff5ea8'; ctx.beginPath(); ctx.moveTo(qx, qz - 14); ctx.lineTo(qx + 10, qz + 9); ctx.lineTo(qx - 10, qz + 9); ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.font = '700 11px sans-serif'; ctx.fillStyle = healed ? '#ffe08a' : '#ffc0de'; ctx.fillText(T('g.rpg.map.core'), qx + 13, qz + 4);
      }
    }
    // the links between freed beacons (Schnellreise)
    const fr = sites.filter(s => s.free);
    ctx.strokeStyle = 'rgba(90,240,255,.35)'; ctx.lineWidth = 1.5;
    for (let i = 1; i < fr.length; i++) { ctx.beginPath(); ctx.moveTo(X(fr[i - 1].x), Z(fr[i - 1].z)); ctx.lineTo(X(fr[i].x), Z(fr[i].z)); ctx.stroke(); }
    for (const s of sites) {
      const x = X(s.x), z = Z(s.z);
      ctx.shadowColor = s.free ? '#5ff0ff' : '#c25cff'; ctx.shadowBlur = 12;
      ctx.fillStyle = s.free ? '#7ff6ff' : '#b65cff'; ctx.beginPath(); ctx.arc(x, z, s.free ? 7 : 6, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.font = '11px sans-serif'; ctx.fillText(s.name || '', x + 10, z + 4);
    }
    const yaw = g && g.player ? g.player.yaw : 0, px = X(pp[0]), pz = Z(pp[2]);
    ctx.save(); ctx.translate(px, pz); ctx.rotate(-yaw + Math.PI); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(7, 8); ctx.lineTo(0, 4); ctx.lineTo(-7, 8); ctx.closePath(); ctx.fill(); ctx.restore();
  };
  RP.render = function () {
    const box = hasDoc && document.querySelector('#rpgchar .panel'); if (!box) return;
    if (!RP.st()) { box.innerHTML = `<div class="note">${esc(T('g.rpg.off'))}</div>`; return; }
    let h = `<div class="rhead"><div class="rtabs"><button type="button" data-rp="tab" data-v="hero" class="${RP.tab === 'hero' ? 'on' : ''}">${esc(T('g.rpg.tab.hero'))}</button><button type="button" data-rp="tab" data-v="map" class="${RP.tab === 'map' ? 'on' : ''}">${esc(T('g.rpg.tab.map'))}</button></div><button type="button" class="btn small" data-rp="close">${esc(T('g.btn.back'))} · Esc</button></div>`;
    h += RP.tab === 'map' ? RP.mapHtml() : RP.heroHtml();
    box.innerHTML = h;
    for (const b of box.querySelectorAll('[data-rp]')) b.onclick = () => RP.act(b.getAttribute('data-rp'), b);
    if (RP.tab === 'map') RP.drawMap();
  };
  RP.act = function (a, b) {
    const st = RP.st(), ad = A(), g = game();
    switch (a) {
      case 'tab': RP.tab = b.getAttribute('data-v') === 'map' ? 'map' : 'hero'; RP.sel = -1; break;
      case 'close': RP.close(); return;
      case 'pt': if (ad && ad.addPoint) ad.addPoint(b.getAttribute('data-stat')); break;
      case 'pick': RP.sel = +b.getAttribute('data-i'); break;
      case 'slot': { const s = b.getAttribute('data-s'); if (st && st.eq[s] && R.unequip(st, s)) { RP.sel = st.bag.length - 1; RP.save(); } break; }
      case 'equip': if (st && R.equip(st, RP.sel)) { RP.sel = -1; RP.fanfare(0); RP.save(); } break;
      case 'salvage': if (st) { const n = R.salvage(st, RP.sel); if (n) { Adv.earn(ad.rec.me, n); RP.burst(n, 0); if (ad.schedule) ad.schedule(); RP.save(); } RP.sel = -1; } break;
      case 'claim': RP.claim(); break;
      case 'fast': { const L = VR.Liberate; if (L && L.fastOpen && g) { L.fastOpen(g, null); return; } break; }
    }
    RP.render();
  };
  RP.open = function (tab) {
    const ui = RP.ui || (game() && game().ui); if (!ui || !RP.st()) return false;
    if (tab) RP.tab = tab;
    ensureScreen(ui); RP.sel = -1; RP.render(); ui.show('rpgchar');
    return true;
  };
  RP.close = function () { const ui = RP.ui; if (ui && ui.resume) ui.resume(); };
  function ensureScreen(ui) {
    if (!hasDoc || document.getElementById('rpgchar')) return;
    css();
    const root = (ui && ui.root) || document.getElementById('ui') || document.body;
    const s = document.createElement('div'); s.id = 'rpgchar'; s.className = 'screen'; s.innerHTML = '<div class="panel box rpgcard"></div>'; root.appendChild(s);
  }

  // ---------------------------------------------------------------- the find card, the burst, the fanfare
  RP.card = function (it, worn, better) {
    if (!hasDoc) return;
    css();
    let el = document.getElementById('rpgfind');
    if (!el) { el = document.createElement('div'); el.id = 'rpgfind'; el.setAttribute('aria-live', 'polite'); (document.getElementById('app') || document.body).appendChild(el); }
    el.style.setProperty('--rc', B.rarCol[it.r]);
    el.innerHTML = `<div class="rk">${esc(T('g.rpg.found'))} · <span>${esc(T('g.rpg.rar.' + B.RAR[it.r]))}</span></div><div class="rn"><i>${ICON[it.s]}</i>${esc(RP.itemName(it))}</div><div class="rp">${it.p.map(([k, v]) => esc(RP.perkText(k, v))).join(' · ')}</div><div class="rh">${esc(T(worn ? 'g.rpg.worn' : better ? 'g.rpg.foundBetter' : 'g.rpg.foundBag'))}</div>`;
    el.className = 'r' + it.r; void el.offsetWidth; el.className = 'r' + it.r + ' on';
    clearTimeout(RP.cardT); RP.cardT = setTimeout(() => { el.className = 'r' + it.r + ' off'; }, 6500);
  };
  RP.fanfare = function (r) {
    const g = game(), au = g && g.audio; if (!au || !au.ctx || !au.tone) return;
    const t0 = au.ctx.currentTime, root = 392 * Math.pow(2, ((g.env ? g.env.day | 0 : 0) % 5) / 12);
    for (const n of R.fanfare(r)) { const f = root * Math.pow(2, n.s / 12); au.tone(f, 0.06 + 0.01 * r, n.dur, 'triangle', true, t0 + n.t); au.tone(f * 2, 0.02, n.dur * 0.7, 'sine', true, t0 + n.t + 0.01); }
  };
  // coins from the middle of the screen (or a little above it) to the HUD's coin; each lands with a tick
  RP.burst = function (taler, delay) {
    if (!hasDoc || !document.body || !document.body.animate) return 0;
    const n = R.coins(taler); if (!n) return 0;
    const go = () => {
      css();
      const tgt = document.querySelector('#advhud .tal .ci') || document.querySelector('#advhud .tal');
      const vw = window.innerWidth || 1280, vh = window.innerHeight || 720;
      let tx = 40, ty = 30; if (tgt && tgt.getBoundingClientRect) { const r = tgt.getBoundingClientRect(); if (r.width) { tx = r.left + r.width / 2; ty = r.top + r.height / 2; } }
      const host = document.getElementById('app') || document.body, sx = vw / 2, sy = vh * 0.46;
      const lab = document.createElement('div'); lab.className = 'rpgplus'; lab.textContent = '+' + fmt(taler); lab.style.left = sx + 'px'; lab.style.top = (sy - 40) + 'px'; host.appendChild(lab);
      setTimeout(() => { if (lab.remove) lab.remove(); }, 1500);
      for (let i = 0; i < n; i++) {
        const c = document.createElement('i'); c.className = 'rpgcoin'; host.appendChild(c);
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.4, r = 50 + Math.random() * 90, mx = sx + Math.cos(a) * r, my = sy + Math.sin(a) * r * 0.7 - 30;
        const d0 = i * 28, dur = 900 + Math.random() * 250;
        const an = c.animate([
          { transform: `translate(${sx}px, ${sy}px) scale(.3) rotateY(0deg)`, opacity: 0 },
          { transform: `translate(${mx}px, ${my}px) scale(1.15) rotateY(180deg)`, opacity: 1, offset: 0.35 },
          { transform: `translate(${mx + (tx - mx) * 0.3}px, ${my - 30}px) scale(1) rotateY(300deg)`, opacity: 1, offset: 0.6 },
          { transform: `translate(${tx}px, ${ty}px) scale(.55) rotateY(540deg)`, opacity: 0.9 },
        ], { duration: dur, delay: d0, easing: 'cubic-bezier(.3,.1,.3,1)', fill: 'both' });
        an.onfinish = () => { if (c.remove) c.remove(); const h = document.getElementById('advhud'); if (h && h.classList) { h.classList.remove('rpgtick'); void h.offsetWidth; h.classList.add('rpgtick'); } };
      }
      RP.stats.bursts++; RP.stats.coins += n;
      const g = game(), au = g && g.audio;
      if (au && au.ctx && au.tone) { const t = au.ctx.currentTime + 0.35; for (let i = 0; i < Math.min(8, n); i++) au.tone(1568 + 220 * (i % 3), 0.018, 0.12, 'sine', true, t + i * 0.07); }
    };
    if (delay > 0) setTimeout(go, delay * 1000); else go();
    return n;
  };

  // ---------------------------------------------------------------- mount, the key, the look
  RP.mount = function (ui) {
    if (!ui || ui.__rpg || !hasDoc) return;
    ui.__rpg = true; RP.ui = ui; ensureScreen(ui);
    // the ⚔ card's summary gets a „Charakter" button beside its stats button
    const a = A();
    if (a && a.renderCard && !a.renderCard.__rpg) { const orc = a.renderCard; a.renderCard = function () { const r = orc.apply(this, arguments); try { const go = document.querySelector('#adventure .advsum .go'); if (go && !document.querySelector('#adventure [data-rpopen]') && RP.st()) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn go'; b.setAttribute('data-rpopen', '1'); b.textContent = T('g.rpg.open'); b.onclick = () => RP.open('hero'); go.after(b); } } catch (e) { console.warn('rpg', e); } return r; }; a.renderCard.__rpg = true; }
    // a level-up waits for the boss's banner (one big moment at a time)
    if (a && a.busy && !a.busy.__rpg) { const ob = a.busy; a.busy = function () { if (ob.apply(this, arguments)) return true; const w = document.getElementById('rpgwon'); return !!(w && /\b(on|off)\b/.test(w.className || '')); }; a.busy.__rpg = true; }
    if (VR.I18N && VR.I18N.on) VR.I18N.on(() => { try { if (ui.screen === 'rpgchar') RP.render(); } catch (e) { /* the next open draws it */ } });
    if (!RP.timer) RP.timer = setInterval(RP.tick, 500);
  };
  if (VR.Adventure && VR.Adventure.mount && !VR.Adventure.mount.__rpg) { const om = VR.Adventure.mount; VR.Adventure.mount = function (ui) { const r = om.apply(this, arguments); try { RP.mount(ui); } catch (e) { console.warn('rpg', e); } return r; }; VR.Adventure.mount.__rpg = true; }
  RP.tick = function () { wrapLate(); const g = game(); if (g) wrapChests(g); };
  if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('keydown', (e) => {
    const ui = RP.ui, g = game(); if (!ui || !g) return;
    if (ui.screen === 'rpgchar' && (e.key === 'Escape' || e.code === 'KeyO')) { e.preventDefault(); e.stopImmediatePropagation(); RP.close(); return; }
    if (e.code !== 'KeyO' || e.repeat || ui.typing || g.state !== 'play' || ui.screen || (ui.blocking && ui.screen)) return;
    if (document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
    if (RP.open()) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);

  let cssDone = false;
  function css() {
    if (cssDone || !hasDoc || !document.head) return; cssDone = true;
    const s = document.createElement('style'); s.id = 'rpgcss'; s.textContent = CSS; document.head.appendChild(s);
  }
  const CSS = `
.rpgcard { width: min(860px, 96vw); max-height: 94vh; overflow: auto; margin: 0 auto; padding-top: 14px !important; padding-bottom: 14px !important; }
.rpgcard .rhead { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.rpgcard .rtabs { display: flex; gap: 6px; }
.rpgcard .rtabs button { font: 800 16px/1 var(--display, sans-serif); color: #cfe0ff; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.14); border-radius: 999px; padding: 9px 18px; cursor: pointer; }
.rpgcard .rtabs button.on { color: #1a1206; background: linear-gradient(135deg, #ffe58f, #ffae42); border-color: transparent; box-shadow: 0 0 14px rgba(255,190,80,.5); }
.rhero { display: grid; grid-template-columns: 300px 1fr; gap: 16px; }
@media (max-width: 720px) { .rhero { grid-template-columns: 1fr; } }
.rfig { position: relative; height: 312px; border-radius: 16px; background: radial-gradient(circle at 50% 40%, rgba(90,140,255,.22), rgba(10,14,28,.6) 70%); border: 1px solid rgba(140,180,255,.18); }
.rfig .fig { position: absolute; left: 70px; top: 36px; width: 160px; height: 220px; filter: drop-shadow(0 6px 14px rgba(0,0,0,.5)); }
.rslot { position: absolute; width: 112px; display: grid; grid-template-columns: 26px 1fr; grid-template-rows: auto auto; column-gap: 6px; text-align: left; padding: 6px 8px; border-radius: 10px; background: rgba(8,12,26,.82); border: 2px solid var(--rc); color: #e8eeff; cursor: pointer; box-shadow: 0 0 0 transparent; }
.rslot.has { box-shadow: 0 0 14px color-mix(in srgb, var(--rc) 55%, transparent); }
.rslot i { grid-row: span 2; font-style: normal; font-size: 20px; align-self: center; }
.rslot b { font: 700 11px/1.15 var(--font, sans-serif); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rslot small { font: 700 10px/1.2 var(--font, sans-serif); color: var(--rc); text-transform: uppercase; letter-spacing: .5px; }
.rslot.s-head { left: 8px; top: 12px; } .rslot.s-tool { right: 8px; top: 150px; } .rslot.s-body { left: 8px; top: 140px; } .rslot.s-feet { right: 8px; top: 252px; }
.rlv { position: absolute; right: 12px; top: 12px; width: 66px; height: 66px; border-radius: 50%; display: grid; place-items: center; align-content: center; background: radial-gradient(circle, #3a2a08, #120c02); border: 3px solid #ffc94d; box-shadow: 0 0 18px rgba(255,190,80,.6); }
.rlv b { font: 900 26px/1 var(--display, sans-serif); color: #fff3c4; } .rlv small { font: 700 9px/1 var(--font, sans-serif); color: #ffd98a; text-transform: uppercase; }
.rside { display: flex; flex-direction: column; gap: 10px; }
.rxpt { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; } .rxpt b { font: 900 22px/1 var(--display, sans-serif); color: #fff3c4; } .rxpt span { color: #cdd8f0; font-size: 13px; }
.rbar { height: 14px; border-radius: 999px; background: rgba(255,255,255,.08); overflow: hidden; margin-top: 6px; border: 1px solid rgba(255,214,140,.25); }
.rbar.small { height: 7px; margin-top: 3px; }
.rbar i { display: block; height: 100%; background: linear-gradient(90deg, #ff8a3d, #ffc94d, #fff3bf); box-shadow: 0 0 12px rgba(255,190,80,.8); }
.rrow { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 8px; }
.rtal { display: inline-flex; gap: 6px; align-items: center; font: 800 16px/1 var(--font, sans-serif); color: #ffe9b0; }
.rcoin, .rpgcoin { display: inline-block; width: 18px; height: 18px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, #fff3b0, #ffc83d 55%, #c77a0e); box-shadow: inset 0 0 0 2px rgba(184,107,12,.7), 0 0 6px rgba(255,196,80,.7); }
.rboost { font: 800 11px/1 var(--font, sans-serif); color: #0c1a10; background: linear-gradient(135deg, #b9ffb0, #5fe08a); border-radius: 999px; padding: 4px 9px; }
.rpts { font: 800 12px/1 var(--font, sans-serif); color: #cdd8f0; } .rpts.has { color: #1a1206; background: linear-gradient(135deg, #ffe58f, #ffae42); border-radius: 999px; padding: 4px 10px; animation: rpgGlow 1.6s ease-in-out infinite; }
@keyframes rpgGlow { 50% { box-shadow: 0 0 14px rgba(255,196,80,.9); } }
.rstats { display: flex; flex-direction: column; gap: 5px; }
.rstat { display: grid; grid-template-columns: 1fr auto 34px; gap: 8px; align-items: center; padding: 3px 8px; border-radius: 10px; background: rgba(255,255,255,.04); }
.rstat .nm { font: 800 14px/1.15 var(--font, sans-serif); color: var(--c); } .rstat .nm small { display: block; font: 500 11px/1.2 var(--font, sans-serif); color: #b8c4dc; }
.rstat .pips { display: flex; gap: 3px; } .rstat .pips i { width: 9px; height: 14px; border-radius: 3px; background: rgba(255,255,255,.1); } .rstat .pips i.on { background: var(--c); box-shadow: 0 0 6px var(--c); }
.rgear { display: flex; flex-wrap: wrap; gap: 6px; } .rgear span { font: 700 12px/1 var(--font, sans-serif); color: #8592ad; background: rgba(255,255,255,.04); border-radius: 999px; padding: 5px 9px; } .rgear span.on { color: #eaf3ff; background: rgba(90,160,255,.18); }
.rbagh { margin: 10px 0 6px; font: 800 13px/1 var(--font, sans-serif); color: #cdd8f0; text-transform: uppercase; letter-spacing: .6px; }
.rbag { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; }
.ritem { height: 52px; border-radius: 10px; border: 2px solid var(--rc, rgba(255,255,255,.1)); background: linear-gradient(180deg, color-mix(in srgb, var(--rc, #000) 22%, rgba(8,12,26,.9)), rgba(8,12,26,.9)); color: #eef; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; cursor: pointer; padding: 2px 4px; }
.ritem.none { border-style: dashed; border-color: rgba(255,255,255,.1); background: rgba(255,255,255,.02); cursor: default; }
.ritem.sel { box-shadow: 0 0 0 2px #fff, 0 0 16px var(--rc); }
.ritem i { font-style: normal; font-size: 20px; } .ritem b { font: 600 10px/1.1 var(--font, sans-serif); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rdet { display: grid; grid-template-columns: 1fr auto auto; gap: 8px; align-items: center; margin-top: 10px; padding: 10px 12px; border-radius: 12px; border: 2px solid var(--rc); background: rgba(8,12,26,.7); }
.rdet b { font: 800 15px/1.2 var(--font, sans-serif); } .rdet .rr { color: var(--rc); font: 800 11px/1 var(--font, sans-serif); text-transform: uppercase; } .rdet .rp { color: #cfe0ff; font-size: 13px; margin-top: 3px; }
.rcmp { font: 700 12px/1.3 var(--font, sans-serif); color: #b8c4dc; } .rcmp.up { color: #7dffb4; } .rcmp.down { color: #ff9a9a; }
.rnote { margin-top: 10px; }
.rmap { display: grid; grid-template-columns: 420px 1fr; gap: 14px; } @media (max-width: 760px) { .rmap { grid-template-columns: 1fr; } #rpgmapc { width: 100%; height: auto; } }
#rpgmapc { border-radius: 14px; border: 1px solid rgba(140,180,255,.25); }
.rmside { display: flex; flex-direction: column; gap: 9px; }
.rworld { position: relative; width: 120px; height: 120px; align-self: center; display: grid; place-items: center; align-content: center; }
.rworld svg { position: absolute; inset: 0; transform: rotate(-90deg); } .rworld .bg { fill: rgba(8,12,26,.7); stroke: rgba(140,220,255,.18); stroke-width: 6; } .rworld .arc { fill: none; stroke: #5ff0ff; stroke-width: 6; stroke-dasharray: 100; stroke-linecap: round; filter: drop-shadow(0 0 5px #5ff0ff); }
.rworld b { position: relative; font: 900 26px/1 var(--display, sans-serif); color: #eafcff; } .rworld small { position: relative; font: 700 10px/1 var(--font, sans-serif); color: #9fd8e8; text-transform: uppercase; }
.rmsum { text-align: center; color: #cfe0ff; font-size: 13px; }
.rreg { padding: 7px 10px; border-radius: 10px; background: rgba(255,255,255,.04); border-left: 3px solid #b65cff; } .rreg.ready { border-left-color: #ff5ea8; } .rreg.won { border-left-color: #ffd76a; }
.rrn { display: flex; justify-content: space-between; font: 800 13px/1.2 var(--font, sans-serif); color: #eaf0ff; } .rreg small { color: #aab6d0; font-size: 11px; }
#rpgfind { position: absolute; right: 22px; top: 22%; width: 300px; z-index: 40; pointer-events: none; padding: 12px 16px; border-radius: 14px; background: linear-gradient(160deg, color-mix(in srgb, var(--rc) 30%, rgba(8,12,26,.94)), rgba(8,12,26,.94) 60%); border: 2px solid var(--rc); box-shadow: 0 0 28px color-mix(in srgb, var(--rc) 60%, transparent), 0 8px 26px rgba(0,0,0,.5); color: #f1f5ff; opacity: 0; transform: translateX(40px); }
#rpgfind.on { animation: rpgIn .55s cubic-bezier(.2,1.4,.4,1) both; } #rpgfind.off { animation: rpgOut .6s ease-in both; }
#rpgfind.r3.on, #rpgfind.r4.on { animation: rpgIn .55s cubic-bezier(.2,1.4,.4,1) both, rpgShine 1.4s ease-in-out .5s 2; }
@keyframes rpgIn { 0% { opacity: 0; transform: translateX(60px) scale(.9); } 100% { opacity: 1; transform: none; } }
@keyframes rpgOut { 0% { opacity: 1; transform: none; } 100% { opacity: 0; transform: translateX(40px); } }
@keyframes rpgShine { 50% { box-shadow: 0 0 48px var(--rc), 0 8px 26px rgba(0,0,0,.5); } }
#rpgfind .rk { font: 800 11px/1 var(--font, sans-serif); text-transform: uppercase; letter-spacing: 1px; color: #cfd8ee; } #rpgfind .rk span { color: var(--rc); }
#rpgfind .rn { font: 900 20px/1.2 var(--display, sans-serif); margin: 6px 0 4px; color: var(--rc); text-shadow: 0 0 12px color-mix(in srgb, var(--rc) 70%, transparent); } #rpgfind .rn i { font-style: normal; margin-right: 6px; }
#rpgfind .rp { font-size: 13px; color: #dde6ff; } #rpgfind .rh { margin-top: 6px; font: 700 12px/1.2 var(--font, sans-serif); color: #ffe39a; }
.rpgcoin { position: fixed; left: 0; top: 0; width: 30px; height: 30px; margin: -15px 0 0 -15px; z-index: 60; pointer-events: none; }
.rpgcoin::after { content: ''; position: absolute; inset: 8px; border-radius: 50%; border: 2px solid rgba(184,107,12,.75); box-shadow: 0 0 0 3px rgba(255,236,160,.35); }
.rpgplus { position: fixed; z-index: 61; transform: translate(-50%, 0); font: 900 30px/1 var(--display, sans-serif); color: #ffe27a; text-shadow: 0 0 14px rgba(255,190,60,.95), 0 2px 3px #000; pointer-events: none; animation: rpgPlus 1.4s ease-out both; }
@keyframes rpgPlus { 0% { opacity: 0; transform: translate(-50%, 16px) scale(.6); } 20% { opacity: 1; transform: translate(-50%, 0) scale(1.15); } 100% { opacity: 0; transform: translate(-50%, -34px) scale(1); } }
#advhud.rpgtick .tal { animation: rpgTick .25s ease-out; } @keyframes rpgTick { 50% { transform: scale(1.14); box-shadow: 0 0 16px rgba(255,200,80,.9); } }
`;
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
