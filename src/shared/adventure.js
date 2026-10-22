// ============================================================================
// Das Abenteuer — its rules (a-core; spec docs/superpowers/specs/2026-10-22-abenteuer-design.md §2–§4, §12, §15;
// plan docs/superpowers/plans/2026-10-22-a-core.md). Pure: no DOM, no text, no clock of its own (every call takes `now`
// in milliseconds), so the host, a guest and node agree. VR.Adventure (src/main/adventure.js) is the game's glue.
//   the curve      need(L) = 60 + 30·L XP from level L to L+1; level 50 is the cap, beyond it a ⭐ every 2,000 XP
//   the awards     the table of A§2 (AWARDS) with its limits; award(me, kind, ctx, now, sess) → what it gave
//   the guards     placed positions counted per session, ×0.5 for every five foes of a kind within ten minutes, nothing
//                  from a zone provoked again within two minutes; the limits' windows are saved (a reload resets none)
//   the stats      five, 0–10 each, one point per level, a free respec (the game allows it at home), their effects
//   the Sterntaler the wallet (earned in the world — never real money), the prices of A§4, the upgrades' effects
//   Spannung       s ∈ [0, 1] kept in the band (A§12), after each encounter and two faints
//   the save       meta.adventure = { v: 1, on, band, enc, since, tension, freed, bosses, chapter, beats, prevDiff, faints,
//                  me: { xp, level, stars, pts, taler, owned, quests, once, lim } } — load() makes anything sane
//   the chime      a level-up's notes in the day's pentatonic key (klang.js musicPlan)
// ============================================================================
(function (VR) {
  'use strict';
  const Adv = VR.Adv = {};
  const V = 1, CAP = 50, STAR = 2000, XP_MAX = 1e9, TALER_MAX = 999999, GIFT = 10, POS_MAX = 50000;
  Object.assign(Adv, { V, CAP, STAR, XP_MAX, TALER_MAX, GIFT });
  const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const int = (v, a, b, d) => clamp(Math.floor(num(v, d)), a, b);
  const plain = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
  const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);

  // ---------------------------------------------------------------- the curve
  Adv.need = (L) => (L >= CAP ? STAR : 60 + 30 * Math.max(0, L | 0));
  // the XP from level 0 to level L: the sum of need(0 … L−1) = 15 L² + 45 L
  Adv.total = (L) => { const l = clamp(L | 0, 0, CAP); return 15 * l * l + 45 * l; };
  // {level, into (XP into it), need (XP of it), frac, stars}
  Adv.levelOf = (xp) => {
    const x = Math.max(0, num(xp, 0));
    let L = clamp(Math.floor((-45 + Math.sqrt(2025 + 60 * x)) / 30), 0, CAP);
    while (L < CAP && Adv.total(L + 1) <= x) L++;
    while (L > 0 && Adv.total(L) > x) L--;
    if (L >= CAP) { const over = x - Adv.total(CAP), stars = Math.floor(over / STAR), into = over - stars * STAR; return { level: CAP, into, need: STAR, frac: into / STAR, stars }; }
    const need = Adv.need(L), into = x - Adv.total(L);
    return { level: L, into, need, frac: into / need, stars: 0 };
  };

  // ---------------------------------------------------------------- the awards (A§2)
  // xp / taler: a number · {S, M, L} by ctx.size · [lo, hi] (ctx.xp / ctx.taler held to it); once: true (one ever) or
  // 'id' (one per ctx.id); per: units for one step of xp (place: new positions, distance: metres); lim: [n, seconds,
  // 'xp' | 'n'] — at most n XP (or n awards) in a window that starts with the first award after the last one ran out;
  // decay: [k, seconds] — ×0.5 for every k of a kind within the window (foes). milestone, creature and survival are
  // a-core's own rows: a codex milestone, a creature met, and the survival XP that gives nothing (A§0.3: the survival
  // XP comes from creatures and raids — no Abenteuer XP for harming anything)
  const AWARDS = Adv.AWARDS = {
    place: { xp: 1, per: 25, lim: [40, 600, 'xp'] },
    home: { xp: 60, once: 'id' },
    blueprint: { xp: 25, lim: [3, 3600, 'n'] },
    biome: { xp: 15, once: 'id' },
    wow: { xp: 20, once: 'id' },
    wonder: { xp: 80, once: 'id' },
    flight: { xp: 50, once: true },
    orbit: { xp: 100, once: true },
    landing: { xp: 150, taler: 100, once: 'id' },
    system: { xp: 200, taler: 150, once: 'id' },
    distance: { xp: 5, per: 1000, lim: [60, 600, 'xp'] },
    quest: { xp: { S: 20, M: 50, L: 120 }, taler: { S: 15, M: 40, L: 100 } },
    foe: { xp: [8, 30], decay: [5, 600] },
    freed: { xp: 250, taler: 300, once: 'id' },
    boss: { xp: 600, taler: 800, once: 'id' },
    beat: { xp: [30, 150], once: 'id' },
    photo: { xp: 10, lim: [5, 3600, 'n'] },
    invention: { xp: 10, once: 'id' },
    chest: { xp: 0, taler: [20, 150], once: 'id' },
    milestone: { xp: 10, once: 'id' },
    creature: { xp: 5, once: 'id' },
    survival: { xp: 0 },
  };
  // the foes of A§5 by their hearts (Bohrläufer 8, Wächter 12, Kranarm 10, Schattendrohne 3, Schattenwesen 4)
  Adv.FOE_XP = { driller: 16, sentry: 24, crane: 20, drone: 8, wisp: 10 };
  Adv.ZONE_AGAIN = 120000;
  // a placed position as one exact integer: x and z in 20 bits each (±524,288), the height in 12 (0 … 4,095)
  Adv.posKey = (x, y, z) => ((x & 0xFFFFF) * 4096 + (y & 0xFFF)) * 1048576 + (z & 0xFFFFF);
  // what a session counts (not saved): the positions placed, the part-steps of place and distance, the zones' provocations
  Adv.session = () => ({ pos: new Set(), acc: {}, zones: {} });
  const DEF_SESS = Adv.session();
  // a contested zone's foes appear: true when the zone was provoked again within two minutes (its foes give nothing)
  Adv.provoke = (sess, zone, now) => {
    const z = (sess || DEF_SESS).zones, prev = z[zone];
    const again = !!prev && now >= prev[0] && now - prev[0] < Adv.ZONE_AGAIN;
    z[zone] = [now, again];
    return again;
  };
  // the window [t0, used] of a limit: a fresh one when the last ran out (or the clock went back)
  const win = (me, key, sec, now) => {
    let w = me.lim[key];
    if (!Array.isArray(w) || now < w[0] || now - w[0] >= sec * 1000) w = me.lim[key] = [now, 0];
    return w;
  };
  const sizeOf = (spec, ctx) => (own(spec, ctx.size) ? ctx.size : 'S');
  const val = (spec, ctx, key) => {
    if (typeof spec === 'number') return spec;
    if (Array.isArray(spec)) return clamp(Math.round(num(ctx[key], spec[0])), spec[0], spec[1]);
    if (plain(spec)) return spec[sizeOf(spec, ctx)];
    return 0;
  };
  const EMPTY = {};
  // one award: {kind, xp, taler, level, up (levels gained), gift (Taler of the gift levels crossed), stars, starUp, why}
  // why: '' given · 'once' had it · 'limit' the window is full · 'same' a position placed before · 'acc' counted, not yet a
  // step · 'zone' a zone provoked again. null for an unknown kind
  Adv.award = function (me, kind, ctx, now, sess) {
    const A = own(AWARDS, kind) ? AWARDS[kind] : null; if (!A || !me) return null;
    const c = ctx || EMPTY, t = num(now, 0), S = sess || DEF_SESS;
    const r = { kind, xp: 0, taler: 0, level: me.level | 0, up: 0, gift: 0, stars: me.stars | 0, starUp: 0, why: '' };
    let key = null;
    if (A.once) { key = A.once === 'id' ? kind + ':' + (c.id === undefined ? '?' : c.id) : kind; if (me.once[key]) { r.why = 'once'; return r; } }
    let xp = 0, taler = 0;
    if (A.per) {
      let units = 1;
      if (kind === 'place') {
        const k = Adv.posKey(c.x, c.y, c.z);
        if (S.pos.has(k)) { r.why = 'same'; return r; }
        if (S.pos.size >= POS_MAX) S.pos.clear();
        S.pos.add(k);
      } else units = Math.max(0, num(c.m, 0));
      const a = (S.acc[kind] || 0) + units, steps = Math.floor(a / A.per);
      S.acc[kind] = a - steps * A.per;
      xp = steps * A.xp;
      if (!xp) { r.why = 'acc'; return r; }
    } else if (kind === 'foe') {
      const zn = c.zone !== undefined ? S.zones[c.zone] : null;
      if (zn && zn[1]) { r.why = 'zone'; return r; }
      const base = c.xp !== undefined ? val(A.xp, c, 'xp') : clamp(Adv.FOE_XP[c.kind] || A.xp[0], A.xp[0], A.xp[1]);
      const w = win(me, 'foe:' + (c.kind === undefined ? '?' : c.kind), A.decay[1], t);
      xp = Math.round(base * Math.pow(0.5, Math.floor(w[1] / A.decay[0])));
      w[1]++;
    } else {
      xp = val(A.xp, c, 'xp');
      if (A.taler !== undefined) taler = val(A.taler, c, 'taler');
    }
    if (A.lim && xp > 0) {
      const n = A.lim[0], w = win(me, kind, A.lim[1], t);
      if (A.lim[2] === 'xp') { xp = Math.min(xp, Math.max(0, n - w[1])); w[1] += xp; }
      else if (w[1] >= n) xp = 0; else w[1]++;
      if (!xp) { r.why = 'limit'; return r; }
    }
    if (xp <= 0 && taler <= 0) return r;
    if (key) me.once[key] = 1;
    r.xp = xp; r.taler = taler;
    if (xp > 0) gain(me, xp, r);
    if (r.taler + r.gift > 0) Adv.earn(me, r.taler + r.gift);
    return r;
  };
  // XP in: the level and the stars follow; every fifth level crossed is a gift of 10 × L Taler (L5 50 … L50 500)
  function gain(me, xp, r) {
    const L0 = me.level | 0, S0 = me.stars | 0;
    me.xp = Math.min(XP_MAX, num(me.xp, 0) + xp);
    const lv = Adv.levelOf(me.xp);
    me.level = lv.level; me.stars = lv.stars;
    r.level = me.level; r.stars = me.stars; r.up = Math.max(0, me.level - L0); r.starUp = Math.max(0, me.stars - S0);
    for (let l = L0 + 1; l <= me.level; l++) if (l % 5 === 0) r.gift += GIFT * l;
  }

  // ---------------------------------------------------------------- the five stats (A§3)
  const STATS = Adv.STATS = ['aus', 'ene', 'spu', 'ges', 'pil'];
  Adv.PT_MAX = 10;
  const ptsOf = (p) => { const o = {}; for (const k of STATS) o[k] = clamp(Math.floor(num(p && p[k], 0)), 0, Adv.PT_MAX); return o; };
  Adv.spent = (me) => { let s = 0; for (const k of STATS) s += me.pts[k] | 0; return s; };
  Adv.points = (me) => Math.max(0, Math.min(me.level | 0, CAP) - Adv.spent(me));
  Adv.addPoint = (me, k) => { if (STATS.indexOf(k) < 0 || Adv.points(me) <= 0 || (me.pts[k] | 0) >= Adv.PT_MAX) return false; me.pts[k] = (me.pts[k] | 0) + 1; return true; };
  Adv.respec = (me) => { const n = Adv.spent(me); for (const k of STATS) me.pts[k] = 0; return n; };
  // what the points do: ❤ +1 heart per 2 (20 → 30 HP) · ⚡ +8 % energy, +6 % boost bar · 🧭 scan 32 + 8 blocks, the hidden
  // chests at 5 · 🛠 +5 % mining and building, a hint at 5 and 10 · 🚀 +8 % boost time, +3 % turn rate
  Adv.effects = (p) => {
    const q = ptsOf(p), hp = 20 + 2 * Math.floor(q.aus / 2);
    return { hp, hearts: hp / 2, energy: 1 + 0.08 * q.ene, boost: 1 + 0.06 * q.ene, scan: 32 + 8 * q.spu, chests: q.spu >= 5, speed: 1 + 0.05 * q.ges, hints: (q.ges >= 5 ? 1 : 0) + (q.ges >= 10 ? 1 : 0), boostTime: 1 + 0.08 * q.pil, turn: 1 + 0.03 * q.pil };
  };

  // ---------------------------------------------------------------- the Sterntaler (A§4): earned in the world only
  Adv.earn = (me, n) => { const k = Math.floor(num(n, 0)); if (k <= 0) return 0; const b = me.taler | 0; me.taler = Math.min(TALER_MAX, b + k); return me.taler - b; };
  Adv.pay = (me, n) => { const k = Math.floor(num(n, 0)); if (k <= 0 || (me.taler | 0) < k) return false; me.taler -= k; return true; };
  Adv.PRICES = { engine: [600, 1500, 3500], shield: [500, 1200, 3000], jump: [1000, 2500, 5000], suitHeat: [800], suitCold: [600], suitPressure: [600], suitRad: [1200], boots: [400], anchor: [300], scanner: [400], repair: [900], camera: [200] };
  Adv.BLUEPRINT = [50, 400];
  Adv.bpPrice = (n) => clamp(Math.round(num(n, 50)), Adv.BLUEPRINT[0], Adv.BLUEPRINT[1]);
  Adv.price = (me, item) => { if (!own(Adv.PRICES, item)) return null; const P = Adv.PRICES[item], s = me.owned[item] | 0; return s < P.length ? P[s] : null; };
  Adv.buy = (me, item) => {
    if (!own(Adv.PRICES, item)) return { ok: false, why: 'unknown' };
    const P = Adv.PRICES[item], s = me.owned[item] | 0;
    if (s >= P.length) return { ok: false, why: 'max', step: s };
    if (!Adv.pay(me, P[s])) return { ok: false, why: 'poor', price: P[s], step: s };
    me.owned[item] = s + 1;
    return { ok: true, price: P[s], step: s + 1 };
  };
  // the upgrades in the Abenteuer: cruise +15 % a step · the ship disabled 10 → 8 → 6 → 3 s when hit (A§4's „10 → 6 → 3"
  // over its three steps) · jump range 30 → 60 ly · a suit module stops its hazard costing hearts · boots, Funke's modules
  Adv.SHIELD_SEC = [10, 8, 6, 3]; Adv.JUMP_LY = [30, 40, 50, 60];
  Adv.upgrade = (me) => {
    const o = (me && me.owned) || {}, st = (k) => clamp(o[k] | 0, 0, Adv.PRICES[k].length);
    return { cruise: 1 + 0.15 * st('engine'), shieldSec: Adv.SHIELD_SEC[st('shield')], jumpLy: Adv.JUMP_LY[st('jump')], suit: { heat: st('suitHeat') > 0, cold: st('suitCold') > 0, pressure: st('suitPressure') > 0, rad: st('suitRad') > 0 }, jumpBoost: 1 + 0.25 * st('boots'), anchor: st('anchor') > 0, scanner: st('scanner') > 0, repair: st('repair') > 0, camera: st('camera') > 0 };
  };
  // selling at a freed outpost's trading post: iron 2, gold 6, crystal 8, ice core 5, asteroid metal 12 each
  Adv.SELL = { iron_ingot: 2, gold_ingot: 6, crystal: 8, ice_core: 5, asteroid_metal: 12 };
  Adv.sellPrice = (id) => { const s = String(id || ''); if (own(Adv.SELL, s)) return Adv.SELL[s]; return /^crystal_shard_/.test(s) ? Adv.SELL.crystal : 0; };

  // ---------------------------------------------------------------- Spannung (A§12)
  const BANDS = Adv.BANDS = { easy: [0.1, 0.5], normal: [0.3, 0.7], hard: [0.5, 0.9] };
  Adv.BAND_ORDER = ['easy', 'normal', 'hard'];
  const ENC = Adv.ENC = ['normal', 'rare', 'off'];
  Adv.TENSION0 = 0.4; Adv.FAINT_WIN = 600000;
  Adv.clampBand = (s, band) => { const b = own(BANDS, band) ? BANDS[band] : BANDS.normal; return clamp(num(s, Adv.TENSION0), b[0], b[1]); };
  Adv.setBand = (rec, band) => { if (!own(BANDS, band)) return false; rec.band = band; rec.tension = Adv.clampBand(rec.tension, band); return true; };
  // after an encounter: p = 1 − min(1, hearts lost / max hearts) · min(1.5, duration / expected); s ← s + 0.15 (p − 0.6)
  Adv.encounter = (rec, o) => {
    const lost = Math.max(0, num(o && o.lost, 0)), max = Math.max(1, num(o && o.max, 20)), dur = Math.max(0, num(o && o.dur, 0)), exp = Math.max(1e-3, num(o && o.expected, 40));
    const p = 1 - Math.min(1, lost / max) * Math.min(1.5, dur / exp);
    rec.tension = Adv.clampBand(rec.tension + 0.15 * (p - 0.6), rec.band);
    return { p, s: rec.tension };
  };
  // a faint (Ohnmacht): two within ten minutes take 0.2 off and offer a band down — the player says yes (easier), never
  // the game silently
  Adv.faint = (rec, now) => {
    const f = (Array.isArray(rec.faints) ? rec.faints : []).filter(t => now >= t && now - t < Adv.FAINT_WIN);
    f.push(now); rec.faints = f;
    if (f.length < 2) return { s: rec.tension, offer: false };
    rec.faints = []; rec.tension = Adv.clampBand(rec.tension - 0.2, rec.band);
    return { s: rec.tension, offer: rec.band !== 'easy' };
  };
  Adv.easier = (rec) => { const i = Adv.BAND_ORDER.indexOf(rec.band); if (i <= 0) return null; const b = Adv.BAND_ORDER[i - 1]; Adv.setBand(rec, b); return b; };
  Adv.scale = (s) => 0.6 + 0.8 * clamp(num(s, Adv.TENSION0), 0, 1);
  Adv.hints = (s) => (s <= 0.2 ? 3 : s <= 0.35 ? 2 : s <= 0.5 ? 1 : 0);
  // the encounters in effect: a child-safe game (Kindersicher) never meets a foe
  Adv.encOf = (rec, kids) => (kids ? 'off' : rec && ENC.indexOf(rec.enc) >= 0 ? rec.enc : 'normal');

  // ---------------------------------------------------------------- the save (A§15)
  const DIFFS = ['peaceful', 'easy', 'normal', 'hard'];
  Adv.fresh = (o) => {
    const r = { v: V, on: false, band: 'normal', enc: 'normal', since: 0, tension: Adv.TENSION0, freed: {}, bosses: {}, chapter: 0, beats: {}, prevDiff: null, faints: [],
      me: { xp: 0, level: 0, stars: 0, pts: { aus: 0, ene: 0, spu: 0, ges: 0, pil: 0 }, taler: 0, owned: {}, quests: {}, once: {}, lim: {} } };
    if (o) { if (o.on !== undefined) r.on = !!o.on; if (own(BANDS, o.band)) r.band = o.band; if (ENC.indexOf(o.enc) >= 0) r.enc = o.enc; if (o.since !== undefined) r.since = int(o.since, 0, 1e7, 0); }
    r.tension = Adv.clampBand(r.tension, r.band);
    return r;
  };
  // any record → a sane one (v 1 is the first version: a later one migrates here, field by field). Numbers finite and
  // bounded, the level from the XP, never more points than levels (else all given back to spend again), owned steps
  // within the price table, unknown items dropped, the other parts' records (freed, bosses, beats, quests) kept as they are
  Adv.load = function (raw) {
    const r = Adv.fresh();
    if (!plain(raw)) return r;
    r.on = raw.on === true;
    if (own(BANDS, raw.band)) r.band = raw.band;
    if (ENC.indexOf(raw.enc) >= 0) r.enc = raw.enc;
    r.since = int(raw.since, 0, 1e7, 0);
    r.tension = Adv.clampBand(num(raw.tension, Adv.TENSION0), r.band);
    if (plain(raw.freed)) r.freed = raw.freed;
    if (plain(raw.bosses)) r.bosses = raw.bosses;
    r.chapter = int(raw.chapter, 0, 99, 0);
    if (plain(raw.beats)) r.beats = raw.beats;
    if (plain(raw.sites)) r.sites = raw.sites; if (plain(raw.foeSaid)) r.foeSaid = raw.foeSaid; if (plain(raw.helper)) r.helper = raw.helper;   // a-foes: the outposts' progress, Funke's once-words, the Helfer (each sanitised where it is read: liberate.js L.load, foes.js)
    r.prevDiff = DIFFS.indexOf(raw.prevDiff) >= 0 ? raw.prevDiff : null;
    r.faints = Array.isArray(raw.faints) ? raw.faints.filter(t => typeof t === 'number' && Number.isFinite(t)).slice(-4) : [];
    const m = plain(raw.me) ? raw.me : {}, me = r.me;
    me.xp = clamp(Math.floor(num(m.xp, 0)), 0, XP_MAX);
    const lv = Adv.levelOf(me.xp); me.level = lv.level; me.stars = lv.stars;
    me.pts = ptsOf(m.pts); if (Adv.spent(me) > me.level) for (const k of STATS) me.pts[k] = 0;
    me.taler = clamp(Math.floor(num(m.taler, 0)), 0, TALER_MAX);
    if (plain(m.owned)) for (const k in m.owned) if (own(Adv.PRICES, k)) { const s = int(m.owned[k], 0, Adv.PRICES[k].length, 0); if (s) me.owned[k] = s; }
    if (plain(m.quests)) me.quests = m.quests;
    if (plain(m.once)) for (const k in m.once) if (m.once[k]) me.once[k] = 1;
    if (plain(m.lim)) for (const k in m.lim) { const w = m.lim[k]; if (Array.isArray(w) && w.length === 2 && Number.isFinite(w[0]) && Number.isFinite(w[1])) me.lim[k] = [w[0], Math.max(0, w[1])]; }
    return r;
  };

  // ---------------------------------------------------------------- the level-up chime
  // six bells up the day's pentatonic scale 70 ms apart (the start degree climbs with the level), then the chord and
  // the octave held; a gift level (5, 10, …) adds a sparkle. degMidi: klang.js's (the same table is here for node and
  // the worker). Notes {midi, kind: 'bell' | 'pad', t, dur, gain}
  Adv.chime = function (plan, level, degMidi) {
    const dm = typeof degMidi === 'function' ? degMidi : (p, d) => { const s = p.scale, k = ((d % 5) + 5) % 5; return p.root + s[k] + 12 * Math.floor(d / 5); };
    const L = Math.max(0, level | 0), c0 = L % 5, up = plan.root > 62 ? 0 : 12, out = [], step = 0.07, top = 6 * step;
    for (let i = 0; i < 6; i++) out.push({ midi: dm(plan, c0 + i) + up, kind: 'bell', t: i * step, dur: 0.8, gain: 0.04 + 0.008 * i });
    for (const d of [c0 + 5, c0 + 7, c0 + 9]) out.push({ midi: dm(plan, d) + up - 12, kind: 'pad', t: top, dur: 1.4, gain: 0.03 });
    out.push({ midi: dm(plan, c0 + 10) + up, kind: 'bell', t: top, dur: 1.5, gain: 0.07 });
    if (L % 5 === 0) for (let i = 0; i < 4; i++) out.push({ midi: dm(plan, c0 + 11 + i) + up, kind: 'bell', t: top + 0.2 + i * 0.06, dur: 0.6, gain: 0.025 });
    return out;
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
