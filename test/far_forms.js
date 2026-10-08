// F-Far · ring 1's mesher (src/shared/far.js VR.Far.form): coarse forms of 4 x 4 chunk columns from the generator's cheap
// pass. Shapes on made-up input first (exact counts), then the real world (seed 1, vgen 6 — the Heartland):
//  a · a flat field → one quad and four skirts; a mesa → steep walls in the cliff colour and flat tops; water → one plane
//  b · a house lot → one box: the roof colour on top, the wall colour on four sides, 10 triangles; a floating slab gets
//      its underside; a tree → a crown (and a trunk on 2-block cells)
//  c · the real tiles: the canyon's mesas are steep, Nova Haven stands up in slabs, the citadel's spires reach over 200,
//      the Sky Isles float, a forest has crowns, the ocean is a plane; every tile the same twice (determinism)
//  d · cost: a form costs ≤ 1/10 of the generation time of its 16 chunks and ≤ 1/8 of their triangles; bytes per tile and
//      the whole ring against the budget the High and Ultra presets set today (the horizon's 192 MB)
//   bash test/wt_run.sh far_forms.js 600
const V = require('./load_shared.js');
const F = V.Far, SEA = V.C.SEA;
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
if (!F || !F.form || !F.Builder || !F.meshField || !F.meshSlabs || !F.meshTree) { console.log('VR.Far.form / Builder / meshField / meshSlabs / meshTree missing'); console.log('FAILED 1'); process.exit(1); }
// the triangles of a finished mesh, with their normals and colours
function tris(r) {
  const v = new Int16Array(r.verts), b = new Uint8Array(r.verts), out = [];
  const P = (i) => [v[i * 6] / 8, v[i * 6 + 1] / 8, v[i * 6 + 2] / 8];
  for (let t = 0; t < r.count; t += 3) {
    const a = P(r.idx[t]), c = P(r.idx[t + 1]), d = P(r.idx[t + 2]);
    const u = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], w = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], l = Math.hypot(...n) || 1;
    const k = r.idx[t + 2] * 12;   // the provoking (last) vertex carries the flat attributes
    tris.last = out.push({ p: [a, c, d], n: n.map(x => x / l), face: b[k + 6] & 7, kind: b[k + 6] >> 3, col: [b[k + 8], b[k + 9], b[k + 10]], ymin: Math.min(a[1], c[1], d[1]), ymax: Math.max(a[1], c[1], d[1]) });
  }
  return out;
}
const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

console.log('a · the height field');
{
  const G = [96, 180, 60], ROCK = [150, 110, 80];
  // flat: every vertex at 81
  const fl = F.fieldFrom(32, 2, () => ({ h: 81, c: G, cliff: ROCK, kd: 0 }));
  const B = new F.Builder(); F.meshField(B, fl); const r = B.finish(), T = tris(r);
  const top = T.filter(t => t.n[1] > 0.99), skirt = T.filter(t => Math.abs(t.n[1]) < 0.01);
  check(top.length === 2 && T.every(t => t.ymax <= 81) && top.every(t => t.ymin === 81), 'flat: one quad (2 triangles) at 81', top.length + ' top triangles');
  check(skirt.length === 8, 'four skirts, one quad a side', skirt.length + ' skirt triangles');
  check(T.length === 10 && r.count === 30, 'flat tile: 10 triangles in all', T.length);
  // a mesa: 100 inside a circle of radius 18 blocks, 60 outside, with a wall over one cell
  const cx = 32, cz = 32;
  const mesa = F.fieldFrom(32, 2, (i, j) => { const d = Math.hypot(i * 2 - cx, j * 2 - cz); return { h: d < 18 ? 100 : 66, c: G, cliff: ROCK, kd: 0 }; });
  const B2 = new F.Builder(); F.meshField(B2, mesa); const r2 = B2.finish(), T2 = tris(r2);
  const steep = T2.filter(t => t.n[1] > 0 && t.n[1] < 0.5 && t.ymax - t.ymin > 10);
  check(steep.length >= 16, 'mesa: steep wall triangles all round', steep.length + ' steep');
  check(steep.every(t => !same(t.col, G)), 'mesa: the walls take the cliff colour, not the grass', JSON.stringify(steep[0] && steep[0].col));
  check(T2.some(t => t.n[1] > 0.99 && t.ymin === 100) && T2.some(t => t.n[1] > 0.99 && t.ymin === 66), 'mesa: flat top at 100 and floor at 66');
  let flatCells = 0; const hm = (i, j) => (Math.hypot(i * 2 - cx, j * 2 - cz) < 18 ? 100 : 66);
  for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) if (hm(i, j) === hm(i + 1, j) && hm(i, j) === hm(i + 1, j + 1) && hm(i, j) === hm(i, j + 1)) flatCells++;
  const flatTris = T2.filter(t => t.n[1] > 0.99).length;
  check(flatTris * 4 <= flatCells * 2, 'mesa: the flat parts are merged (at least 4 cells a quad on average)', flatTris + ' flat triangles for ' + flatCells + ' flat cells');
  // under the sea: no ground, one water plane
  const wet = F.fieldFrom(32, 2, () => ({ h: 40, c: [200, 190, 150], cliff: ROCK, kd: 0, wet: { h: SEA + 0.9, kd: 1, ax: 22, c: [40, 90, 160] } }));
  const B3 = new F.Builder(); F.meshField(B3, wet); const r3 = B3.finish(), T3 = tris(r3);
  check(T3.length === 2 && T3.every(t => t.kind === 1 && t.ymin === SEA + 0.875 || t.kind === 1 && Math.abs(t.ymin - (SEA + 0.9)) < 0.13), 'deep water: one plane of kind 1, no sea bed, no skirts', T3.length + ' triangles');
}

console.log('b · shapes');
{
  const ROOF = [170, 60, 50], WALL = [235, 230, 220];
  // a house lot of 6 x 8 blocks (3 x 4 cells of 2), standing from the ground (81) to 89
  const S = F.slabGrid(32, 2);
  for (let j = 4; j < 8; j++) for (let i = 5; i < 8; i++) F.setSlab(S, i, j, { ground: 81, bot: 81, top: 89, roof: ROOF, wall: WALL, kind: 0 });
  const B = new F.Builder(); F.meshSlabs(B, S); const r = B.finish(), T = tris(r);
  const up = T.filter(t => t.n[1] > 0.99), sides = T.filter(t => Math.abs(t.n[1]) < 0.01);
  check(T.length === 10, 'a house lot: one box, 10 triangles', T.length);
  check(up.length === 2 && up.every(t => same(t.col, ROOF) && t.ymin === 89), 'its top: the roof colour at 89');
  check(sides.length === 8 && sides.every(t => same(t.col, WALL) && t.ymin === 81 && t.ymax === 89), 'its four sides: the wall colour from 81 to 89');
  // a floating slab (a bridge deck at 120..122 over ground 81) shows its underside
  const S2 = F.slabGrid(32, 2);
  for (let i = 2; i < 12; i++) F.setSlab(S2, i, 10, { ground: 81, bot: 120, top: 122, roof: WALL, wall: WALL, kind: 0 });
  const B2 = new F.Builder(); F.meshSlabs(B2, S2); const T2 = tris(B2.finish());
  check(T2.some(t => t.n[1] < -0.99 && t.ymin === 120), 'a floating deck: its underside at 120', T2.length + ' triangles');
  // a tree: a crown box (5 faces) and, on 2-block cells, a trunk (4 faces)
  const LEAF = [60, 120, 40], BARK = [90, 70, 40];
  const B3 = new F.Builder(); F.meshTree(B3, 10, 10, 70, 'oak', 7, LEAF, BARK, 2); const T3 = tris(B3.finish());
  const crown = T3.filter(t => same(t.col, LEAF)), trunk = T3.filter(t => same(t.col, BARK));
  check(crown.length === 10 && trunk.length === 8, 'a tree on 2-block cells: crown 10 triangles, trunk 8', crown.length + ' + ' + trunk.length);
  check(Math.max(...crown.map(t => t.ymax)) === 77 && Math.min(...trunk.map(t => t.ymin)) === 70, 'the crown tops out at ground + height (77), the trunk stands on the ground (70)');
  const B4 = new F.Builder(); F.meshTree(B4, 10, 10, 70, 'spruce', 10, LEAF, BARK, 4); const T4 = tris(B4.finish());
  check(T4.every(t => same(t.col, LEAF)) && T4.length >= 10, 'on 4-block cells: the crown only', T4.length + ' triangles');
}

console.log('c · the real world (seed 1, vgen 6)');
const g = V.makeGen('overworld', 1, { vgen: 6 });
const form = (tx, tz, cell, gg) => { const t0 = performance.now(); const r = F.form(gg || g, { tx, tz, cell }); r.ms = performance.now() - t0; return r; };
{
  const can = form(0, 4, 2), Tc = tris(can);
  const ys = Tc.map(t => t.ymax), steep = Tc.filter(t => t.face === 6 && t.n[1] > 0 && t.n[1] < 0.45);
  check(Math.max(...ys) - Math.min(...Tc.filter(t => t.face === 6).map(t => t.ymin)) > 30 && steep.length > 50, 'the Ember Canyon (tile 0, 4): mesas over 30 blocks, steep walls', steep.length + ' steep of ' + Tc.length + ', ' + can.ms.toFixed(0) + ' ms');
  const city = form(0, -3, 2), Ty = tris(city);
  const slab = Ty.filter(t => t.face !== 6 && t.kind !== 1 && t.ymin > 84);
  check(slab.length > 100 && Math.max(...slab.map(t => t.ymax)) > 92, 'Nova Haven (tile 0, −3): buildings stand up as slabs', slab.length + ' slab triangles, top ' + Math.max(...slab.map(t => t.ymax)) + ', ' + city.ms.toFixed(0) + ' ms');
  const cit = form(-7, 5, 4), Tt = tris(cit);
  check(Math.max(...Tt.map(t => t.ymax)) > 200, 'the Spire Citadel (tile −7, 5): its spires reach over 200', Math.max(...Tt.map(t => t.ymax)).toFixed(0));
  const isl = form(5, 2, 2), Ti = tris(isl);
  check(Ti.some(t => t.n[1] < -0.9 && t.ymin > 110), 'the Sky Isles (tile 5, 2): islands float (undersides above 110)', Ti.filter(t => t.n[1] < -0.9 && t.ymin > 110).length + ' underside triangles');
  const fo = form(6, 14, 2), Tf = tris(fo);
  check(Tf.filter(t => t.face !== 6 && t.kind === 5).length > 40, 'a forest (tile 6, 14): crowns', Tf.filter(t => t.face !== 6 && t.kind === 5).length + ' crown triangles');
  const oc = form(12, 8, 4), To = tris(oc);
  check(To.filter(t => t.kind === 1).length >= 2 && oc.parts.water <= 4 && oc.parts.field === 0 && oc.parts.skirt === 0, 'the open sea (tile 12, 8): one water plane, no sea bed, no skirts', 'water ' + oc.parts.water + ', bed ' + oc.parts.field + ' (and ' + oc.parts.slab + ' of a floating island)');
  const a = form(0, 4, 2, V.makeGen('overworld', 1, { vgen: 6 })), b = form(0, 4, 2, V.makeGen('overworld', 1, { vgen: 6 }));
  const eq = Buffer.compare(Buffer.from(a.verts), Buffer.from(b.verts)) === 0 && Buffer.compare(Buffer.from(a.idx.buffer, a.idx.byteOffset, a.idx.byteLength), Buffer.from(b.idx.buffer, b.idx.byteOffset, b.idx.byteLength)) === 0;
  const eq2 = Buffer.compare(Buffer.from(can.verts), Buffer.from(a.verts)) === 0;
  check(eq && eq2, 'determinism: the same tile twice, fresh or warm generator, gives the same bytes', a.verts.byteLength + ' bytes');
}

console.log('d · cost and memory (per chunk column, against a full chunk)');
{
  // the full chunks of a tile: generate (cold generator, the structures' plans built beforehand on both sides),
  // light and mesh every section; the triangles of all streams
  const PAD = V.MESH_PAD || 2, PS = 16 + PAD * 2, PSS = PS * PS;
  function chunkTile(gg, tx, tz) {
    const cols = new Map(), K = (x, z) => x * 65536 + z;
    const x0 = tx * 4, z0 = tz * 4;
    let genMs = 0;
    for (let cz = z0 - 1; cz <= z0 + 4; cz++) for (let cx = x0 - 1; cx <= x0 + 4; cx++) {
      const t0 = performance.now(); const c = gg.generate(cx, cz); const inner = cx >= x0 && cx < x0 + 4 && cz >= z0 && cz < z0 + 4; if (inner) genMs += performance.now() - t0;
      c.light = V.computeColumnLight(c.blocks, true); cols.set(K(cx, cz), c);
    }
    let tri = 0;
    for (let cz = z0; cz < z0 + 4; cz++) for (let cx = x0; cx < x0 + 4; cx++) for (let sy = 0; sy < 16; sy++) {
      const blocks = new Uint16Array(PSS * PS), light = new Uint16Array(PSS * PS), gr = new Uint16Array(PSS), fo = new Uint16Array(PSS), wa = new Uint16Array(PSS);
      let any = false;
      for (let y = -PAD; y < 16 + PAD; y++) for (let z = -PAD; z < 16 + PAD; z++) for (let x = -PAD; x < 16 + PAD; x++) {
        const wy = sy * 16 + y, c = cols.get(K(cx + Math.floor(x / 16), cz + Math.floor(z / 16)));
        const lx = ((x % 16) + 16) % 16, lz = ((z % 16) + 16) % 16, pi = (y + PAD) * PSS + (z + PAD) * PS + (x + PAD);
        if (y === 0) { gr[(z + PAD) * PS + x + PAD] = c.tints.grass[lz * 16 + lx]; fo[(z + PAD) * PS + x + PAD] = c.tints.foliage[lz * 16 + lx]; wa[(z + PAD) * PS + x + PAD] = c.tints.water[lz * 16 + lx]; }
        if (wy < 0 || wy > 255) { light[pi] = wy > 255 ? 0xf000 : 0; continue; }
        const i = (wy << 8) | (lz << 4) | lx; blocks[pi] = c.blocks[i]; light[pi] = c.light[i];
        if (blocks[pi] && x >= 0 && x < 16 && y >= 0 && y < 16 && z >= 0 && z < 16) any = true;
      }
      if (!any) continue;
      const r = V.meshSection({ blocks, light, grass: gr, foliage: fo, water: wa, sy, ox: cx * 16, oz: cz * 16, smooth: true, fancyLeaves: true, vxLod: true });
      for (const k of ['opaque', 'cutout', 'trans', 'vxFar']) if (r[k]) tri += (r[k].length >> 5) * 2;   // quads → triangles (far: the boxes, as ring 0 draws them past the detail distance)
    }
    return { genMs, tri };
  }
  // both sides start cold (a fresh generator: no climate corners, no site cells) with the per-structure work done
  // beforehand on both sides: the plans and set pieces the chunks stamp, and the skylines the forms read (built once per
  // world in a worker, from those plans — their one-time cost is printed apart). JIT warm-up first; the best of three runs.
  const prep = (gg) => { V.TempleGen.build(gg); if (V.HillsGen) V.HillsGen.build(gg); if (V.StationGen) V.StationGen.build(gg); if (V.CanyonGen) V.CanyonGen.build(gg); if (V.IslesGen) V.IslesGen.build(gg); const s = V.VillageGen.site(gg, 0, -1); if (s) V.VillageGen.plan(gg, s); return gg; };
  { const gw = V.makeGen('overworld', 99, { vgen: 6 }); for (let k = 0; k < 6; k++) { gw.generate(300 + k, 300); F.form(gw, { tx: 80 + k, tz: 80, cell: 2 }); F.form(gw, { tx: 80 + k, tz: 82, cell: 4 }); } }
  const SAMPLE = [[0, 4, 'the canyon'], [0, -3, 'Nova Haven'], [6, 14, 'a forest'], [-8, 12, 'plains'], [5, 2, 'the Sky Isles']];
  let sumF = 0, sumC = 0, sumTF = 0, sumTC = 0, bytes = 0, worst = 0, worstT = 0;
  for (const [tx, tz, what] of SAMPLE) {
    // the skylines of the tile's structures, built on a generator of their own (and the plans they need)
    const gs = prep(V.makeGen('overworld', 1, { vgen: 6 }));
    const t0 = performance.now(); for (const [id, get] of F.structuresNear(gs, tx * 64, tz * 64, tx * 64 + 64, tz * 64 + 64)) F.skyline(gs, id, get()); const skyMs = performance.now() - t0;
    let best = null, bestC = null;
    // the forms first (five runs: a form takes milliseconds, a pause of the garbage collector would be most of it), then
    // the chunks (three runs); the best of each
    const warmSites = (g2, plans) => { for (let j = Math.floor((tz * 64 - 400) / 640); j <= Math.floor((tz * 64 + 464) / 640); j++) for (let i = Math.floor((tx * 64 - 400) / 640); i <= Math.floor((tx * 64 + 464) / 640); i++) { const st = V.VillageGen.site(g2, i, j); if (st && plans) V.VillageGen.plan(g2, st); } };
    for (let run = 0; run < 5; run++) {
      const gf = prep(V.makeGen('overworld', 1, { vgen: 6 })); warmSites(gf, false); gf._farSky = gs._farSky;
      const fr = form(tx, tz, 2, gf);
      if (!best || fr.ms < best.ms) best = fr;
    }
    for (let run = 0; run < 3; run++) {
      const gc = prep(V.makeGen('overworld', 1, { vgen: 6 })); warmSites(gc, true);
      const c = chunkTile(gc, tx, tz);
      if (!bestC || c.genMs < bestC.genMs) bestC = c;
    }
    const f = best, c = bestC, ft = f.count / 3;
    sumF += f.ms; sumC += c.genMs; sumTF += ft; sumTC += c.tri; bytes += f.verts.byteLength + f.idx.byteLength;
    worst = Math.max(worst, f.ms / c.genMs); worstT = Math.max(worstT, ft / c.tri);
    console.log(`    ${what.padEnd(14)} form ${f.ms.toFixed(1)} ms, ${ft} tris · 16 chunks ${c.genMs.toFixed(0)} ms, ${c.tri} tris · per column ${(f.ms / 16).toFixed(2)} vs ${(c.genMs / 16).toFixed(1)} ms, ${(ft / 16).toFixed(0)} vs ${(c.tri / 16).toFixed(0)} tris · skylines once ${skyMs.toFixed(0)} ms`);
  }
  check(sumF / sumC <= 0.1 && worst <= 0.1, 'time: a form costs ≤ 1/10 of its chunks\' generation', 'all ' + (sumF / sumC * 100).toFixed(1) + ' %, worst tile ' + (worst * 100).toFixed(1) + ' %');
  check(sumTF / sumTC <= 1 / 8 && worstT <= 1 / 8, 'triangles: a form has ≤ 1/8 of its chunks\' triangles', 'all ' + (sumTF / sumTC * 100).toFixed(1) + ' %, worst tile ' + (worstT * 100).toFixed(1) + ' %');
  // the 4-block tiles beyond 32 chunks
  let b4 = 0; const S4 = [[20, 6], [-15, 0], [11, 11], [0, 15]]; for (const [tx, tz] of S4) { const f = form(tx, tz, 4); b4 += f.verts.byteLength + f.idx.byteLength; }
  const per2 = bytes / SAMPLE.length, per4 = b4 / S4.length;
  // the band on High (rd 14) and Ultra (rd 16): tiles within 32 chunks at 2-block cells, beyond at 4
  const MB = 1048576;
  for (const rd of [14, 16]) {
    let n2 = 0, n4 = 0; const R = 18;
    for (let tz = -R; tz <= R; tz++) for (let tx = -R; tx <= R; tx++) { const [dmin, dmax] = F.tileDist(tx, tz, 0, 0); if (!(dmax >= rd - 2 && dmin <= 64.5)) continue; if (F.cellFor(dmin) === 2) n2++; else n4++; }
    const tot = n2 * per2 + n4 * per4;
    console.log(`    rd ${rd}: ${n2} tiles at 2 blocks × ${(per2 / 1024).toFixed(0)} KB + ${n4} at 4 × ${(per4 / 1024).toFixed(0)} KB = ${(tot / MB).toFixed(1)} MB`);
    check(tot <= F.capBytes(4) * 0.5, 'memory: the whole ring 1 on rd ' + rd + ' fits in half the 5 km horizon\'s cap (192 MB)', (tot / MB).toFixed(1) + ' MB');
  }
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
