// 💡 Erfinderwerkstatt (spec 2026-10-08-new-era-wave2-design.md W-B): two cards together make something new.
// German (de-DE). 1 the start screen: 🎒 Meins has the 💡 card, six start cards, Feuer + Stein = Ofen, Esc goes back ·
// 2 a Creative world: 💡 beside 🎒 in the pause menu (Einfach and Profi), the invention lands in the inventory, a wrong pair
// wobbles and loses nothing, 💡 Tipp fills a working pair · 3 key I (open, close, not while typing, Esc goes one step back and
// does not open the pause menu), the keyboard (Tab · arrows · Enter), the toast „💡 Neu im Inventar" · 4 dragging a card onto
// another with the mouse · 5 📖 the book (found with their line, the rest silhouettes), ⌫ forget with a question · 6 a reload keeps
// the progress (r9si.inventions) · 7 a Survival world: no free item, the recipe in pictures, the codex lists it · 8 a phone-sized
// screen, 44 px targets · 9 English. No page errors. Screenshots: test/shots/invent_1..3.png (the reveal, the workbench with a
// Tipp, the phone) and invent_book / invent_survival. ONLY=1,4 runs only those sections.
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
const waitFor = async (fn, arg, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await safe(fn, arg)) return true; await wait(80); } return false; };
const atTitle = async (maxS = 150) => { for (let i = 0; i < maxS * 2; i++) { await wait(500); if (await safe(() => !!(window.VR && VR.game && VR.game.state === 'title'))) return true; } return false; };
const inPlay = async (maxS = 180) => { for (let i = 0; i < maxS * 2; i++) { await wait(500); if (await safe(() => { const g = window.VR && VR.game; return !!(g && g.state === 'play' && g.player && !g.player.hold && !g.studioOpen); })) return true; } return false; };
const lowSettings = () => ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.dynRes = false; g.settings.renderDist = 4; g.settings.horizon = 0; g.applySettings('*'); g.saveSettings(); });
// a world of this mode, in play (the one that is open, else a new one)
const enterWorld = async (mode) => {
  if (await ev((m) => VR.game.state === 'play' && VR.game.meta.mode === m, mode)) return true;
  if (await ev(() => VR.game.state === 'play')) { await ev(() => VR.game.quitToTitle()); await atTitle(); }
  await ev((m) => VR.game.createWorld({ name: 'Erfinder ' + m, mode: m, difficulty: 'peaceful', type: 'flat', seed: '4711', cheats: m === 'creative', kit: m === 'creative' }), mode);
  const ok = await inPlay();
  check(ok, 'a ' + mode + ' world is open');
  if (ok) await wait(600);
  return ok;
};
// ---- helpers: the workshop
const isOpen = () => safe(() => !!(window.VR && VR.Invent && VR.Invent.isOpen()));
const state = () => ev(() => VR.Invent.state());
const center = (sel) => ev((s) => { const n = document.querySelector(s); if (!n) return null; const r = n.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; }, sel);
const tap = (k) => page.click(`#invent .erf-card[data-k="${k}"]`);
const revealUp = () => waitFor(() => { const L = document.getElementById('erf-layer'); return !!(L && !L.hidden && L.querySelector('.erf-rv')); }, null, 10000);
const layerGone = () => waitFor(() => { const L = document.getElementById('erf-layer'); return !!(L && L.hidden); }, null, 4000);
const rv = () => ev(() => {
  const L = document.getElementById('erf-layer'), q = (s) => { const n = L.querySelector(s); return n ? n.textContent.trim() : null; };
  const px = (cv) => { if (!cv) return -1; const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 20) n++; return n; };
  const pill = L.querySelector('.erf-pill');
  return { name: q('.erf-rn'), line: q('.erf-rl'), badge: q('.erf-badge'), pill: pill ? pill.textContent.trim() : null, pillKind: pill ? pill.className.replace('erf-pill', '').trim() : null,
    craftCells: L.querySelectorAll('.erf-craft .erf-cgrid .erf-cc:not(.empty)').length, craftNote: q('.erf-craft .erf-note'), confetti: L.querySelectorAll('.erf-cf').length, bigPx: px(L.querySelector('.erf-big canvas')), from: L.querySelectorAll('.erf-from .erf-pic').length };
});
const closeReveal = async () => { await wait(650); await page.click('#erf-layer .erf-go'); return layerGone(); };
const trayKeys = () => ev(() => [...document.querySelectorAll('#erf-tray .erf-card')].map(c => c.dataset.k));
const countText = () => ev(() => document.getElementById('erf-count').textContent.trim());
const stored = () => ev(() => { try { const o = JSON.parse(localStorage.getItem('r9si.inventions') || 'null'); return o && o.found ? Object.keys(o.found) : []; } catch (e) { return null; } });
const msg = () => ev(() => { const m = document.getElementById('erf-msg'); return { kind: m.dataset.kind, text: m.textContent.trim() }; });
// two cards together by tapping, and the reveal
const makeBy = async (a, b) => { await tap(a); await tap(b); return revealUp(); };
const hotbarHas = (id) => ev((i) => VR.game.player.inv.slots.slice(0, 9).some(s => s && s.id === i), id);
const invCount = (id) => ev((i) => VR.game.player.inv.count(i), id);
const wrongPair = () => ev(() => { const I = VR.Inventions, ks = I.cards(); for (const a of ks) for (const b of ks) if (!I.find(a, b)) return [a, b]; return null; });

await page.goto(URL0 + '/index.html', NAV);
check(await atTitle(), 'the game is at its start screen');
await lowSettings();

// ================================================================ 1
await section(1, 'the start screen: 🎒 Meins has the 💡 card; six start cards; Feuer + Stein make an Ofen; Esc goes back', async () => {
  await page.click('#title .tile[data-tile="meins"]');
  check(await waitFor(() => !!document.querySelector('#meins.on .mbody .erf-mcard')), 'the 🎒 Meins page shows the 💡 card');
  const mc = await ev(() => { const b = document.querySelector('#meins .mbody'), c = b.querySelector('.erf-mcard'); return { first: b.firstElementChild === c, text: c.textContent.replace(/\s+/g, ' ').trim(), h: c.getBoundingClientRect().height, pics: c.querySelectorAll('.erf-mpic i').length }; });
  console.log('  card', JSON.stringify(mc));
  check(mc.first && mc.h >= 44 && /Erfinden/.test(mc.text) && mc.pics === 3, 'it comes first, 🔥 + 🪨 = 💡 in pictures, „Erfinden" in words (' + mc.text + ')');
  await shot('invent_meins');
  const t0 = Date.now();
  await page.click('#meins .erf-mcard');
  check(await isOpen(), 'the card opens the workshop (' + (Date.now() - t0) + ' ms with the click)');
  const s = await ev(() => ({
    title: document.getElementById('erf-title').textContent.trim(), count: document.getElementById('erf-count').textContent.trim(), cards: [...document.querySelectorAll('#erf-tray .erf-card')].map(c => c.dataset.k + ':' + c.textContent.trim()),
    hint: [...document.querySelectorAll('#erf-tray .erf-card.hint')].map(c => c.dataset.k).join(), msg: document.getElementById('erf-msg').textContent.trim(), slots: document.querySelectorAll('#erf-bench .erf-slot').length,
    chips: [...document.querySelectorAll('#erf-chips .erf-chip')].map(c => c.textContent.trim()), tools: [...document.querySelectorAll('.erf-tools .erf-btn')].map(b => b.textContent.trim()), on: document.getElementById('invent').classList.contains('on') }));
  console.log('  screen', JSON.stringify(s));
  check(s.on && s.title === '💡 Erfinden', 'the screen is German: „💡 Erfinden"');
  check(s.cards.join() === 'holz:Holz,stein:Stein,feuer:Feuer,wasser:Wasser,erde:Erde,luft:Luft', 'six start cards: Holz · Stein · Feuer · Wasser · Erde · Luft');
  check(/^0 \/ \d{3} erfunden$/.test(s.count), 'the count starts at „0 / 167 erfunden" (' + s.count + ')');
  check(s.hint === 'feuer,stein' && /Feuer und Stein/.test(s.msg), 'the first time, Feuer and Stein are lit and the help says so');
  check(s.slots === 2 && s.tools.includes('💡 Tipp') && s.tools.includes('📖 Buch') && s.chips[0] === '✨ Alle', 'two slots, 💡 Tipp, 📖 Buch, ⌫, and the category chips');
  // the six pictures are drawn, a few per frame
  check(await waitFor(() => { const px = (cv) => { const d = cv.getContext('2d').getImageData(0, 0, 64, 64).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 20) n++; return n; }; const cs = [...document.querySelectorAll('#erf-tray .erf-card canvas')]; return cs.length === 6 && cs.every(c => px(c) > 300); }, null, 8000), 'all six start cards show a picture (not an empty square)');
  const looks = await ev(() => { const px = (cv) => { const d = cv.getContext('2d').getImageData(0, 0, 64, 64).data; let h = 0; for (let i = 0; i < d.length; i += 4) h = (h * 31 + d[i] * 3 + d[i + 1] * 5 + d[i + 2] * 7 + d[i + 3]) | 0; return h; }; return new Set([...document.querySelectorAll('#erf-tray .erf-card canvas')].map(px)).size; });
  check(looks === 6, 'six different pictures (' + looks + ')');
  await shot('invent_start');
  // Feuer + Stein
  check(await makeBy('feuer', 'stein'), 'tap Feuer, tap Stein → the invention appears');
  await wait(350);
  const r = await rv();
  console.log('  reveal', JSON.stringify(r));
  check(r.name === 'Ofen' && /Feuer|Steine|Ofen|backen/i.test(r.line || '') && r.line.length <= 70 && r.badge === '✨ Neu erfunden!', 'it is the Ofen, with a friendly line and „✨ Neu erfunden!" (' + r.line + ')');
  check(r.pill === null && r.bigPx > 300 && r.from === 2, 'no world yet, so nothing is handed over; the big picture is drawn; the two cards that made it show');
  check(await closeReveal(), 'Weiter closes it');
  const keys = await trayKeys();
  check(keys.length === 7 && keys[6] === 'ofen', 'the Ofen joins the cards (7 now)');
  check(/^1 \/ \d{3} erfunden$/.test(await countText()), 'the count is 1 (' + await countText() + ')');
  check((await stored()).join() === 'ofen', 'r9si.inventions keeps it');
  const st = await state();
  check(st.slots.every(x => x === null) && !st.busy, 'the slots are empty again for the next try');
  await page.keyboard.press('Escape'); await wait(300);
  check(!(await isOpen()) && await ev(() => document.getElementById('meins').classList.contains('on')), 'Esc goes back to the 🎒 Meins page');
  await page.click('#meins [data-act="meinsback"]'); await wait(300);
});

// ================================================================ 2
await section(2, 'a Creative world: 💡 in the pause menu; the invention goes into the inventory; a wrong pair wobbles; 💡 Tipp', async () => {
  if (!(await enterWorld('creative'))) return;
  await page.keyboard.press('Escape');
  if (!(await waitFor(() => VR.game.ui.screen === 'pause', null, 2500))) await ev(() => VR.game.ui.pause());
  check(await waitFor(() => VR.game.ui.screen === 'pause', null, 3000), 'Esc opens the pause menu');
  const pb = await ev(() => {
    const row = document.querySelector('#pause .erf-prow'), b = row && row.querySelector('[data-act="invent"]'), m = row && row.querySelector('[data-act="meins"]');
    const r = (n) => { const x = n.getBoundingClientRect(); return { top: Math.round(x.top), w: Math.round(x.width), h: Math.round(x.height) }; };
    return b && m ? { text: b.textContent.trim(), tip: b.title, invent: r(b), meins: r(m), visible: b.getClientRects().length > 0 } : null;
  });
  console.log('  pause', JSON.stringify(pb));
  check(!!pb && pb.visible && pb.text === '💡 Erfinden' && /Karten/.test(pb.tip), 'Einfach: „💡 Erfinden" is in the pause menu (title text says what it is)');
  check(!!pb && Math.abs(pb.invent.top - pb.meins.top) <= 1 && pb.invent.h >= 44 && pb.meins.h >= 44, 'it sits beside 🎒 Meins in one row, 44 px high');
  await shot('invent_pause');
  await ev(() => VR.UIPrefs.set({ pro: true })); await wait(150);
  check(await ev(() => { const b = document.querySelector('#pause [data-act="invent"]'); return !!b && b.getClientRects().length > 0; }), 'Profi: the button is there too');
  await ev(() => VR.UIPrefs.set({ pro: false })); await wait(150);

  await page.click('#pause [data-act="invent"]');
  check(await isOpen(), 'a click opens the workshop');
  let st = await state();
  check(st.from === 'pause' && st.slots.every(x => x === null), 'it knows it came from the pause menu');
  // Feuer + Stein
  const had = await ev(() => VR.Inventions.has('ofen'));
  check(await makeBy('feuer', 'stein'), 'Feuer + Stein → the invention appears');
  await wait(380);
  let r = await rv();
  console.log('  reveal', JSON.stringify(r));
  check(r.name === 'Ofen' && r.badge === (had ? 'Das kennst du schon.' : '✨ Neu erfunden!'), 'the Ofen (' + r.badge + ')');
  check(r.pill === '💡 Neu im Inventar' && r.pillKind === 'inv', 'Creative: „💡 Neu im Inventar"');
  check((await invCount('furnace')) >= 1 && await hotbarHas('furnace'), 'the furnace is in the inventory, on the hotbar');
  check(r.confetti > 10, 'a little confetti (' + r.confetti + ' pieces)');
  await shot('invent_1');
  check(await closeReveal(), 'Weiter');
  check((await trayKeys()).includes('ofen'), 'the Ofen is among the cards');
  // a wrong pair wobbles, nothing is lost
  const wp = await wrongPair();
  check(!!wp, 'there is a pair that makes nothing (' + (wp || []).join(' + ') + ')');
  if (wp) {
    const n0 = (await trayKeys()).length, c0 = await countText(), inv0 = await invCount('furnace');
    await ev(() => { window.__wob = 0; const b = document.getElementById('erf-bench'); new MutationObserver(() => { if (b.classList.contains('wobble')) window.__wob++; }).observe(b, { attributes: true, attributeFilter: ['class'] }); });
    await tap(wp[0]); await tap(wp[1]);
    await waitFor(() => window.__wob > 0, null, 4000);
    const m1 = await msg();
    await wait(1000);
    const st2 = await state();
    check(await ev(() => window.__wob) > 0 && m1.kind === 'nope' && /passt nicht/.test(m1.text), 'a wrong pair: both cards wobble and it says „Hm, das passt nicht" (' + m1.text + ')');
    check(st2.slots.every(x => x === null) && !st2.busy && !st2.layer, 'the slots are free again');
    check((await trayKeys()).length === n0 && await countText() === c0 && (await invCount('furnace')) === inv0, 'nothing is lost or gained');
  }
  // 💡 Tipp
  const tip0 = await ev(() => VR.Inventions.tip());
  await page.click('[data-erf="tip"]');
  await wait(200);
  st = await state();
  const tm = await msg();
  const ok2 = !!tip0 && st.slots[0] === tip0.a && st.slots[1] === tip0.b && st.tip && st.tip.join() === [tip0.a, tip0.b].join();
  check(ok2 && tm.kind === 'tip', '💡 Tipp puts a working pair into the slots (' + (st.slots || []).join(' + ') + ' → ' + (tip0 && tip0.k) + ')');
  check(await ev(() => !!document.querySelector('#invent .erf-eq.glow:not([disabled])')), 'the = button glows and is ready');
  await shot('invent_2');
  await page.click('#invent .erf-eq');
  check(await revealUp(), '= makes it');
  await wait(380);
  r = await rv();
  const tipName = await ev((k) => VR.Inventions.text(k).name, tip0.k);
  check(r.name === tipName && r.badge === '✨ Neu erfunden!', 'the Tipp invention is new: ' + r.name);
  const tipId = await ev((k) => VR.Inventions.idOf(k), tip0.k);
  check(r.pill === '💡 Neu im Inventar' && (await invCount(tipId)) >= 1, 'and in the inventory (' + tipId + ')');
  await closeReveal();
  // Esc goes back to the pause menu, ▶ Weiterspielen to the game
  await page.keyboard.press('Escape'); await wait(300);
  check(!(await isOpen()) && await ev(() => VR.game.ui.screen) === 'pause', 'Esc: back to the pause menu');
  await page.click('#pause [data-act="resume"]'); await wait(300);
  check(await ev(() => !VR.game.ui.screen && VR.game.state === 'play'), '▶ Weiterspielen: back in the game');
});

// ================================================================ 3
await section(3, 'key I: open, keyboard, Esc one step back, not while typing; the toast', async () => {
  if (!(await enterWorld('creative'))) return;
  await ev(() => { const u = VR.game.ui; if (u.screen) u.resume(); });
  await wait(200);
  // typing: key I in a text box is a letter
  await ev(() => { const i = document.createElement('input'); i.id = 'erftest'; i.style.cssText = 'position:fixed;left:0;top:0;z-index:99999'; document.body.appendChild(i); i.focus(); });
  await page.keyboard.press('i'); await wait(200);
  check(!(await isOpen()) && await ev(() => document.getElementById('erftest').value) === 'i', 'I typed into a text box stays a letter');
  await ev(() => document.getElementById('erftest').remove());
  await ev(() => { document.activeElement && document.activeElement.blur(); });
  // chat open (ui.typing) is the same
  const typed = await ev(() => { const u = VR.game.ui; u.typing = true; return true; });
  await page.keyboard.press('i'); await wait(150);
  check(typed && !(await isOpen()), 'with the chat open, I does nothing');
  await ev(() => { VR.game.ui.typing = false; });
  // the real thing
  const t0 = await ev(() => performance.now());
  await page.keyboard.press('i');
  check(await waitFor(() => VR.Invent.isOpen(), null, 3000), 'I opens the workshop in the game');
  const ms = await ev((t) => performance.now() - t, t0);
  console.log('  open took ' + Math.round(ms) + ' ms (with the key press)');
  let st = await state();
  check(st.from === 'game', 'it knows it came from the game');
  const foc = await ev(() => document.activeElement && document.activeElement.dataset && document.activeElement.dataset.k);
  check(foc === 'holz', 'the first card has the focus (keyboard play): ' + foc);
  await page.keyboard.press('ArrowRight'); await wait(60);
  check(await ev(() => document.activeElement.dataset.k) === 'stein', 'ArrowRight moves to the next card');
  await page.keyboard.press('Tab'); await wait(60);
  check(await ev(() => !!document.activeElement.closest('#invent')), 'Tab stays inside the workshop');
  // Tip pair with the keyboard: Enter on the first card, Enter on the second
  const tp = await ev(() => VR.Inventions.tip());
  const had = await ev((k) => VR.Inventions.has(k), tp.k);
  const tpId = await ev((k) => VR.Inventions.idOf(k), tp.k), c0 = await invCount(tpId);
  await ev((k) => document.querySelector('#invent .erf-card[data-k="' + k + '"]').focus(), tp.a);
  await page.keyboard.press('Enter'); await wait(120);
  st = await state();
  check(st.slots[0] === tp.a && st.slots[1] === null, 'Enter picks the first card');
  await ev((k) => document.querySelector('#invent .erf-card[data-k="' + k + '"]').focus(), tp.b);
  await page.keyboard.press('Enter');
  check(await revealUp(), 'Enter on the second card makes the invention');
  const foc2 = await ev(() => document.activeElement && document.activeElement.className);
  check(/erf-go/.test(foc2 || ''), 'the focus is on „Weiter" (' + foc2 + ')');
  await wait(650);
  await page.keyboard.press('Enter');
  check(await layerGone(), 'Enter on Weiter goes on');
  check(await ev((k) => document.activeElement && document.activeElement.dataset && document.activeElement.dataset.k === k, tp.k), 'the focus lands on the new card');
  // Esc: one step back (the book is a layer), then out; the game's pause menu must not open on top
  await ev(() => document.querySelector('[data-erf="book"]').focus());
  await page.keyboard.press('Enter'); await wait(250);
  check((await state()).layer === 'book', 'Enter on 📖 opens the book');
  await page.keyboard.press('Escape'); await wait(250);
  st = await state();
  check(st.open && st.layer === null, 'Esc closes the book first');
  await page.keyboard.press('Escape'); await wait(350);
  check(!(await isOpen()) && await ev(() => !VR.game.ui.screen && VR.game.state === 'play'), 'the second Esc leaves to the game — no pause menu on top');
  const toast = await ev(() => [...document.querySelectorAll('#toasts .toast')].map(t => t.textContent.trim()));
  console.log('  toasts', JSON.stringify(toast));
  const tpName = await ev((k) => VR.Inventions.text(k).name, tp.k);
  const got = (await invCount(tpId)) > c0;
  check(got, 'the ' + tpName + ' (' + tpId + ') went into the inventory' + (had ? ' (known already)' : ''));
  check(toast.some(t => /Neu im Inventar/.test(t) && t.includes(tpName)), 'back in the game the toast says „💡 Neu im Inventar" ' + tpName);
  // I opens and I closes (nothing open, no step in the way)
  await page.keyboard.press('i'); await waitFor(() => VR.Invent.isOpen(), null, 3000);
  await page.keyboard.press('i'); await wait(300);
  check(!(await isOpen()) && await ev(() => !VR.game.ui.screen), 'I again closes it');
});

// ================================================================ 4
await section(4, 'drag one card onto another with the mouse; onto a slot', async () => {
  if (!(await enterWorld('creative'))) return;
  await ev(() => { const u = VR.game.ui; if (u.screen) u.resume(); }); await wait(150);
  await page.keyboard.press('i'); await waitFor(() => VR.Invent.isOpen(), null, 3000);
  const a = await center('#invent .erf-card[data-k="holz"]'), b = await center('#invent .erf-card[data-k="wasser"]');
  const want0 = await ev(() => { const I = VR.Inventions, k = I.find('holz', 'wasser'); return { k, name: I.text(k).name }; });
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  await page.mouse.move(a.x + 14, a.y + 6, { steps: 3 });
  await page.mouse.move(b.x, b.y, { steps: 10 });
  await wait(120);
  const dr = await ev(() => ({ ghost: !!document.querySelector('#invent .erf-ghost'), drop: !!document.querySelector('#invent .erf-card.drop[data-k="wasser"]'), lift: !!document.querySelector('#invent .erf-card.lift[data-k="holz"]') }));
  console.log('  while dragging', JSON.stringify(dr));
  check(dr.ghost && dr.drop && dr.lift, 'while dragging: the card hangs on the pointer and the other one lights up');
  await page.mouse.up();
  check(await revealUp(), 'dropped on Wasser → Holz + Wasser make something');
  await wait(300);
  const r = await rv();
  check(r.name === want0.name, 'it is the one the table says: ' + r.name);
  await closeReveal();
  // onto a slot
  const e = await center('#invent .erf-card[data-k="erde"]'), s1 = await center('#invent .erf-slot[data-slot="1"]');
  await page.mouse.move(e.x, e.y); await page.mouse.down(); await page.mouse.move(e.x + 12, e.y + 12, { steps: 3 }); await page.mouse.move(s1.x, s1.y, { steps: 8 });
  await page.mouse.up(); await wait(100);
  let st = await state();
  check(st.slots[0] === null && st.slots[1] === 'erde', 'dropped on the second slot: Erde sits there');
  // a tap on a full slot takes the card back
  await page.click('#invent .erf-slot[data-slot="1"]'); await wait(80);
  st = await state();
  check(st.slots.every(x => x === null), 'a tap on a full slot takes the card back');
  // a short click is a tap, not a drag
  await tap('luft'); await wait(60);
  st = await state();
  check(st.slots[0] === 'luft' && !(await ev(() => !!document.querySelector('#invent .erf-ghost'))), 'a plain click picks (no drag started)');
  await page.click('#invent .erf-slot[data-slot="0"]');
  await page.keyboard.press('Escape'); await wait(300);
});

// ================================================================ 5
await section(5, '📖 the book and ⌫ forget (with a question)', async () => {
  if (!(await enterWorld('creative'))) return;
  await ev(() => { const u = VR.game.ui; if (u.screen) u.resume(); }); await wait(150);
  await page.keyboard.press('i'); await waitFor(() => VR.Invent.isOpen(), null, 3000);
  // make sure there is something to remember
  if ((await ev(() => VR.Inventions.count())) < 3) { for (let i = 0; i < 3; i++) { const t = await ev(() => VR.Inventions.tip()); if (!t) break; await makeBy(t.a, t.b); await closeReveal(); } }
  const n = await ev(() => VR.Inventions.count()), total = await ev(() => VR.Inventions.TOTAL);
  await page.click('[data-erf="book"]'); await wait(500);
  const bk = await ev(() => {
    const tiles = [...document.querySelectorAll('#erf-layer .erf-tile')];
    return { tiles: tiles.length, locked: tiles.filter(t => t.classList.contains('locked')).length, sum: (document.getElementById('erf-bksum') || {}).textContent, names: tiles.filter(t => !t.classList.contains('locked')).map(t => t.querySelector('.erf-name').textContent.trim()), lockedNames: [...new Set(tiles.filter(t => t.classList.contains('locked')).map(t => t.querySelector('.erf-name').textContent.trim()))],
      heads: [...document.querySelectorAll('#erf-layer .erf-bkc')].map(h => h.textContent.replace(/\s+/g, ' ').trim()), under: document.querySelector('#invent .erf-under').inert === true };
  });
  console.log('  book', JSON.stringify({ tiles: bk.tiles, locked: bk.locked, sum: bk.sum, heads: bk.heads.slice(0, 3) }));
  check(bk.tiles === total && bk.locked === total - n, 'the book has a tile for every invention; the ones not found are silhouettes (' + bk.tiles + ' tiles, ' + bk.locked + ' hidden)');
  check(bk.sum === `${n} von ${total} gefunden` && bk.lockedNames.join() === '???' && bk.names.length === n, 'found ones show their name, the others ??? (' + bk.sum + ')');
  check(bk.heads.length === 8 && bk.under, 'eight groups; the workbench below is inert while the book is open');
  await shot('invent_book');
  const first = await ev(() => document.querySelector('#erf-layer .erf-tile:not(.locked)').dataset.k);
  await page.click(`#erf-layer .erf-tile[data-k="${first}"]`); await wait(300);
  const dt = await ev(() => ({ layer: VR.Invent.state().layer, parts: document.querySelectorAll('#erf-layer .erf-formula .erf-fp').length, plus: document.querySelectorAll('#erf-layer .erf-formula b').length, name: (document.querySelector('#erf-layer .erf-rn') || {}).textContent, line: (document.querySelector('#erf-layer .erf-rl') || {}).textContent, take: !!document.querySelector('#erf-layer .erf-take') }));
  console.log('  detail', JSON.stringify(dt));
  check(dt.layer === 'detail' && dt.parts === 3 && dt.plus === 2 && !!dt.line && dt.take, 'a found tile opens its detail: [card] + [card] = [it], its line, and „🎒 Ins Inventar" in Creative');
  await page.keyboard.press('Escape'); await wait(200);
  check((await state()).layer === 'book', 'Esc goes from the detail back to the book');
  await page.keyboard.press('Escape'); await wait(200);
  check((await state()).layer === null && await isOpen(), 'and from the book to the workbench');
  // ⌫: first no, then yes
  await page.click('[data-erf="reset"]'); await wait(200);
  const ak = await ev(() => ({ layer: VR.Invent.state().layer, title: (document.querySelector('#erf-layer h3') || {}).textContent, focus: document.activeElement && document.activeElement.textContent.trim() }));
  check(ak.layer === 'ask' && ak.title === 'Alles vergessen?' && ak.focus === 'Nein, behalten', '⌫ asks „Alles vergessen?" — the focus is on „Nein, behalten"');
  await page.click('[data-erf="no"]'); await wait(200);
  check((await ev(() => VR.Inventions.count())) === n && (await state()).layer === null, 'Nein: everything stays');
  await page.click('[data-erf="reset"]'); await wait(200);
  await page.click('[data-erf="yes"]'); await wait(300);
  check((await ev(() => VR.Inventions.count())) === 0 && (await trayKeys()).length === 6 && /^0 \//.test(await countText()), 'Ja: all gone, only the six start cards are left');
  check(((await stored()) || []).length === 0, 'and the stored record is empty');
  check((await msg()).text === 'Alles vergessen. Es geht von vorn los!', 'it says so');
  // start again so the next sections have something to keep
  await makeBy('feuer', 'stein'); await closeReveal();
  await makeBy('holz', 'stein'); await closeReveal();
  await page.keyboard.press('Escape'); await wait(300);
});

// ================================================================ 6
await section(6, 'a reload keeps the progress', async () => {
  const before = await stored();
  if (!before || before.length < 1) { await ev(() => { VR.Inventions.combine('feuer', 'stein'); VR.Inventions.combine('holz', 'stein'); }); }
  const b2 = await stored();
  console.log('  stored before', JSON.stringify(b2));
  await page.goto(URL0 + '/index.html', NAV);
  check(await atTitle(), 'the game is back at its start screen after the reload');
  await lowSettings();
  const after = await stored();
  check(JSON.stringify(after) === JSON.stringify(b2) && after.length >= 2, 'r9si.inventions has the same inventions (' + after.join() + ')');
  await page.click('#title .tile[data-tile="meins"]');
  await waitFor(() => !!document.querySelector('#meins.on .erf-mcard'));
  await page.click('#meins .erf-mcard');
  check(await isOpen(), 'the workshop opens');
  const keys = await trayKeys(), c = await countText();
  check(keys.length === 6 + after.length && after.every(k => keys.includes(k)), 'the cards are all there again (' + keys.length + ')');
  check(c === `${after.length} / ${await ev(() => VR.Inventions.TOTAL)} erfunden`, 'the count says ' + c);
  const hint = await ev(() => document.querySelectorAll('#erf-tray .erf-card.hint').length);
  check(hint === 0, 'no hint glow any more once you have found something');
  await page.keyboard.press('Escape'); await wait(300);
  await page.click('#meins [data-act="meinsback"]'); await wait(300);
});

// ================================================================ 7
await section(7, 'a Survival world: no free item, the recipe in pictures, the codex lists it', async () => {
  if (await ev(() => VR.game.state === 'play' && VR.game.meta.mode !== 'survival')) { await ev(() => VR.game.quitToTitle()); await atTitle(); }
  if (!(await enterWorld('survival'))) return;
  await ev(() => { const u = VR.game.ui; if (u.screen) u.resume(); });
  await ev(() => { VR.Inventions.combine('feuer', 'stein'); });   // (known: the Ofen has a crafting recipe)
  await wait(150);
  await page.keyboard.press('i'); check(await waitFor(() => VR.Invent.isOpen(), null, 3000), 'I opens the workshop');
  const f0 = await invCount('furnace');
  check(await makeBy('feuer', 'stein'), 'Feuer + Stein');
  await wait(450);
  let r = await rv();
  console.log('  reveal', JSON.stringify(r));
  check(r.name === 'Ofen' && r.pillKind === 'codex' && /Codex/.test(r.pill || ''), 'Survival: the pill says the Codex remembers it — no „Neu im Inventar"');
  check((await invCount('furnace')) === f0 && f0 === 0, 'no free furnace in the inventory');
  check(r.craftCells === 8 && /stellst du es her/.test(r.craftNote || ''), 'the crafting recipe is shown in pictures: 8 stones round the middle (' + r.craftCells + ' cells)');
  await shot('invent_survival');
  await closeReveal();
  await page.keyboard.press('Escape'); await wait(300);
  // the codex
  await ev(() => VR.game.ui.showCodex()); await wait(300);
  const cx = await ev(() => ({ cats: [...document.querySelectorAll('#codexgrid .codexcat')].map(c => c.textContent.replace(/\s+/g, ' ').trim()), items: [...document.querySelectorAll('#codexgrid .codexitem:not(.locked) b')].map(b => b.textContent.trim()) }));
  console.log('  codex cats', JSON.stringify(cx.cats));
  check(cx.cats.some(c => /^💡 Erfindungen \d+\/\d+$/.test(c)), 'the codex has a „💡 Erfindungen" group');
  check(cx.items.includes('Ofen'), 'the Ofen is listed there (found)');
  await ev(() => VR.game.ui.resume());
  // the pause menu has the button in Survival too
  await ev(() => VR.game.ui.pause()); await wait(200);
  check(await ev(() => !!document.querySelector('#pause [data-act="invent"]') && document.querySelector('#pause [data-act="invent"]').getClientRects().length > 0), 'the pause menu has 💡 Erfinden in Survival too');
  await ev(() => VR.game.ui.resume());
});

// ================================================================ 8
await section(8, 'a phone-sized screen, 44 px targets', async () => {
  if (!(await ev(() => VR.game.state === 'play'))) { if (!(await enterWorld('creative'))) return; }
  await ev(() => { const u = VR.game.ui; if (u.screen) u.resume(); });
  // enough cards to fill the tray
  for (let i = 0; i < 6; i++) { const t = await ev(() => VR.Inventions.tip()); if (!t) break; await ev((t) => VR.Inventions.combine(t.a, t.b), t); }
  await page.setViewportSize({ width: 360, height: 640 }); await wait(500);
  await page.keyboard.press('i'); check(await waitFor(() => VR.Invent.isOpen(), null, 3000), 'I opens the workshop at 360 x 640');
  await wait(600);
  await tap('feuer'); await wait(100);   // (one card on the bench for the picture)
  const lay = await ev(() => {
    const vw = innerWidth, vh = innerHeight, R = (s) => { const n = document.querySelector(s); if (!n) return null; const b = n.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height), b: Math.round(b.bottom), r: Math.round(b.right) }; };
    const small = [...document.querySelectorAll('#invent .erf-under button, #invent .erf-under .erf-slot')].filter(b => b.getClientRects().length).map(b => ({ n: (b.className + ' ' + b.textContent.trim()).replace(/\s+/g, ' ').slice(0, 36), w: b.getBoundingClientRect().width, h: b.getBoundingClientRect().height })).filter(b => b.w < 44 || b.h < 44);
    const cards = [...document.querySelectorAll('#erf-tray .erf-card')].map(c => c.getBoundingClientRect());
    const cols = new Set(cards.map(c => Math.round(c.left))).size;
    return { vw, vh, sw: document.documentElement.scrollWidth, invW: document.getElementById('invent').scrollWidth, bench: R('#erf-bench'), tools: R('.erf-tools'), tray: R('#erf-tray'), head: R('.erf-head'), eq: R('.erf-eq'), small, cols, firstCard: cards[0] && { w: Math.round(cards[0].width), h: Math.round(cards[0].height) } };
  });
  console.log('  layout', JSON.stringify(lay));
  check(lay.sw <= lay.vw && lay.invW <= lay.vw + 1, 'no sideways scrolling');
  check(lay.small.length === 0, 'every button, slot and card is at least 44 x 44 px (small: ' + JSON.stringify(lay.small) + ')');
  check(!!lay.bench && lay.bench.b <= lay.vh && !!lay.tools && lay.tools.b <= lay.vh + 2 && lay.bench.r <= lay.vw && lay.bench.x >= 0, 'the workbench and the tool row fit on the screen without scrolling');
  check(lay.cols >= 3 && !!lay.tray && lay.tray.b <= lay.vh + 1, 'the tray shows ' + lay.cols + ' cards across and ends at the bottom of the screen');
  await wait(200);
  await shot('invent_3');
  await page.click('#invent .erf-slot[data-slot="0"]'); await wait(100);
  // a full round on the phone: two taps → reveal fits the screen
  await tap('holz'); await tap('stein');
  check(await revealUp(), 'two taps make an invention on the phone too');
  await wait(450);
  const rl = await ev(() => { const b = document.querySelector('#erf-layer .erf-rv').getBoundingClientRect(), g = document.querySelector('#erf-layer .erf-go').getBoundingClientRect(); return { rvH: Math.round(b.height), goB: Math.round(g.bottom), goH: Math.round(g.height), vh: innerHeight, goW: Math.round(g.width) }; });
  console.log('  reveal (phone)', JSON.stringify(rl));
  check(rl.goB <= rl.vh && rl.goH >= 44, '„Weiter" is on the screen and big enough');
  await shot('invent_3_reveal');
  await closeReveal();
  await page.keyboard.press('Escape'); await wait(300);
  await page.setViewportSize({ width: 1280, height: 720 }); await wait(300);
});

// ================================================================ 9
await section(9, 'English', async () => {
  if (!(await ev(() => VR.game.state === 'play'))) { if (!(await enterWorld('creative'))) return; }
  await ev(() => { const u = VR.game.ui; if (u.screen) u.resume(); });
  await ev(() => VR.I18N.set('en')); await wait(300);
  await page.keyboard.press('i'); check(await waitFor(() => VR.Invent.isOpen(), null, 3000), 'I opens the workshop');
  const s = await ev(() => ({ title: document.getElementById('erf-title').textContent.trim(), count: document.getElementById('erf-count').textContent.trim(), tools: [...document.querySelectorAll('.erf-tools .erf-btn')].map(b => b.textContent.trim()), cards: [...document.querySelectorAll('#erf-tray .erf-card')].slice(0, 6).map(c => c.textContent.trim()), msg: document.getElementById('erf-msg').textContent.trim(), lang: document.documentElement.lang }));
  console.log('  english', JSON.stringify(s));
  check(s.title === '💡 Invent' && / invented$/.test(s.count) && s.tools.includes('💡 Hint') && s.tools.includes('📖 Book'), 'the screen speaks English: „💡 Invent", „n / 167 invented", 💡 Hint, 📖 Book');
  check(s.cards.join() === 'Wood,Stone,Fire,Water,Earth,Air', 'the start cards: Wood · Stone · Fire · Water · Earth · Air');
  // live switch back to German while it is open
  await ev(() => VR.I18N.set('de')); await wait(300);
  const s2 = await ev(() => ({ title: document.getElementById('erf-title').textContent.trim(), cards: [...document.querySelectorAll('#erf-tray .erf-card')].slice(0, 2).map(c => c.textContent.trim()) }));
  check(s2.title === '💡 Erfinden' && s2.cards.join() === 'Holz,Stein', 'switching the language while it is open retexts it at once');
  await page.keyboard.press('Escape'); await wait(300);
});

await done();
