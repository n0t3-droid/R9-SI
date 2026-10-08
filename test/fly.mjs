// Flying shuttles: the mouse is your head (never the stick), right mouse held steers, a throttle lever that stays,
// X hovers, A/D turn with an automatic bank, V flies the ship down onto its gear (no teleport) and then gets you out,
// C cycles cockpit → chase → cinematic, Q looks back (and never drops your item), B boosts (Ctrl does nothing),
// a block in the hull is shaken off, boosting into a wall at 10 fps neither tunnels nor NaNs. Both ship systems:
// the mini-voxel starship (starships.js) and the block-built ship behind a Ship Helm (gadgets.js).
// Flat creative world, potato preset. SHOTS=1 also saves cockpit / chase screenshots.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 600)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
// step the game loop by hand; window.__inj = { dx, dy, hit: [codes] } feeds the mouse / key presses of every frame,
// window.__rec(g) records each frame
const step = async (n, dtms = 33) => {
  for (let k = 0; k < n; k += 10) {
    await ev(([m, d]) => {
      const g = VR.game;
      if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; }
      window.__norender = true;
      for (let i = 0; i < m; i++) {
        const J = window.__inj, I = g.input;
        if (J) { if (J.dx) I.mouse.dx += J.dx; if (J.dy) I.mouse.dy += J.dy; if (J.hit) { for (const c of J.hit) I.pressed.add(c); J.hit = null; } if (J.click) { I.mouse.clicked[J.click] = true; J.click = null; } }
        g.last = performance.now() - d; g.loop(performance.now());
        if (window.__rec) window.__rec(g);
      }
    }, [Math.min(10, n - k), dtms]);
    await wait(12);
  }
};
const shot = async (name) => { await ev(() => { window.__norender = false; const g = VR.game; g.env.rain = 0; g.env.rainTarget = 0; g.last = performance.now() - 33; g.loop(performance.now()); g.renderer.gl.finish(); window.__norender = true; }); await wait(150); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 120000 }); console.log('  shot', name); };
const keys = (add, del) => ev(([a, d]) => { const I = VR.game.input; for (const c of d || []) I.keys.delete(c); for (const c of a || []) I.keys.add(c); }, [add || [], del || []]);
const press = (...codes) => ev((c) => { window.__inj = window.__inj || {}; window.__inj.hit = c; }, codes);
const inj = (o) => ev((o) => { window.__inj = o; }, o);
// the active flight: pose, controls, state
const F = () => ev(() => {
  const g = VR.game, fl = g.flight; if (!fl) return null;
  const b = fl.b, p = b.pos, v = b.vel;
  return { state: fl.state, view: fl.view, camMode: g.camMode, power: fl.power, thr: +fl.throttle.toFixed(3), boost: !!fl.boost, energy: +fl.energy.toFixed(3), gear: +fl.gear.toFixed(3), heading: b.heading, roll: +fl.roll.toFixed(4), headYaw: +fl.headYaw.toFixed(4),
    pos: p.slice(), vel: v.slice(), speed: Math.hypot(v[0], v[1], v[2]), alt: fl.alt, inside: fl.inside(), cruise: fl.cruise, camYaw: g.cam ? g.cam.yaw : null, kind: b.kind };
});
const nan = (a) => a.some(x => !isFinite(x));

for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.dynRes = false; g.settings.renderDist = 4; g.settings.horizon = 0; g.settings.minimap = false; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Fly',mode:'creative',difficulty:'peaceful',type:'flat',seed:'${process.env.SEED || '4711'}',cheats:true,kit:true})`);
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game.state === 'play' && VR.game.player && !VR.game.player.hold)) break; }
await ev(() => { const g = VR.game; g.env.setTime(3200); g.zenFreezeTime = true; window.requestAnimationFrame = () => 0; g.input.captured = true; });
for (let i = 0; i < 10; i++) { await step(10); await wait(60); }

// a block-built shuttle behind the spawn for section 10 (summoned now, while the ground around is surely loaded)
let helm = null;
for (let i = 0; i < 12 && !helm; i++) {
  helm = await ev(() => { const g = VR.game, p = g.player; p.yaw = Math.PI; p.pitch = 0; return g.gadgets.summonDesign(VR.ShipGen.design(777, 'shuttle'), p) ? p.pos.slice() : null; });
  if (!helm) { console.log('  (summon refused: ' + await ev(() => { const g = VR.game, p = g.player, w = g.world; let n = 0, m = 0; for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) { n++; if (w.col((Math.floor(p.pos[0]) >> 4) + dx, (Math.floor(p.pos[2]) >> 4) + dz)) m++; } return m + '/' + n + ' columns at ' + p.pos.map(Math.round); }) + ')'); await step(10); await wait(500); }
}
await ev(() => { VR.game.player.yaw = 0; });
await step(5);

console.log('1 · a shuttle (mini-voxel starship), boarded on the ground');
await ev(() => { const g = VR.game; g.starships.placeInFront(4242, 'shuttle', null, g.player); });
for (let i = 0; i < 60; i++) { await step(5); if (await ev(() => { const S = VR.game.starships.ships; return S.length > 0 && !!S[S.length - 1].d.meta && !!S[S.length - 1].d.cells; })) break; await wait(150); }
const parked = await ev(() => { const g = VR.game, s = g.starships.ships[g.starships.ships.length - 1]; g.starships.board(s, g.player); return s.pos.slice(); });
await step(3);
let f = await F();
check(f && f.kind === 'starship' && f.state === 'landed' && f.view === 0 && f.camMode === 0 && f.power === 'off', 'boarding a parked ship: a cold flight in the cockpit, standing on the ground (' + JSON.stringify(f && { state: f.state, view: f.view, cam: f.camMode, power: f.power }) + ')');
check(f && f.cruise > 36 && f.cruise < 48, 'shuttle cruise speed ≈ 42 m/s (' + (f && f.cruise.toFixed(1)) + ')');
// take off: Space in a cold ship spins the engines up (3 s), then it climbs
await keys(['Space']); await step(45);
f = await F();
check(f.power === 'starting' && f.state === 'landed', 'Space in a cold ship starts the engines first (' + f.power + ')');
await step(130); await keys([], ['Space']); await step(30);
f = await F();
check(f.power === 'running' && f.state === 'flying' && f.pos[1] - parked[1] > 15, 'then it lifts off and climbs (' + (f.pos[1] - parked[1]).toFixed(1) + ' m)');

console.log('2 · the mouse is your head, never the stick');
await ev(() => { window.__camYaw0 = VR.game.cam.yaw; });
let f0 = await F();
await inj({ dx: 40 }); await step(12); await inj(null); await step(2);
f = await F();
const camTurn = Math.abs(((f.camYaw - f0.camYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
check(Math.abs(f.heading - f0.heading) < 1e-3, 'mouse movement leaves the ship heading alone (Δ ' + Math.abs(f.heading - f0.heading).toExponential(1) + ')');
check(camTurn > 0.2, 'mouse movement turns the view (' + camTurn.toFixed(2) + ' rad)');
await inj({ click: 1 }); await step(15);
f = await F();
check(Math.abs(f.headYaw) < 0.03, 'middle click re-centres the view (' + f.headYaw + ')');
// right mouse held: the mouse steers
f0 = await F();
await ev(() => { VR.game.input.mouse.down[2] = true; });
await inj({ dx: 40 }); await step(12); await inj(null); await step(20);
await ev(() => { VR.game.input.mouse.down[2] = false; });
f = await F();
check(f.heading < f0.heading - 0.1, 'right mouse held + mouse right steers the ship to the right (' + (f.heading - f0.heading).toFixed(2) + ' rad)');
await inj({ click: 1 }); await step(12);

console.log('3 · throttle lever, boost on B (Ctrl does nothing)');
f0 = await F();
await keys(['KeyW']); await step(60); f = await F(); await keys([], ['KeyW']);
check(f.thr >= 0.9 && f.speed > f0.speed + 5, 'W pushes the throttle up (' + f.thr + ') and the ship speeds up (' + f0.speed.toFixed(1) + ' → ' + f.speed.toFixed(1) + ' m/s)');
await step(30); const f1 = await F();
check(f1.thr >= 0.9 && f1.speed >= f.speed - 0.5, 'the throttle stays where you left it (' + f1.thr + ', ' + f1.speed.toFixed(1) + ' m/s)');
await keys(['ControlLeft', 'KeyW']); await step(30); f = await F(); await keys([], ['ControlLeft', 'KeyW']);
check(!f.boost && f.speed <= f.cruise + 0.6, 'Ctrl is not a boost (' + f.speed.toFixed(1) + ' m/s ≤ cruise ' + f.cruise.toFixed(1) + ')');
await keys(['KeyB']); await step(30); f = await F(); await keys([], ['KeyB']);
check(f.boost && f.speed > f.cruise + 3 && f.energy < 1, 'B boosts past cruise speed (' + f.speed.toFixed(1) + ' m/s, energy ' + f.energy + ')');
await step(20);

console.log('4 · A/D turn with an automatic bank that levels itself');
f0 = await F();
await keys(['KeyD']); await step(36); f = await F(); await keys([], ['KeyD']);
check(f.roll < -0.1 && f.heading < f0.heading - 0.2, 'D turns right and banks right (roll ' + f.roll + ', Δheading ' + (f.heading - f0.heading).toFixed(2) + ')');
await step(60); f = await F();
check(Math.abs(f.roll) < 0.02, 'two seconds after letting go the wings are level (roll ' + f.roll + ')');

console.log('5 · X: throttle to zero → hover in place');
f0 = await F(); await press('KeyX'); await step(180); f = await F();
check(f.thr === 0 && f.speed < 0.5 && Math.abs(f.pos[1] - f0.pos[1]) < 0.3, 'hovering (' + f.speed.toFixed(2) + ' m/s, altitude change ' + (f.pos[1] - f0.pos[1]).toFixed(2) + ' m)');

console.log('6 · Q looks back and never drops what you hold; C / F5 cycle the views');
const inv0 = await ev(() => { const p = VR.game.player; p.inv.sel = 0; p.inv.slots[0] = { id: 'oak_planks', n: 5 }; p.inv.changed = true; return 5; });
await keys(['KeyQ']); await press('KeyQ'); await step(10);
const back = await ev(() => { const g = VR.game, fl = g.flight; return { cam: g.cam.yaw, heading: fl.b.heading }; });
await keys([], ['KeyQ']); await step(10);
const inv1 = await ev(() => { const s = VR.game.player.inv.slots[0]; return s ? s.n : 0; });
const lookBack = Math.abs(((back.cam - back.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
check(inv1 === inv0, 'Q while piloting drops nothing (' + inv1 + ' planks)');
check(lookBack > 2.2, 'holding Q looks back (' + lookBack.toFixed(2) + ' rad from the nose)');
await press('KeyC'); await step(3); const v1 = await F();
await press('KeyC'); await step(3); const v2 = await F();
await press('F5'); await step(3); const v0 = await F();
check(v1.view === 1 && v1.camMode === 1 && v2.view === 2 && v0.view === 0 && v0.camMode === 0, 'C → chase, C → cinematic, F5 → cockpit (' + [v1.view, v2.view, v0.view] + ')');

console.log('7 · a block inside the hull is shaken off');
const inside = await ev(() => { const g = VR.game, fl = g.flight, p = fl.b.pos, w = g.world; const c = fl.toWorld([0, 2.6, 0]); const x = Math.floor(c[0]), y = Math.floor(c[1]), z = Math.floor(c[2]); w.setBlock(x, y, z, VR.R.byName.stone.defaultState, 4); window.__stone = [x, y, z]; return { inside: fl.inside(), at: [x, y, z], pos: p.slice() }; });
await step(15); f = await F();
check(inside.inside && !f.inside && !nan(f.pos), 'stone block inside the hull (' + inside.inside + ') → free within 0.5 s (' + !f.inside + ', moved ' + Math.hypot(f.pos[0] - inside.pos[0], f.pos[1] - inside.pos[1], f.pos[2] - inside.pos[2]).toFixed(1) + ' m)');
await ev(() => { const s = window.__stone; VR.game.world.setBlock(s[0], s[1], s[2], 0, 4); });

if (process.env.SHOTS) { await shot('fly_cockpit'); await press('KeyC'); await step(40); await shot('fly_chase'); await press('KeyC'); await press('KeyC'); await step(2); }

console.log('8 · V: assisted landing on the gear, no teleport — and V again gets you out');
const rec = await ev(() => { window.__R = []; window.__rec = (g) => { const fl = g.flight; if (!fl) return; const p = fl.b.pos; window.__R.push([p[0], p[1], p[2], fl.b.vel[1], fl.gear, fl.state, fl.alt, Math.hypot(fl.b.vel[0], fl.b.vel[2])]); }; return true; });
await press('KeyV');
for (let i = 0; i < 40; i++) { await step(30); const st = await ev(() => VR.game.flight && VR.game.flight.state); if (st === 'landed') break; }
const R = await ev(() => { const r = window.__R; window.__rec = null; return r; });
let jump = 0, td = null, gearLow = 1, prevState = null;
for (let i = 1; i < R.length; i++) {
  const a = R[i - 1], b = R[i]; jump = Math.max(jump, Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
  if (b[6] < 3 && b[5] !== 'landed') gearLow = Math.min(gearLow, b[4]);
  if (b[5] === 'landed' && prevState !== 'landed' && !td) td = { vy: a[3], hs: a[7] };
  prevState = b[5];
}
f = await F();
console.log('  frames', R.length, 'max step', jump.toFixed(2), 'touchdown', JSON.stringify(td), 'gear below 3 m', gearLow);
check(f.state === 'landed', 'the ship flew down and landed (' + f.state + ', alt ' + (f.alt !== null ? f.alt.toFixed(2) : '?') + ')');
check(gearLow > 0.9, 'the gear is down before touchdown (' + gearLow + ')');
check(td && Math.abs(td.vy) < 2, 'touchdown slower than 2 m/s (' + (td ? td.vy.toFixed(2) : '?') + ')');
check(jump < 2.6, 'no teleport: largest move in one frame ' + jump.toFixed(2) + ' m');
const landedAt = f.pos.slice();
await press('KeyV'); await step(4);
const out = await ev(() => { const g = VR.game, s = g.starships.ships[g.starships.ships.length - 1]; return { pilot: !!g.starships.pilot, riding: !!g.gadgets.riding, flight: !!g.flight, camMode: g.camMode, state: s.state, pos: s.pos.slice() }; });
check(!out.pilot && !out.riding && !out.flight && out.camMode === 0 && out.state === 'parked', 'V when landed: out of the ship, first person again');
check(Math.hypot(out.pos[0] - landedAt[0], out.pos[1] - landedAt[1], out.pos[2] - landedAt[2]) < 0.05, 'the ship stays exactly where it landed');

console.log('9 · boosting into a wall at 10 frames per second: no tunnelling, no NaN');
await ev(() => { const g = VR.game, s = g.starships.ships[g.starships.ships.length - 1]; g.starships.board(s, g.player); });
await keys(['Space']); await step(125); await keys([], ['Space']); await step(15);
const wall = await ev(() => {
  const g = VR.game, fl = g.flight, b = fl.b, w = g.world, p = b.pos, h = b.heading, fx = -Math.sin(h), fz = -Math.cos(h);
  // a wall across the flight path 45 m ahead, 4 thick, 50 wide, 24 high, standing on the ground
  const stone = VR.R.byName.stone.defaultState, list = [], cx = p[0] + fx * 45, cz = p[2] + fz * 45, rx = Math.cos(h), rz = -Math.sin(h);
  const y0 = Math.floor(p[1]) - 10;
  for (let s = -25; s <= 25; s += 0.5) for (let d = 0; d < 4; d += 0.5) for (let y = y0; y < y0 + 34; y++) list.push([Math.floor(cx + rx * s + fx * d), y, Math.floor(cz + rz * s + fz * d), stone]);
  const seen = new Map(); for (const e of list) seen.set(e[0] + ',' + e[1] + ',' + e[2], e);
  w.bulkSet([...seen.values()], false);
  return { plane: [cx, cz], f: [fx, fz], start: p.slice() };
});
await keys(['KeyW', 'KeyB']);
let passed = false, bad = false, dmax = -1e9;
for (let i = 0; i < 4; i++) {
  await step(10, 100);
  const s = await F();
  if (nan(s.pos) || nan(s.vel)) bad = true;
  const d = (s.pos[0] - wall.plane[0]) * wall.f[0] + (s.pos[2] - wall.plane[1]) * wall.f[1];
  dmax = Math.max(dmax, d); if (d > 0.5) passed = true;
}
await keys([], ['KeyW', 'KeyB']);
f = await F();
check(!bad, 'no NaN in position or velocity');
check(!passed, 'the ship never got through the wall (closest centre-to-wall ' + dmax.toFixed(1) + ' m, speed now ' + f.speed.toFixed(1) + ')');
check(!f.inside, 'and is not stuck inside it');
await press('KeyX'); await step(30); await press('KeyV');
for (let i = 0; i < 40; i++) { await step(30); if (await ev(() => VR.game.flight && VR.game.flight.state === 'landed')) break; }
await press('KeyV'); await step(4);

console.log('10 · the block-built ship behind a Ship Helm flies the same way');
// (summoned at the start, behind the spawn: walk back there and find its helm)
let hpos = null;
if (helm) await ev((h) => { const p = VR.game.player; p.teleport(h[0], h[1] + 1, h[2]); }, helm);
for (let i = 0; i < 20 && helm; i++) {
  await step(5); await wait(150);
  hpos = await ev((h) => { const g = VR.game, w = g.world, R = VR.R, id = R.byName.helm.id; for (let y = Math.floor(h[1]) - 4; y < h[1] + 16; y++) for (let z = Math.floor(h[2]) - 4; z <= h[2] + 40; z++) for (let x = Math.floor(h[0]) - 16; x <= h[0] + 16; x++) { const s = w.getBlock(x, y, z); if (s && R.T.type[s] === id) return [x, y, z]; } return null; }, helm);
  if (hpos) break;
}
check(!!hpos, 'a block shuttle with a helm stands in front of us (' + hpos + ')');
if (hpos) {
  await ev((h) => VR.game.gadgets.takeHelm(h[0], h[1], h[2]), hpos);
  for (let i = 0; i < 30; i++) { await step(5); await wait(150); if (await ev(() => VR.game.gadgets.ship && VR.game.gadgets.ship.state === 'flying')) break; }
  f = await F();
  check(f && f.kind === 'ship' && f.state === 'landed', 'helm taken: the block ship is a flight standing on the ground (' + (f && f.state) + ')');
  await keys(['Space']); await step(160); await keys([], ['Space']); await step(15);
  f0 = await F();
  await inj({ dx: 40 }); await step(12); await inj(null); await step(3);
  f = await F();
  check(Math.abs(f.heading - f0.heading) < 1e-3 && f.pos[1] - hpos[1] > 8, 'block ship: up in the air, the mouse only looks (Δheading ' + Math.abs(f.heading - f0.heading).toExponential(1) + ')');
  await inj({ click: 1 }); await step(10);
  await keys(['KeyW', 'KeyD']); await step(40); f = await F(); await keys([], ['KeyW', 'KeyD']);
  check(f.thr >= 0.9 && f.roll < -0.05 && f.heading < f0.heading - 0.2, 'block ship: W throttle (' + f.thr + '), D turns and banks right (roll ' + f.roll + ')');
  await press('KeyX'); await step(60); await press('KeyV');
  for (let i = 0; i < 40; i++) { await step(30); if (await ev(() => VR.game.flight && VR.game.flight.state === 'landed')) break; }
  f = await F();
  check(f && f.state === 'landed', 'block ship: V lands it (' + (f && f.state) + ')');
  await press('KeyV'); await step(4);
  const bs = await ev(() => { const g = VR.game, S = g.gadgets.ship; return { riding: !!g.gadgets.riding, flight: !!g.flight, state: S ? S.state : null, camMode: g.camMode }; });
  check(!bs.riding && !bs.flight && (bs.state === 'landing' || bs.state === null) && bs.camMode === 0, 'block ship: V again puts the blocks back on the grid and you get out (' + JSON.stringify(bs) + ')');
}

console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 20)) console.log(l);
check(!logs.some(l => /pageerror/.test(l)), 'no page errors');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
await browser.close();
process.exit(fails ? 1 : 0);
