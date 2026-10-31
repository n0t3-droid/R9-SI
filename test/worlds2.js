// u-worlds2 · the native worlds come alive (plan docs/superpowers/plans/2026-10-31-u-worlds2.md):
//   a · the mesh scheduler never starves a section: with sections near the player re-dirtied every frame (Zinnober's
//       lava ponds), the empty sections high above the village (dirty, count 0) and a far solid one still get meshed —
//       the columns are shown (the bug: 13 of 16 sections meshed, the village never drawn)
//   b · the species' own body plans (folkmodel.js): five builds that differ from a person and from each other
//   c · the worlds' look: Ocker's plants quieter, plants by every landing, a village in the arrival's view, the
//       architecture kit per species
//   d · the culture moments (worldlife.js Culture): a moment per species, at its hour, joinable, a reward of goods
//       useful at home; the lang keys
//   bash test/wt_run.sh worlds2.js 300
require('./dom_stub.js');
const V = require('./load_shared.js');
require('../src/main/i18n.js'); require('../src/main/lang_en.js'); require('../src/main/lang_de.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const part = (name) => process.argv.length < 3 || process.argv.includes(name);

if (part('a')) {
  console.log('a · the mesh scheduler never starves a section');
  require('../src/main/world.js');
  const Wp = VR.World.prototype;
  // a fake world: 9 × 9 columns of 16 sections round the player; the sections near the player's height in the 3 × 3
  // round him are made dirty again every frame (a flow that never settles), the four top sections of every column
  // are dirty and empty (count 0), one far solid section is dirty too
  const cols = new Map();
  const mkSec = (count) => ({ dirty: false, pending: false, meshed: true, count, ver: 1, meshVer: 1 });
  for (let cz = -4; cz <= 4; cz++) for (let cx = -4; cx <= 4; cx++) {
    const sec = []; for (let sy = 0; sy < 16; sy++) sec.push(mkSec(sy < 5 ? 4096 : 0));
    for (let sy = 12; sy < 16; sy++) { sec[sy].dirty = true; sec[sy].meshed = false; }
    cols.set(VR.ckey(cx, cz), { cx, cz, key: VR.ckey(cx, cz), sec, shownAt: -1 });
  }
  const far = cols.get(VR.ckey(3, 0)).sec[2]; far.dirty = true; far.meshed = false;
  const jobs = [];
  const w = {
    cols, frame: 0, renderDist: 6, meshBudget: 6, meshInflight: 0, pool: { workers: [1] }, uploadBudget: () => 0.5,
    col(cx, cz) { return cols.get(VR.ckey(cx, cz)); }, seamHeld: () => false,
    meshSection(c, sy) { const s = c.sec[sy]; s.dirty = false; s.dirtyF = 0; if (s.count === 0) { s.meshed = true; return; } s.pending = true; jobs.push(s); },
  };
  for (let f = 0; f < 400; f++) {
    w.frame++;
    // the jobs of the last frame come back meshed
    for (const s of jobs.splice(0)) { s.pending = false; s.meshed = true; }
    // the churn: every section at the player's height in the 3 × 3 round him dirty again
    for (let cz = -1; cz <= 1; cz++) for (let cx = -1; cx <= 1; cx++) for (const sy of [3, 4]) { const s = cols.get(VR.ckey(cx, cz)).sec[sy]; if (!s.pending) { s.dirty = true; s.ver++; } }
    Wp.scheduleMeshes.call(w, 0, 4, 0, 0, 0, [8, 70, 8]);
  }
  let top = 0, topAll = 0;
  for (const c of cols.values()) for (let sy = 12; sy < 16; sy++) { topAll++; if (c.sec[sy].meshed) top++; }
  check(top === topAll, `the empty sections high above: ${top} of ${topAll} meshed under the churn (400 frames)`);
  check(far.meshed, 'the far solid section meshed in the end (no starvation by the near churn)');
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
