// t-folk2 (the owner, round II: the arms hang like posts, the hands are mittens, the shadows are blots, one draw a person,
// the eye whites amber under warm light, nobody sits right): measured without a browser.
//   §1 the arms — the rest pose (the upper arm 6–8° out, the elbow 10–15°, the hand in front of the thigh), the walk's
//      swing from the shoulder with the elbow following it, a carried bag pulling its arm straight, a hand on the hip, the
//      talking gestures, the elbow's range in every pose, the arm solve, no forearm or hand inside the torso
//   §6 sitting — the seat solved: the thighs on the seat, the feet on the floor, the knees near 90°, a forearm on the café
//      table, the other hand on the thigh
// usage: bash test/wt_run.sh folk_real2.js 300
const V = require('./load_shared.js');
require('../src/shared/smoothvox.js'); require('../src/shared/folksmooth.js');
require('../src/main/voxmodels.js'); require('../src/main/villagers.js'); require('../src/main/folkmodel.js');
require('../src/main/villages.js'); require('../src/main/folklife.js');
const Folk = V.Folk, FS = V.FolkSmooth, m4 = V.mat4, FA = V.FolkAnim;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const f2 = (x) => (Math.round(x * 100) / 100).toFixed(2), deg = (r) => r * 180 / Math.PI;

// ---------------------------------------------------------------- the rig's geometry
const find = (pred, role, age, style) => { for (let s = 1; s < 3000; s++) { const q = Folk.look(s, role || 'crafter', age || 'adult', null, style); if (pred(q)) return q; } return null; };
const pt = (M, x, y, z) => [M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], len = (a) => Math.hypot(a[0], a[1], a[2]), dotv = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const angle = (a, b) => Math.acos(Math.max(-1, Math.min(1, dotv(a, b) / (len(a) * len(b) || 1))));
// a vector of the model in the body's frame (the body's axes: the columns of its matrix)
const inBody = (M, v) => { const ax = [M[0], M[1], M[2]], ay = [M[4], M[5], M[6]], az = [M[8], M[9], M[10]]; return [dotv(v, ax) / len(ax), dotv(v, ay) / len(ay), dotv(v, az) / len(az)]; };
function armGeo(def, P, s) {
  const S = def.skel, M = FS.rigMats(def, m4.create(), P, {});
  const sh = pt(M['arm_' + s], 0, 0, 0), el = pt(M['fore_' + s], 0, 0, 0), wr = pt(M['fore_' + s], 0, -S.fore, 0), hand = pt(M['fore_' + s], 0, -S.fore - 3, 0);
  const u = sub(el, sh), f = sub(wr, el), ub = inBody(M.body, u), sx = s === 'l' ? -1 : 1;
  const body0 = pt(M.body, 0, 0, 0), handB = inBody(M.body, sub(hand, body0)), wrB = inBody(M.body, sub(wr, body0));
  return { abd: deg(Math.atan2(sx * ub[0], -ub[1])), flex: deg(angle(u, f)), sh, el, wr, hand, handB, wrB, M };
}
// every voxel of a part in the model's frame (its centre), with its place in its own grid
function voxOf(def, M, name) {
  const pr = def.parts[name]; if (!pr) return [];
  const g = pr.grid || pr, T = M[name], out = [];
  for (let y = 0; y < g.sy; y++) for (let z = 0; z < g.sz; z++) for (let x = 0; x < g.sx; x++) {
    if (!g.c[g.i(x, y, z)]) continue;
    out.push({ p: pt(T, x - g.ox + 0.5, y - g.oy + 0.5, z - g.oz + 0.5), x, y, z });
  }
  return out;
}
// the torso's deep voxels: a voxel whose neighbours within e voxels (6 directions) are all set (the surface peeled off e deep)
function deepVox(def, M, name, e) {
  const pr = def.parts[name]; if (!pr) return [];
  const g = pr.grid || pr, T = M[name], out = [];
  const has = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < g.sx && y < g.sy && z < g.sz && !!g.c[g.i(x, y, z)];
  for (let y = 0; y < g.sy; y++) for (let z = 0; z < g.sz; z++) for (let x = 0; x < g.sx; x++) {
    if (!has(x, y, z)) continue;
    let deep = true;
    for (let k = 1; k <= e && deep; k++) for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) if (!has(x + dx * k, y + dy * k, z + dz * k)) { deep = false; break; }
    if (deep) out.push(pt(T, x - g.ox + 0.5, y - g.oy + 0.5, z - g.oz + 0.5));
  }
  return out;
}
// the forearm's (and the hand's) voxels that lie inside the torso: within half a voxel of a deep voxel of the chest (one
// voxel peeled) or of the hips and their skirt (two peeled: a hand may brush a robe)
function inside(def, P) {
  const M = FS.rigMats(def, m4.create(), P, {});
  const deep = deepVox(def, M, 'body', 1).concat(deepVox(def, M, 'hips', 2));
  let n = 0, tot = 0;
  for (const name of ['fore_l', 'fore_r', 'hand_l', 'hand_r']) for (const v of voxOf(def, M, name)) {
    tot++;
    for (const d of deep) if (Math.abs(v.p[0] - d[0]) < 0.5 && Math.abs(v.p[1] - d[1]) < 0.5 && Math.abs(v.p[2] - d[2]) < 0.5) { n++; break; }
  }
  return { n, tot };
}
const poseOf = (L, state, t, o) => {
  const G = Folk.gaitFor(L), a = Object.assign({ seedW: 5 }, o || {}), out = {};
  let P = null; for (let k = 0; k <= Math.round(t * 30); k++) P = FA.pose(a, state, 1 / 30, 0, 0, false, out, undefined, G);
  return { P, G, a };
};

// ---------------------------------------------------------------- §1 the arms
console.log('§1 the arms');
const crafter = Folk.look(11, 'crafter', 'adult'), robe = find(q => q.garb === 'robe' && !q.tool, 'crafter', 'adult', 'hall'), coat = find(q => q.garb === 'coat' && !q.tool, 'crafter', 'adult', 'hall');
const child = Folk.look(77, 'child', 'child'), bagL = find(q => q.tool === 'bag', 'crafter', 'adult', 'hall'), caneL = find(q => (Folk.ROLES.elder.tool === 'cane'), 'elder', 'elder');
{
  for (const [L, who] of [[crafter, 'a crafter'], [robe, 'a robe'], [coat, 'a coat'], [child, 'a child']]) {
    const def = Folk.buildHiRes(L);
    let a0 = 1e9, a1 = -1e9, e0 = 1e9, e1 = -1e9, h1 = -1e9;
    for (const t of [0.5, 1.3, 2.1, 3.4]) {
      const { P } = poseOf(L, 'idle', t);
      for (const s of ['l', 'r']) { const g = armGeo(def, P, s); a0 = Math.min(a0, g.abd); a1 = Math.max(a1, g.abd); e0 = Math.min(e0, g.flex); e1 = Math.max(e1, g.flex); h1 = Math.max(h1, g.handB[2]); }
    }
    console.log(`    ${who} standing: the upper arm ${f2(a0)}…${f2(a1)}° out, the elbow ${f2(e0)}…${f2(e1)}°, the hands ${f2(-h1)} units ahead of the hip joint at least`);
    const wide = L.garb === 'robe';
    check(a0 >= 6 && a1 <= (wide ? 11 : 8.5), `${who} standing: the upper arm ${f2(a0)}–${f2(a1)}° out from the body (6–8°${wide ? ', a robe a little more' : ''}; v0.46: 4.6°)`);
    check(e0 >= 10 && e1 <= 15, `${who} standing: the elbow bent ${f2(e0)}–${f2(e1)}° (10–15°)`);
    check(h1 < -1, `${who} standing: the hands in front of the thigh's line (${f2(-h1)} units ahead of the hip joint)`);
  }
}
{
  // the walk: the swing from the shoulder, the elbow following it a little late, bent more in front
  const L = crafter, G = Folk.gaitFor(L), def = Folk.buildHiRes(L), out = {};
  FA.stride(G, 1.6, 0.1, false);
  const rx = [], fx = [], fl = [];
  for (let k = 0; k < 96; k++) { G.ph = k / 96 * Math.PI * 2; FA.walkPerson(G, 1, out); rx.push(out.arm_l[0]); fx.push(out.fore_l[0]); fl.push(armGeo(def, out, 'l').flex); }
  const iA = rx.indexOf(Math.max(...rx)), iF = fx.indexOf(Math.max(...fx)), lag = ((iF - iA + 96) % 96) / 96;
  console.log(`    walking: the arm swings ${f2(deg(Math.min(...rx)))}…${f2(deg(Math.max(...rx)))}°, the elbow ${f2(Math.min(...fl))}…${f2(Math.max(...fl))}°, its peak ${f2(lag)} of a cycle after the arm's`);
  check(Math.min(...fl) >= 10 && Math.max(...fl) >= 25 && Math.max(...fl) <= 45, `walking: the elbow ${f2(Math.min(...fl))}° behind, ${f2(Math.max(...fl))}° in front (10–45°; v0.46: 9–25°)`);
  check(lag > 0.02 && lag < 0.2, `walking: the elbow follows the swing ${f2(lag)} of a cycle late (0.02–0.2)`);
  // a bag pulls its arm straight and swings less
  const GB = Folk.gaitFor(bagL), defB = Folk.buildHiRes(bagL), ob = {};
  FA.stride(GB, 1.6, 0.1, false);
  let sw = 0, swFree = 0, flexB = 0;
  for (let k = 0; k < 48; k++) { GB.ph = k / 48 * Math.PI * 2; FA.walkPerson(GB, 1, ob); sw = Math.max(sw, Math.abs(ob.arm_r[0])); swFree = Math.max(swFree, Math.abs(ob.arm_l[0])); flexB = Math.max(flexB, armGeo(defB, ob, 'r').flex); }
  check(GB.carry === 'bag' && flexB <= 5 && sw <= 0.45 * swFree, `a bag pulls its arm straight: the elbow at most ${f2(flexB)}° (≤ 5°), the swing ${f2(deg(sw))}° against the free arm's ${f2(deg(swFree))}°`);
  // the bag hangs straight down from the hand at every moment of the walk (the item's turn undoes the chain)
  let worstHang = 0;
  const R = new Float64Array(9), T = new Float64Array(9), mul = (a, b, o) => { for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]; return o; };
  const rot = (q) => FA.rotYXZ(q[0], q[1], q[2], new Float64Array(9));
  for (let k = 0; k < 48; k++) {
    GB.ph = k / 48 * Math.PI * 2; FA.walkPerson(GB, 1, ob);
    let C = rot(ob.hips); for (const j of ['body', 'arm_r', 'fore_r', 'hand_r', 'item_r']) C = mul(C, rot(ob[j]), new Float64Array(9));
    worstHang = Math.max(worstHang, deg(Math.acos(Math.max(-1, Math.min(1, C[4])))));
  }
  void R; void T;
  check(worstHang < 3, `a carried bag hangs straight down through the walk (at worst ${f2(worstHang)}° off the vertical)`);
}
{
  // a hand on the hip: the wrist on the hip bone, the elbow out; it comes now and then while standing
  const L = crafter, G = Folk.gaitFor(L), def = Folk.buildHiRes(L), P = FA.handOnHip(G, 'r', {});
  for (const j of FA.JOINTS) if (!P[j]) P[j] = [0, 0, 0, 0, 0, 0];
  const g = armGeo(def, P, 'r'), hipX = (G.hw + 2.3);
  console.log(`    a hand on the hip: the wrist at (${g.wrB.map(f2).join(', ')}) in the body, the upper arm ${f2(g.abd)}° out, the elbow ${f2(g.flex)}°`);
  check(Math.abs(g.wrB[0] - hipX) < 1.5 && Math.abs(g.wrB[1] - 3.5) < 1.5 && g.abd > 25 && g.flex > 60 && g.flex < 125, `a hand on the hip: the wrist on the hip's side, the elbow out ${f2(g.abd)}° and bent ${f2(g.flex)}°`);
  const a = { seedW: 9 }; let on = 0, n = 0; const out = {};
  for (let k = 0; k < 90 * 30; k++) { FA.pose(a, 'idle', 1 / 30, 0, 0, false, out, undefined, G); n++; if (a.anim.hh && a.anim.hh.k > 0.99) on++; }
  check(on > 0.08 * n && on < 0.5 * n, `standing 90 s, a hand on the hip ${f2(on / n * 100)} % of the time (8–50 %)`);
}
{
  // talking: the speaker's forearms up with small swings, the listener's hands clasped before the belly
  const L = crafter, def = Folk.buildHiRes(L);
  let e0 = 1e9, e1 = -1e9, s0 = 1e9, s1 = -1e9;
  for (let k = 0; k < 90; k++) { const { P } = poseOf(L, 'talk', 0.2 + k / 30, { speaking: true }); const g = armGeo(def, P, 'r'); e0 = Math.min(e0, g.flex); e1 = Math.max(e1, g.flex); s0 = Math.min(s0, P.fore_r[0]); s1 = Math.max(s1, P.fore_r[0]); }
  console.log(`    talking: the speaker's right elbow ${f2(e0)}…${f2(e1)}°, the forearm swings ${f2(s1 - s0)} rad`);
  check(e0 >= 55 && e1 <= 105 && s1 - s0 >= 0.15 && s1 - s0 <= 0.6, `talking: the forearms up at the waist (the elbow ${f2(e0)}–${f2(e1)}°) with small swings (${f2(s1 - s0)} rad)`);
  const { P } = poseOf(L, 'talk', 1.5, { speaking: false }), gl = armGeo(def, P, 'l'), gr = armGeo(def, P, 'r');
  check(gl.wrB[2] < -3.5 && gr.wrB[2] < -3.5 && len(sub(gl.wrB, gr.wrB)) < 3, `listening: the hands clasped before the belly (the wrists ${f2(len(sub(gl.wrB, gr.wrB)))} units apart, ${f2(-gr.wrB[2])} ahead)`);
}
{
  // the arm solve reaches what it is asked
  const G = Folk.gaitFor(crafter); let worst = 0;
  for (let k = 0; k < 40; k++) {
    const s = k & 1 ? 'r' : 'l', sx = s === 'l' ? -1 : 1, W = [sx * (3 + (k * 7 % 5)), 2 + (k * 3 % 13), -2 - (k * 5 % 9)], P = {};
    FA.armIK(G, s, W, [sx, -0.5, 0.5], P); for (const j of FA.JOINTS) if (!P[j]) P[j] = [0, 0, 0, 0, 0, 0];
    const g = armGeo(Folk.buildHiRes(crafter), P, s); worst = Math.max(worst, len(sub(g.wrB, W)));
  }
  check(worst <= 0.6, `the arm solve puts the wrist where it is asked (worst ${f2(worst)} units over 40 targets)`);
}
// the elbow's range and the torso: every pose sampled
const SAMPLES = [];
{
  const add = (who, L, P) => SAMPLES.push([who, L, JSON.parse(JSON.stringify(P))]);
  for (const [L, who] of [[crafter, 'crafter'], [robe, 'robe'], [child, 'child'], [bagL, 'bag'], [caneL, 'cane']]) {
    for (const t of [0.4, 1.7, 3.1]) add(who + ' idle', L, poseOf(L, 'idle', t).P);
    for (const t of [0.4, 1.1, 2.6]) { add(who + ' talking', L, poseOf(L, 'talk', t, { speaking: true }).P); add(who + ' listening', L, poseOf(L, 'talk', t, { speaking: false }).P); }
    const G = Folk.gaitFor(L), o = {}; FA.stride(G, 1.6, 0.1, false);
    for (let k = 0; k < 16; k++) { G.ph = k / 16 * Math.PI * 2; FA.walkPerson(G, 1, o); add(who + ' walking', L, o); }
    const Gr = Folk.gaitFor(L); FA.stride(Gr, 3.2, 0.1, true); for (let k = 0; k < 8; k++) { Gr.ph = k / 8 * Math.PI * 2; FA.walkPerson(Gr, 1, o); add(who + ' running', L, o); }
    if (L.age !== 'child') { const s = G.carry ? 'l' : 'r', P = FA.handOnHip(G, s, {}), Q = poseOf(L, 'idle', 0.5).P; for (const j of ['arm_' + s, 'fore_' + s, 'hand_' + s]) Q[j] = P[j]; add(who + ' hand on hip', L, Q); }
    for (const tb of [null, { d: 1, h: 0.75, r: 0.31 }]) { const P = {}; FA.sitPose(G, { seat: 0.49, table: tb, side: 'r' }, P); add(who + (tb ? ' at a table' : ' seated'), L, P); }
  }
  for (const name of ['wave', 'read', 'work', 'crouch', 'hug', 'carry', 'stretch', 'cheer']) for (const t of [0, 0.3, 0.7]) add('clip ' + name, crafter, FA.sample(FA.clips[name], t, {}));
  let bad = [], worstF = 0;
  for (const [who, L, P] of SAMPLES) for (const s of ['l', 'r']) { const fx = P['fore_' + s][0], g = armGeo(Folk.buildHiRes(L), P, s); worstF = Math.max(worstF, g.flex); if (fx < -0.01 || g.flex > 150) bad.push(`${who} ${s} (${f2(fx)} rad, ${f2(g.flex)}°)`); }
  check(!bad.length, `the elbow stays in its range in every pose (${SAMPLES.length} poses, 0–150°, the most ${f2(worstF)}°)${bad.length ? ': ' + bad.slice(0, 6).join(', ') : ''}`);
  const defs = new Map(); let hits = [], tot = 0;
  for (const [who, L, P] of SAMPLES) {
    if (who.startsWith('clip ')) continue;
    let def = defs.get(L); if (!def) defs.set(L, def = Folk.buildHiRes(L));
    const r = inside(def, P); tot += r.tot; if (r.n) hits.push(`${who} (${r.n})`);
  }
  check(!hits.length, `no forearm or hand inside the torso (${SAMPLES.length} poses, ${tot} voxels)${hits.length ? ': ' + hits.slice(0, 8).join(', ') : ''}`);
}

// ---------------------------------------------------------------- §6 sitting
console.log('§6 sitting');
{
  // the lowest point of a part's voxels (model units, the base's floor at 0) and of the thighs near the hip
  for (const [L, who] of [[crafter, 'an adult'], [robe, 'a robe'], [coat, 'a coat'], [caneL, 'an elder'], [child, 'a child']]) {
    for (const tb of [null, { d: 1, h: 0.75, r: 0.3125 }]) {
      const G = Folk.gaitFor(L), def = Folk.buildHiRes(L), P = {}, r = FA.sitPose(G, { seat: 0.49, table: tb, side: 'r' }, P);
      for (const j of FA.JOINTS) if (!P[j]) P[j] = [0, 0, 0, 0, 0, 0];
      const U = 1 / G.bpu, base = m4.create(); m4.translate(base, base, 0, r.rootY * U, -r.fwd * U);
      const M = FS.rigMats(def, base, P, {});
      let sole = Infinity; for (const k of ['shin_l', 'shin_r']) for (const v of voxOf(def, M, k)) sole = Math.min(sole, v.p[1] - 0.5);
      // the thighs' underside over the seat: their voxels within 2 units of the hip joint along the thigh; at the seat's
      // front edge (the bentwood chair's seat: 0.275 blocks round its middle) the thigh may dip a little into it
      let under = Infinity, rim = Infinity; const zr = -0.275 * U;
      for (const k of ['leg_l', 'leg_r']) for (const v of voxOf(def, M, k)) { if (v.y - def.parts[k].grid.oy > -3) under = Math.min(under, v.p[1] - 0.5); if (Math.abs(v.p[2] - zr) < 1) rim = Math.min(rim, v.p[1] - 0.5); }
      const seatU = 0.49 * U, b = (x) => x * G.bpu;
      const tag = `${who}${tb ? ' at a café table' : ''}`;
      console.log(`    ${tag}: the soles ${f2(b(sole))} blocks over the floor, the thighs' underside ${f2(b(under))} (the seat ${0.49}; at its front edge ${f2(b(rim))}), the knees ${f2(deg(r.knee))}°, the hips ${f2(r.rootY + G.hip * G.bpu)} blocks up`);
      if (!G.kid) {
        check(Math.abs(b(sole)) <= 0.035, `${tag}: the feet on the floor (${f2(b(sole))} blocks; v0.46: 0.10 over it)`);
        check(deg(r.knee) >= 80 && deg(r.knee) <= 105, `${tag}: the knees bent ${f2(deg(r.knee))}° (80–105°)`);
      } else check(b(sole) >= -0.02, `${tag}: a child's feet hang over the floor (${f2(b(sole))} blocks)`);
      check(Math.abs(b(under) - 0.49) <= 0.035 && seatU - rim <= 1.6, `${tag}: the thighs on the seat (their underside ${f2(b(under))} blocks, the seat 0.49; ${f2(seatU - rim)} units into its front edge)`);
      if (tb && !G.kid) {
        // the forearm on the table: the lowest voxel of the right forearm and hand over the table's disc at its top
        const tc = -(tb.d) * U;   // (the table's middle ahead of the seat's middle, model units; the model faces −z)
        let low = Infinity, onTop = 0, n = 0;
        for (const k of ['fore_r', 'hand_r']) for (const v of voxOf(def, M, k)) { n++; const dz = v.p[2] - tc, dx = v.p[0]; if (Math.hypot(dx, dz) < tb.r * U) { onTop++; low = Math.min(low, v.p[1] - 0.5); } }
        check(onTop >= 3 && Math.abs(b(low) - tb.h) <= 0.05 && r.reach < 0.6, `${tag}: a forearm rests on the table (${onTop} of ${n} voxels over its top, the lowest ${f2(b(low))} blocks, the top ${tb.h})`);
      }
    }
  }
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
