// u-moons1 · the bodies' worlds must not change unless on purpose (like gen_same.js for the overworld's vgen): bgen 1's
// chunks of Basalt and Opal — the landing, the landmark's peak and wall, a fresh crater with its boulders, a rille, the
// highlands, Opal's landing, a linea, a vent in a tiger stripe, chaos — hashed and compared with the pin. The hash reads
// block and biome NAMES, not ids: the three blocks the bodies append (regolith, regolith_dark, tholin_ice) and their
// seven biomes may get other ids when another front appends before them at a merge, and that is no change of a world.
// A change of a body's world goes behind a new bgen (VR.Bodies.BGEN) and leaves bgen 1's chunks as they are; --write
// prints a new pin (for a new bgen's own scenes only).
//   bash test/wt_run.sh body_same.js 300
require('./dom_stub.js');
const V = require('./load_shared.js');
const EXPECT = 'a5408432';   // bgen 1 (before it ships: run 1's tuning — the highlands' crust andesite / diorite, never calcite; the rays two waves, thinner; was 2eec0b88)
const R = V.R, fnv = (h, x) => { h ^= x; return Math.imul(h, 16777619) >>> 0; };
const str = (s) => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) h = fnv(h, s.charCodeAt(i)); return h; };
// a state's stable key: its block's name and its offset from the block's first state
const keyOf = new Map();
const key = (s) => { let k = keyOf.get(s); if (k === undefined) { k = s ? (str(R.types[R.T.type[s]].name) ^ Math.imul(s - R.types[R.T.type[s]].defaultState + 1, 0x9e3779b1)) >>> 0 : 0; keyOf.set(s, k); } return k; };
const bio = (b) => str(V.BIOMES[b] ? V.BIOMES[b].key : 'none:' + b);
const scenes = [
  ['Basalt · the landing', 'basalt', [[0, 0], [-1, 0], [0, -1]]],
  ['Basalt · the landmark: peak, floor, terraced wall', 'basalt', [[18, 24], [21, 24], [28, 24]]],
  ['Basalt · a fresh crater and its boulders', 'basalt', [[7, -13]]],
  ['Basalt · a rille in the landing mare', 'basalt', [[-12, 21]]],
  ['Basalt · the highlands', 'basalt', [[112, 0], [113, 1]]],
  ['Opal · the landing', 'opal', [[0, 0], [-1, -2]]],
  ['Opal · a vent in a tiger stripe', 'opal', [[23, 26]]],
  ['Opal · chaos', 'opal', [[-30, -25]]],
];
const SEED = 4242;
let h = 2166136261 >>> 0, n = 0;
const t0 = performance.now();
for (const [name, id, cols] of scenes) {
  const g = new V.BodyGen(SEED, id, { bgen: { [id]: 1 } });
  let hs = 2166136261 >>> 0;
  for (const [cx, cz] of cols) {
    const c = g.generate(cx, cz);
    for (let i = 0; i < c.blocks.length; i++) hs = fnv(hs, key(c.blocks[i]));
    for (let i = 0; i < 256; i++) hs = fnv(hs, bio(c.biome[i]));
    n++;
  }
  console.log(`     ${name}: ${cols.length} chunk${cols.length > 1 ? 's' : ''}, hash ${hs.toString(16).padStart(8, '0')}`);
  h = fnv(fnv(h, hs & 0xffff), hs >>> 16);
}
const hex = h.toString(16).padStart(8, '0');
// u-moons2: bgen 1 of the three kinds of wave 5 — their own pin (the first stays as it was)
const scenes2 = [
  ['Zinnober · the landing', 'zinn', [[0, 0], [-1, -1]]],
  ['Zinnober · the Glutsee', 'zinn', [[3, -27], [4, -27]]],
  ['Zinnober · a mountain block\'s flank', 'zinn', [[-75, -56]]],
  ['Ocker · the landing', 'ocker', [[0, 0]]],
  ['Ocker · the canyon\'s wall and floor', 'ocker', [[0, 30], [0, 71]]],
  ['Ocker · the shield\'s scarp', 'ocker', [[31, -63]]],
  ['Aquamarin · the landing', 'aqua', [[0, 0]]],
  ['Aquamarin · the atoll\'s ring and lagoon', 'aqua', [[46, -16], [32, -16]]],
];
const EXPECT2 = 'db2223e7';   // u-moons2: bgen 1 of Zinnober, Ocker, Aquamarin (before it ships: runs 1–3's tuning — Ocker's rocks rarer, the canyon's walls steeper and layered to the floor; was a99d1be3, 9f942741, edf473ec)
let h2 = 2166136261 >>> 0;
for (const [name, id, cols] of scenes2) {
  const g = new V.BodyGen(SEED, id, { bgen: { [id]: 1 } });
  let hs = 2166136261 >>> 0;
  for (const [cx, cz] of cols) {
    const c = g.generate(cx, cz);
    for (let i = 0; i < c.blocks.length; i++) hs = fnv(hs, key(c.blocks[i]));
    for (let i = 0; i < 256; i++) hs = fnv(hs, bio(c.biome[i]));
    n++;
  }
  console.log(`     ${name}: ${cols.length} chunk${cols.length > 1 ? 's' : ''}, hash ${hs.toString(16).padStart(8, '0')}`);
  h2 = fnv(fnv(h2, hs & 0xffff), hs >>> 16);
}
const hex2 = h2.toString(16).padStart(8, '0');
console.log(`wave 5's bodies · hash ${hex2}`);
console.log(`${n} chunks, ${(performance.now() - t0).toFixed(0)} ms · hash ${hex}`);
if (process.argv.includes('--write')) { console.log('record in test/body_same.js: EXPECT =', JSON.stringify(hex), '· EXPECT2 =', JSON.stringify(hex2)); process.exit(0); }
const ok = hex === EXPECT, ok2 = hex2 === EXPECT2;
console.log(ok ? '  ✓ bgen 1\'s Basalt and Opal are the same as pinned' : `  ✗ the bodies' worlds changed (expected ${EXPECT}) — a change goes behind a new bgen`);
console.log(ok2 ? '  ✓ bgen 1\'s Zinnober, Ocker and Aquamarin are the same as pinned' : `  ✗ wave 5's bodies changed (expected ${EXPECT2}) — a change goes behind a new bgen`);
console.log(ok && ok2 ? 'ALL OK' : 'FAILED ' + (!ok + !ok2));
process.exit(ok && ok2 ? 0 : 1);
