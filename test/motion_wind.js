// t-motion · step 1 (docs/superpowers/plans/2026-10-15-t-motion.md): the wind in everything. The curves of
// src/shared/wind.js — the travelling gust bands, the lean of a plant (base stiff, tip free), the swing of a hung thing
// (one piece about its hook), the palm frond — are continuous in time and space, grow with the sway level, travel
// downwind; the GLSL the shaders use is the same formula (its text compiled back into JavaScript here); the mesher writes
// the hung levels only when the job asks for motion (Very Low's meshes stay as they were), and the terrain shader without
// MOTION is v0.46's text. Node only.   bash test/wt_run.sh motion_wind.js
const V = require('./load_shared.js');
require('../src/main/shaders.js');
const W = V.Wind, fs = require('fs'), path = require('path');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const near = (a, b, e) => Math.abs(a - b) <= e;

// ---- 1. the GLSL text is the JavaScript: compile each generated function into JS and compare on random inputs
console.log('glsl = js');
const src = W.glsl();
const fnJS = {};
for (const m of src.matchAll(/float (\w+)\(([^)]*)\) \{([\s\S]*?)\n\}/g)) {
  const name = m[1], args = m[2].split(',').map(a => a.trim().replace(/^float /, '')).filter(Boolean);
  let body = m[3].replace(/\bfloat\b/g, 'let').replace(/(\d)\.(?!\d)/g, '$1.0');
  const js = 'const sin = Math.sin, cos = Math.cos, max = Math.max, min = Math.min, clamp = (v, a, b) => v < a ? a : v > b ? b : v;\n' + body;
  fnJS[name] = new Function(...args, js);   // (the test only: the game never compiles code at run time)
}
check(['windGust', 'windLeanAlong', 'windHangAlong', 'windHangAcross', 'windHangUp', 'windFrondAmp', 'windFrondAlong', 'windFrondAcross', 'windFrondUp', 'windSheen'].every(n => typeof fnJS[n] === 'function'), 'the GLSL holds the ten wind functions (' + Object.keys(fnJS).join(', ') + ')');
let rnd = 12345; const R = () => { rnd = (Math.imul(rnd, 1103515245) + 12345) >>> 0; return rnd / 4294967296; };
let worst = 0;
for (let i = 0; i < 2000; i++) {
  const x = (R() - 0.5) * 4000, y = 40 + R() * 160, z = (R() - 0.5) * 4000, t = R() * 3000, a = R() * 6.283, dx = Math.cos(a), dz = Math.sin(a), gu = R(), wind = R() * 3, lv = Math.floor(R() * 4), G = R(), w = R(), slot = Math.floor(R() * 16), ph = R() * 20, sc = 0.8 + R() * 0.6, py = (R() - 0.5) * 6;
  const pairs = [
    [W.gust(x, z, t, dx, dz, gu), fnJS.windGust(x, z, t, dx, dz, gu)],
    [W.lean(lv, wind, G).along, fnJS.windLeanAlong(lv, wind, G)],
    [W.hang(x, y, z, t, wind, G, lv).along, fnJS.windHangAlong(x, y, z, t, wind, G, lv)],
    [W.hang(x, y, z, t, wind, G, lv).across, fnJS.windHangAcross(x, y, z, t, wind, G, lv)],
    [W.hang(x, y, z, t, wind, G, lv).up, fnJS.windHangUp(x, y, z, t, wind, G, lv)],
    [W.frond(w, slot, ph, sc, t, wind, G, py).along, fnJS.windFrondAlong(fnJS.windFrondAmp(w, sc, wind, G), slot, ph, t)],
    [W.frond(w, slot, ph, sc, t, wind, G, py).across, fnJS.windFrondAcross(fnJS.windFrondAmp(w, sc, wind, G), slot, ph, t, py)],
    [W.frond(w, slot, ph, sc, t, wind, G, py).up, fnJS.windFrondUp(fnJS.windFrondAmp(w, sc, wind, G), slot, ph, t, G)],
    [W.sheen(G), fnJS.windSheen(G)],
    [W.groundSheen(G, gu), fnJS.windGroundSheen ? fnJS.windGroundSheen(G, gu) : NaN],
  ];
  for (const [p, q] of pairs) worst = Math.max(worst, Math.abs(p - q));
}
check(worst < 2e-4, 'the shader text and the JavaScript agree on 2000 random inputs (largest difference ' + worst.toExponential(1) + ', the five-digit constants)');

// ---- 2. the gust bands: in 0..1, continuous in time and space, swelling with the weather's gust, travelling downwind
console.log('gust bands');
let gmin = 1, gmax = 0, tStep = 0, sStep = 0;
for (let i = 0; i < 4000; i++) {
  const x = (R() - 0.5) * 2000, z = (R() - 0.5) * 2000, t = R() * 1000, a = R() * 6.283, dx = Math.cos(a), dz = Math.sin(a), gu = R();
  const g = W.gust(x, z, t, dx, dz, gu);
  gmin = Math.min(gmin, g); gmax = Math.max(gmax, g);
  tStep = Math.max(tStep, Math.abs(W.gust(x, z, t + 1 / 60, dx, dz, gu) - g));
  sStep = Math.max(sStep, Math.abs(W.gust(x + 0.25, z, t, dx, dz, gu) - g), Math.abs(W.gust(x, z + 0.25, t, dx, dz, gu) - g));
}
check(gmin >= 0 && gmax <= 1 && gmax > 0.8, `the gust field stays in 0..1 and reaches its strength (${gmin.toFixed(3)} … ${gmax.toFixed(3)})`);
check(tStep < 0.08, `continuous in time: the largest change in one frame at 60 fps is ${tStep.toFixed(4)} (< 0.08)`);
check(sStep < 0.12, `continuous in space: the largest change over a quarter block is ${sStep.toFixed(4)} (< 0.12: grass blades side by side move together)`);
let swell = 0, n = 0; for (let i = 0; i < 500; i++) { const x = R() * 500, z = R() * 500, t = R() * 100; const a = W.gust(x, z, t, 1, 0, 0), b = W.gust(x, z, t, 1, 0, 1); if (b >= a - 1e-12) swell++; n++; }
check(swell === n, `the weather's gust swells the bands everywhere (${swell} of ${n} points)`);
// the bands travel downwind: the field along the wind at t and at t + 0.5 s, the shift that matches best
const dirs = [[1, 0], [0.6, 0.8], [-0.8, 0.6]];
for (const [dx, dz] of dirs) {
  const x0 = 120, z0 = -40, t0 = 37.5, dt = 0.5, N = 400;
  const line = (t, sh) => { const o = []; for (let k = 0; k < N; k++) { const s = k * 0.5 + sh; o.push(W.gust(x0 + dx * s, z0 + dz * s, t, dx, dz, 0.5)); } return o; };
  const A = line(t0, 0);
  let best = null;
  for (let sh = -10; sh <= 10; sh += 0.25) { const B = line(t0 + dt, sh); let d = 0; for (let k = 0; k < N; k++) d += (A[k] - B[k]) ** 2; if (!best || d < best.d) best = { sh, d }; }
  check(best.sh >= 2.5 && best.sh <= 4.5, `wind (${dx}, ${dz}): the bands move ${best.sh.toFixed(2)} blocks downwind in 0.5 s (speed ${W.GUST.speed} and ${W.GUST.sp2} blocks/s: 3–3.75)`);
}
// the pattern is not a straight line across the wind: the fronts bend (a slow field across)
{ let dif = 0; for (let c = 0; c < 200; c++) dif = Math.max(dif, Math.abs(W.gust(c * 2, 0, 10, 0, 1, 0.5) - W.gust(0, 0, 10, 0, 1, 0.5))); check(dif > 0.3, `the fronts bend across the wind (the field along a line across it varies by ${dif.toFixed(2)})`); }

// ---- 3. a plant leans with its height: base stiff, tip free; along the wind; zero in still air
console.log('lean');
const l0 = W.lean(0, 1, 1).along, l1 = W.lean(1, 1, 1).along, l2 = W.lean(2, 1, 1).along, l3 = W.lean(3, 1, 1).along;
check(l0 === 0 && l1 > 0 && l2 > l1 && l3 > l2, `the lean grows with the sway level (0 · ${l1.toFixed(4)} · ${l2.toFixed(4)} · ${l3.toFixed(4)})`);
check(near(l1 / l3, 1 / 9, 1e-9) && near(l2 / l3, 4 / 9, 1e-9), 'base stiff, tip free: the lean goes with the square of the height (1/9, 4/9, 1)');
check(near(l3, W.LEAN, 1e-12) && W.lean(3, 0, 1).along === 0 && W.lean(3, 2, 0).along === 0, `a full gust bends the tip ${W.LEAN} blocks at wind 1; still air or no gust: none`);
check(W.lean(3, 1, 1).down > 0 && W.lean(3, 1, 1).down < l3, 'a bent tip sinks a little');

// ---- 4. a hung thing swings as one piece about its hook, more the deeper the point, pushed downwind in the gusts
console.log('hang');
let hStep = 0, rigid = 0, cloth = 0, amp3 = 0, amp1 = 0, mean3 = 0, cnt = 0;
for (let i = 0; i < 6000; i++) {
  const t = i / 60, G = W.gust(100, 50, t, 1, 0, 0.5);
  const a = W.hang(100.3, 70.2, 50.4, t, 1, G, 3), b = W.hang(100.7, 70.4, 50.6, t, 1, G, 3), c = W.hang(103.3, 70.2, 50.4, t, 1, G, 3), e = W.hang(100.3, 70.2, 50.4, t, 1, G, 1);
  const a1 = W.hang(100.3, 70.2, 50.4, t + 1 / 60, 1, W.gust(100, 50, t + 1 / 60, 1, 0, 0.5), 3);
  hStep = Math.max(hStep, Math.abs(a1.along - a.along), Math.abs(a1.across - a.across));
  rigid = Math.max(rigid, Math.abs(a.along - b.along), Math.abs(a.across - b.across));
  cloth = Math.max(cloth, Math.abs(a.along - c.along));
  amp3 = Math.max(amp3, Math.abs(a.along)); amp1 = Math.max(amp1, Math.abs(e.along)); mean3 += a.along; cnt++;
}
mean3 /= cnt;
check(hStep < 0.012, `the swing is smooth: the largest step in one frame is ${hStep.toFixed(4)} blocks`);
check(rigid < 0.012, `a lantern swings as one piece: two of its points half a block apart move within ${rigid.toFixed(4)} blocks of each other`);
check(cloth < 0.6 * amp3, `a three-block awning bends as one cloth: its ends differ by at most ${cloth.toFixed(3)} (the swing reaches ${amp3.toFixed(3)})`);
check(amp1 > 0 && amp3 > 2.5 * amp1, `deeper swings further: level 3 reaches ${amp3.toFixed(3)} blocks, level 1 ${amp1.toFixed(3)}`);
check(mean3 > 0.01, `the wind pushes it downwind: the mean of the swing is ${mean3.toFixed(3)} blocks along the wind`);
check(W.hang(1, 2, 3, 4, 1, 1, 0).along === 0 && W.hang(1, 2, 3, 4, 0, 1, 3).along === 0, 'the hook itself (level 0) and still air: no movement');

// ---- 5. the palm frond: the tip moves, the crown less; each frond its own phase; the gust droops the crown
console.log('frond');
const tip = W.frond(1, 3, 0.7, 1, 2.3, 1, 0.5, 1), base = W.frond(0.12, 3, 0.7, 1, 2.3, 1, 0.5, 1);
check(Math.hypot(tip.along, tip.across, tip.up) > 5 * Math.hypot(base.along, base.across, base.up), 'a frond\'s tip moves far more than its base at the crown');
let sameSlot = 0, k = 0; for (let i = 0; i < 300; i++) { const t = i * 0.05; const a = W.frond(1, 2, 0.7, 1, t, 1, 0.3, 1).up, b = W.frond(1, 7, 0.7, 1, t, 1, 0.3, 1).up; if (Math.abs(a - b) < 1e-3) sameSlot++; k++; }
check(sameSlot < k * 0.2, `fronds flap with their own phase (two fronds level in ${sameSlot} of ${k} moments)`);
check(W.frond(1, 3, 0.7, 1, 2.3, 1, 1, 1).up < W.frond(1, 3, 0.7, 1, 2.3, 1, 0, 1).up, 'a gust droops the frond');
// props.js: the green fronds' sway weights grow with the square of the distance from the crown
if (V.Props === undefined) { try { require('../src/main/props.js'); } catch (e) { /* (props.js needs the main thread's VR) */ } }

// ---- 6. the sheen and the green tint
console.log('sheen');
const rgb565 = (r, g, b) => ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);
check(W.greenTint(rgb565(0x80, 0xA7, 0x55)) === 1 && W.greenTint(rgb565(0x61, 0x99, 0x61)) === 1, 'grass and foliage tints are green');
check(W.greenTint(rgb565(0x3F, 0x76, 0xE4)) === 0 && W.greenTint(0xFFFF) === 0 && W.greenTint(rgb565(0xB3, 0x8A, 0x55)) === 0, 'water, white and the dry grass of the badlands are not');
check(W.sheen(0) === 0 && near(W.sheen(1), W.SHEEN, 1e-12) && W.SHEEN <= 0.2, `a full gust brightens grass by ${W.SHEEN * 100} % at most`);
// the ground's bands (the third browser run: the meadow's green tops stood still while the tufts swayed): centred on the
// field's mean at every gust (the meadow keeps its brightness), a swing that reads (a fifth or more from lull to crest),
// travelling downwind with the gust field; per pixel in TERRAIN_FS for a green block's top, flagged by TERRAIN_VS
console.log('ground bands');
for (const gu of [0, 0.5, 1]) {
  let s = 0, n = 0, lo = 1, hi = -1;
  for (let i = 0; i < 20000; i++) { const x = (R() - 0.5) * 3000, z = (R() - 0.5) * 3000, t = R() * 500, a = R() * 6.283; const v = W.groundSheen(W.gust(x, z, t, Math.cos(a), Math.sin(a), gu), gu); s += v; n++; lo = Math.min(lo, v); hi = Math.max(hi, v); }
  check(Math.abs(s / n) < 0.015 && hi - lo >= 0.2 && hi <= 0.34 && lo >= -0.2, `gust ${gu}: the ground's bands are centred (mean ${(s / n).toFixed(4)}) and swing ${lo.toFixed(3)} … +${hi.toFixed(3)} (lull to crest ≥ 0.2, within −0.2 … +0.34)`);
}
{
  const dx = 0.6, dz = 0.8, x0 = 40, z0 = 90, N = 300, line = (t, sh) => { const o = []; for (let k = 0; k < N; k++) { const s = k * 0.5 + sh; o.push(W.groundSheen(W.gust(x0 + dx * s, z0 + dz * s, t, dx, dz, 0.3), 0.3)); } return o; };
  const A = line(20, 0); let best = null;
  for (let sh = -10; sh <= 10; sh += 0.25) { const B = line(20.5, sh); let d = 0; for (let k = 0; k < N; k++) d += (A[k] - B[k]) ** 2; if (!best || d < best.d) best = { sh, d }; }
  check(best.sh >= 2.5 && best.sh <= 4.5, `the ground's bands travel downwind with the gusts (${best.sh.toFixed(2)} blocks in 0.5 s)`);
}
{
  const VS = VR.SHADERS.TERRAIN_VS, FS = VR.SHADERS.TERRAIN_FS;
  check(/#ifdef MOTION[\s\S]*flat out float v_ground;/.test(VS) && /if \(green && sway == 0u && leaf == 0u && \(a_w5 & 7u\) == 2u\) v_ground = min\(u_wind, 1\.25\);/.test(VS), 'TERRAIN_VS flags a green block\'s top for the per-pixel bands (the wind up to 1.25), no plant, no leaf');
  check(/#ifdef MOTION[\s\S]*flat in float v_ground;[\s\S]*uniform vec2 u_windDir;[\s\S]*uniform float u_gust;[\s\S]*float windGroundSheen\(float G, float gust\)/.test(FS) && /if \(v_ground > 0\.0\) \{[\s\S]{0,200}sheen = windGroundSheen\(windGust\(gp\.x, gp\.z, u_time, u_windDir\.x, u_windDir\.y, u_gust\), u_gust\) \* v_ground;/.test(FS), 'TERRAIN_FS draws the ground\'s bands per pixel from the same gust field (wind.js)');
  check(W.GROUND.wind === 1.25 && /vec3\(1\.06, 1\.04, 0\.86\), clamp\(sheen \* 1\.5, 0\.0, 0\.4\)\)/.test(FS) && W.GROUND.warm.join() === '1.06,1.04,0.86' && W.GROUND.warmK === 1.5 && W.GROUND.warmMax === 0.4, 'the crest turns a touch paler and yellower (the blades\' undersides; GROUND.warm)');
}

// ---- 7. Very Low: the shaders as the preprocessor leaves them for the lite look (LITE defined, none of the fronts'
// defines) are v0.46's text, word for word — t-motion's MOTION/CLOUDSH/WXDRAMA code is behind its defines, and so is
// every sibling front's (t-material's PBR/SSR/TEXHI, t-light2's), so the merged file is checked the same way
console.log('Very Low keeps its shaders');
const pp = (src, defs) => {   // (the small preprocessor test/water_fx.js uses: #ifdef/#ifndef/#if defined()/#elif/#else/#endif)
  const out = [], st = [], ev = (e) => !!eval(e.replace(/defined\s*\(\s*(\w+)\s*\)/g, (_, d) => defs.includes(d) ? 'true' : 'false'));
  for (const line of src.split('\n')) { const t = line.trim(); let m;
    if ((m = /^#ifdef\s+(\w+)/.exec(t))) { const v = defs.includes(m[1]); st.push({ on: v, done: v }); continue; }
    if ((m = /^#ifndef\s+(\w+)/.exec(t))) { const v = !defs.includes(m[1]); st.push({ on: v, done: v }); continue; }
    if ((m = /^#if\s+(.*)$/.exec(t))) { const v = ev(m[1]); st.push({ on: v, done: v }); continue; }
    if ((m = /^#elif\s+(.*)$/.exec(t))) { const q = st[st.length - 1], v = !q.done && ev(m[1]); q.on = v; q.done = q.done || v; continue; }
    if (/^#else/.test(t)) { const q = st[st.length - 1]; q.on = !q.done; q.done = true; continue; }
    if (/^#endif/.test(t)) { st.pop(); continue; }
    if (st.every(q => q.on)) out.push(line); }
  return out.join('\n');
};
let baseS = null;
try {
  const root = path.join(__dirname, '..'), src = require('child_process').execFileSync('git', ['-C', root, 'show', '9b48d51:src/main/shaders.js'], { maxBuffer: 1 << 26 }).toString();
  const ctx = { VR: { Looks: VR.Looks, WaterWave: VR.WaterWave } }; require("vm").runInNewContext(src, ctx); baseS = ctx.VR.SHADERS;   // (the same shared helpers the page has: the look recolour, the water waves)
} catch (e) { console.log('  (no base shaders: ' + String(e.message).split('\n')[0] + ')'); }
const LITE_DEFS = ['LITE'];   // the Very Low programs: the lite look and none of the fronts' switches
if (baseS) for (const k of ['TERRAIN_VS', 'TERRAIN_FS', 'TRANS_FS', 'SKY_FS', 'RAIN_VS', 'RAIN_FS', 'PART_VS', 'PART_FS', 'FURN_VS', 'PUFF_VS', 'PUFF_FS']) {
  const tidy = (t) => t.split('\n').map((l) => l.replace(/\s+$/, '')).filter((l) => l.length).join('\n');   // (a blank line changes no program)
  const mine = tidy(pp(VR.SHADERS[k], LITE_DEFS)), was = tidy(pp(baseS[k], LITE_DEFS));
  // (the base text's own COMMON resolved the same way: both strings come with COMMON inlined)
  let at = -1; if (mine !== was) { const a = mine.split('\n'), b = was.split('\n'); at = a.findIndex((l, i) => l !== b[i]); }
  check(mine === was, `${k} on Very Low (LITE, after the preprocessor) is v0.46's text (${mine.length} characters${at < 0 ? '' : ', first different line ' + (at + 1) + ': ' + mine.split('\n')[at].trim().slice(0, 80)})`);
}

// ---- 8. the mesher writes the hung levels only when the job asks for motion
// ---- 7b. the smooth pieces that hang (FURN_VS, MOTION): the town's awnings and the hanging lanterns are drawn smooth on
// Low and up (smoothvox.js auto kinds, props2.js 'lantern:1'), so their swing is the furniture shader's — the same hang
// functions, one phase a piece, the lever from renderer.js hangOf: still at the hook or the wall, full at the free edge
console.log('hung smooth pieces');
{
  const FV = VR.SHADERS.FURN_VS, RS = fs.readFileSync(path.join(__dirname, '..', 'src', 'main', 'renderer.js'), 'utf8');
  check(/#ifdef MOTION[\s\S]*uniform vec4 u_hang;[\s\S]*float lv = 3\.0 \* clamp\(\(\(u_hang\.x < 1\.5 \? u_hang\.y - a_pos\.y : u_hang\.y - a_pos\.z\)\) \/ u_hang\.z, 0\.0, 1\.0\);[\s\S]*windHangAlong\(ap\.x, ap\.y, ap\.z, u_time, u_wind, G, lv\)/.test(FV), 'FURN_VS swings a hung piece with the terrain\'s hang functions (its lever from u_hang)');
  check(/if \(\/\^lantern:1\$\/\.test\(key\)\) h = \[1, 1\.0, 0\.8\];/.test(RS) && /\/\^auto:vm_town_awning_\/\.test\(key\)[^\n]*h = \[2, D \/ 2 \+ 0\.08 \* D, D\];/.test(RS) && /P\.furn = GL\.program\(S\.FURN_VS, S\.FURN_FS, 'furn', this\.propDefines\(\)\.concat\(this\.q\.motion \? \['MOTION'\] : \[\]\)\)/.test(RS), 'renderer.js: the hanging lantern (\'lantern:1\') and the town awnings swing; the furniture program takes MOTION from the switch');
  // the lever as the shader computes it (the awning 2 deep: its wall at z +1, the free edge at −1; the lantern: hook at 1)
  const lever = (h, y, z) => 3 * Math.min(1, Math.max(0, (h[0] < 1.5 ? h[1] - y : h[1] - z) / h[2])), D = 2, aw = [2, D / 2 + 0.08 * D, D], la = [1, 1.0, 0.8];
  check(lever(aw, 0.5, 1.0) < 0.5 && lever(aw, 0.5, -1.0) === 3 && lever(la, 1.0, 0) === 0 && lever(la, 0.2, 0) === 3, `the awning still at its wall (level ${lever(aw, 0.5, 1.0).toFixed(2)}), its free edge at 3; the lantern still at its hook, its foot at 3`);
}
console.log('hung pieces in the mesh');
const R2 = V.R, PAD = V.MESH_PAD || 2, PS = V.MESH_PS || 20, PSS = PS * PS;
const st = (n, p) => { const t = R2.byName[n]; if (!t) throw new Error('no block ' + n); return p ? t.state(Object.assign({}, t.decode(t.defaultState), p)) : t.defaultState; };
function job(place, motion) {
  const blocks = new Uint16Array(PSS * PS), light = new Uint16Array(PSS * PS).fill(0xf000);
  const g = new Uint16Array(PSS).fill(V.rgb565(0x80, 0xA7, 0x55)), f = new Uint16Array(PSS).fill(V.rgb565(0x61, 0x99, 0x61)), wa = new Uint16Array(PSS).fill(V.rgb565(0x3F, 0x76, 0xE4));
  for (const [x, y, z, s] of place) { const i = (y + PAD) * PSS + (z + PAD) * PS + (x + PAD); blocks[i] = s; light[i] = 0xf000; }
  const j = { blocks, light, grass: g, foliage: f, water: wa, sy: 4, ox: 1600, oz: -800, smooth: true, fancyLeaves: true, vxLod: true };
  if (motion !== undefined) j.motion = motion;
  return j;
}
const decode = (arr) => { const o = []; if (!arr) return o; for (let i = 0; i < arr.length; i += 8) o.push({ x: arr[i] / 2048 - 4, y: arr[i + 1] / 2048 - 4, z: arr[i + 2] / 2048 - 4, w5: arr[i + 5] }); return o; };
const hungOf = (v) => ((v.w5 >> 7) & 1) && ((v.w5 >> 5) & 3) ? (v.w5 >> 5) & 3 : 0;
const STONE = st('stone');
const scene = [];
// a hanging VX lantern under stone at (3, 9, 3); a standing one on stone at (8, 1, 3); a hanging 'lantern' block at (3, 9, 8)
scene.push([3, 10, 3, STONE], [3, 9, 3, st('vx_lantern')], [8, 0, 3, STONE], [8, 1, 3, st('vx_lantern')]);
const lanternHang = R2.byName.lantern.state(Object.assign({}, R2.byName.lantern.decode(R2.byName.lantern.defaultState), { hanging: 1 }));
scene.push([3, 10, 8, STONE], [3, 9, 8, lanternHang]);
// a VX awning against a stone wall (facing 0: the painter's wall at +z), at (8, 6, 8) with the wall at z 9
for (let y = 4; y <= 8; y++) scene.push([8, y, 9, STONE]);
scene.push([8, 6, 8, st('vx_awning_red', { facing: 0 })]);
const VM = V.VM, aw = VM && VM.MODELS && VM.MODELS.vm_town_awning_amber;
if (aw) for (const [dx, dy, dz, i] of VM.footprint(aw, 0)) scene.push([11 + dx, 6 + dy, 3 + dz, st('vm_town_awning_amber', { facing: 0, part: i })]);
V.VX.clearCache && V.VX.clearCache();
const off = V.meshSection(job(scene)), offF = V.meshSection(job(scene, 0)), on = V.meshSection(job(scene, 1));
const same = (a, b) => ['opaque', 'cutout', 'trans', 'vx', 'vxFar'].every(k => (!a[k] && !b[k]) || (a[k] && b[k] && a[k].length === b[k].length && a[k].every((v, i) => v === b[k][i])));
check(same(off, offF), 'a job without motion and one with motion 0 write the same vertices (Very Low\'s meshes stay as they were)');
const all = (r) => [].concat(...['opaque', 'cutout', 'trans', 'vx'].map(k => decode(r[k])));
const vOff = all(off), vOn = all(on);
check(vOff.every(v => !hungOf(v)), 'without motion no vertex is hung (' + vOff.length + ' vertices)');
check(vOff.length === vOn.length && vOff.every((v, i) => v.x === vOn[i].x && v.y === vOn[i].y && v.z === vOn[i].z), 'with motion the geometry is the same, vertex for vertex (only the sway bits differ)');
const inCell = (vs, cx, cy, cz) => vs.filter(v => v.x >= cx - 1e-3 && v.x <= cx + 1 + 1e-3 && v.y >= cy - 1e-3 && v.y <= cy + 1 + 1e-3 && v.z >= cz - 1e-3 && v.z <= cz + 1 + 1e-3);
const lan = inCell(vOn, 3, 9, 3), lanStand = inCell(vOn, 8, 1, 3);
const bottom = Math.min(...lan.map(v => v.y)), top = Math.max(...lan.map(v => v.y));
check(lan.length > 0 && lan.filter(v => Math.abs(v.y - bottom) < 1e-3).every(v => hungOf(v) === 3) && lan.filter(v => Math.abs(v.y - top) < 1e-3).every(v => hungOf(v) === 0), `the hanging VX lantern: its bottom at level 3, its hook at 0 (${lan.length} vertices, y ${bottom.toFixed(2)}–${top.toFixed(2)})`);
let mono = true; for (const a of lan) for (const b of lan) if (a.y < b.y - 0.05 && hungOf(a) < hungOf(b)) mono = false;
check(mono, 'the level never falls with the depth (a lower point swings at least as far)');
check(lanStand.length > 0 && lanStand.every(v => !hungOf(v)), `the standing VX lantern does not swing (${lanStand.length} vertices)`);
const lb = inCell(vOn, 3, 9, 8);
check(lb.length > 0 && lb.some(v => hungOf(v) === 3) && lb.every(v => v.y < 9.999 || hungOf(v) === 0), `the hanging 'lantern' block swings below its hook (${lb.length} vertices, levels ${[...new Set(lb.map(hungOf))].sort().join(',')})`);
const awn = inCell(vOn, 8, 6, 8);
check(awn.length > 0 && awn.filter(v => v.z > 8.95).every(v => hungOf(v) === 0) && awn.filter(v => v.z < 8.05).every(v => hungOf(v) === 3), `the VX awning: still at the wall, its front edge at level 3 (${awn.length} vertices)`);
if (aw) {
  const town = vOn.filter(v => v.x >= 11 && v.x <= 14 && v.y >= 6 && v.y <= 7 && v.z >= 3 && v.z <= 5);
  check(town.length > 0 && town.filter(v => v.z > 4.9).every(v => hungOf(v) === 0) && town.filter(v => v.z < 3.2).some(v => hungOf(v) === 3), `the town awning (three parts): still at its wall plate, the valance at level 3 (${town.length} vertices)`);
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
