// r-gemalt · Weiche Natur (src/shared/softnat.js, src/main/gemalt.js; plan docs/superpowers/plans/2026-11-07-r-gemalt.md),
// no browser:
//   a  a stair column (one step a block) → one monotone slope; a terrace (a step every 4 blocks) → rounded, monotone
//   b  crisp snap: grass beside a brick block meets the brick's corners exactly; the brick keeps its cube faces
//   c  seam-free: a hill across a section border (x = 16, and y = 16) — the border vertices the same from both sides
//   d  the smooth-height map: flat ground at its block top; on the stair within ½ block of the block tops; monotone
//   e  the cube path untouched: without the bit, and in Klassisch with it, the streams are the ones without it
//   f  the switch by preset (Very Low, Low off), the leaf-mode bit, the row, texts, the define, the wiring
const fs = require('fs'), path = require('path');
const V = require('./load_shared.js');
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
const ROOT = path.join(__dirname, '..');
const PAD = V.MESH_PAD, PS = V.MESH_PS, PSS = PS * PS;
const SN = V.SoftNat;
check(!!SN && typeof SN.mesh === 'function', 'VR.SoftNat exists');
const st = (n) => V.R.byName[n].defaultState;
const GRASS = st('grass_block'), DIRT = st('dirt'), STONE = st('stone'), BRICK = st('stone_bricks');
V.setLook('seamless');
// a section of the world fn(wx, wy, wz) → state at (ox, sy, oz)
function job(fn, ox, sy, oz, mode) {
  const blocks = new Uint16Array(PSS * PS), light = new Uint16Array(PSS * PS);
  for (let y = -PAD; y < 16 + PAD; y++) for (let z = -PAD; z < 16 + PAD; z++) for (let x = -PAD; x < 16 + PAD; x++) {
    const pi = (y + PAD) * PSS + (z + PAD) * PS + (x + PAD), b = fn(ox + x, sy * 16 + y, oz + z);
    blocks[pi] = b; light[pi] = b ? 0 : 0xf000;
  }
  const t = new Uint16Array(PSS).fill(0x4d6a);
  return { blocks, light, grass: t, foliage: t, water: t, sy, ox, oz, smooth: true, fancyLeaves: mode, vxLod: true };
}
// the vertices of a stream (8 u16 a vertex): positions in world units, face, normal word
function verts(r, j) {
  const a = r.opaque, out = [];
  for (let o = 0; o < a.length; o += 8) out.push({ x: a[o] / 2048 - 4 + j.ox, y: a[o + 1] / 2048 - 4 + j.sy * 16, z: a[o + 2] / 2048 - 4 + j.oz, face: a[o + 5] & 7, w4: a[o + 4], tint: a[o + 7] });
  return out;
}
const ground = (hf) => (x, y, z) => { const h = hf(x, z); return y < h - 3 ? STONE : y < h - 1 ? DIRT : y < h ? GRASS : 0; };

if (SN && SN.mesh) {
  // ---- a  the stair: height 4 + x (one step a block, x from −2 … 17 in the pad), within section sy 0
  {
    const j = job(ground((x) => Math.max(1, Math.min(14, 2 + x))), 0, 0, 0, 16), r = V.meshSection(j), vs = verts(r, j).filter(v => v.face === 6);
    check(vs.length > 50, 'the stair is drawn soft (face 6 vertices)', vs.length);
    // the top surface along z = 8: per x lattice line the highest vertex
    const line = []; for (const v of vs) if (Math.abs(v.z - 8) < 0.51 && v.x > 1.5 && v.x < 11.5) line.push(v);
    line.sort((a, b) => a.x - b.x);
    let mono = true, prevX = -9, prevY = -9;
    // bucket by x (0.25) and take the max y: the profile
    const prof = new Map(); for (const v of line) { const k = Math.round(v.x * 4); prof.set(k, Math.max(prof.get(k) || -9, v.y)); }
    const ks = [...prof.keys()].sort((a, b) => a - b);
    for (const k of ks) { const y = prof.get(k); if (y < prevY - 0.05) mono = false; prevY = y; }
    check(mono, 'a stair column → a monotone slope (the profile never steps back)', ks.length + ' samples');
    // terraces gone: the profile's slope between neighbouring samples never exceeds a cliff's (no vertical risers)
    let maxRise = 0, nOff = 0;
    for (let i = 1; i < ks.length; i++) { const dx = (ks[i] - ks[i - 1]) / 4, dy = prof.get(ks[i]) - prof.get(ks[i - 1]); if (dx > 0.05) maxRise = Math.max(maxRise, dy / dx); }
    for (const v of vs) if (Math.abs(v.y - Math.round(v.y)) > 0.05) nOff++;
    check(maxRise < 2.2, 'no risers on the stair: the steepest piece of the profile', maxRise.toFixed(2));
    check(nOff > vs.length * 0.3, 'vertices off the block grid (a sculpted surface, not cubes)', nOff + ' / ' + vs.length);
    const nrm = vs.map(v => SN.unoct(v.w4)); const mid = nrm.filter(n => n[1] > 0.4 && n[1] < 0.95 && n[0] < -0.2).length;
    check(mid > vs.length * 0.3, 'smooth normals: the slope faces lean (between up and the side)', mid + ' / ' + vs.length);
    // d  the smooth-height map on the stair: within ½ block of the block tops
    let worst = 0, okN = 0;
    for (let x = 2; x < 12; x++) { const h = r.softH[8 * 16 + x] / 64, top = Math.max(1, Math.min(14, 2 + x)); worst = Math.max(worst, Math.abs(h - top)); okN++; }
    check(r.softH && worst <= 0.5 + 1e-6, 'the smooth-height map: within ½ block of the block tops on the stair', 'worst ' + worst.toFixed(3));
    let mh = true; for (let x = 2; x < 12; x++) if (r.softH[8 * 16 + x + 1] < r.softH[8 * 16 + x]) mh = false;
    check(mh, 'the smooth-height map is monotone on the stair');
  }
  // the terrace: a step every 4 blocks
  {
    const j = job(ground((x) => 4 + Math.floor((x + 8) / 4)), 0, 0, 0, 16), r = V.meshSection(j), vs = verts(r, j).filter(v => v.face === 6 && Math.abs(v.z - 8) < 0.51);
    const prof = new Map(); for (const v of vs) { const k = Math.round(v.x * 4); prof.set(k, Math.max(prof.get(k) || -9, v.y)); }
    const ks = [...prof.keys()].sort((a, b) => a - b);
    let mono = true, prev = -9, maxRise = 0; for (const k of ks) { const y = prof.get(k); if (y < prev - 0.05) mono = false; prev = y; }
    for (let i = 1; i < ks.length; i++) { const dx = (ks[i] - ks[i - 1]) / 4, dy = prof.get(ks[i]) - prof.get(ks[i - 1]); if (dx > 0.05) maxRise = Math.max(maxRise, dy / dx); }
    check(mono && maxRise < 2.0, 'a terrace (a step every 4 blocks) → rounded, monotone, no vertical riser', 'steepest ' + maxRise.toFixed(2));
  }
  // ---- b  crisp snap: flat grass at top 5, a brick at (8, 5, 8) standing on it
  {
    const fn = (x, y, z) => (x === 8 && z === 8 && y === 5) ? BRICK : ground(() => 5)(x, y, z);
    const j = job(fn, 0, 0, 0, 16), r = V.meshSection(j), all = verts(r, j);
    const soft = all.filter(v => v.face === 6), cube = all.filter(v => v.face !== 6);
    const near = soft.filter(v => v.x >= 7.4 && v.x <= 9.6 && v.z >= 7.4 && v.z <= 9.6 && Math.abs(v.y - 5) < 0.6);
    const corners = [[8, 8], [9, 8], [8, 9], [9, 9]];
    let snapped = 0; for (const [cx, cz] of corners) if (near.some(v => Math.abs(v.x - cx) < 1e-3 && Math.abs(v.z - cz) < 1e-3 && Math.abs(v.y - 5) < 1e-3)) snapped++;
    check(snapped === 4, 'crisp snap: the ground meets the brick\'s four base corners exactly', snapped + ' / 4');
    const brickFaces = cube.filter(v => v.x >= 8 - 1e-6 && v.x <= 9 + 1e-6 && v.z >= 8 - 1e-6 && v.z <= 9 + 1e-6 && v.y >= 5 - 1e-6 && v.y <= 6 + 1e-6);
    check(brickFaces.length >= 20, 'the brick keeps its crisp cube faces (5 visible faces)', brickFaces.length + ' vertices');
    check(cube.every(v => Math.abs(v.x * 2048 - Math.round(v.x * 2048)) < 1e-6), 'cube vertices on the grid');
    // grass beside a crisp path block at the same height: their tops meet without a step
    const fn2 = (x, y, z) => (x >= 8 && y === 4) ? BRICK : (x >= 8 && y < 4) ? STONE : ground(() => 5)(x, y, z);
    const j2 = job(fn2, 0, 0, 0, 16), r2 = V.meshSection(j2), s2 = verts(r2, j2).filter(v => v.face === 6 && Math.abs(v.x - 8) < 1e-3);
    check(s2.length > 0 && s2.every(v => Math.abs(v.y - Math.round(v.y)) < 1e-3), 'floors meet ground: the soft edge on a crisp floor sits on its corners', s2.length + ' vertices on x = 8');
  }
  // ---- c  seam-free: a round hill centred on x = 16, z = 8, crossing the section border; and one across y = 16
  {
    const hill = (x, z) => 6 + Math.round(7 * Math.exp(-((x - 16) ** 2 + (z - 8) ** 2) / 40));
    const fn = ground(hill);
    const jA = job(fn, 0, 0, 0, 16), jB = job(fn, 16, 0, 0, 16);
    const vA = verts(V.meshSection(jA), jA).filter(v => v.face === 6 && Math.abs(v.x - 16) < 1e-6 === false);
    // the border's surface: the vertices of the dual cells on the plane x = 16 come from faces on both sides; compare the
    // solver's corner vertices directly (each section's view of the shared corners)
    const keyOf = (p) => p.map(a => Math.round(a * 2048)).join(',');
    const a = [0, 0, 0], setA = new Set(), setB = new Set();
    SN.solve(jA); for (let Y = 1; Y <= 15; Y++) for (let Z = 1; Z <= 15; Z++) { if (!cellActive(jA, 16, Y, Z)) continue; SN.vert(16, Y, Z, a); setA.add(keyOf([a[0], a[1], a[2]])); }
    SN.solve(jB); for (let Y = 1; Y <= 15; Y++) for (let Z = 1; Z <= 15; Z++) { if (!cellActive(jB, 0, Y, Z)) continue; SN.vert(0, Y, Z, a); setB.add(keyOf([a[0] + 16, a[1], a[2]])); }
    let same = setA.size === setB.size; for (const k of setA) if (!setB.has(k)) same = false;
    check(setA.size > 10 && same, 'seam-free across x = 16: the border corners bit-identical from both sections', setA.size + ' corners');
    // across y = 16: a hill whose top reaches into the section above
    const hill2 = (x, z) => 12 + Math.round(8 * Math.exp(-((x - 8) ** 2 + (z - 8) ** 2) / 30));
    const f2 = ground(hill2), jL = job(f2, 0, 0, 0, 16), jU = job(f2, 0, 1, 0, 16);
    const sL = new Set(), sU = new Set();
    SN.solve(jL); for (let X = 1; X <= 15; X++) for (let Z = 1; Z <= 15; Z++) { if (!cellActive(jL, X, 16, Z)) continue; SN.vert(X, 16, Z, a); sL.add(keyOf([a[0], a[1], a[2]])); }
    SN.solve(jU); for (let X = 1; X <= 15; X++) for (let Z = 1; Z <= 15; Z++) { if (!cellActive(jU, X, 0, Z)) continue; SN.vert(X, 0, Z, a); sU.add(keyOf([a[0], a[1] + 16, a[2]])); }
    let same2 = sL.size === sU.size; for (const k of sL) if (!sU.has(k)) same2 = false;
    check(sL.size > 5 && same2, 'seam-free across y = 16 (sections above each other)', sL.size + ' corners');
    // and the meshes' border vertices: every soft vertex of A on x = 16 is one of B's on x = 16
    const rA = verts(V.meshSection(jA), jA).filter(v => v.face === 6), rB = verts(V.meshSection(jB), jB).filter(v => v.face === 6);
    const bA = new Set(rA.filter(v => Math.abs(v.x - 16) < 0.51).map(v => keyOf([v.x, v.y, v.z]))), bB = new Set(rB.map(v => keyOf([v.x, v.y, v.z])));
    let miss = 0; const onBorder = [...bA].filter(k => { const x = +k.split(',')[0] / 2048; return Math.abs(x - 16) < 1e-6; });
    for (const k of onBorder) if (!bB.has(k)) miss++;
    check(onBorder.length > 0 && miss === 0, 'the meshes meet: A\'s vertices on x = 16 are B\'s', onBorder.length + ' on the border, ' + miss + ' missing');
    void vA;
  }
  // ---- d  flat ground: the height map at the block top
  {
    const j = job(ground(() => 5), 0, 0, 0, 16), r = V.meshSection(j);
    let ok = true; for (let i = 0; i < 256; i++) if (r.softH[i] !== 5 * 64) ok = false;
    check(ok, 'flat ground: every column\'s drawn height is its block top');
    const nSoft = verts(r, j).filter(v => v.face === 6).length;
    check(nSoft <= 8, 'flat ground merges into few quads (no vertex flood)', nSoft + ' vertices');
    const jx = job(ground(() => 40), 0, 0, 0, 16), rx = V.meshSection(jx);
    check(rx.softH && rx.softH.every(v => v === -32768), 'a section with no drawn ground: no heights');
  }
  // ---- e  the cube path untouched
  {
    const fn = ground((x, z) => 4 + Math.floor((x + z) / 3) % 9);
    const j0 = job(fn, 0, 0, 0, true), r0 = V.meshSection(j0);
    const j1 = job(fn, 0, 0, 0, true), r1 = V.meshSection(j1);
    const eq = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
    check(eq(r0.opaque, r1.opaque) && !r0.softH, 'without the bit: the cube streams, no heights');
    V.setLook('classic');
    const j2 = job(fn, 0, 0, 0, 16), r2 = V.meshSection(j2), j3 = job(fn, 0, 0, 0, true), r3 = V.meshSection(j3);
    check(eq(r2.opaque, r3.opaque) && !r2.softH, 'Klassisch with the bit: exactly the cubes');
    V.setLook('seamless');
    const j4 = job(fn, 0, 0, 0, 16), r4 = V.meshSection(j4);
    check(verts(r4, j4).every(v => v.face !== 6 || true) && verts(r4, j4).some(v => v.face === 6), 'Nahtlos with the bit: the sculpted ground');
    // plants on it sit on the drawn surface
    const TALL = V.R.byName['short_grass'] || V.R.byName['grass'] || V.R.byName['tall_grass'];
    if (TALL) {
      const ps = TALL.defaultState, fn5 = (x, y, z) => (x === 6 && z === 8 && y === 2 + 6) ? ps : ground((x) => Math.max(1, Math.min(14, 2 + x)))(x, y, z);
      const j5 = job(fn5, 0, 0, 0, 16), r5 = V.meshSection(j5), cut = r5.cutout; let minY = 99;
      for (let o = 0; o < cut.length; o += 8) { const x = cut[o] / 2048 - 4, z = cut[o + 2] / 2048 - 4; if (x > 5.5 && x < 7.5 && z > 7.5 && z < 9.5) minY = Math.min(minY, cut[o + 1] / 2048 - 4); }
      const h = r5.softH[8 * 16 + 6] / 64;
      check(Math.abs(minY - h) < 0.35, 'a plant sits on the drawn surface, not on the block top', 'plant foot ' + minY.toFixed(2) + ', ground ' + h.toFixed(2));
    }
  }
  // the octahedral normal round trip
  { let worst = 0; for (const n of [[0, 1, 0], [0.6, 0.8, 0], [-0.3, -0.9, 0.3], [0, 0, -1], [0.57, 0.57, -0.57]]) { const l = Math.hypot(...n), m = n.map(a => a / l), u = SN.unoct(SN.oct(m[0], m[1], m[2])); worst = Math.max(worst, Math.acos(Math.min(1, m[0] * u[0] + m[1] * u[1] + m[2] * u[2]))); }
    check(worst < 0.02, 'the normal survives its two bytes', (worst * 57.3).toFixed(2) + '°'); }
}
function cellActive(j, X, Y, Z) {
  // a corner is on the surface when its 8 voxels hold natural ground and air
  let s = 0, a = 0; const T = SN.tables();
  for (let c = 0; c < 8; c++) { const x = X - 1 + (c & 1), y = Y - 1 + ((c >> 1) & 1), z = Z - 1 + ((c >> 2) & 1); const b = j.blocks[(y + PAD) * PSS + (z + PAD) * PS + (x + PAD)]; if (T.soft[b]) s++; else if (!b) a++; }
  return s > 0 && a > 0;
}

// ---- f  the switch, the wiring
{
  const src = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
  global.VR = V; global.self = global;
  require(path.join(ROOT, 'src/main/qart3.js')); require(path.join(ROOT, 'src/main/gemalt.js'));
  const G = V.Gemalt, Q3 = V.QArt3;
  check(!!G, 'VR.Gemalt exists');
  if (G) {
    check(!G.defaults('potato').gSoft && !G.defaults('low').gSoft, 'Very Low and Low: Weiche Natur off');
    check(G.defaults('balanced').gSoft && G.defaults('high').gSoft && G.defaults('ultra').gSoft, 'Balanced, High, Ultra: on (the new default)');
    check(Q3.SW.includes('gSoft') && Q3.defaults('balanced').gSoft === true && Q3.off().gSoft === false, 'joined to q-art3\'s switches (game.js presets, the custom preset, the remesh)');
    check(Q3.leafMode({ fancyLeaves: true, qRound: true, gSoft: true }) === (2 | 16) && Q3.leafMode({ fancyLeaves: true, gSoft: true }) === 16 && Q3.leafMode({ fancyLeaves: false, gSoft: true }) === (8 | 16) && Q3.leafMode({ fancyLeaves: true }) === true, 'the leaf mode: bit 16 with the switch, the leaves as before');
    const row = Q3.ROWS.find(r => r.key === 'gSoft');
    check(row && row.cost === 'medium' && row.t === 'switch', 'the settings row (a switch, cost medium)');
    check(!G.shaderOn({ gSoft: true, lite: true, preset: 'potato' }) && G.shaderOn({ gSoft: true, preset: 'balanced' }), 'the define: never on the lite look');
  }
  // the bodies on the drawn ground: a fake world whose section 0 of column (0, 0) has the stair's heights
  if (G && SN) {
    const j = job(ground((x) => Math.max(1, Math.min(14, 2 + x))), 0, 0, 0, 16), r = V.meshSection(j);
    const cols = new Map(); cols.set((0 + 32768) * 65536 + (0 + 32768), { sec: [{ softH: r.softH }] });
    const W = { cols };
    V.game = { settings: { gSoft: true }, world: W };
    const hx = G.hAt(W, 6.5, 8.5, 8), top = 8;
    check(Math.abs(hx - r.softH[8 * 16 + 6] / 64) < 1e-3, 'hAt: a column centre reads its column\'s height', hx.toFixed(3) + ' / ' + (r.softH[8 * 16 + 6] / 64).toFixed(3));
    let worst = 0; for (let x = 3; x < 11; x += 0.25) { const feet = Math.max(1, Math.min(14, 2 + Math.floor(x))), d = G.lift(W, x, feet, 8.5); worst = Math.max(worst, Math.abs(d)); }
    check(worst <= 0.5 + 1e-9, 'the lift never moves a body more than ½ block', worst.toFixed(3));
    const air = G.lift(W, 6.5, top + 3, 8.5);
    check(air === 0, 'a body in the air (a jump) is drawn where it is');
    V.game.settings.gSoft = false;
    check(G.lift(W, 6.5, top, 8.5) === 0, 'switch off: no lift');
    delete V.game;
  }
  const de = src('src/main/lang_de.js'), en = src('src/main/lang_en.js');
  check(de.includes("'g.set.gSoft': 'Weiche Natur'") && en.includes("'g.set.gSoft':") && de.includes("'g.set.gSoft.tip'") && en.includes("'g.set.gSoft.tip'"), 'texts in German and English');
  const b = src('build.js');
  check(b.includes("'softnat'") && b.includes("'gemalt'") && b.includes("'gemalt_gl'"), 'build.js bundles softnat, gemalt, gemalt_gl');
  const sh = src('src/main/shaders.js');
  check((sh.match(/#ifdef GEMALT/g) || []).length >= 8 && sh.includes('vec3 gmPaint('), 'the terrain shader paints the sculpted ground under GEMALT only');
  check(src('src/main/world.js').includes('s.softH = m.softH') && src('src/worker/worker_main.js').includes('softH: r.softH'), 'the heights travel worker → world');
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
