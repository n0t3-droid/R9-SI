// regress: skip — f-build's load bench (docs/superpowers/plans/2026-10-23-f-build.md, review R50-09): the time from the
// navigation to the first played frame of a fixed world on Very Low. Four pages in one browser, a fresh context for every
// load (no texture cache, no saved world: a player's first start), the loads in turns, medians of ROUNDS:
//   v048    the v0.48 tag, exported (git archive) and built in a temporary directory under /tmp, removed after
//   v049    the v0.49 tag, the same
//   debug   this branch's dist/index.debug.html — the same code with its comments
//   cur     this branch's dist/index.html — stripped
// The phases (in-page performance.now(), 0 = the navigation): html (the HTML parsed, domInteractive), dcl (the scripts
// run, DOMContentLoaded), load (the load event: boot begins), title (the start screen stands — the world is created at
// once by a hook in the page: seed 53, creative, Very Low as a player gets it, no dynamic resolution), play (the state
// 'play'), frame (the first frame drawn in play). Also the JS heap at that frame, the textures' forge time, the page's
// bytes and its gzip size (GitHub Pages sends it gzipped).
//   pictures  test/shots/load_time_<page>.png — PIC_S seconds after the first played frame of round 1 — and the sheet
//             test/shots/load_time_sheet.jpg; every number in test/shots/load_time.json
// usage: nohup bash test/wt_run.sh load_time.mjs 5400 > .tmp_tests/load_time.log 2>&1 &
//   ROUNDS=3 · ONLY=cur,debug (pages) · SEED=53 · PIC_S=6 · KEEP=1 (keep the tag builds in /tmp)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import zlib from 'zlib';
import { execSync } from 'child_process';
const ROOT = new URL('../', import.meta.url).pathname;
const SHOTS = ROOT + 'test/shots/';
const ROUNDS = +(process.env.ROUNDS || 3), SEED = process.env.SEED || '53', PIC_S = +(process.env.PIC_S || 6), LIMIT_S = 420;
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
const r1 = (x) => (Number.isFinite(x) ? Math.round(x / 100) / 10 : NaN);   // ms → s, one decimal
fs.mkdirSync(SHOTS, { recursive: true });

// ---------------------------------------------------------------- the pages (the tags built once, in /tmp)
const tagBuild = (tag) => {
  const dir = `/tmp/r9lt_${tag.replace('.', '')}`;
  if (!fs.existsSync(dir + '/dist/index.html')) {
    fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    execSync(`git -C ${JSON.stringify(ROOT)} archive ${tag} src build.js | tar -x -C ${dir}`, { stdio: ['ignore', 'ignore', 'pipe'], maxBuffer: 1 << 28 });
    execSync('node build.js', { cwd: dir, stdio: ['ignore', 'ignore', 'pipe'] });
  }
  return dir;
};
// (this branch's two pages are copied first: a build running meanwhile — test/strip.js builds — must not change them under a load)
const CUR = '/tmp/r9lt_cur';
fs.rmSync(CUR, { recursive: true, force: true }); fs.mkdirSync(CUR + '/dist', { recursive: true });
for (const f of ['index.html', 'index.debug.html']) fs.copyFileSync(ROOT + 'dist/' + f, CUR + '/dist/' + f);
const PAGES = [
  { id: 'v048', label: 'v0.48', dir: tagBuild('v0.48'), file: 'index.html' },
  { id: 'v049', label: 'v0.49', dir: tagBuild('v0.49'), file: 'index.html' },
  { id: 'debug', label: 'f-build debug', dir: CUR, file: 'index.debug.html' },
  { id: 'cur', label: 'f-build', dir: CUR, file: 'index.html' },
].filter(p => !process.env.ONLY || process.env.ONLY.split(',').includes(p.id));
for (const P of PAGES) {
  P.path = P.dir.replace(/\/$/, '') + '/dist/' + P.file; P.url = 'file://' + P.path;
  const buf = fs.readFileSync(P.path);
  P.bytes = buf.length; P.gzip = zlib.gzipSync(buf).length;
  console.log(`${P.label.padEnd(14)} ${(P.bytes / 1e6).toFixed(2)} MB · gzip ${(P.gzip / 1e6).toFixed(2)} MB · ${P.path}`);
}
const rec = { seed: SEED, rounds: ROUNDS, pages: {} };
for (const P of PAGES) rec.pages[P.id] = { label: P.label, bytes: P.bytes, gzip: P.gzip, loads: [] };
const save = () => { try { fs.writeFileSync(SHOTS + 'load_time.json', JSON.stringify(rec, null, 1)); } catch (e) { /* a convenience */ } };

// ---------------------------------------------------------------- the hook in the page: marks, the world at once
const HOOK = (seed) => {
  const T = window.__lt = { t: {}, err: [] };
  const mark = (k) => { if (T.t[k] === undefined) T.t[k] = performance.now(); };
  document.addEventListener('DOMContentLoaded', () => mark('dcl'));
  window.addEventListener('load', () => mark('load'));
  const iv = setInterval(() => {
    const V = window.VR, g = V && V.game;
    if (!g) return;
    if (g.renderer && !T.hooked) {
      T.hooked = true;
      const r = g.renderer, orig = r.render;
      r.render = function () {
        const out = orig.apply(this, arguments);
        if (window.VR.game.state === 'play' && T.t.frame === undefined) { mark('frame'); try { T.heap = performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null; } catch (e) { T.heap = null; } }
        return out;
      };
    }
    if (g.state === 'title' && !T.created) {
      T.created = true; mark('title');
      try { g.applyPreset('potato'); g.settings.dynRes = false; g.applySettings('*'); } catch (e) { T.err.push('preset: ' + e.message); }
      try { const p = g.createWorld({ name: 'Ladezeit', mode: 'creative', difficulty: 'peaceful', type: 'default', seed, cheats: true, kit: true }); if (p && p.catch) p.catch((e) => T.err.push('create: ' + e.message)); } catch (e) { T.err.push('create: ' + e.message); }
    }
    if (g.state === 'play') mark('play');
    if (T.t.frame !== undefined) clearInterval(iv);
  }, 15);
};

const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
async function load(P, round) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
  await ctx.addInitScript(HOOK, SEED);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.stack || e.message).slice(0, 400)));
  page.on('crash', () => errs.push('the page crashed'));
  const t0 = Date.now();
  let res = null;
  try {
    await page.goto(P.url, { waitUntil: 'commit', timeout: 120000 });
    for (;;) {
      await page.waitForTimeout(400);
      res = await page.evaluate(() => (window.__lt ? { t: window.__lt.t, err: window.__lt.err, heap: window.__lt.heap } : null)).catch(() => null);
      if ((res && res.t.frame !== undefined) || Date.now() - t0 > LIMIT_S * 1000 || errs.some(e => /crashed/.test(e))) break;
    }
  } catch (e) { errs.push('harness: ' + String(e.message || e).slice(0, 300)); }
  const nav = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return n ? { html: n.domInteractive, dclEnd: n.domContentLoadedEventEnd } : null; }).catch(() => null);
  const game = await page.evaluate(() => { const g = window.VR && VR.game; return g ? { texMs: g.texMs, texFromCache: !!g.texFromCache, loadStart: g.loadStart, state: g.state, preset: g.settings && g.settings.preset, rd: g.settings && g.settings.renderDist, vgen: g.meta && g.meta.vgen } : null; }).catch(() => null);
  let pic = null;
  if (round === 0 && res && res.t.frame !== undefined) {
    await page.waitForTimeout(PIC_S * 1000);
    pic = SHOTS + `load_time_${P.id}.png`;
    await page.screenshot({ path: pic, timeout: 120000 }).catch((e) => { errs.push('screenshot: ' + e.message); pic = null; });
  }
  await ctx.close().catch(() => {});
  const t = (res && res.t) || {};
  const L = { round: round + 1, html: nav && nav.html, dcl: t.dcl, load: t.load, title: t.title, play: t.play, frame: t.frame, heapMB: res && res.heap, texMs: game && game.texMs, world: game && t.play !== undefined && game.loadStart ? t.play - game.loadStart : undefined, state: game && game.state, preset: game && game.preset, rd: game && game.rd, vgen: game && game.vgen, err: errs.concat((res && res.err) || []), pic };
  console.log(`  ${P.label.padEnd(14)} round ${round + 1}: html ${r1(L.html)} · scripts ${r1(L.dcl)} · title ${r1(L.title)} · play ${r1(L.play)} · frame ${r1(L.frame)} s · world ${r1(L.world)} s · textures ${r1(L.texMs)} s · heap ${L.heapMB} MB · ${L.preset}/${L.rd}${L.err.length ? ' · ERR ' + L.err[0].slice(0, 160) : ''} (${secs()})`);
  return L;
}

// ---------------------------------------------------------------- the rounds in turns
for (let r = 0; r < ROUNDS; r++) {
  const order = PAGES.map((_, i) => PAGES[(i + r) % PAGES.length]);
  for (const P of order) { rec.pages[P.id].loads.push(await load(P, r)); save(); }
}
await browser.close();

// ---------------------------------------------------------------- the medians, the checks
console.log('\nmedians of ' + ROUNDS + ' (s from the navigation) — html · scripts · title · play · first frame · world · heap');
for (const P of PAGES) {
  const R = rec.pages[P.id], m = (k) => med(R.loads.map(l => l[k]));
  R.med = { html: m('html'), dcl: m('dcl'), title: m('title'), play: m('play'), frame: m('frame'), world: m('world'), heapMB: m('heapMB'), texMs: m('texMs') };
  R.cold = R.loads[0] ? { frame: R.loads[0].frame } : null;
  console.log(`  ${P.label.padEnd(14)} ${r1(R.med.html)} · ${r1(R.med.dcl)} · ${r1(R.med.title)} · ${r1(R.med.play)} · ${r1(R.med.frame)} · ${r1(R.med.world)} · ${R.med.heapMB} MB   (${(P.bytes / 1e6).toFixed(2)} MB, gzip ${(P.gzip / 1e6).toFixed(2)} MB)`);
}
save();
const M = (id, k) => rec.pages[id] && rec.pages[id].med ? rec.pages[id].med[k] : NaN;
for (const P of PAGES) { const e = rec.pages[P.id].loads.filter(l => l.err.length); if (P.id === 'cur' || P.id === 'debug') check(!e.length && rec.pages[P.id].loads.every(l => Number.isFinite(l.frame)), `${P.label}: every load reached its first played frame without a page error` + (e.length ? ': ' + e[0].err[0].slice(0, 200) : '')); }
if (rec.pages.cur && rec.pages.v048) check(M('cur', 'frame') <= M('v048', 'frame'), `R50-09: navigation → first played frame on Very Low ${r1(M('cur', 'frame'))} s ≤ v0.48's ${r1(M('v048', 'frame'))} s`);
if (rec.pages.cur && rec.pages.debug) check(M('cur', 'dcl') <= M('debug', 'dcl') * 1.03 + 50, `the stripped page runs its scripts no later than the debug page (${r1(M('cur', 'dcl'))} s against ${r1(M('debug', 'dcl'))} s)`);

// ---------------------------------------------------------------- the sheet (the first played frame + PIC_S, round 1)
try {
  const cell = (id) => rec.pages[id] && rec.pages[id].loads[0] && rec.pages[id].loads[0].pic;
  const lab = (id) => rec.pages[id] ? `${rec.pages[id].label}: frame ${r1(M(id, 'frame'))} s, ${(rec.pages[id].bytes / 1e6).toFixed(1)} MB` : '';
  const spec = { cols: [], w: 560, rows: [{ label: '', labels: [lab('v048'), lab('v049')], imgs: [cell('v048') || null, cell('v049') || null] }, { label: '', labels: [lab('debug'), lab('cur')], imgs: [cell('debug') || null, cell('cur') || null] }] };
  fs.writeFileSync(ROOT + '.tmp_tests/load_time_sheet.json', JSON.stringify(spec));
  execSync(`python3 /root/r9coord/sheet.py ${SHOTS}load_time_sheet.jpg ${ROOT}.tmp_tests/load_time_sheet.json`, { stdio: 'ignore' });
  console.log('  sheet test/shots/load_time_sheet.jpg');
} catch (e) { console.log('  (no sheet: ' + String(e.message || e).slice(0, 200) + ')'); }
if (!process.env.KEEP) for (const t of ['v048', 'v049', 'cur']) fs.rmSync('/tmp/r9lt_' + t, { recursive: true, force: true });
console.log(`\n(${secs()})`);
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
