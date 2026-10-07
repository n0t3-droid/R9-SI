// v0.39 📦 r9-paket (VR.Pack, src/main/pack.js): the favourites, the designs and the Werkbank Bauteile travel as ONE
// JSON file between the standalone Studio (its own storage), the Studio in the game and the game's title screen.
// Merge: ★ union (the new ones first, in the file's order), designs: the newer `t` wins (and is counted as replaced),
// Bauteile appended unless an identical one is there. Item ids (blueprint_3) come along; junk does not. A write that
// fails (full storage) is reported, never claimed.
const store = new Map();
globalThis.__full = false;
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { if (globalThis.__full) { const e = new Error('The quota has been exceeded.'); e.name = 'QuotaExceededError'; throw e; } store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
  key: (i) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
  clear: () => store.clear(),
};
require('./load_shared.js');
require('../src/main/favs.js');
require('../src/main/pack.js');
const P = VR.Pack, F = VR.Favs, CU = VR.Custom;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const lib = (id, name, rle) => ({ id, name, t: 1, sx: 2, sy: 1, sz: 1, dy: 0, pal: [0, 'air', ['stone']], rle });
const sofa = Object.keys(VR.R.byName).find(n => /^vm_sofa/.test(n)) || 'stone';

console.log('1 · making a pack');
check(!!P && typeof P.make === 'function' && typeof P.read === 'function' && typeof P.merge === 'function' && typeof P.summary === 'function', 'VR.Pack has make / read / summary / merge');
if (!P) { console.log('FAILED ' + fails); process.exit(1); }
store.clear();
F.add('stone'); F.add('blueprint_3'); F.add(sofa);
CU.save({ v: 1, houses: { 7: { v: 2, name: 'Palais Étoile', index: 7, skin: 'classic', tpl: { box: [1, 1, 0, 0], off: [0, 0], pal: ['keep', 'air', ['stone']], rle: 'AgE=' }, n: 1, t: 100 } }, models: {} });
localStorage.setItem('r9si.library', JSON.stringify({ v: 1, items: [lib('b1', 'Turm', 'AgE=')], t: 1 }));
const pk = P.make('standalone');
check(pk.r9pack === 1 && pk.from === 'standalone' && pk.at > 0, 'r9pack 1, from standalone, a time');
check(pk.favs.join() === [sofa, 'blueprint_3', 'stone'].join(), 'the favourites, newest first (blueprint_3 among them): ' + pk.favs.join(', '));
check(pk.studio && pk.studio.houses && pk.studio.houses[7] && pk.studio.models && Object.keys(pk.studio.models).length === 0, 'the designs from r9si.studio (houses, models)');
check(Array.isArray(pk.lib) && pk.lib.length === 1 && pk.lib[0].name === 'Turm', 'the Werkbank Bauteile from r9si.library');
check(P.fileName(new Date(2026, 9, 3)) === 'r9-paket-2026-10-03.json', 'the file is called r9-paket-YYYY-MM-DD.json');

console.log('2 · reading one');
const rd = P.read(JSON.stringify(pk));
check(rd && rd.favs.length === 3 && rd.studio.houses[7] && rd.lib.length === 1, 'the file\'s text reads back');
check(P.read('kein json') === null && P.read('{"a":1}') === null && P.read('[1,2]') === null, 'anything else is not a pack');
const old = P.read(JSON.stringify({ v: 1, houses: {}, models: { [sofa]: { v: 1, W: 2, H: 1, D: 1, res: 16, pal: [0, 1], rle: 'AQA=', t: 5 } }, favs: ['stone'] }));
check(old && old.studio.models[sofa] && old.favs.join() === 'stone' && old.lib.length === 0, 'the older text export (Crafter → Export) is read too');
const junk = P.read(JSON.stringify({ r9pack: 1, favs: ['stone', 'blueprint_3', '<img src=x>', 42, 'no_such_block_xyz', 'blueprint_99999'], studio: { houses: { x: 'bad', 3: null }, models: { a: 'bad' } }, lib: [{ name: 'kaputt' }, lib('b2', 'Ok', 'AgE=')] }));
check(junk && junk.favs.join() === 'stone,blueprint_3', 'favourites: blocks and items (blueprint_3) stay, junk goes: ' + (junk && junk.favs.join()));
check(junk && !Object.keys(junk.studio.houses).length && !Object.keys(junk.studio.models).length && junk.lib.length === 1, 'broken designs and Bauteile are left out');

console.log('3 · the summary');
const s0 = P.summary({ favs: ['a', 'b', 'c', 'd'], studio: { houses: { 1: {}, 2: {} }, models: { m: {} } }, lib: [1, 2, 3] });
check(s0.text === '4 Favoriten · 2 Häuser · 1 Möbel · 3 Bauteile', 'says what is in it: ' + s0.text);
check(P.summary({ favs: ['a'], studio: { houses: { 1: {} }, models: {} }, lib: [1] }).text === '1 Favorit · 1 Haus · 1 Bauteil', 'singular, and what is not there is not mentioned');

console.log('4 · merging');
store.clear(); F.sync();
F.add('oak_planks'); F.add('stone');          // here: [stone, oak_planks]
CU.save({ v: 1, houses: { 3: { v: 2, index: 3, name: 'Villa Belfronte', tpl: { box: [1, 1, 0, 0], off: [0, 0], pal: ['keep', 'air', ['stone']], rle: 'AgE=' }, t: 100 } }, models: { [sofa]: { v: 1, W: 2, H: 1, D: 1, res: 16, pal: [0, 1], rle: 'AQA=', t: 500 } } });
localStorage.setItem('r9si.library', JSON.stringify({ v: 1, items: [lib('b1', 'Turm', 'AgE=')], t: 1 }));
const inc = P.read(JSON.stringify({ r9pack: 1, at: 9, from: 'standalone',
  favs: ['glass', 'stone', 'blueprint_2'],
  studio: { houses: { 3: { v: 2, index: 3, name: 'Villa Belfronte', tpl: { box: [1, 1, 0, 0], off: [0, 0], pal: ['keep', 'air', ['stone']], rle: 'AQE=' }, t: 200 }, 5: { v: 2, index: 5, name: 'Torre Ocra', tpl: { box: [1, 1, 0, 0], off: [0, 0], pal: ['keep', 'air', ['stone']], rle: 'AAE=' }, t: 50 } }, models: { [sofa]: { v: 1, W: 2, H: 1, D: 1, res: 16, pal: [0, 2], rle: 'AQA=', t: 400 } } },
  lib: [lib('zz', 'Turm (Kopie)', 'AgE='), lib('b1', 'Brücke', 'AwE=')] }));
const r = P.merge(inc);
const fl = F.list();
check(fl.join() === 'glass,blueprint_2,stone,oak_planks', '★ union, the new ones first in the file\'s order: ' + fl.join(', '));
const st = CU.load();
check(st.houses[3].t === 200 && st.houses[3].tpl.rle === 'AQE=' && st.houses[5] && st.models[sofa].t === 500, 'designs: the newer one wins (house 3 from the file, the sofa stays as it is here), house 5 is new');
const libs = JSON.parse(localStorage.getItem('r9si.library')).items;
check(libs.length === 2 && libs[0].name === 'Turm' && libs[1].name === 'Brücke' && libs[1].id !== 'b1', 'Bauteile: the identical one is not doubled, the other is appended (with an id of its own)');
check(r && r.ok === true && r.favs === 2 && r.houses.added === 1 && r.houses.replaced === 1 && r.models.added === 0 && r.models.kept === 1 && r.lib.added === 1 && r.lib.same === 1, 'the result counts it: ' + JSON.stringify(r && { favs: r.favs, houses: r.houses, models: r.models, lib: r.lib }));
check(r && typeof r.text === 'string' && /ersetzt/.test(r.text), 'and says how many designs were replaced: ' + (r && r.text));
check(r && Array.isArray(r.houseIdx) && r.houseIdx.map(String).sort().join() === '3,5' && Array.isArray(r.modelNames) && !r.modelNames.length, 'it names the houses / models that changed (to rebuild them)');
const r2 = P.merge(inc);
check(r2.favs === 0 && r2.houses.added === 0 && r2.houses.replaced === 0 && r2.lib.added === 0, 'the same file twice changes nothing');

console.log('5 · full storage');
globalThis.__full = true;
const r3 = P.merge(P.read(JSON.stringify({ r9pack: 1, favs: ['dirt'], studio: { houses: {}, models: {} }, lib: [] })));
globalThis.__full = false;
check(r3 && r3.ok === false, 'a write that fails is reported (ok: false), not claimed');
check(F.ok === false || F.ok === true, 'VR.Favs says whether its last save worked (F.ok)');
globalThis.__full = true; F.add('sand'); const okAfter = F.ok; globalThis.__full = false;
check(okAfter === false, 'a favourite that could not be stored: F.ok is false');

// ---- v0.39 review: a crafted or broken file never reaches the villa builder, and names cannot carry markup
{
  const bad = JSON.stringify({ r9pack: 1, favs: [], studio: { houses: { 3: { v: 2, index: 3, name: '<img src=x onerror=alert(1)>', tpl: { box: [1, 1, 0, 0], pal: ['keep'], rle: '***not-base64***' } }, 4: { v: 2, index: 4, name: 'ok', tpl: { box: [1, 1, 0, 0], off: [0, 0], pal: ['keep', 'air', ['stone']], rle: 'AgE=' } }, '07': { v: 2, index: 7, skin: 'glas' } }, models: { __proto__: { rle: 'AQA=', pal: [0], W: 1, H: 1, D: 1, res: 16 }, constructor: { rle: 'AQA=', pal: [0], W: 1, H: 1, D: 1, res: 16 } } }, lib: [{ name: 'huge', sx: 1024, sy: 1024, sz: 1024, pal: [0], rle: 'AQA=' }, { name: 'bad', sx: 2, sy: 2, sz: 2, pal: [0], rle: '!!' }] });
  const pk = P.read(bad);
  check(pk && !pk.studio.houses[3] && pk.studio.houses[4] && pk.studio.houses[7] && pk.studio.houses[7].skin === 'glas', 'a template with broken base64 is dropped, a sound one and a skin-only design stay (house 07 → 7)');
  check(Object.keys(pk.studio.models).length === 0 && Object.getPrototypeOf(pk.studio.models) === Object.prototype, 'model keys that are not models of this game (__proto__, constructor) are ignored');
  check(pk.lib.length === 0, 'a Bauteil of 1024³ cells or with broken base64 is dropped');
  check(pk.studio.houses[4].name === 'ok', 'names are kept as plain strings');
  const t = { box: [1, 1, 0, 0], pal: ['keep'], rle: '***' };
  check(VR.Custom.tplData({ tpl: t }) === null && VR.Custom.tplData({ tpl: t }) === null, 'a corrupted template builds the original house (tplData → null, twice, no throw)');
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
