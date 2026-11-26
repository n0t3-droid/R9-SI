// t-trees2 · vgen 18 (the owner, 21 Nov 2026: the trees did not look good; palms on the beaches): every tree a new design
// grown from VR.Flora's grammars, palms along the beaches — and the older worlds untouched.
//   a  vgen 13 and 17 chunks of seed 53 hash as before (the new trees only in a writer flagged t18)
//   b  a t18 writer: oak, birch, fancy oak, spruce, pine, dark oak, jungle, acacia grow the new species (their cells are
//      FL.grow's), the old builders stay for an unflagged writer
//   c  the spruce is a cone: its leaves' radius falls from the foot of the crown to the top
//   d  a vgen-18 world grows palms on a beach (a beach of seed 53 found by its climate), a vgen-17 world none there
//   e  new worlds are vgen 18 or later (v0.55.94: 19, the grey strata)
const V = require('./load_shared.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const R = V.R, GEN = V.GEN, FL = V.Flora;
const fnv = (h, a) => { for (let i = 0; i < a.length; i++) { h ^= a[i]; h = Math.imul(h, 16777619) >>> 0; } return h; };
// a
const EXPECT = { 13: 'f6999c95', 17: '20df6757' };
for (const vg of [13, 17]) {
  const g = V.makeGen('overworld', 53, { vgen: vg }); let h = 2166136261;
  for (const [cx, cz] of [[0, 0], [5, 3], [-8, 4], [12, -10], [20, 6], [-15, -15], [30, 30], [-25, 18]]) h = fnv(h, g.generate(cx, cz).blocks);
  check(h.toString(16) === EXPECT[vg], 'a  vgen ' + vg + ' unchanged (' + h.toString(16) + ')');
}
// b
const mk = (t18) => { const m = new Map(); return { t18, m, get: (x, y, z) => (m.get(x + ',' + y + ',' + z) || 0), set: (x, y, z, s) => m.set(x + ',' + y + ',' + z, s), place: (x, y, z, s) => m.set(x + ',' + y + ',' + z, s), ok: () => true }; };
const nameOf = (s) => R.types[R.T.type[s]].name;
const CASES = [['oak', 'kronenbaum'], ['birch', 'haengebirke'], ['fancyOak', 'grosskrone'], ['spruce', 'tannenspitz'], ['darkOak', 'dunkelkrone'], ['jungle', 'urwaldbaum'], ['megaJungle', 'urwaldriese'], ['acacia', 'schirmakazie']];
let okB = 0;
for (const [fn, sp] of CASES) {
  const w = mk(true), w0 = mk(false);
  GEN.TREES[fn](w, 0, 70, 0, new V.RNG(99)); GEN.TREES[fn](w0, 0, 70, 0, new V.RNG(99));
  const seed = (new V.RNG(99).next() * 4294967296) >>> 0, p = FL.grow(sp, seed);
  const leaves = [...w.m.values()].filter(s => R.T.flags[s] & V.F.LEAVES).length, cells = p.list.filter(c => c[3] !== 1).length;
  const differs = w.m.size !== w0.m.size || [...w.m.keys()].some(k => !w0.m.has(k));
  if (differs && Math.abs(leaves - cells) <= cells * 0.05 + 2) okB++; else console.log('     ' + fn + ' → ' + sp + ': leaves ' + leaves + ' / cells ' + cells + ', differs ' + differs);
}
check(okB === CASES.length, 'b  the eight builders grow the new species in a t18 writer, the old ones without (' + okB + '/' + CASES.length + ')');
{ const w = mk(true); GEN.TREES.spruce(w, 0, 70, 0, new V.RNG(5), { pine: true }); const logs = [...w.m.values()].filter(s => /spruce_log/.test(nameOf(s))).length; check(logs >= 8, 'b  the pine on its long stem (' + logs + ' logs)'); }
// c
{ const p = FL.grow('tannenspitz', 77), byY = new Map();
  for (const c of p.list) if (c[3] === 3) { const r = Math.hypot(c[0], c[2]); byY.set(c[1], Math.max(byY.get(c[1]) || 0, r)); }
  const ys = [...byY.keys()].sort((a, b) => a - b), lo = byY.get(ys[1]), mid = byY.get(ys[Math.floor(ys.length / 2)]), hi = byY.get(ys[ys.length - 3]);
  check(lo > mid && mid > hi && lo >= 3, 'c  the spruce narrows to its top: radius ' + [lo, mid, hi].map(v => v.toFixed(1)).join(' → ')); }
// d
{
  const g18 = V.makeGen('overworld', 53, { vgen: 18 }), g17 = V.makeGen('overworld', 53, { vgen: 17 }), BEACH = V.BIOMES.findIndex(b => b.key === 'beach');
  let found = null;
  for (let r = 4; r < 120 && !found; r += 4) for (let a = 0; a < 24 && !found; a++) {
    const x = Math.round(Math.cos(a / 24 * 6.283) * r * 16), z = Math.round(Math.sin(a / 24 * 6.283) * r * 16), y = g18.surfaceY(x, z);
    if (y >= 64 && y <= 68 && g18.biomeFor(g18.climateAt(x, z), y) === BEACH) found = [x >> 4, z >> 4];
  }
  let p18 = 0, p17 = 0;
  if (found) for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
    const b18 = g18.generate(found[0] + dx, found[1] + dz).blocks, b17 = g17.generate(found[0] + dx, found[1] + dz).blocks;
    for (let i = 0; i < b18.length; i++) { if (b18[i] && nameOf(b18[i]) === 'vx_palm_crown') p18++; if (b17[i] && nameOf(b17[i]) === 'vx_palm_crown') p17++; }
  }
  check(found && p18 >= 2 && p17 === 0, 'd  palms on the beach near chunk ' + JSON.stringify(found) + ': vgen 18 ' + p18 + ', vgen 17 ' + p17);
}
// e
const gs = require('fs').readFileSync(__dirname + '/../src/main/game.js', 'utf8');
check(/vgen: o\.vgen \? \+o\.vgen : (18|19|20|21)/.test(gs), 'e  new worlds are vgen 18 or later (19 since v0.55.94)');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
