// The land between (t-land, vgen 10; plan docs/superpowers/plans/2026-10-09-t-land.md) — every rule a check:
//   1. ways: every site reached from the temple over the way cells, no step between neighbouring way cells steeper
//      than one block, every way cell over water a deck (a bridge), a lantern every 12 blocks and a bench and a
//      milestone every 40; in the generated chunks the way is there (its surface at the plan's height, headroom free)
//   (the later sections — woods, farms, water, rocks, animals — come with their pieces)
//   bash test/wt_run.sh land.js 600        (SEED=… another world; ONLY=1,2 some sections)
const V = require('./load_shared.js');
const R = V.R, LAND = V.Land, SEA = V.C.SEA;
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const nameOf = (s) => (s ? R.types[R.T.type[s]].name : 'air');
const SEED = +(process.env.SEED || 4242);
const ONLY = process.env.ONLY ? process.env.ONLY.split(',').map(Number) : null;
const want = (k) => !ONLY || ONLY.includes(k);
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(1) + ' s';
const g = V.makeGen('overworld', SEED, { vgen: 10 });
check(!!LAND && LAND.on(g) && !LAND.on(V.makeGen('overworld', SEED, { vgen: 9 })), 'the land layer is on for vgen 10 and off for vgen 9');
const t0 = Date.now();
const P = LAND.plan(g);
console.log(`  the plan: ${P.sites.length} sites, ${P.lines.length} ways, ${P.cells.size} way cells, ${P.furn.length} pieces of furniture, ${P.pieces.length} set pieces (${Date.now() - t0} ms)`);
check(Date.now() - t0 < 6000, `the plan is made in under 6 s (${Date.now() - t0} ms)`);
const ck = (x, z) => x * 65536 + z;
// the chunks generated once, shared by the sections
const CH = new Map();
const chunk = (cx, cz) => { const k = cx + ',' + cz; let c = CH.get(k); if (!c) { c = g.generate(cx, cz); CH.set(k, c); } return c; };
const blockAt = (x, y, z) => { const c = chunk(x >> 4, z >> 4); return c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)]; };

// ---------------------------------------------------------------- 1 · ways
if (want(1)) {
  console.log('1 · ways that connect');
  const cells = P.cells, nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  // reach: a flood over the way cells from the temple's west anchor; the plaza joins its two anchors, the crescent
  // street the city's two ends
  const site = (id) => P.sites.find(s => s.id === id);
  const seen = new Set(), q = [];
  const seed = (s) => { for (const c of cells.values()) if (Math.hypot(c.x - s.x, c.z - s.z) <= 2.5 && !seen.has(ck(c.x, c.z))) { seen.add(ck(c.x, c.z)); q.push(c); } };
  const flood = () => { while (q.length) { const c = q.pop(); for (const [dx, dz] of nb) { const k = ck(c.x + dx, c.z + dz), n = cells.get(k); if (n && !seen.has(k)) { seen.add(k); q.push(n); } } } };
  const reached = (s) => { for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) if (seen.has(ck(s.x + dx, s.z + dz))) return true; return false; };
  seed(site('temple_w')); flood();
  for (const [a, b] of LAND.JOINED) { if (reached(site(a)) || reached(site(b))) { seed(site(a)); seed(site(b)); flood(); } }
  // (a second round: a joined pair reached through the other)
  for (const [a, b] of LAND.JOINED) { if (reached(site(a)) || reached(site(b))) { seed(site(a)); seed(site(b)); flood(); } }
  const lost = P.sites.filter(s => !reached(s));
  check(lost.length === 0, `every site is reached from the temple over the ways (${P.sites.length - lost.length} of ${P.sites.length}${lost.length ? '; not: ' + lost.map(s => s.id + ' (' + s.x + ', ' + s.z + ')').join(', ') : ''})`);
  // steps
  let steep = 0, worst = 0, ex = '';
  for (const c of cells.values()) for (const [dx, dz] of nb) { const n = cells.get(ck(c.x + dx, c.z + dz)); if (!n) continue; const d = Math.abs(n.y - c.y); if (d > 1) { steep++; if (d > worst) { worst = d; ex = `(${c.x}, ${c.z}) ${c.y} → ${n.y}`; } } }
  check(steep === 0, `no step between neighbouring way cells is steeper than one block (${steep} steeper${steep ? ', worst ' + worst + ' at ' + ex : ''})`);
  // water under a way: a deck
  let wetN = 0, wetDeck = 0, decks = 0, arches = 0;
  for (const c of cells.values()) { if (c.deck) decks++; if (c.deck === 2) arches++; const gy = g.surfaceY(c.x, c.z); if (gy < SEA) { wetN++; if (c.deck && c.y > SEA) wetDeck++; } }
  check(wetN === wetDeck, `every way cell over water is a deck above the water (${wetDeck} of ${wetN}; ${decks} deck cells, ${arches} of them stone arches over the river)`);
  // the river is crossed somewhere by an arch
  check(arches > 20, `the river is bridged (${arches} arch cells)`);
  // lanterns, benches, milestones
  let len = 0; for (const L of P.lines) len += L.pts.length;
  const nL = P.furn.filter(f => f.kind === 'lamp' || f.kind === 'lamp_deck').length, nB = P.furn.filter(f => f.kind === 'bench').length, nS = P.furn.filter(f => f.kind === 'stone').length;
  check(nL >= 0.75 * len / 12, `a lantern about every 12 blocks (${nL} along ${len} blocks of way: one per ${(len / Math.max(1, nL)).toFixed(1)})`);
  check(nB >= 0.6 * len / 40 && nS >= 0.6 * len / 40, `a bench and a milestone about every 40 blocks (${nB} benches, ${nS} milestones: one per ${(len / Math.max(1, nB)).toFixed(0)} blocks)`);
  // in the chunks: sample way cells over the land, their chunk generated
  const all = [...cells.values()].filter(c => !c.deck);
  const sample = []; for (let i = 0; i < all.length; i += Math.max(1, Math.floor(all.length / 60))) sample.push(all[i]);
  const WAY = new Set(['dirt_path', 'coarse_dirt', 'gravel', 'flagstone', 'vx_floor_plaza']);
  let okN = 0, bad = [];
  for (const c of sample) {
    const top = blockAt(c.x, c.y, c.z), above = blockAt(c.x, c.y + 1, c.z), above2 = blockAt(c.x, c.y + 2, c.z);
    const free = (b) => !b || !(R.T.flags[b] & V.F.SOLID) || (R.T.flags[b] & V.F.PLANT);
    if (WAY.has(nameOf(top)) && free(above) && free(above2)) okN++; else if (bad.length < 4) bad.push(`(${c.x}, ${c.y}, ${c.z}) ${nameOf(top)} / ${nameOf(above)}`);
  }
  check(okN >= sample.length * 0.95, `the ways are in the generated chunks: their surface at the plan's height, two blocks free over it (${okN} of ${sample.length}${bad.length ? '; e.g. ' + bad.join(', ') : ''}) (${secs()})`);
  // lanterns in those chunks
  const lamps = P.furn.filter(f => f.kind === 'lamp' && CH.has((f.x >> 4) + ',' + (f.z >> 4)));
  let lit = 0;
  for (const f of lamps) { let has = false; for (let y = f.y - 3; y <= f.y + 7; y++) if (nameOf(blockAt(f.x, y, f.z)) === 'lantern') has = true; if (has) lit++; }
  check(lamps.length === 0 || lit >= lamps.length * 0.9, `the lanterns stand in the chunks (${lit} of ${lamps.length} in the generated chunks)`);
  // a deck in a chunk: planks or stone with a parapet
  const dk = [...cells.values()].filter(c => c.deck && c.d > 0.95).slice(0, 6);
  let dOk = 0; for (const c of dk) { const n0 = nameOf(blockAt(c.x, c.y, c.z)), n1 = nameOf(blockAt(c.x, c.y + 1, c.z)); if ((n0 === 'spruce_planks' && n1 === 'spruce_fence') || (/stone_bricks$/.test(n0) && n1 === 'stone_brick_wall')) dOk++; }
  check(dk.length === 0 || dOk >= dk.length - 1, `the bridges' edges carry a parapet (${dOk} of ${dk.length})`);
}

console.log(`(${secs()})`);
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
