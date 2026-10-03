import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 500)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(15); } };
const shot = async (name) => { await ev((tod) => { window.__norender = false; const g = VR.game; g.env.setTime(tod); g.env.rain = 0; g.env.rainTarget = 0; g.last = performance.now() - 33; g.loop(performance.now()); g.renderer.gl.finish(); window.__norender = true; }, +(process.env.TOD || 4200)); await wait(150); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 90000 }); console.log('shot', name); };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.settings.renderDist = 6; g.settings.dynRes = false; g.settings.minimap = false; g.applySettings('renderDist'); });
await ev(`VR.game.createWorld({name:'Star',mode:'creative',difficulty:'normal',type:'${process.env.WTYPE || 'default'}',seed:'${process.env.SEED || '424242'}',cheats:true,kit:true})`);
for (let i = 0; i < 40; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.hideHud = true; document.getElementById('hud').style.visibility = 'hidden'; g.env.setTime(5200); });
if (process.env.WTYPE !== 'flat') {
  const out = await ev(() => new Promise((res) => { const g = VR.game, p = g.player; g.pool.direct(0, { type: 'locate', dim: 'overworld', biome: 'outpost', x: Math.floor(p.pos[0]), z: Math.floor(p.pos[2]) }, null, (m) => res(m.pos)); }));
  await ev((o) => { const p = VR.game.player; p.teleport(o[0] + 0.5, o[1] + 12, o[2] + 0.5); p.flying = true; }, out);
}
for (let i = 0; i < 16; i++) { await step(20); await wait(250); }
// frame each arch next to the outpost ship
const archs = (process.env.ARCHS || 'parked,shuttle,interceptor,gunship,freighter,cruiser').split(',');
for (const a of archs) {
  if (a !== 'parked') {
    await ev((arch) => { const g = VR.game, SS = g.starships; for (const s of SS.ships) s.hidden = true; const p = g.player; SS.placeInFront((Math.random() * 1e9) >>> 0, arch, null, p); }, a);
    for (let i = 0; i < 8; i++) { await step(4); await wait(200); }
  }
  await ev(() => { const g = VR.game, SS = g.starships; const s = SS.ships[SS.ships.length - 1]; if (!s || !s.d.meta) return; const m = s.d.meta; const p = g.player; const r = Math.max(m.length, m.width) * 0.95 + 4; const ang = -2.2; const cx = s.pos[0] + Math.sin(ang) * r, cz = s.pos[2] + Math.cos(ang) * r; p.teleport(cx, s.pos[1] + m.height * 0.9, cz); p.flying = true; const dx = s.pos[0] - cx, dz = s.pos[2] - cz; p.yaw = Math.atan2(-dx, -dz); p.pitch = -0.28; });
  await step(4);
  await shot('look_' + a);
}
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 20)) console.log(l);
await browser.close();
