// The trailer's sky in the game, measured against the frames (t-sky). Three places framed like the trailer — the canyon
// vista (t1_01: over the Ember Canyon, the dusk sun right of centre, the Spire Citadel on the horizon), the city street
// (t3_05, t1_24: over the Nova Haven avenue at the villas' upper floors) and the Sky Isles (t1_07) — at noon (6000),
// 15:00 (9000), dusk 19:00
// (13000) and night 23:00 (17000), the camera pitched up 12° so the upper part of the picture is sky (vertical fov 72°,
// 1280 × 720), the ringed giant and the blue planet pinned in view as the director pins them for the trailer's shots.
// Every picture is taken twice: as it is (test/shots/trailer_skycurve_<place>_<time>_<TAG>.png) and with the sky
// painted magenta (the renderer's probe, .tmp_tests/skyprobe_*.png): the sky pixels are the magenta ones, less a
// cone round the sun (by day 30°: the disc, the bloom and the rays round it — the day frames have no sun in view; at dusk
// 14°: the dusk frames' rectangles come that close) and round the planets and moons (their discs and rings). The
// horizon line is where the land meets the sky (the lowest sky row per column, the 80th percentile over the columns);
// from it to the top, 8 bands: the trimmed mean colour per band (test/sky_ref.js, the same functions as the frames'),
// its CIELAB colour and the CIE76 distance to the trailer's target (docs/trailer/sky_ref.json): the day target for noon
// and 15:00, the dusk target for 19:00. The space: stars, local contrast and nebula of the top two bands.
// Checks (ALL OK / FAILED n): the pictures written, no page errors; by day every band within ΔE 12 of the day target (with
// the sun in the picture the upper half, bands 4–7),
// the stars and the nebula visible in the top bands (local contrast and colour variation), the horizon band bright and
// clean (no stars); at dusk every band within ΔE 12 of the dusk target; at night a dark sky with stars; the Very Low
// sky pass (the sky drawn alone, the median of 5 blocks of 24 passes at the potato size): with DIST_BEFORE the same
// in the baseline build, interleaved (A B A B …), and not slower than it (within 3 %).
// Also the Very Low pictures of the city at noon and the canyon at dusk, and the Very Low frame time of the canyon.
// TAG (default after) names the pictures; DIST (default the dist/ of this checkout) is the build under test;
// DIST_BEFORE (optional) the baseline build for the sky-pass comparison.
// usage: TAG=after DIST_BEFORE=.tmp_tests/dist_before/index.html nohup bash test/wt_run.sh trailer_skycurve.mjs 2400 > .tmp_tests/trailer_skycurve.log 2>&1 &
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import SR from '/home/claude/vr/test/sky_ref.js';
const { load, curveOf, spaceOf, bandRows, compare, NB, REF } = SR;

const TAG = process.env.TAG || 'after';
const DIST = process.env.DIST || '/home/claude/vr/dist/index.html';
const DIST_BEFORE = process.env.DIST_BEFORE || '';
const ref = JSON.parse(fs.readFileSync(REF, 'utf8'));
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const logs = [];
const attach = (pg, tag) => {
  pg.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || /error|fail|missing/i.test(s)) logs.push(`[${tag} ${t}] ${s.slice(0, 600)}`); });
  pg.on('pageerror', e => logs.push(`[${tag} pageerror] ` + (e.stack || e.message).slice(0, 1200)));
};
const page = await ctx.newPage();
attach(page, 'test');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 16) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(4); } };
// the land in view built before a picture: no worker busy, no column pending or still wanted, no section dirty, no far
// tile in flight (a teleport of 400 blocks into the Heartland takes a while on the shared machine)
const settle = async (max = 150) => { for (let i = 0; i < max; i++) { await step(10); const s = await ev(() => { const g = VR.game; let dirty = 0; for (const c of g.world.cols.values()) for (const sc of c.sec) if (sc.dirty || sc.pending) dirty++; return { busy: g.pool.busy, pend: g.world.pending.size, dirty, want: g.world.lastWant || 0, lod: g.horizon ? g.horizon.inflight || 0 : 0 }; }); if (s.busy === 0 && s.pend === 0 && s.dirty === 0 && !s.want && !s.lod && i > 3) break; await wait(80); } };
const shotPath = (name) => `/home/claude/vr/test/shots/${name}.png`;
const probePath = (name) => `/home/claude/vr/.tmp_tests/skyprobe_${name}.png`;
// three frames drawn, then the screenshot; probe: the sky painted magenta (the god rays off, so no magenta light lands on the land)
const draw = (probe) => ev((probe) => {
  const g = VR.game, R = g.renderer;
  if (!document.getElementById('__nohint')) { const st = document.createElement('style'); st.id = '__nohint'; st.textContent = '#hint,#hints{display:none !important}'; document.head.appendChild(st); }   // the "B = build hand" toast (VR.Hints' #hints)
  R.skyProbe = !!probe;
  const G = VR.Grade || {}; const rays = G.rays; if (probe) G.rays = 0;
  window.__norender = false;
  for (let i = 0; i < 3; i++) { g.last = performance.now() - 33; g.loop(performance.now()); }
  R.gl.finish(); window.__norender = true;
  R.skyProbe = false; if (probe) G.rays = rays;
}, probe);
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };

// domcontentloaded, and one retry: the default 'load' wait timed out once on the loaded machine (trailer_look.mjs)
for (let attempt = 1; ; attempt++) {
  try { await page.goto('file://' + DIST, { waitUntil: 'domcontentloaded', timeout: 180000 }); break; }
  catch (e) { if (attempt >= 2) throw e; console.log('goto failed once (' + e.message.split('\n')[0] + '), again'); }
}
for (let i = 0; i < 240; i++) { await wait(500); if (await ev(() => typeof VR !== 'undefined' && !!VR.game && VR.game.state === 'title').catch(() => false)) break; }
await ev(() => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.settings.renderDist = 10; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Trailer Sky Curve',mode:'creative',difficulty:'peaceful',type:'default',seed:'4242',cheats:true,kit:true})`);
for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.zenFreezeWeather = true; g.env.wx.force('klar'); g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.display = 'none'; });

// ------------------------------------------------------------ the places and times
// yaw 0 looks along −z (north); an object δ to the right of the view lies at yaw (view − δ) (renderer.setupCamera)
const TIMES = [['noon', 6000, 'day'], ['t15', 9000, 'day'], ['dusk', 13000, 'dusk'], ['night', 17000, null]];
const PLACES = [
  // over the canyon's east half, looking west-north-west across it to the citadel on the horizon: at 19:00 the sun stands 26° right of centre (t1_01)
  { name: 'canyon', cam: [250, 150, 380], yaw: 1.36 },
  // over the Nova Haven avenue at the villas' upper floors (18 blocks up), north-north-east over the roofs and palms to
  // the Pod Hills (t3_05, t1_24): at street level the near walls and the hills hide the low sky the frames show
  { name: 'city', cam: [0, 100, -90], yaw: -0.35 },
  // east-south-east of the Sky Isles, looking at them with the dusk sun at the right (t1_07)
  { name: 'isles', cam: [565, 195, 190], yaw: 1.36 },
];
const PITCH = 12 * Math.PI / 180;
// the planets pinned in view (env.planetsOverride, as director.js pins them): the ringed giant 30° right of centre at
// 24° elevation, the blue planet 30° left at 36°
const azOf = (yaw) => Math.atan2(-Math.cos(yaw), -Math.sin(yaw));
const place = (P, tod) => ev(([cam, yaw, pitch, tod, pins]) => {
  const g = VR.game, p = g.player;
  g.env.setTime(tod); g.env.planetsOverride = pins;
  p.flying = true; p.noclip = true; p.teleport(cam[0], cam[1] - p.eye, cam[2]); p.yaw = yaw; p.pitch = pitch; p.fovKick = 0; p.vel = [0, 0, 0];
}, [P.cam, P.yaw, PITCH, tod, { az: azOf(P.yaw - 30 * Math.PI / 180), el: 24, az2: azOf(P.yaw + 30 * Math.PI / 180), el2: 36 }]);

// ------------------------------------------------------------ the measurement of one picture
const W = 640, H = 360;
const matVec = (m, v) => [0, 1, 2, 3].map(i => m[i] * v[0] + m[4 + i] * v[1] + m[8 + i] * v[2] + m[12 + i] * v[3]);
const ang = (a, b) => Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
const normv = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
async function measure(name, geo, kind) {
  const img = await load(shotPath(name), W, H), pr = await load(probePath(name), W, H);
  const sky = new Uint8Array(W * H), mask = new Uint8Array(W * H);
  // the sun's cone: by day 30° (its disc, the bloom and the rays round it: the day frames have no sun in view), else 14°
  const bodies = [[geo.sun, (kind === 'day' ? 30 : 14) * Math.PI / 180], [geo.giant, geo.rg * 2.6], [geo.blue, geo.rb * 1.6], ...geo.moons.map(m => [[m[0], m[1], m[2]], m[3] * 1.8])];
  let sunMin = Math.PI;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = (y * W + x) * 3, R = pr.d[p], G = pr.d[p + 1], B = pr.d[p + 2];
    const c = matVec(geo.inv, [(x + 0.5) / W * 2 - 1, 1 - (y + 0.5) / H * 2, 1, 1]);
    const dir = normv([c[0] / c[3], c[1] / c[3], c[2] / c[3]]);
    sunMin = Math.min(sunMin, ang(dir, geo.sun));
    if (!(R > 140 && B > 140 && G < 0.55 * Math.min(R, B))) continue;   // magenta (at night the exposure lifts its green to ~100)
    sky[y * W + x] = 1;
    let ok = true;
    for (const [d, r] of bodies) if (ang(dir, d) < r) { ok = false; break; }
    if (ok) mask[y * W + x] = 1;
  }
  // the horizon line: the lowest sky row per column above the geometric horizon + 40 rows (water mirrors the probe below)
  const f = (H / 2) / Math.tan(36 * Math.PI / 180), y0 = Math.round(H / 2 + f * Math.tan(PITCH));
  const lows = [];
  for (let x = 0; x < W; x++) { let low = -1; for (let y = 0; y < Math.min(H, y0 + 40); y++) if (sky[y * W + x]) low = y; if (low > 5) lows.push(low + 1); }
  lows.sort((a, b) => a - b);
  const Hl = lows.length > W * 0.2 ? lows[Math.floor(lows.length * 0.8)] : y0;
  const inMask = (x, y) => x >= 0 && y >= 0 && x < W && y < H && mask[y * W + x] === 1;
  const curve = curveOf(img, Hl, inMask);
  const space = spaceOf(img, 0, bandRows(Hl, NB - 2)[1], inMask);
  const hband = spaceOf(img, bandRows(Hl, 0)[0], Hl, inMask);
  let skyN = 0; for (let i = 0; i < W * H; i++) skyN += mask[i];
  return { H: Hl, y0, sky: +(skyN / (W * H)).toFixed(3), curve, space, hband, sunInView: geo.sun[1] > 0 && sunMin < 2 * Math.PI / 180 };
}
const geoOf = () => ev(() => { const g = VR.game, R = g.renderer, E = g.env.E, B = E.bodies; return { inv: Array.from(R.invVPNJ || R.invViewProj), sun: E.sunDir, giant: E.planetDir, blue: E.planet2Dir, rg: B ? B.radius.giant : 0.122, rb: B ? B.radius.blue : 0.085, moons: B ? B.moons : [], night: E.night }; });
const fmtCurve = (c) => c.map(b => (b.lab ? `${b.rgb.map(v => Math.round(v)).join(',')}` : '—')).join(' | ');

const results = [];
const shootAt = async (P, T, preset) => {
  await place(P, T[1]);
  await settle();
  await ev(() => { const e = VR.game.entities; if (e && e.mobs) e.mobs.length = 0; });
  await step(6);
  const name = `trailer_skycurve_${P.name}_${T[0]}${preset === 'high' ? '' : '_' + preset}_${TAG}`;
  await draw(false);
  await page.screenshot({ path: shotPath(name), timeout: 240000 });
  const geo = await geoOf();
  await draw(true);
  await page.screenshot({ path: probePath(name), timeout: 240000 });
  await draw(false);
  const m = await measure(name, geo, T[2]);
  const target = T[2] ? ref.targets[T[2]] : null;
  const dEs = target ? compare(m.curve, target) : null;
  const r = { name, place: P.name, time: T[0], kind: T[2], preset, ...m, dE: dEs, geo };
  results.push(r);
  console.log(`shot ${name}  H ${m.H} (geometric ${m.y0})  sky ${m.sky}${m.sunInView ? '  the sun in view' : ''}  space ${JSON.stringify(m.space)}  horizon stars ${m.hband.stars}`);
  console.log('   curve  ' + fmtCurve(m.curve));
  console.log('   L*     ' + m.curve.map(b => (b.lab ? b.L.toFixed(0) : '—')).join(' '));
  if (dEs) console.log('   ΔE(' + T[2] + ') ' + dEs.map(v => (v === null ? '—' : v.toFixed(1))).join(' '));
  return r;
};

console.log('== the pictures on High (' + TAG + ')');
for (const P of PLACES) for (const T of TIMES) await shootAt(P, T, 'high');

// ------------------------------------------------------------ Very Low: two pictures, the frame time, the sky pass
await ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.dynRes = false; g.applySettings('*'); });
await settle();
await shootAt(PLACES[1], TIMES[0], 'potato');
await shootAt(PLACES[0], TIMES[2], 'potato');
const frameMs = [];
for (let b = 0; b < 4; b++) frameMs.push(await ev(() => { const g = VR.game; window.__norender = false; const t0 = performance.now(); for (let i = 0; i < 3; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } const gl = g.renderer.gl; gl.bindFramebuffer(gl.FRAMEBUFFER, null); const px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); window.__norender = true; return (performance.now() - t0) / 3; }));
frameMs.sort((a, b) => a - b);
console.log('potato frame ' + JSON.stringify({ ms: frameMs.map(v => +v.toFixed(1)), median: +((frameMs[1] + frameMs[2]) / 2).toFixed(1) }));

// the sky pass alone: the sky program drawn N times into the scene target at the potato size, the GPU waited for with a
// one-pixel read of the canvas; the same camera and time (the canyon at dusk) in both builds
const SKYBENCH = ([N, cam, yaw, pitch, tod]) => {
  const g = VR.game, R = g.renderer, gl = R.gl;
  g.env.setTime(tod);
  const E = g.env.update(0, { dim: 'overworld', biome: null, eyeSky: 1, renderDist: 4, horizon: 0, freezeTime: true, freezeWeather: true });
  R.setupCamera({ x: cam[0], y: cam[1], z: cam[2], yaw, pitch, fov: 72 * Math.PI / 180 });
  const p = R.P.sky;
  const sync = () => { gl.bindFramebuffer(gl.FRAMEBUFFER, null); const px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
  const once = () => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, R.sceneFB); gl.viewport(0, 0, R.w, R.h);
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.CULL_FACE);
    gl.useProgram(p.p); R.common(p, E);
    if (p.u.u_skyProbe) gl.uniform1f(p.u.u_skyProbe, 0);
    gl.uniformMatrix4fv(p.u.u_invViewProj, false, R.invViewProj);
    if (p.u.u_cirrus) gl.uniform1f(p.u.u_cirrus, R.q.clouds >= 2 ? 1 : 0);
    R.fs(p);
  };
  once(); once(); sync();
  const t0 = performance.now();
  for (let i = 0; i < N; i++) once();
  sync();
  return { ms: (performance.now() - t0) / N, w: R.w, h: R.h, lite: !!R.q.lite };
};
const benchArgs = [24, PLACES[0].cam, PLACES[0].yaw, PITCH, 13000];
let before = null;
if (DIST_BEFORE && fs.existsSync(DIST_BEFORE)) {
  // the baseline build at its title screen, on Very Low; its title world torn down, the loop stopped
  before = await ctx.newPage();
  attach(before, 'before');
  await before.goto('file://' + DIST_BEFORE, { waitUntil: 'domcontentloaded', timeout: 180000 });
  for (let i = 0; i < 240; i++) { await before.waitForTimeout(500); if (await before.evaluate(() => typeof VR !== 'undefined' && VR.game && VR.game.state === 'title').catch(() => false)) break; }
  await before.evaluate(() => { const g = VR.game; window.requestAnimationFrame = () => 0; g.applyPreset('potato'); g.settings.dynRes = false; g.applySettings('*'); });
}
const skyA = [], skyB = [];
for (let b = 0; b < 5; b++) {
  if (before) skyB.push(await before.evaluate(SKYBENCH, benchArgs));
  skyA.push(await ev(SKYBENCH, benchArgs));
}
const med = (v) => { const s = v.map(x => x.ms).sort((a, b) => a - b); return s[s.length >> 1]; };
const skyAfter = med(skyA), skyBefore = before ? med(skyB) : null;
console.log('potato sky pass ' + JSON.stringify({ tag: TAG, size: skyA[0].w + 'x' + skyA[0].h, lite: skyA[0].lite, ms: skyA.map(s => +s.ms.toFixed(2)), median: +skyAfter.toFixed(2), before: before ? { ms: skyB.map(s => +s.ms.toFixed(2)), median: +skyBefore.toFixed(2) } : null }));
if (before) await before.close().catch(() => {});

// ------------------------------------------------------------ the checks
console.log('\n== checks (' + TAG + ')');
const hi = results.filter(r => r.preset === 'high');
for (const r of hi) {
  const f = 'test/shots/' + r.name + '.png';
  check(fs.existsSync(f) && fs.statSync(f).size > 20000, `picture ${r.name} written`);
}
check(logs.filter(l => /pageerror|\berror\]/.test(l)).length === 0, 'no page or WebGL errors');
const LIM = 12;
// every band, except by day with the sun in the picture: the day frames have no sun in view, so there the upper half
// (bands 4–7, the dark top) is held to the target and the lower half reported
for (const r of hi.filter(r => r.kind)) {
  const from = r.kind === 'day' && r.sunInView ? 4 : 0;
  const bad = r.dE.map((v, k) => [k, v]).filter(([k, v]) => k >= from && v !== null && r.curve[k].n >= 100 && v > LIM);
  const measured = r.dE.filter((v, k) => k >= from && v !== null && r.curve[k].n >= 100).length;
  check(bad.length === 0 && measured >= (from ? 3 : 6), `${r.place} ${r.time}: the sky within ΔE ${LIM} of the ${r.kind} target in ${from ? 'the upper half (the sun in view)' : 'every band'} (${measured} bands measured; ΔE ${r.dE.map(v => (v === null ? '—' : v.toFixed(0))).join(' ')})`);
}
const dayT = ref.targets.day;
for (const r of hi.filter(r => r.kind === 'day')) {
  const s = r.space;
  check(s.n > 0 && s.contrast >= 0.5 * dayT.space.contrast && (s.stars >= 0.25 * dayT.space.stars || s.nebula >= 0.5 * dayT.space.nebula), `${r.place} ${r.time}: stars and nebula show through the day at the top (contrast ${s.contrast} vs the frames' ${dayT.space.contrast}, stars ${s.stars} vs ${dayT.space.stars}, nebula ${s.nebula} vs ${dayT.space.nebula})`);
  const b0 = r.curve[0];
  check(b0.lab && b0.L >= dayT.bands[0].L - 10 && (r.hband.stars || 0) < 1, `${r.place} ${r.time}: the horizon band bright and clean (L* ${b0.L} vs the frames' ${dayT.bands[0].L}, stars ${r.hband.stars})`);
}
// night: dark, with stars; the nebula at full strength may lift the top to the trailer's dusk top (L* 30)
for (const r of hi.filter(r => r.time === 'night')) {
  const top = r.curve[NB - 1], low = r.curve[0];
  check(top.lab && low.lab && top.L < 35 && low.L < 50 && r.space.stars > 0.5, `${r.place} night: a dark sky (top L* ${top.L}, horizon L* ${low.L}) with stars (${r.space.stars})`);
}
if (before) check(skyAfter <= skyBefore * 1.03, `Very Low: the sky pass is not slower than the baseline's (${skyAfter.toFixed(2)} ms vs ${skyBefore.toFixed(2)} ms a pass at ${skyA[0].w}x${skyA[0].h})`);
fs.writeFileSync('/home/claude/vr/.tmp_tests/skycurve_' + TAG + '.json', JSON.stringify({ tag: TAG, results: results.map(r => ({ name: r.name, place: r.place, time: r.time, kind: r.kind, preset: r.preset, H: r.H, sky: r.sky, space: r.space, hband: r.hband, dE: r.dE, curve: r.curve.map(b => ({ n: b.n, rgb: b.rgb, L: b.L, C: b.C, h: b.h })), geo: r.geo })), frameMs, sky: { after: skyAfter, before: skyBefore, a: skyA.map(s => s.ms), b: skyB.map(s => s.ms) } }, null, 1));
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 12)) console.log(l);
await browser.close();
console.log(fails === 0 ? 'ALL OK' : 'FAILED ' + fails);
