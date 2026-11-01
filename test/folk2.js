// u-folk2 · inhabitants who are beautiful, warm and fun to be around — without a browser
// (plan docs/superpowers/plans/2026-10-31-u-folk2.md):
//   a · the face (folkmodel.js fineFace): eyes two fine rows high with a catch-light, the joy and wow parts on the head's
//       bone (hidden unless shown), the head a little larger than life, the natives' expressions too
//   b · the moments' catalogue (folkjoy.js VR.FolkJoy): kinds, cooldowns, the budget per cost tier, the times of day
//   c · the player-action detectors: a build burst (applause), a big jump or fall (a gasp), a take-off (children copy it)
//   d · the poses: hand in hand (the parent's right hand down and out, the child's left up), the new clips (clap, gasp, give)
//   e · the places: the side of a person, the story ring, the dance ring
//   f · the counter (distinct moments) and the texts in both tables
// Run: bash test/wt_run.sh folk2.js 300
require('./dom_stub.js');
const V = require('./load_shared.js');
globalThis.VR = V;
for (const f of ['i18n', 'lang_en', 'lang_de']) require(__dirname + '/../src/main/' + f + '.js');
require('../src/shared/smoothvox.js'); require('../src/shared/folksmooth.js');
require('../src/main/voxmodels.js'); require('../src/main/villagers.js'); require('../src/main/folkmodel.js');
require('../src/main/folkjoy.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const Folk = VR.Folk, FA = VR.FolkAnim, FJ = VR.FolkJoy;
check(!!FJ, 'VR.FolkJoy exists');
if (!FJ) { console.log('FAILED ' + (fails || 1)); process.exit(1); }

console.log('a · the face');
{
  const L = Folk.look(31, 'scholar', 'adult'), def = Folk.buildFine(L), f = def.fine;
  // the eye cells: tag 7 on the head's front (−z); count their rows per eye
  const g = f.head, rows = new Set(); let glint = 0;
  for (let Y = 0; Y < g.sy; Y++) for (let Z = 0; Z < g.sz; Z++) for (let X = 0; X < g.sx; X++) {
    const v = g.c[g.i(X, Y, Z)]; if (!v || ((v >>> 26) & 7) !== 7) continue;
    const c = v & 0xffffff, lum = ((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.59 + (c & 255) * 0.11;
    if (lum > 80) rows.add(Y);   // the whites and the glint (the lid's line is dark)
    if (c === 0xFFFCF4) glint++;
  }
  check(rows.size >= 2, `the eye's white two fine rows high (${rows.size} rows)`);
  check(glint === 2, `a catch-light in each eye (${glint})`);
  check(!!f.joy && !!f.wow && def.order.includes('joy') && def.order.includes('wow') && def.rig.joy[0] === 'head', 'the joy and wow parts hang on the head');
  check(def.order.length <= 20, `the bones within the people's texture row (${def.order.length} ≤ 20)`);
  const cnt = (q) => { let n = 0; for (const v of q.c) if (v) n++; return n; };
  check(cnt(f.joy) >= 8 && cnt(f.wow) >= 6 && cnt(f.joy) !== cnt(f.mouth), `the expressions differ from the talking mouth (joy ${cnt(f.joy)}, wow ${cnt(f.wow)}, mouth ${cnt(f.mouth)})`);
  check(Math.abs(f.head.res - 2 / 1.08) < 1e-9 && f.head.face.scale === 1.08, `the grown-up's head 8 % larger (res ${f.head.res.toFixed(3)})`);
  const K = Folk.buildFine(Folk.look(1212, 'child', 'child')).fine.head;
  check(K.face.scale > 1 && K.face.scale < 1.08, `the child's head a little larger (${K.face.scale})`);
  // a native keeps its own face and gets expressions
  let nat = null;
  if (VR.WorldLife && VR.WorldLife.speciesLook) nat = null;
  const Ln = Object.assign(Folk.look(5, 'farmer', 'adult'), { species: 'aqua' });
  try { nat = Folk.buildFine(Ln); } catch (e) { nat = null; }
  check(!nat || (!!nat.fine.joy && !!nat.fine.wow), 'a native has its joy and wow too');
  // the voxel path (Very Low, Low) has no expression parts: nothing more to draw there
  const lo = Folk.buildHiRes(L);
  check(!lo.order.includes('joy'), 'the voxel people unchanged (no expression parts)');
}

console.log('b · the moments');
{
  const K = FJ.KINDS;
  for (const k of ['wave', 'hug', 'hand', 'story', 'pet', 'hum', 'applaud', 'gasp', 'follow', 'offer', 'dance', 'hide']) check(K.includes(k), `the moment ${k}`);
  check(FJ.budget(0) >= 1 && FJ.budget(0) < FJ.budget(3), `the budget by tier (Very Low ${FJ.budget(0)}, High ${FJ.budget(3)})`);
  check(!FJ.petsOn(0) && FJ.petsOn(2) && FJ.fireOn(0) === false && FJ.fireOn(3), 'Very Low: no pets, no fire glow (nothing more drawn)');
  const ctx = (o) => Object.assign({ tod: 4000, tier: 3, now: 100, active: {}, last: {}, cand: { hand: true, offer: true, hide: true, follow: true, story: true, dance: true } }, o);
  const rnd = () => 0.01;
  const k1 = FJ.choose(ctx(), rnd);
  check(!!k1 && k1 !== 'story' && k1 !== 'dance', `by day a day's moment (${k1})`);
  check(FJ.choose(ctx({ tod: 11200, cand: { story: true } }), rnd) === 'story', 'at dusk the story by the fire');
  check(FJ.choose(ctx({ tod: 4000, cand: { story: true } }), rnd) === null, 'no story at noon');
  check(FJ.choose(ctx({ tod: 10000, cand: { dance: true } }), rnd) === 'dance', 'in the evening an invitation to dance');
  check(FJ.choose(ctx({ tod: 16000 }), rnd) === null, 'at night nothing (they sleep)');
  const last = {}; for (const k of K) last[k] = 99;
  check(FJ.choose(ctx({ last }), rnd) === null, 'every kind in its cooldown → nothing');
  check(FJ.choose(ctx({ active: { n: FJ.budget(3) } }), rnd) === null, 'the budget full → nothing');
  check(FJ.gap('offer') >= 60 && FJ.gap('hum') < FJ.gap('offer'), `cooldowns (offer ${FJ.gap('offer')} s, hum ${FJ.gap('hum')} s)`);
}

console.log('c · the detectors');
{
  const B = FJ.newBuild();
  let fired = 0;
  for (let i = 0; i < 3; i++) if (FJ.noteBuild(B, 10 + i)) fired++;
  check(fired === 0, 'three blocks: no applause yet');
  if (FJ.noteBuild(B, 14)) fired++;
  check(fired === 1, 'the fourth block within 15 s: applause');
  for (let i = 0; i < 6; i++) if (FJ.noteBuild(B, 15 + i)) fired++;
  check(fired === 1, 'then a rest (no applause storm)');
  check(FJ.noteBuild(B, 80) === false && FJ.noteBuild(B, 81) === false && FJ.noteBuild(B, 82) === false && FJ.noteBuild(B, 83) === true, 'after the rest a new burst');
  const J = FJ.newJump(); const ev = [];
  const step = (g, y, dt) => { const e = FJ.noteJump(J, g, y, dt); if (e) ev.push(e); };
  step(true, 64, 0.05); step(false, 64.5, 0.05);
  check(ev[0] === 'jump', 'a take-off is a jump');
  for (let i = 0; i < 10; i++) step(false, 65 - i * 0.2, 0.05);
  step(true, 63, 0.05);
  check(ev.length === 1, 'a small hop lands quietly');
  ev.length = 0; step(true, 70, 0.05); step(false, 70.4, 0.05);
  for (let i = 0; i < 30; i++) step(false, 70 - i * 0.2, 0.05);
  step(true, 64, 0.05);
  check(ev.includes('gasp'), `a fall of six blocks makes them gasp (${ev.join(', ')})`);
}

console.log('d · the poses');
{
  const P = { arm_l: [0, 0, 0, 0, 0, 0], arm_r: [0, 0, 0, 0, 0, 0], fore_l: [0, 0, 0, 0, 0, 0], fore_r: [0, 0, 0, 0, 0, 0] };
  const C = JSON.parse(JSON.stringify(P));
  FJ.handPose(P, 'lead', 1); FJ.handPose(C, 'hold', 1);
  check(P.arm_r[2] > 0.15 && P.arm_l[2] === 0, `the parent's right hand out to the side (${P.arm_r[2].toFixed(2)})`);
  check(C.arm_l[2] < -0.4 && C.arm_l[0] > 0, `the child's left arm up to it (${C.arm_l[2].toFixed(2)})`);
  for (const c of ['clap', 'gasp', 'give']) check(!!FA.clips[c], `the clip ${c}`);
  const g = FA.sample(FA.clips.gasp, 0.5, {});
  check(g.fore_l && g.fore_l[0] > 1.2, 'gasp: the hands up to the cheeks');
}

console.log('e · the places');
{
  const s = FJ.sideOf([0, 0, 0], 0, 0.6, []);
  check(Math.abs(s[0] - 0.6) < 1e-6 && Math.abs(s[1]) < 1e-6, `the right side of a person facing −z is +x (${s.map(v => v.toFixed(2))})`);
  const R = FJ.ring(10, 20, 5, 1.7, 0, []);
  check(R.length === 5 && R.every(p => Math.abs(Math.hypot(p[0] - 10, p[1] - 20) - 1.7) < 1e-6), 'the ring: five places at 1.7 m');
  const A = FJ.arc(0, 0, 0, 4, 1.6, []);
  check(A.length === 4 && A.every(p => p[1] < 0.2), 'the story arc lies before the teller (it faces −z at yaw 0, the arc on its −z side)');
}

console.log('f · the counter and the texts');
{
  const S = FJ.newStats();
  FJ.count(S, 'wave'); FJ.count(S, 'wave'); FJ.count(S, 'hug'); FJ.count(S, 'applaud');
  check(FJ.distinct(S) === 3 && S.n === 4, `counted: ${S.n} moments, ${FJ.distinct(S)} distinct`);
  const de = VR.I18N.tables ? VR.I18N.tables.de : null;
  let missing = 0;
  for (const k of FJ.TEXT_KEYS) { const a = VR.I18N.t(k); if (!a || a === k) missing++; }
  check(missing === 0 && FJ.TEXT_KEYS.length >= 6, `the texts in the tables (${FJ.TEXT_KEYS.length} keys, ${missing} missing)`);
  void de;
}

console.log('g · the children of a town without any (the flats of a tech town have two beds: no child lived there)');
{
  const fams = []; for (let i = 0; i < 8; i++) fams.push({ id: i, members: i === 3 ? [{ age: 'adult' }] : [{ age: 'adult', seed: 10 + i }, { age: 'adult', seed: 20 + i }] });
  const v = FJ.visitKids(fams, 'tech', 77, 2);
  check(v.length >= 2 && v.length <= FJ.VISIT_MAX, `children visit (${v.length}, at most ${FJ.VISIT_MAX})`);
  check(v.every(f => fams[f].members.every(m => m.age === 'adult')), 'only to grown-ups');
  const singles = []; for (let i = 0; i < 11; i++) singles.push({ id: i, members: [{ age: 'adult' }] });
  const vs = FJ.visitKids(singles, 'tech', 5, 2); check(vs.length >= 2 && vs.length <= FJ.VISIT_MAX, `a town of single flats: ${vs.length} single parents' children`);
  check(JSON.stringify(v) === JSON.stringify(FJ.visitKids(fams, 'tech', 77, 2)), 'the same town, the same families');
  check(FJ.visitKids(fams, 'tech', 77, 0).length === 0, 'Very Low: none (no more people to draw)');
  const withKid = fams.map((f, i) => (i === 5 ? { id: 5, members: f.members.concat([{ age: 'child' }]) } : f));
  check(FJ.visitKids(withKid, 'tech', 77, 2).length === 0, 'a town with a child of its own: none');
  check(FJ.visitKids(fams, 'classic', 77, 2).length === 0, 'a classic village (its budget let them go): none');
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
