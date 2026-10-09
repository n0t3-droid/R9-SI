// ============================================================================
// 📊 Stufentest · every quality step measured in turn, on the scene the player stands in
// The ⚡ Automatik (bench.js) measures one step and picks. The Stufentest answers the other question a player with a
// weak machine asks: "where is the middle of what my PC can do without stutter?" — Very Low, Low, Balanced, High
// (Ultra · Leicht when the build has it) and Ultra are each applied with the governor off, settle for 1.2 s (uploads,
// shadow map, textures), and are measured for 3 s of wall-clock frames (the first half second dropped). The settings
// from before come back untouched. The verdict: 'smooth' is the highest step whose slow frames (p90) still make
// 50 fps — no stutter —, 'playable' the highest with a median of 30 fps. The table is kept in localStorage r9si.sweep
// (with the GPU's name and the time) and shown under the Automatik in the settings.
// game.js: sweepStart() makes one; the loop calls sweep.tick(); smartQuality waits while it runs.
// Tested in node with a fake game: test/sweep.js
// ============================================================================
(function (VR) {
  'use strict';
  const KEY = 'r9si.sweep';
  const ORDER = ['potato', 'low', 'balanced', 'high', 'ultraLite', 'ultra'];
  const SETTLE = 1200, MEASURE = 3000, SKIP = 500;
  const SMOOTH_FPS = 50, PLAYABLE_FPS = 30;
  const NAMES = { potato: 'g.set.pVeryLow', low: 'g.set.pLow', balanced: 'g.set.pBalanced', high: 'g.set.pHigh', ultraLite: 'g.set.pUltraLite', ultra: 'g.set.pUltra' };
  const T = (k, v, fb) => (VR.I18N ? VR.I18N.t(k, v, fb) : (fb !== undefined ? fb : k));
  const sane = (x) => Number.isFinite(x) && x > 0 && x <= 1000;
  class Sweep {
    constructor(game) { this.game = game; this.results = []; this.phase = 'idle'; this.plan = []; this.at = -1; this.was = null; this.t = 0; this.last = 0; this.dts = []; }
    // the steps in order, those the build has
    static plan(presets) { return ORDER.filter((p) => presets && presets[p]); }
    // the verdict from a table of { preset, fps (median), p90fps }
    static pick(results) {
      const out = { smooth: null, playable: null };
      if (!results || !results.length) return out;
      const rank = (p) => ORDER.indexOf(p);
      const sorted = results.slice().sort((a, b) => rank(a.preset) - rank(b.preset));
      for (const r of sorted) { if (r.p90fps >= SMOOTH_FPS) out.smooth = r.preset; if (r.fps >= PLAYABLE_FPS) out.playable = r.preset; }
      if (!out.smooth) out.smooth = sorted[0].preset;
      if (!out.playable) out.playable = sorted[0].preset;
      return out;
    }
    // the last record, or null
    static last() {
      try { const r = JSON.parse(localStorage.getItem(KEY) || 'null'); return r && Array.isArray(r.results) ? r : null; } catch (e) { return null; }
    }
    static name(p) { return T(NAMES[p] || 'g.set.preset', null, p); }
    // 'Sehr niedrig 80 fps · Niedrig 60 fps · … — Ruckelfrei: Niedrig. Spielbar: Hoch.'
    static text(r) {
      if (!r || !r.results || !r.results.length) return T('g.sweep.none', null, 'Nichts gemessen.');
      const steps = r.results.map((x) => Sweep.name(x.preset) + ' ' + Math.round(x.fps) + ' fps').join(' · ');
      return steps + ' — ' + T('g.sweep.verdict', { s: Sweep.name(r.smooth), p: Sweep.name(r.playable) }, 'Ruckelfrei: {s}. Spielbar: {p}.');
    }
    start() {
      const g = this.game;
      if (this.phase !== 'idle' || g.bench || g.state !== 'play' || !g.world) return false;
      const P = g.PRESETS || (VR.Game && VR.Game.PRESETS);
      this.plan = Sweep.plan(P);
      if (!this.plan.length) return false;
      this.was = JSON.parse(JSON.stringify(g.settings));
      this.results = []; this.at = -1;
      this.next();
      return true;
    }
    next() {
      const g = this.game;
      this.at++;
      if (this.at >= this.plan.length) return this.finish();
      const p = this.plan[this.at];
      g.applyPreset(p);
      g.settings.dynRes = false;   // the governor would take steps while we measure
      g.applySettings('*');
      this.phase = 'settle'; this.t = 0; this.last = 0; this.dts = [];
      if (g.ui && g.ui.sweepStep) g.ui.sweepStep(p, this.at + 1, this.plan.length);
    }
    // every frame: wall-clock time between frames (the loop's dt is clamped for the physics)
    tick() {
      if (this.phase === 'idle') return;
      const now = performance.now();
      const d = this.last ? now - this.last : 0;
      this.last = now;
      this.t += d;
      if (this.phase === 'settle') { if (this.t >= SETTLE) { this.phase = 'measure'; this.t = 0; } return; }
      if (this.t > SKIP && sane(d)) this.dts.push(d);
      if (this.t >= MEASURE) this.record();
    }
    record() {
      const B = VR.Bench, a = this.dts.filter(sane).sort((p, q) => p - q);
      const sum = B ? B.summarize(a) : { n: a.length, median: a[a.length >> 1], p90: a[Math.min(a.length - 1, Math.ceil(a.length * 0.9) - 1)] };
      this.results.push({ preset: this.plan[this.at], fps: sum.n ? 1000 / sum.median : 0, p90fps: sum.n ? 1000 / sum.p90 : 0, n: sum.n });
      this.next();
    }
    finish() {
      const g = this.game;
      this.phase = 'idle';
      // the settings from before the test, untouched
      for (const k of Object.keys(g.settings)) delete g.settings[k];
      Object.assign(g.settings, this.was);
      g.applySettings('*'); g.saveSettings();
      const v = Sweep.pick(this.results);
      const rec = { when: Date.now(), gpu: (VR.GL && VR.GL.rendererName) || '', results: this.results, smooth: v.smooth, playable: v.playable };
      try { localStorage.setItem(KEY, JSON.stringify(rec)); } catch (e) { /* the record is optional */ }
      this.result = rec;
      if (g.sweep === this) g.sweep = null;
      if (g.ui && g.ui.sweepDone) g.ui.sweepDone(rec);
      return rec;
    }
  }
  VR.Sweep = Sweep;
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
