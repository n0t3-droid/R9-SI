// Places to free (a-foes; plan docs/superpowers/plans/2026-10-23-a-foes.md, spec
// docs/superpowers/specs/2026-10-22-abenteuer-design.md §6). Every rule a check:
//   1. the capture ring: 12 blocks, 30 · 45 · 60 s by band, leaving pauses it and never resets it, two drone waves
//      (at 25 % and 60 %), done once
//   2. the Lichtleiter: 3×3, 4×4, 5×5 — 300 seeds each, every one solvable by construction (its own rotations light the
//      lamp), never solved at the start, the same seed the same puzzle; turning a tile, a locked hint tile stays put,
//      Geschick 5 and 10 lock one and two right tiles
//   3. the calm ring: one lap in 2 s, the arc 70° + 7° a Geschick point (≤ 140°), a press in the arc calms, outside not
//   4. a site: gestört → bereit (every stray powered down or calmed, mixed) → befreit; the record saved and loaded
//      (garbage sanitised), an old world without sites stays without
//   5. the outposts found in a column's spawns (the pad's ship + the launch beacon at rot(−6, 6), all four turns), a
//      village's pad is no outpost; the Leuchtfeuer's place; the tier by distance
//   6. the Leuchtfeuer block: appended after every other block (the saved ids stay), two states, red-violet and cyan light
//   7. Schnellreise: the other freed beacons, nearest first, never the one you stand at
//   8. the quests: VR.Liberate.quest, an outpost place as the quests know it ('out:' + id)
//   9. the moment: its beats in order — the flicker, cyan, the beam, the ring, the music, the strays stand up, Funke,
//      the banner — about six seconds
//   bash test/wt_run.sh liberate.js 300
const fs = require('fs'), path = require('path');
require('./dom_stub.js');
const V = require('./load_shared.js');
const SRC = path.join(__dirname, '../src/main/');
for (const f of ['i18n', 'lang_en', 'lang_de', 'voxmodels']) require(SRC + f + '.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
for (const f of ['foemodels', 'foes', 'liberate']) {
  if (!fs.existsSync(SRC + f + '.js')) { console.log('  ✗ src/main/' + f + '.js missing'); console.log('FAILED 1'); process.exit(1); }
  require(SRC + f + '.js');
}
const L = V.Liberate, Adv = V.Adv;
if (!L || !L.Ring || !L.puzzle) { console.log('  ✗ VR.Liberate (its pure core) missing'); console.log('FAILED 1'); process.exit(1); }
const rng = (seed) => { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };

// ---------------------------------------------------------------- 1 · the capture ring
console.log('1 · the capture ring');
{
  check(L.RING_R === 12, 'the beacon\'s zone: ' + L.RING_R + ' blocks');
  const timeOf = (band) => { const r = new L.Ring(band); let t = 0; while (!r.done && t < 200) { r.step(0.1, true); t += 0.1; } return Math.round(t); };
  check(timeOf('easy') === 30 && timeOf('normal') === 45 && timeOf('hard') === 60, 'held: Leicht ' + timeOf('easy') + ' s · Normal ' + timeOf('normal') + ' s · Schwer ' + timeOf('hard') + ' s');
  const r = new L.Ring('normal'), ev = [];
  let t = 0;
  for (; t < 10; t += 0.1) ev.push(...r.step(0.1, true).map(e => [e, +t.toFixed(1)]));
  const p10 = r.p;
  for (let i = 0; i < 300; i++) r.step(0.1, false);
  check(Math.abs(r.p - p10) < 1e-9 && r.p > 0.2, 'leaving the zone pauses the ring, 30 s outside never reset it (' + (p10 * 100).toFixed(1) + ' % → ' + (r.p * 100).toFixed(1) + ' %)');
  for (; !r.done && t < 300; t += 0.1) ev.push(...r.step(0.1, true).map(e => [e, +t.toFixed(1)]));
  const waves = ev.filter(e => e[0] === 'wave1' || e[0] === 'wave2');
  check(waves.length === 2 && waves[0][0] === 'wave1' && waves[1][0] === 'wave2', 'two drone waves (' + waves.map(w => w[0] + ' at ' + w[1] + ' s held').join(', ') + ')');
  check(Math.abs(L.WAVES[0] - 0.25) < 1e-9 && Math.abs(L.WAVES[1] - 0.6) < 1e-9, 'at 25 % and 60 % of the ring');
  check(ev.filter(e => e[0] === 'done').length === 1 && r.done && r.step(1, true).length === 0, 'done once, then quiet');
  const r2 = L.Ring.from(JSON.parse(JSON.stringify(r.save())), 'normal');
  check(r2.p === r.p && r2.done === r.done && r2.w1 === r.w1, 'the ring survives a save');
}

// ---------------------------------------------------------------- 2 · the Lichtleiter
console.log('2 · the Lichtleiter');
{
  for (const n of [3, 4, 5]) {
    let solvable = 0, solvedAtStart = 0, paths = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const pz = L.puzzle(seed * 7919 + n, n);
      if (L.solved(pz)) solvedAtStart++;
      const q = L.clone(pz); for (const tl of q.tiles) tl.r = tl.sol;
      if (L.solved(q)) solvable++;
      paths += q.tiles.filter(tl => tl.path).length;
    }
    check(solvable === 300 && solvedAtStart === 0, n + '×' + n + ': 300 of 300 solvable by construction, none solved at the start (' + solvedAtStart + '), ' + (paths / 300).toFixed(1) + ' path tiles on average');
  }
  const a = L.puzzle(4242, 4), b = L.puzzle(4242, 4);
  check(JSON.stringify(a) === JSON.stringify(b), 'the same seed, the same puzzle');
  check(a.n === 4 && a.tiles.length === 16 && a.src >= 0 && a.src < 4 && a.dst >= 0 && a.dst < 4, 'the crystal on the left at row ' + a.src + ', the lamp on the right at row ' + a.dst);
  // turning tiles until it is solved (the player's way): every tile at most three turns
  const q = L.clone(a); let turns = 0;
  for (let i = 0; i < q.tiles.length; i++) { let k = 0; while (q.tiles[i].r !== q.tiles[i].sol && k < 4) { L.rotate(q, i); k++; turns++; } }
  check(L.solved(q) && turns > 0, 'turning tiles to their places lights the lamp (' + turns + ' turns)');
  const lit = L.flood(q);
  check(lit.solved && lit.lit[q.dst * 4 + 3] === 1 && lit.lit[q.src * 4] === 1, 'the light runs from the crystal\'s tile to the lamp\'s');
  const h = L.clone(a); L.hint(h, 1);
  const locked = h.tiles.filter(t => t.lock);
  check(locked.length === 1 && locked[0].path && locked[0].r === locked[0].sol, 'a hint (Geschick 5) locks one right tile of the path');
  const i0 = h.tiles.indexOf(locked[0]); L.rotate(h, i0);
  check(h.tiles[i0].r === locked[0].sol, 'a locked tile does not turn');
  const h2 = L.clone(a); L.hint(h2, 2); check(h2.tiles.filter(t => t.lock).length === 2, 'Geschick 10: two');
  check(L.hintsFor(0) === 0 && L.hintsFor(5) === 1 && L.hintsFor(10) === 2, 'the hints by Geschick: 0 · 1 at 5 · 2 at 10');
}

// ---------------------------------------------------------------- 3 · the calm ring
console.log('3 · the calm ring');
{
  check(L.CALM_T === 2, 'one lap in ' + L.CALM_T + ' s');
  check(L.calmArc(0) === 70 && L.calmArc(5) === 105 && L.calmArc(10) === 140 && L.calmArc(30) === 140, 'the arc: 70° + 7° a Geschick point, at most 140° (' + [0, 5, 10].map(g => L.calmArc(g) + '°').join(' · ') + ')');
  const st = L.calmStart(rng(3), 0, 100);
  // the needle's angle at time t: the press is inside when it is within half the arc of the arc's middle
  const tIn = 100 + (st.c / 360) * L.CALM_T, tOut = 100 + (((st.c + 180) % 360) / 360) * L.CALM_T;
  check(L.calmPress(st, tIn) === true && L.calmPress(st, tOut) === false, 'a press with the needle in the arc calms, opposite it not (arc at ' + st.c.toFixed(0) + '°)');
  check(L.calmNeedle(st, 100 + L.CALM_T * 1.25) === 90, 'the needle goes round once in 2 s (at 2.5 s: 90°)');
  let hits = 0; const r = rng(8);
  for (let i = 0; i < 2000; i++) { const s = L.calmStart(r, 5, 0); if (L.calmPress(s, r() * 2)) hits++; }
  check(Math.abs(hits / 2000 - 105 / 360) < 0.04, 'a press at a random moment: inside ' + (hits / 20).toFixed(1) + ' % (the arc\'s share ' + (105 / 3.6).toFixed(1) + ' %)');
}

// ---------------------------------------------------------------- 4 · a site
console.log('4 · a site');
{
  const s = L.site({ x: 1200, y: 82, z: -640, dir: 1, strays: 3 });
  check(s.id === '1200_-640' && L.state(s) === 'stoer', 'a new outpost is gestört (' + s.id + ')');
  L.resolve(s, 'down'); L.resolve(s, 'calm');
  check(L.state(s) === 'stoer' && s.res === 2 && s.cal === 1, 'two of three strays done (one powered down, one calmed): still gestört');
  L.resolve(s, 'calm');
  check(L.state(s) === 'bereit', 'all three done: bereit — the ring or the Lichtleiter');
  check(L.canRing(s, 'normal') && !L.canRing(s, 'off'), 'with Begegnungen the ring can be held; without, only the Lichtleiter');
  L.resolve(s, 'calm');
  check(s.res === 3, 'a fourth calm counts nothing (' + s.res + ')');
  L.setFree(s, 7);
  check(L.state(s) === 'frei' && s.day === 7, 'freed on day ' + s.day);
  const rec = Adv.fresh({ on: true });
  L.store(rec, s);
  const back = L.load(JSON.parse(JSON.stringify(rec)), s.id);
  check(back && L.state(back) === 'frei' && back.x === 1200 && rec.freed[s.id] && rec.freed[s.id].day === 7, 'saved and loaded; the freed one also in meta.adventure.freed (A§15)');
  const junk = L.load({ sites: { a: { x: 'NaN', st: 'boom', res: -4, strays: 1e9 } } }, 'a');
  check(junk && Number.isFinite(junk.x) && L.state(junk) === 'stoer' && junk.res === 0 && junk.strays <= 8, 'a broken record is sanitised');
  check(L.load({}, 'x') === null && !('sites' in Adv.fresh({ on: true }) && Object.keys(Adv.fresh({ on: true }).sites || {}).length), 'no record, no site');
}

// ---------------------------------------------------------------- 5 · finding the outposts
console.log('5 · finding the outposts');
{
  const R = V.R, beacon = R.byName.launch_beacon.defaultState, pad = R.byName.landing_pad.defaultState;
  for (let dir = 0; dir < 4; dir++) {
    const x = 3000 + dir * 500, z = -2000, y = 90;
    const bp = L.rot(dir, -6, 6), blocks = new Map([[`${x + bp[0]},${y + 1},${z + bp[1]}`, beacon], [`${x},${y},${z}`, pad]]);
    const get = (a, b, c) => blocks.get(`${a},${b},${c}`) || 0;
    const found = L.fromSpawns([['starship', 123, x, y + 1, z, dir], ['hoverbike', x, y, z]], get);
    check(found.length === 1 && found[0].dir === dir && found[0].beacon[0] === x + bp[0] && found[0].beacon[2] === z + bp[1] && found[0].y === y, 'turned ' + dir + ': the outpost from the pad\'s ship spawn, its beacon at ' + found[0].beacon.join(','));
  }
  const village = L.fromSpawns([['starship', 9, 100, 71, 100, 0]], () => 0);
  check(village.length === 0, 'a village\'s parked ship (no launch beacon) is no outpost');
  const lf = R.byName.leuchtfeuer;
  const again = L.fromSpawns([['starship', 9, 100, 71, 100, 2]], (a, b, c) => { const q = L.rot(2, -6, 6); return a === 100 + q[0] && b === 71 && c === 100 + q[1] ? (lf ? lf.defaultState : 0) : 0; });
  check(lf && again.length === 1, 'an outpost whose beacon is already the Leuchtfeuer is found again');
  check(L.tierOf(200, 300) === 3 && L.tierOf(1200, 0) === 4 && L.tierOf(2000, 1500) === 5, 'the Lichtleiter\'s size by distance: 3×3 near, 4×4, 5×5 far');
}

// ---------------------------------------------------------------- 6 · the Leuchtfeuer block
console.log('6 · the Leuchtfeuer block');
{
  const R = V.R, t = R.byName.leuchtfeuer;
  check(!!t, 'the block leuchtfeuer exists');
  if (t) {
    const last = R.types.reduce((a, b) => (b.base > a.base ? b : a));
    check(last === t && t.base + t.nstates === R.stateCount, 'appended after every other block: the last type (states ' + t.base + '–' + (t.base + t.nstates - 1) + ')');
    const snap = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'test', 'id_snapshot.json'), 'utf8'));
    const end = snap.reduce((m, r) => Math.max(m, r[1] + r[2]), 0);
    check(t.base >= end, 'outside the shipped id range (≥ ' + end + ')');
    check(t.nstates === 2 && t.has('frei'), 'two states: gestört and frei');
    const e0 = R.T.emit[t.state({ frei: 0 })], e1 = R.T.emit[t.state({ frei: 1 })];
    const un = (e) => VR.unpackLight ? VR.unpackLight(e) : [(e >> 8) & 15, (e >> 4) & 15, e & 15];
    const a = un(e0), b = un(e1);
    check(a[0] > a[1] && a[2] > a[1] && b[2] > b[0] && b[1] > b[0], 'red-violet light while disturbed (' + a.join(',') + '), cyan when free (' + b.join(',') + ')');
    check(R.models[t.state({ frei: 0 })] && R.models[t.state({ frei: 0 })].length > 6, 'a model of its own (plinth, pillar, the lamp)');
  }
}

// ---------------------------------------------------------------- 7 · Schnellreise
console.log('7 · Schnellreise');
{
  const freed = [{ id: 'a', beacon: [0, 70, 0] }, { id: 'b', beacon: [500, 70, 0] }, { id: 'c', beacon: [200, 70, 100] }];
  const list = L.travelTargets(freed, [2, 70, 1]);
  check(list.length === 2 && list[0].id === 'c' && list[1].id === 'b', 'at beacon a: the others, nearest first (' + list.map(x => x.id).join(', ') + ')');
  check(L.travelTargets(freed.slice(0, 1), [2, 70, 1]).length === 0, 'one freed beacon: nowhere to go yet');
  check(L.FAST_T === 3, 'the trip is a ' + L.FAST_T + '-s fade');
}

// ---------------------------------------------------------------- 8 · the quests
console.log('8 · the quests');
{
  check(L.quest === true, 'VR.Liberate.quest: the Befreien kind is on');
  const s = L.site({ x: 900, y: 75, z: 300, dir: 0, strays: 2 });
  const p = L.placeOf(s);
  check(p.id === s.id && p.x === 900 && p.z === 300, 'a site as the quests\' place (their id: out:' + p.id + ')');
}

// ---------------------------------------------------------------- 9 · the moment
console.log('9 · the moment');
{
  const B = L.TIMELINE, order = ['flicker', 'cyan', 'beam', 'ring', 'music', 'stand', 'funke', 'banner', 'end'];
  check(Array.isArray(B) && order.every(k => B.some(b => b.k === k)), 'the beats: ' + (B || []).map(b => b.k + '@' + b.t).join(' '));
  check(B.every((b, i) => i === 0 || b.t >= B[i - 1].t), 'in time order');
  const end = B.find(b => b.k === 'end').t;
  check(end >= 5 && end <= 8, 'about six seconds (' + end + ' s)');
  check(B.find(b => b.k === 'flicker').t === 0 && B.find(b => b.k === 'cyan').t >= 0.5, 'the beacon flickers first, then turns cyan');
  const due = L.beatsBetween(0.5, 1.0).map(b => b.k);
  check(due.indexOf('cyan') >= 0 && due.indexOf('flicker') < 0, 'the beats due in a frame (0.5–1.0 s: ' + due.join(', ') + ')');
  const keys = L.KEYS || [], de = V.I18N.dict.de || {}, en = V.I18N.dict.en || {};
  const miss = keys.filter(k => !(k in de) || !(k in en));
  check(keys.length >= 15 && !miss.length, keys.length + ' keys of the liberation in both tables' + (miss.length ? ' — missing ' + miss.slice(0, 6).join(', ') : ''));
  check(!/Sterntaler|Heliataler/.test(fs.readFileSync(SRC + 'liberate.js', 'utf8')), 'no currency word written in the code');
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
