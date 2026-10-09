// ✦ Formen (t-form, src/studio/formtools.js): the Crafter's shape tools on a voxel grid, without a page.
//   1. Drehkörper: the lathe of a vase profile is rotationally symmetric (a quarter turn and a mirror give the same voxels),
//      follows its profile (the widest ring at the belly, the narrow neck), and a wall of 2 leaves it hollow with a floor
//   2. Extrusion: a straight path fills exactly its width (round and square sections), a path with a bend leaves no gap at
//      the joint, the square section has its height
//   3. Abrunden: on a box the bevel takes exactly the convex edge voxels (the quarter-circle rule of every edge, checked
//      against a formula of its own) and nothing else; a concave corner (an L) keeps its voxels; a two-voxel plate keeps its
//      edges; only the selection is touched
//   4. Kugel · Zylinder · Kegel with a sub-voxel radius: the voxel counts follow the volumes, the shapes stand where asked
//   5. the texts: every tx('ft.…') call has its key in both tables with the same German and English words
//   bash test/wt_run.sh formtools.js 300
global.VR = {};
require('../src/studio/formtools.js');
const FT = VR.FormTools, O = FT && FT.ops;
let fails = 0; const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
check(O && typeof O.lathe === 'function' && typeof O.extrude === 'function' && typeof O.bevel === 'function', 'the voxel functions load in node');
if (!O) { console.log('FAILED ' + fails); process.exit(1); }
const D = { VW: 32, VH: 32, VD: 32 }, N = 32 * 32 * 32, I = (x, y, z) => (y * 32 + z) * 32 + x;
const setOf = (list) => new Set(list.map(([x, y, z]) => I(x, y, z)));

// ---------------------------------------------------------------- 1. Drehkörper
console.log('1. Drehkörper');
const vase = [[6.5, 0], [8, 2], [11.5, 9.5], [12.5, 14.5], [10, 21], [6, 25.5], [5.5, 29], [7.5, 32]];
const L = O.lathe(D, vase, 7), Ls = setOf(L);
check(L.length > 2000 && L.every(c => c[3] === 7), `${L.length} voxels in the material asked for`);
let rot = 0, mir = 0;
for (const [x, y, z] of L) { if (!Ls.has(I(31 - z, y, x))) rot++; if (!Ls.has(I(31 - x, y, z))) mir++; }
check(rot === 0 && mir === 0, `rotationally symmetric: a quarter turn and a mirror give the same voxels (${rot} / ${mir} differ)`);
const ring = (y) => { let r = 0; for (const [x, yy, z] of L) if (yy === y) r = Math.max(r, Math.hypot(x + 0.5 - 16, z + 0.5 - 16)); return r; };
check(ring(14) > 11.5 && ring(14) <= 12.5 && ring(27) < 6.5, `it follows the profile: the belly ${ring(14).toFixed(1)} (12.5), the neck ${ring(27).toFixed(1)} (5.5…6)`);
const Lw = O.lathe(D, vase, 7, { wall: 2 }), Lws = setOf(Lw);
check(Lw.length < L.length * 0.6, `a wall of 2 leaves it hollow (${Lw.length} of ${L.length} voxels)`);
check(Lws.has(I(16, 0, 16)) && Lws.has(I(16, 1, 16)) && !Lws.has(I(16, 12, 16)), 'the floor stays, the middle is empty');
check(!Lws.has(I(16, 31, 16)), 'open at the top');

// ---------------------------------------------------------------- 2. Extrusion
console.log('2. Extrusion');
const across = (list, x, y) => { const zs = list.filter(c => c[0] === x && c[1] === y).map(c => c[2]); return zs.length ? Math.max(...zs) - Math.min(...zs) + 1 : 0; };
const E1 = O.extrude(D, [[4, 8, 16], [28, 8, 16]], { shape: 'circle', w: 6 }, 3);
check(across(E1, 16, 8) === 6 && E1.filter(c => c[0] === 16 && c[1] === 8).length === 6, `a round section of width 6: six voxels across the path (${across(E1, 16, 8)})`);
const ys = E1.filter(c => c[0] === 16 && c[2] === 16).map(c => c[1]);
check(Math.max(...ys) - Math.min(...ys) + 1 === 6, `and six high (${Math.max(...ys) - Math.min(...ys) + 1})`);
const E2 = O.extrude(D, [[4, 8, 16], [28, 8, 16]], { shape: 'box', w: 8, h: 4, round: 1 }, 3);
const ys2 = E2.filter(c => c[0] === 16 && c[2] === 16).map(c => c[1]);
check(across(E2, 16, 8) === 8 && Math.max(...ys2) - Math.min(...ys2) + 1 === 4, `a square section 8 wide, 4 high (${across(E2, 16, 8)} × ${Math.max(...ys2) - Math.min(...ys2) + 1})`);
check(!E2.some(c => c[0] < 4 || c[0] > 27), 'a square section ends flat at the path\'s ends');
// a bend: an L path; the joint is filled (no hole at the outer corner)
const E3 = O.extrude(D, [[4, 8.5, 6], [20, 8.5, 6], [20, 8.5, 26]], { shape: 'box', w: 4, h: 4 }, 3), E3s = setOf(E3);
let gap = 0; for (let x = 18; x <= 21; x++) for (let z = 4; z <= 7; z++) if (!E3s.has(I(x, 8, z))) gap++;
check(gap === 0, `the joint of a bend is filled (${gap} holes in its 4 × 4 corner)`);
// a curved light line: every voxel stays within half the width of the path
const arc = []; for (let k = 0; k <= 12; k++) { const a = k / 12 * Math.PI / 2; arc.push([4 + 22 * Math.sin(a), 2.5, 4 + 22 * (1 - Math.cos(a))]); }
const E4 = O.extrude(D, arc, { shape: 'circle', w: 2 }, 3);
let far = 0; for (const [x, y, z] of E4) { let dmin = 1e9; for (let k = 0; k + 1 < arc.length; k++) { const a = arc[k], b = arc[k + 1], t = Math.max(0, Math.min(1, ((x + 0.5 - a[0]) * (b[0] - a[0]) + (z + 0.5 - a[2]) * (b[2] - a[2])) / ((b[0] - a[0]) ** 2 + (b[2] - a[2]) ** 2))); dmin = Math.min(dmin, Math.hypot(x + 0.5 - a[0] - t * (b[0] - a[0]), y + 0.5 - 2.5, z + 0.5 - a[2] - t * (b[2] - a[2]))); } if (dmin > 1 + 1e-9) far++; }
check(E4.length > 40 && far === 0, `a curved line of width 2 (${E4.length} voxels) keeps to its path (${far} outside)`);

// ---------------------------------------------------------------- 3. Abrunden
console.log('3. Abrunden');
const vol = (fill) => { const V = new Uint32Array(N); for (let y = 0; y < 32; y++) for (let z = 0; z < 32; z++) for (let x = 0; x < 32; x++) if (fill(x, y, z)) V[I(x, y, z)] = 0x01FF0000; return V; };
// the box [6, 22) × [4, 18) × [8, 20): the expected bevel from the faces' distances alone
const bx = [6, 4, 8, 21, 17, 19], inBox = (x, y, z) => x >= bx[0] && x <= bx[3] && y >= bx[1] && y <= bx[4] && z >= bx[2] && z <= bx[5];
function expected(r) {
  const out = new Set();
  for (let y = bx[1]; y <= bx[4]; y++) for (let z = bx[2]; z <= bx[5]; z++) for (let x = bx[0]; x <= bx[3]; x++) {
    const c = [x, y, z], lo = [bx[0], bx[1], bx[2]], hi = [bx[3], bx[4], bx[5]];
    const d = [0, 1, 2].map(a => [c[a] - lo[a] + 0.5, hi[a] - c[a] + 0.5]), ext = [0, 1, 2].map(a => hi[a] - lo[a] + 1);
    let cut = false;
    for (const [a, b] of [[0, 1], [0, 2], [1, 2]]) { const re = Math.min(r, ext[a] / 2, ext[b] / 2); for (const da of d[a]) for (const db of d[b]) if (da < re && db < re && (re - da) ** 2 + (re - db) ** 2 > re * re) cut = true; }
    if (cut) out.add(I(x, y, z));
  }
  return out;
}
for (const r of [2, 3, 4]) {
  const V = vol(inBox), cut = setOf(O.bevel(V, D, [0, 0, 0, 31, 31, 31], r)), ex = expected(r);
  let miss = 0, extra = 0; for (const k of ex) if (!cut.has(k)) miss++; for (const k of cut) if (!ex.has(k)) extra++;
  check(miss === 0 && extra === 0 && cut.size > 0, `radius ${r}: exactly the convex edge voxels go (${cut.size} voxels; ${miss} missed, ${extra} too many)`);
}
const r1 = O.bevel(vol(inBox), D, [0, 0, 0, 31, 31, 31], 1);
check(r1.length === 0, 'radius 1 rounds less than half a voxel: no whole voxel goes (' + r1.length + ')');
// an L: the concave corner keeps its voxels
const Lsh = (x, y, z) => z >= 8 && z < 20 && ((x >= 4 && x < 26 && y >= 2 && y < 8) || (x >= 4 && x < 12 && y >= 8 && y < 24));
const cutL = O.bevel(vol(Lsh), D, [0, 0, 0, 31, 31, 31], 4);
const nearInner = cutL.filter(([x, y, z]) => x >= 10 && x <= 15 && y >= 6 && y <= 11 && z > 9 && z < 18);
check(cutL.length > 0 && nearInner.length === 0, `an L: its convex edges round (${cutL.length} voxels), the inner corner keeps its voxels (${nearInner.length} taken there)`);
// a plate two voxels thick keeps its edges at any radius
const plate = (x, y, z) => x >= 4 && x < 28 && z >= 4 && z < 28 && y >= 10 && y < 12;
const cutP = O.bevel(vol(plate), D, [0, 0, 0, 31, 31, 31], 4);
const edgeGone = cutP.filter(([x, y, z]) => (x === 4 || x === 27) && z > 8 && z < 24);
check(edgeGone.length === 0, `a two-voxel plate keeps its long edges (${edgeGone.length} taken; ${cutP.length} at its four corners in plan)`);
// only the selection
const sel = [6, 4, 8, 13, 17, 19], cutS = O.bevel(vol(inBox), D, sel, 4);
check(cutS.length > 0 && cutS.every(([x, y, z]) => x >= sel[0] && x <= sel[3] && y >= sel[1] && y <= sel[4] && z >= sel[2] && z <= sel[5]), `inside the selection only (${cutS.length} voxels, all in it)`);
check(cutS.every(([x, y, z]) => x !== 13 || !(y > 7 && y < 14)), 'the selection\'s side is no edge: the box goes on past it');

// ---------------------------------------------------------------- 4. the primitives
console.log('4. Kugel · Zylinder · Kegel');
const S1 = O.sphere(D, [16, 16, 16], 5.25, 9), vS = 4 / 3 * Math.PI * 5.25 ** 3;
check(Math.abs(S1.length - vS) / vS < 0.06, `Kugel r 5.25: ${S1.length} voxels for a volume of ${vS.toFixed(0)}`);
const S2 = O.sphere(D, [16, 16, 16], 5.5, 9);
check(S2.length > S1.length, `a quarter voxel more radius gives more voxels (${S2.length} > ${S1.length}): the radius is sub-voxel`);
const Cy = O.cylinder(D, [10.5, 2, 20.5], 3.75, 10, 9), vC = Math.PI * 3.75 ** 2 * 10;
check(Math.abs(Cy.length - vC) / vC < 0.08 && Math.min(...Cy.map(c => c[1])) === 2 && Math.max(...Cy.map(c => c[1])) === 11, `Zylinder r 3.75 h 10: ${Cy.length} voxels (${vC.toFixed(0)}), from y 2 to 11`);
const Co = O.cone(D, [16.5, 4, 16.5], 6, 12, 9), vK = Math.PI * 36 * 12 / 3;
check(Math.abs(Co.length - vK) / vK < 0.12, `Kegel r 6 h 12: ${Co.length} voxels (${vK.toFixed(0)})`);
const wide = (list, y) => list.filter(c => c[1] === y).length;
check(wide(Co, 4) > wide(Co, 9) && wide(Co, 9) > wide(Co, 14), 'the cone narrows upward');

// ---------------------------------------------------------------- 5. the texts
console.log('5. the texts');
const fs = require('fs'), path = require('path');
require('../src/main/i18n.js'); require('../src/main/lang_en.js'); require('../src/main/lang_de.js');
const de = VR.I18N.dict.de, en = VR.I18N.dict.en, src = fs.readFileSync(path.join(__dirname, '../src/studio/formtools.js'), 'utf8');
const calls = [...src.matchAll(/TX\('(ft\.[\w.]+)',\s*(?:null|\{[^}]*\}),\s*'((?:[^'\\]|\\.)*)',\s*'((?:[^'\\]|\\.)*)'\)/g)].map(m => ({ k: m[1], de: m[2].replace(/\\'/g, "'"), en: m[3].replace(/\\'/g, "'") }));
const keys = new Set(calls.map(c => c.k));
const miss = [...keys].filter(k => !(k in de) || !(k in en)), diff = calls.filter(c => de[c.k] !== c.de || en[c.k] !== c.en).map(c => c.k);
check(keys.size >= 20, `${keys.size} keys for the tools (Formen, Drehkörper, Extrusion, Abrunden, Kugel, Zylinder, Kegel, Glatt …)`);
check(!miss.length, 'every key is in both tables' + (miss.length ? ': ' + miss.join(', ') : ''));
check(!diff.length, 'the words at the call are the tables\' words' + (diff.length ? ': ' + [...new Set(diff)].join(', ') : ''));
check(['ft.group', 'ft.lathe', 'ft.extrude', 'ft.bevel', 'ft.sphere', 'ft.cylinder', 'ft.cone', 'ft.glatt'].every(k => de[k] && en[k]) && de['ft.lathe'] === 'Drehkörper' && de['ft.bevel'] === 'Abrunden' && de['ft.glatt'] === 'Glatt', 'the tool names in German: ' + ['ft.group', 'ft.lathe', 'ft.extrude', 'ft.bevel', 'ft.sphere', 'ft.cylinder', 'ft.cone', 'ft.glatt'].map(k => de[k]).join(', '));

console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);
