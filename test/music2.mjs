// e-music2 · the richer score heard (src/main/score.js, scoresynth.js, audio.js), in Chromium:
//   1. offline renders through audio.js's own chain (OfflineAudioContext, 32 kHz, 7 s of tail room) to
//      test/shots/music2/<name>.wav: the plain Heimat at every tier (Very Low 0 … High 3: the cost), the forms (AB, BA),
//      the fight High / Very Low, the stings, the wander layer, the colours (moon, Ocker, Aquamarin, a red star) — no
//      clipping, and summary.json with each render's last onset (test/music2_check.py measures the tail on the WAV);
//   2. in the game (de-DE): the presets set the music's tier (Very Low 0, Balanced 2, High 3: the room, the chorus),
//      the director runs with a colour, the ambience has its surf and cabin layers, no page errors.
//   bash test/wt_run.sh music2.mjs 1800 ; then python3 test/music2_check.py (tails, LUFS-ish, spectrograms, the sheet)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = fs.existsSync(path.join(HERE, '../src/main/score.js')) ? path.resolve(HERE, '..') : path.resolve(HERE, '../..');
const OUT = path.join(ROOT, 'test/shots/music2'); fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { if (m.type() === 'error') logs.push('[error] ' + m.text().slice(0, 300)); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 600)));
const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ok    ' : '  FAIL  ') + msg); };
function wav(file, i16, sr, ch) {
  const b = Buffer.alloc(44 + i16.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + i16.length * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(ch, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * ch * 2, 28); b.writeUInt16LE(ch * 2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(i16.length * 2, 40);
  Buffer.from(i16.buffer, i16.byteOffset, i16.byteLength).copy(b, 44); fs.writeFileSync(file, b);
}
try {
  await page.setContent('<!doctype html><meta charset="utf-8"><title>music2</title><body></body>');
  await page.addScriptTag({ content: 'window.VR = window.VR || {};' });
  for (const f of ['klang', 'score', 'scoresynth', 'audio']) await page.addScriptTag({ content: fs.readFileSync(path.join(ROOT, 'src/main/' + f + '.js'), 'utf8') });
  // the seeds of two forms (found in the page: the same code decides)
  const seeds = await ev(() => { const f = (id, want) => { for (let s = 1; s < 500; s++) if (VR.Score.formOf(id, s) === want) return s; return 1; }; return { homeAB: f('home', 'AB'), spaceBA: f('space', 'BA'), advAB: f('adventure', 'AB') }; });
  // [name, id, variant, lv, tier, seed, colour]
  const R = [
    ['home_t3', 'home', 'day', 1, 3, 0, ''], ['home_t2', 'home', 'day', 1, 2, 0, ''], ['home_t1', 'home', 'day', 1, 1, 0, ''], ['home_t0', 'home', 'day', 1, 0, 0, ''],
    ['home_AB', 'home', 'day', 1, 3, seeds.homeAB, ''], ['space_BA', 'space', 'cruise', 1, 3, seeds.spaceBA, ''],
    ['boss3_t3', 'adventure', 'boss3', 2, 3, seeds.advAB, ''], ['boss3_t0', 'adventure', 'boss3', 2, 0, seeds.advAB, ''],
    ['wonder', 'wonder', 'day', 0, 3, 0, ''], ['funke', 'funke', 'day', 0, 3, 0, ''], ['wander', 'wander', 'day', 0, 3, 7, ''],
    ['home_moon', 'home', 'day', 1, 3, 0, 'moon'], ['home_ocker', 'home', 'day', 1, 3, 0, 'ocker'], ['home_aqua', 'home', 'day', 1, 3, 0, 'aqua'], ['home_redstar', 'home', 'day', 1, 3, 0, 'exo:3300'],
  ];
  const summary = [];
  for (const [name, id, variant, lv, tier, seed, colour] of R) {
    const r = await ev(async ([id, variant, lv, tier, seed, colour]) => {
      const SR = 32000, dur = VR.Score.cueLen(id, variant, seed), len = Math.ceil((dur + 7) * SR);
      const c = new OfflineAudioContext(2, len, SR);
      let oscs = 0; const co = c.createOscillator.bind(c); c.createOscillator = () => { oscs++; return co(); };
      const a = new VR.Audio(); a.setTier(tier); a.init(c); a.setVolumes({ master: 1, music: 1 });
      a.music.plan = VR.Klang.musicPlan(12); a.scoreDay = 12;
      a.startCue({ id, variant, lv, at: 0.05, dur, seed, colour });
      const lastOn = 0.05 + Math.max(...a.run.evs.map(e => e.t));
      a.pump(a.run, 0, Infinity);
      const t0 = performance.now(); const buf = await c.startRendering(); const ms = performance.now() - t0;
      const L = buf.getChannelData(0), Rr = buf.getChannelData(1); let peak = 0;
      for (let i = 0; i < L.length; i++) { const p = Math.max(Math.abs(L[i]), Math.abs(Rr[i])); if (p > peak) peak = p; }
      const i16 = new Int16Array(L.length * 2);
      for (let i = 0; i < L.length; i++) { i16[2 * i] = Math.max(-32768, Math.min(32767, Math.round(L[i] * 32767))); i16[2 * i + 1] = Math.max(-32768, Math.min(32767, Math.round(Rr[i] * 32767))); }
      let s = ''; const u8 = new Uint8Array(i16.buffer); for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
      return { dur, lastOn, ms, oscs, notes: a.noteCount, peak, sr: SR, form: VR.Score.formOf(id, seed), b64: btoa(s) };
    }, [id, variant, lv, tier, seed, colour]);
    const buf = Buffer.from(r.b64, 'base64'); wav(path.join(OUT, name + '.wav'), new Int16Array(buf.buffer, buf.byteOffset, buf.length / 2), r.sr, 2);
    const db = 20 * Math.log10(Math.max(1e-9, r.peak));
    summary.push({ name, id, variant, tier, seed, colour, form: r.form, dur: r.dur, lastOn: r.lastOn, ms: r.ms, oscs: r.oscs, notes: r.notes, peakDb: db });
    console.log(`  info  ${name.padEnd(13)} ${r.form.padEnd(2)} ${r.dur.toFixed(1)} s · ${r.notes} notes · ${r.oscs} osc (${(r.oscs / r.dur).toFixed(1)}/s) · render ${r.ms.toFixed(0)} ms · peak ${db.toFixed(1)} dBFS`);
    check(r.notes > 5 && r.peak > 0.01 && db <= -0.5, name + ': it sounds, no clipping (' + db.toFixed(1) + ' dBFS)');
  }
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 1));
  const S = (n) => summary.find(s => s.name === n);
  check(S('home_t0').oscs / S('home_t0').dur < S('home_t3').oscs / S('home_t3').dur * 0.6, `Very Low stays far cheaper than High (${(S('home_t0').oscs / S('home_t0').dur).toFixed(1)} vs ${(S('home_t3').oscs / S('home_t3').dur).toFixed(1)} oscillators a second)`);
  check(S('boss3_t0').oscs < S('boss3_t3').oscs * 0.6, `the fight on Very Low: ${S('boss3_t0').oscs} vs ${S('boss3_t3').oscs} oscillators`);

  // ---- 2. in the game: the tiers from the presets, a colour, the ambience's new layers
  const t0 = logs.length;
  await page.goto('file://' + path.join(ROOT, 'dist/index.html'));
  for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
  await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.renderDist = 5; g.settings.dynRes = false; g.applySettings('renderDist'); g.audio.resume(); });
  await ev(`VR.game.createWorld({name:'Musik2',mode:'creative',difficulty:'peaceful',type:'default',seed:'4242',cheats:true,kit:true})`);
  for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
  await ev(() => VR.game.audio.resume());
  const frames = (n) => ev((n) => {
    const g = VR.game;
    if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; }
    window.requestAnimationFrame = () => 0; window.__norender = true;
    for (let i = 0; i < n; i++) { g.last = performance.now() - 33; g.loop(performance.now()); }
    return n;
  }, n);
  for (let k = 0; k < 6; k++) { await frames(20); await wait(250); }
  const st = await ev(() => { const a = VR.game.audio, l = a.score.log[0]; return { tier: a.tier, room: !!a.roomIn, cho: !!a.choIn, cue: l ? l.id + ':' + l.variant + ' seed ' + l.seed + ' colour "' + l.colour + '"' : '', seed: l ? l.seed : 0, amb: VR.game.ambience && VR.game.ambience.L ? Object.keys(VR.game.ambience.L).join(' ') : '' }; });
  console.log('  info  in play: ' + st.cue + ' · ambience ' + st.amb);
  check(st.tier === 2 && st.room && !st.cho, 'Balanced: tier 2 — the room, no chorus');
  check(st.seed > 0, 'the director gives the cue a seed in play');
  check(/surf/.test(st.amb) && /cabin/.test(st.amb), 'the ambience has its surf and cabin layers');
  const hi = await ev(() => { const g = VR.game; g.applyPreset('high'); const a = g.audio; return [a.tier, !!a.roomIn, !!a.choIn, a.musCap()]; });
  check(hi[0] === 3 && hi[1] && hi[2] && hi[3] === 36, 'High: tier 3 — room, chorus, cap 36');
  const vl = await ev(() => { const g = VR.game; g.applyPreset('potato'); const a = g.audio; return [a.tier, !!a.roomIn, !!a.choIn, a.musCap(), a.lowEnd]; });
  check(vl[0] === 0 && !vl[1] && !vl[2] && vl[3] === 10 && vl[4], 'Very Low: tier 0 — no room, no chorus, cap 10, no reverb');
  for (let k = 0; k < 4; k++) { await frames(20); await wait(200); }
  const errs = logs.slice(t0).filter(l => !/WebGL|GPU|swiftshader|favicon/i.test(l));
  check(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
} catch (e) {
  fails++; console.log('  FAIL  ' + (e.stack || e.message).slice(0, 800));
} finally {
  await browser.close();
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
