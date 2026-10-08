// F3 · Da-Sein (realism wave): the presence in the picture and in the live game. Four shots — a sunbeam room, a meadow at
// noon, a field at night, and a sprint-and-jump pair — plus checks of the camera and the feel (the sprint FOV, the bob
// toggle, the landing dip, the view nudge of a placed block), the air life per tier (Very Low: fireflies and snow only),
// and the cost of the living air on Very Low and High (air life off and on, same scene). Shots: test/shots/presence_*.png
// Run it in the background:  nohup bash test/wt_run.sh presence.mjs 1800 > .tmp_tests/presence.log 2>&1 &
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail|missing/i.test(s)) logs.push(`[${t}] ${s.slice(0, 600)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1200)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const shotPath = (name) => `/home/claude/vr/test/shots/${name}.png`;
// frames: the game's own loop on a fake clock; rendering is skipped while fast-forwarding, on for a shot
const step = async (n, dtms = 16) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(4); } };
const shot = async (name, frames = 3) => { await ev((frames) => { window.__norender = false; const g = VR.game; for (let i = 0; i < frames; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }, frames); await page.screenshot({ path: shotPath(name), timeout: 180000 }); console.log('shot', name); };
const settle = async (max = 60) => { for (let i = 0; i < max; i++) { await step(10); const s = await ev(() => { const g = VR.game; let dirty = 0; for (const c of g.world.cols.values()) for (const sc of c.sec) if (sc.dirty || sc.pending) dirty++; return { busy: g.pool.busy, pend: g.world.pending.size, dirty }; }); if (s.busy === 0 && s.pend === 0 && s.dirty === 0 && i > 2) break; await wait(60); } };

// ---- start: fresh settings, then the flat world the classic tests use
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
const fresh = await ev(() => ({ fov: VR.game.settings.fov, inertia: !!VR.game.settings.turnInertia, air: VR.game.settings.airLife !== false, bob: VR.game.settings.viewBob !== false }));
check(fresh.fov === 75 && fresh.inertia === false && fresh.air === true && fresh.bob === true, 'fresh settings: FOV 75, turn inertia off, living air and view bobbing on (' + JSON.stringify(fresh) + ')');
await ev(() => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.settings.horizon = 1; g.settings.renderDist = 6; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Presence',mode:'creative',difficulty:'peaceful',type:'flat',seed:'31',cheats:true,kit:true})`);
for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.display = 'none'; g.env.setTime(6000); g.player.mob = null; });

// ---- scene 1: a sunbeam room (9 × 9, four high, a 3 × 3 hole in the roof; the low sun's beam runs from the hole toward the camera, which looks up at it)
await ev(() => {
  const g = VR.game, w = g.world, R = VR.R, p = g.player;
  const ox = Math.floor(p.pos[0]) + 14, oz = Math.floor(p.pos[2]) - 6, y0 = w.topAt(ox + 4, oz + 4);
  const S = R.byName.stone.defaultState, A = 0;
  for (let x = 0; x <= 8; x++) for (let z = 0; z <= 8; z++) {
    w.setBlock(ox + x, y0 + 1, oz + z, S, 4);
    if (x === 0 || x === 8 || z === 0 || z === 8) for (let y = 2; y <= 5; y++) w.setBlock(ox + x, y0 + y, oz + z, S, 4);
    const hole = x >= 3 && x <= 5 && z >= 5 && z <= 7;
    w.setBlock(ox + x, y0 + 6, oz + z, hole ? A : S, 4);
  }
  for (let x = 1; x <= 7; x++) for (let z = 1; z <= 7; z++) for (let y = 2; y <= 5; y++) w.setBlock(ox + x, y0 + y, oz + z, A, 4);
  p.flying = true; p.noclip = true; p.teleport(ox + 4.5, y0 + 2, oz + 1.5); p.yaw = Math.PI; p.pitch = 0.3; p.fovKick = 0;
  window.__room = { ox, y0, oz };
});
await settle(40);
await step(240);
const roomMade = await ev(() => ({ mote: VR.game.airLife.drawn.mote, sun: VR.game.env.E.sunDir[1] }));
check(roomMade.mote > 0 && roomMade.sun > 0.12, 'a sunbeam room: dust motes drift in the beam (' + roomMade.mote + ' made, sun height ' + roomMade.sun.toFixed(2) + ')');
await shot('presence_sunbeam', 3);

// ---- scene 2: a meadow at noon (grass, flowers, tall grass) — the flat world's top layer is grass
const meadow = await ev(() => {
  const g = VR.game, w = g.world, R = VR.R, p = g.player;
  const cx = Math.floor(p.pos[0]) + 2, cz = Math.floor(p.pos[2]) - 14;
  const flowers = ['poppy', 'dandelion', 'cornflower', 'allium', 'azure_bluet', 'oxeye_daisy', 'red_tulip', 'blue_orchid'].filter(n => R.byName[n]);
  let planted = 0;
  for (let x = -12; x <= 12; x++) for (let z = -12; z <= 12; z++) {
    const X = cx + x, Z = cz + z, top = w.topAt(X, Z);
    if (R.types[R.T.type[w.getBlock(X, top, Z)]].name !== 'grass_block' || w.getBlock(X, top + 1, Z) !== 0) continue;   // grass with air above it
    const r = Math.abs(Math.sin(X * 12.9898 + Z * 78.233) * 43758.5453) % 1;                                              // a fixed scatter
    if (r < 0.04 && flowers.length) { w.setBlock(X, top + 1, Z, R.byName[flowers[planted % flowers.length]].defaultState, 4); planted++; }
    else if (r > 0.5 && r < 0.8 && R.byName.short_grass) w.setBlock(X, top + 1, Z, R.byName.short_grass.defaultState, 4);
  }
  const top = w.topAt(cx, cz + 6);
  p.flying = true; p.noclip = true; p.teleport(cx, top + 1, cz + 6); p.yaw = 0; p.pitch = -0.2; p.fovKick = 0;
  window.__meadow = { cx, cz, top, planted };
  return { planted, top };
});
await settle(40);
await step(180);
check(meadow.planted > 0, 'a meadow: ' + meadow.planted + ' flowers planted on the grass');
const mNoon = await ev(() => ({ bf: VR.game.airLife.bf.length, pollen: VR.game.airLife.drawn.pollen, ff: VR.game.airLife.ff.length, birds: VR.game.airLife.drawn.bird }));
check(mNoon.pollen > 0 && mNoon.ff === 0, 'at noon on High: pollen drifts over the meadow, no fireflies (' + JSON.stringify(mNoon) + ')');
await step(1700);                                   // about 27 s: the first flock is due
const birdsOn = await ev(() => ({ drawn: VR.game.airLife.drawn.bird, bf: VR.game.airLife.drawn.butterfly }));
check(birdsOn.drawn > 0 && birdsOn.bf > 0, 'High: a flock of birds crosses the sky and butterflies visit the flowers (birds ' + birdsOn.drawn + ', butterflies ' + birdsOn.bf + ')');
await shot('presence_meadow_noon', 3);

// ---- scene 3: the same field at night — fireflies in the grass
await ev(() => { VR.game.env.setTime(18000); });
await step(420);
const night = await ev(() => ({ ff: VR.game.airLife.drawn.firefly, night: VR.game.env.E.night }));
check(night.ff > 0 && night.night > 0.55, 'a field at night: fireflies blink in the grass (' + night.ff + ' drawn, night ' + night.night.toFixed(2) + ')');
await shot('presence_field_night', 3);
await ev(() => { VR.game.env.setTime(6000); });

// ---- scene 4: a sprint and a jump, on foot in the meadow (the FOV kick, the bob, the air)
await ev(() => { const p = VR.game.player, m = window.__meadow; p.flying = false; p.noclip = false; p.teleport(m.cx, m.top + 1, m.cz + 8); p.yaw = 0; p.pitch = -0.12; p.fovKick = 0; });
await step(60);
const walkFov = await ev(() => VR.game.cam.fov * 180 / Math.PI);
await ev(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w' })); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ControlLeft', key: 'Control' })); });
await step(9);                                     // 0.15 s of sprint
const k150 = await ev(() => ({ fov: VR.game.cam.fov * 180 / Math.PI, kick: VR.game.player.fovKick, sprinting: VR.game.player.sprinting }));
await step(50);
const sprintFov = await ev(() => ({ fov: VR.game.cam.fov * 180 / Math.PI, sprinting: VR.game.player.sprinting, speed: Math.hypot(VR.game.player.vel[0], VR.game.player.vel[2]) }));
check(Math.abs(walkFov - 75) < 0.5, 'walking: the FOV is the setting, 75 (' + walkFov.toFixed(2) + ')');
check(k150.sprinting && k150.kick >= 0.95 && k150.fov >= 82.5, 'sprint: the kick reaches +8 within 150 ms (FOV ' + k150.fov.toFixed(2) + ', kick ' + k150.kick.toFixed(3) + ')');
check(sprintFov.sprinting && sprintFov.speed > 5 && Math.abs(sprintFov.fov - 83) < 0.3, 'sprint at speed ' + sprintFov.speed.toFixed(1) + ' blocks/s: FOV 83 (' + sprintFov.fov.toFixed(2) + ')');
await shot('presence_sprint_1', 2);
await ev(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' })); });
await step(12);                                    // the jump: airborne about 0.2 s after the press
const air = await ev(() => ({ onGround: VR.game.player.onGround, y: VR.game.player.pos[1], fov: VR.game.cam.fov * 180 / Math.PI }));
await ev(() => { window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ' })); });
check(!air.onGround && air.fov > 82.5, 'jump while sprinting: airborne, the FOV stays at the sprint value (' + air.fov.toFixed(2) + ')');
await shot('presence_sprint_2', 2);
await ev(() => { window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', key: 'w' })); window.dispatchEvent(new KeyboardEvent('keyup', { code: 'ControlLeft', key: 'Control' })); });
await step(60);

// ---- the feel: the bob toggle, the landing dip, the nudge and push of a placed block
const bobOn = await ev(() => { const g = VR.game, p = g.player; p.flying = false; p.noclip = false; g.settings.viewBob = true; window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w' })); return true; });
await step(40);
const bobA = await ev(() => { const g = VR.game, p = g.player; return { off: g.cam.y - (p.pos[1] + p.eye), bobAmt: p.bobAmt }; });
await ev(() => { VR.game.settings.viewBob = false; });
await step(20);
const bobB = await ev(() => { const g = VR.game, p = g.player; return { off: g.cam.y - (p.pos[1] + p.eye), x: g.cam.x - (p.pos[0] + Math.cos(p.viewYaw) * 0) }; });
await ev(() => { window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', key: 'w' })); VR.game.settings.viewBob = true; });
check(bobOn && bobA.bobAmt > 0.5 && Math.abs(bobA.off) > 0.001 && Math.abs(bobB.off) < 0.002, 'the head bob moves the eye while walking, and the Settings toggle switches it off (on ' + bobA.off.toFixed(3) + ', off ' + bobB.off.toFixed(4) + ')');
await step(60);
const dip = await ev(() => { const g = VR.game, p = g.player, m = window.__meadow; p.flying = false; p.noclip = false; p.teleport(m.cx + 3, m.top + 9, m.cz - 2); p.vel = [0, 0, 0]; return true; });
let landed = false; for (let i = 0; i < 40 && !landed; i++) { await step(6); landed = await ev(() => VR.game.player.onGround && VR.game.player.dipAmp > 0 && VR.game.player.dipT < 0.1); }
const dipState = await ev(() => { const g = VR.game, p = g.player; return { amp: p.dipAmp, t: p.dipT, eyeOff: g.cam.y - (p.pos[1] + p.eye) }; });
check(landed && dipState.amp > 0.05 && dipState.eyeOff < -0.03, 'a fall of 8 blocks lands with a dip of ' + dipState.amp.toFixed(3) + ' blocks (eye ' + dipState.eyeOff.toFixed(3) + ' just after landing)');
const nudge = await ev(() => { const g = VR.game, p = g.player; p.afterPlace(VR.R.byName.stone, 0, 0, 0, VR.R.byName.stone.defaultState); const a = { amp: p.nudgeAmp, push: p.pushAmp, t: p.nudgeT }; p.kickView(0.006, 0.5); return a; });
check(nudge.amp === 0.012 && nudge.push === 1 && nudge.t === 0, 'a placed block kicks the view (' + nudge.amp + ' rad) and pushes the hand (' + nudge.push + ')');
// the turn inertia (a Settings toggle, off by default): a fast turn is drawn at most 0.03 rad behind, then catches up
await ev(() => { const g = VR.game; g.settings.turnInertia = true; g.player.yaw += 1.0; });
await step(1);
const lag = await ev(() => { const g = VR.game, p = g.player; return Math.abs(g.cam.yaw - p.yaw); });
await step(60);
const caught = await ev(() => { const g = VR.game, p = g.player; g.settings.turnInertia = false; return Math.abs(g.cam.yaw - p.yaw); });
check(lag > 0.01 && lag <= 0.031 && caught < 0.002, 'turn inertia: a 1 rad turn is drawn ' + lag.toFixed(3) + ' rad behind (at most 0.03), then catches up (' + caught.toFixed(4) + ')');

// ---- a tree in a strong wind and then in snow: the leaves fall from the canopy, the flakes come down and settle
const tree = await ev(() => {
  const g = VR.game, w = g.world, R = VR.R, p = g.player, m = window.__meadow;
  const tx = m.cx - 4, tz = m.cz + 2, top = w.topAt(tx, tz);
  for (let y = 1; y <= 6; y++) w.setBlock(tx, top + y, tz, R.byName.oak_log.defaultState, 4);
  for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let y = 7; y <= 9; y++) {
    if (Math.abs(dx) === 2 && Math.abs(dz) === 2 && y === 9) continue;
    if (!w.getBlock(tx + dx, top + y, tz + dz)) w.setBlock(tx + dx, top + y, tz + dz, R.byName.oak_leaves.defaultState, 4);
  }
  p.flying = true; p.noclip = true; p.teleport(tx + 4, top + 2, tz + 4); p.yaw = Math.PI * 0.75; p.pitch = 0.1; p.fovKick = 0;
  return { top };
});
await settle(20);
// the weather is forced for a while: the wind (the leaves need more than 1.15), then snow (the leaves stop in snow)
const forceWx = (wind, snow) => ev(([wi, sn]) => { const wx = VR.game.env.wx; if (!window.__wxUpdate) window.__wxUpdate = wx.update; wx.update = function (dt, o) { window.__wxUpdate.call(this, dt, o); this.v.wind = wi; this.v.snow = sn; }; }, [wind, snow]);
await forceWx(2.6, 0);
await step(300);
const leaves = await ev(() => VR.game.airLife.drawn.leaf);
await forceWx(1.0, 0.9);
await step(300);
const snowN = await ev(() => VR.game.airLife.drawn.snow);
await ev(() => { const wx = VR.game.env.wx; if (window.__wxUpdate) { wx.update = window.__wxUpdate; window.__wxUpdate = null; } });
check(leaves > 0 && snowN > 0, 'a tree in a strong wind drops leaves (' + leaves + ' made), and snow comes down (' + snowN + ' made)');
await step(60);

// ---- the air life per tier, and its cost on Very Low and High (the same scene: the meadow at noon)
const measure = (n) => ev((n) => { const g = VR.game, a = g.airLife; window.__norender = false; a.msSum = 0; a.msN = 0; const t0 = performance.now(); for (let i = 0; i < n; i++) { g.last = performance.now() - 16; g.loop(performance.now()); } g.renderer.gl.finish(); const ms = (performance.now() - t0) / n; window.__norender = true; const s = g.renderer.stats; return { ms, draws: s.draws, tris: s.tris, air: a.msN ? a.msSum / a.msN : 0, parts: g.particles.n }; }, n);
const costs = {};
for (const preset of ['potato', 'high']) {
  await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.renderDist = 6; g.applySettings('*'); const m = window.__meadow; g.player.flying = true; g.player.noclip = true; g.player.teleport(m.cx, m.top + 1, m.cz + 6); g.player.yaw = 0; g.player.pitch = -0.2; }, preset);
  await settle(30);
  await step(120);
  const tier = await ev(() => VR.game.airLife.tier);
  const rows = {};
  for (const air of [false, true, false, true]) {
    await ev((on) => { const g = VR.game; g.airLife.setOn(on, g.airLife.tier); g.settings.airLife = on; }, air);
    await step(30);
    const r = await measure(24);
    (rows[air ? 'on' : 'off'] = rows[air ? 'on' : 'off'] || []).push(r);
  }
  const avg = (a, k) => a.reduce((s, r) => s + r[k], 0) / a.length;
  costs[preset] = { tier, off: { ms: avg(rows.off, 'ms'), draws: rows.off[0].draws, tris: rows.off[0].tris }, on: { ms: avg(rows.on, 'ms'), draws: rows.on[0].draws, tris: rows.on[0].tris, air: avg(rows.on, 'air') } };
  console.log('cost', preset, JSON.stringify(costs[preset]));
}
await ev(() => { VR.game.airLife.setOn(true, 0); VR.game.settings.airLife = true; });
// Very Low: fireflies and snow only, and the noon meadow holds no birds, butterflies or pollen
await ev(() => { const g = VR.game; g.applyPreset('potato'); g.applySettings('*'); const m = window.__meadow; g.player.teleport(m.cx, m.top + 1, m.cz + 6); g.env.setTime(6000); for (const k of Object.keys(g.airLife.drawn)) g.airLife.drawn[k] = 0; });
await step(240);
const potatoNoon = await ev(() => { const a = VR.game.airLife; return { tier: a.tier, drawn: { ...a.drawn } }; });
check(potatoNoon.tier === 0 && potatoNoon.drawn.bird === 0 && potatoNoon.drawn.butterfly === 0 && potatoNoon.drawn.pollen === 0 && potatoNoon.drawn.mote === 0, 'Very Low at noon: no birds, butterflies, pollen or motes (' + JSON.stringify(potatoNoon.drawn) + ')');
await ev(() => { VR.game.env.setTime(18000); }); await step(360);
const potatoNight = await ev(() => VR.game.airLife.drawn.firefly);
check(potatoNight > 0, 'Very Low at night: fireflies blink (' + potatoNight + ' drawn)');
const cv = costs.potato, ch = costs.high;
console.log('cost summary: Very Low air off ' + cv.off.ms.toFixed(1) + ' ms (draws ' + cv.off.draws + ', tris ' + cv.off.tris + ') · air on ' + cv.on.ms.toFixed(1) + ' ms (draws ' + cv.on.draws + ', tris ' + cv.on.tris + ', air update ' + cv.on.air.toFixed(3) + ' ms)');
console.log('cost summary: High air off ' + ch.off.ms.toFixed(1) + ' ms (draws ' + ch.off.draws + ', tris ' + ch.off.tris + ') · air on ' + ch.on.ms.toFixed(1) + ' ms (draws ' + ch.on.draws + ', tris ' + ch.on.tris + ', air update ' + ch.on.air.toFixed(3) + ' ms)');
check(cv.on.air < 1.5 && ch.on.air < 3, 'the air update costs under 1.5 ms (Very Low) and 3 ms (High) on this machine');
check(!logs.some(l => l.startsWith('[pageerror]')), 'no page errors during the test' + (logs.length ? ' (' + logs.slice(0, 3).join(' | ').slice(0, 400) + ')' : ''));

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
await browser.close();
process.exit(fails ? 1 : 0);
