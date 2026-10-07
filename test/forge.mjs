// 🏭 Forge end to end: the game creates and saves a world; the Studio opens 🏭 Forge, reads „Hochhaus 12 Stockwerke
// Glas" from the text field, builds nine variants, the second one is picked, „📍 Setzen" arms the World mode's ghost,
// the tower is placed near the player and handed over; the open game rebuilds it from the DNA (in slices when it is
// big), marks the plan built, notes the landing in front of it, and a person can walk from the door to the top floor
// in the built blocks — no pageerror on either page.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const PORT = 8765 + Math.floor(Math.random() * 200);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', '/home/claude/vr/dist'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 900));
const URL0 = `http://127.0.0.1:${PORT}`;
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 1360, height: 820 } });
const logs = [], fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const watch = (pg, tag) => { pg.on('pageerror', e => logs.push(`[${tag} pageerror] ` + (e.stack || e.message).slice(0, 900))); pg.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) logs.push(`[${tag}] ` + m.text().slice(0, 300)); }); };
const game = await ctx.newPage(); watch(game, 'game');
await game.goto(URL0 + '/index.html');
const gev = (fn, a) => game.evaluate(fn, a);
const gstep = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await gev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await game.waitForTimeout(5); } };
const gsettle = async (max = 90) => { for (let i = 0; i < max; i++) { await gstep(10); const s = await gev(() => { const g = VR.game; let dirty = 0; for (const c of g.world.cols.values()) for (const sc of c.sec) if (sc.dirty || sc.pending) dirty++; return { busy: g.pool.busy, pend: g.world.pending.size, dirty }; }); if (s.busy === 0 && s.pend === 0 && s.dirty === 0 && i > 3) break; await game.waitForTimeout(60); } };
for (let i = 0; i < 120; i++) { await game.waitForTimeout(500); if (await gev(() => VR.game && VR.game.state === 'title')) break; }
await gev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 6; g.settings.horizon = 1; g.applySettings('*'); });
await gev(`VR.game.createWorld({name:'Forgewelt',mode:'creative',difficulty:'peaceful',type:'flat',seed:'20261007',cheats:true,kit:true})`);
for (let i = 0; i < 90; i++) { await game.waitForTimeout(1000); if (await gev(() => VR.game.state) === 'play') break; }
await gev(() => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.env.setTime(5000); });
await gsettle(90);
const W = await gev(async () => { const g = VR.game, p = g.player; await g.saveMeta(); await g.world.saveAll(); return { id: g.meta.id, name: g.meta.name, pos: p.pos.map(Math.floor) }; });
console.log('world saved', JSON.stringify(W));
// ---- the Studio: 🏭 Forge
const studio = await ctx.newPage(); watch(studio, 'studio');
await studio.goto(URL0 + '/studio.html');
const sev = (fn, a) => studio.evaluate(fn, a);
for (let i = 0; i < 240; i++) { await studio.waitForTimeout(500); if (await sev(() => !document.getElementById('studio').classList.contains('boot') && window.__studio && window.__studio.HOUSE.size >= 1)) break; }
check(await sev(() => !!document.querySelector('nav.modes button[data-mode="forge"]')), 'the header has a 🏭 Forge button');
await studio.click('nav.modes button[data-mode="forge"]'); await studio.waitForTimeout(600);
check(await sev(() => window.__st.mode === 'forge' && document.querySelectorAll('#chips button.fgt').length >= 9), 'Forge mode: an icon per type in the chip row');
const inp = await studio.$('#partsBody input.ftext'); check(!!inp, 'the text field „Was soll entstehen?“');
await inp.click(); await inp.fill('Hochhaus 12 Stockwerke Glas'); await studio.keyboard.press('Enter'); await studio.waitForTimeout(400);
const dna0 = await sev(() => VR.StudioForge.dna);
check(/^tower:f12/.test(dna0) && /glas/.test(dna0), 'the wish became a DNA: ' + dna0);
check(await sev(() => document.querySelectorAll('#list .fvar').length === 9), 'nine variant cards');
for (let i = 0; i < 120; i++) { await studio.waitForTimeout(500); if (await sev(() => document.querySelectorAll('#list .fvar canvas.done').length >= 9)) break; }
const done = await sev(() => document.querySelectorAll('#list .fvar canvas.done').length);
check(done >= 9, 'every variant got its picture (' + done + '/9)');
await studio.screenshot({ path: '/home/claude/vr/test/shots/forge_1_variants.png', timeout: 180000 });
await studio.click('#list .fvar[data-i="1"]'); await studio.waitForTimeout(400);
const picked = await sev(() => ({ sel: VR.StudioForge.sel, dna: VR.StudioForge.variants[VR.StudioForge.sel], scene: window.__st.scene && window.__st.scene.type, hash: location.hash }));
check(picked.sel === 1 && picked.scene === 'clip' && /^#forge\//.test(picked.hash), 'variant 2 picked, shown in the middle: ' + JSON.stringify(picked));
// a slider rebuilds the nine (the floors)
const before = await sev(() => VR.StudioForge.variants.slice());
await sev(() => { const r = document.querySelector('#partsBody input[data-fp="f"]'); r.value = 8; r.dispatchEvent(new Event('input')); });
await studio.waitForTimeout(500);
const after = await sev(() => VR.StudioForge.variants.slice());
check(after[0] !== before[0] && /f8/.test(after[0]), 'the floors slider rebuilt the variants: ' + after[0]);
await sev(() => { const r = document.querySelector('#partsBody input[data-fp="f"]'); r.value = 12; r.dispatchEvent(new Event('input')); });
await studio.waitForTimeout(500);
// tweak in words
await sev(() => VR.StudioForge.setText('mit Helipad'));
check(/c2/.test(await sev(() => VR.StudioForge.dna)), '„mit Helipad“ tweaks the DNA: ' + await sev(() => VR.StudioForge.dna));
// ---- 📍 Setzen without a world: a hint, no crash; then open the world and place it
await sev(() => VR.StudioForge.place());
check(await sev(() => window.__st.mode === 'forge'), 'without an open world 📍 Setzen stays in the Forge (a hint)');
await sev(() => window.__studioCore.setMode('world'));
for (let i = 0; i < 40; i++) { await studio.waitForTimeout(300); if (await sev(() => !!VR.StudioWorld.worlds)) break; }
await sev((id) => { const WM = VR.StudioWorld; WM.open(WM.worlds.find(w => w.id === id)); }, W.id);
for (let i = 0; i < 400; i++) { await studio.waitForTimeout(500); if (await sev(() => VR.StudioWorld.world && !VR.StudioWorld.loading && VR.StudioWorld.cols.size)) break; }
await sev(() => window.__studioCore.setMode('forge')); await studio.waitForTimeout(300);
await studio.click('#partsBody [data-act="fplace"]'); await studio.waitForTimeout(300);
check(await sev(() => window.__st.mode === 'world' && VR.StudioWorld.tool && VR.StudioWorld.tool.kind === 'forge'), '📍 Setzen: the World mode holds the structure as the tool');
const dnaPlaced = await sev(() => VR.StudioWorld.tool.dna);
const plan = await sev(async ([px, pz]) => {
  const WM = VR.StudioWorld, it = WM.tool;
  for (let i = 0; i < 200 && !WM.meshFor(it); i++) await new Promise(r => setTimeout(r, 200));
  const m = WM.meshFor(it); if (!m) return { err: 'no mesh' };
  const hit = WM.pickGround({ o: [px + 30.5, 400, pz + 0.5], d: [0, -1, 0] });
  const gp = WM.ghostAt(hit, it, m);
  WM.change(() => { const p = Object.assign({}, gp, { id: 'forge-a', status: 'draft', t: Date.now() }); delete p.ok; WM.plans.push(p); WM.sel = p.id; });
  WM.tool = null; WM.ghost = null; WM.refresh();
  const p = WM.plans.find(q => q.id === 'forge-a');
  return { p: { kind: p.kind, dna: p.dna, x: p.ox, y: p.F, z: p.oz, r: p.r }, lot: m.lot, top: m.top, ops: m.ops, level: m.level };
}, [W.pos[0], W.pos[2]]);
console.log('planned', JSON.stringify(plan));
check(plan.p && plan.p.kind === 'forge' && plan.p.dna === dnaPlaced && plan.level === true, 'a forge plan with the DNA, on a lot');
await studio.waitForTimeout(400);
await studio.screenshot({ path: '/home/claude/vr/test/shots/forge_2_placed.png', timeout: 180000 });
await sev(() => VR.StudioWorld.commit());
const stored = await sev((id) => JSON.parse(localStorage.getItem('r9si.plans.' + id)).plans.map(p => p.kind + ':' + p.status).join(','), W.id);
check(/forge:pending/.test(stored), 'handed to the game: ' + stored);
const land = await sev((id) => JSON.parse(localStorage.getItem('r9si.land.' + id) || 'null'), W.id);
check(land && land.landing && land.landing.label && /Hochhaus|🏢/.test(land.landing.label), 'the landing note names the tower: ' + JSON.stringify(land && land.landing && { label: land.landing.label, pos: land.landing.pos.map(Math.round) }));
// ---- the game (world open) rebuilds it from the DNA, in slices
let built = null, sawSlices = false;
for (let i = 0; i < 120; i++) { await gstep(20); const st = await gev((id) => ({ s: JSON.parse(localStorage.getItem('r9si.plans.' + id)).plans.map(p => p.status).join(','), slices: !!(VR.game.gadgets.blue && VR.game.gadgets.blue.slices) }), W.id); if (st.slices) sawSlices = true; built = st.s; if (!/pending/.test(built)) break; await game.waitForTimeout(100); }
check(/built/.test(built), 'the game built the plan: ' + built);
console.log('  (slices seen: ' + sawSlices + ')');
const verify = await gev(([pl, lot, top]) => {
  // the tower's cells in the world, then a walk from its door to every floor over the real blocks
  const g = VR.game, w = g.world, Fg = VR.Forge, ROT = [(u, v) => [u, v], (u, v) => [-v, u], (u, v) => [-u, -v], (u, v) => [v, -u]];
  const B = g.gadgets.blue, plan = JSON.parse(localStorage.getItem('r9si.plans.' + g.meta.id)).plans.find(p => p.id === 'forge-a');
  const bp = B.planPiece(plan); if (!bp) return { err: 'no piece' };
  let ok = 0, bad = 0, n = 0;
  for (let k = 0; k < bp.ops.length; k += 4) { const s = bp.ops[k + 3]; if (!s) continue; if (n++ % 11) continue; const q = ROT[pl.r & 3](bp.ops[k], bp.ops[k + 2]); if (w.getBlock(pl.x + q[0], pl.y + bp.ops[k + 1], pl.z + q[1]) === VR.Custom.rotState(s, pl.r & 3)) ok++; else bad++; }
  // read the built region back into a grid (lot-local, unrotated) and walk it
  const W = lot[0], D = lot[1], y0 = bp.bottom, sy = bp.top - y0 + 3, grid = { sx: W, sy, sz: D, dy: y0, blocks: new Uint16Array(W * sy * D) };
  for (let y = 0; y < sy; y++) for (let v = 0; v < D; v++) for (let u = 0; u < W; u++) { const q = ROT[pl.r & 3](u, v); grid.blocks[(y * D + v) * W + u] = w.getBlock(pl.x + q[0], pl.y + y0 + y, pl.z + q[1]); }
  const door = bp.doors && bp.doors[0];
  const wk = door ? Fg.walkable(grid, [door[0], door[1] - y0, door[2] + 1], {}) : { floors: [] };
  const meta = Fg.meta(plan.dna), P = Fg.parse(plan.dna);
  return { ok, bad, floors: wk.floors.length, want: P.params.f, reach: wk.reach ? wk.reach.size : 0, name: bp.name, slices: bp.ops.length / 4 };
}, [plan.p, plan.lot, plan.top]);
console.log('in the game:', JSON.stringify(verify));
check(verify.ok > 0 && verify.bad === 0, 'the world holds the tower cell for cell (' + verify.ok + ' ok / ' + verify.bad + ' off)');
check(verify.floors >= verify.want, 'a person walks from the door to every floor in the built tower (' + verify.floors + ' levels reached for ' + verify.want + ' floors)');
// ---- ▶ Spielen lands in front of it (the game's landing)
await gev(() => VR.game.saveMeta());
const landed = await gev(async (id) => { const g = VR.game, L = VR.Landing, o = L.read(id); return { fresh: L.fresh(o, g.meta), label: o.landing && o.landing.label, pos: o.landing && o.landing.pos.map(Math.round) }; }, W.id);
check(landed.fresh && landed.label, 'the game sees a fresh landing in front of the new tower: ' + JSON.stringify(landed));
await gev(([x, y, z, top]) => { const g = VR.game, p = g.player; p.flying = true; p.noclip = true; p.teleport(x - 30, y + top * 0.6 + 10, z - 34); p.yaw = Math.atan2(30 + 10, 34 + 10) + Math.PI; p.pitch = -0.3; g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.display = 'none'; }, [plan.p.x, plan.p.y, plan.p.z, plan.top]);
await gsettle(60); await gstep(6);
await gev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; });
await game.screenshot({ path: '/home/claude/vr/test/shots/forge_3_game.png', timeout: 180000 });
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 14)) console.log(l);
check(!logs.some(l => /pageerror/.test(l)), 'no pageerror on either page');
await browser.close(); srv.kill();
console.log(fails.length ? 'FAILED ' + fails.length : 'ALL OK');
process.exit(fails.length ? 1 : 0);
