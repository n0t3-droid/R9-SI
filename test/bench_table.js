// F5 · Automatik (spec 2026-10-08 realism wave, §F5): the 3 s benchmark's decision table (src/main/bench.js), no DOM.
//  (a) the frame-time summary: median and p90 of the measured frame times, bad samples dropped (NaN, 0, stalls above 1 s)
//  (b) the ladder of (preset, view distance) steps, from Very Low at 4 chunks to Ultra at 16; stepOf() maps the current
//      settings onto it (a custom setup goes to the step with the nearest view distance)
//  (c) the decision table for 60 fps: headroom → up 2 or 1 step, near the budget → hold, over → down 1 or 2
//  (d) the weak-machine rule: when even the lowest step misses 60 fps the target becomes 30 fps and the table runs again
//  (e) a target of 30 fps is respected as given; the step is clamped; no samples means no change
require('./dom_stub.js');
globalThis.VR = {};
require('../src/main/bench.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const BN = VR.Bench;
if (!BN || typeof BN.decide !== 'function') { console.log('VR.Bench.decide missing'); console.log('FAILED 1'); process.exit(1); }

console.log('a · the summary of frame times');
check(BN.median([3, 1, 2]) === 2 && BN.median([4, 1, 3, 2]) === 2.5, 'median of odd and even counts');
check(Number.isNaN(BN.median([])) && BN.median([NaN, 0, -2, 2000, 16]) === 16, 'median ignores NaN, zero, negative and stalls above 1 s');
const s = BN.summarize([16, 16, 17, 16, 40, 16, 16, 16, 16, 16]);
check(s.n === 10 && s.median === 16 && s.p90 >= 16 && s.fps > 55 && s.fps < 65, 'summarize: n, median, p90 and fps from the median (' + JSON.stringify(s) + ')');
check(BN.summarize([]).n === 0 && BN.summarize([]).median !== BN.summarize([]).median, 'an empty sample gives n 0 and NaN');
check(BN.summarize([0, NaN]).n === 0, 'bad samples count as none');

console.log('b · the ladder');
check(BN.LADDER.length === 9 && BN.LADDER[0].p === 'potato' && BN.LADDER[0].v === 4 && BN.LADDER[8].p === 'ultra' && BN.LADDER[8].v === 16, 'nine steps from Very Low (4 chunks) to Ultra (16 chunks)');
check(BN.LADDER.every((x, i, a) => i === 0 || (x.v >= a[i - 1].v)), 'the view distance never falls along the ladder');
check(BN.stepOf('potato', 4) === 0 && BN.stepOf('balanced', 10) === 4 && BN.stepOf('ultra', 16) === 8, 'stepOf maps a preset and its view distance');
check(BN.stepOf('custom', 9) === 3 || BN.stepOf('custom', 9) === 4, 'a custom setup goes to the step with the nearest view distance');
check(BN.stepOf('nonsense', 10) === 4 && BN.stepOf(undefined, undefined) === 4, 'unknown input falls back to Balanced (step 4)');

console.log('c · the decision table, 60 fps');
const rows60 = [
  // ms, step, expected step, expected action
  [5, 2, 4, 'up2'],       // 0.30 of the budget: plenty of room
  [7.5, 2, 4, 'up2'],     // 0.45
  [10, 4, 5, 'up'],       // 0.60
  [12.5, 4, 5, 'up'],     // 0.75
  [14, 6, 6, 'hold'],     // 0.84
  [16.6, 6, 6, 'hold'],   // 1.00
  [20, 6, 5, 'down'],     // 1.20
  [25, 6, 5, 'down'],     // 1.50
  [40, 8, 6, 'down2'],    // 2.40
  [9, 8, 8, 'hold'],      // top step: no further up
];
for (const [ms, st, want, act] of rows60) {
  const d = BN.decide({ ms, step: st, target: 60 });
  check(d.step === want && d.action === act && d.fps === 60 && d.weak === false, `ms ${ms} at step ${st} → step ${want} (${act}), 60 fps`);
}
check(BN.decide({ ms: 5, step: 8, target: 60 }).step === 8, 'the top step does not go higher');

console.log('d · the weak-machine rule');
const weak1 = BN.decide({ ms: 20, step: 0, target: 60 });
check(weak1.weak === true && weak1.fps === 30 && weak1.step === 1, 'Very Low at 20 ms (over 60 fps): the target is 30 fps, one step up');
const weak2 = BN.decide({ ms: 45, step: 0, target: 60 });
check(weak2.weak === true && weak2.fps === 30 && weak2.step === 0, 'Very Low at 45 ms: still too slow for 30 fps: stays at the lowest step, marked weak');
const notWeak = BN.decide({ ms: 18, step: 2, target: 60 });
check(notWeak.weak === false && notWeak.fps === 60 && notWeak.step === 1, 'at step 2 the same 18 ms is only a step down (not weak)');
check(BN.decide({ ms: 10, step: 0, target: 60 }).weak === false, 'a fast Very Low machine is not weak');

console.log('e · other targets, clamps, no samples');
const t30 = BN.decide({ ms: 30, step: 3, target: 30 });
check(t30.fps === 30 && t30.step === 3 && t30.action === 'hold' && t30.weak === false, '30 fps target: 30 ms at step 3 holds');
check(BN.decide({ ms: 34, step: 4, target: 30 }).step === 3, '30 fps target: 34 ms steps down');
check(BN.decide({ ms: 12, step: 4, target: 30 }).step === 6 && BN.decide({ ms: 12, step: 4, target: 30 }).action === 'up2', '30 fps target: 12 ms is plenty of room for two steps up');
check(BN.decide({ ms: 5, step: 99, target: 60 }).step === 8 && BN.decide({ ms: 40, step: -3, target: 60 }).step === 0, 'a step outside 0..8 is clamped');
const none = BN.decide({ ms: NaN, step: 4, target: 60 });
check(none.step === 4 && none.action === 'none' && none.preset === 'balanced' && none.renderDist === 10, 'no samples: the step and the preset stay as they are');
check(BN.decide({ ms: 10, step: 4 }).fps === 60, 'the default target is 60 fps');
const d3 = BN.decide({ ms: 10, step: 4, target: 60 });
check(d3.preset === BN.LADDER[5].p && d3.renderDist === BN.LADDER[5].v, 'the decision names the preset and the view distance of its step');

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
if (fails) process.exit(1);
