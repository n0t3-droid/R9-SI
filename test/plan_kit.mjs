// Village Life & Supermarket kit showcase: builds a supermarket interior and a farm yard, checks every block exists, takes screenshots
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const W = +(process.env.W || 960), H = +(process.env.H || 540);
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
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
await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.applySettings('*'); }, process.env.PRESET || 'high');
await ev(`VR.game.createWorld({name:'PlanKit',mode:'creative',difficulty:'peaceful',type:'default',seed:'${process.env.SEED || '424242'}',cheats:true,kit:true})`);
for (let i = 0; i < 60; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.display = 'none'; });



// ---- build six planned houses in a row on flat ground
await ev(() => { const g = VR.game, p = g.player; p.flying = true; p.teleport(p.pos[0] + 66, 100, p.pos[2] + 4); });
await settle(80); await step(20);
await ev(() => { const g = VR.game, p = g.player; p.teleport(p.pos[0] - 66, 100, p.pos[2] - 4); });
await settle(40);
const site = await ev((seeds) => {
  const g = VR.game, p = g.player, w = g.world, VG = VR.VillageGen;
  const x0 = Math.floor(p.pos[0]) - 20, z0 = Math.floor(p.pos[2]) + 20, y0 = 90;
  const list = [];
  const S = (n) => { const t = VR.R.byName[n]; return t ? t.defaultState : 0; };
  for (let x = -8; x < 150; x++) for (let z = -12; z < 30; z++) { for (let y = y0 - 3; y < y0 + 20; y++) list.push([x0 + x, y, z0 + z, 0]); list.push([x0 + x, y0 - 1, z0 + z, S('grass_block')]); for (let y = y0 - 6; y < y0 - 1; y++) list.push([x0 + x, y, z0 + z, S('dirt')]); }
  for (const [x, y, z, s] of list) w.setBlock(x, y, z, s, 0);
  const houses = [];
  let ox = x0;
  const specs = [[15, 13, 1], [17, 14, 2], [13, 12, 2], [12, 11, 2], [16, 13, 1], [14, 12, 2]];
  specs.forEach(([lw, ld, st], i) => {
    const seed = seeds[i % seeds.length];
    const rec = [];
    const L = VG.makeLot((x, y, z, s) => rec.push(x, y, z, s), ox, z0, 0);
    const lot = { w: lw, d: ld, F: y0, r: 0, ox, oz: z0, kind: 'home' };
    const info = VG.plan2.build(L, lot, { rng: new VR.RNG(seed), ground: () => y0 - 1, beds: 3, storeys: st });
    for (let i2 = 0; i2 < rec.length; i2 += 4) w.setBlock(rec[i2], rec[i2 + 1], rec[i2 + 2], rec[i2 + 3], 0);
    houses.push({ ox, w: lw, d: ld, st, skin: info.skin, rooms: info.plan.floors.map(f => f.rooms.map(r => r.type).join(',')).join(' | '), beds: info.beds.length, seats: info.seats.length, ops: rec.length / 4, inside: info.inside });
    ox += lw + 5;
  });
  return { x0, y0, z0, houses };
}, [11, 22, 33, 44, 55, 66]);
console.log('site', JSON.stringify(site, null, 0).slice(0, 1500));
await settle(60); await step(30);
const view = async (name, pos, yaw, pitch, tod) => { if (ONLY && !ONLY.includes(name)) return; await ev(([pos, yaw, pitch, tod]) => { const g = VR.game, p = g.player; p.flying = true; p.teleport(pos[0], pos[1], pos[2]); p.yaw = yaw; p.pitch = pitch; g.env.setTime(tod); }, [pos, yaw, pitch, tod]); await settle(20); await step(12); await shot(name); };
const { x0, y0, z0 } = site;
for (let i = 0; i < site.houses.length; i++) {
  const h = site.houses[i], cx = h.ox + h.w / 2;
  await view(`pk_${i}_front`, [cx + 6, y0 + 5, z0 - 15], Math.PI - 0.35, -0.16, 12500);
  await view(`pk_${i}_inside`, [h.ox + h.inside[0] + 0.5, y0 + 1.6, z0 + h.inside[2] + 0.5], Math.PI * 0.75, -0.05, 12500);
}
await view('pk_all', [x0 + 70, y0 + 26, z0 - 40], Math.PI, -0.45, 12500);
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 12)) console.log(l);
await browser.close();
