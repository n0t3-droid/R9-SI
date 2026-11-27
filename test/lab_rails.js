// R9-SI Lab · die Bahn bleibt draußen — a lab regression (lab/detect/detectors.js's rail detector found it, 27 Nov 2026):
// the sky rails (gen_rails.js) came down to their stations VG.rad(g) + 8 = 86 blocks from a village's centre, but the
// airy villages reach 100 blocks out and the modern towns 230: the line ramped down through their streets and houses
// (Silbergrund, seed 4242: the viaduct crosses a street at its level, a parapet wall across the asphalt).
//  a · vgen 21's lines are unchanged (their geometry pinned — a world made before keeps every chunk it generated)
//  b · vgen 22: no line runs inside any place (its track keeps out of every village's and town's radius)
//  c · most links stay (≥ 60 % of vgen 21's lines; a few pairs of towns are now too close for a line)
//   bash test/wt_run.sh lab_rails.js 300   (PIN=1 prints vgen 21's hash)
'use strict';
const W = require('../lab/lib/world.js'), D = require('../lab/detect/detectors.js');
let fails = 0;
const check = (ok, msg, info) => { if (!ok) { fails++; console.log('  ✗ ' + msg + (info ? '  — ' + info : '')); } else console.log('  ✓ ' + msg); };
const SEEDS = [3616214791, 1, 12345, 4242], R = 1500;
const PIN21 = '530f1e75';
const fnv = (h, a) => { for (let i = 0; i < a.length; i++) { h ^= a[i] | 0; h = Math.imul(h, 16777619) >>> 0; } return h; };

function lines(seed, vgen) {
  const g = W.gen(seed, vgen), sp = g.findSpawn(), RG = W.VR.RailGen, VG = W.VR.VillageGen;
  const CELL = VG.cell(g), R0 = Math.ceil(R / CELL) + 1, ci = Math.floor(sp[0] / CELL), cj = Math.floor(sp[2] / CELL), seen = new Map();
  for (let dj = -R0; dj <= R0; dj++) for (let di = -R0; di <= R0; di++) {
    const s = VG.site(g, ci + di, cj + dj); if (!s) continue;
    for (const lk of RG.linksOf(g, s)) if (!seen.has(lk.key)) seen.set(lk.key, RG.line(g, lk));
  }
  const keys = [...seen.keys()].sort();
  let h = 2166136261 >>> 0;
  for (const k of keys) { const Ln = seen.get(k); if (!Ln) continue; h = fnv(h, Ln.pts.flat()); h = fnv(h, Ln.Y); }
  return { g, sp, n: keys.filter((k) => seen.get(k)).length, hash: h };
}

console.log('a · vgen 21 unchanged');
let h21 = 2166136261 >>> 0, n21 = 0;
for (const seed of SEEDS) { const L = lines(seed, 21); h21 = fnv(h21, [L.hash]); n21 += L.n; }
if (process.env.PIN) console.log('    PIN', h21.toString(16));
check(h21.toString(16) === PIN21, `the railways of vgen 21 run as before (${n21} lines)`, h21.toString(16));

console.log('b · vgen 22: the railways stay outside the places');
let n22 = 0, inside = 0; const worst = [];
for (const seed of SEEDS) {
  const L = lines(seed, 22); n22 += L.n;
  const r = D.rails(L.g, L.sp[0], L.sp[2], R);
  inside += r.finds.length;
  for (const f of r.finds.sort((a, b) => b.score - a.score).slice(0, 2)) worst.push(seed + ': ' + f.info);
}
check(inside === 0, `no railway runs inside a village or a town (${inside} lines and places)`, worst.slice(0, 4).join(' · '));

console.log('c · the links stay');
check(n22 >= n21 * 0.6, `lines: ${n22} (vgen 21: ${n21})`);

console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);
