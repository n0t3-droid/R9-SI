// f-build · the player build without comments (docs/superpowers/plans/2026-10-23-f-build.md, review R50-09). The
// stripper (src/build/strip.js) takes the comments and the indentation out of the JavaScript of the player pages and
// out of the GLSL in its template literals — and nothing else:
//   (a) tricky samples: strings, escapes, line continuations, regular expressions, divisions, ASI across a comment,
//       nested template literals, HTML templates with URLs, GLSL templates — the same value, the same line count
//   (b) every source file: parses stripped, idempotent, the same line count, and (acorn, an independent tokenizer,
//       where the machine has it) the same tokens on the same lines; GLSL templates the same after GLSL normalisation
//   (c) the built pages: every script parses; the player page = the debug page stripped; the same lines; ≤ 9.0 MB
//   (d) the shader programs (Very Low, High) built from a stripped copy of the sources = the originals, preprocessed
//   (e) the stripped code behaves the same: mesh_same, light_same, id_snapshot on the stripped copy (FULL=1: gen_same
//       too); the stripped worker bundle forges the same texture bytes as the debug bundle
//   bash test/wt_run.sh strip.js 1200          (QUICK=1: (a)–(c) only · FULL=1: gen_same on the copy as well)
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..');

// ---- child: the texture forge of one page's worker bundle (texcache.js's way), its bytes' digest on stdout
if (process.argv[2] === '--forge') {
  const html = fs.readFileSync(process.argv[3], 'utf8');
  const m = /<script type="text\/js-worker" id="worker-src">([\s\S]*?)<\/script>/.exec(html);
  globalThis.self = globalThis; let last = null; globalThis.postMessage = (x) => { last = x; };
  (0, eval)(m[1].replace(/<\\\/script/gi, '</script'));
  self.onmessage({ data: { type: 'textures', id: 1, bevel: 1, bevelAll: true } });
  const h = crypto.createHash('sha256');
  for (const a of [...last.albedo, ...last.material, last.avgColor, last.noise]) h.update(Buffer.from(a.buffer, a.byteOffset, a.byteLength));
  console.log(JSON.stringify({ type: last.type, layers: last.layers, digest: h.digest('hex').slice(0, 24) }));
  process.exit(0);
}

let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
const section = (t) => console.log('\n' + t);
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
const lines = (s) => s.split('\n').length;
let Strip = null;
try { Strip = require(path.join(ROOT, 'src/build/strip.js')); } catch (e) { check(false, 'src/build/strip.js loads', e.message); }
if (!Strip || typeof Strip.js !== 'function' || typeof Strip.page !== 'function') { check(false, 'Strip.js and Strip.page exist'); console.log('\nFAILED ' + fails); process.exit(1); }
let acorn = null;
for (const p of ['acorn', '/opt/node-tools/node_modules/acorn', '/home/dev/.npm-global/lib/node_modules/acorn']) { try { acorn = require(p); break; } catch (e) { /* next */ } }

// the text the GLSL compiler sees, comments and layout aside (vl_programs.js's normalisation without the #if logic)
const glslNorm = (s) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').split('\n').map(l => l.replace(/\/\/.*$/, '').replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
// acorn's tokens: [type, value, line] — templates' cooked values; a GLSL template (its start in the source among
// `glslAt`) compared after GLSL normalisation
const tokens = (code) => {
  const out = [];
  for (const t of acorn.tokenizer(code, { ecmaVersion: 'latest', sourceType: 'script', locations: true, allowHashBang: true })) {
    const v = t.type.label === 'regexp' ? '/' + t.value.pattern + '/' + t.value.flags : t.value === undefined ? null : String(t.value);
    out.push({ k: t.type.label, v, line: t.loc.start.line, start: t.start });
  }
  return out;
};
// tokens of a and of Strip.js(a): the same — returns the first difference or ''
const sameTokens = (a, b, glslAt) => {
  const A = tokens(a), B = tokens(b);
  if (A.length !== B.length) return `token count ${A.length} vs ${B.length}`;
  let glsl = 0;
  for (let i = 0; i < A.length; i++) {
    const x = A[i], y = B[i];
    if (x.k !== y.k || x.line !== y.line) return `#${i} line ${x.line}: ${x.k} ${JSON.stringify(x.v).slice(0, 60)} vs line ${y.line}: ${y.k} ${JSON.stringify(y.v).slice(0, 60)}`;
    if (x.v === y.v) continue;
    if (x.k === 'template' && glslAt && glslAt.has(x.start) && glslNorm(x.v) === glslNorm(y.v)) { glsl++; continue; }
    return `#${i} line ${x.line}: ${x.k} ${JSON.stringify(x.v).slice(0, 80)} vs ${JSON.stringify(y.v).slice(0, 80)}`;
  }
  return '';
};
const run = (src) => { try { return JSON.stringify(vm.runInNewContext('(function () {\n' + src + '\n})()', {}, { timeout: 2000 })); } catch (e) { return 'THROWS ' + e.message; } };

// ============================================================================ (a)
section('(a) tricky samples');
const L = (...ls) => ls.join('\n');
const SAMPLES = [
  { name: 'URLs and comment marks in strings', src: L(
    "const u = 'https://example.org/a//b'; // the link",
    'const v = "http://x/*y*/z";   /* note */',
    'return u + v;'),
    want: L("const u = 'https://example.org/a//b';", 'const v = "http://x/*y*/z";', 'return u + v;') },
  { name: 'quotes and escapes', src: L(
    "  const a = 'it\\'s // not a comment', b = \"say \\\"/*hi*/\\\"\";   // c",
    '  return a + b;'),
    want: L("const a = 'it\\'s // not a comment', b = \"say \\\"/*hi*/\\\"\";", 'return a + b;') },
  { name: 'a line continuation keeps its indentation (it is the string)', src: L(
    "    const s = 'abc\\",
    "        def // still the string';",
    '    return s;'),
    want: L("const s = 'abc\\", "        def // still the string';", 'return s;') },
  { name: 'regular expressions with slashes', src: L(
    "const r1 = /\\/\\/ x/g, r2 = /[/]+/, r3 = /a\\/*b/, r4 = /[\\]/]/;   // four",
    "const s = 'a//b/c'.replace(r2, '-'), t = 'x // y\\nz'.replace(/\\/\\/[^\\n]*/g, '');",
    "return [r1.source, r2.source, r3.source, r4.source, s, t, '// x'.match(r1) !== null];") },
  { name: 'divisions', src: L(
    'const a = 10, b = 2, g = 5, re = 2;',
    'const x = a / b / g; // two divisions',
    'const y = (a + b) / 2 /* half */ / 3;',
    'let i = 4; const z = i++ / 2;',
    'const o = ({ v: 8 }).v / 2, w = [8][0] / 2 / 2, q = (4) / 2 / (1), tv = `8` / 2 / 2;',
    'const k = { return: 4 }, kv = k.return / 2;',
    'const n = a',
    '/re/g;',
    'return [x, y, z, o, w, q, tv, kv, n];') },
  { name: 'regular expressions where an expression starts', src: L(
    "const t = 'aa';",
    'let n = 0;',
    'if (t) /a/.test(t) && n++;',
    "const f = (s) => /x/.test(s) ? 1 : 0;",
    'const arr = [/b/, /c/g], ok = !/z/.test(t), ty = typeof /q/;',
    "function h() { return /h/.test('h'); }",
    "{ }",
    "/z/.test('z');",
    "return [n, f('x'), arr.length, ok, ty, h()];") },
  { name: 'ASI across a removed comment', src: L(
    'function f() {',
    '  return /*',
    '  */ 42;',
    '}',
    'function g() {',
    '  return /* same line */ 42;',
    '}',
    'return [f(), g()];'),
    want: L('function f() {', 'return', '42;', '}', 'function g() {', 'return 42;', '}', 'return [f(), g()];') },
  { name: 'an HTML template with a URL stays as it is', src: L(
    "const name = 'R9';",
    'const html = `',
    '    <a href="https://r9.example/x">// ${name} </a>   ',
    '      <!-- keep -->',
    '`;',
    'return html;') },
  { name: 'nested templates, comments and braces in interpolations', src: L(
    "const a = 1, b = 'x';",
    "const s = `A ${ a /* one */ + 1 } B ${ `inner ${ b + '}' /* } */ } done` } C ${ { k: 2 }.k } D`; // end",
    "const m = `${a}/${b}` + `/* ${'//'} */`;",
    'return [s, m];') },
  { name: 'GLSL in a template literal', src: L(
    "const COMMON = 'float c0 = 1.0;\\n';",
    'const FS = `#version 300 es',
    '    precision highp float;   // the precision',
    '    // a whole comment line',
    '    uniform vec3 u_col;      /* inline */ uniform float u_k;',
    '    ${COMMON}',
    '    float f(float x) {       // a function',
    '      return x * 0.5;        // half',
    '    }',
    "    // runs into the interpolation ${'\\n'}float g = 2.0;",
    '    float y; // an escape: \\n float z = 1.0;',
    '    #define K 2.0 // a define',
    '    out vec4 o;',
    '    void main() { o = vec4(u_col * K, 1.0); }`;',
    'return FS;'), glsl: true },
  { name: 'GLSL: a line continuation keeps the next line as it is', src: L(
    'const FS3 = `uniform float u;',
    '#define LONG(a) \\',
    '    ((a) * 2.0)',
    '  float x;  // after',
    '    void main() {}`;',
    'return FS3;'), glsl: true },
  { name: 'script guards, umlauts and emoji', src: L(
    "const s = '<\\/script>', r = /<\\/script/i, t = `<\\/script>`;",
    "const größe = 'Größe — ✨ 🌍'; // Kommentar mit Umlauten äöü",
    "const ü = { 'ß': 1 };   /* ✨ */",
    "return [s, r.test('</script'), t, größe + ü['ß']];") },
  { name: 'numbers', src: L(
    'return [1e-5, .5, 0x1F, 1_000n.toString(), 2..toString(), 1.5e+3 / 2, 0b101 / 5];') },
  { name: 'classes, private fields, spread, optional chaining', src: L(
    'class A {',
    '  #x = 6;                 // private',
    '  static re = /a\\/b/;',
    '  get x() { return this.#x / 2; }',
    '}',
    'const arr = [...[4, 2]], b = arr?.[0] / 2, c = arr?.length ? 1 : 0;',
    'return [new A().x, A.re.source, b, c];') },
  { name: 'HTML-like comments of a classic script', src: L(
    'let x = 1;',
    'x = 2; <!-- the rest of this line is a comment',
    '  --> and this one too',
    'return x;') },
  { name: 'comment-only lines keep the line count', src: L(
    '// one',
    '',
    '  /** two',
    '   *  three */',
    'return 1; // four'),
    want: L('', '', '', '', 'return 1;') },
];
for (const S of SAMPLES) {
  let out;
  try { out = Strip.js(S.src); } catch (e) { check(false, S.name + ': strips', e.message); continue; }
  const problems = [];
  try { new vm.Script('(function () {\n' + out + '\n})'); } catch (e) { problems.push('does not parse: ' + e.message); }
  const a = run(S.src), b = run(out);
  if (a !== b && !S.glsl) problems.push(`value ${a.slice(0, 120)} → ${b.slice(0, 120)}`);   // (GLSL: compared below, after GLSL normalisation)
  if (lines(out) !== lines(S.src)) problems.push(`lines ${lines(S.src)} → ${lines(out)}`);
  let again = null; try { again = Strip.js(out); } catch (e) { again = 'THROWS ' + e.message; }
  if (again !== out) problems.push('not idempotent');
  if (S.want !== undefined && out !== S.want) problems.push('text ' + JSON.stringify(out).slice(0, 300));
  if (S.glsl) {
    const v0 = vm.runInNewContext('(function () {\n' + S.src + '\n})()'), v1 = vm.runInNewContext('(function () {\n' + out + '\n})()');
    if (glslNorm(v0) !== glslNorm(v1)) problems.push('GLSL differs: ' + JSON.stringify(glslNorm(v1)).slice(0, 200));
    if (v1.length >= v0.length) problems.push('the GLSL did not shrink');
  }
  check(!problems.length, S.name, problems.length ? problems.join(' · ') : out.length + ' of ' + S.src.length + ' chars');
}
// the GLSL sample in detail
{
  const out = Strip.js(SAMPLES.find(s => s.name === 'GLSL in a template literal').src);
  check(!/a whole comment line|the precision|a function|\/\* inline \*\//.test(out) && /^precision highp float;$/m.test(out) && /^#define K 2\.0$/m.test(out), 'GLSL: comments and indentation gone, the directives at the line start');
  check(/\/\/ runs into the interpolation \$\{'\\n'\}float g = 2\.0;/.test(out) && /\/\/ an escape: \\n float z = 1\.0;/.test(out), 'GLSL: a comment that runs into ${…} or holds an escape stays (the code after it is alive)');
  const html = Strip.js(SAMPLES.find(s => s.name === 'an HTML template with a URL stays as it is').src);
  check(html.includes('    <a href="https://r9.example/x">// ${name} </a>   \n      <!-- keep -->\n'), 'an HTML template: byte for byte (indentation, //, trailing spaces)');
}
// acorn over the samples
if (acorn) {
  const bad = [];
  for (const S of SAMPLES) { if (/<!--/.test(S.src)) continue; let d; try { d = sameTokens(S.src, Strip.js(S.src), S.glsl ? new Set(tokens(S.src).filter(t => t.k === 'template').map(t => t.start)) : null); } catch (e) { d = 'acorn: ' + e.message; } if (d) bad.push(S.name + ': ' + d); }
  check(!bad.length, 'acorn: the same tokens on the same lines in every sample', bad.length ? bad.join(' · ') : SAMPLES.length + ' samples');
} else console.log('  (acorn not found: the token comparison is skipped)');

// ============================================================================ (b)
section('(b) every source file');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const files = walk(path.join(ROOT, 'src')).filter(f => f.endsWith('.js')).sort();
{
  const bad = { parse: [], idem: [], lines: [], tok: [], strip: [] };
  let before = 0, after = 0, glslN = 0, tokChecked = 0;
  for (const f of files) {
    const rel = path.relative(ROOT, f), src = fs.readFileSync(f, 'utf8');
    let out, info;
    try { info = {}; out = Strip.js(src, { info }); } catch (e) { bad.strip.push(rel + ': ' + e.message); continue; }
    before += Buffer.byteLength(src); after += Buffer.byteLength(out); glslN += info.glsl || 0;
    try { new vm.Script(out, { filename: rel }); } catch (e) { bad.parse.push(rel + ': ' + e.message); }
    if (Strip.js(out) !== out) bad.idem.push(rel);
    if (lines(out) !== lines(src)) bad.lines.push(`${rel} ${lines(src)} → ${lines(out)}`);
    if (acorn) { let d; try { d = sameTokens(src, out, new Set(info.glslAt || [])); } catch (e) { d = 'acorn: ' + e.message; } if (d) bad.tok.push(rel + ': ' + d); else tokChecked++; }
  }
  check(!bad.strip.length, `all ${files.length} files strip`, bad.strip.slice(0, 3).join(' · ') || undefined);
  check(!bad.parse.length, 'every stripped file parses', bad.parse.slice(0, 3).join(' · ') || undefined);
  check(!bad.idem.length, 'stripping twice changes nothing', bad.idem.slice(0, 5).join(' · ') || undefined);
  check(!bad.lines.length, 'every file keeps its line count (the stack traces of the player page match the debug page)', bad.lines.slice(0, 3).join(' · ') || undefined);
  if (acorn) check(!bad.tok.length, `acorn: the same tokens on the same lines in ${tokChecked} of ${files.length} files (${glslN} GLSL templates compared after GLSL normalisation)`, bad.tok.slice(0, 3).join(' · ') || undefined);
  check(glslN >= 60, `GLSL templates found and stripped: ${glslN}`);
  console.log(`  sources: ${(before / 1e6).toFixed(2)} MB → ${(after / 1e6).toFixed(2)} MB (−${((1 - after / before) * 100).toFixed(1)} %) · ${secs()}`);
}

// ============================================================================ (c)
section('(c) the built pages');
const DIST = path.join(ROOT, 'dist');
const scriptsOf = (html) => [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)].filter(m => !/\bsrc\s*=/.test(m[1]) && (!/\btype\s*=/.test(m[1]) || /text\/js-worker|javascript/.test(m[1]))).map(m => m[2]);
{
  const tb = Date.now();
  let built = true;
  try { cp.execFileSync(process.execPath, ['build.js'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { built = false; check(false, 'node build.js', String(e.stderr || e.message).slice(0, 400)); }
  const buildS = (Date.now() - tb) / 1000;
  const has = (f) => fs.existsSync(path.join(DIST, f));
  check(built && has('index.debug.html'), `node build.js writes dist/index.debug.html beside the player pages (${buildS.toFixed(1)} s)`);
  if (built && has('index.debug.html')) {
    const dbg = fs.readFileSync(path.join(DIST, 'index.debug.html'), 'utf8'), idx = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
    check(Strip.page(dbg) === idx, 'the player page is the debug page stripped — the same page otherwise');
    check(lines(dbg) === lines(idx), `the same line count (${lines(idx)}): an error's line in the player page is the line in the debug page`);
    check(/\/\/ /.test(scriptsOf(dbg).join('\n')) && !/^\s*\/\/ /m.test(scriptsOf(idx).join('\n')), 'the debug page keeps the comments, the player page has no comment line left');
    const size = fs.statSync(path.join(DIST, 'index.html')).size, dsize = fs.statSync(path.join(DIST, 'index.debug.html')).size;
    check(size <= 9000000, `dist/index.html ${(size / 1e6).toFixed(2)} MB ≤ 9.0 MB (debug ${(dsize / 1e6).toFixed(2)} MB, −${((1 - size / dsize) * 100).toFixed(1)} %)`);
    for (const f of ['index.html', 'artifact.html', 'studio.html', 'studio_artifact.html']) {
      const html = fs.readFileSync(path.join(DIST, f), 'utf8'), S = scriptsOf(html), errs = [];
      S.forEach((s, i) => { try { new vm.Script(s.replace(/<\\\/script/gi, '<\\/script'), { filename: f + '#' + i }); } catch (e) { errs.push(i + ': ' + e.message); } });
      check(S.length >= 2 && !errs.length, `${f}: all ${S.length} scripts parse (${(fs.statSync(path.join(DIST, f)).size / 1e6).toFixed(2)} MB)`, errs.slice(0, 2).join(' · ') || undefined);
    }
    const w = /<script type="text\/js-worker" id="worker-src">([\s\S]*?)<\/script>/.exec(idx);
    check(!!w && w[1].includes('VR.TEX_MODS = function (VR) {') && w[1].includes("m.type === 'texhi'"), 'the worker bundle keeps what tex_hi.js reads (VR.TEX_MODS, the texhi answer)');
    check(/VR\.TEX_SRC_HASH = "[0-9a-f]{16}"/.test(idx) && (/VR\.TEX_SRC_HASH = "([0-9a-f]{16})"/.exec(idx) || [])[1] === (/VR\.TEX_SRC_HASH = "([0-9a-f]{16})"/.exec(dbg) || [])[1], 'the texture hash is the same in both pages (taken from the sources)');
  }
}
if (process.env.QUICK) { console.log(`\n(QUICK: (d)–(e) skipped) ${secs()}`); console.log(fails ? 'FAILED ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0); }

// ============================================================================ (d) + (e): a stripped copy of the sources
const COPY = path.join(ROOT, '.tmp_tests', 'strip_copy_' + process.pid);
fs.rmSync(COPY, { recursive: true, force: true });
try {
  for (const f of walk(path.join(ROOT, 'src'))) { const to = path.join(COPY, path.relative(ROOT, f)); fs.mkdirSync(path.dirname(to), { recursive: true }); if (f.endsWith('.js')) fs.writeFileSync(to, Strip.js(fs.readFileSync(f, 'utf8'))); else fs.copyFileSync(f, to); }
  for (const t of ['load_shared.js', 'dom_stub.js', 'vl_programs.js', 'gen_same.js', 'mesh_same.js', 'light_same.js', 'id_snapshot.js', 'id_snapshot.json']) { fs.mkdirSync(path.join(COPY, 'test'), { recursive: true }); fs.copyFileSync(path.join(ROOT, 'test', t), path.join(COPY, 'test', t)); }

  section('(d) the shader programs from the stripped sources');
  const dump = (root, preset) => { const f = path.join(COPY, 'dump.json'); cp.execFileSync(process.execPath, [path.join(ROOT, 'test', 'vl_programs.js'), '--dump', root, preset, f], { stdio: ['ignore', 'ignore', 'pipe'] }); const a = JSON.parse(fs.readFileSync(f, 'utf8')); fs.rmSync(f); return a; };
  // vl_programs.js's preprocessor (the text the compiler sees with its defines applied)
  const pre = (src) => {
    const D = new Set(), out = [], stack = [];
    const active = () => stack.every(s => s.on);
    const ev = (e) => { const j = e.replace(/defined\s*\(\s*(\w+)\s*\)/g, (m, n) => (D.has(n) ? '1' : '0')).replace(/\b[A-Z_][A-Z_0-9]*\b/g, (n) => (D.has(n) ? '1' : '0')); if (!/^[01\s()!&|]*$/.test(j)) throw new Error('#if ' + e); return !!Function('return (' + j + ')')(); };
    for (const line of src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n')) {
      const t = line.trim(); let m;
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
    return out.join('\n');
  };
  for (const preset of ['potato', 'high']) {
    let a = null, b = null;
    try { a = dump(ROOT, preset); b = dump(COPY, preset); } catch (e) { check(false, preset + ': the programs dump', String(e.stderr || e.message).slice(0, 300)); continue; }
    const diffPre = [], diffNorm = []; let shrunk = 0, bytesA = 0, bytesB = 0;
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      if (pre(a[i] || '') !== pre(b[i] || '')) diffPre.push(i);
      if (glslNorm(a[i] || '') !== glslNorm(b[i] || '')) diffNorm.push(i);
      bytesA += (a[i] || '').length; bytesB += (b[i] || '').length; if ((b[i] || '').length < (a[i] || '').length) shrunk++;
    }
    check(a.length > 20 && a.length === b.length, `${preset}: as many shader sources from the stripped copy (${b.length}) as from the sources (${a.length})`);
    check(!diffPre.length && !diffNorm.length, `${preset}: every one the same after preprocessing and line for line after comments and layout`, diffPre.length || diffNorm.length ? 'differ: ' + [...new Set(diffPre.concat(diffNorm))].slice(0, 5).join(', ') : `${shrunk} of ${b.length} shorter · ${(bytesA / 1e3).toFixed(0)} → ${(bytesB / 1e3).toFixed(0)} KB of GLSL`);
  }
  console.log('  ' + secs());

  section('(e) the stripped code behaves the same');
  const tests = ['id_snapshot.js', 'mesh_same.js', 'light_same.js'].concat(process.env.FULL ? ['gen_same.js'] : []);
  for (const t of tests) {
    let out = '', ok = false;
    try { out = cp.execFileSync(process.execPath, [path.join(COPY, 'test', t)], { cwd: COPY, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 26, timeout: 900000 }).toString(); ok = /^ALL OK$/m.test(out); } catch (e) { out = String(e.stdout || '') + String(e.stderr || e.message); }
    check(ok, `${t} on the stripped sources: ${ok ? 'ALL OK' : 'not OK'}`, ok ? undefined : out.split('\n').filter(l => /FAIL|✗|Error/.test(l)).slice(0, 3).join(' · ').slice(0, 300));
  }
  if (!process.env.FULL) console.log('  (gen_same.js on the stripped copy: FULL=1)');
  const forge = (f) => JSON.parse(cp.execFileSync(process.execPath, [__filename, '--forge', path.join(DIST, f)], { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 26, timeout: 600000 }).toString().trim().split('\n').pop());
  try {
    const a = forge('index.debug.html'), b = forge('index.html');
    check(a.type === 'textures' && a.digest === b.digest && a.layers === b.layers, `the stripped worker bundle forges the same textures as the debug bundle (${a.layers} layers, ${b.digest})`, a.digest !== b.digest ? a.digest + ' vs ' + b.digest : undefined);
  } catch (e) { check(false, 'the texture forge of both pages', String(e.stderr || e.message).slice(0, 300)); }
  console.log('  ' + secs());
} finally {
  fs.rmSync(COPY, { recursive: true, force: true });
}

console.log(`\n${fails ? 'FAILED ' + fails : 'ALL OK'} (${secs()})`);
process.exit(fails ? 1 : 0);
