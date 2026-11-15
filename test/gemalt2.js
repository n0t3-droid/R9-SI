// r-gemalt 2 · Gemaltes Licht (src/main/gemalt2.js, gemalt2_gl.js; plan docs/superpowers/plans/2026-11-07-r-gemalt2.md),
// no browser:
//   a  the light ramp: the JS model and the GLSL text agree; three plateaus (shade, half, lit), monotone, soft edges
//   b  the air: model = GLSL text; 0 near, 1 far, monotone, in bands (flat stretches between soft steps)
//   c  the warm / cool key: luma 1; warm light and cool shade at the golden hour and dusk, near-neutral at noon; smooth
//   d  the brush-stroke grass: the placement is deterministic, fewer clumps with distance, none beyond the radius, a clump
//      keeps its spot as the eye moves (only its size changes), inside its column
//   e  trampling: a mark lies flat, then the grass rises; a foot nearby refreshes a mark; a ring of N
//   g  the blob rule (flaw 1 of r-gemalt): a magma / crystal / obsidian block in the soft slope is drawn soft (face 6) in its
//      own colour, the glowing ones with the emissive bit, the slope round it stays smooth (no pinned terrace); a brick in the
//      same spot still pins the ground and stays a cube
//   f  the switches by preset (Very Low, Low off), the defines by program, the rows, the texts, the wiring
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
global.VR = global.VR || {};
global.self = global;
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
const src = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
require(path.join(ROOT, 'src/main/qart3.js'));
require(path.join(ROOT, 'src/main/gemalt.js'));
require(path.join(ROOT, 'src/main/gemalt2.js'));
const G2 = VR.Gemalt2;
check(!!G2, 'VR.Gemalt2 exists');
// a GLSL function as JS: float → let, the built-ins
const glslFn = (text, name) => {
  const m = text.match(new RegExp('float ' + name + '\\(float (\\w+)\\) \\{ ([^\\n]*) \\}'));
  if (!m) return null;
  const body = m[2].replace(/\bfloat /g, 'let ');
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  return new Function('smoothstep', 'clamp', 'floor', 'min', m[1], body).bind(null, ss, (x, a, b) => Math.min(b, Math.max(a, x)), Math.floor, Math.min);
};
console.log('a · the light ramp');
{
  const f = glslFn(G2.glslRamp(), 'gmRamp');
  check(!!f, 'gmRamp parses from the GLSL text');
  let maxD = 0, mono = true, prev = -1;
  for (let i = 0; i <= 200; i++) { const x = i / 200, a = G2.ramp(x), b = f ? f(x) : NaN; maxD = Math.max(maxD, Math.abs(a - b)); if (a < prev - 1e-9) mono = false; prev = a; }
  check(maxD < 1e-3, 'the model and the GLSL text agree', maxD.toExponential(2));
  check(mono, 'monotone');
  const R = G2.RAMP;
  check(G2.ramp(0) === 0 && Math.abs(G2.ramp(1) - 1) < 1e-9, 'shade 0, lit 1');
  const mid = (R.t1 + R.w + R.t2 - R.w) / 2;
  check(Math.abs(G2.ramp(mid) - R.half) < 0.02 && Math.abs(G2.ramp(R.t1 + R.w + 0.01) - G2.ramp(R.t2 - R.w - 0.01)) < 0.02, 'a half band between (a plateau at ' + R.half + ')');
  // soft edges: no jump bigger than 0.04 per 1/200
  let jump = 0; for (let i = 0; i < 200; i++) jump = Math.max(jump, G2.ramp((i + 1) / 200) - G2.ramp(i / 200));
  check(jump < 0.05, 'soft edges', jump.toFixed(3));
}
console.log('b · the air in bands');
{
  const f = glslFn(G2.glslAir(), 'gmAir');
  check(!!f, 'gmAir parses from the GLSL text');
  let maxD = 0, mono = true, prev = -1, flat = 0;
  for (let d = 0; d <= 400; d += 1) { const a = G2.air(d), b = f ? f(d) : NaN; maxD = Math.max(maxD, Math.abs(a - b)); if (a < prev - 1e-9) mono = false; if (d > G2.AIR.d0 && d < G2.AIR.d1 && Math.abs(a - prev) < 1e-4) flat++; prev = a; }
  check(maxD < 1e-3, 'the model and the GLSL text agree', maxD.toExponential(2));
  check(mono && G2.air(0) === 0 && G2.air(G2.AIR.d0) === 0 && Math.abs(G2.air(500) - 1) < 1e-9, 'monotone, 0 near, 1 far');
  check(flat > 30, 'bands: flat stretches between the steps', flat + ' m flat');
}
console.log('c · the warm / cool key');
{
  const L = G2.luma, p = (y) => JSON.parse(JSON.stringify(G2.palette(y)));
  let lumOk = true; for (let y = -0.4; y <= 1; y += 0.05) { const q = p(y); if (Math.abs(L(q.lit) - 1) > 1e-6 || Math.abs(L(q.shade) - 1) > 1e-6) lumOk = false; }
  check(lumOk, 'luma 1 at every hour (the brightness stays)');
  const gold = p(0.12), dusk = p(0.0), noon = p(0.9);
  check(gold.lit[0] > gold.lit[2] * 1.4 && gold.shade[2] > gold.shade[0] * 1.3, 'the golden hour: amber light, blue-violet shade', gold.lit.map(v => v.toFixed(2)) + ' | ' + gold.shade.map(v => v.toFixed(2)));
  check(dusk.lit[0] > dusk.lit[1] && dusk.shade[0] > dusk.shade[1] * 0.98 && dusk.shade[2] > dusk.shade[1] * 1.3, 'dusk: rose light, violet shade');
  check(Math.abs(noon.lit[0] - noon.lit[2]) < 0.35 && Math.abs(noon.shade[0] - noon.shade[2]) < 0.45, 'noon: a whisper warm and cool');
  let jump = 0; for (let y = -0.3; y < 1; y += 0.01) { const a = p(y), b = p(y + 0.01); for (let i = 0; i < 3; i++) jump = Math.max(jump, Math.abs(a.lit[i] - b.lit[i]), Math.abs(a.shade[i] - b.shade[i])); }
  check(jump < 0.05, 'smooth through the day', jump.toFixed(3));
}
console.log('d · the brush-stroke grass: placement');
{
  const R = 18, a = G2.clumps(12, -7, 3, R).map(o => Object.assign({}, o)), b = G2.clumps(12, -7, 3, R).map(o => Object.assign({}, o));
  check(JSON.stringify(a) === JSON.stringify(b) && a.length > 0, 'deterministic', a.length + ' clumps');
  let near = 0, mid = 0, far = 0, beyond = 0, inside = true, size = true;
  for (let x = 0; x < 60; x++) for (let z = 0; z < 60; z++) {
    near += G2.clumps(x, z, 2, R).length; mid += G2.clumps(x, z, 12, R).length; far += G2.clumps(x, z, 17, R).length; beyond += G2.clumps(x, z, R + 0.5, R).length;
    for (const o of G2.clumps(x, z, 5, R)) { if (o.ox < 0 || o.ox > 1 || o.oz < 0 || o.oz > 1) inside = false; if (!(o.s > 0 && o.s <= 1.25)) size = false; }
  }
  check(near > mid && mid > far && far > 0 && beyond === 0, 'fewer with distance, none beyond ' + R + ' m', near + ' > ' + mid + ' > ' + far + ' > ' + beyond);
  check(near === 3600 * G2.TUFT.per, 'near the eye every spot', near);
  check(inside && size, 'inside the column, sizes in range');
  // (classic_v2 found a block grid in the Nahtlos lawn: the clumps kept 0.12 from every border — a bare line round each
  //  block, 9–13 m out it reads as the grid; the clumps now take the whole column, a border no emptier than the middle)
  { let edge = 0, mid2 = 0; for (let x = 0; x < 80; x++) for (let z = 0; z < 80; z++) for (const o of G2.clumps(x, z, 2, R)) { const e = Math.min(o.ox, 1 - o.ox, o.oz, 1 - o.oz); if (e < 0.1) edge++; else if (e > 0.4) mid2++; }
    // (area: the band within 0.1 of a border is 0.36 of the column, the middle square beyond 0.4 is 0.04)
    check(edge / 0.36 > 0.8 * (mid2 / 0.04), 'the clumps as dense at the block borders as in the middle (no grid)', (edge / 0.36).toFixed(0) + ' vs ' + (mid2 / 0.04).toFixed(0)); }
  // the eye moves away: a clump that stays keeps its spot (only its size changes)
  let kept = true; for (let x = 0; x < 30; x++) { const n0 = G2.clumps(x, 5, 6, R), n1 = G2.clumps(x, 5, 11, R); for (const o of n1) if (!n0.some(q => q.ox === o.ox && q.oz === o.oz && q.rot === o.rot)) kept = false; }
  check(kept, 'a clump keeps its spot as the eye moves (no shuffle, no pop)');
  check(G2.tuftR('potato') === 0 && G2.tuftR('low') === 0 && G2.tuftR('balanced') > 0 && G2.tuftR('high') >= 17, 'the radius by preset (none on Very Low / Low; ~18 m on High)');
}
console.log('e · trampling');
{
  const M = [];
  G2.step(M, 5, 5, 10);
  check(Math.abs(G2.trampleAt(5, 5, M, 10.2) - 1) < 1e-9 && G2.trampleAt(5, 5, M, 10 + G2.TRAMPLE.hold + G2.TRAMPLE.rise + 0.1) === 0, 'a mark lies flat, then the grass rises');
  check(G2.trampleAt(6.5, 5, M, 10.2) === 0 && G2.trampleAt(5.2, 5, M, 10.2) > 0.9, 'only round the foot');
  G2.step(M, 5.1, 5.1, 11);
  check(M.length === 1 && M[0][2] === 11, 'a foot nearby refreshes the mark');
  for (let i = 0; i < 40; i++) G2.step(M, i * 2, 0, 12 + i);
  check(M.length === G2.TRAMPLE.n, 'a ring of ' + G2.TRAMPLE.n);
}
console.log('g · the blob rule: natural decor in the soft ground');
{
  const V = require('./load_shared.js');
  const SN = V.SoftNat, PAD = V.MESH_PAD, PS = V.MESH_PS, PSS = PS * PS;
  V.setLook('seamless');
  const st = (n) => V.R.byName[n].defaultState;
  const GRASS = st('grass_block'), DIRT = st('dirt'), STONE = st('stone');
  const job = (fn) => {
    const blocks = new Uint16Array(PSS * PS), light = new Uint16Array(PSS * PS);
    for (let y = -PAD; y < 16 + PAD; y++) for (let z = -PAD; z < 16 + PAD; z++) for (let x = -PAD; x < 16 + PAD; x++) { const pi = (y + PAD) * PSS + (z + PAD) * PS + (x + PAD), b = fn(x, y, z); blocks[pi] = b; light[pi] = b ? 0 : 0xf000; }
    const t = new Uint16Array(PSS).fill(0x4d6a);
    return { blocks, light, grass: t, foliage: t, water: t, sy: 0, ox: 0, oz: 0, smooth: true, fancyLeaves: 64, vxLod: true };
  };
  const hf = (x) => 4 + Math.floor((x + 8) / 2);   // a slope, a step every 2 blocks
  const with_ = (b) => (x, y, z) => { const h = hf(x); if (x === 8 && z === 8 && y === h - 1) return b; return y < h - 3 ? STONE : y < h - 1 ? DIRT : y < h ? GRASS : 0; };
  const quads = (r) => { const a = r.opaque, out = []; for (let o = 0; o < a.length; o += 8) out.push({ x: a[o] / 2048 - 4, y: a[o + 1] / 2048 - 4, z: a[o + 2] / 2048 - 4, w5: a[o + 5], tint: a[o + 7] }); return out; };
  const T = SN.tables();
  for (const nm of ['magma_block', 'violet_crystal_block', 'obsidian']) {
    const b = st(nm), r = V.meshSection(job(with_(b))), q = quads(r);
    const at = q.filter(v => v.x >= 7.4 && v.x <= 9.6 && v.z >= 7.4 && v.z <= 9.6 && v.y >= hf(8) - 1.6);
    const glow = at.filter(v => (v.w5 & 7) === 6 && (v.w5 & 4096)).length, cubes = at.filter(v => (v.w5 & 7) !== 6).length;
    check(T.soft[b] === 1 && cubes === 0, nm + ': drawn soft (no cube faces at its place)', at.length + ' vertices');
    check(nm === 'obsidian' ? glow === 0 : glow >= 4, nm + (nm === 'obsidian' ? ': no glow' : ': its faces glow (the emissive bit)'), glow);
    let mono = true; for (let x = 2; x < 14; x++) if (r.softH[8 * 16 + x + 1] < r.softH[8 * 16 + x] - 1) mono = false;
    let grid = 0; for (const v of at) if (Math.abs(v.x - Math.round(v.x)) < 1e-4 && Math.abs(v.y - Math.round(v.y)) < 1e-4 && Math.abs(v.z - Math.round(v.z)) < 1e-4) grid++;
    check(mono && grid < at.length * 0.5, nm + ': the slope round it stays smooth (no pinned terrace)', grid + ' / ' + at.length + ' on the grid');
  }
  {
    const b = st('stone_bricks'), r = V.meshSection(job(with_(b))), q = quads(r);
    const cube = q.filter(v => (v.w5 & 7) !== 6 && v.x >= 7.9 && v.x <= 9.1 && v.z >= 7.9 && v.z <= 9.1).length;
    check(T.soft[b] === 0 && T.pin[b] === 1 && cube >= 4, 'a brick in the same spot: still a crisp cube that pins the ground', cube);
  }
  // h · flaw 2 (faint steps): an uneven slope's normals keep one tilt — no rows of light and shade down the hill
  console.log('h · uneven slopes: one even light (the 6-column normal)');
  for (const [nm, f, lim] of [['a step every 4 blocks', (x) => 4 + Math.floor((x + 8) / 4), 1.5], ['every 3 blocks', (x) => 4 + Math.floor((x + 9) / 3), 4], ['two in three', (x) => 3 + Math.floor((x + 9) * 2 / 3), 2.5]]) {
    const g = (x, y, z) => { const h = f(x); return y < h - 3 ? STONE : y < h - 1 ? DIRT : y < h ? GRASS : 0; };
    const a = V.meshSection(job(g)).opaque, tl = [];
    for (let o = 0; o < a.length; o += 8) { if ((a[o + 5] & 7) !== 6) continue; const x = a[o] / 2048 - 4, z = a[o + 2] / 2048 - 4; if (x < 1.5 || x > 13.5 || Math.abs(z - 8) > 0.3) continue; const n = SN.unoct(a[o + 4]); tl.push(Math.atan2(Math.hypot(n[0], n[2]), n[1]) * 57.3); }
    const m = tl.reduce((s, v) => s + v, 0) / tl.length, sd = Math.sqrt(tl.reduce((s, v) => s + (v - m) * (v - m), 0) / tl.length);
    check(tl.length > 20 && sd < lim, nm + ': the slope\'s normals within ' + lim + '° (sd)', sd.toFixed(1) + '° over ' + tl.length);
  }
}
console.log('f · switches, defines, rows, texts, wiring');
{
  const d = (p) => G2.defaults(p);
  check(!d('potato').gPaint && !d('low').gTuft && !d('low').gWater && !d('balanced').gPaint && d('balanced').gTuft && d('balanced').gWater && !d('high').gPaint && d('high').gTuft, 'Pinselgras and Gemaltes Wasser on from Balanced up; Gemaltes Licht a look to switch on (off by default); Very Low and Low off');
  check(VR.QArt3.SW.includes('gPaint') && VR.QArt3.defaults('balanced').gTuft === true && VR.QArt3.off().gWater === false && VR.QArt3.ROWS.some(r => r.key === 'gWater'), 'joined to the switch list');
  const s = { gPaint: true, gTuft: true, gWater: true, preset: 'balanced' };
  check(G2.defs('terrain', s).join() === 'GM_PAINT,GM_STROKE' && G2.defs('lod', s).join() === 'GM_PAINT' && G2.defs('trans', s).join() === 'GM_WATER' && G2.defs('terrainCut', s).length === 0, 'the defines by program');
  check(G2.defs('terrain', Object.assign({}, s, { preset: 'potato' })).length === 0 && G2.defs('terrain', Object.assign({}, s, { lite: true })).length === 0 && G2.defs('trans', Object.assign({}, s, { preset: 'low' })).length === 0, 'never on Very Low or Low (no define)');
  check(VR.GL === undefined || typeof VR.GL.defineHook === 'function', 'the hook');
  check(G2.ROWS.map(r => r.cost).join() === 'low,medium,low', 'cost tiers: low, medium, low');
  const de = src('src/main/lang_de.js'), en = src('src/main/lang_en.js');
  check(G2.ROWS.every(r => de.includes("'" + r.lab + "'") && en.includes("'" + r.lab + "'") && de.includes("'" + r.tip + "'") && en.includes("'" + r.tip + "'")), 'the texts in German and English');
  const b = src('build.js'), sh = src('src/main/shaders.js'), rn = src('src/main/renderer.js');
  check(b.includes("'gemalt2'") && b.includes("'gemalt2_gl'"), 'build.js bundles gemalt2, gemalt2_gl');
  check(sh.includes('VR.Gemalt2.glslTerrain()') && sh.includes('VR.Gemalt2.glslWater()') && (sh.match(/gmAirCol\(col, dist, u_fogColor\)/g) || []).length === 2 && sh.includes('gmRamp(ndl * sh)') && sh.includes('gmStroke(alb.rgb') && sh.includes('gmWater(col, wp, vdep'), 'the shaders: terrain bands + key + rim + air, far tiles, lawn strokes, water');
  check(rn.includes('this.gmTuft(E, camPos)'), 'render() draws the grass clumps');
  check(/R\.gmTuft = function[^]*?VR\.LOOK && VR\.LOOK\.ground === false\) return/.test(src('src/main/gemalt2_gl.js')), 'no clumps in the look Klassisch (every block its cube: classic_v2 measures the grid on the lawn)');
  // (run 2: the clumps read pale straw beside the lawn — the column's painted colour is sRGB, the terrain decodes it with
  //  pow 2.2; the clumps must too, or they sit a stop brighter and greyer than the ground they grow from)
  check(/v_col = pow\(a_i1\.rgb, vec3\(2\.2\)\)/.test(src('src/main/gemalt2_gl.js')), 'the clumps decode the painted green like the ground (sRGB → linear)');
  const t = G2.glslTerrain();
  check(t.includes('#ifdef GM_PAINT') && t.includes('#ifdef GM_STROKE') && G2.glslWater().includes('#ifdef GM_WATER'), 'all GLSL behind its define');
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
