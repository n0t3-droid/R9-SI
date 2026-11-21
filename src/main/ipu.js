// ============================================================================
// F10 · Bandbreite — the renderer for shared-memory GPUs (an integrated Vega, Iris, Adreno, Apple M: no memory of their
// own, every byte a pass reads or writes goes over the bus the CPU uses too). The pure rules the renderer and the game
// share; node-tested (test/ipu.js). Plan: docs/superpowers/plans/2026-10-15-f-ipu.md
//   IPU.SW                  the five switches: hdrLite · postLite · zPre · texLite · dprLite
//   IPU.defaults(p, gpu)    their defaults: on for Ultra · Leicht and on every preset of an integrated GPU (zPre not on
//                           Very Low; texLite, IPU.OPT_IN, nowhere — the player's choice)
//   IPU.probe(gl, ext)      can R11F_G11F_B10F be rendered to here (probed once; VR.GL.noFloatColor = true says no)
//   IPU.colorFormat(...)    the scene targets' format and its bytes a pixel
//   IPU.backing(...)        the canvas's backing store: never larger than the physical screen, ≤ 1920 × 1080 on lite
//   IPU.bytes(list)         what a frame's full-screen passes move (the renderer's pass log, stats.fsList)
// ============================================================================
(function (VR) {
  'use strict';
  const IPU = VR.IPU = VR.IPU || {};
  IPU.SW = ['hdrLite', 'postLite', 'zPre', 'texLite', 'dprLite'];
  // an integrated GPU: f-ultralite's detection (bench.js: a Ryzen's Radeon Graphics or Vega, Intel UHD / Iris / HD, Apple M,
  // phones' Adreno and Mali; a dedicated card — GeForce, Radeon RX / Pro, Arc — is not)
  IPU.integrated = (name) => !!(VR.Bench && VR.Bench.integrated && VR.Bench.integrated(name));
  // the switches' defaults: the preset Ultra · Leicht, or any preset on an integrated GPU (each switch makes the frame
  // cheaper there and leaves the picture as it was) — but zPre not on Very Low: its prepass draws the cut-out layer twice,
  // which pays only where that layer's shading is heavy (fancy leaves, the material tiers); SwiftShader cannot show its
  // gain (plan), so Very Low — never slower — keeps one pass. texLite is on nowhere: every form of it measured (2×
  // anisotropic, the far mip bias, the material's filtering alone) changed the grass slopes at a glancing angle (ΔE 0.7–1.3,
  // 8–16 % of the pixels above 2.3 at the lake: plan) — a switch for the player who trades that softness for speed
  // v0.55.87: zPre the player's choice too — on the owner's Radeon (Vega, Ultra) its prepass took 14.3 ms and the frame was
  // 18.5 ms faster without it (the cut-out pass no slower): such a GPU is bound by its triangles and the prepass draws them twice
  IPU.OPT_IN = ['texLite', 'zPre'];
  IPU.defaults = function (preset, gpu) {
    const on = preset === 'ultraLite' || IPU.integrated(gpu), o = {};
    for (const k of IPU.SW) o[k] = on && !IPU.OPT_IN.includes(k) && !(k === 'zPre' && preset === 'potato');
    return o;
  };

  // ---------------------------------------------------------------- 1 · hdrLite
  // R11F_G11F_B10F: three unsigned floats in 4 bytes (6-, 6- and 5-bit mantissas, the half float's exponent) — the scene's
  // light without its unused alpha, half the bytes of RGBA16F. WebGL 2 renders to it with EXT_color_buffer_float; the probe
  // makes a 4 × 4 one on a framebuffer, once per context (some drivers list the extension and still refuse the format)
  IPU.probe = function (gl, ext) {
    const G = VR.GL || {};
    if (G.noFloatColor) return false;                      // (the test of the fallback)
    if (!gl || !ext || !ext.cbf) return false;
    if (G.r11Gl === gl) return G.r11;
    let ok = false;
    try {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R11F_G11F_B10F, 4, 4, 0, gl.RGB, gl.HALF_FLOAT, null);
      const f = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, f);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.deleteFramebuffer(f); gl.deleteTexture(t);
    } catch (e) { ok = false; }
    G.r11Gl = gl; G.r11 = ok;
    return ok;
  };
  // the scene targets' format: with hdrLite where the probe passed R11F_G11F_B10F (4 bytes), else RGBA16F (8 bytes) as
  // before when the context has float colour buffers, else RGBA8 (no HDR)
  IPU.colorFormat = function (hdr, lite, r11) {
    if (!hdr) return { name: 'RGBA8', bytes: 4 };
    if (lite && r11) return { name: 'R11F_G11F_B10F', bytes: 4 };
    return { name: 'RGBA16F', bytes: 8 };
  };

  // ---------------------------------------------------------------- 5 · dprLite
  // the canvas's backing store for a CSS box cw × ch at the device pixel ratio dpr (capped at maxDpr, 1.5, as before).
  // clamp: never larger than the physical screen (sw × sh CSS pixels × the true dpr); cap: at most 1920 × 1080 worth of
  // pixels (Ultra · Leicht — a 4 K screen on an integrated GPU renders 1080p and the browser scales it up). One factor for
  // both axes: the aspect stays. → { W, H, k } (k: the factor applied, 1 = none; out: an object to fill — the renderer asks
  // every frame)
  IPU.CAP = 1920 * 1080;
  IPU.backing = function (cw, ch, dpr, maxDpr, sw, sh, clamp, cap, out) {
    const d = dpr > 0 ? dpr : 1, m = Math.min(d, maxDpr || 1.5);
    let W = Math.max(2, Math.floor(cw * m)), H = Math.max(2, Math.floor(ch * m)), k = 1;
    if (clamp) {
      if (sw > 0 && sh > 0) k = Math.min(k, (sw * d) / W, (sh * d) / H);
      if (cap) k = Math.min(k, Math.sqrt(IPU.CAP / (W * H)));
      if (k < 1) { W = Math.max(2, Math.floor(W * k + 1e-6)); H = Math.max(2, Math.floor(H * k + 1e-6)); }
    }
    const o = out || {};
    o.W = W; o.H = H; o.k = Math.min(1, k);
    return o;
  };

  // ---------------------------------------------------------------- 2 · postLite: the pass log's sums
  // the renderer logs every full-screen pass and blit of a frame (when renderer.passLog is set): { name, w, h, rd, wr } with
  // the bytes it reads and writes, one touch a texel (a pass's bilinear taps read its sources about once; the god rays'
  // march reads its sources many times over — counted in its own `fetch`)
  IPU.bytes = function (list) {
    let rd = 0, wr = 0, fetch = 0;
    for (const p of list || []) { rd += p.rd || 0; wr += p.wr || 0; fetch += p.fetch || 0; }
    return { n: (list || []).length, rd, wr, all: rd + wr, fetch };
  };
  // the estimate for a GPU that shares DDR4 with the CPU: ms = bytes ÷ effective bandwidth (GB/s; an assumption, stated
  // where it is used — a Vega 8 on dual-channel DDR4-3200 has 51 GB/s on paper, a GPU pass gets about half of it)
  IPU.ms = (bytes, gbps) => bytes / ((gbps || 20) * 1e6);
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
