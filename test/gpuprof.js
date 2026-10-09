// GPU-Profil (src/main/gpuprof.js): the GPU time per render pass from EXT_disjoint_timer_query_webgl2, no DOM, a fake gl.
//  (a) off (the F3 overlay closed): one query spans the whole frame, as before — mark() adds nothing
//  (b) on: every mark() ends the previous pass's query and begins the next; end() closes the frame
//  (c) results: a frame's pass times are read back oldest first, once available, and smoothed (EMA 0.1); total = the sum
//  (d) never stall: with four frames still in flight the frame records nothing (and the result reader keeps going)
//  (e) a disjoint frame (the GPU clock jumped) is thrown away
//  (f) line(): the passes by cost, the cheap ones folded into 'rest', formatted for the F3 overlay
//  (g) no extension: everything is a no-op, total stays undefined
//   bash test/wt_run.sh gpuprof.js
require('./dom_stub.js');
globalThis.VR = {};
require('../src/main/gpuprof.js');
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
const GP = VR.GpuProf;
if (!GP) { console.log('VR.GpuProf missing'); console.log('FAILED 1'); process.exit(1); }

// a fake WebGL2 context with the timer extension: a query is 'available' `lag` begin() calls after its endQuery
function fakeGL(opts) {
  const o = Object.assign({ lag: 1, disjoint: false, ext: true }, opts || {});
  const EXT = { TIME_ELAPSED_EXT: 0x88BF, GPU_DISJOINT_EXT: 0x8FBB };
  const gl = {
    QUERY_RESULT: 0x8866, QUERY_RESULT_AVAILABLE: 0x8867,
    tick: 0, active: null, queries: [], log: [], results: {},
    getExtension(n) { return n === 'EXT_disjoint_timer_query_webgl2' && o.ext ? EXT : null; },
    createQuery() { const q = { id: this.queries.length, endedAt: -1, ns: 0 }; this.queries.push(q); return q; },
    beginQuery(t, q) { if (this.active) throw new Error('a query is already active'); this.active = q; this.log.push('begin ' + q.id); },
    endQuery(t) { if (!this.active) throw new Error('no active query'); const q = this.active; q.endedAt = this.tick; q.ns = (this.results[this.log.filter((l) => l.startsWith('begin')).length - 1] || 1) * 1e6; this.active = null; this.log.push('end ' + q.id); },
    getQueryParameter(q, p) { if (p === this.QUERY_RESULT_AVAILABLE) return q.endedAt >= 0 && this.tick - q.endedAt >= o.lag; return q.ns; },
    getParameter(p) { return p === EXT.GPU_DISJOINT_EXT ? o.disjoint : 0; },
  };
  return gl;
}
// one frame with the given passes; `ms` are the pass times the fake GPU reports, in begin order
function frame(prof, gl, passes, ms, detail) {
  gl.tick++;
  const base = gl.log.filter((l) => l.startsWith('begin')).length;
  (ms || []).forEach((v, i) => { gl.results[base + i] = v; });
  prof.begin(detail);
  for (const p of passes) prof.mark(p);
  prof.end();
}
const PASSES = ['shadow', 'sky', 'opaque', 'water', 'post'];

console.log('a · off: one query for the whole frame');
{
  const gl = fakeGL(); const prof = new GP(gl);
  frame(prof, gl, PASSES, [12], false);
  check(gl.log.join(',') === 'begin 0,end 0', 'one begin and one end around the frame', gl.log.join(','));
  frame(prof, gl, PASSES, [12], false);
  frame(prof, gl, PASSES, [12], false);
  check(prof.total !== undefined && Math.abs(prof.total - 12) < 1e-9, 'the frame time arrives (12 ms)', prof.total);
  check(!prof.detail && Object.keys(prof.times).length === 0, 'no per-pass times while off');
}

console.log('b · on: one query per pass');
{
  const gl = fakeGL(); const prof = new GP(gl);
  frame(prof, gl, PASSES, [1, 0.5, 6, 1.5, 3], true);
  const begins = gl.log.filter((l) => l.startsWith('begin')).length, ends = gl.log.filter((l) => l.startsWith('end')).length;
  check(begins === 5 && ends === 5, 'five passes: five queries, each ended before the next begins', gl.log.join(','));
  check(prof.detail === true, 'detail is on');
}

console.log('c · results: read back, smoothed, summed');
{
  const gl = fakeGL(); const prof = new GP(gl);
  frame(prof, gl, PASSES, [1, 0.5, 6, 1.5, 3], true);
  check(prof.total === undefined, 'nothing yet (the GPU is still on it)');
  frame(prof, gl, PASSES, [1, 0.5, 6, 1.5, 3], true);
  check(Math.abs(prof.times.opaque - 6) < 1e-9 && Math.abs(prof.times.sky - 0.5) < 1e-9, 'the first frame sets the pass times as measured', JSON.stringify(prof.times));
  check(Math.abs(prof.total - 12) < 1e-9, 'total = the sum of the passes (12 ms)', prof.total);
  // the next frames measure a bigger opaque pass: the EMA (0.1) follows slowly
  frame(prof, gl, PASSES, [1, 0.5, 16, 1.5, 3], true);
  frame(prof, gl, PASSES, [1, 0.5, 16, 1.5, 3], true);
  check(prof.times.opaque > 6.9 && prof.times.opaque < 7.1, 'EMA 0.1: 6 → 7 after one 16 ms frame', prof.times.opaque);
  check(prof.total > 12.9 && prof.total < 13.1, 'the total follows (13 ms)', prof.total);
  check(prof.frames >= 2, 'the frames read back are counted', prof.frames);
  check(prof.peak.opaque === 16 && prof.peak.sky === 0.5, 'peak: the worst frame per pass (opaque 16)', JSON.stringify(prof.peak));
  check(prof.peaks().startsWith('opaque 16.0'), 'peaks() lists the worst first', prof.peaks());
}

console.log('c2 · a switch restarts the total with the passes');
{
  const gl = fakeGL(); const prof = new GP(gl);
  frame(prof, gl, PASSES, [5], false); frame(prof, gl, PASSES, [5], false); frame(prof, gl, PASSES, [5], false);   // off: one query a frame
  check(Math.abs(prof.total - 5) < 1e-9, 'off: 5 ms frames', prof.total);
  frame(prof, gl, PASSES, [4, 4, 4, 4, 4], true);   // detail on: the total forgets the old level
  frame(prof, gl, PASSES, [4, 4, 4, 4, 4], true);
  const sum = Object.values(prof.times).reduce((a, b) => a + b, 0);
  check(prof.total !== undefined && Math.abs(prof.total - 20) < 1e-9 && Math.abs(sum - prof.total) < 1e-9, 'on: the total equals the sum of the passes from the first detail frame (20 ms)', prof.total + ' vs ' + sum);
}

console.log('d · never stall');
{
  const gl = fakeGL({ lag: 100 }); const prof = new GP(gl);   // results never arrive within the test
  for (let i = 0; i < 8; i++) frame(prof, gl, PASSES, [1, 1, 1, 1, 1], true);
  const begins = gl.log.filter((l) => l.startsWith('begin')).length;
  check(begins === 4 * 5, 'four frames in flight at most: the other four frames recorded nothing', begins);
  check(prof.total === undefined, 'no result was waited for');
  check(gl.active === null, 'no query left open');
}

console.log('e · a disjoint frame is thrown away');
{
  const gl = fakeGL(); const prof = new GP(gl);
  frame(prof, gl, PASSES, [1, 1, 1, 1, 1], true);
  frame(prof, gl, PASSES, [1, 1, 1, 1, 1], true);
  check(Math.abs(prof.total - 5) < 1e-9, 'a clean frame counts (5 ms)', prof.total);
  gl.getParameter = () => true;   // the clock jumped
  frame(prof, gl, PASSES, [9, 9, 9, 9, 9], true);
  frame(prof, gl, PASSES, [9, 9, 9, 9, 9], true);
  check(Math.abs(prof.total - 5) < 1e-9, 'the disjoint frame changed nothing', prof.total);
  check(gl.queries.length <= 20, 'queries are reused, not leaked', gl.queries.length);
}

console.log('f · the overlay line');
{
  const gl = fakeGL(); const prof = new GP(gl);
  frame(prof, gl, ['shadow', 'sky', 'opaque', 'cutout', 'props', 'horizon', 'models', 'refl', 'clouds', 'water', 'tsr', 'post'], [2, 0.3, 6, 1.2, 0.8, 0.4, 0.9, 1.5, 0.2, 1.1, 0.7, 2.5], true);
  frame(prof, gl, ['shadow'], [1], true);
  const line = prof.line();
  check(typeof line === 'string' && line.startsWith('gpu 17.6 ms'), 'starts with the total', line);
  const order = line.replace(/^gpu [\d.]+ ms/, '').split('·').map((s) => s.trim()).filter(Boolean);
  check(order[0].startsWith('opaque 6.0') && order[1].startsWith('post 2.5') && order[2].startsWith('shadow 2.0'), 'the passes by cost, biggest first', order.slice(0, 3).join(' | '));
  check(/rest [\d.]+/.test(line) && !/sky|clouds/.test(line), 'the small passes (< 0.5 ms) are folded into rest', line);
  check(line.length < 160, 'fits one overlay line', line.length);
  const off = new GP(fakeGL());
  check(off.line() === '', 'no data: an empty line');
}

console.log('g · no extension');
{
  const gl = fakeGL({ ext: false }); const prof = new GP(gl);
  frame(prof, gl, PASSES, [1, 1, 1, 1, 1], true);
  frame(prof, gl, PASSES, [1, 1, 1, 1, 1], true);
  check(gl.log.length === 0 && prof.total === undefined && prof.line() === '', 'nothing happens, total stays undefined');
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
