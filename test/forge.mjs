// 🏭 Forge end to end: the game creates and saves a world; the Studio opens 🏭 Forge, reads „Hochhaus 30 Stockwerke
// Glas" from the text field, builds nine variants, the first one is picked (sliders and words change it, the same wish
// brings it back), „📍 Setzen" without a world only hints, with the world open it arms the World mode's ghost, the
// tower is placed near the player and handed over; the open game rebuilds it from the DNA in slices (bottom up, one undo
// step), marks the plan built; a person walks from the door over the stairs to every floor and onto the roof in the
// built blocks; ▶ Spielen lands you in front of its entrance, looking at it — no pageerror on either page.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import http from 'http';
import fs from 'fs';
import path from 'path';
// the pages from this checkout's dist, on a port the system hands out (a stale server of another test on a fixed or
// random port would serve another branch's pages)
const DIST = '/home/claude/vr/dist', TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css' };
const srv = http.createServer((q, a) => { if (q.url === '/favicon.ico') { a.writeHead(204); a.end(); return; } const f = path.join(DIST, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html'); if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { a.writeHead(404); a.end(); return; } a.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(a); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const URL0 = `http://127.0.0.1:${srv.address().port}`;
console.log('serving', DIST, 'at', URL0);
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 1360, height: 820 }, locale: 'de-DE' });   // (the German names: „Hochhaus“)
const logs = [], fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const watch = (pg, tag) => { pg.on('pageerror', e => logs.push(`[${tag} pageerror] ` + (e.stack || e.message).slice(0, 900))); pg.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) logs.push(`[${tag}] ` + m.text().slice(0, 300)); }); };
const crashed = async (e) => { console.log('✗ crashed: ' + String(e && e.message || e).slice(0, 600)); fails.push('crash'); try { await finish(); } catch (e2) { process.exit(1); } };
process.on('unhandledRejection', crashed); process.on('uncaughtException', crashed);
const finish = async () => { console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 14)) console.log(l); check(!logs.some(l => /pageerror/.test(l)), 'no pageerror on either page'); await browser.close(); srv.close(); console.log(fails.length ? 'FAILED ' + fails.length : 'ALL OK'); process.exit(fails.length ? 1 : 0); };
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
console.log('studio', JSON.stringify(await sev(() => ({ boot: document.getElementById('studio').classList.contains('boot'), core: !!window.__studioCore, forge: !!(window.VR && VR.Forge), types: window.VR && VR.Forge ? VR.Forge.types.length : -1, sf: !!(window.VR && VR.StudioForge), nav: [...document.querySelectorAll('nav.modes button')].map(b => b.dataset.mode || '·').join(' ') }))));
const hasNav = await sev(() => !!document.querySelector('nav.modes button[data-mode="forge"]'));
check(hasNav, 'the header has a 🏭 Forge button (Profi)');
if (!hasNav) await finish();
// Einfach (the default): the mode bar waits behind Profi — ✨ Erschaffen offers 🏭 Forge (W2: the ✨ wizard opens first
// and has the 🏭 way too; without it the Erschaffen dialog's 🏭 button)
check(await sev(() => !(VR.UIPrefs && VR.UIPrefs.get().pro)), 'the Studio starts in Einfach');
await studio.click('#tiles .tile[data-tile="erschaffen"]'); await studio.waitForTimeout(800);
const viaWizard = await sev(() => !!(VR.Wizard && VR.Wizard.isOpen && VR.Wizard.isOpen()));
if (viaWizard) { await sev(() => VR.Wizard.close && VR.Wizard.close()); await studio.waitForTimeout(200); await sev(() => { const IM = VR.StudioWorld && VR.StudioWorld.imagine; if (IM && IM.open) IM.open(null, 'house'); }); await studio.waitForTimeout(600); }
check(!!(await studio.$('#imagine.on [data-forge]')), '✨ Erschaffen offers 🏭 Forge');
await studio.click('#imagine.on [data-forge]'); await studio.waitForTimeout(600);
check(await sev(() => !document.querySelector('#imagine.on')), 'the Erschaffen dialog closes on 🏭');
check(await sev(() => window.__st.mode === 'forge' && document.querySelectorAll('#chips button.fgt').length >= 10), 'Forge mode: an icon per type in the chip row (' + await sev(() => [...document.querySelectorAll('#chips button.fgt')].map(b => b.textContent.split(' ')[0]).join(' ')) + ')');
const WISH = 'Hochhaus 30 Stockwerke Glas';
const wish = async () => { const inp = await studio.$('#partsBody input.ftext'); await inp.click(); await inp.fill(WISH); await studio.keyboard.press('Enter'); await studio.waitForTimeout(400); };
check(!!(await studio.$('#partsBody input.ftext')), 'the text field „Was soll entstehen?“');
await wish();
const dna0 = await sev(() => VR.StudioForge.dna);
check(/^tower:f30/.test(dna0) && /glas/.test(dna0), 'the wish became a DNA: ' + dna0);
check(await sev(() => document.querySelectorAll('#list .fvar').length === 9), 'nine variant cards');
for (let i = 0; i < 160; i++) { await studio.waitForTimeout(500); if (await sev(() => document.querySelectorAll('#list .fvar canvas.done').length >= 9)) break; }
const done = await sev(() => document.querySelectorAll('#list .fvar canvas.done').length);
check(done >= 9, 'every variant got its picture (' + done + '/9)');
await studio.click('#list .fvar[data-i="0"]'); await studio.waitForTimeout(600);
const picked = await sev(() => ({ sel: VR.StudioForge.sel, dna: VR.StudioForge.variants[VR.StudioForge.sel], scene: window.__st.scene && window.__st.scene.type, hash: location.hash }));
check(picked.sel === 0 && picked.scene === 'clip' && /^#forge\//.test(picked.hash) && /^tower:/.test(picked.dna), 'the first variant picked, shown in the middle: ' + JSON.stringify(picked));
await studio.screenshot({ path: '/home/claude/vr/test/shots/forge_1_variants.png', timeout: 180000 });
// 🧩 Als Bauteil: the picked variant goes into the Werkbank's library (every world, every session)
const piece = await sev(async () => { const FM = VR.StudioForge, WB = VR.StudioWorld.wb; for (let i = 0; i < 100 && !(FM.meshes.get(FM.variants[FM.sel]) || {}).ready; i++) await new Promise(r => setTimeout(r, 200)); const n0 = WB.libLoad().length, ok = FM.asPiece(), items = WB.libLoad(); return { ok, n: items.length - n0, name: items[0] && items[0].name, size: items[0] && [items[0].sx, items[0].sy, items[0].sz] }; });
check(piece.ok && piece.n === 1 && /Hochhaus/.test(piece.name || ''), '🧩 Als Bauteil keeps the variant in the library: ' + JSON.stringify(piece));
// a slider rebuilds the nine (the floors), words change it, the same wish brings the same nine back
await sev(() => { const r = document.querySelector('#partsBody input[data-fp="f"]'); r.value = 8; r.dispatchEvent(new Event('input')); });
await studio.waitForTimeout(600);
const slid = await sev(() => VR.StudioForge.variants[0]);
check(/f8\b/.test(slid) && slid !== picked.dna, 'the floors slider rebuilt the variants: ' + slid);
await sev(() => VR.StudioForge.setText('mit Helipad'));
check(/c2/.test(await sev(() => VR.StudioForge.dna)) && /f8\b/.test(await sev(() => VR.StudioForge.dna)), '„mit Helipad“ tweaks the DNA and keeps the rest: ' + await sev(() => VR.StudioForge.dna));
await sev(() => VR.StudioForge.setText('höher'));
check(+(/f(\d+)/.exec(await sev(() => VR.StudioForge.dna)) || [0, 0])[1] > 8, '„höher“ adds floors: ' + await sev(() => VR.StudioForge.dna));
await wish(); await studio.click('#list .fvar[data-i="0"]'); await studio.waitForTimeout(300);
check(await sev(() => VR.StudioForge.variants[VR.StudioForge.sel]) === picked.dna, 'the same wish brings the same variants back (deterministic): ' + picked.dna);
// ---- 📍 Setzen without a world: a hint, no crash; then open the world and place it
await sev(() => VR.StudioForge.place());
check(await sev(() => window.__st.mode === 'forge'), 'without an open world 📍 Setzen stays in the Forge (a hint)');
await sev(() => window.__studioCore.setMode('world'));
for (let i = 0; i < 40; i++) { await studio.waitForTimeout(300); if (await sev(() => !!VR.StudioWorld.worlds)) break; }
await sev((id) => { const WM = VR.StudioWorld; WM.open(WM.worlds.find(w => w.id === id)); }, W.id);
for (let i = 0; i < 400; i++) { await studio.waitForTimeout(500); if (await sev(() => VR.StudioWorld.world && !VR.StudioWorld.loading && VR.StudioWorld.cols.size)) break; }
const tab0 = await sev(() => VR.StudioWorld.tab);
await sev(() => window.__studioCore.setMode('forge')); await studio.waitForTimeout(300);
await studio.click('#partsBody [data-act="fplace"]'); await studio.waitForTimeout(500);
const armed = await sev(() => ({ mode: window.__st.mode, tool: VR.StudioWorld.tool, tab: VR.StudioWorld.tab }));
check(armed.mode === 'world' && armed.tool && armed.tool.kind === 'forge' && armed.tool.dna === picked.dna, '📍 Setzen: the World mode holds the picked variant as the tool (tab ' + tab0 + ' → ' + armed.tab + '): ' + JSON.stringify(armed.tool));
if (!armed.tool) await finish();
const plan = await sev(async ([px, pz]) => {
  const WM = VR.StudioWorld, it = WM.tool;
  for (let i = 0; i < 300 && !WM.meshFor(it); i++) await new Promise(r => setTimeout(r, 200));
  const m = WM.meshFor(it); if (!m) return { err: 'no mesh' };
  const hit = WM.pickGround({ o: [px + 34.5, 400, pz + 0.5], d: [0, -1, 0] });
  const gp = WM.ghostAt(hit, it, m);
  WM.change(() => { const p = Object.assign({}, gp, { id: 'forge-a', status: 'draft', t: Date.now() }); delete p.ok; WM.plans.push(p); WM.sel = p.id; });
  WM.tool = null; WM.ghost = null; WM.refresh();
  const p = WM.plans.find(q => q.id === 'forge-a');
  { const S = window.__st, L = WM.placeOf(p, m).lot; if (S.scene) { S.scene.center = [(L[0] + L[2] + 1) / 2, p.F + m.top * 0.4, (L[1] + L[3] + 1) / 2]; S.cam.dist = m.top * 1.9 + 30; S.cam.pitch = 0.32; } }   // (the camera on the new tower)
  return { p: { kind: p.kind, dna: p.dna, x: p.ox, y: p.F, z: p.oz, r: p.r }, lot: m.lot, top: m.top, ops: m.ops, level: m.level };
}, [W.pos[0], W.pos[2]]);
console.log('planned', JSON.stringify(plan));
check(plan.p && plan.p.kind === 'forge' && plan.p.dna === picked.dna && plan.level === true, 'a forge plan with the DNA, on a lot');
await studio.waitForTimeout(400);
await studio.screenshot({ path: '/home/claude/vr/test/shots/forge_2_placed.png', timeout: 180000 });
await sev(() => VR.StudioWorld.commit());
const stored = await sev((id) => JSON.parse(localStorage.getItem('r9si.plans.' + id)).plans.map(p => p.kind + ':' + p.status).join(','), W.id);
check(/forge:pending/.test(stored), 'handed to the game: ' + stored);
const land = await sev((id) => JSON.parse(localStorage.getItem('r9si.land.' + id) || 'null'), W.id);
check(land && land.landing && land.landing.label && /Hochhaus|🏢/.test(land.landing.label), 'the landing note names the tower: ' + JSON.stringify(land && land.landing && { label: land.landing.label, pos: land.landing.pos.map(Math.round) }));
// ---- the game (world open) rebuilds it from the DNA, in slices
// (every slice the game applies is counted: how many cells, and how long the frame spent on it)
await gev(() => { const B = VR.game.gadgets.blue, orig = B.tickSlices; window.__slices = []; B.tickSlices = function (dt) { const S = this.slices, a = S ? S.at : -1, t = performance.now(); orig.call(this, dt); if (S && (this.slices !== S || S.at !== a)) window.__slices.push([S.at - a, +(performance.now() - t).toFixed(1)]); }; });
let built = null, t0 = Date.now();
for (let i = 0; i < 160; i++) { await gstep(10); built = await gev((id) => JSON.parse(localStorage.getItem('r9si.plans.' + id)).plans.map(p => p.status).join(','), W.id); if (!/pending/.test(built)) break; await game.waitForTimeout(80); }
check(/built/.test(built), 'the game built the plan: ' + built + ' (' + ((Date.now() - t0) / 1000).toFixed(0) + ' s)');
const slices = await gev(() => window.__slices);
check(slices.length >= 3 && slices.every(s => s[0] <= 8000), 'in slices, bottom up, at most 8 000 cells per tick: ' + slices.length + ' slices · ' + JSON.stringify(slices.slice(0, 8)));
const verify = await gev(([pl, lot]) => {
  // the tower's cells in the world, then a walk from its door over the stairs to every floor and onto the roof
  const g = VR.game, w = g.world, Fg = VR.Forge, ROT = [(u, v) => [u, v], (u, v) => [-v, u], (u, v) => [-u, -v], (u, v) => [v, -u]];
  const B = g.gadgets.blue, plan = JSON.parse(localStorage.getItem('r9si.plans.' + g.meta.id)).plans.find(p => p.id === 'forge-a');
  const bp = B.planPiece(plan); if (!bp) return { err: 'no piece' };
  let ok = 0, bad = 0, n = 0;
  for (let k = 0; k < bp.ops.length; k += 4) { const s = bp.ops[k + 3]; if (!s) continue; if (n++ % 7) continue; const q = ROT[pl.r & 3](bp.ops[k], bp.ops[k + 2]); if (w.getBlock(pl.x + q[0], pl.y + bp.ops[k + 1], pl.z + q[1]) === VR.Custom.rotState(s, pl.r & 3)) ok++; else bad++; }
  // read the built region back into a grid (lot-local, unrotated) and walk it
  const W = lot[0], D = lot[1], y0 = bp.bottom, sy = bp.top - y0 + 3, grid = { sx: W, sy, sz: D, dy: y0, blocks: new Uint16Array(W * sy * D) };
  for (let y = 0; y < sy; y++) for (let v = 0; v < D; v++) for (let u = 0; u < W; u++) { const q = ROT[pl.r & 3](u, v); grid.blocks[(y * D + v) * W + u] = w.getBlock(pl.x + q[0], pl.y + y0 + y, pl.z + q[1]); }
  const door = bp.doors && bp.doors[0];
  const wk = door ? Fg.walkable(grid, [door[0], -y0, 0], {}) : { floors: [] };   // from the street at the lot's front edge
  const want = (bp.floors || []).concat(bp.roof !== null && bp.roof !== undefined ? [bp.roof] : []).map(f => f - y0 + 1);
  const hit = want.filter(y => wk.floors.includes(y));
  return { ok, bad, floors: hit.length, want: want.length, roof: bp.roof !== null && wk.floors.includes(bp.roof - y0 + 1), reach: wk.reach ? wk.reach.size : 0, name: bp.name, cells: bp.ops.length / 4 };
}, [plan.p, plan.lot]);
console.log('in the game:', JSON.stringify(verify));
check(verify.ok > 0 && verify.bad === 0, 'the world holds the tower cell for cell (' + verify.ok + ' ok / ' + verify.bad + ' off)');
check(verify.want > 20 && verify.floors === verify.want && verify.roof, 'a person walks in from the street, over the stairs to every floor and onto the roof of the built tower (' + verify.floors + '/' + verify.want + ' levels, roof ' + verify.roof + ')');
// one Z takes the whole tower back, another build puts it there again (the slices are one undo step)
const undo = await gev(([pl]) => { const g = VR.game, before = g.world.getBlock(pl.x, pl.y + 10, pl.z + 10); const n = g.gadgets.wand.undo.length; return { n, top: g.gadgets.wand.undo[n - 1] ? g.gadgets.wand.undo[n - 1].length : 0, before }; }, [plan.p]);
check(undo.top > 16000, 'the slices left one undo step for the whole tower (' + undo.top + ' cells)');
// ---- ▶ Spielen: the landing is in front of its entrance, looking at it
const FRONT = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const landed = await gev(([pl, lot, top]) => {
  const g = VR.game, p = g.player; g.meta.seenLanding = 0;
  const r = g.landOnEntry('overlay', false);
  const ROT = [(u, v) => [u, v], (u, v) => [-v, u], (u, v) => [-u, -v], (u, v) => [v, -u]];
  const c = ROT[pl.r & 3]((lot[0] - 1) / 2, (lot[1] - 1) / 2), cx = pl.x + c[0] + 0.5, cz = pl.z + c[1] + 0.5;
  return { r, pos: p.pos.map(v => +v.toFixed(1)), yaw: +p.yaw.toFixed(2), dx: p.pos[0] - cx, dz: p.pos[2] - cz, look: [-Math.sin(p.yaw), -Math.cos(p.yaw)] };
}, [plan.p, plan.lot, plan.top]);
const fr = FRONT[plan.p.r & 3], along = landed.dx * fr[0] + landed.dz * fr[1], dist = Math.hypot(landed.dx, landed.dz), facing = -(landed.look[0] * landed.dx + landed.look[1] * landed.dz) / Math.max(1, dist);
check(landed.r === 'new' && along > plan.lot[1] / 2 && dist < 60 && facing > 0.7, '▶ lands you in front of the entrance, looking at the tower: ' + JSON.stringify({ r: landed.r, pos: landed.pos, along: +along.toFixed(1), dist: +dist.toFixed(1), facing: +facing.toFixed(2) }));
await gsettle(60); await gstep(6);
await gev(() => { window.__norender = false; const g = VR.game; g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.display = 'none'; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; });
await game.screenshot({ path: '/home/claude/vr/test/shots/forge_3_landing.png', timeout: 180000 });
// the whole tower from a little further out
await gev(([pl, lot, top]) => {
  const g = VR.game, p = g.player, r = pl.r & 3, f = [[0, -1], [1, 0], [0, 1], [-1, 0]][r], ROT = [(u, v) => [u, v], (u, v) => [-v, u], (u, v) => [-u, -v], (u, v) => [v, -u]];
  const c = ROT[r]((lot[0] - 1) / 2, (lot[1] - 1) / 2), cx = pl.x + c[0] + 0.5, cz = pl.z + c[1] + 0.5, side = [f[1], -f[0]], d = top * 0.78 + 16;
  g.settings.renderDist = 9; g.applySettings('*');
  p.flying = true; p.noclip = true; p.teleport(cx + f[0] * d + side[0] * d * 0.45, pl.y + top * 0.42, cz + f[1] * d + side[1] * d * 0.45);
  p.yaw = Math.atan2(-(cx - p.pos[0]), -(cz - p.pos[2])); p.pitch = 0.02;
}, [plan.p, plan.lot, plan.top]);
await gsettle(60); await gstep(6);
await gev(() => { window.__norender = false; const g = VR.game; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; });
await game.screenshot({ path: '/home/claude/vr/test/shots/forge_3_game.png', timeout: 180000 });
await finish();
