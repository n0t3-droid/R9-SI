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
await ev(() => { const g = VR.game; g.settings.renderDist = 5; g.settings.dynRes = false; g.settings.minimap = false; g.applySettings('renderDist'); });
await ev(`VR.game.createWorld({name:'Ship',mode:'creative',difficulty:'normal',type:'default',seed:'424242',cheats:true,kit:true})`);
for (let i = 0; i < 40; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
console.log('play');
await ev(() => { const g = VR.game; const p = g.player; p.teleport(168.5, 109, -242.5); p.flying = true; g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; window.__norender = true; });
const cdp = await page.context().newCDPSession(page);
await cdp.send('Debugger.enable');
let paused = null;
cdp.on('Debugger.paused', (e) => { paused = e; });
for (let k = 0; k < 200; k++) {
  const pr = page.evaluate(() => { const g = VR.game; const t0 = performance.now(); for (let i = 0; i < 10; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } return (performance.now() - t0).toFixed(0); });
  const r = await Promise.race([pr, new Promise(r => setTimeout(() => r('TIMEOUT'), 8000))]);
  if (k % 10 === 0 || r === 'TIMEOUT') console.log('batch', k, r);
  if (r === 'TIMEOUT') {
    await cdp.send('Debugger.pause');
    for (let i = 0; i < 30 && !paused; i++) await new Promise(r => setTimeout(r, 200));
    if (paused) for (const f of paused.callFrames.slice(0, 14)) console.log('  at', f.functionName, 'line', f.location.lineNumber + 1, 'col', f.location.columnNumber);
    else console.log('could not pause');
    break;
  }
  await wait(20);
}
console.log(logs.filter(l => !/warn/i.test(l)).slice(0, 20).join('\n'));
await browser.close();
process.exit(0);
