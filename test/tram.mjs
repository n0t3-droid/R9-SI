// sky tram: find a line, look at the tram parked at a station, ride it across the viaduct
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const W = +(process.env.W || 960), H = +(process.env.H || 540);
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || t === 'warning' || /error|fail|rail gen/i.test(s)) logs.push(`[${t}] ${s.slice(0, 700)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(5); } };
const settle = async (max = 60) => { for (let i = 0; i < max; i++) { await step(10); const s = await ev(() => { const g = VR.game; return { busy: g.pool.busy, pend: g.world.pending.size, lod: g.horizon ? g.horizon.inflight : 0, want: g.world.lastWant || 0 }; }); if (s.busy === 0 && s.pend === 0 && s.lod === 0 && !s.want && i > 3) break; await wait(100); } };
const shot = async (name) => { await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 120000 }); console.log('shot', name); };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
const seed = process.env.SEED || '424242';
await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.applySettings('*'); }, process.env.PRESET || 'high');
await ev(`VR.game.createWorld({name:'Tram',mode:'creative',difficulty:'peaceful',type:'default',seed:'${seed}',cheats:true,kit:true})`);
for (let i = 0; i < 60; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.display = 'none'; g.env.setTime(3200); });
// wait for the line list from the worker
let info = null;
for (let i = 0; i < 30 && !info; i++) {
  await step(10); await wait(200);
  info = await ev((want) => {
    const T = VR.game.trams; if (!T || !T.lines.size) return null;
    const p = VR.game.player.pos;
    const all = [...T.lines.values()]; const near = all.filter(l => l.distTo(p[0], p[2]) < 520 && l.L > 90); const L = (want === 'long' && near.length ? near.sort((a, b) => b.L - a.L) : all.sort((a, b) => (want === 'tech' ? (b.tech - a.tech) : 0) || a.distTo(p[0], p[2]) - b.distTo(p[0], p[2])))[0];
    return { key: L.key, n: T.lines.size, L: L.L, T: L.T, period: L.period, names: L.names, tech: L.tech, p0: L.p[0], p1: L.p[1], pm: L.p[Math.floor(L.p.length / 2)], pm1: L.p[Math.floor(L.p.length / 2) + 1] };
  }, process.env.WANT || '');
}
console.log('line', JSON.stringify(info));
if (info) {
  const K = info.key;
  // 1) parked at the first station: view from the platform end
  const [x0, y0, z0] = info.p0, [x1, , z1] = info.p1;
  const ax = Math.sign(x1 - x0), az = Math.sign(z1 - z0); // along the line
  const camA = [x0 - ax * 10 + az * 6, y0 + 3.5, z0 - az * 10 + ax * 6];
  await ev(([c, t]) => { const p = VR.game.player; p.flying = true; p.teleport(c[0], c[1], c[2]); p.yaw = Math.atan2(-(t[0] - c[0]), -(t[2] - c[2])); p.pitch = -0.18; }, [camA, [x0 + ax * 3, y0, z0 + az * 3]]);
  await settle(80);
  await ev(([K]) => { const T = VR.game.trams, L = T.lines.get(K); T.clock = L.period * 50 - L.off + 3; }, [K]);
  await step(2); await shot('tram_station');
  // 2) moving across the middle, seen from the side
  const [xm, ym, zm] = info.pm, [xn, , zn] = info.pm1, bx = Math.sign(xn - xm), bz = Math.sign(zn - zm);
  const camB = [xm + bz * 22 - bx * 8, ym + 5, zm + bx * 22 - bz * 8];
  await ev(([c, t]) => { const p = VR.game.player; p.flying = true; p.teleport(c[0], c[1], c[2]); p.yaw = Math.atan2(-(t[0] - c[0]), -(t[2] - c[2])); p.pitch = -0.12; }, [camB, [xm, ym, zm]]);
  await settle(80);
  await ev(([K]) => { const T = VR.game.trams, L = T.lines.get(K); T.clock = L.period * 60 - L.off + 10 + L.T / 2 - 0.2; }, [K]);
  await step(2); await shot('tram_pass');
  await ev(([K]) => { const T = VR.game.trams, L = T.lines.get(K); T.clock = L.period * 60 - L.off + 10 + L.T / 2 - 0.2; VR.game.env.setTime(12100); }, [K]); await step(2); await shot('tram_pass_dusk');
  await ev(([K]) => { const T = VR.game.trams, L = T.lines.get(K); T.clock = L.period * 60 - L.off + 10 + L.T / 2 - 0.2; VR.game.env.setTime(16500); }, [K]); await step(2); await shot('tram_pass_night');
  // 3) ride it: board at the station, chase camera, then first person
  await ev(() => VR.game.env.setTime(4000));
  await ev(([K]) => { const g = VR.game, T = g.trams, L = T.lines.get(K); T.clock = L.period * 70 - L.off + 6; T.update(0); g.player.flying = false; T.board(L.cars[1]); g.camMode = 1; }, [K]);
  await step(30);
  const riding = await ev(() => { const r = VR.game.gadgets.riding; return r && r.type; });
  console.log('riding', riding);
  await step(40); await settle(30); await ev(([K]) => { const T = VR.game.trams, L = T.lines.get(K); T.clock = L.period * 70 - L.off + 10 + L.T * 0.45; }, [K]); await step(3); await shot('tram_ride_chase');
  await ev(() => { VR.game.camMode = 0; const p = VR.game.player; p.pitch = -0.05; });
  await step(4); await shot('tram_ride_inside');
  const hud = await ev(() => { const g = VR.game; return g.trams.hud(g.gadgets.riding); });
  console.log('hud', hud);
  // Shift while moving asks first; at the far station get off
  await ev(([K]) => { const g = VR.game, T = g.trams, L = T.lines.get(K); T.clock = L.period * 70 - L.off + 10 + L.T + 2; }, [K]);
  await step(4);
  await ev(() => { const g = VR.game; g.gadgets.dismount(); });
  const after = await ev(() => { const g = VR.game, p = g.player; return { riding: !!g.gadgets.riding, pos: p.pos.map(v => +v.toFixed(1)) }; });
  console.log('after', JSON.stringify(after));
}
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 30)) console.log(l);
await browser.close();
