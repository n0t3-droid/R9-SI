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
require('../src/main/villages.js'); require('../src/main/folklife.js'); require('../src/main/folkgpu.js');
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
  const g = armGeo(def, P, 'r'), hipX = (G.hw + 2.6);
  console.log(`    a hand on the hip: the wrist at (${g.wrB.map(f2).join(', ')}) in the body, the upper arm ${f2(g.abd)}° out, the elbow ${f2(g.flex)}°`);
  check(Math.abs(g.wrB[0] - hipX) < 1.5 && Math.abs(g.wrB[1] - 3.5) < 1.5 && g.abd > 25 && g.flex > 60 && g.flex < 125, `a hand on the hip: the wrist on the hip's side, the elbow out ${f2(g.abd)}° and bent ${f2(g.flex)}°`);
  const a = { seedW: 9 }; let on = 0, n = 0; const out = {}, sides = new Set();
  for (let k = 0; k < 90 * 30; k++) { FA.pose(a, 'idle', 1 / 30, 0, 0, false, out, undefined, G); n++; if (a.anim.hh && a.anim.hh.k > 0.99) { on++; sides.add(a.anim.hh.side); } }
  check(on > 0.08 * n && on < 0.5 * n, `standing 90 s, a hand on the hip ${f2(on / n * 100)} % of the time (8–50 %)`);
  // the free hand only: what the right hand holds (the crafter's hammer) keeps it off the hip, the elder's cane the left
  check(G.item && G.item !== 'cane' && sides.size === 1 && sides.has('l'), `the hand on the hip the free one: the ${G.item} in the right, the left on the hip (${[...sides].join(', ')})`);
  const Le = Folk.look(111, 'elder', 'elder', null, null), Ge = Folk.gaitFor(Le), ae = { seedW: 5 }, se = new Set();
  for (let k = 0; k < 90 * 30; k++) { FA.pose(ae, 'idle', 1 / 30, 0, 0, false, out, undefined, Ge); if (ae.anim.hh && ae.anim.hh.k > 0.99) se.add(ae.anim.hh.side); }
  const bothFull = Ge.cane && Ge.item && Ge.item !== 'cane';
  check(Ge.cane && (bothFull ? se.size === 0 : se.size === 1 && se.has('r')), `an elder with a cane in the left: ${bothFull ? 'both hands full, no hand on the hip' : 'the right on the hip, never the left'} (the right holds ${Ge.item}; ${[...se].join(', ') || 'none in 90 s'})`);
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
  // (the smooth people's rig — the hands their own parts, bent at the wrist — in every pose; the voxel people's — the hand
  // in the forearm's line — in every pose but the hand on the hip, which only the smooth people take: folkanim.js hipClock)
  const defs = new Map(); let hits = [], tot = 0, n = 0;
  for (const [who, L, P] of SAMPLES) {
    if (who.startsWith('clip ')) continue;
    let d = defs.get(L); if (!d) defs.set(L, d = [Folk.buildHiRes(L), Folk.buildFine(L)]);
    for (const [def, rig] of [[d[1], 'smooth'], [d[0], 'voxel']]) {
      if (rig === 'voxel' && who.endsWith('hand on hip')) continue;
      const r = inside(def, P); tot += r.tot; n++; if (r.n) hits.push(`${who}, ${rig} (${r.n})`);
    }
  }
  check(!hits.length, `no forearm or hand inside the torso (${n} poses of the two rigs, ${tot} voxels)${hits.length ? ': ' + hits.slice(0, 8).join(', ') : ''}`);
}

// ---------------------------------------------------------------- §2 hands and the hand pivot
// the smooth people's hands are parts of their own (the wrist bends; what they hold hangs at the hand's grip), the voxel
// people's stay in the forearm (the same part count: Very Low's draws do not change); a hand has a palm, the fingers as
// one block and a thumb apart from them, the palm's side paler; a bag hangs straight down at every moment of the walk with
// its handles in the fist; an elder's cane stands on the floor
console.log('§2 hands');
{
  const dL = Folk.look(5, 'farmer', 'adult'); dL.skin = Folk.SKIN[6];
  const fine = Folk.buildFine(dL), vox = Folk.buildHiRes(dL);
  check(!!fine.parts.hand_l && !!fine.parts.hand_r && fine.rig.hand_r && fine.rig.hand_r[0] === 'fore_r', `the smooth rig has hands of its own at the wrists (${fine.order.length} parts: ${fine.order.filter(n => /hand|item/.test(n)).join(', ')})`);
  check(vox.order.length === 13 && !vox.parts.hand_r, `the voxel rig keeps the hand in the forearm (${vox.order.length} parts, as v0.46: Very Low draws the same)`);
  const h = fine.parts.hand_r.grid || fine.parts.hand_r, at = (g, x, y, z) => { const X = x + g.ox, Y = y + g.oy, Z = z + g.oz; return g.in(X, Y, Z) ? g.c[g.i(X, Y, Z)] : 0; };
  let thumb = 0; for (let y = -6; y <= 0; y++) for (const x of [-1, 0]) if (at(h, x, y, -2)) thumb++;
  const notch = !at(h, -1, -4, -1) && !!at(h, -1, -4, -2) && !!at(h, 0, -4, -1);
  let n = 0; for (const v of h.c) if (v) n++;
  check(thumb >= 3 && notch, `a hand: a thumb of ${thumb} voxels ahead of the palm, a notch between it and the fingers (${n} voxels; v0.46: a 3 × 3 mitten)`);
  const lum = (c) => ((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.59 + (c & 255) * 0.11;
  check(lum(at(h, -1, -2, 0)) > lum(at(h, 0, -2, 0)) + 8, `the palm's side paler than the back of the hand on a dark skin (${lum(at(h, -1, -2, 0)).toFixed(0)} against ${lum(at(h, 0, -2, 0)).toFixed(0)})`);
  const hl = fine.parts.hand_l.grid || fine.parts.hand_l;
  check(!!at(hl, 0, -2, 0) && lum(at(hl, 0, -2, 0)) > lum(at(hl, -1, -2, 0)), 'the left hand mirrors the right (its palm toward the body too)');
  // the grip inside the closed fingers
  const G0 = fine.grip, gx = G0[0] + 0.5, gy = G0[1] + 0.5, gz = G0[2] + 0.5;
  let fx0 = 9, fx1 = -9, fy0 = 9, fy1 = -9, fz0 = 9, fz1 = -9;
  for (let y = -6; y <= -4; y++) for (let z = -1; z <= 1; z++) for (const x of [-1, 0]) if (at(h, x, y, z)) { fx0 = Math.min(fx0, x); fx1 = Math.max(fx1, x + 1); fy0 = Math.min(fy0, y); fy1 = Math.max(fy1, y + 1); fz0 = Math.min(fz0, z); fz1 = Math.max(fz1, z + 1); }
  check(gx >= fx0 && gx <= fx1 && gy >= fy0 && gy <= fy1 && gz >= fz0 && gz <= fz1, `the hand's grip (${[gx, gy, gz].map(f2).join(', ')}) inside the fingers (${fx0}…${fx1}, ${fy0}…${fy1}, ${fz0}…${fz1})`);
}
{
  // a bag at the grip, straight down through the walk, its handles in the fist
  const def = Folk.buildFine(bagL), G = Folk.gaitFor(bagL), out = {};
  FA.stride(G, 1.6, 0.1, false);
  let worst = 0, gap = 0;
  for (let k = 0; k < 32; k++) {
    G.ph = k / 32 * Math.PI * 2; FA.walkPerson(G, 1, out);
    const M = FS.rigMats(def, m4.create(), out, {}), I = M.item_r, ya = [I[4], I[5], I[6]];
    worst = Math.max(worst, deg(angle(ya, [0, 1, 0])));
    const grip = pt(M.item_r, 0, 0, 0), hand = pt(M.hand_r, def.grip[0], def.grip[1], def.grip[2]);
    gap = Math.max(gap, len(sub(grip, hand)));
  }
  check(worst < 3 && gap < 0.01, `a bag hangs straight down from the hand's grip through the walk (at worst ${f2(worst)}° off the vertical; the grip ${f2(gap)} units from the hand's)`);
  const g = def.parts.item_r.grid || def.parts.item_r; let top = -99; for (let y = 0; y < g.sy; y++) for (let z = 0; z < g.sz; z++) for (let x = 0; x < g.sx; x++) if (g.c[g.i(x, y, z)]) top = Math.max(top, y - g.oy);
  check(top >= -1 && top <= 1, `the bag's handles reach up into the fist (their top row ${top} at the grip)`);
}
{
  // an elder's cane stands on the floor
  const L = caneL, def = Folk.buildFine(L), G = Folk.gaitFor(L), a = { seedW: 4 }, out = {};
  let P; for (let k = 0; k < 30; k++) P = FA.pose(a, 'idle', 1 / 30, 0, 0, false, out, undefined, G);
  const M = FS.rigMats(def, m4.create(), P, {});
  let tip = Infinity, sole = Infinity;
  for (const v of voxOf(def, M, 'item_l')) tip = Math.min(tip, v.p[1] - 0.5);
  for (const k of ['shin_l', 'shin_r']) for (const v of voxOf(def, M, k)) sole = Math.min(sole, v.p[1] - 0.5);
  check(G.cane && Number.isFinite(tip) && Math.abs(tip - sole) <= 1.2, `an elder's cane stands on the floor (its tip ${f2(tip - sole)} units from the soles' level)`);
}

// ---------------------------------------------------------------- §3 one draw for the crowd
// folkgpu.js: every smooth person's mesh in ONE arena (one vertex buffer, one index buffer, first-fit ranges grown by
// copy), the bones in a float texture (a row a person), the crowd drawn by one multiDrawElementsWEBGL — measured on a
// recording fake GL: forty hall-city people in ≤ 12 draws (one with the extension, one a person without), every row the
// rig's matrices (FolkSmooth.rigMats), the arena's data intact through its growth, freed ranges used again
console.log('§3 one draw for the crowd');
{
  // the allocator alone
  const R = new V.FolkGPU.Ranges(100);
  const a1 = R.alloc(30), a2 = R.alloc(30), a3 = R.alloc(30);
  R.release(a2, 30); const a4 = R.alloc(20);
  R.release(a1, 30); R.release(a4, 20);
  const merged = R.free.length === 2 && R.free[0][0] === 0 && R.free[0][1] === 60;
  R.grow(200); const a5 = R.alloc(100);
  check(a1 === 0 && a2 === 30 && a3 === 60 && a4 === 30 && merged && a5 === 90 && R.alloc(80) === -1, `the arena's ranges: first fit, a freed range used again, neighbours merged, the grown tail free (${JSON.stringify(R.free)})`);
}
{
  // a recording fake GL
  const bufs = [], calls = { drawElements: 0, multi: 0, multiN: 0, tex: null, grows: 0 }, K = {};
  for (const [i, k] of ['ARRAY_BUFFER', 'ELEMENT_ARRAY_BUFFER', 'COPY_READ_BUFFER', 'COPY_WRITE_BUFFER', 'STATIC_DRAW', 'FLOAT', 'BYTE', 'UNSIGNED_BYTE', 'UNSIGNED_INT', 'UNSIGNED_SHORT', 'TRIANGLES', 'TEXTURE_2D', 'RGBA32F', 'RGBA', 'NEAREST', 'TEXTURE_MIN_FILTER', 'TEXTURE_MAG_FILTER', 'TEXTURE_WRAP_S', 'TEXTURE_WRAP_T', 'CLAMP_TO_EDGE', 'DEPTH_TEST', 'CULL_FACE'].entries()) K[k] = 100 + i;
  K.TEXTURE0 = 1000;
  const bound = {};
  const gl = Object.assign({}, K, {
    createBuffer() { const b = { id: bufs.length, data: new Uint8Array(0) }; bufs.push(b); return b; },
    deleteBuffer() {}, createVertexArray() { return {}; }, deleteVertexArray() {}, bindVertexArray() {},
    bindBuffer(t, b) { bound[t] = b; },
    bufferData(t, size) { const b = bound[t]; b.data = new Uint8Array(typeof size === 'number' ? size : size.byteLength); },
    bufferSubData(t, off, src) { const b = bound[t], u = new Uint8Array(src.buffer, src.byteOffset, src.byteLength); b.data.set(u, off); },
    copyBufferSubData(r, w, ro, wo, n) { bound[w].data.set(bound[r].data.subarray(ro, ro + n), wo); calls.grows++; },
    enableVertexAttribArray() {}, vertexAttribPointer() {}, createTexture() { return {}; }, deleteTexture() {}, bindTexture() {}, texImage2D() {}, texParameteri() {}, activeTexture() {},
    texSubImage2D(t, l, x, y, w, h, f, ty, data) { calls.tex = { w, h, data: Float32Array.from(data.subarray(0, w * h * 4)) }; },
    useProgram() {}, uniform1i() {}, uniform1f() {}, uniform3f() {}, uniformMatrix4fv() {}, enable() {}, disable() {},
    drawElements() { calls.drawElements++; },
  });
  const ext = { multiDrawElementsWEBGL(mode, counts, co, type, offs, oo, n) { calls.multi++; calls.multiN = n; calls.counts = Array.from(counts.subarray(0, n)); calls.offs = Array.from(offs.subarray(0, n)); } };
  V.GL = { ext: { multiDraw: ext }, program: () => ({ p: {}, u: new Proxy({}, { get: (t, k) => k }) }) };
  V.SHADERS = V.SHADERS || { COMMON: '' }; if (!V.SHADERS.COMMON) V.SHADERS.COMMON = '';
  const FG = V.FolkGPU, r = { gl, P: {}, common() {}, viewProj: new Float32Array(16), stats: { draws: 0, tris: 0 } }, g = { renderer: r };
  const people = [];
  FS.cache = null;
  for (let i = 0; i < 40; i++) {
    const age = i % 9 === 4 ? 'child' : i % 11 === 7 ? 'elder' : 'adult';
    const L = Folk.look(7000 + i * 131, age === 'adult' ? ['crafter', 'farmer', 'gardener', 'baker', 'scholar'][i % 5] : age, age, null, 'hall');
    const rec = FG.recFor(L), m = FS.personFromLook(L); m.type = 'folkmesh';
    FG.inflight = 1; FG.got(g, rec, m);
    people.push({ L, rec, m });
  }
  const ready = people.filter(q => q.rec.state === 2).length;
  // the first person's mesh in the arena — still there after the arena grew for the other 39
  const p0 = people[0], vb = FG.ar.vbo.data, ib = FG.ar.ibo.data;
  let same = true; for (let k = 0; k < p0.m.data.length && same; k++) if (vb[p0.rec.vOff * 20 + k] !== p0.m.data[k]) same = false;
  const ix = new Uint32Array(ib.buffer, ib.byteOffset + p0.rec.iOff * 4, p0.rec.count); let rebased = true; for (let k = 0; k < ix.length; k++) if (ix[k] !== p0.m.idx[k] + p0.rec.vOff) { rebased = false; break; }
  check(ready === 40 && same && rebased && calls.grows >= 1, `forty people in the arena (${ready} ready; it grew ${calls.grows}× by copy and the first one's ${p0.m.nv} vertices are intact, its indices offset by its first vertex)`);
  // the frame: forty queued, one flush
  const cam = { x: 3, y: 60, z: -2 }, G = {}, poses = [];
  people.forEach((q, i) => { const Gq = Folk.gaitFor(q.L), a = { seedW: i }, out = {}; let P; for (let k = 0; k < 3; k++) P = FA.pose(a, 'idle', 1 / 30, 0, 0, false, out, undefined, Gq); poses.push(P); FG.queue(q.rec, [10 + (i % 8) * 1.3, 64, 5 + ((i / 8) | 0) * 2], 0.3 * i, P, { sky: 1, bl: [0.2, 0.1, 0] }, { scale: q.L.age === 'child' ? 0.82 : 1, shade: 0, hide: { lids: true, mouth: true } }); });
  void G;
  const drawn = FG.flush(r, { sunDir: [0, 1, 0] }, cam);
  check(drawn === 40 && calls.multi === 1 && calls.multiN === 40 && calls.drawElements === 0, `forty people in ${calls.multi + calls.drawElements} draw (one multi-draw over ${calls.multiN} ranges; v0.46: forty draws, the crowd test asks ≤ 12)`);
  check(calls.offs.every((o, i) => o === people[i].rec.iOff * 4) && calls.counts.every((c, i) => c === people[i].rec.count), "every person's range drawn: its indices' offset and count");
  // the rows: the rig's matrices of each person as entities.js drawModel builds them
  let worst = 0;
  people.forEach((q, i) => {
    const base = m4.create(); m4.translate(base, base, 10 + (i % 8) * 1.3 - cam.x, 64 - cam.y, 5 + ((i / 8) | 0) * 2 - cam.z); m4.rotY(base, base, 0.3 * i);
    const s = (q.L.age === 'child' ? 0.82 : 1) / 32; m4.scale(base, base, s, s, s);
    const M = FS.rigMats(q.rec.def, base, poses[i], {}), D = calls.tex.data, row = i * V.FolkGPU.BW * 4;
    q.rec.def.order.forEach((n, b) => { if (n === 'lids' || n === 'mouth') return; for (let k = 0; k < 16; k++) worst = Math.max(worst, Math.abs(D[row + b * 16 + k] - M[n][k])); });
  });
  check(calls.tex.w === V.FolkGPU.BW && calls.tex.h === 40 && worst < 1e-5, `the bones' texture: a row a person, the rig's matrices (worst difference ${worst.toExponential(1)})`);
  // without the extension: one draw a person
  V.GL.ext.multiDraw = null; r.P = {}; calls.drawElements = 0; calls.multi = 0;
  people.forEach((q, i) => FG.queue(q.rec, [10, 64, 5], 0, poses[i], { sky: 1, bl: [0, 0, 0] }, {}));
  FG.flush(r, { sunDir: [0, 1, 0] }, cam);
  check(calls.drawElements === 40 && calls.multi === 0, `without WEBGL_multi_draw: one draw a person (${calls.drawElements})`);
  // a freed person's ranges are taken again
  const before = FG.ar.v.used; FG.free(gl, people[3].rec); const freed = before - FG.ar.v.used;
  const r2 = FG.recFor(people[3].L); r2.state = 0; FG.inflight = 1; FG.got(g, r2, people[3].m);
  check(freed === people[3].m.nv && r2.vOff === people[3].rec.vOff && r2.state === 2, `a freed person's ranges are used again (${freed} vertices)`);
  // §5 the eyes: the eye's vertices flagged for the people's shader (the alpha byte 128), on the head only
  const P0 = people[1].m, u8 = P0.data, hb = people[1].rec.def.order.indexOf('head');
  let eyeV = 0, off = 0, headV = 0; for (let k = 0; k < P0.nv; k++) { const a = u8[k * 20 + 19], b = u8[k * 20 + 15]; if (b === hb) headV++; if (a === 128) { eyeV++; if (b !== hb) off++; } }
  console.log('§5 the eyes');
  check(eyeV >= 8 && off === 0 && eyeV < headV * 0.2, `the eyes' vertices marked for the eye's light (${eyeV} of the head's ${headV}, none elsewhere)`);
  V.FolkGPU.clear(gl);
}

// ---------------------------------------------------------------- §4 shadows like props
// the mode per preset (Very Low none, Low the ellipse, Balanced and up the shadow map); the people's pass on a recording
// fake GL: the first frame copies the whole map, the next only last frame's rectangles; the people are written nearer the
// light by the receivers' bias (and 0.04 blocks); on the toroidal map a person at the wrap is written twice; the frame
// reads the copy (shadowRead)
console.log('§4 shadows like props');
{
  require('./dom_stub.js'); require('../src/main/i18n.js'); require('../src/main/lang_en.js'); require('../src/main/lang_de.js'); require('../src/main/settings_reg.js'); require('../src/main/game.js');
  const P = V.Game.PRESETS, FG = V.FolkGPU, modes = {};
  for (const k of ['potato', 'low', 'balanced', 'high', 'ultra', 'ultraLite']) modes[k] = FG.shadowMode(P[k], { shadows: P[k].shadows > 0 ? 1024 : 0, dropShadow: !!P[k].dropShadow });
  check(modes.potato === 'none' && modes.low === 'ellipse' && ['balanced', 'high', 'ultra', 'ultraLite'].every(k => modes[k] === 'map'), `the people's shadows per preset: ${Object.entries(modes).map(([k, v]) => k + ' ' + v).join(', ')}`);
  check(FG.shadowMode(Object.assign({}, P.balanced, { folkShadow: 0 }), { shadows: 1024, dropShadow: true }) === 'ellipse' && FG.shadowMode(Object.assign({}, P.balanced, { smoothFolk: 0 }), { shadows: 1024, dropShadow: true }) === 'ellipse', 'the switch off (or Echte Menschen off): the ellipse again');
  check(P.potato.folkShadow === 0 && P.low.folkShadow === 0 && P.balanced.folkShadow === 1 && P.ultra.folkShadow === 1, 'the switch in the presets: off on Very Low and Low (no shadow map), on from Balanced');
  // the pass on a fake GL
  const calls = { blits: [], draws: 0, multi: 0, uniforms: {}, fb: [] }, K = {}; let id = 0;
  for (const k of ['ARRAY_BUFFER', 'ELEMENT_ARRAY_BUFFER', 'COPY_READ_BUFFER', 'COPY_WRITE_BUFFER', 'STATIC_DRAW', 'FLOAT', 'BYTE', 'UNSIGNED_BYTE', 'UNSIGNED_INT', 'TRIANGLES', 'TEXTURE_2D', 'RGBA32F', 'RGBA', 'NEAREST', 'LINEAR', 'TEXTURE_MIN_FILTER', 'TEXTURE_MAG_FILTER', 'TEXTURE_WRAP_S', 'TEXTURE_WRAP_T', 'CLAMP_TO_EDGE', 'REPEAT', 'DEPTH_TEST', 'CULL_FACE', 'SCISSOR_TEST', 'POLYGON_OFFSET_FILL', 'LEQUAL', 'FRAMEBUFFER', 'READ_FRAMEBUFFER', 'DRAW_FRAMEBUFFER', 'DEPTH_BUFFER_BIT', 'DEPTH_COMPONENT24', 'DEPTH_COMPONENT']) K[k] = 200 + (id++);
  K.TEXTURE0 = 1000;
  const bound = {}, gl = Object.assign({}, K, {
    createBuffer() { return { data: new Uint8Array(0) }; }, deleteBuffer() {}, createVertexArray() { return {}; }, deleteVertexArray() {}, bindVertexArray() {},
    bindBuffer(t, b) { bound[t] = b; }, bufferData(t, size) { bound[t].data = new Uint8Array(typeof size === 'number' ? size : size.byteLength); },
    bufferSubData(t, off, src) { bound[t].data.set(new Uint8Array(src.buffer, src.byteOffset, src.byteLength), off); }, copyBufferSubData(r, w, ro, wo, n) { bound[w].data.set(bound[r].data.subarray(ro, ro + n), wo); },
    enableVertexAttribArray() {}, vertexAttribPointer() {}, createTexture() { return { tex: true }; }, deleteTexture() {}, deleteFramebuffer() {}, bindTexture() {}, texImage2D() {}, texParameteri() {}, activeTexture() {}, texSubImage2D() {},
    useProgram() {}, uniform1i(k, v) { calls.uniforms[k] = v; }, uniform1f(k, v) { calls.uniforms[k] = v; }, uniform2f() {}, uniform3f(k, a, b, c) { calls.uniforms[k] = [a, b, c]; }, uniformMatrix4fv(k, t, m) { calls.uniforms[k] = Float32Array.from(m); },
    enable(k) { calls.on = calls.on || new Set(); calls.on.add(k); }, disable(k) { if (calls.on) calls.on.delete(k); }, isEnabled(k) { return !!(calls.on && calls.on.has(k)); }, depthFunc() {}, depthMask() {}, viewport() {}, drawElements() { calls.draws++; },
    bindFramebuffer(t, f) { calls.fb.push(f); }, blitFramebuffer(...a) { calls.blits.push(a.slice(0, 4)); },
  });
  V.GL = { ext: { multiDraw: { multiDrawElementsWEBGL() { calls.multi++; } } }, program: () => ({ p: {}, u: new Proxy({}, { get: (t, k) => k }) }), tex2D: () => ({ copy: true }), fbo: () => ({ fbo: true }) };
  const r = { gl, P: {}, common() {}, viewProj: new Float32Array(16), stats: { draws: 0, tris: 0, shadowRenders: 1 }, frameNo: 1, shadowValid: true, shadowTex: { map: 1 }, shadowFB: { mapFB: 1 }, shadowSize: 1024, shadowOff: [0, 0], q: { shadows: 1024 } };
  // the renderer's lookup matrix: an orthographic box ±40 blocks across, ±260 deep, the light from up high
  const lv = m4.create(); m4.lookAt(lv, 0, 0, 0, -0.3, -0.9, -0.3, 0, 1, 0); const pr = m4.create(); m4.ortho(pr, -40, 40, -40, 40, -260, 260); r.shadowMat = m4.mul(m4.create(), pr, lv);
  const g = { renderer: r, settings: Object.assign({}, P.balanced) }; FG.game = g;
  const cam = { x: 0, y: 70, z: 0 }, ppl = [];
  for (let i = 0; i < 3; i++) { const L = Folk.look(9100 + i, 'crafter', 'adult', null, 'hall'), rec = FG.recFor(L), m = FS.personFromLook(L); m.type = 'folkmesh'; FG.inflight = 1; FG.got(g, rec, m); ppl.push(rec); }
  const frame = (positions) => { r.frameNo++; ppl.forEach((rec, i) => FG.queue(rec, positions[i], 0, FA.sample(FA.clips.idle, 0, {}), { sky: 1, bl: [0, 0, 0] }, {})); FG.flush(r, { sunDir: [0.3, 0.9, 0.3], moonDir: [0, -1, 0] }, cam); };
  frame([[2, 70, -3], [3, 70, -4], [-1, 70, -5]]);
  r.frameNo++; calls.blits.length = 0; calls.multi = 0;
  gl.enable(gl.CULL_FACE); gl.enable(gl.POLYGON_OFFSET_FILL);   // (as the map's own pass may leave them)
  const ok1 = FG.castShadows(r, {}, cam);
  check(gl.isEnabled(gl.CULL_FACE) && gl.isEnabled(gl.POLYGON_OFFSET_FILL), `the pass leaves the culling and the polygon offset as it found them`);
  const full = calls.blits.length === 1 && calls.blits[0].join() === '0,0,1024,1024';
  check(ok1 && full && calls.multi === 1 && r.shadowRead && r.shadowRead.copy, `the first frame: the whole map copied (${calls.blits.length} blit), the three drawn in ${calls.multi} draw, the frame reads the copy`);
  const zr = 0.5 * Math.hypot(r.shadowMat[2], r.shadowMat[6], r.shadowMat[10]), zb = calls.uniforms.u_zBias;
  check(Math.abs(zb - 2 * (0.0006 + 0.04 * zr)) < 1e-9 && zr > 0, `the people written ${f2((zb / 2) / zr)} blocks nearer the light (the receivers' bias ${f2(0.0006 / zr)} and 0.04)`);
  const rect = FG.sm.rects[0], tpb = 1024 / 80;
  check(FG.sm.rects.length === 1 && rect[2] - rect[0] < 14 * tpb && rect[3] - rect[1] < 14 * tpb, `their footprint one rectangle of ${rect[2] - rect[0]} × ${rect[3] - rect[1]} texels (not the whole map)`);
  // the next frame: the map unchanged — only last frame's rectangle comes back
  frame([[2.3, 70, -3], [3, 70, -4.2], [-1, 70, -5]]);
  r.frameNo++; calls.blits.length = 0; calls.multi = 0;
  FG.castShadows(r, {}, cam);
  check(calls.blits.length === 1 && calls.blits[0].join() === rect.slice(0, 4).join() && calls.multi === 1, `the next frame: only last frame's rectangle restored (${calls.blits.map(b => b.join(',')).join(' ')})`);
  // the map redrawn (a new render): all of it again
  r.stats.shadowRenders++; frame([[2.3, 70, -3], [3, 70, -4.2], [-1, 70, -5]]); r.frameNo++; calls.blits.length = 0; FG.castShadows(r, {}, cam);
  check(calls.blits.length === 1 && calls.blits[0].join() === '0,0,1024,1024', 'the map redrawn: copied whole again');
  // the toroidal map: a person at the wrap is written in two copies
  // (the offset that puts the first person right on the wrap: its window x + 2·offset = 1)
  { const M = r.shadowMat, nx = M[0] * 2 + M[4] * 0.9 + M[8] * -3 + M[12]; r.shadowOff = [(1 - nx) / 2, 0.1]; }
  frame([[2, 70, -3], [3, 70, -4], [-1, 70, -5]]); r.frameNo++; calls.multi = 0; FG.castShadows(r, {}, cam);
  check(calls.multi >= 2 && FG.sm.rects.length >= 2, `on the toroidal map the people at the wrap are written in ${FG.sm.rects.length} copies`);
  r.shadowOff = [0, 0];
  // nobody drawn last frame (no villagers near): no pass, the frame reads the map itself
  r.frameNo += 2; const none = FG.castShadows(r, {}, cam);
  check(!none && r.shadowRead === null, 'no people drawn the frame before: no pass, the map itself is read');
  // Low: the ellipse — no pass
  g.settings = Object.assign({}, P.low); r.q = { shadows: 0, dropShadow: true }; frame([[2, 70, -3], [3, 70, -4], [-1, 70, -5]]); r.frameNo++;
  check(!FG.castShadows(r, {}, cam) && r.shadowRead === null, 'on Low no pass: the ellipse');
  FG.clear(gl); FG.dropCopy(gl);
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
  // a table two blocks off is not leant on (its edge beyond a forearm's reach): the hands stay on the thighs
  { const G = Folk.gaitFor(crafter), far = FA.sitPose(G, { seat: 0.49, table: { d: 2, h: 0.75, r: 0.3125 }, side: 'r' }, {}), near = FA.sitPose(G, { seat: 0.49, table: { d: 1, h: 0.75, r: 0.3125 }, side: 'r' }, {});
    check(near.table && !far.table && far.reach === 0, `a café table one block ahead is leant on, one two blocks ahead is not (${near.table}, ${far.table})`); }
  // a robe's skirt turns forward only half way: the level thighs and the knees would come out through its lap (run 2's café
  // guests in gowns showed them as a dark wedge under the belt) — seated, the robe hides the legs; a coat's tails lie on them
  const hides = [[robe, true], [coat, false], [crafter, false]].map(([L, want]) => [Folk.gaitFor(L), want]);
  check(hides.every(([G, want]) => FA.sitHides(G) === want), `seated, a robe hides the legs (${FA.SIT_HIDE.join(', ')}), a coat and trousers show them (${hides.map(([G]) => G.skirt + ':' + FA.sitHides(G)).join(', ')})`);
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
