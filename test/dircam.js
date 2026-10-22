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

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
