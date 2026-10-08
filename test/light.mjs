// F1 · Licht & Luft in the browser, against dist/ (build first: node build.js).
//  - MEASURE: the fixed scene (default world, seed 1, the Heartland plaza at the spawn, 12:00 = ticks 6000, frozen
//    time and weather, 1280×720) on Very Low (potato) and High: per pass time (renderer.prof: gl.finish() around
//    every pass, so the SwiftShader work counts; relative costs only), draws, tris, sections, full-screen passes.
//    Written to .tmp_tests/light_measure_<TAG>.json and printed. Averages over FRAMES frames after a warm-up.
//  - SHOTS: outdoors above the plaza at 06:00 (ticks 0), 12:00 (6000), 18:30 (12500), 23:00 (17000); then inside a
//    lit stone room (two torches, a glowing block, a window) built beside the spawn, at 18:30 and 23:00. On Very Low
//    and High → test/shots/light_<preset>_<clock>.png and light_<preset>_inside_<clock>.png. LOOK at them.
//  - RD (default 6) caps the render distance of both presets: at 14 chunks (High) the default world takes too long to
//    generate on the shared machine. The shader tiers, shadows and effects are the preset's own.
//  - LOOK (MODE=look, or in all): the six weather scenes at noon and the gas giant's disc, this build against the
//    v0.41 copy (.tmp_tests/v041build/dist) in the same session: the clear day's luminance, exposure, sky body contrast,
//    saturation floor, no bleaching, fog density (the foggy land). Writes look_<TAG>.json and test/shots/look_<tag>_*.png.
//  - no page errors; every test ends with ALL OK / FAILED n.
// usage: TAG=f1e MODE=look|measure|lm|shots|all BOTH=1 PRESETS=potato,high FRAMES=8 [DIST=<folder>] [REFDIST=<folder>] bash test/wt_run.sh light.mjs 4200
//   (lm = the look and the measure in one session; BOTH=1 measures the v0.41 copy first, as the reference)
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import { fileURLToPath } from 'url';
const TAG = process.env.TAG || 'light';
const MODE = process.env.MODE || 'all';
const PRESETS = (process.env.PRESETS || 'potato,high').split(',');
const FRAMES = +(process.env.FRAMES || 8);
const SEED = process.env.SEED || '1';
// the build under test: this checkout's dist/; the v0.41 reference: the copy in .tmp_tests/v041build/dist (git archive v041)
const DIST = process.env.DIST || fileURLToPath(new URL('../dist', import.meta.url));
const REFDIST = process.env.REFDIST || fileURLToPath(new URL('./v041build/dist', import.meta.url));
const RD = +(process.env.RD || 6);   // render distance (chunks) of the measured scene, the same cap on both builds
const SHOTS = '/home/claude/vr/test/shots';
const CLOCKS = [['0600', 0], ['1200', 6000], ['1830', 12500], ['2300', 17000]];
const INSIDE = [['1830', 12500], ['2300', 17000]];
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error') logs.push(`[${t}] ${s.slice(0, 400)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 800)));
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ok    ' : '  FAIL  ') + msg); };
const errorsNow = () => logs.filter(l => l.startsWith('[pageerror]') || l.startsWith('[error]'));

// loop the game without the browser's own frame chain: the test drives every frame (see atmosphere.mjs)
const drive = (n, render) => ev(([m, r]) => {
  const g = VR.game, R = g.renderer;
  window.requestAnimationFrame = () => 0;
  // the frames without drawing: the render call only places the camera (the game's loop has no such switch)
  if (!R._render) { R._render = R.render; R.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; }
  window.__norender = !r;
  for (let i = 0; i < m; i++) { g.last = performance.now() - 33; g.loop(performance.now()); }
  if (r) R.gl.finish();
  window.__norender = true;
}, [n, render]);
const settle = async (max = 120) => {
  for (let i = 0; i < max; i++) {
    await drive(10, false);
    const s = await ev(() => { const g = VR.game; let dirty = 0; for (const c of g.world.cols.values()) for (const sc of c.sec) if (sc.dirty || sc.pending) dirty++; return { busy: g.pool.busy, pend: g.world.pending.size, dirty }; });
    if (s.busy === 0 && s.pend === 0 && s.dirty === 0 && i > 3) break;
    await wait(60);
  }
};

// MODE=look: the six weather scenes at noon on the look scene (seed 424242, Balanced, the open sky above the spawn, the
// same view every time), and a view centred on the ringed gas giant (the sky body, for its contrast). Each scene is
// drawn twice: the first frame lets the eased exposure settle (60 passes of 0.25 s on the scene just drawn), the second
// is the one measured. Bands: the sky (top third), the land (bottom third), all. REF=v041 measures the reference build
// (.tmp_tests/v041build/dist: v0.41 at 9bf1448) is measured in the same session, and the checks compare with it.
const LOOK_SCENES = ['klar', 'bewoelkt', 'nebel', 'regen', 'gewitter', 'schnee'];
const LOOK_WORD = { klar: 'klar', bewoelkt: 'bewölkt', nebel: 'nebel', regen: 'regen', gewitter: 'gewitter', schnee: 'schnee' };
const LOOK_PROBE = ({ body, converge }) => {
  const g = VR.game, R = g.renderer, gl = R.gl;
  const frame = () => { window.__norender = false; g.last = performance.now() - 33; g.loop(performance.now()); window.__norender = true; };
  frame();
  if (converge && R.expOK) { const E2 = Object.assign({}, g.env.E, { dt: 0.25 }); for (let k = 0; k < 60; k++) R.updateExposure(E2); frame(); }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
  const buf = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  const band = (y0, y1) => {
    let n = 0, L = 0, S = 0, clip = 0, r0 = 0, g0 = 0, b0 = 0;
    for (let y = y0; y < y1; y++) for (let x = 0; x < W; x += 2) {
      const i = (y * W + x) * 4, r = buf[i] / 255, gg = buf[i + 1] / 255, b = buf[i + 2] / 255;
      const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
      L += 0.2126 * r + 0.7152 * gg + 0.0722 * b; S += mx > 0.02 ? (mx - mn) / mx : 0; if (mx >= 0.98) clip++;
      r0 += r; g0 += gg; b0 += b; n++;
    }
    return { lum: +(L / n).toFixed(4), sat: +(S / n).toFixed(4), clip: +(clip / n).toFixed(4), rgb: [r0 / n, g0 / n, b0 / n].map(v => +v.toFixed(3)) };
  };
  const res = { W, H, sky: band(Math.floor(H * 0.66), H), land: band(0, Math.floor(H * 0.34)), all: band(0, H) };
  if (R.expOK) {
    const eb = new Float32Array(4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, R.expFB[R.expCur]); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, eb); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    res.gpuExposure = +eb[0].toFixed(4);
  }
  if (body) {
    const d = g.env.E.bodies.giant, rad = g.env.E.bodies.radius.giant, VP = R.viewProj;
    const proj = (x, y, z) => { const cx = VP[0] * x + VP[4] * y + VP[8] * z, cy = VP[1] * x + VP[5] * y + VP[9] * z, cw = VP[3] * x + VP[7] * y + VP[11] * z; return [(cx / cw * 0.5 + 0.5) * W, (cy / cw * 0.5 + 0.5) * H, cw]; };
    const c0 = proj(d[0], d[1], d[2]);
    let t = [-d[2], 0, d[0]]; const tl = Math.hypot(t[0], t[1], t[2]) || 1; t = [t[0] / tl, t[1] / tl, t[2] / tl];
    const p1 = [d[0] * Math.cos(rad) + t[0] * Math.sin(rad), d[1] * Math.cos(rad) + t[1] * Math.sin(rad), d[2] * Math.cos(rad) + t[2] * Math.sin(rad)];
    const c1 = proj(p1[0], p1[1], p1[2]);
    const rp = Math.hypot(c1[0] - c0[0], c1[1] - c0[1]);
    res.body = { cx: +c0[0].toFixed(1), cy: +c0[1].toFixed(1), rPx: +rp.toFixed(1), inFront: c0[2] > 0 };
    if (c0[2] > 0 && rp > 4) {
      // the disc (inside 0.75 r) against the ring around it (1.25 … 2.1 r): the colour and luminance difference
      const acc = (inside) => {
        let n = 0, r0 = 0, g0 = 0, b0 = 0, L = 0;
        for (let y = Math.max(0, Math.floor(c0[1] - 2.2 * rp)); y < Math.min(H, Math.ceil(c0[1] + 2.2 * rp)); y++) for (let x = Math.max(0, Math.floor(c0[0] - 2.2 * rp)); x < Math.min(W, Math.ceil(c0[0] + 2.2 * rp)); x++) {
          const dd = Math.hypot(x - c0[0], y - c0[1]) / rp;
          if (!inside(dd)) continue;
          const i = (y * W + x) * 4; r0 += buf[i] / 255; g0 += buf[i + 1] / 255; b0 += buf[i + 2] / 255; L += (0.2126 * buf[i] + 0.7152 * buf[i + 1] + 0.0722 * buf[i + 2]) / 255; n++;
        }
        return { rgb: [r0 / n, g0 / n, b0 / n], lum: L / n };
      };
      const disc = acc((dd) => dd < 0.75), ring = acc((dd) => dd > 1.25 && dd < 2.1);
      res.body.disc = disc.rgb.map(v => +v.toFixed(3)); res.body.ring = ring.rgb.map(v => +v.toFixed(3));
      res.body.contrast = +Math.hypot(disc.rgb[0] - ring.rgb[0], disc.rgb[1] - ring.rgb[1], disc.rgb[2] - ring.rgb[2]).toFixed(4);
      res.body.lumDiff = +Math.abs(disc.lum - ring.lum).toFixed(4);
    }
  }
  return res;
};
const lookAt = async (dist, tag) => {
  await page.goto('file://' + dist + '/index.html');
  for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
  await ev(`VR.game.createWorld({name:'Look',mode:'survival',difficulty:'normal',type:'default',seed:'424242',cheats:true,kit:true})`);
  for (let i = 0; i < 60; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
  await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.renderDist = 7; g.settings.dynRes = false; g.applySettings('renderDist'); g.zenFreezeTime = true; g.env.setTime(6000); g.hideHud = true; const hd = document.getElementById('hud'); if (hd) hd.style.display = 'none'; });
  await ev(() => { window.requestAnimationFrame = () => 0; });
  const up = await ev(() => {
    const g = VR.game, w = g.world, p = g.player, x = Math.floor(p.pos[0]), z = Math.floor(p.pos[2]);
    let y0 = -1;
    for (let y = Math.floor(p.pos[1]) + 1; y < 240; y++) if ((w.getLight(x, y, z) >>> 12) >= 15 && !w.getBlock(x, y, z) && !w.getBlock(x, y + 1, z)) { y0 = y; break; }
    p.setMode('creative');
    if (y0 > 0) p.teleport(x + 0.5, y0 + 3, z + 0.5);
    p.flying = true;
    return y0;
  });
  console.log('look: open sky at y ' + up);
  for (let k = 0; k < 600; k += 60) await drive(60, false);
  const out = { tag, scenes: {} };
  for (const kind of LOOK_SCENES) {
    await ev((w) => VR.game.chat('/wetter ' + w), LOOK_WORD[kind]);
    for (let k = 0; k < 720; k += 60) await drive(60, false);
    console.log(`look: ${tag} ${kind} settled`);
    const st = await ev(() => { const W = VR.game.env.wx; return { kind: W.kind, rain: +VR.game.env.rain.toFixed(3), snow: +VR.game.env.snow.toFixed(3), fog: +W.v.fog.toFixed(3), tod: VR.game.env.timeOfDay }; });
    const m = await ev(LOOK_PROBE, { body: false, converge: true });
    out.scenes[kind] = { ...st, ...m };
    console.log(JSON.stringify({ tag, scene: kind, gpuExposure: m.gpuExposure, exposure: m.exposure, all: m.all, sky: m.sky, land: m.land }));
    await wait(150);
    await page.screenshot({ path: `${SHOTS}/look_${tag}_${kind}.png`, timeout: 180000 });
    if (kind === 'klar') {
      // the gas giant in the middle of the picture, for the body contrast
      await ev(() => { const g = VR.game, pl = g.player, d = g.env.E.bodies.giant; pl.pitch = Math.asin(d[1]); pl.yaw = Math.atan2(-d[0], -d[2]); });
      await drive(4, false);
      out.body = await ev(LOOK_PROBE, { body: true, converge: true });
      console.log(JSON.stringify({ tag, scene: 'body', body: out.body.body, sky: out.body.sky }));
      await wait(150);
      await page.screenshot({ path: `${SHOTS}/look_${tag}_body.png`, timeout: 180000 });
      await ev(() => { const g = VR.game, pl = g.player; pl.pitch = -0.08; pl.yaw = 0.6; });
      await drive(4, false);
    }
  }
  fs.mkdirSync('/home/claude/vr/.tmp_tests', { recursive: true });
  fs.writeFileSync(`/home/claude/vr/.tmp_tests/look_${tag}.json`, JSON.stringify(out, null, 1));
  return out;
};

try {
  // the builds measured: this one, and with BOTH=1 the v0.41 copy first, in the same browser session
  const BUILDS = process.env.BOTH ? [[REFDIST, 'v041'], [DIST, TAG]] : [[DIST, TAG]];
  if (MODE === 'look' || MODE === 'all' || MODE === 'lm') {
    // the v0.41 reference first, then this build, in one browser session: the same scene, view and seed for both
    // the v0.41 numbers: measured again only with REFRESH=1 (or when .tmp_tests/look_v041.json is missing)
    const refPath = '/home/claude/vr/.tmp_tests/look_v041.json';
    const REFL = !process.env.REFRESH && fs.existsSync(refPath) ? JSON.parse(fs.readFileSync(refPath, 'utf8')) : await lookAt(REFDIST, 'v041');
    const L = await lookAt(DIST, TAG);
    const S = L.scenes, R0 = REFL.scenes, K = S.klar, RK = R0.klar;
    check(LOOK_SCENES.every((k) => S[k] && S[k].all && R0[k] && R0[k].all), `look: the six scenes measured in both builds (clear noon ${K.all.lum} against v0.41's ${RK.all.lum})`);
    check(!!(L.body && L.body.body && REFL.body && REFL.body.body), `look: the gas giant's disc found in both views (contrast ${L.body && L.body.body ? L.body.body.contrast : '-'} against v0.41's ${REFL.body && REFL.body.body ? REFL.body.body.contrast : '-'})`);
    check(LOOK_SCENES.every((k) => S[k].gpuExposure >= 0.707 && S[k].gpuExposure <= 1.415), 'the exposure stays within ±0.5 stops in every scene');
    check(Math.abs(K.gpuExposure - 1) <= 0.1, `clear noon: the exposure is near 1 (${K.gpuExposure})`);
    check(Math.abs(K.all.lum / RK.all.lum - 1) <= 0.10, `clear noon: the mean luminance within 10 % of v0.41 (${K.all.lum} against ${RK.all.lum})`);
    check(L.body.body.contrast >= REFL.body.body.contrast, `the gas giant stands out at least as much as in v0.41 (contrast ${L.body.body.contrast} against ${REFL.body.body.contrast})`);
    check(LOOK_SCENES.every((k) => S[k].sky.sat >= 0.9 * R0[k].sky.sat && S[k].land.sat >= 0.9 * R0[k].land.sat), "saturation floor: no scene loses more than 10 % of v0.41's saturation in the sky or the land band");
    check(K.sky.clip <= RK.sky.clip + 0.02, `no bleaching: the clear sky clips no more than v0.41 (${K.sky.clip} against ${RK.sky.clip})`);
    check(LOOK_SCENES.every((k) => S[k].all.clip <= R0[k].all.clip + 0.02), 'no bleaching: no scene clips more than v0.41 (+2 points)');
    check(Math.abs(S.nebel.land.lum / R0.nebel.land.lum - 1) <= 0.15, `fog density near v0.41: the foggy land within 15 % of v0.41's luminance (${S.nebel.land.lum} against ${R0.nebel.land.lum})`);
  }
  for (const [bdist, btag] of (MODE === 'look' ? [] : BUILDS)) {
  await page.goto('file://' + bdist + '/index.html');
  for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
  const results = {};
  for (const preset of PRESETS) {
    await ev(([p, rd]) => { const g = VR.game; g.applyPreset(p); g.settings.renderDist = rd; g.settings.dynRes = false; g.applySettings('*'); }, [preset, RD]);
    await ev(`VR.game.createWorld({name:'Light ${preset}',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:true})`);
    for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
    await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.zenFreezeWeather = true; g.env.rainTarget = 0; g.hideHud = true; const hd = document.getElementById('hud'); if (hd) hd.style.display = 'none'; });
    await ev(() => { const g = VR.game, pl = g.player; pl.flying = true; pl.pitch = -0.08; pl.yaw = 0.6; });
    await ev(() => { const g = VR.game; g.env.setTime(6000); });
    await settle();
    if (MODE === 'measure' || MODE === 'all' || MODE === 'lm') {
      await ev(() => { const g = VR.game; g.env.setTime(6000); });
      await drive(3, true);                      // warm-up: shaders compile, first chunks upload
      await ev(() => { const R = VR.game.renderer; R.prof = {}; });
      const t0 = await ev(() => performance.now());
      await drive(FRAMES, true);                 // gl.finish() ends each frame: the SwiftShader work counts
      const wall = ((await ev(() => performance.now())) - t0) / FRAMES;
      const r = await ev((n) => {
        const R = VR.game.renderer, P = R.prof || {}; const out = { passes: {}, fsPerFrame: (P.fs || 0) / n, W: R.w, H: R.h, outW: R.W, outH: R.H, shadowRes: R.shadowSize || 0 };
        for (const k of Object.keys(P)) if (k !== 'cur' && k !== 't' && k !== 'fs') out.passes[k] = +(P[k] / n).toFixed(3);
        out.total = +Object.values(out.passes).reduce((a, b) => a + b, 0).toFixed(3);
        const S = R.stats || {};
        out.stats = { draws: S.draws, tris: Math.round(S.tris || 0), sections: S.sections, shadowDraws: S.shadowDraws || 0, ms: S.ms !== undefined ? +S.ms.toFixed(2) : null };
        out.player = [VR.game.player.pos[0].toFixed(1), VR.game.player.pos[1].toFixed(1), VR.game.player.pos[2].toFixed(1)];
        R.prof = null;
        return out;
      }, FRAMES);
      r.wallMs = +wall.toFixed(2);
      results[preset] = r;
      console.log(`[${btag} ${preset}] ${r.W}x${r.H} wall ${r.wallMs} ms/frame (gl.finish-bounded), passes ${r.total} ms, draws ${r.stats.draws}, tris ${r.stats.tris}, sections ${r.stats.sections}, fs passes ${r.fsPerFrame}`);
      console.log('   ' + Object.entries(r.passes).map(([k, v]) => `${k} ${v}`).join(' · '));
      check(r.wallMs > 0 && Number.isFinite(r.wallMs), `${btag} ${preset}: the frames measured (${r.wallMs} ms per frame)`);
    }
    if (MODE === 'shots' || MODE === 'all') {
      // where the player stands on the ground (the room is built beside it, after the outdoor pictures)
      const ground = await ev(() => { const pl = VR.game.player; return [Math.floor(pl.pos[0]), Math.floor(pl.pos[1]), Math.floor(pl.pos[2])]; });
      // the picture: above the plaza, 30 blocks up, looking across the land (the spec's outdoor shots)
      await ev(() => { const g = VR.game, pl = g.player; pl.flying = true; pl.teleport(pl.pos[0], pl.pos[1] + 30, pl.pos[2]); pl.pitch = -0.12; });
      await settle(60);
      for (const [label, t] of CLOCKS) {
        await ev((tt) => { const g = VR.game; g.env.setTime(tt); }, t);
        await drive(3, true);
        await drive(1, true);
        await page.screenshot({ path: `${SHOTS}/light_${btag}_${preset}_${label}.png`, timeout: 180000 });
        console.log('shot', preset, label);
      }
      // inside a lit room, built beside the spawn: stone walls on a plinth, a window, two torches and a glowing block
      await ev(([gx, gy, gz]) => {
        const g = VR.game, w = g.world, R = VR.R, pl = g.player;
        const S = (n) => { const t = R.byName[n]; return t ? t.defaultState : null; };
        const ox = gx + 30, oz = gz - 24, y0 = gy - 1;
        const put = (x, y, z, s) => { if (s !== null) w.setBlock(x, y, z, s, 4); };
        const stone = S('stone_bricks') ?? S('stone'), floor = S('oak_planks') ?? S('planks'), glass = S('glass');
        const torch = S('torch'), lamp = S('glowstone') ?? S('lantern') ?? S('torch');
        for (let x = -1; x <= 9; x++) for (let z = -1; z <= 9; z++) {
          for (let y = y0 - 3; y <= y0; y++) put(ox + x, y, oz + z, stone);
          for (let y = y0 + 1; y <= y0 + 6; y++) put(ox + x, y, oz + z, 0);
        }
        for (let x = 0; x <= 8; x++) for (let z = 0; z <= 8; z++) {
          put(ox + x, y0, oz + z, floor);
          put(ox + x, y0 + 5, oz + z, stone);
          if (x === 0 || x === 8 || z === 0 || z === 8) for (let y = y0 + 1; y <= y0 + 4; y++) put(ox + x, y, oz + z, stone);
        }
        for (let z = 3; z <= 5; z++) for (let y = y0 + 2; y <= y0 + 3; y++) put(ox + 8, y, oz + z, glass);
        for (let y = y0 + 1; y <= y0 + 2; y++) put(ox + 4, y, oz, 0);
        put(ox + 1, y0 + 2, oz + 1, torch); put(ox + 7, y0 + 2, oz + 7, torch); put(ox + 4, y0 + 1, oz + 4, lamp);
        pl.flying = true; pl.teleport(ox + 4.5, y0 + 1.02, oz + 2.5); pl.pitch = -0.12; pl.yaw = 0.6;
      }, ground);
      await settle(80);
      for (const [label, t] of INSIDE) {
        await ev((tt) => { const g = VR.game; g.env.setTime(tt); }, t);
        await drive(3, true);
        await drive(1, true);
        await page.screenshot({ path: `${SHOTS}/light_${btag}_${preset}_inside_${label}.png`, timeout: 180000 });
        console.log('shot', preset, 'inside', label);
      }
    }
  }
  if (MODE === 'measure' || MODE === 'all' || MODE === 'lm') {
    fs.mkdirSync('/home/claude/vr/.tmp_tests', { recursive: true });
    fs.writeFileSync(`/home/claude/vr/.tmp_tests/light_measure_${btag}.json`, JSON.stringify(results, null, 1));
    for (const p of PRESETS) check(results[p] && results[p].stats.draws >= 0, `${btag} ${p}: measured draws ${results[p] && results[p].stats.draws}`);
  }
  }
  check(errorsNow().length === 0, `no page or WebGL errors (${errorsNow().length})`);
  for (const l of errorsNow().slice(0, 6)) console.log('    ' + l.slice(0, 300));
} catch (e) {
  fails++;
  console.log('  FAIL  exception: ' + (e.stack || e.message).slice(0, 600));
} finally {
  await browser.close();
}
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
