// render all grocery item icons on a sheet (hotbar slot renderer) and check every catalogue product resolves
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || /error|fail|missing/i.test(s)) logs.push(`[${t}] ${s.slice(0, 900)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file:///home/claude/vr/dist/index.html');
await page.waitForTimeout(6000);
const r = await page.evaluate(() => {
  const g = VR.game, G = VR.GROCERIES, SHOP = VR.SHOP;
  const bad = [];
  for (const k in SHOP.CATS) for (const [id] of SHOP.CATS[k].products) if (!VR.itemDef(id)) bad.push(k + ':' + id);
  const ids = G.IDS.slice();
  const wrap = document.createElement('div'); wrap.style.cssText = 'position:fixed;inset:0;background:#1a2030;z-index:999;display:flex;flex-wrap:wrap;align-content:flex-start;padding:8px;gap:4px;font:11px sans-serif;color:#fff';
  for (const id of ids) {
    const d = document.createElement('div'); d.style.cssText = 'width:96px;text-align:center';
    const c = document.createElement('canvas'); c.width = 64; c.height = 64; c.style.cssText = 'width:64px;height:64px;image-rendering:pixelated;background:#2a3040';
    try { g.icons.paint(c, id, 64); } catch (e) { d.textContent = 'ERR ' + id + ' ' + e.message; }
    d.appendChild(c); const t = document.createElement('div'); t.textContent = id; d.appendChild(t);
    wrap.appendChild(d);
  }
  document.body.appendChild(wrap);
  return { n: ids.length, bad, iconsApi: typeof g.icons };
});
console.log(JSON.stringify(r));
let fails = 0; const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
check(r.bad.length === 0, 'every catalogue product resolves to an item (unresolved: ' + (r.bad.join(', ') || 'none') + ')');
await page.waitForTimeout(1500);
await page.screenshot({ path: '/home/claude/vr/test/shots/grocery_icons.png' });
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 20)) console.log(l);
check(!logs.some(l => /pageerror\]/.test(l)), 'no page errors');
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
