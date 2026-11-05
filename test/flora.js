// v-flora · the blooming flora of vgen 17 (docs/superpowers/plans/2026-11-05-v-flora.md):
//  a · VR.Flora's L-systems are deterministic (a seed → the same string, the same cells), two seeds differ, every
//      species keeps to its height and spread, trees carry wood and blossom, the giant is big;
//  b · the new blocks come after every older block (append-only) and are ordinary blocks (no VM model);
//  c · vgen 16's land chunks are exactly as v042 made them (pinned), vgen 17's are pinned;
//  d · vgen 17 blooms: more flowers in the meadows, blossom trees and shrubs, tall meadow flowers, clover on the ways'
//      edges, the wonder spots (Traumbäume, glow rings) in the plan with their spawns — and none of it at vgen 16.
//   bash test/wt_run.sh flora.js 300   (PIN=1 prints the hashes)
const V = require('./load_shared.js');
const R = V.R, FL = V.Flora;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const fnv = (h, a) => { for (let i = 0; i < a.length; i++) { h ^= a[i]; h = Math.imul(h, 16777619) >>> 0; } return h; };
const nm = (s) => { const t = R.types[R.T.type[s]]; return t ? t.name : ''; };
const PIN16 = '201fbe20', PIN17 = '399789b4';

// ---- a · the L-systems
check(!!FL && typeof FL.expand === 'function', 'VR.Flora is there');
if (FL) {
  const S = FL.SPECIES.wolkenkirsche;
  const a = FL.expand(S.axiom, S.rules, S.n, 7, S.fin), b = FL.expand(S.axiom, S.rules, S.n, 7, S.fin), c = FL.expand(S.axiom, S.rules, S.n, 8, S.fin);
  check(a === b && a.length > 20, `expand is deterministic (${a.length} symbols)`);
  check(a !== c, 'two seeds grow two strings');
  check(FL.expand('A', { A: 'AA' }, 40, 1).length <= 6000, 'a runaway grammar is capped');
  const all = Object.keys(FL.SPECIES);
  check(all.length >= 8, `${all.length} species`);
  for (const name of all) {
    const Sp = FL.SPECIES[name], hs = [], spread = [];
    let woodOk = true, bloomOk = true, same = true;
    for (let seed = 1; seed <= 12; seed++) {
      const p = FL.grow(name, seed * 7919), q = FL.grow(name, seed * 7919);
      if (p !== q) same = false;
      hs.push(p.b.y1 + 1); spread.push(Math.max(-p.b.x0, p.b.x1, -p.b.z0, p.b.z1));
      if (!p.list.some(c => c[3] === 1)) woodOk = false;
      if (!p.list.some(c => c[3] === 2)) bloomOk = false;
    }
    const hmin = Math.min(...hs), hmax = Math.max(...hs), smax = Math.max(...spread);
    const reach = Sp.kind === 'giant' ? 13 : Sp.kind === 'shrub' ? 3 : 7;
    check(same && woodOk && bloomOk && hmin >= Sp.h[0] && hmax <= Sp.h[1] && smax <= reach, `${name}: height ${hmin}–${hmax} (${Sp.h.join('–')}), spread ≤ ${smax} (≤ ${reach}), wood and blossom, cached`);
  }
  // no loose cube: every cell of a plant touches another (the first pictures showed shrubs falling apart into floating cubes)
  let loose = 0, cellsN = 0;
  for (const name of all) for (let seed = 1; seed <= 12; seed++) {
    const p = FL.grow(name, seed * 7919), set = new Set(p.list.map(c => c[0] + ',' + c[1] + ',' + c[2]));
    for (const c of p.list) { cellsN++; if (c[1] === 0) continue; let n = 0; for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) if (set.has((c[0] + dx) + ',' + (c[1] + dy) + ',' + (c[2] + dz))) n++; if (!n) loose++; }
  }
  check(loose <= cellsN * 0.002, `no loose cubes: ${loose} of ${cellsN} cells touch nothing`);
  const g1 = FL.grow('traumbaum', 11);
  check(g1.list.length > 700, `the Traumbaum is a giant (${g1.list.length} cells)`);
  const u = new Set(); for (let s = 1; s <= 8; s++) u.add(FL.grow('wolkenkirsche', s).list.length);
  check(u.size >= 6, `eight seeds of one species, ${u.size} different trees`);
}

// ---- b · the blocks
const NEW = ['bloom_snow_leaves', 'bloom_lilac_leaves', 'bloom_gold_leaves', 'bloom_rose_leaves', 'candle_flower', 'umbel_flower', 'bell_tower_flower', 'glowbell', 'clover'];
const last = R.byName.stn_clamp;
check(!!last, 'the station blocks are there (the block before ours)');
let idsOk = true, kindOk = true;
for (const n of NEW) { const t = R.byName[n]; if (!t || !last || t.base <= last.base) idsOk = false; else if (t.shape === 'vm' || (t.name || '').startsWith('vm_')) kindOk = false; }
check(idsOk, `the ${NEW.length} new blocks come after stn_clamp`);
check(kindOk, 'they are ordinary blocks (leaves and sprites, no voxel model)');
const gb = R.byName.glowbell; check(!!gb && !!R.T.emit[gb.base], 'the glowbell glows');

// ---- c, d · the land
const CH = [[20, -15], [-20, 6], [28, -8], [12, 18], [-16, -4], [24, 2], [18, -36], [-6, -30], [24, -24], [-24, -15], [-27, -3], [33, 3]];
const FLOW = /tulip|poppy|daisy|cornflower|wildflowers|allium|bluet|dandelion|lily_of|petals|candle_flower|umbel_flower|bell_tower|glowbell|clover|lilac|peony/;
function scan(vgen) {
  const g = V.makeGen('overworld', 4242, { vgen });
  let h = 2166136261 >>> 0;
  const o = { flowers: 0, kinds: new Set(), bloom: 0, tall: 0, clover: 0, glow: 0 };
  for (const [cx, cz] of CH) {
    const c = g.generate(cx, cz), b = c.blocks; h = fnv(h, b);
    for (let i = 0; i < b.length; i++) {
      if (!b[i]) continue; const n = nm(b[i]);
      if (FLOW.test(n)) { o.flowers++; o.kinds.add(n); }
      if (/^bloom_|cherry_leaves/.test(n)) o.bloom++;
      if (/candle_flower|umbel_flower|bell_tower/.test(n)) o.tall++;
      if (n === 'clover') o.clover++;
      if (n === 'glowbell') o.glow++;
    }
  }
  return { hash: h.toString(16).padStart(8, '0'), o, g };
}
const t0 = Date.now();
const s16 = scan(16);
console.log(`     vgen 16: hash ${s16.hash}, flowers ${s16.o.flowers} (${s16.o.kinds.size} kinds), blossom leaves ${s16.o.bloom}`);
check(s16.hash === PIN16 || process.env.PIN, `vgen 16's land chunks are as v042 made them (${s16.hash})`);
const s17 = scan(17);
console.log(`     vgen 17: hash ${s17.hash}, flowers ${s17.o.flowers} (${s17.o.kinds.size} kinds), blossom leaves ${s17.o.bloom}, tall ${s17.o.tall}, clover ${s17.o.clover}  · ${Date.now() - t0} ms`);
check(s17.hash === PIN17 || process.env.PIN, `vgen 17's land chunks are as pinned (${s17.hash})`);
check(s17.o.flowers > s16.o.flowers * 2.5, `the meadows bloom (${s17.o.flowers} flowers against ${s16.o.flowers})`);
check(s17.o.bloom > s16.o.bloom + 60, `blossom trees and shrubs in the chunks (${s17.o.bloom} blossom leaves against ${s16.o.bloom})`);
{ // over the whole land: the blossom trees and the shrubs planted (a recorder writer)
  const cnt = {}, orig = FL.plant; FL.plant = function (w, name, ...a) { cnt[name] = (cnt[name] || 0) + 1; return orig.call(this, w, name, ...a); };
  const rec = { get: () => 0, set: () => {}, place: () => {} }, P = V.Land.plan(s17.g);
  V.Land.soloTrees(s17.g, P, rec, -600, -600, 600, 600); V.Land.woodsTrees(s17.g, P, rec, -300, -300, 300, 300); FL.shrubs(s17.g, P, rec, -300, -300, 300, 300);
  FL.plant = orig;
  const trees = FL.TREES.reduce((a, n) => a + (cnt[n] || 0), 0), shr = FL.SHRUBS.reduce((a, n) => a + (cnt[n] || 0), 0);
  check(trees > 150 && FL.TREES.every(n => cnt[n] > 10), `blossom trees over the land: ${trees} (${FL.TREES.map(n => n + ' ' + (cnt[n] || 0)).join(', ')})`);
  check(shr > 150, `flowering shrubs within 300 blocks: ${shr}`);
  const n16 = {}; FL.plant = function (w, name) { n16[name] = 1; }; const P16 = V.Land.plan(s16.g); V.Land.soloTrees(s16.g, P16, rec, -300, -300, 300, 300); V.Land.woodsTrees(s16.g, P16, rec, -200, -200, 200, 200); FL.plant = orig;
  check(!Object.keys(n16).length, 'vgen 16 plants no L-system tree');
}
check(s17.o.tall > 20, `tall meadow flowers (${s17.o.tall})`);
check(s17.o.clover > 10, `clover on the ways' edges (${s17.o.clover})`);
check(s16.o.tall === 0 && s16.o.clover === 0, 'none of the new plants at vgen 16');
const P17 = V.Land.plan(s17.g), P16 = V.Land.plan(s16.g);
const giants = P17.pieces.filter(p => p.kind === 'blossom_giant'), rings = P17.pieces.filter(p => p.kind === 'glow_ring');
check(giants.length >= 3 && rings.length >= 2, `the wonder spots: ${giants.length} Traumbäume, ${rings.length} glow rings`);
check(!P16.pieces.some(p => p.kind === 'blossom_giant' || p.kind === 'glow_ring'), 'no wonder spot at vgen 16');
let spawnOk = giants.length > 0;
for (const p of giants.concat(rings)) { const k = Math.floor(p.x / 16) * 4096 + Math.floor(p.z / 16), sp = P17.spawns.get(k) || []; if (!sp.some(s => s[0] === (p.kind === 'glow_ring' ? 'glowring' : 'petals'))) spawnOk = false; }
check(spawnOk, 'each wonder spot lists its spawn (petals / glowring)');
if (giants.length) {
  const G = giants[0], g = s17.g, c = g.generate(Math.floor(G.x / 16), Math.floor(G.z / 16));
  let wood = 0, bl = 0; for (let i = 0; i < c.blocks.length; i++) { const n = nm(c.blocks[i]); if (n === 'cherry_log') wood++; else if (/^bloom_|cherry_leaves/.test(n)) bl++; }
  check(wood > 20 && bl > 150, `the Traumbaum stands in its chunk (${wood} wood, ${bl} blossom)`);
}
if (rings.length) {
  const G = rings[0], g = s17.g; let glow = 0;
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const c = g.generate(Math.floor(G.x / 16) + dx, Math.floor(G.z / 16) + dz); for (let i = 0; i < c.blocks.length; i++) if (nm(c.blocks[i]) === 'glowbell') glow++; }
  check(glow >= 10, `the glow ring stands (${glow} glowbells)`);
}
// ---- e · the wonder spots' life (landlife.js): the petals follow the season, the ring glows at night only
try { require(__dirname + '/../src/main/landlife.js'); } catch (e) { }
const LL = V.LandLife;
check(!!LL && !!LL.floraFx, 'LandLife.floraFx is there');
if (LL && LL.floraFx) {
  const sp = LL.petalRate([1, 0, 0, 0]), su = LL.petalRate([0, 1, 0, 0]), au = LL.petalRate([0, 0, 1, 0]), wi = LL.petalRate([0, 0, 0, 1]);
  check(sp > su && su > au && au > 0 && wi === 0, `petals: spring ${sp.toFixed(1)} › summer ${su} › autumn ${au.toFixed(1)} › winter ${wi} a second`);
  check(LL.petalRate([0, 1, 0, 0], true) < su, 'Low lets fewer petals go');
  const P = { n: 0, spawn() { this.n++; }, glow() { this.n++; } };
  const M = { kind: 'glowring', x: 0, y: 70, z: 0, k: 5, acc: 0 };
  for (let i = 0; i < 60; i++) LL.floraFx(M, P, 0.1, 100, false, 0, null);
  const day = P.n; for (let i = 0; i < 60; i++) LL.floraFx(M, P, 0.1, 100, false, 1, null);
  check(day === 0 && P.n > 10, `the glow ring: nothing by day, ${P.n} glows in six seconds of night`);
}
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);
