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
      if (this.on && !this.first && I.hit('KeyK')) { if (PF.film) { PF.film.t = 1e9; PF.stepFilm(this, 0); } else { PF.startFilm(this); if (PF.film && (I.down('ShiftLeft') || I.down('ShiftRight'))) { PF.film.rec = PF.startRec(this.g); if (PF.film.rec) PM.note('🎬 ' + tx('g.pfx.rec0'), 2500); } } }
      if (this.on && PF.film) { if (I.hit('Escape')) { PF.film.t = 1e9; PF.stepFilm(this, 0); } else if (PF.stepFilm(this, dt)) { I.mouse.dx = 0; I.mouse.dy = 0; const keepS = this.s; this.s = { x: keepS.x, y: keepS.y, z: keepS.z, yaw: keepS.yaw, pitch: keepS.pitch, roll: keepS.roll, vel: [0, 0, 0] }; const r = up.apply(this, arguments); this.s = keepS; return r; } }
      if (this.on && !this.first && I.hit('KeyT')) {
        PF.cur = PF.next(PF.cur);
        PF.apply(this.g);
        PM.note('🎨 ' + tx('g.pfx.' + PF.STYLES[PF.cur]) + ' · ' + tx('g.pfx.key'), 2600);
      }
      return up.apply(this, arguments);
    };
    P.leave = function () { if (PF.film) { if (PF.film.rec) PF.stopRec(); Object.assign(this.s, PF.film.keep); PF.film = null; } if (PF.cur) { PF.cur = 0; PF.apply(this.g); } return lv.apply(this, arguments); };
  }
  // ---------------------------------------------------------------- Kinoflug (K in the Fotomodus): a short film of the place
  // Four shots of ~5 s round what is near (the eye's point on the ground ahead; ShotCraft-like grammar of our own):
  // a slow orbit · a crane up and over · a dolly in at eye height · a low hero angle turning away — each eased, the
  // time held; the Film style while it runs, the camera back where it was afterwards. Pure: PF.shot(k, t, T, base) → pose.
  PF.SHOT = 5;
  const ease = (x) => x * x * (3 - 2 * x);
  PF.shot = function (k, t, base) {
    const u = ease(Math.min(1, Math.max(0, t / PF.SHOT))), T = base.t, a0 = base.yaw;
    let x, y, z;
    if (k === 0) { const a = a0 + 0.9 * u, r = 16; x = T[0] + Math.sin(a) * r; z = T[2] + Math.cos(a) * r; y = T[1] + 7; }
    else if (k === 1) { const a = a0 + 2.2, r = 12 + 6 * u; x = T[0] + Math.sin(a) * r; z = T[2] + Math.cos(a) * r; y = T[1] + 2 + 20 * u; }
    else if (k === 2) { const a = a0 - 1.4, r = 22 - 14 * u; x = T[0] + Math.sin(a) * r; z = T[2] + Math.cos(a) * r; y = T[1] + 1.7; }
    else { const a = a0 + 3.4 + 0.5 * u, r = 7; x = T[0] + Math.sin(a) * r; z = T[2] + Math.cos(a) * r; y = T[1] + 0.6 + 1.2 * u; }
    const dx = T[0] - x, dy = (T[1] + (k === 3 ? 4 : 1.2)) - y, dz = T[2] - z;
    return { x, y, z, yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)), roll: k === 0 ? Math.sin(u * 3.1416) * 0.04 : 0 };
  };
  PF.film = null;
  PF.startFilm = function (ph) {
    const g = ph.g, s = ph.s, w = g.world; if (!s || !w) return;
    // the point: the ground 14 m ahead of the camera
    const fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw), px = s.x + fx * 14, pz = s.z + fz * 14;
    const X = Math.floor(px), Z = Math.floor(pz), py = w.isLoaded(X, Z) ? w.topAt(X, Z) + 1 : s.y - 2;
    PF.film = { t: 0, base: { t: [px, py, pz], yaw: s.yaw }, keep: { x: s.x, y: s.y, z: s.z, yaw: s.yaw, pitch: s.pitch, roll: s.roll }, style: PF.cur };
    if (PF.cur !== 3) { PF.cur = 3; PF.apply(g); }
    PM.note('🎬 ' + tx('g.pfx.film0'), 2500);
  };
  PF.stepFilm = function (ph, dt) {
    const F = PF.film; if (!F) return false;
    F.t += dt;
    const k = Math.floor(F.t / PF.SHOT);
    if (k >= 4) { if (F.rec) PF.stopRec(); Object.assign(ph.s, F.keep); if (PF.cur !== F.style) { PF.cur = F.style; PF.apply(ph.g); } PF.film = null; PM.note('🎬 ' + tx('g.pfx.film1'), 2000); return false; }
    Object.assign(ph.s, PF.shot(k, F.t - k * PF.SHOT, F.base));
    if (ph.s.vel) { ph.s.vel[0] = ph.s.vel[1] = ph.s.vel[2] = 0; }
    return true;
  };
  // ---------------------------------------------------------------- Shift+K: the Kinoflug as a video file (WebM)
  // The canvas' own stream (captureStream, 30 frames a second) into the browser's MediaRecorder — all in the browser, no
  // request leaves it. When the flight ends the clip is saved as 'R9-SI-<world>-film-<n>.webm' (or, inside the claude.ai
  // page where downloads are blocked, shown in a player with a save link).
  PF.mime = function () {
    const MR = typeof MediaRecorder !== 'undefined' ? MediaRecorder : null; if (!MR) return null;
    for (const m of ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']) { try { if (!MR.isTypeSupported || MR.isTypeSupported(m)) return m; } catch (e) { /* the next */ } }
    return null;
  };
  PF.rec = null;
  PF.startRec = function (g) {
    const cv = g && g.renderer && g.renderer.gl && g.renderer.gl.canvas, mime = PF.mime();
    if (!cv || !cv.captureStream || !mime) { PM.note('🎬 ' + tx('g.pfx.recNo'), 3500); return false; }
    try {
      // (each drawn frame copied into a 2-D canvas right after it is drawn — the WebGL canvas keeps no picture between
      // frames — and that canvas recorded at 30 frames a second; at most 1280 px wide)
      const k = Math.min(1, 1280 / cv.width), rc = document.createElement('canvas');
      rc.width = Math.round(cv.width * k) & ~1; rc.height = Math.round(cv.height * k) & ~1;
      rc.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0.01;pointer-events:none;z-index:-1';   // (in the page: a canvas outside it is never painted, its stream stays empty)
      document.body.appendChild(rc);
      PF.recCtx = rc.getContext('2d', { alpha: false, desynchronized: false }); PF.recSrc = cv;
      const st = rc.captureStream(30), mr = new MediaRecorder(st, { mimeType: mime, videoBitsPerSecond: 6e6 }), chunks = [];
      mr.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      mr.onstop = () => { PF.saveRec(g, new Blob(chunks, { type: 'video/webm' })); try { st.getTracks().forEach((t) => t.stop()); } catch (e) { /* */ } };
      mr.start(500);
      PF.rec = mr;
      return true;
    } catch (e) { PF.rec = null; PM.note('🎬 ' + tx('g.pfx.recNo'), 3500); return false; }
  };
  PF.stopRec = function () { const mr = PF.rec; PF.rec = null; const cx = PF.recCtx; PF.recCtx = null; if (cx) setTimeout(() => { try { cx.canvas.remove(); } catch (e) { /* */ } }, 1500); if (mr && mr.state !== 'inactive') { try { mr.stop(); } catch (e) { /* */ } } };
  PF.saveRec = function (g, blob) {
    if (!blob || typeof document === 'undefined') return;
    if (!blob.size) { PM.note('🎬 ' + tx('g.pfx.recNo'), 3500); return; }
    const m = (g && g.meta) || {}; m.filmN = (m.filmN | 0) + 1;
    const name = PM.fileName(m.name, m.filmN).replace(/-(\d+)\.png$/, '-film-$1.webm');
    const url = URL.createObjectURL(blob);
    let embedded = true; try { embedded = window.self !== window.top; } catch (e) { embedded = true; }
    if (!embedded) { try { const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); } catch (e) { embedded = true; } }
    if (embedded) {
      let d = document.getElementById('filmshot');
      if (!d) { d = document.createElement('div'); d.id = 'filmshot'; d.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:40;background:#141820;padding:10px;border-radius:10px;max-width:80vw;color:#f0e6d0;font:14px sans-serif;text-align:center'; (document.getElementById('app') || document.body).appendChild(d); }
      d.innerHTML = '';
      const v = document.createElement('video'); v.src = url; v.controls = true; v.autoplay = true; v.loop = true; v.style.cssText = 'max-width:76vw;max-height:60vh;display:block;margin:0 auto 8px';
      const a = document.createElement('a'); a.href = url; a.download = name; a.textContent = '⬇ ' + name; a.style.color = '#ffd27a';
      const x = document.createElement('div'); x.textContent = tx('g.pfx.recClose'); x.style.cssText = 'opacity:.7;margin-top:6px;cursor:pointer';
      x.onclick = () => { d.remove(); };
      d.appendChild(v); d.appendChild(a); d.appendChild(x);
    }
    PM.note('🎬 ' + tx('g.pfx.recSaved', { n: name, mb: (blob.size / 1048576).toFixed(1) }), 4000);
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) { /* */ } }, 300000);
  };
  PF.apply = function (g) { const r = g && g.renderer; if (r && r.P && r.buildPrograms) r.buildPrograms(); };
  if (VR.GL) { const prev = VR.GL.defineHook || null; VR.GL.defineHook = (name, defines) => { const d = prev ? prev(name, defines) : (defines || []); return PF.cur && name === 'composite' && !d.includes('PHOTOFX') ? d.concat(['PHOTOFX']) : d; }; }
  if (VR.Renderer) {
    // (the recording: each drawn frame into the 2-D canvas, and its corner pixel touched — some browsers see a canvas
    // changed by drawImage from WebGL alone as unchanged and send no frame)
    const RP = VR.Renderer.prototype, l2p0 = RP.l2Post, rd0 = RP.render;
    RP.render = function () { const r = rd0.apply(this, arguments); const cx = PF.recCtx; if (cx) { try { cx.drawImage(PF.recSrc, 0, 0, cx.canvas.width, cx.canvas.height); cx.fillStyle = (PF.recN = (PF.recN | 0) + 1) & 1 ? '#010101' : '#020202'; cx.fillRect(0, 0, 1, 1); } catch (e) { /* */ } } return r; };
    RP.l2Post = function (p, E, pass, F) {
      if (l2p0) l2p0.call(this, p, E, pass, F);
      if (pass === 'composite' && p && p.u && p.u.u_pfx) this.gl.uniform4f(p.u.u_pfx, PF.cur, (performance.now() / 1000) % 1000, 0.52, 0);
    };
  }
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
