// e-score2 · the place-aware score (src/main/score2.js, score.js, audio.js, plan docs/superpowers/plans/2026-11-01-e-score2.md):
// the theme of a place, a time, the weather, the season and a festival; whole bars and every note in its key for the new
// themes; the season colours; the cross-fade by place and the rest cut short at a new place; a thunderstorm's silence;
// "Musik seltener"; the stingers on the beat grid (never two cues at once); the per-frame path allocates nothing; nothing
// when muted; Very Low fewer oscillators.
//   bash test/wt_run.sh score2.js 300
require('./load_shared.js');
require('../src/main/klang.js');
require('../src/main/score.js');
require('../src/main/scoresynth.js');
require('../src/main/score2.js');
require('../src/main/audio.js');
const v8 = require('v8'), vm = require('vm');
v8.setFlagsFromString('--expose-gc'); const gc = vm.runInNewContext('gc');
const S = VR.Score, K = VR.Klang;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const BASE = { night: 0, cave: false, building: false, danger: false, outpost: false, boss: 0, space: '', story: false, dialogue: false, hostile: false, festival: false };
const AW = Object.assign({}, BASE, { aware: true, place: '', people: '', season: 1, rain: false, snowing: false, storm: false, dusk: false, journey: '', festId: '' });
const NEW = ['meadow', 'lullaby', 'harbour', 'fairy', 'waltz', 'p_aqua', 'p_ocker', 'p_zinn', 'p_basalt', 'p_opal', 'bridge', 'ladder', 'd_bluete', 'd_drachen', 'd_tafel', 'd_lichter', 'glimpse', 'friend', 'welcome', 'freed'];

// ---- 1. the new themes: whole bars of their meter, every note in its key, sane ranges
console.log('themes');
{
  check(NEW.every(id => S.THEMES[id]), NEW.length + ' new themes (places, peoples, journeys, dances, stingers)');
  const bad = [];
  for (const id of NEW) {
    const th = S.THEMES[id]; if (!th) continue; const MB = th.meter || 4;
    const lines = [['chords', th.chords]].concat(th.layers.filter(l => l.kind === 'line').map(l => [l.id, l.notes]));
    if (th.B) { lines.push(['B.chords', th.B.chords]); for (const k in th.B.lines) lines.push(['B.' + k, th.B.lines[k]]); }
    for (const [name, txt] of lines) { const p = S.parseLine(txt); if (p.barBeats.length !== th.len || p.barBeats.some(b => Math.abs(b - MB) > 1e-6)) bad.push(id + '.' + name + ' ' + p.barBeats.join(',')); }
    for (const L of th.layers) if (L.kind === 'drum' && L.hits.length !== 2 * MB) bad.push(id + '.' + L.id + ' hits');
  }
  check(bad.length === 0, 'every line has whole bars of its meter (3/4 or 4/4)' + (bad.length ? ': ' + bad.join(' | ') : ''));
  let outKey = 0, range = true, n = 0, empty = [];
  for (const day of [0, 3, 12, 13, 40]) {
    const plan = K.musicPlan(day);
    for (const id of NEW) {
      if (!S.THEMES[id]) continue;
      const set = S.scaleOf(id, plan);
      for (const variant of ['day', 'night', 'dance', 'pdance', 'dusk', 'rain', 'snow']) for (const lv of [0, 1, 2]) for (const season of [-1, 0, 1, 2, 3]) for (const seed of [0, 5]) {
        const evs = S.events(id, { plan, lv, variant, season, seed });
        if (!evs.length) empty.push(id);
        for (const e of evs) {
          n++; if (e.midi && !set.has(e.midi % 12)) outKey++;
          if (e.midi && (e.midi < 28 || e.midi > 100)) range = false;
          if (!(e.gain > 0 && e.gain <= 0.25 && e.dur > 0 && e.t >= 0) || !VR.ScoreSynth.VOICES[e.inst]) { range = false; }
        }
      }
    }
  }
  check(!empty.length, 'every theme sounds at every level, variant and season');
  check(outKey === 0, 'every note of ' + n + ' is in its key (' + outKey + ' out)');
  check(range, 'notes within E1 … E7, gains in (0, 0.25], every instrument known to the synth');
  const waltz = S.events('waltz', { plan: K.musicPlan(12), lv: 1 });
  const B = 60 / S.THEMES.waltz.bpm, comp = waltz.filter(e => e.layer === 'comp');
  check(comp.length > 0 && comp.every(e => Math.abs(((e.t / B) % 3) - 1) < 1e-6 || Math.abs(((e.t / B) % 3) - 2) < 1e-6), 'the Mondstein waltz: its accompaniment on beats two and three (oom-pah-pah)');
  check(S.cueLen('waltz', 'day', 0) > 0 && Math.abs(S.cueLen('waltz', 'day', 0) - 8 * 3 * B) < 1e-6, 'a 3/4 cue is eight bars of three beats long');
  // the ringing ending belongs to the last section only: in a form AB no pad or bass is held across the sections
  let held = [];
  for (const id of ['harbour', 'waltz', 'd_drachen', 'd_lichter', 'meadow', 'fairy']) for (const seed of [1, 2, 3, 4, 5, 6]) {
    const th = S.THEMES[id], f = S.formOf(id, seed), B = 60 / th.bpm, sec = th.len * (th.meter || 4) * B;
    if (f.length < 2) continue;
    for (const e of S.events(id, { plan: K.musicPlan(12), lv: 1, seed })) if (e.dur > sec * 0.6 && e.t < sec * (f.length - 1)) held.push(id + ':' + f + ' ' + e.layer + '@' + e.t.toFixed(1));
  }
  check(held.length === 0, 'no pad or bass held from one section to the end of the form' + (held.length ? ': ' + held.slice(0, 4).join(' ') : ''));
  const own = S.events('p_basalt', { plan: K.musicPlan(12), lv: 1, colour: 'moon' });
  check(own.some(e => e.inst === 'hum') && !own.some(e => e.inst === 'glass'), 'a people\'s own theme keeps its instruments on its world (Regoli: the hums, no moon glass)');
}

// ---- 2. the seasons colour the arrangement
console.log('seasons');
{
  const plan = K.musicPlan(12), inst = (season) => new Set(S.events('home', { plan, lv: 1, season }).map(e => e.inst));
  check(!inst(-1).has('celesta') && inst(0).has('celesta'), 'spring: the bells become a celesta');
  check(inst(2).has('harp'), 'autumn: the plucks become a harp');
  check(inst(3).has('glass') && inst(3).has('glasspad'), 'winter: glass bells and glassy strings');
  const n1 = S.events('meadow', { plan, lv: 0, season: 1 }).length, n0 = S.events('meadow', { plan, lv: 0, season: -1 }).length;
  check(n1 > n0, 'summer: fuller (' + n1 + ' notes vs ' + n0 + ')');
  const wv = new Set(S.events('wander', { plan, variant: 'day', seed: 3, season: 3 }).map(e => e.inst));
  check(wv.has('celesta'), 'the wander layer takes the season too (winter: celesta)');
}

// ---- 3. the theme of a place, a time, the weather, a festival
console.log('selection');
{
  const want = (c, rot) => { const D = new S.Director({ seed: 3 }); D.rot = rot | 0; return D.want(Object.assign({}, AW, c)); };
  const T = [
    [{}, 0, 'home', 'day'], [{}, 2, 'meadow', 'day'], [{}, 1, 'wander', 'day'],
    [{ night: 1 }, 0, 'lullaby', 'night'], [{ night: 1 }, 2, 'home', 'night'],
    [{ dusk: true }, 0, 'home', 'dusk'], [{ rain: true }, 2, 'meadow', 'rain'], [{ snowing: true }, 0, 'home', 'snow'],
    [{ place: 'harbour' }, 0, 'harbour', 'day'], [{ place: 'fairy' }, 0, 'fairy', 'day'], [{ place: 'circle', night: 1 }, 0, 'waltz', 'night'],
    [{ people: 'aqua' }, 0, 'p_aqua', 'day'], [{ people: 'ocker' }, 0, 'p_ocker', 'day'], [{ people: 'zinn' }, 0, 'p_zinn', 'day'],
    [{ people: 'basalt' }, 0, 'p_basalt', 'day'], [{ people: 'opal' }, 0, 'p_opal', 'day'],
    [{ journey: 'lift', space: 'cruise' }, 0, 'ladder', 'day'], [{ journey: 'bridge' }, 0, 'bridge', 'day'],
    [{ festival: true, festId: 'bluete' }, 0, 'd_bluete', 'dance'], [{ festival: true, festId: 'drachen' }, 0, 'd_drachen', 'dance'],
    [{ festival: true, festId: 'tafel' }, 0, 'd_tafel', 'dance'], [{ festival: true, festId: 'lichter' }, 0, 'd_lichter', 'dance'],
    [{ festival: true, festId: 'gezeiten' }, 0, 'p_aqua', 'pdance'], [{ festival: true, festId: 'steinglut' }, 0, 'p_basalt', 'pdance'],
    [{ festival: true, festId: '', season: 3 }, 0, 'd_lichter', 'dance'], [{ festival: true, festId: '', season: 0 }, 0, 'd_bluete', 'dance'],
    [{ storm: true }, 0, 'none', undefined], [{ danger: true, place: 'harbour' }, 0, 'adventure', 'fight'], [{ cave: true, place: 'fairy' }, 0, 'wander', 'cave'],
    [{ space: 'map' }, 0, 'space', 'map'], [{ outpost: true }, 0, 'adventure', 'tense'],
  ];
  const bad = [];
  for (const [c, rot, id, variant] of T) { const w = want(c, rot); if (w.id !== id || (variant !== undefined && w.variant !== variant)) bad.push(JSON.stringify(c) + '@' + rot + ' → ' + w.id + ':' + w.variant + ' (want ' + id + ':' + variant + ')'); }
  check(bad.length === 0, T.length + ' contexts pick their theme' + (bad.length ? ': ' + bad.join(' | ') : ''));
  const old = new S.Director({ seed: 3 }).want(Object.assign({}, BASE));
  check(old.id === 'home' && old.pk === undefined, 'without the place context (old callers, the tests of e-music): the old rules');
  check(want({ place: 'harbour' }).pk === 'harbour' && want({ people: 'aqua' }).pk === 'p:aqua' && want({}).pk === 'home', 'each place has its key (the cross-fade compares it)');
}

// ---- 4. the director over time: cross-fade by place, the rest cut at a new place, the storm, festivals loop, less often
console.log('director');
function sim(seg, o) {
  const D = new S.Director(Object.assign({ seed: 7 }, o)); let t = 0; const acts = [];
  for (const [secs, ctx, ev] of seg) {
    const c = Object.assign({}, AW, ctx);
    if (ev) D.event(ev, t, t + 4);
    for (let k = 0; k < secs * 4; k++) { const a = D.step(t, c); if (a) acts.push(Object.assign({ now: t }, a)); t += 0.25; }
  }
  return { D, acts, T: t };
}
const played = (D, T) => { let on = 0; for (const l of D.log) on += Math.min(l.t1, T) - l.t0; return on; };
const overlaps = (D) => { let n = 0; for (let i = 1; i < D.log.length; i++) if (D.log[i].t0 < D.log[i - 1].t1 - 1e-6) n++; return n; };
{
  // the Heimat plays; at 10 s you walk into Palmenhafen: after 3 s held, the old cue fades, the harbour fades in
  let r = sim([[10, {}], [40, { place: 'harbour' }]]);
  const h = r.D.log.find(l => l.id === 'harbour'), f = r.acts.find(a => a.type === 'fade');
  check(r.D.log[0].id === 'home' && f && f.now >= 13 - 1e-6 && f.now <= 14 && f.len >= 3, 'a new place held 3 s: the old cue fades over ' + (f ? f.len : '-') + ' s (at ' + (f ? f.now : '-') + ' s)');
  const hs = r.acts.find(a => a.type === 'start' && a.id === 'harbour');
  check(h && h.t0 - r.D.log[0].t1 <= 1 && hs && hs.fadeIn >= 2, 'and the harbour theme fades in right after (gap ' + (h ? (h.t0 - r.D.log[0].t1).toFixed(2) : '-') + ' s, fade-in ' + (hs ? hs.fadeIn : '-') + ' s)');
  // a short visit (2 s) does not change the music
  r = sim([[10, {}], [2, { place: 'harbour' }], [10, {}]]);
  check(!r.acts.some(a => a.type === 'fade'), 'a place passed in 2 s: no change (the 3 s hold)');
  // a new place during a long rest: its theme within 4 s
  r = sim([[400, {}]]); const lastEnd = r.D.log[r.D.log.length - 1].t1;
  const t1 = r.T; const r2 = (() => { const D = r.D; let t = t1; const out = []; for (let k = 0; k < 40 * 4; k++) { const a = D.step(t, Object.assign({}, AW, { place: 'fairy' })); if (a && a.type === 'start') out.push(Object.assign({ now: t }, a)); t += 0.25; } return out; })();
  const fs = r2.find(a => a.id === 'fairy');
  check(fs && (fs.now - Math.max(t1, lastEnd)) <= 6.5, 'a fairy place reached during a rest: its theme within a few seconds (' + (fs ? (fs.now - Math.max(t1, lastEnd)).toFixed(1) : '-') + ' s)');
  // a thunderstorm: the music fades and rests while it lasts (the storm and the rain are heard)
  r = sim([[10, {}], [120, { storm: true }]]);
  check(r.D.log.length === 1 && r.D.log[0].t1 <= 17, 'a thunderstorm: the cue fades, no new one for two minutes');
  // a festival: the dance loops with a breath
  r = sim([[120, { festival: true, festId: 'drachen' }]]);
  const dn = r.D.log.filter(l => l.id === 'd_drachen');
  check(dn.length >= 2 && played(r.D, r.T) / r.T > 0.85 && overlaps(r.D) === 0, 'a festival: the summer dance loops (' + dn.length + ' rounds, ' + (100 * played(r.D, r.T) / r.T).toFixed(0) + ' % playing)');
  // "Musik seltener": less music in a half hour of mixed wandering
  const mix = [[300, {}], [200, { place: 'harbour' }], [300, { night: 1 }], [200, { people: 'aqua' }], [300, { place: 'fairy' }], [300, { dusk: true }], [200, {}]];
  const a = sim(mix), b = sim(mix, { less: true }), q = 1 - played(a.D, a.T) / a.T, ql = 1 - played(b.D, b.T) / b.T;
  check(q >= 0.3 && ql > q + 0.12, 'quiet ' + (100 * q).toFixed(0) + ' % normally, ' + (100 * ql).toFixed(0) + ' % with Musik seltener');
  check(overlaps(a.D) === 0 && overlaps(b.D) === 0, 'never two cues at once (' + a.D.log.length + ' and ' + b.D.log.length + ' cues)');
  const ids = new Set(a.D.log.map(l => l.id));
  check(['home', 'meadow', 'harbour', 'lullaby', 'p_aqua', 'fairy', 'wander'].every(x => ids.has(x)), 'the wander through it hears ' + [...ids].join(', '));
  // the seasons reach the cue
  r = sim([[30, { season: 2 }]]); check(r.acts.find(x => x.type === 'start').season === 2, 'the season rides on the start action (events colour it)');
}

// ---- 5. the stingers land on the beat
console.log('stingers');
{
  let worst = 0, okGrid = 0, n = 0, maxWait = 0;
  for (const [id, sting, ctx] of [['home', 'glimpse', {}], ['harbour', 'friend', { place: 'harbour' }], ['waltz', 'welcome', { place: 'circle' }], ['p_aqua', 'glimpse', { people: 'aqua' }], ['meadow', 'friend', {}]]) {
    for (let k = 0; k < 6; k++) {
      const D = new S.Director({ seed: 11 + k }); D.rot = id === 'meadow' ? 2 : 0; let t = 0; const c = Object.assign({}, AW, ctx);
      for (; t < 3; t += 0.25) D.step(t, c);
      const cu = D.cue; if (!cu || cu.id !== id) { n++; continue; }
      const tev = 3 + 0.37 * k + 0.11; for (; t < tev; t += 0.25) D.step(t, c);
      D.event(sting, t, t + 4); const tE = t;
      let st = null; for (; t < tev + 6; t += 0.25) { const a = D.step(t, c); if (a && a.type === 'start' && a.sting) { st = a; break; } }
      n++; if (!st) continue;
      const beats = (st.at - cu.t0) / cu.B; const off = Math.abs(beats - Math.round(beats)) * cu.B; worst = Math.max(worst, off);
      if (off < 1e-6 && st.at >= tE + 0.25 - 1e-6) okGrid++; maxWait = Math.max(maxWait, st.at - tE);
      const prev = D.log[D.log.length - 2]; if (prev && prev.t1 > st.at + 1e-6) okGrid--;
    }
  }
  check(okGrid === n, okGrid + ' / ' + n + ' stingers start exactly on the running cue\'s beat grid, after the old cue ends (worst ' + worst.toExponential(1) + ' s)');
  check(maxWait <= 3.4, 'and soon (the longest wait ' + maxWait.toFixed(2) + ' s: the next bar if near, else the next beat)');
  const D = new S.Director({ seed: 2 }); for (let t = 0; t < 2; t += 0.25) D.step(t, AW);
  check(D.event('friend', 2, 6) && !D.event('friend', 20, 24), 'a Flausel friend: at most once in a while (GAP)');
  const D2 = new S.Director({ seed: 2, calm: true }); check(D2.event('glimpse', 0, 4), 'Ruhige Musik keeps the soft stingers');
  // the freeing: the swell, then the 'freed' stinger, then Heimat bright
  const r = sim([[8, { outpost: true }], [40, {}, 'freeing']]);
  const fr = r.D.log.find(l => l.id === 'freed'), hb = r.D.log.find(l => l.id === 'home' && l.variant === 'bright');
  check(fr && fr.t0 >= 12 - 1e-6 && hb && hb.t0 > fr.t0, 'the outpost freed: after the swell the freed stinger (' + (fr ? fr.t0.toFixed(1) : '-') + ' s), then Heimat bright (' + (hb ? hb.t0.toFixed(1) : '-') + ' s)');
}

// ---- 6. audio.js: the dances replace the old band, nothing per frame, nothing when muted, Very Low cheaper
function makeCtx(keep) {
  const ctx = { currentTime: 0, sampleRate: 48000, state: 'running', nodes: [], n: 0, osc: 0, resume() {} };
  const param = (v) => { const p = { value: v }; const set = (x) => { p.value = x; }; p.setValueAtTime = set; p.linearRampToValueAtTime = set; p.exponentialRampToValueAtTime = set; p.setTargetAtTime = set; p.cancelScheduledValues = () => {}; return p; };
  const node = (kind, extra) => { const n = Object.assign({ kind, outs: [], connect(d) { this.outs.push(d); return d; }, disconnect(d) { this.outs = d ? this.outs.filter(x => x !== d) : []; }, start() {}, stop() {} }, extra); ctx.n++; if (kind === 'osc') ctx.osc++; if (keep !== false) ctx.nodes.push(n); return n; };
  ctx.destination = node('destination', {});
  ctx.createBuffer = (ch, len, rate) => { const d = []; for (let c = 0; c < ch; c++) d.push(new Float32Array(len)); return { length: len, sampleRate: rate, numberOfChannels: ch, getChannelData: (c) => d[c] }; };
  ctx.createBufferSource = () => node('source', { buffer: null, playbackRate: param(1) });
  ctx.createGain = () => node('gain', { gain: param(1) });
  ctx.createBiquadFilter = () => node('filter', { type: 'lowpass', frequency: param(350), Q: param(1), gain: param(0) });
  ctx.createStereoPanner = () => node('panner', { pan: param(0) });
  ctx.createOscillator = () => node('osc', { type: 'sine', frequency: param(440), detune: param(0) });
  ctx.createConvolver = () => node('convolver', { buffer: null });
  ctx.createDelay = () => node('delay', { delayTime: param(0) });
  ctx.createDynamicsCompressor = () => node('comp', { threshold: param(-24), ratio: param(12), knee: param(30), attack: param(0.003), release: param(0.25) });
  return ctx;
}
const W15 = { getLight() { return (15 << 12) | 0xfff; }, getBlock() { return 0; } };
const MUS = { enabled: true, night: 0, cave: false, danger: false, space: false, festival: false, mobs: [], agents: [], day: 12, aware: true, season: 1, place: '', people: '', festId: '', journey: '' };
function run(a, ctx, secs, s, dt) { dt = dt || 0.1; for (let t = 0; t < secs; t += dt) { ctx.currentTime += dt; a.updateMusic(dt, s); } }
console.log('audio');
{
  const c = makeCtx(), a = new VR.Audio(); a.init(c); a.listen([0, 66, 0], 0, W15, false);
  let bandBefore = 0; const fb = a.festivalBar; a.festivalBar = function (now) { bandBefore++; return fb.call(this, now); };
  run(a, c, 30, Object.assign({}, MUS, { festival: true, festId: 'tafel' }));
  check(a.score.log.some(l => l.id === 'd_tafel') && bandBefore === 0, 'a festival: the director plays the autumn dance (the old band silent)');
  const p = Object.assign({}, MUS, { place: 'harbour' }); run(a, c, 60, p);
  check(a.score.log.some(l => l.id === 'harbour'), 'audio.js passes the place on: Palmenhafen\'s theme plays');
  check(a.ambLift && a.ambLift.gain.value >= 1, 'the ambience lift exists (the nature sounds between phrases)');
  // nothing allocated per frame: 100 000 frames with the music playing and no note due, the scan held off
  const c2 = makeCtx(false), b = new VR.Audio(); b.init(c2); b.listen([0, 66, 0], 0, W15, false);
  run(b, c2, 2, MUS, 0.016);
  if (b.run) { b.run.t0 = c2.currentTime + 1e6; b.run.stopAt = c2.currentTime + 2e6; }
  b.music.scan = 1e9; gc(); const h0 = process.memoryUsage().heapUsed;
  for (let i = 0; i < 100000; i++) { c2.currentTime += 0.016; b.updateMusic(0.016, MUS); }
  gc(); const dh = process.memoryUsage().heapUsed - h0;
  check(!!b.run && dh < 64 * 1024, 'the per-frame path allocates nothing (' + (dh / 1024).toFixed(1) + ' KB over 100 000 frames)');
  // with the scans (four a second) and notes due: the heap per scan stays small
  const c3 = makeCtx(false), d = new VR.Audio(); d.init(c3); d.listen([0, 66, 0], 0, W15, false); run(d, c3, 5, MUS, 0.016);
  gc(); const h1 = process.memoryUsage().heapUsed, n1 = c3.n; let fr = 0;
  for (let i = 0; i < 20000; i++) { c3.currentTime += 0.016; d.updateMusic(0.016, MUS); fr++; }
  gc(); const dh2 = process.memoryUsage().heapUsed - h1;
  console.log('    (320 s of play: ' + (c3.n - n1) + ' audio nodes made by the notes, heap ' + (dh2 / 1024).toFixed(0) + ' KB retained)');
  check(dh2 < 512 * 1024, 'scans and notes leave no growing garbage (' + (dh2 / 1024).toFixed(0) + ' KB retained after 320 s)');
  // muted: no node, almost no time
  const c4 = makeCtx(), e = new VR.Audio(); e.init(c4); e.listen([0, 66, 0], 0, W15, false); run(e, c4, 5, MUS);
  e.setVolumes({ music: 0 }); const k0 = c4.n; const t0 = process.hrtime.bigint(); run(e, c4, 60, MUS, 0.016); const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  check(c4.n === k0 && e.run === null, 'muted: the cue stops, no node made in a minute');
  check(ms / 3750 < 0.01, 'muted: ' + (ms / 3750 * 1000).toFixed(2) + ' µs a frame (an early return)');
  // Very Low: fewer oscillators for the same five minutes of places
  const tour = [['harbour', ''], ['fairy', ''], ['', 'aqua'], ['circle', ''], ['', '']];
  const osc = (tier) => { const cx = makeCtx(false), x = new VR.Audio(); x.setTier(tier); x.init(cx); x.listen([0, 66, 0], 0, W15, false); let pk = 0; for (const [pl, pe] of tour) { const s = Object.assign({}, MUS, { place: pl, people: pe }); for (let t = 0; t < 60; t += 0.1) { cx.currentTime += 0.1; x.updateMusic(0.1, s); pk = Math.max(pk, x.musVoices()); } } return { osc: cx.osc, pk, cap: x.musCap() }; };
  const vl = osc(0), hi = osc(3);
  console.log('    (five minutes of places: Very Low ' + vl.osc + ' oscillators, peak ' + vl.pk + ' voices · High ' + hi.osc + ', peak ' + hi.pk + ')');
  check(vl.osc < hi.osc * 0.6 && vl.pk <= vl.cap && hi.pk <= hi.cap, 'Very Low: fewer voices (' + vl.osc + ' vs ' + hi.osc + ' oscillators), every tier under its cap');
  // the setting: Musik seltener reaches the director
  const f = new VR.Audio(); f.init(makeCtx()); f.setVolumes({ less: true }); check(f.score.less === true, 'the „Musik seltener" switch reaches the director');
}

// ---- 7. the place context read from a game (stubs)
console.log('gather');
{
  const g = {
    dim: 'overworld', meta: { vgen: 20, type: 'default' }, env: { timeOfDay: 11500, rain: 0.6, snow: 0, thunder: 0, day: 4 },
    player: { pos: [10, 70, -150] }, world: null, entities: { mobs: [] },
  };
  VR.Seasons = VR.Seasons || { on: () => true, cur: { idx: 2 } };
  let x = S.gather(g, { night: 0 });
  check(x.aware && x.place === 'harbour' && x.dusk && x.rain && x.season === 2, 'Palmenhafen at the golden hour, rain, autumn: ' + JSON.stringify({ place: x.place, dusk: x.dusk, rain: x.rain, season: x.season }));
  g.player.pos = [400, 70, 400]; VR.Fairy = { state: { near: { kind: 'circle' }, nearD: 30 } };
  x = S.gather(g, { night: 1 }); check(x.place === 'circle', 'near the Mondsteinkreis: ' + x.place);
  VR.Fairy.state.near = { kind: 'shroom' }; x = S.gather(g, {}); check(x.place === 'fairy', 'near a fairy place: ' + x.place);
  VR.Fairy.state.nearD = 120; x = S.gather(g, {}); check(x.place === '', 'far from it: nothing');
  g.env.thunder = 1; x = S.gather(g, {}); check(x.storm === true, 'a thunderstorm read');
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
