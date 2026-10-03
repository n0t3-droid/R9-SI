// LOD tile build profile per level, with a breakdown of the sample costs
const VR = require('./load_shared.js');
const seed = +(process.env.SEED || 4242);
const g = VR.makeGen('overworld', seed, { vgen: 5 });
const time = (f, n) => { const t0 = process.hrtime.bigint(); for (let i = 0; i < n; i++) f(i); return Number(process.hrtime.bigint() - t0) / 1e6 / n; };
console.log('gen class', g.constructor.name, 'computeClimate', !!g.computeClimate, 'islandAt', !!g.islandAt, 'climateAt', !!g.climateAt);
// per-sample costs
const X0 = 1234, Z0 = -777;
console.log('computeClimate µs', (time((i) => g.computeClimate(X0 + i * 7, Z0 + i * 3), 2000) * 1000).toFixed(1));
const cls = []; for (let i = 0; i < 500; i++) cls.push([X0 + i * 7, Z0 + i * 3, g.computeClimate(X0 + i * 7, Z0 + i * 3)]);
// surfTop replica from lod.js
function surfTop(g, cl, X, Z) {
  const H = cl.H, A = cl.A;
  const hiY = H + A * 1.2 + 8, loY = H - A * 1.2 - 8;
  const dens = (i) => { const y = i * 8; if (y > hiY || y < loY) return H - y; return (H - y) + A * g.n3.n3(X, y * 1.15, Z); };
  let i = Math.min(31, Math.max(0, Math.floor(hiY / 8) + 1));
  let d1 = dens(i + 1);
  for (; i >= 0; i--) { const d0 = dens(i); if (d0 > 0 || d1 > 0) for (let y = i * 8 + 7; y >= i * 8; y--) { const f = (y & 7) / 8; if (d0 * (1 - f) + d1 * f > 0) return y; } d1 = d0; }
  return 0;
}
console.log('surfTop µs', (time((i) => { const c = cls[i % 500]; surfTop(g, c[2], c[0], c[1]); }, 2000) * 1000).toFixed(1));
if (g.islandAt) console.log('islandAt µs', (time((i) => g.islandAt(X0 + i * 7, Z0 + i * 3), 2000) * 1000).toFixed(1));
if (g.biomeFor) console.log('biomeFor µs', (time((i) => { const c = cls[i % 500]; g.biomeFor(c[2], 70); }, 2000) * 1000).toFixed(1));
if (g.patchN) console.log('patchN µs', (time((i) => g.patchN.n2(X0 + i * 7, Z0 + i * 3), 2000) * 1000).toFixed(1));
if (VR.CitadelGen) console.log('CitadelGen.near(1024) ms', time(() => VR.CitadelGen.near(g, 0, 0, 1024, 1024, 0), 5).toFixed(2), 'near(256) ms', time(() => VR.CitadelGen.near(g, 0, 0, 256, 256, 0), 5).toFixed(2));
// full tiles
for (const L of [0, 1, 2, 3]) {
  const S = 32 * (4 << L);
  const r = [];
  for (let k = 0; k < 4; k++) { const tx = Math.floor((X0 + k * S * 3) / S), tz = Math.floor(Z0 / S); const t0 = process.hrtime.bigint(); const res = VR.LOD.build(g, { level: L, tx, tz }); r.push([Number(process.hrtime.bigint() - t0) / 1e6, res && res.count ? res.count / 3 : 0]); }
  console.log('L' + L, 'tile', S, 'blocks:', r.map(([ms, tris]) => ms.toFixed(0) + 'ms/' + (tris / 1000).toFixed(1) + 'k tris').join('  '));
}
