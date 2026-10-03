// Villa catalogue showcase: builds every catalogue house on flat ground and screenshots front, garden, foyer and upper floor
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const W = +(process.env.W || 960), H = +(process.env.H || 540);
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 700)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
if (process.env.CUSTOM) { const t = (await import('fs')).readFileSync(process.env.CUSTOM, 'utf8'); await page.addInitScript((t) => { try { localStorage.setItem('r9si.studio', t); } catch (e) { /* */ } }, t); }
await page.goto('file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(5); } };
const settle = async (max = 60) => { for (let i = 0; i < max; i++) { await step(10); const s = await ev(() => { const g = VR.game; return { busy: g.pool.busy, pend: g.world.pending.size, lod: g.horizon ? g.horizon.inflight : 0, want: g.world.lastWant || 0 }; }); if (s.busy === 0 && s.pend === 0 && s.lod === 0 && !s.want && i > 3) break; await wait(100); } };
const shot = async (name) => { await ev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }); await page.screenshot({ path: `/home/claude/vr/test/shots/${name}.png`, timeout: 120000 }); console.log('shot', name); };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(([p, hz]) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.horizon = hz; g.applySettings('*'); }, [process.env.PRESET || 'high', +(process.env.HZ || 2)]);
await ev(`VR.game.createWorld({name:'VillaKit',mode:'creative',difficulty:'peaceful',type:'default',seed:'${process.env.SEED || '424242'}',cheats:true,kit:true})`);
for (let i = 0; i < 60; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.display = 'none'; });

const SEL = process.env.SEL ? process.env.SEL.split(',').map(Number) : null;   // catalogue indices to build
const MIRROR = process.env.MIRROR ? process.env.MIRROR === '1' : null;
const SKIN = process.env.SKIN || null;
// ---- build the catalogue in a row on flat ground
const OFF = +(process.env.OFF || 520);
await ev((off) => { const g = VR.game, p = g.player; p.flying = true; p.noClip = true; p.teleport(p.pos[0] + off, 100, p.pos[2] + off); }, OFF);
await settle(120); await step(20);
await ev(() => { const g = VR.game, p = g.player; p.teleport(p.pos[0] + 100, 100, p.pos[2]); });
await settle(80); await step(20);
await ev(() => { const g = VR.game, p = g.player; p.teleport(p.pos[0] - 100, 100, p.pos[2]); });
await settle(60);
const site = await ev(([sel, mirror, skin]) => {
  const g = VR.game, p = g.player, w = g.world, VG = VR.VillageGen, PLAN = VG.plan2;
  const x0 = Math.floor(p.pos[0]) - 20, z0 = Math.floor(p.pos[2]) + 20, y0 = 90;
  const cats = sel ? sel.map(i => PLAN.CATALOGUE[i]) : PLAN.CATALOGUE;
  const totalW = cats.reduce((a, c) => a + c.lot[0] + 6, 0);
  const S = (n) => { const t = VR.R.byName[n]; return t ? t.defaultState : 0; };
  const list = [];
  for (let x = -8; x < totalW + 8; x++) for (let z = -12; z < 48; z++) { for (let y = y0 - 3; y < y0 + 26; y++) list.push([x0 + x, y, z0 + z, 0]); list.push([x0 + x, y0 - 1, z0 + z, S('grass_block')]); for (let y = y0 - 6; y < y0 - 1; y++) list.push([x0 + x, y, z0 + z, S('dirt')]); }
  for (const [x, y, z, s] of list) w.setBlock(x, y, z, s, 0);
  const houses = [];
  let ox = x0;
  cats.forEach((cat, i) => {
    const rec = [];
    const L = VG.makeLot((x, y, z, s) => rec.push(x, y, z, s), ox, z0, 0);
    const lot = { w: cat.lot[0], d: cat.lot[1], F: y0, r: 0, ox, oz: z0, kind: 'home' };
    const o = { rng: new VR.RNG(1000 + i * 17), ground: () => y0 - 1, beds: 3 };
    if (mirror !== null) o.mirror = mirror; if (skin) o.skin = skin;
    const info = PLAN.build(L, lot, o);
    for (let k = 0; k < rec.length; k += 4) w.setBlock(rec[k], rec[k + 1], rec[k + 2], rec[k + 3], 0);
    const Hp = info.plan, up = Hp.floors[1] ? Hp.floors[1].rooms : [], gal = up.find(r => r.type === 'gallery'), open = Hp.floors[0].rooms.find(r => r.type === 'open' || r.type === 'living' || r.type === 'salon'), master = up.find(r => r.type === 'master') || Hp.floors[0].rooms.find(r => r.type === 'master');
    houses.push({ ox, w: lot.w, d: lot.d, family: Hp.family, storeys: Hp.storeys, skin: info.skin, ops: rec.length / 4, beds: info.beds.length, seats: info.seats.length, inside: info.inside, hu0: Hp.u0, hv0: Hp.v0, hw: Hp.w, hd: Hp.d, gal: gal ? [Hp.u0 + ((gal.u0 + gal.u1) >> 1), Hp.v0 + gal.v1] : null, open: open ? (open.terraceDoor ? [Hp.u0 + open.terraceDoor[0], Hp.v0 + open.terraceDoor[1]] : [Hp.u0 + open.doors[0].u, Hp.v0 + open.doors[0].v]) : null, openYaw: open ? (open.terraceDoor ? 0 : Math.atan2(-(((open.u0 + open.u1) >> 1) - open.doors[0].u), -(((open.v0 + open.v1) >> 1) - open.doors[0].v))) : 0, master: master ? [Hp.u0 + master.u0 + (master.doors[0] ? 0 : 0), Hp.v0 + master.v0, Hp.u0 + ((master.u0 + master.u1) >> 1), Hp.v0 + ((master.v0 + master.v1) >> 1)] : null, rooms: Hp.floors.map(f => f.rooms.map(r => r.type).join(',')).join(' | ') });
    ox += lot.w + 6;
  });
  return { x0, y0, z0, houses };
}, [SEL, MIRROR, SKIN]);
console.log('site', JSON.stringify(site.houses.map(h => ({ f: h.family, s: h.skin, ops: h.ops, beds: h.beds, seats: h.seats, rooms: h.rooms }))));
await settle(60); await step(30);
const view = async (name, pos, yaw, pitch, tod) => { if (ONLY && !ONLY.some(o => name.includes(o))) return; await ev(([pos, yaw, pitch, tod]) => { const g = VR.game, p = g.player; p.flying = true; p.noClip = true; p.teleport(pos[0], pos[1], pos[2]); p.yaw = yaw; p.pitch = pitch; g.env.setTime(tod); }, [pos, yaw, pitch, tod]); await settle(20); await step(12); await shot(name); };
const { x0, y0, z0 } = site;
const TOD = +(process.env.TOD || 12500);
for (let i = 0; i < site.houses.length; i++) {
  const h = site.houses[i], cx = h.ox + h.hu0 + h.hw / 2, tag = `vk_${i}_${h.family}`;
  await view(`${tag}_front`, [cx + 9, y0 + 8, z0 - 17], Math.PI - 0.42, -0.22, TOD);
  await view(`${tag}_garden`, [cx - 8, y0 + 9, z0 + h.d + 15], 0.4, -0.25, TOD);
  await view(`${tag}_foyer`, [h.ox + h.inside[0] + 0.5, y0 + 1.7, z0 + h.inside[2] + 0.5], Math.PI, -0.05, TOD);
  if (h.open) await view(`${tag}_living`, [h.ox + h.open[0] + 0.5, y0 + 1.7, z0 + h.open[1] + 0.5], h.openYaw, -0.08, TOD);
  if (h.master) { const [du, dv, mu, mv] = h.master; await view(`${tag}_master`, [h.ox + du + 0.5, y0 + (h.storeys > 1 ? 5.7 : 1.7), z0 + dv + 0.5], Math.atan2(-(mu - du), -(mv - dv)), -0.12, TOD); }
  if (h.gal) await view(`${tag}_upper`, [h.ox + h.gal[0] + 0.5, y0 + 5.7, z0 + h.gal[1] + 0.5], 0, -0.1, TOD);
}
await view('vk_all', [x0 + 110, y0 + 34, z0 - 46], Math.PI, -0.5, TOD);
// geometry budget: vertex bytes per layer over all loaded sections (opaque, cutout, trans, vx detail, vx far)
const budget = await ev(() => { const r = VR.game.renderer, w = VR.game.world; const tot = [0, 0, 0, 0, 0]; let secs = 0, ram = 0; for (const c of w.cols.values()) for (const s of (c.sec || [])) { if (!s || !s.mesh) continue; secs++; for (let l = 0; l < 5; l++) if (s.mesh[l]) tot[l] += s.mesh[l].cap * 16; if (s.vxData) ram += s.vxData.byteLength; } return { secs, MB: tot.map(b => (b / 1048576).toFixed(1)), vxRamMB: (ram / 1048576).toFixed(1) }; });
console.log('geometry MB on GPU [opaque, cutout, trans, vxDetail(resident), vxFar]:', JSON.stringify(budget));
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 12)) console.log(l);
await browser.close();
