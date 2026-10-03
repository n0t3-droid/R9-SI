import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 900)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(5); } };
const shot = async (name, tod) => { await ev((tod) => { window.__norender = false; const g = VR.game; if (tod !== undefined) g.env.setTime(tod); g.env.rain = 0; g.env.rainTarget = 0; g.last = performance.now() - 33; g.loop(performance.now()); g.renderer.gl.finish(); window.__norender = true; }, tod); await wait(150); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 120000 }); console.log('shot', name); };
const settle = async (max = 60) => { for (let i = 0; i < max; i++) { await step(10); const s = await ev(() => { const g = VR.game; return { busy: g.pool.busy, pend: g.world.pending.size, lod: g.horizon ? g.horizon.inflight : 0, want: g.world.lastWant || 0 }; }); if (s.busy === 0 && s.pend === 0 && s.lod === 0 && !s.want && i > 3) break; await wait(100); } };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(([hz]) => { const g = VR.game; g.settings.renderDist = 7; g.settings.dynRes = false; g.settings.minimap = false; g.settings.horizon = hz; g.applySettings('renderDist'); }, [+(process.env.HZ || 2)]);
await ev((seed) => VR.game.createWorld({ name: 'Horizon', mode: 'creative', difficulty: 'peaceful', type: 'default', seed, cheats: true, kit: false }), process.env.SEED || '777');
for (let i = 0; i < 60; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { VR.game.env.setTime(3000); VR.game.zenFreezeTime = true; window.requestAnimationFrame = () => 0; VR.game.hideHud = true; document.getElementById('hud') && (document.getElementById('hud').style.visibility = 'hidden'); });
await wait(300);
const t0 = Date.now();
await settle(120);
const st = await ev(() => { const h = VR.game.horizon; return { tiles: h.tiles.size, drawn: h.drawList.length, radius: h.radius, enabled: h.enabled() }; });
console.log('horizon settled in', ((Date.now() - t0) / 1000).toFixed(1), 's', JSON.stringify(st));
const sp = await ev(() => VR.game.player.pos.slice());
const view = async (name, dx, dy, dz, yaw, pitch, tod) => {
  await ev(([sp, dx, dy, dz, yaw, pitch]) => { const p = VR.game.player; p.teleport(sp[0] + dx, sp[1] + dy, sp[2] + dz); p.flying = true; p.yaw = yaw; p.pitch = pitch; }, [sp, dx, dy, dz, yaw, pitch]);
  await settle(80);
  await shot(name, tod);
  const s2 = await ev(() => { const h = VR.game.horizon, r = VR.game.renderer; return { tiles: h.tiles.size, drawn: h.stats.drawn, tris: Math.round(h.stats.tris / 1000) + 'k', allTris: Math.round(r.stats.tris / 1000) + 'k', mb: +h.stats.mb.toFixed(1) }; });
  console.log(name, JSON.stringify(s2));
};
await view('hz_' + (process.env.TAG || 'a') + '_ground', 0, 2, 0, 0.6, -0.02, 3000);
await view('hz_' + (process.env.TAG || 'a') + '_high', 0, 60, 0, 2.2, -0.18, 3000);
await view('hz_' + (process.env.TAG || 'a') + '_gold', 0, 40, 0, 4.0, -0.08, 11600);
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 25)) console.log(l);
await browser.close();
