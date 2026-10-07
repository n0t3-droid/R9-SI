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
