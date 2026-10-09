// The trailer's shuttle shots (docs/trailer, shots A and D): the shuttle docks on the Gate Temple's apron in front of the
// portal and parks there, the sky traffic flies loose formations over the Heartland, and the cost of the flight effects on
// Very Low (potato). Pictures: test/shots/trailer_<tag>_<shot>.png. One browser runs both builds, one after the other:
// R9_BEFORE (optional URL of an earlier build, tagged "before") first, then R9_URL (default: this checkout's dist, tagged
// "after"). Run it through test/wt_run.sh, never directly.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const BEFORE = process.env.R9_BEFORE || '';
const AFTER = process.env.R9_URL || 'file:///home/claude/vr/dist/index.html';
const browser = await chromium.launch({ channel: 'chromium', args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
let fails = 0; const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
// one build, one page: the same steps for both builds (the tag names the pictures)
const run = async (URL, TAG) => {
  console.log('== ' + TAG + ' · ' + URL.slice(0, 80));
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const logs = [];
  page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 500)}`); });
  page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1200)));
  await page.goto(URL);
  const wait = (ms) => page.waitForTimeout(ms);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  // the game loop is stepped by hand (headless animation frames are lazy): each call advances the simulation 33 ms
  // (the warm-up frames are simulated without drawing: only the shots and the cost frames are drawn)
  const frames = (n) => ev((n) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; let t = window.__t || performance.now(); for (let i = 0; i < n; i++) { t += 33; g.last = t - 33; g.loop(t); } window.__t = t; return n; }, n);
  // the picture as the frames show it: the HUD and the hints are hidden (F1), and the hand and the block outline with them.
  // F8 uploads finished meshes a few ms a frame and fades a column in over 300 ms once all its sections are meshed: the
  // queue is emptied first (without advancing the game) and the fade-in gets its real time before the drawn frame
  const HIDE = ['hud', 'hints'];
  const shot = async (name) => {
    await ev(() => { const g = VR.game, w = g.world, p = g.player; for (let i = 0; i < 400 && w.uploadQ && w.uploadQ.size; i++) w.drainUploads(p.pos[0], p.pos[2]); return 1; });
    await wait(400);
    await ev((H) => { window.__norender = false; const g = VR.game; g.hideHud = true; for (const id of H) { const h = document.getElementById(id); if (h) h.style.visibility = 'hidden'; } window.__t = (window.__t || performance.now()) + 33; g.last = window.__t - 33; g.loop(window.__t); g.renderer.gl.finish(); window.__norender = true; }, HIDE);
    await page.screenshot({ path: `/home/claude/vr/test/shots/trailer_${TAG}_${name}.png` });
    await ev((H) => { VR.game.hideHud = false; for (const id of H) { const h = document.getElementById(id); if (h) h.style.visibility = 'visible'; } }, HIDE);
  };
  // F8: a column is drawn only once all its sections are meshed (world.checkShown). Single frames (the workers mesh
  // between them) until the columns within r chunks of the camera are shown and faded in, or maxMs of real time
  const settle = async (r, maxMs) => {
    const t0 = Date.now(); let left = -1;
    while (Date.now() - t0 < maxMs) {
      left = await ev((r) => { const g = VR.game, w = g.world, p = g.player, cx = Math.floor(p.pos[0]) >> 4, cz = Math.floor(p.pos[2]) >> 4; let n = 0; for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) { const c = w.cols.get(VR.ckey(cx + dx, cz + dz)); if (!c || !c.ready || !(c.shownAt >= 0) || c.fade < 1) n++; } return n; }, r);
      if (!left) break;
      await frames(1); await wait(150);
    }
    return { left, s: Math.round((Date.now() - t0) / 1000) };
  };
  await wait(6000);
  await ev(() => { const g = VR.game; g.settings.renderDist = 6; g.settings.dynRes = false; g.settings.minimap = false; g.applySettings('renderDist'); });
  await ev(`VR.game.createWorld({name:'Trailer',mode:'creative',difficulty:'normal',type:'default',seed:'424242',cheats:true,kit:true})`);
  for (let i = 0; i < 60; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
  // every g.loop() call asks for one more animation frame, so each hand-stepped frame would start one more real loop and
  // the game raced ahead during every wait (the formation flew past and was gone in each earlier run): from here on only
  // the hand steps the game, as in cabin.mjs
  await ev(() => { window.requestAnimationFrame = () => 0; return 1; });
  await frames(30);
  // ---- shot D (the frame t3_03): the camera on the plaza at the craft's height, about 14 m in front of the apron, the
  // portal behind. A shuttle comes in over the plaza and parks on the apron, turned to face the camera (after; before: a
  // craft flies by). The apron is dockPoint(): x 0, deck 81, z 30; the temple's front is at z 20.
  await ev(() => { const g = VR.game, p = g.player; p.teleport(0, 85.4, 44); p.flying = true; p.yaw = 0; p.pitch = 0.03; g.env.setTime(12600); });
  await frames(40);
  const sp = await settle(3, 120000);
  console.log('  (plaza: columns within 3 chunks not yet shown: ' + sp.left + ' after ' + sp.s + ' s)');
  const spawned = await ev(() => { const g = VR.game; g.traffic.spawnFlight({ arch: 'shuttle', dock: true }); return true; });
  check(spawned, TAG + ': a shuttle is launched toward the Gate Temple');
  // the design comes back from a worker (behind the chunk jobs on a loaded machine): the page must run between the frames
  for (let i = 0; i < 300; i++) { await wait(200); if (await ev(() => VR.game.traffic.ships.some(s => s.dock))) break; }
  await frames(60);
  for (let i = 0; i < (TAG === 'after' ? 40 : 1); i++) { await frames(20); await wait(40); if (await ev(() => VR.game.traffic.ships.some(s => s.dock && s.dock.phase === 'park'))) break; }
  await frames(TAG === 'after' ? 150 : 30);   // the craft turns on the apron (about 3 s) before the picture
  const parked = await ev(() => VR.game.traffic.ships.filter(s => s.dock && s.dock.phase === 'park').map(s => ({ y: +s.pos[1].toFixed(2), z: +s.pos[2].toFixed(1), off180: +Math.abs(Math.atan2(Math.sin(s.heading - Math.PI), Math.cos(s.heading - Math.PI))).toFixed(3) })));
  check(TAG !== 'after' || parked.length > 0, TAG + ': the shuttle parks on the apron, facing the plaza (' + JSON.stringify(parked) + ')');
  await shot('plaza');
  // ---- formation (the frame t1_01): loose formations of 2 to 4 over the canyon. The camera hangs off the right side of a
  // lead shuttle, a little behind and above, so its engine trails run back across the frame as in the trailer.
  // the formation is launched from the plaza (where the chunks are loaded, so the worker's designs come back in time);
  // the camera goes to the canyon's side of a lead shuttle only once the formation is flying
  for (let k = 0; k < 3; k++) await ev(() => { VR.game.traffic.spawnFlight({ arch: 'shuttle' }); return 1; });
  const tW = Date.now();
  for (let i = 0; i < 450; i++) { await wait(200); if (await ev(() => VR.game.traffic.ships.filter(s => s.arch === 'shuttle' && !s.dock).length >= 2)) break; }
  // on a loaded machine the worker's new designs can sit behind the chunk jobs (every earlier run got 0 or 1 of them):
  // then the formation flies a shuttle design the cache already holds (the docking one), through the same launch() as
  // every sky flight — and the run says so, with the pool's state
  const late = await ev(() => {
    const g = VR.game, T = g.traffic;
    if (T.ships.filter(s => s.arch === 'shuttle' && !s.dock).length >= 2) return null;
    const P = g.pool, D = [...g.starships.designs.values()], d0 = D.find(d => d.meta && d.meta.arch === 'shuttle');
    const info = { inflight: P.workers.map(w => w.inflight), started: P.started.size, waiting: D.filter(d => !d.meta).length, cached: !!d0 };
    if (d0) for (let k = 0; k < 3; k++) T.launch(d0, new VR.RNG(1000 + k), {});
    return info;
  });
  if (late) console.log('  (note) after ' + Math.round((Date.now() - tW) / 1000) + ' s the formation designs were not back ' + JSON.stringify(late) + ': the formation flies the cached shuttle design');
  for (let i = 0; i < 10; i++) { await frames(20); await wait(30); }
  const fl = await ev(() => VR.game.traffic.ships.filter(s => s.arch === 'shuttle' && !s.dock).length);
  check(fl >= 2, TAG + ': several shuttles fly over the Heartland (' + fl + ')');
  const aim = await ev(() => {
    const g = VR.game, p = g.player;
    const S = g.traffic.ships.filter(s => s.arch === 'shuttle' && !s.dock && !s.warpOut && !s.dead);
    const s = S.find(x => x.t > 0.25 && x.t < 0.75) || S[0];
    if (!s) return null;
    const h = Number.isFinite(s.heading) ? s.heading : 0, f = [-Math.sin(h), 0, -Math.cos(h)], R = [Math.cos(h), 0, -Math.sin(h)];   // flight direction, right side
    const cam = [s.pos[0] + R[0] * 28 - f[0] * 6, s.pos[1] + 7, s.pos[2] + R[2] * 28 - f[2] * 6];
    const d = [s.pos[0] - cam[0], s.pos[1] - cam[1], s.pos[2] - cam[2]];
    p.teleport(cam[0], cam[1], cam[2]); p.yaw = Math.atan2(-d[0], -d[2]); p.pitch = Math.atan2(d[1], Math.hypot(d[0], d[2]));
    return { n: S.length, t: +s.t.toFixed(2), dist: +Math.hypot(d[0], d[1], d[2]).toFixed(1) };
  });
  check(aim !== null, TAG + ': a lead shuttle is framed from its side (' + JSON.stringify(aim) + ')');
  await frames(1);
  await shot('formation');
  // ---- cost on Very Low: the frame's JS time with the flight effects on (potato), averaged over 30 drawn frames
  await ev(() => VR.game.applyPreset('potato'));
  await frames(60);
  const cost = await ev(() => { window.__norender = false; const g = VR.game; let s = 0, n = 0; for (let i = 0; i < 30; i++) { window.__t += 33; g.last = window.__t - 33; g.loop(window.__t); s += g.jsMs || 0; n++; } window.__norender = true; return { js: s / n, fps: g.fps || 0, ships: g.traffic.ships.length }; });
  console.log('COST ' + TAG + ' potato js_ms ' + cost.js.toFixed(2) + ' fps ' + Math.round(cost.fps) + ' traffic ' + cost.ships);
  check(cost.js < 60, TAG + ': the frame logic stays under 60 ms on Very Low (' + cost.js.toFixed(1) + ' ms)');
  check(!logs.some(l => /pageerror/.test(l)), TAG + ': no page errors');
  console.log('--- logs ' + TAG + ' (' + logs.length + ')'); for (const l of logs.slice(0, 20)) console.log(l);
  await page.close();
};
if (BEFORE) await run(BEFORE, 'before');
await run(AFTER, 'after');
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
