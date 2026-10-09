// t-folk (the owner: „natürlich keine Lego-Villagers, wir wollen schon Realismus"): real people instead of block people,
// measured without a browser.
//   §1 proportions — the rig (src/main/folkmodel.js buildPerson) assembled at rest by the rig's own matrices
//      (src/shared/folksmooth.js rigMats, the matrices entities.js drawModel builds): heads tall (sole to crown over chin
//      to crown), the hip joint at half the height, the shoulders against the head, the fingertips at mid-thigh, the
//      height in blocks — adults 7–7.6 heads, children 4.6–5.4, elders 6.8–7.6 (the old rig: 3.9 / 2.75 / 3.8)
// usage: bash test/wt_run.sh folk_real.js 300
const V = require('./load_shared.js');
require('../src/shared/smoothvox.js'); require('../src/shared/folksmooth.js');
require('../src/main/voxmodels.js'); require('../src/main/villagers.js'); require('../src/main/folkmodel.js');
const Folk = V.Folk, FS = V.FolkSmooth, m4 = V.mat4;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const f2 = (x) => (Math.round(x * 100) / 100).toFixed(2);

// ---------------------------------------------------------------- the rig at rest: every part's voxels in model units
// (a voxel x of a part's grid spans [x − ox, x − ox + 1] in the part's frame; its centre is transformed)
const TAG = Folk.TAG;
function assemble(def, pose) {
  const mats = FS.rigMats(def, m4.create(), pose || null, {});
  const out = {};
  for (const name of def.order) {
    const pr = def.parts[name]; if (!pr) continue;
    const g = pr.grid || pr, M = mats[name], vox = [];
    for (let y = 0; y < g.sy; y++) for (let z = 0; z < g.sz; z++) for (let x = 0; x < g.sx; x++) {
      const v = g.c[g.i(x, y, z)]; if (!v) continue;
      const px = x - g.ox + 0.5, py = y - g.oy + 0.5, pz = z - g.oz + 0.5;
      vox.push({ x: M[0] * px + M[4] * py + M[8] * pz + M[12], y: M[1] * px + M[5] * py + M[9] * pz + M[13], z: M[2] * px + M[6] * py + M[10] * pz + M[14], tag: (v >>> 26) & 7, col: v & 0xffffff, lx: x - g.ox, ly: y - g.oy, lz: z - g.oz });
    }
    out[name] = { vox, M };
  }
  return out;
}
// the measures of a person (model units, 32 a block): the sole, the crown (the skull and its hair, not a hat), the chin
// (the head's pivot: its lowest skull row sits on it), the head's width at the eyes (skull and hair), the shoulders (the
// upper arms' outer edges), the hip joint, the fingertips (the left hand's lowest skin voxel: the right one holds tools)
function measure(def) {
  const A = assemble(def);
  let sole = Infinity; for (const k of ['shin_l', 'shin_r']) for (const v of A[k].vox) sole = Math.min(sole, v.y - 0.5);
  const head = A.head, chin = head.M[13];
  // the crown: the head's middle column from the chin up, as far as it is filled (the skull, the scalp, the hair lying on
  // it; the people measured wear short hair and no hat — a bun, curls or a hat add to the figure, not to the head)
  const col = new Set();
  for (const v of head.vox) if (Math.abs(v.lx + 0.5) <= 1 && v.lz >= -1 && v.lz <= 0) col.add(v.ly);
  let top = 0; while (col.has(top + 1)) top++;
  let hx0 = Infinity, hx1 = -Infinity;
  const eyeRow = 3;
  for (const v of head.vox) if (v.ly === eyeRow && (v.tag === TAG.skin || v.tag === TAG.hair) && Math.abs(v.lz) <= 3) { hx0 = Math.min(hx0, v.x - 0.5); hx1 = Math.max(hx1, v.x + 0.5); }
  const crown = chin + top + 1;
  let sx0 = Infinity, sx1 = -Infinity;
  for (const k of ['arm_l', 'arm_r']) for (const v of A[k].vox) { sx0 = Math.min(sx0, v.x - 0.5); sx1 = Math.max(sx1, v.x + 0.5); }
  let tip = Infinity; for (const v of A.fore_l.vox) if (v.tag === TAG.skin) tip = Math.min(tip, v.y - 0.5);
  const H = crown - sole, headH = crown - chin;
  return { H, headH, heads: H / headH, headW: hx1 - hx0, shoulders: sx1 - sx0, hip: (def.layout.hips || def.layout.body)[1] - sole, tip: tip - sole, blocks: H / def.unit };
}

// ---------------------------------------------------------------- §1 the proportions
console.log('§1 proportions (model units, 32 a block)');
const PEOPLE = [
  ['crafter', 'adult', 11, null], ['scholar', 'adult', 22, null], ['office', 'adult', 33, null], ['crafter', 'adult', 44, 'hall'],
  ['smith', 'adult', 55, null], ['teacher', 'adult', 66, 'hall'], ['child', 'child', 77, null], ['child', 'child', 88, 'hall'],
  ['child', 'child', 99, null], ['elder', 'elder', 111, null], ['elder', 'elder', 122, 'hall'],
];
const RANGE = { adult: [7.0, 7.6], child: [4.6, 5.4], elder: [6.8, 7.6] };
const rows = [];
for (const [role, age, seed, style] of PEOPLE) {
  // (measured with short hair and no hat: the head's own height — the roles chosen wear none)
  const L = Object.assign(Folk.look(seed, role, age, null, style), { hs: 'short', kidHat: null, elderHat: null });
  const def = Folk.buildHiRes(L), m = measure(def), drawn = age === 'child' ? 0.82 : 1;
  rows.push([role, age, m]);
  console.log(`    ${role.padEnd(8)} ${age.padEnd(6)} ${(style || '').padEnd(4)} H ${f2(m.H)} (${f2(m.blocks * drawn)} blocks drawn) head ${f2(m.headH)} → ${f2(m.heads)} heads · head width ${f2(m.headW)} shoulders ${f2(m.shoulders)} (${f2(m.shoulders / m.headW)} heads) · hip ${f2(m.hip / m.H)} H · fingertips ${f2(m.tip / m.H)} H · hair ${L.hs}`);
  const [lo, hi] = RANGE[age];
  check(m.heads >= lo && m.heads <= hi, `${role} (${age}${style ? ', ' + style : ''}): ${f2(m.heads)} heads tall (${lo}–${hi}; the old rig: ${age === 'child' ? '2.75' : age === 'elder' ? '3.8' : '3.9'})`);
  if (age === 'adult') {
    check(m.hip / m.H >= 0.47 && m.hip / m.H <= 0.53, `${role}: the hip joint at ${f2(m.hip / m.H)} of the height (legs half the body; the old rig 0.41)`);
    check(m.shoulders / m.headW >= 1.9 && m.shoulders / m.headW <= 2.6, `${role}: shoulders ${f2(m.shoulders / m.headW)} head widths (the old rig 1.5)`);
    check(m.tip / m.H >= 0.33 && m.tip / m.H <= 0.43, `${role}: the fingertips at ${f2(m.tip / m.H)} of the height (mid-thigh)`);
    check(m.blocks >= 1.72 && m.blocks <= 1.86, `${role}: ${f2(m.blocks)} blocks tall`);
  }
  if (age === 'child') check(m.blocks * drawn >= 1.05 && m.blocks * drawn <= 1.25, `${role} (child): ${f2(m.blocks * drawn)} blocks tall as drawn (× 0.82)`);
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
