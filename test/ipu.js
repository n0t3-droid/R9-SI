// F10 · Bandbreite (src/main/ipu.js and its places in renderer.js / game.js), no browser — a stub GL that remembers every
// texture's format, every full-screen draw and every blit:
//  a · the defaults: the switches on for Ultra · Leicht and on every preset of an integrated GPU (the owner's Radeon
//      Graphics 0x1638 through ANGLE) — zPre not on Very Low, texLite nowhere; off on a dedicated GPU and in SwiftShader
//  b · hdrLite: the probe (a 4 × 4 R11F_G11F_B10F target must be complete) and its fallback (incomplete, no
//      EXT_color_buffer_float, VR.GL.noFloatColor) — the scene colour, its copy, the bloom chain, the rays, the mirror and
//      the far cache in R11F_G11F_B10F, the TSR history in RGBA16F; off: everything as before
//  d · dprLite: the backing store never larger than the physical screen, ≤ 1920 × 1080 worth of pixels on lite
//   bash test/wt_run.sh ipu.js
const V = require('./load_shared.js');
global.window = { devicePixelRatio: 1, screen: { width: 1280, height: 720 } };
global.WebGLFramebuffer = class {};
require('../src/main/gl.js'); require('../src/main/shaders.js'); require('../src/main/bench.js'); require('../src/main/ultralite.js');
require('../src/main/ipu.js'); require('../src/main/renderer.js');
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
const IPU = V.IPU;
if (!IPU) { console.log('VR.IPU missing'); console.log('FAILED 1'); process.exit(1); }

// ---- the stub GL: a constant is its own name (so formats can be told apart); textures and framebuffers are objects
const log = { tex: [], fs: [], blit: [], prog: [] };
let failR11 = false;
const consts = {};
const gl = new Proxy({}, { get(t, k) {
  if (k in t) return t[k];
  if (typeof k === 'string' && /^[A-Z][A-Z_0-9]+$/.test(k)) return consts[k] || (consts[k] = k);
  return (...a) => {
    if (k === 'createTexture') { const o = { kind: 'tex', fmt: null, w: 0, h: 0 }; log.tex.push(o); return o; }
    if (k === 'createFramebuffer') return { kind: 'fb', att: [] };
    if (k === 'bindTexture') { gl.__tex = a[1]; return; }
    if (k === 'texImage2D') { const o = gl.__tex; if (o) { o.fmt = a[2]; o.w = a[3]; o.h = a[4]; } return; }
    if (k === 'bindFramebuffer') { if (a[0] === 'FRAMEBUFFER' || a[0] === 'DRAW_FRAMEBUFFER') gl.__fb = a[1]; return; }
    if (k === 'framebufferTexture2D') { if (gl.__fb) gl.__fb.att.push(a[3]); return; }
    if (k === 'checkFramebufferStatus') { const f = gl.__fb; return f && failR11 && f.att.some(x => x && x.fmt === 'R11F_G11F_B10F') ? 'FRAMEBUFFER_INCOMPLETE_ATTACHMENT' : 'FRAMEBUFFER_COMPLETE'; }
    if (k === 'drawArrays') { log.fs.push(a); return; }
    if (k === 'blitFramebuffer') { log.blit.push(a[8]); return; }
    if (k === 'getUniformBlockIndex') return 0;
    if (k === 'getParameter') return 16;
    if (k === 'shaderSource') { log.prog.push(a[1]); return; }
    if (k === 'getShaderParameter') return true;
    if (k === 'getProgramParameter') return a[1] === 'ACTIVE_UNIFORMS' ? 0 : true;
    return undefined;
  };
} });
V.GL.gl = gl;
const setExt = (o) => { V.GL.ext = Object.assign({ multiDraw: null, aniso: null, cbf: {}, cbhf: {} }, o); V.GL.r11Gl = null; V.GL.r11 = undefined; };
setExt({});
const M4 = V.mat4;
// a renderer without init(): the fields resize() and the targets need
function make(q, size) {
  const r = Object.create(V.Renderer.prototype);
  const [cw, ch] = size || [1280, 720];
  Object.assign(r, { gl, canvas: { clientWidth: cw, clientHeight: ch, width: 0, height: 0 }, multi: false, hdr: !!(V.GL.ext.cbf || V.GL.ext.cbhf), stats: { draws: 0, tris: 0 }, frameNo: 0,
    q: Object.assign({ scale: 1, shadows: 0, tsr: true, bloom: true, rays: true, fxaa: true, water: 2 }, q), P: {}, emptyVAO: {}, proj: M4.create(), view: M4.create(), viewProj: M4.create(), invViewProj: M4.create(), planes: new Float32Array(24), tmpM: M4.create(), tmpM2: M4.create() });
  r.resize(true);
  return r;
}
const fmtOf = (t) => (t ? t.fmt : null);

console.log('a · the defaults');
{
  const VEGA = 'ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001638) Direct3D11 vs_5_0 ps_5_0, D3D11)';
  const all = (o, v) => IPU.SW.every(k => o[k] === v);
  check(IPU.SW.join() === 'hdrLite,postLite,zPre,texLite,dprLite', 'five switches', IPU.SW.join(' · '));
  // (texLite on no preset and no GPU — every form of it changed far slopes, plan: the player's choice; zPre not on Very Low)
  const lite = (o, potato) => IPU.SW.every(k => o[k] === (k !== 'texLite' && !(potato && k === 'zPre')));
  check(IPU.OPT_IN.join() === 'texLite' && IPU.SW.every(k => IPU.defaults('ultraLite', VEGA).texLite === false), 'texLite: turned on by no preset and no GPU (it softens far slopes: the player\'s choice)');
  check(lite(IPU.defaults('ultraLite', 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11)')), 'Ultra · Leicht: on (any GPU), texLite aside');
  check(['low', 'balanced', 'high', 'ultra'].every(p => lite(IPU.defaults(p, VEGA))), 'the owner\'s Radeon Graphics (an integrated Vega): on for every preset from Low up, texLite aside');
  const vl = IPU.defaults('potato', VEGA);
  check(lite(vl, true), 'Very Low there: hdrLite, postLite, dprLite — not zPre (its prepass draws the cut-out layer twice)', JSON.stringify(vl));
  check(lite(IPU.defaults('high', 'Intel(R) Iris(R) Xe Graphics')) && lite(IPU.defaults('low', 'Apple M2')) && lite(IPU.defaults('balanced', 'Adreno (TM) 650')), 'Iris, Apple M, Adreno: on');
  check(all(IPU.defaults('high', 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11)'), false) && all(IPU.defaults('ultra', 'AMD Radeon RX 6700 XT'), false), 'a dedicated GPU: off (Ultra · Leicht aside)');
  check(all(IPU.defaults('potato', 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)'), false), 'SwiftShader (the tests\' browser): off — the presets as before');
}

console.log('b · hdrLite: the probe and the fallback');
{
  setExt({});
  check(IPU.probe(gl, V.GL.ext) === true, 'EXT_color_buffer_float and a complete 4 × 4 target: R11F_G11F_B10F');
  setExt({}); failR11 = true;
  check(IPU.probe(gl, V.GL.ext) === false, 'the framebuffer incomplete: no');
  failR11 = false; setExt({ cbf: null });
  check(IPU.probe(gl, V.GL.ext) === false, 'without EXT_color_buffer_float (only half floats): no');
  setExt({}); V.GL.noFloatColor = true; const n0 = log.tex.length;
  check(IPU.probe(gl, V.GL.ext) === false && log.tex.length === n0, 'VR.GL.noFloatColor = true: no, without a probe');
  V.GL.noFloatColor = false;
  check(IPU.colorFormat(true, true, true).bytes === 4 && IPU.colorFormat(true, false, true).name === 'RGBA16F' && IPU.colorFormat(true, true, false).name === 'RGBA16F' && IPU.colorFormat(false, true, true).name === 'RGBA8', 'the format: R11F_G11F_B10F (4 bytes) only with hdrLite and the probe, RGBA16F (8) as before, RGBA8 without HDR');

  // the renderer's targets
  const targets = (r) => ({ scene: fmtOf(r.sceneCol), copy: fmtOf(r.copyCol), bloom: [...new Set(r.bloom.map(b => fmtOf(b.tex)))].join('/'), rays: fmtOf(r.raysTex), hist: fmtOf(r.histTex0) + '/' + fmtOf(r.histTex1) });
  setExt({});
  const off = make({ hdrLite: false }), to = targets(off);
  check(to.scene === 'RGBA16F' && to.copy === 'RGBA16F' && to.bloom === 'RGBA16F' && to.rays === 'RGBA16F' && to.hist === 'RGBA16F/RGBA16F', 'off: every target RGBA16F as before', JSON.stringify(to));
  setExt({});
  const on = make({ hdrLite: true }), tn = targets(on);
  check(tn.scene === 'R11F_G11F_B10F' && tn.copy === 'R11F_G11F_B10F' && tn.bloom === 'R11F_G11F_B10F' && tn.rays === 'R11F_G11F_B10F', 'on: the scene colour, its copy, the bloom chain and the rays target in R11F_G11F_B10F', JSON.stringify(tn));
  check(tn.hist === 'RGBA16F/RGBA16F', 'the TSR history stays RGBA16F (fed back every frame: 5–6 mantissa bits would stall its blend)');
  check(on.hdr === true && on.stats.sceneFmt === 'R11F_G11F_B10F' && off.stats.sceneFmt === 'RGBA16F', 'the renderer says which format it draws in (stats.sceneFmt)', on.stats.sceneFmt + ' · ' + off.stats.sceneFmt);
  on.q.water = 2; on.ensureReflection();
  check(fmtOf(on.reflCol) === 'R11F_G11F_B10F', 'the water mirror too', fmtOf(on.reflCol));
  const L = on.fcLayer(); on.fcEnsure(L, 64, 32);
  check(fmtOf(L.col) === 'R11F_G11F_B10F', 'and the far cache (F9)', fmtOf(L.col));
  on.q.hdrLite = false; on.resize(true); on.ensureReflection(); on.fcEnsure(L, 64, 32);
  check(fmtOf(on.sceneCol) === 'RGBA16F' && fmtOf(on.reflCol) === 'RGBA16F' && fmtOf(L.col) === 'RGBA16F', 'switched off: the targets are made again in RGBA16F (the mirror, the far cache too)');
  setExt({}); failR11 = true;
  const fb = make({ hdrLite: true });
  check(fmtOf(fb.sceneCol) === 'RGBA16F' && fmtOf(fb.copyCol) === 'RGBA16F' && fb.hdr === true && fb.stats.sceneFmt === 'RGBA16F', 'the probe failed: RGBA16F, HDR kept', fmtOf(fb.sceneCol));
  failR11 = false; setExt({}); V.GL.noFloatColor = true;
  const nf = make({ hdrLite: true });
  check(fmtOf(nf.sceneCol) === 'RGBA16F' && nf.hdr === true, 'VR.GL.noFloatColor (the forced fallback): RGBA16F');
  V.GL.noFloatColor = false;
  setExt({ cbf: null, cbhf: null });
  const ldr = make({ hdrLite: true });
  check(fmtOf(ldr.sceneCol) === 'RGBA8' && ldr.hdr === false, 'no float colour at all: RGBA8 as before');
  setExt({});
}

console.log('c · postLite: the full-screen passes of a frame and their bytes');
{
  // a frame's post chain (the copy, TSR when it runs, bloom, rays, composite, FXAA) with the sun on the screen
  const stubP = () => ({ p: {}, u: new Proxy({}, { get: () => undefined }) });
  const E = { sunDir: [0, 0.5, -0.866], moonDir: [0, -1, 0], dimId: 0, rain: 0, rays: 0.55, exposure: 1, bloomStrength: 0.06, bloomThreshold: 1.1, vignette: 0.55, saturation: 1.12, contrast: 0, grade: [1, 1, 1], vivid: 0, time: 1 };
  const frame = (q, water, size) => {
    const r = make(q, size);
    r.P = { bloomPre: stubP(), down: stubP(), up: stubP(), rays: stubP(), composite: stubP(), fxaa: stubP(), tsr: stubP() };
    r.passLog = true; r.stats.fsList = []; r.stats.fsPasses = 0;
    r.setupCamera({ x: 8, y: 70, z: 8, yaw: 0, pitch: Math.asin(0.5), fov: 75 * Math.PI / 180, far: 1200 });   // (looking into the sun)
    const vis = [{ ox: 0, oy: 64, oz: -32, fade: 1, transW: water, mesh: [null, null, { count: 6 }, null, null] }];
    const F = { cam: r.cam, underwater: false };
    log.fs.length = 0; log.blit.length = 0;
    r.refrCopy(F, E, vis);
    if (r.jit) r.superRes(F);
    r.post(F, E);
    const names = r.stats.fsList.map(x => x.name);
    return { r, names, n: r.stats.fsPasses, draws: log.fs.length, blits: log.blit.slice(), b: IPU.bytes(r.stats.fsList) };
  };
  const ULTRA = { scale: 1, bloom: true, rays: true, fxaa: true, tsr: true, sharpen: 0.35 };
  const u0 = frame(ULTRA, true), u1 = frame(Object.assign({ postLite: true }, ULTRA), true), u2 = frame(Object.assign({ postLite: true }, ULTRA), false);
  console.log('     Ultra, off: ' + u0.names.join(' · '));
  console.log('     Ultra, postLite: ' + u1.names.join(' · '));
  check(u0.names.join() === 'copyColour,copyDepth,bloomPre,down,down,down,down,up,up,up,up,rays,composite,fxaa' && u0.n === 14 && u0.draws === 12 && u0.blits.length === 2, 'off: one Ultra frame as before — 2 blits, bloom 1 + 4 + 4, rays, composite, FXAA', `${u0.n} passes`);
  check(u1.names.join() === 'copyColour,copyDepth,bloomPre,down,down,down,down,up,up,up,up,raysMask,rays,composite,fxaa' && u1.n === u0.n + 1 && u2.n === u0.n, 'postLite with water and the sun in view: the rays from a ¼-res mask (a pass more); FXAA and the bloom chain as before (both folds measured as losses: plan)', `${u0.n} → ${u1.n} passes, ${u2.n} without water`);
  check(!log.prog.some(t => /#define (BLOOM_UP|FXAA_IN)/.test(t)) && log.prog.some(t => /#define MASK/.test(t)), 'the rays\' march compiled with MASK (the mask its source)');
  check(u2.blits.join() === 'DEPTH_BUFFER_BIT' && u2.names[0] === 'copyDepth', 'no water in view: no colour copy (the depth stays: the rays read it)', u2.blits.join());
  const ub = (b) => (b.all / 1048576).toFixed(1) + ' MB';
  check(u1.b.all < u0.b.all && u2.b.all < u1.b.all, 'the bytes the passes move: fewer', `1280 × 720 Ultra: ${ub(u0.b)} → ${ub(u1.b)} (water in view) → ${ub(u2.b)} (none); god-ray fetches ${u0.b.fetch} → ${u1.b.fetch}`);
  const h1 = frame(Object.assign({ postLite: true, hdrLite: true }, ULTRA), false);
  check(h1.b.all < u2.b.all * 0.75, 'with hdrLite too (4 bytes a pixel)', `${ub(u2.b)} → ${ub(h1.b)}`);
  // Low at 0.75 (the owner's measured setting): TSR, bloom, no rays, no FXAA
  const LOW = { scale: 0.75, bloom: true, rays: false, fxaa: false, tsr: true, sharpen: 0.35 };
  const l0 = frame(LOW, false), l1 = frame(Object.assign({ postLite: true }, LOW), false), l2 = frame(Object.assign({ postLite: true, hdrLite: true }, LOW), false);
  console.log('     Low, off: ' + l0.names.join(' · '));
  console.log('     Low, postLite + hdrLite: ' + l2.names.join(' · '));
  check(l0.names.includes('tsr') && l0.blits.length === 2 && l1.blits.join() === 'DEPTH_BUFFER_BIT' && l1.n === l0.n - 1, 'Low (TSR): the depth copy stays for TSR, no colour copy without water', `${l0.n} → ${l1.n} passes`);
  const HIGH = { scale: 1, bloom: true, rays: false, fxaa: true, tsr: true }, h0 = frame(HIGH, false), p0 = frame(Object.assign({ postLite: true }, HIGH), false);
  check(p0.blits.length === 0 && p0.n === h0.n - 2, 'neither water nor the sun in view (the plaza at noon): no copy at all', `${h0.n} → ${p0.n} passes, ${ub(h0.b)} → ${ub(p0.b)}`);
  check(l2.b.all < l0.b.all, 'Low\'s bytes', `960 × 540 → 1280 × 720: ${ub(l0.b)} → ${ub(l1.b)} → ${ub(l2.b)} (with hdrLite)`);
  const big0 = frame(ULTRA, true, [1920, 1080]), big1 = frame(Object.assign({ postLite: true, hdrLite: true }, ULTRA), false, [1920, 1080]);
  console.log(`     1920 × 1080 Ultra: ${ub(big0.b)} → ${ub(big1.b)} without water (${(IPU.ms(big0.b.all - big1.b.all, 20)).toFixed(2)} ms at 20 GB/s)`);
}

console.log('e · zPre and texLite: their programs and the sampler; off: the terrain programs as before');
{
  const progs = [], orig = V.GL.program;
  V.GL.program = (vs, fs, name, defs) => { progs.push({ name, defs: (defs || []).slice() }); return orig(vs, fs, name, defs); };
  const defsOf = (r, q) => { progs.length = 0; Object.assign(r.q, q); r.buildPrograms(); const o = {}; for (const p of progs) o[p.name] = p.defs.join(' '); return o; };
  const r = make({ shadows: 2048, hshadow: true });
  const off = defsOf(r, {});
  check(off.terrain === 'SHADOWS HSHADOW FADE SOFTFADE' && off.terrainCut === 'SHADOWS HSHADOW CUTOUT FADE SOFTFADE', 'off: the opaque and cut-out programs with the defines they had (+ SOFTFADE, f-stipple)', `${off.terrain} · ${off.terrainCut}`);
  const z = defsOf(r, { zPre: true });
  check(z.terrainCut === 'SHADOWS HSHADOW CUTOUT FADE ZINV SOFTFADE' && z.terrain === off.terrain, 'zPre: the cut-out colour pass with invariant positions (ZINV), the opaque one unchanged', z.terrainCut);
  progs.length = 0; const zp = r.zProgram();
  check(progs.length === 1 && progs[0].defs.join(' ') === 'SHADOWS HSHADOW CUTOUT FADE ZINV ZPRE' && r.zProgram() === zp, 'its prepass program: the same defines and ZPRE, made once', progs.length ? progs[0].defs.join(' ') : 'none');
  const fsSrc = require('fs').readFileSync(__dirname + '/../src/main/shaders.js', 'utf8');
  check(/#ifdef ZPRE\n\s+o_col = vec4\(1\.0 \/ 255\.0[^\n]*return;/.test(fsSrc) && /#ifdef ZINV\ninvariant gl_Position;/.test(fsSrc), 'the shader: ZPRE returns right after the alpha test; ZINV declares gl_Position invariant');
  const t = defsOf(r, { zPre: false, texLite: true });
  check(t.terrain === off.terrain && t.terrainCut === off.terrainCut && !/TEXLITE/.test(fsSrc), 'texLite: the terrain programs as they were (its far mip bias was measured and dropped: plan) — the sampler alone', `${t.terrain} · ${t.terrainCut}`);
  // the anisotropic filtering (setAniso through applyQ): the level each texture is left with
  V.GL.ext.aniso = { MAX_TEXTURE_MAX_ANISOTROPY_EXT: 'MAXA', TEXTURE_MAX_ANISOTROPY_EXT: 'A' };
  const r2 = make({}); r2.texAlbedo = { n: 'albedo' }; r2.texMaterial = { n: 'material' };
  const lvl = {}, tp = gl.texParameterf; gl.texParameterf = (a, b, v) => { if (b === 'A' && gl.__tex) lvl[gl.__tex.n] = v; };
  r2.qBase = {}; r2.setAniso(4); const was = `${lvl.albedo}/${lvl.material}`;
  r2.setQuality({ texLite: true }); const on = `${lvl.albedo}/${lvl.material}`;
  r2.setAniso(r2.anisoLevel || 4); const again = `${lvl.albedo}/${lvl.material}`;   // (a texture set swapped in later)
  r2.setQuality({ texLite: false }); const back = `${lvl.albedo}/${lvl.material}`;
  gl.texParameterf = tp; V.GL.ext.aniso = null;
  check(was === '4/4' && on === '2/2' && again === '2/2' && back === '4/4', 'texLite: both textures filtered 2× anisotropic (a later texture set too); off: 4× again', `colour/material: ${was} → ${on} (${again}) → ${back}`);
  V.GL.program = orig;
}

console.log('f · zPre: the order the opaque and cut-out sections are drawn in (collectVisible, unchanged)');
{
  // a world of meshed sections round the eye (as frame_cost.js): the walk's list must be front to back along every line of
  // sight — of two sections in the same direction (within 8°) the nearer one comes first — so the nearer surface is in the
  // depth buffer when the farther one is shaded; a full distance sort would only reorder sections that cannot hide each other
  global.Worker = class { constructor() { this.inflight = 0; } postMessage() {} terminate() {} };
  global.Blob = class {}; global.URL = { createObjectURL: () => 'blob:x' };
  require('../src/main/world.js');
  const RD = 8, pool = { workers: [{ inflight: 0 }], queue: [], queueFar: [], submitted: [], submit() {}, pump() {}, broadcast() {}, queueDirty: false };
  const world = new V.World({}, { dim: 'overworld', seed: 1, genOpts: {}, pool, renderer: { freeSection() {}, uploadSection() {}, q: { vxLod: 48 } }, renderDist: RD });
  for (let cz = -RD - 2; cz <= RD + 2; cz++) for (let cx = -RD - 2; cx <= RD + 2; cx++) {
    const c = new V.Column(cx, cz);
    for (let sy = 0; sy < 16; sy++) { const sc = c.sec[sy]; sc.count = sy < 6 ? 4096 : 0; sc.meshed = true; sc.hasMesh = sy < 6; sc.vis = 0x7fff; sc.ox = cx * 16; sc.oy = sy * 16; sc.oz = cz * 16; sc.mesh = [sy < 6 ? { count: 96 } : null, null, null, null, null]; }
    c.ready = true; world.cols.set(c.key, c);
  }
  const r = Object.create(V.Renderer.prototype);
  r.visList = []; r.visDirty = true; r.visKey = ''; r.frameNo = 1; r.q = { noCaveCull: false };
  const cam = { x: 8.5, y: 70.5, z: 8.5 }, list = r.collectVisible(world, cam).slice();
  const P = list.map(sc => { const x = sc.ox + 8 - cam.x, y = sc.oy + 8 - cam.y, z = sc.oz + 8 - cam.z, d = Math.hypot(x, y, z); return { d, x: x / d, y: y / d, z: z / d }; });
  let pairs = 0, wrong = 0, worst = 0; const cos8 = Math.cos(8 * Math.PI / 180);
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
    const a = P[i], b = P[j];
    if (a.x * b.x + a.y * b.y + a.z * b.z < cos8 || Math.abs(a.d - b.d) < 16) continue;
    pairs++; if (b.d < a.d) { wrong++; worst = Math.max(worst, a.d - b.d); }
  }
  let inv = 0; for (let i = 1; i < P.length; i++) if (P[i].d < P[i - 1].d - 16) inv++;
  check(list.length > 500 && wrong === 0, 'front to back along every line of sight: of two sections in one direction the nearer is drawn first', `${list.length} sections, ${pairs} pairs in line, ${wrong} out of order${wrong ? ' (worst ' + worst.toFixed(0) + ' blocks)' : ''}; across directions ${inv} steps back by more than a section (breadth-first by section steps)`);
}

console.log('d · dprLite: the backing store');
{
  const b = (o) => IPU.backing(o.cw, o.ch, o.dpr, 1.5, o.sw, o.sh, o.clamp, o.cap);
  const s125 = b({ cw: 1536, ch: 864, dpr: 1.25, sw: 1536, sh: 864, clamp: true });
  check(s125.W === 1920 && s125.H === 1080 && s125.k === 1, 'a 1920 × 1080 screen at 125 %, the window full: 1920 × 1080 (the physical screen)', `${s125.W} × ${s125.H}`);
  const s150 = b({ cw: 1280, ch: 720, dpr: 1.5, sw: 1280, sh: 720, clamp: true });
  check(s150.W === 1920 && s150.H === 1080, 'at 150 %: 1920 × 1080', `${s150.W} × ${s150.H}`);
  const big = b({ cw: 2400, ch: 1350, dpr: 1.25, sw: 1536, sh: 864, clamp: true }), bigOff = b({ cw: 2400, ch: 1350, dpr: 1.25, sw: 1536, sh: 864, clamp: false });
  check(bigOff.W === 3000 && big.W <= 1920 && big.H <= 1080 && Math.abs(big.W / big.H - 3000 / 1687) < 0.01, 'a canvas larger than the screen (a zoomed-out page): clamped to the physical screen, the aspect kept (off: as before)', `${bigOff.W} × ${bigOff.H} → ${big.W} × ${big.H}`);
  const k4 = b({ cw: 1920, ch: 1080, dpr: 2, sw: 1920, sh: 1080, clamp: true }), k4L = b({ cw: 1920, ch: 1080, dpr: 2, sw: 1920, sh: 1080, clamp: true, cap: true });
  check(k4.W === 2880 && k4.H === 1620, 'a 4 K laptop at 200 %: 2880 × 1620 as before (the 1.5 cap; within the screen)', `${k4.W} × ${k4.H}`);
  check(k4L.W === 1920 && k4L.H === 1080, 'on Ultra · Leicht: 1920 × 1080 (the browser scales it up)', `${k4L.W} × ${k4L.H}`);
  const uw = b({ cw: 2560, ch: 1080, dpr: 1, sw: 2560, sh: 1080, clamp: true, cap: true });
  check(uw.W * uw.H <= IPU.CAP && Math.abs(uw.W / uw.H - 2560 / 1080) < 0.01, 'an ultrawide 2560 × 1080 on lite: 1920 × 1080 worth of pixels, its own aspect', `${uw.W} × ${uw.H}`);
  const hd = b({ cw: 1280, ch: 720, dpr: 1, sw: 1920, sh: 1080, clamp: true, cap: true });
  check(hd.W === 1280 && hd.H === 720 && hd.k === 1, 'a window smaller than that: untouched', `${hd.W} × ${hd.H}`);
  // the renderer: canvas.width / height follow the rule when dprLite is on
  global.window = { devicePixelRatio: 2, screen: { width: 1920, height: 1080 } };
  const r0 = make({ dprLite: false }, [1920, 1080]), r1 = make({ dprLite: true, dprCap: true }, [1920, 1080]);
  check(r0.W === 2880 && r1.W === 1920 && r1.H === 1080 && r1.canvas.width === 1920, 'the renderer on a 4 K laptop: 2880 wide as before, 1920 × 1080 with dprLite on Ultra · Leicht', `${r0.W} → ${r1.W} × ${r1.H}`);
  global.window = { devicePixelRatio: 1, screen: { width: 1280, height: 720 } };
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
