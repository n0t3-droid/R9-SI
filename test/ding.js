// W1 · one „Ding" model (VR.Ding, src/shared/ding.js): every block, furniture piece, catalogue house, Baukasten / Genie
// thing, Bauteil and place is a card with the same five actions in a fixed order — 👁 Ansehen · ✏️ Bearbeiten · ☆ Favorit
// · 📍 Setzen · 📦 Teilen — a missing one absent, never greyed. Ids: b:<block> m:<model> h:<i> k:<kit> g:<genie> p:<Bauteil>
// s:<site>. The favourites and the 📦 r9-paket take the new ids too; 📦 Teilen makes a pack with exactly one thing in it.
const { store } = require('./dom_stub.js');
require('./load_shared.js');
require('../src/main/i18n.js');
require('../src/main/favs.js');
require('../src/main/pack.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const sofa = Object.keys(VR.VM.MODELS).find(n => /^vm_sofa/.test(n));

require('../src/shared/ding.js');
const D = VR.Ding;
console.log('1 · ids');
check(!!D && ['parse', 'of', 'favId', 'fromFav', 'isFav', 'toggleFav', 'name', 'actions', 'render', 'sharePack', 'share', 'list'].every(k => typeof D[k] === 'function'), 'VR.Ding: parse / of / favId / fromFav / isFav / toggleFav / name / actions / render / sharePack / share / list');
if (!D) { console.log('FAILED ' + fails); process.exit(1); }
check(JSON.stringify(D.parse('h:3')) === '{"kind":"h","key":"3"}' && D.parse('x:1') === null && D.parse('oak_planks') === null, 'parse("h:3") → {kind:"h", key:"3"}; unknown kinds and bare names are null');
check(D.of('m', sofa) === 'm:' + sofa, 'of("m", name)');
check(D.favId('h:3') === 'blueprint_3' && D.favId('b:oak_planks') === 'oak_planks' && D.favId('m:' + sofa) === sofa && D.favId('k:kabc') === 'k:kabc', 'favId: h: → blueprint_<i>, b:/m: → the bare name, the rest as they are');
check(D.fromFav('oak_planks') === 'b:oak_planks' && D.fromFav(sofa) === 'm:' + sofa && D.fromFav('blueprint_3') === 'h:3' && D.fromFav('p:x7') === 'p:x7' && D.fromFav('no_such_thing_zz') === null, 'fromFav: a block, a model, a blueprint, a new id, junk');
check(D.name('h:3') === 'Bel Portale' && D.name('b:oak_planks') === 'Oak Planks' && D.name('m:' + sofa) === VR.VM.MODELS[sofa].display, 'name(): the catalogue house, the block, the model');

console.log('2 · favourites and packs know the new ids');
store.clear(); VR.Favs.sync();
check(D.toggleFav('k:kabc') === true && JSON.parse(store.get('r9si.favs')).items.includes('k:kabc') && D.isFav('k:kabc'), '☆ on a k: card reaches r9si.favs');
check(D.toggleFav('h:3') === true && VR.Favs.has('blueprint_3') && D.isFav('h:3'), '☆ on a house card stores blueprint_3 (the game\'s ★ tab knows that id)');
check(D.toggleFav('h:3') === false && !D.isFav('h:3'), 'and takes it back');
check(VR.Pack.idOK('k:kabc') && VR.Pack.idOK('g:g12') && VR.Pack.idOK('p:bx9') && VR.Pack.idOK('s:s1') && !VR.Pack.idOK('x:1') && !VR.Pack.idOK('k:') && !VR.Pack.idOK('k:' + 'a'.repeat(90)), 'Pack.idOK accepts k: g: p: s: ids (and only well-formed ones)');
const pk = VR.Pack.read(JSON.stringify({ r9pack: 1, favs: ['k:kabc', 'stone', 'x:1'] }));
check(pk.favs.join() === 'k:kabc,stone', 'a pack read keeps k: favourites and drops junk');

console.log('3 · the five actions, in order');
D.handlers = { view: () => true, edit: () => true, set: () => true };
check(D.actions('h:3').join() === 'view,edit,fav,set,share', 'a house: 👁 ✏️ ☆ 📍 📦');
check(D.actions('k:kabc').join() === 'view,edit,fav,set', 'a Baukasten thing: no 📦 in W1');
D.handlers.canSet = (id) => !/^p:/.test(id);
check(D.actions('p:bx9').join() === 'view,edit,fav,share', 'a handler saying no removes 📍 (absent, never greyed)');
delete D.handlers.canSet;
D.handlers = { view: () => true };
check(D.actions('b:oak_planks').join() === 'view,fav,share', 'without an editor or a hand: 👁 ☆ 📦 only');
D.handlers = { view: () => true, edit: () => true, set: () => true };
const card = D.render('b:oak_planks');
const btns = card.querySelectorAll('.dacts button');
check(card.classList.contains('ding') && card.getAttribute('data-ding') === 'b:oak_planks', 'render(): .ding[data-ding]');
check(btns.length === 5 && ['👁', '✏️', '☆', '📍', '📦'].every((g, i) => btns[i].textContent.startsWith(g)), 'five buttons starting 👁 ✏️ ☆ 📍 📦 (' + btns.map(b => b.textContent).join(' · ') + ')');
check(btns.every(b => !b.getAttribute('disabled') && b.getAttribute('data-da')), 'none disabled, each named by data-da');
check(btns.map(b => b.getAttribute('data-da')).join() === 'view,edit,fav,set,share', 'data-da in order');
check(card.querySelector('.cap .n').textContent === 'Oak Planks', 'the card shows the name');
let setCalled = null; D.handlers.set = (id) => { setCalled = id; return true; };
btns[3].click();
check(setCalled === 'b:oak_planks', 'a click on 📍 calls handlers.set(id)');
btns[2].click();
check(D.isFav('b:oak_planks') && btns[2].textContent.startsWith('★'), '☆ toggles the favourite and the button shows ★');
const sa = D.render('h:3', { setLabel: '🎒 Merken' });
check(sa.querySelector('[data-da="set"]').textContent === '🎒 Merken', 'opts.setLabel renames 📍 (the standalone Studio)');

console.log('4 · 📦 Teilen: a pack with exactly one thing');
const sum = (p) => { const s = VR.Pack.summary(p); return [s.favs, s.houses, s.models, s.lib].join(','); };
VR.Favs.add('oak_planks'); VR.Favs.add('stone'); VR.Favs.add(sofa);
check(sum(D.sharePack('b:oak_planks')) === '1,0,0,0' && D.sharePack('b:oak_planks').favs[0] === 'oak_planks', 'a block: one favourite, nothing else');
const idx = new Uint16Array(VR.VM.MODELS[sofa].VW * VR.VM.MODELS[sofa].VH * VR.VM.MODELS[sofa].VD); idx[0] = 1;
VR.Custom.save({ v: 1, houses: { 7: { v: 2, name: 'Palais Royal', index: 7, skin: 'classic', tpl: { box: [1, 1, 0, 0], off: [0, 0], pal: ['keep', 'air', ['stone']], rle: 'AgE=' }, n: 1, t: 100 } }, models: { [sofa]: { v: 1, W: 1, H: 1, D: 1, res: 16, pal: [0, 1], rle: VR.Custom.b64(new Uint8Array(VR.Custom.rle(idx).buffer)), t: 5 } } });
check(sum(D.sharePack('m:' + sofa)) === '0,0,1,0', 'a model with a design: the design, not the favourite');
check(sum(D.sharePack('h:7')) === '0,1,0,0' && sum(D.sharePack('h:3')) === '1,0,0,0' && D.sharePack('h:3').favs[0] === 'blueprint_3', 'a house: its design when there is one, else blueprint_<i>');
store.set('r9si.library', JSON.stringify({ v: 1, items: [{ id: 'bx9', name: 'Turm', t: 1, sx: 2, sy: 1, sz: 1, dy: 0, pal: [0, 'air', ['stone']], rle: 'AgE=' }, { id: 'by1', name: 'Zaun', t: 1, sx: 2, sy: 1, sz: 1, dy: 0, pal: [0, 'air', ['stone']], rle: 'AgE=' }] }));
check(sum(D.sharePack('p:bx9')) === '0,0,0,1' && D.sharePack('p:bx9').lib[0].name === 'Turm', 'a Bauteil: that one item');
check(D.sharePack('k:kabc') === null, 'nothing to pack for a k: thing yet');
check(D.name('p:bx9') === 'Turm', 'a Bauteil is named by its library entry');
let dl = null; D.download = (name, text) => { dl = { name, text }; return Promise.resolve(true); };
D.share('b:oak_planks');
check(dl && /^r9-paket-.*oak-planks.*\.json$/.test(dl.name) && VR.Pack.read(dl.text).favs.join() === 'oak_planks', '📦 Teilen downloads r9-paket-…-oak-planks.json with that one favourite (' + (dl && dl.name) + ')');

console.log('5 · list(): your things, newest first');
store.set('r9si.projects', JSON.stringify({ v: 1, items: { kabc: { id: 'kabc', kind: 'kit', name: 'Landhaus', t: 50 }, g77: { id: 'g77', kind: 'genie', name: 'Feuerwehrauto', t: 80 }, 'h:2': { id: 'h:2', kind: 'house', name: 'Villa R9 140', t: 60 }, 'w:w1': { id: 'w:w1', kind: 'world', name: 'Welt', t: 90 } } }));
const L = D.list();
check(L.every(x => typeof x.id === 'string' && Number.isFinite(x.t)) && L.map(x => x.id).includes('k:kabc') && L.map(x => x.id).includes('g:g77') && L.map(x => x.id).includes('p:bx9') && L.map(x => x.id).includes('m:' + sofa) && L.map(x => x.id).includes('h:7') && L.map(x => x.id).includes('b:stone') && !L.some(x => /^w:/.test(x.id)), 'favourites, designs, Bauteile and projects, no worlds (' + L.map(x => x.id).join(' ') + ')');
check(L.findIndex(x => x.id === 'g:g77') < L.findIndex(x => x.id === 'k:kabc'), 'the last one touched first');
check(new Set(L.map(x => x.id)).size === L.length, 'no doubles');
check(D.list({ kind: 'p' }).map(x => x.id).join() === 'p:bx9,p:by1', 'list({kind:"p"}) filters');
check(D.state('h:7') === '✓ im Spiel' && D.state('b:stone') === '', 'state(): a saved design says ✓ im Spiel');

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
