import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage();
const r = await page.evaluate(() => {
  const c = document.createElement('canvas');
  const gl = c.getContext('webgl2');
  if (!gl) return 'no webgl2';
  return {
    renderer: gl.getParameter(gl.RENDERER),
    exts: gl.getSupportedExtensions(),
    maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    maxLayers: gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS),
    maxVU: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS),
    maxUBO: gl.getParameter(gl.MAX_UNIFORM_BLOCK_SIZE),
    hc: navigator.hardwareConcurrency
  };
});
console.log(JSON.stringify(r, null, 1));
await browser.close();
