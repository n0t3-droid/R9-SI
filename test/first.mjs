// Die erste Minute (t-first; plan docs/superpowers/plans/2026-10-16-t-first.md) in the browser — the base build (v0.48,
// before) beside this one (after), 1280 × 720, de-DE, each build in a browser context of its own (its own storage):
//   A · the base build on Balanced (set, not the auto-pick: SwiftShader would start on Very Low): its title (the vgen-5
//       panorama) — picture and cost —, ▶ Losspielen: its loading screen and its first frame (the Hangar Hall's pad)
//   B · this build on Balanced: the start screen's first paint (ms from the boot; the tiles over the CSS backdrop before
//       the textures are in), the living title (the citadel at the golden hour, no chunks) — picture, cost, the 30 fps
//       cap, the drift at two times of its loop, the composition's candidates, High's look of it —, ▶ Losspielen (seed
//       4242): the loading screen with its phases over the sky (no chunk drawn behind it), the white rising over it, the
//       arrival (the white veil at its start, half-way with the sun's flare, at its end over the vista's composition), the
//       moment's hold and its way down into the eyes, the standing picture (the HUD back), the title released, the 📷
//       photo mode on screen and its picture saved at 2×
//   C · Very Low and High, both builds side by side in two pages: the title (Very Low: one still frame of the sky, no
//       world, no workers), then a world's play frame at a fixed pose — draws, triangles, sections, full-screen passes and
//       the time (the two pages measured in turns, so the machine's load falls on both alike)
//   D · (ONLY=…,D; f-arrival) the arrival of seeds 53, 4242, 31337, 7 on both builds: the frame the veil opens on, its
//       camera measured with real blocks (test/arrival.js part 6), 🏠 Heimkehr's frame in the first seed's world
// → test/shots/first_<name>.png, test/shots/first_sheet.jpg (python3 /root/r9coord/sheet.py), test/shots/first.json,
//   test/shots/first_arrival_sheet.jpg (D)
//   bash test/wt_run.sh first.mjs 3600        (BASE=…/dist/index.html the build before — default .tmp_tests/base/dist;
//   without it the before parts are skipped · ONLY=A,B,C the parts (D on request) · DSEEDS=53,4242,… D's seeds)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import sharp from '/home/dev/.npm-global/lib/node_modules/sharp/lib/index.js';
import fs from 'fs';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
const ROOT = fileURLToPath(new URL('../', import.meta.url));   // (this checkout: the copy runs from .tmp_tests/)
const NEW = 'file://' + ROOT + 'dist/index.html';
const BASEF = process.env.BASE || ROOT + '.tmp_tests/base/dist/index.html';
const BASE = fs.existsSync(BASEF) ? 'file://' + BASEF : null;
const SHOTS = ROOT + 'test/shots/';
const ONLY = (process.env.ONLY || 'A,B,C').split(',');
// the new world's seed: 31337 opens, like most seeds (6 of 8 tried), on the Spire Citadel from ~300 blocks with the low sun
// beside it (4242, run 2's, on the Gate Temple from beside the Sky Isles, their fog banks across the picture)
const SEED = process.env.SEED || '31337';
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const OUT = { when: new Date().toISOString() };
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--js-flags=--expose-gc', '--enable-precise-memory-info'] });
const logs = [];
const BAL = { preset: 'balanced', dynRes: false };
const POTATO = { preset: 'potato', far: 0, rdMax: 24, upload: 1.5, renderDist: 4, scale: 0.55, shadows: 0, clouds: 1, particles: 0, bloom: false, rays: false, fxaa: false, fancyLeaves: false, dynRes: false, magic: 0.8, horizon: 2, sunShadows: false, tsr: true, vxLod: 12, lite: true, sharpen: true, folk: 32, slow: true, wetGround: false, anim: false, matTier: 0, dropShadow: 0, lampGlow: 0, water: 0, bau: 'instant', smoothPlants: 0, smoothFurn: 0 };
async function context(tag) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'de-DE', acceptDownloads: true });
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('r9si.lang')) localStorage.setItem('r9si.lang', 'de'); } catch (e) { /* */ } });
  ctx.tag = tag; return ctx;
}
async function open(ctx, url, settings) {
  const page = await ctx.newPage();
  page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /pageerror|Uncaught/i.test(s)) logs.push(`[${ctx.tag} ${t}] ${s.slice(0, 500)}`); });
  page.on('pageerror', e => logs.push(`[${ctx.tag} pageerror] ` + (e.stack || e.message).slice(0, 1200)));
  if (settings) await page.addInitScript((s) => { try { if (!localStorage.getItem('r9si.settings')) localStorage.setItem('r9si.settings', JSON.stringify(s)); } catch (e) { /* */ } }, settings);
  await page.goto(url);
  return page;
}
const ev = (page, fn, arg) => page.evaluate(fn, arg);
const wait = (page, ms) => page.waitForTimeout(ms);
const untilState = async (page, st, ms) => { const t = Date.now(); while (Date.now() - t < ms) { const s = await ev(page, () => VR.game && VR.game.state); if (s === st) return true; await wait(page, 400); } return false; };
// (run 2 ended in a High frame's screenshot that never came — two High pages streaming the far ring in SwiftShader: a shot
// that times out is logged and the test goes on)
const shot = async (page, name, ms) => { try { await page.screenshot({ path: SHOTS + 'first_' + name + '.png', timeout: ms || 180000 }); } catch (e) { console.log('   (no shot first_' + name + ': ' + String(e.message).split('\n')[0] + ')'); return null; } console.log('   shot first_' + name + ' (' + secs() + ')'); return SHOTS + 'first_' + name + '.png'; };
// the loop by hand (rAF stubbed): n frames of dt ms, drawing only when asked (the renderer's draw skipped otherwise)
const manual = (page) => ev(page, () => { const g = VR.game; window.requestAnimationFrame = () => 0; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; });
const step = async (page, n, dt, drawLast) => { for (let k = 0; k < n; k += 15) { const m = Math.min(15, n - k), last = drawLast && k + m >= n; await ev(page, ([m, d, last]) => { const g = VR.game; for (let i = 0; i < m; i++) { window.__norender = !(last && i === m - 1); g.last = performance.now() - d; g.loop(performance.now()); } window.__norender = true; if (last) g.renderer.gl.finish(); }, [m, dt || 33, last]); } };
const heap = (page) => ev(page, () => { try { if (window.gc) { window.gc(); window.gc(); } } catch (e) { /* */ } return performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : -1; });
const gpu = (page) => ev(page, () => { const g = VR.game, r = g.renderer, hz = g.horizon; return { arenas: r.arenas.length, arenaMB: +r.gpuMemoryMB().toFixed(1), hzMB: hz ? +hz.stats.mb.toFixed(1) : 0, hzTiles: hz ? hz.stats.tiles : 0, cols: g.world ? g.world.cols.size : 0, busy: g.pool ? g.pool.busy : 0, draws: r.stats.draws, tris: r.stats.tris }; });
// the title's own frame (the scene's draw, or the old titleFrame), timed to a pixel read (gl.finish did not wait for
// SwiftShader's work in run 2: 0.7 ms a frame while the loop ran at 0.3 Hz), and the game loop's own rate over 4 s
const titleMs = (page) => ev(page, () => { const g = VR.game, gl = g.renderer.gl, px = new Uint8Array(4), out = []; for (let i = 0; i < 5; i++) { const t0 = performance.now(); if (g.titleScene) g.titleScene.draw(i * 0.5); else { g.last = performance.now() - 16; g.titleFrame(1 / 60); } gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); out.push(performance.now() - t0); } out.sort((a, b) => a - b); return +out[2].toFixed(1); });
const loopHz = (page) => ev(page, async () => { const g = VR.game, f0 = g.frame, t0 = performance.now(); await new Promise(r => setTimeout(r, 4000)); return { hz: +((g.frame - f0) / ((performance.now() - t0) / 1000)).toFixed(2), jsMs: +(g.jsMs || 0).toFixed(1) }; });

// ================================================================ A · the base build, Balanced
if (BASE && ONLY.includes('A')) {
  console.log('A · the base build (v0.48) on Balanced — ' + secs());
  const ctx = await context('base'), page = await open(ctx, BASE, BAL);
  check(await untilState(page, 'title', 240000), 'the base build reaches its start screen');
  await wait(page, 12000);   // (its panorama streams the title world's chunks)
  const lh = await loopHz(page), h = await heap(page), gp = await gpu(page), ms = await titleMs(page);
  OUT.titleBase = { heapMB: h, ...gp, ms, loopHz: lh.hz, jsMs: lh.jsMs, preset: await ev(page, () => VR.game.settings.preset) };
  console.log('   base title: ' + JSON.stringify(OUT.titleBase));
  await shot(page, 'title_base');
  const t0 = Date.now();
  await ev(page, (SEED) => { const g = VR.game, cw = g.createWorld.bind(g); g.createWorld = (o) => cw(Object.assign({}, o, o.seed ? {} : { seed: SEED })); VR.Start.newWorld(); }, SEED);
  let seenLoad = false, low = false;
  for (let i = 0; i < 400; i++) { await wait(page, 300); const s = await ev(page, () => ({ st: VR.game.state, w: (document.getElementById('loadbar') || {}).style ? document.getElementById('loadbar').style.width : '' })); if (s.st === 'loading' && parseFloat(s.w) < 30) low = true; if (!seenLoad && low && s.st === 'loading' && parseFloat(s.w) > 35) { seenLoad = true; await shot(page, 'loading_base'); } if (s.st === 'play') break; }
  OUT.loadBaseMs = Date.now() - t0;
  await manual(page); await step(page, 4, 33, true);
  await shot(page, 'spawn_base');
  OUT.spawnBase = await ev(page, () => { const g = VR.game, p = g.player; return { pos: p.pos.map(v => +v.toFixed(1)), yaw: +p.yaw.toFixed(2), tod: Math.round(g.env.timeOfDay), wx: g.env.wx.kind }; });
  console.log('   base: loaded in ' + OUT.loadBaseMs + ' ms, spawn ' + JSON.stringify(OUT.spawnBase));
  await page.close(); await ctx.close();
} else if (!BASE) console.log('A · skipped: no base build at ' + BASEF);

// ================================================================ B · this build, Balanced
if (ONLY.includes('B')) {
  console.log('B · this build on Balanced — ' + secs());
  const ctx = await context('new'), page = await open(ctx, NEW, BAL);
  // the start screen's first paint: the tiles while the game still boots (before the store and the textures)
  let early = null;
  for (let i = 0; i < 400 && !early; i++) { early = await ev(page, () => { const g = VR.game, t = document.getElementById('title'); return g && t && t.classList.contains('on') && document.querySelectorAll('#title .tile').length >= 4 ? { state: g.state, shown: g.titleShownMs, paint: g.titlePaintMs, boot0: g.bootT0 } : null; }); if (!early) await wait(page, 25); }
  if (early && early.state === 'boot') await shot(page, 'title_css');
  await wait(page, 300);
  const fp = await ev(page, () => ({ shown: VR.game.titleShownMs, paint: VR.game.titlePaintMs, boot0: VR.game.bootT0 }));
  OUT.firstPaint = Object.assign({ stateAtFirstLook: early && early.state }, fp);
  console.log('   first paint: ' + JSON.stringify(OUT.firstPaint));
  check(!!early && early.state === 'boot', `the start screen's tiles stand while the game still boots (the state then: ${early && early.state})`);
  check(fp.shown !== undefined && fp.shown <= 300, `its first frame within 300 ms of the boot's start (${fp.shown !== undefined ? fp.shown.toFixed(0) : '?'} ms; painted by ${fp.paint !== undefined ? fp.paint.toFixed(0) : '?'} ms; the boot began ${fp.boot0 ? fp.boot0.toFixed(0) : '?'} ms after the navigation)`);
  check(await untilState(page, 'title', 240000), 'the living title starts once the textures are in');
  // the land out of the haze: wait for the reveal (60 s at most)
  let rev = 0; for (let i = 0; i < 120 && rev < 1; i++) { await wait(page, 500); rev = await ev(page, () => VR.game.titleScene ? VR.game.titleScene.reveal : -1); }
  await wait(page, 600);
  const st = await ev(page, () => { const s = VR.game.titleScene; return s ? Object.assign(s.cost(), { ready: s.ready, readyMs: VR.game.titleReadyMs, landMs: s.landAt ? s.landAt - (VR.game.bootT0 || 0) : -1, live: document.getElementById('title').classList.contains('live'), preset: VR.game.settings.preset }) : null; });
  // the 30 fps cap: draws over 3 s of the game's own loop; the loop's rate and a frame's cost (to a pixel read) against the
  // old panorama's
  const d0 = await ev(page, () => VR.game.titleScene.drawn); await wait(page, 3000); const d1 = await ev(page, () => VR.game.titleScene.drawn);
  const lh = await loopHz(page), h = await heap(page), gp = await gpu(page), ms = await titleMs(page);
  OUT.title = Object.assign({ heapMB: h, ms, fps: +((d1 - d0) / 3).toFixed(1), loopHz: lh.hz, jsMs: lh.jsMs }, gp, st);
  console.log('   title: ' + JSON.stringify(OUT.title));
  await shot(page, 'title');
  check(st && st.preset === 'balanced' && st.mode === 'drift' && st.cols === 0 && gp.arenas === 0, `no chunks behind the title on ${st && st.preset} (${st ? st.cols : '?'} columns, ${gp.arenas} vertex arenas) — the far tiles only (${gp.hzTiles} tiles, ${gp.hzMB} MB)`);
  check(st && st.reveal >= 1 && gp.hzTiles > 0, `the land came out of the haze (reveal ${st ? st.reveal : '?'}; the first frame ${st && st.readyMs ? st.readyMs.toFixed(0) : '?'} ms, the land ${st ? st.landMs.toFixed(0) : '?'} ms after the boot)`);
  check((d1 - d0) / 3 <= 31.5, `the drift draws at 30 fps at most (${((d1 - d0) / 3).toFixed(1)} a second; the loop at ${lh.hz} Hz${OUT.titleBase ? ', the old panorama\'s at ' + OUT.titleBase.loopHz + ' Hz' : ''})`);
  // (the heap and the GPU's memory are the gate; a frame's time on SwiftShader is reported — there the sky's per-pixel work
  // is most of a frame, and the title is mostly sky: a GPU does it in a fraction of a millisecond)
  // (run 3 compared the GPU memory too and failed on it: the base's panorama was measured before its own world had come
  // in — 7 columns, 0 vertex arenas, 0 MB of far tiles — so the heap is the gate and the GPU's memory is reported)
  if (OUT.titleBase) check(h <= OUT.titleBase.heapMB + 2, `the title's heap ${h} MB against the old panorama's ${OUT.titleBase.heapMB} MB; GPU: ${gp.arenas} arenas, ${gp.arenaMB} MB (old ${OUT.titleBase.arenas}, ${OUT.titleBase.arenaMB} MB), horizon ${gp.hzMB} MB (old ${OUT.titleBase.hzMB}); a frame ${ms} ms against ${OUT.titleBase.ms} ms (SwiftShader, to a pixel read)`);
  // the drift: the loop's camera at 0 and 30 s (the scene's own loop draws, its clock held); then the start screen as most
  // players see it, 1920 × 1080
  const holdCam = (c) => ev(page, (c) => { const TS = VR.TitleScene; if (!TS.__cam) TS.__cam = TS.cam; TS.cam = typeof c === 'number' ? (t, out) => TS.__cam(c, out) : (t, out) => Object.assign(out || {}, c, { roll: 0 }); }, c);
  const settleHz = async (ms) => { const t = Date.now(); while (Date.now() - t < ms) { const p = await ev(page, () => { const hz = VR.game.horizon; return hz ? { p: hz.progress(), c: hz.stats.coarse || 0 } : { p: 1, c: 1 }; }); if (p.p >= 0.97 && p.c >= 1) break; await wait(page, 600); } await wait(page, 800); };
  for (const t of [0, 30]) { await holdCam(t); await settleHz(12000); await shot(page, 'title_t' + t); }
  await page.setViewportSize({ width: 1920, height: 1080 }); await settleHz(8000); await wait(page, 2500);
  await shot(page, 'title_1920');
  await page.setViewportSize({ width: 1280, height: 720 }); await wait(page, 2500);
  await ev(page, () => { const TS = VR.TitleScene; if (TS.__cam) { TS.cam = TS.__cam; delete TS.__cam; } });
  // High's look of the same title (its effects; the title keeps its own horizon: no far ring, level ≤ 3)
  await ev(page, () => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.applySettings('*'); });
  await settleHz(8000); await wait(page, 1500);
  OUT.titleHigh = await ev(page, () => { const g = VR.game, s = g.titleScene, hz = g.horizon; return { preset: g.settings.preset, mode: s && s.mode, level: hz && hz.level, far: !!(hz && hz.farOn && hz.farOn()), hzTiles: hz ? hz.stats.tiles : 0 }; });
  OUT.titleHigh.ms = await titleMs(page);
  await shot(page, 'title_high');
  check(OUT.titleHigh.preset === 'high' && OUT.titleHigh.level <= 3 && !OUT.titleHigh.far, `High keeps the title's own horizon (level ${OUT.titleHigh.level}, far ring ${OUT.titleHigh.far ? 'on' : 'off'}; a frame ${OUT.titleHigh.ms} ms)`);
  await ev(page, () => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.applySettings('*'); });
  await wait(page, 2000);
  // ▶ Losspielen (the start screen's own path; the seed fixed so every run opens the same world): the loading screen over the sky
  const t0 = Date.now();
  await ev(page, (SEED) => { const g = VR.game, cw = g.createWorld.bind(g); g.createWorld = (o) => cw(Object.assign({}, o, o.seed ? {} : { seed: SEED })); VR.Start.newWorld(); }, SEED);
  // (run 2 read the bar's width the boot's texture phase had left at 100 % before the first loading frame set it, and went
  // over to the hand-driven loop at once: the bar counts only once it has been seen low in this loading)
  let loadPic = false, sky = false, maxSec = 0, fresh = false; const phases = new Set(); let counts = '';
  for (let i = 0; i < 600; i++) {
    await wait(page, 250);
    const s = await ev(page, () => { const g = VR.game, L = document.getElementById('loading'); return { st: g.state, msg: (document.getElementById('loadmsg') || {}).textContent, det: (document.getElementById('loaddetail') || {}).textContent, sky: !!(L && L.classList.contains('sky')), w: parseFloat(document.getElementById('loadbar').style.width) || 0, sec: g.renderer.stats.sections, ar: g.arrival ? g.arrival.phase : null }; });
    if (s.st === 'loading') { if (s.w < 50 && s.det) fresh = true; if (s.msg) phases.add(s.msg); if (s.det) counts = s.det; if (s.sky) sky = true; maxSec = Math.max(maxSec, s.sec || 0); if (!loadPic && fresh && s.w > 40) { loadPic = true; await shot(page, 'loading'); } }
    if (s.st === 'loading' && ((fresh && s.w > 90) || s.ar)) break;
    if (s.st === 'play') break;
  }
  OUT.loadRealMs = Date.now() - t0;
  // the rest by hand: the white rising over the loading screen, then the arrival frame by frame
  await manual(page);
  let inShot = null;
  for (let i = 0; i < 2000; i++) {
    const s = await ev(page, () => { const g = VR.game, A = g.arrival; return { st: g.state, ph: A ? A.phase : null, v: A ? A.veilNow() : 0, msg: (document.getElementById('loadmsg') || {}).textContent, sec: g.renderer.stats.sections }; });
    if (s.st === 'play') break;
    if (s.msg) phases.add(s.msg);
    maxSec = Math.max(maxSec, s.sec || 0);
    if (s.ph === 'in') { await step(page, 1, 33, true); const v = await ev(page, () => VR.game.arrival ? VR.game.arrival.veilNow() : 0); if (!inShot && v >= 0.4 && v <= 0.8) { inShot = v; await shot(page, 'arrival_in'); } continue; }
    await step(page, 5, 33, false); await wait(page, 60);
  }
  OUT.loadMs = Date.now() - t0;
  OUT.loading = { phases: [...phases], counts, sky, sectionsDrawn: maxSec, whiteIn: inShot };
  console.log('   loading: ' + JSON.stringify(OUT.loading) + ' in ' + OUT.loadMs + ' ms');
  check(phases.size >= 2 && [...phases].some(p => /Hügel|Stadt|Licht|Ferne/.test(p)), `the loading screen names its phases (${[...phases].join(' · ')})`);
  check(/Erzeugt \d+\/\d+ · Gebaut \d+\/\d+ · Hochgeladen \d+\/\d+/.test(counts), `the counts under the bar („${counts}")`);
  check(sky && maxSec === 0, `the sky shows through the loading screen (.sky) — the sky alone, no chunk drawn behind it (${maxSec} sections)`);
  check(inShot !== null, `the white rises over the loading screen before the world opens (caught at ${inShot !== null ? inShot.toFixed(2) : '—'})`);
  const w0 = await ev(page, () => { const g = VR.game, A = g.arrival, m = g.meta, p = g.player, W = g.wow; return { arrival: !!A, phase: A && A.phase, sun: A && A.sun, veil: A ? +A.veilNow().toFixed(2) : null, vista: m.vistaId, vs: m.vistaStart, tod: Math.round(g.env.timeOfDay), wx: g.env.wx.kind, clear: g.env.wx.clearUntil, pos: p.pos.map(v => +v.toFixed(2)), yaw: +p.yaw.toFixed(3), hud: document.getElementById('hud').style.opacity, hideHud: g.hideHud, wow: W && W.active ? W.active.id : null, curve: W && W.active ? +VR.WowMoment.curve(W.t).toFixed(3) : null, seed: m.seed }; });
  OUT.arrive = w0;
  console.log('   at play: ' + JSON.stringify(w0));
  check(w0.vs === 2 && !!w0.vista, `the new world opened on its vista (${w0.vista}; seed ${w0.seed})`);
  check(Math.abs(w0.tod - 10800) < 60 || Math.abs(w0.tod - 1200) < 60, `at the golden hour (tod ${w0.tod}; the time held while loading)`);
  check(w0.wx === 'klar' && w0.clear === 24000, `clear for the first day (${w0.wx}, clear until ${w0.clear})`);
  check(w0.arrival && w0.phase === 'veil' && w0.veil > 0.9 && w0.hud === '0' && w0.hideHud === true, `the arrival begins: the white veil (${w0.veil}), the HUD and the hand away`);
  check(w0.wow === w0.vista && w0.curve === 1, `the veil opens on the vista's composition (the wow moment ${w0.wow} from the first frame, its camera at the picture: ${w0.curve})`);
  await step(page, 1, 33, true); await shot(page, 'arrival_0');
  await step(page, 29, 33, true);
  const w1 = await ev(page, () => { const A = VR.game.arrival, W = VR.game.wow; return A ? { veil: +A.veilNow().toFixed(2), glow: A.glow ? +A.glow.style.opacity : null, phase: A.phase, cap: W && W.dom ? +W.dom.style.opacity : null, curve: W && W.active ? +VR.WowMoment.curve(W.t).toFixed(3) : null } : null; });
  await shot(page, 'arrival_1');
  check(w1 && w1.veil > 0.25 && w1.veil < 0.75 && (!w0.sun || w1.glow > 0.3), `half-way the picture comes through the white (veil ${w1 && w1.veil}), the sun's flare ${w0.sun ? 'at (' + w0.sun.map(v => v.toFixed(2)).join(', ') + ') ' + (w1 && w1.glow) : '(the sun out of the picture)'}`);
  check(w1 && w1.curve === 1 && w1.cap <= 0.35, `the composition holds while the white thins (curve ${w1 && w1.curve}), the caption only coming (${w1 && w1.cap})`);
  await step(page, 27, 33, true); await shot(page, 'arrival_2');
  await step(page, 27, 33, true);
  const w2 = await ev(page, () => { const g = VR.game, W = g.wow; return { active: !!(W && W.active), id: W && W.active ? W.active.id : null, t: W ? +W.t.toFixed(2) : null, arrival: g.arrival ? g.arrival.phase : null, cap: W && W.dom ? +W.dom.style.opacity : null }; });
  await shot(page, 'moment');
  check(w2.active && w2.id === w0.vista && w2.arrival === 'moment' && w2.cap > 0.9, `after the veil the moment holds its picture (${w2.id}, the caption up: ${w2.cap}; the arrival in its '${w2.arrival}' phase)`);
  await step(page, 40, 33, true); await shot(page, 'fall');
  await step(page, 90, 33, false);
  await wait(page, 1600);   // (the HUD's fade is a CSS transition: real time)
  await step(page, 2, 33, true);
  const w3 = await ev(page, () => { const g = VR.game; return { arrival: !!g.arrival, wow: !!(g.wow && g.wow.active), hud: getComputedStyle(document.getElementById('hud')).opacity, vis: getComputedStyle(document.getElementById('hud')).visibility, hideHud: g.hideHud, seen: (g.meta.wowSeen || []).slice() }; });
  await shot(page, 'stand');
  check(!w3.arrival && !w3.wow && +w3.hud >= 0.99 && w3.vis === 'visible' && w3.hideHud === false && w3.seen.includes(w0.vista), `then the player stands in the picture, the HUD and the hand back (opacity ${w3.hud}), the vista seen`);
  // the title released
  const rel = await ev(page, () => { const g = VR.game; return { scene: !!g.titleScene, key: g.horizon ? g.horizon.worldKey : '', seed: g.meta.seed }; });
  OUT.release = Object.assign(rel, { heapMB: await heap(page) }, await gpu(page));
  check(!rel.scene && String(rel.key).startsWith(rel.seed + ':'), `the title is released when the world opens (no scene; the horizon holds the world's tiles: ${rel.key})`);
  // 📷 the photo mode
  await ev(page, () => { VR.game.photoMode(true); });
  await step(page, 2, 33, false);
  const p0 = await ev(page, () => { const g = VR.game, c = g.photoCam, s = c.s; s.x -= Math.sin(s.yaw) * -5; s.z -= Math.cos(s.yaw) * -5; s.y += 3; s.roll = 0.14; s.pitch = 0.04; return { on: c.on, pos: g.player.pos.slice(), hud: getComputedStyle(document.getElementById('hud')).display, tod: g.env.timeOfDay }; });
  await step(page, 3, 33, true);
  await shot(page, 'photo_view');
  const dl = page.waitForEvent('download', { timeout: 120000 }).catch(() => null);
  await ev(page, () => { VR.game.photoCam.shoot(); });
  await step(page, 1, 33, true);
  const d = await dl;
  let meta2 = null, name = null;
  if (d) { name = d.suggestedFilename(); await d.saveAs(SHOTS + 'first_photo_2x.png'); meta2 = await sharp(SHOTS + 'first_photo_2x.png').metadata(); }
  const p1 = await ev(page, () => { const g = VR.game; return { pos: g.player.pos.slice(), cw: g.canvas.width, ch: g.canvas.height, last: VR.PhotoMode.last ? { name: VR.PhotoMode.last.name, w: VR.PhotoMode.last.w, h: VR.PhotoMode.last.h, kb: Math.round(VR.PhotoMode.last.bytes / 1024) } : null }; });
  OUT.photo = { name, w: meta2 && meta2.width, h: meta2 && meta2.height, canvas: [p1.cw, p1.ch], last: p1.last };
  console.log('   photo: ' + JSON.stringify(OUT.photo));
  check(p0.on && p0.hud === 'none', `📷 the photo mode: the HUD away (${p0.hud})`);
  check(p0.pos.every((v, i) => Math.abs(v - p1.pos[i]) < 0.01), 'the player stays where it stood while the camera glides off');
  check(!!meta2 && meta2.width === p1.cw * 2 && meta2.height === p1.ch * 2, `the picture saved at 2× the screen (${meta2 ? meta2.width + ' × ' + meta2.height : 'no download'} for a ${p1.cw} × ${p1.ch} canvas)`);
  check(/^R9-SI-Meine-Welt-1\.png$/.test(name || ''), `named ${name}`);
  await ev(page, () => VR.game.photoMode(false));
  await step(page, 2, 33, false);
  const p2 = await ev(page, () => ({ tod: VR.game.env.timeOfDay, hud: getComputedStyle(document.getElementById('hud')).display, on: VR.game.photoCam.on }));
  check(!p2.on && p2.hud !== 'none' && Math.abs(p2.tod - p0.tod) < 30, `Esc: back to the player, the HUD and the time as they were (tod ${p0.tod.toFixed(0)} → ${p2.tod.toFixed(0)})`);
  await page.close(); await ctx.close();
}

// ================================================================ C · Very Low and High, both builds side by side
// (two pages in turns: the same pose, the same settle rule, the time taken alternately so the machine's load is shared)
async function settle(pages, maxMs, framesPer) {
  const t = Date.now(), last = new Map(), calm = new Map();
  for (const [tag] of pages) calm.set(tag, 0);
  while (Date.now() - t < maxMs) {
    for (const [tag, page] of pages) {
      if (calm.get(tag) >= 3) continue;
      await step(page, framesPer, 33, true);
      const s = await ev(page, () => { const g = VR.game, w = g.world, hz = g.horizon; let dirty = 0; for (const c of w.cols.values()) for (const s of c.sec) if (s.dirty || s.pending) dirty++; const fr = hz && hz.far && hz.far.on() ? hz.far.report() : null; return { busy: g.pool.busy, up: w.uploadQ ? w.uploadQ.size : 0, dirty, cols: w.cols.size, sec: g.renderer.stats.sections, tris: g.renderer.stats.tris, hzWant: hz ? hz.stats.want : 0, hzIn: hz ? hz.inflight : 0, farWant: fr ? fr.want + fr.inflight : 0 }; });
      // (run 2: 685 sections stay dirty in both builds — the ring of columns beyond the view distance is never meshed — so
      // 'settled' is no worker busy, no upload waiting, the far tiles in, and the columns and drawn sections the same
      // three looks running)
      const p = last.get(tag), same = p && p.cols === s.cols && p.sec === s.sec;
      const quiet = s.busy === 0 && s.up === 0 && s.hzWant === 0 && s.hzIn === 0 && s.farWant === 0;
      calm.set(tag, quiet && same ? calm.get(tag) + 1 : 0); last.set(tag, s);
    }
    if ([...calm.values()].every(n => n >= 3)) break;
    await new Promise(r => setTimeout(r, 300));
  }
  return { ms: Date.now() - t, calm: Object.fromEntries(calm), last: Object.fromEntries(last) };
}
const frameStats = (page, n) => ev(page, (n) => { const g = VR.game, gl = g.renderer.gl, px = new Uint8Array(4), ms = []; window.__norender = false; g.renderer.passLog = true; for (let i = 0; i < n; i++) { const t0 = performance.now(); g.last = performance.now() - 33; g.loop(performance.now()); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); ms.push(performance.now() - t0); } window.__norender = true; const r = g.renderer, st = r.stats; return { ms, draws: st.draws, tris: st.tris, sections: st.sections, fs: (st.fsPasses || 0) + ':' + (st.fsList || []).map(f => f.name).join(','), progs: Object.keys(r.P || {}).length }; }, n);
const median = (a) => { const b = a.slice().sort((p, q) => p - q); return b.length ? +b[b.length >> 1].toFixed(1) : -1; };
async function measure(pages, rounds, n) {
  const acc = {}, last = {};
  for (let r = 0; r < rounds; r++) for (const [tag, page] of (r & 1 ? pages.slice().reverse() : pages)) { const m = await frameStats(page, n); (acc[tag] = acc[tag] || []).push(...m.ms); last[tag] = m; }
  const out = {};
  for (const tag in acc) out[tag] = { ms: median(acc[tag]), best: +Math.min(...acc[tag]).toFixed(1), draws: last[tag].draws, tris: last[tag].tris, sections: last[tag].sections, fs: last[tag].fs, progs: last[tag].progs };
  return out;
}
if (ONLY.includes('C')) {
  console.log('C · Very Low and High, side by side — ' + secs());
  const pages = [];
  for (const [tag, url] of [['new', NEW], ['base', BASE]]) { if (!url) continue; const ctx = await context(tag + 'VL'); const page = await open(ctx, url, POTATO); pages.push([tag, page, ctx]); }
  const P2 = pages.map(([tag, page]) => [tag, page]);
  OUT.potato = {};
  for (const [tag, page] of P2) {
    const o = OUT.potato[tag] = {};
    if (await untilState(page, 'title', 240000)) {
      await wait(page, 3000);
      o.title = await ev(page, () => { const g = VR.game, s = g.titleScene; return { scene: !!s, mode: s && s.mode, drawn: s && s.drawn, world: !!g.world, busy: g.pool.busy, preset: g.settings.preset }; });
      o.titleHeap = await heap(page); o.titleGpu = await gpu(page);
      await shot(page, 'title_potato_' + tag);
    }
  }
  const tn = (OUT.potato.new || {}).title || {};
  check(tn.scene && tn.mode === 'still' && tn.drawn === 1 && !tn.world && tn.busy === 0, `Very Low's title: one still frame of the sky (${tn.drawn} drawn in 3 s), no world, no worker work (${tn.busy} jobs)`);
  // a play frame at a fixed pose: a world made by code (the old spawn in both builds), the plaza looking at the temple at noon
  for (const [, page] of P2) await ev(page, () => VR.game.createWorld({ name: 'Frame', mode: 'creative', difficulty: 'peaceful', type: 'default', seed: '4242', cheats: true, kit: true }));
  for (const [, page] of P2) { await untilState(page, 'play', 240000); await manual(page); await ev(page, () => { const g = VR.game, p = g.player; p.flying = true; p.noclip = true; p.teleport(0.5, 92, 70.5); p.yaw = 0; p.viewYaw = 0; p.pitch = 0.05; g.env.setTime(6000); g.zenFreezeTime = true; g.env.wx.force('klar'); if (g.wow) g.wow.wait = 1e9; }); }
  OUT.settleVL = await settle(P2, 300000, 10);
  console.log('   settled (Very Low): ' + JSON.stringify(OUT.settleVL));
  OUT.frameVL = await measure(P2, 10, 8);
  console.log('   Very Low play frame: ' + JSON.stringify(OUT.frameVL));
  for (const [tag, page] of P2) { await step(page, 2, 33, true); await shot(page, 'frame_potato_' + tag); }
  if (OUT.frameVL.base) {
    // (the people walking about the plaza add or take a draw or two between two pages — run 2: 58 against 56 draws with the
    // same 79 sections; the chunks, the passes and the programs are what the preset's cost is made of)
    const a = OUT.frameVL.new, b = OUT.frameVL.base;
    // (run 3: this page's far tiles were still streaming after 311 s on a machine at load 7 — 43 wanted, 6 in flight — the
    // base's had settled: 48 against 58 draws. The draws and triangles count only when both pages settled)
    const both = OUT.settleVL && OUT.settleVL.calm && OUT.settleVL.calm.new >= 3 && OUT.settleVL.calm.base >= 3;
    check(a.sections === b.sections && a.fs === b.fs && a.progs === b.progs && (!both || (Math.abs(a.tris - b.tris) <= b.tris * 0.01 && Math.abs(a.draws - b.draws) <= 4)), `Very Low's play frame unchanged${both ? '' : ' (the far land still streaming in a page: the chunks, passes and programs compared)'}: ${a.sections} sections, ${a.progs} programs, the full-screen passes ${a.fs === b.fs ? 'the same (' + a.fs + ')' : a.fs + ' against ' + b.fs}; ${a.draws} draws / ${a.tris} triangles against ${b.draws} / ${b.tris}`);
    console.log(`     its time (taken in turns, to a pixel read): ${a.ms} ms (best ${a.best}) against ${b.ms} ms (best ${b.best})`);
  }
  // High (view distance 8, the dynamic resolution off), the same pose
  for (const [, page] of P2) await ev(page, () => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.settings.renderDist = 8; g.applySettings('*'); });
  // (run 2: High's far ring wanted ~840 forms in each page and had not settled after 7 min on SwiftShader — the frame is
  // taken after 150 s; the chunks drawn, the passes and the programs are what is compared, the draws and triangles of the
  // still streaming far land are reported)
  OUT.settleHigh = await settle(P2, 150000, 3);
  console.log('   settled (High): ' + JSON.stringify(OUT.settleHigh));
  OUT.frameHigh = await measure(P2, 4, 4);
  console.log('   High play frame: ' + JSON.stringify(OUT.frameHigh));
  // (the pictures one page at a time: the base's page closed first, then this build's frame alone)
  const pb = pages.find(p => p[0] === 'base'), pn = pages.find(p => p[0] === 'new');
  if (pb) { await step(pb[1], 2, 33, true); await shot(pb[1], 'frame_high_base', 90000); await pb[1].close(); await pb[2].close(); pages.splice(pages.indexOf(pb), 1); }
  if (pn) { await step(pn[1], 2, 33, true); await shot(pn[1], 'frame_high_new', 90000); }
  if (OUT.frameHigh.base) {
    const a = OUT.frameHigh.new, b = OUT.frameHigh.base;
    check(a.sections === b.sections && a.fs === b.fs && a.progs === b.progs, `High's play frame unchanged: ${a.sections} sections against ${b.sections}, ${a.progs} programs, the full-screen passes ${a.fs === b.fs ? 'the same (' + a.fs.split(':')[0] + ')' : a.fs + ' against ' + b.fs}; (the far land still streaming: ${a.draws} draws / ${a.tris} triangles against ${b.draws} / ${b.tris})`);
    console.log(`     its time (taken in turns, to a pixel read): ${a.ms} ms (best ${a.best}) against ${b.ms} ms (best ${b.best})`);
  }
  for (const [, page, ctx] of pages) { await page.close(); await ctx.close(); }
}

// ================================================================ D · the arrival of four seeds (f-arrival, R50-02, R50-06)
// docs/superpowers/plans/2026-10-23-f-arrival.md. ▶ Losspielen on each build (Balanced, a browser context of its own per
// world) for seeds 53, 4242, 31337 and 7 (DSEEDS): the frame the veil opens on, once the white has gone (the moment's
// hold at its real time: first_d<seed>_<build>.png) and again after ~20 s with the moment held (the far land in:
// first_d<seed>_<build>_held.png); the camera each page drew is measured in node with rays through the generated chunks
// (test/arrival.js part 6): the landmark's share of the frame, the part of it hidden, anything within 6 m in the upper
// half — this build: ≥ 8 %, ≤ 10 %, nothing. Then, in the first seed's world on each build: /dim drift and 🏠 Heimkehr
// — the frame the veil opens on at home, a vista start's home being its walk (first_dhome<seed>_<build>.png), and the
// nearest geometry in that frame's middle third (the test's own rays at the player's camera)
const DSEEDS = (process.env.DSEEDS || '53,4242,31337,7').split(',');
// the nearest geometry in the middle third (a third across, a third up) of the player's frame: 9 × 5 rays through the
// loaded blocks (no plants, no fluids; the ground under the feet not counted) and the ships near by as boxes
const midThird = (page) => ev(page, () => {
  const g = VR.game, w = g.world, p = g.player, R = VR.R, F = VR.F, fov = ((g.settings && g.settings.fov) || 75) * Math.PI / 180, th = Math.tan(fov / 2), A = g.canvas.width / g.canvas.height;
  const eye = [p.pos[0], p.pos[1] + (p.eye || 1.62), p.pos[2]], feet = Math.floor(p.pos[1] + 0.01), yaw = p.yaw, pitch = p.pitch || 0;
  const f = [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)], r = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  const boxes = []; for (const s of (g.starships && g.starships.ships) || []) { if (!s || !s.pos || Math.hypot(s.pos[0] - eye[0], s.pos[2] - eye[2]) > 60) continue; const m = s.d && s.d.meta, hw = m && m.bounds ? Math.max(m.bounds[3] - m.bounds[0], m.bounds[5] - m.bounds[2]) / 2 : 10, h = m && m.height ? m.height : 8; boxes.push([s.pos[0] - hw, s.pos[1], s.pos[2] - hw, s.pos[0] + hw, s.pos[1] + h, s.pos[2] + hw]); }
  let near = 60, what = 'nothing within 60 m';
  for (let j = 0; j < 5; j++) for (let i = 0; i < 9; i++) {
    const a = (-1 / 3 + i / 8 * (2 / 3)) * th * A, b = (-1 / 3 + j / 4 * (2 / 3)) * th, d = [0, 1, 2].map(k => f[k] + r[k] * a + u[k] * b), l = Math.hypot(d[0], d[1], d[2]); for (let k = 0; k < 3; k++) d[k] /= l;
    for (const bx of boxes) { let t0 = -Infinity, t1 = Infinity; for (let k = 0; k < 3; k++) { const iv = 1 / (d[k] || 1e-12), q0 = (bx[k] - eye[k]) * iv, q1 = (bx[k + 3] - eye[k]) * iv; t0 = Math.max(t0, Math.min(q0, q1)); t1 = Math.min(t1, Math.max(q0, q1)); } if (t1 >= t0 && t1 > 0 && Math.max(0, t0) < near) { near = Math.max(0, t0); what = 'a ship'; } }
    for (let t = 0.05; t < near; t += 0.05) {
      const x = Math.floor(eye[0] + d[0] * t), y = Math.floor(eye[1] + d[1] * t), z = Math.floor(eye[2] + d[2] * t);
      if (y < feet) { if (d[1] < 0) break; continue; }
      const s = w.getBlock(x, y, z); if (!s) continue; const fl = R.T.flags[s];
      if ((fl & F.PLANT) || (fl & F.FLUID) || !((fl & (F.OPAQUE | F.LEAVES)) || (fl & F.SOLID))) continue;
      near = t; what = R.types[R.T.type[s]].name + ' (' + (x - Math.floor(eye[0])) + ', ' + (y - feet) + ', ' + (z - Math.floor(eye[2])) + ')'; break;
    }
  }
  return { near: +near.toFixed(1), what, yaw: +yaw.toFixed(3), pitch: +pitch.toFixed(3), fovDeg: Math.round(fov * 180 / Math.PI) };
});
async function arrivalRun(build, url, seed, home) {
  const tag = build + seed, ctx = await context(tag), page = await open(ctx, url, BAL), r = { build, seed };
  try {
    if (!(await untilState(page, 'title', 240000))) { r.err = 'no start screen'; return r; }
    await wait(page, 1500);
    const t0 = Date.now();
    await ev(page, (SEED) => { const g = VR.game, cw = g.createWorld.bind(g); g.createWorld = (o) => cw(Object.assign({}, o, o.seed ? {} : { seed: SEED })); VR.Start.newWorld(); }, seed);
    // the loading screen in real time, until its bar is nearly full or the white begins to rise; then by hand
    let low = false;
    for (let i = 0; i < 720; i++) {
      await wait(page, 250);
      const s = await ev(page, () => { const g = VR.game, b = document.getElementById('loadbar'); return { st: g.state, w: b ? parseFloat(b.style.width) || 0 : 0, ar: g.arrival ? g.arrival.phase : null }; });
      if (s.st === 'loading' && s.w < 50) low = true;
      if (s.st === 'play' || s.ar || (low && s.w > 90)) break;
    }
    await manual(page);
    for (let i = 0; i < 3000; i++) {
      const s = await ev(page, () => ({ st: VR.game.state, ph: VR.game.arrival ? VR.game.arrival.phase : null }));
      if (s.st === 'play') break;
      if (s.ph === 'in') { await step(page, 1, 33, false); continue; }
      await step(page, 5, 33, false); await wait(page, 60);
    }
    r.loadMs = Date.now() - t0;
    const cam = () => ev(page, () => { const g = VR.game, W = g.wow, m = g.meta, A = W && W.active, b = W && W.b; return { vgen: m.vgen | 0, vista: m.vistaId || null, vs: m.vistaStart, id: A ? A.id : null, lm: A ? A.lm || null : null, phase: g.arrival ? g.arrival.phase : null, curve: A ? +VR.WowMoment.curve(W.t).toFixed(3) : null, cam: b ? { eye: [b.x, b.y, b.z], yaw: b.yaw, pitch: b.pitch, fov: b.fov * 180 / Math.PI } : null, tod: Math.round(g.env.timeOfDay), seed: m.seed }; });
    r.at = await cam();
    // the white thins over the composition (t-first: 84 frames to the moment's hold, the caption up)
    await step(page, 84, 33, true);
    r.moment = await cam();
    r.shot = await shot(page, 'd' + seed + '_' + build);
    // the moment held while the far land comes in (~20 s of the machine's time, a frame drawn every 10)
    const hold = () => ev(page, () => { const W = VR.game.wow; if (W && W.active) W.t = VR.WowMoment.RISE + 0.1; });
    for (let k = 0; k < 6; k++) { await hold(); await step(page, 10, 33, true); await wait(page, 1500); }
    await hold(); await step(page, 2, 33, true);
    r.held = await cam();
    r.shotHeld = await shot(page, 'd' + seed + '_' + build + '_held');
    console.log(`   ${build} seed ${seed}: loaded in ${r.loadMs} ms, vgen ${r.at.vgen}, ${r.at.vista} (${r.at.lm}) — the arrival's camera ${r.held.cam ? 'fov ' + r.held.cam.fov.toFixed(1) + '°, yaw ' + r.held.cam.yaw.toFixed(2) + ', pitch ' + r.held.cam.pitch.toFixed(3) : '—'} (curve ${r.moment.curve} → ${r.held.curve}) (${secs()})`);
    if (home) {
      // the moment runs out (the HUD back), then the drift and 🏠 Heimkehr
      await step(page, 160, 33, false); await wait(page, 1600);
      const tripTo = async (to, start) => {
        await ev(page, (st) => { window.__lt = VR.Travel.last; const g = VR.game; if (st === 'home') { if (g.ui && g.ui.resume) g.ui.resume(); g.goHome(); } else VR.Travel.go(g, { dim: st, via: 'cmd' }); }, start);
        for (let i = 0; i < 900; i++) { await step(page, 10, 33, false); const s = await ev(page, (to) => { const g = VR.game, L = VR.Travel.last; return { st: g.state, arrived: !!(L && L !== window.__lt && L.to === to) }; }, to); if (s.arrived && s.st === 'play') return true; await wait(page, 60); }
        return false;
      };
      r.toDrift = await tripTo('drift', 'drift');
      await step(page, 40, 33, false); await wait(page, 3000);
      r.homeOk = await tripTo('overworld', 'home');
      r.home = await ev(page, () => { const g = VR.game, p = g.player, L = VR.Travel.last; return { last: L, dim: g.dim, pos: p.pos.map(v => +v.toFixed(1)), spawn: p.spawn ? p.spawn.map(v => +v.toFixed(1)) : null }; });
      await step(page, 24, 33, true);   // (the veil's 0.65 s)
      r.homeMid = await midThird(page);
      r.shotHome = await shot(page, 'dhome' + seed + '_' + build);
      console.log(`   ${build} Heimkehr: ${JSON.stringify(r.home.last)} · the frame's middle third: ${JSON.stringify(r.homeMid)}`);
    }
  } catch (e) { r.err = String(e.message || e).split('\n')[0]; console.log('   (' + tag + ': ' + r.err + ')'); }
  await page.close(); await ctx.close();
  return r;
}
if (ONLY.includes('D')) {
  console.log('D · the arrival of seeds ' + DSEEDS.join(', ') + ' — ' + secs());
  const runs = [];
  for (const [i, seed] of DSEEDS.entries()) for (const [build, url] of [['base', BASE], ['new', NEW]]) { if (url) runs.push(await arrivalRun(build, url, seed, i === 0)); }
  // the cameras measured in node (test/arrival.js part 6: the same rays as its part 3, through the generated chunks)
  const cams = [];
  for (const q of runs) { const c = q.held && q.held.cam ? q.held : q.moment; if (c && c.cam) cams.push({ tag: q.build + q.seed, build: q.build, seed: +q.seed, vgen: c.vgen || 12, id: c.id || c.vista, lm: c.lm, cam: c.cam }); }
  const CF = SHOTS + 'first_d_cams.json'; fs.writeFileSync(CF, JSON.stringify(cams, null, 1));
  let truths = [];
  try {
    const log = execFileSync('node', [ROOT + 'test/arrival.js'], { env: Object.assign({}, process.env, { ONLY: '6', CAMS: CF }), maxBuffer: 1 << 24, timeout: 1800000 }).toString();
    console.log(log.split('\n').filter(l => /^\s+(base|new)\d/.test(l)).join('\n'));
    truths = JSON.parse(fs.readFileSync(CF.replace(/\.json$/, '') + '.truth.json', 'utf8'));
  } catch (e) { console.log('   (no truth: ' + String(e.message).split('\n')[0] + ')'); }
  const T = (b, s) => (truths.find(t => t.build === b && t.seed === +s) || {}).truth || null;
  const pc = (v) => (v * 100).toFixed(1) + ' %';
  OUT.arrivals = runs.map(q => Object.assign({}, q, { truth: T(q.build, q.seed) }));
  for (const seed of DSEEDS) {
    const a = runs.find(q => q.build === 'new' && q.seed === seed), b = runs.find(q => q.build === 'base' && q.seed === seed), ta = T('new', seed), tb = T('base', seed);
    check(!!a && !a.err && a.at.vs === 2 && !!a.at.vista && a.at.vgen === 13 && a.moment.curve === 1, `seed ${seed}: the new world (vgen ${a && a.at ? a.at.vgen : '?'}) opened on its vista ${a && a.at ? a.at.vista + ' (' + a.at.lm + ')' : '—'}, the moment from its first frame (curve ${a && a.moment ? a.moment.curve : '?'})`);
    check(!!ta && ta.share >= 0.08 && ta.hidden <= 0.10 && ta.near === 0, `seed ${seed}: the arrival's frame shows its landmark — ${ta ? pc(ta.share) : '—'} of the frame (≥ 8 %), ${ta ? pc(ta.hidden) : '—'} hidden (≤ 10 %), within 6 m in the upper half ${ta ? pc(ta.near) : '—'}; before: ${tb ? pc(tb.share) + ', ' + pc(tb.hidden) + ' hidden (' + tb.by + '), near ' + pc(tb.near) : '—'}`);
  }
  const h = runs.find(q => q.build === 'new' && q.home), hb = runs.find(q => q.build === 'base' && q.home);
  if (h) {
    const f = h.home && h.home.last && h.home.last.face;
    check(h.homeOk && h.home.dim === 'overworld' && !!f, `🏠 Heimkehr from the drift (${h.home && h.home.last ? h.home.last.totalMs + ' ms' : '?'}): home, the view chosen (${f ? JSON.stringify(f) : '—'})`);
    check(!!f && f.kept && h.homeMid && Math.abs(h.homeMid.yaw - f.yaw) < 0.01, `a vista start's home faces its walk's view, the landmark ahead (yaw ${f ? f.yaw : '?'}; the middle third's nearest: ${h.homeMid ? h.homeMid.near + ' m, ' + h.homeMid.what : '—'}; before: ${hb && hb.homeMid ? hb.homeMid.near + ' m, ' + hb.homeMid.what + ', yaw ' + hb.homeMid.yaw : '—'})`);
  }
  // the sheet: before | after for every seed (the held frame; the first second's beside it), Heimkehr's frame
  try {
    const P = (n) => { const f = SHOTS + 'first_' + n + '.png'; return fs.existsSync(f) ? f : null; };
    const lab = (b, s, held) => { const q = runs.find(x => x.build === b && x.seed === s), t = T(b, s), c = q && (held ? q.held : q.moment); return (b === 'base' ? 'vorher (v0.49) ' : 'nachher ') + (c ? (c.vista || '') + ' ' + (c.lm || '') + (c.cam ? ' ' + c.cam.fov.toFixed(0) + ' Grad' : '') : '') + (t ? ' | Wahrzeichen ' + pc(t.share) + ', verdeckt ' + pc(t.hidden) + (t.near ? ', nah ' + pc(t.near) : '') : '') + (held ? '' : ' | erste Sekunde'); };
    const rows = [];
    for (const s of DSEEDS) {
      rows.push({ label: 'Seed ' + s, labels: [lab('base', s, true), lab('new', s, true)], imgs: [P('d' + s + '_base_held'), P('d' + s + '_new_held')] });
      rows.push({ label: 'Seed ' + s, labels: [lab('base', s, false), lab('new', s, false)], imgs: [P('d' + s + '_base'), P('d' + s + '_new')] });
    }
    if (h) rows.push({ label: 'Heimkehr', labels: ['vorher: Heimkehr (Seed ' + DSEEDS[0] + ') ' + (hb && hb.homeMid ? hb.homeMid.near + ' m' : ''), 'nachher: Heimkehr ' + (h.homeMid ? h.homeMid.near + ' m' : '')], imgs: [P('dhome' + DSEEDS[0] + '_base'), P('dhome' + DSEEDS[0] + '_new')] });
    fs.writeFileSync(SHOTS + 'first_arrival_sheet.json', JSON.stringify({ cols: ['vorher', 'nachher'], w: 560, rows: rows.filter(r => r.imgs.some(Boolean)) }));
    console.log('   sheet ' + execFileSync('python3', ['/root/r9coord/sheet.py', SHOTS + 'first_arrival_sheet.jpg', SHOTS + 'first_arrival_sheet.json']).toString().trim());
  } catch (e) { console.log('   (no arrival sheet: ' + e.message + ')'); }
}

// ================================================================ the sheet (python3 /root/r9coord/sheet.py)
try {
  const P = (n) => { const f = SHOTS + 'first_' + n + '.png'; return fs.existsSync(f) ? f : null; };
  const TF = (n) => { const f = ROOT + 'docs/trailer/frames/' + n + '.jpg'; return fs.existsSync(f) ? f : null; };
  const rows = [
    { label: 'Startbildschirm', labels: ['Trailer t1_01 (die Eröffnung)', 'vorher (v0.48, Ausgewogen)', 'nachher: der lebende Titel'], imgs: [TF('t1_01'), P('title_base'), P('title')] },
    { label: 'Titel', labels: ['1920 × 1080', 'nachher auf Hoch', 'erster Moment: Kacheln + Verlauf'], imgs: [P('title_1920'), P('title_high'), P('title_css')] },
    { label: 'Drift', labels: ['Schleife bei 0 s', 'Schleife bei 30 s', 'Lauf 2: Zitadelle hinter den Kacheln'], imgs: [P('title_t0'), P('title_t30'), fs.existsSync(SHOTS + 'first_run2_title.png') ? SHOTS + 'first_run2_title.png' : null] },
    { label: 'Laden', labels: ['vorher: Laden', 'nachher: Laden über dem Himmel', 'das Weiß steigt'], imgs: [P('loading_base'), P('loading'), P('arrival_in')] },
    { label: 'Ankunft', labels: ['Ankunft: weiß + Sonnenglanz', 'halb', 'Ende des Schleiers'], imgs: [P('arrival_0'), P('arrival_1'), P('arrival_2')] },
    { label: 'Moment', labels: ['der Wow-Moment hält', 'zurück in die Augen', 'im Bild stehen'], imgs: [P('moment'), P('fall'), P('stand')] },
    { label: 'vorher / Foto', labels: ['vorher: erstes Bild', '📷 Fotomodus', 'Foto 2×'], imgs: [P('spawn_base'), P('photo_view'), P('photo_2x')] },
    { label: 'Sehr niedrig', labels: ['vorher: Titel', 'nachher: ein Standbild', 'Spielbild (gleich)'], imgs: [P('title_potato_base'), P('title_potato_new'), P('frame_potato_new')] },
    { label: 'Hoch', labels: ['vorher: Spielbild', 'nachher: Spielbild', ''], imgs: [P('frame_high_base'), P('frame_high_new'), null] },
  ].filter(r => r.imgs.some(Boolean));
  fs.writeFileSync(SHOTS + 'first_sheet.json', JSON.stringify({ cols: [], w: 560, rows }));
  const out = execFileSync('python3', ['/root/r9coord/sheet.py', SHOTS + 'first_sheet.jpg', SHOTS + 'first_sheet.json']).toString().trim();
  console.log('   sheet ' + out);
} catch (e) { console.log('   (no sheet: ' + e.message + ')'); }
fs.writeFileSync(SHOTS + 'first.json', JSON.stringify(OUT, null, 1));
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 20)) console.log(l);
check(!logs.some(l => /pageerror/.test(l)), 'no page errors');
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
