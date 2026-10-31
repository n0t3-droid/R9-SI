// ============================================================================
// o-wander · VR.Wander — just walking around is never boring, and the world feels connected (plan
// docs/superpowers/plans/2026-10-31-o-wander.md). The owner (31 Oct): „story und openworld so konzeptieren, dass selbst nur
// rumlaufen nie langweilig wird … ich will Schönheiten und friedliches, liebevolles Zusammenleben und Märchenhaftes".
//   · der Wanderregisseur: on foot, on every world with a sky, something worth noticing meets you every 20–40 s on the
//     land between the places — slot k at 30·k + j(seed, k), j ∈ [−5, 5]; W.pick(seed, k, ctx, recent): the moments the
//     terrain (way · open · wood · hill · near · village · water), the hour, the weather, the rainbow and the tier allow,
//     never one of the last REPEAT, not the family of the last one while another fits, a weighted hash pick (the same
//     inputs, the same moment). The actor stages it 16–45 m ahead in the view on open ground; if it cannot, the next of
//     W.order (a slot that found no ground tries again for 8 s). Seventeen moments (W.KINDS) — a wanderer to walk along
//     (they lead you to the next place and chat), a caravan, a lost dog to bring to a village, a picnic you are invited
//     to, a musician, a kite festival, a fox or rabbits crossing, the weather's rainbow, a hidden fairy ring, a cairn with
//     a view, a tiny shrine, ruins with three rune stones, a map scrap with an X at a real place (a chest there), a
//     signpost, a stargazer, a lantern walk, a wishing well. Each a sticker for the Wanderbuch and a small gift: in
//     Abenteuer XP and Heliataler, else a snack, a recipe or a block for builders.
//   · the Wegballon: a small glowing paper-lantern balloon 55–95 m ahead toward the next place not yet visited (the
//     villages, Herzwelt's sites, another world's town, villages, landmarks and landing), over the place once near.
//   · das Wanderbuch (meta.wander, additive): places, people, creatures, stickers, recipes — soft progress, no pressure.
//     J outside Abenteuer opens it; in Abenteuer it is a section of the journal.
//   · calm: no popup — a discovery is one warm line in the notes channel (quiet.js, prio 2, keyed).
// Cost tiers: 0 Very Low — the spots, the wanderer, the pet, the crossing, the rainbow, the sign, the stargazer, the well
// (one moment at a time); 1 Low + caravan, picnic, musician, kites, lanterns (two at a time); 2 Balanced + the particles
// (butterflies, fireflies, notes, glows). Switch ⚙ Bild · Dinge & Effekte „Wanderregisseur" (wander). Presentation only:
// nothing here is a block, nothing collides; the gifts go through the inventory or VR.Adventure.
// Pure (test/wander.js): KINDS, NAMES, allowed, candidates, slotTime, slotAt, order, pick, simulate, book, note,
// progress, reward, nextPlace, beacon, signLines, keys.
// ============================================================================
(function (VR) {
  'use strict';
  const W = VR.Wander = VR.Wander || {};
  const LK = VR.LifeKit, TAU = Math.PI * 2;
  const h = (a, b, c) => LK.h(a, b, c);
  const T = (k, v) => (VR.I18N ? VR.I18N.t(k, v) : k);
  const hasDoc = typeof document !== 'undefined' && !!document.createElement;
  if (VR.Settings && VR.Settings.add) VR.Settings.add({ key: 'wander', g: 'img', sec: 'objects', t: 'switch', lab: 'g.set.wander', tip: 'g.set.wander.tip', cost: 'low', def: true });

  // ---------------------------------------------------------------- the moments
  W.HOURS = ['dawn', 'morning', 'noon', 'afternoon', 'dusk', 'night'];
  const ALL = W.HOURS, DAY = ['dawn', 'morning', 'noon', 'afternoon'], DAYD = DAY.concat(['dusk']), MID = ['morning', 'noon', 'afternoon'];
  W.TERRAIN = ['way', 'open', 'wood', 'hill', 'near', 'village', 'water'];
  // tier · dur (s) · fam (the family: folk · animal · sky · spot) · at (terrain) · hours · w (weight) · dry · need
  W.KINDS = {
    traveller: { tier: 0, dur: 100, fam: 'folk', at: ['way', 'open', 'near', 'village', 'hill'], hours: DAYD, w: 3, ico: '🎒' },
    caravan: { tier: 1, dur: 100, fam: 'folk', at: ['way', 'open', 'near'], hours: MID, w: 2, dry: 1, ico: '🛒' },
    pet: { tier: 0, dur: 90, fam: 'animal', at: ['open', 'way', 'near', 'wood', 'village'], hours: DAYD, w: 2, ico: '🐕' },
    picnic: { tier: 1, dur: 80, fam: 'folk', at: ['open', 'hill', 'near', 'water'], hours: MID, w: 2, dry: 1, ico: '🧺' },
    musician: { tier: 1, dur: 70, fam: 'folk', at: ['way', 'open', 'near', 'village', 'water'], hours: ['morning', 'noon', 'afternoon', 'dusk'], w: 2, dry: 1, ico: '🎶' },
    kites: { tier: 1, dur: 80, fam: 'sky', at: ['open', 'hill', 'near'], hours: MID, w: 2, dry: 1, ico: '🪁' },
    crossing: { tier: 0, dur: 26, fam: 'animal', at: ['open', 'way', 'wood', 'hill', 'water', 'near'], hours: ALL, w: 3, ico: '🦊' },
    rainbow: { tier: 0, dur: 40, fam: 'sky', at: W.TERRAIN, hours: DAYD, w: 9, need: 'bow', ico: '🌈' },
    glade: { tier: 0, dur: 90, fam: 'spot', at: ['wood', 'open', 'hill', 'water'], hours: ALL, w: 2, ico: '🍄' },
    cairn: { tier: 0, dur: 90, fam: 'spot', at: ['hill', 'open', 'way', 'water'], hours: ALL, w: 2, ico: '🪨' },
    shrine: { tier: 0, dur: 90, fam: 'spot', at: ['way', 'open', 'wood', 'hill', 'near', 'water'], hours: ALL, w: 2, ico: '⛩' },
    ruins: { tier: 0, dur: 150, fam: 'spot', at: ['open', 'hill', 'wood'], hours: ALL, w: 1, ico: '🏛' },
    scrap: { tier: 0, dur: 80, fam: 'spot', at: ['way', 'open', 'hill', 'wood', 'near'], hours: DAYD, w: 1, need: 'nomap', ico: '🗺' },
    sign: { tier: 0, dur: 70, fam: 'spot', at: ['way', 'open', 'near', 'village', 'hill'], hours: ALL, w: 2, ico: '🪧' },
    stargazer: { tier: 0, dur: 90, fam: 'folk', at: ['hill', 'open', 'water', 'near'], hours: ['night'], w: 3, dry: 1, ico: '🔭' },
    lanterns: { tier: 1, dur: 90, fam: 'folk', at: ['way', 'near', 'village', 'open'], hours: ['dusk', 'night'], w: 3, dry: 1, ico: '🏮' },
    well: { tier: 0, dur: 80, fam: 'spot', at: ['open', 'way', 'wood', 'near', 'village'], hours: ALL, w: 1, ico: '⛲' },
  };
  W.NAMES = Object.keys(W.KINDS);
  W.REPEAT = 5;
  const nameHash = (s) => { let x = 0x811c9dc5; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x | 0; };
  const NH = {}; for (const n of W.NAMES) NH[n] = nameHash(n);
  W.allowed = function (n, ctx) {
    const K = W.KINDS[n]; if (!K || !ctx) return false;
    if (K.tier > (ctx.tier === undefined ? 2 : ctx.tier)) return false;
    if (K.at.indexOf(ctx.at) < 0 || K.hours.indexOf(ctx.hour) < 0) return false;
    if (K.dry && ctx.wet) return false;
    if (K.need === 'bow' && !ctx.bow) return false;
    if (K.need === 'nomap' && ctx.map) return false;
    return true;
  };
  W.candidates = (ctx) => W.NAMES.filter(n => W.allowed(n, ctx));
  W.slotTime = (seed, k) => 30 * k + (h(seed, k, 0x3a7d) - 0.5) * 10;
  W.slotAt = function (seed, t) { let k = Math.floor(t / 30) + 1; while (W.slotTime(seed, k) > t) k--; return k; };
  // the order to try: the rainbow first when there is one; the fresh ones (not among the last REPEAT) of another family
  // than the last one, in a weighted hash race; then the fresh ones of its family; only when nothing is fresh, any but the last
  W.order = function (seed, k, ctx, recent) {
    const C = W.candidates(ctx); if (!C.length) return [];
    recent = recent || [];
    const last = recent.length ? recent[recent.length - 1] : null, lastFam = last && W.KINDS[last] ? W.KINDS[last].fam : null;
    const rec = recent.slice(-W.REPEAT);
    let fresh = C.filter(n => rec.indexOf(n) < 0);
    if (!fresh.length) fresh = C.filter(n => n !== last);
    const key = (n) => -Math.log(1 - h(seed, k, NH[n]) * 0.999999) / W.KINDS[n].w;
    const race = (a) => a.sort((p, q) => key(p) - key(q));
    const other = race(fresh.filter(n => W.KINDS[n].fam !== lastFam)), same = race(fresh.filter(n => W.KINDS[n].fam === lastFam));
    const out = other.concat(same);
    const bi = out.indexOf('rainbow'); if (bi > 0 && lastFam !== 'sky') { out.splice(bi, 1); out.unshift('rainbow'); }
    return out;
  };
  W.pick = (seed, k, ctx, recent) => W.order(seed, k, ctx, recent)[0] || null;
  // a walk of n slots: ctxOf(k) → the picks (the recent ones are the picks before)
  W.simulate = function (seed, n, ctxOf) {
    const out = [], recent = [];
    for (let k = 1; k <= n; k++) { const p = W.pick(seed, k, ctxOf(k), recent); out.push(p); if (p) recent.push(p); }
    return out;
  };

  // ---------------------------------------------------------------- das Wanderbuch (meta.wander)
  W.PAGES = ['places', 'people', 'creatures', 'stickers', 'recipes'];
  W.SOFT = { places: 20, people: 12, creatures: 8, stickers: W.NAMES.length, recipes: 6 };
  W.RECIPES = ['applecake', 'herbsoup', 'honeybread', 'berrypancake', 'mushroompie', 'flowertea'];
  const isObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
  W.book = function (meta) {
    if (!meta) return null;
    if (!isObj(meta.wander)) meta.wander = {};
    const B = meta.wander;
    for (const p of W.PAGES) if (!isObj(B[p])) B[p] = {};
    if (!isObj(B.map) && B.map !== undefined) delete B.map;
    return B;
  };
  W.note = function (meta, page, id, val) {
    const B = W.book(meta); if (!B || !B[page] || !id) return false;
    if (B[page][id]) return false;
    B[page][id] = val || 1;
    return true;
  };
  W.progress = function (meta, totals) {
    const B = W.book(meta) || {}, out = {};
    for (const p of W.PAGES) {
      const n = Object.keys(B[p] || {}).length, of = Math.max(n, (totals && totals[p]) || W.SOFT[p]);
      out[p] = { n, of, f: of ? n / of : 0 };
    }
    return out;
  };
  // the gifts: a sticker always; Abenteuer XP and Heliataler; elsewhere a snack, a block or nothing but the sticker
  W.GIFT = {
    traveller: ['bread', 1], caravan: ['apple', 3], pet: ['cookie', 3], picnic: ['pumpkin_pie', 1], musician: ['honey_bottle', 1],
    kites: ['string', 2], crossing: null, rainbow: ['glow_berries', 2], glade: ['lily_of_the_valley', 4], cairn: ['mossy_cobblestone', 8],
    shrine: ['candle', 2], ruins: ['chiseled_stone_bricks', 8], scrap: null, sign: null, stargazer: ['spyglass', 1], lanterns: ['lantern', 2], well: ['emerald', 1],
  };
  W.ADV = { traveller: [15, 10], pet: [20, 15], ruins: [20, 20], well: [5, 10], cairn: [10, 5], scrap: [5, 0] };
  W.CHEST = { item: ['emerald', 3], xp: 25, taler: 40 };
  W.reward = function (n, adv) {
    if (!W.KINDS[n]) return null;
    if (adv) { const a = W.ADV[n] || [8, 5]; return { sticker: n, xp: a[0], taler: a[1] }; }
    const g = W.GIFT[n];
    return g ? { sticker: n, item: [g[0], g[1]] } : { sticker: n };
  };

  // ---------------------------------------------------------------- the places: the next one, the Wegballon, the signpost
  // places: [{id, x, z, name}] · yaw: the walker's heading (the models face −z) · seen: {id: 1}
  W.nextPlace = function (places, pos, yaw, seen) {
    if (!places || !places.length) return null;
    const fx = -Math.sin(yaw || 0), fz = -Math.cos(yaw || 0);
    let best = null, bs = Infinity, any = null, as = Infinity;
    for (const P of places) {
      const dx = P.x - pos[0], dz = P.z - pos[2], d = Math.hypot(dx, dz);
      if (d < 30 || d > 1400) continue;
      const c = d > 1e-6 ? (dx * fx + dz * fz) / d : 1, sc = d * (1.7 - 0.7 * c);
      if (!(seen && seen[P.id]) && sc < bs) { bs = sc; best = P; }
      if (sc < as) { as = sc; any = P; }
    }
    return best || any;
  };
  W.BEACON = { near: 120, ahead: 75, sway: 9, up: 22 };
  // the Wegballon's point: [x, height over the ground, z] — 75 m ahead toward the place (swaying a little), over it when near
  W.beacon = function (pos, P, t, out) {
    out = out || [0, 0, 0];
    const B = W.BEACON, dx = P.x - pos[0], dz = P.z - pos[2], d = Math.hypot(dx, dz) || 1;
    const bob = Math.sin((t || 0) * 0.7) * 1.2;
    if (d < B.near) { out[0] = P.x; out[2] = P.z; out[1] = B.up + 6 + bob; return out; }
    const ux = dx / d, uz = dz / d, s = Math.sin((t || 0) * 0.13) * B.sway;
    out[0] = pos[0] + ux * B.ahead - uz * s; out[2] = pos[2] + uz * B.ahead + ux * s; out[1] = B.up + bob;
    return out;
  };
  const DIRS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
  W.dirOf = (dx, dz) => DIRS[((Math.round(Math.atan2(dx, -dz) / (Math.PI / 4)) % 8) + 8) % 8];   // (north is −z)
  W.signLines = function (places, pos, n) {
    const L = [];
    for (const P of places || []) { const dx = P.x - pos[0], dz = P.z - pos[2], d = Math.hypot(dx, dz); if (d >= 40 && d <= 2000) L.push({ place: P, d: Math.round(d / 10) * 10, dir: W.dirOf(dx, dz) }); }
    L.sort((a, b) => a.d - b.d);
    return L.slice(0, n || 3);
  };

  // ---------------------------------------------------------------- the words (lang_de.js / lang_en.js)
  W.SITE_KINDS = ['temple', 'city', 'hills', 'station', 'canyon', 'citadel', 'farm', 'lookout', 'grove'];
  W.keys = function () {
    const k = ['g.set.wander', 'g.set.wander.tip', 'g.wd.place', 'g.wd.placeSub', 'g.wd.gift', 'g.wd.giftAdv', 'g.wd.landing', 'g.wd.book', 'g.wd.bookNote', 'g.wd.close',
      'g.wd.p.places', 'g.wd.p.people', 'g.wd.p.creatures', 'g.wd.p.stickers', 'g.wd.p.recipes', 'g.wd.none', 'g.wd.next', 'g.wd.chest', 'g.wd.chestSub', 'g.wd.mapHint',
      'g.wd.walk.with', 'g.wd.walk.to', 'g.wd.walk.arrive', 'g.wd.walk.chat.0', 'g.wd.walk.chat.1', 'g.wd.walk.chat.2', 'g.wd.walk.chat.3', 'g.wd.walk.chat.4', 'g.wd.pet.follow', 'g.wd.pet.home', 'g.wd.ruins.stone', 'g.wd.ruins.done', 'g.wd.sign.line', 'g.wd.recipe',
      'g.wd.cr.fox', 'g.wd.cr.rabbit', 'g.wd.cr.dog', 'g.wd.cr.pup'];
    for (const n of W.NAMES) k.push('g.wd.k.' + n, 'g.wd.s.' + n);
    for (const s of W.SITE_KINDS) k.push('g.wd.site.' + s);
    for (const r of W.RECIPES) k.push('g.wd.r.' + r);
    return k;
  };

  // ================================================================ the actor (the game)
  const ACT = W.ACT = {};
  const FOLK_ROLES = ['farmer', 'gardener', 'crafter', 'scholar', 'baker', 'teacher'];
  W.Actor = class {
    constructor(g) {
      this.g = g; this.time = 0; this.clock = 0; this.on = false; this.tier = 2;
      this.seed = ((((g.meta && g.meta.seed) | 0) ^ 0x3a7d) + nameHash(String(g.dim || 'overworld'))) | 0;
      this.ms = []; this.recent = []; this.timeline = []; this.lastK = null; this.retry = null; this.ctx = null; this.ctxT = 0;
      this.places = []; this.placeT = 0; this.next = null; this.bc = [0, 0, 0]; this.bcY = null; this.bcT = 0;
      this.st = { started: 0, quiet: 0, kinds: {}, found: 0, cost: 0 };
      this.mapChest = null;
    }
    // ---- what the moments read
    get P() { return this.g.particles; }
    get audio() { return this.g.audio; }
    get pos() { return this.g.player.pos; }
    get eye() { const p = this.g.player.pos; return [p[0], p[1] + 1.62, p[2]]; }
    get fwd() { const c = this.g.cam, y = c && c.yaw !== undefined ? c.yaw : this.g.player.yaw; return [-Math.sin(y), -Math.cos(y)]; }
    get adv() { return !!(VR.Adventure && VR.Adventure.on && VR.Adventure.on()); }
    get(x, y, z) { return this.g.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)); }
    solid(b) { const R = VR.R, F = VR.F; return !!(b && (R.T.flags[b] & F.SOLID) && !(R.T.flags[b] & F.REPLACE)); }
    wet(b) { const R = VR.R, F = VR.F; return !!(b && (R.T.flags[b] & F.WATER)); }
    // the walkable ground near y0 at a column (two free cells over a solid one, no water), or null
    ground(x, z, y0) {
      for (let y = Math.floor(y0) + 6; y > y0 - 12; y--) {
        const b = this.get(x, y, z); if (!this.solid(b)) continue;
        const a1 = this.get(x, y + 1, z), a2 = this.get(x, y + 2, z);
        if (this.solid(a1) || this.solid(a2) || this.wet(a1)) return null;
        return y + 1;
      }
      return null;
    }
    dist(p) { const e = this.pos; return Math.hypot(p[0] - e[0], p[2] - e[2]); }
    // a spot on open ground about `d` m ahead in the view, `side` (radians) off it — the first of a fixed list that is
    // free and level enough: [x, y, z] or null
    spot(d, side, flat) {
      const f = this.fwd, a0 = Math.atan2(f[1], f[0]), p = this.pos;
      for (const dd of [d, d + 6, d - 5, d + 12]) for (const aa of [side, -side, side * 0.4, 0, side * 1.4]) {
        if (dd < 8) continue;
        const a = a0 + aa, x = p[0] + Math.cos(a) * dd, z = p[2] + Math.sin(a) * dd;
        const y = this.ground(x, z, p[1]); if (y === null) continue;
        if (flat) { let ok = true; for (const [ox, oz] of [[flat, 0], [-flat, 0], [0, flat], [0, -flat]]) { const y2 = this.ground(x + ox, z + oz, y); if (y2 === null || Math.abs(y2 - y) > 1) { ok = false; break; } } if (!ok) continue; }
        return [x + 0.0, y, z + 0.0];
      }
      return null;
    }
    // the highest ground of a few spots ahead (the cairn's hilltop)
    high(d) {
      const f = this.fwd, a0 = Math.atan2(f[1], f[0]), p = this.pos; let best = null;
      for (const dd of [d, d + 10, d + 20]) for (const aa of [-0.5, -0.25, 0, 0.25, 0.5]) {
        const a = a0 + aa, x = p[0] + Math.cos(a) * dd, z = p[2] + Math.sin(a) * dd, y = this.ground(x, z, p[1] + 6);
        if (y !== null && (!best || y > best[1])) best = [x, y, z];
      }
      return best;
    }
    folk(seed, role, age) {
      const sty = this.species ? 'sp:' + this.species : undefined;
      return LK.folk(seed >>> 0, role || FOLK_ROLES[(seed >>> 3) % FOLK_ROLES.length], age || 'adult', sty);
    }
    fig(seed, pos, role, age) { return { look: this.folk(seed, role, age), pos: [pos[0], pos[1], pos[2]], yaw: 0, state: 'idle', walk: 0, walkAmt: 0, seed: (seed % 97) / 97, kid: age === 'child' }; }
    // a figure walks toward a point at a speed (keeps to the ground): true when there
    walkTo(F, tx, tz, sp, dt) {
      const dx = tx - F.pos[0], dz = tz - F.pos[2], d = Math.hypot(dx, dz);
      if (d < 0.3) { F.walkAmt = 0; return true; }
      const st = Math.min(d, sp * dt); F.pos[0] += dx / d * st; F.pos[2] += dz / d * st; F.walk += st; F.walkAmt = 1; F.yaw = LK.yawOf(dx, dz);
      if ((F.gT = (F.gT || 0) - dt) <= 0) { F.gT = 0.25; const gy = this.ground(F.pos[0], F.pos[2], F.pos[1]); if (gy !== null && Math.abs(gy - F.pos[1]) < 2.5) F.pos[1] = gy; }
      return false;
    }
    face(F, p) { F.yaw = LK.yawOf(p[0] - F.pos[0], p[2] - F.pos[2]); }
    note(title, sub, key) { const ui = this.g.ui; if (ui && ui.toast) ui.toast(title, sub || '', null, 2); }
    // a found moment: its sticker, the gift, one warm line
    found(m, sub) {
      if (m.found) return; m.found = true;
      const g = this.g, n = m.kind, first = W.note(g.meta, 'stickers', n), r = W.reward(n, this.adv);
      let gift = '';
      if (r.xp || r.taler) { const A = VR.Adventure, id = 'wd:' + n + ':' + m.k; const a = A.award('wow', { id }), b = r.taler ? A.award('chest', { id, taler: r.taler }) : null; gift = T('g.wd.giftAdv', { xp: (a && a.xp) | 0 || r.xp, t: (b && b.taler) | 0 || r.taler }); }
      else if (r.item && g.player && g.player.inv && g.player.inv.add) { g.player.inv.add(r.item[0], r.item[1]); gift = T('g.wd.gift', { n: r.item[1], item: VR.itemName ? VR.itemName(r.item[0]) : r.item[0] }); if (g.ui && g.ui.updateHUD) g.ui.updateHUD(true); }
      this.st.found++;
      this.note(W.KINDS[n].ico + ' ' + T('g.wd.k.' + n), [sub || T('g.wd.s.' + n), gift].filter(Boolean).join(' · '));
      return first;
    }
    // ---- the places (refreshed every 4 s): the villages near, Herzwelt's sites, another world's landmarks and landing
    refreshPlaces() {
      const g = this.g, out = [], Lnd = VR.Land, meta = g.meta || {};
      const vs = (g.villages && g.villages.sites) || [];
      for (const s of vs) if (s && Number.isFinite(s.x)) out.push({ id: 'v:' + s.id, x: s.x, z: s.z, name: s.name || T('g.q.pl.village'), rad: Math.min(70, s.rad || 40), kind: 'village' });
      if (g.dim === 'overworld' && Lnd && Lnd.SITES && (meta.vgen | 0) >= (Lnd.VGEN || 10) && meta.type !== 'flat') {
        for (const [id, x, z, kind] of Lnd.SITES) if (W.SITE_KINDS.indexOf(kind) >= 0 && (x || z)) out.push({ id: 'l:' + id, x, z, name: T('g.wd.site.' + kind), rad: kind === 'city' || kind === 'temple' ? 60 : 32, kind });
      }
      const WL = VR.WorldLife, kind = WL && WL.kindOf ? WL.kindOf(g) : null;
      if (kind) {
        try { for (const l of WL.landmarks(g, kind)) out.push({ id: 'm:' + l.key, x: l.x, z: l.z, name: l.name, rad: 22, kind: 'landmark' }); } catch (e) { /* no landmarks */ }
        const eco = WL.eco && WL.eco(g);
        if (eco && eco.land) out.push({ id: 'land', x: eco.land[0], z: eco.land[2], name: T('g.wd.landing'), rad: 25, kind: 'landing' });
      }
      this.places = out;
    }
    visit() {
      const g = this.g, p = this.pos;
      for (const P of this.places) if (Math.hypot(P.x - p[0], P.z - p[2]) < P.rad && W.note(g.meta, 'places', P.id, P.name)) this.note('📍 ' + T('g.wd.place', { name: P.name }), T('g.wd.placeSub'));
    }
    seen() { const B = W.book(this.g.meta); return B ? B.places : {}; }
    // ---- the context: the terrain, the hour, the weather
    context() {
      const g = this.g, p = this.pos, E = (g.env && g.env.E) || {};
      let at = 'open';
      const v = this.places.filter(P => P.kind === 'village' || P.kind === 'city' || P.kind === 'temple');
      let vd = Infinity; for (const P of v) vd = Math.min(vd, Math.hypot(P.x - p[0], P.z - p[2]) - P.rad);
      const under = this.get(p[0], p[1] - 0.5, p[2]), R = VR.R;
      const nm = under && R.T.name ? String(R.T.name[under] || '') : '';
      if (this.wet(this.get(p[0], p[1] + 0.2, p[2]))) at = 'water';
      else if (vd < 0) at = 'village';
      else if (/path|gravel|cobble|brick|pav|plank|road|cut_|polished|smooth/.test(nm)) at = 'way';
      else if (vd < 70) at = 'near';
      else {
        let leaves = 0, wat = 0;
        for (let k = 0; k < 8; k++) { const a = k / 8 * TAU, x = p[0] + Math.cos(a) * 7, z = p[2] + Math.sin(a) * 7, t = g.world.topAt ? g.world.topAt(Math.floor(x), Math.floor(z)) : p[1]; const b = this.get(x, t, z); const bn = b && R.T.name ? String(R.T.name[b] || '') : ''; if (/leaves/.test(bn)) leaves++; if (this.wet(b)) wat++; }
        at = leaves >= 3 ? 'wood' : wat >= 3 ? 'water' : p[1] > ((VR.C && VR.C.SEA) || 63) + 26 ? 'hill' : 'open';
      }
      const tod = g.env ? g.env.timeOfDay : 6000, hour = VR.LifeDirector && VR.LifeDirector.hourOf ? VR.LifeDirector.hourOf(tod) : 'noon';
      const wet = (E.rain || 0) > 0.15 || (E.snow || 0) > 0.15;
      const wx = g.env && g.env.wx, bow = !!(wx && wx.bow > 0.25);
      const B = W.book(g.meta);
      return { at, hour, wet, bow, tier: this.tier, map: !!(B && B.map) };
    }
    onFoot() {
      const g = this.g, p = g.player;
      if (!p || g.flight || g.photo || g.studioOpen || (g.ui && g.ui.screen && g.ui.screen !== 'hud')) return false;
      if (p.flying) { const gy = this.ground(p.pos[0], p.pos[2], p.pos[1] - 4); if (gy === null || p.pos[1] - gy > 18) return false; }
      return true;
    }
    update(dt) {
      const g = this.g, S = g.settings || {}, t0 = typeof performance !== 'undefined' ? performance.now() : 0;
      this.time += dt;
      const D = VR.DimReg && VR.DimReg.get(g.dim || 'overworld');
      this.on = S.wander !== false && g.state === 'play' && !!g.player && !!g.world && !!(D ? D.sky : true) && !(g.mp && g.mp.guest);
      this.tier = LK.tierOf(S);
      if (!this.on) { if (this.ms.length) this.endAll(); return; }
      this.species = VR.WorldLife && VR.WorldLife.kindOf ? VR.WorldLife.kindOf(g) : null;
      if ((this.placeT -= dt) <= 0) { this.placeT = 4; this.refreshPlaces(); this.visit(); }
      if ((this.ctxT -= dt) <= 0) { this.ctxT = 1; this.ctx = this.context(); }
      const walking = this.onFoot();
      if (walking) this.clock += dt;
      const k = W.slotAt(this.seed, this.clock);
      if (this.lastK === null) this.lastK = k - 1;   // (the first moment comes with the next slot … or now: see below)
      if (k > this.lastK && walking && this.auto !== false) { this.lastK = k; this.retry = { k, until: this.time + 8, nextT: 0 }; }
      if (this.retry && this.time >= this.retry.nextT) {
        if (this.time > this.retry.until) { this.retry = null; this.st.quiet++; }
        else { this.retry.nextT = this.time + 1; if (this.slot(this.retry.k)) this.retry = null; }
      }
      // the moments
      const cap = this.tier === 0 ? 1 : this.tier === 1 ? 2 : 3;
      while (this.ms.length > cap) this.end(this.ms[0]);
      const e = this.pos;
      for (let i = this.ms.length - 1; i >= 0; i--) {
        const m = this.ms[i], A = ACT[m.kind];
        m.age += dt;
        let alive = W.KINDS[m.kind].tier <= this.tier && !(m.pos && Math.hypot(e[0] - m.pos[0], e[2] - m.pos[2]) > 160);
        if (alive) { try { alive = A.update(this, m, dt) !== false && m.age < m.dur; } catch (err) { alive = false; if (!this.warned) { this.warned = true; console.warn('wander', m.kind, err); } } }
        if (!alive) this.end(m);
      }
      this.mapUpdate(dt);
      this.beaconUpdate(dt, walking);
      if (t0) this.st.cost = this.st.cost * 0.95 + (performance.now() - t0) * 0.05;
    }
    // slot k: the order of the moments, the first that finds its stage starts
    slot(k) {
      const ctx = this.ctx || (this.ctx = this.context());
      const order = W.order(this.seed, k, ctx, this.recent);
      for (let i = 0; i < order.length && i < 5; i++) if (this.start(order[i], k)) return true;
      return false;
    }
    start(kind, k, force) {
      const A = ACT[kind]; if (!A) return null;
      if (!force && this.ms.some(m => m.kind === kind)) return null;
      const m = { kind, k, seed: (h(this.seed, k, NH[kind]) * 0x7fffffff) | 0, age: 0, dur: W.KINDS[kind].dur, pos: null, found: false };
      let ok = false; try { ok = A.start(this, m) !== false; } catch (err) { ok = false; if (!this.warnedS) { this.warnedS = true; console.warn('wander start', kind, err); } }
      if (!ok) return null;
      this.ms.push(m); this.recent.push(kind); if (this.recent.length > 24) this.recent.shift();
      this.st.started++; this.st.kinds[kind] = (this.st.kinds[kind] || 0) + 1;
      const p = this.pos; let seen = null;
      if (VR.EventLog && VR.EventLog.emit) { try { const R = VR.EventLog.emit('ambient', 'wd:' + kind, 2, m.pos ? [m.pos[0], m.pos[1] + 1, m.pos[2]] : null, 'wander', 3); seen = R ? !!R.inView : null; } catch (e) { /* the log is optional */ } }
      this.timeline.push({ t: Math.round(this.time * 10) / 10, kind, d: m.pos ? Math.round(this.dist(m.pos)) : 0, x: Math.round(p[0]), z: Math.round(p[2]), seen });
      if (this.timeline.length > 400) this.timeline.shift();
      return m;
    }
    end(m) { const A = ACT[m.kind]; if (A && A.end) { try { A.end(this, m); } catch (e) { /* ends anyway */ } } const i = this.ms.indexOf(m); if (i >= 0) this.ms.splice(i, 1); }
    endAll() { while (this.ms.length) this.end(this.ms[0]); }
    // ---- the treasure map's chest: at its X (a real place), drawn when near, found when reached
    mapUpdate() {
      const B = W.book(this.g.meta), M = B && B.map; if (!M) { this.mapChest = null; return; }
      if (!Number.isFinite(M.x) || !Number.isFinite(M.z)) { delete B.map; return; }
      const d = this.dist([M.x, 0, M.z]);
      if (d < 70 && !this.mapChest) { const y = this.ground(M.x, M.z, this.pos[1] + 4); if (y !== null) this.mapChest = [M.x, y, M.z]; }
      if (this.mapChest && d < 2.6) {
        delete B.map; this.mapChest = null;
        const g = this.g, C = W.CHEST; let gift = '';
        if (this.adv) { const A = VR.Adventure, id = 'wd:chest:' + Math.round(M.x) + ':' + Math.round(M.z), a = A.award('wow', { id }), b = A.award('chest', { id, taler: C.taler }); gift = T('g.wd.giftAdv', { xp: (a && a.xp) | 0 || C.xp, t: (b && b.taler) | 0 || C.taler }); }
        else if (g.player.inv && g.player.inv.add) { g.player.inv.add(C.item[0], C.item[1]); gift = T('g.wd.gift', { n: C.item[1], item: VR.itemName ? VR.itemName(C.item[0]) : C.item[0] }); }
        if (this.P) this.P.spark(M.x, this.pos[1] + 1, M.z, [1, 0.85, 0.35], 24, 2.2, 1);
        this.note('💰 ' + T('g.wd.chest'), [T('g.wd.chestSub', { place: M.name || '' }), gift].filter(Boolean).join(' · '));
        this.st.chests = (this.st.chests || 0) + 1;
      }
    }
    // ---- the Wegballon
    beaconUpdate(dt, walking) {
      this.bcOn = false;
      if (!walking || !this.places.length || this.g.settings.wanderBeacon === false) return;
      if ((this.bcT -= dt) <= 0) { this.bcT = 2; this.next = W.nextPlace(this.places, this.pos, this.g.player.yaw, this.seen()); }
      if (!this.next) return;
      const b = W.beacon(this.pos, this.next, this.time, this.bc);
      const gy = this.g.world.topAt ? this.g.world.topAt(Math.floor(b[0]), Math.floor(b[2])) : this.pos[1];
      const base = Math.max(gy || 0, ((VR.C && VR.C.SEA) || 63)) + 1;
      this.bcY = this.bcY === null ? base : this.bcY + (base - this.bcY) * Math.min(1, dt * 0.6);
      this.bcPos = this.bcPos || [0, 0, 0]; this.bcPos[0] = b[0]; this.bcPos[1] = this.bcY + b[1]; this.bcPos[2] = b[2];
      this.bcOn = true;
      if (this.tier >= 2 && this.P && (this.bcGlow = (this.bcGlow || 0) - dt) <= 0) { this.bcGlow = 0.5; this.P.spawn(b[0], this.bcPos[1] + 0.4, b[2], 0, -0.2, 0, { life: 1.2, size: 1.6, grav: 0, col: [1, 0.72, 0.36], emis: 1, drag: 0.5, collide: false, force: true }); }
    }
    draw(r, E, layer, cam) {
      if (!this.on || layer !== 'opaque') return;
      if (!this.ms.length && !this.bcOn && !this.mapChest) return;
      const g = this.g, ent = g.entities; if (!ent) return;
      let p = null; const prog = () => p || (p = ent.beginVox(r, E));
      cam = cam || r.cam;
      for (const m of this.ms) { const A = ACT[m.kind]; if (A.draw) { try { A.draw(this, m, r, E, cam, prog); } catch (e) { if (!this.warnedD) { this.warnedD = true; console.warn('wander draw', m.kind, e); } } } }
      if (this.bcOn) LK.drawModel(g, r, prog(), 'wander_balloon', this.bcPos, this.time * 0.2, cam, { scale: 2.6 });
      if (this.mapChest) LK.drawModel(g, r, prog(), 'wander_chest', this.mapChest, 0.4, cam, {});
    }
    stats() { return { on: this.on, tier: this.tier, started: this.st.started, quiet: this.st.quiet, found: this.st.found, kinds: Object.assign({}, this.st.kinds), active: this.ms.map(m => m.kind), timeline: this.timeline.slice(), next: this.next ? this.next.name : null, beacon: this.bcOn ? this.bcPos.slice() : null, cost: this.st.cost, places: this.places.length, ctx: this.ctx, chests: this.st.chests || 0 }; }
    destroy() { this.endAll(); }
  };

  // ================================================================ the moments' actors
  const rnd = (m, i) => h(m.seed, i, 0x77);
  const pt = (m) => m.pos;
  const near = (D, p, r) => D.dist(p) < r;
  const fly = (D, x, y, z, col, n) => { if (D.tier >= 2 && D.P) for (let i = 0; i < (n || 1); i++) D.P.spawn(x + (Math.random() - 0.5) * 3, y + Math.random() * 1.5, z + (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 0.6, 0.15 + Math.random() * 0.3, (Math.random() - 0.5) * 0.6, { life: 2.2, size: 0.12, grav: 0, col, emis: 1, drag: 0.6, collide: false, force: true }); };
  const CHAT = 5;

  // a wanderer: on the way ahead, heading for the next place; walk with them and they wait for you, chat, and thank you
  // at the place (a person in the Wanderbuch)
  ACT.traveller = {
    start(D, m) {
      const s = D.spot(26, 0.35); if (!s) return false;
      const to = W.nextPlace(D.places, s, D.g.player.yaw, D.seen()) || null;
      m.pos = s; m.to = to;
      m.F = D.fig(m.seed, s, null, 'adult'); m.name = (D.g.villages && VR.Villagers && VR.Villagers.nameFor) ? VR.Villagers.nameFor(m.seed) : null;
      if (!m.name) { const A = ['Mira', 'Jonas', 'Ilka', 'Ben', 'Tilda', 'Oskar', 'Lene', 'Paul', 'Rosa', 'Emil', 'Wanda', 'Fiete']; m.name = A[(m.seed >>> 2) % A.length]; }
      m.chatN = 0; m.chatT = 4; m.with = 0;
      return true;
    },
    update(D, m, dt) {
      const F = m.F, d = D.dist(F.pos);
      if (d < 7) m.with += dt;
      if (m.with > 2 && !m.joined) { m.joined = true; m.dur = Math.max(m.dur, 420); W.note(D.g.meta, 'people', m.name); D.note('🎒 ' + T('g.wd.walk.with', { name: m.name }), m.to ? T('g.wd.walk.to', { place: m.to.name }) : ''); }
      if (m.joined && (m.chatT -= dt) <= 0 && d < 9 && m.chatN < CHAT) { m.chatT = 16; F.talking = true; D.note('💬 ' + m.name, T('g.wd.walk.chat.' + ((m.seed + m.chatN) % CHAT), { place: m.to ? m.to.name : '' })); m.chatN++; }
      if (m.chatT < 13) F.talking = false;
      const tx = m.to ? m.to.x : F.pos[0] - Math.sin(F.yaw) * 50, tz = m.to ? m.to.z : F.pos[2] - Math.cos(F.yaw) * 50;
      // the pace: with you, as fast as you (a little ahead); waiting (a wave) when you stay behind; alone, a stroll
      const ahead = (tx - F.pos[0]) * (D.pos[0] - F.pos[0]) + (tz - F.pos[2]) * (D.pos[2] - F.pos[2]);
      const sp = m.joined ? (d > 14 ? 0 : ahead > 0 ? 2.6 : 1.5) : 1.2;
      if (sp > 0) { F.state = 'idle'; D.walkTo(F, tx, tz, sp, dt); } else { F.walkAmt = 0; F.state = 'wave'; D.face(F, D.pos); }
      m.pos = F.pos;
      if (m.to && Math.hypot(tx - F.pos[0], tz - F.pos[2]) < m.to.rad * 0.8) {
        if (m.joined && !m.found) D.found(m, T('g.wd.walk.arrive', { name: m.name, place: m.to.name }));
        if (!m.byeT) m.byeT = m.age;
        F.state = 'wave'; if (m.age - m.byeT > 6) return false;
      }
      if (!m.joined && d > 90) return false;
    },
    draw(D, m, r, E, cam, prog) { LK.drawFolk(D.g, r, prog(), m.F, cam, D.time); },
  };
  // a caravan: two traders, the cart, a dog — on the way; they give you something as they pass
  ACT.caravan = {
    start(D, m) {
      const s = D.spot(34, 0.4); if (!s) return false;
      const f = D.fwd, a = Math.atan2(-f[0], -f[1]) + (rnd(m, 1) < 0.5 ? 1.4 : -1.4);   // across the view
      m.dir = [-Math.sin(a), -Math.cos(a)];
      m.pos = s; m.F = [D.fig(m.seed, s, 'farmer'), D.fig(m.seed + 7, [s[0] - m.dir[0] * 4.6, s[1], s[2] - m.dir[1] * 4.6], 'crafter')];
      m.cart = [s[0] - m.dir[0] * 2.3, s[1] + 0.5, s[2] - m.dir[1] * 2.3, a];
      m.q = { kind: 'life_dog', pos: [s[0] + m.dir[1] * 1.4, s[1], s[2] - m.dir[0] * 1.4], yaw: a, state: 'walk' };
      return true;
    },
    update(D, m, dt) {
      const sp = near(D, m.pos, 8) ? 0 : 1.1;
      for (const F of m.F) { if (sp) D.walkTo(F, F.pos[0] + m.dir[0] * 5, F.pos[2] + m.dir[1] * 5, sp, dt); else { F.walkAmt = 0; F.state = 'wave'; D.face(F, D.pos); } }
      const L = m.F[0].pos; m.pos = L;
      m.cart[0] = L[0] - m.dir[0] * 2.3; m.cart[2] = L[2] - m.dir[1] * 2.3; m.cart[1] += ((L[1] + 0.5) - m.cart[1]) * Math.min(1, dt * 3);
      const q = m.q; q.pos[0] = L[0] + m.dir[1] * 1.4; q.pos[2] = L[2] - m.dir[0] * 1.4; q.pos[1] = L[1]; q.state = sp ? 'walk' : 'sit';
      if (!sp && !m.found) D.found(m);
      if (D.dist(m.pos) > 100) return false;
    },
    draw(D, m, r, E, cam, prog) { for (const F of m.F) LK.drawFolk(D.g, r, prog(), F, cam, D.time); LK.drawModel(D.g, r, prog(), 'life_cart', m.cart, m.cart[3], cam, {}); LK.drawQuad(D.g, r, prog(), m.q, cam, D.time); },
  };
  // a lost dog (a glowing pup on other worlds): it sits and whimpers; near it, it follows you; bring it to a village
  ACT.pet = {
    start(D, m) {
      const s = D.spot(20, 0.45); if (!s) return false;
      m.pos = s; m.q = { kind: D.species ? 'crystal_pup' : 'life_dog', pos: s, yaw: 0, state: 'sit' };
      if (!VR.VOXMODELS || !VR.VOXMODELS[m.q.kind]) m.q.kind = 'life_dog';
      m.wT = 0;
      return true;
    },
    update(D, m, dt) {
      const q = m.q, d = D.dist(q.pos);
      if (!m.follow) {
        D.face(q, D.pos); q.yaw = LK.yawOf(D.pos[0] - q.pos[0], D.pos[2] - q.pos[2]);
        if ((m.wT -= dt) <= 0 && d < 30) { m.wT = 3; const A = D.audio; if (A && A.ctx) { A.tone(880, 0.025, 0.18, 'sine', true); A.tone(740, 0.02, 0.22, 'sine', true, (A.ctx.currentTime || 0) + 0.2); } }
        if (d < 3.2) {
          m.follow = true; m.dur = Math.max(m.dur, 900);
          const v = D.places.filter(P => P.kind === 'village').sort((a, b) => D.dist([a.x, 0, a.z]) - D.dist([b.x, 0, b.z]))[0];
          m.home = v || null; W.note(D.g.meta, 'creatures', D.species ? 'pup' : 'dog');
          D.note('🐕 ' + T('g.wd.pet.follow'), v ? T('g.wd.pet.home', { place: v.name, d: Math.round(D.dist([v.x, 0, v.z]) / 10) * 10 }) : '');
        }
        if (d > 70) return false;
        return;
      }
      // following: two metres behind you
      const p = D.pos, dx = p[0] - q.pos[0], dz = p[2] - q.pos[2], dd = Math.hypot(dx, dz);
      if (dd > 2.2) { const sp = Math.min(dd * 1.5, 7) * dt; q.pos[0] += dx / dd * sp; q.pos[2] += dz / dd * sp; q.state = 'walk'; q.yaw = LK.yawOf(dx, dz); if ((m.gT = (m.gT || 0) - dt) <= 0) { m.gT = 0.25; const gy = D.ground(q.pos[0], q.pos[2], q.pos[1]); if (gy !== null) q.pos[1] = gy; } }
      else q.state = 'sit';
      if (dd > 40) { q.pos[0] = p[0] - dx / dd * 3; q.pos[2] = p[2] - dz / dd * 3; q.pos[1] = p[1]; }   // (it runs to keep up)
      m.pos = q.pos;
      if (m.home && Math.hypot(m.home.x - p[0], m.home.z - p[2]) < m.home.rad * 0.9) {
        if (!m.owner) { const o = D.spot(5, 0.8) || [p[0] + 3, p[1], p[2]]; m.owner = D.fig(m.seed + 3, o, 'child', 'child'); m.owner.state = 'cheer'; m.oT = m.age; D.found(m); if (D.P) D.P.spark(o[0], o[1] + 1.4, o[2], [1, 0.5, 0.7], 14, 1.6, 1); }
        D.face(m.owner, q.pos); m.owner.state = m.age - m.oT < 3 ? 'cheer' : 'wave';
        const ox = m.owner.pos[0] - q.pos[0], oz = m.owner.pos[2] - q.pos[2], od = Math.hypot(ox, oz);
        if (od > 1) { q.pos[0] += ox / od * 3 * dt; q.pos[2] += oz / od * 3 * dt; q.yaw = LK.yawOf(ox, oz); }
        if (m.age - m.oT > 9) return false;
      }
    },
    draw(D, m, r, E, cam, prog) { LK.drawQuad(D.g, r, prog(), m.q, cam, D.time); if (m.owner) LK.drawFolk(D.g, r, prog(), m.owner, cam, D.time); },
  };
  // a picnic on a blanket: they wave you over, you are invited — a slice of pie and a recipe for the Wanderbuch
  ACT.picnic = {
    start(D, m) {
      const s = D.spot(22, 0.5, 2); if (!s) return false;
      m.pos = s; m.yaw = rnd(m, 2) * TAU;
      const c = Math.cos(m.yaw), sn = Math.sin(m.yaw);
      const at = (ox, oz) => [s[0] + ox * c + oz * sn, s[1], s[2] - ox * sn + oz * c];
      m.F = [D.fig(m.seed, at(-1.1, 0.4), null, 'adult'), D.fig(m.seed + 5, at(1.0, 0.5), null, 'adult'), D.fig(m.seed + 9, at(0.1, -1.1), 'child', 'child')];
      for (const F of m.F) { F.state = 'sit'; F.yaw = LK.yawOf(s[0] - F.pos[0], s[2] - F.pos[2]); }
      return true;
    },
    update(D, m, dt) {
      const d = D.dist(m.pos);
      for (let i = 0; i < m.F.length; i++) { const F = m.F[i]; if (d < 16 && !m.found) { F.state = i === 2 ? 'wave' : 'sit'; if (i === 2) D.face(F, D.pos); } else F.state = i === 2 && Math.sin(D.time * 0.8) > 0.6 ? 'cheer' : 'sit'; F.talking = Math.sin(D.time * 1.3 + i * 2) > 0.4; }
      if (d < 6 && !m.found) { const r = W.RECIPES[(m.seed >>> 1) % W.RECIPES.length]; W.note(D.g.meta, 'recipes', r); D.found(m, T('g.wd.recipe', { r: T('g.wd.r.' + r) })); }
      if (D.tier >= 2 && (m.bT = (m.bT || 0) - dt) <= 0) { m.bT = 1.4; fly(D, m.pos[0], m.pos[1] + 0.6, m.pos[2], [1, 0.9, 0.4], 1); }
      if (d > 90) return false;
    },
    draw(D, m, r, E, cam, prog) { LK.drawModel(D.g, r, prog(), 'wander_blanket', m.pos, m.yaw, cam, {}); for (const F of m.F) LK.drawFolk(D.g, r, prog(), F, cam, D.time); },
  };
  // a wandering musician: a short pentatonic tune; near, a sticker
  ACT.musician = {
    start(D, m) {
      const s = D.spot(18, 0.4); if (!s) return false;
      m.pos = s; m.F = D.fig(m.seed, s, 'crafter'); D.face(m.F, D.pos);
      m.F.posefx = (P) => { const t = D.time, set = (j, rx, ry, rz) => { const o = P[j]; if (o) { o[0] = rx; o[1] = ry; o[2] = rz; } }; set('arm_l', 1.15, 0.35, 0.55); set('fore_l', 0.9, 0, 0); set('arm_r', 0.85 + Math.sin(t * 11) * 0.28, 0, -0.35); set('fore_r', 0.8, 0, 0); };
      const S = [261.6, 293.7, 329.6, 392.0, 440.0, 523.3, 587.3, 659.3];
      let t = 0.6, st = 3; m.notes = [];
      for (let i = 0; i < 16; i++) { st = Math.max(0, Math.min(7, st + [-2, -1, 1, 1, 2, 0, -1][Math.floor(rnd(m, 30 + i) * 7)])); const d = rnd(m, 60 + i) < 0.3 ? 0.5 : 0.25; m.notes.push({ t, f: S[i === 15 ? 0 : st], d }); t += d; if (i === 7) t += 0.5; }
      m.n = 0; m.tuneT = t + 2; m.loop = 0;
      return true;
    },
    update(D, m, dt) {
      const F = m.F, d = D.dist(F.pos), A = D.audio, vol = Math.max(0, 0.06 * (1 - d / 40));
      D.face(F, D.pos);
      const tt = m.age - m.loop * m.tuneT;
      if (tt > m.tuneT) { m.loop++; m.n = 0; }
      while (m.n < m.notes.length && tt >= m.notes[m.n].t) {
        const N = m.notes[m.n++];
        if (A && A.ctx && vol > 0.003) { A.tone(N.f, vol, N.d * 2.2, 'triangle', true); A.tone(N.f / 2, vol * 0.35, N.d * 2.5, 'sine', true); }
        if (D.tier >= 2 && D.P) D.P.spawn(F.pos[0] + (Math.random() - 0.5) * 0.5, F.pos[1] + 2, F.pos[2] + (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.3, 0.8, (Math.random() - 0.5) * 0.3, { life: 1.8, size: 0.09, grav: 0, col: [[1, 0.85, 0.3], [0.5, 1, 0.9], [1, 0.5, 0.8]][m.n % 3], emis: 1, drag: 0.4, collide: false, force: true });
      }
      if (d < 10) D.found(m);
      if (d > 80) return false;
    },
    draw(D, m, r, E, cam, prog) {
      const F = m.F; LK.drawFolk(D.g, r, prog(), F, cam, D.time);
      const c = Math.cos(F.yaw), s = Math.sin(F.yaw), lp = m.lp || (m.lp = [0, 0, 0]);
      lp[0] = F.pos[0] - s * 0.32 + c * 0.05; lp[1] = F.pos[1] + 1.02; lp[2] = F.pos[2] - c * 0.32 - s * 0.05;
      LK.drawModel(D.g, r, prog(), 'life_lute', lp, F.yaw + Math.PI / 2, cam, { roll: 0.6, pitch: 0.15 });
    },
  };
  // a kite festival in the meadow: four kites high up, children holding them
  ACT.kites = {
    start(D, m) {
      const s = D.spot(34, 0.3, 2); if (!s) return false;
      m.pos = s; m.K = []; m.F = [];
      for (let i = 0; i < 4; i++) {
        const a = rnd(m, i) * TAU, rr = 2 + rnd(m, 10 + i) * 5, fp = [s[0] + Math.cos(a) * rr, s[1], s[2] + Math.sin(a) * rr];
        const gy = D.ground(fp[0], fp[2], s[1]); if (gy !== null) fp[1] = gy;
        const F = D.fig(m.seed + i * 11, fp, 'child', i < 3 ? 'child' : 'adult'); F.state = 'point'; m.F.push(F);
        m.K.push({ base: fp, ph: rnd(m, 20 + i) * TAU, h: 14 + rnd(m, 30 + i) * 8, off: 6 + rnd(m, 40 + i) * 5, col: i, p: [0, 0, 0] });
      }
      return true;
    },
    update(D, m, dt) {
      const wind = 0.6 + 0.4 * Math.sin(D.time * 0.3);
      for (let i = 0; i < m.K.length; i++) {
        const k = m.K[i], t = D.time + k.ph, F = m.F[i];
        k.p[0] = k.base[0] + k.off + Math.sin(t * 0.7) * 2.5 * wind; k.p[1] = k.base[1] + k.h + Math.sin(t * 1.1) * 1.4; k.p[2] = k.base[2] + Math.cos(t * 0.5) * 3;
        F.yaw = LK.yawOf(k.p[0] - F.pos[0], k.p[2] - F.pos[2]); F.state = i === 3 ? 'idle' : 'point';
        if (D.tier >= 2 && D.P && (k.sT = (k.sT || 0) - dt) <= 0) { k.sT = 0.35; const u = Math.random(); D.P.spawn(F.pos[0] + (k.p[0] - F.pos[0]) * u, F.pos[1] + 1.3 + (k.p[1] - F.pos[1] - 1.3) * u, F.pos[2] + (k.p[2] - F.pos[2]) * u, 0, 0, 0, { life: 0.5, size: 0.05, grav: 0, col: [0.95, 0.95, 0.9], emis: 0, drag: 1, collide: false, force: true }); }
      }
      if (D.dist(m.pos) < 26) D.found(m);
      if (D.dist(m.pos) > 110) return false;
    },
    draw(D, m, r, E, cam, prog) {
      for (const F of m.F) LK.drawFolk(D.g, r, prog(), F, cam, D.time);
      for (const k of m.K) LK.drawModel(D.g, r, prog(), 'wander_kite' + k.col, k.p, Math.sin(D.time * 0.6 + k.ph) * 0.3 + 1.2, cam, { roll: Math.sin(D.time * 1.3 + k.ph) * 0.25, pitch: -0.35 });
    },
  };
  // a fox (or three rabbits) crossing ahead: a creature for the Wanderbuch
  ACT.crossing = {
    start(D, m) {
      const s = D.spot(16, 0.15); if (!s) return false;
      const f = D.fwd, side = rnd(m, 1) < 0.5 ? 1 : -1, nx = -f[1] * side, nz = f[0] * side;
      const fox = D.tier === 0 || rnd(m, 2) < 0.55, kind = fox ? 'wild_fox' : 'wild_rabbit';
      if (!VR.VOXMODELS || !VR.VOXMODELS[kind]) return false;
      m.cr = fox ? 'fox' : 'rabbit'; m.dir = [nx, nz];
      m.Q = []; const n = fox ? 1 : 3;
      for (let i = 0; i < n; i++) m.Q.push({ kind, pos: [s[0] - nx * (9 + i * 1.6), s[1], s[2] - nz * (9 + i * 1.6) + (i - 1) * 0.8], yaw: LK.yawOf(nx, nz), state: 'walk', hop: i * 0.7 });
      m.pos = s; m.sp = fox ? 3.2 : 2.6;
      return true;
    },
    update(D, m, dt) {
      for (const q of m.Q) {
        q.pos[0] += m.dir[0] * m.sp * dt; q.pos[2] += m.dir[1] * m.sp * dt;
        if ((q.gT = (q.gT || 0) - dt) <= 0) { q.gT = 0.25; const gy = D.ground(q.pos[0], q.pos[2], q.pos[1]); if (gy !== null && Math.abs(gy - q.pos[1]) < 2.5) q.pos[1] = gy; }
        q.dy = m.cr === 'rabbit' ? Math.abs(Math.sin(D.time * 7 + q.hop)) * 0.25 : 0;
      }
      m.pos = m.Q[0].pos;
      if (!m.found && D.dist(m.pos) < 30) { m.found = true; const first = W.note(D.g.meta, 'creatures', m.cr); W.note(D.g.meta, 'stickers', 'crossing'); if (first) D.note(W.KINDS.crossing.ico + ' ' + T('g.wd.k.crossing'), T('g.wd.cr.' + m.cr)); D.st.found++; }
    },
    draw(D, m, r, E, cam, prog) { for (const q of m.Q) { const y = q.pos[1]; q.pos[1] = y + (q.dy || 0); LK.drawModel(D.g, r, prog(), q.kind, q.pos, q.yaw, cam, { pose: LK.quadPose(q, D.time) }); q.pos[1] = y; } },
  };
  // the weather's rainbow (weather.js draws it): noticed, a sticker
  ACT.rainbow = {
    start(D, m) { if (!(D.ctx && D.ctx.bow)) return false; m.pos = null; m.t0 = 0; return true; },
    update(D, m) { if (m.age > 1.5) D.found(m); const wx = D.g.env && D.g.env.wx; if (m.age > 3 && !(wx && wx.bow > 0.1)) return false; },
  };
  // a hidden glade: a fairy ring of mushrooms among flowers; butterflies by day, fireflies at night
  ACT.glade = {
    start(D, m) { const s = D.spot(22, 0.5, 2); if (!s) return false; m.pos = s; m.yaw = rnd(m, 1) * TAU; return true; },
    update(D, m, dt) {
      const night = D.ctx && (D.ctx.hour === 'night' || D.ctx.hour === 'dusk');
      if ((m.fT = (m.fT || 0) - dt) <= 0) { m.fT = night ? 0.25 : 0.6; fly(D, m.pos[0], m.pos[1] + 0.3, m.pos[2], night ? [0.8, 1, 0.4] : [[1, 0.6, 0.85], [0.6, 0.8, 1], [1, 0.9, 0.4]][Math.floor(Math.random() * 3)], 1); }
      if (D.dist(m.pos) < 3.5) D.found(m);
      if (D.dist(m.pos) > 90) return false;
    },
    draw(D, m, r, E, cam, prog) { LK.drawModel(D.g, r, prog(), 'wander_glade', m.pos, m.yaw, cam, {}); },
  };
  // a cairn on the high ground ahead: the view, a sticker
  ACT.cairn = {
    start(D, m) { const s = D.high(26) || D.spot(24, 0.3); if (!s) return false; m.pos = s; m.yaw = rnd(m, 1) * TAU; return true; },
    update(D, m) { if (D.dist(m.pos) < 3) D.found(m); if (D.dist(m.pos) > 100) return false; },
    draw(D, m, r, E, cam, prog) { LK.drawModel(D.g, r, prog(), 'wander_cairn', m.pos, m.yaw, cam, {}); },
  };
  // a tiny shrine by the way: a lantern under a roof, flowers; at night its lantern glows
  ACT.shrine = {
    start(D, m) { const s = D.spot(20, 0.5, 1); if (!s) return false; m.pos = s; m.yaw = LK.yawOf(D.pos[0] - s[0], D.pos[2] - s[2]); return true; },
    update(D, m, dt) {
      const night = D.ctx && (D.ctx.hour === 'night' || D.ctx.hour === 'dusk');
      if (night && D.tier >= 1 && D.P && (m.gT = (m.gT || 0) - dt) <= 0) { m.gT = 0.45; D.P.spawn(m.pos[0], m.pos[1] + 1.1, m.pos[2], 0, 0, 0, { life: 0.95, size: 0.7, grav: 0, col: [1, 0.74, 0.38], emis: 1, drag: 1, collide: false, force: true }); }
      if (D.dist(m.pos) < 3) D.found(m);
      if (D.dist(m.pos) > 90) return false;
    },
    draw(D, m, r, E, cam, prog) { LK.drawModel(D.g, r, prog(), 'wander_shrine', m.pos, m.yaw, cam, {}); },
  };
  // ruins with a riddle: a broken arch and three rune stones round it — touch all three and the arch's chest opens
  ACT.ruins = {
    start(D, m) {
      const s = D.spot(28, 0.4, 2); if (!s) return false;
      m.pos = s; m.yaw = LK.yawOf(D.pos[0] - s[0], D.pos[2] - s[2]); m.R = [];
      for (let i = 0; i < 3; i++) { const a = m.yaw + Math.PI / 2 + (i - 1) * 2.1, x = s[0] + Math.sin(a) * 7, z = s[2] + Math.cos(a) * 7, y = D.ground(x, z, s[1]); if (y === null) return false; m.R.push({ p: [x, y, z], lit: false }); }
      return true;
    },
    update(D, m) {
      const d = D.dist(m.pos);
      if (d < 16 && !m.told) { m.told = true; D.note('🏛 ' + T('g.wd.k.ruins'), T('g.wd.s.ruins')); }
      let n = 0;
      for (const R of m.R) { if (!R.lit && D.dist(R.p) < 2.2) { R.lit = true; if (D.P) D.P.spark(R.p[0], R.p[1] + 1, R.p[2], [0.5, 0.9, 1], 10, 1.4, 1); const A = D.audio; if (A && A.ctx) A.tone([523.3, 659.3, 784][m.R.filter(q => q.lit).length - 1] || 523.3, 0.05, 0.6, 'sine', true); if (m.R.some(q => !q.lit)) D.note('✨ ' + T('g.wd.ruins.stone', { n: m.R.filter(q => q.lit).length })); } if (R.lit) n++; }
      if (n === 3 && !m.open) { m.open = true; m.dur = Math.max(m.dur, m.age + 60); }
      if (m.open && d < 2.8) D.found(m, T('g.wd.ruins.done'));
      if (d > 110) return false;
    },
    draw(D, m, r, E, cam, prog) {
      LK.drawModel(D.g, r, prog(), 'wander_arch', m.pos, m.yaw, cam, {});
      for (const R of m.R) LK.drawModel(D.g, r, prog(), R.lit ? 'wander_rune_lit' : 'wander_rune', R.p, m.yaw, cam, {});
      if (m.open && !m.found) LK.drawModel(D.g, r, prog(), 'wander_chest', m.pos, m.yaw, cam, {});
    },
  };
  // a scrap of a treasure map fluttering on the ground: an X at a real place (the chest waits there: mapUpdate)
  ACT.scrap = {
    start(D, m) { const s = D.spot(16, 0.3); if (!s) return false; m.pos = s; m.yaw = rnd(m, 1) * TAU; return true; },
    update(D, m) {
      if (D.dist(m.pos) < 2.4 && !m.found) {
        const B = W.book(D.g.meta), far = D.places.filter(P => D.dist([P.x, 0, P.z]) > 120).sort((a, b) => D.dist([a.x, 0, a.z]) - D.dist([b.x, 0, b.z]));
        const P = far[(m.seed >>> 4) % Math.max(1, Math.min(3, far.length))];
        if (P && B) {
          const a = rnd(m, 5) * TAU, rr = P.rad + 8; B.map = { x: Math.round(P.x + Math.cos(a) * rr), z: Math.round(P.z + Math.sin(a) * rr), name: P.name };
          const dx = B.map.x - D.pos[0], dz = B.map.z - D.pos[2];
          D.found(m, T('g.wd.mapHint', { place: P.name, d: Math.round(Math.hypot(dx, dz) / 10) * 10, dir: T('g.dir.' + W.dirOf(dx, dz)) }));
        } else D.found(m);
        return false;
      }
      if (D.dist(m.pos) > 80) return false;
    },
    draw(D, m, r, E, cam, prog) { const y = m.pos[1]; m.pos[1] = y + 0.02 + Math.abs(Math.sin(D.time * 3)) * 0.04; LK.drawModel(D.g, r, prog(), 'wander_scrap', m.pos, m.yaw + Math.sin(D.time * 2) * 0.1, cam, {}); m.pos[1] = y; },
  };
  // a signpost: the next places, how far, which way
  ACT.sign = {
    start(D, m) { if (D.places.length < 2) return false; const s = D.spot(16, 0.35); if (!s) return false; m.pos = s; m.yaw = LK.yawOf(D.pos[0] - s[0], D.pos[2] - s[2]); return true; },
    update(D, m) {
      if (D.dist(m.pos) < 6 && !m.found) {
        const L = W.signLines(D.places, m.pos, 3).map(l => T('g.wd.sign.line', { place: l.place.name, d: l.d, dir: T('g.dir.' + l.dir) }));
        D.found(m, L.join(' · '));
      }
      if (D.dist(m.pos) > 80) return false;
    },
    draw(D, m, r, E, cam, prog) { LK.drawModel(D.g, r, prog(), 'wander_sign', m.pos, m.yaw, cam, {}); },
  };
  // a stargazer on a clear night with a telescope
  ACT.stargazer = {
    start(D, m) { const s = D.high(20) || D.spot(18, 0.4); if (!s) return false; m.pos = s; m.F = D.fig(m.seed, s, 'scholar'); m.yaw = rnd(m, 1) * TAU; m.F.yaw = m.yaw; m.F.state = 'point'; return true; },
    update(D, m) { const d = D.dist(m.pos); if (d < 9) { m.F.state = 'talk'; D.face(m.F, D.pos); D.found(m); } if (d > 90) return false; },
    draw(D, m, r, E, cam, prog) { LK.drawFolk(D.g, r, prog(), m.F, cam, D.time); const c = Math.cos(m.yaw), s = Math.sin(m.yaw); LK.drawModel(D.g, r, prog(), 'wander_scope', [m.pos[0] + c * 1.1, m.pos[1], m.pos[2] - s * 1.1], m.yaw, cam, {}); },
  };
  // a lantern walk at dusk: three people with lanterns walking by
  ACT.lanterns = {
    start(D, m) {
      const s = D.spot(26, 0.4); if (!s) return false;
      const f = D.fwd, a = Math.atan2(-f[0], -f[1]) + (rnd(m, 1) < 0.5 ? 1.3 : -1.3); m.dir = [-Math.sin(a), -Math.cos(a)];
      m.pos = s; m.F = [];
      for (let i = 0; i < 3; i++) m.F.push(D.fig(m.seed + i * 13, [s[0] - m.dir[0] * i * 1.8, s[1], s[2] - m.dir[1] * i * 1.8], i === 1 ? 'child' : null, i === 1 ? 'child' : 'adult'));
      m.L = m.F.map(() => [0, 0, 0]);
      return true;
    },
    update(D, m, dt) {
      const sp = near(D, m.pos, 7) ? 0.5 : 1.0;
      for (let i = 0; i < m.F.length; i++) {
        const F = m.F[i]; D.walkTo(F, F.pos[0] + m.dir[0] * 5, F.pos[2] + m.dir[1] * 5, sp, dt);
        const c = Math.cos(F.yaw), s = Math.sin(F.yaw), L = m.L[i]; L[0] = F.pos[0] + c * 0.38 - s * 0.25; L[1] = F.pos[1] + (F.kid ? 0.6 : 0.85) + Math.sin(D.time * 4 + i) * 0.03; L[2] = F.pos[2] - s * 0.38 - c * 0.25;
        if (D.tier >= 2 && D.P && (F.lT = (F.lT || 0) - dt) <= 0) { F.lT = 0.4; D.P.spawn(L[0], L[1] + 0.1, L[2], 0, 0, 0, { life: 0.8, size: 0.55, grav: 0, col: [1, 0.66, 0.32], emis: 1, drag: 1, collide: false, force: true }); }
      }
      m.pos = m.F[0].pos;
      if (D.dist(m.pos) < 12) D.found(m);
      if (D.dist(m.pos) > 100) return false;
    },
    draw(D, m, r, E, cam, prog) { for (let i = 0; i < m.F.length; i++) { LK.drawFolk(D.g, r, prog(), m.F[i], cam, D.time); LK.drawModel(D.g, r, prog(), 'wander_hlamp', m.L[i], m.F[i].yaw, cam, {}); } },
  };
  // a wishing well: you toss a coin (and find one)
  ACT.well = {
    start(D, m) { const s = D.spot(20, 0.45, 1); if (!s) return false; m.pos = s; m.yaw = rnd(m, 1) * TAU; return true; },
    update(D, m) { if (D.dist(m.pos) < 3) { if (!m.found && D.P) D.P.spark(m.pos[0], m.pos[1] + 0.9, m.pos[2], [0.6, 0.85, 1], 12, 1.2, 1); D.found(m); } if (D.dist(m.pos) > 90) return false; },
    draw(D, m, r, E, cam, prog) { LK.drawModel(D.g, r, prog(), 'wander_well', m.pos, m.yaw, cam, {}); },
  };

  // ================================================================ the models (our own; VR.VOXMODELS, built on first use)
  const M = VR.VOXMODELS, Grid = VR.VoxGrid;
  if (M && Grid) {
    const part = (sx, sy, sz, pv, fn) => { const gr = new Grid(sx, sy, sz, pv[0], pv[1], pv[2]); fn(gr); return { grid: gr, pivot: [0, 0, 0] }; };
    const one = (unit, radius, sx, sy, sz, pv, fn) => ({ unit, radius, parts: { body: part(sx, sy, sz, pv, fn) }, layout: { body: [0, 0, 0] } });
    // the Wegballon (1 voxel = 1/8 m, drawn ×2.6): a paper lantern balloon, warm stripes, its glowing mouth and flame
    M.wander_balloon = () => one(8, 1.4, 12, 15, 12, [6, 0, 6], (gr) => {
      for (let y = 2; y < 15; y++) for (let z = 0; z < 12; z++) for (let x = 0; x < 12; x++) {
        const yy = (y - 2) / 12, rad = 5.6 * Math.sqrt(Math.max(0, 1 - Math.pow((yy - 0.55) / 0.6, 2))) * (yy < 0.2 ? 0.75 + yy * 1.25 : 1);
        const d = Math.hypot(x + 0.5 - 6, z + 0.5 - 6); if (d > rad || d < rad - 1.4) continue;
        const band = Math.floor(((Math.atan2(z - 5.5, x - 5.5) + Math.PI) / TAU) * 8) & 1;
        gr.set(x, y, z, y === 3 ? 0xE8603A : band ? 0xFFE6B0 : 0xFFC878, 1);
      }
      gr.box(5, 0, 5, 6, 1, 6, 0xFFF2A0, { emis: 1 });
    });
    // a kite (1 voxel = 1/8 m): a diamond 1.4 m tall in four colours, a bow tail
    const KC = [[0xE8483A, 0xF6D24A], [0x3A7AD8, 0xF4F0E6], [0x5ABF6A, 0xF08A2A], [0xC070E0, 0x40C0C0]];
    KC.forEach((c, i) => {
      M['wander_kite' + i] = () => one(8, 1.6, 9, 22, 2, [4, 11, 1], (gr) => {
        for (let y = 0; y < 12; y++) for (let x = 0; x < 9; x++) { const w = y < 7 ? (y + 1) * 4 / 7 : (12 - y) * 4 / 5; if (Math.abs(x - 4) <= w) gr.set(x, y + 10, 0, (x < 4) === (y < 7) ? c[0] : c[1], 0); }
        for (let x = 0; x < 9; x++) gr.set(x, 16, 1, 0x6A4A2A); for (let y = 10; y < 22; y++) gr.set(4, y, 1, 0x6A4A2A);
        for (let k = 0; k < 10; k++) gr.set(4 + ((k >> 1) & 1 ? 1 : -1) * (k & 1), 9 - k, 0, k % 3 === 0 ? c[0] : 0xF4F0E6);
      });
    });
    // a picnic blanket (1 voxel = 1/8 m): red and white checks, a basket, bread, apples, a jug
    M.wander_blanket = () => one(8, 2, 22, 6, 18, [11, 0, 9], (gr) => {
      gr.box(0, 0, 0, 21, 0, 17, (x, y, z) => (((x >> 1) + (z >> 1)) & 1 ? 0xE8483A : 0xF4F0E6));
      gr.box(8, 1, 6, 12, 3, 9, (x, y, z) => ((x + y + z) & 1 ? 0xB0804A : 0x8A5A30)); gr.box(10, 4, 6, 10, 5, 9, 0x6A4422);
      gr.box(14, 1, 9, 16, 2, 10, 0xD8A050); gr.set(5, 1, 10, 0xE8302A); gr.set(6, 1, 11, 0x5ABF6A); gr.set(4, 1, 12, 0xE8302A);
      gr.box(15, 1, 4, 16, 3, 5, 0x5A8AC8); gr.set(9, 1, 12, 0xF6D24A); gr.set(10, 1, 13, 0xF6D24A);
    });
    // a cairn (1 voxel = 1/8 m): stones stacked smaller and smaller, moss at the foot
    M.wander_cairn = () => one(8, 1.2, 12, 14, 12, [6, 0, 6], (gr) => {
      const st = [[6, 1.2, 5.4, 1.4], [6, 3.4, 4.2, 1.2], [6, 5.4, 3.4, 1.1], [6, 7.2, 2.6, 1], [6, 8.9, 2, 0.9], [6, 10.4, 1.4, 0.8], [6, 11.8, 1, 0.7]];
      st.forEach(([c, y, r, ry], i) => gr.ell(c + (i & 1 ? 0.4 : -0.3), y, c + (i % 3 === 0 ? 0.3 : -0.2), r, ry, r * 0.9, (x, yy, z) => ((x + z + i) % 5 === 0 ? 0x7A7A72 : i & 1 ? 0x9A9890 : 0x8A8880), { shade: 0.1 }));
      for (let k = 0; k < 9; k++) gr.set(1 + (k * 5) % 10, 0, (k * 7) % 11, 0x5A8A3A);
    });
    // a tiny shrine (1 voxel = 1/8 m): a stone foot, two posts, a little roof, a glowing lantern, flowers
    M.wander_shrine = () => one(8, 1.4, 12, 18, 10, [6, 0, 5], (gr) => {
      gr.box(1, 0, 1, 10, 2, 8, 0x8A8880); gr.box(2, 3, 2, 9, 3, 7, 0x9A9890);
      gr.box(2, 4, 2, 2, 12, 2, 0x7A4E28); gr.box(9, 4, 2, 9, 12, 2, 0x7A4E28); gr.box(2, 4, 7, 2, 12, 7, 0x7A4E28); gr.box(9, 4, 7, 9, 12, 7, 0x7A4E28);
      for (let k = 0; k < 4; k++) gr.box(0 + k, 13 + k, 0, 11 - k, 13 + k, 9, k === 3 ? 0x8A2A2A : 0xB0402E);
      gr.box(5, 4, 4, 6, 4, 5, 0x5A4030); gr.box(5, 5, 4, 6, 7, 5, 0xFFC860, { emis: 1 }); gr.box(5, 8, 4, 6, 8, 5, 0x3A2A1E);
      for (const [x, z, c] of [[1, 9, 0xF08AB0], [3, 9, 0xFFF0A0], [8, 9, 0xC070E0], [10, 9, 0xF08AB0], [0, 4, 0xFFF0A0]]) { if (x < 12 && z < 10) { gr.set(x, 3, z, 0x4A8A3A); gr.set(x, 4, z, c); } }
    });
    // a broken arch (1 voxel = 1/4 m): two pillars of mossy stone, one fallen short, the arch's half; a fallen block
    M.wander_arch = () => one(4, 3, 18, 16, 6, [9, 0, 3], (gr) => {
      const stn = (x, y, z) => ((x * 7 + y * 3 + z * 5) % 9 === 0 ? 0x6A8A4A : (x + y + z) & 1 ? 0xA8A498 : 0x969286);
      gr.box(1, 0, 1, 4, 13, 4, stn); gr.box(13, 0, 1, 16, 7, 4, stn);
      for (let x = 4; x < 11; x++) { const y = 13 - Math.round(Math.pow((x - 4) / 7, 2) * 3); gr.box(x, y, 1, x, y + 2, 4, stn); }
      gr.box(9, 0, 0, 11, 1, 2, stn); gr.box(0, 0, 0, 5, 0, 5, 0x5A7A3A);
    });
    // a rune stone (1 voxel = 1/8 m): a standing stone with a carved glyph — lit, the glyph glows
    const rune = (lit) => () => one(8, 1, 6, 9, 4, [3, 0, 2], (gr) => {
      gr.ell(3, 4, 2, 2.8, 4.6, 1.8, (x, y, z) => ((x + y) % 4 === 0 ? 0x7A7870 : 0x8E8C84), { shade: 0.08 });
      for (const [x, y] of [[3, 2], [3, 3], [3, 4], [3, 5], [3, 6], [2, 5], [4, 3], [2, 3], [4, 6]]) gr.set(x, y, 0, lit ? 0x8AF0FF : 0x4A4A46, lit ? 1 : 0);
    });
    M.wander_rune = rune(false); M.wander_rune_lit = rune(true);
    // a treasure chest (1 voxel = 1/8 m): wood with golden bands, a little glow from inside
    M.wander_chest = () => one(8, 0.8, 8, 7, 6, [4, 0, 3], (gr) => {
      gr.box(0, 0, 0, 7, 4, 5, (x, y, z) => (x === 0 || x === 7 || x === 3 ? 0xE8B830 : (y + z) & 1 ? 0x8A5A30 : 0x7A4E28));
      gr.box(0, 5, 0, 7, 6, 5, (x) => (x === 0 || x === 7 || x === 3 ? 0xE8B830 : 0x9A6A3A)); gr.set(3, 4, 0, 0xFFE070, 1); gr.box(1, 5, 0, 6, 5, 0, 0xFFE8A0, { emis: 1 });
    });
    // a map scrap (1 voxel = 1/16 m): torn parchment with a dotted way and a red X
    M.wander_scrap = () => one(16, 0.4, 8, 1, 7, [4, 0, 3], (gr) => {
      gr.box(0, 0, 0, 7, 0, 6, (x, y, z) => ((x === 0 && z > 4) || (x === 7 && z < 1) ? 0 : 0xE8D8A8));
      for (const [x, z] of [[1, 1], [2, 2], [3, 2], [4, 3]]) gr.set(x, 0, z, 0x8A6A3A); gr.set(5, 0, 4, 0xC8302A); gr.set(6, 0, 5, 0xC8302A); gr.set(6, 0, 3, 0xC8302A); gr.set(4, 0, 5, 0xC8302A);
    });
    // a signpost (1 voxel = 1/8 m): a post with three arrow boards pointing different ways, a little roof
    M.wander_sign = () => one(8, 1.6, 20, 20, 20, [10, 0, 10], (gr) => {
      gr.box(9, 0, 9, 10, 17, 10, 0x7A4E28);
      gr.box(10, 14, 9, 18, 15, 10, 0xC8A060); gr.set(19, 14, 9, 0xC8A060); gr.set(19, 15, 10, 0xC8A060);
      gr.box(9, 11, 1, 10, 12, 9, 0xB89050); gr.set(9, 11, 0, 0xB89050);
      gr.box(1, 8, 10, 9, 9, 11, 0xC8A060); gr.set(0, 8, 10, 0xC8A060);
      gr.box(8, 18, 8, 11, 18, 11, 0x8A2A2A); gr.box(9, 19, 9, 10, 19, 10, 0x8A2A2A);
      for (const [x, y, z] of [[12, 14, 8], [14, 14, 8], [16, 14, 8], [8, 11, 3], [8, 11, 5], [3, 8, 12], [5, 8, 12]]) gr.set(x, y, z, 0x3A2A1E);
    });
    // a telescope on a tripod (1 voxel = 1/16 m): brass tube pointing up
    M.wander_scope = () => one(16, 1, 12, 26, 12, [6, 0, 6], (gr) => {
      for (let y = 0; y < 16; y++) { const k = Math.round((16 - y) * 0.3); gr.set(6 - k, y, 6 - k, 0x5A3A20); gr.set(6 + k, y, 6 - k, 0x5A3A20); gr.set(6, y, 6 + k, 0x5A3A20); }
      for (let i = 0; i < 12; i++) { const y = 15 + Math.round(i * 0.8), z = 6 - i * 0.45; gr.box(5, y, Math.round(z), 6, y + 1, Math.round(z), i > 9 ? 0xA07020 : 0xD8A840); }
    });
    // a hand lantern (1 voxel = 1/16 m): a little paper lantern glowing on a stick
    M.wander_hlamp = () => one(16, 0.3, 5, 9, 5, [2, 0, 2], (gr) => { gr.ell(2, 3, 2, 2.2, 2.6, 2.2, (x, y) => (y === 1 || y === 5 ? 0xE8603A : 0xFFC878), { emis: 1 }); gr.box(2, 6, 2, 2, 8, 2, 0x6A4A2A); });
    // a fairy ring (1 voxel = 1/8 m): mushrooms in a ring 2.4 m wide among flowers, clover
    M.wander_glade = () => one(8, 3, 40, 3, 40, [20, 0, 20], (gr) => {
      const FL = [0xF08AB0, 0xFFF0A0, 0xC070E0, 0xF4F4F0, 0x7AA0F0];
      for (let k = 0; k < 14; k++) { const a = k / 14 * TAU, x = Math.round(20 + Math.cos(a) * 10), z = Math.round(20 + Math.sin(a) * 10); gr.box(x, 0, z, x, 0, z, 0xF0E8D8); gr.box(x - 1, 1, z - 1, x + 1, 1, z + 1, k % 3 ? 0xD8402A : 0xC8A070); gr.set(x, 1, z, 0xF4F0E6); }
      for (let k = 0; k < 70; k++) { const a = h(k, 3, 9) * TAU, rr = 4 + h(k, 4, 9) * 15, x = Math.round(20 + Math.cos(a) * rr), z = Math.round(20 + Math.sin(a) * rr); if (x < 0 || z < 0 || x > 39 || z > 39) continue; gr.set(x, 0, z, 0x4A8A3A); gr.set(x, 1, z, FL[k % 5]); }
    });
    // a wishing well (1 voxel = 1/8 m): a stone ring, water, a little roof on two posts, a bucket
    M.wander_well = () => one(8, 1.4, 14, 20, 14, [7, 0, 7], (gr) => {
      for (let y = 0; y < 5; y++) for (let z = 0; z < 14; z++) for (let x = 0; x < 14; x++) { const d = Math.hypot(x - 6.5, z - 6.5); if (d <= 6.4 && d > 4.6) gr.set(x, y, z, (x + y + z) & 1 ? 0x9A9890 : 0x8A8880); else if (d <= 4.6 && y === 2) gr.set(x, y, z, 0x3A7AD8, 0); }
      gr.box(1, 5, 6, 1, 15, 7, 0x7A4E28); gr.box(12, 5, 6, 12, 15, 7, 0x7A4E28); gr.box(1, 13, 6, 12, 13, 7, 0x6A4422);
      for (let k = 0; k < 3; k++) gr.box(0 + k, 16 + k, 2 + k, 13 - k, 16 + k, 11 - k, 0xB0402E);
      gr.box(6, 9, 6, 7, 11, 7, 0x8A5A30);
    });
  }

  // ================================================================ the Wanderbuch's page
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  W.html = function (meta, totals) {
    const P = W.progress(meta, totals), B = W.book(meta) || {};
    const bar = (p) => `<div class="wdbar"><i style="width:${Math.round(Math.min(1, P[p].f) * 100)}%"></i></div>`;
    let h0 = '';
    for (const p of W.PAGES) {
      const ids = Object.keys(B[p] || {});
      let list = '';
      if (p === 'stickers') list = W.NAMES.map(n => `<span class="wdst${B.stickers && B.stickers[n] ? ' on' : ''}" title="${esc(B.stickers && B.stickers[n] ? T('g.wd.k.' + n) : '?')}">${B.stickers && B.stickers[n] ? W.KINDS[n].ico : '·'}</span>`).join('');
      else if (p === 'recipes') list = ids.map(r => `<span class="chip">${esc(T('g.wd.r.' + r))}</span>`).join(' ');
      else if (p === 'creatures') list = ids.map(c => `<span class="chip">${esc(T('g.wd.cr.' + c))}</span>`).join(' ');
      else list = ids.slice(-14).map(id => `<span class="chip">${esc(typeof B[p][id] === 'string' ? B[p][id] : id)}</span>`).join(' ');
      h0 += `<div class="wdsec"><h3>${esc(T('g.wd.p.' + p))} <span class="note">${P[p].n}</span></h3>${bar(p)}<div class="wdl">${list || `<span class="note">${esc(T('g.wd.none'))}</span>`}</div></div>`;
    }
    return h0;
  };
  function bookEl() {
    let s = document.getElementById('wanderbuch');
    if (!s) {
      s = document.createElement('div'); s.id = 'wanderbuch'; s.className = 'screen';
      const p = document.createElement('div'); p.className = 'panel box wdcard'; s.appendChild(p);
      (document.getElementById('ui') || document.body).appendChild(s);
      const st = document.createElement('style');
      st.textContent = '#wanderbuch .wdcard{max-width:620px;max-height:84vh;overflow:auto;background:rgba(40,28,18,.92);color:#fff2dc;border:1px solid rgba(255,209,140,.45);border-radius:16px}' +
        '#wanderbuch h2{margin:0 0 6px;font-size:22px}#wanderbuch h3{margin:12px 0 4px;font-size:15px;color:#ffd79a}#wanderbuch .wdbar{height:6px;border-radius:3px;background:rgba(255,255,255,.12);overflow:hidden}' +
        '#wanderbuch .wdbar i{display:block;height:100%;background:linear-gradient(90deg,#ffb86a,#ffe2a0)}#wanderbuch .wdl{margin-top:6px;line-height:1.9}#wanderbuch .chip{display:inline-block;padding:1px 8px;border-radius:9px;background:rgba(255,226,160,.14);margin:0 3px 3px 0;font-size:13px}' +
        '#wanderbuch .wdst{display:inline-block;width:30px;height:30px;line-height:30px;text-align:center;border-radius:8px;margin:2px;background:rgba(255,255,255,.06);font-size:18px;opacity:.45}#wanderbuch .wdst.on{opacity:1;background:rgba(255,200,120,.22)}' +
        '#wanderbuch .wdhead{display:flex;justify-content:space-between;align-items:center}#wanderbuch .note{opacity:.75;font-size:13px}';
      document.head.appendChild(st);
    }
    return s;
  }
  W.open = function (g) {
    if (!hasDoc || !g || !g.ui) return false;
    const s = bookEl(), p = s.querySelector('.panel'), D = g.wanderer;
    const nx = D && D.next ? `<div class="note">🏮 ${esc(T('g.wd.next', { place: D.next.name }))}</div>` : '';
    p.innerHTML = `<div class="wdhead"><h2>📖 ${esc(T('g.wd.book'))}</h2><button type="button" class="btn small" data-wd="close">${esc(T('g.wd.close'))}</button></div><div class="note">${esc(T('g.wd.bookNote'))}</div>${nx}` + W.html(g.meta, D ? { places: Math.max(W.SOFT.places, D.places.length) } : null);
    const b = p.querySelector('[data-wd="close"]'); if (b) b.onclick = () => W.close(g);
    g.ui.show('wanderbuch');
    return true;
  };
  W.close = function (g) { if (g && g.ui && g.ui.screen === 'wanderbuch') g.ui.show('hud'); };

  // ================================================================ the hooks (additive)
  const LD = VR.LifeDirector;
  if (LD && LD.Actor && !LD.Actor.prototype.__wander) {
    const AP = LD.Actor.prototype; AP.__wander = true;
    const up = AP.update, dr = AP.draw, de = AP.destroy;
    // the life director runs on every world (it stays quiet off Herzwelt); the Wanderregisseur rides along
    AP.update = function (dt) {
      const r = up.apply(this, arguments);
      try {
        const g = this.g, key = (g.meta && g.meta.id) + ':' + g.dim;
        if (!g.wanderer || g.wanderer._key !== key) { if (g.wanderer) g.wanderer.destroy(); g.wanderer = new W.Actor(g); g.wanderer._key = key; }
        g.wanderer.update(dt);
      } catch (e) { if (!W.warned) { W.warned = true; console.warn('wander', e); } }
      return r;
    };
    AP.draw = function (r, E, layer, cam) { const out = dr.apply(this, arguments); const D = this.g.wanderer; if (D) { try { D.draw(r, E, layer, cam); } catch (e) { /* drawn next frame */ } } return out; };
    AP.destroy = function () { const D = this.g && this.g.wanderer; if (D) { D.destroy(); this.g.wanderer = null; } return de.apply(this, arguments); };
  }
  // J outside Abenteuer: the Wanderbuch (in Abenteuer the journal, with the Wanderbuch's section)
  const F2 = VR.First2;
  if (F2 && F2.keyNote && !F2.keyNote.__wd) {
    const kn = F2.keyNote;
    F2.keyNote = function (g, code) { if (code === 'KeyJ' && g && g.state === 'play' && g.ui && !g.ui.screen && !(VR.Adventure && VR.Adventure.on && VR.Adventure.on())) return W.open(g); return kn.apply(this, arguments); };
    F2.keyNote.__wd = true;
  }
  if (hasDoc && typeof window !== 'undefined' && window.addEventListener) window.addEventListener('keydown', (e) => {
    const g = VR.game; if (!g || !g.ui || g.ui.screen !== 'wanderbuch') return;
    if (e.key === 'Escape' || e.code === 'KeyJ') { e.preventDefault(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); W.close(g); }
  }, true);
  if (VR.Quests && Array.isArray(VR.Quests.journalSections)) VR.Quests.journalSections.push(() => {
    const g = VR.game; if (!g || !g.meta) return '';
    return '<div class="jsec wdj"><h3>📖 ' + esc(T('g.wd.book')) + '</h3>' + W.html(g.meta) + '</div>';
  });
})(VR);
