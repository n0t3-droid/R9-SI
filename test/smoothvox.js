// Glatt-Modelle (t-form, the owner's „Form trotz Voxel"): src/shared/smoothvox.js turns any voxel volume into a smooth
// surface (naive surface nets: one vertex per surface cell at the mean of its edge crossings, a quad per sign-changing
// voxel edge, 2–3 Laplacian passes clamped to ±0.35 voxel, creases kept where the material or the colour changes).
//   1. a 16³ sphere: closed (every edge in two triangles), inside its voxel bounds, unit normals, no NaN, triangles at
//      most twice the surface cells, the faces wound outward
//   2. a two-material piece (a fabric top on a wood leg) keeps its crease: the vertices on the seam are split per
//      material and their normals differ; the same piece in one material has no crease
//   3. a 32-res chair (the catalogue's black dining chair) stays inside its block footprint in the game's layout
//   4. all 380 catalogue models through the mesher (the game's policy, a worker-like loop): a sane mesh each; the pieces
//      the game meshes (SV.autoTables) at most 25 ms each (the CPU time; the others — the 7-block garage door, the
//      tree crowns — are reported)
//   5. the game's layout: centred on the footprint like the hand-built pieces, Uint16 indices, opaque first, glass after,
//      the far mesh, the anchor's placement for every facing (props.js furnPlace)
//   6. the LRU cache: 256 models at most, the oldest goes first, a byte cap
//   7. a res-32 face shows the voxels it covers: a slab of two voxel layers in one 2³ cell, red in front and blue
//      behind, keeps both colours at 16 a block (the cell's dominant voxel would paint both sides one colour)
//   8. flat patches thinned (SV.flatten): a box keeps its surface — closed, the same area, the same bounds, the same
//      colours — with fewer triangles; a curved piece keeps every vertex
//   9. a res-8 piece is split to 16 a block (SV.upFor): inside its block, a one-voxel leaf a small rounded cube
//   bash test/wt_run.sh smoothvox.js 300
require('./load_shared.js');
require('../src/shared/smoothvox.js');
const SV = VR.SmoothVox, VM = VR.VM, VX = VR.VX;
let fails = 0; const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const now = () => Number(process.hrtime.bigint()) / 1e6;
check(SV && typeof SV.mesh === 'function', 'VR.SmoothVox.mesh exists');
if (!SV || typeof SV.mesh !== 'function') { console.log('FAILED ' + fails); process.exit(1); }

// a test model made with the model language (16 units a block)
const model = (name, size, res, build) => VM.compile(name, { size, res, build });
const M = VM.M;
// the edges of a triangle list: undirected edge → count (keyed by vertex position, so split vertices count as one)
function edgeUse(g, idx0, idx1) {
  const key = (i) => g.pos[i * 3].toFixed(4) + ',' + g.pos[i * 3 + 1].toFixed(4) + ',' + g.pos[i * 3 + 2].toFixed(4);
  const use = new Map();
  for (let t = idx0; t < idx1; t += 3) for (let e = 0; e < 3; e++) { const a = key(g.idx[t + e]), b = key(g.idx[t + (e + 1) % 3]), k = a < b ? a + '|' + b : b + '|' + a; use.set(k, (use.get(k) || 0) + 1); }
  return use;
}

// ---------------------------------------------------------------- 1. the sphere
console.log('1. a 16³ sphere');
const sph = model('t_sphere', [1, 1, 1], 16, (b) => b.sphere(8, 8, 8, 6.5, M.matte(0xD8D2C4)));
const g = SV.mesh(sph, { step: 1 });
const nt = g.idx.length / 3;
console.log(`    ${g.nv} vertices, ${nt} triangles, ${g.cells} surface cells, ${g.ms.toFixed(1)} ms`);
check(g.nv > 100 && nt > 100, 'the sphere has a mesh');
const use = edgeUse(g, 0, g.idx.length);
const open = [...use.values()].filter(n => n !== 2).length;
check(open === 0, `closed: every edge in exactly two triangles (${use.size} edges, ${open} not)`);
let nan = 0, out = 0, unit = 0;
for (let i = 0; i < g.nv; i++) {
  for (let k = 0; k < 3; k++) { const p = g.pos[i * 3 + k], n = g.nrm[i * 3 + k]; if (!Number.isFinite(p) || !Number.isFinite(n)) nan++; if (p < -1e-6 || p > 16 + 1e-6) out++; }
  if (Math.abs(Math.hypot(g.nrm[i * 3], g.nrm[i * 3 + 1], g.nrm[i * 3 + 2]) - 1) > 1e-3) unit++;
}
check(!nan, 'no NaN in positions or normals');
check(!out, `every vertex inside the voxel bounds 0…16 (${out} outside)`);
check(!unit, `unit normals (${unit} not)`);
check(nt <= 2 * g.cells, `triangles ≤ 2 × surface cells (${nt} ≤ ${2 * g.cells})`);
// outward: the face normal agrees with the direction from the centre
let inward = 0;
for (let t = 0; t < g.idx.length; t += 3) {
  const [a, b, c] = [g.idx[t], g.idx[t + 1], g.idx[t + 2]].map(i => [g.pos[i * 3], g.pos[i * 3 + 1], g.pos[i * 3 + 2]]);
  const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
  const m = [(a[0] + b[0] + c[0]) / 3 - 8, (a[1] + b[1] + c[1]) / 3 - 8, (a[2] + b[2] + c[2]) / 3 - 8];
  if (n[0] * m[0] + n[1] * m[1] + n[2] * m[2] <= 0) inward++;
}
check(inward === 0, `every face wound outward (${inward} inward)`);
// round: the vertices lie close to the true sphere (the voxel staircase is gone)
let dev = 0; for (let i = 0; i < g.nv; i++) dev = Math.max(dev, Math.abs(Math.hypot(g.pos[i * 3] - 8, g.pos[i * 3 + 1] - 8, g.pos[i * 3 + 2] - 8) - 6.5));
check(dev < 0.75, `round: every vertex within 0.75 voxel of the true radius (max ${dev.toFixed(2)})`);
// the vertex normals follow the sphere (smooth shading, not the voxel faces)
let worst = 1; for (let i = 0; i < g.nv; i++) { const r = Math.hypot(g.pos[i * 3] - 8, g.pos[i * 3 + 1] - 8, g.pos[i * 3 + 2] - 8); worst = Math.min(worst, ((g.pos[i * 3] - 8) * g.nrm[i * 3] + (g.pos[i * 3 + 1] - 8) * g.nrm[i * 3 + 1] + (g.pos[i * 3 + 2] - 8) * g.nrm[i * 3 + 2]) / r); }
check(worst > 0.85, `smooth normals: each within ~30° of the radius (worst cos ${worst.toFixed(3)})`);

// ---------------------------------------------------------------- 2. the crease
console.log('2. a crease between two materials');
const top = (b, mt) => { b.box(2, 8, 2, 14, 11, 14, mt); b.cyl('y', 8, 8, 2.5, 0, 8, M.wood(0x7A4A2A)); };
const two = model('t_two', [1, 1, 1], 32, (b) => top(b, M.fabric(0xC83A3A)));
const one = model('t_one', [1, 1, 1], 32, (b) => { top(b, M.wood(0x7A4A2A)); });
const g2 = SV.mesh(two, { step: 1 }), g1 = SV.mesh(one, { step: 1 });
const byPos = (gm) => { const m = new Map(); for (let i = 0; i < gm.nv; i++) { const k = gm.pos[i * 3].toFixed(4) + ',' + gm.pos[i * 3 + 1].toFixed(4) + ',' + gm.pos[i * 3 + 2].toFixed(4); if (!m.has(k)) m.set(k, []); m.get(k).push(i); } return m; };
const split2 = [...byPos(g2).values()].filter(l => l.length > 1), split1 = [...byPos(g1).values()].filter(l => l.length > 1);
let minAng = 180;
for (const l of split2) { const [a, b] = l; const d = g2.nrm[a * 3] * g2.nrm[b * 3] + g2.nrm[a * 3 + 1] * g2.nrm[b * 3 + 1] + g2.nrm[a * 3 + 2] * g2.nrm[b * 3 + 2]; minAng = Math.min(minAng, Math.acos(Math.max(-1, Math.min(1, d))) * 180 / Math.PI); }
check(split2.length >= 8, `the seam's vertices are split per material (${split2.length} seam vertices)`);
check(split2.length && minAng > 25, `the normals on the two sides of the crease differ (the smallest angle ${minAng.toFixed(0)}°)`);
check(split1.length === 0, `one material: no crease, no split vertices (${split1.length})`);
// the two sides keep their own colours
const colsAt = (gm, l) => l.map(i => gm.rgb[i * 3] + ',' + gm.rgb[i * 3 + 1] + ',' + gm.rgb[i * 3 + 2]);
check(split2.every(l => new Set(colsAt(g2, l)).size === l.length), 'each side of the crease keeps its own colour');
const mats2 = new Set(Array.from(g2.mat)); check(mats2.has(SV.MAT.fabric) && mats2.has(SV.MAT.wood), 'the materials come from the voxels (fabric, wood: ' + [...mats2].join(',') + ')');
// a thin part does not collapse: the 5-voxel leg keeps its width (the clamp ±0.35 voxel)
let legMin = Infinity, legMax = -Infinity; for (let i = 0; i < g2.nv; i++) { const y = g2.pos[i * 3 + 1]; if (y > 4 && y < 12) { const r = Math.hypot(g2.pos[i * 3] - 16, g2.pos[i * 3 + 2] - 16); if (g2.mat[i] === SV.MAT.wood) { legMin = Math.min(legMin, r); legMax = Math.max(legMax, r); } } }
check(legMin > 3.6 && legMax < 6, `the leg keeps its radius 5 (vertices at ${legMin.toFixed(2)}…${legMax.toFixed(2)} voxels from its axis)`);

// ---------------------------------------------------------------- 3. a 32-res chair in its footprint
console.log('3. a 32-res chair');
const chair = VM.MODELS.vm_dining_chair;
check(chair && chair.res === 32, 'the catalogue chair is a 32-res model');
const fc = SV.forModel(chair), fn = fc.near;
let cx0 = Infinity, cx1 = -Infinity, cy0 = Infinity, cy1 = -Infinity, cz0 = Infinity, cz1 = -Infinity;
for (let i = 0; i < fn.nv; i++) { const o = i * 14; cx0 = Math.min(cx0, fn.verts[o]); cx1 = Math.max(cx1, fn.verts[o]); cy0 = Math.min(cy0, fn.verts[o + 1]); cy1 = Math.max(cy1, fn.verts[o + 1]); cz0 = Math.min(cz0, fn.verts[o + 2]); cz1 = Math.max(cz1, fn.verts[o + 2]); }
console.log(`    ${fn.nv} vertices, ${fn.nt} triangles; x ${cx0.toFixed(3)}…${cx1.toFixed(3)} y ${cy0.toFixed(3)}…${cy1.toFixed(3)} z ${cz0.toFixed(3)}…${cz1.toFixed(3)}`);
check(cx0 >= -0.5 - 1e-6 && cx1 <= 0.5 + 1e-6 && cz0 >= -0.5 - 1e-6 && cz1 <= 0.5 + 1e-6, 'the chair stays in its one-block footprint (centred: x and z within ±0.5)');
check(cy0 >= -1e-6 && cy1 <= 1 + 1e-6, 'from the floor to the top of its block (y 0…1)');

// ---------------------------------------------------------------- 4. the whole catalogue, timed
console.log('4. the 380 catalogue models');
const names = Object.keys(VM.MODELS);
for (const n of names) VM.materialize(VM.MODELS[n]);
// a worker meshes model after model for a whole session: the first round through the catalogue warms the code (its
// time is reported, not judged — the JIT compiles the mesher's paths as it meets them), the second is the steady cost.
// The time is the process's CPU time (this 2-CPU machine is shared with other tests: the wall clock counts theirs too)
const cpu = () => { const u = process.cpuUsage(); return (u.user + u.system) / 1000; };
{ let c0 = cpu(), worst = 0, wn = ''; for (const n of names) { const t = cpu(); SV.forModel(VM.MODELS[n]); const d = cpu() - t; if (d > worst) { worst = d; wn = n; } } console.log(`    the first round (cold code): ${(cpu() - c0).toFixed(0)} ms for ${names.length} models, the slowest ${worst.toFixed(1)} ms (${wn})`); }
let tsum = 0, tmax = 0, maxName = '', bad = [], big = 0, vmax = 0, gmax = 0, gName = '', gsum = 0, gn = 0, tris = 0, cells = 0;
const A = SV.autoTables(), inGame = new Set(A.list.filter(e => !e.vx).map(e => e.name));
const time = (m) => { const t0 = cpu(); const r = SV.forModel(m); return [cpu() - t0, r]; };
for (const n of names) {
  let [t, r] = time(VM.MODELS[n]);
  if (t > 25) for (let k = 0; k < 2; k++) { const [t2, r2] = time(VM.MODELS[n]); if (t2 < t) { t = t2; r = r2; } }   // the machine is shared: a slow sample is measured again
  tsum += t; if (t > tmax) { tmax = t; maxName = n; }
  if (inGame.has(n)) { gsum += t; gn++; if (t > gmax) { gmax = t; gName = n; } tris += r.near.nt; cells += VM.MODELS[n].parts.length; }
  const nr = r && r.near;
  if (!nr || !(nr.nv > 0) || nr.nv > 65535 || !Array.from(nr.verts).every(Number.isFinite)) bad.push(n + (nr ? ' (' + nr.nv + ' vertices)' : ' (no mesh)'));
  if (nr) { vmax = Math.max(vmax, nr.nv); if (nr.nv > 20000) big++; }
}
console.log(`    CPU time, all 380: mean ${(tsum / names.length).toFixed(1)} ms, max ${tmax.toFixed(1)} ms (${maxName}), the most vertices ${vmax}`);
console.log(`    the ${gn} models the game meshes: mean ${(gsum / gn).toFixed(1)} ms, max ${gmax.toFixed(1)} ms (${gName}); ${(tris / cells).toFixed(0)} triangles a block cell near`);
check(names.length === 380, `the catalogue has 380 models (${names.length})`);
check(!bad.length, 'every model gets a sane mesh' + (bad.length ? ': ' + bad.slice(0, 8).join(', ') : ''));
check(gn > 200 && gmax <= 25, `at most 25 ms a model the game meshes (max ${gmax.toFixed(1)} ms, ${gName})`);

// ---------------------------------------------------------------- 5. the game's layout
console.log('5. the game layout');
const sofa = VM.MODELS.vm_living_sofa3_sage || VM.MODELS[names.find(n => /sofa3/.test(n))];
const fs3 = SV.forModel(sofa), f3 = fs3.near;
check(fs3.size[0] === sofa.W && fs3.size[1] === sofa.H && fs3.size[2] === sofa.D, 'the record carries the model size ' + fs3.size.join('×'));
check(f3.idx instanceof Uint16Array && f3.nOpaque <= f3.idx.length && f3.nOpaque % 3 === 0, 'Uint16 indices, the opaque part first (' + f3.nOpaque / 3 + ' of ' + f3.idx.length / 3 + ' triangles)');
let sx0 = Infinity, sx1 = -Infinity; for (let i = 0; i < f3.nv; i++) { sx0 = Math.min(sx0, f3.verts[i * 14]); sx1 = Math.max(sx1, f3.verts[i * 14]); }
check(Math.abs(sx0 + sofa.W / 2) < 0.2 && Math.abs(sx1 - sofa.W / 2) < 0.2, `centred on its footprint like the hand-built pieces (x ${sx0.toFixed(2)}…${sx1.toFixed(2)} for ${sofa.W} blocks)`);
check(fs3.far && fs3.far.nt > 0 && fs3.far.nt < f3.nt, `a far mesh with fewer triangles (${fs3.far.nt} < ${f3.nt})`);
// the glass of a glazed piece goes after the opaque part
const glazed = names.map(n => VM.MODELS[n]).find(m => { for (let i = 1; i < m.pal.length; i++) if (m.pal[i] & VX.GLASS) return m.W === 1 && m.H <= 2; return false; });
if (glazed) { const fg = SV.forModel(glazed).near; let glassOp = 0, glassTr = 0; for (let t = 0; t < fg.idx.length; t++) { const isG = fg.verts[fg.idx[t] * 14 + 11] === SV.MAT.glass; if (isG && t < fg.nOpaque) glassOp++; if (isG && t >= fg.nOpaque) glassTr++; } check(glassOp === 0 && glassTr > 0, `${glazed.name}: its glass is in the translucent part (${glassTr / 3} glass triangles there, ${glassOp / 3} in the opaque part)`); }
// a lamp switched off has its own look: no glowing vertices
const lamp = names.map(n => VM.MODELS[n]).find(m => VR.R.byName[m.name] && VR.R.byName[m.name].o.toggle);
if (lamp) { const on = SV.forModel(lamp), off = SV.forModel(lamp, { off: true }); const glow = (r) => { let n = 0; for (let i = 0; i < r.near.nv; i++) if (r.near.verts[i * 14 + 11] === SV.MAT.light) n++; return n; }; check(glow(on) > 0 && glow(off) === 0, `${lamp.name}: lit ${glow(on)} glowing vertices, switched off ${glow(off)}`); }
// the anchor (part 0) and the facing put the mesh where the voxel piece stands (props.js furnPlace, for a 3-block sofa)
if (VR.Props) {
  for (let f = 0; f < 4; f++) {
    const P = [0, 0, 0, 0]; VR.Props.furnPlace([3, 1, 1], 10, 64, 20, f, P, [0, 0]);
    const fp = VM.footprint({ W: 3, D: 1, parts: [{ px: 0, py: 0, pz: 0 }, { px: 1, py: 0, pz: 0 }, { px: 2, py: 0, pz: 0 }] }, f);
    let mx = 0, mz = 0; for (const [dx, , dz] of fp) { mx += 10 + dx + 0.5; mz += 20 + dz + 0.5; } mx /= 3; mz /= 3;
    check(Math.abs(P[0] - mx) < 1e-9 && Math.abs(P[2] - mz) < 1e-9, `facing ${f}: the footprint's centre ${P[0]},${P[2]} is the cells' centre ${mx},${mz}`);
  }
} else console.log('    (props.js not loaded: the placement is checked in section 5b of smoothvox_game.js)');

// ---------------------------------------------------------------- 6. the LRU cache
console.log('6. the cache');
const L = new SV.LRU(3, 1000);
L.set('a', 1, 10); L.set('b', 2, 10); L.set('c', 3, 10); L.get('a'); L.set('d', 4, 10);
check(L.get('b') === undefined && L.get('a') === 1 && L.get('d') === 4, 'the least recently used goes first (b), a used one stays (a)');
L.set('e', 5, 990);
check(L.bytes <= 1000 && L.get('e') === 5, `the byte cap holds (${L.bytes} bytes)`);
check(SV.CACHE_MAX === 256, 'the meshing threads keep ~256 models (' + SV.CACHE_MAX + ')');

// ---------------------------------------------------------------- 7. a face shows what it covers
console.log('7. the faces of a res-32 model at 16 a block');
// (the model language counts 16 a block: z 8…8.5 is the voxel layer 16, 8.5…9 the layer 17 — one 2³ cell holds both)
const slab = model('t_slab', [1, 1, 1], 32, (b) => { b.box(2, 2, 8, 14, 14, 8.5, M.matte(0xD83030)); b.box(2, 2, 8.5, 14, 14, 9, M.matte(0x3050D8)); });
const gs = SV.mesh(slab, {});
let redFront = 0, blueBack = 0, frontN = 0, backN = 0;
for (let i = 0; i < gs.nv; i++) {
  const nz = gs.nrm[i * 3 + 2], r = gs.rgb[i * 3], b = gs.rgb[i * 3 + 2];
  if (nz < -0.9) { frontN++; if (r > 150 && b < 100) redFront++; }
  if (nz > 0.9) { backN++; if (b > 150 && r < 100) blueBack++; }
}
check(gs.step === 2 && frontN > 0 && backN > 0 && redFront === frontN && blueBack === backN, `a two-voxel slab at step 2: its −z face red (${redFront} of ${frontN} vertices), its +z face blue (${blueBack} of ${backN})`);
const art = SV.forModel(VM.MODELS.vm_art_abstract).near;
const artCols = new Set(); for (let i = 0; i < art.nv; i++) artCols.add(Math.round(art.verts[i * 14 + 8] * 8) + ',' + Math.round(art.verts[i * 14 + 9] * 8) + ',' + Math.round(art.verts[i * 14 + 10] * 8));
check(artCols.size >= 4, `a painted canvas keeps its paint at 16 a block (${artCols.size} colours)`);

// ---------------------------------------------------------------- 8. flat patches
console.log('8. flat patches thinned');
const boxM = model('t_box', [1, 1, 1], 16, (b) => b.box(1, 0, 1, 14, 13, 14, M.matte(0xE8E4DA)));
const gf = SV.mesh(boxM, {}), g0 = SV.mesh(boxM, { flat: false });
const area = (gm) => { let a = 0; for (let t = 0; t < gm.idx.length; t += 3) { const [p, q, r] = [gm.idx[t], gm.idx[t + 1], gm.idx[t + 2]].map(i => [gm.pos[i * 3], gm.pos[i * 3 + 1], gm.pos[i * 3 + 2]]); const u = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], v = [r[0] - p[0], r[1] - p[1], r[2] - p[2]]; a += Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2; } return a; };
const bounds = (gm) => { const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]; for (let i = 0; i < gm.nv; i++) for (let k = 0; k < 3; k++) { b[k] = Math.min(b[k], gm.pos[i * 3 + k]); b[k + 3] = Math.max(b[k + 3], gm.pos[i * 3 + k]); } return b; };
const bdiff = (a, b) => Math.max(...a.map((x, k) => Math.abs(x - b[k])));
const openF = [...edgeUse(gf, 0, gf.idx.length).values()].filter(n => n !== 2).length;
console.log(`    ${g0.idx.length / 3} → ${gf.idx.length / 3} triangles, ${g0.nv} → ${gf.nv} vertices`);
check(gf.idx.length < g0.idx.length * 0.85, `a box: fewer triangles (${gf.idx.length / 3} of ${g0.idx.length / 3}; its flat middles go, the rounded edges stay)`);
const bd = bdiff(bounds(gf), bounds(g0));
check(openF === 0 && Math.abs(area(gf) - area(g0)) < 1e-3 * area(g0) && bd < 0.01, `the same surface: closed (${openF} open edges), the area ${area(gf).toFixed(3)} = ${area(g0).toFixed(3)}, the bounds within ${bd.toFixed(4)} voxel`);
const colsOf = (gm) => new Set(Array.from({ length: gm.nv }, (_, i) => gm.rgb[i * 3] + ',' + gm.rgb[i * 3 + 1] + ',' + gm.rgb[i * 3 + 2] + ',' + gm.ao[i].toFixed(2)));
check([...colsOf(gf)].every(c => colsOf(g0).has(c)), 'the same colours and occlusion values (no vertex gets a new one)');
const sf = SV.mesh(sph, { step: 1 }), s0 = SV.mesh(sph, { step: 1, flat: false });
check(sf.idx.length === s0.idx.length, `a sphere keeps every triangle (${sf.idx.length / 3} = ${s0.idx.length / 3})`);

// ---------------------------------------------------------------- 9. the res-8 pieces
console.log('9. a res-8 piece split to 16 a block');
const leaf = { V: new Uint32Array(512), VW: 8, VH: 8, VD: 8, res: 8, W: 1, H: 1, D: 1, parts: [{ px: 0, py: 0, pz: 0 }] };
for (let z = 1; z < 7; z++) for (let x = 1; x < 7; x++) for (let y = 0; y < 3; y++) leaf.V[(y * 8 + z) * 8 + x] = (0xB4B0A6 | VX.PRESENT) >>> 0;
leaf.V[(3 * 8 + 4) * 8 + 4] = (0x3E8A4A | VX.PRESENT) >>> 0;   // one voxel on top: a leaf
const g8 = SV.mesh(leaf, {}), g81 = SV.mesh(leaf, { up: 1 });
let inB = true, leafV = 0, leafTop = 0;
for (let i = 0; i < g8.nv; i++) { const x = g8.pos[i * 3], y = g8.pos[i * 3 + 1], z = g8.pos[i * 3 + 2]; if (x < -1e-6 || y < -1e-6 || z < -1e-6 || x > 8 + 1e-6 || y > 8 + 1e-6 || z > 8 + 1e-6) inB = false; if (g8.rgb[i * 3 + 1] > 120 && g8.rgb[i * 3] < 90) { leafV++; leafTop = Math.max(leafTop, y); } }
check(g8.up === 2 && inB, `split ×${g8.up}: every vertex inside the 8³ block`);
check(leafV >= 8 && leafTop > 3.6, `the one-voxel leaf is a small rounded cube (${leafV} vertices, up to ${leafTop.toFixed(2)} of its top at 4)`);
check(g8.idx.length > g81.idx.length, `more triangles than at 8 a block (${g8.idx.length / 3} > ${g81.idx.length / 3}) — the price of the even rounding`);

console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);
