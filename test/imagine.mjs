// v0.35 🖼 Bild → 3D and files: a picture (red disk + blue square on white) → a Blockbild (background gone, red and blue
// blocks), two round views → a carved shape about the size it should be, the preview photographed; a .schem made in the
// page opens as a Werkbank piece; the piece goes out as .schem / .vox / .json downloads.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--allow-file-access-from-files'] });
const ctx = await browser.newContext({ viewport: { width: 1360, height: 860 }, acceptDownloads: true });
const page = await ctx.newPage();
const logs = [];
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 900)));
page.on('console', m => { if (m.type() === 'error') logs.push('[console] ' + m.text().slice(0, 300)); });
page.on('dialog', d => d.accept('Kugel'));
await page.goto('file:///home/claude/vr/dist/studio.html');
const ev = (fn, a) => page.evaluate(fn, a), wait = (ms) => page.waitForTimeout(ms);
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
for (let i = 0; i < 240; i++) { await wait(500); if (await ev(() => !document.getElementById('studio').classList.contains('boot') && window.__studio && window.__studio.HOUSE.size >= 1 && VR.BlockColors && VR.BlockColors.ready())) break; }
const bc = await ev(() => ({ n: VR.BlockColors.list('all').length, wool: VR.BlockColors.list('wool').length, red: VR.R.types[VR.R.T.type[VR.BlockColors.nearest(220, 30, 30, 'wool')]].name, blue: VR.R.types[VR.R.T.type[VR.BlockColors.nearest(30, 60, 220, 'wool')]].name }));
console.log('  colours', JSON.stringify(bc));
check(bc.n > 150 && bc.wool >= 30 && /red/.test(bc.red) && /blue/.test(bc.blue), 'block colours from the textures (red → ' + bc.red + ', blue → ' + bc.blue + ')');
await ev(() => window.__studioCore.setMode('world'));
// 1. a Blockbild
const flat = await ev(async () => {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64; const x = cv.getContext('2d');
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, 128, 64); x.fillStyle = '#dd2222'; x.beginPath(); x.arc(32, 32, 24, 0, Math.PI * 2); x.fill(); x.fillStyle = '#2244dd'; x.fillRect(72, 12, 40, 40);
  const blob = await new Promise(r => cv.toBlob(r)); const IM = VR.StudioWorld.imagine;
  IM.mode = 'flat'; Object.assign(IM.flat, { width: 40, set: 'wool', bg: true, dither: false, relief: 0 });
  IM.open(null); await IM.take(blob, 'flat');
  for (let i = 0; i < 40 && !(IM.result && IM.result.n); i++) await new Promise(r => setTimeout(r, 200));
  const g = IM.result; if (!g) return null;
  const names = {}; let keep = 0; for (const s of g.blocks) { if (s === 0xffff) { keep++; continue; } const n = VR.R.types[VR.R.T.type[s]].name; names[n] = (names[n] || 0) + 1; }
  return { size: [g.sx, g.sy, g.sz], n: g.n, keep, names };
});
console.log('  flat', JSON.stringify(flat));
check(flat && flat.size[0] === 40 && flat.size[2] === 1 && flat.keep > 100 && Object.keys(flat.names).some(n => /red/.test(n)) && Object.keys(flat.names).some(n => /blue/.test(n)), 'a picture became a wall of red and blue wool, the white background is gone');
await wait(1500);
await page.screenshot({ path: '/home/claude/vr/test/shots/im_1_flat.png', timeout: 180000 });
// 2. 3D from two round views (front and side): an intersection of two cylinders
const solid = await ev(async () => {
  const disk = async (col) => { const cv = document.createElement('canvas'); cv.width = 200; cv.height = 200; const x = cv.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, 200, 200); x.fillStyle = col; x.beginPath(); x.arc(100, 100, 80, 0, Math.PI * 2); x.fill(); return new Promise(r => cv.toBlob(r)); };
  const IM = VR.StudioWorld.imagine;
  IM.mode = 'solid'; Object.assign(IM.solid, { height: 24, set: 'wool', hollow: false, front: null, side: null, top: null });
  IM.open(null); await IM.take(await disk('#22aa44'), 'front'); await IM.take(await disk('#e0c020'), 'side');
  for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 200)); if (IM.result && IM.result.n && IM.result.sz > 10) break; }
  const g = IM.result; const names = {}; for (const s of g.blocks) { if (s === 0xffff) continue; const n = VR.R.types[VR.R.T.type[s]].name; names[n] = (names[n] || 0) + 1; }
  return { size: [g.sx, g.sy, g.sz], n: g.n, names };
});
console.log('  solid', JSON.stringify(solid));
const r = 12, steinmetz = 16 / 3 * r * r * r;
check(solid && solid.size[1] === 24 && Math.abs(solid.n - steinmetz) / steinmetz < 0.2, 'two round views carve the shape of two crossed cylinders (' + (solid && solid.n) + ' ≈ ' + Math.round(steinmetz) + ' blocks)');
check(solid && Object.keys(solid.names).some(n => /green|lime/.test(n)) && Object.keys(solid.names).some(n => /yellow/.test(n)), 'painted with the colours of the views (green front, yellow side)');
await wait(2000);
const prevPx = await ev(() => { const c = document.getElementById('imPrev'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let lit = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 120) lit++; return lit; });
check(prevPx > 3000, 'the preview shows the shape (' + prevPx + ' lit pixels)');
await page.screenshot({ path: '/home/claude/vr/test/shots/im_2_solid.png', timeout: 180000 });
// into the Werkbank's hand
// no world is open here: the dialog keeps the result as a Bauteil or saves it as a file instead of "In die Werkbank"
const inHand = await ev(async () => { const noOk = !document.getElementById('imOk'), exp = document.querySelectorAll('[data-exp]').length; document.getElementById('imLib').click(); await new Promise(r => setTimeout(r, 300)); const WB = VR.StudioWorld.wb, lib = JSON.parse(localStorage.getItem('r9si.library') || '{"items":[]}'); return { noOk, exp, clip: WB.clip ? [WB.clip.sx, WB.clip.sy, WB.clip.sz] : null, lib: lib.items && lib.items[0] && lib.items[0].name }; });
console.log('  hand', JSON.stringify(inHand));
check(inHand.noOk && inHand.exp === 3 && inHand.clip && inHand.lib === 'Kugel', 'without a world: ★ Als Bauteil keeps the shape (and ⬇ .schem .vox .json are offered)');
await ev(() => VR.StudioWorld.imagine.close());
// 3. a .schem opened from a file
const imp = await ev(async () => {
  const R = VR.R, g = { sx: 3, sy: 2, sz: 1, blocks: new Uint16Array(6) }; g.blocks[0] = R.byName.oak_planks.defaultState; g.blocks[4] = R.byName.oak_stairs.with(R.byName.oak_stairs.defaultState, 'facing', 1);
  const bytes = await VR.Schem.writeSchem(g, 'T'); const f = new File([bytes], 'haus.schem');
  await VR.StudioWorld.wb.importFile(f);
  const c = VR.StudioWorld.wb.clip; return { size: [c.sx, c.sy, c.sz], name: c.name, b0: R.types[R.T.type[c.blocks[0]]].name, b4: R.types[R.T.type[c.blocks[4]]].name + R.types[R.T.type[c.blocks[4]]].get(c.blocks[4], 'facing') };
});
console.log('  import', JSON.stringify(imp));
check(imp.size.join() === '3,2,1' && imp.b0 === 'oak_planks' && imp.b4 === 'oak_stairs1' && imp.name === 'haus', 'a .schem file opens as the piece in hand');
// 4. downloads
const got = [];
page.on('download', d => got.push(d.suggestedFilename()));
for (const k of ['schem', 'vox', 'json']) { await ev((k) => VR.StudioWorld.wb.exportClip(k), k); await wait(800); }
await wait(1000);
console.log('  downloads', JSON.stringify(got));
check(got.includes('haus.schem') && got.includes('haus.vox') && got.includes('haus.json'), 'the piece goes out as .schem, .vox and .json');
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 8)) console.log(l);
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
await browser.close();
process.exit(fails ? 1 : 0);
