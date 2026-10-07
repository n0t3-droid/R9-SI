// v0.37 ★ Favoriten everywhere: the same favourites in the R9 Studio (Teile, Möbel, the Crafter's palette, the World's
// furniture, the Werkbank's blocks) and in the game (creative inventory ★ tab, F over an item, a ☆ on each slot) —
// a change in one place shows in the other at once (same browser, same storage).
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const PORT = 8765 + Math.floor(Math.random() * 200);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', '/home/claude/vr/dist'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 900));
const URL0 = `http://127.0.0.1:${PORT}`;
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 1360, height: 860 } });
const logs = [];
const watch = (pg, tag) => { pg.on('pageerror', e => logs.push(`[${tag} pageerror] ` + (e.stack || e.message).slice(0, 900))); pg.on('console', m => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) logs.push(`[${tag}] ` + m.text().slice(0, 300)); }); pg.on('dialog', d => d.accept('x')); };
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const done = async () => { console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 12)) console.log(l); check(!logs.some(l => /pageerror/.test(l)), 'no page errors'); console.log(fails ? 'FAILED ' + fails : 'ALL OK'); await browser.close(); srv.kill(); process.exit(fails ? 1 : 0); };

// ---- the game: a creative world
const game = await ctx.newPage(); watch(game, 'game');
await game.goto(URL0 + '/index.html');
const gev = (fn, a) => game.evaluate(fn, a);
for (let i = 0; i < 120; i++) { await game.waitForTimeout(500); if (await gev(() => VR.game && VR.game.state === 'title')) break; }
await gev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 4; g.settings.horizon = 0; g.applySettings('*'); localStorage.removeItem('r9si.favs'); });
await gev(`VR.game.createWorld({name:'Favwelt',mode:'creative',difficulty:'peaceful',seed:'4242',cheats:true,kit:false})`);
for (let i = 0; i < 120; i++) { await game.waitForTimeout(1000); if (await gev(() => VR.game.state) === 'play') break; }
const W = await gev(async () => { const g = VR.game; await g.saveMeta(); await g.world.saveAll(); return { id: g.meta.id }; });

console.log('1 · the game: ★ tab, F over an item, ☆ on a slot');
const g1 = await gev(async () => {
  const g = VR.game, ui = g.ui;
  ui.openInventory('creative');
  const tabs = [...document.querySelectorAll('#invpanel .tabs button')].map(b => b.textContent);
  document.querySelector('#invpanel .tabs button[data-cat="fav"]').click();
  const empty = document.querySelector('#invpanel .palette .note');
  const r = { tabs: tabs.slice(0, 3), empty: empty ? empty.textContent : null, slots0: document.querySelectorAll('#invpanel .palette .slot').length };
  // the Building tab: hover a slot, press F
  document.querySelector('#invpanel .tabs button[data-cat="build"]').click();
  const s = document.querySelector('#invpanel .palette .slot[data-id]'); r.first = s.dataset.id;
  s.dispatchEvent(new MouseEvent('mouseenter'));
  return r;
});
console.log('  game', JSON.stringify(g1));
check(/^★ (Favourites|Favoriten)$/.test(g1.tabs[0]) && g1.slots0 === 0 && /No favourites yet|Noch keine Favoriten/.test(g1.empty || ''), 'the creative inventory starts with a ★ Favourites tab (empty: it says how) — ' + g1.tabs[0]);
await game.keyboard.press('KeyF'); await game.waitForTimeout(150);
for (let i = 0; i < 4; i++) { await gev(() => { const g = VR.game; g.last = performance.now() - 33; g.loop(performance.now()); }); }
const g2 = await gev((first) => {
  const s = document.querySelector(`#invpanel .palette .slot[data-id="${first}"]`);
  // a ☆ on another slot
  const s2 = [...document.querySelectorAll('#invpanel .palette .slot[data-id]')][5]; s2.querySelector('.favS').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  const r = { favs: VR.Favs.list(), mark: s && s.classList.contains('fav'), second: s2.dataset.id, cursor: !!VR.game.ui.cursor };
  document.querySelector('#invpanel .tabs button[data-cat="fav"]').click();
  r.favSlots = [...document.querySelectorAll('#invpanel .palette .slot[data-id]')].map(x => x.dataset.id);
  return r;
}, g1.first);
console.log('  game favs', JSON.stringify(g2));
check(g2.favs.length === 2 && g2.favs[1] === g1.first && g2.mark, 'F over an item makes it a ★ favourite (the slot shows a ★)');
check(g2.favs[0] === g2.second && !g2.cursor, 'the ☆ on a slot does the same (and does not pick the item up)');
check(g2.favSlots.join() === g2.favs.join(), '★ Favorites shows them, newest first: ' + g2.favSlots.join(', '));

console.log('2 · the Studio sees them, and its ★ reach the game');
const studio = await ctx.newPage(); watch(studio, 'studio');
await studio.goto(URL0 + '/studio.html');
const sev = (fn, a) => studio.evaluate(fn, a);
for (let i = 0; i < 300; i++) { await studio.waitForTimeout(500); if (await sev(() => !document.getElementById('studio').classList.contains('boot') && window.__studio && window.__studioCore.texInfo())) break; }
const s1 = await sev(async () => {
  document.querySelector('nav.modes [data-mode="parts"]').click();
  await new Promise(r => setTimeout(r, 300));
  document.querySelector('#chips button[data-pcat="fav"]').click();
  const cards = [...document.querySelectorAll('#list .card[data-bid]')].map(c => c.dataset.bid);
  // ☆ the LED strip and a sofa here
  const s = document.getElementById('search'); s.value = 'led cove'; s.dispatchEvent(new Event('input'));
  document.querySelector('#list .card[data-bid="vx_led_cove"] .favb').click();
  s.value = ''; s.dispatchEvent(new Event('input'));
  window.__studioCore.setMode('furn');
  const sofa = Object.keys(VR.VM.MODELS).find(n => /sofa/.test(n));
  document.querySelector(`#list .card[data-name="${sofa}"] .favb`).click();
  document.querySelector('#chips button[data-fcat="fav"]').click();
  const furnFav = [...document.querySelectorAll('#list .card[data-name]')].map(c => c.dataset.name);
  return { cards, sofa, furnFav, favs: VR.Favs.list() };
});
console.log('  studio', JSON.stringify(s1));
check(s1.cards.length === 2 && s1.cards.join() === g2.favs.join(), 'the game\'s ★ are in 🧱 Teile → ★ Favoriten');
check(s1.furnFav.join() === s1.sofa && s1.favs[0] === s1.sofa && s1.favs[1] === 'vx_led_cove', 'Möbel: the ☆ on a card, ★ Favoriten shows the sofa');
// back to the game's tab (a page in the background may only look now and then)
await game.bringToFront();
let g3 = null;
// (a page drawing a world in software rendering may take seconds per frame here: give it time)
for (let i = 0; i < 60; i++) { await game.waitForTimeout(500); g3 = await gev(() => ({ favs: VR.Favs.list(), slots: [...document.querySelectorAll('#invpanel .palette .slot[data-id]')].map(x => x.dataset.id) })); if (g3.slots.length === 4) break; }
console.log('  game again', JSON.stringify(g3));
check(g3.favs.join() === s1.favs.join() && g3.slots.join() === s1.favs.join(), 'back in the game, its open ★ tab has them: ' + g3.slots.join(', '));
await studio.bringToFront();
// the game is not needed any more: let its page rest (two pages drawing in software rendering share two CPUs here)
try { await game.goto('about:blank', { timeout: 90000 }); } catch (e) { console.log('  (the game page did not rest: ' + e.message.split('\n')[0] + ')'); }

console.log('3 · the Crafter, the World and the Werkbank');
const s2 = await sev(async () => {
  window.__studio.selectHouse(0); window.__studioCore.setMode('craft');
  for (let i = 0; i < 480; i++) { await new Promise(r => setTimeout(r, 250)); if (VR.Crafter.house && VR.Crafter.gpu && window.__st.mode === 'craft' && document.querySelector('#chips button[data-pcat="fav"]')) break; }
  if (!document.querySelector('#chips button[data-pcat="fav"]')) return { err: 'no crafter: ' + window.__st.mode + ' ' + !!VR.Crafter.house + ' ' + document.getElementById('chips').innerText.slice(0, 200) };
  document.querySelector('#chips button[data-pcat="fav"]').click();
  const tiles = [...document.querySelectorAll('#list .tile')].map(t => t.dataset.id);
  // right click on the first tile of "Alle" takes it in
  document.querySelector('#chips button[data-pcat="all"]').click();
  const t0 = [...document.querySelectorAll('#list .tile')].find(t => !VR.Favs.has(t.dataset.id)); const id0 = t0.dataset.id;
  t0.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
  const n = +document.querySelector('#chips button[data-pcat="fav"] b').textContent;
  return { tiles, id0, n, favs: VR.Favs.list() };
});
console.log('  crafter', JSON.stringify(s2));
check(s2.tiles.join() === s1.favs.join(), 'the Crafter\'s palette has ★ Favoriten with the same four');
check(s2.favs[0] === s2.id0 && s2.n === 5, 'a right click on a tile makes it a favourite (★ 5)');
const s3 = await sev(async (id) => {
  window.__studioCore.setMode('world');
  for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 300)); if (VR.StudioWorld.worlds) break; }
  const WM = VR.StudioWorld; WM.open(WM.worlds.find(w => w.id === id));
  for (let i = 0; i < 400; i++) { await new Promise(r => setTimeout(r, 500)); if (WM.world && !WM.loading && WM.cols.size && WM.wb.region === WM.region) break; }
  WM.tab = 'furn'; window.__studioCore.chips(); window.__studioCore.list();
  const groups = [...document.querySelectorAll('#list .grp')].map(g => g.textContent);
  const firstGroup = []; let el = document.querySelector('#list .grp'); el = el && el.nextElementSibling;
  while (el && !el.classList.contains('grp')) { firstGroup.push(el.querySelector('.n') ? el.querySelector('.n').textContent : ''); el = el.nextElementSibling; }
  if (VR.UIPrefs) VR.UIPrefs.set({ pro: true });   // (W1: the Werkbank is a Profi tab — Einfach shows the Karte)
  WM.tab = 'bench'; window.__studioCore.chips(); window.__studioCore.list();
  const fb = document.querySelector('#list [data-wcat="fav"]'); if (fb) fb.click();
  const tiles = [...document.querySelectorAll('#list .tile')].map(t => t.dataset.id);
  return { world: !!WM.world, groups, firstGroup, chip: fb ? fb.textContent : null, tiles };
}, W.id);
console.log('  world', JSON.stringify(s3));
check(s3.world && s3.groups[0] === '★ Favoriten' && s3.firstGroup.length === 1, 'the World\'s furniture: ★ Favoriten first, with the sofa');
check(s3.chip && /Favoriten/.test(s3.chip) && s3.tiles.length === 5, 'the Werkbank\'s blocks: ★ Favoriten with all four (' + s3.tiles.join(', ') + ')');
await done();
