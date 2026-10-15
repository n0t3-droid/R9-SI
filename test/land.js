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
  // the overworld's sulfur springs (a pit of water in sulfur and cinnabar) stood in the ways — two on the walk out of the
  // temple (land.mjs run 1: the walk's camera stood in one): none is built within 9 blocks of a way, a piece, a field, a
  // clearing or a pond; elsewhere in the land they stay (the features' draws are the same)
  const SS = V.GEN.STRUCT, OG = V.OverworldGen.prototype, springs = [];
  const prevSpring = SS.sulfurSpring; SS.sulfurSpring = function (w, x, y, z) { springs.push([x, y, z]); };
  const dummy = { get: () => 0, set: () => {}, ok: () => true, place: () => false };
  for (let fcz = -45; fcz < 45; fcz++) for (let fcx = -45; fcx < 45; fcx++) { try { OG.features.call(g, dummy, fcx, fcz, []); } catch (e) { /* a tree that asks more of the writer: its chunk has no spring draw then */ } }
  SS.sulfurSpring = prevSpring;
  const nearKeep = (x, z) => { for (let dz = -9; dz <= 9; dz++) for (let dx = -9; dx <= 9; dx++) if (dx * dx + dz * dz <= 81 && LAND.keepAt(P, x + dx, z + dz)) return true; return false; };
  const atWay = springs.filter(([x, , z]) => nearKeep(x, z)), built = (x, y, z) => nameOf(blockAt(x, y - 3, z)) === 'magma_block' && nameOf(blockAt(x, y - 2, z)) === 'fuming_sulfur';
  const inWay = atWay.filter(([x, y, z]) => built(x, y, z)), kept = springs.filter(([x, y, z]) => !nearKeep(x, z) && built(x, y, z));
  let wet = 0, wayN = 0; for (const [x, , z] of atWay) for (let dz = -7; dz <= 7; dz++) for (let dx = -7; dx <= 7; dx++) { const c = cells.get(ck(x + dx, z + dz)); if (!c || c.deck) continue; wayN++; if (!WAY.has(nameOf(blockAt(c.x, c.y, c.z)))) wet++; }
  check(atWay.length > 0 && inWay.length === 0 && wayN > 0 && wet === 0, `no sulfur spring breaks a way: ${inWay.length} of the ${atWay.length} springs by the land's ways and pieces built (${inWay.map(s => '(' + s[0] + ', ' + s[2] + ')').join(' ')}), the ${wayN} way cells round them all paved (${wet} not)`);
  check(kept.length > 0, `the springs away from the ways stay (${kept.length} of ${springs.length - atWay.length} checked in their chunks)`);
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

// ---------------------------------------------------------------- 4 · water
if (want(4)) {
  console.log('4 · water: the river, its banks, the waterfall, ponds, the lighthouse, the pier, the beaches');
  const Rv = LAND.river(g), W = R.byName.water.id;
  const isWater = (b) => b && R.T.type[b] === W;
  const topAt = (x, z, y0) => { for (let y = y0 || 140; y > 2; y--) { const b = blockAt(x, y, z); if (b && !((R.T.flags[b] & V.F.PLANT) && !(R.T.flags[b] & V.F.SOLID))) return y; } return 0; };
  // the river: water on its line all the way, the bed never rising downstream, sand and gravel on its banks
  let wet = 0, n = 0, rises = 0, prevBed = 99, banks = 0, bankN = 0, ex = '';
  const built = (x, z) => { for (let dz = -6; dz <= 6; dz++) for (let dx = -6; dx <= 6; dx++) { const c = P.cells.get(ck(x + dx, z + dz)); if (c && c.deck) return true; } const f = P.pieces.find(p => p.kind === 'ford'); return !!f && f.stones.some(([sx, sz]) => Math.abs(sx - x) <= 2 && Math.abs(sz - z) <= 2); };
  for (let i = 10; i < Rv.pts.length - 6; i += 9) {
    const [px, pz] = Rv.pts[i], x = Math.round(px), z = Math.round(pz);
    if (built(x, z)) continue;   // (a bridge's piers and the ford's stones stand in it)
    n++;
    if (isWater(blockAt(x, SEA, z))) wet++; else if (!ex) ex = `(${x}, ${z}) ${nameOf(blockAt(x, SEA, z))}`;
    let bed = SEA; while (bed > 40 && (isWater(blockAt(x, bed, z)) || !(R.T.flags[blockAt(x, bed, z)] & V.F.SOLID))) bed--;   // (seagrass grows in the water)
    if (bed > prevBed + 1) rises++;
    prevBed = Math.min(prevBed, bed);
    // the banks: the first dry column on each side
    const a = Rv.pts[Math.max(0, i - 2)], b = Rv.pts[Math.min(Rv.pts.length - 1, i + 2)], tx = b[0] - a[0], tz = b[1] - a[1], tl = Math.hypot(tx, tz) || 1;
    for (const sd of [1, -1]) for (let o = 1; o <= 14; o++) {
      const qx = Math.round(px - tz / tl * o * sd), qz = Math.round(pz + tx / tl * o * sd), y = topAt(qx, qz, 100), t = blockAt(qx, y, qz);
      if (isWater(t)) continue;
      if (y <= SEA + 3) { bankN++; if (/sand|gravel|coarse_dirt|clay/.test(nameOf(t))) banks++; }
      break;
    }
  }
  check(wet >= n * 0.97, `the river runs unbroken from the pool under the falls to the lake (water on ${wet} of ${n} points of its line${ex ? '; dry at ' + ex : ''})`);
  check(rises === 0 && LAND.riverBed(0) > LAND.riverBed(1), `its bed never rises downstream (${rises} rises; designed ${LAND.riverBed(0).toFixed(1)} → ${LAND.riverBed(1).toFixed(1)})`);
  check(bankN > 20 && banks >= bankN * 0.6, `its banks are gravel and sand bars (${banks} of ${bankN} bank columns)`);
  // the waterfall over the head: the curtain, the spring, the cave, the mist
  const wf = P.pieces.find(p => p.kind === 'waterfall');
  if (wf) {
    let fall = 0; for (const [x, z] of wf.curtain) for (let y = SEA + 1; y <= wf.top; y++) { const b = blockAt(x, y, z); if (isWater(b)) fall++; }
    const spring = isWater(blockAt(wf.spring[0], wf.top, wf.spring[1]));
    const mist = (chunk(wf.x >> 4, wf.z >> 4).spawns || []).some(s => s[0] === 'mist');
    check(fall >= 3 * (wf.top - SEA - 4) && spring && mist && wf.cave >= 15, `a waterfall drops ${wf.top - SEA} blocks from a spring into the river's pool (${fall} cells of falling water, the spring ${spring ? 'full' : 'dry'}, mist ${mist ? 'at its foot' : 'missing'}, a cave of ${wf.cave} cells behind it)`);
  } else check(false, 'the waterfall over the river head is planned');
  const ford = P.pieces.find(p => p.kind === 'ford');
  check(!!ford && ford.stones.length >= 2 && ford.stones.every(([x, z]) => nameOf(blockAt(x, SEA, z)) === 'mossy_cobblestone'), `a ford of stepping stones below the falls (${ford ? ford.stones.length : 0} stones)`);
  // the ponds: closed bowls (no water cell beside air), lily pads, reeds, ducks
  const ponds = P.pieces.filter(p => p.kind === 'pond');
  let leaks = 0, lil = 0, reeds = 0, ducks = 0, full = 0;
  for (const pd of ponds) {
    if (isWater(blockAt(pd.x, pd.y, pd.z))) full++;
    for (let dz = -12; dz <= 12; dz++) for (let dx = -12; dx <= 12; dx++) {
      const x = pd.x + dx, z = pd.z + dz;
      if (!isWater(blockAt(x, pd.y, z))) continue;
      for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!blockAt(x + ax, pd.y, z + az)) leaks++;
      if (nameOf(blockAt(x, pd.y + 1, z)) === 'lily_pad') lil++;
    }
    for (let dz = -14; dz <= 14; dz++) for (let dx = -14; dx <= 14; dx++) for (let y = pd.y + 1; y <= pd.y + 4; y++) if (nameOf(blockAt(pd.x + dx, y, pd.z + dz)) === 'sugar_cane') { reeds++; break; }
    if ((chunk(pd.x >> 4, pd.z >> 4).spawns || []).some(s => s[0] === 'fauna' && s[1] === 'duck')) ducks++;
  }
  check(ponds.length >= 5 && full === ponds.length && leaks === 0, `${ponds.length} lily ponds, each a closed bowl (${full} full, ${leaks} cells where the water meets open air)`);
  check(lil >= ponds.length * 2 && reeds >= ponds.length * 3 && ducks === ponds.length, `the ponds carry lily pads (${lil}), reeds round them (${reeds}) and ducks (${ducks} anchors)`);
  // the lighthouse on the shore, its lamp
  const lh = P.pieces.find(p => p.kind === 'lighthouse');
  if (lh) {
    let water4 = 0; for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++) if (isWater(blockAt(lh.x + dx, SEA, lh.z + dz))) water4++;
    const foot = nameOf(blockAt(lh.x, lh.y, lh.z)), lamp = nameOf(blockAt(lh.lamp[0], lh.lamp[1], lh.lamp[2]));
    check(water4 > 0 && foot === 'stone_bricks' && lh.y > SEA && lh.top - lh.y >= 20 && lamp === 'tide_lantern', `a lighthouse on the lake's shore at (${lh.x}, ${lh.z}): water within four blocks (${water4} cells), its foot dry at ${lh.y}, ${lh.top - lh.y} high, its lamp lit (${lamp})`);
  } else check(false, 'the lighthouse is planned');
  // the fishing hut and its pier: the pier's end over water, the fish there
  const pier = P.pieces.find(p => p.kind === 'pier'), hut = P.pieces.find(p => p.kind === 'hut');
  if (pier && hut) {
    const endW = isWater(blockAt(pier.x, SEA, pier.z)) || isWater(blockAt(pier.x, SEA - 1, pier.z));
    const plank = nameOf(blockAt(pier.x, pier.y, pier.z)) === 'spruce_planks', fish = (chunk(pier.x >> 4, pier.z >> 4).spawns || []).some(s => s[0] === 'fauna' && s[1] === 'fish');
    check(endW && plank && fish, `a fishing hut at (${hut.x}, ${hut.z}) and its pier out over the water (its end ${endW ? 'over water' : 'on land'}, planks ${plank}, fish ${fish})`);
  } else check(false, 'the fishing hut and its pier are planned');
  // the beaches: the lake's shore sand
  let sand = 0, sn = 0;
  for (let a = 0; a < 6.28; a += 0.21) {
    const [x, z] = LAND.shoreAt(g, a, 1.06); if (LAND.zoneAt(g, x, z) || LAND.keepAt(P, x, z)) continue;
    const y = topAt(x, z, 100); if (y > SEA + 4 || y < SEA - 1) continue; sn++;
    if (/sand/.test(nameOf(blockAt(x, y, z)))) sand++;
  }
  check(sn >= 10 && sand >= sn * 0.8, `the lake has its beaches (sand at ${sand} of ${sn} shore points)`);
  const mists = P.pieces.filter(p => p.kind === 'islefall').length;
  check(mists >= 3, `mist where the Sky Isles' falls meet the lake (${mists} falls)`);
  console.log(`  (${secs()})`);
}

// ---------------------------------------------------------------- 5 · rocks and relief
if (want(5)) {
  console.log('5 · rocks and relief: boulders, tors, the lookout, the shrine, fairy rings, no crystal');
  // boulders over a stretch of the ridge and of the woods: rock lumps standing on the ground, moss on them
  let rock = 0, moss = 0;
  const ROCK = /^(stone|andesite|mossy_cobblestone|cobblestone|tuff)$/;
  const scan = (cx0, cz0, n) => { for (let cz = cz0; cz < cz0 + n; cz++) for (let cx = cx0; cx < cx0 + n; cx++) { const c = chunk(cx, cz); for (let col = 0; col < 256; col++) { const x = cx * 16 + (col & 15), z = cz * 16 + (col >> 4), gy = g.surfaceY(x, z); for (let y = gy + 1; y <= gy + 7; y++) { const nm = nameOf(c.blocks[(y << 8) | col]); if (ROCK.test(nm)) rock++; else if (nm === 'moss_carpet') moss++; } } } };
  scan(-40, -2, 4);    // the ridge round the lookout
  check(rock > 40 && moss > 6, `boulders and tors stand on the ridge, moss on them (${rock} rock blocks above the ground, ${moss} moss carpets in 16 chunks)`);
  // the lookout on the ridge's crest
  const lk = P.pieces.find(p => p.kind === 'lookout');
  if (lk) {
    let stairs = 0, lant = 0, rail = 0;
    for (let y = lk.y; y <= lk.top + 3; y++) for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) { const nm = nameOf(blockAt(lk.x + dx, y, lk.z + dz)); if (nm === 'stone_brick_stairs') stairs++; else if (nm === 'lantern' && y > lk.top) lant++; else if (nm === 'spruce_fence' && y === lk.top + 1) rail++; }
    const ridge = LAND.ridgeLift(g, lk.x, lk.z);
    check(lk.h >= 12 && stairs >= lk.h && lant >= 4 && rail >= 12 && ridge > 15, `a lookout tower on the ridge's crest (${lk.x}, ${lk.z}; the ridge ${ridge.toFixed(0)} over the land): ${lk.top - lk.y} high, a stair of ${stairs} steps inside, a railed platform (${rail} rails) with ${lant} lanterns`);
  } else check(false, 'the lookout tower is planned');
  // the shrine at the west crossroads
  const sh = P.pieces.find(p => p.kind === 'shrine'), cw = P.sites.find(s => s.id === 'cross_w');
  if (sh) {
    const lamp = nameOf(blockAt(sh.lamp[0], sh.lamp[1], sh.lamp[2]));
    let roof = 0; for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) for (let y = sh.y + 3; y <= sh.y + 6; y++) if (/vx_(roof|ridge)_slate/.test(nameOf(blockAt(sh.x + dx, y, sh.z + dz)))) roof++;
    check(lamp === 'lantern' && roof >= 10 && Math.hypot(sh.x - cw.x, sh.z - cw.z) < 14, `a shrine at the west crossroads (${Math.hypot(sh.x - cw.x, sh.z - cw.z).toFixed(0)} blocks from it): a lantern on its pedestal (${lamp}), a slate roof (${roof} pieces)`);
  } else check(false, 'the shrine is planned');
  // fairy rings: mushrooms on a circle round each ring's centre
  const rings = LAND.rings(g, P, -400, -400, 400, 400);
  let full = 0, tried = 0;
  for (const [x, z, r] of rings.slice(0, 8)) {
    tried++; let m = 0;
    for (let dz = -5; dz <= 5; dz++) for (let dx = -5; dx <= 5; dx++) { const d = Math.hypot(dx, dz); if (Math.abs(d - r) > 0.5) continue; const gy = g.surfaceY(x + dx, z + dz); for (let y = gy - 2; y <= gy + 3; y++) if (/mushroom$/.test(nameOf(blockAt(x + dx, y, z + dz)))) { m++; break; } }
    if (m >= 8) full++;
  }
  check(rings.length >= 10 && full >= tried * 0.6, `fairy rings of mushrooms (${rings.length} rings in the middle 800 × 800; ${full} of ${tried} checked carry 8 or more mushrooms on their circle)`);
  // no crystal anywhere in the land's chunks generated by this test
  let cry = 0, scanned = 0;
  const CRY = /crystal|amethyst|_bud$|geode/;
  const bad = new Uint8Array(R.T.type.length); for (let s0 = 1; s0 < bad.length; s0++) { const t = R.types[R.T.type[s0]]; if (t && CRY.test(t.name) && !/^tide_|crystal_shard/.test(t.name)) bad[s0] = 1; }
  for (const c of CH.values()) { scanned++; for (let i = 0; i < 65536; i++) if (bad[c.blocks[i]]) cry++; }
  check(cry === 0 && scanned >= 30, `no crystal in any of the ${scanned} chunks of the land this test made (${cry} crystal blocks)`);
  console.log(`  (${secs()})`);
}

// ---------------------------------------------------------------- 6 · animals at their places
if (want(6)) {
  console.log('6 · animals: deer at the woods\' edges at dawn and dusk, herds in the pastures, ducks on the ponds, fish at the pier');
  const FP = LAND.faunaPlan;
  // the pure choice: kind × hour × preset
  const at = (k, t, pr, n) => FP(k, t, pr || 'high', n || 4);
  check(at('deer', 600).mob === 'glimmer_deer' && at('deer', 12000).mob === 'glimmer_deer' && !at('deer', 6000).mob && !at('deer', 18000).mob && at('deer', 600).n >= 2,
    `deer come at dawn and dusk only (dawn ${at('deer', 600).n}, noon ${at('deer', 6000).n}, dusk ${at('deer', 12000).n}, midnight ${at('deer', 18000).n})`);
  check(at('sheep', 6000, 'high', 6).mob === 'bloom_sheep' && at('sheep', 6000, 'high', 6).n === 6 && at('sheep', 18000, 'high', 6).rest === true && at('sheep', 6000, 'potato', 6).n <= 2,
    `the herd keeps to its pasture by day (6), rests at night, Very Low keeps two (${at('sheep', 6000, 'potato', 6).n})`);
  check(at('duck', 6000).mob === 'pond_duck' && !at('duck', 18000).mob && !at('duck', 6000, 'potato').mob, 'ducks swim by day, not at night and not on Very Low');
  check(at('fish', 6000).jumps > 0 && at('fish', 6000, 'potato').jumps === 0 && at('fish', 18000).jumps === 0, 'fish jump by day (a particle), not at night and not on Very Low');
  // the deer's anchors stand at the woods' edges: every 48-block cell of the middle of the land asked, a dozen of the
  // anchors found in their chunks' spawns
  let deer = [], cells = 0;
  for (let gz = -12; gz <= 12; gz++) for (let gx = -12; gx <= 12; gx++) { cells++; const a = LAND.deerAt(g, P, gx, gz); if (a) deer.push(a); }
  let edgeOk = 0, inChunk = 0;
  for (const a of deer) { const q = LAND.woodAt(g, a[0], a[2]).d; if (q >= 0.08 && q <= 0.5 && a[1] > SEA + 2) edgeOk++; }
  for (const a of deer.slice(0, 12)) if ((chunk(a[0] >> 4, a[2] >> 4).spawns || []).some(s0 => s0[0] === 'fauna' && s0[1] === 'deer' && s0[2] === a[0] && s0[4] === a[2])) inChunk++;
  check(deer.length >= 60 && edgeOk === deer.length && inChunk === Math.min(12, deer.length), `deer anchors at the woods' edges (${deer.length} in ${cells} cells of 48 blocks, ${edgeOk} between the open and the wood, ${inChunk} of 12 in their chunks' spawns)`);
  deer = deer.map(a => ['fauna', 'deer', a[0], a[1], a[2], a[3], 10]);
  // the game's side (landlife.js) on a stub world: the anchors of the generated chunks, the groups it keeps
  require('../src/main/landlife.js');
  const LLc = V.LandLife;
  const mkGame = (pos, t, preset) => ({ player: { pos }, env: { timeOfDay: t, E: { night: t > 13000 && t < 23000 ? 1 : 0 } }, settings: { preset }, particles: { n: 0, spawn() { this.n++; }, glow() { this.n++; } },
    world: { isLoaded: () => true, topAt: (x, z) => { for (let y = 160; y > 2; y--) { const b = blockAt(x, y, z); if (b && !((R.T.flags[b] & V.F.PLANT) && !(R.T.flags[b] & V.F.SOLID)) && !(R.T.flags[b] & V.F.LEAVES)) return y; } return 0; }, getBlock: (x, y, z) => blockAt(x, y, z) } });
  const mkEnts = () => ({ mobs: [], summon(kind, x, y, z) { const m = { kind, pos: [x, y, z], dead: false }; this.mobs.push(m); return m; } });
  const pasture = P.pieces.find(p => p.kind === 'pasture'), pond = P.pieces.find(p => p.kind === 'pond'), pier = P.pieces.find(p => p.kind === 'pier');
  const sp = (x, z) => chunk(x >> 4, z >> 4).spawns || [];
  // the herd at noon, the player 30 blocks off
  {
    const game = mkGame([pasture.x + 30, 90, pasture.z], 6000, 'high'), E = mkEnts(), L = new LLc(game, E);
    L.absorb(sp(pasture.x, pasture.z)); L.herds('high');
    const box = pasture.rect, inBox = E.mobs.filter(m => m.pos[0] >= box[0] && m.pos[0] <= box[2] + 1 && m.pos[2] >= box[1] && m.pos[2] <= box[3] + 1);
    check(E.mobs.length >= 4 && E.mobs.every(m => m.kind === 'bloom_sheep') && inBox.length === E.mobs.length, `a herd appears in its pasture (${E.mobs.length} sheep, ${inBox.length} inside its fence)`);
    const game2 = mkGame([pasture.x + 30, 90, pasture.z], 6000, 'potato'), E2 = mkEnts(), L2 = new LLc(game2, E2); L2.absorb(sp(pasture.x, pasture.z)); L2.herds('potato');
    check(E2.mobs.length <= 2 && E2.mobs.length >= 1, `Very Low keeps a smaller herd (${E2.mobs.length})`);
  }
  // ducks on the pond at its water, by day
  {
    const game = mkGame([pond.x + 25, 90, pond.z], 6000, 'high'), E = mkEnts(), L = new LLc(game, E);
    L.absorb(sp(pond.x, pond.z)); L.herds('high');
    const onWater = E.mobs.filter(m => m.kind === 'pond_duck' && Math.abs(m.pos[1] - (pond.y + 1 - 0.12)) < 0.01 && Math.hypot(m.pos[0] - pond.x - 0.5, m.pos[2] - pond.z - 0.5) <= pond.r);
    check(E.mobs.length >= 2 && onWater.length === E.mobs.length, `ducks swim on the pond (${onWater.length} of ${E.mobs.length} on its water inside its shore)`);
  }
  // deer at dawn, gone at noon when the player is away
  {
    const d0 = deer[0], game = mkGame([d0[2] + 30, 90, d0[4]], 600, 'high'), E = mkEnts(), L = new LLc(game, E);
    L.absorb(sp(d0[2], d0[4])); L.herds('high');
    const n0 = E.mobs.filter(m => m.kind === 'glimmer_deer').length;
    for (const m of E.mobs) m.anchor = 'deer:' + d0[2] + ',' + d0[4];
    game.env.timeOfDay = 6000; L.herds('high');
    check(n0 >= 2 && E.mobs.filter(m => m.kind === 'glimmer_deer').length === 0, `deer appear at the wood's edge at dawn (${n0}) and are gone by noon`);
  }
  // fish at the pier: jumps by day on High, none on Very Low
  {
    const game = mkGame([pier.x + 12, 70, pier.z], 6000, 'high'), E = mkEnts(), L = new LLc(game, E);
    L.absorb(sp(pier.x, pier.z));
    for (let i = 0; i < 300; i++) L.effects(0.05, 'high');
    const game2 = mkGame([pier.x + 12, 70, pier.z], 6000, 'potato'), L2 = new LLc(game2, mkEnts()); L2.absorb(sp(pier.x, pier.z)); for (let i = 0; i < 300; i++) L2.update(0.05);
    check(game.particles.n > 0 && game2.particles.n === 0, `fish leap at the pier (${game.particles.n} particles in 15 s on High, ${game2.particles.n} on Very Low)`);
  }
  console.log(`  (${secs()})`);
}

// ---------------------------------------------------------------- 7 · the woods from afar
if (want(7)) {
  console.log('7 · the horizon shows the woods as canopies; its cost at the hills view');
  // a horizon tile over the north-western woods: canopy cells (leaves, kind 5) in the land's tile, none in vgen 9's
  const g9 = V.makeGen('overworld', SEED, { vgen: 9 });
  const leafCells = (gg, L, tx, tz) => { const t = V.LOD.build(gg, { level: L, tx, tz }); if (!t || t.empty) return 0; const u8 = new Uint8Array(t.verts); let n = 0; for (let i = 6; i < u8.length; i += 12) if ((u8[i] >> 3) === 5) n++; return n; };
  // the tile whose middle lies deepest in a wood (searched over the north-west)
  let best = null;
  for (let tz = -6; tz <= -2; tz++) for (let tx = -5; tx <= -2; tx++) { const T = 32 * 8, x = tx * T + T / 2, z = tz * T + T / 2; if (x * x + z * z > 640 * 640) continue; const d = LAND.woodAt(g, x, z).d; if (!best || d > best.d) best = { tx, tz, d }; }
  const n10 = leafCells(g, 1, best.tx, best.tz), n9 = leafCells(g9, 1, best.tx, best.tz);
  check(n10 > 50 && n9 === 0, `a horizon tile over the woods (level 1, ${best.tx}, ${best.tz}) draws them as canopies (${n10} leaf vertices; vgen 9: ${n9})`);
  // the cost: the horizon's triangles round the hills view (Very Low's horizon: its finest tiles from 64 blocks out)
  const cam = [0, -292];
  const tris = (gg) => { let t3 = 0; for (const [L, r0, r1] of [[0, 64, 320], [1, 320, 640], [2, 640, 1280]]) { const T = 32 * (4 << L); for (let tz = Math.floor((cam[1] - r1) / T); tz <= Math.floor((cam[1] + r1) / T); tz++) for (let tx = Math.floor((cam[0] - r1) / T); tx <= Math.floor((cam[0] + r1) / T); tx++) { const d = Math.hypot(tx * T + T / 2 - cam[0], tz * T + T / 2 - cam[1]); if (d < r0 || d > r1) continue; const t = V.LOD.build(gg, { level: L, tx, tz }); if (t && !t.empty) t3 += t.count / 3; } } return t3; };
  const a = tris(g9), b = tris(g);
  check(b <= a * 1.08, `the horizon round the hills view: ${Math.round(b)} triangles against vgen 9's ${Math.round(a)} (×${(b / a).toFixed(3)}, at most ×1.08)`);
  console.log(`  (${secs()})`);
}

console.log(`(${secs()})`);
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
