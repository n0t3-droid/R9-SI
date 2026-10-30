// ============================================================================
// Der Weg des Abenteurers — the RPG player's loop, its rules (a-rpg; plan docs/superpowers/plans/2026-10-30-a-rpg.md).
// Pure: no DOM, no text, no clock of its own. VR.RPG (this file) is read by src/main/rpg.js (the character screen, the
// gear, the conquest map, the loot burst) and src/main/rpg_boss.js (Der Turmgänger, the first boss). On top of a-core's
// VR.Adv (levels, the five stats, the Heliataler), never instead of it:
//   BAL        every number of the loop in one table (test/rpg.js checks the time-to-level curve and the income against
//              the shop's prices)
//   gear       four slots (Werkzeug, Helm, Anzug, Stiefel), five rarities, a base value by slot and 0–3 perks by rarity:
//              Kraft (the pulse's strength), Schutz (less harm from machines), Glück (more Heliataler), Ruhe (a wider calm
//              arc), Abbau (faster mining). Rolled from a seed (the same outpost, the same find). Salvaged for Taler
//   conquest   the world in regions of 1024 blocks; a region's outposts freed → its share, a daily tribute (Tagesbonus)
//              at the freed beacons, the Kernfeuer's boss once two are freed; the world's percentage
//   boss       Der Turmgänger: three phases (stomping legs · a shield with drones · overload), every attack telegraphed
//              ≥ 0.6 s, weak points open after each attack; the calm version (Begegnungen aus, Kindersicher) is three
//              calm rings a phase — always solvable
//   save       meta.adventure.rpg = { v: 1, eq: {tool, head, body, feet}, bag: [], n, tri, healed: {}, won: {}, seen: {} }
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.RPG = {};
  const V = 1;
  const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const plain = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
  const own = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);

  // ---------------------------------------------------------------- the balance table (one place for every number)
  const BAL = R.BAL = {
    // rarities: weight of a find by source (plain … radiant), the value's factor, the perks, the salvage in Taler
    RAR: ['plain', 'sturdy', 'rare', 'splendid', 'radiant'],
    rarCol: ['#c9ced6', '#7bdc6a', '#4fa8ff', '#c08cff', '#ffc64a'],
    rarMul: [1, 1.3, 1.65, 2.05, 2.6],
    rarPerks: [0, 1, 1, 2, 3],
    salvage: [12, 30, 70, 160, 400],
    drop: { chest: [58, 30, 10, 2, 0], outpost: [12, 40, 32, 13, 3], boss: [0, 0, 0, 60, 40] },
    luckShift: 0.5,            // Glück moves this share of a percent point per Glück % from plain toward the rarer
    // the slots and their base value (k: perk, a: at level 0 for a plain one, per: + per level)
    SLOTS: ['tool', 'head', 'body', 'feet'],
    base: { tool: { k: 'kraft', a: 6, per: 0.3 }, head: { k: 'ruhe', a: 6, per: 0.2 }, body: { k: 'schutz', a: 5, per: 0.15 }, feet: { k: 'glueck', a: 5, per: 0.2 } },
    variants: { tool: ['pulsglove', 'sparkrod', 'lightcaster'], head: ['scouthelm', 'sunvisor', 'lanternhood'], body: ['roversuit', 'platevest', 'weavecoat'], feet: ['springboots', 'glideboots', 'trailboots'] },
    PERKS: ['kraft', 'schutz', 'glueck', 'ruhe', 'abbau'],
    perkRange: { kraft: [4, 9], schutz: [3, 7], glueck: [4, 10], ruhe: [4, 9], abbau: [5, 12] },
    cap: { kraft: 80, schutz: 45, glueck: 60, ruhe: 40, abbau: 50 },
    BAG: 12,
    // the conquest
    REGION: 1024, bossUnlock: 2,
    tribute: { 3: 10, 4: 15, 5: 20 }, tributeDays: 3, tributeGap: 600000, fullBonus: 1.5, healedBonus: 2,
    // Der Turmgänger (Normal; Leicht ×0.7, Schwer ×1.3 on the hit points)
    boss: {
      hp: [500, 550, 650], band: { easy: 0.7, normal: 1, hard: 1.3 },
      weak: 2, body: 0.35, shieldK: 0,
      tele: { stomp: 1.0, fan: 0.8, slam: 0.9 }, strike: { stomp: 0.35, fan: 0.4, slam: 0.4 }, recover: { stomp: 2.4, fan: 1.8, slam: 2.2 },
      cool: [[1.6, 2.6], [1.4, 2.2], [0.9, 1.6]], dmg: { stomp: 3, fan: 2, slam: 3 }, stompR: 6, slamR: 9, near: 8,
      adds: [0, 3, 2], shieldMax: { easy: 18, normal: 26, hard: 34 }, stagger: 3, intro: 3, down: 4.5,
      calmPhase: 3, reward: { xp: 600, taler: 800 },
    },
    // Anfängerglück: the first levels come quicker (×2 below level 5, ×1.5 below 10) — a-core's curve stays as it is
    boost: [[5, 2], [10, 1.5]],
    // an adventurer's hour (the curve test): what an active player meets in the first hours
    hour: { foes: 24, quests: { S: 3, M: 1.5, L: 0.3 }, freed: 1.2, chests: 3, biome: 2, wow: 1.5, distanceKm: 3, place: 40, photo: 2 },
    opening: { biome: 2, creature: 4, milestone: 3 },   // the first ten minutes' first finds
  };
  R.boostOf = (level) => { for (const [L, k] of BAL.boost) if ((level | 0) < L) return k; return 1; };
  // Anfängerglück on an award's result r (VR.Adv.award's): the extra XP into me, r's xp, level, up and gift follow
  R.boost = function (Adv, me, r) {
    if (!Adv || !me || !r || !(r.xp > 0)) return 0;
    const L0 = (r.level | 0) - (r.up | 0), k = R.boostOf(L0), extra = Math.round(r.xp * (k - 1));
    if (extra <= 0) return 0;
    const before = me.level | 0;
    me.xp = Math.min(Adv.XP_MAX, num(me.xp, 0) + extra);
    const lv = Adv.levelOf(me.xp); me.level = lv.level; me.stars = lv.stars;
    let gift = 0; for (let l = before + 1; l <= me.level; l++) if (l % 5 === 0) gift += Adv.GIFT * l;
    if (gift) Adv.earn(me, gift);
    r.xp += extra; r.level = me.level; r.stars = me.stars; r.up = Math.max(0, me.level - L0); r.gift = (r.gift | 0) + gift; r.boost = extra;
    return extra;
  };

  // ---------------------------------------------------------------- a seeded random (FNV-1a → xorshift)
  R.rng = function (seed) {
    let h = 2166136261 >>> 0; const s = String(seed);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    let x = h || 1;
    return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
  };
  const pickW = (w, u) => { let s = 0; for (const v of w) s += v; let a = u * s; for (let i = 0; i < w.length; i++) { a -= w[i]; if (a < 0) return i; } return w.length - 1; };

  // ---------------------------------------------------------------- gear
  // the weights of a source moved by Glück (percent): the plain share goes to the rarer ones, evenly
  R.weights = function (src, luck) {
    const w = (BAL.drop[src] || BAL.drop.chest).slice(), mv = Math.min(w[0], Math.max(0, num(luck, 0)) * BAL.luckShift);
    w[0] -= mv; let n = 0; for (let i = 1; i < w.length; i++) if (w[i] > 0 || i < 4) n++;
    for (let i = 1; i < w.length; i++) if (w[i] > 0 || i < 4) w[i] += mv / n;
    return w;
  };
  R.baseVal = (slot, r, lv) => { const B = BAL.base[slot]; return Math.round((B.a + B.per * clamp(lv | 0, 0, 50)) * BAL.rarMul[r]); };
  // one find: {id, s, r, v, lv, p: [[perk, value], …]} — p[0] is the slot's base
  R.roll = function (seed, src, level, luck, slot) {
    const rnd = R.rng('gear:' + seed), lv = clamp(num(level, 0) | 0, 0, 50);
    const r = pickW(R.weights(src, luck), rnd());
    const s = BAL.SLOTS.indexOf(slot) >= 0 ? slot : BAL.SLOTS[Math.floor(rnd() * 4) % 4];
    const v = Math.floor(rnd() * 3) % 3;
    const p = [[BAL.base[s].k, R.baseVal(s, r, lv)]];
    const pool = BAL.PERKS.filter(k => k !== BAL.base[s].k);
    for (let i = 0; i < BAL.rarPerks[r] && pool.length; i++) {
      const k = pool.splice(Math.floor(rnd() * pool.length) % pool.length, 1)[0], rg = BAL.perkRange[k];
      p.push([k, Math.round((rg[0] + rnd() * (rg[1] - rg[0])) * (1 + lv / 50))]);
    }
    return { id: String(seed).slice(0, 48), s, r, v, lv, p };
  };
  // the item's worth in one number (the comparison with what is worn: each perk against its cap)
  R.power = (it) => { if (!it) return 0; let s = 0; for (const [k, v] of it.p) s += v / (BAL.cap[k] || 50); return Math.round(s * 100); };
  const itemOf = (o) => {
    if (!plain(o) || BAL.SLOTS.indexOf(o.s) < 0) return null;
    const r = clamp(num(o.r, 0) | 0, 0, 4), it = { id: String(o.id == null ? '?' : o.id).slice(0, 48), s: o.s, r, v: clamp(num(o.v, 0) | 0, 0, 2), lv: clamp(num(o.lv, 0) | 0, 0, 50), p: [] };
    if (Array.isArray(o.p)) for (const q of o.p.slice(0, 4)) if (Array.isArray(q) && BAL.PERKS.indexOf(q[0]) >= 0) it.p.push([q[0], clamp(Math.round(num(q[1], 0)), 0, 200)]);
    if (!it.p.length) it.p.push([BAL.base[it.s].k, R.baseVal(it.s, r, it.lv)]);
    return it;
  };
  R.item = itemOf;
  R.fresh = () => ({ v: V, eq: { tool: null, head: null, body: null, feet: null }, bag: [], n: 0, tri: -1, triT: 0, healed: {}, won: {}, seen: {} });
  R.load = function (raw) {
    const st = R.fresh(); if (!plain(raw)) return st;
    if (plain(raw.eq)) for (const s of BAL.SLOTS) { const it = itemOf(raw.eq[s]); if (it && it.s === s) st.eq[s] = it; }
    if (Array.isArray(raw.bag)) for (const o of raw.bag) { const it = itemOf(o); if (it && st.bag.length < BAL.BAG) st.bag.push(it); }
    st.triT = Math.max(0, num(raw.triT, 0)); st.n = clamp(num(raw.n, 0) | 0, 0, 1e7); st.tri = clamp(num(raw.tri, -1) | 0, -1, 1e7);
    for (const key of ['healed', 'won', 'seen']) if (plain(raw[key])) for (const k in raw[key]) if (raw[key][k] && k.length <= 48) st[key][k] = typeof raw[key][k] === 'number' ? raw[key][k] : 1;
    return st;
  };
  // a find goes into the bag (full: the weakest is salvaged first, its Taler returned); seen[id] once per id
  R.give = function (st, it) {
    if (!it || st.seen[it.id]) return { ok: false, why: 'seen' };
    st.seen[it.id] = 1; st.n++;
    let taler = 0;
    if (st.bag.length >= BAL.BAG) { let lo = 0; for (let i = 1; i < st.bag.length; i++) if (R.power(st.bag[i]) < R.power(st.bag[lo])) lo = i; taler = BAL.salvage[st.bag[lo].r]; st.bag.splice(lo, 1); }
    st.bag.push(it);
    return { ok: true, taler, better: R.power(it) > R.power(st.eq[it.s]) };
  };
  R.equip = function (st, i) { const it = st.bag[i]; if (!it) return false; const old = st.eq[it.s]; st.eq[it.s] = it; st.bag.splice(i, 1); if (old) st.bag.push(old); return true; };
  R.unequip = function (st, s) { const it = st.eq[s]; if (!it || st.bag.length >= BAL.BAG) return false; st.eq[s] = null; st.bag.push(it); return true; };
  R.salvage = function (st, i) { const it = st.bag[i]; if (!it) return 0; st.bag.splice(i, 1); return BAL.salvage[it.r]; };
  // what is worn, summed and capped: {kraft, schutz, glueck, ruhe, abbau} (percent; Ruhe in degrees)
  R.stats = function (st) {
    const o = { kraft: 0, schutz: 0, glueck: 0, ruhe: 0, abbau: 0 };
    if (st && st.eq) for (const s of BAL.SLOTS) { const it = st.eq[s]; if (it) for (const [k, v] of it.p) o[k] += v; }
    for (const k in o) o[k] = Math.min(BAL.cap[k], o[k]);
    return o;
  };
  R.mods = (st) => { const s = R.stats(st); return { dmg: 1 + s.kraft / 100, harm: 1 - s.schutz / 100, taler: 1 + s.glueck / 100, calm: s.ruhe, mine: 1 + s.abbau / 100 }; };
  // the harm a hit does with Schutz: never below one half-heart for a hit that did any
  R.harm = (dmg, st) => (dmg > 0 ? Math.max(1, Math.round(dmg * R.mods(st).harm)) : 0);

  // ---------------------------------------------------------------- the conquest
  R.regionOf = (x, z) => Math.floor(num(x, 0) / BAL.REGION) + '_' + Math.floor(num(z, 0) / BAL.REGION);
  // sites: [{id, x, z, tier, free: bool, day}] — the regions with their share, the boss's state and the Kernfeuer's place
  R.conquest = function (sites, st) {
    const by = {};
    for (const s of sites || []) {
      if (!s || !Number.isFinite(+s.x) || !Number.isFinite(+s.z)) continue;
      const id = R.regionOf(s.x, s.z), g = by[id] || (by[id] = { id, known: 0, freed: 0, sites: [], cx: 0, cz: 0, fx: 0, fz: 0 });
      g.known++; g.sites.push(s); g.cx += +s.x; g.cz += +s.z;
      if (s.free) { g.freed++; g.fx += +s.x; g.fz += +s.z; }
    }
    const regions = []; let score = 0, weight = 0, known = 0, freed = 0, won = 0;
    for (const id of Object.keys(by).sort()) {
      const g = by[id]; g.cx = Math.round(g.cx / g.known); g.cz = Math.round(g.cz / g.known);
      const hasBoss = g.known >= BAL.bossUnlock, isWon = !!(st && st.won && st.won[id]);
      g.boss = !hasBoss ? 'none' : isWon ? 'won' : g.freed >= BAL.bossUnlock ? 'ready' : 'locked';
      g.core = g.freed ? [Math.round(g.fx / g.freed), Math.round(g.fz / g.freed)] : null;   // the Kernfeuer: amid the freed beacons
      g.healed = !!(st && st.healed && st.healed[id]);
      const w = g.known + (hasBoss ? 2 : 0), sc = g.freed + (isWon ? 2 : 0);
      g.pct = Math.round(100 * sc / w);
      score += sc; weight += w; known += g.known; freed += g.freed; won += isWon ? 1 : 0;
      delete g.fx; delete g.fz;
      regions.push(g);
    }
    return { regions, known, freed, won, pct: weight ? Math.round(100 * score / weight) : 0 };
  };
  // the daily tribute: per freed outpost by its tier, ×1.5 in a region freed whole, ×2 in a healed one; up to three
  // days kept. today: the game's day number. → {days, amount, per}
  R.tribute = function (st, sites, today) {
    const C = R.conquest(sites, st), full = {}, healed = {};
    for (const g of C.regions) { full[g.id] = g.known > 0 && g.freed === g.known; healed[g.id] = g.boss === 'won' || g.healed; }
    let per = 0;
    for (const s of sites || []) if (s && s.free) { const id = R.regionOf(s.x, s.z); per += (BAL.tribute[s.tier] || BAL.tribute[3]) * (healed[id] ? BAL.healedBonus : full[id] ? BAL.fullBonus : 1); }
    per = Math.round(per);
    const t = num(today, 0) | 0, days = !per ? 0 : st.tri < 0 ? 1 : clamp(t - st.tri, 0, BAL.tributeDays);
    return { days, amount: days * per, per };
  };
  // (a claim at most every ten minutes of real time: sleeping through nights does not print Taler)
  R.claim = function (st, sites, today, nowMs) { const q = R.tribute(st, sites, today), t = num(nowMs, 0); if (q.amount <= 0 || (st.triT && t - st.triT < BAL.tributeGap && t >= st.triT)) return 0; st.tri = num(today, 0) | 0; st.triT = t; return q.amount; };

  // ---------------------------------------------------------------- Der Turmgänger (the boss's rules)
  // st: intro → idle ⇄ tele → strike → recover … ; a phase's points gone → stagger (and the next phase: the shield and
  // its drones in phase 2, the overload in 3) → down → won. Weak points open in recover (and always in phase 3's
  // overload): weak ×2, body ×0.35, nothing while the shield holds. Calm: three good calm rings a phase, no attacks
  class Boss {
    constructor(band, calm, rnd) {
      const B = BAL.boss; this.band = own(B.band, band) ? band : 'normal'; this.calm = !!calm; this.rnd = rnd || Math.random;
      this.ph = 1; this.max = B.hp.map(h => Math.round(h * B.band[this.band])); this.hp = this.calm ? B.calmPhase : this.max[0];
      this.st = 'intro'; this.t = 0; this.att = null; this.cool = 1.5; this.shield = false; this.shT = 0; this.adds = 0; this.time = 0; this.dealt = 0;
    }
    get phaseMax() { return this.calm ? BAL.boss.calmPhase : this.max[this.ph - 1]; }
    get open() { return !this.shield && (this.st === 'recover' || this.st === 'stagger' || (this.ph === 3 && this.st !== 'down' && this.st !== 'won')); }
    // the share of the whole fight left (the bar): 1 … 0
    get frac() { if (this.st === 'won' || this.st === 'down') return 0; let all = 0, left = 0; for (let i = 0; i < 3; i++) { const m = this.calm ? BAL.boss.calmPhase : this.max[i]; all += m; if (i + 1 > this.ph) left += m; else if (i + 1 === this.ph) left += Math.max(0, this.hp); } return left / all; }
    to(s) { this.st = s; this.t = 0; }
    // ctx: {dist (m to the player), adds (drones of the boss still up)} → events
    step(dt, ctx) {
      const B = BAL.boss, ev = []; if (!(dt > 0) || this.st === 'won') return ev;
      this.t += dt; this.time += dt; const c = ctx || {};
      if (this.shield) { this.shT += dt; if ((c.adds | 0) <= 0 && this.shT > 1.5 || this.shT >= B.shieldMax[this.band]) { this.shield = false; ev.push('shield:off'); } }
      switch (this.st) {
        case 'intro': if (this.t >= B.intro) { this.to('idle'); ev.push('fight'); } break;
        case 'idle': {
          if (this.calm) break;
          this.cool -= dt;
          if (this.cool <= 0) {
            const near = num(c.dist, 99) < B.near;
            this.att = this.ph === 1 ? (near ? 'stomp' : 'slam') : this.ph === 2 ? (near && this.rnd() < 0.5 ? 'stomp' : 'fan') : (near ? (this.rnd() < 0.5 ? 'stomp' : 'slam') : 'fan');
            this.to('tele'); ev.push('tele:' + this.att);
          }
          break;
        }
        case 'tele': if (this.t >= R.teleOf(this.att, this.band)) { this.to('strike'); ev.push('strike:' + this.att); } break;
        case 'strike': if (this.t >= B.strike[this.att]) { this.to('recover'); ev.push('recover'); } break;
        case 'recover': if (this.t >= B.recover[this.att] * (this.ph === 3 ? 0.75 : 1)) { const cl = B.cool[this.ph - 1]; this.cool = cl[0] + this.rnd() * (cl[1] - cl[0]); this.to('idle'); } break;
        case 'stagger':
          if (this.t >= B.stagger) {
            this.ph++; this.hp = this.phaseMax; this.to('idle'); this.cool = 2; ev.push('phase' + this.ph);
            if (!this.calm && B.adds[this.ph - 1]) { this.adds = B.adds[this.ph - 1]; ev.push('adds:' + this.adds); }
            if (!this.calm && this.ph === 2) { this.shield = true; this.shT = 0; ev.push('shield:on'); }
          }
          break;
        case 'down': if (this.t >= B.down) { this.to('won'); ev.push('won'); } break;
      }
      return ev;
    }
    // a hit: zone 'weak' | 'body' → the points taken
    hit(dmg, zone) {
      if (this.calm || !(dmg > 0) || this.st === 'intro' || this.st === 'stagger' || this.st === 'down' || this.st === 'won') return 0;
      if (this.shield) return 0;
      const k = zone === 'weak' && this.open ? BAL.boss.weak : BAL.boss.body, d = dmg * k;
      this.hp -= d; this.dealt += d;
      if (this.hp <= 0) this.phaseDone();
      return d;
    }
    phaseDone() { this.hp = 0; this.att = null; this.shield = false; if (this.ph >= 3) this.to('down'); else this.to('stagger'); }
    // the calm version: a good calm ring takes one of the phase's three
    calmHit(ok) {
      if (!this.calm || this.st === 'intro' || this.st === 'stagger' || this.st === 'down' || this.st === 'won') return false;
      if (!ok) return false;
      this.hp--; if (this.hp <= 0) this.phaseDone();
      return true;
    }
    save() { return { ph: this.ph, hp: Math.round(this.hp) }; }
  }
  R.Boss = Boss;
  R.teleOf = (att, band) => Math.max(0.6, (BAL.boss.tele[att] || 0.6) * (band === 'easy' ? 1.25 : 1));

  // ---------------------------------------------------------------- the loot burst (how many coins fly)
  R.coins = (taler) => (taler <= 0 ? 0 : clamp(Math.round(4 + Math.sqrt(taler) * 0.9), 5, 28));
  // the fanfare: notes (semitones over the day's root) by rarity — a longer, higher run for the rarer find
  R.fanfare = (r) => { const run = [0, 4, 7, 12, 16, 19]; const n = 3 + clamp(r | 0, 0, 4) * 0.75 | 0; return run.slice(0, Math.min(6, n)).map((s, i) => ({ s, t: i * 0.09, dur: i === Math.min(6, n) - 1 ? 0.9 : 0.25 })); };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
