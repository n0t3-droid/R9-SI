// Trailer shots F (Palm City Nova Haven) and G (the white interior) and the hills behind the city: the game's picture
// of each shot at the frames' dusk, to set beside docs/trailer/frames (t1_26–t3_10). Showcase, not a check.
// usage: TAG=before bash test/wt_run.sh trailer_fg.mjs 1800   → test/shots/trailer_<shot>_<TAG>.png
// regress: skip
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const TAG = process.env.TAG || 'before';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const SEED = process.env.SEED || '4242';
const TOD = +(process.env.TOD || 13300);   // dusk: the sun just under the horizon, the stars out
// [name, pos, yaw, pitch] — yaw 0 looks along −z, forward = (−sin yaw, ·, −cos yaw)
const SHOTS = [
  ['F1_avenue', [0.5, 82.2, -62.5], 0, -0.10],
  ['F2_plaza', [-14.5, 82.2, -128.5], -0.82, -0.12],
  ['F3_villas', [22.5, 82.2, -150.5], 0.55, -0.10],
  ['F4_crescent', [-38.5, 82.2, -170.5], -0.9, -0.14],
  ['F5_north', [6.5, 82.2, -196.5], 0.1, -0.08],
  ['F6_palms', [-4.5, 82.2, -110.5], 0.3, -0.25],
  ['G1_interior', [16.5, 82.2, -144.4], Math.PI, -0.15],
  ['G2_interior', [13.5, 82.2, -141.5], Math.PI * 0.75, -0.12],
  ['H1_hills', [0.5, 84.2, -212.5], 0, -0.06],
  ['H2_hills', [-150.5, 90.2, -240.5], 0.4, -0.10],
];
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail|missing/i.test(s)) logs.push(`[${t}] ${s.slice(0, 700)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto(process.env.DIST || 'file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 16) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(4); } };
const settle = async (max = 60) => { for (let i = 0; i < max; i++) { await step(10); const s = await ev(() => { const g = VR.game; let dirty = 0; for (const c of g.world.cols.values()) for (const sc of c.sec) if (sc.dirty || sc.pending) dirty++; return { busy: g.pool.busy, pend: g.world.pending.size, dirty }; }); if (s.busy === 0 && s.pend === 0 && s.dirty === 0 && i > 2) break; await wait(60); } };
const shot = async (name, frames = 3) => { await ev((frames) => { window.__norender = false; const g = VR.game; for (let i = 0; i < frames; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }, frames); await page.screenshot({ path: `/home/claude/vr/test/shots/trailer_${name}_${TAG}.png`, timeout: 180000 }); console.log('shot', name, TAG); };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.settings.renderDist = 8; g.settings.horizon = 1; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Trailer FG',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:true})`);
for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev((tod) => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.display = 'none'; g.env.setTime(tod); }, TOD);
await settle(60);
const EXPECT = 0;
for (const [name, pos, yaw, pitch] of SHOTS) {
  if (ONLY && !ONLY.some(o => name.startsWith(o))) continue;
  await ev(([pos, yaw, pitch]) => { const g = VR.game, p = g.player; p.flying = true; p.noclip = true; p.teleport(pos[0], pos[1], pos[2]); p.yaw = yaw; p.pitch = pitch; p.fovKick = 0; }, [pos, yaw, pitch]);
  await settle(40);
  await step(6);
  await shot(name, 3);
}
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 12)) console.log(l);
console.log(EXPECT === 0 && logs.filter(l => l.startsWith('[pageerror]')).length === 0 ? 'SHOTS DONE' : 'SHOTS WITH PAGE ERRORS');
await browser.close();
