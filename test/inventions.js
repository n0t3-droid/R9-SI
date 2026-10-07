// 💡 Erfinderwerkstatt — the data and the rules (src/main/inventions.js), the texts in both tables, the codex category
// and the way into the build. Node, no DOM (a tiny localStorage). Checks:
//  1  the module and its API
//  2  the cards: six starters, ≥ 150 inventions, every id exists (no new ids), no duplicate pair, every card reachable
//     from the six starters, every pair of two start cards gives something (the first minute), the categories
//  3  the texts: a name and one friendly line (≤ 70) in German and English for every card, no two names alike
//  4  combine · progress · storage (reload, corrupt JSON, unknown keys, a refusing storage, reset, listeners)
//  5  💡 Tipp: always a working pair of known cards; following it finds everything
//  6  rewards: Creative / Zen one stack (hotbar first), Survival and guests none, a full inventory loses nothing;
//     the crafting recipe a Survival player is shown
//  7  the codex: a 💡 category with one entry per invention that follows the profile
//  8  the build and the chrome texts: build.js order, invent.css, every erf.* key in both tables and in use
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const { store } = require('./dom_stub.js');
require('./load_shared.js');
require(path.join(ROOT, 'src/main/i18n.js'));
require(path.join(ROOT, 'src/main/lang_en.js'));
require(path.join(ROOT, 'src/main/lang_de.js'));
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const done = () => { console.log(fails ? 'FAILED ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0); };
const KEY = 'r9si.inventions';
const MOD = path.join(ROOT, 'src/main/inventions.js');
const load = () => { delete require.cache[MOD]; delete VR.Inventions; require(MOD); return VR.Inventions; };   // (a page load: the stored record is read again)
const fresh = () => { store.clear(); globalThis.__full = false; return load(); };

console.log('1 · the module');
let Inv = null;
try { Inv = fresh(); } catch (e) { console.log('  ✗ src/main/inventions.js does not load: ' + String(e.message).split('\n')[0]); }
check(!!Inv && ['card', 'idOf', 'has', 'known', 'cards', 'found', 'count', 'find', 'combine', 'tip', 'text', 'reset', 'on', 'reward', 'grant', 'recipeFor', 'pairOf'].every(k => typeof Inv[k] === 'function'), 'VR.Inventions: card / idOf / has / known / cards / found / count / find / combine / tip / text / reset / on / reward / grant / recipeFor / pairOf');
if (!Inv) { fails++; done(); }

console.log('2 · the cards');
const I18N = VR.I18N, EN = I18N.dict.en, DE = I18N.dict.de;
check(Inv.STARTERS.map(s => s.k).join() === 'holz,stein,feuer,wasser,erde,luft', 'six start cards: Holz, Stein, Feuer, Wasser, Erde, Luft');
const L = Inv.LIST;
check(L.length >= 150 && L.length === Inv.TOTAL, 'at least 150 inventions (' + L.length + ' = TOTAL ' + Inv.TOTAL + ')');
const exists = (id) => !!(VR.R.byName[id] || VR.ITEMS[id] || (VR.VM && VR.VM.MODELS && VR.VM.MODELS[id]));
const allCards = Inv.STARTERS.concat(L);
const badId = allCards.filter(c => !exists(c.id));
check(!badId.length, 'every card is an existing block, item or VM model (no new ids)' + (badId.length ? ': ' + badId.map(c => c.k + '→' + c.id).join(', ') : ''));
const keys = allCards.map(c => c.k), dupK = keys.filter((k, i) => keys.indexOf(k) !== i);
check(!dupK.length && keys.every(k => /^[a-z0-9]+$/.test(k)), 'card keys are unique lower-case words' + (dupK.length ? ': ' + dupK.join(',') : ''));
const ids = allCards.map(c => c.id), dupI = ids.filter((k, i) => ids.indexOf(k) !== i);
check(!dupI.length, 'every card has its own picture (no id used twice)' + (dupI.length ? ': ' + [...new Set(dupI)].join(',') : ''));
const mods = L.filter(c => VR.VM && VR.VM.MODELS && VR.VM.MODELS[c.id]).length;
check(mods >= 30, 'the Modern Living pieces are among them (' + mods + ' VM models)');
// pairs: [a, b] sorted, main pair first, then the alternatives
const pairs = [], pk = (a, b) => [a, b].sort().join('+');
for (const c of L) for (const p of [c.a].concat(c.alts || [])) pairs.push({ k: c.k, p });
const badPair = pairs.filter(x => !Array.isArray(x.p) || x.p.length !== 2 || !keys.includes(x.p[0]) || !keys.includes(x.p[1]));
check(!badPair.length, 'every pair is two existing cards' + (badPair.length ? ': ' + badPair.slice(0, 5).map(x => x.k).join(',') : ''));
const seen = new Map(), dupP = [];
for (const x of pairs) { const s = pk(x.p[0], x.p[1]); if (seen.has(s)) dupP.push(s + ' (' + seen.get(s) + ' / ' + x.k + ')'); else seen.set(s, x.k); }
check(!dupP.length && pairs.length >= 150, 'no pair twice, unordered (' + pairs.length + ' pairs for ' + L.length + ' inventions)' + (dupP.length ? ': ' + dupP.join(' · ') : ''));
check(L.every(c => !c.a.includes(c.k) && !(c.alts || []).some(p => p.includes(c.k))), 'no invention is made from itself');
// reachable from the six starters (every pair, main or alternative, may be the way)
{
  let known = new Set(Inv.STARTERS.map(s => s.k)), depth = new Map(Inv.STARTERS.map(s => [s.k, 0])), changed = true, round = 0;
  while (changed) { changed = false; round++; const add = []; for (const c of L) { if (known.has(c.k)) continue; if ([c.a].concat(c.alts || []).some(p => known.has(p[0]) && known.has(p[1]))) add.push(c.k); } for (const k of add) { known.add(k); depth.set(k, round); changed = true; } }
  const lost = L.filter(c => !known.has(c.k));
  check(!lost.length, 'every invention can be reached from the six start cards' + (lost.length ? ': ' + lost.map(c => c.k).join(',') : ''));
  // the main pair too: it must be makeable without the invention's own alternatives being the only way in
  const mainOK = L.filter(c => !(known.has(c.a[0]) && known.has(c.a[1])));
  check(!mainOK.length, 'the main pair of each invention is made of cards that exist');
  const maxD = Math.max(...depth.values());
  check(maxD >= 7 && maxD <= 14, 'a real ladder: the deepest invention is ' + maxD + ' steps from the start');
  const first = L.filter(c => depth.get(c.k) === 1).length;
  check(first >= 15, 'the first minute: ' + first + ' inventions from the start cards alone');
  // the late ones: the spec's surprises
  check(['jetpack', 'sternenkern', 'hoverbike', 'reaktor', 'shuttle'].every(k => depth.get(k) >= 6), 'Jetpack, Sternenkern, Hoverbike, Reaktor, Shuttle are late (depth ≥ 6)');
}
// every pair of two start cards gives something
{
  const S = Inv.STARTERS.map(s => s.k), miss = [];
  for (let i = 0; i < S.length; i++) for (let j = i; j < S.length; j++) if (!Inv.find(S[i], S[j])) miss.push(S[i] + '+' + S[j]);
  check(!miss.length, 'all 21 pairs of the six start cards give an invention' + (miss.length ? ': missing ' + miss.join(', ') : ''));
  check(Inv.find('feuer', 'stein') === 'ofen' && Inv.find('stein', 'feuer') === 'ofen' && Inv.find('wasser', 'erde') === 'schlamm' && Inv.find('luft', 'luft') === 'pusteblume', 'Feuer + Stein = Ofen, Wasser + Erde = Schlamm (either order), Luft + Luft = Pusteblume');
}
const spec = [['licht', 'strom', 'lampe'], ['licht', 'glas', 'laterne'], ['lampe', 'uhr', 'smartlampe']];
check(spec.every(([a, b, k]) => Inv.find(a, b) === k), 'the spec\'s examples: Strom + Licht = Lampe, Licht + Glas = Laterne, Lampe + Uhr = Smart-Lampe');
check(['kuehlschrank', 'herd', 'sofa', 'fernseher', 'ebike', 'smartlampe', 'jetpack', 'sternenkern'].every(k => Inv.card(k)), 'Kühlschrank, Herd, Sofa, Fernseher, E-Bike, Smart-Lampe, Jetpack and Sternenkern are inventions');
check(Inv.CATS.length >= 6 && L.every(c => Inv.CATS.some(g => g.k === c.cat)) && Inv.CATS.every(g => L.filter(c => c.cat === g.k).length >= 8), 'the categories: every invention has one, each holds at least 8');

console.log('3 · the texts');
const nameOf = (lang, k) => { const v = (lang === 'de' ? DE : EN)['erf.i.' + k]; return Array.isArray(v) ? v : null; };
const bad = [];
for (const c of allCards) for (const lang of ['de', 'en']) { const v = nameOf(lang, c.k); if (!v || v.length !== 2 || !String(v[0]).trim() || !String(v[1]).trim()) bad.push(lang + ':' + c.k); }
check(!bad.length, 'every card has [name, line] in the German and the English table (' + allCards.length + ' cards)' + (bad.length ? ': ' + bad.slice(0, 8).join(', ') : ''));
const long = [];
for (const c of allCards) for (const lang of ['de', 'en']) { const v = nameOf(lang, c.k); if (v && (String(v[0]).length > 22 || String(v[1]).length > 70)) long.push(lang + ':' + c.k + ' (' + String(v[0]).length + '/' + String(v[1]).length + ')'); }
check(!long.length, 'names are at most 22 and lines at most 70 characters' + (long.length ? ': ' + long.slice(0, 8).join(', ') : ''));
for (const lang of ['de', 'en']) { const names = allCards.map(c => (nameOf(lang, c.k) || [''])[0].toLowerCase()), d = names.filter((n, i) => names.indexOf(n) !== i); check(!d.length, 'no two cards share a name in ' + lang + (d.length ? ': ' + [...new Set(d)].join(', ') : '')); }
const lines = allCards.map(c => (nameOf('de', c.k) || ['', ''])[1]);
check(new Set(lines).size === lines.length, 'every German line is its own (no line twice)');
const extra = Object.keys(DE).filter(k => /^erf\.i\./.test(k) && !keys.includes(k.slice(6)));
check(!extra.length, 'no text for a card that does not exist' + (extra.length ? ': ' + extra.join(', ') : ''));
check(allCards.every(c => !/[A-Za-z]/.test((nameOf('de', c.k) || ['', ''])[1].replace(/[0-9a-zA-ZäöüÄÖÜß\-.,:;!?„“'’ ()+/=]/g, ''))), 'German lines use ordinary letters and signs');
I18N.lang = 'de'; check(Inv.text('ofen').name === 'Ofen' && /\S/.test(Inv.text('ofen').line), 'text("ofen") in German: ' + JSON.stringify(Inv.text('ofen')));
I18N.lang = 'en'; check(Inv.text('ofen').name === 'Furnace', 'text("ofen") in English: ' + Inv.text('ofen').name);
I18N.lang = 'de';

console.log('4 · combine, progress, storage');
Inv = fresh();
check(Inv.count() === 0 && Inv.found().length === 0 && Inv.cards().length === 6 && Inv.known('feuer') && !Inv.known('ofen'), 'a new profile: nothing found, the six start cards');
const heard = []; Inv.on((e) => heard.push(e.type + ':' + (e.k || '')));
let r = Inv.combine('feuer', 'stein');
check(r.ok && r.k === 'ofen' && r.isNew === true && Inv.has('ofen') && Inv.count() === 1, 'Feuer + Stein → Ofen, new');
r = Inv.combine('stein', 'feuer');
check(r.ok && r.k === 'ofen' && r.isNew === false && Inv.count() === 1, 'the other way round: the same, not new');
check(Inv.find('wasser', 'ofen') === null, '(Wasser + Ofen has no invention)');
r = Inv.combine('wasser', 'ofen');
check(r.ok === false && r.reason === 'nothing' && Inv.count() === 1, 'a pair that does not fit: no, nothing lost');
r = Inv.combine('fackel', 'wasser');
check(r.ok === false && r.reason === 'locked', 'a card you do not have yet cannot be used (locked)');
r = Inv.combine('nosuchcard', 'feuer');
check(r.ok === false && r.reason === 'locked', 'an unknown card is refused');
r = Inv.combine('luft', 'luft');
check(r.ok && r.k === 'pusteblume' && r.isNew, 'a card with itself: Luft + Luft = Pusteblume');
check(Inv.cards().join() === 'holz,stein,feuer,wasser,erde,luft,ofen,pusteblume' && Inv.found().join() === 'ofen,pusteblume', 'cards(): the starters, then the findings in the order found');
check(heard.join() === 'found:ofen,found:pusteblume', 'listeners hear each new invention once (' + heard.join() + ')');
{
  const o = JSON.parse(store.get(KEY));
  check(o && o.v === 1 && o.found && o.found.ofen > 0 && o.found.pusteblume > 0 && Object.keys(o.found).join() === 'ofen,pusteblume', 'saved in localStorage r9si.inventions {v:1, found:{key: time}}');
}
Inv = load();
check(Inv.has('ofen') && Inv.has('pusteblume') && Inv.count() === 2, 'after a reload the profile\'s findings are there (they survive worlds)');
store.clear(); store.set(KEY, JSON.stringify({ v: 1, found: { ofen: 1700000000000, kies: 1700000000001 } })); Inv = load();
check(Inv.has('ofen') && Inv.has('kies') && Inv.count() === 2 && Inv.found().join() === 'ofen,kies', 'a record written earlier is read: found in the order of the stored times');
store.set(KEY, '{not json'); Inv = load();
check(Inv.count() === 0 && Inv.combine('feuer', 'stein').ok, 'corrupt JSON in the storage: start again, no throw');
store.set(KEY, JSON.stringify({ v: 1, found: { ofen: 5, nosuchcard: 6, holz: 7 } })); Inv = load();
check(Inv.count() === 1 && Inv.found().join() === 'ofen', 'unknown keys and start cards in the record are ignored');
globalThis.__full = true;
r = Inv.combine('stein', 'stein');
check(r.ok && r.k === 'kies' && r.isNew && Inv.has('kies'), 'a storage that refuses writes: the invention still counts for the session');
globalThis.__full = false;
{
  const real = globalThis.localStorage; globalThis.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  let ok = true; try { Inv = load(); ok = Inv.combine('feuer', 'stein').ok && Inv.count() === 1; Inv.reset(); ok = ok && Inv.count() === 0; } catch (e) { ok = false; }
  check(ok, 'with localStorage throwing everywhere nothing throws');
  globalThis.localStorage = real;
}
Inv = fresh(); Inv.combine('feuer', 'stein'); const heard2 = []; Inv.on((e) => heard2.push(e.type)); Inv.reset();
check(Inv.count() === 0 && !Inv.has('ofen') && heard2.join() === 'reset' && !store.has(KEY), 'reset(): all forgotten, listeners told, the record removed');

console.log('5 · 💡 Tipp');
Inv = fresh();
{
  const t = Inv.tip();
  check(t && Inv.known(t.a) && Inv.known(t.b) && Inv.find(t.a, t.b) === t.k && !Inv.has(t.k), 'a tip is a pair of known cards that makes something not found yet: ' + (t ? t.a + ' + ' + t.b + ' = ' + t.k : '-'));
  let steps = 0, ok = true;
  while (steps < 400) { const x = Inv.tip(); if (!x) break; if (!Inv.known(x.a) || !Inv.known(x.b) || Inv.has(x.k)) { ok = false; break; } const res = Inv.combine(x.a, x.b); if (!res.ok || !res.isNew) { ok = false; break; } steps++; }
  check(ok && steps === Inv.TOTAL && Inv.count() === Inv.TOTAL, 'following the tips again and again finds all ' + Inv.TOTAL + ' inventions (' + steps + ' steps)');
  check(Inv.tip() === null, 'with everything found there is no tip');
}

console.log('6 · rewards');
check(Inv.reward({ inGame: true, mode: 'creative' }) === 'inventory' && Inv.reward({ inGame: true, mode: 'zen' }) === 'inventory', 'Creative and Zen: into the inventory');
check(Inv.reward({ inGame: true, mode: 'survival' }) === 'codex' && Inv.reward({ inGame: true, mode: 'creative', guest: true }) === 'codex', 'Survival and a guest in a friend\'s world: the codex only');
check(Inv.reward({ inGame: false, mode: 'creative' }) === 'none' && Inv.reward(null) === 'none', 'on the start screen: nothing to give (the progress is saved)');
class StubInv { constructor() { this.slots = new Array(36).fill(null); this.sel = 0; this.changed = false; } add(id, n) { const max = VR.maxStack(id); let left = n; for (let i = 0; i < 36 && left > 0; i++) { const s = this.slots[i]; if (s && s.id === id && s.n < max && !s.dmg) { const k = Math.min(max - s.n, left); s.n += k; left -= k; } } for (let i = 0; i < 36 && left > 0; i++) if (!this.slots[i]) { const k = Math.min(max, left); this.slots[i] = { id, n: k }; left -= k; } this.changed = true; return n - left; } count(id) { let c = 0; for (const s of this.slots) if (s && s.id === id) c += s.n; return c; } }
const game = (mode, guest) => ({ state: 'play', meta: { guest: !!guest, mode }, player: { mode, creative: mode === 'creative', inv: new StubInv() } });
{
  Inv = fresh(); Inv.combine('feuer', 'stein');
  const g = game('creative'), res = Inv.grant(g, 'ofen');
  check(res.ok && g.player.inv.slots[0] && g.player.inv.slots[0].id === 'furnace' && g.player.inv.slots[0].n === VR.maxStack('furnace'), 'Creative: one stack of the Ofen in the first hotbar slot');
  const again = Inv.grant(g, 'ofen');
  check(again.ok && g.player.inv.count('furnace') === VR.maxStack('furnace'), 'a second time: no second stack, the first is only topped up');
  const z = game('zen'); check(Inv.grant(z, 'ofen').ok && z.player.inv.count('furnace') > 0, 'Zen: the same');
  const s = game('survival'); r = Inv.grant(s, 'ofen'); check(!r.ok && r.reason === 'mode' && s.player.inv.count('furnace') === 0, 'Survival: no free item');
  const gu = game('creative', true); r = Inv.grant(gu, 'ofen'); check(!r.ok && r.reason === 'mode' && gu.player.inv.count('furnace') === 0, 'a guest: no free item');
  const fl = game('creative'); fl.player.inv.slots = fl.player.inv.slots.map(() => ({ id: 'dirt', n: 64 })); r = Inv.grant(fl, 'ofen'); check(!r.ok && r.reason === 'full' && fl.player.inv.count('furnace') === 0, 'a full inventory: told so, nothing lost');
  check(Inv.grant({ state: 'title' }, 'ofen').ok === false && Inv.grant(g, 'nosuchcard').ok === false, 'no world / unknown card: refused');
  r = Inv.grant(game('creative'), 'ofen'); check(r.ok, '(grant works for an invention you have)');
  const none = Inv.grant(game('creative'), 'fackel'); check(!none.ok && none.reason === 'unknown', 'an invention you have not made yet cannot be taken from the book');
}
try { require(path.join(ROOT, 'src/main/crafting.js')); } catch (e) { console.log('  · crafting.js does not load here: ' + String(e.message).split('\n')[0]); }
{
  const f = VR.Crafting && Inv.recipeFor('furnace');
  check(!!f && f.kind === 'shaped' && f.grid.length === 3 && f.grid.flat().filter(Boolean).length === 8 && f.grid[1][1] === null && f.n === 1 && f.grid[0][0] === 'cobblestone', 'recipeFor("furnace"): the 3×3 ring of eight stones (the stone tag shown as a cobblestone)');
  const t = Inv.recipeFor('torch'); check(!!t && t.grid.flat().filter(Boolean).join() === 'coal,stick' && t.n === 4, 'recipeFor("torch"): coal over a stick, 4 torches');
  const p = Inv.recipeFor('oak_planks'); check(!!p && p.kind === 'shapeless' && p.list.includes('oak_log') && p.n === 4, 'recipeFor("oak_planks"): shapeless, a log');
  check(Inv.recipeFor('star_core') === null && Inv.recipeFor('vm_sofa_cream') === null && Inv.recipeFor('nosuchitem') === null, 'items without a crafting recipe give null (the screen then says: only inventing)');
}

console.log('7 · the codex');
try { require(path.join(ROOT, 'src/main/codex.js')); } catch (e) { console.log('  ✗ codex.js: ' + e.message); fails++; }
{
  Inv = fresh();
  const cx = new VR.Codex({ settings: {}, ui: null, audio: null, player: null }, {});
  const inv = () => cx.list().filter(e => e.catKey === 'inventions');
  check(inv().length === Inv.TOTAL, 'the codex has a 💡 category with one entry per invention (' + inv().length + ')');
  check(inv().length > 0 && inv().every(e => !e.found) && inv()[0].cat === (DE['g.codex.cat.inventions'] || '?'), 'none found yet; the category is named „' + (inv()[0] && inv()[0].cat) + '“');
  Inv.combine('feuer', 'stein');
  const e = inv().find(x => x.id === 'i:ofen');
  check(e && e.found && e.name === 'Ofen' && e.desc.length > 5 && e.icon === 'furnace', 'after Feuer + Stein the Ofen is found in the codex: ' + (e && e.name + ' — ' + e.desc));
  check(inv().filter(x => x.found).length === 1 && cx.toJSON && !cx.found['i:ofen'], 'the profile decides, not the world\'s own record');
  I18N.lang = 'en'; check((inv().find(x => x.id === 'i:ofen') || {}).name === 'Furnace', 'and it speaks English when asked'); I18N.lang = 'de';
  const order = cx.list().map(x => x.catKey); check(order.lastIndexOf('drift') < order.indexOf('inventions'), 'the 💡 category comes after the others');
}

console.log('8 · the build and the chrome texts');
{
  const bj = read('build.js'), main = (/const MAIN = \[([^\]]*)\]/.exec(bj) || [, ''])[1].split(',').map(s => s.trim().replace(/'/g, ''));
  check(main.includes('inventions') && main.includes('invent') && main.indexOf('inventions') < main.indexOf('ui') && main.indexOf('invent') > main.indexOf('start'), 'build.js: inventions before ui, invent after start');
  check(/src\/ui\/invent\.css/.test(bj) && fs.existsSync(path.join(ROOT, 'src/ui/invent.css')), 'build.js reads src/ui/invent.css');
  const chrome = Object.keys(EN).filter(k => /^erf\./.test(k) && !/^erf\.i\./.test(k));
  const src = ['src/main/invent.js', 'src/main/inventions.js', 'src/main/codex.js'].filter(f => fs.existsSync(path.join(ROOT, f))).map(read).join('\n');
  const unused = chrome.filter(k => !src.includes("'" + k + "'") && !src.includes('"' + k + '"') && !src.includes('`' + k + '`'));
  check(chrome.length >= 25 && !unused.length, 'every erf.* chrome key (' + chrome.length + ') is used in the code' + (unused.length ? ': ' + unused.join(', ') : ''));
  const used = new Set(); for (const m of src.matchAll(/\bT\(\s*'(erf\.[\w.]*\w)'/g)) used.add(m[1]);
  const undef = [...used].filter(k => !(k in EN) || !(k in DE));
  check(used.size >= 20 && !undef.length, 'every erf.* key the code reads (' + used.size + ') is in both tables' + (undef.length ? ': ' + undef.join(', ') : ''));
  const ks = Object.keys(EN).filter(k => /^erf\./.test(k)), miss = ks.filter(k => !(k in DE)), miss2 = Object.keys(DE).filter(k => /^erf\./.test(k) && !(k in EN));
  check(!miss.length && !miss2.length, 'the erf.* keys are the same in both tables');
  const need = ['g.pause.invent', 'g.pause.inventTip', 'g.codex.cat.inventions', 'g.codex.toastInvention', 'g.codex.inventHint'];
  check(need.every(k => k in EN && k in DE), 'the pause menu and codex keys exist in both tables: ' + need.join(', '));
  const inJS = fs.existsSync(path.join(ROOT, 'src/main/invent.js')) ? read('src/main/invent.js') : '', pause = /data-t="(g\.pause\.invent)"/.test(inJS) && /data-tt="(g\.pause\.inventTip)"/.test(inJS);
  check(pause, 'the pause menu button is filled by the language module (data-t / data-tt)');
}
done();
