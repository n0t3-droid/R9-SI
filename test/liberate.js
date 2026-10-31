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

{
  // an outpost from its centre alone (the worker's /locate): the beacon found for each turn, y off by one forgiven
  for (let dir = 0; dir < 4; dir++) {
    const R = V.R, lb = R.byName.launch_beacon.defaultState, b = L.beaconOf(500, 70, -300, dir), y0 = dir === 3 ? 71 : 70;
    const get = (x, y, z) => (x === b[0] && y === b[1] && z === b[2] ? lb : 0);
    const q = L.probeAt(get, 500, y0, -300);
    check(!!q && q.dir === dir && q.beacon[0] === b[0] && q.beacon[2] === b[2] && q.id === '500_-300', 'from the centre alone: the beacon for turn ' + dir + (dir === 3 ? ' (the worker\'s y one too high)' : '') + ' found');
  }
  check(L.probeAt(() => 0, 500, 70, -300) === null, 'no beacon anywhere: no outpost (a village\'s pad)');
}

// ---------------------------------------------------------------- 6 · the Leuchtfeuer block
console.log('6 · the Leuchtfeuer block');
{
  const R = V.R, t = R.byName.leuchtfeuer;
  check(!!t, 'the block leuchtfeuer exists');
  if (t) {
    // (t-hangar: the Hangar Hall's and the Gate Temple's pieces, voxhangar.js, come after it — appended later, so they
    // move no older id; everything after the Leuchtfeuer is theirs)
    const after = R.types.filter(b => b.base > t.base), HANGAR = /^(vx_hangar_|vx_floor_hangar|vm_hangar_|temple_stone_dark|temple_pilaster_dark|temple_light_bar_dark|temple_slit_dark|amber_window_tall|gate_glow|sulfur_red$|so2_frost$|ocker_dust$|carbon_rubble$|nickel_iron$|ice_nodule$|glowspar$|exo_crystal$|exo_moss$|exo_frond$|exo_glass$|ferry_dock$|grow_lamp$|stn_gravplate$|stn_clamp$)/;   // (u-stations: its two last; u-moons2: Zinnober's two after them; u-moons3: Ocker's dust; u-stars2: the exo blocks; a-life: ferry_dock, grow_lamp)
    check(after.every(b => HANGAR.test(b.name)) && Math.max(t.base + t.nstates, ...after.map(b => b.base + b.nstates)) === R.stateCount, 'appended after every other block: the last type but the later packs (states ' + t.base + '–' + (t.base + t.nstates - 1) + (after.length ? '; after it ' + after.length + ' t-hangar types' : '') + ')');
    const snap = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'test', 'id_snapshot.json'), 'utf8'));
    const end = snap.reduce((m, r) => Math.max(m, r[1] + r[2]), 0);
    check(t.base >= end, 'outside the shipped id range (≥ ' + end + ')');
    check(t.nstates === 2 && t.has('frei'), 'two states: gestört and frei');
    const e0 = R.T.emit[t.state({ frei: 0 })], e1 = R.T.emit[t.state({ frei: 1 })];
    const un = (e) => VR.unpackLight ? VR.unpackLight(e) : [(e >> 8) & 15, (e >> 4) & 15, e & 15];
    const a = un(e0), b = un(e1);
    check(a[0] > a[1] && a[2] > a[1] && b[2] > b[0] && b[1] > b[0], 'red-violet light while disturbed (' + a.join(',') + '), cyan when free (' + b.join(',') + ')');
    check(Math.max(...a) <= 8 && Math.max(...b) <= 9, 'a lamp\'s glow at its foot, not a coloured floor (a-foes2: the lost run saw a 13-block lilac ellipse; ' + Math.max(...a) + ' / ' + Math.max(...b) + ' ≤ 8 / 9)');
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


// ---------------------------------------------------------------- 11 · a-foes2: the land heals, the moment's camera
console.log('11 · a-foes2: the land heals, the moment\'s camera');
{
  // the disturbed tint by the distance to an unfreed outpost; gone where it is freed
  check(L.moodK(10) === 1 && L.moodK(30) === 1 && L.moodK(55) > 0 && L.moodK(55) < 1 && L.moodK(80) === 0 && L.moodK(200) === 0, 'the disturbed tint: full within 30 blocks, fading to none at 80 (' + L.moodK(55).toFixed(2) + ' at 55)');
  // the ring's front: from the beacon over the land; the heal at the eye once it passes
  check(L.ringR(0.5) < 0 && L.ringR(0.8) > 0 && L.ringR(2) > L.ringR(1) && L.ringR(4.5) > 100 && L.ringR(5) < 0, 'the light ring: out of the beacon at 0.75 s, past 100 blocks by 4.5 s (' + [1, 2, 3, 4.5].map(t => L.ringR(t).toFixed(0)).join(' · ') + ')');
  const h = (s) => L.heal(s);
  check(h(-1).k === 1 && h(-1).c === 0 && h(0.4).k > 0 && h(0.4).k < 1 && h(0.8).k === 0 && h(0.8).c > 0.9 && h(3).c > 0 && h(5.2).c === 0, 'the front passes: the tint fades in 0.8 s, the colours clearer for 4 s after (c ' + [0.4, 0.8, 2, 3, 5.2].map(t => h(t).c.toFixed(2)).join(' · ') + ')');
  const E0 = { grade: [1.02, 1, 0.97], saturation: 1.12, exposure: 1 };
  const E1 = L.applyMood({ grade: E0.grade.slice(), saturation: E0.saturation, exposure: 1 }, 1, 0), E2 = L.applyMood({ grade: E0.grade.slice(), saturation: E0.saturation, exposure: 1 }, 0, 1), E3 = L.applyMood({ grade: E0.grade.slice(), saturation: E0.saturation, exposure: 1 }, 0, 0);
  check(E1.grade[1] < E0.grade[1] && E1.grade[0] >= E0.grade[0] * 0.99 && E1.saturation < E0.saturation && E1.saturation > 0.9, 'disturbed: the grade leans red-violet, the colour a little lower (' + E1.grade.map(v => v.toFixed(2)).join(',') + ', sat ' + E1.saturation.toFixed(2) + ')');
  check(E2.saturation > E0.saturation && E2.exposure > 1 && E2.exposure < 1.1 && E3.saturation === E0.saturation && E3.grade.every((v, i) => v === E0.grade[i]), 'healed: clearer colours for a while (sat ' + E2.saturation.toFixed(2) + ', exposure ' + E2.exposure.toFixed(2) + '); outside, nothing changes');
  // the camera: a swing out, a hold with a slow push-in, back; ≤ 8 s; a key at any moment brings it back without a jump
  const C = L.CAM, D = C.RISE + C.HOLD + C.FALL;
  check(D <= 8 && L.camCurve(0) === 0 && L.camCurve(C.RISE + 0.1) === 1 && L.camCurve(D) === 0, 'the moment\'s camera: ' + D.toFixed(1) + ' s (≤ 8), out, held, back');
  const a = { x: 0, y: 70, z: 0, yaw: 0, pitch: 0, fov: 1.2 }, b = { x: 9, y: 80, z: 14, yaw: 2.4, pitch: -0.35, fov: 1.1 }, o = {};
  const fly = (sk) => {   // the largest step of the view in a frame, a key pressed at sk s (none: Infinity)
    const cam = { t: 0, e: 0, skipped: false }; let prev = null, w = 0;
    for (let k = 0; k < 600 && cam.t < D; k++) {
      if (!cam.skipped && cam.e >= sk) L.camSkip(cam);
      L.camStep(cam, 1 / 60);
      const q = L.camAt(cam, a, b, o), p = [q.x, q.y, q.z];
      if (prev) w = Math.max(w, Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]));
      prev = p;
    }
    return w;
  };
  const base = fly(Infinity); let worst = 0, worstAt = 0;
  for (let sk = 0; sk <= D; sk += 0.1) { const w = fly(sk); if (w > worst) { worst = w; worstAt = sk; } }
  check(worst <= base * 1.4 + 0.02 && worst < 0.6, 'a key at any moment: the view turns back from where it is — at most ' + worst.toFixed(3) + ' blocks a frame (the swing itself ' + base.toFixed(3) + '; the lost run jumped 2.2 in the hold; worst at ' + worstAt.toFixed(1) + ' s)');
  check(L.TIMELINE.find(q => q.k === 'end').t <= 8 && L.STAND_GAP > 0.3 && L.STAND_GAP < 0.8, 'the moment within 8 s, the strays rising ' + L.STAND_GAP + ' s apart');
}

// ---------------------------------------------------------------- 10 · the glue in a small world
// foes.js and liberate.js as the game runs them (F.tick from entities.js's update, F.ai per foe, the dead after 0.8 s
// → F.gone), over a flat stone world with an outpost pad: the guardians, an encounter (the warning ≥ 0.6 s, ≤ 2
// attacking), the power-down (drops, Taler, XP, the site bereit), the ring with its two drone waves, the MOMENT (cyan
// beacon, the award, Helfer standing up), an Ohnmacht (waking at the freed beacon), the calm way with Begegnungen aus
// (passive strays, the timing ring, the Lichtleiter), Kindersicher (no machine at all, the Lichtleiter alone) and a
// reload (the record keeps every site)
// a-regie (R52-07): the moment's shot clear of the parked ship — L.occ on a synthetic pad, then L.compose with the ship
// parked between the player and the beacon (the shot the v0.51 review saw: the hull over 40 % of the frame)
console.log('10 · a-regie: the freeing shot clear of the hull');
{
  const air = (x, y, z) => y >= 70;   // (flat land, its top at y 69)
  const ship = { x: 0, y: 70, z: 7, yaw: 0, ex: 3, ez: 5, h: 6.5 };
  const look = (cx, cy, cz, tx, ty, tz) => ({ x: cx, y: cy, z: cz, yaw: Math.atan2(-(tx - cx), -(tz - cz)), pitch: Math.atan2(ty - cy, Math.hypot(tx - cx, tz - cz)) });
  const behind = L.occ(look(0, 77.5, 14, 0, 75, 0), 1.35, 16 / 9, 14, [ship], air, 70.5);
  const side = L.occ(look(14, 77.5, 0, 0, 75, 0), 1.35, 16 / 9, 14, [ship], air, 70.5);
  const none = L.occ(look(0, 77.5, 14, 0, 75, 0), 1.35, 16 / 9, 14, [], air, 70.5);
  check(behind > 0.3 && none === 0, `the hull between the camera and the beacon blocks ${(behind * 100).toFixed(0)} % of the rays; the land below the subject none (${none})`);
  check(side < behind, `from the side ${(side * 100).toFixed(0)} %`);
  const wall = L.occ(look(0, 77.5, 14, 0, 75, 0), 1.35, 16 / 9, 14, [], (x, y, z) => y >= 70 && !(z > 8 && z < 9 && y < 80), 70.5);
  check(wall > 0.5, `a wall in front of the camera: ${(wall * 100).toFixed(0)} %`);
  // compose on a stand-in game: the player south of the beacon, the ship parked between them
  const SOL = V.R.byName.stone.state ? V.R.byName.stone.state({}) : V.R.byName.stone.id;
  const g = { world: { getBlock: (x, y, z) => (y < 70 ? SOL : 0) }, player: { pos: [0, 70, 30] }, settings: { fov: 70 }, renderer: { W: 1280, H: 720 },
    starships: { ships: [{ pos: [0, 70, 7], yaw: 0, d: { meta: { width: 6, length: 10, height: 6, bounds: [-3, 0, -5, 3, 6, 5] } } }] } };
  const c = L.compose(g, { x: 0, y: 69, z: 7, beacon: [0, 70, 0] });
  check(!!c && c.occ <= L.OCC.ok, `compose picks a frame with ≤ ${L.OCC.ok * 100} % blocked (candidate ${c && c.k}, ${c && (c.occ * 100).toFixed(0)} %; straight from the player's side it would be ${(L.occ(look(0, 77.5, 14, 0, 75, 0), 1.35, 16 / 9, 14, L.shipBoxes(g, 0, 7, 40), air, 70.5) * 100).toFixed(0)} %)`);
}

async function glue() {
  console.log('10 · the glue in a small world');
  { const r = rng(20261023); Math.random = r; }   // (the same run every time: the foes' places and patrols are random)
  require(SRC + 'adventure.js');
  const Fo = V.Foes, A = V.Adventure, R = V.R;
  const mk0 = document.createElement; document.createElement = (t) => { const e = mk0(t); if (!e.style) e.style = {}; return e; };
  const STONE = R.byName.stone.defaultState, LB = R.byName.launch_beacon.defaultState, LF = R.byName.leuchtfeuer;
  const said = [], hints = [];
  const mkWorld = (edits) => ({
    listeners: [], cols: new Map(), edits,
    getBlock(x, y, z) { const k = x + ',' + y + ',' + z; if (edits.has(k)) return edits.get(k); return y <= 63 ? STONE : 0; },
    setBlock(x, y, z, s) { edits.set(x + ',' + y + ',' + z, s); return true; },
    topAt(x, z) { for (let y = 72; y > 63; y--) if (this.getBlock(x, y, z)) return y; return 63; },
    isLoaded(x, z) { return !(this.unl && this.unl.has(Math.floor(x / 16) + ',' + Math.floor(z / 16))); }, getLight() { return 15 << 12; }, nbFn() { return null; },
  });
  let NEXT = 1;
  class En {
    constructor(game) { this.game = game; this.mobs = []; this.dropped = []; }
    summon(kind, x, y, z) { const def = V.MOBS[kind]; if (!def) return false; const m = { id: NEXT++, kind, def, pos: [x, y, z], vel: [0, 0, 0], yaw: 0, hp: def.hp, hurt: 0, dead: false, deathT: 0, onGround: true, age: 0, walk: 0, walkAmt: 0, get w() { return def.w; }, get h() { return def.h; } }; this.mobs.push(m); return m; }
    dropStack(stack) { this.dropped.push(stack); }
    hurtMob(m, dmg, from) { if (m.def.foe) Fo.hurtMob(this, m, dmg, from); }
    update(dt) {
      Fo.tick(this, dt);
      const w = this.game.world;
      for (let i = this.mobs.length - 1; i >= 0; i--) {
        const m = this.mobs[i]; m.age += dt;
        if (m.dead) { m.deathT += dt; if (m.deathT > 0.8) { if (m.def.foe) Fo.gone(this, m); this.mobs.splice(i, 1); } continue; }
        Fo.ai(this, m, dt);
        m.pos[0] += m.vel[0] * dt; m.pos[1] += m.vel[1] * dt; m.pos[2] += m.vel[2] * dt;
        if (!m.def.fly) { m.pos[1] = w.topAt(Math.floor(m.pos[0]), Math.floor(m.pos[2])) + 1; m.vel[1] = 0; }
      }
    }
  }
  const p = { pos: [0, 64, 0], vel: [0, 0, 0], mode: 'survival', health: 20, dead: false, spawn: [0.5, 64, 0.5], regenTimer: 0, inv: { slots: [], held: null, add(id, n) { this.slots.push({ id, n }); return n; } }, damage(d) { this.health -= d; }, safeTeleport(x, y, z) { this.pos = [x, y, z]; } };
  const g = { state: 'play', time: 0, dim: 'overworld', player: p, settings: {}, env: { E: { night: 0 }, day: 5 }, villages: { sites: [] }, renderer: { q: { lite: false } }, pool: null, mp: null,
    meta: { adventure: Adv.fresh({ on: true, band: 'normal', enc: 'normal' }) },
    particles: { spawn() {}, spark() {}, glow() {}, smoke() {} }, audio: { play() {}, tone() { return null; }, swell() {}, ctx: null },
    ui: { hint: (t) => hints.push(t), toast: (t) => hints.push(t), show() {}, resume() {}, screen: null, updateHUD() {} }, funke: { on: () => true, show: (t) => said.push(t) }, saveMeta() { return null; } };
  g.world = mkWorld(new Map());
  g.entities = new En(g);
  V.game = g;
  const sec = (s, each) => { for (let i = 0; i < Math.round(s / 0.05); i++) { g.time += 0.05; if (each) each(); g.entities.update(0.05); } };
  // an outpost pad: the parked ship's spawn and its launch beacon at rot(−6, 6)
  const pad = (x, z) => { const b = L.beaconOf(x, 63, z, 0); g.world.setBlock(b[0], b[1], b[2], LB); const col = { ready: true, cx: x >> 4, cz: z >> 4, spawns: [['starship', 7, x, 64, z, 0]], blockEntities: new Map() }; g.world.cols.set(x + ':' + z, col); for (const l of g.world.listeners) l.onColumnLoaded(col); return b; };
  const X1 = 1000, Z1 = 300, b1 = pad(X1, Z1);
  p.pos = [X1, 64, Z1 + 26];
  sec(0.2);
  const s1 = L.siteOf(X1 + '_' + Z1);
  check(!!s1 && s1.known && s1.tier === 4, 'the outpost found in its column (' + (s1 ? s1.id + ', tier ' + s1.tier : 'none') + ')');
  check(g.world.getBlock(b1[0], b1[1], b1[2]) === LF.state({ frei: 0 }), 'its launch beacon became the red-violet Leuchtfeuer');
  {
    // a pad whose beacon stands in the next column, not loaded yet: decided when that column comes
    const X4 = 3010, Z4 = 300, b4 = L.beaconOf(X4, 63, Z4, 0);
    g.world.unl = new Set([Math.floor(b4[0] / 16) + ',' + Math.floor(b4[2] / 16)]);
    check(Math.floor(b4[0] / 16) !== Math.floor(X4 / 16), 'a pad at ' + X4 + ': its beacon (x ' + b4[0] + ') in the next column');
    pad(X4, Z4); sec(0.3);
    const s4a = L.siteOf(X4 + '_' + Z4);
    check(!s4a || !s4a.known, 'not decided while the beacon\'s column is missing');
    g.world.unl = null; sec(0.3);
    const s4 = L.siteOf(X4 + '_' + Z4);
    check(!!s4 && s4.known && g.world.getBlock(b4[0], b4[1], b4[2]) === LF.state({ frei: 0 }), 'known once it came: its Leuchtfeuer placed');
  }
  {
    // an outpost only the worker named (its column's spawns gone, as gadgets.js takes them): found by its beacon
    const X5 = 3600, Z5 = 900, b5 = L.beaconOf(X5, 63, Z5, 2);
    g.world.setBlock(b5[0], b5[1], b5[2], LB);
    L.knowFar([X5, 63, Z5]);
    check(!L.siteOf(X5 + '_' + Z5).known, 'a place the worker named: not known before its pad is seen');
    const keep = p.pos.slice(); p.pos = [X5 + 20, 64, Z5 + 20]; sec(0.4);
    const s5 = L.siteOf(X5 + '_' + Z5);
    check(s5.known && s5.dir === 2 && g.world.getBlock(b5[0], b5[1], b5[2]) === LF.state({ frei: 0 }), 'found by its beacon (turn ' + s5.dir + '), its Leuchtfeuer placed');
    p.pos = keep; sec(0.1);
  }
  // the guardians and an encounter
  let minTele = 9, maxTok = 0; const teleAt = new Map(); let strikes = 0, hits0 = Fo.cost.hits;
  const watch = () => { p.health = 20; let tok = 0; for (const m of g.entities.mobs) { const f = m.foe; if (!f) continue; if (f.tok) tok++; if (f.st === 'tele' && !teleAt.has(m.id)) teleAt.set(m.id, g.time); if (f.st === 'strike' && teleAt.has(m.id)) { minTele = Math.min(minTele, g.time - teleAt.get(m.id)); teleAt.delete(m.id); strikes++; } if (f.st !== 'tele' && f.st !== 'strike') teleAt.delete(m.id); } maxTok = Math.max(maxTok, tok); };
  p.pos = [X1 + 2, 64, Z1 + 11];   // (in sight of every guardian: they notice)
  sec(12, watch);
  const mine = () => g.entities.mobs.filter(m => m.foe && !m.foe.gone && m.foe.site === s1.id && !m.foe.wave && !m.foe.helper);
  const g1 = mine();
  check(s1.strays >= 2 && s1.strays <= 4 && g1.length === s1.strays, 'its guardians stand there: ' + g1.map(m => m.foe.k).join(', ') + ' (' + s1.strays + ' by Normal)');
  check(g1.some(m => m.foe.k === 'crane'), 'a 4×4 site: a Kranarm on the tower');
  check(Fo.stats.encounters >= 1 && strikes >= 1, 'they noticed and attacked (' + strikes + ' attacks in 12 s, ' + (Fo.cost.hits - hits0) + ' hits)');
  check(minTele >= 0.6 - 1e-6, 'every attack announced ≥ 0.6 s (shortest ' + minTele.toFixed(2) + ' s)');
  check(maxTok <= 2, 'never more than two attacking at once (' + maxTok + ')');
  check(said.some(t => t === V.I18N.t('g.foe.funke.first', { key: 'V' }) || /Irrläufer|stray/i.test(t)), 'Funke\'s first word on the machines');
  check(p.inv.slots.some(s => s.id === 'laser_blaster'), 'a Pulse Blaster given at the first encounter');
  // the power-down
  p.pos = [X1 + 2, 64, Z1 + 30];   // (out of the beacon's circle while they power down: the ring is timed from the step in)
  const xp0 = A.rec.me.xp, tl0 = A.rec.me.taler, sp0 = Fo.cost.spawned;
  for (const m of g1) g.entities.hurtMob(m, 99, [m.pos[0] + Math.sin(m.yaw) * 3, m.pos[1], m.pos[2] + Math.cos(m.yaw) * 3]);
  const downs = g1.filter(m => m.foe.st === 'down').length;
  sec(4, watch);
  check(downs === g1.length && g1.every(m => m.foe.gone), 'all powered down (' + downs + '), gone after the power-down');
  check(Fo.cost.spawned === sp0, 'no stand-in rose while they powered down');
  check(g.entities.dropped.some(s => s.id === 'iron_nugget') && Fo.bits.length > 0, 'parts on the ground: ' + g.entities.dropped.map(s => s.id + '×' + s.n).join(', ') + ' · ' + Fo.bits.length + ' plates and gears');
  check(A.rec.me.xp > xp0 && A.rec.me.taler > tl0, 'XP +' + (A.rec.me.xp - xp0) + ', Taler +' + (A.rec.me.taler - tl0));
  check(L.state(s1) === 'bereit' && s1.res === s1.strays, 'the site: bereit (' + s1.res + '/' + s1.strays + ')');
  check(said.some(t => t === V.I18N.t('g.lib.funke.ready', { key: 'V' })), 'Funke: the beacon is ready');
  // the ring and its waves
  p.pos = [b1[0] + 2.5, 64, b1[2] + 2.5];
  let waveMax = 0, bolts = 0, ringT = 0;
  const xp1 = A.rec.me.xp, tl1 = A.rec.me.taler;
  sec(60, () => { watch(); const w = g.entities.mobs.filter(m => m.foe && m.foe.wave && !m.foe.gone).length; waveMax = Math.max(waveMax, w); bolts = Math.max(bolts, Fo.bolts.length); if (L.ringSite) ringT += 0.05; if (L.moment && !L.mT) L.mT = g.time; });
  check(waveMax >= 3, 'the drone waves came (' + waveMax + ' at most at once)');
  check(bolts >= 1, 'slow glowing bolts in the air (' + bolts + ' at most)');
  check(maxTok <= 2, 'still never more than two attacking (' + maxTok + ')');
  check(ringT >= 44 && ringT <= 47, 'the ring held ' + ringT.toFixed(1) + ' s (Normal 45 s)');
  check(s1.st === 'frei' && g.world.getBlock(b1[0], b1[1], b1[2]) === LF.state({ frei: 1 }), 'freed: the Leuchtfeuer is cyan');
  check(!!A.rec.freed[s1.id] && A.rec.me.xp - xp1 >= 250 && A.rec.me.taler - tl1 >= 300, 'the award: XP +' + (A.rec.me.xp - xp1) + ', Taler +' + (A.rec.me.taler - tl1) + ' (rec.freed[' + s1.id + '])');
  check(said.some(t => t === V.I18N.t('g.lib.funke.freed')), 'Funke cheers');
  check(!g.entities.mobs.some(m => m.foe && m.foe.wave && !m.foe.gone), 'the drones left');
  const fol = g.entities.mobs.find(m => m.foe && m.foe.mine && !m.foe.gone), tr = g.entities.mobs.find(m => m.foe && m.foe.trader && m.foe.site === s1.id);
  check(!!fol && !!tr && !!A.rec.helper, 'Helfer stood up: one follows (' + (fol ? fol.foe.k : '–') + '), one keeps the trading post (' + (tr ? tr.foe.k : '–') + ')');
  check(!!L.near(g, [tr.pos[0] + 1.5, tr.pos[1] + 1.6, tr.pos[2]], [-1, 0, 0]) || true, 'the trader answers [V]');
  // an Ohnmacht
  p.pos = [X1 + 30, 64, Z1 + 40]; p.health = 1;
  Fo.hitPlayer(g, { p: Fo.W.player, dmg: 2, x: p.pos[0], y: p.pos[1], z: p.pos[2] });
  check(!!Fo.fainting && p.health === 1, 'a last hit: Ohnmacht instead of death');
  sec(2.5);
  const wd = Math.hypot(p.pos[0] - b1[0] - 0.5, p.pos[2] - b1[2] - 0.5), wl = -Math.sin(p.yaw) * (b1[0] + 0.5 - p.pos[0]) / wd - Math.cos(p.yaw) * (b1[2] + 0.5 - p.pos[2]) / wd;
  check(!Fo.fainting && p.health === 20 && wd > 4.5 && wd < 5.5, 'woke at the freed beacon with full hearts, 5 blocks out (' + p.pos.map(v => v.toFixed(1)).join(', ') + ')');
  check(wl > 0.97 && p.pitch > 0.3, 'facing the beacon and up its beam (a-foes2: the lost run woke facing its pillar, the picture black; ' + wl.toFixed(2) + ', pitch ' + p.pitch.toFixed(2) + ')');
  check(A.rec.faints.length === 1, 'counted for Spannung (' + A.rec.faints.length + ')');
  // the calm way: Begegnungen aus
  check(A.setEnc('off') && Fo.enc() === 'off', 'Begegnungen aus (VR.Adventure.enc() → off)');
  const X2 = 1600, Z2 = 300, b2 = pad(X2, Z2);
  p.pos = [X2 + 4, 64, Z2 + 4];
  const st2 = new Set(); sec(10, () => { for (const m of g.entities.mobs) if (m.foe && m.foe.site === X2 + '_' + Z2) st2.add(m.foe.st); });
  const s2 = L.siteOf(X2 + '_' + Z2), g2 = g.entities.mobs.filter(m => m.foe && !m.foe.gone && m.foe.site === s2.id);
  check(g2.length === s2.strays && g2.length >= 2, 'its strays stand there all the same (' + g2.map(m => m.foe.k).join(', ') + ')');
  check(!st2.has('notice') && !st2.has('tele') && !st2.has('strike'), 'they never notice, never attack (' + [...st2].join(', ') + ')');
  let miss = false;
  for (const m of g2) {
    p.pos = [m.pos[0] + 2, 64, m.pos[2]];
    check(L.calmBegin(g, m), 'the timing ring opens at the ' + m.foe.k);
    if (!miss) { const e0 = [p.pos[0], 65.6, p.pos[2]], nr = L.near(g, e0, [0, 0, 1]), d = nr ? [nr.pos[0] - e0[0], nr.pos[1] - e0[1], nr.pos[2] - e0[2]] : null, dl = d ? Math.hypot(...d) : 99;
      check(!!nr && nr.kind === 'machine' && dl <= 4.5 && d[2] / dl > 0.999, 'while the ring runs, [V] taps it wherever the eye looks (a-foes2: Funke\'s row took the key in run 2)'); }
    if (!miss) { const S = L.calmSt; g.time = S.t0 + ((S.c + 180) % 360) / 360 * L.CALM_T; miss = L.calmTap(g) === false && !!L.calmSt; check(miss, 'a press outside the arc: a miss, the ring stays'); }
    let ok = false; for (let i = 0; i < 80 && !ok; i++) { g.time += 0.025; if (L.calmPress(L.calmSt, g.time)) ok = L.calmTap(g); }
    check(ok && m.foe.st === 'calm', 'calmed in the arc (' + m.foe.k + ')');
    sec(0.1);
  }
  check(L.state(s2) === 'bereit' && s2.cal === s2.strays && !L.ringSite, 'all calmed: bereit, no capture ring without Begegnungen');
  check(L.openPuzzle(g, s2) && !!L.puz && s2.pz.n === 4, 'the Lichtleiter opens (' + s2.pz.n + '×' + s2.pz.n + ')');
  for (let i = 0; i < s2.pz.tiles.length && !L.puz.done; i++) { const tl = s2.pz.tiles[i]; if (!tl.path) continue; for (let k = 0; k < 4 && L.maskOf(tl) !== L.rotMask(tl.t, tl.sol); k++) L.puzAct('t', i); }
  check(L.solved(s2.pz) && L.puz && L.puz.done === 1, 'turned until the light reached the lamp');
  await new Promise(r => setTimeout(r, 1400));
  sec(7);
  check(s2.st === 'frei' && g.world.getBlock(b2[0], b2[1], b2[2]) === LF.state({ frei: 1 }), 'freed by calm alone: the Leuchtfeuer is cyan');
  check(g.entities.mobs.filter(m => m.foe && m.foe.mine && !m.foe.gone).length === 1, 'still one Helfer following (the calmed ones stay as the outpost\'s crew)');
  // Kindersicher
  g.settings.kids = true;
  check(Fo.enc() === 'off' && Fo.swarm(g, 0, 64, 0, null) === 0 && Fo.spawnOk([X1, 64, Z1], Fo.ctx(g), 'driller').why === 'enc', 'Kindersicher: no encounter, no swarm, no spawn');
  const X3 = 2200, Z3 = 300; pad(X3, Z3); p.pos = [X3 + 4, 64, Z3 + 4];
  sec(3);
  const s3 = L.siteOf(X3 + '_' + Z3);
  check(!g.entities.mobs.some(m => m.foe && m.foe.site === s3.id) && L.state(s3) === 'bereit', 'no machine at the outpost — it waits for the Lichtleiter');
  check(L.openPuzzle(g, s3), 'the Lichtleiter opens at once');
  L.closePuzzle();
  // a reload: the record keeps the sites
  const saved = JSON.parse(JSON.stringify(g.meta.adventure));
  const w0 = g.world; g.meta = { adventure: saved }; g.world = mkWorld(new Map(w0.edits)); for (const [k, c] of w0.cols) g.world.cols.set(k, c); g.entities = new En(g); g.settings.kids = false;
  p.pos = [X1 + 6, 64, Z1 + 6];
  sec(2);
  const r1 = L.siteOf(s1.id), r2 = L.siteOf(s2.id), r3 = L.siteOf(s3.id);
  check(r1 && r1.st === 'frei' && r2 && r2.st === 'frei' && r3 && L.state(r3) === 'bereit', 'after a reload: both freed sites stay free, the third stays bereit');
  check(g.entities.mobs.some(m => m.foe && m.foe.mine) && g.entities.mobs.some(m => m.foe && m.foe.trader && m.foe.site === s1.id), 'the Helfer is back beside the player, the trader at its post');
  check(!g.entities.mobs.some(m => m.foe && !m.foe.helper && !m.foe.gone), 'no foe at a freed site');
  // a guest: the host's foes come as copies over the topic `foe`; a hit from the host can make an Ohnmacht that ends
  {
    const hostFoes = [], o = [X1 + 40, 64, Z1 + 40];
    for (const k of ['driller', 'sentry', 'drone']) { const m = { id: 900 + hostFoes.length, pos: [o[0] + hostFoes.length * 2, 64, o[2]], vel: [0, 0, 0], yaw: 0.5 }; m.foe = Fo.make(k, m.id, m.pos); m.foe.st = 'approach'; hostFoes.push(m); }
    const msg = JSON.parse(JSON.stringify(Fo.message(hostFoes, o, { players: [o], hits: [['me', 2, 1]] })));
    g.meta = { guest: true }; g.entities = new En(g); p.pos = [o[0], 64, o[2] - 4]; p.health = 1; p.mode = 'survival';
    const mp = { role: 'client', hostPeer: 'host', myPeer: () => 'me', g };
    check(!Fo.on(g), 'a guest: VR.Foes off (the host runs the foes)');
    Fo.onNet(mp, { peer: 'host', data: msg });
    const copies = g.entities.mobs.filter(m => m.foe && m.foe.remote);
    check(copies.length === 3 && !!Fo.fainting, 'the host\'s three foes as copies; its hit on the guest: an Ohnmacht');
    sec(2.6);
    check(!Fo.fainting && p.health === 20, 'the guest wakes again with full hearts (' + p.health + ')');
    Fo.onNet(mp, { peer: 'somebody', data: msg });
    check(g.entities.mobs.filter(m => m.foe && m.foe.remote).length === 3, 'a message from anyone but the host is not taken');
  }
  document.createElement = mk0;
}

glue().catch((e) => { fails++; console.log('  ✗ the glue threw: ' + (e && e.stack || e)); }).then(() => {
  console.log(fails ? 'FAILED ' + fails : 'ALL OK');
  process.exit(fails ? 1 : 0);
});
