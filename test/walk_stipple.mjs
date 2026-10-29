// regress: skip — f-stipple2's pictures (review R52-05: walking still showed screen-door on the grass 3–10 m ahead and flat
// untextured ground 2–15 m ahead). A new default world (seed 4242, the Heartland — the sessions' world), 480 × 270 (the
// sessions' SIZE), de-DE, clear weather, the time held at 6000. From the spawn the walker takes the clearest of eight
// headings over open ground (the ground ahead loaded and meshed first) and walks it at 6 blocks a second, the eye 1.62
// over the ground, in two ways:
//   play     every frame drawn on a 33-ms clock (as a player at 30 fps); a picture every 12th frame, 24 of them
//   session  as test/session.mjs plays: 15 frames simulated, only the 15th drawn (and captured); 24 of them
// each on Balanced and High, for BUILDS before (DIST_BEFORE: v042's dist) and after (this checkout's dist).
// Each picture: test/stipple.js (the share in a coherent 2-px checker) and the texture energy (test/tex_energy.js) of the
// screen tiles (16 px) whose five rays (centre and corners) all meet solid ground 2–15 m from the eye (a render probe in
// the page): a tile under tex_energy.FLAT is flat. Pictures test/shots/walk_<build>_<preset>_<mode>_<k>.png; numbers
// .tmp_tests/walk_stipple.json.
// Checks (after): stipple < 1 % on ≥ 22 of 24 frames in each preset and way; no frame with flat ground tiles beyond 1;
// no page error.
//   DIST_BEFORE=file:///…/base/dist/index.html nohup bash test/wt_run.sh walk_stipple.mjs 3600 > .tmp_tests/walk_stipple.log 2>&1 &
//   (BUILDS=after · PRESETS=balanced · MODES=play)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import sharp from '/home/dev/.npm-global/lib/node_modules/sharp/lib/index.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const ROOTR = (() => { const a = new URL('../', import.meta.url).pathname; return fs.existsSync(a + 'test/stipple.js') ? a : new URL('../../', import.meta.url).pathname; })();
const { measure } = require(ROOTR + 'test/stipple.js');
const TE = require(ROOTR + 'test/tex_energy.js');
const SHOTS = ROOTR + 'test/shots/';
const VW = 480, VH = 270, TILE = 16, N = 24;
const BUILDS = (process.env.BUILDS || 'before,after').split(',');
const PRESETS = (process.env.PRESETS || 'balanced,high').split(',');
const MODES = (process.env.MODES || 'play,session').split(',');
const DIST = { before: process.env.DIST_BEFORE || 'file://' + ROOTR + '.tmp_tests/base/dist/index.html', after: 'file://' + ROOTR + 'dist/index.html' };
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const r1 = (x) => Math.round(x * 10) / 10;
const rec = {};
const save = () => { try { fs.writeFileSync(ROOTR + '.tmp_tests/walk_stipple.json', JSON.stringify(rec, null, 1)); } catch (e) { /* later */ } };
fs.mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });

// the page's walker: the ground under (x, z), the heading, a step of n frames (the last drawn and read when asked), the probe
const PAGE = `window.__W = (() => {
  const W = {};
  W.read = () => { const gl = VR.game.renderer.gl, w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(w * h * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let s = ''; const CH = 0x8000; for (let i = 0; i < px.length; i += CH) s += String.fromCharCode.apply(null, px.subarray(i, i + CH));
    return { png: btoa(s), W: w, H: h }; };
  const fl = (x, y, z) => { const g = VR.game, s = g.world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)); return s ? VR.R.T.flags[s] : 0; };
  W.ground = (x, z, y0) => { const F = VR.F; for (let y = Math.floor(y0); y > 20; y--) { const f = fl(x, y, z); if (f & F.FLUID) return -1; if ((f & F.OPAQUE) && !(f & F.LEAVES)) return y + 1; } return -1; };
  // the clearest heading over the next 90 m: open ground (no fluid), small climbs, nothing solid at the eye
  W.pick = (x, z, y0) => { let best = null; for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, dx = -Math.sin(a), dz = -Math.cos(a); let bad = 0, last = W.ground(x, z, y0 + 8); if (last < 0) last = y0;
      for (let t = 2; t <= 90; t += 2) { const gy = W.ground(x + dx * t, z + dz * t, last + 8); if (gy < 0) { bad += 4; continue; } bad += Math.max(0, Math.abs(gy - last) - 1); if (fl(x + dx * t, gy + 1.6, z + dz * t) & VR.F.SOLID) bad += 2; last = gy; }
      if (!best || bad < best.bad) best = { yaw: a, bad }; } return best; };
  W.frames = (n, draw, speed) => { const g = VR.game, p = g.player, dx = -Math.sin(p.yaw) * speed / 30, dz = -Math.cos(p.yaw) * speed / 30; let px = null;
    for (let i = 0; i < n; i++) { const last = i === n - 1; window.__norender = !(draw === 'all' || (draw === 'last' && last));
      p.pos[0] += dx; p.pos[2] += dz; const gy = W.ground(p.pos[0], p.pos[2], p.pos[1] + 6); if (gy > 0) p.pos[1] += (gy - p.pos[1]) * 0.35;
      p.vel = [0, 0, 0]; window.__vt += 33; g.last = window.__vt - 33; g.loop(window.__vt); if (last && draw !== 'none') px = W.read(); }
    window.__norender = true; return px; };
  // the probe: the screen tiles whose five rays meet solid ground 2–15 m from the eye
  W.probe = (T) => { const g = VR.game, p = g.player, r = g.renderer, cw = r.gl.drawingBufferWidth, ch = r.gl.drawingBufferHeight; const eye = [p.pos[0], p.pos[1] + 1.62, p.pos[2]];
    const yaw = p.yaw, pit = p.pitch, fy = Math.tan((g.settings.fov || 70) * Math.PI / 360), fx = fy * cw / ch;
    const f = [-Math.sin(yaw) * Math.cos(pit), Math.sin(pit), -Math.cos(yaw) * Math.cos(pit)], rt = [Math.cos(yaw), 0, -Math.sin(yaw)];
    const up = [rt[1] * f[2] - rt[2] * f[1], rt[2] * f[0] - rt[0] * f[2], rt[0] * f[1] - rt[1] * f[0]];
    const hit = (sx, sy) => { const nx = (sx / cw) * 2 - 1, ny = 1 - (sy / ch) * 2; const d = [0, 1, 2].map(i => f[i] + rt[i] * nx * fx + up[i] * ny * fy); const L = Math.hypot(d[0], d[1], d[2]);
      for (let t = 0.3; t <= 15.5; t += 0.1) { const x = eye[0] + d[0] / L * t, y = eye[1] + d[1] / L * t, z = eye[2] + d[2] / L * t, fl0 = fl(x, y, z); if (fl0 & VR.F.FLUID) return 0; if (fl0 & VR.F.SOLID) return t >= 2 && t <= 15 && !(fl0 & VR.F.LEAVES) ? t : 0; } return 0; };
    const out = []; for (let ty = 0; ty + T <= ch; ty += T) for (let tx = 0; tx + T <= cw; tx += T) { let ok = true; for (const [a, b] of [[0.5, 0.5], [0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9]]) if (!hit(tx + a * T, ty + b * T)) { ok = false; break; } if (ok) out.push([tx, ty]); } return out; };
  W.diag = () => { const g = VR.game, w = g.world, r = g.renderer, p = g.player, pcx = Math.floor(p.pos[0]) >> 4, pcz = Math.floor(p.pos[2]) >> 4; let unshown = 0, fading = 0;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) { const c = w.col(pcx + dx, pcz + dz); if (!c || c.shownAt < 0) unshown++; }
    for (const c of w.cols.values()) if (c.fade > 0 && c.fade < 1) fading++;
    return { unshown, fading, soft: !!r.fadeSoft, gap: Math.round(r.drawGap || 0) }; };
  return W; })();`;

async function run(build, preset) {
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, locale: 'de-DE' });
  const page = await ctx.newPage(), logs = [];
  page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 600)));
  page.on('crash', () => logs.push('[pageerror] the page crashed'));
  const ev = (fn, a) => page.evaluate(fn, a), wait = (ms) => page.waitForTimeout(ms);
  await page.goto(DIST[build]);
  for (let i = 0; i < 160; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title').catch(() => false)) break; }
  await ev((preset) => { const g = VR.game; g.applyPreset(preset); g.settings.dynRes = false; g.applySettings('*'); }, preset);
  await ev(() => VR.game.createWorld({ name: 'Walk', mode: 'creative', difficulty: 'peaceful', type: 'default', seed: 4242, cheats: true, kit: true }));
  for (let i = 0; i < 240; i++) { await wait(1000); if (await ev(() => VR.game.state).catch(() => '') === 'play') break; }
  await ev((PAGE) => {
    const g = VR.game; g.zenFreezeTime = true; g.zenFreezeWeather = true; g.env.setTime(6000);
    if (g.env.wx && g.env.wx.force) g.env.wx.force('klar'); g.env.rain = 0; g.env.rainTarget = 0;
    g.settings.wowMoments = false; if (g.arrival && g.arrival.skip) { try { g.arrival.skip(); } catch (e) { /* none */ } }
    window.requestAnimationFrame = () => 0; g.hideHud = true;
    for (const id of ['hud', 'ui', 'hints']) { const h = document.getElementById(id); if (h) h.style.display = 'none'; }
    const real = performance.now.bind(performance); window.__vt = null; performance.now = () => (window.__vt === null ? real() : window.__vt);
    const r = g.renderer; if (!r._render) { r._render = r.render; r.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; }
    window.__norender = true; (0, eval)(PAGE);
  }, PAGE);
  // the ground ahead loaded and meshed (as session.mjs: columns within 4 chunks, sections within 2)
  const ready = () => ev(() => { const g = VR.game, w = g.world, p = g.player, pcx = Math.floor(p.pos[0]) >> 4, pcz = Math.floor(p.pos[2]) >> 4; let miss = 0, dirty = 0;
    for (let dz = -6; dz <= 6; dz++) for (let dx = -6; dx <= 6; dx++) { const d2 = dx * dx + dz * dz; if (d2 > 36) continue; const c = w.col(pcx + dx, pcz + dz); if (!c) { miss++; continue; } if (d2 <= 4) for (const s of c.sec) if (s && (s.dirty || s.pending)) dirty++; }
    try { w.update(p.pos[0], p.pos[1], p.pos[2], performance.now()); } catch (e) { /* next */ } return { miss, dirty }; });
  const settle = async (maxS) => { const t = Date.now(); let s; while (Date.now() - t < maxS * 1000) { await ev(() => window.__W.frames(5, 'none', 0)); s = await ready(); if (!s.miss && !s.dirty) break; await wait(80); } return s; };
  const out = { build, preset, modes: {} };
  for (const mode of MODES) {
    // the start: the spawn (session's place), then the clearest heading
    await ev(() => { const g = VR.game, p = g.player; if (!window.__start) window.__start = p.pos.slice(0, 3); const sp = window.__start; p.flying = true; p.noclip = true; window.__vt = performance.now(); p.teleport(sp[0], sp[1] + 4, sp[2]); p.pitch = -0.12; p.fovKick = 0; });
    await settle(150);
    const head = await ev(() => { const p = VR.game.player, b = window.__W.pick(p.pos[0], p.pos[2], p.pos[1]); p.yaw = b.yaw; p.viewYaw = b.yaw; const gy = window.__W.ground(p.pos[0], p.pos[2], p.pos[1] + 8); if (gy > 0) p.pos[1] = gy; return b; });
    await settle(150);
    await ev(() => window.__W.frames(10, 'all', 0));   // the TSR's history on the still scene
    const shots = [];
    for (let k = 0; k < N; k++) {
      if (mode === 'session') await settle(20);   // (session.mjs: the world ahead before every half second)
      const px = await ev((mode) => window.__W.frames(mode === 'play' ? 12 : 15, mode === 'play' ? 'all' : 'last', 6), mode);
      const probe = await ev((T) => window.__W.probe(T), TILE), dg = await ev(() => window.__W.diag());
      const pic = `${SHOTS}walk_${build}_${preset}_${mode}_${String(k + 1).padStart(2, '0')}.png`;
      const img = sharp(Buffer.from(px.png, 'base64'), { raw: { width: px.W, height: px.H, channels: 4 } }).flip().removeAlpha();
      await img.clone().png().toFile(pic);
      const { data, info } = await img.clone().raw().toBuffer({ resolveWithObject: true });
      const L = new Float32Array(info.width * info.height); for (let i = 0; i < L.length; i++) L[i] = 0.2126 * data[i * 3] + 0.7152 * data[i * 3 + 1] + 0.0722 * data[i * 3 + 2];
      const sx = info.width / px.W, sy = info.height / px.H;
      let flat = 0; const es = [];
      for (const [tx, ty] of probe) { const e = TE.energy(L, info.width, info.height, tx * sx, ty * sy, (tx + TILE) * sx, (ty + TILE) * sy); es.push(e); if (e < TE.FLAT) flat++; }
      const m = await measure(pic);
      es.sort((a, b) => a - b);
      shots.push({ k: k + 1, stipple: r1(m.share * 100), ground: probe.length, flat, eMed: es.length ? r1(es[es.length >> 1]) : null, ...dg });
      console.log(`  ${build} ${preset} ${mode} ${k + 1}: ${r1(m.share * 100)} % · ground tiles ${probe.length}, flat ${flat}, energy med ${es.length ? r1(es[es.length >> 1]) : '—'} · ${JSON.stringify(dg)} (${secs()})`);
    }
    const st = shots.map(s => s.stipple).sort((a, b) => a - b);
    out.modes[mode] = { head, shots, under1: shots.filter(s => s.stipple < 1).length, median: st[st.length >> 1], worst: st[st.length - 1], flatFrames: shots.filter(s => s.flat > 1).length };
    console.log(`  == ${build} ${preset} ${mode}: < 1 % on ${out.modes[mode].under1}/${N}, median ${out.modes[mode].median} %, worst ${out.modes[mode].worst} %, frames with flat ground ${out.modes[mode].flatFrames}`);
    rec[`${build}_${preset}`] = out; save();
  }
  out.errors = logs.filter(l => /pageerror/.test(l));
  await ctx.close();
  return out;
}

for (const build of BUILDS) for (const preset of PRESETS) {
  let o; try { o = await run(build, preset); } catch (e) { console.log(`  !! ${build} ${preset}: ${String(e && e.message || e).slice(0, 300)}`); if (build === 'after') fails++; continue; }
  rec[`${build}_${preset}`] = o; save();
  if (build === 'after') {
    for (const mode of MODES) { const m = o.modes[mode]; if (!m) continue;
      check(m.under1 >= 22, `${preset} ${mode}: stipple < 1 % on ${m.under1} of ${N} walking frames (median ${m.median} %, worst ${m.worst} %)`);
      check(m.flatFrames === 0, `${preset} ${mode}: no frame with flat ground 2–15 m ahead (${m.flatFrames} frames with > 1 flat tile)`); }
    check(!o.errors.length, `${preset}: no page error` + (o.errors.length ? ': ' + o.errors[0] : ''));
  }
}
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
