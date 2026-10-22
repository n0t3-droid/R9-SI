// f-sky4 · the game's sky drawn without a browser (a tool for fitting the sky between the browser runs). Node computes
// what the renderer would draw — env.js's frame (the palette, the sun, the bodies), sky3.js's and light2.js's values, the
// SKY program's text with the preset's defines (gl.js's assembly: the light's and the sky's define hooks), every uniform
// renderer.js common() + sky3_gl.js + the sky pass set, the bloom chain's and the composite's (with t-light2's grade, its
// flare) — into a folder per view; test/sky_offline.py draws it with Mesa's llvmpipe through EGL (u-space0's way: no
// browser slot, a few seconds a view): the sky into an RGBA16F scene, the bloom's five levels with the game's own shaders,
// the composite → a PNG. Then this script measures it as test/sky3.mjs measures the game's pictures: the bands from the
// horizon line H against the frames' targets (the sun's cone and the planets masked; everything under H is the land's),
// the critic's structure (sky_ref.js structureOf: the sky alone — no land, no cumulus sprites, no volumetric light), the
// sun's disc. Not drawn: the land, the cumulus sprites, the volumetric light, the old god rays, the TSR.
//   node test/sky_offline.js run <tag> [views]   (views: canyon_golden,isles_golden,… · sun · lake; default the golden set)
//   node test/sky_offline.js prep|post <tag> [views]   (the two halves; python3 test/sky_offline.py .tmp_tests/skyoff/<tag>)
//   node test/sky_offline.js glsl <tag>   (the preset's sky, cumulus, box-cloud and composite programs compiled and linked)
//   env: PRESET=high (or balanced, low) · W=640 H=360 (the sky3.mjs views; wow48's sun/lake 1280 × 720) · SEED=4242
// → test/shots/skyoff_<view>_<tag>.png, .tmp_tests/skyoff/<tag>/result.json
// regress: skip  (a tool)
const ROOT = require('path').join(__dirname, '..') + '/';
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const V = require('./load_shared.js');
global.performance = global.performance || require('perf_hooks').performance;
const SRC = ROOT + 'src/main';
require(SRC + '/weather.js'); require(SRC + '/skybodies.js'); require(SRC + '/gl.js'); require(SRC + '/light2.js');
require(SRC + '/sky3.js'); require(SRC + '/shaders.js'); require(SRC + '/clouds.js'); require(SRC + '/env.js');
const S = VR.SHADERS, S3 = VR.Sky3, L2 = VR.Light2, SR = require('./sky_ref.js'), mat4 = V.mat4 || VR.mat4;
// PATCH=<file.js>: a fitting experiment — a module run here with VR loaded (it may change VR.Sky3.PAL, SKYL, VR.Light2.GRADE,
// VR.Sky …) before the frames are computed; QX='{"sky3":0}': the preset's switches changed
if (process.env.PATCH) require(path.resolve(process.env.PATCH))(VR);
const [cmd = 'run', tag = 'now', viewsArg] = process.argv.slice(2);
const OUT = ROOT + '.tmp_tests/skyoff/' + tag + '/', SHOTS = ROOT + 'test/shots/';
fs.mkdirSync(SHOTS, { recursive: true });
const PRESET = process.env.PRESET || 'high', SEED = +(process.env.SEED || 4242);

// the presets' switches (game.js PRESETS: the sky's and the light's, the sky program's own defines)
const Q = {
  high: { sky3: 2, cloudVol: true, clouds: 2, l2Light: true, l2Ssao: 3, l2Vol: true, l2Air: true, l2Grade: true, wxDrama: true, motion: true, magic: 0.85, bloom: true, sharpen: 0.35, lite: false },
  balanced: { sky3: 2, cloudVol: true, clouds: 2, l2Light: true, l2Ssao: 2, l2Vol: false, l2Air: true, l2Grade: true, wxDrama: true, motion: true, magic: 0.8, bloom: true, sharpen: 0.35, lite: false },
  low: { sky3: 1, cloudVol: false, clouds: 1, l2Light: true, l2Ssao: 1, l2Vol: false, l2Air: true, l2Grade: true, wxDrama: true, motion: true, magic: 0.6, bloom: true, sharpen: 0.35, lite: false },
};
// the views: sky3.mjs's places (pitched up 12°, the planets pinned 30° right at 24° and 30° left at 36°, its horizon line
// H from its runs) and wow48.mjs's sun and lake (seed 53's hills terrace and lake, the bodies where the hour has them)
const PLACES = { canyon: { cam: [250, 150, 380], yaw: 1.36, H: 225 }, city: { cam: [0, 100, -90], yaw: -0.35, H: 205 }, isles: { cam: [565, 195, 190], yaw: 1.36, H: 230 } };
const HOURS = { noon: [6000, 'day'], golden: [10800, 'golden'], dusk: [11900, 'dusk'], afterglow: [12400, 'dusk'], dawn: [23600, 'dusk'] };
const azOf = (yaw) => Math.atan2(-Math.cos(yaw), -Math.sin(yaw));
function viewOf(name) {
  if (name === 'sun' || name === 'lake') {
    // wow48.mjs: the sun from the hills terrace (turned to the sun, 0.06 rad under it, the lens 70°) · the lake at its eye
    const tod = 10800;
    return name === 'sun' ? { name, tod, kind: 'golden', cam: [0.5, 136, -292.5], aim: 'sun', fov: 70, W: 1280, H: 720, Hline: null, seed: 53 }
      : { name, tod, kind: 'golden', cam: [201.5, 65.6, 6.5], at: [250, 64, 70], fov: 70, W: 1280, H: 720, Hline: null, seed: 53 };
  }
  const [pl, hr] = name.split('_'), P = PLACES[pl];
  if (!P || !HOURS[hr]) throw new Error('no such view ' + name);
  return { name, place: pl, hour: hr, tod: HOURS[hr][0], kind: HOURS[hr][1], cam: P.cam, yaw: P.yaw, pitch: 12 * Math.PI / 180, fov: 75, W: +(process.env.W || 640), H: +(process.env.H || 360), Hline: P.H, pins: { az: azOf(P.yaw - 30 * Math.PI / 180), el: 24, az2: azOf(P.yaw + 30 * Math.PI / 180), el2: 36 }, seed: SEED };
}
const DEFAULT_VIEWS = ['canyon_golden', 'isles_golden', 'city_golden'];

// env.js's frame at the view's hour (the weather clear and settled, the shader's clock pinned as sky3.mjs pins it)
function frameOf(v, q) {
  S3.use(q); L2.use(q);
  const env = new VR.Env(); env.setTime(v.tod); env.wx.setSeed(v.seed); env.wx.force('klar');
  if (VR.WX && VR.WX.VIS && VR.WX.VIS.klar) Object.assign(env.wx.v, VR.WX.VIS.klar);
  if (v.pins) env.planetsOverride = v.pins;
  let E;
  for (let i = 0; i < 4; i++) { env.anim = 80; E = env.update(0.033, { dim: 'overworld', biome: null, eyeSky: 1, renderDist: 8, horizon: 4096, freezeTime: true, freezeWeather: true, drama: !!q.wxDrama, motion: !!q.motion }); }
  E.time = 80;
  return { env, E };
}
// the camera (renderer.setupCamera: yaw 0 looks along −z, camera-relative, no jitter)
function camOf(v, E) {
  let yaw = v.yaw, pitch = v.pitch;
  if (v.aim === 'sun') { const s = E.sunDir; yaw = Math.atan2(-s[0], -s[2]); pitch = Math.atan2(s[1], Math.hypot(s[0], s[2])) - 0.06; }
  if (v.at) { const d = [v.at[0] - v.cam[0], v.at[1] - v.cam[1], v.at[2] - v.cam[2]]; yaw = Math.atan2(-d[0], -d[2]); pitch = Math.atan2(d[1], Math.hypot(d[0], d[2])); }
  const proj = mat4.create(), view = mat4.create(), vp = mat4.create(), inv = mat4.create();
  mat4.perspective(proj, v.fov * Math.PI / 180, v.W / v.H, 0.06, 1200);
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  mat4.lookAt(view, 0, 0, 0, -sy * cp, sp, -cy * cp, 0, 1, 0);
  mat4.mul(vp, proj, view); mat4.invert(inv, vp);
  return { yaw, pitch, vp: Array.from(vp), inv: Array.from(inv), x: v.cam[0], y: v.cam[1], z: v.cam[2], fov: v.fov * Math.PI / 180 };
}
// gl.js GL.program's text (the define hooks: the light's, then the sky's)
function programText(vsSrc, fsSrc, name, defines) {
  if (VR.GL && VR.GL.defineHook) defines = VR.GL.defineHook(name, defines || []);
  const pre = (defines || []).map(d => (d.startsWith('#') ? d + '\n' : '#define ' + d + '\n')).join('');
  const fix = (src) => { const ext = [], body = []; for (const line of src.split('\n')) (line.trim().startsWith('#extension') ? ext : body).push(line); return { ext: ext.join('\n'), body: body.join('\n') }; };
  const a = fix(vsSrc), b = fix(fsSrc);
  return { vs: '#version 300 es\n' + a.ext + '\n' + pre + a.body, fs: '#version 300 es\n' + b.ext + '\n' + pre + '#define FRAG 1\nprecision highp float;\nprecision highp int;\nprecision highp sampler2DArray;\nprecision highp sampler2D;\n' + b.body, defines };
}
// renderer.js common() for the sky program, sky3_gl.js's uniforms, the sky pass's own
function skyUniforms(E, q, cam) {
  const u = {}, v3 = (n, a) => { u[n] = [a[0], a[1], a[2]]; };
  v3('u_sunDir', E.sunDir); v3('u_moonDir', E.moonDir); v3('u_sunColor', E.sunColor); v3('u_moonColor', E.moonColor);
  v3('u_ambSky', E.ambSky); v3('u_skyZenith', E.zenith); v3('u_skyHorizon', E.horizon); v3('u_sunset', E.sunset); v3('u_skyMid', E.skyMid || E.horizon);
  { const s = E.skyStops || [0.25, 0.1, 1.0, 0.45]; u.u_skyStops = [1 / Math.max(1e-3, s[0]), s[1], 1 / Math.max(1e-3, s[2] - s[1]), s[3] === undefined ? 0.45 : s[3]]; }
  { const s = E.skySpace || [0.2, 0.9, 0.5, 1.3]; u.u_skySpace = [s[0], 1 / Math.max(1e-3, s[1] - s[0]), s[2], s[3]]; }
  { const z = E.skyDay || [0.6, 1, 0, 0]; u.u_skyDay = [z[0], z[1], z[2], z[3]]; }
  v3('u_fogColor', E.fogColor); v3('u_blockLightTint', E.blockTint); v3('u_planetDir', E.planetDir); v3('u_planet2Dir', E.planet2Dir); v3('u_ringNormal', E.ringNormal);
  u.u_fog = E.fog.slice(0, 4);
  u.u_nebula = E.nebula !== undefined ? E.nebula : 1; u.u_sunDisc = E.sunDisc !== undefined ? E.sunDisc : 16; u.u_gridK = E.gridK !== undefined ? E.gridK : 0.12;
  u.u_rain = E.rain; u.u_time = E.time; u.u_animOn = 1; u.u_night = E.night; u.u_dim = { i: E.dimId | 0 }; u.u_skyMagic = q.magic;
  u.u_storm = (E.storm || [1, 0, 0, 0]).slice(0, 4); u.u_bolt = (E.bolt || [1, 0, 0, 0]).slice(0, 4); u.u_snowCover = E.snowCover || 0;
  const B = E.bodies;
  if (B) { u.u_giant = [B.giant[0], B.giant[1], B.giant[2], B.radius.giant]; u.u_blue = [B.blue[0], B.blue[1], B.blue[2], B.radius.blue]; for (let i = 0; i < 4; i++) u['u_moon' + i] = B.moons[i].slice(0, 4); }
  // sky3_gl.js (the frame's uniforms in E.sky3.u; the cumulus field's eye in cloud space)
  const o = E.sky3;
  if (o && o.u) {
    const U = o.u, f = U.u_s3Field, dr = E.cloudDrift;
    f[0] = 210 - cam.y; f[1] = cam.x + (dr ? dr[0] : (E.time || 0) * 0.9); f[2] = cam.z + (dr ? dr[1] : 0);
    for (const k of S3.U4) if (U[k]) u[k] = Array.from(U[k]);
    for (const k of S3.U3) if (U[k]) u[k] = Array.from(U[k]);
  }
  // the sky pass
  u.u_skyProbe = 0; u.u_invViewProj = cam.inv; u.u_cirrus = q.clouds >= 2 ? 1 : 0; u.u_skyOff = [0, 0, 0];
  { const dr = E.cloudDrift || [E.time * 0.9, 0], qx = dr[0] / 4000, qz = dr[1] / 4000; u.u_cirrusDrift = [qx * 0.35 + qz * 0.2, qz * 5.0]; }
  return u;
}
// the composite's uniforms (renderer.post + light2_gl.js l2Post: the grade, the flare's gate and ghosts)
function compositeUniforms(E, q, cam, W, H) {
  const g = q.l2Grade ? L2.grade(E) : null, u = {};
  u.u_exposure = E.exposure; u.u_bloomStrength = q.bloom ? (g ? g.bStr : (E.bloomStrength || 0.06)) : 0; u.u_useRays = 0;
  u.u_vignette = g ? 0 : (E.vignette !== undefined ? E.vignette : 0.55); u.u_saturation = E.saturation || 1.12; u.u_contrast = g ? 0 : (E.contrast || 0);
  u.u_grade = E.grade.slice(0, 3); u.u_vivid = E.vivid === undefined ? 0 : E.vivid; u.u_underwaterFx = 0; u.u_shafts = 0; u.u_crossing = 0;
  u.u_time = E.time; u.u_damage = 0; u.u_portal = 0; u.u_screen = [W, H]; u.u_sceneTexel = [1 / W, 1 / H]; u.u_sharpen = q.sharpen || 0;
  u.u_invVP = cam.inv; u.u_shaftCol = [0, 0, 0];
  if (g) {
    u.u_l2Curve = [g.toe, Math.log(g.mid) / Math.log(0.5), g.s, g.sh]; u.u_l2Dark = g.dark.slice(0, 3); u.u_l2Light = g.light.slice(0, 3);
    let sx = 0, sy = 0, gate = 0;
    if (E.sunDir[1] > -0.02) {
      const m = cam.vp, Ld = E.sunDir, cx = m[0] * Ld[0] + m[4] * Ld[1] + m[8] * Ld[2], cy = m[1] * Ld[0] + m[5] * Ld[1] + m[9] * Ld[2], cw = m[3] * Ld[0] + m[7] * Ld[1] + m[11] * Ld[2];
      if (cw > 0) { sx = cx / cw * 0.5 + 0.5; sy = cy / cw * 0.5 + 0.5; const edge = Math.max(Math.abs(sx - 0.5), Math.abs(sy - 0.5)), sc = E.sunColor, sl = 0.2126 * sc[0] + 0.7152 * sc[1] + 0.0722 * sc[2]; gate = edge < 0.5 ? Math.min(1, (0.5 - edge) * 8) * Math.min(1, sl / 1.6) * (1 - Math.min(1, (E.rain || 0) * 1.5)) : 0; }
    }
    u.u_l2Vig = [g.vig, W / H, g.sat, L2.FLARE.k]; u.u_l2Sun = [sx, sy, gate, L2.FLARE.disc];
    const G = L2.ghosts(sx, sy), sc = E.sunColor, a = [], b = [];
    for (let i = 0; i < 5; i++) { a.push(G[i][0], G[i][1], G[i][2], 0); b.push(G[i][3] * sc[0], G[i][4] * sc[1], G[i][5] * sc[2]); }
    u['u_l2Ghost[0]'] = { v4: a }; u['u_l2GhostC[0]'] = { v3: b };
  }
  return { u, g };
}
// the sun's place on the picture (pixels, y down) and the pixels per degree there
function sunPx(cam, E, W, H) {
  const m = cam.vp, L = E.sunDir, cx = m[0] * L[0] + m[4] * L[1] + m[8] * L[2], cy = m[1] * L[0] + m[5] * L[1] + m[9] * L[2], cw = m[3] * L[0] + m[7] * L[1] + m[11] * L[2];
  if (cw <= 0) return null;
  const x = (cx / cw * 0.5 + 0.5) * W, y = (1 - (cy / cw * 0.5 + 0.5)) * H;
  return { x, y, ppd: (H / 2) / Math.tan(cam.fov / 2) * Math.PI / 180 };
}

const LAND_FS = `
uniform float u_line;      // the horizon line, rows from the bottom
uniform float u_h;         // the picture's height
uniform vec3 u_hor;        // the sky's horizon colour (HDR)
uniform vec3 u_near;       // the near land (HDR)
in vec2 v_uv;
out vec4 o;
void main() {
  if (gl_FragCoord.y > u_line) discard;
  float t = clamp((u_line - gl_FragCoord.y) / max(u_line, 1.0), 0.0, 1.0);
  o = vec4(mix(u_hor * 0.7, u_near, smoothstep(0.0, 0.35, t)), 1.0);
}`;
function prep(views, q) {
  fs.mkdirSync(OUT, { recursive: true });
  S3.use(q); L2.use(q);   // (the define hooks read the switches: the composite takes GRADE2, the sky SKY3 + SKY3HI)
  const progs = {
    sky: programText(S.FS_VS, S.SKY_FS, 'sky', (q.lite ? ['LITE'] : []).concat(q.wxDrama ? ['WXDRAMA'] : []).concat(q.motion ? ['MOTION'] : [])),
    bloomPre: programText(S.FS_VS, S.BLOOM_PRE_FS, 'bloomPre', []), down: programText(S.FS_VS, S.DOWN_FS, 'down', []), up: programText(S.FS_VS, S.UP_FS, 'up', []),
    composite: programText(S.FS_VS, S.COMPOSITE_FS, 'composite', []),
    // a stand-in for the land under the horizon line (the game's land occludes the low sky: without it the bright low sky
    // feeds the bloom over the whole picture — the calibration against sky3.mjs run 3 was 7 L* too bright): the hazed far
    // land at the line (the horizon's colour × 0.7), darker down to a sunlit lawn at the bottom
    land: programText(S.FS_VS, LAND_FS, 'land', []),
  };
  const list = [];
  for (const name of views) {
    const v = viewOf(name), { E } = frameOf(v, q), cam = camOf(v, E), C = compositeUniforms(E, q, cam, v.W, v.H);
    const Hl = lineOf(v, cam), land = { u_line: (1 - Hl / 360) * v.H, u_h: v.H, u_hor: E.horizon.slice(0, 3), u_near: [0.07, 0.09, 0.05].map((x, i) => x * (0.4 + 0.6 * E.sunColor[i] / 2.5)) };
    const frame = { tag, view: name, W: v.W, H: v.H, preset: PRESET, sky: skyUniforms(E, q, cam), land: process.env.NOLAND ? null : land, threshold: C.g ? C.g.bThr : (E.bloomThreshold || 1.1), bloom: !!q.bloom, composite: C.u };
    fs.mkdirSync(OUT + name, { recursive: true });
    fs.writeFileSync(OUT + name + '/frame.json', JSON.stringify(frame));
    const bodies = [[E.planetDir, E.bodies.radius.giant * 2.6], [E.planet2Dir, E.bodies.radius.blue * 1.6], [E.moonDir, 0.06], ...E.bodies.moons.map(m => [[m[0], m[1], m[2]], m[3] * 1.8]), ...(E.sky3 && E.sky3.bodies ? E.sky3.bodies.map(m => [[m[0], m[1], m[2]], m[3] * 1.8]) : [])];
    list.push({ name, kind: v.kind, hour: v.hour || 'golden', W: v.W, H: v.H, Hline: lineOf(v, cam), cam: { inv: cam.inv, vp: cam.vp, yaw: cam.yaw, pitch: cam.pitch, fov: cam.fov }, sun: E.sunDir, bodies, sunPx: sunPx(cam, E, v.W, v.H), palette: { hor: E.horizon, mid: E.skyMid, zen: E.zenith, space: E.skySpace } });
  }
  fs.writeFileSync(OUT + 'views.json', JSON.stringify({ programs: progs, views: list }));
  return list;
}

// the horizon line (rows of 360): the view's own (sky3.mjs runs), else the sky's horizon (dir.y 0) a little lower
function lineOf(v, cam) {
  if (v.Hline) return v.Hline;
  const f = 180 / Math.tan(cam.fov / 2);
  return Math.min(360, Math.round(180 + f * Math.tan(cam.pitch)) + 2);
}
// the measure (sky3.mjs measure: the sky pixels less the planets, the moons and the sun's cone; H the horizon line — here
// the land's line of the view's runs, or the sky's own horizon for the wow48 views; everything under it is the land's)
const matVec = (m, v) => [0, 1, 2, 3].map(i => m[i] * v[0] + m[4 + i] * v[1] + m[8 + i] * v[2] + m[12 + i] * v[3]);
const ang = (a, b) => Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
const normv = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
async function measure(V, file) {
  const W = 640, Hh = 360, img = await SR.load(file, W, Hh), full = await SR.load(file);
  const bodies = [[V.sun, (V.kind === 'day' ? 30 : 14) * Math.PI / 180], ...V.bodies];
  let Hl = V.Hline;
  if (!Hl) { const f = (Hh / 2) / Math.tan(V.cam.fov / 2); Hl = Math.round(Hh / 2 + f * Math.tan(V.cam.pitch)); }
  const mask = new Uint8Array(W * Hh);
  for (let y = 0; y < Math.min(Hh, Hl); y++) for (let x = 0; x < W; x++) {
    const c = matVec(V.cam.inv, [(x + 0.5) / W * 2 - 1, 1 - (y + 0.5) / Hh * 2, 1, 1]), dir = normv([c[0] / c[3], c[1] / c[3], c[2] / c[3]]);
    let ok = dir[1] > 0; for (const [d, r] of bodies) if (ok && ang(dir, d) < r) ok = false;
    if (ok) mask[y * W + x] = 1;
  }
  const inMask = (x, y) => x >= 0 && y >= 0 && x < W && y < Hh && mask[y * W + x] === 1;
  const curve = SR.curveOf(img, Hl, inMask), target = SR.REF && JSON.parse(fs.readFileSync(SR.REF, 'utf8')).targets[V.kind];
  const dE = target ? SR.compare(curve, target) : null;
  const structure = SR.structureOf(img);
  const sp = V.sunPx, disc = sp ? SR.sunDiscOf(full, sp.x * full.w / V.W, sp.y * full.h / V.H, sp.ppd * full.h / V.H) : null;
  return { view: V.name, hour: V.hour, kind: V.kind, H: Hl, curve: curve.map(b => ({ n: b.n, rgb: b.rgb, lab: b.lab, L: b.L, C: b.C, h: b.h })), dE, structure, disc, golden: V.kind === 'golden' };
}
async function post(views) {
  const meta = JSON.parse(fs.readFileSync(OUT + 'views.json', 'utf8'));
  const res = [];
  for (const V of meta.views.filter(v => views.includes(v.name))) {
    const src = OUT + V.name + '/out.png', dst = SHOTS + 'skyoff_' + V.name + '_' + tag + '.png';
    if (!fs.existsSync(src)) { console.log('  !! no picture for ' + V.name); continue; }
    fs.copyFileSync(src, dst);
    const r = await measure(V, dst);
    res.push(r);
    const f = (v) => (v === null || v === undefined ? ' —' : v.toFixed(0).padStart(2));
    console.log(`${V.name.padEnd(14)} ΔE ${r.dE ? r.dE.map(f).join(' ') : '—'} (mean ${r.dE ? (r.dE.filter(x => x !== null).reduce((a, b) => a + b, 0) / r.dE.filter(x => x !== null).length).toFixed(1) : '—'}) · L* ${r.curve.map(b => (b.L === undefined ? '—' : b.L.toFixed(0))).join(' ')} · C* ${r.curve.map(b => (b.C === undefined ? '—' : b.C.toFixed(0))).join(' ')}`);
    console.log(`${''.padEnd(14)} structure sd ${r.structure.sd} sat ${r.structure.sat} (luma ${r.structure.luma}) · disc ${r.disc ? r.disc.width + '° max ' + r.disc.max + ' rings ' + [1, 2, 3, 5].map(k => r.disc.ring[k]).join('/') : '—'} → ${dst.replace(ROOT, '')}`);
  }
  fs.writeFileSync(OUT + 'result.json', JSON.stringify({ tag, preset: PRESET, results: res }, null, 1));
  return res;
}

(async () => {
  const views = viewsArg ? viewsArg.split(',') : DEFAULT_VIEWS;
  const q = Object.assign({}, Q[PRESET], process.env.NOBLOOM ? { bloom: false } : {}, process.env.QX ? JSON.parse(process.env.QX) : {});
  if (cmd === 'glsl') {
    // the preset's programs that the sky's and the light's switches touch, compiled and linked by Mesa (no browser): the
    // sky, the cumulus sprites, the box clouds, the composite — a shader typo found before a browser run is spent on it
    S3.use(q); L2.use(q);
    const dx = (q.wxDrama ? ['WXDRAMA'] : []).concat(q.motion ? ['MOTION'] : []);
    const progs = { sky: programText(S.FS_VS, S.SKY_FS, 'sky', (q.lite ? ['LITE'] : []).concat(dx)), puff: programText(S.PUFF_VS, S.PUFF_FS, 'puff', q.wxDrama ? ['WXDRAMA'] : []), composite: programText(S.FS_VS, S.COMPOSITE_FS, 'composite', []) };
    if (S.CLOUD_VS && S.CLOUD_FS) progs.cloud = programText(S.CLOUD_VS, S.CLOUD_FS, 'cloud', dx);
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(OUT + 'views.json', JSON.stringify({ programs: progs, views: [] }));
    execFileSync('python3', [path.join(__dirname, 'sky_offline.py'), OUT], { stdio: 'inherit' });
    console.log(`compiled and linked ${Object.keys(progs).join(', ')} (${PRESET}; defines: ${Object.entries(progs).map(([k, v]) => k + ' ' + v.defines.join('+')).join(' · ')})`);
    return;
  }
  if (cmd === 'prep' || cmd === 'run') { prep(views, q); console.log(`prepared ${views.length} views (${PRESET}) in ${OUT.replace(ROOT, '')}`); }
  if (cmd === 'run') execFileSync('python3', [path.join(__dirname, 'sky_offline.py'), OUT], { stdio: 'inherit' });
  if (cmd === 'post' || cmd === 'run') await post(views);
})().catch(e => { console.error(e); process.exit(1); });
