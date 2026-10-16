// Wow-Momente (t-vista; plan docs/superpowers/plans/2026-10-15-t-vista.md, src/main/wowmoment.js) — every rule a check:
//   1. the easing: 0 → 1 → 0 in four seconds, held in the middle, monotone, no jolt at the ends (smootherstep); a skip
//      turns back from where the view stands; the push-in and the caption's fade
//   2. once per world: the first visit starts it, the vista is marked in the world's meta (saved at once), a second visit
//      does nothing, another world starts it again; the camera swings from the eye to the vista's picture and back
//      without a jump, the HUD hides and comes back, the caption names the place (German first)
//   3. the opt-out (⚙ Spiel → „Wow-Momente") and the rules: never with the switch off, for a guest, with guests in the
//      world, under a menu, the director, a vehicle, the Zeitraffer; GAP seconds between two; a key ends one early
//   4. the swell: four bars of klang.js's pentatonic plan rising to a held top note; audio.js plays it into the music bus
//      and the calm layer waits; silent at music volume 0
//   5. the cost: no vistas loaded — no work a frame; with vistas a look four times a second
//   6. the vistas of a vgen-11 world: every spur's spawn read from its chunk, from its start the right vista, the picture's
//      eye in the air and the swing's path from the walker's eye to it clear of blocks
//   bash test/wt_run.sh wowmoment.js 300        (SEED=… another world)
const DOM = require('./dom_stub.js');
const V = require('./load_shared.js');
require('../src/main/i18n.js');
require('../src/main/lang_en.js');
require('../src/main/lang_de.js');
require('../src/main/settings_reg.js');
require('../src/main/klang.js');
require('../src/main/audio.js');
require('../src/main/wowmoment.js');
const W = VR.WowMoment, K = VR.Klang, I18N = VR.I18N;
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const near = (a, b, e) => Math.abs(a - b) <= (e || 1e-9);
// the DOM stub's elements get a style record (the caption and the HUD)
const mk0 = document.createElement; document.createElement = (t) => { const e = mk0(t); e.style = {}; return e; };
const app = document.createElement('div'); app.setAttribute('id', 'app'); DOM.body.appendChild(app);
const hud = document.createElement('div'); hud.setAttribute('id', 'hud'); DOM.body.appendChild(hud);
if (!W) { console.log('VR.WowMoment missing'); console.log('FAILED 1'); process.exit(1); }

// ---------------------------------------------------------------- 1 · the easing
console.log('1 · the easing curve');
check(near(W.DUR, 4), `the moment lasts four seconds (rise ${W.RISE}, hold ${W.HOLD}, fall ${W.FALL})`);
check(W.curve(0) === 0 && W.curve(W.DUR) === 0 && W.curve(-1) === 0 && W.curve(9) === 0, 'the curve is 0 at the start, at the end and outside');
check(near(W.curve(W.RISE), 1) && near(W.curve(W.RISE + W.HOLD * 0.5), 1) && near(W.curve(W.RISE + W.HOLD - 1e-9), 1, 1e-6), 'the curve reaches 1 at the rise\'s end and holds it');
{
  let up = true, down = true, maxStep = 0;
  for (let t = 0; t < W.RISE; t += 0.001) { if (W.curve(t + 0.001) < W.curve(t) - 1e-12) up = false; maxStep = Math.max(maxStep, Math.abs(W.curve(t + 0.001) - W.curve(t))); }
  for (let t = W.RISE + W.HOLD; t < W.DUR; t += 0.001) { if (W.curve(t + 0.001) > W.curve(t) + 1e-12) down = false; maxStep = Math.max(maxStep, Math.abs(W.curve(t + 0.001) - W.curve(t))); }
  check(up && down, 'it rises monotonically and falls monotonically');
  check(maxStep < 0.0015, `no jump anywhere (the largest change in a millisecond ${maxStep.toFixed(5)})`);
  // the slope and the bend vanish at the four joints (smootherstep): no jolt when the swing starts, holds, turns back, ends
  const h = 1e-3, d1 = (t) => (W.curve(t + h) - W.curve(t - h)) / (2 * h);
  const joints = [h, W.RISE - h, W.RISE + W.HOLD + h, W.DUR - h];
  const slopes = joints.map(t => Math.abs(d1(t)));
  check(slopes.every(s => s < 0.01), `the slope at the joints is ~0 (${slopes.map(s => s.toFixed(4)).join(', ')})`);
  const peak = Math.max(...Array.from({ length: 400 }, (_, i) => Math.abs(d1(0.002 + i * (W.DUR - 0.004) / 400))));
  check(peak < 1.4, `the swing is gentle: at most ${peak.toFixed(2)} of the way per second (smootherstep over ${W.RISE} s)`);
}
// a skip in the rise turns back from where it stands; in the hold it starts the fall
{
  let worst = 0; for (let t = 0; t < W.RISE + W.HOLD; t += 0.01) { const t2 = W.skipTo(t); worst = Math.max(worst, Math.abs(W.curve(t2) - W.curve(t))); if (t2 < W.RISE + W.HOLD - 1e-9) worst = 9; }
  check(worst < 1e-9, `a key in the rise or hold jumps into the fall where the curve stands as high (largest difference ${worst.toExponential(1)})`);
  check(W.skipTo(W.RISE + W.HOLD + 0.3) === W.RISE + W.HOLD + 0.3, 'a key in the fall changes nothing');
}
check(W.drift(0) === 0 && near(W.drift(W.DUR), 1, 0.02) && W.drift(2) > W.drift(1.5) && W.drift(3) > W.drift(2), `the push-in drifts from 0 to 1 over the moment (${W.drift(1).toFixed(2)}, ${W.drift(2).toFixed(2)}, ${W.drift(3).toFixed(2)})`);
check(W.caption(0) === 0 && W.caption(0.4) === 0 && near(W.caption(2), 1) && W.caption(W.DUR) === 0 && W.caption(W.DUR - 0.34) === 0 && W.caption(W.DUR - 0.5) > 0, 'the caption comes in after half a second, stays and is gone a third of a second before the end');
{
  const a = { x: 0, y: 70, z: 0, yaw: 3.0, pitch: 0, fov: 1.3 }, b = { x: 4, y: 72, z: 2, yaw: -3.0, pitch: 0.2, fov: 1.08 }, o = {};
  W.blend(a, b, 0, 0.7, o); const at0 = near(o.x, a.x) && near(o.y, a.y) && near(o.yaw, a.yaw) && near(o.fov, a.fov);
  W.blend(a, b, 1, 0, o); const at1 = near(o.x, b.x) && near(o.z, b.z) && near(Math.cos(o.yaw), Math.cos(b.yaw)) && near(o.pitch, b.pitch);
  W.blend(a, b, 0.5, 0, o); const short = Math.abs(o.yaw - Math.PI) < 0.01;
  W.blend(a, b, 1, 1, o); const push = near(Math.hypot(o.x - b.x, o.y - b.y, o.z - b.z), 1, 1e-9) && o.y > b.y;
  check(at0 && at1 && short && push, 'the blend: the eye at 0, the picture at 1, the yaw the short way round (3.0 → −3.0 through π), the push along the look');
}

// ---------------------------------------------------------------- a game around the actor (no browser)
const VISTAS = [
  ['vista', 'v0', 100, 71, 50, 97.2, 73.82, 50.4, 1.3, 0.12, 62, 'temple'],
  ['vista', 'v1', 160, 71, 50, 163.1, 73.82, 49.6, -2.0, 0.08, 62, 'citadel'],
  ['vista', 'v2', 400, 64, 90, 402.0, 66.82, 87.0, 0.4, 0.05, 62, 'nonesuch'],
  ['windmill', 1, 2, 3], ['beacon', 5, 6, 7],
];
const mkGame = (o) => {
  const g = {
    settings: { wowMoments: true }, meta: { id: 'w1', name: 'Eins', vgen: 11 }, state: 'play', ui: { screen: null, blocking: false, typing: false },
    player: { pos: [0.5, 71, 0.5], dead: false },
    input: { pressed: new Set(), mouse: { clicked: [false, false, false] }, padPressed: new Set(), tPressed: new Set() },
    audio: { calls: [], swell(day, bar) { this.calls.push([day, bar]); return 21; } },
    env: { day: 3 }, hideHud: false, mp: null, saves: [],
    saveMeta() { this.saves.push(JSON.stringify(this.meta)); return Promise.resolve(); },
  };
  return Object.assign(g, o || {});
};
const baseCam = (g) => ({ x: g.player.pos[0], y: g.player.pos[1] + 1.62, z: g.player.pos[2], yaw: 0.2, pitch: -0.05, roll: 0.01, fov: 75 * Math.PI / 180, far: 900 });
// frames of 1/60 s; onCam(cam, actor) each frame a moment runs (the game: update, then the camera)
const run = (A, g, secs, onCam, each) => { const n = Math.round(secs * 60); for (let i = 0; i < n; i++) { if (each) each(i); A.update(1 / 60); if (A.active && onCam) onCam(A.cam(baseCam(g)), A); g.input.pressed.clear(); } };
const at = (g, id) => { const s = VISTAS.find(v => v[1] === id); g.player.pos = [s[2] + 0.5, s[3], s[4] + 0.5]; };
const away = (g) => { g.player.pos = [-500, 71, -500]; };

// ---------------------------------------------------------------- 2 · once per world
console.log('2 · once per world: the swing, the HUD, the caption, the seen state in the meta');
{
  const g = mkGame(), A = new W.Actor(g);
  A.absorb(VISTAS); A.absorb(VISTAS);
  check(A.list.size === 3, `the actor reads the 'vista' spawns of a column, each once (${A.list.size} of 3; the windmill and the beacon left alone)`);
  run(A, g, 2);
  check(!A.active && A.count === 0, 'far from every vista nothing happens');
  at(g, 'v0');
  let first = null, mid = null, last = null, n = 0, maxDp = 0, maxDy = 0, prev = null, capMax = 0, hidden = true, startedAt = -1, frame = 0;
  const cams = [];
  run(A, g, 0.3, (c) => { n++; if (startedAt < 0) startedAt = frame; if (!first) first = c; }, (i) => { frame = i; });
  check(A.active && A.active.id === 'v0', `standing at the vista's start, the moment begins within a quarter second (${A.active ? A.active.id : 'none'})`);
  check(!!first && near(first.x, baseCam(g).x) && near(first.yaw, 0.2) && first.fixed === true && first.roll === 0, 'its first frame is the eye\'s own view (no jump), the camera fixed');
  check(JSON.stringify(g.meta.wowSeen) === '["v0"]' && g.saves.length === 1 && JSON.parse(g.saves[0]).wowSeen[0] === 'v0', `the vista is marked in the world's meta and the meta saved at once (${JSON.stringify(g.meta.wowSeen)}, ${g.saves.length} save)`);
  check(g.audio.calls.length === 1 && g.audio.calls[0][0] === 3 && near(g.audio.calls[0][1], 1), `the swell sounds once, over the world's day, four bars of a second (${JSON.stringify(g.audio.calls)})`);
  check(g.hideHud === true && hud.style.visibility === 'hidden', 'the HUD hides');
  const capText = A.capText ? A.capText.textContent : '';
  check(!!A.dom && A.dom.style.display === 'block' && capText === 'Der Tor-Tempel', `the caption names the place in German first („${capText}")`);
  const v = A.active, look = [-Math.sin(v.yaw) * Math.cos(v.pitch), Math.sin(v.pitch), -Math.cos(v.yaw) * Math.cos(v.pitch)];
  run(A, g, 4.2, (c, a) => {
    n++; cams.push(c);
    if (prev) { maxDp = Math.max(maxDp, Math.hypot(c.x - prev.x, c.y - prev.y, c.z - prev.z)); let dy = c.yaw - prev.yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI; maxDy = Math.max(maxDy, Math.abs(dy)); }
    prev = c; last = c;
    if (!mid && a.t >= W.RISE + W.HOLD * 0.5) mid = { c, push: W.DRIFT * W.drift(a.e) };
    capMax = Math.max(capMax, +a.dom.style.opacity);
    if (g.hideHud !== true) hidden = false;
  });
  check(!A.active && A.count === 1, `the moment ends after four seconds (${(n / 60).toFixed(2)} s of frames)`);
  check(!!mid && near(Math.cos(mid.c.yaw), Math.cos(v.yaw), 1e-6) && near(Math.sin(mid.c.yaw), Math.sin(v.yaw), 1e-6) && near(mid.c.pitch, v.pitch, 1e-9) && near(mid.c.fov, 62 * Math.PI / 180, 1e-9), 'in the hold the view is the vista\'s picture: its yaw, pitch and 62° field of view');
  check(!!mid && near(mid.c.x, v.eye[0] + look[0] * mid.push, 1e-6) && near(mid.c.y, v.eye[1] + look[1] * mid.push, 1e-6) && near(mid.c.z, v.eye[2] + look[2] * mid.push, 1e-6) && mid.push > 0.1 && mid.push < W.DRIFT, `from the picture's eye, drifted ${mid ? mid.push.toFixed(2) : '?'} blocks in along the look`);
  check(maxDp < 0.12 && maxDy < 0.05, `the swing has no jump: at most ${maxDp.toFixed(3)} blocks and ${maxDy.toFixed(3)} rad a frame`);
  check(!!last && Math.hypot(last.x - baseCam(g).x, last.y - baseCam(g).y, last.z - baseCam(g).z) < 0.02 && Math.abs(last.yaw - 0.2) < 0.01, 'its last frame is back at the eye');
  check(hidden && g.hideHud === false && hud.style.visibility === 'visible', 'the HUD stayed hidden through it and is back after');
  check(capMax === 1 && A.dom.style.display === 'none', 'the caption was fully in and is gone after');
  check(A.cam(baseCam(g)) === null, 'after it the game\'s own camera again (cam() null)');
  // the second visit
  away(g); run(A, g, W.GAP + 1); at(g, 'v0'); run(A, g, 3);
  check(!A.active && A.count === 1 && g.audio.calls.length === 1, 'a second visit to the same vista does nothing');
  // the meta as saved and loaded: still seen
  const g2 = mkGame({ meta: JSON.parse(g.saves[0]) }), A2 = new W.Actor(g2); A2.absorb(VISTAS); at(g2, 'v0'); run(A2, g2, 2);
  check(!A2.active && A2.count === 0, 'the world saved and loaded again: still seen (meta.wowSeen)');
  // another world
  const g3 = mkGame({ meta: { id: 'w2', name: 'Zwei', vgen: 11 } }), A3 = new W.Actor(g3); A3.absorb(VISTAS); at(g3, 'v0'); run(A3, g3, 0.3);
  check(A3.active && A3.active.id === 'v0', 'another world: the same vista starts its moment again');
  // a quiet vista (its spawn's 13th field 0: the landmark too small from there for a wow — gen_vista.js) keeps its bench
  // and its view, but never swings the camera; a spawn without the field (12 fields) is a wow vista
  const QUIET = ['vista', 'vq', 700, 71, 50, 702.0, 73.82, 47.0, 0.4, 0.02, 46, 'temple', 0], LOUD = ['vista', 'vl', 760, 71, 50, 762.0, 73.82, 47.0, 0.4, 0.02, 46, 'temple', 1];
  const g4 = mkGame(), A4 = new W.Actor(g4); A4.absorb([QUIET, LOUD]);
  g4.player.pos = [700.5, 71, 50.5]; run(A4, g4, 1);
  const quiet = !A4.active && A4.count === 0 && !W.seen(g4.meta, 'vq');
  g4.player.pos = [760.5, 71, 50.5]; run(A4, g4, 0.5);
  check(quiet && A4.active && A4.active.id === 'vl' && A4.list.get('vq').wow === false && A3.list.get('v0').wow === true, `a quiet vista (the landmark too small from it) starts no moment and is not marked seen; a wow vista and one without the field do (${quiet ? 'quiet' : 'not quiet'}, ${A4.active ? A4.active.id : 'none'})`);
  A4.destroy(); A3.destroy(); A.destroy(); A2.destroy();
  // the caption in English, and for a landmark without its own name
  I18N.set('en'); const en = W.title('temple'), other = W.title('nonesuch'); I18N.set('de'); const de2 = W.title('nonesuch');
  check(en === 'The Gate Temple' && other === 'A View' && de2 === 'Aussicht', `the caption in English („${en}"), a landmark without a name: „${de2}" / „${other}"`);
  const DE = I18N.dict.de, EN = I18N.dict.en, keys = Object.keys(W.NAMES).map(k => 'g.wow.' + k).concat(['g.wow.view']);
  check(keys.every(k => DE[k] && EN[k]) && keys.every(k => DE[k] === W.NAMES[k.slice(6)]?.[0] || k === 'g.wow.view'), `every caption has its key in both language tables, German first (${keys.length} keys)`);
}

// ---------------------------------------------------------------- 3 · the opt-out and the rules
console.log('3 · the opt-out (⚙ Spiel → „Wow-Momente") and the rules');
{
  const S = VR.Settings, it = S.byKey('wowMoments'), DE = I18N.dict.de, EN = I18N.dict.en;
  check(!!it && it.g === 'play' && it.sec === 'play' && it.t === 'switch' && it.def === true && !it.cost, 'a switch in ⚙ Spiel → Spielen, on by default (no cost badge: not a graphics option)');
  check(!!it && DE[it.lab] === 'Wow-Momente' && !!EN[it.lab] && !!DE[it.tip] && !!EN[it.tip], `its label „${it ? DE[it.lab] : '?'}" and tip in both languages`);
  check(S.defaults().wowMoments === true, 'the settings\' defaults carry it (a saved settings record without it: on)');
  check(W.allowed({ enabled: true }) && !W.allowed({ enabled: false }) && !W.allowed({ guest: true }) && !W.allowed({ guests: true }) && !W.allowed({ busy: true }) && !W.allowed({ wait: 3 }) && !W.allowed(null), 'allowed(): only with the switch on, as the host without guests, nothing else holding the view, the gap passed');
  const cases = [
    ['the switch off', { settings: { wowMoments: false } }],
    ['a multiplayer guest (the host\'s world)', { meta: { id: 'guest-x', guest: true } }],
    ['a guest connecting (mp client)', { mp: { isClient: true } }],
    ['friends building in my world (host with guests)', { mp: { isHost: true, remote: new Map([['p2', {}]]) } }],
    ['the pause menu', { ui: { screen: 'pause', blocking: true } }],
    ['the chat line', { ui: { screen: null, typing: true } }],
    ['the director\'s flight', { director: { active: true } }],
    ['riding a vehicle', { gadgets: { controlling: true } }],
    ['the Studio overlay', { studioOpen: true }],
    ['the photo mode', { photo: { vignette: 0.3 } }],
    ['loading', { state: 'loading' }],
  ];
  for (const [what, o] of cases) {
    const g = mkGame(o), A = new W.Actor(g); A.absorb(VISTAS); at(g, 'v0'); run(A, g, 2);
    check(!A.active && A.count === 0 && !(g.meta.wowSeen || []).length, `none with ${what} (and the vista stays unseen for later)`);
  }
  { VR.Zeit = { active: true }; const g = mkGame(), A = new W.Actor(g); A.absorb(VISTAS); at(g, 'v0'); run(A, g, 2); check(!A.active && A.count === 0, 'none while the Zeitraffer replays'); delete VR.Zeit; }
  { const g = mkGame({ mp: { isHost: true, remote: new Map() } }), A = new W.Actor(g); A.absorb(VISTAS); at(g, 'v0'); run(A, g, 0.5); check(A.count === 1, 'hosting with nobody joined: it plays'); A.destroy(); }
  { const g = mkGame(), A = new W.Actor(g); A.absorb(VISTAS); at(g, 'v0'); run(A, g, 0.5); g.settings.wowMoments = false; run(A, g, 4.5); at(g, 'v1'); run(A, g, W.GAP + 2); check(A.count === 1 && !A.active, 'switched off after one: no further moment'); A.destroy(); }
  // the gap: two vistas 60 blocks apart, walked in a quarter minute
  {
    const g = mkGame(), A = new W.Actor(g); A.absorb(VISTAS); at(g, 'v0'); run(A, g, 4.6); at(g, 'v1'); run(A, g, 10);
    const inGap = A.count; run(A, g, W.GAP);
    check(inGap === 1 && A.count === 2 && JSON.stringify(g.meta.wowSeen) === '["v0","v1"]', `${W.GAP} s between two moments: the second vista waits (${inGap} moment in the gap, ${A.count} after)`);
    A.destroy();
  }
  // a key in the rise: the view turns back from where it stands, no jump
  {
    const g = mkGame(), A = new W.Actor(g); A.absorb(VISTAS); at(g, 'v0');
    let prev = null, jump = 0, frames = 0, pressedAt = -1, press = false;
    run(A, g, 4.5, (c, a) => { frames++; if (prev) jump = Math.max(jump, Math.hypot(c.x - prev.x, c.y - prev.y, c.z - prev.z)); prev = c; if (pressedAt < 0 && a.t > 0.7) { pressedAt = frames; press = true; } }, () => { if (press) { g.input.pressed.add('KeyW'); press = false; } });
    const len = frames / 60;
    check(len > 0.7 && len < 0.7 + W.FALL * 0.5 + 0.3 && jump < 0.12, `a key in the rise ends it early (${len.toFixed(2)} s in all), turning back without a jump (${jump.toFixed(3)} blocks a frame at most)`);
    check(g.hideHud === false && A.dom.style.display === 'none', 'and the HUD is back');
    A.destroy();
  }
  // the vista's height: walking under it on a lower way, or flying over it, is not reaching it
  { const g = mkGame(), A = new W.Actor(g); A.absorb(VISTAS); at(g, 'v0'); g.player.pos[1] += 6; run(A, g, 2); g.player.pos[1] -= 12; run(A, g, 2); g.player.pos = [104.6, 71, 50.5]; run(A, g, 2); check(A.count === 0, `6 blocks over or under it, or ${(104.6 - 100.5).toFixed(1)} blocks off its start: not reached (reach ${W.REACH})`); }
}

// ---------------------------------------------------------------- 4 · the swell
console.log('4 · the swell: four bars of the day\'s pentatonic plan');
{
  const plan = K.musicPlan(5), notes = K.swellPlan(plan, 4, 1);
  const pcs = new Set(plan.scale.map(s => (((plan.root + s) % 12) + 12) % 12));
  check(notes.length > 20 && notes.every(n => pcs.has(((n.midi % 12) + 12) % 12)), `every note of the swell lies in the day's pentatonic scale (${notes.length} notes)`);
  const bells = notes.filter(n => n.kind === 'bell'), body = notes.filter(n => n.t < 4 - 1e-9 && !(n === notes[notes.length - 1]));
  const meanBar = [0, 1, 2, 3].map(b => { const bs = bells.filter(n => n.t >= b && n.t < b + 1 && n !== notes[notes.length - 1]); return bs.reduce((s, n) => s + n.midi, 0) / bs.length; });
  check(meanBar.every((m, i) => i === 0 || m > meanBar[i - 1]), `the bells climb bar by bar (mean MIDI ${meanBar.map(m => m.toFixed(1)).join(' → ')})`);
  const padBar = [0, 1, 2, 3].map(b => notes.filter(n => n.kind === 'pad' && n.t === b).reduce((s, n) => s + n.gain, 0));
  check(padBar.every((m, i) => i === 0 || m > padBar[i - 1]), `the pad grows (${padBar.map(m => m.toFixed(3)).join(' → ')})`);
  const top = notes[notes.length - 1];
  check(top.kind === 'bell' && top.midi >= Math.max(...bells.map(n => n.midi)) && near(top.t, 3.75) && top.dur >= 2, `it arrives on its highest note, held over the last beat (MIDI ${top.midi} at ${top.t} s for ${top.dur} s)`);
  check(body.every(n => n.t >= 0 && n.t < 4) && notes.every(n => n.t + n.dur <= 5.8), 'four bars of one second; the last note rings out under two seconds after');
  const p6 = K.swellPlan(K.musicPlan(6), 4, 1), same = JSON.stringify(K.swellPlan(K.musicPlan(5), 4, 1)) === JSON.stringify(notes);
  check(same && JSON.stringify(p6) !== JSON.stringify(notes), 'the same day the same swell, another day another');
  // audio.js: into the music bus, the calm layer waits
  const ctx = makeCtx(), a = new VR.Audio(); a.init(ctx); const before = ctx.nodes.length;
  a.music.next = 0; const n = a.swell(5, 1);
  const oscs = ctx.nodes.slice(before).filter(x => x.kind === 'osc');
  check(n === notes.length && oscs.length >= bells.length * 2, `audio.js schedules the swell (${n} notes, ${oscs.length} oscillators)`);
  check(oscs.every(o => o.startAt >= 0.05 - 1e-9 && o.startAt <= 4.1), 'every voice starts within the four bars');
  check(a.music.next >= 4.4, `the calm layer waits until it has sounded (next bar at ${a.music.next.toFixed(2)} s)`);
  const reach = (node, target, depth) => { if (node === target) return true; if (depth > 6) return false; return node.outs.some(o => reach(o, target, depth + 1)); };
  check(oscs.every(o => reach(o, a.mus, 0)), 'every voice goes through the music bus (the music volume and the duck apply)');
  const a0 = new VR.Audio(); a0.init(makeCtx()); a0.setVolumes({ music: 0 });
  check(a0.swell(5, 1) === 0, 'at music volume 0: silent');
  const an = new VR.Audio(); check(an.swell(5, 1) === 0, 'no audio context (the sound off): nothing, no error');
}

// ---------------------------------------------------------------- 5 · the cost
console.log('5 · the cost: nothing a frame without vistas, a look four times a second with them');
{
  const g = mkGame(), A = new W.Actor(g); let calls = 0; const st = A.state.bind(A); A.state = () => { calls++; return st(); };
  run(A, g, 10);
  check(calls === 0, `no vistas loaded (a vgen ≤ 10 world): no look at all in 600 frames (${calls})`);
  A.absorb(VISTAS); away(g); run(A, g, 10);
  check(calls >= 36 && calls <= 41, `with vistas loaded: ${calls} looks in 10 s (four a second)`);
  const many = []; for (let i = 0; i < 60; i++) many.push(['vista', 'm' + i, i * 120, 70, 0, i * 120 - 3, 72.8, 0, 0, 0, 62, 'hills']);
  A.absorb(many); const t0 = process.hrtime.bigint(); for (let i = 0; i < 200000; i++) A.update(1 / 60); const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  check(ms / 200000 < 0.01, `${A.list.size} vistas: ${(ms / 200000 * 1000).toFixed(2)} µs per frame on average (under 10 µs)`);
  A.destroy();
}

// ---------------------------------------------------------------- 6 · the vistas of a vgen-11 world
console.log('6 · the vistas of a vgen-11 world: spawns, triggers, the picture\'s eye and the swing\'s path');
{
  const SEED = +(process.env.SEED || 4242), R = V.R, F = V.F, RT = R.T;
  const gen = V.makeGen('overworld', SEED, { vgen: 11 }), P = V.Land.plan(gen);
  const CH = new Map(), chunk = (cx, cz) => { const k = cx + ',' + cz; let c = CH.get(k); if (!c) { c = gen.generate(cx, cz); CH.set(k, c); } return c; };
  const blockAt = (x, y, z) => { x = Math.floor(x); y = Math.floor(y); z = Math.floor(z); if (y < 0 || y > 255) return 0; return chunk(x >> 4, z >> 4).blocks[(y << 8) | ((z & 15) << 4) | (x & 15)]; };
  const solid = (b) => b && ((RT.flags[b] & (F.OPAQUE | F.LEAVES)) || (RT.flags[b] & F.SOLID));
  const nameOf = (s) => (s ? R.types[RT.type[s]].name : 'air');
  const g = mkGame(), A = new W.Actor(g);
  for (const v of P.vistas) A.absorb(chunk(v.x >> 4, v.z >> 4).spawns || []);
  check(P.vistas.length >= 12 && A.list.size === P.vistas.length, `every vista point's spawn is read from its chunk (${A.list.size} of ${P.vistas.length})`);
  let right = 0, eyeAir = 0, path = 0, pushAir = 0; const bad = [];
  for (const v of P.vistas) {
    const s = A.list.get(v.id); if (!s) continue;
    const pk = W.pick(A.list.values(), {}, s.x + 0.5, s.y, s.z + 0.5); if (s.wow ? pk && pk.id === v.id : !pk || pk.id !== v.id) right++;
    // the picture's eye: its cell and a small box round it (the near plane) in the air
    const [ex, ey, ez] = s.eye; let air = true;
    for (const [dx, dy, dz] of [[0, 0, 0], [0.2, 0, 0], [-0.2, 0, 0], [0, 0.2, 0], [0, -0.2, 0], [0, 0, 0.2], [0, 0, -0.2]]) if (solid(blockAt(ex + dx, ey + dy, ez + dz))) { air = false; if (bad.length < 5) bad.push(`${v.id}: the eye in ${nameOf(blockAt(ex + dx, ey + dy, ez + dz))}`); break; }
    if (air) eyeAir++;
    // the swing: from a walker's eye anywhere within reach of the start (four points round it) to the picture's eye
    let clear = true;
    for (const [ox, oz] of [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2]]) {
      const ax = s.x + 0.5 + ox, ay = s.y + 1.62, az = s.z + 0.5 + oz;
      if (solid(blockAt(ax, ay, az)) || solid(blockAt(ax, ay - 1, az))) continue;   // (no one stands there)
      for (let k = 1; k < 40; k++) { const t = k / 40, x = ax + (ex - ax) * t, y = ay + (ey - ay) * t, z = az + (ez - az) * t; if (solid(blockAt(x, y, z))) { clear = false; if (bad.length < 5) bad.push(`${v.id}: ${nameOf(blockAt(x, y, z))} on the swing from (${ox}, ${oz})`); break; } }
      if (!clear) break;
    }
    if (clear) path++;
    const cp = Math.cos(s.pitch), px = ex - Math.sin(s.yaw) * cp * W.DRIFT, py = ey + Math.sin(s.pitch) * W.DRIFT, pz = ez - Math.cos(s.yaw) * cp * W.DRIFT;
    let pc = true; for (let k = 1; k <= 8; k++) { const t = k / 8; if (solid(blockAt(ex + (px - ex) * t, ey + (py - ey) * t, ez + (pz - ez) * t))) pc = false; }
    if (pc) pushAir++;
  }
  const nWow = P.vistas.filter(v => v.wow).length;
  check(right === P.vistas.length && nWow >= 10 && nWow === [...A.list.values()].filter(q => q.wow).length, `standing at a wow vista's start picks it, at a quiet one (the landmark too small from it) none (${right} of ${P.vistas.length}; ${nWow} wow vistas, ${P.vistas.length - nWow} quiet)`);
  check(eyeAir === P.vistas.length, `every picture's eye is in the air (${eyeAir} of ${P.vistas.length}${bad.length ? '; ' + bad.join('; ') : ''})`);
  check(path === P.vistas.length, `the swing from the walker's eye to the picture passes no block (${path} of ${P.vistas.length})`);
  check(pushAir === P.vistas.length, `the drift in along the look stays in the air (${pushAir} of ${P.vistas.length})`);
  A.destroy();
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);

// ---- a stubbed Web Audio context (as test/klang.js): every node recorded with its connections and start time
function makeCtx() {
  const ctx = { sampleRate: 44100, currentTime: 0, state: 'running', nodes: [] };
  const param = (v) => { const p = { value: v }; const set = (x) => { p.value = x; }; p.setValueAtTime = set; p.linearRampToValueAtTime = set; p.exponentialRampToValueAtTime = set; p.setTargetAtTime = set; p.cancelScheduledValues = () => {}; return p; };
  const node = (kind, extra) => { const n = Object.assign({ kind, outs: [], startAt: -1, stopAt: -1, connect(d) { this.outs.push(d); return d; }, disconnect() { this.outs = []; }, start(t) { this.startAt = t === undefined ? ctx.currentTime : t; }, stop(t) { this.stopAt = t === undefined ? ctx.currentTime : t; } }, extra); ctx.nodes.push(n); return n; };
  ctx.destination = node('destination', {});
  ctx.createBuffer = (ch, len, rate) => { const d = []; for (let c = 0; c < ch; c++) d.push(new Float32Array(len)); return { length: len, sampleRate: rate, numberOfChannels: ch, duration: len / rate, getChannelData: (c) => d[c] }; };
  ctx.createBufferSource = () => node('source', { buffer: null, loop: false, playbackRate: param(1) });
  ctx.createGain = () => node('gain', { gain: param(1) });
  ctx.createBiquadFilter = () => node('filter', { type: 'lowpass', frequency: param(350), Q: param(1), gain: param(0) });
  ctx.createStereoPanner = () => node('panner', { pan: param(0) });
  ctx.createOscillator = () => node('osc', { type: 'sine', frequency: param(440), detune: param(0) });
  ctx.createConvolver = () => node('convolver', { buffer: null });
  ctx.createDynamicsCompressor = () => node('comp', { threshold: param(-24), ratio: param(12), knee: param(30), attack: param(0.003), release: param(0.25) });
  return ctx;
}
