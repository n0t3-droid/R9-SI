// e-music · the score heard (src/main/score.js, scoresynth.js, audio.js), in Chromium:
//   1. offline: every theme rendered through audio.js's own music chain (an OfflineAudioContext: the cue bus, the duck,
//      the music bus, the reverb send, the master and its compressor) to test/shots/music/<cue>.wav — no clipping (raw
//      peak ≤ −0.5 dBFS), a loudness in range (test/music_check.py: LUFS-ish, −30 … −12), the render's cost High vs Very
//      Low (oscillators started, ms to render);
//   2. in the game (de-DE): the director runs in play (a cue starts, notes go out on the audio clock), the Klang page of
//      the settings shows Stimmen and Ruhige Musik (test/shots/music_settings.png), Very Low switches the music's reverb
//      off, no page errors.
//   bash test/wt_run.sh music.mjs 1800 ; then python3 test/music_check.py (spectrograms, LUFS-ish, the sheet)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = fs.existsSync(path.join(HERE, '../src/main/score.js')) ? path.resolve(HERE, '..') : path.resolve(HERE, '../..');
const OUT = path.join(ROOT, 'test/shots/music'); fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'de-DE' });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { const t = m.type(), s = m.text(); if (t === 'error') logs.push(`[${t}] ${s.slice(0, 300)}`); });
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
  // ---- 1. offline renders (a bare page: klang.js, score.js, scoresynth.js, audio.js — no game, no WebGL)
  await page.setContent('<!doctype html><meta charset="utf-8"><title>music</title><body></body>');
  await page.addScriptTag({ content: 'window.VR = window.VR || {};' });
  for (const f of ['klang', 'score', 'scoresynth', 'audio']) await page.addScriptTag({ content: fs.readFileSync(path.join(ROOT, 'src/main/' + f + '.js'), 'utf8') });
  const CUES = [['home', 'day', 1], ['home', 'night', 0], ['space', 'cruise', 1], ['adventure', 'boss3', 2], ['wonder', 'day', 0], ['funke', 'day', 0], ['wander', 'day', 0]];
  const summary = [];
  for (const [id, variant, lv] of CUES) {
    for (const low of [false, true]) {
      if (low && !(id === 'home' && variant === 'day') && !(id === 'adventure')) continue;
      const r = await ev(async ([id, variant, lv, low]) => {
        const SR = 32000, dur = VR.Score.cueLen(id, variant), len = Math.ceil((dur + 3) * SR);
        const c = new OfflineAudioContext(2, len, SR);
        let oscs = 0; const co = c.createOscillator.bind(c); c.createOscillator = () => { oscs++; return co(); };
        const a = new VR.Audio(); a.init(c); a.setVolumes({ master: 1, music: 1 }); a.setLowEnd(low);
        a.music.plan = VR.Klang.musicPlan(12); a.scoreDay = 12;
        a.startCue({ id, variant, lv, at: 0.05, dur });
        a.pump(a.run, 0, Infinity);
        const t0 = performance.now(); const buf = await c.startRendering(); const ms = performance.now() - t0;
        const L = buf.getChannelData(0), R = buf.getChannelData(1); let peak = 0;
        for (let i = 0; i < L.length; i++) { const p = Math.max(Math.abs(L[i]), Math.abs(R[i])); if (p > peak) peak = p; }
        const i16 = new Int16Array(L.length * 2);
        for (let i = 0; i < L.length; i++) { i16[2 * i] = Math.max(-32768, Math.min(32767, Math.round(L[i] * 32767))); i16[2 * i + 1] = Math.max(-32768, Math.min(32767, Math.round(R[i] * 32767))); }
        let s = ''; const u8 = new Uint8Array(i16.buffer); for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
        return { dur, ms, oscs, notes: a.noteCount, peak, sr: SR, b64: btoa(s) };
      }, [id, variant, lv, low]);
      const name = id + '_' + variant + (low ? '_vl' : '');
      const buf = Buffer.from(r.b64, 'base64'); wav(path.join(OUT, name + '.wav'), new Int16Array(buf.buffer, buf.byteOffset, buf.length / 2), r.sr, 2);
      const db = 20 * Math.log10(Math.max(1e-9, r.peak));
      summary.push({ name, dur: r.dur, ms: r.ms, oscs: r.oscs, notes: r.notes, peakDb: db });
      console.log(`  info  ${name.padEnd(22)} ${r.dur.toFixed(1)} s · ${r.notes} notes · ${r.oscs} oscillators · render ${r.ms.toFixed(0)} ms · peak ${db.toFixed(1)} dBFS`);
      check(r.notes > 5 && r.peak > 0.01, name + ': it sounds (' + r.notes + ' notes)');
      check(db <= -0.5, name + ': no clipping (peak ' + db.toFixed(1) + ' dBFS ≤ −0.5)');
    }
  }
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 1));
  const hi = summary.find(s => s.name === 'adventure_boss3'), vl = summary.find(s => s.name === 'adventure_boss3_vl');
  check(vl && hi && vl.oscs < hi.oscs * 0.75, `Very Low plays the fight with fewer oscillators (${vl && vl.oscs} vs ${hi && hi.oscs})`);

  // ---- 2. in the game
  const t0 = logs.length;
  await page.goto('file://' + path.join(ROOT, 'dist/index.html'));
  for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
  await ev(() => { const g = VR.game; g.applyPreset('balanced'); g.settings.renderDist = 5; g.settings.dynRes = false; g.applySettings('renderDist'); g.audio.resume(); });
  await ev(`VR.game.createWorld({name:'Musik',mode:'creative',difficulty:'peaceful',type:'default',seed:'4242',cheats:true,kit:true})`);
  for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
  await ev(() => VR.game.audio.resume());
  await wait(3000);
  const st = await ev(() => { const a = VR.game.audio; return { has: !!a.score, log: a.score ? a.score.log.map(l => l.id + ':' + l.variant) : [], notes: a.noteCount, clock: a.ctx ? a.ctx.currentTime : -1, mood: a.music.mood, vox: a.vox ? a.vox.gain.value : -1 }; });
  console.log('  info  in play: cues ' + st.log.join(', ') + ' · ' + st.notes + ' notes · clock ' + st.clock.toFixed(1) + ' s · mood ' + st.mood);
  check(st.has && st.log.length >= 1, 'the director runs in the game (' + (st.log[0] || 'no cue') + ')');
  if (st.clock > 1) check(st.notes > 0, 'notes go out on the audio clock (' + st.notes + ')'); else console.log('  skip  the audio clock does not run here');
  check(Math.abs(st.vox - 0.8) < 1e-6, 'the Stimmen bus at its default 80 %');
  const cue = await ev(() => VR.game.audio.cue('wonder'));
  await wait(2500);
  const st2 = await ev(() => VR.game.audio.score.log.map(l => l.id));
  check(cue && st2.includes('wonder'), 'a vista cues Staunen in play (' + st2.join(', ') + ')');
  // the settings' Klang page
  await ev(() => { const u = VR.game.ui; if (u.show) u.show('settings'); if (u.showSettings) u.showSettings('snd'); });
  await wait(600);
  await page.screenshot({ path: path.join(ROOT, 'test/shots/music_settings.png') });
  const txt = await ev(() => document.body.innerText);
  check(/Stimmen/.test(txt) && /Ruhige Musik/.test(txt), 'the Klang page shows Stimmen and Ruhige Musik (German)');
  const calm = await ev(() => { const g = VR.game; g.settings.calmMusic = true; g.applySettings('calmMusic'); const r = g.audio.score.calm; g.settings.volVoice = 0.3; g.applySettings('volVoice'); return [r, g.audio.vox.gain.value]; });
  check(calm[0] === true && Math.abs(calm[1] - 0.3) < 1e-6, 'Ruhige Musik and Stimmen apply from the settings');
  const vlo = await ev(() => { const g = VR.game; g.applyPreset('potato'); return [g.audio.lowEnd, g.audio.musRev.numberOfOutputs, g.audio.musCap()]; });
  check(vlo[0] === true && vlo[2] <= 10, 'Very Low: the music without reverb, at most ' + vlo[2] + ' voices');
  const errs = logs.slice(t0).filter(l => !/WebGL|GPU|swiftshader|favicon/i.test(l));
  check(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
} catch (e) {
  fails++; console.log('  FAIL  ' + (e.stack || e.message).slice(0, 800));
} finally {
  await browser.close();
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
