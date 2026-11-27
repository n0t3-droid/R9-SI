// /prüfstand — the governor's step response on the player's own machine (src/main/pruefstand.js): the game puts known
// loads on itself in turns (a GPU pass that costs a set number of milliseconds and grows with the picture's pixels, a CPU
// wait that grows with the villagers drawn, a GPU ramp) and records how Smart Quality answers. In node:
//  a · the plan: rest, calibration, GPU step, rest, CPU step, rest, ramp, rest; the load at any second; the step's size
//      from the frame budget (0.9 × budget, 6–24 ms)
//  b · the analysis of a recorded run (a stand-in): per load the first step's delay, the rungs taken, when the frame
//      rate came back, the pumping (a rung given back and taken again while the load lasts), the forecast's error;
//      after it how long the rungs took to come back
//  c · the burners' sizes: the CPU wait (busy, as asked: 3 ms → 3–6 ms), the GPU loop count from a calibration
//      (bounded by the cap; nothing at all when the calibration measured nothing)
//  d · the wiring: /prüfstand (/pruefstand, /teststand, /testbench) in the chat, the loop's hook, the renderer's timed pass
//   bash test/wt_run.sh pruefstand.js 120
'use strict';
require('./dom_stub.js');
const V = require('./load_shared.js');
require('../src/main/pruefstand.js');
const fs = require('fs');
let fails = 0;
const check = (ok, msg, info) => { if (!ok) { fails++; console.log('  ✗ ' + msg + (info !== undefined ? '  — ' + info : '')); } else console.log('  ✓ ' + msg); };
const P = V.Pruefstand || (global.VR && VR.Pruefstand);
if (!P) { console.log('VR.Pruefstand missing'); console.log('FAILED 1'); process.exit(1); }

console.log('a · the plan');
{
  const plan = P.plan(1000 / 55);
  const kinds = plan.map((p) => p.kind).join(' ');
  check(kinds === 'rest eich rest gpu rest cpu rest ramp rest', 'rest, calibration, GPU step, rest, CPU step, rest, ramp, rest', kinds);
  const X = plan.find((p) => p.kind === 'gpu').ms;
  check(Math.abs(X - 16.4) < 0.11 && plan.find((p) => p.kind === 'cpu').ms === X && plan.find((p) => p.kind === 'ramp').ms === X, 'the step: 0.9 × the budget (16.4 ms at 55 fps), the same for CPU and ramp', X);
  check(P.plan(1000 / 20)[3].ms === 24 && P.plan(1000 / 200)[3].ms === 6, 'the step stays within 6–24 ms');
  const total = plan.reduce((a, p) => a + p.s, 0);
  check(total >= 100 && total <= 150, `about two minutes in all (${total} s)`);
  const g0 = plan.slice(0, 3).reduce((a, p) => a + p.s, 0);   // the GPU step's start
  const at = (t) => P.loadAt(plan, t);
  check(at(1).gpu === 0 && at(1).cpu === 0 && at(1).kind === 'rest', 'nothing at first');
  check(at(g0 + 1).gpu === X && at(g0 + 1).cpu === 0, 'the GPU step: its load, nothing on the CPU');
  const c0 = g0 + plan[3].s + plan[4].s, r0 = c0 + plan[5].s + plan[6].s;
  check(at(c0 + 1).cpu === X && at(c0 + 1).gpu === 0, 'the CPU step');
  check(Math.abs(at(r0 + plan[7].s / 2).gpu - X / 2) < 0.6 && at(r0 + 0.01).gpu < 0.1, 'the ramp rises from nothing to the step', at(r0 + plan[7].s / 2).gpu);
  check(at(total + 5).kind === 'done', 'done after the last rest');
}

console.log('b · the analysis');
{
  // a stand-in run: 60 fps at rest; the GPU step makes it 34 fps; Smart Quality steps at +1.2 s and +3.7 s, the frame rate
  // is back at +4.5 s; after the load the rungs come back 8 s and 12 s into the rest; the CPU step: one rung, given back
  // and taken again (pumping); the forecast 1 ms off
  const plan = P.plan(1000 / 55), frames = [];
  const g0 = plan.slice(0, 3).reduce((a, p) => a + p.s, 0), g1 = g0 + plan[3].s, c0 = g1 + plan[4].s, c1 = c0 + plan[5].s;
  for (let t = 0; t < plan.reduce((a, p) => a + p.s, 0); t += 1 / 50) {
    let depth = 0, fps = 60;
    if (t >= g0 + 1.2) depth = 1; if (t >= g0 + 3.7) depth = 2;
    if (t >= g0 && t < g0 + 4.5) fps = 34;
    if (t >= g1 + 8) depth = 1; if (t >= g1 + 12) depth = 0;
    if (t >= c0 + 2 && t < c0 + 6) depth = 1; if (t >= c0 + 6 && t < c0 + 7) depth = 0; if (t >= c0 + 7 && t < c1 + 5) depth = 1;
    if (t >= c0 && t < c0 + 2) fps = 40;
    const ms = 1000 / fps;
    frames.push({ t, dt: 1 / fps, ms, stack: 'g'.repeat(depth), pred: ms + 1, mean: ms });
  }
  const A = P.analyze(frames, plan, 55);
  const G = A.loads.find((l) => l.kind === 'gpu'), C = A.loads.find((l) => l.kind === 'cpu');
  check(G && Math.abs(G.first - 1.2) < 0.05 && G.rungs === 2, 'GPU step: the first rung after 1.2 s, two rungs', G && JSON.stringify(G));
  check(G && Math.abs(G.recover - 4.5) < 0.6, 'the frame rate back after about 4.5 s', G && G.recover);
  check(G && G.pump === 0 && Math.abs(G.back - 12) < 0.1, 'no pumping; all rungs back 12 s into the rest', G && [G.pump, G.back]);
  check(C && C.pump === 1 && C.rungs === 1, 'CPU step: one rung given back and taken again while the load lasted (pumping 1)', C && JSON.stringify(C));
  check(G && Math.abs(G.mae - 1) < 0.15, 'the forecast\'s error: 1 ms', G && G.mae);
  const lines = P.lines(A, 'de'), en = P.lines(A, 'en');
  check(lines.length >= 4 && /Last GPU/.test(lines.join('\n')) && /GPU load/.test(en.join('\n')), 'the result as lines, German and English', lines[1]);
}

console.log('c · the burners');
{
  const t0 = process.hrtime.bigint(); P.burnCpu(3); const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  check(ms >= 3 && ms < 6, `the CPU wait: 3 ms asked, ${ms.toFixed(2)} ms taken`);
  check(P.loopsFor(16, 0.02) === 800 && P.loopsFor(400, 0.01) === P.LOOP_CAP, 'the GPU loop count from the calibration (16 ms at 0.02 ms a loop: 800), never past the cap', [P.loopsFor(16, 0.02), P.loopsFor(400, 0.01), P.LOOP_CAP]);
  check(P.loopsFor(16, 0) === 0 && P.loopsFor(16, NaN) === 0, 'a calibration that measured nothing puts no GPU load on (never a guess)');
  check(P.LOOP_CAP <= 4096 && P.MAX_MS <= 24, `the caps: ${P.LOOP_CAP} loops, ${P.MAX_MS} ms a frame`);
}

console.log('d · the wiring');
{
  const game = fs.readFileSync(__dirname + '/../src/main/game.js', 'utf8'), rd = fs.readFileSync(__dirname + '/../src/main/renderer.js', 'utf8'), build = fs.readFileSync(__dirname + '/../build.js', 'utf8');
  check(/c0 === 'prüfstand' \|\| c0 === 'pruefstand' \|\| c0 === 'teststand' \|\| c0 === 'testbench'/.test(game), 'the chat words');
  check(/VR\.Pruefstand && VR\.Pruefstand\.on\) VR\.Pruefstand\.frame\(this\)/.test(game), "the loop's hook (inside the timed frame)");
  check(/gpuTimerEnd\(\) \{ const PS = VR\.Pruefstand; if \(PS && PS\.gpuOn\)/.test(rd), "the GPU pass inside the frame's timer");
  check(/'pruefstand'/.test(build), 'built into the game');
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
