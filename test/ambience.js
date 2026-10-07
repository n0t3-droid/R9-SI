// Ambience (A1 Atmosphäre): the synthesized soundscape builds with a stubbed AudioContext, stays within 12 persistent
// Web Audio nodes, and its layers follow the place, the hour and the weather. Node only, no browser.
//   bash test/wt_run.sh ambience.js
require('./load_shared.js');
require('../src/main/weather.js');
require('../src/main/ambience.js');
const R = VR.R, F = VR.F;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const B = (k) => VR.biomeByKey(k);

// ---- a stubbed Web Audio context: every node is recorded with its connections and parameter values
function makeCtx() {
  const nodes = [];
  // a parameter keeps its last value and the highest value ever set on it (an envelope's peak)
  const param = (v) => {
    const p = { value: v, peak: -Infinity };            // the default value is not an envelope's peak
    const set = (x) => { p.value = x; if (x > p.peak) p.peak = x; };
    p.setValueAtTime = set; p.linearRampToValueAtTime = set; p.exponentialRampToValueAtTime = set; p.setTargetAtTime = set;
    return p;
  };
  const node = (kind, extra) => {
    const n = Object.assign({ kind, outs: [], started: false, stopped: false, connect(d) { this.outs.push(d); return d; }, disconnect() {}, start() { this.started = true; }, stop() { this.stopped = true; } }, extra);
    nodes.push(n); return n;
  };
  const dest = node('destination', {});
  return {
    sampleRate: 44100, currentTime: 0, state: 'running', destination: dest, nodes,
    createBuffer(ch, len, rate) { const d = []; for (let c = 0; c < ch; c++) d.push(new Float32Array(len)); return { length: len, sampleRate: rate, numberOfChannels: ch, duration: len / rate, getChannelData: (c) => d[c] }; },
    createBufferSource() { return node('source', { buffer: null, loop: false, playbackRate: param(1) }); },
    createGain() { return node('gain', { gain: param(1) }); },
    createBiquadFilter() { return node('filter', { type: 'lowpass', frequency: param(350), Q: param(1) }); },
    createStereoPanner() { return node('panner', { pan: param(0) }); },
    createOscillator() { return node('osc', { frequency: param(440), type: 'sine' }); },
  };
}
// the audio manager the ambience talks to (src/main/audio.js): a context and the ambient bus
function makeAudio(ctx) { return { ctx, amb: ctx.createGain(), vol: { ambient: 0.6 } }; }

// ---- a fake world: a flat meadow, with optional water and trees, and a sky light we can choose
function makeWorld(o) {
  const water = R.byName.water.defaultState, leaves = R.byName.oak_leaves.defaultState, stone = R.byName.stone.defaultState;
  const grass = R.byName.grass_block.defaultState;
  const sky = o.sky === undefined ? 15 : o.sky;
  const W = {
    calls: 0,
    getBlock(x, y, z) {
      W.calls++;
      if (o.lake && Math.hypot(x - 0, z - 0) <= o.lake && y <= 70 && y >= 60) return water;       // a lake around the origin, surface at y 70
      if (o.trees && y >= 66 && y <= 72 && ((x + z) & 7) === 0 && Math.hypot(x, z) < 10) return leaves;
      if (y < 64) return stone;
      if (y === 64) return grass;
      return 0;
    },
    getLight(x, y, z) { return (sky << 12) | (15 << 8) | (15 << 4) | 15; },
    topAt(x, z) { return o.hill ? 64 + Math.max(0, 20 - Math.hypot(x, z) * 0.2) : 64; },
    biomeAt() { return 0; },
  };
  return W;
}
const env = (o) => Object.assign({ rain: 0, snow: 0, night: 0, wind: 1, sun: 1, wet: 0, fog: 0, dark: 0, cloud: 0.2 }, o || {});
const run = (amb, secs, ctxS) => { for (let t = 0; t < secs; t += 0.1) amb.update(0.1, ctxS); };
const gainOf = (amb, name) => amb.L[name].g.gain.value;

// ---- the graph builds with the stub and synthesizes its sounds (no audio files)
const ctx = makeCtx();
const audio = makeAudio(ctx);
const before = ctx.nodes.length;
const amb = new VR.Ambience(audio);
amb.init(ctx);
const built = ctx.nodes.length - before;
check(built <= 12, 'at most 12 persistent Web Audio nodes (' + built + ' built)');
check(amb.L && ['wind', 'rain', 'water', 'birds', 'crickets'].every(k => amb.L[k] && amb.L[k].src && amb.L[k].g), 'each layer has a source and a gain');
{
  let ok = true, rmsAll = [];
  for (const k of ['wind', 'rain', 'water', 'birds', 'crickets']) {
    const b = amb.L[k].src.buffer; if (!b || !b.length) { ok = false; continue; }
    const d = b.getChannelData(0); let s = 0; for (let i = 0; i < d.length; i++) { if (!isFinite(d[i])) ok = false; s += d[i] * d[i]; }
    const rms = Math.sqrt(s / d.length); rmsAll.push(rms.toFixed(3));
    if (!(rms > 0.003 && rms < 1)) ok = false;
    if (!amb.L[k].src.loop) ok = false;
  }
  check(ok, 'every loop is synthesized, loops seamlessly and is neither silent nor clipped (rms ' + rmsAll.join(' ') + ')');
}
{
  const L = amb.L;
  const toMuffle = (k) => L[k].g.outs.includes(amb.muffle);
  check(['wind', 'rain', 'water', 'birds', 'crickets'].every(k => L[k].src.outs.includes(L[k].g) && toMuffle(k)), 'source → layer gain → the shared muffle filter');
  check(amb.muffle.outs.includes(amb.busGain) && amb.busGain.outs.includes(audio.amb), 'the muffle filter → the bus → the ambient volume (Umgebung)');
}

// ---- a summer night in a meadow: crickets sing and the birds are silent
{
  const ctxS = { w: makeWorld({}), eye: [0.5, 66, 0.5], E: env({ night: 1 }), biome: B('meadow'), speed: 0, dim: 'overworld', underwater: false };
  run(amb, 3, ctxS);
  check(gainOf(amb, 'crickets') > 0.05, 'night meadow: crickets sing (gain ' + gainOf(amb, 'crickets').toFixed(3) + ')');
  check(gainOf(amb, 'birds') < 0.01, 'night: no birds');
}
// ---- a day in a forest: birds in the trees, no crickets
{
  const ctxS = { w: makeWorld({ trees: true }), eye: [0.5, 66, 0.5], E: env({ night: 0 }), biome: B('forest'), speed: 0, dim: 'overworld', underwater: false };
  run(amb, 3, ctxS);
  check(gainOf(amb, 'birds') > 0.05, 'day among trees: birds (gain ' + gainOf(amb, 'birds').toFixed(3) + ')');
  check(gainOf(amb, 'crickets') < 0.01, 'day: no crickets');
  const open = { w: makeWorld({}), eye: [0.5, 66, 0.5], E: env({ night: 0 }), biome: B('forest'), speed: 0, dim: 'overworld', underwater: false };
  run(amb, 3, open);
  check(gainOf(amb, 'birds') < 0.05, 'in the open, far from trees, the birds are quiet (gain ' + gainOf(amb, 'birds').toFixed(3) + ')');
}
// ---- crickets need warmth: a snowy night is silent
{
  const ctxS = { w: makeWorld({}), eye: [0.5, 66, 0.5], E: env({ night: 1 }), biome: B('snowy_plains'), speed: 0, dim: 'overworld', underwater: false };
  run(amb, 3, ctxS);
  check(gainOf(amb, 'crickets') < 0.01, 'a snowy night is silent of crickets');
}
// ---- water near water: the lake is heard, a dry hill is not
{
  const near = { w: makeWorld({ lake: 6 }), eye: [0.5, 66, 0.5], E: env({ night: 0 }), biome: B('meadow'), speed: 0, dim: 'overworld', underwater: false };
  run(amb, 3, near);
  check(gainOf(amb, 'water') > 0.05, 'water within 12 blocks: the water sounds (gain ' + gainOf(amb, 'water').toFixed(3) + ')');
  const dry = { w: makeWorld({}), eye: [0.5, 66, 0.5], E: env({ night: 0 }), biome: B('meadow'), speed: 0, dim: 'overworld', underwater: false };
  run(amb, 3, dry);
  check(gainOf(amb, 'water') < 0.01, 'no water near: no water sound');
}
// ---- weather: rain and wind in a storm, stronger high up; the rain is silent in a desert
{
  const calm = { w: makeWorld({}), eye: [0.5, 66, 0.5], E: env(), biome: B('plains'), speed: 0, dim: 'overworld', underwater: false };
  run(amb, 3, calm);
  const windCalm = gainOf(amb, 'wind'), rainCalm = gainOf(amb, 'rain');
  const storm = { w: makeWorld({}), eye: [0.5, 66, 0.5], E: env({ rain: 1, wind: 3 }), biome: B('plains'), speed: 0, dim: 'overworld', underwater: false };
  run(amb, 4, storm);
  check(gainOf(amb, 'rain') > 0.3 && rainCalm < 0.01, 'a storm rains (gain ' + gainOf(amb, 'rain').toFixed(3) + ' against ' + rainCalm.toFixed(3) + ' in clear weather)');
  check(gainOf(amb, 'wind') > windCalm * 1.5, 'the storm wind is much louder (' + gainOf(amb, 'wind').toFixed(3) + ' vs ' + windCalm.toFixed(3) + ')');
  const windLow = gainOf(amb, 'wind');
  const high = { w: makeWorld({}), eye: [0.5, 220, 0.5], E: env({ rain: 1, wind: 3 }), biome: B('plains'), speed: 0, dim: 'overworld', underwater: false };
  run(amb, 4, high);
  const windHigh = gainOf(amb, 'wind');
  check(windHigh > windLow, 'the wind is stronger high up (' + windHigh.toFixed(3) + ' at y 220 against ' + windLow.toFixed(3) + ' at y 66)');
  const desert = { w: makeWorld({}), eye: [0.5, 66, 0.5], E: env({ rain: 1, wind: 3 }), biome: B('desert'), speed: 0, dim: 'overworld', underwater: false };
  run(amb, 4, desert);
  check(gainOf(amb, 'rain') < 0.01, 'a desert has no rain sound, even under a storm');
}
// ---- indoors (sky light under 4): everything outside is muffled to 800 Hz and 9 dB quieter; outdoors it is open
{
  const house = { w: makeWorld({ sky: 2 }), eye: [0.5, 66, 0.5], E: env({ night: 1 }), biome: B('meadow'), speed: 0, dim: 'overworld', underwater: false };
  run(amb, 3, house);
  check(amb.muffle.frequency.value === 800, 'indoors the bus is lowpassed at 800 Hz (' + amb.muffle.frequency.value + ')');
  check(Math.abs(amb.busGain.gain.value - 0.355) < 0.01, 'indoors it is 9 dB quieter (' + amb.busGain.gain.value.toFixed(3) + ')');
  const out = { w: makeWorld({ sky: 15 }), eye: [0.5, 66, 0.5], E: env({ night: 1 }), biome: B('meadow'), speed: 0, dim: 'overworld', underwater: false };
  run(amb, 3, out);
  check(amb.muffle.frequency.value > 10000 && Math.abs(amb.busGain.gain.value - 1) < 0.01, 'outdoors the bus is open again');
}
// ---- the switches: nature sounds off, weather sounds off; both off is silence
{
  const ctxS = { w: makeWorld({ lake: 6, trees: true }), eye: [0.5, 66, 0.5], E: env({ rain: 1, wind: 3, night: 1 }), biome: B('meadow'), speed: 0, dim: 'overworld', underwater: false };
  amb.setOptions({ nature: false, weather: true }); run(amb, 3, ctxS);
  check(['wind', 'water', 'birds', 'crickets'].every(k => gainOf(amb, k) < 0.001) && gainOf(amb, 'rain') > 0.3, 'Natur-Klänge aus: nature is silent, the rain still falls');
  amb.setOptions({ nature: true, weather: false }); run(amb, 3, ctxS);
  check(gainOf(amb, 'rain') < 0.001, 'Wetter aus: the rain is silent');
  run(amb, 3, { ...ctxS, E: env({ night: 1 }) });
  check(gainOf(amb, 'crickets') > 0.05, 'Wetter aus: the crickets still sing on a dry night');
  const before2 = ctx.nodes.length; amb.thunder(2); check(ctx.nodes.length === before2, 'Wetter aus: no thunder');
  amb.setOptions({ nature: false, weather: false }); run(amb, 3, ctxS);
  check(['wind', 'rain', 'water', 'birds', 'crickets'].every(k => gainOf(amb, k) < 0.001), 'both off: silence');
  amb.setOptions({ nature: true, weather: true });
}
// ---- thunder: one short rumble per bolt; the far ones are quieter and duller
{
  const beforeN = ctx.nodes.length;
  amb.thunder(0.5);
  const near = ctx.nodes.slice(beforeN);
  const nearGain = near.find(n => n.kind === 'gain') ? near.find(n => n.kind === 'gain').gain.peak : -1;
  const nearFreq = near.find(n => n.kind === 'filter') ? near.find(n => n.kind === 'filter').frequency.value : -1;
  const mid = ctx.nodes.length;
  amb.thunder(4);
  const far = ctx.nodes.slice(mid);
  const farGain = far.find(n => n.kind === 'gain') ? far.find(n => n.kind === 'gain').gain.peak : -1;
  const farFreq = far.find(n => n.kind === 'filter') ? far.find(n => n.kind === 'filter').frequency.value : -1;
  check(near.some(n => n.kind === 'source' && n.started) && far.some(n => n.kind === 'source' && n.started), 'each bolt starts a thunder rumble');
  check(nearGain > farGain && nearFreq > farFreq && farFreq > 0, 'a far bolt is quieter and duller (' + nearGain.toFixed(2) + '/' + farGain.toFixed(2) + ', ' + Math.round(nearFreq) + '/' + Math.round(farFreq) + ' Hz)');
  check(near.length <= 3 && far.length <= 3 && near.length >= 3, 'each thunder adds three short-lived nodes (' + near.length + ' and ' + far.length + ')');
}
// ---- no growth: the graph stays the same size however long it plays
{
  const n0 = ctx.nodes.length;
  const ctxS = { w: makeWorld({ lake: 4, trees: true }), eye: [0.5, 66, 0.5], E: env({ night: 0.5, rain: 0.4 }), biome: B('meadow'), speed: 2, dim: 'overworld', underwater: false };
  run(amb, 60, ctxS);
  check(ctx.nodes.length === n0, 'a minute of play adds no nodes (' + (ctx.nodes.length - n0) + ' more)');
}
// ---- the context is sampled, not every frame: the world is read about twice a second
{
  const w = makeWorld({});
  const ctxS = { w, eye: [0.5, 66, 0.5], E: env(), biome: B('meadow'), speed: 0, dim: 'overworld', underwater: false };
  const c0 = w.calls; run(amb, 10, ctxS); const perSec = (w.calls - c0) / 10;
  check(perSec < 1500, 'the world is sampled about twice a second (' + Math.round(perSec) + ' block reads a second)');
  // both switches off: nothing to read, so the world is not touched at all (the Very Low budget)
  amb.setOptions({ nature: false, weather: false });
  const c1 = w.calls; run(amb, 10, ctxS);
  check(w.calls - c1 === 0, 'both switches off: the world is not read (' + (w.calls - c1) + ' block reads)');
  amb.setOptions({ nature: true, weather: true });
}

console.log(fails ? fails + ' FAILED' : 'ALL OK');
process.exit(fails ? 1 : 0);
