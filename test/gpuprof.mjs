// GPU-Profil in the live game (src/main/gpuprof.js, renderer.js render(), game.js F3): with the F3 overlay open the
// renderer times every pass; the overlay's second line names the passes by cost. Headless swiftshader may hide the
// timer extension — then the overlay shows no gpu line and the game runs as before (checked too).
// Checks: the overlay opens, the game keeps rendering with per-pass queries (no page error, frames advance), the line's
// shape when the extension exists (starts with 'gpu N.N ms', names 'opaque' or 'post'), the detail is off again after F3.
// Run it in the background:  nohup bash test/wt_run.sh gpuprof.mjs 900 > .tmp_tests/gpuprof.log 2>&1 &
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error' || /error|fail|missing/i.test(s)) logs.push(`[${t}] ${s.slice(0, 600)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1200)));
await page.goto(process.env.DIST || 'file:///home/claude/vr/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };

for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.applyPreset('low'); g.settings.dynRes = false; g.settings.renderDist = 4; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Profil',mode:'creative',difficulty:'peaceful',type:'flat',seed:'7',cheats:true,kit:true})`);
for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
check(await ev(() => VR.game.state === 'play'), 'the world runs');
await wait(1500);
const f0 = await ev(() => VR.game.renderer.frameNo);
// F3: the overlay and the per-pass queries
await ev(() => { const g = VR.game; g.debugOn = true; g.renderer.profDetail = true; });
await wait(2500);
const st = await ev(() => { const g = VR.game, r = g.renderer, p = r.prof; const d = document.getElementById('debug'); return { frames: r.frameNo, detail: !!(p && p.detail), ext: !!(p && p.ext), total: p ? p.total : null, line: p ? p.line() : null, peaks: p ? p.peaks() : null, overlay: d ? d.textContent.split('\n').slice(0, 2) : null, inFlight: p ? p.flight.length : -1, open: !!(p && p.active) }; });
console.log('  overlay: ' + JSON.stringify(st.overlay));
console.log('  profile: ' + st.line + (st.peaks ? '  ·  max ' + st.peaks : '') + '  (ext ' + st.ext + ', total ' + st.total + ', frames ' + (st.frames - f0) + ')');
check(st.frames > f0 + 20, 'the game keeps rendering with the profile on (' + (st.frames - f0) + ' frames in 2.5 s)');
check(st.detail === true && st.inFlight <= 4 && !st.open, 'detail on, at most four frames in flight, no query left open between frames');
if (st.ext) {
  check(typeof st.total === 'number' && st.total > 0, 'a GPU time arrives (' + st.total + ' ms)');
  check(/^gpu \d+\.\d ms · /.test(st.line) && /opaque|post|sky/.test(st.line), 'the line: the total, then the passes by cost');
  check(st.overlay && st.overlay[1] && st.overlay[1].startsWith('gpu '), 'the F3 overlay shows the profile as its second line');
} else {
  check(st.line === '' && st.total === null, 'no timer extension here: no gpu line, nothing pretended');
  check(st.overlay && st.overlay[0] && /fps/.test(st.overlay[0]), 'the overlay still shows the frame line');
}
// F3 again: the detail is off, the single frame query as before
await ev(() => { const g = VR.game; g.debugOn = false; g.renderer.profDetail = false; });
await wait(800);
const off = await ev(() => { const p = VR.game.renderer.prof; return { detail: p ? p.detail : null, times: p ? Object.keys(p.times).length : -1, line: p ? p.line() : null }; });
check(off.detail === false && off.times === 0 && off.line === '', 'F3 closed: detail off, the per-pass times cleared, no line');
check(logs.length === 0, 'no page errors' + (logs.length ? '\n' + logs.join('\n') : ''));
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
