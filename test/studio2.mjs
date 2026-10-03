// Model Studio v2: boot, textures, every catalogue house built, the furniture catalogue, deep links — with screenshots
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 860 } });
const logs = [];
page.on('console', m => { if (m.type() === 'error' || /error/i.test(m.text())) logs.push(m.text().slice(0, 400)); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 800)));
await page.goto('file:///home/claude/vr/dist/studio.html' + (process.env.HASH || ''));
const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
const t0 = Date.now();
for (let i = 0; i < 240; i++) { await wait(500); const s = await ev(() => ({ boot: document.getElementById('studio').classList.contains('boot'), houses: window.__studio ? window.__studio.HOUSE.size : -1, sys: document.getElementById('sysText').textContent })); if (!s.boot && s.houses >= 11) break; if (i % 10 === 0) console.log('  t+' + ((Date.now() - t0) / 1000).toFixed(0) + 's', JSON.stringify(s)); }
console.log('ready after', ((Date.now() - t0) / 1000).toFixed(1), 's', await ev(() => document.getElementById('sysText').textContent));
await wait(800);
await page.screenshot({ path: '/home/claude/vr/test/shots/st2_1_arch.png' });
console.log('arch', await ev(() => document.getElementById('hudMeta').textContent));
// a classic villa with the first floor cut open
await ev(() => window.__studio.selectHouse(3)); await wait(600);
await ev(() => { const b = [...document.querySelectorAll('#houseTools button')].find(x => x.textContent.includes('Erdgeschoss')); if (b) b.click(); window.__st.cam.pitch = 0.9; });
await wait(600); await page.screenshot({ path: '/home/claude/vr/test/shots/st2_2_belportale_cut.png' });
console.log('belportale', await ev(() => document.getElementById('hudMeta').textContent));
console.log('parts headings', await ev(() => [...document.querySelectorAll('#partsBody .ph')].map(x => x.textContent).join(' | ')));
// click the first furniture part → model view with breadcrumb
await ev(() => { const p = document.querySelector('#partsBody .part'); if (p) p.click(); }); await wait(900);
await page.screenshot({ path: '/home/claude/vr/test/shots/st2_3_model_from_house.png' });
console.log('model', await ev(() => document.getElementById('hudName').textContent + ' · ' + document.getElementById('hudMeta').textContent), 'crumb:', await ev(() => (document.querySelector('#crumb button') || {}).textContent));
// the furniture catalogue with chips + search
await ev(() => window.__studio.setMode('furn')); await wait(1500);
await page.screenshot({ path: '/home/claude/vr/test/shots/st2_4_furniture.png' });
await ev(() => { const s = document.getElementById('search'); s.value = 'kitchen'; s.dispatchEvent(new Event('input')); }); await wait(1200);
await page.screenshot({ path: '/home/claude/vr/test/shots/st2_5_search.png' });
console.log('search kitchen cards', await ev(() => document.querySelectorAll('#list .card').length));
await ev(() => { const s = document.getElementById('search'); s.value = ''; s.dispatchEvent(new Event('input')); window.__studio.setMode('facade'); }); await wait(1200);
await page.screenshot({ path: '/home/claude/vr/test/shots/st2_6_facade.png' });
// palais with the skin tools, complete
await ev(() => { window.__studio.setMode('arch'); window.__studio.selectHouse(7); }); await wait(700);
await page.screenshot({ path: '/home/claude/vr/test/shots/st2_7_palais.png' });
console.log('palais', await ev(() => document.getElementById('hudMeta').textContent));
console.log('logs', logs.length); for (const l of logs.slice(0, 10)) console.log(l);
await browser.close();
