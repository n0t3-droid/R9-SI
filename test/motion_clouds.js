// t-motion · step 4 (docs/superpowers/plans/2026-10-15-t-motion.md): the clouds. The cloud-shadow mask (clouds.js
// shadowMask) is dark under the cumulus' hearts and clear between them, follows the drift (a point's shadow moves
// downwind with its cloud), its strength follows the sun and the cover (none at night, none under an overcast sky), its
// cost tier is Balanced and up (a 128² byte mask, one texture read a terrain pixel) and the shaders read it the way this
// test does (the world point's way to the sun meets the cloud layer at y 210). The drift follows the wind's heading; the
// cirrus far up drift at a fifth of the cumulus' angular speed. Node only.   bash test/wt_run.sh motion_clouds.js
const V = require('./load_shared.js');
require('../src/main/clouds.js');
require('../src/main/shaders.js');
const C = VR.Clouds, S = C.SHADOW;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };

// ---- 1. the mask: dark under the clouds' hearts, clear between them
console.log('the mask');
const N = S.n, T = S.texel, cover = 0.5, cx = 1000, cz = -400;
const mask = C.shadowMask(cx, cz, cover);
// the cost of a rebuild (warm, the median of 7 at neighbouring spots: what a flight over the land pays every 64 blocks)
const msl = []; const tmp = new Uint8Array(N * N);
for (let k = 0; k < 7; k++) { const t0 = process.hrtime.bigint(); C.shadowMask(cx + (k + 1) * 64, cz, cover, tmp); msl.push(Number(process.hrtime.bigint() - t0) / 1e6); }
const ms = msl.sort((a, b) => a - b)[3];
check(mask.length === N * N && N * N <= 128 * 128, `a ${N}² byte mask over ${N * T} blocks (${(mask.length / 1024).toFixed(0)} KB)`);
check(ms < 25, `a rebuild costs ${ms.toFixed(1)} ms (the median of 7; once per 64 blocks of travel or a new cover)`);
const x0 = cx - N * T / 2, z0 = cz - N * T / 2;
const at = (x, z) => { const i = Math.floor((x - x0) / T), j = Math.floor((z - z0) / T); return i < 0 || j < 0 || i >= N || j >= N ? 255 : mask[j * N + i]; };
// the clouds of the cells in the mask: under a heart dark, far from every cloud clear
let hearts = 0, dark = 0, far = 0, clear = 0;
const sprites = [];
// (the cells round the mask by one cell more: a cloud whose cell lies outside may still reach in)
for (let gz = Math.floor((z0 - C.CELL) / C.CELL); gz <= Math.floor((z0 + N * T + C.CELL) / C.CELL); gz++) for (let gx = Math.floor((x0 - C.CELL) / C.CELL); gx <= Math.floor((x0 + N * T + C.CELL) / C.CELL); gx++) if (C.cellOn(gx, gz, cover)) for (const sp of C.cumulusCell(gx, gz, cover)) sprites.push(sp);
for (const sp of sprites) { if (sp[0] - x0 < 40 || sp[2] - z0 < 40 || x0 + N * T - sp[0] < 40 || z0 + N * T - sp[2] < 40) continue; if (sp === sprites.find(q => q[0] === sp[0])) { hearts++; if (at(sp[0], sp[2]) < 0.4 * 255) dark++; } }
for (let k = 0; k < 400; k++) { const x = x0 + 20 + ((k * 37) % 97) / 97 * (N * T - 40), z = z0 + 20 + ((k * 53) % 89) / 89 * (N * T - 40); if (sprites.every(sp => Math.hypot(sp[0] - x, sp[2] - z) > sp[3] * S.body + T)) { far++;   // (a texel's centre lies within T·0.71 of the point)
 if (at(x, z) === 255) clear++; } }
check(hearts > 5 && dark === hearts, `under every cloud's heart the mask is dark (< 0.4): ${dark} of ${hearts}`);
check(far > 20 && clear === far, `away from every cloud it is clear: ${clear} of ${far} points`);
const mean = (m) => m.reduce((a, b) => a + b, 0) / m.length / 255;
const cl = C.shadowMask(cx, cz, 0.2), ov = C.shadowMask(cx, cz, 0.95);
check(mean(cl) > mean(mask) && mean(mask) > mean(ov), `more cover, more shade: clear 0.2 → ${mean(cl).toFixed(2)}, 0.5 → ${mean(mask).toFixed(2)}, 0.95 → ${mean(ov).toFixed(2)} (the mean of the mask)`);

// ---- 2. the strength: the sun up, an open sky
console.log('strength');
check(C.shadowStrength(-0.2, 0.3) === 0 && C.shadowStrength(0.02, 0.3) === 0, 'no cloud shadow at night or with the sun on the horizon');
check(Math.abs(C.shadowStrength(0.3, 0.3) - 0.55) < 1e-9, 'with the sun up the shadows darken the sun light to 45 % at most');
check(C.shadowStrength(0.3, 1.0) === 0 && C.shadowStrength(0.3, 0.8) < C.shadowStrength(0.3, 0.5), 'an overcast sky casts no shadow of its own');

// ---- 3. the shaders read it as this test does, and the shadow moves with its cloud
console.log('the lookup and the drift');
const sky = VR.SHADERS.TERRAIN_FS;
check(sky.includes('float cloudShadow(vec3 wp)') && sky.includes('(210.0 - wp.y) / max(u_sunDir.y, 0.12)') && /#ifdef CLOUDSH\s*\n\s*sh \*= cloudShadow\(v_localPos \+ vec3\(u_camInt\)\);/.test(sky), 'TERRAIN_FS: cloudShadow(world position) projects to the cloud layer at y 210 and is multiplied into the sun visibility once (marked, under CLOUDSH)');
// the same lookup in JS: the mask's origin is the build centre less half its size, less the drift
const sample = (m, M, sun, wx, wy, wz) => { const px = wx + sun[0] * (210 - wy) / Math.max(sun[1], 0.12), pz = wz + sun[2] * (210 - wy) / Math.max(sun[1], 0.12); const u = (px - M[0]) * M[2], v = (pz - M[1]) * M[2]; const i = Math.floor(u * N), j = Math.floor(v * N); const b = i < 0 || j < 0 || i >= N || j >= N ? 255 : m[j * N + i]; return 1 - M[3] * (1 - b / 255); };
const sun = [0.4, 0.5, 0.2], sl = Math.hypot(...sun); for (let k = 0; k < 3; k++) sun[k] /= sl;
const drift0 = [0, 0], drift1 = [120, 0], camX = 1000, camZ = -400;
const m0 = C.shadowMask(camX + drift0[0], camZ + drift0[1], cover);
const M0 = [camX + drift0[0] - N * T / 2 - drift0[0], camZ + drift0[1] - N * T / 2 - drift0[1], 1 / (N * T), 0.55];
const M1 = [camX + drift0[0] - N * T / 2 - drift1[0], camZ + drift0[1] - N * T / 2 - drift1[1], 1 / (N * T), 0.55];   // (the same mask, the drift moved on: no rebuild)
// a cloud in cloud space, its shadow on the ground (y 80) at drift 0 and at drift 120
const sp = sprites.find(q => Math.abs(q[0] - camX) < 200 && Math.abs(q[2] - camZ) < 200) || sprites[0];
const ground = (cxs, czs, dr) => [cxs - dr[0] - sun[0] * (210 - 80) / sun[1], czs - dr[1] - sun[2] * (210 - 80) / sun[1]];
const g0 = ground(sp[0], sp[2], drift0), g1 = ground(sp[0], sp[2], drift1);
check(sample(m0, M0, sun, g0[0], 80, g0[1]) < 0.85, `the shadow of a cloud lies where the sun's ray through it meets the ground (${sample(m0, M0, sun, g0[0], 80, g0[1]).toFixed(2)} of the sun there)`);
check(sample(m0, M1, sun, g1[0], 80, g1[1]) < 0.85 && Math.abs(sample(m0, M1, sun, g1[0], 80, g1[1]) - sample(m0, M0, sun, g0[0], 80, g0[1])) < 1e-9, 'when the clouds drift 120 blocks the shadow moves with its cloud (the origin moves, the mask stays)');
check(Math.abs(g1[0] - g0[0] + 120) < 1e-9, 'the shadow moved downwind by the drift');

// ---- 4. the cost tier: Balanced and up
console.log('cost tier');
global.document = { getElementById: () => null };   // (game.js reads the presets in its module scope only)
let presets = null;
try { const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'main', 'game.js'), 'utf8'); const m = src.match(/for \(const p in PRESETS\) \{ PRESETS\[p\]\.motion = (.*?); \}/); presets = m ? m[0] : null; } catch (e) { /* none */ }
check(!!presets && /cloudShadow = p === 'potato' \|\| p === 'low' \? 0 : 1/.test(presets) && /motion = p === 'potato' \? 0 : 1/.test(presets) && /wxDrama = p === 'potato' \? 0 : 1/.test(presets), 'the presets: cloud shadows from Balanced up, the wind and the weather from Low up, Very Low none of them');
const RS = require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'main', 'renderer.js'), 'utf8');
check(/on = this\.q\.cloudShadow && this\.q\.clouds >= 2/.test(RS), 'the mask is built only where the clouds are sprites (clouds 2: Balanced and up)');

// ---- 5. the drift follows the wind; the cirrus far up, slow
console.log('drift');
// (the real Env: the first browser run found E.windDir undefined — env.js read it off the weather's eased visuals, which
// have none — and the drift threw on it; here the env's own frame is run with a seeded weather)
require('../src/main/skybodies.js'); require('../src/main/weather.js'); require('../src/main/env.js');
{
  const Env = VR.Env, en = new Env(), o = { dim: 'overworld', biome: null, eyeSky: 1, wetOn: true, lowK: 0, freezeWeather: false, freezeTime: false, motion: true, drama: true };
  en.wx.setSeed(53); en.setTime(6000);
  let threw = null; try { for (let i = 0; i < 50; i++) en.update(0.1, o); } catch (e) { threw = e; }
  const E = en.E, wd = E.windDir, g0 = E.gust;
  check(!threw && wd && Math.abs(Math.hypot(wd[0], wd[1]) - 1) < 1e-9 && wd[0] === en.wx.windDir[0] && wd[1] === en.wx.windDir[1] && Number.isFinite(g0) && g0 === en.wx.gust, `the env hands on the weather's wind: E.windDir (${wd ? wd.map(v => v.toFixed(3)).join(', ') : 'undefined'}) is the weather's heading, E.gust (${g0}) its gust${threw ? ' — threw ' + threw.message : ''}`);
  const c0 = E.cloudDrift.slice(); for (let i = 0; i < 100; i++) en.update(0.1, o);
  const d = [E.cloudDrift[0] - c0[0], E.cloudDrift[1] - c0[1]], dl = Math.hypot(d[0], d[1]);
  check(dl > 5 && (d[0] * E.windDir[0] + d[1] * E.windDir[1]) / dl > 0.99, `the clouds drift along the wind's heading (env.js cloudDrift: ${dl.toFixed(1)} blocks in 10 s)`);
  const en2 = new Env(); en2.wx.setSeed(53); for (let i = 0; i < 5; i++) en2.update(0.1, Object.assign({}, o, { motion: false }));
  check(en2.E.cloudDrift === null, 'without the switch no drift of its own (the old +x drift by the clock)');
}
check(/dr\[0\] \/ 4000/.test(RS), 'the cirrus drift at 1/4000 of the drift in their noise space (far above: a fifth of the cumulus\' angular speed)');

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
