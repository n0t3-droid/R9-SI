// ============================================================================
// R9-SI Lab · Horizontkarte: von oben, was hinter Hügeln liegt und darum nicht gezeichnet wird.
// The horizon map: the land round an eye from above, in its real block colours; where the column's surface section is
// hidden behind hills (src/shared/hzcull.js, the game's settings: smooth slopes' erosion, a standing eye) it is dyed
// violet — the geometry the GPU no longer draws. The eye is the white dot.
//   node lab/tools/hzmap.js --seed 3616214791 --at 562.5,69.62,-1359.5 --rd 10 --out lab/out/hzmap.png
// ============================================================================
'use strict';
const W = require('../lib/world.js'), P = require('../lib/png.js'), C = require('../lib/colors.js');
const VR = W.VR, R = W.R, F = W.F, HC = VR.HzCull;
const OCC = (s) => !!s && (R.T.flags[s] & F.OPAQUE) !== 0 && (R.T.flags[s] & F.FULL) !== 0;
function hzmap(o) {
  const g = W.gen(o.seed >>> 0, o.vgen || W.newestVgen()), eye = o.at, rd = o.rd || 10, delta = o.delta === undefined ? 0.05 : o.delta;
  const pcx = Math.floor(eye[0]) >> 4, pcz = Math.floor(eye[2]) >> 4, runs = new Map();
  const runOf = (cx, cz) => { const k = cx + ',' + cz; let r = runs.get(k); if (!r) { r = HC.runs(W.chunk(g, cx, cz).blocks, 256, OCC); runs.set(k, r); } return r; };
  const occ = [], tg = [], secs = [];
  for (let dz = -rd; dz <= rd; dz++) for (let dx = -rd; dx <= rd; dx++) {
    if (dx * dx + dz * dz > (rd + 0.5) * (rd + 0.5)) continue;
    const cx = pcx + dx, cz = pcz + dz, r = runOf(cx, cz), cells = HC.cells(r.run, (ox, oz) => runOf(cx + ox, cz + oz).run, o.E || [0, 1, 0]);
    for (let k = 0; k < 21; k++) { const b = cells[k * 2], t = cells[k * 2 + 1]; if (t <= b) continue; const [x0, z0, sz] = HC.cellRect(k); occ.push(cx * 16 + x0, cx * 16 + x0 + sz, cz * 16 + z0, cz * 16 + z0 + sz, b, t); }
    for (let sy = 0; sy < 16; sy++) if (r.top[sy] >= 0) { tg.push(cx * 16, cx * 16 + 16, sy * 16, r.top[sy], cz * 16, cz * 16 + 16); secs.push([cx, sy, cz]); }
  }
  const hid = new Uint8Array(secs.length), n = HC.cull(eye, delta, new Float64Array(occ), occ.length / 6, new Float64Array(tg), secs.length, hid);
  const hidden = new Set(); secs.forEach((s, i) => { if (hid[i]) hidden.add(s.join(',')); });
  const size = (2 * rd + 1) * 16, img = P.image(size, size, [18, 20, 26, 255]);
  const X0 = (pcx - rd) * 16, Z0 = (pcz - rd) * 16;
  for (let z = 0; z < size; z++) for (let x = 0; x < size; x++) {
    const wx = X0 + x, wz = Z0 + z, cx = wx >> 4, cz = wz >> 4, dx = cx - pcx, dz = cz - pcz;
    if (dx * dx + dz * dz > (rd + 0.5) * (rd + 0.5)) continue;
    const t = W.top(g, wx, wz, 255, (s) => !!s); if (!t.s) continue;
    let c = C.top(t.s, t.y, eye[1]);
    if (hidden.has(cx + ',' + (t.y >> 4) + ',' + cz)) c = [c[0] * 0.35 + 150 * 0.65, c[1] * 0.35 + 60 * 0.65, c[2] * 0.35 + 210 * 0.65];
    const i = (z * size + x) * 4; img.data[i] = c[0]; img.data[i + 1] = c[1]; img.data[i + 2] = c[2]; img.data[i + 3] = 255;
  }
  const ex = Math.floor(eye[0]) - X0, ez = Math.floor(eye[2]) - Z0;
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) { if (dx * dx + dz * dz > 5) continue; const x = ex + dx, z = ez + dz; if (x < 0 || z < 0 || x >= size || z >= size) continue; const i = (z * size + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; }
  return { img, hidden: n, sections: secs.length };
}
module.exports = hzmap;
if (require.main === module) {
  const A = {}; for (let i = 2; i < process.argv.length; i += 2) A[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
  const at = String(A.at || '562.5,69.62,-1359.5').split(',').map(Number);
  const r = hzmap({ seed: +(A.seed || 3616214791), at, rd: +(A.rd || 10), delta: A.delta !== undefined ? +A.delta : 0.05 });
  const out = A.out || 'lab/out/hzmap.png';
  P.save(P.scale(r.img, +(A.px || 2)), out);
  console.log(`${out}: ${r.hidden}/${r.sections} sections hidden`);
}
