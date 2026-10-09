// F-Far · the worker's `form` job (src/worker/worker_main.js), in node with a fake `self`: a form tile is answered with
// its vertex and index buffers transferred; a tile over Nova Haven first waits for the town's plan, the temple and the
// site cells a slice at a time ({type:'waiting'} — the pool keeps its slot) and then answers the same bytes VR.Far.form
// makes directly; a tile over the open sea answers once its site cells are known; another dimension answers empty.
//   bash test/wt_run.sh far_worker.js
const V = require('./load_shared.js');
const posted = [];
global.self = { postMessage: (m, tr) => posted.push([m, tr || []]) };
require('../src/worker/worker_main.js');
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
const answer = async (id, maxMs) => { const t0 = Date.now(); for (;;) { const a = posted.find(p => p[0].id === id && p[0].type !== 'waiting'); if (a) return a; if (Date.now() - t0 > maxMs) return null; await new Promise(r => setTimeout(r, 5)); } };
(async () => {
  self.onmessage({ data: { type: 'init', seed: 1, opts: { vgen: 6 } } });
  check(posted.length === 1 && posted[0][0].type === 'ready', 'init answers ready');
  // the open sea first
  posted.length = 0;
  self.onmessage({ data: { type: 'form', id: 11, dim: 'overworld', tx: 12, tz: 8, cell: 4 } });
  const sea = await answer(11, 20000);
  check(sea && sea[0].type === 'form' && sea[0].count > 0, 'the open sea: answered (after the site cells around it, which say no town reaches it)', sea && sea[0].count / 3 + ' triangles, ' + posted.filter(p => p[0].id === 11 && p[0].type === 'waiting').length + ' slices');
  check(sea && sea[1].includes(sea[0].verts) && sea[1].includes(sea[0].idx.buffer) && sea[1].length === 2, 'its vertex and index buffers are transferred');
  // Nova Haven: the town's plan, the temple and the site cells come first, a slice at a time
  posted.length = 0;
  const t0 = Date.now();
  self.onmessage({ data: { type: 'form', id: 12, dim: 'overworld', tx: 0, tz: -3, cell: 2 } });
  const city = await answer(12, 120000);
  const waits = posted.filter(p => p[0].id === 12 && p[0].type === 'waiting').length;
  check(city && city[0].type === 'form' && city[0].count > 0, 'Nova Haven: answered after waiting for its plan', city ? (Date.now() - t0) + ' ms, ' + waits + ' slices' : 'no answer');
  check(waits > 0, 'the job waited ({type:\'waiting\'}) instead of holding the worker', waits);
  const direct = V.Far.form(V.makeGen('overworld', 1, { vgen: 6 }), { tx: 0, tz: -3, cell: 2 });
  const same = city && Buffer.compare(Buffer.from(city[0].verts), Buffer.from(direct.verts)) === 0 && city[0].count === direct.count;
  check(same, 'the worker\'s bytes are VR.Far.form\'s (the slices change nothing)', direct.verts.byteLength + ' bytes');
  check(city && city[0].minY < city[0].maxY && city[0].bx1 > city[0].bx0, 'the answer carries the bounds (the frustum test needs them)');
  // another dimension: no forms there
  posted.length = 0;
  self.onmessage({ data: { type: 'form', id: 13, dim: 'underforge', tx: 0, tz: 0, cell: 2 } });
  const und = await answer(13, 5000);
  check(und && und[0].type === 'form' && und[0].empty === true, 'another dimension: an empty answer');
  console.log(fails ? 'FAILED ' + fails : 'ALL OK');
  process.exit(fails ? 1 : 0);
})();
