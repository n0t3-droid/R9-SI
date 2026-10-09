// F-Far debug probe (regress: skip): ring 1's colours and shading in the browser — no checks, numbers and pictures only
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const URL = process.env.AFTER_URL || 'file:///home/claude/vr/dist/index.html';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await (await browser.newContext({ viewport: { width: 960, height: 540 }, locale: 'de-DE' })).newPage();
const logs = []; page.on('console', m => logs.push(m.type() + ': ' + m.text().slice(0, 300))); page.on('pageerror', e => logs.push('pageerror: ' + e.message));
const ev = (fn, a) => page.evaluate(fn, a);
await page.goto(URL);
for (let i = 0; i < 200; i++) { await page.waitForTimeout(500); if (await ev(() => !!(window.VR && VR.game && VR.game.state === 'title'))) break; }
await ev(() => VR.game.createWorld({ name: 'Dbg', mode: 'creative', difficulty: 'peaceful', type: 'default', seed: '1', cheats: true, kit: false }));
for (let i = 0; i < 180; i++) { await page.waitForTimeout(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => {
  const g = VR.game; window.requestAnimationFrame = () => 0;
  for (const id of ['hud', 'ui']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; }
  g.applyPreset('high'); g.settings.dynRes = false; g.settings.clouds = 0; g.settings.renderDist = 6; g.applySettings('*'); g.env.setTime(6000); g.zenFreezeTime = true;
  const p = g.player; p.flying = true; p.teleport(0.5, 200, -560.5); p.yaw = Math.PI; p.pitch = -0.4;
  const f = g.horizon.far; window.__first = null;
  const up = f.upload.bind(f); f.upload = (t, m, b) => { if (!window.__first) { const v = new Int16Array(m.verts), u8 = new Uint8Array(m.verts); const st = { n: m.verts.byteLength / 12, faces: {}, kinds: {}, col: [0, 0, 0], shade: 0, y: [1e9, -1e9] }; for (let i = 0; i < st.n; i++) { const fc = u8[i * 12 + 6] & 7, kd = u8[i * 12 + 6] >> 3; st.faces[fc] = (st.faces[fc] || 0) + 1; st.kinds[kd] = (st.kinds[kd] || 0) + 1; for (let c = 0; c < 3; c++) st.col[c] += u8[i * 12 + 8 + c] / st.n; st.shade += u8[i * 12 + 11] / st.n; const y = v[i * 6 + 1] / 8; st.y[0] = Math.min(st.y[0], y); st.y[1] = Math.max(st.y[1], y); } st.tile = [t.tx, t.tz, t.cell]; window.__first = st; } return up(t, m, b); };
  window.__tick = () => { const gg = VR.game, p2 = gg.player, now = performance.now(); gg.world.update(p2.pos[0], p2.pos[1], p2.pos[2], now); gg.horizon.update({ x: p2.pos[0], y: p2.pos[1] + p2.eye, z: p2.pos[2], yaw: p2.yaw, pitch: p2.pitch, fov: gg.settings.fov * Math.PI / 180 }); gg.pool.pump(); };
});
const t0 = Date.now();
while (Date.now() - t0 < 300000) {
  await ev(() => { const g = VR.game; g.last = performance.now() - 33; g.loop(performance.now()); });
  for (let k = 0; k < 20; k++) { await page.waitForTimeout(50); await ev(() => window.__tick()); }
  const r = await ev(() => VR.game.horizon.far.report());
  if (r.ready > 40) break;
}
console.log('FIRST ' + JSON.stringify(await ev(() => window.__first)));
console.log('REPORT ' + JSON.stringify(await ev(() => VR.game.horizon.far.report())));
const shot = async (name) => { await ev(() => { const g = VR.game; g.last = performance.now() - 33; g.loop(performance.now()); }); await page.screenshot({ path: '/home/claude/vr/test/shots/far_dbg_' + name + '.png' }); };
await shot('all');
await ev(() => { const h = VR.game.horizon; h.__d = h.draw; h.draw = function (r, E) { const L = this.drawList; const keep = L.slice(); L.length = 0; this.__d(r, E); L.push(...keep); }; });
await shot('ring1only');
await ev(() => { VR.game.player.pitch = -0.16; });
await shot('vista');
console.log(logs.filter(l => /error|Error/.test(l)).slice(0, 10).join('\n'));
await browser.close();
