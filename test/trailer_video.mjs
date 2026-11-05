// regress: skip (hours on SwiftShader — run by hand)
// t-film · the 'welt' trailer as a video (docs/superpowers/plans/2026-11-05-t-film.md). A throwaway Heartland world
// (seed 4242, Abenteuer on, encounters off: the freeing is staged), German UI, PRESET=high on SwiftShader. The game is
// stepped at a fixed 1/24 s; every EVERY-th frame of a running shot is drawn and photographed with its letterbox, the
// captions and the BEFREIT banner (page.screenshot); ffmpeg turns the frames into test/shots/trailer_welt.mp4 (H.264,
// yuv420p, faststart, 24 fps — motion-interpolated from the 12 captured), and one frame per shot (at 60 %) goes on the
// contact sheet test/shots/trailer_welt_sheet.jpg with its German caption. f-film2: the music — VR.TrailerScore renders
// the game's own score for the film's length in an OfflineAudioContext in the page (test/shots/trailer_welt_music.wav),
// muxed into the mp4 as AAC; the film grade's before/after (GRADECMP=1: at 60 % of each shot the frame once without the
// grade) → test/shots/trailer_welt_grade.jpg.
// Env: W, H (1280 × 720) · EVERY (2) · SCALE (the game's render scale: 0.75 draws 0.56 of the pixels, the captions stay sharp) · ONLY=3,5 (those shots only: a test capture) · TAG (the output's name: welt)
//      SEED (4242) · NOVIDEO=1 (frames and sheet only) · NOMUSIC=1 · GRADECMP=1 (the before/after frames)
//      x-top: OUT_W, OUT_H (the video's size: W × H captured, downscaled with Lanczos — W 1920 / OUT_W 1280 is 1.5 × supersampling)
//      · XCMP=1 (at 60 % of each shot the same moment once with x-top's switches off → test/shots/top_compare.jpg; OLD=the
//      old film for a third column) · SKIPTO=0.55, STOPAT=0.65 (a test capture: each wanted shot from / to that share of it)
//   nohup bash test/wt_run.sh trailer_video.mjs 14400 > .tmp_tests/trailer_video.log 2>&1 &
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = ROOT + '/test/shots/';
const W = +(process.env.W || 1280), H = +(process.env.H || 720), EVERY = +(process.env.EVERY || 2), FPS = 24;
const ONLY = process.env.ONLY ? process.env.ONLY.split(',').map(Number) : null;
const TAG = process.env.TAG || 'welt';
const FR = ROOT + '/.tmp_tests/tw_frames_' + TAG + '/';
const START = process.env.START ? +process.env.START : 0;   // resume: keep the frames of the shots before START, go on from there
if (!START) fs.rmSync(FR, { recursive: true, force: true }); fs.mkdirSync(FR, { recursive: true }); fs.mkdirSync(SHOTS, { recursive: true });
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const T0 = Date.now(), el = () => ((Date.now() - T0) / 60000).toFixed(1) + ' min';

const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, locale: 'de-DE' });
const logs = [];
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 600)));
page.on('console', m => { const s = m.text(); if (m.type() === 'error' || /trailer welt/.test(s)) logs.push('[' + m.type() + '] ' + s.slice(0, 400)); });
await page.goto('file://' + ROOT + '/dist/index.html');
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
for (let i = 0; i < 160; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title').catch(() => false)) break; }
check(await ev(() => VR.I18N.lang) === 'de', 'the game speaks German');
await ev(([p, sc]) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.renderDist = 12; g.settings.horizon = 2; g.settings.wildHeart = true; if (sc) g.settings.scale = sc; g.applySettings('*'); }, [process.env.PRESET || 'high', +(process.env.SCALE || 0)]);
await ev(`VR.game.createWorld({name:'Welt heute',mode:'creative',difficulty:'peaceful',type:'default',seed:'${process.env.SEED || '4242'}',cheats:true,kit:true})`);
for (let i = 0; i < 120; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
check(await ev(() => VR.game.state) === 'play', 'a Heartland world');
await ev(() => {
  const g = VR.game; window.requestAnimationFrame = () => 0;
  g.zenFreezeWeather = true; g.env.rain = 0; g.env.rainTarget = 0; if (g.env.wx && g.env.wx.force) g.env.wx.force('klar');
  if (VR.Adventure) { VR.Adventure.setOn(true); VR.Adventure.setEnc('off'); }
  const R = g.renderer; R._render = R.render; R.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; window.__norender = true;
  const st = document.createElement('style'); st.textContent = '#cine .fade{transition:none!important} #cine .hintc{display:none!important} #hud,#hints,.toast,#toasts{visibility:hidden!important}'; document.head.appendChild(st);
});
const DT = 1000 / FPS;
const step = (n) => ev(([m, d]) => { const g = VR.game; for (let i = 0; i < m; i++) { if (window.__simTick) window.__simTick(d); g.last = performance.now() - d; g.loop(performance.now()); } }, [n, DT]);
const state = () => ev(() => { const g = VR.game, d = g.director; const s = d.shots && d.shots[d.si]; return { active: d.active, si: d.si, phase: d.phase, t: +d.t.toFixed(3), name: s && s.name, cap: s && s.caption, n: d.shots ? d.shots.length : 0, dur: s && s.dur }; });
// settle the start: chunks round the spawn
for (let i = 0; i < 60; i++) { await step(10); await wait(60); }
console.log('play', await ev(() => VR.game.director.play('welt', { stage: true })), el());
for (let i = 0; i < 100; i++) { await wait(200); if (await ev(() => VR.game.director.active)) break; }
let st = await state();
check(st.active && st.n >= 8, 'the welt trailer runs (' + st.n + ' shots)');
// the page's timers run on the film's clock from here (a banner that hides after 4.2 s stays 4.2 s of film, not of the
// minutes the frames take to draw)
await ev(() => {
  const st0 = window.setTimeout.bind(window), ct0 = window.clearTimeout.bind(window); let id = 1e9, q = [], now = 0;
  window.setTimeout = (fn, ms, ...a) => { if (typeof fn !== 'function') return st0(fn, ms); q.push({ id: ++id, at: now + (+ms || 0), fn, a }); return id; };
  window.clearTimeout = (k) => { if (k >= 1e9) q = q.filter((x) => x.id !== k); else ct0(k); };
  window.__simTick = (d) => { now += d; const due = q.filter((x) => x.at <= now); if (!due.length) return; q = q.filter((x) => x.at > now); for (const x of due) { try { x.fn(...x.a); } catch (e) { console.error('timer', e && e.message); } } };
});
const plan = await ev(() => VR.game.director.shots.map((s) => ({ name: s.name, dur: s.dur, cap: s.caption, stage: s.stage || '', at: s.anchor ? s.anchor.map(Math.round) : null })));
console.log(JSON.stringify(plan));
// f-film2 · the music: the game's own score on the film's clock, rendered offline in the page (VR.TrailerScore)
const WAV = SHOTS + 'trailer_' + TAG + '_music.wav';
let music = null;
if (!process.env.NOMUSIC) {
  try {
    const t0 = Date.now();
    music = await ev(() => VR.TrailerScore.renderOffline(VR.game.director.shots.map((s) => ({ name: s.name, dur: s.dur }))));
    const pcm = Buffer.from(music.b64, 'base64'), b = Buffer.alloc(44);
    b.write('RIFF', 0); b.writeUInt32LE(36 + pcm.length, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22);
    b.writeUInt32LE(music.sr, 24); b.writeUInt32LE(music.sr * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(pcm.length, 40);
    fs.writeFileSync(WAV, Buffer.concat([b, pcm]));
    const db = 20 * Math.log10(Math.max(1e-9, music.peak));
    console.log('  music: ' + music.evs + ' notes scheduled, ' + music.notes + ' played · ' + (music.len / music.sr).toFixed(1) + ' s · raw peak ' + db.toFixed(1) + ' dBFS · ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s to render');
    check(music.notes > 80 && music.peak > 0.01 && Math.abs(music.len / music.sr - plan.reduce((a, p) => a + p.dur, 0)) < 0.1, 'the music rendered for the film (' + music.notes + ' notes)');
  } catch (e) { check(false, 'the music: ' + String(e.message || e).slice(0, 300)); music = null; }
}
// a test capture: jump to the first wanted shot
if (ONLY || START) await ev((k) => { VR.game.director.si = k - 1; }, ONLY ? ONLY[0] : START);
let fi = START ? fs.readdirSync(FR).filter((f) => /^f_\d+\.jpg$/.test(f)).length : 0, simF = 0;
const fi0 = fi;
const frames = [], perShot = {}, ms = [];
let guard = 0, loadW = 0;
const cmpDone = {}, cmpFiles = [], xDone = {}, xFiles = [], skipDone = {};
const XOFF = { xDepth: 0, xClar: false, xBlur: false };
while (guard++ < 40000) {
  st = await state();
  if (!st.active) break;
  if (st.phase === 'next') { await step(1); continue; }
  if (ONLY && !ONLY.includes(st.si)) {
    const nx = ONLY.find((k) => k > st.si); if (nx === undefined) { await ev(() => VR.game.director.stop()); break; }
    await ev((k) => { const d = VR.game.director; d.si = k - 1; d.phase = 'next'; }, nx); continue;
  }
  // a shot loading: the film's clock waits for the world — the director's own 6-s limit is held off until the columns
  // round the camera are there and shown (the workers run in real time; a fast clock would cut to half-built land)
  if (st.phase === 'load') {
    const k = await ev(() => {
      const g = VR.game, w = g.world, p = g.player, d = g.director, rd = 6, pcx = Math.floor(p.pos[0]) >> 4, pcz = Math.floor(p.pos[2]) >> 4;
      let miss = 0, hidden = 0;
      for (let dz = -rd; dz <= rd; dz++) for (let dx = -rd; dx <= rd; dx++) { if (dx * dx + dz * dz > rd * rd) continue; const c = w.cols.get(VR.ckey(pcx + dx, pcz + dz)); if (!c) miss++; else if (!(c.shownAt >= 0)) hidden++; }
      const st = window.__ld || (window.__ld = { h: -1, n: 0 }); st.n = hidden === st.h ? st.n + 1 : 0; st.h = hidden;
      const ok = !miss && !w.pending.size && !g.pool.busy && !(g.horizon && g.horizon.inflight) && (hidden <= 8 || st.n >= 30);   // (a few columns of a dense town stay unshown out of view)
      if (!ok) d.loadT = Math.min(d.loadT, 0.1);
      // (the uploads' 2.5 ms a frame are real milliseconds — on a busy machine a hundred columns wait a long time: while a
      // shot loads, the queue may spend 40 ms a frame; the shot itself runs on the game's own budget)
      const q = g.renderer && g.renderer.q; if (q) { if (q.__up === undefined) q.__up = q.upload; q.upload = ok ? q.__up : 40; }
      return { ok, miss, hidden, pend: w.pending.size, busy: g.pool.busy };
    });
    loadW++;
    if (loadW % 40 === 1) console.log('   loading shot ' + st.si + ' ' + JSON.stringify(k));
    if (!k.ok && loadW > 900) await ev(() => { VR.game.director.loadT = 99; });   // (minutes: go on anyway)
    await step(k.ok ? 2 : 6); await wait(k.ok ? 20 : 60); continue;
  }
  loadW = 0;
  if (st.phase !== 'run') { await step(4); await wait(30); continue; }
  // a running shot: one simulated frame; every EVERY-th one drawn and photographed
  if (process.env.SKIPTO && !skipDone[st.si]) { skipDone[st.si] = true; await ev((k) => { const d = VR.game.director; d.t = Math.max(d.t, d.shots[d.si].dur * k); }, +process.env.SKIPTO); continue; }
  if (process.env.STOPAT && st.t >= st.dur * +process.env.STOPAT && (!process.env.XCMP || xDone[st.si])) { await ev(() => { const d = VR.game.director; d.t = d.shots[d.si].dur + 0.01; }); await step(1); continue; }   // (a test capture: the rest of the shot skipped)
  if (simF % EVERY === 0) {
    // x-top: the same moment once with Tiefe, Klarheit and Filmkamera off (the programs rebuilt, then back)
    if (process.env.XCMP && st.t >= st.dur * 0.6 && !xDone[st.si]) {
      xDone[st.si] = true;
      const shot = async (path, q) => { await ev((q) => { const r = VR.game.renderer, b = r.qBase; r.__xq = r.__xq || { xDepth: b.xDepth, xClar: b.xClar, xBlur: b.xBlur }; Object.assign(b, q || r.__xq); r.applyQ(false); window.__norender = false; const g = VR.game; for (let i = 0; i < 3; i++) { g.last = performance.now() - 0.001; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }, q); await page.screenshot({ path, type: 'jpeg', quality: 92, timeout: 300000 }); };
      const off = FR + 'xoff_' + st.si + '.jpg', on = FR + 'xon_' + st.si + '.jpg';
      await shot(off, XOFF); await shot(on, null);
      xFiles.push({ si: st.si, off, on, cap: st.cap, t: frames.length });
    }
    // f-film2: the grade's before/after — at 60 % of the shot the same moment once without the film grade
    if (process.env.GRADECMP && st.t >= st.dur * 0.6 && !cmpDone[st.si]) {
      cmpDone[st.si] = true;
      await ev(() => { window.__norender = false; const g = VR.game; VR.TrailerWelt.filmShow(false); g.last = performance.now() - 0.5; g.loop(performance.now()); g.renderer.gl.finish(); window.__norender = true; });
      const off = FR + 'cmp_off_' + st.si + '.jpg'; await page.screenshot({ path: off, type: 'jpeg', quality: 92, timeout: 300000 });
      await ev(() => VR.TrailerWelt.filmShow(true));
      cmpFiles.push({ si: st.si, off, on: FR + 'f_' + String(fi).padStart(5, '0') + '.jpg', cap: st.cap });
    }
    const t0 = Date.now();
    await ev((d) => { window.__norender = false; const g = VR.game; if (window.__simTick) window.__simTick(d); g.last = performance.now() - d; g.loop(performance.now()); g.renderer.gl.finish(); window.__norender = true; }, DT);
    const file = FR + 'f_' + String(fi).padStart(5, '0') + '.jpg';
    await page.screenshot({ path: file, type: 'jpeg', quality: 92, timeout: 300000 });
    ms.push(Date.now() - t0);
    frames.push({ i: fi, si: st.si, name: st.name, t: st.t, cap: st.cap });
    (perShot[st.si] = perShot[st.si] || []).push({ file, t: st.t, dur: st.dur, cap: st.cap, name: st.name });
    if (process.env.DEBUG_SHIPS) console.log('   ships', JSON.stringify(await ev(() => { const g = VR.game, T = g.traffic, d = g.director; return { n: T ? T.ships.length : -1, mine: (d.myShips || []).map((s) => ({ t: +s.t.toFixed(2), p: s.pos.map(Math.round), gpu: !!(s.d && s.d.gpu), dead: !!s.dead, inT: T ? T.ships.includes(s) : false })), wait: d.shipWait, cam: g.player.pos.map(Math.round) }; })));
    if (fi % 24 === 0) console.log(`  frame ${fi} · shot ${st.si} ${st.name} t ${st.t.toFixed(2)} · ${ms[ms.length - 1]} ms · ${el()}`);
    fi++;
  } else await step(1);
  simF++;
}
console.log('  dressed (tufts a shot):', JSON.stringify(await ev(() => (VR.game.director.shots || []).map((s) => s._dressed || 0)).catch(() => null)));
console.log('captured', fi, 'frames in', el(), '· median', ms.slice().sort((a, b) => a - b)[ms.length >> 1] || 0, 'ms a frame');
fs.writeFileSync(FR + 'frames.json', JSON.stringify(frames));
const shotsSeen = Object.keys(perShot).length;
check(shotsSeen === (ONLY ? ONLY.length : plan.length - START), 'every shot photographed (' + shotsSeen + ')');
const freed = await ev(() => { const L = VR.Liberate; return L ? [...L.sites().values()].some((s) => s.st === 'frei') : false; });
const libI = plan.findIndex((p) => p.stage === 'liberate');
if (libI >= START && (!ONLY || ONLY.includes(libI))) check(freed, 'the outpost was freed in its shot (BEFREIT)');
await browser.close();

// the contact sheet: one frame per shot at 60 % of it, with its German caption
if (START && fi0) {   // (the shots before START: their frames are in order, split by the plan's durations)
  const tot = plan.slice(0, START).reduce((a, p) => a + p.dur, 0); let acc = 0;
  for (let j = 0; j < START; j++) { const a0 = Math.round(acc / tot * fi0), a1 = Math.round((acc + plan[j].dur) / tot * fi0); acc += plan[j].dur; perShot[j] = []; for (let i = a0; i < a1; i++) perShot[j].push({ file: FR + 'f_' + String(i).padStart(5, '0') + '.jpg', t: (i - a0) / Math.max(1, a1 - a0) * plan[j].dur, dur: plan[j].dur, cap: plan[j].cap, name: plan[j].name }); }
}
const pick = Object.keys(perShot).sort((a, b) => a - b).map((k) => { const L = perShot[k], want = L[0].dur * 0.6; let b = L[0]; for (const f of L) if (Math.abs(f.t - want) < Math.abs(b.t - want)) b = f; return { file: b.file, label: (+k + 1) + ' · ' + (b.cap || b.name) }; });
const sheet = SHOTS + 'trailer_' + TAG + '_sheet.jpg';
const py = `
import json, sys
from PIL import Image, ImageDraw, ImageFont
P = json.loads(sys.argv[1]); out = sys.argv[2]
F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 17)
tw, th, cap, gap, cols = 560, 315, 30, 8, 3
rows = (len(P) + cols - 1) // cols
S = Image.new('RGB', (cols * tw + (cols + 1) * gap, rows * (th + cap) + (rows + 1) * gap), (14, 14, 20)); d = ImageDraw.Draw(S)
for i, p in enumerate(P):
    im = Image.open(p['file']).convert('RGB').resize((tw, th)); x = gap + (i % cols) * (tw + gap); y = gap + (i // cols) * (th + cap + gap)
    S.paste(im, (x, y + cap)); d.text((x + 4, y + 5), p['label'], font=F, fill=(245, 236, 220))
S.save(out, quality=88); print(out, S.size)
`;
try { console.log(execFileSync('python3', ['-c', py, JSON.stringify(pick), sheet]).toString().trim()); check(pick.length > 0 && fs.existsSync(sheet), 'the contact sheet ' + sheet); } catch (e) { check(false, 'the contact sheet: ' + String(e.message).slice(0, 200)); }
// f-film2 · the grade's before/after sheet (python3 /root/r9coord/pairs.py)
if (cmpFiles.length) {
  const spec = { w: 620, rows: cmpFiles.map((c) => ({ label: (c.si + 1) + ' · ' + (c.cap || '') + ' — vorher (Spielbild) · nachher (Filmlook)', imgs: [c.off, c.on] })) };
  const sp = FR + 'cmp.json'; fs.writeFileSync(sp, JSON.stringify(spec));
  const out = SHOTS + 'trailer_' + TAG + '_grade.jpg';
  try { execFileSync('python3', ['/root/r9coord/pairs.py', out, sp], { stdio: 'inherit' }); check(fs.existsSync(out), 'the grade comparison ' + out); } catch (e) { check(false, 'the grade comparison: ' + String(e.message).slice(0, 200)); }
}
// x-top · the before/after sheet: (the old film at the same moment ·) x-top off · x-top on, German captions
if (xFiles.length) {
  const OLD = process.env.OLD || '';
  const rows = xFiles.map((c) => {
    const imgs = [];
    if (OLD && fs.existsSync(OLD)) {
      const t = plan.slice(0, c.si).reduce((a, p) => a + p.dur, 0) + plan[c.si].dur * 0.6, f = FR + 'old_' + c.si + '.jpg';
      try { execFileSync('/usr/local/bin/ffmpeg', ['-y', '-v', 'error', '-ss', String(t), '-i', OLD, '-frames:v', '1', '-q:v', '2', f]); imgs.push(f); } catch (e) { console.log('  old frame: ' + String(e.message).slice(0, 120)); }
    }
    imgs.push(c.off, c.on);
    return { label: (c.si + 1) + ' · ' + (c.cap || '') + ' — ' + (imgs.length > 2 ? 'alter Trailer (Hoch, 75 %) · ' : '') + 'Ultra ohne Spitzenbild · Ultra mit Tiefe + Klarheit', imgs };
  });
  const sp = FR + 'xcmp.json'; fs.writeFileSync(sp, JSON.stringify({ w: 620, rows }));
  const out = SHOTS + (process.env.XCMP_OUT || 'top_compare.jpg');
  try { execFileSync('python3', ['/root/r9coord/pairs.py', out, sp], { stdio: 'inherit' }); check(fs.existsSync(out), 'the x-top comparison ' + out); } catch (e) { check(false, 'the x-top comparison: ' + String(e.message).slice(0, 200)); }
}
// the video: 12 captured fps → 24 fps (motion-interpolated), H.264 yuv420p, faststart
if (!process.env.NOVIDEO && fi > 0) {
  const mp4 = SHOTS + 'trailer_' + TAG + '.mp4', inFps = FPS / EVERY;
  const OW = +(process.env.OUT_W || 0), OH = +(process.env.OUT_H || 0), sc = OW && OH && OW !== W ? `scale=${OW}:${OH}:flags=lanczos,` : '';
  const vf = sc + (inFps < FPS ? `minterpolate=fps=${FPS}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,format=yuv420p` : 'format=yuv420p');
  try {
    execFileSync('/usr/local/bin/ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', String(inFps), '-i', FR + 'f_%05d.jpg', '-vf', vf, '-c:v', 'libx264', '-preset', 'slow', '-crf', process.env.CRF || '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', String(FPS), mp4], { stdio: 'inherit', timeout: 3000000 });
    const dur = +execFileSync(fs.existsSync('/usr/local/bin/ffprobe') ? '/usr/local/bin/ffprobe' : 'ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4]).toString().trim();
    if (music && fs.existsSync(WAV)) {   // f-film2: the music in, as AAC
      const tmp = mp4.replace(/\.mp4$/, '_v.mp4'); fs.renameSync(mp4, tmp);
      execFileSync('/usr/local/bin/ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-i', tmp, '-i', WAV, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', mp4], { stdio: 'inherit', timeout: 600000 });
      fs.rmSync(tmp, { force: true });
      const streams = execFileSync(fs.existsSync('/usr/local/bin/ffprobe') ? '/usr/local/bin/ffprobe' : 'ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', mp4]).toString();
      check(/h264/.test(streams) && /aac/.test(streams), 'the film has its music (' + streams.trim().split(/\s+/).join(' + ') + ')');
    }
    const mb = fs.statSync(mp4).size / 1048576;
    check(mb > 0.2 && mb <= 25, 'the video ' + mp4 + ' (' + mb.toFixed(1) + ' MB ≤ 25)');
    check(ONLY || (dur > 38 && dur < 52), 'about 45 s of film (' + dur.toFixed(1) + ' s)');
  } catch (e) { check(false, 'ffmpeg: ' + String(e.message).slice(0, 300)); }
}
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 10)) console.log(l);
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
