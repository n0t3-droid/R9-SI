// Indexed quads (Viereck-Index): the section meshes stay quads (4 vertices) and draw through ONE shared index buffer
// (0 1 2, 0 2 3 per quad) instead of being expanded into triangle lists (6 vertices). Measured on the owner's AMD APU:
// Ultra's terrain is bound by vertices, not pixels (resolution ×0.8 −2 ms of 28, view distance −4 chunks −7 ms);
// a vertex is shaded once per quad corner instead of 1.5×, the meshes need a third less memory and upload.
//   a  the worker answers a mesh job with quads:true in quads (4 vertices a quad, the mesher's own stream), flagged q
//   b  without it the triangle lists as before (6 vertices a quad) — old saves of the job, ships, the fallback
//   c  the shared index pattern: quad k → 4k 4k+1 4k+2, 4k 4k+2 4k+3 — the same triangles as the old expansion
//   d  drawSections: a quad mesh goes through multiDrawElements (byte offset off·6, count ·1.5), a triangle mesh through
//      multiDrawArrays; both kinds in one list (one arena) each get their own batch; the triangle count is right
//   e  the single-draw path (no multi-draw): drawElements / drawArrays per section
const V = require('./load_shared.js');
const posted = [];
global.self = { postMessage: (m, tr) => posted.push([m, tr || []]) };
global.performance = global.performance || { now: () => Date.now() };
require('../src/worker/worker_main.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
self.onmessage({ data: { type: 'init', seed: 12345, opts: { vgen: 5 } } });
// a plain section: a stone floor with a step (the mesher's pad layout, as the world sends it)
const PAD = V.MESH_PAD, PS = V.MESH_PS, PSS = PS * PS, st = V.R.byName.stone.defaultState;
const blocks = new Uint16Array(PSS * PS), light = new Uint16Array(PSS * PS).fill(0xf000), tint = () => new Uint16Array(PSS);
for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) { blocks[(PAD + 2) * PSS + (z + PAD) * PS + x + PAD] = st; if (x < 5) blocks[(PAD + 3) * PSS + (z + PAD) * PS + x + PAD] = st; }
const job = (q) => ({ type: 'mesh', id: 5, key: 1, ver: 1, sy: 4, ox: 0, oz: 0, blocks: blocks.slice(), light: light.slice(), grass: tint(), foliage: tint(), water: tint(), smooth: false, fancyLeaves: true, vxLod: true, quads: q });
const ref = V.meshSection(job(false));
posted.length = 0; self.onmessage({ data: job(true) }); const rq = posted[0][0];
posted.length = 0; self.onmessage({ data: job(false) }); const rt = posted[0][0];
check(rq.q === true && rq.opaque.length === ref.opaque.length && rq.opaque.length > 0, 'a  quads: ' + (rq.opaque.length / 8) + ' vertices = the mesher\'s ' + (ref.opaque.length / 8) + ', flagged q');
check(!rt.q && rt.opaque.length === ref.opaque.length / 4 * 6, 'b  without: triangle lists, 6 vertices a quad (' + rt.opaque.length / 8 + ')');
// c
for (const f of ['gl', 'renderer']) { try { require('../src/main/' + f + '.js'); } catch (e) { console.log('     (load ' + f + ': ' + e.message + ')'); } }
const R = V.Renderer;
const pat = R && R.quadIndices ? R.quadIndices(3) : null;
check(pat && pat.length === 18 && [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7, 8, 9, 10, 8, 10, 11].every((v, i) => pat[i] === v), 'c  the pattern 0 1 2, 0 2 3 per quad');
const tris = V.quadsToTris(rq.opaque);
let sameTris = !!pat; if (pat) { const P = R.quadIndices(rq.opaque.length / 32); for (let i = 0; i < P.length && sameTris; i++) for (let k = 0; k < 8; k++) if (tris[i * 8 + k] !== rq.opaque[P[i] * 8 + k]) { sameTris = false; break; } }
check(sameTris, 'c  indexed quads draw the very triangles of the old expansion');
// d / e: drawSections against a recording gl
function rec(multi) {
  const calls = [];
  const gl = new Proxy({ TRIANGLES: 4, UNSIGNED_INT: 5125, UNIFORM_BUFFER: 1, ARRAY_BUFFER: 2 }, { get(t, k) { if (k in t) return t[k]; return (...a) => { calls.push([k, a]); }; } });
  const cp = (a) => a.map(x => (ArrayBuffer.isView(x) ? Array.from(x) : x));   // (the renderer reuses its arrays: a copy per call)
  const md = { multiDrawArraysWEBGL: (...a) => calls.push(['mdA', cp(a)]), multiDrawElementsWEBGL: (...a) => calls.push(['mdE', cp(a)]) };
  const VRGL = V.GL; VRGL.ext = VRGL.ext || {}; const old = VRGL.ext.multiDraw; VRGL.ext.multiDraw = md;
  const r = Object.create(R.prototype);
  Object.assign(r, { gl, multi, cam: {}, stats: { draws: 0, tris: 0 }, firsts: new Int32Array(512), counts: new Int32Array(512), origins: new Float32Array(2048), ubo: {}, _qib: {}, arenas: [] });
  const arena = { vao: {} };
  const sec = (off, count, q) => ({ ox: 0, oy: 0, oz: 0, fade: 1, mesh: [{ arena, off, count, q }] });
  const list = [sec(96, 600, true), sec(192, 400, true), sec(960, 300, false), sec(1056, 800, true)];
  const prog = { u: { u_origin: {}, u_fade: {} } };
  r.drawSections(list, 0, prog, [0, 0, 0], null, false);
  VRGL.ext.multiDraw = old;
  return { calls, stats: r.stats };
}
if (R && R.quadIndices) {
  const m = rec(true), md = m.calls.filter(c => c[0] === 'mdA' || c[0] === 'mdE');
  const e1 = md[0], a1 = md[1], e2 = md[2];
  check(md.length === 3 && e1[0] === 'mdE' && a1[0] === 'mdA' && e2[0] === 'mdE', 'd  three batches: quads, triangles, quads (' + md.map(c => c[0]).join(' ') + ')');
  check(e1 && e1[1][6] === 2 && e1[1][1][0] === 900 && e1[1][1][1] === 600 && e1[1][4][0] === 96 * 6 && e1[1][4][1] === 192 * 6 && e1[1][3] === 5125, 'd  elements: counts ·1.5, byte offsets off·6, 32-bit indices');
  check(a1 && a1[1][1][0] === 960 && a1[1][3][0] === 300, 'd  arrays: first and count as before');
  check(m.stats.tris === 600 / 2 + 400 / 2 + 300 / 3 + 800 / 2, 'd  triangles counted per kind (' + m.stats.tris + ')');
  const s = rec(false), de = s.calls.filter(c => c[0] === 'drawElements'), da = s.calls.filter(c => c[0] === 'drawArrays');
  check(de.length === 3 && da.length === 1 && de[0][1][1] === 900 && de[0][1][3] === 96 * 6 && da[0][1][1] === 960, 'e  single draws: drawElements ×3, drawArrays ×1');
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
