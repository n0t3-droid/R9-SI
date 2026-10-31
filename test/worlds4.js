// u-worlds4 · a town per world (plan docs/superpowers/plans/2026-10-31-u-worlds4.md):
//   a · bgen 4 as shipped (v0.54.6): its three village plans and three chunks per world pinned
//   b · bgen 5's towns: ≥ 15 homes, a hall with benches, a market with stalls, a landmark of the species, nothing overlaps
//   c · the ways from the town to the other villages: long, on the ground or bridged, no plant on them
//   d · dusk: a darker second paving tone, Zinnober's benches not crimson
//   e · life: the town's routines (market by day, hall at dusk, lamplighters at night), the agents tiered by preset
//   f · the portrait: the head's height per species, the field of view that frames it (≥ 15 % of the frame)
//   g · Aquamarin's landing garden, the arrival by day
//   bash test/wt_run.sh worlds4.js 300
require('./dom_stub.js');
require('./load_shared.js');
require('../src/main/i18n.js'); require('../src/main/lang_en.js'); require('../src/main/lang_de.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const part = (name) => process.argv.length < 3 || process.argv.includes(name);
const KINDS = ['aqua', 'ocker', 'zinn', 'basalt', 'opal'];
const H32 = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };
const hc = (ch) => { let h = 0; for (let i = 0; i < ch.blocks.length; i++) h = (Math.imul(h, 31) + ch.blocks[i]) | 0; return (h >>> 0).toString(16); };
const E = VR.WorldEco, D = VR.DimReg, SEED = 4242;
const gen = (k, b) => D.get(k).gen(SEED, { bgen: { [k]: b } });
const nameOf = (s) => (s ? VR.R.types[VR.R.T.type[s]].name : 'air');

if (part('a')) {
  console.log('a · bgen 4 as shipped');
  const PLANS = { aqua: '75cbf11b.94789463.983fe887', ocker: '6466331b.db672f3.d84322f7', zinn: 'ecdf90da.fa6e1dfc.f7276996', basalt: '46c69f63.2bb7b238.c46f24ae', opal: '8ac97bc4.969ea37d.2b0e11da' };
  const CHUNKS = { aqua: '7b51778.1d4ae79.dbaa26f5', ocker: '613b98ba.206a8fb3.f2fb5778', zinn: 'd7945147.f62ee49a.4f34c9f7', basalt: '266dc8c4.30e60c2f.4467626f', opal: 'ba269367.f9c6b6cc.995644d1' };
  for (const k of KINDS) {
    const g = gen(k, 4), e = E.of(g), s = e.sites[0], L = e.land, s1 = e.sites[1];
    const p = e.sites.map(q => H32(JSON.stringify(e.planOf(q).ops))).join('.');
    const mx = Math.round((s.x + s1.x) / 2), mz = Math.round((s.z + s1.z) / 2);
    const c = [hc(g.generate(s.x >> 4, s.z >> 4)), hc(g.generate(L[0] >> 4, L[2] >> 4)), hc(g.generate(mx >> 4, mz >> 4))].join('.');
    check(p === PLANS[k] && c === CHUNKS[k], `${k}: bgen 4's three villages and chunks as shipped (${p} · ${c})`);
  }
  check(VR.Bodies.BGEN >= 5, 'bgen 5 or later is the bodies\' current version (' + VR.Bodies.BGEN + '; u-worlds5: 6, bgen 5 pinned by worlds5.js a)');
}

const towns = {};
if (part('b') || part('c') || part('d') || part('e') || part('g')) for (const k of KINDS) { const g = gen(k, 5), e = E.of(g); towns[k] = { g, e, P: e && e.planOf(e.sites[0]) }; }

if (part('b')) {
  console.log('b · the towns');
  for (const k of KINDS) {
    const { e, P } = towns[k];
    const ok = P && P.town;
    check(!!ok, `${k}: the first site is a town`);
    if (!ok) continue;
    const hall = P.work.find(w => w.kind === 'hall'), stalls = P.work.filter(w => w.kind === 'stall');
    check(P.homes.length >= 15, `${k}: ${P.homes.length} homes (≥ 15)`);
    check(!!hall && hall.seats && hall.seats.length >= 8 && P.hall && P.hall.box, `${k}: a hall with ${hall && hall.seats ? hall.seats.length : 0} seats`);
    check(stalls.length >= 3 && P.market && P.market.spots && P.market.spots.length >= 3, `${k}: a market of ${stalls.length} stalls, ${P.market && P.market.spots ? P.market.spots.length : 0} spots`);
    check(!!P.landmark && P.landmark.h >= 18 && P.landmark.kind === k, `${k}: the landmark ${P.landmark ? P.landmark.shape + ' ' + P.landmark.h + ' high' : '—'}`);
    check(P.rad >= 55 && P.plaza && P.plaza.seats && P.plaza.seats.length >= 8, `${k}: the town's radius ${P.rad}, the plaza with its benches`);
    // nothing overlaps: the homes, the hall, the market, the plaza, the landmark (their boxes on the ground)
    const boxes = P.homes.map((h, i) => ['home ' + i, h.box]).concat([['hall', P.hall.box], ['market', P.market.box], ['plaza', [P.x - 7, 0, P.z - 7, P.x + 7, 0, P.z + 7]], ['landmark', P.landmark.box]]);
    let clash = null;
    for (let i = 0; i < boxes.length && !clash; i++) for (let j = i + 1; j < boxes.length; j++) { const a = boxes[i][1], b = boxes[j][1]; if (a[0] < b[3] && b[0] < a[3] && a[2] < b[5] && b[2] < a[5]) { clash = boxes[i][0] + ' × ' + boxes[j][0]; break; } }
    check(!clash, `${k}: nothing overlaps${clash ? ' — ' + clash : ''}`);
    // every home's door opens onto paving (its outside cell or one step on)
    const ops = e.planOf(e.sites[0]).ops, top = new Map();
    for (let i = 0; i < ops.length; i += 4) if (ops[i + 1] === P.y - 1) top.set(ops[i] + ',' + ops[i + 2], ops[i + 3]);
    const paved = (x, z) => { const s = top.get(x + ',' + z); return s && /sandstone|basalt|andesite|stone|snow|terracotta|deepstone|mud|tuff|planks|quartz|sulfur/.test(nameOf(s)); };
    const bad = P.homes.filter(h => { const o = h.outside; return !(paved(o[0], o[2]) || paved(o[0], o[2] + Math.sign(o[2] - h.door[2]))); }).length;
    check(bad === 0, `${k}: every door opens onto the town's paving (${bad} not)`);
    const doorOk = P.homes.every(h => /door/.test(nameOf((() => { let v = 0; for (let i = 0; i < ops.length; i += 4) if (ops[i] === h.door[0] && ops[i + 1] === h.door[1] && ops[i + 2] === h.door[2]) v = ops[i + 3]; return v; })())));
    check(doorOk, `${k}: every home has its door`);
    // the other villages stay the 6-home villages
    check(e.sites.slice(1).every(s => { const q = e.planOf(s); return !q.town && q.homes.length === 6; }), `${k}: the other two sites stay villages`);
    // deterministic
    const g2 = gen(k, 5), e2 = E.of(g2);
    check(H32(JSON.stringify(e2.planOf(e2.sites[0]).ops)) === H32(JSON.stringify(ops)), `${k}: the town is the same every time`);
  }
}

if (part('c')) {
  console.log('c · the ways');
  for (const k of KINDS) {
    const { g, e } = towns[k];
    const ways = e.ways || [];
    check(ways.length >= 2 && ways.every(w => w.n >= 250), `${k}: ${ways.length} ways (${ways.map(w => w.from + '→' + w.to + ' ' + w.n).join(', ')})`);
    if (!ways.length) continue;
    // in the chunks along the first way: the road block on the ground (or a bridge), nothing growing on it
    const w = ways[0], R = VR.R;
    let cells = 0, onRoad = 0, plant = 0;
    const seen = new Set();
    for (let t = 0.2; t <= 0.8; t += 0.1) {
      const x = Math.round(w.a[0] + (w.b[0] - w.a[0]) * t), z = Math.round(w.a[1] + (w.b[1] - w.a[1]) * t), key = (x >> 4) + ',' + (z >> 4);
      if (seen.has(key)) continue; seen.add(key);
      const out = g.generate(x >> 4, z >> 4), list = e.wayCells(x >> 4, z >> 4);
      for (let i = 0; i < list.length; i += 3) {
        const lx = list[i] & 15, lz = list[i + 1] & 15, c = lz * 16 + lx; cells++;
        let y = 250; while (y > 1 && !out.blocks[(y << 8) | c]) y--;
        const s = out.blocks[(y << 8) | c];
        if (s === list[i + 2] || s === e.bridge) onRoad++;
        else if (s && !(R.T.flags[s] & VR.F.SOLID)) plant++;
      }
    }
    check(cells > 40 && onRoad / cells > 0.9 && plant === 0, `${k}: the way's cells on top (${onRoad}/${cells}), ${plant} plants on it`);
  }
}

if (part('d')) {
  console.log('d · dusk');
  const lum = (n) => { const c = VR.R.byName[n] && VR.mapColorOf ? VR.mapColorOf(n) : null; return c; };
  void lum;
  for (const k of KINDS) {
    const { P } = towns[k], kit = E.kit(k, 5);
    check(kit.pave5 && kit.pave5.length === 2 && kit.pave5.every(n => VR.R.byName[n]) && kit.pave5[1] !== kit.pave5[0] && E.DARK.has(kit.pave5[1]), `${k}: the second tone dark (${kit.pave5 && kit.pave5.join(' / ')})`);
    if (k === 'zinn') check(!/crimson|red|magenta|pink/.test(kit.bench5 + kit.post5) && VR.R.byName[kit.bench5] && VR.R.byName[kit.post5], `zinn: benches ${kit.bench5}, posts ${kit.post5}`);
    void P;
  }
  // bgen 4's kits as they were
  check(E.kit('zinn', 4).bench4 === 'crimson_slab', 'bgen 4 keeps its kits');
}

if (part('e') || part('f') || part('g')) {
  require('../src/shared/smoothvox.js'); require('../src/shared/folksmooth.js');
  require('../src/main/voxmodels.js'); require('../src/main/villagers.js'); require('../src/main/folkmodel.js');
  require('../src/main/villages.js'); require('../src/main/festival.js'); require('../src/main/worldlife.js');
  require('../src/main/natives.js');
}
const N = VR.Natives;
if (part('e')) {
  console.log('e · life');
  const { P } = towns.ocker;
  const people = [];
  for (let i = 0; i < 40; i++) people.push({ id: 'p' + i, seed: (i * 2654435761) >>> 0, age: i % 5 === 4 ? 'child' : 'adult', role: i === 0 ? 'trader' : i === 1 ? 'mayor' : 'farmer', home: i % 18 });
  const vil = { plan: P, people, workOf: {} };
  const ags = people.map(p => ({ p, vil, role: p.role, kid: p.age === 'child', elder: false }));
  const at = (tod) => { const c = {}; for (const a of ags) { const r = N.routine(a, tod) || '-'; c[r] = (c[r] || 0) + 1; } return c; };
  const day = at(3000), dusk = at(11300), night = at(16000);
  check((day.market || 0) >= 6 && (day.market || 0) <= 20, 'by day the market: ' + JSON.stringify(day));
  check((dusk.hall || 0) >= 6, 'at dusk the hall: ' + JSON.stringify(dusk));
  check((night.lantern || 0) >= 2 && (night.lantern || 0) <= 4, 'at night the lamplighters: ' + JSON.stringify(night));
  check(N.routine(ags[0], 3000) === null, 'the trader keeps to the stall');
  check(N.routine({ p: people[3], vil: { plan: towns.ocker.e.planOf(towns.ocker.e.sites[1]), people }, role: 'farmer' }, 3000) === null, 'a plain village keeps its old day');
  const caps = ['potato', 'low', 'balanced', 'high'].map(pr => N.agentCap(pr, 40));
  check(caps[0] <= 14 && caps[1] <= 20 && caps[0] < caps[3] && caps[3] >= 30, 'the agents a town wakes: Very Low ' + caps.join(' · '));
  const keep = N.keepers(ags, 14);
  check(keep.length === 14 && keep.includes(ags[0]) && keep.includes(ags[1]), 'the cap keeps the trader and the mayor');
  check(N.MARKET_ACTS && ['market', 'hall', 'lantern'].every(t => N.MARKET_ACTS.has(t)), 'three new activities');
}
if (part('f')) {
  console.log('f · the portrait');
  const hy = {};
  for (const k of KINDS) hy[k] = N.headAt({ pos: [0, 0, 0], kid: false, p: { look: { species: k } } })[1];
  check(hy.ocker - hy.aqua >= 0.15 && hy.basalt < hy.aqua, 'the head\'s height per species: ' + KINDS.map(k => k + ' ' + hy[k].toFixed(2)).join(' '));
  for (const d of [1, 2, 3, 4]) {
    const fov = N.portraitFov(d, 'ocker', 70 * Math.PI / 180), frac = N.HEAD_M * VR.Folk.SPECIES_BODY.ocker.scale / (2 * d * Math.tan(fov / 2));
    check(frac >= 0.15 && frac <= 0.45, `at ${d} m the head ${(frac * 100).toFixed(0)} % of the frame (fov ${(fov * 180 / Math.PI).toFixed(0)}°)`);
  }
}
if (part('g')) {
  console.log('g · the landing, the dawn');
  const { g, e } = towns.aqua, L = e.land, R = VR.R;
  let n = 0;
  const big = new Set(E.KINDS.aqua.flora.filter(f => f.shape !== 'tuft' && f.shape !== 'coral').flatMap(f => [f.stem, f.leaf, f.cap].filter(Boolean)).map(s => R.byName[s] && R.byName[s].defaultState));
  for (let cx = (L[0] - 16) >> 4; cx <= (L[0] + 16) >> 4; cx++) for (let cz = (L[2] - 16) >> 4; cz <= (L[2] + 16) >> 4; cz++) {
    const out = g.generate(cx, cz);
    for (let c = 0; c < 256; c++) { const x = cx * 16 + (c & 15), z = cz * 16 + (c >> 4); if (Math.hypot(x - L[0], z - L[2]) > 15) continue; for (let y = 60; y < 90; y++) { const s = out.blocks[(y << 8) | c]; if (s && big.has(R.types[R.T.type[s]].defaultState)) { n++; break; } } }
  }
  check(n >= 25, `Aquamarin's landing: ${n} columns of the world's big plants within 15 m`);
  check(N.dawn(16000, true) > 0 && N.dawn(16000, true) < 4000 && N.dawn(3000, true) === null && N.dawn(16000, false) === null, 'the first arrival at night lands in the morning; by day, or a later visit, not');
  const miss = ['g.nat.dawn'].filter(key => !(key in VR.I18N.dict.de) || !(key in VR.I18N.dict.en));
  check(miss.length === 0, 'the lang keys' + (miss.length ? ': ' + miss.join(', ') : ''));
}
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);
