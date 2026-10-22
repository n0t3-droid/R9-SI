// u-moons1 · the moons drawn without a browser (a tool for tuning between the browser runs; regress: skip).
//   sky:  node test/worlds_offline.js sky <basalt|opal> <t seconds> <yaw°> <pitch°> <preset> [W H] [tag]
//         → .tmp_tests/worlds_off/<tag>/frame.json: the game's own sky program (shaders.js SKY_FS with COMMON, the
//         defines the renderer's hook chain gives it on a moon: BODYSKY, LITE on Very Low, t-sky3's) and every uniform
//         (VR.BodySky.compute at the landing); test/worlds_offline.py draws it on Mesa's llvmpipe (EGL, no browser) and
//         tone-maps it as the composite does
//   map:  node test/worlds_offline.js map <basalt|opal> <x0> <z0> <size> <px> [tag]
//         → a top-down picture of the generator: every column's top block's colour, shaded by the slope toward a low
//         sun from the west (craters, rays, maria, rilles; lineae, stripes, vents, chaos), as raw RGB for the .py
//   python3 test/worlds_offline.py .tmp_tests/worlds_off/<tag> …   → test/shots/worlds_off_<tag>.png
global.window = { devicePixelRatio: 1, screen: { width: 1280, height: 720 } };
global.WebGLFramebuffer = class {};
require('./dom_stub.js');
const V = require('./load_shared.js');
global.self = global;
const fs = require('fs'), path = require('path');
const M = path.join(__dirname, '..', 'src', 'main') + '/';
for (const f of ['gl', 'light2', 'sky3', 'water_fx', 'space_shaders', 'shaders', 'bodysky']) require(M + f + '.js');
const [mode = 'sky', body = 'basalt', ...rest] = process.argv.slice(2);
const ROOT = path.join(__dirname, '..', '.tmp_tests', 'worlds_off');

if (mode === 'sky') {
  const [tS = '0', yawS = '0', pitchS = '10', preset = 'high', WS = '960', HS = '540', tagIn] = rest;
  const t = +tS, yaw = +yawS * Math.PI / 180, pitch = +pitchS * Math.PI / 180, W = +WS, H = +HS;
  const tag = tagIn || `${body}_${t}_${yawS}_${pitchS}_${preset}`;
  const out = path.join(ROOT, tag); fs.mkdirSync(out, { recursive: true });
  const BS = V.BodySky, L2 = V.Light2, S3 = V.Sky3, GL = V.GL, S = V.SHADERS;
  const lite = preset === 'potato';
  const q = Object.assign({ lite, matTier: lite ? 0 : 3 }, L2 ? L2.defaults(preset) : {}, S3 ? S3.defaults(preset) : {});
  if (L2) L2.use(q); if (S3) S3.use(q);
  BS.want = true;
  const base = (lite ? ['LITE'] : []).concat(q.motion ? ['MOTION'] : []);
  const defines = GL.defineHook ? GL.defineHook('sky', base) : base.concat(['BODYSKY']);
  const eye = [0.5, 73.6, 0.5];
  const plumes = process.env.PLUMES ? JSON.parse(process.env.PLUMES) : [];
  const r = BS.compute(body, eye, t, { tier: lite ? 0 : 3, plumes });
  // the camera (renderer.setupCamera: yaw 0 looks north, −z)
  const mat4 = V.mat4, proj = mat4.create(), view = mat4.create(), vp = mat4.create(), inv = mat4.create();
  const fwd = [-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
  mat4.perspective(proj, (+(process.env.FOV || 70)) * Math.PI / 180, W / H, 0.06, 1200);
  mat4.lookAt(view, 0, 0, 0, fwd[0], fwd[1], fwd[2], 0, 1, 0);
  mat4.mul(vp, proj, view); mat4.invert(inv, vp);
  const pre = '#version 300 es\n' + defines.map(d => '#define ' + d + '\n').join('');
  const vs = '#version 300 es\n' + S.FS_VS;
  const fsrc = pre + '#define FRAG 1\nprecision highp float;\nprecision highp int;\nprecision highp sampler2DArray;\nprecision highp sampler2D;\n' + S.SKY_FS;
  const L = r.light, s = r.sky;
  const u = {
    u_invViewProj: Array.from(inv), u_skyProbe: 0, u_skyOff: [0, 0, 0], u_dim: 5, u_time: 100, u_fog: [100, 130, 0, 0], u_fogColor: L.far,
    u_sunDir: L.sunDir, u_sunColor: L.sunColor, u_moonDir: L.moonDir, u_moonColor: L.moonColor, u_ambSky: L.ambSky, u_night: L.night,
    u_bsSun: s.sun, u_bsSunK: s.sunK, u_bsSunCol: s.sunCol, u_bsInert: Array.from(s.inert), u_bsPar: s.par, u_bsPole: s.pole, u_bsParX: s.parX, u_bsParK: s.parK,
    u_bsGround: s.ground, u_bsJk: s.Jk, u_bsLum: s.lum, u_bsJs: s.Js,
  };
  const arrays = { u_bsB: Array.from(s.B), u_bsBc: Array.from(s.Bc), u_bsJ: Array.from(s.J) };
  const look = { exposure: r.expo, saturation: 1.12, contrast: 0.3, vignette: 0.3, vivid: 0.6 };
  fs.writeFileSync(path.join(out, 'frame.json'), JSON.stringify({ kind: 'sky', W, H, tag, vs, fs: fsrc, u, arrays, ints: ['u_dim'], look }));
  const yawOf = (d) => (Math.atan2(-d[0], -d[2]) * 180 / Math.PI).toFixed(0);
  console.log(`${tag}: yaw to Helia ${yawOf(s.sun)}°, to Amarant ${yawOf(s.par)}° · defines ${defines.join(' ')} · sun el ${(L.sunEl * 180 / Math.PI).toFixed(1)}° light ${L.lightK.toFixed(2)} eclipse ${L.eclipse.toFixed(2)} · Amarant el ${(L.parEl * 180 / Math.PI).toFixed(1)}° phase ${L.parPhase.toFixed(2)} · exposure ${r.expo.toFixed(2)} · ${fsrc.length} chars`);
} else if (mode === 'map') {
  const [x0S = '-256', z0S = '-256', sizeS = '512', pxS = '512', tagIn] = rest;
  const x0 = +x0S, z0 = +z0S, size = +sizeS, px = +pxS, step = size / px;
  const tag = tagIn || `map_${body}_${x0}_${z0}_${size}`;
  const out = path.join(ROOT, tag); fs.mkdirSync(out, { recursive: true });
  const g = new V.BodyGen(4242, body, {}), R = V.R;
  // the top block's colour: the texture recipes' palettes would need the canvas; a table of the blocks used is enough
  const C = { regolith: [150, 146, 138], regolith_dark: [74, 72, 69], tholin_ice: [140, 92, 70], basalt: [70, 70, 74], smooth_basalt: [56, 56, 60], tuff: [118, 116, 104], calcite: [214, 214, 206], andesite: [138, 139, 140], stone: [115, 118, 122], diorite: [195, 195, 192], gravel: [128, 124, 120], bedrock: [40, 40, 40], snow_block: [236, 240, 244], packed_ice: [170, 196, 230], blue_ice: [110, 150, 220], ice: [180, 210, 240], snow: [240, 244, 248] };
  const rgb = Buffer.alloc(px * px * 3);
  const cache = new Map();
  const colAt = (x, z) => {
    const cx = Math.floor(x / 16), cz = Math.floor(z / 16), key = cx + ',' + cz;
    let c = cache.get(key); if (!c) { c = g.generate(cx, cz); cache.set(key, c); if (cache.size > 4096) cache.clear(); }
    const i = ((z & 15) << 4) | (x & 15); let y = 255; while (y > 0 && !c.blocks[(y << 8) | i]) y--;
    const st = c.blocks[(y << 8) | i], name = st ? R.types[R.T.type[st]].name : 'air';
    return { y, name };
  };
  const t0 = Date.now();
  for (let j = 0; j < px; j++) for (let i = 0; i < px; i++) {
    const x = Math.floor(x0 + i * step), z = Math.floor(z0 + j * step);
    const a = colAt(x, z), b = step >= 2 ? { y: g.heightAt(x + step, z) } : colAt(x + 1, z), c2 = step >= 2 ? { y: g.heightAt(x, z + step) } : colAt(x, z + 1);
    const dx = (b.y - a.y) / Math.max(1, step), dz = (c2.y - a.y) / Math.max(1, step);
    // a low sun from the west-north-west (−x): faces toward it lit, away dark
    const sh = Math.max(0.25, Math.min(1.6, 1 - dx * 1.4 - dz * 0.35));
    const col = C[a.name] || [255, 0, 255];
    rgb[(j * px + i) * 3] = Math.min(255, col[0] * sh); rgb[(j * px + i) * 3 + 1] = Math.min(255, col[1] * sh); rgb[(j * px + i) * 3 + 2] = Math.min(255, col[2] * sh);
  }
  fs.writeFileSync(path.join(out, 'map.rgb'), rgb);
  fs.writeFileSync(path.join(out, 'frame.json'), JSON.stringify({ kind: 'map', W: px, H: px, tag, file: path.join(out, 'map.rgb') }));
  console.log(`${tag}: ${px}² px over ${size} m in ${Date.now() - t0} ms`);
}
