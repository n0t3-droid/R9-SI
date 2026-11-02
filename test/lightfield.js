// v-light · Lichtpfützen (src/main/lightfield.js, lightfield_gl.js; plan docs/superpowers/plans/2026-11-02-v-light.md),
// no browser:
//   a  the switch: Very Low, Low and Balanced off, High and up on; the row (Bild · Licht & Schatten) with its cost; the
//      texts in German and English
//   b  the disc: every cell's parent nearer the light; the falloff 1 at the light, falling, 0 at the radius
//   c  the field on a stub world: a lantern lights its street, a wall casts a shadow (the wall's own face lit, behind it
//      dark), glass passes the light, the height channel holds the lantern's height; a moving light comes and goes with
//      its frame; the window moves (toroidal) and the light stays where it is in the world; a jump clears the field
//   d  the costs: a frame's scan + restamp + compose (JS) within budget
//   e  the shaders: LFIELD only on its programs and only with the switch; with it off every program's text the same as
//      without lightfield.js; the GLSL's shape (vertical falloff, cosine) as the JS mirror
const path = require('path');
const V = require('./load_shared.js');
global.window = { devicePixelRatio: 1, screen: { width: 1280, height: 720 } };
global.WebGLFramebuffer = class {};
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
const r3 = (x) => Math.round(x * 1000) / 1000;
const SRC = path.join(__dirname, '..', 'src', 'main');

require(SRC + '/gl.js'); require(SRC + '/light2.js'); require(SRC + '/sky3.js'); require(SRC + '/look.js');
require(SRC + '/shaders.js');
const S0 = Object.assign({}, V.SHADERS);
delete require.cache[require.resolve(SRC + '/shaders.js')];
require(SRC + '/lightfield.js');
require(SRC + '/shaders.js');
const S1 = V.SHADERS, LF = V.LField, R = V.R;

console.log('a · the switch');
check(!LF.defaults('potato').lfPools && !LF.defaults('low').lfPools && !LF.defaults('balanced').lfPools, 'Very Low, Low, Balanced: off');
check(LF.defaults('high').lfPools && LF.defaults('ultra').lfPools && LF.defaults('ultraLite').lfPools, 'High, Ultra, Ultra · Leicht: on');
const row = LF.ROWS_SET[0];
check(row.key === 'lfPools' && row.g === 'img' && row.sec === 'light' && row.cost === 'mid', 'the row: Bild · Licht & Schatten, cost mid');
const fs = require('fs'), de = fs.readFileSync(SRC + '/lang_de.js', 'utf8'), en = fs.readFileSync(SRC + '/lang_en.js', 'utf8');
check(/'g\.set\.lfPools': 'Lichtpfützen'/.test(de) && /'g\.set\.lfPools\.tip'/.test(de) && /'g\.set\.lfPools'/.test(en) && /'g\.set\.lfPools\.tip'/.test(en), 'the texts: German „Lichtpfützen" and English');

console.log('b · the disc');
const D = LF.disc(14);
let parOk = true; for (let i = 1; i < D.n; i++) if (!(D.par[i] < i) || !(D.dist[D.par[i]] < D.dist[i])) parOk = false;
check(parOk, 'every cell\'s parent is nearer the light', D.n + ' cells');
let maxStep = 0; for (let i = 1; i < D.n; i++) { const p = D.par[i]; maxStep = Math.max(maxStep, Math.hypot(D.ox[i] - D.ox[p], D.oz[i] - D.oz[p])); }
check(maxStep < 1.5, 'a parent is a neighbour', r3(maxStep));
const K = LF.K;
check(LF.fall(0, 14, K.k) === 1 && LF.fall(5, 14, K.k) < LF.fall(3, 14, K.k) && LF.fall(14, 14, K.k) === 0, 'the falloff: 1, falling, 0 at the radius', [3, 5, 10].map(d => r3(LF.fall(d, 14, K.k))).join(' '));

console.log('c · the field on a stub world');
const stone = R.S('stone'), lantern = R.S('lantern'), glass = R.S('glass');
check(!!(R.T.flags[stone] & 2) && !(R.T.flags[glass] & 2) && R.T.emit[lantern] > 0, 'the tables: stone opaque, glass not, the lantern gives light', R.T.emit[lantern].toString(16));
const cols = new Map(), Hc = 128;
const colAt = (kx, kz) => { const k = kx + ',' + kz; let c = cols.get(k); if (!c) { c = { blocks: new Uint16Array(Hc << 8), H: Hc }; for (let i = 0; i < 256; i++) for (let y = 0; y < 64; y++) c.blocks[(y << 8) | i] = stone; cols.set(k, c); } return c; };
const set = (x, y, z, s) => { const c = colAt(x >> 4, z >> 4); c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)] = s; };
// ground at y 63 (top), the eye at 65; a lantern at (5, 66, 5); a wall x = 9, z −10 … 20, y 64 … 70; a window (glass) at z 1 … 4
set(5, 66, 5, lantern);
for (let z = -10; z <= 20; z++) for (let y = 64; y <= 70; y++) set(9, y, z, z >= 1 && z <= 4 && y >= 65 && y <= 67 ? glass : stone);
const f = new LF.Field();
const col = (kx, kz) => colAt(kx, kz);
f.center(4.5, 65.6, 4.5);
const fill = () => { for (let i = 0; i < 32; i++) f.scan(col, R.T, 4); for (let i = 0; i < 40; i++) if (f.rebuild(48)) break; f.compose(); };
fill();
const at = (x, z) => LF.decode(f.out, (z & 127) * 128 + (x & 127), f.Y0);
const lum = (c) => c.r + c.g + c.b;
const L0 = at(5, 5), Lnear = at(2, 5), Lwall = at(9, 5), Lbehind = at(12, 5), Lfront = at(1, 5), Lwin = at(12, 2), Lfar = at(5, 30);
console.log('     light: at ' + r3(lum(L0)) + ' · 3 m ' + r3(lum(Lnear)) + ' · the wall ' + r3(lum(Lwall)) + ' · behind it ' + r3(lum(Lbehind)) + ' · 4 m the open side ' + r3(lum(Lfront)) + ' · behind the window ' + r3(lum(Lwin)) + ' · 25 m ' + r3(lum(Lfar)));
check(lum(L0) > 0.8 && lum(Lnear) > 0.2 && lum(Lnear) < lum(L0), 'the lantern lights its street, falling off');
check(L0.r > L0.b, 'warm (the lantern\'s colour)', [r3(L0.r), r3(L0.g), r3(L0.b)].join(' '));
check(lum(Lwall) > 0.1, 'the wall\'s own face is lit');
check(lum(Lbehind) < 0.01 && lum(Lfront) > 0.15, 'behind the wall dark, the open side at that distance lit');
check(lum(Lwin) > 0.05, 'the window passes the light through the wall');
check(lum(Lfar) < 0.005, 'beyond the radius nothing');
check(Math.abs(L0.h - 66.5) < 0.6, 'the height channel: the lantern\'s height', r3(L0.h));
f.add(30.5, 66, 30.5, 1, 0.6, 0.3, 10); f.compose();
const Ld = at(30, 30); check(lum(Ld) > 0.8, 'a moving light lights its place this frame', r3(lum(Ld)));
f.clearDyn(); f.compose(); check(lum(at(30, 30)) < 0.005, 'and is gone the next');
f.center(14.5, 65.6, 4.5); fill();
check(Math.abs(lum(at(5, 5)) - lum(L0)) < 0.02 && lum(at(12, 5)) < 0.01, 'the window moved 10 m: the lantern\'s light stays in its place, the shadow too');
f.center(400, 65, 400); f.compose(); check(lum(at(5, 5)) < 0.001, 'a jump: the field cleared');

console.log('d · the costs');
f.center(4.5, 65.6, 4.5); fill();
for (let i = 0; i < 60; i++) set(-40 + (i % 12) * 7, 66, -40 + Math.floor(i / 12) * 9, lantern);   // 61 lights
fill();
const N = 120, t0 = process.hrtime.bigint();
for (let i = 0; i < N; i++) { f.scan(col, R.T, LF.ROWS); f.rebuild(LF.STAMPS); f.clearDyn(); for (let j = 0; j < 16; j++) f.add(j * 3, 66, 10, 1, 0.6, 0.3, 10); f.compose(); }
const ms = Number(process.hrtime.bigint() - t0) / 1e6 / N;
console.log('     a frame: ' + r3(ms) + ' ms (scan ' + LF.ROWS + ' rows, ' + LF.STAMPS + ' restamps, 16 moving lights, compose) · lights ' + f.stats.lights);
check(f.stats.lights === 61, 'the scan found every light', f.stats.lights);
check(ms < 2.0, 'a frame\'s JS under 2 ms (node)', r3(ms));

// nothing changed: no restamp, no new picture; a block changed: the lights again
for (let i = 0; i < 40; i++) { f.scan(col, R.T, 4); f.rebuild(48); }
f.clearDyn(); f.compose(); f.compose();
f.scan(col, R.T, 128); const rb = f.rebuild(48), cp = f.compose();
check(rb === false && cp === null, 'still: no restamp, no upload (the picture of before stands)');
set(20, 66, 20, lantern); f.scan(col, R.T, 128); let sw = false; for (let i = 0; i < 40 && !sw; i++) sw = f.rebuild(48);
check(sw && f.compose() !== null && lum(at(20, 20)) > 0.8, 'a lantern placed: restamped, a new picture, its light there');
// a neon wall: 12 lights in a row, merged 2 × 2 into 6
const n0 = f.stats.lights; for (let x = 40; x < 52; x++) set(x, 66, -20, lantern); f.scan(col, R.T, 128); for (let i = 0; i < 40; i++) if (f.rebuild(48)) break;
check(f.stats.lights - n0 === 6, 'a row of 12 light blocks: 6 lights (merged 2 × 2)', f.stats.lights - n0);
const glsl0 = () => LF.glslCommon();
console.log('e · the shaders');
const names = ['TERRAIN_FS', 'PROP_FS', 'FURN_FS', 'VOX_FS', 'COMMON', 'TRANS_FS', 'LOD_FS', 'MESH_FS'];
const strip = (s) => s.replace(/#ifdef LFIELD[\s\S]*?#endif\n/g, '').replace(/\n\s*\n/g, '\n'), sq = (s) => s.replace(/\n\s*\n/g, '\n');
let same = true; for (const k of names) if (strip(S1[k]) !== strip(S0[k])) { same = false; console.log('     differs: ' + k); }
check(same, 'with LFIELD dropped every text the same as without lightfield.js (its GLSL only under the define)');
check(/vec3 lfLight\(vec3 rel, vec3 n, float sky\)/.test(S1.COMMON) && ['TERRAIN_FS', 'PROP_FS', 'FURN_FS', 'VOX_FS'].every(k => /#ifdef LFIELD\n\s+(blockL|light) \+= lfLight/.test(S1[k])), 'lfLight in COMMON; terrain, props, furniture, voxel models add it');
check(/#ifdef LFIELD\n\s+light \+= lfLight/.test(fs.readFileSync(SRC + '/folkgpu.js', 'utf8')), 'the smooth people add it');
LF.use({ lfPools: false }); check(LF.definesFor('terrain').length === 0, 'switch off: no define');
LF.use({ lfPools: true });
check(LF.definesFor('terrain')[0] === 'LFIELD' && LF.definesFor('folk')[0] === 'LFIELD' && !LF.definesFor('trans').length && !LF.definesFor('composite').length && !LF.definesFor('sky').length, 'switch on: LFIELD on its programs only (not the water, the sky, the composite)');
check(V.GL.defineHook('terrain', ['FADE']).includes('LFIELD'), 'the define hook chains it');
LF.use({ lfPools: false });
check(LF.shade(3, 1) > 0.85 && LF.shade(3, -1) < 0.2 && LF.shade(-6, 1) < 0.15 && Math.abs(LF.shade(0, 0) - 0.8) < 0.01, 'the cosine: the floor under a lamp lit, its ceiling, a roof above it little; a wall 0.8', [r3(LF.shade(3, 1)), r3(LF.shade(3, -1)), r3(LF.shade(-6, 1)), r3(LF.shade(0, 0))].join(' '));
check(Math.abs(LF.shade(3, 1, 0.1) / LF.shade(3, 1, 1) - 0.3) < 0.01 && glsl0().includes('mix(0.3, 1.0, smoothstep(0.35, 0.85, sky))'), 'indoors (no sky light) a third: the voxel light lights the rooms', r3(LF.shade(3, 1, 0.1)));
check(LF.shade(14, 1) < 0.3, 'the vertical falloff: 14 m under the lights little', r3(LF.shade(14, 1)));
const glsl = LF.glslCommon();
check(glsl.includes('max(abs(dy) - 1.5, 0.0)') && glsl.includes('0.55 + 0.45 * n.y * fy + 0.25 * (1.0 - abs(n.y))'), 'the GLSL carries the mirror\'s shape');

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
