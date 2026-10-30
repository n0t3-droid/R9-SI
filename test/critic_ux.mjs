// regress: skip — the critic's new-player look (docs/reviews/v0.52.md): a fresh browser profile, German UI, 1280 × 720,
// Balanced (set, as SwiftShader would auto-pick Very Low), real clicks like a first-time player:
//   the start screen → „＋ Neue Welt" → the create dialog → create → loading → the first 60 s (standing, then W held,
//   then a look around) → Esc (pause) → ⚙ settings → back → the keys E, J, M, F1 one at a time (each closed with Esc).
//   pictures test/shots/critic_ux_<step>.png; the visible texts of each screen in test/shots/critic_ux.json
// f-first (docs/superpowers/plans/2026-10-30-f-first.md) adds the checks of the review's first five (R53-01…06, -08, -09):
//   the title: its land finished or still in the haze (no half-built land shown), its texts ≥ 13 px and light;
//   the loading tip ≥ 13 px; the arrival over without a key within 9 s of the world's start, at 15 s the HUD up and W
//   moving ≥ 2 m; the held block's name German (no English item word in a de-DE HUD); the pause panel inside 720 px
//   with ≤ 6 buttons at the top level; a story offer shows one „V" prompt; then an „Abenteuer, sanft" world: its
//   nearest outpost ≤ 320 m from the spawn, ≥ 5 minutes of day light ahead
// env: TAG (picture prefix, default none) · DIST (another build, e.g. file://…/.tmp_tests/dist_before/index.html)
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
const TAG = process.env.TAG ? process.env.TAG + '_' : '';
const shot = async (name) => { try { await page.screenshot({ path: SHOTS + 'critic_ux_' + TAG + name + '.png', timeout: 120000 }); } catch (e) { console.log('  (no shot ' + name + ')'); } const t = await texts(); OUT.steps.push({ name, ...t }); console.log('  · ' + name + ' ' + JSON.stringify(t).slice(0, 400)); };
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
// R53-03 / R53-08: the title's land finished or still in its haze; its texts big and light enough
OUT.titleLand = await ev(() => { const s = VR.game.titleScene; return s ? { reveal: +s.reveal.toFixed(2), ready: !!(s.landReady && s.landReady()), mode: s.mode } : null; }).catch(() => null);
const textsOk = (sel) => ev((sel) => { const out = []; for (const e of document.querySelectorAll(sel)) { if (e.offsetParent === null || !e.childNodes.length) continue; const own = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()); if (!own) continue; const cs = getComputedStyle(e); if (+cs.opacity === 0) continue; const m = cs.color.match(/[\d.]+/g).map(Number), L = (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255, a = m.length > 3 ? m[3] : 1; if (a === 0) continue; out.push({ t: e.textContent.trim().slice(0, 30), px: parseFloat(cs.fontSize), L: +(L * a).toFixed(2) }); } return out; }, sel).catch(() => []);
OUT.titleTexts = await textsOk('#title *');
{ const small = OUT.titleTexts.filter(x => x.px < 13), pale = OUT.titleTexts.filter(x => x.L < 0.55);
  check(OUT.titleLand && (OUT.titleLand.mode === 'still' || OUT.titleLand.ready || OUT.titleLand.reveal <= 0.35), 'the title shows no half-built land: ' + JSON.stringify(OUT.titleLand));
  check(!small.length && !pale.length, 'the title\'s texts ≥ 13 px and light (' + OUT.titleTexts.length + ')' + (small.length + pale.length ? ': ' + JSON.stringify(small.concat(pale).slice(0, 6)) : '')); }
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
{ const lt = await textsOk('#loading *'); OUT.loadTexts = lt; const small = lt.filter(x => x.px < 13); check(lt.length && !small.length, 'the loading screen\'s texts ≥ 13 px' + (small.length ? ': ' + JSON.stringify(small.slice(0, 4)) : '')); }
const lt = await untilState('play', 300000); OUT.loadMs = lt >= 0 ? Date.now() - tc : -1;
check(lt >= 0, 'into the world in ' + OUT.loadMs + ' ms');
const tPlay = Date.now();
// (the arrival's end measured in the page from here: a screenshot under SwiftShader can take longer than the arrival)
await ev(() => { window.__arr = { end: VR.game.arrival ? -1 : 0 }; const t = performance.now(); const iv = setInterval(() => { if (!VR.game.arrival) { window.__arr.end = Math.round(performance.now() - t); clearInterval(iv); } }, 100); }).catch(() => {});
await wait(1500); await shot('04_t0');
// R53-06: the arrival is short on any machine (no key pressed here), then the HUD and W
{ let arr = -1; while (Date.now() - tPlay < 20000) { const e = await ev(() => window.__arr ? window.__arr.end : -1).catch(() => -1); if (e >= 0) { arr = e; break; } await wait(250); } OUT.arrivalMs = arr;
  check(arr >= 0 && arr <= 9000, 'the arrival is over in ' + arr + ' ms (≤ 9 s, no key)'); }
await wait(Math.max(0, 15000 - (Date.now() - tPlay))); await shot('05_t15');
OUT.hud15 = await ev(() => { const h = document.getElementById('hud'), cs = h && getComputedStyle(h), A = VR.game.arrival, a = document.activeElement; return h ? { vis: cs.visibility, op: +cs.opacity, hideHud: !!VR.game.hideHud, arrival: A ? { phase: A.phase, holds: A.holds(), t: +(A.t || 0).toFixed(2) } : null, wow: !!(VR.game.wow && VR.game.wow.active), focus: a ? a.tagName + '#' + a.id : '', captured: !!VR.game.input.captured, poll: window.__arr || null } : null; }).catch(() => null);
check(OUT.hud15 && OUT.hud15.vis !== 'hidden' && OUT.hud15.op > 0.5 && !OUT.hud15.hideHud, 'at 15 s the HUD is up: ' + JSON.stringify(OUT.hud15));
const p0 = await ev(() => VR.game.player.pos.slice()).catch(() => null);
// (W, then S: the spawn may face a bench or a parapet — a key that moves the player at all is the measure)
await page.keyboard.down('KeyW'); await wait(4000); await page.keyboard.up('KeyW');
const pW = await ev(() => VR.game.player.pos.slice()).catch(() => null);
await page.keyboard.down('KeyS'); await wait(3000); await page.keyboard.up('KeyS'); await shot('06_t25_walk');
{ const p1 = await ev(() => VR.game.player.pos.slice()).catch(() => null); const dW = p0 && pW ? Math.hypot(pW[0] - p0[0], pW[2] - p0[2]) : -1, dS = pW && p1 ? Math.hypot(p1[0] - pW[0], p1[2] - pW[2]) : -1;
  OUT.walked = +Math.max(dW, dS).toFixed(2); OUT.walkedW = +dW.toFixed(2); OUT.walkedS = +dS.toFixed(2);
  check(OUT.walked >= 2, 'W held 4 s, then S 3 s, right after: W ' + OUT.walkedW + ' m · S ' + OUT.walkedS + ' m (≥ 2 by one of them)'); }
await page.mouse.move(640, 360); await page.mouse.move(900, 330, { steps: 10 }); await wait(15000); await shot('07_t45');
await wait(15000); await shot('08_t60');
OUT.hud = await ev(() => [...document.querySelectorAll('#hud *')].filter(e => e.offsetParent !== null && e.children.length === 0 && e.textContent.trim()).map(e => e.textContent.trim().slice(0, 50)).slice(0, 60)).catch(() => []);
console.log('  hud: ' + JSON.stringify(OUT.hud).slice(0, 900));
// R53-02: the held block's name in the player's language — no English item word in a de-DE HUD
OUT.itemNames = [];
for (const k of ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5']) { await page.keyboard.press(k); await wait(300); OUT.itemNames.push(await ev(() => { const e = document.getElementById('itemname'); return e ? e.textContent : ''; }).catch(() => '')); }
OUT.itemNamesData = await ev(() => { const inv = VR.game.player.inv; return inv.slots.slice(0, 9).map(s => s ? VR.itemName(s.id) : '').filter(Boolean); }).catch(() => []);
{ const EN = /\b(Block|Grass|Stone|Planks|Log|Glass|Dirt|Sand|Oak|Birch|Spruce|Brick|Bricks|Wool|Slab|Stairs|Torch|Lamp|Cobblestone|Wood|Leaves|Door|Fence|Pickaxe|Shovel|Axe|Sword|Bread|Apple)\b/;
  const all = OUT.itemNames.concat(OUT.itemNamesData).filter(Boolean), en = all.filter(n => EN.test(n));
  check(all.length > 0 && !en.length, 'the HUD\'s item names are German (' + all.length + ': ' + all.slice(0, 9).join(' · ') + ')' + (en.length ? ' — English: ' + en.join(', ') : '')); }
await page.keyboard.press('Escape'); await wait(1500); await shot('09_pause');
// R53-04: the pause menu fits 720 px, few buttons at its top level
OUT.pause = await ev(() => { const p = document.querySelector('#pause > .panel'); if (!p) return null; const r = p.getBoundingClientRect(); const vis = [...p.querySelectorAll('button')].filter(b => b.offsetParent !== null && b.getBoundingClientRect().height > 0); return { bottom: Math.round(r.bottom), top: Math.round(r.top), n: vis.length, labels: vis.map(b => b.textContent.trim().slice(0, 24)) }; }).catch(() => null);
check(OUT.pause && OUT.pause.bottom <= 720 && OUT.pause.top >= 0 && OUT.pause.n <= 6, 'the pause menu: ' + JSON.stringify(OUT.pause));
{ const more = await ev(() => { const b = document.querySelector('#pause [data-act="pausemore"]'); if (!b) return null; b.click(); const p = document.querySelector('#pause > .panel'), r = p.getBoundingClientRect(); return { bottom: Math.round(r.bottom), n: [...p.querySelectorAll('button')].filter(b => b.offsetParent !== null).length }; }).catch(() => null);
  OUT.pauseMore = more; await wait(600); await shot('09b_pause_more');
  check(more && more.bottom <= 720 && more.n >= 6, '„Mehr" opens the rest inside 720 px: ' + JSON.stringify(more));
  await ev(() => { const b = document.querySelector('#pause [data-act="pauseless"]'); if (b) b.click(); }).catch(() => {}); await wait(300); }
OUT.settings = await click('#pause [data-act="settings"]', 'settings');
await wait(1500); await shot('10_settings');
await page.keyboard.press('Escape'); await wait(800); await page.keyboard.press('Escape'); await wait(1000);
for (const [k, n] of [['KeyE', '11_E'], ['KeyJ', '12_J'], ['KeyM', '13_M'], ['F1', '14_F1']]) {
  const st = await ev(() => VR.game.ui && VR.game.ui.screen).catch(() => '');
  if (st && st !== 'hud' && st !== 'play') { await page.keyboard.press('Escape'); await wait(800); }
  await page.keyboard.press(k); await wait(1500); await shot(n);
  await page.keyboard.press('Escape'); await wait(1000);
}
const offerCheck = async (tag) => {
{ for (let i = 0; i < 3; i++) { const st = await ev(() => VR.game.ui && VR.game.ui.screen).catch(() => ''); if (!st || st === 'hud' || st === 'play') break; await ev(() => { const u = VR.game.ui; if (u.resume) u.resume(); else u.show(null); }).catch(() => {}); await wait(800); }
  OUT['offer_' + tag] = await ev(() => { const S = VR.Story, P = VR.StoryPlay; if (!S || !P || !P.debug || !S.BEATS) return null; return P.debug.offer(S.BEATS[0].id); }).catch(() => null);
  await wait(1500); await shot(tag + '_offer');
  OUT['vPrompts_' + tag] = await ev(() => { const k = (VR.Binds && VR.Binds.label) ? VR.Binds.label('KeyV', VR.I18N.lang) : 'V', out = []; const re = new RegExp('\\[' + k + '\\]|\\b' + k + '$'); for (const e of document.querySelectorAll('#ctxprompt.on, #storycard, #funkebub')) { const rr = e.getBoundingClientRect(); if (!(rr.width > 0 && rr.height > 0)) continue; const cs = getComputedStyle(e); if (cs.display === 'none' || +cs.opacity < 0.2 || cs.visibility === 'hidden') continue; const t = e.textContent.trim(); if (re.test(t) || e.querySelector('kbd')) out.push((e.id || e.className) + ': ' + t.slice(0, 50)); } return out; }).catch(() => null);
  check(!OUT['offer_' + tag] || (OUT['vPrompts_' + tag] && OUT['vPrompts_' + tag].length <= 1), tag + ': a story offer shows one V prompt: ' + JSON.stringify(OUT['vPrompts_' + tag])); }
};
// R53-05: a story offer shows one „V" prompt (the card), not three
await offerCheck('15');
// R53-09: an „Abenteuer, sanft" world — its first outpost near, the day long
if (!process.env.NO_ADV) {
  await ev(() => { if (VR.game.state === 'play') { VR.game.ui.show && VR.game.ui.show('pause'); } }).catch(() => {});
  await ev(() => { const b = document.querySelector('#pause [data-act="quit"]'); if (b) b.click(); }).catch(() => {});
  await untilState('title', 120000); await wait(3000);
  await click('#title [data-act="newworld"]', 'newworld2'); await wait(1500);
  await ev(() => { const s = document.getElementById('cw_seed'); if (s) { s.value = '4242'; s.dispatchEvent(new Event('input')); } }).catch(() => {});
  await click('#cw_way [data-v="gentle"]', 'gentle'); await wait(500);
  await click('#create .btn.primary', 'create2');
  const ta = Date.now(); const ok = await untilState('play', 300000) >= 0; OUT.advLoadMs = Date.now() - ta;
  await wait(4000); await shot('16_adv_t0');
  OUT.adv = await ev(() => new Promise((res) => { const g = VR.game, p = g.player.pos; const tod = g.env.timeOfDay; setTimeout(() => res({ pos: p.slice(), tod, err: 'timeout' }), 20000); g.pool.direct(0, { type: 'locate', dim: g.dim, biome: 'outpost', x: Math.floor(p[0]), z: Math.floor(p[2]) }, null, (m) => res({ pos: p.slice(), tod, out: m && m.pos, d: m && m.pos ? Math.round(Math.hypot(m.pos[0] - p[0], m.pos[2] - p[2])) : -1, adv: !!(VR.Adventure && VR.Adventure.on && VR.Adventure.on()) })); })).catch((e) => ({ err: String(e) }));
  console.log('  adv: ' + JSON.stringify(OUT.adv));
  // the day light ahead: env.js's sun is up while sin(2π·tod/24000) > 0 (ticks 0…12000); 20 ticks a second
  const light = OUT.adv && Number.isFinite(OUT.adv.tod) ? Math.max(0, 12000 - (OUT.adv.tod % 24000)) / 20 / 60 : -1;
  OUT.advLightMin = +light.toFixed(1);
  check(ok && OUT.adv && OUT.adv.adv && OUT.adv.d >= 0 && OUT.adv.d <= 320, 'Abenteuer: the nearest outpost ' + (OUT.adv && OUT.adv.d) + ' m from the spawn (≤ 320)');
  check(light >= 5, 'Abenteuer: ' + OUT.advLightMin + ' minutes of day light ahead (≥ 5)');
  await wait(20000); await shot('17_adv_t25');
  await offerCheck('18');
}
OUT.errors = errs; OUT.ms = Date.now() - t0;
fs.writeFileSync(SHOTS + 'critic_ux' + (TAG ? '_' + TAG.slice(0, -1) : '') + '.json', JSON.stringify(OUT, null, 1));
check(errs.length === 0, 'no page errors (' + errs.length + ')' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
