// u-orbit2 · descent and landing that look true (docs/superpowers/plans/2026-10-29-u-orbit2.md; docs/reviews/v0.51.md R52-09):
// a shuttle on the Gate Temple's apron of a new default world (seed 53, creative, High), 1280 × 720, de-DE; this build and
// v0.51's (BASE_DIST, default .tmp_tests/base/dist: `git archive v0.51 | tar -x` and `node build.js` there) on their own pages.
//   pictures  test/shots/<name>[_base].png — descent_opal (the ship sinking onto Opal at ~30 m, the plume), landed_opal (the
//             ship down, the camera toward Amarant: black sky, stars), descent_basalt_night (Basalt's night side, the
//             earthshine), entry_glow (Herzwelt's entry from orbit, the plasma); the sheet test/shots/orbit2_desc_sheet.jpg
//   numbers   the top 30 %'s mean luma (≤ 25 on the airless frames), the plume's pixels against the same pixels without it
//             (brighter on Opal, darker on Basalt), the near ground's luma spread (texture), no page error
// → .tmp_tests/orbit2_run.json.   usage: nohup bash test/wt_run.sh orbit2.mjs 5400 > .tmp_tests/orbit2.log 2>&1 &
//   ONLY=opal,basalt,entry · BASE_DIST='' (none) · K=3
// regress: skip  (a showcase: the pictures are the evidence; the gates are test/orbit2.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import sharp from '/home/dev/.npm-global/lib/node_modules/sharp/lib/index.js';
import fs from 'fs';
import { execFileSync } from 'child_process';
const ROOT = new URL('../', import.meta.url).pathname;
const DIST = process.env.DIST || 'file://' + ROOT + 'dist/index.html';
const SHOTS = ROOT + 'test/shots/';
const BASE = process.env.BASE_DIST !== undefined ? process.env.BASE_DIST : (fs.existsSync(ROOT + '.tmp_tests/base/dist/index.html') ? 'file://' + ROOT + '.tmp_tests/base/dist/index.html' : '');
const SEED = process.env.SEED || '53', RD = +(process.env.RD || 8), K = +(process.env.K || 3), HP = +(process.env.HP || 0.1);   // (HP: the chase camera's pitch in the descent — v0.51's cruise.mjs looked down at 0.32, the sky out of the frame)
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const want = (s) => !ONLY || ONLY.includes(s);
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const r1 = (x) => Math.round(x * 10) / 10;
const rec = { dist: DIST, base: BASE, pages: {} };
const save = () => { try { fs.writeFileSync(ROOT + '.tmp_tests/orbit2_run.json', JSON.stringify(rec, null, 1)); } catch (e) { /* a convenience */ } };
fs.mkdirSync(SHOTS, { recursive: true });
const SH = (n) => SHOTS + n;
// a picture's measures: the top 30 %'s mean luma, the whole mean and spread, the bottom third's spread (the near ground)
const measure = async (path) => {
  const { data, info } = await sharp(path).raw().toBuffer({ resolveWithObject: true });
  const C = info.channels, W = info.width, H = info.height, L = (i) => 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  let t = 0, tn = 0, s = 0, s2 = 0, n = 0, b = 0, b2 = 0, bn = 0;
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
    const v = L((y * W + x) * C);
    if (y < H * 0.3) { t += v; tn++; }
    if (y > H * 0.67) { b += v; b2 += v * v; bn++; }
    s += v; s2 += v * v; n++;
  }
  const m = s / n, bm = b / bn;
  return { top: r1(t / tn), mean: r1(m), sd: r1(Math.sqrt(Math.max(0, s2 / n - m * m))), lowSd: r1(Math.sqrt(Math.max(0, b2 / bn - bm * bm))) };
};

const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
async function openPage(url) {
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
    const r = VR.game.renderer;
    r._render = r.render;
    r.render = function (F) { if (window.__norender) { window.__F = F; this.setupCamera(F.cam); return; } return this._render(F); };
  });
  const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(4); } };
  const boost = (on) => ev((on) => { const q = VR.game.renderer && VR.game.renderer.q; if (!q) return; if (on) { if (q.__up === undefined) q.__up = q.upload; q.upload = 24; } else if (q.__up !== undefined) { q.upload = q.__up; delete q.__up; } }, on);
  const settle = async (max = 400) => {
    let s = null;
    await boost(true);
    for (let i = 0; i < max; i++) {
      await step(10);
      s = await ev(() => { const g = VR.game, w = g.world; let dirty = 0; for (const c of w.cols.values()) for (const sc of c.sec) if ((sc.dirty || sc.pending) && sc.count > 0) dirty++; return { busy: g.pool.busy, pend: w.pending.size, dirty, up: w.uploadQ ? w.uploadQ.size : 0 }; });
      if (s.pend === 0 && s.up === 0 && s.busy === 0 && s.dirty === 0) break;
      await wait(60);
    }
    await boost(false);
    return s;
  };
  const groundY = (x, z) => ev(([x, z]) => { const w = VR.game.world, R = VR.R, F = VR.F; for (let y = 220; y > 30; y--) { const s = w.getBlock(Math.floor(x), y, Math.floor(z)); if (s && (R.T.flags[s] & (F.OPAQUE | F.FLUID)) && !(R.T.flags[s] & F.LEAVES)) return y; } return 80; }, [x, z]);
  return { ctx, page, logs, ev, wait, step, settle, groundY };
}
const errsOf = (P) => P.logs.filter(l => l.startsWith('[pageerror]'));
async function makeWorld(P) {
  await P.ev((rd) => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.settings.camShake = false; g.settings.renderDist = rd; g.applySettings('*'); }, RD);
  await P.ev((seed) => VR.game.createWorld({ name: 'Landung', mode: 'creative', difficulty: 'peaceful', type: 'default', seed, cheats: true, kit: true }), SEED);
  for (let i = 0; i < 150; i++) { await P.wait(1000); if (await P.ev(() => VR.game.state) === 'play') break; }
  const ok = await P.ev(() => VR.game.state) === 'play';
  await P.ev(() => { const g = VR.game; g.zenFreezeTime = true; g.zenFreezeWeather = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; for (const id of ['hud', 'ui', 'hints']) { const h = document.getElementById(id); if (h) h.style.display = 'none'; } });
  return ok;
}
// a kept frame (window[key]) drawn k times and read back into a picture (the screen's overlay canvas laid over: the
// plasma); cam: {yaw, pitch} over the kept camera; noPart: without the particles
const picture = async (P, key, path, k, o) => {
  o = o || {};
  const m = await P.ev(([key, k, o]) => {
    const g = VR.game, r = g.renderer, gl = r.gl, F0 = window[key];
    if (!F0) return { err: 'no frame kept' };
    const F = Object.assign({}, F0, { cam: Object.assign({}, F0.cam, o.cam || {}) });
    if (o.noPart) F.particles = null;
    window.__norender = false;
    r.frameNo = 1000; r.tsrReset = true; r.shadowValid = false;
    try { for (let i = 0; i < k; i++) { if (g.cockpit) g.cockpit.drawnAt = -1; r.render(F); } } catch (e) { window.__norender = true; return { err: String(e && e.stack || e).slice(0, 600) }; }
    const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, px = new Uint8Array(W * H * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    window.__norender = true;
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d'), id = x.createImageData(W, H);
    for (let y = 0; y < H; y++) { const src = (H - 1 - y) * W * 4; id.data.set(px.subarray(src, src + W * 4), y * W * 4); }
    for (let i = 3; i < id.data.length; i += 4) id.data[i] = 255;
    x.putImageData(id, 0, 0);
    let ov = false; const fx = document.getElementById('ascFx'); if (o.overlay && fx && fx.style.display !== 'none') { x.drawImage(fx, 0, 0, W, H); ov = true; }
    return { png: c.toDataURL('image/png').split(',')[1], draws: r.stats.draws, overlay: ov };
  }, [key, k, o]);
  if (m.err) return m;
  fs.writeFileSync(path, Buffer.from(m.png, 'base64'));
  delete m.png;
  return Object.assign(m, await measure(path));
};
// the plume's pixels: the frame with and without the particles, the pixels that differ; their mean luma in both
const plumeOf = async (a, b) => {
  const A = await sharp(a).raw().toBuffer({ resolveWithObject: true }), B = await sharp(b).raw().toBuffer({ resolveWithObject: true });
  const C = A.info.channels, L = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
  let n = 0, sa = 0, sb = 0;
  for (let i = 0; i < A.data.length; i += C) { const la = L(A.data, i), lb = L(B.data, i); if (Math.abs(la - lb) > 6) { n++; sa += la; sb += lb; } }
  return { px: n, with: n ? r1(sa / n) : 0, without: n ? r1(sb / n) : 0 };
};
const state = (P) => P.ev(() => { const g = VR.game, fl = g.flight, a = fl && fl.asc, c = a && a.cruise, L = g.cruiseLand; return { regime: fl ? fl.regime || 'air' : null, frame: a ? a.st.frame : null, phase: c ? c.phase || c.kind : null, state: g.state, dim: g.dim, land: L ? { alt: L.alt, t: L.t, hovered: L.hovered || 0 } : null, flState: fl ? fl.state : null, glow: VR.SpaceFlight.debug.state(g).glow || 0 }; });
const view = (P, v, hp, hy) => P.ev(([v, hp, hy]) => { const fl = VR.game.flight; fl.view = v; VR.game.camMode = v === 0 ? 0 : 1; fl.headPitch = hp; fl.headYaw = hy || 0; fl.backT = 0; fl.recenter = false; fl.mouseIdle = 0; fl.chaseYaw = null; fl.shot = null; fl.shakeAmp = 0; fl.bump = 0; }, [v, hp, hy]);
const chase = (P, hp, hy) => view(P, 1, hp, hy);
const keep = (P, k) => P.ev((k) => { window[k] = window.__F; }, k);
async function waitPlay(P, maxMs) { const t0 = Date.now(); for (;;) { await P.step(2); const s = await P.ev(() => VR.game.state === 'play' && !(VR.Travel && VR.Travel.busy && VR.Travel.busy(VR.game))); if (s) return true; if (Date.now() - t0 > maxMs) return false; await P.wait(150); } }
async function board(P) {
  const ap = await P.ev(() => VR.SpaceFlight.apron());
  const ay = await P.groundY(ap.x, ap.z);
  await P.ev(([x, y, z]) => { const g = VR.game, p = g.player; p.flying = false; p.noclip = false; p.teleport(x + 0.5, y + 1, z + 12.5); p.yaw = 0; g.starships.placeInFront(4242, 'shuttle', null, p); }, [ap.x, ay, ap.z]);
  const mine = () => P.ev(() => { const s = VR.game.starships.ships.find(q => q.d.seed === 4242 && !q.hangar); return !!(s && s.d.meta && s.d.cells); });
  for (let i = 0; i < 90; i++) { await P.step(4); if (await mine()) break; await P.wait(100); }
  return P.ev(() => { const g = VR.game, s = g.starships.ships.find(q => q.d.seed === 4242 && !q.hangar); if (!s || !s.d.meta || !s.d.cells) return null; g.starships.board(s, g.player); const fl = s.flight; fl.power = 'running'; fl.startT = 3; return { name: s.d.meta.name, pilot: g.starships.pilot === s }; });
}
// the moon's sky now (bodysky.js): its light, the sky's stops
const skyNow = (P) => P.ev(() => { const g = VR.game, E = g.env && g.env.E, B = VR.BodySky, c = B && B.cur; return { dimId: E && E.dimId, want: B && B.want, zenith: E && E.zenith && E.zenith.map(v => +v.toFixed(3)), fog: E && E.fog && E.fog.map(v => +(+v).toFixed(2)), expo: E && +(+E.exposure).toFixed(2), sunEl: c && +c.light.sunEl.toFixed(3), parEl: c && +c.light.parEl.toFixed(3), parPhase: c && +c.light.parPhase.toFixed(2), amb: c && c.light.ambSky.map(v => +v.toFixed(4)), moon: c && c.light.moonColor.map(v => +v.toFixed(4)), par: c && c.raw && c.raw.parent && Array.from(c.raw.parent.dir).map(v => +v.toFixed(3)), parId: c && c.raw && c.raw.parent && c.raw.parent.id }; });
// day on the moon's site: Helia 15–35° up, the parent over the horizon (the black sky's showpiece: sharp shadows)
const dayHour = (P) => P.ev(() => {
  const g = VR.game, U = VR.Universe, B = VR.BodySky; let best = null;
  for (let day = 1; day < 30; day++) for (let tk = 0; tk < 24000; tk += 500) {
    const r = B.compute(g.dim, B.eye, U.worldSeconds(day, tk), { tier: 2 });
    if (!r || r.light.sunEl < 0.25 || r.light.sunEl > 0.62 || r.light.free < 0.99) continue;
    const sc = (r.light.parEl > 0.1 ? 1 : 0) - Math.abs(r.light.sunEl - 0.4);
    if (!best || sc > best.sc) best = { day, tk, sc, sunEl: +r.light.sunEl.toFixed(2), parEl: +r.light.parEl.toFixed(2) };
  }
  if (best) { g.env.day = best.day; g.env.setTime(best.tk); }
  return best;
});
// night on the moon's site: the hour (within 30 days) when Helia is down and the parent's light is the most
const nightHour = (P) => P.ev(() => {
  const g = VR.game, U = VR.Universe, B = VR.BodySky; let best = null;
  for (let day = 1; day < 30; day++) for (let tk = 0; tk < 24000; tk += 500) {
    const t = U.worldSeconds(day, tk), r = B.compute(g.dim, B.eye, t, { tier: 2 });
    if (!r || r.light.sunEl > -0.12) continue;
    const m = r.light.moonColor[1], sc = m + (r.light.parEl > 0.15 && r.light.parEl < 0.8 ? 0.2 : 0);
    if (!best || sc > best.sc) best = { day, tk, sc, sunEl: +r.light.sunEl.toFixed(2), parEl: +r.light.parEl.toFixed(2), moon: +m.toFixed(4) };
  }
  if (best) { g.env.day = best.day; g.env.setTime(best.tk); }
  return best;
});
// the descent into a moon's world (V round it): the trip, the ship over the site, the plume picture at ~30 m, landed
async function descent(P, body, name, sfx, Rr, night) {
  const D = Rr[name] = {};
  await P.ev(() => VR.SpaceFlight.land(VR.game.flight));
  for (let i = 0; i < 40; i++) { await P.step(10); const s = await state(P); if (s.state !== 'play' || s.dim !== 'overworld') break; }
  const ok = await waitPlay(P, 120000);
  await P.step(2);
  let s = await state(P);
  for (let i = 0; i < 200 && !s.land; i++) { await P.step(5); await P.wait(50); s = await state(P); }
  check(ok && s.dim === body && !!s.land, `${body}: the trip with the ship, over the site (${s.dim}, ${s.land ? Math.round(s.land.alt) + ' m up' : 'not in the air'}) (${secs()})`);
  if (!s.land) return D;
  D.hour = night ? await nightHour(P) : await dayHour(P); console.log(`  ${body}: ${night ? 'night' : 'day'} ${JSON.stringify(D.hour)}`);
  let shot = false;
  for (let i = 0; i < 700; i++) {
    await P.step(10); s = await state(P);
    if (!s.land) break;
    if (!shot && s.land.alt < 34 && s.land.alt > 12) {
      await chase(P, HP, 2.6); await P.step(3);
      await keep(P, '__Fd');
      const m = await picture(P, '__Fd', SH(`${name}${sfx}.png`), K), m0 = await picture(P, '__Fd', SH(`${name}${sfx}_np.png`), 1, { noPart: true });
      D.pic = m; D.plume = await plumeOf(SH(`${name}${sfx}.png`), SH(`${name}${sfx}_np.png`)); D.sky = await skyNow(P); shot = true;
      console.log(`  ${body}: the descent picture at ${Math.round(s.land.alt)} m: ${JSON.stringify(m)}; the plume ${JSON.stringify(D.plume)}; the sky ${JSON.stringify(D.sky)} (${secs()})`);
    }
    if (i % 20 === 0) await P.wait(40);
  }
  const fin = await state(P);
  D.landed = fin.flState === 'landed';
  check(shot && D.landed, `${body}: down through the plume and landed (${fin.flState})`);
  if (D.landed && body === 'opal') {
    await P.settle(300); await chase(P, 0.22, 2.2); await P.step(4); await keep(P, '__Fl');
    // toward Amarant: the kept camera turned to its direction, a little under it (the ground in the lower part)
    const sk = await skyNow(P), d = sk.par || [0, 1, 0], el = Math.asin(Math.max(-1, Math.min(1, d[1])));
    const cam = { yaw: Math.atan2(-d[0], -d[2]), pitch: Math.max(0.05, Math.min(el - 0.3, 0.55)) };
    D.landedPic = await picture(P, '__Fl', SH(`landed_${body}${sfx}.png`), K, { cam });
    D.landedSky = sk;
    console.log(`  ${body}: landed, toward ${sk.parId} (el ${r1(el * 57.3)}°): ${JSON.stringify(D.landedPic)} (${secs()})`);
  }
  return D;
}
// Herzwelt's entry from a low orbit (V): the deorbit burn, the plasma at its peak (the overlay laid over)
async function entry(P, sfx, Rr) {
  const D = Rr.entry = {};
  await P.ev(() => { const g = VR.game; VR.SpaceFlight.debug.orbit(g, 0, 40, 3063); });
  await P.step(30, 1);
  await P.ev(() => VR.SpaceFlight.land(VR.game.flight));
  let s = await state(P), best = 0, shot = false;
  for (let i = 0; i < 900; i++) {
    await P.step(5); s = await state(P);
    if (s.glow > best) best = s.glow;
    if (!shot && s.glow > 0.55) {
      await chase(P, 0.12, 2.5); await P.step(2); await keep(P, '__Fe');
      D.pic = await picture(P, '__Fe', SH(`entry_glow${sfx}.png`), K, { overlay: true }); shot = true;
      console.log(`  entry: the plasma at ${r1(s.glow)}: ${JSON.stringify(D.pic)} (${secs()})`);
      break;
    }
    if (s.regime === 'air' && i > 50) break;
  }
  D.glowMax = r1(best);
  check(shot, `entry: the plasma pictured (glow max ${D.glowMax})`);
}

async function runPage(url, sfx) {
  const Rr = rec.pages[sfx || 'now'] = {};
  console.log(`\n${sfx ? 'v0.51' : 'this build'} (${secs()})`);
  const P = await openPage(url);
  try {
    check(await makeWorld(P), `the world is loaded (${secs()})`);
    const bd = await board(P);
    check(!!bd && bd.pilot, `the shuttle on the apron, boarded (${bd && bd.name})`); if (!bd) return;
    await P.step(20);
    for (const [body, name, night] of [['opal', 'descent_opal', false], ['basalt', 'descent_basalt_night', true]]) {
      if (!want(body)) continue;
      const d0 = await P.ev(() => VR.game.dim);
      if (d0 !== 'overworld') { await P.ev(() => VR.game.goHome()); await waitPlay(P, 60000); await P.step(60); }
      const bd2 = await P.ev(() => !!(VR.game.flight && VR.game.flight.b && VR.game.starships.pilot));
      if (!bd2) await board(P);
      await P.ev((b) => { const g = VR.game; VR.SpaceFlight.debug.orbit(g, 0, 40, 3063); VR.SpaceFlight.jumpStart(g.flight, b); }, body);
      await P.step(220);
      const s = await state(P);
      check(s.frame === body, `the Reisesprung to ${body} (${s.frame})`);
      if (s.frame === body) { await chase(P, 0.12, 0); await descent(P, body, name, sfx, Rr, night); }
      save();
    }
    if (want('entry')) {
      const d0 = await P.ev(() => VR.game.dim);
      if (d0 !== 'overworld') { await P.ev(() => VR.game.goHome()); await waitPlay(P, 60000); await P.step(60); }
      const bd2 = await P.ev(() => !!(VR.game.flight && VR.game.flight.b && VR.game.starships.pilot));
      if (!bd2) await board(P);
      await entry(P, sfx, Rr);
    }
    Rr.errors = errsOf(P);
    check(errsOf(P).length === 0, `no page error (${errsOf(P).length})` + (errsOf(P).length ? ': ' + errsOf(P)[0].slice(0, 400) : ''));
    save();
  } catch (e) { check(false, `${String(e.stack || e.message || e).slice(0, 500)}`); }
  finally { await P.ctx.close().catch(() => {}); }
  return Rr;
}

if (BASE) await runPage(BASE, '_base');
const N = await runPage(DIST, '');
await browser.close();
// the gates (this build): the airless frames black at the top, Opal's plume brighter than its ground, Basalt's darker
if (N.descent_opal && N.descent_opal.pic) {
  check(N.descent_opal.pic.top <= 25, `descent_opal: the top 30 % black (luma ${N.descent_opal.pic.top} ≤ 25)`);
  check(N.descent_opal.plume.px > 200 && N.descent_opal.plume.with > N.descent_opal.plume.without, `descent_opal: the plume brighter than the ice (${N.descent_opal.plume.with} > ${N.descent_opal.plume.without}, ${N.descent_opal.plume.px} px)`);
}
if (N.descent_opal && N.descent_opal.landedPic) check(N.descent_opal.landedPic.top <= 25, `landed_opal: the top 30 % black (luma ${N.descent_opal.landedPic.top} ≤ 25)`);
if (N.descent_basalt_night && N.descent_basalt_night.pic) {
  const p = N.descent_basalt_night.pic;
  check(p.top <= 25, `descent_basalt_night: the top black (luma ${p.top} ≤ 25)`);
  check(p.mean >= 12, `descent_basalt_night: the ground readable in the earthshine (mean ${p.mean} ≥ 12)`);
}
try {
  const f = (n) => { const p = SHOTS + n; try { return fs.statSync(p).mtimeMs >= T0 ? p : null; } catch (e) { return null; } };
  const rows = [];
  for (const [label, n] of [['Opal · Abstieg', 'descent_opal'], ['Opal · gelandet, Amarant', 'landed_opal'], ['Basalt · Nacht', 'descent_basalt_night'], ['Herzwelt · Eintritt', 'entry_glow']]) {
    const imgs = [f(n + '_base.png'), f(n + '.png')].filter(Boolean); if (imgs.length) rows.push({ label: label + ' (v0.51 | jetzt)', imgs });
  }
  fs.writeFileSync(ROOT + '.tmp_tests/orbit2_desc_sheet.json', JSON.stringify({ w: 620, rows }));
  execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + 'orbit2_desc_sheet.jpg', ROOT + '.tmp_tests/orbit2_desc_sheet.json']);
  console.log('sheet: ' + SHOTS + 'orbit2_desc_sheet.jpg');
} catch (e) { console.log('(no sheet: ' + String(e.message || e).slice(0, 200) + ')'); }
save();
console.log(`\n${fails ? 'FAILED ' + fails : 'ALL OK'} (${secs()})`);
