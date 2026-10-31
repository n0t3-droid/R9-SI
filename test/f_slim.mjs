// regress: skip — f-slim (docs/superpowers/plans/2026-10-31-f-slim.md, review R55-06): the start on Very Low, measured.
//   boot      navigation → the title screen (VR.game.state 'title'): the page's parse and every module's start
//   load      createWorld → 'play' (critic_vl.mjs's measure: seed 53, a new default creative world, Very Low as a
//             player gets it, the dynamic resolution off), polled every 250 ms; the loading screen's phases on the way
//   hitch     the longest frame gap in the first 8 s of play (no first-frame hitch from a deferred system)
//   PROFILE=1 the main thread's CPU profile (CDP) of the debug page during boot and during load, self time by module
//             (the `/* dir/file.js */` markers of the debug page) — .tmp_tests/f_slim_profile.json
//   DIST_BASE=<file:// url of another build's index.html>: the same measures on it, in turns with this build (ROUNDS)
//   pictures  test/shots/f_slim_<tag>.png — the first frame of play (no visible change)
// usage: nohup bash test/wt_run.sh f_slim.mjs 3600 > .tmp_tests/f_slim.log 2>&1 &
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import os from 'os';
const ROOT = new URL('../', import.meta.url).pathname;
const SHOTS = ROOT + 'test/shots/';
const DIST = process.env.DIST || 'file://' + ROOT + 'dist/index.html';
const DIST_BASE = process.env.DIST_BASE || '';
const ROUNDS = +(process.env.ROUNDS || 2), PROFILE = process.env.PROFILE === '1';
const SEED = process.env.SEED || '53';
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const r1 = (x) => Math.round(x * 10) / 10;
const med = (a) => { const s = a.filter(Number.isFinite).slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
fs.mkdirSync(SHOTS, { recursive: true }); fs.mkdirSync(ROOT + '.tmp_tests', { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });

// self time (ms) by module of a CDP profile; the modules from the debug page's markers (inline scripts: document lines)
const markersOf = (file) => {
  const lines = fs.readFileSync(file, 'utf8').split('\n'), out = [];
  lines.forEach((l, i) => { const m = /\/\* ((?:shared|main|studio)\/[\w./]+\.js) \*\/$/.exec(l); if (m) out.push([i, m[1]]); if (/^<script/.test(l) && !m) out.push([i, '(page ' + l.slice(0, 40) + ')']); });
  return out;
};
const byModule = (prof, marks) => {
  const self = new Map(), dt = prof.timeDeltas || [], hit = new Map();
  (prof.samples || []).forEach((id, i) => hit.set(id, (hit.get(id) || 0) + (dt[i + 1] || dt[i] || 0)));
  const fns = new Map();
  for (const n of prof.nodes) {
    const us = hit.get(n.id) || 0; if (!us) continue;
    const cf = n.callFrame, line = cf.lineNumber;
    let mod = cf.url ? (cf.url.startsWith('blob:') ? '(worker blob)' : '(script)') : '(' + (cf.functionName || 'native') + ')';
    if (cf.url && cf.url.startsWith('file:') && line >= 0) { let lo = 0, hi = marks.length - 1, k = -1; while (lo <= hi) { const mid = (lo + hi) >> 1; if (marks[mid][0] <= line) { k = mid; lo = mid + 1; } else hi = mid - 1; } mod = k >= 0 ? marks[k][1] : '(head)'; }
    self.set(mod, (self.get(mod) || 0) + us / 1000);
    const fk = mod + ' ' + (cf.functionName || '(anon)') + ':' + (line + 1);
    fns.set(fk, (fns.get(fk) || 0) + us / 1000);
  }
  const top = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => [k, Math.round(v)]);
  return { total: Math.round([...self.values()].reduce((a, b) => a + b, 0)), modules: top(self, 30), functions: top(fns, 30) };
};

async function run(dist, tag, profile) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
  const page = await ctx.newPage();
  const logs = [];
  page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 400)));
  page.on('console', m => { if (m.type() === 'error') logs.push('[error] ' + m.text().slice(0, 300)); });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const wait = (ms) => page.waitForTimeout(ms);
  const cdp = profile ? await ctx.newCDPSession(page) : null;
  if (cdp) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start'); }
  const tb = Date.now();
  await page.goto(dist);
  let title = false;
  for (let i = 0; i < 1200; i++) { if (await ev(() => !!(window.VR && VR.game && VR.game.state === 'title')).catch(() => false)) { title = true; break; } await wait(100); }
  const bootS = (Date.now() - tb) / 1000;
  const nav = await ev(() => { const n = performance.getEntriesByType('navigation')[0] || {}; return { dcl: Math.round(n.domContentLoadedEventEnd || 0), load: Math.round(n.loadEventEnd || 0) }; });
  const prof = {};
  if (cdp) prof.boot = (await cdp.send('Profiler.stop')).profile;
  await wait(1500);
  // the loading screen's phases (ui.loading's text) and the main thread's long tasks while the world loads
  await ev(() => {
    const g = VR.game, ph = window.__ph = []; const t0 = performance.now();
    const lo = g.ui.loading.bind(g.ui); g.ui.loading = function (text, frac, counts) { if (!ph.length || ph[ph.length - 1][1] !== text) ph.push([Math.round(performance.now() - t0), text]); return lo(text, frac, counts); };
    window.__lt = 0; window.__ltn = 0; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) { window.__lt += e.duration; window.__ltn++; } }).observe({ type: 'longtask' }); } catch (e) { /* none */ }
    g.applyPreset('potato'); g.settings.dynRes = false; g.applySettings('*');
  });
  if (cdp) await cdp.send('Profiler.start');
  const t0 = Date.now();
  await ev((seed) => VR.game.createWorld({ name: 'Kritik VL', mode: 'creative', difficulty: 'peaceful', type: 'default', seed, cheats: true, kit: true }), SEED);
  for (let i = 0; i < 960; i++) { await wait(250); if (await ev(() => VR.game.state).catch(() => '') === 'play') break; }
  const loadS = (Date.now() - t0) / 1000;
  const ok = await ev(() => VR.game.state) === 'play';
  if (cdp) prof.load = (await cdp.send('Profiler.stop')).profile;
  // the first 8 s of play: the longest frame gap
  const hitch = await ev(() => new Promise((res) => { let last = performance.now(), mx = 0, n = 0; const t0 = last; const f = (t) => { mx = Math.max(mx, t - last); last = t; n++; if (t - t0 < 8000) requestAnimationFrame(f); else res({ maxMs: Math.round(mx), frames: n }); }; requestAnimationFrame(f); }));
  const info = await ev(() => ({ preset: VR.game.settings.preset, rd: VR.game.settings.renderDist, ph: window.__ph, longTaskMs: Math.round(window.__lt), longTasks: window.__ltn, heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : -1 }));
  await page.screenshot({ path: SHOTS + 'f_slim_' + tag + '.png' });
  await ctx.close();
  return { tag, ok, title, bootS: r1(bootS), loadS: r1(loadS), nav, hitch, info, logs, prof };
}

const rec = { dist: DIST, base: DIST_BASE, rounds: ROUNDS, load: os.loadavg().map(r1), runs: [] };
const save = () => fs.writeFileSync(ROOT + '.tmp_tests/f_slim.json', JSON.stringify(rec, null, 1));
const pages = [['cur', DIST]].concat(DIST_BASE ? [['base', DIST_BASE]] : []);
for (let r = 0; r < ROUNDS; r++) {
  const order = r % 2 ? pages.slice().reverse() : pages;
  for (const [tag, url] of order) {
    const x = await run(url, tag, false);
    console.log(`${tag} r${r}: ${x.ok ? 'play' : 'NOT play'} boot ${x.bootS} s (dcl ${x.nav.dcl} ms, load ${x.nav.load} ms) · load ${x.loadS} s · hitch ${x.hitch.maxMs} ms · long tasks ${x.info.longTaskMs} ms/${x.info.longTasks} · heap ${x.info.heapMB} MB · loadavg ${os.loadavg()[0].toFixed(2)} (${secs()})`);
    console.log('   phases ' + JSON.stringify(x.info.ph).slice(0, 400));
    if (x.logs.length) console.log('   logs ' + x.logs.slice(0, 3).join(' | '));
    delete x.prof; rec.runs.push(x); save();
    check(x.ok && x.title && !x.logs.some(l => l.startsWith('[pageerror]')), `${tag} r${r}: boots, plays, no page error`);
  }
}
for (const [tag] of pages) {
  const R = rec.runs.filter(x => x.tag === tag);
  rec[tag] = { bootS: med(R.map(x => x.bootS)), loadS: med(R.map(x => x.loadS)), hitch: med(R.map(x => x.hitch.maxMs)) };
  console.log(`${tag}: median boot ${rec[tag].bootS} s · load ${rec[tag].loadS} s · hitch ${rec[tag].hitch} ms`);
}
save();
if (PROFILE) {
  // the debug page next to each page (the same lines): its profile, by module
  const out = {};
  for (const [tag, url] of pages) {
    const dbg = url.replace(/index\.html$/, 'index.debug.html'), file = new URL(dbg).pathname;
    if (!fs.existsSync(file)) continue;
    const x = await run(dbg, tag + '_dbg', true), marks = markersOf(file);
    out[tag] = { loadS: x.loadS, bootS: x.bootS, boot: byModule(x.prof.boot, marks), load: byModule(x.prof.load, marks) };
    console.log(`profile ${tag}: boot ${x.bootS} s (main thread ${out[tag].boot.total} ms) · load ${x.loadS} s (main thread ${out[tag].load.total} ms)`);
    console.log('  boot top: ' + out[tag].boot.modules.slice(0, 12).map(([k, v]) => k + ' ' + v).join(' · '));
    console.log('  load top: ' + out[tag].load.modules.slice(0, 12).map(([k, v]) => k + ' ' + v).join(' · '));
    console.log('  load fns: ' + out[tag].load.functions.slice(0, 10).map(([k, v]) => k + ' ' + v).join(' · '));
  }
  fs.writeFileSync(ROOT + '.tmp_tests/f_slim_profile.json', JSON.stringify(out, null, 1));
}
await browser.close();
console.log(fails ? `\nFAILED ${fails}` : '\nALL OK');
process.exit(fails ? 1 : 0);
