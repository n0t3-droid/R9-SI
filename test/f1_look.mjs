// regress: skip — F1 look harness (pictures and numbers to tune and to report the sky; the checks live in test/light.mjs)
// The six weather scenes of test/atmosphere.mjs (seed 424242, Balanced, noon, the same flight above the spawn, the same
// view, the HUD as atmosphere.mjs shows it), for one or more builds in one browser session, with optional runtime
// variants, plus a view centred on the ringed gas giant. Per scene: the frame is drawn, the eased exposure is settled
// (as the running game settles it), the frame is drawn again and its pixels read in the same task (the canvas, no HUD):
// mean luminance, saturation and clipping of the sky band (top third), the land band (bottom third) and all; the
// exposure read back; then a screenshot (with the HUD) → test/shots/<tag>_<variant>_<scene>.png.
//   DISTS=<folder>[,<folder>...]   builds (default: this checkout's dist/); TAGS=a,b names them (default f1, ref, …)
//   VARIANTS=<file.json>           [{ "name": "a", "code": "VR.Atmos.K.x = 1" }, …] run in the page before each picture
//   VTAGS=f1                       the builds that get the variants (default all; the others draw 'base' only)
//   SCENES=klar,regen              a subset (default the six); BODY=0 skips the gas giant's view; HUD=0 hides the HUD
//   nohup bash test/wt_run.sh f1_look.mjs 2400 > .tmp_tests/f1_look.log 2>&1 &
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import { fileURLToPath } from 'url';
const HERE = fileURLToPath(new URL('..', import.meta.url));
const DISTS = (process.env.DISTS || fileURLToPath(new URL('../dist', import.meta.url))).split(',');
const TAGS = (process.env.TAGS || 'f1,ref,c,d').split(',');
const VARIANTS = process.env.VARIANTS ? JSON.parse(fs.readFileSync(process.env.VARIANTS, 'utf8')) : [{ name: 'base', code: '' }];
const VTAGS = process.env.VTAGS ? process.env.VTAGS.split(',') : null;
const SCENES = (process.env.SCENES || 'klar,bewoelkt,nebel,regen,gewitter,schnee').split(',');
const WORD = { klar: 'klar', bewoelkt: 'bewölkt', nebel: 'nebel', regen: 'regen', gewitter: 'gewitter', schnee: 'schnee' };
const SHOTS = '/home/claude/vr/test/shots';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error') logs.push(`[${t}] ${s.slice(0, 300)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 600)));
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
// the game loop without drawing (as atmosphere.mjs: the test drives every frame)
const loops = async (n) => {
  for (let k = 0; k < n; k += 60) await ev(([m]) => {
    const g = VR.game, R = g.renderer;
    if (!R._render) { R._render = R.render; R.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; }
    window.__norender = true;
    for (let i = 0; i < m; i++) { g.last = performance.now() - 33; g.loop(performance.now()); }
  }, [Math.min(60, n - k)]);
};
// one picture: draw, settle the exposure (60 passes of 0.25 s on the scene just drawn), draw again, read the canvas
const PROBE = ({ body }) => {
  const g = VR.game, R = g.renderer, gl = R.gl;
  const frame = () => { window.__norender = false; g.last = performance.now() - 33; g.loop(performance.now()); window.__norender = true; };
  frame();
  if (R.expOK && R.updateExposure) { const E2 = Object.assign({}, g.env.E, { dt: 0.25 }); for (let k = 0; k < 60; k++) R.updateExposure(E2); frame(); }
  else frame();
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight;
  const buf = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  const band = (y0, y1) => {
    let n = 0, L = 0, S = 0, clip = 0, r0 = 0, g0 = 0, b0 = 0, dark = 0;
    for (let y = y0; y < y1; y++) for (let x = 0; x < W; x += 2) {
      const i = (y * W + x) * 4, r = buf[i] / 255, gg = buf[i + 1] / 255, b = buf[i + 2] / 255;
      const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
      L += 0.2126 * r + 0.7152 * gg + 0.0722 * b; S += mx > 0.02 ? (mx - mn) / mx : 0; if (mx >= 0.98) clip++; if (mx < 0.25) dark++;
      r0 += r; g0 += gg; b0 += b; n++;
    }
    return { lum: +(L / n).toFixed(4), sat: +(S / n).toFixed(4), clip: +(clip / n).toFixed(4), dark: +(dark / n).toFixed(4), rgb: [r0 / n, g0 / n, b0 / n].map(v => +v.toFixed(3)) };
  };
  // readPixels rows start at the bottom: the sky band is the top third of the picture
  const res = { sky: band(Math.floor(H * 0.66), H), land: band(0, Math.floor(H * 0.34)), all: band(0, H) };
  if (R.expOK) {
    const eb = new Float32Array(4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, R.expFB[R.expCur]); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.FLOAT, eb); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    res.exp = [eb[0], eb[1], eb[2]].map(v => +v.toFixed(4));
  }
  res.envExposure = +g.env.E.exposure.toFixed(4);
  if (body) {
    const d = g.env.E.bodies.giant, rad = g.env.E.bodies.radius.giant, VP = R.viewProj;
    const proj = (x, y, z) => { const cx = VP[0] * x + VP[4] * y + VP[8] * z, cy = VP[1] * x + VP[5] * y + VP[9] * z, cw = VP[3] * x + VP[7] * y + VP[11] * z; return [(cx / cw * 0.5 + 0.5) * W, (cy / cw * 0.5 + 0.5) * H, cw]; };
    const c0 = proj(d[0], d[1], d[2]);
    let t = [-d[2], 0, d[0]]; const tl = Math.hypot(t[0], t[1], t[2]) || 1; t = [t[0] / tl, t[1] / tl, t[2] / tl];
    const p1 = [d[0] * Math.cos(rad) + t[0] * Math.sin(rad), d[1] * Math.cos(rad) + t[1] * Math.sin(rad), d[2] * Math.cos(rad) + t[2] * Math.sin(rad)];
    const c1 = proj(p1[0], p1[1], p1[2]);
    const rp = Math.hypot(c1[0] - c0[0], c1[1] - c0[1]);
    res.body = { cx: +c0[0].toFixed(1), cy: +c0[1].toFixed(1), rPx: +rp.toFixed(1) };
    if (c0[2] > 0 && rp > 4) {
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

const all = {};
try {
  for (let b = 0; b < DISTS.length; b++) {
    const dist = DISTS[b], tag = TAGS[b] || 'b' + b;
    await page.goto('file://' + dist + '/index.html');
    for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
    await ev(() => { const g = VR.game; g.settings.renderDist = 7; g.settings.dynRes = false; g.applySettings('renderDist'); });
    await ev(`VR.game.createWorld({name:'Look',mode:'survival',difficulty:'normal',type:'default',seed:'424242',cheats:true,kit:true})`);
    for (let i = 0; i < 60; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
    await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.renderDist = 7; g.settings.dynRes = false; g.applySettings('renderDist'); });
    await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.env.setTime(6000); });
    if (process.env.HUD === '0') await ev(() => { const g = VR.game; g.hideHud = true; const hd = document.getElementById('hud'); if (hd) hd.style.display = 'none'; });
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
    console.log(`${tag}: open sky at y ${up}`);
    await loops(360);
    // the world loaded around the view (a loaded machine streams slowly: an unsettled view shows the far tiles near by)
    const settle = async (max) => {
      for (let i = 0; i < max; i++) {
        await loops(10);
        const st = await ev(() => { const g = VR.game; let dirty = 0; for (const c of g.world.cols.values()) for (const sc of c.sec) if (sc.dirty || sc.pending) dirty++; return { busy: g.pool.busy, pend: g.world.pending.size, dirty }; });
        if (st.busy === 0 && st.pend === 0 && st.dirty === 0 && i > 3) return i;
        await wait(80);
      }
      return max;
    };
    console.log(`${tag}: settled after ${await settle(150)} rounds`);
    const out = all[tag] = {};
    const VARS = !VTAGS || VTAGS.includes(tag) ? VARIANTS : [{ name: 'base', code: '' }];
    for (const kind of SCENES) {
      await ev((w) => VR.game.chat('/wetter ' + w), WORD[kind]);
      await loops(720);
      await settle(40);
      for (const v of VARS) {
        if (v.code) await ev('try { ' + v.code + ' } catch (e) { console.warn(e.message) }');
        const m = await ev(PROBE, { body: false });
        out[v.name + ':' + kind] = m;
        console.log(JSON.stringify({ tag, v: v.name, scene: kind, exp: m.exp, sky: m.sky, land: m.land, all: m.all }));
        await wait(150);
        await page.screenshot({ path: `${SHOTS}/${tag}_${v.name}_${kind}.png`, timeout: 180000 });
      }
      if (kind === 'klar' && process.env.BODY !== '0') {
        // the gas giant in the middle of the picture: its disc against the sky and the ring around it
        const keep = await ev(() => { const pl = VR.game.player, d = VR.game.env.E.bodies.giant; const k = [pl.yaw, pl.pitch]; pl.pitch = Math.asin(d[1]); pl.yaw = Math.atan2(-d[0], -d[2]); return k; });
        await loops(4);
        for (const v of VARS) {
          if (v.code) await ev('try { ' + v.code + ' } catch (e) { console.warn(e.message) }');
          const m = await ev(PROBE, { body: true });
          out[v.name + ':body'] = m;
          console.log(JSON.stringify({ tag, v: v.name, scene: 'body', body: m.body, sky: m.sky, exp: m.exp }));
          await wait(150);
          await page.screenshot({ path: `${SHOTS}/${tag}_${v.name}_body.png`, timeout: 180000 });
        }
        await ev((k) => { const pl = VR.game.player; pl.yaw = k[0]; pl.pitch = k[1]; }, keep);
        await loops(4);
      }
    }
  }
  fs.mkdirSync(HERE + '.tmp_tests', { recursive: true });
  fs.writeFileSync(HERE + '.tmp_tests/f1_look_' + TAGS.slice(0, DISTS.length).join('_') + '.json', JSON.stringify(all, null, 1));
} catch (e) {
  console.log('FAIL ' + (e.stack || e.message).slice(0, 800));
} finally {
  await browser.close();
}
const errs = logs.filter(l => l.startsWith('[pageerror]') || l.startsWith('[error]'));
console.log('errors: ' + errs.length + (errs.length ? '\n' + errs.slice(0, 6).join('\n') : ''));
console.log('done');
