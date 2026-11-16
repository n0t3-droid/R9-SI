// e-uhr · Schattenuhr in the browser (src/main/clockvol.js, sunclock.js): a new world (seed 4242), Very Low and
// Balanced, the eye 14 m over the spawn looking down at the land; the clock volume fills in the background, then the
// same view at three hours (s 0.15 · 0.5 · 0.85) with the Schattenuhr off | on.
//   1 the workers baked sections and the renderer uploaded them; no page errors
//   2 on Very Low the picture with the Schattenuhr differs from the one without (shadows where there were none)
//   3 the shadows move: the morning's and the evening's pictures differ where the clock is on
//   4 the sheet test/shots/uhr_compare.jpg (German captions)
// usage: nohup bash test/wt_run.sh sunclock.mjs 1500 > .tmp_tests/sunclock.log 2>&1 &
// regress: skip (pictures for the owner; the node test is test/sunclock.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import sharp from '/home/dev/.npm-global/lib/node_modules/sharp/lib/index.js';
import fs from 'fs';
const ROOT = new URL('../', import.meta.url).pathname;
const SHOTS = ROOT + 'test/shots/';
fs.mkdirSync(SHOTS, { recursive: true });
const W = 640, H = 360;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, locale: 'de-DE' });
await page.addInitScript(() => { let a = 0x9e3779b9; Math.random = function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; });
const logs = [];
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 900)));
page.on('console', m => { if (m.type() === 'error' || /clockvol/.test(m.text())) logs.push('[' + m.type() + '] ' + m.text().slice(0, 400)); });
await page.goto('file://' + ROOT + 'dist/index.html');
const ev = (fn, a) => page.evaluate(fn, a);
const wait = (ms) => page.waitForTimeout(ms);
for (let i = 0; i < 240; i++) { await wait(500); if (await ev(() => !!(window.VR && VR.game && VR.game.state === 'title'))) break; }
const preset = (p, rd) => ev(([p, rd]) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.renderDist = rd; g.settings.particles = false; g.applySettings('*'); }, [p, rd]);
await preset('potato', 4);
await ev(`VR.game.createWorld({name:'Uhr',mode:'creative',difficulty:'peaceful',type:'default',seed:'4242',cheats:true,kit:true})`);
for (let i = 0; i < 300; i++) { await wait(500); if (await ev(() => VR.game.state === 'play')) break; }
check(await ev(() => VR.game.state === 'play'), 'a new world');
await ev(() => { window.requestAnimationFrame = () => 0; const g = VR.game; g.zenFreezeTime = true; g.zenFreezeWeather = true; if (g.env.wx && g.env.wx.force) g.env.wx.force('klar'); g.env.rain = 0; g.env.rainTarget = 0; g.hideHud = true; g.settings.fov = 75; });
// the eye over the spawn, looking down at the land
const spawn = await ev(() => { const p = VR.game.player; return p.pos.slice().concat([p.yaw]); });
// (the land away from the gate hall: 170 m out, over the ground there once it has loaded)
const AT = [spawn[0] + Math.sin(spawn[3]) * -170, spawn[2] + Math.cos(spawn[3]) * -170];
const place = () => ev(([s, A]) => { const g = VR.game, p = g.player, w = g.world, X = Math.floor(A[0]), Z = Math.floor(A[1]); const gy = w.isLoaded(X, Z) ? w.topAt(X, Z) : s[1]; p.flying = true; p.noclip = true; p.teleport(A[0], gy + 15, A[1]); p.vel[0] = p.vel[1] = p.vel[2] = 0; p.yaw = p.viewYaw = s[3] + Math.PI; p.pitch = -0.5; }, [spawn, AT]);
await place();
// frames, drawn (the clock volume is filled from the renderer's frame)
const frames = (n, draw) => ev(([n, draw]) => { const g = VR.game, r = g.renderer;
  if (!r._render) { r._render = r.render; r.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); this.cam = this.cam || F.cam; this.updateClockVol(g.world); return; } return this._render(F); }; }
  window.__norender = !draw;
  for (let i = 0; i < n; i++) { g.last = performance.now() - 33; g.loop(performance.now()); }
  window.__norender = false; return VR.ClockVol ? Object.assign({ inflight: VR.ClockVol.inflight | 0 }, VR.ClockVol.stats) : null; }, [n, !!draw]);
let st = null;
const t0 = Date.now();
for (let i = 0; i < 400; i++) { await frames(2, true); st = await frames(16); if (i % 5 === 0) await place(); if (i % 10 === 0) console.log('     … ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s ' + JSON.stringify(st) + ' mesh ' + await ev(() => VR.game.world.meshInflight | 0)); if (st && st.baked >= 50 && !st.inflight && i > 20) break; if (Date.now() - t0 > 420000) break; }
console.log('  clock volume: ' + JSON.stringify(st));
check(st && st.baked > 20 && st.up > 20, `1 the workers baked sections (${st && st.baked}, ${st && (st.ms / Math.max(1, st.baked)).toFixed(1)} ms each) and the renderer uploaded them (${st && st.up})`);
const TIMES = [['morgens', 1800], ['mittags', 6000], ['abends', 10200]];
const grab = async (name, tick, on) => {
  await ev(([tick, on]) => { const g = VR.game; g.settings.sunclock = on; g.applySettings('*'); g.env.setTime(tick); }, [tick, on]);
  await place(); await frames(8);
  const url = await ev(() => { const g = VR.game; window.__norender = false; for (let i = 0; i < 3; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } return g.renderer.gl.canvas.toDataURL('image/png'); });
  const buf = Buffer.from(url.split(',')[1], 'base64'); fs.writeFileSync(SHOTS + 'uhr_' + name + '.png', buf); return buf;
};
const raw = (b) => sharp(b).resize(320, 180, { fit: 'fill' }).removeAlpha().raw().toBuffer();
const diff = async (a, b) => { const A = await raw(a), B = await raw(b); let s = 0; for (let i = 0; i < A.length; i++) s += Math.abs(A[i] - B[i]); return s / A.length; };
const sheet = [];
for (const tier of [['vl', 'potato', 'Sehr niedrig'], ['bal', 'balanced', 'Ausgewogen']]) {
  if (tier[0] === 'bal') { await preset('balanced', 3); for (let i = 0; i < 60; i++) { st = await frames(10); if (!st.inflight && i > 10) break; } }
  const row = [];
  for (const [nm, tick] of TIMES) {
    const off = await grab(tier[0] + '_' + nm + '_aus', tick, false), on = await grab(tier[0] + '_' + nm + '_an', tick, true);
    row.push({ nm, off, on, d: await diff(off, on) });
  }
  const dm = row.map(r => r.d.toFixed(1)).join(' · ');
  if (tier[0] === 'vl') check(row.some(r => r.d > 1.5), '2 Very Low: the Schattenuhr changes the picture (mean |Δ| ' + dm + ')');
  else console.log('     Balanced: off vs on, mean |Δ| ' + dm);
  if (tier[0] === 'vl') { const m = await diff(row[0].on, row[2].on); check(m > 2, '3 the shadows move: morning vs evening with the clock (mean |Δ| ' + m.toFixed(1) + ')'); }
  sheet.push([tier[2], row]);
}
// the sheet: per tier two rows (aus / an), three hours
const TW = 400, TH = 225, LAB = 26, comp = [];
const label = (t, w) => Buffer.from(`<svg width="${w}" height="${LAB}"><rect width="100%" height="100%" fill="#141820"/><text x="8" y="18" font-family="DejaVu Sans" font-size="15" fill="#f0e6d0">${t}</text></svg>`);
let y = 0;
for (const [tn, row] of sheet) {
  for (const which of ['off', 'on']) {
    for (let i = 0; i < row.length; i++) {
      comp.push({ input: await sharp(row[i][which]).resize(TW, TH).toBuffer(), left: i * TW, top: y + LAB });
      comp.push({ input: label(`${tn} · ${row[i].nm} · Schattenuhr ${which === 'on' ? 'AN' : 'aus'}`, TW), left: i * TW, top: y });
    }
    y += TH + LAB;
  }
}
await sharp({ create: { width: TW * 3, height: y, channels: 3, background: { r: 20, g: 24, b: 32 } } }).composite(comp).jpeg({ quality: 86 }).toFile(SHOTS + 'uhr_compare.jpg');
console.log('sheet test/shots/uhr_compare.jpg');
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 10)) console.log(l);
check(!logs.some(l => /pageerror/.test(l)), 'no page errors');
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
