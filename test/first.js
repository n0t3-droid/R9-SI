// Die erste Minute (t-first; plan docs/superpowers/plans/2026-10-16-t-first.md) — every rule a check, no browser:
//   1. the vista choice: a new world of seed 4242 opens on its highest-scoring wow vista (gen_vista.js's records), the
//      feet on the spur's walk (its paving under them, air for the body), facing the landmark; no wow vista → none
//   2. the clock: both golden hours (10800 in the evening, its mirror 1200 in the morning) put the sun 7.4° high —
//      t-light2's golden hour (light2.mjs: 10800) — and env.js agrees; the one whose sun is nearer the view is chosen
//   3. the clear first day: weather.js's clearUntil keeps day 0 clear for any seed, the schedule takes over on day 1
//   4. the loading screen: the phases of the needed sections (generated → meshed → uploaded → the far land), one
//      sentence each in both languages, the counts line, the bar's fraction, the rule that ends it
//   5. the arrival: the white veil 1 → 0 over 2 s, the sun's flare outlasting it, the hold, the swing handed to the wow
//      actor at its end, a key skips (no swing, the vista seen), the HUD fades in after the moment
//   6. the living title: the 60 s loop (periodic, smooth), the citadel in the picture, the low sun and the ringed giant in
//      the frame at the golden hour; Very Low a single still frame, the others at 30 fps at most
//   7. the photo mode: the file name, the glide at walking speed, the roll's limit, the time held and moved by [ ]
//   8. the lang keys of all of it in both tables, German first
//   bash test/wt_run.sh first.js 600        (SEED=… another world)
const DOM = require('./dom_stub.js');
const V = require('./load_shared.js');
global.performance = global.performance || require('perf_hooks').performance;
require('../src/main/i18n.js');
require('../src/main/lang_en.js');
require('../src/main/lang_de.js');
require('../src/main/settings_reg.js');
require('../src/main/skybodies.js');
require('../src/main/weather.js');
require('../src/main/env.js');
require('../src/main/klang.js');
require('../src/main/audio.js');
require('../src/main/wowmoment.js');
for (const f of ['first.js', 'titlescene.js', 'photomode.js']) { try { require('../src/main/' + f); } catch (e) { console.log('  (' + f + ': ' + e.message + ')'); } }
const FI = VR.First, TS = VR.TitleScene, PM = VR.PhotoMode, W = VR.WowMoment, I18N = VR.I18N;
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const DEG = Math.PI / 180, near = (a, b, e) => Math.abs(a - b) <= (e || 1e-9);
const mk0 = document.createElement; document.createElement = (t) => { const e = mk0(t); e.style = {}; return e; };
const app = document.createElement('div'); app.setAttribute('id', 'app'); DOM.body.appendChild(app);
const hudEl = document.createElement('div'); hudEl.setAttribute('id', 'hud'); DOM.body.appendChild(hudEl);
if (!FI || !TS || !PM) { console.log('  ✗ the modules: VR.First ' + !!FI + ' · VR.TitleScene ' + !!TS + ' · VR.PhotoMode ' + !!PM); console.log('FAILED 1'); process.exit(1); }
const SEED = +(process.env.SEED || 4242);
const angle = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const fwd = (yaw, pitch) => [-Math.sin(yaw) * Math.cos(pitch || 0), Math.sin(pitch || 0), -Math.cos(yaw) * Math.cos(pitch || 0)];
const yawTo = (dx, dz) => Math.atan2(-dx, -dz);

// ---------------------------------------------------------------- 1 · the vista choice
console.log('1 · the vista choice');
const R = V.R, F = V.F, nameOf = (s) => (s ? R.types[R.T.type[s]].name : 'air');
const g = V.makeGen('overworld', SEED, { vgen: 11 });
const P = V.Land.plan(g);
const list = P.vistas.map(v => ({ id: v.id, x: v.x, y: v.y, z: v.z, u: v.u, eye: v.eye, yaw: v.yaw, pitch: v.pitch, fov: v.fov, lm: v.lm, wow: !!v.wow, score: v.score, aim: v.aim, d: v.d }));
const wows = list.filter(v => v.wow).sort((a, b) => b.score - a.score);
const pick = FI.pick(list);
check(!!pick && wows.length > 0 && pick.id === wows[0].id, `the highest-scoring wow vista is chosen (${pick ? pick.id + ' ' + pick.lm + ' score ' + pick.score : 'none'}; ${wows.length} wow vistas of ${list.length}, the best ${wows[0] ? wows[0].id + ' ' + wows[0].score : '—'})`);
check(FI.pick(list.filter(v => !v.wow)) === null && FI.pick([]) === null && FI.pick(null) === null, 'no wow vista (or none at all) → no vista spawn (the old spawn)');
check(FI.pick(list.map((v, i) => Object.assign({}, v, { score: i === 3 ? 99 : v.score, wow: i === 3 ? true : v.wow }))).id === list[3].id, 'the score decides, not the order of the list');
if (pick) {
  const [fx, fy, fz] = FI.feet(pick), CH = new Map();
  const blockAt = (x, y, z) => { x = Math.floor(x); y = Math.floor(y); z = Math.floor(z); const k = (x >> 4) + ',' + (z >> 4); let c = CH.get(k); if (!c) { c = g.generate(x >> 4, z >> 4); CH.set(k, c); } return c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)]; };
  const under = nameOf(blockAt(fx, fy - 1, fz)), body = [blockAt(fx, fy, fz), blockAt(fx, fy + 1, fz)];
  const solid = (s) => !!(s && (R.T.flags[s] & F.SOLID));
  check(/flagstone|floor_plaza/.test(under) && !solid(body[0]) && !solid(body[1]), `the feet stand on the spur's walk: ${under} under them at (${fx.toFixed(1)}, ${fy}, ${fz.toFixed(1)}), ${nameOf(body[0])} / ${nameOf(body[1])} for the body`);
  const dWay = Math.hypot(fx - (pick.x + 0.5), fz - (pick.z + 0.5));
  check(dWay <= W.REACH && dWay >= 1, `the feet are ${dWay.toFixed(2)} blocks out on the walk — within the wow trigger's reach (${W.REACH})`);
  const toAim = yawTo(pick.aim[0] - fx, pick.aim[2] - fz);
  check(Math.abs(angle(pick.yaw - toAim)) < 6 * DEG, `the view faces the landmark (${pick.lm}: ${(Math.abs(angle(pick.yaw - toAim)) / DEG).toFixed(1)}° off the line to its top)`);
  const sp = FI.spawn(pick);
  check(sp && near(sp.pos[0], fx) && near(sp.pos[2], fz) && sp.yaw === pick.yaw && sp.pitch === pick.pitch && sp.vista === pick, 'the spawn record: the feet, the composition\'s yaw and pitch, the vista for the arrival');
}
{
  const g10 = V.makeGen('overworld', SEED, { vgen: 10 });
  check(!V.Vista.on(g10) && FI.pick([]) === null, 'a vgen-10 world has no vistas: the old spawn');
}

// ---------------------------------------------------------------- 2 · the clock
console.log('2 · the clock: the golden hour');
const elev = (tod) => Math.asin(FI.sunAt(tod)[1]) / DEG;
check(FI.GOLD === 10800 && FI.GOLD_AM === 1200, `the two golden hours: ${FI.GOLD} (light2.mjs's golden) and its morning mirror ${FI.GOLD_AM}`);
check(near(elev(FI.GOLD), elev(FI.GOLD_AM), 0.01) && elev(FI.GOLD) > 6.5 && elev(FI.GOLD) < 8.5, `both put the sun ${elev(FI.GOLD).toFixed(2)}° high (t-light2's golden hour: ~7°)`);
{
  const E = new VR.Env(); E.wx.setSeed(7);
  E.setTime(FI.GOLD); const e1 = E.update(0.016, { dim: 'overworld', freezeTime: true, freezeWeather: true });
  const s1 = FI.sunAt(FI.GOLD);
  check(near(e1.sunDir[0], s1[0], 1e-6) && near(e1.sunDir[1], s1[1], 1e-6) && near(e1.sunDir[2], s1[2], 1e-6), 'env.js puts the sun where first.js reckons it');
  E.setTime(FI.GOLD_AM); const e2 = E.update(0.016, { dim: 'overworld', freezeTime: true, freezeWeather: true });
  const warm = (E2) => E2.sunColor[0] / Math.max(1e-6, E2.sunColor[2]);
  check(near(warm(e1), warm(e2), 1e-6) && warm(e1) > 1.8, `the light is the same warm gold at both (sun red/blue ${warm(e1).toFixed(2)})`);
}
const yawSun = (tod) => { const s = FI.sunAt(tod); return yawTo(s[0], s[2]); };
check(FI.clock(yawSun(FI.GOLD)) === FI.GOLD && FI.clock(yawSun(FI.GOLD_AM)) === FI.GOLD_AM, 'looking toward the evening sun → 10800; toward the morning sun → 1200');
check(FI.clock(yawSun(FI.GOLD) + 0.4) === FI.GOLD && FI.clock(yawSun(FI.GOLD_AM) - 0.4) === FI.GOLD_AM, 'the nearer sun wins');
if (pick) {
  const tod = FI.clock(pick.yaw), off = Math.abs(angle(pick.yaw - yawSun(tod))) / DEG;
  console.log(`     ${pick.id} looks along ${(pick.yaw / DEG).toFixed(1)}°: the clock ${tod}, the sun ${off.toFixed(1)}° beside the view's middle`);
  check(off <= Math.abs(angle(pick.yaw - yawSun(tod === FI.GOLD ? FI.GOLD_AM : FI.GOLD))) / DEG, 'the chosen hour\'s sun is the nearer of the two to the picture');
}

// ---------------------------------------------------------------- 3 · the clear first day
console.log('3 · the clear first day');
{
  let bad = 0, n = 0, later = 0, cloudyLater = 0;
  for (const seed of [1, 7, 42, 4242, 424242, 99991, 123457, 31337]) {
    const w = new VR.Weather(); w.setSeed(seed); w.clearUntil = FI.clearUntil(0);
    for (let t = 0; t < 24000; t += 300) { w.update(0.5, { ticks: t, day: 0, biome: VR.biomeByKey('plains'), dim: 'overworld' }); n++; if (w.kind !== 'klar' || w.front > 0.001) bad++; }
    for (let d = 1; d <= 6; d++) for (let t = 0; t < 24000; t += 1200) { w.update(0.5, { ticks: t, day: d, biome: VR.biomeByKey('plains'), dim: 'overworld' }); later++; if (w.kind !== 'klar') cloudyLater++; }
  }
  check(bad === 0, `day 0 is clear in every sample of 8 seeds (${n - bad} of ${n}), no storm front`);
  check(cloudyLater > 0, `from day 1 the world's own weather comes back (${cloudyLater} of ${later} samples not clear)`);
  const w = new VR.Weather(); w.clearUntil = 24000; w.setSeed(5);
  check(!(w.clearUntil > 0), 'a new seed (another world) clears clearUntil');
  check(FI.clearUntil(0) === 24000 && FI.clearUntil(2) === 72000, 'clear until the end of the start day');
}

// ---------------------------------------------------------------- 4 · the loading screen
console.log('4 · the loading screen');
{
  const keys = ['g.load.p.gen', 'g.load.p.mesh', 'g.load.p.up', 'g.load.p.far'];
  const ph = (gen, mesh, up, far) => FI.phaseKey({ gen, mesh, up, far });
  check(ph(0.3, 0.1, 0, 0) === keys[0] && ph(1, 0.4, 0.2, 0) === keys[1] && ph(1, 1, 0.5, 0.5) === keys[2] && ph(1, 1, 1, 0.3) === keys[3] && ph(1, 1, 1, 1) === keys[3], 'the phase is the first one not done: generated → meshed → uploaded → the far land');
  I18N.lang = 'de';
  const de = keys.map(k => I18N.t(k));
  check(de[0] === 'Die Hügel werden geformt …' && de[1] === 'Die Stadt wird gebaut …' && de[2] === 'Das Licht wird gesetzt …' && /Ferne/.test(de[3]), 'German first: ' + de.join(' · '));
  I18N.lang = 'en';
  const en = keys.map(k => I18N.t(k));
  check(en.every((s, i) => s && s !== keys[i] && s !== de[i]), 'English: ' + en.join(' · '));
  const c = { cols: 25, colsNeed: 25, secMesh: 96, secUp: 80, secNeed: 140 };
  I18N.lang = 'de'; const cde = FI.countsText(c); I18N.lang = 'en'; const cen = FI.countsText(c); I18N.lang = 'de';
  check(/25\/25/.test(cde) && /96\/140/.test(cde) && /80\/140/.test(cde) && /Erzeugt/.test(cde) && /Generated/.test(cen), `the counts line: „${cde}" / "${cen}"`);
  let mono = true, last = -1; for (let k = 0; k <= 40; k++) { const t = k / 40, f = FI.loadFrac({ gen: Math.min(1, t * 3), mesh: Math.min(1, t * 2), up: Math.min(1, t * 1.5), far: t }); if (f < last - 1e-9) mono = false; last = f; }
  check(mono && near(FI.loadFrac({ gen: 0, mesh: 0, up: 0, far: 0 }), 0) && near(FI.loadFrac({ gen: 1, mesh: 1, up: 1, far: 1 }), 1), 'the bar runs from 0 to 1 and never back');
  // the progress from a world: 5 × 5 columns round the spawn, sections with blocks counted
  const mkCol = (secs) => ({ ready: true, sec: secs.map(([count, dirty, pending, meshed]) => ({ count, dirty, pending, meshed })) });
  const cols = new Map(), world = { col: (cx, cz) => cols.get(cx + ',' + cz) || null };
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if (dx > -2) cols.set(dx + ',' + dz, mkCol([[4096, false, false, true], [100, false, false, dx < 1], [0, false, false, true], [50, dx === 2, false, false]]));
  const pr = FI.progress(world, 0, 0, 2);
  check(pr.colsNeed === 25 && pr.cols === 20 && near(pr.gen, 0.8), `generated: ${pr.cols} of ${pr.colsNeed} columns`);
  check(pr.secNeed === 20 * 3 + 5 * 3 && pr.secMesh === 20 * 3 - 5 && pr.secUp === 20 + 10 && pr.mesh < pr.gen && pr.up < pr.mesh, `meshed ${pr.secMesh} and uploaded ${pr.secUp} of ${pr.secNeed} sections with blocks (a missing column counts as the others' mean)`);
  check(!FI.loadDone({ near: false, far: 1, nearAt: 0, now: 1000, start: 0 }), 'not done while the near sections are not up');
  check(FI.loadDone({ near: true, far: 1, nearAt: 900, now: 1000, start: 0 }), 'done at once when the near sections and the far ring are up (never longer than the world needs)');
  check(!FI.loadDone({ near: true, far: 0.5, nearAt: 1000, now: 6000, start: 0 }) && FI.loadDone({ near: true, far: 0.5, nearAt: 1000, now: 7100, start: 0 }), 'the far ring gets 6 s after the near sections, not more');
  check(!FI.loadDone({ near: true, far: 0.5, nearAt: 1000, now: 9000, start: 0, arrival: true }) && FI.loadDone({ near: true, far: 0.5, nearAt: 1000, now: 13100, start: 0, arrival: true }), 'an arrival waits up to 12 s for the far ring (its landmark stands in the far tiles)');
  check(FI.loadDone({ near: false, far: 0, nearAt: 0, now: 25100, start: 0 }), '25 s at most in all');
}

// ---------------------------------------------------------------- 5 · the arrival
console.log('5 · the arrival');
{
  check(near(FI.veil(0), 1) && near(FI.veil(FI.PRE), 0) && FI.veil(FI.PRE * 0.5) > 0.2 && FI.veil(FI.PRE * 0.5) < 0.8, `the white veil 1 → 0 over ${FI.PRE} s (half-way ${FI.veil(FI.PRE * 0.5).toFixed(2)})`);
  let mono = true; for (let k = 1; k <= 50; k++) if (FI.veil(k * FI.PRE / 50) > FI.veil((k - 1) * FI.PRE / 50) + 1e-12) mono = false;
  check(mono, 'the veil only thins');
  check(FI.flare(FI.PRE) > 0.05 && near(FI.flare(FI.PRE + 0.6), 0) && FI.flare(0.4) >= FI.veil(0.4), 'the sun\'s flare outlasts the white by 0.6 s');
  // a game stub: the arrival holds, hands the vista to the wow actor after the veil, and the HUD comes back after the moment
  const mkGame = () => {
    const g0 = { state: 'play', settings: { wowMoments: true }, meta: { id: 'w1', wowSeen: [] }, ui: { screen: null }, hideHud: false, saveMeta() {}, env: { day: 0 }, audio: { swell() {} } };
    g0.input = { pressed: new Set(), mouse: { clicked: [false, false, false] }, padPressed: new Set(), tPressed: new Set() };
    g0.wow = new W.Actor(g0); g0.player = { pos: [10, 80, 10], dead: false };
    return g0;
  };
  const v = { id: 'v0', x: 10, y: 79, z: 12, eye: [10.5, 83.8, 12.5], yaw: 1, pitch: 0.05, fov: 46, lm: 'temple', wow: true };
  let G = mkGame(), A = new FI.Arrival(G, { vista: v, sun: null });
  G.arrival = A; A.begin();
  check(A.holds() && !!G.wow.active && W.seen(G.meta, 'v0') && hudEl.style.opacity === '0', 'it begins: the player held, the HUD transparent, the veil up — over the vista\'s picture (the wow moment from the first frame, the vista seen)');
  for (let i = 0; i < 60; i++) { G.wow.update(1 / 30); A.update(1 / 30); }
  check(!!G.wow.active && G.wow.active.id === 'v0' && A.phase === 'moment', `after the ${FI.PRE} s veil the moment goes on (t-vista's hold, swell and caption, then the way back to the eyes)`);
  for (let i = 0; i < 200; i++) { G.wow.update(1 / 30); A.update(1 / 30); }
  check(!G.wow.active && !A.holds() && hudEl.style.opacity === '1' && /opacity/.test(hudEl.style.transition || ''), 'after the moment the HUD fades in (opacity 0 → 1 with a transition)');
  // wow moments off: the veil alone (over the player's own eyes), the vista marked seen all the same
  G = mkGame(); G.settings.wowMoments = false; A = new FI.Arrival(G, { vista: v, sun: null }); G.arrival = A; A.begin();
  for (let i = 0; i < 90; i++) { G.wow.update(1 / 30); A.update(1 / 30); }
  check(!G.wow.active && !A.holds() && !G.arrival && G.hideHud === false && W.seen(G.meta, 'v0'), 'with „Wow-Momente" off the veil alone');
  // (run 1's pictures: the veil opened on the player's own eye — the spur's wall, the held block and the hand filled the
  // first picture — and then swung to the composition and back. Now the white rises over the loading screen, the veil opens
  // on the composition itself (the wow moment's camera, its caption coming as the white goes), then the camera eases down
  // into the player's eyes; the hand, the outline and the minimap stay away until the HUD fades in)
  check(near(FI.whiteIn(0), 0) && near(FI.whiteIn(FI.IN), 1) && FI.IN > 0.2 && FI.IN <= 0.6, `the white rises over the loading screen in ${FI.IN} s`);
  G = mkGame(); G.arrivalPending = { vista: v };
  let held = 0; for (let i = 0; i < 60 && FI.holdLoading(G, true, 1 / 30); i++) held++;
  check(!!G.arrival && G.arrival.phase === 'full' && held >= Math.floor(FI.IN * 30) - 1 && held <= Math.ceil(FI.IN * 30) + 1 && G.arrival.veilNow() === 1, `the loading screen stays while the white rises (${held} frames), then the world may open under it`);
  check(!FI.holdLoading(mkGame(), true, 1 / 30) && !FI.holdLoading(Object.assign(mkGame(), { arrivalPending: { vista: v } }), false, 1 / 30), 'no arrival, or the world not ready yet: nothing held');
  A = FI.arrive(G);
  check(A === G.arrival && A.phase === 'veil' && !!G.wow.active && G.wow.active.id === 'v0' && near(W.curve(G.wow.t), 1) && G.hideHud === true, 'the veil opens on the composition: the wow moment runs from the start, its camera at the picture (curve 1), the hand and the HUD away');
  let capMax = 0, pinned = true;
  for (let i = 0; i < Math.round(FI.PRE * 30) - 2; i++) { G.wow.update(1 / 30); A.update(1 / 30); if (A.veilNow() > 0.6) capMax = Math.max(capMax, +G.wow.dom.style.opacity); if (!near(W.curve(G.wow.t), 1)) pinned = false; }
  check(pinned && capMax <= 0.05, `the picture holds while the white thins (the caption under ${capMax.toFixed(2)} while the white is thick)`);
  for (let i = 0; i < 6; i++) { G.wow.update(1 / 30); A.update(1 / 30); }
  check(A.phase === 'moment' && +G.wow.dom.style.opacity > 0.9 && G.hideHud === true, `then the moment: the caption up (${G.wow.dom.style.opacity}), the hold and the camera's way down into the eyes`);
  for (let i = 0; i < 150 && G.arrival; i++) { G.wow.update(1 / 30); A.update(1 / 30); }
  check(!G.wow.active && !G.arrival && G.hideHud === false && hudEl.style.opacity === '1' && hudEl.style.visibility === 'visible', 'after it the hand and the HUD come back (fading in)');
  // a key while the white is thick: out in 0.3 s, the camera turns back from where it is
  G = mkGame(); G.arrivalPending = { vista: v }; while (FI.holdLoading(G, true, 1 / 30)); A = FI.arrive(G);
  G.wow.update(1 / 30); A.update(1 / 30); G.input.pressed.add('Space'); G.wow.update(1 / 30); A.update(1 / 30); G.input.pressed.clear();
  for (let i = 0; i < 12; i++) { G.wow.update(1 / 30); A.update(1 / 30); }
  check(!A.holds() && A.veilNow() === 0 && G.wow.t >= W.RISE + W.HOLD, 'a key during the veil: the white goes in 0.3 s and the camera falls back to the eyes at once');
  for (let i = 0; i < 90 && G.arrival; i++) { G.wow.update(1 / 30); A.update(1 / 30); }
  check(!G.arrival && G.hideHud === false, '… and the HUD comes back after it');
  // the sun on the screen (the flare's place) from the camera the veil opens on
  const cam0 = { yaw: 0.7, pitch: 0.05, fov: 60 * DEG };
  const ahead = FI.sunScreen(fwd(0.7, 0.05), cam0, 16 / 9), right = FI.sunScreen(fwd(0.7 - 20 * DEG, 0.05), cam0, 16 / 9), up = FI.sunScreen(fwd(0.7, 0.05 + 10 * DEG), cam0, 16 / 9);
  check(ahead && near(ahead[0], 0.5, 1e-9) && near(ahead[1], 0.5, 1e-9) && right && right[0] > 0.6 && near(right[1], 0.5, 0.01) && up && up[1] < 0.4 && FI.sunScreen(fwd(0.7 + Math.PI, 0), cam0, 16 / 9) === null, `the sun's place on the screen: ahead (0.50, 0.50), 20° right (${right ? right[0].toFixed(2) : '—'}), 10° up (y ${up ? up[1].toFixed(2) : '—'}), behind none`);
  // the loading screen's camera: the composition's for an arrival (the sky behind the loading screen is the sky the veil opens on)
  const pl = { pos: [10, 80, 10], eye: 1.62, yaw: 2, pitch: 0.1 };
  const lc = FI.loadCam({ arrivalPending: { vista: v }, settings: { wowMoments: true, fov: 75 }, player: pl }), lc2 = FI.loadCam({ settings: { fov: 75 }, player: pl });
  check(near(lc.x, v.eye[0]) && near(lc.y, v.eye[1]) && near(lc.yaw, v.yaw) && near(lc.fov, v.fov * DEG, 1e-9) && near(lc2.y, 81.62, 1e-9) && near(lc2.yaw, 2) && near(lc2.fov, 75 * DEG, 1e-9), 'the loading screen looks where the veil opens: the composition (an arrival) or the eyes');
}

// ---------------------------------------------------------------- 6 · the living title
console.log('6 · the living title');
{
  check(TS.LOOP === 60, 'the loop lasts 60 s');
  const c0 = TS.cam(0), c1 = TS.cam(TS.LOOP), cm = TS.cam(TS.LOOP * 0.37);
  check(near(c0.x, c1.x, 1e-6) && near(c0.y, c1.y, 1e-6) && near(c0.z, c1.z, 1e-6) && near(angle(c0.yaw - c1.yaw), 0, 1e-9) && near(c0.pitch, c1.pitch, 1e-9), 'it loops: the camera at 60 s is the camera at 0 s');
  let maxStep = 0, maxTurn = 0; for (let k = 1; k <= 1800; k++) { const a = TS.cam((k - 1) / 30), b = TS.cam(k / 30); maxStep = Math.max(maxStep, Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)); maxTurn = Math.max(maxTurn, Math.abs(angle(b.yaw - a.yaw)), Math.abs(b.pitch - a.pitch)); }
  check(maxStep < 0.4 && maxTurn < 0.004 && Math.hypot(cm.x - c0.x, cm.z - c0.z) > 10, `a slow drift (at most ${maxStep.toFixed(2)} blocks and ${(maxTurn / DEG).toFixed(3)}° a frame at 30 fps; ${Math.hypot(cm.x - c0.x, cm.z - c0.z).toFixed(0)} blocks across the loop)`);
  // in the picture: the citadel's spires; at the golden hour the low sun and the ringed giant
  const C = V.Heart.CITADEL, aspect = 16 / 9;
  const inFrame = (cam, d, marginX, marginY) => { const f = fwd(cam.yaw, cam.pitch), rx = [Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)], up = [rx[1] * f[2] - rx[2] * f[1], rx[2] * f[0] - rx[0] * f[2], rx[0] * f[1] - rx[1] * f[0]]; const z = d[0] * f[0] + d[1] * f[1] + d[2] * f[2]; if (z <= 0) return null; const th = Math.tan(cam.fov / 2), x = (d[0] * rx[0] + d[1] * rx[1] + d[2] * rx[2]) / z / (th * aspect), y = (d[0] * up[0] + d[1] * up[1] + d[2] * up[2]) / z / th; return Math.abs(x) <= 1 - (marginX || 0) && Math.abs(y) <= 1 - (marginY || 0) ? [x, y] : null; };
  const SB = VR.SkyBodies.atTicks(TS.TOD), sun = FI.sunAt(TS.TOD);
  // (first.mjs run 2: the citadel in the picture's middle stood behind the tiles and the buttons — the start screen hid
  // its own landmark. Now it stands in the right third, right of the tiles on a 1920-wide screen, its spires before the
  // low sun — a silhouette in the sun's glow, the sun peeking out beside them as the camera arcs — and the ringed giant
  // in the upper left beside the logo)
  const frac = (p) => [0.5 + p[0] / 2, 0.5 - p[1] / 2];
  let cit = 0, sunIn = 0, gasIn = 0, n = 0, sunBy = 0, minX = 1, maxX = 0, gasUL = 0, sunDx = [];
  for (let k = 0; k < 60; k++) {
    const cam = TS.cam(k), tip = [C.x - cam.x, 240 - cam.y, C.z - cam.z], foot = [C.x - cam.x, C.y + 4 - cam.y, C.z - cam.z];
    const pt = inFrame(cam, tip, 0.04, 0.04), pf = inFrame(cam, foot, 0.04, 0.04), ps = inFrame(cam, sun, 0.04, 0.04), pg = inFrame(cam, SB.giant, 0.04, 0.04);
    n++;
    if (pt && pf) { const a = frac(pt), b = frac(pf); minX = Math.min(minX, a[0], b[0]); maxX = Math.max(maxX, a[0], b[0]); if (a[0] >= 0.75 && b[0] >= 0.75 && a[0] <= 0.96 && b[0] <= 0.96) cit++; if (ps) { const s = frac(ps), dx = s[0] - (a[0] + b[0]) / 2; sunDx.push(dx); if (Math.abs(dx) <= 0.08 && s[1] > a[1] - 0.02) sunBy++; } }
    if (ps) sunIn++;
    if (pg) { gasIn++; const q = frac(pg); if (q[0] <= 0.4 && q[1] <= 0.3) gasUL++; }
  }
  check(TS.TOD === FI.GOLD, `the title's sky is the golden hour (${TS.TOD})`);
  check(cit === n, `the citadel's spires, foot to tip, stand in the right third all the loop — right of the tiles on a 1920-wide screen (x ${minX.toFixed(2)}–${maxX.toFixed(2)}; ${cit} of ${n} seconds)`);
  check(sunIn === n && gasIn === n && gasUL === n, `the low sun and the ringed giant are in the frame all the loop, the giant in the upper left (sun ${sunIn}, giant ${gasIn}, upper left ${gasUL} of ${n})`);
  check(sunBy === n && Math.min(...sunDx) < -0.005 && Math.max(...sunDx) > 0.02, `the sun stands by the spires all the loop — behind them, then peeking out beside them as the camera arcs (its offset ${Math.min(...sunDx).toFixed(3)} … ${Math.max(...sunDx).toFixed(3)} of the width)`);
  const cS = TS.cam(0);
  check(cS.y > 140 && cS.y < 220, `the camera flies over the Ember Canyon, ${cS.y.toFixed(0)} high (the mesas 92–106, the spire's tip 249)`);
  check(TS.mode({ preset: 'potato' }) === 'still' && TS.mode({ preset: 'low' }) === 'drift' && TS.mode({ preset: 'ultra' }) === 'drift', 'Very Low: one still frame of the sky; Low and up: the drift');
  check(TS.FPS === 30 && TS.due(0.02) === false && TS.due(1 / 30) === true, 'the drift at 30 fps at most (a frame after less than 1/30 s is skipped)');
  check(TS.genOpts().vgen === 11 && TS.genOpts().noLand === true && TS.SEED >>> 0 === TS.SEED, 'the title world: the Heartland of vgen 11 without the land plan (noLand), a fixed seed');
  const gT = V.makeGen('overworld', TS.SEED, TS.genOpts());
  check(!V.Land.on(gT) && !V.Vista.on(gT) && V.Heart.on(gT), 'with noLand the far tiles need no land plan (Land and Vista off, the Heartland on)');
}

// ---------------------------------------------------------------- 7 · the photo mode
console.log('7 · the photo mode');
{
  check(PM.fileName('Meine Welt', 3) === 'R9-SI-Meine-Welt-3.png', 'the file: ' + PM.fileName('Meine Welt', 3));
  check(PM.fileName('Schöne Größe', 1) === 'R9-SI-Schoene-Groesse-1.png' && PM.fileName('', 2) === 'R9-SI-Welt-2.png' && PM.fileName('a/b\\c:*?"<>|d', 4) === 'R9-SI-abcd-4.png', `umlauts spelled out, the empty name → Welt, no character a file system refuses (${PM.fileName('Schöne Größe', 1)})`);
  check(PM.fileName('x'.repeat(200), 12).length <= 60 && /^R9-SI-x+-12\.png$/.test(PM.fileName('x'.repeat(200), 12)), 'a long name is cut (' + PM.fileName('x'.repeat(200), 12).length + ' characters)');
  check(PM.SPEED === 4.3 && PM.FAST > 1, `the glide at walking speed (${PM.SPEED} blocks a second; Ctrl ×${PM.FAST})`);
  const st = PM.state({ x: 0, y: 70, z: 0, yaw: 0, pitch: 0 });
  for (let i = 0; i < 30; i++) PM.glide(st, { fw: 1, st: 0, up: 0, fast: false, roll: 0, time: 0 }, 1 / 30);
  check(near(Math.hypot(st.x, st.z), 4.3 * 1, 0.6) && st.z < 0, `one second of W: ${Math.hypot(st.x, st.z).toFixed(2)} blocks forward (eased in)`);
  for (let i = 0; i < 300; i++) PM.glide(st, { fw: 0, st: 0, up: 0, fast: false, roll: 1, time: 0 }, 1 / 30);
  check(near(st.roll, PM.ROLL, 1e-9) && near(PM.ROLL, 20 * DEG, 1e-9), `E rolls the camera to ${(st.roll / DEG).toFixed(1)}° and no further`);
  const t0 = PM.timeStep(10800, 1, 1), t1 = PM.timeStep(10800, -1, 1);
  check(t0 > 10800 && t1 < 10800 && near(t0 - 10800, PM.TIME_RATE, 1e-9) && PM.timeStep(23900, 1, 1) < 24000, `[ ] move the held time ${PM.TIME_RATE} ticks a second (wrapping at midnight)`);
  check(PM.SCALE === 2, 'the picture is saved at 2× the screen');
}

// ---------------------------------------------------------------- 8 · the lang keys
console.log('8 · the lang keys');
{
  const en = I18N.dict.en, de = I18N.dict.de;
  const keys = ['g.load.p.gen', 'g.load.p.mesh', 'g.load.p.up', 'g.load.p.far', 'g.load.counts', 'g.set.vistaStart', 'g.set.vistaStart.tip', 'g.photo.hint', 'g.photo.short', 'g.photo.saved', 'g.photo.fail', 'g.pause.photo'];
  const miss = keys.filter(k => !(k in en) || !(k in de));
  check(!miss.length, 'every new key in both tables' + (miss.length ? ': missing ' + miss.join(', ') : ''));
  check(/Aussichtspunkt/.test(de['g.set.vistaStart'] || '') && /F2|Klick/.test(de['g.photo.hint'] || ''), `German first: „${de['g.set.vistaStart']}", „${(de['g.photo.hint'] || '').slice(0, 60)} …"`);
  const S = VR.Settings, it = S && S.byKey ? S.byKey('vistaStart') : null;
  check(!!it && it.def === true && it.g === 'play', '⚙ Spiel → „Start auf dem Aussichtspunkt", on by default');
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
