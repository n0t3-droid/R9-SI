// Studio start-up upgrades designs saved by older Studios (v1: changed cells) to v2 templates — same house.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
require('./load_shared.js');
const VR = globalThis.VR, VG = VR.VillageGen, PLAN = VG.plan2, R = VR.R, C = VR.Custom;
// a v1 design of house 2 (as an older Studio saved it): a wall painted coral, a hole in the roof, a lamp in the yard
const cat = PLAN.CATALOGUE[2], F = 8, pad = 2, ops = [];
const L = VG.makeLot((x, y, z, s) => ops.push(x, y, z, s), pad, pad, 0);
PLAN.build(L, { w: cat.lot[0], d: cat.lot[1], F, r: 0, ox: pad, oz: pad, kind: 'home' }, { rng: new VR.RNG(7), ground: () => F - 1, beds: 3, mirror: false, skin: 'grey', noCustom: true });
const cur = new Map(); for (let k = 0; k < ops.length; k += 4) cur.set(ops[k] + ',' + ops[k + 1] + ',' + ops[k + 2], ops[k + 3]);
const cells = [], pal = [null];
const pi = (s) => { if (!s) return 0; const p = JSON.stringify(C.portable(s)); let k = pal.findIndex((e, i) => i && JSON.stringify(e) === p); if (k < 0) { k = pal.length; pal.push(C.portable(s)); } return k; };
for (let y = F + 1; y < F + 4; y++) for (let v = 2; v < 7; v++) cells.push([0 + 4, y - F, v, pi(R.byName.vollton_coral.defaultState)]);
cells.push([8, 12, 8, 0], [9, 12, 8, 0], [3, 1, cat.lot[1] - 3, pi(R.byName.lantern.defaultState)]);
const v1 = { houses: { 2: { v: 1, name: 'Villa R9 140', index: 2, seed: 7, beds: 3, skin: 'grey', mirror: false, cells, pal, top: 12, t: 12345 } }, models: {} };
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const logs = []; page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 900))); page.on('console', m => { if (m.type() === 'error') logs.push(m.text().slice(0, 300)); });
await page.goto('file:///home/claude/vr/dist/studio.html');
await page.evaluate((d) => localStorage.setItem('r9si.studio', JSON.stringify(d)), v1);
await page.reload();
let res = null;
for (let i = 0; i < 120; i++) { await page.waitForTimeout(500); res = await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('r9si.studio') || '{}'); const h = d.houses && d.houses[2]; return h ? { v: h.v, n: h.n, box: h.tpl && h.tpl.box, t: h.t, cells: !!h.cells } : null; }); if (res && res.v === 2) break; }
console.log('v1 cells', cells.length, '→ after start-up', JSON.stringify(res), res && res.v === 2 && res.n === cells.length ? 'OK' : 'CHECK');
console.log('sys:', await page.evaluate(() => document.getElementById('sysText').textContent));
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 8)) console.log(l);
await browser.close();
