// The Forge (🏭): DNA ↔ parameters, the German/English text parser, variants and tweaks; every type × every style
// builds deterministically within its size and time budgets; towers have a staircase to every floor and windows on
// every storey; houses have a reachable door and furnished rooms; bridges keep a continuous deck, railings and piers
// down to the ground profile; parks, castles, halls, lookouts, walls and shuttles hold what they promise.
//   node test/forge.js            everything
//   ONLY=core node test/forge.js  one section (core · kit · tower · house · bridge · civic · park · sweep)
require('./load_shared.js');
const Forge = VR.Forge, R = VR.R, T = R.T, F = VR.F;
const ONLY = process.env.ONLY || '';
let fails = 0, n = 0;
const check = (ok, msg) => { n++; if (!ok) { fails++; console.log('  ✗ ' + msg); } else if (process.env.VERBOSE) console.log('  ✓ ' + msg); };
const section = (name, fn) => { if (ONLY && ONLY !== name) return; console.log('— ' + name); try { fn(); } catch (e) { fails++; console.log('  ✗ ' + name + ' threw: ' + (e && e.stack || e)); } };
// the CPU time of a build (median of runs): other processes on a shared machine do not count against the budget
const ms = (fn, runs) => { const t = []; for (let i = 0; i < (runs || 3); i++) { const c0 = process.cpuUsage(); fn(); const c = process.cpuUsage(c0); t.push((c.user + c.system) / 1000); } t.sort((a, b) => a - b); return t[t.length >> 1]; };
const nameOf = (s) => (s && s !== 0xFFFF && R.types[T.type[s]] ? R.types[T.type[s]].name : s === 0xFFFF ? 'keep' : 'air');
const isModel = (s) => { if (!s || s === 0xFFFF) return false; const t = R.types[T.type[s]]; return !!(t && (t.o.vxModel || /^vm_/.test(t.name))); };
const isGlass = (s) => { if (!s || s === 0xFFFF) return false; const nm = nameOf(s); return /glass|window|panorama|pane|vx_win|frosted/.test(nm); };
const cell = (g, x, y, z) => (x < 0 || y < 0 || z < 0 || x >= g.sx || y >= g.sy || z >= g.sz) ? 0xFFFF : g.blocks[(y * g.sz + z) * g.sx + x];
const count = (g, pred, y0, y1) => { let k = 0; const a = y0 === undefined ? 0 : y0, b = y1 === undefined ? g.sy - 1 : y1; for (let y = a; y <= b; y++) for (let z = 0; z < g.sz; z++) for (let x = 0; x < g.sx; x++) if (pred(g.blocks[(y * g.sz + z) * g.sx + x], x, y, z)) k++; return k; };

// ---------------------------------------------------------------- core: DNA, parser, variants, tweak
section('core', () => {
  check(Forge && Array.isArray(Forge.types) && Forge.types.length >= 9, 'at least nine types registered: ' + (Forge && Forge.types.map(t => t.icon + t.id).join(' ')));
  const p = Forge.parse('tower:f42,w18,d18,glas,c2#9f3a');
  check(p.type === 'tower' && p.params.f === 42 && p.params.w === 18 && p.params.d === 18 && p.style === 'glas' && p.params.c === 2 && p.seed === 0x9f3a, 'parse tower DNA: ' + JSON.stringify(p));
  check(Forge.dna('tower', { f: 42, w: 18, d: 18, c: 2 }, 0x9f3a, 'glas') === 'tower:f42,w18,d18,glas,c2#9f3a', 'canonical DNA (defaults omitted, style, seed): ' + Forge.dna('tower', { f: 42, w: 18, d: 18, c: 2 }, 0x9f3a, 'glas'));
  for (const t of Forge.types) {
    const d = Forge.dna(t.id, {}, 1, t.styles[0].id), q = Forge.parse(d);
    check(Forge.dna(q.type, q.params, q.seed, q.style) === d, 'round trip ' + t.id + ': ' + d);
    check(t.params.length >= 4 && t.params.length <= 8 && t.styles.length >= 3 && t.styles.length <= 5, t.id + ' has 4–8 params (' + t.params.length + ') and 3–5 styles (' + t.styles.length + ')');
    for (const pr of t.params) check(pr.def >= pr.min && pr.def <= pr.max && /^[a-z]$/.test(pr.k) && pr.label, t.id + ' param ' + pr.k + ' well formed');
  }
  const cl = Forge.parse('tower:f999,zzz,w1');
  check(cl.params.f === 80 && cl.params.w === 12 && cl.style === 'glas', 'out of range is clamped, unknown tokens ignored: ' + JSON.stringify(cl));
  check(Forge.parse('nonsense') === null && Forge.parse('') === null && Forge.parse(null) === null, 'unknown type → null');
  // text → DNA
  const tx = (s) => Forge.fromText(s);
  const px = (s) => Forge.parse(tx(s) || '');
  check(/^tower:f40/.test(tx('Hochhaus 40 Stockwerke mit Dachgarten')) && px('Hochhaus 40 Stockwerke mit Dachgarten').params.c === 1, 'DE: Hochhaus 40 Stockwerke mit Dachgarten → ' + tx('Hochhaus 40 Stockwerke mit Dachgarten'));
  check(/^house:/.test(tx('modern house two floors flat roof')) && px('modern house two floors flat roof').params.f === 2 && px('modern house two floors flat roof').params.r === 0, 'EN: modern house two floors flat roof → ' + tx('modern house two floors flat roof'));
  check(/^house:/.test(tx('Haus mit Pultdach')) && px('Haus mit Pultdach').params.r === 1, 'DE: Pultdach → r1: ' + tx('Haus mit Pultdach'));
  check(/^bridge:/.test(tx('Brücke 60 lang')) && px('Brücke 60 lang').params.l === 60, 'DE: Brücke 60 lang → ' + tx('Brücke 60 lang'));
  check(px('Hängebrücke über 80 Blöcke').params.k === 2 && px('Hängebrücke über 80 Blöcke').params.l === 80, 'DE: Hängebrücke → kind 2, 80 long: ' + tx('Hängebrücke über 80 Blöcke'));
  check(/^tower:/.test(tx('skyscraper glass')) && px('skyscraper glass').style === 'glas', 'EN: skyscraper glass → ' + tx('skyscraper glass'));
  check(px('Haus ohne Balkon').params.b === 0 && px('Haus mit Balkon').params.b === 1, 'DE: ohne Balkon / mit Balkon');
  check(px('Burg aus Sandstein mit Bergfried').style === 'sandstein' && px('Burg aus Sandstein mit Bergfried').params.k === 1, 'DE: Burg aus Sandstein mit Bergfried: ' + tx('Burg aus Sandstein mit Bergfried'));
  check(/^lookout:/.test(tx('Aussichtsturm 30 hoch aus Holz')) && px('Aussichtsturm 30 hoch aus Holz').params.h === 30 && px('Aussichtsturm 30 hoch aus Holz').style === 'holz', 'DE: Aussichtsturm 30 hoch aus Holz: ' + tx('Aussichtsturm 30 hoch aus Holz'));
  check(/^hall:/.test(tx('Markthalle')) && px('Markthalle').params.m === 1, 'DE: Markthalle → market stalls');
  check(/^shuttle:/.test(tx('ein Shuttle')) && /^shuttle:/.test(tx('spaceship')), 'shuttle / spaceship');
  check(/^park:/.test(tx('Park mit Teich und Brunnen')) && px('Park mit Teich und Brunnen').params.p === 1 && px('Park mit Teich und Brunnen').params.f === 1, 'DE: Park mit Teich und Brunnen');
  check(/^wall:/.test(tx('Zaun 30 lang')) && px('Zaun 30 lang').params.k === 1 && px('Zaun 30 lang').params.l === 30, 'DE: Zaun 30 lang: ' + tx('Zaun 30 lang'));
  check(/^wall:/.test(tx('a stone wall')) && px('a stone wall').params.k === 0 && px('a stone wall').style === 'stein', 'EN: a stone wall');
  check(px('großes Hochhaus').params.f > Forge.type('tower').param('f').def, 'groß makes it taller');
  check(tx('blau') === null && tx('') === null, 'no type → null');
  check(px('Wolkenkratzer 12 Etagen Backstein').style === 'backstein' && px('Wolkenkratzer 12 Etagen Backstein').params.f === 12, 'DE: Wolkenkratzer Backstein');
  check(px('Hochhaus Hochhaus 7 Stockwerke #abcd').seed === 0xabcd, 'a #hex seed in the text');
  // typos in the type word still name it; nothing else is guessed
  check(/^tower:f20/.test(tx('Hochaus 20 Stockwerke') || '') && /^tower:/.test(tx('Wolkenkrazer aus Glas') || '') && /^bridge:/.test(tx('Hängebrüke') || '') && /^castle:/.test(tx('Ritterbrug') || '') && tx('Hund') === null, 'typos: Hochaus, Wolkenkrazer, Hängebrüke, Ritterbrug → ' + [tx('Hochaus 20 Stockwerke'), tx('Wolkenkrazer aus Glas'), tx('Hängebrüke'), tx('Ritterbrug')].join(' '));
  check(Forge.parse('lookout:p4#1').params.p === 5 && Forge.parse('lookout:#1').params.p === 5 && Forge.parse('lookout:p7#1').params.p === 7 && Forge.parse('lookout:p3#1').params.p === 3, 'stepped parameters sit on their grid (3 · 5 · 7)');
  // the ✨ Genie's reading of words (VR.GenieBrain, the Studio's) and the Forge's own copy (the game's worker) agree
  try {
    require('../src/studio/genie_brain.js');
    const GB = VR.GenieBrain, phrases = ['Hochhaus 40 Stockwerke mit Dachgarten', 'modern house two floors flat roof', 'Brücke 60 lang', 'Hängebrücke über 80 Blöcke', 'Große Burg aus Sandstein mit Bergfried', 'Grüner Park mit Teich und Brunnen', 'Wolkenkratzer, 12 Etagen; Backstein!', 'Fußgängerbrücke aus Holz', 'Haus ohne Balkon, mit Pool', 'Aussichtsturm 30 hoch aus Holz', 'Zaun 30 lang', 'skyscraper glass', 'Rescue tower', 'Bürohochhaus „Tellus“ mit Helipad', 'Raumschiff Frachter mit Hangar'];
    const withGB = phrases.map(s => Forge.fromText(s)); const keep = VR.GenieBrain; VR.GenieBrain = null; const own = phrases.map(s => Forge.fromText(s)); VR.GenieBrain = keep;
    const diff = phrases.filter((s, i) => withGB[i] !== own[i] || GB.norm(s) !== Forge.ownNorm(s));
    check(diff.length === 0, 'the Genie\'s parser and the Forge\'s copy read ' + phrases.length + ' wishes the same' + (diff.length ? ': ' + diff.join(' | ') : ''));
  } catch (e) { check(false, 'genie_brain.js loads in node: ' + e.message); }
  // tweak
  const t0 = 'tower:f20,glas#1';
  check(Forge.parse(Forge.tweak(t0, 'höher')).params.f > 20 && Forge.parse(Forge.tweak(t0, 'niedriger')).params.f < 20, 'tweak höher / niedriger');
  check(Forge.parse(Forge.tweak(t0, 'breiter')).params.w > 20 && Forge.parse(Forge.tweak(t0, 'mehr Glas')).style === 'glas', 'tweak breiter / mehr Glas');
  check(Forge.parse(Forge.tweak('tower:f20,beton#1', 'mehr Glas')).style === 'glas', 'mehr Glas → style glas');
  check(Forge.parse(Forge.tweak('house:f1,weiss#1', 'mehr Glas')).params.g > Forge.parse('house:f1,weiss#1').params.g, 'house: mehr Glas → g+1');
  check(Forge.parse(Forge.tweak(t0, '30 Stockwerke')).params.f === 30, 'tweak with an absolute number keeps the type');
  check(Forge.parse(Forge.tweak(t0, 'mit Helipad')).params.c === 2 && Forge.parse(Forge.tweak(t0, 'mit Helipad')).params.f === 20, 'tweak adds a feature, keeps the rest');
  check(Forge.parse(Forge.tweak('bridge:l40,stahl#1', 'länger')).params.l > 40 && Forge.parse(Forge.tweak('bridge:l40,stahl#1', 'aus Stein')).style === 'stein', 'bridge tweaks');
  // variants
  const vs = Forge.variants(t0, 9);
  check(vs.length === 9 && vs[0] === t0 && new Set(vs).size === 9 && vs.every(v => Forge.parse(v) && Forge.parse(v).type === 'tower'), 'nine distinct nearby variants of the same type: ' + vs.join(' '));
  check(JSON.stringify(Forge.variants(t0, 9)) === JSON.stringify(vs), 'variants are deterministic');
  check(vs.slice(1).every(v => Math.abs(Forge.parse(v).params.f - 20) <= 6), 'variants stay near: floors within ±6');
  // describe
  check(/Hochhaus/.test(Forge.describe('tower:f10,glas#1')) && /10/.test(Forge.describe('tower:f10,glas#1')) && /Glas/.test(Forge.describe('tower:f10,glas#1')), 'describe (German): ' + Forge.describe('tower:f10,glas#1'));
  for (const t of Forge.types) check(typeof Forge.describe(Forge.dna(t.id, {}, 3, t.styles[1].id)) === 'string' && Forge.describe(Forge.dna(t.id, {}, 3, t.styles[1].id)).length > 4, 'describe ' + t.id + ': ' + Forge.describe(Forge.dna(t.id, {}, 3, t.styles[1].id)));
  const m = Forge.meta('bridge:l40,stahl#1');
  check(m && m.type === 'bridge' && m.lot[1] === 40 && m.terrain === true && m.level === false, 'meta without a build: ' + JSON.stringify(m));
  const mt = Forge.meta('tower:f10,w20,d16,glas#1');
  check(mt.lot[0] === 20 && mt.lot[1] === 16 && mt.level === true && !mt.terrain, 'tower meta: ' + JSON.stringify(mt));
});

// ---------------------------------------------------------------- the kit: stairwell, furnishing, walkability
section('kit', () => {
  const K = Forge.kit(6, 14, 10, 0);
  check(K.grid.sx === 6 && K.grid.sy === 14 && K.grid.sz === 10 && K.grid.blocks.length === 6 * 14 * 10 && K.grid.blocks[0] === 0xFFFF, 'a kit grid starts as keep-world');
  check(K.st('stone_bricks') === R.byName.stone_bricks.defaultState && K.st('no_such_block_xyz') === 0, 'states by name, unknown → air (no throw)');
  K.box(0, 0, 0, 5, 0, 9, 'stone_bricks');            // the floor slab
  K.box(0, 1, 0, 5, 12, 9, 'air');                      // room
  K.box(0, 4, 0, 5, 4, 9, 'stone_bricks'); K.box(0, 8, 0, 5, 8, 9, 'stone_bricks');   // two more slabs (SH = 4)
  const sw = K.stairwell(1, 0, 2, 3, 4, 'stone_brick_stairs', 'stone_bricks');
  check(sw && sw.landings.length === 3, 'a scissor stair for three floors returns a landing per floor: ' + JSON.stringify(sw && sw.landings));
  const wk = Forge.walkable(K.grid, [4, 1, 1], {});
  check(wk.floors.includes(1) && wk.floors.includes(5) && wk.floors.includes(9), 'from the ground every floor is reached without ladders: ' + JSON.stringify(wk.floors));
  // furnishing through the villa designer
  const K2 = Forge.kit(12, 8, 12, 0);
  K2.box(0, 0, 0, 11, 0, 11, 'floor_oak'); K2.box(0, 1, 0, 11, 5, 11, 'air'); K2.shell(0, 1, 0, 11, 4, 11, 'stucco_white'); K2.box(0, 5, 0, 11, 5, 11, 'stucco_white');
  const rooms = [{ fi: 0, u0: 1, v0: 1, u1: 10, v1: 10, type: 'living', doors: [{ u: 5, v: 1, side: 0 }], windows: [] }];
  const info = K2.furnish({ u0: 0, v0: 0, w: 12, d: 12, floors: [{ y: 0, rect: [0, 0, 11, 11], rooms }], entry: { u: 5, n: 1 } }, 0, 'bauhaus', new VR.RNG(5), 5);
  check(count(K2.grid, isModel) >= 8, 'a living room furnished by the villa designer holds ≥ 8 model cells: ' + count(K2.grid, isModel));
  check(info && Array.isArray(info.seats) && info.seats.length >= 2, 'the info record collects seats: ' + (info && info.seats.length));
  const ops = Forge.ops({ sx: 2, sy: 2, sz: 2, blocks: Uint16Array.from([1, 2, 0xFFFF, 3, 0, 4, 5, 6]), dy: -1 });
  check(ops.length === 7 * 4 && ops[1] === -1 && ops[3] === 1, 'ops: every non-keep cell as [u, y, v, state] with y = dy + gy: ' + ops.length);
  { const g = { sx: 1, sy: 4, sz: 1, dy: -1, blocks: Uint16Array.from([5, 0, 0, 0]) };   // rows −1 … 2
    const a = Forge.ops(g), b = Forge.ops(g, 1); check(a.length === 16 && b.length === 8 && b[1] === -1 && b[5] === 2, 'ops without the air the levelling clears anyway (rows 0 … clearTo): ' + a.length / 4 + ' → ' + b.length / 4); }
  check(JSON.stringify(Forge.slices(100000, 24000)) === JSON.stringify([[0, 24000], [24000, 48000], [48000, 72000], [72000, 96000], [96000, 100000]]) && Forge.slices(10, 24000).length === 1, 'slices');
});

// ---------------------------------------------------------------- 🏢
section('tower', () => {
  const tw = Forge.type('tower');
  for (const st of tw.styles) for (const u of [0, 1]) {
    const dna = Forge.dna('tower', { f: 12, w: 20, d: 18, u }, 7, st.id), g = Forge.build(dna), M = g.meta;
    check(g && g.sx === 20 && g.sz === 18 && M.lot[0] === 20 && M.lot[1] === 18, dna + ' builds on its lot');
    check(M.floors.length === 12 && g.sy >= 12 * M.sh + 3, dna + ' twelve floors, ' + g.sy + ' high');
    check(M.doors.length >= 1 && cell(g, M.doors[0][0], M.doors[0][1] - g.dy, M.doors[0][2]) !== 0xFFFF, dna + ' has a door');
    const wk = Forge.walkable(g, [M.doors[0][0], M.doors[0][1] - g.dy, M.doors[0][2] + 1], {});
    const hit = M.floors.filter(y => wk.floors.includes(y - g.dy + 1));
    check(hit.length === M.floors.length, dna + ' staircase reaches every floor without ladders: ' + hit.length + '/' + M.floors.length);
    check(M.roof === M.floors[M.floors.length - 1] + M.sh && wk.floors.includes(M.roof - g.dy + 1), dna + ' … and goes on up onto the roof (' + (M.roof - g.dy + 1) + ')');
    const perFloor = M.floors.map(y => count(g, (s, x, yy, z) => isGlass(s) && (x === 0 || z === 0 || x === g.sx - 1 || z === g.sz - 1 || true), y - g.dy + 1, y - g.dy + M.sh - 1));
    check(perFloor.every(k => k >= 4), dna + ' glass on every storey: ' + perFloor.slice(0, 4).join('/') + '…');
    const furn = M.floors.slice(1).map(y => count(g, isModel, y - g.dy + 1, y - g.dy + M.sh - 1));
    check(furn.every(k => k >= 6), dna + ' every floor above the lobby is furnished: ' + furn.slice(0, 4).join('/') + '…');
    check(count(g, isModel, M.floors[0] - g.dy + 1, M.floors[0] - g.dy + M.sh) >= 6, dna + ' lobby furnished');
  }
  for (const c of [0, 1, 2, 3]) { const g = Forge.build(Forge.dna('tower', { f: 8, c }, 3, 'beton')); check(g.meta.top >= 8 * g.meta.sh, 'crown ' + c + ' builds, top ' + g.meta.top); }
  const big = Forge.dna('tower', { f: 32, w: 30, d: 30 }, 9, 'glas');
  const t = ms(() => Forge.build(big), 3);
  check(t < 1000, '30×160×30 tower builds in < 1000 ms (median ' + t.toFixed(0) + ' ms)');
  check(Forge.hash(Forge.build(big)) === Forge.hash(Forge.build(big)), 'the same DNA → the same grid');
  const g80 = Forge.build(Forge.dna('tower', { f: 80, w: 40, d: 40, s: 3 }, 1, 'tech'));
  check(g80.blocks.length * 2 < 16e6, 'f80 w40 d40 stays under 16 MB: ' + (g80.blocks.length * 2 / 1e6).toFixed(1) + ' MB');
  check(Forge.build('tower:f999,zzz#2').meta.floors.length === 80, 'garbage DNA still builds (clamped)');
});

// ---------------------------------------------------------------- 🏠
section('house', () => {
  const hs = Forge.type('house');
  for (const st of hs.styles) for (const f of [1, 2, 3]) {
    const dna = Forge.dna('house', { f, r: f & 1, t: 1, c: f === 2 ? 1 : 0, b: 1, p: f === 3 ? 1 : 0 }, 11 + f, st.id);
    const t = ms(() => Forge.build(dna), 3), g = Forge.build(dna), M = g.meta;
    check(g.sx <= 31 && g.sz <= 25 && t < 60, dna + ' ≤ 31×25 and quick (' + g.sx + '×' + g.sz + ', ' + t.toFixed(1) + ' ms)');
    check(M.floors.length === f, dna + ' has ' + f + ' floors');
    const d = M.doors[0];
    check(d && cell(g, d[0], d[1] - g.dy, d[2]) !== 0xFFFF, dna + ' has a door');
    const wk = Forge.walkable(g, [d[0], d[1] - g.dy, d[2] - 1], {});
    check(wk.reach.has(d[0] + ',' + (d[1] - g.dy) + ',' + (d[2] + 1)), dna + ' the door is reachable from the street');
    const hit = M.floors.filter(y => wk.floors.includes(y - g.dy + 1));
    check(hit.length === f, dna + ' every floor reachable by stairs: ' + hit.length + '/' + f);
    const furn = M.floors.map(y => count(g, isModel, y - g.dy + 1, y - g.dy + M.sh - 1));
    check(furn[0] >= 12 && furn.slice(1).every(k => k >= 8), dna + ' furnished: ' + furn.join('/'));
  }
  const nb = Forge.build('house:f2,b0,weiss#3'), wb = Forge.build('house:f2,b1,weiss#3');
  check(count(wb, (s) => nameOf(s) === 'glass_rail') > count(nb, (s) => nameOf(s) === 'glass_rail'), 'b1 adds a balcony railing, b0 has none');
  check(Forge.hash(Forge.build('house:f2,weiss#3')) === Forge.hash(Forge.build('house:f2,weiss#3')), 'deterministic');
});

// ---------------------------------------------------------------- 🌉 🧱
section('bridge', () => {
  const prof = (u, v) => Math.min(-1, -3 - Math.round(6 * Math.sin(v / 7)));   // the ground under the deck (never above it)
  const br = Forge.type('bridge');
  for (const st of br.styles) for (const k of [0, 1, 2]) {
    const dna = Forge.dna('bridge', { l: 48, w: 5, k, m: 1 }, 5, st.id), g = Forge.build(dna, { ground: prof, depth: 48 }), M = g.meta;
    check(g.sz === 48 && M.lot[1] === 48 && !M.level && M.terrain, dna + ' spans 48 along v');
    const deckY = -g.dy, mid = g.sx >> 1;
    let gaps = 0; for (let v = 0; v < g.sz; v++) { const s = cell(g, mid, deckY, v); if (!s || s === 0xFFFF) gaps++; }
    check(gaps === 0, dna + ' deck continuous (' + gaps + ' gaps)');
    let rails = 0; for (let v = 0; v < g.sz; v++) for (const x of [0, g.sx - 1]) { const s = cell(g, x, deckY + 1, v); if (s && s !== 0xFFFF) rails++; }
    check(rails >= 2 * (g.sz - 4), dna + ' railings on both edges: ' + rails);
    // every pier (a column that touches the ground) is solid from the ground up to the deck, nothing is written into the
    // ground itself, and no stretch of twenty cells goes without one
    let piers = 0, bad = 0, below = 0; const pierV = new Set();
    for (let v = 0; v < g.sz; v++) for (let x = 0; x < g.sx; x++) {
      const gy = prof(x, v), base = deckY + gy + 1;
      for (let y = deckY + gy - 1; y >= 0; y--) { const s = cell(g, x, y, v); if (s && s !== 0xFFFF) { below++; break; } }   // (the top ground block may carry a girder)
      const sb = cell(g, x, base, v); if (!sb || sb === 0xFFFF) continue;
      piers++; pierV.add(v);
      for (let y = base; y <= deckY - 1; y++) { const s = cell(g, x, y, v); if (!s || s === 0xFFFF) { bad++; break; } }
    }
    let gap = 0; for (let v0 = 0; v0 + 20 <= g.sz; v0++) { let any = false; for (let v = v0; v < v0 + 20; v++) if (pierV.has(v)) any = true; if (!any) gap++; }
    check(piers > 0 && bad === 0 && gap === 0, dna + ' piers reach the ground without gaps (' + piers + ' columns, ' + bad + ' broken, ' + gap + ' stretches without a pier)');
    check(below === 0, dna + ' nothing written into the ground under a pier (' + below + ')');
    if (k === 2) { let top = 0; for (let y = g.sy - 1; y > deckY; y--) { if (count(g, (s) => s && s !== 0xFFFF, y, y) > 0) { top = y; break; } } check(top - deckY >= 8, dna + ' towers rise ≥ 8 over the deck: ' + (top - deckY)); }
  }
  // the deck is walkable from one bank to the other (headroom cleared over it), also where it cuts into a hill
  for (const dna of ['bridge:l60,k1,stein#3', 'bridge:l80,k2,stahl#4', 'bridge:l30,w3,k0,holz#5']) {
    for (const [nm, gp] of [['valley', prof], ['into a hill', (u, v) => (v > 20 ? 3 : -6)]]) {
      const g = Forge.build(dna, { ground: gp }), wk = Forge.walkable(g, [g.sx >> 1, -g.dy + 1, 0], {});
      check(wk.reach.has((g.sx >> 1) + ',' + (-g.dy + 1) + ',' + (g.sz - 1)), dna + ' (' + nm + '): you walk the deck from bank to bank');
    }
  }
  check(count(Forge.build('bridge:l30,r1,holz#1'), (s) => nameOf(s) === 'asphalt_dash') === 0 && count(Forge.build('bridge:l30,r1,stahl#1'), (s) => nameOf(s) === 'asphalt_dash') > 0, 'a centre line only on asphalt');
  const deep = Forge.build('bridge:l30,k0,stahl#1', { ground: () => -60, depth: 48 });
  check(deep.dy >= -48, 'piers never go deeper than the box depth (dy ' + deep.dy + ')');
  const flat = Forge.build('bridge:l30,k0,stahl#1');
  check(flat.sz === 30 && flat.dy <= -1, 'builds without an environment (flat ground)');
  check(Forge.hash(Forge.build('bridge:l30,k2,stahl#1', { ground: prof })) === Forge.hash(Forge.build('bridge:l30,k2,stahl#1', { ground: prof })), 'deterministic');
  // walls follow the ground
  for (const st of Forge.type('wall').styles) for (const k of [0, 1, 2]) {
    const dna = Forge.dna('wall', { l: 24, h: 3, k, g: 1 }, 2, st.id), g = Forge.build(dna, { ground: prof, depth: 48 });
    let bad = 0, cols = 0;
    for (let v = 0; v < g.sz; v++) { const gy = prof(0, v) - g.dy; let lowest = -1; for (let y = 0; y < g.sy; y++) { const s = cell(g, g.sx >> 1, y, v); if (s && s !== 0xFFFF) { lowest = y; break; } } if (lowest < 0) continue; cols++; if (Math.abs(lowest - (gy + 1)) > 0) bad++; }
    check(cols >= 20 && bad === 0, dna + ' every segment stands on its ground (' + cols + ' columns, ' + bad + ' floating/buried)');
  }
  // up a hill (the ground above the placement floor) and down again: every column on its ground, the top steps in level
  // runs (never more than one block of zigzag between neighbours inside a run), pillars stand over both runs they join
  const hill = (u, v) => Math.round(6 * Math.sin(v / 9)) - 1;
  for (const st of Forge.type('wall').styles) for (const k of [0, 2]) {
    const dna = Forge.dna('wall', { l: 48, h: 3, k, g: 1 }, 4, st.id), g = Forge.build(dna, { ground: hill });
    let bad = 0, cols = 0, jag = 0; const tops = [];
    for (let v = 0; v < g.sz; v++) {
      let lo = -1, hi = -1; for (let y = 0; y < g.sy; y++) { const s = cell(g, 1, y, v); if (s && s !== 0xFFFF) { if (lo < 0) lo = y; hi = y; } }
      tops.push(hi); if (lo < 0) continue; cols++; if (lo !== hill(1, v) + 1 - g.dy) bad++;
    }
    for (let v = 1; v < g.sz; v++) if (tops[v] >= 0 && tops[v - 1] >= 0 && Math.abs(tops[v] - tops[v - 1]) > 4) jag++;   // (a pillar and its cap stand two over the higher run)
    check(cols >= 44 && bad === 0 && jag === 0 && g.meta.top >= 5 + 3, dna + ' over a hill: ' + cols + ' columns, ' + bad + ' off the ground, ' + jag + ' jumps over 4, top ' + g.meta.top);
  }
});

// ---------------------------------------------------------------- 🗼 🏛 🏰 (🏟)
section('civic', () => {
  for (const st of Forge.type('lookout').styles) for (const k of [0, 1]) {
    const dna = Forge.dna('lookout', { h: 20, k, r: k }, 4, st.id), t = ms(() => Forge.build(dna)), g = Forge.build(dna), M = g.meta;
    const wk = Forge.walkable(g, [M.doors[0][0], M.doors[0][1] - g.dy, M.doors[0][2] - 1], {});
    check(t < 300 && wk.floors.includes(M.top - g.dy + 1) || wk.floors.some(y => y >= M.platform - g.dy), dna + ' platform reachable by stairs (' + t.toFixed(0) + ' ms): ' + JSON.stringify(wk.floors.slice(-3)) + ' platform ' + (M.platform - g.dy));
  }
  for (const st of Forge.type('hall').styles) {
    const dna = Forge.dna('hall', { l: 32, w: 18, m: 1 }, 6, st.id), t = ms(() => Forge.build(dna)), g = Forge.build(dna), M = g.meta;
    let gaps = 0; for (let v = 0; v < g.sz; v++) { let any = false; for (let y = g.sy - 1; y >= 0; y--) { const s = cell(g, g.sx >> 1, y, v); if (s && s !== 0xFFFF) { any = true; break; } } if (!any) gaps++; }
    check(t < 300 && gaps === 0, dna + ' roof ridge without gaps (' + gaps + ', ' + t.toFixed(0) + ' ms)');
    check(count(g, isModel) >= 6, dna + ' market stalls: ' + count(g, isModel) + ' model cells');
    const wk = Forge.walkable(g, [M.doors[0][0], M.doors[0][1] - g.dy, M.doors[0][2] - 1], {});
    check(wk.reach.size > g.sx * g.sz / 3, dna + ' the hall floor is walkable from the gate: ' + wk.reach.size);
  }
  for (const st of Forge.type('castle').styles) for (const k of [0, 1]) {
    const dna = Forge.dna('castle', { w: 36, d: 32, h: 8, k, t: k }, 8, st.id), t = ms(() => Forge.build(dna)), g = Forge.build(dna), M = g.meta;
    const gx = g.sx >> 1;
    check(t < 400 && !cell(g, gx, -g.dy + 1, 0) && !cell(g, gx, -g.dy + 2, 0), dna + ' gate open (' + t.toFixed(0) + ' ms)');
    const wk = Forge.walkable(g, [gx, -g.dy + 1, -1 + 1], {});
    check(wk.floors.includes(M.walk - g.dy + 1), dna + ' wall walk reachable without ladders: ' + JSON.stringify(wk.floors.filter(y => y > 2).slice(0, 6)) + ' walk ' + (M.walk - g.dy + 1));
    check(M.towerTop - M.walk >= 4 && wk.floors.includes(M.towerTop - g.dy + 1), dna + ' the corner towers rise over the wall and their spiral stairs reach the top (' + (M.towerTop - g.dy + 1) + ')');
    if (k) {
      check(count(g, isModel) >= 10, dna + ' the keep is furnished: ' + count(g, isModel));
      const kf = M.keep.floors.filter(y => wk.floors.includes(y - g.dy + 1));
      check(M.keep.roof > M.towerTop && kf.length === M.keep.floors.length && wk.floors.includes(M.keep.roof - g.dy + 1), dna + ' the keep is the tallest tower, its stair reaches every floor (' + kf.length + '/' + M.keep.floors.length + ') and the battlements at ' + M.keep.roof);
    }
  }
  for (const st of Forge.type('stadium').styles) for (const P0 of [{}, { t: 12, r: 0, k: 1 }, { l: 50, w: 40, t: 4 }]) {
    const dna = Forge.dna('stadium', P0, 1, st.id), t = ms(() => Forge.build(dna), 1), g = Forge.build(dna), M = g.meta, d = M.doors[0];
    check(g.sx >= 40 && count(g, (s) => nameOf(s) === 'grass_block') > 600 && t < 400, dna + ' has a pitch (' + t.toFixed(0) + ' ms)');
    const wk = Forge.walkable(g, [d[0], d[1] - g.dy, d[2]], {});
    check(wk.floors.includes(M.floors[0] - g.dy + 1) && wk.floors.includes(M.floors[1] - g.dy + 1), dna + ' from the entrance down the tiers to the pitch and along the top walkway: ' + JSON.stringify(wk.floors));
  }
  check(Forge.describe('hall:m0,holz#1').startsWith('Werkhalle · ') && Forge.describe('hall:holz#1').startsWith('Markthalle · ') && Forge.describe('bridge:k2,stahl#1').startsWith('Hängebrücke') && Forge.describe('wall:k1,holz#1', true).startsWith('🧱 Zaun'), 'a structure says what it is: ' + [Forge.describe('hall:m0,holz#1'), Forge.describe('bridge:k2,stahl#1'), Forge.describe('wall:k1,holz#1', true)].join(' / '));
});

// ---------------------------------------------------------------- 🚀 🌳
section('park', () => {
  // 🚀 a ship of the game's starship generator on its pad, a gangway up to where the ship opens (or a hatch cut through
  // the hull), and from the foot of the gangway a person walks aboard to the helm
  let aboard = 0, tried = 0;
  for (const st of Forge.type('shuttle').styles) for (const a of [0, 1, 2, 3, 5, 6]) {
    const dna = Forge.dna('shuttle', { a, p: a & 1 ? 0 : 1, h: a === 3 ? 1 : 0, s: 1, g: 1 }, 21, st.id), t = ms(() => Forge.build(dna), 1), g = Forge.build(dna), M = g.meta;
    check(count(g, (s) => s && s !== 0xFFFF) > 200 && count(g, (s) => nameOf(s) === 'helm') === 1 && M.name && t < 300, dna + ' a whole ship with its helm: ' + M.name + ' (' + t.toFixed(0) + ' ms)');
    check(M.lot[0] === g.sx && M.lot[1] === g.sz && Forge.meta(dna).lot.join() === M.lot.join(), dna + ' the lot is known before the build: ' + M.lot.join(' × '));
    tried++;
    if (!M.hatch) continue;
    const d = M.doors[0], wk = Forge.walkable(g, [d[0], d[1] - g.dy, d[2]], {}), [hx, hy, hz] = M.helm;
    let near = false; for (const k of wk.reach) { const [x, y, z] = k.split(',').map(Number); if (Math.max(Math.abs(x - hx), Math.abs(z - hz)) <= 2 && Math.abs(y - (hy - g.dy)) <= 1) { near = true; break; } }
    check(near, dna + ' up the gangway and aboard to the helm (hatch ' + JSON.stringify(M.hatch) + ')');
    if (near) aboard++;
  }
  check(aboard >= tried * 0.7 && Forge.build('shuttle:sf#15').meta.hatch, 'most ships get a gangway you walk aboard (' + aboard + '/' + tried + '), the shuttle always');
  check(count(Forge.build('shuttle:sf,s1#5'), (s) => nameOf(s) === 'vx_console') >= 2 && count(Forge.build('shuttle:sf,s0#5'), (s) => nameOf(s) === 'vx_console') === 0, 'the ground station has its consoles');
  check(count(Forge.build('shuttle:sf,h1#5'), (s) => nameOf(s) === 'vx_tech_trim') > count(Forge.build('shuttle:sf,h0#5'), (s) => nameOf(s) === 'vx_tech_trim') + 20, 'the hangar stands over the pad');
  check(Forge.hash(Forge.build('shuttle:a0,sf#5')) === Forge.hash(Forge.build('shuttle:a0,sf#5')), 'deterministic shuttle');
  for (const st of Forge.type('park').styles) for (const [p, f] of [[1, 1], [0, 0]]) {
    const dna = Forge.dna('park', { w: 32, d: 28, t: 2, p, f }, 13, st.id), g = Forge.build(dna), M = g.meta;
    const water = count(g, (s) => /water/.test(nameOf(s)));
    check(p ? water >= 20 : water === 0, dna + ' pond ' + (p ? 'present' : 'absent') + ': ' + water);
    check(count(g, (s) => /lamppost/.test(nameOf(s))) >= 4, dna + ' lamps');
    check(count(g, (s) => /_log$/.test(nameOf(s))) >= 6, dna + ' trees: ' + count(g, (s) => /_log$/.test(nameOf(s))) + ' trunk cells');
    // the paths join the four edges
    const wk = Forge.walkable(g, [M.doors[0][0], M.doors[0][1] - g.dy, M.doors[0][2]], {});
    check(wk.reach.size > g.sx * g.sz * 0.3, dna + ' walkable from the gate across the park: ' + wk.reach.size);
    check(count(g, (s) => /bench/.test(nameOf(s))) >= 4, dna + ' benches');
  }
});

// ---------------------------------------------------------------- the game's placer (blueprints.js) in node: /bau puts
// a plan where you look, the worker's job (Forge.job) builds the piece, the lot is levelled, a big one goes in slices with
// one undo step, a person walks to every floor of what stands in the world, "/bau höher" takes it back and builds it
// taller on the same spot; a bridge over a valley reads the ground under it
section('place', () => {
  VR.ITEMS = VR.ITEMS || {};
  require('../src/main/blueprints.js');
  const store = new Map(); global.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  const S = (n) => R.byName[n].defaultState, GY = 63;
  let groundAt = () => GY;                                           // the land: flat at 63, or a valley for the bridge
  const edits = new Map(), K3 = (x, y, z) => x + ',' + y + ',' + z;
  const world = {
    getBlock: (x, y, z) => { const k = K3(x, y, z); if (edits.has(k)) return edits.get(k); const gy = groundAt(x, z); return y > gy ? 0 : y === gy ? S('grass_block') : y > gy - 4 ? S('dirt') : S('stone'); },
    col: () => ({ ready: true }), bulkSet: (list) => { for (const [x, y, z, s] of list) edits.set(K3(x, y, z), s); },
  };
  const toasts = [], chat = [];
  const gad = { wand: { undo: [] }, applyEdit(list, undo) { world.bulkSet(list); if (undo) this.wand.undo.push(undo); }, undo() { const u = this.wand.undo.pop(); if (u) world.bulkSet(u); }, noteBlock() {} };
  const player = { creative: true, pos: [0.5, GY + 1, 0.5], yaw: Math.PI, pitch: -0.08, eye: 1.6, eyePos() { return [this.pos[0], this.pos[1] + 1.6, this.pos[2]]; }, lookDir() { const cp = Math.cos(this.pitch); return [-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp]; }, unstick() {} };
  const g = gad.g = { world, meta: { id: 'w1' }, state: 'play', player, ui: { hint() {}, toast: (a, b) => toasts.push(b), chatLine: (t) => chat.push(t) }, pool: { direct: (i, msg, tr, cb) => cb(Forge.job(msg)) } };
  const B = new VR.Blueprints(gad);
  let slices = 0, maxSlice = 0;
  const run = () => { for (let i = 0; i < 400; i++) { if (B.slices) { const a = B.slices.at; B.tickSlices(0.06); if (B.slices) { slices++; maxSlice = Math.max(maxSlice, B.slices.at - a); } else slices++; } else B.tickPlans(0.6); if (B.plans && B.plans.every(p => p.status === 'built' || p.failed) && !B.slices) break; } };
  const ROT = [(u, v) => [u, v], (u, v) => [-v, u], (u, v) => [-u, -v], (u, v) => [v, -u]];
  // the built piece read back from the world into a lot-local grid, then walked from its door
  const readBack = (pl, bp) => { const W = bp.lot[0], D = bp.lot[1], y0 = bp.bottom, sy = bp.top - y0 + 3, gr = { sx: W, sy, sz: D, dy: y0, blocks: new Uint16Array(W * sy * D) }; for (let y = 0; y < sy; y++) for (let v = 0; v < D; v++) for (let u = 0; u < W; u++) { const q = ROT[pl.r & 3](u, v); gr.blocks[(y * D + v) * W + u] = world.getBlock(pl.ox + q[0], pl.F + y0 + y, pl.oz + q[1]); } return gr; };
  const levels = (pl) => { const bp = B.planPiece(pl), gr = readBack(pl, bp), d = bp.doors[0], wk = Forge.walkable(gr, [d[0], d[1] - gr.dy, d[2] + 1], {}); const want = bp.floors.concat([bp.roof]).map(y => y - gr.dy + 1); return { hit: want.filter(y => wk.floors.includes(y)).length, want: want.length, bp }; };
  B.forgeCommand('Hochhaus 30 Stockwerke Glas'.split(' '));
  const pl = B.plans.find(p => p.kind === 'forge');
  check(pl && /^tower:f30/.test(pl.dna) && pl.status === 'pending' && JSON.parse(store.get('r9si.plans.w1')).plans.length === 1, '/bau Hochhaus 30 Stockwerke Glas → a plan where you look, stored for the Studio: ' + (pl && pl.dna) + ' at ' + (pl && [pl.ox, pl.F, pl.oz, pl.r].join(' · ')));
  run();
  check(pl.status === 'built' && slices >= 3 && maxSlice <= 8000 && /Hochhaus gebaut/.test(toasts.join(' ')), 'the game built it in ' + slices + ' slices of at most ' + maxSlice + ' cells: ' + toasts.join(' · '));
  check(gad.wand.undo.length === 1 && gad.wand.undo[0].length > 16000, 'one undo step for the whole tower (' + (gad.wand.undo[0] || []).length + ' cells)');
  const L1 = levels(pl);
  check(L1.hit === L1.want && L1.want === 31, 'in the world a person walks from the door to all 30 floors and the roof: ' + L1.hit + '/' + L1.want);
  check(world.getBlock(pl.ox + 3, GY, pl.oz + 3) !== S('grass_block') && world.getBlock(pl.ox - 1, GY + 1, pl.oz - 1) === 0, 'the lot is paved, the verge around it clear');
  B.forgeCommand(['höher']);
  const pl2 = B.plans.find(p => p.kind === 'forge' && p.status === 'pending');
  check(pl2 && /^tower:f38/.test(pl2.dna) && pl2.ox === pl.ox && pl2.oz === pl.oz && gad.wand.undo.length === 0 && world.getBlock(pl.ox + 10, GY + 100, pl.oz + 10) === 0, '/bau höher takes the tower back (one Z) and plans it taller on the same spot: ' + (pl2 && pl2.dna));
  run();
  const L2 = levels(pl2);
  check(pl2.status === 'built' && L2.hit === L2.want && L2.want === 39 && JSON.parse(store.get('r9si.plans.w1')).plans.map(p => p.status).join() === 'built', 'the taller one stands, every floor reached (' + L2.hit + '/' + L2.want + '), the Studio sees one built plan');
  const nPlans = B.plans.length; B.forgeCommand(['Wackelpudding']);
  check(/ändert nichts|changes nothing/.test(chat[chat.length - 1]) && B.plans.length === nPlans, 'words that name nothing and change nothing: a hint, no plan: ' + chat[chat.length - 1]);
  // a bridge over a valley, placed on the near bank: the ground is read under it, the piers stand on the valley floor
  edits.clear(); groundAt = (x, z) => (z >= 10 && z <= 40 ? GY - 10 : GY); player.pos = [200.5, GY + 1, -6]; player.yaw = Math.PI; player.pitch = -0.4;
  B.forgeCommand('Bogenbrücke 40 lang aus Stein'.split(' '));
  const br = B.plans.find(p => p.kind === 'forge' && /^bridge/.test(p.dna));
  run();
  const bpb = br && B.planPiece(br);
  let piers = 0; if (bpb) for (let z = 10; z <= 40; z++) { const q = ROT[br.r & 3](bpb.lot[0] >> 1, 0); const s = world.getBlock(br.ox + q[0], GY - 9, z); if (s && s !== S('grass_block')) piers++; }
  check(br && br.status === 'built' && piers >= 2, 'a Bogenbrücke over a valley: built from the bank (' + (br && br.dna) + '), piers or arches down on the valley floor in ' + piers + ' rows');
  const deckOK = br && (() => { let ok = 0; for (let z = br.oz; z < br.oz + 40; z++) if (world.getBlock(br.ox + 2, br.F, z)) ok++; return ok; })();
  check(deckOK >= 38, 'its deck spans the valley at the height of the bank: ' + deckOK + '/40 cells');
});

// ---------------------------------------------------------------- the sweep: random parameter sets of every type with
// floors (a fixed seed — the same sets every run): the stairs reach every floor, the roof, the wall walk, the tower tops,
// the keep's battlements, the stadium's pitch and its top walkway; the lookout's platform; the halls are walkable
section('sweep', () => {
  const rng = new VR.RNG(12345), pick = (t) => { const P = {}; for (const p of t.params) P[p.k] = p.min + rng.int(p.max - p.min + 1); return P; };
  const missing = (g, from, ys) => { const wk = Forge.walkable(g, from, {}); return ys.filter(y => !wk.floors.includes(y)); };
  const bad = { tower: [], house: [], castle: [], stadium: [], lookout: [], hall: [] }, N = { tower: 40, house: 40, castle: 14, stadium: 12, lookout: 24, hall: 12 };
  let slow = 0;
  for (const id in N) for (let i = 0; i < N[id]; i++) {
    const t = Forge.type(id), P = pick(t); if (id === 'tower') P.f = 4 + rng.int(44);
    const dna = Forge.dna(id, P, 1 + i, t.styles[i % t.styles.length].id), g = Forge.build(dna), M = g.meta, d = M.doors[0], up = (y) => y - g.dy + 1;
    const c0 = process.cpuUsage(); Forge.build(dna); const cu = process.cpuUsage(c0); if ((cu.user + cu.system) / 1000 > 400) slow++;
    let miss;
    if (id === 'tower') miss = missing(g, [d[0], d[1] - g.dy, d[2] + 1], M.floors.map(up).concat([up(M.roof)]));
    else if (id === 'house') miss = missing(g, [d[0], d[1] - g.dy, d[2] - 1], M.floors.map(up));
    else if (id === 'castle') miss = missing(g, [g.sx >> 1, -g.dy + 1, 0], [up(M.walk), up(M.towerTop)].concat(M.keep ? M.keep.floors.map(up).concat([up(M.keep.roof)]) : []));
    else if (id === 'stadium') miss = missing(g, [d[0], d[1] - g.dy, d[2]], M.floors.map(up));
    else if (id === 'lookout') miss = missing(g, [d[0], d[1] - g.dy, d[2] - 1], [up(M.platform)]);
    else { const wk = Forge.walkable(g, [d[0], d[1] - g.dy, d[2] - 1], {}); miss = wk.reach.size > g.sx * g.sz / 3 ? [] : ['floor']; }
    if (miss.length) bad[id].push(dna + ' (' + miss.join(',') + ')');
  }
  for (const id in N) check(!bad[id].length, N[id] + ' random ' + id + 's: every level reached on foot' + (bad[id].length ? ' — not: ' + bad[id].slice(0, 4).join(' · ') : ''));
  check(slow === 0, 'every one of them built in under 400 ms (' + slow + ' slower)');
});

console.log(fails ? 'FAILED ' + fails + ' of ' + n : 'ALL OK (' + n + ' checks)');
process.exit(fails ? 1 : 0);
