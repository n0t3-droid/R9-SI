// Beauty from every angle (plan docs/superpowers/plans/2026-10-08-t-beauty.md) — the generator rules behind the
// audit's pictures (test/beauty_audit.mjs). Everything is vgen 9 or 10 (new worlds); an older world keeps its chunks.
//   1. no random ruin in the Heartland's designed land: the obsidian ruined gates (and the other random surface
//      structures) stay out of the Heartland's designed radius (HEART.R0) — a vgen-8 world keeps them where they were
//   2. every street of Nova Haven ends at a street, the plaza or a turning circle: a round paved bulb with the cyan line
//      round its rim, the light grey kerb round that, and a planted island in the middle (a raised bed, a round tree);
//      every road's kerbs stay one light line each
//   3. every side of every storey of a Villa Nova keeps a window within four blocks (the vgen-8 family unchanged)
//   4. nothing a generator places stands on air (the Pod Hills' lamps and bushes, a sulfur spring's crust)
//   5. Very Low: the chunk triangles at the audit's two Very Low scenes within 1 % of vgen 8 (SKIP_COST=1 skips it)
//   6. the Gate Plaza's trees are the city's round trees in raised beds; Villa Nova's garden mounds are smooth hills
//   7. a floating island's sides: four of soil, six to ten bands of warm strata, grey rock, moss among the tuff at the
//      tips (TRAILER.md §3.6) — and the far rings colour its sides warm, not grey stone; a vgen-8 world keeps its islands
//   8. a fall off a floating island pours off the rim and dissolves into mist (t1_07 · t1_09): its 2 × 2 curtain ends
//      18 … 35 below the rim, each cell at its own height (a ragged end), and the chunk lists a mist spawn at its foot —
//      vgen 8's falls ran 90 … 100 blocks to the ground as straight blue poles (the audit's water_1, water_r1, far_3)
//   9. the spray at a fall's foot (vents.js): a plume of mist under the ragged end, never a ball (its opacity modelled)
//  10. a fall that is touched spills a little, it does not flood (sim.js)
//  11. vgen 10: a street climbs in half steps — no whole-block step across a street (vgen 9 kept as released, v0.45)
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
  // the kerbs stay one light line each (as test/trailer_city.js asks of vgen 8): from a road's kerb into its circle's rim
  // and on — the ring round a circle's bed is no kerb of the road
  {
    const LINE = new Set();
    for (const [k, b] of P9.chunks) for (let i = 0; i < b.o.length; i += 4) { const n = nameOf(b.o[i + 3]); if (n === 'vx_floor_plaza_line' || n === 'vx_floor_plaza_line_amber') LINE.add(b.o[i] + ',' + b.o[i + 2]); }
    const comp = (start) => { const seen = new Set([start]), q = [start]; while (q.length) { const k = q.pop(); const [x, z] = k.split(',').map(Number); for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = (x + dx) + ',' + (z + dz); if (LINE.has(n) && !seen.has(n)) { seen.add(n); q.push(n); } } } return seen; };
    // (where a road borders the planted island its kerb is the island's own loop — the west branch's east side)
    const wb = P9.nova.roads.find(r => r.name === 'west'), isle = wb && wb.kerb && wb.kerb.L.length ? comp(wb.kerb.L[wb.kerb.L.length >> 1][0] + ',' + wb.kerb.L[wb.kerb.L.length >> 1][1]) : new Set();
    let sides = 0, whole = 0; const bad = [];
    for (const rd of P9.nova.roads) for (const sd of ['L', 'R']) {
      const cells = ((rd.kerb && rd.kerb[sd]) || []).filter(c => !isle.has(c[0] + ',' + c[1])); if (!cells.length) continue;
      sides++;
      const reach = comp(cells[0][0] + ',' + cells[0][1]);
      const apart = cells.filter(c => !reach.has(c[0] + ',' + c[1])).length, miss = cells.filter(c => !LINE.has(c[0] + ',' + c[1])).length;
      if (!apart && !miss) whole++; else bad.push(`${rd.name}.${sd}: ${miss} not lit, ${apart} apart`);
    }
    check(sides >= 6 && whole === sides, `vgen 9: every road's kerbs are one light line each, on round its circles (${whole} of ${sides}${bad.length ? ': ' + bad.join('; ') : ''})`);
  }
  // the plan stays the plan: villas on the lots (as many as vgen 8 within two), every road lined with its kerb line
  check(Math.abs(P9.homes.length - P8.homes.length) <= 2 && P9.homes.length >= 9, `vgen 9 keeps the villas (${P9.homes.length}, vgen 8 ${P8.homes.length})`);
  // no street climbs onto a bank: the terraces (gen_hills.js T8) cut the lawn round Palm Row's ends down to their base
  // (82), so vgen 8's last climb to 84 left the road's end on a bank two blocks over the lawn (the audit's street_2: a
  // wall of dirt and kerb) — a bank step is a paving or kerb cell beside a lawn cell two or more blocks lower
  {
    const ROADTOP = /^(vx_floor_plaza|vx_floor_plaza_line|vx_floor_plaza_line_amber|vollton_light_grey)$/, LAWN = /^(grass_block|moss_block|dirt|podzol)$/;
    const topOf = (W, x, z) => { for (let y = 96; y > 70; y--) { const n = nameOf(W.at(x, y, z)); if (ROADTOP.test(n) || LAWN.test(n)) return [y, n]; } return [70, 'none']; };
    const banks = (W, P) => {
      const rd = P.nova.roads.find(r => r.name === 'palmrow'), out = [], tread = V.HillsGen.T8.levels[1];
      for (const p of [rd.pts[0], rd.pts[rd.pts.length - 1]]) {
        let n = 0; const memo = new Map(), tp = (x, z) => { const k = x + ',' + z; let v = memo.get(k); if (!v) memo.set(k, v = topOf(W, x, z)); return v; };
        for (let z = Math.floor(p[1]) - 14; z <= Math.floor(p[1]) + 14; z++) for (let x = Math.floor(p[0]) - 14; x <= Math.floor(p[0]) + 14; x++) {
          // (the paving and the kerbs under the terraces' first tread — their lit edges up there are the risers', by design)
          const [a, an] = tp(x, z); if (!ROADTOP.test(an) || a >= tread) continue;
          for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const [b, bn] = tp(x + dx, z + dz); if (LAWN.test(bn) && a - b >= 2) n++; }
        }
        out.push(n);
      }
      return out;
    };
    const b8 = banks(W8, P8), b9 = banks(W9, P9);
    let top9 = 0; for (const rd of P9.nova.roads) for (let k = 0; k < rd.pts.length; k += 2) { const [px, pz] = rd.pts[k]; if ((P9.nova.turns || []).some(t => Math.hypot(px - t.x, pz - t.z) <= t.bed + 1.5)) continue; const [y, n] = topOf(W9, Math.floor(px), Math.floor(pz)); if (ROADTOP.test(n)) top9 = Math.max(top9, y); }   // (a circle's bed and its kerb ring are no street)
    check(b8[0] + b8[1] >= 10 && b9[0] + b9[1] === 0, `vgen 9: Palm Row's ends lie level with the lawn — ${b9[0]} + ${b9[1]} bank steps at its two ends (vgen 8: ${b8[0]} + ${b8[1]})`);
    check(top9 <= V.HillsGen.T8.base, `vgen 9: no street climbs above the terraces' base (${top9}, the base ${V.HillsGen.T8.base})`);
    // a turning circle lies on the level land in front of the hill, dug at most one riser into it: under none of its
    // cells did the ground (the vgen-8 world's, the terraces' treads) stand more than four over its paving — the hill
    // road's circle at the foot of the terraces cut up to 11 into their treads, a wall of moss round its north half
    // (Palm Row's circles abut the first riser, 4, as the treads' own risers do)
    for (const t of (P9.nova.turns || [])) {
      let n = 0, cut = 0, worst = 0;
      for (let z = Math.floor(t.z - t.r); z <= Math.ceil(t.z + t.r); z++) for (let x = Math.floor(t.x - t.r); x <= Math.ceil(t.x + t.r); x++) {
        if (Math.hypot(x + 0.5 - t.x, z + 0.5 - t.z) > t.r) continue;
        const [y8, n8] = topOf(W8, x, z); if (n8 === 'none') continue;
        n++; const h = y8 - t.y; worst = Math.max(worst, h); if (h > 4) cut++;
      }
      check(n > 100 && cut === 0, `${t.road} ${t.end}: the circle lies on the level land (${cut} of ${n} cells dug more than a riser, 4, into the ground; the deepest ${worst})`);
    }
  }
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
  // the lake's east shore (the audit's water_2: vgen 8's sulfur springs there hung yellow cubes over the meadow)
  const lake8 = scan(W8, 128, -16, 272, 112), lake9 = scan(W9, 128, -16, 272, 112);
  check(lake8.sul > 0 && lake9.sul === 0 && lake9.props === 0, `the lake's east shore: no sulfur crust floating at vgen 9 (${lake9.sul}; vgen 8: ${lake8.sul}), no prop on air (${lake9.props}${lake9.props ? ' ' + JSON.stringify(lake9.at) : ''})`);
}

// ---------------------------------------------------------------- 6 · the plaza's trees, the villa's mounds
console.log('6 · the Gate Plaza\'s trees are the city\'s round trees in raised beds; Villa Nova\'s garden mounds are smooth hills (vgen 9)');
{
  // the plaza's eight trees and the two terrace trees: vgen 8 leaf-block blobs, vgen 9 the city's round tree in a bed
  const count = (W) => { let leaves = 0, round = 0, kerb = 0; for (let cz = 1; cz <= 8; cz++) for (let cx = -3; cx <= 2; cx++) { const c = W.chunk(cx, cz); for (let y = 80; y < 110; y++) for (let col = 0; col < 256; col++) { const n = nameOf(c.blocks[(y << 8) | col]); if (n === 'oak_leaves') leaves++; else if (n === 'vm_tree_round_l') round++; else if (n === 'vollton_light_grey' && y >= 81) kerb++; } } return { leaves, round, kerb }; };
  const p8 = count(W8), p9 = count(W9);
  check(p8.leaves > 100 && p9.leaves === 0 && p9.round >= 48 * 8 && p9.kerb >= 12 * 8, `the plaza: vgen 8 ${p8.leaves} leaf blocks; vgen 9 ${p9.leaves} leaf blocks, ${p9.round} round-tree pieces, ${p9.kerb} bed kerb blocks`);
  // the classic's back garden: two mounds; every step between neighbouring mound columns at most one block (Nahtlos
  // draws them as a smooth slope — vgen 8's steps of two read as dark stepped boxes), every top grass
  const PLAN = VG.plan2, mounds = (vgen) => {
    const rec = new Map();
    const L = VG.makeLot((x, y, z, s) => rec.set(x + ',' + y + ',' + z, s), 0, 0, 0);
    PLAN.build(L, { w: 25, d: 31, F: 64, r: 0, ox: 0, oz: 0, kind: 'home' }, Object.assign({ index: PLAN.TRAILER, rng: new V.RNG(7), ground: () => 63, beds: 3 }, vgen ? { vgen } : {}));
    const top = new Map();
    for (let v = 21; v < 31; v++) for (let u = 0; u < 25; u++) { let h = 0, t = ''; for (let y = 64; y < 72; y++) { const n = nameOf(rec.get(u + ',' + y + ',' + v) || 0); if (n === 'moss_block' || n === 'grass_block' || n === 'dirt') { h = y - 63; t = n; } } if (h) top.set(u + ',' + v, [h, t]); }
    let worst = 0, notGrass = 0;
    for (const [k, [h, t]] of top) { const [u, v] = k.split(',').map(Number); if (t !== 'grass_block') notGrass++; for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const o = top.get((u + du) + ',' + (v + dv)); worst = Math.max(worst, h - (o ? o[0] : 0)); } }
    return { cells: top.size, worst, notGrass };
  };
  const m8 = mounds(0), m9 = mounds(9);
  check(m9.cells >= 30 && m9.worst <= 1 && m9.notGrass === 0, `Villa Nova's garden mounds: ${m9.cells} columns, the steepest step ${m9.worst}, ${m9.notGrass} tops not grass (vgen 8: steps of ${m8.worst}, ${m8.notGrass} moss tops)`);
}

// ---------------------------------------------------------------- 7 · the islands' layered sides
console.log('7 · a floating island\'s sides: soil, warm strata, grey rock, moss at the tips (vgen 9)');
{
  const STRATA = new Set(['ochre_rock', 'umber_rock', 'orange_terracotta', 'brown_terracotta', 'red_terracotta']);
  const TIP = new Set(['moss_block', 'tuff']);
  // the first plain islands (not ember, not prism, no designed one) of a spread of island cells far beyond the Heartland
  W9.g.islandAt(0, 0);
  const isles = [];
  for (let j = 14; j < 60 && isles.length < 4; j++) for (let i = 14; i < 60 && isles.length < 4; i++) {
    const I = W9.g.islandCell(i, j); if (!I || I.r < 14) continue;
    const cl = W9.g.climateAt(Math.round(I.x), Math.round(I.z)); if (cl.ember > 0.3 || cl.prism > 0.3) continue;
    isles.push(I);
  }
  // their columns on a 3-block grid: what lies under the soil (depth 5 … 10) and at the dangling tips
  const tally = (W) => {
    const t = { cols: 0, band: 0, bandStrata: 0, tips: 0, tipMoss: 0, tipOk: 0, strataAnywhere: 0, tops: 0 };
    for (const I of isles) for (let dz = -I.r; dz <= I.r; dz += 3) for (let dx = -I.r; dx <= I.r; dx += 3) {
      const x = Math.round(I.x + dx), z = Math.round(I.z + dz), sh = W.g.islandAt(x, z);
      if (!sh || !sh.isle || sh.isle.x !== I.x || sh.isle.z !== I.z || sh.top - sh.bottom < 14) continue;   // (each world its own island records)
      const cl = W.g.climateAt(x, z); if (cl.ember > 0.45 || cl.prism > 0.45) continue;
      t.cols++;
      if (nameOf(W.at(x, sh.top, z)) === 'grass_block' || nameOf(W.at(x, sh.top, z)) === 'snow_block') t.tops++;
      for (let y = sh.bottom; y < sh.top; y++) {
        const n = nameOf(W.at(x, y, z)), depth = sh.top - y;
        if (STRATA.has(n)) t.strataAnywhere++;
        if (depth >= 5 && depth <= 10 && y - sh.bottom > 2) { t.band++; if (STRATA.has(n)) t.bandStrata++; }
        if (y - sh.bottom <= 2 && depth > 10) { t.tips++; if (n === 'moss_block') t.tipMoss++; if (TIP.has(n)) t.tipOk++; }
      }
    }
    return t;
  };
  const t8 = tally(W8), t9 = tally(W9);
  check(isles.length === 4 && t9.cols >= 60, `four plain islands far out, ${t9.cols} of their columns (${isles.map(I => Math.round(I.x) + '/' + Math.round(I.z) + ' r' + Math.round(I.r)).join(', ')})`);
  check(t9.band > 0 && t9.bandStrata >= t9.band * 0.97, `vgen 9: under the soil the warm strata — ${t9.bandStrata} of ${t9.band} blocks at depth 5 … 10 (vgen 8: ${t8.bandStrata})`);
  check(t9.tips > 0 && t9.tipOk >= t9.tips * 0.85 && t9.tipMoss >= t9.tips * 0.3, `vgen 9: the tips moss among the tuff — ${t9.tipMoss} moss, ${t9.tipOk} moss or tuff of ${t9.tips} (the rest ore and crystal)`);
  check(t8.strataAnywhere === 0 && t8.cols === t9.cols && t8.tops === t9.tops && t9.tops >= t9.cols * 0.95, `vgen 8 keeps its islands: no strata block in ${t8.cols} columns (${t8.strataAnywhere}), the same tops (vgen 8 ${t8.tops}, vgen 9 ${t9.tops} of ${t9.cols} grass or snow, the rest the falls' rim pools)`);
  // the far rings (far.js ring 1, lod.js ring 2) draw an island's sides in one colour: vgen 9 warm, vgen 8 grey stone
  const LOD = V.LOD, P = LOD.palette(), plain = { ember: 0, prism: 0, t: 0.3 };
  const s8 = LOD.isleSide(W8.g, P, plain), s9 = LOD.isleSide(W9.g, P, plain), hex = (c) => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  check(s8 === P.stone && s9[0] > s9[2] + 30 && s9[0] > s9[1] + 10, `the far rings: an island's sides ${hex(s9)} at vgen 9 (vgen 8 grey stone ${hex(s8)}); ember ${hex(LOD.isleSide(W9.g, P, { ember: 0.6, prism: 0 }))} and prism ${hex(LOD.isleSide(W9.g, P, { ember: 0, prism: 0.6 }))} as before`);
}

// ---------------------------------------------------------------- 8 · the falls dissolve into mist
console.log('8 · a fall off a floating island pours off the rim and dissolves into mist (vgen 9)');
{
  // every column of the Sky Isles' region with a run of six or more falling fluid blocks: its top, its foot, what lies
  // under the foot; the columns of one fall (its 2 × 2 curtain) grouped by their rim; the chunks' mist spawns
  const scanFalls = (vgen) => {
    const g = V.makeGen('overworld', SEED, { vgen }), cols = [], mists = [];
    const C = HEART.ISLES;
    for (let cz = (C.z - 130) >> 4; cz <= (C.z + 130) >> 4; cz++) for (let cx = (C.x - 150) >> 4; cx <= (C.x + 130) >> 4; cx++) {
      const c = g.generate(cx, cz);
      if (c.spawns) for (const s of c.spawns) if (s[0] === 'mist') mists.push(s);
      for (let col = 0; col < 256; col++) {
        let run = 0, top = -1;
        for (let y = 250; y >= 1; y--) {
          const b = c.blocks[(y << 8) | col];
          if (b && (R.T.flags[b] & F.FLUID) && R.types[R.T.type[b]].get(b, 'level') >= 8) { if (!run) top = y; run++; continue; }
          if (run >= 6) cols.push({ x: cx * 16 + (col & 15), z: cz * 16 + (col >> 4), top, foot: top - run + 1, len: run, air: !b });
          run = 0;
        }
      }
    }
    const falls = [];
    for (const c of cols) { let f = falls.find(q => q.top === c.top && q.cols.some(o => Math.abs(o.x - c.x) <= 1 && Math.abs(o.z - c.z) <= 1)); if (!f) falls.push(f = { top: c.top, cols: [] }); f.cols.push(c); }
    return { cols, falls, mists };
  };
  const A8 = scanFalls(8), A9 = scanFalls(9);
  const len = (A) => A.cols.map(c => c.len).sort((a, b) => a - b);
  const l8 = len(A8), l9 = len(A9);
  check(A8.falls.length >= 5 && A8.cols.every(c => !c.air) && l8[0] >= 60, `vgen 8 keeps its falls: ${A8.falls.length} falls, ${A8.cols.length} columns, every one down to the ground, ${l8[0]} … ${l8[l8.length - 1]} long`);
  check(A9.falls.length === A8.falls.length && A9.cols.length === A8.cols.length, `vgen 9: the same falls off the same rims (${A9.falls.length} falls, ${A9.cols.length} columns; vgen 8 ${A8.falls.length}, ${A8.cols.length})`);
  const dissolve = A9.falls.filter(f => f.cols.every(c => c.air));
  check(l9.length > 0 && l9[l9.length - 1] <= 36 && l9[0] >= 18, `vgen 9: every curtain ends 18 … 36 below its rim (${l9[0]} … ${l9[l9.length - 1]})`);
  check(dissolve.length === A9.falls.length, `vgen 9: every fall over the low land ends in the air, not on it (${dissolve.length} of ${A9.falls.length})`);
  // (a curtain of one cell — where only one of the 2 × 2 cells lies off the rim — has one end)
  const wide = dissolve.filter(f => f.cols.length >= 2), ragged = wide.filter(f => new Set(f.cols.map(c => c.foot)).size === f.cols.length);
  check(ragged.length === wide.length && wide.length >= dissolve.length / 2, `vgen 9: each fall's cells end at their own heights, a ragged end (${ragged.length} of the ${wide.length} curtains of two or three cells; ${dissolve.length - wide.length} of one)`);
  const misted = dissolve.filter(f => A9.mists.some(m => f.cols.some(c => Math.abs(m[1] - c.x - 0.5) <= 2 && Math.abs(m[3] - c.z - 0.5) <= 2 && m[2] <= c.foot + 8 && m[2] >= c.foot - 8)));
  check(misted.length === dissolve.length && A9.mists.length === dissolve.length && A8.mists.length === 0, `vgen 9: a mist spawn at the foot of each (${misted.length} of ${dissolve.length}; ${A9.mists.length} spawns, vgen 8 ${A8.mists.length})`);

  // 9 · the spray (vents.js): the mist spawns of the loaded chunks puff soft white spray round each fall's foot — High a
  // puff every quarter second a fall, Low one every 0.9 s, Very Low none; nothing beyond the reach; a lava fall smokes
  console.log('9 · the falls\' mist: vents.js puffs spray at each foot (High, Low fewer, Very Low none)');
  require('../src/main/vents.js');
  const runMist = (preset, eye, secs, mists) => {
    const spawned = [];
    const game = { settings: { preset }, particles: { spawn(x, y, z, vx, vy, vz, o) { spawned.push({ x, y, z, o }); return 1; }, glow() { return 1; } } };
    const Vn = new VR.Vents(game);
    Vn.absorb(mists);
    for (let t = 0; t < secs; t += 1 / 30) Vn.update(1 / 30, eye);
    const near = (m) => spawned.filter(s => Math.abs(s.x - m[1]) < 4 && Math.abs(s.z - m[3]) < 4 && s.y > m[2] - 8 && s.y < m[2] + 8);
    return { Vn, spawned, near };
  };
  const ms = A9.mists.slice(0, 3), eye = [ms[0][1] + 40, ms[0][2] + 10, ms[0][3] + 30];
  const hi = runMist('high', eye, 4, ms), lo = runMist('low', eye, 4, ms), vl = runMist('potato', eye, 4, ms);
  const far = runMist('high', [ms[0][1] + 900, ms[0][2], ms[0][3]], 4, ms.slice(0, 1));
  const nh = hi.near(ms[0]).length, nl = lo.near(ms[0]).length, nv = vl.near(ms[0]).length;
  check(hi.Vn.mists && hi.Vn.mists.size === ms.length && hi.Vn.list.size === 0, `the mist spawns are kept apart from the vents (${hi.Vn.mists ? hi.Vn.mists.size : 0} mists, ${hi.Vn.list.size} vents)`);
  check(nh >= 12 && nh <= 24, `High: ${nh} puffs at a fall's foot in 4 s`);
  check(nl >= 3 && nl <= nh / 2, `Low: fewer (${nl})`);
  check(nv === 0 && vl.spawned.length === 0, `Very Low: none (${nv})`);
  check(far.near(ms[0]).length === 0, `nothing beyond the reach (${far.near(ms[0]).length} from 900 blocks)`);
  const p0 = hi.near(ms[0])[0];
  check(p0 && p0.o.collide === false && p0.o.grow > 0 && p0.o.alpha > 0 && p0.o.alpha <= 0.3 && !p0.o.emis && p0.o.col[2] >= 0.9, `a puff is see-through spray that grows as it thins (${p0 ? JSON.stringify({ size: +p0.o.size.toFixed(2), grow: p0.o.grow, alpha: p0.o.alpha, col: p0.o.col, life: +p0.o.life.toFixed(1) }) : '-'})`);
  // what a viewer sees of one foot (the curves): the real vents.js and particles.js run for 14 s round a foot, and the
  // live particles' discs — the particle shader's (1 − smoothstep(0.3, 1, d)) × the instance alpha — are laid over each
  // other along the view on a grid of quarter blocks: the opacity of the mist, its heart, its reach. Run c2's pictures
  // (water_1, water_r1, far_3): opaque discs of one or two blocks hung under the isles as white balls on strings — 1.00
  // at the heart; 902a59f's wide thin veils, all round the foot, piled up into a white ball of their own (0.97 at its
  // heart, 16 blocks across, nothing under it). The fall goes on as spray under its ragged end, slowing, widening and
  // thinning — a plume of mist, never a ball; a lava fall's end smokes upward
  {
    require('../src/main/particles.js');
    const plumeOf = (lava) => {
      let sd = 4242; const rnd = Math.random; Math.random = () => { sd = (Math.imul(sd, 1103515245) + 12345) >>> 0; return sd / 4294967296; };
      const P = new VR.Particles({ world: null, skyBright: 1 }), foot = [0.5, 100, 0.5], eye = [0.5, 100, 120];
      const Vn = new VR.Vents({ settings: { preset: 'high' }, particles: P });
      Vn.absorb([['mist', foot[0], foot[1], foot[2], lava ? 1 : 0]]);
      const RES = 0.25, X0 = -24, Y0 = foot[1] - 40, NX = 192, NY = 216, out = [];
      for (let f = 0; f < 14 * 30; f++) {
        Vn.update(1 / 30, eye); P.update(1 / 30, eye);
        if (f < 9 * 30 || f % 15) continue;
        const T = new Float32Array(NX * NY).fill(1), D = P.data;
        for (let k = 0; k < P.n; k++) {
          const o = k * 14, x = D[o] + eye[0], y = D[o + 1] + eye[1], z = D[o + 2] + eye[2], s = D[o + 3], a = D[o + 13];
          if (Math.abs(z - foot[2]) > 40 || Math.abs(x - foot[0]) > 40 || P.emis[k]) continue;   // (the foot's own spray: not the citadel's beam, not a spark)
          for (let j = Math.max(0, Math.floor((y - s - Y0) / RES)); j < Math.min(NY, Math.ceil((y + s - Y0) / RES)); j++) for (let i = Math.max(0, Math.floor((x - s - X0) / RES)); i < Math.min(NX, Math.ceil((x + s - X0) / RES)); i++) {
            const d = Math.hypot((X0 + (i + 0.5) * RES - x) / s, (Y0 + (j + 0.5) * RES - y) / s); if (d >= 1) continue;
            const q = d <= 0.3 ? 0 : (d - 0.3) / 0.7, aa = 1 - q * q * (3 - 2 * q); if (aa < 0.05) continue;
            T[j * NX + i] *= 1 - aa * a;
          }
        }
        let peak = 0, below = 0, above = 0;
        for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const op = 1 - T[j * NX + i], py = Y0 + (j + 0.5) * RES; if (op > peak) peak = op; if (op > 0.08) { if (py < foot[1]) below = Math.max(below, foot[1] - py); else above = Math.max(above, py - foot[1]); } }
        const width = (yy) => { const j = Math.floor((yy - Y0) / RES); let c = 0; for (let i = 0; i < NX; i++) if (1 - T[j * NX + i] > 0.08) c++; return c * RES; };
        out.push({ peak, below, above, w0: width(foot[1]), w6: width(foot[1] - 6) });
      }
      Math.random = rnd;
      const avg = (k) => out.reduce((s, q) => s + q[k], 0) / out.length;
      return { peak: Math.max(...out.map(q => q.peak)), below: avg('below'), above: avg('above'), w0: avg('w0'), w6: avg('w6') };
    };
    const W = plumeOf(false), L = plumeOf(true), fx = (q) => `the heart ${q.peak.toFixed(2)}, ${q.below.toFixed(1)} under the foot, ${q.above.toFixed(1)} over it, ${q.w0.toFixed(1)} wide at the foot, ${q.w6.toFixed(1)} six under it`;
    check(W.peak <= 0.7, `a fall's mist is a veil, never a ball: its heart at most 0.7 opaque (${fx(W)})`);
    check(W.below >= 10 && W.above <= 4 && W.w6 >= 5 && W.w6 > W.w0, `the spray goes on falling under the ragged end, widening as it thins (${W.below.toFixed(1)} under the foot, ${W.above.toFixed(1)} over it; ${W.w0.toFixed(1)} → ${W.w6.toFixed(1)} wide)`);
    check(L.peak <= 0.7 && L.above >= 8 && L.below <= 3, `a lava fall's end smokes upward, thin (${fx(L)})`);
  }
  // particles.js draws a particle's own opacity: the instance alpha of a veil is its alpha (× the fade), of a spark 1
  {
    require('../src/main/particles.js');
    const P = new VR.Particles({ world: null, skyBright: 1 });
    P.spawn(0, 0, 0, 0, 0, 0, { life: 4, size: 2, alpha: 0.25, collide: false, grav: 0 });
    P.spawn(0, 0, 0, 0, 0, 0, { life: 4, size: 0.1, collide: false, grav: 0 });
    P.update(0.016, [0, 0, 0]);
    const a0 = P.data[13], a1 = P.data[14 + 13];
    check(Math.abs(a0 - 0.25) < 0.01 && Math.abs(a1 - 1) < 0.01, `particles.js: a veil of alpha 0.25 is drawn at ${a0.toFixed(2)}, a spark at ${a1.toFixed(2)}`);
  }
  hi.Vn.reset();
  check(hi.Vn.mists.size === 0, `a new world brings its own falls (reset clears the mists)`);
}

// ---------------------------------------------------------------- 10 · a fall that is touched spills, it does not flood
// The audit's run c2 (far_3): a minute near a floating island's falls and the island hung in a cone of water 60 blocks
// deep. The game's block simulation (sim.js) left the generated falls alone until a block beside one changed — a grass
// block creeping onto the dirt beside a rim pool — and then every block of the falling curtain, with falling water under
// it, spread sideways at once, every new block falling and spreading again: 450 000 water blocks round one island in
// 4 000 ticks (node, vgen 8 and 9 alike). Falling water over falling water of its kind feeds the fall below and does not
// spread sideways (water landing on a lake still spreads on it): the touched fall spills a few streams off its pool's
// rim, as water does, and that is all. (Random ticks are left out here: the change beside the pool is made by hand.)
console.log('10 · a fall that is touched spills a little, it does not flood (sim.js)');
{
  require('../src/main/sim.js');
  const floodTest = (vgen, ticks) => {
    const g = V.makeGen('overworld', SEED, { vgen }), cols = new Map();
    const col = (cx, cz) => { const k = cx + ',' + cz; let c = cols.get(k); if (!c) { const ch = g.generate(cx, cz); c = { cx, cz, blocks: ch.blocks, sec: [] }; for (let sy = 0; sy < 16; sy++) c.sec.push({ count: 1 }); cols.set(k, c); } return c; };
    let sim = null;
    const world = {
      col, getLight: () => 0xf000,
      getBlock: (x, y, z) => (y < 0 || y > 255) ? 0 : col(x >> 4, z >> 4).blocks[(y << 8) | ((z & 15) << 4) | (x & 15)],
      setBlock(x, y, z, s, flags) { const c = col(x >> 4, z >> 4), i = (y << 8) | ((z & 15) << 4) | (x & 15), old = c.blocks[i]; if (old === s) return; c.blocks[i] = s; if (!(flags & 2)) sim.onBlockChanged(x, y, z, old, s); },
    };
    const game = { world, player: { pos: [-470.5, 128, 420.5], mode: 'creative' }, skyBright: 1, particles: { breakBlock() {}, smoke() {} }, audio: { play() {} }, dim: 'overworld', entities: null, dropsFor() {}, dropStack() {} };
    sim = new VR.Sim(game);
    sim.randomTicks = () => {};
    // the island of the audit's far_3 (centre -553/458, r 15, three falls): its first fall's rim pool, the grass beside it
    const I = g.islandAt(-553, 458).isle, a = ((I.seed * 0.618) % 1) * Math.PI * 2;
    let fx = 0, fz = 0, ft = null;
    for (let r = 0; r < I.r * 1.4; r++) { const px = Math.round(I.x + Math.cos(a) * r), pz = Math.round(I.z + Math.sin(a) * r), J = g.islandAt(px, pz); if (J && J.isle === I) { fx = px; fz = pz; ft = J; } else if (ft) break; }
    const box = (f) => { let n = 0; for (let z = Math.floor(I.z) - 45; z <= Math.floor(I.z) + 45; z++) for (let x = Math.floor(I.x) - 45; x <= Math.floor(I.x) + 45; x++) for (let y = 60; y < 200; y++) { const b = world.getBlock(x, y, z); if (b && f(b)) n++; } return n; };
    const fluid = (b) => R.T.flags[b] & F.FLUID;
    const f0 = box(fluid);
    // the trigger: grass creeps onto the dirt under the rim pool (water above is no cover), as a random tick does
    const under = world.getBlock(fx, ft.top - 1, fz);
    world.setBlock(fx, ft.top - 1, fz, under === R.byName.grass_block.defaultState ? R.byName.dirt.defaultState : R.byName.grass_block.defaultState, 1);
    for (let t = 0; t < ticks; t++) sim.step(false);
    return { f0, f1: box(fluid), pool: [fx, ft.top, fz] };
  };
  const T9 = floodTest(9, 600), T8 = floodTest(8, 600);
  check(T9.f1 - T9.f0 <= 1500, `vgen 9: a touched fall spills ${T9.f1 - T9.f0} fluid blocks round its island in 30 s (${T9.f0} → ${T9.f1}; the pool at ${T9.pool})`);
  check(T8.f1 - T8.f0 <= 1500, `vgen 8: the same in an old world (${T8.f0} → ${T8.f1})`);
  // water still flows as water: a source on a ledge runs to its edge, pours over it as one stream, spreads where it
  // lands (a stone ledge at y 70 for x < 0, the ground at y 60)
  {
    const B = new Map(), key = (x, y, z) => x + ',' + y + ',' + z, STONE = R.byName.stone.defaultState, WATER = R.byName.water.defaultState;
    const getBlock = (x, y, z) => { const v = B.get(key(x, y, z)); if (v !== undefined) return v; return y <= 60 || (x < 0 && y <= 70) ? STONE : 0; };
    let sim = null;
    const world = { getBlock, getLight: () => 0xf000, col: () => null, setBlock(x, y, z, s, flags) { const old = getBlock(x, y, z); if (old === s) return; B.set(key(x, y, z), s); if (!(flags & 2)) sim.onBlockChanged(x, y, z, old, s); } };
    sim = new VR.Sim({ world, player: { pos: [0, 80, 0], mode: 'creative' }, skyBright: 1, particles: { breakBlock() {}, smoke() {} }, audio: { play() {} }, dim: 'overworld', entities: null, dropsFor() {}, dropStack() {} });
    sim.randomTicks = () => {};
    world.setBlock(-3, 71, 0, WATER, 1);
    for (let t = 0; t < 900; t++) sim.step(false);
    let ledge = 0, air = 0, ground = 0, stream = 0;
    for (const [k, v] of B) { if (!v || !(R.T.flags[v] & F.FLUID)) continue; const [x, y] = k.split(',').map(Number); if (y === 71 && x < 0) ledge++; else if (y === 61) ground++; else if (y > 61 && y < 71 && x >= 0) { if (x === 0) stream++; else air++; } }
    check(ledge >= 3 && stream >= 9 && ground >= 20 && air === 0, `a source on a ledge: ${ledge} on the ledge, a stream of ${stream} down its edge, ${ground} spread where it lands, ${air} in the air beside the stream`);
  }
  // run c3 (far_3): the flood gone, a woken rim pool still spilled over its open side — grass creeping under it, a random
  // tick — and the spill ran down to the ground beside the fall as one stream, a puddle at its foot: the pole the fall
  // was made not to be. vgen 10 holds every spring pool on its rim (a lip of the island's top on each open side): every
  // pool of the Sky Isles and of far_3's island woken at once (its floor changed, as the grass did), 600 ticks — nothing
  // falls into the air under a curtain's foot. vgen 9 (released) spills.
  {
    const wakeAll = (vgen) => {
      const g = V.makeGen('overworld', SEED, { vgen }), cols = new Map();
      const col = (cx, cz) => { const k = cx + ',' + cz; let c = cols.get(k); if (!c) { const ch = g.generate(cx, cz); c = { cx, cz, blocks: ch.blocks, sec: [] }; for (let sy = 0; sy < 16; sy++) c.sec.push({ count: 1 }); cols.set(k, c); } return c; };
      let sim = null;
      const world = {
        col, getLight: () => 0xf000,
        getBlock: (x, y, z) => (y < 0 || y > 255) ? 0 : col(x >> 4, z >> 4).blocks[(y << 8) | ((z & 15) << 4) | (x & 15)],
        setBlock(x, y, z, s, flags) { const c = col(x >> 4, z >> 4), i = (y << 8) | ((z & 15) << 4) | (x & 15), old = c.blocks[i]; if (old === s) return; c.blocks[i] = s; if (!(flags & 2)) sim.onBlockChanged(x, y, z, old, s); },
      };
      sim = new VR.Sim({ world, player: { pos: [0, 128, 0], mode: 'creative' }, skyBright: 1, particles: { breakBlock() {}, smoke() {} }, audio: { play() {} }, dim: 'overworld', entities: null, dropsFor() {}, dropStack() {} });
      sim.randomTicks = () => {};
      const falling = (b) => b && (R.T.flags[b] & F.FLUID) && R.types[R.T.type[b]].get(b, 'level') >= 8;
      const C = HEART.ISLES, falls = [];
      for (const [xa, xb, za, zb] of [[C.x - 150, C.x + 130, C.z - 130, C.z + 130], [-600, -506, 410, 506]]) for (let cz = za >> 4; cz <= zb >> 4; cz++) for (let cx = xa >> 4; cx <= xb >> 4; cx++) {
        const c = col(cx, cz);
        for (let k = 0; k < 256; k++) { let run = 0, top = -1; for (let y = 250; y >= 1; y--) { const b = c.blocks[(y << 8) | k]; if (falling(b)) { if (!run) top = y; run++; continue; } if (run >= 6 && !b) falls.push({ x: cx * 16 + (k & 15), z: cz * 16 + (k >> 4), top, foot: top - run + 1 }); run = 0; } }
      }
      // their spring pools: the source blocks beside a curtain's top
      const pools = new Map();
      for (const f of falls) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = f.x + dx, z = f.z + dz, b = world.getBlock(x, f.top, z); if (b && (R.T.flags[b] & F.FLUID) && R.types[R.T.type[b]].get(b, 'level') === 0) pools.set(x + ',' + f.top + ',' + z, [x, f.top, z]); }
      // the air under every foot (25 blocks of it, six round each curtain column): the fluid there
      const under = () => { const seen = new Set(); for (const f of falls) for (let dz = -6; dz <= 6; dz++) for (let dx = -6; dx <= 6; dx++) for (let y = f.foot - 25; y < f.foot - 1; y++) { const b = world.getBlock(f.x + dx, y, f.z + dz); if (b && (R.T.flags[b] & F.FLUID)) seen.add((f.x + dx) + ',' + y + ',' + (f.z + dz)); } return seen.size; };
      const u0 = under(), GR = R.byName.grass_block.defaultState, DI = R.byName.dirt.defaultState;
      for (const [x, y, z] of pools.values()) { const fl = world.getBlock(x, y - 1, z); world.setBlock(x, y - 1, z, fl === GR ? DI : GR, 1); }
      for (let t = 0; t < 600; t++) sim.step(false);
      return { falls: falls.length, pools: pools.size, u0, u1: under() };
    };
    // (the lips are all vgen 10 changes round the isles: the islands' chunks of the two worlds block by block)
    {
      const g9 = V.makeGen('overworld', SEED, { vgen: 9 }), g10 = V.makeGen('overworld', SEED, { vgen: 10 }), C = HEART.ISLES, TOP = /^(grass_block|red_sand|snow_block)$/;
      let diff = 0, lips = 0;
      for (const [xa, xb, za, zb] of [[C.x - 150, C.x + 130, C.z - 130, C.z + 130], [-600, -506, 410, 506]]) for (let cz = za >> 4; cz <= zb >> 4; cz++) for (let cx = xa >> 4; cx <= xb >> 4; cx++) {
        const a = g9.generate(cx, cz).blocks, b = g10.generate(cx, cz).blocks;
        for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { diff++; if (TOP.test(nameOf(b[i])) && (!a[i] || !(R.T.flags[a[i]] & F.SOLID))) lips++; }
      }
      // (since t-land, vgen 10 also lays the land's woods and ways round the isles: the lips are among the changes, the
      // rest is the land's — land.js and land_v9_same.js pin that)
      check(diff > 0 && lips >= 8, `vgen 10 differs from vgen 9 round the isles by the pools' lips, 8 at least (${lips} lips among ${diff} changed blocks: the island's top block where air or a plant stood)`);
    }
    const P9 = wakeAll(9), P10 = wakeAll(10);
    console.log(`     vgen 9 (released): ${P9.pools} pools woken over ${P9.falls} curtain columns — ${P9.u1 - P9.u0} fluid blocks fell into the air under the feet`);
    check(P10.pools >= 12 && P10.falls >= 20 && P10.u1 === P10.u0, `vgen 10: every woken spring pool stays on its rim — ${P10.pools} pools over ${P10.falls} curtain columns, ${P10.u1 - P10.u0} fluid blocks under the feet after 600 ticks (${P10.u0} → ${P10.u1})`);
  }
}

// ---------------------------------------------------------------- 11 · a street climbs in half steps (vgen 10)
// beauty_audit run c2's street_2: Palm Row rises a block at x ≈ 51 (81 → 82), and the step's face read as a low wall
// across the street eleven blocks ahead — four such steps, 80 → 81 → 82 at both its ends. vgen 10: where a street's
// surface rises a block, the two samples below the rise are paved half a block higher (a light grey slab, the kerb's
// own, on the paving; the light lines at the kerbs stay as they are), so it climbs in half steps. vgen 9 keeps its city
// as released (v0.45): nothing but those slabs differs between the two.
console.log('11 · a street climbs in half steps (vgen 10)');
const W10 = world(10);
{
  const site = (g) => VG.sitesFor(g, 0, -9).find(x => x.home);
  const P9 = VG.plan(W9.g, site(W9.g)), P10 = VG.plan(W10.g, site(W10.g));
  const PAVE = /^vx_floor_plaza/, SLAB = R.byName.vollton_light_grey_slab.state({ type: 'bottom' });
  // the surface of a paved cell: the top of its paving (the first plaza block from y 95 down), half a block more under
  // a bottom slab of light grey; null where there is no paving
  const surf = (W, x, z) => { for (let y = 95; y > 70; y--) if (PAVE.test(nameOf(W.at(x, y, z)))) return W.at(x, y + 1, z) === SLAB ? y + 1.5 : y + 1; return null; };
  // along a road's centre line and two lines 1.5 to either side of it (inside its light lines), sample by sample: the
  // rises and falls of the surface (a turning circle's bed and its ring are no street)
  const walk = (W, P, rd) => {
    const out = { half: 0, full: [] };
    for (const off of [-1.5, 0, 1.5]) {
      let last = null;
      for (let k = 0; k < rd.pts.length; k++) {
        const [px, pz] = rd.pts[k], q = rd.pts[Math.min(rd.pts.length - 1, k + 1)], p0 = rd.pts[Math.max(0, k - 1)], a = Math.atan2(q[1] - p0[1], q[0] - p0[0]);
        if ((P.nova.turns || []).some(t => Math.hypot(px - t.x, pz - t.z) <= t.bed + 1.5)) { last = null; continue; }
        const x = Math.floor(px - Math.sin(a) * off), z = Math.floor(pz + Math.cos(a) * off), s = surf(W, x, z);
        if (s === null) { last = null; continue; }
        if (last !== null) { const d = Math.abs(s - last); if (d === 0.5) out.half++; else if (d >= 1) out.full.push(`${rd.name} ${off} at ${x}, ${z}: ${last} → ${s}`); }
        last = s;
      }
    }
    return out;
  };
  const pr9 = walk(W9, P9, P9.nova.roads.find(r => r.name === 'palmrow'));
  check(pr9.full.length === 12 && pr9.half === 0, `vgen 9 keeps its streets as released: Palm Row steps a whole block 4 times on each of its three lines (${pr9.full.length} whole steps, ${pr9.half} half)`);
  let half = 0; const full = [];
  for (const rd of P10.nova.roads) { const r = walk(W10, P10, rd); half += r.half; full.push(...r.full); }
  check(full.length === 0 && half >= 24, `vgen 10: every street climbs in half steps (${half} half steps, ${full.length} whole${full.length ? ': ' + full.slice(0, 6).join('; ') : ''})`);
  // the light lines stay one line each at the kerbs, lit and unbroken (the slabs lie inside them)
  {
    const LINE = new Set();
    for (const [, b] of P10.chunks) for (let i = 0; i < b.o.length; i += 4) { const n = nameOf(b.o[i + 3]); if (n === 'vx_floor_plaza_line' || n === 'vx_floor_plaza_line_amber') LINE.add(b.o[i] + ',' + b.o[i + 2]); }
    let n = 0, covered = 0;
    for (const rd of P10.nova.roads) for (const sd of ['L', 'R']) for (const [x, z] of ((rd.kerb && rd.kerb[sd]) || [])) { n++; const s = surf(W10, x, z); if (!LINE.has(x + ',' + z) || s === null || s % 1 !== 0) covered++; }
    check(n > 300 && covered === 0, `vgen 10: the kerbs' light lines stay lit and uncovered (${covered} of ${n} kerb cells covered or unlit)`);
  }
  // nothing else differs: the city's chunks of the two worlds block by block (y 70 … 100), the only change a slab of
  // light grey on a road's paving
  {
    let diff = 0, slabs = 0; const other = [];
    for (const key of P10.chunks.keys()) {
      const [cx, cz] = key.split(',').map(Number), a = W9.chunk(cx, cz).blocks, b = W10.chunk(cx, cz).blocks;
      for (let y = 70; y <= 100; y++) for (let i = 0; i < 256; i++) {
        const j = (y << 8) | i; if (a[j] === b[j]) continue;
        diff++;
        if (b[j] === SLAB && !a[j] && PAVE.test(nameOf(b[j - 256]))) slabs++; else if (other.length < 4) other.push(`${cx * 16 + (i & 15)}, ${y}, ${cz * 16 + (i >> 4)}: ${nameOf(a[j])} → ${nameOf(b[j])}`);
      }
    }
    // (since t-land, vgen 10 also paves the plaza's ways here: the slabs are among the changes)
    check(diff > 0 && slabs >= 40, `vgen 10 differs from vgen 9 by the ramps' slabs (${slabs} slabs among ${diff} changed blocks over ${P10.chunks.size} chunks${other.length ? '; other: ' + other.join('; ') : ''})`);
  }
}

// ---------------------------------------------------------------- 5 · Very Low
// the mesher's triangles per chunk column within Very Low's render distance (4 chunks) of the audit's two Very Low
// scenes (test/beauty_audit.mjs COST=1: the crescent's west end — its turning circle — and the lawn between the villa
// rows), the faces Very Low draws (terrain, cutout, water, the mini-voxel far boxes beyond its 12-block detail
// distance, the near pieces within): vgen 9 at most 1 % over vgen 8 — equal (the method of test/trailer_city.js 5)
if (!process.env.SKIP_COST) {
  console.log('5 · Very Low: the chunk triangles at the cost scenes');
  V.setLook('seamless');
  const PAD = V.MESH_PAD, PS = V.MESH_PS, PSS = PS * PS, RD = 4, VXLOD = 12;
  const windowTris = (W, at, eyeY) => {
    const want = [], c0x = Math.floor(at[0] / 16), c0z = Math.floor(at[1] / 16);
    for (let dz = -RD; dz <= RD; dz++) for (let dx = -RD; dx <= RD; dx++) if (dx * dx + dz * dz <= RD * RD) want.push([c0x + dx, c0z + dz]);
    const lit = new Map(), col = (cx, cz) => { const k = cx + ',' + cz; let c = lit.get(k); if (!c) { c = W.chunk(cx, cz); if (!c.light) c.light = V.computeColumnLight(c.blocks, true); lit.set(k, c); } return c; };
    let tris = 0;
    for (const [CX, CZ] of want) for (let sy = 0; sy < 16; sy++) {
      const blocks = new Uint16Array(PSS * PS), light = new Uint16Array(PSS * PS), gr = new Uint16Array(PSS), fo = new Uint16Array(PSS), wa = new Uint16Array(PSS);
      let any = false;
      for (let y = -PAD; y < 16 + PAD; y++) for (let z = -PAD; z < 16 + PAD; z++) for (let x = -PAD; x < 16 + PAD; x++) {
        const wy = sy * 16 + y, c = col(CX + Math.floor(x / 16), CZ + Math.floor(z / 16));
        const lx = ((x % 16) + 16) % 16, lz = ((z % 16) + 16) % 16, pi = (y + PAD) * PSS + (z + PAD) * PS + (x + PAD);
        if (y === 0) { const ti = (z + PAD) * PS + x + PAD; gr[ti] = c.tints.grass[lz * 16 + lx]; fo[ti] = c.tints.foliage[lz * 16 + lx]; wa[ti] = c.tints.water[lz * 16 + lx]; }
        if (wy < 0 || wy > 255) { light[pi] = wy > 255 ? 0xf000 : 0; continue; }
        const i = (wy << 8) | (lz << 4) | lx; blocks[pi] = c.blocks[i]; light[pi] = c.light[i];
        if (blocks[pi] && x >= 0 && x < 16 && z >= 0 && z < 16 && y >= 0 && y < 16) any = true;
      }
      if (!any) continue;
      const r = V.meshSection({ blocks, light, grass: gr, foliage: fo, water: wa, sy, ox: CX * 16, oz: CZ * 16, smooth: true, fancyLeaves: false, vxLod: true });
      const near = Math.hypot(CX * 16 + 8 - at[0], CZ * 16 + 8 - at[1], sy * 16 + 8 - eyeY) < VXLOD + 14;
      const q = (a) => a ? a.length / 8 / 4 * 2 : 0;
      tris += q(r.opaque) + q(r.cutout) + q(r.trans) + (near ? q(r.vx) : q(r.vxFar));
    }
    return tris / want.length;
  };
  for (const [scene, at] of [['crescent_end', [-100.5, -91.5]], ['between_rows', [20.5, -116.5]]]) {
    const t0 = performance.now(), a = windowTris(W8, at, 82), b = windowTris(W9, at, 82), c = windowTris(W10, at, 82);
    check(b <= a * 1.01, `${scene}: vgen 9 ${b.toFixed(0)} triangles a column, vgen 8 ${a.toFixed(0)} (${(b / a * 100 - 100).toFixed(1)} %, ${((performance.now() - t0) / 1000).toFixed(0)} s)`);
    check(c <= b * 1.04, `${scene}: vgen 10 (the streets' half steps, and t-land's ways and plants) ${c.toFixed(0)} triangles a column, vgen 9 ${b.toFixed(0)} (${(c / b * 100 - 100).toFixed(1)} %, limit 4 %)`);
  }
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
