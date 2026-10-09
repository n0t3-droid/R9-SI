// 📊 Stufentest in the live game (src/main/sweep.js, game.js sweepStart, ui.js): started from the settings' button, it
// applies every step in turn with the governor off, measures, restores the settings and leaves a table in
// localStorage r9si.sweep; the box under the Automatik shows the progress and then the verdict (German UI).
// Checks: the button exists, the run walks all five steps (the loop runs on the real clock — ~25 s), the settings come
// back as they were, the record and the box text, the governor held still meanwhile, no page error.
// Run it in the background:  nohup bash test/wt_run.sh sweep.mjs 900 > .tmp_tests/sweep.log 2>&1 &
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 540 }, locale: 'de-DE' });
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
await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.dynRes = true; g.settings.renderDist = 6; g.applySettings('*'); g.saveSettings(); });
await ev(`VR.game.createWorld({name:'Stufen',mode:'creative',difficulty:'peaceful',type:'flat',seed:'7',cheats:true,kit:true})`);
for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
check(await ev(() => VR.game.state === 'play'), 'the world runs');
await wait(1000);
const btn = await ev(() => { const S = VR.Settings; const row = S && S.byKey && S.byKey('sweep'); return row ? { lab: VR.I18N.t(row.lab), act: row.act, sec: row.sec } : null; });
check(btn && btn.act === 'sweep' && /Stufentest/.test(btn.lab) && btn.sec === 'auto', 'the settings hold the 📊 Stufentest button in Bild · Automatik (' + JSON.stringify(btn) + ')');
const before = await ev(() => JSON.stringify(VR.game.settings));
const started = await ev(() => VR.game.sweepStart());
check(started === true, 'the test starts');
check(await ev(() => VR.game.sweepStart()) === false, 'a second start is refused while it runs');
await wait(2500);
const mid = await ev(() => { const g = VR.game; return { phase: g.sweep && g.sweep.phase, at: g.sweep && g.sweep.at, preset: g.settings.preset, dynRes: g.settings.dynRes, aq: g.aq ? g.aq.stack.length : 0, box: (document.getElementById('benchbox') || {}).textContent || null, msg: g.ui.benchMsg && g.ui.benchMsg.text }; });
console.log('  after 2.5 s: ' + JSON.stringify(mid));
check(mid.preset === 'potato' && mid.dynRes === false && mid.at === 0, 'the first step (Very Low) is on with the governor off');
check(/Sehr niedrig/.test(mid.msg || '') && /1 von 5/.test(mid.msg || ''), 'the progress text names the step (' + mid.msg + ')');
// the whole run: five steps of 4.2 s on the real clock (a software frame may take long: wait up to 60 s)
let done = null;
for (let i = 0; i < 60; i++) { await wait(1000); done = await ev(() => (VR.game.sweep ? null : (VR.game.ui.benchMsg || {}).text || '')); if (done !== null) break; }
check(done !== null, 'the test ends on its own');
const after = await ev(() => ({ settings: JSON.stringify(VR.game.settings), rec: VR.Sweep.last(), msg: (VR.game.ui.benchMsg || {}).text }));
check(after.settings === before, 'the settings from before are back (' + (after.settings === before ? 'same' : after.settings) + ')');
const rec = after.rec;
console.log('  record: ' + JSON.stringify(rec && rec.results.map((r) => r.preset + ' ' + r.fps.toFixed(1) + ' fps (p90 ' + r.p90fps.toFixed(1) + ', n ' + r.n + ')')));
check(rec && rec.results.length === 5 && rec.results.map((r) => r.preset).join() === 'potato,low,balanced,high,ultra', 'five steps in the record, in order');
check(rec && rec.results.every((r) => r.n > 0 && r.fps > 0), 'every step measured frames');
check(rec && rec.smooth && rec.playable && typeof rec.gpu === 'string', 'the verdict and the GPU name are recorded (' + rec.smooth + ' / ' + rec.playable + ', ' + rec.gpu.slice(0, 40) + ')');
check(/Sehr niedrig \d+ fps/.test(after.msg) && /Ruckelfrei: /.test(after.msg) && /Spielbar: /.test(after.msg), 'the box shows the table and the verdict (' + after.msg + ')');
// the settings screen shows the last table again
await ev(() => { VR.game.ui.benchMsg = null; VR.game.ui.settingsTab = 'img'; VR.game.ui.showSettings(); });
await wait(300);
const shown = await ev(() => (document.getElementById('benchbox') || {}).textContent || '');
check(/Stufentest/.test(shown) && /Ruckelfrei/.test(shown), 'the settings show the last Stufentest (' + shown.slice(0, 80) + ')');
check(logs.length === 0, 'no page errors' + (logs.length ? '\n' + logs.join('\n') : ''));
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
