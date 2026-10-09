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

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
