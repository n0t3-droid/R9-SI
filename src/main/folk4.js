// ============================================================================
// u-folk4 · VR.Folk4 — villagers who are fun and warm (plan docs/superpowers/plans/2026-11-05-u-folk4.md).
// The owner: „die Bewohner sind nicht wirklich spaßig" — beauty, loving peaceful coexistence, walking never boring.
// Built on folkjoy.js (smiles, the dance), folk3.js (the ring, the lids), gossip.js (the deed greeting), folklife.js
// (the children's games), the Regie (regie.js: when) and the Flausellichter (dusk.js: VR.Dusk.lure).
//   moments    little scenes you stumble upon while walking, staged within 35 m of you, one at a time, chosen by the
//              Regie (a source: weight 2, kind 'folk') or, without one, by its own 2-s clock: children playing tag or
//              hide-and-seek in the yard near you · two neighbours on a picnic blanket · an elder feeding the animals
//              (wildheart's families come: their 'visit' mode) · at dusk a dance circle on the plaza with a fiddler at
//              its edge, one slot left open for you and the Flausellichter drawn to it — V steps in, V on the beat is
//              a hop with notes and a neighbour's heart, off the beat still a step (no fail); walk off to leave
//   greetings  a wave, a happy squint (the lids half down) and a smile; first they say their own name, the second time
//              „Du schon wieder!", from the third „Schön, dich wiederzusehen, ‹Name›!"; one speaker at a time (the
//              others near wave for 6 s); a meeting counts after 1.5 in-game minutes apart
//   palettes   a share of the people get one of eight original natural hair tones (Folk.vary wrapped)
// Save: meta.folk4 = {v: 1, meet: {pid: [n, lastTick]}} (≤ 300 people; F4.load cleans a bad one).
// Pure (node, test/folk4.js): pick · note · newMem · meet · tier · lineKey · fresh · load · step · hairFor · KEYS.
// Cost 🟢: every tier the same logic (a 2-s clock, one moment's few people per frame); the blanket's voxel model is
// drawn Low and up with the creatures' existing program (Very Low: they sit on the grass) — no new GL program.
// Switch: ⚙ Spiel „Kleine Momente im Dorf" (settings.folk4); F4.off for measurements.
// ============================================================================
(function (VR) {
  'use strict';
  const F4 = VR.Folk4 = VR.Folk4 || {};
  const TAU = Math.PI * 2;
  F4.V = 1;
  F4.KINDS = ['tag', 'hide', 'picnic', 'feed', 'dance'];
  // the world clock's windows (env.timeOfDay: 0 sunrise, 6000 noon, 12000 sunset; villages.js: dusk 10600–12300)
  F4.WHEN = { tag: [1000, 10600], hide: [1200, 10400], picnic: [2000, 9900], feed: [800, 10200], dance: [10700, 13000] };
  F4.COOL = { tag: 180, hide: 220, picnic: 280, feed: 240, dance: 600 };   // s between two of a kind
  F4.LEN = { tag: 60, hide: 70, picnic: 60, feed: 40, dance: 75 };          // s a moment lasts
  F4.GAP = 50;   // s between any two moments
  F4.R = 35;     // m: the people a moment borrows are this near you
  const h3 = (a, b, c) => { let x = (a | 0) ^ Math.imul(b | 0, 0x9E3779B1) ^ Math.imul((c | 0) + 0x7F4A7C15, 0x85EBCA77); x ^= x >>> 16; x = Math.imul(x, 0x7FEB352D); x ^= x >>> 15; x = Math.imul(x, 0x846CA68B); x ^= x >>> 16; return x >>> 0; };
  F4.h3 = h3;
  // who a kind needs (c: counts of the free people near you, the animals near)
  F4.need = function (k, c) {
    const grown = (c.adults | 0) + (c.elders | 0);
    switch (k) {
      case 'tag': return c.kids >= 2;
      case 'hide': return c.kids >= 3;
      case 'picnic': return grown >= 2;
      case 'feed': return grown >= 1 && c.animals >= 1;
      case 'dance': return grown >= 3 && grown + (c.kids | 0) >= 4;   // (three dancers or more, the fiddler a grown-up)
      default: return false;
    }
  };
  F4.newMem = () => ({ last: {}, lastAny: -1e9, lastKind: null, dance: {}, slot: 0 });
  // which moment now: ctx {t (s), tod, rain, kids, adults, elders, animals, seed, place, night}; null: none
  F4.pick = function (c, mem) {
    if (!c || !mem || (c.rain || 0) > 0.3) return null;
    if (c.t - mem.lastAny < F4.GAP) return null;
    const cand = [];
    for (const k of F4.KINDS) {
      const w = F4.WHEN[k]; if (c.tod < w[0] || c.tod >= w[1]) continue;
      if (!F4.need(k, c)) continue;
      if (mem.last[k] !== undefined && c.t - mem.last[k] < F4.COOL[k]) continue;
      if (k === 'dance' && mem.dance[c.place] === c.night) continue;
      cand.push(k);
    }
    if (!cand.length) return null;
    if (cand.indexOf('dance') >= 0) return 'dance';
    const fresh = cand.filter(k => k !== mem.lastKind), L = fresh.length ? fresh : cand;
    return L[h3(c.seed, mem.slot, c.place) % L.length];
  };
  F4.note = function (mem, k, t, c) {
    mem.last[k] = t; mem.lastAny = t; mem.lastKind = k; mem.slot++;
    if (k === 'dance' && c) mem.dance[c.place] = c.night;
  };

  // ---------------------------------------------------------------- the greeting memory
  F4.MEET_GAP = 1800;   // ticks (1.5 in-game minutes) between two meetings that count
  F4.MAXP = 300;
  F4.fresh = () => ({ v: F4.V, meet: {} });
  F4.load = function (o) {
    const r = F4.fresh();
    if (!o || typeof o !== 'object' || (o.v | 0) !== F4.V || !o.meet || typeof o.meet !== 'object') return r;
    for (const k of Object.keys(o.meet).slice(-F4.MAXP)) {
      const e = o.meet[k];
      if (Array.isArray(e) && Number.isFinite(e[0]) && e[0] >= 1 && Number.isFinite(e[1])) r.meet[String(k).slice(0, 64)] = [Math.min(999, e[0] | 0), +e[1]];
    }
    return r;
  };
  F4.tier = (n) => (n <= 1 ? 'first' : n === 2 ? 'again' : 'friend');
  // a meeting with person pid at tick t → {n, tier, counted}
  F4.meet = function (rec, pid, t) {
    const M = rec.meet; let e = M[pid], counted = false;
    if (!e) { e = [1, t]; counted = true; }
    else if (t - e[1] >= F4.MEET_GAP) { e = [Math.min(999, e[0] + 1), t]; counted = true; }
    if (counted) {
      delete M[pid]; M[pid] = e;   // (the latest last: the oldest go first when the book is full)
      const ks = Object.keys(M); for (let i = 0; i < ks.length - F4.MAXP; i++) delete M[ks[i]];
    }
    return { n: e[0], tier: F4.tier(e[0]), counted };
  };
  // the line's key: tier, the speaker's seed (+ the meeting), the time of day, a child, the player has a name
  F4.VAR = { 'a.first': 6, 'a.again': 5, 'a.morn': 3, 'a.eve': 3, 'a.friend': 6, 'a.friendN': 4, 'k.first': 4, 'k.again': 4, 'k.friend': 4, 'k.friendN': 4 };
  F4.lineKey = function (tier, seed, tod, kid, named) {
    let w = tier;
    if (tier === 'friend' && !named) w = 'friendN';
    if (!kid && tier === 'again') { if (tod < 3000 || tod >= 23000) w = 'morn'; else if (tod >= 9500 && tod < 13500) w = 'eve'; }
    const k = (kid ? 'k.' : 'a.') + w, n = F4.VAR[k] || 1;
    return 'g.f4.' + k + '.' + ((seed >>> 0) % n);
  };
  F4.KEYS = [];
  for (const k of Object.keys(F4.VAR)) for (let i = 0; i < F4.VAR[k]; i++) F4.KEYS.push('g.f4.' + k + '.' + i);
  // the moments' words
  F4.TEXT_KEYS = ['g.f4.join', 'g.f4.beat', 'g.f4.hint', 'g.f4.leave', 'g.f4.danceEnd', 'g.f4.set', 'g.f4.set.tip'];
  const LINES = { tag: 3, hide: 3, pic: 6, feed: 4, fid: 3, cheer: 3 };
  for (const k of Object.keys(LINES)) for (let i = 0; i < LINES[k]; i++) F4.TEXT_KEYS.push('g.f4.' + k + '.' + i);

  // ---------------------------------------------------------------- the beat (the fiddler's tune)
  F4.BPM = 104;
  F4.step = function (t) { const b = 60 / F4.BPM, q = t / b, ph = (q - Math.round(q)) * b; return Math.abs(ph) <= 0.15 ? 'beat' : 'step'; };

  // ---------------------------------------------------------------- the hair tones (our own: natural shades)
  // honey · copper · chestnut · ash brown · strawberry blond · dark auburn · sand · blue-black
  F4.HAIR = [0xC8923E, 0xB0522A, 0x5E3420, 0x6E5A48, 0xD08A5A, 0x6A2A1E, 0xD8B27A, 0x1E2230];
  F4.hairFor = function (seed) { const x = h3(seed | 0, 31, 4711); return x % 100 < 34 ? F4.HAIR[(x >>> 8) % F4.HAIR.length] : null; };
  const Folk = VR.Folk;
  if (Folk && Folk.vary && !Folk.vary.f4) {
    const bv = Folk.vary;
    Folk.vary = function (fams, style, seed, season) {
      const n = bv.apply(this, arguments);
      if (F4.off || style === 'hall' || (style && String(style).slice(0, 3) === 'sp:')) return n;
      for (const f of fams) for (const m of f.members) {
        const L = m.look; if (!L || L.age === 'elder' || L.species) continue;
        const c = F4.hairFor(m.seed); if (c === null) continue;
        const s = L.skin | 0, d = Math.hypot(((c >> 16) & 255) - ((s >> 16) & 255), ((c >> 8) & 255) - ((s >> 8) & 255), (c & 255) - (s & 255));
        if (d >= 48) L.hair = c;   // (never as brown as the skin: that read as a bald head)
      }
      return n;
    };
    Folk.vary.f4 = true;
  }

  // ---------------------------------------------------------------- the blanket (our own: a checked cloth, a basket)
  const VM = VR.VOXMODELS, Grid = VR.VoxGrid;
  if (VM && Grid && !VM.f4_blanket) {
    VM.f4_blanket = () => {
      const gr = new Grid(32, 6, 22, 16, 0, 11);
      // the cloth 2 m × 1.4 m (1 voxel = 6 cm): a warm red-and-cream check with a darker hem
      for (let z = 0; z < 22; z++) for (let x = 0; x < 32; x++) {
        const a = (x >> 2) & 1, b = (z >> 2) & 1, hem = x === 0 || x === 31 || z === 0 || z === 21;
        gr.set(x, 0, z, hem ? 0xA8342A : a && b ? 0xC8402E : a || b ? 0xE48A76 : 0xF6EEDC, 0);
      }
      // the basket (wicker) with its handle, a loaf, two cups, three strawberries
      gr.box(13, 1, 8, 18, 3, 12, (x, y, z) => ((x + y + z) & 1 ? 0x9A6A3A : 0x7A4E28));
      gr.box(14, 4, 9, 17, 4, 11, 0xE8C890);
      for (const x of [13, 18]) gr.box(x, 4, 10, x, 5, 10, 0x6A4220);
      gr.box(14, 5, 10, 17, 5, 10, 0x6A4220);
      gr.box(5, 1, 6, 9, 2, 8, 0xC88A3E); gr.box(6, 3, 7, 8, 3, 7, 0xD8A050);
      for (const [x, z] of [[23, 6], [24, 15]]) { gr.box(x, 1, z, x + 1, 2, z + 1, 0xF4F4F0); gr.set(x, 3, z, 0x8A5A3A, 0); }
      for (const [x, z] of [[8, 14], [10, 15], [9, 16]]) gr.set(x, 1, z, 0xE0303A, 0);
      return { unit: 16, radius: 1.4, parts: { cloth: { grid: gr, pivot: [0, 0, 0] } }, layout: { cloth: [0, 0, 0] } };
    };
    // the fiddle (1 voxel = 3 cm): a waisted honey-brown body, a dark fingerboard and neck toward −z, a scroll
    VM.f4_fiddle = () => {
      const gr = new Grid(8, 3, 22, 4, 1, 6);
      for (let z = 0; z < 12; z++) {
        const half = z < 2 || z > 9 ? 2.5 : z >= 5 && z <= 6 ? 2 : 3.5;   // (the waist between the two bouts)
        for (let x = 0; x < 8; x++) if (Math.abs(x + 0.5 - 4) <= half) for (let y = 0; y < 2; y++) gr.set(x, y, z, y ? 0xB86A2A : 0x8A4A1E, 0);
      }
      for (let z = 0; z < 22; z++) if (z < 2 || z > 11) gr.box(3, 1, 21 - z, 4, 1, 21 - z, 0x2A1A12);
      gr.box(3, 2, 2, 4, 2, 9, 0x2A1A12);   // the fingerboard over the body
      gr.box(3, 1, 0, 4, 2, 0, 0x5A3418);   // the scroll's end
      for (const x of [2, 5]) gr.set(x, 2, 5, 0x1A120C, 0);   // the sound holes
      return { unit: 32, radius: 0.5, parts: { body: { grid: gr, pivot: [0, 0, 0] } }, layout: { body: [0, 0, 0] } };
    };
  }

  // ================================================================ the game
  const Vs = VR.Villages;
  if (!Vs) return;
  const P = Vs.prototype, R = VR.R, FL = VR.F;
  const T = (k, v) => (VR.I18N ? VR.I18N.t(k, v) : k);
  const tierOf = (g) => (VR.LifeKit && VR.LifeKit.tierOf ? VR.LifeKit.tierOf(g.settings) : 2);
  const pname = (g) => { const n = g.settings && g.settings.playerName; return n && String(n).trim() ? String(n).trim().slice(0, 24) : ''; };
  const ticks = (g) => (g.env.day || 0) * 24000 + (g.env.timeOfDay || 0);
  const d2xz = (a, p) => (a.pos[0] - p[0]) ** 2 + (a.pos[2] - p[2]) ** 2;
  const icon = (a, ch, t) => { a.bubble = { text: ch, t: t || 2.2, icon: true }; };
  const smile = (a, t) => { a.expr = 'joy'; a.exprT = t || 2.5; };
  const yawTo = (a, x, z) => Math.atan2(-(x - a.pos[0]), -(z - a.pos[2]));
  F4.on = (g) => !!(g && !F4.off && g.meta && !g.meta.guest && !(g.mp && g.mp.isClient) && !(g.settings && g.settings.folk4 === false));
  if (VR.Settings && VR.Settings.add && !(VR.Settings.byKey && VR.Settings.byKey('folk4'))) { try { VR.Settings.add({ key: 'folk4', g: 'play', sec: 'play', t: 'switch', lab: 'g.f4.set', tip: 'g.f4.set.tip', def: true }); } catch (e) { /* the settings' own */ } }
  F4.rec = function (g) {
    if (!g || !g.meta) return F4.fresh();
    if (!g.meta.folk4 || g._f4Loaded !== g.meta) { g.meta.folk4 = F4.load(g.meta.folk4); g._f4Loaded = g.meta; }
    return g.meta.folk4;
  };
  F4.auto = true;
  F4.mem = null;
  const memOf = (V) => (F4.mem && F4.mem.w === V.g.world ? F4.mem : (F4.mem = Object.assign(F4.newMem(), { w: V.g.world })));
  F4.active = (V) => (V && V._f4M) || null;
  F4.stats = { begun: {}, greet: 0, words: 0, beats: 0, steps: 0, joined: 0 };

  // ---------------------------------------------------------------- the ground
  const solidAt = (w, x, y, z) => { const s = w.getBlock(x, y, z); return !!(s && (R.T.flags[s] & FL.SOLID)); };
  const wetAt = (w, x, y, z) => { const s = w.getBlock(x, y, z); return !!(s && (R.T.flags[s] & FL.FLUID)); };
  // the floor at column (x, z) near height y (open feet and head, solid below, no water), or null
  // (run 2 of folk4.mjs: a picnic sank into a town's ground layer — a full-looking block that is not SOLID; an open cell
  // is now one with nothing solid, opaque or wet in it)
  const openAt = (w, x, y, z) => { const s = w.getBlock(x, y, z); return !s || !(R.T.flags[s] & (FL.SOLID | FL.OPAQUE | FL.FLUID)); };
  function floorAt(w, x, z, y) {
    const y0 = Math.floor(y);
    for (let yy = y0 + 2; yy >= y0 - 3; yy--) if (solidAt(w, x, yy - 1, z) && openAt(w, x, yy, z) && openAt(w, x, yy + 1, z) && !wetAt(w, x, yy - 1, z)) return yy;
    return null;
  }
  // grass (a meadow, moss, a lawn) under a floor cell: a picnic or a game prefers it to a paved square
  let GREEN = null;
  const greenAt = (w, x, y, z) => {
    if (!GREEN) { GREEN = new Uint8Array(R.types.length + 1); R.types.forEach((t, i) => { if (t && /grass|moss|meadow|lawn|clover/.test(t.name || '') && !/tall|short|fern|tuft/.test(t.name || '')) GREEN[i] = 1; }); }
    const s = w.getBlock(x, y - 1, z); return !!(s && GREEN[R.T.type[s]]);
  };
  // an open place r0…r1 m from (cx, cz), the direction (dir) first, on grass when there is grass; w×d cells open on one
  // floor; → [x, y, z, axis]
  function openSpot(w, cx, cz, y, r0, r1, dir, wide, bad) {
    return openSpot1(w, cx, cz, y, r0, r1, dir, wide, true, bad) || openSpot1(w, cx, cz, y, r0, r1, dir, wide, false, bad);
  }
  function openSpot1(w, cx, cz, y, r0, r1, dir, wide, green, bad) {
    for (let r = r0; r <= r1; r += 1) for (let i = 0; i < 16; i++) {
      const an = dir + (i & 1 ? 1 : -1) * Math.ceil(i / 2) * TAU / 16;
      const x = Math.floor(cx + Math.cos(an) * r), z = Math.floor(cz + Math.sin(an) * r), fy = floorAt(w, x, z, y);
      if (fy === null || (green && !greenAt(w, x, fy, z)) || (bad && bad(x + 0.5, fy, z + 0.5))) continue;
      if (!wide) return [x + 0.5, fy, z + 0.5, 0];
      for (const ax of [0, 1]) {
        let ok = true;
        for (let k = -1; k <= 1 && ok; k++) for (let j = 0; j <= 1 && ok; j++) { const X = x + (ax ? j : k), Z = z + (ax ? k : j); if (floorAt(w, X, Z, fy) !== fy) ok = false; }
        if (ok) return [x + 0.5 + (ax ? 0.5 : 0), fy, z + 0.5 + (ax ? 0 : 0.5), ax];
      }
    }
    return null;
  }
  const BUSY = new Set(['talk', 'joy', 'outing', 'hide', 'fight', 'sleep', 'school', 'gsplay', 'gsvisit', 'festival', 'f4', 'arrive', 'f5look', 'f5hi']);   // (f-folk5: onlookers, a friend's greeting)
  const free = (V, a) => a && a.pos && !a._f4 && !a.guest && !a.inBoat && a.pose !== 'sleep' && a !== V.talking && !a.dance && !(a.act && BUSY.has(a.act.type) && !(a.act.type === 'joy' && (a.act.done || a.act.kind === 'follow'))) && a.drawn !== false;   // (f-folk5: a finished folkjoy act is free — the dancers right after a dance — and a child trailing you joins a game)
  const passive = (m) => m && !m.dead && m.pos && m.def && !m.def.hostile && !m.def.companion && !m.boss && !m.foe;

  // what is near you: the village, its free people within F4.R, the animals within 20 m
  F4.ctxOf = function (V) {
    const g = V.g, p = g.player && g.player.pos; if (!p || !g.env) return null;
    let vil = null, bd = F4.R * F4.R;
    for (const a of V.agents) { const d = d2xz(a, p); if (d < bd && a.vil && a.vil.active !== false) { bd = d; vil = a.vil; } }
    if (!vil) return null;
    const c = { t: V.time, tod: g.env.timeOfDay, rain: g.env.rain || (g.weather && g.weather.rain) || 0, kids: 0, adults: 0, elders: 0, animals: 0,
      seed: (g.seed || (g.meta && g.meta.seed) || 0) | 0, place: h3(vil.id | 0, String(vil.id).length, 5) | 0, night: Math.floor((ticks(g) - 6000) / 24000), vil };
    for (const a of vil.agents) { if (!free(V, a) || d2xz(a, p) > F4.R * F4.R) continue; if (a.kid) c.kids++; else if (a.elder) c.elders++; else c.adults++; }
    const mobs = g.entities && g.entities.mobs;
    if (mobs) for (const m of mobs) if (passive(m) && d2xz(m, p) < 20 * 20) c.animals++;
    return c;
  };

  // ---------------------------------------------------------------- begin / end
  F4.extra = F4.extra || {};   // (f-folk5: more kinds of moment — kind → begin(V, M, pool))
  F4.begin = function (V, vil, kind) {
    const g = V.g; if (!F4.on(g) || V._f4M || !vil) return null;
    const p = g.player.pos;
    const pool = vil.agents.filter(a => free(V, a) && d2xz(a, p) < F4.R * F4.R).sort((x, y) => d2xz(x, p) - d2xz(y, p));
    const M = { kind, t0: V.time, len: F4.LEN[kind] || 60, members: [], vil, t: 0, said: -1e9 };
    const ok = kind === 'tag' || kind === 'hide' ? beginPlay(V, M, pool) : kind === 'picnic' ? beginPicnic(V, M, pool) : kind === 'feed' ? beginFeed(V, M, pool) : kind === 'dance' ? beginDance(V, M, pool) : F4.extra[kind] ? F4.extra[kind](V, M, pool) : false;   // (f-folk5: F4.extra — the Laternenzug, folk5.js)
    if (!ok) { for (const a of M.members) { a._f4 = null; if (a.act && a.act.type === 'f4') { a.act = null; a.thinkT = 0; } } return null; }
    V._f4M = M;
    for (const a of M.members) a.talkCool = Math.max(a.talkCool || 0, 1e6);   // (nobody pulls them into a chat meanwhile: villages.js social)
    const c = F4.ctxOf(V) || { place: 0, night: 0 };
    F4.note(memOf(V), kind, V.time, c);
    F4.stats.begun[kind] = (F4.stats.begun[kind] | 0) + 1;
    return M;
  };
  // (f-folk5: robust — every member AND every agent still marked by this moment is let go, each on its own (one that
  // throws does not keep the others), the area, the dance and the lure cleared whatever happens; folk4.mjs run 1: the
  // dance did not begin after the greeting)
  const release = (a) => {
    a._f4 = null; a.f4fiddle = false; a.f4feed = false; if (a.talkCool > 1e5) a.talkCool = 2;
    if (a.act && (a.act.type === 'f4' || a.act.type === 'play')) { a.act = null; a.thinkT = 0; }
    if (a.pose === 'sitground' || a.pose === 'crouch') a.pose = 'stand';
    a.lookAt = null; a.steer = null;
  };
  F4.release = release;
  F4.end = function (V, M) {
    M = M || V._f4M; if (!M) return;
    const vil = M.vil;
    try {
      if (vil && (M.kind === 'tag' || M.kind === 'hide')) { if (vil._f4area) vil._f4area = null; if (vil.game) vil.game.until = 0; }
      if (M.kind === 'dance') {
        const D = V.joy && V.joy.dance;
        if (D && D === M.D) { for (const o of D.members) { try { if (o.act && o.act.type === 'joy' && V.joyEnd) { V.joyEnd(o); o.act = null; o.thinkT = 0; } } catch (e) { /* the next */ } } V.joy.dance = null; }
        M.joined = false;
      }
    } catch (e) { /* the rest below still runs */ }
    if (VR.Dusk && VR.Dusk.lure && (M.kind === 'dance' || M.lure)) VR.Dusk.lure = null;
    if (vil && vil._f4area && (M.kind === 'tag' || M.kind === 'hide')) vil._f4area = null;
    const all = new Set(M.members);
    if (vil && vil.agents) for (const a of vil.agents) if (a._f4 === M) all.add(a);
    for (const a of all) { try { release(a); } catch (e) { a._f4 = null; } }
    if (V._f4M === M) V._f4M = null;
    // (nicht vor deinen Augen: a laid blanket folds away softly — drawn fading out until it is gone)
    if (M.kind === 'picnic' && M.laid && M.spot && VR.Appear) { VR.Appear.out(M.laid); F4.folding = { spot: M.spot, yaw: M.yaw, laid: M.laid }; }
  };
  // (f-folk5) everything off: the moment, a stray folkjoy dance, marks whose moment is gone, other fronts' extras
  // (F4.onClear) — the browser test calls it before each moment; the game never needs it
  F4.onClear = [];
  F4.clear = function (V) {
    if (!V) return;
    if (V._f4M) F4.end(V, V._f4M);
    const D = V.joy && V.joy.dance;
    if (D) { for (const o of D.members) { try { if (o.act && o.act.type === 'joy' && V.joyEnd) { V.joyEnd(o); o.act = null; o.thinkT = 0; } } catch (e) { /* the next */ } } V.joy.dance = null; }
    for (const a of V.agents || []) if (a._f4 || (a.act && a.act.type === 'f4')) { try { release(a); } catch (e) { a._f4 = null; } }
    for (const vil of new Set((V.agents || []).map(a => a.vil))) if (vil && vil._f4area) vil._f4area = null;
    if (VR.Dusk && VR.Dusk.lure) VR.Dusk.lure = null;
    for (const f of F4.onClear) { try { f(V); } catch (e) { /* its own */ } }
  };
  const say = (V, a, key, vars, dur) => { if (V.near && !V.near(a, 26)) return; a.say(T(key, vars), dur || 3); };

  // the children: folklife's game in the yard near you
  function beginPlay(V, M, pool) {
    const g = V.g, p = g.player.pos, vil = M.vil, kids = pool.filter(a => a.kid).slice(0, 4);
    if (kids.length < (M.kind === 'hide' ? 3 : 2)) return false;
    const pz = vil.plan.plaza, dp = Math.hypot(pz.x + 0.5 - p[0], pz.z + 0.5 - p[2]);
    const dir = Math.atan2(pz.z + 0.5 - p[2], pz.x + 0.5 - p[0]);
    const sp = dp < 10 ? [pz.x + 0.5, pz.y, pz.z + 0.5] : openSpot(g.world, p[0], p[2], p[1], 5, 9, dir, false);
    if (!sp) return false;
    vil._f4area = { cx: sp[0], cz: sp[2], y: sp[1], R: 6 };
    vil.game = { type: M.kind, until: V.time + M.len, it: null, seeker: null, phase: 'count', t0: V.time, found: new Set(), spots: new Map(), lastN: 0 };
    for (const k of kids) { V.setAct(k, { type: 'play' }); k._f4 = M; M.members.push(k); }
    const k0 = kids[0]; say(V, k0, 'g.f4.' + M.kind + '.' + (k0.p.seed % 3), null, 2.6); smile(k0, 3);
    return true;
  }
  const bpa = P.playArea;
  P.playArea = function (vil) { return vil._f4area || bpa.call(this, vil); };

  // two neighbours on a blanket
  // nicht vor deinen Augen (test/appear.js e): the blanket is laid when one of its two reaches the spot (within 1.6 m) —
  // or at once where you do not look; then it fades in (lifekit.js VR.Appear). → the draw factor 0..1
  F4.blanketK = function (M, g) {
    if (!M.laid) {
      const near = M.members.some(o => o && o.pos && Math.hypot(o.pos[0] - M.spot[0], o.pos[2] - M.spot[2]) < 1.6);
      if (!near && VR.Appear && VR.Appear.seen(g, M.spot[0], M.spot[1] + 0.3, M.spot[2], 1.5)) return 0;
      M.laid = {};
    }
    return VR.Appear ? VR.Appear.k(M.laid) : 1;
  };
  function beginPicnic(V, M, pool) {
    const g = V.g, p = g.player.pos, vil = M.vil, grown = pool.filter(a => !a.kid);
    if (grown.length < 2) return false;
    const a = grown[0], b = grown.slice(1).find(o => o.p.fam !== a.p.fam) || grown[1];
    const pz = vil.plan.plaza, dir = Math.atan2(pz.z + 0.5 - p[2], pz.x + 0.5 - p[0]) + 0.8;
    // v0.56.2: the blanket by the plaza, on the villagers' own ground — no longer 5–12 blocks from you (on a roof, a
    // hill or in flight that put it in odd places, and right before your eyes); never closer than 7 blocks to you
    const bad = (x, y, z) => Math.hypot(x - p[0], z - p[2]) < 7;
    const sp = openSpot(g.world, pz.x + 0.5, pz.z + 0.5, a.pos[1], 4, 16, dir, true, bad);
    if (!sp) return false;
    M.spot = [sp[0], sp[1], sp[2]]; M.ax = sp[3]; M.yaw = sp[3] ? Math.PI / 2 : 0;
    // the seats: either end of the long side, facing each other
    const off = 0.62;
    M.seats = sp[3] ? [[sp[0], sp[2] - off], [sp[0], sp[2] + off]] : [[sp[0] - off, sp[2]], [sp[0] + off, sp[2]]];
    [a, b].forEach((o, i) => { V.setAct(o, { type: 'f4', role: 'pic', k: i }); o._f4 = M; M.members.push(o); });
    return true;
  }
  function runPicnic(V, a, act, dt) {
    const M = a._f4, s = M.seats[act.k], o = M.seats[1 - act.k];
    if (a.pose !== 'sitground') {
      const d = Math.hypot(s[0] - a.pos[0], s[1] - a.pos[2]);
      const there = d < 0.6 || V.goTo(a, Math.floor(s[0]), M.spot[1], Math.floor(s[1]), 0.6) || (act.t > 15 && d < 3) || (act.t > 28 && !(VR.Appear && (VR.Appear.seen(V.g, a.pos[0], a.pos[1] + 1, a.pos[2], 1) || VR.Appear.seen(V.g, s[0], M.spot[1] + 1, s[1], 1))));   // (nicht vor deinen Augen: no hop to the seat where you look)
      if (!there) return;
      a.pos[0] = s[0]; a.pos[1] = M.spot[1]; a.pos[2] = s[1]; a.vel[0] = 0; a.vel[2] = 0; a.path = null; a.steer = null;
      a.pose = 'sitground'; smile(a, 3);
    }
    a.yaw = yawTo(a, o[0], o[1]);
    const other = M.members[1 - act.k];
    if (other) a.lookAt = [other.pos[0], other.pos[1] + 0.8, other.pos[2]];
    // they chat in turns, now and then a heart
    if (other && other.pose === 'sitground' && V.time - M.said > 6.5 && act.k === (M.turn | 0)) {
      M.said = V.time; M.turn = 1 - (M.turn | 0);
      say(V, a, 'g.f4.pic.' + ((a.p.seed + (M.n = (M.n | 0) + 1)) % 6), null, 3.2);
      smile(a, 3); if ((M.n % 3) === 0 && V.hearts) V.hearts(other);
    }
  }

  // an elder feeds the animals
  function beginFeed(V, M, pool) {
    const g = V.g, p = g.player.pos, mobs = g.entities && g.entities.mobs; if (!mobs) return false;
    const an = mobs.filter(m => passive(m) && d2xz(m, p) < 20 * 20).sort((x, y) => d2xz(x, p) - d2xz(y, p)).slice(0, 4);
    if (!an.length) return false;
    const f = pool.find(a => a.elder) || pool.find(a => !a.kid); if (!f) return false;
    let cx = 0, cz = 0; for (const m of an) { cx += m.pos[0]; cz += m.pos[2]; } cx /= an.length; cz /= an.length;
    const dir = Math.atan2(f.pos[2] - cz, f.pos[0] - cx);
    const sp = openSpot(g.world, cx, cz, an[0].pos[1], 2, 5, dir, false); if (!sp) return false;
    M.spot = [sp[0], sp[1], sp[2]]; M.animals = an; M.toward = [cx, cz];
    V.setAct(f, { type: 'f4', role: 'feed' }); f._f4 = M; M.members.push(f);
    return true;
  }
  function runFeed(V, a, act) {
    const M = a._f4, s = M.spot, g = V.g;
    if (!act.there) {
      const d = Math.hypot(s[0] - a.pos[0], s[2] - a.pos[2]);
      if (!(d < 0.7 || V.goTo(a, Math.floor(s[0]), s[1], Math.floor(s[2]), 0.7) || (act.t > 18 && d < 3) || act.t > 30)) return;
      act.there = true; a.vel[0] = 0; a.vel[2] = 0; a.path = null; a.steer = null; M.feedAt = V.time;
      say(V, a, 'g.f4.feed.' + (a.p.seed % 4), null, 3); smile(a, 3);
    }
    a.pose = 'crouch'; a.f4feed = true;
    a.yaw = yawTo(a, M.toward[0], M.toward[1]);
    if (V.time - (act.grain || 0) > 0.5 && g.particles && g.particles.spawn) {
      act.grain = V.time;
      const fx = a.pos[0] - Math.sin(a.yaw) * 0.6, fz = a.pos[2] - Math.cos(a.yaw) * 0.6;
      for (let i = 0; i < 4; i++) g.particles.spawn(fx + (Math.random() - 0.5) * 0.5, a.pos[1] + 0.6, fz + (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.8, 0.6, (Math.random() - 0.5) * 0.8, { life: 0.9, size: 0.05, col: [0.92, 0.8, 0.45] });
    }
    if (V.time - M.said > 10 && act.there) { M.said = V.time; if (Math.random() < 0.5) say(V, a, 'g.f4.feed.' + ((a.p.seed + (M.n = (M.n | 0) + 1)) % 4), null, 2.8); }
  }
  // the animals come to the feeder (wildheart's families walk there; others are nudged)
  function feedAnimals(V, M, dt) {
    const f = M.members[0]; if (!f || !f._f4 || !f.act || !f.act.there) return;
    const fx = f.pos[0] - Math.sin(f.yaw) * 1.1, fz = f.pos[2] - Math.cos(f.yaw) * 1.1;
    M.animals.forEach((m, i) => {
      if (!passive(m)) return;
      const an = f.yaw + Math.PI / 2 + (i - (M.animals.length - 1) / 2) * 0.7;
      const tx = fx + Math.cos(an) * 0.5 * (i & 1 ? 1 : -1), tz = fz + Math.sin(an) * 0.5 * (i & 1 ? 1 : -1);
      const h = m.wh;
      if (h) { if (h.mode !== 'wait' || Math.hypot(tx - m.pos[0], tz - m.pos[2]) > 1) { h.mode = 'visit'; h.cover = [tx, tz]; } h.thinkT = Math.max(h.thinkT || 0, 1.5); return; }
      const dx = tx - m.pos[0], dz = tz - m.pos[2], d = Math.hypot(dx, dz);
      if (d > 0.35) { const sp = Math.min(1.1, d) * dt; m.pos[0] += dx / d * sp; m.pos[2] += dz / d * sp; m.yaw = Math.atan2(-dx, -dz); }
      else m.yaw = Math.atan2(-(f.pos[0] - m.pos[0]), -(f.pos[2] - m.pos[2]));
    });
  }

  // the dusk dance: folkjoy's ring (folk3's floor), one slot open for you, a fiddler at the edge
  function beginDance(V, M, pool) {
    const g = V.g, p = g.player.pos, vil = M.vil;
    const grown = pool.filter(a => !a.kid); if (grown.length < 3 || !V.joyState || !V.joyBegin) return false;
    if (V.joy && V.joy.dance) return false;
    const fid = grown.find(a => a.elder) || grown[grown.length - 1];
    const dancers = grown.filter(a => a !== fid).slice(0, 6).concat(pool.filter(a => a.kid).slice(0, 2));
    if (dancers.length < 3) return false;
    const pz = vil.plan.plaza, dp = Math.hypot(pz.x + 0.5 - p[0], pz.z + 0.5 - p[2]);
    const c = dp < 30 ? [pz.x + 0.5, pz.y, pz.z + 0.5] : [p[0] + Math.cos(g.player.yaw || 0) * 4, p[1], p[2] + Math.sin(g.player.yaw || 0) * 4];
    const D = V.joyState().dance = { t: 0, len: M.len, c, phase: Math.atan2(p[2] - c[2], p[0] - c[0]) - (dancers.length) * TAU / (dancers.length + 1), n: dancers.length + 1, members: dancers, f4: true };
    if (V.f3Ring) V.f3Ring(D, vil);
    if (!D.r) { D.r = 2.5; D.w = 0.22; }
    // (the open slot — the last index — faces you at the start: the phase above puts it on your side)
    dancers.forEach((o, i) => { V.joyBegin(o, 'dancer', { idx: i, len: M.len + 1 }); smile(o, 4); });
    M.D = D; M.members = dancers.slice(); M.fiddler = fid;
    // the fiddler: outside the ring across from you, on open ground
    const away = Math.atan2(c[2] - p[2], c[0] - p[0]);
    let fs = null;
    for (let i = 0; i < 12 && !fs; i++) {
      const an = away + (i & 1 ? 1 : -1) * Math.ceil(i / 2) * 0.45, r = D.r + 1.4;
      const x = D.c[0] + Math.cos(an) * r, z = D.c[2] + Math.sin(an) * r, fy = floorAt(g.world, Math.floor(x), Math.floor(z), D.c[1]);
      if (fy !== null && Math.abs(fy - D.c[1]) <= 1) fs = [x, fy, z];
    }
    if (!fs) fs = [D.c[0] + Math.cos(away) * (D.r + 1.4), D.c[1], D.c[2] + Math.sin(away) * (D.r + 1.4)];
    M.fspot = fs;
    V.setAct(fid, { type: 'f4', role: 'fid' }); fid._f4 = M; M.members.push(fid);
    say(V, fid, 'g.f4.fid.' + (fid.p.seed % 3), null, 3.4); smile(fid, 4);
    if (VR.Dusk) VR.Dusk.lure = [D.c[0], D.c[1], D.c[2]];
    return true;
  }
  function runFiddle(V, a, act, dt) {
    const M = a._f4, s = M.fspot, D = M.D;
    const d = Math.hypot(s[0] - a.pos[0], s[2] - a.pos[2]);
    if (!act.there) {
      if (d > 0.5 && !(act.t > 20 && d < 2.5)) {
        if (d > 2.5) { a.steer = null; V.goTo(a, Math.floor(s[0]), s[1], Math.floor(s[2]), 0.4); } else { a.path = null; a.steer = a.steer || [0, 0]; a.steer[0] = s[0]; a.steer[1] = s[2]; }
        act.run = d > 4; return;
      }
      act.there = true;
    }
    a.steer = null; a.path = null; a.vel[0] = 0; a.vel[2] = 0; act.run = false;
    const k = Math.min(1, dt * 6); a.pos[0] += (s[0] - a.pos[0]) * k; a.pos[2] += (s[2] - a.pos[2]) * k;
    a.yaw = yawTo(a, D.c[0], D.c[2]); a.pose = 'stand'; a.f4fiddle = true;
    a.lookAt = [D.c[0], a.pos[1] + 1.3, D.c[2]];
    const g = V.g;
    if (g.particles && g.particles.spawn && Math.random() < dt * 1.4) g.particles.spawn(a.pos[0] + (Math.random() - 0.5) * 0.5, a.pos[1] + 2.0, a.pos[2] + (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.3, 0.8, (Math.random() - 0.5) * 0.3, { life: 1.6, size: 0.08, grav: 0, col: [1, 0.85, 0.4] });
    if (!a.bubble && Math.random() < dt * 0.25) icon(a, '♪', 1.6);
  }
  // the open slot (the dance's last index) where you dance
  F4.slotPos = function (V) {
    const M = V._f4M, D = M && M.D; if (!D) return null;
    const an = D.phase + (D.n - 1) * TAU / D.n + D.t * (D.w || 0);
    return [D.c[0] + Math.cos(an) * D.r, D.c[2] + Math.sin(an) * D.r];
  };
  F4.joined = (V) => !!(V && V._f4M && V._f4M.joined);
  F4.clock = (V) => V.time;
  F4.join = function (V) {
    const M = V && V._f4M; if (!M || M.kind !== 'dance' || !M.D || M.joined) return false;
    M.joined = true; M.moveT = 0; F4.stats.joined++;
    const g = V.g;
    if (VR.Quiet && VR.Quiet.note) VR.Quiet.note(T('g.f4.hint'), 1, 'f4.hint'); else if (g.ui && g.ui.hint) g.ui.hint(T('g.f4.hint'), 3500);
    const n = M.D.members[0]; if (n) { smile(n, 3); if (V.hearts) V.hearts(n); }
    return true;
  };
  F4.leave = function (V) { const M = V && V._f4M; if (!M || !M.joined) return; M.joined = false; const g = V.g; if (VR.Quiet && VR.Quiet.note) VR.Quiet.note(T('g.f4.leave'), 1, 'f4.leave'); else if (g.ui && g.ui.hint) g.ui.hint(T('g.f4.leave'), 2500); };
  // V while dancing: on the beat a hop, notes and a neighbour's heart; off the beat still a step
  F4.press = function (V, t) {
    const M = V && V._f4M; if (!M || !M.joined) return null;
    const r = F4.step(t === undefined ? V.time : t), g = V.g, pl = g.player;
    if (r === 'beat') {
      F4.stats.beats++; M.beats = (M.beats | 0) + 1;
      if (pl.onGround && pl.vel) pl.vel[1] = Math.max(pl.vel[1] || 0, 4.2);
      const D = M.D; let best = null, bd = 1e9; for (const o of D.members) { const d = d2xz(o, pl.pos); if (d < bd) { bd = d; best = o; } }
      if (best) { smile(best, 2.5); if (M.beats % 4 === 1 && V.hearts) V.hearts(best); if (M.beats % 6 === 3) say(V, best, 'g.f4.cheer.' + (M.beats % 3), null, 2.2); }
      if (g.audio && g.audio.tone) { try { g.audio.tone(784, 0.04, 0.12, 'triangle', true); } catch (e) { /* no sound */ } }
    } else F4.stats.steps++;
    if (g.particles && g.particles.spawn) for (let i = 0; i < (r === 'beat' ? 6 : 2); i++) g.particles.spawn(pl.pos[0] + (Math.random() - 0.5) * 0.6, pl.pos[1] + 1.9, pl.pos[2] + (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, 1.0, (Math.random() - 0.5) * 0.6, { life: 1.2, size: 0.08, grav: 0, col: r === 'beat' ? [1, 0.8, 0.95] : [0.8, 0.9, 1] });
    return r;
  };
  function dancePlayer(V, M, dt) {
    const g = V.g, pl = g.player, s = F4.slotPos(V); if (!s) return;
    const I = g.input, mv = I && I.down && (I.down('KeyW') || I.down('KeyA') || I.down('KeyS') || I.down('KeyD'));
    M.moveT = mv ? (M.moveT || 0) + dt : 0;
    if (M.moveT > 0.4 || Math.hypot(pl.pos[0] - M.D.c[0], pl.pos[2] - M.D.c[2]) > M.D.r + 6) { F4.leave(V); return; }
    const k = Math.min(1, dt * 8); pl.pos[0] += (s[0] - pl.pos[0]) * k; pl.pos[2] += (s[1] - pl.pos[2]) * k;
  }

  // ---------------------------------------------------------------- the frame (villages' update)
  F4.sw = { frame: true, draw: true };   // (the cost measure's switches: the frame hook, the blanket's draw)
  F4.frame = function (V, dt) {
    const g = V.g; if (!g || !g.player || !g.env || !F4.sw.frame) return;
    const M = V._f4M;
    if (M) {
      M.t = V.time - M.t0;
      const p = g.player.pos;
      const gone = M.members.some(a => !a.vil || !a.vil.agents || a.vil.agents.indexOf(a) < 0);
      const far = Math.hypot(p[0] - (M.spot ? M.spot[0] : M.D ? M.D.c[0] : p[0]), p[2] - (M.spot ? M.spot[2] : M.D ? M.D.c[2] : p[2])) > 90;
      if (!F4.on(g) || gone || far || M.t > M.len + 1 || (M.kind === 'dance' && (!V.joy || V.joy.dance !== M.D))) {
        if (M.kind === 'dance' && M.fiddler && !gone) { say(V, M.fiddler, 'g.f4.danceEnd', null, 3); smile(M.fiddler, 3); if (V.hearts) V.hearts(M.fiddler); }
        F4.end(V, M); return;
      }
      if (M.kind === 'feed') feedAnimals(V, M, dt);
      if (M.kind === 'dance') { if (M.joined) dancePlayer(V, M, dt); if (VR.Dusk) VR.Dusk.lure = [M.D.c[0], M.D.c[1], M.D.c[2]]; }
      return;
    }
    if (!F4.auto || !F4.on(g)) return;
    if ((V._f4clk = (V._f4clk || 0) - dt) > 0) return;
    V._f4clk = 2;
    if (VR.Regie && VR.Regie.of && VR.Regie.of(g)) return;   // (the Regie asks the source below)
    const c = F4.ctxOf(V); if (!c) return;
    const k = F4.pick(c, memOf(V)); if (k) F4.begin(V, c.vil, k);
  };
  if (VR.Regie && VR.Regie.addSource) VR.Regie.addSource(function folk4Offer(g) {
    const V = g && g.villages; if (!V || !F4.auto || !F4.on(g) || V._f4M) return null;
    const c = F4.ctxOf(V); if (!c) return null;
    const k = F4.pick(c, memOf(V)); if (!k) return null;
    return [{ source: 'folk4', act: 'folk4_' + k, weight: 2, kind: 'folk', place: c.place, eta: 0, start: () => !!F4.begin(V, c.vil, k) }];
  });

  // ---------------------------------------------------------------- the villages' hooks (additive)
  const bUpdate = P.update;
  P.update = function (dt) { bUpdate.call(this, dt); try { F4.frame(this, dt); } catch (e) { if (!F4.warned) { F4.warned = true; console.warn('folk4', e); } } };
  const bThink = P.think, bRun = P.runAct, bSocial = P.social;
  if (bThink) P.think = function (a, tod) {
    if (a._f4) { if (this.danger && this.danger(a)) { F4.end(this, a._f4); return bThink.apply(this, arguments); } return; }
    return bThink.apply(this, arguments);
  };
  if (bRun) P.runAct = function (a, dt, tod) {
    if (a.act && a.act.type === 'f4') {
      if (!a._f4) { a.act = null; return; }
      a.act.t = (a.act.t || 0) + dt;
      try { if (a.act.role === 'pic') runPicnic(this, a, a.act, dt); else if (a.act.role === 'feed') runFeed(this, a, a.act, dt); else if (a.act.role === 'fid') runFiddle(this, a, a.act, dt); }
      catch (e) { F4.end(this, a._f4); }
      return;
    }
    return bRun.apply(this, arguments);
  };
  // (a member's act is the moment's: the day's plan, an outing or a chat do not take it — danger still does)
  const bSet = P.setAct;
  if (bSet) P.setAct = function (a, act) { if (a && a._f4 && act && act.type !== 'hide' && act.type !== 'fight') return; return bSet.apply(this, arguments); };
  if (bSocial) P.social = function (a) { if (a._f4) return; return bSocial.apply(this, arguments); };
  // the bodies: the fiddler bows, the feeder scatters grain
  const bPose = P.pose;
  if (bPose) P.pose = function (a, t) {
    const Q = bPose.apply(this, arguments);
    if (!Q || (!a.f4fiddle && !a.f4feed)) return Q;
    const set = (part, rx, ry, rz) => { const o = Q[part] || [0, 0, 0, 0, 0, 0]; Q[part] = [rx, ry, rz, o[3] || 0, o[4] || 0, o[5] || 0]; };
    if (a.f4fiddle && a.pose === 'stand') {
      const k = (a.p.seed % 5) * 0.7, bow = Math.sin(t * TAU * F4.BPM / 120 + k);
      set('arm_l', 1.45, 0.55, 0.75);             // the fiddle's neck held out, the body under the chin
      set('arm_r', 1.05 + bow * 0.12, -0.35, -0.55 + bow * 0.4);   // the bow across the strings
      if (Q.head) { Q.head[2] = 0.28; Q.head[0] = -0.05 + Math.abs(Math.sin(t * Math.PI * F4.BPM / 60)) * 0.08; }
    } else if (a.f4feed && a.pose === 'crouch') {
      set('arm_r', 0.9 + Math.max(0, Math.sin(t * 5 + a.p.seed)) * 0.6, 0, -0.25);
    }
    return Q;
  };

  // ---------------------------------------------------------------- the greetings
  F4.squinting = (V, a) => !!(a && V && a.f4sq > V.time);
  F4.lastWords = -1e9;
  F4.hello = function (V, a, quiet) {
    const g = V && V.g; if (!F4.on(g) || !a || !a.p || !a.vil || !g.env) return false;
    if (V.talking || (g.ui && g.ui.blocking)) return false;
    const rec = F4.rec(g), pid = (g.dim || 'overworld') + '/' + a.p.id, r = F4.meet(rec, pid, ticks(g)), p = g.player.pos;
    a.greeted = true; a.waveT = Math.max(a.waveT || 0, 1.4); a.f4sq = V.time + 1.8; smile(a, 3);
    a.lookAt = [p[0], p[1] + 1.5, p[2]];
    F4.stats.greet++;
    if (quiet || a.bubble || V.time - (V._f4words === undefined ? -1e9 : V._f4words) < 6) return true;   // (one speaker at a time: the others wave)
    V._f4words = V.time;
    const nm = pname(g), key = F4.lineKey(r.tier, (a.p.seed >>> 0) + r.n * 7, g.env.timeOfDay, !!a.kid, !!nm);
    a.say(T(key, { me: a.p.name || '', name: nm }), 3.4);
    a.talkCool = Math.max(a.talkCool || 0, 5);
    F4.stats.words++;
    return true;
  };
  const G0 = VR.Gossip || (VR.Gossip = {});
  if (!G0.f4) {
    const bh = G0.hello;
    G0.hello = function (V, a) {
      if (bh && bh.apply(this, arguments)) { try { F4.hello(V, a, true); } catch (e) { /* the gossip's word stands */ } return true; }
      try { return F4.hello(V, a); } catch (e) { return false; }
    };
    G0.f4 = true;
  }
  // the happy squint on the smooth people (folk3's lids: half down)
  const F3 = VR.Folk3;
  if (F3 && F3.drawOpts && !F3.drawOpts.f4) {
    const bd = F3.drawOpts;
    F3.drawOpts = function (a, o, d2) {
      bd.apply(this, arguments);
      const V = VR.game && VR.game.villages;
      if (V && a.f4sq > V.time && o && o.hide && o.hide.lids && !a.ffar && !a.blinkOn && a.pose !== 'sleep') { o.hide.lids = false; o.lidUp = 2 * (1 - 0.5) * (a.kid ? 0.515 : 0.54); }
      return o;
    };
    F3.drawOpts.f4 = true;
  }

  // ---------------------------------------------------------------- the blanket's draw (Low and up)
  const bDraw = P.draw;
  if (bDraw) P.draw = function (r, E, cam) {
    bDraw.call(this, r, E, cam);
    const Fd = F4.folding;
    if (Fd && VR.Appear && VR.LifeKit && this.g.entities && this.g.entities.beginVox) {
      if (VR.Appear.gone(Fd.laid)) F4.folding = null;
      else { const AP = VR.Appear, c0 = AP.cur; AP.cur = AP.k(Fd.laid); try { VR.LifeKit.drawModel(this.g, r, this.g.entities.beginVox(r, E), 'f4_blanket', [Fd.spot[0], Fd.spot[1] + 0.005, Fd.spot[2]], Fd.yaw, cam); } finally { AP.cur = c0; } }
    }
    const M = this._f4M; if (!M || !VR.LifeKit || F4.off || !F4.sw.draw) return;
    const g = this.g, ent = g.entities; if (!ent || !ent.beginVox || tierOf(g) < 1) return;
    if (M.kind === 'picnic' && M.spot) {
      if ((M.spot[0] - cam.x) ** 2 + (M.spot[2] - cam.z) ** 2 > 60 * 60) return;
      const k = F4.blanketK(M, this.g);
      if (k <= 0) return;
      const prog = ent.beginVox(r, E), AP = VR.Appear, c0 = AP ? AP.cur : 1;
      if (AP) AP.cur = k;
      try { VR.LifeKit.drawModel(g, r, prog, 'f4_blanket', [M.spot[0], M.spot[1] + 0.005, M.spot[2]], M.yaw, cam); } finally { if (AP) AP.cur = c0; }
    } else if (M.kind === 'dance' && M.fiddler && M.fiddler.f4fiddle) {
      // the fiddle under the chin at the left shoulder, its neck out to the front left (drawn beside the bow arm's pose)
      const a = M.fiddler; if ((a.pos[0] - cam.x) ** 2 + (a.pos[2] - cam.z) ** 2 > 40 * 40) return;
      const y = a.yaw, sc = a.kid ? 0.82 : 1, fx = -Math.sin(y), fz = -Math.cos(y), lx = -Math.cos(y), lz = Math.sin(y);
      const P0 = F4._fp || (F4._fp = [0, 0, 0]);
      P0[0] = a.pos[0] + (fx * 0.2 + lx * 0.16) * sc; P0[1] = a.pos[1] + 1.3 * sc; P0[2] = a.pos[2] + (fz * 0.2 + lz * 0.16) * sc;
      const O = F4._fo || (F4._fo = { roll: 0.35, pitch: 0.12, scale: 1 });
      const prog = ent.beginVox(r, E);
      VR.LifeKit.drawModel(g, r, prog, 'f4_fiddle', P0, y + 0.55, cam, O);
    }
  };

  // ---------------------------------------------------------------- the Aktion key (ctx.js): step in, sway to the beat
  if (VR.Ctx && VR.Ctx.hooks && Array.isArray(VR.Ctx.hooks.near)) VR.Ctx.hooks.near.push((g, eye, dir) => {
    const V = g && g.villages, M = V && V._f4M; if (!M || M.kind !== 'dance' || !M.D) return null;
    const D = M.D, p = g.player.pos;
    if (M.joined) return { kind: 'fairy', name: T('g.f4.beat'), pos: [eye[0] + dir[0] * 1.2, eye[1] + dir[1] * 1.2, eye[2] + dir[2] * 1.2], r: 1.2, act: (gg) => { F4.press(gg.villages); } };
    if (Math.hypot(p[0] - D.c[0], p[2] - D.c[2]) > D.r + 5) return null;
    return { kind: 'fairy', name: T('g.f4.join'), pos: [D.c[0], D.c[1] + 1, D.c[2]], r: D.r + 0.6, act: (gg) => { F4.join(gg.villages); } };
  });
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
