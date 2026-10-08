// The trailer's shots A (Ember Canyon), B (Spire Citadel) and C (Sky Isles) as the game shows them: the director's own
// trailer keys and scripted ship flights, photographed near the start and near the end of each shot. The director is
// paused while the world settles, so every picture is the exact camera of its moment. Frames are 1296×704 like the
// owner's trailer. TAG=before|after names the pictures test/shots/trailer_<A|B|C>_<1|2>_<TAG>.png; SHOTS=A,B,C picks shots.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const TAG = process.env.TAG || 'before';
const W = +(process.env.W || 1296), H = +(process.env.H || 704);
const WANT = (process.env.SHOTS || 'A,B,C').split(',');
const SEED = process.env.SEED || '4242';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const logs = [];
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 700)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
// DIST=<absolute path of an index.html> photographs another build (the before pictures: the original commit, built aside)
await page.goto(process.env.DIST ? 'file://' + process.env.DIST : 'file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.renderDist = 12; g.settings.horizon = 2; g.applySettings('*'); }, process.env.PRESET || 'high');
await ev(`VR.game.createWorld({name:'Trailer World',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:true})`);
for (let i = 0; i < 120; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => {
  const g = VR.game; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0;
  const R = g.renderer; R._render = R.render; R.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); };
  window.__norender = true;
});
const step = async (n, dtms = 50) => { await ev(([m, d]) => { const g = VR.game; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [n, dtms]); };
const shot = async (name) => {
  await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; });
  await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 180000 }); console.log('shot', name);
};
// photograph the paused director's current frame: the world around the camera settles first, time stands still
const capture = async (name) => {
  await ev(() => { const d = VR.game.director; d.update = () => {}; });
  for (let i = 0; i < 120; i++) {
    await step(10, 50); await wait(50);
    const s = await ev(() => ({ busy: VR.game.pool.busy, pend: VR.game.world.pending.size }));
    if (s.busy === 0 && s.pend === 0 && i > 3) break;
  }
  // what is in the air at this moment: the director's scripted ships (state, GPU mesh, position) and the sky traffic
  const air = await ev(() => { const g = VR.game, D = g.director, c = g.renderer && g.renderer.cam ? g.renderer.cam : null; return {
    cam: c ? [c.x, c.y, c.z].map(v => Math.round(v)) : null, traffic: g.traffic ? g.traffic.ships.length : -1,
    mine: (D.myShips || []).map(s => ({ t: +s.t.toFixed(2), gpu: !!(s.d && s.d.gpu), pos: s.pos.map(v => Math.round(v)) })) }; });
  console.log('  air', name, JSON.stringify(air));
  await shot(name);
  await ev(() => { delete VR.game.director.update; });
};
console.log('director', await ev(() => VR.game.director.play('trailer')));
const done = new Set();
for (let i = 0; i < 1500; i++) {
  await step(4, 50); await wait(30);
  const st = await ev(() => { const d = VR.game.director; const sh = d.shots && d.shots[d.si]; return { active: d.active, si: d.si, phase: d.phase, t: +d.t.toFixed(2), dur: sh ? sh.dur : 0 }; });
  if (!st.active || st.si > 2) break;
  if (st.phase !== 'run') continue;
  const name = ['A', 'B', 'C'][st.si];
  if (!WANT.includes(name)) continue;
  if (!done.has(name + '1') && st.t >= 1.2) { done.add(name + '1'); console.log('  ', JSON.stringify(st)); await capture(`trailer_${name}_1_${TAG}`); }
  else if (!done.has(name + '2') && st.t >= st.dur - 0.6) { done.add(name + '2'); console.log('  ', JSON.stringify(st)); await capture(`trailer_${name}_2_${TAG}`); }
}
// the frame cost at the last picture, on this machine (swiftshader: compare builds and presets, not absolute ms): 35 frames
// with the renderer on, the first 5 dropped, median and mean of the rest
const cost = await ev(() => {
  window.__norender = false; const g = VR.game, ts = [];
  for (let i = 0; i < 35; i++) { const t0 = performance.now(); g.last = performance.now() - 33; g.loop(performance.now()); g.renderer.gl.finish(); if (i >= 5) ts.push(performance.now() - t0); }
  window.__norender = true; ts.sort((a, b) => a - b);
  return { median: +ts[ts.length >> 1].toFixed(1), mean: +(ts.reduce((a, b) => a + b, 0) / ts.length).toFixed(1) };
});
console.log('COST', TAG, process.env.PRESET || 'high', JSON.stringify(cost));
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 16)) console.log(l);
await browser.close();
