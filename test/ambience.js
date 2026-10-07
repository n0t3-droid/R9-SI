// A1 Atmosphäre — the synthesized soundscape (src/main/ambience.js) against a stub AudioContext that counts live
// nodes and records every AudioParam automation: crickets at night, birds by day in the forest, interior muffling,
// thunder after the flash, the 12-node cap, switches, „Aus", no audio context.
const ROOT = '/home/claude/vr';
require(ROOT + '/src/shared/core.js');
try { require(ROOT + '/src/main/ambience.js'); } catch (e) { console.log('  (ambience.js: ' + e.message.split('\n')[0] + ')'); }
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };

// ---------------------------------------------------------------- the stub Web Audio context (test utility)
function stubAudio() {
  const ac = { currentTime: 0, sampleRate: 44100, state: 'running', created: 0, disposed: 0, nodes: [] };
  const param = (v) => {
    const p = { value: v, events: [] };
    const ev = (type, value, time, extra) => { p.events.push({ type, value, time, extra }); if (!isFinite(time) || (typeof value === 'number' && !isFinite(value))) throw new Error('non-finite automation ' + type); return p; };
    p.setValueAtTime = (val, t) => ev('set', val, t);
    p.linearRampToValueAtTime = (val, t) => ev('lin', val, t);
    p.exponentialRampToValueAtTime = (val, t) => { if (val <= 0) throw new Error('exponential ramp to ' + val); return ev('exp', val, t); };
    p.setTargetAtTime = (val, t, tc) => ev('target', val, t, tc);
    p.setValueCurveAtTime = (curve, t, d) => ev('curve', Array.from(curve), t, d);
    p.cancelScheduledValues = (t) => ev('cancel', null, t);
    p.cancelAndHoldAtTime = (t) => ev('hold', null, t);
    return p;
  };
  const node = (kind, extra) => {
    const n = Object.assign({ kind, alive: true, outs: [], started: false, stopped: false }, extra);
    n.connect = (d) => { if (!n.alive) throw new Error('connect after dispose: ' + kind); n.outs.push(d); return d; };
    // as in Web Audio: disconnect(dest) cuts one connection, disconnect() all of them (the node is then gone for good here)
    n.disconnect = (d) => { if (d) { const i = n.outs.indexOf(d); if (i < 0) throw new Error('not connected'); n.outs.splice(i, 1); return; } if (n.alive) { n.alive = false; n.outs.length = 0; ac.disposed++; } };
    ac.created++; ac.nodes.push(n);
    return n;
  };
  ac.destination = { kind: 'destination', connect() {} };
  ac.createGain = () => node('gain', { gain: param(1) });
  ac.createBiquadFilter = () => node('filter', { type: 'lowpass', frequency: param(350), Q: param(1), gain: param(0) });
  ac.createOscillator = () => node('osc', { type: 'sine', frequency: param(440), detune: param(0), start(t) { this.started = true; }, stop(t) { this.stopped = true; } });
  ac.createBufferSource = () => node('src', { buffer: null, loop: false, playbackRate: param(1), start(t) { this.started = true; }, stop(t) { this.stopped = true; } });
  ac.createStereoPanner = () => node('pan', { pan: param(0) });
  ac.createBuffer = (ch, len, sr) => ({ numberOfChannels: ch, length: len, sampleRate: sr, getChannelData: () => new Float32Array(len) });
  const live = () => ac.created - ac.disposed;
  // the game's audio object: the ambient bus (the „Umgebung" volume) and the shared noise buffer
  const amb = { kind: 'ambBus', gain: param(0.6), connect() {} };
  return { ac, live, audio: { ctx: ac, amb, noise: ac.createBuffer(1, 88200, 44100) } };
}
let rs = 7; const rand = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };
const base = { tod: 6000, night: 0, birdK: 0, temp: 0.8, rain: 0, snow: 0, storm: 0, wind: 1, y: 70, speed: 0, indoors: false, cave: false, underwater: false, water: 0, village: 0 };
const ctxOf = (o) => Object.assign({}, base, o);
const runFor = (st, amb, secs, ctx, each) => { for (let i = 0; i < secs * 10; i++) { st.ac.currentTime += 0.1; amb.update(0.1, typeof ctx === 'function' ? ctx(i / 10) : ctx); if (each) each(i / 10); } };
const lastTarget = (p) => { for (let i = p.events.length - 1; i >= 0; i--) if (p.events[i].type === 'target') return p.events[i].value; return null; };
const A = VR.Ambience;
check(typeof A === 'function', 'VR.Ambience exists');
if (typeof A !== 'function') { console.log('FAIL ' + fails); process.exit(1); }

// ---------------------------------------------------------------- 1. a warm night on the meadow: crickets, no birds
{
  const st = stubAudio(), amb = new A(st.audio, { rand });
  runFor(st, amb, 3, ctxOf({ tod: 18000, night: 1, birdK: 0.55, temp: 0.8 }));
  check(amb.levels.crickets > 0 && !amb.levels.birds, 'night meadow: crickets ' + (amb.levels.crickets || 0).toFixed(3) + ', birds ' + (amb.levels.birds || 0));
  const osc = st.ac.nodes.find(n => n.kind === 'osc' && n.alive);
  const f = osc && (osc.frequency.events.length ? osc.frequency.events.map(e => e.value) : [osc.frequency.value]);
  check(!!osc && f.every(v => v >= 4000 && v <= 4500), 'the cricket sings at about 4.2 kHz (' + (f ? Math.min(...f) + '–' + Math.max(...f) : 'no oscillator') + ' Hz)');
  const gate = osc && osc.outs[0];
  const pulses = gate ? gate.gain.events.filter(e => e.type === 'lin' && e.value > 0).map(e => e.time) : [];
  const gaps = []; for (let i = 1; i < pulses.length; i++) gaps.push(pulses[i] - pulses[i - 1]);
  check(gaps.some(g => Math.abs(g - 1 / 35) < 0.003), 'chirps are pulsed at 35 Hz (' + pulses.length + ' pulses)');
}
// ---------------------------------------------------------------- 2. a forest by day: birds, no crickets
{
  const st = stubAudio(), amb = new A(st.audio, { rand });
  runFor(st, amb, 6, ctxOf({ tod: 3000, night: 0, birdK: 1 }));
  check(amb.levels.birds > 0 && !amb.levels.crickets, 'day forest: birds ' + (amb.levels.birds || 0).toFixed(3) + ', crickets ' + (amb.levels.crickets || 0));
  const osc = st.ac.nodes.find(n => n.kind === 'osc' && n.alive);
  const fe = osc ? osc.frequency.events.filter(e => typeof e.value === 'number').map(e => e.value) : [];
  const curves = osc ? osc.frequency.events.filter(e => e.type === 'curve') : [];
  const all = fe.concat(...curves.map(c => c.value));
  check(all.length >= 6 && all.every(v => v >= 1500 && v <= 6000), 'bird song glides between 1.5 and 6 kHz (' + all.length + ' points)');
  check(st.ac.nodes.some(n => n.kind === 'pan' && n.alive && n.pan.events.length > 0), 'phrases are panned');
}
// ---------------------------------------------------------------- 3. indoors: muffled, −9 dB
{
  const st = stubAudio(), amb = new A(st.audio, { rand });
  const day = ctxOf({ tod: 3000, birdK: 1, wind: 2.2, y: 120 });
  runFor(st, amb, 2, day);
  const out = amb.levels.wind;
  runFor(st, amb, 2, Object.assign({}, day, { indoors: true }));
  const bus = st.ac.nodes.find(n => n.kind === 'filter' && n.alive && n.outs.indexOf(st.audio.amb) >= 0);
  check(!!bus && lastTarget(bus.frequency) === 800 && amb.muffled, 'indoors the outside layers are low-passed at 800 Hz');
  check(out > 0 && Math.abs(amb.levels.wind / out - 0.355) < 0.01, 'indoors the wind is 9 dB quieter (' + out.toFixed(3) + ' → ' + amb.levels.wind.toFixed(3) + ')');
  runFor(st, amb, 2, day);
  check(lastTarget(bus.frequency) >= 16000 && !amb.muffled, 'outside again: open');
}
// ---------------------------------------------------------------- 4. wind grows with altitude and storm
{
  const st = stubAudio(), amb = new A(st.audio, { rand });
  runFor(st, amb, 2, ctxOf({ y: 70, wind: 1 })); const low = amb.levels.wind || 0;
  runFor(st, amb, 2, ctxOf({ y: 190, wind: 1 })); const high = amb.levels.wind;
  runFor(st, amb, 2, ctxOf({ y: 70, wind: 3, rain: 1, storm: 1 })); const storm = amb.levels.wind;
  check(high > low * 2 && storm > low * 2, 'wind: meadow ' + low.toFixed(3) + ' · mountain ' + high.toFixed(3) + ' · storm ' + storm.toFixed(3));
}
// ---------------------------------------------------------------- 5. rain, snow, thunder after the flash
{
  const st = stubAudio(), amb = new A(st.audio, { rand });
  const storm = ctxOf({ rain: 1, storm: 1, wind: 3 });
  runFor(st, amb, 2, storm);
  check(amb.levels.rain > 0.3, 'storm: rain ' + amb.levels.rain.toFixed(3));
  const t0 = st.ac.currentTime;
  check(amb.thunder(2, 1, 690) === true, 'a strike asks for thunder');
  runFor(st, amb, 1, storm);
  const g = st.ac.nodes.filter(n => n.kind === 'gain' && n.alive).find(n => n.gain.events.some(e => e.time >= t0 + 1.95 && e.value > 0.2));
  check(!!g, 'the thunder rolls in 2 s after the flash');
  const ev = g ? g.gain.events.filter(e => e.time >= t0 + 1.95) : [];
  check(ev.length >= 4 && ev[ev.length - 1].time - ev[0].time >= 2.5, 'it rumbles for a few seconds (' + (ev.length ? (ev[ev.length - 1].time - ev[0].time).toFixed(1) : 0) + ' s)');
  runFor(st, amb, 2, ctxOf({ snow: 1, wind: 1.5 }));
  check(!amb.levels.rain, 'snow falls silently');
}
// ---------------------------------------------------------------- 6. water, village
{
  const st = stubAudio(), amb = new A(st.audio, { rand });
  runFor(st, amb, 2, ctxOf({ water: 1 })); const w1 = amb.levels.water;
  runFor(st, amb, 2, ctxOf({ water: 0 }));
  check(w1 > 0 && !amb.levels.water, 'water laps near the shore (' + w1.toFixed(3) + ') and not inland');
  runFor(st, amb, 2, ctxOf({ village: 1, tod: 6000 })); const td = amb.levels.town;
  runFor(st, amb, 2, ctxOf({ village: 1, tod: 18000, night: 1 })); const tn = amb.levels.town;
  check(td > 0 && tn < td, 'the village murmurs by day (' + td.toFixed(3) + ') and quietens at night (' + tn.toFixed(3) + ')');
}
// ---------------------------------------------------------------- 7. never more than 12 nodes
{
  const st = stubAudio(), amb = new A(st.audio, { rand });
  let peak = 0;
  // a riverside village at dusk, windy, birds and crickets overlapping, a shower passing with thunder
  runFor(st, amb, 60, (t) => ctxOf({ tod: 12400 + t * 20, night: Math.min(1, t / 40), birdK: 1, temp: 0.8, wind: 2.4, y: 110, water: 1, village: 1, rain: t > 20 && t < 40 ? 1 : 0, storm: t > 20 && t < 40 ? 1 : 0 }), (t) => { if (Math.abs(t % 5) < 0.05) amb.thunder(0.5 + (t % 3), 0.8, 600); peak = Math.max(peak, st.live()); if (amb.alive() !== st.live()) peak = 99; });
  check(peak > 0 && peak <= 12, 'a crowded dusk never needs more than 12 live nodes (peak ' + peak + ')');
}
// ---------------------------------------------------------------- 8. switches, „Aus", no audio
{
  const st = stubAudio(), amb = new A(st.audio, { rand });
  const day = ctxOf({ tod: 3000, birdK: 1 });
  runFor(st, amb, 3, day); const n0 = st.live();
  amb.setLayers({ birds: false });
  runFor(st, amb, 3, day);
  check(!amb.levels.birds && st.live() === n0 - 3, 'birds switched off: their three nodes are freed (' + n0 + ' → ' + st.live() + ')');
  amb.setEnabled(false); runFor(st, amb, 1, day);
  check(st.live() === 0 && amb.alive() === 0, 'Natur-Klänge „Aus": every node is gone');
  const st2 = stubAudio(); st2.audio.ctx = null; const amb2 = new A(st2.audio, { rand });
  let threw = null; try { amb2.update(0.6, day); amb2.thunder(1, 1, 300); amb2.update(0.6, day); } catch (e) { threw = e; }
  check(!threw && amb2.alive() === 0, 'no audio context yet (no click so far): nothing happens, nothing throws');
}
console.log(fails ? 'FAIL ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
