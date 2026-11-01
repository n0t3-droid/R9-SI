// ============================================================================
// a-fairy · VR.Fairy — fairy-tale wonder and gentle adventure in the open world (plan
// docs/superpowers/plans/2026-10-31-a-fairy.md). Found by walking, never by a menu:
//   the places  Leuchtpilzwald (glowing mushrooms, fireflies that follow you at dusk) · Wunschquelle (a crystal spring,
//               a small wish a day) · Schlummerbaum (a sleeping giant tree, a round door, a tiny folk village on its
//               roots) · Mondsteinkreis (standing stones, little spirits dancing on clear nights) · Schwebegarten (a
//               floating garden, a cloud bridge at sunrise). Herzwelt has all five, every other world two or three, on a
//               ring 70–240 m round the point where you first stood on that world (meta.fairy.o[dim]).
//   the folk    the Flausel, our own: a round seed-body, a leaf cap, a glowing feeler, two tiny wings — Tüpfel (shy),
//               Zwirbel (cheeky), Dusel (sleepy), Silbrin (wise), Flöckchen (a lost little spirit), Mutter Borke (the
//               tree's elder). Each speaks in one small bubble over the head; [V] (the Aktion key, ctx.js) talks.
//   adventures  lanterns · lost · bridge · riddle · hat — no violence; builders can light the tree with three lamps.
//   rewards     the Märchen-Bauset (existing decor blocks: Bauhand ★ and stacks) · the companion light (⚙ Feenbegleiter)
//               · Wanderbuch pages (meta.fairy.pages; VR.Wander.register when o-wander's director is there) · Heliataler
//               in Abenteuer (VR.Adventure.award('quest')).
// Presentation only: no block is placed, nothing collides but the garden's top (the player stands on it), the generator
// and every saved chunk stay as they are. Pure part (node, test/fairy.js): sites, best, shrooms, lanternSpots, ADV, Q, load.
// Cost: ⚙ Grafik „Märchenorte" (fairy). Farther than 260 m from every place: one distance test every 0.5 s. Near one: its
// models (one instanced draw per part), ≤ 32 one-frame particles (Very Low: ≤ 10, no ground motes).
// ============================================================================
(function (VR) {
  'use strict';
  const F = VR.Fairy = {};
  const TAU = Math.PI * 2;
  const fill = (s, v) => String(s).replace(/\{(\w+)\}/g, (m, n) => (v && v[n] !== undefined ? v[n] : m));
  const T = (k, v) => (VR.I18N ? VR.I18N.t(k, v) : k);
  const isRec = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
  // a hash of up to four integers in [0, 1)
  const h = F.h = function (a, b, c, d) {
    let x = Math.imul((a | 0) ^ 0x6a09e667, 0x85ebca6b) ^ Math.imul((b | 0) + 0x3c6ef372, 0xc2b2ae35) ^ Math.imul((c | 0) + 0x5be0cd19, 0x27d4eb2f) ^ Math.imul((d | 0) + 0x1f83d9ab, 0x165667b1);
    x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d); x ^= x >>> 12; x = Math.imul(x, 0x297a2d39); x ^= x >>> 15;
    return (x >>> 0) / 4294967296;
  };
  const strH = (s) => { let x = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x | 0; };

  // ---------------------------------------------------------------- the places (pure)
  F.KINDS = ['shroom', 'spring', 'tree', 'circle', 'garden'];
  F.ADV = { shroom: 'lost', spring: 'hat', tree: 'lanterns', circle: 'riddle', garden: 'bridge' };
  // each world's places (a world without a sky has no stone circle under the moon and no garden in the sky)
  F.PLAN = {
    overworld: ['tree', 'shroom', 'spring', 'circle', 'garden'],
    flat: ['tree', 'spring', 'circle'], drift: ['garden', 'circle', 'spring'], hollow: ['shroom', 'spring'],
    underforge: ['shroom', 'spring'], basalt: ['circle', 'spring'], opal: ['spring', 'circle', 'shroom'],
    zinn: ['spring', 'shroom'], ocker: ['circle', 'tree'], aqua: ['spring', 'tree', 'shroom'],
  };
  F.plan = function (seed, dim) {
    if (F.PLAN[dim]) return F.PLAN[dim].slice();
    const D = VR.DimReg && VR.DimReg.get ? VR.DimReg.get(dim) : null, sky = !D || D.sky !== false;
    const pool = sky ? F.KINDS.slice() : ['shroom', 'spring', 'tree'], out = [];
    const n = 2 + (h(seed, strH(dim), 7) < 0.5 ? 1 : 0);
    for (let k = 0; out.length < n && k < 20; k++) { const c = pool[Math.floor(h(seed, strH(dim), 11, k) * pool.length)]; if (out.indexOf(c) < 0) out.push(c); }
    return out;
  };
  F.RING = [70, 240]; F.APART = 60;
  // the places of a world: [{id, kind, x, z, yaw}] — a pure function of (seed, world, the first standing point)
  F.sites = function (seed, dim, origin) {
    const kinds = F.plan(seed, dim), ox = origin ? +origin[0] || 0 : 0, oz = origin ? +origin[1] || 0 : 0, out = [];
    const s0 = strH(dim), a0 = h(seed, s0, 1) * TAU;
    kinds.forEach((kind, i) => {
      for (let k = 0; k < 40; k++) {
        // the golden angle spreads them round the ring; the first one nearest (the tree on Herzwelt: ~80–110 m)
        const a = a0 + i * 2.39996 + (h(seed, s0, i, k + 3) - 0.5) * 0.7 + k * 0.37;
        const lo = F.RING[0] + i * 26, r = Math.min(F.RING[1], lo + h(seed, s0, i, k + 50) * 46 + k * 3);
        const x = Math.round(ox + Math.cos(a) * r), z = Math.round(oz + Math.sin(a) * r);
        if (out.every((o) => Math.hypot(o.x - x, o.z - z) >= F.APART)) { out.push({ id: dim + ':' + kind, kind, x, z, yaw: Math.round(h(seed, s0, i, 99) * 628) / 100 }); break; }
      }
    });
    return out;
  };
  // the wood's mushrooms: {x, z, h (m tall), v (0 teal · 1 violet · 2 rose), yaw}
  F.shrooms = function (seed, site) {
    const out = [], s0 = strH(site.id);
    for (let k = 0; out.length < 18 && k < 90; k++) {
      const a = h(seed, s0, k, 1) * TAU, r = 2 + Math.sqrt(h(seed, s0, k, 2)) * 13.5;
      const x = Math.round((site.x + Math.cos(a) * r) * 10) / 10, z = Math.round((site.z + Math.sin(a) * r) * 10) / 10;
      if (out.some((m) => Math.hypot(m.x - x, m.z - z) < 2.4)) continue;
      const big = out.length < 4;
      out.push({ x, z, h: Math.round((big ? 6 + h(seed, s0, k, 3) * 2.4 : 1.8 + h(seed, s0, k, 3) * 3.2) * 10) / 10, v: Math.floor(h(seed, s0, k, 4) * 3), yaw: Math.round(h(seed, s0, k, 5) * 628) / 100 });
    }
    return out;
  };
  // the three lost lanterns round the tree: [[x, z], …] 16–40 m out
  F.lanternSpots = function (seed, site) {
    const out = [], s0 = strH(site.id + '#lan');
    for (let i = 0; i < 3; i++) { const a = site.yaw + i * TAU / 3 + (h(seed, s0, i, 1) - 0.5) * 1.2, r = 18 + h(seed, s0, i, 2) * 20; out.push([Math.round(site.x + Math.cos(a) * r), Math.round(site.z + Math.sin(a) * r)]); }
    return out;
  };
  // how much a place is at its best now (0 … 1): tod = the game's timeOfDay (0 sunrise · 6000 noon · 12000 sunset ·
  // 18000 midnight), clear = no rain, fog or storm
  const sm = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  F.best = function (kind, tod, clear) {
    const t = ((tod % 24000) + 24000) % 24000;
    const night = sm(12200, 13400, t) * (1 - sm(22600, 23600, t));          // after dusk until before dawn
    const dusk = sm(10800, 11900, t) * (1 - sm(13200, 14400, t));
    const dawn = Math.max(sm(22600, 23400, t), 1 - sm(600, 1800, t));        // round the sunrise
    if (kind === 'shroom') return Math.min(1, Math.max(night, dusk));
    if (kind === 'circle') return clear ? night : 0;
    if (kind === 'garden') return dawn;
    return 1 - 0.5 * night;                                                  // the spring and the tree: by day (lovely at night too)
  };

  // ---------------------------------------------------------------- f-polish5: the places' manners (pure)
  // a place keeps AVOID m off the game's own things: villages, outposts, wonders ({x, z, r}) and machines (r ≈ 6)
  F.AVOID = 40;
  F.clearOf = function (x, z, avoid) { if (avoid) for (const o of avoid) if (Math.hypot(o.x - x, o.z - z) < (o.r || 0) + F.AVOID) return false; return true; };
  // the Schwebegarten's bridge side (where you see it from): the garden against the lowest land behind it, never from
  // ground higher than its top − 4 m (you would look down on it); flat land keeps the planned yaw (yaw0).
  // hAt(x, z) → the ground's height
  F.gardenYaw = function (hAt, cx, cz, topY, yaw0) {
    const score = (a) => {
      const c = Math.cos(a), s = Math.sin(a);
      const hv = Math.max(hAt(cx + c * 30, cz + s * 30), hAt(cx + c * 38, cz + s * 38));
      if (hv > topY - 4) return Infinity;
      const hb = Math.max(hAt(cx - c * 40, cz - s * 40), hAt(cx - c * 80, cz - s * 80));
      return hb - 0.25 * hv;
    };
    const y0 = yaw0 || 0, s0 = score(y0);
    let best = y0, bs = s0;
    for (let k = 0; k < 12; k++) { const a = k * TAU / 12, sc = score(a); if (sc < bs - (s0 === Infinity ? 0 : 1.5)) { bs = sc; best = a; } }
    return best;
  };
  // the garden's soft flowers (their own small model, 1/8 m a voxel): {x, z, v (0 rose · 1 butter · 2 lilac), yaw, sc}
  // on the lawn (≤ 6.4 m out), off the blossom tree's trunk, the fountain and the two lamps (the model's own spots,
  // turned with the garden: the models face −z, world = (x·cos + z·sin, −x·sin + z·cos))
  const GARDEN_KEEP = [[3.5, 3, 1.1], [-2.25, -1.75, 1.9], [-4.25, 2.75, 0.6], [4.25, -3.75, 0.6]];
  F.blooms = function (seed, site) {
    const out = [], s0 = strH(site.id + '#bloom'), c = Math.cos(site.yaw || 0), sn = Math.sin(site.yaw || 0);
    for (let k = 0; out.length < 16 && k < 120; k++) {
      const a = h(seed, s0, k, 1) * TAU, r = 1.2 + Math.sqrt(h(seed, s0, k, 2)) * 5.2, lx = Math.cos(a) * r, lz = Math.sin(a) * r;
      if (GARDEN_KEEP.some(([kx, kz, kr]) => Math.hypot(lx - kx, lz - kz) < kr)) continue;
      const x = site.x + lx * c + lz * sn, z = site.z - lx * sn + lz * c;
      if (out.some((o) => Math.hypot(o.x - x, o.z - z) < 0.9)) continue;
      out.push({ x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100, v: Math.floor(h(seed, s0, k, 3) * 3), yaw: Math.round(h(seed, s0, k, 4) * 628) / 100, sc: Math.round((0.8 + h(seed, s0, k, 5) * 0.45) * 100) / 100 });
    }
    return out;
  };
  // a halo's strength by the dark (night 0 … 1): faint by day, full at night
  F.haloA = (night) => 0.3 + 0.7 * Math.max(0, Math.min(1, night || 0));

  // ---------------------------------------------------------------- the save (pure)
  // meta.fairy = {v: 1, o: {[dim]: [x, z]}, seen: {[siteId]: 1}, q: {[siteId]: {k, s, n, m, …}}, done: [siteId],
  //               pages: [kind], buddy: bool, wish: {[siteId]: day}, trail: s left}
  const STAGE = [1, 2, 3];   // 1 under way · 2 ready (back to the giver) · 3 done
  F.load = function (meta) {
    meta = meta || {};
    const r0 = isRec(meta.fairy) ? meta.fairy : {};
    const rec = { v: 1, o: {}, seen: {}, q: {}, done: [], pages: [], buddy: false, wish: {}, trail: 0 };
    if (isRec(r0.o)) for (const k of Object.keys(r0.o)) { const p = r0.o[k]; if (Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)) rec.o[k] = [p[0], p[1]]; }
    if (isRec(r0.seen)) for (const k of Object.keys(r0.seen)) if (typeof r0.seen[k] === 'number') rec.seen[k] = r0.seen[k];
    if (isRec(r0.q)) for (const k of Object.keys(r0.q)) { const q = r0.q[k]; if (isRec(q) && Object.values(F.ADV).indexOf(q.k) >= 0 && STAGE.indexOf(q.s) >= 0) rec.q[k] = Object.assign({}, q, { n: q.n | 0, m: q.m | 0 }); }
    if (Array.isArray(r0.done)) rec.done = r0.done.filter((s) => typeof s === 'string');
    if (Array.isArray(r0.pages)) rec.pages = r0.pages.filter((s) => typeof s === 'string' && F.ADV_KINDS.indexOf(s) >= 0);
    rec.buddy = r0.buddy === true;
    if (isRec(r0.wish)) for (const k of Object.keys(r0.wish)) if (Number.isFinite(r0.wish[k])) rec.wish[k] = r0.wish[k];
    rec.trail = Number.isFinite(r0.trail) ? Math.max(0, r0.trail) : 0;
    meta.fairy = rec;
    return { rec };
  };
  F.ADV_KINDS = ['lanterns', 'lost', 'bridge', 'riddle', 'hat'];

  // ---------------------------------------------------------------- the adventures' states (pure)
  const Q = F.Q = {};
  Q.start = function (rec, id, k, seed) {
    if (!rec || rec.done.indexOf(id) >= 0) return null;
    if (rec.q[id] && rec.q[id].s < 3) return rec.q[id];
    const q = rec.q[id] = { k, s: 1, n: 0, m: 0 };
    return q;
  };
  // lanterns: m is the mask of the three found
  Q.lantern = function (q, i) {
    if (!q || q.s !== 1) return 'had';
    const b = 1 << i; if (q.m & b) return 'had';
    q.m |= b; q.n = ((q.m & 1) + ((q.m >> 1) & 1) + ((q.m >> 2) & 1));
    if (q.m === 7) { q.s = 2; return 'all'; }
    return 'got';
  };
  // …or three lights built by the tree's door (n = how many stand there now)
  Q.built = function (q, n) { if (!q || q.s !== 1 || n < 3) return false; q.s = 2; q.b = 1; return true; };
  Q.arrive = function (q) { if (!q || q.s !== 1) return false; q.s = 2; return true; };
  // bridge: the melody (four of five stones) and its notes one by one
  Q.melody = function (seed, id) { const s0 = strH(id + '#mel'), out = []; for (let i = 0; i < 4; i++) { let n = Math.floor(h(seed, s0, i) * 5); if (i && n === out[i - 1]) n = (n + 2) % 5; out.push(n); } return out; };
  Q.note = function (q, i, mel) {
    if (!q || q.s !== 1) return 'idle';
    if (mel[q.n] === i) { q.n++; if (q.n >= mel.length) { q.s = 2; return 'done'; } return 'ok'; }
    q.n = mel[0] === i ? 1 : 0;
    return 'wrong';
  };
  // riddle: three of the riddles, each answer order shuffled (order[j] = which answer stands at stone j; 0 is right)
  F.RIDDLES = 8;
  Q.riddles = function (seed, id) {
    const s0 = strH(id + '#rid'), ids = [], out = [];
    for (let k = 0; ids.length < 3 && k < 40; k++) { const r = Math.floor(h(seed, s0, k) * F.RIDDLES); if (ids.indexOf(r) < 0) ids.push(r); }
    for (let i = 0; i < 3; i++) { const o = [0, 1, 2]; for (let j = 2; j > 0; j--) { const p = Math.floor(h(seed, s0, 77, i * 3 + j) * (j + 1)); const t = o[j]; o[j] = o[p]; o[p] = t; } out.push({ rid: ids[i], order: o }); }
    return out;
  };
  Q.answer = function (q, j, R) {
    if (!q || q.s !== 1 || !R[q.n]) return 'idle';
    if (R[q.n].order[j] !== 0) return 'wrong';
    q.n++;
    if (q.n >= R.length) { q.s = 2; return 'done'; }
    return 'right';
  };
  // hat: Zwirbel hops away twice, the third catch he gives it back
  Q.tag = function (q) { if (!q || q.s !== 1) return 'idle'; q.n++; if (q.n >= 3) { q.s = 2; return 'done'; } return 'hop'; };
  // the reward, once a place: {coins, size, page, set}
  F.SET = ['b:lumishroom', 'b:spirit_lantern', 'b:pink_petals', 'b:wildflowers', 'b:moss_carpet', 'b:rose_crystal_cluster', 'b:glow_berry_vine', 'b:vm_light_table_mushroom_white', 'b:spore_blossom', 'b:azure_crystal_cluster'];
  F.GIFT = { lanterns: ['b:spirit_lantern', 6], lost: ['b:lumishroom', 8], bridge: ['b:pink_petals', 16], riddle: ['b:rose_crystal_cluster', 6], hat: ['b:wildflowers', 16] };
  Q.finish = function (rec, id, k) {
    const q = rec && rec.q[id]; if (!q || q.s !== 2 || rec.done.indexOf(id) >= 0) return null;
    q.s = 3; rec.done.push(id);
    const first = rec.pages.indexOf(k) < 0; if (first) rec.pages.push(k);
    const buddy = !rec.buddy; rec.buddy = true;
    const size = k === 'riddle' || k === 'hat' ? 'S' : 'M';
    return { coins: size === 'S' ? 15 : 40, size, page: k, newPage: first, buddy, set: F.SET.slice(), gift: F.GIFT[k] };
  };

  if (typeof document === 'undefined' || !VR.VOXMODELS) return;   // node: the pure part only
  // ============================================================================ the game
  const LK = VR.LifeKit;
  const S = F.state = { g: null, key: '', sites: [], near: null, chk: 0, t: 0, ff: [], dance: [], bubble: null, ride: null, awake: 0, trailD: 0, lure: 0, folk: [], escort: null, chase: null, notesT: [], cost: { ms: 0, frames: 0, worst: 0, parts: 0 } };
  const on = (g) => !!g && !!g.settings && g.settings.fairy !== false && g.state === 'play';
  const tier = (g) => (LK && LK.tierOf ? LK.tierOf(g.settings) : 2);
  const recOf = (g) => { const m = g.meta || (g.meta = {}); return (isRec(m.fairy) && m.fairy.v === 1 && m.fairy.q) ? m.fairy : F.load(m).rec; };
  const seedOf = (g) => (g.meta && Number.isFinite(+g.meta.seed) ? +g.meta.seed | 0 : 1);
  const tod = (g) => (g.env ? g.env.timeOfDay : 6000);
  const clear = (g) => { const e = g.env, w = e && e.wx; if (!e) return true; const k = w && (w.forced || w.kind); return (e.rain || 0) < 0.15 && k !== 'nebel' && k !== 'gewitter' && k !== 'regen'; };
  const nameKey = (who) => 'g.fairy.who.' + who;
  const keyName = (who) => T(nameKey(who)), whoName = (f) => f.nm || keyName(f.who);   // n-names: the tree village's folk have their own Flausel names (VR.Names.flausel)
  const placeName = (kind) => T('g.fairy.place.' + kind);
  let saveT = 0;
  const save = (g) => { const now = Date.now(); if (now - saveT < 4000) return; saveT = now; try { if (g.saveMeta && g.meta && !g.meta.guest) g.saveMeta(); } catch (e) { /* the next save takes it */ } };

  // ---- the ground under a point (null while its column is not loaded): the first air above the top
  const ground = (g, x, z) => {
    const w = g.world; if (!w || !w.col) return null;
    const ix = Math.floor(x), iz = Math.floor(z), c = w.col(ix >> 4, iz >> 4); if (!c || !c.height) return null;
    return c.height[((iz & 15) << 4) | (ix & 15)] + 1;
  };
  const wet = (g, x, y, z) => { const R = VR.R, st = g.world.getBlock(Math.floor(x), Math.floor(y) - 1, Math.floor(z)); return !!(R && R.T && R.T.flags && VR.F && (R.T.flags[st] & VR.F.WATER)); };

  // ---- a world's places, settled on dry land once their land is there
  function setup(g) {
    const rec = recOf(g), dim = g.dim || 'overworld', p = g.player.pos;
    if (!rec.o[dim]) { rec.o[dim] = [Math.round(p[0]), Math.round(p[2])]; save(g); }
    S.g = g; S.key = dim + '|' + (g.meta && g.meta.seed);
    S.sites = F.sites(seedOf(g), dim, rec.o[dim]).map((s) => Object.assign(s, { y: null, tries: 0, parts: null, folk: [] }));
    S.near = null; S.ff.length = 0; S.dance.length = 0; S.ride = null; S.escort = null; S.chase = null; S.awake = 0;
    hideBubble();
    if (VR.Wander && VR.Wander.register) { try { VR.Wander.register({ id: 'fairy', kind: 'places', places: () => S.sites.filter((s) => s.y !== null).map((s) => ({ id: s.id, kind: s.kind, name: placeName(s.kind), pos: [s.x, s.y, s.z], seen: !!recOf(g).seen[s.id], best: F.best(s.kind, tod(g), clear(g)) })), pages: () => recOf(g).pages.slice() }); } catch (e) { /* the director is theirs */ } }
  }
  // f-polish5: what a place keeps off (F.clearOf) — the villages, the outposts' zones, Herzwelt's wonders, the machines
  const SITE_R = { city: 90, temple: 60, citadel: 70, station: 40 };   // (Herzwelt's wonders: how far they reach)
  function avoidOf(g) {
    if (S.avoid && S.avoidT > S.t) return S.avoid;
    const out = [], V = g.villages, L = VR.Liberate, En = g.entities, Lnd = VR.Land, m = g.meta || {};
    if (V && V.sites) for (const v of V.sites) if (v && Number.isFinite(v.x)) out.push({ x: v.x, z: v.z, r: Math.min(90, v.rad || 50) });
    if (L && L.zones) { try { for (const q of L.zones(g) || []) if (q && Number.isFinite(q.x)) out.push({ x: q.x, z: q.z, r: Math.min(80, q.r || 30) }); } catch (e) { /* no zones */ } }
    if (En && En.mobs) for (const q of En.mobs) if (q && q.foe && !q.foe.gone && q.pos) out.push({ x: q.pos[0], z: q.pos[2], r: 6 });
    if ((g.dim || 'overworld') === 'overworld' && Lnd && Lnd.SITES && (m.vgen | 0) >= (Lnd.VGEN || 10) && m.type !== 'flat') for (const q of Lnd.SITES) if (q[1] || q[2]) out.push({ x: q[1], z: q[2], r: SITE_R[q[3]] || 30 });
    S.avoid = out; S.avoidT = S.t + 2;
    return out;
  }
  // natural ground: what the generator lays (grass, earth, sand, snow, rock, moss, leaves …), never a roof or a road
  const NAT = /(^|_)(grass|dirt|sand|snow|podzol|moss|mud|gravel|stone|regolith|basalt|ice|ash|dust|clay|mycel|tuff|andesite|granite|diorite|calcite|soil|rubble|leaves|log|sandstone|rock|obsidian|frost|sulfur|scoria|nodule)/;
  const ART = /brick|plank|concrete|^vx_|^vm_|glass|wool|path|slab|stairs|polished|smooth|tile|cobble|wall|fence|chiseled|cut_|_cut$|lamp|temple|spire|stacked|stucco|bossed|paver|panorama|door|vollton|button|pressure|logic|stonecutter|block_of/;
  const natCache = new Map();
  const natural = (st) => { if (!st) return false; let v = natCache.get(st); if (v === undefined) { const R = VR.R, t = R && R.T && R.types ? R.types[R.T.type[st]] : null, n = t ? t.name : ''; v = !!n && NAT.test(n) && !ART.test(n); natCache.set(st, v); } return v; };
  // a spot's land: 'wait' while a column is not loaded, else true when the centre and eight points round it at R are
  // natural, dry and within `step` m of each other
  const RAD = { tree: 12, shroom: 14, spring: 8, circle: 10, garden: 17 };
  F.SETTLE_TRIES = 18;   // (a spiral out to ~120 m: what a player standing at the planned spot has loaded)
  // 2 · the centre and eight points round it at R natural, dry and within `step` m of each other · 1 · natural and dry
  // only · 0 · not · 'wait' while a column is not loaded; 3 · also room round it: natural ground on a ring at 2·R
  function landOk(g, x, z, R, step) {
    let lo = 1e9, hi = -1e9, dry = true;
    for (let k = 0; k < 9; k++) {
      const a = k * TAU / 8, px = k ? x + Math.cos(a) * R : x, pz = k ? z + Math.sin(a) * R : z, y = ground(g, px, pz);
      if (y === null) return 'wait';
      const st = g.world.getBlock(Math.floor(px), y - 1, Math.floor(pz));
      if (!natural(st) || wet(g, px, y, pz)) { if (!k) return 0; dry = false; }
      lo = Math.min(lo, y); hi = Math.max(hi, y);
    }
    if (!dry) return 0;
    if (hi - lo > step) return 1;
    for (let k = 0; k < 12; k++) {
      const a = k * TAU / 12 + 0.26, px = x + Math.cos(a) * R * 2, pz = z + Math.sin(a) * R * 2, y = ground(g, px, pz);
      if (y === null) return 'wait';
      if (!natural(g.world.getBlock(Math.floor(px), y - 1, Math.floor(pz)))) return 2;
    }
    return 3;
  }
  // settle: the first spot of a deterministic spiral round the planned one whose land is open, natural and dry (no
  // town, no road, no water); none in the spiral: its best spot (the first of the highest grade); then its parts
  function settle(g, s) {
    if (s.y !== null) return true;
    const x0 = s.x0 === undefined ? (s.x0 = s.x) : s.x0, z0 = s.z0 === undefined ? (s.z0 = s.z) : s.z0;
    const put = (x, z) => {
      s.x = x; s.z = z; s.y = ground(g, x, z);
      // f-polish5: the garden is seen from the side that shows it against open land (F.gardenYaw)
      if (s.kind === 'garden' && s.y !== null) { const y0 = s.y; s.yaw = F.gardenYaw((px, pz) => { const y = ground(g, px, pz); return y === null ? y0 : y; }, x, z, y0 + 24, s.yaw); }
      build(g, s); return true;
    };
    for (let k = s.tries; k < F.SETTLE_TRIES; k++) {
      const a = s.yaw + k * 0.93, r = k * 7, x = Math.round(x0 + Math.cos(a) * r), z = Math.round(z0 + Math.sin(a) * r);
      if (S.sites.some((o) => o !== s && o.y !== null && Math.hypot(o.x - x, o.z - z) < F.APART)) { s.tries = k + 1; continue; }
      if (!F.clearOf(x, z, avoidOf(g))) { s.tries = k + 1; continue; }   // (f-polish5: off villages, outposts, wonders, machines)
      const ok = landOk(g, x, z, RAD[s.kind] || 10, s.kind === 'garden' ? 8 : 5);
      if (ok === 'wait') return false;
      if (ok === 3) return put(x, z);
      if (ok > (s.bestG || 0)) { s.bestG = ok; s.best = [x, z]; }
      s.tries = k + 1;
    }
    return put(s.best ? s.best[0] : x0, s.best ? s.best[1] : z0);
  }
  const at = (g, x, z, dy) => { const y = ground(g, x, z); return [x, (y === null ? 0 : y) + (dy || 0), z]; };
  const off = (s, a, r) => [s.x + Math.cos(s.yaw + a) * r, s.z + Math.sin(s.yaw + a) * r];
  const look = (dx, dz) => Math.atan2(-dx, -dz);   // a model's yaw to face the way (dx, dz) (the models face −z)
  const faceIn = (s, a) => look(-Math.cos(s.yaw + a), -Math.sin(s.yaw + a));   // turned towards a place's centre from angle a
  // a place's parts and folk (their ground read once)
  function build(g, s) {
    const seed = seedOf(g), P = s.parts = [], folk = s.folk = [], add = (m, pos, yaw, o) => P.push({ m, pos, yaw: yaw || 0, o: o || {} });
    const sprite = (who, mood, v, pos, o) => folk.push(Object.assign({ who, mood, v, pos: pos.slice(), home: pos.slice(), yaw: s.yaw, t: h(seed, strH(who)) * 10, sx: 0 }, o || {}));
    if (s.kind === 'shroom') {
      F.shrooms(seed, s).forEach((m, i) => add('fy_shroom_' + m.v, at(g, m.x, m.z, -0.1), m.yaw, { scale: m.h / 4.6, glow: 1, h: m.h, lite: i < 8 }));
      const [fx, fz] = off(s, 0.6, 5); sprite('flocke', 'lost', 4, at(g, fx, fz, 0.1));
    } else if (s.kind === 'spring') {
      add('fy_pool', at(g, s.x, s.z, -0.05), s.yaw);
      for (let i = 0; i < 9; i++) { const [x, z] = off(s, i * TAU / 9, 4.4); add(i % 3 === 0 ? 'fy_crystal_1' : 'fy_crystal_0', at(g, x, z, -0.1), i * 1.3, { scale: 0.45 + h(seed, i, 3) * 0.45, lite: i % 3 === 0 }); }
      s.wishes = [0, 1, 2].map((i) => { const [x, z] = off(s, Math.PI + (i - 1) * 0.55, 6.2); const p = at(g, x, z, 0); add('fy_crystal_' + (i === 1 ? 2 : i), p, 0, { scale: 0.75 }); return { i, pos: p }; });
      const [zx, zz] = off(s, 1.9, 6.5); sprite('zwirbel', 'cheeky', 1, at(g, zx, zz, 0.1), { hat: true });
    } else if (s.kind === 'tree') {
      add('fy_tree', at(g, s.x, s.z, -0.4), look(Math.cos(s.yaw), Math.sin(s.yaw)));
      const [dx, dz] = off(s, 0, 4.2); s.door = at(g, dx, dz, 0);
      for (let i = 0; i < 6; i++) { const [x, z] = off(s, 0.9 + i * 0.85, 8.5 + h(seed, i, 9) * 3); add('fy_house_' + (i % 3), at(g, x, z, -0.05), faceIn(s, 0.9 + i * 0.85) + Math.PI, { lite: i % 2 === 0 }); }
      for (let i = 0; i < 8; i++) { const [x, z] = off(s, 0.75 + i * 0.62, 7); add('fy_lamp', at(g, x, z, 0), 0, { lite: i % 4 === 0 }); }
      const [bx, bz] = off(s, 0.25, 5.4); sprite('borke', 'wise', 3, at(g, bx, bz, 0.1));
      const [tx, tz] = off(s, 1.6, 9.5); sprite('tuepfel', 'shy', 0, at(g, tx, tz, 0.1));
      for (let i = 0; i < 2; i++) { const [x, z] = off(s, 2.6 + i * 1.7, 10); sprite('folk' + i, 'busy', (i + 2) % 5, at(g, x, z, 0.1), VR.Names && VR.Names.flausel ? { nm: VR.Names.flausel(seed ^ Math.imul(Math.round(s.x), 73856093) ^ Math.imul(Math.round(s.z), 19349663), i) } : null); }
      s.lanterns = F.lanternSpots(seed, s).map(([x, z], i) => { for (let k = 0; k < 5; k++) { const u = 1 - k * 0.15, px = s.x + (x - s.x) * u, pz = s.z + (z - s.z) * u, y = ground(g, px, pz); if (y !== null && natural(g.world.getBlock(Math.floor(px), y - 1, Math.floor(pz))) && !wet(g, px, y, pz)) return { i, pos: [px, y + 0.1, pz] }; } return { i, pos: at(g, x, z, 0.1) }; });
    } else if (s.kind === 'circle') {
      for (let i = 0; i < 9; i++) { const [x, z] = off(s, i * TAU / 9, 8); add('fy_stone', at(g, x, z, -0.3), faceIn(s, i * TAU / 9), { scale: 0.85 + h(seed, i, 5) * 0.4 }); }
      add('fy_altar', at(g, s.x, s.z, -0.1), s.yaw);
      s.answers = [0, 1, 2].map((j) => { const [x, z] = off(s, Math.PI + (j - 1) * 0.7, 4.6); const p = at(g, x, z, -0.1); add('fy_tablet', p, faceIn(s, Math.PI + (j - 1) * 0.7)); return { j, pos: p }; });
      const [sx, sz] = off(s, 0.4, 1.8); sprite('silbrin', 'wise', 2, at(g, sx, sz, 0.55));
    } else if (s.kind === 'garden') {
      s.top = s.y + 24;
      add('fy_garden', [s.x, s.top - 7, s.z], s.yaw, { big: 1, lawn: 1 });
      // f-polish5: the lawn's soft flowers, their own small model (Low and up; Very Low keeps the garden's own voxel flowers)
      F.blooms(seed, s).forEach((b) => add('fy_bloom_' + b.v, [b.x, s.top - 0.02, b.z], b.yaw, { scale: b.sc, lite: false, bloom: 1 }));
      const [fx, fz] = off(s, 0, 15); s.foot = at(g, fx, fz, 0);
      // the cloud bridge: a gentle arc from the foot up to the garden's rim (12 puffs)
      s.arc = []; for (let i = 0; i <= 12; i++) { const u = i / 12, x = s.foot[0] + (s.x + Math.cos(s.yaw) * 7 - s.foot[0]) * u, z = s.foot[2] + (s.z + Math.sin(s.yaw) * 7 - s.foot[2]) * u; s.arc.push([x, s.foot[1] + (s.top - s.foot[1]) * (u * u * (3 - 2 * u)) - 0.3 + Math.sin(u * Math.PI) * 2, z]); }
      for (let i = 1; i < 12; i++) add('fy_puff', s.arc[i], s.yaw + i, { puff: i });
      s.stones = [0, 1, 2, 3, 4].map((i) => { const [x, z] = off(s, -0.5 + i * 0.25, 19.5); const p = at(g, x, z, -0.05); add('fy_note_' + i, p, i, { note: i }); return { i, pos: p }; });
      const [dx, dz] = off(s, 0.12, 16.6); sprite('dusel', 'sleepy', 3, at(g, dx, dz, 0.1));
    }
  }

  // ---------------------------------------------------------------- the frame (game.js, after the world's update)
  const PO = { col: null, size: 0, force: true, grav: 0, drag: 0, collide: false, fade: false, life: 0.05, emis: 1 };
  const PM = { col: [1, 1, 1], size: 0.1, grav: -0.2, drag: 0.8, collide: false, life: 2.4, emis: 1, wind: 0.2 };
  const dot = (g, x, y, z, col, size, life) => { PO.col = col; PO.size = size; PO.life = life || (S.dt || 0.033) * 1.5 + 1e-4; return g.particles.spawn(x, y, z, 0, 0, 0, PO); };
  const mote = (g, x, y, z, vx, vy, vz, col, size, life, grav) => { PM.col = col; PM.size = size; PM.life = life; PM.grav = grav === undefined ? -0.2 : grav; return g.particles.spawn(x, y, z, vx, vy, vz, PM); };
  const FFC = [[1, 0.92, 0.45], [0.75, 1, 0.55], [0.6, 0.95, 1]];
  F.frame = function (g, dt, eye, E) {
    if (!on(g) || !g.player || !g.world) { if (S.sites.length && (!g || g.state !== 'play')) { S.sites = []; S.key = ''; hideBubble(); } return; }
    const t0 = performance.now();
    S.dt = dt; S.t += dt; S.E = E;
    const key = (g.dim || 'overworld') + '|' + (g.meta && g.meta.seed);
    if (key !== S.key) setup(g);
    const p = g.player.pos;
    if ((S.chk -= dt) <= 0) {   // twice a second: the nearest place, settled when its land is there
      S.chk = 0.5; let best = null, bd = 1e9;
      for (const s of S.sites) { const d = Math.hypot(s.x - p[0], s.z - p[2]); if (d < 300) settle(g, s); if (s.y !== null && d < bd) { bd = d; best = s; } }
      S.near = best && bd < 260 ? best : null; S.nearD = bd;
      discover(g, p);
    }
    trail(g, dt, p);
    lure(g, dt, p);
    if (S.ride) ride(g, dt);
    const s = S.near;
    if (s && s.parts) {
      const T0 = tier(g), b = F.best(s.kind, tod(g), clear(g)); s.b = b;
      for (const f of s.folk) think(g, s, f, dt, p);
      if (s.kind === 'shroom') fireflies(g, s, dt, p, T0, Math.max(b, 0.15));
      if (s.kind === 'circle') dancers(g, s, dt, T0, b);
      if (s.kind === 'spring') sparkle(g, s, dt, T0);
      if (s.kind === 'tree') treeLife(g, s, dt, p, T0);
      if (s.kind === 'garden') gardenLife(g, s, dt, p, T0, b);
    }
    if (LATER.length) for (let i = LATER.length - 1; i >= 0; i--) if (S.t >= LATER[i].t) { const L = LATER.splice(i, 1)[0]; try { L.fn(); } catch (e) { /* a nicety */ } }
    if (S.escort) escort(g, dt, p);
    if (s && s.kind === 'garden') F.hold(g.player);
    if (S.bubble) bubbleFrame(g);
    if (recOf(g).buddy && g.settings.fairyBuddy !== false) buddy(g, dt, eye);
    const ms = performance.now() - t0; S.cost.ms = S.cost.ms * 0.95 + ms * 0.05; S.cost.frames++; if (ms > S.cost.worst) S.cost.worst = ms;
  };

  // ---- found by walking: within 18 m (the garden: under it or on it) the first time
  function discover(g, p) {
    const rec = recOf(g);
    for (const s of S.sites) {
      if (s.y === null || rec.seen[s.id]) continue;
      const d = Math.hypot(s.x - p[0], s.z - p[2]);
      if (d < (s.kind === 'garden' ? 26 : 18)) {
        rec.seen[s.id] = 1; save(g);
        note(g, T('g.fairy.found', { name: placeName(s.kind) }), 2, 'fy-found');
        chime(g, [784, 988, 1175, 1568], 0.11);
        if (g.particles) for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; mote(g, p[0] + Math.cos(a) * 1.2, p[1] + 1.2, p[2] + Math.sin(a) * 1.2, Math.cos(a) * 0.6, 0.8, Math.sin(a) * 0.6, FFC[i % 3], 0.07, 1.8); }
        if (VR.Wander && VR.Wander.found) { try { VR.Wander.found('fairy', s.id); } catch (e) { /* theirs */ } }
      }
    }
  }
  // ---- a will-o'-the-wisp now and then: within 170 m of a place not found yet, a mote drifts off towards it
  function lure(g, dt, p) {
    if ((S.lure -= dt) > 0 || !g.particles) return;
    S.lure = 5 + Math.random() * 3;
    const rec = recOf(g); let s = null, bd = 170;
    for (const x of S.sites) { if (x.y === null || rec.seen[x.id]) continue; const d = Math.hypot(x.x - p[0], x.z - p[2]); if (d < bd && d > 24) { bd = d; s = x; } }
    if (!s) return;
    const dx = (s.x - p[0]) / bd, dz = (s.z - p[2]) / bd, yaw = g.player.yaw, fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const x0 = p[0] + fx * 5 + dx * 2, z0 = p[2] + fz * 5 + dz * 2;
    for (let k = 0; k < 3; k++) mote(g, x0 + k * dx * 0.3, p[1] + 1.4, z0 + k * dz * 0.3, dx * 3.2, 0.15, dz * 3.2, FFC[0], 0.09 - k * 0.02, 3.2, 0);
  }

  // ---- the folk: their moods
  function think(g, s, f, dt, p) {
    f.t += dt;
    if (f === S.escort || f.away) return;
    const dx = p[0] - f.pos[0], dz = p[2] - f.pos[2], d = Math.hypot(dx, dz);
    const face = Math.atan2(-dx, -dz);
    if (f.mood === 'shy') {
      // Tüpfel peeks: comes closer while you stand still, steps back when you rush at it
      const sp = Math.hypot(g.player.vel[0], g.player.vel[2]);
      const want = d < 3.2 && sp > 1.5 ? -1 : d > 5 && sp < 0.3 ? 0.4 : 0;
      if (want) { f.pos[0] -= Math.sin(face) * want * dt * 1.4 * -1; f.pos[2] -= Math.cos(face) * want * dt * 1.4 * -1; }
      if (Math.hypot(f.pos[0] - f.home[0], f.pos[2] - f.home[2]) > 4) { f.pos[0] += (f.home[0] - f.pos[0]) * dt; f.pos[2] += (f.home[2] - f.pos[2]) * dt; }
      f.yaw = face; f.hop = 0;
    } else if (f.mood === 'cheeky') {
      if (S.chase && S.chase.f === f) chaseStep(g, s, f, dt, d);
      else { f.yaw = face + Math.sin(f.t * 1.3) * 0.6; f.hop = Math.abs(Math.sin(f.t * 4.2)) * 0.25; }
    } else if (f.mood === 'sleepy') {
      f.yaw = s.yaw + Math.PI; f.hop = 0; f.sleep = !(f.wakeT > S.t);
      if (f.sleep && Math.random() < dt * 0.6 && g.particles) mote(g, f.pos[0] + 0.2, f.pos[1] + 0.7, f.pos[2], 0.15, 0.35, 0, [0.85, 0.9, 1], 0.06, 2.2, 0);
    } else if (f.mood === 'busy') {
      // the village folk stroll between the little houses
      const a = f.t * 0.18 + f.v; f.pos[0] = f.home[0] + Math.cos(a) * 2.2; f.pos[2] = f.home[2] + Math.sin(a) * 2.2; f.yaw = -a; f.hop = Math.abs(Math.sin(f.t * 5)) * 0.08;
      const y = ground(g, f.pos[0], f.pos[2]); if (y !== null) f.pos[1] = y + 0.1;
    } else if (f.mood === 'lost') {
      f.yaw = face; f.hop = 0;
      if (Math.random() < dt * 0.8 && g.particles) mote(g, f.pos[0], f.pos[1] + 0.5, f.pos[2], 0, -0.3, 0, [0.6, 0.85, 1], 0.04, 1.2, 0.5);   // a tear of light
    } else { f.yaw = face; f.hop = 0; }
  }

  // ---- the fireflies of the wood: they drift round its mushrooms and follow you while you walk in it
  function fireflies(g, s, dt, p, T0, b) {
    const N = [8, 14, 20, 26, 32][T0] || 20, inWood = Math.hypot(p[0] - s.x, p[2] - s.z) < 24;
    while (S.ff.length < N) { const i = S.ff.length; S.ff.push({ x: s.x + (h(i, 1) - 0.5) * 24, y: s.y + 1 + h(i, 2) * 3, z: s.z + (h(i, 3) - 0.5) * 24, ph: h(i, 4) * TAU, c: i % 3, f: h(i, 5) < 0.6 }); }
    if (!g.particles) return;
    for (let i = 0; i < N; i++) {
      const q = S.ff[i]; q.ph += dt * (0.7 + (i % 5) * 0.11);
      let tx, ty, tz;
      if (inWood && q.f) { const a = q.ph * 0.6 + i; tx = p[0] + Math.cos(a) * (1.6 + (i % 4) * 0.7); tz = p[2] + Math.sin(a) * (1.6 + (i % 4) * 0.7); ty = p[1] + 0.8 + Math.sin(q.ph * 1.7) * 0.6 + (i % 3) * 0.4; }
      else { tx = s.x + Math.cos(q.ph * 0.3 + i * 2.1) * (4 + (i % 7) * 1.6); tz = s.z + Math.sin(q.ph * 0.3 + i * 2.1) * (4 + (i % 7) * 1.6); ty = s.y + 0.8 + (i % 5) * 0.6 + Math.sin(q.ph) * 0.5; }
      const k = Math.min(1, dt * 1.2); q.x += (tx - q.x) * k; q.y += (ty - q.y) * k; q.z += (tz - q.z) * k;
      const blink = 0.5 + 0.5 * Math.sin(q.ph * 3.1 + i), a = b * (0.35 + 0.65 * blink * blink);
      if (a > 0.08) { const c = FFC[q.c], cc = q.cc || (q.cc = [0, 0, 0]); cc[0] = c[0] * a; cc[1] = c[1] * a; cc[2] = c[2] * a; dot(g, q.x, q.y, q.z, cc, 0.07 + 0.04 * blink); }
    }
    // the ground's soft spore motes under the caps (not on Very Low)
    if (T0 > 0 && Math.random() < dt * 6 * b) { const m = s.parts[Math.floor(Math.random() * s.parts.length)]; if (m && m.o.h) mote(g, m.pos[0] + (Math.random() - 0.5) * m.o.h * 0.6, m.pos[1] + m.o.h * 0.75, m.pos[2] + (Math.random() - 0.5) * m.o.h * 0.6, 0, -0.12, 0, m.m === 'fy_shroom_1' ? [0.8, 0.55, 1] : m.m === 'fy_shroom_2' ? [1, 0.6, 0.8] : [0.45, 1, 0.9], 0.05, 3.5, 0.05); }
  }
  // ---- the circle's spirits: a slow round dance on clear nights, a soft arpeggio
  const DP = [];
  function dancers(g, s, dt, T0, b) {
    if (b < 0.05 || !g.particles) { if (S.dancePos) S.dancePos.length = 0; return; }
    const N = [4, 5, 7, 7, 9][T0] || 7, R0 = 5;
    S.danceT = (S.danceT || 0) + dt * 0.45;
    const col = [0.75, 0.9, 1], c2 = [1, 0.85, 1];
    for (let i = 0; i < N; i++) {
      const a = S.danceT + i * TAU / N, r = R0 + Math.sin(S.danceT * 2 + i) * 0.6, y = s.y + 1.2 + Math.sin(S.danceT * 3 + i * 1.7) * 0.7;
      const x = s.x + Math.cos(a) * r, z = s.z + Math.sin(a) * r;
      const cc = S.dance[i] || (S.dance[i] = [0, 0, 0]), k = b * (0.8 + 0.2 * Math.sin(S.t * 5 + i)), base = i & 1 ? c2 : col;
      cc[0] = base[0] * k; cc[1] = base[1] * k; cc[2] = base[2] * k;
      dot(g, x, y, z, cc, T0 ? 0.16 : 0.26);   // (f-polish5: Very Low has no halo — a rounder dot instead, the same count)
      dot(g, x, y + 0.02, z, [k, k, k], T0 ? 0.07 : 0.1);
      const dp = S.dancePos || (S.dancePos = []); if (i === 0) dp.length = 0; dp.push(DP[i] || (DP[i] = [0, 0, 0])); DP[i][0] = x; DP[i][1] = y; DP[i][2] = z;
      if (T0 > 0 && Math.random() < dt * 9) mote(g, x, y, z, -Math.sin(a) * 0.3, -0.05, Math.cos(a) * 0.3, base, 0.05, 1.1, 0);
    }
    if ((S.arpT = (S.arpT || 0) - dt) <= 0 && Math.hypot(g.player.pos[0] - s.x, g.player.pos[2] - s.z) < 30) { S.arpT = 7; chime(g, [523, 659, 784, 659, 880], 0.05 * b, 0.22); }
  }
  function sparkle(g, s, dt, T0) {
    if (!g.particles) return;
    const n = [1.5, 3, 5, 7, 8][T0] || 5;
    if (Math.random() < dt * n) { const a = Math.random() * TAU, r = Math.random() * 2.6; mote(g, s.x + Math.cos(a) * r, s.y + 0.1, s.z + Math.sin(a) * r, 0, 0.5 + Math.random() * 0.4, 0, Math.random() < 0.5 ? [0.6, 0.95, 1] : [1, 0.75, 0.95], 0.05, 2.2, -0.05); }
  }
  function treeLife(g, s, dt, p, T0) {
    if (!g.particles) return;
    const night = 1 - F.best('tree', tod(g), true) * 2 + 1;   // (0 by day, 1 at night)
    // the lanterns of the adventure: glowing where they lie, picked up by walking to them
    const q = recOf(g).q[s.id];
    if (q && q.s === 1 && s.lanterns) for (const L of s.lanterns) {
      if (q.m & (1 << L.i)) continue;
      dot(g, L.pos[0], L.pos[1] + 0.35 + Math.sin(S.t * 2 + L.i) * 0.05, L.pos[2], [1, 0.8, 0.4], T0 ? 0.22 : 0.34);
      if (Math.random() < dt * 2) mote(g, L.pos[0], L.pos[1] + 0.5, L.pos[2], 0, 0.6, 0, [1, 0.85, 0.5], 0.05, 1.5, 0);
      if (Math.hypot(p[0] - L.pos[0], p[2] - L.pos[2]) < 1.8 && Math.abs(p[1] - L.pos[1]) < 2.5) {
        const r = F.Q.lantern(q, L.i); save(g);
        chime(g, [880, 1175], 0.1);
        note(g, T(r === 'all' ? 'g.fairy.lan.all' : 'g.fairy.lan.got', { n: q.n }), 3, 'fy-lan');
      }
    }
    // the builder's way: three lights within 10 m of the door (looked at once a second)
    if (q && q.s === 1 && (S.litT = (S.litT || 0) - dt) <= 0) { S.litT = 1; if (q.base === undefined) q.base = lightsNear(g, s.door, 10); if (F.Q.built(q, lightsNear(g, s.door, 10) - q.base)) { save(g); chime(g, [659, 880, 1175], 0.1); note(g, T('g.fairy.lan.built'), 3, 'fy-lan'); } }
    if (night > 0.3 && Math.random() < dt * (T0 ? 3 : 1)) { const a = Math.random() * TAU; mote(g, s.x + Math.cos(a) * 4, s.y + 6 + Math.random() * 8, s.z + Math.sin(a) * 4, 0, -0.1, 0, [1, 0.85, 0.5], 0.05, 3, 0.05); }
  }
  // the light blocks a builder set round a point (blocks that give light: lanterns, candles, lamps, glowing mushrooms)
  function lightsNear(g, c, r) {
    const R = VR.R, w = g.world; if (!c || !R || !R.T || !R.T.emit) return 0;
    let n = 0;
    for (let y = -2; y <= 5; y++) for (let z = -r; z <= r; z++) for (let x = -r; x <= r; x++) { const st = w.getBlock(Math.floor(c[0]) + x, Math.floor(c[1]) + y, Math.floor(c[2]) + z); if (st && R.T.emit[st] > 0) n++; }
    return n;
  }
  function gardenLife(g, s, dt, p, T0, b) {
    s.awake = Math.max(b, S.awake > S.t ? 1 : 0);
    s.bridge = (s.bridge || 0) + ((s.awake > 0.3 ? 1 : 0) - (s.bridge || 0)) * Math.min(1, dt * 0.8);
    // petals drift down from the garden
    if (g.particles && Math.random() < dt * (T0 ? 4 : 1.5)) { const a = Math.random() * TAU, r = Math.random() * 7; mote(g, s.x + Math.cos(a) * r, s.top - 1, s.z + Math.sin(a) * r, 0.3, -0.5, 0.1, Math.random() < 0.5 ? [1, 0.75, 0.85] : [1, 0.95, 0.8], 0.06, 6, 0.08); }
    // the bridge carries you: step on its foot while it is awake (or off the garden's rim on the bridge's side)
    if (!S.ride && s.bridge > 0.6) {
      if (Math.hypot(p[0] - s.foot[0], p[2] - s.foot[2]) < 1.8 && Math.abs(p[1] - s.foot[1]) < 2) S.ride = { s, u: 0, dir: 1 };
      const e = s.arc[12]; if (Math.hypot(p[0] - e[0], p[2] - e[2]) < 1.5 && Math.abs(p[1] - s.top) < 1.5 && S.t - (S.rideEnd || 0) > 3) S.ride = { s, u: 1, dir: -1 };
    }
    if (g.particles && s.bridge > 0.05) for (let i = 1; i < 12; i += (T0 ? 1 : 3)) if (Math.random() < dt * 1.5) { const q = s.arc[i]; mote(g, q[0] + (Math.random() - 0.5) * 2, q[1] - 0.2, q[2] + (Math.random() - 0.5) * 2, 0, -0.1, 0, [1, 0.9, 0.95], 0.08, 2, 0); }
  }
  function ride(g, dt) {
    const R0 = S.ride, s = R0.s, pl = g.player;
    R0.u += R0.dir * dt / 7;
    const u = Math.max(0, Math.min(1, R0.u)), k = u * 12, i = Math.min(11, Math.floor(k)), f = k - i, a = s.arc[i], b = s.arc[i + 1];
    pl.pos[0] = a[0] + (b[0] - a[0]) * f; pl.pos[1] = a[1] + (b[1] - a[1]) * f + 0.6; pl.pos[2] = a[2] + (b[2] - a[2]) * f;
    pl.vel[0] = pl.vel[1] = pl.vel[2] = 0; pl.fallStart = null;
    if (g.particles && Math.random() < dt * 20) mote(g, pl.pos[0], pl.pos[1] - 0.4, pl.pos[2], (Math.random() - 0.5), -0.2, (Math.random() - 0.5), [1, 0.92, 0.96], 0.12, 1.4, 0);
    if (R0.u >= 1 || R0.u <= 0) {
      if (R0.u >= 1) { pl.pos[0] = s.x + Math.cos(s.yaw) * 5; pl.pos[2] = s.z + Math.sin(s.yaw) * 5; pl.pos[1] = s.top + 0.02; note(g, T('g.fairy.garden.up'), 2, 'fy-garden'); chime(g, [659, 784, 988, 1319], 0.09); }
      S.ride = null; S.rideEnd = S.t;
    }
  }
  // the garden's top holds you (a disk of 7.5 m); off its rim you float down like a petal
  F.hold = function (pl) {
    const s = S.near; if (!s || s.kind !== 'garden' || s.top === undefined || S.ride) return;
    const dx = pl.pos[0] - s.x, dz = pl.pos[2] - s.z, d = Math.hypot(dx, dz);
    if (d < 7.5 && pl.pos[1] < s.top + 0.05 && pl.pos[1] > s.top - 1.6 && pl.vel[1] <= 0.01) { pl.pos[1] = s.top; pl.vel[1] = 0; pl.onGround = true; pl.fallStart = null; S.onGardenT = S.t; }
    else if (S.onGardenT && S.t - S.onGardenT < 30 && d < 40 && pl.vel[1] < -4) { pl.vel[1] = -4; pl.fallStart = null; }
  };
  // ---- Flöckchen follows you home
  function escort(g, dt, p) {
    const E0 = S.escort, f = E0.f, dx = p[0] - f.pos[0], dz = p[2] - f.pos[2], d = Math.hypot(dx, dz);
    if (d > 2.2) { const sp = (d < 26 ? Math.min(7.5, d * 1.5) : 2.5) * dt; f.pos[0] += dx / d * sp; f.pos[2] += dz / d * sp; }   // far behind it calls and comes on slowly
    if (d >= 26 && !E0.waitSaid) { E0.waitSaid = true; say(g, f, T('g.fairy.lost.wait')); } else if (d < 12) E0.waitSaid = false;
    if (d > 80) { f.pos[0] = p[0] - 2; f.pos[2] = p[2] - 2; }
    const y = ground(g, f.pos[0], f.pos[2]); f.pos[1] += ((y === null ? p[1] : y) + 0.9 + Math.sin(S.t * 3) * 0.15 - f.pos[1]) * Math.min(1, dt * 4);
    f.yaw = Math.atan2(-dx, -dz);
    if (g.particles) { if (Math.random() < dt * 14) mote(g, f.pos[0], f.pos[1] + 0.3, f.pos[2], 0, 0, 0, [0.7, 0.9, 1], 0.05, 0.9, 0); if (tier(g) > 0 && Math.random() < dt * 5) { const a = Math.random() * TAU; mote(g, p[0] + Math.cos(a) * 3, p[1] + 0.2, p[2] + Math.sin(a) * 3, 0.1, 0.05, 0, [0.85, 0.88, 0.95], 0.35, 3, 0); } }   // its glow and a little mist round you
    const tgt = E0.to;
    if (Math.hypot(f.pos[0] - tgt.x, f.pos[2] - tgt.z) < 7) {
      const rec = recOf(g), q = rec.q[E0.from.id];
      if (F.Q.arrive(q)) { S.escort = null; f.away = true; say(g, f, T('g.fairy.lost.home')); chime(g, [523, 659, 784, 1047, 1319], 0.1); finish(g, E0.from, f); }
    }
  }
  // ---- Zwirbel's hops
  function chaseStep(g, s, f, dt, d) {
    const C = S.chase;
    if (C.hop) {
      C.u += dt / 0.9; const u = Math.min(1, C.u);
      f.pos[0] = C.a[0] + (C.b[0] - C.a[0]) * u; f.pos[2] = C.a[2] + (C.b[2] - C.a[2]) * u; f.pos[1] = C.a[1] + (C.b[1] - C.a[1]) * u + Math.sin(u * Math.PI) * 2.2;
      if (u >= 1) C.hop = false;
      return;
    }
    f.hop = Math.abs(Math.sin(f.t * 6)) * 0.3; f.yaw += dt * 2;
    if (d < 2.3) {
      const q = recOf(g).q[s.id], r = F.Q.tag(q); save(g);
      if (r === 'done') { S.chase = null; f.hat = false; say(g, f, T('g.fairy.hat.done')); chime(g, [784, 659, 880, 1175], 0.1); finish(g, s, f); return; }
      const a = s.yaw + q.n * 2.2 + 0.7, r0 = 9 + q.n * 2, nx = s.x + Math.cos(a) * r0, nz = s.z + Math.sin(a) * r0;
      C.hop = true; C.u = 0; C.a = f.pos.slice(); C.b = at(g, nx, nz, 0.1);
      say(g, f, T(q.n === 1 ? 'g.fairy.hat.hop1' : 'g.fairy.hat.hop2'));
      chime(g, [1175, 1568], 0.07);
    }
  }
  // ---- the flower trail of a wish (5 minutes)
  function trail(g, dt, p) {
    const rec = recOf(g); if (!(rec.trail > 0) || !g.particles) return;
    rec.trail = Math.max(0, rec.trail - dt);
    const pl = g.player, sp = Math.hypot(pl.vel[0], pl.vel[2]); S.trailD += sp * dt;
    if (S.trailD > (tier(g) ? 0.35 : 0.8) && pl.onGround) {
      S.trailD = 0; const C = [[1, 0.6, 0.75], [1, 0.9, 0.4], [0.75, 0.6, 1], [1, 1, 1]];
      for (let k = 0; k < 2; k++) { PM.wind = 0; mote(g, p[0] + (Math.random() - 0.5) * 0.7, p[1] + 0.06, p[2] + (Math.random() - 0.5) * 0.7, 0, 0.02, 0, C[Math.floor(Math.random() * 4)], 0.08, 7, 0); PM.wind = 0.2; }
    }
  }
  // ---- the companion light (after the first adventure): a small sprite at your shoulder
  function buddy(g, dt, eye) {
    const B = S.bud || (S.bud = { pos: [eye[0], eye[1], eye[2]], t: 0 }), pl = g.player, yaw = pl.yaw;
    B.t += dt;
    const d = pl.lookDir ? pl.lookDir() : [-Math.sin(yaw), 0, -Math.cos(yaw)], tx = eye[0] + Math.cos(yaw) * 1.0 + d[0] * 1.7, tz = eye[2] - Math.sin(yaw) * 1.0 + d[2] * 1.7, ty = eye[1] - 0.2 + d[1] * 1.7 + Math.sin(B.t * 2.1) * 0.1;   // ahead and to the right, at the edge of the view
    const k = Math.min(1, dt * 3); B.pos[0] += (tx - B.pos[0]) * k; B.pos[1] += (ty - B.pos[1]) * k; B.pos[2] += (tz - B.pos[2]) * k;
    if (Math.hypot(tx - B.pos[0], tz - B.pos[2]) > 12) { B.pos[0] = tx; B.pos[1] = ty; B.pos[2] = tz; }
    if (g.particles) { dot(g, B.pos[0], B.pos[1], B.pos[2], [1, 0.9, 0.6], 0.09); if (Math.random() < dt * (tier(g) ? 8 : 2)) mote(g, B.pos[0], B.pos[1], B.pos[2], 0, -0.1, 0, [1, 0.85, 0.55], 0.03, 0.8, 0); }
  }

  // ---------------------------------------------------------------- talking ([V], ctx.js near hook)
  F.near = function (g, eye, dir) {
    if (!on(g) || S.ride) return null;
    const s = S.near; if (!s || !s.parts) return null;
    const list = [], p = g.player.pos, rec = recOf(g), q = rec.q[s.id];
    const push = (label, pos, r, act) => { if (Math.abs(pos[0] - eye[0]) < 6 && Math.abs(pos[2] - eye[2]) < 6) list.push({ kind: 'fairy', name: label, pos, r, act }); };
    for (const f of s.folk) if (!f.away && f !== S.escort) push(T('g.fairy.talk', { name: whoName(f) }), [f.pos[0], f.pos[1] + 0.4, f.pos[2]], 0.9, (gg) => talk(gg, s, f));
    if (s.kind === 'spring') for (const w of s.wishes) push(T('g.fairy.wish.' + w.i), [w.pos[0], w.pos[1] + 0.8, w.pos[2]], 0.8, (gg) => wish(gg, s, w.i));
    if (s.kind === 'tree' && s.door) push(T('g.fairy.knock'), [s.door[0], s.door[1] + 1.3, s.door[2]], 1.2, (gg) => knock(gg, s));
    if (s.kind === 'garden' && s.stones) for (const st of s.stones) push(T('g.fairy.note.' + st.i), [st.pos[0], st.pos[1] + 0.6, st.pos[2]], 0.7, (gg) => play(gg, s, st.i));
    if (s.kind === 'circle' && q && q.s === 1 && s.answers) { const R = F.Q.riddles(seedOf(g), s.id), r = R[q.n]; if (r) for (const a of s.answers) push(T('g.fairy.answer', { a: T('g.fairy.rid.' + r.rid + '.a' + r.order[a.j]) }), [a.pos[0], a.pos[1] + 0.7, a.pos[2]], 0.8, (gg) => answer(gg, s, a.j)); }
    void p;
    return list.length && VR.Ctx && VR.Ctx.pickNear ? VR.Ctx.pickNear(eye, dir, list) : null;
  };
  if (VR.Ctx && VR.Ctx.hooks && Array.isArray(VR.Ctx.hooks.near)) VR.Ctx.hooks.near.push((g, eye, dir) => F.near(g, eye, dir));

  const giver = { tree: 'tuepfel', shroom: 'flocke', spring: 'zwirbel', circle: 'silbrin', garden: 'dusel' };
  function talk(g, s, f) {
    const rec = recOf(g), k = F.ADV[s.kind], q = rec.q[s.id], done = rec.done.indexOf(s.id) >= 0;
    f.yaw = Math.atan2(-(g.player.pos[0] - f.pos[0]), -(g.player.pos[2] - f.pos[2]));
    if (f.mood === 'sleepy' && !(f.wakeT > S.t)) { f.wakeT = S.t + 25; say(g, f, T('g.fairy.dusel.yawn')); return true; }
    if (f.who !== giver[s.kind]) { say(g, f, T('g.fairy.chat.' + f.who + '.' + (Math.floor(S.t) % 3))); return true; }
    if (done) { say(g, f, T('g.fairy.thanks.' + k)); return true; }
    if (!q) { // the ask: once to hear it, once more to say yes
      if (f.asked !== s.id) { f.asked = s.id; say(g, f, T('g.fairy.ask.' + k)); return true; }
      F.Q.start(rec, s.id, k, seedOf(g)); save(g); f.asked = null;
      say(g, f, T('g.fairy.go.' + k));
      note(g, T('g.fairy.begun', { name: T('g.fairy.adv.' + k) }), 2, 'fy-adv');
      if (k === 'lost') { S.escort = { f, from: s, to: homeOf(s) }; }
      if (k === 'hat') S.chase = { f, hop: false };
      if (k === 'bridge') hum(g, s);
      if (k === 'riddle') say(g, f, riddleLine(g, s, q || rec.q[s.id]));
      return true;
    }
    if (q.s === 2) { finish(g, s, f); return true; }
    // under way: a reminder of what to do
    if (k === 'lost' && !S.escort) S.escort = { f, from: s, to: homeOf(s) };
    if (k === 'hat' && !S.chase) S.chase = { f, hop: false };
    if (k === 'bridge') { hum(g, s); return true; }
    if (k === 'riddle') { say(g, f, riddleLine(g, s, q)); return true; }
    say(g, f, T('g.fairy.still.' + k, { n: q.n | 0 }));
    return true;
  }
  // where Flöckchen lives: the stone circle of this world, else the nearest other place
  function homeOf(s) { const c = S.sites.find((x) => x.kind === 'circle' && x.y !== null); if (c) return c; let b = null, bd = 1e9; for (const x of S.sites) { if (x === s) continue; const d = Math.hypot(x.x - s.x, x.z - s.z); if (d < bd) { bd = d; b = x; } } return b || s; }
  function riddleLine(g, s, q) { const R = F.Q.riddles(seedOf(g), s.id), r = R[q ? q.n : 0]; return r ? T('g.fairy.rid.' + r.rid + '.q') : ''; }
  function finish(g, s, f) {
    const rec = recOf(g), k = F.ADV[s.kind], r = F.Q.finish(rec, s.id, k);
    if (!r) return;
    save(g);
    if (f) say(g, f, T('g.fairy.thanks.' + k));
    chime(g, [523, 659, 784, 1047, 1319, 1568], 0.1, 0.12);
    const inv = g.player && g.player.inv;
    if (inv && r.gift && VR.R && VR.R.byName[r.gift[0].slice(2)]) inv.add(r.gift[0], r.gift[1]);
    let added = 0; if (VR.Favs && VR.Favs.addMany) added = VR.Favs.addMany(r.set.filter((id) => VR.R && VR.R.byName[id.slice(2)]));
    if (VR.Adventure && VR.Adventure.award) { try { VR.Adventure.award('quest', { size: r.size }); } catch (e) { /* the Abenteuer is theirs */ } }
    note(g, T('g.fairy.done', { name: T('g.fairy.adv.' + k) }) + (r.newPage ? ' ' + T('g.fairy.page', { name: T('g.fairy.page.' + k) }) : ''), 3, 'fy-done');
    if (added) note(g, T('g.fairy.set', { n: added }), 2, 'fy-set');
    if (r.buddy) note(g, T('g.fairy.buddy'), 2, 'fy-buddy');
    if (VR.Wander && VR.Wander.page) { try { VR.Wander.page('fairy', k); } catch (e) { /* theirs */ } }
    if (g.particles) { const p = (f || {}).pos || g.player.pos; for (let i = 0; i < 40; i++) { const a = i / 40 * TAU * 3; mote(g, p[0], p[1] + 0.6, p[2], Math.cos(a) * (0.4 + i * 0.03), 1 + (i % 5) * 0.3, Math.sin(a) * (0.4 + i * 0.03), FFC[i % 3], 0.07, 2.5, 0.4); } }
  }
  function knock(g, s) {
    chime(g, [196, 196], 0.12, 0.25);
    const B = s.folk.find((f) => f.who === 'borke');
    if (B) { const rec = recOf(g), q = rec.q[s.id]; say(g, B, T(rec.done.indexOf(s.id) >= 0 ? 'g.fairy.borke.after' : q ? 'g.fairy.borke.during' : 'g.fairy.borke.0')); }
    s.doorT = S.t + 6;
    return true;
  }
  const LATER = [];
  const later = (dt, fn) => LATER.push({ t: S.t + dt, fn });
  const NOTE_F = [523.25, 587.33, 659.25, 783.99, 880];   // C D E G A — the five singing stones
  function hum(g, s) {
    const f = s.folk.find((x) => x.who === 'dusel'); f.wakeT = S.t + 30;
    say(g, f, T('g.fairy.dusel.hum'));
    const mel = F.Q.melody(seedOf(g), s.id), a = g.audio;
    mel.forEach((n, i) => later(0.9 + i * 0.65, () => { s.lit = { i: n, t: S.t + 0.5 }; tone(a, NOTE_F[n], 0.13, 0.7); }));
  }
  function play(g, s, i) {
    tone(g.audio, NOTE_F[i], 0.14, 0.8); s.lit = { i, t: S.t + 0.5 };
    const rec = recOf(g), q = rec.q[s.id];
    if (!q || q.s !== 1) return true;
    const r = F.Q.note(q, i, F.Q.melody(seedOf(g), s.id)); save(g);
    const f = s.folk.find((x) => x.who === 'dusel');
    if (r === 'wrong') say(g, f, T('g.fairy.note.wrong'));
    if (r === 'done') { S.awake = S.t + 240; later(0.5, () => chime(g, [523, 659, 784, 1047, 1319], 0.1, 0.14)); say(g, f, T('g.fairy.bridge.awake')); later(1.8, () => finish(g, s, f)); }
    return true;
  }
  function answer(g, s, j) {
    const rec = recOf(g), q = rec.q[s.id], R = F.Q.riddles(seedOf(g), s.id), f = s.folk.find((x) => x.who === 'silbrin');
    const r = F.Q.answer(q, j, R); save(g);
    if (r === 'wrong') { say(g, f, T('g.fairy.rid.wrong')); tone(g.audio, 330, 0.08, 0.5); }
    else if (r === 'right') { chime(g, [659, 880], 0.09); say(g, f, T('g.fairy.rid.right') + ' ' + riddleLine(g, s, q)); }
    else if (r === 'done') { finish(g, s, f); }
    return true;
  }
  function wish(g, s, i) {
    const rec = recOf(g), day = (g.env && g.env.day) | 0;
    if (rec.wish[s.id] === day) { note(g, T('g.fairy.wish.used'), 3, 'fy-wish'); return true; }
    rec.wish[s.id] = day; save(g);
    chime(g, [1047, 1319, 1568, 2093], 0.08, 0.1);
    const wx = g.env && g.env.wx;
    if (i === 0 && wx) { S.wxPrev = S.wxPrev === undefined ? wx.forced : S.wxPrev; wx.force('klar'); S.wxUntil = Date.now() + 5 * 60000; }
    if (i === 1 && wx) { S.wxPrev = S.wxPrev === undefined ? wx.forced : S.wxPrev; wx.force('regen'); S.wxUntil = Date.now() + 3 * 60000; }
    if (i === 2) rec.trail = 300;
    note(g, T('g.fairy.wish.ok.' + i), 3, 'fy-wish');
    if (g.particles) for (let k = 0; k < 30; k++) { const a = k / 30 * TAU; mote(g, s.x, s.y + 0.4, s.z, Math.cos(a) * 1.2, 2.5 + (k % 4) * 0.4, Math.sin(a) * 1.2, k & 1 ? [0.6, 0.95, 1] : [1, 0.75, 0.95], 0.08, 2.4, 1.2); }
    return true;
  }
  // the wish's weather goes back to the world's own after its minutes
  setInterval(() => { if (S.wxUntil && Date.now() > S.wxUntil) { const g = VR.game, wx = g && g.env && g.env.wx; if (wx) wx.force(S.wxPrev || null); S.wxUntil = 0; S.wxPrev = undefined; } }, 5000);

  // ---------------------------------------------------------------- sound, notes, the bubble
  function tone(a, f, gain, dur) { try { if (a && a.ctx && a.tone) a.tone(f, gain, dur, 'sine', true, a.ctx.currentTime); } catch (e) { /* no sound */ } }
  function chime(g, fs, gain, step) { const a = g && g.audio; try { if (a && a.ctx && a.tone) fs.forEach((f, i) => a.tone(f, gain, 0.9, 'sine', true, a.ctx.currentTime + i * (step || 0.09))); } catch (e) { /* no sound */ } }
  function note(g, text, prio, key) { if (VR.Quiet && VR.Quiet.note) VR.Quiet.note(text, prio, key); else if (g.ui && g.ui.hint) g.ui.hint(text, 3000); }
  function say(g, f, text) {
    if (!f || !text) return;
    const B = S.bubble || (S.bubble = {}); B.f = f; B.text = text; B.until = S.t + Math.min(9, 3 + text.length / 18);
    if (!B.el) { B.el = document.createElement('div'); B.el.className = 'fy-bubble'; document.body.appendChild(B.el); css(); }
    B.el.innerHTML = '<b>' + esc(whoName(f)) + '</b> ' + esc(text); B.el.style.display = 'block';
    F.lastSaid = { who: f.who, text };
    if (VR.A11y && VR.A11y.subtitle) { try { VR.A11y.subtitle(whoName(f) + ': ' + text); } catch (e) { /* theirs */ } }
    tone(g.audio, f.mood === 'sleepy' ? 392 : f.mood === 'cheeky' ? 1047 : 784, 0.05, 0.25);
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function hideBubble() { if (S.bubble && S.bubble.el) S.bubble.el.style.display = 'none'; if (S.bubble) S.bubble.f = null; }
  // the bubble over the speaker's head: projected from the player's own eye (yaw, pitch, the field of view) — the
  // renderer's matrices also serve the mirror's pass, this needs none of them
  function bubbleFrame(g) {
    const B = S.bubble; if (!B.f) return;
    if (S.t > B.until) { hideBubble(); return; }
    const pl = g.player, cv = g.renderer && g.renderer.gl && g.renderer.gl.canvas; if (!pl || !cv) return;
    const e = pl.eyePos(), f = B.f, x = f.pos[0] - e[0], y = f.pos[1] + 1.05 - e[1], z = f.pos[2] - e[2];
    const cy = Math.cos(pl.yaw), sy = Math.sin(pl.yaw), cp = Math.cos(pl.pitch), sp = Math.sin(pl.pitch);
    const fx = -sy * cp, fy = sp, fz = -cy * cp, rx = cy, rz = -sy, ux = sy * sp, uy = cp, uz = cy * sp;   // forward, right, up
    const d = x * fx + y * fy + z * fz, el = B.el;
    if (d < 0.3) { el.style.opacity = '0'; return; }
    const rc = cv.getBoundingClientRect(), W = rc.width || innerWidth, H = rc.height || innerHeight;
    const t = Math.tan(((g.settings.fov || 75) * Math.PI / 180) / 2), asp = W / H;
    const sx = rc.left + (0.5 + (x * rx + z * rz) / d / (t * asp) * 0.5) * W, sy2 = rc.top + (0.5 - (x * ux + y * uy + z * uz) / d / t * 0.5) * H;
    el.style.opacity = '1'; el.style.transform = 'translate(' + Math.round(Math.max(rc.left + 140, Math.min(rc.left + W - 140, sx))) + 'px,' + Math.round(Math.max(rc.top + 70, Math.min(rc.top + H - 60, sy2))) + 'px) translate(-50%,-100%)';
  }
  let cssDone = false;
  function css() {
    if (cssDone) return; cssDone = true;
    const st = document.createElement('style');
    st.textContent = '.fy-bubble{position:fixed;left:0;top:0;max-width:260px;padding:6px 10px 7px;border-radius:14px;background:rgba(255,250,240,.88);color:#3a2c4a;font:13px/1.35 system-ui,sans-serif;box-shadow:0 2px 10px rgba(60,30,80,.25);pointer-events:none;z-index:30;display:none;transition:opacity .2s}.fy-bubble b{color:#a0508a;font-weight:600;margin-right:4px}.fy-bubble:after{content:"";position:absolute;left:50%;bottom:-6px;margin-left:-6px;border:6px solid transparent;border-bottom:0;border-top-color:rgba(255,250,240,.88)}';
    document.head.appendChild(st);
  }

  // ---------------------------------------------------------------- drawing (game.js drawOpaque)
  const MP = { scale: 1, pose: null, shade: 0, noShade: true };
  // ---- f-polish5: soft halos (story_glow.js's kind 0) round the dancers, the lost lanterns, the feelers and the
  // companion at night — Low and up, ⚙ „Sanfte Lichthöfe" (wonderGlow); one small draw a halo, ≤ 14
  const vlOf = (g) => tier(g) === 0;
  const HL = []; for (let i = 0; i < 14; i++) HL.push({ p: [0, 0, 0], s: [1, 1], col: [0, 0, 0], a: 0, kind: 0 });
  function halos(g, r, s, c) {
    if (g.settings.wonderGlow === false || !VR.StoryGlow || !VR.StoryGlow.draw) return 0;
    const E = S.E || (g.env && g.env.E) || {}, night = Math.max(0, Math.min(1, E.night || 0)), A = F.haloA(night);
    let n = 0;
    const put = (x, y, z, sz, cr, cg, cb, a) => { if (n >= HL.length || a < 0.02) return; const q = HL[n++]; q.p[0] = x; q.p[1] = y; q.p[2] = z; q.s[0] = q.s[1] = sz; q.col[0] = cr; q.col[1] = cg; q.col[2] = cb; q.a = a; };
    if (s.kind === 'circle' && S.dancePos && (s.b || 0) > 0.05) for (const d of S.dancePos) { const e = Math.hypot(d[0] - c.x, d[1] - c.y, d[2] - c.z); put(d[0], d[1], d[2], 0.95, 0.55, 0.7, 1, 0.55 * s.b * A * Math.min(1, Math.max(0, (e - 1.5) / 3))); }   // (calm: a dancer passing right by the eye fades)
    if (s.kind === 'tree' && s.lanterns) { const q = recOf(g).q[s.id]; if (q && q.s === 1) for (const L of s.lanterns) if (!(q.m & (1 << L.i))) put(L.pos[0], L.pos[1] + 0.4, L.pos[2], 1.6 + 0.1 * Math.sin(S.t * 1.3 + L.i), 1, 0.66, 0.3, 0.75 * A); }
    if (night > 0.3) for (const f of s.folk) if (!f.away && n < 12) { const dx = f.pos[0] - c.x, dz = f.pos[2] - c.z; if (dx * dx + dz * dz < 900) put(f.pos[0], f.pos[1] + 0.85, f.pos[2], 0.45, 1, 0.85, 0.5, 0.45 * night); }
    if (S.bud && night > 0.3 && recOf(g).buddy && g.settings.fairyBuddy !== false) put(S.bud.pos[0], S.bud.pos[1] - 0.1, S.bud.pos[2], 0.5, 0.8, 0.9, 1, 0.4 * night);
    if (!n) return 0;
    for (let i = n; i < HL.length; i++) HL[i].a = 0;   // (the rest skipped: story_glow draws only a > 0)
    return VR.StoryGlow.draw(r, c, HL);
  }
  const poses = {};
  F.draw = function (g, r, E, cam) {
    S.cam = cam || r.cam;
    if (!on(g)) return;
    const s = S.near, ent = g.entities; if (!ent || !LK) return;
    let prog = null; const P = () => prog || (prog = ent.beginVox(r, E));
    const c = S.cam; let n = 0;
    if (s && s.parts) {
      const vl = tier(g) === 0;
      for (const part of s.parts) {
        if (vl && part.o.lite === false) continue;   // Very Low: the decor's every other piece
        const dx = part.pos[0] - c.x, dz = part.pos[2] - c.z, d2 = dx * dx + dz * dz;
        if (d2 > (part.o.big || part.m === 'fy_tree' ? 230 * 230 : 120 * 120)) continue;
        let pos = part.pos, sc = part.o.scale || 1, yaw = part.yaw;
        if (part.o.puff) {
          const b = s.bridge || 0; if (b < 0.04) continue; sc = b * (0.8 + 0.25 * Math.sin(S.t * 0.7 + part.o.puff));
          // f-polish5: a cloud right at the eye melts away (the ride's view is never inside a puff)
          const dd = Math.hypot(dx, part.pos[1] - c.y, dz), R1 = S.ride && part.o.puff > S.ride.u * 12 - 1 ? 10 : 4.5;   // (riding: the clouds still ahead of you thin out sooner — the garden stays in view)
          if (dd < R1) { const k = (dd - 2.2) / (R1 - 2.2); if (k <= 0.05) continue; sc *= k; }
        }
        if (part.o.note !== undefined && s.lit && s.lit.i === part.o.note && S.t < s.lit.t) sc = 1.25;
        if (part.m === 'fy_tree') { const br = 1 + Math.sin(S.t * 0.5) * 0.012; sc = br; }   // the slow breath of the sleeping tree
        MP.scale = sc; MP.pose = null;
        if (part.m === 'fy_tree' && s.doorT > S.t) MP.pose = poses.door || (poses.door = { door: [0, -1.2, 0] });
        const mname = part.o.lawn && !vl ? 'fy_garden_lawn' : part.m;   // (f-polish5: Low and up the lawn without its 0.5 m flower voxels)
        if (LK.drawModel(g, r, P(), mname, pos, yaw, c, MP)) n++;
        MP.pose = null;
      }
      for (const f of s.folk) if (!f.away || f === S.escort) n += drawSprite(g, r, P, f, c);
      if (s.kind === 'tree' && s.lanterns) { const q = recOf(g).q[s.id]; if (q && q.s === 1) for (const L of s.lanterns) if (!(q.m & (1 << L.i))) { MP.scale = 1; LK.drawModel(g, r, P(), 'fy_lantern', L.pos, S.t * 0.3, c, MP); n++; } }
    }
    if (S.escort && (!s || s.folk.indexOf(S.escort.f) < 0)) n += drawSprite(g, r, P, S.escort.f, c);
    if (S.bud && recOf(g).buddy && g.settings.fairyBuddy !== false && g.player) { const B = S.bud; MP.scale = 0.42; MP.pose = wings(B, 'bud'); LK.drawModel(g, r, P(), 'fy_sprite_0', [B.pos[0], B.pos[1] - 0.2, B.pos[2]], g.player.yaw, c, MP); MP.pose = null; n++; }
    S.cost.parts = n;
    if (s && s.parts && !vlOf(g)) S.cost.halos = halos(g, r, s, c);
  };
  function wings(f, k) { const p = f._pose || (f._pose = { wing_l: [0, 0, 0], wing_r: [0, 0, 0], cap: [0, 0, 0, 0, 0, 0], body: [0, 0, 0, 0, 0, 0] }); const a = Math.sin(S.t * (f.mood === 'sleepy' ? 3 : 14) + (f.v || 0)) * (f.sleep ? 0.1 : 0.55); p.wing_l[1] = 0.4 + a; p.wing_r[1] = -0.4 - a; void k; return p; }
  function drawSprite(g, r, P, f, c) {
    const pz = f.pos, pos = f._dp || (f._dp = [0, 0, 0]);
    pos[0] = pz[0]; pos[1] = pz[1] + (f.hop || 0) + Math.sin(S.t * 2 + (f.v || 0)) * 0.05; pos[2] = pz[2];
    const pose = wings(f);
    pose.body[0] = f.sleep ? 0.35 : 0; pose.cap[0] = f.sleep ? 0.35 : 0;
    MP.scale = f.who === 'borke' ? 1.25 : f.who === 'flocke' ? 0.8 : 1; MP.pose = pose;
    const m = 'fy_sprite_' + (f.hat ? 'hat' : f.v);
    const ok = LK.drawModel(g, r, P(), m, pos, f.yaw, c, MP);
    MP.pose = null;
    if (ok && g.particles) dot(g, pos[0] - Math.sin(f.yaw) * 0.02, pos[1] + 0.78 * MP.scale + 0.02, pos[2], [1, 0.9, 0.55], 0.06);   // the feeler's light
    return ok ? 1 : 0;
  }

  // ---------------------------------------------------------------- hooks: the player stands on the garden, the switches
  if (VR.Player && VR.Player.prototype && !VR.Player.prototype.__fairy) {
    const up0 = VR.Player.prototype.update;
    VR.Player.prototype.update = function (dt, input) { const r = up0.apply(this, arguments); try { if (S.near && S.near.kind === 'garden') F.hold(this); } catch (e) { /* a nicety */ } return r; };
    VR.Player.prototype.__fairy = true;
  }
  if (VR.Settings && VR.Settings.add) {
    VR.Settings.add({ key: 'fairy', g: 'img', sec: 'show', t: 'switch', lab: 'g.set.fairy', tip: 'g.set.fairy.tip', cost: 'low', def: true });
    // f-polish5: the wonders' soft halos and far cues (fairy.js, wander.js, movein.js) — Low and up
    if (!(VR.Settings.byKey && VR.Settings.byKey('wonderGlow'))) VR.Settings.add({ key: 'wonderGlow', g: 'img', sec: 'show', t: 'switch', lab: 'g.set.wonderGlow', tip: 'g.set.wonderGlow.tip', cost: 'low', def: true });
    VR.Settings.add({ key: 'fairyBuddy', g: 'img', sec: 'show', t: 'switch', lab: 'g.set.fairyBuddy', tip: 'g.set.fairyBuddy.tip', cost: 'low', def: true });
  }
  // the pictures' and the tests' handles
  F.debug = {
    sites: () => S.sites.map((s) => ({ id: s.id, kind: s.kind, x: s.x, y: s.y, z: s.z, yaw: s.yaw, top: s.top, foot: s.foot, door: s.door, lanterns: s.lanterns && s.lanterns.map((l) => l.pos), stones: s.stones && s.stones.map((x) => x.pos), answers: s.answers && s.answers.map((x) => x.pos), wishes: s.wishes && s.wishes.map((x) => x.pos), folk: s.folk.map((f) => ({ who: f.who, pos: f.pos.slice(), away: !!f.away })) })),
    near: () => (S.near ? S.near.id : null), cost: () => Object.assign({}, S.cost), said: () => F.lastSaid || null,
    talk: (who) => { const g = VR.game, s = S.near; const f = s && s.folk.find((x) => x.who === who); return f ? talk(g, s, f) : false; },
    play: (i) => (S.near ? play(VR.game, S.near, i) : false), answer: (j) => (S.near ? answer(VR.game, S.near, j) : false), wish: (i) => (S.near ? wish(VR.game, S.near, i) : false), knock: () => (S.near ? knock(VR.game, S.near) : false),
    melody: () => (S.near ? F.Q.melody(seedOf(VR.game), S.near.id) : null), riddles: () => (S.near ? F.Q.riddles(seedOf(VR.game), S.near.id) : null),
    escort: () => (S.escort ? { pos: S.escort.f.pos.slice(), to: [S.escort.to.x, S.escort.to.y, S.escort.to.z] } : null), chase: () => (S.chase ? { pos: S.chase.f.pos.slice(), hop: S.chase.hop } : null),
    wake: () => { S.awake = S.t + 240; }, rec: () => recOf(VR.game), ride: () => (S.ride ? S.ride.u : -1), bridge: () => (S.near && S.near.bridge) || 0,
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
