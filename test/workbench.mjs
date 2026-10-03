// v0.35 Welt → 🧰 Werkbank end to end: the game saves a world; the Studio opens it on the Werkbank tab; a box gets
// filled, part of it replaced, copied, pasted (turned and mirrored), carved with the brush, the ground raised, undone /
// redone; every change goes to the open game as a batch and the game builds it; the Studio sees it after a reload.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const PORT = 8765 + Math.floor(Math.random() * 200);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', '/home/claude/vr/dist'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 900));
const URL0 = `http://127.0.0.1:${PORT}`;
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 1360, height: 820 } });
const logs = [];
const watch = (pg, tag) => { pg.on('pageerror', e => logs.push(`[${tag} pageerror] ` + (e.stack || e.message).slice(0, 900))); pg.on('console', m => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) logs.push(`[${tag}] ` + m.text().slice(0, 300)); }); pg.on('dialog', d => d.accept('Testbau')); };
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const game = await ctx.newPage(); watch(game, 'game');
await game.goto(URL0 + '/index.html');
const gev = (fn, a) => game.evaluate(fn, a);
const gstep = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await gev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await game.waitForTimeout(5); } };
const gsettle = async (max = 90) => { for (let i = 0; i < max; i++) { await gstep(10); const s = await gev(() => { const g = VR.game; let dirty = 0; for (const c of g.world.cols.values()) for (const sc of c.sec) if (sc.dirty || sc.pending) dirty++; return { busy: g.pool.busy, pend: g.world.pending.size, dirty }; }); if (s.busy === 0 && s.pend === 0 && s.dirty === 0 && i > 3) break; await game.waitForTimeout(60); } };
for (let i = 0; i < 120; i++) { await game.waitForTimeout(500); if (await gev(() => VR.game && VR.game.state === 'title')) break; }
await gev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 5; g.settings.horizon = 1; g.applySettings('*'); });
await gev(`VR.game.createWorld({name:'Werkwelt',mode:'creative',difficulty:'peaceful',type:'flat',seed:'31',cheats:true,kit:false})`);
for (let i = 0; i < 90; i++) { await game.waitForTimeout(1000); if (await gev(() => VR.game.state) === 'play') break; }
await gev(() => { const g = VR.game; g.zenFreezeTime = true; window.requestAnimationFrame = () => 0; });
await gsettle(60);
const W = await gev(async () => { const g = VR.game, p = g.player; await g.saveMeta(); await g.world.saveAll(); let y = Math.floor(p.pos[1]); while (y > 1 && !g.world.getBlock(Math.floor(p.pos[0]), y - 1, Math.floor(p.pos[2]))) y--; return { id: g.meta.id, pos: [Math.floor(p.pos[0]), y, Math.floor(p.pos[2])] }; });
console.log('world', JSON.stringify(W));
// ---- the Studio
const studio = await ctx.newPage(); watch(studio, 'studio');
await studio.goto(URL0 + '/studio.html');
const sev = (fn, a) => studio.evaluate(fn, a);
for (let i = 0; i < 240; i++) { await studio.waitForTimeout(500); if (await sev(() => !document.getElementById('studio').classList.contains('boot') && window.__studio && window.__studio.HOUSE.size >= 1)) break; }
await sev(() => window.__studioCore.setMode('world'));
for (let i = 0; i < 40; i++) { await studio.waitForTimeout(300); if (await sev(() => !!VR.StudioWorld.worlds)) break; }
await sev((id) => { const WM = VR.StudioWorld; WM.open(WM.worlds.find(w => w.id === id)); }, W.id);
for (let i = 0; i < 400; i++) { await studio.waitForTimeout(500); if (await sev(() => VR.StudioWorld.world && !VR.StudioWorld.loading && VR.StudioWorld.cols.size && VR.StudioWorld.wb.region === VR.StudioWorld.region)) break; }
const ui = await sev(() => ({ tab: VR.StudioWorld.tab, chip: [...document.querySelectorAll('#chips button.on')].map(b => b.textContent).join('|'), tools: document.querySelectorAll('#benchTools button').length, bar: document.querySelectorAll('#benchBar .slot').length, tiles: document.querySelectorAll('#list .tile').length }));
console.log('  ui', JSON.stringify(ui));
check(ui.tab === 'bench' && /Werkbank/.test(ui.chip) && ui.tools >= 5 && ui.bar === 9 && ui.tiles > 20, 'a world opens on the 🧰 Werkbank: tools, hotbar, blocks');
const settleStudio = async () => { await studio.waitForTimeout(400); for (let i = 0; i < 60; i++) { await studio.waitForTimeout(250); } };
// 1. fill a box 5×3×5 next to the player, replace a part, check
const P = W.pos;
const r1 = await sev((P) => {
  const WM = VR.StudioWorld, WB = WM.wb, CR = VR.Crafter, nm = (s) => s ? VR.R.types[VR.R.T.type[s]].name : 'air';
  CR.hot[0] = 'vollton_coral'; CR.hot[1] = 'vollton_mint'; CR.hot[2] = 'oak_stairs'; CR.slot = 0;
  WB.sel = { a: [P[0] + 4, P[1], P[2] + 4], b: [P[0] + 8, P[1] + 2, P[2] + 8], dy: 0 };
  WB.op('fill');
  const filled = nm(WM.getBlock(P[0] + 6, P[1] + 1, P[2] + 6));
  // replace the top layer's coral by mint
  WB.sel = { a: [P[0] + 4, P[1] + 2, P[2] + 4], b: [P[0] + 8, P[1] + 2, P[2] + 8], dy: 0 }; CR.slot = 1; WB.from = null;
  WB.op('replace');
  return { filled, top: nm(WM.getBlock(P[0] + 6, P[1] + 2, P[2] + 6)), mid: nm(WM.getBlock(P[0] + 6, P[1] + 1, P[2] + 6)), pend: VR.Edits.pending(WM.world.id).length, undo: WB.undo.length };
}, P);
console.log('  fill', JSON.stringify(r1));
check(r1.filled === 'vollton_coral' && r1.top === 'vollton_mint' && r1.mid === 'vollton_coral', 'filled a box, replaced its top layer');
// 2. copy the box (with stairs on top), paste it turned and mirrored 12 blocks east
const r2 = await sev((P) => {
  const WM = VR.StudioWorld, WB = WM.wb, CR = VR.Crafter, R = VR.R, nm = (s) => s ? R.types[R.T.type[s]].name : 'air';
  const st = R.byName.oak_stairs; WB.edit([[P[0] + 4, P[1] + 3, P[2] + 4, st.with(st.defaultState, 'facing', 1)]], 'stairs');   // facing east on a corner
  WB.sel = { a: [P[0] + 4, P[1], P[2] + 4], b: [P[0] + 8, P[1] + 3, P[2] + 8], dy: 0 };
  WB.copy(false);
  const c = WB.clip, size0 = [c.sx, c.sy, c.sz];
  WB.turnClip(c); WB.mirrorClip(c);
  WB.paste([P[0] + 16, P[1], P[2] + 4]);
  // where did the stairs go, and which way do they face
  let found = null;
  for (let y = P[1]; y < P[1] + 5; y++) for (let z = P[2] + 3; z < P[2] + 12; z++) for (let x = P[0] + 15; x < P[0] + 23; x++) { const s = WM.getBlock(x, y, z); if (s && nm(s) === 'oak_stairs') found = { x: x - P[0] - 16, y: y - P[1], z: z - P[2] - 4, f: R.types[R.T.type[s]].get(s, 'facing') }; }
  return { size0, size1: [c.sx, c.sy, c.sz], stairs: found, coral: nm(WM.getBlock(P[0] + 18, P[1] + 1, P[2] + 6)) };
}, P);
console.log('  paste', JSON.stringify(r2));
check(r2.coral === 'vollton_coral' && r2.stairs, 'copied and pasted the piece');
// turned (east → south: 2), then mirrored on x (south stays south)
check(r2.stairs && r2.stairs.f === 2 && r2.stairs.y === 3, 'the stairs turned with the piece (east → south) and kept mirrored');
// 3. undo / redo the paste
const r3 = await sev((P) => { const WM = VR.StudioWorld, WB = WM.wb, nm = (s) => s ? VR.R.types[VR.R.T.type[s]].name : 'air'; WB.undoStep(false); const a = nm(WM.getBlock(P[0] + 18, P[1] + 1, P[2] + 6)); WB.undoStep(true); const b = nm(WM.getBlock(P[0] + 18, P[1] + 1, P[2] + 6)); return { a, b }; }, P);
check(r3.a === 'air' && r3.b === 'vollton_coral', 'Strg+Z takes the paste back, Strg+Y brings it again');
// 4. the brush: raise the ground (flat world) and carve a hole into the box
const r4 = await sev((P) => {
  const WM = VR.StudioWorld, WB = WM.wb; const h0 = (x, z) => { for (let y = 200; y > 0; y--) { const s = WM.getBlock(x, y, z); if (s) return y; } return 0; };
  const gx = P[0] - 8, gz = P[2] - 8, before = h0(gx, gz);
  WB.brush = { mode: 'raise', r: 3 }; WB.stroke = { cells: new Map(), undo: new Map() };
  for (let k = 0; k < 3; k++) WB.brushAt({ x: gx, y: before, z: gz, face: 2, state: WM.getBlock(gx, before, gz) });
  WB.strokeEnd();
  const after = h0(gx, gz);
  WB.brush = { mode: 'carve', r: 1 }; WB.stroke = { cells: new Map(), undo: new Map() };
  WB.brushAt({ x: P[0] + 6, y: P[1] + 1, z: P[2] + 6, face: 2, state: WM.getBlock(P[0] + 6, P[1] + 1, P[2] + 6) }); WB.strokeEnd();
  return { before, after, hole: WM.getBlock(P[0] + 6, P[1] + 1, P[2] + 6) };
}, P);
console.log('  brush', JSON.stringify(r4));
check(r4.after === r4.before + 3 && r4.hole === 0, 'the brush raised the ground by 3 and carved the box');
// 5. the magic wand and a Bauteil
const r5 = await sev((P) => { const WM = VR.StudioWorld, WB = WM.wb; WB.wand({ x: P[0] + 4, y: P[1], z: P[2] + 4, state: WM.getBlock(P[0] + 4, P[1], P[2] + 4) }); const n = WB.mask.size; WB.copy(false); WB.libAdd(); return { n, lib: WB.libLoad().map(i => i.name + ' ' + i.sx + 'x' + i.sy + 'x' + i.sz) }; }, P);
console.log('  wand', JSON.stringify(r5));
check(r5.n > 40 && r5.lib.length === 1, 'the wand selected the coral that hangs together and it became a Bauteil');
await settleStudio();
await studio.screenshot({ path: '/home/claude/vr/test/shots/wb_1.png', timeout: 180000 });
const pend = await sev(() => VR.Edits.pending(VR.StudioWorld.world.id).length);
console.log('  batches waiting for the game:', pend);
// ---- the open game builds them
for (let i = 0; i < 60; i++) { await gstep(20); await game.waitForTimeout(100); if (await gev((id) => VR.Edits.pending(id).length === 0, W.id)) break; }
await gsettle(40);
const gm = await gev((P) => { const w = VR.game.world, nm = (s) => s ? VR.R.types[VR.R.T.type[s]].name : 'air'; return { fill: nm(w.getBlock(P[0] + 5, P[1], P[2] + 5)), top: nm(w.getBlock(P[0] + 7, P[1] + 2, P[2] + 7)), paste: nm(w.getBlock(P[0] + 18, P[1] + 1, P[2] + 6)), hole: nm(w.getBlock(P[0] + 6, P[1] + 1, P[2] + 6)), pend: VR.Edits.pending(VR.game.meta.id).length }; }, P);
console.log('  game', JSON.stringify(gm));
check(gm.pend === 0 && gm.fill === 'vollton_coral' && gm.top === 'vollton_mint' && gm.paste === 'vollton_coral' && gm.hole === 'air', 'the open game built every change');
// ---- the Studio reads the world again: the changes are there
await gev(async () => { await VR.game.world.saveAll(); });
await sev(() => { const WM = VR.StudioWorld; WM.open(WM.world); });
for (let i = 0; i < 400; i++) { await studio.waitForTimeout(500); if (await sev(() => VR.StudioWorld.world && !VR.StudioWorld.loading && VR.StudioWorld.cols.size && VR.StudioWorld.wb.region === VR.StudioWorld.region)) break; }
const again = await sev((P) => { const WM = VR.StudioWorld, nm = (s) => s ? VR.R.types[VR.R.T.type[s]].name : 'air'; return { fill: nm(WM.getBlock(P[0] + 5, P[1], P[2] + 5)), paste: nm(WM.getBlock(P[0] + 18, P[1] + 1, P[2] + 6)), pendingN: WM.wb.pendingN, tab: WM.tab }; }, P);
console.log('  reload', JSON.stringify(again));
check(again.fill === 'vollton_coral' && again.paste === 'vollton_coral' && again.pendingN === 0 && again.tab === 'bench', 'after a reload the Studio shows what the game built, nothing waits');
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 10)) console.log(l);
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
await browser.close(); srv.kill();
process.exit(fails ? 1 : 0);
