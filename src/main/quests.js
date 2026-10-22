// ============================================================================
// Aufträge — quests from villagers with names (a-quests; plan docs/superpowers/plans/2026-10-22-a-quests.md, spec
// docs/superpowers/specs/2026-10-22-abenteuer-design.md §8). VR.Quests in an Abenteuer world:
//   nine kinds    Bringen (fetch) · Bauen (build) · Suchen (find) · Begleiten (escort) · Fotografieren (photo) ·
//                 Befreien (free — a stub until a-foes) · Reisen (travel — a stub until u-cruise) · Reparieren (repair)
//                 · Rätsel (riddle: three answers, the facts of docs/universe/REFERENCE.md)
//   deterministic each quest is a pure function of (seed, village, villager, day) and the world's places (the
//                 Heartland's landmarks, the vistas of gen_vista.js, the villages): Q.make; the givers of a day too
//                 (Q.givers: 2–4 per village and game day)
//   somewhere     every quest leads to something worth seeing: a vista, a landmark at its hour (the citadel at the
//                 golden hour or at night, the lake when the swarms fly, the isles at night), the plaza at dusk, the sky
//   the ✦         a gold star over a giver's head (an offer), a cyan one (ready to hand in) — a voxel star of our own,
//                 emissive, turning; drawn after the villagers (Villages.prototype.draw, wrapped), one per marked giver
//   the Tagebuch  J (binds.js 'journal') or the pause menu: open, ready, done; where, how far, which way, the hour, the
//                 reward; 🧭 tracks one — the map's ✦ and the compass line (map.js wrapped), Q.target() for Funke
//   rewards       by size through VR.Adventure.award('quest', {size}) (S 20 XP + 15 Sterntaler, M 50 + 40, L 120 +
//                 100), friendship hearts (the village's love), sometimes an item
//   costs         nothing per frame without a UI: a 2-Hz timer (Abenteuer worlds only) marks the givers and checks the
//                 targets; the marker draw early-outs when nothing is marked
// The records live in meta.adventure.me.quests (A§15; VR.Adv.load keeps them): {[pid]: {id, k, s, d, st, q, …},
// '~log': [the last 30 done], '~day': {pid: the day it was done or given up}, '~track': pid}. Hooks (one marked line
// each): villages.js quest() and gift(); binds.js J; build.js. Everything else wraps prototypes from here.
// ============================================================================
(function (VR) {
  'use strict';
  const Q = VR.Quests = {};
  const T = (k, v) => (VR.I18N ? VR.I18N.t(k, v) : k);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hasDoc = typeof document !== 'undefined' && !!document.createElement;
  const game = () => VR.game || null;
  const own = (o, k) => !!o && Object.prototype.hasOwnProperty.call(o, k);
  const fmt = (n) => { try { return Number(n).toLocaleString(VR.I18N && VR.I18N.locale ? VR.I18N.locale() : undefined); } catch (e) { return String(n); } };

  // ================================================================ the pure core (no DOM; test/quests.js)
  Q.KINDS = ['fetch', 'build', 'find', 'escort', 'photo', 'free', 'travel', 'repair', 'riddle'];
  Q.SIZE = { fetch: 'S', build: 'M', find: 'S', escort: 'M', photo: 'S', free: 'L', travel: 'L', repair: 'M', riddle: 'S' };
  Q.HEARTS = { S: 1, M: 2, L: 3 };   // friendship hearts: the village's love +2 a heart (villages.js shows round(rep / 2))
  Q.MAX_OPEN = 5; Q.LOG = 30;
  Q.TRAVEL_ON = false;               // u-cruise switches Reisen on (the moons reached by the cruise)
  Q.ICON = { fetch: '🧺', build: '🔨', find: '🔍', escort: '🚶', photo: '📷', free: '🗼', travel: '🚀', repair: '🔧', riddle: '❓' };
  // the hours (ticks: 0 sunrise, 6000 noon, 12000 sunset; t-light2's golden hour 10800, wildsim's swarms 10400–13400)
  Q.HOURS = { day: [1200, 10000], golden: [10000, 12100], dusk: [12000, 13500], night: [13500, 22500], dawn: [22500, 1200], murm: [10400, 13400] };
  const tod24 = (t) => ((t % 24000) + 24000) % 24000;
  Q.inHour = function (h, t) { const H = Q.HOURS[h]; if (!H) return true; t = tod24(t); return H[0] <= H[1] ? t >= H[0] && t < H[1] : t >= H[0] || t < H[1]; };
  Q.untilHour = (h, t) => (Q.inHour(h, t) || !Q.HOURS[h] ? 0 : tod24(Q.HOURS[h][0] - tod24(t)));
  // a 32-bit hash of the parts (strings or numbers): FNV-1a, then a finalizer
  Q.hash = function () {
    let h = 0x811c9dc5;
    for (let i = 0; i < arguments.length; i++) { const s = String(arguments[i]); for (let j = 0; j < s.length; j++) { h ^= s.charCodeAt(j); h = Math.imul(h, 0x01000193); } h ^= 0x2f; h = Math.imul(h, 0x01000193); }
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return h >>> 0;
  };
  const sub = (h, k) => Q.hash(h, k);   // a second number from the quest's hash

  // ---------------------------------------------------------------- the places worth going to
  // lm: the landmark's photo hours and how far its photo may be taken from (blocks)
  const LM = {
    temple: { photo: ['dawn', 'golden'], maxD: 700 }, citadel: { photo: ['golden', 'night'], maxD: 900 }, isles: { photo: ['night', 'golden'], maxD: 900 },
    lake: { photo: ['murm'], maxD: 450 }, nova: { photo: ['night'], maxD: 700 }, station: { photo: ['golden'], maxD: 800 },
    lighthouse: { photo: ['night'], maxD: 500 }, falls: { photo: ['golden', 'day'], maxD: 400 }, lookout: { photo: ['golden'], maxD: 400 },
    hills: { photo: ['golden'], maxD: 700 }, dome: { photo: ['night'], maxD: 400 }, mill: { photo: ['golden'], maxD: 300 },
    belvedere: { photo: ['golden'], maxD: 300 }, monopteros: { photo: ['dawn', 'golden'], maxD: 300 },
  };
  Q.LM = Object.keys(LM);
  const lmOf = (id) => { const s = String(id || ''); return /^mill/.test(s) ? 'mill' : /^belvedere/.test(s) ? 'belvedere' : own(LM, s) ? s : 'view'; };
  // the list: {heart (the Heartland's fixed landmarks), vistas (gen_vista.js), wonders, villages, outposts, vid (the
  // giver's own village is no destination)} → [{id, kind: lm | vista | wonder | village | outpost, lm, x, y, z, top, name}]
  Q.places = function (o) {
    o = o || {};
    const out = [], seen = new Set(), H = VR.Heart, L = VR.Land, SEA = (VR.C && VR.C.SEA) || 63;
    const add = (p) => { if (!p || seen.has(p.id) || !Number.isFinite(p.x) || !Number.isFinite(p.z)) return; seen.add(p.id); out.push(p); };
    if (o.heart && H) {
      const P = H.PLAT || 80, lake = (L && L.LAKE) || { x: 345, z: 150 };
      add({ id: 'lm:temple', kind: 'lm', lm: 'temple', x: H.TEMPLE.x, y: P, z: H.TEMPLE.z - 5, top: P + 87 });
      add({ id: 'lm:citadel', kind: 'lm', lm: 'citadel', x: H.CITADEL.x, y: H.CITADEL.y, z: H.CITADEL.z, top: 249 });
      add({ id: 'lm:isles', kind: 'lm', lm: 'isles', x: H.ISLES.x, y: H.ISLES.y, z: H.ISLES.z, top: H.ISLES.y + 15 });
      add({ id: 'lm:lake', kind: 'lm', lm: 'lake', x: lake.x, y: SEA, z: lake.z, top: SEA + 22 });
      add({ id: 'lm:nova', kind: 'lm', lm: 'nova', x: H.CITY.x, y: P, z: H.CITY.z, top: P + 20 });
      add({ id: 'lm:station', kind: 'lm', lm: 'station', x: H.STATION.x, y: null, z: H.STATION.z, top: 190 });
    }
    for (const v of o.vistas || []) {
      if (!v || v.id === undefined) continue;
      add({ id: 'v:' + v.id, kind: 'vista', lm: lmOf(v.lm), x: v.x, y: Number.isFinite(v.y) ? v.y : null, z: v.z, top: Number.isFinite(v.y) ? v.y + 2 : null });
      // the landmark a vista faces, where no fixed one stands for it (the lighthouse, the falls, a windmill …)
      if (Array.isArray(v.aim) && v.lm && !seen.has('lm:' + v.lm)) add({ id: 'lm:' + v.lm, kind: 'lm', lm: lmOf(v.lm), x: v.aim[0], y: null, z: v.aim[2], top: v.aim[1] });
    }
    for (const w of o.wonders || []) if (w && w.key !== undefined) add({ id: 'w:' + w.key, kind: 'wonder', lm: 'wonder', x: w.x, y: Number.isFinite(w.y) ? w.y : null, z: w.z, top: (Number.isFinite(w.y) ? w.y : 70) + 20, name: w.name || '' });
    for (const s of o.villages || []) if (s && s.id !== undefined && s.id !== o.vid) add({ id: 'vil:' + s.id, kind: 'village', lm: 'village', x: s.x, y: Number.isFinite(s.y) ? s.y : null, z: s.z, top: (Number.isFinite(s.y) ? s.y : 70) + 12, name: s.name || '' });
    for (const p of o.outposts || []) if (p && p.id !== undefined) add({ id: 'out:' + p.id, kind: 'outpost', lm: 'outpost', x: p.x, y: Number.isFinite(p.y) ? p.y : null, z: p.z, top: (Number.isFinite(p.y) ? p.y : 70) + 30 });
    out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return out;
  };
  const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const at = (p) => ({ id: p.id, kind: p.kind, lm: p.lm, x: p.x, y: p.y, z: p.z, top: p.top, name: p.name || '' });

  // ---------------------------------------------------------------- the givers of a day
  Q.givers = function (seed, vid, day, people) {
    const n = (people && people.length) | 0; if (!n) return [];
    const K = Math.min(n, 2 + (n > 12 ? 1 : 0) + (n > 30 ? 1 : 0));
    const ranked = people.map(p => [Q.hash(seed, vid, day | 0, p.id, 'giver'), p.id]).sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : 1));
    return ranked.slice(0, K).map(r => r[1]).sort();
  };

  // ---------------------------------------------------------------- what each role likes to ask for
  const KIND_W = {
    farmer: { fetch: 4, build: 2, find: 2, escort: 1, photo: 1, repair: 3, riddle: 1 }, baker: { fetch: 4, photo: 2, escort: 2, find: 2, riddle: 1, build: 1, repair: 1 },
    smith: { fetch: 3, repair: 4, build: 3, find: 1, photo: 1, riddle: 1 }, scholar: { riddle: 5, photo: 3, find: 2, fetch: 2, escort: 1 },
    teacher: { riddle: 5, photo: 2, find: 2, escort: 2, fetch: 1 }, healer: { fetch: 3, escort: 3, find: 2, riddle: 2, photo: 1 },
    mayor: { build: 4, photo: 3, riddle: 2, repair: 2, fetch: 1 }, builder: { build: 5, repair: 4, fetch: 2, photo: 1 },
    ranger: { find: 4, repair: 2, photo: 3, escort: 2, free: 3 }, pilot: { photo: 4, find: 2, travel: 4, repair: 2, riddle: 2 },
    operator: { photo: 3, riddle: 3, repair: 2, travel: 3 }, gardener: { fetch: 4, build: 3, photo: 2, find: 1 },
    cashier: { fetch: 3, find: 3, photo: 1, riddle: 1 }, clerk: { fetch: 3, find: 3, build: 1 }, barista: { photo: 3, escort: 2, fetch: 2, find: 2 },
    worker: { repair: 4, build: 3, fetch: 2 }, office: { riddle: 3, photo: 2, find: 2, fetch: 1 }, crafter: { build: 3, repair: 3, fetch: 3, find: 1 },
    child: { find: 5, riddle: 3, escort: 2, photo: 1 }, elder: { escort: 4, riddle: 3, photo: 3, find: 1, fetch: 1 },
    default: { fetch: 3, find: 2, photo: 2, riddle: 2, build: 1, repair: 1, escort: 1 },
  };
  // Bringen: [item, count] by role (two or three each, the day picks); where such things are found (a landmark's id)
  const FETCH = {
    farmer: [['bone_meal', 8], ['wheat', 16], ['carrot', 12]], baker: [['wheat', 12], ['sugar_cane', 6], ['egg', 6]], smith: [['iron_ingot', 6], ['coal', 12], ['gold_ingot', 3]],
    builder: [['oak_planks', 32], ['cobblestone', 32], ['glass', 12]], scholar: [['paper', 6], ['book', 2], ['feather', 4]], teacher: [['paper', 8], ['book', 1], ['apple', 6]],
    healer: [['honey_bottle', 2], ['sweet_berries', 12], ['apple', 6]], mayor: [['lantern', 4], ['torch', 16], ['poppy', 8]], ranger: [['energy_cell', 2], ['cooked_cod', 4], ['torch', 12]],
    pilot: [['energy_cell', 3], ['iron_ingot', 4]], operator: [['energy_cell', 2], ['paper', 4]], gardener: [['poppy', 6], ['dandelion', 8], ['sunflower', 3]],
    cashier: [['apple', 8], ['bread', 6], ['egg', 6]], clerk: [['carrot', 10], ['potato', 10]], barista: [['sugar_cane', 8], ['cookie', 6], ['sweet_berries', 10]],
    worker: [['iron_ingot', 4], ['coal', 10]], office: [['paper', 10], ['book', 1]], crafter: [['string', 8], ['oak_log', 8], ['white_wool', 4]],
    child: [['cookie', 3], ['apple', 4], ['sweet_berries', 6]], elder: [['book', 1], ['honey_bottle', 1], ['bread', 3]], default: [['apple', 6], ['bread', 4]],
  };
  const FETCH_HINT = { wheat: 'mill', carrot: 'mill', potato: 'mill', egg: 'mill', bread: 'mill', sugar_cane: 'lake', cooked_cod: 'lake', poppy: 'falls', dandelion: 'falls', sunflower: 'monopteros', sweet_berries: 'falls' };
  // Bauen: what, the block, how many, where (the plaza or a vista nearby)
  const BUILD = [
    { what: 'lanterns', block: 'vx_lamppost', n: 4, plaza: true }, { what: 'well', block: 'vx_well', n: 1, plaza: true },
    { what: 'planters', block: 'vx_planter', n: 6, plaza: true }, { what: 'fountain', block: 'vx_fountain', n: 1, plaza: true },
    { what: 'benches', block: 'vx_bench', n: 2, plaza: false }, { what: 'gardenlamps', block: 'vx_garden_lamp', n: 4, plaza: false },
  ];
  // Suchen: the lost things by the giver's age
  const THINGS = { child: ['ball', 'kite', 'kitten', 'puppy'], adult: ['kitten', 'scarf', 'letter', 'puppy'], elder: ['letter', 'scarf', 'kitten'] };
  Q.THINGS = ['kitten', 'puppy', 'ball', 'kite', 'scarf', 'letter'];
  const PETNAMES = ['Flocke', 'Moosi', 'Tatze', 'Puschel', 'Samtpfote', 'Tüpfel'];
  // Reparieren: at a vista (its lamps, its bench) or on the village's plaza (the lamp, the bell)
  const REPAIR_V = ['lamps', 'bench'], REPAIR_P = ['plazalamp', 'bell'];
  // the riddles: the real universe (docs/universe/REFERENCE.md; the texts g.q.rid.<id>.*, a0 the right answer)
  Q.RIDDLES = [
    { id: 'dust_sunset', ref: 'R§2.3', see: true }, { id: 'ring_thin', ref: 'R§4.2', see: true }, { id: 'sun_white', ref: 'R§0', see: false },
    { id: 'airless_sky', ref: 'R§2.6', see: true }, { id: 'comet_tail', ref: 'R§1.8', see: false }, { id: 'ice_giants', ref: 'R§4.3', see: false },
    { id: 'phobos_west', ref: 'R§2.3', see: false }, { id: 'titan_wings', ref: 'R§2.4', see: false }, { id: 'bennu_jump', ref: 'R§1.7', see: true },
    { id: 'light_time', ref: 'R§1.0', see: false }, { id: 'aurora_green', ref: 'R§3', see: true }, { id: 'iss_sunrise', ref: 'R§3', see: false },
    { id: 'enceladus_bright', ref: 'R§1.5', see: false }, { id: 'star_colors', ref: 'R§6.1', see: true },
  ];
  const PERMS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  const ITEM_OK = (id) => !!((VR.itemDef && VR.itemDef(id)) || (VR.R && VR.R.byName && VR.R.byName[id]));
  const dist = (p, V) => Math.hypot(p.x - V.x, p.z - V.z);
  const pick = (arr, h) => arr[h % arr.length];
  // what is switched on: Befreien with a-foes (VR.Liberate), Reisen with u-cruise (Q.TRAVEL_ON)
  Q.avail = () => ({ free: !!(VR.Liberate && VR.Liberate.quest), travel: !!Q.TRAVEL_ON });

  // the builders: each gives its parameters or null (nothing fitting here)
  const B = {
    fetch(c, h) {
      const list = (FETCH[c.role] || FETCH.default).filter(([id]) => c.items(id));
      if (!list.length) return null;
      const [item, n] = pick(list, h), hint = FETCH_HINT[item];
      const hp = hint ? c.places.find(p => p.kind === 'lm' && p.lm === hint && dist(p, c.V) <= 700) : null;
      return { item, n, hint: hp ? at(hp) : null };
    },
    build(c, h) {
      const near = c.places.filter(p => p.kind === 'vista' && dist(p, c.V) >= 30 && dist(p, c.V) <= 200);
      const opts = BUILD.filter(b => (b.plaza || near.length) && c.items(b.block) && VR.R && VR.R.byName && VR.R.byName[b.block]);
      if (!opts.length) return null;
      const b = pick(opts, h), P = c.V.plaza || [c.V.x, c.V.y, c.V.z];
      const where = b.plaza ? { id: 'plaza', kind: 'plaza', lm: 'plaza', x: P[0], y: P[1], z: P[2], r: 24 } : Object.assign(at(pick(near, sub(h, 2))), { r: 12 });
      return { what: b.what, block: b.block, n: b.n, at: where };
    },
    find(c, h) {
      const cand = c.places.filter(p => (p.kind === 'vista' || p.kind === 'village' || p.kind === 'wonder') && dist(p, c.V) >= 60 && dist(p, c.V) <= 600);
      if (!cand.length) return null;
      const p = pick(cand, h), a = (sub(h, 3) % 628) / 100, r = 3 + (sub(h, 4) % 5);
      const thing = pick(THINGS[c.age] || THINGS.adult, sub(h, 5));
      return { thing, pet: thing === 'kitten' || thing === 'puppy' ? pick(c.petNames, sub(h, 6)) : '', at: at(p), spot: [Math.round(p.x + Math.cos(a) * r) + 0.5, Math.round(p.z + Math.sin(a) * r) + 0.5], got: false, far: dist(p, c.V) > 250 };
    },
    escort(c, h) {
      const cand = c.places.filter(p => (p.kind === 'vista' || p.kind === 'village' || p.kind === 'wonder') && dist(p, c.V) >= 40 && dist(p, c.V) <= 170);
      if (!cand.length) return null;
      return { to: at(pick(cand, h)) };
    },
    photo(c, h) {
      const cand = c.places.filter(p => ((p.kind === 'lm' && own(LM, p.lm)) || p.kind === 'wonder' || p.kind === 'village') && dist(p, c.V) <= 1600);
      if (!cand.length) return null;
      const p = pick(cand, h), hours = p.kind === 'lm' ? LM[p.lm].photo : p.kind === 'wonder' ? ['golden', 'night'] : ['night', 'golden'];
      return { at: at(p), hour: pick(hours, sub(h, 7)), maxD: p.kind === 'lm' ? LM[p.lm].maxD : 320 };
    },
    free(c) {
      const cand = c.places.filter(p => p.kind === 'outpost').sort((a, b) => dist(a, c.V) - dist(b, c.V) || byId(a, b));
      return cand.length ? { at: at(cand[0]) } : null;
    },
    travel(c, h) { return { dim: pick(['opal', 'basalt'], h) }; },
    repair(c, h) {
      const near = c.places.filter(p => p.kind === 'vista' && dist(p, c.V) >= 50 && dist(p, c.V) <= 400);
      const P = c.V.plaza || [c.V.x, c.V.y, c.V.z];
      if (near.length && (h & 1)) return { what: pick(REPAIR_V, sub(h, 8)), at: at(pick(near, sub(h, 9))), prog: 0 };
      return { what: pick(REPAIR_P, sub(h, 8)), at: { id: 'plaza', kind: 'plaza', lm: 'plaza', x: P[0] + 1, y: P[1], z: P[2] + 1 }, prog: 0 };
    },
    riddle(c, h) { const r = pick(Q.RIDDLES, h); return { rid: r.id, order: PERMS[sub(h, 10) % 6].slice(), tried: [] }; },
  };
  // ctx: {seed, vid, pid, day, role, age, name, village: {x, y, z, name, plaza}, places, kinds? (forced), avail?, items?}
  Q.make = function (ctx) {
    if (!ctx || !ctx.village || ctx.pid === undefined) return null;
    const seed = ctx.seed >>> 0, day = ctx.day | 0, base = Q.hash(seed, ctx.vid, ctx.pid, day);
    const age = ctx.age === 'child' || ctx.age === 'elder' ? ctx.age : 'adult';
    const role = ctx.role || (age === 'adult' ? 'default' : age);
    const c = { V: ctx.village, places: (ctx.places || []).slice().sort(byId), age, role, items: ctx.items || ITEM_OK, petNames: ctx.petNames || (VR.Pets && VR.Pets.KINDS && VR.Pets.KINDS.moss_cat && VR.Pets.KINDS.moss_cat.names) || PETNAMES };
    const av = ctx.avail || Q.avail(), W = KIND_W[role] || KIND_W.default;
    const forced = Array.isArray(ctx.kinds) && ctx.kinds.length ? ctx.kinds : null;
    const cands = []; let total = 0;
    for (const k of Q.KINDS) {
      const w = forced ? (forced.indexOf(k) >= 0 ? 1 : 0) : W[k] | 0; if (!w) continue;
      if ((k === 'free' || k === 'travel') && !av[k]) continue;
      const q = B[k](c, sub(base, k));
      if (!q) continue;
      cands.push([k, w, q]); total += w;
    }
    if (!total) return null;
    let r = base % total, ch = cands[0];
    for (const x of cands) { if (r < x[1]) { ch = x; break; } r -= x[1]; }
    const k = ch[0], q = ch[2];
    const s = k === 'find' && q.far ? 'M' : Q.SIZE[k];
    if (k === 'find') delete q.far;
    return { id: ('0000000' + base.toString(16)).slice(-8), pid: ctx.pid, vid: ctx.vid, d: day, k, s, g: ctx.name || '', v: ctx.village.name || '', home: [ctx.village.x, ctx.village.y, ctx.village.z], q };
  };
  // where a quest leads (the journal, the map, Funke): a place, the plaza, the sky (a riddle), a moon (a stub)
  Q.where = function (r) {
    const q = r && r.q; if (!q) return null;
    switch (r.k) {
      case 'fetch': return q.hint || { id: 'home', kind: 'village', x: r.home[0], y: r.home[1], z: r.home[2], name: r.v };
      case 'build': case 'photo': case 'free': return q.at;
      case 'find': return q.got ? { id: 'home', kind: 'village', x: r.home[0], y: r.home[1], z: r.home[2], name: r.v } : Object.assign({}, q.at, { x: q.spot[0], z: q.spot[1], spot: true });
      case 'escort': return q.to;
      case 'repair': return q.at;
      case 'riddle': return { sky: true, rid: q.rid };
      case 'travel': return { dim: q.dim };
      default: return null;
    }
  };

  // ---------------------------------------------------------------- the records (meta.adventure.me.quests)
  const store = (rec) => { const me = rec && rec.me; if (!me) return null; if (!me.quests || typeof me.quests !== 'object' || Array.isArray(me.quests)) me.quests = {}; return me.quests; };
  const isRec = (r) => !!r && typeof r === 'object' && Q.KINDS.indexOf(r.k) >= 0 && (r.st === 'open' || r.st === 'ready') && !!r.q && typeof r.q === 'object' && typeof r.id === 'string';
  Q.get = (rec, pid) => { const s = store(rec); if (!s || typeof pid !== 'string' || pid[0] === '~') return null; const r = s[pid]; return isRec(r) ? r : null; };
  Q.open = (rec) => { const s = store(rec), out = []; if (s) for (const k in s) if (k[0] !== '~' && isRec(s[k])) out.push(s[k]); return out.sort((a, b) => (a.t || 0) - (b.t || 0) || byId(a, b)); };
  Q.log = (rec) => { const s = store(rec); return s && Array.isArray(s['~log']) ? s['~log'] : []; };
  const dayMap = (s) => (s['~day'] && typeof s['~day'] === 'object' && !Array.isArray(s['~day']) ? s['~day'] : (s['~day'] = {}));
  Q.accept = function (rec, q, now) {
    const s = store(rec); if (!s || !q || !q.pid) return { ok: false, why: 'none' };
    if (Q.get(rec, q.pid)) return { ok: false, why: 'have' };
    if (Q.open(rec).length >= Q.MAX_OPEN) return { ok: false, why: 'full' };
    s[q.pid] = { id: q.id, pid: q.pid, vid: q.vid, k: q.k, s: q.s, d: q.d, st: 'open', q: JSON.parse(JSON.stringify(q.q)), n: 0, t: +now || 0, g: q.g, v: q.v, home: q.home ? q.home.slice() : [0, 70, 0] };
    s['~track'] = q.pid;
    return { ok: true };
  };
  Q.drop = function (rec, pid) {
    const s = store(rec), r = Q.get(rec, pid); if (!r) return false;
    dayMap(s)[pid] = r.d; delete s[pid];
    if (s['~track'] === pid) delete s['~track'];
    return true;
  };
  Q.offer = function (rec, ctx) {
    const s = store(rec); if (!s || !ctx) return null;
    if (Q.get(rec, ctx.pid)) return null;
    if (dayMap(s)[ctx.pid] === (ctx.day | 0)) return null;
    return Q.make(ctx);
  };
  // Bringen: the items handed over at the giver
  Q.handIn = function (rec, pid, inv) {
    const r = Q.get(rec, pid); if (!r || r.k !== 'fetch' || r.st !== 'open' || !inv) return { ok: false, why: 'none' };
    const have = inv.count(r.q.item);
    if (have < r.q.n) return { ok: false, why: 'short', have, n: r.q.n };
    if (!inv.remove(r.q.item, r.q.n)) return { ok: false, why: 'short', have, n: r.q.n };
    r.st = 'ready'; return { ok: true };
  };
  // Bauen: a block placed (its name read back from the world) — counted once per position within the place
  Q.placed = function (rec, x, y, z, name) {
    const out = [];
    for (const r of Q.open(rec)) {
      if (r.k !== 'build' || r.st !== 'open' || r.q.block !== name) continue;
      const A = r.q.at; if (Math.hypot(x + 0.5 - A.x, z + 0.5 - A.z) > (A.r || 12) || (A.y !== null && A.y !== undefined && Math.abs(y - A.y) > 10)) continue;
      const key = x + ',' + y + ',' + z, P = r.q.pos || (r.q.pos = []);
      if (P.indexOf(key) >= 0) continue;
      P.push(key); r.n = P.length;
      if (r.n >= r.q.n) r.st = 'ready';
      out.push({ pid: r.pid, n: r.n, need: r.q.n, ready: r.st === 'ready' });
    }
    return out;
  };
  // Suchen and Reparieren: where the player stands (twice a second); ges: Geschick (5 or more: 2.4 s instead of 3)
  Q.REPAIR_S = 3; Q.REPAIR_S5 = 2.4; Q.FIND_R = 2.4; Q.REPAIR_R = 3.5;
  Q.near = function (rec, pos, dt, ges) {
    const out = [];
    if (!pos) return out;
    for (const r of Q.open(rec)) {
      if (r.st !== 'open') continue;
      if (r.k === 'find' && !r.q.got) {
        const s = r.q.spot, sy = r.q.sy;
        if (Math.hypot(pos[0] - s[0], pos[2] - s[1]) <= Q.FIND_R && (sy === null || sy === undefined || pos[1] === null || Math.abs(pos[1] - sy) <= 4)) { r.q.got = true; r.st = 'ready'; out.push({ pid: r.pid, ev: 'found', r }); }
      } else if (r.k === 'repair') {
        const A = r.q.at;
        if (Math.hypot(pos[0] - A.x, pos[2] - A.z) > Q.REPAIR_R || (A.y !== null && A.y !== undefined && pos[1] !== null && Math.abs(pos[1] - A.y) > 5)) continue;
        const need = (ges | 0) >= 5 ? Q.REPAIR_S5 : Q.REPAIR_S;
        r.q.prog = Math.min(1, (r.q.prog || 0) + Math.max(0, +dt || 0) / need);
        if (r.q.prog >= 1 - 1e-9) { r.q.prog = 1; r.st = 'ready'; out.push({ pid: r.pid, ev: 'repaired', r }); }
        else out.push({ pid: r.pid, ev: 'repair', p: r.q.prog, r });
      }
    }
    return out;
  };
  // Begleiten: 'go' (together), 'wait' (the player fell behind), 'arrived' (there together)
  Q.ESCORT_NEAR = 12; Q.ESCORT_AT = 4;
  Q.escortStep = function (rec, pid, apos, ppos) {
    const r = Q.get(rec, pid); if (!r || r.k !== 'escort') return null;
    if (r.st === 'ready') return 'arrived';
    const together = Math.hypot(apos[0] - ppos[0], apos[2] - ppos[2]) <= Q.ESCORT_NEAR;
    if (!together) return 'wait';
    if (Math.hypot(apos[0] - r.q.to.x, apos[2] - r.q.to.z) <= Q.ESCORT_AT) { r.st = 'ready'; return 'arrived'; }
    return 'go';
  };
  // Fotografieren: a photo-mode picture {x, y, z, yaw, pitch} at the hour tod — the landmark within 22° of the middle
  Q.PHOTO_DEG = 22;
  Q.photo = function (rec, cam, tod) {
    const out = [];
    if (!cam) return out;
    const cp = Math.cos(cam.pitch || 0), f = [-Math.sin(cam.yaw || 0) * cp, Math.sin(cam.pitch || 0), -Math.cos(cam.yaw || 0) * cp];
    for (const r of Q.open(rec)) {
      if (r.k !== 'photo' || r.st !== 'open') continue;
      const A = r.q.at, aim = [A.x, A.top !== null && A.top !== undefined ? A.top : (A.y || 80), A.z];
      const v = [aim[0] - cam.x, aim[1] - cam.y, aim[2] - cam.z], d = Math.hypot(v[0], v[1], v[2]) || 1;
      let why = '';
      if (d > r.q.maxD) why = 'far';
      else if (Math.acos(Math.max(-1, Math.min(1, (v[0] * f[0] + v[1] * f[1] + v[2] * f[2]) / d))) * 180 / Math.PI > Q.PHOTO_DEG) why = 'frame';
      else if (!Q.inHour(r.q.hour, tod)) why = 'hour';
      if (!why) r.st = 'ready';
      out.push({ pid: r.pid, ok: !why, why, r });
    }
    return out;
  };
  // Rätsel: i is the button's place (q.order[i] === 0 is the right one); a wrong one is only greyed
  Q.answer = function (rec, pid, i) {
    const r = Q.get(rec, pid); if (!r || r.k !== 'riddle' || r.st !== 'open') return { right: false, none: true };
    if (r.q.order[i] === 0) { r.st = 'ready'; return { right: true }; }
    if (r.q.tried.indexOf(i) < 0) r.q.tried.push(i);
    return { right: false };
  };
  // the other fronts' events: 'freed' {id} (a-foes: an outpost freed), 'arrive' {dim} (u-cruise: on a moon)
  Q.event = function (rec, name, data) {
    const out = [], d = data || {};
    for (const r of Q.open(rec)) {
      if (r.st !== 'open') continue;
      if (name === 'freed' && r.k === 'free' && (r.q.at.id === d.id || r.q.at.id === 'out:' + d.id)) { r.st = 'ready'; out.push(r); }
      if (name === 'arrive' && r.k === 'travel' && r.q.dim === d.dim) { r.st = 'ready'; out.push(r); }
    }
    return out;
  };
  // the rewards' items (sometimes: S a quarter, M half, L always — the quest's hash decides)
  const ITEMS = { S: [['cookie', 4], ['apple', 3], ['emerald', 2]], M: [['cake', 1], ['emerald', 5], ['vx_lantern', 4], ['golden_apple', 1]], L: [['golden_apple', 2], ['emerald', 12], ['energy_cell', 4]] };
  Q.finish = function (rec, pid, now, day) {
    const s = store(rec), r = Q.get(rec, pid);
    if (!r || r.st !== 'ready') return { ok: false };
    const h = Q.hash(r.id, 'reward'), chance = r.s === 'L' ? 4 : r.s === 'M' ? 2 : 1;
    let item = null;
    if ((h & 3) < chance) { const list = (ITEMS[r.s] || ITEMS.S).filter(([id]) => ITEM_OK(id)); if (list.length) item = pick(list, h >>> 3).slice(); }
    delete s[pid];
    dayMap(s)[pid] = day === undefined ? r.d : day | 0;
    const log = Array.isArray(s['~log']) ? s['~log'] : (s['~log'] = []);
    log.push({ id: r.id, k: r.k, s: r.s, g: r.g, v: r.v, d: r.d, t: +now || 0 });
    while (log.length > Q.LOG) log.shift();
    if (s['~track'] === pid) delete s['~track'];
    return { ok: true, size: r.s, kind: r.k, hearts: Q.HEARTS[r.s] || 1, item, r };
  };
  // a record from a save: garbage records go (the count of good ones kept)
  Q.sanitize = function (rec) {
    const s = store(rec); if (!s) return 0;
    let n = 0;
    for (const k of Object.keys(s)) {
      if (k === '~log') { if (!Array.isArray(s[k])) delete s[k]; else s[k] = s[k].filter(e => e && typeof e === 'object' && typeof e.k === 'string').slice(-Q.LOG); continue; }
      if (k === '~day') { if (!s[k] || typeof s[k] !== 'object' || Array.isArray(s[k])) delete s[k]; continue; }
      if (k === '~track') { if (typeof s[k] !== 'string') delete s[k]; continue; }
      if (isRec(s[k]) && Array.isArray(s[k].home)) n++; else delete s[k];
    }
    // the days of quests done or given up long ago are forgotten
    const dm = s['~day']; if (dm) { const keys = Object.keys(dm); if (keys.length > 200) for (const k of keys.slice(0, keys.length - 200)) delete dm[k]; }
    return n;
  };

  // ================================================================ the words
  const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
  const lmName = (lm) => T('g.q.pl.' + lm);
  // a place's name (the journal), at the place (speech), to it, a photo of it
  Q.placeName = function (A) {
    if (!A) return '';
    if (A.kind === 'vista') return T('g.q.pl.vista', { lm: lmName(A.lm) });
    if (A.kind === 'village') return A.name || T('g.q.pl.village');
    if (A.kind === 'wonder') return A.name || T('g.q.pl.wonder');
    return lmName(A.lm || 'view');
  };
  const atOf = (A) => (!A ? '' : A.kind === 'vista' ? T('g.q.atv.' + A.lm) : A.kind === 'village' ? T('g.q.at.village', { name: A.name }) : A.kind === 'wonder' ? T('g.q.at.wonder', { name: A.name }) : T('g.q.at.' + (A.lm || 'view')));
  const toOf = (A) => (!A ? '' : A.kind === 'vista' ? T('g.q.tov.' + A.lm) : A.kind === 'village' ? T('g.q.to.village', { name: A.name }) : T('g.q.to.wonder', { name: A.name }));
  const ofOf = (A) => (!A ? '' : A.kind === 'village' ? T('g.q.of.village', { name: A.name }) : A.kind === 'wonder' ? T('g.q.of.wonder', { name: A.name }) : T('g.q.of.' + A.lm));
  const itemName = (id) => (VR.itemName ? VR.itemName(id) : id);
  const first = (r) => String(r.g || '').split(' ')[0];
  Q.title = function (r) {
    const q = r.q;
    switch (r.k) {
      case 'fetch': return T('g.q.t.fetch', { n: q.n, item: itemName(q.item), g: first(r) });
      case 'build': return T('g.q.t.build.' + q.what);
      case 'find': return T('g.q.t.find.' + q.thing);
      case 'escort': return T('g.q.t.escort', { g: first(r) });
      case 'photo': return T('g.q.t.photo', { of: ofOf(q.at), hour: T('g.q.hour.' + q.hour) });
      case 'free': return T('g.q.t.free');
      case 'travel': return T('g.q.t.travel', { dim: T('g.q.dim.' + q.dim) });
      case 'repair': return T('g.q.t.repair.' + q.what);
      case 'riddle': return T('g.q.t.riddle', { g: first(r) });
      default: return '';
    }
  };
  // the giver's words when offering
  Q.ask = function (r) {
    const q = r.q;
    switch (r.k) {
      case 'fetch': { let s = T('g.q.ask.fetch', { n: q.n, item: itemName(q.item) }) + ' ' + T('g.q.why.' + (FETCH[r.role] ? r.role : 'any')); if (q.hint) s += ' ' + T('g.q.hint', { at: cap(atOf(q.hint)) }); return s; }
      case 'build': return T('g.q.ask.build.' + q.what, { n: q.n, at: atOf(q.at) });
      case 'find': return T('g.q.ask.find.' + q.thing, { at: atOf(q.at), pet: q.pet });
      case 'escort': return T(r.age === 'child' ? 'g.q.ask.escort.child' : r.age === 'elder' ? 'g.q.ask.escort.elder' : 'g.q.ask.escort', { to: toOf(q.to), at: atOf(q.to) });
      case 'photo': return T(r.age === 'child' ? 'g.q.ask.photo.child' : 'g.q.ask.photo', { of: ofOf(q.at), hour: T('g.q.hour.' + q.hour) });
      case 'free': return T('g.q.ask.free', { at: atOf(q.at) });
      case 'travel': return T('g.q.ask.travel', { dim: T('g.q.dim.' + q.dim) });
      case 'repair': return T('g.q.ask.repair.' + q.what, { at: atOf(q.at) });
      case 'riddle': return T('g.q.ask.riddle') + ' ' + T('g.q.rid.' + q.rid + '.q');
      default: return '';
    }
  };
  // a reminder while it is open
  Q.still = function (r, tod) {
    const q = r.q;
    switch (r.k) {
      case 'fetch': return T('g.q.still.fetch', { n: q.n, item: itemName(q.item) });
      case 'build': return T('g.q.still.build', { a: r.n | 0, b: q.n });
      case 'find': return T('g.q.still.find.' + q.thing, { at: atOf(q.at), pet: q.pet });
      case 'escort': return T('g.q.still.escort', { to: toOf(q.to) });
      case 'photo': { const m = Math.ceil(Q.untilHour(q.hour, tod) / 1200); return T('g.q.still.photo', { of: ofOf(q.at), hour: T('g.q.hour.' + q.hour) }) + (m > 0 ? ' ' + T('g.q.soon', { m }) : ''); }
      case 'repair': return T('g.q.still.repair', { at: atOf(q.at) });
      case 'riddle': return T('g.q.rid.' + q.rid + '.q');
      default: return T('g.q.still.any');
    }
  };
  const KEYS = ['g.q.t.fetch', 'g.q.t.escort', 'g.q.t.photo', 'g.q.t.free', 'g.q.t.travel', 'g.q.t.riddle', 'g.q.ask.fetch', 'g.q.hint', 'g.q.ask.escort', 'g.q.ask.escort.child', 'g.q.ask.escort.elder',
    'g.q.ask.photo', 'g.q.ask.photo.child', 'g.q.ask.free', 'g.q.ask.travel', 'g.q.ask.riddle', 'g.q.still.fetch', 'g.q.still.build', 'g.q.still.escort', 'g.q.still.photo', 'g.q.still.repair', 'g.q.still.any', 'g.q.soon',
    'g.q.pl.vista', 'g.q.pl.village', 'g.q.pl.wonder', 'g.q.pl.plaza', 'g.q.pl.outpost', 'g.q.at.village', 'g.q.at.wonder', 'g.q.at.plaza', 'g.q.at.outpost', 'g.q.to.village', 'g.q.to.wonder', 'g.q.of.village', 'g.q.of.wonder',
    'g.q.dim.opal', 'g.q.dim.basalt', 'g.q.why.any',
    'g.q.btn.offer', 'g.q.btn.open', 'g.q.btn.ready', 'g.q.btn.accept', 'g.q.btn.later', 'g.q.btn.give', 'g.q.btn.go', 'g.q.btn.kit', 'g.q.btn.back', 'g.q.btn.drop',
    'g.q.full', 'g.q.later', 'g.q.askOther', 'g.q.none', 'g.q.doneToday', 'g.q.wait', 'g.q.short', 'g.q.wrong', 'g.q.right', 'g.q.photoHour', 'g.q.repairing', 'g.q.kitGiven', 'g.q.accepted', 'g.q.dropped',
    'g.q.escort.wait', 'g.q.escort.come', 'g.q.escort.arrive', 'g.q.escort.go', 'g.q.reward', 'g.q.rewardItem', 'g.q.toast.new', 'g.q.toast.done', 'g.q.toast.found', 'g.q.toast.photo', 'g.q.toast.repaired', 'g.q.toast.back',
    'g.q.j.title', 'g.q.j.open', 'g.q.j.ready', 'g.q.j.done', 'g.q.j.empty', 'g.q.j.track', 'g.q.j.tracked', 'g.q.j.drop', 'g.q.j.dropSure', 'g.q.j.from', 'g.q.j.where', 'g.q.j.sky', 'g.q.j.moon', 'g.q.j.whenNow', 'g.q.j.whenIn',
    'g.q.j.back', 'g.q.j.keys', 'g.q.j.close', 'g.q.j.prog', 'g.q.j.size.S', 'g.q.j.size.M', 'g.q.j.size.L', 'g.q.j.off', 'g.q.j.stub', 'g.q.pause', 'g.q.pauseTip', 'g.q.compass', 'g.q.done.any', 'g.q.done.pet',
    'g.dir.n', 'g.dir.ne', 'g.dir.e', 'g.dir.se', 'g.dir.s', 'g.dir.sw', 'g.dir.w', 'g.dir.nw', 'ctl.journal'];
  Q.keys = function () {
    const k = KEYS.slice();
    for (const kind of Q.KINDS) k.push('g.q.kind.' + kind, 'g.q.done.' + kind);
    for (const b of BUILD) k.push('g.q.t.build.' + b.what, 'g.q.ask.build.' + b.what);
    for (const t of Q.THINGS) k.push('g.q.t.find.' + t, 'g.q.ask.find.' + t, 'g.q.still.find.' + t, 'g.q.thing.' + t);
    for (const w of REPAIR_V.concat(REPAIR_P)) k.push('g.q.t.repair.' + w, 'g.q.ask.repair.' + w);
    for (const h in Q.HOURS) k.push('g.q.hour.' + h);
    for (const lm of Q.LM.concat(['view'])) k.push('g.q.pl.' + lm, 'g.q.at.' + lm, 'g.q.atv.' + lm, 'g.q.tov.' + lm);
    for (const lm of Q.LM) k.push('g.q.of.' + lm);
    for (const role in FETCH) if (role !== 'default') k.push('g.q.why.' + role);
    for (const r of Q.RIDDLES) { for (const p of ['q', 'a0', 'a1', 'a2', 'why']) k.push('g.q.rid.' + r.id + '.' + p); if (r.see) k.push('g.q.rid.' + r.id + '.see'); }
    return k;
  };

  // ================================================================ the glue (the game)
  const rec = () => (VR.Adventure && VR.Adventure.rec) || null;
  Q.on = function () {
    hooks();
    const g = game();
    return !!(VR.Adventure && VR.Adventure.on && VR.Adventure.on() && g && !(g.meta && g.meta.guest));
  };
  const save = () => { const g = game(); if (!g || !g.saveMeta) return; try { const p = g.saveMeta(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* the autosave keeps it */ } };
  Q.stats = { marks: 0, draws: 0, ticks: 0, offers: 0, done: 0 };

  // ---------------------------------------------------------------- the world's places (for a village)
  const PL = { key: null, vistas: null, asking: false };
  Q.placesNow = null;   // (a test may give the places itself)
  function heartOn(g) { const m = g && g.meta; return !!(m && (m.vgen | 0) >= 3 && m.type !== 'flat' && g.dim === 'overworld'); }
  function vistas(g) {
    const key = (g.meta && g.meta.id) + ':' + g.dim;
    if (PL.key !== key) { PL.key = key; PL.vistas = null; PL.asking = false; }
    if (PL.vistas || PL.asking) return PL.vistas;
    if (!heartOn(g) || (g.meta.vgen | 0) < 11 || !g.pool || !g.pool.direct) { PL.vistas = []; return PL.vistas; }
    PL.asking = true;
    try { g.pool.direct(0, { type: 'vistas', dim: g.dim }, null, (m) => { if (PL.key === key) { PL.vistas = (m && m.list) || []; PL.asking = false; } }); } catch (e) { PL.vistas = []; PL.asking = false; }
    return null;
  }
  // a village's places: null while the world's list is not complete (no offer, no ✦ until it is)
  Q.placesFor = function (vil) {
    if (Q.placesNow) return Q.placesNow;
    const g = game(); if (!g || !vil) return null;
    const vs = vistas(g); if (!vs) return null;
    const mgr = g.villages, P = vil.plan || vil, at0 = mgr && mgr.siteAt;
    // the villages' list (r 900 around where it was asked) holds every village within 600 of this one when asked near it
    const sitesOk = !mgr || !at0 || Math.hypot(at0[0] - P.x, at0[1] - P.z) <= 300;
    if (!sitesOk) return null;
    const key = vil.id + ':' + PL.key + ':' + (mgr && mgr.sites ? mgr.sites.length : 0);
    if (vil._qpl && vil._qpl.key === key) return vil._qpl.list;
    const list = Q.places({ heart: heartOn(g), vistas: vs, villages: (mgr && mgr.sites || []).filter(s => Math.hypot(s.x - P.x, s.z - P.z) <= 900), vid: vil.id });
    vil._qpl = { key, list };
    return list;
  };
  const villageOf = (vil) => { const P = vil.plan || vil; const pz = P.plaza; return { x: P.x, y: P.y, z: P.z, name: vil.name || P.name || '', plaza: pz ? [pz.x, pz.y, pz.z] : [P.x, P.y, P.z] }; };
  const seedOf = (g) => ((g.meta && g.meta.seed) >>> 0) || (g.seed >>> 0) || 0;
  const dayOf = (g) => (g.env ? g.env.day | 0 : 0);
  Q.giversOf = function (vil, day) {
    const g = game(); if (!g || !vil || !vil.people) return [];
    const key = day + ':' + vil.people.length;
    if (vil._qgv && vil._qgv.key === key) return vil._qgv.list;
    const list = Q.givers(seedOf(g), vil.id, day, vil.people);
    vil._qgv = { key, list };
    return list;
  };
  const ctxOf = (a, day) => {
    const g = game(), vil = a.vil, places = Q.placesFor(vil);
    if (!places) return null;
    return { seed: seedOf(g), vid: vil.id, pid: a.p.id, day, role: a.p.role || a.role, age: a.p.age || (a.kid ? 'child' : a.elder ? 'elder' : 'adult'), name: a.name || a.p.name, village: villageOf(vil), places };
  };
  // today's offer of a villager (a giver with nothing open, not done today), cached per day
  Q.offerOf = function (a) {
    const g = game(), r0 = rec(); if (!g || !r0 || !a || !a.vil) return null;
    const day = dayOf(g);
    if (Q.giversOf(a.vil, day).indexOf(a.p.id) < 0) return null;
    const ck = day + ':' + (r0.me.quests && r0.me.quests['~day'] ? r0.me.quests['~day'][a.p.id] : '');
    if (a._qoff && a._qoff.key === ck && !Q.get(r0, a.p.id)) return a._qoff.q;
    const c = ctxOf(a, day); if (!c) return null;
    const q = Q.offer(r0, c);
    if (q) q.age = c.age, q.role = c.role;
    a._qoff = { key: ck, q };
    return q;
  };
  // the marks (twice a second): 1 gold ✦ an offer, 2 cyan ✦ ready to hand in
  Q.mark = function (mgr) {
    let n = 0;
    const onNow = Q.on(), r0 = rec(), agents = (mgr && mgr.agents) || [];
    for (const a of agents) {
      let m = 0;
      if (onNow && r0 && a.p && a.vil) { const cur = Q.get(r0, a.p.id); m = cur ? (cur.st === 'ready' ? 2 : 0) : (Q.offerOf(a) ? 1 : 0); }
      a.qMark = m; if (m) n++;
    }
    Q.stats.marks = n;
    return n;
  };

  // ---------------------------------------------------------------- the talk
  const mkBtn = (label, q, fn, extra) => { const b = document.createElement('button'); b.className = 'btn small' + (extra ? ' ' + extra : ''); b.textContent = label; if (!b.dataset) b.dataset = {}; b.dataset.q = q; if (b.setAttribute) b.setAttribute('data-q', q); b.onclick = fn; return b; };
  const opts = () => (hasDoc ? document.querySelector('#tk_opts') : null);
  const setOpts = (list) => { const box = opts(); if (!box) return; box.innerHTML = ''; if (box.children && box.children.length) box.children.length = 0; for (const b of list) box.appendChild(b); };
  const say = (mgr, s) => { if (mgr && mgr.talkText) mgr.talkText(s); return s; };
  const back = (mgr, a) => mkBtn(T('g.q.btn.back'), 'back', () => { if (mgr.talkOptions) mgr.talkOptions(a); });
  // villages.js quest() (its first line): null in a builder's world (the classic request), else the text to show
  Q.talk = function (mgr, a) {
    if (!a || !a.p || !Q.on()) return null;
    const g = game(), r0 = rec(), pid = a.p.id, cur = Q.get(r0, pid);
    if (cur) {
      if (cur.st === 'ready') return Q.complete(mgr, a, cur);
      return open(mgr, a, cur);
    }
    const offer = Q.offerOf(a);
    if (offer) {
      setOpts([mkBtn(T('g.q.btn.accept'), 'accept', () => accept(mgr, a, offer), 'primary'), mkBtn(T('g.q.btn.later'), 'later', () => { say(mgr, T('g.q.later')); if (mgr.talkOptions) mgr.talkOptions(a); })]);
      Q.stats.offers++;
      return Q.ask(offer);
    }
    if (!Q.placesFor(a.vil) && Q.giversOf(a.vil, dayOf(g)).indexOf(pid) >= 0) return T('g.q.wait');
    const dm = r0.me.quests && r0.me.quests['~day'];
    if (dm && dm[pid] === dayOf(g)) return T('g.q.doneToday');
    // someone else in the village has a quest today
    const others = (a.vil.agents || mgr.agents || []).filter(o => o !== a && o.p && Q.offerOf(o));
    return others.length ? T('g.q.askOther', { n: others[0].p.name }) : T('g.q.none');
  };
  function accept(mgr, a, offer) {
    const g = game(), r0 = rec(); if (!g || !r0) return;
    const res = Q.accept(r0, offer, Date.now());
    if (!res.ok) { say(mgr, T(res.why === 'full' ? 'g.q.full' : 'g.q.later')); if (mgr.talkOptions) mgr.talkOptions(a); return; }
    let line = T('g.q.accepted');
    if (offer.k === 'build') { const n = Q.kit(g, offer); if (n) line += ' ' + T('g.q.kitGiven', { n, item: itemName(offer.q.block) }); }
    if (g.ui && g.ui.toast) g.ui.toast(T('g.q.toast.new'), Q.title(Q.get(r0, a.p.id)), null);
    if (g.audio && g.audio.play) g.audio.play('click');
    a._qoff = null; Q.mark(mgr);
    save();
    // Begleiten: the walk starts at once — the talk closes, the villager sets off
    if (offer.k === 'escort') { goEscort(mgr, a); return; }
    say(mgr, line);
    if (mgr.talkOptions) mgr.talkOptions(a);
  }
  function goEscort(mgr, a) { startEscort(mgr, a); if (mgr.closeTalk && mgr.talking === a) mgr.closeTalk(); if (a.say) a.say(T('g.q.escort.go'), 4); }
  // Bauen: the kit (the giver's parts) — topped up to what the quest still needs
  Q.kit = function (g, r) {
    const inv = g && g.player && g.player.inv, q = r && r.q; if (!inv || !q || !q.block) return 0;
    const need = Math.max(0, q.n - ((r.n | 0)) - inv.count(q.block)); if (!need) return 0;
    return inv.add(q.block, need) | 0;
  };
  // an open quest: its own buttons
  function open(mgr, a, r) {
    const g = game(), list = [];
    if (r.k === 'fetch') {
      const inv = g.player && g.player.inv, have = inv ? inv.count(r.q.item) : 0;
      list.push(mkBtn(T('g.q.btn.give', { n: r.q.n, item: itemName(r.q.item) }), 'give', () => { const h = Q.handIn(rec(), r.pid, inv); if (h.ok) say(mgr, Q.complete(mgr, a, Q.get(rec(), r.pid))); else say(mgr, T('g.q.short', { have: h.have | 0, n: r.q.n })); }, have >= r.q.n ? 'primary' : ''));
    } else if (r.k === 'riddle') {
      r.q.order.forEach((ans, i) => {
        const b = mkBtn(T('g.q.rid.' + r.q.rid + '.a' + ans), 'answer', () => { const res = Q.answer(rec(), r.pid, i); if (res.right) say(mgr, Q.complete(mgr, a, Q.get(rec(), r.pid))); else { say(mgr, T('g.q.wrong')); open(mgr, a, r); } }, 'answer');
        b.dataset.i = String(i); if (b.setAttribute) b.setAttribute('data-i', String(i));
        if (r.q.tried.indexOf(i) >= 0) { b.disabled = true; b.className += ' tried'; }
        list.push(b);
      });
    } else if (r.k === 'escort') list.push(mkBtn(T('g.q.btn.go'), 'go', () => goEscort(mgr, a), 'primary'));
    else if (r.k === 'build' && g.player && g.player.inv && g.player.inv.count(r.q.block) + (r.n | 0) < r.q.n) list.push(mkBtn(T('g.q.btn.kit'), 'kit', () => { const n = Q.kit(g, r); say(mgr, T('g.q.kitGiven', { n, item: itemName(r.q.block) })); }));
    list.push(back(mgr, a));
    setOpts(list);
    return Q.still(r, g.env ? g.env.timeOfDay : 0);
  }
  // the reward (at the giver or where it was done): VR.Adventure's XP and Sterntaler, the village's love, maybe an item
  Q.complete = function (mgr, a, r) {
    const g = game(), r0 = rec(); if (!g || !r0 || !r) return '';
    const f = Q.finish(r0, r.pid, Date.now(), dayOf(g)); if (!f.ok) return '';
    Q.stats.done++;
    const A = VR.Adventure, aw = A && A.award ? A.award('quest', { size: f.size, id: r.id }) : null;
    const vil = (a && a.vil) || (mgr && mgr.known && mgr.known.get ? mgr.known.get(r.vid) : null);
    if (vil && vil.st) vil.st.rep = (vil.st.rep || 0) + 2 * f.hearts;
    if (a && mgr && mgr.hearts) mgr.hearts(a);
    if (mgr && mgr.renderRep && mgr.talking === a) mgr.renderRep();
    if (f.item && g.player && g.player.inv) g.player.inv.add(f.item[0], f.item[1]);
    if (g.codex && g.codex.event) g.codex.event('quest');
    if (g.audio && g.audio.play) g.audio.play('levelup');
    const rw = T('g.q.reward', { xp: aw ? aw.xp : 0, t: aw ? aw.taler : 0, h: f.hearts }) + (f.item ? ' ' + T('g.q.rewardItem', { n: f.item[1], item: itemName(f.item[0]) }) : '');
    if (g.ui && g.ui.toast) g.ui.toast(T('g.q.toast.done'), Q.title(r) + ' · ' + rw, null);
    if (a) a._qoff = null;
    if (mgr) Q.mark(mgr);
    save();
    let line = r.k === 'riddle' ? T('g.q.right') + ' ' + T('g.q.rid.' + r.q.rid + '.why') + (Q.RIDDLES.some(x => x.id === r.q.rid && x.see) ? ' ' + T('g.q.rid.' + r.q.rid + '.see') : '') : r.k === 'find' && r.q.pet ? T('g.q.done.pet', { pet: r.q.pet }) : T('g.q.done.' + r.k);
    line += ' ' + rw;
    if (a && mgr && mgr.talking === a) { setOpts([]); if (mgr.talkOptions) mgr.talkOptions(a); }
    return line;
  };
  // done where it happened (built, repaired, arrived): the reward at once, the giver's thanks when you meet
  function completeAway(r) {
    const g = game(), mgr = g && g.villages, vil = mgr && mgr.known && mgr.known.get ? mgr.known.get(r.vid) : null;
    const a = vil && vil.agents ? vil.agents.find(x => x.p && x.p.id === r.pid) : null;
    const line = Q.complete(mgr, a, r);
    if (a && a.say) a.say(T('g.q.done.' + r.k), 4);
    return line;
  }
  // villages.js gift() (its first line): a held thing that is an open Bringen quest's item hands it in
  Q.gift = function (mgr, a) {
    if (!a || !a.p || !Q.on()) return false;
    const g = game(), r = Q.get(rec(), a.p.id), inv = g.player && g.player.inv, h = inv && inv.held;
    if (!r || r.k !== 'fetch' || !h || h.id !== r.q.item) return false;
    const res = Q.handIn(rec(), r.pid, inv);
    say(mgr, res.ok ? Q.complete(mgr, a, Q.get(rec(), r.pid)) : T('g.q.short', { have: res.have | 0, n: r.q.n }));
    return true;
  };
  // the other fronts' events (a-foes: 'freed', u-cruise: 'arrive')
  Q.emit = function (name, data) {
    if (!Q.on()) return [];
    const ready = Q.event(rec(), name, data);
    const g = game();
    for (const r of ready) if (g && g.ui && g.ui.toast) g.ui.toast(T('g.q.toast.back', { g: first(r), v: r.v }), Q.title(r), null);
    if (ready.length) save();
    return ready;
  };

  // ---------------------------------------------------------------- Begleiten: the villager walks (Villages wrapped)
  function startEscort(mgr, a) {
    if (!a || !mgr) return;
    a._qwait = 0;
    if (mgr.setAct) mgr.setAct(a, { type: 'escort' }); else a.act = { type: 'escort', phase: 'go', t: 0 };
  }
  Q.escortAct = function (mgr, a, dt) {
    const g = mgr.g, r0 = rec(), r = r0 && Q.get(r0, a.p.id);
    if (!r || r.k !== 'escort' || r.st !== 'open' || !Q.on()) { a.act = null; return; }
    const p = g.player.pos, to = r.q.to, st = Q.escortStep(r0, a.p.id, a.pos, p);
    a.act.t = (a.act.t || 0) + dt;
    if (st === 'arrived') { a.act = null; a.path = null; a.lookAt = [to.x, (to.top || a.pos[1] + 2), to.z]; if (a.say) a.say(T('g.q.escort.arrive'), 4); completeAway(r); return; }
    if (st === 'wait') {
      a.path = null; a.lookAt = [p[0], p[1] + 1.5, p[2]];
      a._qwait = (a._qwait || 0) - dt;
      if (a._qwait <= 0) { a._qwait = 7; if (a.say) a.say(T(Math.hypot(a.pos[0] - p[0], a.pos[2] - p[2]) > 30 ? 'g.q.escort.come' : 'g.q.escort.wait'), 3); }
      return;
    }
    a.lookAt = null;
    if (mgr.goTo) mgr.goTo(a, to.x, to.y !== null && to.y !== undefined ? to.y : a.pos[1], to.z, 2.5);
  };

  // ---------------------------------------------------------------- the 2-Hz timer: marks, targets, the repair ring
  Q.tick = function () {
    const g = game(); if (!g || g.state !== 'play') return;
    Q.stats.ticks++;
    const mgr = g.villages;
    if (!Q.on()) { if (Q.stats.marks && mgr) Q.mark(mgr); ring(null); return; }
    if (mgr) Q.mark(mgr);
    const r0 = rec(), list = Q.open(r0); if (!list.length) { ring(null); return; }
    const p = g.player; if (!p || !p.pos) return;
    const ges = r0.me.pts ? r0.me.pts.ges | 0 : 0;
    let rep = null;
    for (const e of Q.near(r0, p.pos, 0.5, ges)) {
      if (e.ev === 'found') { found(g, e.r); save(); }
      else if (e.ev === 'repair') { rep = e.p; if (g.particles && g.particles.spark) g.particles.spark(e.r.q.at.x, (e.r.q.at.y || p.pos[1]) + 1.2, e.r.q.at.z, [1, 0.85, 0.4], 6, 2.2, 1); }
      else if (e.ev === 'repaired') { rep = 1; if (g.particles && g.particles.spark) g.particles.spark(e.r.q.at.x, (e.r.q.at.y || p.pos[1]) + 1.4, e.r.q.at.z, [1, 0.95, 0.6], 40, 4, 1); if (g.audio && g.audio.play) g.audio.play('pop'); if (g.ui && g.ui.toast) g.ui.toast(T('g.q.toast.repaired'), Q.title(e.r), null); completeAway(e.r); }
    }
    ring(rep);
    // the find spots: the ground under them once loaded, a sparkle when near
    for (const r of list) {
      if (r.k !== 'find' || r.q.got) continue;
      const s = r.q.spot, d = Math.hypot(p.pos[0] - s[0], p.pos[2] - s[1]);
      if (d < 96 && (r.q.sy === undefined || r.q.sy === null)) r.q.sy = ground(g, s[0], s[1]);
      if (d < 40 && Number.isFinite(r.q.sy) && g.particles && g.particles.glow) g.particles.glow(s[0] + (Math.random() - 0.5) * 0.6, r.q.sy + 0.6 + Math.random() * 0.4, s[1] + (Math.random() - 0.5) * 0.6, [1, 0.88, 0.45], 1.6, 0.07, 0.5);
    }
  };
  function found(g, r) {
    if (g.audio) { if (r.q.thing === 'kitten' && g.audio.tone && g.audio.ctx) { const t = g.audio.ctx.currentTime || 0; g.audio.tone(880, 0.05, 0.12, 'triangle', true, t); g.audio.tone(1180, 0.05, 0.18, 'triangle', true, t + 0.1); g.audio.tone(990, 0.04, 0.22, 'triangle', true, t + 0.24); } else if (g.audio.play) g.audio.play('pop'); }
    if (g.particles && g.particles.spark) g.particles.spark(r.q.spot[0], (r.q.sy || g.player.pos[1]) + 0.6, r.q.spot[1], [1, 0.9, 0.5], 24, 3, 1);
    if (g.ui && g.ui.toast) g.ui.toast(T('g.q.toast.found'), T('g.q.toast.back', { g: first(r), v: r.v }), null);
  }
  // the ground's height at a column (the first solid block from above), null when not loaded
  function ground(g, x, z) {
    const w = g.world; if (!w || !w.getBlock || (w.isLoaded && !w.isLoaded(Math.floor(x), Math.floor(z)))) return null;
    const R = VR.R, F = VR.F;
    for (let y = Math.min(250, (VR.MAXY || 256) - 1); y > 1; y--) { const s = w.getBlock(Math.floor(x), y, Math.floor(z)); if (s && R && R.T.flags[s] & F.SOLID) return y + 1; }
    return null;
  }
  // the repair ring near the crosshair (a DOM element; written only when its value changes)
  let ringEl = null, ringV = -1;
  function ring(v) {
    if (!hasDoc) return;
    const k = v === null ? -1 : Math.round(v * 20);
    if (k === ringV) return; ringV = k;
    if (!ringEl) { const hud = document.getElementById('hud'); if (!hud) return; css(); ringEl = document.createElement('div'); ringEl.id = 'qring'; hud.appendChild(ringEl); }
    if (v === null) { ringEl.style.display = 'none'; return; }
    ringEl.style.display = ''; ringEl.style.setProperty && ringEl.style.setProperty('--p', String(Math.round(v * 100)));
    ringEl.textContent = T('g.q.repairing', { p: Math.round(v * 100) });
  }

  // ---------------------------------------------------------------- the ✦ and the targets in the world (draw, wrapped)
  const FULL = { sky: 1, bl: [1, 1, 1] };
  Q.draw = function (mgr, r, E, cam) {
    const g = mgr.g; if (!g || !g.entities || !Q.stats.marks && !Q.drawTargets) return;
    const LK = VR.LifeKit, ent = g.entities; if (!LK || !LK.drawModel) return;
    let p = null; const t = g.time || 0;
    if (Q.stats.marks) for (const a of mgr.agents) {
      if (!a.qMark || a.drawn === false) continue;
      const dx = a.pos[0] - cam.x, dz = a.pos[2] - cam.z; if (dx * dx + dz * dz > 48 * 48) continue;
      if (!p) p = ent.beginVox(r, E);
      const pos = [a.pos[0], a.pos[1] + (a.h || 1.75) * (a.kid ? 0.82 : 1) + 0.5 + Math.sin(t * 2.4 + a.p.seed) * 0.07, a.pos[2]];
      LK.drawModel(g, r, p, a.qMark === 2 ? 'quest_star_c' : 'quest_star', pos, t * 1.7 + a.p.seed, cam, { light: FULL, noShade: true, shade: 0 });
      Q.stats.draws++;
    }
    const tg = Q.drawTargets; if (!tg || !tg.length) return;
    for (const d of tg) {
      const dx = d.x - cam.x, dz = d.z - cam.z; if (dx * dx + dz * dz > 64 * 64) continue;
      if (!p) p = ent.beginVox(r, E);
      if (d.kind === 'kitten' || d.kind === 'puppy') LK.drawQuad(g, r, p, d.q || (d.q = { kind: d.kind === 'kitten' ? 'moss_cat' : 'life_dog', pos: [d.x, d.y, d.z], yaw: d.yaw, state: 'sit', walk: 0, walkAmt: 0, id: 3 }), cam, t);
      else LK.drawModel(g, r, p, d.model, [d.x, d.y + (d.hover ? 0.15 * Math.sin(t * 2) : 0), d.z], d.hover ? t * 1.4 : d.yaw, cam, d.hover ? { light: FULL, noShade: true, shade: 0 } : { shade: 0 });
      Q.stats.draws++;
    }
  };
  // what to draw at the open targets (the lost thing at its spot, a cyan ✦ over a repair, build or escort spot) —
  // rebuilt by the timer, not per frame
  function targets(g) {
    const out = [], list = Q.open(rec());
    for (const r of list) {
      if (r.st !== 'open') continue;
      if (r.k === 'find' && !r.q.got && Number.isFinite(r.q.sy)) {
        const th = r.q.thing, model = th === 'ball' ? 'life_ball' : 'quest_' + th;
        out.push({ kind: th, model, x: r.q.spot[0], y: r.q.sy + (th === 'kite' ? 0.02 : 0), z: r.q.spot[1], yaw: (Q.hash(r.id) % 628) / 100 });
      } else if ((r.k === 'repair' || r.k === 'build' || r.k === 'escort') && (r.k !== 'build' || r.q.at.kind !== 'plaza')) {
        const A = r.k === 'escort' ? r.q.to : r.q.at; if (A.y === null || A.y === undefined) continue;
        out.push({ kind: 'mark', model: 'quest_star_c', x: A.x, y: A.y + 2.6, z: A.z, hover: true });
      }
    }
    return out;
  }

  // ---------------------------------------------------------------- the photo (photomode.js's shoot, wrapped)
  Q.photoShot = function (cam) {
    const g = game(); if (!g || !cam || !Q.on()) return [];
    const res = Q.photo(rec(), cam, g.env ? g.env.timeOfDay : 0);
    const PM = VR.PhotoMode, ok = res.filter(e => e.ok), hour = res.find(e => e.why === 'hour');
    let msg = '';
    if (ok.length) { msg = T('g.q.toast.photo') + ' — ' + T('g.q.toast.back', { g: first(ok[0].r), v: ok[0].r.v }); save(); }
    else if (hour) msg = T('g.q.photoHour', { g: first(hour.r), hour: T('g.q.hour.' + hour.r.q.hour) });
    if (msg && PM && PM.note) setTimeout(() => PM.note(msg, 4200), 1900);
    Q.lastPhoto = { res: res.map(e => ({ pid: e.pid, ok: e.ok, why: e.why })), msg };
    return res;
  };

  // ---------------------------------------------------------------- the Tagebuch (J)
  const dirs = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'];
  const compass = (dx, dz) => T('g.dir.' + dirs[((Math.round(Math.atan2(dx, -dz) / (Math.PI / 4)) % 8) + 8) % 8]);
  Q.track = () => { const r0 = rec(), s = r0 && r0.me.quests; const pid = s && s['~track']; return pid && Q.get(r0, pid) ? Q.get(r0, pid) : (Q.open(r0).slice(-1)[0] || null); };
  // where Funke points and the compass shows: {x, y, z, label, kind}
  Q.target = function () {
    if (!Q.on()) return null;
    const r = Q.track(); if (!r) return null;
    const w = r.st === 'ready' && r.k !== 'free' ? { x: r.home[0], y: r.home[1], z: r.home[2], kind: 'village', name: r.v } : Q.where(r);
    if (!w || !Number.isFinite(w.x)) return null;
    return { x: w.x, y: Number.isFinite(w.y) ? w.y : null, z: w.z, label: r.st === 'ready' ? T('g.q.j.back', { g: first(r) }) : Q.title(r), kind: r.k, pid: r.pid };
  };
  function journalEl() {
    if (!hasDoc) return null;
    let s = document.getElementById('journal');
    if (!s) { css(); s = document.createElement('div'); s.id = 'journal'; s.className = 'screen'; if (s.setAttribute) s.setAttribute('id', 'journal'); const p = document.createElement('div'); p.className = 'panel box jcard'; s.appendChild(p); (document.getElementById('ui') || document.body).appendChild(s); }
    return s;
  }
  Q.jArm = null;
  Q.journal = function () {
    const g = game(); if (!g || !g.ui) return false;
    if (!Q.on()) { if (g.ui.hint) g.ui.hint(T('g.q.j.off'), 2600); return false; }
    journalEl(); g.ui.show('journal'); Q.renderJournal();
    return true;
  };
  Q.closeJournal = function () { const g = game(); if (g && g.ui && g.ui.screen === 'journal') { Q.jArm = null; if (g.ui.resume) g.ui.resume(); } };
  const COIN = '<svg class="coin" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="#ffc83d" stroke="#8a5208" stroke-width="1"/><path d="M12 5.8L13.47 9.98 17.9 10.08 14.38 12.77 15.64 17.02 12 14.5 8.36 17.02 9.62 12.77 6.1 10.08 10.53 9.98Z" fill="#fff6c8" stroke="#b86b0c" stroke-width=".6" stroke-linejoin="round"/></svg>';
  Q.renderJournal = function () {
    const s = journalEl(), g = game(), r0 = rec(); if (!s || !g || !r0) return;
    const p = s.querySelector('.panel'), list = Q.open(r0), tr = Q.track(), pos = g.player ? g.player.pos : [0, 0, 0], tod = g.env ? g.env.timeOfDay : 0;
    const A = VR.Adv, XP = A ? A.AWARDS.quest.xp : { S: 20, M: 50, L: 120 }, TL = A ? A.AWARDS.quest.taler : { S: 15, M: 40, L: 100 };
    let h = `<div class="jhead"><h2>${esc(T('g.q.j.title'))}</h2><button type="button" class="btn small" data-jact="close">${esc(T('g.q.j.close'))}</button></div>`;
    const card = (r) => {
      const w = r.st === 'ready' && r.k !== 'free' ? null : Q.where(r);
      let where = '';
      if (r.st === 'ready') where = T('g.q.j.back', { g: first(r) }) + ' · ' + esc(r.v);
      else if (w && w.sky) where = T('g.q.j.sky');
      else if (w && w.dim) where = T('g.q.j.moon', { dim: T('g.q.dim.' + w.dim) });
      else if (w) { const dx = w.x - pos[0], dz = w.z - pos[2]; where = T('g.q.j.where', { place: Q.placeName(w.spot ? r.q.at : w), d: fmt(Math.round(Math.hypot(dx, dz))), dir: compass(dx, dz) }); }
      let when = '';
      if (r.k === 'photo' && r.st === 'open') { const m = Math.ceil(Q.untilHour(r.q.hour, tod) / 1200); when = m > 0 ? T('g.q.j.whenIn', { hour: T('g.q.hour.' + r.q.hour), m }) : T('g.q.j.whenNow', { hour: T('g.q.hour.' + r.q.hour) }); }
      let prog = '';
      if (r.k === 'build' && r.st === 'open') prog = T('g.q.j.prog', { a: r.n | 0, b: r.q.n });
      if (r.k === 'repair' && r.st === 'open' && r.q.prog > 0) prog = T('g.q.repairing', { p: Math.round(r.q.prog * 100) });
      const stub = (r.k === 'free' || r.k === 'travel') && r.st === 'open' ? `<div class="jl note">${esc(T('g.q.j.stub'))}</div>` : '';
      const isT = tr && tr.pid === r.pid, arm = Q.jArm === r.pid;
      return `<div class="jq${r.st === 'ready' ? ' ready' : ''}${isT ? ' tracked' : ''}"><div class="ji">${Q.ICON[r.k]}</div><div class="jb"><div class="jt"><b>${esc(Q.title(r))}</b><span class="jsz s${r.s}">${esc(T('g.q.j.size.' + r.s))}</span></div>`
        + `<div class="jl note">${esc(T('g.q.j.from', { g: r.g, v: r.v }))} · ${esc(T('g.q.kind.' + r.k))}</div>`
        + (where ? `<div class="jl">🧭 ${esc(where)}</div>` : '') + (when ? `<div class="jl when">${esc(when)}</div>` : '') + (prog ? `<div class="jl">${esc(prog)}</div>` : '') + stub
        + `<div class="jr"><span class="chip">+${XP[r.s]} ${esc(T('g.adv.float', { n: '' }).replace(/[+\s]/g, '') || 'EP')}</span><span class="chip">${COIN}+${TL[r.s]}</span><span class="chip heart">♥ +${Q.HEARTS[r.s]}</span></div></div>`
        + `<div class="jbtn"><button type="button" class="btn small${isT ? ' on' : ''}" data-jact="track" data-pid="${esc(r.pid)}">${esc(T(isT ? 'g.q.j.tracked' : 'g.q.j.track'))}</button><button type="button" class="btn small${arm ? ' danger' : ''}" data-jact="drop" data-pid="${esc(r.pid)}">${esc(T(arm ? 'g.q.j.dropSure' : 'g.q.j.drop'))}</button></div></div>`;
    };
    const ready = list.filter(r => r.st === 'ready'), open2 = list.filter(r => r.st !== 'ready');
    if (!list.length) h += `<div class="jempty">${esc(T('g.q.j.empty'))}</div>`;
    if (ready.length) h += `<h3>${esc(T('g.q.j.ready'))}</h3>` + ready.map(card).join('');
    if (open2.length) h += `<h3>${esc(T('g.q.j.open'))}</h3>` + open2.map(card).join('');
    const log = Q.log(r0).slice(-5).reverse();
    if (log.length) h += `<h3>${esc(T('g.q.j.done'))}</h3><div class="jdone">` + log.map(e => `<div>${Q.ICON[e.k] || '✦'} ${esc(T('g.q.kind.' + e.k))} · ${esc(e.g)} · ${esc(e.v)}</div>`).join('') + '</div>';
    for (const fn of Q.journalSections) { try { const x = fn(); if (x) h += x; } catch (e) { /* a later front's section */ } }
    h += `<div class="jfoot note">${esc(T('g.q.j.keys'))}</div>`;
    p.innerHTML = h;
    if (p.querySelectorAll) for (const b of p.querySelectorAll('[data-jact]')) b.onclick = () => Q.jact(b.getAttribute('data-jact'), b.getAttribute('data-pid'));
  };
  Q.journalSections = [];   // (a-story: the chapter; a-foes: the freed places and the bosses — each a function → HTML)
  Q.jact = function (what, pid) {
    const r0 = rec(), s = r0 && r0.me.quests; if (!s) return;
    if (what === 'close') { Q.closeJournal(); return; }
    if (what === 'track' && Q.get(r0, pid)) { s['~track'] = pid; Q.jArm = null; save(); }
    if (what === 'drop') { if (Q.jArm === pid) { Q.drop(r0, pid); Q.jArm = null; save(); const g = game(); if (g && g.ui && g.ui.toast) g.ui.toast(T('g.q.dropped'), '', null); } else Q.jArm = pid; }
    Q.renderJournal();
  };

  // ---------------------------------------------------------------- the map: ✦ on the minimap and the big map, the compass line
  function mapHooks() {
    const MV = VR.MapView; if (!MV || MV.prototype.drawMini.__q) return;
    const od = MV.prototype.drawMini, ob = MV.prototype.renderBig, oc = MV.prototype.updateCompass;
    MV.prototype.drawMini = function () {
      od.apply(this, arguments);
      try {
        if (!Q.on()) return;
        const list = Q.open(rec()); if (!list.length) return;
        const g = this.g, p = g.player, ctx = this.mctx, W = this.mini.width, H = this.mini.height, sc = W / (128 * 0.8), tr = Q.track();
        ctx.save(); ctx.beginPath(); ctx.arc(W / 2, H / 2, W / 2 - 1, 0, Math.PI * 2); ctx.clip(); ctx.translate(W / 2, H / 2); ctx.rotate(p.yaw); ctx.scale(sc, sc);
        for (const r of list) {
          const w = r.st === 'ready' ? { x: r.home[0], z: r.home[2] } : Q.where(r); if (!w || !Number.isFinite(w.x)) continue;
          let dx = w.x - p.pos[0], dz = w.z - p.pos[2]; const L = Math.hypot(dx, dz), lim = (W / 2 - 9) / sc;
          if (L > lim) { dx *= lim / L; dz *= lim / L; }
          ctx.save(); ctx.translate(dx, dz); ctx.rotate(-p.yaw); ctx.scale(1 / sc, 1 / sc);
          star(ctx, 0, 0, tr && tr.pid === r.pid ? 7 : 5, r.st === 'ready' ? '#7cf3ff' : '#ffd166');
          ctx.restore();
        }
        ctx.restore();
      } catch (e) { /* the map draws on */ }
    };
    MV.prototype.renderBig = function () {
      ob.apply(this, arguments);
      try {
        if (!Q.on()) return;
        const list = Q.open(rec()); if (!list.length) return;
        const ctx = this.bctx, W = this.big.width, H = this.big.height, s = this.scale, cx = this.center[0], cz = this.center[1], tr = Q.track();
        ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        for (const r of list) {
          const w = r.st === 'ready' ? { x: r.home[0], z: r.home[2] } : Q.where(r); if (!w || !Number.isFinite(w.x)) continue;
          const sx = (w.x - cx) / s + W / 2, sy = (w.z - cz) / s + H / 2; if (sx < -30 || sy < -30 || sx > W + 30 || sy > H + 30) continue;
          star(ctx, sx, sy, tr && tr.pid === r.pid ? 10 : 7, r.st === 'ready' ? '#7cf3ff' : '#ffd166');
          const lab = Q.title(r); ctx.lineWidth = 3; ctx.strokeStyle = '#1a1206'; ctx.strokeText(lab, sx + 13, sy); ctx.fillStyle = '#fff1c4'; ctx.fillText(lab, sx + 13, sy);
        }
      } catch (e) { /* the map draws on */ }
    };
    MV.prototype.updateCompass = function () {
      oc.apply(this, arguments);
      try {
        const t = Q.target(); if (!t) { if (this._qc) { this._qc = null; this.lastCompass = null; } return; }
        const p = this.g.player, dx = t.x - p.pos[0], dz = t.z - p.pos[2], d = Math.round(Math.hypot(dx, dz));
        const a = Math.atan2(dx, -dz), rel = ((Math.round((a + p.yaw) * 180 / Math.PI) % 360) + 540) % 360 - 180;
        const arrow = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'][((Math.round(rel / 45) % 8) + 8) % 8];
        const line = `<br><span style="color:#ffd166">✦</span> ${esc(T('g.q.compass', { name: t.label, d: fmt(d), arrow }))}`;
        const html = (this.lastCompass || '') + line;
        if (this._qc !== html) { this._qc = html; this.compass.innerHTML = html; }
      } catch (e) { /* the compass shows on */ }
    };
    MV.prototype.drawMini.__q = true;
  }
  function star(ctx, x, y, R, col) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i & 1 ? R * 0.45 : R; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
    ctx.closePath(); ctx.fillStyle = col; ctx.strokeStyle = '#1a1206'; ctx.lineWidth = 1.5; ctx.fill(); ctx.stroke();
  }

  // ---------------------------------------------------------------- the hooks (installed once, when the game's parts are there)
  let hooked = false;
  function hooks() {
    if (hooked) return;
    const V = VR.Villages, A = VR.Adventure;
    if (!A) return;   // (quests.js runs after adventure.js in the game; a test loads it later)
    hooked = true;
    // placing: VR.Adventure.placed (a-core's chained g.onBlockPlaced) → the block read back from the world
    const op = A.placed;
    A.placed = function (x, y, z) {
      const r = op.apply(this, arguments);
      try {
        const g = game(), r0 = rec(); if (!g || !g.world || !r0 || !Q.on()) return r;
        const s = g.world.getBlock(x, y, z), R = VR.R, t = s && R ? R.types[R.T.type[s]] : null; if (!t) return r;
        for (const e of Q.placed(r0, x, y, z, t.name)) { if (e.ready) completeAway(Q.get(r0, e.pid)); else save(); }
      } catch (e) { console.warn('quests', e); }
      return r;
    };
    if (V && V.prototype && !V.prototype.talkOptions.__q) {
      const P = V.prototype, ot = P.talkOptions, oth = P.think, orun = P.runAct, od = P.draw;
      // the talk's first button: ✦ (an offer, an open quest, ready) — in place of „Kann ich helfen?"
      P.talkOptions = function (a) {
        const r = ot.apply(this, arguments);
        try {
          if (!Q.on() || !a || !a.p) return r;
          const box = opts(); if (!box) return r;
          const cur = Q.get(rec(), a.p.id), offer = cur ? null : Q.offerOf(a);
          const help = box.querySelectorAll ? [...box.querySelectorAll('button')].find(b => b.textContent === T('g.talk.help')) : null;
          if (!cur && !offer) return r;
          const b = mkBtn(T(cur ? (cur.st === 'ready' ? 'g.q.btn.ready' : 'g.q.btn.open') : 'g.q.btn.offer'), 'quest', () => { if (this.chirp) this.chirp(a); this.talkText(Q.talk(this, a)); }, 'qbtn');
          if (help && help.replaceWith) help.replaceWith(b); else if (box.insertBefore && box.firstChild) box.insertBefore(b, box.firstChild); else box.appendChild(b);
        } catch (e) { console.warn('quests', e); }
        return r;
      };
      P.think = function (a) { if (a.act && a.act.type === 'escort') return; return oth.apply(this, arguments); };
      P.runAct = function (a, dt) { if (a.act && a.act.type === 'escort') { try { Q.escortAct(this, a, dt); } catch (e) { a.act = null; } return; } return orun.apply(this, arguments); };
      P.draw = function (r, E, cam) { od.apply(this, arguments); try { Q.draw(this, r, E, cam); } catch (e) { /* the world draws on */ } };
      P.talkOptions.__q = true;
    }
    mapHooks();
    // the photo mode's picture
    const PM = VR.PhotoMode;
    if (PM && PM.Photo && !PM.Photo.prototype.shoot.__q) {
      const os = PM.Photo.prototype.shoot;
      PM.Photo.prototype.shoot = function () { try { if (!this.busy && this.s) Q.photoShot(this.s); } catch (e) { console.warn('quests', e); } return os.apply(this, arguments); };
      PM.Photo.prototype.shoot.__q = true;
    }
  }

  // ---------------------------------------------------------------- the pause menu (📖 Tagebuch after ⚔ Abenteuer) and J
  const UI = VR.UI;
  if (UI && UI.prototype.pause && !UI.prototype.pause.__q) {
    const opz = UI.prototype.pause;
    UI.prototype.pause = function () {
      const r = opz.apply(this, arguments);
      try {
        const panel = hasDoc && document.querySelector('#pause .panel'); if (!panel) return r;
        let b = panel.querySelector('[data-act="journal"]');
        if (!b) { b = document.createElement('button'); b.type = 'button'; b.className = 'btn qjbtn'; b.dataset.act = 'journal'; b.dataset.t = 'g.q.pause'; b.dataset.tt = 'g.q.pauseTip'; b.textContent = T('g.q.pause'); b.title = T('g.q.pauseTip'); (panel.querySelector('.ptop') || panel).appendChild(b); }
        b.style.display = Q.on() ? '' : 'none';
        // (after ⚔ Abenteuer: a-core puts its button in once this call has returned)
        setTimeout(() => { const adv = panel.querySelector('[data-act="adventure"]'); if (adv && adv.after && adv.nextElementSibling !== b) adv.after(b); }, 0);
      } catch (e) { console.warn('quests', e); }
      return r;
    };
    UI.prototype.pause.__q = true;
    const oa = UI.prototype.act;
    UI.prototype.act = function (a, b) { if (a === 'journal') { Q.journal(); return; } return oa.apply(this, arguments); };
  }
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('keydown', (e) => {
      const g = game(); if (!g || !g.ui) return;
      if (e.key === 'Escape' && g.ui.screen === 'journal') { e.preventDefault(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); Q.closeJournal(); return; }
      const B = VR.Binds && VR.Binds.current, codes = B ? B.codesFor('KeyJ') : null;
      if (!(codes ? codes.indexOf(e.code) >= 0 : e.code === 'KeyJ') || e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
      if (codes && B.owners && B.owners(e.code, 'journal').length) return;   // the key is another action's too: that one wins
      const t = e.target; if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
      if (g.ui.screen === 'journal') { e.preventDefault(); Q.closeJournal(); return; }
      if (g.state !== 'play' || g.ui.screen || g.ui.typing || g.photo || (g.photoCam && g.photoCam.on) || g.studioOpen) return;
      e.preventDefault(); Q.journal();
    }, true);
  }
  // the timer (a browser only — a node test drives Q.tick itself): twice a second
  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    setInterval(() => { try { hooks(); Q.tick(); const g = game(); Q.drawTargets = g && Q.on() ? targets(g) : null; } catch (e) { console.warn('quests', e); } }, 500);
  }

  // ---------------------------------------------------------------- the models (our own voxel art; VR.VOXMODELS)
  const M = VR.VOXMODELS, Grid = VR.VoxGrid;
  if (M && Grid) {
    const part = (sx, sy, sz, pv, fn) => { const gr = new Grid(sx, sy, sz, pv[0], pv[1], pv[2]); fn(gr); return { grid: gr, pivot: [0, 0, 0] }; };
    // the ✦: a five-pointed star, two voxels thick, a pale core and a warm rim — it glows (1 voxel = 1/24 block)
    const starModel = (core, mid, rim) => () => ({
      unit: 24, radius: 0.5, parts: {
        star: part(17, 17, 2, [8, 0, 1], (gr) => {
          const V = []; for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + i * Math.PI / 5, r = i & 1 ? 3.3 : 8.3; V.push([8.5 + Math.cos(a) * r, 8.5 + Math.sin(a) * r]); }
          const inside = (x, y) => { let c = false; for (let i = 0, j = 9; i < 10; j = i++) { const [xi, yi] = V[i], [xj, yj] = V[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
          for (let y = 0; y < 17; y++) for (let x = 0; x < 17; x++) {
            if (!inside(x + 0.5, y + 0.5)) continue;
            const edge = !inside(x - 0.5, y + 0.5) || !inside(x + 1.5, y + 0.5) || !inside(x + 0.5, y - 0.5) || !inside(x + 0.5, y + 1.5);
            const d = Math.hypot(x + 0.5 - 8.5, y + 0.5 - 8.5), c = edge ? rim : d < 2.6 ? core : mid;
            gr.set(x, y, 0, c, 1); gr.set(x, y, 1, c, 1);
          }
        }),
      }, layout: { star: [0, 0, 0] },
    });
    M.quest_star = starModel(0xfff7d0, 0xffd166, 0xff9a3c);
    M.quest_star_c = starModel(0xeaffff, 0x7cf3ff, 0x2fb6d8);
    // a kite stuck in the grass: a diamond in red and yellow quarters, a cross of sticks, a tail of bows (1/16 block)
    M.quest_kite = () => ({ unit: 16, radius: 0.8, parts: { body: part(12, 2, 22, [6, 0, 6], (gr) => {
      for (let z = 0; z < 16; z++) for (let x = 0; x < 12; x++) { const u = Math.abs(x + 0.5 - 6) / 6, v = Math.abs(z + 0.5 - 6) / (z < 6 ? 6 : 10); if (u + v > 1) continue; gr.set(x, 1, z, (x < 6) === (z < 6) ? 0xe8483a : 0xf6d24a); }
      for (let z = 0; z < 16; z++) gr.set(6, 1, z, 0x7a4e28); for (let x = 1; x < 11; x++) gr.set(x, 1, 6, 0x7a4e28);
      for (let z = 16; z < 22; z++) gr.set(6 + ((z >> 1) & 1), 0, z, z % 3 === 0 ? 0x3a7ad8 : 0xf4f0e6);
    }) }, layout: { body: [0, 0, 0] } });
    // a scarf lying in an S: red with white stripes and a fringe
    M.quest_scarf = () => ({ unit: 16, radius: 0.7, parts: { body: part(14, 2, 14, [7, 0, 7], (gr) => {
      for (let k = 0; k < 26; k++) { const tt = k / 25, x = Math.round(7 + Math.sin(tt * Math.PI * 2) * 4), z = Math.round(1 + tt * 11); const c = (k >> 1) % 3 === 0 ? 0xf4f0e6 : 0xd8343a; gr.set(x, 0, z, c); gr.set(x + 1, 0, z, c); gr.set(x + 2, 0, z, c); }
      for (const x of [3, 5, 7]) gr.set(x, 0, 13, 0xf4f0e6);
    }) }, layout: { body: [0, 0, 0] } });
    // a letter: a white envelope with a red seal and a ribbon
    M.quest_letter = () => ({ unit: 16, radius: 0.5, parts: { body: part(10, 1, 7, [5, 0, 3], (gr) => {
      gr.box(0, 0, 0, 9, 0, 6, 0xf6f2e8); for (let x = 0; x < 10; x++) { const z = Math.round(Math.abs(x - 4.5) * 0.7); gr.set(x, 0, z, 0xd8d0c0); }
      gr.set(4, 0, 3, 0xc0303a); gr.set(5, 0, 3, 0xc0303a); gr.set(4, 0, 4, 0xa02028); gr.set(5, 0, 4, 0xa02028);
    }) }, layout: { body: [0, 0, 0] } });
  }

  // ---------------------------------------------------------------- the look (the game's palette, injected once)
  let cssDone = false;
  function css() {
    if (cssDone || !hasDoc || !document.head || !document.head.appendChild) return; cssDone = true;
    const s = document.createElement('style'); s.id = 'questcss'; s.textContent = CSS; document.head.appendChild(s);
  }
  const CSS = `
#journal { align-items: center; justify-content: center; background: radial-gradient(ellipse at 50% 35%, rgba(36, 26, 8, .32), rgba(3, 5, 12, .62)); }
.jcard { width: min(760px, 96vw); display: flex; flex-direction: column; gap: 8px; }
.jcard .jhead { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.jcard h2 { margin: 0; font-size: 26px; color: #ffe7a6; text-shadow: 0 0 14px rgba(255, 186, 76, .4); }
.jcard h3 { margin: 8px 0 2px; font: 700 13px/1 var(--font); letter-spacing: 1.5px; text-transform: uppercase; color: var(--muted); }
.jcard .jq { display: grid; grid-template-columns: 44px 1fr auto; gap: 10px; align-items: start; padding: 10px 12px; border-radius: 14px; background: var(--slot); border: 1px solid var(--line); }
.jcard .jq.tracked { border-color: rgba(255, 209, 102, .75); box-shadow: 0 0 0 1px rgba(255, 209, 102, .25), 0 0 18px rgba(255, 190, 80, .18); }
.jcard .jq.ready { border-color: rgba(124, 243, 255, .75); background: linear-gradient(120deg, rgba(124, 243, 255, .12), var(--slot) 60%); }
.jcard .ji { font-size: 28px; line-height: 40px; text-align: center; }
.jcard .jt { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; } .jcard .jt b { font: 700 18px/1.2 var(--font); color: #fff; }
.jcard .jsz { font: 700 11px/1 var(--font); padding: 3px 7px; border-radius: 999px; background: rgba(255, 255, 255, .08); color: var(--muted); letter-spacing: .5px; }
.jcard .jsz.sM { color: #ffe08a; } .jcard .jsz.sL { color: #ffb36b; }
.jcard .jl { margin-top: 3px; font-size: 15px; color: #dfe8ff; } .jcard .jl.note { font-size: 13px; color: var(--muted); } .jcard .jl.when { color: #ffd9a0; }
.jcard .jr { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
.jcard .chip { display: inline-flex; align-items: center; gap: 4px; font: 700 13px/1 var(--font); color: #ffe7a6; padding: 4px 8px; border-radius: 999px; background: rgba(8, 12, 26, .55); border: 1px solid rgba(255, 209, 102, .3); }
.jcard .chip.heart { color: #ff9ab0; border-color: rgba(255, 120, 150, .35); } .jcard .chip .coin { width: 15px; height: 15px; }
.jcard .jbtn { display: flex; flex-direction: column; gap: 6px; } .jcard .jbtn .btn.on { border-color: #ffd166; color: #fff3cf; }
.jcard .jempty { padding: 16px; border-radius: 14px; border: 1px dashed rgba(255, 209, 102, .45); color: #ffeec4; font-size: 16px; line-height: 1.4; }
.jcard .jdone { display: flex; flex-direction: column; gap: 3px; font-size: 14px; color: var(--muted); }
.jcard .jfoot { margin-top: 4px; font-size: 13px; }
.jcard { max-height: 90vh; overflow: auto; }
.tkopts .qbtn { border-color: rgba(255, 209, 102, .85); color: #fff3cf; box-shadow: 0 0 12px rgba(255, 190, 80, .25); }
.tkopts .answer { min-width: 0; text-align: left; flex: 1 1 100%; }
.tkopts .answer.tried { opacity: .4; text-decoration: line-through; }
#qring { position: absolute; left: 50%; top: calc(50% + 34px); transform: translateX(-50%); padding: 5px 12px 5px 30px; border-radius: 999px; background: rgba(8, 12, 26, .7); color: #fff2c4; font: 700 14px/1 var(--font); pointer-events: none;
  background-image: conic-gradient(#ffd166 calc(var(--p, 0) * 1%), rgba(255, 255, 255, .15) 0); background-size: 16px 16px; background-repeat: no-repeat; background-position: 8px 50%; }
#pause .qjbtn { border-color: rgba(255, 209, 102, .45); }
`;
})(VR);
