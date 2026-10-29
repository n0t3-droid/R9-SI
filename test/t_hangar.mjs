// regress: skip — t-hangar's pictures (docs/superpowers/plans/2026-10-29-t-hangar.md): the Hangar Hall and the Gate
// Temple framed as in the trailer's shots (docs/trailer/frames t1_10/t1_11, t1_13/t1_16/t1_19), on two builds in one
// browser — the base build (BASE_DIST, default .tmp_tests/base/dist: a new world there is vgen 13) and this one (vgen 14).
// Pictures test/shots/hangar_<shot>_<v051|now>.png; the hall view's cost on High and on Very Low per build.
//   nohup bash test/wt_run.sh t_hangar.mjs 3600 > .tmp_tests/t_hangar.log 2>&1 &
//   SHOTS=hall,pad,consoles,front,golden,night · ONLY=now (one build) · SEED=4242
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const ROOT = new URL('../', import.meta.url).pathname;
const SHOTS = ROOT + 'test/shots/';
fs.mkdirSync(SHOTS, { recursive: true });
const W = 1280, H = 704;
const BUILDS = [['v051', process.env.BASE_DIST || ROOT + '.tmp_tests/base/dist'], ['now', ROOT + 'dist']].filter(b => !process.env.ONLY || process.env.ONLY.split(',').includes(b[0]));
const SHOT = {
  hall: { from: [0.5, 83.2, 16], to: [0, 86, -36], tod: 12500 },            // the hall from the door (t1_13)
  pad: { from: [0.5, 84.2, 13], to: [0.5, 84, -10], tod: 12500 },        // the pad with the craft (t1_16)
  consoles: { from: [3.5, 83.4, 9], to: [-10, 85, -3], tod: 12500 },        // the console row and its screens (t1_17)
  front: { from: [0.5, 83, 48], to: [0, 89, 20], tod: 12500 },              // the temple's front, the gate (t1_10)
  golden: { from: [0.5, 86, 104], to: [0.5, 92, 20], tod: 12500 },          // the temple from the plaza, the golden hour (t1_11)
  night: { from: [0.5, 86, 104], to: [0.5, 92, 20], tod: 16000 },           // the same at night
};
// (the pad and the consoles first: in run 2 the first picture, the hall's, caught a section of the hall not yet in)
const shots = (process.env.SHOTS || 'pad,consoles,hall,front,golden,night').split(',');
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
let bad = 0; const ok = (c, m) => { if (!c) bad++; console.log((c ? '  ok   ' : '  FAIL ') + m); };
const res = {};
for (const [tag, dist] of BUILDS) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, locale: 'de-DE' });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 500)}`); });
  page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1200)));
  await page.goto('file://' + dist + '/index.html');
  const wait = (ms) => page.waitForTimeout(ms);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(5); } };
  const settle = async (max = 300) => { for (let i = 0; i < max; i++) { await step(10); const s = await ev(() => { const g = VR.game; return { busy: g.pool.busy, pend: g.world.pending.size, lod: g.horizon ? g.horizon.inflight : 0, want: g.world.lastWant || 0 }; }); if (s.busy === 0 && s.pend === 0 && s.lod === 0 && !s.want && i > 3) break; await wait(100); } };
  const look = async (from, to) => { await ev(([c, t]) => { const pl = VR.game.player; pl.flying = true; pl.noclip = true; pl.teleport(c[0], c[1], c[2]); pl.yaw = Math.atan2(-(t[0] - c[0]), -(t[2] - c[2])); pl.pitch = Math.atan2(t[1] - c[1], Math.hypot(t[0] - c[0], t[2] - c[2])); }, [from, to]); await settle(); };
  const shot = async (name) => {
    for (let k = 0; k < 2; k++) {
      try {
        await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; });
        await page.screenshot({ path: SHOTS + `hangar_${name}_${tag}.png`, timeout: 180000 }); console.log('shot', name, tag); return true;
      } catch (e) { console.log('shot', name, 'failed:', String(e.message || e).split('\n')[0]); }
    }
    return false;
  };
  for (let i = 0; i < 160; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title').catch(() => false)) break; }
  await ev(() => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.settings.renderDist = 12; g.applySettings('*'); });
  await ev(`VR.game.createWorld({name:'Hangar',mode:'creative',difficulty:'peaceful',type:'default',seed:'${process.env.SEED || '4242'}',cheats:true,kit:true})`);
  for (let i = 0; i < 120; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
  // the pictures: the time held, clear sky, no HUD; Animierte Anzeigen off so the hall's craft stands parked on the pad
  await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; for (const id of ['hud', 'ui', 'hints']) { const h = document.getElementById(id); if (h) h.style.display = 'none'; } g.settings.anim = false; g.applySettings('anim'); });
  const info = await ev(() => ({ vgen: VR.game.meta && VR.game.meta.vgen }));
  console.log(`== ${tag}: vgen ${info.vgen}`);
  for (const name of shots) {
    const S = SHOT[name]; if (!S) continue;
    await ev((t) => VR.game.env.setTime(t), S.tod);
    await look(S.from, S.to); await step(4);
    await shot(name);
  }
  const ships = await ev(() => VR.game.starships.ships.filter(s => s.hangar).map(s => ({ arch: s.d.arch, gpu: !!s.d.gpu, hidden: !!s.hidden, pos: s.pos.map(v => +v.toFixed(1)) })));
  console.log('pad ships', JSON.stringify(ships));
  // the hall view's cost: five blocks of six frames (three warm-up frames each); the minimum, the machine is shared
  const timeFrames = async (label) => {
    const runs = [];
    for (let k = 0; k < 5; k++) runs.push(await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 3; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); const t0 = performance.now(); for (let i = 0; i < 6; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; return (performance.now() - t0) / 6; }));
    const ms = Math.min(...runs); console.log('cost', tag, label, ms.toFixed(1) + ' ms/frame (blocks ' + runs.map(v => v.toFixed(0)).join(', ') + ')'); return ms;
  };
  res[tag] = { vgen: info.vgen, ships, logs: logs.filter(l => l.startsWith('[pageerror]')) };
  if (process.env.NOCOST) { console.log('--- logs', tag, logs.length); for (const l of logs.slice(0, 8)) console.log(l); await ctx.close(); continue; }   // (the costs: critic_vl.mjs's alternating rounds)
  await ev((t) => VR.game.env.setTime(t), 12500); await look(SHOT.hall.from, SHOT.hall.to);
  res[tag].high = await timeFrames('High');
  await ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.dynRes = false; g.applySettings('*'); });
  await look(SHOT.hall.from, SHOT.hall.to); await step(6);
  res[tag].vl = await timeFrames('Very Low');
  await shot('verylow_hall');
  await look(SHOT.golden.from, SHOT.golden.to); await step(6);
  res[tag].vlPlaza = await timeFrames('Very Low · plaza');
  console.log('--- logs', tag, logs.length); for (const l of logs.slice(0, 8)) console.log(l);
  await ctx.close();
}
fs.writeFileSync(ROOT + '.tmp_tests/t_hangar.json', JSON.stringify(res, null, 1));
if (res.now) {
  ok(!res.now.logs.length, 'no page errors (this build)');
  ok(res.now.vgen === 14, `a new world is vgen 14 (${res.now.vgen})`);
  ok(res.now.ships.some(s => s.arch === 'hero' && s.gpu), `the hero craft stands on the pad, built (${JSON.stringify(res.now.ships)})`);
}
console.log(bad ? `FAILED ${bad}` : 'ALL OK');
await browser.close();
