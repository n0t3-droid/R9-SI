// W1 „Eine Tür, eine Karte" (spec 2026-10-07-all-ages-workflow-design.md §8): one start screen with four picture tiles on
// the game and the R9 Studio; no world → ▶ reaches play in one click (Zen); the Einfach / Profi switch (r9si.ui) hides
// and shows the Studio's mode bar; the pause menu starts with „▶ Weiterspielen"; the page is German, the picker turns
// it English; the first hints come one at a time; every thing is a card with 👁 ✏️ ☆ 📍 📦; the Karte view commits every
// placement; ← restores where you were; the keyboard (Tab · Enter · Esc), 44 px targets, the 📜 entry (only with VR.Legal),
// English via /lang en; a phone-sized screen; no page errors. ONLY=1,4 runs only those sections.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const PORT = 8765 + Math.floor(Math.random() * 200);
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', '/home/claude/vr/dist'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 900));
const URL0 = `http://127.0.0.1:${PORT}`;
const NAV = { waitUntil: 'domcontentloaded', timeout: 180000 };
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
const page = await ctx.newPage();
const logs = [];
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 900)));
page.on('console', m => { if (m.type() === 'error' && !/favicon|404|QuotaExceeded|quota/i.test(m.text())) logs.push('[console] ' + m.text().slice(0, 300)); });
page.on('dialog', d => d.accept('Test'));
const ev = (fn, a) => page.evaluate(fn, a);
const wait = (ms) => page.waitForTimeout(ms);
const safe = async (fn, a) => { try { return await ev(fn, a); } catch (e) { return null; } };
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const shot = (n) => page.screenshot({ path: `/home/claude/vr/test/shots/${n}.png`, timeout: 180000 }).catch(() => {});
const ONLY = (process.env.ONLY || '').split(',').map(s => s.trim()).filter(Boolean);
const want = (n) => !ONLY.length || ONLY.includes(String(n));
const section = async (n, name, fn) => { if (!want(n)) return; console.log(n + ' · ' + name); try { await fn(); } catch (e) { fails++; console.log('  ✗ ' + name + ' broke: ' + String(e && e.message || e).slice(0, 400)); } };
const done = async () => { console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 14)) console.log(l); check(!logs.some(l => /pageerror/.test(l)), 'no page errors'); console.log(fails ? 'FAILED ' + fails : 'ALL OK'); await browser.close(); srv.kill(); process.exit(fails ? 1 : 0); };
// ---- helpers: the game
const atTitle = async (maxS = 150) => { for (let i = 0; i < maxS * 2; i++) { await wait(500); if (await safe(() => !!(window.VR && VR.game && VR.game.state === 'title'))) return true; } return false; };
const inPlay = async (maxS = 180) => { for (let i = 0; i < maxS * 2; i++) { await wait(500); if (await safe(() => { const g = window.VR && VR.game; return !!(g && g.state === 'play' && g.player && !g.player.hold && !g.studioOpen); })) return true; } return false; };
const lowSettings = () => ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.dynRes = false; g.settings.renderDist = 4; g.settings.horizon = 0; g.applySettings('*'); g.saveSettings(); });
const tiles = () => ev(() => [...document.querySelectorAll('#title .tile')].map(t => ({ tile: t.dataset.tile, label: (t.querySelector('.lbl') || t).textContent.trim(), pulse: t.classList.contains('pulse'), w: t.getBoundingClientRect().width, h: t.getBoundingClientRect().height })));
// a world to come back to (§4 and later sections run on their own too)
let WORLD = null;
const ensureWorld = async () => {
  if (WORLD) return WORLD;
  const ws = await ev(async () => (await VR.game.store.listWorlds()).map(w => w.id));
  if (ws.length) { WORLD = ws[0]; return WORLD; }
  await ev(() => VR.game.createWorld({ name: 'Meine Welt', mode: 'zen', difficulty: 'peaceful', type: 'flat', seed: '4711', cheats: true, kit: true }));
  check(await inPlay(), 'a world for the next sections');
  WORLD = await ev(() => VR.game.meta.id);
  await ev(() => VR.game.quitToTitle()); await atTitle();
  return WORLD;
};

await page.goto(URL0 + '/index.html', NAV);
check(await atTitle(), 'the game is at its start screen');
await lowSettings();

await section(1, 'the game\'s start screen: four tiles, German, ▶ pulses', async () => {
  const t = await tiles();
  console.log('  tiles', JSON.stringify(t));
  check(t.length === 4 && await ev(() => document.querySelectorAll('.tile').length) === 4, 'exactly four .tile');
  check(t.map(x => x.tile).join() === 'play,bauen,erschaffen,meins', 'in the order ▶ · 🏗 · ✨ · 🎒');
  check(t[0].label === '▶ Losspielen' && t[1].label === '🏗 Bauen' && t[2].label === '✨ Erschaffen' && t[3].label === '🎒 Meins', 'the German labels, „▶ Losspielen" with no world yet');
  check(t.every(x => x.w >= 160 && x.h >= 160), 'every tile is at least 160 px');
  check(t[0].pulse, 'the first visit: the ▶ tile pulses (hint 1)');
  check(await ev(() => document.documentElement.lang) === 'de', 'documentElement.lang is "de" (the browser speaks German)');
  const strip = await ev(() => ({ pro: !!document.querySelector('#title #proSwitch [data-pro="1"]'), pick: !!document.querySelector('#title .langpick .lp-btn'), set: (document.querySelector('#title [data-act="settings"]') || {}).textContent, sub: (document.querySelector('#title .sub') || {}).textContent, html: document.getElementById('title').textContent }));
  check(strip.pro && strip.pick && /Einstellungen/.test(strip.set || ''), 'the strip: Einfach | Profi, the language picker, ⚙ Einstellungen');
  check(/Andere Welt/.test(strip.sub || '') && /Neue Welt/.test(strip.sub || ''), 'under ▶: „Andere Welt · ＋ Neue Welt"');
  check(!/Quick Start|Select World|Create New World|Settings\b/.test(strip.html), 'no English menu text left on the start screen');
  await shot('start_game_einfach');
});

await section(2, '▶ Losspielen: one click into a Zen world', async () => {
  const ws0 = await ev(async () => (await VR.game.store.listWorlds()).length);
  if (ws0) { check(false, 'the profile already has a world (' + ws0 + ')'); return; }
  await page.click('#title .tile[data-tile="play"]');
  check(await inPlay(), 'one click → the game is in play');
  const m = await ev(() => ({ mode: VR.game.meta.mode, name: VR.game.meta.name, type: VR.game.meta.type, hints: JSON.parse(localStorage.getItem('r9si.hints') || '{}') }));
  console.log('  world', JSON.stringify(m));
  check(m.mode === 'zen' && /^Meine Welt/.test(m.name || '') && m.type === 'default', 'it is „Meine Welt" — Zen Builder, Realm');
  check(!!(m.hints.done && m.hints.done.play), 'hint 1 is done (the ▶ tile stops pulsing)');
  WORLD = await ev(() => VR.game.meta.id);
});

await section('2b', 'hints 2 and 3: one at a time, dismissed by doing the thing; a Ding handed into the world', async () => {
  await ensureWorld();
  if (!(await ev(() => VR.game.state === 'play'))) { await ev(async (id) => { const g = VR.game, ws = await g.store.listWorlds(); g.loadWorld(ws.find(w => w.id === id)); }, WORLD); check(await inPlay(), 'the world is open'); }
  await ev(() => { VR.Hints.reset(); VR.Hints.done('play'); });
  let on = false;
  for (let i = 0; i < 20 && !on; i++) { await wait(500); on = await ev(() => { const h = document.getElementById('hints'); return !!(h && h.classList.contains('on')); }); }
  const h2 = await ev(() => ({ cur: VR.Hints.current(), txt: (document.getElementById('hints') || {}).textContent || '', kbd: document.querySelectorAll('#hints kbd').length }));
  console.log('  hint 2', JSON.stringify(h2));
  check(on && h2.cur === 'move' && /W A S D/.test(h2.txt) && h2.kbd >= 4, 'after standing a while: „🖱 bewegen = umschauen · W A S D = laufen" with key caps');
  await page.keyboard.down('w'); await wait(700); await page.keyboard.up('w');
  await wait(400);
  const h3 = await ev(() => ({ st: JSON.parse(localStorage.getItem('r9si.hints')), cur: VR.Hints.current() }));
  check(h3.st.seen.move > 0 && h3.st.done.move > 0, 'walking marks move as seen and done (' + JSON.stringify(h3.st) + ')');
  let never2 = true, fly = false;
  for (let i = 0; i < 12; i++) { await wait(250); const r = await ev(() => ({ n: document.querySelectorAll('#hints .hint').length, cur: VR.Hints.current() })); if (r.n > 1) never2 = false; if (r.cur === 'fly') fly = true; }
  check(fly && await ev(() => /fliegen/.test(document.getElementById('hints').textContent)), 'then hint 3: „Leertaste 2× = fliegen"');
  check(never2, 'never two hints at once');
  for (let tries = 0; tries < 4; tries++) { await page.keyboard.press('Space'); await wait(100); await page.keyboard.press('Space'); await wait(700); if (await ev(() => VR.game.player.flying)) break; await wait(600); }   // (a slow software renderer may swallow a double tap)
  const h4 = await ev(() => ({ flying: VR.game.player.flying, done: !!JSON.parse(localStorage.getItem('r9si.hints')).done.fly, on: document.getElementById('hints').classList.contains('on') }));
  check(h4.flying && h4.done && !h4.on, 'a double tap on Space flies — hint 3 is done and gone (' + JSON.stringify(h4) + ')');
  // r9si.hand: a Ding set from the start screen is in your hand when the world opens
  const ha = await ev(() => [VR.Start.handAllowed({ mode: 'survival' }), VR.Start.handAllowed({ mode: 'zen' }), VR.Start.handAllowed({ mode: 'creative', guest: true })]);
  check(ha.join() === 'false,true,false', 'handAllowed: Survival no, Zen yes, a guest world no');
  await ev((id) => { localStorage.setItem('r9si.hand', JSON.stringify({ v: 1, ding: 'b:oak_planks', world: id, t: Date.now() })); VR.game.quitToTitle(); }, WORLD);
  check(await atTitle(), 'back at the start');
  await page.click('#title .tile[data-tile="play"]');
  check(await inPlay(), '▶ again');
  await wait(800);
  const hd = await ev(() => { const p = VR.game.player; return { held: p.inv.slots[p.inv.sel] && p.inv.slots[p.inv.sel].id, key: localStorage.getItem('r9si.hand') }; });
  check(hd.held === 'oak_planks' && hd.key === null, 'oak planks are in the selected hotbar slot, r9si.hand is read once (' + JSON.stringify(hd) + ')');
});

await section(3, 'the pause menu: ▶ Weiterspielen first; 🏗 Bauen opens the Karte over the game; „mein Platz"', async () => {
  await ensureWorld();
  if (!(await ev(() => VR.game.state === 'play'))) { await ev(async (id) => { const g = VR.game, ws = await g.store.listWorlds(); g.loadWorld(ws.find(w => w.id === id)); }, WORLD); check(await inPlay(), 'the world is open'); }
  await ev(() => VR.game.ui.pause());
  const vis = (sel) => ev((s) => [...document.querySelectorAll(s)].filter(b => b.getClientRects().length > 0).map(b => b.textContent.trim()), sel);
  const btns = await vis('#pause button');
  console.log('  pause', JSON.stringify(btns));
  await shot('start_pause_einfach');
  check(btns[0] === '▶ Weiterspielen', 'the first button is „▶ Weiterspielen"');
  for (const t of ['🏗 Bauen', '🎒 Meins', '🏠 Zu meinem Platz', '📍 Mein Platz ist hier', '⚙ Einstellungen', '⏏ Speichern & zum Start']) check(btns.includes(t), 'has „' + t + '"');
  check(!btns.some(b => /Codex|Foto|Werkbank/.test(b)), 'Einfach: no Codex, no Fotomodus, no Werkbank');
  check(!(await ev(() => { const b = document.getElementById('studiolive'); return !!(b && b.getClientRects().length); })), '#studiolive (the Werkbank) is hidden in Einfach');
  check(await ev(() => { const m = document.getElementById('mppanel'), mp = VR.game.mp; return mp && mp.ready ? m.getClientRects().length > 0 : !m.getClientRects().length; }), 'Einfach: the multiplayer box only where playing together works (here: ' + (await ev(() => !!(VR.game.mp && VR.game.mp.ready))) + ')');
  await ev(() => VR.UIPrefs.set({ pro: true })); await wait(100);
  const pro = await vis('#pause button');
  check(pro.some(b => /Codex/.test(b)) && pro.some(b => /Werkbank/.test(b)) && await ev(() => document.getElementById('studiolive').getClientRects().length > 0), 'Profi: Codex, Fotomodus and the Werkbank button show');
  check(await ev(() => document.getElementById('mppanel').getClientRects().length > 0), 'Profi: the multiplayer box shows, also to say why it does not work here');
  await shot('start_pause_profi');
  await ev(() => VR.UIPrefs.set({ pro: false })); await wait(100);
  // 📍 Mein Platz ist hier
  await page.click('#pause [data-act="sethome"]'); await wait(200);
  const sh = await ev(() => ({ hint: document.getElementById('hint').textContent, spawn: VR.game.player.spawn.map(v => +v.toFixed(1)), pos: VR.game.player.pos.map(v => +v.toFixed(1)) }));
  check(/Platz/.test(sh.hint) && !/Spawn/i.test(sh.hint) && Math.abs(sh.spawn[0] - sh.pos[0]) < 1 && Math.abs(sh.spawn[2] - sh.pos[2]) < 1, '📍 sets your spot where you stand and says „Platz" (' + sh.hint + ')');
  // chat commands are a Profi thing
  const cmd = await ev(() => { const g = VR.game, log = document.getElementById('chatlog'); const n0 = log.children.length; g.chat('/time set day'); const last = log.lastChild ? log.lastChild.textContent : ''; return { added: log.children.length - n0, last }; });
  check(cmd.added === 1 && /Profi/.test(cmd.last) && !/Time set/.test(cmd.last), 'Einfach: a /command answers with the Profi note (' + cmd.last + ')');
  // 🏗 Bauen → the Studio over the game, on the Karte
  await page.click('#pause [data-act="bauenlive"]');
  let up = false;
  for (let i = 0; i < 480 && !up; i++) { await wait(500); up = await safe(() => { const f = document.getElementById('studioFrame'); try { const w = f && f.contentWindow; return !!(w && w.VR && w.VR.StudioWorld && w.VR.StudioWorld.world && !w.VR.StudioWorld.loading && w.VR.StudioWorld.tab === 'karte'); } catch (e) { return false; } }); }
  const st = await safe(() => { const f = document.getElementById('studioFrame'); return { on: f && f.classList.contains('on'), open: VR.game.studioOpen, tab: f && f.contentWindow.VR.StudioWorld.tab }; });
  console.log('  overlay', JSON.stringify(st));
  check(up && st && st.on && st.open && st.tab === 'karte', '🏗 Bauen opens the Studio over the game on the Karte view');
  await ev(() => VR.game.closeStudio(true)); await wait(300);
  await ev(() => VR.game.quitToTitle());
  check(await atTitle(), 'back at the start screen');
});

await section(4, 'worlds as cards, 🗑 asks twice, the picker, ＋ Neue Welt in Profi', async () => {
  await ensureWorld();
  check((await tiles())[0].label === '▶ Weiterspielen', 'with a world the tile reads „▶ Weiterspielen"');
  await page.click('#title .sub [data-act="worlds"]');
  await wait(600);
  const w = await ev(() => { const cards = [...document.querySelectorAll('#worlds .wcard')]; return { on: document.getElementById('worlds').classList.contains('on'), n: cards.length, btns: cards[0] ? [...cards[0].querySelectorAll('button')].map(b => b.dataset.w) : [], h: (document.querySelector('#worlds h2') || {}).textContent, newBtn: (document.querySelector('#worlds [data-act="newworld"]') || {}).textContent, back: (document.querySelector('#worlds [data-act="back"]') || {}).textContent }; });
  console.log('  worlds', JSON.stringify(w));
  check(w.on && w.n >= 1 && w.btns.join() === 'play,bauen,rename,del', 'the worlds screen: a card per world with ▶ 🏗 ✎ 🗑');
  check(/Welt/.test(w.h || '') && /Neue Welt/.test(w.newBtn || '') && /Zurück/.test(w.back || ''), 'German: „Welten", „＋ Neue Welt", „← Zurück"');
  await page.click('#worlds .wcard [data-w="del"]'); await wait(150);
  const d1 = await ev(() => ({ txt: document.querySelector('#worlds .wcard [data-w="del"]').textContent, n: document.querySelectorAll('#worlds .wcard').length }));
  check(/Sicher/.test(d1.txt) && d1.n >= 1, '🗑 once only arms: „' + d1.txt + '"');
  await page.click('#worlds h2'); await wait(150);
  const d2 = await ev(() => ({ txt: document.querySelector('#worlds .wcard [data-w="del"]').textContent, n: document.querySelectorAll('#worlds .wcard').length }));
  check(!/Sicher/.test(d2.txt) && d2.n === d1.n, 'a click elsewhere disarms it, the world stays');
  await page.click('#worlds [data-act="back"]'); await wait(300);
  check(await ev(() => document.getElementById('title').classList.contains('on')), '„← Zurück" returns to the start screen');
  // the language picker
  await page.click('#title .langpick .lp-btn'); await wait(200);
  await page.click('#title .langpick .lp-item:has-text("English")'); await wait(300);
  const en = await tiles();
  check(en[0].label === '▶ Play on' && en[1].label === '🏗 Build' && en[2].label === '✨ Create' && en[3].label === '🎒 Mine' && await ev(() => document.documentElement.lang) === 'en', 'English: „▶ Play on · 🏗 Build · ✨ Create · 🎒 Mine", lang = en (' + en.map(x => x.label).join(' · ') + ')');
  await page.click('#title .langpick .lp-btn'); await wait(200);
  await page.click('#title .langpick .lp-item:has-text("Deutsch")'); await wait(300);
  check((await tiles())[0].label === '▶ Weiterspielen', 'and back to German');
  // Profi: ＋ Neue Welt opens the (German) form; Einfach makes a world at once
  await page.click('#title #proSwitch [data-pro="1"]'); await wait(200);
  const pro = await ev(() => ({ ui: JSON.parse(localStorage.getItem('r9si.ui') || '{}'), cls: document.documentElement.classList.contains('pro'), onBtn: (document.querySelector('#title #proSwitch button.on') || {}).textContent }));
  check(pro.ui.pro === true && pro.cls && /Profi/.test(pro.onBtn || ''), 'Profi: r9si.ui.pro = true, html.pro, the switch shows it');
  await page.click('#title .sub [data-act="newworld"]'); await wait(400);
  const cf = await ev(() => ({ on: document.getElementById('create').classList.contains('on'), h: (document.querySelector('#create h2') || {}).textContent, labels: [...document.querySelectorAll('#create .field label')].map(l => l.textContent.trim()), go: (document.querySelector('#create [data-act="docreate"]') || {}).textContent, modes: [...document.querySelectorAll('#cw_mode button')].map(b => b.textContent.trim().split('\n')[0]) }));
  console.log('  create', JSON.stringify(cf));
  check(cf.on && /Neue Welt/.test(cf.h || '') && cf.labels.some(l => /Weltname/.test(l)) && /erstellen/i.test(cf.go || ''), 'Profi ＋ Neue Welt: the German create form');
  check(await ev(() => { const b = document.querySelector('#cw_mode button[data-v="zen"]'); b.click(); return b.classList.contains('on') && document.querySelectorAll('#cw_mode button.on').length === 1; }), 'the form\'s mode buttons still toggle');
  await page.click('#create [data-act="toworlds"]'); await wait(300);
  await page.click('#worlds [data-act="back"]'); await wait(300);
  await shot('start_game_profi');
  await page.click('#title #proSwitch [data-pro="0"]'); await wait(200);
  check(await ev(() => !document.documentElement.classList.contains('pro')), 'back to Einfach');
});

await section('4b', '🎒 Meins in the game: your things as cards with the five actions', async () => {
  if (!(await safe(() => !!(window.VR && VR.game)))) { await page.goto(URL0 + '/index.html', NAV); check(await atTitle(), 'the game'); }
  if (!(await ev(() => VR.game.state === 'title'))) { await ev(() => VR.game.quitToTitle()); await atTitle(); }
  await ensureWorld();
  await ev(() => { VR.Favs.add('oak_planks'); });
  await page.click('#title .tile[data-tile="meins"]'); await wait(500);
  const m = await ev(() => { const c = document.querySelector('#meins .ding[data-ding="b:oak_planks"]'); return { on: document.getElementById('meins').classList.contains('on'), card: !!c, acts: c ? [...c.querySelectorAll('.dacts button')].map(b => b.textContent) : [], chips: [...document.querySelectorAll('#meins .mchips button')].map(b => b.textContent), worlds: document.querySelectorAll('#meins .wcard').length, h: document.querySelector('#meins h2').textContent, pic: !!(c && c.querySelector('.pic.has canvas')) }; });
  console.log('  meins', JSON.stringify(m));
  check(m.on && m.card && m.acts.length === 5 && ['👁', '✏️', '★', '📍', '📦'].every((g, i) => m.acts[i].startsWith(g)), 'the favourite oak planks: 👁 ✏️ ★ 📍 📦');
  check(m.pic, 'its picture is painted at once (the game\'s own icon, no placeholder)');
  check(/Meins/.test(m.h) && m.chips.length >= 5 && m.worlds >= 1, '„🎒 Meins" with chips and the worlds as cards');
  await shot('start_meins_game');
  await page.click('#meins [data-act="meinsback"]'); await wait(300);
  check(await ev(() => document.getElementById('title').classList.contains('on')), '„← Zurück" returns to the start screen');
});

// ---- the R9 Studio
const booted = async (houses) => { for (let i = 0; i < 700; i++) { await wait(500); const st = await safe(() => ({ boot: document.getElementById('studio').classList.contains('boot'), houses: window.__studio ? window.__studio.HOUSE.size : -1, tex: !!(window.__studioCore && window.__studioCore.texInfo()) })); if (st && !st.boot && st.tex && st.houses >= (houses || 1)) return true; } return false; };
const inStudio = async (id, maxS = 300) => { for (let i = 0; i < maxS * 2; i++) { await wait(500); if (await safe((id) => { const WM = window.VR && VR.StudioWorld; return !!(WM && WM.world && WM.world.id === id && !WM.loading && WM.cols.size && document.getElementById('playBtn')); }, id)) return true; } return false; };

await section(5, 'the Studio: four tiles in the header, the mode bar waits behind Profi, no 🔌 banner', async () => {
  await page.goto(URL0 + '/studio.html', NAV);
  for (let i = 0; i < 120; i++) { await wait(500); if (await safe(() => !!(window.VR && VR.StudioStart && document.querySelectorAll('.tile').length))) break; }
  const t = await ev(() => ({ n: document.querySelectorAll('.tile').length, tiles: [...document.querySelectorAll('.tile')].map(x => ({ tile: x.dataset.tile, label: (x.querySelector('.lbl') || x).textContent.trim(), w: x.getBoundingClientRect().width, h: x.getBoundingClientRect().height })), play: !!document.querySelector('.tile#playBtn'), modes: document.querySelector('nav.modes').getClientRects().length, nMode: document.querySelectorAll('nav.modes button[data-mode]').length, bar: !!document.getElementById('bridgeBar'), pro: document.getElementById('studio').classList.contains('pro'), sw: !!document.querySelector('#proSwitch [data-pro="1"]'), lang: document.documentElement.lang }));
  console.log('  studio', JSON.stringify(t));
  check(t.n === 4 && t.tiles.map(x => x.tile).join() === 'play,bauen,erschaffen,meins', 'exactly four .tile: ▶ · 🏗 · ✨ · 🎒');
  check(t.tiles.every(x => x.w >= 160 && x.h >= 44), 'each at least 160 px wide and 44 px tall in the header');
  check(t.play && /^▶/.test(t.tiles[0].label), 'the ▶ tile is #playBtn and reads „' + t.tiles[0].label + '"');
  check(t.tiles[1].label === '🏗 Bauen' && t.tiles[2].label === '✨ Erschaffen' && t.tiles[3].label === '🎒 Meins', 'German labels');
  check(!t.pro && t.modes === 0 && t.nMode === 6, 'Einfach: nav.modes is hidden (its 6 mode buttons wait)');
  check(t.sw && !t.bar && t.lang === 'de', 'the Profi switch is in the header, no 🔌 banner, lang = de');
  check(await ev(() => { const b = document.getElementById('legalBtn'); return !!b && b.hidden && !b.getClientRects().length; }), 'no 📜 in the header while there is no VR.Legal');
  check(await ev(() => { VR.Legal = { open: () => { window.__legal = 1; } }; VR.StudioStart.legal(); const b = document.getElementById('legalBtn'); b.click(); const r = b.getClientRects().length > 0 && window.__legal === 1; delete VR.Legal; VR.StudioStart.legal(); return r && b.hidden; }), 'with VR.Legal the 📜 shows and opens it');
  check(await ev(() => [...document.querySelectorAll('#studio header button')].filter(b => b.getClientRects().length).every(b => { const r = b.getBoundingClientRect(); return r.height >= 44 && r.width >= 44; })), 'every header button is at least 44 × 44 px');
  await ev(() => VR.UIPrefs.set({ pro: true })); await wait(150);
  const p = await ev(() => ({ pro: document.getElementById('studio').classList.contains('pro'), modes: [...document.querySelectorAll('nav.modes button[data-mode]')].filter(b => b.getClientRects().length > 0).map(b => b.dataset.mode), proT: document.querySelector('.tabs .proT').classList.contains('on'), tabs: [...document.querySelectorAll('#right .tabs .tab')].filter(t => t.getClientRects().length > 0).length, mem: localStorage.getItem('r9si.studio.pro') }));
  console.log('  profi', JSON.stringify(p));
  check(p.pro && p.modes.join() === 'arch,furn,facade,parts,craft,world', 'Profi: the six mode buttons show (' + p.modes.join(' · ') + ')');
  check(await ev(() => ![...document.querySelectorAll('nav.modes [data-hub], nav.modes [data-create]')].some(b => b.getClientRects().length)), 'the mode bar does not repeat the tiles (no 🕘 Weitermachen, no second ✨)');
  check(p.proT && p.tabs === 5 && p.mem === '1', 'the ⚙ Profi of the right side is the same switch (five tabs, r9si.studio.pro = 1)');
  await booted(1);
  await shot('start_studio_profi');
  await page.click('.tabs .proT'); await wait(150);
  const e = await ev(() => ({ pro: document.getElementById('studio').classList.contains('pro'), modes: document.querySelector('nav.modes').getClientRects().length, ui: JSON.parse(localStorage.getItem('r9si.ui')).pro, sw: (document.querySelector('#proSwitch button.on') || {}).textContent }));
  check(!e.pro && e.modes === 0 && e.ui === false && /Einfach/.test(e.sw || ''), '⚙ Profi again → Einfach everywhere (r9si.ui.pro = false, the mode bar gone)');
  await shot('start_studio_einfach');
  // the standalone Studio: ▶ reads 🎮 Zum Spiel, no 🔌 banner
  await page.goto(URL0 + '/studio_artifact.html', NAV);
  for (let i = 0; i < 120; i++) { await wait(500); if (await safe(() => !!(window.VR && VR.StudioStart && document.querySelectorAll('.tile').length))) break; }
  const sa = await ev(() => ({ n: document.querySelectorAll('.tile').length, play: (document.querySelector('.tile[data-tile="play"] .lbl') || {}).textContent, bar: !!document.getElementById('bridgeBar'), playId: !!document.getElementById('playBtn') }));
  console.log('  standalone', JSON.stringify(sa));
  check(sa.n === 4 && /Zum Spiel/.test(sa.play || '') && !sa.bar && !sa.playId, 'standalone: four tiles, ▶ reads „🎮 Zum Spiel", no 🔌 banner, no #playBtn');
});

await section(6, 'the Karte view: cards left, 📍 Setzen = the ghost, every click commits', async () => {
  if (!WORLD) { await page.goto(URL0 + '/index.html', NAV); check(await atTitle(), 'the game'); await ensureWorld(); }
  await page.goto(URL0 + '/studio.html#world/' + encodeURIComponent(WORLD) + '/karte', NAV);
  check(await inStudio(WORLD), 'the Studio opens the world');
  const k0 = await ev(() => ({ tab: VR.StudioWorld.tab, mode: window.__st.mode, chips: [...document.querySelectorAll('#chips button')].map(b => b.dataset.kcat || b.textContent.trim()), help: (document.getElementById('worldHelp') || {}).getClientRects ? document.getElementById('worldHelp').getClientRects().length : 0, bauenOn: document.querySelector('#tiles .tile[data-tile="bauen"]').classList.contains('on') }));
  console.log('  karte', JSON.stringify(k0));
  check(k0.tab === 'karte' && k0.mode === 'world' && k0.bauenOn, 'on the Karte tab, the 🏗 tile lit');
  check(k0.chips.includes('house') && k0.chips.includes('furn') && k0.chips.includes('fav') && !k0.chips.some(c => /Werkbank|Stil|Plan/.test(c)), 'Einfach chips: ★ · 🏠 Häuser · 🪑 Möbel (no Werkbank, Stil, Plan)');
  await page.click('#chips button[data-kcat="house"]'); await wait(300);
  const k1 = await ev(() => { const cards = [...document.querySelectorAll('#list .ding')]; const first = cards[0]; return { n: cards.length, acts: first ? [...first.querySelectorAll('.dacts button')].map(b => ({ t: b.textContent, da: b.dataset.da, dis: b.disabled })) : [], id: first && first.dataset.ding, commitBtn: [...document.querySelectorAll('#partsBody button')].some(b => /übernehmen|In die Welt/i.test(b.textContent)), pic: first && first.querySelector('.pic').getBoundingClientRect().height }; });
  console.log('  cards', JSON.stringify(k1));
  check(k1.n >= 11 && /^h:\d+$/.test(k1.id || ''), 'eleven house cards (first: ' + k1.id + ')');
  check(k1.acts.length === 5 && ['👁', '✏️', '☆', '📍', '📦'].every((g, i) => k1.acts[i] && k1.acts[i].t.startsWith(g)) && k1.acts.every(a => !a.dis), 'the five actions in order, none disabled');
  check(k1.pic >= 56, 'the picture is at least 56 px (' + k1.pic + ')');
  check(!k1.commitBtn, 'no „⬆ In die Welt übernehmen" anywhere');
  await page.click('#list .ding [data-da="set"]'); await wait(200);
  check(await ev(() => !!(VR.StudioWorld.tool && VR.StudioWorld.tool.kind === 'house')), '📍 Setzen puts the house in hand (the ghost)');
  let mesh = false; for (let i = 0; i < 240 && !mesh; i++) { await wait(500); mesh = await ev(() => !!VR.StudioWorld.meshFor(VR.StudioWorld.tool)); }
  check(mesh, 'its mesh is ready');
  const box = await ev(() => { const r = document.getElementById('view').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, l: r.left, t: r.top }; });
  const plans = () => ev((id) => { const d = JSON.parse(localStorage.getItem('r9si.plans.' + id) || '{"plans":[]}'); return d.plans.map(p => p.status); }, WORLD);
  const n0 = (await plans()).length;
  await page.mouse.move(box.x, box.y); await wait(150);
  await page.mouse.click(box.x, box.y); await wait(600);
  const k2 = await ev(() => ({ tool: !!VR.StudioWorld.tool, tip: (document.getElementById('worldTip') || {}).textContent || '', plans: VR.StudioWorld.plans.map(p => p.status) }));
  const st = await plans();
  console.log('  placed', JSON.stringify(k2), JSON.stringify(st));
  check(st.length === n0 + 1 && st[st.length - 1] === 'pending', 'one click: the plan is in r9si.plans as pending — no further button (' + st.join(',') + ')');
  check(k2.tool && /gesetzt/.test(k2.tip), 'the house stays in hand; the tip says „gesetzt" (' + k2.tip + ')');
  // nothing under the pointer: nothing happens, the tool stays
  await ev(() => { VR.StudioWorld.ghost = null; VR.StudioWorld.hover = null; });
  await page.mouse.down(); await page.mouse.up(); await wait(300);
  const k3 = await ev(() => ({ tool: !!VR.StudioWorld.tool, tip: (document.getElementById('worldTip') || {}).textContent || '' }));
  check((await plans()).length === n0 + 1 && k3.tool && /Boden/.test(k3.tip), 'a click with no ground under the pointer places nothing and says „Zeig auf den Boden" (' + k3.tip + ')');
  // the right mouse button places too (the owner's decision 1)
  await page.mouse.move(box.x + 60, box.y + 20); await wait(150);
  await page.mouse.click(box.x + 60, box.y + 20, { button: 'right' }); await wait(600);
  const st2 = await plans();
  check(st2.length === n0 + 2 && await ev(() => !!VR.StudioWorld.tool), 'the right button places as well, the tool stays (' + st2.length + ' plans)');
  await page.keyboard.press('Escape'); await wait(200);
  check(await ev(() => VR.StudioWorld.tool === null), 'Esc puts it away');
  await shot('start_karte');
});

await section(7, 'Profi keeps its Plan tab — „📍 Alle setzen"', async () => {
  if (!(await ev(() => !!(VR.StudioWorld && VR.StudioWorld.world)))) { check(false, 'no world open'); return; }
  await ev(() => VR.UIPrefs.set({ pro: true })); await wait(200);
  const chips = await ev(() => [...document.querySelectorAll('#chips button')].map(b => b.textContent.trim()));
  check(chips.some(c => /Karte/.test(c)) && chips.some(c => /Werkbank/.test(c)) && chips.some(c => /Plan/.test(c)), 'Profi chips: Karte · Werkbank · Häuser · Möbel · Plan · Stil · Welten (' + chips.join(' | ') + ')');
  await ev(() => { VR.StudioWorld.tab = 'plan'; VR.StudioWorld.refresh(); }); await wait(300);
  const btn = await ev(() => [...document.querySelectorAll('#partsBody button')].map(b => b.textContent.trim()).find(t => /Alle setzen|übernehmen/.test(t)));
  check(/^📍 Alle setzen/.test(btn || ''), 'the Plan tab\'s button reads „📍 Alle setzen (n)" (' + btn + ')');
  await ev(() => VR.UIPrefs.set({ pro: false })); await wait(200);
});

await section(8, '🎒 Meins in the Studio: the hub as cards — ☆ on a k: card, 📦 Teilen one thing', async () => {
  await page.goto(URL0 + '/studio.html', NAV);
  check(await booted(1), 'the Studio is up');
  // a Baukasten house (a k: thing), a favourite block  (the hub may have opened by itself: something to continue)
  await ev(() => { if (VR.Projects.isOpen()) VR.Projects.show(false); VR.StudioWorld.imagine.open(null, 'house'); }); await wait(900);
  await page.click('#imagine [data-hs="style"][data-v="modern"]'); await wait(2500);
  await ev(() => { VR.StudioWorld.imagine.close(); VR.Favs.add('oak_planks'); });
  const kit = await ev(() => Object.values(JSON.parse(localStorage.getItem('r9si.projects')).items).find(p => p.kind === 'kit'));
  check(!!kit, 'a Baukasten house exists (' + (kit && kit.id) + ')');
  await page.click('#tiles .tile[data-tile="meins"]'); await wait(700);
  const h = await ev((kid) => { const c = document.querySelector('#hub .pj.ding[data-id="' + kid + '"]'); const fav = document.querySelector('#hub .ding[data-ding="b:oak_planks"]'); return { on: !!document.querySelector('#hub.on'), head: (document.querySelector('#hub header .t') || {}).textContent, kcard: !!c, kacts: c ? [...c.querySelectorAll('.dacts button')].map(b => b.dataset.da) : [], favSection: [...document.querySelectorAll('#hub h4')].map(x => x.textContent.trim()), favCard: !!fav, favActs: fav ? [...fav.querySelectorAll('.dacts button')].map(b => b.textContent) : [], meinsOn: document.querySelector('#tiles .tile[data-tile="meins"]').classList.contains('on') }; }, kit.id);
  console.log('  hub', JSON.stringify(h));
  check(h.on && /Meins/.test(h.head || '') && h.meinsOn, '🎒 opens Meins (the 🎒 tile lit)');
  check(h.kcard && h.kacts.join() === 'view,edit,fav,set', 'the k: card: 👁 ✏️ ☆ 📍 (W2: 📍 puts its Bauteil on the Karte; 📦 comes with B1 — absent, not greyed)');
  check(h.favCard && h.favActs.length === 5 && h.favSection.some(x => /Favoriten/.test(x)), 'a ★ Favoriten section with the oak planks card and all five actions');
  await page.click('#hub .pj.ding[data-id="' + kit.id + '"] [data-da="fav"]'); await wait(200);
  const favs = await ev(() => JSON.parse(localStorage.getItem('r9si.favs')).items);
  check(favs.includes('k:' + kit.id), '☆ on the k: card reaches r9si.favs (' + favs.join(',') + ')');
  await ev(() => { VR.Ding.download = (name, text) => { window.__pack = { name, text }; return Promise.resolve(true); }; });
  await page.click('#hub .ding[data-ding="b:oak_planks"] [data-da="share"]'); await wait(300);
  const pk = await ev(() => { const p = window.__pack; if (!p) return null; const s = VR.Pack.summary(VR.Pack.read(p.text)); return { name: p.name, total: s.favs + s.houses + s.models + s.lib, favs: VR.Pack.read(p.text).favs }; });
  check(pk && pk.total === 1 && pk.favs.join() === 'oak_planks' && /oak-planks/.test(pk.name), '📦 Teilen yields a one-entry pack (' + (pk && pk.name) + ')');
  await shot('start_meins_studio');
  await page.keyboard.press('Escape'); await wait(200);
  check(await ev(() => !document.querySelector('#hub.on')), 'Esc closes it');
});

await section(9, 'routes: #ding/<id> opens the thing, an unknown one only says so', async () => {
  await page.goto(URL0 + '/studio.html#ding/h:99', NAV);
  check(await booted(1), 'the Studio boots on a link to a house that does not exist');
  let toast = '';
  for (let i = 0; i < 20 && !toast; i++) { await wait(500); toast = await ev(() => (document.getElementById('pjToast') || {}).textContent || ''); }
  check(/nicht/.test(toast), 'it says the thing is not here (' + toast + ')');
  await page.goto(URL0 + '/studio.html#ding/h:3', NAV);
  check(await booted(4), 'the Studio boots on #ding/h:3');
  let sc = null;
  for (let i = 0; i < 60; i++) { await wait(500); sc = await ev(() => { const S = window.__st; return S.scene ? { type: S.scene.type, index: S.scene.index, mode: S.mode } : null; }); if (sc && sc.type === 'house' && sc.index === 3) break; }
  check(sc && sc.type === 'house' && sc.index === 3 && sc.mode === 'arch', '#ding/h:3 shows Bel Portale (' + JSON.stringify(sc) + ')');
});

await section(10, '← restores where you were: ✏️ from a card → the editor → ←; 👁 from Meins → Esc', async () => {
  if (!WORLD) { await page.goto(URL0 + '/index.html', NAV); check(await atTitle(), 'the game'); await ensureWorld(); }
  await page.goto(URL0 + '/studio.html?r=' + Date.now() + '#world/' + encodeURIComponent(WORLD) + '/karte', NAV);   // (a fresh query: a hash-only change would not reload the Studio)
  check(await inStudio(WORLD), 'the Karte view');
  await page.click('#chips button[data-kcat="furn"]'); await wait(400);
  const id3 = await ev(() => { const l = document.getElementById('list'); l.scrollTop = 140; const c = l.querySelectorAll('.ding')[3]; return c && c.dataset.ding; });
  const editBtn = page.locator(`#list .ding[data-ding="${id3}"] [data-da="edit"]`);
  await editBtn.scrollIntoViewIfNeeded();   // (a click scrolls its target into view first: measure after that)
  const before = await ev((id) => { const l = document.getElementById('list'); return { id, scroll: l.scrollTop, scene: window.__st.scene && window.__st.scene.type, center: window.__st.scene.center.slice() }; }, id3);
  console.log('  before', JSON.stringify(before));
  check(before.id && before.scroll > 0 && before.scene === 'world', 'a furniture card, the list scrolled (' + before.scroll + ')');
  await editBtn.click();
  let craft = false; for (let i = 0; i < 120 && !craft; i++) { await wait(500); craft = await ev(() => window.__st.mode === 'craft' && !!(VR.Crafter.item && VR.Crafter.on)); }
  const inEd = await ev(() => ({ mode: window.__st.mode, item: VR.Crafter.item && VR.Crafter.item.name, depth: VR.Nav.depth(), crumb: document.getElementById('navCrumb').textContent, kind: VR.Nav.top() && VR.Nav.top().kind }));
  console.log('  editor', JSON.stringify(inEd));
  check(craft && inEd.item === before.id.slice(2) && inEd.depth === 1 && inEd.kind === 'editor', '✏️ opens the Item-Crafter on it as a layer');
  check(/Karte/.test(inEd.crumb) && /✏️/.test(inEd.crumb), 'the breadcrumb reads „🗺 Karte › ✏️" (' + inEd.crumb.trim() + ')');
  await page.click('#navCrumb .back'); await wait(700);
  const back = await ev((id) => { const l = document.getElementById('list'), c = l.querySelector(`.ding[data-ding="${id}"]`); return { mode: window.__st.mode, scene: window.__st.scene && window.__st.scene.type, tab: VR.StudioWorld.tab, scroll: l.scrollTop, on: !!(c && c.classList.contains('on')), depth: VR.Nav.depth(), center: window.__st.scene && window.__st.scene.center.slice(), crumb: document.getElementById('navCrumb').classList.contains('on') }; }, before.id);
  console.log('  back', JSON.stringify(back));
  check(back.mode === 'world' && back.scene === 'world' && back.tab === 'karte', '← is back on the Karte (S.scene is the world again)');
  check(Math.abs(back.scroll - before.scroll) <= 2 && back.on, 'the list is scrolled as before (' + back.scroll + ' vs ' + before.scroll + ') and the card is the lit one');
  check(back.depth === 0 && !back.crumb && before.center.every((v, i) => Math.abs(v - back.center[i]) < 1e-6), 'the stack is empty, the camera where it was');
  // the Crafter's own ✕ / „← Welt" also pops the layer
  await page.click(`#list .ding[data-ding="${before.id}"] [data-da="edit"]`);
  craft = false; for (let i = 0; i < 120 && !craft; i++) { await wait(500); craft = await ev(() => window.__st.mode === 'craft' && !!(VR.Crafter.item && VR.Crafter.on)); }
  await ev(() => VR.Crafter.back()); await wait(700);
  check(await ev(() => window.__st.mode === 'world' && VR.Nav.depth() === 0 && VR.StudioWorld.tab === 'karte'), 'the Crafter\'s own ← pops the same layer');
  // 👁 from 🎒 Meins: Esc brings Meins back, scrolled as it was
  await ev(() => { VR.Favs.add('blueprint_3'); VR.Favs.add('oak_planks'); VR.Favs.add('vx_led_cove'); });
  await page.click('#tiles .tile[data-tile="meins"]'); await wait(600);
  const hb = await ev(() => { const b = document.querySelector('#hub .hubBody'); b.scrollTop = 200; const c = document.querySelector('#hub .ding[data-ding="h:3"]'); return { scroll: b.scrollTop, card: !!c, max: b.scrollHeight - b.clientHeight }; });
  console.log('  hub', JSON.stringify(hb));
  check(hb.card, 'Meins shows the Bel Portale card');
  const viewBtn = page.locator('#hub .ding[data-ding="h:3"] [data-da="view"]');
  await viewBtn.scrollIntoViewIfNeeded();   // (a click scrolls its target into view first: measure after that)
  const hs = await ev(() => document.querySelector('#hub .hubBody').scrollTop);
  await viewBtn.click();
  for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => window.__st.scene && window.__st.scene.type === 'house' && window.__st.scene.index === 3)) break; }   // (the house may still be being built)
  const v = await ev(() => ({ hub: !!document.querySelector('#hub.on'), depth: VR.Nav.depth(), scene: window.__st.scene && window.__st.scene.type, index: window.__st.scene && window.__st.scene.index, crumb: document.getElementById('navCrumb').textContent }));
  console.log('  view', JSON.stringify(v));
  check(!v.hub && v.depth === 1 && v.scene === 'house' && v.index === 3 && /Meins/.test(v.crumb), '👁 shows the house as a layer over Meins (' + v.crumb.trim() + ')');
  await page.keyboard.press('Escape'); await wait(500);
  const e = await ev(() => ({ hub: !!document.querySelector('#hub.on'), scroll: document.querySelector('#hub .hubBody').scrollTop, depth: VR.Nav.depth() }));
  check(e.hub && e.depth === 0 && Math.abs(e.scroll - hs) <= 2 && hs > 0, 'Esc: Meins is back, scrolled as before (' + e.scroll + ' vs ' + hs + ')');
  await page.keyboard.press('Escape'); await wait(200);
});

await section(11, 'a phone-sized screen: the start screen fits, no sideways scroll', async () => {
  const ph = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'de-DE', isMobile: true, hasTouch: true });
  const pp = await ph.newPage();
  pp.on('pageerror', e => logs.push('[pageerror phone] ' + (e.stack || e.message).slice(0, 600)));
  await pp.goto(URL0 + '/index.html', NAV);
  let ok = false; for (let i = 0; i < 300 && !ok; i++) { await pp.waitForTimeout(500); ok = await pp.evaluate(() => !!(window.VR && VR.game && VR.game.state === 'title')).catch(() => false); }
  check(ok, 'the game starts on a phone-sized screen');
  const m = await pp.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, tiles: [...document.querySelectorAll('#title .tile')].map(t => { const r = t.getBoundingClientRect(); return { w: r.width, h: r.height, right: r.right, left: r.left }; }), fs: getComputedStyle(document.querySelector('#title .tile .lbl')).fontSize }));
  console.log('  phone', JSON.stringify(m));
  check(m.sw <= m.iw && m.tiles.every(t => t.right <= 390 && t.left >= 0), 'nothing sticks out sideways');
  check(m.tiles.length === 4 && m.tiles.every(t => t.w >= 150 && t.h >= 150), 'four tiles, each at least 150 px');
  await pp.screenshot({ path: '/home/claude/vr/test/shots/start_phone.png', fullPage: false });
  const tgt = await pp.evaluate(() => [...document.querySelectorAll('#title button')].filter(b => b.getClientRects().length).map(b => { const r = b.getBoundingClientRect(); return { t: b.textContent.trim().slice(0, 16), w: Math.round(r.width), h: Math.round(r.height) }; }).filter(x => x.w < 44 || x.h < 44));
  check(!tgt.length, 'every button is at least 44 × 44 px to tap' + (tgt.length ? ': ' + JSON.stringify(tgt) : ''));
  await pp.evaluate(() => VR.UIPrefs.set({ pro: true })); await pp.waitForTimeout(300);
  await pp.screenshot({ path: '/home/claude/vr/test/shots/start_phone_profi.png', fullPage: false });
  check(await pp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Profi on a phone: no sideways scroll either');
  await pp.evaluate(() => VR.UIPrefs.set({ pro: false }));
  // the R9 Studio's front door on a phone
  await pp.goto(URL0 + '/studio.html', NAV);
  let st = false; for (let i = 0; i < 240 && !st; i++) { await pp.waitForTimeout(500); st = await pp.evaluate(() => !!(window.VR && VR.StudioStart && document.querySelectorAll('#tiles .tile').length === 4 && !document.getElementById('studio').classList.contains('boot'))).catch(() => false); }
  await pp.waitForTimeout(1500);
  const sp = await pp.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, tiles: [...document.querySelectorAll('#tiles .tile')].map(t => { const r = t.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right) }; }) }));
  console.log('  studio phone', JSON.stringify(sp));
  check(st && sp.tiles.length === 4 && sp.tiles.every(t => t.right <= 390 && t.h >= 44), 'the Studio on a phone: four tiles in the header, none sticks out');
  await pp.screenshot({ path: '/home/claude/vr/test/shots/start_studio_phone.png', fullPage: false });
  await ph.close();
});

await section(12, 'keyboard, 📜 and English: Tab lands on ▶, Enter and Esc, the 📜 only with VR.Legal, /lang en in Einfach', async () => {
  await page.goto(URL0 + '/index.html', NAV);
  check(await atTitle(), 'the game is at its start screen');
  await ev(() => VR.UIPrefs.set({ pro: false }));
  await wait(400);
  await page.keyboard.press('Tab');
  const f1 = await ev(() => { const a = document.activeElement; return { tile: a && a.dataset ? a.dataset.tile : null, ring: a ? getComputedStyle(a).boxShadow : '' }; });
  check(f1.tile === 'play' && /rgb/.test(f1.ring), 'the first Tab lands on ▶, with a ring (' + JSON.stringify(f1).slice(0, 120) + ')');
  for (let i = 0; i < 3; i++) await page.keyboard.press('Tab');
  check(await ev(() => document.activeElement && document.activeElement.dataset.tile) === 'meins', 'Tab walks the tiles in order: ▶ · 🏗 · ✨ · 🎒');
  await page.keyboard.press('Enter'); await wait(600);
  const mk = await ev(() => ({ on: document.getElementById('meins').classList.contains('on'), focus: document.activeElement && document.activeElement.closest('#meins') ? true : false }));
  check(mk.on && mk.focus, 'Enter on 🎒 opens Meins, the focus goes with it');
  await page.keyboard.press('Escape'); await wait(300);
  check(await ev(() => document.getElementById('title').classList.contains('on')), 'Esc brings the start screen back');
  await ev(() => document.querySelector('#title [data-act="worlds"]').focus()); await page.keyboard.press('Enter'); await wait(600);
  const wk = await ev(() => ({ on: document.getElementById('worlds').classList.contains('on'), focus: document.activeElement && document.activeElement.dataset.w }));
  check(wk.on && wk.focus === 'play', 'Enter on „Andere Welt": the worlds, the focus on the newest world\'s ▶ (' + wk.focus + ')');
  await page.keyboard.press('Escape'); await wait(300);
  check(await ev(() => document.getElementById('title').classList.contains('on') && document.activeElement && document.activeElement.dataset.act === 'worlds'), 'Esc: back at the start, the focus where it was');
  const small = await ev(() => [...document.querySelectorAll('#title button, #title .lp-btn')].filter(b => b.getClientRects().length).map(b => { const r = b.getBoundingClientRect(); return { t: b.textContent.trim().slice(0, 18), w: Math.round(r.width), h: Math.round(r.height) }; }).filter(x => x.w < 44 || x.h < 44));
  check(!small.length, 'every button on the start screen is at least 44 × 44 px' + (small.length ? ': ' + JSON.stringify(small) : ''));
  // 📜 Impressum & Datenschutz: only when VR.Legal is there
  check(await ev(() => { const b = document.querySelector('#title [data-act="legal"]'); return !!b && !b.getClientRects().length; }), 'without VR.Legal there is no 📜 button');
  await ev(() => { VR.Legal = { open: (t) => { window.__legal = t || 'open'; } }; VR.Start.texts(); });
  const lg = await ev(() => { const b = document.querySelector('#title [data-act="legal"]'); const r = b.getBoundingClientRect(); return { shown: b.getClientRects().length > 0, text: b.textContent, h: r.height }; });
  check(lg.shown && /Impressum/.test(lg.text) && lg.h >= 44, 'with VR.Legal: „' + lg.text + '" on the start screen');
  await shot('start_game_legal');
  await page.click('#title [data-act="legal"]'); await wait(100);
  check(await ev(() => window.__legal === 'impressum'), 'a click opens VR.Legal on the Impressum (≤ 2 clicks from the start)');
  check(await ev(() => document.querySelectorAll('#title [data-legal]').length === 1), 'it carries data-legal: VR.Legal adds no second one');
  await ev(() => { delete VR.Legal; VR.Start.texts(); });
  // English, said in the game: /lang en works in Einfach (the language is a setting Einfach keeps)
  await ensureWorld();
  await ev(async (id) => { const g = VR.game, ws = await g.store.listWorlds(); g.loadWorld(ws.find(w => w.id === id)); }, WORLD);
  check(await inPlay(), 'the world is open');
  await ev(() => VR.game.chat('/lang en')); await wait(300);
  check(await ev(() => VR.I18N.lang === 'en' && document.documentElement.lang === 'en'), '/lang en in Einfach switches the game to English');
  await ev(() => VR.game.ui.pause()); await wait(300);
  const pe = await ev(() => [...document.querySelectorAll('#pause button')].filter(b => b.getClientRects().length > 0).map(b => b.textContent.trim()));
  console.log('  pause (en)', JSON.stringify(pe));
  check(pe[0] === '▶ Play on' && ['🏗 Build', '🎒 Mine', '🏠 To my spot', '📍 My spot is here', '⚙ Settings', '⏏ Save & quit', 'Simple', 'Pro'].every(t => pe.includes(t)), 'the pause menu in English: ▶ Play on · 🏗 Build · 🎒 Mine · 🏠 To my spot · 📍 My spot is here · ⚙ Settings · ⏏ Save & quit');
  check(await ev(() => document.querySelector('#pause h2').textContent === 'Paused'), 'its title: Paused');
  await shot('start_pause_en');
  await ev(() => VR.game.quitToTitle()); check(await atTitle(), 'back at the start screen');
  await wait(600);
  const te = await tiles();
  const en2 = await ev(() => ({ sub: document.querySelector('#title .sub').textContent, set: document.querySelector('#title [data-act="settings"]').textContent, sw: [...document.querySelectorAll('#title #proSwitch button')].map(b => b.textContent).join('|'), title: document.getElementById('title').textContent }));
  console.log('  start (en)', JSON.stringify(te.map(x => x.label)), JSON.stringify(en2).slice(0, 300));
  check(te.map(x => x.label).join('|') === '▶ Play on|🏗 Build|✨ Create|🎒 Mine' && /Another world/.test(en2.sub) && /New world/.test(en2.sub) && en2.set === '⚙ Settings' && en2.sw === 'Simple|Pro', 'the start screen in English: ▶ Play on · 🏗 Build · ✨ Create · 🎒 Mine, Another world · ＋ New world, ⚙ Settings, Simple | Pro');
  check(!/Weiterspielen|Einstellungen|Einfach|Andere Welt|übernehmen/.test(en2.title), 'no German left on the English start screen');
  await shot('start_game_en');
  await ev(() => VR.I18N.set('de')); await wait(300);
  check((await tiles())[0].label === '▶ Weiterspielen', 'and back to German');
});

await done();
