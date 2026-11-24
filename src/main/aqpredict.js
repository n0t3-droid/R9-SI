// ============================================================================
// v0.56.3 · Vorausschauende Qualität: the parts that let Smart Quality (game.js smartQuality) act ahead of a slow frame
// instead of after two seconds of them. Pure (node: test/aqpredict.js); game.js keeps the ladders and the probes.
//
//  1 · Trend: the frame's cost (GPU ms when measured, else the frame time) over the last 0.6 s, a least-squares line
//      through it, read 0.5 s ahead. Turning toward the sea or a big town raises the cost frame by frame. The line
//      sees it coming before a 2 s frame-rate window has dropped at all.
//  2 · Surprise: a fast mean (≈ 0.15 s) against a slow one (≈ 3 s) and the slow one's spread:
//        z = (fast − slow) / √(var + 1 ms²)
//      High z means the scene changed now, not noise. Only a surprise lets the governor skip its waiting time.
//  3 · Relief: what each rung of a ladder bought on this machine, learnt from its probes:
//        relief = 1 − ms_after / ms_before
//      kept as a running mean per rung (a prior of 0.12 until it has been tried). Two decisions use it:
//        · how many rungs to take at once: as few as the predicted cost needs to fit the budget
//          (Π(1 − r_i) · ms_pred ≤ budget · 0.95), at most 3 — and only for a big jump (> 1.3 × the budget); a frame a
//          little over takes one rung, as before
//        · whether giving a rung back is safe: ms / (1 − r_top) < budget · 0.85. Otherwise it would only be taken
//          again in a few seconds: the up-and-down that made the picture pump.
//      Between the two ladders (when the bottleneck is not measured) the one with the higher upper confidence
//      bound on its next rung's relief is tried first: mean + c·√(ln N / n) (UCB1; an untried rung goes first).
// ============================================================================
(function (VR) {
  'use strict';
  const P = VR.AQPredict = {};
  P.WIN = 0.6;          // s of frames in the trend
  P.AHEAD = 0.5;        // s read ahead
  P.FAST = 0.15; P.SLOW = 3;   // s: the two means' time constants
  P.PRIOR = 0.12;       // a rung's relief before it was tried
  P.MAXK = 3;
  P.UCB_C = 0.25;

  P.make = function () {
    return { t: 0, ts: new Float64Array(64), ms: new Float64Array(64), n: 0, head: 0, fast: 0, slow: 0, varS: 0, init: false, rel: { g: [], c: [] } };
  };
  // one frame: dt (s), ms (its cost)
  P.push = function (s, dt, ms) {
    if (!(ms >= 0) || !(dt > 0)) return;
    s.t += dt;
    s.ts[s.head] = s.t; s.ms[s.head] = ms; s.head = (s.head + 1) & 63; if (s.n < 64) s.n++;
    if (!s.init) { s.fast = s.slow = ms; s.varS = 0; s.init = true; return; }
    const af = 1 - Math.exp(-dt / P.FAST), as = 1 - Math.exp(-dt / P.SLOW);
    s.fast += af * (ms - s.fast);
    const d = ms - s.slow, lim = 3 * Math.sqrt(s.varS + 1), dc = d > lim ? lim : d < -lim ? -lim : d;   // (the spread learns from a
    s.slow += as * d;                                                                                     //  clipped step: a jump in
    s.varS = (1 - as) * (s.varS + as * dc * dc);                                                          //  the cost stays a surprise)
  };
  // the least-squares line over the last WIN seconds → { mean, slope (ms per s), n }
  P.trend = function (s) {
    let n = 0, st = 0, sm = 0, stt = 0, stm = 0;
    for (let k = 0; k < s.n; k++) {
      const i = (s.head - 1 - k + 64) & 63, t = s.ts[i] - s.t;
      if (t < -P.WIN) break;
      const m = s.ms[i]; n++; st += t; sm += m; stt += t * t; stm += t * m;
    }
    if (n < 3) return { mean: n ? sm / n : 0, slope: 0, n };
    const den = n * stt - st * st, slope = Math.abs(den) > 1e-12 ? (n * stm - st * sm) / den : 0, mean = sm / n;
    return { mean, slope, n, tMean: st / n };
  };
  // the cost AHEAD seconds from now (the line at t = +AHEAD; a falling line is read as its mean: the governor never
  // gives back a rung on a guess)
  P.predict = function (s, ahead) {
    const T = P.trend(s); if (T.n < 3) return T.mean;
    const at = (ahead === undefined ? P.AHEAD : ahead) - (T.tMean || 0);
    return Math.max(T.mean, T.mean + T.slope * at);
  };
  P.surprise = (s) => (s.init ? (s.fast - s.slow) / Math.sqrt(s.varS + 1) : 0);

  // ---------------------------------------------------------------- relief per rung
  // (k rungs taken together share the relief: each gets 1 − (after / before)^(1/k))
  P.learn = function (s, kind, i, msBefore, msAfter, k) {
    if (!(msBefore > 0) || !(msAfter > 0)) return;
    k = Math.max(1, k | 0);
    const r1 = Math.max(-0.2, Math.min(0.8, 1 - Math.pow(msAfter / msBefore, 1 / k)));
    for (let j = 0; j < k; j++) learn1(s, kind, i + j, r1);
  };
  function learn1(s, kind, i, r) {
    const L = s.rel[kind] || (s.rel[kind] = []), e = L[i] || (L[i] = { n: 0, mean: 0 });
    e.n++; e.mean += (r - e.mean) / Math.min(e.n, 8);   // (a running mean that keeps learning: the last ~8 probes)
  }
  P.relief = function (s, kind, i) { const e = (s.rel[kind] || [])[i]; return e && e.n ? Math.max(0, e.mean) : P.PRIOR; };
  // how many rungs from index i0 (of a ladder with len rungs) bring ms down to the budget
  P.plan = function (s, kind, i0, len, ms, budget) {
    let k = 0, m = ms;
    if (ms <= budget * 1.3) return Math.min(1, len - i0);
    while (i0 + k < len && k < P.MAXK && m > budget * 0.95) { m *= 1 - P.relief(s, kind, i0 + k); k++; }
    return Math.max(1, Math.min(k, len - i0));
  };
  // giving back rung i of the ladder: does the frame still fit?
  P.popSafe = function (s, kind, i, ms, budget) { return ms / Math.max(0.2, 1 - P.relief(s, kind, i)) < budget * 0.85; };
  // UCB1 between the two ladders' next rungs
  P.ucb = function (s, kind, i) {
    let N = 1; for (const k of ['g', 'c']) for (const e of s.rel[k] || []) if (e) N += e.n;
    const e = (s.rel[kind] || [])[i];
    if (!e || !e.n) return Infinity;
    return e.mean + P.UCB_C * Math.sqrt(Math.log(N) / e.n);
  };
})(typeof VR !== 'undefined' ? VR : (globalThis.VR = globalThis.VR || {}));
