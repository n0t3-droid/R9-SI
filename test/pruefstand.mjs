// /prüfstand in the real game (a headless browser, SwiftShader: no GPU times, so the GPU part is left out as the player
// would be told): /prüfstand kurz runs the quarter-length plan; the CPU step's frames carry the load; the result comes
// back with its lines; Smart Quality's switch is as it was; the GPU pass (forced on for a few frames) compiles, draws and
// leaves the renderer's GL state as it found it (no GL error, the picture still drawn); no page error.
//   nohup bash test/wt_run.sh pruefstand.mjs 900 > .tmp_tests/pruefstand.log 2>&1 &
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
const ROOT = new URL('../', import.meta.url).pathname;
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const page = await browser.newPage({ viewport: { width: 480, height: 270 }, locale: 'de-DE' });
const errs = [];
page.on('pageerror', (e) => errs.push(String(e.stack || e.message).slice(0, 300)));
await page.addInitScript(() => {
  const iv = setInterval(() => { const g = window.VR && window.VR.game; if (g && g.state === 'title') { clearInterval(iv); g.createWorld({ name: 'Prüfstand', mode: 'creative', difficulty: 'peaceful', type: 'default', seed: '53', cheats: true, kit: false }); } }, 100);
});
await page.goto('file://' + ROOT + 'dist/index.html', { waitUntil: 'commit', timeout: 120000 });
let ok = false;
for (let i = 0; i < 400; i++) { await page.waitForTimeout(500); if (await page.evaluate(() => !!(window.VR && VR.game && VR.game.state === 'play')).catch(() => false)) { ok = true; break; } }
check(ok, 'the world started');
if (ok) {
  await page.waitForTimeout(4000);
  // (the Automatik measures a new world's first seconds: the bench waits for it, as it tells the player)
  for (let i = 0; i < 240; i++) { if (await page.evaluate(() => !VR.game.bench && !VR.game.sweep)) break; await page.waitForTimeout(500); }
  const said = await page.evaluate(() => { const g = VR.game, out = []; const f = g.ui.chatLine.bind(g.ui); g.ui.chatLine = (t, c) => { out.push(t); return f(t, c); }; window.__said = out; return true; });
  const dyn0 = await page.evaluate(() => { const g = VR.game; g.settings.dynRes = false; return g.settings.dynRes; });
  await page.evaluate(() => VR.game.chat('/prüfstand kurz'));
  const on = await page.evaluate(() => !!VR.Pruefstand.on && VR.game.settings.dynRes === true);
  check(on, 'it runs, with Smart Quality on for the run', await page.evaluate(() => (window.__said || []).join(' | ')));
  let done = false;
  for (let i = 0; i < 240; i++) { await page.waitForTimeout(500); if (await page.evaluate(() => !VR.Pruefstand.on && !!VR.Pruefstand.last)) { done = true; break; } }
  check(done, 'it ends by itself (the quarter plan, about 36 s)');
  if (done) {
    const r = await page.evaluate(() => { const L = VR.Pruefstand.last, A = L.analysis; return { n: L.frames.length, cpuF: L.frames.filter((f) => f.k === 'cpu' && f.cpu > 0).length, cpuMax: Math.max(...L.frames.map((f) => f.cpu || 0)), loads: A.loads.map((l) => [l.kind, l.skipped ? 'skipped' : l.rungs]), timed: A.meta.timed, dyn: VR.game.settings.dynRes, lines: VR.Pruefstand.lines(A, 'de') }; });
    check(r.n > 30 && r.cpuF > 5 && r.cpuMax > 5, `frames recorded (${r.n}), the CPU step's frames carry its load (${r.cpuF}, up to ${r.cpuMax.toFixed(1)} ms)`);
    const gRow = r.loads.find((l) => l[0] === 'gpu');
    check(r.timed ? gRow[1] !== 'skipped' : gRow[1] === 'skipped', r.timed ? 'GPU times here (SwiftShader tells them): the GPU step calibrated and run' : 'no GPU times here: the GPU part left out, and said so', JSON.stringify(r.loads));
    check(r.dyn === dyn0, "Smart Quality's switch as it was", r.dyn);
    check(r.lines.length === 4 && /Last CPU/.test(r.lines.join(' ')), 'the result in lines', r.lines[2]);
    console.log('    ' + r.lines.join('\n    '));
  }
  // the GPU pass, forced on: compiles, draws, restores the state
  const gp = await page.evaluate(async () => {
    const g = VR.game, r = g.renderer, gl = r.gl, P = VR.Pruefstand;
    while (gl.getError() !== gl.NO_ERROR) { /* drain */ }
    await new Promise((res) => setTimeout(res, 1500));   // (the frames without the pass: the game's own GL errors, if any)
    const errBase = gl.getError(); while (gl.getError() !== gl.NO_ERROR) { /* drain */ }
    P.gpuOn = true; P.loops = 8;
    const prog0 = gl.getParameter(gl.CURRENT_PROGRAM), fb0 = gl.getParameter(gl.FRAMEBUFFER_BINDING);
    P.gpuBurn(gl, r);
    const err = gl.getError(), same = gl.getParameter(gl.CURRENT_PROGRAM) === prog0 && gl.getParameter(gl.FRAMEBUFFER_BINDING) === fb0;
    await new Promise((res) => setTimeout(res, 1500));   // (some frames with the pass inside the timer)
    P.gpuOn = false; P.loops = 0;
    const err2 = gl.getError();
    return { errBase, err, err2, same, bad: !!(P.gl && P.gl.bad), draws: r.stats && r.stats.draws };
  });
  check(!gp.bad && gp.err === 0 && (gp.err2 === 0 || gp.err2 === gp.errBase) && gp.same, 'the GPU pass compiles, draws and leaves the GL state as it was (no GL error the frames did not have without it)', JSON.stringify(gp));
}
check(errs.length === 0, 'no page errors', errs.slice(0, 2).join(' | '));
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
