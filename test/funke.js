// Funke, the companion drone (src/main/funke.js, VR.Funke; plan docs/superpowers/plans/2026-10-22-e-funke.md, erlebnis
// §3, abenteuer §9–§11) — the pure parts and a stand-in game:
//  a · the talking budget: over a simulated hour of offers every second ≤ 1 unprompted line per 3 min (every gap ≥ 180 s),
//      an asked line always passes and restarts the wait, „Funke, Ruhe!" silences the unprompted lines for 10 minutes and
//      „an" brings them back, nothing unprompted during Bauruhe (20 s after a build action);
//  b · lost-player detection on synthetic tracks (1 Hz): a straight walk over new ground — never; pacing in a 40-m yard —
//      lost at ≈ 90 s of moving; standing still — never; circles of 10 m — „circle"; walking toward a target over old
//      ground — never; re-armed only after the cool-down;
//  c · the next wow: the hour (golden hour, sunset, night), an aurora night, the murmuration (only from Balanced with the
//      birds' switch), the sky rays near the isles, the life director's coming slots, the apron's next landing, the
//      festival, an unseen vista; the unprompted window (w ≥ 3, 15–180 s) and the asked one (≤ 5 min); no id twice;
//  d · the phrases: distances in German and English, the when-words;
//  e · the spring: settles within 1.2 s with < 8 % overshoot, stable at dt 0.1, the lag clamp, the snap after a teleport;
//  f · every line key in both tables (lists, the same placeholders), the settings rows;
//  g · the scan: the marks (the chests, the ores, nothing else) and the incremental scan on a stand-in world (nearest
//      first, chests first, the cap, the budget per step);
//  h · the hooks: every hooked file carries its `// e-funke` lines;
//  i · the actor in a stand-in game: follows, banks, lifts over a wall, stays quiet when switched off, the way and the
//      scan run and end, the update ≤ 0.02 ms a frame (CPU).
//   bash test/wt_run.sh funke.js 300
const fs = require('fs'), path = require('path');
const V = require('./load_shared.js');
global.window = global.window || {};
if (!global.window.addEventListener) global.window.addEventListener = () => {};
global.performance = global.performance || { now: () => Date.now() };
const ROOT = path.join(__dirname, '..'), SRC = path.join(ROOT, 'src/main');
for (const f of ['i18n', 'lang_en', 'lang_de', 'voxmodels', 'lifekit', 'lifedirector', 'wildsim', 'weather', 'sky3', 'padlife', 'wowmoment', 'eventlog', 'funke']) require(path.join(SRC, f + '.js'));
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const F = V.Funke;
check(!!F && typeof F.ask === 'function' && !!F.Budget && !!F.Lost && !!F.Actor, 'VR.Funke exists (ask, Budget, Lost, Actor)');

// ---------------------------------------------------------------- a · the talking budget
{
  const B = new F.Budget();
  check(F.GAP === 180 && F.BAURUHE === 20 && F.MUTE === 600, 'the numbers: one unprompted line per 3 min (f-quiet), Bauruhe 20 s, the mute 10 min');
  // an hour of offers every second, an asked line now and then, building now and then
  const said = [];
  for (let t = 0; t < 3600; t++) {
    if (t % 400 === 250) B.build(t);                        // a build action: 20 s of quiet
    if (t % 777 === 500 && B.can(t, true)) B.said(t);       // the player asks
    if (B.can(t, false)) { said.push(t); B.said(t); }
  }
  let minGap = Infinity; for (let i = 1; i < said.length; i++) minGap = Math.min(minGap, said[i] - said[i - 1]);
  check(said.length >= 12 && said.length <= 21 && minGap >= 180, `an hour of offers: ${said.length} unprompted lines, the shortest gap ${minGap} s (≥ 180)`);
  check(said.every(t => !(t % 400 >= 250 && t % 400 < 270)), 'no unprompted line within 20 s after a build action (Bauruhe)');
  const B2 = new F.Budget();
  B2.said(10);
  check(!B2.can(50, false) && B2.can(50, true), 'an asked line passes when an unprompted one may not');
  B2.said(50);
  check(!B2.can(220, false) && B2.can(231, false), 'an asked line restarts the wait (the next unprompted one 3 min after it)');
  const B3 = new F.Budget();
  B3.mute(100);
  check(B3.muted(100) && B3.muted(699) && !B3.can(300, false) && B3.can(300, true), '„Funke, Ruhe!": 10 minutes without unprompted lines — asked lines still answer');
  check(!B3.muted(701) && B3.can(701, false), 'after the 10 minutes it may talk again');
  B3.mute(800); B3.unmute();
  check(!B3.muted(801) && B3.can(801, false), '„Funke, an" ends the mute at once');
  const B4 = new F.Budget();
  B4.build(1000);
  check(B4.quiet(1010) && !B4.can(1010, false) && B4.can(1010, true) && !B4.quiet(1021) && B4.can(1021, false), 'Bauruhe: nothing unprompted for 20 s after building, asked lines pass');
}

// ---------------------------------------------------------------- b · lost-player detection (1 Hz tracks)
{
  const run = (n, track, targets) => { const L = new F.Lost(); const out = []; for (let t = 0; t <= n; t++) { const p = track(t); const r = L.step(t, p[0], p[1], targets || []); if (r) out.push([t, r]); } return out; };
  const tg = [[2000, 2000], [-1500, 900]];
  const straight = run(400, (t) => [t * 4.2, 10], tg);
  check(!straight.length, 'a straight walk over new ground: never lost');
  // pacing up and down a 40-m yard at 3 m/s (no new cell after the first pass, no target nearer)
  const pace = run(300, (t) => { const u = (t * 3) % 80; return [u < 40 ? u : 80 - u, 5]; }, tg);
  const firstPace = pace.length ? pace[0] : null;
  check(!!firstPace && firstPace[1] === 'lost' && firstPace[0] >= 88 && firstPace[0] <= 105, `pacing in a 40-m yard: lost at ${firstPace ? firstPace[0] + ' s (' + firstPace[1] + ')' : 'never'} (≈ 90 s of moving)`);
  check(pace.length <= 2, `then re-armed only after the cool-down (${pace.length} in 300 s)`);
  const stand = run(400, () => [3, 3], tg);
  check(!stand.length, 'standing still: never lost (the clock runs only while moving)');
  // circles of 10 m at 3 m/s (one turn in ≈ 21 s)
  const circ = run(200, (t) => { const a = t * 3 / 10; return [Math.cos(a) * 10, Math.sin(a) * 10]; }, tg);
  check(!!circ.length && circ[0][1] === 'circle' && circ[0][0] <= 75, `circling: ${circ.length ? circ[0][1] + ' at ' + circ[0][0] + ' s' : 'never'} (before the 90-s rule)`);
  // walking back and forth over old ground but each pass nearer to a target: never lost
  const toward = run(300, (t) => { const u = (t * 3) % 80; return [(u < 40 ? u : 80 - u) + t * 0.6, 0]; }, [[400, 0]]);
  check(!toward.length, 'getting nearer to a target (over old ground): never lost');
  // the cell rule: wandering into new cells is progress
  const wander = run(300, (t) => [Math.sin(t / 40) * 30 + t * 1.2, Math.cos(t / 50) * 30], []);
  check(!wander.length, 'wandering on into new places: never lost');
}

// ---------------------------------------------------------------- c · the next wow
{
  const LD = V.LifeDirector, S3 = V.Sky3;
  const base = { tod: 9000, day: 3, seed: 4242, wxSeed: 777, tier: 2, sky3: 2, sw: { wildBirds: true, wildRays: true, lifeDir: true, padLife: true }, pos: [0, 80, 60], heart: true, place: 'hangar', ld: null, pads: null, vistas: [], villages: [], wet: false, dim: 'overworld' };
  const C = (o) => F.wowCandidates(Object.assign({}, base, o));
  const gold = C({ tod: 9800 }).find(c => c.kind === 'golden');
  check(!!gold && Math.abs(gold.eta - 30) < 1 && gold.w >= 3, `before the golden hour: „golden" in ${gold ? gold.eta.toFixed(0) : '—'} s (ticks 9800 → 10400, 20 ticks/s)`);
  check(!C({ tod: 3000 }).some(c => c.kind === 'golden' && c.eta < 300), 'in the morning no golden hour within five minutes');
  const sunset = C({ tod: 11500 }).find(c => c.kind === 'sunset');
  check(!!sunset && Math.abs(sunset.eta - 25) < 1, `the sunset: in ${sunset ? sunset.eta.toFixed(0) : '—'} s (12000)`);
  // an aurora night and a night without one (sky3 level 2)
  let auroraDay = -1, plainDay = -1;
  for (let d = 0; d < 40 && (auroraDay < 0 || plainDay < 0); d++) { if (S3.auroraNight(777, d) > 0) { if (auroraDay < 0) auroraDay = d; } else if (plainDay < 0) plainDay = d; }
  const au = C({ tod: 12600, day: auroraDay }).find(c => c.kind === 'aurora');
  check(auroraDay >= 0 && !!au && au.w >= 3, `an aurora night (day ${auroraDay}): „aurora" offered at dusk`);
  check(!C({ tod: 12600, day: plainDay }).some(c => c.kind === 'aurora'), `a night without one (day ${plainDay}): no aurora`);
  check(!C({ tod: 12600, day: auroraDay, sky3: 1 }).some(c => c.kind === 'aurora'), 'the aurora only where the sky draws it (Himmel 2)');
  // the murmuration at dusk: from Balanced, with the birds' switch, not in the rain
  const murm = C({ tod: 10000 }).find(c => c.kind === 'murm');
  check(!!murm && Math.abs(murm.eta - 20) < 1, `the murmuration: in ${murm ? murm.eta.toFixed(0) : '—'} s (swirl from 10400)`);
  check(!C({ tod: 10000, tier: 1 }).some(c => c.kind === 'murm') && !C({ tod: 10000, sw: Object.assign({}, base.sw, { wildBirds: false }) }).some(c => c.kind === 'murm') && !C({ tod: 10000, wet: true }).some(c => c.kind === 'murm'), 'no murmuration on Low, with the birds off or in the rain');
  // the sky rays near the isles (Balanced, the switch)
  check(C({ pos: [330, 120, 140], place: 'isles' }).some(c => c.kind === 'rays') && !C({ pos: [330, 120, 140], place: 'isles', tier: 1 }).some(c => c.kind === 'rays'), 'the sky rays: near the isles from Balanced');
  // the life director's coming slots (its pick at the slot's time)
  // (a seed whose next five minutes hold at least two acts worth a word; its own picks over the same slots)
  const ctxLD = { place: 'plaza', hour: 'noon', tod: 6200, wet: false, fest: false, tier: 2, has: { lamps: true, chimneys: true, fountain: true, water: false } };
  const picks = (seed) => { const k0 = LD.slotAt(seed, 1000) + 1, out = []; for (let k = k0; k < k0 + 14; k++) { const eta = LD.slotTime(seed, k) - 1000; if (eta > 300) break; const kind = LD.pick(seed, k, ctxLD); if (kind && F.LD_W[kind] >= 2) out.push(kind + '@' + Math.round(eta)); } return out; };
  let ldSeed = 1; while (ldSeed < 200 && picks(ldSeed).length < 2) ldSeed++;
  const expect = picks(ldSeed), got = C({ tod: 6200, place: 'plaza', ld: { seed: ldSeed, clock: 1000, ctx: ctxLD } }).filter(c => c.src === 'ld').map(c => c.kind + '@' + Math.round(c.eta));
  check(expect.length >= 2 && got.join(' ') === expect.join(' '), `the life director's coming slots (seed ${ldSeed}): ${got.join(' ') || '—'} = its own picks ${expect.join(' ')}`);
  // the apron's next landing
  const PL = V.PadLife, cache = { seed: 5, n: 0, T: PL.t0(5) };
  const nextT = (() => { const c = PL.visitAt(5, 500, cache); return c.T > 500 ? c.T : c.T + PL.stay(5, c.n) + PL.GAP; })();
  const ship = C({ pads: [{ key: 'apron', seed: 5, x: 47, z: 62, clock: 500 }] }).find(c => c.kind === 'ship');
  check(!!ship && Math.abs(ship.eta - (nextT - 500)) < 1.5, `the apron's next landing: in ${ship ? ship.eta.toFixed(0) : '—'} s (PadLife: ${(nextT - 500).toFixed(0)} s)`);
  // the festival tonight and an unseen vista ahead
  check(C({ tod: 8000, villages: [{ name: 'Lindenau', x: 60, z: 60, fest: true }] }).some(c => c.kind === 'festival' && c.vars.name === 'Lindenau'), 'the lantern festival tonight in a village near');
  const vist = C({ vistas: [{ id: 'v3', x: 40, y: 80, z: 120, lm: 'citadel', seen: false }, { id: 'v4', x: 10, y: 80, z: 70, lm: 'isles', seen: true }] }).filter(c => c.kind === 'vista');
  check(vist.length === 1 && vist[0].id.indexOf('v3') >= 0, 'an unseen vista near (a seen one is not offered)');
  // the pick: the unprompted window and the asked one; no id twice
  const cands = [{ id: 'a', kind: 'balloon', w: 2, eta: 40 }, { id: 'b', kind: 'golden', w: 3, eta: 100 }, { id: 'c', kind: 'aurora', w: 3, eta: 600 }, { id: 'd', kind: 'murm', w: 3, eta: 5 }];
  const said = new Set();
  const p1 = F.pickWow(cands, said, 'auto');
  check(!!p1 && p1.id === 'b', `unprompted: only weight ≥ 3 between 15 and 180 s (picked ${p1 && p1.id})`);
  said.add('b');
  check(F.pickWow(cands, said, 'auto') === null, 'the same one is not told twice');
  const p2 = F.pickWow(cands, said, 'ask');
  check(!!p2 && (p2.id === 'd' || p2.id === 'a'), `asked: the best within five minutes (${p2 && p2.id})`);
  check(!F.pickWow([{ id: 'x', kind: 'golden', w: 3, eta: 400 }], new Set(), 'ask'), 'asked: nothing beyond five minutes');
}

// ---------------------------------------------------------------- d · the phrases
{
  check(F.dist(338, 'de') === '340 m' && F.dist(1234, 'de') === '1,2 km' && F.dist(1234, 'en') === '1.2 km' && F.dist(7, 'de') === '7 m' && F.dist(25600, 'en') === '26 km', `distances: ${F.dist(338, 'de')} · ${F.dist(1234, 'de')} · ${F.dist(1234, 'en')} · ${F.dist(7, 'de')} · ${F.dist(25600, 'en')}`);
  const w = (s) => F.whenKey(s)[0];
  check(w(3) === 'g.funke.when.now' && w(30) === 'g.funke.when.soon' && w(80) === 'g.funke.when.min1' && w(130) === 'g.funke.when.min2' && w(250) === 'g.funke.when.minN' && F.whenKey(250)[1].n === 4, 'the when-words: now · soon · in a minute · in two minutes · in n minutes');
}

// ---------------------------------------------------------------- e · the spring
{
  const S = F.springState([0, 0, 0]);
  let t = 0, settled = -1, over = 0;
  const target = [3, 1, 0];
  while (t < 3) { F.spring(S, target, 1 / 60, 6, 10); t += 1 / 60; const d = Math.hypot(S.p[0] - 3, S.p[1] - 1, S.p[2]); if (settled < 0 && d < 0.05 * Math.hypot(3, 1)) settled = t; over = Math.max(over, S.p[0] - 3); }
  check(settled > 0 && settled < 1.2 && over < 0.08 * 3, `the spring settles in ${settled.toFixed(2)} s, overshoot ${(over / 3 * 100).toFixed(1)} %`);
  const S2 = F.springState([0, 0, 0]); for (let i = 0; i < 50; i++) F.spring(S2, [5, 0, 0], 0.1, 9, 10);
  check(Number.isFinite(S2.p[0]) && Math.abs(S2.p[0] - 5) < 0.01, 'stable at dt 0.1 (a slow frame)');
  const S3 = F.springState([0, 0, 0]); F.spring(S3, [8, 0, 0], 1 / 60, 6, 2.6);
  check(Math.hypot(S3.p[0] - 8, S3.p[1], S3.p[2]) <= 2.6 + 1e-6, 'the lag is clamped (2.6 m behind at most)');
  const S4 = F.springState([0, 0, 0]); F.spring(S4, [100, 0, 0], 1 / 60, 6, 2.6);
  check(S4.snapped === true && S4.p[0] === 100, 'a teleport (> 24 m): it snaps to its place');
}

// ---------------------------------------------------------------- f · the lines in both tables
{
  const I = V.I18N, en = I.dict.en, de = I.dict.de;
  const keys = F.KEYS;
  check(Array.isArray(keys) && keys.length >= 40, `the line keys Funke uses (${keys.length})`);
  const missing = keys.filter(k => !(k in en) || !(k in de));
  check(!missing.length, 'every key in both tables' + (missing.length ? ': ' + missing.join(', ') : ''));
  const ph = (v) => { const s = new Set(); for (const x of (Array.isArray(v) ? v : [v])) for (const m of String(x).matchAll(/\{(\w+)\}/g)) s.add(m[1]); return [...s].sort().join(','); };
  const bad = keys.filter(k => k in en && k in de && (ph(en[k]) !== ph(de[k]) || Array.isArray(en[k]) !== Array.isArray(de[k]) || (Array.isArray(de[k]) && !de[k].length)));
  check(!bad.length, 'the same placeholders and lists in both languages' + (bad.length ? ': ' + bad.join(', ') : ''));
  const long = keys.filter(k => k.startsWith('g.funke.') && k in de && (Array.isArray(de[k]) ? de[k] : [de[k]]).some(s => String(s).length > 110));
  check(!long.length, 'Funke\'s lines are short (≤ 110 characters)' + (long.length ? ': ' + long.join(', ') : ''));
  I.lang = 'de';
  const l1 = F.say('way', { name: 'Nova Haven', d: F.dist(340, 'de') }, 0);
  I.lang = 'en';
  const l2 = F.say('way', { name: 'Nova Haven', d: F.dist(340, 'en') }, 0);
  I.lang = 'de';
  check(/Nova Haven/.test(l1) && /340 m/.test(l1) && l1 !== l2 && /Nova Haven/.test(l2), `a line in both languages: „${l1}" · “${l2}”`);
}

// ---------------------------------------------------------------- g · the scan
{
  const R = V.R, M = F.scanMarks(R);
  const st = (n) => R.byName[n].defaultState;
  check(M.mark[st('chest')] === M.CHEST && M.mark[st('barrel')] === M.CHEST && M.mark[st('iron_ore')] > M.CHEST && M.mark[st('gold_ore')] > M.CHEST, 'the marks: chests and barrels, the ores');
  check(!M.mark[st('stone')] && !M.mark[st('dirt')] && !M.mark[st('oak_planks')] && !M.mark[st('grass_block')], 'nothing else (stone, dirt, planks, grass)');
  // a stand-in world: stone below y 60, a chest at (5, 64, 3), iron at (−10, 50, 7) and (20, 40, −2), gold far away
  const cols = new Map();
  const col = (cx, cz) => { const k = cx + ',' + cz; let c = cols.get(k); if (!c) { c = { cx, cz, H: 256, ready: true, blocks: new Uint16Array(256 * 256) }; for (let y = 0; y < 60; y++) for (let i = 0; i < 256; i++) c.blocks[(y << 8) | i] = st('stone'); cols.set(k, c); } return c; };
  const put = (x, y, z, s) => { const c = col(x >> 4, z >> 4); c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)] = s; };
  for (let cz = -4; cz <= 4; cz++) for (let cx = -4; cx <= 4; cx++) col(cx, cz);
  put(5, 64, 3, st('chest')); put(-10, 50, 7, st('iron_ore')); put(20, 40, -2, st('iron_ore')); put(60, 50, 0, st('gold_ore'));
  for (let i = 0; i < 300; i++) put(-10 + (i % 20), 50 + ((i / 20) | 0), -20, st('coal_ore'));   // a big coal seam, all in reach (beyond the cap)
  const world = { col: (cx, cz) => cols.get(cx + ',' + cz) || null };
  const sc = new F.Scan(world, M, [0, 64, 0], 32);
  let steps = 0; while (!sc.done && steps < 200) { sc.step(2); steps++; }
  const f = sc.result();
  check(sc.done && steps > 3, `the scan runs in steps (${steps} steps of two columns)`);
  check(f.counts.chest === 1 && f.counts.iron === 2 && !f.counts.gold, `found: ${JSON.stringify(f.counts)} (the gold 60 blocks away is out of reach)`);
  check(f.list.length === F.SCAN_MAX && f.list[0].kind === 'chest', `chests first, at most ${F.SCAN_MAX} boxes (${f.list.length} of ${sc.found.length})`);
  // (run 1: „3× Truhe · 170× Kohle · 152× Kupfer · 4× Eisen" — blocks counted, the coal seams crowding out the diamond)
  check(f.veins && f.veins.chest === 1 && f.veins.iron === 2 && f.veins.coal === 1 && f.counts.coal > 50, `the line counts the finds, not the blocks: ${JSON.stringify(f.veins)} (one coal seam of ${f.counts.coal} blocks = 1)`);
  const rank = (k) => F.SCAN_RANK.indexOf(k);
  let byRank = true, near = true;
  for (let i = 1; i < f.list.length; i++) { const a = f.list[i - 1], b = f.list[i]; if (rank(b.kind) < rank(a.kind)) byRank = false; if (a.kind === b.kind && b.d2 < a.d2) near = false; }
  check(byRank && near && f.list[1].kind === 'iron', `the boxes: the rare first (chest, iron before coal), then the nearest of each kind (${f.list.slice(0, 4).map(q => q.kind).join(', ')} …)`);
  check(F.scanOrder({ chest: 2, coal: 9, copper: 7, iron: 1, diamond: 1 }).join(',') === 'chest,diamond,iron,copper,coal', `the line names the rare first: ${F.scanOrder({ chest: 2, coal: 9, copper: 7, iron: 1, diamond: 1 }).join(', ')}`);
}

// ---------------------------------------------------------------- h · the hooks
{
  const n = (f) => (fs.readFileSync(path.join(ROOT, f), 'utf8').match(/\/\/ e-funke/g) || []).length;
  const want = { 'build.js': 1, 'src/main/game.js': 3, 'src/main/renderer.js': 2, 'src/main/photomode.js': 1, 'src/main/lang_de.js': 1, 'src/main/lang_en.js': 1 };
  const got = Object.keys(want).map(f => [f, n(f)]);
  check(got.every(([f, c]) => c >= want[f]), 'the hooks: ' + got.map(([f, c]) => f.replace('src/main/', '') + ' ' + c).join(' · '));
}

// ---------------------------------------------------------------- i · the actor in a stand-in game
{
  const solid = new Set();   // "x,y,z" cells that are solid
  const stone = V.R.byName.stone.defaultState;
  const world = { getBlock: (x, y, z) => (solid.has(x + ',' + y + ',' + z) || y < 64 ? stone : 0), getLight: () => 0xf000, col: () => null, topAt: () => 63 };
  const player = { pos: [0.5, 64, 0.5], vel: [0, 0, 0], yaw: 0, pitch: 0, eye: 1.62, mode: 'creative', spawn: [0.5, 64, 0.5], eyePos() { return [this.pos[0], this.pos[1] + this.eye, this.pos[2]]; }, lookDir() { return [-Math.sin(this.yaw), 0, -Math.cos(this.yaw)]; } };
  const lines = [];
  const g = { state: 'play', time: 0, frame: 0, player, world, settings: { funke: true, preset: 'potato' }, camMode: 0, meta: { seed: 4242, vgen: 11 }, dim: 'overworld',
    env: { timeOfDay: 6000, day: 0, ticks: 6000, E: { sunDir: [0, 1, 0] }, wx: { seed: 1 } }, input: { mouse: { down: [false, false, false] }, captured: true, down: () => false, hit: () => false }, ui: { screen: null, blocking: false, typing: false, chatLine: (s) => lines.push(s) },
    cam: { x: 0.5, y: 65.62, z: 0.5, yaw: 0, pitch: 0, fov: 1.2 } };
  const A = new F.Actor(g);
  A.out = (text) => lines.push(text);   // (no DOM: the line goes here)
  const step = (n, dt) => { for (let i = 0; i < n; i++) { g.time += dt; g.frame++; g.cam.x = player.pos[0]; g.cam.y = player.pos[1] + 1.62; g.cam.z = player.pos[2]; g.cam.yaw = player.yaw; A.update(dt); } };
  step(60, 1 / 60);
  const P = A.pos, an = A.anchor;
  check(Math.hypot(P[0] - an[0], P[1] - an[1], P[2] - an[2]) < 0.3 && P[1] > 64.9 && P[1] < 66.2, `it hovers at the shoulder (${P.map(v => v.toFixed(2)).join(', ')})`);
  // walk east at 4.3 m/s, then turn: it lags, banks and catches up
  let maxRoll = 0;
  for (let i = 0; i < 120; i++) { player.pos[0] += 4.3 / 60; player.yaw = i > 60 ? -Math.PI / 2 + (i - 60) * 0.03 : -Math.PI / 2; step(1, 1 / 60); maxRoll = Math.max(maxRoll, Math.abs(A.roll)); }
  check(maxRoll > 0.05 && maxRoll <= 0.61, `it banks into the turn (roll up to ${maxRoll.toFixed(2)} rad)`);
  check(Math.hypot(A.pos[0] - A.anchor[0], A.pos[2] - A.anchor[2]) < 2.7, 'and keeps within its lag');
  // a wall at the right shoulder: it lifts over / moves to the other side
  player.pos = [0.5, 64, 0.5]; player.yaw = 0; step(90, 1 / 60);
  const ax = Math.floor(A.anchor[0]), ay = Math.floor(A.anchor[1]), az = Math.floor(A.anchor[2]);
  for (let y = 64; y < 70; y++) for (let dz = -1; dz <= 1; dz++) solid.add(ax + ',' + y + ',' + (az + dz));
  step(90, 1 / 60);
  const cell = Math.floor(A.anchor[0]) + ',' + Math.floor(A.anchor[1]) + ',' + Math.floor(A.anchor[2]);
  check(!solid.has(cell), `a wall at its shoulder: it moves to a free spot (${A.anchor.map(v => v.toFixed(1)).join(', ')})`);
  solid.clear();
  // the way and the scan run and end
  A.way({ pos: [0.5, 64, -200.5], name: 'Teststadt', kind: 'test' }, true);
  step(30, 1 / 30);
  check(A.wayT > 0 && A.wayPts > 4, `the way: a line of ${A.wayPts} points`);
  step(150, 1 / 30);
  check(A.wayT === 0, 'the way ends after 4 s');
  check(lines.some(s => /Teststadt/.test(s)), `the way says where: „${lines.filter(s => /Teststadt/.test(s))[0] || '—'}"`);
  // (run 1: the ribbon began where the drone had been — behind the camera — and swept past it; a target behind: the
  // drone flew behind the player, out of the first-person view)
  {
    const fw = (yaw) => [-Math.sin(yaw), -Math.cos(yaw)], rt = (yaw) => [Math.cos(yaw), -Math.sin(yaw)];
    const rib = () => { const out = []; for (let i = 0; i < A.wayPts; i++) out.push([A.wayO[0] + A.wayP[i * 3], A.wayO[1] + A.wayP[i * 3 + 1], A.wayO[2] + A.wayP[i * 3 + 2]]); return out; };
    const camD = (q) => Math.hypot(q[0] - g.cam.x, q[1] - g.cam.y, q[2] - g.cam.z);
    // a target ahead (yaw 0: −z): the drone ahead, the ribbon from it away from the eye
    player.pos = [0.5, 64, 0.5]; player.yaw = 0; step(40, 1 / 30);
    A.pos[0] += 6; A.pos[2] += 5;   // (the drone somewhere else when it is asked: the ribbon must not start there)
    A.wayT = 0; A.way({ pos: [10.5, 64, -150.5], name: 'Vorne', kind: 'test' }, true); step(2, 1 / 30);
    let R1 = rib(), f = fw(0);
    const o1 = [A.wayO[0] - A.anchor[0], A.wayO[2] - A.anchor[2]];
    check(Math.hypot(o1[0], o1[1]) < 0.6, `the ribbon starts at the drone's place, not where it was (${Math.hypot(o1[0], o1[1]).toFixed(2)} m)`);
    let rec = true; for (let i = 1; i < R1.length; i++) if (camD(R1[i]) < camD(R1[i - 1]) - 0.05) rec = false;
    const ahead1 = (A.anchor[0] - g.cam.x) * f[0] + (A.anchor[2] - g.cam.z) * f[1];
    check(rec && ahead1 > 1 && camD(R1[0]) > 1, `a target ahead: the drone ${ahead1.toFixed(2)} m ahead, the ribbon runs away from the eye (${camD(R1[0]).toFixed(1)} → ${camD(R1[R1.length - 1]).toFixed(1)} m)`);
    // (run 2: at 1.25 m over the ground the line ran 0.4 m under the eye — seen edge-on, hidden behind the drone; a path of
    // light low over the ground is seen from above)
    const hi = R1.slice(3).map(q => q[1] - 64), dip = (q) => Math.atan2(g.cam.y - q[1], Math.hypot(q[0] - g.cam.x, q[2] - g.cam.z)) * 180 / Math.PI;
    const at20 = R1.find(q => Math.hypot(q[0] - g.cam.x, q[2] - g.cam.z) >= 20);
    check(Math.min(...hi) >= 0.35 && Math.max(...hi) <= 0.8 && at20 && dip(at20) >= 2.5, `the line runs low over the ground (${Math.min(...hi).toFixed(2)}–${Math.max(...hi).toFixed(2)} m), seen from above (${at20 ? dip(at20).toFixed(1) : '—'}° under the eye at 20 m)`);
    step(140, 1 / 30);
    // a target behind on the left: the drone peeks in on the left, the ribbon starts beside it and bends round
    A.wayT = 0; A.way({ pos: [-60.5, 64, 120.5], name: 'Hinten', kind: 'test' }, true); step(20, 1 / 30);
    R1 = rib(); f = fw(0); const r = rt(0);
    const fa = (A.anchor[0] - g.cam.x) * f[0] + (A.anchor[2] - g.cam.z) * f[1], la = (A.anchor[0] - g.cam.x) * r[0] + (A.anchor[2] - g.cam.z) * r[1];
    check(fa > 1 && la < -0.4, `a target behind on the left: the drone stays in view on the left (${fa.toFixed(2)} m ahead, ${la.toFixed(2)} m to the side)`);
    let minD = 1e9; for (const q of R1) minD = Math.min(minD, camD(q));
    const tg = [-60.5, 120.5], dT = (q) => Math.hypot(q[0] - tg[0], q[2] - tg[1]);
    check(minD > 1.2 && dT(R1[R1.length - 1]) < dT(R1[0]) - 10, `the ribbon never passes the eye (nearest ${minD.toFixed(2)} m) and bends toward the target (${dT(R1[0]).toFixed(0)} → ${dT(R1[R1.length - 1]).toFixed(0)} m)`);
    step(140, 1 / 30);
    // the photo mode: it looks at the camera (it poses)
    g.photoCam = { on: true }; g.cam.x = A.pos[0] + 3; g.cam.z = A.pos[2]; A.yaw = 0;
    for (let i = 0; i < 60; i++) { g.time += 1 / 30; A.attitude(1 / 30, g.time); }
    const want = Math.atan2(-(g.cam.x - A.pos[0]), -(g.cam.z - A.pos[2]));
    check(Math.abs(Math.atan2(Math.sin(A.yaw - want), Math.cos(A.yaw - want))) < 0.15, `in the photo mode it turns to the camera (${A.yaw.toFixed(2)} → ${want.toFixed(2)} rad)`);
    g.photoCam = null;
  }
  // switched off: nothing
  g.settings.funke = false; const n0 = lines.length; A.way({ pos: [0, 64, -50], name: 'Aus', kind: 'test' }, true); step(30, 1 / 30);
  check(!A.visible && lines.length === n0, 'switched off: no drone and no line');
  g.settings.funke = true; step(10, 1 / 30);
  // nobody at the controls: no unprompted line (never talk to an empty room); a key → the greeting comes
  {
    const B = new F.Actor(g), heard = []; B.out = (s) => heard.push(s);
    for (let i = 0; i < 600; i++) { g.time += 1 / 30; B.update(1 / 30); }
    const quiet = heard.length;
    g.input.keys = new Set(['KeyW']); g.time += 1 / 30; B.update(1 / 30); g.input.keys = new Set();
    for (let i = 0; i < 90; i++) { g.time += 1 / 30; B.update(1 / 30); }
    check(quiet === 0 && heard.length === 1, `nobody at the controls for 20 s: ${quiet} lines; after a key: ${heard.length} („${heard[0] || '—'}")`);
    g.time += 100; for (let i = 0; i < 300; i++) { g.time += 1 / 30; B.update(1 / 30); }
    check(heard.length === 1, 'over a minute after the last input it is quiet again (the 90-s wait is over: only the absence keeps it quiet)');
  }
  // the next wow, unprompted: a ship lands at the apron every one to three minutes — told, but not every one (a kind waits
  // 10 minutes before it is news again)
  {
    const C = new F.Actor(g), heard = []; C.out = (s) => heard.push(s);
    g.padLife = { on: true, clock: 0, pads: new Map([['apron', { key: 'apron', seed: 5, x: player.pos[0] + 30, z: player.pos[2] }]]) };
    for (let i = 0; i < 1800; i++) { g.time += 0.5; g.padLife.clock += 0.5; C.inputT = g.time; C.update(0.5); }
    const ships = heard.filter(s => /Schiff/.test(s));
    check(ships.length >= 1 && ships.length <= 2, `15 minutes by the apron: ${ships.length} landing(s) told („${ships[0] || '—'}"), of ${Math.round(900 / 120)} or so`);
    g.padLife = null;
  }
  // the cost of a frame (CPU): the update over 20 000 frames walking about
  const t0 = process.cpuUsage(); const N = 20000;
  for (let i = 0; i < N; i++) { player.pos[0] = 0.5 + Math.sin(i / 300) * 20; player.pos[2] = 0.5 + Math.cos(i / 370) * 20; player.yaw = i / 500; g.time += 1 / 60; g.frame++; g.cam.x = player.pos[0]; g.cam.z = player.pos[2]; A.update(1 / 60); }
  const c = process.cpuUsage(t0), ms = (c.user + c.system) / 1000 / N;
  check(ms <= 0.02, `the update: ${(ms * 1000).toFixed(1)} µs a frame (≤ 20 µs; with its 1-Hz brain)`);
}

console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);
