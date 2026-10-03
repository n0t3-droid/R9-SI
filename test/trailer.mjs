// the director's trailer: run it and photograph each shot at a few moments
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const W = +(process.env.W || 1296), H = +(process.env.H || 704);
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 700)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.renderDist = 12; g.settings.horizon = 2; g.applySettings('*'); }, process.env.PRESET || 'high');
await ev(`VR.game.createWorld({name:'Trailer',mode:'creative',difficulty:'peaceful',type:'default',seed:'${process.env.SEED || '4242'}',cheats:true,kit:true})`);
for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; const R = g.renderer; R._render = R.render; R.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; window.__norender = true; });
const step = async (n, dtms = 50) => { await ev(([m, d]) => { const g = VR.game; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [n, dtms]); };
const shot = async (name) => { await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 120000 }); console.log('shot', name); };
console.log('start', await ev(() => VR.game.director ? VR.game.director.play('trailer') : 'no director'));
let lastShot = -1, n = 0;
for (let i = 0; i < 600; i++) {
  await step(4, 50); await wait(60);
  const st = await ev(() => { const d = VR.game.director; return { active: d.active, si: d.si, phase: d.phase, t: +d.t.toFixed(2), pos: VR.game.player.pos.map(v => +v.toFixed(0)), pend: VR.game.world.pending.size, busy: VR.game.pool.busy }; });
  if (!st.active) { console.log('done', JSON.stringify(st)); break; }
  if (st.phase === 'run') { const key = st.si * 100 + Math.floor(st.t / 1.6); if (key !== lastShot) { lastShot = key; await shot(`trl_${String(n++).padStart(2, '0')}_s${st.si}_t${st.t.toFixed(1)}`); console.log('  ', JSON.stringify(st)); } }
  else if (i % 20 === 0) console.log('  ', JSON.stringify(st));
}
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 12)) console.log(l);
await browser.close();
