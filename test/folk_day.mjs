import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || t === 'warning' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 700)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 20) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(20, n - k), dtms]); } };
const shot = async (name) => { await ev(() => { window.__norender = false; const g = VR.game; g.env.rain = 0; g.env.rainTarget = 0; g.last = performance.now() - 33; g.loop(performance.now()); g.renderer.gl.finish(); window.__norender = true; }); await wait(150); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 90000 }); console.log('shot', name); };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.settings.renderDist = 6; g.settings.dynRes = false; g.settings.minimap = false; g.applySettings('renderDist'); });
await ev(`VR.game.createWorld({name:'Folk',mode:'creative',difficulty:'peaceful',type:'default',seed:'${process.env.SEED || '777'}',cheats:true,kit:true})`);
for (let i = 0; i < 60; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.hideHud = true; document.getElementById('hud').style.visibility = 'hidden'; g.env.setTime(1500); });
for (let i = 0; i < 12; i++) { await step(20); await wait(200); }
const stats = () => ev(() => { const V = VR.game.villages; const acts = {}, poses = {}; let moving = 0; for (const a of V.agents) { const k = a.act ? a.act.type : 'none'; acts[k] = (acts[k] || 0) + 1; poses[a.pose] = (poses[a.pose] || 0) + 1; if (Math.hypot(a.vel[0], a.vel[2]) > 0.3) moving++; } return { tod: VR.game.env.timeOfDay | 0, acts, poses, moving, stats: [...V.known.values()].map(v => v.st.stats), proj: [...V.known.values()].map(v => v.st.proj) }; });
const t0 = Date.now();
await step(600);
console.log('600 frames ms', Date.now() - t0);
console.log(JSON.stringify(await stats()));
// close-up of a standing / working villager, seen from the front
const frontOf = async (name, filter) => {
  const a = await ev((filter) => { const V = VR.game.villages; const cand = V.agents.filter(a => (!filter || a.role === filter || (a.act && a.act.type === filter)) && a.pose !== 'sleep'); const a = cand[0]; if (!a) return null; return [a.pos[0], a.pos[1], a.pos[2], a.yaw, a.p.name, a.role, a.kid]; }, filter);
  if (!a) { console.log('none for', filter); return; }
  const d = a[6] ? 1.9 : 2.6;
  const cx = a[0] - Math.sin(a[3]) * d, cz = a[2] - Math.cos(a[3]) * d;
  await ev(([cx, cy, cz, tx, ty, tz]) => { const p = VR.game.player; p.teleport(cx, cy, cz); p.flying = true; const dx = tx - cx, dy = ty - cy - 1.6, dz = tz - cz; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); }, [cx, a[1] + (a[6] ? -0.6 : -0.1), cz, a[0], a[1] + (a[6] ? 0.7 : 1.2), a[2]]);
  await shot(name);
  console.log(name, a[4], a[5]);
};
await frontOf('folk_farmer', 'farmer');
await frontOf('folk_kid', 'child');
await frontOf('folk_baker', 'baker');
await frontOf('folk_mayor', 'mayor');
// lunch & evening
await ev(() => VR.game.env.setTime(5700)); await step(500); console.log(JSON.stringify(await stats()));
const pl = await ev(() => { const v = [...VR.game.villages.known.values()][0]; return v.plan.plaza; });
await ev((pz) => { const p = VR.game.player; p.teleport(pz.x + 9, pz.y + 5, pz.z + 9); p.flying = true; const dx = -9, dz = -9; p.yaw = Math.atan2(-dx, -dz); p.pitch = -0.4; }, pl);
await shot('folk_plaza_lunch');
await ev(() => VR.game.env.setTime(11000)); await step(500); console.log(JSON.stringify(await stats()));
await shot('folk_plaza_evening');
await ev(() => VR.game.env.setTime(13500)); await step(1500); console.log(JSON.stringify(await stats()));
await ev(() => VR.game.env.setTime(18000)); await step(300); console.log(JSON.stringify(await stats()));
const sl = await ev(() => { const a = VR.game.villages.agents.find(a => a.pose === 'sleep'); return a ? [a.pos[0], a.pos[1], a.pos[2], a.p.name] : null; });
if (sl) { await ev(([x, y, z]) => { const p = VR.game.player; p.teleport(x + 1.3, y + 0.8, z + 1.3); p.flying = true; p.yaw = Math.atan2(1.3, 1.3); p.pitch = -0.7; }, sl); await shot('folk_sleep'); }
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 25)) console.log(l);
await browser.close();
