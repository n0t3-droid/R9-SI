// e-ctx · the travel camera (erlebnis §2 and §5; plan docs/superpowers/plans/2026-10-22-e-ctx.md §2.3): VR.DirCam's pure
// parts — the shots a trip is cut from.
//  (a) compose: the target in the upper third and the ship small in the lower third (projected through the camera it
//      returns), for a high landmark, a low town, near and far
//  (b) lift: a camera behind a hill is raised until the line to the subject clears the ground
//  (c) the cut rules over a scripted trip: each phase opens with its shot, a shot lasts ≥ 4 s (the call's shot runs on
//      through the boarding), the cruise cuts on motion (a turn begins, the bank flips) or at 8 s, never the same shot
//      twice in a row, a fly-by only at speed, the arrival's framing
//  (d) the free look: the mouse turns the shot, and after 1.5 s at rest it eases back
//  (e) every shot of a trip gives a finite camera that looks at its subject
const path = require('path');
global.VR = {};
try { require(path.join(__dirname, '..', 'src', 'main', 'directorcam.js')); } catch (e) { console.log('  ! directorcam.js: ' + e.message); }
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const D = VR.DirCam;
if (!D || typeof D.compose !== 'function') { console.log('  ✗ VR.DirCam.compose missing'); console.log('FAILED 1'); process.exit(1); }
const DEG = Math.PI / 180;
// project a world point through a pose {x, y, z, yaw, pitch, fov} (no roll; the game's convention: forward −z at yaw 0)
const project = (P, c, aspect) => {
  const cy = Math.cos(c.yaw), sy = Math.sin(c.yaw), cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
  const f = [-sy * cp, sp, -cy * cp], r = [cy, 0, -sy], u = [-r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1]];
  const d = [P[0] - c.x, P[1] - c.y, P[2] - c.z], z = d[0] * f[0] + d[1] * f[1] + d[2] * f[2];
  const ty = Math.tan(c.fov / 2), tx = ty * (aspect || 16 / 9);
  return { x: (d[0] * r[0] + d[2] * r[2]) / z / tx, y: (d[0] * u[0] + d[1] * u[1] + d[2] * u[2]) / z / ty, z };
};

console.log('a · compose (the target up, the ship down)');
const cases = [
  ['the citadel 300 m ahead, the ship at 150 m', [-420, 200, 380], [-200, 150, 200], 7],
  ['a low town 500 m ahead, the ship at 130 m', [300, 78, 40], [-150, 130, 40], 6],
  ['the isles, the ship 120 m out and level with them', [330, 160, 140], [250, 160, 60], 8],
  ['the temple 900 m ahead, a big ship', [0, 120, -15], [600, 140, -15], 14],
];
for (const [name, Tp, Sp, size] of cases) {
  const c = D.compose(Tp, Sp, { fov: 60 * DEG, size });
  const pt = project(Tp, c), ps = project(Sp, c);
  const dS = Math.hypot(Sp[0] - c.x, Sp[1] - c.y, Sp[2] - c.z), ang = 2 * Math.atan(size / dS) / c.fov;
  check(pt.z > 0 && ps.z > 0 && Math.abs(pt.y - 1 / 3) < 0.07 && Math.abs(ps.y + 1 / 3) < 0.07 && Math.abs(pt.x) < 0.05 && Math.abs(ps.x) < 0.05,
    `${name}: target y ${pt.y.toFixed(2)}, ship y ${ps.y.toFixed(2)} (thirds ±0.07), fov ${(c.fov / DEG).toFixed(0)}°`);
  check(ang < 0.35, `${name}: the ship is small (${(ang * 100).toFixed(0)} % of the frame's height)`);
}

console.log('b · lift');
const hill = (x, z) => (Math.abs(x - 50) < 15 ? 140 : 80);
const C0 = [0, 100, 0], S0 = [100, 120, 0];
const C1 = D.lift(hill, C0.slice(), S0);
let clear = true; for (let i = 1; i < 20; i++) { const u = i / 20, x = C1[0] + (S0[0] - C1[0]) * u, y = C1[1] + (S0[1] - C1[1]) * u; if (y < hill(x, 0) + 1.5) clear = false; }
check(C1[1] > C0[1] && clear, `a hill between: the camera rises ${(C1[1] - C0[1]).toFixed(1)} m and sees the ship`);
const C2 = D.lift(() => 80, [0, 100, 0], S0);
check(C2[1] === 100, 'nothing between: it stays');

console.log('c · the cuts');
const seq = D.seqState(), shots = [];
const T = (t0, t1, f) => ({ t0, t1, f });
const script = [
  T(0, 14, () => ({ phase: 'call' })), T(14, 16, () => ({ phase: 'board' })), T(16, 24, () => ({ phase: 'takeoff', speed: 8 })),
  // cruise 24–66: turns begin at 31, 33 (too soon after a cut) and 47; the bank flips at 52
  T(24, 66, (t) => ({ phase: 'cruise', speed: 70, yawRate: (t > 31 && t < 32.5) || (t > 33 && t < 34) || (t > 47 && t < 49) ? 0.3 : 0, bank: t > 52 && t < 55 ? -0.3 : 0.05, passed: false })),
  T(66, 80, () => ({ phase: 'approach', speed: 30 })), T(80, 81.5, () => ({ phase: 'land', speed: 3 })), T(81.5, 86, () => ({ phase: 'arrive', speed: 0 })),
];
const dt = 1 / 30;
for (const part of script) for (let t = part.t0; t < part.t1 - 1e-9; t += dt) {
  const s = part.f(t); const k = D.step(seq, s, dt);
  if (!shots.length || shots[shots.length - 1].kind !== k || seq.t === 0) { if (seq.t === 0 || !shots.length) shots.push({ kind: k, t0: t, phase: s.phase }); }
}
for (let i = 0; i < shots.length; i++) shots[i].t1 = i + 1 < shots.length ? shots[i + 1].t0 : 86;
console.log('    ' + shots.map(s => `${s.kind} ${s.t0.toFixed(1)}–${s.t1.toFixed(1)}`).join(' · '));
const firstOf = (ph) => shots.find(s => s.phase === ph || s.t0 >= script.find(p => p.f(p.t0).phase === ph).t0);
check(shots[0].kind === 'call' && !shots.some(s => s.kind === 'board'), 'the call\'s shot opens the trip and runs on through the boarding');
check(shots.find(s => s.kind === 'takeoff') && shots.find(s => s.kind === 'takeoff').t0 >= 16 - 1e-6, 'the take-off shot when the ship lifts');
const short = shots.filter((s, i) => i < shots.length - 1 && s.t1 - s.t0 < 4 - 0.01);
check(!short.length, 'every shot lasts ≥ 4 s' + (short.length ? ': ' + short.map(s => s.kind + ' ' + (s.t1 - s.t0).toFixed(1)).join(', ') : ''));
const cruise = shots.filter(s => ['chase', 'side', 'flyby'].includes(s.kind));
check(cruise.length >= 4 && cruise.every((s, i) => i === 0 || s.kind !== cruise[i - 1].kind), `the cruise: ${cruise.map(s => s.kind).join(' → ')} (no shot twice in a row)`);
check(cruise.every(s => s.t1 - s.t0 <= 8 + 0.01 || s.t1 > 66), 'no cruise shot longer than 8 s');
const atTurn = cruise.some(s => Math.abs(s.t0 - 31) < 0.1) && !cruise.some(s => Math.abs(s.t0 - 33) < 0.1) && cruise.some(s => Math.abs(s.t0 - 47) < 0.1);
check(atTurn, 'cuts on motion: at the turn at 31 s and at 47 s, not at 33 s (the shot was too young)');
check(shots.some(s => s.kind === 'approach' && Math.abs(s.t0 - 66) < 0.1), 'the approach opens with its composition');
const land = shots.find(s => s.kind === 'land'), arr = shots.find(s => s.kind === 'arrive');
check(land && arr && arr.t0 >= land.t0 + 4 - 0.01, `the landing shot keeps its 4 s before the arrival's framing (land ${land && land.t0.toFixed(1)}, arrive ${arr && arr.t0.toFixed(1)})`);
const seq2 = D.seqState(); for (let t = 0; t < 30; t += dt) D.step(seq2, { phase: 'cruise', speed: 6, yawRate: 0 }, dt);
check(!seq2.hist.includes('flyby'), 'a slow cruise never cuts to a fly-by');
// the call with the ship's stages: in over the land (cruise) 0–12 s, over its pad (hover) 12–14, coming down (settle)
// 14–18, the boarding 18–20, the take-off: the pad shot when it comes down, through the boarding
const seq3 = D.seqState(), cs3 = [];
const st3 = (t) => (t < 18 ? { phase: 'call', stage: t < 12 ? 'cruise' : t < 14 ? 'hover' : 'settle' } : t < 20 ? { phase: 'board', stage: 'down' } : { phase: 'takeoff', speed: 8 });
for (let t = 0; t < 26; t += dt) { const k = D.step(seq3, st3(t), dt); if (!cs3.length || cs3[cs3.length - 1].k !== k) cs3.push({ k, t }); }
console.log('    ' + cs3.map(s => `${s.k} ${s.t.toFixed(1)}`).join(' · '));
const pl = cs3.find(s => s.k === 'callland');
check(cs3[0].k === 'call' && pl && Math.abs(pl.t - 12) < 0.1 && cs3[2] && cs3[2].k === 'takeoff' && cs3[2].t >= 20 - 1e-6, 'the call: behind you while the ship comes in, the pad shot as it comes down (12 s), on through the boarding, the take-off after');
const seq4 = D.seqState(); for (let t = 0; t < 3; t += dt) D.step(seq4, { phase: 'call', stage: t < 1 ? 'cruise' : 'hover' }, dt);
check(seq4.kind === 'call', 'a ship that is over its pad within 4 s: the call\'s shot keeps its 4 s first');

console.log('d · the free look');
const L = D.lookState();
D.look(L, 200, -50, 1 / 60, 0.0024);
check(Math.abs(L.yaw + 0.48) < 1e-6 && Math.abs(L.pitch - 0.12) < 1e-6, `the mouse turns the shot (${L.yaw.toFixed(2)}, ${L.pitch.toFixed(2)})`);
for (let i = 0; i < 60; i++) D.look(L, 0, 0, 1 / 60, 0.0024);
check(Math.abs(L.yaw + 0.48) < 0.02, 'at rest for 1 s it stays');
for (let i = 0; i < 240; i++) D.look(L, 0, 0, 1 / 60, 0.0024);
check(Math.abs(L.yaw) < 0.06 && Math.abs(L.pitch) < 0.02, `after 5 s it has eased back (${L.yaw.toFixed(3)})`);
D.look(L, 1e5, 1e5, 1 / 60, 0.0024);
check(Math.abs(L.yaw) <= 100 * DEG + 1e-9 && Math.abs(L.pitch) <= 60 * DEG + 1e-9, 'the look stays within ±100° and ±60°');

console.log('e · every shot looks at its subject');
const subj = { pos: [100, 140, 50], vel: [-40, 0, -10], heading: Math.atan2(40, 10), size: 7, yawRate: 0.1, roll: 0.2 };
const target = { pos: [-420, 180, 380], base: 112, top: 249 };
let okAll = true, bad = [];
for (const kind of ['takeoff', 'chase', 'side', 'flyby', 'approach', 'land', 'arrive', 'call', 'walk']) {
  const sq = D.seqState(); sq.kind = kind; sq.t = 0.5;
  const cam = D.pose(sq, { subj, target, player: [90, 82, 60], spot: [95, 82, 55], start: [130, 81, 60], ground: () => 80, base: { fov: 70 * DEG } }, D.lookState(), {});
  const fin = ['x', 'y', 'z', 'yaw', 'pitch', 'fov'].every(k => Number.isFinite(cam[k]));
  const look = kind === 'arrive' ? target.pos : kind === 'walk' || kind === 'call' ? null : subj.pos;
  const p = look ? project(look, cam) : { z: 1, x: 0, y: 0 };
  if (!fin || p.z <= 0 || Math.abs(p.x) > 1 || Math.abs(p.y) > 1) { okAll = false; bad.push(kind + (fin ? ` (${p.x.toFixed(2)}, ${p.y.toFixed(2)})` : ' NaN')); }
}
check(okAll, 'take-off, chase, side, fly-by, approach, land, arrive, call, walk: finite, the subject in the frame' + (bad.length ? ': ' + bad.join(', ') : ''));
// the pad shot: you and the ship coming down over the pad 16 m away, both in the frame, the camera low on the ground
{
  const sq = D.seqState(); sq.kind = 'callland'; sq.t = 0.5;
  const P = [0.5, 81, 48.5], pad = [-11.5, 81, 59.5];
  let all = true, low = true, why = '';
  for (const h of [22, 12, 2]) {   // hovering, settling, down
    const ship = { pos: [pad[0], pad[1] + h + 3, pad[2]], vel: [0, -2, 0], heading: 0.8, size: 7, yawRate: 0, roll: 0 };
    const cam = D.pose(sq, { subj: ship, target, player: P, ship: ship.pos, spot: pad, ground: () => 80, base: { fov: 70 * DEG } }, D.lookState(), {});
    const pp = project([P[0], P[1] + 1, P[2]], cam), ps = project(ship.pos, cam);
    if (!(pp.z > 0 && ps.z > 0 && Math.abs(pp.x) < 0.95 && Math.abs(pp.y) < 0.95 && Math.abs(ps.x) < 0.95 && Math.abs(ps.y) < 0.95)) { all = false; why += ` h ${h}: you (${pp.x.toFixed(2)}, ${pp.y.toFixed(2)}) ship (${ps.x.toFixed(2)}, ${ps.y.toFixed(2)})`; }
    if (cam.y > 80 + 6) low = false;
  }
  check(all && low, 'the pad shot: you and the ship coming down beside you both in the frame, the camera low' + why);
}

// ============================================================================ e-cam · the highlight reel (plan docs/superpowers/plans/2026-10-31-e-cam.md)
console.log('f · the track (pose at 5 Hz, 20 minutes in ≤ 200 KB)');
{
  const Tr = D.Track ? new D.Track() : null;
  check(!!Tr, 'DirCam.Track exists');
  if (Tr) {
    check(Tr.bytes <= 200 * 1024, `the ring ${Math.round(Tr.bytes / 1024)} KB for ${Tr.cap} samples (≤ 200 KB)`);
    check(Tr.cap >= 6000, `${Tr.cap} samples = ${(Tr.cap / 5 / 60).toFixed(0)} minutes at 5 Hz`);
    // 25 minutes at 60 fps: one sample per 0.2 s, the oldest five minutes gone
    for (let i = 0; i <= 25 * 60 * 60; i++) { const t = i / 60; Tr.rec(t, t * 2, 70, -t, (t * 0.1) % (2 * Math.PI) - Math.PI, 6000 + t * 20, 0); }
    check(Tr.n === Tr.cap, `the ring full at ${Tr.n}`);
    const a = Tr.at(20 * 60 + 0.1), b = Tr.at(60), c = Tr.at(25 * 60 - 0.05);
    check(a && Math.abs(a.x - (20 * 60 + 0.1) * 2) < 0.05 && Math.abs(a.z + 20 * 60 + 0.1) < 0.05, `interpolated between two samples (x ${a && a.x.toFixed(2)})`);
    check(b === null, 'older than 20 minutes: gone');
    check(c && Math.abs(c.tod - (6000 + (25 * 60 - 0.05) * 20)) < 5, 'the time of day kept with the pose');
    const T2 = new D.Track(); T2.rec(0, 0, 0, 0, 3.1, 0, 0); T2.rec(0.2, 0, 0, 0, -3.1, 0, 0);
    const y = T2.at(0.1).yaw; check(Math.abs(Math.abs(y) - Math.PI) < 0.01, `the yaw interpolated the short way (${y.toFixed(2)})`);
    T2.rec(0.4, 500, 0, 0, 0, 0, 2); check(T2.at(0.3) === null || T2.at(0.3).x < 1, 'no interpolation across a change of world');
  }
}

console.log('g · picking the highlights');
const ev = (t, kind, sub, w, x, z, o) => Object.assign({ t, kind, sub, w, x, y: 70, z, r: 8, inView: true, dim: 'overworld', tod: 6000 }, o || {});
const SESSION = [
  ev(20, 'travel', 'arrive', 3, 0, -15),
  ev(60, 'build', 'site', 2, 40, 10),
  ev(95, 'build', 'site_done', 3, 40, 10),
  ev(130, 'sky', 'skyray', 3, 100, 50),
  ev(131, 'sky', 'skyray', 3, 104, 52),                 // (the same act twice: merged)
  ev(200, 'milestone', 'freed', 5, -200, 120, { r: 40 }),
  ev(260, 'discovery', 'outpost', 3, -260, 160),
  ev(330, 'milestone', 'boss', 5, -300, 300, { r: 60 }),
  ev(400, 'space', 'moon_land', 4, 10, 10, { dim: 'basalt', card: true }),
  ev(470, 'space', 'star_jump', 4, 0, 0, { dim: 'x.7', card: true }),
  ev(520, 'travel', 'arrive', 3, 300, 40),
  ev(540, 'travel', 'arrive', 3, 310, 60),
  ev(560, 'travel', 'arrive', 3, 330, 80),
  ev(580, 'travel', 'ferry_arrive', 3, 340, 80),
  ev(600, 'discovery', 'wonder', 4, 0, -320),
];
const SAMPLES = [];
for (let t = 0; t < 620; t++) SAMPLES.push({ t, x: t, z: 0, sky: t >= 300 && t < 318 ? 'low_sun' : '', tod: t >= 300 && t < 318 ? 11900 : 6000, landmark: '' });
const P = D.pick ? D.pick(SESSION, SAMPLES, {}) : null;
check(Array.isArray(P), 'DirCam.pick exists');
if (P) {
  const subs = P.map((h) => h.sub);
  console.log('    picked: ' + P.map((h) => `${h.sub}@${h.t}`).join(' '));
  check(subs.includes('freed') && subs.includes('boss'), 'every peak (weight 5) in the reel');
  check(!subs.includes('site'), 'weight 2 left out');
  check(subs.filter((s) => s === 'skyray').length === 1, 'the same act a second later is one highlight');
  check(subs.filter((s) => s === 'arrive').length <= 2, `at most two of one sub (${subs.filter((s) => s === 'arrive').length} arrivals)`);
  check(subs.includes('sunset'), 'the golden hour found in the samples (18 s of low sun at 11,900)');
  check(subs.includes('moon_land') && subs.includes('star_jump'), 'the moon landing and the star jump (postcards from other worlds)');
  check(P.every((h, i) => i === 0 || h.t >= P[i - 1].t), 'in the order they happened');
  const kinds = {}; for (const h of P) kinds[h.kind] = (kinds[h.kind] || 0) + 1;
  check(Object.values(kinds).every((n) => n <= 3), 'at most three of one kind ' + JSON.stringify(kinds));
  check(D.pick([], [], {}).length === 0 && D.pick([ev(5, 'build', 'site', 2, 0, 0)], [], {}).length === 0, 'a quiet session: no highlights (the reel says so)');
  // a long session: 40 highlights → still ≤ 90 s
  const many = []; for (let i = 0; i < 40; i++) many.push(ev(i * 30, ['travel', 'sky', 'discovery', 'build'][i % 4], 's' + i, 3 + (i % 3 === 0 ? 1 : 0), i * 20, 0));
  const PM = D.pick(many, [], {}), plM = D.reelPlan(PM, {});
  check(plM.dur <= 90 && plM.dur >= 30, `40 candidates → ${PM.length} highlights, ${plM.dur.toFixed(0)} s (30–90)`);
}

console.log('h · the plan: timing and the cut rules');
if (P && D.reelPlan && D.stage) {
  const pl = D.reelPlan(P, { world: 'Herzland' });
  console.log('    shots: ' + pl.shots.map((s) => `${s.frame}:${s.dur}`).join(' ') + ` = ${pl.dur.toFixed(1)} s`);
  check(pl.dur >= 30 && pl.dur <= 90, `the reel ${pl.dur.toFixed(1)} s (30–90)`);
  check(pl.shots[0].frame === 'title' && pl.shots[pl.shots.length - 1].frame === 'end', 'an opening card and a closing card');
  check(pl.shots.every((s) => s.dur >= 3 && s.dur <= 8), 'every shot 3–8 s');
  check(pl.shots.every((s, i) => i === 0 || s.frame !== pl.shots[i - 1].frame), 'never the same framing twice in a row');
  check(pl.shots.filter((s) => s.h).every((s) => s.tod === s.h.tod), 'each shot at its moment\'s time of day');
  check(pl.shots.every((s) => typeof s.cap === 'string' && s.cap.length > 0), 'each shot has its caption key');
  const short = D.reelPlan(P.slice(0, 3), {});
  check(short.dur >= 30 || short.shots.every((s) => s.dur >= 7.99 || !s.h), `three highlights stretched (${short.dur.toFixed(1)} s)`);
  // stage every in-world shot over a hilly ground: finite, looks at its subject, clear line, moves at both ends
  const hill = (x, z) => 70 + 12 * Math.sin(x / 25) * Math.cos(z / 30);
  let ok = 0, clear = 0, moving = 0, seen = 0, thirds = 0, nIn = 0, why = '';
  for (const s of pl.shots) {
    if (!s.h || s.h.card) continue; nIn++;
    const H = s.h, Tp = [H.x, hill(H.x, H.z) + 4, H.z], A = [H.x + 25, hill(H.x + 25, H.z + 10), H.z + 10];
    const st = D.stage(s, { target: Tp, r: H.r || 8, avatar: (t) => ({ x: A[0] + t * 0.8, y: A[1], z: A[2], yaw: 0 }), ground: hill, sunAz: D.sunAz(s.tod) });
    const c0 = st.cam(0), c1 = st.cam(0.6), c9 = st.cam(s.dur - 0.6), cE = st.cam(s.dur);
    const fin = [c0, c9, cE].every((c) => ['x', 'y', 'z', 'yaw', 'pitch', 'fov'].every((k) => Number.isFinite(c[k])));
    if (fin) ok++; else why += ` ${s.frame}:nonfinite`;
    const mv = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) + Math.abs(a.yaw - b.yaw) * 20;
    if (mv(c0, c1) > 0.05 && mv(c9, cE) > 0.05) moving++; else why += ` ${s.frame}:still`;
    const mid = st.cam(s.dur / 2), subj = st.subject || Tp, pr = project(subj, mid);
    if (pr.z > 0 && Math.abs(pr.x) < 0.9 && Math.abs(pr.y) < 0.9) seen++; else why += ` ${s.frame}:off(${pr.x.toFixed(2)},${pr.y.toFixed(2)},${pr.z.toFixed(0)})`;
    let cl = true;
    for (const c of [c0, mid, cE]) for (let i = 1; i < 20; i++) { const u = i / 20; const x = c.x + (subj[0] - c.x) * u, y = c.y + (subj[1] - c.y) * u, z = c.z + (subj[2] - c.z) * u; if (u < 0.9 && y < hill(x, z) + 0.5) cl = false; }
    if (cl) clear++; else why += ` ${s.frame}:blocked`;
    if (s.frame === 'compose') { const pa = project([A[0] + s.dur * 0.4, A[1] + 1, A[2]], mid); if (pr.y > 0.1 && pa.y < 0 && pa.z > 0) thirds++; else why += ` compose:thirds(${pr.y.toFixed(2)},${pa.y.toFixed(2)})`; } else thirds++;
  }
  check(nIn > 0 && ok === nIn, `every in-world shot finite (${ok}/${nIn})` + why);
  check(moving === nIn, `every shot moves at its first and its last second — the cuts on motion (${moving}/${nIn})`);
  check(seen === nIn, `the subject in the picture in mid-shot (${seen}/${nIn})`);
  check(clear === nIn, `nothing between the eye and the subject on the height map (${clear}/${nIn})`);
  check(thirds === nIn, 'compose: the event above the middle, the avatar below');
  const sa = D.sunAz(11900), sun = [Math.cos(sa), Math.sin(sa)];
  const sc = pl.shots.find((s) => s.frame === 'sun');
  if (sc) { const st = D.stage(sc, { target: [0, 74, 0], r: 6, avatar: () => ({ x: 0, y: 70, z: 0, yaw: 0 }), ground: () => 69, sunAz: sa }), c = st.cam(sc.dur / 2); const f = [-Math.sin(c.yaw), -Math.cos(c.yaw)]; check(f[0] * sun[0] + f[1] * sun[1] > 0.7, 'the golden hour: the camera looks into the low sun'); }
  else check(false, 'a sun shot in the plan');
}

console.log('j · the line over the land: another side, the close shot, the tower over you');
{
  const H = { t: 10, kind: 'build', sub: 'site_done', w: 3, x: 0, y: 75, z: 0, r: 6, tod: 6000 };
  const av = () => ({ x: 30, y: 70, z: 0, yaw: 0 });
  // a wall on the avatar's side (x 12…20, 90 m high): the orbit comes from another side
  const wall = (x, z) => (x > 12 && x < 20 ? 160 : 70);
  const so = D.stage({ frame: 'orbit', dur: 5, h: H }, { target: [0, 75, 0], r: 6, avatar: av, ground: wall });
  const c = so.cam(2.5);
  check(so.lift <= 24 && Math.hypot(c.x - 0, c.z - 0) < 60 && c.y < 120, `a wall on your side: the orbit from another side (lift ${so.lift.toFixed(1)} m, camera y ${c.y.toFixed(0)})`);
  // the subject under a roof 130 m up (the Hangar Hall): close behind you, no lift
  const roof = (x, z) => (Math.hypot(x - 30, z) < 80 ? 200 : 70);
  const sc = D.stage({ frame: 'orbit', dur: 3, h: null }, { target: [30, 71.2, 0], r: 2, avatar: av, ground: roof });
  const c0 = sc.cam(0), c3 = sc.cam(3);
  check(sc.kind === 'close' && Math.hypot(c0.x - 30, c0.z) < 6 && c0.y < 75 && Math.hypot(c3.x - c0.x, c3.z - c0.z) > 0.05, `under a roof: the close shot behind you (${sc.kind}, ${Math.hypot(c0.x - 30, c0.z).toFixed(1)} m, y ${c0.y.toFixed(1)}), still moving`);
  // a temple 60 m over the avatar 25 m away: no camera 150 m up for the thirds
  const st = D.stage({ frame: 'compose', dur: 5, h: H }, { target: [0, 130, 0], r: 30, avatar: () => ({ x: 25, y: 70, z: 0, yaw: 0 }), ground: () => 69 });
  const cm = st.cam(2.5);
  check(cm.y - 70 < 45, `a tower over you: the camera ${(cm.y - 70).toFixed(0)} m over the avatar (≤ 45; ${st.kind})`);
}

console.log('i · restoration: the time of day, the view, the actors');
if (D.reelSave && D.reelRestore) {
  const g = { env: { ticks: 7777, setTime(t) { this.ticks = t; } }, zenFreezeTime: false, camMode: 2, hideHud: false,
    player: { pos: [1, 2, 3], yaw: 0.5, pitch: 0.1, flying: false, vel: [0, 0, 0], bob: 0.3, bobAmt: 0 }, renderer: { q: { scale: 0.55 } },
    padLife: { clock: 42 }, trams: { clock: 13 } };
  const s = D.reelSave(g);
  g.env.setTime(11900); g.zenFreezeTime = true; g.camMode = 1; g.player.pos = [500, 80, 500]; g.player.yaw = 2; g.player.bob = 9; g.renderer.q.scale = 0.45; D.reelRewind(g, s, 30); const rw = g.padLife.clock === 12 && g.trams.clock === 0; g.padLife.clock = 5;
  D.reelRestore(g, s);
  check(g.env.ticks === 7777 && g.zenFreezeTime === false, 'the time of day and its freeze given back');
  check(g.camMode === 2 && g.player.pos.join() === '1,2,3' && g.player.yaw === 0.5 && g.player.bob === 0.3, 'the view, the place and the pose given back');
  check(g.renderer.q.scale === 0.55, 'Very Low: the resolution given back');
  check(rw, 'the clock-driven actors rewound 30 s (pads 42 → 12, trams 13 → 0)'); check(g.padLife.clock === 42 && g.trams.clock === 13, 'the clock-driven actors given back');
} else check(false, 'DirCam.reelSave / reelRestore exist');

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
