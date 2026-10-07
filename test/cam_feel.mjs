// v0.33.1 camera feel in the Studio Crafter: the wheel zooms to the block under the pointer (it stays under the pointer
// and becomes the new centre), dragging turns 1:1 with the Maus-Tempo setting, Shift-drag pans so the ground follows the
// pointer, a double-click flies to the clicked spot, arrows turn the view, a click that wobbles a few pixels still clicks.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const logs = [];
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 600)));
await page.goto('file:///home/claude/vr/dist/studio.html');
const ev = (fn, arg) => page.evaluate(fn, arg), wait = (ms) => page.waitForTimeout(ms);
let fails = 0; const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
for (let i = 0; i < 240; i++) { await wait(500); const s = await ev(() => ({ boot: document.getElementById('studio').classList.contains('boot'), houses: window.__studio ? window.__studio.HOUSE.size : -1 })); if (!s.boot && s.houses >= 2) break; }
await ev(() => window.__studio.selectHouse(0)); await wait(400);
await ev(() => window.__studioCore.setMode('craft'));
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => !!(VR.Crafter.house && VR.Crafter.gpu))) break; }
await wait(1200);
const box = await (await page.$('#view')).boundingBox(), cx = box.x + box.width / 2, cy = box.y + box.height / 2;
const cam = () => ev(() => { const S = window.__st; return { yaw: S.cam.yaw, pitch: S.cam.pitch, dist: S.cam.dist, c: S.scene.center.slice() }; });
// zoom to the pointer: point at the left third, wheel in
const px = box.x + box.width * 0.3, py = cy;
await page.mouse.move(px, py); await wait(300);
const target = await ev(([x, y]) => { const e = { clientX: x, clientY: y }; return VR.Crafter && window.__studioCore.HOOK.pickPoint(e); }, [px, py]);
const c0 = await cam();
for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, -120); await wait(80); }
await wait(600);
const c1 = await cam();
const before = Math.hypot(c0.c[0] - target[0], c0.c[2] - target[2]), after = Math.hypot(c1.c[0] - target[0], c1.c[2] - target[2]);
console.log('   zoom: dist', (c0.dist || 0).toFixed(1), '→', c1.dist.toFixed(1), '· centre to the pointed block', before.toFixed(1), '→', after.toFixed(1));
check(c1.dist < (c0.dist || 99) * 0.8 && after < before * 0.8, 'the wheel zooms toward the block under the pointer');
const still = await ev(([x, y]) => window.__studioCore.HOOK.pickPoint({ clientX: x, clientY: y }), [px, py]);
check(still && Math.hypot(still[0] - target[0], still[1] - target[1], still[2] - target[2]) < 1.6, 'that block is still under the pointer');
// drag turns 1:1 with Maus-Tempo
const y0 = (await cam()).yaw;
await page.mouse.move(cx, cy); await page.mouse.down({ button: 'right' }); await page.mouse.move(cx + 40, cy, { steps: 4 }); await page.mouse.move(cx + 100, cy, { steps: 6 }); await page.mouse.up({ button: 'right' }); await wait(200);
const y1 = (await cam()).yaw, sens = await ev(() => window.__st.sens);
console.log('   drag 100 px → yaw', (y1 - y0).toFixed(3), '(sens ' + sens + ')');
check(Math.abs((y1 - y0) - 100 * 0.0065 * sens) < 0.08, 'dragging turns the view evenly');
const placed = await ev(() => { const h = VR.Crafter.house; let n = 0; for (let i = 0; i < h.blocks.length; i++) if (h.blocks[i] !== h.base[i]) n++; return n; });
check(placed === 0, 'a right-drag places nothing');
// pan: shift-drag moves the centre
const p0 = (await cam()).c;
await page.keyboard.down('Shift'); await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 80, cy + 30, { steps: 6 }); await page.mouse.up(); await page.keyboard.up('Shift'); await wait(200);
const p1 = (await cam()).c;
check(Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]) > 0.5, 'Shift-drag pans');
// arrows turn
const a0 = (await cam()).yaw; await page.keyboard.press('ArrowRight'); await wait(100); const a1 = (await cam()).yaw;
check(Math.abs(a1 - a0) > 0.05, 'the arrow keys turn the view');
// Maus-Tempo
await page.click('#sensT'); await wait(100);
const s2 = await ev(() => window.__st.sens);
check(s2 > sens, 'the mouse speed button makes it faster (' + sens + ' → ' + s2 + ')');
await page.click('#sensT', { button: 'right' }); await wait(100);
check(await ev(() => window.__st.sens) === sens, 'right click makes it slower again');
// a wobbly click (5 px) still places
await ev(() => { VR.Crafter.hot[VR.Crafter.slot] = 'vollton_coral'; });
await page.mouse.move(cx, cy + 80); await wait(300);
const nb = await ev(() => { const h = VR.Crafter.house; let n = 0; for (let i = 0; i < h.blocks.length; i++) if (h.blocks[i] !== h.base[i]) n++; return n; });
await page.mouse.down({ button: 'right' }); await page.mouse.move(cx + 4, cy + 83); await page.mouse.up({ button: 'right' }); await wait(700);
const na = await ev(() => { const h = VR.Crafter.house; let n = 0; for (let i = 0; i < h.blocks.length; i++) if (h.blocks[i] !== h.base[i]) n++; return n; });
check(na > nb, 'a click that wobbles 5 px still places a block');
// Architektur view: a double-click flies the centre to the clicked spot
await ev(() => window.__studioCore.setMode('arch')); await wait(1500);
await page.mouse.move(cx, cy); await wait(200);
const before2 = (await cam()).c;
await page.mouse.dblclick(box.x + box.width * 0.62, cy + 40); await wait(800);
const after2 = (await cam()).c;
check(Math.hypot(after2[0] - before2[0], after2[1] - before2[1], after2[2] - before2[2]) > 0.5, 'Architektur: double-click flies to the clicked spot');
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 5)) console.log(l);
check(!logs.some(l => /pageerror\]/.test(l)), 'no page errors');
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
