// v0.35 ✨ Erschaffen in the standalone Studio (its own artifact, no game worlds there): the top bar's ✨ opens the
// dialog in any mode without breaking the mode; with no world the result is kept as a Bauteil (with its height offset)
// or saved as .json / .schem through the artifact's downloads; the world mode offers the same three buttons.
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const src = fs.readFileSync('/home/claude/vr/test/house_genie.mjs', 'utf8');
const MOCK = src.match(/const MOCK = `([\s\S]*?)`;/)[1];
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1360, height: 860 } });
const logs = [];
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 600)));
page.on('dialog', d => d.accept('Mein Haus'));
await page.addInitScript(MOCK);
await page.goto('file:///home/claude/vr/dist/studio_artifact.html', { waitUntil: 'domcontentloaded' });
let fails = 0; const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const ev = (fn, a) => page.evaluate(fn, a);
for (let i = 0; i < 240; i++) { await page.waitForTimeout(500); if (await ev(() => window.__studio && !document.getElementById('studio').classList.contains('boot') && VR.BlockColors && VR.BlockColors.ready() && VR.StudioWorld && VR.StudioWorld.imagine && VR.StudioWorld.imagine.aiOK)) break; }
const r1 = await ev(async () => {
  const C = window.__studioCore, IM = VR.StudioWorld.imagine, out = {};
  out.mode0 = C.S.mode;
  const b = document.querySelector('nav.modes [data-create]'); out.btn = !!b;
  b.click(); await new Promise(r => setTimeout(r, 300));
  out.open = document.getElementById('imagine').classList.contains('on'); out.dlgMode = IM.mode; out.mode1 = C.S.mode;
  document.querySelector('.imModes [data-mode="house"]').click();
  for (let i = 0; i < 40 && !(IM.result && IM.result.n); i++) await new Promise(r => setTimeout(r, 150));
  out.noOk = !document.getElementById('imOk'); out.exp = [...document.querySelectorAll('[data-exp]')].map(x => x.dataset.exp).join(',');
  out.n = IM.result && IM.result.n;
  return out;
});
console.log('  open', JSON.stringify(r1));
check(r1.btn && r1.open && r1.dlgMode === 'genie' && r1.mode1 === r1.mode0, '✨ Erschaffen in the top bar opens the dialog (Genie first) and leaves the mode alone');
check(r1.noOk && r1.exp === 'schem,vox,json' && r1.n > 300, 'no world: no "In die Werkbank", but ⬇ .schem .vox .json; the house is built');
const r2 = await ev(async () => {
  const out = {};
  document.getElementById('imLib').click(); await new Promise(r => setTimeout(r, 300));
  const lib = JSON.parse(localStorage.getItem('r9si.library') || '{"items":[]}'); const it = lib.items && lib.items[0];
  out.lib = it ? { name: it.name, dy: it.dy, sx: it.sx } : null;
  document.querySelector('[data-exp="json"]').click(); await new Promise(r => setTimeout(r, 500));
  document.querySelector('[data-exp="schem"]').click(); await new Promise(r => setTimeout(r, 800));
  out.saved = window.__genie.saved || [];
  // the JSON comes back with its height offset
  const j = VR.Schem.toJSON(VR.StudioWorld.wb.clip, 'x'); out.back = VR.Schem.fromJSON(JSON.parse(JSON.stringify(j))).dy;
  return out;
});
console.log('  keep', JSON.stringify(r2));
check(r2.lib && r2.lib.name === 'Mein Haus' && r2.lib.dy === r2.back && r2.lib.dy < 0, '★ Als Bauteil keeps the house under its name, with its height offset (' + (r2.lib && r2.lib.dy) + ')');
check(r2.saved.length === 2 && r2.saved.every(x => x.plain && x.u8 && x.n > 100) && /\.json$/.test(r2.saved[0].filename) && /\.zip$/.test(r2.saved[1].filename), '⬇ .json and ⬇ .schem (in a .zip) go out through the artifact\'s downloads');
const r3 = await ev(async () => { VR.StudioWorld.imagine.close(); window.__studioCore.setMode('world'); await new Promise(r => setTimeout(r, 600)); return { make: [...document.querySelectorAll('.wbMake button span')].map(s => s.textContent), mode: window.__studioCore.S.mode }; });
console.log('  world', JSON.stringify(r3));
check(r3.make.join() === 'Haus,Genie,Bild → 3D', 'the world mode without a world offers 🏠 ✨ 🖼 too');
await page.screenshot({ path: '/home/claude/vr/test/shots/create_standalone.png' });
console.log('--- logs (' + logs.length + ')'); for (const l of logs) console.log(l);
check(!logs.length, 'no page errors');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
await browser.close();
process.exit(fails ? 1 : 0);
