// t-polish2 · Very Low draws what v0.48 drew (docs/superpowers/plans/2026-10-16-t-polish2.md): every program the
// renderer builds on Very Low — renderer.buildPrograms on a stub GL, as test/light2.js b does — preprocessed (the text the
// compiler sees, its defines applied) line for line the base's. The base (v0.48, 92835e8) comes out of git (`git
// archive` of its src and the two test loaders into a temp directory) and the same dump runs there in its own process.
// The gaps sit behind the Low-and-up switches (LIGHT2, AIR2, PBR, MOTION, L2VOL) or in programs Very Low never builds
// (the far ring's FORM). Low's programs are compared beside (there the gaps' code is in).
//   bash test/wt_run.sh vl_programs.js 300          (BASE=<commit> compares with another commit)
// regress: skip  (this front's gate against its base: after a merge with fronts that change Very Low on purpose the base moves)
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');

// ---- the dump (child process): node vl_programs.js --dump <root> <preset> <out.json>
if (process.argv[2] === '--dump') {
  const root = process.argv[3], preset = process.argv[4], outFile = process.argv[5];
  global.window = { devicePixelRatio: 1, screen: { width: 1280, height: 720 } };
  global.WebGLFramebuffer = class {};
  require(root + '/test/dom_stub.js');
  const V = require(root + '/test/load_shared.js');
  global.self = global;
  const M = root + '/src/main/';
  for (const f of ['gl', 'light2', 'look', 'water_fx', 'shaders', 'skybodies', 'clouds', 'props', 'props2', 'ultralite', 'ipu', 'tex_pbr', 'bench', 'renderer', 'light2_gl', 'look_gl']) if (fs.existsSync(M + f + '.js')) { try { require(M + f + '.js'); } catch (e) { console.error(f + ': ' + e.message); } }
  const consts = {}, progs = [];
  const gl = new Proxy({}, { get(t, k) {
    if (k in t) return t[k];
    if (typeof k === 'string' && /^[A-Z][A-Z_0-9]+$/.test(k)) return consts[k] || (consts[k] = k);
    return (...a) => { if (k === 'shaderSource') progs.push(a[1]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return k === 'getProgramParameter' && a[1] === 'ACTIVE_UNIFORMS' ? 0 : true; if (k === 'getUniformBlockIndex') return 0; if (/^create/.test(k)) return {}; if (k === 'getParameter') return 16; return undefined; };
  } });
  V.GL.gl = gl; V.GL.ext = { multiDraw: null, cbf: {}, cbhf: null, aniso: null };
  const L2 = V.Light2, lite = preset === 'potato';
  const q = Object.assign({ zPre: false, shadows: lite ? 0 : 1024, hshadow: !lite, lite }, L2 ? L2.defaults(preset) : {}, V.Look ? V.Look.defaults(preset) : {});
  const r = Object.create(V.Renderer.prototype); r.gl = gl; r.multi = false; r.q = q;
  r.buildPrograms();
  fs.writeFileSync(outFile, JSON.stringify(progs));
  process.exit(0);
}

let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
// the text the compiler sees (test/light2.js's preprocessor: #ifdef / #ifndef / #if defined(…) / #elif / #else / #endif,
// the source's own #defines as they come; comments and blank lines dropped)
function pre(src) {
  const D = new Set(), out = [], stack = [];
  const active = () => stack.every(s => s.on);
  const ev = (e) => { const js = e.replace(/defined\s*\(\s*(\w+)\s*\)/g, (m, n) => (D.has(n) ? '1' : '0')).replace(/\b[A-Z_][A-Z_0-9]*\b/g, (n) => (D.has(n) ? '1' : '0')); if (!/^[01\s()!&|]*$/.test(js)) throw new Error('#if ' + e); return !!Function('return (' + js + ')')(); };
  for (const line of src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n')) {
    const t = line.trim();
    let m;
    if ((m = /^#ifdef\s+(\w+)/.exec(t))) { const on = D.has(m[1]); stack.push({ on, done: on }); continue; }
    if ((m = /^#ifndef\s+(\w+)/.exec(t))) { const on = !D.has(m[1]); stack.push({ on, done: on }); continue; }
    if ((m = /^#if\s+(.*)$/.exec(t))) { const on = ev(m[1]); stack.push({ on, done: on }); continue; }
    if ((m = /^#elif\s+(.*)$/.exec(t))) { const s = stack[stack.length - 1]; if (s.done) s.on = false; else { s.on = ev(m[1]); s.done = s.on; } continue; }
    if (/^#else/.test(t)) { const s = stack[stack.length - 1]; s.on = !s.done; s.done = true; continue; }
    if (/^#endif/.test(t)) { stack.pop(); continue; }
    if (!active()) continue;
    const c = line.replace(/\/\/.*$/, '').trim();
    if (c) out.push(c);
    if ((m = /^#define\s+(\w+)/.exec(t))) D.add(m[1]);
  }
  if (stack.length) throw new Error('unbalanced #if');
  return out.join('\n');
}
const here = path.join(__dirname, '..'), base = process.env.BASE || '92835e8';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vlprog-'));
try {
  cp.execSync(`git archive ${base} src test/load_shared.js test/dom_stub.js | tar -x -C ${JSON.stringify(tmp)}`, { cwd: here, stdio: ['ignore', 'ignore', 'pipe'], maxBuffer: 1 << 28 });
  const dump = (root, preset) => { const f = path.join(tmp, 'dump.json'); cp.execFileSync(process.execPath, [__filename, '--dump', root, preset, f], { stdio: ['ignore', 'ignore', 'ignore'] }); const a = JSON.parse(fs.readFileSync(f, 'utf8')); fs.rmSync(f); return a; };
  const firstDiff = (x, y) => { const p = (x || '').split('\n'), q = (y || '').split('\n'); for (let i = 0; i < Math.max(p.length, q.length); i++) if (p[i] !== q[i]) return i + ': ' + (p[i] || '∅').slice(0, 70) + ' | ' + (q[i] || '∅').slice(0, 70); return ''; };
  console.log(`Very Low's programs: this branch against ${base}`);
  // u-ascent (updated on purpose, docs/superpowers/plans/2026-10-22-u-ascent.md §4): Very Low draws the climb too, so its
  // terrain and tile programs carry the world's bend (u_curve: one multiply-add a vertex, 0 below 300 m) and the tiles'
  // far edge in the climb (u_climbCut: one uniform branch a fragment, off on the ground). Those lines — and only those —
  // are taken out before the comparison; they must be there, in the terrain and the tile programs
  const ASC = /\bu_curve\b|\bu_climbCut\b|\bclimbA\b|uniform float u_dip;/;
  // (u-orbitlod: the sky reads its horizon at the dip, `dir.y + u_dip` — 0 below 300 m; normalised to the base's `dir.y`;
  // the climb's soft tile edge `climbA` set aside with the cut)
  const strip = (t) => t.replace(/\(dir\.y \+ u_dip\)/g, 'dir.y').replace(/dir\.y \+ u_dip/g, 'dir.y').split('\n').filter(l => !ASC.test(l)).join('\n');
  const a = dump(tmp, 'potato').map(pre), b0 = dump(here, 'potato').map(pre), b = b0.map(strip);
  const diff = []; for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) diff.push(i);
  check(a.length > 20 && a.length === b.length, `as many shader sources (${b.length}) as the base built (${a.length})`);
  check(diff.length === 0, 'every one, preprocessed, the base\'s line for line (the gaps are Low-and-up switches; u-ascent\'s bend and tile edge set aside)', diff.length ? 'differ: ' + diff.slice(0, 4).map(i => '#' + i + ' ' + firstDiff(a[i], b[i])).join(' · ') : b.length + ' sources');
  const withBend = b0.filter(t => /rel\.y -= u_curve \* dot\(rel\.xz, rel\.xz\)/.test(t)).length, withCut = b0.filter(t => /u_climbCut\.y > 0\.0/.test(t)).length;
  const ascLines = b0.reduce((n, t) => n + t.split('\n').filter(l => ASC.test(l)).length, 0);
  check(withBend >= 2 && withCut >= 1 && a.every(t => !ASC.test(t)), `u-ascent's lines are the only Very Low difference: the bend in ${withBend} programs, the tiles' climb edge in ${withCut}`, ascLines + ' lines');
  // on Low the gaps' code is in (the comparison sees a change where there is one)
  const la = dump(tmp, 'low').map(pre), lb = dump(here, 'low').map(pre);
  let ld = 0; for (let i = 0; i < Math.max(la.length, lb.length); i++) if (la[i] !== lb[i]) ld++;
  check(ld > 0, `on Low the gaps' code is in: ${ld} of ${lb.length} sources changed (the room haze, the rain's map, the windows' sky, the far lights)`);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
