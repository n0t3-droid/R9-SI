// ============================================================================
// WebGL2 helpers
// ============================================================================
(function (VR) {
  'use strict';
  const GL = VR.GL = {};
  GL.init = function (canvas) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: true, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: false, premultipliedAlpha: false });
    if (!gl) return null;
    GL.gl = gl;
    GL.ext = {
      multiDraw: gl.getExtension('WEBGL_multi_draw'),
      aniso: gl.getExtension('EXT_texture_filter_anisotropic'),
      cbf: gl.getExtension('EXT_color_buffer_float'),
      cbhf: gl.getExtension('EXT_color_buffer_half_float'),
      floatLinear: gl.getExtension('OES_texture_float_linear'),
      parallel: gl.getExtension('KHR_parallel_shader_compile'),   // (e-engine: GL.settle asks without waiting)
      timer: null,
    };
    GL.maxLayers = gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS);
    try { const dbg = gl.getExtension('WEBGL_debug_renderer_info'); GL.rendererName = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); } catch (e) { GL.rendererName = 'WebGL2'; }
    return gl;
  };
  GL.shader = function (type, src, name) {
    const gl = GL.gl;
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      const lines = src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n');
      console.error('Shader compile error (' + name + '):\n' + log + '\n' + lines);
      throw new Error('Shader compile failed: ' + name + ': ' + log);
    }
    return s;
  };
  GL.program = function (vsSrc, fsSrc, name, defines) {
    const gl = GL.gl;
    if (GL.defineHook) defines = GL.defineHook(name, defines || []);   // (t-light2: the light's switches add their defines by program — light2.js L2.hook)
    const pre = '#version 300 es\n' + (defines || []).map(d => d.startsWith('#') ? d + '\n' : '#define ' + d + '\n').join('');
    const fix = (src) => {
      // move #extension lines right after #version
      const ext = [], body = [];
      for (const line of src.split('\n')) (line.trim().startsWith('#extension') ? ext : body).push(line);
      return { ext: ext.join('\n'), body: body.join('\n') };
    };
    const v = fix(vsSrc), f = fix(fsSrc);
    const vsFull = '#version 300 es\n' + v.ext + '\n' + pre.replace('#version 300 es\n', '') + v.body;
    const fsFull = '#version 300 es\n' + f.ext + '\n' + pre.replace('#version 300 es\n', '') + '#define FRAG 1\nprecision highp float;\nprecision highp int;\nprecision highp sampler2DArray;\nprecision highp sampler2D;\n' + f.body;
    if (GL.deferred) return GL.deferProgram(vsFull, fsFull, name);   // (e-engine: a batch of programs, checked at first use)
    const p = gl.createProgram();
    gl.attachShader(p, GL.shader(gl.VERTEX_SHADER, vsFull, name + '.vs'));
    gl.attachShader(p, GL.shader(gl.FRAGMENT_SHADER, fsFull, name + '.fs'));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { const log = String(gl.getProgramInfoLog(p)); if (GL.onLinkFail) GL.onLinkFail(name, log); throw new Error('Link failed ' + name + ': ' + log); }
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); const nm = info.name.replace(/\[0\]$/, ''); u[nm] = gl.getUniformLocation(p, info.name); }
    return { p, u, name };
  };
  // e-engine · the programs of a batch (renderer.buildPrograms: GL.deferred = true) are compiled and linked without asking
  // for their status: every status query waits for the compiler, so asking after each program made the page wait for
  // each compile in turn (≈ 1 s of the start on the main thread here; on a PC whose driver compiles in parallel — ANGLE
  // does — the batch now compiles side by side while the page goes on). The status, the uniforms and the ready hooks
  // (GL.onReady) come at the program's first use: its .p or .u. A failed compile throws there with the same message.
  GL.deferProgram = function (vsFull, fsFull, name) {
    const gl = GL.gl, p = gl.createProgram();
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); gl.attachShader(p, s); return s; };
    const vs = sh(gl.VERTEX_SHADER, vsFull), fs = sh(gl.FRAGMENT_SHADER, fsFull);
    gl.linkProgram(p);
    let u = null, hooks = null, err = null;
    const prog = { name, deferred: true };
    const ready = () => {
      if (u) return;
      if (err) throw err;
      GL.pending.delete(prog);
      try { check(); } catch (e) { err = e; throw e; }
    };
    const check = () => {
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        for (const [s, src, nm] of [[vs, vsFull, name + '.vs'], [fs, fsFull, name + '.fs']]) {
          if (gl.getShaderParameter(s, gl.COMPILE_STATUS)) continue;
          const log = gl.getShaderInfoLog(s);
          console.error('Shader compile error (' + nm + '):\n' + log + '\n' + src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n'));
          if (GL.onLinkFail) GL.onLinkFail(name, String(log));
          throw new Error('Shader compile failed: ' + nm + ': ' + log);
        }
        const log = String(gl.getProgramInfoLog(p));
        if (GL.onLinkFail) GL.onLinkFail(name, log);   // (clockvol.js: too many texture units on a 16-unit GPU → its define off)
        throw new Error('Link failed ' + name + ': ' + log);
      }
      u = {};
      const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); const nm = info.name.replace(/\[0\]$/, ''); u[nm] = gl.getUniformLocation(p, info.name); }
      prog.isReady = true;
      if (hooks) { const h = hooks; hooks = null; for (const f of h) f(prog); }
    };
    Object.defineProperty(prog, 'p', { get() { ready(); return p; }, enumerable: true });
    Object.defineProperty(prog, 'u', { get() { ready(); return u; }, enumerable: true });
    prog.onReady = (f) => { if (u) f(prog); else (hooks || (hooks = [])).push(f); };
    prog.settle = (ext) => { if (u || err) return true; if (ext && !gl.getProgramParameter(p, ext.COMPLETION_STATUS_KHR)) return false; try { ready(); } catch (e) { if (GL.onFail) GL.onFail(e); else console.error(e); } return true; };
    GL.pending.add(prog);
    return prog;
  };
  // the deferred programs not used yet: made ready before a frame draws (renderer.render → GL.settle), never between its
  // draws — a status query in the middle of a frame waits for the draws before it (seconds on a software GPU: the first
  // played frame waited 4.3 s so). With KHR_parallel_shader_compile only the finished ones (the query does not wait);
  // without it all of them at once, one wait at the frame's start. A failed one throws at its first use, as before.
  GL.pending = new Set();
  GL.settle = function () {
    if (!GL.pending.size) return 0;
    const ext = GL.ext && GL.ext.parallel;
    let n = 0;
    for (const prog of [...GL.pending]) if (prog.settle(ext)) n++;
    return n;
  };
  // run f(prog) once the program is ready (at once for a program made the old way)
  GL.onReady = function (prog, f) { if (prog && prog.onReady) prog.onReady(f); else f(prog); return prog; };
  GL.tex2D = function (w, h, internal, format, type, opts) {
    const gl = GL.gl; opts = opts || {};
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, opts.data || null);
    const filt = opts.filter || gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, opts.minFilter || filt);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filt);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, opts.wrap || gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, opts.wrap || gl.CLAMP_TO_EDGE);
    if (opts.compare) { gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL); }
    return t;
  };
  GL.fbo = function (colors, depth) {
    const gl = GL.gl;
    const f = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, f);
    const bufs = [];
    (colors || []).forEach((t, i) => { gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0); bufs.push(gl.COLOR_ATTACHMENT0 + i); });
    if (depth) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0);
    if (bufs.length) gl.drawBuffers(bufs); else { gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE); }
    const st = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (st !== gl.FRAMEBUFFER_COMPLETE) { console.warn('FBO incomplete', st.toString(16)); return null; }
    return f;
  };
  // Fullscreen triangle VAO (no attributes; uses gl_VertexID)
  GL.fsTri = function (gl) { gl.drawArrays(gl.TRIANGLES, 0, 3); };
})(VR);
