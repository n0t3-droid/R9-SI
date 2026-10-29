// u-orbitlod · the view from orbit in the browser (docs/superpowers/plans/2026-10-29-u-orbitlod.md): a shuttle from the
// Gate Temple's apron of a new default world (seed 53, creative), 1280 × 720, de-DE; this build (High, Very Low) and
// v0.50's (BASE_DIST, default .tmp_tests/base/dist: `git archive v042 | tar -x` and `node build.js` there) side by side.
//   pictures  test/shots/orbit_<view>_<high|vl>[_base].png — herz_day (3 km over the Heartland, the land ahead), limb_sunset
//             (toward Helia just set under the limb), night_lights (the Heartland's lights from 9 km off), aurora (toward
//             the pole at night), sunglint (toward Helia's reflection), opal (after the Reisesprung), cockpit (the
//             window in orbit), climb_1200 (the band on the dipped horizon); the sheet test/shots/orbit_sheet.jpg
//   numbers   the orbit frame's cost (Very Low / High, v0.50 / now), the tiles (drawn, worker ms, bytes), the space layer's
//             texture bytes, no page error
// → .tmp_tests/orbit_run.json.   usage: nohup bash test/wt_run.sh orbit.mjs 3600 > .tmp_tests/orbit.log 2>&1 &
//   PRESETS=high,potato · ONLY=climb,day,glint,sunset,night,aurora,cockpit,opal · BASE_DIST='' (none) · K=3
// regress: skip  (a showcase: the pictures are the evidence; the gates are test/planetlod.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import sharp from '/home/dev/.npm-global/lib/node_modules/sharp/lib/index.js';
import fs from 'fs';
import { execSync, execFileSync } from 'child_process';
const ROOT = new URL('../', import.meta.url).pathname;   // this checkout (the test runs from test/ or from .tmp_tests/)
const DIST = process.env.DIST || 'file://' + ROOT + 'dist/index.html';
const SHOTS = ROOT + 'test/shots/';
const BASE = process.env.BASE_DIST !== undefined ? process.env.BASE_DIST : (fs.existsSync(ROOT + '.tmp_tests/base/dist/index.html') ? 'file://' + ROOT + '.tmp_tests/base/dist/index.html' : '');
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
const save = () => { try { fs.writeFileSync(ROOT + '.tmp_tests/orbit_run.json', JSON.stringify(rec, null, 1)); } catch (e) { /* a convenience */ } };
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
    // (the furnished cockpit is drawn once a game frame — cockpit.js drawKit's drawnAt — and a kept frame drawn again is
    // the same game frame: each draw here forgets it, or the last one shows the seat without its room, as run 2's did)
    try { for (let i = 0; i < k; i++) { if (g.cockpit) g.cockpit.drawnAt = -1; r.render(F); } } catch (e) { window.__norender = true; return { err: String(e && e.stack || e).slice(0, 600) }; }
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
// the flown ship in a kept frame: the frame drawn as it is and once without the ship, the pixels that differ (runs 1–2 flew
// a hidden ship: nothing would have differed)
const shipSeen = (P, key) => P.ev((key) => {
  const g = VR.game, r = g.renderer, gl = r.gl, F = window[key], s = g.starships && g.starships.pilot;
  if (!F || !s) return { changed: 0, hidden: null };
  const was = !!s.hidden, W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
  const shot = (hide) => { s.hidden = hide; window.__norender = false; r.frameNo = 1000; r.tsrReset = true; if (g.cockpit) g.cockpit.drawnAt = -1; r.render(F); window.__norender = true; const px = new Uint8Array(W * H * 4); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; };
  const a = shot(was), b = shot(true); s.hidden = was;
  let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 30) n++;
  return { changed: n, hidden: was };
}, key);
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
// (dtms: the game time a frame — in orbit 1 ms, so the ship waits where it was put: run 2's night picture was taken 97 km
// on, in that place's morning, the nadir's patch never caught up with a ship moving 4 km every five seconds)
const waitTex = async (P, maxMs, dtms = 33) => { const t0 = Date.now(); let s = null; for (;;) { await P.step(6, dtms); s = await spaceReady(P); if ((s.need && s.done === s.need) || Date.now() - t0 > maxMs) return s; await P.wait(60); } };
const view = (P, v, hp, hy) => P.ev(([v, hp, hy]) => { const fl = VR.game.flight; fl.view = v; VR.game.camMode = v === 0 ? 0 : 1; fl.headPitch = hp; fl.headYaw = hy || 0; fl.backT = 0; fl.recenter = false; fl.mouseIdle = 0; fl.chaseYaw = null; fl.shot = null; fl.shakeAmp = 0; fl.bump = 0; }, [v, hp, hy]);

const VIEWS = ['climb', 'day', 'glint', 'sunset', 'night', 'aurora', 'cockpit', 'opal'];
// the kept frame looked at another way (the space frame's layers do not depend on the camera's turn: the map's axes)
// (hide: the ship and its trails out of the frame — the views toward Helia and the limb look past them)
const aim = (P, key, yaw, pitch, fov, hide) => P.ev(([key, yaw, pitch, fov, hide]) => { const F = window[key], g = VR.game, s = g.starships && g.starships.pilot; if (s) s.hidden = !!hide; const T = g.trails; if (T) { if (!T.__draw) T.__draw = T.draw; T.draw = hide ? () => {} : T.__draw; } F.cam = Object.assign({}, F.cam, { yaw: yaw === null ? F.cam.yaw : yaw, pitch, roll: 0 }); if (fov) F.cam.fov = fov * Math.PI / 180; }, [key, yaw, pitch, fov || 0, !!hide]);
const yawTo = (dx, dz) => Math.atan2(-dx, -dz);
// the tick of day 2 when Helia stands at `el` degrees over (x, z) at 3 km, rising (am) or setting
const tickFor = (P, el, setting, x, z) => P.ev(([el, setting, x, z]) => {
  const U = VR.Universe; let best = null, prev = null;
  for (let tk = 0; tk <= 24000; tk += 50) {
    const s = U.localSky('overworld', [x, 3063, z], U.worldSeconds(2, tk)).sun.dir, e = Math.asin(s[1]) * 180 / Math.PI;
    if (prev !== null && ((setting && prev >= el && e < el) || (!setting && prev <= el && e > el))) { best = tk; break; }
    prev = e;
  }
  return best;
}, [el, setting, x, z]);
const sunNow = (P) => P.ev(() => { const fr = VR.SpaceFlight.cur; return fr ? fr.sunS.slice() : null; });
const tileStats = (P) => P.ev(() => { const PG = VR.PlanetLODGL, SS = VR.SpaceScene; return { tiles: PG ? Object.assign({}, PG.stats, { cached: PG.tiles.size }) : null, texMB: SS && SS.state ? Math.round(SS.state.bytes / 1048576 * 10) / 10 : null }; });
const waitTiles = async (P, maxMs) => { const t0 = Date.now(); for (;;) { await P.step(4, 1); const s = await P.ev(() => { const PG = VR.PlanetLODGL; return PG ? { n: PG.stats.tiles, left: PG.pending() } : null; }); if (!s || !s.n || s.left === 0 || Date.now() - t0 > maxMs) return s; await P.wait(80); } };
// the climb's textures asked for while the test steps without drawing (in play every drawn frame asks: climbLayers)
const waitClimb = async (P, maxMs) => { await P.ev(() => { const r = VR.game.renderer; window.__norender = false; r.render(window.__F); window.__norender = true; }); const t0 = Date.now(); for (;;) { await P.step(4); const s = await P.ev(() => { const g = VR.game, SF = VR.SpaceFlight, SS = VR.SpaceScene; if (SF.S.anc) SS.needs(g, SF.S.anc, SS.tier(g)); if (VR.PlanetLODGL) VR.PlanetLODGL.again(); const need = SS.cur_need || []; const PG = VR.PlanetLODGL; return { need: need.length, done: need.filter(q => q.done).length, tiles: PG && PG.last ? PG.pending() : 0 }; }); if ((s.need && s.done === s.need && !s.tiles) || Date.now() - t0 > maxMs) return s; await P.wait(80); } };

async function run(preset, url, base) {
  const tag = (TAGP[preset] || preset) + (base ? '_base' : ''), Rr = rec.presets[tag] = {};
  const hi = preset !== 'potato', V = (n) => (!ONLY || ONLY.includes(n)) && (!base || !hi || n !== 'climb') && (!base || hi || ['climb', 'day', 'sunset', 'night'].includes(n));
  console.log(`\n${NAMEP[preset] || preset}${base ? ' · v0.50' : ''} (${secs()})`);
  const P = await openPage(url);
  const shot = async (key, name) => { const path = SHOTS + `orbit_${name}_${tag}.png`, m = await picture(P, key, path, K); const sp = m.err ? { sd: 0 } : await spread(path); (Rr.pics = Rr.pics || {})[name] = { draws: m.draws, tris: m.tris, pic: sp, err: m.err }; check(!m.err && sp.sd > 2, `${name}: the picture (${m.err || m.draws + ' draws'}, L ${sp.mean} ± ${sp.sd})`); return m; };
  try {
    const ok = await makeWorld(P, preset);
    check(ok, `the world is loaded (${secs()})`);
    if (!ok) return;
    const ap = await P.ev(() => VR.SpaceFlight.apron()), ay = await P.groundY(ap.x, ap.z);
    await P.ev(([x, y, z]) => { const g = VR.game, p = g.player; p.flying = false; p.noclip = false; p.teleport(x + 0.5, y + 1, z + 12.5); p.yaw = 0; g.starships.placeInFront(4242, 'shuttle', null, p); }, [ap.x, ay, ap.z]);
    const mine = () => P.ev(() => { const s = VR.game.starships.ships.find(q => q.d.seed === 4242 && !q.hangar); return !!(s && s.d.meta && s.d.cells); });
    for (let i = 0; i < 90; i++) { await P.step(4); if (await mine()) break; await P.wait(100); }
    const boarded = await P.ev(() => { const g = VR.game, s = g.starships.ships.find(q => q.d.seed === 4242 && !q.hangar); if (!s || !s.d.meta || !s.d.cells) return null; g.starships.board(s, g.player); const fl = s.flight; fl.power = 'running'; fl.startT = 3; return { name: s.d.meta.name, pilot: g.starships.pilot === s }; });
    check(!!boarded && boarded.pilot, `the shuttle boarded (${boarded && boarded.name})`);
    if (!boarded) return;
    await P.step(30);
    // ---- the climb at 1,200 m (the band on the dipped horizon), the chase view level toward the horizon
    // (always: the climb's play frames hand the game to the space layers — VR.Ascent.game — before any orbit)
    await P.ev(() => { const g = VR.game; g.env.day = 2; g.env.setTime(2250); VR.SpaceFlight.debug.climb(g, 1200, 10, 0.6); });
    await P.step(8);
    if (V('climb')) {
      await P.settle(120); await waitClimb(P, 120000);
      await view(P, 1, 0.1); await P.step(3);
      await P.ev(() => { window.__Fc = window.__F; });
      await shot('__Fc', 'climb_1200');
      // (what the climb's impostor waits for: the textures not yet there skip its draw — drawLayers' strict)
      Rr.climbTex = await P.ev(() => { const SS = VR.SpaceScene, ST = SS.state, map = SS.texMap || {}, need = SS.cur_need || []; return { need: need.length, done: need.filter(s => s.done).length, open: need.filter(s => !s.done).map(s => s.key + ' ' + s.left + '/' + s.jobs), missing: ['herzA', 'herzB', 'patchA', 'patchB'].filter(k => !ST.tex[map[k]]), patch: !!ST.patch }; });
      console.log(`  the climb's textures: ${JSON.stringify(Rr.climbTex)}`);
    }
    const orbitAt = async (x, z, tk) => { await P.ev(([x, z, tk]) => { const g = VR.game; g.env.day = 2; g.env.setTime(tk); VR.SpaceFlight.debug.orbit(g, x, z, 3063); }, [x, z, tk]); await view(P, 1, 0.45); await waitTex(P, 60000, 1); await waitTiles(P, 30000); await P.step(6, 1); await P.ev(() => { window.__Fo = window.__F; }); };
    // ---- by day over the Heartland: the land ahead to the horizon; the costs
    if (V('day')) {
      await orbitAt(0, 40, 5200);
      await aim(P, '__Fo', yawTo(0.35, -1), -0.36, 70);
      await shot('__Fo', 'herz_day');
      Rr.tiles = await tileStats(P);
      const wc = [], cc = [];
      for (let i = 0; i < (hi ? 1 : ROUNDS); i++) { const c = await cost(P, '__Fo', 2, hi ? 3 : 6); wc.push(c.wallMs); cc.push(c.cpuMs); }
      Rr.cost = { wall: r1(med(wc)), cpu: r1(med(cc)) };
      console.log(`  the orbit frame: ${Rr.cost.wall} ms (CPU ${Rr.cost.cpu}); tiles ${JSON.stringify(Rr.tiles)} (${secs()})`);
    }
    // ---- the sunglint: toward Helia's reflection (the sun's azimuth, as far below the level as Helia is above it)
    if (V('glint')) {
      await orbitAt(0, 40, 5200);
      const s = await sunNow(P);
      if (s) { Rr.glintSunEl = r1(Math.asin(s[1]) * 180 / Math.PI); await aim(P, '__Fo', yawTo(s[0], s[2]), -Math.asin(s[1]), 70, true); await shot('__Fo', 'sunglint'); console.log(`  sunglint: Helia ${Rr.glintSunEl}° high`); }
    }
    // ---- the sunset limb: Helia 6° under the level at the nadir (just under the limb from 3 km), looking at it
    if (V('sunset')) {
      const tk = await tickFor(P, -15.5, true, 0, 40);   // (the limb dips 13.9° from 3 km: Helia just under it)
      await orbitAt(0, 40, tk || 12000);
      const s = await sunNow(P);
      if (s) { await aim(P, '__Fo', yawTo(s[0], s[2]), -0.2, 70, true); await shot('__Fo', 'limb_sunset'); }
      Rr.sunsetTick = tk;
    }
    // ---- the night: the Heartland's lights from 9 km off; the aurora toward the pole over the limb
    if (V('night')) {
      await orbitAt(0, 9000, 20500);
      await aim(P, '__Fo', yawTo(0, -9000), -0.3, 70, true);
      await shot('__Fo', 'night_lights');
    }
    if (V('aurora')) {
      await orbitAt(0, 40, 20500);
      const C = await P.ev(() => [VR.BodyTex.CHART.Px, VR.BodyTex.CHART.Pz]);
      await aim(P, '__Fo', yawTo(C[0], C[1] - 40), -0.16, 75, true);
      await shot('__Fo', 'aurora');
    }
    // ---- the cockpit's window in orbit (High)
    if (hi && V('cockpit')) {
      await orbitAt(0, 40, 5200);
      await P.ev(() => { const s = VR.game.starships.pilot; if (s) s.hidden = false; });
      await view(P, 0, -0.1); await P.step(3, 1); await P.ev(() => { window.__Fk = window.__F; });
      await shot('__Fk', 'cockpit');
      // the hide-diff probe (u-ascent §9.2): which mesh is in the window — the frame drawn without each part in turn
      Rr.cockpitProbe = await P.ev(() => {
        const g = VR.game, r = g.renderer, gl = r.gl, F = window.__Fk, s = g.starships.pilot, d = s && s.d, W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
        const grab = () => { window.__norender = false; r.frameNo = 1000; r.tsrReset = true; if (g.cockpit) g.cockpit.drawnAt = -1; r.render(F); window.__norender = true; const px = new Uint8Array(W * H * 4); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px); return px; };
        const diff = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 30) n++; return n; };
        const base = grab(), out = { camMode: g.camMode, view: g.flight && g.flight.view, ready: !!(g.cockpit && g.cockpit.ready(g.flight)), horizon: !!F.horizon };
        if (d && d.gpu) for (const k of Object.keys(d.gpu)) { const m = d.gpu[k]; if (!m) continue; d.gpu[k] = null; out[k] = diff(base, grab()); d.gpu[k] = m; }
        if (F.horizon) { const hz = F.horizon; F.horizon = null; out.hz = diff(base, grab()); F.horizon = hz; }
        const rm = g.cockpit && g.cockpit.drawRoom; if (rm) { g.cockpit.drawRoom = () => {}; out.room = diff(base, grab()); g.cockpit.drawRoom = rm; }
        return out;
      });
      console.log(`  the cockpit probe (pixels each part owns): ${JSON.stringify(Rr.cockpitProbe)}`);
    }
    // ---- Opal after the Reisesprung (High)
    if (hi && V('opal')) {
      await orbitAt(0, 40, 5200);
      await P.ev(() => VR.SpaceFlight.jumpStart(VR.game.flight, 'opal'));
      await view(P, 1, 0.12);
      await P.step(200); await waitTex(P, 60000); await P.step(6);
      await P.ev(() => { window.__Fj = window.__F; });
      await aim(P, '__Fj', null, -0.5, 70, true);
      await shot('__Fj', 'opal');
    }
    Rr.errors = errsOf(P);
    check(errsOf(P).length === 0, `no page error (${errsOf(P).length})` + (errsOf(P).length ? ': ' + errsOf(P)[0].slice(0, 400) : ''));
    save();
  } catch (e) { check(false, `${tag}: ${String(e.stack || e.message || e).slice(0, 500)}`); }
  finally { await P.ctx.close().catch(() => {}); }
}

for (const p of PRESETS) { if (BASE) await run(p, BASE, true); await run(p, DIST, false); }
await browser.close();
// the numbers: Very Low not dearer, the tiles in budget
for (const p of PRESETS) {
  const t = TAGP[p] || p, a = rec.presets[t + '_base'], b = rec.presets[t];
  if (a && b && a.cost && b.cost) { console.log(`  ${NAMEP[p]}: the orbit frame ${a.cost.wall} → ${b.cost.wall} ms (CPU ${a.cost.cpu} → ${b.cost.cpu})`); if (p === 'potato') check(b.cost.wall <= a.cost.wall * 1.1 || b.cost.cpu <= a.cost.cpu * 1.1, `Very Low: the orbit frame not dearer (${b.cost.wall} vs ${a.cost.wall} ms)`); }
  if (b && b.tiles && b.tiles.tiles) { const T = b.tiles.tiles; console.log(`  ${NAMEP[p]}: tiles ${T.drawn} of ${T.tiles} drawn, ${T.cached} kept, ${r1(T.bytes / 1048576)} MB, a tile ${T.ms} ms (slowest ${T.maxMs})`); if (p !== 'potato') check(T.drawn > 0 && T.maxMs <= 12 && T.bytes <= 48 * 1048576, `${NAMEP[p]}: the tiles drawn (${T.drawn}), ≤ 48 MB (${r1(T.bytes / 1048576)} MB)`); else check(!T.drawn, 'Very Low: no tiles'); }
}
// the sheet: v0.50 | now, a row a view
try {
  const f = (n) => { const p = SHOTS + n; try { return n.startsWith('before/') || fs.statSync(p).mtimeMs >= T0 ? (fs.existsSync(p) ? p : null) : null; } catch (e) { return null; } };
  const rows = [];
  const add = (label, a, b) => { const imgs = [f(a), f(b)].filter(Boolean); if (imgs.length) rows.push({ label, imgs }); };
  for (const [n, l] of [['herz_day', 'day, 3 km'], ['sunglint', 'sunglint'], ['limb_sunset', 'sunset limb'], ['night_lights', 'night lights'], ['aurora', 'aurora'], ['cockpit', 'cockpit window'], ['opal', 'Opal']]) add(`High · ${l} · v0.50 | now`, `orbit_${n}_high_base.png`, `orbit_${n}_high.png`);
  for (const [n, l] of [['herz_day', 'day'], ['limb_sunset', 'sunset limb'], ['night_lights', 'night']]) add(`Very Low · ${l} · v0.50 | now`, `orbit_${n}_vl_base.png`, `orbit_${n}_vl.png`);
  add('Very Low · climb 1,200 m · v0.50 | now', 'orbit_climb_1200_vl_base.png', 'orbit_climb_1200_vl.png');
  add('High · climb 1,200 m · v0.50 (ascent.mjs) | now', 'before/ascent_1200_high.png', 'orbit_climb_1200_high.png');
  const spec = ROOT + '.tmp_tests/orbit_sheet.json';
  fs.writeFileSync(spec, JSON.stringify({ w: 620, rows }));
  execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + 'orbit_sheet.jpg', spec], { stdio: 'inherit' });
} catch (e) { console.log('  (no sheet: ' + String(e.message || e).slice(0, 200) + ')'); }
save();
console.log(`\n${fails ? 'FAILED ' + fails : 'ALL OK'} (${secs()})`);
process.exit(fails ? 1 : 0);
