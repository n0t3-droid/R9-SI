// Walking a shuttle (step 3): a parked shuttle lowers its rear ramp and kneels; you walk up the ramp into the cargo
// bay, through the cabin (seats, lockers, the holo table) to the cockpit door, which slides open as you come; V sits
// you down; out of the seat while it hovers you walk about and the ship carries you; out of the side door and down
// its stair. A gamepad walks and flies. The interior's triangle budget (cockpit + cabin ≤ 25k), frame time, and
// screenshots: the ramp from outside, the cargo bay, the cabin, the open cockpit door, looking back out of the ramp,
// the side stair. PRESET (default low), SEED.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const W = +(process.env.W || 1280), H = +(process.env.H || 720);
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 600)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
// step the game loop by hand (no rendering); window.__inj = { hit: [codes] } feeds one key press a frame; window.__steer
// = { tx, tz } turns the walker toward a point (ship frame) every frame
const step = async (n, dtms = 33) => {
  for (let k = 0; k < n; k += 10) {
    await ev(([m, d]) => {
      const g = VR.game;
      if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; }
      window.__norender = true;
      for (let i = 0; i < m; i++) {
        const J = window.__inj, I = g.input, w = g.starships.cabin.w, S = window.__steer;
        if (J && J.hit && J.hit.length) I.pressed.add(J.hit.shift());
        if (w && S) w.yaw = Math.atan2(-(S.tx - w.p[0]), -(S.tz - w.p[2]));
        g.last = performance.now() - d; g.loop(performance.now());
      }
    }, [Math.min(10, n - k), dtms]);
    await wait(12);
  }
};
// two real frames (the second one timed), then a screenshot; the interior's triangles in that frame
const shot = async (name) => {
  const r = await ev(() => {
    window.__norender = false; const g = VR.game; g.env.rain = 0; g.env.rainTarget = 0; let t = 0;
    for (let i = 0; i < 2; i++) { g.cockpit.lastTris = 0; g.cockpit.lastCabinTris = 0; const t0 = performance.now(); g.last = performance.now() - 33; g.loop(performance.now()); g.renderer.gl.finish(); t = performance.now() - t0; }
    window.__norender = true;
    return { ms: t, ck: g.cockpit.lastTris || 0, cab: g.cockpit.lastCabinTris || 0 };
  });
  await wait(200); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 120000 });
  console.log('  shot', name, Math.round(r.ms) + ' ms', 'interior ' + (r.ck + r.cab) + ' (cockpit ' + r.ck + ' + cabin ' + r.cab + ')');
  return r;
};
const press = (...codes) => ev((c) => { window.__inj = window.__inj || {}; window.__inj.hit = (window.__inj.hit || []).concat(c); }, codes);
const keys = (add, del) => ev(([a, d]) => { const I = VR.game.input; for (const c of d || []) I.keys.delete(c); for (const c of a || []) I.keys.add(c); }, [add || [], del || []]);
const steer = (tx, tz) => ev(([x, z]) => { window.__steer = x === null ? null : { tx: x, tz: z }; }, [tx, tz]);
const Wk = () => ev(() => { const g = VR.game, w = g.starships.cabin.w; return w ? { p: w.p.map(v => +v.toFixed(2)), yaw: +w.yaw.toFixed(2), ground: w.ground, riding: g.gadgets.riding && g.gadgets.riding.type } : { riding: g.gadgets.riding && g.gadgets.riding.type, pos: g.player.pos.map(v => +v.toFixed(2)) }; });
// walk forward (ship frame −z) toward (tx, tz) until z < tz (or the frames run out)
const walkTo = async (tx, tz, max = 300) => {
  await steer(tx, tz); await keys(['KeyW']);
  for (let i = 0; i < max; i += 10) { await step(10); const w = await Wk(); if (!w.p || w.p[2] < tz + 0.05) break; }
  await keys([], ['KeyW']); await steer(null); await step(4);
  return Wk();
};
const look = (yaw, pitch) => ev(([y, p]) => { const w = VR.game.starships.cabin.w; if (w) { w.yaw = y; w.pitch = p; } }, [yaw, pitch]);

for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.renderDist = 5; g.settings.minimap = false; g.applySettings('*'); }, process.env.PRESET || 'low');
await ev(`VR.game.createWorld({name:'Cabin',mode:'creative',difficulty:'peaceful',type:'default',seed:'${process.env.SEED || '424242'}',cheats:true,kit:true})`);
for (let i = 0; i < 160; i++) { await wait(500); if (await ev(() => VR.game.state === 'play' && VR.game.player && !VR.game.player.hold)) break; }
// out in the open, a little away from an outpost
const out = await ev(() => new Promise((res) => { const g = VR.game, p = g.player; g.pool.direct(0, { type: 'locate', dim: 'overworld', biome: 'outpost', x: Math.floor(p.pos[0]), z: Math.floor(p.pos[2]) }, null, (m) => res(m.pos)); }));
await ev((o) => { const g = VR.game, p = g.player; p.teleport(o[0] + 70.5, o[1] + 12, o[2] + 4.5); p.flying = true; p.yaw = 1.2; p.pitch = 0; g.env.setTime(4200); g.zenFreezeTime = true; window.requestAnimationFrame = () => 0; g.input.captured = true; }, out);
for (let i = 0; i < 16; i++) { await step(10); await wait(150); }
await ev(() => { const g = VR.game, p = g.player, w = g.world; const x = Math.floor(p.pos[0]), z = Math.floor(p.pos[2]); p.teleport(x + 0.5, w.topAt(x, z) + 1, z + 0.5); p.flying = false; });
await step(10);
const key = await ev(() => { const g = VR.game; return g.starships.placeInFront(12345, 'shuttle', null, g.player).key; });
for (let i = 0; i < 60; i++) { await step(5); if (await ev((k) => VR.game.starships.ships.some(s => s.d.key === k && s.d.meta && s.d.cells), key)) break; await wait(150); }
await ev((k) => { window.__S = VR.game.starships.ships.find(q => q.d.key === k); }, key);
const C = await ev(() => { const s = window.__S, C = s.d.meta.cabin, ck = s.d.meta.cockpit; return C ? Object.assign({ ckFloor: ck.floor, ckZb: ck.zb, seat: ck.seats[0], table: C.items.find(q => q.kind === 'table') }, C) : null; });
check(!!C, 'the shuttle (' + (await ev(() => window.__S.d.meta.name)) + ') has a walkable deck');

console.log('1 · the ramp');
await ev(() => { const g = VR.game, s = window.__S; g.starships.cabin.toggleRamp(s, true); });
await step(95);
const rs = await ev(() => { const s = window.__S; return { ramp: s.hatch.ramp, kneel: s.kneel }; });
check(rs.ramp === 1 && Math.abs(rs.kneel - 0.5) < 1e-6, 'the ramp is down, the ship kneels (' + rs.ramp + ', ' + rs.kneel + ')');
// a look at it from behind, a little to the side
await ev((C) => { const g = VR.game, s = window.__S, cb = g.starships.cabin, p = g.player; const e = cb.toWorld(s, [3.2, 0, C.zT + 8.5]); p.teleport(e[0], g.world.topAt(Math.floor(e[0]), Math.floor(e[2])) + 1, e[2]); p.yaw = s.yaw + 0.33; p.pitch = -0.1; }, C);
await step(20);
const r0 = await shot('cab_ramp');
check(r0.cab > 0, 'with the ramp down the furnished cabin shows through it (' + r0.cab + ' triangles)');
// walk up to the ramp's foot and aboard
await ev((C) => { const g = VR.game, s = window.__S, cb = g.starships.cabin, p = g.player; const z = C.ramp.hinge[2] + cb.rampRun(C) + 1.4, e = cb.toWorld(s, [0, 0, z]); p.teleport(e[0], g.world.topAt(Math.floor(e[0]), Math.floor(e[2])) + 1, e[2]); p.yaw = s.yaw; p.pitch = 0; }, C);
await step(15);
await keys(['KeyW']);
let w = null; for (let i = 0; i < 12; i++) { await step(5); w = await Wk(); if (w.riding === 'cabin') break; }
check(w && w.riding === 'cabin', 'walking onto the ramp\'s foot takes you aboard (' + JSON.stringify(w) + ')');
w = await walkTo(0, C.zEnd - 0.6, 120);
check(w.p && Math.abs(w.p[1] - C.floor) < 0.06, 'up the ramp into the cargo bay (' + JSON.stringify(w.p) + ')');

console.log('2 · through the ship');
w = await walkTo(-C.side * 0.0, C.zC + 3.2, 200);
await look(0, -0.08);
const r1 = await shot('cab_bay');
check(r1.cab > 0 && r1.ck > 0 && r1.ck + r1.cab <= 25000, 'cargo bay: interior ' + (r1.ck + r1.cab) + ' triangles ≤ 25k (cockpit ' + r1.ck + ' + cabin ' + r1.cab + ')');
await look(Math.PI, -0.05);
await shot('cab_back');
const aisle = -Math.sign(C.table.x) * 0.45;
w = await walkTo(aisle, C.table.z + 0.2, 200);
await look(C.table.x > 0 ? -Math.PI / 2 - 0.35 : Math.PI / 2 + 0.35, -0.3);
const r2 = await shot('cab_cabin');
// the holo table: aim + click opens the big map
await look(Math.atan2(-(C.table.x - w.p[0]), -(C.table.z - w.p[2])), -0.55);
await step(2);
const hv = await ev(() => { const h = VR.game.starships.cabin.hover; return h ? h.c.label : null; });
check(hv === 'Karte', 'aiming at the holo table: ' + hv);
await ev(() => { const g = VR.game; g.input.mouse.clicked[0] = true; g.last = performance.now() - 33; g.loop(performance.now()); });
const mapOpen = await ev(() => VR.game.ui.screen);
check(mapOpen === 'mapscreen', 'a click on it opens the big map (' + mapOpen + ')');
await ev(() => { const g = VR.game; g.ui.resume(); g.input.captured = true; });
await step(3);
w = await walkTo(0, C.zIn + 1.1, 200);
const cd = await ev(() => window.__S.hatch.cdoor);
check(cd > 0.9, 'the cockpit door slid open as you came (' + cd.toFixed(2) + ')');
await look(0, -0.12);
const r3 = await shot('cab_door');
check(r3.ck > 0 && r3.cab > 0, 'through the open door: the furnished cockpit (' + r3.ck + ') behind the cabin (' + r3.cab + ')');
w = await walkTo(0, C.ckZb - 0.5, 120);
check(w.p && Math.abs(w.p[1] - C.ckFloor) < 0.06, 'up the steps into the cockpit (' + JSON.stringify(w.p) + ')');

console.log('3 · the pilot seat, standing up in flight');
await press('KeyV'); await step(3);
let st = await ev(() => { const g = VR.game; return { riding: g.gadgets.riding && g.gadgets.riding.type, pilot: g.starships.pilot === window.__S, cdoorOpen: window.__S.hatch.cdoorOpen }; });
check(st.riding === 'starship' && st.pilot && !st.cdoorOpen, 'V: in the pilot seat, the door shuts behind you (' + JSON.stringify(st) + ')');
// the ramp comes up, power up, take off, hover
await ev(() => { const fl = VR.game.flight; fl.setRamp(false); fl.setPower(true); fl.startEngines(); });
await step(100);
await keys(['Space']); await step(60); await keys([], ['Space']); await press('KeyX'); await step(60);
const fh = await ev(() => { const fl = VR.game.flight; return { state: fl.state, alt: +(fl.alt || 0).toFixed(1), speed: +fl.speed.toFixed(2), ramp: window.__S.hatch.ramp }; });
check(fh.state === 'flying' && fh.alt > 8 && fh.speed < 1 && fh.ramp === 0, 'took off and hovers, ramp shut (' + JSON.stringify(fh) + ')');
// the gamepad: RT is the throttle
await ev(() => {
  const B = () => ({ pressed: false, value: 0 }), pad = { connected: true, buttons: Array.from({ length: 17 }, B), axes: [0, 0, 0, 0] };
  window.__pad = pad; navigator.getGamepads = () => [pad];
});
const t0 = await ev(() => VR.game.flight.throttle);
await ev(() => { window.__pad.buttons[7] = { pressed: true, value: 1 }; }); await step(20);
const t1 = await ev(() => VR.game.flight.throttle);
await ev(() => { window.__pad.buttons[7] = { pressed: false, value: 0 }; }); await step(2);
check(t1 > t0 + 0.2, 'gamepad RT pushes the throttle (' + t0.toFixed(2) + ' → ' + t1.toFixed(2) + ')');
await ev(() => { window.__pad.buttons[1] = { pressed: true, value: 1 }; }); await step(2); await ev(() => { window.__pad.buttons[1] = { pressed: false, value: 0 }; });
await step(90);
const up = await ev(() => { const g = VR.game, s = window.__S; const ok = g.starships.cabin.standUp(s); return ok; });
await step(3);
const y0 = await ev(() => VR.game.player.pos[1]);
await ev(() => { VR.game.starships.cabin.w.s.flight.holdAlt += 5; });
await step(90);
st = await ev(() => { const g = VR.game, w = g.starships.cabin.w; return { riding: g.gadgets.riding && g.gadgets.riding.type, state: window.__S.flight.state, y: g.player.pos[1], local: w && w.p[1] }; });
check(up && st.riding === 'cabin' && st.state === 'flying' && st.y - y0 > 3, 'out of the seat while it hovers: you walk, it carries you up (Δy ' + (st.y - y0).toFixed(1) + ' m, deck ' + (st.local || 0).toFixed(2) + ')');
// the gamepad's left stick walks
const z0 = await ev(() => VR.game.starships.cabin.w.p[2]);
await look(Math.PI, 0);
await ev(() => { window.__pad.axes[1] = -1; }); await step(25); await ev(() => { window.__pad.axes[1] = 0; }); await step(3);
const z1 = await ev(() => VR.game.starships.cabin.w.p[2]);
check(z1 - z0 > 0.8, 'gamepad left stick walks (z ' + z0.toFixed(2) + ' → ' + z1.toFixed(2) + ')');
await ev(() => { navigator.getGamepads = () => []; });
// back to the seat, land
await press('KeyV'); await step(3);
await press('KeyV'); for (let i = 0; i < 12; i++) { await step(20); if (await ev(() => VR.game.flight && VR.game.flight.state === 'landed')) break; }
st = await ev(() => { const g = VR.game; return { pilot: g.starships.pilot === window.__S, state: g.flight && g.flight.state }; });
check(st.pilot && st.state === 'landed', 'V sits you back down, V lands it (' + JSON.stringify(st) + ')');

console.log('4 · out of the side door, down the stair');
await ev(() => { VR.game.starships.cabin.standUp(window.__S); });
await step(3);
await ev((C) => { const w = VR.game.starships.cabin.w, D = C.door; w.p = [D.side * (C.wx - 0.6), C.floor, D.z]; w.yaw = D.side < 0 ? Math.PI / 2 : -Math.PI / 2; w.pitch = 0; VR.game.starships.cabin.toggleDoor(window.__S, true); }, C);
await step(60);
const dd = await ev(() => window.__S.hatch.door);
check(dd === 1, 'the side door is open (' + dd + ')');
await keys(['KeyW']);
let outside = false; for (let i = 0; i < 16; i++) { await step(10); const q = await Wk(); if (!q.riding) { outside = true; break; } }
await keys([], ['KeyW']); await step(10);
const pg = await ev(() => { const g = VR.game, p = g.player; return { y: p.pos[1], ground: g.world.topAt(Math.floor(p.pos[0]), Math.floor(p.pos[2])) + 1 }; });
check(outside && Math.abs(pg.y - pg.ground) < 0.6, 'walked out of the door and down the stair (y ' + pg.y.toFixed(2) + ', ground ' + pg.ground + ')');
// the stair from outside
await ev((C) => { const g = VR.game, s = window.__S, cb = g.starships.cabin, p = g.player, D = C.door; const e = cb.toWorld(s, [D.side * (C.wx + 4.5), 0, D.z + 2.2]); p.teleport(e[0], g.world.topAt(Math.floor(e[0]), Math.floor(e[2])) + 1, e[2]); p.yaw = s.yaw + (D.side < 0 ? -1 : 1) * (Math.PI / 2 - 0.45); p.pitch = -0.12; }, C);
await step(15);
await shot('cab_stair');

console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 20)) console.log(l);
check(!logs.some(l => /pageerror|TypeError|ReferenceError/.test(l)), 'no page errors');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
await browser.close();
process.exit(fails ? 1 : 0);
