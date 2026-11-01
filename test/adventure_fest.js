// a-adventure (R56-02): das Fest am Leuchtfeuer (src/main/liberate_fest.js) — what freeing an outpost gives, without a
// browser:
//   1. the goal: the machines resolved of all and the next step (calm → beacon); none once freed
//   2. how it was freed: peace (all calmed), brave (none), both
//   3. the chest's place: beside the beacon, on a floor, never in a wall; none when walled in
//   4. the next goal: the nearest other disturbed outpost (60–1500 m), else the nearest unvisited village; the compass word
//   5. the glue: L.beat's banner places the chest once (its block entity with the outpost loot), writes the page, the end
//      points the next goal after 1.5 s (Funke's line names it with its distance and direction), the cheer waits for the
//      village; the journal shows the page; every text in both tables
// usage: bash test/wt_run.sh adventure_fest.js 300
const fs = require('fs'), path = require('path');
require('./dom_stub.js');
const V = require('./load_shared.js');
const SRC = path.join(__dirname, '../src/main/');
for (const f of ['i18n', 'lang_en', 'lang_de', 'voxmodels', 'quests', 'foemodels', 'foes', 'liberate', 'liberate_fest']) if (fs.existsSync(SRC + f + '.js')) require(SRC + f + '.js');
const LF = V.LibFest, L = V.Liberate, R = V.R;
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
if (!LF) { console.log('  ✗ VR.LibFest missing'); console.log('FAILED 1'); process.exit(1); }

console.log('1 · the goal');
check(LF.goalOf({ st: 'stoer', strays: 3, res: 1 }).step === 'calm' && LF.goalOf({ st: 'stoer', strays: 3, res: 1 }).n === 1, '1 of 3 resolved: calm the others');
check(LF.goalOf({ st: 'stoer', strays: 3, res: 3 }).step === 'beacon', 'all resolved: the beacon');
check(LF.goalOf({ st: 'frei', strays: 3, res: 3 }) === null, 'freed: no goal');
check(LF.goalOf({ st: 'stoer', strays: null, res: 0 }).of === null, 'not yet counted: of unknown');
console.log('2 · how it was freed');
check(LF.howOf({ strays: 3, cal: 3 }) === 'peace' && LF.howOf({ strays: 3, cal: 0 }) === 'brave' && LF.howOf({ strays: 3, cal: 1 }) === 'both', 'peace · brave · both');
console.log('3 · the chest');
{
  const W = new Map(), key = (x, y, z) => x + ',' + y + ',' + z, get = (x, y, z) => (y <= 64 ? 1 : W.get(key(x, y, z)) || 0), solid = (b) => b === 1;
  const q = LF.chestSpot(get, solid, [10, 65, 10]);
  check(q && Math.hypot(q[0] - 10, q[2] - 10) >= 1.9 && q[1] === 65, `beside the beacon on the floor (${q})`);
  for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2], [2, 2], [-2, 2], [2, -2], [-2, -2]]) for (const y of [64, 65, 66, 67]) W.set(key(10 + dx, y, 10 + dz), 2);
  check(LF.chestSpot(get, solid, [10, 65, 10]) === null, 'walled in: no chest');
}
console.log('4 · the next goal');
{
  const sites = [{ id: 'a', x: 0, z: 0, st: 'frei' }, { id: 'b', x: 300, z: 0, st: 'stoer' }, { id: 'c', x: 0, z: -900, st: 'stoer' }, { id: 'd', x: 20, z: 0, st: 'stoer' }];
  const n = LF.nextOf(sites, [{ x: 100, z: 0, visited: false }], [0, 64, 0], sites[0]);
  check(n && n.ref.id === 'b', `the nearest other disturbed outpost beyond 60 m (${n && n.ref.id})`);
  const v = LF.nextOf([sites[0]], [{ x: 100, z: 0, visited: true }, { x: 0, z: 400, visited: false, name: 'Lindenau' }], [0, 64, 0], sites[0]);
  check(v && v.kind === 'vil' && v.ref.name === 'Lindenau', 'no outpost: the nearest unvisited village');
  check(LF.dirOf(0, -5) === 'n' && LF.dirOf(5, 0) === 'o' && LF.dirOf(0, 5) === 's' && LF.dirOf(-5, -5) === 'nw', 'the compass words (north is −z)');
}
console.log('5 · the glue');
{
  // a stand-in world: grass at 64, the beacon on the pad at 65
  const blocks = new Map(), bes = new Map(), key = (x, y, z) => x + ',' + y + ',' + z, GR = R.byName.grass_block.defaultState;
  const world = { getBlock: (x, y, z) => (y <= 64 ? GR : blocks.get(key(x, y, z)) || 0), setBlock: (x, y, z, s) => blocks.set(key(x, y, z), s), col: () => ({ blockEntities: bes }), isLoaded: () => true, topAt: () => 64 };
  const hints = [], says = [];
  const g = { time: 100, env: { day: 4 }, world, player: { pos: [0, 65, 0] }, ui: { hint: (t) => hints.push(t) }, funke: { on: () => true, show: (t) => says.push(t) }, villages: { sites: [{ id: 'v1', x: 120, z: 30, name: 'Lindenau' }], known: new Map(), agents: [], joyReact: () => { g.clapped = true; } } };
  V.Adventure = V.Adventure || {}; V.Adventure.rec = { on: true };
  const s = { id: '0_0', x: 0, y: 64, z: 0, beacon: [3, 65, 3], st: 'frei', strays: 3, res: 3, cal: 3, known: true };
  const origSet = setTimeout; global.setTimeout = () => 0;
  L.beat(g, s, 'banner');
  const chest = [...blocks.entries()].find(([, v]) => R.T.type[v] === R.byName.chest.id), be = [...bes.values()][0];
  check(!!chest, `a chest beside the beacon (${chest && chest[0]})`);
  check(be && be.type === 'chest' && be.loot === 'outpost', 'its block entity: the outpost loot');
  const P = LF.pages()['0_0']; check(P && P.how === 'peace' && P.day === 4, 'the Wanderbuch page: day 4, peace');
  L.beat(g, s, 'banner'); check([...blocks.values()].filter(v => R.T.type[v] === R.byName.chest.id).length === 1, 'the chest only once');
  L.beat(g, s, 'end'); check(LF.nextAt === 101.5, 'the end: the next goal in 1.5 s');
  // the next: an outpost 400 m east
  L.sites().set('400_0', Object.assign(L.site({ x: 400, y: 64, z: 0, dir: 0 }), { id: '400_0', st: 'stoer' }));
  const n = LF.pointNext(g, s);
  check(n && n.kind === 'out' && says.some(t => /400 m/.test(t) && /Osten|east/.test(t)), `Funke names it: „${says[says.length - 1]}"`);
  check(says.some(t => /Truhe|chest/.test(t)), 'and the chest');
  // the cheer: two people round the player in Lindenau
  check(LF.cheer && LF.cheer.id === 'v1', 'Lindenau heard of it');
  g.player.pos = [120, 65, 30]; g.villages.agents = [{ pos: [122, 65, 30] }, { pos: [118, 65, 33] }];
  LF.lookCheer(g); check(g.clapped && !LF.cheer && says.some(t => /Lindenau/.test(t)), 'among its people they clap, Funke says why');
  global.setTimeout = origSet;
  const Q = V.Quests, sec = Q && Q.journalSections ? Q.journalSections.map(f => { try { return f() || ''; } catch (e) { return ''; } }).join('') : '';
  check(/Leuchtfeuer-Seiten|Beacon pages/.test(sec), 'the journal shows the pages');
}
{
  const de = V.LANG_DE || (V.I18N && V.I18N.tables && V.I18N.tables.de), en = V.LANG_EN || (V.I18N && V.I18N.tables && V.I18N.tables.en);
  const src = fs.readFileSync(SRC + 'liberate_fest.js', 'utf8'), keys = new Set([...src.matchAll(/'(g\.lf\.[a-zA-Z.]+)'/g)].map(m => m[1]));
  for (const d of LF.DIRS) keys.add('g.lf.dir.' + d); for (const h of ['peace', 'brave', 'both']) keys.add('g.lf.how.' + h); keys.delete('g.lf.dir.'); keys.delete('g.lf.how.');
  const t = (lang, k) => { try { V.I18N.set(lang); return V.I18N.t(k); } catch (e) { return k; } };
  const miss = [...keys].filter(k => t('de', k) === k || t('en', k) === k);
  check(miss.length === 0, `every text in both tables (${keys.size} keys${miss.length ? '; missing ' + miss.join(', ') : ''})`);
  void de; void en;
}
console.log('6 · the story in an Abenteuer world that starts in the wild (R56-02: 0 story beats in 300 s)');
{
  if (!V.Story || !V.Story.BEATS) require('../src/shared/story.js');
  const St = V.Story, b = St && St.BEATS && St.BEATS[0], base = { calm: 30, place: 'wild', dim: 'overworld' };
  check(!!b && St.why(b, Object.assign({ adv: true, played: 45 }, base), { done: {}, later: {}, acts: {} }) !== 'place', 'an adventurer in the wild: chapter 1 after 40 s');
  check(!!b && St.why(b, Object.assign({ adv: true, played: 30 }, base), { done: {}, later: {}, acts: {} }) === 'place', 'not before');
  check(!!b && St.why(b, Object.assign({ adv: false, played: 45 }, base), { done: {}, later: {}, acts: {} }) === 'place', 'a builder\'s world: the Hangar Hall or 240 s, as before');
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(0);
