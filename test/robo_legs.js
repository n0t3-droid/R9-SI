// x-robo · a villager's legs walking up a stair of slabs and planks (half a block a step) at 1.2 b/s, the game's own
// gait (FolkAnim.walkPerson) and the game's own hooks' maths (VR.Robo: footGround, the drawn root's spring, plant):
// before — the walk as on flat ground over the body's stepped height; after — the feet planted. Writes the side view's
// joints over 2.4 s to .tmp_tests/robo_legs.json (python3 test/robo_legs.py draws test/shots/robo_legs.png).
//   · after: the lower foot (the one carrying the body) within 0.04 b of the tread under it, every frame
//   · after: no foot below its tread by more than 0.04 b; before: feet float or sink by more (the old error, measured)
// usage: bash test/wt_run.sh robo_legs.js 300
const V = require('./load_shared.js');
globalThis.VR = V;
require('../src/main/folkrobo.js');
const fs = require('fs'), path = require('path');
const Rb = V.Robo, FA = V.FolkAnim, B = V.R.byName;
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
// the stair (as test/robo.mjs builds it): a stone floor at 80, a slab at x 0, planks at 1, planks + slab at 2, two planks from 3
const m = new Map(), K = (x, y, z) => x + ',' + y + ',' + z;
for (let x = -6; x < 12; x++) for (let z = -2; z < 3; z++) m.set(K(x, 80, z), B.stone.defaultState);
for (let z = -2; z < 3; z++) { m.set(K(0, 81, z), B.oak_slab.defaultState); m.set(K(1, 81, z), B.oak_planks.defaultState); m.set(K(2, 81, z), B.oak_planks.defaultState); m.set(K(2, 82, z), B.oak_slab.defaultState); for (let x = 3; x < 12; x++) { m.set(K(x, 81, z), B.oak_planks.defaultState); m.set(K(x, 82, z), B.oak_planks.defaultState); } }
const get = (x, y, z) => m.get(K(x, y, z)) || 0;
const ground = (x) => { for (const yq of [83.9, 82.9, 81.9, 80.9]) { const h = Rb.footGround(get, x, yq, 0.5, {}); if (h === h) return h; } return NaN; };
const G = FA.gait({ unit: 32, scale: 1, hip: 29, thigh: 14, shin: 15, stride: 0.6 });
const bpu = G.bpu, dt = 1 / 30, v = 1.2;
const run = (robo) => {
  const g = Object.assign({}, G, { ph: 0, S: 0 }), P = {}, out = [];
  let x = -1.6, y = 81, S = { x: 81, v: 0 }, worstStance = 0, worstSink = 0, sumStance = 0, n = 0;
  for (let f = 0; f < 72; f++) {
    x += v * dt;
    // the body's height as the physics gives it: the highest tread under its 0.6-wide box, stepping up at once
    let yy = -1e9; for (const ox of [-0.3, 0, 0.3]) yy = Math.max(yy, ground(x + ox)); y = yy;
    FA.stride(g, v, dt, false); FA.walkPerson(g, 1, P);
    let root = y;
    if (robo) {
      Rb.spring(S, y, 16, 0.95, dt); root = S.x;
      const gs = [];
      for (const s of ['l', 'r']) { const F = Rb.legFK(G.thigh, G.shin, P['leg_' + s][0], -P['shin_' + s][0], [0, 0]); let gg = ground(x + F[0] * bpu) - root; if (!(gg > -0.6 && gg < 0.6)) gg = 0; gs.push(gg / bpu); }
      Rb.plant(G, P, gs[0], gs[1]);
    }
    const fr = { x, root, legs: {} };
    let low = 1e9, lowGap = 0;
    for (const s of ['l', 'r']) {
      const th = P['leg_' + s][0], k = -P['shin_' + s][0], hy = root + (G.hip + P['leg_' + s][4]) * bpu;
      const kx = x + Math.sin(th) * G.thigh * bpu, ky = hy - Math.cos(th) * G.thigh * bpu;
      const fx = kx + Math.sin(th - k) * G.shin * bpu, fy = ky - Math.cos(th - k) * G.shin * bpu;
      fr.legs[s] = [[x, hy], [kx, ky], [fx, fy]];
      const gap = fy - ground(fx);
      if (gap < low) { low = gap; lowGap = gap; }
      worstSink = Math.max(worstSink, -gap);
    }
    worstStance = Math.max(worstStance, Math.abs(lowGap)); sumStance += Math.abs(lowGap); n++;
    out.push(fr);
  }
  return { frames: out, worstStance, worstSink, meanStance: sumStance / n };
};
const A = run(false), Bf = run(true);
console.log(`  · before: the carrying foot off its tread by ${A.meanStance.toFixed(3)} b on average, at worst ${A.worstStance.toFixed(3)}; a foot sunk ${A.worstSink.toFixed(3)} b at worst`);
console.log(`  · after:  ${Bf.meanStance.toFixed(3)} b on average, at worst ${Bf.worstStance.toFixed(3)}; sunk ${Bf.worstSink.toFixed(3)} b at worst`);
check(Bf.worstStance <= 0.04, 'after: the carrying foot on its tread (≤ 0.04 b) in every frame');
check(Bf.worstSink <= 0.04, 'after: no foot sunk into a step (≤ 0.04 b)');
check(A.worstStance > 0.1 || A.worstSink > 0.1, 'before: the old error is real (> 0.1 b)');
const prof = []; for (let x = -2; x <= 4.5; x += 0.05) prof.push([+x.toFixed(2), ground(x)]);
const dir = path.join(__dirname, '..', '.tmp_tests'); fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'robo_legs.json'), JSON.stringify({ before: A.frames, after: Bf.frames, prof, stats: { before: [A.meanStance, A.worstStance, A.worstSink], after: [Bf.meanStance, Bf.worstStance, Bf.worstSink] } }));
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
