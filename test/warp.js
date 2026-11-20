// Bildwarp (src/main/warp.js): between two expensive frames a cheap one — the last picture turned to the newest look
// (the idea of VR headsets' timewarp and of Reflex 2's frame warp). The pure parts:
//   a  the camera matrix: the same look → every pixel maps to itself
//   b  a turn: the new view's centre is found in the old picture where the turn puts it (yaw and pitch)
//   c  the plan: a fast PC draws every frame whole; a slow one alternates whole | warp; a very slow one two warps a whole
//   d  never a warp: switched off, a menu or the photo mode (blocked), a step (moved), another field of view, the first frame
//   e  the texts in both tables
const V = require('./load_shared.js');
for (const f of ['i18n', 'lang_en', 'lang_de']) require(__dirname + '/../src/main/' + f + '.js');
require('../src/main/warp.js');
const W = V.Warp;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const cam = (yaw, pitch, fov) => ({ yaw, pitch, fov: fov || 1.2 });
const map = (M, x, y) => { const v = [M[0] * x + M[4] * y + M[8] + M[12], M[1] * x + M[5] * y + M[9] + M[13], 0, M[3] * x + M[7] * y + M[11] + M[15]]; return [v[0] / v[3], v[1] / v[3]]; };
{
  const A = W.vp(cam(0.3, 0.1), 16 / 9), M = W.mat(A, W.vp(cam(0.3, 0.1), 16 / 9));
  let worst = 0; for (const [x, y] of [[0, 0], [0.5, -0.3], [-0.9, 0.9]]) { const q = map(M, x, y); worst = Math.max(worst, Math.abs(q[0] - x), Math.abs(q[1] - y)); }
  check(worst < 1e-5, 'a  the same look: identity (' + worst.toExponential(1) + ')');
}
{
  // turn left by d (yaw grows): what is now in the centre was left of centre before... the old picture showed it at
  // x = −tan(d)/tan(fov/2)/aspect·… → compare with the exact projection of the new forward in the old camera
  const fov = 1.2, asp = 16 / 9, d = 0.05;
  const M = W.mat(W.vp(cam(0, 0, fov), asp), W.vp(cam(d, 0, fov), asp));
  const q = map(M, 0, 0), want = -Math.tan(d) / (Math.tan(fov / 2) * asp);
  check(Math.abs(q[0] - want) < 1e-4 && Math.abs(q[1]) < 1e-4, 'b  yaw: the new centre at x ' + q[0].toFixed(4) + ' in the old picture (want ' + want.toFixed(4) + ')');
  const M2 = W.mat(W.vp(cam(0, 0, fov), asp), W.vp(cam(0, d, fov), asp)), q2 = map(M2, 0, 0), w2 = Math.tan(d) / Math.tan(fov / 2);
  check(Math.abs(q2[1] - w2) < 1e-4, 'b  pitch: y ' + q2[1].toFixed(4) + ' (want ' + w2.toFixed(4) + ')');
}
{
  const st = W.state();
  const base = { on: true, blocked: false, moved: 0, fovSame: true, have: true };
  const run = (ms, n) => { const out = []; for (let i = 0; i < n; i++) { const k = W.decide(st, Object.assign({ fullMs: ms }, base)); out.push(k); W.done(st, k); } return out.join(''); };
  check(/^f+$/.test(run(14, 6)), 'c  70 fps: every frame whole');
  const s2 = run(34, 6); check(s2 === 'wfwfwf' || s2 === 'fwfwfw', 'c  30 fps: whole | warp alternate (' + s2 + ')');
  const s3 = run(60, 6); check(/^(fww|wfw|wwf)+$/.test(s3) && (s3.match(/w/g) || []).length === 4, 'c  16 fps: two warps a whole (' + s3 + ')');
  const one = (o) => W.decide(W.state(), Object.assign({ fullMs: 40 }, base, o));
  check(one({ on: false }) === 'f' && one({ blocked: true }) === 'f' && one({ moved: 1.5 }) === 'f' && one({ fovSame: false }) === 'f' && one({ have: false }) === 'f', 'd  off, a menu, a step, another fov, no picture yet: whole');
  check(one({}) === 'w', 'd  otherwise a warp');
}
{
  // c2 a 144 Hz monitor: the thresholds follow the screen's frame (measured), not 60 Hz
  const v = 1000 / 144, L = W.limits(v);
  check(L[0] < 12 && L[1] < 20, 'c2 144 Hz: a warp from ' + L[0].toFixed(1) + ' ms, two from ' + L[1].toFixed(1) + ' ms');
  const st = W.state(), base = { on: true, blocked: false, moved: 0, fovSame: true, have: true, vsync: v };
  const run = (ms, n) => { const out = []; for (let i = 0; i < n; i++) { const k = W.decide(st, Object.assign({ fullMs: ms }, base)); out.push(k); W.done(st, k); } return out.join(''); };
  check(run(14, 4) === 'wfwf', 'c2 144 Hz, 70 fps whole: whole | warp (144 shown)');
  const L60 = W.limits(1000 / 60); check(Math.abs(L60[0] - 22) < 2.5 && Math.abs(L60[1] - 45) < 3, 'c2 60 Hz: as before (' + L60.map(x => x.toFixed(1)).join(' / ') + ')');
  let ve; for (const iv of [33, 33, 34, 50]) ve = W.vsyncStep(ve, iv);
  check(ve === undefined, 'c2 slow frames only: the screen stays 60 Hz (unknown)');
  for (const iv of [7, 6.9, 33, 6.95, 20, 7]) ve = W.vsyncStep(ve, iv);
  check(Math.abs(ve - 6.95) < 1, 'c2 the screen\'s frame from the intervals (' + ve.toFixed(2) + ' ms at 144 Hz; slow frames barely move it)');
}
check(W.sqTarget({ warp: true }) === 38 && W.sqTarget({ warp: false }) === 55, 'c3 Smart Quality: whole frames at 38 with the warps (the picture keeps its quality), 55 without');
// f  the edge (owner's video, Ultra at 10 fps: a fast turn smeared the old picture's edge across a fifth of the screen):
//    W.edgeOut — how far the turned view reaches outside the old picture (uv units); past W.EDGE_MAX no warp, a whole frame
{
  const fov = 1.2, asp = 16 / 9;
  const Ms = W.mat(W.vp(cam(0, 0, fov), asp), W.vp(cam(0.01, 0, fov), asp)), Mb = W.mat(W.vp(cam(0, 0, fov), asp), W.vp(cam(0.25, 0, fov), asp));
  const es = W.edgeOut ? W.edgeOut(Ms) : -1, eb = W.edgeOut ? W.edgeOut(Mb) : -1;
  check(es >= 0 && es < 0.02 && eb > 0.15, 'f  edgeOut: a small turn ' + (+es).toFixed(3) + ', a big one ' + (+eb).toFixed(3));
  const base = { on: true, blocked: false, have: true, fovSame: true, moved: 0, vsync: 1000 / 60 };
  check(W.decide(W.state(), Object.assign({ fullMs: 40, edge: es }, base)) === 'w' && W.decide(W.state(), Object.assign({ fullMs: 40, edge: eb }, base)) === 'f', 'f  a big turn draws whole instead of smearing the edge');
  check(/EDGE_BLUR|edgeBlur/.test(require('fs').readFileSync(__dirname + '/../src/main/warp.js', 'utf8')), 'f  a small overshoot is filled soft (blurred along the edge), not a stretched streak');
}
const miss = ['g.set.warp', 'g.set.warp.tip'].filter(k => !(V.I18N.dict.de[k] && V.I18N.dict.en[k]));
check(!miss.length, 'e  texts in both tables ' + miss.join(','));
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
