// Zauberblick in the browser: V with nothing near opens the hologram — the head with the next wow, marks on the screen
// (villages, animals, the way), Funke's scan running; it closes after six seconds; no page errors.
// usage: bash test/wt_run.sh zauber.mjs 600
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const ROOT = new URL('../', import.meta.url).pathname;
fs.mkdirSync(ROOT + 'test/shots/', { recursive: true });
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 620 }, locale: 'de-DE' });
const logs = []; page.on('pageerror', e => logs.push(e.message)); page.on('console', m => { if (m.type() === 'error') logs.push(m.text().slice(0, 300)); });
await page.goto('file://' + ROOT + 'dist/index.html');
const ev = (f, a) => page.evaluate(f, a), wait = (ms) => page.waitForTimeout(ms);
for (let i = 0; i < 240; i++) { await wait(500); if (await ev(() => !!(window.VR && VR.game && VR.game.state === 'title'))) break; }
await ev(() => { const g = VR.game; g.applyPreset('low'); g.settings.renderDist = 5; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'ZB',mode:'creative',difficulty:'peaceful',type:'default',seed:'53',cheats:true})`);
for (let i = 0; i < 300; i++) { await wait(500); if (await ev(() => VR.game.state === 'play')) break; }
await wait(8000);
const r0 = await ev(() => { const g = VR.game, C = VR.Ctx; const c = C.gather(g); const res = C.resolve(c); return { row: res.row, id: res.id }; });
console.log('     V would: ' + JSON.stringify(r0));
await ev(() => VR.Zauber.open(VR.game));
await wait(1500);
const s1 = await ev(() => { const r = document.getElementById('zb'); if (!r) return null; const ms = [...r.querySelectorAll('.zbm')].filter(e => e.style.display !== 'none'); return { open: VR.Zauber.isOpen(), head: r.querySelector('.zbhead').textContent, marks: ms.map(e => e.textContent), op: getComputedStyle(r).opacity }; });
console.log('     ' + JSON.stringify(s1));
await page.screenshot({ path: ROOT + 'test/shots/zauber.png' });
check(s1 && s1.open && /Zauberblick/.test(s1.head) && /Wow|ruhig/.test(s1.head), 'the hologram is open with its head');
check(s1 && s1.marks.length >= 1, 'marks on the screen: ' + (s1 ? s1.marks.length : 0));
await wait(6500);
const s2 = await ev(() => ({ open: VR.Zauber.isOpen(), el: !!document.getElementById('zb') }));
check(!s2.open && !s2.el, 'closed after six seconds');
check(!logs.length, 'no page errors ' + logs.slice(0, 3).join(' | '));
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0);
