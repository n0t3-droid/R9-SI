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

// ---------------------------------------------------------------- 2 · woods and meadows
if (want(2)) {
  console.log('2 · woods, groves, meadows, clearings');
  const F = V.F, BI = V.BIOME;
  // cover: the share of the open designed land (no site, no way, not the lake) under wood, on a 6-block grid
  let open = 0, wood = 0, kinds = [0, 0, 0, 0, 0];
  for (let z = -640; z <= 640; z += 6) for (let x = -640; x <= 640; x += 6) {
    if (x * x + z * z > 640 * 640 || LAND.zoneAt(g, x, z) || LAND.keepAt(P, x, z)) continue;
    const y = g.surfaceY(x, z); if (y <= SEA + 1) continue;
    open++; const q = LAND.woodAt(g, x, z); if (q.d > 0.5) { wood++; kinds[q.kind]++; }
  }
  const cover = wood / Math.max(1, open);
  check(cover >= 0.15 && cover <= 0.35, `the woods cover ${(cover * 100).toFixed(1)} % of the open land (15–35 %; ${open} samples; mixed ${kinds[0]}, birch ${kinds[1]}, dark ${kinds[2]}, conifers ${kinds[3]}, cherry ${kinds[4]})`);
  check(kinds.every(k => k > 0), 'every kind of wood grows somewhere (mixed, birch, dark, conifers, cherry)');
  // chunks in a wood, at its edge and in the meadow: their trunks, their floor, their flowers
  const woodChunks = [], meadowChunks = [];
  for (let cz = -38; cz <= 38 && (woodChunks.length < 8 || meadowChunks.length < 8); cz += 5) for (let cx = -38; cx <= 38; cx += 5) {
    const x = cx * 16 + 8, z = cz * 16 + 8; if (x * x + z * z > 600 * 600 || LAND.zoneAt(g, x, z)) continue;
    const d = LAND.woodAt(g, x, z).d;
    if (d > 0.9 && woodChunks.length < 8) woodChunks.push([cx, cz]); else if (d < 0.01 && meadowChunks.length < 8 && !LAND.keepAt(P, x, z)) meadowChunks.push([cx, cz]);
  }
  const isLog = (b) => b && /_log$/.test(nameOf(b)) && !/stripped/.test(nameOf(b));
  let trunks = 0, onWay = 0, floorN = 0, floorPlant = 0, ex = '';
  for (const [cx, cz] of woodChunks.concat(meadowChunks)) {
    const c = chunk(cx, cz);
    for (let col = 0; col < 256; col++) {
      const x = cx * 16 + (col & 15), z = cz * 16 + (col >> 4);
      let y = 200; while (y > 2 && !c.blocks[(y << 8) | col]) y--;
      // the lowest log of a column standing on the ground: a trunk
      for (let yy = 60; yy < 200; yy++) { const b = c.blocks[(yy << 8) | col], below = c.blocks[((yy - 1) << 8) | col]; if (isLog(b) && below && !isLog(below) && (R.T.flags[below] & F.SOLID) && !(R.T.flags[below] & F.LEAVES)) { trunks++; if (P.cells.has(ck(x, z)) || (LAND.keepAt(P, x, z) & 2)) { onWay++; if (!ex) ex = `(${x}, ${yy}, ${z})`; } break; } }
    }
  }
  check(trunks > 50 && onWay === 0, `no trunk stands on a way or a piece (${onWay} of ${trunks} trunks in ${woodChunks.length + meadowChunks.length} chunks${ex ? ', e.g. ' + ex : ''})`);
  // the woods' floor: plants, litter, moss on the ground under the trees
  for (const [cx, cz] of woodChunks) {
    const c = chunk(cx, cz);
    for (let col = 0; col < 256; col++) {
      let y = 200; while (y > 2) { const b = c.blocks[(y << 8) | col]; if (b && !(R.T.flags[b] & F.LEAVES) && !isLog(b) && !((R.T.flags[b] & F.PLANT) && !(R.T.flags[b] & F.SOLID)) && nameOf(b) !== 'moss_carpet' && !/leaf_litter|petals|wildflowers/.test(nameOf(b))) break; y--; }
      const g0 = nameOf(c.blocks[(y << 8) | col]); if (!/grass_block|podzol|coarse_dirt|moss_block/.test(g0)) continue;
      floorN++; const a = c.blocks[((y + 1) << 8) | col]; if (a && !isLog(a) && !(R.T.flags[a] & F.LEAVES)) floorPlant++;
    }
  }
  check(woodChunks.length >= 4 && floorPlant >= floorN * 0.2, `the woods have undergrowth: ${floorPlant} of ${floorN} floor columns carry a fern, litter, moss, a bush or a mushroom (${woodChunks.length} wood chunks)`);
  // flowers in drifts: counted in 8 × 8 bins over meadow chunks — clustered, not sprinkled (index of dispersion ≫ 1,
  // the nearest-neighbour ratio well under 1)
  const FLOW = /poppy|daisy|cornflower|dandelion|bluet|allium|tulip|wildflowers|lily_of_the_valley/;
  const bins = [], pts = [];
  // a meadow region: 4 × 4 chunks
  let reg = null;
  for (let cz = -36; cz <= 36 && !reg; cz += 2) for (let cx = -36; cx <= 36 && !reg; cx += 2) {
    let ok = true; for (let dz = 0; dz < 4 && ok; dz++) for (let dx = 0; dx < 4; dx++) { const x = (cx + dx) * 16 + 8, z = (cz + dz) * 16 + 8; if (x * x + z * z > 600 * 600 || LAND.zoneAt(g, x, z) || LAND.woodAt(g, x, z).d > 0.02 || g.surfaceY(x, z) <= SEA + 2) { ok = false; break; } }
    if (ok) reg = [cx, cz];
  }
  if (reg) {
    for (let dz = 0; dz < 4; dz++) for (let dx = 0; dx < 4; dx++) {
      const c = chunk(reg[0] + dx, reg[1] + dz);
      for (let col = 0; col < 256; col++) for (let y = 62; y < 140; y++) { const b = c.blocks[(y << 8) | col]; if (b && FLOW.test(nameOf(b))) { pts.push([(reg[0] + dx) * 16 + (col & 15), (reg[1] + dz) * 16 + (col >> 4)]); break; } }
    }
    for (let i = 0; i < 64; i++) bins.push(0);
    for (const [x, z] of pts) { const bi = Math.floor((x - reg[0] * 16) / 8), bj = Math.floor((z - reg[1] * 16) / 8); bins[bj * 8 + bi]++; }
    const mean = bins.reduce((a, b) => a + b, 0) / bins.length, vr = bins.reduce((a, b) => a + (b - mean) ** 2, 0) / bins.length, iod = vr / Math.max(1e-9, mean);
    let nn = 0; for (const p of pts) { let best = 1e9; for (const q of pts) if (q !== p) { const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d < best) best = d; } nn += best; }
    const dens = pts.length / (64 * 64), ratio = pts.length > 1 ? (nn / pts.length) / (0.5 / Math.sqrt(dens)) : 1;
    check(pts.length >= 30 && iod > 3 && ratio < 0.6, `the flowers grow in drifts: ${pts.length} flowers in a 64 × 64 meadow at (${reg[0] * 16}, ${reg[1] * 16}), index of dispersion ${iod.toFixed(1)} (> 3), nearest-neighbour ratio ${ratio.toFixed(2)} (< 0.6)`);
  } else check(false, 'a meadow of 4 × 4 chunks is found for the flowers');
  // the clearings: a campfire, two tents, no tree within 6 of the fire
  const camps = P.pieces.filter(p => p.kind === 'camp');
  let campOk = 0;
  for (const cp of camps.slice(0, 3)) {
    const fire = nameOf(blockAt(cp.x, cp.y + 1, cp.z)) === 'campfire';
    let tents = 0, logs = 0;
    for (let dz = -6; dz <= 6; dz++) for (let dx = -6; dx <= 6; dx++) for (let y = cp.y - 2; y <= cp.y + 4; y++) { const n = nameOf(blockAt(cp.x + dx, y, cp.z + dz)); if (/^vx_ridge_/.test(n)) tents++; if (isLog(blockAt(cp.x + dx, y, cp.z + dz)) && dx * dx + dz * dz <= 36) logs++; }
    if (fire && tents >= 4 && logs === 0) campOk++;
  }
  check(camps.length >= 3 && campOk === Math.min(3, camps.length), `clearings in the woods with a campfire and two tents (${camps.length} camps; ${campOk} checked in their chunks)`);
  // hedgerows and poplar rows
  const hedges = P.furn.filter(f => f.kind === 'hedge').length, pop = (P.trees || []).filter(t => t.kind === 'poplar').length;
  check(hedges > 200 && pop > 20, `hedgerows along the ways (${hedges} hedge columns) and poplar rows on the farm lanes (${pop} poplars)`);
  console.log(`  (${secs()})`);
}

// ---------------------------------------------------------------- 3 · farms
if (want(3)) {
  console.log('3 · farmsteads: fields, barn, windmill, well, pasture, orchard, vineyard');
  const farms = P.sites.filter(s => s.kind === 'farm'), pc = (kind, f) => P.pieces.filter(p => p.kind === kind && (!f || p.farm === f.id));
  for (const f of farms) {
    const fields = pc('field', f).filter(p => p.crop), barn = pc('barn', f).length, house = pc('farmhouse', f).length;
    check(barn === 1 && house === 1 && fields.length >= 2, `${f.id} (${f.x}, ${f.z}): a farmhouse (${house}), a barn (${barn}), ${fields.length} crop fields (${fields.map(p => p.crop).join(', ')}), ${pc('pasture', f).length} pasture, ${pc('orchard', f).length} orchard, ${pc('windmill', f).length} windmill, ${pc('vineyard', f).length} vineyard, ${pc('flowers', f).length} flower field, ${pc('well', f).length} well`);
  }
  const allFields = P.pieces.filter(p => p.kind === 'field' && p.crop);
  check(farms.length >= 4 && allFields.length >= 8, `four farmsteads and their fields (${farms.length} farms, ${allFields.length} crop fields)`);
  check(pc('windmill').length >= 2 && pc('pasture').length >= 3 && pc('orchard').length >= 3 && pc('vineyard').length >= 1 && pc('well').length >= 4, `windmills (${pc('windmill').length}), pastures (${pc('pasture').length}), orchards (${pc('orchard').length}), a vineyard (${pc('vineyard').length}), wells (${pc('well').length})`);
  // in the chunks: the crops lie flat in their rows, a fence runs round every field (its gate allowed), a scarecrow
  let flatBad = 0, cropN = 0, cropOk = 0, rimN = 0, rimOk = 0, scare = 0;
  const ROT = LAND.ROT4;
  for (const fl of allFields) {
    const at = (u, v) => { const q = ROT[fl.r](u, v); return [fl.ox + q[0], fl.oz + q[1]]; };
    const mid = fl.w >> 1;
    let lastY = null;
    for (let u = 1; u < fl.w - 1; u++) for (let v = 1; v < fl.d - 1; v++) {
      if (u === mid) continue;
      const [x, z] = at(u, v); cropN++;
      const fb = nameOf(blockAt(x, fl.F, z)), cb = nameOf(blockAt(x, fl.F + 1, z));
      if (fb === 'farmland' && /wheat|carrots|potatoes|beetroots|scarecrow/.test(cb)) cropOk++;
      if (cb === 'vx_scarecrow') scare++;
      const [x2, z2] = at(u, v + 1 < fl.d - 1 ? v + 1 : v); if (nameOf(blockAt(x2, fl.F, z2)) !== 'farmland' && nameOf(blockAt(x2, fl.F, z2)) !== 'water') flatBad++;
    }
    for (let u = 0; u < fl.w; u++) for (let v = 0; v < fl.d; v++) {
      if (!(u === 0 || v === 0 || u === fl.w - 1 || v === fl.d - 1)) continue;
      const [x, z] = at(u, v); rimN++;
      if (/fence|gate|composter|vx_hay/.test(nameOf(blockAt(x, fl.F + 1, z)))) rimOk++;   // (the villages' farm puts a composter and a hay bale in its front row)
    }
  }
  check(cropOk >= cropN * 0.95 && flatBad <= cropN * 0.02, `the crops stand in their rows on farmland, all at the field's one level (${cropOk} of ${cropN} crop cells; ${flatBad} off the level)`);
  check(rimOk === rimN, `a fence runs round every field, a gate in it (${rimOk} of ${rimN} rim cells closed) (${secs()})`);
  check(scare >= farms.length, `a scarecrow in a field of every farm (${scare})`);
  // the windmills: the hub (the pivot) with the sails round it, its spawn
  let wOk = 0;
  for (const wm of pc('windmill')) {
    const [hx, hy, hz] = wm.hub; let sails = 0;
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) for (let dz = -4; dz <= 4; dz++) if (nameOf(blockAt(hx + dx, hy + dy, hz + dz)) === 'vx_windmill_sail') sails++;
    const sp = (chunk(hx >> 4, hz >> 4).spawns || []).some(s => s[0] === 'windmill' && s[1] === hx && s[2] === hy && s[3] === hz);
    if (/_log$/.test(nameOf(blockAt(hx, hy, hz))) && sails >= 14 && sp) wOk++;
  }
  check(wOk === pc('windmill').length && wOk >= 2, `every windmill turns its sails round a hub (the pivot, a 'windmill' spawn): ${wOk} of ${pc('windmill').length}`);
  // the pastures' herds
  let herds = 0; for (const p of pc('pasture')) if ((chunk(p.x >> 4, p.z >> 4).spawns || []).some(s => s[0] === 'fauna' && s[1] === 'sheep')) herds++;
  check(herds === pc('pasture').length, `every pasture has its herd's anchor (${herds} of ${pc('pasture').length})`);
  console.log(`  (${secs()})`);
}

console.log(`(${secs()})`);
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
