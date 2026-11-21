// regress: skip — the start screen as a player meets it (the owner, 21 Nov: „stelle sicher, dass auch die Start-UI und UX
// alles super ist"): a fresh browser (no worlds), German, three sizes (a laptop 1280 × 720, a phone upright 390 × 844, a phone
// on its side 844 × 390); the title, Einstellungen, Andere Welt, Neue Welt, the language picker, Profi; then one world made
// and the title again (▶ Weiterspielen). Pictures → test/shots/start_<size>_<step>.png; a report of every visible
// control that overflows the screen, overlaps another, is smaller than 32 px to tap on a phone, or has no text/label;
// page errors. usage: bash test/wt_run.sh start_audit.mjs 900
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const ROOT = new URL('../', import.meta.url).pathname, SH = ROOT + 'test/shots/';
fs.mkdirSync(SH, { recursive: true });
const SIZES = (process.env.SIZES || 'desk:1280x720,phone:390x844,land:844x390').split(',').map(s => { const [n, d] = s.split(':'); const [w, h] = d.split('x').map(Number); return { n, w, h }; });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const report = [];
for (const S of SIZES) {
  const mobile = S.w < 900 && S.n !== 'desk';
  const ctx = await browser.newContext({ viewport: { width: S.w, height: S.h }, locale: 'de-DE', hasTouch: mobile, isMobile: mobile, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const logs = []; page.on('pageerror', e => logs.push(e.message)); page.on('console', m => { if (m.type() === 'error') logs.push(m.text().slice(0, 200)); });
  await page.goto('file://' + ROOT + 'dist/index.html');
  const ev = (f, a) => page.evaluate(f, a), wait = (ms) => page.waitForTimeout(ms);
  for (let i = 0; i < 240; i++) { await wait(500); if (await ev(() => !!(window.VR && VR.game && VR.game.state === 'title'))) break; }
  await wait(2500);
  // the visible controls and their problems
  const audit = (step) => ev(([step, mobile]) => {
    const W = innerWidth, H = innerHeight, out = [];
    const vis = (e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width > 1 && r.height > 1 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.05 && r.bottom > 0 && r.right > 0 && r.top < H && r.left < W; };
    const els = [...document.querySelectorAll('button, a, input, select, [role=button], .tile, .card')].filter(vis);
    const name = (e) => (e.getAttribute('aria-label') || e.title || e.textContent || e.value || e.placeholder || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    for (const e of els) {
      const r = e.getBoundingClientRect(), n = name(e);
      if (r.left < -1 || r.right > W + 1 || r.bottom > H + 1) out.push(`overflow: "${n}" [${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}]`);
      if (mobile && (r.width < 32 || r.height < 32) && e.tagName !== 'INPUT') out.push(`small: "${n}" ${Math.round(r.width)}×${Math.round(r.height)}`);
      if (!n && e.tagName !== 'INPUT') out.push(`no label: <${e.tagName.toLowerCase()} class="${e.className}">`);
    }
    // overlaps between controls not nested in one another
    for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
      const a = els[i], b = els[j]; if (a.contains(b) || b.contains(a)) continue;
      const p = a.getBoundingClientRect(), q = b.getBoundingClientRect();
      const ox = Math.min(p.right, q.right) - Math.max(p.left, q.left), oy = Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top);
      if (ox > 4 && oy > 4) out.push(`overlap: "${name(a)}" × "${name(b)}" (${Math.round(ox)}×${Math.round(oy)})`);
    }
    // text cut off (an element whose content is wider than it, with hidden overflow)
    for (const e of [...document.querySelectorAll('#ui *')].filter(vis)) { const cs = getComputedStyle(e); if ((cs.overflow === 'hidden' || cs.textOverflow === 'ellipsis') && e.scrollWidth > e.clientWidth + 2 && e.children.length === 0 && e.textContent.trim().length > 2) out.push(`cut text: "${e.textContent.trim().slice(0, 40)}"`); }
    return { step, n: els.length, issues: [...new Set(out)].slice(0, 30), texts: els.map(name).filter(Boolean).slice(0, 40) };
  }, [step, mobile]);
  const shot = async (step) => { await wait(700); await page.screenshot({ path: SH + `start_${S.n}_${step}.png` }); const a = await audit(step); report.push(Object.assign({ size: S.n }, a)); console.log(`${S.n} · ${step}: ${a.n} controls, ${a.issues.length} issues${a.issues.length ? '\n    ' + a.issues.join('\n    ') : ''}`); };
  const click = async (sel) => { try { await page.click(sel, { timeout: 3000 }); return true; } catch (e) { return false; } };
  const clickText = async (re) => ev((src) => { const re = new RegExp(src, 'i'); const e = [...document.querySelectorAll('button, a, [role=button], .tile')].find(x => re.test(x.textContent) && x.getBoundingClientRect().width > 0); if (e) { e.click(); return true; } return false; }, re.source);
  const back = async () => { await page.keyboard.press('Escape'); await wait(500); };
  await shot('title');
  if (await clickText(/Einstellungen/)) { await shot('settings'); await back(); }
  await ev(() => { if (VR.game && VR.game.ui && VR.game.ui.show) VR.game.ui.show('title'); });
  if (await clickText(/Andere Welt/)) { await shot('worlds'); }
  if (await clickText(/Neue Welt/)) { await shot('create'); }
  await back(); await ev(() => { if (VR.game && VR.game.ui && VR.game.ui.show) VR.game.ui.show('title'); });
  if (await clickText(/Erschaffen/)) { await shot('erschaffen'); await back(); await ev(() => { if (VR.game.ui.show) VR.game.ui.show('title'); }); }
  if (await clickText(/Meins/)) { await shot('meins'); await back(); await ev(() => { if (VR.game.ui.show) VR.game.ui.show('title'); }); }
  if (await clickText(/^\s*Profi|Einfach/)) { await shot('profi'); await clickText(/Einfach|Profi/); }
  // the first world, then the title again
  if (await clickText(/Losspielen|Weiterspielen/)) {
    for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game.state === 'play')) break; }
    await wait(5000); await shot('first_play');
    await ev(() => { const g = VR.game; if (g.quitToTitle) g.quitToTitle(); else if (g.exitWorld) g.exitWorld(); });
    for (let i = 0; i < 60; i++) { await wait(500); if (await ev(() => VR.game.state === 'title')) break; }
    await wait(1500); await shot('title_again');
  }
  report.push({ size: S.n, errors: logs.slice(0, 5) });
  if (logs.length) console.log(`${S.n} · page errors: ${logs.slice(0, 3).join(' | ')}`);
  await ctx.close();
}
fs.writeFileSync(SH + 'start_audit.json', JSON.stringify(report, null, 1));
await browser.close();
console.log('done');
