// e-ux (plan docs/superpowers/plans/2026-10-30-e-ux.md): a brand-new player's tour of the game's UI, German, Einfach,
// on Balanced at 1280×720 and 1920×1080 and on Very Low at 1280×720 — the start screen, the create form, the loading
// screen, the first minute (the onboarding hints), the HUD (a toast, Funke's bubble, the key-hint strip), the pause
// menu, the settings (and their search), the journal (J), the photo mode, Profi's HUD and the cockpit. Every screen is
// a picture (test/shots/ux_<TAG>_<res>_<name>.png) and, for the HUD states, an overlap check: the DOM rects of every
// visible positioned HUD element (outside the menus) must not intersect at either resolution. The design tokens must be
// on :root, the UI scale (90–140 %) must reach the HUD, the hint strip must show only what can be done now.
//   nohup bash test/wt_run.sh ux.mjs 3600 > .tmp_tests/ux.log 2>&1 &     (TAG=before|after, default after · RES=720,1080
//   · VL=0 skips Very Low · STRICT=0 reports overlaps without failing — the before run)            → ALL OK / FAILED n
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import { fileURLToPath } from 'url';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const URL0 = 'file://' + ROOT + 'dist/index.html';
const SHOTS = ROOT + 'test/shots/';
const TAG = process.env.TAG || 'after', STRICT = process.env.STRICT !== '0';
const RES = (process.env.RES || '720,1080').split(',');
fs.mkdirSync(SHOTS, { recursive: true });
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const logs = [];
const BAL = { preset: 'balanced', dynRes: false, renderDist: 4, far: 0 };
const POTATO = { preset: 'potato', far: 0, rdMax: 24, upload: 1.5, renderDist: 4, scale: 0.55, shadows: 0, clouds: 1, particles: 0, bloom: false, rays: false, fxaa: false, fancyLeaves: false, dynRes: false, magic: 0.8, horizon: 2, sunShadows: false, tsr: true, vxLod: 12, lite: true, sharpen: true, folk: 32, slow: true, wetGround: false, anim: false, matTier: 0, dropShadow: 0, lampGlow: 0, water: 0, bau: 'instant', smoothPlants: 0, smoothFurn: 0 };
const OUT = {};

// the visible positioned HUD elements (outside the open .screen menus), and every pair of them that intersects
const overlaps = (page) => page.evaluate(() => {
  const W = innerWidth, H = innerHeight, list = [];
  const vis = (e) => { for (let x = e; x && x !== document.body; x = x.parentElement) { const s = getComputedStyle(x); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity < 0.05) return false; } return true; };
  const name = (e) => e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : '');
  for (const e of document.querySelectorAll('body *')) {
    if (e.closest('.screen') || e.closest('svg') || e.tagName === 'CANVAS' && e.id === 'gl' || e.tagName === 'SCRIPT' || e.tagName === 'STYLE') continue;
    const s = getComputedStyle(e); if (s.position !== 'absolute' && s.position !== 'fixed') continue;
    if (s.pointerEvents === 'none' && !e.textContent.trim() && e.tagName !== 'CANVAS' && !e.children.length) continue;   // (empty veils, vignettes)
    const r = e.getBoundingClientRect(); if (r.width < 4 || r.height < 4 || r.right <= 0 || r.bottom <= 0 || r.left >= W || r.top >= H) continue;
    if (r.width * r.height > 0.3 * W * H) continue;   // (full-screen layers: #ui, #hud, veils)
    if (!vis(e)) continue;
    if (e.id === 'crosshair') continue;
    list.push({ e, n: name(e).slice(0, 60), r: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) } });
  }
  const top = list.filter(a => !list.some(b => b !== a && b.e.contains(a.e)));   // (outermost positioned boxes only)
  const out = [], off = [];
  for (const a of top) if (a.r.x < 0 || a.r.y < 0 || a.r.x + a.r.w > W + 1 || a.r.y + a.r.h > H + 1) off.push(a.n + ' ' + JSON.stringify(a.r));
  for (let i = 0; i < top.length; i++) for (let j = i + 1; j < top.length; j++) {
    const A = top[i].r, B = top[j].r, ix = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x), iy = Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y);
    if (ix > 2 && iy > 2) out.push(top[i].n + ' × ' + top[j].n + ' (' + ix + '×' + iy + ')');
  }
  return { n: top.length, names: top.map(a => a.n + ' ' + a.r.x + ',' + a.r.y + ' ' + a.r.w + '×' + a.r.h), hits: out, off };
});
// the smallest text on screen (px) among visible text in the HUD or the open menu
const smallText = (page) => page.evaluate(() => {
  let min = 99, at = '', n = 0;
  const walker = document.createTreeWalker(document.getElementById('ui') || document.body, NodeFilter.SHOW_TEXT);
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    if (!t.textContent.trim()) continue; const e = t.parentElement; const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
    const s = getComputedStyle(e); if (s.visibility === 'hidden' || e.closest('[hidden]')) continue;
    let ok = true; for (let x = e; x; x = x.parentElement) { const c = getComputedStyle(x); if (c.display === 'none' || +c.opacity < 0.05) { ok = false; break; } } if (!ok) continue;
    const fs = parseFloat(s.fontSize); n++; if (fs < min) { min = fs; at = (e.id || e.className || e.tagName) + ': ' + t.textContent.trim().slice(0, 30); }
  }
  return { min, at, n };
});

async function tour(label, w, h, settings, full, card) {
  console.log(`${label} · ${w}×${h} — ${secs()}`);
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: 'de-DE' });
  await ctx.addInitScript((s) => { try { if (!localStorage.getItem('r9si.lang')) localStorage.setItem('r9si.lang', 'de'); if (!localStorage.getItem('r9si.settings')) localStorage.setItem('r9si.settings', JSON.stringify(s)); } catch (e) { /* */ } }, settings);
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') logs.push(`[${label} error] ${m.text().slice(0, 400)}`); });
  page.on('pageerror', e => logs.push(`[${label} pageerror] ` + (e.stack || e.message).slice(0, 1000)));
  page.on('dialog', d => d.accept());
  const ev = (fn, a) => page.evaluate(fn, a), wait = (ms) => page.waitForTimeout(ms);
  const pre = `ux_${TAG}_${label}_`;
  const shot = async (n) => { try { await page.screenshot({ path: SHOTS + pre + n + '.png', timeout: 120000 }); console.log('   shot ' + pre + n + ' (' + secs() + ')'); } catch (e) { console.log('   (no shot ' + n + ': ' + String(e.message).split('\n')[0] + ')'); } };
  const R = OUT[label] = {};
  const hud = async (n) => { const o = await overlaps(page), t = await smallText(page); R[n] = { ...o, small: t }; console.log(`   ${n}: ${o.n} boxes, ${o.hits.length} overlaps, ${o.off.length} off-screen, smallest text ${t.min}px (${t.at})`); for (const x of o.hits.slice(0, 8)) console.log('     × ' + x); for (const x of o.off.slice(0, 4)) console.log('     ⇲ ' + x); return o; };
  await page.goto(URL0);
  for (let i = 0; i < 240; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
  await wait(4000);
  await shot('start'); R.startText = await smallText(page);
  if (TAG === 'after') {
    const tk = await ev(() => { const s = getComputedStyle(document.documentElement); return ['--ux-acc', '--ux-panel', '--ux-r', '--ux-s3', '--ux-fs', '--ux-scale'].map(k => s.getPropertyValue(k).trim()); });
    check(tk.every(v => v), 'the design tokens are on :root (' + tk.join(' · ') + ')');
  }
  // ＋ Neue Welt: the create form (the three cards of „Wie willst du spielen?")
  await ev(() => VR.game.ui.act('newworld'));
  await wait(1200); await shot('create'); R.createText = await smallText(page);
  // the loading screen: the create button, then a picture as soon as #loading shows
  if (card) { await ev((c) => { const b = document.querySelector('#cw_way [data-v="' + c + '"]'); if (b) b.click(); }, card); await wait(500); await shot('create_' + card); }
  await ev(() => { const b = document.querySelector('#create [data-act="docreate"]'); const n = document.getElementById('cw_seed'); if (n) n.value = '4242'; if (b) b.click(); else VR.game.createWorld({ name: 'UX', mode: 'zen', difficulty: 'peaceful', type: 'default', seed: '4242', cheats: true, kit: true, first: true }); });
  for (let i = 0; i < 40; i++) { await wait(250); if (await ev(() => VR.game.ui.screen === 'loading' || VR.game.state === 'play')) break; }
  await wait(1500); await shot('loading');
  for (let i = 0; i < 420; i++) { await wait(1000); if (await ev(() => VR.game.state === 'play' && VR.game.player && !VR.game.arrival)) break; if (i > 150) await ev(() => { const a = VR.game.arrival; if (a && a.skip) a.skip(); }); }   // (SwiftShader at 1080p: the arrival's flight can take minutes — Esc's skip after 150 s)
  await wait(2500); await shot('first'); await hud('first');
  // the first minute: standing still → the hint for moving / looking
  await ev(() => { const g = VR.game; g.input.captured = true; });
  await wait(9000); await shot('first_hint'); R.hint1 = await ev(() => { const b = document.getElementById('hints'); return b ? b.textContent.trim().slice(0, 80) : ''; }); console.log('   hint: ' + R.hint1);
  // a toast and Funke's bubble over the HUD
  await ev(() => { const g = VR.game; try { g.ui.toast('🪙 Taler', 'Du hast 12 Taler gefunden', 'gold_ingot'); } catch (e) { /* */ } try { if (VR.Funke && VR.Funke.ask) VR.Funke.ask(g); } catch (e) { /* */ } });
  await wait(1500); await shot('hud'); const oh = await hud('hud');
  if (STRICT) check(oh.hits.length === 0 && oh.off.length === 0, `${label}: no HUD element overlaps another or leaves the screen (${oh.hits.length} overlaps, ${oh.off.length} off)`);
  if (TAG === 'after') {
    const strip = await ev(() => { const s = document.getElementById('keystrip'); return s ? { on: getComputedStyle(s).display !== 'none', keys: [...s.querySelectorAll('[data-k]')].map(k => k.dataset.k) } : null; });
    check(!!strip && strip.on && strip.keys.length >= 2 && strip.keys.length <= 5, 'the key-hint strip shows 2–5 things you can do now (' + (strip ? strip.keys.join(' ') : '—') + ')');
  }
  // the pause menu, the settings, their search
  await ev(() => VR.game.ui.pause()); await wait(900); await shot('pause'); R.pauseText = await smallText(page);
  if (TAG === 'after') {
    const pf = await ev(() => { const p = document.querySelector('#pause .panel').getBoundingClientRect(), bad = []; for (const b of document.querySelectorAll('#pause button')) { const r = b.getBoundingClientRect(); if (!r.width) continue; if (b.scrollWidth > b.clientWidth + 1 || r.bottom > innerHeight || r.top < 0) bad.push(b.textContent.trim().slice(0, 24)); } return { fit: p.top >= 0 && p.bottom <= innerHeight && p.right <= innerWidth, bad }; });
    check(pf.fit && !pf.bad.length, `${label}: the pause menu fits the screen, every button's words show in full (${pf.bad.join(' · ') || 'all'})`);
  }
  await ev(() => VR.game.ui.act('settings')); await wait(1200); await shot('settings'); R.setText = await smallText(page);
  if (full) {
    await ev(() => { const s = document.querySelector('#settings input[type=search], #settings .setsearch input, #setsearch'); if (s) { s.value = 'Schatten'; s.dispatchEvent(new Event('input', { bubbles: true })); } });
    await wait(900); await shot('settings_search');
  }
  if (TAG === 'after') {
    const sc = await ev(async () => { const hb = document.getElementById('hotbar'), r0 = hb.getBoundingClientRect(); VR.UX.setScale(1.3); await new Promise(r => setTimeout(r, 300)); const r1 = hb.getBoundingClientRect(); VR.UX.setScale(1); return { base: r0.height, big: r1.height, cx: r1.left + r1.width / 2, bottom: r1.bottom, W: innerWidth, H: innerHeight }; });
    check(sc.big > sc.base * 1.15 && Math.abs(sc.cx - sc.W / 2) < 6 && sc.bottom <= sc.H, `the UI scale reaches the HUD (hotbar ${sc.base.toFixed(0)} → ${sc.big.toFixed(0)} px at 130 %, centre ${sc.cx.toFixed(0)} of ${sc.W}, bottom ${sc.bottom.toFixed(0)})`);
  }
  await ev(() => VR.game.ui.resume()); await wait(500);
  // the journal (J)
  await page.keyboard.press('KeyJ'); await wait(1200); await shot('journal'); R.jText = await smallText(page);
  await ev(() => { if (VR.Quests && VR.Quests.closeJournal) VR.Quests.closeJournal(); VR.game.ui.resume(); }); await wait(500);
  if (full) {
    // the photo mode
    await ev(() => VR.game.photoMode(true)); await wait(1500); await shot('photo'); await hud('photo');
    await ev(() => VR.game.photoMode(false)); await wait(600);
    // Profi's HUD
    await ev(() => VR.UIPrefs && VR.UIPrefs.set({ pro: true })); await wait(1200); await shot('hud_pro'); const op = await hud('hud_pro');
    if (STRICT) check(op.hits.length === 0, `${label} Profi: no HUD overlaps (${op.hits.length})`);
    await ev(() => VR.UIPrefs && VR.UIPrefs.set({ pro: false })); await wait(500);
    // the cockpit: a shuttle in front of you, boarded
    const ok = await ev(async () => { const g = VR.game; try { const d = g.starships.placeInFront(12345, 'shuttle', null, g.player); for (let i = 0; i < 60; i++) { await new Promise(r => setTimeout(r, 400)); const s = g.starships.ships.find(q => q.d.key === d.key && q.d.meta && q.d.cells); if (s) { g.player.flying = false; g.starships.board(s, g.player); return true; } } } catch (e) { return String(e); } return false; });
    for (let i = 0; i < 40; i++) { await wait(500); if (await ev(() => VR.game.cockpit && VR.game.flight && VR.game.cockpit.ready(VR.game.flight))) break; }
    await wait(2500); await shot('cockpit'); const oc = await hud('cockpit'); console.log('   cockpit: ' + ok);
    if (STRICT) check(oc.hits.length === 0, `${label} cockpit: no HUD overlaps (${oc.hits.length})`);
  }
  if (TAG === 'after') for (const [k, v] of [['start', R.startText], ['create', R.createText], ['pause', R.pauseText], ['settings', R.setText]]) check(v.min >= 13, `${label} ${k}: no text under 13 px (smallest ${v.min} px · ${v.at})`);
  await ctx.close();
}

for (const r of RES) {
  if (r === '720') await tour('bal720', 1280, 720, BAL, true, process.env.CARD720 || '');
  if (r === '1080') await tour('bal1080', 1920, 1080, BAL, false);
}
if (process.env.VL !== '0') await tour('vl720', 1280, 720, POTATO, false, TAG === 'after' ? 'gentle' : '');   // (after: the gentle Abenteuer — the ring, the Taler, the journal)
fs.writeFileSync(SHOTS + 'ux_' + TAG + '.json', JSON.stringify(OUT, null, 1));
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 12)) console.log(l);
check(!logs.some(l => /pageerror\]/.test(l)), 'no page errors');
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
