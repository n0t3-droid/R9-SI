// The Einfach pause menu in German (i18n2): at 1280×720 and 1366×768 no text of the pause menu wraps — every text node
// of #pause sits on one line (its client rects share one top) — and the pause panel fits the screen. Two screenshots
// (test/shots/pause_einfach_<w>x<h>.png) show it for the eye. The UI is Einfach (r9si.ui.pro off), the locale de-DE.
// usage: nohup bash test/wt_run.sh pause_fit.mjs 1800 > .tmp_tests/pause_fit.log 2>&1 &  — ALL OK or FAILED n
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { if (m.type() === 'error') logs.push('[error] ' + m.text().slice(0, 300)); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 900)));
page.on('dialog', d => d.accept('Test'));
const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
await page.goto('file:///home/claude/vr/dist/index.html');
for (let i = 0; i < 180; i++) { await wait(500); if (await ev(() => !!(window.VR && VR.game && VR.game.state === 'title'))) break; }
check(await ev(() => VR.game.state === 'title'), 'the start screen is up');
await ev(() => { VR.UIPrefs.set({ pro: false }); const g = VR.game; g.settings.renderDist = 4; g.settings.dynRes = false; g.applySettings('renderDist'); });
check(await ev(() => document.documentElement.lang === 'de' && !document.documentElement.classList.contains('pro')), 'German page, Einfach (no Profi class)');
await ev(`VR.game.createWorld({name:'Pausenmenü',mode:'creative',difficulty:'peaceful',type:'default',seed:'4242',cheats:true,kit:true})`);
for (let i = 0; i < 120; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
check(await ev(() => VR.game.state) === 'play', 'the world is playing');
await ev(() => VR.game.ui.pause());
await wait(400);

// every text node of the pause menu: its client rects must share one top (one line), the panel must sit in the viewport
const measure = () => ev(() => {
  const root = document.getElementById('pause');
  if (!root || !root.getClientRects().length) return { open: false };
  const wrapped = [], texts = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const s = n.textContent.replace(/\s+/g, ' ').trim();
    if (!s || !n.parentElement || !n.parentElement.getClientRects().length) continue;
    const rg = document.createRange(); rg.selectNodeContents(n);
    const tops = new Set([...rg.getClientRects()].filter(r => r.width > 0 && r.height > 0).map(r => Math.round(r.top)));
    texts.push(s);
    if (tops.size > 1) wrapped.push(s + ' (' + tops.size + ' lines)');
  }
  const pr = root.querySelector('.panel, .box, .pausebox') || root.firstElementChild;
  const b = pr ? pr.getBoundingClientRect() : { left: 0, top: 0, right: 0, bottom: 0 };
  const inside = b.left >= 0 && b.top >= 0 && b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1;
  return { open: true, texts: texts.length, wrapped, inside, box: [Math.round(b.left), Math.round(b.top), Math.round(b.right), Math.round(b.bottom)], vw: innerWidth, vh: innerHeight, labels: texts.slice(0, 12) };
});
for (const [w, h] of [[1280, 720], [1366, 768]]) {
  console.log(w + '×' + h);
  await page.setViewportSize({ width: w, height: h });
  await wait(500);
  await ev(() => VR.game.ui.pause && VR.game.ui.pause());   // (a pause that is already open stays open)
  await wait(300);
  const m = await measure();
  console.log('  labels ' + JSON.stringify(m.labels));
  check(m.open, 'the pause menu is open at ' + w + '×' + h);
  check(m.texts >= 4, 'the pause menu has its texts (' + m.texts + ')');
  check(!m.wrapped.length, 'no pause text wraps at ' + w + '×' + h + (m.wrapped.length ? ': ' + m.wrapped.join(' · ') : ''));
  check(m.inside, 'the pause panel sits inside the ' + w + '×' + h + ' screen (' + m.box.join(',') + ')');
  await page.screenshot({ path: `/home/claude/vr/test/shots/pause_einfach_${w}x${h}.png`, timeout: 180000 }).catch(() => {});
}
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 10)) console.log(l);
check(!logs.some(l => l.startsWith('[pageerror]')), 'no page errors');
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
