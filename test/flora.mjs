// regress: skip — v-flora's pictures (docs/superpowers/plans/2026-11-05-v-flora.md): a world of vgen 16 (before) and one of
// vgen 17 (after, the land between in bloom), seed 4242, the same views — a meadow walk at eye height, a blossom tree,
// the Traumbaum (a wonder spot), the glow ring by day and at night, a wide vista — and the cost of the meadow and the
// Traumbaum views on High and on Very Low. Pictures test/shots/flora_<view>_v<16|17>.png, costs flora_cost.json.
//   nohup bash test/wt_run.sh flora.mjs 3600 > .tmp_tests/flora.log 2>&1 &
//   VIEWS=meadow,tree,giant,ring,ringnight,vista · VG=16,17
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const ROOT = new URL('../', import.meta.url).pathname;
const SHOTS = ROOT + 'test/shots/';
fs.mkdirSync(SHOTS, { recursive: true });
const W = 960, H = 540;
const VIEW = {
  meadow: { from: [-340, 86.2, 20], to: [-310, 83, -5], tod: 7000 },        // a meadow walk by a way, eye height
  tree: { from: [-180, 84.6, -139], to: [-192, 87, -150], tod: 7000 },      // a Wolkenkirsche in the meadow
  giant: { from: [254, 73, 60], to: [282, 80, 36], tod: 7000, run: 90 },    // the Traumbaum (petals falling)
  ring: { from: [-220, 88.6, -182], to: [-210, 85, -192], tod: 7000 },      // the glow ring by day
  ringnight: { from: [-220, 88.6, -182], to: [-210, 85, -192], tod: 18500, run: 90 },   // … and at night
  vista: { from: [222, 104, 104], to: [300, 74, 10], tod: 7000 },           // wide, over the land toward the Traumbaum
};
const views = (process.env.VIEWS || 'meadow,tree,giant,ring,ringnight,vista').split(',');
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
let bad = 0; const ok = (c, m) => { if (!c) bad++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const res = {};
const VG = (process.env.VG || '16,17').split(',').map(Number), A0 = 'v' + VG[0], A1 = 'v' + VG[VG.length - 1];
for (const vg of VG) {
  const tag = 'v' + vg;
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, locale: 'de-DE' });
  const page = await ctx.newPage();
  const logs = [];
  page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 800)));
  await page.goto('file://' + ROOT + 'dist/index.html');
  const wait = (ms) => page.waitForTimeout(ms);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(5); } };
  const settle = async (max = 300) => { for (let i = 0; i < max; i++) { await step(10); const s = await ev(() => { const g = VR.game; return { busy: g.pool.busy, pend: g.world.pending.size, lod: g.horizon ? g.horizon.inflight : 0, want: g.world.lastWant || 0 }; }); if (s.busy === 0 && s.pend === 0 && s.lod === 0 && !s.want && i > 3) break; await wait(100); } };
  // (run 1: far from the spawn the views showed the horizon's stand-ins — settle returned before the columns came: now
  // it waits until every column within 3 chunks of the eye and of the target is generated, meshed and shown)
  const shown = ([f, t]) => { const W = VR.game.world; let n = 0, ok = 0; for (const p of [f, t]) for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) { n++; const c = W.col((Math.floor(p[0]) >> 4) + dx, (Math.floor(p[2]) >> 4) + dz); if (c && c.shownAt >= 0) ok++; } return ok / n; };
  const look = async (from, to, quick) => {
    await ev(([c, t]) => { const pl = VR.game.player; pl.flying = true; pl.noclip = true; pl.teleport(c[0], c[1], c[2]); pl.yaw = Math.atan2(-(t[0] - c[0]), -(t[2] - c[2])); pl.pitch = Math.atan2(t[1] - c[1], Math.hypot(t[0] - c[0], t[2] - c[2])); }, [from, to]);
    let f = 0; for (let i = 0; i < (quick ? 40 : 150); i++) { await settle(20); await ev(() => { window.__norender = false; const g = VR.game; g.last = performance.now() - 33; g.loop(performance.now()); window.__norender = true; }); f = await ev(shown, [from, to]); /* (one real frame a round: the uploads and fades run in the drawn frame) */ if (f >= 0.97) break; await wait(500); }
    console.log('  columns shown', f.toFixed(2)); await step(40);
  };
  const shot = async (name) => {
    for (let k = 0; k < 2; k++) {
      try {
        await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; });
        await page.screenshot({ path: SHOTS + `flora_${name}_${tag}.png`, timeout: 240000 }); console.log('shot', name, tag); return true;
      } catch (e) { console.log('shot', name, 'failed:', String(e.message || e).split('\n')[0]); }
    }
    return false;
  };
  const timeFrames = async () => {
    const runs = [];
    for (let k = 0; k < 5; k++) runs.push(await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 3; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); const t0 = performance.now(); for (let i = 0; i < 6; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; return (performance.now() - t0) / 6; }));
    return Math.min(...runs);
  };
  for (let i = 0; i < 160; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title').catch(() => false)) break; }
  await ev((rd) => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.settings.renderDist = rd; g.applySettings('*'); }, +(process.env.RD || 8));
  await ev(`VR.game.createWorld({name:'Flora',mode:'creative',difficulty:'peaceful',type:'default',seed:'${process.env.SEED || '4242'}',cheats:true,kit:true,vgen:${vg}})`);
  for (let i = 0; i < 120; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
  await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; for (const id of ['hud', 'ui', 'hints']) { const h = document.getElementById(id); if (h) h.style.display = 'none'; } g.settings.anim = false; g.applySettings('anim'); });
  const info = await ev(() => ({ vgen: VR.game.meta && VR.game.meta.vgen }));
  console.log(`== ${tag}: vgen ${info.vgen}`);
  res[tag] = { vgen: info.vgen, hi: {}, vl: {} };
  for (const name of (vg === VG[0] && process.env.VIEWS0 ? process.env.VIEWS0.split(',') : views)) {   // (VIEWS0: the before world's views — run 3 kept run 2's before pictures)
    const S = VIEW[name]; if (!S) continue;
    await ev((t) => VR.game.env.setTime(t), S.tod);
    await look(S.from, S.to); await step(S.run || 4);
    await shot(name);
    res[tag].hi[name] = +(await timeFrames()).toFixed(1);
  }
  if (!process.env.NOCOST) await ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.dynRes = false; g.applySettings('*'); });
  if (!process.env.NOCOST) for (const name of ['meadow', 'giant']) { const S = VIEW[name]; await look(S.from, S.to, true); await step(6); res[tag].vl[name] = +(await timeFrames()).toFixed(1); }
  res[tag].logs = logs;
  console.log('cost', tag, JSON.stringify(res[tag]));
  await ctx.close();
}
if (VG.length > 1) ok(res[A0] && res[A0].vgen === VG[0] && res[A1] && res[A1].vgen === VG[1], `the worlds are vgen ${VG[0]} and ${VG[1]} (${res[A0] && res[A0].vgen}, ${res[A1] && res[A1].vgen})`);
for (const v of views) ok(fs.existsSync(SHOTS + `flora_${v}_${A0}.png`) && fs.existsSync(SHOTS + `flora_${v}_${A1}.png`), `the ${v} view before and after`);
ok(!res[A0].logs.length && !res[A1].logs.length, `no page error (${(res[A0].logs.concat(res[A1].logs)).join(' | ').slice(0, 300) || 'none'})`);
fs.writeFileSync(SHOTS + 'flora_cost_' + VG.join('_') + '.json', JSON.stringify(res, null, 1));
await browser.close();
console.log(bad ? `FAILED ${bad}` : 'ALL OK');
