// smooth ground: build a test hill out of grass + a road ramp in the flat kit world and photograph it from low angles
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 700)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(5); } };
const settle = async (max = 60) => { for (let i = 0; i < max; i++) { await step(10); const s = await ev(() => { const g = VR.game; return { busy: g.pool.busy, pend: g.world.pending.size, lod: g.horizon ? g.horizon.inflight : 0, want: g.world.lastWant || 0 }; }); if (s.busy === 0 && s.pend === 0 && s.lod === 0 && !s.want && i > 3) break; await wait(100); } };
const shot = async (name) => { await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 120000 }); console.log('shot', name); };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
console.log('title', await ev(() => VR.game && VR.game.state));
// the smooth ground in this test belongs to the Nahtlos look (LOOK=classic photographs the same scene in Klassisch)
await ev(([p, lk]) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.look = lk; g.applySettings('*'); }, [process.env.PRESET || 'high', process.env.LOOK || 'seamless']);
await ev(`VR.game.createWorld({name:'Slopes',mode:'creative',difficulty:'peaceful',type:'default',seed:'424242',cheats:true,kit:true})`);
for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
console.log('world', await ev(() => VR.game.state));
await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.display = 'none'; g.env.setTime(7000); });
// build: a hill (grass over dirt) with a road (asphalt) climbing it, a pavement strip, some flowers; 40 blocks east of spawn
const base = await ev(() => { const g = VR.game, w = g.world, p = g.player, R = VR.R; const ox = Math.floor(p.pos[0]) + 30, oz = Math.floor(p.pos[2]) - 20, y0 = Math.floor(p.pos[1]) - 1;
  const st = (n) => R.byName[n].defaultState; const G = st('grass_block'), D = st('dirt'), A = st('asphalt'), PV = st('paver_grey'), FL = st('dandelion'), GR = st('short_grass');
  const list = [];
  for (let z = 0; z < 40; z++) for (let x = 0; x < 40; x++) { const h = Math.round(3 * Math.sin(x * 0.18) * Math.cos(z * 0.16) + 2.5 * Math.exp(-((x - 24) ** 2 + (z - 22) ** 2) / 80)); const road = Math.abs(z - 20) <= 1, pave = Math.abs(z - 20) === 2;
    for (let y = -4; y <= 8; y++) { const yy = y0 + y; let b = 0; if (y < h) b = D; else if (y === h) b = road ? A : pave ? PV : G; else if (y === h + 1 && !road && !pave && ((x * 7 + z * 13) % 5 === 0)) b = (x + z) & 1 ? FL : GR; list.push([ox + x, yy, oz + z, b]); } }
  w.bulkSet(list, false);
  return [ox, y0, oz]; });
console.log('built at', base);
await settle(60);
const look = async (name, pos, yaw, pitch) => { await ev(([pos, yaw, pitch]) => { const g = VR.game, p = g.player; p.flying = true; p.noclip = true; p.teleport(pos[0], pos[1], pos[2]); p.yaw = yaw; p.pitch = pitch; }, [pos, yaw, pitch]); await settle(20); await step(8); await shot(name); };
const [ox, y0, oz] = base;
await look('slopes_1_road', [ox + 2, y0 + 3, oz + 20.5], -Math.PI / 2, -0.12);
await look('slopes_2_hill', [ox + 8, y0 + 6, oz + 36], -0.6, -0.35);
await look('slopes_3_low', [ox + 14, y0 + 2.2, oz + 10], -1.2, -0.08);
await look('slopes_4_top', [ox + 20, y0 + 22, oz + 20], 0, -1.5);
// physics: walk the player up the road on foot and report the height trace
const trace = await ev(([ox, y0, oz]) => { window.__norender = true; const g = VR.game, p = g.player; p.flying = false; p.noclip = false; p.teleport(ox + 1.5, y0 + 2, oz + 20.5); p.yaw = -Math.PI / 2; p.pitch = 0; const out = []; for (let i = 0; i < 240; i++) { g.input = g.input || {}; p.vel[0] = 4; g.last = performance.now() - 16; g.loop(performance.now()); if (i % 20 === 0) out.push([+(p.pos[0] - ox).toFixed(1), +p.pos[1].toFixed(2), p.onGround ? 1 : 0]); } return out; }, base);
console.log('walk trace [x, y, onGround]:', JSON.stringify(trace));
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 8)) console.log(l);
await browser.close();
