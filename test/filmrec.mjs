// regress: skip — f-film · Shift+K: the Kinoflug as a WebM clip (src/main/photofx.js startRec/stopRec/saveRec).
// The game runs its own frame loop here (no stepped frames: the browser's frames carry the recording, as in a real
// session); a flat creative world, the Fotomodus, the film flight recorded for 3 s; the clip's size caught.
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
const ROOT = new URL('../', import.meta.url).pathname;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const b = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const p = await b.newPage({ viewport: { width: 320, height: 180 }, locale: 'de-DE' });
const logs = []; p.on('pageerror', e => logs.push('[pageerror] ' + e.message));
await p.goto('file://' + ROOT + 'dist/index.html');
for (let i = 0; i < 160; i++) { await p.waitForTimeout(500); if (await p.evaluate(() => !!(window.VR && VR.game && VR.game.state === 'title'))) break; }
await p.evaluate(`VR.game.applyPreset('potato'); VR.game.settings.renderDist = 3; VR.game.applySettings('*'); VR.game.createWorld({name:'Film',mode:'creative',difficulty:'peaceful',type:'flat',seed:'1',cheats:true})`);
for (let i = 0; i < 160; i++) { await p.waitForTimeout(500); if (await p.evaluate(() => VR.game.state === 'play')) break; }
check(await p.evaluate(() => VR.game.state === 'play'), 'a flat world');
const r = await p.evaluate(async () => {
  const PF = VR.PhotoFx, g = VR.game; window.__clip = null;
  PF.saveRec = (gg, blob) => { window.__clip = { size: blob.size, type: blob.type }; };
  g.photoMode(true);
  PF.startFilm(g.photoCam);
  const ok = PF.startRec(g); if (PF.film) PF.film.rec = ok;
  await new Promise((res) => setTimeout(res, 6000));
  if (PF.film) { PF.film.t = 1e9; PF.stepFilm(g.photoCam, 0); } else PF.stopRec();
  for (let i = 0; i < 50 && !window.__clip; i++) await new Promise((res) => setTimeout(res, 100));
  g.photoMode(false);
  return { ok, mime: PF.mime(), clip: window.__clip, filmOver: !PF.film, frames: PF.recN | 0 };
});
console.log('     ' + JSON.stringify(r));
check(r.ok && r.clip && r.clip.size > 10000 && r.clip.type === 'video/webm', 'the film flight recorded as a WebM clip (' + (r.clip ? Math.round(r.clip.size / 1024) + ' KB' : 'none') + ')');
check(r.filmOver, 'the flight ended with the recording');
check(!logs.length, 'no page errors' + (logs.length ? ': ' + logs.slice(0, 3).join(' | ') : ''));
await b.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
