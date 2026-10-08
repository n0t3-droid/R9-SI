// ============================================================================
// ⚡ Automatik (F5 · Steuerung & Einstellungen): a 3 s benchmark on the scene the
// player stands in measures the frame times; decide() picks the quality step —
// a preset and a view distance together — that holds 60 fps, or 30 fps on a weak
// machine. The game collects the samples (game.js benchRun); this file is the
// pure part, tested in node (test/bench_table.js).
//   LADDER: nine steps, Very Low at 4 chunks … Ultra at 16 chunks
//   median(xs) · summarize(dts) → { n, median, p90, fps } · stepOf(preset, renderDist)
//   decide({ ms, step, target }) → { step, preset, renderDist, fps, weak, action, from }
// The table, with r = ms × target ÷ 1000 (the frame time as a share of the budget):
//   r ≤ 0.45 → two steps up · r ≤ 0.75 → one step up · r ≤ 1.0 → hold
//   r ≤ 1.5 → one step down · more → two steps down
// A machine that misses 60 fps even on the lowest step is weak: the target becomes
// 30 fps and the table runs again. The quality governor (aq) takes it from there.
// ============================================================================
(function (VR) {
  'use strict';
  const LADDER = [
    { p: 'potato', v: 4 }, { p: 'potato', v: 6 }, { p: 'low', v: 6 }, { p: 'low', v: 8 }, { p: 'balanced', v: 10 },
    { p: 'balanced', v: 12 }, { p: 'high', v: 14 }, { p: 'high', v: 16 }, { p: 'ultra', v: 16 },
  ];
  const TOP = LADDER.length - 1;
  const clampStep = (s) => (Number.isFinite(s) ? Math.min(TOP, Math.max(0, Math.round(s))) : 4);
  const sane = (x) => Number.isFinite(x) && x > 0 && x <= 1000;   // a frame of 0 or below is a glitch, a stall over 1 s is a tab switch
  function median(xs) {
    const a = xs.filter(sane).sort((p, q) => p - q);
    if (!a.length) return NaN;
    const m = a.length >> 1;
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }
  function summarize(dts) {
    const a = (dts || []).filter(sane).sort((p, q) => p - q);
    if (!a.length) return { n: 0, median: NaN, p90: NaN, fps: NaN };
    const med = median(a);
    const p90 = a[Math.min(a.length - 1, Math.ceil(a.length * 0.9) - 1)];
    return { n: a.length, median: med, p90, fps: 1000 / med };
  }
  // the step whose preset and view distance match the settings; a custom setup goes to the nearest view distance
  function stepOf(preset, renderDist) {
    const exact = LADDER.findIndex((x, i) => x.p === preset && x.v === renderDist);
    if (exact >= 0) return exact;
    if (!Number.isFinite(renderDist)) return 4;
    let best = 4, bd = Infinity;
    LADDER.forEach((x, i) => { const dd = Math.abs(x.v - renderDist); if (dd < bd) { bd = dd; best = i; } });
    return best;
  }
  function stepTable(ms, step, target) {
    const r = ms * target / 1000;
    if (r <= 0.45) return [step + 2, 'up2'];
    if (r <= 0.75) return [step + 1, 'up'];
    if (r <= 1.0) return [step, 'hold'];
    if (r <= 1.5) return [step - 1, 'down'];
    return [step - 2, 'down2'];
  }
  function decide(o) {
    const ms = o && o.ms, s0 = clampStep(o && o.step);
    let target = o && o.target === 30 ? 30 : 60;
    const out = (st, action, weak) => ({ step: st, preset: LADDER[st].p, renderDist: LADDER[st].v, fps: target, weak, action: st === s0 && action !== 'none' ? 'hold' : action, from: s0 });
    if (!sane(ms)) return out(s0, 'none', false);
    let [st, action] = stepTable(ms, s0, target);
    st = clampStep(st);
    let weak = false;
    if (target === 60 && st === 0 && ms > 1000 / 60) {
      // the lowest step still misses 60 fps: a weak machine, aimed at 30 fps instead
      weak = true; target = 30;
      [st, action] = stepTable(ms, s0, target);
      st = clampStep(st);
    }
    return out(st, action, weak);
  }
  VR.Bench = { LADDER, median, summarize, stepOf, decide, clampStep };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
