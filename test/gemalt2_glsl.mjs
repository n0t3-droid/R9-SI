// r-gemalt 2 · Gemaltes Licht: the GLSL variants compile (terrain with GM_PAINT / GM_STROKE, the far tiles with GM_PAINT,
// the water with GM_WATER, the brush-stroke grass' own program), the hook adds the defines on Balanced only, and in a
// Kreativ world on Balanced the grass clumps are drawn and nothing throws. Harness from test/gemalt_glsl.mjs.
// usage: bash test/wt_run.sh gemalt2_glsl.mjs
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
const ROOT = new URL('../', import.meta.url).pathname.replace(/\/$/, '').replace(/\/\.tmp_tests$/, '');
const DIST = process.env.DIST || 'file://' + ROOT + '/dist/index.html';
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 }, locale: 'de-DE' });
const errs = []; page.on('pageerror', e => errs.push(String(e.message).slice(0, 300)));
page.on('console', m => { if (m.type() === 'error') errs.push('[console] ' + m.text().slice(0, 400)); });
try {
  await page.goto(DIST);
  for (let i = 0; i < 160; i++) { await page.waitForTimeout(500); if (await page.evaluate(() => typeof VR !== 'undefined' && !!VR.game && VR.game.state === 'title')) break; }
  const res = await page.evaluate(() => {
    const GL = VR.GL, S = VR.SHADERS, out = [];
    const d0 = GL.deferred; GL.deferred = false; const h0 = GL.defineHook; GL.defineHook = null;
    const ce = console.error, el = []; console.error = (...a) => { el.push(String(a[0]).slice(0, 900)); };
    const tryP = (lab, vs, fs, name, d) => { let ok = false, info = ''; try { ok = !!GL.program(vs, fs, name, d); } catch (e) { info = String(e.message || e).slice(0, 900); } out.push([lab + ' ' + d.join(','), ok, info || el.slice(-1)[0] || '']); };
    for (const d of [['FADE', 'GM_PAINT'], ['FADE', 'GEMALT', 'GM_PAINT', 'GM_STROKE'], ['FADE', 'SHADOWS', 'LIGHT2', 'L2AO', 'PBR', 'TEXHI', 'MOTION', 'SEASON', 'LV_MEADOW', 'Q_GRASS', 'Q_TUFT_N 6', 'GEMALT', 'GM_PAINT', 'GM_STROKE'], ['FADE', 'GEMALT', 'GM_STROKE'], ['FADE', 'MODEL', 'GEMALT', 'GM_PAINT']]) tryP('terrain', S.TERRAIN_VS, S.TERRAIN_FS, 'terrain', d);
    for (const d of [['GM_PAINT'], ['SOFTFADE', 'GEMALT', 'LIGHT2', 'GM_PAINT'], ['FAR1', 'SOFTFADE', 'GEMALT', 'GM_PAINT'], ['FORM', 'SOFTFADE', 'GM_PAINT']]) tryP('far tiles', S.LOD_VS, S.LOD_FS, 'lod', d);
    for (const d of [['FADE', 'GM_WATER'], ['FADE', 'SHADOWS', 'LIGHT2', 'PBR', 'GM_WATER']]) tryP('water', S.TERRAIN_VS, S.TRANS_FS, 'trans', d);
    GL.deferred = d0; GL.defineHook = h0; console.error = ce;
    const h = GL.defineHook, g = VR.game, s0 = Object.assign({}, g.settings);
    Object.assign(g.settings, { gPaint: true, gTuft: true, gWater: true, lite: false, preset: 'balanced' });
    const onB = h('terrain', ['FADE']).includes('GM_PAINT') && h('terrain', ['FADE']).includes('GM_STROKE') && h('lod', []).includes('GM_PAINT') && h('trans', ['FADE']).includes('GM_WATER');
    Object.assign(g.settings, { lite: true, preset: 'potato' }); const vl = h('terrain', ['FADE']).concat(h('trans', [])).some(x => x.startsWith('GM_'));
    Object.assign(g.settings, { lite: false, preset: 'low' }); const lo = h('terrain', ['FADE']).concat(h('trans', [])).some(x => x.startsWith('GM_'));
    Object.assign(g.settings, s0);
    out.push(['the hook: Balanced all three; Very Low and Low none', onB && !vl && !lo, [onB, vl, lo].join(',')]);
    return out;
  });
  for (const r of res) check(r[1], r[0] + (r[1] ? '' : ' — ' + r[2]));
  // in a world: Balanced, the clumps drawn, the tuft program compiled, frames without errors
  await page.evaluate(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = false; g.applySettings('*'); });
  await page.evaluate(`VR.game.createWorld({name:'G2',mode:'creative',difficulty:'peaceful',type:'default',seed:'4242',cheats:true,kit:true})`);
  for (let i = 0; i < 240; i++) { await page.waitForTimeout(500); if (await page.evaluate(() => VR.game.state === 'play' && VR.game.player && !VR.game.player.hold)) break; }
  await page.waitForTimeout(15000);
  const w = await page.evaluate(() => { const g = VR.game, r = g.renderer, wd = g.world, p = g.player.pos, TB = VR.SoftNat.tables(); let grass = 0; for (let dx = -12; dx <= 12; dx++) for (let dz = -12; dz <= 12; dz++) { const x = Math.floor(p[0]) + dx, z = Math.floor(p[2]) + dz, t = wd.topAt(x, z); if (TB.mat[wd.getBlock(x, t, z)] === 1 && wd.getBlock(x, t + 1, z) === 0) grass++; }
    if (!(r.gmT && r.gmT.n)) { g.player.teleport(-73.5, 110, 178.5); }
    return { grass, pos: [p[0] | 0, p[1] | 0, p[2] | 0], st: g.state, gPaint: g.settings.gPaint, gTuft: g.settings.gTuft, tuft: r.gmT ? { n: r.gmT.n, prog: !!r.gmT.prog } : null, key: r.gm2Key }; });
  console.log('     ' + JSON.stringify(w));
  if (!(w.tuft && w.tuft.n)) { await page.waitForTimeout(15000); w.tuft = await page.evaluate(() => { const r = VR.game.renderer; return r.gmT ? { n: r.gmT.n, prog: !!r.gmT.prog } : null; }); }
  console.log('     ' + JSON.stringify(w));
  check(w.st === 'play' && w.gPaint && w.gTuft && w.key === '111', 'Balanced world: all three on');
  check(w.tuft && w.tuft.prog, 'the grass clumps\' program compiled');
  if (w.grass > 20) check(w.tuft.n > 50, 'the grass clumps are drawn (' + w.tuft.n + ' clumps)'); else console.log('     (no open grass round the spawn: the clumps are proven in gemalt2_ingame.mjs\'s lawn)');
} catch (e) { fails++; console.log('  ✗ ' + (e.stack || e.message).slice(0, 800)); }
check(errs.length === 0, 'no page error' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
