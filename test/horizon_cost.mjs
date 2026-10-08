// F8 cost measurement: the far horizon's CPU time, triangles and memory, and the frame time, for a list of
// configurations (preset:horizon level) on one or more builds. Fixed scene: world seed 1, noon, zen freeze, the spawn
// point, 1280x720. Each build runs in its own browser context (its own saved data). Absolute times are SwiftShader's
// (CPU); the relative costs are the numbers that count.
//   CONFIGS=potato:1,potato:3,high:3 DIST_URLS=base=file:///…/base.html,after=file:///…/dist/index.html bash test/wt_run.sh horizon_cost.mjs 5000
//   (DIST_URL=<url> measures one build; with neither, this checkout's dist/index.html)
// prints one line per configuration and build:  COST {json}   and  ALL OK / FAILED n at the end
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const CONFIGS = (process.env.CONFIGS || 'potato:0,potato:1,potato:3,high:0,high:3').split(',').map(s => { const [p, h] = s.split(':'); return { p, h: +h }; });
const SEED = process.env.SEED || '1';
const FRAMES = +(process.env.FRAMES || 24);
const SETTLE_S = +(process.env.SETTLE || 300);
const BUILDS = process.env.DIST_URLS
  ? process.env.DIST_URLS.split(',').map(s => { const i = s.indexOf('='); return { label: s.slice(0, i), url: s.slice(i + 1) }; })
  : [{ label: 'dist', url: process.env.DIST_URL || 'file:///home/claude/vr/dist/index.html' }];
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const median = (a) => { const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; };
let fails = 0;
for (const build of BUILDS) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('[pageerror] ' + (e.stack || e.message).slice(0, 600)));
  page.on('console', m => { if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 300)); });
  const wait = (ms) => page.waitForTimeout(ms);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  // the loop is driven by hand (the page's own rAF is stopped below): one frame = one g.loop call
  const frame = () => ev(() => { const g = VR.game; g.last = performance.now() - 33; const t = performance.now(); g.loop(t); return performance.now() - t; });
  const settle = async (maxS) => {
    const t0 = Date.now();
    let quiet = 0;
    while (Date.now() - t0 < maxS * 1000) {
      await ev(() => { const g = VR.game; for (let i = 0; i < 4; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } });
      const s = await ev(() => { const g = VR.game; return { busy: g.pool.busy, pend: g.world.pending.size, lod: g.horizon ? g.horizon.inflight : 0, want: (g.world.lastWant || 0) + (g.horizon ? (g.horizon.stats.want || 0) : 0), fading: g.world.fading ? g.world.fading.size : 0, q: g.world.uploadQ ? g.world.uploadQ.size : 0 }; });
      if (s.busy === 0 && s.pend === 0 && s.lod === 0 && !s.want && !s.fading && !s.q) quiet++; else quiet = 0;
      if (quiet >= 5) break;
      await wait(60);
    }
    return +((Date.now() - t0) / 1000).toFixed(1);
  };
  await page.goto(build.url);
  for (let i = 0; i < 160; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
  await ev((seed) => VR.game.createWorld({ name: 'HorizonCost', mode: 'creative', difficulty: 'peaceful', type: 'default', seed, cheats: true, kit: false }), SEED);
  for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
  await ev(() => {
    const g = VR.game;
    window.requestAnimationFrame = () => 0;
    g.hideHud = true; const hud = document.getElementById('hud'); if (hud) hud.style.visibility = 'hidden';
    g.env.setTime(6000); g.zenFreezeTime = true;
    window.__hz = { u: 0, d: 0 };
    if (g.horizon && !g.horizon.__wrapped) {
      const h = g.horizon; h.__wrapped = true;
      const u0 = h.update.bind(h), d0 = h.draw.bind(h);
      h.update = (c) => { const t = performance.now(); u0(c); window.__hz.u += performance.now() - t; };
      h.draw = (r, E) => { const t = performance.now(); d0(r, E); window.__hz.d += performance.now() - t; };
    }
  });
  for (const cfg of CONFIGS) {
    await ev(([p, h]) => {
      const g = VR.game;
      g.applyPreset(p);
      g.settings.dynRes = false; g.settings.minimap = false; g.settings.horizon = h;
      g.applySettings('*');
      g.env.setTime(6000);
    }, [cfg.p, cfg.h]);
    await wait(200);
    const settleS = await settle(SETTLE_S);
    const ft = [], hu = [], hd = [];
    for (let k = 0; k < FRAMES; k++) {
      await ev(() => { window.__hz = { u: 0, d: 0 }; });
      const ms = await frame();
      const after = await ev(() => { const z = window.__hz; return { u: z.u, d: z.d }; });
      if (k === 0) continue;   // the first frame after a change pays for the new tiles' bookkeeping
      ft.push(ms); hu.push(after.u); hd.push(after.d);
    }
    const st = await ev(() => {
      const g = VR.game, h = g.horizon, r = g.renderer;
      return { enabled: h ? h.enabled() : false, tiles: h ? h.tiles.size : 0, drawn: h ? h.stats.drawn : 0, hTris: h ? Math.round(h.stats.tris / 1000) : 0, allTris: Math.round(r.stats.tris / 1000), draws: r.stats.draws, mb: h ? +h.stats.mb.toFixed(1) : 0, cols: g.world.cols.size, renderDist: g.world.renderDist, horizonRadius: h ? h.radius : 0 };
    });
    const out = { build: build.label, cfg: cfg.p + ':' + cfg.h, seed: SEED, settleS: +settleS, frames: ft.length, frameMedianMs: +median(ft).toFixed(1), frameMaxMs: +Math.max(...ft).toFixed(1), hzUpdateMedianMs: +(median(hu) || 0).toFixed(2), hzDrawMedianMs: +(median(hd) || 0).toFixed(2), ...st };
    console.log('COST ' + JSON.stringify(out));
    if (!st.enabled && cfg.h > 0) { console.log('horizon not enabled for ' + build.label + ' ' + cfg.p); fails++; }
  }
  if (errs.length) { console.log('errors (' + build.label + '): ' + errs.length + '\n' + errs.slice(0, 8).join('\n')); fails += errs.filter(e => e.startsWith('[pageerror]')).length; }
  await ctx.close();
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
await browser.close();
