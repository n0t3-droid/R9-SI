// Weißstadt, the hall city (vgen 9; src/shared/gen_hallcity.js, voxtown.js; plan docs/superpowers/plans/2026-10-08-t-town.md):
// the gate of the owner's town of 9 Oct, in numbers. Seed 53, the meadow site of cell (−2, −1):
//   1. the kit: every Weißstadt piece registered late, with parts, no crystal
//   2. the site: a meadow village at vgen 8 (old worlds keep it), the hall city at vgen 9
//   3. the hall: the vault hollow over the town, its crown a glass band, the clerestory's, the long walls' and the entrance
//      end's windows glass, two gates, the grand staircase climbing to the balustraded gallery
//   4. the town: the street 7 wide between paved fronts, the plaza's radius 12 with the fountain in its centre, street
//      lamps every 7–9 blocks, the lots and the houses at least 1.6 × the v042 village's (seed 53's own village)
//   5. the light: full sky light on the street and bright on the plaza (through the glass; the light engine itself)
//   6. the villager budget: at most 1 per 9 blocks of walkable street and plaza plus 2 per home; fewer per walkable
//      block than in the old village
//   7. the plan in the worker: the longest step under 60 ms (CPU), no crystal anywhere in the plan
// usage: bash test/wt_run.sh hallcity.js 300
const V = require('./load_shared.js');
const VG = V.VillageGen, R = V.R, VM = V.VM;
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const nm = (s) => (s > 0 && R.types[R.T.type[s]]) ? R.types[R.T.type[s]].name : 'air';
const ROT = [(u, v) => [u, v], (u, v) => [-v, u], (u, v) => [-u, -v], (u, v) => [v, -u]];
const SEED = 53, CELL = [-2, -1];

// ---------------------------------------------------------------- 1. the kit
console.log('1. the kit (voxtown.js)');
const KIT = ['vm_town_window_blue', 'vm_town_window_gold', 'vm_town_window_rose', 'vm_town_lamp', 'vm_town_awning_amber', 'vm_town_awning_teal', 'vm_town_sign_bread', 'vm_town_sign_cup', 'vm_town_sign_flower', 'vm_town_sign_book', 'vm_town_stall_amber', 'vm_town_stall_teal', 'vm_town_fountain', 'vx_town_band'];
const missing = KIT.filter(n => !R.byName[n]);
check(!missing.length, `every Weißstadt piece is a block (${KIT.length - missing.length} of ${KIT.length}${missing.length ? ', missing ' + missing.join(' ') : ''})`);
let emptyParts = 0;
for (const n of KIT) { const m = VM.MODELS[n]; if (!m) continue; VM.materialize(m); emptyParts += m.parts.filter(p => p.bounds.every(x => x === 0)).length; }
check(emptyParts === 0, `no model has an empty part (${emptyParts})`);
const lampL = R.byName.vm_town_lamp;
check(!!lampL && R.T.emit[lampL.state({ facing: 0, part: 3 })] > 0 && R.T.emit[lampL.state({ facing: 0, part: 0 })] === 0, 'the street lamp glows in its head, not in its foot');
check(!KIT.some(n => /crystal|prism/.test(n)), 'no crystal among the pieces');

// ---------------------------------------------------------------- 2. the site
console.log('2. the site (seed 53, cell −2, −1)');
const g8 = new V.OverworldGen(SEED, { worldType: 'default', vgen: 8 }), g9 = new V.OverworldGen(SEED, { worldType: 'default', vgen: 9 });
const s8 = VG.site(g8, CELL[0], CELL[1]), s9 = VG.site(g9, CELL[0], CELL[1]);
check(s8 && s8.style === 'meadow' && !s8.rad, `vgen 8 keeps its meadow village (${s8 && s8.style})`);
check(s9 && s9.style === 'hall' && s9.rad === VG.HALL.RAD && s9.from === 'meadow' && s9.x === s8.x && s9.z === s8.z, `vgen 9 makes it the hall city at the same place (${s9 && s9.style}, rad ${s9 && s9.rad})`);
// over a few seeds: which meadow and cherry villages become hall cities (the others keep their style: the land does not fit)
{
  let hall = 0, plain = 0, other = 0;
  for (const seed of [11, 53, 31, 777, 2026, 5555]) {
    const ga = new V.OverworldGen(seed, { worldType: 'default', vgen: 9 }), gb = new V.OverworldGen(seed, { worldType: 'default', vgen: 8 });
    for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) {
      const a = VG.site(ga, i, j), b = VG.site(gb, i, j); if (!a || !b) continue;
      if (b.style === 'meadow' || b.style === 'cherry') { if (a.style === 'hall') hall++; else plain++; } else if (a.style !== b.style) other++;
    }
  }
  console.log(`    meadow and cherry villages of six seeds at vgen 9: ${hall} hall cities, ${plain} keep their village (the land too wet or too steep)`);
  check(hall >= 6 && other === 0, `the hall city is the meadow and cherry climates' settlement, no other style changes (${hall} halls, ${other} other changes)`);
}

// ---------------------------------------------------------------- 3–4. the hall and the town (the plan's blocks, applied as VG.apply does)
const t0 = process.cpuUsage();
const plan = VG.plan(g9, s9);
const planMs = (process.cpuUsage(t0).user + process.cpuUsage(t0).system) / 1000;
const Hh = plan.hall, F = Hh.F, r = Hh.r, cx = Hh.cx, cz = Hh.cz;
console.log(`3. the hall (F ${F}, frame ${r}, ${plan.chunks.size} chunks, plan ${planMs.toFixed(0)} ms CPU)`);
check(r === ((s9.seed >>> 3) & 3) && cx === s9.x && cz === s9.z, 'the hall stands on the site in the frame of its seed');
const cols = new Map();
const colOf = (x, z) => { const k = x * 65536 + z; let c = cols.get(k); if (!c) { c = new Int32Array(256).fill(-1); cols.set(k, c); } return c; };
for (const b of plan.chunks.values()) {
  for (let i = 0; i < b.f.length; i += 5) { const c = colOf(b.f[i], b.f[i + 1]); for (let y = Math.max(1, b.f[i + 2]); y <= Math.min(254, b.f[i + 3]); y++) c[y] = b.f[i + 4]; }
  for (let i = 0; i < b.o.length; i += 4) { const y = b.o[i + 1]; if (y < 1 || y > 254) continue; colOf(b.o[i], b.o[i + 2])[y] = b.o[i + 3]; }
}
const W2 = (u, v) => { const q = ROT[r](u, v); return [cx + q[0], cz + q[1]]; };
const at = (u, y, v) => { const [x, z] = W2(u, v); const c = cols.get(x * 65536 + z); return c ? c[y] : -1; };
const atN = (u, y, v) => { const s = at(u, y, v); return s < 0 ? '?' : nm(s); };
const solid = (n) => n !== 'air' && n !== '?';
// the vault hollow: over the nave, from above the houses' roofs up to the vault's underside, nothing but air
{
  let cells = 0, bad = 0;
  for (let u = -26; u <= 26; u += 2) for (let v = -76; v <= 48; v += 4) {
    const top = F + VG.HALL.hN(Math.abs(u));
    for (let y = F + 23; y < top - 2; y++) { cells++; if (atN(u, y, v) !== 'air') bad++; }
  }
  check(cells > 2000 && bad === 0, `the vault is hollow over the town (${cells} cells between the roofs and the vault, ${bad} not air)`);
  let street = 0, sbad = 0;
  for (let v = -70; v <= 36; v++) { if (Math.abs(v) <= 5) continue; for (let y = F + 1; y <= F + 22; y++) { street++; if (atN(0, y, v) !== 'air') sbad++; } }
  check(sbad === 0, `the street's axis is open from the floor to the vault, the fountain's basin aside (${street} cells, ${sbad} blocked)`);
}
// the vault: a coffered one — frosted glass panels between white stone ribs (every 6 across, every 5 along); from below a
// luminous white ceiling (run 2: a clear glass band read as open sky, the hall looked outdoors)
{
  let n = 0, glass = 0, clear = 0, far = 0;
  for (let u = -22; u <= 22; u++) for (let v = -76; v <= 50; v++) {
    const y = F + VG.HALL.hN(Math.abs(u)), b = atN(u, y, v); n++;
    if (/glass/.test(b)) { glass++; if (b === 'glass') clear++; }
    else { let near = false; for (let du = -2; du <= 2 && !near; du++) for (let dv = -2; dv <= 2; dv++) if (/glass/.test(atN(u + du, F + VG.HALL.hN(Math.abs(u + du)), v + dv))) { near = true; break; } if (!near) far++; }
  }
  check(glass >= n * 0.6 && clear === 0, `the vault is frosted glass panels between ribs (${glass} of ${n} cells, ${clear} clear)`);
  check(far === 0, `every rib lies within two cells of a panel (${far} farther)`);
  check(atN(0, F + 40, -24) === 'frosted_glass' && atN(0, F + 41, -24) === 'air', 'the crown of the vault is at 40 over the floor (34–40 high)');
}
// windows: the clerestory over every opening of the arcade, the long walls' bays, the entrance end's giant window
{
  let n = 0, g = 0;
  for (let k = -7; k <= 4; k++) for (const s of [-1, 1]) for (let y = F + 25; y <= F + 29; y++) { n++; if (/glass/.test(atN(s * 28, y, 10 * k))) g++; }
  check(g === n, `the clerestory's windows are glass (${g} of ${n} cells in 24 windows)`);
  let n2 = 0, g2 = 0;
  for (let k = -7; k <= 4; k++) { if (k === 0) continue; for (const s of [-1, 1]) for (let y = F + 6; y <= F + 15; y++) for (const t of [-2, -1, 1, 2]) { n2++; if (/glass/.test(atN(s * 47, y, 10 * k + t))) g2++; } }
  check(g2 === n2, `the long walls' windows are glass (${g2} of ${n2} cells in 22 windows)`);
  let n3 = 0, g3 = 0;
  for (const u of [-11, -6, -1, 1, 6, 11]) for (let y = F + 7; y <= F + 34; y++) { const b = atN(u, y, -79); if (b === '?' ) continue; n3++; if (/glass/.test(b) || (u % 4 !== 0 && y !== F + 14 && y !== F + 22 && b === 'smooth_quartz')) g3++; }
  check(n3 > 100 && g3 >= n3 * 0.85, `the entrance end's giant window is glass (${g3} of ${n3} cells)`);
  // the gates: open from the floor to 10 in both long walls
  let open = 0;
  for (const s of [-1, 1]) for (let t = -3; t <= 3; t++) for (let y = F + 1; y <= F + 9; y++) for (let a = 46; a <= 48; a++) if (atN(s * a, y, t) === 'air') open++;
  check(open === 2 * 7 * 9 * 3, `two gates seven wide in the long walls (${open} of ${2 * 7 * 9 * 3} cells open)`);
}
// the grand staircase climbs to the gallery; balustrades on its stringers and along the gallery's front
{
  let ok = 0;
  for (let k = 0; k < 7; k++) { const s = atN(0, F + 1 + k, 42 + k); if (s === 'quartz_stairs' && atN(0, F + 2 + k, 42 + k) === 'air' && atN(0, F + 4 + k, 42 + k) === 'air') ok++; }
  const landing = solid(atN(0, F + 8, 49)) && atN(0, F + 9, 49) === 'air';
  let gal = 0; for (let v = 50; v <= 70; v++) if (solid(atN(0, F + 8, v)) && atN(0, F + 9, v) !== '?' ) gal++;
  check(ok === 7 && landing && gal === 21, `the grand staircase climbs eight steps to the gallery (${ok} of 7 steps with headroom, landing ${landing}, gallery floor ${gal} of 21)`);
  let bal = 0; for (let k = 0; k < 8; k++) for (const s of [-1, 1]) if (atN(s * 6, F + 2 + k, 42 + k) === 'vx_balustrade') bal++;
  let front = 0; for (let u = -26; u <= 26; u++) if (atN(u, F + 9, 50) === 'vx_balustrade') front++;
  check(bal === 16 && front >= 36, `balustrades climb the stringers (${bal} of 16) and run along the gallery's front (${front})`);
}
// the sky over the hall: no floating island over it, and the light under the whole roof (the light engine's sky light
// falls straight down a column, light_local.js: run 3's apse and the vault over the plaza were black under seed 53's
// islands, whose bottoms hung 2 blocks over the roof)
{
  let isl = 0, n = 0;
  for (let u = -52; u <= 52; u += 4) for (let v = -84; v <= 84; v += 4) { const [x, z] = W2(u, v); n++; if (g9.islandAt(x, z)) isl++; }
  check(isl === 0, `no floating island over the hall (${isl} of ${n} columns of its footprint under one)`);
  const g8b = new V.OverworldGen(SEED, { worldType: 'default', vgen: 8 });
  let isl8 = 0; for (let u = -52; u <= 52; u += 4) for (let v = -84; v <= 84; v += 4) { const [x, z] = W2(u, v); if (g8b.islandAt(x, z)) isl8++; }
  check(isl8 > 0, `the islands of the same place stay in an older world (${isl8} columns under one at vgen 8)`);
  // the light under the roof in the chunks of the apse and the plaza's vault (generated and lit as the worker does): the
  // air under the vault and over the gallery is lit through the glass, no black corner
  const lit = new Map();
  const colL = (x, z) => { const k = (x >> 4) + ',' + (z >> 4); let c = lit.get(k); if (!c) { const ch = g9.generate(x >> 4, z >> 4); c = { b: ch.blocks, L: V.computeColumnLight(ch.blocks, true) }; lit.set(k, c); } return c; };
  const idx = (x, y, z) => (y << 8) | ((z & 15) << 4) | (x & 15);
  let cells = 0, dark = 0, low = 1e9, gal = 0, galDark = 0;
  for (let u = -26; u <= 26; u += 2) for (let v = -6; v <= 78; v += 2) {
    const [x, z] = W2(u, v), c = colL(x, z);
    let y = F + 44; while (y > F && !c.b[idx(x, y, z)]) y--;          // the roof's top
    while (y > F && c.b[idx(x, y, z)]) y--;                            // down through the roof to the air under it
    if (y <= F + 12) continue;
    cells++; const s = c.L[idx(x, y, z)] >>> 12; low = Math.min(low, s); if (s < 6) dark++;
    if (v >= 52 && v <= 74 && Math.hypot(u, v - 51) < 25) { const s2 = c.L[idx(x, F + 10, z)] >>> 12; gal++; if (s2 < 10) galDark++; }
  }
  check(cells > 500 && dark === 0, `the vault over the plaza and the apse is lit from below (${cells} cells, ${dark} under sky light 6, the lowest ${low})`);
  check(gal > 80 && galDark === 0, `the apse's gallery is bright (${gal} cells at eye height, ${galDark} under sky light 10)`);
  // the whole roof — nave, apse and both aisles — of this hall and of seed 2026's (another frame, other chunk borders: the
  // light spreads only inside its own chunk, so a strip under the aisle vault's outer edge was black there)
  const underRoof = (g, Hp) => {
    const cache = new Map(), RT = (u, v) => { const q = ROT[Hp.r](u, v); return [Hp.cx + q[0], Hp.cz + q[1]]; };
    const col = (x, z) => { const k = (x >> 4) + ',' + (z >> 4); let c = cache.get(k); if (!c) { const ch = g.generate(x >> 4, z >> 4); c = { b: ch.blocks, L: V.computeColumnLight(ch.blocks, true) }; cache.set(k, c); } return c; };
    let n = 0, bad = 0;
    for (let u = -46; u <= 46; u += 2) for (let v = -76; v <= 78; v += 2) {
      const [x, z] = RT(u, v), c = col(x, z);
      let y = Hp.F + 44; while (y > Hp.F && !c.b[idx(x, y, z)]) y--;
      if (y <= Hp.F + 10) continue;
      while (y > Hp.F && c.b[idx(x, y, z)]) y--;
      if (y <= Hp.F + 12) continue;
      n++; const L = c.L[idx(x, y, z)]; if ((L >>> 12) < 6 && (L & 0xfff) === 0) bad++;
    }
    return [n, bad];
  };
  const [n53, bad53] = underRoof(g9, Hh);
  const g26 = new V.OverworldGen(2026, { worldType: 'default', vgen: 9 }), s26 = VG.site(g26, -3, 1), p26 = s26 && s26.style === 'hall' ? VG.plan(g26, s26) : null;
  const [n26, bad26] = p26 ? underRoof(g26, p26.hall) : [0, 1];
  check(n53 > 2500 && bad53 <= n53 / 1000 && n26 > 2500 && bad26 <= n26 / 1000, `the whole roof of the hall is lit from below, the aisles' too: no dark strip, at most a stray cell in a thousand (seed 53: ${bad53} of ${n53} cells under sky light 6; seed 2026's hall: ${bad26} of ${n26}, 129 before the aisle's panels reached the wall)`);
}
console.log('4. the town');
// the street: 7 wide between paved fronts, the house fronts beyond
{
  let rows = 0, good = 0;
  for (const v of [-60, -48, -30, -20, 20, 30]) {
    rows++;
    const paved = [-3, -2, -1, 0, 1, 2, 3].every(u => /paver|granite/.test(atN(u, F, v)) && atN(u, F + 1, v) === 'air' && atN(u, F + 2, v) === 'air');
    const fronts = [4, 5, -4, -5].every(u => atN(u, F, v) === 'travertine');
    const houses = [6, -6].every(u => solid(atN(u, F + 2, v)) || /door|pane/.test(atN(u, F + 2, v)));
    if (paved && fronts && houses) good++;
  }
  check(good === rows, `the street is 7 wide, paved fronts 2 wide, then the houses (${good} of ${rows} cross-sections)`);
}
// the plaza: radius 12 round the fountain, mostly free to walk
{
  check(plan.plaza && plan.plaza.r === 12 && atN(0, F + 1, 0) === 'vm_town_fountain', `the plaza's radius is 12 with the fountain in its centre (${plan.plaza && plan.plaza.r}, ${atN(0, F + 1, 0)})`);
  let n = 0, free = 0;
  for (let u = -12; u <= 12; u++) for (let v = -12; v <= 12; v++) { const d = Math.hypot(u, v); if (d > 12 || d < 5) continue; n++; if (/marble|travertine/.test(atN(u, F, v)) && atN(u, F + 1, v) === 'air' && atN(u, F + 2, v) === 'air') free++; }
  check(free >= n * 0.85, `the plaza round the basin is free to walk (${free} of ${n} cells)`);
  let water = 0; for (let u = -3; u <= 3; u++) for (let v = -3; v <= 3; v++) if (atN(u, F + 1, v) === 'water') water++;
  check(water >= 20, `the fountain stands in a basin of water (${water} cells)`);
  const tables = []; for (let u = -24; u <= 24; u++) for (let v = -13; v <= 13; v++) if (atN(u, F + 1, v) === 'vm_shop_table_marble') tables.push([u, v]);
  const cafe = plan.work.find(w => w.kind === 'cafe');
  check(tables.length >= 10 && cafe && cafe.seats.length >= 20, `café tables round the plaza (${tables.length}) and the café's seats (${cafe ? cafe.seats.length : 0})`);
}
// street lamps every 7–9 blocks along both fronts (the plaza has its own)
{
  const lamps = { '-1': [], '1': [] };
  for (const s of [-1, 1]) for (let v = -78; v <= 48; v++) { const b = at(s * 4, F + 1, v); if (b > 0 && nm(b) === 'vm_town_lamp') lamps[s].push(v); }
  let gaps = [], bad = 0;
  for (const s of [-1, 1]) { const L = lamps[s]; for (let i = 1; i < L.length; i++) { const gp = L[i] - L[i - 1]; if (L[i - 1] < -13 && L[i] > 13) continue; gaps.push(gp); if (gp < 7 || gp > 9) bad++; } }
  check(gaps.length >= 20 && bad === 0, `street lamps every 7–9 blocks (${gaps.length} gaps: ${[...new Set(gaps)].join(', ')})`);
}
// the lots and the houses against the v042 village of the same site (seed 53's meadow village at vgen 8)
const old = VG.plan(g8, s8);
const oldLots = old.homes.map(h => (h.w + 4) * (h.d + 5)), oldFoot = old.homes.map(h => h.w * h.d);
const mean = (a) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
{
  const houses = Hh.houses.filter(h => h.lot), lots = houses.map(h => h.lot.w * h.lot.d), foot = houses.map(h => h.lot.house).concat(Hh.loggias.map(() => 10 * 7));
  const rl = mean(lots) / mean(oldLots), rf = mean(foot) / mean(oldFoot);
  console.log(`    v042 village: ${old.homes.length} homes, lot ${mean(oldLots).toFixed(0)} m², house ${mean(oldFoot).toFixed(0)} m² · hall city: ${houses.length} town houses on lots of ${mean(lots).toFixed(0)} m², ${Hh.loggias.length} loggia houses, buildings ${mean(foot).toFixed(0)} m² on average, ${plan.homes.length} homes`);
  check(rl >= 1.6, `the lots are ${rl.toFixed(2)} × the old village's (≥ 1.6)`);
  check(rf >= 1.6, `the houses are ${rf.toFixed(2)} × the old village's (≥ 1.6)`);
  check(houses.length === 12 && houses.every(h => h.lot.floors >= 2), `twelve shop houses of two or three storeys (${houses.length})`);
}

// ---------------------------------------------------------------- 5. the light
console.log('5. the light');
{
  // the chunk under the street at (0, −24) and the plaza's edge, generated and lit as the worker does
  const lightAt = (u, y, v) => { const [x, z] = W2(u, v); const c = g9.generate(x >> 4, z >> 4); const L = V.computeColumnLight(c.blocks, true); return L[(y << 8) | ((z & 15) << 4) | (x & 15)] >>> 12; };
  const a = lightAt(0, F + 2, -24), b = lightAt(2, F + 2, -42), c = lightAt(8, F + 2, -1);
  check(a === 15 && b === 15, `full sky light on the street through the vault's glass (${a}, ${b} of 15)`);
  check(c >= 12, `bright on the plaza by the café tables (${c} of 15; the light engine's own column)`);
}

// ---------------------------------------------------------------- 6. the villager budget
console.log('6. the villagers');
{
  const C = VG.HALL_CODE, cap = plan.folkCap;
  const roster = plan.homes.reduce((a, h) => a + Math.max(1, h.beds.length), 0);
  check(!!cap && cap.max === Math.floor(cap.walk / 9) + 2 * plan.homes.length, `the budget: 1 per 9 blocks of walkable street and plaza (${cap && cap.walk}) plus 2 per home (${plan.homes.length}) = ${cap && cap.max}`);
  check(roster <= cap.max, `the town's people fit its budget (${roster} ≤ ${cap.max})`);
  // the old village: its walkable cells are its roads and its plaza (the ops that lay its path and plaza materials)
  const S = VG.STYLES.meadow, walkM = new Set([S.path, S.pathAlt || 'coarse_dirt', 'coarse_dirt'].concat(S.plaza));
  const oldWalk = new Set();
  for (const b of old.chunks.values()) for (let i = 0; i < b.o.length; i += 4) if (walkM.has(nm(b.o[i + 3]))) oldWalk.add(b.o[i] * 65536 + b.o[i + 2]);
  const oldRoster = old.homes.reduce((a, h) => a + Math.max(1, h.beds.length), 0);
  const dOld = oldRoster / oldWalk.size, dNew = roster / cap.walk;
  console.log(`    v042 village: ${oldRoster} people on ${oldWalk.size} walkable blocks (1 per ${(1 / dOld).toFixed(1)}) · hall city: ${roster} on ${cap.walk} (1 per ${(1 / dNew).toFixed(1)}) · the plaza ${Math.round(Math.PI * 144)} m² vs ${(2 * old.plaza.r + 1) ** 2} m²`);
  check(dNew < dOld, 'fewer people per walkable block than in the old village (no crowds)');
  check(C && cap.walk > 4000, `a big walkable town (${cap.walk} blocks)`);
}

// ---------------------------------------------------------------- 7. the plan in the worker
console.log('7. the plan in the worker');
{
  // the longest step of the plan (CPU time; the best of three runs, the machine is shared)
  let best = 1e9;
  for (let run = 0; run < 3; run++) {
    const g = new V.OverworldGen(SEED, { worldType: 'default', vgen: 9 }), s = VG.site(g, CELL[0], CELL[1]);
    const it = VG.hallCity(g, s); let res, max = 0;
    do { const c0 = process.cpuUsage(); res = it.next(); const c = process.cpuUsage(c0); const ms = (c.user + c.system) / 1000; if (ms > max) max = ms; } while (!res.done);
    best = Math.min(best, max);
  }
  check(best < 60, `the longest step of the plan ${best.toFixed(1)} ms (< 60)`);
  const bad = new Set();
  for (const b of plan.chunks.values()) { for (let i = 3; i < b.o.length; i += 4) { const n = nm(b.o[i]); if (/crystal|prism|aether/.test(n)) bad.add(n); } for (let i = 4; i < b.f.length; i += 5) { const n = nm(b.f[i]); if (/crystal|prism|aether/.test(n)) bad.add(n); } }
  check(bad.size === 0, `no crystal anywhere in the town (${[...bad].join(' ') || 'none'})`);
  const sum = VG.summary(plan);
  check(sum.folkCap && sum.folkCap.max === plan.folkCap.max && sum.style === 'hall', 'the game gets the budget with the plan');
}
// ---------------------------------------------------------------- 8. the villages of the other climates at vgen 9: the same airing
console.log('8. the other climates\' villages (vgen 9): wider streets, a plaza with a fountain, lots 1.6 ×, no crystals');
{
  const pairs = [];
  // (seed 1's prism villages at (−2, 0) and (2, 1)'s savanna, seed 5's desert at (−2, 0), then seeds 53, 11 and 31's own)
  for (const [seed, cells] of [[1, [[-2, 0], [2, 1]]], [5, [[-2, 0]]], [53, null], [11, null], [31, null]]) {
    const ga = new V.OverworldGen(seed, { worldType: 'default', vgen: 9 }), gb = new V.OverworldGen(seed, { worldType: 'default', vgen: 8 });
    for (let i = -2; i <= 2 && pairs.length < 9; i++) for (let j = -2; j <= 2 && pairs.length < 9; j++) {
      if (cells && !cells.some(c => c[0] === i && c[1] === j)) continue;
      const a = VG.site(ga, i, j), b = VG.site(gb, i, j);
      if (!a || !b || a.home || /modern|hall|tech/.test(a.style) || a.style !== b.style) continue;
      pairs.push({ seed, a, b, pa: VG.plan(ga, a), pb: VG.plan(gb, b) });
    }
  }
  const styles = [...new Set(pairs.map(p => p.a.style))];
  console.log(`    ${pairs.length} villages (${styles.join(', ')})`);
  check(pairs.length >= 5, `village sites of other climates to compare (${pairs.length})`);
  let wide = 0, fountains = 0, crystals = 0, caps = 0; const ra = [], rb = [];
  for (const { pa, pb } of pairs) {
    if (pa.roadW >= 5 && pa.roadW <= 7) wide++;
    let f = false; for (const b of pa.chunks.values()) for (let i = 3; i < b.o.length; i += 4) { const n = nm(b.o[i]); if (n === 'vm_town_fountain') f = true; if (/crystal|aether/.test(n)) crystals++; }
    if (f && pa.plaza.r >= 9) fountains++;
    if (pa.folkCap && pa.homes.reduce((x, h) => x + Math.max(1, h.beds.length), 0) <= pa.folkCap.max) caps++;
    const [mu, mv] = pa.lotMargins || [2, 3];
    for (const h of pa.homes) ra.push((h.w + 2 * mu) * (h.d + mu + mv)); for (const h of pb.homes) rb.push((h.w + 4) * (h.d + 5));
  }
  check(wide === pairs.length, `their streets are 5–7 wide (${wide} of ${pairs.length})`);
  check(fountains === pairs.length, `each has a plaza of radius 9 or more with a fountain (${fountains} of ${pairs.length})`);
  check(crystals === 0, `no crystal in them (${crystals})`);
  check(caps === pairs.length, `each carries its villager budget and fits it (${caps} of ${pairs.length})`);
  const rl = mean(ra) / mean(rb);
  check(rl >= 1.6, `their lots are ${rl.toFixed(2)} × the vgen-8 villages' (mean ${mean(ra).toFixed(0)} vs ${mean(rb).toFixed(0)} m²)`);
  // (their footprint: a larger radius, so the airing does not shrink the village to a hamlet)
  const homesA = mean(pairs.map(p => p.pa.homes.length)), homesB = mean(pairs.map(p => p.pb.homes.length));
  console.log(`    homes per village: ${homesA.toFixed(1)} (vgen 9) vs ${homesB.toFixed(1)} (vgen 8); radius ${pairs[0].a.rad} vs ${VG.rad(new V.OverworldGen(53, { worldType: 'default', vgen: 8 }))}`);
  check(homesA >= homesB * 0.6, 'the aired villages keep most of their homes (a larger radius)');
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
