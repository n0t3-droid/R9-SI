// ============================================================================
// GPU-Profil · where the graphics card spends the frame (EXT_disjoint_timer_query_webgl2)
// Off (the F3 overlay closed) one query spans the whole frame, as the renderer always did. On, every render pass
// gets its own query (mark('shadow') … mark('post')): the overlay then shows the time per pass, biggest first, so a
// weak machine can say which pass hurts — the shadow map, the water's mirror, the post chain, the far world.
//  - results are read back oldest first, once the GPU has them; never waited for (four frames in flight at most,
//    a fifth frame records nothing)
//  - a disjoint frame (the GPU's clock jumped: a tab switch, a power-state change) is thrown away
//  - times are smoothed (EMA 0.1, like gpuMs before); a pass that was skipped this frame counts as 0 ms, so a cached
//    shadow map shows its amortized cost; peak[] keeps the worst frame of the last 60 for the stutter hunt
//  - line() formats the overlay line; passes under 0.5 ms fold into 'rest'
//  - no extension (some browsers hide it): nothing happens, total stays undefined (the governor falls back to estimates)
// Tested in node with a fake gl: test/gpuprof.js
// ============================================================================
(function (VR) {
  'use strict';
  const EXT = 'EXT_disjoint_timer_query_webgl2';
  const IN_FLIGHT = 4, EMA = 0.1, SMALL = 0.5, PEAK_FRAMES = 60;
  class GpuProf {
    constructor(gl) {
      this.gl = gl;
      this.ext = (gl && gl.getExtension && gl.getExtension(EXT)) || null;
      this.flight = [];     // frames whose queries are still on the GPU, oldest first
      this.free = [];       // query objects to reuse
      this.cur = null;      // the frame being recorded
      this.active = null;   // the open pass { name, q }
      this.detail = false;
      this.total = undefined;   // ms, smoothed; undefined until the first result
      this.times = {};          // ms per pass, smoothed (detail only)
      this.peak = {};           // the worst frame per pass among the last PEAK_FRAMES read back
      this.peakN = 0;
      this.frames = 0;          // frames read back
    }
    // the frame starts: finished results are read, then the recording begins (detail: one query per pass)
    begin(detail) {
      if (!this.ext) return;
      this.collect();
      detail = !!detail;
      if (detail !== this.detail) { this.times = {}; this.peak = {}; this.peakN = 0; }
      this.detail = detail;
      this.cur = null;
      if (this.flight.length >= IN_FLIGHT) return;   // never stall on results
      this.cur = { passes: [], detail };
      if (!detail) this.open('frame');
    }
    // a render pass begins (detail only; otherwise the frame's single query runs on)
    mark(name) {
      if (!this.cur || !this.detail) return;
      this.open(name);
    }
    end() {
      if (!this.cur) return;
      this.close();
      if (this.cur.passes.length) this.flight.push(this.cur);
      this.cur = null;
    }
    open(name) {
      this.close();
      const gl = this.gl, q = this.free.pop() || gl.createQuery();
      gl.beginQuery(this.ext.TIME_ELAPSED_EXT, q);
      this.active = { name, q };
    }
    close() {
      if (!this.active) return;
      this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
      this.cur.passes.push(this.active);
      this.active = null;
    }
    // finished frames, oldest first; a frame is done when its last query is (queries complete in order)
    collect() {
      const gl = this.gl, ext = this.ext;
      while (this.flight.length) {
        const f = this.flight[0], last = f.passes[f.passes.length - 1];
        if (!gl.getQueryParameter(last.q, gl.QUERY_RESULT_AVAILABLE)) break;
        this.flight.shift();
        const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
        if (!disjoint) {
          const t = {}; let sum = 0, ok = true;
          for (const p of f.passes) {
            const ms = gl.getQueryParameter(p.q, gl.QUERY_RESULT) / 1e6;
            if (!(ms >= 0 && ms < 1000)) { ok = false; break; }
            t[p.name] = (t[p.name] || 0) + ms; sum += ms;
          }
          if (ok) {
            this.frames++;
            this.total = this.total === undefined ? sum : this.total + (sum - this.total) * EMA;
            if (f.detail && this.detail) {
              for (const k in this.times) if (!(k in t)) t[k] = 0;   // skipped this frame: counts as 0 ms
              for (const k in t) this.times[k] = this.times[k] === undefined ? t[k] : this.times[k] + (t[k] - this.times[k]) * EMA;
              if (this.peakN >= PEAK_FRAMES) { this.peak = {}; this.peakN = 0; }
              this.peakN++;
              for (const k in t) if (!(this.peak[k] >= t[k])) this.peak[k] = t[k];
            }
          }
        }
        for (const p of f.passes) this.free.push(p.q);
      }
    }
    // the overlay line: 'gpu 17.6 ms · opaque 6.0 · post 2.5 · … · rest 0.9' ('' without data or detail)
    line() {
      if (this.total === undefined || !this.detail) return '';
      const ks = Object.keys(this.times).sort((a, b) => this.times[b] - this.times[a]);
      let rest = 0; const parts = [];
      for (const k of ks) { const v = this.times[k]; if (v >= SMALL) parts.push(k + ' ' + v.toFixed(1)); else rest += v; }
      if (rest > 0.05) parts.push('rest ' + rest.toFixed(1));
      return 'gpu ' + this.total.toFixed(1) + ' ms' + (parts.length ? ' · ' + parts.join(' · ') : '');
    }
    // the worst frame per pass, biggest first (for the stutter hunt)
    peaks() {
      const ks = Object.keys(this.peak).sort((a, b) => this.peak[b] - this.peak[a]);
      return ks.filter((k) => this.peak[k] >= SMALL).map((k) => k + ' ' + this.peak[k].toFixed(1)).join(' · ');
    }
  }
  VR.GpuProf = GpuProf;
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
