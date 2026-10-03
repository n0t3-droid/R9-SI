// ✨ the Genie's own brain: wishes → houses and things, without Claude (node test, geometry + words)
global.window = global; global.self = global;
const VR = require('/home/claude/vr/test/load_shared.js');
require('/home/claude/vr/src/studio/housekit.js');
require('/home/claude/vr/src/studio/genie.js');
require('/home/claude/vr/src/studio/genie_brain.js');
const B = VR.GenieBrain, G = VR.Genie, KEEP = 0xffff;
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('✗', m); } else console.log('✓', m); };
const D = (text, extra) => B.design(Object.assign({ text, size: 32 }, extra || {}));
const err = (fn) => { try { fn(); return null; } catch (e) { return e; } };

// ---------------------------------------------------------------- houses
{
  const h = D('rotes Landhaus mit Pool, zwei Etagen, Dach schwarz');
  ok(h.kind === 'house' && h.spec.walls.color === '#c0392b' && h.spec.roof.color === '#1d1f22' && h.spec.floors === 2 && h.spec.extras.includes('pool'), 'a red country house with a pool, two floors, black roof (' + [h.spec.walls.color, h.spec.roof.color, h.spec.floors, h.spec.extras] + ')');
  ok(/Landhaus/.test(h.name), 'it is called a Landhaus (' + h.name + ')');
  const v = D('Villa'); ok(v.kind === 'house' && v.name === 'Villa', 'Villa → a house called Villa');
  const c = D('Blockhütte'); ok(c.kind === 'house' && c.spec.walls.material === 'log', 'Blockhütte → log walls');
  const b = D('Strandhaus'); ok(b.kind === 'house' && b.spec.roof.color !== '#b0453a', 'Strandhaus → a modern house without the red default roof (' + b.spec.roof.color + ')');
  const s = D('Haus mit grünen Fensterläden'); ok(s.spec.windows.shutters === '#2e9e4f', 'green shutters (' + s.spec.windows.shutters + ')');
  const e = D('a white modern house with a garage'); ok(e.kind === 'house' && e.spec.style === 'modern' && e.spec.extras.includes('garage') && e.spec.walls.color === '#f4f4f2', 'English: a white modern house with a garage');
}
// ---------------------------------------------------------------- things
{
  const f = D('Feuerwehrauto'); ok(f.kind === 'model' && f.recipe.type === 'firetruck' && f.name === 'Feuerwehrauto', 'Feuerwehrauto → the fire truck');
  const f2 = D('Feuerwehrauto ohne Leiter'); ok(f2.recipe.feats.ladder === false, '„ohne Leiter“ takes the ladder away');
  const s = D('Segelboot mit roten Segeln'); ok(s.recipe.type === 'sailboat' && s.recipe.colors.sail === '#c0392b', 'a sailboat with red sails');
  const k = D('großer Kirschbaum'); ok(k.recipe.type === 'tree' && k.recipe.feats.cherry && k.recipe.size > 32 && k.name === 'Kirschbaum', 'a big cherry tree (' + k.recipe.size + ')');
  const a = D('blaues Auto mit Spoiler'); ok(a.recipe.type === 'car' && a.recipe.colors.body === '#2e6fd8' && a.recipe.feats.spoiler && a.name === 'Blaues Auto', 'a blue car with a spoiler (' + a.name + ')');
  const t = D('drei Bäume'); ok(t.recipe.count === 3 && /^3 ×/.test(t.name), 'three trees (' + t.name + ')');
  ok(D('Burger').recipe.type === 'burger', 'a Burger is a burger, not a castle');
  ok(D('Riesenrad').recipe.size === 32, 'a Riesenrad is not “riesig”');
  ok(D('Statue').recipe.type === 'statue', 'Statue (no umlaut folding of “ue”)');
  const l = D('Löwe aus Stein'); ok(l.recipe.type === 'lion' && l.recipe.statue && /Stein/.test(l.name), 'a lion of stone is a statue (' + l.name + ')');
  ok(D('Hundehütte').recipe.type === 'doghouse', 'Hundehütte → dog house, not a cabin');
  ok(D('Baumhaus').recipe.type === 'treehouse', 'Baumhaus → tree house');
  const w = D('Schild mit Willkommen'); ok(w.recipe.type === 'letters' && w.recipe.text === 'Willkommen' && w.recipe.feats.board, 'a sign that says Willkommen (' + w.recipe.text + ')');
  const r = D('Schriftzug R9 in Rot'); ok(r.recipe.text === 'R9' && r.recipe.colors.body === '#c0392b', 'lettering R9 in red (' + r.recipe.text + ', ' + r.recipe.colors.body + ')');
  const e1 = D('red car'); ok(e1.recipe.type === 'car' && e1.recipe.colors.body === '#c0392b', 'English: red car');
  ok(D('dragon breathing fire').recipe.feats.fire === true, 'English: a dragon breathing fire');
  const fz = D('Feuerwerauto'); ok(fz.recipe.type === 'firetruck' && fz.fuzzy, 'a typo still finds the fire truck');
  ok(D('Leuchturm').recipe.type === 'lighthouse', 'Leuchturm (typo) → lighthouse');
  const u = err(() => D('xyzzy qwrtz')); ok(u && u.code === 'unknown' && u.suggestions.length >= 5, 'nonsense → unknown, with suggestions (' + (u && u.suggestions.slice(0, 3)) + ')');
  const u2 = err(() => D('ein Tier')); ok(u2 && u2.code === 'unknown' && u2.suggestions.includes('Hund'), 'an animal I do not know → animal suggestions');
  ok(err(() => D('')).code === 'empty', 'nothing → empty');
}
// ---------------------------------------------------------------- changes
{
  const h = D('Landhaus'), h2 = D('Dach blau', { base: h }); ok(h2.kind === 'house' && h2.spec.roof.color === '#2e6fd8' && h2.name === h.name, 'house + „Dach blau“ → only the roof changes');
  const h3 = D('ohne Kamin, mit Garage', { base: h2 }); ok(!h3.spec.extras.includes('chimney') && h3.spec.extras.includes('garage') && h3.spec.roof.color === '#2e6fd8', 'house + „ohne Kamin, mit Garage“ keeps the blue roof');
  const car = D('Auto'), big = D('größer', { base: car }); ok(big.recipe.size > car.recipe.size && big.recipe.type === 'car', 'car + „größer“ (' + car.recipe.size + ' → ' + big.recipe.size + ')');
  const red = D('Räder rot', { base: car }); ok(red.recipe.colors.wheels === '#c0392b', 'car + „Räder rot“');
  const ft = D('Feuerwehrauto'), nl = D('ohne Leiter', { base: ft }); ok(nl.recipe.feats.ladder === false, 'fire truck + „ohne Leiter“');
  const gc = D('grünes Auto'), boat = D('mach ein Boot daraus', { base: gc }); ok(boat.recipe.type === 'boat' && boat.recipe.colors.body === '#2e9e4f', 'green car + „mach ein Boot daraus“ → a green boat');
  const toHouse = D('lieber ein Haus', { base: car }); ok(toHouse.kind === 'house', 'car + „lieber ein Haus“ → a house');
  const nc = err(() => D('hmm', { base: car })); ok(nc && nc.code === 'nochange' && nc.suggestions.length, 'car + „hmm“ → nothing to change, with ideas (' + (nc && nc.suggestions) + ')');
  const more = D('noch einer', { base: car }); ok(more.recipe.count === 2, 'car + „noch einer“ → two cars');
  const sw = D('Schild mit Hallo'), sw2 = D('blau', { base: sw }); ok(sw2.recipe.text === 'Hallo' && sw2.recipe.colors.body === '#2e6fd8', 'a sign keeps its words when the colour changes');
}
// ---------------------------------------------------------------- every thing of the library builds, at every size
{
  let bad = [];
  for (const T of B.LIB) for (const S of [12, 32, 64]) {
    const r = B.design({ text: T.de, size: S });
    if (r.kind !== 'model' || r.recipe.type !== T.id) { bad.push(T.id + ' → ' + (r.recipe ? r.recipe.type : r.kind)); continue; }
    const g = G.raster(Object.assign({ name: r.name }, r.model), {});
    if (!g || g.n < 10) { bad.push(T.id + '@' + S + ' empty'); continue; }
    const big = Math.max(g.sx, g.sy, g.sz);
    if (T.id !== 'letters' && (big > S * 1.35 + 4 || big < S * 0.6)) bad.push(T.id + '@' + S + ' is ' + big);
  }
  ok(!bad.length, 'all ' + B.LIB.length + ' things build at 12, 32 and 64 blocks' + (bad.length ? ': ' + bad.slice(0, 8).join(', ') : ''));
  // mirrored things stay symmetric when scaled
  const r = B.design({ text: 'Auto', size: 21 }), g = G.raster(r.model, {});
  let sym = 0, all = 0;
  for (let y = 0; y < g.sy; y++) for (let z = 0; z < g.sz; z++) for (let x = 0; x < g.sx; x++) { const a = g.blocks[(y * g.sz + z) * g.sx + x], b = g.blocks[(y * g.sz + z) * g.sx + (g.sx - 1 - x)]; if (a !== KEEP && a) { all++; if (b !== KEEP && b) sym++; } }
  ok(sym / all > 0.97, 'a car scaled to 21 stays symmetric (' + (100 * sym / all).toFixed(1) + '%)');
  // thin parts survive scaling down (a mast of a sail boat at 12 blocks)
  const sb = B.design({ text: 'Segelboot', size: 12 }), gs = G.raster(sb.model, {});
  ok(gs.sy >= 11, 'a sailboat at 12 blocks still has its mast (' + gs.sy + ' high)');
}
// ---------------------------------------------------------------- photos (made-up pictures)
{
  const w = 60, h = 40, d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, inside = x >= 15 && x < 45 && y >= 10 && y < 32; d[i] = inside ? 200 : 245; d[i + 1] = inside ? 30 : 245; d[i + 2] = inside ? 40 : 240; d[i + 3] = 255; }
  const ph = B.photoData(d, w, h);
  ok(ph.ok && ph.cut && ph.box.join() === '15,10,44,31', 'a red box on white: cut out, box ' + ph.box);
  ok(/^#c/.test(ph.main), 'its main colour is red (' + ph.main + ')');
  const rel = B.design({ photo: ph, size: 24 }); ok(rel.kind === 'model' && rel.photo && rel.model.parts[0].relief, 'a photo alone → a relief');
  const gr = G.raster(rel.model, {}); ok(gr && gr.sx === 24 && gr.sz >= 3 && gr.n > 300, 'the relief is 24 wide and has depth (' + [gr.sx, gr.sy, gr.sz, gr.n] + ')');
  const car = B.design({ text: 'Auto', photo: ph }); ok(car.recipe.colors.body && /^#c/.test(car.recipe.colors.body), 'photo + „Auto“ → a car in the photo’s red (' + car.recipe.colors.body + ')');
  // a house photo: sky, a grey roof, yellow walls
  const d2 = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; let c = [140, 190, 240]; if (x >= 10 && x < 50 && y >= 8 && y < 18) c = [70, 72, 78]; if (x >= 12 && x < 48 && y >= 18 && y < 38) c = [235, 200, 90]; d2[i] = c[0]; d2[i + 1] = c[1]; d2[i + 2] = c[2]; d2[i + 3] = 255; }
  const hp = B.photoData(d2, w, h), hs = B.design({ text: 'Haus', photo: hp });
  ok(hs.kind === 'house' && /^#(e|d|f)/.test(hs.spec.walls.color) && /^#4/.test(hs.spec.roof.color), 'photo of a house + „Haus“ → yellow walls, grey roof (' + hs.spec.walls.color + ', ' + hs.spec.roof.color + ')');
  const hw = B.design({ photo: hp, want: 'house' }); ok(hw.kind === 'house', 'a photo from the Baukasten (want: house) → a house');
}
// ---------------------------------------------------------------- words
{
  ok(B.norm('Grün, Tür & Straße!') === 'grun , tur strasse', 'umlauts folded, punctuation kept as commas (' + B.norm('Grün, Tür & Straße!') + ')');
  ok(B.norm('gruene Tuer') === 'grune tur' && B.norm('Statue') === 'statue' && B.norm('aktuell') === 'aktuell', 'ue → u, but not in Statue or aktuell');
  ok(B.textOf('ein Schild mit der Aufschrift Willkommen daheim, in Gold') === 'Willkommen daheim', 'the words of a sign (' + B.textOf('ein Schild mit der Aufschrift Willkommen daheim, in Gold') + ')');
  ok(B.textOf('Schriftzug „Leo & Mia“') === 'Leo & Mia', 'quoted words');
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
