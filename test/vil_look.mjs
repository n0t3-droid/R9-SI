import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || t === 'warning' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 500)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(15); } };
const shot = async (name, tod) => { await ev((tod) => { window.__norender = false; const g = VR.game; g.env.setTime(tod); g.env.rain = 0; g.env.rainTarget = 0; g.last = performance.now() - 33; g.loop(performance.now()); g.renderer.gl.finish(); window.__norender = true; }, tod); await wait(150); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 90000 }); console.log('shot', name); };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.settings.renderDist = +(window.__RD || 6); g.settings.dynRes = false; g.settings.minimap = false; g.applySettings('renderDist'); });
await ev(`VR.game.createWorld({name:'Vil',mode:'creative',difficulty:'normal',type:'default',seed:'${process.env.SEED || '777'}',cheats:true,kit:true})`);
for (let i = 0; i < 60; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.hideHud = true; document.getElementById('hud').style.visibility = 'hidden'; });
for (let i = 0; i < 24; i++) { await step(8); await wait(400); }
const sp = await ev(() => { const p = VR.game.player; return [p.pos[0], p.pos[1], p.pos[2], p.yaw]; });
console.log('spawn', JSON.stringify(sp));
await shot('vil_spawn', 5000);
const look = async (name, pos, tgt, tod) => {
  await ev(([pos, tgt]) => { const p = VR.game.player; p.teleport(pos[0], pos[1], pos[2]); p.flying = true; const dx = tgt[0] - pos[0], dy = tgt[1] - pos[1] - 1.6, dz = tgt[2] - pos[2]; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); }, [pos, tgt]);
  for (let i = 0; i < 6; i++) { await step(4); await wait(300); }
  await shot(name, tod || 5000);
};
const [X, Y, Z] = sp;
await look('vil_aerial', [X + 40, Y + 38, Z + 40], [X, Y, Z]);
await look('vil_aerial2', [X - 45, Y + 30, Z - 20], [X, Y, Z]);
await look('vil_street', [X + 8, Y + 3, Z + 8], [X + 20, Y + 1, Z + 20]);
await look('vil_night', [X + 40, Y + 30, Z + 40], [X, Y, Z], 17800);
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 20)) console.log(l);
await browser.close();
