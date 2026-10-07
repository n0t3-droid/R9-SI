// Main-thread work per frame that does not need a browser: the streaming world's mesh scheduling and the renderer's
// visibility walk, on a world the size of the Balanced preset (render distance 10, ~350 columns, 16 sections each).
// Both must choose the same sections as before (hashed) and stay cheap — they run every frame, and on a small
// machine every millisecond here is a dropped frame while the world streams in.
//   bash test/wt_run.sh frame_cost.js
const V = require('./load_shared.js');
global.window = undefined;
require('../src/main/gl.js'); require('../src/main/shaders.js'); require('../src/main/renderer.js');
global.Worker = class { constructor() { this.inflight = 0; } postMessage() {} terminate() {} };
global.Blob = class {}; global.URL = { createObjectURL: () => 'blob:x' };
require('../src/main/world.js');
let fail = 0;
const check = (ok, what) => { console.log((ok ? 'OK   ' : 'FAIL ') + what); if (!ok) fail++; };
const fnv = (h, v) => { h ^= v & 0xffff; h = Math.imul(h, 16777619) >>> 0; h ^= v >>> 16; return Math.imul(h, 16777619) >>> 0; };
const cpu = (f, n) => { let best = 1e9; for (let r = 0; r < 5; r++) { const c0 = process.cpuUsage(); for (let i = 0; i < n; i++) f(i); const c1 = process.cpuUsage(c0); best = Math.min(best, (c1.user + c1.system) / 1000 / n); } return best; };
// ---- a world of the Balanced size, every column ready, every section meshed, caves everywhere (full visibility) ----
const RD = 10;
const pool = { workers: [{ inflight: 0 }, { inflight: 0 }], queue: [], queueFar: [], submitted: [], submit(msg, tr, cb, prio) { this.submitted.push([msg.key, msg.sy, prio]); }, pump() {}, broadcast() {}, queueDirty: false };
const renderer = { freeSection() {}, uploadSection() {}, q: { vxLod: 48 } };
const world = new V.World({}, { dim: 'overworld', seed: 1, genOpts: {}, pool, renderer, renderDist: RD });
const stone = V.R.byName.stone.defaultState;
let ncol = 0;
for (let cz = -RD - 2; cz <= RD + 2; cz++) for (let cx = -RD - 2; cx <= RD + 2; cx++) {
  if (cx * cx + cz * cz > (RD + 2.5) * (RD + 2.5)) continue;
  const c = new V.Column(cx, cz);
  c.blocks = new Uint16Array(65536); c.light = new Uint16Array(65536); c.biome = new Uint8Array(256); c.caveBiome = new Int8Array(256);
  c.grass = new Uint16Array(256); c.foliage = new Uint16Array(256); c.water = new Uint16Array(256);
  for (let i = 0; i < 256 * 70; i++) c.blocks[i] = stone;
  for (let sy = 0; sy < 16; sy++) { const s = c.sec[sy]; s.count = sy < 5 ? 4096 : 0; s.dirty = false; s.meshed = true; s.hasMesh = sy < 5; s.vis = 0x7fff; s.ox = cx * 16; s.oy = sy * 16; s.oz = cz * 16; s.mesh = [sy < 5 ? { arena: null, off: 0, cap: 96, count: 96 } : null, null, null, null, null]; }
  c.ready = true; world.cols.set(c.key, c); ncol++;
}
console.log(`     world: ${ncol} columns, ${ncol * 16} sections`);
// ---- 1. scheduleMeshes with everything dirty (a look switch, a style change: remeshAll) ----
{
  const dirtyAll = () => { for (const c of world.cols.values()) for (let sy = 0; sy < 16; sy++) { const s = c.sec[sy]; s.dirty = s.count > 0; s.pending = false; s.ver++; } };
  dirtyAll(); pool.submitted.length = 0; world.meshInflight = 0;
  world.scheduleMeshes(0, 4, 0, 0, 0, [8, 70, 8]);
  const first = pool.submitted.slice();
  let h = 2166136261 >>> 0; for (const [k, sy] of first) { h = fnv(h, k); h = fnv(h, sy); }
  const EXPECT = 'e54b7c79';
  check(first.length > 0 && first.length <= 8 + 2 * 8, `one frame of scheduling asks for ${first.length} sections (the per-frame budget)`);
  check(h.toString(16).padStart(8, '0') === EXPECT, `the nearest ones first, the same ones as before (hash ${h.toString(16).padStart(8, '0')}, expected ${EXPECT})`);
  // the per-frame cost while the whole world is dirty: the submitted ones are 'pending' again next frame
  let best = 1e9;
  for (let r = 0; r < 30; r++) {
    for (const c of world.cols.values()) for (const s of c.sec) if (s.count && !s.dirty) { s.dirty = true; s.pending = false; }
    pool.submitted.length = 0; world.meshInflight = 0;
    const c0 = process.cpuUsage(); world.scheduleMeshes(0, 4, 0, 0, 0, [8, 70, 8]); const c1 = process.cpuUsage(c0);
    best = Math.min(best, (c1.user + c1.system) / 1000);
  }
  const ms = best;
  console.log(`     scheduleMeshes with ${ncol * 5} dirty sections: ${ms.toFixed(2)} ms per frame`);
  check(ms < 1.5, 'scheduling a fully dirty world costs under 1.5 ms a frame');
  // the idle cost: nothing dirty, workers free
  for (const c of world.cols.values()) for (const s of c.sec) { s.dirty = false; s.pending = false; }
  world.meshInflight = 0;
  const idle = cpu(() => world.scheduleMeshes(0, 4, 0, 0, 0, [8, 70, 8]), 50);
  console.log(`     scheduleMeshes with nothing dirty: ${idle.toFixed(3)} ms per frame`);
  check(idle < 0.3, 'an idle world costs under 0.3 ms a frame to check');
}
// ---- 2. the visibility walk ----
{
  const r = Object.create(V.Renderer.prototype);
  r.visList = []; r.visDirty = true; r.visKey = ''; r.frameNo = 1; r.q = { noCaveCull: false };
  const cam = { x: 8, y: 66, z: 8 };
  const list = r.collectVisible(world, cam);
  let h = 2166136261 >>> 0; for (const s of list) { h = fnv(h, s.ox + 32768); h = fnv(h, s.oy); h = fnv(h, s.oz + 32768); }
  const EXPECT = '71274efd';
  let inRange = 0; for (const c of world.cols.values()) if (c.cx * c.cx + c.cz * c.cz <= (RD + 0.5) * (RD + 0.5)) inRange++;
  check(list.length === inRange * 5, `the walk from inside the world reaches every meshed section in range (${list.length} = ${inRange} columns × 5)`);
  check(h.toString(16).padStart(8, '0') === EXPECT, `in the same order as before (hash ${h.toString(16).padStart(8, '0')}, expected ${EXPECT})`);
  const ms = cpu(() => { r.visDirty = true; r.collectVisible(world, cam); }, 20);
  console.log(`     collectVisible over ${ncol * 16} sections: ${ms.toFixed(2)} ms (it runs whenever a section was uploaded — every frame while the world streams in)`);
  check(ms < 1.5, 'the visibility walk costs under 1.5 ms');
}
// ---- 3. buildJob: the padded section handed to the mesher, cell for cell as before (the v0.39 copy loop is the reference) ----
{
  const PAD = 2, PS = 20, PSS = 400;
  function refJob(w, c, sy) {
    const blocks = new Uint16Array(PS * PS * PS), light = new Uint16Array(PS * PS * PS);
    const grass = new Uint16Array(PS * PS), foliage = new Uint16Array(PS * PS), water = new Uint16Array(PS * PS);
    const nb = [];
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) nb.push(w.col(c.cx + dx, c.cz + dz));
    const y0 = sy * 16 - PAD, skyFull = w.hasSky ? 0xf000 : 0;
    for (let pz = 0; pz < PS; pz++) {
      const lz = pz - PAD, cz = lz < 0 ? 0 : lz > 15 ? 2 : 1, iz = (lz + 16) & 15;
      for (let px = 0; px < PS; px++) {
        const lx = px - PAD, cxi = lx < 0 ? 0 : lx > 15 ? 2 : 1, ix = (lx + 16) & 15;
        const n = nb[cz * 3 + cxi], ci = (iz << 4) | ix, ti = pz * PS + px;
        if (n) { grass[ti] = n.grass[ci]; foliage[ti] = n.foliage[ci]; water[ti] = n.water[ci]; }
        for (let py = 0; py < PS; py++) {
          const y = y0 + py, o = py * PSS + pz * PS + px;
          if (y < 0) { blocks[o] = 0; light[o] = 0; continue; }
          if (!n || y >= n.H) { blocks[o] = 0; light[o] = n ? 0xf000 : skyFull; continue; }
          const i = (y << 8) | ci; blocks[o] = n.blocks[i]; light[o] = n.light[i];
        }
      }
    }
    return { blocks, light, grass, foliage, water };
  }
  const same = (a, b) => { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; };
  const g = V.makeGen('overworld', 12345, { vgen: 5 });
  const w2 = new V.World({}, { dim: 'overworld', seed: 12345, genOpts: {}, pool, renderer, renderDist: 4 });
  const w3 = new V.World({}, { dim: 'drift', seed: 12345, genOpts: {}, pool, renderer, renderDist: 4 });   // no sky
  for (const w of [w2, w3]) for (let cz = -14; cz <= -12; cz++) for (let cx = 0; cx <= 2; cx++) {
    if (w === w2 && cx === 2 && cz === -14) continue;   // one neighbour missing
    const col = g.generate(cx, cz), light = V.computeColumnLight(col.blocks, true);
    const H = (cx === 1 && cz === -13) ? 320 : 256;   // the middle column grew (a tower)
    const blocks = new Uint16Array(H << 8); blocks.set(col.blocks); const lt = new Uint16Array(H << 8); lt.set(light); if (H > 256) lt.fill(0xf000, 65536);
    w.onColumn({ cx, cz, blocks, light: lt, biome: col.biome, caveBiome: col.caveBiome, grass: col.tints.grass, foliage: col.tints.foliage, water: col.tints.water, chests: [], spawns: [] });
  }
  pool.submitted.length = 0;
  let n = 0, ok = true;
  for (const w of [w2, w3]) for (const c of w.cols.values()) for (let sy = 0; sy < c.sec.length; sy++) {
    const a = w.buildJob(c, sy), b = refJob(w, c, sy); n++;
    if (!(same(a.blocks, b.blocks) && same(a.light, b.light) && same(a.grass, b.grass) && same(a.foliage, b.foliage) && same(a.water, b.water) && a.sy === sy && a.key === c.key && a.ox === c.cx * 16 && a.oz === c.cz * 16)) { ok = false; console.log('     differs: column', c.cx, c.cz, 'section', sy, 'sky', w.hasSky); }
  }
  check(ok, `buildJob: ${n} padded sections (town columns, a 320-high one, a missing neighbour, with and without sky) are cell for cell what the v0.39 loop made`);
  const c = w2.col(1, -13);
  const tNew = cpu(() => w2.buildJob(c, 6), 200), tRef = cpu(() => refJob(w2, c, 6), 200);
  console.log(`     buildJob: ${(tNew * 1000).toFixed(0)} µs per section (v0.39 loop ${(tRef * 1000).toFixed(0)} µs) — 20 of them a frame while the world streams in`);
  check(tNew < tRef, 'buildJob is faster than the cell-by-cell loop');
}
console.log(fail ? `FAIL ${fail}` : 'OK — frame costs');
process.exit(fail ? 1 : 0);
