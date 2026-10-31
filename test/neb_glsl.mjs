// regress: skip — a-story6: story_neb.js's two programs compile and link in WebGL 2 (SwiftShader), a few seconds
//   bash test/wt_run.sh neb_glsl.mjs 300
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const ROOT = new URL('../', import.meta.url).pathname;
const src = fs.readFileSync(ROOT + 'src/main/story_neb.js', 'utf8');
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage();
await page.goto('about:blank');
await page.addScriptTag({ content: 'window.VR = { GL: {} };' + src });
const r = await page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl2'), S = VR.StoryNeb.SRC, out = [];
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return gl.getShaderParameter(o, gl.COMPILE_STATUS) ? [o, ''] : [null, gl.getShaderInfoLog(o)]; };
  const pre = '#version 300 es\nprecision highp float;\nprecision highp int;\n';
  for (const [n, v, f] of [['bg', S.BG_VS, S.BG_FS], ['layer', S.L_VS, S.L_FS]]) {
    const a = sh(gl.VERTEX_SHADER, pre + v), b = sh(gl.FRAGMENT_SHADER, pre + f);
    if (!a[0] || !b[0]) { out.push(n + ': ' + a[1] + b[1]); continue; }
    const p = gl.createProgram(); gl.attachShader(p, a[0]); gl.attachShader(p, b[0]); gl.linkProgram(p);
    out.push(n + ': ' + (gl.getProgramParameter(p, gl.LINK_STATUS) ? 'ok' : gl.getProgramInfoLog(p)));
  }
  return out;
});
console.log(r.join('\n'));
await browser.close();
const bad = r.filter(x => !/: ok$/.test(x)).length;
console.log(bad ? 'FAILED ' + bad : 'ALL OK');
process.exit(bad ? 1 : 0);
