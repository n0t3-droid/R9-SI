// Das Abenteuer in the page (a-core; plan docs/superpowers/plans/2026-10-22-a-core.md). One run, German UI, 1280 × 720:
//   0. 🎒 Meins on the start screen opens with „⚔ Abenteuer-Welt beginnen" → adventure_meins.png
//   1. the create form (Profi) shows the row „Spielweg"; ⚔ Abenteuer sets the difficulty row to Normal → adventure_create.png;
//      ✓ Welt erstellen makes an Abenteuer world: its record on, the world itself peaceful, the band and Begegnungen from
//      the difficulty row
//   2. the ring on the HUD (inside #hud); the first biome found counts on its own (codex.js's hook); placing through
//      player.js afterPlace → g.onBlockPlaced counts new positions (1 XP per 25)
//   3. a level-up to 5 (a gift level): the banner with its rays and sparks, the chime (audio.js counts it), the golden
//      motes, the ring pulsing, the gift → adventure_levelup.png (the CSS held at 0.7 s)
//   4. the pause menu has ⚔ Abenteuer → adventure_pause.png; the card → adventure_card.png; the stats card with two points
//      given → adventure_stats.png; Esc steps back (stats → card → pause); off and on again keep the record; Kindersicher
//      fixes Begegnungen to aus; Geschick makes mining faster
//   5. the numbers: award() in the page (≤ 0.01 ms), the HUD's writes over 300 frames (only on a change), the game loop
//      on Very Low and High with the Abenteuer off and on (alternating blocks, CPU), the record in IndexedDB, no page error
// → test/shots/adventure_*.png, adventure_sheet.jpg, adventure_numbers.json
//   nohup bash test/wt_run.sh adventure.mjs 3600 > .tmp_tests/adventure.log 2>&1 &
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';
const ROOT = new URL('../', import.meta.url).pathname;
const SHOTS = ROOT + 'test/shots/';
const DIST = 'file://' + ROOT + 'dist/index.html';
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const N = {};   // the numbers for the plan
fs.mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
const logs = [];
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || t === 'warning' || /error|fail/i.test(s)) logs.push(`[${t}] ${s.slice(0, 600)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
// the simulation without drawing (SwiftShader draws slowly); a frame is drawn only for a picture
const step = async (n, dtms = 33) => { for (let k = 0; k < n; k += 20) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(20, n - k), dtms]); } };
const draw = (tod) => ev((tod) => { window.__norender = false; const g = VR.game; if (tod !== undefined) g.env.setTime(tod); g.env.rain = 0; g.env.rainTarget = 0; for (let i = 0; i < 2; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }, tod);
const shot = async (name) => { await wait(150); await page.screenshot({ path: SHOTS + name + '.png', timeout: 120000 }); console.log('shot ' + name + ' (' + secs() + ')'); return SHOTS + name + '.png'; };
// the CSS animations held at one moment (the pictures do not depend on how slowly SwiftShader draws)
const hold = (ms) => ev((ms) => { for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = ms; } catch (e) { /* */ } } }, ms);
const release = () => ev(() => { for (const a of document.getAnimations()) { try { a.play(); } catch (e) { /* */ } } });
const pics = {};

try {
  await page.goto(DIST);
  const atTitle = () => ev(() => typeof VR !== 'undefined' && !!VR.game && VR.game.state === 'title');
  for (let i = 0; i < 160; i++) { await wait(500); if (await atTitle()) break; }
  check(await atTitle(), 'the start screen (' + secs() + ')');
  check(await ev(() => !!(VR.Adv && VR.Adventure && VR.Adventure.ui)), 'VR.Adv and VR.Adventure are in the page, mounted by start.js');
  await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 6; g.settings.horizon = 1; g.settings.wowMoments = false; g.applySettings('*'); g.audio.resume(); if (VR.UIPrefs) VR.UIPrefs.set({ pro: true }); if (VR.Hints) for (const h of ['play', 'move', 'fly']) VR.Hints.done(h); });
  check(await ev(() => !!VR.game.audio.ctx), 'the audio graph is up (the chime can play)');

  // ---------------------------------------------------------------- 0 · 🎒 Meins on the start screen: „⚔ Abenteuer-Welt beginnen"
  console.log('0 · 🎒 Meins');
  await ev(() => VR.Start.meins('title'));
  await wait(600);
  const mt = await ev(() => { const t = document.querySelector('#meins .advtile'), r = t && t.getBoundingClientRect(); return t ? { text: t.innerText.replace(/\s+/g, ' '), act: t.dataset.act, first: t === document.querySelector('#meins .mbody').firstElementChild, w: Math.round(r.width) } : null; });
  check(!!mt && mt.act === 'adv:newworld' && mt.first && /Abenteuer-Welt beginnen/.test(mt.text) && mt.w > 300, '🎒 Meins opens with the tile „⚔ Abenteuer-Welt beginnen" across the page (' + JSON.stringify(mt) + ')');
  pics.meins = await shot('adventure_meins');
  await ev(() => VR.game.ui.show('title'));
  await wait(300);

  // ---------------------------------------------------------------- 1 · the create row „Spielweg"
  console.log('1 · the create form');
  await ev(() => { const b = document.querySelector('#title [data-act="newworld"]'); b.click(); });
  await wait(300);
  const row0 = await ev(() => { const s = document.querySelector('#create #cw_way'); return s ? { on: s.querySelector('.on') && s.querySelector('.on').dataset.v, label: s.closest('.field').querySelector('label').textContent, after: s.closest('.field').previousElementSibling && s.closest('.field').previousElementSibling.querySelector('#cw_mode') ? 'mode' : '?', diff: document.querySelector('#cw_diff .on').dataset.v } : null; });
  check(!!row0 && row0.on === 'free' && row0.label === 'Spielweg' && row0.after === 'mode', 'the create form has the row „Spielweg" after „Spielart", „Frei bauen" chosen (' + JSON.stringify(row0) + ')');
  await ev(() => { document.querySelector('#cw_way [data-v="adv"]').click(); const n = document.querySelector('#cw_name'); n.value = 'Abenteuer-Test'; document.querySelector('#cw_seed').value = '4242'; });
  await wait(200);
  const row1 = await ev(() => ({ on: document.querySelector('#cw_way .on').dataset.v, diff: document.querySelector('#cw_diff .on').dataset.v, note: !document.querySelector('#create .advwaynote').hidden }));
  check(row1.on === 'adv' && row1.diff === 'normal' && row1.note, '⚔ Abenteuer: the difficulty row says Normal now and the note explains it (' + JSON.stringify(row1) + ')');
  pics.create = await shot('adventure_create');
  await ev(() => document.querySelector('#create [data-act="docreate"]').click());
  for (let i = 0; i < 120; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
  check(await ev(() => VR.game.state) === 'play', 'the world is open (' + secs() + ')');
  for (let i = 0; i < 14; i++) { await step(20); await wait(250); }
  const w = await ev(() => { const g = VR.game, m = g.meta, a = m.adventure; return { name: m.name, diff: m.difficulty, gdiff: g.difficulty, on: !!(a && a.on), band: a && a.band, enc: a && a.enc, prev: a && a.prevDiff, xp: a && a.me.xp, once: a && Object.keys(a.me.once), bound: VR.Adventure.meta === m }; });
  console.log('     ' + JSON.stringify(w));
  check(w.on && w.bound && w.diff === 'peaceful' && w.gdiff === 'peaceful' && w.band === 'normal' && w.enc === 'normal', 'an Abenteuer world: its record on, the world peaceful (the old mobs stay out), Schwierigkeit Normal → band normal, Begegnungen normal');
  N.firstXP = w.xp;
  await step(20);
  const hello = await ev(() => ({ n: VR.Adventure.stats.welcomes, greet: !!VR.Adventure.greet }));
  check(hello.n === 1 && !hello.greet, 'the new Abenteuer world said hello once („⚔ Das Abenteuer beginnt", ' + JSON.stringify(hello) + ')');
  check(w.xp >= 15 && w.once.some(k => /^biome:/.test(k)), 'the first biome found counted on its own through codex.js (' + w.xp + ' XP: ' + w.once.join(', ') + ')');

  // ---------------------------------------------------------------- 2 · the ring, placing
  console.log('2 · the ring on the HUD, placing');
  const hud0 = await ev(() => { const e = document.getElementById('advhud'), r = e && e.getBoundingClientRect(); return e ? { inHud: !!e.closest('#hud'), shown: getComputedStyle(e).display !== 'none', x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), lvl: e.querySelector('.lvl').textContent, arc: e.querySelector('.arc') && e.querySelector('.arc').style.strokeDashoffset } : null; });
  check(!!hud0 && hud0.inHud && hud0.shown && hud0.x < 40 && hud0.y < 40, 'the ring sits top left inside #hud (' + JSON.stringify(hud0) + ')');
  const pl = await ev(() => { const g = VR.game, p = g.player, A = VR.Adventure, me = g.meta.adventure.me, x0 = me.xp, R = VR.R, t = R.byName.oak_planks, s = t.defaultState, b = [Math.floor(p.pos[0]) + 3, Math.floor(p.pos[1]), Math.floor(p.pos[2]) + 3];
    for (let i = 0; i < 25; i++) p.afterPlace(t, b[0] + (i % 5), b[1] + 3, b[2] + Math.floor(i / 5), s);
    const x1 = me.xp; for (let i = 0; i < 25; i++) p.afterPlace(t, b[0] + (i % 5), b[1] + 3, b[2] + Math.floor(i / 5), s);
    return { d1: x1 - x0, d2: me.xp - x1, last: Date.now() - A.lastBuildAt }; });
  check(pl.d1 === 1 && pl.d2 === 0 && pl.last < 5000, 'placing through player.js afterPlace: 25 new positions 1 XP, the same 25 again nothing; Bauruhe knows the last build (' + JSON.stringify(pl) + ')');

  // ---------------------------------------------------------------- 3 · the level-up to 5
  console.log('3 · the level-up');
  await ev(() => { const g = VR.game, p = g.player; p.pitch = 0.04; const me = g.meta.adventure.me; me.xp = 585; const lv = VR.Adv.levelOf(me.xp); me.level = lv.level; VR.Adventure.renderHud(true); });
  await draw(5200); await step(4); await draw(5200);
  const before = await ev(() => ({ chime: (VR.game.audio.counts || {})['adv.chime'] || 0, ups: VR.Adventure.stats.ups, taler: VR.game.meta.adventure.me.taler, parts: VR.game.particles.count !== undefined ? VR.game.particles.count : null }));
  const up = await ev(() => { const A = VR.Adventure, r = A.award('wonder', { id: 'adventure.mjs' }); clearTimeout(A.banT); const b = document.getElementById('advup'); return { r, banner: b ? b.className : null, text: b ? b.innerText : '', ups: A.stats.ups, chime: (VR.game.audio.counts || {})['adv.chime'] || 0, taler: VR.game.meta.adventure.me.taler }; });
  console.log('     ' + JSON.stringify(up));
  check(up.r && up.r.xp === 80 && up.r.level === 5 && up.r.up === 1 && up.r.gift === 50, 'a wonder (80 XP) lifts level 4 to 5, a gift level: 50 Sterntaler');
  check(up.banner === 'on' && /Stufe 5/.test(up.text) && /Wertpunkt/.test(up.text) && /50 Sterntaler/.test(up.text) && /ABENTEUER/.test(up.text), 'the banner: ✦ ABENTEUER ✦ · Stufe 5 · +1 Wertpunkt · 🎁 Geschenk: 50 Sterntaler');
  check(up.ups === before.ups + 1 && up.chime === before.chime + 1 && up.taler === before.taler + 50, 'one level-up, one chime in the day\'s key, the gift in the wallet');
  await step(5); await draw();
  await hold(700);
  const look = await ev(() => { const b = document.getElementById('advup'), big = b.querySelector('.big'), r = big.getBoundingClientRect(), h = document.getElementById('advhud'); return { big: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], sparks: b.querySelectorAll('.sparks i').length, pulse: h.classList.contains('up'), fl: !!h.querySelector('.fl') }; });
  check(look.sparks >= 12 && look.pulse && look.big[2] > 150, 'the burst: sparks, the ring pulsing, the big title (' + JSON.stringify(look) + ')');
  pics.levelup = await shot('adventure_levelup');
  await release();
  await ev(() => { const b = document.getElementById('advup'); if (b) b.className = ''; });
  await wait(1700);
  await draw(5200);
  pics.hud = await shot('adventure_hud');

  // ---------------------------------------------------------------- 4 · the pause menu, the cards
  console.log('4 · the pause menu and the cards');
  await ev(() => VR.game.ui.pause());
  await wait(250);
  const pb = await ev(() => { const b = document.querySelector('#pause [data-act="adventure"]'); return b ? { text: b.textContent, prev: b.previousElementSibling && b.previousElementSibling.dataset.act, on: b.classList.contains('on'), shown: getComputedStyle(b).display !== 'none' } : null; });
  check(!!pb && pb.text === '⚔ Abenteuer' && pb.prev === 'meins' && pb.on && pb.shown, 'the pause menu: ⚔ Abenteuer after 🎒 Meins (' + JSON.stringify(pb) + ')');
  pics.pause = await shot('adventure_pause');
  await ev(() => document.querySelector('#pause [data-act="adventure"]').click());
  await wait(300);
  const card = await ev(() => { const c = document.querySelector('#adventure .panel'); return { screen: VR.game.ui.screen, way: c.querySelector('[data-act="adv:way"].on') && c.querySelector('[data-act="adv:way"].on').dataset.v, band: c.querySelector('[data-act="adv:band"].on') && c.querySelector('[data-act="adv:band"].on').dataset.v, enc: c.querySelector('[data-act="adv:enc"].on') && c.querySelector('[data-act="adv:enc"].on').dataset.v, lv: (c.querySelector('.advsum .lv') || {}).textContent, xp: (c.querySelector('.advsum .xp') || {}).textContent, tal: (c.querySelector('.advsum .tal') || {}).textContent, pts: (c.querySelector('.advsum .ptsl') || {}).textContent, h: Math.round(c.getBoundingClientRect().height) }; });
  console.log('     ' + JSON.stringify(card));
  check(card.screen === 'adventure' && card.way === 'adv' && card.band === 'normal' && card.enc === 'normal' && card.lv === 'Stufe 5' && /Sterntaler/.test(card.tal) && /Punkt/.test(card.pts), 'the card „⚔ Abenteuer": Spielweg, Schwierigkeit, Begegnungen, Stufe 5, the Sterntaler, the free points');
  check(card.h <= 700, 'the card fits a 720-px screen (' + card.h + ' px)');
  pics.card = await shot('adventure_card');
  await ev(() => document.querySelector('#adventure [data-act="adv:stats"]').click());
  await wait(250);
  for (const k of ['ges', 'ges', 'aus', 'aus', 'spu']) await ev((k) => { const b = document.querySelector(`#advstats [data-act="adv:pt"][data-stat="${k}"]`); if (b && !b.disabled) b.click(); }, k);
  await wait(250);
  const st = await ev(() => { const g = VR.game, me = g.meta.adventure.me; return { screen: g.ui.screen, pts: me.pts, free: VR.Adv.points(me), plusOff: [...document.querySelectorAll('#advstats [data-act="adv:pt"]')].every(b => b.disabled), respecOn: !document.querySelector('#advstats [data-act="adv:respec"]').disabled, rows: document.querySelectorAll('#advstats .advstat').length, h: Math.round(document.querySelector('#advstats .panel').getBoundingClientRect().height) }; });
  console.log('     ' + JSON.stringify(st));
  check(st.screen === 'advstats' && st.rows === 5 && st.pts.ges === 2 && st.pts.aus === 2 && st.pts.spu === 1 && st.free === 0 && st.plusOff, 'the stats card: five stats, five points given (Geschick 2, Ausdauer 2, Spürsinn 1), none left — every ＋ off');
  check(st.respecOn && st.h <= 700, 'respec offered at home; the card fits (' + st.h + ' px)');
  pics.stats = await shot('adventure_stats');
  const mine = await ev(() => { const g = VR.game, s = VR.R.byName.stone.defaultState, t1 = g.player.breakTime(s, null), m = VR.Adventure.mineMul(); return { t: +t1.toFixed(3), mul: m, wrapped: !!VR.Player.prototype.breakTime.__adv }; });
  check(mine.wrapped && Math.abs(mine.mul - 1.1) < 1e-9, '🛠 Geschick 2: mining 10 % faster (' + JSON.stringify(mine) + ')');
  await page.keyboard.press('Escape'); await wait(200);
  const e1 = await ev(() => VR.game.ui.screen);
  await page.keyboard.press('Escape'); await wait(200);
  const e2 = await ev(() => VR.game.ui.screen);
  check(e1 === 'adventure' && e2 === 'pause', 'Esc steps back: the stats → the card → the pause menu (' + e1 + ' → ' + e2 + ')');
  // off and on again; Kindersicher
  await ev(() => document.querySelector('#pause [data-act="adventure"]').click()); await wait(150);
  await ev(() => document.querySelector('#adventure [data-act="adv:way"][data-v="free"]').click()); await wait(150);
  const off = await ev(() => { const g = VR.game, a = g.meta.adventure; return { on: a.on, xp: a.me.xp, hud: getComputedStyle(document.getElementById('advhud')).display, dim: !!document.querySelector('#adventure .advsum.adv-dim'), foot: !!document.querySelector('#adventure .advfoot') }; });
  check(!off.on && off.xp > 600 && off.hud === 'none' && off.dim && off.foot, '„Frei bauen": the Abenteuer off, the ring gone, the level and the Taler kept and said so (' + JSON.stringify(off) + ')');
  await ev(() => document.querySelector('#adventure [data-act="adv:way"][data-v="adv"]').click()); await wait(150);
  const on2 = await ev(() => ({ on: VR.game.meta.adventure.on, ask: !!document.querySelector('#adventure .advask'), hud: getComputedStyle(document.getElementById('advhud')).display }));
  check(on2.on && !on2.ask && on2.hud !== 'none', 'on again: no question (asked once), the ring back');
  await ev(() => { const g = VR.game; g.settings.kids = true; VR.Adventure.renderCard(); });
  const kids = await ev(() => { const b = [...document.querySelectorAll('#adventure [data-act="adv:enc"]')]; return { on: (b.find(x => x.classList.contains('on')) || {}).dataset.v, dis: b.every(x => x.disabled), note: (document.querySelector('#adventure .field:last-child .note') || {}).textContent }; });
  check(kids.on === 'off' && kids.dis && /Kindersicher/.test(kids.note || ''), '🧸 Kindersicher: Begegnungen fixed to aus (' + JSON.stringify(kids) + ')');
  await ev(() => { const g = VR.game; g.settings.kids = false; VR.Adventure.renderCard(); });
  await ev(() => VR.game.ui.resume());
  await wait(200);

  // ---------------------------------------------------------------- 5 · the numbers
  console.log('5 · the numbers');
  const aw = await ev(() => {
    const A = VR.Adventure, n = 20000, p = VR.game.player.pos;
    let t0 = performance.now();
    for (let i = 0; i < n; i++) A.award('place', { x: Math.floor(p[0]) + 40 + (i % 100), y: 120 + ((i / 10000) | 0), z: Math.floor(p[2]) + ((i / 100) | 0) });
    const place = (performance.now() - t0) / n;
    t0 = performance.now();
    for (let i = 0; i < n; i++) A.award('biome', { id: 'bench' + (i & 31) });
    const once = (performance.now() - t0) / n;
    return { place, once };
  });
  N.awardMs = aw;
  check(aw.place <= 0.01 && aw.once <= 0.01, 'award() in the page: ' + (aw.place * 1000).toFixed(2) + ' µs placing, ' + (aw.once * 1000).toFixed(2) + ' µs a once-each kind (≤ 10 µs)');
  await step(20);
  const hw = await ev(() => { const A = VR.Adventure; return { w: A.stats.hudWrites, a: A.stats.awards }; });
  await step(300);
  const hw2 = await ev(() => { const A = VR.Adventure; return { w: A.stats.hudWrites, a: A.stats.awards }; });
  N.hud = { frames: 300, writes: hw2.w - hw.w, awards: hw2.a - hw.a };
  check(hw2.w - hw.w <= Math.max(1, hw2.a - hw.a), 'the HUD over 300 frames: ' + (hw2.w - hw.w) + ' writes for ' + (hw2.a - hw.a) + ' awards — no per-frame work');
  // the game loop on Very Low and High, the Abenteuer off and on, alternating blocks of 200 frames (CPU, drawing off)
  const frames = (n) => ev((n) => { const g = VR.game; window.__norender = true; const a = performance.now(); for (let i = 0; i < n; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } return (performance.now() - a) / n; }, n);
  const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1];
  N.cost = {};
  for (const preset of ['potato', 'high']) {
    await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.renderDist = 6; g.applySettings('renderDist'); }, preset);
    await step(120);
    const offs = [], ons = [];
    for (let r = 0; r < 3; r++) {
      await ev(() => VR.Adventure.setOn(false)); await step(20); offs.push(await frames(200));
      await ev(() => VR.Adventure.setOn(true)); await step(20); ons.push(await frames(200));
    }
    const o = med(offs), n = med(ons);
    N.cost[preset] = { off: +o.toFixed(3), on: +n.toFixed(3), offs: offs.map(v => +v.toFixed(3)), ons: ons.map(v => +v.toFixed(3)) };
    check(n <= o * 1.1 + 0.1, (preset === 'potato' ? 'Very Low' : 'High') + ': the game loop ' + o.toFixed(3) + ' ms off → ' + n.toFixed(3) + ' ms on (medians of three blocks of 200 frames; CPU, drawing off)');
  }
  await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.settings.renderDist = 6; g.applySettings('renderDist'); });
  // the record in IndexedDB
  const saved = await ev(async () => { const g = VR.game; await g.saveMeta(); const ws = await g.store.listWorlds(); const w = ws.find(x => x.id === g.meta.id); return w && w.adventure ? { xp: w.adventure.me.xp, live: g.meta.adventure.me.xp, on: w.adventure.on, pts: w.adventure.me.pts, v: w.adventure.v } : null; });
  check(!!saved && saved.xp === saved.live && saved.on && saved.v === 1 && saved.pts.ges === 2, 'the record is in IndexedDB with the world (' + JSON.stringify(saved) + ')');
  N.record = await ev(() => JSON.stringify(VR.game.meta.adventure).length);
  console.log('     the record: ' + N.record + ' bytes');

  // ---------------------------------------------------------------- no page errors
  const pageErrs = logs.filter(l => l.startsWith('[pageerror]'));
  check(pageErrs.length === 0, 'no page errors (' + pageErrs.length + ')' + (pageErrs.length ? '\n' + pageErrs.slice(0, 4).join('\n') : ''));
  const advErrs = logs.filter(l => /adventure|Adventure|advhud|advup/.test(l));
  check(advErrs.length === 0, 'no console message from the Abenteuer (' + advErrs.length + ')' + (advErrs.length ? '\n' + advErrs.slice(0, 4).join('\n') : ''));
  console.log('console messages: ' + logs.length + (logs.length ? '\n' + logs.slice(0, 10).join('\n') : ''));
} catch (e) {
  fails++; console.log('  ✗ the run stopped: ' + (e.stack || e.message).slice(0, 1200));
  try { await page.screenshot({ path: SHOTS + 'adventure_fail.png' }); } catch (e2) { /* */ }
} finally {
  fs.writeFileSync(SHOTS + 'adventure_numbers.json', JSON.stringify(N, null, 1));
  try {
    const spec = { cols: [], w: 640, rows: [
      { label: 'create', labels: ['1 · Neue Welt: Spielweg ⚔ Abenteuer', '3 · Stufe 5 (CSS bei 0,7 s)'], imgs: [pics.create || null, pics.levelup || null] },
      { label: 'menu', labels: ['4 · Pause: ⚔ Abenteuer', '4 · die Karte „Abenteuer"'], imgs: [pics.pause || null, pics.card || null] },
      { label: 'stats', labels: ['4 · Deine Werte', '2 · der Ring im Spiel'], imgs: [pics.stats || null, pics.hud || null] },
      { label: 'meins', labels: ['0 · 🎒 Meins: ⚔ Abenteuer-Welt beginnen', ''], imgs: [pics.meins || null, null] },
    ] };
    fs.writeFileSync(SHOTS + 'adventure_sheet.json', JSON.stringify(spec));
    execFileSync('python3', ['/root/r9coord/sheet.py', SHOTS + 'adventure_sheet.jpg', SHOTS + 'adventure_sheet.json'], { stdio: 'inherit' });
  } catch (e) { console.log('sheet: ' + e.message); }
  await browser.close();
  console.log('numbers ' + JSON.stringify(N));
  console.log(fails ? 'FAILED ' + fails : 'ALL OK');
  process.exit(fails ? 1 : 0);
}
