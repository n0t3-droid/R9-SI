// Ferne schlicht in the browser: a long view (10 chunks), the far columns meshed plainly
//   (the test runs a 5-chunk view with D 2; the game uses World.farD: 5 … 12 from 10 chunks)
//   1 the columns beyond D are plain (c.lod 1), the near ones full detail
//   2 the plain view has clearly fewer vertices than the same view with the switch off (≥ 15 % of all)
//   3 turning it off brings every column back to full detail (a few at a time, no flicker)
//   4 pictures test/shots/farmesh_on.png / _off.png (look at the band for holes) · no page errors
// usage: nohup bash test/wt_run.sh farmesh.mjs 1500 > .tmp_tests/farmesh.log 2>&1 &
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const ROOT = new URL('../', import.meta.url).pathname;
fs.mkdirSync(ROOT + 'test/shots/', { recursive: true });
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
const logs = []; page.on('pageerror', e => logs.push(e.message));
await page.goto('file://' + ROOT + 'dist/index.html');
const ev = (f, a) => page.evaluate(f, a), wait = (ms) => page.waitForTimeout(ms);
for (let i = 0; i < 240; i++) { await wait(500); if (await ev(() => !!(window.VR && VR.game && VR.game.state === 'title'))) break; }
await ev(() => { const g = VR.game; g.applyPreset('potato'); VR.World.farD0 = VR.World.farD; VR.World.farD = (rd) => (rd >= 5 ? 2 : 0);   // (the test's small view: D 2 — a software GPU meshes 10 chunks too slowly)
  Object.assign(g.settings, { dynRes: false, warp: false, tsr: false, renderDist: 5, horizon: 0, fadeIn: false, farPlain: true, smoothPlants: 0, smoothFurn: 0 }); g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'FM',mode:'creative',difficulty:'peaceful',type:'default',seed:'4242',cheats:true})`);
for (let i = 0; i < 300; i++) { await wait(500); if (await ev(() => VR.game.state === 'play')) break; }
await ev(() => { const g = VR.game, p = g.player; window.requestAnimationFrame = () => 0; g.hideHud = true; g.zenFreezeTime = true; g.zenFreezeWeather = true; if (g.env.wx && g.env.wx.force) g.env.wx.force('klar'); p.flying = true; p.noclip = true; p.teleport(400, 130, 400); p.yaw = p.viewYaw = 2.3; p.pitch = -0.3; g.world.smooth = true; g.world.fancyLeaves = 2 | 4; g.remeshAll(); });
const frames = (n) => ev((n) => { const g = VR.game; for (let i = 0; i < n; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } }, n);
const info = () => ev(() => { const w = VR.game.world, D = VR.World.farD(w.renderDist), p = w.center; let v = 0, far = 0, near = 0, wrong = 0; for (const c of w.cols.values()) { const d = Math.hypot(c.cx - p[0], c.cz - p[1]); if (c.lod === 1) far++; else near++; if (c.lod !== undefined && w.farMesh && ((d > D + 1 && c.lod !== 1) || (d < D && c.lod === 1))) wrong++; for (const s of c.sec) for (const m of s.mesh) if (m) v += m.count; } return { v, far, near, wrong, D, swaps: w.farSwaps | 0 }; });
const settle = async (max, ok = () => true) => { let quiet = 0, lastV = -1; for (let i = 0; i < max; i++) { await frames(2); await wait(300); const n = await info(), busy = await ev(() => VR.game.pool.busy | 0); if (i % 40 === 0) console.log('     … ' + i + ' ' + JSON.stringify(n)); quiet = (n.v === lastV && !busy && !n.wrong && ok(n)) ? quiet + 1 : 0; lastV = n.v; if (quiet >= 6) return i; } return -1; };
const grab = async (name) => { const url = await ev(() => { const g = VR.game; g.last = performance.now() - 33; g.loop(performance.now()); return g.renderer.gl.canvas.toDataURL('image/png'); }); fs.writeFileSync(ROOT + 'test/shots/farmesh_' + name + '.png', Buffer.from(url.split(',')[1], 'base64')); };
console.log('     settle ' + await settle(400));
const on = await info(); await grab('on'); console.log('     on ' + JSON.stringify(on));
check(on.D === 2 && on.far > 20 && on.near > 8 && on.wrong === 0, '1 far columns plain, near ones full (' + on.far + ' / ' + on.near + ')');
await ev(() => { const g = VR.game; g.settings.farPlain = false; g.applySettings('farPlain'); });
console.log('     settle ' + await settle(500, (n) => n.far === 0));
const off = await info(); await grab('off'); console.log('     off ' + JSON.stringify(off));
check(off.far === 0, '3 switched off: every column full detail again');
check(on.v <= off.v * 0.85, '2 vertices ' + on.v + ' vs ' + off.v + ' (−' + Math.round(100 - 100 * on.v / off.v) + ' %)');
check(!logs.length, '4 no page errors ' + logs.slice(0, 2).join(' | '));
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0);
