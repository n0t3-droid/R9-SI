// u-ascent · ground → sky → orbit → back in the browser (docs/superpowers/plans/2026-10-22-u-ascent.md §4): a shuttle on
// the Gate Temple's apron of a new default world (seed 53, creative), 1280 × 720, de-DE; High first, then Very Low.
//   pictures  test/shots/ascent_<alt>_<high|vl>.png — the climb every 300 m from 300 to 2,400 m (High: the chase view
//             behind the ship looking ahead over the land to the horizon and Amarant; Very Low and ascent_<alt>_cockpit_
//             high.png: the cockpit's forward view); ascent_handoff_climb / _space (2,490 m in the climb, 2,515 m the
//             first seconds of the space frame); ascent_orbit_day / _night (3 km up, the chase view along the way);
//             ascent_reentry (the plasma, the screen's overlay laid over); ascent_land (the place the entry put the ship
//             down, ~100 km east of the Heartland, at its own local time); ascent_jump_mid / _opal (the Reisesprung to Opal,
//             half way and arrived); ascent_plaza_<tag> (the plaza frame the costs compare with); the sheet
//             test/shots/ascent_sheet.jpg
//   numbers   the frame times through the hand-off (rendered, synced: no frame over 2× the median); Very Low's climb frame
//             (1,500 m) against the plaza frame on the same page (rounds in turns, the medians: not dearer); the regimes
//             as they come; the entry's glow, its landing place and that place's local time; no page error
//   before/after (BASE_DIST = v0.49's dist/index.html, built from 0d0144b in .tmp_tests/base0d0): the ground frame (the
//             plaza) on each preset in the base build first (ascent_plaza_base_<tag>.png), then in this one — the same
//             picture (mean |Δ| and the share of pixels off by more than 24 levels; birds and motes move) and its cost
// → .tmp_tests/ascent_run.json.   usage: BASE_DIST=… nohup bash test/wt_run.sh ascent.mjs 5400 > .tmp_tests/ascent.log 2>&1 &
//   PRESETS=high,potato · ONLY=climb,handoff,orbit,jump,entry · SEED=53 · RD=8 · ROUNDS=3 · K=3 (frames a picture)
// regress: skip  (a showcase: the pictures are the evidence; the gates are test/ascent.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import sharp from '/home/dev/.npm-global/lib/node_modules/sharp/lib/index.js';
import fs from 'fs';
import { execSync, execFileSync } from 'child_process';
const ROOT = new URL('../', import.meta.url).pathname;   // this checkout (the test runs from test/ or from .tmp_tests/)
const DIST = process.env.DIST || 'file://' + ROOT + 'dist/index.html';
const SHOTS = ROOT + 'test/shots/';
const BASE = process.env.BASE_DIST || (fs.existsSync(ROOT + '.tmp_tests/base0d0/dist/index.html') ? 'file://' + ROOT + '.tmp_tests/base0d0/dist/index.html' : '');
const SEED = process.env.SEED || '53', RD = +(process.env.RD || 8), ROUNDS = +(process.env.ROUNDS || 3), K = +(process.env.K || 3);
const PRESETS = (process.env.PRESETS || 'high,potato').split(',');
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const want = (s) => !ONLY || ONLY.includes(s);
const TAGP = { high: 'high', potato: 'vl' }, NAMEP = { high: 'High', potato: 'Very Low' };
const ALTS = [300, 600, 900, 1200, 1500, 1800, 2100, 2400];
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const r1 = (x) => Math.round(x * 10) / 10;
const med = (a) => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1]; };
const rec = { dist: DIST, seed: SEED, presets: {} };
const save = () => { try { fs.writeFileSync(ROOT + '.tmp_tests/ascent_run.json', JSON.stringify(rec, null, 1)); } catch (e) { /* a convenience */ } };
fs.mkdirSync(SHOTS, { recursive: true });
const spread = async (path) => {
  const { data, info } = await sharp(path).raw().toBuffer({ resolveWithObject: true });
  const C = info.channels; let s = 0, s2 = 0, n = 0;
  for (let i = 0; i < data.length; i += C * 7) { const L = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]; s += L; s2 += L * L; n++; }
  const m = s / n; return { mean: r1(m), sd: r1(Math.sqrt(Math.max(0, s2 / n - m * m))) };
};

// two pictures of the same view: the mean |Δ| (0–255, over r g b) and the share of pixels off by more than 24 levels
const pixDiff = async (a, b) => {
  const A = await sharp(a).raw().toBuffer({ resolveWithObject: true }), B = await sharp(b).raw().toBuffer({ resolveWithObject: true });
  if (A.info.width !== B.info.width || A.info.height !== B.info.height) return { mean: 255, big: 1 };
  const C = A.info.channels; let s = 0, big = 0, n = 0;
  for (let i = 0; i < A.data.length; i += C) { const d0 = Math.abs(A.data[i] - B.data[i]), d1 = Math.abs(A.data[i + 1] - B.data[i + 1]), d2 = Math.abs(A.data[i + 2] - B.data[i + 2]); s += d0 + d1 + d2; if (Math.max(d0, d1, d2) > 24) big++; n++; }
  return { mean: Math.round(s / n / 3 * 100) / 100, big: Math.round(big / n * 10000) / 10000 };
};

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
  const m = await P.ev(([key, k, overlay]) => {
    const g = VR.game, r = g.renderer, gl = r.gl, F = window[key];
    if (!F) return { err: 'no frame kept' };
    window.__norender = false;
    r.frameNo = 1000; r.tsrReset = true; r.shadowValid = false;
    try { for (let i = 0; i < k; i++) r.render(F); } catch (e) { window.__norender = true; return { err: String(e && e.stack || e).slice(0, 600) }; }
    const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, px = new Uint8Array(W * H * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let s = ''; const CH = 0x8000; for (let i = 0; i < px.length; i += CH) s += String.fromCharCode.apply(null, px.subarray(i, i + CH));
    window.__norender = true;
    let ov = null; const fx = document.getElementById('ascFx'); if (overlay && fx && fx.style.display !== 'none') ov = fx.toDataURL('image/png');
    return { png: btoa(s), W, H, draws: r.stats.draws, tris: Math.round(r.stats.tris), ov };
  }, [key, k, !!overlay]);
  if (m.err) return m;
  let img = sharp(Buffer.from(m.png, 'base64'), { raw: { width: m.W, height: m.H, channels: 4 } }).flip().removeAlpha();
  if (m.ov) {
    const base = await img.png().toBuffer(), ov = await sharp(Buffer.from(m.ov.split(',')[1], 'base64')).resize(m.W, m.H).png().toBuffer();
    img = sharp(base).composite([{ input: ov, blend: 'over' }]);
    m.overlay = true;
  }
  await img.png().toFile(path);
  delete m.png; delete m.ov;
  return m;
};
const cost = async (P, key, k, n) => {
  await P.ev(([key, k]) => { const r = VR.game.renderer, F = window[key]; window.__norender = false; r.frameNo = 1000; r.tsrReset = true; r.shadowValid = false; for (let i = 0; i < k; i++) r.render(F); window.__sync(); window.__norender = true; }, [key, k]);
  const c0 = cpuNow();
  const wall = await P.ev(([key, n]) => { const r = VR.game.renderer, F = window[key], out = []; window.__norender = false; for (let i = 0; i < n; i++) { const t0 = performance.now(); r.render(F); window.__sync(); out.push(performance.now() - t0); } window.__norender = true; return out; }, [key, n]);
  return { cpuMs: (cpuNow() - c0) / n, wallMs: med(wall) };
};
// the ship's state, the space scene's textures
const st = (P) => P.ev(() => VR.SpaceFlight.debug.state(VR.game));
const spaceReady = (P) => P.ev(() => { const need = VR.SpaceScene.cur_need || []; return { done: need.filter(s => s.done).length, need: need.length }; });
// step until the space scene's textures are in (the patch round the nadir included), max ms
const waitTex = async (P, maxMs) => { const t0 = Date.now(); let s = null; for (;;) { await P.step(6); s = await spaceReady(P); if ((s.need && s.done === s.need) || Date.now() - t0 > maxMs) return s; await P.wait(60); } };
const view = (P, v, hp, hy) => P.ev(([v, hp, hy]) => { const fl = VR.game.flight; fl.view = v; VR.game.camMode = v === 0 ? 0 : 1; fl.headPitch = hp; fl.headYaw = hy || 0; fl.backT = 0; fl.recenter = false; fl.mouseIdle = 0; fl.chaseYaw = null; fl.shot = null; fl.shakeAmp = 0; fl.bump = 0; }, [v, hp, hy]);

// the plaza view: the Gate Temple from the plaza path at noon (space0.mjs), the animation clock pinned so the two builds
// draw the same moment; the frame kept as __Fplaza and pictured
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
// v0.49's ground frame on its own page (BASE_DIST): the picture and the cost, then the page closed
async function basePlaza(preset) {
  const tag = TAGP[preset] || preset;
  console.log(`\nv0.49 · ${NAMEP[preset] || preset} (${secs()})`);
  const P = await openPage(BASE);
  try {
    if (!await makeWorld(P, preset)) { console.log('  (v0.49: no world)'); return null; }
    const path = SHOTS + `ascent_plaza_base_${tag}.png`, m = await plaza(P, path);
    if (m.err) { console.log('  (v0.49: ' + m.err + ')'); return null; }
    const wc = [], cc = [], hi = preset !== 'potato';
    for (let i = 0; i < (hi ? 1 : ROUNDS); i++) { const c = await cost(P, '__Fplaza', hi ? 1 : 2, hi ? 3 : 6); wc.push(c.wallMs); cc.push(c.cpuMs); }
    const out = { wall: r1(med(wc)), cpu: r1(med(cc)), draws: m.draws, tris: m.tris, path, errors: errsOf(P).length };
    console.log(`  v0.49's plaza frame: ${out.wall} ms (CPU ${out.cpu}), ${out.draws} draws (${secs()})`);
    return out;
  } catch (e) { console.log('  (v0.49: ' + String(e.message || e).slice(0, 300) + ')'); return null; }
  finally { await P.ctx.close().catch(() => {}); }
}

// ---------------------------------------------------------------- a preset
async function runPreset(preset, base) {
  const tag = TAGP[preset] || preset, Rr = rec.presets[tag] = { climb: {}, cost: {} };
  const hi = preset !== 'potato';
  console.log(`\n${NAMEP[preset] || preset} (${secs()})`);
  const P = await openPage();
  try {
    const info = await P.ev(() => ({ asc: !!VR.Ascent && !!VR.Ascent.page, sf: !!VR.SpaceFlight && !!VR.SpaceFlight.page, en: !!VR.Entry && !!VR.Entry.page, wrapped: !!(VR.SpaceShaders && VR.SpaceShaders.ascentWrapped) }));
    check(info.asc && info.sf && info.en && info.wrapped, `the build has the climb, space and the way down (${JSON.stringify(info)})`);
    const ok = await makeWorld(P, preset);
    check(ok, `the world is loaded (${secs()})`);
    if (!ok) return;
    // ---- the plaza (the frame the costs compare with): the temple from the plaza path at noon (space0.mjs)
    const pm = await plaza(P, SHOTS + `ascent_plaza_${tag}.png`);
    check(!pm.err, `the plaza frame (${pm.err || pm.draws + ' draws'})`);
    // the ground before/after: this build's plaza frame against v0.49's (taken just before on its own page)
    if (base && !pm.err) {
      const wc = [], cc = [];
      for (let i = 0; i < (hi ? 1 : ROUNDS); i++) { const c = await cost(P, '__Fplaza', hi ? 1 : 2, hi ? 3 : 6); wc.push(c.wallMs); cc.push(c.cpuMs); }
      const now = { wall: r1(med(wc)), cpu: r1(med(cc)), draws: pm.draws, tris: pm.tris };
      const d = await pixDiff(base.path, SHOTS + `ascent_plaza_${tag}.png`);
      Rr.ground = { base, now, diff: d };
      console.log(`  the ground before/after: v0.49 ${base.wall} ms (CPU ${base.cpu}, ${base.draws} draws) · now ${now.wall} ms (CPU ${now.cpu}, ${now.draws} draws) · the picture mean |Δ| ${d.mean}, ${r1(d.big * 100)} % of pixels off > 24`);
      check(d.mean < 2 && d.big < 0.02, `${NAMEP[preset]}: the ground frame is v0.49's (mean |Δ| ${d.mean}, ${r1(d.big * 100)} % > 24)`);
      if (!hi) check(now.wall <= base.wall * 1.1 || now.cpu <= base.cpu * 1.1, `Very Low: the ground frame not dearer than v0.49 (${now.wall} vs ${base.wall} ms, CPU ${now.cpu} vs ${base.cpu})`);
    }
    // ---- the shuttle on the apron, boarded, the engines running
    const ap = await P.ev(() => VR.SpaceFlight.apron());
    const ay = await P.groundY(ap.x, ap.z);
    await P.ev(([x, y, z]) => { const g = VR.game, p = g.player; p.flying = false; p.noclip = false; p.teleport(x + 0.5, y + 1, z + 12.5); p.yaw = 0; g.starships.placeInFront(4242, 'shuttle', null, p); }, [ap.x, ay, ap.z]);
    for (let i = 0; i < 60; i++) { await P.step(4); if (await P.ev(() => { const s = VR.game.starships.ships; return s.length && s[s.length - 1].d.meta; })) break; await P.wait(100); }
    const boarded = await P.ev(() => { const g = VR.game, s = g.starships.ships[g.starships.ships.length - 1]; if (!s || !s.d.meta) return null; g.starships.board(s, g.player); const fl = s.flight; fl.power = 'running'; fl.startT = 3; return { name: s.d.meta.name, pos: s.pos.slice() }; });
    check(!!boarded, `a shuttle on the apron, boarded (${boarded && boarded.name})`);
    if (!boarded) return;
    await P.step(30);
    // the hour: Amarant up ahead (10–30° over the horizon) in daylight — the ship's nose toward it
    const hour = await P.ev(() => {
      const U = VR.Universe; let best = null;
      for (let tk = 0; tk < 24000; tk += 250) {
        const t = U.worldSeconds(2, tk), sky = U.localSky('overworld', [0, 1500, 40], t), a = sky._byId.amarant, el = Math.asin(a.dir[1]) * 180 / Math.PI, sel = Math.asin(sky.sun.dir[1]) * 180 / Math.PI;
        const sep = Math.acos(Math.max(-1, Math.min(1, a.dir[0] * sky.sun.dir[0] + a.dir[1] * sky.sun.dir[1] + a.dir[2] * sky.sun.dir[2]))) * 180 / Math.PI;
        const sc = (sel > 12 ? 1 : 0) * (el > 6 && el < 34 ? 2 - Math.abs(el - 18) / 30 : 0) * (sep > 60 ? 1 + Math.min(sep, 120) / 120 : 0.1) + (sel > 12 ? 0.2 : 0);
        if (!best || sc > best.sc) best = { tk, el: +el.toFixed(1), sel: +sel.toFixed(1), sep: +sep.toFixed(0), az: Math.atan2(-a.dir[0], -a.dir[2]), sc };
      }
      VR.game.env.day = 2; VR.game.env.setTime(best.tk);
      return best;
    });
    Rr.hour = hour;
    console.log(`  the hour: tick ${hour.tk} (Helia ${hour.sel}°, Amarant ${hour.el}° high, ${hour.sep}° from Helia) (${secs()})`);
    // ---- the climb: every 300 m, at rest in the sky (the hover hold), the nose 10° up toward Amarant
    if (want('climb')) {
      for (const y of ALTS) {
        const t1 = Date.now();
        try {
          await P.ev(([y, h]) => VR.SpaceFlight.debug.climb(VR.game, y, 10, h), [y, hour.az]);
          await P.step(8);
          const s0 = await st(P);
          if (y >= 400) await waitTex(P, 90000);
          await P.settle(120);
          const tags = hi ? [['chase', 1, 0.1], ['cockpit', 0, -0.06]] : [['cockpit', 0, -0.06]];
          const row = Rr.climb[y] = { regime: s0.regime, y: s0.y };
          for (const [nm, v, hp] of tags) {
            await view(P, v, hp); await P.step(3);
            await P.ev(() => { window.__Fc = window.__F; });
            const path = SHOTS + `ascent_${String(y).padStart(4, '0')}${nm === 'chase' || !hi ? '' : '_cockpit'}_${tag}.png`;
            const m = await picture(P, '__Fc', path, K);
            const sp = m.err ? { sd: 0, mean: 0 } : await spread(path);
            row[nm] = { draws: m.draws, err: m.err, pic: sp };
            if (m.err) check(false, `${y} m ${nm}: ${m.err}`);
          }
          const s1 = await st(P);
          console.log(`  ${y} m: ${s1.regime} at ${s1.y} m, ${JSON.stringify(row.chase || row.cockpit)} (${r1((Date.now() - t1) / 1000)} s, ${secs()})`);
          check(s1.regime === 'climb' && Math.abs(s1.y - y) < 40 && (row.chase || row.cockpit).pic.sd > 3, `${y} m: in the climb, held there, the picture not blank`);
          if (y === 1500 && !hi) await P.ev(() => { window.__Fclimb = window.__F; });
        } catch (e) { check(false, `${y} m: ${String(e.stack || e.message || e).slice(0, 400)}`); }
        save();
      }
      // Very Low: the climb frame against the plaza frame (rounds in turns, the medians)
      if (!hi && await P.ev(() => !!window.__Fclimb)) {
        const cp = [], cc = [], wp = [], wc = [];
        for (let rd = 0; rd < ROUNDS; rd++) { const a = await cost(P, '__Fplaza', 2, 6), b = await cost(P, '__Fclimb', 2, 6); cp.push(a.cpuMs); cc.push(b.cpuMs); wp.push(a.wallMs); wc.push(b.wallMs); }
        Rr.cost = { plazaCpu: r1(med(cp)), climbCpu: r1(med(cc)), plazaWall: r1(med(wp)), climbWall: r1(med(wc)), rounds: ROUNDS };
        console.log(`  cost: plaza ${Rr.cost.plazaWall} ms (CPU ${Rr.cost.plazaCpu}) · climb at 1,500 m ${Rr.cost.climbWall} ms (CPU ${Rr.cost.climbCpu})`);
        check(Rr.cost.climbWall <= Rr.cost.plazaWall * 1.05 && Rr.cost.climbCpu <= Rr.cost.plazaCpu * 1.05, `Very Low: the climb frame is not dearer than the plaza frame (${Rr.cost.climbWall} ≤ ${Rr.cost.plazaWall} ms)`);
      }
    }
    // ---- the hand-off: 2,490 m in the climb, then up through 2,500 m (rendered frames, timed), the first space frame
    if (want('handoff')) {
      try {
        await P.ev((h) => VR.SpaceFlight.debug.climb(VR.game, 2490, 20, h), hour.az);
        await view(P, 1, 0.1);
        await waitTex(P, 60000); await P.settle(60); await P.step(4);
        await P.ev(() => { window.__Fh1 = window.__F; });
        await picture(P, '__Fh1', SHOTS + `ascent_handoff_climb_${tag}.png`, K);
        // through the edge: rendered every frame, each synced
        await P.ev(() => { const g = VR.game, fl = g.flight, b = fl.b; VR.Ascent.enterClimb(fl, [b.pos[0], 2486, b.pos[2]], [0, 22, 0]); fl.throttle = 0.05; });
        const trace = await P.ev(() => { const g = VR.game, out = []; window.__norender = false; for (let i = 0; i < 32; i++) { const t0 = performance.now(); g.last = t0 - 33; g.loop(t0); window.__sync(); const s = VR.SpaceFlight.debug.state(g); out.push([+(performance.now() - t0).toFixed(1), s.regime, s.y]); } window.__norender = true; return out; });
        const ms = trace.map(x => x[0]).slice(3), m = med(ms), mx = Math.max(...ms), hand = trace.findIndex(x => x[1] === 'space');
        Rr.handoff = { median: r1(m), max: r1(mx), at: hand, trace };
        console.log(`  hand-off: frame ${hand} (${hand >= 0 ? trace[hand][2] : '-'} m), median ${r1(m)} ms, max ${r1(mx)} ms; around it ${trace.slice(Math.max(0, hand - 2), hand + 3).map(x => x[0]).join(' · ')}`);
        check(hand > 0, 'the space frame takes over at 2,500 m');
        check(mx <= 2 * m, `no frame through the hand-off over twice the median (${r1(mx)} ≤ 2 × ${r1(m)} ms)`);
        await P.step(20);
        const s2 = await st(P);
        await P.ev(() => { window.__Fh2 = window.__F; });
        const mm = await picture(P, '__Fh2', SHOTS + `ascent_handoff_space_${tag}.png`, K);
        check(s2.regime === 'space' && !mm.err, `the space frame (${s2.regime} at ${s2.y} m, ${mm.err || mm.draws + ' draws'})`);
      } catch (e) { check(false, `hand-off: ${String(e.stack || e.message || e).slice(0, 400)}`); }
      save();
    }
    // ---- orbit by day and by night, 3 km over the Heartland, the chase view along the way
    if (want('orbit')) {
      for (const [nm, tk] of [['day', 5200], ['night', 20500]]) {
        try {
          await P.ev((tk) => { const g = VR.game; g.env.day = 2; g.env.setTime(tk); VR.SpaceFlight.debug.orbit(g, 0, 40, 3063); }, tk);
          await view(P, 1, 0.12);
          await waitTex(P, 60000); await P.step(10);
          const s3 = await st(P);
          await P.ev(() => { window.__Fo = window.__F; });
          const path = SHOTS + `ascent_orbit_${nm}_${tag}.png`, m = await picture(P, '__Fo', path, K), sp = m.err ? { sd: 0 } : await spread(path);
          (Rr.orbit = Rr.orbit || {})[nm] = { state: s3, draws: m.draws, pic: sp, err: m.err };
          console.log(`  orbit ${nm}: ${s3.regime}, Ap ${r1(s3.ap)} Pe ${r1(s3.pe)}, ${r1(s3.period / 60)} min, ${m.err || m.draws + ' draws'}, L ${sp.mean} ± ${sp.sd} (${secs()})`);
          check(s3.regime === 'space' && Math.abs(s3.period / 60 - 11.0) < 0.3 && !m.err && sp.sd > 3, `orbit (${nm}): ${r1(s3.period / 60)} min round, the picture not blank`);
          if (hi && nm === 'day') { await view(P, 0, -0.1); await P.step(3); await P.ev(() => { window.__Fo = window.__F; }); await picture(P, '__Fo', SHOTS + `ascent_orbit_cockpit_${tag}.png`, K); }
        } catch (e) { check(false, `orbit ${nm}: ${String(e.stack || e.message || e).slice(0, 400)}`); }
        save();
      }
    }
    // ---- the Reisesprung to Opal: half way and arrived (High)
    if (hi && want('jump')) {
      try {
        await P.ev(() => { const g = VR.game; g.env.setTime(5200); VR.SpaceFlight.debug.orbit(g, 0, 40, 3063); VR.SpaceFlight.jumpStart(g.flight, 'opal'); });
        await view(P, 1, 0.12);
        await P.step(90);
        await P.ev(() => { window.__Fj = window.__F; });
        const m1 = await picture(P, '__Fj', SHOTS + `ascent_jump_mid_${tag}.png`, K, true);
        await P.step(110);
        await waitTex(P, 60000); await P.step(6);
        const s4 = await st(P);
        await P.ev(() => { window.__Fj = window.__F; });
        const m2 = await picture(P, '__Fj', SHOTS + `ascent_jump_opal_${tag}.png`, K);
        Rr.jump = { state: s4, mid: m1.draws, arrived: m2.draws };
        console.log(`  Reisesprung: ${s4.frame}, ${s4.regime}, jump ${s4.jump}, ${m2.err || m2.draws + ' draws'} (${secs()})`);
        check(s4.frame === 'opal' && !s4.jump && !m1.err && !m2.err, `the Reisesprung: in orbit round Opal after six seconds (${s4.frame})`);
      } catch (e) { check(false, `jump: ${String(e.stack || e.message || e).slice(0, 400)}`); }
      save();
    }
    // ---- the entry: from 3 km over a point 74 km east, the plasma, the place it comes down at, its local time (High)
    if (hi && want('entry')) {
      try {
        await P.ev(() => { const g = VR.game; g.zenFreezeTime = false; g.env.day = 2; g.env.setTime(4500); VR.SpaceFlight.debug.orbit(g, 74000, 0, 3063); VR.SpaceFlight.land(g.flight); });
        await view(P, 1, 0.08);
        let glowMax = 0, pic = false, landed = null, s5 = null;
        const t1 = Date.now();
        for (let i = 0; i < 400; i++) {
          await P.step(10);
          s5 = await st(P);
          glowMax = Math.max(glowMax, s5.glow || 0);
          if (!pic && s5.glow > 0.75) {
            await P.ev(() => { window.__Fe = window.__F; });
            const m = await picture(P, '__Fe', SHOTS + `ascent_reentry_${tag}.png`, K, true);
            pic = true; (Rr.entry = Rr.entry || {}).glowPic = { at: s5.y, glow: s5.glow, overlay: m.overlay, err: m.err };
            console.log(`  the plasma at ${s5.y} m: glow ${r1(s5.glow)}, ${m.err || (m.overlay ? 'with the overlay' : 'no overlay')} (${secs()})`);
          }
          const lnd = await P.ev(() => { const fl = VR.game.flight; return fl && fl.state === 'landed' ? fl.b.pos.slice() : null; });
          if (lnd) { landed = lnd; break; }
          if (Date.now() - t1 > 900000) break;
        }
        const E = Rr.entry = Object.assign(Rr.entry || {}, { glowMax, landed, last: s5 });
        check(glowMax > 0.75 && pic, `the entry glows (max ${r1(glowMax)})`);
        check(!!landed, `then the ship lands (${landed ? landed.map(Math.round).join(', ') : s5 && s5.regime + ' at ' + s5.y})`);
        if (landed) {
          const lt = await P.ev(() => { const g = VR.game, p = g.flight.b.pos, sh = VR.Entry.tickShift(p[0], p[2]); return { dist: Math.hypot(p[0], p[2]), shift: Math.round(sh), clock: Math.round(g.env.timeOfDay), local: Math.round(((g.env.timeOfDay + sh) % 24000 + 24000) % 24000) }; });
          E.local = lt;
          console.log(`  landed ${r1(lt.dist / 1000)} km from the Heartland: the clock ${lt.clock}, the local time ${lt.local} (${lt.shift >= 0 ? '+' : ''}${lt.shift} ticks) (${secs()})`);
          check(lt.dist > 60000 && Math.abs(lt.shift) > 3000, `a landing far from the Heartland keeps its own time (${r1(lt.dist / 1000)} km, ${lt.shift} ticks)`);
          await P.ev(() => { VR.game.zenFreezeTime = true; });
          await P.settle(600);
          await view(P, 1, 0.25, 2.4);
          await P.step(4);
          await P.ev(() => { window.__Fl = window.__F; });
          const ml = await picture(P, '__Fl', SHOTS + `ascent_land_${tag}.png`, K);
          check(!ml.err, `the landing place (${ml.err || ml.draws + ' draws'})`);
        }
      } catch (e) { check(false, `entry: ${String(e.stack || e.message || e).slice(0, 400)}`); }
      save();
    }
    Rr.errors = errsOf(P);
    check(errsOf(P).length === 0, `no page error (${errsOf(P).length})` + (errsOf(P).length ? ': ' + errsOf(P)[0].slice(0, 400) : ''));
    Rr.lines = await P.ev(() => (window.__lines || []).slice(-30));
    save();
  } catch (e) { check(false, `${NAMEP[preset]}: ${String(e.stack || e.message || e).slice(0, 500)}`); }
  finally { await P.ctx.close().catch(() => {}); }
}

for (const p of PRESETS) await runPreset(p, BASE ? await basePlaza(p) : null);
await browser.close();

// ---------------------------------------------------------------- the sheet: the climb (High chase · High cockpit · Very Low), then the rest
try {
  const f = (n) => (fs.existsSync(SHOTS + n) ? SHOTS + n : null);
  const rows = ALTS.map(y => { const a = String(y).padStart(4, '0'); return { label: y + ' m', imgs: [f(`ascent_${a}_high.png`), f(`ascent_${a}_cockpit_high.png`), f(`ascent_${a}_vl.png`)] }; });
  rows.push({ label: 'hand-off', imgs: [f('ascent_handoff_climb_high.png'), f('ascent_handoff_space_high.png'), f('ascent_handoff_space_vl.png')] });
  rows.push({ label: 'orbit', imgs: [f('ascent_orbit_day_high.png'), f('ascent_orbit_night_high.png'), f('ascent_orbit_day_vl.png')] });
  rows.push({ label: 'way down', imgs: [f('ascent_reentry_high.png'), f('ascent_land_high.png'), f('ascent_orbit_cockpit_high.png')] });
  rows.push({ label: 'Reisesprung', imgs: [f('ascent_jump_mid_high.png'), f('ascent_jump_opal_high.png'), f('ascent_plaza_vl.png')] });
  rows.push({ label: 'ground v0.49 / now', imgs: [f('ascent_plaza_base_high.png'), f('ascent_plaza_high.png'), f('ascent_plaza_base_vl.png')] });
  const spec = ROOT + '.tmp_tests/ascent_sheet.json';
  fs.writeFileSync(spec, JSON.stringify({ cols: ['High · chase', 'High · cockpit', 'Very Low'], w: 560, rows }));
  execFileSync('python3', ['/root/r9coord/sheet.py', SHOTS + 'ascent_sheet.jpg', spec], { stdio: 'inherit' });
} catch (e) { console.log('  (no sheet: ' + String(e.message || e).slice(0, 200) + ')'); }
save();
console.log(`\n${fails ? 'FAILED ' + fails : 'ALL OK'} (${secs()})`);
process.exit(fails ? 1 : 0);
