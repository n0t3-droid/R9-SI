// R9 Studio World mode end to end: the game creates and saves a world (with a player-built tower), the Studio
// (same origin, served over http) lists it, loads the region around the player (saved columns + generator),
// plans a villa, a clone turned 90° and a sofa, hands the plan over; the open game builds them, marks them built.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const PORT = 8765 + Math.floor(Math.random() * 200);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', '/home/claude/vr/dist'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 900));
const URL0 = `http://127.0.0.1:${PORT}`;
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 1360, height: 820 } });
const logs = [];
const watch = (pg, tag) => { pg.on('pageerror', e => logs.push(`[${tag} pageerror] ` + (e.stack || e.message).slice(0, 900))); pg.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) logs.push(`[${tag}] ` + m.text().slice(0, 300)); }); };
const game = await ctx.newPage(); watch(game, 'game');
await game.goto(URL0 + '/index.html');
const gev = (fn, a) => game.evaluate(fn, a);
const gstep = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await gev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await game.waitForTimeout(5); } };
const gsettle = async (max = 90) => { for (let i = 0; i < max; i++) { await gstep(10); const s = await gev(() => { const g = VR.game; let dirty = 0; for (const c of g.world.cols.values()) for (const sc of c.sec) if (sc.dirty || sc.pending) dirty++; return { busy: g.pool.busy, pend: g.world.pending.size, dirty }; }); if (s.busy === 0 && s.pend === 0 && s.dirty === 0 && i > 3) break; await game.waitForTimeout(60); } };
for (let i = 0; i < 120; i++) { await game.waitForTimeout(500); if (await gev(() => VR.game && VR.game.state === 'title')) break; }
console.log('game storage ok:', await gev(() => VR.game.store.ok));
await gev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 6; g.settings.horizon = 1; g.applySettings('*'); });
await gev(`VR.game.createWorld({name:'Planwelt',mode:'creative',difficulty:'peaceful',type:'default',seed:'${process.env.SEED || '20261002'}',cheats:true,kit:true})`);
for (let i = 0; i < 90; i++) { await game.waitForTimeout(1000); if (await gev(() => VR.game.state) === 'play') break; }
await gev(() => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.env.setTime(5000); });
await gsettle(90);
// a tower the player built: it must show up in the Studio (a saved column)
const W = await gev(async () => {
  const g = VR.game, p = g.player, w = g.world, x = Math.floor(p.pos[0]) + 3, z = Math.floor(p.pos[2]) + 3, st = VR.R.byName.vollton_signal_red.defaultState;
  let y = Math.floor(p.pos[1]) - 1; while (y > 1 && !w.getBlock(x, y, z)) y--;
  for (let k = 1; k <= 12; k++) w.setBlock(x, y + k, z, st, 0);
  await g.saveMeta(); await w.saveAll();
  return { id: g.meta.id, name: g.meta.name, pos: p.pos.map(Math.floor), tower: [x, y + 1, z] };
});
console.log('world saved', JSON.stringify(W));
// ---- the Studio
const studio = await ctx.newPage(); watch(studio, 'studio');
await studio.goto(URL0 + '/studio.html');
const sev = (fn, a) => studio.evaluate(fn, a);
for (let i = 0; i < 240; i++) { await studio.waitForTimeout(500); if (await sev(() => !document.getElementById('studio').classList.contains('boot') && window.__studio && window.__studio.HOUSE.size >= 1)) break; }
await sev(() => window.__studioCore.setMode('world'));
for (let i = 0; i < 40; i++) { await studio.waitForTimeout(300); if (await sev(() => !!VR.StudioWorld.worlds)) break; }
console.log('worlds in the Studio:', JSON.stringify(await sev(() => VR.StudioWorld.worlds.map(w => w.name))));
await studio.screenshot({ path: '/home/claude/vr/test/shots/wm_0_worlds.png', timeout: 180000 });
const t0 = Date.now();
await sev((id) => { const WM = VR.StudioWorld; WM.open(WM.worlds.find(w => w.id === id)); }, W.id);
for (let i = 0; i < 400; i++) { await studio.waitForTimeout(500); if (await sev(() => VR.StudioWorld.world && !VR.StudioWorld.loading && VR.StudioWorld.cols.size)) break; }
const reg = await sev(([tx, ty, tz]) => { const WM = VR.StudioWorld; return { cols: WM.cols.size, saved: [...WM.cols.values()].filter(c => c.saved).length, sections: WM.gpu.length, towerTop: VR.R.types[VR.R.T.type[WM.getBlock(tx, ty + 11, tz)]].name, sys: document.getElementById('sysText').textContent }; }, W.tower);
console.log('region loaded in', ((Date.now() - t0) / 1000).toFixed(1), 's:', JSON.stringify(reg));
await studio.waitForTimeout(500);
await studio.screenshot({ path: '/home/claude/vr/test/shots/wm_1_region.png', timeout: 180000 });
// ---- plan: a villa 28 blocks east of the player, a clone turned 90°, a sofa in front
const sofa = await sev(() => Object.keys(VR.VM.MODELS).find(n => /^vm_sofa/.test(n)));
const plan = await sev(async ([px, pz, sofa]) => {
  const WM = VR.StudioWorld, C = window.__studioCore;
  const it = WM.houseItem(0); WM.tool = it; WM.meshFor(it);
  for (let i = 0; i < 100 && !WM.meshFor(it); i++) await new Promise(r => setTimeout(r, 200));
  const m = WM.meshFor(it); if (!m) return { err: 'no mesh' };
  const ray = { o: [px + 26.5, 400, pz + 0.5], d: [0, -1, 0] }, hit = WM.pickGround(ray);
  const gp = WM.ghostAt(hit, it, m);
  WM.change(() => { const p = Object.assign({}, gp, { id: 'test-a', status: 'draft', t: Date.now() }); WM.plans.push(p); WM.sel = p.id; });
  const a = WM.plans.find(p => p.id === 'test-a');
  WM.change(() => { const q = WM.clone(a, m); WM.rotate(q, m); });
  // the sofa
  const it2 = { kind: 'model', name: sofa }; WM.meshFor(it2);
  for (let i = 0; i < 100 && !WM.meshFor(it2); i++) await new Promise(r => setTimeout(r, 200));
  const m2 = WM.meshFor(it2), h2 = WM.pickGround({ o: [px + 6.5, 400, pz - 4.5], d: [0, -1, 0] });
  const s2 = WM.ghostAt(h2, it2, m2);
  WM.change(() => { WM.plans.push(Object.assign({}, s2, { id: 'test-sofa', status: 'draft', t: Date.now() })); });
  WM.tool = null; WM.refresh();
  const sc = window.__st.scene; sc.center = [a.ox + 18, a.F + 4, a.oz + 16]; window.__st.cam.dist = 120; window.__st.cam.pitch = 0.62;
  return { plans: WM.plans.map(p => ({ k: p.kind, i: p.index, n: p.name, x: p.ox, y: p.F, z: p.oz, r: p.r, s: p.status })), lot: m.lot, top: m.top };
}, [W.pos[0], W.pos[2], sofa]);
console.log('planned', JSON.stringify(plan));
await studio.waitForTimeout(800);
await studio.screenshot({ path: '/home/claude/vr/test/shots/wm_2_planned.png', timeout: 180000 });
// ---- the real mouse path: pick a house card, hover the ground, click to place, R, drag, Ctrl+D, Entf, Ctrl+Z
await sev(() => { const WM = VR.StudioWorld; WM.tab = 'houses'; WM.refresh(); });
await studio.waitForTimeout(300);
const cards = await studio.$$('#list .card.house');
await cards[2].click(); await studio.waitForTimeout(1500);
const vbox = await (await studio.$('#view')).boundingBox(), vx = vbox.x + vbox.width * 0.42, vy = vbox.y + vbox.height * 0.62;
await sev(() => { const S = window.__st; S.cam.pitch = 1.15; S.cam.dist = 150; });
await studio.mouse.move(vx, vy); await studio.waitForTimeout(150); await studio.mouse.move(vx + 3, vy + 2); await studio.waitForTimeout(250);
const ghost = await sev(() => { const g = VR.StudioWorld.ghost; return g ? { x: g.ox, y: g.F, z: g.oz, r: g.r, ok: g.ok } : null; });
await studio.mouse.down(); await studio.mouse.up(); await studio.waitForTimeout(300);
const n1 = await sev(() => VR.StudioWorld.plans.length);
await studio.keyboard.press('Escape'); await studio.waitForTimeout(100);
// select it (click on it), turn it, drag it 60 px to the right
await studio.mouse.move(vx + 3, vy + 2); await studio.mouse.down(); await studio.mouse.up(); await studio.waitForTimeout(200);
const sel1 = await sev(() => { const WM = VR.StudioWorld, p = WM.plans.find(q => q.id === WM.sel); return p ? { x: p.ox, z: p.oz, r: p.r } : null; });
await studio.keyboard.press('r'); await studio.waitForTimeout(150);
await studio.mouse.move(vx + 3, vy + 2); await studio.mouse.down(); for (let k = 1; k <= 8; k++) await studio.mouse.move(vx + 3 + k * 8, vy + 2); await studio.mouse.up(); await studio.waitForTimeout(200);
const sel2 = await sev(() => { const WM = VR.StudioWorld, p = WM.plans.find(q => q.id === WM.sel); return p ? { x: p.ox, z: p.oz, r: p.r } : null; });
await studio.keyboard.press('Control+d'); await studio.waitForTimeout(200);
const n2 = await sev(() => VR.StudioWorld.plans.length);
await studio.keyboard.press('Delete'); await studio.waitForTimeout(200);
const n3 = await sev(() => VR.StudioWorld.plans.length);
await studio.keyboard.press('Control+z'); await studio.waitForTimeout(200);
const n4 = await sev(() => VR.StudioWorld.plans.length);
console.log('mouse path:', JSON.stringify({ ghost, placed: n1, selected: sel1, afterRandDrag: sel2, clone: n2, deleted: n3, undone: n4 }));
await studio.screenshot({ path: '/home/claude/vr/test/shots/wm_2b_mouse.png', timeout: 180000 });
await sev(() => VR.StudioWorld.commit());
const stored = await sev((id) => JSON.parse(localStorage.getItem('r9si.plans.' + id)).plans.map(p => p.status).join(','), W.id);
console.log('handed to the game:', stored);
// ---- the game (world still open) builds them
let built = null;
for (let i = 0; i < 60; i++) { await gstep(20); built = await gev((id) => JSON.parse(localStorage.getItem('r9si.plans.' + id)).plans.map(p => p.status).join(','), W.id); if (!/pending/.test(built)) break; await game.waitForTimeout(200); }
console.log('after the game ran:', built);
const check = await gev((id) => {
  // every planned piece: its cells in the world are exactly the piece's cells, turned and moved like the Studio shows them
  const g = VR.game, w = g.world, B = g.gadgets.blue, ROT = [(u, v) => [u, v], (u, v) => [-v, u], (u, v) => [-u, -v], (u, v) => [v, -u]];
  const plans = JSON.parse(localStorage.getItem('r9si.plans.' + id)).plans;
  return plans.map(pl => {
    const bp = B.planPiece(pl); if (!bp) return 'no piece';
    let ok = 0, bad = 0, n = 0;
    for (let k = 0; k < bp.ops.length; k += 4) {
      const s = bp.ops[k + 3]; if (!s) continue; if (n++ % 7) continue;
      const q = ROT[pl.r & 3](bp.ops[k], bp.ops[k + 2]), x = pl.ox + q[0], y = pl.F + bp.ops[k + 1], z = pl.oz + q[1];
      if (w.getBlock(x, y, z) === VR.Custom.rotState(s, pl.r & 3)) ok++; else { bad++; if (!window.__offs) window.__offs = []; const nm = (q) => q ? VR.R.types[VR.R.T.type[q]].name + JSON.stringify(VR.R.types[VR.R.T.type[q]].decode(q)) : 'air'; if (window.__offs.length < 6) window.__offs.push([x, y, z, 'want ' + nm(VR.Custom.rotState(s, pl.r & 3)), 'got ' + nm(w.getBlock(x, y, z))]); }
    }
    return pl.kind + ' r' + pl.r + ': ' + ok + ' ok / ' + bad + ' off';
  });
}, W.id);
console.log('in the game world:', JSON.stringify(check));
console.log('off cells:', JSON.stringify(await gev(() => window.__offs || [])));
await gsettle(80);
await gev(([x, y, z]) => { const g = VR.game, p = g.player; p.flying = true; p.noclip = true; p.teleport(x - 22, y + 24, z - 30); p.yaw = Math.atan2(22 + 18, 30 + 16) + Math.PI; p.pitch = -0.45; g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.display = 'none'; }, [plan.plans[0].x, plan.plans[0].y, plan.plans[0].z]);
await gsettle(60); await gstep(6);
await gev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; });
await game.screenshot({ path: '/home/claude/vr/test/shots/wm_3_game.png', timeout: 180000 });
await studio.waitForTimeout(600);
console.log('the Studio sees:', JSON.stringify(await sev(() => VR.StudioWorld.plans.map(p => p.status))));
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 14)) console.log(l);
await browser.close(); srv.kill();
