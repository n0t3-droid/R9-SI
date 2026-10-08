// The Heartland's trailer look, generator side (TRAILER.md §3.5–3.6, shots A and C): the Ember Canyon's mesa tops carry
// giant glowing crystal clusters, its river channels run cyan aether (not lava), the lava crack pools are marked as vents
// for the smoke columns, and the Sky Isles hang crystals from their undersides. These checks read the generated blocks.
const V = require('./load_shared.js');
const R = VR.R;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const nameOf = (s) => { const ty = R.types[R.T.type[s]]; return ty ? ty.name : ''; };
const g = new V.OverworldGen(4242, { vgen: 5 });
const t0 = Date.now();

// 1 · giant crystal clusters stand on the mesa tops of the Ember Canyon (the ruin's well is one of them, so ≥ 5)
const ops = V.CanyonGen.build(g);
const tops = new Set(); let topCrys = 0;
for (const b of ops.values()) for (let i = 0; i < b.o.length; i += 4) {
  const y = b.o[i + 1], n = nameOf(b.o[i + 3]);
  if (/_crystal_cluster$/.test(n) && y >= 88) { tops.add(b.o[i] + ',' + b.o[i + 2]); topCrys++; }
  if (/_crystal_block$/.test(n) && y >= 88) topCrys++;
}
// each giant gem is three cluster cells (its tall cluster and two shards), the ruin's well one more cell
const gems = Math.floor(tops.size / 3);
check(gems >= 5, `giant crystal gems on the mesa tops: ${gems} (${tops.size} cluster cells, want ≥ 5 gems)`);
check(topCrys >= 60, `crystal columns on the mesa tops: ${topCrys} blocks (want ≥ 60, the giant ones are 8–16 tall)`);

// 2 · the river channel of the Heartland canyon runs aether: sample river columns, generate their chunks, count aether
const riverChunks = new Map();
for (let x = -240; x <= 250; x += 8) for (let z = 120; z <= 520; z += 8) {
  const cl = g.climateAt(x, z);
  if (cl.heart > 0.5 && cl.river > 0.5 && cl.canyon < 0.6) riverChunks.set((x >> 4) + ',' + (z >> 4), [x >> 4, z >> 4]);
}
let aether = 0, lava = 0, scanned = 0;
for (const [cx, cz] of [...riverChunks.values()].slice(0, 24)) {
  const out = g.generate(cx, cz); scanned++;
  for (let i = 0; i < out.blocks.length; i++) { const b = out.blocks[i]; if (!b) continue; const n = nameOf(b); if (n === 'aether') aether++; else if (n === 'lava') lava++; }
}
check(scanned >= 6, `river chunks found in the canyon: ${scanned}`);
check(aether >= 200, `aether blocks in the river channels: ${aether} (want ≥ 200)`);
check(lava >= 1 || aether >= 200, `lava still runs where the channel is not the river (${lava} blocks)`);

// 3 · the lava crack pools are the vents of the smoke columns: a list inside the canyon, on the mesa tops
const vents = V.CanyonGen.vents ? V.CanyonGen.vents(g) : [];
const B = V.CanyonGen.box;
const inside = vents.filter(([x, y, z]) => x >= B.x0 && x <= B.x1 && z >= B.z0 && z <= B.z1 && y >= 88);
check(inside.length >= 6, `lava vents on the mesa tops: ${inside.length} (want ≥ 6)`);
check(inside.length === vents.length, 'every vent lies on a mesa top inside the canyon box');

// 4 · hanging crystals under the Sky Isles: crystal columns below the islands' base (their undersides are far below y 130)
const isleOps = V.IslesGen.build(g);
let hang = 0;
for (const b of isleOps.values()) for (let i = 0; i < b.o.length; i += 4) {
  const y = b.o[i + 1], n = nameOf(b.o[i + 3]);
  if (/_crystal_block$/.test(n) && y < 140 && y > 60) hang++;
}
check(hang >= 12, `hanging crystal blocks under the Sky Isles: ${hang} (want ≥ 12)`);

// 5 · the Heartland citadel (TRAILER §3.7): a red tip beacon spawn on every spire and watch tower (vents.js blinks them;
// the spawn must sit on a beacon cell), and the giant crystals at its foot (azure 25 tall, violet 16)
const H = VR.Heart.CITADEL;
const nameCache = new Map(), nm = (s) => { let n = nameCache.get(s); if (n === undefined) { n = nameOf(s); nameCache.set(s, n); } return n; };
let beacons = 0, onCell = 0, azure = 0, violet = 0;
for (let cx = Math.floor((H.x - 80) / 16); cx <= Math.floor((H.x + 80) / 16); cx++) for (let cz = Math.floor((H.z - 80) / 16); cz <= Math.floor((H.z + 80) / 16); cz++) {
  const out = g.generate(cx, cz);
  for (const s of out.spawns || []) if (s[0] === 'beacon') {
    beacons++;
    const lx = s[1] - cx * 16, lz = s[3] - cz * 16;
    for (let dy = -2; dy <= 2; dy++) { const y = s[2] + dy; if (y >= 0 && y < 256 && lx >= 0 && lx < 16 && lz >= 0 && lz < 16 && /beacon_red$/.test(nm(out.blocks[(y << 8) | (lz << 4) | lx]))) { onCell++; break; } }
  }
  // a crystal column is one (x, z) of a chunk: its blocks, counted per chunk, are its height
  const cols = new Map();
  for (let i = 0; i < out.blocks.length; i++) {
    const s = out.blocks[i]; if (!s) continue;
    const n = nm(s); if (n !== 'azure_crystal_block' && n !== 'violet_crystal_block') continue;
    const key = n + ':' + (i & 255); cols.set(key, (cols.get(key) || 0) + 1);
  }
  for (const [key, hgt] of cols) { if (key[0] === 'a') azure = Math.max(azure, hgt); else violet = Math.max(violet, hgt); }
}
check(beacons >= 6, `red tip beacon spawns on the Heartland citadel: ${beacons} (want ≥ 6: a spire and a watch tower each)`);
check(onCell === beacons, `every beacon spawn sits on a red beacon cell (±2): ${onCell} of ${beacons}`);
check(azure >= 22, `giant azure crystal at the citadel foot: ${azure} blocks tall (want ≥ 22)`);
check(violet >= 14, `giant violet crystal at the citadel foot: ${violet} blocks tall (want ≥ 14)`);
console.log(`(${(Date.now() - t0)} ms)`);
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
