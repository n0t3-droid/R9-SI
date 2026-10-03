// v0.37 🏘 Ort planen end to end on natural terrain, planned right here (no Claude): the Studio surveys the piece of the
// world in view (heights, water, trees) and draws it as a map; 🎲 plans a village by chance; a wish (six houses with red
// roofs around a market square, a church, fields with a fence, a campfire, cobbled paths) is planned and laid out to
// fit the ground; ✏️ Ändern adds to the wish ("ohne Kirche, mehr Häuser") on the same seed; ✓ Bauen levels the
// ground and builds it all as one Werkbank step; the open game builds it; ⟲ takes it back.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
import fs from 'fs';
const PORT = 8765 + Math.floor(Math.random() * 200);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', '/home/claude/vr/dist'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 900));
const URL0 = `http://127.0.0.1:${PORT}`;
const src = fs.readFileSync('/home/claude/vr/test/house_genie.mjs', 'utf8');
const MOCK = src.match(/const MOCK = `([\s\S]*?)`;/)[1];
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 1360, height: 860 } });
const logs = [];
const watch = (pg, tag) => { pg.on('pageerror', e => logs.push(`[${tag} pageerror] ` + (e.stack || e.message).slice(0, 900))); pg.on('console', m => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) logs.push(`[${tag}] ` + m.text().slice(0, 300)); }); pg.on('dialog', d => d.accept('x')); };
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
// ---- the game: a natural world
const game = await ctx.newPage(); watch(game, 'game');
await game.goto(URL0 + '/index.html');
const gev = (fn, a) => game.evaluate(fn, a);
const gstep = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await gev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await game.waitForTimeout(5); } };
const gsettle = async (max = 90) => { for (let i = 0; i < max; i++) { await gstep(10); const s = await gev(() => { const g = VR.game; let dirty = 0; for (const c of g.world.cols.values()) for (const sc of c.sec) if (sc.dirty || sc.pending) dirty++; return { busy: g.pool.busy, pend: g.world.pending.size, dirty }; }); if (s.busy === 0 && s.pend === 0 && s.dirty === 0 && i > 3) break; await game.waitForTimeout(60); } };
for (let i = 0; i < 120; i++) { await game.waitForTimeout(500); if (await gev(() => VR.game && VR.game.state === 'title')) break; }
await gev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 5; g.settings.horizon = 1; g.applySettings('*'); });
await gev(`VR.game.createWorld({name:'Ortswelt',mode:'creative',difficulty:'peaceful',seed:'1207',cheats:true,kit:false})`);
for (let i = 0; i < 120; i++) { await game.waitForTimeout(1000); if (await gev(() => VR.game.state) === 'play') break; }
await gev(() => { const g = VR.game; g.zenFreezeTime = true; window.requestAnimationFrame = () => 0; });
await gsettle(60);
const W = await gev(async () => { const g = VR.game, p = g.player; await g.saveMeta(); await g.world.saveAll(); return { id: g.meta.id, pos: p.pos.map(Math.floor) }; });
console.log('world', JSON.stringify(W));
// ---- the Studio (the page offers downloads only)
const studio = await ctx.newPage(); watch(studio, 'studio');
await studio.addInitScript(MOCK);
await studio.goto(URL0 + '/studio.html');
const sev = (fn, a) => studio.evaluate(fn, a);
for (let i = 0; i < 240; i++) { await studio.waitForTimeout(500); if (await sev(() => !document.getElementById('studio').classList.contains('boot') && window.__studio && VR.BlockColors && VR.BlockColors.ready())) break; }
await sev(() => window.__studioCore.setMode('world'));
for (let i = 0; i < 40; i++) { await studio.waitForTimeout(300); if (await sev(() => !!VR.StudioWorld.worlds)) break; }
await sev((id) => { const WM = VR.StudioWorld; WM.open(WM.worlds.find(w => w.id === id)); }, W.id);
for (let i = 0; i < 400; i++) { await studio.waitForTimeout(500); if (await sev(() => VR.StudioWorld.world && !VR.StudioWorld.loading && VR.StudioWorld.cols.size && VR.StudioWorld.wb.region === VR.StudioWorld.region && VR.StudioWorld.imagine.aiOK)) break; }
// 1. the survey and the map
const s1 = await sev(async () => {
  const IM = VR.StudioWorld.imagine, SITE = VR.StudioWorld.site;
  SITE.size = 64; IM.open(null, 'site');
  await new Promise(r => setTimeout(r, 400));
  const cv = document.getElementById('imPrev'), d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let lit = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 60) lit++;
  const sv = SITE.sv, kinds = {}; for (const k of sv.kind) kinds['gswrtbi'[k]] = (kinds['gswrtbi'[k]] || 0) + 1;
  return { names: sv.names, tab: !!document.querySelector('.imModes [data-mode="site"].on'), area: SITE.area, base: sv.base, max: sv.max, kinds, lit, btns: [...document.querySelectorAll('.imLeft .imActs button')].map(b => b.textContent.trim()).filter(t => /Ort|Dorf/.test(t)), chips: document.querySelectorAll('.imLeft [data-schip]').length };
});
console.log('  survey', JSON.stringify(s1));
check(s1.tab && s1.area && s1.area.w === 64 && s1.area.d === 64 && s1.lit > 20000, '🏘 Ort: the 64 × 64 piece in view is surveyed and drawn as a map');
check(s1.btns.length === 2 && s1.chips >= 4 && Object.keys(s1.kinds).length >= 1, '✨ Ort planen, 🎲 Dorf würfeln and ideas to click are offered (' + JSON.stringify(s1.kinds) + ')');
// 1b. the selection as the area: the most natural 64 × 64 piece of the loaded region (this seed spawns at a temple)
const best = await sev(async () => {
  const WM = VR.StudioWorld, box = WM.regionBox(); let best = null;
  for (let z0 = box[2] + 4; z0 + 64 <= box[5] - 4; z0 += 8) for (let x0 = box[0] + 4; x0 + 64 <= box[3] - 4; x0 += 8) {
    let nat = 0, lo = 1e9, hi = -1e9;
    for (let z = z0; z < z0 + 64; z += 4) for (let x = x0; x < x0 + 64; x += 4) { const g = WM.groundAt(x, z) - 1, n = VR.R.types[VR.R.T.type[WM.getBlock(x, g, z)]].name; if (/^(grass_block|dirt|sand|gravel|snow_block|podzol|coarse_dirt|water)$/.test(n)) nat++; lo = Math.min(lo, g); hi = Math.max(hi, g); }
    const sc = nat - (hi - lo) * 2; if (!best || sc > best.sc) best = { x0, z0, sc, nat, range: hi - lo };
  }
  WM.wb.sel = { a: [best.x0, 60, best.z0], b: [best.x0 + 63, 60, best.z0 + 63], dy: 0 };
  WM.imagine.open(null, 'site'); await new Promise(r => setTimeout(r, 200));
  const b = document.querySelector('[data-ssize="sel"]'); if (b) b.click(); await new Promise(r => setTimeout(r, 400));
  const SITE = WM.site, kinds = {}; for (const k of SITE.sv.kind) kinds['gswrtbi'[k]] = (kinds['gswrtbi'[k]] || 0) + 1;
  return Object.assign(best, { sel: !!b, area: SITE.area, kinds, names: SITE.sv.names.slice(0, 6) });
});
console.log('  selection', JSON.stringify(best));
check(best.sel && best.area.x0 === best.x0 && best.area.w === 64, '▣ Auswahl: the Werkbank selection becomes the area');
// 2. 🎲 a village by chance
const s2 = await sev(async () => {
  const SITE = VR.StudioWorld.site;
  document.getElementById('stRnd').click(); await new Promise(r => setTimeout(r, 300));
  return { houses: SITE.plan.houses.length, placed: SITE.placed.houses.length, skipped: SITE.placed.skipped.length, paths: SITE.plan.paths.length, trees: SITE.plan.trees.length, styles: [...new Set(SITE.plan.houses.map(h => h.spec.style))], build: !document.getElementById('stBuild').disabled, list: document.querySelectorAll('.stHouses span').length };
});
console.log('  random', JSON.stringify(s2));
check(s2.houses >= 3 && s2.placed >= 2 && s2.paths >= 3 && s2.styles.length === 1 && s2.build && s2.list === s2.placed, '🎲 a village of one style around a plaza, laid out on the ground (' + s2.placed + ' of ' + s2.houses + ' houses fit)');
// 3. a wish: six houses with red roofs around a market square, a church, fields with a fence, a campfire, cobbles
const WISH = 'Dorf „Lindenhof“ mit Marktplatz, Kirche, Feldern mit Zaun, Lagerfeuer und Laternen, sechs Häuser mit roten Dächern, Kopfsteinpflaster';
const s3 = await sev(async (WISH) => {
  const SITE = VR.StudioWorld.site;
  const tx = document.getElementById('stText'); tx.value = WISH; tx.dispatchEvent(new Event('input'));
  document.getElementById('stGo').click();
  for (let i = 0; i < 60; i++) { await new Promise(r => setTimeout(r, 150)); if (SITE.plan && SITE.plan.name === 'Lindenhof') break; }
  const P = SITE.plan;
  return { name: P.name, notes: P.notes, houses: P.houses.length, roofs: [...new Set(P.houses.map(h => h.spec.roof.color))], placed: SITE.placed.houses.map(h => [h.label, h.rot, h.F]), models: SITE.placed.models.map(m => m.label), skipped: SITE.placed.skipped, paths: [...new Set(P.paths.map(p => p.material))], areas: P.areas.map(a => a.material), props: [...new Set(P.props.map(p => p.kind))], status: document.getElementById('gnStatus').textContent };
}, WISH);
console.log('  plan', JSON.stringify(s3));
check(s3.name === 'Lindenhof' && s3.houses === 6 && s3.roofs.length === 1 && s3.roofs[0] === '#c0392b' && s3.paths.join() === 'cobble', 'the wish is read: “Lindenhof”, six houses, all with red roofs, cobbled paths');
check(s3.placed.length >= 3 && s3.models.includes('Kirche') && s3.areas.includes('field') && ['market', 'campfire', 'fence', 'lamp', 'bench'].every(k => s3.props.includes(k)) && /✓/.test(s3.status), 'laid out on the ground: ' + s3.placed.length + ' houses, ' + s3.models.join(', ') + ', fields with a fence, market stalls, a campfire, lamps, benches');
// 4. ✏️ Ändern adds to the wish (same seed): without the church, more houses, a new name
const s4 = await sev(async () => {
  const SITE = VR.StudioWorld.site, seed0 = SITE.plan.seed, n0 = SITE.plan.houses.length;
  const tx = document.getElementById('stText'); tx.value = 'ohne Kirche, mehr Häuser, Name „Lindenhof am See“'; tx.dispatchEvent(new Event('input'));
  document.getElementById('stEdit').click();
  for (let i = 0; i < 60; i++) { await new Promise(r => setTimeout(r, 150)); if (SITE.plan && SITE.plan.name === 'Lindenhof am See') break; }
  return { name: SITE.plan.name, church: SITE.plan.models.some(m => /Kirche/.test(m.model.name)), n0, n: SITE.plan.houses.length, seed: SITE.plan.seed === seed0, roofs: [...new Set(SITE.plan.houses.map(h => h.spec.roof.color))], hist: SITE.hist.length, back: !!document.getElementById('stBack') };
});
console.log('  change', JSON.stringify(s4));
check(s4.name === 'Lindenhof am See' && !s4.church && s4.n > s4.n0 && s4.seed && s4.roofs.join() === '#c0392b' && s4.hist >= 2 && s4.back, '✏️ Ändern: no church, more houses (' + s4.n0 + ' → ' + s4.n + '), the red roofs stay, same seed, ⟲ keeps the old plans');
// 5. ✓ Bauen: one Werkbank step, the ground levelled, the doors where the layout put them
const s5 = await sev(async () => {
  const WM = VR.StudioWorld, SITE = WM.site, WB = WM.wb, A = SITE.area, nm = (s) => (s ? VR.R.types[VR.R.T.type[s]].name : 'air');
  const undo0 = WB.undo.length;
  const placed = SITE.placed.houses.map(h => { const g = h.g; let door = null; for (let y = 0; y < g.sy && !door; y++) for (let z = 0; z < g.sz && !door; z++) for (let x = 0; x < g.sx; x++) { const s = g.blocks[(y * g.sz + z) * g.sx + x]; if (s !== 0xffff && s && /_door$|^door_/.test(nm(s))) { door = [A.x0 + h.X0 + x, h.F + g.origin[1] + y, A.z0 + h.Z0 + z]; break; } } return { label: h.label, F: h.F, door }; });
  document.getElementById('stBuild').click();
  await new Promise(r => setTimeout(r, 600));
  const out = { undo: WB.undo.length - undo0, label: WB.undo.length ? WB.undo[WB.undo.length - 1].label : '', n: WB.undo.length ? WB.undo[WB.undo.length - 1].list.length : 0, closed: !document.getElementById('imagine').classList.contains('on'), houses: [] };
  for (const p of placed) out.houses.push({ label: p.label, door: p.door, at: p.door ? nm(WM.getBlock(p.door[0], p.door[1], p.door[2])) : null, floorOk: p.door ? p.door[1] === p.F + 1 : false });
  // every front door opens onto something walkable that leads somewhere: a path, the plaza, a porch
  const D4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  out.fronts = SITE.placed.houses.filter(h => h.door).map(h => { const f = [h.door[0] + D4[h.rot][0], h.door[1] + D4[h.rot][1]], x = A.x0 + f[0], z = A.z0 + f[1]; return nm(WM.getBlock(x, h.F, z)); });
  // things that should now stand in the world
  const cnt = {}; for (const c of WB.undo[WB.undo.length - 1].list) { const n = nm(c[3]); cnt[n] = (cnt[n] || 0) + 1; }
  out.has = ['vx_well', 'vx_fountain', 'cobblestone', 'dirt_path', 'farmland', 'spruce_planks', 'oak_log', 'vm_bench', 'vx_veg_crate', 'campfire', 'oak_fence', 'hay_block', 'lantern'].filter(n => cnt[n]);
  return out;
});
console.log('  build', JSON.stringify(s5));
check(s5.undo === 1 && /Lindenhof/.test(s5.label) && s5.n > 3000 && s5.closed, '✓ Bauen: the whole place is ONE Werkbank step (' + s5.n + ' blocks)');
check(s5.houses.length >= 3 && s5.houses.every(h => h.door && /_door$|^door_/.test(h.at) && h.floorOk), 'every house stands with its door on its levelled floor: ' + s5.houses.map(h => h.label + ':' + h.at).join(', '));
check(s5.has.length >= 7, 'the plaza, paths, field, trees and props are built: ' + s5.has.join(' '));
check(s5.fronts.length >= 3 && s5.fronts.every(n => /path|cobble|gravel|paver|stone_bricks|planks|travertine|sand/.test(n)), 'every front door opens onto a path, the plaza or a porch: ' + s5.fronts.join(', '));
// 6. the open game builds it
await gsettle(40);
const d0 = s5.houses.find(h => h.door).door;
for (let i = 0; i < 60; i++) { await gstep(10); const ok = await gev((d) => { const b = VR.game.world.getBlock(d[0], d[1], d[2]); return b && /_door$|^door_/.test(VR.R.types[VR.R.T.type[b]].name); }, d0); if (ok) break; await game.waitForTimeout(250); }
const inGame = await gev((d) => { const b = VR.game.world.getBlock(d[0], d[1], d[2]); return b ? VR.R.types[VR.R.T.type[b]].name : 'air'; }, d0);
check(/_door$|^door_/.test(inGame), 'the game builds the place (a door at ' + d0.join(',') + ': ' + inGame + ')');
// 7. ⟲ takes it all back
const s7 = await sev(async (d0) => { const WM = VR.StudioWorld; WM.wb.undoStep(false); await new Promise(r => setTimeout(r, 400)); const s = WM.getBlock(d0[0], d0[1], d0[2]); return s ? VR.R.types[VR.R.T.type[s]].name : 'air'; }, d0);
check(!/_door$|^door_/.test(s7), '⟲ Zurück takes the whole place away again (' + s7 + ')');
await studio.screenshot({ path: '/home/claude/vr/test/shots/site_after.png' });
// 8. 🕘 Weitermachen: the place and the world are projects, and come back from the list
await sev(() => { VR.StudioWorld.imagine.close(); window.__st.cam.yaw = 0.9; window.__studioCore.setMode('arch'); });
const s8 = await sev(() => { const items = Object.values(JSON.parse(localStorage.getItem('r9si.projects') || '{"items":{}}').items); const site = items.filter(p => p.kind === 'site'), world = items.find(p => p.kind === 'world'); return { site: site.map(p => ({ id: p.id, name: p.name, built: p.built, area: p.ref && p.ref.area, thumb: !!localStorage.getItem('r9si.thumb.' + p.id) })), world: world ? { id: world.id, name: world.name, yaw: world.view && world.view.yaw, thumb: !!localStorage.getItem('r9si.thumb.' + world.id) } : null }; });
console.log('  projects', JSON.stringify(s8));
check(s8.site.length === 1 && s8.site[0].name === 'Lindenhof am See' && s8.site[0].built && s8.site[0].thumb, '🕘: the planned place is one project (dice, plan and change on the same spot), built, with its map');
check(s8.world && s8.world.id === 'w:' + W.id && s8.world.yaw === 0.9 && s8.world.thumb, '🕘: the world you worked in is a project with its view and a picture');
const s8b = await sev(async (id) => { VR.Projects.open(id); const WM = VR.StudioWorld; for (let i = 0; i < 150; i++) { await new Promise(r => setTimeout(r, 200)); if (document.getElementById('imagine').classList.contains('on') && WM.imagine.mode === 'site') break; } const SITE = WM.site; return { mode: window.__st.mode, dlg: WM.imagine.mode, name: SITE.plan && SITE.plan.name, area: SITE.area, houses: SITE.placed && SITE.placed.houses.length, status: SITE.status, hist: SITE.hist.length }; }, s8.site[0].id);
console.log('  reopen place', JSON.stringify(s8b));
check(s8b.mode === 'world' && s8b.dlg === 'site' && s8b.name === 'Lindenhof am See' && s8b.area && s8b.area.x0 === s8.site[0].area.x0 && s8b.area.z0 === s8.site[0].area.z0 && s8b.houses >= 3 && s8b.hist >= 1, 'one click: the world opens, the place dialog shows the plan on the same spot (with ⟲)');
await studio.screenshot({ path: '/home/claude/vr/test/shots/site_reopen.png' });
await sev(() => { VR.StudioWorld.imagine.close(); window.__st.cam.yaw = 1.7; window.__studioCore.setMode('arch'); });
const s8c = await sev(async (id) => { VR.Projects.open(id); for (let i = 0; i < 80; i++) { await new Promise(r => setTimeout(r, 200)); if (window.__st.mode === 'world' && VR.StudioWorld.world && Math.abs(window.__st.cam.yaw - 1.7) < 1e-6) break; } return { mode: window.__st.mode, world: VR.StudioWorld.world && VR.StudioWorld.world.id, yaw: window.__st.cam.yaw }; }, s8.world.id);
check(s8c.mode === 'world' && s8c.world === W.id && Math.abs(s8c.yaw - 1.7) < 1e-6, 'the world from 🕘: same world, the view as left');
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 20)) console.log(l);
check(!logs.some(l => /pageerror/.test(l)), 'no page errors');
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
await browser.close(); srv.kill();
process.exit(fails ? 1 : 0);
