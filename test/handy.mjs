// Handy-Steuerung 2 on an emulated phone (iPhone 13, touch): the gestures and the floating stick really play
//   1 a tap on the picture places a block where the finger is (not at the crosshair)
//   2 a finger held still breaks a block (creative: at once)
//   3 the floating stick: a thumb landing in the left zone walks the player forward; at the rim it sprints
//   4 a tap on a hotbar slot picks it; the ☰ button opens the pause menu; no page errors
// usage: nohup bash test/wt_run.sh handy.mjs 1200 > .tmp_tests/handy.log 2>&1 &
import { chromium, devices } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
const ROOT = new URL('../', import.meta.url).pathname;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1, locale: 'de-DE' });
const page = await ctx.newPage();
const logs = []; page.on('pageerror', e => logs.push(e.message));
await page.goto('file://' + ROOT + 'dist/index.html');
const ev = (f, a) => page.evaluate(f, a), wait = (ms) => page.waitForTimeout(ms);
for (let i = 0; i < 240; i++) { await wait(500); if (await ev(() => !!(window.VR && VR.game && VR.game.state === 'title'))) break; }
await ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.warp = false; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Handy',mode:'creative',difficulty:'peaceful',type:'flat',seed:'7',cheats:true})`);
for (let i = 0; i < 300; i++) { await wait(500); if (await ev(() => VR.game.state === 'play')) break; }
await wait(3000);
check(await ev(() => document.getElementById('ui').classList.contains('touchon') && document.getElementById('touch').classList.contains('gesten')), 'the touch layer in Gesten style');
const cdp = await ctx.newCDPSession(page);
const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
const vp = page.viewportSize();
// look down at the flat ground in front
await ev(() => { const p = VR.game.player; p.flying = false; p.pitch = -0.9; p.viewYaw = p.yaw; p.vel[0] = p.vel[1] = p.vel[2] = 0; });
await wait(800);
const count = () => ev(() => { const g = VR.game, w = g.world, p = g.player; let n = 0; const X = Math.floor(p.pos[0]), Y = Math.floor(p.pos[1]), Z = Math.floor(p.pos[2]); for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++) for (let dy = -3; dy <= 3; dy++) if (w.getBlock(X + dx, Y + dy, Z + dz)) n++; return n; });
const n0 = await count();
// 1 a tap right of the middle (not on any button: x 62 %, y 45 %)
const tx = Math.round(vp.width * 0.62), ty = Math.round(vp.height * 0.5);
// (the software GPU's frames are slow: a touchend comes in a frame late — the tap's hold time is widened for this check only)
await ev(() => { VR.Touch.HOLD_MS = 3000; });
await touch('touchStart', tx, ty); await wait(80); await touch('touchEnd', tx, ty); await wait(1200);
await ev(() => { VR.Touch.HOLD_MS = 260; });
const n1 = await count();
check(n1 === n0 + 1, `1 a tap placed one block (${n0} → ${n1})`);
// 2 hold still for 700 ms: breaks
await touch('touchStart', tx, ty); await wait(700); await touch('touchEnd', tx, ty); await wait(700);
const n2 = await count();
check(n2 < n1, `2 a held finger broke a block (${n1} → ${n2})`);
// 3 the floating stick: a thumb at 20 % / 70 %, pushed up 40 px (walk), then 70 px (the rim: sprint)
const p0 = await ev(() => VR.game.player.pos.slice());
const sx = Math.round(vp.width * 0.2), sy = Math.round(vp.height * 0.68);
await page.mouse.move(sx, sy);
await ev(([sx, sy]) => { const z = document.getElementById('tZone'); const o = { pointerId: 7, pointerType: 'touch', clientX: sx, clientY: sy, bubbles: true }; z.dispatchEvent(new PointerEvent('pointerdown', o)); }, [sx, sy]);
await ev(([sx, sy]) => { const z = document.getElementById('tZone'); z.dispatchEvent(new PointerEvent('pointermove', { pointerId: 7, pointerType: 'touch', clientX: sx, clientY: sy - 40, bubbles: true })); }, [sx, sy]);
await wait(300);
await wait(1200);
const p1 = await ev(() => VR.game.player.pos.slice());
const walked = Math.hypot(p1[0] - p0[0], p1[2] - p0[2]);
await ev(([sx, sy]) => { const z = document.getElementById('tZone'); z.dispatchEvent(new PointerEvent('pointermove', { pointerId: 7, pointerType: 'touch', clientX: sx, clientY: sy - 80, bubbles: true })); }, [sx, sy]);
await wait(1200);
const sprintD = await ev(() => ({ cls: document.getElementById('tStick').className })); const sprint = sprintD.cls.includes('sprint') && await ev(() => VR.game.player.sprinting);
await ev(([sx, sy]) => { const z = document.getElementById('tZone'); z.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, pointerType: 'touch', clientX: sx, clientY: sy - 80, bubbles: true })); }, [sx, sy]);
check(walked > 1, `3 the floating stick walked the player (${walked.toFixed(1)} blocks in 1.5 s)`);
check(sprint, '3 pushed to the rim it sprints');
// 4 hotbar slot 4, then the menu
const sl = await ev(() => { const s = document.querySelectorAll('#hotbar .slot')[3].getBoundingClientRect(); return [s.left + s.width / 2, s.top + s.height / 2]; });
await page.touchscreen.tap(sl[0], sl[1]); await wait(300);
check(await ev(() => VR.game.player.inv.sel === 3), '4 a tap on slot 4 picks it');
const mb = await ev(() => { const r = document.getElementById('tMenu').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
await page.touchscreen.tap(mb[0], mb[1]); await wait(500);
check(await ev(() => VR.game.ui.screen === 'pause'), '4 ☰ opens the pause menu');
check(!logs.length, 'no page errors ' + logs.slice(0, 2).join(' | '));
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0);
