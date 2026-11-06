// regress: skip — v-flora's pictures (docs/superpowers/plans/2026-11-05-v-flora.md): a world of vgen 16 (before) and one of
// vgen 17 (after, the land between in bloom), seed 4242, the same views — a meadow walk at eye height by a way, a lone
// blossom tree, the Traumbaum (a wonder spot), the glow ring by day and at night, a wide vista over the Traumbaum's
// meadow — and the cost of the meadow and the Traumbaum views on High and on Very Low.
//   The poses: test/flora_views.json (pinned — found by test/flora_preview.js at 917ebbbb; a new run of it proposes
//   test/shots/flora_views.json, copy it over only to move the pictures on purpose).
//   While a view streams the uploads get 80 ms a frame and the takt is off (run 7: 424 uploads waiting). View distance 6 (the vista stands 72 blocks from the Traumbaum: inside it); a drawn frame ends in gl.finish (run 5
//   queued drawn frames into a GPU backlog: the screenshots timed out). The world streams as critic_photo.mjs waits for it: every column within the view distance generated, meshed, shown
//   and faded in (run 4 of the first try photographed the horizon's stand-ins: its wait looked at 7 × 7 columns only).
// Pictures test/shots/flora_<view>_v<16|17>.png, costs test/shots/flora_cost_16_17.json.
//   nohup bash test/wt_run.sh flora.mjs 3600 > .tmp_tests/flora.log 2>&1 &
//   VIEWS=meadow,tree,giant,ring,ringnight,vista · VG=16,17 · NOCOST=1
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const ROOT = new URL('../', import.meta.url).pathname.replace(/\.tmp_tests\/$/, '');
const SHOTS = ROOT + 'test/shots/';
fs.mkdirSync(SHOTS, { recursive: true });
const W = 960, H = 540, T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
const POSE = JSON.parse(fs.readFileSync(ROOT + 'test/flora_views.json', 'utf8'));   // (the poses of the shipped pictures, pinned; flora_preview.js proposes new ones in test/shots/flora_views.json)
const TOD = { meadow: 8200, tree: 8200, giant: 8200, ring: 8200, ringnight: 18500, vista: 8200 }, RUN = { giant: 120, ringnight: 120 };
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
  for (let i = 0; i < 160; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title').catch(() => false)) break; }
  await ev(() => { const r = VR.game.renderer; if (!r._render) { r._render = r.render; r.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } });
  const step = async (n, dtms = 33, draw = false) => { for (let k = 0; k < n; k += 10) { await ev(([m, d, draw]) => { const g = VR.game; window.__norender = !draw; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } if (draw) g.renderer.gl.finish(); window.__norender = true; }, [Math.min(10, n - k), dtms, draw]); await wait(4); } };
  const boost = (on) => ev((on) => { const w = VR.game.world; if (on) { if (w.__ub === undefined) { w.__ub = w.uploadBudget; w.uploadBudget = () => 80; w.__tk = w.streamTakt; w.streamTakt = false; const U = w.uploadQ; if (U) { U.__frame = U.frame; U.frame = function () {}; } } if (w.uploadQ) { w.uploadQ.scale = 1; w.uploadQ.frameK = 1; w.uploadQ.debtMs = 0; } } else if (w.__ub !== undefined) { w.uploadBudget = w.__ub; w.streamTakt = w.__tk; delete w.__ub; const U = w.uploadQ; if (U && U.__frame) { U.frame = U.__frame; delete U.__frame; } } const q = VR.game.renderer && VR.game.renderer.q; if (!q) return; if (on) { if (q.__up === undefined) q.__up = q.upload; q.upload = 24; } else if (q.__up !== undefined) { q.upload = q.__up; delete q.__up; } }, on);
  const holdFar = (on) => ev((on) => { const pool = VR.game.pool; if (!pool || !pool.queueFar) return 0; if (on) pool.__heldFar = (pool.__heldFar || []).concat(pool.queueFar.splice(0)); else if (pool.__heldFar) { for (const j of pool.__heldFar) pool.queueFar.push(j); pool.__heldFar = null; pool.queueDirty = true; if (pool.pump) pool.pump(); } return 0; }, on);
  // critic_photo.mjs's wait: within the view distance every column shown, nothing pending, uploading, fading or arriving
  const settle = async (maxS) => {
    let s = null, last = Infinity, stall = 0; const t0 = Date.now();
    await boost(true);
    for (let i = 0; ; i++) {
      if (i % 4 === 0) await holdFar(true);
      await boost(true);   // (the upload queue's scale and debt back to full every round: run 10's 773 uploads crawled, the hitch meter had learned SwiftShader's slow uploads)   // (the far tiles' jobs wait: run 6's Traumbaum view stood in stand-ins, the workers busy with the horizon)
      await step(10); if (i % 3 === 2) await step(1, 33, true);   // (a drawn frame now and then: the uploads and fades run in it)
      s = await ev(() => { const g = VR.game, w = g.world, p = g.player; const rd = Math.max(1, (w.renderDist | 0) - 1), ri = Math.max(1, rd - 2), pcx = Math.floor(p.pos[0]) >> 4, pcz = Math.floor(p.pos[2]) >> 4; let dirty = 0; for (const c of w.cols.values()) { let n = 0; for (const sc of c.sec) if ((sc.dirty || sc.pending) && sc.count > 0) n++; const ex = c.cx - pcx, ez = c.cz - pcz; if (n && ex * ex + ez * ez <= ri * ri) dirty += n; } let unshown = 0; for (let dz = -rd; dz <= rd; dz++) for (let dx = -rd; dx <= rd; dx++) { if (dx * dx + dz * dz > rd * rd) continue; const c = w.col(pcx + dx, pcz + dz); if (!c || !(c.shownAt >= 0)) unshown++; } return { busy: g.pool.busy, far: g.pool.queueFar ? g.pool.queueFar.length : -1, pend: w.pending.size, dirty, up: w.uploadQ ? w.uploadQ.size : 0, fading: w.fading ? w.fading.size : 0, unshown, arr: w.arrivals ? w.arrivals.length : 0 }; });
      const shown = s.pend === 0 && s.up === 0 && s.fading === 0 && s.unshown === 0 && s.arr === 0;
      stall = shown && s.dirty >= last ? stall + 1 : 0; last = s.dirty;
      const el = (Date.now() - t0) / 1000; s.s = Math.round(el);
      if (s.unshown === 0 && s.pend === 0 && s.dirty === 0 && s.fading === 0 && i > 2) break;
      if (shown && ((s.busy === 0 && s.dirty === 0) || stall >= 6) && i > 2) break;
      if (el >= maxS) break;
      await wait(60);
    }
    await boost(false); await holdFar(false);
    return s;
  };
  const look = async (P) => {
    await ev(([c, yaw, pitch]) => { const pl = VR.game.player; pl.flying = true; pl.noclip = true; pl.teleport(c[0], c[1] - 1.62, c[2]); pl.yaw = yaw; pl.pitch = pitch; pl.viewYaw = yaw; pl.vel = [0, 0, 0]; }, [P.from, P.yaw, P.pitch]);
    const s = await settle(+(process.env.SETTLE || 300)); console.log(`  settled in ${s.s} s (unshown ${s.unshown}, dirty ${s.dirty}, pend ${s.pend}, busy ${s.busy}, far ${s.far}, arr ${s.arr}, up ${s.up}) · ${secs()}`); return s;
  };
  // the picture: the canvas read in the same task as its frame (run 8: page.screenshot waited ten minutes for the compositor)
  const shot = async (name) => {
    const url = await ev(() => { window.__norender = false; const g = VR.game; let u = ''; for (let i = 0; i < 3; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); u = g.renderer.gl.canvas.toDataURL('image/png'); window.__norender = true; return u; });
    if (!url || url.length < 1000) { console.log('shot', name, 'failed'); return false; }
    fs.writeFileSync(SHOTS + `flora_${name}_${tag}.png`, Buffer.from(url.split(',')[1], 'base64')); console.log('shot', name, tag, secs()); return true;
  };
  const timeFrames = async () => {
    const runs = [];
    for (let k = 0; k < 5; k++) runs.push(await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 3; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); const t0 = performance.now(); for (let i = 0; i < 6; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; return (performance.now() - t0) / 6; }));
    return Math.min(...runs);
  };
  await ev((rd) => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.settings.renderDist = rd; g.settings.storyOffer = false; g.applySettings('*'); }, +(process.env.RD || 6));
  await ev(`VR.game.createWorld({name:'Flora',mode:'creative',difficulty:'peaceful',type:'default',seed:'${process.env.SEED || '4242'}',cheats:true,kit:true,vgen:${vg}})`);
  for (let i = 0; i < 120; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
  await ev(() => {
    const g = VR.game; g.zenFreezeTime = true; g.settings.wowMoments = false; g.settings.storyOffer = false; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true;
    if (g.arrival && g.arrival.skip) { try { g.arrival.skip(); } catch (e) { /* none */ } }
    if (g.env.wx && g.env.wx.force) g.env.wx.force('klar');
    const st = document.createElement('style'); st.textContent = '#hud,#ui,#hints,#hint,#lockhint,#ctxprompt,#ctxring,#ctxringl,.toast{display:none !important}'; document.head.appendChild(st);
  });
  const info = await ev(() => ({ vgen: VR.game.meta && VR.game.meta.vgen }));
  console.log(`== ${tag}: vgen ${info.vgen} · ${secs()}`);
  res[tag] = { vgen: info.vgen, hi: {}, vl: {}, settle: {} };
  for (const name of views) {
    const P = POSE[name]; if (!P) continue;
    await ev((t) => VR.game.env.setTime(t), TOD[name]);
    const s = await look(P); res[tag].settle[name] = s.unshown;
    await ev((t) => VR.game.env.setTime(t), TOD[name]);
    await step(RUN[name] || 6); await ev((t) => VR.game.env.setTime(t), TOD[name]);
    await shot(name);
    res[tag].hi[name] = +(await timeFrames()).toFixed(1);
  }
  if (!process.env.NOCOST) {
    await ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.dynRes = false; g.applySettings('*'); });
    for (const name of ['meadow', 'giant']) { const P = POSE[name]; await ev((t) => VR.game.env.setTime(t), TOD[name]); await look(P); await step(6); res[tag].vl[name] = +(await timeFrames()).toFixed(1); }
  }
  res[tag].logs = logs;
  console.log('cost', tag, JSON.stringify(res[tag]));
  await ctx.close();
}
if (VG.length > 1) ok(res[A0] && res[A0].vgen === VG[0] && res[A1] && res[A1].vgen === VG[1], `the worlds are vgen ${VG[0]} and ${VG[1]} (${res[A0] && res[A0].vgen}, ${res[A1] && res[A1].vgen})`);
for (const v of views) ok(fs.existsSync(SHOTS + `flora_${v}_${A0}.png`) && fs.existsSync(SHOTS + `flora_${v}_${A1}.png`), `the ${v} view before and after`);
for (const t of [...new Set([A0, A1])]) ok(Object.values(res[t].settle).every(u => u === 0), `${t}: every view's columns were shown (${JSON.stringify(res[t].settle)})`);
ok(!res[A0].logs.length && !res[A1].logs.length, `no page error (${(res[A0].logs.concat(res[A1].logs)).join(' | ').slice(0, 300) || 'none'})`);
fs.writeFileSync(SHOTS + 'flora_cost_' + VG.join('_') + '.json', JSON.stringify(res, null, 1));
await browser.close();
console.log(bad ? `FAILED ${bad}` : 'ALL OK');
