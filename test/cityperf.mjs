// where do the frames go in the city? CPU cost of the sim (villagers, world) and the draw/triangle load,
// measured on the plaza, in the city street and out in the wild
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.applySettings('*'); }, process.env.PRESET || 'balanced');
await ev(`VR.game.createWorld({name:'Perf',mode:'creative',difficulty:'peaceful',type:'default',seed:'${process.env.SEED || '4242'}',cheats:true,kit:true})`);
for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.env.rain = 0; g.env.rainTarget = 0; g.hideHud = true; window.requestAnimationFrame = () => 0; });
const measure = async (name, pos) => {
  await ev(([p]) => { const pl = VR.game.player; pl.flying = true; pl.teleport(p[0], p[1], p[2]); pl.yaw = p[3]; pl.pitch = 0; }, [pos]);
  // let the world load
  for (let i = 0; i < 120; i++) { await ev(() => { const g = VR.game; g.last = performance.now() - 33; g.loop(performance.now()); }); const s = await ev(() => { const g = VR.game; return { busy: g.pool.busy, pend: g.world.pending.size }; }); if (s.busy === 0 && s.pend === 0 && i > 10) break; await wait(150); }
  const r = await ev(() => {
    const g = VR.game;
    const R = g.renderer;
    if (!R._render) { R._render = R.render; R.render = function (F) { window.__lastF = F; if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; }
    // CPU: sim + update without rendering
    window.__norender = true;
    let t0 = performance.now();
    for (let i = 0; i < 60; i++) { g.last = performance.now() - 16.7; g.loop(performance.now()); }
    const simMs = (performance.now() - t0) / 60;
    // per-system timing where exposed
    const vils = g.villages ? [...g.villages.known.values()].reduce((a, v) => a + (v.people ? v.people.length : 0), 0) : -1;
    const ents = g.entities ? g.entities.mobs.length : -1;
    window.__norender = false;
    t0 = performance.now();
    for (let i = 0; i < 5; i++) { g.last = performance.now() - 16.7; g.loop(performance.now()); }
    R.gl.finish();
    const frameMs = (performance.now() - t0) / 5;
    // render-only: the same frame drawn 6 times (GPU-side cost under SwiftShader, no sim)
    let renderMs = -1;
    if (window.__lastF) { R._render(window.__lastF); R.gl.finish(); const t1 = performance.now(); for (let i = 0; i < 6; i++) R._render(window.__lastF); R.gl.finish(); renderMs = (performance.now() - t1) / 6; }
    return { simMs: +simMs.toFixed(2), frameMs: +frameMs.toFixed(1), renderMs: +renderMs.toFixed(1), draws: R.stats.draws, tris: Math.round(R.stats.tris / 1000) + 'k', sections: R.stats.sections, villagers: vils, entities: ents, cols: g.world.cols.size, mem: R.gpuMemoryMB().toFixed(0) + 'MB' };
  });
  console.log(name.padEnd(8), JSON.stringify(r));
};
if (process.env.POS) { for (const spec of process.env.POS.split(';')) { const [name, ...v] = spec.split(','); await measure(name, v.map(Number)); } }
else {
  await measure('hall', [0.5, 81, -9.5, Math.PI]);
  await measure('street', [-30, 83, -150, 1.2]);
  await measure('city2', [40, 83, -190, -2.0]);
}

await browser.close();
