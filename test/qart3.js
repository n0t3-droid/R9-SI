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
  const j = job(4, 10, 6, 11, 4, 10, 2), bump0 = RC.bump; RC.bump = 0; const S = RC.solver(j.blocks, V.R.T.flags), v = [0, 0, 0];
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
  RC.bump = bump0;
  // the leaf clumps: with the bump the crown's vertices swell and dip (world noise), never by more than the bump
  { let mx = 0, mn = 9, n = 0; const p = [0, 0, 0];
    // (the solver shares its scratch: compare one at a time)
    const flat = []; RC.bump = 0; const S0 = RC.solver(j.blocks, V.R.T.flags, true, 0, 64, 0); for (let y = 5; y <= 10; y++) for (let z = 3; z <= 9; z++) for (let x = 3; x <= 9; x++) flat.push(S0.vert(x, y, z, [0, 0, 0]));
    RC.bump = bump0; const S1 = RC.solver(j.blocks, V.R.T.flags, true, 0, 64, 0); let k = 0;
    for (let y = 5; y <= 10; y++) for (let z = 3; z <= 9; z++) for (let x = 3; x <= 9; x++) { S1.vert(x, y, z, p); const f = flat[k++]; const d = Math.hypot(p[0] - f[0], p[1] - f[1], p[2] - f[2]); if (d > 1e-6) { n++; mx = Math.max(mx, d); mn = Math.min(mn, d); } }
    check(n > 20 && mx <= RC.bump * 1.01 + 1e-6, 'leaf clumps: the crown swells and dips, at most the bump', n + ' vertices, ≤ ' + mx.toFixed(2)); }
  // watertight: a crown across the border x = 16 — the cells on the border from both sections alike
  const jA = job(12, 20, 6, 11, 4, 10, 2), jB = job(-4, 4, 6, 11, 4, 10, 2);
  const SA = RC.solver(jA.blocks, V.R.T.flags, true, 0, 64, 0), a = [0, 0, 0], b = [0, 0, 0];
  const vertsA = [];
  for (let y = 5; y <= 11; y++) for (let z = 3; z <= 10; z++) { SA.vert(15, y, z, a); vertsA.push(a.slice()); }
  const SB = RC.solver(jB.blocks, V.R.T.flags, true, 16, 64, 0);
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

// b1 the mini-voxel crowns (an orchard's cherry crown) join the blob, drawn as cherry leaves
{
  const VXC = V.R.byName['vx_fruit_crown_cherry'].defaultState, CH = V.R.byName['cherry_leaves'].defaultState;
  const j0 = job(5, 9, 6, 9, 5, 9, true), j2 = job(5, 9, 6, 9, 5, 9, 2);
  for (const jj of [j0, j2]) for (let i = 0; i < jj.blocks.length; i++) if (jj.blocks[i] === LEAF) jj.blocks[i] = VXC;
  const a = V.meshSection(j0), b = V.meshSection(j2);
  const texOf = (r) => { const s = new Set(); for (let i = 0; i < r.cutout.length / 8; i++) s.add(r.cutout[i * 8 + 3] & 4095); return s; };
  check((a.vx || []).length > 0 && b.cutout.length > 0 && (b.vx || []).length < (a.vx || []).length, 'a fruit crown: voxel pieces → a blob in the cutout stream', (a.vx || []).length / 8 + ' vx → ' + b.cutout.length / 8 + ' cutout');
  check(texOf(b).has(V.R.T.tex[CH * 6] & 4095), 'the fruit crown drawn in cherry leaves');
}

// b2 Runde Hänge (fancyLeaves bit 4): a terraced hill of grass — rounded edges in Nahtlos, nothing in Klassisch
{
  const GRASS = V.R.byName['grass_block'].defaultState, DIRT = V.R.byName['dirt'].defaultState;
  const hill = (fancy, top, fill) => {
    const blocks = new Uint16Array(PSS * PS), light = new Uint16Array(PSS * PS).fill(0xf000);
    for (let y = -PAD; y < 16 + PAD; y++) for (let z = -PAD; z < 16 + PAD; z++) for (let x = -PAD; x < 16 + PAD; x++) {
      const pi = (y + PAD) * PSS + (z + PAD) * PS + (x + PAD);
      const h = 4 + Math.max(0, 6 - Math.max(Math.abs(x - 8), Math.abs(z - 8)));   // a stepped pyramid, 1 block a step, flat top
      if (y < h) { blocks[pi] = y === h - 1 ? (top || GRASS) : (fill || DIRT); light[pi] = 0; }
    }
    const t = new Uint16Array(PSS).fill(0x4d6a);
    return { blocks, light, grass: t, foliage: t, water: t, sy: 4, ox: 0, oz: 0, smooth: true, fancyLeaves: fancy, vxLod: true };
  };
  const grid = (r) => { let off = 0; const n = r.opaque.length / 8; for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) { const p = r.opaque[i * 8 + c] / 2048 - 4; if (Math.abs(p - Math.round(p)) > 0.02) off++; } return { n, off }; };
  const same = (A, B) => A.length === B.length && A.every((x, i) => x === B[i]);
  V.setLook('seamless'); V.VX.clearCache();
  const h0 = V.meshSection(hill(true)), h4 = V.meshSection(hill(6)), h2 = V.meshSection(hill(2));
  const g0 = grid(h0), g4 = grid(h4);
  check(g4.off > g0.off * 1.5 + 50, 'Runde Hänge (Nahtlos): the terraces\' edges off the grid', g0.off + ' → ' + g4.off + ' coords, ' + g0.n + ' → ' + g4.n + ' vertices');
  check(g4.n < g0.n * 3, 'Runde Hänge: at most 3× the vertices of the height field on a terraced hill', g0.n + ' → ' + g4.n);
  check(same(h0.opaque, h2.opaque), 'Runde Kronen alone leaves the ground as it was');
  // the hill's flat top stays one merged face (the greedy pass): its middle has no vertex at y = 10 inside x,z 7..9
  let mid = 0; for (let i = 0; i < g4.n; i++) { const x = h4.opaque[i * 8] / 2048 - 4, y = h4.opaque[i * 8 + 1] / 2048 - 4, z = h4.opaque[i * 8 + 2] / 2048 - 4; if (Math.abs(y - 10) < 1e-3 && x > 7.5 && x < 8.5 && z > 7.5 && z < 8.5) mid++; }
  check(mid === 0, 'Runde Hänge: flat ground still merged (no vertex inside the flat top)', mid);
  const STONE = V.R.byName['stone'].defaultState, COB = V.R.byName['cobblestone'].defaultState;
  check(grid(V.meshSection(hill(6, STONE, STONE))).off > grid(V.meshSection(hill(true, STONE, STONE))).off + 200, 'Runde Hänge: a stone cliff rounds too (the natural rocks)');
  check(same(V.meshSection(hill(6, COB, COB)).opaque, V.meshSection(hill(true, COB, COB)).opaque), 'Runde Hänge: a building stone (cobblestone) stays blocky');
  V.setLook('classic'); V.VX.clearCache();
  check(same(V.meshSection(hill(true, STONE, STONE)).opaque, V.meshSection(hill(6, STONE, STONE)).opaque), 'Klassisch: stone stays blocky too');
  check(same(V.meshSection(hill(true)).opaque, V.meshSection(hill(6)).opaque), 'Klassisch: Runde Hänge changes nothing (no smooth ground there)');
  V.setLook('seamless'); V.VX.clearCache();
}

// c  the switch, row, texts, wiring
const src = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
global.window = global.window || { devicePixelRatio: 1, screen: { width: 1280, height: 720 } };
try { require(ROOT + '/src/main/qart3.js'); } catch (e) { console.log('   ' + e.message); }
const Q3 = V.QArt3;
check(!!Q3, 'VR.QArt3 exists');
if (Q3) {
  check(Q3.SW.join() === 'qRound,qHill', 'the switches', Q3.SW.join());
  for (const k of Q3.SW) check(!Q3.defaults('potato')[k] && !Q3.defaults('low')[k], k + ': Very Low and Low off');
  check(!Q3.defaults('balanced').qRound && !Q3.defaults('high').qRound && !Q3.defaults('ultra').qRound, 'qRound: off in every preset (t-trees2: the clearer crowns; a switch by hand)');
  check(!Q3.defaults('balanced').qHill && !Q3.defaults('high').qHill, 'qHill: off in every preset (a switch by hand: not visible at thumbnail size in the views)');
  for (const k of Q3.SW) { const row = Q3.ROWS.find(r => r.key === k); check(row && row.cost === 'low' && row.t === 'switch', k + ': a switch row, cost low'); }
  const LM = (f, r, h) => Q3.leafMode({ fancyLeaves: f, qRound: r, qHill: h });
  check(LM(true, true, false) === 2 && LM(true, false, false) === true && LM(false, true, false) === false && LM(true, true, true) === 6 && LM(false, false, true) === 12 && LM(false, false, false) === false, 'leafMode: the bits (2 crowns with fancy leaves, 4 hills, 8 not fancy), else the boolean as before');
}
const de = src('src/main/lang_de.js'), en = src('src/main/lang_en.js');
for (const k of ['g.set.qRound', 'g.set.qRound.tip', 'g.set.qHill', 'g.set.qHill.tip']) check(de.includes("'" + k + "'") && en.includes("'" + k + "'"), 'text ' + k + ' in both languages');
check(/'qart3'/.test(src('build.js')), 'build.js bundles qart3');
check(/QArt3/.test(src('src/main/settings_reg.js')), 'settings_reg.js adds the row');
const gm = src('src/main/game.js');
check(/QArt3/.test(gm) && /leafMode/.test(gm), 'game.js: presets and the leaf mode');
check(!/fancyLeaves:\s*2/.test(src('src/main/world.js')), 'world.js untouched (the mode rides on fancyLeaves)');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
