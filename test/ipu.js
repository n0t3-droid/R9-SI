// F10 · Bandbreite (src/main/ipu.js and its places in renderer.js / game.js), no browser — a stub GL that remembers every
// texture's format, every full-screen draw and every blit:
//  a · the defaults: the five switches on for Ultra · Leicht and on every preset of an integrated GPU (the owner's Radeon
//      Graphics 0x1638 through ANGLE); off on a dedicated GPU and in SwiftShader
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
    q: Object.assign({ scale: 1, shadows: 0, tsr: true, bloom: true, rays: true, fxaa: true, water: 2 }, q), P: {}, emptyVAO: {}, proj: M4.create(), view: M4.create(), viewProj: M4.create(), invViewProj: M4.create() });
  r.resize(true);
  return r;
}
const fmtOf = (t) => (t ? t.fmt : null);

console.log('a · the defaults');
{
  const VEGA = 'ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001638) Direct3D11 vs_5_0 ps_5_0, D3D11)';
  const all = (o, v) => IPU.SW.every(k => o[k] === v);
  check(IPU.SW.join() === 'hdrLite,postLite,zPre,texLite,dprLite', 'five switches', IPU.SW.join(' · '));
  check(all(IPU.defaults('ultraLite', 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11)'), true), 'Ultra · Leicht: on (any GPU)');
  check(['potato', 'low', 'balanced', 'high', 'ultra'].every(p => all(IPU.defaults(p, VEGA), true)), 'the owner\'s Radeon Graphics (an integrated Vega): on for every preset');
  check(all(IPU.defaults('high', 'Intel(R) Iris(R) Xe Graphics'), true) && all(IPU.defaults('low', 'Apple M2'), true) && all(IPU.defaults('balanced', 'Adreno (TM) 650'), true), 'Iris, Apple M, Adreno: on');
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
