import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const logs = [];
page.on('console', m => { logs.push(`[${m.type()}] ${m.text().slice(0, 400)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev((mm) => { const g = VR.game; g.settings.renderDist = 5; g.settings.dynRes = false; g.settings.minimap = mm; g.applySettings('renderDist'); }, process.env.MM === '1');
await ev(`VR.game.createWorld({name:'Ship',mode:'creative',difficulty:'normal',type:'default',seed:'424242',cheats:true,kit:true})`);
for (let i = 0; i < 40; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
console.log('play');
await ev(() => { const g = VR.game; const p = g.player; p.teleport(168.5, 109, -242.5); p.flying = true; p.yaw = 0; p.pitch = -0.35;
  window.__frames = 0; window.__ms = 0; const tick = () => { const t0 = performance.now(); g.last = performance.now() - 33; g.loop(performance.now()); window.__ms = Math.max(window.__ms, performance.now() - t0); window.__frames++; setTimeout(tick, 5); }; setTimeout(tick, 5); });
const cdp = await page.context().newCDPSession(page);
await cdp.send('Debugger.enable');
let paused = null;
cdp.on('Debugger.paused', (e) => { paused = e; });
for (let k = 0; k < 40; k++) {
  await new Promise(r => setTimeout(r, 1000));
  let fr = null;
  try { fr = await Promise.race([page.evaluate(() => window.__frames + ' maxms ' + window.__ms.toFixed(0)), new Promise(r => setTimeout(() => r('TIMEOUT'), 3000))]); } catch (e) { fr = 'ERR'; }
  console.log('t', k, 'frames', fr);
  if (fr === 'TIMEOUT') {
    await cdp.send('Debugger.pause');
    for (let i = 0; i < 20 && !paused; i++) await new Promise(r => setTimeout(r, 200));
    if (paused) { for (const f of paused.callFrames.slice(0, 12)) console.log('  at', f.functionName, 'line', f.location.lineNumber + 1, 'col', f.location.columnNumber); }
    break;
  }
}
console.log(logs.filter(l => !/warn/i.test(l)).slice(0, 20).join('\n'));
await browser.close();
process.exit(0);
