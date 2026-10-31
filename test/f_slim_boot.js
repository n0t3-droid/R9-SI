// regress: skip — f-slim's start-up profile in node (docs/superpowers/plans/2026-10-31-f-slim.md, review R55-06): one
// built page's worker bundle, in a child process of its own each — its parse and start, the textures, the first world's
// generation (seed 53, a new default world: vgen 14, the Heartland) around the spawn, in the spiral the loading screen
// asks for — times by phase and (PROF=1) self time by module from node's CPU profile of the debug page's bundle.
//   node test/f_slim_boot.js [dist/index.html …]      (R=5: the spiral's radius in columns · PROF=1)
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');

const workerOf = (html) => {
  const m = /<script type="text\/js-worker" id="worker-src">([\s\S]*?)<\/script>/.exec(html), sh = /<script id="r9-shared">([\s\S]*?)<\/script>/.exec(html);
  return ((sh ? sh[1] + '\n' : '') + m[1]).replace(/<\\\/script/gi, '</script');
};
if (process.argv[2] === '--child') {
  const file = process.argv[3], R = +(process.env.R || 5), out = {};
  const src = workerOf(fs.readFileSync(file, 'utf8'));
  globalThis.self = globalThis; const waiters = []; let answers = [];
  globalThis.postMessage = (x) => { answers.push(x); for (const w of waiters.splice(0)) w(); };
  const ask = (m) => new Promise((res) => { answers = []; const chk = () => { const a = answers.find(x => x.id === m.id && x.type !== 'waiting'); if (a) res(a); else waiters.push(chk); }; waiters.push(chk); self.onmessage({ data: m }); chk(); });
  let t = performance.now();
  (0, eval)(src);
  out.evalMs = Math.round(performance.now() - t);
  (async () => {
    t = performance.now(); await ask({ type: 'textures', id: 1, bevel: 1, bevelAll: true }).catch(() => 0); out.texMs = Math.round(performance.now() - t);
    t = performance.now(); self.onmessage({ data: { type: 'init', id: 2, seed: 53, opts: { worldType: 'default', vgen: 14 }, custom: null } }); out.initMs = Math.round(performance.now() - t);
    const spiral = []; for (let r = 0; r <= R; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (Math.max(Math.abs(dx), Math.abs(dz)) === r) spiral.push([dx, dz]);
    let id = 10, first = 0, n = 0, blocks = 0;
    t = performance.now();
    for (const [cx, cz] of spiral) {
      const a = await ask({ type: 'gen', id: id++, dim: 'overworld', cx, cz });
      if (a.type === 'gen') { n++; for (let i = 0; i < a.blocks.length; i += 7) if (a.blocks[i]) blocks++; }
      if (!first) first = performance.now() - t;
    }
    out.genMs = Math.round(performance.now() - t); out.firstColMs = Math.round(first); out.cols = n; out.blockSig = blocks;
    process.stdout.write(JSON.stringify(out) + '\n'); process.exit(0);
  })().catch((e) => { process.stdout.write(JSON.stringify({ error: String(e && e.stack || e).slice(0, 400) }) + '\n'); process.exit(1); });
  return;
}

const pages = process.argv.slice(2).length ? process.argv.slice(2) : [path.join(ROOT, 'dist/index.html')];
const PROF = process.env.PROF === '1';
for (const p of pages) {
  const runs = [];
  for (let k = 0; k < +(process.env.N || 2); k++) {
    const args = (PROF && k === 0 ? ['--cpu-prof', '--cpu-prof-dir=' + path.join(ROOT, '.tmp_tests/f_slim_prof')] : []).concat([__filename, '--child', p]);
    const o = JSON.parse(cp.execFileSync(process.execPath, args, { env: process.env, maxBuffer: 1e7 }).toString().trim().split('\n').pop());
    runs.push(o);
  }
  const best = (k) => Math.min(...runs.map(r => r[k]));
  console.log(`${path.relative(ROOT, p) || p}: ${(fs.statSync(p).size / 1e6).toFixed(2)} MB · worker parse+start ${best('evalMs')} ms · textures ${best('texMs')} ms · init ${best('initMs')} ms · gen ${runs[0].cols} columns ${best('genMs')} ms (first ${best('firstColMs')} ms) · sig ${runs[0].blockSig}${runs[0].error ? ' ERROR ' + runs[0].error : ''}`);
  if (PROF) {
    // self time by module: the debug page's lines (the bundle's `/* dir/file.js */` markers)
    const dir = path.join(ROOT, '.tmp_tests/f_slim_prof'), f = fs.readdirSync(dir).map(x => path.join(dir, x)).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
    const prof = JSON.parse(fs.readFileSync(f, 'utf8')); fs.rmSync(dir, { recursive: true, force: true });
    const lines = workerOf(fs.readFileSync(p, 'utf8')).split('\n'), marks = [];
    lines.forEach((l, i) => { const m = /\/\* ((?:shared|main|studio)\/[\w./]+\.js) \*\/$/.exec(l); if (m) marks.push([i, m[1]]); });
    const hit = new Map(); prof.samples.forEach((id, i) => hit.set(id, (hit.get(id) || 0) + (prof.timeDeltas[i] || 0)));
    const self = new Map();
    for (const n of prof.nodes) {
      const us = hit.get(n.id) || 0; if (!us) continue; const cf = n.callFrame;
      let mod = '(' + (cf.functionName || cf.url.split('/').pop() || 'native') + ')';
      if (!cf.url || /f_slim_boot/.test(cf.url) === false && cf.url === '') { let lo = 0, hi = marks.length - 1, k = -1; while (lo <= hi) { const mid = (lo + hi) >> 1; if (marks[mid][0] <= cf.lineNumber) { k = mid; lo = mid + 1; } else hi = mid - 1; } if (k >= 0 && cf.lineNumber >= 0 && !cf.url) mod = marks[k][1]; }
      self.set(mod, (self.get(mod) || 0) + us / 1000);
    }
    console.log('   self ms by module: ' + [...self].sort((a, b) => b[1] - a[1]).slice(0, 16).map(([k, v]) => k + ' ' + Math.round(v)).join(' · '));
  }
}
console.log('ALL OK');
