import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || t === 'warning' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 700)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 20) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(20, n - k), dtms]); } };
const shot = async (name, tod) => { await ev((tod) => { window.__norender = false; const g = VR.game; if (tod !== undefined) g.env.setTime(tod); g.env.rain = 0; g.env.rainTarget = 0; g.last = performance.now() - 33; g.loop(performance.now()); g.last = performance.now() - 33; g.loop(performance.now()); g.renderer.gl.finish(); window.__norender = true; }, tod); await wait(200); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 120000 }); console.log('shot', name); };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev((rd) => { const g = VR.game; g.settings.renderDist = rd; g.settings.dynRes = false; g.settings.minimap = true; g.applySettings('renderDist'); }, +(process.env.RD || 8));
await ev(`VR.game.createWorld({name:'Hero',mode:'creative',difficulty:'peaceful',type:'default',seed:'${process.env.SEED || '777'}',cheats:true,kit:true})`);
for (let i = 0; i < 60; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.env.setTime(3000); });
for (let i = 0; i < 25; i++) { await step(20); await wait(250); }
await step(300);
const setCam = (pos, tgt) => ev(([pos, tgt]) => { const p = VR.game.player; p.teleport(pos[0], pos[1], pos[2]); p.flying = true; const dx = tgt[0] - pos[0], dy = tgt[1] - pos[1] - 1.6, dz = tgt[2] - pos[2]; p.yaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); }, [pos, tgt]);
const pz = await ev(() => { const v = [...VR.game.villages.known.values()][0]; return v.plan.plaza; });
// portrait of a villager: freeze one facing the camera
const hero = await ev(() => { const V = VR.game.villages; const a = V.agents.find(a => !a.kid && a.pose !== 'sleep' && a.role !== 'gardener') || V.agents[0]; a.act = { type: 'talk', t: 0, len: 999, with: null }; a.path = null; a.pose = 'stand'; a.vel = [0, 0, 0]; a.bubble = { text: 'Welcome to ' + a.vil.name + '!', t: 99 }; return [a.pos[0], a.pos[1], a.pos[2], a.yaw, a.p.name, a.role]; });
const cxp = hero[0] - Math.sin(hero[3]) * 2.6, czp = hero[2] - Math.cos(hero[3]) * 2.6;
await setCam([cxp, hero[1] + 0.1, czp], [hero[0], hero[1] + 1.25, hero[2]]);
await ev(([x, y, z]) => { const V = VR.game.villages; const a = V.agents.find(a => a.act && a.act.len === 999); if (a) a.lookAt = [x, y + 1.5, z]; }, [cxp, hero[1] + 0.1, czp]);
await step(20);
await shot('hero_portrait', 4000);
console.log('portrait', hero[4], hero[5]);
await setCam([pz.x + 7, pz.y + 3.5, pz.z + 7], [pz.x, pz.y + 1, pz.z]);
console.log('env', JSON.stringify(await ev(() => { const e = VR.game.env; return { tod: e.timeOfDay, night: e.E.night, sun: e.E.sunDir, zen: e.E.zenith, hor: e.E.horizon, exp: e.E.exposure }; })));
await shot('hero_plaza', 5000);
await ev(() => VR.game.env.setTime(11500)); await step(200);
await setCam([pz.x + 34, pz.y + 22, pz.z + 30], [pz.x, pz.y, pz.z]);
console.log('env', JSON.stringify(await ev(() => { const e = VR.game.env; return { tod: e.timeOfDay, night: e.E.night, sun: e.E.sunDir, zen: e.E.zenith, hor: e.E.horizon, exp: e.E.exposure }; })));
await shot('hero_golden', 11300);
await ev(() => VR.game.env.setTime(13300)); await step(100);
await setCam([pz.x - 30, pz.y + 18, pz.z + 26], [pz.x, pz.y, pz.z]);
await shot('hero_dusk', 13100);
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 25)) console.log(l);
await browser.close();
