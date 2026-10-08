// F5 · Steuerung & Einstellungen (browser, de-DE): (a) the key screen rebinds forward from W to I — I walks the
// player, W no longer does, and the binding is saved; (b) a simulated gamepad (navigator.getGamepads) walks the player
// with the left stick; (c) every graphics option of the Bild group shows its cost badge, and a change shows the live
// preview; (d) the Automatik run measures for 3 s and records its decision (a step of the ladder, or 'none' when the
// software renderer draws no frame in under a second); (e) on a phone
// (390 × 844, touch) the touch layer shows its stick and five buttons, the page does not scroll sideways, the stick
// walks and the ⤒ button jumps. Screenshots go to test/shots/ (Bild, Tasten, Automatik, Telefon). No page errors.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const SHOTS = '/home/claude/vr/test/shots/';
const logs = [];
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const wait = (page, ms) => page.waitForTimeout(ms);
const ev = (page, fn, arg) => page.evaluate(fn, arg);

async function open(opts) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') logs.push('[error] ' + m.text().slice(0, 600)); });
  page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1200)));
  await page.goto('file:///home/claude/vr/dist/index.html');
  for (let i = 0; i < 120; i++) { await wait(page, 500); if (await ev(page, () => !!(VR.game && VR.game.state === 'title'))) break; }
  return { ctx, page };
}
async function playWorld(page, name, seed) {
  await ev(page, ([n, s]) => VR.game.createWorld({ name: n, mode: 'creative', difficulty: 'peaceful', type: 'default', seed: s, cheats: true, kit: true }), [name, seed]);
  for (let i = 0; i < 90; i++) { await wait(page, 1000); if (await ev(page, () => VR.game.state === 'play')) break; }
  await wait(page, 1500);
}
const pos = (page) => ev(page, () => ({ x: VR.game.player.pos[0], z: VR.game.player.pos[2], y: VR.game.player.pos[1] }));
const dist = (a, b) => Math.hypot(b.x - a.x, b.z - a.z);
async function walkUntil(page, ms, cond) { const t0 = Date.now(); while (Date.now() - t0 < ms) { await wait(page, 250); if (await cond()) return true; } return false; }

// ---------------------------------------------------------------- (a)–(d) on a desktop window
{
  const { ctx, page } = await open({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
  check(await ev(page, () => VR.game.state) === 'title', 'the start screen is up');
  const kidsText = await ev(page, () => { const b = document.querySelector('#title [data-act="kids"]'); return b ? b.textContent : null; });
  check(!!kidsText && /Kindersicher/.test(kidsText), 'the start screen has the 🧸 Kindersicher button (' + kidsText + ')');
  await playWorld(page, 'Steuerung', '777');
  check(await ev(page, () => VR.game.state) === 'play', 'a creative world is playing');
  // a light scene (Very Low at half the resolution): the software renderer here draws a frame in about two seconds at full size
  await ev(page, () => { VR.game.applyPreset('potato'); VR.game.settings.scale = 0.5; VR.game.applySettings('scale'); });
  await wait(page, 1500);

  // ---- (c) the Bild group: a cost badge on every graphics option, the preview after a change
  await ev(page, () => VR.game.ui.pause());
  await page.click('#pause [data-act="settings"]');
  await wait(page, 400);
  check(await ev(page, () => !!document.querySelector('#settabs button[data-tab="img"].on')), 'the settings open on the Bild group');
  const tabs = await ev(page, () => [...document.querySelectorAll('#settabs button')].map(b => b.textContent));
  check(tabs.length === 3 && tabs.some(t => t.includes('Bild')) && tabs.some(t => t.includes('Klang')) && tabs.some(t => t.includes('Spiel')), 'three groups: ' + tabs.join(' · '));
  const missing = await ev(page, () => VR.Settings.ITEMS.filter(x => x.g === 'img' && x.cost).map(x => x.key).filter(k => !document.querySelector('.setrow[data-key="' + k + '"] .cost')));
  const badges = await ev(page, () => document.querySelectorAll('#setbody .cost').length);
  check(missing.length === 0 && badges >= 18, 'every graphics option has its cost badge (' + badges + ' badges' + (missing.length ? ', missing ' + missing.join(',') : '') + ')');
  const rows = await ev(page, () => document.querySelectorAll('#setbody .setrow').length);
  const tips = await ev(page, () => [...document.querySelectorAll('#setbody .setrow .setip')].filter(e => e.textContent.trim().length > 10).length);
  check(rows >= 21 && tips === rows, 'every row has its one-line tip (' + tips + ' of ' + rows + ')');
  await ev(page, () => { document.querySelector('#settings .panel').scrollTop = 0; });
  // the shadow slider moves (a range input: the way a finger or a mouse changes it), then the preview is drawn two frames later
  await ev(page, () => { const r = document.querySelector('.setrow[data-key="shadows"] input[type=range]'); r.value = 2; r.dispatchEvent(new Event('input')); });
  let pvOn = -1;
  for (let i = 0; i < 40; i++) {
    await wait(page, 250);
    pvOn = await ev(page, () => { const c = document.querySelector('canvas.pv'); if (!c) return -1; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let s = 0; for (let k = 0; k < d.length; k += 4) s += d[k] + d[k + 1] + d[k + 2]; return s; });
    if (pvOn > 0) break;
  }
  check(pvOn > 0 && (await ev(page, () => VR.game.settings.shadows)) === 2, 'a graphics change draws the live preview (sum ' + pvOn + ')');
  await page.screenshot({ path: SHOTS + 'controls_bild.png' });

  // ---- (d) the Automatik run: 3 s of frames, then a step of the ladder is set
  await ev(page, () => { document.querySelector('#settings .panel').scrollTop = 0; });
  await page.click('#setbody button[data-act="bench"]');
  await wait(page, 300);
  check(await ev(page, () => !!VR.game.bench), 'the Automatik run is measuring');
  const during = await ev(page, () => { const b = document.getElementById('benchbox'); return b ? b.textContent : ''; });
  check(/Misst gerade/.test(during), 'the Automatik box says it is measuring: ' + during.slice(0, 80));
  for (let i = 0; i < 30; i++) { await wait(page, 200); if (await ev(page, () => !VR.game.bench)) break; }
  // the thumbnail is drawn two frames after the group is redrawn (a software renderer needs seconds per frame): wait for its picture
  for (let i = 0; i < 40; i++) {
    await wait(page, 250);
    const drawn = await ev(page, () => { const c = document.querySelector('canvas.pv'); if (!c) return 0; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let t = 0; for (let k = 0; k < d.length; k += 16) t += d[k] + d[k + 1] + d[k + 2]; return t; });
    if (drawn > 0) break;
  }
  const res = await ev(page, () => ({ r: VR.game.benchResult, p: VR.game.settings.preset, v: VR.game.settings.renderDist, ladder: VR.Bench.LADDER.some(x => x.p === VR.game.settings.preset && x.v === VR.game.settings.renderDist), box: (document.getElementById('benchbox') || {}).textContent || '' }));
  // a software renderer that needs more than a second per frame gives no usable frame time: the honest result is 'none' and
  // the settings stay as they were (the decision table itself is covered by test/bench_table.js)
  const measured = !!res.r && (res.r.n || 0) >= 1;
  const desc = res.r ? res.r.action + ', ' + (res.r.n || 0) + ' frames, ' + Math.round(res.r.measured || 0) + ' fps' : 'no result';
  check(!!res.r && (measured ? res.ladder && res.r.action !== 'none' : res.r.action === 'none'), 'Automatik decides from its frames: a step of the ladder, or none when it measured none (' + res.p + ', ' + res.v + ', ' + desc + ')');
  check(res.box.length > 10 && !/Misst gerade/.test(res.box), 'the Automatik box shows the result');
  await page.screenshot({ path: SHOTS + 'controls_automatik.png' });

  // ---- (a) the key screen: forward from W to I
  await ev(page, () => { document.querySelector('#settings .panel').scrollTop = 0; });
  await page.click('#settabs button[data-tab="play"]');
  await wait(page, 300);
  await page.click('#setbody button[data-act="keys"]');
  await wait(page, 300);
  check(await ev(page, () => !!document.querySelector('.keyrow[data-action="fwd"]')), 'the key screen lists the actions');
  const fwdBefore = await ev(page, () => VR.Binds.current.slots('fwd'));
  check(fwdBefore[0] === 'KeyW', 'forward starts on W (' + fwdBefore.join(',') + ')');
  await page.click('.keyrow[data-action="fwd"] .key[data-slot="0"]');
  await wait(page, 150);
  await page.keyboard.press('KeyI');
  await wait(page, 400);
  const fwdAfter = await ev(page, () => VR.Binds.current.slots('fwd'));
  check(fwdAfter[0] === 'KeyI', 'forward is now I (' + fwdAfter.join(',') + ')');
  const msg = await ev(page, () => { const m = document.querySelector('.keymsg'); return m ? m.textContent : ''; });
  check(/ist jetzt/.test(msg) && /Vorwärts/.test(msg), 'the key screen confirms it in German: ' + msg.trim());
  const saved = await ev(page, () => { try { return localStorage.getItem('r9si.controls') || ''; } catch (e) { return ''; } });
  check(saved.indexOf('KeyI') >= 0, 'the binding is saved (r9si.controls)');
  await page.screenshot({ path: SHOTS + 'controls_tasten.png' });
  await page.click('.keytop .btn');
  await wait(page, 300);
  await ev(page, () => VR.game.ui.resume());
  await wait(page, 800);

  // walk with I, then with W: only I moves the player (the walks wait for the frames they need)
  const p0 = await pos(page);
  await page.keyboard.down('KeyI');
  const wentI = await walkUntil(page, 25000, async () => dist(p0, await pos(page)) > 0.3);
  await page.keyboard.up('KeyI');
  const p1 = await pos(page);
  const dI = dist(p0, p1);
  check(wentI && dI > 0.3, 'holding I walks the player (' + dI.toFixed(2) + ' blocks)');
  await wait(page, 300);
  const p1b = await pos(page), f0 = await ev(page, () => VR.game.frame);
  await page.keyboard.down('KeyW');
  await walkUntil(page, 30000, async () => (await ev(page, () => VR.game.frame)) - f0 >= 3);
  const framesW = (await ev(page, () => VR.game.frame)) - f0;
  await page.keyboard.up('KeyW');
  const p2 = await pos(page);
  const dW = dist(p1b, p2);
  check(framesW >= 3 && dW < 0.3, 'holding W does not walk the player any more (' + dW.toFixed(2) + ' blocks in ' + framesW + ' frames)');

  // ---- (b) a gamepad: the left stick up walks the player forward
  await ev(page, () => {
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
    window.__pad = { index: 0, id: 'Simulated Standard Gamepad', mapping: 'standard', connected: true, axes: [0, -1, 0, 0], buttons };
    navigator.getGamepads = () => [window.__pad];
  });
  const g0 = await pos(page);
  const wentG = await walkUntil(page, 25000, async () => dist(g0, await pos(page)) > 0.3);
  const g1 = await pos(page);
  const dG = dist(g0, g1);
  check(wentG && dG > 0.3, 'the left stick walks the player with a gamepad (' + dG.toFixed(2) + ' blocks)');
  const padInfo = await ev(page, () => !!(VR.game.input.pad && VR.game.input.pad.connected));
  check(padInfo, 'the pad is read every frame');
  await ev(page, () => { window.__pad.axes = [0, 0, 0, 0]; navigator.getGamepads = () => []; });
  await wait(page, 300);
  await ctx.close();
}

// ---------------------------------------------------------------- (e) a phone with touch
{
  const { ctx, page } = await open({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: 'de-DE' });
  await playWorld(page, 'Telefon', '99');
  await wait(page, 800);
  const touch = await ev(page, () => {
    const t = document.getElementById('touch');
    const shown = !!t && getComputedStyle(t).display !== 'none';
    const btns = [...document.querySelectorAll('#touch .tb')].map(b => { const r = b.getBoundingClientRect(); return { id: b.dataset.b, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight }; });
    const st = document.getElementById('tStick');
    const sr = st ? st.getBoundingClientRect() : null;
    return { shown, btns, stick: sr ? { w: Math.round(sr.width), h: Math.round(sr.height), ok: sr.left >= 0 && sr.bottom <= window.innerHeight } : null, noScroll: document.documentElement.scrollWidth <= window.innerWidth, touchon: !!document.getElementById('ui') && document.getElementById('ui').classList.contains('touchon') };
  });
  check(touch.shown, 'the touch layer shows in the game on a touch screen');
  check(touch.btns.length === 5 && touch.btns.every(b => b.ok), 'five buttons, each at least 44 px and on screen: ' + touch.btns.map(b => b.id).join(','));
  check(touch.stick && touch.stick.ok && touch.stick.w === 150, 'the stick is 150 px and on screen');
  check(touch.noScroll, 'no sideways scrolling at 390 px');
  check(touch.touchon, 'the hotbar moves up above the touch buttons');
  // the stick: a drag up is forward (driven with pointer events, the way a finger sends them)
  await ev(page, () => {
    const s = document.getElementById('tStick'), r = s.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    s.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 9, clientX: cx, clientY: cy, bubbles: true, isPrimary: true }));
    s.dispatchEvent(new PointerEvent('pointermove', { pointerId: 9, clientX: cx, clientY: cy - 50, bubbles: true }));
  });
  await wait(page, 120);
  const fwd = await ev(page, () => VR.game.input.touchMove.fwd);
  check(fwd > 0.5, 'a drag up on the stick is forward (' + (fwd || 0).toFixed(2) + ')');
  await ev(page, () => { const s = document.getElementById('tStick'); s.dispatchEvent(new PointerEvent('pointerup', { pointerId: 9, clientX: 0, clientY: 0, bubbles: true })); });
  await wait(page, 120);
  check(await ev(page, () => VR.game.input.touchMove.fwd) === 0, 'letting go of the stick stops it');
  // the ⤒ button jumps (a real tap, through the touch screen): from the ground, and the player does not start to fly
  await walkUntil(page, 15000, () => ev(page, () => VR.game.player.onGround && !VR.game.player.flying));   // first on the ground (a new world may still be settling)
  const s0 = await ev(page, () => ({ y: VR.game.player.pos[1], fly: !!VR.game.player.flying }));
  const jb = await ev(page, () => { const r = document.querySelector('#touch .tb-jump').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  let top = s0.y, flew = s0.fly;
  await page.touchscreen.tap(jb.x, jb.y);
  for (let i = 0; i < 40 && top - s0.y <= 0.2; i++) {
    await wait(page, 100);
    const s = await ev(page, () => ({ y: VR.game.player.pos[1], fly: !!VR.game.player.flying }));
    top = Math.max(top, s.y); flew = flew || s.fly;
  }
  check(top - s0.y > 0.2 && !flew, 'the ⤒ button makes the player jump, and does not fly (' + (top - s0.y).toFixed(2) + ' blocks, flying ' + flew + ')');
  await wait(page, 600);
  await page.screenshot({ path: SHOTS + 'controls_telefon.png' });
  await ctx.close();
}

const errs = logs.filter(l => l.startsWith('[pageerror]') || /TypeError|ReferenceError|SyntaxError|is not a function/.test(l));
check(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ').slice(0, 600) : ''));
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
