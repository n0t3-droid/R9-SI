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
const n1 = f.stats.lights; for (let x = 40; x < 52; x++) set(x, 66, 25, R.S('magma_block')); f.scan(col, R.T, 128); for (let i = 0; i < 40; i++) if (f.rebuild(48)) break;
check(f.stats.lights === n1, 'faint glowing blocks (magma, level 3) are no lights of the field (the voxel light lights them)', f.stats.lights - n1);
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

// f-polish8: pools that read — point lights stronger, strips out, low lights round, windows outward, the brightest kept
console.log('f · f-polish8: what a light is to the field');
const KD = LF.KIND, kindOf = (n) => (R.byName[n] ? LF.kindOf(R.T, R.S(n)) : -1);
check(KD && ['lantern', 'torch', 'campfire', 'vx_lamppost', 'vx_lantern', 'lumishroom', 'campfire'].every(n => kindOf(n) === KD.point), 'lamps, lanterns, torches, fires, bulbs: point lights', ['lantern', 'campfire', 'vx_lamppost'].map(kindOf).join(' '));
check(['neon_cyan', 'vx_led_strip', 'vx_tech_white_strip', 'vx_floor_plaza_line', 'light_panel', 'tech_panel', 'lava', 'temple_light_bar', 'vx_holo_screen'].every(n => kindOf(n) === KD.none), 'neon, LED strips, floor lines, panels, light bars, screens, lava: no light of the field', ['neon_cyan', 'vx_led_strip', 'lava'].map(kindOf).join(' '));
check(['window_warm', 'vx_window_glow', 'amber_window'].every(n => kindOf(n) === KD.window), 'the glowing windows: outward lights');
// a fresh stub world for each case
const cols2 = new Map();
const colAt2 = (kx, kz) => { const k = kx + ',' + kz; let c = cols2.get(k); if (!c) { c = { blocks: new Uint16Array(Hc << 8), H: Hc }; for (let i = 0; i < 256; i++) for (let y = 0; y < 64; y++) c.blocks[(y << 8) | i] = stone; cols2.set(k, c); } return c; };
const set2 = (x, y, z, s) => { const c = colAt2(x >> 4, z >> 4); c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)] = s; };
const field2 = (build) => { cols2.clear(); build(); const f2 = new LF.Field(); f2.center(0.5, 65.6, 0.5); for (let i = 0; i < 40; i++) f2.scan(colAt2, R.T, 4); for (let i = 0; i < 60; i++) if (f2.rebuild(64)) break; f2.compose(); return f2; };
const at2 = (f2, x, z) => lum(LF.decode(f2.out, (z & 127) * 128 + (x & 127), f2.Y0));
const neon = R.S('neon_cyan'), torchS = R.S('torch'), fenceS = R.byName.oak_fence ? R.S('oak_fence') : R.S('cobblestone_wall'), win = R.S('window_warm'), plank = R.byName.oak_planks ? R.S('oak_planks') : stone;
let f2 = field2(() => { for (let x = -6; x < 6; x++) set2(x, 66, 0, neon); });
check(f2.stats.lights === 0 && at2(f2, 0, 3) < 0.001, 'a neon band: no pool', f2.stats.lights);
// a point light against a plain light of the same level and colour (a lantern vs a glowing non-point block stand-in)
f2 = field2(() => set2(0, 66, 0, lantern));
const pt3 = at2(f2, 3, 0), pt0 = at2(f2, 0, 0);
check(pt3 > 0.45 && pt0 > 1.0, 'a lantern\'s pool reads: at 3 m ' + r3(pt3) + ', under it ' + r3(pt0));
// low lights: two lanterns on fence posts 4 m apart make two pools with a dip between; high ones a band
const pair = (y, post) => field2(() => { for (const x of [-2, 2]) { if (post) set2(x, 64, 0, fenceS); set2(x, y, 0, lantern); } });
const lowF = pair(65, true), hiF = pair(68, false);
const dip = (ff) => at2(ff, 0, 0) / at2(ff, 2, 0);
check(dip(lowF) < 0.8 && dip(lowF) < dip(hiF) - 0.1, 'low lanterns on posts: round pools, a dip between (' + r3(dip(lowF)) + ' vs high ' + r3(dip(hiF)) + ')');
check(at2(lowF, 2, 5) < at2(hiF, 2, 5), 'a low light reaches less far', r3(at2(lowF, 2, 5)) + ' < ' + r3(at2(hiF, 2, 5)));
// a window in a roofed room's wall: the street outside lit, the room little
f2 = field2(() => { for (let x = -4; x <= 4; x++) for (let z = 0; z <= 6; z++) { set2(x, 69, z, plank); for (let y = 64; y <= 68; y++) if (x === -4 || x === 4 || z === 0 || z === 6) set2(x, y, z, plank); } set2(0, 66, 0, win); });
const wOut = at2(f2, 0, -3), wIn = at2(f2, 0, 3);
check(wOut > 0.2 && wOut > wIn * 2, 'a glowing window lights the street outside, not the room (out ' + r3(wOut) + ', in ' + r3(wIn) + ')');
// the cap: a window of many lights keeps the brightest
f2 = field2(() => { for (let x = -60; x < 60; x += 2) for (let z = -60; z < 60; z += 2) set2(x, 66, z, (x + z) % 8 === 0 ? lantern : R.S('spirit_lantern')); });
check(f2.stats.lights <= LF.MAXL && f2.stats.lights > LF.MAXL * 0.9, 'a town of 3600 lights: the ' + LF.MAXL + ' brightest kept', f2.stats.lights);
let keptBright = 0; for (let i = 0; i < f2.nList; i++) if (f2.L[i * LF.LW + 3] > 0.9) keptBright++;
check(keptBright >= Math.min(f2.nList, 400) * 0.95, 'the kept ones are the bright lanterns, not the dim spirit lanterns', keptBright + ' of ' + f2.nList);
// the fairy lights ×1.8, radius 12
{
  const fs0 = { sites: [{ x: 0, z: 0, parts: [{ m: 'fy_shroom_0', pos: [3, 65, 3], o: { h: 3 } }] }] };
  const ff = new LF.Field(); ff.center(0.5, 65.6, 0.5);
  LF.fairyLights(fs0, ff, 1, 0);
  const D7 = ff.dyn, c0 = LF.FAIRY.fy_shroom_0;
  check(ff.nDyn === 1 && Math.abs(D7[3] / c0[0] - LF.K.fairy * 0.9 * 0.9) < 0.02 && D7[6] === 12 && LF.K.fairy >= 1.8, 'a fairy mushroom: ×' + LF.K.fairy + ', radius ' + D7[6], r3(D7[3] / c0[0]));
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
