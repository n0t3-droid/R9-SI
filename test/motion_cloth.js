// t-polish2 · gap 7 of docs/superpowers/plans/2026-10-16-t-polish2.md — the street's motion: cloth is not a lantern.
// The town's awnings (the hall city's street, its plaza) swing as cloth: wind.js CLOTH — ×gain the hung swing and a ripple
// that runs along the valance — drawn by the furniture shader (FURN_VS, under MOTION: u_hang.w, renderer.js hangOf's fourth
// number); a lantern's and a sign's swing are as before. The café's steam reads by day (motion.js STEAM: bigger, denser
// wisps in a light grey that shows on the bright stone) and every field of its look is set on each spawn (v0.48's merge
// had commented five of them out: the steam took the alpha, growth and wind of whatever spawned before it — the motes'
// opaque dots, the glints' no-fade). Very Low: no MOTION text (test/vl_programs.js), its steam the same numbers. Node only.
//   bash test/wt_run.sh motion_cloth.js 300
const V = require('./load_shared.js');
global.performance = global.performance || require('perf_hooks').performance;
global.window = undefined;
require('../src/main/settings_reg.js');
require('../src/main/particles.js');
require('../src/main/airlife.js');
require('../src/main/motion.js');
require('../src/main/gl.js'); require('../src/main/shaders.js'); require('../src/main/renderer.js');
const fs = require('fs');
const W = V.Wind, M = VR.Motion, S = VR.SHADERS;
{ let s = 0x2545f491; Math.random = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };

console.log('the cloth (wind.js CLOTH)');
const C = W.CLOTH, H = W.HANG;
check(!!C && C.gain >= 2 && C.rip > 0 && C.w > 0 && C.k > 0, 'the cloth\'s numbers: the gain over the hung swing, the ripple\'s height, speed and wavelength', C ? JSON.stringify(C) : 'none');
check(H.amp === 0.06 && H.w === 2.6 && H.w2 === 4.3 && H.kx === 0.09 && H.kz === 0.06 && H.flutter === 0.003 && H.fw === 9.0, 'a lantern\'s and a sign\'s swing as before (wind.js HANG unchanged)');
if (C && W.cloth && W.clothRip) {
  // the valance (level 3) over 12 s at wind 1, the gust as it comes: its swing against a lantern's at the same depth
  let cMax = 0, lMax = 0, cMin = 1e9, lMin = 1e9;
  for (let t = 0; t < 12; t += 1 / 60) {
    const G = W.gust(-960.5, -296.5, t, 1, 0, 0.5);
    const c = W.cloth(-960.5, 77, -296.5, t, 1, G, 3, 0.4), l = W.hang(-960.5, 77, -296.5, t, 1, G, 3);
    cMax = Math.max(cMax, c.along); cMin = Math.min(cMin, c.along); lMax = Math.max(lMax, l.along); lMin = Math.min(lMin, l.along);
  }
  check(cMax - cMin >= 0.12 && Math.abs((cMax - cMin) / (lMax - lMin) - C.gain) < 1e-6, `the valance swings ${(cMax - cMin).toFixed(3)} blocks to and fro (a lantern at that depth ${(lMax - lMin).toFixed(3)}: ×${C.gain})`);
  const z0 = W.cloth(3.2, 70, 8.1, 4.4, 1, 0.7, 0, 0.9);
  check(z0.along === 0 && z0.across === 0 && z0.up === 0 && z0.out === 0, 'the wall plate (level 0) holds still');
  // the ripple runs along the valance: different along it at one moment, the same shape a moment later further on
  let rMin = 1e9, rMax = -1e9;
  for (let s = -1.5; s <= 1.5; s += 0.05) { const r = W.clothRip(s, -960.5, -296.5, 7.3, 1, 0.6, 3); rMin = Math.min(rMin, r); rMax = Math.max(rMax, r); }
  check(rMax > 0 && rMin < 0 && rMax - rMin >= C.rip, `the ripple: up and down along the valance at one moment (${rMin.toFixed(3)} … ${rMax.toFixed(3)} over its three blocks)`);
  const dt = 0.1, ds = C.w * dt / C.k;
  let worst = 0; for (let s = -1.5; s <= 1.5; s += 0.1) worst = Math.max(worst, Math.abs(W.clothRip(s + ds, -960.5, -296.5, 7.3 + dt, 1, 0.6, 3) - W.clothRip(s, -960.5, -296.5, 7.3, 1, 0.6, 3)));
  check(worst < 1e-9, `it travels along the valance at ${(C.w / C.k).toFixed(2)} blocks a second (the shape ${ds.toFixed(3)} blocks on after ${dt} s)`);
  const r1 = Math.abs(W.clothRip(0.3, 0, 0, 1.0, 1, 1, 1)), r3 = Math.abs(W.clothRip(0.3, 0, 0, 1.0, 1, 1, 3));
  check(W.clothRip(0.3, 0, 0, 1.0, 1, 1, 0) === 0 && Math.abs(r1 * 9 - r3) < 1e-9 && W.clothRip(0.3, 0, 0, 1.0, 0, 1, 3) === 0, 'the ripple grows with the square of the distance from the wall and stops in still air');
  const c3 = W.cloth(1, 70, 2, 3.3, 1, 0.5, 3, 0.25), l3 = W.hang(1, 70, 2, 3.3, 1, 0.5, 3);
  check(Math.abs(c3.along - C.gain * l3.along) < 1e-12 && Math.abs(c3.across - C.gain * l3.across) < 1e-12 && Math.abs(c3.up - C.gain * l3.up - W.clothRip(0.25, 1, 2, 3.3, 1, 0.5, 3)) < 1e-12 && Math.abs(c3.out - C.out * W.clothRip(0.25, 1, 2, 3.3, 1, 0.5, 3)) < 1e-12, 'cloth = the hung swing × gain, the ripple up and out of the wall');
} else check(false, 'wind.js has W.cloth and W.clothRip');

console.log('the shader');
{
  const src = W.glsl(), m = /float windClothRip\(([^)]*)\) \{([\s\S]*?)\n\}/.exec(src);
  check(!!m, 'the GLSL holds windClothRip');
  if (m && W.clothRip) {
    const args = m[1].split(',').map(a => a.trim().replace(/^float /, '')).filter(Boolean);
    const body = m[2].replace(/\bfloat\b/g, 'let').replace(/(\d)\.(?!\d)/g, '$1.0');
    const fn = new Function(...args, 'const sin = Math.sin, cos = Math.cos, max = Math.max, min = Math.min, clamp = (v, a, b) => v < a ? a : v > b ? b : v;\n' + body);   // (the test only)
    let worst = 0; for (let i = 0; i < 2000; i++) { const s = Math.random() * 3 - 1.5, x = (Math.random() - 0.5) * 4000, z = (Math.random() - 0.5) * 4000, t = Math.random() * 3000, wind = Math.random() * 3, G = Math.random(), lv = Math.floor(Math.random() * 4); worst = Math.max(worst, Math.abs(fn(s, x, z, t, wind, G, lv) - W.clothRip(s, x, z, t, wind, G, lv))); }
    check(worst < 2e-4, 'the shader text and the JavaScript agree on 2000 random inputs', 'largest difference ' + worst.toExponential(1));
  }
  const vs = S.FURN_VS, i0 = vs.indexOf('#ifdef MOTION', vs.indexOf('void main()')), i1 = vs.indexOf('#endif', i0), mo = i0 > 0 ? vs.slice(i0, i1) : '';
  check(/u_hang\.w > 0\.5/.test(mo) && /windClothRip\(a_pos\.x, ap\.x, ap\.z, u_time, u_wind, G, lv\)/.test(mo) && new RegExp('cg = u_hang\\.w > 0\\.5 \\? ' + (C ? C.gain.toFixed(2).replace('.', '\\.') : 'x')).test(mo), 'FURN_VS: a cloth piece (u_hang.w) swings ×gain and ripples along its width (a_pos.x), under MOTION only');
}

console.log('the pieces (renderer.js hangOf)');
{
  const r = Object.create(VR.Renderer.prototype);
  const aw = r.hangOf('auto:vm_town_awning_teal#3'), ln = r.hangOf('lantern:1'), st = r.hangOf('auto:vm_cafe_table#2');
  check(aw.length === 4 && aw[0] === 2 && aw[3] === 1, 'the town\'s awnings are cloth (mode 2, the fourth number 1)', JSON.stringify(aw));
  check(ln.length === 4 && ln[0] === 1 && ln[3] === 0 && st[0] === 0 && st[3] === 0, 'a hanging lantern swings as a lantern, a table stands', JSON.stringify(ln) + ' ' + JSON.stringify(st));
  const src = fs.readFileSync(__dirname + '/../src/main/renderer.js', 'utf8');
  const sets = src.match(/gl\.uniform4f\(u\.u_hang, [^)]*\)/g) || [];
  check(sets.length === 3 && sets.every(s => s === 'gl.uniform4f(u.u_hang, h[0], h[1], h[2], h[3])'), 'every draw of the pieces hands the cloth flag to the shader', sets.length + ' places');
}

console.log('the café\'s steam (motion.js STEAM)');
{
  const ST = M.STEAM;
  check(!!ST && !!M.steamLook, 'the steam\'s look by day and by night in one table');
  if (ST && M.steamLook) {
    const d = {}, n = {};
    M.steamLook(true, d, 0.5); M.steamLook(false, n, 0.5);
    const keys = ['life', 'size', 'grav', 'drag', 'col', 'emis', 'fade', 'alpha', 'grow', 'wind', 'turb'];
    check(keys.every(k => d[k] !== undefined && n[k] !== undefined), 'every field of the look is set (life, size, gravity, drag, colour, glow, fade, alpha, growth, wind, turbulence)');
    // (wisps, not clouds: the first browser run's growth 0.3 a second swelled a wisp to a 1.8-block puff that hid the café)
    const endW = (L) => 2 * (L.size + L.sizeR + L.grow * M.AIR_LIFE.steam * 1.2);
    check(2 * ST.day.size >= 0.12 && d.alpha >= 0.45 && d.fade === true && endW(ST.day) <= 0.6 && endW(ST.night) <= 0.6, `by day denser wisps: ${(2 * ST.day.size).toFixed(2)}–${(2 * (ST.day.size + ST.day.sizeR)).toFixed(2)} blocks wide at the cup, ${d.alpha} opaque, at most ${endW(ST.day).toFixed(2)} wide when they fade (night ${endW(ST.night).toFixed(2)}): wisps, not clouds`);
    check(Math.max(...d.col) <= 0.86 && Math.min(...d.col) >= 0.7 && d.col[2] >= d.col[0] && d.emis <= 0.1, `in a light grey that shows on the bright stone (${d.col.join(', ')}; the old white 0.96 vanished on the travertine)`);
    check(Math.max(...n.col) <= 0.5 && n.emis === 0 && n.alpha <= 0.4 && n.size <= d.size, `at night as v0.48's merge set it: half as bright, lit by the lamps, not emissive (${n.col.join(', ')})`);
    check(d.wind === 0.5 && d.turb === 0.35 && n.wind === 0.5 && n.turb === 0.35, 'it takes up the wind and curls (wind 0.5, turbulence 0.35)');
  }
  // the bug: the steam spawned after the motes kept the motes' alpha — every steam spawn now carries its own look
  const R = VR.R, stOf = (nm) => R.byName[nm].defaultState;
  const STONE = stOf('stone'), LEAF = stOf('oak_leaves'), GRASS = stOf('grass_block');
  const world = {
    topAt: (x, z) => (x >= 0 && x <= 8 && z >= 0 && z <= 8 && !(x === 4 && z === 4)) ? 73 : 63,
    getBlock: (x, y, z) => { if (y <= 62) return STONE; if (y === 63) return GRASS; if ((y === 72 || y === 73) && x >= 0 && x <= 8 && z >= 0 && z <= 8 && !(x === 4 && z === 4)) return LEAF; return 0; },
  };
  const game = { villages: { known: new Map([['h', { plan: { x: 0, z: 0, shops: [{ kind: 'cafe', seats: [[2, 64, 10, 1], [4, 64, 10, 3], [2, 64, 14, 1]] }] } }]]) } };
  const a = new VR.MotionAir(game); a.setOn(true, 3);
  const log = [];
  const parts = { n: 0, spawn(x, y, z, vx, vy, vz, o) { this.n++; log.push({ y, alpha: o.alpha, grow: o.grow, fade: o.fade, wind: o.wind, turb: o.turb, size: o.size, emis: o.emis }); return this.n; } };
  const E = { sunDir: [0, 1, 0], night: 0, rain: 0, snow: 0, wind: 1, windDir: [1, 0] };
  for (let i = 0; i < 900; i++) a.update(1 / 30, { w: world, eye: [4.5, 65.6, 3.5], E, particles: parts, drama: true });
  const steam = log.filter(p => Math.abs(p.y - 64.95) < 1e-6), motes = log.filter(p => Math.abs(p.y - 64.95) >= 1e-6);
  const ok = steam.length > 0 && M.STEAM && steam.every(p => p.alpha === M.STEAM.day.alpha && p.grow === M.STEAM.day.grow && p.fade === true && p.wind === 0.5 && p.turb === 0.35 && p.size >= M.STEAM.day.size && p.size <= M.STEAM.day.size + M.STEAM.day.sizeR);
  check(motes.length > 0 && ok, `every wisp carries the steam's own look, also after the motes (${steam.length} wisps among ${motes.length} motes; alphas ${[...new Set(steam.map(p => p.alpha))].join(', ')})`);
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
