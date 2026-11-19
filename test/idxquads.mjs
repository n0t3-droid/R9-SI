// Viereck-Index in the browser: the same view drawn from triangle lists and from indexed quads must be the same picture
//   1 the sections arrive as quads (meshes flagged q) and draw through the shared index buffer
//   2 the picture with quads equals the picture with triangle lists (mean |Δ| under 1 of 255; the spread of two
//     triangle pictures is the yardstick), the triangle count is the same
//   3 the meshes' vertices: a third fewer with quads (4 a quad instead of 6)
//   4 no page errors
// usage: nohup bash test/wt_run.sh idxquads.mjs 1500 > .tmp_tests/idxquads.log 2>&1 &
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const ROOT = new URL('../', import.meta.url).pathname;
fs.mkdirSync(ROOT + 'test/shots/', { recursive: true });
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
const logs = []; page.on('pageerror', e => logs.push(e.message)); page.on('console', m => { if (m.type() === 'error') logs.push(m.text().slice(0, 300)); });
await page.goto('file://' + ROOT + 'dist/index.html');
const ev = (f, a) => page.evaluate(f, a), wait = (ms) => page.waitForTimeout(ms);
for (let i = 0; i < 240; i++) { await wait(500); if (await ev(() => !!(window.VR && VR.game && VR.game.state === 'title'))) break; }
await ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.dynRes = false; g.settings.warp = false; g.settings.tsr = false; g.settings.renderDist = 3; g.settings.horizon = 0;   // (no far land: its cut follows the streaming, not the meshes)
  g.settings.fadeIn = false; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'IQ',mode:'creative',difficulty:'peaceful',type:'default',seed:'4242',cheats:true})`);
for (let i = 0; i < 300; i++) { await wait(500); if (await ev(() => VR.game.state === 'play')) break; }
await ev(() => { const g = VR.game, p = g.player; window.requestAnimationFrame = () => 0; g.hideHud = true; g.zenFreezeTime = true; g.zenFreezeWeather = true; if (g.env.wx && g.env.wx.force) g.env.wx.force('klar'); p.flying = true; p.noclip = true; p.teleport(400, 120, 400); p.yaw = p.viewYaw = 2.3; p.pitch = -0.5; });
const frames = (n) => ev((n) => { const g = VR.game; for (let i = 0; i < n; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } }, n);
// settle: every section meshed and up
const settle = async () => { for (let i = 0; i < 60; i++) { await frames(2); await wait(300); const q = await ev(() => { const g = VR.game, w = g.world; let dirty = 0; for (const c of w.cols.values()) for (const s of c.sec) if (s.dirty || s.pending) dirty++; return dirty + (g.pool.busy | 0) + (w.uploadQ && w.uploadQ.length | 0); }); if (!q && i > 8) break; } await frames(8); };
const info = () => ev(() => { const r = VR.game.renderer, w = VR.game.world; let q = 0, t = 0, vq = 0, vt = 0; for (const c of w.cols.values()) for (const s of c.sec) for (const m of s.mesh) if (m) { if (m.q) { q++; vq += m.count; } else { t++; vt += m.count; } } return { q, t, vq, vt, tris: r.stats.tris, idx: r.idx }; });
const grab = () => ev(() => { const g = VR.game, r = g.renderer, gl = r.gl; for (let i = 0; i < 3; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } const b = new Uint8Array(r.W * r.H * 4); gl.readPixels(0, 0, r.W, r.H, gl.RGBA, gl.UNSIGNED_BYTE, b); return { b: Array.from(b), W: r.W, H: r.H }; });
await settle();
const iq = await info(); const pq = await grab();
console.log('     quads: ' + JSON.stringify(iq));
check(iq.idx && iq.q > 20 && iq.t === 0, '1 the sections are quads (' + iq.q + ' meshes), drawn indexed');
// the same world as triangle lists
await ev(() => { const g = VR.game; g.renderer.idx = false; g.remeshAll(); });
await settle();
const it = await info(); const pt = await grab(); const pt2 = await grab();
console.log('     triangles: ' + JSON.stringify(it));
const diff = (a, b) => { let d = 0; for (let i = 0; i < a.b.length; i += 4) for (let c = 0; c < 3; c++) d += Math.abs(a.b[i + c] - b.b[i + c]); return d / (a.b.length * 0.75); };
const d = diff(pq, pt), d0 = diff(pt, pt2);
let lum = 0; for (let i = 0; i < pq.b.length; i += 4) lum += pq.b[i + 1]; lum /= pq.b.length / 4;
console.log('     |quads − triangles| ' + d.toFixed(3) + ' · |triangles − triangles| ' + d0.toFixed(3) + ' · tris ' + iq.tris + ' / ' + it.tris);
check(d < 1 && Math.abs(iq.tris - it.tris) <= it.tris * 0.02, '2 the same picture and triangle count');
check(it.t > 20 && iq.vq > 0 && Math.abs(iq.vq / it.vt - 4 / 6) < 0.02, '3 a third fewer vertices (' + iq.vq + ' vs ' + it.vt + ')');
{ const sharp = (await import('/home/dev/.npm-global/lib/node_modules/sharp/lib/index.js')).default; const W = pq.W, H = pq.H; const flip = (arr) => { const o = Buffer.alloc(arr.length); for (let y = 0; y < H; y++) for (let x = 0; x < W * 4; x++) o[y * W * 4 + x] = arr[(H - 1 - y) * W * 4 + x]; return o; }; await sharp(flip(pq.b), { raw: { width: W, height: H, channels: 4 } }).png().toFile(ROOT + 'test/shots/idx_quads.png'); await sharp(flip(pt.b), { raw: { width: W, height: H, channels: 4 } }).png().toFile(ROOT + 'test/shots/idx_tris.png'); }
check(!logs.length, '4 no page errors ' + logs.slice(0, 2).join(' | '));
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0);
