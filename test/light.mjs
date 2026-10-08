// F1 · Licht & Luft in the browser, against dist/ (build first: node build.js).
//  - LOOK: the six weather scenes at noon (seed 424242, Balanced, the open sky above the spawn, the HUD hidden, the
//    same view every time) and a view centred on the ringed gas giant, against v0.41's numbers measured with this
//    same probe on the v0.41 build (test/light_ref_v041.json; REFRESH=1 REFDIST=<v0.41 dist> measures them again).
//    Each scene is drawn, the eased exposure settled, drawn again and its canvas read (the sky band = the top third,
//    the land band = the bottom third). Checks that fail on the washed-out first F1: the clear day's mean luminance
//    within 10 % of v0.41's, the gas giant's contrast against the sky at least v0.41's, a saturation floor per scene,
//    no more clipping than v0.41, the weather's mood (rain and storm darker than the clear day), the exposure ±0.5 stops
//    and 1 at the clear noon, the fog's density (the foggy land's luminance near v0.41's).
//  - MEASURE: the fixed scene (default world, seed 1, the Heartland plaza at the spawn, 12:00 = ticks 6000, frozen
//    time and weather, 1280×720) on Very Low (potato) and High in one world: the frame time (FRAMES frames, then a 1×1
//    read of the canvas, which waits for the GPU: SwiftShader's work counts; relative costs only), the per-pass
//    submission time (renderer.prof), draws, tris, sections, full-screen passes. BOTH=1 measures the v0.41 copy
//    (REFDIST) first, in the same session: the before/after cost table.
//  - SHOTS: outdoors above the plaza at 06:00, 12:00, 18:30, 23:00; inside a lit stone room (two torches, a glowing
//    block, a window) at 18:30 and 23:00; Very Low and High → test/shots/light_<tag>_<preset>_<clock>.png. LOOK at them.
//  - RD (default 6) caps the render distance of both presets (High's 14 chunks take too long on the shared machine);
//    the shader tiers, shadows and effects are the preset's own.
//  - no page errors; ends with ALL OK / FAILED n.
// usage: TAG=f1 MODE=look|measure|shots|all BOTH=1 PRESETS=potato,high FRAMES=8 [DIST=<folder>] [REFDIST=<folder>]
//          bash test/wt_run.sh light.mjs 1800
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import { fileURLToPath } from 'url';
const TAG = process.env.TAG || 'f1';
const MODE = process.env.MODE || 'all';
const PRESETS = (process.env.PRESETS || 'potato,high').split(',');
const FRAMES = +(process.env.FRAMES || 8);
const SEED = process.env.SEED || '1';
const DIST = process.env.DIST || fileURLToPath(new URL('../dist', import.meta.url));
const REFDIST = process.env.REFDIST || fileURLToPath(new URL('../.tmp_tests/v041build/dist', import.meta.url));
const REF = '/home/claude/vr/test/light_ref_v041.json';   // (wt_run.sh points the path at this checkout)
const TMP = fileURLToPath(new URL('../.tmp_tests/', import.meta.url));
const RD = +(process.env.RD || 6);
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
const toTitle = async (dist) => {
  await page.goto('file://' + dist + '/index.html', { timeout: 180000 });
  for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
};

// ---- LOOK: one picture's numbers. The frame is drawn, the exposure settled (60 passes of 0.25 s on the scene just
// drawn, as the running game settles it), the frame drawn again and the canvas read in the same task.
const LOOK_SCENES = ['klar', 'bewoelkt', 'nebel', 'regen', 'gewitter', 'schnee'];
const LOOK_WORD = { klar: 'klar', bewoelkt: 'bewölkt', nebel: 'nebel', regen: 'regen', gewitter: 'gewitter', schnee: 'schnee' };
const LOOK_PROBE = ({ body }) => {
  const g = VR.game, R = g.renderer, gl = R.gl;
  const frame = () => { window.__norender = false; g.last = performance.now() - 33; g.loop(performance.now()); window.__norender = true; };
  frame();
  if (R.expOK && R.updateExposure) { const E2 = Object.assign({}, g.env.E, { dt: 0.25 }); for (let k = 0; k < 60; k++) R.updateExposure(E2); frame(); }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
  const buf = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  // per band: mean luminance, HSV saturation, perceptual chroma (OKLab C: a violet-blue and a pure blue of the same
  // colourfulness score alike), the share of clipped pixels (a channel ≥ 0.98), the mean colour
  const lin = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const band = (y0, y1) => {
    let n = 0, L = 0, S = 0, C = 0, clip = 0, r0 = 0, g0 = 0, b0 = 0;
    for (let y = y0; y < y1; y++) for (let x = 0; x < W; x += 2) {
      const i = (y * W + x) * 4, r = buf[i] / 255, gg = buf[i + 1] / 255, b = buf[i + 2] / 255;
      const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
      L += 0.2126 * r + 0.7152 * gg + 0.0722 * b; S += mx > 0.02 ? (mx - mn) / mx : 0; if (mx >= 0.98) clip++;
      const lr = lin(r), lg = lin(gg), lb = lin(b);
      const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb), m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb), q = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
      C += Math.hypot(1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * q, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * q);
      r0 += r; g0 += gg; b0 += b; n++;
    }
    return { lum: +(L / n).toFixed(4), sat: +(S / n).toFixed(4), chroma: +(C / n).toFixed(4), clip: +(clip / n).toFixed(4), rgb: [r0 / n, g0 / n, b0 / n].map(v => +v.toFixed(3)) };
  };
  // readPixels rows start at the bottom: the sky band is the top third of the picture
  const res = { W, H, sky: band(Math.floor(H * 0.66), H), land: band(0, Math.floor(H * 0.34)), all: band(0, H) };
  if (R.expOK) {
    const eb = new Float32Array(4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, R.expFB[R.expCur]); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, eb); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    res.gpuExposure = +eb[0].toFixed(4); res.sceneLum = +eb[1].toFixed(4);
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
  await toTitle(dist);
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
    const st = await ev(() => { const W = VR.game.env.wx; return { kind: W.kind, rain: +VR.game.env.rain.toFixed(3), snow: +VR.game.env.snow.toFixed(3), fog: +W.v.fog.toFixed(3), tod: VR.game.env.timeOfDay }; });
    const m = await ev(LOOK_PROBE, { body: false });
    out.scenes[kind] = { ...st, ...m };
    console.log(JSON.stringify({ tag, scene: kind, gpuExposure: m.gpuExposure, sceneLum: m.sceneLum, all: m.all, sky: m.sky, land: m.land }));
    await wait(150);
    await page.screenshot({ path: `${SHOTS}/look_${tag}_${kind}.png`, timeout: 180000 });
    if (kind === 'klar') {
      // the gas giant in the middle of the picture, for the body contrast
      await ev(() => { const g = VR.game, pl = g.player, d = g.env.E.bodies.giant; pl.pitch = Math.asin(d[1]); pl.yaw = Math.atan2(-d[0], -d[2]); });
      await drive(4, false);
      out.body = await ev(LOOK_PROBE, { body: true });
      console.log(JSON.stringify({ tag, scene: 'body', body: out.body.body, sky: out.body.sky }));
      await wait(150);
      await page.screenshot({ path: `${SHOTS}/look_${tag}_body.png`, timeout: 180000 });
      await ev(() => { const g = VR.game, pl = g.player; pl.pitch = -0.08; pl.yaw = 0.6; });
      await drive(4, false);
    }
  }
  fs.mkdirSync(TMP, { recursive: true });
  fs.writeFileSync(`${TMP}look_${tag}.json`, JSON.stringify(out, null, 1));
  return out;
};

// ---- MEASURE and SHOTS: one world per build, the presets switched in it
// the frame time: FRAMES frames, then a 1×1 read of the canvas — the read waits until the GPU (SwiftShader) has drawn
// every frame (WebGL's finish() is a flush in Chromium: it does not wait), so the time is the real work, CPU and GPU
const timed = (n) => ev((m) => {
  const g = VR.game, R = g.renderer, gl = R.gl, px = new Uint8Array(4);
  window.__norender = false;
  const sync = () => { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
  sync();
  const t0 = performance.now();
  for (let i = 0; i < m; i++) { g.last = performance.now() - 33; g.loop(performance.now()); }
  sync();
  window.__norender = true;
  return (performance.now() - t0) / m;
}, n);
const measure = async (btag, preset) => {
  await ev(() => { const g = VR.game; g.env.setTime(6000); });
  await drive(3, true);                      // warm-up: shaders compile, first chunks upload
  await timed(2);
  await ev(() => { const R = VR.game.renderer; R.prof = {}; });
  const wall = await timed(FRAMES);
  const r = await ev((n) => {
    const R = VR.game.renderer, P = R.prof || {}; const out = { passes: {}, fsPerFrame: (P.fs || 0) / n, W: R.w, H: R.h, shadowRes: R.shadowSize || 0 };
    for (const k of Object.keys(P)) if (k !== 'cur' && k !== 't' && k !== 'fs') out.passes[k] = +(P[k] / n).toFixed(3);
    out.total = +Object.values(out.passes).reduce((a, b) => a + b, 0).toFixed(3);
    const S = R.stats || {};
    out.stats = { draws: S.draws, tris: Math.round(S.tris || 0), sections: S.sections, ms: S.ms !== undefined ? +S.ms.toFixed(2) : null };
    R.prof = null;
    return out;
  }, FRAMES);
  r.wallMs = +wall.toFixed(2);
  console.log(`[${btag} ${preset}] ${r.W}x${r.H} ${r.wallMs} ms/frame (CPU + GPU, synced by a canvas read), submission per pass ${r.total} ms, draws ${r.stats.draws}, tris ${r.stats.tris}, sections ${r.stats.sections}, full-screen passes ${r.fsPerFrame}`);
  console.log('   ' + Object.entries(r.passes).map(([k, v]) => `${k} ${v}`).join(' · '));
  check(r.wallMs > 0 && Number.isFinite(r.wallMs), `${btag} ${preset}: the frames measured (${r.wallMs} ms per frame)`);
  return r;
};
const shots = async (btag, preset, spot) => {
  // outdoors: above the plaza, 30 blocks up, looking across the land
  await ev((p) => { const pl = VR.game.player; pl.flying = true; pl.teleport(p[0] + 0.5, p[1] + 30, p[2] + 0.5); pl.pitch = -0.12; pl.yaw = 0.6; }, spot.ground);
  await settle(60);
  for (const [label, t] of CLOCKS) {
    await ev((tt) => { VR.game.env.setTime(tt); }, t);
    await drive(3, true); await drive(1, true);
    await page.screenshot({ path: `${SHOTS}/light_${btag}_${preset}_${label}.png`, timeout: 180000 });
  }
  // inside the lit room (built once per world, beside the spawn)
  await ev((r) => { const pl = VR.game.player; pl.flying = true; pl.teleport(r[0], r[1], r[2]); pl.pitch = -0.12; pl.yaw = 0.6; }, spot.room);
  await settle(60);
  for (const [label, t] of INSIDE) {
    await ev((tt) => { VR.game.env.setTime(tt); }, t);
    await drive(3, true); await drive(1, true);
    await page.screenshot({ path: `${SHOTS}/light_${btag}_${preset}_inside_${label}.png`, timeout: 180000 });
  }
  console.log(`shots ${btag} ${preset}: test/shots/light_${btag}_${preset}_*.png`);
};
const buildRoom = (gr) => ev(([gx, gy, gz]) => {
  // stone walls on a plinth, a window, two torches and a glowing block, 30 blocks east of the spawn
  const g = VR.game, w = g.world, R = VR.R;
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
  return [ox + 4.5, y0 + 1.02, oz + 2.5];
}, gr);

try {
  if (MODE === 'look' || MODE === 'all') {
    // v0.41's numbers: the committed reference (measured with this probe on the v0.41 build), or measured again
    let REFL;
    if (process.env.REFRESH) {
      REFL = await lookAt(REFDIST, 'v041');
      REFL.note = 'v0.41 (9bf1448) measured by test/light.mjs LOOK on the git archive build; MODE=look REFRESH=1 REFDIST=<dist> measures again';
      fs.writeFileSync(REF, JSON.stringify(REFL, null, 1));
    } else REFL = JSON.parse(fs.readFileSync(REF, 'utf8'));
    const L = await lookAt(DIST, TAG);
    const S = L.scenes, R0 = REFL.scenes, K = S.klar, RK = R0.klar;
    check(LOOK_SCENES.every((k) => S[k] && S[k].all && R0[k] && R0[k].all), `look: the six scenes measured (clear noon ${K.all.lum} against v0.41's ${RK.all.lum})`);
    check(!!(L.body && L.body.body && L.body.body.contrast !== undefined && REFL.body && REFL.body.body), `look: the gas giant's disc found (contrast ${L.body && L.body.body ? L.body.body.contrast : '-'} against v0.41's ${REFL.body.body.contrast})`);
    check(LOOK_SCENES.every((k) => S[k].gpuExposure >= 0.707 && S[k].gpuExposure <= 1.415), `the exposure stays within ±0.5 stops in every scene (${LOOK_SCENES.map((k) => S[k].gpuExposure).join(', ')})`);
    check(Math.abs(K.gpuExposure - 1) <= 0.05, `clear noon: the exposure is 1 (${K.gpuExposure}; the scene's log-average ${K.sceneLum})`);
    check(Math.abs(K.all.lum / RK.all.lum - 1) <= 0.10, `clear noon: the mean luminance within 10 % of v0.41's (${K.all.lum} against ${RK.all.lum})`);
    check(L.body.body.contrast >= REFL.body.body.contrast, `the gas giant stands out at least as much as in v0.41 (contrast ${L.body.body.contrast} against ${REFL.body.body.contrast})`);
    // colourfulness: the perceptual chroma when the reference has it (REFRESH=1 measures it), else the HSV saturation
    const cf = (b) => (RK.sky.chroma !== undefined ? b.chroma : b.sat), cfName = RK.sky.chroma !== undefined ? 'chroma' : 'saturation';
    const satLow = LOOK_SCENES.filter((k) => !(cf(S[k].sky) >= 0.9 * cf(R0[k].sky) && cf(S[k].land) >= 0.9 * cf(R0[k].land)));
    check(satLow.length === 0, `${cfName} floor: no scene loses more than 10 % of v0.41's in the sky or the land band${satLow.length ? ' (' + satLow.map((k) => `${k}: sky ${cf(S[k].sky)}/${cf(R0[k].sky)}, land ${cf(S[k].land)}/${cf(R0[k].land)}`).join('; ') + ')' : ''}`);
    check(cf(K.sky) >= cf(RK.sky), `the clear sky at least as colourful as v0.41's (${cfName} ${cf(K.sky)} against ${cf(RK.sky)})`);
    const clipHi = LOOK_SCENES.filter((k) => !(S[k].all.clip <= R0[k].all.clip + 0.02));
    check(clipHi.length === 0, `no bleaching: no scene clips more than v0.41 (+2 points)${clipHi.length ? ' (' + clipHi.map((k) => `${k} ${S[k].all.clip}/${R0[k].all.clip}`).join('; ') + ')' : ''}`);
    check(S.regen.all.lum < K.all.lum && S.gewitter.all.lum < K.all.lum && S.gewitter.all.lum <= S.regen.all.lum + 0.01, `the weather keeps its mood: rain (${S.regen.all.lum}) and storm (${S.gewitter.all.lum}) darker than the clear day (${K.all.lum})`);
    check(['regen', 'gewitter', 'schnee'].every((k) => S[k].sky.lum <= R0[k].sky.lum * 1.08), `no white haze: the rain, storm and snow skies no brighter than v0.41's (+8 %) (${['regen', 'gewitter', 'schnee'].map((k) => `${k} ${S[k].sky.lum}/${R0[k].sky.lum}`).join(', ')})`);
    check(Math.abs(S.nebel.land.lum / R0.nebel.land.lum - 1) <= 0.15, `fog density near v0.41: the foggy land within 15 % of v0.41's luminance (${S.nebel.land.lum} against ${R0.nebel.land.lum})`);
  }
  if (MODE === 'measure' || MODE === 'shots' || MODE === 'all') {
    const BUILDS = process.env.BOTH ? [[REFDIST, 'v041'], [DIST, TAG]] : [[DIST, TAG]];
    for (const [bdist, btag] of BUILDS) {
      await toTitle(bdist);
      const results = {};
      await ev(([p, rd]) => { const g = VR.game; g.applyPreset(p); g.settings.renderDist = rd; g.settings.dynRes = false; g.applySettings('*'); }, [PRESETS[0], RD]);
      await ev(`VR.game.createWorld({name:'Light',mode:'creative',difficulty:'peaceful',type:'default',seed:'${SEED}',cheats:true,kit:true})`);
      for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
      await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.zenFreezeWeather = true; g.env.rainTarget = 0; g.hideHud = true; const hd = document.getElementById('hud'); if (hd) hd.style.display = 'none'; });
      const spot = { ground: await ev(() => { const pl = VR.game.player; pl.flying = true; pl.pitch = -0.08; pl.yaw = 0.6; return [Math.floor(pl.pos[0]), Math.floor(pl.pos[1]), Math.floor(pl.pos[2])]; }) };
      await ev(() => { VR.game.env.setTime(6000); });
      for (const preset of PRESETS) {
        await ev(([p, rd]) => { const g = VR.game; g.applyPreset(p); g.settings.renderDist = rd; g.settings.dynRes = false; g.applySettings('*'); }, [preset, RD]);
        await ev((p) => { const pl = VR.game.player; pl.flying = true; pl.teleport(p[0] + 0.5, p[1] + 0.02, p[2] + 0.5); pl.pitch = -0.08; pl.yaw = 0.6; }, spot.ground);
        await settle();
        if (MODE !== 'shots') results[preset] = await measure(btag, preset);
        if (MODE !== 'measure') {
          if (!spot.room) { spot.room = await buildRoom(spot.ground); await settle(40); }
          await shots(btag, preset, spot);
        }
      }
      if (MODE !== 'shots') {
        fs.mkdirSync(TMP, { recursive: true });
        fs.writeFileSync(`${TMP}light_measure_${btag}.json`, JSON.stringify(results, null, 1));
      }
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
process.exitCode = fails ? 1 : 0;
