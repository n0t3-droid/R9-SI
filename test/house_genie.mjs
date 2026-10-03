// v0.35 ✨ Erschaffen: the 🏠 Haus-Baukasten and the ✨ Genie end to end.
// A flat world in the game; the Studio opens it on the Werkbank; 🏠 builds a house (roof switch, 🎲), it goes into the
// hand, is placed on the ground (floor flush with the grass, the door where it belongs) and the game builds it.
// ✨ Genie (v0.37: its own brain, no Claude): a wish for a house lands in the Baukasten, a fire engine becomes blocks
// (glass, lamps, metal), a photo alone becomes a relief and "🏠 Als Haus bauen" makes a house of it, ✏️ Ändern and ⟲,
// the 🏠 tab's ✨ line, a word it does not know → ideas to click. The page offers only `downloads` (no `sample`) and
// the Genie never asks for anything else. Then the same inside the game's overlay.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const PORT = 8765 + Math.floor(Math.random() * 200);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', '/home/claude/vr/dist'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 900));
const URL0 = `http://127.0.0.1:${PORT}`;
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 1360, height: 860 } });
const logs = [];
const watch = (pg, tag) => { pg.on('pageerror', e => logs.push(`[${tag} pageerror] ` + (e.stack || e.message).slice(0, 900))); pg.on('console', m => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) logs.push(`[${tag}] ` + m.text().slice(0, 300)); }); pg.on('dialog', d => d.accept('Testhaus')); };
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const MOCK = `(() => {
  const st = window.__genie = { used: [] };
  const dl = { save: async (req) => { (st.saved = st.saved || []).push({ filename: req.filename, n: req.data && (req.data.byteLength || req.data.length), plain: Object.getPrototypeOf(req) === Object.prototype, u8: req.data instanceof Uint8Array }); return { status: 'saved' }; } };
  window.claude = { use: async (name) => { st.used.push(name); return name === 'downloads' ? dl : null; } };
})()`;

// ---- the game: a flat world
const game = await ctx.newPage(); watch(game, 'game');
await game.goto(URL0 + '/index.html');
const gev = (fn, a) => game.evaluate(fn, a);
const gstep = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await gev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await game.waitForTimeout(5); } };
const gsettle = async (max = 90) => { for (let i = 0; i < max; i++) { await gstep(10); const s = await gev(() => { const g = VR.game; let dirty = 0; for (const c of g.world.cols.values()) for (const sc of c.sec) if (sc.dirty || sc.pending) dirty++; return { busy: g.pool.busy, pend: g.world.pending.size, dirty }; }); if (s.busy === 0 && s.pend === 0 && s.dirty === 0 && i > 3) break; await game.waitForTimeout(60); } };
for (let i = 0; i < 120; i++) { await game.waitForTimeout(500); if (await gev(() => VR.game && VR.game.state === 'title')) break; }
await gev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 5; g.settings.horizon = 1; g.applySettings('*'); });
await gev(`VR.game.createWorld({name:'Hauswelt',mode:'creative',difficulty:'peaceful',type:'flat',seed:'41',cheats:true,kit:false})`);
for (let i = 0; i < 90; i++) { await game.waitForTimeout(1000); if (await gev(() => VR.game.state) === 'play') break; }
await gev(() => { const g = VR.game; g.zenFreezeTime = true; window.requestAnimationFrame = () => 0; });
await gsettle(60);
const W = await gev(async () => { const g = VR.game, p = g.player; await g.saveMeta(); await g.world.saveAll(); let y = Math.floor(p.pos[1]); while (y > 1 && !g.world.getBlock(Math.floor(p.pos[0]), y - 1, Math.floor(p.pos[2]))) y--; return { id: g.meta.id, pos: [Math.floor(p.pos[0]), y, Math.floor(p.pos[2])] }; });
console.log('world', JSON.stringify(W));

// ---- the Studio on its own (the page offers downloads only)
const studio = await ctx.newPage(); watch(studio, 'studio');
await studio.addInitScript(MOCK);
await studio.goto(URL0 + '/studio.html');
const sev = (fn, a) => studio.evaluate(fn, a);
for (let i = 0; i < 240; i++) { await studio.waitForTimeout(500); if (await sev(() => !document.getElementById('studio').classList.contains('boot') && window.__studio && window.__studio.HOUSE.size >= 1 && VR.BlockColors && VR.BlockColors.ready())) break; }
await sev(() => window.__studioCore.setMode('world'));
for (let i = 0; i < 40; i++) { await studio.waitForTimeout(300); if (await sev(() => !!VR.StudioWorld.worlds)) break; }
await sev((id) => { const WM = VR.StudioWorld; WM.open(WM.worlds.find(w => w.id === id)); }, W.id);
for (let i = 0; i < 400; i++) { await studio.waitForTimeout(500); if (await sev(() => VR.StudioWorld.world && !VR.StudioWorld.loading && VR.StudioWorld.cols.size && VR.StudioWorld.wb.region === VR.StudioWorld.region && VR.StudioWorld.imagine.aiOK)) break; }
const make = await sev(() => { VR.StudioWorld.refresh && VR.StudioWorld.refresh(); window.__studioCore.parts(); return [...document.querySelectorAll('.wbMake button span')].map(s => s.textContent); });
console.log('  make', JSON.stringify(make));
check(make.length === 3 && /Haus/.test(make[0]) && /Genie/.test(make[1]), '✨ Erschaffen on the Werkbank: 🏠 Haus, ✨ Genie (always there), 🖼 Bild → 3D');

// 1. 🏠 the Baukasten
const h1 = await sev(async () => {
  document.querySelector('.wbMake button').click();
  const IM = VR.StudioWorld.imagine;
  for (let i = 0; i < 40 && !(IM.result && IM.result.n); i++) await new Promise(r => setTimeout(r, 150));
  const a = { open: document.getElementById('imagine').classList.contains('on'), mode: IM.mode, n: IM.result && IM.result.n, ok: !document.getElementById('imOk').disabled, rows: document.querySelectorAll('.hkRow').length, tabs: [...document.querySelectorAll('.imModes button')].map(b => b.textContent.trim()) };
  document.querySelector('[data-hs="roof.type"][data-v="hip"]').click();
  for (let i = 0; i < 30; i++) { await new Promise(r => setTimeout(r, 150)); if (IM.result && IM.result.house && IM.result.house.roof.type === 'hip') break; }
  a.hip = IM.result && IM.result.house.roof.type; a.nHip = IM.result && IM.result.n;
  const before = JSON.stringify(IM.house); document.querySelector('[data-hk="random"]').click();
  for (let i = 0; i < 30; i++) { await new Promise(r => setTimeout(r, 150)); if (IM.result && JSON.stringify(IM.result.house) !== before) break; }
  a.random = JSON.stringify(IM.house) !== before && !!(IM.result && IM.result.n);
  // extras and colours by the buttons
  IM.house = VR.HouseKit.normalize({ name: 'Testhaus', style: 'cottage', width: 11, depth: 9, floors: 2, roof: { type: 'gable', color: '#b0453a' }, walls: { material: 'plaster', color: '#f1ece0' }, door: { position: 'center', kind: 'wood' }, extras: [] });
  IM.run(); await new Promise(r => setTimeout(r, 400)); IM.open(null, 'house');
  document.querySelector('[data-hx="garage"]').click(); await new Promise(r => setTimeout(r, 400));
  a.garage = IM.house.extras.includes('garage') && IM.result.sx >= 18;
  document.querySelector('[data-hx="garage"]').click(); await new Promise(r => setTimeout(r, 400));
  return a;
});
console.log('  house', JSON.stringify(h1));
check(h1.open && h1.mode === 'house' && h1.n > 400 && h1.ok && h1.rows >= 10, '🏠 opens the Baukasten with a house built at once (' + h1.n + ' blocks)');
check(h1.tabs.length === 5 && /Ort/.test(h1.tabs[4]) && h1.hip === 'hip' && h1.nHip !== h1.n, 'a roof button rebuilds the house with that roof (tabs: ' + h1.tabs.join(' ') + ')');
check(h1.random && h1.garage, '🎲 makes another house; the 🚗 Garage chip adds a garage');

// 2. into the hand, placed on the ground, built by the game
const P = W.pos;
const pl = await sev(async (P) => {
  const WM = VR.StudioWorld, WB = WM.wb, IM = WM.imagine, nm = (s) => (s ? VR.R.types[VR.R.T.type[s]].name : 'air');
  await new Promise(r => setTimeout(r, 300));
  const g = IM.result, door = g.door;
  document.getElementById('imOk').click();
  const r = { dy: WB.clip && WB.clip.dy, tool: WB.tool, open: document.getElementById('imagine').classList.contains('on') };
  const at = WB.pasteAt({ x: P[0] + 14, y: P[1] - 1, z: P[2] - 4, face: 2 });
  WB.paste(at);
  await new Promise(r => setTimeout(r, 300));
  const d = [at[0] + door[0], at[1] + door[1], at[2] + door[2]];
  r.at = at; r.door = d; r.doorBlock = nm(WM.getBlock(d[0], d[1], d[2])); r.doorTop = nm(WM.getBlock(d[0], d[1] + 1, d[2]));
  r.floorIn = nm(WM.getBlock(d[0], d[1] - 1, d[2] + 2)); r.groundY = P[1] - 1; r.floorY = d[1] - 1;
  r.under = nm(WM.getBlock(d[0], d[1] - 2, d[2] + 2));
  r.pending = WB.pendingN;
  return r;
}, P);
console.log('  placed', JSON.stringify(pl));
check(pl.dy === -2 && pl.tool === 'paste' && !pl.open, '✓ In die Werkbank: the house is in hand, sunk one block so its floor meets the ground');
check(/_door$/.test(pl.doorBlock) && /_door$/.test(pl.doorTop) && pl.floorY === pl.groundY && /floor|planks/.test(pl.floorIn), 'placed: the door stands on the ground, the floor inside is flush with the grass (' + pl.floorIn + ')');
await gsettle(40);
for (let i = 0; i < 40; i++) { await gstep(10); const ok = await gev((d) => { const b = VR.game.world.getBlock(d[0], d[1], d[2]); return b && /_door$/.test(VR.R.types[VR.R.T.type[b]].name); }, pl.door); if (ok) break; await game.waitForTimeout(250); }
const inGame = await gev((d) => { const w = VR.game.world, nm = (s) => (s ? VR.R.types[VR.R.T.type[s]].name : 'air'); return { door: nm(w.getBlock(d[0], d[1], d[2])), floor: nm(w.getBlock(d[0], d[1] - 1, d[2] + 2)) }; }, pl.door);
console.log('  game', JSON.stringify(inGame));
check(/_door$/.test(inGame.door) && /floor|planks/.test(inGame.floor), 'the open game builds the house (door ' + inGame.door + ')');

// 3. ✨ Genie: a wish for a house
const g1 = await sev(async () => {
  const IM = VR.StudioWorld.imagine;
  IM.open(null, 'genie');
  const tabs = [...document.querySelectorAll('.imModes button')].map(b => b.textContent.trim());
  const chips0 = [...document.querySelectorAll('.gnChips .chip')].map(b => b.textContent.trim());
  const tx = document.getElementById('gnText'); tx.value = 'ein weißes Holzhaus am See mit blauem Dach'; tx.dispatchEvent(new Event('input'));
  document.getElementById('gnGo').click();
  for (let i = 0; i < 60; i++) { await new Promise(r => setTimeout(r, 150)); if (IM.genie.last && IM.result && IM.result.n && IM.result.house) break; }
  const H = IM.genie.last && IM.genie.last.spec;
  return { tabs, chips0, kind: IM.genie.last && IM.genie.last.kind, walls: H && H.walls, roof: H && H.roof, n: IM.result && IM.result.n, status: document.getElementById('gnStatus').textContent, tune: !!document.querySelector('.imLeft [data-mode="house"]'), house: IM.house && IM.house.name, editChips: [...document.querySelectorAll('.gnChips .chip')].map(b => b.textContent.trim()), tiers: document.querySelectorAll('[data-gtier]').length, how: (document.querySelector('.imLeft .dim:last-child') || {}).textContent || '' };
});
console.log('  genie house', JSON.stringify(g1));
check(g1.tabs.some(t => /Genie/.test(t)) && g1.chips0.length >= 5 && g1.tiers === 0 && /ohne Konto, ohne Limit/.test(g1.how), 'the Genie: always a tab, ideas to click, no "thinking" levels, “ohne Konto, ohne Limit”');
check(g1.kind === 'house' && g1.walls.material === 'wood' && g1.walls.color === '#f4f4f2' && g1.roof.color === '#2e6fd8' && g1.n > 400 && /✓/.test(g1.status) && g1.tune, 'a white wooden house with a blue roof — built by the Baukasten (' + g1.n + ' blocks), ready to tune');
check(g1.editChips.some(c => /Dach blau|Pool|Etagen/.test(c)), 'after a house: ✏️ chips to change it (' + g1.editChips.slice(0, 3).join(', ') + ')');

// 4. ✨ Genie: a fire engine; a photo alone; the photo as a house
const g2 = await sev(async () => {
  const IM = VR.StudioWorld.imagine, out = {};
  const tx = document.getElementById('gnText'); tx.value = 'Feuerwehrauto mit Leiter'; tx.dispatchEvent(new Event('input'));
  document.getElementById('gnGo').click();
  for (let i = 0; i < 60; i++) { await new Promise(r => setTimeout(r, 150)); if (IM.genie.last && IM.genie.last.kind === 'model' && IM.result && IM.result.n && /Feuerwehr/.test(IM.result.name)) break; }
  const g = IM.result, names = {}; for (const s of g.blocks) { if (s === 0xffff || !s) continue; const n = VR.R.types[VR.R.T.type[s]].name; names[n] = (names[n] || 0) + 1; }
  Object.assign(out, { size: [g.sx, g.sy, g.sz], n: g.n, names: Object.keys(names).join(' '), name: g.name, sets: document.querySelectorAll('.imLeft .sets button').length });
  // a photo alone: a relief in its colours, and the chip to build it as a house
  const cv = document.createElement('canvas'); cv.width = 160; cv.height = 90; const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 160, 90); x.fillStyle = '#2e6fd8'; x.fillRect(20, 30, 120, 40);
  const blob = await new Promise(r => cv.toBlob(r)); await IM.take(blob, 'genie');
  tx.value = ''; tx.dispatchEvent(new Event('input'));
  document.getElementById('gnGo').click();
  for (let i = 0; i < 60; i++) { await new Promise(r => setTimeout(r, 150)); if (IM.genie.last && IM.genie.last.photo && IM.result && IM.result.n) break; }
  out.photo = !!(IM.genie.last && IM.genie.last.photo); out.photoN = IM.result && IM.result.n;
  const asHouse = [...document.querySelectorAll('.gnChips .chip')].find(b => /Als Haus/.test(b.textContent));
  out.asHouseChip = !!asHouse;
  if (asHouse) { asHouse.click(); for (let i = 0; i < 60; i++) { await new Promise(r => setTimeout(r, 150)); if (IM.genie.last && IM.genie.last.kind === 'house' && IM.result && IM.result.house) break; } }
  out.photoHouse = IM.genie.last && IM.genie.last.kind; out.photoWalls = IM.genie.last && IM.genie.last.spec && IM.genie.last.spec.walls.color;
  IM.slotSet ? IM.slotSet('genie', null) : (IM.genie.img = null);
  return out;
});
console.log('  genie model', JSON.stringify(g2));
check(g2.n > 400 && /Feuerwehr/.test(g2.name) && g2.size[2] >= 28, 'a fire engine with a ladder becomes blocks (' + g2.size.join('×') + ', ' + g2.n + ' blocks)');
check(/glass/.test(g2.names) && /glowstone|lantern|froglight|light|lamp/.test(g2.names) && /iron|metal|gloss|copper|netherite|diamond/.test(g2.names) && /red|carmine|crimson|brick|terracotta|vollton/.test(g2.names) && g2.sets > 3, 'materials: glass for the windows, lamps for the lights, metal for the ladder, red for the body; the block palette can be switched');
check(g2.photo && g2.photoN > 100 && g2.asHouseChip, 'a photo alone becomes a relief in its colours, with a chip “🏠 Als Haus bauen”');
check(g2.photoHouse === 'house' && /^#[0-4]/.test(g2.photoWalls || ''), 'the chip builds the photo as a house, in the photo’s blue (' + g2.photoWalls + ')');

// 4b. ✏️ Ändern changes what is there; ⟲ returns to the version before
const g4 = await sev(async () => {
  const IM = VR.StudioWorld.imagine, out = {};
  const tx = document.getElementById('gnText'); tx.value = 'rotes Auto'; tx.dispatchEvent(new Event('input'));
  document.getElementById('gnGo').click();
  for (let i = 0; i < 60; i++) { await new Promise(r => setTimeout(r, 150)); if (IM.genie.last && IM.genie.last.recipe && IM.genie.last.recipe.type === 'car' && IM.result && IM.result.n) break; }
  out.first = IM.genie.last.name;
  tx.value = 'Räder blau, größer'; tx.dispatchEvent(new Event('input'));
  out.editBtn = !!document.getElementById('gnEdit');
  document.getElementById('gnEdit').click();
  for (let i = 0; i < 60; i++) { await new Promise(r => setTimeout(r, 150)); if (IM.genie.last.recipe.colors.wheels === '#2e6fd8') break; }
  out.wheels = IM.genie.last.recipe.colors.wheels; out.body = IM.genie.last.recipe.colors.body; out.size = IM.genie.last.recipe.size; out.status = document.getElementById('gnStatus').textContent;
  out.back = !!document.getElementById('gnBack');
  document.getElementById('gnBack').click();
  for (let i = 0; i < 30; i++) { await new Promise(r => setTimeout(r, 120)); if (!IM.genie.last.recipe.colors.wheels) break; }
  out.after = IM.genie.last.recipe.colors.wheels || null;
  // a chip changes it too
  const chip = [...document.querySelectorAll('.gnChips .chip')].find(b => /✏️/.test(b.textContent));
  out.chip = chip && chip.textContent; if (chip) { chip.click(); await new Promise(r => setTimeout(r, 600)); out.chipStatus = document.getElementById('gnStatus').textContent; }
  return out;
});
console.log('  edit', JSON.stringify(g4));
check(g4.editBtn && g4.first === 'Rotes Auto' && g4.wheels === '#2e6fd8' && g4.body === '#c0392b' && g4.size > 32 && /Geändert/.test(g4.status), '✏️ Ändern: blue wheels and bigger, the red body stays');
check(g4.back && g4.after === null, '⟲ goes back to the version before');
check(g4.chip && /✓/.test(g4.chipStatus || ''), 'a ✏️ chip changes the design in one click (' + g4.chip + ')');
// 4c. the 🏠 tab's ✨ line changes the Baukasten's house
const g5 = await sev(async () => {
  const IM = VR.StudioWorld.imagine;
  IM.open(null, 'house');
  const w = document.getElementById('hkWish'); w.value = 'rotes Dach, drei Etagen, mit Pool'; w.dispatchEvent(new Event('input'));
  document.getElementById('hkWishGo').click();
  for (let i = 0; i < 60; i++) { await new Promise(r => setTimeout(r, 150)); if (IM.house && IM.house.floors === 3 && IM.result && IM.result.house && IM.result.house.floors === 3) break; }
  return { mode: IM.mode, floors: IM.house.floors, pool: IM.house.extras.includes('pool'), roof: IM.house.roof.color, n: IM.result && IM.result.n, photoBtn: !!document.querySelector('[data-mode="genie"][data-want="house"]') };
});
console.log('  house wish', JSON.stringify(g5));
check(g5.mode === 'house' && g5.floors === 3 && g5.pool && g5.roof === '#c0392b' && g5.n > 500 && g5.photoBtn, 'the ✨ line in 🏠 Haus changes the house in the Baukasten (red roof, 3 floors, pool); 📷 Aus Foto is there');
await sev(() => VR.StudioWorld.imagine.open(null, 'genie'));

// 5. a word it does not know → ideas to click; nothing to change → what can be changed
const g3 = await sev(async () => {
  const IM = VR.StudioWorld.imagine, out = {};
  const tx = document.getElementById('gnText'); tx.value = 'Quatschmaschine'; tx.dispatchEvent(new Event('input'));
  document.getElementById('gnGo').click();
  for (let i = 0; i < 30; i++) { await new Promise(r => setTimeout(r, 120)); if (/kenne ich noch nicht/.test(document.getElementById('gnStatus').textContent)) break; }
  out.unknown = document.getElementById('gnStatus').textContent;
  out.chips = [...document.querySelectorAll('.gnChips .chip')].map(b => b.textContent.trim());
  const c = [...document.querySelectorAll('.gnChips .chip')].find(b => !/Schriftzug/.test(b.textContent));
  const before = IM.genie.hist.length; c.click();
  for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 120)); if (IM.genie.hist.length > before && IM.result && IM.result.n) break; }
  out.clicked = c.textContent.trim(); out.built = IM.genie.last && IM.genie.last.name; out.n = IM.result && IM.result.n;
  const tc = () => [...document.querySelectorAll('.gnChips .chip')].find(b => /Schriftzug/.test(b.textContent));
  tx.value = 'Quatschmaschine'; tx.dispatchEvent(new Event('input')); document.getElementById('gnGo').click();
  for (let i = 0; i < 30; i++) { await new Promise(r => setTimeout(r, 120)); if (tc()) break; }
  if (tc()) { tc().click(); for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 120)); if (IM.genie.last && IM.genie.last.recipe && IM.genie.last.recipe.type === 'letters') break; } }
  out.text = IM.genie.last && IM.genie.last.recipe && IM.genie.last.recipe.text;
  tx.value = 'hmm'; tx.dispatchEvent(new Event('input')); document.getElementById('gnEdit').click();
  for (let i = 0; i < 30; i++) { await new Promise(r => setTimeout(r, 120)); if (/Was soll anders/.test(document.getElementById('gnStatus').textContent)) break; }
  out.nochange = document.getElementById('gnStatus').textContent; out.editChips = [...document.querySelectorAll('.gnChips .chip')].map(b => b.textContent.trim());
  IM.close(); window.__studioCore.parts();
  out.make = [...document.querySelectorAll('.wbMake button span')].map(s => s.textContent);
  out.used = window.__genie.used.filter((v, i, a) => a.indexOf(v) === i);
  return out;
});
console.log('  unknown', JSON.stringify(g3));
check(/Quatschmaschine/.test(g3.unknown) && g3.chips.length >= 5 && g3.chips.some(c => /Schriftzug/.test(c)), 'a word it does not know: said plainly, with ideas and “🔤 Als Schriftzug”');
check(g3.built && g3.n > 100, 'clicking an idea builds it (' + g3.clicked + ' → ' + g3.built + ')');
check(g3.text === 'Quatschmaschine', '“🔤 Als Schriftzug” writes the word in blocks');
check(/Was soll anders/.test(g3.nochange) && g3.editChips.length >= 3, 'nothing to change: what can be changed, as chips');
check(g3.make.length === 3 && !g3.used.includes('sample'), 'the Genie stays; the page was never asked for `sample` (asked for: ' + g3.used.join(', ') + ')');
await studio.close();

// ---- inside the game's overlay: the Genie works the same (and downloads go to the game's page)
await gev(MOCK);
await gev(() => VR.game.openStudio());
let frame = null;
for (let i = 0; i < 240; i++) { await game.waitForTimeout(500); frame = game.frames().find(f => /studio\.html/.test(f.url())); if (frame) { const ok = await frame.evaluate(() => !!(window.VR && VR.StudioWorld && VR.StudioWorld.world && VR.StudioWorld.imagine && VR.BlockColors && VR.BlockColors.ready())).catch(() => false); if (ok) break; } }
const fr = await frame.evaluate(async () => {
  const IM = VR.StudioWorld.imagine;
  IM.open(null, 'genie');
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64; const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#27ae60'; x.fillRect(8, 8, 40, 40);
  await IM.take(await new Promise(r => cv.toBlob(r)), 'genie');
  const tx = document.getElementById('gnText'); tx.value = 'Auto'; tx.dispatchEvent(new Event('input'));
  const before = IM.genie.hist.length;
  document.getElementById('gnGo').click();
  for (let i = 0; i < 60; i++) { await new Promise(r => setTimeout(r, 150)); if (IM.genie.hist.length > before && IM.result && IM.result.n && IM.genie.last.recipe) break; }
  return { n: IM.result && IM.result.n, type: IM.genie.last.recipe && IM.genie.last.recipe.type, body: IM.genie.last.recipe && IM.genie.last.recipe.colors.body };
});
console.log('  overlay', JSON.stringify(fr));
const frDl = await frame.evaluate(async () => { const WB = VR.StudioWorld.wb, IM = VR.StudioWorld.imagine; const g = IM.result; WB.setClip({ sx: g.sx, sy: g.sy, sz: g.sz, blocks: g.blocks.slice(), name: g.name, dy: g.dy || 0 }); await WB.exportClip('json'); await WB.exportClip('schem'); return { saved: window.parent.__genie.saved || [], used: window.parent.__genie.used }; });
console.log('  overlay saves', JSON.stringify(frDl));
check(frDl.saved.length === 2 && frDl.saved.every(x => x.plain && x.u8 && x.n > 50) && /\.json$/.test(frDl.saved[0].filename) && /\.zip$/.test(frDl.saved[1].filename), 'downloads from the overlay go to the game\'s page as its own plain request with its own bytes (.json, .schem in a .zip)');
check(fr.type === 'car' && fr.n > 250 && /^#[0-3]/.test(fr.body || '') && !frDl.used.includes('sample'), 'in the game\'s overlay: photo + “Auto” → a car in the photo’s green, without Claude (' + fr.body + ')');

console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 20)) console.log(l);
check(!logs.some(l => /pageerror/.test(l)), 'no page errors');
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
await browser.close(); srv.kill();
process.exit(fails ? 1 : 0);
