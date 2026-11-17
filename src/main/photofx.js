// ============================================================================
// f-kino · Bildstile im Fotomodus und Musik, die man sieht (the owner, 17 Nov: a video of ten repositories for
// motion graphics — „make the coolest things in our game and UI/UX". Ideas taken, nothing copied: post-processing
// looks (tilt-shift, pixel art, film, watercolour, comic), audio-reactive motion. All our own code.)
//   Bildstile  in the Fotomodus, T cycles: Natur · Miniatur (a tilt-shift band: the world a model railway) · Pixelkunst
//              (blocks of 4 screen pixels, a five-step palette, ordered dither) · Film (grain, warmth, vignette, bars) ·
//              Aquarell (soft colour steps, darkened edges, paper) · Comic (flat colour, ink edges). One composite define
//              PHOTOFX, built only while a style is on: normal play pays nothing. The style is in the saved photo.
//   Musik sehen  the lanterns, glowing blocks and the Flausel breathe with the beat of our own score (the director's
//              beat grid, VR.Score) — a soft swell of the emissive light on each beat, stronger on the bar's first.
//              Switch ⚙ Klang „Licht im Takt" (lightBeat, on).
// Pure parts (test/photofx.js): STYLES, next, pulse.
// ============================================================================
(function (VR) {
  'use strict';
  const PF = VR.PhotoFx = VR.PhotoFx || {};
  const tx = (k, v, de, en) => (VR.I18N && VR.I18N.tx ? VR.I18N.tx(k, v, de, en) : de);
  PF.STYLES = ['nature', 'mini', 'pixel', 'film', 'aqua', 'comic'];
  PF.cur = 0;
  PF.next = (i) => (i + 1) % PF.STYLES.length;
  // the beat's swell: phase 0…1 within a beat, k the strength; the bar's first beat ×1.6 → a factor ≥ 1
  PF.pulse = (phase, first, k) => { const p = phase < 0 ? 0 : phase > 1 ? 1 : phase, e = Math.exp(-p * 6); return 1 + k * e * (first ? 1.6 : 1); };
  PF.BEAT_K = 0.18;
  if (VR.Settings && VR.Settings.add) VR.Settings.add({ key: 'lightBeat', g: 'snd', sec: 'vol', t: 'switch', lab: 'g.set.lightBeat', tip: 'g.set.lightBeat.tip', def: true });

  // ---------------------------------------------------------------- the beat of now (null: no music)
  PF.beat = function (g) {
    const A = g && g.audio, D = A && A.score, ctx = A && A.ctx, gr = D && D.grid;
    if (!gr || !ctx || !gr.B || A.muted || (g.settings && g.settings.volMusic === 0)) return null;
    const t = ctx.currentTime - gr.t0; if (t < 0 || t > (gr.t1 - gr.t0) + 0.1) return null;
    const b = t / gr.B, n = Math.floor(b);
    return { phase: b - n, first: (n % (gr.MB || 4)) === 0 };
  };
  if (VR.Env && VR.Env.prototype) {
    const up0 = VR.Env.prototype.update;
    VR.Env.prototype.update = function (dt, o) {
      const r = up0.apply(this, arguments);
      const g = VR.game, E = this.E;
      if (E && g && (!g.settings || g.settings.lightBeat !== false)) { const bt = PF.beat(g); if (bt) E.emissiveBoost *= PF.pulse(bt.phase, bt.first, PF.BEAT_K * (0.4 + 0.6 * (E.night || 0))); }
      return r;
    };
  }

  // ---------------------------------------------------------------- the styles in the Fotomodus
  const PM = VR.PhotoMode;
  if (PM && PM.Photo) {
    const P = PM.Photo.prototype, up = P.update, lv = P.leave;
    P.update = function (dt, I) {
      if (this.on && !this.first && I.hit('KeyT')) {
        PF.cur = PF.next(PF.cur);
        PF.apply(this.g);
        PM.note('🎨 ' + tx('g.pfx.' + PF.STYLES[PF.cur]) + ' · ' + tx('g.pfx.key'), 2600);
      }
      return up.apply(this, arguments);
    };
    P.leave = function () { if (PF.cur) { PF.cur = 0; PF.apply(this.g); } return lv.apply(this, arguments); };
  }
  PF.apply = function (g) { const r = g && g.renderer; if (r && r.P && r.buildPrograms) r.buildPrograms(); };
  if (VR.GL) { const prev = VR.GL.defineHook || null; VR.GL.defineHook = (name, defines) => { const d = prev ? prev(name, defines) : (defines || []); return PF.cur && name === 'composite' && !d.includes('PHOTOFX') ? d.concat(['PHOTOFX']) : d; }; }
  if (VR.Renderer) {
    const RP = VR.Renderer.prototype, l2p0 = RP.l2Post;
    RP.l2Post = function (p, E, pass, F) {
      if (l2p0) l2p0.call(this, p, E, pass, F);
      if (pass === 'composite' && p && p.u && p.u.u_pfx) this.gl.uniform4f(p.u.u_pfx, PF.cur, (performance.now() / 1000) % 1000, 0.52, 0);
    };
  }
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
