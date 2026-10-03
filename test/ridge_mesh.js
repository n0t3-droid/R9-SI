// Mesh the end of the test hill's ridge in node and print every quad around it — finds the stray face that
// te_2_edits.png shows at the ridge's end (bottom-left of the hill).  OX/OZ: the hill's origin (section alignment).
const VR = require('./load_shared.js');
const R = VR.R, F = VR.F, T = R.T;
const PAD = VR.MESH_PAD, PS = VR.MESH_PS, PSS = PS * PS;
const st = (n) => R.byName[n].defaultState;
const G = st('grass_block'), D = st('dirt');
const OX = +(process.env.OX || 0), OZ = +(process.env.OZ || 0), Y0 = 64;
const hillH = (x, z) => Math.round(6 * Math.exp(-((x - 22) ** 2 + (z - 22) ** 2) / 90) + 2 * Math.exp(-((x - 10) ** 2) / 12));
function world(x, y, z) {
  if (y < 0 || y > 255) return 0;
  const hx = x - OX, hz = z - OZ;
  if (hx >= 0 && hx < 44 && hz >= 0 && hz < 44) {
    const h = hillH(hx, hz), yy = y - Y0;
    if (yy < -1) return y < Y0 - 4 ? st('stone') : D;
    if (yy < h) return D; if (yy === h) return G; return 0;
  }
  if (y === Y0) return G; if (y < Y0) return y < Y0 - 4 ? st('stone') : D; return 0;
}
function mesh(cx, sy, cz) {
  const n = PS * PS * PS;
  const blocks = new Uint16Array(n), light = new Uint16Array(n).fill(0xffff);
  const grass = new Uint16Array(PS * PS).fill(0xffff), foliage = grass, water = grass;
  for (let py = 0; py < PS; py++) for (let pz = 0; pz < PS; pz++) for (let px = 0; px < PS; px++) blocks[py * PSS + pz * PS + px] = world(cx * 16 + px - PAD, sy * 16 + py - PAD, cz * 16 + pz - PAD);
  return VR.meshSection({ blocks, light, grass, foliage, water, sy, ox: cx * 16, oz: cz * 16, fancyLeaves: true, smooth: true, vxLod: true });
}
const DEC = (v) => v / 2048 - 4;
const X0 = +(process.env.X0 || 4), X1 = +(process.env.X1 || 16), Z0 = +(process.env.Z0 || 41), Z1 = +(process.env.Z1 || 46);
const seen = new Set();
for (let z = OZ + Z0; z <= OZ + Z1; z++) for (let x = OX + X0; x <= OX + X1; x++) {
  const cx = Math.floor(x / 16), cz = Math.floor(z / 16), sy = Math.floor(Y0 / 16);
  const k = cx + ',' + cz; if (seen.has(k)) continue; seen.add(k);
  const r = mesh(cx, sy, cz);
  const a = r.opaque;
  for (let q = 0; q < a.length; q += 32) {
    const vs = [];
    for (let v = 0; v < 4; v++) { const o = q + v * 8; vs.push([DEC(a[o]) + cx * 16, DEC(a[o + 1]) + sy * 16, DEC(a[o + 2]) + cz * 16, a[o + 5] & 7, a[o + 3] & 0xfff]); }
    const minx = Math.min(...vs.map(v => v[0])), maxx = Math.max(...vs.map(v => v[0])), minz = Math.min(...vs.map(v => v[2])), maxz = Math.max(...vs.map(v => v[2]));
    if (maxx < OX + X0 || minx > OX + X1 + 1 || maxz < OZ + Z0 || minz > OZ + Z1 + 1) continue;
    const d = vs[0][3];
    const w = maxx - minx, h = maxz - minz, miny = Math.min(...vs.map(v => v[1])), maxy = Math.max(...vs.map(v => v[1]));
    const tex = Object.keys(R.texIndex).find(k => R.texIndex[k] === vs[0][4]) || vs[0][4];
    const flag = (d !== 2 && d !== 3 && (w > 1.01 || h > 1.01)) || (maxy - miny > 1.01) ? '  <-- big' : '';
    console.log(`d=${d} ${tex} x ${minx - OX}..${maxx - OX} z ${minz - OZ}..${maxz - OZ} y ${(miny - Y0).toFixed(2)}..${(maxy - Y0).toFixed(2)}  v:${vs.map(v => `(${(v[0] - OX).toFixed(1)},${(v[1] - Y0).toFixed(2)},${(v[2] - OZ).toFixed(1)})`).join(' ')}${flag}`);
  }
}
