// Die erste Minute (t-first; plan docs/superpowers/plans/2026-10-16-t-first.md) in the browser — the base build (v0.48,
// before) beside this one (after), 1280 × 720, de-DE, each build in a browser context of its own (its own storage):
//   A · the base build on Balanced: its title (the vgen-5 panorama) — picture and cost —, ▶ Losspielen: its loading
//       screen and its first frame (the Hangar Hall's pad)
//   B · this build on Balanced: the start screen's first paint (ms from the boot; the tiles over the CSS backdrop before
//       the textures are in), the living title (the citadel at the golden hour, no chunks) — picture, cost, the 30 fps
//       cap —, ▶ Losspielen: the loading screen with its phases over the sky, the arrival (the white veil at its start
//       and half-way with the sun's flare), the wow moment's hold, the standing picture after it (the HUD back), the
//       title released, the 📷 photo mode on screen and its picture saved at 2×
//   C · this build on Very Low: the title one still frame of the sky (no world, no workers); a world's play frame at a
//       fixed pose against D · the base build on Very Low (the same draws and triangles: Very Low unchanged)
// → test/shots/first_<name>.png, test/shots/first_sheet.jpg, test/shots/first.json (the numbers)
//   bash test/wt_run.sh first.mjs 2400        (BASE=…/dist/index.html the build before — default .tmp_tests/base/dist;
//   without it the before parts are skipped · ONLY=A,B,C,D the parts)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import sharp from '/home/dev/.npm-global/lib/node_modules/sharp/lib/index.js';
import fs from 'fs';
const ROOT = '/home/dev/vr/';
const NEW = 'file://' + ROOT + 'dist/index.html';
const BASEF = process.env.BASE || ROOT + '.tmp_tests/base/dist/index.html';
const BASE = fs.existsSync(BASEF) ? 'file://' + BASEF : null;
const SHOTS = ROOT + 'test/shots/';
const ONLY = (process.env.ONLY || 'A,B,C,D').split(',');
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const OUT = { when: new Date().toISOString() };
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--js-flags=--expose-gc', '--enable-precise-memory-info'] });
const logs = [];
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
  if (settings) await page.addInitScript((s) => { try { localStorage.setItem('r9si.settings', JSON.stringify(s)); } catch (e) { /* */ } }, settings);
  await page.goto(url);
  return page;
}
const ev = (page, fn, arg) => page.evaluate(fn, arg);
const wait = (page, ms) => page.waitForTimeout(ms);
const untilState = async (page, st, ms) => { const t = Date.now(); while (Date.now() - t < ms) { const s = await ev(page, () => VR.game && VR.game.state); if (s === st) return true; await wait(page, 400); } return false; };
const shot = async (page, name) => { await page.screenshot({ path: SHOTS + 'first_' + name + '.png', timeout: 180000 }); console.log('   shot first_' + name + ' (' + secs() + ')'); return SHOTS + 'first_' + name + '.png'; };
// the loop by hand (rAF stubbed): n frames of dt ms, drawing only when asked (the renderer's draw skipped otherwise)
const manual = (page) => ev(page, () => { const g = VR.game; window.requestAnimationFrame = () => 0; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; });
const step = async (page, n, dt, drawLast) => { for (let k = 0; k < n; k += 15) { const m = Math.min(15, n - k), last = drawLast && k + m >= n; await ev(page, ([m, d, last]) => { const g = VR.game; for (let i = 0; i < m; i++) { window.__norender = !(last && i === m - 1); g.last = performance.now() - d; g.loop(performance.now()); } window.__norender = true; if (last) g.renderer.gl.finish(); }, [m, dt || 33, last]); } };
const heap = (page) => ev(page, () => { try { if (window.gc) { window.gc(); window.gc(); } } catch (e) { /* */ } return performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : -1; });
const gpu = (page) => ev(page, () => { const g = VR.game, r = g.renderer, hz = g.horizon; return { arenas: r.arenas.length, arenaMB: +r.gpuMemoryMB().toFixed(1), hzMB: hz ? +hz.stats.mb.toFixed(1) : 0, hzTiles: hz ? hz.stats.tiles : 0, cols: g.world ? g.world.cols.size : 0, busy: g.pool ? g.pool.busy : 0, draws: r.stats.draws, tris: r.stats.tris }; });
// the title's own frame (the scene's draw, or the old titleFrame), timed with gl.finish
const titleMs = (page) => ev(page, () => { const g = VR.game, gl = g.renderer.gl, out = []; for (let i = 0; i < 6; i++) { const t0 = performance.now(); if (g.titleScene) g.titleScene.draw(i * 0.5); else { g.last = performance.now() - 16; g.titleFrame(1 / 60); } gl.finish(); out.push(performance.now() - t0); } out.sort((a, b) => a - b); return +out[3].toFixed(1); });

// ================================================================ A · the base build, Balanced
if (BASE && ONLY.includes('A')) {
  console.log('A · the base build (v0.48) on Balanced — ' + secs());
  const ctx = await context('base'), page = await open(ctx, BASE);
  check(await untilState(page, 'title', 240000), 'the base build reaches its start screen');
  await wait(page, 12000);   // (its panorama streams the title world's chunks)
  const h = await heap(page), gp = await gpu(page), ms = await titleMs(page);
  OUT.titleBase = { heapMB: h, ...gp, ms };
  console.log('   base title: ' + JSON.stringify(OUT.titleBase));
  await shot(page, 'title_base');
  const t0 = Date.now();
  await ev(page, () => VR.Start.newWorld());
  let seenLoad = false;
  for (let i = 0; i < 400; i++) { await wait(page, 300); const s = await ev(page, () => ({ st: VR.game.state, w: (document.getElementById('loadbar') || {}).style ? document.getElementById('loadbar').style.width : '' })); if (!seenLoad && s.st === 'loading' && parseFloat(s.w) > 35) { seenLoad = true; await shot(page, 'loading_base'); } if (s.st === 'play') break; }
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
  const ctx = await context('new'), page = await open(ctx, NEW);
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
  const st = await ev(page, () => { const s = VR.game.titleScene; return s ? Object.assign(s.cost(), { ready: s.ready, readyMs: VR.game.titleReadyMs, live: document.getElementById('title').classList.contains('live') }) : null; });
  // the 30 fps cap: draws over 3 s of the game's own loop
  const d0 = await ev(page, () => VR.game.titleScene.drawn); await wait(page, 3000); const d1 = await ev(page, () => VR.game.titleScene.drawn);
  const h = await heap(page), gp = await gpu(page), ms = await titleMs(page);
  OUT.title = Object.assign({ heapMB: h, ms, fps: +((d1 - d0) / 3).toFixed(1) }, gp, st);
  console.log('   title: ' + JSON.stringify(OUT.title));
  await shot(page, 'title');
  check(st && st.mode === 'drift' && st.cols === 0 && gp.arenas === 0, `no chunks behind the title (${st ? st.cols : '?'} columns, ${gp.arenas} vertex arenas) — the far tiles only (${gp.hzTiles} tiles, ${gp.hzMB} MB)`);
  check(st && st.reveal >= 1 && gp.hzTiles > 0, `the land came out of the haze (reveal ${st ? st.reveal : '?'}; ready ${st && st.readyMs ? st.readyMs.toFixed(0) : '?'} ms after the boot)`);
  check((d1 - d0) / 3 <= 31.5, `the drift draws at 30 fps at most (${((d1 - d0) / 3).toFixed(1)} a second)`);
  if (OUT.titleBase) check(h <= OUT.titleBase.heapMB + 2, `the title's heap ${h} MB against the old panorama's ${OUT.titleBase.heapMB} MB; GPU: ${gp.arenas} arenas (old ${OUT.titleBase.arenas}), horizon ${gp.hzMB} MB (old ${OUT.titleBase.hzMB})`);
  // ▶ Losspielen: the loading screen over the sky, its phases
  const t0 = Date.now();
  await ev(page, () => { window.__phases = []; VR.Start.newWorld(); });
  let loadPic = false, sky = false; const phases = new Set(); let counts = '';
  for (let i = 0; i < 500; i++) {
    await wait(page, 250);
    const s = await ev(page, () => { const g = VR.game, L = document.getElementById('loading'); return { st: g.state, msg: (document.getElementById('loadmsg') || {}).textContent, det: (document.getElementById('loaddetail') || {}).textContent, sky: !!(L && L.classList.contains('sky')), w: parseFloat(document.getElementById('loadbar').style.width) || 0 }; });
    if (s.st === 'loading') { if (s.msg) phases.add(s.msg); if (s.det) counts = s.det; if (s.sky) sky = true; if (!loadPic && s.w > 45) { loadPic = true; await shot(page, 'loading'); } }
    if (s.st === 'loading' && s.w > 80) break;
    if (s.st === 'play') break;
  }
  // the rest of the loading by hand, then the arrival frame by frame
  await manual(page);
  for (let i = 0; i < 600; i++) { const st2 = await ev(page, () => VR.game.state); if (st2 === 'play') break; await step(page, 10, 33, false); const m = await ev(page, () => (document.getElementById('loadmsg') || {}).textContent); if (m) phases.add(m); await wait(page, 120); }
  OUT.loadMs = Date.now() - t0;
  OUT.loading = { phases: [...phases], counts, sky };
  console.log('   loading: ' + JSON.stringify(OUT.loading) + ' in ' + OUT.loadMs + ' ms');
  check(phases.size >= 2 && [...phases].some(p => /Hügel|Stadt|Licht|Ferne/.test(p)), `the loading screen names its phases (${[...phases].join(' · ')})`);
  check(/Erzeugt \d+\/\d+ · Gebaut \d+\/\d+ · Hochgeladen \d+\/\d+/.test(counts), `the counts under the bar („${counts}")`);
  check(sky, 'the sky shows through the loading screen (.sky)');
  const w0 = await ev(page, () => { const g = VR.game, A = g.arrival, m = g.meta, p = g.player; return { arrival: !!A, phase: A && A.phase, sun: A && A.sun, veil: A ? +A.veilNow().toFixed(2) : null, vista: m.vistaId, vs: m.vistaStart, tod: Math.round(g.env.timeOfDay), wx: g.env.wx.kind, clear: g.env.wx.clearUntil, pos: p.pos.map(v => +v.toFixed(2)), yaw: +p.yaw.toFixed(3), hud: document.getElementById('hud').style.opacity }; });
  OUT.arrive = w0;
  console.log('   at play: ' + JSON.stringify(w0));
  check(w0.vs === 2 && !!w0.vista, `the new world opened on its vista (${w0.vista})`);
  check(Math.abs(w0.tod - 10800) < 400 || Math.abs(w0.tod - 1200) < 400, `at the golden hour (tod ${w0.tod})`);
  check(w0.wx === 'klar' && w0.clear === 24000, `clear for the first day (${w0.wx}, clear until ${w0.clear})`);
  check(w0.arrival && w0.phase === 'veil' && w0.veil > 0.9 && w0.hud === '0', `the arrival begins: the white veil (${w0.veil}), the HUD away`);
  await step(page, 1, 33, true); await shot(page, 'arrival_0');
  await step(page, 29, 33, true);
  const w1 = await ev(page, () => { const A = VR.game.arrival; return A ? { veil: +A.veilNow().toFixed(2), glow: A.glow ? +A.glow.style.opacity : null, phase: A.phase } : null; });
  await shot(page, 'arrival_1');
  check(w1 && w1.veil > 0.25 && w1.veil < 0.75 && (!w0.sun || w1.glow > 0.3), `half-way the picture comes through the white (veil ${w1 && w1.veil}), the sun's flare ${w0.sun ? 'at (' + w0.sun.map(v => v.toFixed(2)).join(', ') + ') ' + (w1 && w1.glow) : '(the sun out of the picture)'}`);
  await step(page, 30, 33, false);
  const w2 = await ev(page, () => { const g = VR.game, W = g.wow; return { active: !!(W && W.active), id: W && W.active ? W.active.id : null, t: W ? +W.t.toFixed(2) : null, arrival: g.arrival ? g.arrival.phase : null }; });
  check(w2.active && w2.id === w0.vista, `after the veil the wow moment plays (${w2.id}, the arrival in its '${w2.arrival}' phase)`);
  await step(page, Math.round((1.9 - (w2.t || 0)) / 0.033), 33, true);
  await shot(page, 'moment');
  await step(page, 120, 33, false);
  await wait(page, 1600);   // (the HUD's fade is a CSS transition: real time)
  await step(page, 2, 33, true);
  const w3 = await ev(page, () => { const g = VR.game; return { arrival: !!g.arrival, wow: !!(g.wow && g.wow.active), hud: getComputedStyle(document.getElementById('hud')).opacity, vis: getComputedStyle(document.getElementById('hud')).visibility, seen: (g.meta.wowSeen || []).slice() }; });
  await shot(page, 'stand');
  check(!w3.arrival && !w3.wow && +w3.hud >= 0.99 && w3.vis === 'visible' && w3.seen.includes(w0.vista), `then the player stands in the picture, the HUD back (opacity ${w3.hud}), the vista seen`);
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

// ================================================================ C / D · Very Low: the still title, a play frame (this build and the base)
async function veryLow(url, tag) {
  const ctx = await context(tag), page = await open(ctx, url, POTATO);
  const out = {};
  if (await untilState(page, 'title', 240000)) {
    await wait(page, 3000);
    out.title = await ev(page, () => { const g = VR.game, s = g.titleScene; return { scene: !!s, mode: s && s.mode, drawn: s && s.drawn, world: !!g.world, busy: g.pool.busy, preset: g.settings.preset }; });
    out.titleHeap = await heap(page);
    out.titleGpu = await gpu(page);
    await shot(page, 'title_potato_' + tag);
  }
  // a play frame at a fixed pose: a world made by code (the old spawn), the plaza looking at the temple at noon
  await ev(page, () => VR.game.createWorld({ name: 'Frame', mode: 'creative', difficulty: 'peaceful', type: 'default', seed: '4242', cheats: true, kit: true }));
  await untilState(page, 'play', 240000);
  await manual(page);
  await ev(page, () => { const g = VR.game, p = g.player; p.flying = true; p.noclip = true; p.teleport(0.5, 92, 70.5); p.yaw = 0; p.viewYaw = 0; p.pitch = 0.05; g.env.setTime(6000); g.zenFreezeTime = true; g.env.wx.force('klar'); if (g.wow) g.wow.wait = 1e9; });
  for (let i = 0; i < 40; i++) { await step(page, 10, 33, false); const s = await ev(page, () => { const g = VR.game, w = g.world; let dirty = 0; for (const c of w.cols.values()) for (const s of c.sec) if (s.dirty || s.pending) dirty++; return { busy: g.pool.busy, up: w.uploadQ ? w.uploadQ.size : 0, dirty }; }); if (s.busy === 0 && s.up === 0 && s.dirty === 0 && i > 3) break; await wait(page, 400); }
  await step(page, 3, 33, true);
  out.frame = await ev(page, () => { const g = VR.game, gl = g.renderer.gl, ms = []; window.__norender = false; for (let i = 0; i < 12; i++) { const t0 = performance.now(); g.last = performance.now() - 33; g.loop(performance.now()); gl.finish(); ms.push(performance.now() - t0); } window.__norender = true; ms.sort((a, b) => a - b); const st = g.renderer.stats; return { ms: +ms[6].toFixed(1), best: +ms[0].toFixed(1), draws: st.draws, tris: st.tris, sections: st.sections }; });
  await shot(page, 'frame_potato_' + tag);
  await page.close(); await ctx.close();
  return out;
}
if (ONLY.includes('C')) {
  console.log('C · this build on Very Low — ' + secs());
  OUT.potato = await veryLow(NEW, 'new');
  console.log('   ' + JSON.stringify(OUT.potato));
  const t = OUT.potato.title || {};
  check(t.scene && t.mode === 'still' && t.drawn === 1 && !t.world && t.busy === 0, `Very Low's title: one still frame of the sky (${t.drawn} drawn in 3 s), no world, no worker work (${t.busy} jobs)`);
}
if (BASE && ONLY.includes('D')) {
  console.log('D · the base build on Very Low — ' + secs());
  OUT.potatoBase = await veryLow(BASE, 'base');
  console.log('   ' + JSON.stringify(OUT.potatoBase));
  if (OUT.potato && OUT.potato.frame && OUT.potatoBase.frame) {
    const a = OUT.potato.frame, b = OUT.potatoBase.frame;
    check(a.draws === b.draws && Math.abs(a.tris - b.tris) <= b.tris * 0.02, `Very Low's play frame unchanged: ${a.draws} draws / ${a.tris} triangles against ${b.draws} / ${b.tris}`);
    console.log(`     its time: ${a.ms} ms (best ${a.best}) against ${b.ms} ms (best ${b.best}) — the machine's load in it`);
  }
}

// ================================================================ the sheet
try {
  const pics = [['title_base', 'vorher: Startbildschirm'], ['title', 'nachher: der lebende Titel'], ['loading_base', 'vorher: Laden'], ['loading', 'nachher: Laden über dem Himmel'], ['spawn_base', 'vorher: erstes Bild'], ['arrival_0', 'nachher: Ankunft (weiß)'], ['arrival_1', 'Ankunft halb, Sonnenglanz'], ['moment', 'der Wow-Moment'], ['stand', 'im Bild stehen'], ['photo_view', '📷 Fotomodus'], ['title_potato_new', 'Sehr niedrig: ein Standbild'], ['title_css', 'erster Moment: Kacheln + Verlauf']].filter(([n]) => fs.existsSync(SHOTS + 'first_' + n + '.png'));
  const CW = 480, CH = 270, LH = 22, COLS = 2, rows = Math.ceil(pics.length / COLS);
  const comps = [];
  for (let i = 0; i < pics.length; i++) {
    const [n, lab] = pics[i], x = (i % COLS) * CW, y = Math.floor(i / COLS) * (CH + LH);
    comps.push({ input: await sharp(SHOTS + 'first_' + n + '.png').resize(CW, CH).toBuffer(), left: x, top: y + LH });
    const svg = `<svg width="${CW}" height="${LH}"><rect width="100%" height="100%" fill="#0b1020"/><text x="8" y="16" font-family="sans-serif" font-size="13" fill="#e8f0ff">${lab.replace(/&/g, '&amp;')}</text></svg>`;
    comps.push({ input: Buffer.from(svg), left: x, top: y });
  }
  await sharp({ create: { width: CW * COLS, height: rows * (CH + LH), channels: 3, background: '#000' } }).composite(comps).jpeg({ quality: 82 }).toFile(SHOTS + 'first_sheet.jpg');
  console.log('   sheet first_sheet.jpg (' + pics.length + ' pictures)');
} catch (e) { console.log('   (no sheet: ' + e.message + ')'); }
fs.writeFileSync(SHOTS + 'first.json', JSON.stringify(OUT, null, 1));
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 20)) console.log(l);
check(!logs.some(l => /pageerror/.test(l)), 'no page errors');
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
