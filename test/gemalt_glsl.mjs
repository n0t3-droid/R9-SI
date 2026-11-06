// r-gemalt (src/main/gemalt.js, shaders.js GEMALT): the terrain program with Weiche Natur's paint compiles and links
// (SwiftShader) in the variants Balanced and High use, alone and with every other terrain define; and the define hook adds
// GEMALT to 'terrain' only with the switch on and never on the lite look. A shader check: no world, a few seconds.
// usage: bash test/wt_run.sh gemalt_glsl.mjs 600
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
const ROOT = new URL('../', import.meta.url).pathname.replace(/\/$/, '').replace(/\/\.tmp_tests$/, '');
const DIST = process.env.DIST || 'file://' + ROOT + '/dist/index.html';
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 }, locale: 'de-DE' });
const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 300)));
try {
  await page.goto(DIST);
  for (let i = 0; i < 160; i++) { await page.waitForTimeout(500); if (await page.evaluate(() => typeof VR !== 'undefined' && !!VR.game && VR.game.state === 'title')) break; }
  const res = await page.evaluate(() => {
    const GL = VR.GL, S = VR.SHADERS, out = [];
    const d0 = GL.deferred; GL.deferred = false;
    const ce = console.error, el = []; console.error = (...a) => { el.push(String(a[0]).slice(0, 900)); };
    const base = [['FADE', 'GEMALT'], ['FADE', 'SHADOWS', 'LIGHT2', 'L2AO', 'PBR', 'TEXHI', 'MOTION', 'SEASON', 'LV_MEADOW', 'Q_GRASS', 'Q_TUFT_N 6', 'GEMALT'], ['FADE', 'MULTIDRAW', 'SHADOWS', 'LIGHT2', 'GEMALT'], ['FADE', 'MODEL', 'GEMALT']];
    for (const d of base) { let ok = false, info = ''; try { const p = GL.program(S.TERRAIN_VS, S.TERRAIN_FS, 'terrain', d); ok = !!p; } catch (e) { info = String(e.message || e).slice(0, 900); } out.push(['terrain ' + d.join(','), ok, info || el.slice(-1)[0] || '']); }
    GL.deferred = d0; console.error = ce;
    const G = VR.Gemalt, h = VR.GL.defineHook, g = VR.game, s0 = Object.assign({}, g.settings);
    g.settings.gSoft = true; g.settings.lite = false; g.settings.preset = 'balanced';
    const onB = h('terrain', ['FADE']).includes('GEMALT'), cut = h('terrainCut', ['CUTOUT']).includes('GEMALT');
    g.settings.gSoft = true; g.settings.lite = true; g.settings.preset = 'potato';
    const onVL = h('terrain', ['FADE']).includes('GEMALT');
    g.settings.gSoft = false; g.settings.lite = false; g.settings.preset = 'high';
    const off = h('terrain', ['FADE']).includes('GEMALT');
    Object.assign(g.settings, s0);
    out.push(['the hook: Balanced terrain GEMALT, the cut-out layer and Very Low and the switch off none', onB && !cut && !onVL && !off && !!G, [onB, cut, onVL, off].join(',')]);
    return out;
  });
  for (const r of res) check(r[1], r[0] + (r[1] ? '' : ' — ' + r[2]));
} catch (e) { fails++; console.log('  ✗ ' + (e.stack || e.message).slice(0, 800)); }
check(errs.length === 0, 'no page error' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
