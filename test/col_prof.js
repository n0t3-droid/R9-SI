// per-column cost: generate + light + mesh all sections (node, no browser) — calibration for the streaming design
const VR = require('./load_shared.js');
const seed = +(process.env.SEED || 4242);
const g = VR.makeGen('overworld', seed, { vgen: 5 });
const PS = 18, PSS = 324;
const cols = new Map();
const key = (cx, cz) => cx * 65536 + cz;
const t = (f) => { const t0 = process.hrtime.bigint(); const r = f(); return [Number(process.hrtime.bigint() - t0) / 1e6, r]; };
let genMs = 0, lightMs = 0, n = 0;
const cx0 = +(process.env.CX || 0), cz0 = +(process.env.CZ || 0), RD = +(process.env.RD || 4);
for (let cz = cz0 - RD - 1; cz <= cz0 + RD + 1; cz++) for (let cx = cx0 - RD - 1; cx <= cx0 + RD + 1; cx++) {
  const [ms, col] = t(() => g.generate(cx, cz)); genMs += ms;
  const [lms, light] = t(() => VR.computeColumnLight(col.blocks, true)); lightMs += lms;
  col.light = light; cols.set(key(cx, cz), col); n++;
}
console.log('columns', n, 'gen avg ms', (genMs / n).toFixed(1), 'light avg ms', (lightMs / n).toFixed(1));
// mesh every section of the inner columns
let meshMs = 0, secs = 0, empty = 0, quads = [0, 0, 0, 0, 0], jobs = 0, full = 0, fullAll = 0;
const T = VR.R.T, F = VR.F;
for (let cz = cz0 - RD; cz <= cz0 + RD; cz++) for (let cx = cx0 - RD; cx <= cx0 + RD; cx++) {
  const c = cols.get(key(cx, cz));
  const nb = []; for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) nb.push(cols.get(key(cx + dx, cz + dz)));
  // per-section counts & "all opaque" flags
  const cnt = new Int32Array(16), opq = new Uint8Array(16);
  for (let sy = 0; sy < 16; sy++) { let k = 0, o = 1; const b = sy << 12; for (let i = 0; i < 4096; i++) { const s = c.blocks[b + i]; if (s) k++; if (!s || !(T.flags[s] & F.OPAQUE)) o = 0; } cnt[sy] = k; opq[sy] = o; }
  for (let sy = 0; sy < 16; sy++) {
    secs++;
    if (cnt[sy] === 0) { empty++; continue; }
    if (opq[sy]) { full++; const up = sy < 15 ? opq[sy + 1] : 0; if (up && sy > 0 && opq[sy - 1]) fullAll++; }
    const blocks = new Uint16Array(PS * PS * PS), light = new Uint16Array(PS * PS * PS), grass = new Uint16Array(PS * PS), foliage = new Uint16Array(PS * PS), water = new Uint16Array(PS * PS);
    const y0 = sy * 16 - 1;
    for (let pz = 0; pz < PS; pz++) { const lz = pz - 1, czi = lz < 0 ? 0 : lz > 15 ? 2 : 1, iz = (lz + 16) & 15; for (let px = 0; px < PS; px++) { const lx = px - 1, cxi = lx < 0 ? 0 : lx > 15 ? 2 : 1, ix = (lx + 16) & 15; const nn = nb[czi * 3 + cxi]; const ci = (iz << 4) | ix, ti = pz * PS + px; grass[ti] = nn.tints.grass[ci]; foliage[ti] = nn.tints.foliage[ci]; water[ti] = nn.tints.water[ci]; for (let py = 0; py < PS; py++) { const y = y0 + py, o = py * PSS + pz * PS + px; if (y < 0 || y > 255) { blocks[o] = 0; light[o] = y > 255 ? 0xf000 : 0; continue; } const i = (y << 8) | ci; blocks[o] = nn.blocks[i]; light[o] = nn.light[i]; } } }
    const [ms, r] = t(() => VR.meshSection({ blocks, light, grass, foliage, water, sy, ox: cx * 16, oz: cz * 16, fancyLeaves: true, smooth: true, vxLod: true }));
    meshMs += ms; jobs++;
    quads[0] += r.opaque.length >> 5; quads[1] += r.cutout.length >> 5; quads[2] += r.trans.length >> 5; if (r.vx) quads[3] += r.vx.length >> 5; if (r.vxFar) quads[4] += r.vxFar.length >> 5;
  }
}
const ncol = (2 * RD + 1) ** 2;
console.log('sections', secs, 'empty', empty, 'all-opaque', full, 'buried(all-opaque with opaque above+below)', fullAll, 'mesh jobs', jobs, 'mesh avg ms', (meshMs / jobs).toFixed(1), 'mesh ms per column', (meshMs / ncol).toFixed(0));
console.log('quads per column [opaque,cutout,trans,vx,vxFar]', quads.map(q => (q / ncol).toFixed(0)).join(' '));
