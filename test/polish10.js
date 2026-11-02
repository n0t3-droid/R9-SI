// f-polish10 · f-polish9's open items (docs/superpowers/plans/2026-11-02-f-polish10.md):
//   a · the kneeling hug from the child's facing side: the lens on the child's left (77° off its line of sight, where its
//       head passes the adult's and turns), low (the kneeling pair's eye height), aimed at their heads
//   b · a look deed („schau dir den Ausblick in Ruhe an") is not done by a trip's camera: the adventurer's session had
//       act:c1.b1 done 1.4 s after its own [V] takeoff (the trip's camera swung past the vista) — a pair
//   c · the life director's own acts (a balloon …) wait while you are at work on an outpost or a foe is coming, as the
//       Regie's fill and the walker already do (run 3: a balloon 7 s before „calmed")
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
      check(!!shot && off <= -60 && off >= -95, `the lens on the child's left, its face toward the lens, the adult in profile (${f2(off)}° off the child's line of sight)`);
      check(!!shot && shot.P[1] - 64 <= 1.6 && shot.P[1] - 64 >= 0.7 && shot.T[1] - 64 <= 0.95, `low: the lens ${shot ? f2(shot.P[1] - 64) : '—'} m over the ground, aimed at ${shot ? f2(shot.T[1] - 64) : '—'} m (the kneeling heads 1.18 / 0.97)`);
    }
    // the old frame unchanged: no options → the same lens as before (T 0.9 over the middle)
    const g0 = F3.frameGroup(open, [0.5, 64, 0.5], 0.9, { pref: 0 });
    check(!!g0 && Math.abs(g0.T[1] - 64.9) < 1e-9 && Math.abs(Math.atan2(g0.P[2] - 0.5, g0.P[0] - 0.5)) < 0.01, `the other frames unchanged (T ${g0 ? f2(g0.T[1]) : '—'}, the lens at ${g0 ? g0.P.map(f2).join(', ') : '—'})`);
  }
}

console.log('a2 · nobody standing right behind the pair');
{
  const P = [0, 65.6, 6], M = [0, 64, 0], mk = (x, z) => ({ pos: [x, 64, z], vel: [0, 0, 0] });
  const gv = mk(0, 0.2), pt = mk(0, -0.2), b1 = mk(0.3, -1.5), b2 = mk(2.5, -1.5), b3 = mk(0, -6), side = mk(1.2, 0.3);
  const out = TE.asideOf([gv, pt, b1, b2, b3, side], [gv, pt], P, M);
  check(out.length === 1 && out[0] === b1 && Math.abs(b1.teAside[0]) >= TE.ASIDE.to - 0.01, `one standing 1.5 m behind the pair on the line steps aside (${out.length}), not one off the line, far behind or beside the pair`);
}

console.log('b · a look deed and the trip\'s camera');
{
  require('../src/shared/story.js');
  const S = V.Story, act = { kind: 'look', target: 'vista', max: 450, cone: 14, hold: 1.5 };
  check(!!S && S.actCheck(act, { ang: 5, dist: 60 }) === 'ok' && S.actCheck(act, { ang: 5, dist: 60, away: true }) === 'away', `a vista in view: done by your eyes (${S && S.actCheck(act, { ang: 5, dist: 60 })}), not while a trip's camera shows it (${S && S.actCheck(act, { ang: 5, dist: 60, away: true })})`);
  const st = { id: 'x' }; let done = false; for (let i = 0; i < 8; i++) done = S.actStep(st, act, { ang: 5, dist: 60, away: i >= 3 }, 0.25) || done;
  check(!done && st.hold === 0, `the hold starts again after the trip (${st.hold})`);
  const src = require('fs').readFileSync(__dirname + '/../src/main/story.js', 'utf8');
  check(/away: !!\(VR\.Intent/.test(src), 'the story\'s deed context marks a trip by intent as away');
}

console.log('c · the life director\'s acts and the outpost at work');
{
  for (const f of ['lifekit', 'lifedirector', 'eventlog', 'regie']) require(__dirname + '/../src/main/' + f + '.js');
  const RG = V.Regie, g = { state: 'play', time: 50, world: {}, meta: { seed: 1 }, player: { pos: [0, 64, 0] }, entities: { mobs: [] } };
  RG.frame(g, 0.3); const S = RG.of(g);
  if (S) {
    S.sched.lastStart = -100; S.sched.last2 = -100; S.sched.lastNote = -100; g.time = 300;
    const free = RG.allow(g, 2, 'ambient');
    V.Liberate = { engaged: () => true };
    const work = RG.allow(g, 2, 'ambient'), story = RG.allow(g, 4, 'story');
    delete V.Liberate; V.Foes = { coming: () => true };
    const foe = RG.allow(g, 2, 'ambient'); delete V.Foes;
    check(free && !work && !foe && story, `a balloon may start (${free}), not while an outpost is at work (${work}) or a foe is coming (${foe}); the story's beat still may (${story})`);
  } else check(false, 'the Regie binds to the stand-in game');
}

console.log(fails ? `FAILED ${fails}` : 'ALL OK');
