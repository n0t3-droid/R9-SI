// u-stars · von Stern zu Stern in the browser (docs/superpowers/plans/2026-10-30-u-stars.md): a new default world
// (seed 53, creative), 1280 × 720, de-DE; High first, then Very Low.
//   pictures  test/shots/starmap.png (the map, a system's card), jump_spinup.png (the stars bunching ahead, blue; behind
//             red), jump_transit.png (the band turning, the target a growing point), arrive_kdwarf.png, binary_two_shadows.png
//             (a moon's two shadows on a world of a close pair), nebula_inside.png, nebula_truecolour.png, reddwarf_sky.png
//             (the peach sky on a world of a cool red dwarf), stars_vl.png, the plaza; the sheet test/shots/stars_sheet.jpg
//   numbers   the shader compiles, the jump 8–12 s, the scene's and the map's frame against the plaza frame (Very Low:
//             the map's ≤ the plaza's), no page error
// → .tmp_tests/starjump_run.json.   usage: nohup bash test/wt_run.sh starjump.mjs 3600 > .tmp_tests/starjump.log 2>&1 &
// regress: skip  (a showcase: the pictures are the evidence; the gates are test/galaxy.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import { execSync, execFileSync } from 'child_process';
const ROOT = new URL('../', import.meta.url).pathname;   // this checkout (the test runs from test/ or from .tmp_tests/)
const DIST = process.env.DIST || 'file://' + ROOT + 'dist/index.html';
const SHOTS = ROOT + 'test/shots/';
const BASE = process.env.BASE_DIST || (fs.existsSync(ROOT + '.tmp_tests/base0d0/dist/index.html') ? 'file://' + ROOT + '.tmp_tests/base0d0/dist/index.html' : '');
const SEED = process.env.SEED || '53', RD = +(process.env.RD || 8), ROUNDS = +(process.env.ROUNDS || 3), K = +(process.env.K || 3);
const PRESETS = (process.env.PRESETS || 'high,potato').split(',');
const SH = (n) => SHOTS + n;
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const want = (s) => !ONLY || ONLY.includes(s);
const TAGP = { high: 'high', potato: 'vl' }, NAMEP = { high: 'High', potato: 'Very Low' };
const ALTS = [300, 600, 900, 1200, 1500, 1800, 2100, 2400];
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg, info) => { const s = info !== undefined ? '  (' + info + ')' : ''; if (!ok) { fails++; console.log('  ✗ ' + msg + s); } else console.log('  ✓ ' + msg + s); };
const r1 = (x) => Math.round(x * 10) / 10;
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
const rec = { dist: DIST, seed: SEED, presets: {} };
const save = () => { try { fs.writeFileSync(ROOT + '.tmp_tests/starjump_run.json', JSON.stringify(rec, null, 1)); } catch (e) { /* a convenience */ } };
fs.mkdirSync(SHOTS, { recursive: true });
// ---------------------------------------------------------------- the browser, a page (space0.mjs's helpers)
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const cpuNow = () => {
  const kids = new Map();
  for (const l of execSync('ps -e -o pid=,ppid=').toString().trim().split('\n')) { const [p, pp] = l.trim().split(/\s+/).map(Number); if (!kids.has(pp)) kids.set(pp, []); kids.get(pp).push(p); }
  let t = 0; const st = [process.pid];
  while (st.length) { for (const c of kids.get(st.pop()) || []) { st.push(c); try { const s = fs.readFileSync(`/proc/${c}/stat`, 'utf8'), f = s.slice(s.lastIndexOf(')') + 2).split(' '); t += +f[11] + +f[12]; } catch (e) { } } }
  return t * 10;
};
async function openPage(url = DIST) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail|missing|incomplete/i.test(s)) logs.push(`[${t}] ${s.slice(0, 600)}`); });
  page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
  page.on('crash', () => { logs.push('[pageerror] the page crashed'); console.log('  !! the page crashed'); });
  await page.goto(url);
  const wait = (ms) => page.waitForTimeout(ms);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
  await ev(() => {
    const r = VR.game.renderer, gl = r.gl;
    window.__px = new Uint8Array(4);
    window.__sync = () => { const d = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING), rd = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, window.__px); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, d); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, rd); };
    r._render = r.render;
    r.render = function (F) { if (window.__norender) { window.__F = F; this.setupCamera(F.cam); return; } return this._render(F); };
  });
  const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(4); } };
  const boost = (on) => ev((on) => { const q = VR.game.renderer && VR.game.renderer.q; if (!q) return; if (on) { if (q.__up === undefined) q.__up = q.upload; q.upload = 24; } else if (q.__up !== undefined) { q.upload = q.__up; delete q.__up; } }, on);
  const settle = async (max = 400) => {
    let s = null, last = Infinity, stall = 0;
    await boost(true);
    for (let i = 0; i < max; i++) {
      await step(10);
      s = await ev(() => { const g = VR.game, w = g.world, p = g.player, rd = Math.max(1, (w.renderDist | 0) - 1), ri = Math.max(1, rd - 2), pcx = Math.floor(p.pos[0]) >> 4, pcz = Math.floor(p.pos[2]) >> 4; let dirty = 0; for (const c of w.cols.values()) { let n = 0; for (const sc of c.sec) if ((sc.dirty || sc.pending) && sc.count > 0) n++; const ex = c.cx - pcx, ez = c.cz - pcz; if (n && ex * ex + ez * ez <= ri * ri) dirty += n; } let unshown = 0; for (let dz = -rd; dz <= rd; dz++) for (let dx = -rd; dx <= rd; dx++) { if (dx * dx + dz * dz > rd * rd) continue; const c = w.col(pcx + dx, pcz + dz); if (!c || !(c.shownAt >= 0)) unshown++; } const hz = g.horizon; return { busy: g.pool.busy, pend: w.pending.size, dirty, up: w.uploadQ ? w.uploadQ.size : 0, fading: w.fading ? w.fading.size : 0, unshown, arr: w.arrivals ? w.arrivals.length : 0, hz: hz && hz.progress ? +hz.progress().toFixed(2) : 1 }; });
      const shown = s.pend === 0 && s.up === 0 && s.fading === 0 && s.unshown === 0 && s.arr === 0 && s.hz >= 0.98;
      stall = shown && s.dirty >= last ? stall + 1 : 0; last = s.dirty;
      s.i = i;
      if (shown && ((s.busy === 0 && s.dirty === 0) || stall >= 6)) break;
      await wait(60);
    }
    await boost(false);
    return s;
  };
  const groundY = (x, z) => ev(([x, z]) => { const w = VR.game.world, R = VR.R, F = VR.F; for (let y = 220; y > 30; y--) { const s = w.getBlock(Math.floor(x), y, Math.floor(z)); if (s && (R.T.flags[s] & (F.OPAQUE | F.FLUID)) && !(R.T.flags[s] & F.LEAVES)) return y; } return 80; }, [x, z]);
  return { ctx, page, logs, ev, wait, step, settle, groundY };
}
const errsOf = (P) => P.logs.filter(l => l.startsWith('[pageerror]'));
async function makeWorld(P, preset) {
  await P.ev(([p, rd]) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.camShake = false; g.settings.renderDist = Math.min(rd, (VR.Game.PRESETS[p] || {}).renderDist || rd); g.applySettings('*'); }, [preset, RD]);
  await P.ev((seed) => VR.game.createWorld({ name: 'Aufstieg', mode: 'creative', difficulty: 'peaceful', type: 'default', seed, cheats: true, kit: true }), SEED);
  for (let i = 0; i < 150; i++) { await P.wait(1000); if (await P.ev(() => VR.game.state) === 'play') break; }
  const ok = await P.ev(() => VR.game.state) === 'play';
  await P.ev(() => { const g = VR.game; g.zenFreezeTime = true; g.zenFreezeWeather = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; for (const id of ['hud', 'ui', 'hints']) { const h = document.getElementById(id); if (h) h.style.display = 'none'; } const ui = g.ui, cl = ui.chatLine.bind(ui); window.__lines = []; ui.chatLine = (t, c) => { window.__lines.push(String(t)); return cl(t, c); }; });
  return ok;
}
// a kept frame (window[key]) drawn k times, the screen read back into a picture (with the overlay canvas laid over)
const picture = async (P, key, path, k, overlay) => {
  // (the PNG made in the page: the read-back flipped into a 2D canvas, the screen's overlay drawn over it)
  const m = await P.ev(([key, k, overlay]) => {
    const g = VR.game, r = g.renderer, gl = r.gl, F = window[key];
    if (!F) return { err: 'no frame kept' };
    window.__norender = false;
    r.frameNo = 1000; r.tsrReset = true; r.shadowValid = false;
    try { for (let i = 0; i < k; i++) { if (g.cockpit) g.cockpit.drawnAt = -1; r.render(F); } } catch (e) { window.__norender = true; return { err: String(e && e.stack || e).slice(0, 600) }; }
    const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, px = new Uint8Array(W * H * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    window.__norender = true;
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'), id = x.createImageData(W, H);
    let s = 0, s2 = 0, n = 0;
    for (let y = 0; y < H; y++) { const src = (H - 1 - y) * W * 4; id.data.set(px.subarray(src, src + W * 4), y * W * 4); }
    for (let i = 0; i < id.data.length; i += 4) { id.data[i + 3] = 255; if ((i >> 2) % 7 === 0) { const L = 0.2126 * id.data[i] + 0.7152 * id.data[i + 1] + 0.0722 * id.data[i + 2]; s += L; s2 += L * L; n++; } }
    x.putImageData(id, 0, 0);
    let ov = false; const fx = document.getElementById('ascFx'); if (overlay && fx && fx.style.display !== 'none') { x.drawImage(fx, 0, 0, W, H); ov = true; }
    const mean = s / n;
    return { png: c.toDataURL('image/png').split(',')[1], W, H, draws: r.stats.draws, tris: Math.round(r.stats.tris), overlay: ov, mean: Math.round(mean * 10) / 10, sd: Math.round(Math.sqrt(Math.max(0, s2 / n - mean * mean)) * 10) / 10 };
  }, [key, k, !!overlay]);
  if (m.err) return m;
  fs.writeFileSync(path, Buffer.from(m.png, 'base64'));
  delete m.png;
  return m;
};
// the flown ship in a kept frame: the frame drawn as it is and once without the ship, the pixels that differ (runs 1–2 flew
// a hidden ship: nothing would have differed)
const cost = async (P, key, k, n) => {
  await P.ev(([key, k]) => { const r = VR.game.renderer, F = window[key]; window.__norender = false; r.frameNo = 1000; r.tsrReset = true; r.shadowValid = false; for (let i = 0; i < k; i++) r.render(F); window.__sync(); window.__norender = true; }, [key, k]);
  const c0 = cpuNow();
  const wall = await P.ev(([key, n]) => { const r = VR.game.renderer, F = window[key], out = []; window.__norender = false; for (let i = 0; i < n; i++) { const t0 = performance.now(); r.render(F); window.__sync(); out.push(performance.now() - t0); } window.__norender = true; return out; }, [key, n]);
  return { cpuMs: (cpuNow() - c0) / n, wallMs: med(wall) };
};
// the ship's state, the space scene's textures
async function plaza(P, path) {
  const px = 4.5, pz = 74.5;
  await P.ev(([x, z]) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(x, 150, z); }, [px, pz]);
  await P.settle(1500);
  const gy = await P.groundY(px, pz), eyeY = gy + 1 + 1.62, at = [0, 93, 0];
  await P.ev(([x, y, z, at]) => { const g = VR.game, p = g.player; g.env.day = 2; g.env.setTime(6000); p.teleport(x, y - 1.62, z); p.yaw = p.viewYaw = Math.atan2(-(at[0] - x), -(at[2] - z)); p.pitch = Math.atan2(at[1] - y, Math.hypot(at[0] - x, at[2] - z)); g.settings.fov = 70; }, [px, eyeY, pz, at]);
  await P.settle(400);
  await P.step(60);   // (the last columns' fade-in: two seconds of game time — run 1's v0.49 page was caught mid-fade)
  await P.settle(60);
  await P.ev(() => { const e = VR.game.env; e.anim = 600; e.cloudDrift = [540, 0]; });
  await P.step(4);
  await P.ev(() => { window.__Fplaza = window.__F; });
  return picture(P, '__Fplaza', path, K);
}

// ---------------------------------------------------------------- u-stars
const sj = (P) => P.ev(() => VR.StarJump.debug.state(VR.game));
const keep = (P, name) => P.ev((n) => { window[n] = window.__F; return !!window.__F; }, name);
const shot = async (P, name, tag) => { await P.step(2); await keep(P, '__Fs'); const m = await picture(P, '__Fs', SH(name), K); rec.presets[tag].pics = rec.presets[tag].pics || {}; rec.presets[tag].pics[name] = m; console.log('  ' + name + ' ' + JSON.stringify(m)); return m; };
// the systems the pictures need, chosen in the page from the neighbourhood of this seed
const choose = (P) => P.ev(() => {
  const g = VR.game, G = VR.Galaxy, N = VR.StarJump.hood(g), L = N.list, d0 = (s) => Math.hypot(...s.p);
  const k = L.filter(s => s.cls === 'K' && !s.bin && s.neb < 0).sort((a, b) => d0(a) - d0(b))[0];
  const from = G.systemsNear(N, k.p, 30).find(q => q.idx !== k.idx && q.idx !== 0 && q.s.neb < 0);
  let bin = null, binFocus = null;
  for (const s of L) { if (!s.bin || !s.bin.close || s.bin.L / s.L < 0.15) continue; const d = G.system(N, s.idx), m = d.bodies.find(b => b.moon && d.bodies.find(p => p.id === b.parent && p.landable)); if (m) { bin = s.idx; binFocus = m.parent; break; } }
  const neb = L.find(s => s.neb >= 0);
  let red = null, redFocus = null;
  for (const s of L) { if (s.cls !== 'M' || s.T > 3050 || s.bin) continue; const d = G.system(N, s.idx), w = d.bodies.find(b => b.landable && b.base === 'aqua'); if (w) { red = s.idx; redFocus = w.id; break; } }
  return { k: k.idx, kName: k.name, from: from && from.idx, fromLy: from && from.d, bin, binFocus, neb: neb.idx, nebName: neb.name, red, redFocus, redT: red ? L[red].T : 0, n: L.length };
});
async function stars(P, tag) {
  const R = rec.presets[tag] = { preset: tag };
  const C = R.pick = await choose(P);
  console.log('  systems ' + JSON.stringify(C));
  // the map (a DOM canvas: the page's own screenshot)
  if (want('map')) {
    await P.ev((i) => { const g = VR.game; VR.StarMap.open(g); VR.StarMap.select(i); }, C.from);
    await P.step(3);
    const page = P.page;
    if (tag === 'high') await page.screenshot({ path: SH('starmap.png') });
    const ms = await P.ev(() => { const g = VR.game, out = []; for (let i = 0; i < 12; i++) { VR.StarMap.st.dirty = true; VR.StarMap.frame(g, 0.016); out.push(VR.StarMap.st.drawMs); } out.sort((a, b) => a - b); return out[6]; });
    R.mapMs = ms; console.log('  the map draws in ' + ms.toFixed(2) + ' ms');
    await P.ev(() => VR.StarMap.close(VR.game));
  }
  // the jump: from a neighbour of the K dwarf to it
  if (want('jump')) {
    const ok = await P.ev(([a, b]) => { const g = VR.game; g.settings.fov = 75; VR.StarJump.enter(g, a, { quiet: true }); return VR.StarJump.jump(g, b); }, [C.from, C.k]);
    await P.step(2);
    let s = await sj(P); check(ok && s.jumping && !s.err, 'the jump starts (the shader compiles)', JSON.stringify(s).slice(0, 300));
    R.dur = s.dur; check(s.dur >= 8 && s.dur <= 12, 'the jump lasts 8–12 s', s.dur);
    await P.step(Math.round(2.2 / 0.033) - 2);
    if (tag === 'high') await shot(P, 'jump_spinup.png', tag);
    await P.step(Math.round(2.0 / 0.033));
    if (tag === 'high') await shot(P, 'jump_transit.png', tag);
    let n = 0; for (; n < 400; n++) { s = await sj(P); if (!s.jumping) break; await P.step(5); }
    check(s.on && s.sys === C.k, 'arrived at the K dwarf ' + C.kName, JSON.stringify(s).slice(0, 200));
    await P.step(30);
    if (tag === 'high') await shot(P, 'arrive_kdwarf.png', tag);
    else { await keep(P, '__Fs'); R.sceneCost = await cost(P, '__Fs', 3, 10); await picture(P, '__Fs', SH('stars_vl.png'), K); console.log('  the scene frame ' + JSON.stringify(R.sceneCost)); }
  }
  if (tag !== 'high') return;
  if (want('binary') && C.bin) {
    await P.ev(([i, f]) => { const g = VR.game; VR.StarJump.enter(g, i, { quiet: true, focus: f, phaseDeg: 70, dist: 4 }); VR.StarJump.debug.alignMoon(g, 14); VR.StarJump.debug.look(g, 'focus', 1); }, [C.bin, C.binFocus]);
    await shot(P, 'binary_two_shadows.png', tag);
  }
  if (want('nebula')) {
    await P.ev((i) => { const g = VR.game; g.settings.nebulaTrue = false; VR.StarJump.enter(g, i, { quiet: true, phaseDeg: 140, dist: 7 }); const S = g.stars; S.yaw += 2.4; S.pitch = 0.25; }, C.neb);
    await shot(P, 'nebula_inside.png', tag);
    await P.ev(() => { VR.game.settings.nebulaTrue = true; });
    await shot(P, 'nebula_truecolour.png', tag);
    await P.ev(() => { VR.game.settings.nebulaTrue = false; });
  }
  if (want('red') && C.red) {
    await P.ev(([i, f]) => { const g = VR.game; VR.StarJump.enter(g, i, { quiet: true, focus: f }); return VR.StarJump.land(g); }, [C.red, C.redFocus]);
    let d = null; for (let i = 0; i < 120; i++) { await P.wait(500); d = await P.ev(() => ({ dim: VR.game.dim, st: VR.game.state, trip: !!(VR.game.travel && VR.game.travel.trip) })); if (d.st === 'play' && /^x\./.test(d.dim || '') && !d.trip) break; }
    check(/^x\./.test(d.dim || ''), 'landed on the red dwarf\'s world (its own dim)', JSON.stringify(d));
    await P.settle(300);
    const sun = await P.ev(() => {
      const g = VR.game, U = VR.Universe, p = g.player, eye = [p.pos[0], p.pos[1] + 1.6, p.pos[2]]; let best = null;
      for (let day = 1; day < 6; day++) for (let tk = 0; tk < 24000; tk += 400) { const r = VR.BodySky.compute(g.dim, eye, U.worldSeconds(day, tk), {}); if (!r) continue; const y = r.light.sunDir[1]; if (y > 0.2 && y < 0.45 && (!best || Math.abs(y - 0.3) < Math.abs(best.y - 0.3))) best = { day, tk, y, dir: r.light.sunDir, exo: r.exo, col: r.sky.sunCol }; }
      if (best) { g.env.day = best.day; g.env.setTime(best.tk); const d = best.dir, yaw = Math.atan2(-d[0], -d[2]) + 0.45; p.yaw = p.viewYaw = yaw; p.pitch = 0.18; p.flying = true; g.settings.fov = 75; }
      return best;
    });
    console.log('  the sun there ' + JSON.stringify(sun));
    check(!!(sun && sun.exo && sun.exo.ang > 0.004), 'the red dwarf stands large in its world\'s sky', sun && sun.exo && sun.exo.ang);
    await P.step(40);
    await shot(P, 'reddwarf_sky.png', tag);
    const sky = await P.ev(() => { const s = VR.BodySky.cur && VR.BodySky.cur.sky; return s && s.air3 ? s.air3.slice(0, 6).map(v => +v.toFixed(3)) : null; });
    R.sky = sky; check(!!sky && sky[0] > sky[2], 'the sky is warm (peach): red over blue', JSON.stringify(sky));
    // Heimkehr from another star's world
    await P.ev(() => VR.game.goHome());
    for (let i = 0; i < 120; i++) { await P.wait(500); d = await P.ev(() => ({ dim: VR.game.dim, trip: !!(VR.game.travel && VR.game.travel.trip) })); if (d.dim === 'overworld' && !d.trip) break; }
    check(d.dim === 'overworld', 'Heimkehr from there brings you home (Herzwelt)', d.dim);
  }
}

console.log('u-stars · ' + secs());
for (const preset of PRESETS) {
  const tag = TAGP[preset] || preset;
  console.log('== ' + NAMEP[preset] + ' · ' + secs());
  const P = await openPage();
  const ok = await makeWorld(P, preset);
  check(ok, 'the world plays (' + preset + ')');
  if (!ok) { await P.ctx.close(); continue; }
  rec.presets[tag] = {};
  const pz = await plaza(P, SH('stars_plaza_' + tag + '.png'));
  const pc = await cost(P, '__Fplaza', 3, 10);
  console.log('  the plaza ' + JSON.stringify(pc) + ' ' + JSON.stringify(pz).slice(0, 120));
  try { await stars(P, tag); } catch (e) { fails++; console.log('  ✗ ' + String(e && e.stack || e).slice(0, 800)); }
  const R = rec.presets[tag]; R.plaza = pc;
  if (R.mapMs !== undefined) check(R.mapMs <= pc.wallMs, NAMEP[preset] + ': the map\'s frame ≤ the plaza frame', R.mapMs.toFixed(2) + ' ≤ ' + pc.wallMs.toFixed(2) + ' ms');
  if (R.sceneCost) console.log('  ' + NAMEP[preset] + ': the scene ' + R.sceneCost.wallMs.toFixed(2) + ' ms vs the plaza ' + pc.wallMs.toFixed(2) + ' ms');
  const errs = errsOf(P); check(errs.length === 0, 'no page error', errs.slice(0, 3).join(' | ').slice(0, 900));
  for (const l of P.logs.slice(0, 6)) console.log('    log ' + l.slice(0, 300));
  save();
  await P.ctx.close();
}
await browser.close();
save();
try {
  const S = (n) => SH(n), ex = (n) => fs.existsSync(S(n)) ? [S(n)] : [];
  const spec = { w: 620, rows: [
    { label: 'Sternkarte · Sprung: Spin-up · Transit', imgs: [...ex('starmap.png'), ...ex('jump_spinup.png'), ...ex('jump_transit.png')] },
    { label: 'Ankunft K-Zwerg · Doppelstern: zwei Schatten · Nebel von innen', imgs: [...ex('arrive_kdwarf.png'), ...ex('binary_two_shadows.png'), ...ex('nebula_inside.png')] },
    { label: 'Nebel in Echtfarbe · Himmel unter dem roten Zwerg · Very Low', imgs: [...ex('nebula_truecolour.png'), ...ex('reddwarf_sky.png'), ...ex('stars_vl.png')] }] };
  fs.writeFileSync(ROOT + '.tmp_tests/stars_sheet.json', JSON.stringify(spec));
  execFileSync('python3', ['/root/r9coord/pairs.py', S('stars_sheet.jpg'), ROOT + '.tmp_tests/stars_sheet.json']);
  console.log('  sheet test/shots/stars_sheet.jpg');
} catch (e) { console.log('  (no sheet: ' + String(e.message || e).slice(0, 200) + ')'); }
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
