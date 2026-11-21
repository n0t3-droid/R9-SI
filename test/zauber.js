// Zauberblick (the owner, 21 Nov: V should do something cooler when nothing is near): V with nothing in reach opens a
// six-second hologram of the land — the villages with their names and distances, Funke's scan (chests and ores glow through
// the ground), the animals near you, the way to the next target, and the next wow with its time.
//   a  Ctx: row 6 is the Zauberblick when it exists (else Funke, else the whisper); its words in both tables
//   b  Z.collect: villages (≤ 3, nearest first, within 2.5 km), animals (≤ 5 within 64 m), the target (once) — capped at
//      Z.MAX, each with icon, label and distance
//   c  Z.dist: metres below 1 km, km with one decimal (German comma) above
//   d  Z.place: a point in view sits where it is; one behind or outside sits on the screen's edge with an arrow angle
//   e  Z.wowLine: the next wow's words and its time ("jetzt" / "in 2 Min")
//   f  the open: 6 s, a second V closes it
const V = require('./load_shared.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
global.performance = global.performance || { now: () => Date.now() };
for (const f of ['i18n', 'lang_de', 'lang_en', 'ctx', 'zauber']) { try { require('../src/main/' + f + '.js'); } catch (e) { console.log('     (load ' + f + ': ' + e.message + ')'); } }
const C = V.Ctx, Z = V.Zauber;
check(!!Z, 'Z exists');
// a
if (C && C.resolve) {
  const r = C.resolve({ tool: null, vehicle: null, story: null, near: null, aim: null, funke: true, zauber: true });
  const r2 = C.resolve({ tool: null, vehicle: null, story: null, near: null, aim: null, funke: true, zauber: false });
  check(r.row === 6 && r.id === 'zauber' && r.act === 'zauber' && r2.id === 'funke', 'a  row 6: Zauberblick (' + r.id + '), without it Funke (' + r2.id + ')');
  const de = require('fs').readFileSync(__dirname + '/../src/main/lang_de.js', 'utf8'), en = require('fs').readFileSync(__dirname + '/../src/main/lang_en.js', 'utf8');
  const keys = ['g.ctx.zauber', 'g.zb.title', 'g.zb.wow', 'g.zb.now', 'g.zb.in', 'g.zb.way', 'g.zb.quiet'];
  check(keys.every(k => de.includes("'" + k + "'") && en.includes("'" + k + "'")), 'a  the words in both tables');
}
if (Z) {
  // b
  const P = [0, 70, 0];
  const c = { pos: P, lang: 'de',
    villages: [{ name: 'Fern', x: 3000, z: 0 }, { name: 'Lindau', x: 400, z: 300 }, { name: 'Ahorn', x: -900, z: 100 }, { name: 'Birk', x: 0, z: -1200 }, { name: 'Dorn', x: 2000, z: 1000 }],
    animals: [{ kind: 'fox', x: 10, y: 70, z: 5 }, { kind: 'rabbit', x: -20, y: 70, z: 3 }, { kind: 'deer', x: 90, y: 70, z: 0 }, { kind: 'heron', x: 30, y: 70, z: -30 }, { kind: 'x', x: 2, y: 70, z: 2 }, { kind: 'rabbit', x: 5, y: 70, z: 9 }, { kind: 'rabbit', x: 6, y: 70, z: -9 }],
    target: { name: 'Turmzitadelle', pos: [-400, 90, 300] } };
  const L = Z.collect(c);
  const vil = L.filter(i => i.type === 'village'), an = L.filter(i => i.type === 'animal'), tg = L.filter(i => i.type === 'way');
  check(vil.length === 3 && vil[0].label === 'Lindau' && !vil.some(v => v.label === 'Fern'), 'b  villages: ' + vil.map(v => v.label).join(', '));
  check(an.length === 5 && !an.some(a => a.d > 64) && an[0].d <= an[1].d, 'b  animals: ' + an.length + ' within 64 m, nearest first');
  check(tg.length === 1 && tg[0].label === 'Turmzitadelle' && L.length <= Z.MAX && L.every(i => i.icon && typeof i.d === 'number'), 'b  the way once; ' + L.length + ' marks ≤ ' + Z.MAX);
  // c
  check(Z.dist(42, 'de') === '42 m' && Z.dist(1530, 'de') === '1,5 km' && Z.dist(1530, 'en') === '1.5 km', 'c  ' + [Z.dist(42, 'de'), Z.dist(1530, 'de'), Z.dist(1530, 'en')].join(' · '));
  // d
  const a = Z.place([0.2, -0.1, 0.5, 1], 1000, 500, 40), b = Z.place([3, 0, 0.5, 1], 1000, 500, 40), cb = Z.place([0.2, 0.1, 0.5, -1], 1000, 500, 40);
  check(!a.edge && Math.abs(a.x - 600) < 1 && Math.abs(a.y - 275) < 1, 'd  in view: where it is (' + a.x + ', ' + a.y + ')');
  check(b.edge && b.x <= 960 && b.x >= 940 && cb.edge && cb.y >= 40 && cb.y <= 460 && typeof cb.ang === 'number', 'd  outside or behind: on the edge with an arrow');
  // e
  const w1 = Z.wowLine({ kind: 'sunset', eta: 0 }, 'de'), w2 = Z.wowLine({ kind: 'aurora', eta: 130 }, 'de'), w3 = Z.wowLine({ kind: 'what', eta: 20 }, 'en');
  check(/Sonnenuntergang/.test(w1) && /jetzt/.test(w1) && /Polarlicht/.test(w2) && /2 Min/.test(w2) && w3.length > 3, 'e  ' + [w1, w2, w3].join(' | '));
  // f
  check(Z.DUR === 6, 'f  six seconds');
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
