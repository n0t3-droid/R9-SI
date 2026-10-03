// the sky at four times of day from 60 blocks above spawn (TRAILER.md §2.1)
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1296, height: 704 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
page.on('console', m => { if (m.type() === 'error') console.log('[err]', m.text().slice(0, 300)); });
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.settings.renderDist = 8; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Sky',mode:'creative',difficulty:'peaceful',type:'default',seed:'${process.env.SEED || '4242'}',cheats:true,kit:true})`);
for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev((h) => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; g.hideHud = true; const hd = document.getElementById('hud'); if (hd) hd.style.display = 'none'; const pl = g.player; pl.flying = true; pl.teleport(pl.pos[0], pl.pos[1] + h, pl.pos[2]); pl.pitch = 0.25; }, +(process.env.ALT || 60));
await wait(8000);
const tag = process.env.TAG || 'sky';
for (const [name, tod, yaw] of [['dawn', 1200, 0.4], ['noon', 6000, 1.57], ['dusk', 11500, 3.0], ['night', 18000, 4.5]]) {
  await ev(([t, y, p]) => { const g = VR.game; g.env.setTime(t); g.player.yaw = y; g.player.pitch = p; }, [tod, yaw, +(process.env.PITCH || 0.25)]);
  await wait(1500);
  await page.screenshot({ path: `/home/claude/vr/test/shots/${tag}_${name}.png` });
  console.log('shot', name);
}
await browser.close();
