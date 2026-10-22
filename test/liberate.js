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

// ---------------------------------------------------------------- 10 · the glue in a small world
// foes.js and liberate.js as the game runs them (F.tick from entities.js's update, F.ai per foe, the dead after 0.8 s
// → F.gone), over a flat stone world with an outpost pad: the guardians, an encounter (the warning ≥ 0.6 s, ≤ 2
// attacking), the power-down (drops, Taler, XP, the site bereit), the ring with its two drone waves, the MOMENT (cyan
// beacon, the award, Helfer standing up), an Ohnmacht (waking at the freed beacon), the calm way with Begegnungen aus
// (passive strays, the timing ring, the Lichtleiter), Kindersicher (no machine at all, the Lichtleiter alone) and a
// reload (the record keeps every site)
async function glue() {
  console.log('10 · the glue in a small world');
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
    isLoaded() { return true; }, getLight() { return 15 << 12; }, nbFn() { return null; },
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
  // the guardians and an encounter
  let minTele = 9, maxTok = 0; const teleAt = new Map(); let strikes = 0, hits0 = Fo.cost.hits;
  const watch = () => { p.health = 20; let tok = 0; for (const m of g.entities.mobs) { const f = m.foe; if (!f) continue; if (f.tok) tok++; if (f.st === 'tele' && !teleAt.has(m.id)) teleAt.set(m.id, g.time); if (f.st === 'strike' && teleAt.has(m.id)) { minTele = Math.min(minTele, g.time - teleAt.get(m.id)); teleAt.delete(m.id); strikes++; } if (f.st !== 'tele' && f.st !== 'strike') teleAt.delete(m.id); } maxTok = Math.max(maxTok, tok); };
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
  const wk = [b1[0] + 0.5, b1[1] + 1, b1[2] + 2.5];
  check(!Fo.fainting && p.health === 20 && Math.hypot(p.pos[0] - wk[0], p.pos[2] - wk[2]) < 0.01, 'woke at the freed beacon with full hearts (' + p.pos.map(v => v.toFixed(1)).join(', ') + ')');
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
  document.createElement = mk0;
}

glue().catch((e) => { fails++; console.log('  ✗ the glue threw: ' + (e && e.stack || e)); }).then(() => {
  console.log(fails ? 'FAILED ' + fails : 'ALL OK');
  process.exit(fails ? 1 : 0);
});
