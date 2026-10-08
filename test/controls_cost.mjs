// F5 · Steuerung & Einstellungen — what the controls work costs per frame (spec 2026-10-08 realism wave, "Measuring").
// Two builds, measured back to back on one browser in one run: BEFORE (the untouched build, a copy of the base) and
// AFTER (this checkout's dist/). A fixed scene: seed 1, the spawn of the default world, noon (env.setTime 6000),
// 1280×720, dynamic quality off. For Very Low (potato) and High the test reads renderer.stats (draw calls, triangles,
// sections), the frame interval over 4 s of the running loop and the main-thread milliseconds the loop spends (jsMs).
// F5 adds no per-frame GPU work: the draw calls and triangles must match the untouched build (within loading noise).
// Two costs exist only when used and are timed alone: one live-preview capture (drawImage of the game canvas into the
// 240×135 thumbnail) and one Automatik decision (VR.Bench.decide; the untouched build has no Automatik).
// The machine is shared, so the frame times are printed for the plan, not gated. Ends with ALL OK / FAILED n.
//   bash test/wt_run.sh controls_cost.mjs
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import { spawn } from 'child_process';
const BEFORE = process.env.BEFORE || '/home/claude/vr/.tmp_tests/dist_base';   // the untouched build (a copy of the base)
const AFTER = process.env.DIST || '/home/claude/vr/dist';                       // this checkout's build
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });

async function run(label, dir) {
  const PORT = 8600 + Math.floor(Math.random() * 300);
  const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', dir], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 900));
  const URL0 = `http://127.0.0.1:${PORT}`;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('[pageerror] ' + String(e.message || e).slice(0, 400)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource: the server responded with a status of 404/.test(m.text())) errs.push('[console] ' + m.text().slice(0, 300)); });   // (a 404 for a resource is in the untouched build too: counted as a note, not a failure)
  const wait = (ms) => page.waitForTimeout(ms);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const out = { label };
  try {
    await page.goto(URL0 + '/index.html', { waitUntil: 'domcontentloaded', timeout: 180000 });
    for (let i = 0; i < 180; i++) { await wait(500); if (await ev(() => !!(window.VR && VR.game && VR.game.state === 'title'))) break; }
    await ev(`VR.game.createWorld({name:'Kosten',mode:'creative',difficulty:'peaceful',type:'default',seed:'1',cheats:true,kit:true})`);
    for (let i = 0; i < 240; i++) { await wait(500); if (await ev(() => VR.game.state === 'play' && !!VR.game.player)) break; }
    await wait(12000);   // the chunks around the spawn load and mesh (workers)
    const measure = async (preset) => {
      await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.applySettings('*'); g.env.setTime(6000); g.zenFreezeTime = true; }, preset);
      await wait(9000);
      return ev(async () => {
        const g = VR.game, r = g.renderer;
        const f0 = g.frame, t0 = performance.now();
        await new Promise(res => setTimeout(res, 4000));
        const f1 = g.frame, t1 = performance.now();
        return { fps: (f1 - f0) / ((t1 - t0) / 1000), ms: (t1 - t0) / Math.max(1, f1 - f0), draws: r.stats.draws, tris: r.stats.tris, sections: r.stats.sections, jsMs: +(g.jsMs || 0).toFixed(2), gpuMs: r.gpuMs === undefined ? null : +r.gpuMs.toFixed(2) };
      });
    };
    for (const p of ['potato', 'high']) { out[p] = await measure(p); console.log(label, p, JSON.stringify(out[p])); }
    // the cost of one live-preview capture (the drawImage of the game canvas into a thumbnail, main thread; the same in both)
    out.cap = await ev(() => {
      const c = document.createElement('canvas'); c.width = 240; c.height = 135; const x = c.getContext('2d');
      const t0 = performance.now(); for (let i = 0; i < 10; i++) x.drawImage(document.getElementById('gl'), 0, 0, 240, 135); x.getImageData(0, 0, 1, 1);
      return (performance.now() - t0) / 10;
    });
    // the cost of one Automatik decision (only the new build has one)
    out.dec = await ev(() => {
      if (!(window.VR && VR.Bench && VR.Bench.decide)) return null;
      const t0 = performance.now(); for (let i = 0; i < 1000; i++) VR.Bench.decide({ ms: 40 + (i % 7), step: i % 9, target: 60 });
      return (performance.now() - t0) / 1000;
    });
  } catch (e) { out.error = String(e.message || e).slice(0, 300); }
  out.errs = errs;
  await ctx.close(); srv.kill();
  return out;
}

const before = await run('before', BEFORE);
const after = await run('after', AFTER);
await browser.close();
console.log('--- before → after (one run, back to back on the same browser)');
for (const p of ['potato', 'high']) {
  const b = before[p], a = after[p];
  if (!a || !b) { check(false, `${p}: measured in both builds`); continue; }
  console.log(`${p}: draws ${b.draws} → ${a.draws}, tris ${b.tris} → ${a.tris}, sections ${b.sections} → ${a.sections}, jsMs ${b.jsMs} → ${a.jsMs}, frame ${b.ms.toFixed(0)} → ${a.ms.toFixed(0)} ms`);
  check(a.draws > 0 && a.tris > 0, `${p}: the scene draws (draws ${a.draws}, tris ${a.tris})`);
  check(Math.abs(a.draws - b.draws) <= 2 && Math.abs(a.tris - b.tris) <= 0.02 * b.tris, `${p}: the same draw calls and triangles as the untouched build (within loading noise)`);
}
if (after.cap !== undefined) console.log(`preview capture (drawImage 240×135 of the game canvas, averaged over 10): before ${before.cap?.toFixed(2)} ms, after ${after.cap.toFixed(2)} ms`);
if (after.dec !== undefined && after.dec !== null) console.log(`Automatik decision (VR.Bench.decide, averaged over 1000): ${after.dec.toFixed(4)} ms`);
check(after.error === undefined, 'after: the run finished' + (after.error ? ': ' + after.error : ''));
check(after.errs.length === 0, 'after: no page errors: ' + (after.errs.slice(0, 3).join(' | ') || 'none'));
if (before.error) console.log('  note before (untouched build): ' + before.error);
if (before.errs.length) console.log('  note before (untouched build): ' + before.errs.slice(0, 2).join(' | '));
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
