// The trailer's shots A (Ember Canyon), B (Spire Citadel) and C (Sky Isles) as the game shows them: the director's own
// trailer keys and scripted ship flights, photographed near the start and near the end of each shot. The director and the
// sky traffic stand still while the world settles, so every picture is the exact camera and the exact flight of its moment.
// Frames are 1296×704 like the owner's trailer. TAG=before|after names the pictures test/shots/trailer_<A|B|C>_<1|2>_<TAG>.png;
// SHOTS=A,B,C picks shots; PRESET=potato is the Very Low preset; DIST photographs another build.
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
// a preset with the test's render distance and horizon (the same for every preset, so the costs compare presets)
const setPreset = (p) => ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.renderDist = 12; g.settings.horizon = 2; g.applySettings('*'); }, p);
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await setPreset(process.env.PRESET || 'high');
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
// the frozen moment: the director only keeps the scripted designs in the starship cache (its garbage collection frees a
// design unused for a minute of wall-clock time), and the sky traffic does not fly while the world settles and is shot
const freeze = () => ev(() => {
  const g = VR.game, d = g.director, tr = g.traffic;
  d.update = () => { for (const x of d.shipDs || []) if (x) x.last = performance.now(); };
  if (tr && !tr.__up) { tr.__up = tr.update; tr.update = () => {}; }
});
const thaw = () => ev(() => {
  const g = VR.game, tr = g.traffic;
  if (tr && tr.__up) { delete tr.update; delete tr.__up; }
  delete g.director.update;
});
// the frame cost on this machine (swiftshader: compare builds and presets, not absolute ms): 35 frames with the renderer on,
// the first 5 dropped, median and mean of the rest; each frame ends with a 1-pixel readPixels, which waits for the GPU's
// queue (gl.finish alone may return early in Chrome)
const measure = () => ev(() => {
  window.__norender = false; const g = VR.game, ts = [];
  const gl = g.renderer.gl, px = new Uint8Array(4);
  for (let i = 0; i < 35; i++) { const t0 = performance.now(); g.last = performance.now() - 33; g.loop(performance.now()); gl.finish(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); if (i >= 5) ts.push(performance.now() - t0); }
  window.__norender = true; ts.sort((a, b) => a - b);
  return { median: +ts[ts.length >> 1].toFixed(1), mean: +(ts.reduce((a, b) => a + b, 0) / ts.length).toFixed(1) };
});
// the world settles: chunks, meshes and the scripted designs are in place when the loop stops
const settle = async () => {
  for (let i = 0; i < 120; i++) {
    await step(10, 50); await wait(50);
    const s = await ev(() => ({ busy: VR.game.pool.busy, pend: VR.game.world.pending.size, wait: VR.game.director.shipWait || 0 }));
    if (s.busy === 0 && s.pend === 0 && s.wait <= 0 && i > 3) break;
  }
};
// photograph the paused director's current frame: the world around the camera settles first, time stands still
// the frame cost at the last picture, for each preset of COSTPRESETS (default high,potato: the Very Low preset on the same
// camera, the world settled for it)
const COSTPRESETS = (process.env.COSTPRESETS || 'high,potato').split(',');
let curPreset = process.env.PRESET || 'high';
const costs = {};
const capture = async (name) => {
  await freeze();
  await settle();
  // each scripted ship sits where the director's clock puts it: t = (shot time - its delay) / its duration; the one traffic
  // update that places them is the real one (the frozen update is bypassed for this call only)
  await ev(() => {
    const g = VR.game, d = g.director, tr = g.traffic, sh = d.shots[d.si];
    for (const s of d.myShips || []) {
      const sp = (sh.ships || []).find(p => p.A[0] === s.A[0] && p.A[1] === s.A[1] && p.A[2] === s.A[2]);
      if (sp) s.t = (d.t - (sp.delay || 0)) / sp.dur;
    }
    if (tr && tr.__up) tr.__up(0);
  });
  // what is in the air at this moment: the director's scripted ships (their shot time, GPU mesh, position) and the sky traffic
  const air = await ev(() => { const g = VR.game, D = g.director, c = g.renderer && g.renderer.cam ? g.renderer.cam : null; return {
    cam: c ? [c.x, c.y, c.z].map(v => Math.round(v)) : null, traffic: g.traffic ? g.traffic.ships.length : -1,
    mine: (D.myShips || []).map(s => ({ t: +s.t.toFixed(2), gpu: !!(s.d && s.d.gpu), pos: s.pos.map(v => Math.round(v)) })) }; });
  console.log('  air', name, JSON.stringify(air));
  await shot(name);
  if (name === COSTAT) for (const p of COSTPRESETS) {
    if (p !== curPreset) { await setPreset(p); curPreset = p; await settle(); }
    costs[p] = await measure();
  }
  await thaw();
};
console.log('director', await ev(() => VR.game.director.play('trailer')));
const done = new Set();
// the frame cost is measured at the last picture of the run (the second picture of C, or of the last shot asked for)
const COSTAT = 'trailer_' + (WANT.includes('C') ? 'C' : WANT[WANT.length - 1]) + '_2_' + TAG;
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
for (const p of COSTPRESETS) console.log('COST', TAG, p, costs[p] ? JSON.stringify(costs[p]) + ' at ' + COSTAT : 'not measured (no last picture)');
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 16)) console.log(l);
await browser.close();
