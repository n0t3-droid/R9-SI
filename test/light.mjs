// F1 · Licht & Luft in the browser, against dist/ (build first: node build.js).
//  - MEASURE: the fixed scene (default world, seed 1, the Heartland plaza at the spawn, 12:00 = ticks 6000, frozen
//    time and weather, 1280×720) on Very Low (potato) and High: per pass time (renderer.prof: gl.finish() around
//    every pass, so the SwiftShader work counts; relative costs only), draws, tris, sections, full-screen passes.
//    Written to .tmp_tests/light_measure_<TAG>.json and printed. Averages over FRAMES frames after a warm-up.
//  - SHOTS: outdoors above the plaza at 06:00 (ticks 0), 12:00 (6000), 18:30 (12500), 23:00 (17000); then inside a
//    lit stone room (two torches, a glowing block, a window) built beside the spawn, at 18:30 and 23:00. On Very Low
//    and High → test/shots/light_<preset>_<clock>.png and light_<preset>_inside_<clock>.png. LOOK at them.
//  - RD (default 6) caps the render distance of both presets: at 14 chunks (High) the default world takes too long to
//    generate on the shared machine. The shader tiers, shadows and effects are the preset's own.
//  - no page errors; every test ends with ALL OK / FAILED n.
// usage: TAG=f1base MODE=measure|shots|all PRESETS=potato,high FRAMES=8 DIST=<folder holding index.html> bash test/wt_run.sh light.mjs 1800
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const TAG = process.env.TAG || 'light';
const MODE = process.env.MODE || 'all';
const PRESETS = (process.env.PRESETS || 'potato,high').split(',');
const FRAMES = +(process.env.FRAMES || 8);
const SEED = process.env.SEED || '1';
const DIST = process.env.DIST || '/home/claude/vr/dist';
const RD = +(process.env.RD || 6);   // render distance (chunks) of the measured scene, the same cap on both builds
const SHOTS = '/home/claude/vr/test/shots';
const CLOCKS = [['0600', 0], ['1200', 6000], ['1830', 12500], ['2300', 17000]];
const INSIDE = [['1830', 12500], ['2300', 17000]];
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error') logs.push(`[${t}] ${s.slice(0, 400)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 800)));
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ok    ' : '  FAIL  ') + msg); };
const errorsNow = () => logs.filter(l => l.startsWith('[pageerror]') || l.startsWith('[error]'));

// loop the game without the browser's own frame chain: the test drives every frame (see atmosphere.mjs)
const drive = (n, render) => ev(([m, r]) => {
  const g = VR.game, R = g.renderer;
  window.requestAnimationFrame = () => 0;
  window.__norender = !r;
  for (let i = 0; i < m; i++) { g.last = performance.now() - 33; g.loop(performance.now()); }
  if (r) R.gl.finish();
  window.__norender = true;
}, [n, render]);
const settle = async (max = 120) => {
  for (let i = 0; i < max; i++) {
    await drive(10, false);
    const s = await ev(() => { const g = VR.game; let dirty = 0; for (const c of g.world.cols.values()) for (const sc of c.sec) if (sc.dirty || sc.pending) dirty++; return { busy: g.pool.busy, pend: g.world.pending.size, dirty }; });
    if (s.busy === 0 && s.pend === 0 && s.dirty === 0 && i > 3) break;
    await wait(60);
  }
};

try {
  await page.goto('file://' + DIST + '/index.html');
  for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
  const results = {};
  for (const preset of PRESETS) {
    await ev(([p, rd]) => { const g = VR.game; g.applyPreset(p); g.settings.renderDist = rd; g.settings.dynRes = false; g.applySettings('*'); }, [preset, RD]);
    await ev(`VR.game.createWorld({name:'Light ${preset}',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:true})`);
    for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
    await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.zenFreezeWeather = true; g.env.rainTarget = 0; g.hideHud = true; const hd = document.getElementById('hud'); if (hd) hd.style.display = 'none'; });
    await ev(() => { const g = VR.game, pl = g.player; pl.flying = true; pl.pitch = -0.08; pl.yaw = 0.6; });
    await ev(() => { const g = VR.game; g.env.setTime(6000); });
    await settle();
    if (MODE === 'measure' || MODE === 'all') {
      await ev(() => { const g = VR.game; g.env.setTime(6000); });
      await drive(3, true);                      // warm-up: shaders compile, first chunks upload
      await ev(() => { const R = VR.game.renderer; R.prof = {}; });
      await drive(FRAMES, true);
      const r = await ev((n) => {
        const R = VR.game.renderer, P = R.prof; const out = { passes: {}, fsPerFrame: (P.fs || 0) / n, W: R.w, H: R.h, outW: R.W, outH: R.H, shadowRes: R.shadowSize || 0 };
        for (const k of Object.keys(P)) if (k !== 'cur' && k !== 't' && k !== 'fs') out.passes[k] = +(P[k] / n).toFixed(3);
        out.total = +Object.values(out.passes).reduce((a, b) => a + b, 0).toFixed(3);
        out.stats = { draws: R.stats.draws, tris: Math.round(R.stats.tris), sections: R.stats.sections, shadowDraws: R.stats.shadowDraws || 0, ms: +R.stats.ms.toFixed(2) };
        out.player = [VR.game.player.pos[0].toFixed(1), VR.game.player.pos[1].toFixed(1), VR.game.player.pos[2].toFixed(1)];
        R.prof = null;
        return out;
      }, FRAMES);
      results[preset] = r;
      console.log(`[${preset}] ${r.W}x${r.H} total ${r.total} ms/frame (passes), draws ${r.stats.draws}, tris ${r.stats.tris}, sections ${r.stats.sections}, fs passes ${r.fsPerFrame}`);
      console.log('   ' + Object.entries(r.passes).map(([k, v]) => `${k} ${v}`).join(' · '));
      check(r.total > 0 && Number.isFinite(r.total), `${preset}: the passes measured (${r.total} ms)`);
    }
    if (MODE === 'shots' || MODE === 'all') {
      // where the player stands on the ground (the room is built beside it, after the outdoor pictures)
      const ground = await ev(() => { const pl = VR.game.player; return [Math.floor(pl.pos[0]), Math.floor(pl.pos[1]), Math.floor(pl.pos[2])]; });
      // the picture: above the plaza, 30 blocks up, looking across the land (the spec's outdoor shots)
      await ev(() => { const g = VR.game, pl = g.player; pl.flying = true; pl.teleport(pl.pos[0], pl.pos[1] + 30, pl.pos[2]); pl.pitch = -0.12; });
      await settle(60);
      for (const [label, t] of CLOCKS) {
        await ev((tt) => { const g = VR.game; g.env.setTime(tt); }, t);
        await drive(3, true);
        await drive(1, true);
        await page.screenshot({ path: `${SHOTS}/light_${preset}_${label}.png`, timeout: 180000 });
        console.log('shot', preset, label);
      }
      // inside a lit room, built beside the spawn: stone walls on a plinth, a window, two torches and a glowing block
      await ev(([gx, gy, gz]) => {
        const g = VR.game, w = g.world, R = VR.R, pl = g.player;
        const S = (n) => { const t = R.byName[n]; return t ? t.defaultState : null; };
        const ox = gx + 30, oz = gz - 24, y0 = gy - 1;
        const put = (x, y, z, s) => { if (s !== null) w.setBlock(x, y, z, s, 4); };
        const stone = S('stone_bricks') ?? S('stone'), floor = S('oak_planks') ?? S('planks'), glass = S('glass');
        const torch = S('torch'), lamp = S('glowstone') ?? S('lantern') ?? S('torch');
        for (let x = -1; x <= 9; x++) for (let z = -1; z <= 9; z++) {
          for (let y = y0 - 3; y <= y0; y++) put(ox + x, y, oz + z, stone);
          for (let y = y0 + 1; y <= y0 + 6; y++) put(ox + x, y, oz + z, 0);
        }
        for (let x = 0; x <= 8; x++) for (let z = 0; z <= 8; z++) {
          put(ox + x, y0, oz + z, floor);
          put(ox + x, y0 + 5, oz + z, stone);
          if (x === 0 || x === 8 || z === 0 || z === 8) for (let y = y0 + 1; y <= y0 + 4; y++) put(ox + x, y, oz + z, stone);
        }
        for (let z = 3; z <= 5; z++) for (let y = y0 + 2; y <= y0 + 3; y++) put(ox + 8, y, oz + z, glass);
        for (let y = y0 + 1; y <= y0 + 2; y++) put(ox + 4, y, oz, 0);
        put(ox + 1, y0 + 2, oz + 1, torch); put(ox + 7, y0 + 2, oz + 7, torch); put(ox + 4, y0 + 1, oz + 4, lamp);
        pl.flying = true; pl.teleport(ox + 4.5, y0 + 1.02, oz + 2.5); pl.pitch = -0.12; pl.yaw = 0.6;
      }, ground);
      await settle(80);
      for (const [label, t] of INSIDE) {
        await ev((tt) => { const g = VR.game; g.env.setTime(tt); }, t);
        await drive(3, true);
        await drive(1, true);
        await page.screenshot({ path: `${SHOTS}/light_${preset}_inside_${label}.png`, timeout: 180000 });
        console.log('shot', preset, 'inside', label);
      }
    }
  }
  if (MODE === 'measure' || MODE === 'all') {
    fs.mkdirSync('/home/claude/vr/.tmp_tests', { recursive: true });
    fs.writeFileSync(`/home/claude/vr/.tmp_tests/light_measure_${TAG}.json`, JSON.stringify(results, null, 1));
    for (const p of PRESETS) check(results[p] && results[p].stats.draws >= 0, `${p}: measured draws ${results[p] && results[p].stats.draws}`);
  }
  check(errorsNow().length === 0, `no page or WebGL errors (${errorsNow().length})`);
  for (const l of errorsNow().slice(0, 6)) console.log('    ' + l.slice(0, 300));
} catch (e) {
  fails++;
  console.log('  FAIL  exception: ' + (e.stack || e.message).slice(0, 600));
} finally {
  await browser.close();
}
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
