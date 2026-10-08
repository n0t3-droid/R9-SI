// Trailer sky and clouds (t-clouds): four shots framed like the trailer, photographed at the game's own camera (vertical
// fov 72° at 720 px, as classic_v2.mjs) and written to test/shots/trailer_sky_<shot>_<TAG>.png:
//   vista    tod 6000  noon     · the ringed gas giant (lilac, ring at a slant) over the Ember Canyon      (trailer t1_03)
//   citadel  tod 11700 dusk     · cumulus wrapped round the Spire Citadel's spires, nebula, the planets     (t1_03, t3_02)
//   isles    tod 12000 sunset   · the Sky Isles with the fog band under the islands, cumulus, cirrus       (t1_07, t1_09)
//   city     tod 18000 midnight · the Palm City under the full nebula, stars and moons (the F shot; the frame set
//                                 has no city frame: t2_14 is the Hangar Hall)
// Checks: the four pictures, no page errors, and the new parts where they exist: the cloud module, the sky-body module,
// the puffs drawn at the current quality, the fog band. Then the Very Low frame time: the median of 4 blocks of 3 frames
// on the vista (GPU-bound under SwiftShader, so only the relative numbers between two builds mean something).
// TAG (default after) names the pictures; DIST (default the dist/ of this checkout) is the build under test, e.g. the
// copy of the baseline build at .tmp_tests/dist_before/index.html.
// usage: TAG=before DIST=<path> nohup bash test/wt_run.sh trailer_sky.mjs 1800 > .tmp_tests/trailer_sky.log 2>&1 &
import { chromium } from '/home/claude/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const TAG = process.env.TAG || 'after';
const DIST = process.env.DIST || '/home/claude/vr/dist/index.html';
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => { const t = m.type(); const s = m.text(); if (t === 'error' || /error|fail|missing/i.test(s)) logs.push(`[${t}] ${s.slice(0, 700)}`); });
page.on('pageerror', e => logs.push('[pageerror] ' + (e.stack || e.message).slice(0, 1500)));
await page.goto('file://' + DIST);
const wait = (ms) => page.waitForTimeout(ms);
const ev = (fn, arg) => page.evaluate(fn, arg);
const step = async (n, dtms = 16) => { for (let k = 0; k < n; k += 10) { await ev(([m, d]) => { const g = VR.game; if (!g.renderer._render) { g.renderer._render = g.renderer.render; g.renderer.render = function (F) { if (window.__norender) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__norender = true; for (let i = 0; i < m; i++) { g.last = performance.now() - d; g.loop(performance.now()); } }, [Math.min(10, n - k), dtms]); await wait(4); } };
const settle = async (max = 60) => { for (let i = 0; i < max; i++) { await step(10); const s = await ev(() => { const g = VR.game; let dirty = 0; for (const c of g.world.cols.values()) for (const sc of c.sec) if (sc.dirty || sc.pending) dirty++; return { busy: g.pool.busy, pend: g.world.pending.size, dirty }; }); if (s.busy === 0 && s.pend === 0 && s.dirty === 0 && i > 2) break; await wait(60); } };
const shotPath = (name) => `/home/claude/vr/test/shots/${name}.png`;
const shot = async (name, frames = 3) => { await ev((frames) => { window.__norender = false; const g = VR.game; for (let i = 0; i < frames; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); window.__norender = true; }, frames); await page.screenshot({ path: shotPath(name), timeout: 240000 }); console.log('shot', name); };
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
for (let i = 0; i < 120; i++) { await wait(500); if (await ev(() => VR.game && VR.game.state === 'title')) break; }
await ev(() => { const g = VR.game; g.applyPreset('high'); g.settings.dynRes = false; g.settings.renderDist = 10; g.applySettings('*'); });
await ev(`VR.game.createWorld({name:'Trailer Sky',mode:'creative',difficulty:'peaceful',type:'default',seed:'4242',cheats:true,kit:true})`);
for (let i = 0; i < 90; i++) { await wait(1000); if (await ev(() => VR.game.state) === 'play') break; }
// the sky of the shots: clear (cover 0.2, the trailer's), time frozen at each shot's time of day, the loop driven by the test
await ev(() => { const g = VR.game; g.zenFreezeTime = true; g.zenFreezeWeather = true; g.env.wx.force('klar'); g.env.rain = 0; g.env.rainTarget = 0; window.requestAnimationFrame = () => 0; g.hideHud = true; const h = document.getElementById('hud'); if (h) h.style.display = 'none'; });

// a look direction from a camera position and a target point: yaw 0 looks along −z, as in the game (player.lookDir)
const aim = (from, to) => { const dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2]; return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) }; };
const place = (cam, yaw, pitch, tod) => ev(([cam, yaw, pitch, tod]) => { const g = VR.game, p = g.player; g.env.setTime(tod); p.flying = true; p.noclip = true; p.teleport(cam[0], cam[1] - p.eye, cam[2]); p.yaw = yaw; p.pitch = pitch; p.fovKick = 0; p.vel = [0, 0, 0]; }, [cam, yaw, pitch, tod]);
const shotAt = async (name, cam, look, tod) => {
  const a = aim(cam, look);
  await place(cam, a.yaw, a.pitch, tod);
  await settle(40);
  await ev(() => { const e = VR.game.entities; if (e && e.mobs) e.mobs.length = 0; });
  await step(6);
  await shot(`trailer_sky_${name}_${TAG}`, 3);
};
// the gas giant's direction at a time of day: the game's own formula (env.js) — the ringed giant circles the sky at ~33°
const giantDir = (tod) => { const th = tod / 24000 * 2 * Math.PI, pa = th * 0.5 + 0.55; const v = [Math.cos(pa) * 0.84, 0.55, Math.sin(pa) * 0.84]; const l = Math.hypot(...v); return v.map(c => c / l); };
// the vista: from the canyon's rim, the giant to the right of centre and in the upper fifth of the frame (trailer t1_03)
const VISTA = { cam: [-60, 150, 260] };
{
  const P = giantDir(6000), a = -0.2, c = Math.cos(a), s = Math.sin(a);
  const D = [c * P[0] - s * P[2], 0.21, s * P[0] + c * P[2]];
  VISTA.look = [VISTA.cam[0] + D[0] * 1000, VISTA.cam[1] + D[1] * 1000, VISTA.cam[2] + D[2] * 1000];
}

console.log('== the four shots (' + TAG + ')');
await shotAt('vista', VISTA.cam, VISTA.look, 6000);
await shotAt('citadel', [-372, 204, 440], [-420, 206, 380], 11700);
await shotAt('isles', [140, 190, 320], [270, 160, 200], 12000);
await shotAt('city', [0, 100, -118], [0, 92, -300], 18000);

// the features that exist in this build (the parts of the brief that are code, not pictures)
const feat = await ev(() => {
  const g = VR.game, R = g.renderer;
  return { clouds: !!(VR.Clouds && VR.Clouds.field), bodies: !!(VR.SkyBodies && VR.SkyBodies.at), puffs: R.puffCount || 0, cloudsQ: R.q.clouds, fog: !!(R.fogBandCount) };
});
console.log('features ' + JSON.stringify(feat));
for (const n of ['vista', 'citadel', 'isles', 'city']) {
  const f = shotPath(`trailer_sky_${n}_${TAG}`);
  check(fs.existsSync(f) && fs.statSync(f).size > 20000, `picture ${n} written (${TAG})`);
}
check(logs.filter(l => l.startsWith('[pageerror]') || l.startsWith('[error]')).length === 0, 'no page or WebGL errors');
check(feat.clouds, 'cloud module (VR.Clouds.field) loaded');
check(feat.bodies, 'sky-body module (VR.SkyBodies.at) loaded');
check(feat.cloudsQ >= 2 ? feat.puffs > 0 : true, 'puffs drawn on balanced and above');

// Very Low: the same vista, 4 blocks of 3 frames, the median frame time (the loop with the drawing on)
await ev(() => { const g = VR.game; g.applyPreset('potato'); g.settings.dynRes = false; g.applySettings('*'); });
await place(VISTA.cam, aim(VISTA.cam, VISTA.look).yaw, aim(VISTA.cam, VISTA.look).pitch, 6000);
await settle(40); await step(6);
const ms = [];
for (let b = 0; b < 4; b++) {
  ms.push(await ev(() => { const g = VR.game; window.__norender = false; const t0 = performance.now(); for (let i = 0; i < 3; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } g.renderer.gl.finish(); const dt = (performance.now() - t0) / 3; window.__norender = true; return dt; }));
}
ms.sort((a, b) => a - b);
const median = (ms[1] + ms[2]) / 2;
console.log('potato ' + JSON.stringify({ tag: TAG, ms: ms.map(v => +v.toFixed(1)), median: +median.toFixed(1), clouds: 1 }));
check(Number.isFinite(median) && median > 0, 'Very Low frame time measured');
await shotAt('vista_potato', VISTA.cam, VISTA.look, 6000).catch(() => {});

console.log('--- logs (' + logs.length + ')'); for (const l of logs.slice(0, 12)) console.log(l);
await browser.close();
console.log(fails === 0 ? 'ALL OK' : 'FAILED ' + fails);
