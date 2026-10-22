// e-funke · what Funke costs a frame on Very Low (and High), measured with the GPU drained (plan
// docs/superpowers/plans/2026-10-22-e-funke.md §5). funke.mjs run 1 measured the frame with gl.finish() only: Very Low
// "on 1971.7 ms / off 4.1 ms", High "on 6.5 / off 5.6 ms" — finish() did not wait for SwiftShader here, so most frames
// were their CPU time and some waited for the queue. This probe drains the GPU after every frame (a 1-pixel readPixels of
// the picture shown) and keeps the frames in turns:
//   none   g.funke = null (the build without Funke)        off   the switch off
//   away   on, the drone out of the view (first person)    on    on, the drone in the view (third person)
//   way    on, the light line drawn                        scan  on, the glowing boxes drawn
// for each: the frame's CPU time, the drained time, draws, and every console error.
//   nohup bash test/wt_run.sh funke_cost.mjs 3600 > .tmp_tests/funke_cost.log 2>&1 &
//   PRESETS=potato,high · ROUNDS=4 · N=6
// regress: skip  (a cost probe; the gate is test/funke.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const ROOT = new URL('../', import.meta.url).pathname.replace(/\/$/, '');
const DIST = process.env.DIST || 'file://' + ROOT + '/dist/index.html';
const SHOTS = ROOT + '/test/shots/';
const PRESETS = (process.env.PRESETS || 'potato,high').split(','), ROUNDS = +(process.env.ROUNDS || 4), N = +(process.env.N || 6);
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const rec = { presets: {} };
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || t === 'warning' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 400)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 800)));
await page.addInitScript(() => { try { localStorage.setItem('r9si.funke', JSON.stringify({ hello: 1, help: { villager: 1, ship: 1, chest: 1, door: 1, bed: 1, vista: 1, night: 1, water: 1, photo: 1 } })); localStorage.setItem('r9si.lang', 'de'); } catch (e) { /* */ } });
await page.goto(DIST);
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
// (the steps that only settle the world skip the drawing: funke.mjs's machinery)
const step = async (n) => { for (let k = 0; k < n; k += 10) { await ev((m) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } }, Math.min(10, n - k)); await wait(4); } };
const settle = async (max) => {
  for (let i = 0; i < max; i++) {
    await step(20);
    const s = await ev(() => { const g = VR.game, w = g.world; if (!w || g.state !== 'play') return { ok: false }; let dirty = 0; for (const c of w.cols.values()) for (const sc of c.sec) if (sc.dirty || sc.pending) dirty++; return { ok: g.pool.busy === 0 && w.pending.size === 0 && dirty === 0 && (!w.uploadQ || w.uploadQ.size === 0) }; });
    if (s.ok && i > 2) return i;
    await wait(30);
  }
  return max;
};
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 8; g.settings.wowMoments = false; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'FunkeCost',mode:'creative',difficulty:'peaceful',type:'default',seed:'4242',cheats:true,kit:true})`);
for (let i = 0; i < 180; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
check(await ev(() => VR.game.state) === 'play', `the world is loaded (${secs()})`);
await ev(() => { const g = VR.game; window.requestAnimationFrame = () => 0; g.zenFreezeTime = true; g.zenFreezeWeather = true; g.env.wx.force('klar'); g.env.setTime(10800); });

for (const preset of PRESETS) {
  await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.renderDist = 8; g.applySettings('*'); g.settings.funke = true; }, preset);
  await settle(40);
  await step(30);
  const res = await ev(([rounds, n]) => {
    const g = VR.game, r = g.renderer, gl = r.gl, F = VR.Funke, A = g.funke, px = new Uint8Array(4);
    window.__norender = false;
    const drain = () => { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
    const states = ['none', 'off', 'away', 'on', 'way', 'scan'];
    const set = (s) => {
      g.funke = s === 'none' ? null : A; g.settings.funke = s !== 'off';
      g.camMode = s === 'away' ? 0 : 1; g.player.pitch = s === 'scan' ? -0.5 : -0.1;
      if (A) { A.wayT = 0; A.scanT = 0; if (A.line) A.endLine(); }
      if (s === 'way' && A) { const p = g.player, yaw = p.yaw; A.wayT = 0; A.startWay({ pos: [p.pos[0] - Math.sin(yaw) * 120, p.pos[1], p.pos[2] - Math.cos(yaw) * 120], name: 'x', kind: 'test' }); A.wayT = 2.5; }
      if (s === 'scan' && A) { if (!A.scanData) { A.scan(false); while (A.scanJob) { if (A.scanJob.step(64, 0)) A.scanDone(); } } A.scanT = 5; A.scanT0 = (g.time || 0) - 100; }
    };
    const frame = () => { const t0 = performance.now(); g.last = t0 - 33; g.loop(performance.now()); const t1 = performance.now(); drain(); const t2 = performance.now(); return [t1 - t0, t2 - t0, r.stats.draws | 0]; };
    const out = {}; for (const s of states) out[s] = { cpu: [], all: [], draws: 0 };
    drain();
    for (let k = 0; k < rounds; k++) {
      const order = states.slice(k % states.length).concat(states.slice(0, k % states.length));
      for (const s of order) {
        set(s); frame(); frame();   // (two frames to settle the state)
        const c = [], a = []; let d = 0;
        for (let i = 0; i < n; i++) { const q = frame(); c.push(q[0]); a.push(q[1]); d = q[2]; }
        c.sort((x, y) => x - y); a.sort((x, y) => x - y);
        out[s].cpu.push(c[n >> 1]); out[s].all.push(a[n >> 1]); out[s].draws = d;
      }
    }
    g.funke = A; g.settings.funke = true; if (A) { A.wayT = 0; A.scanT = 0; } g.camMode = 0; g.player.pitch = 0; window.__norender = true;
    const med = (x) => { const b = x.slice().sort((p, q) => p - q); return +b[b.length >> 1].toFixed(2); };
    const R = {}; for (const s of states) R[s] = { cpu: med(out[s].cpu), all: med(out[s].all), draws: out[s].draws, rounds: out[s].all.map(v => +v.toFixed(1)) };
    return { R, own: { upd: F.cost.ms / Math.max(1, F.cost.frames), draw: F.cost.drawMs / Math.max(1, F.cost.frames), frames: F.cost.frames } };
  }, [ROUNDS, N]);
  rec.presets[preset] = res;
  fs.writeFileSync(SHOTS + 'funke_cost.json', JSON.stringify(rec, null, 1));
  console.log(`  ${preset}:`);
  for (const [s, v] of Object.entries(res.R)) console.log(`    ${s.padEnd(5)} cpu ${String(v.cpu).padStart(8)} ms · drained ${String(v.all).padStart(8)} ms · ${v.draws} draws · rounds ${v.rounds.join(' ')}`);
  const R = res.R, base = R.none.all, worst = Math.max(R.on.all, R.away.all, R.off.all);
  console.log(`    (Funke's own over the probe: ${(res.own.upd * 1000).toFixed(1)} µs update + ${(res.own.draw * 1000).toFixed(1)} µs draw a frame)`);
  if (preset === 'potato') check(R.off.all <= base * 1.1 + 0.5 && R.away.all <= base * 1.1 + 0.5, `Very Low: off ${R.off.all} ms and on with the drone out of view ${R.away.all} ms ≈ without Funke ${base} ms`);
  void worst;
}
{
  const errs = logs.filter(l => /\[(error|pageerror)\]/.test(l));
  console.log(`--- logs (${logs.length})`); for (const l of logs.slice(0, 20)) console.log(l);
  check(errs.length === 0, `no error (${errs.length})`);
}
await browser.close();
console.log(`(${secs()})`);
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);
