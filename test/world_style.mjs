// v0.34 Welt → 🎨 Stil end to end: the game saves a world with a tower the player built of oak planks; the Studio opens
// the region, the Stil tab lists what the region is made of, rules (grass → moss, the leaves → cherry leaves, oak planks
// → spruce planks) and a water colour show in the preview (the player's tower stays oak), "In die Welt" stores the style,
// and the open game changes what it generated around the player — the tower still oak.
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
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const game = await ctx.newPage(); watch(game, 'game');
await game.goto(URL0 + '/index.html');
const gev = (fn, a) => game.evaluate(fn, a);
const gstep = async (n, dtms = 33) => { for (let k = 0; k < n; k += 10) { await gev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await game.waitForTimeout(5); } };
const gsettle = async (max = 90) => { for (let i = 0; i < max; i++) { await gstep(10); const s = await gev(() => { const g = VR.game; let dirty = 0; for (const c of g.world.cols.values()) for (const sc of c.sec) if (sc.dirty || sc.pending) dirty++; return { busy: g.pool.busy, pend: g.world.pending.size, dirty }; }); if (s.busy === 0 && s.pend === 0 && s.dirty === 0 && i > 3) break; await game.waitForTimeout(60); } };
for (let i = 0; i < 120; i++) { await game.waitForTimeout(500); if (await gev(() => VR.game && VR.game.state === 'title')) break; }
await gev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 5; g.settings.horizon = 1; g.applySettings('*'); });
await gev(`VR.game.createWorld({name:'Stilwelt',mode:'creative',difficulty:'peaceful',type:'default',seed:'${process.env.SEED || '20261002'}',cheats:true,kit:false})`);
for (let i = 0; i < 90; i++) { await game.waitForTimeout(1000); if (await gev(() => VR.game.state) === 'play') break; }
await gev(() => { const g = VR.game; g.zenFreezeTime = true; g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.env.setTime(5000); });
await gsettle(90);
const W = await gev(async () => {
  const g = VR.game, p = g.player, w = g.world, x = Math.floor(p.pos[0]) + 3, z = Math.floor(p.pos[2]) + 3, st = VR.R.byName.oak_planks.defaultState;
  let y = Math.floor(p.pos[1]) - 1; while (y > 1 && !w.getBlock(x, y, z)) y--;
  for (let k = 1; k <= 8; k++) w.setBlock(x, y + k, z, st, 0);
  await g.saveMeta(); await w.saveAll();
  // what grows around: the most common leaves and the grass
  const n = {}; for (const c of w.cols.values()) { const b = c.blocks; for (let i = 0; i < b.length; i += 3) { const s = b[i]; if (!s) continue; const nm = VR.R.types[VR.R.T.type[s]].name; if (/_leaves$|^grass_block$|^water$/.test(nm)) n[nm] = (n[nm] || 0) + 1; } }
  return { id: g.meta.id, pos: p.pos.map(Math.floor), tower: [x, y + 1, z], n };
});
console.log('world saved', JSON.stringify(W));
const leaves = Object.entries(W.n).filter(([k]) => /_leaves$/.test(k)).sort((a, b) => b[1] - a[1]).map(x => x[0])[0];
const leavesTo = leaves === 'cherry_leaves' ? 'azalea_leaves' : 'cherry_leaves';
// ---- the Studio
const studio = await ctx.newPage(); watch(studio, 'studio');
await studio.goto(URL0 + '/studio.html');
const sev = (fn, a) => studio.evaluate(fn, a);
for (let i = 0; i < 240; i++) { await studio.waitForTimeout(500); if (await sev(() => !document.getElementById('studio').classList.contains('boot') && window.__studio && window.__studio.HOUSE.size >= 1)) break; }
await sev(() => window.__studioCore.setMode('world'));
for (let i = 0; i < 40; i++) { await studio.waitForTimeout(300); if (await sev(() => !!VR.StudioWorld.worlds)) break; }
await sev((id) => { const WM = VR.StudioWorld; WM.open(WM.worlds.find(w => w.id === id)); }, W.id);
for (let i = 0; i < 400; i++) { await studio.waitForTimeout(500); if (await sev(() => VR.StudioWorld.world && !VR.StudioWorld.loading && VR.StudioWorld.cols.size)) break; }
// the Stil tab
const tab = await sev(() => { const b = [...document.querySelectorAll('#chips button')].find(x => /Stil/.test(x.textContent)); if (b) b.click(); return !!b; });
check(tab, 'the 🎨 Stil tab is there');
for (let i = 0; i < 60; i++) { await studio.waitForTimeout(300); if (await sev(() => !!VR.StudioWorld.st.counts && document.querySelectorAll('#list .tile').length > 5)) break; }
const ui = await sev(() => ({ groups: [...document.querySelectorAll('#list .grp')].map(g => g.textContent.trim()), tiles: document.querySelectorAll('#list .tile').length, steps: !!document.querySelector('.wsSteps'), water: !!document.querySelector('#partsBody .wsWater') }));
console.log('  ui', JSON.stringify(ui));
check(ui.tiles > 5 && ui.groups.length >= 2 && ui.steps && ui.water, 'what the region is made of, in groups, with the steps and the water colours');
await studio.screenshot({ path: '/home/claude/vr/test/shots/ws_1_tab.png', timeout: 180000 });
// suggestions for the leaves: leaves first
const sug = await sev((n) => VR.StudioWorld.styleSuggest(n).slice(0, 6), leaves);
console.log('  suggestions for', leaves, JSON.stringify(sug));
check(sug.length && sug.every(n => /_leaves$/.test(n)), 'the best matches for leaves are leaves');
// choose and set rules (as the clicks do), and the water
await sev(([lv, lt]) => { const WM = VR.StudioWorld; WM.styleChoose(lv); WM.styleSetRule(lv, lt); WM.styleSetRule('grass_block', 'moss_block'); WM.styleSetRule('oak_planks', 'spruce_planks'); WM.styleSetWater('#d0479c'); WM.styleChoose(null); }, [leaves, leavesTo]);
for (let i = 0; i < 400; i++) { await studio.waitForTimeout(500); if (await sev(() => { const st = VR.StudioWorld.st; return !st.busy && st.shown === JSON.stringify([((st.draft || {}).rules) || [], (st.draft || {}).water || null]); })) break; }
const pv = await sev(([t, lv]) => {
  const WM = VR.StudioWorld, R = VR.R, T = R.T; let grass = 0, moss = 0, lvN = 0;
  for (const c of WM.cols.values()) { const b = c.blocks; for (let i = 0; i < b.length; i++) { const s = b[i]; if (!s) continue; const n = R.types[T.type[s]].name; if (n === 'grass_block') grass++; else if (n === 'moss_block') moss++; else if (n === lv) lvN++; } }
  const tw = []; for (let k = 0; k < 8; k++) tw.push(R.types[T.type[WM.getBlock(t[0], t[1] + k, t[2])]].name);
  return { grass, moss, lvN, tower: [...new Set(tw)], draft: !!WM.st.draft, origin: R.types[T.type[WM.styleOriginAt(...(() => { for (const c of WM.cols.values()) { const b = c.blocks; for (let i = 0; i < b.length; i++) if (b[i] && R.types[T.type[b[i]]].name === 'moss_block') return [c.cx * 16 + (i & 15), i >> 8, c.cz * 16 + ((i >> 4) & 15)]; } return [0, 0, 0]; })())]].name };
}, [W.tower, leaves]);
console.log('  preview', JSON.stringify(pv));
check(pv.moss > 50 && pv.grass < pv.moss / 10, 'the preview shows the meadows as moss');
check(pv.lvN === 0, 'every ' + leaves + ' became ' + leavesTo + ' in the preview');
check(pv.tower.length === 1 && pv.tower[0] === 'oak_planks', 'the tower the player built stays oak planks');
check(pv.origin === 'grass_block', 'pointing at the moss means the grass it came from');
await studio.waitForTimeout(600);
await studio.screenshot({ path: '/home/claude/vr/test/shots/ws_2_preview.png', timeout: 180000 });
// into the world
await sev(() => VR.StudioWorld.styleCommit());
const stored = await sev((id) => JSON.parse(localStorage.getItem('r9si.style.' + id)), W.id);
console.log('  stored', JSON.stringify({ sv: stored.sv, rules: stored.rules, water: stored.water }));
check(stored.sv === 1 && stored.rules.length === 3 && stored.water === '#d0479c', 'the style went into the world (version 1, 3 rules, the water)');
// ---- the open game takes it
for (let i = 0; i < 60; i++) { await gstep(20); await game.waitForTimeout(100); if (await gev(() => !!VR.game.style)) break; }
await gsettle(120);
const gm = await gev(([t, lv]) => {
  const g = VR.game, w = g.world, R = VR.R, T = R.T; let grass = 0, moss = 0, lvN = 0;
  for (const c of w.cols.values()) { const b = c.blocks; for (let i = 0; i < b.length; i++) { const s = b[i]; if (!s) continue; const n = R.types[T.type[s]].name; if (n === 'grass_block') grass++; else if (n === 'moss_block') moss++; else if (n === lv) lvN++; } }
  const tw = []; for (let k = 0; k < 8; k++) tw.push(R.types[T.type[w.getBlock(t[0], t[1] + k, t[2])]].name);
  return { style: g.style ? g.style.sv : null, grass, moss, lvN, tower: [...new Set(tw)] };
}, [W.tower, leaves]);
console.log('  game', JSON.stringify(gm));
check(gm.style === 1 && gm.moss > 50 && gm.grass < gm.moss / 10 && gm.lvN === 0, 'the game changed what it generated (moss, ' + leavesTo + ')');
check(gm.tower.length === 1 && gm.tower[0] === 'oak_planks', 'the player\'s tower in the game is still oak planks');
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 8)) console.log(l);
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
await browser.close(); srv.kill();
process.exit(fails ? 1 : 0);
