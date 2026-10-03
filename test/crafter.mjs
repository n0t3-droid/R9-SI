// R9 Studio Crafter: open a catalogue house, build with game items through the real mouse path (pick → place / break),
// Update ins Spiel → localStorage, the item voxel editor (recolour + Update), then the game page reads the designs
// and its villa builder lays the edits onto the generated house.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--allow-file-access-from-files'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 860 } });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { if (m.type() === 'error' || /error|fail/i.test(m.text())) logs.push(m.text().slice(0, 400)); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 900)));
await page.goto('file:///home/claude/vr/dist/studio.html');
const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
const t0 = Date.now();
await ev(() => { try { localStorage.removeItem('r9si.studio'); } catch (e) { /* */ } });
for (let i = 0; i < 240; i++) { await wait(500); const s = await ev(() => ({ boot: document.getElementById('studio').classList.contains('boot'), houses: window.__studio ? window.__studio.HOUSE.size : -1 })); if (!s.boot && s.houses >= 2) break; }
console.log('studio up after', ((Date.now() - t0) / 1000).toFixed(1), 's');
// ---- house crafter on house 0
await ev(() => window.__studio.selectHouse(0)); await wait(500);
await ev(() => window.__studioCore.setMode('craft'));
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => !!(VR.Crafter.house && VR.Crafter.gpu))) break; }
const info = await ev(() => { const h = VR.Crafter.house; return { name: h.name, dims: [h.sx, h.sy, h.sz], F: h.F, lot: h.lot, sections: VR.Crafter.gpu.size }; });
console.log('crafter open', JSON.stringify(info));
await wait(600);
await page.screenshot({ path: '/home/claude/vr/test/shots/cr_1_open.png' });
// the real mouse path: look at the lot from above, hover the centre of the view, place with the right button
const view = await page.$('#view'); const box = await view.boundingBox();
const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
await ev(() => { const S = window.__st; S.cam.pitch = 1.2; S.cam.yaw = 0.3; });
await page.mouse.move(cx, cy); await wait(200); await page.mouse.move(cx + 2, cy + 1); await wait(200);
const hover1 = await ev(() => { const h = VR.Crafter.hover; return h ? { x: h.x, y: h.y, z: h.z, face: h.face, s: VR.R.types[VR.R.T.type[h.state]] ? VR.R.types[VR.R.T.type[h.state]].name : 0 } : null; });
console.log('hover', JSON.stringify(hover1));
await ev(() => { VR.Crafter.hot[0] = 'vollton_coral'; VR.Crafter.slot = 0; });
await page.mouse.down({ button: 'right' }); await page.mouse.up({ button: 'right' }); await wait(1200);
const after1 = await ev(() => { const h = VR.Crafter.house; let n = 0; for (let i = 0; i < h.blocks.length; i++) if (h.blocks[i] !== h.base[i]) n++; return n; });
console.log('changes after one right click:', after1);
// a little Vollton pavilion in the garden + a panorama window + a modern door, through the crafter's change path
await ev(() => {
  const C = VR.Crafter, h = C.house, R = VR.R, st = (n, p) => { const t = R.byName[n]; return p ? t.state(Object.assign(t.decode(t.defaultState), p)) : t.defaultState; };
  const L = [], x0 = h.pad + 1, z0 = h.pad + h.lot[1] - 7, y0 = h.F;
  for (let x = 0; x < 6; x++) for (let z = 0; z < 5; z++) for (let y = 0; y < 4; y++) {
    const edge = x === 0 || z === 0 || x === 5 || z === 4; if (!edge && y < 3) continue;
    let s = st(y === 3 ? 'vollton_graphite' : 'vollton_coral');
    if (z === 0 && y >= 1 && y <= 2 && x >= 1 && x <= 4) s = st('panorama_black');
    L.push([x0 + x, y0 + y, z0 + z, s]);
  }
  L.push([x0 + 5, y0, z0 + 2, st('door_glass_black', { facing: 1, half: 0 })], [x0 + 5, y0 + 1, z0 + 2, st('door_glass_black', { facing: 1, half: 1 })]);
  // a tower to prove the grid grows: 40 blocks of gloss
  for (let y = 0; y < 40; y++) L.push([x0 + 2, y0 + 4 + y, z0 + 2, st('vollton_cobalt_gloss')]);
  C.applyChanges(L);
});
for (let i = 0; i < 60; i++) { await wait(500); if (await ev(() => !document.querySelector('#hudMeta') || true)) { const busy = await ev(() => VR.Crafter.house.sy); if (busy > 40) break; } }
await wait(2500);
console.log('grid height now', await ev(() => VR.Crafter.house.sy), '· hud:', await ev(() => document.getElementById('hudMeta').textContent));
await ev(() => { const S = window.__st; S.cam.pitch = 0.35; S.cam.yaw = 2.6; S.cam.dist = 0; });
await wait(800);
await page.screenshot({ path: '/home/claude/vr/test/shots/cr_2_built.png' });
// break with the left button where the mouse is
await page.mouse.move(cx, cy); await wait(150); await page.mouse.move(cx + 1, cy); await wait(150);
const hb = await ev(() => { const h = VR.Crafter.hover; return h ? [h.x, h.y, h.z, h.ground ? 'ground' : VR.R.types[VR.R.T.type[h.state]].name] : null; });
await page.mouse.down({ button: 'left' }); await page.mouse.up({ button: 'left' }); await wait(1000);
console.log('left click on', JSON.stringify(hb), '→ block now', await ev((p) => p ? VR.Crafter.house.blocks[(p[1] * VR.Crafter.house.sz + p[2]) * VR.Crafter.house.sx + p[0]] : -1, hb));
// undo + redo
await page.keyboard.press('Control+z'); await wait(800); await page.keyboard.press('Control+y'); await wait(800);
// the area tool: a 7×4×5 box of walls in the garden (corners on the lawn, raised by 3), then a clear through a model
const area = await ev(() => {
  const C = VR.Crafter, h = C.house, before = (() => { let n = 0; for (let i = 0; i < h.blocks.length; i++) if (h.blocks[i] !== h.base[i]) n++; return n; })();
  C.toggleArea(true);
  const x0 = h.pad + h.lot[0] - 10, z0 = h.pad + h.lot[1] - 8;
  C.area = { a: [x0, h.F - 1, z0], b: [x0 + 6, h.F - 1, z0 + 4], dy: 4 };
  C.hot[C.slot] = 'vollton_sage';
  C.areaApply('walls');
  const after = (() => { let n = 0; for (let i = 0; i < h.blocks.length; i++) if (h.blocks[i] !== h.base[i]) n++; return n; })();
  const id = (x, y, z) => h.blocks[(y * h.sz + z) * h.sx + x], nm = (s) => s ? VR.R.types[VR.R.T.type[s]].name : 'air';
  const probe = [nm(id(x0, h.F + 2, z0)), nm(id(x0 + 3, h.F + 2, z0 + 2)), nm(id(x0 + 6, h.F + 3, z0 + 4))];
  // clear a box that cuts through the living-room sofa: the whole sofa goes
  let sofa = null; for (let i = 0; i < h.blocks.length && !sofa; i++) { const s = h.blocks[i]; if (s && /sofa/.test(nm(s))) sofa = [i % h.sx, Math.floor(i / (h.sx * h.sz)), Math.floor(i / h.sx) % h.sz, nm(s)]; }
  let left = -1;
  let had = 0, fp = 0;
  if (sofa) { for (let i = 0; i < h.blocks.length; i++) if (h.blocks[i] && nm(h.blocks[i]) === sofa[3]) had++; const st = id(sofa[0], sofa[1], sofa[2]), t = VR.R.types[VR.R.T.type[st]]; fp = VR.VM.footprint(VR.VM.MODELS[t.name], t.get(st, 'facing')).length; window.__dbg = { kind: t.o.kind, has: !!VR.VM.MODELS[t.name], part: t.get(st, 'part'), facing: t.get(st, 'facing'), fp: VR.VM.footprint(VR.VM.MODELS[t.name], t.get(st, 'facing')), partners: C.partners(sofa[0], sofa[1], sofa[2], st), at: sofa.slice(0, 3) }; C.area = { a: [sofa[0], sofa[1], sofa[2]], b: [sofa[0], sofa[1], sofa[2]], dy: 0 }; C.areaApply('clear'); left = 0; for (let i = 0; i < h.blocks.length; i++) if (h.blocks[i] && nm(h.blocks[i]) === sofa[3]) left++; }
  void had;
  C.toggleArea(false);
  return { before, after, walls: after - before, probe, sofa: sofa && sofa[3], sofaCells: had, footprint: fp, sofaCellsLeft: left, wholeSofaGone: had - left === fp };
});
console.log('area tool:', JSON.stringify(area));
console.log('dbg', JSON.stringify(await ev(() => window.__dbg)));
await wait(1500);
await page.screenshot({ path: '/home/claude/vr/test/shots/cr_2b_area.png' });
// Update ins Spiel
await ev(() => VR.Crafter.update.house()); await wait(1500);
const saved = await ev(() => { const d = JSON.parse(localStorage.getItem('r9si.studio') || '{}'); const h = d.houses && d.houses[0]; return h ? { v: h.v, name: h.name, changed: h.n, box: h.tpl && h.tpl.box, states: h.tpl && h.tpl.pal.length, kb: +(JSON.stringify(h).length / 1024).toFixed(1), top: h.top, skin: h.skin } : null; });
console.log('saved house design:', JSON.stringify(saved));
await page.screenshot({ path: '/home/claude/vr/test/shots/cr_3_updated.png' });
// ---- item crafter: recolour the fabric of a sofa
const sofa = await ev(() => Object.keys(VR.VM.MODELS).find(n => /sofa/.test(n)));
await ev((n) => { window.__studioCore.setMode('furn'); window.__studio.selectModel(n); }, sofa); await wait(800);
await ev(() => window.__studioCore.setMode('craft')); await wait(1500);
console.log('item crafter', await ev(() => VR.Crafter.item ? VR.Crafter.item.display + ' ' + VR.Crafter.item.VW + 'x' + VR.Crafter.item.VH + 'x' + VR.Crafter.item.VD : 'none'));
await page.mouse.move(cx, cy); await wait(150); await page.mouse.move(cx + 1, cy + 1); await wait(200);
const vh = await ev(() => { const h = VR.Crafter.hover; return h ? [h.x, h.y, h.z, h.v >>> 0] : null; });
console.log('voxel hover', JSON.stringify(vh));
await ev(() => { const it = VR.Crafter.item; it.tool = 'fill'; it.mat = 'velvet'; it.color = '#1e7a5a'; });
await page.mouse.down({ button: 'left' }); await page.mouse.up({ button: 'left' }); await wait(1200);
console.log('voxels changed', await ev(() => VR.Crafter.item.changed));
await page.screenshot({ path: '/home/claude/vr/test/shots/cr_4_item.png' });
await ev(() => VR.Crafter.update.item()); await wait(1500);
const savedM = await ev((n) => { const d = JSON.parse(localStorage.getItem('r9si.studio') || '{}'); const m = d.models && d.models[n]; return m ? { pal: m.pal.length, rle: m.rle.length } : null; }, sofa);
console.log('saved item design:', sofa, JSON.stringify(savedM));
// ---- the game page (same origin) reads the designs; its villa builder applies them
const exported = await ev(() => localStorage.getItem('r9si.studio'));
(await import('fs')).writeFileSync('/home/claude/vr/test/shots/custom_design.json', exported || '');
const game = await ctx.newPage();
game.on('pageerror', e => logs.push('[game pageerror] ' + (e.stack || e.message).slice(0, 900)));
game.on('console', m => { if (m.type() === 'error') logs.push('[game] ' + m.text().slice(0, 300)); });
await game.goto('file:///home/claude/vr/dist/index.html');
for (let i = 0; i < 120; i++) { await game.waitForTimeout(500); if (await game.evaluate(() => VR.game && VR.game.state === 'title')) break; }
// file:// pages may not share storage in every browser: make sure the game sees exactly what the studio saved
await game.evaluate((t) => { if (!localStorage.getItem('r9si.studio') && t) { localStorage.setItem('r9si.studio', t); VR.game.reloadCustom(); } }, exported);
const gameSide = await game.evaluate(() => {
  const C = VR.Custom, n = C.count();
  // build catalogue house 0 the way a town does (lot rotated twice), once plain and once with the design
  const VG = VR.VillageGen, PLAN = VG.plan2, cat = PLAN.CATALOGUE[0];
  const h = VR.CUSTOM.houses[0];
  const run = (noCustom, r) => { const ops = new Map(); const L = VG.makeLot((x, y, z, s) => ops.set(x + ',' + y + ',' + z, s), 100, 100, r); PLAN.build(L, { w: cat.lot[0], d: cat.lot[1], F: 70, r, ox: 100, oz: 100, kind: 'home' }, noCustom ? { rng: new VR.RNG(7), ground: () => 69, beds: 3, skin: h.skin, mirror: h.mirror, noCustom } : { rng: new VR.RNG(99), ground: () => 69, beds: 2 }); return ops; };
  // same variant without the design vs. a town's call (any rng, beds) with it: exactly the edited cells differ, in every rotation
  const diffs = [0, 1, 2, 3].map(r => { const a = run(true, r), b = run(false, r); let d = 0; for (const [k, s] of b) if (a.get(k) !== s) d++; return d; });
  const diff = diffs.join('/');
  const note = document.getElementById('studionote') ? document.getElementById('studionote').textContent : '';
  const sofa = Object.keys(VR.CUSTOM.models)[0], m = VR.VM.MODELS[sofa];
  return { count: n, format: h.tpl ? 'v2 template ' + h.tpl.box.join('×') : 'v1', changedCells: h.n, cellsDifferentPerRotation: diff, note, sofaCol: m ? m.col.toString(16) : null };
});
console.log('game side:', JSON.stringify(gameSide));
await game.screenshot({ path: '/home/claude/vr/test/shots/cr_5_game_title.png' });
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 12)) console.log(l);
await browser.close();
