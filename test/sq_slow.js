// Smart Quality on a very slow PC — found with the lab's PC emulator (lab/emu, 27 Nov 2026): the game loop clamps a
// frame's dt to 0.1 s (the world's simulation must not jump), and the governor took its clocks from that clamped dt. At
// one frame a second it counted a tenth of a second per real second: it read 10 fps where there was one, waited about 25
// real seconds for its first step and 15 between steps. It now counts real seconds (the frame's interval, up to 2 s).
//  a · a stand-in game at 600 ms a frame: the first step within 8 real seconds of the start (its warm-up is 4 s), the
//      frame rate it reads within 25 % of the real one, the next step not 15 s later
//  b · at 12–60 ms a frame (the clamp never bites) every decision is the same as before (the steps pinned frame by frame)
//  d · Bildwarp: the governor sees the whole frames only (warp frames between them); it read the frame rate over the
//      intervals before the whole frames alone (the warps' time left out): a whole frame every 0.24 s read as 6.7 fps, not
//      4.2. It now counts all the time since the last whole frame
//  c · the loop: frameDt is the real interval (capped at 2 s), the simulation's dt stays clamped at 0.1; the HUD's frame
//      rate counts real time
//   bash test/wt_run.sh sq_slow.js 120   (PIN=1 prints b's trace hash)
'use strict';
require('./dom_stub.js');
const V = require('./load_shared.js');
require('../src/main/i18n.js'); require('../src/main/lang_en.js'); require('../src/main/lang_de.js');
require('../src/main/settings_reg.js'); require('../src/main/aqpredict.js'); require('../src/main/game.js');
let fails = 0;
const check = (ok, msg, info) => { if (!ok) { fails++; console.log('  ✗ ' + msg + (info ? '  — ' + info : '')); } else console.log('  ✓ ' + msg); };
const G = V.Game, proto = G.prototype, PR = G.PRESETS;
const GOV = ['smartQuality', 'aqState', 'aqGpuRungs', 'aqCpuRungs', 'aqPush', 'aqPop', 'aqReset', 'aqApply', 'aqRemember', 'aqRestoreSteps', 'aqRestoreStart', 'aqMemKey', 'aqMemRead', 'aqMemWrite'];
const BAL = Object.assign({ preset: 'balanced' }, PR.balanced);
let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) >>> 0; return seed / 4294967296; };
// a stand-in game: the frame's real interval ms(t, rungs) — the GPU untimed (a software or an old driver: the frame time
// is all the governor sees), the loop's clamp on dt as in game.js
function run(msOf, T, timed, warps) {
  const g = { renderer: { gpuMs: undefined, setOverride() {} }, jsMs: 4, fps: 0, time: 0, slowBase: false, folkBase: 100, folkDist: 100, horizon: null, bench: false, world: { renderDist: 10, meshBudget: 6, streamRung: 0 }, state: 'play', aqChanged() {}, settings: BAL };
  for (const k of GOV) g[k] = proto[k];
  const trace = [], fpsRead = []; let real = 0, frames = 0, acc = 0, n = 0, lastWhole = 0;
  while (real < T) {
    // (warps: after each whole frame that many warp frames of 30 ms — the loop runs, the governor waits: game.js playFrame)
    for (let k = 0; k < (warps || 0); k++) { const w = 0.03; g.frameDt = w; g.sqDt = (g.sqDt || 0) + w; acc += w; n++; if (acc > 0.5) { g.fps = n / acc; acc = 0; n = 0; } g.time += w; real += w; }
    const aq = g.aqState(), ms = msOf(real, aq.stack.length) * (1 + (rnd() - 0.5) * 0.06), raw = ms / 1000;
    if (timed) g.renderer.gpuMs = ms * 0.9;
    const dt = Math.min(raw, 0.1);   // (game.js loop: the simulation's step)
    g.frameDt = Math.min(raw, 2); g.sqDt = (g.sqDt || 0) + g.frameDt;   // (game.js loop: frameDt, and the governor's time since its call)
    acc += raw; n++; if (acc > 0.5) { g.fps = n / acc; acc = 0; n = 0; }   // (the HUD's real frame rate)
    g.time += dt; real += raw; frames++;
    const before = aq.stack.join('');
    g.smartQuality(dt, BAL, g.world);
    if (aq.stack.join('') !== before) trace.push([frames, +real.toFixed(2), aq.stack.join('')]);
    if (aq.fpsWin) fpsRead.push([real, aq.fpsWin, warps ? 1 / Math.max(1e-6, real - lastWhole) : 1000 / ms]);
    lastWhole = real;
  }
  return { trace, fpsRead, g };
}

console.log('a · 600 ms a frame (about 1.7 fps)');
{
  const r = run(() => 600, 60);
  const first = r.trace.length ? r.trace[0][1] : null, second = r.trace.length > 1 ? r.trace[1][1] : null;
  console.log('    steps: ' + r.trace.map((t) => `${t[2]}@${t[1]}s`).join(' ') || '–');
  check(first !== null && first <= 8, `the first step within 8 real seconds (${first} s)`);
  check(second !== null && second - first <= 8, `the next one within 8 more (${second === null ? '–' : (second - first).toFixed(1)} s; it was about 15)`);
  const late = r.fpsRead.filter((f) => f[0] > 6);
  const off = late.length ? Math.max(...late.map((f) => Math.abs(f[1] - f[2]) / f[2])) : 1;
  check(late.length > 0 && off <= 0.25, `the frame rate it reads is the real one (worst ${Math.round(off * 100)} % off; it read 10 fps for 1.7)`);
}

console.log('b · 12–60 ms a frame: the same decisions as before');
{
  const sea = (t) => (t < 8 ? 14 : t < 8.6 ? 14 + (t - 8) / 0.6 * 40 : t < 40 ? 54 : 14);
  seed = 11; const a = run((t, n) => Math.max(12, sea(t) * Math.pow(0.85, n)), 70, true);
  seed = 12; const b = run((t, n) => Math.max(12, (t % 20 < 10 ? 30 : 16) * Math.pow(0.9, n)), 70, false);
  let h = 2166136261 >>> 0;
  for (const t of a.trace.concat([[-1]], b.trace)) for (const v of [t[0], t[2] || '']) { const s = String(v); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } }
  if (process.env.PIN) console.log('    PIN', h.toString(16), JSON.stringify(a.trace), JSON.stringify(b.trace));
  check(a.trace.length > 0 && b.trace.length > 0, `the governor works in both scenes (${a.trace.length} and ${b.trace.length} changes)`);
  check(h.toString(16) === 'a6a40531', 'every step at the same frame as before (trace pinned)', h.toString(16));
}

console.log('d · Bildwarp: 150 ms whole frames, three 30 ms warps after each');
{
  const r = run(() => 150, 40, false, 3);
  const late = r.fpsRead.filter((f) => f[0] > 6);
  const read = late.length ? late[late.length - 1][1] : 0, real = late.length ? late[late.length - 1][2] : 1;
  check(late.length > 0 && Math.abs(read - real) / real <= 0.1, `the whole frames' rate it reads is the real one (${read.toFixed(2)} for ${real.toFixed(2)} a second)`);
}

console.log('c · the loop');
{
  const src = require('fs').readFileSync(__dirname + '/../src/main/game.js', 'utf8');
  check(/this\.frameDt = [^;]*Math\.min\(dt, 2\)/.test(src) && /dt = Math\.min\(dt, 0\.1\)/.test(src), 'game.js loop: frameDt the real interval (≤ 2 s), dt still clamped at 0.1 s');
  check(/this\.sqDt = \(this\.sqDt \|\| 0\) \+ this\.frameDt/.test(src), "game.js loop: the governor's time since its last call (warp frames included)");
  check(/this\.fpsAcc = \(this\.fpsAcc \|\| 0\) \+ this\.frameDt/.test(src), "the HUD's frame rate counts real time");
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
