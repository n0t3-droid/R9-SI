// f-slim (docs/superpowers/plans/2026-10-31-f-slim.md, review R55-06): the game page carries its shared code once.
//   (a) dist/index.html ≤ 8.6 MB (the front's goal; test/strip.js keeps the page's budget at 9.0 MB)
//   (b) the shared code is the page's own script r9-shared, once: core.js's first statement appears once in the page;
//       the worker's text (worker-src) holds only the worker's own part (the textures' modules, the people, worker_main)
//   (c) the worker the pool starts (game.js makePool: r9-shared's text, then worker-src's) is the whole worker bundle:
//       it parses, starts with the core, answers init with ready, and generates a column (the Heartland's spawn)
//   (d) the debug page and the player page have the same scripts (ids, order) and the same lines
//   bash test/wt_run.sh f_slim.js 300
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const ROOT = path.join(__dirname, '..'), DIST = path.join(ROOT, 'dist');
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
if (!process.env.NO_BUILD) cp.execFileSync(process.execPath, ['build.js'], { cwd: ROOT, stdio: 'ignore' });
const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8'), dbg = fs.readFileSync(path.join(DIST, 'index.debug.html'), 'utf8');
const size = fs.statSync(path.join(DIST, 'index.html')).size;
check(size <= 8600000, `dist/index.html ${(size / 1e6).toFixed(2)} MB ≤ 8.6 MB`);
const scr = (h) => [...h.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)].map(m => ({ attrs: m[1].trim(), code: m[2] }));
const S = scr(html), sh = S.find(s => s.attrs === 'id="r9-shared"'), wk = S.find(s => /id="worker-src"/.test(s.attrs));
check(!!sh && !!wk, 'the page has the shared script r9-shared and the worker text worker-src');
const core = /var VR ?= ?\(typeof globalThis/g;
const nCore = (html.match(core) || []).length;
check(nCore === 1 && sh && (sh.code.match(core) || []).length === 1, `core.js's first statement once in the page, in r9-shared (${nCore}×)`);
check(wk && /VR\.TEX_MODS ?= ?function ?\(VR\) ?\{/.test(wk.code) && /m\.type ?=== ?'texhi'/.test(wk.code), "worker-src: the worker's own part (VR.TEX_MODS, worker_main's jobs)");
check(sh && !/VR\.TEX_MODS ?= ?function/.test(sh.code), 'r9-shared: no texture module of the worker');
// the main script after r9-shared does not carry the shared code again either (the generators are in r9-shared only)
const nGen = (html.match(/VR\.OverworldGen ?= ?OverworldGen/g) || []).length;
check(nGen === 1, `the overworld generator defined once in the page (${nGen}×)`);
const gsrc = fs.readFileSync(path.join(ROOT, 'src/main/game.js'), 'utf8');
check(/getElementById\('r9-shared'\)[\s\S]{0,200}getElementById\('worker-src'\)\.textContent/.test(gsrc), "game.js makePool: r9-shared's text before worker-src's");
// (c) the pool's worker in a child of its own
if (process.argv[2] !== '--child') {
  const o = JSON.parse(cp.execFileSync(process.execPath, [__filename, '--child'], { cwd: ROOT, env: Object.assign({}, process.env, { NO_BUILD: '1' }) }).toString().trim().split('\n').pop());
  check(o.parse, "the worker bundle (r9-shared + worker-src) parses", o.err);
  check(o.ready, 'it answers init with ready');
  check(o.gen && o.blocks > 1000, `it generates the spawn's column (seed 53, vgen 14: ${o.blocks} blocks, ${o.ms} ms)`);
}
if (process.argv[2] === '--child') {
  const src = (sh.code + '\n' + wk.code).replace(/<\\\/script/gi, '</script'), out = { parse: false };
  try { new vm.Script(src); out.parse = true; } catch (e) { out.err = e.message; }
  globalThis.self = globalThis; const got = []; globalThis.postMessage = (x) => got.push(x);
  (0, eval)(src);
  self.onmessage({ data: { type: 'init', seed: 53, opts: { worldType: 'default', vgen: 14 }, custom: null } });
  out.ready = got.some(x => x.type === 'ready');
  const t0 = Date.now(); let tries = 0;
  const poll = () => {
    const a = got.find(x => x.type === 'gen' && x.id === 7);
    if (a) { out.gen = true; out.blocks = a.blocks.reduce((n, b) => n + (b ? 1 : 0), 0); out.ms = Date.now() - t0; console.log(JSON.stringify(out)); process.exit(0); }
    if (++tries > 3000) { console.log(JSON.stringify(out)); process.exit(0); }
    setTimeout(poll, 20);
  };
  self.onmessage({ data: { type: 'gen', id: 7, dim: 'overworld', cx: 0, cz: 0 } });
  poll();
} else {
  // (d) the same scripts in both pages
  const D = scr(dbg);
  check(D.length === S.length && D.every((s, i) => s.attrs === S[i].attrs), `the debug page: the same ${S.length} scripts in the same order`);
  check(dbg.split('\n').length === html.split('\n').length, 'the debug page: the same lines');
  console.log(fails ? `\nFAILED ${fails}` : '\nALL OK');
  process.exit(fails ? 1 : 0);
}
