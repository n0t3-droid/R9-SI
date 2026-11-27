// ============================================================================
// /prüfstand · Lastsprünge für Smart Quality: how the governor answers on THIS machine, measured in the running game.
// A test bench in the engineering sense: known loads go on in turns and the answer is timed. Software tests cannot say
// how Smart Quality behaves on a real graphics card (a software GPU spends its time elsewhere), so the game loads itself:
//   · GPU: a pass inside the frame's GPU timer that costs a set number of milliseconds, calibrated on this card first
//     (a loop count per pixel); it is drawn at the picture's own resolution, so Smart Quality's resolution rungs lighten
//     it as they would a heavy scene. Only where the browser tells GPU times (EXT_disjoint_timer_query): without them a
//     loop count would be a guess, and the GPU part is left out
//   · CPU: a busy wait in the frame that grows with the villagers drawn (folkDist), so the processor rungs can lighten it
//   · a ramp: the GPU load rising slowly over 20 s (the turn toward the sea, drawn out)
// Recorded each frame: the frame's cost, Smart Quality's ladder, AQPredict's forecast. Per load the answer: the first
// rung's delay, the rungs taken, when the frame rate came back, the pumping (a rung given back and taken again while the
// load lasts), the forecast's typical error, and in the rest after it how long the rungs took to come back.
// The result goes to the chat and a panel (German or English), the run's frames to P.last (and the console as JSON).
// Nothing stays changed: the loads stop, Smart Quality's switch is as it was. /prüfstand again stops a run.
// Tested in node: test/pruefstand.js (the plan, the analysis, the burners' sizes, the wiring).
// ============================================================================
(function (VR) {
  'use strict';
  const P = VR.Pruefstand = {};
  P.LOOP_CAP = 2048;     // loops per pixel at most (with the calibration, a GPU step never asks more than MAX_MS)
  P.MAX_MS = 24; P.MIN_MS = 6;
  P.N0 = 64;             // the calibration's loop count: a few milliseconds on a laptop's GPU
  P.on = false; P.gpuOn = false; P.loops = 0; P.cpuMs = 0; P.last = null;
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const med = (a) => { const s = a.filter(Number.isFinite).slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
  const r1 = (x) => (Number.isFinite(x) ? Math.round(x * 10) / 10 : null);

  // ---------------------------------------------------------------- the plan: [{ id, kind, s, ms }]
  // kind: rest · eich (the GPU calibration) · gpu · cpu · ramp; ms: the step's size, 0.9 × the frame budget (6–24 ms)
  P.plan = function (budget, k) {
    const X = Math.round(Math.max(P.MIN_MS, Math.min(P.MAX_MS, budget * 0.9)) * 10) / 10, f = k || 1;
    return [
      { id: 'ruhe0', kind: 'rest', s: 8 * f },
      { id: 'eich', kind: 'eich', s: 6 * f },
      { id: 'ruhe1', kind: 'rest', s: 10 * f },
      { id: 'gpu', kind: 'gpu', s: 22 * f, ms: X },
      { id: 'ruhe2', kind: 'rest', s: 18 * f },
      { id: 'cpu', kind: 'cpu', s: 22 * f, ms: X },
      { id: 'ruhe3', kind: 'rest', s: 18 * f },
      { id: 'rampe', kind: 'ramp', s: 20 * f, ms: X },
      { id: 'ruhe4', kind: 'rest', s: 18 * f },
    ];
  };
  // the load at second t: { kind, id, i, t0, gpu, cpu } (kind 'done' after the last phase)
  P.loadAt = function (plan, t) {
    let t0 = 0;
    for (let i = 0; i < plan.length; i++) {
      const p = plan[i];
      if (t < t0 + p.s) {
        const gpu = p.kind === 'gpu' ? p.ms : p.kind === 'ramp' ? p.ms * Math.max(0, t - t0) / p.s : 0;
        return { kind: p.kind, id: p.id, i, t0, gpu, cpu: p.kind === 'cpu' ? p.ms : 0 };
      }
      t0 += p.s;
    }
    return { kind: 'done', id: 'done', i: plan.length, t0, gpu: 0, cpu: 0 };
  };

  // ---------------------------------------------------------------- the analysis
  // frames: [{ t, dt, ms (the frame's cost), stack (Smart Quality's ladder, one letter a rung), pred, mean }]
  P.analyze = function (frames, plan, target) {
    const starts = []; let acc = 0; for (const p of plan) { starts.push(acc); acc += p.s; }
    const depth = (f) => (f.stack || '').length;
    const loads = [];
    for (let i = 0; i < plan.length; i++) {
      const p = plan[i]; if (p.kind !== 'gpu' && p.kind !== 'cpu' && p.kind !== 'ramp') continue;
      const t0 = starts[i], t1 = t0 + p.s, rest = plan[i + 1] && plan[i + 1].kind === 'rest' ? plan[i + 1] : null, t2 = rest ? t1 + rest.s : t1;
      const inL = frames.filter((f) => f.t >= t0 && f.t < t1), before = frames.filter((f) => f.t < t0);
      const d0 = before.length ? depth(before[before.length - 1]) : (inL.length ? depth(inL[0]) : 0);
      let first = null, maxD = d0, pump = 0, prev = d0, down = false, recover = null;
      for (let j = 0; j < inL.length; j++) {
        const f = inL[j], d = depth(f);
        if (first === null && d > d0) first = f.t - t0;
        if (d > maxD) maxD = d;
        if (d < prev) down = true; else if (d > prev && down) { pump++; down = false; }
        prev = d;
        // the frame rate over the last half second back at the target (a little under it: the governor's own 'fine')
        if (recover === null && f.t >= t0 + 0.5) {
          const win = inL.filter((q) => q.t > f.t - 0.5 && q.t <= f.t), fps = win.length ? win.reduce((a, q) => a + 1000 / Math.max(1, q.ms), 0) / win.length : 0;
          if (fps >= target - 8) recover = f.t - t0;
        }
      }
      // the forecast: each frame's prediction against the cost line half a second later (the median: a jump inside the
      // half second is the forecast's job, not its error)
      const errs = [];
      for (let j = 0; j < inL.length; j++) {
        const f = inL[j]; if (!Number.isFinite(f.pred)) continue;
        let g = null; for (let q = j + 1; q < inL.length; q++) if (inL[q].t >= f.t + 0.5) { g = inL[q]; break; }
        if (g && Number.isFinite(g.mean)) errs.push(Math.abs(f.pred - g.mean));
      }
      let back = null;
      for (const f of frames) if (f.t >= t1 && f.t < t2 && depth(f) <= d0) { back = f.t - t1; break; }
      loads.push({ id: p.id, kind: p.kind, ms: p.ms, first: first === null ? null : Math.round(first * 100) / 100, rungs: maxD - d0, recover: recover === null ? null : Math.round(recover * 100) / 100, pump, mae: errs.length ? Math.round(med(errs) * 100) / 100 : null, back: back === null ? null : Math.round(back * 100) / 100 });
    }
    return { target, loads };
  };
  // the result as lines (lang 'de' or 'en'); A.meta: { gpu, preset, timed }
  P.lines = function (A, lang) {
    const de = lang !== 'en', m = A.meta || {}, s = (x) => (x === null || x === undefined ? '–' : String(x));
    const out = [(de ? 'R9 /prüfstand · ' : 'R9 /testbench · ') + (m.gpu || '') + ' · ' + (m.preset || '') + (de ? ' · Ziel ' : ' · target ') + A.target + ' fps'];
    const name = { gpu: de ? 'Last GPU' : 'GPU load', cpu: de ? 'Last CPU' : 'CPU load', ramp: de ? 'Rampe GPU' : 'GPU ramp' };
    for (const L of A.loads) {
      if (L.skipped) { out.push(name[L.kind] + ': ' + (L.skipped === 'cal' ? (de ? 'ausgelassen (die Eichung konnte auf dieser Grafikkarte nichts messen)' : 'left out (the calibration measured nothing on this card)') : (de ? 'ausgelassen (dieser Browser verrät keine GPU-Zeiten)' : 'left out (this browser hides GPU times)'))); continue; }
      out.push(`${name[L.kind]} +${L.ms} ms: ` + (de
        ? `erste Stufe nach ${s(L.first)} s · ${L.rungs} Stufen · wieder flüssig nach ${s(L.recover)} s · ${L.pump}× gependelt · Vorhersage ±${s(L.mae)} ms · zurück nach ${s(L.back)} s`
        : `first step after ${s(L.first)} s · ${L.rungs} rungs · smooth again after ${s(L.recover)} s · pumped ${L.pump}× · forecast ±${s(L.mae)} ms · back after ${s(L.back)} s`));
    }
    return out;
  };

  // ---------------------------------------------------------------- the burners
  P.burnCpu = function (ms) { const t0 = now(); if (!(ms > 0)) return; while (now() - t0 < ms) { /* the load */ } };
  // the loops per pixel for a GPU load of ms, from the calibration's cost of one loop; nothing when it measured nothing
  P.loopsFor = function (ms, unit) { if (!(unit > 0) || !(ms > 0)) return 0; return Math.min(P.LOOP_CAP, Math.max(1, Math.round(ms / unit))); };
  const VS = '#version 300 es\nvoid main(){ vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }';
  const FS = '#version 300 es\nprecision highp float; uniform int u_n; out vec4 o;\nvoid main(){ vec2 q = gl_FragCoord.xy * 0.013; float a = q.x; for (int i = 0; i < 4096; i++) { if (i >= u_n) break; a = fract(sin(a * 12.9898 + q.y) * 43758.5453); } o = vec4(a, 0.0, 0.0, 1.0); }';
  function setup(gl, w, h) {
    const B = P.gl || (P.gl = {});
    if (!B.prog) {
      const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); return s; };
      const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { B.bad = true; return null; }
      B.prog = p; B.uN = gl.getUniformLocation(p, 'u_n'); B.vao = gl.createVertexArray();
    }
    if (!B.tex || B.w < w || B.h < h) {
      if (B.tex) gl.deleteTexture(B.tex); if (B.fb) gl.deleteFramebuffer(B.fb);
      const t0 = gl.getParameter(gl.TEXTURE_BINDING_2D);
      B.w = w; B.h = h; B.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, B.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.bindTexture(gl.TEXTURE_2D, t0);
      const f0 = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING);
      B.fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, B.fb); gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, B.tex, 0);
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, f0);
    }
    return B;
  }
  // the GPU load (renderer.gpuTimerEnd calls it inside the frame's timer): P.loops per pixel over the picture's own size
  P.gpuBurn = function (gl, r) {
    if (!P.gpuOn || !(P.loops > 0) || !gl || (P.gl && P.gl.bad)) return;
    const W0 = (r && r.W) || gl.drawingBufferWidth, H0 = (r && r.H) || gl.drawingBufferHeight, k = Math.max(0.25, Math.min(1, (r && r.q && r.q.scale) || 1));
    const w = Math.max(16, Math.round(W0 * k)), h = Math.max(16, Math.round(H0 * k));
    const B = setup(gl, Math.max(16, W0), Math.max(16, H0)); if (!B) return;
    const prog = gl.getParameter(gl.CURRENT_PROGRAM), dfb = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING), rfb = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING), vp = gl.getParameter(gl.VIEWPORT), vao = gl.getParameter(gl.VERTEX_ARRAY_BINDING);
    const on = [gl.SCISSOR_TEST, gl.DEPTH_TEST, gl.BLEND, gl.CULL_FACE, gl.STENCIL_TEST].map((c) => [c, gl.isEnabled(c)]), mask = gl.getParameter(gl.COLOR_WRITEMASK);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, B.fb); gl.viewport(0, 0, w, h);
    for (const [c] of on) gl.disable(c);
    gl.colorMask(true, true, true, true);
    gl.useProgram(B.prog); gl.uniform1i(B.uN, P.loops | 0); gl.bindVertexArray(B.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(vao); gl.useProgram(prog); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, dfb); gl.bindFramebuffer(gl.READ_FRAMEBUFFER, rfb); gl.viewport(vp[0], vp[1], vp[2], vp[3]);
    for (const [c, e] of on) if (e) gl.enable(c);
    gl.colorMask(mask[0], mask[1], mask[2], mask[3]);
  };

  // ---------------------------------------------------------------- the run
  let panelEl = null;
  P.panel = function (lines) {
    if (typeof document === 'undefined') return;
    if (!panelEl) { panelEl = document.createElement('div'); panelEl.id = 'r9pruef'; panelEl.style.cssText = 'position:fixed;left:8px;top:8px;z-index:9999;max-width:92vw;background:rgba(10,14,22,.88);color:#cfe6ff;font:12px/1.45 monospace;padding:8px 10px;border-radius:6px;white-space:pre-wrap;pointer-events:auto'; panelEl.onclick = () => { panelEl.remove(); panelEl = null; }; document.body.appendChild(panelEl); }
    panelEl.textContent = lines.join('\n');
  };
  P.run = function (g, args) {
    const lang = (VR.I18N && VR.I18N.lang) || 'de', de = lang !== 'en', say = (t, c) => g.ui && g.ui.chatLine(t, c || '#bfe3ff');
    if (P.run_) { P.stop(g); say(de ? 'Prüfstand angehalten.' : 'Test bench stopped.'); return; }
    if (g.state !== 'play' || (VR.Kosten && VR.Kosten.busy) || g.bench || g.sweep) { say(de ? 'Prüfstand: erst wenn nichts anderes misst und die Welt läuft.' : 'Test bench: only while the world runs and nothing else is measuring.', '#ffcf8a'); return; }
    const S = g.settings, r = g.renderer;
    const target = VR.Warp && VR.Warp.sqTarget ? VR.Warp.sqTarget(S) : 55;
    const k = args && (args[0] === 'kurz' || args[0] === 'short') ? 0.25 : 1;
    const plan = P.plan(1000 / target, k);
    const timed = !!(r && r.prof && r.prof.ext);
    P.run_ = { t0: now(), plan, frames: [], base: [], cal: [], n0: P.N0, unit: 0, timed, target, dyn: S.dynRes, lang, lastPanel: 0 };
    S.dynRes = true; P.on = true;
    const total = Math.round(plan.reduce((a, p) => a + p.s, 0));
    say(de ? `Prüfstand läuft (${total} s, bitte nicht bewegen): Lastsprünge auf GPU und CPU, die Smart Quality antwortet.` : `Test bench running (${total} s, keep still): load steps on the GPU and the CPU, Smart Quality answers.`);
    if (!timed) say(de ? 'Dieser Browser verrät keine GPU-Zeiten: geprüft wird nur der CPU-Teil.' : 'This browser hides GPU times: only the CPU part is tested.', '#ffcf8a');
  };
  P.stop = function (g) {
    const R = P.run_; P.run_ = null; P.on = false; P.gpuOn = false; P.loops = 0; P.cpuMs = 0;
    if (R && g && g.settings) g.settings.dynRes = R.dyn;
    return R;
  };
  P.frame = function (g) {
    const R = P.run_; if (!R) { P.on = false; return; }
    const t = (now() - R.t0) / 1000, L = P.loadAt(R.plan, t), r = g.renderer;
    if (L.kind === 'done') { P.finish(g); return; }
    // the CPU load, lightened by the villagers' rungs (folkDist)
    const folk = (g.folkDist || 100) / (g.folkBase || 100);
    P.cpuMs = L.cpu > 0 ? L.cpu * Math.max(0.2, Math.min(1, folk)) : 0;
    if (P.cpuMs > 0) P.burnCpu(P.cpuMs);
    // the GPU load: the calibration's loops, then the loops for the step (only with GPU times)
    const gpuMs = r && r.gpuMs;
    if (L.kind === 'eich') { P.gpuOn = R.timed; P.loops = R.timed ? R.n0 : 0; }
    else if (L.gpu > 0 && R.unit > 0) { P.gpuOn = true; P.loops = P.loopsFor(L.gpu, R.unit); }
    else { P.gpuOn = false; P.loops = 0; }
    if (L.id === 'ruhe0' && t - L.t0 > R.plan[0].s * 0.4 && Number.isFinite(gpuMs)) R.base.push(gpuMs);
    if (L.kind === 'eich' && t - L.t0 > R.plan[1].s * 0.4 && Number.isFinite(gpuMs)) R.cal.push(gpuMs);
    if (L.id === 'ruhe1' && !R.calDone) { R.calDone = true; const d = med(R.cal) - med(R.base); R.unit = d > 0.3 ? d / R.n0 : 0; R.calMs = r1(d); }
    const aq = g.aq || {}, AP = VR.AQPredict, pp = aq.pp;
    R.frames.push({ t, dt: g.frameDt, ms: Number.isFinite(gpuMs) && R.timed ? Math.max(gpuMs, g.jsMs || 0) : (g.frameDt || 0.016) * 1000, js: g.jsMs, stack: (aq.stack || []).join(''), pred: pp && AP ? AP.predict(pp) : null, mean: pp && AP ? AP.trend(pp).mean : null, k: L.kind, cpu: P.cpuMs, gpu: P.gpuOn ? L.gpu : 0 });
    if (t - R.lastPanel > 0.5) {
      R.lastPanel = t;
      const de = R.lang !== 'en', p = R.plan[L.i], left = Math.max(0, Math.round(p.s - (t - L.t0)));
      const what = { rest: de ? 'Ruhe' : 'rest', eich: de ? 'Eichung GPU' : 'GPU calibration', gpu: de ? 'Last GPU' : 'GPU load', cpu: de ? 'Last CPU' : 'CPU load', ramp: de ? 'Rampe GPU' : 'GPU ramp' }[L.kind];
      P.panel([(de ? 'R9 /prüfstand · ' : 'R9 /testbench · ') + what + ' · ' + left + ' s', (de ? 'Last ' : 'load ') + 'GPU ' + r1(P.gpuOn ? L.gpu : 0) + ' ms · CPU ' + r1(P.cpuMs) + ' ms · Smart Quality ' + ((aq.stack || []).join('') || '–') + ' · fps ' + r1(g.fps)]);
    }
  };
  P.finish = function (g) {
    const R = P.stop(g); if (!R) return null;
    const A = P.analyze(R.frames, R.plan, R.target);
    for (const L of A.loads) if (L.kind !== 'cpu' && !(R.unit > 0)) L.skipped = R.timed ? 'cal' : 'timer';
    A.meta = { gpu: (VR.GL && VR.GL.rendererName) || '', preset: (g.settings && g.settings.preset) || '', timed: R.timed, calMs: R.calMs };
    const lines = P.lines(A, R.lang);
    for (const ln of lines) g.ui && g.ui.chatLine(ln, '#bfe3ff');
    P.panel(lines);
    P.last = { analysis: A, frames: R.frames, plan: R.plan };
    if (typeof console !== 'undefined') console.log('R9 pruefstand', JSON.stringify(A));
    return A;
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
