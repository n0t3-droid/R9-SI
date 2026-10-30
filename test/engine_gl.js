// e-engine (docs/superpowers/plans/2026-10-30-e-engine.md) · the main thread's waits for the GPU, with a fake WebGL:
//  1. GL.deferred (renderer.buildPrograms): a batch of programs is compiled and linked with no status query between
//     them — the queries (which wait for the compiler) come at a program's first use (.p / .u), the uniforms are the same,
//     the ready hooks (the UBO binding) run before that first use returns, a failed compile throws there with its log;
//     outside a batch GL.program is as before (its status at once)
//  2. the hero textures (renderer.queueTexHi): ~9 MB through the world's upload queue within each frame's bytes, the old
//     set drawn until the new arrays are complete; a newer set (uploadTexHi) drops the queued one; a world torn down
//     (clear) finishes it at once
//   bash test/wt_run.sh engine_gl.js
const V = require('./load_shared.js');
global.window = undefined;
require('../src/main/gl.js'); require('../src/main/shaders.js'); require('../src/main/renderer.js'); require('../src/main/tex_hi.js');
const S = V.Stream;
let fail = 0;
const check = (ok, what, info) => { console.log((ok ? 'OK   ' : 'FAIL ') + what + (info !== undefined ? '  (' + info + ')' : '')); if (!ok) fail++; };

// ---- 1. the program batch
{
  const log = [];
  let id = 0;
  const bad = new Set();
  const gl = {
    VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ACTIVE_UNIFORMS: 5,
    createShader: (t) => ({ sh: ++id, t }), shaderSource: (s, src) => { s.src = src; }, compileShader: (s) => log.push('compile'),
    getShaderParameter: (s) => { log.push('ask'); return !bad.has(s.src.includes('BROKEN') ? 'x' : 'y') && !s.src.includes('BROKEN'); },
    getShaderInfoLog: () => 'ERROR: 0:1: broken', createProgram: () => ({ pr: ++id, sh: [] }), attachShader: (p, s) => p.sh.push(s),
    linkProgram: () => log.push('link'), getProgramParameter: (p, k) => { log.push('ask'); if (k === 4) return !p.sh.some(s => s.src.includes('BROKEN')); return 2; },
    getProgramInfoLog: () => 'link log', getActiveUniform: (p, i) => ({ name: i ? 'u_b[0]' : 'u_a' }), getUniformLocation: (p, n) => 'loc:' + n,
  };
  V.GL.gl = gl;
  const quiet = console.error; console.error = () => {};
  // before: one at a time
  const p0 = V.GL.program('void main(){}', 'void main(){}', 'one');
  check(log.join(' ') === 'compile ask compile ask link ask ask' && p0.u.u_a === 'loc:u_a' && p0.u.u_b === 'loc:u_b[0]', 'outside a batch: compiled and asked at once, as before', log.join(' '));
  // a batch of three: no query until a program is used
  log.length = 0; V.GL.deferred = true;
  const ps = ['a', 'b', 'c'].map(n => V.GL.program('void main(){}', 'void main(){}', n));
  const hookSeen = [];
  V.GL.onReady(ps[0], (q) => hookSeen.push(q.name));
  V.GL.deferred = false;
  check(!log.includes('ask') && log.filter(x => x === 'link').length === 3, 'a batch of three: compiled and linked, no status asked', log.join(' '));
  check(hookSeen.length === 0, 'the ready hook waits for the program\'s first use');
  const u = ps[0].u;
  check(log.includes('ask') && u.u_a === 'loc:u_a' && u.u_b === 'loc:u_b[0]' && hookSeen.join() === 'a', 'at its first use: the status, the same uniforms, the hook ran', hookSeen.join());
  const asks = log.filter(x => x === 'ask').length; void ps[0].p; void ps[0].u;
  check(log.filter(x => x === 'ask').length === asks && typeof ps[0].p === 'object', 'asked once only; .p is the program');
  let hb = 0; V.GL.onReady(ps[0], () => hb++); check(hb === 1, 'a hook on a ready program runs at once');
  V.GL.deferred = true; const broken = V.GL.program('void main(){}', 'BROKEN', 'broken'); V.GL.deferred = false;
  let msg = ''; try { void broken.u; } catch (e) { msg = e.message; }
  check(/Shader compile failed: broken\.fs: ERROR: 0:1: broken/.test(msg), 'a failed compile throws at the first use with its log', msg);
  console.error = quiet;
  // the renderer's batch: buildPrograms sets GL.deferred around its body and leaves it as it was
  const R = Object.create(V.Renderer.prototype); let during = null;
  R.buildProgramsNow = function () { during = V.GL.deferred; };
  R.buildPrograms();
  check(during === true && V.GL.deferred === false, 'renderer.buildPrograms: deferred during its batch, restored after');
}

// ---- 2. the hero textures through the upload queue
{
  let texId = 0, frameBytes = 0; const calls = [];
  const gl = { TEXTURE_2D_ARRAY: 0x8c1a, TEXTURE_2D: 0x0de1, RGBA8: 0x8058, SRGB8_ALPHA8: 0x8c43, RGBA: 0x1908, RED: 0x1903, UNSIGNED_BYTE: 0x1401, NEAREST_MIPMAP_LINEAR: 0x2702, NEAREST: 0x2600, REPEAT: 0x2901, TEXTURE_MIN_FILTER: 0x2801, TEXTURE_MAG_FILTER: 0x2800, TEXTURE_WRAP_S: 0x2802, TEXTURE_WRAP_T: 0x2803,
    createTexture: () => ({ tex: ++texId }), deleteTexture: (t) => calls.push('del ' + (t && t.tex)), bindTexture() {}, texParameteri() {}, texParameterf() {}, texSubImage2D: () => calls.push('map'),
    texStorage3D: (t, levels, fmt, w, h, d) => calls.push('storage ' + levels + ' ' + w + ' ' + d),
    texSubImage3D: (t, lv, x, y, z, w, h, d, f, ty, data, off) => { frameBytes += w * h * d * 4; if ((off || 0) !== z * w * h * 4 || data.length < (off || 0) + w * h * d * 4) calls.push('BAD ' + lv + ' ' + z); } };
  const R = V.R, L = R.texNames.length, NL = 80;
  const names = R.texNames.slice(0, NL);
  const levels = () => { const o = []; for (let l = 0; l < 7; l++) o.push(new Uint8Array(((64 >> l) ** 2) * 4 * NL)); return o; };
  const tex = { type: 'texhi', size: 64, levels: 7, layers: NL, names, albedo: levels(), material: levels(), avgColor: new Uint8Array(4 * NL) };
  const mk = () => { const r = Object.create(V.Renderer.prototype); Object.assign(r, { gl, layers: L, texHiMap: { tex: 'map' }, texHiAlb: { tex: 'oldA' }, texHiMat: { tex: 'oldM' }, texHiN: 0, anisoLevel: 0 }); return r; };
  const r = mk(), sch = new S.UploadScheduler({ msPerByte: 1e-6 });
  check(typeof r.queueTexHi === 'function', 'renderer.queueTexHi exists');
  let done = 0, f = 0, worst = 0, oldUntil = 0;
  const okQ = r.queueTexHi && r.queueTexHi(tex, sch, () => done++);
  while (okQ && sch.size && f < 200) { frameBytes = 0; sch.drain(0.3); worst = Math.max(worst, frameBytes); f++; if (r.texHiAlb.tex === 'oldA') oldUntil = f; }
  const total = 2 * NL * 4 * [0, 1, 2, 3, 4, 5, 6].reduce((a, l) => a + (64 >> l) ** 2, 0);
  check(okQ && done === 1 && worst <= 300000 && f >= 10, `the set (${(total / 1048576).toFixed(1)} MB) goes up within each frame's 300 KB`, `${f} frames, worst ${worst} bytes`);
  check(oldUntil >= f - 1 && r.texHiAlb.tex !== 'oldA' && r.texHiN === NL && calls.includes('del oldA') && calls.includes('del oldM') && calls.includes('map'), 'the old set draws until the new arrays are complete, then they swap', `old until frame ${oldUntil} of ${f}`);
  check(!calls.some(c => c.startsWith('BAD')) && calls.filter(c => c === 'storage 7 64 ' + NL).length === 2, 'every slice lands at its layers, full mip chains in two new arrays');
  // a newer set at once (uploadTexHi) drops the queued one
  const r2 = mk(), s2 = new S.UploadScheduler({ msPerByte: 1e-6 }); let d2 = 0;
  r2.queueTexHi(tex, s2, () => d2++); s2.drain(0.3);
  const queuedId = texId;
  r2.uploadTexHi(tex);
  let k = 0; while (s2.size && k < 200) { s2.drain(0.3); k++; }
  check(d2 === 0 && calls.includes('del ' + queuedId) && r2.texHiAlb.tex > queuedId, 'a newer set dropped the queued one (its arrays deleted)');
  // the world torn down before the set is complete: applied at once
  const r3 = mk(), s3 = new S.UploadScheduler({ msPerByte: 1e-6 }); let d3 = 0;
  r3.queueTexHi(tex, s3, () => d3++); s3.drain(0.3); s3.clear();
  check(d3 === 1 && r3.texHiAlb.tex !== 'oldA' && r3.texHiN === NL, 'a set dropped with its world is finished at once');
}
console.log(fail ? `FAILED ${fail}` : 'ALL OK');
process.exit(fail ? 1 : 0);
