// f-film2 · the 'welt' trailer's music heard (src/main/trailer_score.js; docs/superpowers/plans/2026-11-05-f-film2.md):
// a bare page (klang, score, scoresynth, audio, trailer_welt's pure part, trailer_score — no game, no WebGL) renders the
// film's 46.5 s in an OfflineAudioContext through audio.js's own music chain → test/shots/trailer_welt_music.wav, and
// checks it: it sounds, no clipping, quiet at the start, louder after the isles' reveal than before it, the title's chord
// held and then gone into silence at the end. MUX=<mp4> puts the new music into that film (AAC, the video copied).
//   bash test/wt_run.sh trailer_music.mjs 900
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = fs.existsSync(path.join(HERE, '../src/main/trailer_score.js')) ? path.resolve(HERE, '..') : path.resolve(HERE, '../..');
const WAV = path.join(ROOT, 'test/shots/trailer_welt_music.wav');
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const browser = await chromium.launch({ channel: 'chromium', args: ['--autoplay-policy=no-user-gesture-required'] });
try {
  const page = await browser.newPage();
  const logs = []; page.on('pageerror', e => logs.push(String(e.message).slice(0, 300)));
  await page.setContent('<!doctype html><meta charset="utf-8"><title>music</title><body></body>');
  await page.addScriptTag({ content: 'window.VR = window.VR || {};' });
  for (const f of ['klang', 'score', 'scoresynth', 'audio', 'trailer_welt', 'trailer_score']) await page.addScriptTag({ content: fs.readFileSync(path.join(ROOT, 'src/main/' + f + '.js'), 'utf8') });
  const r = await page.evaluate(async () => {
    const S = VR.TrailerWelt.plan({ meadow: [300, 84, 200], village: [-1, 81, -55], fairy: [74, 90, -278], outpost: [-523, 83, -497], beacon: [-529, 84, -503], isles: [330, 146, 140] }).map((s) => ({ name: s.name, dur: s.dur }));
    const t0 = performance.now(), m = await VR.TrailerScore.renderOffline(S);
    return Object.assign(m, { ms: performance.now() - t0, marks: VR.TrailerScore.marks(S) });
  });
  const pcm = Buffer.from(r.b64, 'base64'), b = Buffer.alloc(44);
  b.write('RIFF', 0); b.writeUInt32LE(36 + pcm.length, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22);
  b.writeUInt32LE(r.sr, 24); b.writeUInt32LE(r.sr * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(pcm.length, 40);
  fs.mkdirSync(path.dirname(WAV), { recursive: true }); fs.writeFileSync(WAV, Buffer.concat([b, pcm]));
  const i16 = new Int16Array(pcm.buffer, pcm.byteOffset, pcm.length / 2), sr = r.sr;
  const rms = (a, z) => { let s = 0, n = 0; for (let i = Math.floor(a * sr); i < Math.min(i16.length / 2, z * sr); i++) { const v = (i16[2 * i] + i16[2 * i + 1]) / 65536; s += v * v; n++; } return 20 * Math.log10(Math.sqrt(s / Math.max(1, n)) + 1e-9); };
  const M = r.marks, line = [];
  for (let t = 0; t < M.total; t += 2) line.push(t + ':' + rms(t, t + 2).toFixed(0));
  console.log('  info  ' + r.notes + ' notes · ' + (r.len / sr).toFixed(1) + ' s · rendered in ' + (r.ms / 1000).toFixed(1) + ' s · raw peak ' + (20 * Math.log10(r.peak)).toFixed(1) + ' dBFS (normalised to −1.5)');
  console.log('  info  dB every 2 s: ' + line.join(' '));
  check(r.notes > 100 && Math.abs(r.len / sr - M.total) < 0.05, 'the music fills the film (' + r.notes + ' notes, ' + (r.len / sr).toFixed(1) + ' s)');
  let pk = 0; for (let i = 0; i < i16.length; i++) pk = Math.max(pk, Math.abs(i16[i])); const pkDb = 20 * Math.log10(pk / 32768);
  check(pkDb <= -1, 'no clipping (peak ' + pkDb.toFixed(1) + ' dBFS)');
  const pre = rms(M.reveal - 3, M.reveal - 0.2), post = rms(M.reveal + 1.5, M.reveal + 4.5), open = rms(1.5, 6);
  check(post > pre + 2, 'the swell at the isles\' reveal (' + pre.toFixed(1) + ' → ' + post.toFixed(1) + ' dB)');
  check(open < rms(M.reveal + 6, M.title - 1), 'a gentle start, fuller later (' + open.toFixed(1) + ' dB at the start)');
  const held = rms(M.title + 0.6, M.title + 2.8), end = rms(M.total - 0.25, M.total);
  check(held > -30, 'the title\'s chord is held (' + held.toFixed(1) + ' dB)');
  check(end < held - 18, 'and fades into the black (' + end.toFixed(1) + ' dB in the last quarter second)');
  check(logs.length === 0, 'no page errors' + (logs.length ? ': ' + logs.join(' | ') : ''));
  if (process.env.MUX && fs.existsSync(process.env.MUX)) {
    const mp4 = process.env.MUX, tmp = mp4.replace(/\.mp4$/, '_v.mp4');
    execFileSync('/usr/local/bin/ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', mp4, '-map', '0:v', '-c:v', 'copy', tmp]);
    execFileSync('/usr/local/bin/ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', tmp, '-i', WAV, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', mp4]);
    fs.rmSync(tmp, { force: true });
    const st = execFileSync(fs.existsSync('/usr/local/bin/ffprobe') ? '/usr/local/bin/ffprobe' : 'ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', mp4]).toString().trim().split(/\s+/);
    check(st.includes('h264') && st.includes('aac'), 'muxed into ' + mp4 + ' (' + st.join(' + ') + ')');
  }
} catch (e) { fails++; console.log('  ✗ ' + (e.stack || e.message).slice(0, 600)); }
finally { await browser.close(); }
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
