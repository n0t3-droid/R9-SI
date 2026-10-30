// a-builder · Bauplan-Stempel (src/main/stamp.js, VR.Stamp — pure, no DOM, no GL):
//  (a) the transforms: a quarter turn swaps the size (sx ↔ sz), moves a cell clockwise seen from above, turns a stair
//      east → south; four turns and two mirrors give the stamp back cell for cell and state for state; a mirror swaps a
//      door's hinge and keeps its half; air stays air
//  (b) encode / decode: a round trip keeps every cell; a bad string gives null, never a throw
//  (c) the ghost: only the faces that touch air (two blocks side by side: 10 faces), grouped by colour into ≤ 16 parts,
//      bounded by maxFaces; the vertex count is 6 a face
//  (d) the library: newest first, at most 12, an entry too big is refused; the stamp's offset puts it on the target
// usage: node test/stamp.js
const ROOT = require('path').join(__dirname, '..');
const VR = require(ROOT + '/test/load_shared.js');
require(ROOT + '/src/main/stamp.js');
const ST = VR.Stamp, R = VR.R;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
if (!ST) { console.log('  ✗ VR.Stamp exists'); console.log('FAILED 1'); process.exit(1); }
const S = (name, props) => { const t = R.byName[name]; let s = t.defaultState; for (const k in props || {}) s = t.with(s, k, props[k]); return s; };
const P = (s) => { const t = R.types[R.T.type[s]], o = { name: t.name }; for (const p of t.props) o[p.name] = t.getV(s, p.name); return o; };

// a 3 × 2 × 2 stamp: stone at (0,0,0), a stair facing east at (2,0,0), a door (left hinge, facing south) at (0,0,1) and
// (0,1,1), planks at (1,1,0)
const clip = ST.make(3, 2, 2);
const put = (c, x, y, z, s) => { c.data[(y * c.sz + z) * c.sx + x] = s; };
const get = (c, x, y, z) => c.data[(y * c.sz + z) * c.sx + x];
const stone = S('stone'), stair = S('oak_stairs', { facing: 'east' }), planks = S('oak_planks');
const doorB = S('oak_door', { facing: 'south', hinge: 'left', half: 'bottom' }), doorT = S('oak_door', { facing: 'south', hinge: 'left', half: 'top' });
put(clip, 0, 0, 0, stone); put(clip, 2, 0, 0, stair); put(clip, 0, 0, 1, doorB); put(clip, 0, 1, 1, doorT); put(clip, 1, 1, 0, planks);
const same = (a, b) => a.sx === b.sx && a.sy === b.sy && a.sz === b.sz && a.data.every((v, i) => v === b.data[i]);

// (a)
const r1 = ST.transform(clip, 1, false);
check(r1.sx === 2 && r1.sz === 3 && r1.sy === 2, `a quarter turn swaps the size (${r1.sx} × ${r1.sy} × ${r1.sz})`);
// clockwise from above: (x, z) → (sz − 1 − z, x): stone (0,0) → (1,0); the stair (2,0) → (1,2)
check(get(r1, 1, 0, 0) === stone, 'the stone moved clockwise');
check(P(get(r1, 1, 0, 2)).name === 'oak_stairs' && P(get(r1, 1, 0, 2)).facing === 'south', `the stair turned east → south (${JSON.stringify(P(get(r1, 1, 0, 2)))})`);
let r4 = clip; for (let i = 0; i < 4; i++) r4 = ST.transform(r4, 1, false);
check(same(r4, clip), 'four quarter turns give it back');
check(same(ST.transform(clip, 4, false), clip) && same(ST.transform(clip, -1, false), ST.transform(clip, 3, false)), 'rot 4 = rot 0; −1 = 3');
const m1 = ST.transform(clip, 0, true), m2 = ST.transform(m1, 0, true);
check(same(m2, clip), 'two mirrors give it back');
const md = P(get(m1, 2, 0, 1));
check(md.name === 'oak_door' && md.hinge === 'right' && md.half === 'bottom' && md.facing === 'south', `the mirror (along x) swaps the door's hinge (${JSON.stringify(md)})`);
check(P(get(m1, 0, 0, 0)).facing === 'west', 'and the stair faces west');
check(get(m1, 1, 0, 0) === 0 && get(r1, 1, 0, 1) === 0, 'air stays air');
const both = ST.transform(clip, 2, true);
check(both.sx === 3 && both.sz === 2 && ST.count(both) === ST.count(clip), `a half turn and a mirror keep every block (${ST.count(both)})`);

// (b)
const enc = ST.encode(clip);
check(typeof enc === 'string' && enc.length < 80, `encoded: ${enc.length} characters`);
const dec = ST.decode(enc);
check(dec && same(dec, clip), 'the round trip keeps every cell');
check(ST.decode('nonsense') === null && ST.decode('') === null && ST.decode(null) === null && ST.decode('S1|2|2|2|zz') === null, 'a bad string: null');
const big = ST.make(40, 20, 40); for (let i = 0; i < big.data.length; i += 3) big.data[i] = planks;
const encBig = ST.encode(big);
check(ST.decode(encBig) && same(ST.decode(encBig), big), `a 40 × 20 × 40 stamp round-trips (${encBig.length} chars)`);

// (c)
const bar = ST.make(2, 1, 1); bar.data[0] = stone; bar.data[1] = stone;
const col = () => [0.5, 0.5, 0.5];
const g1 = ST.ghost(bar, col, 10000);
check(g1.faces === 10 && g1.verts.length === 10 * 6 * 3, `two blocks side by side: 10 faces (${g1.faces})`);
const g2 = ST.ghost(clip, (s) => (s === stone ? [0.5, 0.5, 0.5] : [0.6, 0.4, 0.2]), 10000);
check(g2.parts.length >= 1 && g2.parts.length <= 16 && g2.parts.reduce((a, p) => a + p.n, 0) === g2.faces * 6, `parts by colour: ${g2.parts.length}, their vertices sum up`);
check(g2.parts.every(p => p.c.length === 4 && p.c[3] > 0 && p.c[3] < 1), 'every part translucent');
const g3 = ST.ghost(big, col, 500);
check(g3.faces <= 500 && g3.verts.length === g3.faces * 18, `bounded: ${g3.faces} faces of a big one`);
const rainbow = ST.make(40, 1, 1); for (let i = 0; i < 40; i++) rainbow.data[i] = 1 + i;
const g4 = ST.ghost(rainbow, (s) => [((s * 37) % 255) / 255, ((s * 91) % 255) / 255, ((s * 53) % 255) / 255], 10000);
check(g4.parts.length <= 16, `many colours: ≤ 16 parts (${g4.parts.length})`);

// (d)
let lib = [];
for (let i = 0; i < 14; i++) lib = ST.libAdd(lib, { name: 'B' + i, code: enc }, 12);
check(lib.length === 12 && lib[0].name === 'B13' && lib[11].name === 'B2', `newest first, at most 12 (${lib.length}, ${lib[0].name} … ${lib[11].name})`);
check(ST.libAdd(lib, { name: 'X', code: 'x'.repeat(ST.MAX_CODE + 1) }, 12) === lib, 'too big: refused');
const o = ST.origin(clip, 10, 64, 20);
check(o[0] === 10 - 1 && o[1] === 64 && o[2] === 20 - 1, `centred on the target, on its top (${o})`);

console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);
