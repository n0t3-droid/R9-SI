// Lichträtsel in the browser: a daylight detector west of a pillar's foot... rather, a pillar WEST of a detector:
// the evening sun (from −x) puts it in the pillar's shadow, the morning sun (from +x +z) does not. A second detector
// in the open is the control. Each drives a lamp beside it (−z side, where the sun never comes from).
//   1 the clocks are baked round the scene
//   2 morning: both detectors give power (the control and the test alike, within 2)
//   3 evening: the control still does, the shaded one gives 0 — the Schattenuhr's shadow switches the circuit
//   4 the lamps follow; pictures test/shots/lichtraetsel.jpg (German captions)
// usage: nohup bash test/wt_run.sh daysense.mjs 1500 > .tmp_tests/daysense.log 2>&1 &
// regress: skip (pictures for the owner; the node test is test/daysense.js)
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import sharp from '/home/dev/.npm-global/lib/node_modules/sharp/lib/index.js';
import fs from 'fs';
const ROOT = new URL('../', import.meta.url).pathname, SHOTS = ROOT + 'test/shots/';
fs.mkdirSync(SHOTS, { recursive: true });
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 }, locale: 'de-DE' });
const logs = []; page.on('pageerror', e => logs.push(e.message));
await page.goto('file://' + ROOT + 'dist/index.html');
const ev = (f, a) => page.evaluate(f, a), wait = (ms) => page.waitForTimeout(ms);
for (let i = 0; i < 240; i++) { await wait(500); if (await ev(() => !!(window.VR && VR.game && VR.game.state === 'title'))) break; }
await ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.renderDist = 3; g.settings.dynRes = false; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Licht',mode:'creative',difficulty:'peaceful',type:'default',seed:'4242',cheats:true})`);
for (let i = 0; i < 300; i++) { await wait(500); if (await ev(() => VR.game.state === 'play')) break; }
check(await ev(() => VR.game.state === 'play'), 'a new world');
await ev(() => { window.requestAnimationFrame = () => 0; const g = VR.game; g.zenFreezeTime = true; g.zenFreezeWeather = true; if (g.env.wx && g.env.wx.force) g.env.wx.force('klar'); g.env.rain = 0; g.hideHud = true; });
// the scene, high in the air over the spawn: a stone floor, detector D (test) with a 2 × 2 pillar on its −x side, C (control) 8 east
const S = await ev(() => {
  const g = VR.game, w = g.world, p = g.player, R = VR.R, st = R.byName.stone.defaultState;
  const X = Math.floor(p.pos[0]), Z = Math.floor(p.pos[2]), Y = 140;
  for (let dx = -6; dx <= 14; dx++) for (let dz = -6; dz <= 6; dz++) w.setBlock(X + dx, Y - 1, Z + dz, st, 3);
  for (let dy = 0; dy < 6; dy++) for (const [dx, dz] of [[-2, 0], [-3, 0], [-2, 1], [-3, 1], [-2, -1], [-3, -1]]) w.setBlock(X + dx, Y + dy, Z + dz, st, 3);
  const det = R.byName.daylight_detector.defaultState, lamp = R.byName.volt_lamp.defaultState;
  for (const dx of [0, 8]) { w.setBlock(X + dx, Y, Z, det, 4); w.setBlock(X + dx, Y, Z - 1, lamp, 4); }
  w.flushChanged && w.flushChanged();
  return { X, Y, Z };
});
const place = () => ev((S) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(S.X + 4, S.Y + 7 - 1.62, S.Z + 12); const e = p.eyePos(), dx = S.X + 3 - e[0], dy = S.Y - e[1], dz = S.Z - e[2]; p.yaw = p.viewYaw = Math.atan2(-dx, -dz); p.pitch = Math.atan2(dy, Math.hypot(dx, dz)); }, S);
await place();
const frames = (n) => ev((n) => { const g = VR.game; for (let i = 0; i < n; i++) { g.last = performance.now() - 50; g.loop(performance.now()); } return VR.ClockVol.stats; }, n);
// the clocks of the detectors' cells
let ok = false;
for (let i = 0; i < 300 && !ok; i++) { await frames(12); if (i % 5 === 0) await place(); ok = await ev((S) => { const CV = VR.ClockVol, w = VR.game.world; return CV.visAt(w, S.X + 0.5, S.Y + 1.2, S.Z + 0.5, 0.5) !== null && CV.visAt(w, S.X + 8.5, S.Y + 1.2, S.Z + 0.5, 0.5) !== null; }, S); }
check(ok, '1 the clocks above both detectors are baked');
const at = async (tick) => {
  await ev((tick) => { const g = VR.game; g.env.setTime(tick); }, tick);
  await frames(30);   // (the sim measures once a second; 30 frames ≈ 1.5 s at 20 ticks a second)
  await ev(() => { VR.game.sim.daySenseTick(); }); await frames(10);
  return ev((S) => { const R = VR.R, w = VR.game.world, DT = R.byName.daylight_detector, L = R.byName.volt_lamp; const pw = (x) => DT.get(w.getBlock(x, S.Y, S.Z), 'power'), lit = (x) => { const s = w.getBlock(x, S.Y, S.Z - 1); return L.has('lit') ? L.get(s, 'lit') : -1; }; return { d: pw(S.X), c: pw(S.X + 8), ld: lit(S.X), lc: lit(S.X + 8) }; }, S);
};
const shot = async (name) => { const url = await ev(() => { const g = VR.game; g.last = performance.now() - 33; g.loop(performance.now()); return g.renderer.gl.canvas.toDataURL('image/png'); }); const b = Buffer.from(url.split(',')[1], 'base64'); fs.writeFileSync(SHOTS + 'licht_' + name + '.png', b); return b; };
const m = await at(1800); console.log('     morgens ' + JSON.stringify(m)); const bm = await shot('morgens');
const e = await at(10200); console.log('     abends ' + JSON.stringify(e)); const be = await shot('abends');
check(m.d > 0 && m.c > 0 && Math.abs(m.d - m.c) <= 2, `2 morning: both give power (test ${m.d}, control ${m.c})`);
check(e.c > 0 && e.d === 0, `3 evening: the control ${e.c}, the shaded one ${e.d}`);
check(m.ld === 1 && e.ld === 0 && e.lc === 1, `4 the lamps follow (test ${m.ld}→${e.ld}, control ${m.lc}→${e.lc})`);
const TW = 480, TH = 270, LAB = 26;
const label = (t) => Buffer.from(`<svg width="${TW}" height="${LAB}"><rect width="100%" height="100%" fill="#141820"/><text x="8" y="18" font-family="DejaVu Sans" font-size="15" fill="#f0e6d0">${t}</text></svg>`);
const comp = [];
for (const [i, b, t] of [[0, bm, `Morgens · beide Sensoren an (${m.d} | ${m.c})`], [1, be, `Abends · Säulenschatten: Sensor aus (${e.d} | ${e.c})`]]) {
  comp.push({ input: label(t), left: i * TW, top: 0 }, { input: await sharp(b).resize(TW, TH).toBuffer(), left: i * TW, top: LAB });
}
await sharp({ create: { width: TW * 2, height: TH + LAB, channels: 3, background: '#141820' } }).composite(comp).jpeg({ quality: 88 }).toFile(SHOTS + 'lichtraetsel.jpg');
console.log('sheet test/shots/lichtraetsel.jpg');
check(!logs.length, 'no page errors ' + logs.slice(0, 2).join(' | '));
await browser.close();
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
