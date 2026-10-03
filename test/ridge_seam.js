// Seam check for the test hill's ridge end at every section alignment: along the hill's south edge (z = 44) the top
// surface of the last hill row must meet the flat ground's top, with a side face closing any difference.
const VR = require('./load_shared.js');
const R = VR.R, F = VR.F;
const PAD = VR.MESH_PAD, PS = VR.MESH_PS, PSS = PS * PS;
const st = (n) => R.byName[n].defaultState;
const G = st('grass_block'), D = st('dirt'), S = st('stone');
const Y0 = 64;
const hillH = (x, z) => Math.round(6 * Math.exp(-((x - 22) ** 2 + (z - 22) ** 2) / 90) + 2 * Math.exp(-((x - 10) ** 2) / 12));
const DEC = (v) => v / 2048 - 4;
function run(OX, OZ) {
  const world = (x, y, z) => {
    if (y < 0 || y > 255) return 0;
    const hx = x - OX, hz = z - OZ;
    if (hx >= 0 && hx < 44 && hz >= 0 && hz < 44) {
      const h = hillH(hx, hz), yy = y - Y0;
      if (yy < -1) return y < Y0 - 4 ? S : D;
      if (yy < h) return D; if (yy === h) return G; return 0;
    }
    if (y === Y0) return G; if (y < Y0) return y < Y0 - 4 ? S : D; return 0;
  };
  const mesh = (cx, sy, cz) => {
    const n = PS * PS * PS;
    const blocks = new Uint16Array(n), light = new Uint16Array(n).fill(0xffff);
    const grass = new Uint16Array(PS * PS).fill(0xffff);
    for (let py = 0; py < PS; py++) for (let pz = 0; pz < PS; pz++) for (let px = 0; px < PS; px++) blocks[py * PSS + pz * PS + px] = world(cx * 16 + px - PAD, sy * 16 + py - PAD, cz * 16 + pz - PAD);
    return VR.meshSection({ blocks, light, grass, foliage: grass, water: grass, sy, ox: cx * 16, oz: cz * 16, fancyLeaves: true, smooth: true, vxLod: true });
  };
  const quads = [];
  const seen = new Set();
  const ZS = OZ + 44, sy = Y0 >> 4;
  for (const z of [ZS - 2, ZS - 1, ZS, ZS + 1]) for (let x = OX - 16; x <= OX + 40; x += 16) {
    const cx = x >> 4, cz = z >> 4, k = cx + ',' + cz; if (seen.has(k)) continue; seen.add(k);
    const a = mesh(cx, sy, cz).opaque;
    for (let q = 0; q < a.length; q += 32) {
      const vs = [];
      for (let v = 0; v < 4; v++) { const o = q + v * 8; vs.push([DEC(a[o]) + cx * 16, DEC(a[o + 1]) + sy * 16, DEC(a[o + 2]) + cz * 16]); }
      quads.push({ d: a[q + 5] & 7, vs });
    }
  }
  // height of top quads along the seam (at z = ZS) from the north (hill) side and the south (flat) side
  const edgeY = (q, x) => { // y at (x, ZS) on the quad's edge lying on z = ZS, or null
    const e = q.vs.filter(v => Math.abs(v[2] - ZS) < 1e-6);
    if (e.length < 2) return null;
    const xs = e.map(v => v[0]); const x0 = Math.min(...xs), x1 = Math.max(...xs);
    if (x < x0 - 1e-6 || x > x1 + 1e-6) return null;
    if (x1 - x0 < 1e-6) return e[0][1];
    const a = e.find(v => Math.abs(v[0] - x0) < 1e-6), b = e.find(v => Math.abs(v[0] - x1) < 1e-6);
    return a[1] + (b[1] - a[1]) * (x - x0) / (x1 - x0);
  };
  const bad = [];
  for (let x = OX + 4; x <= OX + 16; x += 0.5) {
    const xq = Math.abs(x - Math.round(x)) < 1e-6 ? x + 0.25 : x; // sample inside a block, not on a corner
    let north = null, south = null;
    for (const q of quads) {
      if (q.d !== 2) continue;
      const zs = q.vs.map(v => v[2]); const zmin = Math.min(...zs), zmax = Math.max(...zs);
      const y = edgeY(q, xq); if (y === null) continue;
      if (zmax <= ZS + 1e-6 && zmin < ZS - 1e-6) north = north === null ? y : Math.max(north, y);
      if (zmin >= ZS - 1e-6 && zmax > ZS + 1e-6) south = south === null ? y : Math.max(south, y);
    }
    if (north === null || south === null) { bad.push(`x=${(xq - OX).toFixed(2)} missing top (north ${north} south ${south})`); continue; }
    const lo = Math.min(north, south), hi = Math.max(north, south);
    if (hi - lo < 1e-6) continue;
    // the side faces at z = ZS must cover [lo, hi] at this x (their union; a cliff is a stack of faces)
    const iv = [];
    for (const q of quads) {
      if (q.d !== 4 && q.d !== 5) continue;
      if (!q.vs.every(v => Math.abs(v[2] - ZS) < 1e-6)) continue;
      const xs = q.vs.map(v => v[0]); const x0 = Math.min(...xs), x1 = Math.max(...xs);
      if (xq < x0 - 1e-6 || xq > x1 + 1e-6) continue;
      const at = (xx) => { const c = q.vs.filter(v => Math.abs(v[0] - xx) < 1e-6).map(v => v[1]); return [Math.min(...c), Math.max(...c)]; };
      const [b0, t0] = at(x0), [b1, t1] = at(x1), f = (xq - x0) / (x1 - x0);
      iv.push([b0 + (b1 - b0) * f, t0 + (t1 - t0) * f]);
    }
    iv.sort((a, b) => a[0] - b[0]);
    let cover = 1, cur = lo;
    for (const [b, t] of iv) { if (b > cur + 1e-6) break; if (t > cur) cur = t; }
    if (cur < hi - 1e-6) cover = 0;
    if (cover < 1) bad.push(`x=${(xq - OX).toFixed(2)} north ${north - Y0} south ${south - Y0} sides ${JSON.stringify(iv.map(i => i.map(v => +(v - Y0).toFixed(2))))}`);
  }
  return bad;
}
const only = process.env.OX !== undefined;
for (let OX = only ? +process.env.OX : 0; OX < (only ? +process.env.OX + 1 : 16); OX++) for (let OZ = only ? +process.env.OZ : 0; OZ < (only ? +process.env.OZ + 1 : 16); OZ++) {
  const bad = run(OX, OZ);
  if (bad.length) console.log(`OX=${OX} OZ=${OZ}: ${bad.length} seam problems: ${bad.slice(0, 4).join(' | ')}`);
}
console.log('done');
