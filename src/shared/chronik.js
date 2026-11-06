// ============================================================================
// r-chronik · VR.Chronik — the world that lives and remembers (plan docs/superpowers/plans/2026-11-07-r-chronik.md,
// spec docs/superpowers/specs/2026-11-07-revolution.md §R2). Pure: the worker runs it (worker_main.js job 'chronik'),
// the node tests run it (test/chronik.js), the main thread reads its ledger and texts.
//   the region   25 × 25 cells of 64 m round the world's anchor, each tagged once (biome class, height, wetness) from
//                the generator's cheap column info (C.sampler) — no chunk is generated; the villages of the region
//   the clock    game minutes t = day·1440 + tod·1440/24000 (env.day / env.ticks). advance(st, day, tod) runs the
//                hours (fronts drift, storms, rain) and at each day's end the day (ecology in 4 sub-steps, animals,
//                villages, new fronts, the ledger). A gap over 2 days is caught up coarsely: days only, ≤ 40 of them.
//   ecology      plant cover per cell (flowers, shrubs, trees, flora): logistic growth by season and water, spread to
//                the neighbours, a seed bank floor; animals (fox, deer, sheep, boar): capacity from food × habitat,
//                births in spring and summer (families: C.families), surplus wanders to the neighbour with room, a
//                species grown rare in the region gets a family wandering in. Quantised at each day's end.
//   villages     wood, grain, stone, cloth (whole numbers); production by the jobs × season × the land; food eaten;
//                trade with the nearest neighbours; building projects that complete over 1–3 days → st.out (the game
//                builds the village's next lot); never in the first two game days
//   fronts       rain, storm, snow drifting over the region by season: rain wets the land, a storm over old forest
//                may fell a tree; weatherAt(st, x, z)
//   the ledger   st.ev: {i, d, m, k, c, x, z, v, imp} — ≤ 6 world events a day (imp ≥ 5: ≤ 10), the player's deeds
//                always; the last 200 kept; notable(st, minImp, n). Places named from their first event
//                (VR.Names.chronikPlace). Peaceful only: animals wander away, trees fall in the storm.
// Save: C.save(st) → {v: 1, …} compact (typed arrays as base64), C.load(o) → st or null (missing, newer, broken).
// ============================================================================
(function (VR) {
  'use strict';
  const C = VR.Chronik = VR.Chronik || {};
  C.V = 1; C.CELL = 64; C.R = 12; C.MAXEV = 200; C.FINE = 2 * 1440; C.CATCH = 40; C.MAXFAM = 24; C.MAXPL = 80;
  const SIDE = C.R * 2 + 1, NC = SIDE * SIDE;
  C.CLS = ['meadow', 'forest', 'water', 'cold', 'dry', 'shore'];
  C.PLANTS = ['flowers', 'shrubs', 'trees', 'flora'];
  C.SP = ['fox', 'deer', 'sheep', 'boar'];
  C.MOB = { fox: 'glimmer_fox', deer: 'glimmer_deer', sheep: 'bloom_sheep', boar: 'moss_boar' };
  C.RES = ['wood', 'grain', 'stone', 'cloth'];
  C.SEASONS = ['spring', 'summer', 'autumn', 'winter'];
  C.season = (day) => Math.floor(Math.max(0, day) / 3) % 4;   // VR.Seasons' calendar: 3 days a season
  // ---------------------------------------------------------------- the tables
  const CAP = [[0.8, 0.4, 0.2, 0.5], [0.3, 0.6, 0.95, 0.3], [0.05, 0.1, 0.05, 0.1], [0.2, 0.3, 0.4, 0.1], [0.15, 0.3, 0.1, 0.2], [0.3, 0.3, 0.15, 0.2]];
  const RATE = [0.5, 0.15, 0.05, 0.3];
  const GROW = [[1.6, 1.2, 1.0, 1.4], [1.2, 1.0, 1.0, 1.2], [0.2, 0.4, 0.6, 0.3], [0, 0.1, 0.2, 0.05]];
  const DECL = [[0, 0, 0, 0], [0.02, 0, 0, 0.02], [0.12, 0.03, 0.004, 0.08], [0.15, 0.04, 0.004, 0.1]];
  const HAB = [[1, 0.8, 0, 0.3, 0.3, 0.4], [0.7, 1, 0, 0.5, 0.2, 0.2], [1, 0.3, 0, 0.4, 0.5, 0.5], [0.4, 1, 0, 0.2, 0.3, 0.3]];
  const FOOD = [[0.2, 0.6, 0, 0.2], [0.3, 0.4, 0.3, 0], [0.6, 0, 0, 0.4], [0, 0.5, 0.5, 0]];
  const KMAX = [3, 4, 5, 3];
  const BIRTH = [0.5, 0.25, 0.03, 0];
  const IMP_BORN = [5, 4, 3, 3];
  C.PROJ = { bakery: [20, 30, 10, 0, 2], well: [5, 0, 25, 0, 1], mill: [30, 10, 20, 5, 3], workshop: [30, 0, 15, 5, 2], school: [35, 10, 20, 10, 3], home: [25, 5, 10, 5, 2], garden: [5, 5, 5, 0, 1], bathhouse: [25, 0, 25, 5, 2], tower: [20, 0, 35, 0, 3] };
  const PROJ_ORDER = ['bakery', 'well', 'garden', 'mill', 'workshop', 'school', 'bathhouse', 'tower'];
  C.DEEDS = { freed: 9, fairy: 7, home: 6, helped: 5, fest: 4, gift: 3, befriend: 5, dance: 4 };
  C.ICON = { born: '🦊', wander: '🐾', bloom: '🌸', fell: '🌳', storm: '⛈', rain: '🌧', snow: '❄', built: '🏠', started: '🔨', trade: '⚖', harvest: '🌾', deed: '⭐' };
  C.SPICON = { fox: '🦊', deer: '🦌', sheep: '🐑', boar: '🐗' };
  // ---------------------------------------------------------------- hashes
  const h32 = (a, b, c) => { let x = Math.imul((a | 0) ^ 0x2c1b3c6d, 0x297a2d39) ^ Math.imul((b | 0) + 0x632be5ab, 0x85ebca6b) ^ Math.imul((c | 0) + 0x5bd1e995, 0xc2b2ae35); x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d); x ^= x >>> 12; x = Math.imul(x, 0x297a2d39); x ^= x >>> 15; return x >>> 0; };
  const h01 = (a, b, c) => h32(a, b, c) / 4294967296;
  const hs = (s) => { s = String(s); let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x | 0; };
  C.h01 = h01;
  const q255 = (v) => Math.round(Math.max(0, Math.min(1, v)) * 255) / 255;
  const q16 = (v) => Math.round(Math.max(0, Math.min(15.9, v)) * 16) / 16;
  C.classOf = function (key, y, sea) {
    const k = String(key || '');
    if (/ocean|river|lake/.test(k) || (y !== undefined && y < (sea || 63))) return 2;
    if (/beach|shore/.test(k)) return 5;
    if (/peak|snow|frozen|ice|slopes|windswept_gravelly/.test(k)) return 3;
    if (/desert|savanna|badland|mesa|canyon|ember/.test(k)) return 4;
    if (/forest|taiga|jungle|grove|dark|birch|swamp|mangrove/.test(k)) return 1;
    return 0;
  };
  // the generator's cheap column info (the worker): climate → biome, the surface height; wet near water
  C.sampler = function (g) {
    const BS = VR.BIOMES || [], SEA = (VR.C && VR.C.SEA) || 63;
    return (x, z) => {
      let y = 64, key = 'plains';
      try { y = g.surfaceY ? g.surfaceY(x, z) : 64; const b = g.biomeFor && g.climateAt ? g.biomeFor(g.climateAt(x, z), y) : null; if (b !== null && b !== undefined && BS[b]) key = BS[b].key; } catch (e) { /* plains */ }
      const c = C.classOf(key, y, SEA);
      return { b: C.CLS[c], h: y, w: c === 2 ? 1 : y < SEA + 4 ? 0.8 : c === 1 ? 0.6 : c === 4 ? 0.1 : 0.4 };
    };
  };

  // ---------------------------------------------------------------- the state
  C.create = function (seed, o) {
    o = o || {};
    const st = { v: C.V, seed: seed | 0, ox: Math.round(o.ox || 0), oz: Math.round(o.oz || 0), n: NC, t: 0, day: 0, ne: 0,
      cls: new Uint8Array(NC), hgt: new Uint8Array(NC), wet0: new Uint8Array(NC), wet: new Uint8Array(NC), vc: new Int8Array(NC).fill(-1),
      pl: {}, P: new Float32Array(NC * 4), A: new Float32Array(NC * 4), K: new Float32Array(NC * 4),
      fam: [], vil: [], fr: [], ev: [], out: [], dc: 0, dcd: -1, dday: -1, a0: [0, 0, 0, 0], wind: 0, cap: { animals: [0, 0, 0, 0] } };
    st.t = Math.max(0, Math.floor((o.day | 0) * 1440 + (o.tod || 0) * 1440 / 24000)); st.day = Math.floor(st.t / 1440);
    st.wind = h01(st.seed, 1, 0x77) * Math.PI * 2;
    const sample = o.sample || (() => ({ b: 'meadow', h: 68, w: 0.4 }));
    for (let i = 0; i < NC; i++) {
      const [x, z] = C.cellXZ(st, i), s = sample(x, z) || {};
      const c = Math.max(0, C.CLS.indexOf(s.b)); st.cls[i] = c;
      st.hgt[i] = Math.max(0, Math.min(255, Math.round(s.h || 64)));
      st.wet0[i] = st.wet[i] = Math.round(Math.max(0, Math.min(1, s.w === undefined ? 0.4 : s.w)) * 255);
    }
    capacity(st);
    for (let i = 0; i < NC; i++) for (let k = 0; k < 4; k++) {
      st.P[i * 4 + k] = q255(st.K[i * 4 + k] * (0.55 + 0.3 * h01(st.seed, i, 0x100 + k)));
    }
    foodCap(st);
    for (let i = 0; i < NC; i++) for (let s = 0; s < 4; s++) st.A[i * 4 + s] = q16(st.cap.k[i * 4 + s] * (0.4 + 0.4 * h01(st.seed, i, 0x200 + s)));
    st.a0 = C.totals(st).animals.map(v => Math.max(4, v));
    for (const v of (o.villages || []).slice(0, 12)) C.addVillage(st, v);
    return st;
  };
  C.cellXZ = (st, i) => [st.ox + ((i % SIDE) - C.R) * C.CELL + C.CELL / 2, st.oz + (Math.floor(i / SIDE) - C.R) * C.CELL + C.CELL / 2];
  C.cellOf = function (st, x, z) {
    const i = Math.floor((x - st.ox) / C.CELL) + C.R, j = Math.floor((z - st.oz) / C.CELL) + C.R;
    return i >= 0 && i < SIDE && j >= 0 && j < SIDE ? j * SIDE + i : -1;
  };
  const NBI = new Int16Array(NC * 4).fill(-1);
  for (let i = 0; i < NC; i++) { const x = i % SIDE, y = (i - x) / SIDE; if (x > 0) NBI[i * 4] = i - 1; if (x < SIDE - 1) NBI[i * 4 + 1] = i + 1; if (y > 0) NBI[i * 4 + 2] = i - SIDE; if (y < SIDE - 1) NBI[i * 4 + 3] = i + SIDE; }
  const NNC = new Uint8Array(NC); for (let i = 0; i < NC; i++) for (let k = 0; k < 4; k++) if (NBI[i * 4 + k] >= 0) NNC[i]++;
  const NB = (i, f) => { const x = i % SIDE, y = (i - x) / SIDE; if (x > 0) f(i - 1); if (x < SIDE - 1) f(i + 1); if (y > 0) f(i - SIDE); if (y < SIDE - 1) f(i + SIDE); };
  function capacity(st) {
    for (let i = 0; i < NC; i++) { const c = st.cls[i], w = st.wet[i] / 255; for (let k = 0; k < 4; k++) st.K[i * 4 + k] = CAP[c][k] * (0.6 + 0.4 * w); }
  }
  // the animals' capacity per cell from the food there (a season-steady food: the cover plus its floor)
  function foodCap(st) {
    const k = st.cap.k || (st.cap.k = new Float32Array(NC * 4)), tot = st.cap.animals = [0, 0, 0, 0], P = st.P, K = st.K;
    for (let i = 0; i < NC; i++) {
      const c = st.cls[i], b = i * 4;
      const f0 = Math.max(P[b], K[b] * 0.35), f1 = Math.max(P[b + 1], K[b + 1] * 0.35), f2 = Math.max(P[b + 2], K[b + 2] * 0.35), f3 = Math.max(P[b + 3], K[b + 3] * 0.35);
      for (let s = 0; s < 4; s++) {
        const F = FOOD[s], f = F[0] * f0 + F[1] * f1 + F[2] * f2 + F[3] * f3;
        const v = KMAX[s] * HAB[s][c] * Math.min(1, f * 1.6); k[b + s] = v; tot[s] += v;
      }
    }
  }
  C.VIL_R = 1800;   // villages beyond the grid (to 1.8 km) take part too: their trade, their projects; the land they read is the nearest edge cell
  const clampCell = (st, x, z) => { const i = Math.max(0, Math.min(SIDE - 1, Math.floor((x - st.ox) / C.CELL) + C.R)), j = Math.max(0, Math.min(SIDE - 1, Math.floor((z - st.oz) / C.CELL) + C.R)); return j * SIDE + i; };
  C.addVillage = function (st, v) {
    if (!v || st.vil.some(x => x.id === v.id) || st.vil.length >= 16) return null;
    if (Math.abs(v.x - st.ox) > C.VIL_R || Math.abs(v.z - st.oz) > C.VIL_R) return null;
    const c0 = C.cellOf(st, v.x, v.z), c = c0 >= 0 ? c0 : clampCell(st, v.x, v.z);
    const s = hs(v.id) ^ st.seed, pop = 12 + (h32(s, 1, 0x31) % 19);
    const around = [0, 0, 0, 0]; let n = 0;
    const take = (j) => { for (let p = 0; p < 4; p++) around[p] += st.P[j * 4 + p]; n++; };
    take(c); NB(c, take);
    const tr = around[2] / n, mead = around[0] / n, cold = st.cls[c] === 3 ? 1 : 0;
    const w = Math.ceil(pop / 2), wts = [0.5 + tr, 0.8 + mead, 0.4 + cold * 0.6, 0.4 + 0.3 * h01(s, 2, 0x32)], sw = wts.reduce((a, b) => a + b, 0);
    const jobs = wts.map(x => Math.max(1, Math.round(w * x / sw)));
    const order = PROJ_ORDER.slice(); for (let i = order.length - 1; i > 0; i--) { const j = h32(s, i, 0x33) % (i + 1); const t = order[i]; order[i] = order[j]; order[j] = t; }
    const vil = { id: String(v.id), name: String(v.name || v.id), x: Math.round(v.x), z: Math.round(v.z), c, far: c0 < 0 ? 1 : 0, pop, jobs, res: [0, 1, 2, 3].map(k => 10 + (h32(s, k, 0x34) % 31)), built: [], proj: null, order, tr: {} };
    st.vil.push(vil); markVil(st, vil, st.vil.length - 1);
    return vil;
  };

  function markVil(st, v, vi) { if (v.far) return; st.vc[v.c] = vi; NB(v.c, (j) => { if (st.vc[j] < 0) st.vc[j] = vi; }); }
  const vcell = (v) => (v.far ? -1 : v.c);
  // ---------------------------------------------------------------- the ledger
  function ev(st, k, c, v, imp, m, force) {
    const d = m !== undefined && st.dday >= 0 ? st.dday : Math.floor(st.t / 1440);
    if (!force) {
      if (st.dcd !== d) { st.dcd = d; st.dc = 0; }
      if (st.coarse && (imp < 4 || st.dc >= 1)) return null;
      if (st.dc >= 10 || (st.dc >= 6 && imp < 5)) return null;
      st.dc++;
    }
    const xz = c >= 0 ? C.cellXZ(st, c) : [v.x || 0, v.z || 0];
    const e = { i: ++st.ne, d, m: m === undefined ? st.t % 1440 : m, k, c, x: Math.round(v.x !== undefined ? v.x : xz[0]), z: Math.round(v.z !== undefined ? v.z : xz[1]), v: {}, imp };
    for (const key in v) if (key !== 'x' && key !== 'z') e.v[key] = v[key];
    if (c >= 0) placeFor(st, c, k === 'born' || k === 'wander' ? v.sp : k);
    st.ev.push(e); if (st.ev.length > C.MAXEV) st.ev.splice(0, st.ev.length - C.MAXEV);
    if (st.fresh) st.fresh.push(e);
    return e;
  }
  function placeFor(st, c, kind) {
    if (st.vc[c] >= 0 || st.pl[c]) return;
    if (Object.keys(st.pl).length >= C.MAXPL) return;
    const N = VR.Names; if (!N || !N.chronikPlace) return;
    const used = new Set(Object.values(st.pl).map(p => p.de));
    for (let k = 0; k < 12; k++) {
      const p = N.chronikPlace(kind, C.CLS[st.cls[c]], h32(st.seed, c, 0x500 + k));
      if (p && !used.has(p.de)) { st.pl[c] = { de: p.de, en: p.en, inDe: p.inDe, inEn: p.inEn, d: Math.floor(st.t / 1440) }; return; }
    }
  }
  C.deed = function (st, kind, o) {
    o = o || {};
    const imp = C.DEEDS[kind] || 3, c = C.cellOf(st, o.x || 0, o.z || 0);
    const v = { dk: kind, x: o.x || 0, z: o.z || 0 }; if (o.sp) v.sp = o.sp; if (o.who) v.who = String(o.who).slice(0, 40); if (o.pl) v.pl = String(o.pl).slice(0, 40);
    return ev(st, 'deed', c, v, imp, undefined, true);
  };
  C.notable = function (st, minImp, n) {
    const out = [];
    for (let i = st.ev.length - 1; i >= 0 && out.length < (n || 20); i--) if (st.ev[i].imp >= (minImp || 0)) out.push(st.ev[i]);
    return out;
  };
  C.families = (st) => st.fam;
  C.familiesNear = (st, x, z, r) => st.fam.filter(f => { const [fx, fz] = C.cellXZ(st, f.c); return Math.hypot(fx - x, fz - z) <= r; });
  C.totals = function (st) {
    const p = [0, 0, 0, 0], a = [0, 0, 0, 0];
    for (let i = 0; i < NC; i++) for (let k = 0; k < 4; k++) { p[k] += st.P[i * 4 + k]; a[k] += st.A[i * 4 + k]; }
    return { plants: p, animals: a };
  };
  C.weatherAt = function (st, x, z) {
    let best = null;
    for (const f of st.fr) { const d = Math.hypot(f.x - x, f.z - z); if (d < f.r && (!best || d / f.r < best.k)) best = { kind: f.k, k: d / f.r, id: f.id }; }
    return best;
  };

  // ---------------------------------------------------------------- the day
  function daily(st, dd) {
    st.dday = dd; daily0(st, dd); st.dday = -1;
  }
  function daily0(st, dd) {
    const se = C.season(dd);
    plantsDay(st, se);
    animalsDay(st, se);
    const A = st.A, Kc = st.cap.k, P = st.P;
    const tot = C.totals(st).animals;
    for (let s = 0; s < 4; s++) {
      // a species grown rare in the region: a family wanders in
      if (tot[s] < st.a0[s] * 0.35) {
        const c = pickCell(st, dd, 0x600 + s, (i) => Kc[i * 4 + s] - A[i * 4 + s]);
        if (c >= 0) { A[c * 4 + s] = q16(A[c * 4 + s] + 4); addFam(st, s, c, dd, 2); ev(st, 'wander', c, { sp: C.SP[s], n: 2 }, 3); }
      }
    }
    // families born (spring, summer): ≤ 2 a day
    st.fam = st.fam.filter(f => dd - f.d < 9);
    if (BIRTH[se] >= 0.2) {
      const order = [0, 1, 2, 3].sort((a, b) => h01(st.seed, dd, 0x700 + a) - h01(st.seed, dd, 0x700 + b));
      let born = 0;
      for (const s of order) {
        if (born >= 2 || st.fam.length >= C.MAXFAM || h01(st.seed, dd, 0x710 + s) > 0.55) continue;
        const c = pickCell(st, dd, 0x720 + s, (i) => (A[i * 4 + s] >= Math.min(2, 0.5 * Kc[i * 4 + s]) && A[i * 4 + s] > 0.5 && A[i * 4 + s] < 0.95 * Kc[i * 4 + s] ? Kc[i * 4 + s] : 0));
        if (c < 0) continue;
        const n = 1 + (h32(st.seed, dd * 7 + s, 0x730) % 3);
        A[c * 4 + s] = q16(A[c * 4 + s] + n * 0.5);
        addFam(st, s, c, dd, n); born++;
        ev(st, 'born', c, { sp: C.SP[s], n }, IMP_BORN[s], 360 + (h32(st.seed, dd, 0x740 + s) % 600));
      }
    }
    // the meadows bloom (once a spring, the richest meadow)
    if (se === 0 && dd % 3 === 1) {
      const c = pickCell(st, dd, 0x800, (i) => (st.cls[i] === 0 ? P[i * 4] * P[i * 4] : 0));
      if (c >= 0) ev(st, 'bloom', c, { pk: h01(st.seed, dd, 0x801) < 0.5 ? 'poppy' : 'bell' }, 3, 540);
    }
    if (se === 3 && dd % 3 === 0) { const c = pickCell(st, dd, 0x810, (i) => (st.cls[i] === 3 ? 2 : st.cls[i] === 1 ? 1 : 0)); if (c >= 0) ev(st, 'snow', c, {}, 3, 420); }
    // wetness dries back toward its own
    for (let i = 0; i < NC; i++) st.wet[i] = Math.round(st.wet[i] + (st.wet0[i] - st.wet[i]) * 0.25);
    villages(st, dd, se);
    fronts(st, dd, se);
  }
  function plantsDay(st, se) {
    // ecology: 4 sub-steps of a quarter day
    capacity(st);
    const P = st.P, K = st.K, tmp = st.tmp || (st.tmp = new Float32Array(NC * 4));
    const g0 = RATE[0] * GROW[se][0], g1 = RATE[1] * GROW[se][1], g2 = RATE[2] * GROW[se][2], g3 = RATE[3] * GROW[se][3];
    const RG = st.rg || (st.rg = new Float64Array(4)), DL = st.dl || (st.dl = new Float64Array(4));
    RG[0] = g0; RG[1] = g1; RG[2] = g2; RG[3] = g3; for (let k = 0; k < 4; k++) DL[k] = DECL[se][k];
    const wet = st.wet;
    for (let sub = 0; sub < 4; sub++) {
      for (let i = 0; i < NC; i++) {
        const b = i * 4, n0 = NBI[b], n1 = NBI[b + 1], n2 = NBI[b + 2], n3 = NBI[b + 3], w = 0.5 + wet[i] / 255, inv = 1 / NNC[i];
        for (let k = 0; k < 4; k++) {
          const j = b + k, Kj = K[j];
          if (Kj <= 0) { tmp[j] = 0; continue; }
          const p0 = P[j];
          let nb = 0;
          if (n0 >= 0) nb += P[n0 * 4 + k];
          if (n1 >= 0) nb += P[n1 * 4 + k];
          if (n2 >= 0) nb += P[n2 * 4 + k];
          if (n3 >= 0) nb += P[n3 * 4 + k];
          const p = p0 + 0.25 * (RG[k] * w * p0 * (1 - p0 / Kj) - DL[k] * p0 + 0.06 * (nb * inv - p0));
          const lo = Kj * 0.03;
          tmp[j] = p < lo ? lo : p > Kj ? Kj : p;
        }
      }
      P.set(tmp);
    }
    for (let j = 0; j < NC * 4; j++) P[j] = q255(P[j]);
  }
  function animalsDay(st, se) {
    const tmp = st.tmp;
    // the animals
    foodCap(st);
    const A = st.A, Kc = st.cap.k;
    for (let i = 0; i < NC; i++) for (let s = 0; s < 4; s++) {
      const j = i * 4 + s, Ka = Kc[j]; let a = A[j];
      if (Ka <= 0.05) { tmp[j] = a * 0.7; continue; }   // nothing to eat here: they wander off
      a += BIRTH[se] * a * Math.max(0, 1 - a / Ka) - 0.01 * a;
      if (a > Ka) a -= 0.25 * (a - Ka);
      tmp[j] = Math.max(0, a);
    }
    // surplus wanders to the neighbour with the most room
    for (let i = 0; i < NC; i++) for (let s = 0; s < 4; s++) {
      const j = i * 4 + s, sur = tmp[j] - 0.8 * Kc[j]; if (sur <= 0.1) continue;
      let best = -1, room = 0;
      for (let e = 0; e < 4; e++) { const q = NBI[i * 4 + e]; if (q < 0) continue; const r = Kc[q * 4 + s] - tmp[q * 4 + s]; if (r > room) { room = r; best = q; } }
      if (best >= 0) { const m = Math.min(sur * 0.3, room * 0.5); tmp[j] -= m; tmp[best * 4 + s] += m; }
    }
    for (let j = 0; j < NC * 4; j++) A[j] = q16(tmp[j]);
  }
  function addFam(st, s, c, dd, n) { st.fam.push({ i: (st.ne + 1) * 8 + s, sp: C.SP[s], c, d: dd, n }); if (st.fam.length > C.MAXFAM) st.fam.shift(); }
  // a cell by weight (deterministic: a hashed threshold over the weights' running sum)
  function pickCell(st, dd, salt, wfn) {
    let sum = 0; const W = st.wbuf || (st.wbuf = new Float32Array(NC));
    for (let i = 0; i < NC; i++) { const w = Math.max(0, wfn(i)); W[i] = w; sum += w; }
    if (sum <= 0) return -1;
    let r = h01(st.seed, dd, salt) * sum;
    for (let i = 0; i < NC; i++) { r -= W[i]; if (r <= 0 && W[i] > 0) return i; }
    return -1;
  }
  function villages(st, dd, se) {
    const GS = [0.6, 1.2, 1.6, 0.2][se];
    for (let vi = 0; vi < st.vil.length; vi++) {
      const v = st.vil[vi], c = v.c, R0 = v.res;
      let tr = st.P[c * 4 + 2], sh = 0, n = 1; NB(c, (j) => { tr += st.P[j * 4 + 2]; sh += st.A[j * 4 + 2]; n++; }); tr /= n;
      R0[0] += Math.round(v.jobs[0] * 2 * (0.5 + tr));
      R0[1] += Math.round(v.jobs[1] * 3 * GS);
      R0[2] += Math.round(v.jobs[2] * 2);
      R0[3] += Math.round(v.jobs[3] * 1.5 * (0.6 + Math.min(1, sh / 8)));
      R0[1] = Math.max(0, R0[1] - Math.ceil(v.pop * 0.4)); R0[3] = Math.max(0, R0[3] - Math.ceil(v.pop * 0.15));
      if (se === 3) R0[0] = Math.max(0, R0[0] - Math.ceil(v.pop * 0.2));
      for (let k = 0; k < 4; k++) R0[k] = Math.min(9999, R0[k]);
      // the woodcutters thin the trees a little (never below the seed bank)
      const cut = v.jobs[0] * 0.002; NB(c, (j) => { const q = j * 4 + 2; st.P[q] = q255(Math.max(st.K[q] * 0.03, st.P[q] - cut)); });
      if (se === 2 && dd % 3 === 1) ev(st, 'harvest', vcell(v), { vil: v.name, x: v.x, z: v.z }, 2, 900);
      // the building project
      if (v.proj) {
        v.proj.p = Math.round((v.proj.p + 1 / C.PROJ[v.proj.k][4]) * 1000) / 1000;
        if (v.proj.p >= 0.999 && dd + 1 >= 2) {
          v.built.push(v.proj.k); if (v.proj.k === 'home') v.pop += 2; else v.pop += 1;
          const e = ev(st, 'built', vcell(v), { vil: v.name, b: v.proj.k, x: v.x, z: v.z }, 6, 600 + (h32(st.seed, dd, 0x900 + vi) % 400));
          st.out.push({ vid: v.id, k: v.proj.k, d: dd + 1, e: e ? e.i : 0 });
          if (st.out.length > 32) st.out.shift();
          v.proj = null;
        }
      } else if (dd >= 1) {
        const k = v.built.length < v.order.length ? v.order[v.built.length] : 'home', cost = C.PROJ[k];
        if (R0[0] >= cost[0] && R0[1] >= cost[1] + v.pop && R0[2] >= cost[2] && R0[3] >= cost[3]) {
          for (let r = 0; r < 4; r++) R0[r] -= cost[r];
          v.proj = { k, p: 0, d: dd };
          ev(st, 'started', vcell(v), { vil: v.name, b: k, x: v.x, z: v.z }, 2, 480);
        }
      }
    }
    // trade with the nearest neighbour (surplus for deficit)
    for (let a = 0; a < st.vil.length; a++) {
      const va = st.vil[a]; let b = -1, bd = 1500;
      for (let j = 0; j < st.vil.length; j++) { if (j === a) continue; const d = Math.hypot(st.vil[j].x - va.x, st.vil[j].z - va.z); if (d < bd) { bd = d; b = j; } }
      if (b < 0 || b < a && nearestOf(st, b) === a) continue;   // (each pair once a day)
      const vb = st.vil[b];
      let give = -1, want = -1, gm = 0, wm = 0;
      for (let r = 0; r < 4; r++) { const d = va.res[r] - vb.res[r]; if (d > gm) { gm = d; give = r; } if (-d > wm) { wm = -d; want = r; } }
      if (give < 0 || want < 0 || gm < 16 || wm < 16) continue;
      const n1 = Math.min(12, Math.floor(gm / 4)), n2 = Math.min(12, Math.floor(wm / 4));
      va.res[give] -= n1; vb.res[give] += n1; vb.res[want] -= n2; va.res[want] += n2;
      const key = vb.id; if (!(dd - (va.tr[key] === undefined ? -99 : va.tr[key]) >= 3)) continue;
      va.tr[key] = dd;
      ev(st, 'trade', vcell(va), { vil: va.name, vil2: vb.name, r: C.RES[give], r2: C.RES[want], x: va.x, z: va.z }, 2, 700);
    }
  }
  function nearestOf(st, a) { const va = st.vil[a]; let b = -1, bd = 1500; for (let j = 0; j < st.vil.length; j++) { if (j === a) continue; const d = Math.hypot(st.vil[j].x - va.x, st.vil[j].z - va.z); if (d < bd) { bd = d; b = j; } } return b; }
  function fronts(st, dd, se) {
    if (st.coarse) { st.fr.length = 0; return; }
    if (st.fr.length >= 2) return;
    const r = h01(st.seed, dd, 0xa00);
    const k = se === 3 ? (r < 0.6 ? 'snow' : null) : se === 0 ? (r < 0.6 ? 'rain' : null) : se === 1 ? (r < 0.35 ? 'storm' : r < 0.65 ? 'rain' : null) : (r < 0.4 ? 'storm' : r < 0.9 ? 'rain' : null);
    if (!k) return;
    const wa = st.wind + (h01(st.seed, dd, 0xa01) - 0.5) * 1.2, span = (C.R + 4) * C.CELL;
    const off = (h01(st.seed, dd, 0xa02) - 0.5) * span;
    const ux = Math.cos(wa), uz = Math.sin(wa);
    const f = { id: dd * 4 + st.fr.length, k, x: Math.round(st.ox - ux * span - uz * off), z: Math.round(st.oz - uz * span + ux * off), vx: 0, vz: 0, r: 250 + (h32(st.seed, dd, 0xa03) % 150), fell: 0, h: 0 };
    const sp = 50 + (h32(st.seed, dd, 0xa04) % 40); f.vx = Math.round(ux * sp); f.vz = Math.round(uz * sp);
    st.fr.push(f);
  }
  // ---------------------------------------------------------------- the hour
  function hourly(st, H) {
    const span = (C.R + 6) * C.CELL;
    for (let fi = st.fr.length - 1; fi >= 0; fi--) {
      const f = st.fr[fi]; f.x += f.vx; f.z += f.vz; f.h++;
      if (Math.abs(f.x - st.ox) > span + f.r || Math.abs(f.z - st.oz) > span + f.r || f.h > 60) { st.fr.splice(fi, 1); continue; }
      const c0 = C.cellOf(st, f.x, f.z);
      if (c0 >= 0 && !f.seen) { f.seen = 1; if (f.k !== 'snow') ev(st, f.k === 'storm' ? 'storm' : 'rain', c0, {}, f.k === 'storm' ? 3 : 1); }
      if (f.k === 'snow') continue;
      const rr = Math.ceil(f.r / C.CELL), cx = Math.floor((f.x - st.ox) / C.CELL) + C.R, cz = Math.floor((f.z - st.oz) / C.CELL) + C.R;
      for (let j = cz - rr; j <= cz + rr; j++) for (let i = cx - rr; i <= cx + rr; i++) {
        if (i < 0 || j < 0 || i >= SIDE || j >= SIDE) continue;
        const c = j * SIDE + i, dx = st.ox + (i - C.R) * C.CELL + C.CELL / 2 - f.x, dz = st.oz + (j - C.R) * C.CELL + C.CELL / 2 - f.z; if (dx * dx + dz * dz > f.r * f.r) continue;
        st.wet[c] = Math.min(255, st.wet[c] + 6);
        if (f.k === 'storm' && !f.fell && st.cls[c] === 1 && st.P[c * 4 + 2] > 0.55 && h01(st.seed, H, 0xb00 + c) < 0.02) {
          f.fell = 1; st.P[c * 4 + 2] = q255(st.P[c * 4 + 2] - 0.08);
          ev(st, 'fell', c, { tree: h01(st.seed, c, 0xb01) < 0.6 ? 'oak' : 'beech' }, 5);
        }
      }
    }
  }
  // ---------------------------------------------------------------- the clock
  C.advance = function (st, day, tod) {
    const T = Math.max(0, Math.floor((day | 0) * 1440 + (+tod || 0) * 1440 / 24000));
    const res = { events: [], out: [], hours: 0, days: 0 };
    if (T <= st.t) return res;
    st.fresh = res.events; const out0 = st.out.length;
    if (T - st.t > C.FINE) {
      // the catch-up: days only (≤ C.CATCH of them), the ledger only for the important things
      let d0 = Math.floor(st.t / 1440); const d1 = Math.floor(T / 1440);
      if (d1 - d0 > C.CATCH) d0 = d1 - C.CATCH;
      st.coarse = true;
      for (let dd = d0; dd < d1; dd++) { st.t = (dd + 1) * 1440; daily(st, dd); res.days++; }
      st.coarse = false; st.fr.length = 0; st.t = d1 * 1440;
    }
    let H = Math.floor(st.t / 60) + 1;
    while (H * 60 <= T) {
      st.t = H * 60;
      if (H % 24 === 0) { daily(st, H / 24 - 1); res.days++; }
      hourly(st, H); res.hours++;
      H++;
    }
    st.t = T; st.day = Math.floor(T / 1440); st.fresh = null;
    res.out = st.out.slice(out0);
    return res;
  };
  C.take = function (st) { const o = st.out.slice(); st.out.length = 0; return o; };

  // ---------------------------------------------------------------- texts (main thread: VR.I18N)
  C.KEYS = [];
  const T = (k, v) => (VR.I18N ? VR.I18N.t(k, v) : k);
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  C.placeOf = function (st, e, lang) {
    const de = (lang || (VR.I18N && VR.I18N.lang)) === 'de';
    if (e.k === 'deed' && e.v.pl) return (de ? 'in ' : 'in ') + e.v.pl;
    const c = e.c;
    if (c >= 0 && st.vc[c] >= 0 && st.vil[st.vc[c]]) { const v = st.vil[st.vc[c]]; const nm = VR.Names && VR.Names.shown ? VR.Names.shown(v.name, de ? 'de' : 'en') : v.name; return (st.vil[st.vc[c]].c === c ? 'in ' : de ? 'bei ' : 'near ') + nm; }
    const p = c >= 0 ? st.pl[c] : null;
    if (p) return de ? p.inDe : p.inEn;
    let best = null, bd = 1e9;
    for (const v of st.vil) { const d = Math.hypot(v.x - e.x, v.z - e.z); if (d < bd) { bd = d; best = v; } }
    if (best && bd < 900) return (de ? 'bei ' : 'near ') + best.name;
    return T('g.ch.wild');
  };
  C.vars = function (e, st) {
    const p = C.placeOf(st, e), v = e.v || {};
    const o = { in: p, In: cap(p), n: v.n || 0, vil: v.vil ? (VR.Names && VR.Names.shown ? VR.Names.shown(v.vil) : v.vil) : '', vil2: v.vil2 ? (VR.Names && VR.Names.shown ? VR.Names.shown(v.vil2) : v.vil2) : '', who: v.who || '' };
    if (v.sp) { o.fam = T('g.ch.fam.' + v.sp); o.Fam = cap(o.fam); o.sp = T('g.ch.sp.' + v.sp); }
    if (v.b) o.b = T('g.ch.b.' + v.b);
    if (v.r) { o.r = T('g.ch.r.' + v.r); o.r2 = T('g.ch.r.' + (v.r2 || v.r)); }
    if (v.pk) o.pk = T('g.ch.pk.' + v.pk);
    if (v.tree) o.tree = T('g.ch.tree.' + v.tree);
    return o;
  };
  C.keyOf = (e) => 'g.ch.ev.' + e.k + (e.k === 'deed' ? '.' + (e.v.dk || 'gift') : '') + (e.k === 'born' && e.v.n === 1 ? '1' : '');
  C.text = (e, st) => T(C.keyOf(e), C.vars(e, st));
  C.icon = (e) => (e.k === 'born' || e.k === 'wander' ? C.SPICON[e.v.sp] || '🐾' : C.ICON[e.k] || '•');
  C.when = function (e, now) {
    const dd = Math.max(0, (now | 0) - e.d);
    return dd === 0 ? T('g.ch.today') : dd === 1 ? T('g.ch.yesterday') : T('g.ch.daysAgo', { n: dd });
  };
  (function keys() {
    const K = C.KEYS;
    for (const k of ['born', 'born1', 'wander', 'bloom', 'fell', 'storm', 'rain', 'snow', 'built', 'started', 'trade', 'harvest']) K.push('g.ch.ev.' + k);
    for (const d in C.DEEDS) K.push('g.ch.ev.deed.' + d);
    for (const s of C.SP) K.push('g.ch.fam.' + s, 'g.ch.sp.' + s);
    for (const b in C.PROJ) K.push('g.ch.b.' + b);
    for (const r of C.RES) K.push('g.ch.r.' + r);
    K.push('g.ch.pk.poppy', 'g.ch.pk.bell', 'g.ch.tree.oak', 'g.ch.tree.beech', 'g.ch.wild', 'g.ch.today', 'g.ch.yesterday', 'g.ch.daysAgo');
  })();

  // ---------------------------------------------------------------- save / load
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const enc = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 3) { const a = u8[i], b = i + 1 < u8.length ? u8[i + 1] : 0, c = i + 2 < u8.length ? u8[i + 2] : 0, n = (a << 16) | (b << 8) | c; s += B64[n >> 18] + B64[(n >> 12) & 63] + (i + 1 < u8.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < u8.length ? B64[n & 63] : '='); } return s; };
  const dec = (s, len) => { const u8 = new Uint8Array(len); let o = 0; for (let i = 0; i < s.length && o < len; i += 4) { const n = (B64.indexOf(s[i]) << 18) | (B64.indexOf(s[i + 1]) << 12) | (Math.max(0, B64.indexOf(s[i + 2])) << 6) | Math.max(0, B64.indexOf(s[i + 3])); u8[o++] = n >> 16; if (o < len) u8[o++] = (n >> 8) & 255; if (o < len) u8[o++] = n & 255; } return u8; };
  C.save = function (st) {
    const p8 = new Uint8Array(NC * 4), a8 = new Uint8Array(NC * 4);
    for (let j = 0; j < NC * 4; j++) { p8[j] = Math.round(st.P[j] * 255); a8[j] = Math.round(st.A[j] * 16); }
    const o = { v: C.V, seed: st.seed, ox: st.ox, oz: st.oz, t: st.t, ne: st.ne, dc: st.dc, dcd: st.dcd, a0: st.a0.map(x => Math.round(x * 100) / 100),
      cls: enc(st.cls), hgt: enc(st.hgt), wet0: enc(st.wet0), wet: enc(st.wet), P: enc(p8), A: enc(a8),
      pl: st.pl, fam: st.fam, vil: st.vil, fr: st.fr, ev: st.ev, out: st.out };
    return JSON.parse(JSON.stringify(o));   // (a copy: a save never shares the live lists)
  };
  C.load = function (o) {
    try {
      if (!o || typeof o !== 'object' || o.v !== C.V || typeof o.cls !== 'string' || typeof o.P !== 'string' || !Array.isArray(o.ev) || !Array.isArray(o.vil)) return null;
      const st = C.create(o.seed | 0, { ox: o.ox, oz: o.oz });
      st.t = Math.max(0, o.t | 0); st.day = Math.floor(st.t / 1440); st.ne = o.ne | 0; st.dc = o.dc | 0; st.dcd = o.dcd === undefined ? -1 : o.dcd | 0;
      st.a0 = Array.isArray(o.a0) && o.a0.length === 4 ? o.a0.map(Number) : st.a0;
      st.cls = dec(o.cls, NC); st.hgt = dec(o.hgt, NC); st.wet0 = dec(o.wet0, NC); st.wet = dec(o.wet, NC);
      const p8 = dec(o.P, NC * 4), a8 = dec(o.A, NC * 4);
      for (let j = 0; j < NC * 4; j++) { st.P[j] = p8[j] / 255; st.A[j] = a8[j] / 16; }
      st.pl = o.pl && typeof o.pl === 'object' ? o.pl : {};
      st.fam = (o.fam || []).slice(-C.MAXFAM); st.fr = (o.fr || []).slice(0, 4); st.ev = o.ev.slice(-C.MAXEV); st.out = (o.out || []).slice(-32);
      st.vil = []; st.vc.fill(-1);
      for (const v of o.vil) { if (!v || typeof v.c !== 'number' || !Array.isArray(v.res)) continue; st.vil.push(v); markVil(st, v, st.vil.length - 1); }
      capacity(st); foodCap(st);
      return st;
    } catch (e) { return null; }
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
