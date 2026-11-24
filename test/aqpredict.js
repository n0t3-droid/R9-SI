// v0.56.3 · Vorausschauende Qualität (src/main/aqpredict.js), no browser:
//  a · the trend line reads a rising cost ahead; a flat noisy cost stays flat
//  b · surprise: a step in the cost is a surprise, noise of the same size spread over seconds is not
//  c · relief: learnt from probes, the plan takes as few rungs as the budget needs, a give-back that would not fit is held
//  d · a governor in miniature (the game's rules: a 2 s window, a step and a 2.5 s probe) against the same with the
//      prediction: turning toward the sea (16 → 60 ms over 0.8 s), the slow frames end sooner; at a cost near the
//      edge, fewer ups and downs in a minute
//   bash test/wt_run.sh aqpredict.js
require('../src/main/aqpredict.js');
const P = VR.AQPredict;
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
let seed = 7; const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

console.log('a · trend');
{
  const s = P.make(); for (let i = 0; i < 40; i++) P.push(s, 1 / 60, 16 + (rnd() - 0.5) * 2);
  check(Math.abs(P.predict(s) - 16) < 1.5, 'a flat cost is read as flat', P.predict(s).toFixed(1) + ' ms');
  const r = P.make(); let ms = 16; for (let i = 0; i < 30; i++) { ms += 0.8; P.push(r, 1 / 60, ms); }   // +48 ms/s
  const pr = P.predict(r);
  check(pr > ms + 15, 'a rising cost is read ahead: 0.5 s later it will be higher than now', `now ${ms.toFixed(0)}, ahead ${pr.toFixed(0)} ms`);
  const f = P.make(); ms = 60; for (let i = 0; i < 30; i++) { ms -= 0.8; P.push(f, 1 / 60, ms); }
  check(P.predict(f) >= P.trend(f).mean - 1e-9, 'a falling cost is never read below its mean (no give-back on a guess)');
}
console.log('b · surprise');
{
  const s = P.make(); for (let i = 0; i < 300; i++) P.push(s, 1 / 60, 16 + (rnd() - 0.5) * 6);
  const z0 = P.surprise(s);
  for (let i = 0; i < 12; i++) P.push(s, 1 / 60, 40);
  const z1 = P.surprise(s);
  check(Math.abs(z0) < 2 && z1 > 3, 'a step from 16 to 40 ms is a surprise, the noise before it is not', `z ${z0.toFixed(2)} → ${z1.toFixed(2)}`);
}
console.log('c · relief');
{
  const s = P.make();
  check(P.relief(s, 'g', 0) === P.PRIOR, 'an untried rung has the prior ' + P.PRIOR);
  P.learn(s, 'g', 0, 40, 36); P.learn(s, 'g', 1, 36, 24); P.learn(s, 'g', 2, 24, 23);
  check(Math.abs(P.relief(s, 'g', 1) - 1 / 3) < 1e-9, 'rung 2 bought a third', P.relief(s, 'g', 1).toFixed(3));
  const k1 = P.plan(s, 'g', 0, 7, 40, 26), k2 = P.plan(s, 'g', 0, 7, 25, 18.2), k3 = P.plan(s, 'g', 0, 7, 19, 18.2);
  check(k1 === 2, 'at 40 ms for a 26 ms budget: two rungs (0.9 · 0.67 · 40 = 24 ms ≤ 0.95 · 26)', k1);
  check(k2 === 2 && k3 === 1, 'a jump of up to 1.3 × the budget: one rung; 25 ms for 18.2 (1.37 ×): two', k3 + ' · ' + k2);
  check(P.plan(s, 'g', 6, 7, 90, 18) === 1, 'never past the ladder\'s end');
  check(!P.popSafe(s, 'g', 1, 16, 18.2) && P.popSafe(s, 'g', 0, 12, 18.2), 'giving back the rung that bought a third at 16 ms would not fit (24 ms), the one that bought 10 % at 12 ms would');
  check(P.ucb(s, 'c', 0) === Infinity && P.ucb(s, 'g', 1) > P.relief(s, 'g', 1), 'UCB: an untried ladder goes first, a tried one is a little above its mean');
}
console.log('d · a governor in miniature');
{
  // the scene: base cost(t) in ms at full quality; rung i multiplies by (1 − R[i]); noise ±8 %
  const R = [0.25, 0.1, 0.18, 0.15, 0.1, 0.22, 0.2];
  const run = (pred, scene, T) => {
    const s = P.make(), budget = 1000 / 55, target = 55;
    let n = 0, hold = 0, probe = null, good = 0, winT = 0, winN = 0, fpsWin = 0, t = 0, slow = 0, ups = 0, downs = 0;
    const cost = () => scene(t) * R.slice(0, n).reduce((a, r) => a * (1 - r), 1) * (1 + (rnd() - 0.5) * 0.16);
    while (t < T) {
      const ms = Math.max(1000 / 144, cost()), dt = ms / 1000; t += dt;
      P.push(s, dt, ms);
      winT += dt; winN++; if (winT >= 2) { fpsWin = winN / winT; winT = 0; winN = 0; }
      const fps = fpsWin || 1000 / ms; hold = Math.max(0, hold - dt);
      if (ms > 1000 / 40) slow += dt;
      if (probe && hold <= 0) { const pr = probe; probe = null; if (pred) P.learn(s, 'g', pr.i, pr.ms0, P.trend(s).mean, pr.k); }
      const mpred = P.predict(s), z = P.surprise(s);
      const struggling = fps < target - 8 && t > 4, fine = fps > target + 3;
      const early = pred && !struggling && hold <= 0 && !probe && t > 4 && mpred > budget * 1.25 && z > 3;
      if ((struggling || early) && hold <= 0 && !probe && n < R.length) {
        const k = pred ? P.plan(s, 'g', n, R.length, Math.max(mpred, P.trend(s).mean), budget) : 1;
        probe = { i: n, k, ms0: P.trend(s).mean }; n += k; downs += k; hold = 2.5; good = 0;
      } else if (fine && n > 0) {
        good += dt;
        if (good > 6 && hold <= 0 && (!pred || P.popSafe(s, 'g', n - 1, P.trend(s).mean, budget))) { n--; ups++; good = 0; hold = 3; }
      } else if (!fine) good = 0;
    }
    return { slow: +slow.toFixed(1), ups, downs, n };
  };
  const sea = (t) => (t < 10 ? 16 : t < 10.8 ? 16 + (t - 10) / 0.8 * 44 : 60);
  seed = 11; const a = run(false, sea, 40); seed = 11; const b = run(true, sea, 40);
  console.log(`     the turn to the sea: without ${JSON.stringify(a)} · with ${JSON.stringify(b)}`);
  check(b.slow < a.slow * 0.6, 'the slow frames (under 40 fps) after the turn end sooner', `${a.slow} s → ${b.slow} s`);
  const edge = (t) => 22;   // over the budget at full quality (45 fps); one rung (−25 %) makes it fine (60 fps), giving it back makes it slow again
  seed = 5; const c = run(false, edge, 120); seed = 5; const d = run(true, edge, 120);
  console.log(`     at the edge for two minutes: without ${JSON.stringify(c)} · with ${JSON.stringify(d)}`);
  check(d.ups + d.downs < (c.ups + c.downs) * 0.6, 'fewer ups and downs at the edge (the picture does not pump)', `${c.ups + c.downs} → ${d.ups + d.downs}`);
}
console.log('e · the game\'s governor (game.js smartQuality on a stand-in, the GPU timed)');
{
  require('./dom_stub.js');
  const V = require('./load_shared.js');
  require('../src/main/i18n.js'); require('../src/main/lang_en.js'); require('../src/main/lang_de.js');
  require('../src/main/settings_reg.js'); require('../src/main/game.js');
  const G = V.Game, proto = G.prototype, PR = G.PRESETS;
  const GOV = ['smartQuality', 'aqState', 'aqGpuRungs', 'aqCpuRungs', 'aqPush', 'aqPop', 'aqReset', 'aqApply', 'aqRemember', 'aqRestoreSteps', 'aqRestoreStart', 'aqMemKey', 'aqMemRead', 'aqMemWrite'];
  const HIGH = Object.assign({ preset: 'high' }, PR.high);
  // the scene's GPU cost at full quality; each rung taken takes 15 % off (the frame rate follows the cost)
  const drive = (useP, sceneMs, T) => {
    const keep = VR.AQPredict; if (!useP) VR.AQPredict = null;
    const g = { renderer: { gpuMs: 0, setOverride() {} }, jsMs: 3, fps: 0, time: 0, slowBase: false, folkBase: 120, folkDist: 120, horizon: null, bench: false, world: { renderDist: 12, meshBudget: 6, streamRung: 0 }, state: 'play', aqChanged() {} };
    for (const k of GOV) g[k] = proto[k];
    let first = null, slow = 0, moves = 0, last = 0; seed = 3;
    for (let t = 0; t < T;) {
      const aq = g.aqState(), ms = Math.max(7, sceneMs(t) * Math.pow(0.85, aq.g) * (1 + (rnd() - 0.5) * 0.12));
      g.renderer.gpuMs = ms; g.fps = 1000 / ms; const dt = ms / 1000; g.time += dt; t += dt;
      g.smartQuality(dt, HIGH, g.world);
      if (aq.stack.length !== last) { moves++; if (first === null && t > 8) first = +(t - 8).toFixed(2); last = aq.stack.length; }
      if (t > 8 && ms > 25) slow += dt;
    }
    VR.AQPredict = keep;
    return { first, slow: +slow.toFixed(1), moves, depth: g.aqState().stack.length };
  };
  const sea = (t) => (t < 8 ? 12 : t < 8.6 ? 12 + (t - 8) / 0.6 * 33 : 45);
  if (process.env.TRACE) VR.AQ_TRACE = 1;
  const a = drive(false, sea, 30), b = drive(true, sea, 30);
  console.log(`     12 → 45 ms at 8 s: without ${JSON.stringify(a)} · with ${JSON.stringify(b)}`);
  check(b.first !== null && a.first !== null && b.first < a.first - 0.5, 'the first step comes sooner after the jump', `${a.first} s → ${b.first} s`);
  check(b.slow < a.slow * 0.5, 'far fewer slow frames (over 25 ms) after it (a step whose probe met a still-rising cost is kept, not taken back)', `${a.slow} s → ${b.slow} s`);
  const back = (t) => (t < 40 ? sea(t) : 12), c = drive(true, back, 120);
  check(c.depth === 0, 'back on land (12 ms) the steps are all given back', 'depth ' + c.depth);
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
