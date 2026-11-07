// r-wunder · VR.Wunder — the Wundertiere's rules (plan docs/superpowers/plans/2026-11-07-r-wunder.md). Pure rules
// (src/shared/wunder.js): the Himmelswal's schedule and route (deterministic from the seed and the world clock), its song
// and the flute's answer window; the Wanderbaum never walks near a player or into a village and leaves its ring of
// blossoms; the Laternenhirsch's appear / lead / vanish rules; the event clock (once per 2 game days); the names; the
// Chronik's texts; the language keys.
//   bash test/wt_run.sh wunder.js 300
require('./load_shared.js');
require('../src/main/i18n.js');
require('../src/main/lang_en.js');
require('../src/main/lang_de.js');
const WU = VR.Wunder, C = VR.Chronik, N = VR.Names;
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
check(!!(WU && WU.whaleAt && WU.whaleRoute && WU.answered && WU.treeStep && WU.deerStep), 'VR.Wunder is there');
if (!WU) { console.log('FAILED 1'); process.exit(1); }

// ---------------------------------------------------------------- the event clock
{
  const st = {};
  check(WU.canEvent(st, 'whale', 3), 'a first event is allowed');
  WU.markEvent(st, 'whale', 3);
  check(!WU.canEvent(st, 'whale', 3) && !WU.canEvent(st, 'whale', 4), 'not again the same day or the next');
  check(WU.canEvent(st, 'whale', 5), 'again two game days later');
  check(WU.canEvent(st, 'tree', 4), 'each creature its own clock');
}

// ---------------------------------------------------------------- the Himmelswal
const isles = VR.IslesGen && VR.IslesGen.list ? VR.IslesGen.list({ seed: 12345 }) : null;
check(Array.isArray(isles) && isles.length >= 5, 'the Sky Isles are listed (' + (isles ? isles.length : 0) + ')');
{
  const seed = 777;
  const L1 = WU.whaleRoute(seed, isles), L2 = WU.whaleRoute(seed, isles);
  check(L1.L > 400 && JSON.stringify(L1.pts) === JSON.stringify(L2.pts), 'the route: a closed loop of arcs, the same for the same seed (' + Math.round(L1.L) + ' m)');
  // over every dome, clear of the islands' trees: never below an isle's top + 18 within its radius
  let low = 0;
  for (let s = 0; s < L1.L; s += 3) { const o = WU.routeAt(L1, s, [0, 0, 0, 0, 0, 0]); for (const I of isles) if (Math.hypot(o[0] - I.x, o[2] - I.z) < I.r * 1.3 && o[1] < I.y + 18) low++; }
  check(low === 0, 'the route stays over the isles\' crowns (' + low + ' low samples)');
  // every isle visited: the route passes within 30 m of each centre (in plan)
  const near = isles.map(I => { let b = 1e9; for (let s = 0; s < L1.L; s += 2) { const o = WU.routeAt(L1, s, [0, 0, 0, 0, 0, 0]); b = Math.min(b, Math.hypot(o[0] - I.x, o[2] - I.z)); } return b; });
  check(near.every(d => d < 30), 'it migrates from isle to isle (nearest pass ' + near.map(d => Math.round(d)).join(' ') + ' m)');
  // visits: every other evening, the same for every guest
  const v = []; for (let d = 0; d < 10; d++) v.push(WU.whaleVisit(seed, d) ? 1 : 0);
  check(v.join('') === '1010101010' || v.join('') === '0101010101', 'it comes every other evening (' + v.join('') + ')');
  const d0 = v[0] ? 0 : 1;
  const a = WU.whaleAt(seed, L1, d0 * 24000 + 11000, new Float32Array(10)), b = WU.whaleAt(seed, L1, d0 * 24000 + 11000, new Float32Array(10));
  check(a[7] === 1 && Array.from(a).join() === Array.from(b).join(), 'where it is is a pure function of the clock (on: ' + a[7] + ')');
  const off = WU.whaleAt(seed, L1, d0 * 24000 + 4000, new Float32Array(10)), off2 = WU.whaleAt(seed, L1, (d0 + 1) * 24000 + 11000, new Float32Array(10));
  check(off[7] === 0 && off2[7] === 0, 'away in the morning and on the evening between');
  // it moves slowly: ≤ 6 m/s; it is big (34 m)
  const p1 = WU.whaleAt(seed, L1, d0 * 24000 + 11000, new Float32Array(10)), p2 = WU.whaleAt(seed, L1, d0 * 24000 + 11020, new Float32Array(10));
  const sp = Math.hypot(p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]);
  check(sp > 2 && sp < 6, 'it glides slowly (' + sp.toFixed(2) + ' m/s)');
  check(WU.WHALE.len >= 30 && WU.WHALE.len <= 40, 'it is 30–40 m long (' + WU.WHALE.len + ')');
  // it comes in from the far sky: at the visit's first tick far from the isles, a minute later over them
  const C0 = WU.isleCentre(isles), e0 = WU.whaleAt(seed, L1, d0 * 24000 + WU.WHALE.from + 1, new Float32Array(10)), e1 = WU.whaleAt(seed, L1, d0 * 24000 + WU.WHALE.from + 2400, new Float32Array(10));
  check(Math.hypot(e0[0] - C0[0], e0[2] - C0[1]) > 400 && Math.hypot(e1[0] - C0[0], e1[2] - C0[1]) < 260, 'it arrives from the far sky (' + Math.round(Math.hypot(e0[0] - C0[0], e0[2] - C0[1])) + ' → ' + Math.round(Math.hypot(e1[0] - C0[0], e1[2] - C0[1])) + ' m)');
  // the song: at dusk only, every 45 s, 6 s long
  const sDay = WU.songAt(seed, d0 * 24000 + 7000), sDusk = WU.songAt(seed, d0 * 24000 + WU.WHALE.songFrom + 20);
  check(!sDay && sDusk && sDusk.sing, 'it sings at dusk, not by day');
  const sGap = WU.songAt(seed, d0 * 24000 + WU.WHALE.songFrom + WU.WHALE.songLen * 20 + 40);
  check(sGap && !sGap.sing && sGap.end === sDusk.end, 'between songs: the last song\'s end is known (the answer window)');
  check(!WU.songAt(seed, (d0 + 1) * 24000 + WU.WHALE.songFrom + 20), 'no song on the evening it is away');
  // the flute's answer: the motif 1·3·2 within the window after the song
  const E = sDusk.end, M = WU.MOTIF;
  check(M.join('') === '132', 'the motif: the Heimat call (root, up a sixth, a step back) = keys 1·3·2');
  const P = (ks, t0, dt) => ks.map((k, i) => ({ k, T: t0 + i * dt }));
  check(WU.answered(P([1, 3, 2], E + 40, 16), E), 'answered right after the song');
  check(WU.answered(P([2, 2, 1, 3, 2], E + 40, 16), E), 'wrong notes first do no harm (no fail state)');
  check(!WU.answered(P([1, 2, 3], E + 40, 16), E), 'another order is not the answer');
  check(!WU.answered(P([1, 3, 2], E + WU.WHALE.window * 20 + 20, 16), E), 'too late: the window has closed');
  check(!WU.answered(P([1, 3, 2], E - 400, 16), E), 'played before the song ended does not count');
  check(WU.hears(170 - 1) && !WU.hears(171), 'hearing distance 170 m');
}

// ---------------------------------------------------------------- the Wanderbaum
{
  const T = WU.TREE;
  check(!WU.isNight(6000) && WU.isNight(17000) && !WU.isNight(23500), 'the night window');
  const ok = () => true;
  const tgt = WU.treeTarget(9, 4, [100, 100], ok);
  const tgt2 = WU.treeTarget(9, 4, [100, 100], ok);
  const d = tgt ? Math.hypot(tgt[0] - 100, tgt[1] - 100) : 0;
  check(tgt && tgt[0] === tgt2[0] && tgt[1] === tgt2[1] && d >= 25 && d <= 45, 'tomorrow\'s place: 25–45 m away, deterministic (' + d.toFixed(1) + ' m)');
  check(WU.treeTarget(9, 4, [100, 100], () => false) === null, 'no good ground: it stays');
  // a night's walk: speed 3–6 m per real minute
  const tr = { x: 0, z: 0, tx: 40, tz: 0, walking: false, stood: true };
  const ev = [];
  for (let i = 0; i < 600; i++) { const e = WU.treeStep(tr, 1, { night: true, players: [], vils: [] }); if (e) ev.push(e); }
  check(tr.x > 30 && tr.x < 60.1, 'it walks 3–6 m a minute (' + (tr.x / 10).toFixed(2) + ' m/min)');
  check(ev.length && ev[0].k === 'ring' && ev[0].x === 0 && ev[0].z === 0, 'leaving its place, a ring of blossoms is left where it stood');
  check(ev.filter(e => e.k === 'ring').length === 1, 'one ring per place');
  // never while a player is within 12 m
  const t2 = { x: 0, z: 0, tx: 40, tz: 0, walking: false, stood: true };
  for (let i = 0; i < 120; i++) WU.treeStep(t2, 1, { night: true, players: [[5, 5]], vils: [] });
  check(t2.x === 0 && t2.z === 0, 'it does not move while a wanderer is within 12 m');
  const t3 = { x: 0, z: 0, tx: 40, tz: 0, walking: false, stood: true };
  let close = 0;
  for (let i = 0; i < 600; i++) { const pl = [[20, 3]]; WU.treeStep(t3, 1, { night: true, players: pl, vils: [] }); if (Math.hypot(t3.x - 20, t3.z - 3) < T.stopR - 0.01 && (t3.walking)) close++; }
  check(close === 0, 'it never walks within 12 m of a standing wanderer (it waits at the edge)');
  // by day it stands
  const t4 = { x: 0, z: 0, tx: 40, tz: 0, walking: false, stood: true };
  for (let i = 0; i < 60; i++) WU.treeStep(t4, 1, { night: false, players: [], vils: [] });
  check(t4.x === 0, 'by day it stands still');
  // never into a village: a village at (30, 0) r 20 → it stops short of r + margin
  const t5 = { x: 0, z: 0, tx: 80, tz: 0, walking: false, stood: true };
  let inV = 0;
  for (let i = 0; i < 1200; i++) { WU.treeStep(t5, 1, { night: true, players: [], vils: [[60, 0, 10]] }); if (Math.hypot(t5.x - 60, t5.z) < 10 + T.vilMargin - 0.01) inV++; }
  check(inV === 0, 'it never walks through a village (stopped at ' + t5.x.toFixed(1) + ')');
  check(WU.inVillage(60, 0, [[60, 0, 10]]) && !WU.inVillage(0, 0, [[60, 0, 10]]), 'inVillage');
  const ring = WU.ringSpots(10, 20, 5);
  const rr = ring.map(q => Math.hypot(q[0] - 10, q[1] - 20));
  check(ring.length >= 12 && rr.every(r => r >= 2.8 && r <= 4.6), 'the ring: ' + ring.length + ' blossoms 3–4.5 m round the place');
  check(WU.seedToday({}, 3) && !WU.seedToday({ seedDay: 3 }, 3) && WU.seedToday({ seedDay: 3 }, 4), 'a lantern seed once a day');
}

// ---------------------------------------------------------------- the Laternenhirsch
{
  const D = WU.DEER;
  const base = { night: 0.9, stillFor: 12, vilDist: 300, day: 5, st: {} };
  check(WU.deerMay(base), 'a dark night, standing still, far from villages: it may come');
  check(!WU.deerMay(Object.assign({}, base, { night: 0.2 })), 'not in a light night');
  check(!WU.deerMay(Object.assign({}, base, { stillFor: 8 })), 'not before 10 s of standing still');
  check(!WU.deerMay(Object.assign({}, base, { vilDist: 60 })), 'not near a village');
  check(!WU.deerMay(Object.assign({}, base, { st: { ev: { deer: 4 } } })), 'not twice within 2 game days');
  const spots = [{ id: 'a', x: 100, z: 0 }, { id: 'b', x: 40, z: 30 }, { id: 'c', x: 900, z: 0 }];
  check(WU.deerPick(spots, {}, 0, 0).id === 'b', 'it leads to the nearest wonder spot');
  check(WU.deerPick(spots, { b: 1 }, 0, 0).id === 'a', '… not yet seen');
  check(WU.deerPick(spots, { a: 1, b: 1 }, 0, 0) === null, '… within 650 m');
  const deer = { x: 10, z: 0, tx: 100, tz: 0 };
  let r = null;
  for (let i = 0; i < 40 && !r; i++) r = WU.deerStep(deer, 0.25, { px: deer.x - 10, pz: 0, speed: 2 });
  check(r === null && deer.x > 10, 'it walks ahead of you');
  const dw = { x: 10, z: 0, tx: 100, tz: 0 };
  WU.deerStep(dw, 1, { px: -30, pz: 0, speed: 0 });
  check(dw.x === 10, 'it waits when you fall behind');
  check(WU.deerStep({ x: 10, z: 0, tx: 100, tz: 0 }, 0.1, { px: 0, pz: 0, speed: D.run + 0.5 }) === 'vanish', 'it vanishes if you run');
  check(WU.deerStep({ x: 10, z: 0, tx: 100, tz: 0 }, 0.1, { px: 8, pz: 0, speed: 1 }) === 'vanish', 'it vanishes if you come within 3 m');
  check(WU.deerStep({ x: 97, z: 0, tx: 100, tz: 0 }, 0.1, { px: 88, pz: 0, speed: 1 }) === 'arrive', 'it arrives at the wonder spot');
  const pn = WU.pathName(42, 'de'), pe = WU.pathName(42, 'en');
  check(pn && pe && pn !== pe && !N.blocked(pn) && WU.pathName(42, 'de') === pn, 'the path gets a name (' + pn + ' / ' + pe + ')');
}

// ---------------------------------------------------------------- names, the Chronik, the tables
{
  const nm = ['whale', 'tree', 'deer'].map(k => WU.nameOf(k, 1234));
  check(nm.every(n => n && n.length >= 3 && n.length <= 12 && !N.blocked(n) && !N.reserved(n)), 'each creature its own name (' + nm.join(', ') + ')');
  check(WU.nameOf('whale', 1234) === nm[0] && WU.nameOf('whale', 99) !== undefined, 'names are deterministic');
  check(C && C.DEEDS.w_whale >= 5 && C.DEEDS.w_tree >= 3 && C.DEEDS.w_deer >= 5 && C.DEEDS.w_ride >= 6, 'the Chronik knows the Wundertiere\'s events (with importance)');
  const st = C.create(5, { ox: 0, oz: 0 });
  const e = C.deed(st, 'w_tree', { x: 0, z: 0, who: 'Romgor', pl: 'Mohnwiese' });
  VR.I18N.setLang ? VR.I18N.setLang('de') : (VR.I18N.lang = 'de');
  const tx = C.text(e, st);
  check(/Wanderbaum/.test(tx) && /Mohnwiese/.test(tx), 'a sighting in the Chronik: „' + tx + '"');
  const de = VR.I18N.dict.de, en = VR.I18N.dict.en;
  const miss = WU.KEYS.filter(k => !(k in de) || !(k in en));
  check(WU.KEYS.length > 20 && !miss.length, 'every Wunder key in both tables (' + WU.KEYS.length + (miss.length ? ', missing ' + miss.slice(0, 6).join(' ') : '') + ')');
  const cm = C.KEYS.filter(k => !(k in de) || !(k in en));
  check(!cm.length, 'every Chronik key (with the new deeds) in both tables' + (cm.length ? ': ' + cm.join(' ') : ''));
  check(VR.ITEMS && VR.ITEMS.wunder_flute && VR.ITEMS.lantern_seed && VR.ITEMS.lantern_seed.light > 0, 'the items: the flute and the lantern seed (a small light)');
}

// ---------------------------------------------------------------- the models (VR.WildGPU kinds: no new program)
{
  try { require('../src/main/voxmodels.js'); } catch (e) { /* (the Very Low models need the voxel grid) */ }
  require('../src/main/wildgpu.js'); require('../src/main/wunder_models.js');
  const G = VR.WildGPU, WM = VR.WunderModels;
  const kinds = ['wwhale', 'wtree', 'wroot', 'wdeer', 'wleg'];
  check(kinds.every(k => G.KINDS[k] && G.KINDS[k].make), 'the smooth models are VR.WildGPU kinds (the creatures\' program — nothing new compiled)');
  const v = {}; for (const k of kinds) v[k] = WM.mesh(k);
  check(kinds.every(k => v[k].length % 11 === 0 && v[k].every(Number.isFinite)), 'every vertex finite, the program\'s layout');
  const tris = kinds.reduce((s, k) => s + v[k].length / 33, 0);
  check(tris < 8000, 'small: ' + Math.round(tris) + ' triangles for all three (the whale ' + Math.round(v.wwhale.length / 33) + ')');
  // the whale: nose −z, its fins and flukes beat (weight > 0), its lanterns glow (emission)
  const W = v.wwhale; let zmin = 1, zmax = -1, wing = 0, glow = 0;
  for (let i = 0; i < W.length; i += 11) { zmin = Math.min(zmin, W[i + 2]); zmax = Math.max(zmax, W[i + 2]); if (W[i + 9] > 0.5) wing++; if (W[i + 10] > 0.9) glow++; }
  check(zmin <= -0.49 && zmax >= 0.4 && wing > 100 && glow > 50, 'the whale: length 1 (nose −z), fins and flukes beating, lantern spots (' + wing + ' / ' + glow + ')');
  let ty = 0; for (let i = 0; i < v.wtree.length; i += 11) ty = Math.max(ty, v.wtree[i + 1]);
  check(ty > 0.9 && ty < 1.05, 'the tree: height 1 (×14 m)');
  const vm = VR.VOXMODELS && VR.VOXMODELS.wu_whale ? [VR.VOXMODELS.wu_whale(), VR.VOXMODELS.wu_tree()] : null;
  check(vm && vm.every(d => d.parts && Object.values(d.parts).every(p => p.grid.c.some(c => c))), 'Very Low: voxel models (the whale\'s silhouette, the tree)');
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
