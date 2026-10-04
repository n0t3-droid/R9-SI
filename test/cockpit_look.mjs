// Look-dev for the furnished cockpit: a shuttle parked out in the open (next to an outpost), boarded, powered up;
// screenshots from the pilot's seat in several head poses, then in the air. Not a test — pictures to look at.
// env: SEED (ship), PAL (palette key), PRESET (low), VIEWS (comma list), TOD, W, H, FLY=0 skips the flight shots.
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
const step = async (n, dtms = 33) => {
  for (let k = 0; k < n; k += 10) {
    await ev(([m, d]) => {
      const g = VR.game;
      if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; }
      window.__norender = true;
      for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); }
    }, [Math.min(10, n - k), dtms]);
    await wait(12);
  }
};
const tag = process.env.TAG || '';
const shot = async (name) => {
  const ms = await ev(() => { window.__norender = false; const g = VR.game; g.env.rain = 0; g.env.rainTarget = 0; let t = 0; for (let i = 0; i < 2; i++) { const t0 = performance.now(); g.last = performance.now() - 33; g.loop(performance.now()); g.renderer.gl.finish(); t = performance.now() - t0; } window.__norender = true; return t; });
  await wait(200); await page.screenshot({ path: `/home/claude/vr/test/shots/ckl_${name}${tag}.png`, timeout: 120000 }); console.log('  shot', name + tag, Math.round(ms) + ' ms');
};
const head = (yaw, pitch) => ev(([y, p]) => { const fl = VR.game.flight; fl.headYaw = y; fl.headPitch = p; fl.recenter = false; }, [yaw, pitch]);

for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.renderDist = 5; g.settings.minimap = false; g.applySettings('*'); }, process.env.PRESET || 'low');
await ev(`VR.game.createWorld({name:'Look',mode:'creative',difficulty:'peaceful',type:'default',seed:'424242',cheats:true,kit:true})`);
for (let i = 0; i < 160; i++) { await wait(500); if (await ev(() => VR.game.state === 'play' && VR.game.player && !VR.game.player.hold)) break; }
const out = await ev(() => new Promise((res) => { const g = VR.game, p = g.player; g.pool.direct(0, { type: 'locate', dim: 'overworld', biome: 'outpost', x: Math.floor(p.pos[0]), z: Math.floor(p.pos[2]) }, null, (m) => res(m.pos)); }));
await ev(([o, yaw, tod]) => { const g = VR.game, p = g.player; p.teleport(o[0] + 70.5, o[1] + 12, o[2] + 4.5); p.flying = true; p.yaw = yaw; p.pitch = 0; g.env.setTime(tod); g.zenFreezeTime = true; window.requestAnimationFrame = () => 0; g.input.captured = true; }, [out, +(process.env.YAW || 1.2), +(process.env.TOD || 4200)]);
for (let i = 0; i < 16; i++) { await step(10); await wait(150); }
// stand on the ground out in the open
await ev(() => { const g = VR.game, p = g.player, w = g.world; const x = Math.floor(p.pos[0]), z = Math.floor(p.pos[2]); p.teleport(x + 0.5, w.topAt(x, z) + 1, z + 0.5); p.flying = false; });
await step(10);
const key = await ev(([seed, pal]) => { const g = VR.game; const d = g.starships.placeInFront(seed, 'shuttle', pal || null, g.player); return d.key; }, [+(process.env.SEED || 12345), process.env.PAL || '']);
for (let i = 0; i < 60; i++) { await step(5); if (await ev((k) => VR.game.starships.ships.some(s => s.d.key === k && s.d.meta && s.d.cells), key)) break; await wait(150); }
await ev((k) => { const g = VR.game, s = g.starships.ships.find(q => q.d.key === k); g.player.flying = false; g.starships.board(s, g.player); }, key);
await step(4);
for (let i = 0; i < 80; i++) { if (await ev(() => VR.game.cockpit.ready(VR.game.flight))) break; await step(2); await wait(100); }
console.log('ship', await ev(() => { const fl = VR.game.flight; return fl.b.name + ' · ' + (fl.b.palette && fl.b.palette.key) + ' · kit ' + VR.game.cockpit.ready(fl); }));
if (process.env.COLD !== '1') { await ev(() => { const fl = VR.game.flight; fl.setPower(true); fl.startEngines(); }); await step(110); }
const views = (process.env.VIEWS || 'fwd,dash,left,ped,right,back,up').split(',');
const POSE = { fwd: [0, -0.06], dash: [0, -0.5], left: [0.85, -0.6], ped: [-0.55, -0.85], right: [-1.25, -0.25], back: [2.5, -0.2], up: [0.25, 0.8], deck: [0.3, -1.1] };
for (const v of views) { if (!POSE[v]) continue; await head(POSE[v][0], POSE[v][1]); await step(3); await shot(v); }
// the stats
console.log('  ' + await ev(() => { const g = VR.game, fl = g.flight, K = g.cockpit.kit(fl); return JSON.stringify({ tris: Math.round(K.tris), ms: K.def.ms, vox: K.def.vox, draws: g.cockpit.lastDraws, hull: Math.round(fl.b.ship.d.meta.tris) }); }));
if (process.env.FLY !== '0') {
  await ev(() => { const i = VR.game.input; i.keys.add('Space'); });
  await step(90);
  await ev(() => { const i = VR.game.input; i.keys.delete('Space'); i.keys.add('KeyW'); });
  await step(90);
  await head(0, -0.08); await step(2); await shot('fly');
  await ev(() => { const i = VR.game.input; i.keys.add('KeyA'); });
  await step(25); await shot('bank');
  await ev(() => { const i = VR.game.input; i.keys.delete('KeyA'); i.keys.delete('KeyW'); });
}
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 20)) console.log(l);
await browser.close();
