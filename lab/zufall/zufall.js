// ============================================================================
// R9-SI Lab · Zufallslabor: tausende Zufallsproben am eigenen Code des Spiels. Alles wird aufgeschrieben, Auffälliges
// markiert. Jede Probe zieht ihren eigenen Keim aus dem Keim des Laufs, also lässt sich jede einzeln wiederholen.
// The random lab: thousands of random probes at the game's own code (the shared sources its workers run). Every
// record is written down (JSON lines), the odd ones are flagged. Each probe draws its own seed from the run's seed, so
// any record can be replayed alone (--replay fam:sub).
//   node lab/zufall/zufall.js --fam gen-det,gen-water --n 50 --seed 20261127 --out lab/out/zufall
// Families:
//   gen-det    the same chunk twice, and once after other chunks (order must not matter), in a fresh process now and then
//   gen-water  water walls (water beside air at its own height) and hanging water (air under it)
//   gen-far    chunks far out (up to 10⁹ blocks): errors, the land's roughness against the same world near the start
//   gen-corr   are neighbouring seeds, mirrored or shifted places alike? (a control pair 16 blocks apart must be)
//   mesh-fuzz  random block soups (any block, any light, any look flags) through the mesher: errors, empty quads,
//              geometry far out of its section
//   mesh-cost  every block alone and as a 3 × 3 × 3 heap: its quads, its time, how far its geometry reaches out of
//              its cell
//   light-inv  the flood fill's local laws on generated columns with random lights put in
//   noise      the noise's range, its precision far out, its periods
//   view       random eyes in random worlds: every section's quads (is the cost a heavy tail?), the blocks whose faces
//              dominate, the share hidden behind hills (lab/tools/horizon.js), the meshes' reach out of their boxes
// ============================================================================
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const W = require('../lib/world.js');
const VR = W.VR, R = W.R, F = W.F;

// ---- the run's arguments
const A = {};
for (let i = 2; i < process.argv.length; i++) { const k = process.argv[i]; if (k.startsWith('--')) { const v = process.argv[i + 1]; if (v === undefined || v.startsWith('--')) A[k.slice(2)] = true; else { A[k.slice(2)] = v; i++; } } }
const RUN_SEED = (+A.seed || 20261127) >>> 0, N = +A.n || 20, OUT = A.out || path.join(__dirname, '../out/zufall');

// ---- randomness: mulberry32 (a probe's whole draw follows from its sub-seed)
function rng(seed) {
  let s = seed >>> 0;
  const f = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.int = (a, b) => a + Math.floor(f() * (b - a + 1));
  f.u32 = () => (f() * 4294967296) >>> 0;
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  f.range = (a, b) => a + f() * (b - a);
  return f;
}
const fnv = (a) => { let h = 2166136261 >>> 0; for (let i = 0; i < a.length; i++) { h ^= a[i]; h = Math.imul(h, 16777619) >>> 0; } return h.toString(16); };
const nameOf = (s) => (s ? R.types[R.T.type[s]].name : 'air');
const AIR = 0;
const pearson = (a, b) => { const n = a.length; let ma = 0, mb = 0; for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; } ma /= n; mb /= n; let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; sab += x * y; saa += x * x; sbb += y * y; } return saa && sbb ? sab / Math.sqrt(saa * sbb) : 0; };
const VG_NEW = W.newestVgen();

// ---- a padded section (20³: the mesher's PAD of 2) for the mesher, from generated columns with light
const PAD = VR.MESH_PAD, PS = VR.MESH_PS, PSS = PS * PS;
const pidx = (x, y, z) => (y + PAD) * PSS + (z + PAD) * PS + (x + PAD);   // (local section coordinates)
function columns(g, cx, cz, rd) {
  const cols = new Map();
  for (let dz = -rd; dz <= rd; dz++) for (let dx = -rd; dx <= rd; dx++) {
    const c = W.chunk(g, cx + dx, cz + dz);
    if (!c.light) c.light = VR.computeColumnLight(c.blocks, true);
    cols.set((cx + dx) + ',' + (cz + dz), c);
  }
  return cols;
}
function padded(g, cx, cz, sy) {
  const nb = []; for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const c = W.chunk(g, cx + dx, cz + dz); if (!c.light) c.light = VR.computeColumnLight(c.blocks, true); nb.push(c); }
  const blocks = new Uint16Array(PS * PSS), light = new Uint16Array(PS * PSS), grass = new Uint16Array(PSS), foliage = new Uint16Array(PSS), water = new Uint16Array(PSS);
  const y0 = sy * 16 - PAD;
  for (let pz = 0; pz < PS; pz++) {
    const lz = pz - PAD, czi = lz < 0 ? 0 : lz > 15 ? 2 : 1, iz = (lz + 16) & 15;
    for (let px = 0; px < PS; px++) {
      const lx = px - PAD, cxi = lx < 0 ? 0 : lx > 15 ? 2 : 1, ix = (lx + 16) & 15, nn = nb[czi * 3 + cxi], ci = (iz << 4) | ix, ti = pz * PS + px;
      grass[ti] = nn.tints.grass[ci]; foliage[ti] = nn.tints.foliage[ci]; water[ti] = nn.tints.water[ci];
      for (let py = 0; py < PS; py++) { const y = y0 + py, o = py * PSS + pz * PS + px; if (y < 0 || y > 255) { blocks[o] = 0; light[o] = y > 255 ? 0xf000 : 0; continue; } const i = (y << 8) | ci; blocks[o] = nn.blocks[i]; light[o] = nn.light[i]; }
    }
  }
  return { blocks, light, grass, foliage, water, sy, ox: cx * 16, oz: cz * 16 };
}
// a mesh's quads per layer, its vertices' reach out of the section box [0, 16]³ and its empty quads (all four corners
// on one line or one point: drawn for nothing)
const LAYERS = ['opaque', 'cutout', 'trans', 'vx', 'vxFar'];
function meshStats(r) {
  const q = {}; let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity], empty = 0, edge = 0;
  for (const L of LAYERS) {
    const a = r[L]; if (!a || !a.length) { q[L] = 0; continue; }
    q[L] = a.length >> 5;
    for (let qi = 0; qi < a.length; qi += 32) {
      const P = [];
      for (let v = 0; v < 4; v++) {
        const o = qi + v * 8, x = a[o] / 2048 - 4, y = a[o + 1] / 2048 - 4, z = a[o + 2] / 2048 - 4;
        if (a[o] === 0 || a[o] === 65535 || a[o + 1] === 0 || a[o + 1] === 65535 || a[o + 2] === 0 || a[o + 2] === 65535) edge++;
        P.push([x, y, z]);
        if (x < lo[0]) lo[0] = x; if (y < lo[1]) lo[1] = y; if (z < lo[2]) lo[2] = z; if (x > hi[0]) hi[0] = x; if (y > hi[1]) hi[1] = y; if (z > hi[2]) hi[2] = z;
      }
      // the quad's area: |(p2 − p0) × (p3 − p1)| / 2
      const d1 = [P[2][0] - P[0][0], P[2][1] - P[0][1], P[2][2] - P[0][2]], d2 = [P[3][0] - P[1][0], P[3][1] - P[1][1], P[3][2] - P[1][2]];
      const cx = d1[1] * d2[2] - d1[2] * d2[1], cy = d1[2] * d2[0] - d1[0] * d2[2], cz = d1[0] * d2[1] - d1[1] * d2[0];
      if (Math.hypot(cx, cy, cz) / 2 < 1e-6) empty++;
    }
  }
  const reach = Math.max(0, -lo[0], -lo[1], -lo[2], hi[0] - 16, hi[1] - 16, hi[2] - 16);
  return { q, total: LAYERS.reduce((s, L) => s + q[L], 0), lo, hi, reach: isFinite(reach) ? +reach.toFixed(3) : 0, empty, edge };
}

// ---- the families: run(r, sub) → { data, odd: [ {kind, ...} ] }
const FAM = {};

FAM['gen-det'] = function (r, sub) {
  const seed = r.u32(), vgen = r.pick([5, 13, 19, 21, VG_NEW]), cx = r.int(-2000, 2000), cz = r.int(-2000, 2000);
  const g1 = W.gen(seed, vgen), a = fnv(g1.generate(cx, cz).blocks), b = fnv(g1.generate(cx, cz).blocks);
  const g2 = W.gen(seed, vgen), others = [];
  for (let k = 0; k < 5; k++) { const ox = cx + (k < 4 ? r.int(-3, 3) : r.int(-600, 600)), oz = cz + (k < 4 ? r.int(-3, 3) : r.int(-600, 600)); others.push([ox, oz]); g2.generate(ox, oz); }
  const c = fnv(g2.generate(cx, cz).blocks);
  const odd = [];
  if (a !== b) odd.push({ kind: 'repeat-differs', seed, vgen, cx, cz });
  if (a !== c) odd.push({ kind: 'order-differs', seed, vgen, cx, cz, others });
  let fresh = null;
  if (sub % 4 === 0) {   // a fresh process: nothing cached anywhere
    try {
      const js = `const W=require(${JSON.stringify(path.join(__dirname, '../lib/world.js'))});const g=W.gen(${seed},${vgen});const b=g.generate(${cx},${cz}).blocks;let h=2166136261>>>0;for(let i=0;i<b.length;i++){h^=b[i];h=Math.imul(h,16777619)>>>0;}process.stdout.write(h.toString(16));`;
      fresh = cp.execFileSync(process.execPath, ['-e', js], { encoding: 'utf8', timeout: 120000 }).trim();
      if (fresh !== a) odd.push({ kind: 'fresh-process-differs', seed, vgen, cx, cz });
    } catch (e) { odd.push({ kind: 'fresh-process-error', msg: String(e.message).slice(0, 200) }); }
  }
  return { data: { seed, vgen, cx, cz, a, b, c, fresh }, odd };
};

FAM['gen-water'] = function (r) {
  const seed = r.u32(), vgen = r.pick([21, VG_NEW, VG_NEW]), cx = r.int(-1500, 1500), cz = r.int(-1500, 1500);
  const g = W.gen(seed, vgen), B = W.chunk(g, cx, cz).blocks;
  const at = (x, y, z) => W.block(g, cx * 16 + x, y, cz * 16 + z);
  let wall = 0, hang = 0, fluids = 0; const where = [], kinds = {};
  for (let y = 1; y < 255; y++) for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
    const s = B[(y << 8) | (z << 4) | x]; if (!s || !(R.T.flags[s] & F.FLUID)) continue;
    fluids++;
    const nm = nameOf(s);
    const side = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => at(x + dx, y, z + dz) === AIR);
    const below = at(x, y - 1, z) === AIR;
    if (side) { wall++; kinds[nm + ':wall'] = (kinds[nm + ':wall'] || 0) + 1; if (where.length < 6) where.push(['wall', cx * 16 + x, y, cz * 16 + z, nm]); }
    if (below) { hang++; kinds[nm + ':hang'] = (kinds[nm + ':hang'] || 0) + 1; if (where.length < 6) where.push(['hang', cx * 16 + x, y, cz * 16 + z, nm]); }
  }
  const odd = (wall || hang) ? [{ kind: 'fluid-walls', seed, vgen, cx, cz, wall, hang, kinds, where, biome: W.biome(g, cx * 16 + 8, cz * 16 + 8) }] : [];
  return { data: { seed, vgen, cx, cz, fluids, wall, hang, biome: W.biome(g, cx * 16 + 8, cz * 16 + 8) }, odd };
};

function landStats(g, cx, cz) {
  const h = new Int16Array(256), types = new Set(); let air = 0;
  const B = W.chunk(g, cx, cz).blocks;
  for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
    let y = 255; while (y > 0 && !(B[(y << 8) | (z << 4) | x] && (R.T.flags[B[(y << 8) | (z << 4) | x]] & (F.SOLID | F.FLUID)))) y--;
    h[(z << 4) | x] = y; if (y === 0) air++;
    for (let yy = 0; yy < 256; yy += 7) types.add(B[(yy << 8) | (z << 4) | x]);
  }
  let rough = 0, flat = 0, n = 0;
  for (let z = 0; z < 16; z++) for (let x = 0; x < 15; x++) { const d = Math.abs(h[(z << 4) | x] - h[(z << 4) | x + 1]); rough += d; if (!d) flat++; n++; }
  let mn = 999, mx = -1, mean = 0; for (const v of h) { mn = Math.min(mn, v); mx = Math.max(mx, v); mean += v / 256; }
  return { min: mn, max: mx, mean: +mean.toFixed(1), rough: +(rough / n).toFixed(3), flat: +(flat / n).toFixed(3), air, types: types.size };
}
FAM['gen-far'] = function (r) {
  const seed = r.u32(), R0 = r.pick([1e3, 1e4, 1e5, 1e6, 4e6, 1.6e7, 3.2e7, 1.28e8, 1e9]), ang = r() * Math.PI * 2;
  const x = Math.round(R0 * Math.cos(ang)), z = Math.round(R0 * Math.sin(ang)), cx = Math.floor(x / 16), cz = Math.floor(z / 16);
  const g = W.gen(seed, VG_NEW), odd = [];
  let far = null, near = null, err = null;
  try { far = landStats(g, cx, cz); } catch (e) { err = String(e && e.message).slice(0, 200); odd.push({ kind: 'far-error', seed, R0, cx, cz, err }); }
  near = landStats(g, r.int(-40, 40), r.int(-40, 40));
  if (far) {
    if (far.air === 256) odd.push({ kind: 'far-no-ground', seed, R0, cx, cz });
    if (R0 >= 1e5 && near.rough > 0.05 && (far.rough > near.rough * 5 || (far.rough < near.rough * 0.1 && far.flat > 0.97))) odd.push({ kind: 'far-roughness', seed, R0, cx, cz, far, near });
  }
  // the surface's precision: surfaceY at x and x + 1 … are neighbouring columns still different numbers far out?
  let sameRun = 0; try { let prev = g.surfaceY(x, z); for (let k = 1; k <= 32; k++) { const v = g.surfaceY(x + k, z); if (v === prev) sameRun++; prev = v; } } catch (e) { /* (counted above) */ }
  return { data: { seed, R0, cx, cz, far, near, err, sameRun }, odd };
};

FAM['gen-corr'] = function (r) {
  const s = r.u32(), n = 240, pts = [];
  for (let i = 0; i < n; i++) pts.push([r.int(-6000, 6000), r.int(-6000, 6000)]);
  const base = W.gen(s, VG_NEW), hb = pts.map(([x, z]) => base.surfaceY(x, z));
  const seeds = { 's+1': (s + 1) >>> 0, 's^1': (s ^ 1) >>> 0, 's+2^31': (s + 2147483648) >>> 0, 's*3': Math.imul(s, 3) >>> 0, 's<<1': (s << 1) >>> 0 };
  const res = {}, odd = [];
  for (const k in seeds) { const g = W.gen(seeds[k], VG_NEW); res[k] = +pearson(hb, pts.map(([x, z]) => g.surfaceY(x, z))).toFixed(3); }
  const maps = { swap: ([x, z]) => [z, x], mirror: ([x, z]) => [-x, -z], 'x+65536': ([x, z]) => [x + 65536, z], 'x+2^20': ([x, z]) => [x + 1048576, z], 'x+4096': ([x, z]) => [x + 4096, z], 'control x+16': ([x, z]) => [x + 16, z] };
  for (const k in maps) res[k] = +pearson(hb, pts.map((p) => { const [x, z] = maps[k](p); return base.surfaceY(x, z); })).toFixed(3);
  for (const k in res) if (k !== 'control x+16' && Math.abs(res[k]) > 0.35) odd.push({ kind: 'alike', pair: k, r: res[k], seed: s });
  if (res['control x+16'] < 0.3) odd.push({ kind: 'control-weak', r: res['control x+16'], seed: s });
  return { data: { seed: s, r: res }, odd };
};

let STATES = null;
const allStates = () => STATES || (STATES = Array.from({ length: R.stateCount - 1 }, (_, i) => i + 1).filter((s) => R.T.type[s] !== undefined && R.types[R.T.type[s]]));
function randomFlags(r) {
  return { fancyLeaves: r() < 0.3 ? r.pick([true, false]) : r.int(0, 127), smooth: r() < 0.7, vxLod: r() < 0.7, lod: r() < 0.2 ? 1 : 0, smoothProps: r() < 0.2 ? r.pick([true, 0, 1, 2, 3, 7]) : 0 };
}
FAM['mesh-fuzz'] = function (r) {
  const S = allStates(), pal = Array.from({ length: r.int(1, 8) }, () => r.pick(S));
  const pat = r.pick(['noise', 'checker', 'stripes', 'layers', 'sphere', 'single', 'full', 'shell', 'pillars']);
  const p = r.range(0.05, 0.95), blocks = new Uint16Array(PS * PSS), light = new Uint16Array(PS * PSS), tint = new Uint16Array(PSS).fill(0xffff);
  const lightMode = r.pick(['full', 'dark', 'random', 'sky']);
  for (let y = 0; y < PS; y++) for (let z = 0; z < PS; z++) for (let x = 0; x < PS; x++) {
    const o = y * PSS + z * PS + x, X = x - PAD, Y = y - PAD, Z = z - PAD;
    let on = false;
    if (pat === 'noise') on = r() < p; else if (pat === 'checker') on = ((X + Y + Z) & 1) === 0; else if (pat === 'stripes') on = (X & 1) === 0;
    else if (pat === 'layers') on = (Y & 3) === 0; else if (pat === 'sphere') on = Math.hypot(X - 7.5, Y - 7.5, Z - 7.5) < 6; else if (pat === 'single') on = X === 8 && Y === 8 && Z === 8;
    else if (pat === 'full') on = true; else if (pat === 'shell') on = Math.abs(Math.hypot(X - 7.5, Y - 7.5, Z - 7.5) - 6) < 0.9; else on = (X % 4 === 0 && Z % 4 === 0);
    blocks[o] = on ? r.pick(pal) : 0;
    light[o] = lightMode === 'full' ? 0xffff : lightMode === 'dark' ? 0 : lightMode === 'sky' ? 0xf000 : r.int(0, 65535);
  }
  const job = Object.assign({ blocks, light, grass: tint, foliage: tint, water: tint, sy: r.int(0, 15), ox: r.int(-1e5, 1e5) * 16, oz: r.int(-1e5, 1e5) * 16 }, randomFlags(r));
  const odd = []; let st = null, ms = 0;
  try { const t0 = process.hrtime.bigint(); const out = VR.meshSection(job); ms = Number(process.hrtime.bigint() - t0) / 1e6; st = meshStats(out); }
  catch (e) { odd.push({ kind: 'mesh-error', msg: String(e && e.stack).split('\n').slice(0, 3).join(' | '), pal: pal.map(nameOf), pat, flags: randomFlags }); }
  const flags = { fancyLeaves: job.fancyLeaves, smooth: job.smooth, vxLod: job.vxLod, lod: job.lod, smoothProps: job.smoothProps };
  if (st) {
    if (st.empty) odd.push({ kind: 'empty-quads', n: st.empty, of: st.total, pal: pal.map(nameOf), pat, flags });
    if (st.reach > 2) odd.push({ kind: 'far-reach', reach: st.reach, pal: pal.map(nameOf), pat, flags });
    if (st.edge) odd.push({ kind: 'edge-coords', n: st.edge, pal: pal.map(nameOf), pat, flags });
  }
  return { data: { pal: pal.map(nameOf), pat, p: +p.toFixed(2), lightMode, flags, ms: +ms.toFixed(2), st }, odd };
};

let COST_I = 0, COST_ORDER = null;
FAM['mesh-cost'] = function (r) {
  const S = allStates();
  if (!COST_ORDER) { COST_ORDER = S.slice(); for (let i = COST_ORDER.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [COST_ORDER[i], COST_ORDER[j]] = [COST_ORDER[j], COST_ORDER[i]]; } }
  const out = [], odd = [];
  const tint = new Uint16Array(PSS).fill(0xffff);
  for (let k = 0; k < 40 && COST_I < COST_ORDER.length; k++) {
    const s = COST_ORDER[COST_I++], row = { s, name: nameOf(s) };
    for (const heap of [1, 3]) {
      const blocks = new Uint16Array(PS * PSS), light = new Uint16Array(PS * PSS).fill(0xf000);
      for (let y = 0; y < heap; y++) for (let z = 0; z < heap; z++) for (let x = 0; x < heap; x++) blocks[pidx(7 + x, 7 + y, 7 + z)] = s;
      try {
        const t0 = process.hrtime.bigint(), m = VR.meshSection({ blocks, light, grass: tint, foliage: tint, water: tint, sy: 4, ox: 0, oz: 0, fancyLeaves: true, smooth: true, vxLod: true });
        const ms = Number(process.hrtime.bigint() - t0) / 1e6, st = meshStats(m);
        // the reach out of the heap's own cells [7, 7 + heap] (local section coordinates)
        const lo = st.lo, hi = st.hi, cell = Math.max(0, 7 - lo[0], 7 - lo[1], 7 - lo[2], hi[0] - (7 + heap), hi[1] - (7 + heap), hi[2] - (7 + heap));
        row['q' + heap] = st.total; row['layers' + heap] = st.q; row['ms' + heap] = +ms.toFixed(3); row['out' + heap] = isFinite(cell) ? +cell.toFixed(3) : 0; row['empty' + heap] = st.empty;
        if (heap === 1 && st.empty) odd.push({ kind: 'empty-quads', name: row.name, n: st.empty, of: st.total });
        if (heap === 1 && row.out1 > 0.6) odd.push({ kind: 'reaches-out', name: row.name, by: row.out1 });
        if (heap === 1 && st.total > 96) odd.push({ kind: 'heavy-block', name: row.name, quads: st.total });
      } catch (e) { odd.push({ kind: 'mesh-error', name: row.name, msg: String(e && e.message).slice(0, 160) }); }
    }
    out.push(row);
  }
  return { data: { rows: out, done: COST_I, of: COST_ORDER.length }, odd };
};

FAM['light-inv'] = function (r) {
  const seed = r.u32(), g = W.gen(seed, VG_NEW), cx = r.int(-800, 800), cz = r.int(-800, 800);
  const B = Uint16Array.from(W.chunk(g, cx, cz).blocks), H = (B.length / 256) | 0;
  // random light sources and random glass put into air (the flood fill must go round and through them)
  const emitters = allStates().filter((s) => R.T.emit[s]), glassy = allStates().filter((s) => R.T.filter[s] && !(R.T.flags[s] & F.OPAQUE));
  const put = [];
  for (let k = 0; k < r.int(0, 30); k++) {
    const x = r.int(0, 15), z = r.int(0, 15), y = r.int(20, 200), i = (y << 8) | (z << 4) | x;
    if (B[i]) continue;
    const s = r() < 0.7 && emitters.length ? r.pick(emitters) : glassy.length ? r.pick(glassy) : 0; if (!s) continue;
    B[i] = s; put.push([x, y, z, nameOf(s)]);
  }
  const L = VR.computeColumnLight(B, true), odd = [];
  const sky = (v) => v >>> 12, ch = (v, k) => (v >> (8 - k * 4)) & 15;
  let checked = 0, under = 0, over = 0, skyBad = 0; const ex = [];
  const OPQ = (s) => !!s && (R.T.flags[s] & F.OPAQUE) !== 0;
  for (let y = 1; y < H - 1; y++) for (let z = 1; z < 15; z++) for (let x = 1; x < 15; x++) {
    const i = (y << 8) | (z << 4) | x, s = B[i];
    if (s !== AIR) continue;   // (plain air only: no filters, no own light)
    checked++;
    const nbs = [i + 1, i - 1, i + 16, i - 16, i + 256, i - 256];
    for (let k = 0; k < 3; k++) {
      let mx = 0; for (const j of nbs) { if (OPQ(B[j]) && !R.T.emit[B[j]]) continue; mx = Math.max(mx, ch(L[j], k)); }
      const v = ch(L[i], k);
      if (v < mx - 1) { under++; if (ex.length < 5) ex.push(['under', x, y, z, k, v, mx]); }
      if (v > Math.max(0, mx - 1)) { over++; if (ex.length < 5) ex.push(['over', x, y, z, k, v, mx]); }
    }
    // sky: open straight up → 15
    let open = true; for (let yy = y + 1; yy < H; yy++) { const t = B[(yy << 8) | (z << 4) | x]; if (t && (R.T.flags[t] & (F.OPAQUE | F.FLUID | F.LEAVES))) { open = false; break; } }
    if (open && sky(L[i]) !== 15) { skyBad++; if (ex.length < 5) ex.push(['sky', x, y, z, sky(L[i])]); }
  }
  if (under || over || skyBad) odd.push({ kind: 'light-law', seed, cx, cz, under, over, skyBad, ex, put: put.slice(0, 8) });
  return { data: { seed, cx, cz, checked, under, over, skyBad, put: put.length }, odd };
};

FAM['noise'] = function (r) {
  const seed = r.u32(), S = new VR.Simplex(seed), odd = [], rows = [];
  for (const sc of [1, 1e3, 1e5, 1e6, 1e7, 1e8, 1e9, 1e12]) {
    let zero = 0, mx = 0, nan = 0, out = 0, k = 0;
    for (let t = 0; t < 200; t++) {
      const x = (r() * 2 - 1) * sc, z = (r() * 2 - 1) * sc, v = S.n2(x, z), w = S.n2(x + 0.05, z);
      if (!Number.isFinite(v)) nan++; else if (Math.abs(v) > 1.0001) out++;
      const d = Math.abs(w - v); if (d === 0) zero++; mx = Math.max(mx, d); k++;
    }
    rows.push({ sc, zero: zero / k, maxStep: +mx.toFixed(4), nan, out });
    if (nan || out) odd.push({ kind: 'noise-range', sc, nan, out, seed });
  }
  // periods: is n2(x + P, z) the same field? (the permutation table repeats every 256 lattice units)
  const per = {};
  for (const P of [256, 512, 1024, 4096, 65536]) { const a = [], b = []; for (let t = 0; t < 300; t++) { const x = r.range(-5000, 5000), z = r.range(-5000, 5000); a.push(S.n2(x, z)); b.push(S.n2(x + P, z)); } per[P] = +pearson(a, b).toFixed(3); if (Math.abs(per[P]) > 0.5) odd.push({ kind: 'noise-period', P, r: per[P], seed }); }
  // the far precision: the first scale where a 0.05 step is lost in more than half the samples
  const lost = rows.find((x) => x.zero > 0.5);
  if (lost && lost.sc <= 1e7) odd.push({ kind: 'noise-precision', at: lost.sc, seed });
  return { data: { seed, rows, per }, odd };
};

const HZ = (() => { try { return require('../tools/horizon.js'); } catch (e) { return null; } })();
FAM['view'] = function (r) {
  const seed = r.u32(), vgen = VG_NEW, g = W.gen(seed, vgen), kind = r.pick(['ground', 'ground', 'place', 'hill', 'flying', 'sea']), RD = +A.rd || 6;
  let px = r.int(-3000, 3000), pz = r.int(-3000, 3000);
  if (kind === 'place') { const s = W.sitesNear(g, px, pz, 1500)[0]; if (s) { px = s.x + r.int(-12, 12); pz = s.z + r.int(-12, 12); } }
  if (kind === 'hill') { let best = -1, bx = px, bz = pz; for (let k = 0; k < 40; k++) { const x = px + r.int(-300, 300), z = pz + r.int(-300, 300), h = g.surfaceY(x, z); if (h > best) { best = h; bx = x; bz = z; } } px = bx; pz = bz; }
  if (kind === 'sea') { for (let k = 0; k < 60; k++) { const x = px + r.int(-800, 800), z = pz + r.int(-800, 800); if (W.top(g, x, z).s && (R.T.flags[W.top(g, x, z).s] & F.FLUID)) { px = x; pz = z; break; } } }
  const top = W.top(g, px, pz).y, py = top + 1.62 + (kind === 'flying' ? r.int(20, 80) : 0);
  const pcx = Math.floor(px) >> 4, pcz = Math.floor(pz) >> 4;
  const secs = [], typeFaces = new Map(); let reachMax = 0;
  for (let dz = -RD; dz <= RD; dz++) for (let dx = -RD; dx <= RD; dx++) {
    if (dx * dx + dz * dz > (RD + 0.5) * (RD + 0.5)) continue;
    const cx = pcx + dx, cz = pcz + dz, B = W.chunk(g, cx, cz).blocks;
    for (let sy = 0; sy < 16; sy++) {
      let any = false; const base = sy << 12; for (let i = 0; i < 4096; i++) if (B[base + i]) { any = true; break; }
      if (!any) continue;
      const m = VR.meshSection(Object.assign(padded(g, cx, cz, sy), { fancyLeaves: true, smooth: true, vxLod: true }));
      const st = meshStats(m); reachMax = Math.max(reachMax, st.reach);
      secs.push({ cx, sy, cz, q: st.total, qo: st.q.opaque, qc: st.q.cutout, qt: st.q.trans, reach: st.reach });
    }
    // the faces toward air per block kind (who fills the picture)
    for (let i = 0; i < B.length; i++) {
      const s = B[i]; if (!s) continue;
      const y = i >> 8, z = (i >> 4) & 15, x = i & 15;
      let f = 0;
      if (y < 255 && !B[i + 256]) f++; if (y > 0 && !B[i - 256]) f++;
      if (x < 15 && !B[i + 1]) f++; if (x > 0 && !B[i - 1]) f++; if (z < 15 && !B[i + 16]) f++; if (z > 0 && !B[i - 16]) f++;
      if (f) { const nm = nameOf(s); typeFaces.set(nm, (typeFaces.get(nm) || 0) + f); }
    }
  }
  // the heavy tail: the share of all quads in the heaviest 3 % and 10 % of the sections; the Gini coefficient
  const qs = secs.map((s) => s.q).sort((a, b) => b - a), tot = qs.reduce((a, b) => a + b, 0);
  const shareTop = (p) => { const k = Math.max(1, Math.round(qs.length * p)); return tot ? +(qs.slice(0, k).reduce((a, b) => a + b, 0) / tot).toFixed(3) : 0; };
  let gini = 0; { const asc = qs.slice().reverse(); let cum = 0; for (let i = 0; i < asc.length; i++) { cum += asc[i]; gini += cum; } gini = tot ? +(1 - 2 * gini / (asc.length * tot) + 1 / asc.length).toFixed(3) : 0; }
  // hidden behind hills (the prototype's sections → our real quads)
  let hidQ = 0, hidS = 0;
  if (HZ) {
    const hz = HZ({ g, cam: [px, py, pz], rd: RD, bins: 2048 }), hid = new Set(hz.sections.filter((s) => s.hidden).map((s) => s.cx + ',' + s.sy + ',' + s.cz));
    for (const s of secs) if (hid.has(s.cx + ',' + s.sy + ',' + s.cz)) { hidQ += s.q; hidS++; }
  }
  const topTypes = [...typeFaces.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  const allF = [...typeFaces.values()].reduce((a, b) => a + b, 0);
  const odd = [];
  if (shareTop(0.03) > 0.25) odd.push({ kind: 'heavy-tail', top3: shareTop(0.03), seed, at: [px, py, pz], view: kind });
  if (reachMax > 2) odd.push({ kind: 'mesh-reach', reach: reachMax, seed, at: [px, py, pz] });
  return { data: { seed, view: kind, at: [Math.round(px), +py.toFixed(1), Math.round(pz)], sections: secs.length, quads: tot, top3: shareTop(0.03), top10: shareTop(0.1), gini, hiddenQuadShare: tot ? +(hidQ / tot).toFixed(3) : 0, hiddenSections: hidS, reachMax, topTypes: topTypes.map(([n, f]) => [n, +(f / allF).toFixed(3)]), maxQ: qs[0] || 0 }, odd };
};

// ---- the run
function main() {
  const fams = (A.fam ? String(A.fam).split(',') : Object.keys(FAM)).filter((f) => FAM[f]);
  fs.mkdirSync(OUT, { recursive: true });
  if (A.replay) { const [f, sub] = String(A.replay).split(':'); const r = rng((RUN_SEED ^ Math.imul(+sub + 1, 0x9E3779B1)) >>> 0); console.log(JSON.stringify(FAM[f](r, +sub), null, 1)); return; }
  for (const f of fams) {
    const file = path.join(OUT, f + '.jsonl'), sumOdd = {}; let n = 0, ms = 0;
    const fd = fs.openSync(file, 'a');
    const n0 = +A.from || 0;
    for (let sub = n0; sub < n0 + N; sub++) {
      const r = rng((RUN_SEED ^ Math.imul(sub + 1, 0x9E3779B1)) >>> 0), t0 = Date.now();
      let res;
      try { res = FAM[f](r, sub); } catch (e) { res = { data: null, odd: [{ kind: 'probe-crash', msg: String(e && e.stack).split('\n').slice(0, 4).join(' | ') }] }; }
      const dt = Date.now() - t0; ms += dt; n++;
      fs.writeSync(fd, JSON.stringify({ fam: f, run: RUN_SEED, sub, ms: dt, data: res.data, odd: res.odd }) + '\n');
      for (const o of res.odd) sumOdd[o.kind] = (sumOdd[o.kind] || 0) + 1;
      if (f === 'mesh-cost' && res.data && res.data.done >= res.data.of) break;
    }
    fs.closeSync(fd);
    console.log(`${f}: ${n} probes, ${(ms / 1000).toFixed(1)} s, odd: ${JSON.stringify(sumOdd)}`);
  }
}
main();
