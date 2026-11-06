// q-art (src/main/qart.js): the terrain programs with Laubkronen and Platzbelag compile and link (SwiftShader), in the
// variants the presets use — the opaque terrain, the cut-out layer and its depth pass, with and without the light's
// and the gloss's defines. A shader check: no world, a few seconds.
// usage: bash test/wt_run.sh qart_glsl.mjs 600
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
    const GL = VR.GL, S = VR.SHADERS, QA = VR.QArt, out = [];
    const d0 = GL.deferred; GL.deferred = false;
    QA.use(QA.defaults('high'), true);
    const base = [['terrain', ['FADE']], ['terrain', ['FADE', 'SHADOWS', 'LIGHT2', 'L2AO', 'PBR', 'TEXHI', 'MOTION', 'SEASON']], ['terrainCut', ['CUTOUT', 'FADE']], ['terrainCut', ['CUTOUT', 'FADE', 'SHADOWS', 'LIGHT2', 'L2AO', 'PBR', 'ZINV']], ['terrainCutZ', ['CUTOUT', 'FADE', 'ZINV', 'ZPRE', 'SOFTFADE']], ['terrain', ['FADE', 'MODEL']]];
    for (const [n, d] of base) { try { const p = GL.program(S.TERRAIN_VS, S.TERRAIN_FS, n, d); out.push([n + ' ' + d.join(','), !!p, (n === 'terrain' && !d.includes('MODEL')) ? !!p.u.u_noise : true]); } catch (e) { out.push([n + ' ' + d.join(','), false, String(e.message).slice(0, 600)]); } }
    QA.use(QA.off(), true); GL.deferred = d0;
    return { out, layers: QA.plazaLayers(), key: VR.game.renderer && VR.game.renderer.qaKey };
  });
  // the renderer's own programs at High with q-art on (the defines the game really passes)
  const real = await page.evaluate(() => {
    const g = VR.game, r = g.renderer, gl = r.gl, errs = [];
    const ce = console.error; console.error = (...a) => { errs.push(String(a[0]).slice(0, 900)); ce.apply(console, a); };
    g.applyPreset('high'); g.applySettings('*');
    const q = VR.QArt.defaults('high'); r.setQuality(q);
    const out = {};
    for (const k of ['opaque', 'cutout']) {
      const P = r.P[k]; let ok = true, src = '';
      try { const pp = P.p; const sh = gl.getAttachedShaders(pp); for (const s of sh) if (gl.getShaderParameter(s, gl.SHADER_TYPE) === gl.FRAGMENT_SHADER) src = gl.getShaderSource(s); void P.u; } catch (e) { ok = false; errs.push(String(e.message).slice(0, 900)); }
      out[k] = { ok, plaza: src.includes('#define Q_PLAZA\n'), leaf: src.includes('#define Q_LEAF\n'), defs: (src.match(/#define [A-Z_0-9]+/g) || []).map(d => d.slice(8)).join(' ').slice(0, 600) };
    }
    console.error = ce;
    return { out, errs, q: r.q.qPlaza };
  });
  console.log('     ' + JSON.stringify(real).slice(0, 2500));
  check(real.out.opaque.ok && real.out.opaque.plaza && real.out.cutout.ok && real.out.cutout.leaf && !real.errs.length, 'the game\'s own High programs with q-art on: built, Platzbelag in the terrain, Laubkronen in the cut-out');
  for (const r of res.out) check(r[1] && r[2] === true, 'compiles and links: ' + r[0] + (r[1] ? '' : ' — ' + r[2]));
  check(res.layers.length >= 4, 'the plaza floors\' layers found (' + res.layers.join(',') + ')');
} catch (e) { fails++; console.log('  ✗ ' + e.message); }
check(errs.length === 0, 'no page error' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
