// e-score2 · the place-aware score heard (src/main/score2.js, score.js, scoresynth.js, audio.js), in Chromium:
//   1. offline renders through audio.js's own chain (OfflineAudioContext, 32 kHz): 20-s excerpts of the places' themes
//      (meadow, lullaby, Palmenhafen, the fairy places, the Mondstein waltz, the five peoples, the Lichtbrücke, the
//      Himmelsleiter, two dances) and the four stingers whole, to test/shots/score2/<name>.wav — no clipping; the cost
//      (oscillators a second) of Palmenhafen and of Heimat on Very Low and High; summary.json for test/score2_check.py;
//   2. in the game (de-DE): the director reads the place context (aware, the season), ⚙ „Musik seltener" reaches it,
//      a stinger lands on the beat in play, no page errors.
//   bash test/wt_run.sh score2.mjs 1800 ; then python3 test/score2_check.py (LUFS-ish, spectrograms, the sheet)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = fs.existsSync(path.join(HERE, '../src/main/score.js')) ? path.resolve(HERE, '..') : path.resolve(HERE, '../..');
const OUT = path.join(ROOT, 'test/shots/score2'); fs.mkdirSync(OUT, { recursive: true });
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
  await page.setContent('<!doctype html><meta charset="utf-8"><title>score2</title><body></body>');
  await page.addScriptTag({ content: 'window.VR = window.VR || {};' });
  for (const f of ['klang', 'score', 'scoresynth', 'score2', 'audio']) await page.addScriptTag({ content: fs.readFileSync(path.join(ROOT, 'src/main/' + f + '.js'), 'utf8') });
  // [name, id, variant, lv, tier, seed, season]
  const R = [
    ['meadow', 'meadow', 'day', 1, 3, 3, 0], ['lullaby', 'lullaby', 'night', 0, 3, 5, 3], ['harbour', 'harbour', 'day', 1, 3, 4, 1], ['fairy', 'fairy', 'day', 1, 3, 6, 0],
    ['waltz', 'waltz', 'night', 1, 3, 7, 1], ['p_aqua', 'p_aqua', 'day', 1, 3, 8, -1], ['p_ocker', 'p_ocker', 'day', 1, 3, 9, -1], ['p_zinn', 'p_zinn', 'day', 1, 3, 10, -1],
    ['p_basalt', 'p_basalt', 'day', 1, 3, 11, -1], ['p_opal', 'p_opal', 'day', 1, 3, 12, -1], ['bridge', 'bridge', 'day', 1, 3, 13, -1], ['ladder', 'ladder', 'day', 1, 3, 14, -1],
    ['d_drachen', 'd_drachen', 'dance', 2, 3, 15, 1], ['d_lichter', 'd_lichter', 'dance', 2, 3, 16, 3],
    ['glimpse', 'glimpse', 'day', 0, 3, 0, -1], ['friend', 'friend', 'day', 0, 3, 0, -1], ['welcome', 'welcome', 'day', 0, 3, 0, -1], ['freed', 'freed', 'day', 0, 3, 0, -1],
    ['harbour_t0', 'harbour', 'day', 1, 0, 4, 1], ['home_t3', 'home', 'day', 1, 3, 0, -1], ['home_t0', 'home', 'day', 1, 0, 0, -1],
  ];
  const summary = [];
  for (const [name, id, variant, lv, tier, seed, season] of R) {
    const r = await ev(async ([id, variant, lv, tier, seed, season]) => {
      const SR = 32000, full = VR.Score.cueLen(id, variant, seed), dur = Math.min(20, full), len = Math.ceil((dur + 4) * SR);
      const c = new OfflineAudioContext(2, len, SR);
      let oscs = 0; const co = c.createOscillator.bind(c); c.createOscillator = () => { oscs++; return co(); };
      const a = new VR.Audio(); a.setTier(tier); a.init(c); a.setVolumes({ master: 1, music: 1 });
      a.music.plan = VR.Klang.musicPlan(12); a.scoreDay = 12;
      a.startCue({ id, variant, lv, at: 0.05, dur: full, seed, colour: '', season });
      a.run.stopAt = 0.05 + dur; a.pump(a.run, 0, 0.05 + dur);
      const t0 = performance.now(); const buf = await c.startRendering(); const ms = performance.now() - t0;
      const L = buf.getChannelData(0), Rr = buf.getChannelData(1); let peak = 0;
      for (let i = 0; i < L.length; i++) { const p = Math.max(Math.abs(L[i]), Math.abs(Rr[i])); if (p > peak) peak = p; }
      const i16 = new Int16Array(L.length * 2);
      for (let i = 0; i < L.length; i++) { i16[2 * i] = Math.max(-32768, Math.min(32767, Math.round(L[i] * 32767))); i16[2 * i + 1] = Math.max(-32768, Math.min(32767, Math.round(Rr[i] * 32767))); }
      let s = ''; const u8 = new Uint8Array(i16.buffer); for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
      const insts = [...new Set(a.run.evs.filter(e => e.t < dur).map(e => e.inst))].join(',');
      return { dur, full, ms, oscs, notes: a.noteCount, peak, sr: SR, form: VR.Score.THEMES[id].sting ? 'A' : VR.Score.formOf(id, seed), insts, b64: btoa(s) };
    }, [id, variant, lv, tier, seed, season]);
    const buf = Buffer.from(r.b64, 'base64'); wav(path.join(OUT, name + '.wav'), new Int16Array(buf.buffer, buf.byteOffset, buf.length / 2), r.sr, 2);
    const db = 20 * Math.log10(Math.max(1e-9, r.peak));
    summary.push({ name, id, variant, tier, seed, season, form: r.form, dur: r.dur, full: r.full, ms: r.ms, oscs: r.oscs, notes: r.notes, peakDb: db, insts: r.insts });
    console.log(`  info  ${name.padEnd(11)} ${r.form.padEnd(4)} ${r.dur.toFixed(1)}/${r.full.toFixed(1)} s · ${r.notes} notes · ${(r.oscs / r.dur).toFixed(1)} osc/s · ${r.ms.toFixed(0)} ms · peak ${db.toFixed(1)} dBFS · ${r.insts}`);
    check(r.notes > 4 && r.peak > 0.01 && db <= -0.5, name + ': it sounds, no clipping (' + db.toFixed(1) + ' dBFS)');
  }
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 1));
  const S = (n) => summary.find(s => s.name === n), ops = (n) => S(n).oscs / S(n).dur;
  check(ops('harbour_t0') < ops('harbour') * 0.6, `Very Low stays far cheaper: Palmenhafen ${ops('harbour_t0').toFixed(1)} vs ${ops('harbour').toFixed(1)} oscillators a second`);
  console.log(`  info  cost: Heimat Very Low ${ops('home_t0').toFixed(1)}/s · High ${ops('home_t3').toFixed(1)}/s (e-music2: 3.0 / 8.2)`);

  // ---- 2. in the game: the place context, the switch, a stinger on the beat
  const t0 = logs.length;
  await page.goto('file://' + path.join(ROOT, 'dist/index.html'));
  for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
  await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.renderDist = 5; g.settings.dynRes = false; g.applySettings('renderDist'); g.audio.resume(); });
  await ev(`VR.game.createWorld({name:'Musik3',mode:'creative',difficulty:'peaceful',type:'default',seed:'4242',cheats:true,kit:true})`);
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
  const st = await ev(() => { const a = VR.game.audio, x = a.sc, l = a.score.log[0]; return { aware: !!x.aware, season: x.season, place: x.place, people: x.people, cue: l ? l.id + ':' + l.variant + ' pk ' + l.pk : '', ctx: a.ctx.state }; });
  console.log('  info  in play: ' + JSON.stringify(st));
  check(st.aware && st.cue && /pk (home|harbour|fairy|circle)/.test(st.cue), 'the director reads the place context in play (' + st.cue + ', season ' + st.season + ')');
  const sw = await ev(() => { const g = VR.game; const has = !!(VR.SettingsReg ? JSON.stringify(VR.SettingsReg).indexOf('musicLess') >= 0 : true); g.settings.musicLess = true; g.applySettings('musicLess'); return { has, less: g.audio.score.less, label: VR.I18N ? VR.I18N.t('g.set.musicLess') : '' }; });
  check(sw.less === true && sw.label === 'Musik seltener', '⚙ „' + sw.label + '" reaches the director');
  // a stinger in play: it lands on the running cue's beat
  const sg = await ev(() => { const a = VR.game.audio, D = a.score; D.lastSting = {}; const cu = D.cue; const ok = a.cue('glimpse'); return { ok, qAt: D.qAt, t0: cu ? cu.t0 : 0, B: cu ? cu.B : 0, has: !!cu, now: a.ctx.currentTime }; });
  for (let k = 0; k < 8; k++) { await frames(10); await wait(200); }
  const sl = await ev(() => { const l = VR.game.audio.score.log; const x = l.filter(e => e.id === 'glimpse').pop(); return x ? x.t0 : -1; });
  const beats = sg.B ? (sl - sg.t0) / sg.B : 0;
  console.log('  info  stinger: ' + JSON.stringify(sg) + ' started ' + sl + ' (' + beats.toFixed(4) + ' beats)');
  check(sg.ok && sl > 0 && (!sg.has || Math.abs(beats - Math.round(beats)) < 1e-4), 'a wander-moment stinger in play starts on the beat');
  const vl = await ev(() => { const g = VR.game; g.applyPreset('potato'); const a = g.audio; return [a.tier, a.musCap(), a.lowEnd]; });
  check(vl[0] === 0 && vl[1] === 10 && vl[2], 'Very Low: tier 0, cap 10');
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
