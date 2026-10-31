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

if (part('b')) {
  console.log('b · the species\' own body plans');
  require('../src/shared/smoothvox.js'); require('../src/shared/folksmooth.js');
  require('../src/main/voxmodels.js'); require('../src/main/villagers.js'); require('../src/main/folkmodel.js');
  require('../src/main/villages.js'); require('../src/main/worldlife.js');
  const Folk = VR.Folk, KINDS = ['aqua', 'ocker', 'zinn', 'basalt', 'opal'];
  // a grid's voxels as model-space points (the rig's layout: the parts' pivots; the head on the body's joint)
  const stats = (def) => {
    const g = (k) => def.parts[k].grid || def.parts[k].g || def.parts[k];
    const cnt = (G, f) => { let n = 0; for (let y = 0; y < G.sy; y++) for (let z = 0; z < G.sz; z++) for (let x = 0; x < G.sx; x++) if (G.c[G.i(x, y, z)] && f(x - G.ox, y - G.oy, z - G.oz)) n++; return n; };
    const H = g('head'), ext = (G) => { let x0 = 99, x1 = -99, y1 = -99; for (let y = 0; y < G.sy; y++) for (let z = 0; z < G.sz; z++) for (let x = 0; x < G.sx; x++) if (G.c[G.i(x, y, z)]) { x0 = Math.min(x0, x - G.ox); x1 = Math.max(x1, x - G.ox); y1 = Math.max(y1, y - G.oy); } return { w: x1 - x0 + 1, top: y1 }; };
    return { tail: cnt(g('hips'), (x, y, z) => z >= 5 && y < -1), back: cnt(g('body'), (x, y, z) => z >= 4), shoulder: cnt(g('arm_l'), (x, y, z) => y >= 1), head: cnt(H, () => true), hw: ext(H).w, htop: ext(H).top, neck: def.rig.head[1][1], h: def.h };
  };
  const sig = {};
  for (const k of KINDS) {
    const L = Folk.look(77, 'farmer', 'adult', null, 'sp:' + k);
    // (the person in the same costume: the look without its species — what u-worlds drew)
    const human = stats(Folk.buildHiRes(Object.assign({}, L, { species: undefined })));
    const st = stats(Folk.buildHiRes(L)), sb = Folk.SPECIES_BODY[k];
    sig[k] = st;
    const diff = [st.tail > human.tail + 8 ? 'tail ' + st.tail : '', st.back > human.back + 10 ? 'back ' + st.back : '', st.shoulder > human.shoulder + 10 ? 'plates' : '', st.hw > human.hw ? 'head ' + st.hw + ' wide' : '', st.head > human.head * 1.15 ? 'head ×' + (st.head / human.head).toFixed(2) : '', st.htop > human.htop + 1 ? 'crown ' + st.htop : '', st.neck > human.neck ? 'neck +' + (st.neck - human.neck) : '', Math.abs(sb.scale - 1) > 0.05 ? '×' + sb.scale : ''].filter(Boolean);
    check(L.species === k && diff.length >= 2, `${k} (${E2(k)}): ${diff.join(', ')} — skin #${L.skin.toString(16)}`);
    // the skin far from people's: not the warm peach-to-brown band (hue 10°–40° with saturation 0.2–0.75)
    const r = (L.skin >> 16) & 255, gg = (L.skin >> 8) & 255, b = L.skin & 255, mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
    let hue = mx === mn ? 0 : mx === r ? 60 * (((gg - b) / (mx - mn)) % 6) : mx === gg ? 60 * ((b - r) / (mx - mn) + 2) : 60 * ((r - gg) / (mx - mn) + 4); if (hue < 0) hue += 360;
    const sat = mx ? (mx - mn) / mx : 0;
    check(!(hue >= 10 && hue <= 40 && sat >= 0.2 && sat <= 0.75), `${k}: the skin far from a person's (hue ${hue.toFixed(0)}°, sat ${sat.toFixed(2)})`);
    // the smooth build and the kid's build carry it too, nothing thrown
    let okF = true; try { const f = Folk.buildFine(L), kd = Folk.buildHiRes(Folk.look(78, 'farmer', 'child', null, 'sp:' + k)); okF = !!(f.parts.head && kd.parts.hips); } catch (e) { okF = false; console.log(e.stack); }
    check(okF, `${k}: the smooth body and a child build`);
  }
  const keys = KINDS.map(k => JSON.stringify(sig[k]));
  check(new Set(keys).size === 5, 'five different body plans');
  // the idle: each species adds its own bearing to a standing pose, nothing while walking
  const P0 = () => { const o = {}; for (const j of VR.FolkAnim.JOINTS) o[j] = [0, 0, 0, 0, 0, 0]; return o; };
  const idl = KINDS.map(k => { const P = P0(); VR.WorldLife.idle(P, k, 1.0, 0, 'idle'); return JSON.stringify(P); });
  const walk = P0(); VR.WorldLife.idle(walk, 'aqua', 1.0, 1, 'idle');
  check(new Set(idl).size === 5 && JSON.stringify(walk) === JSON.stringify(P0()), 'five idles of their own, none while walking');
}
function E2(k) { return VR.WorldEco.KINDS[k].species.de; }

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
