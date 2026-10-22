// t-sky3 · the sky lab (docs/superpowers/plans/2026-10-16-t-sky3.md §5): a quick browser check before the long run of
// test/sky3.mjs — no world is made: at the title every preset's programs are built (a shader that does not compile is a
// page error), then the sky and the clouds alone are drawn (renderer.render with no world: the sky pass, the cumulus
// sprites, the post chain with t-light2's grade) for the views of test/sky3.mjs at their hours, and measured with the
// same functions against the frames' bands (the horizon line from the full run's pictures, run 1). The pictures go to
// test/shots/sky3lab_<view>.png and a sheet; the sky pass's cost on High beside.
//   TAG=lab · ONLY=canyon_golden,... (views) · W=1280 H=720
// usage: nohup bash test/wt_run.sh sky3_lab.mjs 900 > .tmp_tests/sky3_lab.log 2>&1 &
// regress: skip  (a tool: the pictures and the numbers are for the tuning)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);
const ROOT = new URL('../', import.meta.url).pathname;
const SR = require(ROOT + 'test/sky_ref.js');
const { load, curveOf, compare, NB } = SR;
const TAG = process.env.TAG || 'lab', ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const VW = +(process.env.W || 1280), VH = +(process.env.H || 720);
const DIST = process.env.DIST || 'file://' + ROOT + 'dist/index.html';
const SHOTS = ROOT + 'test/shots/', TMP = ROOT + '.tmp_tests/';
fs.mkdirSync(SHOTS, { recursive: true }); fs.mkdirSync(TMP, { recursive: true });
const ref = JSON.parse(fs.readFileSync(SR.REF, 'utf8'));
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };

const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, locale: 'de-DE' });
const logs = [];
const page = await ctx.newPage();
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail|shader/i.test(s)) logs.push(`[${t}] ${s.slice(0, 1500)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
const ev = (fn, arg) => page.evaluate(fn, arg);
await page.goto(DIST, { waitUntil: 'domcontentloaded', timeout: 180000 });
for (let i = 0; i < 240; i++) { await page.waitForTimeout(500); if (await ev(() => typeof VR !== 'undefined' && !!VR.game && VR.game.state === 'title').catch(() => false)) break; }
console.log(`[${secs()}] title; Sky3 ${await ev(() => !!VR.Sky3)}`);
await ev(() => { window.requestAnimationFrame = () => 0; const h = document.getElementById('hud'); if (h) h.style.display = 'none'; const st = document.createElement('style'); st.textContent = '#hint,#hints,#toasts,.toast,#title,#menu,.menu,.screen,.overlay{display:none !important}'; document.head.appendChild(st); });

// ---------------------------------------------------------------- every preset's programs
const progs = {};
for (const pr of ['potato', 'low', 'balanced', 'high', 'ultra']) {
  const n0 = logs.length;
  const r = await ev((pr) => { try { const g = VR.game; g.applyPreset(pr); g.settings.dynRes = false; g.applySettings('*'); const R = g.renderer; R.buildPrograms(); return { ok: true, n: Object.keys(R.P).length, key: VR.Sky3 ? VR.Sky3.key(R.q) : '', defs: VR.Sky3 ? [VR.Sky3.definesFor('sky', R.q), VR.Sky3.definesFor('puff', R.q), VR.Sky3.definesFor('cloud', R.q)] : null }; } catch (e) { return { ok: false, err: String(e.message || e).slice(0, 2000) }; } }, pr);
  progs[pr] = r;
  check(r.ok && logs.length === n0, `${pr}: every program compiles (${r.ok ? r.n + ' programs, sky3 ' + r.key + ' ' + JSON.stringify(r.defs) : r.err})`);
}

// ---------------------------------------------------------------- the views (test/sky3.mjs's places and hours)
const PLACES = { canyon: { cam: [250, 150, 380], yaw: 1.36, H: 225 }, city: { cam: [0, 100, -90], yaw: -0.35, H: 205 }, isles: { cam: [565, 195, 190], yaw: 1.36, H: 230 } };
const HOURS = { noon: [6000, 'day'], golden: [10800, 'golden'], dusk: [11900, 'dusk'], afterglow: [12400, 'dusk'], night: [17000, null], dawn: [23600, 'dusk'] };
const PITCH = 12 * Math.PI / 180;
const azOf = (yaw) => Math.atan2(-Math.cos(yaw), -Math.sin(yaw));
const VIEWS = [];
for (const h of ['noon', 'golden', 'dusk', 'afterglow', 'night', 'dawn']) VIEWS.push({ name: 'canyon_' + h, place: 'canyon', hour: h });
for (const h of ['noon', 'golden', 'dusk', 'night']) VIEWS.push({ name: 'city_' + h, place: 'city', hour: h });
for (const h of ['golden', 'dusk']) VIEWS.push({ name: 'isles_' + h, place: 'isles', hour: h });
VIEWS.push({ name: 'up', place: 'city', hour: 'noon', pitch: 85 * Math.PI / 180, measure: false });
VIEWS.push({ name: 'upnight', place: 'city', hour: 'night', pitch: 85 * Math.PI / 180, measure: false });
VIEWS.push({ name: 'gap', place: 'canyon', hour: 'golden', wx: 'bewoelkt', aim: 'sun', pitch: 8 * Math.PI / 180, measure: false });
VIEWS.push({ name: 'storm', place: 'canyon', hour: 'noon', wx: 'regen', measure: false });
VIEWS.push({ name: 'aurora', place: 'city', hour: 'night', yaw: 0, pitch: 10 * Math.PI / 180, aurora: true, measure: false });
VIEWS.push({ name: 'meteor', place: 'city', hour: 'night', meteor: true, measure: false });
VIEWS.push({ name: 'moons', place: 'canyon', hour: 'dusk', moons: true, measure: false });
const SHOOT = VIEWS.filter(v => !ONLY || ONLY.includes(v.name));
await ev(() => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.applySettings('*'); });

// one sky-only frame: the env at the hour (frozen, the weather forced and its visuals set), the camera, render, finish
const DRAW = (a) => {
  const g = VR.game, R = g.renderer, env = g.env, S3 = VR.Sky3;
  env.setTime(a.tod); env.day = a.day; env.planetsOverride = a.pins;
  const X = env.wx; X.force(a.wx); if (VR.WX && VR.WX.VIS[a.wx]) Object.assign(X.v, VR.WX.VIS[a.wx]); X.front = 0; X.bow = 0; X.washed = 0;
  env.anim = 80;
  let E = null;
  for (let i = 0; i < 4; i++) { E = env.update(0, { dim: 'overworld', biome: null, eyeSky: 1, renderDist: 8, horizon: 4096, freezeTime: true, freezeWeather: true, drama: true, motion: true, wetOn: true }); env.exposure = 1 + E.night * 0.35; env.anim = 80; }
  E = env.update(0, { dim: 'overworld', biome: null, eyeSky: 1, renderDist: 8, horizon: 4096, freezeTime: true, freezeWeather: true, drama: true, motion: true, wetOn: true });
  R.skyProbe = !!a.probe;
  const G = VR.Grade || {}, rays = G.rays; if (a.probe) G.rays = 0;
  const cam = { x: a.cam[0], y: a.cam[1], z: a.cam[2], yaw: a.yaw, pitch: a.pitch, fov: 75 * Math.PI / 180, far: 1400 };
  for (let i = 0; i < 2; i++) R.render({ cam, world: null, env: E, horizon: null });
  R.gl.finish();
  R.skyProbe = false; if (a.probe) G.rays = rays;
  const o = E.sky3 || {};
  return { night: E.night, sun: E.sunDir, moons: o.moons ? o.moons.map(m => ({ dir: m.dir, k: +m.k.toFixed(2), r: m.r })) : null, meteor: o.meteor ? { p: o.meteor.p, vis: o.meteor.vis } : null, aurora: o.aurora || 0, inv: Array.from(R.invVPNJ || R.invViewProj), planet: E.planetDir, blue: E.planet2Dir, rg: E.bodies ? E.bodies.radius.giant : 0.122, rb: E.bodies ? E.bodies.radius.blue : 0.085, bm: E.bodies ? E.bodies.moons : [], extra: o.bodies || [] };
};
const W = 640, H = 360;
const matVec = (m, v) => [0, 1, 2, 3].map(i => m[i] * v[0] + m[4 + i] * v[1] + m[8 + i] * v[2] + m[12 + i] * v[3]);
const ang = (a, b) => Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
const normv = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
async function measure(name, geo, kind, Hl) {
  const img = await load(SHOTS + name + '.png', W, H), pr = await load(TMP + 'sky3labprobe_' + name + '.png', W, H);
  const mask = new Uint8Array(W * H);
  const bodies = [[geo.sun, (kind === 'day' ? 30 : 14) * Math.PI / 180], [geo.planet, geo.rg * 2.6], [geo.blue, geo.rb * 1.6], ...geo.bm.map(m => [[m[0], m[1], m[2]], m[3] * 1.8]), ...geo.extra.map(m => [[m[0], m[1], m[2]], m[3] * 1.8])];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = (y * W + x) * 3, R = pr.d[p], G = pr.d[p + 1], B = pr.d[p + 2];
    if (!(R > 140 && B > 140 && G < 0.55 * Math.min(R, B))) continue;
    const c = matVec(geo.inv, [(x + 0.5) / W * 2 - 1, 1 - (y + 0.5) / H * 2, 1, 1]);
    const dir = normv([c[0] / c[3], c[1] / c[3], c[2] / c[3]]);
    let ok = true; for (const [d, r] of bodies) if (ang(dir, d) < r) { ok = false; break; }
    if (ok) mask[y * W + x] = 1;
  }
  return curveOf(img, Hl, (x, y) => x >= 0 && y >= 0 && x < W && y < H && mask[y * W + x] === 1);
}
const results = [];
for (const V of SHOOT) {
  const P = PLACES[V.place], hr = HOURS[V.hour];
  let yaw = V.yaw !== undefined ? V.yaw : P.yaw, pitch = V.pitch !== undefined ? V.pitch : PITCH, tod = hr[0], day = 0, note = '';
  const pins = { az: azOf(P.yaw - 30 * Math.PI / 180), el: 24, az2: azOf(P.yaw + 30 * Math.PI / 180), el2: 36 };
  if (V.aurora) { const a = await ev(() => { const S = VR.Sky3, g = VR.game; for (let n = 0; n < 40; n++) { const k = S.auroraNight(g.env.wx.seed, n); if (k > 0.5) return { night: n, k }; } return null; }); if (a) { day = a.night; note = `aurora night ${a.night} (${a.k.toFixed(2)})`; } }
  if (V.meteor) {
    const m = await ev((tod) => VR.Sky3.meteorNext(VR.game.env.wx.seed, tod, 25), tod);
    if (m) { day = Math.floor(m.A / 24000); tod = (m.A % 24000) + m.dur * 20 * 0.45; const mid = normv([m.from[0] + m.to[0], m.from[1] + m.to[1], m.from[2] + m.to[2]]); yaw = Math.atan2(-mid[0], -mid[2]); pitch = Math.max(0.05, Math.asin(mid[1]) - 0.08); note = `meteor day ${day} tick ${Math.round(tod)}`; }
  }
  if (V.moons) {
    // an evening with the small moon a crescent near the setting sun: the camera on it
    const c = await ev(() => { const S = VR.Sky3, g = VR.game; for (let d = 0; d < 40; d++) { const A = d * 24000 + 12300, th = 12300 / 24000 * Math.PI * 2, el = Math.sin(th) * 0.42, az = th + 0.4; const sun = [Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)]; const m = S.moonsAt(A, sun)[1]; if (m.k < 0.35 && m.dir[1] > 0.06) return { d, dir: m.dir, k: m.k }; } return null; });
    if (c) { day = c.d; tod = 12300; yaw = Math.atan2(-c.dir[0], -c.dir[2]); pitch = Math.asin(c.dir[1]) - 0.05; note = `crescent day ${c.d} (${c.k.toFixed(2)})`; }
  }
  if (V.aim === 'sun') { const th = tod / 24000 * Math.PI * 2, az = th + 0.4; yaw = Math.atan2(-Math.cos(az), -Math.sin(az)); }
  const name = `sky3lab_${V.name}_${TAG}`;
  const a = { tod, day, pins, wx: V.wx || 'klar', cam: P.cam, yaw, pitch };
  const t0 = Date.now();
  const geo = await ev(DRAW, a);
  await page.screenshot({ path: SHOTS + name + '.png', timeout: 120000 });
  let curve = null, dE = null;
  if (V.measure !== false && hr[1]) {
    await ev(DRAW, Object.assign({}, a, { probe: true }));
    await page.screenshot({ path: TMP + 'sky3labprobe_' + name + '.png', timeout: 120000 });
    curve = await measure(name, geo, hr[1], P.H);
    dE = compare(curve, ref.targets[hr[1]]);
  }
  results.push({ view: V.name, name, hour: V.hour, kind: hr[1], note, geo: { night: geo.night, moons: geo.moons, meteor: geo.meteor, aurora: geo.aurora }, curve: curve ? curve.map(b => ({ n: b.n, rgb: b.rgb, lab: b.lab })) : null, dE });
  console.log(`[${secs()}] ${name} (${((Date.now() - t0) / 1000).toFixed(1)} s)${note ? '  ' + note : ''}${geo.moons ? '  moons ' + geo.moons.map(m => m.k).join('/') : ''}`);
  if (curve) {
    console.log('   L*a*b  ' + curve.map(b => (b.lab ? b.lab.map(v => v.toFixed(0)).join(',') : '—')).join(' | '));
    console.log('   ΔE     ' + dE.map(v => (v === null ? '—' : v.toFixed(1))).join(' ') + '   mean ' + (dE.filter(v => v !== null).reduce((s, v) => s + v, 0) / Math.max(1, dE.filter(v => v !== null).length)).toFixed(2));
  }
}
// ---------------------------------------------------------------- the High sky pass alone (dusk, night, noon)
const HB = ([N, cam, yaw, pitch]) => {
  const g = VR.game, R = g.renderer, gl = R.gl, out = {};
  for (const [k, t] of [['dusk', 11900], ['night', 17000], ['noon', 6000]]) {
    g.env.setTime(t);
    const E = g.env.update(0, { dim: 'overworld', biome: null, eyeSky: 1, renderDist: 8, horizon: 0, freezeTime: true, freezeWeather: true, drama: true, motion: true });
    R.setupCamera({ x: cam[0], y: cam[1], z: cam[2], yaw, pitch, fov: 72 * Math.PI / 180 });
    const p = R.P.sky;
    const sync = () => { gl.bindFramebuffer(gl.FRAMEBUFFER, null); const px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
    const once = () => { gl.bindFramebuffer(gl.FRAMEBUFFER, R.sceneFB); gl.viewport(0, 0, R.w, R.h); gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.CULL_FACE); gl.useProgram(p.p); R.common(p, E); if (p.u.u_skyProbe) gl.uniform1f(p.u.u_skyProbe, 0); gl.uniformMatrix4fv(p.u.u_invViewProj, false, R.invViewProj); if (p.u.u_cirrus) gl.uniform1f(p.u.u_cirrus, 1); R.fs(p); };
    once(); sync();
    const t0 = performance.now(); for (let i = 0; i < N; i++) once(); sync();
    out[k] = +((performance.now() - t0) / N).toFixed(1);
  }
  out.size = R.w + 'x' + R.h;
  return out;
};
try { console.log('high sky pass ' + JSON.stringify(await ev(HB, [4, PLACES.canyon.cam, PLACES.canyon.yaw, PITCH]))); } catch (e) { console.log('  (high sky bench: ' + String(e.message).split('\n')[0] + ')'); }
fs.writeFileSync(TMP + 'sky3_' + TAG + '.json', JSON.stringify({ tag: TAG, progs, results }, null, 1));
check(logs.filter(l => /pageerror|\[error\]/.test(l)).length === 0, 'no page or WebGL errors' + (logs.length ? ' (' + logs.length + ' log lines)' : ''));
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 6)) console.log(l);
await browser.close();
console.log(`[${secs()}]`);
console.log(fails === 0 ? 'ALL OK' : 'FAILED ' + fails);
