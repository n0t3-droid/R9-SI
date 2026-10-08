// Every named sound plays: each `case '…':` of audio.js's play() is played on a stubbed AudioContext (as in
// test/klang.js) and must neither throw nor stay silent; the ship's turbine and the cockpit radio loop start and stop.
// Written after the v042 merge: the ship sounds (flight.js / cockpit.js / cabin.js) and the construction site's
// (baustelle.js) called a noise helper and a profile table the F4 sound rewrite had removed.
//   bash test/wt_run.sh sound_names.js 300
require('./load_shared.js');
require('../src/main/klang.js');
require('../src/main/audio.js');
const fs = require('fs');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };

// ---- a stubbed Web Audio context (the same as test/klang.js): every node is recorded
function makeCtx() {
  const ctx = { sampleRate: 8000, currentTime: 0, state: 'running', nodes: [] };
  const param = (v) => {
    const p = { value: v };
    const set = (x) => { p.value = x; };
    p.setValueAtTime = set; p.linearRampToValueAtTime = set; p.exponentialRampToValueAtTime = set; p.setTargetAtTime = set; p.cancelScheduledValues = () => {};
    return p;
  };
  const node = (kind, extra) => {
    const n = Object.assign({ kind, outs: [], startAt: -1, stopAt: -1, connect(d) { this.outs.push(d); return d; }, disconnect(d) { this.outs = d ? this.outs.filter(x => x !== d) : []; }, start(t) { this.startAt = t === undefined ? ctx.currentTime : t; }, stop(t) { this.stopAt = t === undefined ? ctx.currentTime : t; } }, extra);
    ctx.nodes.push(n); return n;
  };
  ctx.destination = node('destination', {});
  ctx.createBuffer = (ch, len, rate) => { const d = []; for (let c = 0; c < ch; c++) d.push(new Float32Array(len)); return { length: len, sampleRate: rate, numberOfChannels: ch, duration: len / rate, getChannelData: (c) => d[c] }; };
  ctx.createBufferSource = () => node('source', { buffer: null, loop: false, playbackRate: param(1) });
  ctx.createGain = () => node('gain', { gain: param(1) });
  ctx.createBiquadFilter = () => node('filter', { type: 'lowpass', frequency: param(350), Q: param(1), gain: param(0) });
  ctx.createStereoPanner = () => node('panner', { pan: param(0) });
  ctx.createOscillator = () => node('osc', { type: 'sine', frequency: param(440), detune: param(0) });
  ctx.createConvolver = () => { const n = node('convolver', {}); let buf = null; Object.defineProperty(n, 'buffer', { get() { return buf; }, set(v) { if (v && buf) throw new Error('InvalidStateError: a ConvolverNode takes its buffer once'); buf = v; }, enumerable: true }); return n; };
  ctx.createDynamicsCompressor = () => node('comp', { threshold: param(-24), ratio: param(12), knee: param(30), attack: param(0.003), release: param(0.25) });
  return ctx;
}
const world = { getLight() { return (15 << 12) | (15 << 8) | (15 << 4) | 15; }, getBlock() { return 0; }, topAt() { return 64; } };

// the names: every case label of play()'s switch (the text between `play(name, opts) {` and the next method)
const src = fs.readFileSync(__dirname + '/../src/main/audio.js', 'utf8');
const at = src.indexOf('    play(name, opts) {');
const body = src.slice(at, src.indexOf('\n    }\n', at));
const names = [...body.matchAll(/case '([a-z_0-9]+)':/g)].map(m => m[1]);
console.log('play() names: ' + names.length);
check(at > 0 && names.length >= 30, 'play() has its switch of named sounds (' + names.length + ')');
for (const n of ['thump', 'boost', 'servo', 'clunk', 'switch', 'button', 'lever', 'deny', 'static', 'spool']) check(names.includes(n), 'the ship sound ' + n + ' is one of them');
for (const n of ['bau_start', 'hammer', 'clang', 'thud', 'clatter', 'bau_fanfare']) check(names.includes(n), 'the construction-site sound ' + n + ' is one of them');

// each name, alone and with a place and a volume: no exception, and at least one node scheduled
const bad = [], silent = [];
for (const n of names) {
  for (const opts of [undefined, { vol: 0.5 }, { vol: 1, at: [3, 66, 0] }]) {
    const ctx = makeCtx(), a = new VR.Audio(); a.init(ctx); a.listen([0.5, 66, 0.5], 0, world, false);
    const before = ctx.nodes.length;
    try { a.play(n, opts); } catch (e) { if (!bad.some(b => b.startsWith(n + ':'))) bad.push(n + ': ' + (e && e.message)); continue; }
    if (ctx.nodes.length === before && !(opts && opts.at)) silent.push(n);
  }
}
check(!bad.length, 'every named sound plays without an exception' + (bad.length ? ': ' + bad.join(' · ') : ''));
check(!silent.length, 'every named sound builds at least one node' + (silent.length ? ': silent ' + [...new Set(silent)].join(', ') : ''));

// the ship's engines: the turbine whine and the cockpit radio loop start, follow and stop
{
  const ctx = makeCtx(), a = new VR.Audio(); a.init(ctx);
  let ok = true;
  try { a.turbine(0.05, 1); a.turbine(0.08, 1.4); a.turbine(0, 0); a.loop('radio', 0.3); a.loop('radio', 0); a.loop('engine', 0.2, 0.6); a.loop('engine', 0); } catch (e) { ok = false; console.log('    ' + e.message); }
  check(ok && !!a.turb && !!a.loops.radio && !!a.loops.engine, 'the turbine whine and the radio and engine loops start and stop');
  check(a.loops.radio && a.loops.radio.f.frequency.value === 1700, 'the radio loop is the band-passed hiss at 1.7 kHz');
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
