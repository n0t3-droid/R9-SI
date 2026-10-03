// R9 Smart Quality controller: drive the loop with fake frame times and watch the ladders climb and recover
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
page.on('console', m => { if (/^aq /.test(m.text())) console.log('  ', m.text()); });
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = true; g.applySettings('*'); }, process.env.PRESET || 'balanced');
await ev(`VR.game.createWorld({name:'SQ',mode:'creative',difficulty:'peaceful',type:'default',seed:'4242',cheats:true,kit:true})`);
for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { VR.AQ_TRACE = true; const g = VR.game; g.env.rain = 0; g.hideHud = true; window.requestAnimationFrame = () => 0; const pl = g.player; pl.flying = true; pl.teleport(-30, 83, -150); pl.yaw = 1.2; });
for (let i = 0; i < 60; i++) { await ev(() => { const g = VR.game; g.last = performance.now() - 33; g.loop(performance.now()); }); await wait(100); }
const run = async (label, frameMs, seconds) => {
  const out = await ev(([ms, secs]) => {
    const g = VR.game, R = g.renderer; const log = [];
    if (!R._render) { R._render = R.render; R.render = function (F) { this.setupCamera(F.cam); this.frameNo++; }; }
    let t = performance.now(); const n = Math.round(secs * 1000 / ms);
    for (let i = 0; i < n; i++) { t += ms; g.last = t - ms; g.loop(t); if (i % Math.round(1000 / ms) === 0) { const aq = g.aq; log.push(`t=${(i * ms / 1000).toFixed(0)}s fps=${g.fps ? g.fps.toFixed(0) : '?'} G${aq.g} C${aq.c} stack=${aq.stack.join('')} scale=${R.q.scale} shEvery=${R.q.shadowEvery || 1} rays=${R.q.rays} vxLod=${R.q.vxLod} sh=${R.q.shadows} rd=${g.world.renderDist} folk=${g.folkDist} js=${g.jsMs.toFixed(1)} gpu=${R.gpuMs === undefined ? '-' : R.gpuMs.toFixed(1)} ${aq.gpuBound ? 'GPU' : aq.cpuBound ? 'CPU' : '-'}`); } }
    return log;
  }, [frameMs, seconds]);
  console.log('--- ' + label); for (const l of out) console.log(l);
};
await run('slow 25 fps', 40, 14);
await run('recover 70 fps', 14, 14);
await browser.close();
