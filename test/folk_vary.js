// a-adventure (R56-07, docs/reviews/v0.55.md): „the same straw-hat green shirt and the same blue child in every picture".
// The villagers of a village dress by family, trade, age and season (villagers.js Folk.vary, run by makeRoster):
//   1. a real village (seed 4242): ≥ 5 distinct outfits (clothes + hat) among the first 8 people, ≥ 6 in the village;
//      the straw hat on ≤ 40 % of the farmers, green shirts on ≤ 30 % of the grown-ups
//   2. the families: a household's grown-ups and children share a palette family (a hue they have in common)
//   3. the children: ≥ 4 different outfits among the village's children, dresses, overalls and hats among them
//   4. the season: winter brings scarves and woollen hats (≥ 30 % of the people), summer none of the scarves
//   5. the same village dresses the same way every time; the Weißstadt and the natives keep their own clothes
//   6. the rigs: a hat, an apron and a scarf chosen this way build on both paths (voxel and smooth), and a scarf adds voxels
// usage: bash test/wt_run.sh folk_vary.js 300
const V = require('./load_shared.js');
require('../src/shared/smoothvox.js'); require('../src/shared/folksmooth.js');
require('../src/main/voxmodels.js'); require('../src/main/villagers.js'); require('../src/main/folkmodel.js');
require('../src/main/villages.js'); require('../src/main/folklife.js'); try { require('../src/main/worldlife.js'); } catch (e) { /* the natives' looks */ }
const VG = V.VillageGen, Folk = V.Folk, Vs = V.Villages;
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const dressKey = (L) => Folk.outfitKey(L) + ':' + (L.age === 'child' ? L.kidHat : L.hat !== undefined ? L.hat : (Folk.ROLES[L.role] || {}).hat) + ':' + (L.scarf | 0) + ':' + (L.acc || '');
const green = (c) => { const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255; return g > r + 18 && g > b + 18; };

const gen = new V.OverworldGen(4242, { worldType: 'default' });
let vil = null;
for (let k = 0; k < 40 && !vil; k++) {
  const s = VG.site(gen, (k % 7) - 3, Math.floor(k / 7) - 3); if (!s) continue;
  const plan = VG.summary(VG.plan(gen, s)); if (!plan || plan.style === 'hall' || !plan.homes || plan.homes.length < 5) continue;
  vil = { plan, st: {} };
}
const roster = (season) => { Folk.SEASON = season; const v = { plan: vil.plan, st: {} }; Vs.makeRoster(v); return v; };
console.log('1. a village of seed 4242 (' + (vil ? vil.plan.style + ', ' + vil.plan.homes.length + ' homes' : 'none') + ')');
check(!!vil, 'a village that is not the Weißstadt');
if (vil) {
  const v = roster(1), P = v.people;
  const first8 = new Set(P.slice(0, 8).map(m => dressKey(m.look))), all = new Set(P.map(m => dressKey(m.look)));
  check(first8.size >= 5, `${first8.size} distinct outfits among the first 8 people (≥ 5)`);
  check(all.size >= Math.min(6, P.length), `${all.size} distinct outfits among the ${P.length} villagers`);
  const farmers = P.filter(m => m.role === 'farmer' && m.age === 'adult'), straw = farmers.filter(m => (m.look.hat !== undefined ? m.look.hat : 'straw') === 'straw').length;
  check(!farmers.length || straw / farmers.length <= 0.4, `the straw hat on ${straw} of ${farmers.length} farmers (≤ 40 %)`);
  const adults = P.filter(m => m.age !== 'child' && !m.look.garb), gr = adults.filter(m => green(m.look.dress ? m.look.dressCol : m.look.shirt)).length;
  check(gr / Math.max(1, adults.length) <= 0.3, `green shirts on ${gr} of ${adults.length} grown-ups (≤ 30 %)`);
  const hats = new Set(P.filter(m => m.age === 'adult').map(m => String(m.look.hat !== undefined ? m.look.hat : Folk.ROLES[m.role].hat)));
  check(hats.size >= 4, `${hats.size} kinds of hat (or none) among the grown-ups: ${[...hats].join(', ')}`);

  console.log('2. the families');
  let shared = 0, fams = 0;
  for (const f of v.fams) { if (f.members.length < 2) continue; fams++; const pf = f.members.map(m => m.look.pal); if (pf.every(q => q !== undefined && q === pf[0])) shared++; }
  check(fams > 0 && shared === fams, `every household shares a palette family (${shared} of ${fams})`);
  const famPal = new Set(v.fams.map(f => f.members[0].look.pal));
  check(famPal.size >= Math.min(4, v.fams.length), `${famPal.size} palette families in ${v.fams.length} households`);

  console.log('3. the children');
  const kids = P.filter(m => m.age === 'child'), kk = new Set(kids.map(m => dressKey(m.look))); if (process.env.DBG) console.log([...kk]);
  check(kids.length < 3 || kk.size >= Math.min(4, kids.length), `${kk.size} outfits among ${kids.length} children`);
  const blue = kids.filter(m => m.look.shirt === 0x4A8AE8 && !m.look.dress).length;
  check(blue <= Math.max(1, kids.length * 0.25), `the same blue shirt on ${blue} of ${kids.length} children`);
  const Kall = []; for (let s = 1; s < 200; s++) Kall.push(Folk.vary1(Folk.look(s, 'child', 'child', null), { pal: s % 7, season: 2, seed: s }));
  check(Kall.some(L => L.dress) && Kall.some(L => L.kidAcc === 'overalls') && new Set(Kall.map(L => L.kidHat)).size >= 4, 'children wear dresses, overalls and ≥ 4 kinds of hat (or none)');

  console.log('4. the season');
  const W = roster(3).people, S = roster(1).people;
  const warm = W.filter(m => m.look.scarf || m.look.kidHat === 'beanie' || m.look.hat === 'beanie').length;
  check(warm / W.length >= 0.3, `winter: ${warm} of ${W.length} in a scarf or a woollen hat (≥ 30 %)`);
  check(S.filter(m => m.look.scarf).length === 0, `summer: no scarf (${S.filter(m => m.look.scarf).length})`);

  console.log('5. the same every time; the Weißstadt and the natives keep theirs');
  const a = roster(1).people.map(m => dressKey(m.look)).join('|'), b = roster(1).people.map(m => dressKey(m.look)).join('|');
  check(a === b, 'the same village and season dress the same way twice');
  const h = Folk.look(77, 'farmer', 'adult', null, 'hall'), h2 = Folk.vary1(Object.assign({}, h), { pal: 2, season: 3, seed: 77 });
  check(Folk.lookKey(h) === Folk.lookKey(h2), 'a Weißstadt robe stays as it was');
  const n = Folk.look(77, 'farmer', 'adult', null, 'sp:aqua'), n2 = Folk.vary1(Object.assign({}, n), { pal: 2, season: 3, seed: 77 });
  check(Folk.lookKey(n) === Folk.lookKey(n2), 'a native of another world stays as it was');
}

console.log('6. the rigs');
{
  const base = Folk.look(5, 'farmer', 'adult', null);
  const plain = Object.assign({}, base, { hat: null, acc: 'apron2' }), scarf = Object.assign({}, plain, { scarf: 0xC0443A });
  let ok = true, nv = (m) => { let n = 0; for (const k in m.parts) { const g = m.parts[k].grid; if (g && g.c) for (const x of g.c) if (x) n++; } return n; };
  let a = 0, b = 0, fa = 0, fb = 0;
  try { a = nv(Folk.buildHiRes(plain)); b = nv(Folk.buildHiRes(scarf)); fa = nv(Folk.buildFine(plain)); fb = nv(Folk.buildFine(scarf)); } catch (e) { ok = false; console.log('   ' + (e && e.stack || e).toString().split('\n').slice(0, 3).join(' | ')); }
  check(ok, 'a farmer without the straw hat, in an apron and a scarf builds on both paths');
  check(b > a && fb > fa, `the scarf adds voxels (voxel ${a} → ${b}, smooth ${fa} → ${fb})`);
  check(Folk.lookKey(plain) !== Folk.lookKey(scarf) && Folk.lookKey(plain) !== Folk.lookKey(base), 'hat, apron and scarf are in the look\'s key (the models\' cache)');
  check(Folk.familyOf(plain) === 'apron', `the apron chosen is the outfit family (${Folk.familyOf(plain)})`);
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
