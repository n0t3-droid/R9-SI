// q-art2 (src/main/qart2.js): the terrain and shadow programs with Wiese, Schwebeinseln and Fernkronen compile and link
// (SwiftShader) in the variants the presets use, and the game's own High and Balanced programs carry their defines with
// the isle uniforms found. A shader check: no world, a few seconds.
// usage: bash test/wt_run.sh qart2_glsl.mjs 600
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
    const GL = VR.GL, S = VR.SHADERS, QA = VR.QArt, Q2 = VR.QArt2, out = [];
    const d0 = GL.deferred; GL.deferred = false;
    const ce = console.error, el = []; console.error = (...a) => { el.push(String(a[0]).slice(0, 600)); };
    QA.use(QA.defaults('high'), true);
    for (const pr of ['balanced', 'high']) {
      Q2.use(Q2.defaults(pr), { fancy: true, leaf: true, preset: pr });
      const base = [['terrain', ['FADE']], ['terrain', ['FADE', 'SHADOWS', 'LIGHT2', 'L2AO', 'PBR', 'TEXHI', 'MOTION', 'SEASON', 'LV_MEADOW']], ['terrainCut', ['CUTOUT', 'FADE']], ['terrainCut', ['CUTOUT', 'FADE', 'SHADOWS', 'LIGHT2', 'L2AO', 'PBR', 'ZINV', 'MOTION']], ['terrainCutZ', ['CUTOUT', 'FADE', 'ZINV', 'ZPRE', 'SOFTFADE']], ['terrain', ['FADE', 'MODEL']]];
      for (const [n, d] of base) { let ok = false, info = ''; try { const p = GL.program(S.TERRAIN_VS, S.TERRAIN_FS, n, d); ok = !!p && (n === 'terrainCutZ' || d.includes('MODEL') || !!p.u.u_qIsleA === (n !== 'terrainCutZ')); info = ok ? '' : 'no u_qIsleA'; } catch (e) { info = String(e.message || e).slice(0, 500); } out.push([pr + ' ' + n + ' ' + d.join(','), ok, info || el.slice(-1)[0] || '']); }
      for (const d of [['CUTOUT'], ['CUTOUT', 'MULTIDRAW']]) { let ok = false, info = ''; try { const p = GL.program(S.SHADOW_VS, S.SHADOW_FS, 'shadowCut', d); ok = !!p && !!p.u.u_qCamI && !!p.u.u_qCamF; info = ok ? '' : 'no u_qCamI'; } catch (e) { info = String(e.message || e).slice(0, 500); } out.push([pr + ' shadowCut ' + d.join(','), ok, info]); }
    }
    Q2.use(Q2.off()); QA.use(QA.off(), true); GL.deferred = d0; console.error = ce;
    return out;
  });
  for (const r of res) check(r[1], 'compiles and links: ' + r[0] + (r[1] ? '' : ' — ' + r[2]));
  const real = await page.evaluate(() => {
    const g = VR.game, r = g.renderer, gl = r.gl, errs = [];
    const ce = console.error; console.error = (...a) => { errs.push(String(a[0]).slice(0, 900)); ce.apply(console, a); };
    const out = {};
    for (const pr of ['balanced', 'high', 'potato']) {
      g.applyPreset(pr); g.applySettings('*');
      const o = {};
      for (const k of ['opaque', 'cutout', 'shadowCut']) {
        const P = r.P[k]; let src = '';
        try { for (const s of gl.getAttachedShaders(P.p)) if (gl.getShaderParameter(s, gl.SHADER_TYPE) === gl.FRAGMENT_SHADER) src = gl.getShaderSource(s); } catch (e) { src = 'ERR ' + e.message; }
        o[k] = ['Q_GRASS', 'Q_TUFT_N', 'Q_ISLE', 'Q_CROWN'].filter(d => src.includes('#define ' + d)).join(' ');
      }
      out[pr] = o;
    }
    console.error = ce;
    return { out, errs };
  });
  console.log('     ' + JSON.stringify(real).slice(0, 1500));
  const O = real.out;
  check(/Q_GRASS/.test(O.high.opaque) && /Q_ISLE/.test(O.high.opaque) && /Q_ISLE/.test(O.high.cutout) && /Q_CROWN/.test(O.high.cutout) && /Q_CROWN/.test(O.high.shadowCut), 'the game\'s own High programs carry Wiese, Schwebeinseln, Fernkronen');
  check(/Q_GRASS/.test(O.balanced.opaque) && /Q_CROWN/.test(O.balanced.shadowCut), 'and Balanced\'s');
  check(!O.potato.opaque && !O.potato.cutout && !O.potato.shadowCut, 'Very Low: none of them');
  check(!real.errs.length, 'no shader error' + (real.errs.length ? ': ' + real.errs[0] : ''));
} catch (e) { fails++; console.log('  ✗ ' + e.message); }
check(errs.length === 0, 'no page error' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
