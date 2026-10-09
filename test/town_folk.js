// The Weißstadt's people (the hall city, vgen 9; plan docs/superpowers/plans/2026-10-08-t-town.md): the owner's
// "keine Lego-Villagers, wir wollen schon Realismus" and "die Einwohnerzahl folgt der Dorfgröße".
//   1. the budget: Folk.fitBudget shrinks the biggest families (the youngest first) to a town's budget; the hall city's
//      roster (villages.js makeRoster) fits plan.folkCap; a village of an older world keeps every family as it was
//   2. the clothes: the grown-ups of the hall city wear robes and coats in the references' palette (white, cream,
//      blue-grey, brown) with gold trims; a share carries a shopping bag or a basket; the children wear the palette too;
//      the people of other towns are dressed as before
//   3. the proportions: a Weißstadt villager's rig is the same as any villager's (the same joints, the same lengths) —
//      the realistic proportions of folkmodel.js, never a figure-toy's (a head at most a fifth of the height)
//   4. the bag and the basket hang from the right hand; the robe reaches the ankles, the coat the knees, gold at the hem
//   5. the afternoon: the grown-ups without a shop sit at the café's tables round the plaza ('terrace', counted on the
//      street's budget) or go shopping; the shopkeepers keep their shops; nothing changes in other towns
// usage: bash test/wt_run.sh town_folk.js 300
const V = require('./load_shared.js');
require('../src/main/voxmodels.js'); require('../src/main/villagers.js'); require('../src/main/folkmodel.js');
require('../src/main/villages.js'); require('../src/main/folklife.js');
const VG = V.VillageGen, Folk = V.Folk, Vs = V.Villages;
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };

console.log('1. the budget');
{
  const kinds = []; for (let i = 0; i < 10; i++) kinds.push(['adult', 'adult', 'child', i % 2 ? 'child' : 'elder']);
  Folk.fitBudget(kinds, 25);
  const total = kinds.reduce((a, k) => a + k.length, 0), kids = kinds.reduce((a, k) => a + k.filter(x => x === 'child').length, 0);
  check(total === 25 && kinds.every(k => k.length >= 1 && k.includes('adult')), `ten families of four fit a budget of 25 (${total}), every family keeps its grown-ups`);
  check(kids <= 5, `the youngest go first (${kids} children left of 15)`);
  const same = [['adult', 'adult', 'child']]; Folk.fitBudget(same, undefined);
  check(same[0].length === 3, 'no budget: the family stays as it is');
}
const g9 = new V.OverworldGen(53, { worldType: 'default', vgen: 9 }), g8 = new V.OverworldGen(53, { worldType: 'default', vgen: 8 });
const s9 = VG.site(g9, -2, -1), s8 = VG.site(g8, -2, -1);
const vil9 = { plan: VG.summary(VG.plan(g9, s9)), st: {} }, vil8 = { plan: VG.summary(VG.plan(g8, s8)), st: {} };
Vs.makeRoster(vil9); Vs.makeRoster(vil8);
{
  const cap = vil9.plan.folkCap, n = vil9.people.length;
  check(cap && n <= cap.max && n > 60, `the hall city's people fit its budget (${n} ≤ ${cap && cap.max})`);
  // a tight budget on the same town: the roster shrinks to it
  const tight = { plan: Object.assign({}, vil9.plan, { folkCap: Object.assign({}, cap, { max: 80 }) }), st: {} };
  Vs.makeRoster(tight);
  check(tight.people.length === 80, `with a budget of 80 the town has 80 people (${tight.people.length})`);
  const bedsOld = vil8.plan.homes.reduce((a, h) => a + Math.max(1, h.beds.length), 0);
  check(!vil8.plan.folkCap && vil8.people.length >= vil8.plan.homes.length && vil8.people.length <= bedsOld + 2 * vil8.plan.homes.length, `an older world's village keeps its families (${vil8.people.length} people in ${vil8.plan.homes.length} homes)`);
}

console.log('2. the clothes');
const W = Folk.WEISS, PAL = new Set(W.robe.concat(W.coat));
{
  const grown = vil9.people.filter(p => p.age !== 'child'), kids = vil9.people.filter(p => p.age === 'child');
  const garbed = grown.filter(p => p.look.garb && p.look.trim === W.trim);
  const inPal = garbed.filter(p => PAL.has(p.look.shirt));
  const robes = garbed.filter(p => p.look.garb === 'robe').length, coats = garbed.filter(p => p.look.garb === 'coat').length;
  check(garbed.length === grown.length && inPal.length === garbed.length, `every grown-up wears a robe or a coat in the palette with gold trims (${garbed.length} of ${grown.length}: ${robes} robes, ${coats} coats)`);
  const carry = grown.filter(p => p.look.tool === 'bag' || p.look.tool === 'basket').length;
  check(carry >= grown.length * 0.3, `shopping bags and baskets in hand (${carry} of ${grown.length})`);
  check(kids.every(p => !p.look.garb && W.kid.includes(p.look.shirt)), `the children in the palette's colours (${kids.length})`);
  const old = vil8.people.filter(p => p.look.garb);
  check(old.length === 0, 'the people of other towns are dressed as before');
  const baker = vil9.people.find(p => p.role === 'baker');
  check(!baker || baker.look.tool === undefined || baker.look.tool === null || baker.look.tool === 'bread', 'a baker keeps the bread (the trades keep their tools)');
}

console.log('3. the proportions');
{
  const plain = Folk.look(12345, 'crafter', 'adult'), town = Folk.look(12345, 'crafter', 'adult', null, 'hall');
  const a = Folk.buildHiRes(plain), b = Folk.buildHiRes(town);
  const sameRig = JSON.stringify(a.layout) === JSON.stringify(b.layout) && JSON.stringify(a.rig) === JSON.stringify(b.rig);
  check(sameRig, 'a Weißstadt villager has the same rig as any villager (joints and lengths)');
  // the head's share of the standing height (pivot layout in voxels): realistic, not a toy's big head
  const head = b.parts.head.grid, hy = b.layout.head ? b.layout.head[1] : 0;
  let top = -1e9, bot = 1e9; for (let y = 0; y < head.sy; y++) for (let z = 0; z < head.sz; z++) for (let x = 0; x < head.sx; x++) if (head.get(x, y, z)) { top = Math.max(top, y); bot = Math.min(bot, y); }
  const headH = top - bot + 1, height = hy + (head.sy - head.oy);
  check(headH / height < 0.22, `the head is ${(100 * headH / height).toFixed(0)} % of the height (realistic; a figure-toy's is a third or more)`);
}

console.log('4. the robe, the coat, the bag and the basket');
{
  const find = (pred) => { for (let s = 1; s < 4000; s++) { const L = Folk.look(s, 'crafter', 'adult', null, 'hall'); if (pred(L)) return L; } return null; };
  const robe = find(L => L.garb === 'robe'), coat = find(L => L.garb === 'coat'), bag = find(L => L.tool === 'bag'), basket = find(L => L.tool === 'basket');
  const lowest = (L, part, col) => { const m = Folk.buildHiRes(L), g = m.parts[part].grid; let lo = 1e9; for (let y = 0; y < g.sy; y++) for (let z = 0; z < g.sz; z++) for (let x = 0; x < g.sx; x++) { const v = g.get(x, y, z); if (v && (col === undefined || (v & 0xffffff) === col)) lo = Math.min(lo, y - g.oy); } return lo; };
  const robeLo = lowest(robe, 'body'), coatLo = lowest(coat, 'body'), plainLo = lowest(Folk.look(7, 'crafter', 'adult'), 'body');
  check(robeLo < coatLo && coatLo < plainLo, `the robe reaches lower than the coat, the coat lower than a shirt (lowest body voxel ${robeLo}, ${coatLo}, ${plainLo})`);
  check(lowest(robe, 'body', W.trim) === robeLo, 'the robe has a gold hem');
  const hand = (L) => lowest(L, 'fore_r'), handPlain = lowest(Folk.look(7, 'crafter', 'adult', null), 'fore_r');
  check(hand(bag) < handPlain - 6 && hand(basket) < handPlain - 4, `the bag and the basket hang below the right hand (${hand(bag)}, ${hand(basket)} vs the hand ${handPlain})`);
}

console.log('5. the afternoon');
{
  const P = Vs.prototype, mgr = Object.create(P);
  mgr.time = 1000;
  const cafe = vil9.plan.work.find(w => w.kind === 'cafe');
  check(!!cafe && cafe.seats.length >= 20, `the hall city's café has its tables round the plaza (${cafe ? cafe.seats.length : 0} seats)`);
  const vil = Object.assign({}, vil9, { workOf: {} });
  for (const w of vil.plan.work) { const role = { cafe: 'barista', bakery: 'baker', library: 'scholar', market: 'cashier', hall: 'mayor' }[w.kind]; if (role) (vil.workOf[role] || (vil.workOf[role] = [])).push(w); }
  let terrace = 0, stroll = 0, work = 0, keepers = 0, keepWork = 0;
  for (const p of vil9.people) {
    if (p.age !== 'adult') continue;
    const a = { vil, p, role: p.role, kid: false, elder: false };
    const k = P.schedule.call(mgr, a, 8000);
    if (/baker|scholar|cashier|clerk|barista|mayor|ranger/.test(p.role)) { keepers++; if (k === 'work' || k === 'patrol') keepWork++; continue; }
    if (k === 'terrace') terrace++; else if (k === 'stroll') stroll++; else if (k === 'work') work++;
  }
  console.log(`    at 14:00: ${terrace} at the café's tables, ${stroll} shopping, ${work} at work; ${keepWork} of ${keepers} shopkeepers in their shops`);
  check(terrace >= 5 && stroll >= 5 && keepWork === keepers, 'the grown-ups without a shop sit at the café or go shopping; the shopkeepers keep their shops');
  check(!V.Crowd.INDOOR.terrace, "the terrace is outdoors: its guests count toward the street's budget");
  // in another town the afternoon is as before
  const vilO = Object.assign({}, vil8, { workOf: {} });
  let changed = 0; for (const p of vil8.people) { if (p.age !== 'adult') continue; const a = { vil: vilO, p, role: p.role, kid: false, elder: false }; const k = P.schedule.call(mgr, a, 8000); if (k === 'terrace') changed++; }
  check(changed === 0, 'other towns keep their afternoon');
  // the terrace: a free chair is found and the guest sits down
  const p = vil9.people.find(q => q.age === 'adult' && !/baker|scholar|cashier|clerk|barista|mayor|ranger/.test(q.role));
  const a = { vil: Object.assign(vil, { agents: [] }), p, role: p.role, act: { type: 'terrace', t: 0 }, pose: 'stand', pos: [0, 0, 0] };
  let sat = null; mgr.goTo = () => true; mgr.sit = (ag, spot) => { sat = spot; ag.pose = 'sit'; }; mgr.near = () => false;
  P.runAct.call(mgr, a, 0.1, 8000);
  check(!!sat && cafe.seats.some(s => s[0] === sat[0] && s[2] === sat[2]), 'a guest sits down on one of the café chairs');
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
