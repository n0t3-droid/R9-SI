// The trailer's plants (voxplants.js, vgen 7) on Very Low: the same town, the same camera, the frame cost with the
// v0.41 town (vgen 6) and with the plants (vgen 7). AGENTS.md rule 5: the potato preset must not get slower — the
// plants may cost at most 6 % more per frame on the palm avenue and the palm road (the two spots with most of them),
// measured as SwiftShader CPU frames on this machine (a comparison of two builds in one run, not a GPU timing).
//   bash test/wt_run.sh plants_cost.mjs      · SEED=4242 (the trailer_plants.mjs town) · N=6 frames per spot
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const SEED = process.env.SEED || '4242', N = +(process.env.N || 6);
const DIST = process.env.DIST || '/home/claude/vr/dist/index.html';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };

// the frame cost inside the page (test/water.mjs): warm frames, then n frames with the GPU drained after each one;
// the game's own frame loop is paused meanwhile
const measure = (n, warm = 2) => new Promise((res, rej) => {
  const g = VR.game, gl = g.renderer.gl;
  const raf = window.requestAnimationFrame;
  window.requestAnimationFrame = () => 0;
  const finish = (fn, v) => { window.requestAnimationFrame = raf; fn(v); };
  let k = -warm, sum = 0, draws = 0, tris = 0;
  const frame = () => {
    try {
      const t0 = performance.now(); g.last = performance.now() - 33; g.loop(performance.now());
      gl.finish();
      const dt = performance.now() - t0;
      if (k < 0) { k++; setTimeout(frame, 0); return; }
      const st = g.renderer.stats || {};
      sum += dt; draws += st.draws || 0; tris += st.tris || 0;
      if (++k < n) setTimeout(frame, 0);
      else finish(res, { ms: +(sum / n).toFixed(1), draws: Math.round(draws / n), tris: Math.round(tris / n) });
    } catch (e) { finish(rej, e); }
  };
  frame();
});
const step = async (page, n) => {
  for (let k = 0; k < n; k += 20) {
    await page.evaluate(([m]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } }, [Math.min(20, n - k)]);
    await page.waitForTimeout(60);
  }
};
const aim = (p, t) => { const dx = t[0] - p[0], dy = t[1] - p[1], dz = t[2] - p[2]; return [Math.atan2(dx, dz), Math.atan2(dy, Math.hypot(dx, dz))]; };
const boot = async (vgen) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail|shader/i.test(s)) logs.push(`[${t}] ${s.slice(0, 500)}`); });
  page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1200)));
  await page.goto('file://' + DIST);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  for (let i = 0; i < 120; i++) { await page.waitForTimeout(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
  await ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.dynRes = false; g.settings.minimap = false; g.applySettings('*'); });
  await ev(`VR.game.createWorld({name:'Plants cost ${vgen}',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',vgen:${vgen},cheats:true,kit:true})`);
  for (let i = 0; i < 120; i++) { await page.waitForTimeout(1000); if (await ev(() => VR.game.state) === 'play') break; }
  await ev(() => { const g = VR.game; g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.visibility = 'hidden'; g.zenFreezeTime = true; g.env.setTime(6000); });
  return { ctx, page, logs, ev };
};
const SPOTS = [['avenue', [1, 84, -78], [1, 88, -130]], ['palm road', [0, 84, -196], [0, 90, -260]]];
const out = {};
for (const vgen of [6, 7]) {
  const { ctx, page, logs, ev } = await boot(vgen);
  const got = await ev(() => { const w = VR.game.world; return w && w.genOpts ? w.genOpts.vgen : null; });
  check(got === vgen, `vgen ${vgen}: the world runs it (${got})`);
  out[vgen] = {};
  for (const [name, pos, tgt] of SPOTS) {
    const [yaw, pitch] = aim(pos, tgt);
    await ev(([p, y, pt]) => { const pl = VR.game.player; pl.flying = true; pl.noclip = true; pl.teleport(p[0], p[1], p[2]); pl.yaw = y; pl.pitch = pt; }, [pos, yaw, pitch]);
    // the land settles around the spot: no mesh in flight and nothing dirty near the camera
    for (let i = 0; i < 60; i++) { await step(page, 20); await page.waitForTimeout(400); if (await ev(() => { const w = VR.game.world; return !w.meshInflight && (w.uploadQ ? !w.uploadQ.size : true) && i > 8; })) break; }
    await ev(() => { window.__norender = false; });
    const m = await page.evaluate(measure, N);
    await ev(() => { window.__norender = true; });
    out[vgen][name] = m;
    console.log(`  vgen ${vgen} · ${name}: ${JSON.stringify(m)}`);
  }
  const plants = await ev(() => { const R = VR.R, w = VR.game.world; let n = 0; for (const c of w.cols.values()) { if (!c.ready) continue; for (let i = 0; i < c.blocks.length; i++) { const t = R.types[R.T.type[c.blocks[i]]]; if (t && /^vm_(palm_crown|tree_round|tuft|flower|bush_blossom|crop)/.test(t.name)) n++; } } return n; });
  console.log(`  vgen ${vgen} · plant blocks in the loaded columns: ${plants}`);
  out[vgen].plants = plants;
  check(logs.length === 0, `vgen ${vgen}: no page or shader errors${logs.length ? ' — ' + logs.slice(0, 2).join(' | ') : ''}`);
  await ctx.close();
}
check(out[7].plants > out[6].plants, `vgen 7 has the plants (${out[7].plants} > ${out[6].plants} plant blocks)`);
for (const [name] of SPOTS) {
  const a = out[6][name].ms, b = out[7][name].ms, r = b / a;
  check(r <= 1.06, `Very Low ${name}: ${b} ms with the plants vs ${a} ms without (${r.toFixed(2)}×, tris ${out[7][name].tris} vs ${out[6][name].tris}) — at most 1.06×`);
}
console.log(JSON.stringify(out));
await browser.close();
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);
