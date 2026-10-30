// The boss fight as a cinematic experience (a-boss2; plan docs/superpowers/plans/2026-10-30-a-boss2.md). The pure part
// of src/main/rpg_boss2.js, every rule a check:
//   1. the arena: the same region the same arena; 8 pylons round the Kernfeuer (12–19 m), most broken, cables only between
//      standing neighbours, 10 cracks of zigzag segments inside the ring; Very Low: 4 pylons, 6 cracks, no cables
//   2. the telegraphs: the zone and the timing ring — the ring closes from the zone's edge to the strike (u 0 → 1)
//   3. the searchlight sweeps slowly (≤ 0.6 rad/s) and aims at the player while the bolts are announced
//   4. the heal wave: from 0 to 140 m in 5 s, monotonic; a crack heals once the front has passed it
//   5. the next goal: a ready boss first, then the nearest disturbed outpost, then nothing; the map's icons
//   6. one Funke hint per phase (calm ones in the calm version); the texts in both tables
//   bash test/wt_run.sh boss2.js 300
const fs = require('fs'), path = require('path');
const V = require('./load_shared.js');
const SRC = path.join(__dirname, '../src/');
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
require(SRC + 'shared/rpg.js');
if (!fs.existsSync(SRC + 'main/rpg_boss2.js')) { console.log('  ✗ src/main/rpg_boss2.js missing'); console.log('FAILED 1'); process.exit(1); }
require(SRC + 'main/rpg_boss2.js');
const B2 = V.RPGBoss2, R = V.RPG;
if (!B2) { console.log('  ✗ VR.RPGBoss2 missing'); console.log('FAILED 1'); process.exit(1); }

console.log('1 · the arena');
{
  const a = B2.layout('3_-2'), b = B2.layout('3_-2'), c = B2.layout('4_1');
  check(JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a) !== JSON.stringify(c), 'the same region, the same arena; another region another');
  const d = a.pylons.map(p => Math.hypot(p.x, p.z));
  check(a.pylons.length === 8 && Math.min(...d) >= 12 && Math.max(...d) <= 19, '8 pylons at 12–19 m (' + d.map(v => v.toFixed(1)).join(' ') + ')');
  const broken = a.pylons.filter(p => p.broken).length;
  check(broken >= 4 && broken <= 7, broken + ' of them broken');
  check(a.cables.length >= 2 && a.cables.every(k => !a.pylons[k.a].stump && !a.pylons[k.b].stump && (k.b === (k.a + 1) % 8)), a.cables.length + ' cables, only between standing neighbours');
  check(a.cracks.length === 10 && a.cracks.every(k => k.segs.length >= 3 && k.segs.every(s => Math.hypot(s[2], s[3]) <= 15)), '10 cracks of ≥ 3 segments inside the ring');
  check(a.ped && Math.hypot(a.ped[0], a.ped[1]) >= 3 && Math.hypot(a.ped[0], a.ped[1]) <= 6, 'the pedestal 3–6 m from the obelisk');
  const lo = B2.layout('3_-2', true);
  check(lo.pylons.length === 4 && lo.cracks.length === 6 && lo.cables.length === 0, 'Very Low: 4 pylons, 6 cracks, no cables');
}

console.log('2 · the telegraphs');
{
  const s0 = B2.teleShape('stomp', 0), s1 = B2.teleShape('stomp', 1), sh = B2.teleShape('stomp', 0.5);
  check(s0.kind === 'disc' && s0.r === R.BAL.boss.stompR, 'the stomp: a disc of the stomp radius (' + s0.r + ' m)');
  check(s0.ring > s1.ring && Math.abs(s0.ring - s0.r) < 0.01 && s1.ring <= 0.6 && sh.ring < s0.ring, 'its timing ring closes from the edge to the middle (' + s0.ring + ' → ' + s1.ring + ')');
  check(s1.a > s0.a, 'the zone glows brighter toward the strike');
  const sl = B2.teleShape('slam', 0.3);
  check(sl.kind === 'band' && sl.len === R.BAL.boss.slamR && sl.w >= 3, 'the slam: a band ahead, ' + sl.len + ' m long');
  const fn = B2.teleShape('fan', 0.3);
  check(fn.kind === 'lanes' && fn.n === 3, 'the bolts: three lanes');
}

console.log('3 · the searchlight');
{
  let mx = 0; for (let t = 0; t < 20; t += 0.1) mx = Math.max(mx, Math.abs(B2.beamYaw(t + 0.1) - B2.beamYaw(t)) / 0.1);
  check(mx > 0.05 && mx <= 0.6, 'it sweeps slowly (≤ ' + mx.toFixed(2) + ' rad/s)');
  check(B2.beamPitch(0) < 0 && B2.beamPitch(0) > -0.6, 'it points down onto the land ahead');
}

console.log('4 · the heal wave');
{
  let ok = true, last = -1; for (let t = 0; t <= 6; t += 0.1) { const r = B2.healFront(t); if (r < last) ok = false; last = r; }
  check(ok && B2.healFront(0) <= 1 && B2.healFront(5) >= 140, 'from the arena to 140 m in 5 s (' + B2.healFront(1).toFixed(0) + ' m after 1 s)');
  check(B2.crackHeal(10, -1) === 0 && B2.crackHeal(10, 5) === 0 && B2.crackHeal(10, 30) === 1, 'a crack heals once the front has passed it');
}

console.log('5 · the next goal, the icons');
{
  const st = R.fresh();
  const sites = [{ id: 'a', x: 100, z: 100, free: true, tier: 3 }, { id: 'b', x: 300, z: 200, free: true, tier: 3 }, { id: 'c', x: 600, z: 500, free: false, tier: 3 }, { id: 'd', x: 2000, z: 100, free: false, tier: 4 }, { id: 'e', x: 2200, z: 300, free: false, tier: 4 }];
  let C = R.conquest(sites, st);
  let n = B2.nextGoal(C, sites, [0, 0, 0]);
  check(n && n.kind === 'boss', 'a ready Kernfeuer is the next goal (' + JSON.stringify(n) + ')');
  st.won[C.regions.find(r => r.boss === 'ready').id] = 1; C = R.conquest(sites, st);
  n = B2.nextGoal(C, sites, [0, 0, 0]);
  check(n && n.kind === 'outpost' && n.id === 'c', 'then the nearest disturbed outpost (' + (n && n.id) + ')');
  n = B2.nextGoal(R.conquest([], st), [], [0, 0, 0]);
  check(n === null, 'nothing known: no goal');
  const ic = B2.mapIcons(C, sites, [{ id: 7, x: 50, z: 60, name: 'Au' }]);
  const kinds = {}; for (const i of ic) kinds[i.kind] = (kinds[i.kind] || 0) + 1;
  check(kinds.outpost === 5 && kinds.travel === 2 && kinds.shop === 1 && kinds.boss === 1, 'icons: 5 outposts, 2 fast-travel beacons, a shop, the boss (' + JSON.stringify(kinds) + ')');
}

console.log('6 · Funke and the texts');
{
  const k = [1, 2, 3].map(p => B2.hintKey(p, false)), kc = [1, 2, 3].map(p => B2.hintKey(p, true));
  check(new Set(k).size === 3 && new Set(kc).size === 3 && k.every((x, i) => x !== kc[i]), 'one hint per phase, calm ones apart');
  const de = fs.readFileSync(SRC + 'main/lang_de.js', 'utf8'), en = fs.readFileSync(SRC + 'main/lang_en.js', 'utf8');
  const miss = B2.KEYS.filter(q => de.indexOf('"' + q + '"') < 0 || en.indexOf('"' + q + '"') < 0);
  check(B2.KEYS.length >= 12 && !miss.length, B2.KEYS.length + ' texts in both tables' + (miss.length ? ' — missing ' + miss.join(', ') : ''));
  check(R.BAL.drop.crown && R.BAL.drop.crown[4] > 0 && R.BAL.drop.crown.slice(0, 4).every(v => v === 0), 'the pedestal\'s find is radiant');
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
