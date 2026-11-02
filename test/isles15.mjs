// regress: skip — o-wander3's pictures of the Sky Isles (docs/superpowers/plans/2026-11-02-o-wander3.md §2): a world of
// vgen 14 (before) and one of vgen 15 (after, the floating gardens), seed 4242, the same views — from below (the meadow
// under the centre isle), from afar (150 m west, at the isles' height), from the side, the top — and each view's cost
// on High and on Very Low. Pictures test/shots/isles15_<view>_v<14|15>.png.
//   nohup bash test/wt_run.sh isles15.mjs 3600 > .tmp_tests/isles15.log 2>&1 &
//   VIEWS=below,afar,side,top · SEED=4242
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const ROOT = new URL('../', import.meta.url).pathname;
const SHOTS = ROOT + 'test/shots/';
fs.mkdirSync(SHOTS, { recursive: true });
const W = 960, H = 540;
const VIEW = {
  below: { from: [296, 84, 196], to: [330, 140, 140], tod: 7000 },   // under the centre isle's south-west rim, looking up
  afar: { from: [175, 150, 150], to: [330, 146, 140], tod: 7000 },   // 155 m west, at the isles' height
  side: { from: [262, 150, 222], to: [330, 146, 140], tod: 7000 },   // near, a little under the rim
  top: { from: [330, 182, 214], to: [330, 160, 150], tod: 7000 },    // over the centre isle's south rim
};
const views = (process.env.VIEWS || 'below,afar,side,top').split(',');
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
let bad = 0; const ok = (c, m) => { if (!c) bad++; console.log((c ? '  ✓ ' : '  ✗ ') + m); };
const res = {};
const VG = (process.env.VG || '14,15').split(',').map(Number), A0 = 'v' + VG[0], A1 = 'v' + VG[1];   // (f-polish9: VG=15,16)
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
  const look = async (from, to) => { await ev(([c, t]) => { const pl = VR.game.player; pl.flying = true; pl.noclip = true; pl.teleport(c[0], c[1], c[2]); pl.yaw = Math.atan2(-(t[0] - c[0]), -(t[2] - c[2])); pl.pitch = Math.atan2(t[1] - c[1], Math.hypot(t[0] - c[0], t[2] - c[2])); }, [from, to]); await settle(); };
  const shot = async (name) => {
    for (let k = 0; k < 2; k++) {
      try {
        await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; });
        await page.screenshot({ path: SHOTS + `isles15_${name}_${tag}.png`, timeout: 240000 }); console.log('shot', name, tag); return true;
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
  await ev(() => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.settings.renderDist = 12; g.applySettings('*'); });
  await ev(`VR.game.createWorld({name:'Isles',mode:'creative',difficulty:'peaceful',type:'default',seed:'${process.env.SEED || '4242'}',cheats:true,kit:true,vgen:${vg}})`);
  for (let i = 0; i < 120; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
  await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; for (const id of ['hud', 'ui', 'hints']) { const h = document.getElementById(id); if (h) h.style.display = 'none'; } g.settings.anim = false; g.applySettings('anim'); });
  const info = await ev(() => ({ vgen: VR.game.meta && VR.game.meta.vgen }));
  console.log(`== ${tag}: vgen ${info.vgen}`);
  res[tag] = { vgen: info.vgen, hi: {}, vl: {} };
  for (const name of views) {
    const S = VIEW[name]; if (!S) continue;
    await ev((t) => VR.game.env.setTime(t), S.tod);
    await look(S.from, S.to); await step(4);
    await shot(name);
    res[tag].hi[name] = +(await timeFrames()).toFixed(1);
  }
  await ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.dynRes = false; g.applySettings('*'); });
  for (const name of ['below', 'afar']) { const S = VIEW[name]; await look(S.from, S.to); await step(6); res[tag].vl[name] = +(await timeFrames()).toFixed(1); }
  res[tag].logs = logs;
  console.log('cost', tag, JSON.stringify(res[tag]));
  await ctx.close();
}
ok(res[A0] && res[A0].vgen === VG[0] && res[A1] && res[A1].vgen === VG[1], `the worlds are vgen ${VG[0]} and ${VG[1]} (${res[A0] && res[A0].vgen}, ${res[A1] && res[A1].vgen})`);
for (const v of views) ok(fs.existsSync(SHOTS + `isles15_${v}_${A0}.png`) && fs.existsSync(SHOTS + `isles15_${v}_${A1}.png`), `the ${v} view before and after`);
ok(!res[A0].logs.length && !res[A1].logs.length, `no page error (${(res[A0].logs.concat(res[A1].logs)).join(' | ').slice(0, 300) || 'none'})`);
fs.writeFileSync(SHOTS + (process.env.VG ? 'isles' + VG[1] + '_cost.json' : 'isles15_cost.json'), JSON.stringify(res, null, 1));
await browser.close();
console.log(bad ? `FAILED ${bad}` : 'ALL OK');
