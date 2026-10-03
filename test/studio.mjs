import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
const logs = [];
page.on('console', m => { if (m.type() === 'error' || /error/i.test(m.text())) logs.push(m.text().slice(0, 300)); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 600)));
await page.goto('file:///home/claude/vr/dist/studio.html');
await page.waitForTimeout(1500);
const YAWV = +(process.env.YAW || 3.9); const names = (process.env.MODELS || 'vm_sofa_charcoal,vm_bed_grey,vm_kitchen_white_sink,vm_bathtub,vm_dining_table,vm_arc_lamp').split(',');
for (const n of names) {
  await page.evaluate((n) => { location.hash = n; const el = document.querySelector(`#list .item[data-name="${n}"]`); if (el) el.click(); }, n);
  await page.evaluate((yaw) => { if (window.__st) { window.__st.autorot = false; window.__st.yaw = yaw; window.__st.pitch = 0.38; } }, YAWV);
  await page.waitForTimeout(600);
  const stats = await page.evaluate(() => document.querySelector('#stats').textContent);
  console.log(n, '→', stats);
  await page.screenshot({ path: `/home/claude/vr/test/shots/studio_${n}.png` });
}
console.log('logs', logs.length, logs.slice(0, 5));
await browser.close();
