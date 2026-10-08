// Klang (F4): the synthesized sound. Material families (every block has one), footsteps and hits by family with bounded
// pitch and timbre variation, the UI voices (≤ 60 ms, −18 dB), positional voices (pan and distance, silent past 48
// blocks), occlusion by the light field, the room send (indoors and caves only), the underwater lowpass, the generative
// pentatonic music (seeded by the day, ducked by a hostile mob, a village tick, silent at volume 0), the node budget and
// no allocation per frame. Node only, with a stubbed AudioContext.
//   bash test/wt_run.sh klang.js 300
require('./load_shared.js');
require('../src/main/klang.js');
require('../src/main/audio.js');
const R = VR.R, K = VR.Klang;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };

// ---- a stubbed Web Audio context: every node is recorded; parameters keep their last value and their peak
function makeCtx() {
  const ctx = { sampleRate: 44100, currentTime: 0, state: 'running', nodes: [] };
  const param = (v) => {
    const p = { value: v, peak: -Infinity };
    const set = (x) => { p.value = x; if (x > p.peak) p.peak = x; };
    p.setValueAtTime = set; p.linearRampToValueAtTime = set; p.exponentialRampToValueAtTime = set; p.setTargetAtTime = set; p.cancelScheduledValues = () => {};
    return p;
  };
  const node = (kind, extra) => {
    const n = Object.assign({ kind, outs: [], startAt: -1, stopAt: -1, connect(d) { this.outs.push(d); return d; }, disconnect() {}, start(t) { this.startAt = t === undefined ? ctx.currentTime : t; }, stop(t) { this.stopAt = t === undefined ? ctx.currentTime : t; } }, extra);
    ctx.nodes.push(n); return n;
  };
  ctx.destination = node('destination', {});
  ctx.createBuffer = (ch, len, rate) => { const d = []; for (let c = 0; c < ch; c++) d.push(new Float32Array(len)); return { length: len, sampleRate: rate, numberOfChannels: ch, duration: len / rate, getChannelData: (c) => d[c] }; };
  ctx.createBufferSource = () => node('source', { buffer: null, loop: false, playbackRate: param(1) });
  ctx.createGain = () => node('gain', { gain: param(1) });
  ctx.createBiquadFilter = () => node('filter', { type: 'lowpass', frequency: param(350), Q: param(1), gain: param(0) });
  ctx.createStereoPanner = () => node('panner', { pan: param(0) });
  ctx.createOscillator = () => node('osc', { type: 'sine', frequency: param(440), detune: param(0) });
  ctx.createConvolver = () => node('convolver', { buffer: null });
  ctx.createDynamicsCompressor = () => node('comp', { threshold: param(-24), ratio: param(12), knee: param(30), attack: param(0.003), release: param(0.25) });
  return ctx;
}
// a world whose light is the same everywhere (sky light s), or a function of the cell
const world = (sky) => ({ getLight(x, y, z) { const s = typeof sky === 'function' ? sky(x, y, z) : sky; return (s << 12) | (15 << 8) | (15 << 4) | 15; }, getBlock() { return 0; }, topAt() { return 64; } });
const newAudio = () => { const ctx = makeCtx(), a = new VR.Audio(); a.init(ctx); return { ctx, a }; };
// music runs on the audio clock: advance it in steps and let the scheduler look
const runMusic = (a, ctx, secs, s) => { for (let t = 0; t < secs; t += 0.1) { ctx.currentTime += 0.1; a.updateMusic(0.1, s); } };
const stateNamed = (name) => { const t = R.byName[name]; if (!t) throw new Error('no block ' + name); return t.defaultState; };
const stateWithSound = (snd) => { const t = R.types.find(x => x && x.o && x.o.sound === snd && !(x.o.kind === 'fluid')); return t ? t.defaultState : 0; };
const MUSIC_S = { enabled: true, night: 0, cave: false, danger: false, space: false, festival: false, mobs: [], agents: [], day: 12 };

// ---- 1. families: 11 of them, each with a step and a hit recipe with sane numbers
console.log('families');
{
  const F = K.FAMILIES;
  check(Array.isArray(F) && F.length === 11 && new Set(F).size === 11, 'eleven distinct families: ' + F.join(' '));
  check(['grass', 'dirt', 'stone', 'wood', 'sand', 'snow', 'gravel', 'metal', 'carpet', 'water', 'glass'].every(f => F.includes(f)), 'the families are grass dirt stone wood sand snow gravel metal carpet water glass');
  let ok = true;
  for (const f of F) {
    const r = K.RECIPES[f];
    if (!r || !r.step || !r.hit) { ok = false; console.log('    no recipe for ' + f); continue; }
    for (const v of [r.step, r.hit]) if (!(v.f > 50 && v.f < 12000 && v.q > 0 && v.dur > 0 && v.dur <= 0.3 && v.g > 0 && v.g <= 1)) { ok = false; console.log('    bad recipe ' + f + ' ' + JSON.stringify(v)); }
  }
  check(ok, 'every family has a step and a hit recipe with a band in 50–12000 Hz, a duration ≤ 0.3 s and a gain in (0, 1]');
  const hitOf = { wood: 'thock', stone: 'clack', glass: 'tink', dirt: 'thud', metal: 'ding' };
  check(Object.keys(hitOf).every(f => K.HIT[f] === hitOf[f]) && F.every(f => typeof K.HIT[f] === 'string'), 'place and break: wood thock, stone clack, glass tink, dirt thud, metal ding; every family has a hit voice');
}

// ---- 2. the mapping: every block type of the registry has a family (the name first, then the sound key)
console.log('mapping');
{
  const used = {}; let missing = 0, total = 0;
  for (const t of R.types) {
    if (!t || !t.o || !t.name) continue;
    total++;
    const f = K.familyOf(t.name, t.o.sound);
    if (!K.FAMILIES.includes(f)) { missing++; if (missing < 5) console.log('    no family: ' + t.name + ' (' + t.o.sound + ')'); }
    used[f] = (used[f] || 0) + 1;
  }
  check(missing === 0, 'every registry block type has a family (' + total + ' types)');
  check(K.FAMILIES.every(f => used[f] > 0), 'every family is used by some block (' + K.FAMILIES.map(f => f + ' ' + (used[f] || 0)).join(', ') + ')');
  const want = [['oak_planks', 'wood', 'wood'], ['dirt', 'gravel', 'dirt'], ['grass_block', 'grass', 'grass'], ['sand', 'sand', 'sand'], ['snow', 'snow', 'snow'], ['gravel', 'gravel', 'gravel'], ['iron_block', 'metal', 'metal'], ['white_wool', 'wool', 'carpet'], ['water', 'water', 'water'], ['stone', 'stone', 'stone'], ['glass', 'glass', 'glass']];
  const bad = want.filter(([n, s, f]) => K.familyOf(n, s) !== f);
  check(bad.length === 0, 'the named cases: dirt is dirt though its sound is gravel, wool is carpet, iron is metal' + (bad.length ? ' — wrong: ' + JSON.stringify(bad) : ''));
  check(K.familyOf('mystery_block', 'unheard_of') === 'stone' && K.familyOf(undefined, undefined) === 'stone', 'an unknown block falls back to stone, never to nothing');
}

// ---- 3. bounded variation: pitch within ±6 %, timbre two-valued, steps louder when sprinting and quieter crouched
console.log('variation');
{
  let lo = 9, hi = 0, sum = 0; const N = 4000;
  for (let i = 0; i < N; i++) { const p = K.pitchFactor(i / N); lo = Math.min(lo, p); hi = Math.max(hi, p); sum += p; }
  check(lo >= 0.94 && hi <= 1.06, 'pitch factor stays within ±6 % (' + lo.toFixed(3) + ' … ' + hi.toFixed(3) + ')');
  check(Math.abs(sum / N - 1) < 0.005, 'pitch factor averages to 1 (' + (sum / N).toFixed(4) + ')');
  const tv = new Set(); for (let i = 0; i < 100; i++) tv.add(K.timbre(i / 100));
  check(tv.size === 2 && tv.has(0) && tv.has(1), 'two timbre variants (heel and toe)');
  const walk = K.stepGain(4.3, false, false), sprint = K.stepGain(5.6, false, true), crouch = K.stepGain(1.3, true, false);
  check(sprint > walk && crouch < 0.5 * walk && crouch > 0.1, 'sprint is louder than a walk, a crouch is under half a walk (walk ' + walk.toFixed(2) + ', sprint ' + sprint.toFixed(2) + ', crouch ' + crouch.toFixed(2) + ')');
  let gMin = 9, gMax = 0; for (let s = 0; s <= 12; s += 0.5) { const g = K.stepGain(s, false, false); gMin = Math.min(gMin, g); gMax = Math.max(gMax, g); }
  check(gMin > 0.1 && gMax <= 1.5, 'speed changes the gain within bounds (' + gMin.toFixed(2) + ' … ' + gMax.toFixed(2) + ')');
}

// ---- 4. the UI voices: tiny, ≤ 60 ms, −18 dB
console.log('ui');
{
  const names = ['click', 'pling', 'bonk', 'rustle'];
  check(names.every(n => K.UI[n]), 'the UI voices click, pling, bonk and rustle exist');
  check(names.every(n => K.UI[n].dur <= 0.06 && K.UI[n].peak <= 0.1259 && K.UI[n].peak >= 0.12), 'each lasts ≤ 60 ms and peaks at −18 dB (0.126)');
  const { ctx, a } = newAudio();
  const before = ctx.nodes.length;
  a.play('click'); a.play('pling'); a.play('bonk'); a.play('rustle');
  const fresh = ctx.nodes.slice(before);
  const longest = Math.max(...fresh.filter(n => n.stopAt >= 0 && n.startAt >= 0).map(n => n.stopAt - n.startAt));
  const peak = Math.max(...fresh.filter(n => n.kind === 'gain').map(n => n.gain.peak));
  check(fresh.length > 0 && longest <= 0.07, 'the four UI voices end within 70 ms (longest ' + (longest * 1000).toFixed(0) + ' ms)');
  check(peak <= 0.1305, 'and no UI voice peaks above −18 dB (' + peak.toFixed(3) + ')');
  check(a.counts.click === 1 && a.counts.pling === 1 && a.counts.bonk === 1 && a.counts.rustle === 1, 'each UI voice is counted once');
}

// ---- 5. the graph: persistent nodes, footsteps and hits by family, the node budget per event
console.log('graph');
{
  const ctx0 = makeCtx(), a0 = new VR.Audio(); const b0 = ctx0.nodes.length; a0.init(ctx0);
  const persistent = ctx0.nodes.length - b0;
  check(persistent <= 40, 'the persistent graph is at most 40 nodes (' + persistent + ' built)');
  check(a0.sfx && a0.room && a0.rev && a0.musDuck && a0.sfxMuffle, 'the buses exist: sfx, room send, convolver, music duck, sfx lowpass');
  const { ctx, a } = newAudio();
  const n0 = ctx.nodes.length;
  a.step(stateNamed('stone'), { speed: 4.3 });
  const stepNodes = ctx.nodes.length - n0;
  check(stepNodes <= 8 && a.counts['step:stone'] === 1, 'a footstep on stone is one family voice with ' + stepNodes + ' nodes (≤ 8)');
  const n1 = ctx.nodes.length;
  a.step(stateNamed('dirt'), { speed: 2, crouch: true });
  check(a.counts['step:dirt'] === 1 && ctx.nodes.length - n1 <= 8, 'a crouched step on dirt (the name beats the gravel sound) is one voice');
  const h0 = ctx.nodes.length;
  a.place(stateNamed('oak_planks')); a.place(stateNamed('stone')); a.place(stateNamed('glass')); a.place(stateNamed('dirt')); a.place(stateNamed('iron_block'));
  check(a.counts['hit:wood'] === 1 && a.counts['hit:stone'] === 1 && a.counts['hit:glass'] === 1 && a.counts['hit:dirt'] === 1 && a.counts['hit:metal'] === 1, 'place: wood thock, stone clack, glass tink, dirt thud, iron ding');
  check((ctx.nodes.length - h0) / 5 <= 10, 'a hit is at most 10 nodes (' + ((ctx.nodes.length - h0) / 5).toFixed(1) + ' on average)');
  a.dig(stateNamed('oak_planks'), false); a.dig(stateNamed('stone'), false);
  check(a.counts['crackle:wood'] === 1 && a.counts['crackle:stone'] === 1, 'breaking progress crackles by family');
  a.dig(stateNamed('stone'), true);
  check(a.counts['break:stone'] === 1, 'the last hit is a break by family, with its pop');
  const sn = stateWithSound('snow'), gr = stateNamed('gravel'), wa = stateNamed('water');
  a.step(sn, { speed: 3 }); a.step(gr, { speed: 3 }); a.step(wa, { speed: 3 }); a.step(stateNamed('white_wool'), { speed: 3 }); a.step(stateNamed('sand'), { speed: 3 }); a.step(stateNamed('iron_block'), { speed: 3 }); a.step(stateNamed('grass_block'), { speed: 3 });
  check(a.counts['step:snow'] === 1 && a.counts['step:gravel'] === 1 && a.counts['step:water'] === 1 && a.counts['step:carpet'] === 1 && a.counts['step:sand'] === 1 && a.counts['step:metal'] === 1 && a.counts['step:grass'] === 1, 'walking on snow, gravel, water, carpet, sand, metal and grass each has its family');
  for (let i = 0; i < 60; i++) { a.step(stateNamed('stone'), { speed: 4 }); a.play('hurt', { at: [3, 66, 0] }); }
  check(a.stats().voices <= 24, 'at most 24 world voices live at once (' + a.stats().voices + ')');
}

// ---- 6. positional voices: pan from the listener's facing, distance gain, silence past 48 blocks, occlusion
console.log('space');
{
  const { ctx, a } = newAudio();
  const W = world(15);
  a.listen([0.5, 66, 0.5], 0, W, false);                  // facing −z: +x is to the right
  const n0 = ctx.nodes.length;
  a.play('hurt', { at: [10.5, 66, 0.5] });
  const pr = ctx.nodes.slice(n0).find(n => n.kind === 'panner');
  check(pr && pr.pan.value > 0.5, 'a mob to the right is panned right (' + (pr ? pr.pan.value.toFixed(2) : 'no panner') + ')');
  const n1 = ctx.nodes.length;
  a.play('hurt', { at: [-10.5, 66, 0.5] });
  const pl = ctx.nodes.slice(n1).find(n => n.kind === 'panner');
  check(pl && pl.pan.value < -0.5, 'a villager to the left is panned left (' + (pl ? pl.pan.value.toFixed(2) : 'no panner') + ')');
  const n2 = ctx.nodes.length;
  a.play('door', { at: [60.5, 66, 0.5] });
  check(ctx.nodes.length === n2, 'a door 60 blocks away is silent (no nodes)');
  // occlusion: the source's cell is dark (a room behind a wall) while we stand in the open
  const dark = world((x) => (x < 0 ? 0 : 15));
  a.listen([0.5, 66, 0.5], 0, dark, false);
  const n3 = ctx.nodes.length;
  a.play('hurt', { at: [-6.5, 66, 0.5] });
  const occ = ctx.nodes.slice(n3).filter(n => n.kind === 'filter' && n.type === 'lowpass').map(n => n.frequency.value);
  check(occ.length && Math.max(...occ) <= 1500, 'a sound behind a wall is lowpassed by its place (the voice'+"'"+'s lowpasses: ' + occ.map(v => Math.round(v)).join(', ') + ' Hz)');
  const n4 = ctx.nodes.length;
  a.play('hurt', { at: [6.5, 66, 0.5] });
  const open = ctx.nodes.slice(n4).filter(n => n.kind === 'filter' && n.type === 'lowpass').map(n => n.frequency.value);
  check(open.length && Math.max(...open) >= 4000, 'a sound in the open is not lowpassed by its place (the voice'+"'"+'s lowpasses: ' + open.map(v => Math.round(v)).join(', ') + ' Hz)');
  // the room send: outdoors none, indoors yes, in a cave the longer impulse
  a.listen([0.5, 66, 0.5], 0, world(15), false);
  check(a.room.gain.value < 0.01, 'outdoors the room send is off (' + a.room.gain.value.toFixed(3) + ')');
  a.listen([0.5, 66, 0.5], 0, world(2), false);
  check(a.room.gain.value > 0.3 && a.room.gain.value <= 1, 'indoors the room send is on (' + a.room.gain.value.toFixed(2) + ')');
  check(a.state().indoors === true && a.state().cave === false, 'indoors, not a cave');
  a.listen([0.5, 30, 0.5], 0, world(1), false);
  ctx.currentTime += 0.2; a.listen([0.5, 30, 0.5], 0, world(1), false);
  check(a.state().cave === true && a.rev.buffer === a.irCave && a.irCave.length > a.irRoom.length, 'in a cave the convolver takes the longer impulse (' + a.irCave.length + ' against ' + a.irRoom.length + ' samples)');
  check(a.room.gain.value > 0.3, 'and the room send is back up after the swap');
  // underwater: the world's sound is lowpassed
  a.listen([0.5, 66, 0.5], 0, world(15), true);
  check(a.sfxMuffle.frequency.value <= 1000, 'under water the world sound is lowpassed at ' + Math.round(a.sfxMuffle.frequency.value) + ' Hz');
  a.listen([0.5, 66, 0.5], 0, world(15), false);
  check(a.sfxMuffle.frequency.value >= 15000, 'and open again on the surface');
}

// ---- 7. music: pentatonic, seeded by the day, ducked by a hostile mob, a tick in villages, off at volume 0
console.log('music');
{
  const plan = K.musicPlan(12), set = plan.scale;
  check(Array.isArray(set) && set.length === 5 && (set.join() === '0,2,4,7,9' || set.join() === '0,3,5,7,10'), 'a day has a pentatonic scale (' + set.join(',') + ')');
  const p12 = K.musicPlan(12), p13 = K.musicPlan(13), p12b = K.musicPlan(12);
  check(JSON.stringify(p12) === JSON.stringify(p12b) && JSON.stringify(p12) !== JSON.stringify(p13), 'the same day gives the same plan, the next day another one');
  const seqOf = (day, secs) => { const { ctx, a } = newAudio(); a.setVolumes({ music: 0.45 }); listenAt(a); runMusic(a, ctx, secs, Object.assign({}, MUSIC_S, { day })); return Array.from(a.noteLog.slice(0, a.noteCount)); };
  const s1 = seqOf(12, 20), s2 = seqOf(12, 20), s3 = seqOf(13, 20);
  check(s1.length > 12, 'music plays: ' + s1.length + ' notes in 20 s');
  check(JSON.stringify(s1) === JSON.stringify(s2), 'the same day plays the same music');
  check(JSON.stringify(s1) !== JSON.stringify(s3), 'the next day plays a different one');
  const root = p12.root, inSet = new Set(set);
  check(s1.every(m => inSet.has((((m - root) % 12) + 12) % 12)), 'every note is in the pentatonic scale of the day');
  {
    const { ctx, a } = newAudio(); a.setVolumes({ music: 0 }); listenAt(a);
    runMusic(a, ctx, 20, Object.assign({}, MUSIC_S, { day: 12 }));
    check(a.noteCount === 0, 'music at volume 0: no note is scheduled');
    a.setVolumes({ music: 0.45 }); runMusic(a, ctx, 10, Object.assign({}, MUSIC_S, { day: 12 }));
    check(a.noteCount > 0, 'music back on: notes again');
  }
  {
    const { ctx, a } = newAudio(); a.setVolumes({ music: 0.45 }); a.listen([0, 66, 0], 0, world(15), false);
    runMusic(a, ctx, 3, Object.assign({}, MUSIC_S));
    check(a.musDuck.gain.value > 0.9, 'no mob near: the music at full level');
    const mob = { pos: [6, 66, 0], dead: false, def: { hostile: true } };
    runMusic(a, ctx, 4, Object.assign({}, MUSIC_S, { mobs: [mob] }));
    check(a.musDuck.gain.value <= 0.3, 'a hostile mob 6 blocks away ducks the music (' + a.musDuck.gain.value.toFixed(2) + ')');
    const far = { pos: [60, 66, 0], dead: false, def: { hostile: true } };
    runMusic(a, ctx, 4, Object.assign({}, MUSIC_S, { mobs: [far] }));
    check(a.musDuck.gain.value > 0.9, 'a mob 60 blocks away does not');
  }
  {
    const { ctx, a } = newAudio(); a.setVolumes({ music: 0.45 }); a.listen([0, 66, 0], 0, world(15), false);
    const t0 = a.counts.tick || 0;
    runMusic(a, ctx, 6, Object.assign({}, MUSIC_S, { agents: [{ pos: [12, 66, 0] }] }));
    check((a.counts.tick || 0) > t0, 'a village near: the soft tick rhythm (' + ((a.counts.tick || 0) - t0) + ' ticks in 6 s)');
    const t1 = a.counts.tick || 0;
    runMusic(a, ctx, 6, Object.assign({}, MUSIC_S, { agents: [{ pos: [200, 66, 0] }] }));
    check((a.counts.tick || 0) === t1, 'no village near: no tick');
  }
}
function listenAt(a) { a.listen([0.5, 66, 0.5], 0, world(15), false); }

// ---- 8. no allocation per frame (the idle loop creates no node), and the per-frame cost is measured
console.log('frames');
{
  const { ctx, a } = newAudio(); a.setVolumes({ music: 0 });
  const W = world(15);
  for (let i = 0; i < 30; i++) { a.listen([0.5, 66, 0.5], 0.3, W, false); a.updateMusic(0.016, MUSIC_S); }
  const n0 = ctx.nodes.length, t0 = performance.now();
  for (let i = 0; i < 600; i++) { a.listen([0.5 + i * 0.01, 66, 0.5], 0.3 + i * 0.001, W, false); a.updateMusic(0.016, MUSIC_S); }
  const ms = performance.now() - t0;
  check(ctx.nodes.length === n0, '600 idle frames create no node (' + (ctx.nodes.length - n0) + ' more)');
  console.log('    (' + (ms / 600).toFixed(4) + ' ms per listen + updateMusic call, node stub, music off)');
}

// ---- 9. a minute of play: music on, footsteps and hits every half second, the voices stay bounded
console.log('budget');
{
  const { ctx, a } = newAudio(); a.setVolumes({ music: 0.45 });
  const W = world((x) => (x > 20 ? 2 : 15));
  let peakVoices = 0;
  for (let t = 0; t < 60; t += 0.1) {
    ctx.currentTime += 0.1;
    a.listen([(t * 2) % 40, 66, 0.5], 0, W, false);
    if (Math.round(t * 10) % 5 === 0) { a.step(stateNamed('grass_block'), { speed: 4 }); a.dig(stateNamed('stone'), false); }
    if (Math.round(t * 10) % 20 === 0) a.play('hurt', { at: [(t * 2) % 40 + 4, 66, 0] });
    a.updateMusic(0.1, Object.assign({}, MUSIC_S, { agents: [{ pos: [30, 66, 0] }] }));
    peakVoices = Math.max(peakVoices, a.stats().voices);
  }
  check(peakVoices <= 24, 'a minute of play: at most 24 world voices live (peak ' + peakVoices + ')');
  check(ctx.nodes.length < 4000, 'a minute of play creates ' + ctx.nodes.length + ' nodes in all (every voice ends; the count is bounded by the events, not by time)');
  const total = a.counts;
  console.log('    (events: ' + Object.keys(total).map(k => k + ' ' + total[k]).join(', ') + ')');
}

console.log(fails ? fails + ' FAILED' : 'ALL OK');
process.exit(fails ? 1 : 0);
