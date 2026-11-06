// q-art3 · Runde Kronen (src/shared/mesher.js VR.RoundCrown, src/main/qart3.js; plan
// docs/superpowers/plans/2026-11-06-q-art3.md), no browser:
//   a  the solver: a box crown's corners pulled in (rounded), its face middles flat, watertight across a section border
//   b  the mesher: fancyLeaves 2 → fewer cutout vertices (no inner faces), positions off the block grid, the opaque stream
//      the same; fancyLeaves true → the same streams as without the block (mesh_same pins that too)
//   c  the switch by preset (Very Low and Low off), its row, cost tier, texts, the wiring (game.js, build.js, settings_reg.js)
const fs = require('fs'), path = require('path');
const V = require('./load_shared.js');
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
const ROOT = path.join(__dirname, '..');
const PAD = V.MESH_PAD, PS = V.MESH_PS, PSS = PS * PS;
const LEAF = V.R.byName['oak_leaves'].defaultState, LOG = V.R.byName['oak_log'] ? V.R.byName['oak_log'].defaultState : 0;
const RC = V.RoundCrown;
check(!!RC && typeof RC.solver === 'function', 'VR.RoundCrown.solver exists');

// a section with a crown: leaves in the box [x0, x1) × [y0, y1) × [z0, z1) (section-local, may reach into the pad), a trunk
function job(x0, x1, y0, y1, z0, z1, fancy) {
  const blocks = new Uint16Array(PSS * PS), light = new Uint16Array(PSS * PS).fill(0xf000);
  for (let y = -PAD; y < 16 + PAD; y++) for (let z = -PAD; z < 16 + PAD; z++) for (let x = -PAD; x < 16 + PAD; x++) {
    const pi = (y + PAD) * PSS + (z + PAD) * PS + (x + PAD);
    if (x >= x0 && x < x1 && y >= y0 && y < y1 && z >= z0 && z < z1) { blocks[pi] = LEAF; light[pi] = 0xe000; }
    const tx = (x0 + x1) >> 1, tz = (z0 + z1) >> 1;
    if (LOG && x === tx && z === tz && y < y0) { blocks[pi] = LOG; light[pi] = 0; }
  }
  const t = new Uint16Array(PSS).fill(0x4d6a);
  return { blocks, light, grass: t, foliage: t, water: t, sy: 4, ox: 0, oz: 0, smooth: true, fancyLeaves: fancy, vxLod: true };
}
const P = (x, y, z) => (y + PAD) * PSS + (z + PAD) * PS + (x + PAD);

if (RC && RC.solver) {
  // a  a 6 × 5 × 6 crown at [4,10) × [6,11) × [4,10)
  const j = job(4, 10, 6, 11, 4, 10, 2), S = RC.solver(j.blocks, V.R.T.flags), v = [0, 0, 0];
  // the vertex of the dual cell at the box's top corner (corner point (10, 11, 10) → cell (9, 10, 9))
  S.vert(9, 10, 9, v);
  const dc = Math.hypot(v[0] - 10, v[1] - 11, v[2] - 10);
  check(dc > 0.45, 'a crown corner is rounded: its vertex pulled in from the box corner', dc.toFixed(2));
  // the middle of the top face (point (7, 11, 7) → cell (6, 10, 6)) stays on the face
  S.vert(6, 10, 6, v);
  check(Math.abs(v[1] - 11) < 0.08 && Math.abs(v[0] - 7) < 0.08, 'a crown face middle stays flat on its face', v.map(a => a.toFixed(2)).join(','));
  // an edge middle (point (7, 11, 10) → cell (6, 10, 9)): in from both faces
  S.vert(6, 10, 9, v);
  check(v[1] < 10.9 && v[2] < 9.9, 'a crown edge is rounded', v.map(a => a.toFixed(2)).join(','));
  // watertight: a crown across the border x = 16 — the cells on the border from both sections alike
  const jA = job(12, 20, 6, 11, 4, 10, 2), jB = job(-4, 4, 6, 11, 4, 10, 2);
  const SA = RC.solver(jA.blocks, V.R.T.flags), a = [0, 0, 0], b = [0, 0, 0];
  const vertsA = [];
  for (let y = 5; y <= 11; y++) for (let z = 3; z <= 10; z++) { SA.vert(15, y, z, a); vertsA.push(a.slice()); }
  const SB = RC.solver(jB.blocks, V.R.T.flags);
  let worst = 0, k = 0;
  for (let y = 5; y <= 11; y++) for (let z = 3; z <= 10; z++) { SB.vert(-1, y, z, b); const A = vertsA[k++]; worst = Math.max(worst, Math.abs(A[0] - 16 - b[0]), Math.abs(A[1] - b[1]), Math.abs(A[2] - b[2])); }
  check(worst < 1e-5, 'watertight: the border cells the same from both sections', worst.toExponential(1));

  // b  the mesher
  const r1 = V.meshSection(job(4, 10, 6, 11, 4, 10, true)), r2 = V.meshSection(job(4, 10, 6, 11, 4, 10, 2));
  const n1 = r1.cutout.length / 8, n2 = r2.cutout.length / 8;
  check(n2 > 0 && n2 < n1, 'round crowns: fewer cutout vertices than the fancy cubes (no inner faces)', n1 + ' → ' + n2);
  let off = 0, out = 0;
  for (let i = 0; i < n2; i++) { for (let c = 0; c < 3; c++) { const p = r2.cutout[i * 8 + c] / 2048 - 4; if (Math.abs(p - Math.round(p)) > 0.02) off++; } const x = r2.cutout[i * 8] / 2048 - 4, y = r2.cutout[i * 8 + 1] / 2048 - 4; if (x < 3.5 || x > 10.5 || y < 5.5 || y > 11.5) out++; }
  check(off > n2 * 0.3, 'round crowns: the vertices off the block grid', off + ' of ' + n2 * 3 + ' coords');
  check(out === 0, 'round crowns: every vertex within the crown box ± ½', out);
  const same = (A, B) => A.length === B.length && A.every((x, i) => x === B[i]);
  check(same(r1.opaque, r2.opaque), 'round crowns: the opaque stream the same');
  // leaf bits kept: the wave bit (7) on every round quad
  let wave = 0; for (let i = 0; i < n2; i++) if ((r2.cutout[i * 8 + 5] >> 7) & 1) wave++;
  check(wave === n2, 'round crowns: every vertex keeps the leaf (wind) bit', wave + '/' + n2);
  // a lone leaf block survives (not collapsed to a point)
  const r3 = V.meshSection(job(7, 8, 7, 8, 7, 8, 2));
  let lo = 1e9, hi = -1e9; for (let i = 0; i < r3.cutout.length / 8; i++) { const y = r3.cutout[i * 8 + 1] / 2048 - 4; lo = Math.min(lo, y); hi = Math.max(hi, y); }
  check(r3.cutout.length > 0 && hi - lo > 0.4, 'a lone leaf block keeps a body', (hi - lo).toFixed(2));
}

// c  the switch, row, texts, wiring
const src = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
global.window = global.window || { devicePixelRatio: 1, screen: { width: 1280, height: 720 } };
try { require(ROOT + '/src/main/qart3.js'); } catch (e) { console.log('   ' + e.message); }
const Q3 = V.QArt3;
check(!!Q3, 'VR.QArt3 exists');
if (Q3) {
  check(Q3.SW.join() === 'qRound', 'the switches', Q3.SW.join());
  check(!Q3.defaults('potato').qRound && !Q3.defaults('low').qRound, 'Very Low and Low: off');
  check(Q3.defaults('balanced').qRound && Q3.defaults('high').qRound && Q3.defaults('ultra').qRound, 'Balanced, High, Ultra: on');
  const row = Q3.ROWS.find(r => r.key === 'qRound');
  check(row && row.cost === 'low' && row.t === 'switch', 'the row: a switch, cost low');
  check(Q3.leafMode({ fancyLeaves: true, qRound: true }) === 2 && Q3.leafMode({ fancyLeaves: true, qRound: false }) === true && Q3.leafMode({ fancyLeaves: false, qRound: true }) === false, 'leafMode: 2 only with fancy leaves and the switch');
}
const de = src('src/main/lang_de.js'), en = src('src/main/lang_en.js');
for (const k of ['g.set.qRound', 'g.set.qRound.tip']) check(de.includes("'" + k + "'") && en.includes("'" + k + "'"), 'text ' + k + ' in both languages');
check(/'qart3'/.test(src('build.js')), 'build.js bundles qart3');
check(/QArt3/.test(src('src/main/settings_reg.js')), 'settings_reg.js adds the row');
const gm = src('src/main/game.js');
check(/QArt3/.test(gm) && /leafMode/.test(gm), 'game.js: presets and the leaf mode');
check(!/fancyLeaves:\s*2/.test(src('src/main/world.js')), 'world.js untouched (the mode rides on fancyLeaves)');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
