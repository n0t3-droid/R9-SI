// Palm City Nova Haven at vgen 8 (plan docs/superpowers/plans/2026-10-08-t-city2.md) — the city of the trailer as blocks:
//   1. old worlds keep their city: the vgen 6/7 home-city plans, the vgen 7 chunks of the city and the hills and the
//      classic Villa Nova are byte for byte what v042 made; new worlds are vgen 8
//   2. the Villa Nova family (gen_nova.js): five compositions, each also mirrored — every block name exists, the same
//      build twice is the same, each fits its lot, has its door on the street side with a paved path to it from the
//      street, every box bay has its window, a roof garden with the big round tree, every slab edge carries its light
//      strip (the cyan line with the orange underglow), the compositions differ, the mirror is the mirror image
//   3. the city (gen_city.js, VG.novaHaven): villa lots along curved roads — no straight run of road longer than 24
//      blocks, both kerbs one continuous light line, the light line continuous from the road to every door, an amber
//      accent at every path mouth, four or more compositions and both mirrors on the lots, palms along the roads every
//      6–9 blocks, lamps with cyan heads, lawns, hedges, topiary and flower beds between the lots, a bed and a door in
//      every home, the same plan twice
//   4. the terraces (gen_hills.js, vgen 8): risers 4–5 blocks high, grass on the treads, a light line along every
//      terrace edge, a Villa Nova variant on every second terrace, a stair from each terrace to the next
//   5. Very Low: the city's chunk triangles per column at F1 (the faces the Very Low preset draws: terrain, cutout,
//      water, the mini-voxel far boxes and the near pieces within 12 blocks) within 10 % of the v042 town there
//   bash test/wt_run.sh trailer_city.js 300        (SKIP_COST=1 skips 5; SLICES=1 prints a variant as ASCII slices)
const V = require('./load_shared.js');
const fs = require('fs');
const R = V.R, VG = V.VillageGen, PLAN = VG.plan2, VM = V.VM;
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const nameOf = (s) => (s ? R.types[R.T.type[s]].name : '');
const propOf = (s, k) => { const t = s && R.types[R.T.type[s]]; return t && t.has(k) ? t.get(s, k) : undefined; };
const fnv = (h, a) => { for (let i = 0; i < a.length; i++) { h ^= a[i] & 0xffff; h = Math.imul(h, 16777619) >>> 0; h ^= (a[i] >>> 16) & 0xffff; h = Math.imul(h, 16777619) >>> 0; } return h; };
const planHash = (p) => { let h = 2166136261 >>> 0; for (const k of [...p.chunks.keys()].sort()) { const b = p.chunks.get(k); h = fnv(h, b.f); h = fnv(h, b.o); } return h.toString(16); };
const homeSite = (g) => VG.sitesFor(g, 0, -9).find(x => x.home);

// ---------------------------------------------------------------- 1 · old worlds
console.log('1 · old worlds keep their city');
{
  const REF = { '4242/7': '9dad7cc5', '12345/7': 'fd368b7d', '4242/6': '8d5d26cc' };
  for (const key of Object.keys(REF)) {
    const [seed, vgen] = key.split('/').map(Number);
    const g = V.makeGen('overworld', seed, { vgen });
    const p = VG.plan(g, homeSite(g));
    const h = planHash(p);
    check(h === REF[key] && !p.nova, `the home city of seed ${seed} at vgen ${vgen} is planned as before (${p.homes.length} homes, hash ${h}${h === REF[key] ? '' : ', expected ' + REF[key]})`);
  }
  const g7 = V.makeGen('overworld', 4242, { vgen: 7 });
  let h = 2166136261 >>> 0;
  for (const [cx, cz] of [[0, -4], [0, -9], [2, -12], [-3, -15], [1, -18], [4, -20], [-6, -22]]) { const c = g7.generate(cx, cz); for (let i = 0; i < c.blocks.length; i++) { h ^= c.blocks[i]; h = Math.imul(h, 16777619) >>> 0; } }
  check(h.toString(16) === '18f3572d', `the vgen 7 chunks of the city and the hills are the same (hash ${h.toString(16)})`);
  // the classic Villa Nova (the catalogue house, the blueprints) is built exactly as before — but for its palm crowns,
  // which since t-city2 stand centred on their trunks (they hung two blocks to the side: v042 5da900be 704c55e1 366c83e a240c182)
  const REFV = { '0/7': '6f0b84f2', '1/11': 'd36b3891', '2/3': '8d884b7d', '3/99': 'eea4f1da' };
  let same = 0;
  for (const key of Object.keys(REFV)) {
    const [r, sd] = key.split('/').map(Number), ops = [];
    const L = VG.makeLot((x, y, z, s) => ops.push(x, y, z, s), 5, 7, r);
    const info = PLAN.build(L, { w: 25, d: 31, F: 64, r, ox: 5, oz: 7, kind: 'home' }, { index: PLAN.TRAILER, rng: new V.RNG(sd), ground: (u, v) => 63 + ((u * 3 + v) % 3 === 0 ? -1 : 0), beds: 3 });
    let hv = fnv(2166136261 >>> 0, ops);
    const js = JSON.stringify([info.door, info.outside, info.inside, info.beds, info.seats, info.lights, info.roofTop, info.table]);
    for (let i = 0; i < js.length; i++) { hv ^= js.charCodeAt(i); hv = Math.imul(hv, 16777619) >>> 0; }
    if (hv.toString(16) === REFV[key]) same++; else console.log('    classic r ' + r + ': ' + hv.toString(16) + ' (expected ' + REFV[key] + ')');
  }
  check(same === 4, `the classic Villa Nova builds as before (its palm crowns centred) in all four rotations (${same} of 4)`);
  const src = fs.readFileSync(__dirname + '/../src/main/game.js', 'utf8');
  check(/vgen: o\.vgen \? \+o\.vgen : 8\b/.test(src), 'new worlds are made with vgen 8 (game.js createWorld)');
}

// ---------------------------------------------------------------- 2 · the family
console.log('2 · the Villa Nova family');
const FAM = PLAN.NOVA_FAMILY || {};
const COMPS = Object.keys(FAM);
check(COMPS.length >= 5 && ['classic', 'long', 'tower', 'corner', 'bungalow'].every(k => COMPS.includes(k)), `five compositions or more: ${COMPS.join(', ') || 'none'}`);
const LW = 25, LD = 31, F = 64;
function buildVariant(comp, mirror, seed) {
  const rec = new Map(), names = new Set(), unknown = new Set();
  const L = VG.makeLot((x, y, z, s) => rec.set(x + ',' + y + ',' + z, s), 0, 0, 0);
  const P0 = L.P;
  L.P = (u, y, v, name, pr) => { if (typeof name === 'string') { names.add(name); if (!R.byName[name]) unknown.add(name); } return P0(u, y, v, name, pr); };
  const info = PLAN.build(L, { w: LW, d: LD, F, r: 0, ox: 0, oz: 0, kind: 'home' }, { index: PLAN.TRAILER, comp, novaMirror: mirror, rng: new V.RNG(seed || 7), ground: () => F - 1, beds: 3, noCustom: true });
  return { rec, names, unknown, info };
}
const famBuilds = {};
for (const comp of COMPS) for (const mirror of [false, true]) {
  const tag = comp + (mirror ? '·m' : '');
  let A, B;
  try { A = buildVariant(comp, mirror, 7); B = buildVariant(comp, mirror, 7); } catch (e) { check(false, `${tag}: builds (${String(e && e.stack || e).split('\n').slice(0, 3).join(' | ')})`); continue; }
  famBuilds[tag] = A;
  const at = (u, y, v) => A.rec.get(u + ',' + (F + y) + ',' + v) || 0, nm = (u, y, v) => nameOf(at(u, y, v));
  const info = A.info || {};
  const errs = [];
  // every block name exists; the same build twice
  if (A.unknown.size) errs.push('unknown blocks ' + [...A.unknown].join(','));
  { let same = A.rec.size === B.rec.size; if (same) for (const [k, s] of A.rec) if (B.rec.get(k) !== s) { same = false; break; } if (!same) errs.push('not deterministic'); }
  // fits its lot: every cell inside [0, W) × [0, D), nothing below the footing or above +40
  let out = 0; for (const k of A.rec.keys()) { const [u, y, v] = k.split(',').map(Number); if (u < 0 || u >= LW || v < 0 || v >= LD || y > F + 40) out++; }
  if (out) errs.push(out + ' cells outside the lot');
  // the door on the street side: a door block at info.door, facing the street, in the front half of the house; the
  // paved path from the street (v 0) to the cell in front of it
  const dr = info.door, hs = info.house;
  if (!dr || !/door/.test(nm(dr[0], dr[1] - F, dr[2])) || propOf(at(dr[0], dr[1] - F, dr[2]), 'facing') !== 0) errs.push('no street door at ' + JSON.stringify(dr));
  else if (!hs || dr[2] > (hs[1] + hs[3]) / 2) errs.push('the door is not on the street side');
  const PAVE = /^(vx_floor_plaza|vx_floor_plaza_line|vx_floor_plaza_line_amber|concrete_smooth|vollton_mid_grey_stairs)$/;
  if (dr) {
    const goal = dr[0] + ',' + (dr[2] - 1), seen = new Set(), q = [];
    for (let u = 0; u < LW; u++) if (PAVE.test(nm(u, -1, 0))) { seen.add(u + ',0'); q.push([u, 0]); }
    while (q.length) { const [u, v] = q.shift(); for (const [du, dv] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = u + du, b = v + dv, k = a + ',' + b; if (seen.has(k) || a < 0 || b < 0 || a >= LW || b >= LD) continue; if (!PAVE.test(nm(a, -1, b)) && !PAVE.test(nm(a, 0, b))) continue; seen.add(k); q.push([a, b]); } }
    if (!seen.has(goal)) errs.push('no paved path from the street to the door');
    // the path's start on the street side, as the city reads it
    const ps = info.pathStart; if (!ps || !(ps[1] >= ps[0]) || !PAVE.test(nm(ps[0], -1, 0)) || !PAVE.test(nm(ps[1], -1, 0))) errs.push('pathStart ' + JSON.stringify(ps) + ' is not paved at the street');
  }
  // every box bay has its window: info.bays [{side, a0, a1, out, y0, y1}] — the face of the box holds nova windows
  const bays = info.bays || [];
  let bayOk = 0;
  for (const b of bays) { let w = 0; for (let a = b.a0; a <= b.a1; a++) for (let y = b.y0; y <= b.y1; y++) { const u = (b.side & 1) ? b.out : a, v = (b.side & 1) ? a : b.out; if (nm(u, y, v) === 'vx_nova_window') w++; } if (w >= 2) bayOk++; }
  if (!bays.length || bayOk !== bays.length) errs.push(`box bays with their window ${bayOk} of ${bays.length}`);
  // the roof garden: the big round tree standing on grass on a roof (above the ground floor's slab)
  let tree = 0; for (const [k, s] of A.rec) { if (nameOf(s) !== 'vm_tree_round_l' || propOf(s, 'part') !== 0) continue; const [x, y, z] = k.split(',').map(Number); if (y - F >= 8 && nameOf(A.rec.get(x + ',' + (y - 1) + ',' + z) || 0) === 'grass_block') tree++; }
  if (tree < 1) errs.push('no roof garden with the big round tree');
  // every slab edge carries its light strip: info.slabs [{y, cells: [[u, v]…]}] — the lower row a nova band lit 1 or 3
  let edge = 0, lit = 0;
  for (const sl of info.slabs || []) for (const [u, v] of sl.cells) { edge++; const s = at(u, sl.y, v); const gl = propOf(s, 'glow'); if (nameOf(s) === 'vx_nova_band' && (gl === 1 || gl === 3)) lit++; }
  if (!edge || lit !== edge) errs.push(`slab edges lit ${lit} of ${edge}`);
  // a bed, seats
  if (!(info.beds && info.beds.length >= 1) || !(info.seats && info.seats.length >= 2)) errs.push('beds ' + (info.beds || []).length + ' seats ' + (info.seats || []).length);
  check(errs.length === 0, `${tag}: ${A.rec.size} cells, ${bays.length} box bays, ${(info.slabs || []).length} slabs (${edge} edge cells), door ${JSON.stringify(dr)}, path ${JSON.stringify(info.pathStart)}${errs.length ? ' — ' + errs.join('; ') : ''}`);
}
// the compositions differ, and the mirror is the mirror image (the same block at (W − 1 − u, y, v) up to the facing)
{
  const sig = (b) => { const m = new Map(); for (const [k, s] of b.rec) { if (!s) continue; const [u, y, v] = k.split(',').map(Number); if (y - F < 1) continue; m.set(u + ',' + y + ',' + v, nameOf(s)); } return m; };
  const plain = COMPS.filter(c => famBuilds[c]);
  let pairs = 0, differ = 0;
  for (let i = 0; i < plain.length; i++) for (let j = i + 1; j < plain.length; j++) { pairs++; const a = sig(famBuilds[plain[i]]), b = sig(famBuilds[plain[j]]); let d = 0; for (const [k, n] of a) if (b.get(k) !== n) d++; for (const k of b.keys()) if (!a.has(k)) d++; if (d > 300) differ++; }
  check(pairs >= 10 && differ === pairs, `the compositions differ from each other (${differ} of ${pairs} pairs by more than 300 cells)`);
  let mirrors = 0, mm = [];
  for (const c of plain) {
    const a = famBuilds[c], b = famBuilds[c + '·m']; if (!b) continue;
    let same = 0, n = 0;
    for (const [k, s] of a.rec) { if (!s) continue; const [u, y, v] = k.split(',').map(Number); if (y - F < 0) continue; n++; const t = b.rec.get((LW - 1 - u) + ',' + y + ',' + v); if (t && nameOf(t) === nameOf(s)) same++; }
    if (n && same / n >= 0.93) mirrors++; else mm.push(c + ' ' + (n ? (same / n * 100).toFixed(0) : 0) + ' %');
  }
  check(mirrors === plain.length && plain.length >= 5, `every mirrored composition is the mirror image of its composition (${mirrors} of ${plain.length}${mm.length ? ': ' + mm.join(', ') : ''})`);
}
if (process.env.SLICES) {
  const b = famBuilds[process.env.SLICES]; if (b) for (let y = -1; y <= 22; y++) { console.log('y ' + y); for (let v = 0; v < LD; v++) { let row = ''; for (let u = 0; u < LW; u++) { const n = nameOf(b.rec.get(u + ',' + (F + y) + ',' + v) || 0); row += !n ? '.' : n === 'vx_nova_window' ? 'W' : n === 'vx_nova_band' ? '=' : /stone_grey|mid_grey/.test(n) ? '#' : n === 'vollton_light_grey' ? 'b' : /grass/.test(n) ? ',' : /plaza_line/.test(n) ? '~' : /plaza/.test(n) ? '_' : /hedge/.test(n) ? 'h' : /door/.test(n) ? 'D' : /balustrade/.test(n) ? 'i' : /tree_round_l/.test(n) ? 'T' : /white/.test(n) ? 'w' : '+'; } console.log(row); } }
}

// ---------------------------------------------------------------- 3 · the city
console.log('3 · Nova Haven at vgen 8');
const g8 = V.makeGen('overworld', 4242, { vgen: 8 });
const site8 = homeSite(g8);
let plan8 = null;
try { const t0 = performance.now(); plan8 = VG.plan(g8, site8); console.log(`    planned in ${(performance.now() - t0).toFixed(0)} ms`); } catch (e) { check(false, 'the city plans (' + String(e && e.stack || e).split('\n').slice(0, 4).join(' | ') + ')'); }
const city = plan8 && plan8.nova;
check(!!city, `the vgen-8 home city is the designed Nova Haven (plan.nova: ${city ? Object.keys(city).join(', ') : 'none'})`);
// the blocks of the city as the chunks will see them (the plan's fills, then its ops)
const cityAt = new Map();
if (plan8) for (const [, b] of plan8.chunks) {
  for (let i = 0; i < b.f.length; i += 5) for (let y = b.f[i + 2]; y <= b.f[i + 3]; y++) cityAt.set(b.f[i] + ',' + y + ',' + b.f[i + 1], b.f[i + 4]);
  for (let i = 0; i < b.o.length; i += 4) cityAt.set(b.o[i] + ',' + b.o[i + 1] + ',' + b.o[i + 2], b.o[i + 3]);
}
const cnm = (x, y, z) => nameOf(cityAt.get(x + ',' + y + ',' + z) || 0);
if (city) {
  // the roads: centre lines sampled every block; within every 25 samples the heading turns by 4° or more
  const roads = city.roads || [];
  let worst = 999, worstAt = null, total = 0;
  for (const rd of roads) {
    const pts = rd.pts; total += pts.length;
    const hd = []; for (let i = 1; i < pts.length; i++) hd.push(Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]));
    for (let i = 1; i < hd.length; i++) { while (hd[i] - hd[i - 1] > Math.PI) hd[i] -= 2 * Math.PI; while (hd[i] - hd[i - 1] < -Math.PI) hd[i] += 2 * Math.PI; }
    for (let i = 0; i + 24 < hd.length; i++) { let lo = 1e9, hi = -1e9; for (let k = i; k <= i + 24; k++) { lo = Math.min(lo, hd[k]); hi = Math.max(hi, hd[k]); } const t = (hi - lo) * 180 / Math.PI; if (t < worst) { worst = t; worstAt = rd.name + '@' + i; } }
  }
  check(roads.length >= 2 && total >= 250 && worst >= 4, `the roads curve: ${roads.length} roads, ${total} blocks of centre line, no straight run longer than 24 blocks (the least turn in any 24 blocks ${worst.toFixed(1)}° at ${worstAt})`);
  // the light lines: cells of vx_floor_plaza_line (cyan) and _amber at road level
  const LINE = new Map(); // "x,z" → y
  for (const [k, s] of cityAt) { const n = nameOf(s); if (n === 'vx_floor_plaza_line' || n === 'vx_floor_plaza_line_amber') { const [x, y, z] = k.split(',').map(Number); LINE.set(x + ',' + z, y); } }
  const comp = (start) => { const seen = new Set([start]), q = [start]; while (q.length) { const k = q.pop(); const [x, z] = k.split(',').map(Number); for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = (x + dx) + ',' + (z + dz); if (LINE.has(n) && !seen.has(n)) { seen.add(n); q.push(n); } } } return seen; };
  // both kerbs of every road: the kerb cells the planner records lie on one connected line each
  let kerbs = 0, kerbOk = 0, kerbBad = [];
  for (const rd of roads) for (const side of ['L', 'R']) {
    const cells = (rd.kerb && rd.kerb[side]) || []; if (!cells.length) continue; kerbs++;
    const miss = cells.filter(c => !LINE.has(c[0] + ',' + c[1])).length;
    const reach = comp(cells[0][0] + ',' + cells[0][1]);
    const apart = cells.filter(c => !reach.has(c[0] + ',' + c[1])).length;
    if (!miss && !apart) kerbOk++; else kerbBad.push(`${rd.name}.${side}: ${miss} not lit, ${apart} apart`);
  }
  check(kerbs >= 4 && kerbOk === kerbs, `both kerbs of every road are one continuous light line (${kerbOk} of ${kerbs}${kerbBad.length ? ': ' + kerbBad.slice(0, 4).join('; ') : ''})`);
  // from the road to every door: the kerb's line component reaches the line cells beside the door's apron
  const lots = city.lots || [];
  let doorOk = 0, doorBad = [];
  const kerbComp = new Set(); for (const rd of roads) for (const side of ['L', 'R']) for (const c of ((rd.kerb && rd.kerb[side]) || []).slice(0, 1)) for (const k of comp(c[0] + ',' + c[1])) kerbComp.add(k);
  for (const lot of lots) {
    const ap = lot.apron || []; // the line cells of the lot's path at the door
    if (ap.length && ap.every(c => LINE.has(c[0] + ',' + c[1])) && ap.some(c => kerbComp.has(c[0] + ',' + c[1]))) doorOk++; else doorBad.push(lot.comp + '@' + lot.ox + ',' + lot.oz);
  }
  check(lots.length >= 10 && doorOk === lots.length, `the light line runs unbroken from the road to every door (${doorOk} of ${lots.length} lots${doorBad.length ? '; not: ' + doorBad.slice(0, 5).join(' ') : ''})`);
  const amber = lots.filter(l => (l.mouth || []).some(c => cnm(c[0], LINE.get(c[0] + ',' + c[1]), c[1]) === 'vx_floor_plaza_line_amber')).length;
  check(amber === lots.length, `an amber accent across every path mouth (${amber} of ${lots.length})`);
  const comps = new Set(lots.map(l => l.comp)), mir = new Set(lots.map(l => !!l.mirror));
  check(comps.size >= 4 && mir.size === 2, `the lots vary: ${comps.size} compositions (${[...comps].join(', ')}), mirrored and not`);
  // palms along the roads: per road side, consecutive palms 6–9 blocks apart along the road (a path mouth or a
  // junction may push one up to 3 blocks on)
  let gaps = 0, badGap = [];
  for (const rd of roads) for (const side of ['L', 'R']) { const ps = ((rd.palms && rd.palms[side]) || []).map(p => p[2]).sort((a, b) => a - b); for (let i = 1; i < ps.length; i++) { gaps++; const d = ps[i] - ps[i - 1]; if (d < 5 || d > 12) badGap.push(`${rd.name}.${side} ${d}`); } }
  const palmN = (plan8.palms || []).length;
  check(gaps >= 20 && badGap.length === 0, `palms along the roads every 6–9 blocks (${gaps} gaps${badGap.length ? '; off: ' + badGap.slice(0, 6).join(', ') : ''}), ${palmN} palms in the city`);
  // the trunks really stand: a palm trunk under every road palm's crown
  let trunks = 0, palmsRoad = 0; for (const rd of roads) for (const side of ['L', 'R']) for (const p of ((rd.palms && rd.palms[side]) || [])) { palmsRoad++; if (cnm(p[0], p[3], p[1]) === 'vx_palm_trunk') trunks++; }
  check(palmsRoad > 0 && trunks === palmsRoad, `every road palm has its trunk (${trunks} of ${palmsRoad})`);
  const lampN = (plan8.lamps || []).filter(l => /lamppost_tech/.test(cnm(l[0], l[1], l[2]))).length;
  check(lampN >= total / 16, `tech lamps with cyan heads along the roads (${lampN} for ${total} blocks of road)`);
  // between the lots: lawns, hedges, topiary balls, flower beds
  const cnt = {}; for (const s of cityAt.values()) { const n = nameOf(s); cnt[n] = (cnt[n] || 0) + 1; }
  const parts0 = (n) => { let c = 0; for (const s of cityAt.values()) if (nameOf(s) === n && propOf(s, 'part') === 0) c++; return c; };
  check((cnt.grass_block || 0) > 4000 && (cnt.vx_hedge || 0) > 200 && (cnt.vx_bush_light || 0) + parts0('vm_bush_blossom') > 30 && parts0('vm_flower_cluster') > 150, `lawns ${cnt.grass_block | 0}, hedges ${cnt.vx_hedge | 0}, topiary balls ${(cnt.vx_bush_light | 0) + parts0('vm_bush_blossom')}, flower clusters ${parts0('vm_flower_cluster')}`);
  // the homes: a door and a bed each; the plan the same twice
  const homesOk = plan8.homes.filter(h => h.door && h.beds && h.beds.length && /door/.test(cnm(h.door[0], h.door[1], h.door[2]))).length;
  check(plan8.homes.length === lots.length && homesOk === plan8.homes.length, `every villa is a home with its door and a bed (${homesOk} of ${plan8.homes.length})`);
  const again = VG.plan(V.makeGen('overworld', 4242, { vgen: 8 }), homeSite(V.makeGen('overworld', 4242, { vgen: 8 })));
  check(planHash(again) === planHash(plan8), 'the same plan twice');
  check(plan8.plaza && plan8.base && plan8.work.some(w => w.kind === 'base'), 'the plaza and the temple base are in the plan (the villagers gather, the operators work)');
}

// ---------------------------------------------------------------- 4 · the terraces
console.log('4 · the terraces behind the city');
const HILLS = V.HillsGen;
const T8 = HILLS && HILLS.terraces ? HILLS.terraces(g8) : null;
check(!!T8, 'the vgen-8 hills carry terraces (HillsGen.terraces)');
if (T8) {
  const levels = T8.levels || [];
  const steps = []; for (let i = 1; i < levels.length; i++) steps.push(levels[i] - levels[i - 1]);
  check(levels.length >= 5 && steps.every(d => d >= 4 && d <= 5), `terrace levels ${levels.join(', ')} — risers ${steps.join(', ')} blocks`);
  // the blocks of a few terrace chunks as generated
  const got = new Map();
  const blockAt = (x, y, z) => { const ck = (x >> 4) + ',' + (z >> 4); let c = got.get(ck); if (!c) { c = g8.generate(x >> 4, z >> 4); got.set(ck, c); } return c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)]; };
  const topAt = (x, z) => { for (let y = 160; y > 60; y--) { const s = blockAt(x, y, z); if (s && (R.T.flags[s] & V.F.OPAQUE)) return y; } return -1; };
  let treads = 0, grass = 0, edges = 0, lit = 0;
  for (const e of (T8.samples || []).slice(0, 120)) {
    const [x, z, lvl, isEdge] = e; const y = topAt(x, z); if (y < 0) continue;
    if (isEdge) { edges++; if (/plaza_line/.test(nameOf(blockAt(x, y, z)))) lit++; }
    else { treads++; if (/grass_block|vm_crop_rows/.test(nameOf(blockAt(x, y, z))) || nameOf(blockAt(x, y + 1, z)) === 'vm_crop_rows') grass++; }
    void lvl;
  }
  check(treads >= 40 && grass >= treads * 0.85, `grass on the treads (${grass} of ${treads} sampled tread cells)`);
  check(edges >= 40 && lit === edges, `a light line along every terrace edge (${lit} of ${edges} sampled edge cells)`);
  const vl = T8.villas || [];
  const lvSet = new Set(vl.map(v => v.level));
  check(vl.length >= 3 && [...lvSet].every(l => l % 2 === 0), `Villa Nova variants on every second terrace (${vl.length} villas on levels ${[...lvSet].sort((a, b) => a - b).join(', ')})`);
  check((T8.stairs || []).length >= levels.length - 1, `a stair from each terrace to the next (${(T8.stairs || []).length} flights for ${levels.length} levels)`);
}

// ---------------------------------------------------------------- 5 · Very Low cost at F1
if (!process.env.SKIP_COST) {
  console.log('5 · the Very Low cost at F1');
  V.setLook('seamless');
  const PAD = V.MESH_PAD, PS = V.MESH_PS, PSS = PS * PS;
  const F1 = [-5.5, -147.5], RD = 4, VXLOD = 12;
  const windowTris = (vgen) => {
    const g = V.makeGen('overworld', 4242, { vgen });
    const cols = new Map(), c0x = Math.floor(F1[0] / 16), c0z = Math.floor(F1[1] / 16);
    const want = []; for (let dz = -RD; dz <= RD; dz++) for (let dx = -RD; dx <= RD; dx++) if (dx * dx + dz * dz <= RD * RD) want.push([c0x + dx, c0z + dz]);
    const need = new Set(); for (const [cx, cz] of want) for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) need.add((cx + a) + ',' + (cz + b));
    for (const k of need) { const [cx, cz] = k.split(',').map(Number); const c = g.generate(cx, cz); c.light = V.computeColumnLight(c.blocks, true); cols.set(k, c); }
    let tris = 0;
    for (const [CX, CZ] of want) for (let sy = 0; sy < 16; sy++) {
      const blocks = new Uint16Array(PSS * PS), light = new Uint16Array(PSS * PS), gr = new Uint16Array(PSS), fo = new Uint16Array(PSS), wa = new Uint16Array(PSS);
      let any = false;
      for (let y = -PAD; y < 16 + PAD; y++) for (let z = -PAD; z < 16 + PAD; z++) for (let x = -PAD; x < 16 + PAD; x++) {
        const wy = sy * 16 + y, cx = CX + Math.floor(x / 16), cz = CZ + Math.floor(z / 16), c = cols.get(cx + ',' + cz);
        const lx = ((x % 16) + 16) % 16, lz = ((z % 16) + 16) % 16, pi = (y + PAD) * PSS + (z + PAD) * PS + (x + PAD);
        if (!c) continue;
        if (y === 0) { const ti = (z + PAD) * PS + x + PAD; gr[ti] = c.tints.grass[lz * 16 + lx]; fo[ti] = c.tints.foliage[lz * 16 + lx]; wa[ti] = c.tints.water[lz * 16 + lx]; }
        if (wy < 0 || wy > 255) { light[pi] = wy > 255 ? 0xf000 : 0; continue; }
        const i = (wy << 8) | (lz << 4) | lx; blocks[pi] = c.blocks[i]; light[pi] = c.light[i];
        if (blocks[pi] && x >= 0 && x < 16 && z >= 0 && z < 16 && y >= 0 && y < 16) any = true;
      }
      if (!any) continue;
      const r = V.meshSection({ blocks, light, grass: gr, foliage: fo, water: wa, sy, ox: CX * 16, oz: CZ * 16, smooth: true, fancyLeaves: false, vxLod: true });
      const near = Math.hypot(CX * 16 + 8 - F1[0], CZ * 16 + 8 - F1[1], sy * 16 + 8 - 82) < VXLOD + 14;   // the section's middle within vxLod (+ its half diagonal)
      const q = (a) => a ? a.length / 8 / 4 * 2 : 0;
      tris += q(r.opaque) + q(r.cutout) + q(r.trans) + (near ? q(r.vx) : q(r.vxFar));
    }
    return { tris, cols: want.length, per: tris / want.length };
  };
  const t0 = performance.now();
  const old = windowTris(7), neu = windowTris(8);
  console.log(`    v042 (vgen 7): ${old.per.toFixed(0)} triangles a column · vgen 8: ${neu.per.toFixed(0)} (${old.cols} columns within ${RD} chunks of F1, ${((performance.now() - t0) / 1000).toFixed(0)} s)`);
  check(neu.per <= old.per * 1.10, `the city's chunk triangles per column at F1 within 10 % of the v042 town (${(neu.per / old.per * 100 - 100).toFixed(1)} %)`);
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
