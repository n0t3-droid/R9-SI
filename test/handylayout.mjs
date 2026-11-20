// Handy-Layout: four phones (iPhone SE upright and sideways, iPhone 13 sideways, a tall Android) in play — no two
// controls overlap (buttons, hotbar, stick, hints, 🖐, ☰), nothing sits off the screen. Pictures test/shots/ph_*.png.
// usage: nohup bash test/wt_run.sh handylayout.mjs 1500 > .tmp_tests/handylayout.log 2>&1 &
import { chromium, devices } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
const ROOT = new URL('../', import.meta.url).pathname, OUT = ROOT + 'test/shots/';
import fs from 'fs'; fs.mkdirSync(OUT, { recursive: true });
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const list = [['se_p', devices['iPhone SE']], ['se_l', devices['iPhone SE landscape']], ['p13_l', devices['iPhone 13 landscape']], ['a_p', devices['Galaxy S9+']]];
for (const [name, dev] of list) {
  const ctx = await browser.newContext({ ...dev, deviceScaleFactor: 1, locale: 'de-DE' });
  const page = await ctx.newPage(); const logs = []; page.on('pageerror', e => logs.push(e.message));
  await page.goto('file://' + ROOT + 'dist/index.html');
  const ev = (f, a) => page.evaluate(f, a), wait = (ms) => page.waitForTimeout(ms);
  for (let i = 0; i < 240; i++) { await wait(500); if (await ev(() => !!(window.VR && VR.game && VR.game.state === 'title'))) break; }
  await page.screenshot({ path: OUT + 'ph_' + name + '_title.png' });
  await ev(() => { const g = VR.game; g.applyPreset('potato'); g.applySettings('*'); });
  await ev(`VR.game.createWorld({name:'H',mode:'survival',difficulty:'normal',type:'default',seed:'7',cheats:true})`);
  for (let i = 0; i < 300; i++) { await wait(500); if (await ev(() => VR.game.state === 'play')) break; }
  await wait(5000);
  await page.screenshot({ path: OUT + 'ph_' + name + '_play.png' });
  // overlap audit: visible interactive elements in #ui whose rects intersect
  const ov = await ev(() => {
    const els = [...document.querySelectorAll('#ui button, #ui .tb, #hotbar, #tMenu, .hint, #hints > *, #chat, #bh-btn, .bh-btn, #touch .tstick')].filter(e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 4 && r.height > 4 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05; });
    const out = []; const id = (e) => (e.id ? '#' + e.id : '') + '.' + [...e.classList].slice(0, 2).join('.') + (e.textContent || '').trim().slice(0, 12);
    for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) { if (els[i].contains(els[j]) || els[j].contains(els[i])) continue; const a = els[i].getBoundingClientRect(), b = els[j].getBoundingClientRect(); const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); if (w > 4 && h > 4) out.push(id(els[i]) + ' × ' + id(els[j]) + ' ' + Math.round(w) + 'x' + Math.round(h)); }
    const off = els.filter(e => { const r = e.getBoundingClientRect(); return r.left < -2 || r.top < -2 || r.right > innerWidth + 2 || r.bottom > innerHeight + 2; }).map(id);
    return { n: els.length, out: out.slice(0, 12), off };
  });
  const tag = name + ' ' + dev.viewport.width + '×' + dev.viewport.height;
  check(!ov.out.length, tag + ': no two controls overlap ' + ov.out.join(' | '));
  check(!ov.off.length && !logs.length, tag + ': nothing off screen, no page errors ' + ov.off.join(',') + logs.slice(0, 1).join(''));
  await ctx.close();
}
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0);
