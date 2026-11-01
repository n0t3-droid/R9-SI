// u-gossip — news travels and the world remembers you (src/main/gossip.js, src/main/citylife.js; plan
// docs/superpowers/plans/2026-11-02-u-gossip.md). Deterministic game rules, no language model, no network:
//  1. the stream: importance per kind, the fading weight, the cap (the weakest goes), one deed per key
//  2. diffusion: witnesses at once, the next village (≈ 700 m) in about a day, farther later, small deeds stay close,
//     over the Lichtbrücke the great ones reach another world a day later
//  3. greetings match the deeds, once per person and deed (no repeats), the village-wide moments once, the reflection
//  4. friends: levels, a point a talk a day, invitations and visits by the day (fixed), the gift's record
//  5. the save: round trip, an old save, a damaged one, a newer one kept as it is
//  6. Palmenhafen: the townsfolk by tier (Very Low bounded), their day and night, the real city's roster grows, their
//     walks near the plaza and the middle; no name repeats
//  7. cost: one 2-Hz look over 40 deeds × 120 people; every key in both language tables
//   bash test/wt_run.sh gossip.js 300
const V = require('./load_shared.js');
for (const f of ['i18n', 'lang_en', 'lang_de']) require(__dirname + '/../src/main/' + f + '.js');
require('../src/main/voxmodels.js'); require('../src/main/villagers.js'); require('../src/main/folkmodel.js');
require('../src/main/villages.js'); require('../src/main/folklife.js');
global.document = { getElementById: () => null, querySelector: () => null };   // (the glue loads too: CityLife.populate)
require('../src/main/gossip.js'); require('../src/main/citylife.js');
const G = V.Gossip, CL = V.CityLife, D = G.DAY;
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };

console.log('1 · the stream');
const rec = G.fresh();
const dF = G.note(rec, 'freed', { t: 2 * D, x: 0, z: 0, pl: 'Nordwiese', key: 'o1' });
check(dF && dF.imp === 9 && dF.k === 'freed', 'freeing an outpost is the weightiest deed (9)');
check(G.note(rec, 'freed', { t: 3 * D, x: 0, z: 0, key: 'o1' }) === null, 'the same outpost counts once');
check(G.KINDS.gift.imp < G.KINDS.helped.imp && G.KINDS.helped.imp < G.KINDS.home.imp && G.KINDS.home.imp < G.KINDS.fairy.imp, 'gift < helped < home < fairy < freed');
check(Math.abs(G.score(dF, 2 * D) - 9) < 1e-9 && G.score(dF, 16 * D) < 4.6 && G.score(dF, 16 * D) > 4.4, `it fades: half after 14 days (${G.score(dF, 16 * D).toFixed(2)})`);
{ const r = G.fresh(); for (let i = 0; i < 50; i++) G.note(r, i === 3 ? 'freed' : 'gift', { t: i * 100, x: i, z: 0, key: 'k' + i }); check(r.deeds.length === G.MAXD && r.deeds.some(d => d.k === 'freed'), `capped at ${G.MAXD}, the weakest go, the freed beacon stays`); }

console.log('2 · diffusion');
const here = { id: 'a', x: 60, z: 40, dim: 'overworld' }, next = { id: 'b', x: 700, z: 120, dim: 'overworld' }, far = { id: 'c', x: 2600, z: -300, dim: 'overworld' }, moon = { id: 'm', x: 0, z: 0, dim: 'opal' };
const tH = G.heardAt(dF, here), tN = G.heardAt(dF, next), tF = G.heardAt(dF, far), tM = G.heardAt(dF, moon);
check(tH === dF.t, 'the people beside it saw it at once');
check((tN - dF.t) / D > 0.6 && (tN - dF.t) / D < 1.3, `the next village (${Math.round(Math.hypot(700, 120))} m) hears in ${((tN - dF.t) / D).toFixed(2)} days (0.6–1.3)`);
check(tF > tN && (tF - dF.t) / D < 4, `a far village (2.6 km) later: ${((tF - dF.t) / D).toFixed(2)} days`);
check(tM > dF.t + D && tM < dF.t + 1.5 * D, `over the Lichtbrücke to another world a day later (${((tM - dF.t) / D).toFixed(2)})`);
const dG = G.note(rec, 'gift', { t: 4 * D, x: 0, z: 0, pl: 'Saatwiese', key: 'g1' });
check(G.heardAt(dG, far) === Infinity && G.heardAt(dG, moon) === Infinity && G.heardAt(dG, { id: 'n', x: 300, z: 0 }) < Infinity, 'a gift stays close (300 m yes, 2.6 km no, no other world)');
check(G.heardAt(dF, next) === G.heardAt(JSON.parse(JSON.stringify(dF)), next), 'the same deed and place → the same day (fixed)');
check(G.heard(rec, next, dF.t + 0.3 * D).length === 0 && G.heard(rec, next, tN + 1).some(d => d.id === dF.id), 'the next village knows nothing before, the beacon after');
check(G.heard(rec, next, dF.t + 120 * D).length === 0, 'after months it is forgotten (faded)');

console.log('3 · greetings, once');
const pid = 'overworld/b:3:0';
const g1 = G.greetFor(rec, pid, next, tN + 10);
check(g1 && g1.id === dF.id, 'a stranger in the next village greets you by the beacon');
const key = G.lineKey('greet', g1.k, 7), line = V.I18N.tx(key, { name: 'Mila', o: g1.pl }, '', '');
check(/Leuchtfeuer/.test(V.I18N.dict.de[key]) && /\{o\}/.test(V.I18N.dict.de[key]), `the words match the deed: „${V.I18N.dict.de[key].replace('{o}', 'Nordwiese').replace('{name}', 'Mila')}“`);
void line;
G.markGreeted(rec, pid, g1.id);
check(G.greetFor(rec, pid, next, tN + 20) === null, 'the same person never greets you by it again (the gift did not reach them)');
check(G.greetFor(rec, 'overworld/b:4:0', next, tN + 20).id === dF.id, 'a neighbour still may, once');
check(G.once(rec, 'b', 'tell', dF.id) === true && G.once(rec, 'b', 'tell', dF.id) === false && G.wasTold(rec, 'b', 'tell', dF.id), 'the neighbours pass it on once per village and deed');
const atHere = dG.t + 10;
check(G.reflect(rec, here, atHere) === 'freed', 'the reflection: what most of what they heard is of (the beacon)');
check(G.reflect(rec, next, tN + 10) === null, 'one deed alone is no reflection');
let noRep = true; { const r = G.fresh(); const d = G.note(r, 'helped', { t: 0, x: 0, z: 0, key: 'x' }); const seen = new Set(); for (let i = 0; i < 50; i++) { const q = G.greetFor(r, 'p' + (i % 5), here, 100); if (q) { const k = 'p' + (i % 5) + q.id; if (seen.has(k)) noRep = false; seen.add(k); G.markGreeted(r, 'p' + (i % 5), q.id); } } check(noRep && seen.size === 5 && d, `50 meetings with 5 people: 5 greetings, no repeat`); }

console.log('4 · friends');
{
  const r = G.fresh();
  check(G.befriend(r, 'p', 3, { name: 'Ole', sur: 'Brink', vid: 'v', vn: 'Saatwiese', likes: 'bread' }).lvl === 0, 'a gift alone: not yet acquainted');
  check(G.talked(r, 'p', 5).up === true && G.level(r.fr.p.p) === 1, 'a talk the same day: acquainted (Bekannt)');
  check(G.talked(r, 'p', 5) === null, 'a second talk that day gives nothing');
  G.befriend(r, 'p', 6); check(G.level(r.fr.p.p) === 2, 'a request done → friend');
  G.befriend(r, 'p', 50); check(G.level(r.fr.p.p) === 3 && r.fr.p.p === 60, 'close friend, capped at 60');
  let inv = 0, vis = 0; for (let d = 0; d < 30; d++) { if (G.invites(r, 'p', d)) inv++; if (G.visitor(r, d)) vis++; }
  check(inv >= 8 && inv <= 22, `invitations on about every other day (${inv} of 30)`);
  check(vis >= 4 && vis <= 18, `visits on about every third day (${vis} of 30)`);
  r.last.visitDay = 3; check(G.visitor(r, 3) === null, 'one visit a day at most');
  check(G.invites(G.fresh(), 'p', 2) === false, 'a stranger does not invite you');
}

console.log('5 · the save');
{
  const back = G.load(JSON.parse(JSON.stringify(G.save(rec))));
  check(JSON.stringify(back) === JSON.stringify(rec), 'round trip: the record comes back the same');
  check(JSON.stringify(G.load(undefined)) === JSON.stringify(G.fresh()), 'an old save without one → fresh');
  const bad = G.load({ v: 1, deeds: [{ k: 'nope', t: 1, x: 0, z: 0 }, { k: 'gift', t: 'x' }, null, { k: 'fest', t: 5, x: 1, z: 2 }], greeted: { a: 'x', b: [1, 2] }, fr: { q: { p: 'no' }, r: { p: 4 } } });
  check(bad.deeds.length === 1 && bad.deeds[0].k === 'fest' && !bad.greeted.a && bad.greeted.b.length === 2 && !bad.fr.q && bad.fr.r.p === 4, 'a damaged record keeps what is valid');
  const newer = { v: 9, future: true }; check(G.load(newer) === newer, 'a newer save\'s record stays as it is');
}

console.log('6 · Palmenhafen');
{
  check(CL.count(0) === 6 && CL.count(1) === 10 && CL.count(3) === 22 && CL.count(9) === 26, 'townsfolk by tier: Very Low 6 · Low 10 · High 22 · Ultra 26');
  const pl = CL.plan({ seed: 77 }, 11, 3);
  check(pl.filter(q => q.kind === 'vendor').length === 3 && pl.some(q => q.kind === 'owl') && pl.some(q => q.kind === 'kid'), 'High: three vendors, children, night owls and strollers');
  check(JSON.stringify(CL.plan({ seed: 77 }, 11, 3)) === JSON.stringify(pl), 'the same city → the same townsfolk');
  check(CL.schedule('vendor', 1, 3000) === 'vend' && CL.schedule('vendor', 1, 12000) === 'home', 'vendors at their spot by day, home at dusk');
  let owls = 0, out = 0; for (let s = 0; s < 40; s++) { if (CL.schedule('owl', s, 14000) === 'stroll') owls++; if (CL.schedule('stroll', s, 14000) !== 'home') out++; }
  check(owls === 40 && out === 0, 'at night the owls walk the lit streets, the others are home');
  check(CL.schedule('stroll', 8, 3500) !== 'home' && CL.schedule('kid', 3, 3000) === null, 'by day the strollers are out, the children play (their village games)');
  // the real city
  const VG = V.VillageGen, g = V.makeGen('overworld', 4242, { vgen: 14 }), site = VG.sitesFor(g, 0, -9).find(x => x.home), P = VG.plan(g, site);
  check(CL.isCity(P), `the home city is Nova Haven's plan (${P.homes.length} homes)`);
  for (const [preset, tier] of [['potato', 0], ['high', 3]]) {
    const vil = { id: P.id, plan: P, st: { built: [], custom: [] } };
    V.Villages.makeRoster(vil);
    const n0 = vil.people.length;
    V.LifeKit = V.LifeKit || { tierOf: (S) => ({ potato: 0, low: 1, balanced: 2, high: 3, ultra: 4 }[S.preset]) };
    CL.populate({ g: { settings: { preset } } }, vil);
    const n1 = vil.people.length, names = new Set(vil.people.map(q => q.name + ' ' + vil.fams[q.fam].surname));
    check(n1 - n0 === CL.count(tier) && vil.town.every(m => m.look && m.home !== undefined), `${preset}: ${n0} residents + ${n1 - n0} townsfolk, all dressed and housed`);
    check(names.size === n1, `${preset}: no two people share a name (${names.size})`);
    const pz = P.plaza, c = P.center;
    check(vil.townPts.length > 20 && vil.townPts.every(q => Math.hypot(q[0] - pz.x, q[2] - pz.z) < 46 || Math.hypot(q[0] - c[0], q[2] - c[2]) < 40), `${preset}: their walks stay near the plaza and the middle (${vil.townPts.length} road points)`);
  }
  check(!CL.isCity({ style: 'cottage', homes: [1] }), 'other villages get no townsfolk');
}

console.log('7 · cost and words');
{
  const r = G.fresh(); for (let i = 0; i < 40; i++) G.note(r, ['freed', 'gift', 'home', 'fest', 'helped', 'fairy'][i % 6], { t: i * 500, x: i * 37, z: -i * 11, key: 'c' + i });
  const t0 = process.hrtime.bigint(); let n = 0;
  for (let k = 0; k < 200; k++) { const H = G.heard(r, { id: 'v' + (k % 4), x: 200, z: 50 }, 40 * 500); for (let a = 0; a < 120; a++) if (G.greetFor(r, 'p' + a, { id: 'v' + (k % 4), x: 200, z: 50 }, 40 * 500)) n++; void H; }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 200;
  check(ms < 1.5, `one look (40 deeds × 120 people, the worst case) ${ms.toFixed(3)} ms at 2 Hz → ${(ms / 30).toFixed(4)} ms a frame`);
  const de = V.I18N.dict.de, en = V.I18N.dict.en, miss = [...G.KEYS, ...CL.KEYS].filter(k => !de[k] || !en[k]);
  check(!miss.length, `every key in both tables (${G.KEYS.length + CL.KEYS.length})${miss.length ? ' missing ' + miss.slice(0, 4).join(', ') : ''}`);
}
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);
