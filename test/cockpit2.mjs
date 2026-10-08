// The furnished cockpit: a cold shuttle out in the open, aim + left click on its real controls — the guarded POWER
// switch, START (3 s spool-up), the gear lever (toggles and animates), the ramp switch (refuses above 8 m/s), the
// throttle (a click in its slot sets it), the guarded weapons switch (lasers only when armed); the kit comes from a
// worker (no stutter when boarding); the triangle / draw-call budget (and fewer voxels on Very Low); screenshots of
// the cockpit by day, looking at the switch deck, and at dusk with the lights on. PRESET (default low).
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
// step the game loop by hand (no rendering); window.__inj = { hit: [codes], click: button } feeds one frame
const step = async (n, dtms = 33) => {
  for (let k = 0; k < n; k += 10) {
    await ev(([m, d]) => {
      const g = VR.game;
      if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; }
      window.__norender = true;
      for (let i = 0; i < m; i++) {
        const J = window.__inj, I = g.input;
        // a click: the button goes down and comes up again within this frame
        let btn = -1;
        if (J) { if (J.hit && J.hit.length) { I.pressed.add(J.hit.shift()); } if (J.click !== undefined && J.click !== null) { btn = J.click; I.mouse.clicked[btn] = true; I.mouse.down[btn] = true; J.click = null; } }
        g.last = performance.now() - d; g.loop(performance.now());
        if (btn >= 0) I.mouse.down[btn] = false;
      }
    }, [Math.min(10, n - k), dtms]);
    await wait(12);
  }
};
// render real frames (the screens & HUD repaint first), then a screenshot
const shot = async (name) => {
  const ms = await ev(() => { window.__norender = false; const g = VR.game; g.env.rain = 0; g.env.rainTarget = 0; let t = 0; for (let i = 0; i < 2; i++) { const t0 = performance.now(); g.last = performance.now() - 33; g.loop(performance.now()); g.renderer.gl.finish(); t = performance.now() - t0; } window.__norender = true; return t; });
  await wait(200); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 120000 }); console.log('  shot', name, Math.round(ms) + ' ms');
  return ms;
};
// one key press per frame (several queue up)
const press = (...codes) => ev((c) => { window.__inj = window.__inj || {}; window.__inj.hit = (window.__inj.hit || []).concat(c); }, codes);
const click = () => ev(() => { window.__inj = window.__inj || {}; window.__inj.click = 0; });
const keys = (add, del) => ev(([a, d]) => { const I = VR.game.input; for (const c of d || []) I.keys.delete(c); for (const c of a || []) I.keys.add(c); }, [add || [], del || []]);
// turn the head toward a control (ship frame) and report what the crosshair is on
const aim = async (id) => {
  await ev((id) => {
    const g = VR.game, fl = g.flight, K = g.cockpit.kit(fl), c = K.def.controls.find(q => q.id === id), e = fl.b.eye, ox = fl.b.cockpit.ox || 0;
    const dx = c.p[0] + ox - e[0], dy = c.p[1] - e[1], dz = c.p[2] - e[2];
    fl.headYaw = Math.atan2(-dx, -dz); fl.headPitch = Math.atan2(dy, Math.hypot(dx, dz)); fl.recenter = false;
  }, id);
  await step(3);
  return ev(() => { const h = VR.game.cockpit.hover; return h ? h.c.id : null; });
};
const F = () => ev(() => { const g = VR.game, fl = g.flight; if (!fl) return null; const I = fl.info(); return { power: fl.power, state: fl.state, gear: +fl.gear.toFixed(3), gearDown: fl.gearDown, ramp: fl.rampOpen, armed: fl.armed, speed: +fl.speed.toFixed(2), aGear: fl.anim.a_gear, thr: I.throttle, alt: fl.alt, name: fl.b.name }; });

for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.renderDist = 5; g.settings.minimap = false; g.applySettings('*'); }, process.env.PRESET || 'low');
await ev(`VR.game.createWorld({name:'Cockpit',mode:'creative',difficulty:'peaceful',type:'default',seed:'${process.env.SEED || '424242'}',cheats:true,kit:true})`);
for (let i = 0; i < 160; i++) { await wait(500); if (await ev(() => VR.game.state === 'play' && VR.game.player && !VR.game.player.hold)) break; }
// out in the open, a little away from an outpost
const out = await ev(() => new Promise((res) => { const g = VR.game, p = g.player; g.pool.direct(0, { type: 'locate', dim: 'overworld', biome: 'outpost', x: Math.floor(p.pos[0]), z: Math.floor(p.pos[2]) }, null, (m) => res(m.pos)); }));
await ev((o) => { const g = VR.game, p = g.player; p.teleport(o[0] + 70.5, o[1] + 12, o[2] + 4.5); p.flying = true; p.yaw = 1.2; p.pitch = 0; g.env.setTime(4200); g.zenFreezeTime = true; window.requestAnimationFrame = () => 0; g.input.captured = true; }, out);
for (let i = 0; i < 16; i++) { await step(10); await wait(150); }
await ev(() => { const g = VR.game, p = g.player, w = g.world; const x = Math.floor(p.pos[0]), z = Math.floor(p.pos[2]); p.teleport(x + 0.5, w.topAt(x, z) + 1, z + 0.5); p.flying = false; });
await step(10);
const key = await ev(() => { const g = VR.game; return g.starships.placeInFront(12345, 'shuttle', null, g.player).key; });
for (let i = 0; i < 60; i++) { await step(5); if (await ev((k) => VR.game.starships.ships.some(s => s.d.key === k && s.d.meta && s.d.cells), key)) break; await wait(150); }
await ev((k) => { const g = VR.game, s = g.starships.ships.find(q => q.d.key === k); g.starships.board(s, g.player); }, key);
// the kit comes from a worker: boarding doesn't wait for it
const tBoard = await ev(() => { const t0 = performance.now(); VR.game.last = performance.now() - 33; VR.game.loop(performance.now()); return performance.now() - t0; });
let kitFrames = 0;
for (let i = 0; i < 100; i++) { if (await ev(() => VR.game.cockpit.ready(VR.game.flight))) break; await step(1); kitFrames++; await wait(60); }

console.log('1 · a cold cockpit: guarded POWER, then START');
let f = await F();
check(f && f.power === 'off' && f.state === 'landed' && /^SH-/.test(f.name), 'boarded the shuttle: cold and dark (' + (f && f.name + ', ' + f.power) + ')');
const room = await ev(() => { const g = VR.game, fl = g.flight, K = g.cockpit.kit(fl); return { room: !!fl.b.cockpit && !fl.b.consoleOnly, ctl: K ? K.def.controls.map(c => c.id) : [], ms: K ? K.def.ms : -1 }; });
check(room.room && room.ctl.length >= 9, 'the shuttle has a furnished cockpit with ' + room.ctl.length + ' controls (' + room.ctl.join(' ') + '), built in a worker in ' + room.ms + ' ms, there ' + kitFrames + ' frames after boarding (that frame took ' + Math.round(tBoard) + ' ms)');
let on = await aim('power');
check(on === 'power', 'aiming at the POWER switch picks it (' + on + ')');
const lbl = await ev(() => { const h = VR.game.cockpit.hover; return h ? h.c.label : null; });
check(lbl === 'Energie', 'its label is one German word: ' + lbl);
await click(); await step(2); f = await F();
const guard = await ev(() => VR.game.flight.anim.guard_power);
check(f.power === 'off' && guard > 0.5, 'first click lifts the guard (power still ' + f.power + ')');
await step(10); await click(); await step(2); f = await F();
check(f.power === 'on', 'second click flips POWER on (' + f.power + ')');
if (process.env.SHOTS !== '0') await shot('ck_power');
on = await aim('start'); await click(); await step(3); f = await F();
check(on === 'start' && f.power === 'starting', 'START spins the engines up (' + f.power + ')');
await step(45); f = await F();
check(f.power === 'starting', 'still spooling after 1.5 s');
await step(60); f = await F();
check(f.power === 'running', 'running after 3 s (' + f.power + ')');

console.log('2 · the gear lever, the throttle');
on = await aim('gear'); await click(); await step(3);
f = await F();
check(on === 'gear' && f.gearDown && f.state === 'landed', 'on the ground the gear lever refuses (gear stays down)');
await keys(['Space']); await step(70); await keys([], ['Space']); await step(30);
await ev(() => { const fl = VR.game.flight; fl.headYaw = 0; fl.headPitch = 0; });
await step(40); f = await F();
check(f.state === 'flying' && f.alt > 12 && f.gear < 0.05 && !f.gearDown, 'hovering at ' + (f.alt || 0).toFixed(0) + ' m the gear came up by itself (' + f.gear + ')');
on = await aim('gear');
check(on === 'gear', 'aiming at the gear lever (' + on + ')');
const a0 = f.aGear;
await click(); await step(2); f = await F();
const a1 = f.aGear;
await step(12); const f2 = await F();
check(f.gearDown === true, 'click: the gear lever goes down (' + f.gearDown + ')');
check(a0 < -0.4 && f2.aGear > a1 && f2.aGear > 0.4, 'the lever animates (' + [a0, a1, f2.aGear].map(v => (v || 0).toFixed(2)).join(' → ') + ')');
await step(40); f = await F();
check(f.gear > 0.98, 'and the gear extends (' + f.gear + ')');
await click(); await step(60); f = await F();
check(!f.gearDown && f.gear < 0.02, 'click again: gear up (' + f.gear + ')');
on = await aim('throttle');
const thrAt = await ev(() => { const fl = VR.game.flight; return [fl.throttle, VR.game.cockpit.hover && VR.game.cockpit.hover.hit]; });
await click(); await step(2); f = await F();
check(on === 'throttle' && f.thr > 0.2 && f.thr < 0.8, 'a click in the throttle\'s slot sets it (' + thrAt[0].toFixed(2) + ' → ' + f.thr.toFixed(2) + ')');
await press('KeyX'); await step(4);
if (process.env.SHOTS !== '0') { await ev(() => { const fl = VR.game.flight; fl.headYaw = 0.75; fl.headPitch = -0.55; }); await step(3); await shot('ck_console'); }

console.log('3 · the ramp switch refuses above 8 m/s');
await ev(() => { VR.game.flight.headYaw = 0; VR.game.flight.headPitch = 0; });
await keys(['KeyW']); await step(45); await keys([], ['KeyW']); await step(10); f = await F();
on = await aim('ramp'); await click(); await step(2); const fr = await F();
check(on === 'ramp' && fr.speed > 8 && !fr.ramp, 'at ' + fr.speed.toFixed(1) + ' m/s the ramp stays shut');
await press('KeyX'); await step(150); f = await F();
await click(); await step(2); const fr2 = await F();
check(fr2.speed < 8 && fr2.ramp, 'hovering (' + fr2.speed.toFixed(1) + ' m/s) it opens');
await click(); await step(2);

console.log('4 · lasers only when the weapons are armed');
await ev(() => { VR.game.flight.headYaw = 0; VR.game.flight.headPitch = 0.2; });
await step(3);
const bolts = () => ev(() => VR.game.entities ? VR.game.entities.bolts.length : -1);
let b0 = await bolts(); await click(); await step(2); let b1 = await bolts();
check(b1 === b0, 'not armed: a click into the sky fires nothing (' + b0 + ' → ' + b1 + ')');
on = await aim('weapons'); await click(); await step(4);
const gw = await ev(() => VR.game.flight.anim.guard_weapons);
await click(); await step(2); f = await F();
check(on === 'weapons' && gw > 0.5 && f.armed, 'guard up, switch flipped: weapons armed (guard ' + gw + ', armed ' + f.armed + ')');
await ev(() => { VR.game.flight.headYaw = 0; VR.game.flight.headPitch = 0.2; });
await step(3); b0 = await bolts(); await click(); await step(1); b1 = await bolts();
check(b1 > b0, 'armed: the click fires (' + b0 + ' → ' + b1 + ')');

console.log('5 · budget');
const bud = await ev(() => {
  const g = VR.game, fl = g.flight, K = g.cockpit.kit(fl), C = fl.b.cockpit, pal = fl.b.palette && fl.b.palette.key;
  const full = VR.CockpitKit.job({ C, pal, res: 32 }), potato = VR.CockpitKit.job({ C, pal, res: 16 });
  return { tris: Math.round(K.tris), ms: K.def.ms, draws: g.cockpit.lastDraws, full: { tris: full.tris, vox: full.vox }, potato: { tris: potato.tris, vox: potato.vox }, hullTris: Math.round(fl.b.ship.d.meta.tris) };
});
console.log('  ' + JSON.stringify(bud));
check(bud.tris <= 25000, 'cockpit interior ' + bud.tris + ' triangles ≤ 25k');
check(bud.draws > 0 && bud.draws <= 30, 'cockpit draw calls ' + bud.draws + ' ≤ 30');
check(bud.potato.vox < bud.full.vox / 4 && bud.potato.tris < bud.full.tris, 'Very Low: half the voxel size — ' + bud.potato.vox + ' vs ' + bud.full.vox + ' voxels, ' + bud.potato.tris + ' vs ' + bud.full.tris + ' triangles');
// frame time, cockpit vs. chase (one real frame each, SwiftShader)
await ev(() => { VR.game.flight.headYaw = 0; VR.game.flight.headPitch = -0.12; });
const tCock = await shot('ck_day');
await press('KeyC'); await step(30);
const tChase = await shot('ck_chase');
await press('KeyC', 'KeyC'); await step(4);
console.log('  frame ms: cockpit ' + Math.round(tCock) + ' · chase ' + Math.round(tChase) + ' (SwiftShader)');
check(await ev(() => VR.game.flight.view) === 0, 'C cycles back to the cockpit');
// dusk with the cockpit lights on
await ev(() => { const g = VR.game; g.env.setTime(13200); g.flight.setLights(true); g.flight.headYaw = -0.35; g.flight.headPitch = -0.3; });
await step(10);
await shot('ck_dusk');

console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 20)) console.log(l);
check(!logs.some(l => /pageerror|TypeError|ReferenceError/.test(l)), 'no page errors');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
await browser.close();
process.exit(fails ? 1 : 0);
