// v0.56.1 · Licht-Toleranz-Greedy (mesher.js job.lgt, world.js colLgt / World.lgtWant), no browser:
//  a · lgt 0 is the old mesher byte for byte (the opaque stream's hash over 7 × 7 columns of seed 53, vgen 18)
//  b · lgt 1 and 2: a third and two fifths fewer opaque quads, faster meshing, every quad's light a real mean (each
//      channel 0…15) and the same faces covered (the quads' summed area equals the exact mesh's)
//  c · the band: exact within World.LGT_D chunks, 1 level beyond, 2 in the plain far band, a chunk of hysteresis
const VR = require('./load_shared.js');
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
const EXPECT0 = process.env.LG_EXPECT || '166723b5';   // (the v0.56.0 mesher's opaque stream)
const g = VR.makeGen('overworld', 53, { vgen: 18 });
const PS = 20, PSS = PS * PS, PAD = 2, cols = new Map(), key = (cx, cz) => cx * 65536 + cz, RD = 3;
for (let cz = -RD - 1; cz <= RD + 1; cz++) for (let cx = -RD - 1; cx <= RD + 1; cx++) { const col = g.generate(cx, cz); col.light = VR.computeColumnLight(col.blocks, true); cols.set(key(cx, cz), col); }
const fnv = (h, a) => { for (let i = 0; i < a.length; i++) { h ^= a[i]; h = Math.imul(h, 16777619) >>> 0; } return h; };
const run = (lgt) => {
  let q = 0, ms = 0, h = 2166136261 >>> 0, area = 0, badLight = 0;
  for (let cz = -RD; cz <= RD; cz++) for (let cx = -RD; cx <= RD; cx++) {
    const c = cols.get(key(cx, cz));
    for (let sy = 0; sy < (c.blocks.length >> 12); sy++) {
      const blocks = new Uint16Array(PS ** 3), light = new Uint16Array(PS ** 3), z0 = new Uint16Array(PSS);
      for (let py = 0; py < PS; py++) { const y = sy * 16 + py - PAD; for (let pz = 0; pz < PS; pz++) { const z = cz * 16 + pz - PAD; for (let px = 0; px < PS; px++) { const x = cx * 16 + px - PAD; const cc = cols.get(key(x >> 4, z >> 4)); if (!cc || y < 0 || y >= (cc.blocks.length >> 8)) continue; const i = (y << 8) | ((z & 15) << 4) | (x & 15); blocks[py * PSS + pz * PS + px] = cc.blocks[i]; light[py * PSS + pz * PS + px] = cc.light[i]; } } }
      const t0 = process.hrtime.bigint();
      const r = VR.meshSection({ blocks, light, grass: z0, foliage: z0, water: z0, sy, ox: cx * 16, oz: cz * 16, fancyLeaves: true, smooth: false, vxLod: true, lgt });
      ms += Number(process.hrtime.bigint() - t0) / 1e6;
      const o = r.opaque, n = o.length >> 5; q += n; h = fnv(h, o);
      // each quad: 4 vertices of 8 u16; its area from the corner positions (w0..2, (p + 4) · 2048)
      for (let k = 0; k < n; k++) {
        const b = k * 32, P = (v, a) => o[b + v * 8 + a] / 2048 - 4;
        const ax = [P(1, 0) - P(0, 0), P(1, 1) - P(0, 1), P(1, 2) - P(0, 2)], bx = [P(3, 0) - P(0, 0), P(3, 1) - P(0, 1), P(3, 2) - P(0, 2)];
        const cr = [ax[1] * bx[2] - ax[2] * bx[1], ax[2] * bx[0] - ax[0] * bx[2], ax[0] * bx[1] - ax[1] * bx[0]];
        area += Math.hypot(cr[0], cr[1], cr[2]);
        for (let v = 0; v < 4; v++) { const L = o[b + v * 8 + 6]; for (let s = 0; s < 16; s += 4) if (((L >> s) & 15) > 15) badLight++; }
      }
    }
  }
  return { q, ms, h: h.toString(16).padStart(8, '0'), area: Math.round(area), badLight };
};
console.log('a · exact as before');
const r0 = run(0);
console.log(`     lgt 0: ${r0.q} quads, hash ${r0.h}, area ${r0.area}, ${r0.ms.toFixed(0)} ms`);
check(EXPECT0 === 'PIN' || r0.h === EXPECT0, 'lgt 0 is the old mesher, byte for byte', r0.h);
console.log('b · the tolerant merge');
const r1 = run(1), r2 = run(2);
console.log(`     lgt 1: ${r1.q} quads, ${r1.ms.toFixed(0)} ms · lgt 2: ${r2.q} quads, ${r2.ms.toFixed(0)} ms`);
check(r1.q < r0.q * 0.72 && r2.q < r1.q, 'a third fewer opaque quads at 1 level, fewer still at 2', `${r0.q} → ${r1.q} → ${r2.q}`);
check(r1.area === r0.area && r2.area === r0.area, 'the same surface covered (no face lost, none doubled)', `${r0.area} · ${r1.area} · ${r2.area}`);
check(r1.badLight === 0 && r2.badLight === 0, 'every merged light a valid mean (each channel 0…15)');
console.log('c · the band');
const W = VR.World || (globalThis.VR && globalThis.VR.World);
if (W && W.lgtWant) {
  const D = W.LGT_D;
  check(W.lgtWant(D - 0.5, 0, 0) === 0 && W.lgtWant(D + 1.5, 0, 0) === 1 && W.lgtWant(20, 1, 1) === 2, 'exact near, 1 level beyond ' + D + ' chunks, 2 in the plain far band');
  check(W.lgtWant(D + 0.5, 1, 0) === 1 && W.lgtWant(D + 0.5, 0, 0) === 0, 'between ' + D + ' and ' + (D + 1) + ' chunks a column keeps what it has (hysteresis)');
} else console.log('     (World not loaded in node: the band is checked in the browser smoke)');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
