// regress: skip — f-quiet's before | after probe (plan docs/superpowers/plans/2026-10-31-f-quiet.md): five minutes of play
// (2.5 min in a builder world, 2.5 min in an Abenteuer world; a fresh browser, the first minutes of new worlds), the same
// script before and after: walk, stand and look round, a block placed, V asked once. Twice a second every visible text
// on the screen outside the HUD's own chrome (the hotbar, the meters, the minimap, the badge) is counted:
//   · visible-text seconds (one element showing text for one second = 1) — after ≤ 30 % of before (a drop ≥ 70 %)
//   · the centre of the screen (x 30–70 %, y 30–62 %) free of text in ≥ 98 % of the samples (after)
//   · no standing „[V] Funke fragen" (after: never)
//   · the audit: each element's seconds and its first texts (test/shots/quiet_probe.json)
// Pictures test/shots/quiet_{before,after}_{b,a}{1,2,3}.png and the sheet test/shots/quiet_sheet.jpg.
// German UI, 1280 × 720, Balanced. env BEFORE: a dist folder's index.html (the base build; none: after only)
//   nohup bash test/wt_run.sh quiet_probe.mjs 3600 > .tmp_tests/quiet_probe.log 2>&1 &
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import { execFileSync } from 'child_process';
const ROOT = new URL('../', import.meta.url).pathname;
const SHOTS = ROOT + 'test/shots/';
fs.mkdirSync(SHOTS, { recursive: true });
let fails = 0; const check = (ok, m) => { console.log((ok ? '  ok   ' : '  FAIL ') + m); if (!ok) fails++; };
const OUT = {};
const PLAY = +(process.env.PLAY_S || 150) * 1000;
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
// the sampler (in the page): every visible element with its own text, outside the chrome and the menus
const SAMPLE = () => {
  const W = innerWidth, H = innerHeight, out = [];
  const CHROME = '#hotbar, #stats, #xpbar, #xplvl, #minimap, #compass, #modebadge, #fps, #debug, #itemname, #advhud, #petchip, #vehiclehud, .screen, #touch, #wcompass, #bauhud, #lockhint, #crosshair, #bhBtn, #mirrorchip';
  const WIDGET = '#f2point, #intentbar, #rpgfind';   // (way pointers: counted apart as widgets, not as messages)
  const all = document.querySelectorAll('#app *, body > div *, body > div');
  const seen = new Set();
  for (const e of all) {
    let own = ''; for (const n of e.childNodes) if (n.nodeType === 3) own += n.nodeValue;
    own = own.trim(); if (!own || own.length < 2) continue;
    if (e.closest(CHROME)) continue;
    const wid = !!e.closest(WIDGET);
    const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || r.right < 0 || r.bottom < 0 || r.left > W || r.top > H) continue;
    let vis = true; for (let a = e; a && a !== document.body; a = a.parentElement) { const cs = getComputedStyle(a); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.15) { vis = false; break; } }
    if (!vis) continue;
    // the message element: the nearest ancestor with an id
    let m = e; while (m && !m.id && m.parentElement) m = m.parentElement;
    const key = m && m.id ? '#' + m.id : e.tagName;
    if (seen.has(key)) { const o = out.find(x => x.k === key); if (o) { o.cx = o.cx || (r.right > W * 0.3 && r.left < W * 0.7 && r.bottom > H * 0.3 && r.top < H * 0.62); } continue; }
    seen.add(key);
    out.push({ w: wid, k: key, t: (m.textContent || own).trim().replace(/\s+/g, ' ').slice(0, 70), cx: r.right > W * 0.3 && r.left < W * 0.7 && r.bottom > H * 0.3 && r.top < H * 0.62 });
  }
  return { items: out, play: !!(window.VR && VR.game && VR.game.state === 'play' && !VR.game.ui.screen && !VR.game.arrival) };
};
async function run(tag, url) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('r9si.settings')) localStorage.setItem('r9si.settings', JSON.stringify({ preset: 'balanced', dynRes: false })); localStorage.setItem('r9si.lang', 'de'); } catch (e) { /* */ } });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 200)));
  const wait = (ms) => page.waitForTimeout(ms), ev = (fn, a) => page.evaluate(fn, a);
  const until = async (fn, ms) => { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(fn).catch(() => false)) return Date.now() - t; await wait(400); } return -1; };
  const shot = async (n) => { try { await page.screenshot({ path: SHOTS + 'quiet_' + tag + '_' + n + '.png', timeout: 120000 }); } catch (e) { console.log('  (no shot ' + n + ')'); } };
  const newWorld = async (way) => {
    await page.click('#title [data-act="newworld"]', { timeout: 15000 }).catch(() => ev(() => document.querySelector('#title [data-act="newworld"]').click()));
    await wait(1500);
    await ev(() => { const s = document.getElementById('cw_seed'); if (s) { s.value = '4242'; s.dispatchEvent(new Event('input')); } });
    if (way) await ev((w) => { const b = document.querySelector('#cw_way [data-v="' + w + '"]'); if (b) b.click(); }, way);
    await wait(400);
    await ev(() => document.querySelector('#create .btn.primary').click());
    return until(() => VR.game && VR.game.state === 'play', 300000);
  };
  const agg = OUT[tag] = { secs: 0, samples: 0, centre: 0, funkeAsk: 0, by: {}, worlds: [] };
  // play PLAY ms with the script, sampling twice a second
  // the arrival is skipped (Escape does it for a player): the probe measures play, not the arrival's frames
  const skipArrival = async () => { for (let i = 0; i < 40; i++) { const a = await ev(() => { const g = VR.game; if (g.arrival && g.arrival.skip) { try { g.arrival.skip(); } catch (e) { /* */ } } return !!g.arrival; }).catch(() => true); if (!a) return true; await wait(1500); } return false; };
  const play = async (w) => {
    agg.arrivalSkipped = (agg.arrivalSkipped || 0) + (await skipArrival() ? 1 : 0);
    const t0 = Date.now(); let last = t0, step = 0, asked = false, built = false, shotN = 0;
    const shotsAt = [20000, 62000, PLAY - 8000];
    while (Date.now() - t0 < PLAY) {
      const el = Date.now() - t0;
      // the script: 0–8 s stand, then cycles of walk 4 s · stand and look round 4 s; V at 55 s; a block at 90 s
      const ph = el < 8000 ? 'stand' : (Math.floor((el - 8000) / 4000) % 2 ? 'look' : 'walk');
      if (ph === 'walk') await page.keyboard.down('KeyW'); else await page.keyboard.up('KeyW');
      if (ph === 'look') await ev(() => { const p = VR.game.player; p.yaw += 0.18; }).catch(() => {});
      if (!asked && el > 55000) { asked = true; await page.keyboard.up('KeyW'); await page.keyboard.press('KeyV'); }
      if (!built && el > 90000) { built = true; await ev(() => { const g = VR.game; try { g.input.captured = true; } catch (e) { /* */ } }).catch(() => {}); await page.mouse.click(640, 360, { button: 'right' }).catch(() => {}); }
      if (shotN < shotsAt.length && el >= shotsAt[shotN]) { shotN++; await shot(w + shotN); }
      const s = await ev(SAMPLE).catch(() => null);
      const now = Date.now(), dt = (now - last) / 1000; last = now;
      if (s && s.play) {
        agg.samples++; let cx = false;
        for (const it of s.items) {
          if (it.w) { agg.widget = (agg.widget || 0) + dt; continue; }
          agg.secs += dt; agg.cnt = (agg.cnt || 0) + 1; const b = agg.by[it.k] = agg.by[it.k] || { s: 0, n: 0, texts: [] }; b.s += dt; b.n++;
          if (b.texts.length < 4 && !b.texts.includes(it.t)) b.texts.push(it.t);
          if (it.cx) cx = true;
          if (/Funke fragen/.test(it.t)) agg.funkeAsk++;
        }
        if (cx) agg.centre++;
      }
      step++;
      await wait(Math.max(0, 500 - (Date.now() - now)));
    }
    await page.keyboard.up('KeyW');
    return step;
  };
  await page.goto(url);
  await until(() => VR.game && VR.game.state === 'title', 240000); await wait(3000);
  check(await newWorld(null) >= 0, tag + ': the builder world');
  await play('b');
  agg.worlds.push({ w: 'builder', frame: await ev(() => VR.game.frame).catch(() => -1) });
  await ev(() => { VR.game.ui.show('pause'); }); await wait(500);
  await shot('pause');
  await ev(() => { const b = document.querySelector('#pause [data-act="quit"]'); if (b) b.click(); });
  await until(() => VR.game.state === 'title', 120000); await wait(3000);
  check(await newWorld('gentle') >= 0, tag + ': the Abenteuer world');
  await play('a');
  agg.worlds.push({ w: 'abenteuer', frame: await ev(() => VR.game.frame).catch(() => -1) });
  agg.quiet = await ev(() => VR.Quiet ? { cost: VR.Quiet.cost, stats: VR.Quiet.notes.stats, hist: VR.Quiet.notes.history.length, level: VR.game.settings.notices || null } : null).catch(() => null);
  agg.errors = errs.slice(0, 4);
  agg.secs = +agg.secs.toFixed(1);
  for (const k in agg.by) agg.by[k].s = +agg.by[k].s.toFixed(1);
  const top = Object.entries(agg.by).sort((a, b) => b[1].s - a[1].s).slice(0, 14).map(([k, b]) => k + ' ' + b.s + ' s: ' + b.texts.slice(0, 2).join(' | '));
  console.log('  ' + tag + ': text-seconds ' + agg.secs + ' · samples ' + agg.samples + ' · centre ' + agg.centre + ' · Funke fragen ' + agg.funkeAsk + ' · widgets ' + (agg.widget || 0).toFixed(1) + ' s' + ' · ' + JSON.stringify(agg.worlds) + (agg.quiet ? ' · quiet ' + JSON.stringify(agg.quiet) : ''));
  for (const l of top) console.log('     ' + l);
  await ctx.close();
}
if (process.env.BEFORE) await run('before', 'file://' + process.env.BEFORE);
await run('after', 'file://' + ROOT + 'dist/index.html');
fs.writeFileSync(SHOTS + 'quiet_probe.json', JSON.stringify(OUT, null, 1));
const A = OUT.after, B = OUT.before;
const free = A.samples ? 1 - A.centre / A.samples : 0;
check(A.samples > 60, 'after: ' + A.samples + ' samples in play');
check(free >= 0.98, 'after: the centre free of text in ' + (free * 100).toFixed(1) + ' % of the samples (≥ 98 %)');
check(A.funkeAsk === 0, 'after: no „Funke fragen" on the screen (' + A.funkeAsk + ' samples)');
check(!A.errors.length, 'after: no page errors ' + JSON.stringify(A.errors));
if (B) {
  // (the samples' spacing differs with the machine's load: the mean count of texts on the screen per sample × 300 s)
  const per = (X) => (X.cnt || 0) / Math.max(1, X.samples), drop = per(B) > 0 ? 1 - per(A) / per(B) : 0;
  console.log('  text-seconds over 5 min (mean texts per sample × 300 s): before ' + (per(B) * 300).toFixed(0) + ' · after ' + (per(A) * 300).toFixed(0));
  console.log('  before: ' + B.secs + ' text-s over ' + B.samples + ' samples, centre ' + (100 * B.centre / B.samples).toFixed(1) + ' % · after: ' + A.secs + ' over ' + A.samples + ', centre ' + (100 * A.centre / A.samples).toFixed(1) + ' %');
  check(drop >= 0.7, 'the visible-text seconds (per sample) drop ' + (drop * 100).toFixed(0) + ' % (≥ 70 %)');
  try {
    const rows = [['Bauwelt 20 s', 'b1'], ['Bauwelt 62 s (nach V)', 'b2'], ['Bauwelt 142 s', 'b3'], ['Abenteuer 20 s', 'a1'], ['Abenteuer 62 s (nach V)', 'a2'], ['Abenteuer 142 s', 'a3'], ['Pausenmenü', 'pause']]
      .map(([l, n]) => ({ label: 'vorher | nachher — ' + l, imgs: [SHOTS + 'quiet_before_' + n + '.png', SHOTS + 'quiet_after_' + n + '.png'] })).filter(r => r.imgs.every(p => fs.existsSync(p)));
    fs.writeFileSync(ROOT + '.tmp_tests/quiet_sheet.json', JSON.stringify({ w: 620, rows }));
    execFileSync('python3', ['/root/r9coord/pairs.py', SHOTS + 'quiet_sheet.jpg', ROOT + '.tmp_tests/quiet_sheet.json']);
    console.log('  sheet: test/shots/quiet_sheet.jpg');
  } catch (e) { console.log('  (no sheet: ' + String(e).slice(0, 120) + ')'); }
}
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
