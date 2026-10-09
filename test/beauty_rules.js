// Beauty from every angle (plan docs/superpowers/plans/2026-10-08-t-beauty.md) — the generator rules behind the
// audit's pictures (test/beauty_audit.mjs). Everything is vgen 9 (new worlds); a vgen-8 world keeps its chunks.
//   1. no random ruin in the Heartland's designed land: the obsidian ruined gates (and the other random surface
//      structures) stay out of the Heartland's designed radius (HEART.R0) — a vgen-8 world keeps them where they were
//   2. every street of Nova Haven ends at a street, the plaza or a turning circle: a round paved bulb with the cyan line
//      round its rim, the light grey kerb round that, and a planted island in the middle (a raised bed with a palm)
//   bash test/wt_run.sh beauty_rules.js 600
const V = require('./load_shared.js');
const R = V.R, F = V.F, VG = V.VillageGen, HEART = V.Heart;
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const nameOf = (s) => (s ? R.types[R.T.type[s]].name : 'air');
const SEED = 4242;
const world = (vgen) => {
  const g = V.makeGen('overworld', SEED, { vgen }), cache = new Map();
  const chunk = (cx, cz) => { const k = cx + ',' + cz; let c = cache.get(k); if (!c) { c = g.generate(cx, cz); cache.set(k, c); } return c; };
  const at = (x, y, z) => (y < 0 || y > 255) ? 0 : chunk(x >> 4, z >> 4).blocks[(y << 8) | ((z & 15) << 4) | (x & 15)];
  return { g, chunk, at };
};
const W8 = world(8), W9 = world(9);

// ---------------------------------------------------------------- 1 · no random ruin in the designed land
console.log('1 · no random ruin in the Heartland');
{
  const OB = new Set(['obsidian', 'weeping_obsidian'].map(n => R.byName[n].id));
  const ruinIn = (W, cx, cz) => { const c = W.chunk(cx, cz); let n = 0; for (let y = 64; y < 200; y++) for (let col = 0; col < 256; col++) { const b = c.blocks[(y << 8) | col]; if (b && OB.has(R.T.type[b])) n++; } return n >= 3; };
  // the chunks of a vgen-8 world of this seed with a ruined gate near the city, the temple and the plaza (found with a
  // scan of the Heartland: 244 of its 5 664 chunks carry one), and a spread of others across the designed land
  const KNOWN = [[120, -90], [57, 6], [-10, 152], [166, -7], [-167, -138], [89, -282], [-183, -170], [201, -106], [-119, -42], [-154, 89]];
  let kept = 0, gone = 0;
  for (const [x, z] of KNOWN) { if (ruinIn(W8, x >> 4, z >> 4)) kept++; if (!ruinIn(W9, x >> 4, z >> 4)) gone++; }
  check(kept === KNOWN.length, `a vgen-8 world keeps its ruined gates (${kept} of ${KNOWN.length} chunks as before)`);
  check(gone === KNOWN.length, `a vgen-9 world has none in those chunks (${gone} of ${KNOWN.length} clear)`);
  // a spread of chunks over the designed land (every 7th chunk within HEART.R0): no ruin at vgen 9
  let n = 0, ruins = 0; const R0 = HEART.R0;
  for (let cz = -44; cz <= 44; cz += 7) for (let cx = -44; cx <= 44; cx += 7) { if (Math.hypot(cx * 16 + 8, cz * 16 + 8) > R0 - 24) continue; n++; if (ruinIn(W9, cx, cz)) ruins++; }
  check(n > 80 && ruins === 0, `no ruined gate in ${n} chunks spread over the designed land at vgen 9 (${ruins})`);
  // beyond the Heartland's blend the random world keeps them: a chunk far out with a gate at vgen 8 has it at vgen 9
  let far8 = 0, far9 = 0;
  for (let cz = 60; cz < 72 && far8 < 3; cz++) for (let cx = 60; cx < 72 && far8 < 3; cx++) if (ruinIn(W8, cx, cz)) { far8++; if (ruinIn(W9, cx, cz)) far9++; }
  check(far8 > 0 && far9 === far8, `the random world beyond the Heartland keeps its ruins (${far9} of ${far8})`);
}

// ---------------------------------------------------------------- 2 · every street ends somewhere
console.log('2 · every street of Nova Haven ends at a street, the plaza or a turning circle');
{
  const site = (g) => VG.sitesFor(g, 0, -9).find(x => x.home);
  const P8 = VG.plan(W8.g, site(W8.g)), P9 = VG.plan(W9.g, site(W9.g));
  const ends = (P) => {
    const out = [], roads = P.nova.roads, HW = VG.NOVA_HAVEN.HW, pz = P.nova.plaza;
    for (const rd of roads) for (const [which, p] of [['start', rd.pts[0]], ['end', rd.pts[rd.pts.length - 1]]]) {
      const joins = roads.some(o => o !== rd && o.pts.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) <= HW + 1.5));
      const plaza = pz && Math.hypot(p[0] - pz.x, p[1] - pz.z) <= pz.r + 1.5;
      const turn = (P.nova.turns || []).find(t => t.road === rd.name && t.end === which);
      out.push({ road: rd.name, which, x: p[0], z: p[1], joins, plaza, turn });
    }
    return out;
  };
  const E8 = ends(P8), E9 = ends(P9);
  const open8 = E8.filter(e => !e.joins && !e.plaza), open9 = E9.filter(e => !e.joins && !e.plaza && !e.turn);
  console.log(`     vgen 8: ${open8.length} streets end in the lawn (${open8.map(e => e.road + ' ' + e.which).join(', ')})`);
  check(open9.length === 0, `vgen 9: every street end joins a street, the plaza or a turning circle (${open9.length} open: ${open9.map(e => e.road + ' ' + e.which + ' at ' + e.x.toFixed(0) + ', ' + e.z.toFixed(0)).join('; ')})`);
  check(!P8.nova.turns, `a vgen-8 city has no turning circle (old worlds keep their city)`);
  // the circles as blocks: the paving round a planted island, the cyan line on the rim, the kerb round it
  const PAVE = new Set(['vx_floor_plaza', 'vx_floor_plaza_line']);
  for (const t of (P9.nova.turns || [])) {
    let paved = 0, cells = 0, rim = 0, rimLit = 0, kerb = 0, kerbN = 0, bed = 0, plant = 0;
    // (the rim: a paved cell of the circle's edge with an unpaved cell beside it outside the circle — where the road or a
    //  garden path meets the circle the paving runs on; the kerb: a lawn cell beside a rim cell, outside the circle)
    const pavedAt = (x, z) => PAVE.has(nameOf(W9.at(x, t.y, z))) || nameOf(W9.at(x, t.y, z)) === 'vx_floor_plaza_line_amber';
    const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]], dOf = (x, z) => Math.hypot(x + 0.5 - t.x, z + 0.5 - t.z), kerbAt = new Set();
    for (let z = Math.floor(t.z - t.r - 2); z <= Math.ceil(t.z + t.r + 2); z++) for (let x = Math.floor(t.x - t.r - 2); x <= Math.ceil(t.x + t.r + 2); x++) {
      const d = dOf(x, z), top = nameOf(W9.at(x, t.y, z));
      if (d <= t.bed + 0.5) { if (/^vollton_light_grey$|^podzol$/.test(top) || /^vollton_light_grey$|^podzol$/.test(nameOf(W9.at(x, t.y + 1, z)))) bed++; for (let y = t.y + 1; y <= t.y + 6; y++) if (/palm|vm_tree|fern|flower/.test(nameOf(W9.at(x, y, z)))) { plant++; break; } continue; }
      if (d > t.r) continue;
      if (d <= t.r - 1.2) { cells++; if (pavedAt(x, z)) paved++; }
      if (!pavedAt(x, z)) continue;
      const out = N4.filter(([a, b]) => dOf(x + a, z + b) > t.r - 0.2 && dOf(x + a, z + b) > d && !pavedAt(x + a, z + b));
      if (!out.length) continue;
      rim++; if (top === 'vx_floor_plaza_line') rimLit++;
      for (const [a, b] of out) if (nameOf(W9.at(x + a, t.y, z + b)) === 'grass_block') kerbAt.add((x + a) + ',' + (z + b));
    }
    for (const k of kerbAt) { const [x, z] = k.split(',').map(Number); kerbN++; if (/slab|lamppost|palm/.test(nameOf(W9.at(x, t.y + 1, z)))) kerb++; }
    check(paved >= cells * 0.97 && cells > 60, `${t.road} ${t.end}: a paved circle of radius ${t.r} at (${t.x.toFixed(0)}, ${t.z.toFixed(0)}) — ${paved} of ${cells} cells paved`);
    check(rimLit >= rim * 0.95 && rim > 16, `${t.road} ${t.end}: the cyan line round its rim (${rimLit} of ${rim} rim cells lit)`);
    check(kerb >= kerbN * 0.8 && kerbN > 12, `${t.road} ${t.end}: the light grey kerb round it (${kerb} of ${kerbN} lawn cells at the rim)`);
    check(bed >= 9 && plant >= 1, `${t.road} ${t.end}: a planted island in the middle (${bed} bed cells, ${plant} with a plant)`);
  }
  check((P9.nova.turns || []).length >= 4, `vgen 9: the crescent's and Palm Row's ends are turning circles (${(P9.nova.turns || []).length})`);
  // the plan stays the plan: villas on the lots (as many as vgen 8 within two), every road lined with its kerb line
  check(Math.abs(P9.homes.length - P8.homes.length) <= 2 && P9.homes.length >= 9, `vgen 9 keeps the villas (${P9.homes.length}, vgen 8 ${P8.homes.length})`);
}

// ---------------------------------------------------------------- 3 · no blank wall on any side of a villa
console.log('3 · every side of every storey of a Villa Nova keeps a window within four blocks (vgen 9)');
{
  const PLAN = VG.plan2, FAM = PLAN.NOVA_FAMILY;
  const fnv = (h, a) => { for (let i = 0; i < a.length; i++) { h ^= a[i] & 0xffff; h = Math.imul(h, 16777619) >>> 0; h ^= (a[i] >>> 16) & 0xffff; h = Math.imul(h, 16777619) >>> 0; } return h; };
  const build = (comp, mirror, vgen) => {
    const rec = new Map(), ops = [];
    const L = VG.makeLot((x, y, z, s) => { rec.set(x + ',' + y + ',' + z, s); ops.push(x, y, z, s); }, 0, 0, 0);
    PLAN.build(L, { w: 25, d: 31, F: 64, r: 0, ox: 0, oz: 0, kind: 'home' }, Object.assign({ index: PLAN.TRAILER, comp, novaMirror: mirror, rng: new V.RNG(7), ground: () => 63, beds: 3, noCustom: true }, vgen ? { vgen } : {}));
    return { at: (u, y, v) => nameOf(rec.get(u + ',' + y + ',' + v) || 0), hash: fnv(2166136261 >>> 0, ops).toString(16) };
  };
  // the longest run of plain wall at the window rows along a side of a storey (a cell is open when glass, a window or a
  // door stands in the wall plane or a bay stands out in front of it within two blocks)
  const blankRuns = (B, C, mirror) => {
    const W = 25, out = [];
    for (const [key, R0] of [['G', C.G], ['U', C.U], ['T', C.T]]) {
      if (!R0) continue;
      const rows = key === 'G' ? [2, 3, 4] : [R0.y + 2, R0.y + 3];
      const mu = (u) => mirror ? W - 1 - u : u;
      const sides = [['front', (a) => [a, R0.v0], [0, -1], R0.u0, R0.u1], ['back', (a) => [a, R0.v1], [0, 1], R0.u0, R0.u1], ['left', (a) => [R0.u0, a], [-1, 0], R0.v0, R0.v1], ['right', (a) => [R0.u1, a], [1, 0], R0.v0, R0.v1]];
      for (const [sn, cell, [du, dv], a0, a1] of sides) {
        let run = 0, best = 0;
        for (let a = a0; a <= a1; a++) {
          const [u, v] = cell(a);
          let open = false, wall = false;
          for (const y of rows) for (let k = 0; k <= 2; k++) { const n = B.at(mu(u + du * k), 64 + y, v + dv * k); if (/window|glass|door|panorama|sheet/.test(n)) open = true; if (k === 0 && /stone_grey|mid_grey/.test(n)) wall = true; if (k > 0 && /^vollton_light_grey$/.test(n)) open = true; }
          if (wall && !open) { run++; best = Math.max(best, run); } else run = 0;
        }
        out.push([key + '.' + sn, best]);
      }
    }
    return out;
  };
  const REF8 = { classic: '4a95064f', classicm: '94841337', long: '8768c452', longm: 'd2d63592', tower: '5ae4695a', towerm: '2297866c', corner: 'f717b036', cornerm: '4b5a6dd4', bungalow: '260f93b', bungalowm: '97630041' };
  let same8 = 0, n8 = 0;
  for (const comp of Object.keys(FAM)) for (const mirror of [false, true]) {
    const tag = comp + (mirror ? 'm' : '');
    const B8 = build(comp, mirror, 0), B9 = build(comp, mirror, 9);
    n8++; if (B8.hash === REF8[tag]) same8++; else console.log(`     ${tag} at vgen 8: ${B8.hash} (expected ${REF8[tag]})`);
    const r8 = blankRuns(B8, FAM[comp], mirror), r9 = blankRuns(B9, FAM[comp], mirror);
    const worst8 = r8.reduce((a, b) => b[1] > a[1] ? b : a), worst9 = r9.reduce((a, b) => b[1] > a[1] ? b : a);
    check(worst9[1] <= 4, `${tag}: the longest blank wall at vgen 9 is ${worst9[1]} (${worst9[0]}; vgen 8: ${worst8[1]} at ${worst8[0]})`);
  }
  check(same8 === n8, `the family as vgen 8 builds it is byte for byte as before (${same8} of ${n8})`);
}

// ---------------------------------------------------------------- 4 · nothing hovers
console.log('4 · nothing a generator places stands on air (vgen 9)');
{
  // a prop (a plant, a bush, a lamp, a planter) whose cell below is air or water — the palm crowns' frond tips and the
  // floating glass treads hang by design; over the Pod Hills (the ribbon paths' lamps, the pods' bushes) and round the
  // plaza (vgen 8: a sulfur spring's crust beside it)
  const isProp = (n) => /^vx_(bush|lamppost|tech_planter|fern|hedge)|^vm_(tree|bush|flower|tuft|plant)|^(short_grass|poppy|dandelion|allium|cornflower)$/.test(n);
  const scan = (W, x0, z0, x1, z1) => {
    let props = 0, sul = 0; const at = [];
    for (let cz = z0 >> 4; cz <= (z1 - 1) >> 4; cz++) for (let cx = x0 >> 4; cx <= (x1 - 1) >> 4; cx++) {
      const c = W.chunk(cx, cz);
      for (let y = 64; y < 200; y++) for (let col = 0; col < 256; col++) {
        const b = c.blocks[(y << 8) | col]; if (!b) continue;
        const n = nameOf(b);
        if (n === 'sulfur' && y > 66) { const below = c.blocks[((y - 1) << 8) | col]; if (!below) sul++; }
        if (!isProp(n)) continue;
        const t = R.types[R.T.type[b]]; if (t.has && t.has('part') && t.get(b, 'part')[2] !== '0') continue;
        const below = c.blocks[((y - 1) << 8) | col];
        if (below && !(R.T.flags[below] & F.FLUID)) continue;
        props++; if (at.length < 4) at.push([cx * 16 + (col & 15), y, cz * 16 + (col >> 4), n]);
      }
    }
    return { props, sul, at };
  };
  const hills8 = scan(W8, -150, -430, 150, -290), hills9 = scan(W9, -150, -430, 150, -290);
  check(hills9.props === 0, `the Pod Hills: no lamp or bush on air at vgen 9 (${hills9.props}${hills9.props ? ' ' + JSON.stringify(hills9.at) : ''}; vgen 8: ${hills8.props} ${JSON.stringify(hills8.at)})`);
  const plaza8 = scan(W8, 80, 20, 128, 64), plaza9 = scan(W9, 80, 20, 128, 64);
  check(plaza8.sul > 0 && plaza9.sul === 0 && plaza9.props === 0, `beside the plaza: no sulfur crust floating at vgen 9 (${plaza9.sul}; vgen 8: ${plaza8.sul}), no prop on air (${plaza9.props})`);
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
