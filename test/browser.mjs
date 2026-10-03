import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const args = process.argv.slice(2);
const steps = args[0] || 'title';
const browser = await chromium.launch({ channel: 'chromium', args: ['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl','--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: parseInt(process.env.VW || '960'), height: parseInt(process.env.VH || '540') } });
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || t === 'warning' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 600)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1200)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const shot = async (name) => { await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png` }); console.log('shot', name); };
const evalg = (fn) => page.evaluate(fn);
await wait(parseInt(process.env.T0 || '9000'));
await shot('01_title');
console.log(await evalg(() => { const g = VR.game; return JSON.stringify({ state: g.state, fps: g.fps, cols: g.world && g.world.cols.size, secs: g.renderer.stats.sections, draws: g.renderer.stats.draws, tris: g.renderer.stats.tris, ms: g.renderer.stats.ms }); }));
if (steps !== 'title') {
  if (process.env.SEED) await evalg(`VR.game.createWorld({name:'Test',mode:'${process.env.MODE||'creative'}',difficulty:'normal',type:'default',seed:'${process.env.SEED}',cheats:true,kit:true})`);
  else await page.click('[data-act=quick]');
  for (let i = 0; i < 40; i++) { await wait(1000); const st = await evalg(() => VR.game.state); if (st === 'play') break; }
  await wait(2500);
  await shot('02_play');
  console.log(await evalg(() => { const g = VR.game, p = g.player; return JSON.stringify({ state: g.state, fps: g.fps, pos: p.pos.map(v => +v.toFixed(1)), cols: g.world.cols.size, secs: g.renderer.stats.sections, draws: g.renderer.stats.draws, tris: Math.round(g.renderer.stats.tris), ms: g.renderer.stats.ms.toFixed(1), mem: g.renderer.gpuMemoryMB().toFixed(1) }); }));
  if (process.env.EXTRA) { await evalg(new Function(process.env.EXTRA)); await wait(parseInt(process.env.T1 || '4000')); await shot('03_extra'); }
  if (process.env.EXTRA2) { await evalg(new Function(process.env.EXTRA2)); await wait(parseInt(process.env.T2 || '4000')); await shot('04_extra'); }
  if (process.env.EXTRA3) { await evalg(new Function(process.env.EXTRA3)); await wait(parseInt(process.env.T3 || '4000')); await shot('05_extra'); }
}
console.log('--- logs (' + logs.length + ')');
for (const l of logs.slice(0, 40)) console.log(l);
await browser.close();
