// regress: skip — f-stipple's pictures (review R50-08 the screen-door, R50-12 the Very Low hall lamp): walks and still
// frames on this build, each picture measured by test/stipple.js (the share of the frame in a coherent 2-px checker).
//   cherry   Balanced, seed 53: arriving at the cherry grove (−150, 316) and walking 40 blocks through it (the walk's
//            clock: 33 ms a frame, so the 300 ms fades span nine frames as at 30 fps) · cherry_high the same on High
//   meadow   Balanced: a walk over the meadow east of the temple (240, −120)
//   pond     Balanced: the nearest lily pond's mirror, settled
//   palms    Balanced, seed 4242: Palm City's fork at the golden hour (trailer_city.mjs's F1), arriving and walking
//   hall     Very Low, seed 53: the hall street (critic_vl.mjs's pose); the nearest lamp's lantern: its brightest tenth's
//            luma inside its projected box (≥ 60 wanted, R50-12), and the lamp's section's near/far state
// pictures test/shots/stipple_<scene>_<TAG>_<k>.png · numbers .tmp_tests/stipple_<TAG>.json
// usage: TAG=before nohup bash test/wt_run.sh stipple.mjs 3600 > .tmp_tests/stipple.log 2>&1 &   (ONLY=cherry,hall)
// Checks (TAG=after): the walking frames (cherry, cherry_high) < 1 % stippled; the hall lantern ≥ 60; no page error.
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import { createRequire } from 'module';
const ROOT = new URL('../', import.meta.url).pathname.replace(/\.tmp_tests\/$/, '');
const require = createRequire(import.meta.url);
const ROOTR = fs.existsSync(ROOT + 'test/stipple.js') ? ROOT : new URL('../', import.meta.url).pathname;
const { measure } = require(ROOTR + 'test/stipple.js');
const SHOTS = ROOTR + 'test/shots/';
const DIST = process.env.DIST || 'file://' + ROOTR + 'dist/index.html';
const TAG = process.env.TAG || 'after';
const VW = +(process.env.W || 960), VH = +(process.env.H || 540);
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const want = (n) => !ONLY || ONLY.includes(n);
const EYE = 1.62;
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const r1 = (x) => Math.round(x * 10) / 10;
const rec = { tag: TAG, size: [VW, VH], scenes: {} };
const save = () => { try { fs.mkdirSync(ROOTR + '.tmp_tests', { recursive: true }); fs.writeFileSync(ROOTR + `.tmp_tests/stipple_${TAG}.json`, JSON.stringify(rec, null, 1)); } catch (e) { /* later */ } };
fs.mkdirSync(SHOTS, { recursive: true });
const ROT = [(u, v) => [u, v], (u, v) => [-v, u], (u, v) => [-u, -v], (u, v) => [v, -u]];
const aimAt = (x, y, z, at) => { const dx = at[0] - x, dy = at[1] - y, dz = at[2] - z; return [Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz))]; };
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });

// ---------------------------------------------------------------- a page with a world (critic_vl.mjs's openWorld, the preset and the seed as arguments)
async function openWorld(dist, tag, preset, seed) {
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, locale: 'de-DE' });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail|missing|incomplete/i.test(s)) logs.push(`[${t}] ${s.slice(0, 600)}`); });
  page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
  page.on('crash', () => { logs.push('[pageerror] the page crashed'); console.log(`  !! ${tag}: the page crashed`); });
  await page.goto(dist);
  const wait = (ms) => page.waitForTimeout(ms);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  for (let i = 0; i < 160; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title').catch(() => false)) break; }
  await ev(() => {
    const r = VR.game.renderer, gl = r.gl;
    window.__px = new Uint8Array(4);
    window.__sync = () => { const d = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING), rd = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, window.__px); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, d); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, rd); };
    if (!r._render) { r._render = r.render; r.render = function (F) { if (window.__norender) { window.__F = F; this.setupCamera(F.cam); return; } return this._render(F); }; }
  });
  const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(4); } };
  const boost = (on) => ev((on) => { const q = VR.game.renderer && VR.game.renderer.q; if (!q) return; if (on) { if (q.__up === undefined) q.__up = q.upload; q.upload = 24; } else if (q.__up !== undefined) { q.upload = q.__up; delete q.__up; } }, on);
  const holdFar = (on) => ev((on) => { const pool = VR.game.pool; if (!pool || !pool.queueFar) return 0; if (on) pool.__heldFar = (pool.__heldFar || []).concat(pool.queueFar.splice(0)); else if (pool.__heldFar) { for (const j of pool.__heldFar) pool.queueFar.push(j); pool.__heldFar = null; pool.queueDirty = true; if (pool.pump) pool.pump(); } return 0; }, on);
  const settle = async (maxS, farS = 0) => {
    let s = null, last = Infinity, stall = 0, nearAt = -1; const t0 = Date.now();
    await boost(true);
    for (let i = 0; ; i++) {
      await step(10);
      s = await ev(() => { const g = VR.game, w = g.world, p = g.player, rd = Math.max(1, (w.renderDist | 0) - 1), ri = Math.max(1, rd - 2), pcx = Math.floor(p.pos[0]) >> 4, pcz = Math.floor(p.pos[2]) >> 4; let dirty = 0; for (const c of w.cols.values()) { let n = 0; for (const sc of c.sec) if ((sc.dirty || sc.pending) && sc.count > 0) n++; const ex = c.cx - pcx, ez = c.cz - pcz; if (n && ex * ex + ez * ez <= ri * ri) dirty += n; } let unshown = 0; for (let dz = -rd; dz <= rd; dz++) for (let dx = -rd; dx <= rd; dx++) { if (dx * dx + dz * dz > rd * rd) continue; const c = w.col(pcx + dx, pcz + dz); if (!c || !(c.shownAt >= 0)) unshown++; } const h = g.horizon, f = h && h.far, fr = f && f.report ? f.report() : null; return { busy: g.pool.busy, pend: w.pending.size, dirty, up: w.uploadQ ? w.uploadQ.size : 0, fading: w.fading ? w.fading.size : 0, unshown, arr: w.arrivals ? w.arrivals.length : 0, hz: h ? h.inflight : 0, far: fr ? fr.inflight + fr.want : 0 }; });
      const shown = s.pend === 0 && s.up === 0 && s.fading === 0 && s.unshown === 0 && s.arr === 0;
      stall = shown && s.dirty >= last ? stall + 1 : 0; last = s.dirty;
      const near = shown && ((s.busy === 0 && s.dirty === 0) || stall >= 6), el = (Date.now() - t0) / 1000;
      s.i = i; s.s = Math.round(el);
      if (near && i > 2) { if (nearAt < 0) nearAt = el; if (!farS || (s.hz === 0 && s.far === 0) || el - nearAt >= farS) break; }
      if (el >= maxS) break;
      await wait(60);
    }
    await boost(false);
    s.near = nearAt < 0 ? -1 : Math.round(nearAt);
    return s;
  };
  const warmVx = () => ev(() => {
    const g = VR.game, r = g.renderer, p = g.player; if (!r.vxResidency || !g.world) return -1;
    const Q = g.world.uploadQ && g.world.uploadQ.drain ? g.world.uploadQ : null, queued = !!(r.queueVx && Q);
    if (queued) r.upQ = Q;
    const cam = [p.pos[0], p.pos[1] + (p.eye || 1.62), p.pos[2]], list = [];
    for (const c of g.world.cols.values()) for (const s of c.sec) if (s && s.hasMesh) list.push(s);
    const D = (r.q && r.q.vxLod) || 48, up2 = D * D; let n = 0;
    for (; n < 600; n++) { let w8 = 0; for (const s of list) { if (!s.vxData || s.mesh[3]) continue; const dx = s.ox + 8 - cam[0], dy = s.oy + 8 - cam[1], dz = s.oz + 8 - cam[2]; if (dx * dx + dy * dy * 0.5 + dz * dz < up2) w8++; } if (!w8) break; r.vxResidency(list, cam); if (queued) Q.drain(1e6, null, 0, 0); }
    return n;
  });
  // the highest standing block below y0 (an isle's top: from 210 down; the land: from 200 down), leaves skipped
  const groundY = (x, z, y0 = 200) => ev(([x, z, y0]) => { const w = VR.game.world, R = VR.R, F = VR.F; for (let y = y0; y > 30; y--) { const s = w.getBlock(Math.floor(x), y, Math.floor(z)); if (s && (R.T.flags[s] & (F.OPAQUE | F.FLUID)) && !(R.T.flags[s] & F.LEAVES)) return y; } return 80; }, [x, z, y0]);
  const clearEye = (x, y, z, yaw, pitch, need) => ev(([x, y, z, yaw, pitch, need]) => {
    const w = VR.game.world, R = VR.R, F = VR.F;
    const fl = (x, y, z) => { const s = w.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)); return s ? R.T.flags[s] : 0; };
    const cp = Math.cos(pitch), dx = -Math.sin(yaw) * cp, dy = Math.sin(pitch), dz = -Math.cos(yaw) * cp, hx = Math.hypot(dx, dz) || 1;
    const box = (x, y, z) => { for (const b of [-0.6, 0, 0.9]) for (let a = -1; a <= 1; a++) for (let c = -1; c <= 1; c++) if (fl(x + a * 0.9, y + b, z + c * 0.9) & F.SOLID) return false; return true; };
    const ray = (x, y, z) => { for (let t = 0.5; t <= need; t += 0.25) if (fl(x + dx * t, y + dy * t, z + dz * t) & (t <= 2.5 ? F.SOLID : F.OPAQUE | F.LEAVES)) return false; return true; };
    for (let back = 0; back <= 12; back += 2) { const bx = x - dx / hx * back, bz = z - dz / hx * back; for (let up = 0; up <= 24; up++) if (box(bx, y + up, bz) && ray(bx, y + up, bz)) return { x: bx, y: y + up, z: bz, up, back }; }
    return { x, y, z, up: 0, back: 0, stuck: true };
  }, [x, y, z, yaw, pitch, need]);
  const pose = (x, feet, z, yaw, pitch, fov) => ev(([x, y, z, yaw, pitch, fov]) => { const g = VR.game, p = g.player; p.flying = true; p.noclip = true; p.teleport(x, y, z); p.yaw = yaw; p.pitch = pitch; p.viewYaw = yaw; p.fovKick = 0; p.vel = [0, 0, 0]; g.settings.fov = fov; g.env.setTime(6000); const e = g.entities; if (e && e.mobs) e.mobs.length = 0; }, [x, feet, z, yaw, pitch, fov]);
  // the world: Very Low as a player gets it (its own view distance), the dynamic resolution off; a new default world
  const t0 = Date.now();
  await ev((preset) => { const g = VR.game; g.applyPreset(preset); g.settings.dynRes = false; g.applySettings('*'); }, preset);
  await ev((seed) => VR.game.createWorld({ name: 'Stipple', mode: 'creative', difficulty: 'peaceful', type: 'default', seed, cheats: true, kit: true }), seed);
  for (let i = 0; i < 240; i++) { await wait(1000); if (await ev(() => VR.game.state).catch(() => '') === 'play') break; }
  const ok = await ev(() => VR.game.state) === 'play';
  const loadS = (Date.now() - t0) / 1000;
  await ev(() => {
    const g = VR.game; g.zenFreezeTime = true; g.zenFreezeWeather = true;
    if (g.env.wx && g.env.wx.force) g.env.wx.force('klar'); g.env.rain = 0; g.env.rainTarget = 0;
    g.settings.wowMoments = false; if (g.arrival && g.arrival.skip) { try { g.arrival.skip(); } catch (e) { /* none */ } }
    window.requestAnimationFrame = () => 0; g.hideHud = true;
    const real = performance.now.bind(performance); window.__vt = null; performance.now = () => (window.__vt === null ? real() : window.__vt);   // (the walk's clock: 33 ms a frame)
    for (const id of ['hud', 'ui', 'hints']) { const h = document.getElementById(id); if (h) h.style.display = 'none'; }
  });
  const info = await ev(() => { const g = VR.game; return { vgen: g.meta && g.meta.vgen, preset: g.settings.preset, rd: g.settings.renderDist, scale: g.settings.scale, dynRes: g.settings.dynRes }; });
  return { tag, ctx, page, logs, ev, wait, step, settle, holdFar, warmVx, groundY, clearEye, pose, ok, loadS, info };
}

// ---------------------------------------------------------------- frames
// n frames drawn on the walk's clock (33 ms each), the player moved along a → b (eye above the ground), a picture every
// `every` frames; each picture: its stipple share and the streaming state at that moment
async function walk(P, scene, a, b, n, every, tod) {
  const out = { shots: [] };
  await P.ev(() => { window.__vt = performance.now(); window.__norender = false; });
  let k = 0;
  for (let f = 0; f <= n; f++) {
    const u = n ? f / n : 0;
    const st = await P.ev(([x, z, yaw, tod, shot]) => {
      const g = VR.game, p = g.player, w = g.world, R = VR.R, F = VR.F;
      let y = p.pos[1];
      for (let yy = 200; yy > 30; yy--) { const s = w.getBlock(Math.floor(x), yy, Math.floor(z)); if (s && (R.T.flags[s] & (F.OPAQUE | F.FLUID)) && !(R.T.flags[s] & F.LEAVES)) { y = yy + 1; break; } }
      p.flying = true; p.noclip = true; p.pos[0] = x; p.pos[2] = z; p.pos[1] = y; p.vel = [0, 0, 0]; p.yaw = yaw; p.viewYaw = yaw; p.pitch = -0.04;
      if (tod !== null) g.env.setTime(tod);
      window.__vt += 33; g.last = window.__vt - 33; g.loop(window.__vt);
      if (!shot) return null;
      g.renderer.gl.finish();
      let part = 0; for (const c of w.cols.values()) for (const s of c.sec) if (s && s.hasMesh && s.fade > 0 && s.fade < 1) part++;
      const fr = g.horizon && g.horizon.far;
      return { fadingCols: w.fading.size, partSecs: part, farFading: fr ? fr.fading.length : null, pend: w.pending ? w.pending.size : null };
    }, [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, Math.atan2(-(b[0] - a[0]), -(b[1] - a[1])), tod === undefined ? null : tod, f % every === 0]);
    if (st) {
      const pic = `${SHOTS}stipple_${scene}_${TAG}_${k++}.png`;
      await P.page.screenshot({ path: pic, timeout: 180000 });
      const m = await measure(pic);
      st.share = r1(m.share * 100); st.f = f; st.pic = pic.replace(ROOTR, '');
      out.shots.push(st);
      console.log(`  ${scene} f${f}: ${st.share} % stippled · fading columns ${st.fadingCols}, sections mid-fade ${st.partSecs}, far forms fading ${st.farFading} (${secs()})`);
    }
  }
  await P.ev(() => { window.__vt = null; window.__norender = true; });
  out.max = Math.max(...out.shots.map(s => s.share)); out.mean = r1(out.shots.reduce((t, s) => t + s.share, 0) / out.shots.length);
  return out;
}
const arrive = async (P, x, z) => { await P.ev(([x, z]) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(x, 160, z); }, [x, z]); };
const still = async (P, scene, x, feet, z, yaw, pitch, fov, tod) => {
  await P.pose(x, feet, z, yaw, pitch, fov); if (tod !== undefined) await P.ev((t) => VR.game.env.setTime(t), tod);
  await P.settle(240, 20); await P.step(4); await P.warmVx(); await P.step(3);
  await P.ev((t) => { window.__norender = false; const g = VR.game; if (t !== undefined) g.env.setTime(t); for (let i = 0; i < 8; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); }, tod);
  const pic = `${SHOTS}stipple_${scene}_${TAG}_0.png`;
  await P.page.screenshot({ path: pic, timeout: 180000 });
  await P.ev(() => { window.__norender = true; });
  const m = await measure(pic);
  console.log(`  ${scene}: ${r1(m.share * 100)} % stippled (${secs()})`);
  return { share: r1(m.share * 100), pic: pic.replace(ROOTR, '') };
};

// ---------------------------------------------------------------- run: seed 53 (Balanced, High, Very Low), seed 4242
const errsOf = (P) => P.logs.filter(l => l.startsWith('[pageerror]'));
const A = await openWorld(DIST, TAG, 'balanced', '53');
console.log(`world 53: ${A.ok ? 'play' : 'NOT PLAYING'} in ${r1(A.loadS)} s ${JSON.stringify(A.info)}`);
const grove = async (scene) => {
  await arrive(A, -150, 316); await A.step(20);
  rec.scenes[scene] = await walk(A, scene, [-150, 316], [-110, 330], 240, 30, 6000); save();
};
if (want('cherry')) await grove('cherry');
if (want('meadow')) { await arrive(A, 220, -120); await A.step(20); rec.scenes.meadow = await walk(A, 'meadow', [220, -120], [260, -112], 150, 50, 7000); save(); }
if (want('pond')) {
  const P0 = { x: -232, y: 80, z: -182 };   // the nearest lily pond of seed 53 (vgen 12, the land plan)
  await arrive(A, P0.x + 9, P0.z + 2); await A.holdFar(true); await A.settle(240, 0); await A.holdFar(false);
  const gy = await A.groundY(P0.x + 9, P0.z + 2);
  const [yaw, pitch] = aimAt(P0.x + 9, gy + 1 + EYE, P0.z + 2, [P0.x - 4, P0.y, P0.z]);
  rec.scenes.pond = await still(A, 'pond', P0.x + 9, gy + 1, P0.z + 2, yaw, pitch, 66, 7000); save();
}
if (want('cherry_high')) {
  await A.ev(() => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.applySettings('*'); });
  await grove('cherry_high');
}
if (want('hall')) {
  await A.ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.dynRes = false; g.applySettings('*'); });
  const site0 = await A.ev(() => { try { const W = VR.game.world, VG = VR.VillageGen, og = new VR.OverworldGen(W.seed, W.genOpts); const s = VG.site(og, -2, -1); if (!s) return null; const Pl = VG.plan(og, s), h = Pl.hall || null; window.__lamps = Pl.lamps || []; return h ? { x: s.x, z: s.z, r: h.r, F: h.F } : { x: s.x, z: s.z, r: (s.seed >>> 3) & 3, F: s.y }; } catch (e) { return { err: String(e.message || e) }; } });
  const site = site0 && !site0.err ? site0 : { x: -944, z: -296, r: 3, F: 73 };
  const q = ROT[site.r](0.5, -24.5), t = ROT[site.r](0.5, 40);
  const x = site.x + q[0], z = site.z + q[1], feet = site.F + 1, at = [site.x + t[0], site.F + 1 + 8, site.z + t[1]];
  await arrive(A, x, z); await A.holdFar(true); await A.settle(240, 0); await A.holdFar(false);
  const [yaw, pitch] = aimAt(x, feet + EYE, z, at);
  const h = await still(A, 'hall', x, feet, z, yaw, pitch, 66, 6000);
  // the nearest lamp in view: its lantern's box on the screen (the head, y F+3 … F+5), the section's state
  const L = await A.ev(([VW, VH]) => {
    const g = VR.game, r = g.renderer, p = g.player, M = r.viewProj, ex = p.pos[0], ey = p.pos[1] + (p.eye || 1.62), ez = p.pos[2];
    const proj = (x, y, z) => { const X = x - ex, Y = y - ey, Z = z - ez, w = M[3] * X + M[7] * Y + M[11] * Z + M[15]; if (w <= 0.05) return null; return [((M[0] * X + M[4] * Y + M[8] * Z + M[12]) / w * 0.5 + 0.5) * VW, (1 - ((M[1] * X + M[5] * Y + M[9] * Z + M[13]) / w * 0.5 + 0.5)) * VH]; };
    let best = null;
    for (const l of window.__lamps || []) {
      const d = Math.hypot(l[0] + 0.5 - ex, l[2] + 0.5 - ez); if (d > 14) continue;
      const pts = []; for (const dx of [0, 1]) for (const dy of [-1, 1.2]) for (const dz of [0, 1]) { const s = proj(l[0] + dx, l[1] + dy, l[2] + dz); if (s) pts.push(s); }
      if (pts.length < 8) continue;
      const box = [Math.min(...pts.map(s => s[0])), Math.min(...pts.map(s => s[1])), Math.max(...pts.map(s => s[0])), Math.max(...pts.map(s => s[1]))];
      if (box[2] < 0 || box[0] > VW || box[3] < 0 || box[1] > VH) continue;
      if (!best || d < best.d) best = { d, lamp: l, box: box.map(Math.round) };
    }
    if (!best) return { err: 'no lamp in view', n: (window.__lamps || []).length };
    const w = g.world, l = best.lamp, c = w.cols.get((l[0] >> 4) + ',' + (l[2] >> 4)), s = c && c.sec[l[1] >> 4];
    if (s) { const dx = s.ox + 8 - ex, dy = s.oy + 8 - ey, dz = s.oz + 8 - ez; best.sec = { centre: Math.round(Math.sqrt(dx * dx + dy * dy * 0.5 + dz * dz) * 10) / 10, vxLod: r.q.vxLod, near: !!s.mesh[3], far: !!s.mesh[4], vxData: !!s.vxData }; }
    return best;
  }, [VW, VH]);
  if (L && L.box) {
    const sharp = require('/home/dev/.npm-global/lib/node_modules/sharp');
    const bx = Math.max(0, L.box[0]), by = Math.max(0, L.box[1]), bw = Math.max(2, Math.min(VW, L.box[2]) - bx), bh = Math.max(2, Math.min(VH, L.box[3]) - by);
    const { data, info } = await sharp(ROOTR + h.pic).extract({ left: bx, top: by, width: bw, height: bh }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const lum = []; for (let i = 0; i < info.width * info.height; i++) lum.push(0.2126 * data[i * 3] + 0.7152 * data[i * 3 + 1] + 0.0722 * data[i * 3 + 2]);
    lum.sort((a, b) => b - a); const top = lum.slice(0, Math.max(1, lum.length / 10 | 0));
    L.luma = Math.round(top.reduce((t, v) => t + v, 0) / top.length);
    await sharp(ROOTR + h.pic).extract({ left: bx, top: by, width: bw, height: bh }).resize({ width: bw * 3, kernel: 'nearest' }).toFile(`${SHOTS}stipple_hall_${TAG}_lamp.png`);
  }
  h.lamp = L; rec.scenes.hall = h; save();
  console.log('  hall lamp: ' + JSON.stringify(L));
}
const errsA = errsOf(A); await A.ctx.close();
let errsB = [];
if (want('palms')) {
  const B = await openWorld(DIST, TAG, 'balanced', '4242');
  console.log(`world 4242: ${B.ok ? 'play' : 'NOT PLAYING'} in ${r1(B.loadS)} s`);
  await arrive(B, 3.5, -96.5); await B.step(20);
  // the fork, looking yaw 0.3 (trailer_city.mjs's F1): a walk toward it at the golden hour (13000)
  const yaw = 0.3, dx = -Math.sin(yaw), dz = -Math.cos(yaw);
  rec.scenes.palms = await walk(B, 'palms', [3.5 - dx * 20, -96.5 - dz * 20], [3.5, -96.5], 150, 50, 13000); save();
  errsB = errsOf(B); await B.ctx.close();
}
await browser.close();
console.log('\n' + JSON.stringify(Object.fromEntries(Object.entries(rec.scenes).map(([k, v]) => [k, v.max !== undefined ? { max: v.max, mean: v.mean } : { share: v.share, lamp: v.lamp && v.lamp.luma }]))));
check(!errsA.length && !errsB.length, 'no page error' + (errsA.length || errsB.length ? ': ' + errsA.concat(errsB).slice(0, 2).join(' | ').slice(0, 500) : ''));
if (TAG !== 'before') {
  for (const s of ['cherry', 'cherry_high']) if (rec.scenes[s]) check(rec.scenes[s].max < 1, `${s}: every walking frame < 1 % stippled (max ${rec.scenes[s].max} %)`);
  if (rec.scenes.hall) check(rec.scenes.hall.lamp && rec.scenes.hall.lamp.luma >= 60, `hall (Very Low): the lamp's lantern lit, its brightest tenth ≥ 60 luma (${rec.scenes.hall.lamp && rec.scenes.hall.lamp.luma})`);
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
