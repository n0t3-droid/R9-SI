// Bildwarp in the browser (src/main/warp.js):
//   1 the warp of a turn matches the real frame at the new look: |warp − real| far below |old − real|
//   2 in the running game on a slow software GPU (Very Low here: whole frames > 45 ms) warp frames are drawn and the
//     displayed frame rate rises; no page errors
//   3 switched off: no warp frames
// usage: nohup bash test/wt_run.sh warp.mjs 1200 > .tmp_tests/warp.log 2>&1 &
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import sharp from '/home/dev/.npm-global/lib/node_modules/sharp/lib/index.js';
import fs from 'fs';
const ROOT = new URL('../', import.meta.url).pathname, SHOTS = ROOT + 'test/shots/';
fs.mkdirSync(SHOTS, { recursive: true });
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
const logs = []; page.on('pageerror', e => logs.push(e.message));
await page.goto('file://' + ROOT + 'dist/index.html');
const ev = (f, a) => page.evaluate(f, a), wait = (ms) => page.waitForTimeout(ms);
for (let i = 0; i < 240; i++) { await wait(500); if (await ev(() => !!(window.VR && VR.game && VR.game.state === 'title'))) break; }
await ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.renderDist = 3; g.settings.dynRes = false; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Warp',mode:'creative',difficulty:'peaceful',type:'default',seed:'4242',cheats:true})`);
for (let i = 0; i < 300; i++) { await wait(500); if (await ev(() => VR.game.state === 'play')) break; }
await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.zenFreezeWeather = true; g.hideHud = false; });   // (warp.js: no warps under a hidden HUD)
await wait(15000);
// 1 the mapping: a whole frame at yaw0 (kept for warps), a warp to yaw0 + d, the real whole frame at yaw0 + d
const r1 = await ev(() => {
  const g = VR.game, r = g.renderer, p = g.player;
  window.__raf = window.__raf || window.requestAnimationFrame.bind(window); window.requestAnimationFrame = () => 0;
  const read = () => { const gl = r.gl, w = r.W, h = r.H, b = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, b); return b; };
  const frame = (ms) => { r.warpPrevFull = undefined; r.warpFullMs = ms; g.last = performance.now() - 33; g.loop(performance.now()); };
  g.settings.warp = true; p.pitch = -0.12;
  const y0 = p.yaw;
  for (let i = 0; i < 8; i++) frame(0);
  r.warpSt = VR.Warp.state(); frame(40);            // a whole frame, kept for a warp
  const w0 = VR.Warp.stats.warps, old = read();
  p.yaw = y0 + 0.05; p.viewYaw = p.yaw;
  frame(40);                                       // → a warp
  const warped = read(), didWarp = VR.Warp.stats.warps === w0 + 1;
  for (let i = 0; i < 8; i++) frame(0);            // the real frames at the new look
  const real = read();
  const d = (A, B) => { let s = 0, n = 0; for (let i = 0; i < A.length; i += 4) { s += Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]); n += 3; } return s / n; };
  const png = (b) => { const c = document.createElement('canvas'); c.width = r.W; c.height = r.H; const x = c.getContext('2d'), im = x.createImageData(r.W, r.H); for (let y = 0; y < r.H; y++) im.data.set(b.subarray((r.H - 1 - y) * r.W * 4, (r.H - y) * r.W * 4), y * r.W * 4); x.putImageData(im, 0, 0); return c.toDataURL('image/png'); };
  return { didWarp, dWarp: d(warped, real), dOld: d(old, real), shots: [png(old), png(warped), png(real)] };
});
console.log('     |warp − real| ' + r1.dWarp.toFixed(2) + '   |old − real| ' + r1.dOld.toFixed(2));
check(r1.didWarp, '1 the frame after the turn was a warp');
check(r1.dWarp < r1.dOld * 0.5, '1 the warp matches the new look (' + r1.dWarp.toFixed(2) + ' vs ' + r1.dOld.toFixed(2) + ')');
{
  const TW = 320, TH = 180, LAB = 24, comp = [];
  const label = (t) => Buffer.from(`<svg width="${TW}" height="${LAB}"><rect width="100%" height="100%" fill="#141820"/><text x="6" y="17" font-family="DejaVu Sans" font-size="13" fill="#f0e6d0">${t}</text></svg>`);
  const names = ['Altes Bild', 'Bildwarp (≈1 ms)', 'Echtes neues Bild'];
  for (let i = 0; i < 3; i++) comp.push({ input: label(names[i]), left: i * TW, top: 0 }, { input: await sharp(Buffer.from(r1.shots[i].split(',')[1], 'base64')).resize(TW, TH).toBuffer(), left: i * TW, top: LAB });
  await sharp({ create: { width: TW * 3, height: TH + LAB, channels: 3, background: '#141820' } }).composite(comp).jpeg({ quality: 88 }).toFile(SHOTS + 'bildwarp.jpg');
  console.log('sheet test/shots/bildwarp.jpg');
}
// 1b a step: 0.4 blocks forward and a small turn — with the depth's correction closer to the real frame than without
const r2 = await ev(() => {
  const g = VR.game, r = g.renderer, p = g.player;
  const read = () => { const gl = r.gl, w = r.W, h = r.H, b = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, b); return b; };
  const frame = (ms) => { r.warpPrevFull = undefined; r.warpFullMs = ms; g.last = performance.now() - 33; g.loop(performance.now()); };
  const d = (A, B) => { let s = 0, n = 0; for (let i = 0; i < A.length; i += 4) { s += Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]); n += 3; } return s / n; };
  p.flying = true; p.noclip = true; p.vel[0] = p.vel[1] = p.vel[2] = 0;
  const x0 = p.pos[0], z0 = p.pos[2], y0 = p.yaw;
  const go = (k) => { p.pos[0] = x0 - Math.sin(y0) * 0.4 * k; p.pos[2] = z0 - Math.cos(y0) * 0.4 * k; p.yaw = p.viewYaw = y0 + 0.02 * k; p.vel[0] = p.vel[1] = p.vel[2] = 0; };
  const res = {};
  for (const stepOn of [false, true]) {
    VR.Warp.stepOn = stepOn; go(0);
    for (let i = 0; i < 8; i++) frame(0);
    r.warpSt = VR.Warp.state(); frame(40);
    go(1); frame(40);
    const warped = read();
    for (let i = 0; i < 8; i++) { go(1); frame(0); }
    res[stepOn ? 'on' : 'off'] = d(warped, read());
  }
  VR.Warp.stepOn = true; go(0);
  return res;
});
console.log('     step: |warp − real| with the depth ' + r2.on.toFixed(2) + ', turn only ' + r2.off.toFixed(2));
check(r2.on < r2.off, '1b a step: the depth\'s correction is closer to the real frame (' + r2.on.toFixed(2) + ' < ' + r2.off.toFixed(2) + ')');
// 2 / 3 the running game: natural frames for a few seconds, warp on, then off
const runFor = (on, ms) => ev(async ([on, ms]) => {
  const g = VR.game, r = g.renderer; g.settings.warp = on; r.warpFullMs = undefined; r.warpSt = VR.Warp.state();
  const w0 = VR.Warp.stats.warps, wh0 = VR.Warp.stats.whole, f0 = g.frame;
  if (window.__raf && window.requestAnimationFrame !== window.__raf) { window.requestAnimationFrame = window.__raf; window.__raf((t) => g.loop(t)); }
  const t0 = performance.now(); await new Promise(res => setTimeout(res, ms)); const t = performance.now() - t0;
  return { warps: VR.Warp.stats.warps - w0, whole: VR.Warp.stats.whole - wh0, fps: (g.frame - f0) / t * 1000, fullMs: r.warpFullMs };
}, [on, ms]);
const on = await runFor(true, 12000); console.log('     an  ' + JSON.stringify(on));
const off = await runFor(false, 8000); console.log('     aus ' + JSON.stringify(off));
check(on.fullMs > 22 ? on.warps > 0 : true, '2 slow whole frames (' + (on.fullMs || 0).toFixed(0) + ' ms): warp frames drawn (' + on.warps + ' warps, ' + on.whole + ' whole)');
check(on.fullMs > 22 ? on.fps > off.fps * 1.2 : true, '2 the displayed rate rises (' + on.fps.toFixed(1) + ' vs ' + off.fps.toFixed(1) + ' fps)');
check(off.warps === 0, '3 off: no warps');
check(!logs.length, 'no page errors ' + logs.slice(0, 2).join(' | '));
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
