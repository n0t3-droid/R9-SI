// W1 „Eine Tür, eine Karte" (spec 2026-10-07-all-ages-workflow-design.md §8): one start screen with four picture tiles on
// the game and the R9 Studio; no world → ▶ reaches play in one click (Zen); the Einfach / Profi switch (r9si.ui) hides
// and shows the Studio's mode bar; the pause menu starts with „▶ Weiterspielen"; the page is German, the picker turns
// it English; the first hints come one at a time; every thing is a card with 👁 ✏️ ☆ 📍 📦; the Karte view commits every
// placement; ← restores where you were; no page errors. ONLY=1,4 runs only those sections.
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
  check(on && h2.cur === 'move' && /W A S D/.test(h2.txt) && h2.kbd >= 4, 'after standing a while: „🖱 bewegen = umschauen · W A S D = gehen" with key caps');
  await page.keyboard.down('w'); await wait(700); await page.keyboard.up('w');
  await wait(400);
  const h3 = await ev(() => ({ st: JSON.parse(localStorage.getItem('r9si.hints')), cur: VR.Hints.current() }));
  check(h3.st.seen.move > 0 && h3.st.done.move > 0, 'walking marks move as seen and done (' + JSON.stringify(h3.st) + ')');
  let never2 = true, fly = false;
  for (let i = 0; i < 12; i++) { await wait(250); const r = await ev(() => ({ n: document.querySelectorAll('#hints .hint').length, cur: VR.Hints.current() })); if (r.n > 1) never2 = false; if (r.cur === 'fly') fly = true; }
  check(fly && await ev(() => /fliegen/.test(document.getElementById('hints').textContent)), 'then hint 3: „Leertaste 2× = fliegen"');
  check(never2, 'never two hints at once');
  await page.keyboard.press('Space'); await wait(120); await page.keyboard.press('Space'); await wait(600);
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
  check(btns[0] === '▶ Weiterspielen', 'the first button is „▶ Weiterspielen"');
  for (const t of ['🏗 Bauen', '🎒 Meins', '🏠 Zu meinem Platz', '📍 Mein Platz ist hier', '⚙ Einstellungen', '⏏ Speichern & zum Start']) check(btns.includes(t), 'has „' + t + '"');
  check(!btns.some(b => /Codex|Foto|Werkbank/.test(b)), 'Einfach: no Codex, no Fotomodus, no Werkbank');
  check(!(await ev(() => { const b = document.getElementById('studiolive'); return !!(b && b.getClientRects().length); })), '#studiolive (the Werkbank) is hidden in Einfach');
  await ev(() => VR.UIPrefs.set({ pro: true })); await wait(100);
  const pro = await vis('#pause button');
  check(pro.some(b => /Codex/.test(b)) && pro.some(b => /Werkbank/.test(b)) && await ev(() => document.getElementById('studiolive').getClientRects().length > 0), 'Profi: Codex, Fotomodus and the Werkbank button show');
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

await done();
