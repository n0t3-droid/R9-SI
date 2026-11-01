// e-music · the adaptive score (src/main/score.js, scoresynth.js, audio.js): the themes as note data (bars whole, every
// note in its key, deterministic per day), the director's rules (context → cue, stings, the fight, the boss's phases, the
// freeing moment, 'Ruhige Musik'), the scheduler (never two cues at once, quiet ≥ 30 % of play time), the duck under
// dialogue, and audio.js playing it (the voice cap, Very Low without the music's reverb, the Stimmen bus).
//   bash test/wt_run.sh score.js 300
require('./load_shared.js');
require('../src/main/klang.js');
require('../src/main/score.js');
require('../src/main/scoresynth.js');
require('../src/main/audio.js');
const S = VR.Score, K = VR.Klang;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };

// ---- 1. the themes: whole bars, the right length, every note in its key, the same each time
console.log('themes');
{
  let bad = [];
  for (const id in S.THEMES) {
    const th = S.THEMES[id], lines = [['chords', th.chords]].concat(th.layers.filter(l => l.kind === 'line').map(l => [l.id, l.notes]));
    for (const [name, txt] of lines) { const p = S.parseLine(txt); if (p.barBeats.length !== th.len || p.barBeats.some(b => Math.abs(b - 4) > 1e-6)) bad.push(id + '.' + name + ' ' + p.barBeats.join(',')); }
  }
  check(bad.length === 0, 'every line of every theme has ' + 'whole 4/4 bars, as many as the theme is long' + (bad.length ? ': ' + bad.join(' ') : ''));
  check(['home', 'space', 'adventure', 'wonder', 'funke'].every(id => S.THEMES[id]), 'five themes: Heimat, Weite, Aufbruch, Staunen, Funke');
  let outKey = 0, range = true, n = 0;
  for (const day of [0, 1, 5, 12, 13, 40]) {
    const plan = K.musicPlan(day);
    for (const id of ['home', 'space', 'adventure', 'wonder', 'funke', 'wander']) {
      const set = S.scaleOf(id, plan);
      for (const lv of [0, 1, 2]) for (const e of S.events(id, { plan, lv, variant: 'day' })) {
        n++; if (e.midi && !set.has(e.midi % 12)) outKey++;
        if (e.midi && (e.midi < 28 || e.midi > 100)) range = false;
        if (!(e.gain > 0 && e.gain <= 0.25 && e.dur > 0 && e.t >= 0)) range = false;
      }
    }
  }
  check(outKey === 0, 'every note of ' + n + ' (six days, all themes and levels) is in its key');
  check(range, 'notes within E1 … E7, gains in (0, 0.25], times and lengths sane');
  const a = JSON.stringify(S.events('home', { plan: K.musicPlan(12) })), b = JSON.stringify(S.events('home', { plan: K.musicPlan(12) })), c = JSON.stringify(S.events('home', { plan: K.musicPlan(13) }));
  check(a === b, 'the same day: the same notes');
  check(a !== c || K.musicPlan(12).root % 12 === K.musicPlan(13).root % 12, 'another day: another key');
  // the tunes are our own and distinct: no two themes share their first eight melodic steps
  const shape = (id) => { const ev = S.events(id, { plan: K.musicPlan(0) }).filter(e => e.layer === 'mel'); const s = []; for (let i = 1; i < ev.length && s.length < 8; i++) s.push(ev[i].midi - ev[i - 1].midi); return s.join(','); };
  const shapes = ['home', 'space', 'adventure', 'wonder', 'funke'].map(shape);
  check(new Set(shapes).size === 5, 'the five melodies differ in their first eight steps');
  const lens = ['home', 'space', 'adventure', 'wonder', 'funke'].map(id => S.cueLen(id, 'day'));
  console.log('    (lengths: ' + lens.map(x => x.toFixed(1) + ' s').join(' · ') + ')');
  check(lens[3] <= 10 && lens[4] <= 5 && lens[0] >= 18, 'the stings are short (Staunen ≤ 10 s, Funke ≤ 5 s), Heimat a full phrase (≥ 18 s)');
  const lv = (l) => S.events('adventure', { plan: K.musicPlan(0), lv: l });
  check(!lv(0).some(e => e.inst === 'kick') && lv(1).some(e => e.inst === 'kick') && lv(2).some(e => e.inst === 'clap') && !lv(1).some(e => e.inst === 'clap'), 'the adventure grows by level: drums from level 1, claps and the pad at 2');
  check(!S.events('adventure', { plan: K.musicPlan(0), lv: 2, calm: true }).some(e => e.inst === 'kick'), 'Ruhige Musik: no drums');
  check(S.events('space', { plan: K.musicPlan(0), lv: 1, lowEnd: true }).length < S.events('space', { plan: K.musicPlan(0), lv: 1 }).length, 'Very Low: the ornament layers are left out');
}

// ---- the simulation: a director on a timeline of contexts, stepped four times a second
const BASE = { night: 0, cave: false, building: false, danger: false, outpost: false, boss: 0, space: '', story: false, dialogue: false, hostile: false, festival: false };
function sim(seg, o) {
  const D = new S.Director(Object.assign({ seed: 7 }, o)); let t = 0; const acts = [];
  for (const [secs, ctx, ev] of seg) {
    const c = Object.assign({}, BASE, ctx);
    if (ev) D.event(ev, t, t + 4);
    for (let k = 0; k < secs * 4; k++) { const a = D.step(t, c); if (a) acts.push(Object.assign({ now: t }, a)); t += 0.25; }
  }
  return { D, acts, T: t };
}
const played = (D, T) => { let on = 0; for (const l of D.log) on += Math.min(l.t1, T) - l.t0; return on; };
const overlaps = (D) => { let n = 0; for (let i = 1; i < D.log.length; i++) if (D.log[i].t0 < D.log[i - 1].t1 - 1e-6) n++; return n; };

// ---- 2. the director's rules
console.log('director');
{
  let r = sim([[60, {}]]);
  check(r.D.log[0].id === 'home' && r.D.log[0].t0 < 0.5, 'a day begins with the Heimat theme at once');
  check(r.D.log.length >= 2 && r.D.log[1].id === 'wander' && r.D.log[1].t0 - r.D.log[0].t1 >= 12, 'then a quiet stretch (≥ 12 s) and the wander layer');
  r = sim([[40, { night: 1 }]]); check(r.D.log[0].variant === 'night', 'at night: the night telling (bells, slower)');
  r = sim([[40, { building: true }]]); check(r.D.log[0].variant === 'build', 'building: the calm build telling');
  r = sim([[40, { cave: true }]]); check(r.D.log[0].id === 'wander' && r.D.log[0].variant === 'cave', 'in a cave: the sparse wander layer');
  r = sim([[40, { space: 'cruise' }]]); check(r.D.log[0].id === 'space' && r.D.log[0].variant === 'cruise', 'in orbit / cruise: Weite');
  r = sim([[40, { space: 'map' }]]); check(r.D.log[0].id === 'space' && r.D.log[0].variant === 'map', 'the star map: Weite, softly');
  r = sim([[40, { story: true }]]); check(r.D.log[0].variant === 'story', 'a story scene: the Heimat theme on strings');
  r = sim([[40, { outpost: true }]]); check(r.D.log[0].id === 'adventure' && r.D.log[0].variant === 'tense' && r.D.log[0].t0 < 1, 'near an outpost: Aufbruch, tense (level 0, no drums)');
  r = sim([[40, { festival: true }]]); check(r.D.log.length === 0, 'a festival: the village band plays, the director is silent');
  // a fight in the middle of the theme: the theme fades within 2 s, the adventure starts right after
  r = sim([[5, {}], [30, { danger: true }]]);
  const fadeAct = r.acts.find(a => a.type === 'fade'), adv = r.D.log.find(l => l.id === 'adventure');
  check(fadeAct && fadeAct.now <= 5.01 && fadeAct.len <= 2, 'danger: the theme fades at once (in ' + (fadeAct ? fadeAct.len : '-') + ' s)');
  check(adv && adv.t0 - 5 <= 4 && adv.t0 >= r.D.log[0].t1 - 1e-6, 'the adventure follows within 4 s (' + (adv ? (adv.t0 - 5).toFixed(2) : '-') + ' s), after the fade');
  check(r.D.log.filter(l => l.id === 'adventure').length >= 2, 'the fight loops while it lasts');
  r = sim([[30, { danger: true }], [20, {}]]);
  const lastAdv = r.D.log.filter(l => l.id === 'adventure').pop();
  check(lastAdv.t1 <= 30 + 3.01, 'the fight over: the adventure fades within 3 s');
  // the boss's phases: each higher phase restarts it one level up
  r = sim([[20, { boss: 1 }], [20, { boss: 2 }], [20, { boss: 3 }]]);
  const vs = r.D.log.filter(l => l.id === 'adventure').map(l => l.variant);
  check(vs.includes('boss') && vs.includes('boss2') && vs.includes('boss3'), 'the boss: phase 1, 2, 3 each heard (' + [...new Set(vs)].join(' → ') + ')');
  const p2 = r.D.log.find(l => l.variant === 'boss2'); check(p2 && p2.t0 - 20 < 3, 'phase 2 comes in within 3 s of the phase change');
  check(r.acts.filter(a => a.type === 'start' && a.id === 'adventure').every(a => a.variant !== 'boss3' || a.lv === 2), 'phase 3: the full level');
  // stings
  r = sim([[10, {}], [10, {}, 'wonder']]);
  const w = r.D.log.find(l => l.id === 'wonder');
  check(w && w.t0 - 10 <= 1.61 && r.D.log[0].t1 <= 10 + 1.61, 'a vista: the theme fades and Staunen sounds on its beat (e-score2: within 1.6 s)');
  r = sim([[10, {}, 'wonder'], [50, {}, 'wonder'], [30, {}, 'wonder']]);
  check(r.D.log.filter(l => l.id === 'wonder').length === 2, 'Staunen at most once a minute');
  r = sim([[5, {}, 'funke'], [60, {}, 'funke']]); check(r.D.log.filter(l => l.id === 'funke').length === 1, 'Funke\'s motif at most every three minutes');
  r = sim([[5, { danger: true }], [10, { danger: true }, 'wonder']]); check(!r.D.log.some(l => l.id === 'wonder'), 'no sting in a fight');
  // the freeing moment: the swell is heard (the director waits), then the Heimat theme bright
  r = sim([[8, { outpost: true }], [20, {}, 'freeing']]);
  const hb = r.D.log.find(l => l.variant === 'bright');
  check(hb && hb.t0 >= 12 - 1e-6, 'the freeing: the director waits for the swell, then Heimat bright (at ' + (hb ? hb.t0.toFixed(1) : '-') + ' s)');
  // Ruhige Musik
  r = sim([[600, {}]], { calm: true }); const rc = sim([[600, {}]]);
  check(played(r.D, r.T) / r.T < played(rc.D, rc.T) / rc.T, 'Ruhige Musik: more quiet (' + (100 * played(r.D, r.T) / r.T).toFixed(0) + ' % played, normal ' + (100 * played(rc.D, rc.T) / rc.T).toFixed(0) + ' %)');
  r = sim([[3, {}, 'funke'], [20, { boss: 3 }]], { calm: true });
  check(!r.D.log.some(l => l.id === 'funke') && r.acts.filter(a => a.type === 'start').every(a => a.lv <= 1), 'Ruhige Musik: no Funke sting, the boss at level 1 at most');
}

// ---- 3. the scheduler over half an hour of play: never two cues at once, quiet ≥ 30 %
console.log('scheduler');
{
  const day = [[240, {}], [60, { building: true }], [20, { hostile: true }], [90, { danger: true }], [60, {}, 'wonder'], [120, { cave: true }], [180, { night: 1 }],
    [40, { dialogue: true }], [30, { story: true }], [120, { space: 'cruise' }], [30, { space: 'map' }], [120, { space: 'cruise' }], [60, { outpost: true }], [30, {}, 'freeing'],
    [90, { boss: 1 }], [60, { boss: 2 }], [40, { boss: 3 }], [200, {}, 'funke'], [210, { night: 0.8 }]];
  for (const seed of [1, 7, 99]) {
    const D = new S.Director({ seed }); let t = 0; const c = Object.assign({}, BASE);
    for (const [secs, ctx, ev] of day) { Object.assign(c, BASE, ctx); if (ev) D.event(ev, t, t + 4); for (let k = 0; k < secs * 4; k++) { D.step(t, c); t += 0.25; } }
    const q = 1 - played(D, t) / t;
    check(overlaps(D) === 0, 'seed ' + seed + ': ' + D.log.length + ' cues in ' + (t / 60).toFixed(0) + ' min, never two at once');
    check(q >= 0.3, 'seed ' + seed + ': quiet ' + (100 * q).toFixed(0) + ' % of the time (≥ 30 %)');
  }
  const r = sim([[1800, {}]]); const q = 1 - played(r.D, r.T) / r.T;
  check(q >= 0.3 && q <= 0.75, 'a calm half hour: quiet ' + (100 * q).toFixed(0) + ' % (≥ 30 %, and it still plays)');
}

// ---- 4. the duck
console.log('duck');
{
  const D = new S.Director({ seed: 3 }), c = Object.assign({}, BASE);
  D.step(0, c); check(D.duckT === 1, 'nothing going on: full level');
  c.dialogue = true; D.step(0.25, c); check(D.duckT <= 0.4, 'under dialogue (Funke, a villager): ducked to ' + D.duckT);
  c.dialogue = false; c.hostile = true; D.step(0.5, c); check(D.duckT <= 0.3, 'a lone hostile mob: the calm layers duck to ' + D.duckT);
  const D2 = new S.Director({ seed: 3 }); D2.step(0, Object.assign({}, BASE, { danger: true, hostile: true }));
  check(D2.duckT === 1, 'in a fight the adventure is not ducked by the mob');
}

// ---- 5. audio.js plays it (a stubbed AudioContext)
function makeCtx() {
  const ctx = { currentTime: 0, sampleRate: 48000, state: 'running', nodes: [], resume() {} };
  const param = (v) => { const p = { value: v }; const set = (x) => { p.value = x; }; p.setValueAtTime = set; p.linearRampToValueAtTime = set; p.exponentialRampToValueAtTime = set; p.setTargetAtTime = set; p.cancelScheduledValues = () => {}; return p; };
  const node = (kind, extra) => { const n = Object.assign({ kind, outs: [], connect(d) { this.outs.push(d); return d; }, disconnect(d) { this.outs = d ? this.outs.filter(x => x !== d) : []; }, start() {}, stop() {} }, extra); ctx.nodes.push(n); return n; };
  ctx.destination = node('destination', {});
  ctx.createBuffer = (ch, len, rate) => { const d = []; for (let c = 0; c < ch; c++) d.push(new Float32Array(len)); return { length: len, sampleRate: rate, numberOfChannels: ch, getChannelData: (c) => d[c] }; };
  ctx.createBufferSource = () => node('source', { buffer: null, playbackRate: param(1) });
  ctx.createGain = () => node('gain', { gain: param(1) });
  ctx.createBiquadFilter = () => node('filter', { type: 'lowpass', frequency: param(350), Q: param(1), gain: param(0) });
  ctx.createStereoPanner = () => node('panner', { pan: param(0) });
  ctx.createOscillator = () => node('osc', { type: 'sine', frequency: param(440), detune: param(0) });
  ctx.createConvolver = () => node('convolver', { buffer: null });
  ctx.createDelay = () => node('delay', { delayTime: param(0) });   // e-music2: the room, the chorus
  ctx.createDynamicsCompressor = () => node('comp', { threshold: param(-24), ratio: param(12), knee: param(30), attack: param(0.003), release: param(0.25) });
  return ctx;
}
const W15 = { getLight() { return (15 << 12) | 0xfff; }, getBlock() { return 0; } };
const MUS = { enabled: true, night: 0, cave: false, danger: false, space: false, festival: false, mobs: [], agents: [], day: 12 };
function run(a, ctx, secs, s, every) { let peak = 0; for (let t = 0; t < secs; t += 0.1) { ctx.currentTime += 0.1; a.updateMusic(0.1, s); if (every) every(t); peak = Math.max(peak, a.musVoices()); } return peak; }
console.log('audio');
{
  const ctx = makeCtx(), a = new VR.Audio(); a.init(ctx); a.listen([0, 66, 0], 0, W15, false);
  check(a.vox && a.musTalk, 'the buses: Stimmen (vox) and the dialogue duck (musTalk)');
  const peak = run(a, ctx, 60, MUS);
  check(a.score && a.score.log.length >= 1 && a.score.log[0].id === 'home', 'audio.js runs the director: the day opens with Heimat');
  check(a.noteCount > 40, 'notes scheduled on the audio clock (' + a.noteCount + ' in a minute)');
  check(peak <= a.musCap(), 'the music voices stay under the cap (peak ' + peak + ' ≤ ' + a.musCap() + ')');
  a.setVolumes({ voice: 0.3 }); check(Math.abs(a.vox.gain.value - 0.3) < 1e-9, 'the Stimmen volume sets the voice bus');
  run(a, ctx, 2, Object.assign({}, MUS, { dialogue: true })); check(a.musTalk.gain.value <= 0.4, 'dialogue ducks the music (' + a.musTalk.gain.value + ')');
  run(a, ctx, 2, MUS); check(a.musTalk.gain.value === 1, 'and lets it back');
  const n0 = a.noteCount; a.setVolumes({ music: 0 }); run(a, ctx, 20, MUS); check(a.noteCount === n0, 'music at 0: nothing scheduled');
  // Very Low: fewer voices, no reverb on the music
  const c2 = makeCtx(), b = new VR.Audio(); b.init(c2); b.setLowEnd(true); b.listen([0, 66, 0], 0, W15, false);
  const pk = run(b, c2, 60, MUS);
  check(b.musCap() <= 10 && pk <= b.musCap(), 'Very Low: at most ' + b.musCap() + ' music voices (peak ' + pk + ')');
  check(!b.musRev.outs.length, 'Very Low: the music sends nothing into the convolver');
  check(c2.nodes.filter(n => n.kind === 'osc').length < ctx.nodes.filter(n => n.kind === 'osc').length, 'Very Low: fewer oscillators for the same minute (' + c2.nodes.filter(n => n.kind === 'osc').length + ' vs ' + ctx.nodes.filter(n => n.kind === 'osc').length + ')');
  // calm switch
  const c3 = makeCtx(), d = new VR.Audio(); d.init(c3); d.setVolumes({ calm: true }); check(d.score.calm === true, 'the Ruhige Musik switch reaches the director');
  // a sting from the game
  const c4 = makeCtx(), e = new VR.Audio(); e.init(c4); e.listen([0, 66, 0], 0, W15, false); run(e, c4, 3, MUS);
  check(e.cue('wonder') === true, 'audio.cue(\'wonder\') queues the sting'); run(e, c4, 3, MUS);
  check(e.score.log.some(l => l.id === 'wonder'), 'and it plays');
  // no node per idle frame with the music off
  const c5 = makeCtx(), f = new VR.Audio(); f.init(c5); f.setVolumes({ music: 0 }); run(f, c5, 1, MUS); const k0 = c5.nodes.length; run(f, c5, 10, MUS);
  check(c5.nodes.length === k0, 'music off: idle frames create no node');
  const t0 = Date.now(), c6 = makeCtx(), h = new VR.Audio(); h.init(c6); h.listen([0, 66, 0], 0, W15, false);
  const t1 = process.hrtime.bigint(); for (let i = 0; i < 6000; i++) { c6.currentTime += 0.016; h.updateMusic(0.016, MUS); } const ms = Number(process.hrtime.bigint() - t1) / 1e6;
  console.log('    (' + (ms / 6000).toFixed(4) + ' ms per updateMusic frame with the music playing, node stub)');
  check(ms / 6000 < 0.2, 'updateMusic stays cheap per frame');
}

// ---- 6. e-music2: endings, B-sections, seeded variation, colours, the tiers
console.log('e-music2');
{
  const plan = K.musicPlan(12);
  // a synth stub: when does every note of a cue really end (its release included)?
  const ends = (evs, tier) => { const c = makeCtx(), d = c.createGain(); let last = 0, on = 0; for (const e of evs) { const r = VR.ScoreSynth.note(c, d, e, e.t, { tier: tier === undefined ? 3 : tier }); last = Math.max(last, r.end); on = Math.max(on, e.t); } return { last, on }; };
  let worst = 99, worstName = '', tonic = true;
  for (const [id, variant, lv] of [['home', 'day', 1], ['home', 'night', 0], ['home', 'story', 1], ['space', 'cruise', 1], ['space', 'map', 0], ['adventure', 'fight', 1], ['adventure', 'boss3', 2], ['adventure', 'tense', 0], ['wonder', 'day', 0], ['funke', 'day', 0], ['wander', 'day', 0], ['wander', 'cave', 0]]) {
    for (const seed of [0, 5, 77]) {
      const evs = S.events(id, { plan, lv, variant, seed }), r = ends(evs);
      const tail = r.last - r.on; if (tail < worst) { worst = tail; worstName = id + '/' + variant + '/' + seed; }
      if (id !== 'wonder' && id !== 'funke') {
        const k = id === 'wander' ? plan.root % 12 : S.keyOf(id, plan).root % 12;
        const ring = evs.filter(e => e.tail && e.midi), lowest = ring.reduce((m, e) => (!m || e.midi < m.midi ? e : m), null);   // the lowest ringing note: the bass, or the pad's root
        if (!lowest || lowest.midi % 12 !== k) tonic = false;
        const len = S.cueLen(id, variant, seed);
        if (Math.max(...evs.map(e => e.t)) > len) tonic = false;
      }
    }
  }
  check(worst >= 2.5, 'every ending rings ≥ 2.5 s after its last onset (shortest ' + worst.toFixed(2) + ' s: ' + worstName + ')');
  check(tonic, 'the outro lands the bass on the tonic, within the cue\'s length');
  check(S.OUTRO && ['home', 'space', 'adventure'].every(id => S.OUTRO[id] && S.parseLine(S.OUTRO[id].chords).beats === 4), 'a written outro bar for Heimat, Weite and Aufbruch');
  check(S.cueLen('wonder', 'day') <= 10 && S.cueLen('funke', 'day') <= 5, 'the stings keep their length (the tail rings past it)');
  // B-sections: whole bars, and the forms
  let badB = [];
  for (const id of ['home', 'space', 'adventure']) {
    const B = S.THEMES[id].B; if (!B) { badB.push(id + ' none'); continue; }
    for (const [name, txt] of [['chords', B.chords]].concat(Object.entries(B.lines || {}))) { const p = S.parseLine(txt); if (p.barBeats.length !== 8 || p.barBeats.some(b => Math.abs(b - 4) > 1e-6)) badB.push(id + '.B.' + name); }
  }
  check(badB.length === 0, 'B-sections for Heimat, Weite, Aufbruch: eight whole bars each line' + (badB.length ? ': ' + badB.join(' ') : ''));
  const forms = new Set(); for (let sd = 1; sd <= 40; sd++) forms.add(S.formOf('home', sd));
  check(forms.has('A') && [...forms].some(f => f.includes('B')) && S.formOf('home', 0) === 'A', 'the forms vary by seed (' + [...forms].join(' ') + '), no seed: the plain A');
  check(Math.abs(S.cueLen('home', 'day', 3) - (S.formOf('home', 3).length * 8 + 1) * 4 * 60 / 84) < 1e-6, 'a cue\'s length follows its form (+ the outro bar)');
  // variation stays in the key: 20 seeds × the colours
  let out = 0, n = 0, rng = true;
  for (const col of ['', 'moon', 'ocker', 'aqua', 'shore', 'dry', 'snow', 'exo:3300', 'exo:4500', 'exo:5600', 'exo:9000']) for (let sd = 1; sd <= 20; sd++) for (const id of ['home', 'space', 'adventure', 'wonder', 'funke']) {
    const set = S.scaleOf(id, plan, col);
    for (const e of S.events(id, { plan, lv: 2, variant: 'day', seed: sd * 131, colour: col })) { n++; if (e.midi && !set.has(e.midi % 12)) out++; if (e.midi && (e.midi < 28 || e.midi > 100)) rng = false; if (!(e.gain > 0 && e.gain <= 0.25)) rng = false; }
  }
  check(out === 0, 'seeded variation and every colour: all ' + n + ' notes in their key');
  check(rng, 'and within E1 … E7, gains sane');
  const plain = JSON.stringify(S.events('home', { plan })), v1 = JSON.stringify(S.events('home', { plan, seed: 9 })), v1b = JSON.stringify(S.events('home', { plan, seed: 9 }));
  check(plain !== v1 && v1 === v1b, 'a seed varies the theme, the same seed gives the same notes');
  // no exact 8-bar repeat within ten minutes of mixed play (the fight loops too)
  const sig = (evs, a, b) => evs.filter(e => e.t >= a - 1e-6 && e.t < b - 1e-6).map(e => [Math.round((e.t - a) * 100), e.midi, e.inst, Math.round(e.dur * 100)].join(':')).join(',');
  for (const seed of [1, 7, 99]) {
    const D = new S.Director({ seed }); let t = 0; const c = Object.assign({}, BASE);
    for (const [secs, ctx] of [[200, {}], [100, { danger: true }], [60, { night: 1 }], [90, { space: 'cruise' }], [150, {}]]) { Object.assign(c, BASE, ctx); for (let k = 0; k < secs * 4; k++) { D.step(t, c); t += 0.25; } }
    const seen = new Map(); let dup = 0, wins = 0;
    for (const l of D.log) {
      if (l.id === 'wonder' || l.id === 'funke') continue;
      const evs = S.events(l.id, { plan, lv: l.lv, variant: l.variant, seed: l.seed, colour: l.colour }), bar = l.id === 'wander' ? S.cueLen('wander', l.variant, l.seed) / 9 : 4 * 60 / (S.THEMES[l.id].bpm * ((S.VARIANTS[l.variant] || {}).bpm || 1));
      const len = l.t1 - l.t0;
      for (let b = 0; (b + 8) * bar <= len + 1e-6; b += 8) { const s = l.id + '|' + sig(evs, b * bar, (b + 8) * bar); wins++; if (seen.has(s)) dup++; else seen.set(s, 1); }
    }
    check(dup === 0 && wins >= 10, 'seed ' + seed + ': ' + wins + ' eight-bar windows in ' + (t / 60).toFixed(0) + ' min, no exact repeat (' + dup + ')');
  }
  // the colours
  check(S.colourOf({ body: 'basalt' }) === 'moon' && S.colourOf({ body: 'opal' }) === 'moon' && S.colourOf({ body: 'ocker' }) === 'ocker' && S.colourOf({ body: 'aqua' }) === 'aqua', 'the moons glassy, Ocker dusty, Aquamarin watery');
  check(S.colourOf({ starT: 3300 }) === 'exo:3300' && S.keyOf('home', plan, 'exo:3300').mode === 'aeolian' && S.keyOf('home', plan, 'exo:9000').mode === 'lydian' && S.keyOf('home', plan, 'exo:5600').mode === 'mixolydian', 'an exo world: the star\'s colour picks the mode (red aeolian, yellow mixolydian, blue lydian)');
  const moon = S.events('home', { plan, lv: 1, colour: 'moon' }), ock = S.events('home', { plan, lv: 1, colour: 'ocker' }), aq = S.events('home', { plan, lv: 0, colour: 'aqua' }), home0 = S.events('home', { plan, lv: 1 });
  const avg = (evs) => { const m = evs.filter(e => e.layer === 'mel'); return m.reduce((a, e) => a + e.midi, 0) / m.length; };
  check(moon.some(e => e.inst === 'glass') && !moon.some(e => e.inst === 'pluck' || e.inst === 'strings'), 'on a moon: glass voices, no plucks or bowed strings');
  check(avg(ock) <= avg(home0) - 6 && ock.some(e => e.inst === 'reed'), 'on Ocker: the tune an octave low on a reed');
  check(aq.some(e => e.inst === 'drop' && e.layer === 'drops'), 'on Aquamarin: watery arps (drops)');
  check(S.colourOf({ biome: { ocean: 1 } }) === 'shore' && S.colourOf({ biome: { temp: 2, down: 0 } }) === 'dry' && S.colourOf({ biome: { temp: 0, down: 0.5 } }) === 'snow' && S.colourOf({ biome: { temp: 0.8, down: 0.4 } }) === '', 'at home the biome: shore, dry, snow, else plain');
  // the director carries the colour and the seed into the cue
  { const D = new S.Director({ seed: 4 }); const a = D.step(0, Object.assign({}, BASE, { colour: 'moon' })); check(a && a.colour === 'moon' && a.seed > 0 && D.log[0].seed === a.seed, 'the director starts the cue with its colour and seed'); }
  // the tiers in audio.js
  const tierRun = (tier) => { const c = makeCtx(), a = new VR.Audio(); a.init(c); a.setTier(tier); a.listen([0, 66, 0], 0, W15, false); const pk = run(a, c, 40, MUS); return { a, c, pk, lfo: c.nodes.filter(n => n.kind === 'osc' && n.frequency.value < 20).length, delays: c.nodes.filter(n => n.kind === 'delay').length, osc: c.nodes.filter(n => n.kind === 'osc').length }; };
  const t3 = tierRun(3), t2 = tierRun(2), t1 = tierRun(1), t0 = tierRun(0);
  check(t3.lfo >= 1 && t2.lfo === 0 && t0.lfo === 0, 'vibrato: one shared LFO per cue on High only (' + t3.lfo + ' / ' + t2.lfo + ' / ' + t0.lfo + ')');
  check(t3.delays >= 5 && t2.delays >= 4 && t1.delays === 0 && t0.delays === 0, 'the room (four combs) on Balanced+, the chorus on High (delays ' + t3.delays + ' / ' + t2.delays + ' / ' + t1.delays + ' / ' + t0.delays + ')');
  check(t0.a.musCap() === 10 && t0.pk <= 10 && t3.pk <= t3.a.musCap(), 'Very Low keeps its cap of 10 (peak ' + t0.pk + '), High stays under ' + t3.a.musCap() + ' (peak ' + t3.pk + ')');
  check(VR.ScoreSynth.voicesOf('pad', true) === 1 && VR.ScoreSynth.voicesOf('strings', true) === 1 && VR.ScoreSynth.voicesOf('pad', false, 3) === 3, 'Very Low: one oscillator per pad/strings voice; High: a warm third');
  check(t0.osc < t1.osc && t1.osc <= t3.osc, 'oscillators for the same 40 s: Very Low ' + t0.osc + ' < Low ' + t1.osc + ' ≤ High ' + t3.osc);
  const g = makeCtx(), ga = new VR.Audio(); ga.init(g); ga.setTier(3); ga.listen([0, 66, 0], 0, W15, false); run(ga, g, 3, Object.assign({}, MUS, { colour: 'moon' }));
  check(ga.roomOut && ga.roomOut.gain.value < 0.01, 'a moon: the room is dry (airless)');
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
