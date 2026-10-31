// ============================================================================
// u-worlds · VR.WorldLife — the game's side of the worlds' ecosystems (plan docs/superpowers/plans/2026-10-31-u-worlds.md;
// the worlds themselves: src/shared/worldeco.js). Everything here wraps; the marked one-liners elsewhere are hooks.
//   · ⚙ Spiel „Echte Schwerkraft der Welten" (realGrav, default off): off — Herzwelt's gravity, breath and building on
//     every world (DimReg.walkGravity, player.js; fields.js's rocks without boots and drift; bodylife.js without the suit)
//   · the creatures (VR.MOBS + voxmodels.js): 2–3 per world, peaceful — grazers, hoppers, flyers gliding over the land,
//     swimmers in Aquamarin's shallows; kept round the player on a world of bgen ≥ 3 (Very Low 4, else 10 at once)
//   · the natives (villagers.js V.speciesLook, folkmodel.js's head feature): the species' skin, eyes, feature, garb
//   · the trade: the trader at the stall sells the world's goods (shop.js, the 'handel' shop; Abenteuer worlds)
//   · the quests on another world lead to its landmarks and its other villages (quests.js Q.placesFor)
//   · Kreativ: 🪐 Welten (the pause menu, /welten) — every world at once, no unlocking (travel.js Travel.worlds); the star
//     jump's range unbounded
//   · arriving: the world's name and who lives there, once per visit
// Cost 🟢: a 1.5-s timer on another world (the spawner), nothing at home; the creatures are entities.js mobs (their LOD).
// ============================================================================
(function (VR) {
  'use strict';
  const E = VR.WorldEco, D = VR.DimReg;
  if (!E || !D) return;
  const T = (k, v) => (VR.I18N ? VR.I18N.t(k, v) : k);
  const WL = VR.WorldLife = { stats: { spawned: 0, alive: 0 } };
  const SEA = (VR.C && VR.C.SEA) || 63;

  // ---------------------------------------------------------------- facts
  // the kind of the world the game stands on when its ecosystem is there (bgen ≥ 3), else null
  const KC = { dim: null, meta: null, kind: null };
  WL.kindOf = function (g) {
    if (g && KC.dim === g.dim && KC.meta === g.meta) return KC.kind;   // (once per world: nothing allocated per frame)
    const k = kindOf0(g); if (g) { KC.dim = g.dim; KC.meta = g.meta; KC.kind = k; }
    return k;
  };
  function kindOf0(g) {
    const d = g && g.dim && D.get(g.dim), kind = d && d.body;
    if (!kind || !E.KINDS[kind]) return null;
    const bg = VR.Bodies && VR.Bodies.bgenOf ? VR.Bodies.bgenOf(g.meta)[kind] : 0;
    return bg >= E.BGEN ? kind : null;
  }

  // ---------------------------------------------------------------- the gravity switch
  if (VR.Settings && VR.Settings.add) VR.Settings.add({ key: 'realGrav', g: 'play', sec: 'play', t: 'switch', lab: 'g.set.realGrav', tip: 'g.set.realGrav.tip', cost: 'low', def: false });
  WL.applyGrav = function (g) {
    const on = !!(g && g.settings && g.settings.realGrav === true);
    if (D.realGrav === on) return;
    D.realGrav = on;
    const p = g && g.player; if (p) p.grav = D.walkGravity(g.dim);
  };

  // ---------------------------------------------------------------- the creatures
  const MOBS = VR.MOBS;
  const SIZE = { reef_glider: [0.45, 0.4], shell_strider: [0.42, 1.1], spray_sailor: [0.3, 0.4], dune_trotter: [0.42, 1.5], rust_hopper: [0.26, 0.55], dust_moth: [0.3, 0.35], ember_snail: [0.4, 0.8], ash_lark: [0.25, 0.3], sulfur_beetle: [0.3, 0.45], crater_roller: [0.45, 0.8], moon_moth: [0.3, 0.35], frost_seal: [0.45, 0.7], ice_wisp: [0.22, 0.3] };
  if (MOBS) for (const kind of E.ids) for (const f of E.KINDS[kind].fauna) {
    if (MOBS[f.id]) continue;
    const sz = SIZE[f.id] || [0.4, 0.8];
    const base = { model: f.id, hp: 8, w: sz[0], h: sz[1], drops: [], xp: 0, eco: kind, does: f.does };
    if (f.does === 'fly') Object.assign(base, { speed: f.id.indexOf('moth') >= 0 || f.id === 'ice_wisp' ? 2.6 : 5, fly: 'glide', ambient: true });
    else if (f.does === 'swim') Object.assign(base, { speed: 1, fly: 'swim' });
    else if (f.does === 'hop') Object.assign(base, { speed: 3.4, group: [2, 4] });
    else Object.assign(base, { speed: f.id === 'ember_snail' ? 0.8 : 2.2, group: [2, 4] });
    MOBS[f.id] = base;
  }
  const CAP = (g) => (g.settings && g.settings.preset === 'potato' ? 4 : 10);
  const S = WL.st = { t: 1, kind: null, said: null };
  WL.spawn = function (g, dt) {
    const kind = WL.kindOf(g), Ent = g.entities, p = g.player, w = g.world;
    if (!kind || !Ent || !p || !w || g.space) return;
    if ((S.t -= dt) > 0) return;
    S.t = 1.5;
    let n = 0; const mine = [];
    for (const m of Ent.mobs) if (m.def && m.def.eco === kind && !m.dead) { n++; mine.push(m); }
    WL.stats.alive = n;
    if (n >= CAP(g)) return;
    const fauna = E.KINDS[kind].fauna, f = fauna[Math.floor(Math.random() * fauna.length)];
    const a = Math.random() * Math.PI * 2, d = 18 + Math.random() * 34;
    const x = Math.floor(p.pos[0] + Math.cos(a) * d), z = Math.floor(p.pos[2] + Math.sin(a) * d);
    if (!w.isLoaded(x, z)) return;
    const top = w.topAt(x, z), ground = w.getBlock(x, top, z), R = VR.R, F = VR.F;
    const water = !!(R.T.flags[ground] & F.WATER) || !!(R.T.flags[w.getBlock(x, top + 1, z)] & F.WATER);
    if (f.does === 'swim') {
      if (!water) return;
      const m = Ent.summon(f.id, x + 0.5, SEA - 1.2, z + 0.5); if (!m) return;
      m.home = { x, z, r: 5 + Math.random() * 4 }; m.waterY = SEA - 1.2 - Math.random() * 1.5; WL.stats.spawned++;
      return;
    }
    if (f.does === 'fly') {
      const m = Ent.summon(f.id, x + 0.5, top + 7 + Math.random() * 10, z + 0.5); if (!m) return;
      m.alt = m.pos[1]; WL.stats.spawned++;
      return;
    }
    if (water || !(R.T.flags[ground] & F.SOLID) || (R.T.flags[ground] & F.FLUID)) return;
    const [g0, g1] = MOBS[f.id].group || [1, 2], k = g0 + Math.floor(Math.random() * (g1 - g0 + 1));
    for (let i = 0; i < k && n + i < CAP(g); i++) {
      const ox = x + Math.floor((Math.random() - 0.5) * 6), oz = z + Math.floor((Math.random() - 0.5) * 6), ty = w.topAt(ox, oz);
      if (!(R.T.flags[w.getBlock(ox, ty, oz)] & F.SOLID)) continue;
      const m = Ent.summon(f.id, ox + 0.5, ty + 1, oz + 0.5); if (m && f.does === 'graze') m.graze = true;
      if (m) WL.stats.spawned++;
    }
  };

  // ---------------------------------------------------------------- the natives' looks (villagers.js calls it)
  const Folk = VR.Folk;
  if (Folk) Folk.speciesLook = function (L, r, age, kind) {
    const W = E.KINDS[kind]; if (!W) return L;
    const Lk = W.species.look;
    L.skin = Lk.skin[r(31) % Lk.skin.length];
    L.hs = 'bald'; L.hair = L.skin; L.beard = false; L.freckles = false; L.kidHat = null; L.elderHat = null;
    L.eye = Lk.eye; L.feat = Lk.feat; L.featC = Lk.featC[r(32) % Lk.featC.length]; L.glow = !!Lk.glow;
    L.species = kind;
    // the garb in the species' colours (the trade's own tools stay)
    // the garb: the species' own cut (a robe, a coat, a tunic, a gown, a cape — folkmodel.js's families) in its colours,
    // the trims in the feature's colour; the children in tunics
    const cut = Lk.cut || ['tunic'];
    L.garb = age === 'child' ? null : cut[r(36) % cut.length];
    L.shirt = Lk.garb[r(33) % Lk.garb.length]; L.pants = Lk.garb[(r(34) + 2) % Lk.garb.length]; L.dressCol = Lk.garb[r(35) % Lk.garb.length]; L.dress = false;
    if (L.garb === 'cape') L.cape = Lk.garb[(r(37) + 1) % Lk.garb.length];
    L.trim = L.featC; L.town = 'sp';
    return L;
  };

  // ---------------------------------------------------------------- u-worlds2 · the natives' own idle and gestures
  // villages.js pose() calls it after the person's pose (FolkAnim resets every joint each frame, so this only adds):
  // standing (or talking) each species keeps its own bearing and now and then makes its own gesture — the Wellari sway
  // and flutter their hands like fins, the Dunelin bob their long necks and look up, the Glutani stand wide and warm their
  // hands, the Regoli bounce on their toes and tilt their heads, the Nivari stand tall and breathe slowly, a hand to the
  // chest in greeting. t: the game's time (seconded by the person's seed), wa: the walk amount (0 standing).
  // A culture moment (WL.Culture) makes them dance their own dance: state 'dance' is the villagers' own.
  WL.idle = function (P, kind, t, wa, state, a) {
    const k = Math.max(0, 1 - wa * 3);   // walking: the bearing fades out
    if (k <= 0 || !P.head || !P.body) return;
    const sn = Math.sin, add = (j, i, v) => { const q = P[j]; if (q) q[i] += v * k; };
    const talk = state === 'talk', gest = ((t * 0.16) % 1) < 0.22 || talk, gk = gest ? sn(Math.min(1, ((t * 0.16) % 1) / 0.22) * Math.PI) : 0;
    if (state !== 'idle' && !talk && state !== 'dance') return;
    if (kind === 'aqua') {
      add('body', 2, sn(t * 1.3) * 0.06); add('head', 2, sn(t * 1.3 + 1.1) * 0.1);
      if (gest) { add('fore_l', 2, sn(t * 9) * 0.22 * gk); add('fore_r', 2, -sn(t * 9 + 0.6) * 0.22 * gk); add('arm_l', 0, 0.35 * gk); add('arm_r', 0, 0.35 * gk); }
    } else if (kind === 'ocker') {
      add('head', 0, sn(t * 0.9) * 0.1 + (gest ? 0.28 * gk : 0)); add('body', 0, -sn(t * 0.9) * 0.03);
      if (gest) { add('arm_r', 0, 1.1 * gk); add('fore_r', 0, 0.6 * gk); }   // a hand shading the eyes, the head up: looking out over the dunes
    } else if (kind === 'zinn') {
      add('arm_l', 2, -0.2); add('arm_r', 2, 0.2); add('body', 1, sn(t * 0.7) * 0.07);
      if (gest) { add('arm_l', 0, 0.7 * gk); add('arm_r', 0, 0.7 * gk); add('fore_l', 0, 0.8 * gk); add('fore_r', 0, 0.8 * gk); add('fore_l', 2, sn(t * 4) * 0.1 * gk); }   // the hands held to the warmth
    } else if (kind === 'basalt') {
      add('hips', 4, Math.max(0, sn(t * 3.4)) * 1.4); add('head', 2, sn(t * 1.6) * 0.16);
      if (gest) { add('arm_l', 2, -0.9 * gk); add('arm_r', 2, 0.9 * gk); add('hips', 4, Math.max(0, sn(t * 7)) * 1.6 * gk); }   // a happy hop, the arms out
    } else if (kind === 'opal') {
      add('head', 0, 0.1); add('body', 0, sn(t * 0.5) * 0.025);
      if (gest) { add('arm_r', 0, 0.9 * gk); add('fore_r', 0, 1.2 * gk); add('arm_r', 2, -0.25 * gk); add('head', 0, -0.18 * gk); }   // a hand to the chest, a slow bow
    }
  };

  // ---------------------------------------------------------------- the trade: the stall's goods
  const Shop = VR.Shop;
  if (Shop && !Shop.__eco) {
    Shop.__eco = true;
    if (Shop.SHOPS.indexOf('handel') < 0) Shop.SHOPS.push('handel');
    Shop.ICON.handel = '🧺';
    const so = Shop.shopOf; Shop.shopOf = (role) => (role === 'trader' ? 'handel' : so(role));
    const PRICE = { iron_ingot: 30, gold_ingot: 60, tide_lantern: 25, lantern: 12, sponge: 30, amber_crystal_block: 40, azure_crystal_block: 40, rose_crystal_block: 40, glowing_obsidian: 45, azure_crystal_cluster: 20 };
    const cat0 = Shop.catalog, CC = {};
    Shop.catalog = function (shop) {
      if (shop !== 'handel') return cat0.apply(this, arguments);
      const g = VR.game, kind = (g && WL.kindOf(g)) || (g && g.dim && D.get(g.dim) && D.get(g.dim).body) || 'aqua', W = E.KINDS[kind];
      if (CC[kind]) return CC[kind];
      const ex = (id) => !!((VR.itemDef && VR.itemDef(id)) || (VR.R && VR.R.byName && VR.R.byName[id]));
      return (CC[kind] = (W ? W.species.goods : []).filter(ex).map((id, i) => ({ key: 'eco:' + id, kind: 'item', id, price: PRICE[id] || 6 + (i * 5) % 18, cat: 'item' })));
    };
  }

  // ---------------------------------------------------------------- the quests: the world's own places
  const Q = VR.Quests;
  if (Q && Q.placesFor && !Q.placesFor.__eco) {
    const pf0 = Q.placesFor;
    Q.placesFor = function (vil) {
      if (Q.placesNow) return Q.placesNow;
      const g = VR.game, kind = g && WL.kindOf(g);
      if (!kind || !vil || !String(vil.id).startsWith('eco:')) return pf0.apply(this, arguments);
      const mgr = g.villages, P = vil.plan || vil;
      const near = (mgr && mgr.sites || []).filter(s => Math.hypot(s.x - P.x, s.z - P.z) <= 1400);
      const lm = WL.landmarks(g, kind);
      const key = vil.id + ':' + near.map(s => s.id).join(',') + ':' + lm.length;
      if (vil._qpl && vil._qpl.key === key) return vil._qpl.list;
      const list = Q.places({ villages: near, wonders: lm, vid: vil.id });
      vil._qpl = { key, list };
      return list;
    };
    Q.placesFor.__eco = true;
  }
  // the landmarks of this world (the same the worker builds: a generator made here once, its sites and landmarks only)
  const LMC = new Map();
  WL.eco = function (g) {
    const kind = WL.kindOf(g); if (!kind) return null;
    const key = g.dim + ':' + ((g.meta && g.meta.seed) >>> 0);
    if (LMC.has(key)) return LMC.get(key);
    let eco = null;
    try { const d = D.get(g.dim), gen = d.gen((g.meta && g.meta.seed) >>> 0, { bgen: VR.Bodies.bgenOf(g.meta) }); eco = E.of(gen); } catch (e) { eco = null; }
    LMC.set(key, eco);
    return eco;
  };
  WL.landmarks = function (g, kind) {
    const eco = WL.eco(g); if (!eco) return [];
    return eco.landmarks.map(l => ({ key: l.id, x: l.x, y: l.y, z: l.z, name: VR.I18N ? VR.I18N.tx('g.eco.lm.' + kind + '.' + l.key, null, l.de, l.en) : l.de }));
  };

  // ---------------------------------------------------------------- Kreativ: every world at once
  const hasDoc = typeof document !== 'undefined' && !!document.createElement;
  WL.openWorlds = function (g) {
    if (!hasDoc || !g || !VR.Travel) return false;
    let el = document.getElementById('ecoWorlds');
    if (!el) {
      el = document.createElement('div'); el.id = 'ecoWorlds';
      el.style.cssText = 'position:fixed;inset:0;z-index:840;display:flex;align-items:center;justify-content:center;background:rgba(8,10,24,.55)';
      (document.getElementById('app') || document.body).appendChild(el);
      el.addEventListener('click', (ev) => {
        const b = ev.target && ev.target.closest ? ev.target.closest('[data-eco]') : null;
        if (ev.target === el || (b && b.getAttribute('data-eco') === '~close')) { WL.closeWorlds(); return; }
        if (b) { const dim = b.getAttribute('data-eco'); WL.closeWorlds(); if (g.ui && g.ui.resume) g.ui.resume(); VR.Travel.go(g, { dim, via: 'cmd' }); }
      });
    }
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const rows = VR.Travel.worlds(g).map((w) => {
      const sp = w.kind && E.KINDS[w.kind] ? T('g.eco.sp.' + w.kind) : '';
      const sub = w.exo ? esc(w.exo.star) + (sp ? ' · ' + esc(sp) : '') : esc(sp);
      return `<button type="button" class="btn" data-eco="${esc(w.dim)}" style="display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left${w.dim === g.dim ? ';opacity:.55' : ''}"><b>${w.exo ? '✦ ' : ''}${esc(w.exo ? w.exo.name.de || w.name : w.name)}</b><span style="font-size:12px;opacity:.8">${sub}</span></button>`;
    }).join('');
    el.innerHTML = `<div class="panel box col gap" style="width:min(92vw,680px);max-height:86vh;overflow:auto"><h2 style="margin:0">${esc(T('g.eco.worlds'))}</h2><div class="note">${esc(T('g.eco.worlds.tip'))}</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px">${rows}</div><button type="button" class="btn" data-eco="~close">✕</button></div>`;
    el.style.display = 'flex';
    if (document.exitPointerLock) try { document.exitPointerLock(); } catch (e) { /* (no lock) */ }
    return true;
  };
  WL.closeWorlds = function () { const el = hasDoc && document.getElementById('ecoWorlds'); if (el) el.style.display = 'none'; };
  // the pause menu's button (Kreativ only), beside u-home's
  const NL = VR.NewLife;
  if (NL && NL.pauseMenu && !NL.pauseMenu.__eco) {
    const pm0 = NL.pauseMenu;
    NL.pauseMenu = function (ui) {
      const r = pm0.apply(this, arguments);
      try {
        const g = ui && ui.game, root = hasDoc && document.getElementById('pause'); if (!g || !root || !root.querySelector) return r;
        let b = root.querySelector('[data-eco-open]');
        const bz = root.querySelector('[data-act="goherz"]') || root.querySelector('[data-act="gohome"]');
        if (!b && bz && bz.parentNode) { b = document.createElement('button'); b.setAttribute('type', 'button'); b.className = 'btn'; b.setAttribute('data-eco-open', '1'); b.addEventListener('click', () => WL.openWorlds(g)); bz.parentNode.appendChild(b); }
        if (b) { b.textContent = T('g.eco.worlds'); b.title = T('g.eco.worlds.tip'); b.style.display = VR.Travel && VR.Travel.creative(g) ? '' : 'none'; b.style.flexBasis = '100%'; }
      } catch (e) { /* (a menu without the row) */ }
      return r;
    };
    NL.pauseMenu.__eco = true;
  }
  // the star jump in Kreativ: every star in reach
  const SJ = VR.StarJump;
  if (SJ && SJ.range && !SJ.range.__eco) { const r0 = SJ.range; SJ.range = (g) => (VR.Travel && VR.Travel.creative(g) ? 1e6 : r0(g)); SJ.range.__eco = true; }

  // ---------------------------------------------------------------- the frame and the chat
  const G = VR.Game;
  if (G && !G.prototype.__eco) {
    G.prototype.__eco = true;
    const pf = G.prototype.playFrame;
    G.prototype.playFrame = function (dt) {
      WL.applyGrav(this);
      if (this.dim && this.dim !== 'overworld' && this.state === 'play') {
        WL.spawn(this, dt);
        const kind = WL.kindOf(this);
        if (kind && S.said !== this.dim + ':' + (this.meta && this.meta.seed) && this.world && this.world.cols && this.world.cols.size > 8 && this.ui && this.ui.toast) {
          S.said = this.dim + ':' + (this.meta && this.meta.seed);
          this.ui.toast('🪐 ' + T('g.eco.welcome', { world: VR.Travel ? VR.Travel.dimName(this.dim) : this.dim }), T('g.eco.home.' + kind));
        }
      } else if (this.dim === 'overworld') S.said = null;
      return pf.call(this, dt);
    };
    const ch = G.prototype.chat;
    G.prototype.chat = function (text) {
      if (/^\/(welten|worlds)\s*$/i.test(String(text || ''))) {
        if (VR.Travel && VR.Travel.creative(this)) WL.openWorlds(this);
        else if (this.ui && this.ui.chatLine) this.ui.chatLine(T('g.travel.worlds', { list: VR.Travel.worlds(this).map(w => w.name).join(' · ') }), '#cfe6ff');
        return;
      }
      return ch.apply(this, arguments);
    };
  }
})(VR);
