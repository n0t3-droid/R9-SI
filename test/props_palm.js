// The smooth palm (src/main/props.js): the mesh is built once from numbers and has the shape of a palm — a tapering trunk
// down to its hidden depth, thirteen green fronds that reach out and droop, two dead fronds hanging, the coconuts; the far
// cross is two quads that carry the silhouette; the atlas is a cutout frond with a midrib; the instance layout (12 floats)
// carries the anchor's origin, its seeded variation and the light at the anchor, in the ranges the renderer relies on.
//   bash test/wt_run.sh props_palm.js
require('./load_shared.js');
require('../src/main/props.js');
const PR = VR.Props;
let fails = 0; const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const S = PR.VSTRIDE;

// 1. the palm mesh: sizes, no NaN, the layout of 14 floats per vertex, indices in range
const palm = PR.palm();
check(palm.verts.length === palm.nv * S, 'the palm stores 14 floats per vertex (' + palm.nv + ' vertices)');
check(palm.nv >= 300 && palm.nv <= 1000, 'the palm has a sane vertex count (' + palm.nv + ', want 300–1000)');
check(palm.nt >= 300 && palm.nt <= 1200, 'the palm has a sane triangle count (' + palm.nt + ')');
check(Array.from(palm.verts).every(Number.isFinite), 'no NaN or infinity in the palm vertices');
check(Array.from(palm.idx).every(i => i < palm.nv), 'every index is a vertex of the palm');
// 2. the bounds: the trunk reaches its hidden depth, the crown rises a little above the origin, the fronds spread wide
check(palm.min[1] <= -PR.TRUNK_D + 0.01, 'the trunk reaches its depth (y min ' + palm.min[1].toFixed(2) + ')');
check(palm.max[1] > 1.0 && palm.max[1] < 3.0, 'the young fronds and the spear leaves rise above the trunk top (y max ' + palm.max[1].toFixed(2) + ')');
let maxR = 0, minY = Infinity, frondVerts = 0, trunkTop = 0;
const ids = new Set();
for (let i = 0; i < palm.nv; i++) {
  const o = i * S, x = palm.verts[o], y = palm.verts[o + 1], z = palm.verts[o + 2], fr = palm.verts[o + 13];
  ids.add(fr);
  if (fr < PR.DEAD_FIRST) { frondVerts++; maxR = Math.max(maxR, Math.hypot(x, z)); }
  if (fr < PR.DEAD_FIRST) minY = Math.min(minY, y);
  if (fr === PR.BIT_FIXED && y > -0.5) trunkTop++;
}
// (the crown spans about 0.7 of a palm's height, as the trailer's palms in t3_05: the longest fronds 4–5 blocks)
check(maxR >= 4.2 && maxR <= 5.2, 'the green fronds reach out (radius ' + maxR.toFixed(2) + ', want 4.2–5.2)');
check(minY <= -1.2, 'the fronds droop below the crown (lowest green tip y ' + minY.toFixed(2) + ', want at most −1.2)');
check(trunkTop > 0, 'the trunk has its top ring at the crown');
const frondIds = [...ids].sort((a, b) => a - b);
check(frondIds.join(',') === Array.from({ length: 17 }, (_, i) => i).join(','), 'frond slots 0–14 (green, dead), 15 (trunk, bulb), 16 (coconuts) all present');
// the fronds fan out round the crown in tiers and arch under their weight: every green frond's tip is lower than its
// highest point; the low ones (leaving the crown under 0.4 rad) reach 3.8+ blocks out and hang their tips below the crown,
// the high ones (over 0.6 rad) rise above it; the azimuths cover the whole circle (no gap wider than 70°)
let arch = 0, low = 0, lowOk = 0, high = 0, highOk = 0; const azs = [];
for (let k = 0; k < PR.FROND_N; k++) {
  const a = PR.frondAxis(k), tip = PR.frondPoint(k, 1); let top = -Infinity;
  for (let i = 0; i <= 20; i++) top = Math.max(top, PR.frondPoint(k, i / 20)[1]);
  if (tip[1] < top - 0.05) arch++;
  if (a.el < 0.4) { low++; if (Math.hypot(tip[0], tip[2]) > 3.8 && tip[1] < -0.6) lowOk++; }
  if (a.el > 0.6) { high++; if (tip[1] > 0.4) highOk++; }
  azs.push(((a.az % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI));
}
azs.sort((a, b) => a - b); let gap = 2 * Math.PI - azs[azs.length - 1] + azs[0]; for (let i = 1; i < azs.length; i++) gap = Math.max(gap, azs[i] - azs[i - 1]);
check(arch === PR.FROND_N, 'every green frond arches under its weight (' + arch + ' of ' + PR.FROND_N + ')');
check(low >= 3 && lowOk === low, 'the low fronds reach 3.8+ blocks out and hang below the crown (' + lowOk + ' of ' + low + ')');
check(high >= 3 && highOk === high, 'the young fronds rise above the crown (' + highOk + ' of ' + high + ')');
check(gap < 70 * Math.PI / 180, 'the fronds fan out all round the crown (largest gap ' + (gap * 180 / Math.PI).toFixed(0) + '°)');
let dead = 0;
for (let k = PR.DEAD_FIRST; k < PR.DEAD_FIRST + 2; k++) { const tip = PR.frondPoint(k, 1); if (tip[1] < -1.5 && Math.hypot(tip[0], tip[2]) < 2.5) dead++; }
check(dead === 2, 'the two dead fronds hang under the crown, close to the trunk (' + dead + ' of 2)');
check(palm.verts.length > 0 && PR.palm() === palm, 'the palm is built once and kept');

// 3. the far cross: two quads, 8 vertices, the box of a palm's silhouette
const cross = PR.cross();
check(cross.nv === 8 && cross.nt === 4, 'the cross is two quads (' + cross.nv + ' vertices, ' + cross.nt + ' triangles)');
check(cross.min[0] === -6 && cross.max[0] === 6 && cross.min[2] === -6 && cross.max[2] === 6, 'the cross spans 12 blocks across');
check(cross.min[1] === -16 && cross.max[1] === 6, 'the cross runs from y −16 (under the ground) to 6 (above the fronds)');
check(PR.models(PR.KIND.palm).far === cross && PR.models(PR.KIND.palm_trunk).far === null, 'the models by kind: the palm has a far cross, the bare trunk none');

// 4. the textures: the atlas is a cutout frond with a midrib and a solid half; the silhouette has the palm's shape
const at = PR.atlas();
check(at.data.length === at.w * at.h * 4, 'the atlas is RGBA of its size (' + at.w + '×' + at.h + ')');
let solidOk = true, cutoutOn = 0, cutoutOff = 0, ribOn = true;
for (let y = 0; y < at.h; y++) for (let x = 0; x < at.w; x++) {
  const a = at.data[(y * at.w + x) * 4 + 3];
  if (x >= at.w / 2) { if (a !== 255) solidOk = false; }
  else { if (a === 255) cutoutOn++; else if (a === 0) cutoutOff++; else check(false, 'the frond atlas is cutout (alpha ' + a + ' at ' + x + ',' + y + ')'); }
  if (x === at.w / 4 && a !== 255) ribOn = false;
}
check(solidOk, 'the right half of the atlas is solid (trunk, bulb, nuts)');
check(cutoutOn > 1000 && cutoutOff > 1000, 'the frond half has leaflets and gaps (' + cutoutOn + ' on, ' + cutoutOff + ' off)');
check(ribOn, 'the midrib runs the length of the frond');
const sil = PR.silhouette();
check(sil.data.length === sil.w * sil.h * 4, 'the silhouette is RGBA of its size');
let sOn = 0, sTop = 0, sBottom = 0;
for (let y = 0; y < sil.h; y++) for (let x = 0; x < sil.w; x++) {
  if (sil.data[(y * sil.w + x) * 4 + 3] === 255) { sOn++; if (y < sil.h * 0.35) sTop++; if (y > sil.h * 0.8) sBottom++; }
}
check(sOn > 2000 && sOn < sil.w * sil.h * 0.9, 'the silhouette covers part of its quad (' + Math.round(100 * sOn / (sil.w * sil.h)) + '%)');
check(sTop > sBottom, 'the crown is at the top of the silhouette, the trunk below (' + sTop + ' top, ' + sBottom + ' bottom)');

// 5. the instance layout: 12 floats — the origin, the seeded yaw, scale, lean, phase, mask, the light at the anchor
const out = new Float64Array(PR.INST * 4);
const n1 = PR.anchorData(PR.KIND.palm, 120, 84, -78, 0xF53A, out, 0);
check(n1 === PR.INST, 'an instance is ' + PR.INST + ' floats (next at ' + n1 + ')');
check(out[0] === 120.5 && out[1] === 84 && out[2] === -77.5, 'the origin is the bottom centre of the anchor block');
check(out[3] >= 0 && out[3] < 2 * Math.PI, 'the yaw is an angle (' + out[3].toFixed(3) + ')');
check(out[4] >= 0.86 && out[4] <= 1.16, 'the scale is 0.86–1.16 (' + out[4].toFixed(3) + ')');
check(out[5] >= 0.25 && out[5] <= 1.15, 'the lean is 0.25–1.15 blocks (' + out[5].toFixed(3) + ')');
check(Number.isFinite(out[6]), 'the phase is finite (the terrain wind phase of its cell)');
const mask = out[7];
const bitsOf = (m, from, to) => { let c = 0; for (let b = from; b <= to; b++) if (Math.floor(m / Math.pow(2, b)) % 2 === 1) c++; return c; };
check(bitsOf(mask, 0, 12) >= 9 && bitsOf(mask, 0, 12) <= 13, 'a crown has 9–13 green fronds (' + bitsOf(mask, 0, 12) + ')');
check(bitsOf(mask, 13, 14) >= 1 && bitsOf(mask, 13, 14) <= 2, 'a crown has 1–2 dead fronds (' + bitsOf(mask, 13, 14) + ')');
check(bitsOf(mask, PR.BIT_FIXED, PR.BIT_FIXED) === 1 && bitsOf(mask, PR.BIT_COCO, PR.BIT_COCO) === 1, 'the trunk and the coconuts are always on');
check(out[8] > 0.9 && out[8] <= 1 && out[9] >= 0 && out[9] <= 1, 'the light is 0–1 (sky ' + out[8].toFixed(2) + ', block ' + out[9].toFixed(2) + ')');
// the same anchor gives the same instance; neighbouring anchors vary
const a1 = Array.from(out.slice(0, 12));
PR.anchorData(PR.KIND.palm, 120, 84, -78, 0xF53A, out, 12);
check(Array.from(out.slice(12, 24)).every((v, i) => v === a1[i]), 'an anchor always has the same variation');
const yaws = new Set(); let masks = new Set();
for (let i = 0; i < 40; i++) { const o = PR.anchorData(PR.KIND.palm, 200 + i, 90, 30 + 3 * i, 0xF000, out, 0); void o; yaws.add(Math.round(out[3] * 100)); masks.add(out[7]); }
check(yaws.size > 25 && masks.size > 15, 'neighbouring palms differ (' + yaws.size + ' yaws, ' + masks.size + ' frond masks of 40)');
// the bare trunk: no fronds and no coconuts in the mask, the same trunk and the origin
PR.anchorData(PR.KIND.palm_trunk, 5, 70, 5, 0xF000, out, 0);
check(out[7] === Math.pow(2, PR.BIT_FIXED), 'a bare trunk has only the trunk bit in its mask (' + out[7] + ')');
// the sizes the renderer allocates from: 12 floats an instance, 4 bytes each
check(PR.INST * 4 === 48, 'an instance is 48 bytes in the GPU buffer');

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
