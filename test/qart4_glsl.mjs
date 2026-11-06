// q-art4 (src/main/qart4.js): the far land's programs with Runde Inseln (Q_ISLEFORM) and the terrain's with the round
// crowns' softer top (Q_RTOP) compile and link (SwiftShader) in the game's own presets; Very Low carries neither.
// A shader check: no world, a few seconds.   usage: bash test/wt_run.sh qart4_glsl.mjs 600
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
  const real = await page.evaluate(() => {
    const g = VR.game, r = g.renderer, gl = r.gl, errs = [];
    const ce = console.error; console.error = (...a) => { errs.push(String(a[0]).slice(0, 900)); ce.apply(console, a); };
    const GL = VR.GL, d0 = GL.deferred; GL.deferred = false;
    const fsrc = (P) => { let src = ''; try { for (const s of gl.getAttachedShaders(P.p)) if (gl.getShaderParameter(s, gl.SHADER_TYPE) === gl.FRAGMENT_SHADER) src = gl.getShaderSource(s); } catch (e) { src = 'ERR'; } return src; };
    const out = {};
    for (const pr of ['balanced', 'high', 'potato', 'low']) {
      g.applyPreset(pr); g.applySettings('*'); r.buildPrograms();
      const o = { hz: !!(g.horizon && g.horizon.isleForm), lm: String(g.leafMode()) };
      const ps = { lod: r.P.lod, opaque: r.P.opaque, cutout: r.P.cutout };
      if (pr === 'high' || pr === 'balanced') { ps.form = r.farProgram('form'); ps.lodFar = r.farProgram('lodFar'); }
      for (const k in ps) { const P = ps[k]; if (!P) { o[k] = 'NULL'; continue; } const ok = gl.getProgramParameter(P.p, gl.LINK_STATUS); const s = fsrc(P); o[k] = (ok ? '' : 'NOLINK ') + ['Q_ISLEFORM', 'Q_RTOP'].filter(d => s.includes('#define ' + d)).join(' '); }
      out[pr] = o;
    }
    g.applyPreset('balanced'); g.applySettings('*');
    GL.deferred = d0; console.error = ce;
    return { out, errs };
  });
  console.log('     ' + JSON.stringify(real).slice(0, 1500));
  const O = real.out;
  for (const pr of ['balanced', 'high']) {
    check(/Q_ISLEFORM/.test(O[pr].lod) && /Q_ISLEFORM/.test(O[pr].form) && /Q_ISLEFORM/.test(O[pr].lodFar) && !/NOLINK|NULL/.test(O[pr].lod + O[pr].form + O[pr].lodFar), pr + ': the far programs carry Runde Inseln and link');
    check(/Q_RTOP/.test(O[pr].opaque) && /Q_RTOP/.test(O[pr].cutout) && !/NOLINK/.test(O[pr].opaque + O[pr].cutout), pr + ': the terrain programs carry the softer crown top and link');
    check(O[pr].hz && (+O[pr].lm & 16) && (+O[pr].lm & 32), pr + ': the horizon asks for the forms, the leaf mode has bits 16 and 32 (' + O[pr].lm + ')');
  }
  for (const pr of ['potato', 'low']) check(!O[pr].lod && !O[pr].opaque && !O[pr].cutout && !O[pr].hz && !/16/.test(O[pr].lm), pr + ': none of it (no define, no job flag, leaf mode ' + O[pr].lm + ')');
  check(!real.errs.length, 'no shader error' + (real.errs.length ? ': ' + real.errs[0] : ''));
} catch (e) { fails++; console.log('  ✗ ' + e.message); }
check(errs.length === 0, 'no page error' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
