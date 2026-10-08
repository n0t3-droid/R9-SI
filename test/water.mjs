// F7 · Wasser (realism wave): the water of a generated world as a player sees it — a lake shore at noon, at sunset and
// at night; the same shore from under the surface; a river and a waterfall — on Very Low (potato) and High, plus the
// frame cost of the water on the shore (wall time per frame with gl.finish, the reflection pass on its own).
// Shots: test/shots/water_<preset>_<n>_<scene>.png (TAG=water). LOOK at them.
// PRESET=potato,high (default both) · SEED=777 · DIST=<path to a dist/index.html> (baseline builds) · NO_COST=1 · COST_ONLY=1 (no shots)
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const TAG = process.env.TAG || 'water';
const PRESETS = (process.env.PRESET || 'potato,high').split(',');
const DIST = process.env.DIST || '/home/claude/vr/dist/index.html';
const SEED = process.env.SEED || '777';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const report = {};

for (const preset of PRESETS) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail|missing|shader/i.test(s)) logs.push(`[${t}] ${s.slice(0, 700)}`); });
  page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
  await page.goto('file://' + DIST);
  const wait = (ms) => page.waitForTimeout(ms);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  // advance the game without drawing (the renderer skips its work), as the classic tests do
  const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 20) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(20, n - k), dtms]); } };
  const shot = async (name, tod) => {
    if (process.env.COST_ONLY) return;
    await ev((tod) => { window.__norender = false; const g = VR.game; g.env.setTime(tod); g.env.rain = 0; g.env.rainTarget = 0; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }, tod);
    await wait(200);
    await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 180000 });
    console.log('shot', name);
  };
  // the camera: where the player stands, where it looks
  const look = async (pos, yaw, pitch) => { await ev(([p, y, pt]) => { const pl = VR.game.player; pl.teleport(p[0], p[1], p[2]); pl.flying = true; pl.yaw = y; pl.pitch = pt; }, [pos, yaw, pitch]); await step(12); };

  console.log(`== ${preset}`);
  for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
  await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.minimap = false; g.settings.renderDist = 8; g.applySettings('*'); }, preset);
  await ev(`VR.game.createWorld({name:'Water ${preset}',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:true})`);
  for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
  await ev(() => { const g = VR.game; g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.visibility = 'hidden'; g.zenFreezeTime = true; });
  for (let i = 0; i < 12; i++) { await step(20); await wait(250); }

  // 1. the nearest ocean, then a lake-like shore: water on one side, land on the other, found by scanning the columns
  const oc = await ev(() => new Promise((res) => { const g = VR.game, p = g.player; g.pool.direct(0, { type: 'locate', dim: 'overworld', biome: 'ocean', x: Math.floor(p.pos[0]), z: Math.floor(p.pos[2]) }, null, (m) => res(m.pos)); }));
  if (oc) { await ev((o) => { const p = VR.game.player; p.teleport(o[0] + 0.5, 90, o[2] + 0.5); p.flying = true; }, oc); for (let i = 0; i < 30; i++) { await step(20); await wait(300); } }
  const spot = await ev(() => {
    const g = VR.game, w = g.world, p = g.player, R = VR.R, F = VR.F;
    const isW = (x, y, z) => { const s = w.getBlock(x, y, z); return s && (R.T.flags[s] & F.WATER); };
    const isSolid = (x, y, z) => { const s = w.getBlock(x, y, z); return s && (R.T.flags[s] & F.OPAQUE) && !(R.T.flags[s] & F.WATER); };
    let best = null, bs = -1;
    for (let dz = -90; dz <= 90; dz += 2) for (let dx = -90; dx <= 90; dx += 2) {
      const x = Math.floor(p.pos[0] + dx), z = Math.floor(p.pos[2] + dz);
      if (!w.isLoaded(x, z)) continue;
      const y = w.topAt(x, z); if (!isW(x, y, z) || isW(x, y + 1, z)) continue;
      // a shore: land (solid, same height) next to the water, and open water on the other side
      for (const [ex, ez] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!w.isLoaded(x + 9 * ex, z + 9 * ez)) continue;
        const ly = w.topAt(x + ex * 2, z + ez * 2);
        if (!isSolid(x + ex * 2, ly, z + ez * 2) || isW(x + ex * 2, ly, z + ez * 2)) continue;
        let depth = 0; while (depth < 14 && isW(x - ex * 4, y - depth, z - ez * 4)) depth++;
        const open = [1, 2, 3, 4, 5, 6, 7, 8].filter(k => isW(x - ex * k, y, z - ez * k)).length;
        const score = depth * 2 + open;
        if (score > bs) { bs = score; best = { x, y, z, ex, ez, depth }; }
      }
    }
    return best;
  });
  console.log('shore', JSON.stringify(spot));
  check(!!spot, `${preset}: a shore with open water was found`);
  if (spot) {
    // the camera stands 9 blocks out over the water, 4 blocks above it, and looks at the shoreline
    const dir = [-spot.ex, -spot.ez];           // from the land back over the water
    const camP = [spot.x + 0.5 - spot.ex * 0.5 + dir[0] * 8 + 0.5, spot.y + 4.5, spot.z + 0.5 + dir[1] * 8];
    const yaw = Math.atan2(spot.ex, spot.ez) + Math.PI, pitch = -0.28;
    await look(camP, yaw, pitch);
    await shot(`${TAG}_${preset}_1_lake_noon`, 6000);
    await shot(`${TAG}_${preset}_2_lake_sunset`, 12600);
    await shot(`${TAG}_${preset}_3_lake_night`, 18500);
    // the same shore from under the surface (the eye 0.9 blocks below the water)
    await look([spot.x + 0.5 + dir[0] * 3, spot.y - 2.4, spot.z + 0.5 + dir[1] * 3], yaw, 0.02);
    await shot(`${TAG}_${preset}_4_under`, 6000);
    // the frame cost on the shore (noon): wall time per frame with the GPU drained, the reflection pass on its own
    if (!process.env.NO_COST) {
      await look(camP, yaw, pitch);
      await ev(() => { window.__norender = false; VR.game.env.setTime(6000); });
      const cost = await ev(() => new Promise((res) => {
        const g = VR.game, gl = g.renderer.gl, n = 12; let k = 0, sum = 0, refl = 0, draws = 0, tris = 0;
        const frame = () => { const t0 = performance.now(); g.last = performance.now() - 33; g.loop(performance.now()); gl.finish(); sum += performance.now() - t0; refl += g.renderer.stats.reflMs || 0; draws += g.renderer.stats.draws; tris += g.renderer.stats.tris; if (++k < n) setTimeout(frame, 0); else res({ ms: sum / n, reflMs: refl / n, draws: draws / n, tris: Math.round(tris / n) }); };
        frame();
      }));
      await ev(() => { window.__norender = true; });
      report[preset] = Object.assign(report[preset] || {}, { shoreMs: +cost.ms.toFixed(1), reflMs: +cost.reflMs.toFixed(2), draws: Math.round(cost.draws), tris: cost.tris });
      console.log('cost', preset, JSON.stringify(report[preset]));
    }
  }
  // 2. a river (flowing water) and 3. a waterfall (falling water with air under it), searched in the loaded columns
  const flow = await ev(() => {
    const g = VR.game, w = g.world, p = g.player, R = VR.R, F = VR.F;
    const lvOf = (s) => { const t = R.types[R.T.type[s]]; return t ? t.get(s, 'level') : 0; };
    let best = null;
    for (let dz = -48; dz <= 48; dz++) for (let dx = -48; dx <= 48; dx++) {
      const x = Math.floor(p.pos[0] + dx), z = Math.floor(p.pos[2] + dz);
      if (!w.isLoaded(x, z)) continue;
      const y = w.topAt(x, z), s = w.getBlock(x, y, z);
      if (!s || !(R.T.flags[s] & F.WATER)) continue;
      const lv = lvOf(s), below = w.getBlock(x, y - 1, z), belowFl = R.T.flags[below];
      if (lv >= 8 && !(belowFl & F.OPAQUE) && !(belowFl & F.WATER)) { best = best || { kind: 'waterfall', x, y, z }; }
      else if (lv > 0 && lv < 8 && (R.T.flags[w.getBlock(x + 1, y, z)] & F.WATER) === 0 && !best) best = { kind: 'river', x, y, z };
    }
    return best;
  });
  console.log('flow', JSON.stringify(flow));
  if (flow) {
    const dirs = { river: [0.6, 0.8], waterfall: [0.8, 0.6] };
    const d = dirs[flow.kind], cam = [flow.x + 0.5 - d[0] * 9, flow.y + 3.5, flow.z + 0.5 - d[1] * 9];
    await look(cam, Math.atan2(d[0], d[1]) + Math.PI, -0.22);
    await shot(`${TAG}_${preset}_5_${flow.kind}`, 6000);
    report[preset] = Object.assign(report[preset] || {}, { flow: flow.kind });
  } else check(false, `${preset}: no river or waterfall found near the spawn (loaded area)`);
  const bad = logs.filter(l => /pageerror|shader|compile|link|WebGL/i.test(l));
  check(bad.length === 0, `${preset}: no page or shader errors${bad.length ? ' — ' + bad.slice(0, 3).join(' | ') : ''}`);
  await ctx.close();
}
console.log(JSON.stringify(report));
await browser.close();
console.log(fails ? fails + ' FAILED' : 'ALL OK');
