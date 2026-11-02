// f-polish10 · f-polish9's open items (docs/superpowers/plans/2026-11-02-f-polish10.md):
//   a · the kneeling hug from the child's facing side: the lens where the child looks (a little to its left, where its
//       head passes the adult's), low (the kneeling pair's eye height), aimed at their heads
// Run: bash test/wt_run.sh polish10.js 300
require('./dom_stub.js');
const V = require('./load_shared.js');
globalThis.VR = V;
require('../src/shared/smoothvox.js'); require('../src/shared/folksmooth.js');
require('../src/main/voxmodels.js'); require('../src/main/villagers.js'); require('../src/main/folkmodel.js');
for (const f of ['i18n', 'lang_en', 'lang_de']) require(__dirname + '/../src/main/' + f + '.js');
require('../src/main/villages.js'); require('../src/main/folk3.js'); require('../src/main/tale_end.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const f2 = (v) => (+v).toFixed(2);
const TE = V.TaleEnd, F3 = V.Folk3;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

console.log('a · the kneeling hug from the front');
{
  check(!!TE && typeof TE.hugShot === 'function' && !!F3 && typeof F3.frameGroup === 'function', 'TaleEnd.hugShot and Folk3.frameGroup');
  if (TE && TE.hugShot && F3) {
    const open = (x, y) => y < 64;
    // the child at x = 0, the adult 0.22 east of it (the child faces +x); the player south-west of them
    for (const [kid, ad, P] of [[[0, 0], [0.22, 0], [-5, 64, -4]], [[3, 2], [3, 2.22], [8, 64, 9]], [[0, 0], [-0.16, -0.16], [4, 64, -4]]]) {
      const H = TE.hugShot(ad, kid, P), fw = Math.atan2(ad[1] - kid[1], ad[0] - kid[0]);
      const mid = [(kid[0] + ad[0]) / 2, 64, (kid[1] + ad[1]) / 2];
      const shot = F3.frameGroup(open, mid, 0.9, H);
      const a = shot ? Math.atan2(shot.P[2] - mid[2], shot.P[0] - mid[0]) : NaN, off = wrap(a - fw) * 180 / Math.PI;
      check(!!shot && Math.abs(off) <= 55 && Math.abs(off) >= 15, `the lens on the child's facing side, beside the adult's head (${f2(off)}° off the child's line of sight)`);
      check(!!shot && shot.P[1] - 64 <= 1.6 && shot.P[1] - 64 >= 0.7 && shot.T[1] - 64 <= 0.95, `low: the lens ${shot ? f2(shot.P[1] - 64) : '—'} m over the ground, aimed at ${shot ? f2(shot.T[1] - 64) : '—'} m (the kneeling heads 1.18 / 0.97)`);
    }
    // the old frame unchanged: no options → the same lens as before (T 0.9 over the middle)
    const g0 = F3.frameGroup(open, [0.5, 64, 0.5], 0.9, { pref: 0 });
    check(!!g0 && Math.abs(g0.T[1] - 64.9) < 1e-9 && Math.abs(Math.atan2(g0.P[2] - 0.5, g0.P[0] - 0.5)) < 0.01, `the other frames unchanged (T ${g0 ? f2(g0.T[1]) : '—'}, the lens at ${g0 ? g0.P.map(f2).join(', ') : '—'})`);
  }
}

console.log(fails ? `FAILED ${fails}` : 'ALL OK');
