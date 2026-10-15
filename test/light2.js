// t-light2 · WOW I · Das Licht (src/main/light2.js, light2_gl.js; plan docs/superpowers/plans/2026-10-15-t-light2.md), no
// browser:
//  a · the switches: the defaults per preset (Very Low none of them), the settings rows, the defines by program (the
//      contact shadows only where the vertex shader writes the reprojected place)
//  b · the shaders: with every switch off each program's preprocessed text is the same as without light2.js at all (Very
//      Low compiles what it compiled before); with them on the defines reach the programs they should; #if / #endif
//      balanced; the renderer's buildPrograms (stub GL) hands Very Low no light define and High the light's
//  c · the light model: the hemisphere's top · side · bottom (more depth than the old per-face shade, the shade cool, the
//      bounce warm) at noon, the golden hour, dusk and night; the lamps' pools against the old ramp
//  d · the air: the height fog's integral against a march, denser low, the morning layer
//  e · the grade: the tone curve monotone with its ends, the split toning's lean per hour, the bloom by the hour
//  f · the contact shadows' taps and the blue noise; the flare's ghosts on the sun's axis
//   bash test/wt_run.sh light2.js
const fs = require('fs'), path = require('path');
const V = require('./load_shared.js');
global.window = { devicePixelRatio: 1, screen: { width: 1280, height: 720 } };
global.WebGLFramebuffer = class {};
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
const r2 = (x) => Math.round(x * 100) / 100, r3 = (x) => Math.round(x * 1000) / 1000;
const SRC = path.join(__dirname, '..', 'src', 'main');

// ---- the shaders twice: without light2.js (as before) and with it
require(SRC + '/gl.js');
require(SRC + '/shaders.js');
const S0 = Object.assign({}, V.SHADERS);
delete require.cache[require.resolve(SRC + '/shaders.js')];
require(SRC + '/light2.js');
require(SRC + '/shaders.js');
const S1 = V.SHADERS, L2 = V.Light2;
if (!L2) { console.log('VR.Light2 missing'); console.log('FAILED 1'); process.exit(1); }

// ---- a small GLSL preprocessor: the text the compiler sees for a define set (#ifdef / #ifndef / #if defined(…) with
// && || ! / #elif / #else / #endif; comments and blank lines dropped)
function pre(src, defs) {
  const D = new Set(defs.map(d => d.split(' ')[0]));
  const out = [], stack = [];
  const active = () => stack.every(s => s.on);
  const ev = (e) => { const js = e.replace(/defined\s*\(\s*(\w+)\s*\)/g, (m, n) => (D.has(n) ? '1' : '0')).replace(/\b[A-Z_][A-Z_0-9]*\b/g, (n) => (D.has(n) ? '1' : '0')); if (!/^[01\s()!&|]*$/.test(js)) throw new Error('#if ' + e); return !!Function('return (' + js + ')')(); };
  for (let line of src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n')) {
    const t = line.trim();
    let m;
    if ((m = /^#ifdef\s+(\w+)/.exec(t))) { const on = D.has(m[1]); stack.push({ on, done: on }); continue; }
    if ((m = /^#ifndef\s+(\w+)/.exec(t))) { const on = !D.has(m[1]); stack.push({ on, done: on }); continue; }
    if ((m = /^#if\s+(.*)$/.exec(t))) { const on = ev(m[1]); stack.push({ on, done: on }); continue; }
    if ((m = /^#elif\s+(.*)$/.exec(t))) { const s = stack[stack.length - 1]; if (s.done) s.on = false; else { s.on = ev(m[1]); s.done = s.on; } continue; }
    if (/^#else/.test(t)) { const s = stack[stack.length - 1]; s.on = !s.done; s.done = true; continue; }
    if (/^#endif/.test(t)) { stack.pop(); continue; }
    if (!active()) continue;
    const c = line.replace(/\/\/.*$/, '').trimEnd();
    if (c.trim()) out.push(c.trim());
    if (/^#define\s+(\w+)/.test(t)) D.add(/^#define\s+(\w+)/.exec(t)[1]);
  }
  if (stack.length) throw new Error('unbalanced #if');
  return out.join('\n');
}
const balanced = (src) => { let n = 0; for (const l of src.split('\n')) { const t = l.trim(); if (/^#if(def|ndef)?\b/.test(t)) n++; else if (/^#endif/.test(t)) n--; if (n < 0) return false; } return n === 0; };

console.log('a · the switches');
{
  const d = (p) => L2.defaults(p);
  check(L2.SW.every(k => !d('potato')[k]), 'Very Low (potato) gets none of the light switches', JSON.stringify(d('potato')));
  check(d('low').l2Light && d('low').l2Ssao === 1 && !d('low').l2Vol && d('low').l2Air && d('low').l2Grade, 'Low: the light model, 4-tap contact shadows, the air and the grade — no volumetric light', JSON.stringify(d('low')));
  check(d('balanced').l2Ssao === 2 && !d('balanced').l2Vol, 'Balanced: 8-tap contact shadows, no volumetric light');
  check(d('high').l2Ssao === 3 && d('high').l2Vol && d('ultra').l2Ssao === 3 && d('ultra').l2Vol, 'High and Ultra: 12 taps and the volumetric light');
  check(d('ultraLite').l2Ssao === 2 && d('ultraLite').l2Vol, 'Ultra · Leicht (the integrated GPUs\' Ultra): 8 taps and the volumetric light');
  check(L2.ROWS.length === L2.SW.length && L2.ROWS.every(r => L2.SW.includes(r.key) && r.cost && r.lab === 'g.set.' + r.key && r.tip === 'g.set.' + r.key + '.tip'), 'every switch has its settings row with a cost, a label and a tip');
  const de = fs.readFileSync(SRC + '/lang_de.js', 'utf8'), en = fs.readFileSync(SRC + '/lang_en.js', 'utf8');
  const keys = [].concat(...L2.ROWS.map(r => [r.lab, r.tip].concat(r.vals ? [r.vals] : [])));
  check(keys.every(k => de.includes("'" + k + "'") && en.includes("'" + k + "'")), 'their texts in German and English', keys.length + ' keys');
  const hi = d('high');
  const has = (name, def, q) => L2.definesFor(name, q || hi).includes(def);
  check(['terrain', 'terrainCut', 'terrainCutZ', 'prop', 'furn'].every(n => has(n, 'L2AO')) && !['shipOpaque', 'trans', 'vox', 'mesh', 'lod', 'folk', 'part'].some(n => has(n, 'L2AO')), 'the contact shadows are read by the terrain, the palms and the furniture only (their vertex shaders write the reprojected place)');
  check(['terrain', 'trans', 'prop', 'furn', 'vox', 'mesh', 'lod', 'form', 'lodFar', 'folk', 'folkSun', 'part'].every(n => has(n, 'AIR2')), 'every program that hazes with applyFog gets the air (the same haze on land, water, people and far terrain)');
  check(has('composite', 'GRADE2') && has('composite', 'L2VOL') && !has('composite', 'L2VOL', d('balanced')), 'the composite: the grade, and the volumetric light\'s upsample where it is on');
  check(L2.SW.every(k => !L2.definesFor('terrain', d('potato')).length), 'Very Low: no light define in any program');
}

console.log('b · the shaders');
{
  // every program's (VS, FS) pair with the define sets the game uses; with the light off the preprocessed text must be
  // the same as the shaders without light2.js
  const PROGS = [
    ['TERRAIN_VS', 'TERRAIN_FS', [['FADE', 'LITE'], ['FADE', 'LITE', 'CUTOUT'], ['FADE', 'SHADOWS', 'HSHADOW'], ['FADE', 'CUTOUT', 'SHADOWS', 'HSHADOW'], ['MODEL', 'SHADOWS'], ['FADE', 'CUTOUT', 'ZINV', 'ZPRE', 'HSHADOW']]],
    ['TERRAIN_VS', 'TRANS_FS', [['FADE', 'LITE'], ['FADE', 'SHADOWS', 'HSHADOW']]],
    ['PROP_VS', 'PROP_FS', [[], ['SHADOWS']]], ['FURN_VS', 'FURN_FS', [['LITE'], ['SHADOWS']]],
    ['VOX_VS', 'VOX_FS', [[], ['INST']]], ['MESH_VS', 'MESH_FS', [[]]], ['LOD_VS', 'LOD_FS', [[], ['FORM'], ['FAR1']]],
    ['PART_VS', 'PART_FS', [[]]], ['FS_VS', 'SKY_FS', [[], ['LITE']]], ['CLOUD_VS', 'CLOUD_FS', [[]]], ['PUFF_VS', 'PUFF_FS', [[]]],
    ['FS_VS', 'COMPOSITE_FS', [[]]], ['FS_VS', 'RAYS_FS', [[], ['MASK']]], ['FS_VS', 'BLOOM_PRE_FS', [[]]],
  ];
  let same = 0, diff = [], n = 0;
  for (const [vs, fsk, sets] of PROGS) for (const ds of sets) {
    n++;
    const a = pre(S0[vs], ds) + '\n----\n' + pre(S0[fsk], ds), b = pre(S1[vs], ds) + '\n----\n' + pre(S1[fsk], ds);
    if (a === b) same++; else diff.push(fsk + '[' + ds.join(',') + ']');
  }
  check(same === n, `with the light off every program is the text it was without light2.js (${same} of ${n} preprocessed pairs the same${diff.length ? '; differ: ' + diff.join(' ') : ''})`);
  check(Object.keys(S1).filter(k => typeof S1[k] === 'string').every(k => balanced(S1[k])) && balanced(L2.AO_FS) && balanced(L2.VOL_FS), 'every shader\'s #if / #endif are balanced');
  // with the defines on: the light model's code is in, the old ambient replaced after it
  const tf = pre(S1.TERRAIN_FS, ['FADE', 'SHADOWS', 'LIGHT2', 'L2AO', 'AIR2']), tv = pre(S1.TERRAIN_VS, ['FADE', 'SHADOWS', 'L2AO']);
  check(/l2Hemi\(n\)/.test(tf) && /l2Pool\(bl\)/.test(tf) && /l2Wrap\(dot\(n, L\)/.test(tf) && /vec3 l2Fog\(/.test(tf), 'LIGHT2 / AIR2 bring the hemisphere, the pools, the leaves\' wrap and the air into the terrain');
  check(/v_l2AoClip = u_l2AoVP \* vec4\(rel \+ u_l2AoDelta, 1\.0\)/.test(tv) && !/v_l2AoClip/.test(pre(S1.TERRAIN_VS, ['MODEL', 'L2AO'])), 'the terrain\'s vertex shader writes the reprojected place (not for a ship: MODEL)');
  // the renderer (stub GL): Very Low's programs carry no light define, High's do
  const consts = {}, progs = [];
  const gl = new Proxy({}, { get(t, k) {
    if (k in t) return t[k];
    if (typeof k === 'string' && /^[A-Z][A-Z_0-9]+$/.test(k)) return consts[k] || (consts[k] = k);
    return (...a) => { if (k === 'shaderSource') progs.push(a[1]); if (k === 'getShaderParameter' || k === 'getProgramParameter') return k === 'getProgramParameter' && a[1] === 'ACTIVE_UNIFORMS' ? 0 : true; if (k === 'getUniformBlockIndex') return 0; if (/^create/.test(k)) return {}; if (k === 'getParameter') return 16; return undefined; };
  } });
  V.GL.gl = gl; V.GL.ext = { multiDraw: null, cbf: {}, cbhf: null, aniso: null };
  require(SRC + '/bench.js'); require(SRC + '/ultralite.js'); require(SRC + '/ipu.js'); require(SRC + '/renderer.js'); require(SRC + '/light2_gl.js');
  const build = (q) => { progs.length = 0; const r = Object.create(V.Renderer.prototype); r.gl = gl; r.multi = false; r.q = Object.assign({ zPre: false }, q); r.buildPrograms(); return progs.join('\n'); };
  const vl = build(Object.assign({ shadows: 0, hshadow: false, lite: true }, L2.defaults('potato')));
  check(!/#define (LIGHT2|L2AO|AIR2|GRADE2|L2VOL)\b/.test(vl), 'renderer.buildPrograms on Very Low: no light define in any program');
  const hiSrc = build(Object.assign({ shadows: 2048, hshadow: true, lite: false }, L2.defaults('high')));
  check(/#define LIGHT2/.test(hiSrc) && /#define L2AO/.test(hiSrc) && /#define AIR2/.test(hiSrc) && /#define GRADE2/.test(hiSrc) && /#define L2VOL/.test(hiSrc), 'on High: the light model, the contact shadows, the air, the grade and the volumetric light\'s upsample');
  check(typeof V.Renderer.prototype.l2Frame === 'function' && typeof V.Renderer.prototype.l2Uniforms === 'function', 'light2_gl.js puts its methods on the renderer');
}

console.log('c · the light model');
{
  require(SRC + '/skybodies.js'); require(SRC + '/weather.js'); require(SRC + '/env.js');   // (VR.Env; its update reads the sky bodies and the weather)
  const E0 = new V.Env(); E0.wx.setSeed(7); E0.wx.force('klar');
  const at = (ticks) => { E0.setTime(ticks); for (let i = 0; i < 80; i++) E0.update(1, { dim: 'overworld', biome: null, eyeSky: 1, renderDist: 8, horizon: 4096, freezeTime: true, freezeWeather: true }); return E0.E; };
  const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  for (const [name, t] of [['noon', 6000], ['golden', 10800], ['dusk', 12600], ['night', 16500]]) {
    const E = JSON.parse(JSON.stringify(at(t)));
    const h = L2.hemiColors(E), top = L2.hemi([0, 1, 0], h.sky, h.ground, [1, 0], 0), side = L2.hemi([1, 0, 0], h.sky, h.ground, [1, 0], 0), bot = L2.hemi([0, -1, 0], h.sky, h.ground, [1, 0], 0);
    const lt = lum(top), rs = lum(side) / lt, rb = lum(bot) / lt;
    const old = [1, 0.5 * (0.8636 + 0.9256), 0.721];
    const cool = top[2] / top[0], warm = bot[2] / bot[0];
    check(Math.abs(lt - lum(E.ambSky)) / lum(E.ambSky) < 0.02 && rs < old[1] && rb < old[2] && rs > rb && rb > 0.35, `${name}: top · side · bottom = 1 · ${r2(rs)} · ${r2(rb)} (the old per-face shade 1 · ${r2(old[1])} · ${r2(old[2])}: more depth; the top keeps the ambient's brightness)`);
    check(cool > warm, `${name}: the shade from the sky cooler than the bounce from the ground (blue over red: top ${r2(cool)}, bottom ${r2(warm)})`);
  }
  // the sky leans toward the light's side: a side face toward the light's azimuth brighter than one away
  const sky = [0.4, 0.45, 0.6], gr = [0.25, 0.25, 0.2];
  const toward = L2.hemi([1, 0, 0], sky, gr, [1, 0]), away = L2.hemi([-1, 0, 0], sky, gr, [1, 0]), up = L2.hemi([0, 1, 0], sky, gr, [1, 0]);
  check(toward[1] > away[1] && Math.abs(up[1] - sky[1]) < 1e-9, `a wall toward the light's azimuth gets ${r2(toward[1] / away[1])}× the ambient of one away from it; the top face none of it`);
  // the pools
  const P = (d) => L2.pool(1 - d / 15), O = (d) => L2.poolOld(1 - d / 15);
  let mono = true; for (let l = 1; l <= 15; l++) if (L2.pool(l / 15) < L2.pool((l - 1) / 15) - 1e-9) mono = false;
  check(mono, 'the lamps\' light rises toward the lamp (monotone in the level)');
  check(P(0) >= 1.6 * O(0) && P(1) > O(1), `a hot spot at the lamp: ${r2(P(0))} against the old ${r2(O(0))} (a block off ${r2(P(1))} against ${r2(O(1))})`);
  check(P(8) < O(8) * 0.6 && P(14) < 0.02, `a pool, not a ramp: 8 blocks off ${r3(P(8))} against the old ${r3(O(8))}, 14 off ${r3(P(14))}`);
}

console.log('d · the air');
{
  let worst = 0;
  for (const [ye, dy, D] of [[82, -18, 120], [70, 0, 300], [95, 30, 200], [64, -2, 40], [140, -70, 400]]) {
    const a = L2.fogOD(ye, dy, D, 0.002, 1 / 14, 62), b = L2.fogODMarch(ye, dy, D, 0.002, 1 / 14, 62);
    worst = Math.max(worst, Math.abs(a - b) / b);
  }
  check(worst < 0.005, `the height fog's integral along a ray matches a 2000-step march (worst ${r3(worst * 100)} %)`);
  const low = L2.fogOD(66, 0, 200, 0.002, 1 / 14, 62), high = L2.fogOD(100, 0, 200, 0.002, 1 / 14, 62);
  check(low > high * 5, `denser in the valley: 200 blocks level at y 66 ${r3(low)} against y 100 ${r3(high)}`);
  const E = { sunDir: [0.5, 0.21, 0.84], rain: 0 };
  const dawn = L2.air(E, 500), noon = L2.air({ sunDir: [-0.36, 0.41, 0.84], rain: 0 }, 6000);
  check(dawn.morning > 0.9 && noon.morning === 0 && dawn.rho > noon.rho * 2 && dawn.base < noon.base, `the morning layer: at 06:30 (ticks 500) the haze ${r3(dawn.rho * 1000)} ‰ and lower (base ${r2(dawn.base)}), at noon ${r3(noon.rho * 1000)} ‰`);
}

console.log('e · the grade');
{
  let ok = true;
  for (const k of Object.keys(L2.GRADE)) {
    const c = L2.GRADE[k];
    let prev = -1; for (let i = 0; i <= 100; i++) { const y = L2.curve(i / 100, c); if (y < prev - 1e-9) ok = false; prev = y; }
    if (Math.abs(L2.curve(0, c) - c.toe) > 1e-9 || Math.abs(L2.curve(1, c) - c.sh) > 1e-9) ok = false;
  }
  check(ok, 'the tone curve of every hour is monotone and runs from its toe to its shoulder');
  const lean = (k, l) => { const g = L2.GRADE[k], c = L2.split([l, l, l], g.dark, g.light); return c[0] - c[2]; };
  check(lean('gold', 0.85) > 0.02 && lean('gold', 0.1) < -0.01, `the golden hour: warm lights (r − b ${r3(lean('gold', 0.85))}), cool darks (${r3(lean('gold', 0.1))})`);
  const g = L2.GRADE.dusk, dc = L2.split([0.12, 0.12, 0.12], g.dark, g.light);
  check(dc[2] > dc[1] && dc[0] > dc[1], `dusk: the darks violet-navy (${dc.map(r3).join(' ')})`);
  const nc = L2.split([0.1, 0.1, 0.1], L2.GRADE.night.dark, L2.GRADE.night.light);
  check(nc[2] > nc[0] && nc[1] > nc[0], `night: the darks teal-cyan (${nc.map(r3).join(' ')})`);
  const lumOf = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  check(Math.abs(lumOf(L2.split([0.4, 0.4, 0.4], L2.GRADE.gold.dark, L2.GRADE.gold.light)) - 0.4) < 1e-6, 'the split toning keeps the luma');
  check(L2.GRADE.night.bThr < L2.GRADE.dusk.bThr && L2.GRADE.dusk.bThr < L2.GRADE.day.bThr && L2.GRADE.night.bStr > L2.GRADE.day.bStr, `the glow by the hour: the bloom's threshold ${L2.GRADE.day.bThr} by day → ${L2.GRADE.night.bThr} at night, its strength ${L2.GRADE.day.bStr} → ${L2.GRADE.night.bStr}`);
  // (the sun's height: noon (ticks 6000) 0.41, ticks 10800 0.13, 12600 −0.066, 16500 −0.38 — env.js)
  const m = L2.moods(0.41), m2 = L2.moods(0.13), m3 = L2.moods(-0.066), m4 = L2.moods(-0.38), m5 = L2.moods(0);
  check(m.day > 0.99 && m2.gold > 0.85 && m3.dusk > 0.95 && m4.night > 0.99 && m5.dusk > 0.9, `the hour's moods: noon day ${r2(m.day)}, the sun 7° up gold ${r2(m2.gold)}, at the horizon dusk ${r2(m5.dusk)}, 4° under dusk ${r2(m3.dusk)}, 22° under night ${r2(m4.night)}`);
}

console.log('f · the taps, the noise, the flare');
{
  for (const n of [4, 8, 12]) {
    const T = L2.TURNS[L2.TAPS.indexOf(n)];
    const taps = []; for (let i = 0; i < n; i++) taps.push(L2.saoTap(i, n, T, 0.3));
    const rad = taps.map(t => Math.hypot(t[0], t[1]));
    const inDisc = rad.every(r => r > 0 && r < 1), grows = rad.every((r, i) => !i || r > rad[i - 1]);
    // the taps' directions spread: the mean of the unit vectors is small
    const mx = taps.reduce((s, t) => s + t[0] / Math.hypot(t[0], t[1]), 0) / n, my = taps.reduce((s, t) => s + t[1] / Math.hypot(t[0], t[1]), 0) / n;
    check(inDisc && grows && Math.hypot(mx, my) < 0.45, `${n} taps on a ${T}-turn spiral: inside the disc, the radius growing, the directions spread (mean ${r2(Math.hypot(mx, my))})`);
  }
  const t0 = Date.now(), B = L2.blueNoise(64, 7), ms = Date.now() - t0;
  const hist = new Array(16).fill(0); for (const v of B) hist[v >> 4]++;
  const flat = hist.every(h => Math.abs(h - 256) <= 8);
  // the low frequencies: the means of 4 × 4 blocks spread far less than for white noise (σ_white = σ / 4)
  const blockSd = (A) => { const ms = []; for (let by = 0; by < 16; by++) for (let bx = 0; bx < 16; bx++) { let s = 0; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) s += A[(by * 4 + y) * 64 + bx * 4 + x]; ms.push(s / 16); } const m = ms.reduce((a, b) => a + b, 0) / ms.length; return Math.sqrt(ms.reduce((a, b) => a + (b - m) * (b - m), 0) / ms.length); };
  let a = 7; const W = new Uint8Array(4096).map(() => { a ^= a << 13; a >>>= 0; a ^= a >>> 17; a ^= a << 5; a >>>= 0; return (a >>> 24); });
  const sb = blockSd(B), sw = blockSd(W);
  check(flat && sb < sw * 0.45, `the blue noise (64², ${ms} ms): every level equally often, the 4 × 4 block means spread ${r2(sb)} against white noise's ${r2(sw)}`);
  const G = L2.ghosts(0.8, 0.3);
  const onAxis = G.every(g => Math.abs((g[0] - 0.8) * (0.5 - 0.3) - (g[1] - 0.3) * (0.5 - 0.8)) < 1e-9);
  check(onAxis && G.some(g => g[0] < 0.5) && G.some(g => g[0] > 0.5), 'the flare\'s ghosts lie on the line from the sun through the centre, on both sides of it');
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
