// v-look · Filmblick (src/main/look.js, look_gl.js; plan docs/superpowers/plans/2026-11-01-v-look.md), no browser:
//   a  the switches by preset (Very Low and Low none), their settings rows and texts, the presets in game.js
//   b  the composite: with the switches off the same text as without look.js (every preset's set), the defines only on
//      the composite, the #ifs balanced, the GLSL's constants the JS mirrors'
//   c  the palette (JS mirror): a meadow's lime calmed, its luma kept; skin, wood, a lamp, the sky, grey untouched
//   d  the haze and the softening: more with distance, toward the sun warm, nothing at d 0; another world none
//   e  the renderer: look_gl.js wraps post and l2Post; with the switches off the soft copy is never made
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
const hook0 = V.GL.defineHook;
delete require.cache[require.resolve(SRC + '/shaders.js')];
require(SRC + '/look.js');
require(SRC + '/shaders.js');
const S1 = V.SHADERS, L = V.Look;
if (!L) { console.log('VR.Look missing'); console.log('FAILED 1'); process.exit(1); }

function pre(src, defs) {
  const D = new Set(defs);
  const out = [], stack = [];
  const active = () => stack.every(s => s.on);
  const ev = (e) => { const js = e.replace(/defined\s*\(\s*(\w+)\s*\)/g, (m, n) => (D.has(n) ? '1' : '0')).replace(/\b[A-Z_][A-Z_0-9]*\b/g, (n) => (D.has(n) ? '1' : '0')); return !!eval(js.replace(/!/g, '!').replace(/\b([01])\b/g, '$1')); };
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

console.log('a · the switches');
{
  const d = (p) => L.defaults(p);
  check(L.SW.every(k => !d('potato')[k]) && L.SW.every(k => !d('low')[k]), 'Very Low and Low get none of the film look');
  check(d('balanced').lvHaze && d('balanced').lvPal && !d('balanced').lvSoft && !d('balanced').lvWrap, 'Balanced: the two ALU-only parts (haze, palette), no extra pass');
  check(['high', 'ultra', 'ultraLite'].every(p => L.SW.every(k => d(p)[k])), 'High, Ultra, Ultra · Leicht: all four');
  check(L.ROWS.length === L.SW.length && L.ROWS.every(r => L.SW.includes(r.key) && r.cost && r.lab === 'g.set.' + r.key && r.tip === r.lab + '.tip'), 'a settings row with a cost for every switch');
  const de = fs.readFileSync(SRC + '/lang_de.js', 'utf8'), en = fs.readFileSync(SRC + '/lang_en.js', 'utf8');
  const keys = [].concat(...L.ROWS.map(r => [r.lab, r.tip]));
  check(keys.every(k => de.includes("'" + k + "'") && en.includes("'" + k + "'")), 'their texts in German and English', keys.length + ' keys');
  const g = fs.readFileSync(SRC + '/game.js', 'utf8'), b = fs.readFileSync(path.join(__dirname, '..', 'build.js'), 'utf8'), sr = fs.readFileSync(SRC + '/settings_reg.js', 'utf8');
  check(/VR\.Look\.defaults\(p\)/.test(g) && /LV_SW\.includes\(key\)/.test(g) && /for \(const k of LV_SW\) qb\[k\]/.test(g), 'game.js: the presets, a hand change → custom, the renderer gets them');
  check(b.indexOf("'look'") > b.indexOf("'sky3'") && b.indexOf("'look'") < b.indexOf("'shaders'") && b.indexOf("'look_gl'") > b.indexOf("'renderer'"), 'build.js: look before shaders, look_gl after the renderer');
  check(/VR\.Look\.ROWS/.test(sr), 'settings_reg.js shows the rows');
  check(L.key({ lvHaze: true, lvSoft: true }) === '101000' && L.key(null) === '000000', 'the key (the renderer rebuilds its programs when it changes)');
}

console.log('b · the composite');
{
  const comp0 = S0.COMPOSITE_FS, comp1 = S1.COMPOSITE_FS;
  // the defines every preset's composite can get from the other fronts (light2, sky3)
  const base = [[], ['GRADE2'], ['GRADE2', 'L2VOL'], ['L2VOL']];
  let same = 0;
  for (const set of base) if (pre(comp0, set) === pre(comp1, set)) same++;
  check(same === base.length, 'switches off: the composite is the same text as before (' + base.length + ' sets)', same + '/' + base.length);
  L.use(L.off());
  check(L.definesFor('composite').length === 0 && L.definesFor('terrain', L.defaults('high')).join() === 'LV_MEADOW' && L.definesFor('terrainCut', L.defaults('high')).length === 0, 'off: no defines; on: none outside the composite (v-look2: the opaque terrain\'s LV_MEADOW)');
  const dh = L.definesFor('composite', L.defaults('high')), db = L.definesFor('composite', L.defaults('balanced'));
  check(dh.join() === 'LV_HAZE,LV_PAL,LV_SOFT,LV_WRAP,LV_TONE,LOOKV' && db.join() === 'LV_HAZE,LV_PAL,LV_TONE,LOOKV', 'the defines', dh.join() + ' | ' + db.join());
  let ok = 0; const sets = [db, dh, ['LV_PAL', 'LOOKV'], ['LV_SOFT', 'LOOKV'], ['LV_WRAP', 'LOOKV'], ['LV_HAZE', 'LOOKV']];
  for (const s of sets) { try { const t = pre(comp1, s.concat(['GRADE2'])); if (/lvHdr\(c, uv\)/.test(t) && /lvPal\(c\)/.test(t) && t.includes('vec3 lvHdr(') && t.includes('vec3 lvPal(')) ok++; } catch (e) { console.log('    ' + e.message); } }
  check(ok === sets.length, 'every switch set preprocesses with both calls and both functions', ok + '/' + sets.length);
  // the defineHook chain: the earlier hooks still run (light2 → sky3 → look)
  L.use(L.defaults('high'));
  const t = V.GL.defineHook('composite', ['X']);
  check(t.includes('X') && t.includes('LOOKV') && typeof hook0 === 'function', 'the define hook chains after the others', t.join());
  L.use(L.off());
  check(V.GL.defineHook('composite', ['X']).join() === hook0('composite', ['X']).join(), 'off: the chain gives what it gave before');
  const g = L.glslComposite();
  check(['62.0, 85.0', '150.0, 172.0', '0.08, 0.3', '0.18, 0.62', '1.6, 4.0', 'max(dot(rd, u_lvSun), 0.0), 6.0'].every(s => g.includes(s)), 'the GLSL uses the mirrors\' constants');
}

console.log('c · the palette');
{
  const p = L.frame({ sunDir: [0.6, 0.15, 0.2], sunColor: [1.4, 1.1, 0.7], fogColor: [0.7, 0.6, 0.7], dimId: 0 }).pal;
  const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], chroma = (c) => Math.max(...c) - Math.min(...c);
  const lime = [0.25, 0.78, 0.12], shade = [0.06, 0.3, 0.05];
  const a = L.pal(lime, p), b = L.pal(shade, p);
  check(chroma(a) < chroma(lime) * 0.85 && Math.abs(lum(a) - lum(lime)) < 0.01, 'a lit meadow\'s lime calmed, its luma kept', JSON.stringify(a.map(r3)));
  check(a[0] / a[1] > lime[0] / lime[1], 'in the light it leans warm (toward sap green)');
  check(b[2] - b[0] > shade[2] - shade[0] && Math.abs(lum(b) - lum(shade)) < 0.01, 'in the shade it leans teal', JSON.stringify(b.map(r3)));
  const keep = { skin: [0.85, 0.62, 0.48], wood: [0.5, 0.33, 0.18], lamp: [1.0, 0.75, 0.3], sky: [0.45, 0.6, 0.95], grey: [0.5, 0.5, 0.5], cyan: [0.1, 0.85, 0.9], pink: [0.95, 0.6, 0.8] };
  let kept = 0; for (const k in keep) { const o = L.pal(keep[k], p); if (o.every((v, i) => Math.abs(v - keep[k][i]) < 1e-6)) kept++; else console.log('    changed ' + k + ' ' + JSON.stringify(o)); }
  check(kept === Object.keys(keep).length, 'skin, wood, a lamp, the sky, grey, the neon cyan, pink: untouched', kept + '/' + Object.keys(keep).length);
  const off = L.pal(lime, [p[0], p[1], p[2], 0]);
  check(off.every((v, i) => v === lime[i]), 'another world (w 0): untouched');
}

console.log('d · the haze, the softening, the wrap');
{
  const golden = L.frame({ sunDir: [0.97, 0.12, 0.2], sunColor: [1.5, 1.0, 0.55], fogColor: [0.8, 0.65, 0.75], dimId: 0 });
  const noon = L.frame({ sunDir: [0.2, 0.95, 0.2], sunColor: [1.3, 1.25, 1.15], fogColor: [0.6, 0.72, 0.9], dimId: 0 });
  const other = L.frame({ sunDir: [0.2, 0.95, 0.2], sunColor: [1, 1, 1], fogColor: [0.5, 0.5, 0.5], dimId: 3 });
  const h0 = L.hazeK(0, 1, golden.haze), h1 = L.hazeK(80, 1, golden.haze), h2 = L.hazeK(400, 1, golden.haze), hs = L.hazeK(400, -0.5, golden.haze);
  check(h0.sun === 0 && h0.sky === 0, 'nothing at the eye');
  check(h1.sun < h2.sun && h2.sun > 0.2 && h2.sun <= 0.6, 'toward the sun more with distance (80 m ' + r3(h1.sun) + ', 400 m ' + r3(h2.sun) + ')');
  check(hs.sun === 0 && hs.sky > 0.05 && hs.sky < 0.3, 'away from the sun only the cool veil', r3(hs.sky));
  check(golden.warm[0] > golden.warm[2] * 1.4 && golden.haze[1] > noon.haze[1], 'the golden hour\'s veil warm and stronger than noon\'s', JSON.stringify(golden.warm.map(r3)));
  check(other.haze[1] === 0 && other.haze[2] === 0 && other.pal[3] === 0 && other.soft[2] === 0 && other.soft[3] === 0, 'another world: none of it');
  const s = golden.soft;
  check(L.softK(20, s) === 0 && L.softK(1000, s) === s[2] && L.softK(120, s) > 0 && L.softK(120, s) < s[2], 'the softening: none near (20 m), full far, between at 120 m');
  check(L.wrapK(10, 12, s) === 0 && L.wrapK(10, 1200, s) === s[3], 'the wrap: only where a far neighbour lies behind the edge');
  const rain = L.frame({ sunDir: [0.97, 0.12, 0.2], sunColor: [1.5, 1.0, 0.55], fogColor: [0.8, 0.65, 0.75], dimId: 0, rain: 1 });
  check(rain.haze[1] < golden.haze[1] * 0.5, 'rain: the sun\'s veil mostly gone');
  const o = L.frame({ sunDir: [0.2, 0.95, 0.2], sunColor: [1, 1, 1], fogColor: [0.5, 0.5, 0.5], dimId: 0 }, golden);
  check(o === golden, 'frame() reuses its object (no allocation a frame)');
}

console.log('e · the renderer');
{
  require(SRC + '/water_fx.js'); require(SRC + '/skybodies.js'); require(SRC + '/clouds.js'); require(SRC + '/props.js'); require(SRC + '/props2.js');
  require(SRC + '/tex_pbr.js'); require(SRC + '/bench.js'); require(SRC + '/ultralite.js'); require(SRC + '/ipu.js'); require(SRC + '/renderer.js'); require(SRC + '/light2_gl.js');
  const R = V.Renderer.prototype, post0 = R.post, l2p0 = R.l2Post;
  require(SRC + '/look_gl.js');
  check(R.post !== post0 && R.l2Post !== l2p0 && typeof R.lvPre === 'function', 'look_gl.js wraps post and l2Post');
  // a renderer with the switches off: the wrapper goes straight to the old post (it throws on this stub: no GL)
  let made = 0;
  const r = Object.create(R); r.q = L.off(); r.lvPre = function () { made++; };
  try { R.post.call(r, {}, { dimId: 0 }); } catch (e) { /* the old post on no GL */ }
  check(made === 0 && r.lvOn === false, 'switches off: no soft copy, nothing of the look this frame');
  const r2 = Object.create(R); r2.q = L.defaults('balanced'); r2.hdr = true; r2.sceneDepth = {}; let t2 = 0; r2.lvTarget = () => { t2++; return null; };
  r2.lvPre({}, { dimId: 0, sunDir: [0, 1, 0], sunColor: [1, 1, 1], fogColor: [0.5, 0.5, 0.5] });
  check(r2.lvOn === true && t2 === 0 && r2.lvSoftOn === false, 'Balanced: on, no soft copy asked for');
  const r3_ = Object.create(R); r3_.q = L.defaults('high'); r3_.hdr = true; r3_.sceneDepth = {}; let t3 = 0; r3_.lvTarget = () => { t3++; return null; };
  r3_.lvPre({}, { dimId: 0, sunDir: [0, 1, 0], sunColor: [1, 1, 1], fogColor: [0.5, 0.5, 0.5] });
  check(r3_.lvOn === true && t3 === 1, 'High: the soft copy asked for');
  r3_.lvPre({ underwater: true }, { dimId: 0, sunDir: [0, 1, 0], sunColor: [1, 1, 1], fogColor: [0.5, 0.5, 0.5] });
  check(t3 === 1, 'under water: no soft copy');
  // a switch changed: only the composite rebuilt (the other programs kept)
  let full = 0; const rr = Object.create(R); rr.q = L.defaults('high'); rr.P = { composite: { p: 1 }, terrain: { p: 2 } }; rr.buildPrograms = () => { full++; };
  const t0 = rr.P.terrain, gp = V.GL.program; let asked = ''; V.GL.program = (vs, fs, name) => { asked += name; return { p: 3 }; };
  try { rr.lvRebuild(); } finally { V.GL.program = gp; }
  check(full === 0 && rr.P.terrain === t0 && asked === 'composite' && rr.P.composite.p === 3 && rr.lvKey === '111111', 'a switch changed: the composite alone again (key ' + rr.lvKey + ')');
  check(/this\.lvRebuild\(\)/.test(fs.readFileSync(SRC + '/renderer.js', 'utf8')), 'renderer.setQuality asks for it');
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
