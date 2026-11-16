// regress: skip — e-lampe · Lampenlicht in the browser (from sunclock.mjs)
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
// the nearest village's plaza (seed 4242: golden's plaza shot, 0 81 −54), seen from 15 m off and 16 m up
const P0 = [0.5, 81, -53.5], EYE = [P0[0] + 15, P0[1] + 16, P0[2] + 15];
const place = () => ev(([E, T]) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(E[0], E[1] - (p.eye || 1.62), E[2]); p.vel[0] = p.vel[1] = p.vel[2] = 0; const e = p.eyePos(), dx = T[0] - e[0], dy = T[1] - e[1], dz = T[2] - e[2]; p.yaw = p.viewYaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); }, [EYE, [P0[0], P0[1] + 1, P0[2]]]);
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
// e-himmel: the same view at noon and in the evening, Himmelslicht off | on (the Schattenuhr on in both)
const TIMES = [['spätabends', 12600], ['nachts', 18000]];
const grab = async (name, tick, on) => {
  await ev(([tick, on]) => { const g = VR.game; g.settings.sunclock = true; g.settings.skylight = true; g.settings.lamplight = on; g.applySettings('*'); g.env.setTime(tick); }, [tick, on]);
  await place(); await frames(8);
  const url = await ev(() => { const g = VR.game; window.__norender = false; for (let i = 0; i < 3; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } return g.renderer.gl.canvas.toDataURL('image/png'); });
  const buf = Buffer.from(url.split(',')[1], 'base64'); fs.writeFileSync(SHOTS + 'lampe_' + name + '.png', buf); return buf;
};
const raw = (b) => sharp(b).resize(320, 180, { fit: 'fill' }).removeAlpha().raw().toBuffer();
const diff = async (a, b) => { const A = await raw(a), B = await raw(b); let s = 0; for (let i = 0; i < A.length; i++) s += Math.abs(A[i] - B[i]); return s / A.length; };
const TW = 400, TH = 225, LAB = 26, comp = [];
const label = (t, w) => Buffer.from(`<svg width="${w}" height="${LAB}"><rect width="100%" height="100%" fill="#141820"/><text x="8" y="18" font-family="DejaVu Sans" font-size="15" fill="#f0e6d0">${t}</text></svg>`);
let y = 0;
for (const tier of [['vl', 'potato', 'Sehr niedrig'], ['bal', 'balanced', 'Ausgewogen']]) {
  if (tier[0] === 'bal') { await preset('balanced', 3); for (let i = 0; i < 60; i++) { st = await frames(10); if (!st.inflight && i > 10) break; } }
  let x = 0; const ds = [];
  for (const [nm, tick] of TIMES) for (const on of [false, true]) {
    const b = await grab(tier[0] + '_' + nm + (on ? '_an' : '_aus'), tick, on);
    comp.push({ input: await sharp(b).resize(TW, TH).toBuffer(), left: x * TW, top: y + LAB });
    comp.push({ input: label(`${tier[2]} · ${nm} · Lampenlicht ${on ? 'AN' : 'aus'}`, TW), left: x * TW, top: y });
    if (on) ds.push(await diff(ds.last, b)); else ds.last = b;
    x++;
  }
  check(ds.every(d => d > 0.8), `${tier[2]}: Lampenlicht changes the picture (mean |Δ| ${ds.map(d => d.toFixed(1)).join(' · ')})`);
  y += TH + LAB;
}
await sharp({ create: { width: TW * 4, height: y, channels: 3, background: { r: 20, g: 24, b: 32 } } }).composite(comp).jpeg({ quality: 86 }).toFile(SHOTS + 'lampe_compare.jpg');
console.log('sheet test/shots/lampe_compare.jpg');
console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 10)) console.log(l);
check(!logs.some(l => /pageerror/.test(l)), 'no page errors');
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
