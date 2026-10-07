// The painted-piece cache of the mini-voxel painter (voxarch.js) is bounded and keeps what is in use: it holds at
// most two generations of CAP pieces (a piece is ~5 KB of quads — 40 000 of them were 200 MB in every worker, and
// the old cache forgot them all at once), and a piece met again after the rollover is found in the old generation
// and carried into the new one instead of being painted again.
//   bash test/wt_run.sh vx_cache.js
const V = require('./load_shared.js');
const VX = V.VX, R = V.R;
let fail = 0;
const check = (ok, what) => { console.log((ok ? 'OK   ' : 'FAIL ') + what); if (!ok) fail++; };
// a padded section with one VX block in the middle, meshed straight through VX.meshBlock with varying world positions
// and light (the piece's cache key takes both in): every combination is a piece of its own
const PAD = V.MESH_PAD, PS = V.MESH_PS, PSS = PS * PS;
const B = new Uint16Array(PS * PS * PS), L = new Uint16Array(PS * PS * PS);
const DOFF = [1, -1, PSS, -PSS, PS, -PS];
const bi = (8 + PAD) * PSS + (8 + PAD) * PS + (8 + PAD);
const states = [];
for (const t of R.types) if (t.o && t.o.vx && !t.o.vx.lazy && (t.o.vx.kind === 'fence' || t.o.vx.kind === 'lamppost' || t.o.vx.kind === 'barrel' || t.o.vx.kind === 'chair' || t.o.vx.kind === 'table')) states.push(t.defaultState);
check(states.length >= 4, `${states.length} VX block types to paint`);
class Buf { constructor() { this.n = 0; } ensure() {} v() { this.n++; } }
const mk = () => ({ B, L, bufs: [new Buf(), new Buf(), new Buf()], far: null, detail: true, DOFF, layerTile: 1, layerGloss: 2, layerGlass: 3, layerHolo: 4, layerSmooth: 5, layerSmoothGloss: 6, layerMat: [0, 7, 8, 9, 10, 11, 12, 13], ox: 0, oy: 0, oz: 0 });
VX.clearCache(); VX.stats.hits = 0; VX.stats.miss = 0;
const st0 = VX.cacheStats();
check(st0.cur === 0 && st0.old === 0 && st0.cap > 0 && st0.cap <= 16000, `the cache starts empty, capped at ${st0.cap} pieces a generation`);
const CAP = st0.cap;
// paint CAP + CAP/2 distinct pieces: positions × light levels × states
const M = mk();
let painted = 0, i = 0;
// piece k: a block type, which of its six sides are in the open (light ≥ 14), its position parity and a world
// position (the painter's little position hash) — one distinct cache key each
const NS = states.length;
const paintOne = (k) => {
  const s = states[k % NS], e = Math.floor(k / NS) % 64, p = Math.floor(k / (NS * 64)) % 8, j = Math.floor(k / (NS * 512)) % 64;
  B[bi] = s;
  M.ox = (p & 1) + 2 * j; M.oy = (p >> 1) & 1; M.oz = ((p >> 2) & 1) + 16 * j;
  L[bi] = 0xf000; for (let d = 0; d < 6; d++) L[bi + DOFF[d]] = ((e >> d) & 1 ? 15 : 10) << 12;
  VX.meshBlock(M, 8, 8, 8, bi, s);
};
const firstN = Math.floor(CAP * 1.8);
for (i = 0; i < firstN; i++) paintOne(i);
painted = VX.stats.miss;
const st1 = VX.cacheStats();
check(painted > CAP, `${painted} distinct pieces painted (more than one generation)`);
check(st1.cur + st1.old <= 2 * CAP && st1.cur <= CAP, `the cache holds ${st1.cur} + ${st1.old} pieces — never more than two generations`);
check(st1.old === CAP, `the first generation (${st1.old} pieces) was set aside whole, not thrown away`);
// the pieces painted just before the rollover are still there: meeting them again costs no paint
const missBefore = VX.stats.miss;
for (let k = CAP - 200; k < CAP; k++) paintOne(k);
check(VX.stats.miss === missBefore, 'pieces from just before the rollover are found in the old generation, not painted again');
const st2 = VX.cacheStats();
check(st2.cur === st1.cur + 200, 'and carried into the current generation');
// memory stays bounded however long the painting goes on
for (let k = firstN; k < firstN + CAP * 2; k++) paintOne(k);
const st3 = VX.cacheStats();
check(st3.cur + st3.old <= 2 * CAP, `after ${firstN + CAP * 2} pieces the cache still holds at most ${2 * CAP} (${st3.cur} + ${st3.old})`);
VX.clearCache();
const st4 = VX.cacheStats();
check(st4.cur === 0 && st4.old === 0, 'clearCache empties both generations (a look switch repaints everything)');
console.log(fail ? `FAILED ${fail}` : 'ALL OK');
process.exit(fail ? 1 : 0);
