// F1 · Licht & Luft: which shader tier each preset gets (node, no browser). The renderer derives F1's keys from the
// chosen settings (setQuality) and compiles every program with its defines (buildPrograms); here GL.program only
// records them. The presets and the shadow map sizes are read from game.js (PRESETS, SHADOW_RES), so a changed preset
// is followed. Checks:
//  - Very Low (potato): the sky pass reads the 64×32 sky table (ATMO_LUT) with LITE; no shadow map, no cloud shadows
//  - every preset: the haze programs (terrain, cut-out, translucent, the ships' three, clouds, meshes, VX models,
//    particles, far tiles) read the table — a texture read instead of ~10 exps a fogged pixel
//  - above Very Low the sky pass keeps the formula (no ATMO_LUT, no LITE)
//  - shadow filters: Low none (heightmap rays), Balanced the 3×3 PCF (SHQ2), High and Ultra the 16-tap disc (SHQ3)
//  - cloud shadows on the ground from Balanced up
//    bash test/wt_run.sh light_tiers.js
require('./load_shared.js');
global.window = undefined;
require('../src/main/gl.js'); require('../src/main/shaders.js'); require('../src/main/atmos.js'); require('../src/main/renderer.js');
const fs = require('fs');
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };

// game.js's tables, from its source (plain literals)
const src = fs.readFileSync(require.resolve('../src/main/game.js'), 'utf8');
const literal = (name, open, close) => {
  const at = src.indexOf('const ' + name + ' = ' + open);
  if (at < 0) return null;
  let i = src.indexOf(open, at), depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === open) depth++;
    else if (src[j] === close && --depth === 0) return new Function('return ' + src.slice(i, j + 1))();
  }
  return null;
};
const PRESETS = literal('PRESETS', '{', '}'), SHADOW_RES = literal('SHADOW_RES', '[', ']');
check(!!PRESETS && !!SHADOW_RES && ['potato', 'low', 'balanced', 'high', 'ultra'].every((k) => PRESETS[k]), `game.js: the five presets and the shadow sizes read (${SHADOW_RES})`);

// the programs a preset compiles: GL.program records the defines; setQuality on a renderer stand-in
const rec = [];
VR.GL.program = (vs, fs2, name, defs) => { rec.push({ name, defs: defs || [] }); return { p: 0, u: {} }; };
const tierOf = (p) => {
  rec.length = 0;
  const r = Object.assign(Object.create(VR.Renderer.prototype), { q: {}, multi: false, gl: {}, ensureShadowMap() {}, resize() {} });
  r.setQuality({ shadows: SHADOW_RES[p.shadows], hshadow: !!p.sunShadows, lite: !!p.lite, clouds: p.clouds, scale: p.scale });
  if (!rec.length) r.buildPrograms();
  const by = {};
  for (const e of rec) by[e.name] = e.defs;
  return { by, q: r.q };
};
const HAZE = ['terrain', 'terrainCut', 'trans', 'shipOpaque', 'shipCutout', 'shipTrans', 'cloud', 'mesh', 'vox', 'part', 'lod'];
const has = (defs, d) => !!defs && defs.includes(d);

for (const key of ['potato', 'low', 'balanced', 'high', 'ultra']) {
  const p = PRESETS[key], { by, q } = tierOf(p);
  console.log(key + ': sky [' + (by.sky || []).join(' ') + '], terrain [' + (by.terrain || []).join(' ') + ']');
  const noTable = HAZE.filter((n) => !has(by[n], 'ATMO_LUT'));
  check(noTable.length === 0, `${key}: the haze programs read the sky table${noTable.length ? ' (not: ' + noTable.join(', ') + ')' : ''}`);
  if (key === 'potato') {
    check(has(by.sky, 'ATMO_LUT') && has(by.sky, 'LITE'), `${key}: the sky pass reads the table, LITE`);
    check(!has(by.terrain, 'SHADOWS') && !has(by.terrain, 'SHQ2') && !has(by.terrain, 'SHQ3'), `${key}: no shadow map, no shadow filter`);
    check(!q.cloudSh, `${key}: no cloud shadows`);
  } else {
    check(!has(by.sky, 'ATMO_LUT') && !has(by.sky, 'LITE'), `${key}: the sky pass keeps the formula`);
  }
  if (key === 'low') check(!has(by.terrain, 'SHADOWS') && has(by.terrain, 'HSHADOW'), `${key}: no shadow map, the heightmap rays`);
  if (key === 'balanced') check(has(by.terrain, 'SHADOWS') && has(by.terrain, 'SHQ2') && !has(by.terrain, 'SHQ3'), `${key}: the 3×3 PCF (SHQ2)`);
  if (key === 'high' || key === 'ultra') check(has(by.terrain, 'SHADOWS') && has(by.terrain, 'SHQ3'), `${key}: the 16-tap disc (SHQ3)`);
  if (key !== 'potato' && key !== 'low') check(!!q.cloudSh, `${key}: cloud shadows on the ground`);
}

// the shaders: the disc reads its four outermost taps first and stops where they agree; the table's sampler on its own unit
const TFS = VR.SHADERS.TERRAIN_FS;
check(/for \(int i = 12; i < 16; i\+\+\)/.test(TFS) && /if \(s > 0\.001 && s < 3\.999\)/.test(TFS), 'the 16-tap disc: the four outermost taps first, the other twelve only in the penumbra');
check(/uniform sampler2D u_atmoLUT/.test(VR.SHADERS.COMMON || TFS), 'the sky table sampler is declared for the haze');
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exitCode = fails ? 1 : 0;
