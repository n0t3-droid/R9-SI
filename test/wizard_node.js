// W2 ✨ wizard — what it offers (src/shared/wizkinds.js, VR.WizKinds), without a browser:
//  · Was?: at least ten big picture tiles (Haus, Hochhaus, Burg, Brücke, Park, Möbel, Fahrzeug, Tier, Figur, Natur, Ding …)
//  · Wie?: six variants per tile — the R9 Forge's (distinct DNAs and pictures, 🎲 gives six others), six Baukasten houses
//    (HK, seeded), six things of a Genie kind, six pieces of furniture of a kind; „Feuerwehrauto" → six fire trucks with
//    six different pictures; „rotes Dach" changes the lit house (and its picture)
//  · a typed wish finds its tile (Hochhaus → the Forge's tower, Leuchtturm → the Genie's, Villa → the Baukasten,
//    Sofa → Möbel); an unknown one gets suggestions
//  · a thing becomes a Bauteil (r9si.library: pal + RLE) that the game builds cell for cell (Blueprints.libPiece)
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), key: (i) => [...store.keys()][i] ?? null, get length() { return store.size; }, clear: () => store.clear() };
global.window = global; global.self = global;
require('./load_shared.js');
const R = VR.R, KEEP = 0xffff;
// the Studio's Genie and Baukasten (the game bundles them for ✨ too) with the Studio's own block colours, from the real
// textures (one texel per layer: their averages)
const TEX = require('./tex_avg.js');
window.__studioCore = { texInfo: () => TEX.texInfo };
require('../src/studio/colors.js');
require('../src/studio/housekit.js'); require('../src/studio/genie_brain.js'); require('../src/studio/genie.js');
delete window.__studioCore;
require('../src/shared/isopic.js');
require('../src/main/pack.js');
require('../src/main/blueprints.js');
let K = null; try { require('../src/shared/wizkinds.js'); K = VR.WizKinds; } catch (e) { console.log('  (wizkinds.js: ' + String(e.message).slice(0, 200) + ')'); }
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
check(!!K, 'VR.WizKinds loads');
if (!K) { console.log('FAILED ' + fails); process.exit(1); }
check(!!(VR.BlockColors && VR.BlockColors.ready()), 'the block colours are there (the Genie paints with them)');
const col = VR.IsoPic.texColors(TEX.avg);
const pic = (g) => VR.IsoPic.hash(VR.IsoPic.render(g, 160, 120, col));
const gridOf = (t) => K.grid(t);   // (Forge on the main thread here; the pages use their worker)

console.log('1 · Was?');
const tiles = K.tiles();
console.log('  ' + tiles.map(t => t.icon + ' ' + t.label[1]).join(' · '));
check(tiles.length >= 10 && new Set(tiles.map(t => t.id)).size === tiles.length, 'at least ten tiles, each once (' + tiles.length + ')');
check(tiles.every(t => t.icon && Array.isArray(t.label) && /^wiz\./.test(t.label[0]) && t.label[1] && t.label[2]), 'each with a picture and a word (a table key, German, English)');
for (const id of ['haus', 'hochhaus', 'burg', 'bruecke', 'park', 'moebel', 'fahrzeug', 'tier', 'figur', 'ding']) check(tiles.some(t => t.id === id), 'tile ' + id);
const more = K.more();
check(more.length >= 5 && more.some(t => t.id === 'turm') && more.some(t => t.id === 'katalog'), '„Mehr" holds the rest (' + more.map(t => t.id).join(' ') + ')');

console.log('2 · Wie? — the Forge');
const f1 = K.six('hochhaus', { seed: 1 }), f2 = K.six('hochhaus', { seed: 2 });
check(f1.things.length === 6 && f1.things.every(t => t.src === 'forge' && /^tower:/.test(t.dna) && t.ding === 'f:' + t.dna), 'six skyscrapers (Forge DNAs, Ding f:<dna>)');
check(new Set(f1.things.map(t => t.dna)).size === 6, 'six different DNAs');
const fh = f1.things.map(t => pic(gridOf(t)));
check(new Set(fh).size === 6, 'six different pictures');
check(!f2.things.some(t => f1.things.some(u => u.dna === t.dna)), '🎲 gives six others');
for (const id of ['burg', 'bruecke', 'park']) { const s = K.six(id, { seed: 1 }); check(s.things.length === 6 && new Set(s.things.map(t => t.dna)).size === 6, id + ': six'); }
const tw = K.change(f1.things[0], 'höher');
check(tw && tw.dna !== f1.things[0].dna && VR.Forge.parse(tw.dna).params.f > VR.Forge.parse(f1.things[0].dna).params.f, '„höher" makes the lit one taller (' + (tw && tw.dna) + ')');

console.log('3 · Wie? — Möbel');
const m1 = K.six('moebel', {});
check(m1.things.length === 6 && m1.things.every(t => t.src === 'model' && /^m:vm_/.test(t.ding) && VR.VM.MODELS[t.ding.slice(2)]), 'six pieces of furniture (m:<model>)');
check(/sofa/.test(m1.things[0].ding), 'the first is a sofa (' + m1.things[0].ding + ')');
check(Array.isArray(m1.chips) && m1.chips.length >= 6 && m1.chips.some(c => c.id === 'bett'), 'chips by kind: Sofa, Bett, Tisch …');
const mb = K.six('moebel', { sub: 'bett' });
check(mb.things.every(t => /bed|sleep/.test(t.ding)), 'the Bett chip: beds (' + mb.things.map(t => t.ding).join(' ') + ')');

console.log('4 · Wie? — the Genie\'s things');
const v1 = K.six('fahrzeug', { seed: 1 });
check(v1.things.length === 6 && v1.things.every(t => t.src === 'genie' && t.design && t.design.kind === 'model'), 'six vehicles');
check(new Set(v1.things.map(t => t.design.recipe.type)).size === 6, 'six different ones (' + v1.things.map(t => t.design.recipe.type).join(' ') + ')');
check(v1.things.every(t => { const g = gridOf(t); return g && g.sx > 0; }), 'each becomes blocks');
const ft = K.wish('Feuerwehrauto');
check(ft && ft.tile === 'fahrzeug' && ft.things.length === 6 && ft.things.every(t => t.design.recipe.type === 'firetruck'), '„Feuerwehrauto" → six fire trucks');
const fth = ft.things.map(t => pic(gridOf(t)));
check(new Set(fth).size === 6, 'six different pictures (' + fth.map(h => h.toString(16).slice(0, 4)).join(' ') + ')');
check(ft.things.every(t => /Feuerwehrauto/.test(t.name)), 'named „… Feuerwehrauto" (' + ft.things.map(t => t.name).join(', ') + ')');

console.log('5 · Wie? — Baukasten houses');
const h1 = K.six('haus', { seed: 1 });
check(h1.things.length === 6 && h1.things.every(t => t.src === 'kit' && t.spec && t.spec.roof), 'six Baukasten houses');
check(new Set(h1.things.map(t => JSON.stringify(t.spec))).size === 6, 'six different ones');
check(Array.isArray(h1.chips) && h1.chips.some(c => c.id === 'modern'), 'style chips (Landhaus, Modern, Klassisch, Hütte)');
const hm = K.six('haus', { seed: 1, sub: 'modern' });
check(hm.things.every(t => t.spec.style === 'modern'), 'the Modern chip: modern houses');
const lit = h1.things[0], red = K.change(lit, 'rotes Dach');
check(red && red.spec.roof.color !== lit.spec.roof.color && /^#[a-f0-9]{6}$/.test(red.spec.roof.color), '„rotes Dach" changes the roof (' + lit.spec.roof.color + ' → ' + (red && red.spec.roof.color) + ')');
check(red && pic(gridOf(red)) !== pic(gridOf(lit)), 'and the picture');

console.log('6 · a typed wish finds its tile');
const route = (w) => { const r = K.wish(w); return r && r.tile; };
for (const [w, t] of [['Hochhaus 30 Stockwerke', 'hochhaus'], ['Hängebrücke 60 lang', 'bruecke'], ['Burg mit Bergfried', 'burg'], ['Park mit Teich', 'park'], ['Leuchtturm', 'gebaeude'], ['Villa mit Pool', 'haus'], ['Sofa', 'moebel'], ['Einhorn', 'tier'], ['Ritter', 'figur'], ['Kirschbaum', 'natur'], ['Torte', 'ding']]) check(route(w) === t, '„' + w + '" → ' + t + ' (' + route(w) + ')');
const hz = K.wish('Hochhaus 30 Stockwerke');
check(VR.Forge.parse(hz.things[0].dna).params.f === 30, 'the wish\'s own numbers are the first variant (30 floors)');
const unk = K.wish('xyzzy blorp');
check(unk && unk.error === 'unknown' && Array.isArray(unk.suggestions) && unk.suggestions.length >= 3, 'an unknown wish: suggestions (' + (unk && unk.suggestions || []).join(', ') + ')');

console.log('7 · a thing as a Bauteil');
const g = gridOf(ft.things[2]);
const it = K.libItem(g, { name: ft.things[2].name, origin: { kind: 'genie', recipe: ft.things[2].design.recipe } });
check(it && it.id && it.sx === g.sx && Array.isArray(it.pal) && typeof it.rle === 'string' && it.origin.kind === 'genie', 'libItem: pal + RLE, origin genie');
store.set('r9si.library', JSON.stringify({ v: 1, items: [it] }));
const gad = { g: { world: null, meta: { id: 'w' }, ui: {}, audio: {} }, wand: { undo: [] }, applyEdit() {}, noteBlock() {} };
const bp = new VR.Blueprints(gad).libPiece({ kind: 'piece', piece: 'p:' + it.id });
let n = 0; for (let i = 0; i < g.blocks.length; i++) if (g.blocks[i] !== KEEP) n++;
let same = !!bp && bp.ops.length / 4 === n;
if (same) for (let i = 0; i < bp.ops.length; i += 4) { const x = bp.ops[i], y = bp.ops[i + 1] - (g.dy | 0), z = bp.ops[i + 2]; if (g.blocks[(y * g.sz + z) * g.sx + x] !== bp.ops[i + 3]) { same = false; break; } }
check(same, 'the game builds exactly its cells (' + n + ')');
const hk = K.libItem(gridOf(lit), { name: lit.name, origin: { kind: 'kit', spec: lit.spec, level: true } });
check(hk.dy < 0 && hk.origin.level === true, 'a Baukasten house keeps its height offset and wants a level lot');

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
