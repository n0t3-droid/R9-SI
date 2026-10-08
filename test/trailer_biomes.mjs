// Trailer biomes (t-biomes): the endless world must look like the trailer's world, not only the Heartland.
// Seed 1: fly 2 km from the spawn in a fixed direction (A = 1.8 rad: mostly +z, a little −x), stop there and take six looks
// at what the land offers: the vista ahead, the vista ahead steeply down, left, right, the sky, and a view from
// 70 blocks above. The pictures are compared with the trailer's vista frames (docs/trailer/frames/t1_01, t1_03,
// t3_01, t3_02). The test checks only what the game does: it loads, flies, takes the six pictures without a page
// error, and reports the surface heights it saw. The evidence is the pictures.
//   nohup bash test/wt_run.sh trailer_biomes.mjs 1800 > .tmp_tests/trailer_biomes.log 2>&1 &
// TAG=before|after (default after) names the pictures test/shots/trailer_biomes_<TAG>_<n>_<look>.png
// SEED=1 (default) · DIST=2000 · PRESET=high · DIST_URL=file:///…/dist/index.html (another build)
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const TAG = process.env.TAG || 'after';
const SEED = process.env.SEED || '1';
const DIST = +(process.env.DIST || 2000);
const A = 1.8;                                            // the fixed flight direction (radians: mostly +z, a little −x)
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 700)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto(process.env.DIST_URL || 'file:///home/claude/vr/dist/index.html');   // DIST_URL: another build (the before pictures: a build of HEAD)
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 16) => {
  for (let k = 0; k < n; k += 10) {
    await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]);
    await wait(4);
  }
};
// the chunks around the player are generated and meshed (the worker pool idle, no column dirty or pending)
const settle = async (max = 90) => {
  for (let i = 0; i < max; i++) {
    await step(10);
    const s = await ev(() => { const g = VR.game; let dirty = 0; for (const c of g.world.cols.values()) for (const sc of c.sec) if (sc.dirty || sc.pending) dirty++; return { busy: g.pool.busy, pend: g.world.pending.size, dirty, cols: g.world.cols.size }; });
    if (s.busy === 0 && s.pend === 0 && s.dirty === 0 && i > 2) return s;
    await wait(80);
  }
  return null;
};
const shot = async (name) => {
  await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 3; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; });
  await page.screenshot({ path: `/home/claude/vr/test/shots/trailer_biomes_${TAG}_${name}.png`, timeout: 180000 });
  console.log('shot', `trailer_biomes_${TAG}_${name}`);
};
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.renderDist = 8; g.settings.horizon = 2; g.applySettings('*'); }, process.env.PRESET || 'high');
await ev(`VR.game.createWorld({name:'Trailer Biomes',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:true})`);
for (let i = 0; i < 120; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; g.env.setTime(5200); g.hideHud = true; const u = document.getElementById('ui'); if (u) u.style.visibility = 'hidden'; const e = g.entities; if (e && e.mobs) e.mobs.length = 0; });
const spawn = await ev(() => VR.game.player.pos.slice());
await settle(120);
console.log('spawn', spawn.map(v => +v.toFixed(1)).join(', '));
// the flight: 2 km along A, first high above the land so the chunks there load, then down to the ground
const tx = spawn[0] + DIST * Math.cos(A), tz = spawn[2] + DIST * Math.sin(A);
// the camera's forward vector is (−sin yaw, −cos yaw): yaw points the view along (cos A, sin A)
const yawA = Math.atan2(-Math.cos(A), -Math.sin(A));
const fly = (pos, yaw, pitch) => ev(([pos, yaw, pitch]) => { const g = VR.game, p = g.player; p.flying = true; p.noclip = true; p.teleport(pos[0], pos[1], pos[2]); p.yaw = yaw; p.pitch = pitch; p.fovKick = 0; }, [pos, yaw, pitch]);
await fly([tx, 250, tz], yawA, -0.1);
const loaded = await settle(240);
const top = await ev(([x, z]) => { const w = VR.game.world; return w.topAt(Math.floor(x), Math.floor(z)); }, [tx, tz]);
const ground = Math.max(top, 40) + 1;
console.log('flight target', [tx, tz].map(v => v.toFixed(0)).join(', '), 'ground y', top, 'settled', JSON.stringify(loaded));
await fly([tx, ground + 40, tz], yawA, -0.08);
await settle(240);
const look = async (n, name, pos, yaw, pitch) => { await fly(pos, yaw, pitch); await settle(90); await ev(() => { const e = VR.game.entities; if (e && e.mobs) e.mobs.length = 0; }); await step(6); await shot(`${n}_${name}`); };
const Y = ground + 40;
await look(1, 'vista', [tx, Y, tz], yawA, -0.07);
await look(2, 'down', [tx, Y, tz], yawA, -0.55);
await look(3, 'left', [tx, Y, tz], yawA - 0.95, -0.12);
await look(4, 'right', [tx, Y, tz], yawA + 0.95, -0.12);
await look(5, 'sky', [tx, Y, tz], yawA, 0.22);
await look(6, 'above', [tx, ground + 110, tz], yawA, -0.42);
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 12)) console.log(l);
console.log(logs.length === 0 ? 'ALL OK' : 'FAILED ' + logs.length);
await browser.close();
