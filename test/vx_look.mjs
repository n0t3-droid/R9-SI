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
const shot = async (name, tod) => { await ev((tod) => { window.__norender = false; const g = VR.game; g.env.setTime(tod); g.env.rain = 0; g.env.rainTarget = 0; g.last = performance.now() - 33; g.loop(performance.now()); g.renderer.gl.finish(); window.__norender = true; }, tod); await wait(150); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 90000 }); console.log('shot', name); };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.settings.renderDist = 5; g.settings.dynRes = false; g.settings.minimap = false; g.applySettings('renderDist'); });
await ev(`VR.game.createWorld({name:'VX',mode:'creative',difficulty:'peaceful',type:'flat',seed:'777',cheats:true,kit:true})`);
for (let i = 0; i < 40; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.hideHud = true; document.getElementById('hud').style.visibility = 'hidden'; });
for (let i = 0; i < 6; i++) { await step(10); await wait(300); }
const info = await ev(() => {
  const g = VR.game, w = g.world, p = g.player, VG = VR.VillageGen;
  const x0 = Math.floor(p.pos[0]), z0 = Math.floor(p.pos[2]);
  const gy = w.topAt(x0, z0);
  const list = [];
  const put = (x, y, z, s) => list.push([x, y, z, s]);
  const rng = new VR.RNG(1234);
  const mk = (ox, oz, r, o) => { const L = VG.makeLot(put, ox, oz, r); return VG.building(L, Object.assign({ F: gy + 1, rng, ground: () => gy, seed: 3, beds: 3, chimney: true, wood: 'oak' }, o)); };
  const res = [];
  res.push(mk(x0 + 4, z0 + 6, 0, { w: 7, d: 6, style: 'meadow', kind: 'home', walls: 'vx_timber_white', window: 'vx_window_shutter_green', roof: 'red' }));
  res.push(mk(x0 + 14, z0 + 6, 0, { w: 6, d: 7, style: 'taiga', kind: 'home', walls: 'vx_siding_red', window: 'vx_window_wood', roof: 'slate', wood: 'spruce', floors: 2 }));
  res.push(mk(x0 - 6, z0 + 6, 0, { w: 7, d: 5, style: 'meadow', kind: 'bakery', walls: 'vx_plaster_butter', window: 'vx_window_shutter_blue', roof: 'teal', chimney: true }));
  res.push(mk(x0 + 4, z0 + 20, 0, { w: 7, d: 6, style: 'prism', kind: 'home', walls: 'vx_crystal_wall', window: 'vx_window_round', roof: 'violet', wood: 'birch' }));
  res.push(mk(x0 + 14, z0 + 20, 0, { w: 6, d: 6, style: 'desert', kind: 'home', walls: 'vx_adobe', window: 'vx_window_arch', roof: 'terracotta', wood: 'acacia' }));
  res.push(mk(x0 - 6, z0 + 20, 0, { w: 7, d: 6, style: 'meadow', kind: 'library', walls: 'vx_stonebrick', window: 'vx_window_arch', roof: 'blue' }));
  const Lf = VG.makeLot(put, x0 + 24, z0 + 6, 0); VG.farm(Lf, { w: 7, d: 9, F: gy, rng, ground: () => gy - 1, style: 'meadow' });
  for (let k = 0; k < 6; k++) { put(x0 + 2 + k * 4, gy + 1, z0 + 3, VR.R.S('vx_lamppost', { head: 0 })); put(x0 + 2 + k * 4, gy + 2, z0 + 3, VR.R.S('vx_lamppost', { head: 1 })); }
  w.bulkSet(list, false);
  return { gy, x0, z0, n: list.length, res: res.map(r => r.roofTop) };
});
console.log(JSON.stringify(info));
for (let i = 0; i < 20; i++) { await step(4); await wait(300); }
const look = async (name, pos, tgt, tod) => {
  await ev(([pos, tgt]) => { const p = VR.game.player; p.teleport(pos[0], pos[1], pos[2]); p.flying = true; const dx = tgt[0] - pos[0], dy = tgt[1] - pos[1] - 1.6, dz = tgt[2] - pos[2]; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); }, [pos, tgt]);
  await step(3);
  await shot(name, tod || 5200);
};
const X = info.x0, Y = info.gy, Z = info.z0;
await look('vx_front', [X + 6, Y + 7, Z - 10], [X + 6, Y + 3, Z + 10]);
await look('vx_close', [X + 5, Y + 3.5, Z + 1], [X + 7, Y + 4, Z + 7]);
await look('vx_side', [X - 16, Y + 10, Z + 2], [X + 6, Y + 2, Z + 14]);
await look('vx_back', [X + 12, Y + 12, Z + 40], [X + 8, Y + 3, Z + 20]);
await look('vx_farm', [X + 22, Y + 7, Z - 2], [X + 27, Y + 1, Z + 9]);
await look('vx_night', [X + 6, Y + 7, Z - 10], [X + 6, Y + 3, Z + 10], 17800);
await look('vx_inside', [X + 5.5, Y + 3.2, Z + 7.5], [X + 9, Y + 1.5, Z + 10.5]);
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 20)) console.log(l);
await browser.close();
