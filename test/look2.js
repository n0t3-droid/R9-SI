// v-look2 · the Filmblick at night and on the other worlds, the calm meadow (src/main/look.js, look_gl.js; plan
// docs/superpowers/plans/2026-11-01-v-look2.md), no browser:
//   a  the two new switches (lvTone Mondlicht & Weltenfarben, lvMeadow Wiesenruhe): Very Low and Low none, Balanced+ on,
//      rows with costs, texts in German and English
//   b  the worlds: Herzwelt, the five bodies, the stations — each its own palette; the airless ones no haze (no air)
//   c  the tone (JS mirror of the GLSL): night silver-blue, warm lamps kept warm, the sky never pitch black, the land's
//      silhouette darker than the sky; Herzwelt's noon untouched; Aquamarin turquoise-gold, Ocker amber, Zinnober rose
//      at night, Opal pearl, Basalt blue-violet, the station warm lamps over teal shade
//   d  the shaders: composite and terrain text unchanged with the switches off; LV_TONE only on the composite, LV_MEADOW
//      only on the opaque terrain; the GLSL carries the mirrors' constants
//   e  the renderer: the look on the planets and in the station; a meadow switch rebuilds all programs, a tone switch the
//      composite alone; the terrain's meadow uniform set through common()
const fs = require('fs'), path = require('path');
const V = require('./load_shared.js');
global.window = { devicePixelRatio: 1, screen: { width: 1280, height: 720 } };
global.WebGLFramebuffer = class {};
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
const r3 = (x) => Math.round(x * 1000) / 1000;
const SRC = path.join(__dirname, '..', 'src', 'main');

require(SRC + '/gl.js');
require(SRC + '/light2.js');
require(SRC + '/sky3.js');
require(SRC + '/shaders.js');
const S0 = Object.assign({}, V.SHADERS);
delete require.cache[require.resolve(SRC + '/shaders.js')];
require(SRC + '/look.js');
require(SRC + '/shaders.js');
const S1 = V.SHADERS, L = V.Look;

function pre(src, defs) {
  const D = new Set(defs);
  const out = [], stack = [];
  const active = () => stack.every(s => s.on);
  const ev = (e) => !!eval(e.replace(/defined\s*\(\s*(\w+)\s*\)/g, (m, n) => (D.has(n) ? '1' : '0')).replace(/\b[A-Z_][A-Z_0-9]*\b/g, (n) => (D.has(n) ? '1' : '0')));
  for (const line of src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n')) {
    const t = line.trim(); let m;
    if ((m = /^#ifdef\s+(\w+)/.exec(t))) { const on = D.has(m[1]); stack.push({ on, done: on }); continue; }
    if ((m = /^#ifndef\s+(\w+)/.exec(t))) { const on = !D.has(m[1]); stack.push({ on, done: on }); continue; }
    if ((m = /^#if\s+(.*)$/.exec(t))) { const on = ev(m[1]); stack.push({ on, done: on }); continue; }
    if ((m = /^#elif\s+(.*)$/.exec(t))) { const s = stack[stack.length - 1]; if (s.done) s.on = false; else { s.on = ev(m[1]); s.done = s.on; } continue; }
    if (/^#else/.test(t)) { const s = stack[stack.length - 1]; s.on = !s.done; s.done = true; continue; }
    if (/^#endif/.test(t)) { stack.pop(); continue; }
    if (!active()) continue;
    const c = line.replace(/\/\/.*$/, '').trim(); if (c) out.push(c);
  }
  if (stack.length) throw new Error('unbalanced #if');
  return out.join('\n');
}
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const hue = (c) => { const mx = Math.max(...c), mn = Math.min(...c), d = mx - mn || 1e-6; let h = mx === c[0] ? ((c[1] - c[2]) / d) % 6 : mx === c[1] ? (c[2] - c[0]) / d + 2 : (c[0] - c[1]) / d + 4; return (h * 60 + 360) % 360; };

console.log('a · the switches');
{
  const d = (p) => L.defaults(p);
  check(L.SW.includes('lvTone') && L.SW.includes('lvMeadow'), 'two new switches: lvTone, lvMeadow');
  check(['potato', 'low'].every(p => !d(p).lvTone && !d(p).lvMeadow), 'Very Low and Low: neither');
  check(['balanced', 'high', 'ultra', 'ultraLite'].every(p => d(p).lvTone && d(p).lvMeadow), 'Balanced and up: both (ALU and one coarse texture tap)');
  const de = fs.readFileSync(SRC + '/lang_de.js', 'utf8'), en = fs.readFileSync(SRC + '/lang_en.js', 'utf8');
  const rows = L.ROWS.filter(r => r.key === 'lvTone' || r.key === 'lvMeadow');
  check(rows.length === 2 && rows.every(r => r.cost && r.lab === 'g.set.' + r.key), 'their settings rows with a cost');
  const keys = [].concat(...rows.map(r => [r.lab, r.tip]));
  check(keys.every(k => de.includes("'" + k + "'") && en.includes("'" + k + "'")), 'their texts in German and English', keys.length + ' keys');
}

console.log('b · the worlds');
{
  check(L.world('overworld') === 'home' && L.world('flat') === 'home' && L.world(undefined) === 'home', 'Herzwelt (and a flat world): home');
  check(['aqua', 'ocker', 'zinn', 'opal', 'basalt'].every(k => L.world(k) === k), 'the five bodies by their dim');
  check(L.world('stn.ring') === 'station' && L.world('stn.opal') === 'station', 'the stations: station');
  check(L.world('underforge') === null && L.world('hollow') === null && L.world('drift') === null && L.world('rock.a') === null, 'the other dims: none (as before)');
  const E = (dim, sy, extra) => Object.assign({ sunDir: [0.6, sy, 0.3], sunColor: [1.2, 1.1, 1.0], fogColor: [0.6, 0.6, 0.65], dimId: dim === 'home' ? 0 : 5, lvWorld: dim, night: sy < 0 ? 1 : 0 }, extra || {});
  const f = (w, sy, x) => L.frame(E(w, sy, x));
  for (const w of ['basalt', 'opal', 'zinn', 'station']) check(f(w, 0.5).haze[1] === 0 && f(w, 0.5).haze[2] === 0, w + ': no haze (no air)');
  check(f('aqua', 0.5).haze[2] > 0 && f('ocker', 0.5).haze[2] > 0, 'Aquamarin and Ocker: their air\'s haze');
  const oc = f('ocker', 0.4, { fogColor: [0.4, 0.5, 0.7] });
  check(oc.cool[0] > oc.cool[2] * 1.2 && oc.warm[0] > oc.warm[2] * 1.2, 'Ocker: both veils amber dust (not the home sky\'s blue)', JSON.stringify(oc.cool.map(r3)));
  check(['aqua', 'ocker', 'zinn', 'opal', 'basalt', 'station'].every(w => f(w, 0.5).pal[3] === 0), 'the meadow palette only at home');
  check(f('station', 0.5).soft[2] === 0 && f('station', 0.5).soft[3] === 0, 'the station: no far softening, no wrap (a room)');
  check(f('home', 0.8).tone[3] === 0 || f('home', 0.8).toneS[3] < 0.02, 'Herzwelt at noon: no tone');
  check(f('home', -0.6).toneS[3] > 0.3, 'Herzwelt at night: the moonlit tone', r3(f('home', -0.6).toneS[3]));
  const o = L.frame(E('aqua', 0.5)); check(L.frame(E('ocker', 0.5), o) === o, 'frame() reuses its object');
}

console.log('c · the tone');
{
  const E = (w, sy, n) => ({ sunDir: [0.6, sy, 0.3], sunColor: [1, 1, 1], fogColor: [0.5, 0.55, 0.6], dimId: w === 'home' ? 0 : 5, lvWorld: w, night: n === undefined ? (sy < 0 ? 1 : 0) : n });
  const night = L.frame(E('home', -0.6));
  const grey = L.tone([0.25, 0.25, 0.25], night, 0), lamp = L.tone([0.95, 0.62, 0.25], night, 0), black = L.tone([0, 0, 0], night, 0), sky = L.tone([0, 0, 0.005], night, 1);
  check(grey[2] > grey[0] * 1.08 && Math.abs(lum(grey) - 0.25) < 0.06, 'night: a grey mid-tone silver-blue, its brightness about kept', JSON.stringify(grey.map(r3)));
  check(lamp[0] > lamp[2] * 2.5 && hue(lamp) < 45, 'night: a lamp stays warm', JSON.stringify(lamp.map(r3)));
  check(lum(black) > 0.008 && lum(black) < 0.05 && black[2] > black[0], 'night: the land\'s black lifted a little, blue', JSON.stringify(black.map(r3)));
  check(lum(sky) > lum(black) * 2 && lum(sky) > 0.05 && sky[2] > sky[0], 'night: the sky never pitch black — and brighter than the land (silhouettes)', JSON.stringify(sky.map(r3)));
  const noon = L.frame(E('home', 0.8));
  const c0 = [0.4, 0.5, 0.3], c1 = L.tone(c0, noon, 0);
  check(c1.every((v, i) => Math.abs(v - c0[i]) < 1e-6), 'noon at home: untouched');
  const mid = [0.2, 0.2, 0.2], hi = [0.7, 0.7, 0.7];
  const aq = L.frame(E('aqua', 0.5)), a0 = L.tone(mid, aq, 0), a1 = L.tone(hi, aq, 0);
  check(a0[1] > a0[0] && a0[2] > a0[0] && a1[0] > a1[2], 'Aquamarin: turquoise shade, gold light', JSON.stringify([a0, a1].map(c => c.map(r3))));
  const oc = L.frame(E('ocker', 0.5)), o1 = L.tone(hi, oc, 0), o0 = L.tone(mid, oc, 0);
  check(o1[0] > o1[2] * 1.08 && o0[0] > o0[2], 'Ocker: amber', JSON.stringify(o1.map(r3)));
  const zn = L.frame(E('zinn', -0.5, 1)), z0 = L.tone(mid, zn, 0), zd = L.tone(mid, L.frame(E('zinn', 0.5, 0)), 0);
  check(z0[0] > z0[1] * 1.1 && z0[2] > z0[1] && z0[0] - z0[1] > zd[0] - zd[1], 'Zinnober at night: ember-rose', JSON.stringify(z0.map(r3)));
  const op = L.frame(E('opal', 0.5)), p0 = L.tone([0.05, 0.05, 0.05], op, 0), p1 = L.tone(hi, op, 0);
  check(lum(p0) > 0.07 && Math.max(...p1) - Math.min(...p1) < 0.06, 'Opal: pearl — the shade lifted, the light near white', JSON.stringify([p0, p1].map(c => c.map(r3))));
  const ba = L.frame(E('basalt', 0.5)), b0 = L.tone(mid, ba, 0);
  check(b0[2] > b0[0] * 1.1 && b0[0] >= b0[1] * 0.98, 'Basalt: deep blue-violet shade', JSON.stringify(b0.map(r3)));
  const st = L.frame(E('station', 0.5)), s0 = L.tone(mid, st, 0), s1 = L.tone(hi, st, 0), sl = L.tone([0.9, 0.6, 0.3], st, 0);
  check(s0[2] > s0[0] && s1[0] > s1[2] && sl[0] > sl[2] * 2.2, 'the station: teal shade, warm light, the café lamps warm', JSON.stringify([s0, s1].map(c => c.map(r3))));
  // the glow of warm lamps (High, from the soft copy): only warm and bright
  const neon = L.tone([0.1, 0.85, 0.95], night, 0);
  check(neon[1] > 0.75 && neon[2] > 0.85 && neon[0] < 0.2, 'night: a bright neon keeps its colour', JSON.stringify(neon.map(r3)));
  check(['0.3, 0.6', '0.55, 0.85'].every(x => L.glslComposite().includes(x)), 'the GLSL spares bright lights with the mirror\'s constants');
  check(L.glowW([1.4, 0.8, 0.3]) > 0.5 && L.glowW([0.4, 0.5, 0.9]) === 0 && L.glowW([0.02, 0.012, 0.005]) < 0.1, 'the lamps\' soft glow: warm bright light only');
}

console.log('d · the shaders');
{
  const base = [[], ['GRADE2'], ['GRADE2', 'L2VOL'], ['L2VOL']];
  let same = 0; for (const set of base) if (pre(S0.COMPOSITE_FS, set) === pre(S1.COMPOSITE_FS, set)) same++;
  check(same === base.length, 'off: the composite the same text', same + '/' + base.length);
  const tb = [[], ['FADE'], ['FADE', 'LIGHT2', 'TEXHI'], ['FADE', 'CUTOUT'], ['MODEL']];
  let ts = 0; for (const set of tb) if (pre(S0.TERRAIN_FS, set) === pre(S1.TERRAIN_FS, set)) ts++;
  check(ts === tb.length, 'off: the terrain the same text', ts + '/' + tb.length);
  const hi = L.defaults('high');
  L.use(hi);
  check(L.definesFor('composite').includes('LV_TONE') && L.definesFor('composite').includes('LOOKV'), 'the composite gets LV_TONE');
  check(L.definesFor('terrain').join() === 'LV_MEADOW' && L.definesFor('terrainCut').length === 0 && L.definesFor('shipOpaque').length === 0 && L.definesFor('trans').length === 0, 'LV_MEADOW only on the opaque terrain');
  L.use(L.off());
  let ok = 0;
  for (const s of [['FADE', 'LV_MEADOW'], ['FADE', 'LV_MEADOW', 'TEXHI', 'LIGHT2']]) { try { const t = pre(S1.TERRAIN_FS, s); if (t.includes('u_lvMeadow') && /textureLod\(/.test(t)) ok++; } catch (e) { console.log('    ' + e.message); } }
  check(ok === 2, 'the meadow branch preprocesses (with and without the hero textures)');
  check(/u_lvMeadow\.w > 0\.0 && u_blockVar < 0\.5/.test(S1.TERRAIN_FS), 'never in the Klassisch look (its crisp 16-texel ground and block grid stay — classic_v2)');
  try { const t = pre(S1.COMPOSITE_FS, ['GRADE2', 'LV_TONE', 'LOOKV']); check(/lvTone\(c\)/.test(t) && t.includes('vec3 lvTone('), 'the tone runs in the composite (display space)'); } catch (e) { check(false, 'the tone preprocesses: ' + e.message); }
  const g = L.glslComposite();
  check(['0.04, 0.55', '0.12, 0.4', '0.15, 0.5'].every(s => g.includes(s)), 'the GLSL uses the tone mirror\'s constants');
}

console.log('e · the renderer');
{
  require(SRC + '/water_fx.js'); require(SRC + '/skybodies.js'); require(SRC + '/clouds.js'); require(SRC + '/props.js'); require(SRC + '/props2.js');
  require(SRC + '/tex_pbr.js'); require(SRC + '/bench.js'); require(SRC + '/ultralite.js'); require(SRC + '/ipu.js'); require(SRC + '/renderer.js'); require(SRC + '/light2_gl.js');
  require(SRC + '/look_gl.js');
  const R = V.Renderer.prototype;
  const env = (dimId) => ({ dimId, sunDir: [0, 1, 0], sunColor: [1, 1, 1], fogColor: [0.5, 0.5, 0.5], night: 0 });
  V.game = { dim: 'aqua' };
  const r = Object.create(R); r.q = L.defaults('balanced'); r.hdr = true; r.sceneDepth = {};
  r.lvPre({}, env(5)); check(r.lvOn === true && r.lvWorld === 'aqua', 'on Aquamarin: on, its palette');
  V.game.dim = 'stn.ring'; r.lvPre({}, env(5)); check(r.lvOn === true && r.lvWorld === 'station', 'in the station: on');
  V.game.dim = 'underforge'; r.lvPre({}, env(1)); check(r.lvOn === false, 'the Underforge: off (as before)');
  V.game.dim = 'overworld'; r.lvPre({}, env(0)); check(r.lvOn === true && r.lvWorld === 'home', 'Herzwelt: on');
  // switch changes: the meadow → every program (the terrain's define), the tone → the composite alone
  const gp = V.GL.program;
  const mk = (q0) => { const x = Object.create(R); x.q = q0; x.P = { composite: { p: 1 }, terrain: { p: 2 } }; x.full = 0; x.buildPrograms = function () { this.full++; }; return x; };
  const a = mk(Object.assign(L.defaults('high'), { lvMeadow: false })); a.lvKey = L.key(a.q); a.q = L.defaults('high');
  V.GL.program = () => ({ p: 3 }); try { a.lvRebuild(); } finally { V.GL.program = gp; }
  check(a.full === 1, 'the meadow switched: every program again (the terrain\'s define)');
  const b = mk(Object.assign(L.defaults('high'), { lvTone: false })); b.lvKey = L.key(b.q); b.q = L.defaults('high');
  V.GL.program = () => ({ p: 3 }); try { b.lvRebuild(); } finally { V.GL.program = gp; }
  check(b.full === 0 && b.P.composite.p === 3, 'the tone switched: the composite alone');
  // common(): the meadow uniform on a program that has it
  const set = []; const c = Object.create(R); c.q = L.defaults('high'); c.lvOn = true; c.lvWorld = 'home'; c.lv = L.frame(Object.assign(env(0), { lvWorld: 'home' }));
  c.gl = { uniform4f: (u, x, y, z, w) => set.push([u, x, y, z, w]) };
  c.lvUniforms({ u: { u_lvMeadow: 'M' } }, env(0));
  check(set.length === 1 && set[0][0] === 'M' && set[0][4] === 1, 'the terrain\'s meadow uniform set (on at home)', JSON.stringify(set[0]));
  set.length = 0; c.lvWorld = 'aqua'; c.lvUniforms({ u: { u_lvMeadow: 'M' } }, env(5));
  check(set.length === 1 && set[0][4] === 0, 'off on another world (no meadows there)');
  check(/lvUniforms/.test(fs.readFileSync(SRC + '/look_gl.js', 'utf8')) && /R\.common = function/.test(fs.readFileSync(SRC + '/look_gl.js', 'utf8')), 'look_gl.js wraps common()');
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
