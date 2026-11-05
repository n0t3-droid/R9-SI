// regress: skip (hours on SwiftShader — run by hand)
// t-film · the 'welt' trailer as a video (docs/superpowers/plans/2026-11-05-t-film.md). A throwaway Heartland world
// (seed 4242, Abenteuer on, encounters off: the freeing is staged), German UI, PRESET=high on SwiftShader. The game is
// stepped at a fixed 1/24 s; every EVERY-th frame of a running shot is drawn and photographed with its letterbox, the
// captions and the BEFREIT banner (page.screenshot); ffmpeg turns the frames into test/shots/trailer_welt.mp4 (H.264,
// yuv420p, faststart, 24 fps — motion-interpolated from the 12 captured), and one frame per shot (at 60 %) goes on the
// contact sheet test/shots/trailer_welt_sheet.jpg with its German caption. Silent: the music is WebAudio played live
// (no offline render of the game's own score exists yet).
// Env: W, H (1280 × 720) · EVERY (2) · ONLY=3,5 (those shots only: a test capture) · TAG (the output's name: welt)
//      SEED (4242) · NOVIDEO=1 (frames and sheet only)
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
fs.rmSync(FR, { recursive: true, force: true }); fs.mkdirSync(FR, { recursive: true }); fs.mkdirSync(SHOTS, { recursive: true });
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
await ev((p) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.renderDist = 12; g.settings.horizon = 2; g.settings.wildHeart = true; g.applySettings('*'); }, process.env.PRESET || 'high');
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
const step = (n) => ev(([m, d]) => { const g = VR.game; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [n, DT]);
const state = () => ev(() => { const g = VR.game, d = g.director; const s = d.shots && d.shots[d.si]; return { active: d.active, si: d.si, phase: d.phase, t: +d.t.toFixed(3), name: s && s.name, cap: s && s.caption, n: d.shots ? d.shots.length : 0, dur: s && s.dur }; });
// settle the start: chunks round the spawn
for (let i = 0; i < 60; i++) { await step(10); await wait(60); }
console.log('play', await ev(() => VR.game.director.play('welt', { stage: true })), el());
for (let i = 0; i < 100; i++) { await wait(200); if (await ev(() => VR.game.director.active)) break; }
let st = await state();
check(st.active && st.n >= 8, 'the welt trailer runs (' + st.n + ' shots)');
const plan = await ev(() => VR.game.director.shots.map((s) => ({ name: s.name, dur: s.dur, cap: s.caption, stage: s.stage || '', at: s.anchor ? s.anchor.map(Math.round) : null })));
console.log(JSON.stringify(plan));
// a test capture: jump to the first wanted shot
if (ONLY) await ev((k) => { VR.game.director.si = k - 1; }, ONLY[0]);
let fi = 0, simF = 0;
const frames = [], perShot = {}, ms = [];
let guard = 0;
while (guard++ < 40000) {
  st = await state();
  if (!st.active) break;
  if (ONLY && !ONLY.includes(st.si)) {
    const nx = ONLY.find((k) => k > st.si); if (nx === undefined) { await ev(() => VR.game.director.stop()); break; }
    await ev((k) => { const d = VR.game.director; d.si = k - 1; d.phase = 'next'; }, nx); continue;
  }
  if (st.phase !== 'run') { await step(4); await wait(30); continue; }
  // a running shot: one simulated frame; every EVERY-th one drawn and photographed
  if (simF % EVERY === 0) {
    const t0 = Date.now();
    await ev((d) => { window.__norender = false; const g = VR.game; g.last = performance.now() - d; g.loop(performance.now()); g.renderer.gl.finish(); window.__norender = true; }, DT);
    const file = FR + 'f_' + String(fi).padStart(5, '0') + '.jpg';
    await page.screenshot({ path: file, type: 'jpeg', quality: 92, timeout: 300000 });
    ms.push(Date.now() - t0);
    frames.push({ i: fi, si: st.si, name: st.name, t: st.t, cap: st.cap });
    (perShot[st.si] = perShot[st.si] || []).push({ file, t: st.t, dur: st.dur, cap: st.cap, name: st.name });
    if (fi % 24 === 0) console.log(`  frame ${fi} · shot ${st.si} ${st.name} t ${st.t.toFixed(2)} · ${ms[ms.length - 1]} ms · ${el()}`);
    fi++;
  } else await step(1);
  simF++;
}
console.log('captured', fi, 'frames in', el(), '· median', ms.slice().sort((a, b) => a - b)[ms.length >> 1] || 0, 'ms a frame');
fs.writeFileSync(FR + 'frames.json', JSON.stringify(frames));
const shotsSeen = Object.keys(perShot).length;
check(shotsSeen === (ONLY ? ONLY.length : plan.length), 'every shot photographed (' + shotsSeen + ')');
const freed = await ev(() => { const L = VR.Liberate; return L ? [...L.sites().values()].some((s) => s.st === 'frei') : false; });
if (!ONLY || ONLY.includes(plan.findIndex((p) => p.stage === 'liberate'))) check(freed, 'the outpost was freed in its shot (BEFREIT)');
await browser.close();

// the contact sheet: one frame per shot at 60 % of it, with its German caption
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
try { console.log(execFileSync('python3', ['-c', py, JSON.stringify(pick), sheet]).toString().trim()); check(fs.existsSync(sheet), 'the contact sheet ' + sheet); } catch (e) { check(false, 'the contact sheet: ' + String(e.message).slice(0, 200)); }
// the video: 12 captured fps → 24 fps (motion-interpolated), H.264 yuv420p, faststart
if (!process.env.NOVIDEO && fi > 0) {
  const mp4 = SHOTS + 'trailer_' + TAG + '.mp4', inFps = FPS / EVERY;
  const vf = inFps < FPS ? `minterpolate=fps=${FPS}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1,format=yuv420p` : 'format=yuv420p';
  try {
    execFileSync('/usr/local/bin/ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', String(inFps), '-i', FR + 'f_%05d.jpg', '-vf', vf, '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-r', String(FPS), mp4], { stdio: 'inherit', timeout: 3000000 });
    const mb = fs.statSync(mp4).size / 1048576, dur = +execFileSync('/usr/local/bin/ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4]).toString().trim();
    check(mb > 0.2 && mb <= 25, 'the video ' + mp4 + ' (' + mb.toFixed(1) + ' MB ≤ 25)');
    check(ONLY || (dur > 38 && dur < 52), 'about 45 s of film (' + dur.toFixed(1) + ' s)');
  } catch (e) { check(false, 'ffmpeg: ' + String(e.message).slice(0, 300)); }
}
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 10)) console.log(l);
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
