// regress: skip — f-album · 📒 Fotoalbum in the browser: a flat world, two photos from the Fotomodus, the pause menu's
// 📒 opens the album with both, a click shows one large; the picture test/shots/album.png
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
const ROOT = new URL('../', import.meta.url).pathname;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const b = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const p = await b.newPage({ viewport: { width: 800, height: 450 }, locale: 'de-DE' });
const logs = []; p.on('pageerror', e => logs.push('[pageerror] ' + e.message));
await p.goto('file://' + ROOT + 'dist/index.html');
for (let i = 0; i < 160; i++) { await p.waitForTimeout(500); if (await p.evaluate(() => !!(window.VR && VR.game && VR.game.state === 'title'))) break; }
await p.evaluate(`VR.game.applyPreset('potato'); VR.game.settings.renderDist = 3; VR.game.applySettings('*'); VR.game.createWorld({name:'Albumwelt',mode:'creative',difficulty:'peaceful',type:'flat',seed:'7',cheats:true})`);
for (let i = 0; i < 160; i++) { await p.waitForTimeout(500); if (await p.evaluate(() => VR.game.state === 'play')) break; }
const n = await p.evaluate(async () => {
  const g = VR.game; g.photoMode(true);
  for (let k = 0; k < 2; k++) { g.photoCam.busy = false; g.photoCam.shoot(); for (let i = 0; i < 80 && g.photoCam.busy; i++) await new Promise((r) => setTimeout(r, 100)); g.photoCam.s.yaw += 1.2; await new Promise((r) => setTimeout(r, 600)); }
  g.photoMode(false);
  for (let i = 0; i < 40; i++) { const l = await VR.Album.list(); if (l.length >= 2) return l.length; await new Promise((r) => setTimeout(r, 200)); }
  return (await VR.Album.list()).length;
});
check(n >= 2, 'two photos in the album (' + n + ')');
await p.evaluate(() => VR.game.ui.show('pause'));
check(await p.evaluate(() => !!document.getElementById('albumBtn')), 'the pause menu has 📒 Fotoalbum');
await p.evaluate(() => document.getElementById('albumBtn').click());
await p.waitForTimeout(1500);
const thumbs = await p.evaluate(() => document.querySelectorAll('#albumGrid figure').length);
check(thumbs >= 2, 'the album shows the pictures (' + thumbs + ')');
await p.screenshot({ path: ROOT + 'test/shots/album.png' });
await p.evaluate(() => document.querySelector('#albumGrid figure').click());
await p.waitForTimeout(800);
check(await p.evaluate(() => document.getElementById('albumView').style.display === 'flex' && !!document.getElementById('albumDl').href), 'a click shows one large with its download link');
await p.screenshot({ path: ROOT + 'test/shots/album_view.png' });
check(!logs.length, 'no page errors' + (logs.length ? ': ' + logs.slice(0, 3).join(' | ') : ''));
await b.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
