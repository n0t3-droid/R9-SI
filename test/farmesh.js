// Ferne schlicht (far meshes): measured on the owner's AMD APU, Ultra's terrain time follows its TRIANGLES (half the
// triangles −43 %, half the vertices or pixels ≈ nothing). Beyond a few chunks a section is meshed plainly: no sloped
// smooth ground, no round hills/crowns/isles, no sculpted ground, plain leaves — at 100+ blocks a block is a few pixels.
//   a  the mesher: job.lod 1 gives far fewer quads on hilly land (≥ 25 % on a 4 × 4 × 6 sample), lod 0 is unchanged
//   b  the choice: inside D chunks full detail, beyond D + 1 plain, in between it keeps what it has (no flicker)
//   c  the distance by preset: off below 10 chunks of view (Very Low/Low/… never change), D grows with the view
const V = require('./load_shared.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const PAD = V.MESH_PAD, PS = V.MESH_PS, PSS = PS * PS;
if (V.setLook) try { V.setLook('nahtlos'); } catch (e) { /* the default look */ }
const g = V.makeGen('overworld', 4242, { vgen: 5 }), cols = {};
const col = (cx, cz) => { const k = cx + ',' + cz; if (!cols[k]) { const c = g.generate(cx, cz); c.light = V.computeColumnLight(c.blocks, true); cols[k] = c; } return cols[k]; };
function pad(CX, CZ, sy, o) {
  const blocks = new Uint16Array(PSS * PS), light = new Uint16Array(PSS * PS), gr = new Uint16Array(PSS), fo = new Uint16Array(PSS), wa = new Uint16Array(PSS);
  for (let y = -PAD; y < 16 + PAD; y++) for (let z = -PAD; z < 16 + PAD; z++) for (let x = -PAD; x < 16 + PAD; x++) {
    const wy = sy * 16 + y, cx = Math.floor(x / 16), cz = Math.floor(z / 16), c = col(CX + cx, CZ + cz), lx = ((x % 16) + 16) % 16, lz = ((z % 16) + 16) % 16, pi = (y + PAD) * PSS + (z + PAD) * PS + (x + PAD);
    if (y === 0) { gr[(z + PAD) * PS + x + PAD] = c.tints.grass[lz * 16 + lx]; fo[(z + PAD) * PS + x + PAD] = c.tints.foliage[lz * 16 + lx]; wa[(z + PAD) * PS + x + PAD] = c.tints.water[lz * 16 + lx]; }
    if (wy < 0 || wy > 255) { light[pi] = wy > 255 ? 0xf000 : 0; continue; }
    const i = (wy << 8) | (lz << 4) | lx; blocks[pi] = c.blocks[i]; light[pi] = c.light[i];
  }
  return Object.assign({ blocks, light, grass: gr, foliage: fo, water: wa, sy, ox: CX * 16, oz: CZ * 16, vxLod: true, smooth: true, fancyLeaves: 2 | 4 }, o);
}
let q0 = 0, q1 = 0, same = true;
for (let cx = 24; cx < 28; cx++) for (let cz = 24; cz < 28; cz++) for (let sy = 3; sy < 9; sy++) {
  const a = V.meshSection(pad(cx, cz, sy, {})), b = V.meshSection(pad(cx, cz, sy, { lod: 1 })), c = V.meshSection(pad(cx, cz, sy, { lod: 0 }));
  q0 += (a.opaque.length + a.cutout.length) / 32; q1 += (b.opaque.length + b.cutout.length) / 32;
  if (a.opaque.length !== c.opaque.length) same = false;
}
check(q1 <= q0 * 0.75, 'a  plain far meshes: ' + q1 + ' quads instead of ' + q0 + ' (−' + Math.round(100 - 100 * q1 / q0) + ' %)');
check(same, 'a  lod 0 meshes as before');
try { require('../src/main/world.js'); } catch (e) { console.log('     (world.js: ' + e.message + ')'); }
const W = V.World;
check(W && W.lodWant, 'b  World.lodWant');
if (W && W.lodWant) {
  check(W.lodWant(3, 0, 6) === 0 && W.lodWant(3, 1, 6) === 0, 'b  near: full detail');
  check(W.lodWant(8, 0, 6) === 1 && W.lodWant(9, 1, 6) === 1, 'b  far: plain');
  check(W.lodWant(6.5, 0, 6) === 0 && W.lodWant(6.5, 1, 6) === 1, 'b  in the band it keeps what it has');
  check(W.lodWant(30, 0, 0) === 0, 'b  D 0: always full detail');
}
check(W && W.farD && W.farD(4) === 0 && W.farD(6) === 0 && W.farD(10) >= 5 && W.farD(16) >= 6 && W.farD(16) < 16 && W.farD(32) <= 12, 'c  D by view: ' + (W && W.farD ? [4, 10, 14, 16, 24, 32].map(r => r + '→' + W.farD(r)).join(' ') : '-'));
console.log(fails ? 'FAILED ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0);
