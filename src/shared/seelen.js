// ============================================================================
// r-seelen · VR.Seelen — villagers with memory, reflection, plans and relationships (plan
// docs/superpowers/plans/2026-11-07-r-seelen.md; spec 2026-11-07-vision.md „Bewohner mit Seele“).
// The generative-agents loop — a memory stream, reflection, planning — as plain deterministic game rules: no language
// model, no network, nothing a player needs an account for. Pure (node: test/seelen.js); the game's glue is
// src/main/seelen_game.js.
//   memory     a ring of S.MEM observations per villager {k kind, t game minute, i importance 1–10, a arg, w who}; the
//              same thing again within an hour raises the old one instead of adding; a full ring forgets the entry
//              with the least retention (importance + recency)
//   retrieval  score = recency (0.995 per game hour) + importance / 10 + relevance (the query's tags, its person)
//   reflection at night: the weighted memories vote for beliefs (fearStorm, likesWanderer, waryWanderer, proud, awed,
//              fond, upset, worried, curious); ≤ 3 kept, each fades ×0.75 a night unless the day fed it again
//   plan       five slots of the day (900–13000); a: null = the village's own schedule decides (villages.js is the
//              executor), an override only where the soul has a reason: meet a friend, a quarrel's beat, admire the
//              new building, watch the sky for the whale, hear the news at the plaza
//   quarrel    „Streit um nichts“: spat → cold (turned backs) → bench (a shared bench) → gift → done, over 1–2 days
//   relations  a graph per village: family / neighbour / work seeded from the roster, deltas from shared moments
//   the player meetings, gifts, help, dances, hurts → a feeling (wary · stranger · known · likes · friend · close)
//   speech     bilingual lists g.se.* (lang_de.js / lang_en.js); every line's slots come from a memory, a belief, a
//              friend or the Chronik — a plain line only when nothing fits
//   save       meta.seelen = {v, p: {pid: mind}, r: {vid: deltas}, q: {vid: quarrel}} compact and capped (S.save/S.load)
// ============================================================================
(function (VR) {
  'use strict';
  const S = VR.Seelen = VR.Seelen || {};
  S.V = 1;
  S.MEM = 48;          // memories per villager (the live ring)
  S.SAVE_MEM = 8;     // memories per villager in the save (the strongest)
  S.MAXP = 120;        // villagers kept in the save (the most recently touched)
  S.MAXV = 24;         // villages' graphs / quarrels in the save
  S.MAXR = 32;         // relationship deltas per village in the save
  S.MAXB = 3;          // beliefs per villager
  S.FADE = 0.75;       // a belief's strength after a night without new food
  S.BMIN = 0.15;       // a weaker belief is forgotten
  S.BTH = 5;           // the weighted votes a new belief needs
  S.HOUR = 60;         // game minutes
  S.DAY = 1440;
  // kinds: [importance, tags, valence]
  const TG = S.TAGS = { pl: 1, storm: 2, wunder: 4, build: 8, chronik: 16, friend: 32, quarrel: 64, danger: 128, fest: 256 };
  const tags = (s) => s.split('|').reduce((m, k) => m | TG[k], 0);
  S.KINDS = {
    seen: [2, tags('pl'), 0], talk: [3, tags('pl'), 1], gift: [6, tags('pl'), 2], helped: [8, tags('pl'), 2], hurt: [7, tags('pl'), -2],
    danced: [6, tags('pl|fest'), 2], storm: [5, tags('storm'), -1], wunder: [7, tags('wunder'), 2], build: [7, tags('build'), 1],
    chronik: [3, tags('chronik'), 0], moment: [4, tags('friend|fest'), 1], hug: [2, tags('friend'), 1], fgift: [5, tags('friend'), 2],
    quarrel: [6, tags('quarrel'), -2], made_up: [6, tags('friend'), 2], danger: [6, tags('danger'), -2],
  };
  S.BELIEFS = ['fearStorm', 'likesWanderer', 'waryWanderer', 'proud', 'awed', 'fond', 'upset', 'worried', 'curious'];
  S.ACTS = ['meet', 'spat', 'bench', 'gift', 'admire', 'skywatch', 'news'];
  S.SLOTS = [[900, 3300], [3300, 5600], [5600, 6900], [6900, 10600], [10600, 13000]];
  S.MOMENTS = ['dance', 'picnic', 'lantern', 'tag', 'hide', 'feed', 'fest'];
  S.TOPICS = 8;        // g.se.topic has 8 „Streit um nichts“ topics

  const h32 = S.h32 = (a, b, c) => { let x = (a | 0) ^ Math.imul(b | 0, 0x9E3779B1) ^ Math.imul((c | 0) + 0x7F4A7C15, 0x85EBCA77); x ^= x >>> 16; x = Math.imul(x, 0x7FEB352D); x ^= x >>> 15; x = Math.imul(x, 0x846CA68B); x ^= x >>> 16; return x >>> 0; };
  S.hs = (s) => { s = String(s); let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const r2 = (v) => Math.round(v * 100) / 100;

  // ---------------------------------------------------------------- the mind
  S.newMind = () => ({ m: [], b: [], pl: null, u: 0 });
  S.rec = (t, now) => Math.pow(0.995, Math.max(0, now - t) / S.HOUR);
  const retention = (e, now) => e.i / 10 + S.rec(e.t, now);
  // note an observation; returns the entry
  S.note = function (mind, k, t, o) {
    const K = S.KINDS[k]; if (!K || !mind) return null;
    o = o || {};
    const a = o.a === undefined || o.a === null ? '' : String(o.a).slice(0, 24), w = o.w === undefined || o.w === null ? '' : String(o.w).slice(0, 24);
    const imp = clamp(Math.round(o.i || K[0]), 1, 10);
    mind.u = Math.max(mind.u || 0, t);
    for (let j = mind.m.length - 1; j >= 0; j--) {
      const e = mind.m[j];
      if (t - e.t > S.HOUR) break;
      if (e.k === k && e.a === a && e.w === w) { e.t = t; e.i = Math.min(10, Math.max(e.i, imp) + (k === 'seen' ? 0 : 1)); return e; }
    }
    const e = { k, t, i: imp, a, w };
    if (mind.m.length >= S.MEM) {
      let worst = 0, ws = 1e9;
      for (let j = 0; j < mind.m.length; j++) { const s = retention(mind.m[j], t); if (s < ws) { ws = s; worst = j; } }
      mind.m.splice(worst, 1);
    }
    mind.m.push(e);
    return e;
  };
  // ---------------------------------------------------------------- retrieval
  S.score = function (e, now, q) {
    let rel = 0;
    if (q) {
      const K = S.KINDS[e.k];
      if (q.tags && K && (K[1] & q.tags)) rel += 1;
      if (q.w && e.w === q.w) rel += 0.5;
      if (q.k && e.k === q.k) rel += 0.5;
    }
    return S.rec(e.t, now) + e.i / 10 + rel;
  };
  S.retrieve = function (mind, now, q, n) {
    if (!mind || !mind.m.length) return [];
    const L = [];
    for (const e of mind.m) { if (q && q.only && !(S.KINDS[e.k][1] & q.only)) continue; if (q && q.not && (S.KINDS[e.k][1] & q.not)) continue; L.push([S.score(e, now, q), e]); }
    L.sort((x, y) => (y[0] - x[0]) || (y[1].t - x[1].t) || (x[1].k < y[1].k ? -1 : x[1].k > y[1].k ? 1 : 0));
    return L.slice(0, n || 3).map(x => x[1]);
  };
  // ---------------------------------------------------------------- reflection (at night)
  S.reflect = function (mind, now, day) {
    const votes = {};
    const vote = (b, w, a, who) => { const key = b + '|' + (a || '') + '|' + (who || ''); const v = votes[key] || (votes[key] = { b, a: a || '', w: who || '', s: 0 }); v.s += w; };
    let pos = 0, neg = 0;
    const made = {};
    for (const e of mind.m) if (e.k === 'made_up') made[e.w] = Math.max(made[e.w] || 0, e.t);
    for (const e of mind.m) {
      const w = e.i * S.rec(e.t, now);
      switch (e.k) {
        case 'storm': vote('fearStorm', w); break;
        case 'danger': vote('worried', w); break;
        case 'seen': pos += w * 0.25; break;
        case 'talk': case 'gift': case 'helped': case 'danced': pos += w; break;
        case 'hurt': neg += w; break;
        case 'build': vote('proud', w, e.a); break;
        case 'wunder': vote('awed', w, e.a); break;
        case 'moment': case 'hug': case 'fgift': case 'made_up': if (e.w) vote('fond', w, '', e.w); break;
        case 'quarrel': if (e.w && !(made[e.w] > e.t)) vote('upset', w, '', e.w); break;
        case 'chronik': vote('curious', w * 0.7); break;
      }
    }
    if (pos - neg > 0) vote('likesWanderer', pos - neg); else if (neg > pos) vote('waryWanderer', neg - pos);
    // the old beliefs fade; the night's votes feed them or found new ones
    const out = [];
    const old = {};
    for (const b of mind.b || []) old[b.b + '|' + (b.a || '') + '|' + (b.w || '')] = b;
    const keys = Object.keys(votes).sort();
    for (const k of keys) {
      const v = votes[k], o = old[k];
      if (!o && v.s < S.BTH) continue;
      const s = clamp((o ? o.s * S.FADE : 0) + v.s / 20, 0, 1);
      out.push({ b: v.b, s: r2(s), a: v.a, w: v.w, d: o ? o.d : day });
      delete old[k];
    }
    for (const k of Object.keys(old).sort()) {
      const o = old[k];
      if (o.b === 'upset' && made[o.w]) continue;   // (made up: the grudge is gone)
      const s = r2(o.s * S.FADE);
      if (s >= S.BMIN) out.push({ b: o.b, s, a: o.a || '', w: o.w || '', d: o.d });
    }
    // one belief per kind (the strongest), likes and wary exclude each other, ≤ S.MAXB
    out.sort((x, y) => (y.s - x.s) || (x.b < y.b ? -1 : x.b > y.b ? 1 : 0) || (x.a < y.a ? -1 : 1) || (x.w < y.w ? -1 : 1));
    const seen = {}, keep = [];
    for (const b of out) {
      const kind = b.b === 'waryWanderer' ? 'likesWanderer' : b.b;
      if (seen[kind]) continue; seen[kind] = 1;
      keep.push(b); if (keep.length >= S.MAXB) break;
    }
    mind.b = keep;
    mind.rd = day;
    return keep;
  };
  S.has = (mind, b) => (mind && mind.b ? mind.b.find(x => x.b === b) || null : null);

  // ---------------------------------------------------------------- relationships (one graph per village)
  // people: [{id, fam, home, role, age}] — ids are the villagers' local ids; the base is recomputed, only deltas saved
  S.key = (i, j) => (i < j ? i + '|' + j : j + '|' + i);
  S.seedRel = function (people) {
    const base = {};
    for (let x = 0; x < people.length; x++) for (let y = x + 1; y < people.length; y++) {
      const A = people[x], B = people[y];
      let v = 0, k = '';
      if (A.fam === B.fam) { v = 0.6; k = 'family'; }
      else if (A.role && A.role === B.role && A.age !== 'child' && B.age !== 'child') { v = 0.3; k = 'work'; }
      else if (Math.abs((A.home | 0) - (B.home | 0)) === 1) { v = 0.25; k = 'neighbour'; }
      else if (A.age === 'child' && B.age === 'child') { v = 0.2; k = 'neighbour'; }
      if (v) base[S.key(A.id, B.id)] = [v, k];
    }
    return base;
  };
  S.newGraph = (people, d) => ({ base: S.seedRel(people), d: d || {} });
  S.relV = (G, i, j) => { const k = S.key(i, j), b = G.base[k]; return clamp((b ? b[0] : 0) + (G.d[k] || 0), -1, 1); };
  S.relAdd = function (G, i, j, dv) {
    if (i === j) return 0;
    const k = S.key(i, j), b = G.base[k], bv = b ? b[0] : 0;
    const nv = clamp(bv + (G.d[k] || 0) + dv, -1, 1);
    const d = r2(nv - bv);
    if (Math.abs(d) < 0.005) delete G.d[k]; else G.d[k] = d;
    return nv;
  };
  // kind: quarrel (an open one) · family · friend (≥ 0.5) · work · neighbour · '' (none)
  S.relKind = function (G, i, j, q) {
    if (q && q.ph !== 'done' && ((q.a === i && q.b === j) || (q.a === j && q.b === i))) return 'quarrel';
    const k = S.key(i, j), b = G.base[k], v = S.relV(G, i, j);
    if (b && b[1] === 'family') return 'family';
    if (v >= 0.5) return 'friend';
    if (v <= -0.3) return 'quarrel';
    return b && v > 0 ? b[1] : '';
  };
  S.friendsOf = function (G, id, n, ids) {
    const L = [];
    for (const o of ids) { if (o === id) continue; const k = S.key(id, o), b = G.base[k]; if (b && b[1] === 'family') continue; const v = S.relV(G, id, o); if (v >= 0.4) L.push([v, o]); }
    L.sort((x, y) => (y[0] - x[0]) || (x[1] < y[1] ? -1 : 1));
    return L.slice(0, n || 3).map(x => ({ w: x[1], v: x[0] }));
  };
  // a shared moment / a hug / a gift between two neighbours
  S.SHARE = { dance: 0.15, picnic: 0.15, lantern: 0.18, fest: 0.12, tag: 0.08, hide: 0.08, feed: 0.1, hug: 0.04, talk: 0.02, fgift: 0.2, made_up: 0.5, quarrel: -0.45 };
  S.share = (G, i, j, kind) => S.relAdd(G, i, j, S.SHARE[kind] || 0.05);

  // ---------------------------------------------------------------- the quarrel („Streit um nichts“)
  S.Q = ['spat', 'cold', 'bench', 'gift', 'done'];
  S.qNew = (a, b, day, seed) => ({ a, b, ph: 'spat', d: day, tp: h32(seed, day, 31) % S.TOPICS, g: (h32(seed, day, 37) & 1) ? a : b });
  // may a village start one today? (one at a time, one village-day in four, two adults neither family nor friends)
  S.qPick = function (G, people, day, seed) {
    if ((h32(seed, day, 41) & 3) !== 0) return null;
    const ad = people.filter(p => p.age === 'adult').map(p => p.id).sort();
    if (ad.length < 2) return null;
    const pairs = [];
    for (let x = 0; x < ad.length; x++) for (let y = x + 1; y < ad.length; y++) { const k = S.key(ad[x], ad[y]), b = G.base[k]; if (!b || b[1] === 'family') continue; const v = S.relV(G, ad[x], ad[y]); if (v > 0 && v < 0.5) pairs.push([ad[x], ad[y]]); }
    if (!pairs.length) return null;
    const pr = pairs[h32(seed, day, 43) % pairs.length];
    return S.qNew(pr[0], pr[1], day, seed);
  };
  // one step: o = {day, tod, beat} — beat: the current phase's scene was played (or seen through)
  S.qStep = function (q, o) {
    if (!q || q.ph === 'done') return q;
    const day = o.day | 0, tod = o.tod || 0, d0 = q.d | 0;
    const go = (ph) => { q.ph = ph; q.at = day; return q; };
    switch (q.ph) {
      case 'spat': if (o.beat || day > d0) return go('cold'); break;
      case 'cold': if ((day >= d0 + 1 && tod >= 10600) || day >= d0 + 2) return go('bench'); break;
      case 'bench': if (o.beat || day >= d0 + 2) return go('gift'); break;
      case 'gift': if (o.beat || day >= d0 + 3) return go('done'); break;
    }
    return q;
  };
  // run the machine through the days you were away (no beats seen: the timeouts carry it)
  S.qCatch = function (q, day, tod) { for (let k = 0; k < 6 && q && q.ph !== 'done'; k++) { const ph = q.ph; S.qStep(q, { day, tod }); if (q.ph === ph) break; } return q; };

  // ---------------------------------------------------------------- the day's plan
  // c = {seed, day, kid, elder, role, mind, friends: [{w, v}], q: quarrel|null, me: id, proud: building|null, whale: bool}
  S.plan = function (c) {
    const slots = S.SLOTS.map(([f, u]) => ({ f, u, a: null, why: '', w: '' }));
    const h = h32(c.seed | 0, c.day | 0, 51), mind = c.mind || null;
    const q = c.q && c.q.ph !== 'done' && (c.q.a === c.me || c.q.b === c.me) ? c.q : null;
    const other = q ? (q.a === c.me ? q.b : q.a) : '';
    const set = (i, a, why, w) => { slots[i].a = a; slots[i].why = why || a; slots[i].w = w || ''; };
    if (q) {
      if (q.ph === 'spat') set(4, 'spat', 'quarrel', other);
      else if (q.ph === 'cold') { set(2, 'spat', 'cold', other); set(4, 'bench', 'reconcile', other); }
      else if (q.ph === 'bench') set(4, 'bench', 'reconcile', other);
      else if (q.ph === 'gift') set(2, 'gift', 'reconcile', other);
    }
    const fr = (c.friends || []).filter(f => f.w !== other);
    if (fr.length && !slots[4].a && !c.kid) set(4, 'meet', 'friend', fr[h % fr.length].w);
    else if (fr.length && !slots[2].a && !c.kid) set(2, 'meet', 'friend', fr[h % fr.length].w);
    const proud = S.has(mind, 'proud');
    if (proud && (c.elder || c.kid || c.role === 'gardener' || c.role === 'crafter') && !slots[3].a) set(3, 'admire', 'proud', '');
    else if (proud && !slots[2].a) set(2, 'admire', 'proud', '');
    const awed = S.has(mind, 'awed');
    if (awed && awed.a === 'whale' && c.whale && !slots[4].a) set(4, 'skywatch', 'awed', '');
    if (S.has(mind, 'curious') && !slots[2].a) set(2, 'news', 'curious', '');
    if (proud) for (const s of slots) if (s.a === 'admire') s.arg = proud.a;
    return slots;
  };
  S.planValid = function (P) {
    if (!Array.isArray(P) || P.length < 4 || P.length > 6) return 'count';
    for (let i = 0; i < P.length; i++) {
      const s = P[i];
      if (!(s.u > s.f)) return 'order ' + i;
      if (i && P[i - 1].u !== s.f) return 'gap ' + i;
      if (s.a !== null && S.ACTS.indexOf(s.a) < 0) return 'act ' + s.a;
      if ((s.a === 'meet' || s.a === 'spat' || s.a === 'bench' || s.a === 'gift') && !s.w) return 'who ' + i;
    }
    if (P[0].f > 1200 || P[P.length - 1].u < 12300) return 'span';
    return '';
  };
  S.slotAt = (P, tod) => { if (!P) return null; for (const s of P) if (tod >= s.f && tod < s.u) return s; return null; };

  // ---------------------------------------------------------------- the player
  S.newPl = () => ({ n: 0, g: 0, h: 0, x: 0, d: 0, t: -1e9, lw: '' });
  S.plMeet = function (mind, t) { const p = mind.pl || (mind.pl = S.newPl()); if (t - p.t >= 90) { p.n++; p.t = t; mind.u = Math.max(mind.u || 0, t); return true; } p.t = Math.max(p.t, t); return false; };
  S.plAdd = function (mind, what, t) { const p = mind.pl || (mind.pl = S.newPl()); if (p[what] !== undefined) p[what]++; mind.u = Math.max(mind.u || 0, t || 0); return p; };
  S.feelScore = (p) => (p ? Math.min(p.n, 12) + p.g * 3 + p.h * 5 + p.d * 2 - p.x * 4 : 0);
  S.FEEL = ['wary', 'stranger', 'known', 'likes', 'friend', 'close'];
  S.feel = function (p) { const s = S.feelScore(p); return !p ? 'stranger' : s < 0 ? 'wary' : s < 2 ? 'stranger' : s < 6 ? 'known' : s < 12 ? 'likes' : s < 22 ? 'friend' : 'close'; };
  S.feelRank = (f) => S.FEEL.indexOf(f);

  // ---------------------------------------------------------------- speech (bilingual grammars)
  // L(key) → the list of templates in the player's language; c = {mind, now, name, me, who(id)→name, item(id)→name,
  // wunder(kind)→name, thing(build arg)→words, ev(arg)→the Chronik's sentence, moment(kind)→words, topic(n)→words,
  // when(minutes ago)→words, friends: [{w, mind}], q}
  S.fill = function (s, v) { return String(s).replace(/\{(\w+)\}/g, (m, k) => (v[k] !== undefined && v[k] !== null && v[k] !== '' ? String(v[k]) : m)); };
  const pickT = (L, key, seed) => { const A = L(key); return A && A.length ? A[seed % A.length] : ''; };
  const ok = (s) => s && s.indexOf('{') < 0 && s.indexOf('undefined') < 0;
  // a memory's slots
  S.vars = function (e, c) {
    const v = { name: c.name || '', me: c.me || '' };
    if (!e) return v;
    v.when = c.when ? c.when(c.now - e.t) : '';
    if (e.k === 'gift' || e.k === 'fgift') v.item = e.a && c.item ? c.item(e.a) : '';
    if (e.w && e.w !== 'pl' && c.who) v.who = c.who(e.w);
    if (e.k === 'wunder') v.wunder = c.wunder ? c.wunder(e.a) : '';
    if (e.k === 'build') v.thing = c.thing ? c.thing(e.a) : '';
    if (e.k === 'chronik') v.ev = c.ev ? c.ev(e.a) : '';
    if (e.k === 'moment') v.what = c.moment ? c.moment(e.a) : '';
    if (e.k === 'quarrel') v.topic = c.topic ? c.topic(e.a | 0) : '';
    return v;
  };
  // the line for a memory (group: gr · st), '' when its slots can't be filled
  const memLine = (group, e, c, L, seed) => {
    const t = pickT(L, 'g.se.' + group + '.' + e.k, seed);
    if (!t) return null;
    const s = S.fill(t, S.vars(e, c));
    return ok(s) ? { key: 'g.se.' + group + '.' + e.k, text: s, e } : null;
  };
  const beliefVars = (b, c) => {
    const v = { name: c.name || '', me: c.me || '' };
    if (b.b === 'proud') v.thing = c.thing ? c.thing(b.a) : '';
    if (b.b === 'awed') v.wunder = c.wunder ? c.wunder(b.a) : '';
    if ((b.b === 'fond' || b.b === 'upset') && c.who) v.who = c.who(b.w);
    return v;
  };
  const beliefLine = (group, b, c, L, seed) => {
    const t = pickT(L, 'g.se.' + group + '.' + b.b, seed);
    if (!t) return null;
    const s = S.fill(t, beliefVars(b, c));
    return ok(s) ? { key: 'g.se.' + group + '.' + b.b, text: s, b } : null;
  };
  const plain = (key, c, L, seed, v) => { const t = pickT(L, key, seed); const s = S.fill(t, Object.assign({ name: c.name || '', me: c.me || '' }, v || {})); return ok(s) ? { key, text: s } : { key, text: S.fill(t, { name: '', me: '' }).replace(/[ ,]*\{\w+\}/g, '') }; };
  // greeting: a memory of the player first (gift, help, dance, hurt), then a proud / awed belief, then the feeling
  S.greet = function (c, L, seed) {
    const mind = c.mind, now = c.now;
    const pm = S.retrieve(mind, now, { only: TG.pl, tags: TG.pl }, 4).filter(e => e.k !== 'seen' && e.k !== 'talk');
    for (const e of pm) { const r = memLine('gr', e, c, L, seed); if (r) return r; }
    const proud = S.has(mind, 'proud'), awed = S.has(mind, 'awed');
    if (proud && (seed & 1)) { const r = beliefLine('gr', proud, c, L, seed); if (r) return r; }
    if (awed) { const r = beliefLine('gr', awed, c, L, seed); if (r) return r; }
    if (proud) { const r = beliefLine('gr', proud, c, L, seed); if (r) return r; }
    const f = S.feel(mind && mind.pl);
    return plain('g.se.gr.feel.' + f, c, L, seed);
  };
  // small talk: the strongest thing they saw that is not about you
  S.small = function (c, L, seed) {
    const top = S.retrieve(c.mind, c.now, { not: TG.pl, tags: TG.storm | TG.wunder | TG.build | TG.chronik | TG.friend | TG.quarrel }, 4);
    for (let k = 0; k < top.length; k++) { const e = top[(k + (seed % Math.max(1, Math.min(2, top.length)))) % top.length]; const r = memLine('st', e, c, L, seed); if (r) return r; }
    return null;
  };
  S.feelLine = function (c, L, seed) {
    const bs = (c.mind && c.mind.b) || [];
    for (let k = 0; k < bs.length; k++) { const r = beliefLine('fe', bs[(k + seed) % bs.length], c, L, seed); if (r) return r; }
    return null;
  };
  // gossip: a friend's belief (or their quarrel), told with a wink
  S.gossip = function (c, L, seed) {
    const fr = c.friends || [];
    if (c.q && c.q.ph !== 'done' && c.who && c.q.a !== c.meId && c.q.b !== c.meId) {
      const t = pickT(L, 'g.se.go.quarrel', seed), s = S.fill(t, { who: c.who(c.q.a), who2: c.who(c.q.b), topic: c.topic ? c.topic(c.q.tp) : '' });
      if (ok(s)) return { key: 'g.se.go.quarrel', text: s };
    }
    for (let k = 0; k < fr.length; k++) {
      const f = fr[(k + seed) % fr.length], b = f.mind && f.mind.b && f.mind.b[0];
      if (!b || b.b === 'fond' || b.b === 'upset') continue;
      const t = pickT(L, 'g.se.go.' + b.b, seed);
      const v = Object.assign(beliefVars(b, c), { who: c.who ? c.who(f.w) : '' });
      const s = S.fill(t, v);
      if (ok(s)) return { key: 'g.se.go.' + b.b, text: s };
    }
    return null;
  };
  S.bye = function (c, L, seed) {
    if (c.stormNear && S.has(c.mind, 'fearStorm')) return plain('g.se.by.storm', c, L, seed);
    const f = S.feel(c.mind && c.mind.pl);
    return plain(S.feelRank(f) >= 4 ? 'g.se.by.friend' : 'g.se.by.plain', c, L, seed);
  };
  // the talk window's „Wie geht's?“: small talk, a feeling, gossip — in turn
  S.chat = function (c, L, seed) {
    const order = [S.small, S.feelLine, S.gossip];
    for (let k = 0; k < 3; k++) { const r = order[(seed + k) % 3](c, L, seed); if (r) return r; }
    return null;
  };
  // a scene's line: q.<phase>, meet, hurry, show, come, sky
  S.beat = function (kind, c, L, seed, v) { return plain('g.se.' + kind, c, L, seed, v); };

  // ---------------------------------------------------------------- save / load (compact, capped)
  const E2A = (e) => { const r = [S.KINDS[e.k] ? Object.keys(S.KINDS).indexOf(e.k) : 0, Math.round(e.t), e.i]; if (e.a || e.w) r.push(e.a || ''); if (e.w) r.push(e.w); return r; };
  const KN = Object.keys(S.KINDS);
  const A2E = (r) => (Array.isArray(r) && KN[r[0] | 0] ? { k: KN[r[0] | 0], t: +r[1] || 0, i: clamp(r[2] | 0, 1, 10), a: r[3] ? String(r[3]).slice(0, 24) : '', w: r[4] ? String(r[4]).slice(0, 24) : '' } : null);
  S.save = function (st) {
    const out = { v: S.V, p: {}, r: {}, q: {} };
    if (!st) return out;
    const ids = Object.keys(st.p || {}).filter(id => { const m = st.p[id]; return m && (m.m.length || m.b.length || m.pl); });
    ids.sort((x, y) => ((st.p[y].u || 0) - (st.p[x].u || 0)) || (x < y ? -1 : 1));
    for (const id of ids.slice(0, S.MAXP)) {
      const m = st.p[id], now = m.u || 0;
      const keepM = m.m.filter(e => e.k !== 'seen').sort((x, y) => (retention(y, now) - retention(x, now)) || (y.t - x.t)).slice(0, S.SAVE_MEM).sort((x, y) => x.t - y.t);
      const o = { m: keepM.map(E2A), u: Math.round(m.u || 0) };
      if (m.b.length) o.b = m.b.map(b => [S.BELIEFS.indexOf(b.b), Math.round(b.s * 100), b.a || '', b.w || '', b.d | 0]);
      if (m.pl) o.pl = [m.pl.n, m.pl.g, m.pl.h, m.pl.x, m.pl.d, Math.round(m.pl.t), String(m.pl.lw || '').slice(0, 100)];
      if (m.rd !== undefined) o.rd = m.rd | 0;
      out.p[id] = o;
    }
    const vids = Object.keys(st.r || {}).sort().slice(0, S.MAXV);
    for (const vid of vids) {
      const d = st.r[vid] || {}, ks = Object.keys(d).sort((x, y) => (Math.abs(d[y]) - Math.abs(d[x])) || (x < y ? -1 : 1)).slice(0, S.MAXR);
      if (!ks.length) continue;
      const o = {}; for (const k of ks) o[k] = Math.round(d[k] * 100); out.r[vid] = o;
    }
    for (const vid of Object.keys(st.q || {}).sort().slice(0, S.MAXV)) { const q = st.q[vid]; if (q) out.q[vid] = [q.a, q.b, S.Q.indexOf(q.ph), q.d | 0, q.tp | 0, q.g === q.a ? 0 : 1, q.at | 0]; }
    return out;
  };
  S.load = function (o) {
    const st = { p: {}, r: {}, q: {} };
    if (!o || typeof o !== 'object' || (o.v | 0) !== S.V) return st;
    for (const id of Object.keys(o.p || {}).slice(0, S.MAXP)) {
      const r = o.p[id]; if (!r || typeof r !== 'object') continue;
      const m = S.newMind();
      m.m = (Array.isArray(r.m) ? r.m : []).map(A2E).filter(Boolean).slice(-S.MEM);
      m.b = (Array.isArray(r.b) ? r.b : []).map(b => (Array.isArray(b) && S.BELIEFS[b[0]] ? { b: S.BELIEFS[b[0]], s: clamp((+b[1] || 0) / 100, 0, 1), a: String(b[2] || ''), w: String(b[3] || ''), d: b[4] | 0 } : null)).filter(Boolean).slice(0, S.MAXB);
      if (Array.isArray(r.pl)) m.pl = { n: r.pl[0] | 0, g: r.pl[1] | 0, h: r.pl[2] | 0, x: r.pl[3] | 0, d: r.pl[4] | 0, t: +r.pl[5] || 0, lw: String(r.pl[6] || '').slice(0, 100) };
      m.u = +r.u || 0; if (r.rd !== undefined) m.rd = r.rd | 0;
      st.p[id] = m;
    }
    for (const vid of Object.keys(o.r || {}).slice(0, S.MAXV)) { const d = o.r[vid], g = {}; if (d && typeof d === 'object') for (const k of Object.keys(d).slice(0, S.MAXR)) { const v = +d[k]; if (isFinite(v) && k.indexOf('|') > 0) g[k] = clamp(v / 100, -2, 2); } st.r[vid] = g; }
    for (const vid of Object.keys(o.q || {}).slice(0, S.MAXV)) { const q = o.q[vid]; if (Array.isArray(q) && S.Q[q[2]]) st.q[vid] = { a: String(q[0]), b: String(q[1]), ph: S.Q[q[2]], d: q[3] | 0, tp: (q[4] | 0) % S.TOPICS, g: q[5] ? String(q[1]) : String(q[0]), at: q[6] | 0 }; }
    return st;
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
