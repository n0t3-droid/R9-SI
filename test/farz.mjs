// Ferne mit Tiefenvorlauf (horizon.js Horizon.ZPRE): the far land drawn depth first, colour with depth EQUAL
//   1 the far land is drawn with the depth pass (the picture's difference is reported: near stand-in tiles differ — off by default)
// regress: skip (an experiment; the knob is off by default)
//   2 both programs compile and link, no page errors
// usage: nohup bash test/wt_run.sh farz.mjs 1200 > .tmp_tests/farz.log 2>&1 &
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const ROOT = new URL('../', import.meta.url).pathname;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
const logs = []; page.on('pageerror', e => logs.push(e.message)); page.on('console', m => { if (m.type() === 'error') logs.push(m.text().slice(0, 300)); });
await page.goto('file://' + ROOT + 'dist/index.html');
const ev = (f, a) => page.evaluate(f, a), wait = (ms) => page.waitForTimeout(ms);
for (let i = 0; i < 240; i++) { await wait(500); if (await ev(() => !!(window.VR && VR.game && VR.game.state === 'title'))) break; }
await ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.dynRes = false; g.settings.warp = false; g.settings.renderDist = 3; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'FZ',mode:'creative',difficulty:'peaceful',type:'default',seed:'4242',cheats:true})`);
for (let i = 0; i < 300; i++) { await wait(500); if (await ev(() => VR.game.state === 'play')) break; }
await ev(() => { const g = VR.game, p = g.player; window.requestAnimationFrame = () => 0; g.hideHud = true; g.zenFreezeTime = true; g.zenFreezeWeather = true; p.flying = true; p.noclip = true; p.teleport(40, 130, 40); p.yaw = p.viewYaw = 2.3; p.pitch = -0.18; });
const frames = (n) => ev((n) => { const g = VR.game; for (let i = 0; i < n; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } return VR.game.horizon ? VR.game.horizon.stats : null; }, n);
for (let i = 0; i < 60; i++) { await frames(3); await wait(400); }
const grab = (z) => ev((z) => { const g = VR.game, r = g.renderer, gl = r.gl; VR.Horizon.ZPRE = z; for (let i = 0; i < 4; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } const b = new Uint8Array(r.W * r.H * 4); gl.readPixels(0, 0, r.W, r.H, gl.RGBA, gl.UNSIGNED_BYTE, b); return { b: Array.from(b), lodZ: !!(r.P.lodZ && r.P.lodZ.p), lodEq: !!(r.P.lodEq && r.P.lodEq.p), drawn: g.horizon.stats.drawn }; }, z);
const a = await grab(false), b = await grab(true), a2 = await grab(false);
let d = 0, d0 = 0; for (let i = 0; i < a.b.length; i += 4) { for (let c = 0; c < 3; c++) { d += Math.abs(a.b[i + c] - b.b[i + c]); d0 += Math.abs(a.b[i + c] - a2.b[i + c]); } }
d /= a.b.length * 0.75; d0 /= a.b.length * 0.75;
{ const sharp = (await import('/home/dev/.npm-global/lib/node_modules/sharp/lib/index.js')).default; const W = 480 * 1, H = a.b.length / 4 / W; const flip = (arr) => { const o = Buffer.alloc(arr.length); for (let y = 0; y < H; y++) for (let x = 0; x < W * 4; x++) o[y * W * 4 + x] = arr[(H - 1 - y) * W * 4 + x]; return o; }; await sharp(flip(a.b), { raw: { width: W, height: H, channels: 4 } }).png().toFile(ROOT + 'test/shots/farz_off.png'); await sharp(flip(b.b), { raw: { width: W, height: H, channels: 4 } }).png().toFile(ROOT + 'test/shots/farz_on.png'); }
console.log('     far tiles drawn ' + b.drawn + ' · |off − on| ' + d.toFixed(2) + ' · |off − off| ' + d0.toFixed(2));
check(b.lodZ && b.lodEq, '2 both programs ready');
console.log('     (the picture differs by ' + d.toFixed(2) + ': near stand-in tiles — ZPRE stays off by default until this is understood; /kosten measures its cost on real GPUs)');
check(b.drawn > 5, '1 the far land is drawn with the depth pass');
check(!logs.length, 'no page errors ' + logs.slice(0, 2).join(' | '));
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0);
