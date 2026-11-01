// u-folk3 · the inhabitants as lovely on screen as in code — without a browser
// (plan docs/superpowers/plans/2026-11-01-u-folk3.md):
//   a · the camera director (VR.Folk3.frame / frameGroup): never inside a wall, a clear line to the face, 3–5 m, pulled
//       back in a corridor, the sun's side preferred
//   b · the circle dance's ring (F3.danceRing): open ground all round (a monument in the plaza, a wall at the edge, the
//       open field), the neighbours near enough to hold hands, the arms' reach for the actual chord
//   c · the moods over a day (F3.mood): sleepy at dawn, cheerful at noon, cosy at dusk
//   d · the far face: the smooth head's faceFar part (before the face, hidden near), the voxel LOD's eyes kept
//   e · the texts in both tables
// Run: bash test/wt_run.sh folk3.js 300
require('./dom_stub.js');
const V = require('./load_shared.js');
globalThis.VR = V;
for (const f of ['i18n', 'lang_en', 'lang_de']) require(__dirname + '/../src/main/' + f + '.js');
require('../src/shared/smoothvox.js'); require('../src/shared/folksmooth.js');
require('../src/main/voxmodels.js'); require('../src/main/villagers.js'); require('../src/main/folkmodel.js');
require('../src/main/folkjoy.js'); require('../src/main/folk3.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const F3 = VR.Folk3, Folk = VR.Folk;
check(!!F3, 'VR.Folk3 exists');
if (!F3) { console.log('FAILED ' + (fails || 1)); process.exit(1); }

// a little world of boxes: solid(x, y, z) on block coordinates; the floor at y < 64
const boxes = (list) => (x, y, z) => { x = Math.floor(x); y = Math.floor(y); z = Math.floor(z); if (y < 64) return true; for (const b of list) if (x >= b[0] && x <= b[3] && y >= b[1] && y <= b[4] && z >= b[2] && z <= b[5]) return true; return false; };
const lens = (solid, P, r) => { for (let i = 0; i < 26; i++) { const a = (i % 13) / 13 * Math.PI * 2, e = i < 13 ? 0.6 : -0.6; if (solid(P[0] + Math.cos(a) * Math.cos(e) * r, P[1] + Math.sin(e) * r, P[2] + Math.sin(a) * Math.cos(e) * r)) return false; } return !solid(P[0], P[1], P[2]); };
const line = (solid, A, B) => { const d = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]); for (let s = 0.3; s < d; s += 0.1) { const k = s / d; if (solid(A[0] + (B[0] - A[0]) * k, A[1] + (B[1] - A[1]) * k, A[2] + (B[2] - A[2]) * k)) return false; } return true; };

console.log('a · the camera director');
{
  // a person 1.6 m before a wall, facing it (yaw 0 faces −z; the wall at z = −2 … −3): the front is shut — a side
  const solid = boxes([[-20, 64, -3, 20, 80, -2]]);
  const S = { head: [0.5, 65.6, 0.5 - 0.9], yaw: 0 };
  const f = F3.frame(solid, S, { sun: null });
  const d = f ? Math.hypot(f.P[0] - S.head[0], f.P[2] - S.head[2]) : 0;
  check(!!f && f.clear && lens(solid, f.P, 0.4) && line(solid, f.P, S.head), `before a wall: the lens in the open (${f ? f.P.map(v => v.toFixed(1)).join(', ') : '-'}), the line to the face clear`);
  check(!!f && d >= 2 && d <= 5.2, `… ${d.toFixed(2)} m from the face`);
  // the camera looks at the face
  if (f) { const dx = S.head[0] - f.P[0], dz = S.head[2] - f.P[2], yaw = Math.atan2(-dx, -dz); check(Math.abs(Math.atan2(Math.sin(yaw - f.yaw), Math.cos(yaw - f.yaw))) < 0.02, 'the camera looks at the face'); }
  // in the open, in front: 3–5 m, from the front half
  const open = boxes([]), S2 = { head: [10.5, 65.6, 10.5], yaw: 1.2 };
  const f2 = F3.frame(open, S2, {});
  const d2 = f2 ? Math.hypot(f2.P[0] - S2.head[0], f2.P[2] - S2.head[2]) : 0;
  const fwd = [-Math.sin(S2.yaw), -Math.cos(S2.yaw)], toC = f2 ? [(f2.P[0] - S2.head[0]) / d2, (f2.P[2] - S2.head[2]) / d2] : [0, 0];
  check(!!f2 && d2 >= 3 && d2 <= 5 && fwd[0] * toC[0] + fwd[1] * toC[1] > 0.7, `in the open: before the face (${(fwd[0] * toC[0] + fwd[1] * toC[1]).toFixed(2)}) at ${d2.toFixed(2)} m`);
  // a corridor 2 wide (walls at x ≤ −1 and x ≥ 2), the person facing along it, a door frame 2 m before it: pulled back
  const cor = boxes([[-9, 64, -30, -1, 80, 30], [2, 64, -30, 9, 80, 30], [-1, 66, -3, 2, 80, -3]]);
  const S3 = { head: [0.5, 65.6, 0.5], yaw: 0 };
  const f3 = F3.frame(cor, S3, {});
  check(!!f3 && lens(cor, f3.P, 0.4) && line(cor, f3.P, S3.head), `a narrow corridor: the lens in the open, the line clear (${f3 ? f3.P.map(v => v.toFixed(1)).join(', ') + ', ' + Math.hypot(f3.P[0] - 0.5, f3.P[2] - 0.5).toFixed(2) + ' m' : '-'})`);
  // a room 4 × 4: nowhere 3 m away — the best within the room, still in the open
  const room = boxes([[-3, 64, -3, 4, 80, -3], [-3, 64, 4, 4, 80, 4], [-3, 64, -3, -3, 80, 4], [4, 64, -3, 4, 80, 4], [-3, 68, -3, 4, 68, 4]]);
  const f4 = F3.frame(room, { head: [0.5, 65.6, 0.5], yaw: 0.4 }, {});
  check(!!f4 && lens(room, f4.P, 0.4) && line(room, f4.P, [0.5, 65.6, 0.5]), `a small room: still in the open (${f4 ? f4.P.map(v => v.toFixed(1)).join(', ') : '-'})`);
  // a tight yard open to the sky (walls 5 high a block off on every side — Ocker's native had no frame in
  // runs 3 and 4): the frame from above, the lens in the open, the line to the face clear
  const yard = boxes([[-1, 64, -1, 2, 68, -1], [-1, 64, 2, 2, 68, 2], [-1, 64, -1, -1, 68, 2], [2, 64, -1, 2, 68, 2]]);
  const fy = F3.frame(yard, { head: [0.5, 65.76, 0.5], yaw: 0 }, {});
  check(!!fy && lens(yard, fy.P, 0.3) && line(yard, fy.P, [0.5, 65.76, 0.5]), `a tight yard: a frame from above (${fy ? fy.P.map(v => v.toFixed(1)).join(', ') : 'none'})`);
  // a thousand random walled places: never inside a wall
  let bad = 0, none = 0, rs = 7; const rnd = () => (rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let k = 0; k < 400; k++) {
    const L = []; for (let j = 0; j < 7; j++) { const x = Math.floor(rnd() * 16 - 8), z = Math.floor(rnd() * 16 - 8); L.push([x, 64, z, x + Math.floor(rnd() * 4), 64 + Math.floor(rnd() * 4), z + Math.floor(rnd() * 4)]); }
    const so = boxes(L); if (so(0.5, 65, 0.5) || so(0.5, 64.2, 0.5)) continue;
    const q = F3.frame(so, { head: [0.5, 65.6, 0.5], yaw: rnd() * 6.28 }, {});
    if (!q) { none++; continue; }
    if (!lens(so, q.P, 0.35) || !line(so, q.P, [0.5, 65.6, 0.5])) { bad++; if (bad === 1) console.log('    (bad: ' + q.P.map(v => v.toFixed(2)).join(', ') + ' · ' + JSON.stringify(L) + ')'); }
  }
  check(bad === 0, `400 random cluttered places: never in a wall, the face always in view (${bad} bad, ${none} without a frame)`);
  // someone standing before the face: the lens goes round them
  const fa = F3.frame(open, { head: [0.5, 65.6, 0.5], yaw: 0 }, { avoid: [[0.5, -1.6]] });
  const seg = fa ? (() => { const dx = fa.P[0] - 0.5, dz = fa.P[2] - 0.5, L2 = dx * dx + dz * dz, k = Math.max(0, Math.min(1, (0 * dx + -2.1 * dz) / L2)); return Math.hypot(0 - dx * k, -2.1 - dz * k); })() : 0;
  check(!!fa && seg > 0.5, `someone before the face: the line goes round them (${seg.toFixed(2)} m off)`);
  // the sun: the camera on the sun's side (the faces lit)
  const fs = F3.frame(open, { head: [0.5, 65.6, 0.5], yaw: 0 }, { sun: 0 });   // the sun toward +x (the angle atan2(z, x))
  check(!!fs && fs.P[0] > 0.5 + 0.5, `the golden hour: the camera on the sun's side (x ${fs ? (fs.P[0] - 0.5).toFixed(2) : '-'})`);
  // a group: farther and raised
  const g = F3.frameGroup(cor, [0.5, 65, 0.5], 1.6, {});
  check(!!g && lens(cor, g.P, 0.4) && line(cor, g.P, g.T) && g.P[1] > 65.8, `a group in a corridor: the lens in the open, raised (${g ? g.P.map(v => v.toFixed(1)).join(', ') : '-'})`);
  const deg = (r) => r * 180 / Math.PI, pf = deg(F3.portraitFov(3.8, false)), gf = deg(F3.groupFov(6.5, 1.6, 16 / 9));
  check(pf > 14 && pf < 25 && gf > pf && gf <= 75, `the lens: a portrait at 3.8 m ${pf.toFixed(0)}°, a group of 1.6 m at 6.5 m ${gf.toFixed(0)}°`);
  const g2 = F3.frameGroup(open, [0.5, 65, 0.5], 1.6, {});
  const gd = g2 ? Math.hypot(g2.P[0] - 0.5, g2.P[2] - 0.5) : 0;
  check(!!g2 && gd >= 3.5 && gd <= 9, `a group in the open: ${gd.toFixed(1)} m`);
}

console.log('b · the circle dance');
{
  check(F3.ringR(6) >= 1.25 && F3.ringR(6) <= 1.6 && F3.ringR(3) >= 1.0 && F3.ringR(10) <= 2.6, `the ring's radius by the hands' reach (3: ${F3.ringR(3).toFixed(2)}, 6: ${F3.ringR(6).toFixed(2)}, 10: ${F3.ringR(10).toFixed(2)})`);
  const chord = (n) => 2 * F3.ringR(n) * Math.sin(Math.PI / n);
  check([4, 5, 6, 7, 8].every(n => chord(n) <= 1.5), `neighbours near enough to hold hands (chords ${[4, 5, 6, 7, 8].map(n => chord(n).toFixed(2)).join(', ')} m)`);
  // a native plaza: a monument of radius 2.6 in the middle, the plaza 7 round; the player 3.5 m off the middle
  const pz = { x: 0, z: 0, r: 7 };
  const mon = (x, z) => Math.hypot(x - 0.5, z - 0.5) > 2.6 && Math.hypot(x - 0.5, z - 0.5) < 14;
  const R = F3.danceRing(mon, pz, [3.0, 65, 2.0], 6);
  const ringOpen = (open, D) => { for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; if (!open(D.c[0] + Math.cos(a) * D.r, D.c[1] + Math.sin(a) * D.r)) return false; } return open(D.c[0], D.c[1]); };
  check(!!R && R.ok && ringOpen(mon, R), `a plaza with a monument: the ring off it (centre ${R ? R.c.map(v => v.toFixed(1)).join(', ') : '-'}, r ${R ? R.r.toFixed(2) : '-'}), open all round`);
  check(!!R && Math.hypot(R.c[0] - 3, R.c[1] - 2) < 4, `… near the player (${R ? Math.hypot(R.c[0] - 3, R.c[1] - 2).toFixed(1) : '-'} m)`);
  // the open field: round the player
  const R2 = F3.danceRing(() => true, null, [10, 65, 10], 5);
  check(!!R2 && R2.ok && Math.hypot(R2.c[0] - 10, R2.c[1] - 10) < 0.01, 'the open field: the ring round the player');
  // a wall 1 m beside the player: moved off it
  const wall = (x, z) => x < 11;
  const R3 = F3.danceRing(wall, null, [12, 65, 10], 6);
  check(!!R3 && R3.ok && ringOpen(wall, R3), `a wall beside the player: the ring moved off it (centre x ${R3 ? R3.c[0].toFixed(1) : '-'})`);
  // nowhere open: not ok (the dance falls back to dancing in place)
  const R4 = F3.danceRing(() => false, null, [0, 65, 0], 6);
  check(!!R4 && !R4.ok, 'nowhere open: no ring (the members dance where they stand)');
  check(R && R.w > 0.15 && R.w < 0.6, `the ring turns slowly (${R ? R.w : '-'} rad/s)`);
  // the pose: arms out toward the neighbours, more for a wider chord; a sway and a step
  const P0 = () => ({ body: [0, 0, 0, 0, 0, 0], head: [0, 0, 0, 0, 0, 0], arm_l: [0, 0, 0, 0, 0, 0], arm_r: [0, 0, 0, 0, 0, 0], fore_l: [0, 0, 0, 0, 0, 0], fore_r: [0, 0, 0, 0, 0, 0], leg_l: [0, 0, 0, 0, 0, 0], leg_r: [0, 0, 0, 0, 0, 0], shin_l: [0, 0, 0, 0, 0, 0], shin_r: [0, 0, 0, 0, 0, 0] });
  const a = F3.ringPose(P0(), 1, 0.3, 1.2, false), b = F3.ringPose(P0(), 1, 0.3, 1.5, false), c = F3.ringPose(P0(), 1, 1.9, 1.2, false);
  check(a.arm_l[2] < -0.4 && a.arm_r[2] > 0.4, `hands joined: the left arm out to the left, the right to the right (${a.arm_l[2].toFixed(2)}, ${a.arm_r[2].toFixed(2)})`);
  check(b.arm_r[2] > a.arm_r[2], 'a wider gap: the arms higher');
  check(Math.abs(a.body[2] - c.body[2]) > 0.03 && Math.abs(a.leg_l[2] - c.leg_l[2]) + Math.abs(a.leg_r[2] - c.leg_r[2]) > 0.05, 'the body sways, the legs step');
}

console.log('c · the moods over a day');
{
  const m = (t) => F3.mood(t, 3);
  check(m(23400).k === 'sleepy' && m(400).k === 'sleepy' && m(400).lids > 0.3, `dawn: sleepy (lids ${m(400).lids})`);
  check(m(6000).k === 'cheer' && m(6000).smile > m(3000).smile, `noon: cheerful (smiles ${m(6000).smile}/s)`);
  check(m(11600).k === 'cosy' && m(11600).lids > 0 && m(11600).lids < m(400).lids, `dusk: cosy (lids ${m(11600).lids})`);
  check(m(18000).k === null, 'night: none (they sleep)');
  let spread = new Set(); for (let s = 0; s < 20; s++) spread.add(F3.mood(1500, s).k); check(spread.size >= 2, 'not everyone at once: the morning goes by the person (' + [...spread].join(', ') + ')');
}

console.log('d · the far face');
{
  const L = Folk.look(31, 'scholar', 'adult'), def = Folk.buildFine(L), f = def.fine;
  check(!!f.faceFar && def.order.includes('faceFar') && def.rig.faceFar[0] === 'head', 'the faceFar part hangs on the head');
  const cnt = (q) => { let n = 0; for (const v of q.c) if (v) n++; return n; };
  check(cnt(f.faceFar) >= 14, `big simple eyes and a smile (${cnt(f.faceFar)} fine voxels)`);
  // it stands before the eyes (a smaller z: the face looks toward −z)
  const zMin = (q, tag) => { let z = 1e9; for (let Y = 0; Y < q.sy; Y++) for (let Z = 0; Z < q.sz; Z++) for (let X = 0; X < q.sx; X++) { const v = q.c[q.i(X, Y, Z)]; if (v && (tag === undefined || ((v >>> 26) & 7) === tag)) z = Math.min(z, Z - q.oz); } return z; };
  check(zMin(f.faceFar) < zMin(f.head, 7), `before the eyes (${zMin(f.faceFar)} < ${zMin(f.head, 7)})`);
  // the most bones a person has: a child, an elder, with two things held — within the texture's row
  let most = 0; for (let s = 0; s < 60; s++) for (const age of ['adult', 'child', 'elder']) { const d = Folk.buildFine(Folk.look(s, ['farmer', 'smith', 'scholar', 'guard', 'merchant'][s % 5], age)); most = Math.max(most, d.order.length); }
  check(most <= 20, `the bones within the people's texture row (${most} ≤ 20)`);
  check(F3.farFace(5) === false && F3.farFace(7) === true && F3.FAR_FACE >= 5.5 && F3.FAR_FACE <= 7, `shown from ${F3.FAR_FACE} m`);
  // the voxel LOD (Very Low / Low far): its head keeps two dark eyes on the face
  const lo = Folk.buildLow(L), hg = lo.parts.head.grid;
  let dark = 0; for (let Y = 0; Y < hg.sy; Y++) for (let X = 0; X < hg.sx; X++) for (let Z = 0; Z < hg.sz; Z++) { const v = hg.get(X, Y, Z); if (!v) continue; const c = v & 0xffffff, lum = ((c >> 16) & 255) * 0.3 + ((c >> 8) & 255) * 0.59 + (c & 255) * 0.11; if (lum < 60) dark++; break; }
  check(dark >= 2, `the voxel LOD's face: ${dark} dark eye voxels on the front`);
}

console.log('d2 · a portrait\'s subject stands calm (no arms up from a held clip: the steps draw nothing, the timers do not run out)');
{
  const a = { joyClip: 'cheer', waveT: 2, stretchT: 1.5, festRole: null, dance: false, expr: 'wow', exprT: 1 };
  F3.calm(a);
  check(!a.joyClip && !(a.waveT > 0) && !(a.stretchT > 0) && !a.expr, 'F3.calm clears the clips (cheer, wave, stretch, an expression)');
  const b = { joyClip: null, dance: true, ringDance: { chord: 1.4 } }; F3.calm(b);
  check(b.dance && b.ringDance, '… a dancer keeps dancing');
}

console.log('e · the texts');
{
  const D = VR.I18N.dict, miss = F3.TEXT_KEYS.filter(k => !(D.de && D.de[k]) || !(D.en && D.en[k]));
  check(F3.TEXT_KEYS.length >= 2 && !miss.length, `the keys in both tables (${miss.join(', ') || 'all'})`);
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
