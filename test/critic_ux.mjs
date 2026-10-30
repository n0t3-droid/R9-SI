// regress: skip — the critic's new-player look (docs/reviews/v0.52.md): a fresh browser profile, German UI, 1280 × 720,
// Balanced (set, as SwiftShader would auto-pick Very Low), real clicks like a first-time player:
//   the start screen → „＋ Neue Welt" → the create dialog → create → loading → the first 60 s (standing, then W held,
//   then a look around) → Esc (pause) → ⚙ settings → back → the keys E, J, M, F1 one at a time (each closed with Esc).
//   pictures test/shots/critic_ux_<step>.png; the visible texts of each screen in test/shots/critic_ux.json
// usage: R9_EXCLUSIVE=1 nohup bash test/wt_run.sh critic_ux.mjs 1800 > .tmp_tests/critic_ux.log 2>&1 &
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const ROOT = new URL('../', import.meta.url).pathname;
const SHOTS = ROOT + 'test/shots/';
fs.mkdirSync(SHOTS, { recursive: true });
const DIST = process.env.DIST || 'file://' + ROOT + 'dist/index.html';
let fails = 0; const check = (ok, m) => { console.log((ok ? '  ok   ' : '  FAIL ') + m); if (!ok) fails++; };
const OUT = { steps: [] };
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
await ctx.addInitScript(() => { try { if (!localStorage.getItem('r9si.settings')) localStorage.setItem('r9si.settings', JSON.stringify({ preset: 'balanced', dynRes: false })); } catch (e) { /* */ } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', e => errs.push(String(e.message).slice(0, 300)));
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, a) => page.evaluate(fn, a);
const texts = () => ev(() => { const s = (VR.game && VR.game.ui && VR.game.ui.screen) || ''; const vis = [...document.querySelectorAll('#ui button, #ui h1, #ui h2, #ui h3, #ui label, #hint, #hud .tip, .toast, #ui .hint')].filter(e => e.offsetParent !== null && e.textContent.trim()).map(e => e.textContent.trim().slice(0, 60)); return { screen: s, state: VR.game && VR.game.state, n: vis.length, vis: vis.slice(0, 40) }; }).catch(() => ({}));
const shot = async (name) => { try { await page.screenshot({ path: SHOTS + 'critic_ux_' + name + '.png', timeout: 120000 }); } catch (e) { console.log('  (no shot ' + name + ')'); } const t = await texts(); OUT.steps.push({ name, ...t }); console.log('  · ' + name + ' ' + JSON.stringify(t).slice(0, 400)); };
const untilState = async (st, ms) => { const t = Date.now(); while (Date.now() - t < ms) { const s = await ev(() => VR.game && VR.game.state).catch(() => null); if (s === st) return Date.now() - t; await wait(400); } return -1; };
// a player's click: the real one first; if Playwright cannot (covered, moving), what lies on top is logged and the click forced
const click = async (sel, what) => { try { await page.click(sel, { timeout: 6000 }); return 'real'; } catch (e) {
  const top = await ev((sel) => { const b = document.querySelector(sel); if (!b) return 'none'; const r = b.getBoundingClientRect(), t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return t ? (t.tagName + '#' + t.id + '.' + t.className + ' ' + (t === b || b.contains(t))) : 'null'; }, sel).catch(() => '?');
  console.log('  (' + what + ': no real click — on top: ' + top + '; ' + e.message.split('\n')[0].slice(0, 120) + ')'); OUT['blocked_' + what] = top;
  try { await page.click(sel, { timeout: 6000, force: true }); return 'force'; } catch (e2) { await ev((sel) => { const b = document.querySelector(sel); if (b) b.click(); }, sel).catch(() => {}); return 'js'; } } };
const t0 = Date.now();
await page.goto(DIST);
check(await untilState('title', 240000) >= 0, 'the start screen');
await wait(8000); await shot('01_title');
// ＋ Neue Welt
OUT.newworld = await click('#title [data-act="newworld"]', 'newworld');
await wait(1500); await shot('02_create');
OUT.createFields = await ev(() => [...document.querySelectorAll('#create input, #create select, #create button, #create label')].filter(e => e.offsetParent !== null).map(e => (e.tagName + ':' + (e.id || '') + ':' + (e.textContent || e.value || '').trim().slice(0, 50)))).catch(() => []);
console.log('  create: ' + JSON.stringify(OUT.createFields).slice(0, 900));
await ev(() => { const s = document.getElementById('cw_seed'); if (s) { s.value = '4242'; s.dispatchEvent(new Event('input')); } }).catch(() => {});
const tc = Date.now();
OUT.create = await click('#create .btn.primary', 'create');
if (await ev(() => VR.game.state) === 'title' && await ev(() => VR.game.ui.screen) !== 'create') { console.log('  (still on the title: ▶ Losspielen)'); await click('#title .tile[data-tile="play"]', 'play'); }
await wait(2500); await shot('03_loading');
const lt = await untilState('play', 300000); OUT.loadMs = lt >= 0 ? Date.now() - tc : -1;
check(lt >= 0, 'into the world in ' + OUT.loadMs + ' ms');
await wait(1500); await shot('04_t0');
await wait(12000); await shot('05_t15');
await page.keyboard.down('KeyW'); await wait(6000); await page.keyboard.up('KeyW'); await shot('06_t25_walk');
await page.mouse.move(640, 360); await page.mouse.move(900, 330, { steps: 10 }); await wait(15000); await shot('07_t45');
await wait(15000); await shot('08_t60');
OUT.hud = await ev(() => [...document.querySelectorAll('#hud *')].filter(e => e.offsetParent !== null && e.children.length === 0 && e.textContent.trim()).map(e => e.textContent.trim().slice(0, 50)).slice(0, 60)).catch(() => []);
console.log('  hud: ' + JSON.stringify(OUT.hud).slice(0, 900));
await page.keyboard.press('Escape'); await wait(1500); await shot('09_pause');
OUT.settings = await click('#pause [data-act="settings"]', 'settings');
await wait(1500); await shot('10_settings');
await page.keyboard.press('Escape'); await wait(800); await page.keyboard.press('Escape'); await wait(1000);
for (const [k, n] of [['KeyE', '11_E'], ['KeyJ', '12_J'], ['KeyM', '13_M'], ['F1', '14_F1']]) {
  const st = await ev(() => VR.game.ui && VR.game.ui.screen).catch(() => '');
  if (st && st !== 'hud' && st !== 'play') { await page.keyboard.press('Escape'); await wait(800); }
  await page.keyboard.press(k); await wait(1500); await shot(n);
  await page.keyboard.press('Escape'); await wait(1000);
}
OUT.errors = errs; OUT.ms = Date.now() - t0;
fs.writeFileSync(SHOTS + 'critic_ux.json', JSON.stringify(OUT, null, 1));
check(errs.length === 0, 'no page errors (' + errs.length + ')' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
