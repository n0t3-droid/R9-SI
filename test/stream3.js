// p-stream3 · walking and Very Low fast flight (src/main/world.js idleRing / vxSkip, src/shared/stream.js, mesher.js), no browser:
//  a · the idle ring: standing with nothing to do, the columns one ring beyond the request disk on the side the player
//      looks at are generated (never behind, never with IDLE_RING 0, never while columns are still wanted)
//  b · a walk that starts at a chunk's edge (a slow worker: a column 60 ms, a section 15 ms): the columns coming into view
//      have their 8 neighbours already (the browser trace of v0.55.40: every late walking column was in the walk's first
//      second, 5–7 of 8 neighbours missing) and are there within 1 s (p90), sooner than without the ring
//  c · fast flight above VX_SKIP: a section's first mesh leaves the mini-voxel models out (job.vxSkip); once the flight
//      slows those inside the render distance are meshed again with them, the flag cleared
//  d · the mesher with vxSkip: the town's sections — the opaque, cutout and transparent streams and the visibility mask
//      exactly as without (the models only drop out), the model streams empty, the skipped models counted, less time
//  e · the far lane's share never grows when the chunks lag
//   bash test/wt_run.sh stream3.js
const V = require('./load_shared.js');
global.window = undefined;
require('../src/main/gl.js'); require('../src/main/shaders.js'); require('../src/main/ultralite.js'); require('../src/main/renderer.js');
const SIM = { now: 0, workers: [], sent: [] };
const COST = { gen: 60, mesh: 15, lod: 40 };
global.Worker = class {
  constructor() { this.jobs = []; this.end = 0; SIM.workers.push(this); }
  postMessage(m) { if (!m || !m.id) return; SIM.sent.push(m); const t = Math.max(SIM.now, this.end) + (COST[m.type] || 5); this.end = t; this.jobs.push({ m, at: t }); }
  terminate() {}
};
global.Blob = class {}; global.URL = { createObjectURL: () => 'blob:x' };
require('../src/main/world.js');
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
const SP = V.StreamPlan;
const cosH = Math.cos(54 * Math.PI / 180);
const stone = V.R.byName.stone.defaultState;
const BL = (() => { const b = new Uint16Array(256 * 256); for (let i = 0; i < 256 * 60; i++) b[i] = stone; return b; })();
const LI = (() => { const l = new Uint16Array(256 * 256); for (let i = 256 * 60; i < l.length; i++) l[i] = 0xf000; return l; })();
const reply = (m) => {
  if (m.type === 'gen') return { type: 'gen', id: m.id, ms: COST.gen, cx: m.cx, cz: m.cz, blocks: BL.slice(), light: LI.slice(), biome: new Uint8Array(256), caveBiome: new Int8Array(256), grass: new Uint16Array(256), foliage: new Uint16Array(256), water: new Uint16Array(256), spawns: [], be: null };
  if (m.type === 'mesh') return { type: 'mesh', id: m.id, ms: COST.mesh, vis: 0x7fff, opaque: new Float32Array(8), cutout: null, trans: null, vx: null, vxFar: null, props: null, vxSkipped: m.vxSkip ? 3 : 0 };
  return { type: 'error', id: m.id, msg: 'sim' };
};
function world(rd) {
  SIM.now = 0; SIM.workers.length = 0; SIM.sent.length = 0;
  const pool = new V.WorkerPool('', 1);
  const renderer = { freeSection() {}, uploadSection() {}, q: { vxLod: 12, upload: 2 } };
  const w = new V.World({ vents: null }, { dim: 'overworld', seed: 1, genOpts: {}, pool, renderer, renderDist: rd });
  w.streamPlan = true; w.viewDir = [0, -1]; w.viewCos = cosH;
  w.uploadQ.cpuEst = w.uploadQ.msPerByte = 1e-9;
  w.step = (x, z) => {
    w.update(x, 100, z, SIM.now);
    for (const wk of SIM.workers) { while (wk.jobs.length && wk.jobs[0].at <= SIM.now) { const j = wk.jobs.shift(); wk.onmessage({ data: reply(j.m) }); } }
    SIM.now += 33.3;
  };
  return w;
}
const ring0 = SP.IDLE_RING;

console.log('a · the idle ring');
{
  const rd = 5, r0 = rd + SP.RIM, r1 = r0 + SP.IDLE_RING;
  const count = (w) => { let ahead = 0, aheadN = 0, behind = 0; for (let dz = -9; dz <= 9; dz++) for (let dx = -9; dx <= 9; dx++) { const d2 = dx * dx + dz * dz; if (d2 <= r0 * r0 || d2 > r1 * r1) continue; const c = -dz / Math.sqrt(d2), has = w.cols.has(V.ckey(dx, dz)); if (c >= 0) { aheadN++; if (has) ahead++; } else if (c < -0.2 && has) behind++; } return { ahead, aheadN, behind }; };
  let w = world(rd);
  for (let f = 0; f < 60; f++) w.step(8, 8);
  const early = count(w), busy = w.pending.size > 0 || w.lastWant > 0;
  for (let f = 0; f < 900; f++) w.step(8, 8);
  const r = count(w);
  if (process.env.DBG) console.log('     want', w.lastWant, 'pending', w.pending.size, 'queue', w.pool.queue.length, 'cols', w.cols.size);
  check(r.ahead === r.aheadN && r.aheadN > 10, 'standing: every column of the ring ahead generated', `${r.ahead} / ${r.aheadN}`);
  check(r.behind === 0, 'none behind the player', r.behind);
  check(!busy || early.ahead === 0, 'not while the disk itself still loads', `after 2 s: ${early.ahead} ring columns, disk busy ${busy}`);
  SP.IDLE_RING = 0; w = world(rd);
  for (let f = 0; f < 900; f++) w.step(8, 8);
  check(count(w).ahead === 0, 'IDLE_RING 0: off (the old disk)', count(w).ahead);
  SP.IDLE_RING = ring0;
}

console.log('b · a walk that starts at a chunk\'s edge');
function walk(rd, ring, late) {
  SP.IDLE_RING = ring; const wl0 = SP.WALK_LATE; if (late !== undefined) SP.WALK_LATE = late;
  const w = world(rd);
  for (let f = 0; f < 1200; f++) w.step(8, 2);   // 40 s standing at z = 2: 2 blocks from the chunk's edge
  let z = 2; const ent = new Map(), ttv = []; let nbMiss = 0, entered = 0;
  for (let f = 0; f < 30 * 12; f++) {
    z -= 5 / 30; w.step(8, z);
    if (f % 3) continue;
    const pcz = Math.floor(z) >> 4;
    for (let dz = -rd; dz <= rd; dz++) for (let dx = -rd; dx <= rd; dx++) {
      if (dx * dx + dz * dz > (rd + 0.5) * (rd + 0.5) || (Math.abs(dx) <= 1 && Math.abs(dz) <= 1)) continue;
      const ex = dx * 16, ez = (pcz + dz) * 16 + 8 - z, d = Math.hypot(ex, ez);
      if (-ez / d < cosH) continue;
      const cx = dx, cz = pcz + dz, k = V.ckey(cx, cz), c = w.cols.get(k), sh = !!(c && c.shownAt >= 0);
      const e = ent.get(k);
      if (e === undefined) { ent.set(k, sh ? -1 : SIM.now); if (!sh) { entered++; let nb = 0; for (let oz = -1; oz <= 1; oz++) for (let ox = -1; ox <= 1; ox++) if ((ox || oz) && w.cols.has(V.ckey(cx + ox, cz + oz))) nb++; if (nb < 8) nbMiss++; } }
      else if (e >= 0 && sh) { ttv.push(SIM.now - e); ent.set(k, -1); }
    }
  }
  for (const e of ent.values()) if (e >= 0) ttv.push(SIM.now - e);
  ttv.sort((a, b) => a - b);
  SP.IDLE_RING = ring0; SP.WALK_LATE = wl0;
  return { p90: Math.round(ttv[Math.floor(ttv.length * 0.9)] || 0), max: Math.round(ttv[ttv.length - 1] || 0), entered, nbMiss };
}
for (const rd of [6, 5]) {
  const o = walk(rd, 0, 0), q = walk(rd, ring0, 0), p = walk(rd, ring0);
  console.log(`     rd ${rd}  v0.55.40: ${JSON.stringify(o)}  ring: ${JSON.stringify(q)}  ring + rim first: ${JSON.stringify(p)}`);
  check(p.nbMiss === 0 && p.nbMiss <= o.nbMiss, `rd ${rd}: the columns coming into view have their 8 neighbours`, `missing on ${o.nbMiss} → ${p.nbMiss} of ${p.entered}`);
  check(p.p90 <= 1000 && p.p90 <= o.p90, `rd ${rd}: there within 1 s (p90), not later than without the ring`, `${o.p90} → ${p.p90} ms (max ${o.max} → ${p.max})`);
}

console.log('c · fast flight: the first mesh without the mini-voxel models');
{
  const w = world(5);
  for (let f = 0; f < 600; f++) w.step(8, 8);
  SIM.sent.length = 0;
  let z = 8;
  for (let f = 0; f < 30 * 8; f++) { z -= 80 / 30; w.step(8, z); }
  const fast = SIM.sent.filter(m => m.type === 'mesh'), skipped = fast.filter(m => m.vxSkip).length;
  check(fast.length > 20 && skipped > fast.length * 0.8, '80 m/s: the meshes leave the models out', `${skipped} / ${fast.length}`);
  let flagged = 0; for (const c of w.cols.values()) for (const s of c.sec) if (s.vxSkipped) flagged++;
  check(flagged > 0 && w.vxSkipN > 0, 'the sections remember it', flagged);
  SIM.sent.length = 0;
  for (let f = 0; f < 30 * 5; f++) { if (f === 30) SIM.sent.length = 0; w.step(8, z); }   // stopped: 5 s (the meshes after the first second: the speed's average has come down)
  const back = SIM.sent.filter(m => m.type === 'mesh');
  let left = 0, leftIn = 0; const pcz = Math.floor(z) >> 4;
  for (const c of w.cols.values()) for (const s of c.sec) if (s.vxSkipped) { left++; const dz = c.cz - pcz, dx = c.cx; if (dx * dx + dz * dz <= 5.5 * 5.5) leftIn++; }
  check(back.length > 0 && back.every(m => !m.vxSkip) && leftIn === 0, 'stopped: meshed again with the models inside the render distance', `${back.length} meshes, ${leftIn} left inside, ${left} outside`);
  const w2 = world(5);
  for (let f = 0; f < 600; f++) w2.step(8, 8);
  SIM.sent.length = 0; z = 8;
  for (let f = 0; f < 30 * 4; f++) { z -= 30 / 30; w2.step(8, z); }
  check(SIM.sent.filter(m => m.type === 'mesh' && m.vxSkip).length === 0, '30 m/s: the models stay in (only above ' + SP.VX_SKIP + ' blocks/s)');
}

console.log('d · the mesher with vxSkip (the town\'s sections)');
{
  const PAD = V.MESH_PAD || 1, PS = V.MESH_PS || 18, PSS = PS * PS;
  const g = V.makeGen('overworld', 12345, { vgen: 5 }), CX = 1, CZ = -13, cols = {};
  for (let cz = -1; cz <= 1; cz++) for (let cx = -1; cx <= 1; cx++) { const c = g.generate(CX + cx, CZ + cz); c.light = V.computeColumnLight(c.blocks, true); cols[cx + ',' + cz] = c; }
  const job = (sy) => {
    const blocks = new Uint16Array(PSS * PS), light = new Uint16Array(PSS * PS), gr = new Uint16Array(PSS), fo = new Uint16Array(PSS), wa = new Uint16Array(PSS);
    for (let y = -PAD; y < 16 + PAD; y++) for (let z = -PAD; z < 16 + PAD; z++) for (let x = -PAD; x < 16 + PAD; x++) {
      const wy = sy * 16 + y, c = cols[Math.floor(x / 16) + ',' + Math.floor(z / 16)], lx = ((x % 16) + 16) % 16, lz = ((z % 16) + 16) % 16, pi = (y + PAD) * PSS + (z + PAD) * PS + (x + PAD);
      if (y === 0) { gr[(z + PAD) * PS + x + PAD] = c.tints.grass[lz * 16 + lx]; fo[(z + PAD) * PS + x + PAD] = c.tints.foliage[lz * 16 + lx]; wa[(z + PAD) * PS + x + PAD] = c.tints.water[lz * 16 + lx]; }
      if (wy < 0 || wy > 255) { light[pi] = wy > 255 ? 0xf000 : 0; continue; }
      const i = (wy << 8) | (lz << 4) | lx; blocks[pi] = c.blocks[i]; light[pi] = c.light[i];
    }
    return { blocks, light, grass: gr, foliage: fo, water: wa, sy, ox: CX * 16, oz: CZ * 16, smooth: true, fancyLeaves: true, vxLod: true, vxDetail: false };
  };
  const same = (a, b) => { if (!a || !b) return (!a || !a.length) === (!b || !b.length); if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; };
  let ok = true, nSkip = 0, msA = 0, msB = 0, vxA = 0;
  for (let rep = 0; rep < 3; rep++) for (let sy = 3; sy < 9; sy++) {
    const j1 = job(sy), j2 = job(sy); j2.vxSkip = true;
    let t = performance.now(); const a = V.meshSection(j1); msA += performance.now() - t;
    t = performance.now(); const b = V.meshSection(j2); msB += performance.now() - t;
    if (rep) continue;
    ok = ok && same(a.opaque, b.opaque) && same(a.cutout, b.cutout) && same(a.trans, b.trans) && a.vis === b.vis && (!b.vx || !b.vx.length) && (!b.vxFar || !b.vxFar.length);
    nSkip += b.vxSkipped || 0; vxA += (a.vx ? a.vx.length : 0) + (a.vxFar ? a.vxFar.length : 0);
  }
  check(ok, 'the block streams and the visibility exactly as without; the model streams empty');
  check(nSkip > 0 && vxA > 0, 'the skipped models are counted', `${nSkip} models, ${vxA} floats of model mesh left out`);
  check(msB < msA, 'less mesh time', `${msA.toFixed(0)} → ${msB.toFixed(0)} ms (6 sections × 3)`);
}

console.log('e · the far lane\'s share');
check(SP.share(80, 3, 5) <= SP.SHARE_BASE && SP.share(40, 3, 5) <= SP.SHARE_BASE && SP.share(5, 3, 5) === SP.SHARE_BASE, 'never more for the far tiles when the chunks lag', [5, 40, 80].map(s => SP.share(s, 3, 5)).join(' · '));
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
