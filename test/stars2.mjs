// u-stars2 · worlds of other stars worth landing on, in the browser (docs/superpowers/plans/2026-10-30-u-stars2.md):
// a new default world (seed 53, creative), 1280 × 720, de-DE; High, then Very Low.
//   pictures  test/shots/jump_transit.png (the stars bunched ahead, the band dimmed, the tunnel at the peak),
//             binary_space_shadow.png (a moon's two shadows on the lit disc), binary_two_shadows.png (two shadows on the
//             ground), binary_two_suns.png, exo_reddwarf_day.png (violet growth in a peach day), exo_ringed_sky.png,
//             exo_bluestar_crystals.png, starmap_route.png, stars2_vl.png; the sheet test/shots/stars2_sheet.jpg
//   numbers   the shaders compile, SUN2 on a binary world from Low up and never on Very Low, the frame with and without
//             the second sun, the first visit's codex page and XP, no page error
// → .tmp_tests/stars2_run.json.   usage: nohup bash test/wt_run.sh stars2.mjs 5400 > .tmp_tests/stars2.log 2>&1 &
// regress: skip  (a showcase: the pictures are the evidence; the gates are test/exo.js)
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
const save = () => { try { fs.writeFileSync(ROOT + '.tmp_tests/stars2_run.json', JSON.stringify(rec, null, 1)); } catch (e) { /* a convenience */ } };
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
const R0 = {};
// ---------------------------------------------------------------- u-stars2
const sj = (P) => P.ev(() => VR.StarJump.debug.state(VR.game));
const keep = (P, name) => P.ev((n) => { window[n] = window.__F; return !!window.__F; }, name);
const shot = async (P, name, tag) => { await P.step(2); await keep(P, '__Fs'); const m = await picture(P, '__Fs', SH(name), K); rec.presets[tag].pics = rec.presets[tag].pics || {}; rec.presets[tag].pics[name] = m; console.log('  ' + name + ' ' + JSON.stringify(m)); return m; };
// the systems the pictures need, from this seed's neighbourhood
const choose = (P) => P.ev(() => {
  const g = VR.game, G = VR.Galaxy, E = VR.Exo, N = VR.StarJump.hood(g), L = N.list, d0 = (s) => Math.hypot(...s.p);
  const pick = (fn) => { const out = []; for (const s of L) { if (s.home) continue; const d = G.system(N, s.idx); for (const b of d.bodies) if (b.planet && fn(s, d, b)) out.push({ idx: s.idx, f: b.id, dim: b.dim, base: b.base, d: d0(s), T: s.T }); } out.sort((a, b) => a.d - b.d); return out[0] || null; };
  const k = L.filter(s => s.cls === 'K' && !s.bin && s.neb < 0).sort((a, b) => d0(a) - d0(b))[0];
  const from = G.systemsNear(N, k.p, 30).find(q => q.idx !== k.idx && q.idx !== 0 && q.s.neb < 0);
  const binSpace = pick((s, d, b) => s.bin && s.bin.close && s.bin.L / s.L > 0.2 && b.landable && d.bodies.some(m => m.parent === b.id));
  const binLand = pick((s, d, b) => s.bin && s.bin.close && s.bin.L / s.L > 0.3 && b.landable && (b.base === 'basalt' || b.base === 'opal') && !E.ring(d, b) && E.sky(d, b, 0).k2 > 0.25);
  const violet = pick((s, d, b) => E.signature(d, b) === 'violet' && b.base === 'aqua');
  const ringed = pick((s, d, b) => b.landable && E.ring(d, b) && (b.base === 'basalt' || b.base === 'opal') && !s.bin);
  const crystal = pick((s, d, b) => E.signature(d, b) === 'crystal' && s.cls !== 'D' && !s.bin);
  return { k: k.idx, from: from && from.idx, binSpace, binLand, violet, ringed, crystal };
});
// land on a world of a system (enter it, Landen); from another world first home if Travel refuses
async function land(P, w) {
  const go = () => P.ev(([i, f]) => { const g = VR.game; VR.StarJump.enter(g, i, { quiet: true, focus: f }); return VR.StarJump.land(g); }, [w.idx, w.f]);
  let ok = await go();
  if (!ok) { await P.ev(() => { const g = VR.game; if (g.stars && g.stars.on) VR.StarJump.leave(g); g.goHome(); }); await waitDim(P, 'overworld'); ok = await go(); }
  const d = await waitDim(P, w.dim);
  check(d.dim === w.dim, 'landed on ' + w.dim, JSON.stringify(d));
  await P.settle(300);
  return d.dim === w.dim;
}
async function waitDim(P, dim) {
  let d = null;
  for (let i = 0; i < 160; i++) { await P.wait(500); d = await P.ev(() => ({ dim: VR.game.dim, st: VR.game.state, trip: !!(VR.game.travel && VR.game.travel.trip) })); if (d.st === 'play' && d.dim === dim && !d.trip) break; }
  return d;
}
// a moment of the world's day when its sun stands at el (and the companion's up too, if asked); the view toward yaw
const daySet = (P, el0, el1, both) => P.ev(([el0, el1, both]) => {
  const g = VR.game, U = VR.Universe, p = g.player, eye = [p.pos[0], p.pos[1] + 1.6, p.pos[2]]; let best = null;
  for (let day = 1; day < 9; day++) for (let tk = 0; tk < 24000; tk += 150) {
    const r = VR.BodySky.compute(g.dim, eye, U.worldSeconds(day, tk), {}); if (!r) continue;
    const y = r.light.sunDir[1], el = Math.asin(Math.max(-1, Math.min(1, y))), s2 = r.exo2 && r.exo2.sun2;
    if (el < el0 || el > el1 || (both && !(s2 && s2[1] > Math.sin(el0 * 0.8)))) continue;
    const sc = Math.abs(el - (el0 + el1) / 2); if (!best || sc < best.sc) best = { day, tk, sc, el: +(el * 57.3).toFixed(1), dir: r.light.sunDir.map(v => +v.toFixed(3)), s2: s2 ? s2.map(v => +v.toFixed(3)) : null, exo: r.exo2, col: r.sky.sunCol.map(v => +v.toFixed(3)), sunC: r.light.sunColor.map(v => +v.toFixed(3)) };
    if (best && best.sc < 0.02) break;
  }
  if (best) { g.env.day = best.day; g.env.setTime(best.tk); }
  return best;
}, [el0, el1, !!both]);
const look = (P, yaw, pitch, fov) => P.ev(([y, pi, f]) => { const g = VR.game, p = g.player; p.yaw = p.viewYaw = y; p.pitch = pi; p.flying = true; g.settings.fov = f || 75; }, [yaw, pitch, fov]);
const yawOf = (d) => Math.atan2(-d[0], -d[2]);
async function stars2(P, tag) {
  const R = rec.presets[tag] = { preset: tag };
  const C = R.pick = await choose(P);
  console.log('  systems ' + JSON.stringify(C));
  if (tag === 'high' && want('jump')) {
    // the jump: shot at the transit's peak
    const ok = await P.ev(([a, b]) => { const g = VR.game; g.settings.fov = 75; VR.StarJump.enter(g, a, { quiet: true }); return VR.StarJump.jump(g, b); }, [C.from, C.k]);
    await P.step(2);
    let s = await sj(P); check(ok && s.jumping && !s.err, 'the jump starts (the shader compiles)', JSON.stringify(s).slice(0, 200));
    const J = await P.ev(() => VR.game.stars.J);
    await P.step(Math.round((J.spin + J.transit * 0.5) / 0.033) - 4);
    const tun = await P.ev(() => Array.from(VR.StarJump.UF.tun));
    check(tun[0] > 0.5 && tun[2] < 0.3, 'at the peak: the tunnel on, the band dimmed', JSON.stringify(tun.map(v => +v.toFixed(2))));
    await shot(P, 'jump_transit.png', tag);
    for (let n = 0; n < 400; n++) { s = await sj(P); if (!s.jumping) break; await P.step(5); }
    check(s.on && s.sys === C.k, 'arrived', s.sys);
  }
  if (tag === 'high' && want('space') && C.binSpace) {
    const r = await P.ev(([i, f]) => { const g = VR.game; VR.StarJump.enter(g, i, { quiet: true, focus: f, phaseDeg: 70, dist: 4 }); const m = VR.StarJump.debug.alignMoon(g, 0); VR.StarJump.debug.look(g, 'focus', 1); return m; }, [C.binSpace.idx, C.binSpace.f]);
    check(!!r, 'a moon aligned over the lit disc', r);
    await shot(P, 'binary_space_shadow.png', tag);
  }
  // the first visit: the codex page and the XP
  const first = await P.ev(() => { const g = VR.game, A = VR.Adventure; return { codex: !!(g.codex && g.codex.found && g.codex.found['m:stars']), xp: A && A.rec && A.rec.me ? Object.keys(A.rec.me.once || {}).filter(k => /^system:x/.test(k)).length : -1, route: ((g.meta.stars && g.meta.stars.route) || []).length, lines: (window.__lines || []).filter(l => /Erstbesuch/.test(l)).length }; });
  R.first = first; console.log('  first visit ' + JSON.stringify(first));
  if (tag === 'high') check(first.codex && first.route >= 2, 'the first visit: the codex page „Fremde Sonne", the route grows', JSON.stringify(first));
  // the binary world: two suns, two shadows
  if (want('binary') && C.binLand && await land(P, C.binLand)) {
    const b = await daySet(P, 0.42, 0.75, true);
    console.log('  the suns ' + JSON.stringify(b));
    const st = await P.ev(() => ({ built: !!VR.StarExo.built, cur: VR.StarExo.cur && VR.StarExo.cur.sun2 ? VR.StarExo.cur.sun2.map(v => +v.toFixed(3)) : null, hs: !!VR.game.renderer.q.hshadow, lite: !!VR.game.renderer.q.lite }));
    await P.step(4); await keep(P, '__Fb'); await picture(P, '__Fb', SH('_tmp_b.png'), 1);   // (the program is rebuilt in a drawn frame)
    const st2 = await P.ev(() => ({ built: !!VR.StarExo.built }));
    R.sun2 = Object.assign(st, st2);
    if (tag === 'high') check(st2.built && !!st.cur, 'High: the second sun lights the ground (SUN2)', JSON.stringify(R.sun2));
    else check(!st2.built, 'Very Low: no SUN2 program', JSON.stringify(R.sun2));
    if (b && tag === 'high') {
      // a pillar and a wall beside the player, the view down on their shadows
      const at = await P.ev(() => { const g = VR.game, w = g.world, p = g.player, x = Math.floor(p.pos[0]) + 4, z = Math.floor(p.pos[2]); let y = 200; while (y > 20 && !w.getBlock(x, y, z)) y--; const S = VR.R.S('stone_bricks') || VR.R.S('stone'); for (let k = 1; k <= 5; k++) w.setBlock(x, y + k, z, S); for (let k = 1; k <= 3; k++) for (let dz = 2; dz <= 4; dz++) w.setBlock(x, y + k, z + dz, S); return [x, y, z]; });
      await P.settle(120);
      const d = b.dir; const sy = yawOf([-d[0], 0, -d[2]]);
      // (run 1 stood on the shadows' side looking away: the pillar behind the eye — now on the suns' side, the shadows ahead)
      const hl = Math.hypot(d[0], d[2]) || 1;
      await P.ev(([at, d, hl]) => { const g = VR.game, p = g.player; p.teleport(at[0] + 0.5 + d[0] / hl * 7, at[1] + 5, at[2] + 2.5 + d[2] / hl * 7); }, [at, d, hl]);
      await look(P, sy, -0.55, 75);
      await P.step(6);
      await shot(P, 'binary_two_shadows.png', tag);
      const s2 = b.s2 || d, mid = [d[0] + s2[0], 0, d[2] + s2[2]];
      await look(P, yawOf(mid), Math.asin(Math.min(0.95, (d[1] + s2[1]) / 2)) - 0.12, 75);
      await P.step(4);
      await shot(P, 'binary_two_suns.png', tag);
      // the cost of the second sun (High): the same frame with the switch off
      const on = await cost(P, '__Fs', 2, 4);
      await P.ev(() => { VR.game.settings.sun2 = false; });
      await P.step(4); await keep(P, '__Fo');
      const off = await cost(P, '__Fo', 2, 4);
      await P.ev(() => { VR.game.settings.sun2 = true; });
      R.sun2cost = { on, off }; console.log('  SUN2 on ' + JSON.stringify(on) + ' off ' + JSON.stringify(off));
    }
    if (tag !== 'high') {
      if (b) await look(P, yawOf(b.dir), 0.2, 75);
      await P.step(4); await keep(P, '__Fs');
      R.exoCost = await cost(P, '__Fs', 2, 5); await picture(P, '__Fs', SH('stars2_vl.png'), K); console.log('  Very Low exo frame ' + JSON.stringify(R.exoCost));
    }
  }
  if (tag !== 'high') return;
  if (want('violet') && C.violet && await land(P, C.violet)) {
    const b = await daySet(P, 0.3, 0.7);
    console.log('  the red dwarf ' + JSON.stringify(b));
    const n = await P.ev(() => { const g = VR.game, w = g.world, p = g.player, M = VR.R.S('exo_moss'), F = VR.R.S('exo_frond'); let m = 0, f = 0; for (let dx = -20; dx <= 20; dx++) for (let dz = -20; dz <= 20; dz++) for (let y = 40; y < 140; y++) { const s = w.getBlock(Math.floor(p.pos[0]) + dx, y, Math.floor(p.pos[2]) + dz); if (s === M) m++; else if (s === F) f++; } return { m, f }; });
    check(n.m > 50 && n.f > 5, 'violet moss and fronds round the landing', JSON.stringify(n));
    check(!!b && b.sunC[0] > b.sunC[2] * 1.4, 'the day is peach (its light red over blue)', b && JSON.stringify(b.sunC));
    if (b) { await look(P, yawOf(b.dir) + 0.6, -0.12, 75); await P.step(6); await shot(P, 'exo_reddwarf_day.png', tag); }
  }
  if (want('ring') && C.ringed && await land(P, C.ringed)) {
    const b = await daySet(P, 0.05, 0.2);
    console.log('  the ringed world ' + JSON.stringify(b));
    check(!!(b && b.exo && b.exo.ring), 'the world has its ring in the sky');
    await look(P, Math.PI, 0.45, 80);   // (the ring arches over the southern sky: yaw π looks +z)
    await P.step(6);
    await shot(P, 'exo_ringed_sky.png', tag);
  }
  if (want('crystal') && C.crystal && await land(P, C.crystal)) {
    const b = await daySet(P, 0.35, 0.6);
    console.log('  the hot star ' + JSON.stringify(b));
    const c = await P.ev(() => { const g = VR.game, w = g.world, p = g.player, S = VR.R.S('exo_crystal'), px = Math.floor(p.pos[0]), pz = Math.floor(p.pos[2]); let best = null, n = 0; for (let dx = -40; dx <= 40; dx++) for (let dz = -40; dz <= 40; dz++) for (let y = 40; y < 160; y++) { if (w.getBlock(px + dx, y, pz + dz) !== S) continue; n++; const d = Math.hypot(dx, dz); if (d > 8 && (!best || d < best.d)) best = { x: px + dx, y, z: pz + dz, d }; } return { best, n }; });
    check(c.n > 20, 'crystal spires round the landing', c.n);
    if (c.best) { await P.ev(([x, y, z]) => { const p = VR.game.player; const dx = x + 0.5 - p.pos[0], dz = z + 0.5 - p.pos[2], l = Math.hypot(dx, dz); p.teleport(x + 0.5 - dx / l * 11, y + 3, z + 0.5 - dz / l * 11); }, [c.best.x, c.best.y, c.best.z]); await P.settle(80); const yy = await P.ev(([x, z]) => { const p = VR.game.player; return Math.atan2(-(x + 0.5 - p.pos[0]), -(z + 0.5 - p.pos[2])); }, [c.best.x, c.best.z]); await look(P, yy, -0.15, 75); }
    await P.step(6);
    await shot(P, 'exo_bluestar_crystals.png', tag);
  }
  if (want('map')) {
    await P.ev(() => { const g = VR.game; VR.StarMap.open(g); VR.StarMap.st.dist = 70; VR.StarMap.st.dirty = true; });
    await P.step(3);
    await P.page.screenshot({ path: SH('starmap_route.png') });
    const m = await P.ev(() => ({ next: VR.StarMap.st.next, route: (VR.game.meta.stars.route || []).slice() }));
    check(!!m.next && m.route.length >= 3, 'the map: the route and the next target', JSON.stringify(m).slice(0, 300));
    await P.ev(() => VR.StarMap.close(VR.game));
  }
}

console.log('u-stars2 · ' + secs());
for (const preset of PRESETS) {
  const tag = TAGP[preset] || preset;
  console.log('== ' + NAMEP[preset] + ' · ' + secs());
  const P = await openPage();
  const ok = await makeWorld(P, preset);
  check(ok, 'the world plays (' + preset + ')');
  if (!ok) { await P.ctx.close(); continue; }
  rec.presets[tag] = {};
  if (tag !== 'high') { await plaza(P, SH('stars2_plaza_vl.png')); R0.plazaVL = await cost(P, '__Fplaza', 2, 5); console.log('  Very Low plaza ' + JSON.stringify(R0.plazaVL)); }
  try { await stars2(P, tag); } catch (e) { fails++; console.log('  ✗ ' + String(e && e.stack || e).slice(0, 800)); }
  const errs = errsOf(P); check(errs.length === 0, 'no page error', errs.slice(0, 3).join(' | ').slice(0, 900));
  for (const l of P.logs.slice(0, 6)) console.log('    log ' + l.slice(0, 300));
  save();
  await P.ctx.close();
}
await browser.close();
rec.R0 = R0; save();
try {
  const S = (n) => SH(n), ex = (n) => fs.existsSync(S(n)) ? [S(n)] : [];
  const spec = { w: 620, rows: [
    { label: 'Doppelstern: zwei Schatten am Boden · zwei Sonnen · Mondschatten im All', imgs: [...ex('binary_two_shadows.png'), ...ex('binary_two_suns.png'), ...ex('binary_space_shadow.png')] },
    { label: 'Sprung: Transit (Tunnel) · Roter Zwerg: violettes Leben · Ring am Himmel', imgs: [...ex('jump_transit.png'), ...ex('exo_reddwarf_day.png'), ...ex('exo_ringed_sky.png')] },
    { label: 'Kristallfelder unter heißem Stern · Sternkarte: Route + nächstes Ziel · Very Low', imgs: [...ex('exo_bluestar_crystals.png'), ...ex('starmap_route.png'), ...ex('stars2_vl.png')] }] };
  fs.writeFileSync(ROOT + '.tmp_tests/stars2_sheet.json', JSON.stringify(spec));
  execFileSync('python3', ['/root/r9coord/pairs.py', S('stars2_sheet.jpg'), ROOT + '.tmp_tests/stars2_sheet.json']);
  console.log('  sheet test/shots/stars2_sheet.jpg');
} catch (e) { console.log('  (no sheet: ' + String(e.message || e).slice(0, 200) + ')'); }
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
