// a-builder · the block picker's search (src/main/pickfind.js, VR.PickFind — pure, no DOM):
//  (a) folding: case, umlauts (ä → ae, ß → ss), accents, '_' as a space
//  (b) ranking: a whole word before a word start before a substring before a loose subsequence; every word of the query
//      must match; shorter names first among equals; the plain block before its slab and stairs
//  (c) both languages: the German name, the English name and the id are all searched
//  (d) families: wood, stone, brick, glass, metal, plant, light, ground for the registry's real blocks; colours by word
//  (e) the recent list: newest first, no doubles, capped
//  (f) speed: the index of every creative block and item is built, and a search over it, in a few milliseconds
// usage: node test/pickfind.js
const ROOT = require('path').join(__dirname, '..');
const VR = require(ROOT + '/test/load_shared.js');
require(ROOT + '/src/main/pickfind.js');
const PF = VR.PickFind, R = VR.R;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
if (!PF) { console.log('  ✗ VR.PickFind exists'); console.log('FAILED 1'); process.exit(1); }

// (a)
check(PF.fold('Ziegelstein-Treppe') === 'ziegelstein-treppe', 'lower case');
check(PF.fold('Weiße Türen') === 'weisse tueren', `umlauts and ß folded (${PF.fold('Weiße Türen')})`);
check(PF.fold('oak_planks') === 'oak planks', 'an id reads as words');
check(PF.fold('Café') === 'cafe', 'accents dropped');

// (b) a small catalogue: names in German, the English display, the id
const CAT = {
  oak_planks: ['Eichenbretter', 'Oak Planks'], oak_slab: ['Eichenstufe', 'Oak Slab'], oak_stairs: ['Eichentreppe', 'Oak Stairs'],
  dark_oak_planks: ['Dunkle Eichenbretter', 'Dark Oak Planks'], stone_bricks: ['Steinziegel', 'Stone Bricks'], bricks: ['Ziegel', 'Bricks'],
  brick_stairs: ['Ziegeltreppe', 'Brick Stairs'], glass: ['Glas', 'Glass'], white_wool: ['Weiße Wolle', 'White Wool'], cobblestone: ['Bruchstein', 'Cobblestone'],
  lantern: ['Laterne', 'Lantern'], stone: ['Stein', 'Stone'],
};
const names = (id) => CAT[id] || [id];
const ids = Object.keys(CAT);
const S = (q) => PF.search(ids, q, names, 50);
check(S('ziegel')[0] === 'bricks', `„ziegel": Ziegel first (${S('ziegel').slice(0, 3)})`);
check(S('ziegel').includes('stone_bricks') && S('ziegel').includes('brick_stairs'), 'and the Steinziegel and the Ziegeltreppe after it');
check(S('stein')[0] === 'stone', `„stein": Stein first (${S('stein').slice(0, 3)})`);
check(S('oak')[0] === 'oak_planks' && S('oak').indexOf('oak_planks') < S('oak').indexOf('oak_slab'), `„oak": the planks before the slab (${S('oak').slice(0, 4)})`);
check(S('dark oak')[0] === 'dark_oak_planks' && S('dark oak').length === 1, 'two words: both must match');
check(S('weisse')[0] === 'white_wool' && S('weiße')[0] === 'white_wool' && S('WEISSE wolle')[0] === 'white_wool', 'the umlaut and ß typed either way');
check(S('eichtrp')[0] === 'oak_stairs', `a loose subsequence still finds (${S('eichtrp')})`);
check(S('xyzzy').length === 0, 'nothing for nonsense');
check(S('').length === ids.length, 'an empty query lists everything');
check(S('glas')[0] === 'glass', 'a word start: glas → Glas');

// (c) both languages
check(S('lantern')[0] === 'lantern' && S('laterne')[0] === 'lantern', 'the English and the German name');
check(S('cobble')[0] === 'cobblestone' && S('bruch')[0] === 'cobblestone', 'the id and the German name');

// (d) families on the real registry
const fam = (id) => PF.familyOf(id, R.byName[id] ? R.T.emit[R.byName[id].defaultState] : 0);
const want = { oak_planks: 'wood', spruce_log: 'wood', stone_bricks: 'brick', bricks: 'brick', cobblestone: 'stone', granite: 'stone', glass: 'glass', iron_block: 'metal', copper_grate: 'metal', oak_leaves: 'plant', dirt: 'ground', sand: 'ground' };
for (const id in want) if (R.byName[id]) check(fam(id) === want[id], `${id} → ${want[id]} (${fam(id)})`);
const lamp = R.types.find(t => t.cat && t.name.indexOf('lantern') >= 0) || R.types.find(t => t.cat && /lamp/.test(t.name));
if (lamp) check(fam(lamp.name) === 'light', `${lamp.name} → light (${fam(lamp.name)})`);
check(PF.FAMILIES.length === 8 && PF.FAMILIES.every(f => f.id && f.icon && f.de && f.en), 'eight families, each with an icon and both names');
check(PF.colourOf('light_blue_wool') === 'light_blue' && PF.colourOf('red_concrete') === 'red' && PF.colourOf('oak_planks') === null, 'colours by word (light_blue before blue)');
check(PF.COLOURS.length === 16 && PF.COLOURS.every(c => /^#[0-9a-f]{6}$/.test(c.hex) && c.de && c.en), 'sixteen colours with a dot and both names');
const all = [];
for (const t of R.types) if (t.cat && !t.o.noItem) all.push(t.name);
const famN = {}; for (const id of all) { const f = fam(id); famN[f] = (famN[f] || 0) + 1; }
check(PF.FAMILIES.every(f => famN[f.id] >= 10), `every family has ≥ 10 blocks (${JSON.stringify(famN)})`);
const reds = all.filter(id => PF.colourOf(id) === 'red');
check(reds.length >= 5, `the red ones: ${reds.length}`);
const fRes = PF.filter(all, { family: 'glass' }, (id) => R.T.emit[R.byName[id].defaultState]);
check(fRes.length >= 10 && fRes.every(id => fam(id) === 'glass'), `filter by family: ${fRes.length} glass`);

// (e) the recent list
let rec = [];
for (const id of ['a', 'b', 'c', 'a', 'd']) rec = PF.pushRecent(rec, id, 3);
check(JSON.stringify(rec) === '["d","a","c"]', `newest first, no doubles, capped at 3 (${JSON.stringify(rec)})`);
check(JSON.stringify(PF.pushRecent(rec, '', 3)) === JSON.stringify(rec), 'an empty id changes nothing');

// (f) speed on the real catalogue (English display names and the id)
const nm = (id) => { const t = R.byName[id]; return [t && t.display ? t.display : id]; };
const t0 = process.hrtime.bigint();
const idx = PF.index(all, nm);
const t1 = process.hrtime.bigint();
let r1; for (let i = 0; i < 10; i++) r1 = PF.searchIndex(idx, 'stone brick stairs', 100);
const t2 = process.hrtime.bigint();
const msIdx = Number(t1 - t0) / 1e6, msQ = Number(t2 - t1) / 1e7;
check(r1[0] === 'stone_brick_stairs', `the real catalogue: „stone brick stairs" → ${r1[0]}`);
check(msIdx < 150 && msQ < 15, `(built once, in idle time) the index ${msIdx.toFixed(1)} ms (${all.length} blocks), a search ${msQ.toFixed(2)} ms`);

console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);
