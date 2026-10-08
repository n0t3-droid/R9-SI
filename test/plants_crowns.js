// the shared palm crowns of the Palm City (vgen 7, the crown pass at the end of VG.plan in gen_village.js) over ten seeds:
// every avenue palm stands (at least six, and as many as vgen 5 had), the palm roads, the gardens and the plazas keep the
// count of vgen 5, the yards keep the count of vgen 6 (vgen 5 and vgen 6 offer different yard spots: the detail layer changes
// the house storeys, so the yard candidates differ, and vgen 6 is the baseline of the yards), the houses and lamps of vgen 6
// and vgen 7 are the same, and the palms that cannot stand are exactly the known drops (a palm whose trunk cell is a lot's
// entrance path, with every cell within four blocks taken by a path, a lot or a road).
require('./load_shared.js');
const VG = VR.VillageGen;
let fails = 0; const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };

const SEEDS = [4242, 1, 2, 3, 5, 7, 11, 42, 99, 1234];
// the known drops per seed: [kind, road, x, z] of the planned spot (seed 2: the road-1 palm at (−45, −107), its trunk cell is an entrance path)
const KNOWN = { 2: [['street', 1, -45, -107]] };
const cat = (kind, road) => kind === 'street' ? (road === 0 ? 'avenue' : 'road') : kind;
const count = (plan) => { const c = {}; for (const [k, r] of plan.palms) { const key = cat(k, r); c[key] = (c[key] || 0) + 1; } return c; };

const rows = [];
const t0 = Date.now();
for (const seed of SEEDS) {
  const P = {};
  for (const vgen of [5, 6, 7]) { const g = new VR.OverworldGen(seed, { vgen }); P[vgen] = VG.plan(g, VG.site(g, 0, -1)); }
  const c5 = count(P[5]), c6 = count(P[6]), c7 = count(P[7]);
  const drops = P[7].crownDrops.map(d => [d[0], d[1], d[2], d[3]]);
  const known = KNOWN[seed] || [];
  const isKnown = (d) => known.some(k => k[0] === d[0] && k[1] === d[1] && k[2] === d[2] && k[3] === d[3]);
  const unknown = drops.filter(d => !isKnown(d));
  const knownN = (name) => drops.filter(d => isKnown(d) && cat(d[0], d[1]) === name).length;
  rows.push({ seed, c5, c6, c7, drops: drops.length, unknown: unknown.length, homesEq: JSON.stringify(P[6].homes) === JSON.stringify(P[7].homes), lampsEq: JSON.stringify(P[6].lamps) === JSON.stringify(P[7].lamps), knownN });
}
console.log('  ten seeds planned in ' + (Date.now() - t0) + ' ms');
for (const r of rows) console.log('    seed ' + r.seed + ': avenue ' + (r.c7.avenue || 0) + '/' + (r.c5.avenue || 0) + ', road ' + (r.c7.road || 0) + '/' + (r.c5.road || 0) + ', garden ' + (r.c7.garden || 0) + '/' + (r.c5.garden || 0) + ', plaza ' + (r.c7.plaza || 0) + '/' + (r.c5.plaza || 0) + ', yard ' + (r.c7.yard || 0) + '/' + (r.c6.yard || 0) + ' (vgen 6 ' + (r.c6.yard || 0) + ', vgen 5 ' + (r.c5.yard || 0) + '), drops ' + r.drops);

const bad = (f) => rows.filter(f).map(r => r.seed).join(',');
const avMin = Math.min(...rows.map(r => r.c7.avenue || 0));
check(avMin >= 6, 'every avenue has at least six shared palms (fewest ' + avMin + ' of 8)');
const badAv = bad(r => (r.c7.avenue || 0) < (r.c5.avenue || 0));
check(badAv === '', 'vgen 7 has as many avenue palms as vgen 5 on every seed' + (badAv ? ' (short on seeds ' + badAv + ')' : ' (' + rows.map(r => r.c7.avenue || 0).join(' ') + ')'));
const badRoad = bad(r => (r.c7.road || 0) + r.knownN('road') < (r.c5.road || 0));
check(badRoad === '', 'vgen 7 has as many palm-road palms as vgen 5 on every seed, less the known drops' + (badRoad ? ' (short on seeds ' + badRoad + ')' : ''));
const badGarden = bad(r => (r.c7.garden || 0) + r.knownN('garden') < (r.c5.garden || 0));
check(badGarden === '', 'vgen 7 has as many garden palms as vgen 5 on every seed' + (badGarden ? ' (short on seeds ' + badGarden + ')' : ''));
const badPlaza = bad(r => (r.c7.plaza || 0) + r.knownN('plaza') < (r.c5.plaza || 0));
check(badPlaza === '', 'vgen 7 has as many plaza palms as vgen 5 on every seed' + (badPlaza ? ' (short on seeds ' + badPlaza + ')' : ''));
const badYard = bad(r => (r.c7.yard || 0) + r.knownN('yard') < (r.c6.yard || 0));
check(badYard === '', 'vgen 7 has as many yard palms as vgen 6 on every seed (the yard baseline; vgen 5 differs)' + (badYard ? ' (short on seeds ' + badYard + ')' : ''));
const badUnknown = rows.filter(r => r.unknown > 0).map(r => r.seed).join(',');
check(badUnknown === '', 'every crown drop is a known one' + (badUnknown ? ' (unknown drops on seeds ' + badUnknown + ')' : ' (' + rows.reduce((n, r) => n + r.drops, 0) + ' drops in all)'));
const badHomes = rows.filter(r => !r.homesEq || !r.lampsEq).map(r => r.seed).join(',');
check(badHomes === '', 'the houses and lamps of vgen 6 and vgen 7 are the same on every seed' + (badHomes ? ' (differ on ' + badHomes + ')' : ''));

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
