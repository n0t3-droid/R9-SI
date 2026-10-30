// t-sky3 · WOW V · Der Himmel (docs/superpowers/plans/2026-10-16-t-sky3.md): the game's sky at the five hours, the special
// skies and the costs, against the trailer frames. One run shoots one build (TAG names its pictures).
//   places (t-sky2's three, test/trailer_skycurve.mjs): the canyon (over its east half, west-north-west across it to the
//          citadel — at the golden hour and dusk the sun stands in the view as in t1_01 / t1_07), the city (over the Nova
//          Haven avenue at the villas' upper floors, north-north-east to the Pod Hills: the sun behind, t3_05 / t3_06) and
//          the isles (east-south-east of the Sky Isles, the sun at the right at dusk), pitched up 12°, the ringed giant and
//          the blue planet pinned in view (30° right at 24°, 30° left at 36°: env.planetsOverride, as director.js pins them)
//   hours  noon 6000 (the sun 24° up) · golden 10800 (7°) · dusk 11900 (its disc on the horizon) · afterglow 12400 (2.5°
//          under it) · night 17000 · dawn 23600 (2.5° under it, the east)
//   extra  up / upnight (straight up from the city: the zenith's space by day and at night) · gap (the canyon at the golden
//          hour, a cloudy sky, facing the sun: the cloud gaps and their rays) · storm (rain over the canyon at noon: the deck
//          and its scud) · aurora (north from the city on a night of the aurora: VR.Sky3.auroraNight finds one; the build
//          before shoots the same north) · meteor (VR.Sky3.meteorNext: the camera on the next shooting star of the night,
//          the frame mid-flight; the build before shoots the same place and hour)
//   Very Low  the city at noon, the canyon at dusk and at night, and the sky pass alone (11 rounds, in turns with the
//          DIST_BEFORE build, the order alternating; the median of the rounds' ratios)
// Every picture is taken twice: as it is (test/shots/sky3_<view>_<TAG>.png) and with the sky pass painted magenta (the
// renderer's probe, .tmp_tests/sky3probe_<view>.png): the sky pixels are the magenta ones less the planets, the moons and a
// cone round the sun; from the horizon line to the top 8 bands (test/sky_ref.js, the same functions as the frames'), the
// CIELAB ΔE of each band to the trailer's target of its hour (docs/trailer/sky_ref.json: noon → day, golden → golden,
// dusk → dusk; the afterglow and the dawn against the dusk target, for the record).
// → test/shots/sky3_<view>_<TAG>.png, .tmp_tests/sky3_<TAG>.json, the sheet test/shots/sky3_sheet_<TAG>.png (the game
// beside the trailer frame of its hour) and with BEFORE_JSON the ΔE table before → after.
// Checks: the pictures written, no page error; by day, golden and dusk every measured band within ΔE 12 of the target and
// (with BEFORE_JSON) the mean ΔE per hour not worse than before; at night a dark sky with stars; Very Low: its sky pass not
// slower than DIST_BEFORE's (median ratio ≤ 1.05).
// f-sky4 (docs/reviews/v0.49.md R50-01, R50-11): per view also the critic's structure (test/sky_ref.js structureOf: the top
// 40 %'s luma sd and saturation, the bottom 40 %'s saturation), the sun's disc where the sun is in the picture (sunDiscOf:
// the ≥ 250-luma core's width in degrees), the clouds of the storm and the gap (cloudsOf on the sky probe: their mean luma,
// base over top); the review's gates (sky_ref.js gates) over the golden views and the storm. VARIANTS='{"tag": {"gold":
// {...}, "sun": {...}, "grade": {...}, "fog": {"gold": [ρ, k, base]}, "stops": [["warm2", 9, [r, g, b]], …]}}' shoots the golden views again with
// each palette variant set in the page (no new world, no settle: a variant costs two pictures a view) → sky3_<view>_<TAG>_<tag>
// usage: TAG=before DIST=file://$PWD/.tmp_tests/dist_before/index.html nohup bash test/wt_run.sh sky3.mjs 3600 > .tmp_tests/sky3_before.log 2>&1 &
//        TAG=after DIST_BEFORE=file://$PWD/.tmp_tests/dist_before/index.html BEFORE_JSON=.tmp_tests/sky3_before.json nohup bash test/wt_run.sh sky3.mjs 3600 > .tmp_tests/sky3_after.log 2>&1 &
//        ONLY=canyon_noon,up (views) · SEED=4242 · RD=8
// regress: skip  (a showcase: the pictures are the evidence)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import sharp from '/home/dev/.npm-global/lib/node_modules/sharp/lib/index.js';
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);
const ROOT = new URL('../', import.meta.url).pathname;   // this checkout (from test/ or from .tmp_tests/)
const SR = require(ROOT + 'test/sky_ref.js');
const { load, curveOf, spaceOf, bandRows, compare, NB, REF, starsOf, chromaOf, hazeOf } = SR;
const VARIANTS = process.env.VARIANTS ? JSON.parse(process.env.VARIANTS) : null;
const TAG = process.env.TAG || 'after', SEED = process.env.SEED || '4242', RD = +(process.env.RD || 8);
const DIST = process.env.DIST || 'file://' + ROOT + 'dist/index.html';
const DIST_BEFORE = process.env.DIST_BEFORE || '';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const SHOTS = ROOT + 'test/shots/', TMP = ROOT + '.tmp_tests/';
fs.mkdirSync(SHOTS, { recursive: true }); fs.mkdirSync(TMP, { recursive: true });
const ref = JSON.parse(fs.readFileSync(REF, 'utf8'));
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };

const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
const logs = [];
const attach = (pg, tag) => {
  pg.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail|missing|shader/i.test(s)) logs.push(`[${tag} ${t}] ${s.slice(0, 600)}`); });
  pg.on('pageerror', e => logs.push(`[${tag} pageerror] ` + (e.stack || e.message).slice(0, 1200)));
};
const page = await ctx.newPage();
attach(page, 'test');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
for (let attempt = 1; ; attempt++) {
  try { await page.goto(DIST, { waitUntil: 'domcontentloaded', timeout: 180000 }); break; }
  catch (e) { if (attempt >= 2) throw e; console.log('goto failed once (' + e.message.split('\n')[0] + '), again'); }
}
for (let i = 0; i < 240; i++) { await wait(500); if (await ev(() => typeof VR !== 'undefined' && !!VR.game && VR.game.state === 'title').catch(() => false)) break; }
console.log(`[${secs()}] title; Sky3 ${await ev(() => !!VR.Sky3)}`);
await ev((rd) => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.settings.renderDist = rd; g.applySettings('*'); }, RD);
await ev(`VR.game.createWorld({name:'Sky3',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:true})`);
for (let i = 0; i < 120; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.zenFreezeWeather = true; g.env.wx.force('klar'); g.env.rain = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.display = 'none'; if (!document.getElementById('__nohint')) { const st = document.createElement('style'); st.id = '__nohint'; st.textContent = '#hint,#hints,#toasts,.toast{display:none !important}'; document.head.appendChild(st); } g.settings.wowMoments = false; });
console.log(`[${secs()}] in the world (seed ${SEED})`);

// the render stub: a step draws nothing while the world streams in, the camera follows
await ev(() => { const r = VR.game.renderer; if (r._render) return; r._render = r.render; r.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; });
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(4); } };
// settled: no worker busy, no column pending, no section dirty within the view distance, nothing waiting to upload, no
// far tile in flight (a dirty count that stops falling for six rounds counts); maxS seconds at most
const settle = async (maxS = 240) => {
  const t0 = Date.now(); let last = Infinity, stall = 0, s = null;
  await ev(() => { const q = VR.game.renderer.q; if (q.__up === undefined) q.__up = q.upload; q.upload = 24; });
  for (let i = 0; ; i++) {
    await step(10);
    s = await ev(() => { const g = VR.game, w = g.world, p = g.player, rd = Math.max(1, (w.renderDist | 0) - 1), pcx = Math.floor(p.pos[0]) >> 4, pcz = Math.floor(p.pos[2]) >> 4; let dirty = 0; for (const c of w.cols.values()) { const ex = c.cx - pcx, ez = c.cz - pcz; if (ex * ex + ez * ez > rd * rd) continue; for (const sc of c.sec) if ((sc.dirty || sc.pending) && sc.count > 0) dirty++; } const h = g.horizon; return { busy: g.pool.busy, pend: w.pending.size, dirty, up: w.uploadQ ? w.uploadQ.size : 0, hz: h ? h.inflight || 0 : 0 }; });
    stall = s.pend === 0 && s.up === 0 && s.dirty >= last ? stall + 1 : 0; last = s.dirty;
    if (i > 3 && s.pend === 0 && s.up === 0 && s.hz === 0 && ((s.busy === 0 && s.dirty === 0) || stall >= 6)) break;
    if ((Date.now() - t0) / 1000 > maxS) { console.log('  (settle: the clock ran out ' + JSON.stringify(s) + ')'); break; }
    await wait(60);
  }
  await ev(() => { const q = VR.game.renderer.q; if (q.__up !== undefined) { q.upload = q.__up; delete q.__up; } });
  return Math.round((Date.now() - t0) / 1000);
};
// three frames drawn with the shader's clock pinned (the nebula drifts with it), then the picture; probe: the sky pass
// painted magenta (the god rays off, so no magenta light lands on the land)
const draw = (probe) => ev((probe) => {
  const g = VR.game, R = g.renderer;
  R.skyProbe = !!probe;
  const G = VR.Grade || {}; const rays = G.rays; if (probe) G.rays = 0;
  g.env.anim = 80;
  window.__norender = false;
  for (let i = 0; i < 3; i++) { g.last = performance.now() - 33; g.loop(performance.now()); g.env.anim = 80; }
  R.gl.finish(); window.__norender = true;
  R.skyProbe = false; if (probe) G.rays = rays;
}, probe);

// ---------------------------------------------------------------- the places, the hours, the views
// yaw 0 looks along −z (north); an object δ to the right of the view lies at yaw (view − δ) (renderer.setupCamera)
const PLACES = { canyon: { cam: [250, 150, 380], yaw: 1.36 }, city: { cam: [0, 100, -90], yaw: -0.35 }, isles: { cam: [565, 195, 190], yaw: 1.36 } };
const HOURS = { noon: [6000, 'day'], golden: [10800, 'golden'], dusk: [11900, 'dusk'], afterglow: [12400, 'dusk'], night: [17000, null], dawn: [23600, 'dusk'] };
const PITCH = 12 * Math.PI / 180;
const azOf = (yaw) => Math.atan2(-Math.cos(yaw), -Math.sin(yaw));
const VIEWS = [];
for (const h of ['noon', 'golden', 'dusk', 'afterglow', 'night', 'dawn']) VIEWS.push({ name: 'canyon_' + h, place: 'canyon', hour: h });
for (const h of ['noon', 'golden', 'dusk', 'night']) VIEWS.push({ name: 'city_' + h, place: 'city', hour: h });
for (const h of ['noon', 'golden', 'dusk']) VIEWS.push({ name: 'isles_' + h, place: 'isles', hour: h });
VIEWS.push({ name: 'up', place: 'city', hour: 'noon', pitch: 85 * Math.PI / 180, measure: false });
VIEWS.push({ name: 'upnight', place: 'city', hour: 'night', pitch: 85 * Math.PI / 180, measure: false });
VIEWS.push({ name: 'gap', place: 'canyon', hour: 'golden', wx: 'bewoelkt', aim: 'sun', pitch: 8 * Math.PI / 180, measure: false, clouds: true });
VIEWS.push({ name: 'storm', place: 'canyon', hour: 'noon', wx: 'regen', measure: false, clouds: true, deck: true, balloon: true });
VIEWS.push({ name: 'aurora', place: 'city', hour: 'night', yaw: 0, pitch: 10 * Math.PI / 180, aurora: true, measure: false });
VIEWS.push({ name: 'meteor', place: 'city', hour: 'night', meteor: true, measure: false });
VIEWS.push({ name: 'moons', place: 'canyon', hour: 'afterglow', moons: true, measure: false });
const SHOOT = VIEWS.filter(v => !ONLY || ONLY.includes(v.name));

const place = (P, tod, yaw, pitch, pins) => ev(([cam, yaw, pitch, tod, pins]) => {
  const g = VR.game, p = g.player;
  g.env.setTime(tod); g.env.planetsOverride = pins;
  p.flying = true; p.noclip = true; p.teleport(cam[0], cam[1] - p.eye, cam[2]); p.yaw = yaw; p.pitch = pitch; p.fovKick = 0; p.vel = [0, 0, 0];
}, [P.cam, yaw, pitch, tod, pins]);
// the weather forced and its visuals set to the state at once (weather.js eases over ~20 s; a frame steps 0.1 s at most)
const weather = (wx) => ev((wx) => { const g = VR.game, X = g.env.wx; X.force(wx); if (VR.WX && VR.WX.VIS[wx]) Object.assign(X.v, VR.WX.VIS[wx]); X.front = wx === 'gewitter' ? 1 : 0; X.bow = 0; X.washed = 0; }, wx || 'klar');
const easeWeather = async () => { await step(40, 100); };
// f-sky5 · the deck's coverage (load: {data, w, h, ch} as sky_ref.js load gives)
function deckOf(img) {
  const data = img.d, w = img.w, h = img.h, ch = 3, rows = Math.floor(h / 3), G = 4, gw = Math.floor(w / G), gh = Math.floor(rows / G);
  let clear = 0, n = 0, lsum = 0;
  const grid = new Uint8Array(gw * gh);
  for (let y = 0; y < rows; y++) for (let x = 0; x < w; x++) {
    const k = (y * w + x) * ch, r = data[k] / 255, g = data[k + 1] / 255, b = data[k + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let hue = 0; if (d > 1e-6) hue = mx === r ? 60 * (((g - b) / d) % 6) : mx === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4); if (hue < 0) hue += 360;
    lsum += (0.2126 * r + 0.7152 * g + 0.0722 * b) * 255;
    const isClear = (mx > 0 && d / mx >= 0.2 && hue >= 190 && hue <= 290) || (0.2126 * r + 0.7152 * g + 0.0722 * b) * 255 > 155;
    n++; if (isClear) { clear++; const gx = Math.floor(x / G), gy = Math.floor(y / G); if (gx < gw && gy < gh) grid[gy * gw + gx]++; }
  }
  // the gaps: grid cells mostly clear, 8-connected
  const seen = new Uint8Array(gw * gh); let big = 0;
  for (let i = 0; i < gw * gh; i++) {
    if (seen[i] || grid[i] < G * G / 2) continue;
    let sz = 0; const st = [i]; seen[i] = 1;
    while (st.length) { const c = st.pop(); sz++; const cx = c % gw, cy = (c - cx) / gw; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x2 = cx + dx, y2 = cy + dy; if (x2 < 0 || y2 < 0 || x2 >= gw || y2 >= gh) continue; const j = y2 * gw + x2; if (!seen[j] && grid[j] >= G * G / 2) { seen[j] = 1; st.push(j); } } }
    big = Math.max(big, sz);
  }
  return { cover: +(1 - clear / n).toFixed(3), gap: +(big / (gw * gh)).toFixed(4), luma: +(lsum / n).toFixed(1) };
}

// ---------------------------------------------------------------- the measurement of one picture
const W = 640, H = 360;
const matVec = (m, v) => [0, 1, 2, 3].map(i => m[i] * v[0] + m[4 + i] * v[1] + m[8 + i] * v[2] + m[12 + i] * v[3]);
const ang = (a, b) => Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
const normv = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const geoOf = () => ev(() => { const g = VR.game, R = g.renderer, E = g.env.E, B = E.bodies, S3 = E.sky3 || null; return { inv: Array.from(R.invVPNJ || R.invViewProj), sun: E.sunDir, moon: E.moonDir, giant: E.planetDir, blue: E.planet2Dir, rg: B ? B.radius.giant : 0.122, rb: B ? B.radius.blue : 0.085, moons: B ? B.moons : [], extra: S3 && S3.bodies ? S3.bodies : [], night: E.night, pitch: g.player.pitch, yaw: g.player.yaw, ticks: g.env.ticks, day: g.env.day }; });
async function measure(name, geo, kind) {
  const img = await load(SHOTS + name + '.png', W, H), pr = await load(TMP + 'sky3probe_' + name + '.png', W, H);
  const sky = new Uint8Array(W * H), mask = new Uint8Array(W * H);
  const bodies = [[geo.sun, (kind === 'day' ? 30 : 14) * Math.PI / 180], [geo.giant, geo.rg * 2.6], [geo.blue, geo.rb * 1.6], [geo.moon, 0.06], ...geo.moons.map(m => [[m[0], m[1], m[2]], m[3] * 1.8]), ...geo.extra.map(m => [[m[0], m[1], m[2]], m[3] * 1.8])];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = (y * W + x) * 3, R = pr.d[p], G = pr.d[p + 1], B = pr.d[p + 2];
    if (!(R > 140 && B > 140 && G < 0.55 * Math.min(R, B))) continue;
    sky[y * W + x] = 1;
    const c = matVec(geo.inv, [(x + 0.5) / W * 2 - 1, 1 - (y + 0.5) / H * 2, 1, 1]);
    const dir = normv([c[0] / c[3], c[1] / c[3], c[2] / c[3]]);
    let ok = true;
    for (const [d, r] of bodies) if (ang(dir, d) < r) { ok = false; break; }
    if (ok) mask[y * W + x] = 1;
  }
  const f = (H / 2) / Math.tan(36 * Math.PI / 180), y0 = Math.round(H / 2 + f * Math.tan(geo.pitch));
  const lows = [];
  for (let x = 0; x < W; x++) { let low = -1; for (let y = 0; y < Math.min(H, y0 + 40); y++) if (sky[y * W + x]) low = y; if (low > 5) lows.push(low + 1); }
  lows.sort((a, b) => a - b);
  const Hl = lows.length > W * 0.2 ? lows[Math.floor(lows.length * 0.8)] : y0;
  const inMask = (x, y) => x >= 0 && y >= 0 && x < W && y < H && mask[y * W + x] === 1;
  const curve = curveOf(img, Hl, inMask);
  const space = spaceOf(img, 0, bandRows(Hl, NB - 2)[1], inMask);
  const stars = [NB - 3, NB - 2, NB - 1].map(k => { const [a, b] = bandRows(Hl, k); return starsOf(img, a, b, inMask); });
  const chroma = chromaOf(img, 0, bandRows(Hl, NB - 3)[1], inMask);
  const haze = hazeOf(img, Hl, inMask);
  let skyN = 0; for (let i = 0; i < W * H; i++) skyN += mask[i];
  return { H: Hl, y0, sky: +(skyN / (W * H)).toFixed(3), curve, space, stars, chroma, haze: { L0: haze.L0, width: haze.width }, ...looks(img, pr, geo, false) };
}
// f-sky4 · the parts the band means cannot see (test/sky_ref.js looksOf): the structure, the disc, the clouds
const looks = (img, pr, geo, withClouds) => SR.looksOf(img, pr, geo, { fovDeg: 72, clouds: withClouds });
const fmtCurve = (c) => c.map(b => (b.lab ? `${b.rgb.map(v => Math.round(v)).join(',')}` : '—')).join(' | ');

// ---------------------------------------------------------------- the shots
const results = [];
let lastPlace = null, lastWx = 'klar';
async function shoot(V, preset) {
  const P = PLACES[V.place], hr = HOURS[V.hour], tod = hr[0];
  let yaw = V.yaw !== undefined ? V.yaw : P.yaw, pitch = V.pitch !== undefined ? V.pitch : PITCH, note = '';
  const pins = { az: azOf(P.yaw - 30 * Math.PI / 180), el: 24, az2: azOf(P.yaw + 30 * Math.PI / 180), el2: 36 };
  // the aurora's night (VR.Sky3: the first night of this world with an aurora) and the meteor (the next one of the night)
  let dayN = 0, todN = tod;
  if (V.aurora) {
    const a = await ev(() => { const S = VR.Sky3, g = VR.game; if (!S || !S.auroraNight) return null; for (let n = 0; n < 40; n++) { const k = S.auroraNight(g.env.wx.seed, n); if (k > 0.5) return { night: n, k }; } return null; });
    if (a) { dayN = a.night; note = `the aurora's night ${a.night} (strength ${a.k.toFixed(2)})`; } else note = 'no VR.Sky3: north at night';
  }
  if (V.meteor) {
    const m = await ev((tod) => { const S = VR.Sky3, g = VR.game; if (!S || !S.meteorNext) return null; return S.meteorNext(g.env.wx.seed, tod, 25); }, tod);
    if (m) {
      dayN = Math.floor(m.A / 24000); todN = (m.A % 24000) + m.dur * 20 * 0.45;
      const mid = normv([m.from[0] + m.to[0], m.from[1] + m.to[1], m.from[2] + m.to[2]]);
      yaw = Math.atan2(-mid[0], -mid[2]); pitch = Math.max(0.05, Math.asin(mid[1]) - 0.08);
      note = `the meteor at day ${dayN} tick ${Math.round(todN)} (from ${m.from.map(v => v.toFixed(2))} to ${m.to.map(v => v.toFixed(2))})`;
    } else { yaw = 0.8; pitch = 30 * Math.PI / 180; note = 'no VR.Sky3: north-east at night, 30° up'; }
  }
  await ev((d) => { VR.game.env.day = d; }, dayN);
  if (V.moons) {
    // t-sky3: an evening with the small moon a crescent beside the setting sun (VR.Sky3.moonsAt), the camera on it; the build
    // before shoots the same place and hour
    const c = await ev(() => { const S = VR.Sky3; if (!S || !S.moonsAt) return null; const th = 12300 / 24000 * Math.PI * 2, el = Math.sin(th) * 0.42, az = th + 0.4, sun = [Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)]; for (let d = 0; d < 40; d++) { const m = S.moonsAt(d * 24000 + 12300, sun)[1]; if (m.k < 0.35 && m.dir[1] > 0.06) return { d, dir: m.dir, k: m.k }; } return null; });
    if (c) { dayN = c.d; todN = 12300; yaw = Math.atan2(-c.dir[0], -c.dir[2]); pitch = Math.asin(c.dir[1]) - 0.06; note = `the small moon a crescent, day ${c.d} (lit ${c.k.toFixed(2)})`; }
    else { todN = 12300; note = 'no VR.Sky3: the canyon after the sunset'; }
  }
  if (V.aim === 'sun') {
    // facing the sun at that hour (its azimuth from env.js: the day's angle + 0.4)
    const th = tod / 24000 * Math.PI * 2, az = th + 0.4; yaw = Math.atan2(-Math.cos(az), -Math.sin(az));
  }
  // (f-sky5, R52-04: a balloon aloft before the rain comes — the rain must send it down)
  let balloon0 = null;
  if (V.balloon) { await place(P, todN, yaw, pitch, pins); if (lastPlace !== V.place) { await settle(); lastPlace = V.place; } await step(12); balloon0 = await ev(() => { const L = VR.game.lifeDirector; if (!L || !L.force) return null; L.events.length = 0; const ok = L.force('balloon'); return ok && L.events.some(e => e.kind === 'balloon'); }); }
  if ((V.wx || 'klar') !== lastWx) { await weather(V.wx); lastWx = V.wx || 'klar'; }
  await place(P, todN, yaw, pitch, pins);
  let st = 0;
  if (lastPlace !== V.place) { st = await settle(); lastPlace = V.place; } else await step(12);
  if ((V.wx || 'klar') !== 'klar' || V.wxEase) await easeWeather();
  if (V.balloon) await step(300, 100);   // (30 s in the rain: time to land)
  const balloon1 = V.balloon ? await ev(() => { const L = VR.game.lifeDirector; return !!(L && L.events && L.events.some(e => e.kind === 'balloon')); }) : null;
  await ev(() => { const e = VR.game.entities; if (e && e.mobs) e.mobs.length = 0; });
  // (the shooting star: the life director's balloon hung right over it in the second run — its acts off for this view)
  if (V.meteor) await ev(() => { const L = VR.game.lifeDirector; if (L && L.events) L.events.length = 0; });
  await ev(([t, yaw, pitch]) => { const g = VR.game, p = g.player; g.env.setTime(t); p.yaw = yaw; p.pitch = pitch; }, [todN, yaw, pitch]);
  await step(4);
  const name = `sky3_${V.name}${preset === 'high' ? '' : '_' + preset}_${TAG}`;
  await draw(false);
  await page.screenshot({ path: SHOTS + name + '.png', timeout: 240000 });
  const geo = await geoOf();
  let m = null;
  if (V.measure !== false && hr[1] !== undefined) {
    await draw(true);
    await page.screenshot({ path: TMP + 'sky3probe_' + name + '.png', timeout: 240000 });
    await draw(false);
    m = await measure(name, geo, hr[1]);
  }
  if (!m && V.clouds) {
    // (f-sky4: the storm's and the gap's clouds — the sky probe for the mask, no bands)
    await draw(true);
    await page.screenshot({ path: TMP + 'sky3probe_' + name + '.png', timeout: 240000 });
    await draw(false);
    m = looks(await load(SHOTS + name + '.png', W, H), await load(TMP + 'sky3probe_' + name + '.png', W, H), geo, true);
  }
  const target = m && hr[1] && m.curve ? ref.targets[hr[1]] : null;
  const dEs = target ? compare(m.curve, target) : null;
  // (f-sky5 · the storm deck's coverage: the top third of the picture, the share of its pixels that are deck — not a gap:
  // a gap is clear sky (HSV hue 190–290°, saturation ≥ 0.2) or the pale overcast between separate puffs (luma > 155; v0.51's
  // 180–200 between its charcoal balls) — and the largest gap (8-connected, on a 4-px grid) of the third)
  const deck = V.deck ? deckOf(await load(SHOTS + name + '.png', W, H)) : null;
  if (deck) console.log(`   deck coverage ${deck.cover} · largest gap ${deck.gap} · balloon before the rain ${balloon0} → after ${balloon1}`);
  const r = { name, view: V.name, place: V.place, hour: V.hour, kind: hr[1], preset, note, settleS: st, deck, balloon: V.balloon ? { before: balloon0, after: balloon1 } : undefined, geo: { sun: geo.sun, night: geo.night, ticks: geo.ticks, day: geo.day, yaw: geo.yaw, pitch: geo.pitch }, ...(m || {}), dE: dEs };
  results.push(r);
  if (m && m.structure) console.log(`   structure sd ${m.structure.sd} sat ${m.structure.sat} land ${m.structure.land} (luma ${m.structure.luma})${m.disc ? ` · disc ${m.disc.width}° max ${m.disc.max} rings ${Object.values(m.disc.ring).join('/')}` : ''}${m.clouds ? ` · clouds ${JSON.stringify(m.clouds)}` : ''}`);
  // (f-sky5 · DIAG=1: what lays the veil over the canyon's lower right — the canyon's golden view again after 12 more frames
  // (the temporal history settled), then without the cloud sprites, without the far land's tiles, without the particles,
  // without the water's pass: test/shots/sky3_canyon_golden_<TAG>_d<what>.png)
  if (process.env.DIAG && V.name === 'canyon_golden' && preset === 'high') {
    const shot = async (k) => { await page.screenshot({ path: SHOTS + name + '_d' + k + '.png', timeout: 240000 }); console.log('   diag ' + k); };
    const frames = (n) => ev((n) => { const g = VR.game; window.__norender = false; for (let i = 0; i < n; i++) { g.last = performance.now() - 33; g.loop(performance.now()); g.env.anim = 80; } g.renderer.gl.finish(); window.__norender = true; }, n);
    await frames(12); await shot('tsr');
    await ev(() => { const R = VR.game.renderer; R.__dc = R.drawClouds; R.drawClouds = () => {}; }); await frames(8); await shot('nocl');
    await ev(() => { const R = VR.game.renderer; R.drawClouds = R.__dc; const h = VR.game.horizon; if (h) { h.__d = h.draw; h.draw = () => {}; } }); await frames(8); await shot('nohz');
    await ev(() => { const R = VR.game.renderer, h = VR.game.horizon; if (h && h.__d) h.draw = h.__d; R.__dp = R.drawParticles; R.drawParticles = () => {}; }); await frames(8); await shot('nopart');
    await ev(() => { const R = VR.game.renderer; R.drawParticles = R.__dp; R.__qw = R.q.water; R.q.water = 0; }); await frames(8); await shot('nowater');
    await ev(() => { const R = VR.game.renderer; R.q.water = R.__qw; }); await frames(4);
  }
  // (f-sky4: the palette variants on the golden views — set in the page, the picture and the probe again, put back after)
  if (VARIANTS && preset === 'high' && V.hour === 'golden' && V.measure !== false) for (const [vt, VV] of Object.entries(VARIANTS)) {
    await ev((VV) => {
      const S3 = VR.Sky3, L2 = VR.Light2;
      window.__keep = JSON.stringify({ gold: S3.PAL.gold, skyl: S3.SKYL, grade: L2.GRADE.gold, fog: L2.FOG || null, air: L2.AIRGOLD || null, ap: L2.AP ? L2.AP.gold : null, gc: S3.GOLDCLOUD ? S3.GOLDCLOUD.add : null, mist: S3.MISTK ? S3.MISTK.gold : null, gs: S3.GOLDSKY ? Object.assign({}, S3.GOLDSKY) : null, cl: S3.CLOUDLIGHT ? JSON.stringify(S3.CLOUDLIGHT.low) : null });
      if (VV.goldsky && S3.GOLDSKY) Object.assign(S3.GOLDSKY, VV.goldsky);   // (f-golden: the golden sky's structure)
      if (VV.low && S3.CLOUDLIGHT) S3.CLOUDLIGHT.low = VV.low;   // (f-golden: the golden cumulus' shade)
      if (VV.mist !== undefined && S3.MISTK) S3.MISTK.gold = VV.mist;
      // (f-sky5: the golden far air, the aerial perspective's share, the golden cumulus' extra cover)
      if (VV.air && L2.AIRGOLD) Object.assign(L2.AIRGOLD, VV.air);
      if (VV.ap !== undefined && L2.AP) L2.AP.gold = VV.ap;
      if (VV.gc !== undefined && S3.GOLDCLOUD) S3.GOLDCLOUD.add = VV.gc;
      if (VV.fog && L2.FOG) for (const k of Object.keys(VV.fog)) L2.FOG[k] = VV.fog[k].slice();
      if (VV.gold) Object.assign(S3.PAL.gold, VV.gold);
      if (VV.sun) Object.assign(S3.SKYL.sun, VV.sun);
      if (VV.grade) Object.assign(L2.GRADE.gold, VV.grade);
      for (const [tab, el, val] of VV.stops || []) { const T = S3.SKYL[tab], e = T.find(q => q[0] === el); if (e) e[1] = val; else { T.push([el, val]); T.sort((a, b) => a[0] - b[0]); } }
    }, VV);
    const vn = `${name}_${vt}`;
    await step(2); await draw(false);
    await page.screenshot({ path: SHOTS + vn + '.png', timeout: 240000 });
    const vgeo = await geoOf();
    await draw(true);
    await page.screenshot({ path: TMP + 'sky3probe_' + vn + '.png', timeout: 240000 });
    await draw(false);
    const vm = await measure(vn, vgeo, hr[1]);
    await ev(() => { const S3 = VR.Sky3, L2 = VR.Light2, k = JSON.parse(window.__keep); Object.assign(S3.PAL.gold, k.gold); for (const t of Object.keys(k.skyl)) S3.SKYL[t] = k.skyl[t]; Object.assign(L2.GRADE.gold, k.grade); if (k.fog && L2.FOG) for (const f of Object.keys(k.fog)) L2.FOG[f] = k.fog[f]; if (k.air) Object.assign(L2.AIRGOLD, k.air); if (k.ap !== null && L2.AP) L2.AP.gold = k.ap; if (k.gc !== null && S3.GOLDCLOUD) S3.GOLDCLOUD.add = k.gc; if (k.mist !== null && S3.MISTK) S3.MISTK.gold = k.mist; if (k.gs) Object.assign(S3.GOLDSKY, k.gs); if (k.cl) S3.CLOUDLIGHT.low = JSON.parse(k.cl); });
    const vd = compare(vm.curve, ref.targets[hr[1]]);
    results.push({ name: vn, view: V.name + '+' + vt, variant: vt, place: V.place, hour: V.hour, kind: hr[1], preset, ...vm, dE: vd });
    console.log(`   variant ${vt}: ΔE ${vd.map(v => (v === null ? '—' : v.toFixed(1))).join(' ')}  mean ${mean(vd)} · L* ${vm.curve.map(b => (b.lab ? b.L.toFixed(0) : '—')).join(' ')} · structure sd ${vm.structure.sd} sat ${vm.structure.sat} land ${vm.structure.land}${vm.disc ? ` · disc ${vm.disc.width}°` : ''}`);
  }
  await step(2);
  console.log(`[${secs()}] ${name}${st ? ' (settled ' + st + ' s)' : ''}${note ? '  ' + note : ''}`);
  if (m && m.curve) {   // (f-sky4: the storm's and the gap's measure has the clouds, not the bands)
    console.log(`   H ${m.H} sky ${m.sky} stars ${m.stars.map(v => (v === null ? '—' : v)).join(' ')} chroma ${m.chroma ? m.chroma.mean + ' var ' + m.chroma.var : '—'} haze ${m.haze.L0} / ${m.haze.width}`);
    console.log('   curve  ' + fmtCurve(m.curve));
    console.log('   L*     ' + m.curve.map(b => (b.lab ? b.L.toFixed(0) : '—')).join(' '));
    if (dEs) console.log(`   ΔE(${hr[1]}) ` + dEs.map(v => (v === null ? '—' : v.toFixed(1))).join(' ') + `  mean ${mean(dEs)}`);
  }
  return r;
}
const mean = (v) => { const w = (v || []).filter(x => x !== null && x !== undefined); return w.length ? +(w.reduce((a, b) => a + b, 0) / w.length).toFixed(2) : null; };

console.log(`== High (${TAG}), ${SHOOT.length} views`);
// the clear views first (place by place), the weather's views after them
const ORDER = SHOOT.filter(v => !v.wx).sort((a, b) => Object.keys(PLACES).indexOf(a.place) - Object.keys(PLACES).indexOf(b.place)).concat(SHOOT.filter(v => v.wx));
for (const V of ORDER) {
  try { await shoot(V, 'high'); } catch (e) { console.log(`  !! ${V.name}: ${String(e.message || e).split('\n')[0].slice(0, 300)}`); logs.push('[shot] ' + V.name + ' ' + String(e.message || e).slice(0, 200)); }
}
await weather('klar'); lastWx = 'klar';

// ---------------------------------------------------------------- Very Low: three pictures, the sky pass alone
let skyRatio = null, skyA = [], skyB = [], sameSky = null;
if (!ONLY || ONLY.includes('potato')) {
  await ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.dynRes = false; g.applySettings('*'); });
  await easeWeather();
  lastPlace = null;
  for (const V of [{ name: 'city_noon', place: 'city', hour: 'noon' }, { name: 'canyon_dusk', place: 'canyon', hour: 'dusk' }, { name: 'canyon_night', place: 'canyon', hour: 'night' }]) {
    try { await shoot(V, 'potato'); } catch (e) { console.log(`  !! potato ${V.name}: ${String(e.message || e).split('\n')[0].slice(0, 300)}`); }
  }
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
  const benchArgs = [24, PLACES.canyon.cam, PLACES.canyon.yaw, PITCH, 11900];
  // both builds on a fresh page at the title (the second run measured this build on the test's page, its world's workers
  // busy beside it, against the build before at the title: ×1.18 from the setup alone); and the sky program's own source
  // compared — Very Low's rule is the same programs
  const titlePage = async (url, tag) => {
    const pg = await ctx.newPage();
    attach(pg, tag);
    await pg.goto(url, { waitUntil: 'domcontentloaded', timeout: 180000 });
    for (let i = 0; i < 240; i++) { await pg.waitForTimeout(500); if (await pg.evaluate(() => typeof VR !== 'undefined' && VR.game && VR.game.state === 'title').catch(() => false)) break; }
    await pg.evaluate(() => { const g = VR.game; window.requestAnimationFrame = () => 0; g.applyPreset('potato'); g.settings.dynRes = false; g.applySettings('*'); });
    return pg;
  };
  // (the compiled program's active uniforms: the source text carries every tier's #ifdef blocks; test/sky3.js b compares
  // Very Low's preprocessed text itself)
  const SRC = () => { const R = VR.game.renderer, gl = R.gl, p = R.P.sky.p, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS), out = []; for (let i = 0; i < n; i++) { const u = gl.getActiveUniform(p, i); out.push(u.name + ':' + u.type + ':' + u.size); } return out.sort().join(' '); };
  let before = null, after = null;
  if (DIST_BEFORE) { before = await titlePage(DIST_BEFORE, 'before'); after = await titlePage(DIST, 'after-title'); }
  const benchA = (args) => (after ? after.evaluate(SKYBENCH, args) : ev(SKYBENCH, args));
  for (let b = 0; b < 11; b++) {
    if (before && b % 2 === 0) skyB.push(await before.evaluate(SKYBENCH, benchArgs));
    skyA.push(await benchA(benchArgs));
    if (before && b % 2 === 1) skyB.push(await before.evaluate(SKYBENCH, benchArgs));
  }
  if (before && after) {
    const sa = await after.evaluate(SRC), sb = await before.evaluate(SRC);
    sameSky = sa === sb && sa.length > 100;
    console.log(`potato sky program: ${sameSky ? 'the same active uniforms as the build before' : 'DIFFERENT uniforms from the build before: ' + sa + ' | ' + sb} (${sa.split(' ').length} / ${sb.split(' ').length})`);
    await after.close().catch(() => {});
  }
  const med = (v) => { const s = [...v].sort((a, b) => a - b); return s[s.length >> 1]; };
  skyRatio = before ? med(skyA.map((x, i) => x.ms / skyB[i].ms)) : null;
  console.log('potato sky pass ' + JSON.stringify({ tag: TAG, size: skyA[0].w + 'x' + skyA[0].h, lite: skyA[0].lite, ms: skyA.map(s => +s.ms.toFixed(2)), median: +med(skyA.map(s => s.ms)).toFixed(2), before: before ? { size: skyB[0].w + 'x' + skyB[0].h, ms: skyB.map(s => +s.ms.toFixed(2)), median: +med(skyB.map(s => s.ms)).toFixed(2) } : null, ratio: skyRatio === null ? null : +skyRatio.toFixed(3) }));
  if (before) await before.close().catch(() => {});
}

// ---------------------------------------------------------------- the High sky pass alone (the cost of the full set)
let hiSky = null;
{
  await ev(() => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.applySettings('*'); });
  const HB = ([N, cam, yaw, pitch, tod]) => {
    const g = VR.game, R = g.renderer, gl = R.gl, out = {};
    for (const [k, t] of [['dusk', tod], ['night', 17000], ['noon', 6000]]) {
      g.env.setTime(t);
      const E = g.env.update(0, { dim: 'overworld', biome: null, eyeSky: 1, renderDist: 8, horizon: 0, freezeTime: true, freezeWeather: true, drama: true, motion: true });
      R.setupCamera({ x: cam[0], y: cam[1], z: cam[2], yaw, pitch, fov: 72 * Math.PI / 180 });
      const p = R.P.sky;
      const sync = () => { gl.bindFramebuffer(gl.FRAMEBUFFER, null); const px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
      const once = () => { gl.bindFramebuffer(gl.FRAMEBUFFER, R.sceneFB); gl.viewport(0, 0, R.w, R.h); gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.CULL_FACE); gl.useProgram(p.p); R.common(p, E); if (p.u.u_skyProbe) gl.uniform1f(p.u.u_skyProbe, 0); gl.uniformMatrix4fv(p.u.u_invViewProj, false, R.invViewProj); if (p.u.u_cirrus) gl.uniform1f(p.u.u_cirrus, 1); R.fs(p); };   // (R.common sets the sky's values: sky3_gl.js)
      once(); sync();
      const t0 = performance.now(); for (let i = 0; i < N; i++) once(); sync();
      out[k] = +((performance.now() - t0) / N).toFixed(2);
    }
    out.size = R.w + 'x' + R.h;
    return out;
  };
  try { hiSky = await ev(HB, [4, PLACES.canyon.cam, PLACES.canyon.yaw, PITCH, 11900]); console.log('high sky pass ' + JSON.stringify(hiSky)); } catch (e) { console.log('  (high sky bench: ' + String(e.message).split('\n')[0] + ')'); }
  // the cost under the same load: both builds on fresh title pages at High, in turns (the machine is shared: the second
  // run's own numbers were 2.5–4× run 1's for the load alone)
  if (DIST_BEFORE) {
    try {
      const mk = async (url, tag) => { const pg = await ctx.newPage(); attach(pg, tag); await pg.goto(url, { waitUntil: 'domcontentloaded', timeout: 180000 }); for (let i = 0; i < 240; i++) { await pg.waitForTimeout(500); if (await pg.evaluate(() => typeof VR !== 'undefined' && VR.game && VR.game.state === 'title').catch(() => false)) break; } await pg.evaluate(() => { const g = VR.game; window.requestAnimationFrame = () => 0; g.applyPreset('high'); g.settings.dynRes = false; g.applySettings('*'); }); return pg; };
      const pb = await mk(DIST_BEFORE, 'hi-before'), pa = await mk(DIST, 'hi-after'), A = [], B = [];
      const args = [3, PLACES.canyon.cam, PLACES.canyon.yaw, PITCH, 11900];
      for (let r = 0; r < 3; r++) { if (r % 2 === 0) B.push(await pb.evaluate(HB, args)); A.push(await pa.evaluate(HB, args)); if (r % 2 === 1) B.push(await pb.evaluate(HB, args)); }
      const md = (v) => { const s = [...v].sort((x, y) => x - y); return s[s.length >> 1]; }, o = { size: A[0].size };
      for (const k of ['noon', 'dusk', 'night']) o[k] = { after: md(A.map(x => x[k])), before: md(B.map(x => x[k])), ratio: +(md(A.map((x, i) => x[k] / B[i][k]))).toFixed(3) };
      hiSky = Object.assign(hiSky || {}, { pair: o });
      console.log('high sky pass, both builds at the title in turns ' + JSON.stringify(o));
      await pb.close().catch(() => {}); await pa.close().catch(() => {});
    } catch (e) { console.log('  (high pair bench: ' + String(e.message).split('\n')[0] + ')'); }
  }
}

// ---------------------------------------------------------------- the checks
console.log(`\n== checks (${TAG}) [${secs()}]`);
const hi = results.filter(r => r.preset === 'high' && !r.variant);
for (const r of results) check(fs.existsSync(SHOTS + r.name + '.png') && fs.statSync(SHOTS + r.name + '.png').size > 20000, `picture ${r.name} written`);
check(logs.filter(l => /pageerror|\berror\]|\[shot\]/.test(l)).length === 0, 'no page or WebGL errors' + (logs.length ? ' (' + logs.length + ' log lines)' : ''));
const LIM = 12;
for (const r of hi.filter(r => r.dE && r.hour !== 'afterglow' && r.hour !== 'dawn')) {
  const bad = r.dE.map((v, k) => [k, v]).filter(([k, v]) => v !== null && r.curve[k].n >= 100 && v > LIM);
  const measured = r.dE.filter((v, k) => v !== null && r.curve[k].n >= 100).length;
  check(bad.length === 0 && measured >= 4, `${r.view}: the sky within ΔE ${LIM} of the ${r.kind} target (${measured} bands; ΔE ${r.dE.map(v => (v === null ? '—' : v.toFixed(0))).join(' ')}, mean ${mean(r.dE)})`);
}
for (const r of hi.filter(r => r.hour === 'night' && r.curve)) {
  const top = r.curve[NB - 1], low = r.curve[0];
  check(top.lab && low.lab && top.L < 38 && low.L < 50 && r.space.stars > 0.5, `${r.view}: a dark sky (top L* ${top.lab ? top.L : '—'}, horizon L* ${low.lab ? low.L : '—'}) with stars (${r.space ? r.space.stars : '—'})`);
}
// the ΔE table, before → after (BEFORE_JSON: the run of the build before)
let before = null;
if (process.env.BEFORE_JSON && fs.existsSync(ROOT + process.env.BEFORE_JSON)) before = JSON.parse(fs.readFileSync(ROOT + process.env.BEFORE_JSON, 'utf8'));
const byHour = {};
for (const r of hi.filter(r => r.dE)) (byHour[r.hour] = byHour[r.hour] || []).push(r);
console.log('\nΔE per band (mean of the bands; ' + (before ? 'before → after' : TAG) + ')');
for (const h of Object.keys(byHour)) for (const r of byHour[h]) {
  const b = before ? before.results.find(x => x.view === r.view && x.preset === r.preset) : null;
  console.log(`  ${r.view.padEnd(18)} ${b && b.dE ? b.dE.map(v => (v === null ? ' —' : v.toFixed(0).padStart(2))).join(' ') + '  (' + mean(b.dE) + ')  →  ' : ''}${r.dE.map(v => (v === null ? ' —' : v.toFixed(0).padStart(2))).join(' ')}  (${mean(r.dE)})`);
}
if (before) for (const h of ['noon', 'golden', 'dusk']) {
  const a = (byHour[h] || []).map(r => mean(r.dE)).filter(v => v !== null), b = before.results.filter(x => x.hour === h && x.preset === 'high' && x.dE).map(x => mean(x.dE)).filter(v => v !== null);
  if (!a.length || !b.length) continue;
  const ma = a.reduce((s, v) => s + v, 0) / a.length, mb = b.reduce((s, v) => s + v, 0) / b.length;
  check(ma <= mb + 0.5, `${h}: the mean ΔE over its views ${mb.toFixed(2)} → ${ma.toFixed(2)} (not worse)`);
}
if (skyRatio !== null) check(skyRatio <= 1.05, `Very Low: the sky pass not slower than the build before's (the rounds' median ratio ${skyRatio.toFixed(3)})`);
if (sameSky !== null) check(sameSky, 'Very Low: the sky program uses the same uniforms as the build before\'s (no new work in it)');
// f-sky4 · the review's gates (test/sky_ref.js gates: the golden views' bands, structure and disc; the storm's clouds); the
// variants' for the record
// (f-sky5: in a storm the sprites dissolve into the sky's deck — f-sky4's measure of the sprites' weight has nothing left to
// weigh when they cover under 2 % of the sky; the deck's own weight stands in: the top third's mean luma ≤ 120)
const dissolved = (g) => /^storm: the storm's clouds/.test(g.msg) && hi.some(r => r.view === 'storm' && r.deck && r.clouds && r.clouds.share < 0.02);
for (const g of SR.gates(hi)) { if (dissolved(g)) { console.log('  · gate ' + g.msg + ' — the sprites dissolved into the deck'); continue; } check(g.ok, 'gate ' + g.msg); }
for (const r of hi.filter(r => r.deck && r.deck.luma !== undefined)) check(r.deck.luma <= 120, `gate ${r.view}: the deck has weight (the top third's mean luma ${r.deck.luma} ≤ 120)`);
// f-sky5 · the storm deck (R52-04): the top third closed (≥ 70 % not clear sky, no clear gap over 3 % of it); the balloon
// that was aloft before the rain is gone
for (const r of hi.filter(r => r.deck)) {
  check(r.deck.cover >= 0.7 && r.deck.gap <= 0.03, `gate ${r.view}: the deck closes the top third (coverage ${r.deck.cover} ≥ 0.7, largest clear gap ${r.deck.gap} ≤ 0.03)`);
  if (r.balloon) check(r.balloon.before !== true || r.balloon.after === false, `gate ${r.view}: the balloon aloft before the rain has landed (before ${r.balloon.before}, after ${r.balloon.after})`);
}
const vres = results.filter(r => r.variant);
if (vres.length) { console.log('\nthe variants (for the record)'); for (const g of SR.gates(vres)) console.log((g.ok ? '  ✓ ' : '  · ') + g.msg); }
fs.writeFileSync(TMP + 'sky3_' + TAG + '.json', JSON.stringify({ tag: TAG, results: results.map(r => ({ name: r.name, view: r.view, variant: r.variant, place: r.place, hour: r.hour, kind: r.kind, preset: r.preset, note: r.note, H: r.H, sky: r.sky, space: r.space, stars: r.stars, chroma: r.chroma, haze: r.haze, dE: r.dE, curve: r.curve ? r.curve.map(b => ({ n: b.n, rgb: b.rgb, lab: b.lab, L: b.L, C: b.C, h: b.h })) : null, geo: r.geo, structure: r.structure, disc: r.disc, clouds: r.clouds })), sky: { ratio: skyRatio, same: sameSky, a: skyA.map(s => s.ms), b: skyB.map(s => s.ms) }, hiSky }, null, 1));

// ---------------------------------------------------------------- the sheet: the game beside the trailer frame of its hour
{
  const PAIRS = [['canyon_noon', 't1_05', 'Canyon, Mittag'], ['city_noon', 't3_05', 'Stadt, Mittag'], ['up', 't3_08', 'Zenit, Mittag'], ['canyon_golden', 't1_07', 'Canyon, goldene Stunde'], ['isles_golden', 't1_09', 'Inseln, goldene Stunde'],
    ['gap', 't1_07', 'Wolkenluecke, goldene Stunde'], ['canyon_dusk', 't1_01', 'Canyon, Sonnenuntergang'], ['isles_dusk', 't3_01', 'Inseln, Sonnenuntergang'], ['canyon_afterglow', 't3_02', 'Canyon, Nachgluehen'], ['canyon_dawn', 't1_03', 'Canyon, Morgengrauen'],
    ['canyon_night', 't1_05', 'Canyon, Nacht'], ['upnight', 't1_01', 'Zenit, Nacht'], ['aurora', null, 'Polarlicht, Nacht'], ['meteor', null, 'Sternschnuppe, Nacht'], ['moons', 't1_07', 'Mondsichel neben der Sonne'], ['storm', null, 'Regen: Wolkendecke und Fetzen']];
  const CW = 480, CH = 270, LH = 20, parts = [];
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const label = (txt, w) => Buffer.from(`<svg width="${w}" height="${LH}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#111"/><text x="6" y="14" font-family="sans-serif" font-size="12" fill="#eee">${esc(txt)}</text></svg>`);
  let row = 0;
  for (const [v, fr, de] of PAIRS) {
    const g = `${SHOTS}sky3_${v}_${TAG}.png`;
    if (!fs.existsSync(g)) continue;
    const y = row * (CH + LH);
    parts.push({ input: label(`Spiel (${TAG}): ${de}`, CW), left: 0, top: y });
    parts.push({ input: label(fr ? `Trailer ${fr}` : '(kein Trailerbild)', CW), left: CW, top: y });
    parts.push({ input: await sharp(g).resize(CW, CH, { fit: 'fill' }).png().toBuffer(), left: 0, top: y + LH });
    if (fr) parts.push({ input: await sharp(ROOT + 'docs/trailer/frames/' + fr + '.jpg').resize(CW, CH, { fit: 'fill' }).png().toBuffer(), left: CW, top: y + LH });
    row++;
  }
  if (row) {
    await sharp({ create: { width: CW * 2, height: row * (CH + LH), channels: 3, background: '#000' } }).composite(parts).png().toFile(`${SHOTS}sky3_sheet_${TAG}.png`);
    console.log(`sheet test/shots/sky3_sheet_${TAG}.png (${row} pairs)`);
  }
}
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 16)) console.log(l);
await browser.close();
console.log(`[${secs()}]`);
console.log(fails === 0 ? 'ALL OK' : 'FAILED ' + fails);
