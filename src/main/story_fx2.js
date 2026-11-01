// ============================================================================
// a-story7 · Arc 2's own pictures (plan docs/superpowers/plans/2026-11-01-a-story7.md) — drawn by VR.StoryFx.draw on
// the scene's small 2-D canvas like the film's others (story_art.js), only while a scene of chapters 13–16 plays:
//   wiege     Wiegelind, the tiny wandering moon: a pearl disc with soft craters and a kind sleeping face, a lilac halo
//             that blinks three times (her greeting: „Ich bin da"), a tail of drifting light-seeds. o.wiegeUV: where the
//             scene's sky target is in the view (story_arc2.js projects it), else upper right
//   feelers   the Flausel in the grass answering: glowing feelers along the lower edge, blinking three times in a wave
//   lullaby   the five peoples' lullabies as five ribbons in their colours, flowing together into one golden song
//   lanterns3 the Dreilichterfest: paper lanterns rising, all flaring three times together; Wiegelind small above
//   answer3   the sign: a ribbon of light from the land up to Wiegelind, three pulses up, three blinks back (its colour by
//             your way: o.style build · quest · roam)
//   descend   Wiegelind gliding down with a long seed-tail (c15.b3) · bloom: star-flowers opening over the meadow
// Very Low (o.low): fewer seeds, lanterns and flowers. Pure drawing — nothing here runs outside a scene.
// ============================================================================
(function (VR) {
  'use strict';
  const Fx = VR.StoryFx; if (!Fx || !Fx.draw || Fx._arc2) return;
  Fx._arc2 = true;
  const MY = ['wiege', 'feelers', 'lullaby', 'lanterns3', 'answer3', 'descend', 'bloom'];
  for (const k of MY) if (Fx.KINDS.indexOf(k) < 0) Fx.KINDS.push(k);
  const fr = (x) => x - Math.floor(x);
  const rnd = (i, k) => fr(Math.sin(i * 127.1 + k * 311.7) * 43758.5453);
  const ease = (u) => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };
  const glow = (c, x, y, r, col, a) => { if (!(r > 0) || !(a > 0)) return; const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(' + col + ',' + a + ')'); g.addColorStop(1, 'rgba(' + col + ',0)'); c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r); };
  // the three blinks: every 4 s, three soft flashes 0.45 s apart (1 lit … 0 resting)
  Fx.blink3 = function (t, off) { const q = fr((t + (off || 0)) / 4) * 4; for (let i = 0; i < 3; i++) { const d = q - i * 0.45; if (d >= 0 && d < 0.3) return Math.sin(d / 0.3 * Math.PI); } return 0; };
  Fx.STYLE_COL = { build: '255,200,110', quest: '130,240,190', roam: '210,190,255' };

  // Wiegelind at (x, y), radius r; tail toward (tx, ty) (a unit direction); k her presence (0…1)
  Fx.wiege = function (c, x, y, r, t, k, low, tx, ty) {
    const b = Fx.blink3(t), S = r;
    c.globalCompositeOperation = 'lighter';
    glow(c, x, y, S * (5 + 3 * b), '190,170,255', (0.22 + 0.4 * b) * k);
    glow(c, x, y, S * 2.2, '255,246,230', (0.35 + 0.3 * b) * k);
    // the seed-tail: light-seeds drifting behind her, each a dot with a tiny fluff
    const n = low ? 10 : 26;
    for (let i = 0; i < n; i++) {
      const q = fr(t * 0.05 + rnd(i, 1)), d = S * (2 + q * 14 * (0.6 + 0.6 * rnd(i, 2))), sw = Math.sin(t * 0.8 + i * 1.7) * S * 0.9 * q;
      const sx = x + tx * d - ty * sw, sy = y + ty * d + tx * sw, a = (1 - q) * 0.8 * k;
      glow(c, sx, sy, S * 0.45, '255,236,180', a * 0.6); glow(c, sx, sy, S * 0.12, '255,255,240', a);
    }
    // the disc and her face (drawn over, not added)
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = k;
    const g = c.createRadialGradient(x - S * 0.35, y - S * 0.35, S * 0.1, x, y, S);
    g.addColorStop(0, '#fffaff'); g.addColorStop(0.7, '#e4daf6'); g.addColorStop(1, '#b8a8dc');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, S, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(160,140,200,0.35)';
    for (const [cx, cy, cr] of [[0.45, -0.4, 0.16], [-0.5, 0.42, 0.13], [0.55, 0.5, 0.09]]) { c.beginPath(); c.arc(x + cx * S, y + cy * S, cr * S, 0, Math.PI * 2); c.fill(); }
    if (S > 7) {   // (her face shows when she is near enough to see one)
      c.strokeStyle = 'rgba(90,70,140,0.85)'; c.lineWidth = Math.max(1, S * 0.07); c.lineCap = 'round';
      const open = b > 0.5;   // (she opens her eyes on the blink)
      for (const s of [-1, 1]) { c.beginPath(); if (open) c.arc(x + s * S * 0.32, y - S * 0.08, S * 0.08, 0, Math.PI * 2); else c.arc(x + s * S * 0.32, y - S * 0.12, S * 0.13, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke(); }
      c.beginPath(); c.arc(x, y + S * 0.18, S * 0.22, 0.2 * Math.PI, 0.8 * Math.PI); c.stroke();
      c.fillStyle = 'rgba(255,160,200,0.45)'; for (const s of [-1, 1]) { c.beginPath(); c.arc(x + s * S * 0.55, y + S * 0.15, S * 0.12, 0, Math.PI * 2); c.fill(); }
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'lighter';
  };
  const wiegeAt = (o, w, h, fx, fy) => { const q = o && o.wiegeUV; return q && q[0] > 0.04 && q[0] < 0.96 && q[1] > 0.04 && q[1] < 0.9 ? [q[0] * w, q[1] * h] : [fx * w, fy * h]; };

  const draw0 = Fx.draw;
  Fx.draw = function (c, kind, t, u, w, h, o) {
    if (MY.indexOf(kind) < 0) return draw0.apply(this, arguments);
    o = o || {}; const low = !!o.low, S0 = Math.min(w, h);
    c.clearRect(0, 0, w, h);
    c.save(); c.globalCompositeOperation = 'lighter';
    if (kind === 'wiege') {
      const P = wiegeAt(o, w, h, 0.7, 0.2), big = o.cam === 'up' ? 0.06 + 0.012 * ease(u) : o.cam === 'window' ? 0.02 : 0.032;
      Fx.wiege(c, P[0], P[1], S0 * big, t, ease(u * 4), low, 0.8, -0.35);
    } else if (kind === 'feelers') {
      const n = low ? 8 : 18;
      for (let i = 0; i < n; i++) {
        const x = (0.04 + 0.92 * rnd(i, 3)) * w, y = h * (0.8 + 0.14 * rnd(i, 4)), b = Fx.blink3(t, -x / w * 0.5), teal = rnd(i, 5) < 0.4;
        const col = teal ? '120,240,220' : '255,220,130';
        glow(c, x, y, S0 * (0.012 + 0.03 * b), col, 0.25 + 0.6 * b); glow(c, x, y, S0 * 0.004, '255,255,240', 0.5 + 0.5 * b);
        if (!low && b > 0.6 && rnd(i, 6) < 0.5) { const q = fr(t * 0.3 + rnd(i, 7)); glow(c, x, y - q * h * 0.25, S0 * 0.004, col, 0.6 * (1 - q)); }
      }
    } else if (kind === 'lullaby') {
      // five ribbons (the peoples' colours) that braid into one golden song toward the right
      const seg = low ? 24 : 48, x0 = w * 0.02, x1 = w * 0.98;
      c.lineWidth = Math.max(1.5, S0 * 0.005); c.lineCap = 'round';
      for (let r = 0; r < 5; r++) {
        c.strokeStyle = 'rgba(' + Fx.FOLK[r] + ',0.55)'; c.beginPath();
        for (let i = 0; i <= seg; i++) {
          const s = i / seg, x = x0 + (x1 - x0) * s, spread = (1 - ease(s * 1.15)) * h * 0.22;
          const y = h * 0.5 + (r - 2) * spread * 0.5 + Math.sin(s * 9 - t * 1.4 + r * 1.3) * h * 0.03 * (1 - s * 0.6) + Math.sin(s * 3 - t * 0.5) * h * 0.04;
          if (i) c.lineTo(x, y); else c.moveTo(x, y);
        }
        c.stroke();
      }
      for (let i = 0; i < (low ? 4 : 9); i++) { const q = fr(t * 0.12 + i / 9), x = x0 + (x1 - x0) * q, y = h * 0.5 + Math.sin(q * 3 - t * 0.5) * h * 0.04; glow(c, x, y, S0 * 0.02, q > 0.75 ? '255,226,150' : Fx.FOLK[i % 5], 0.5 * Math.sin(q * Math.PI)); }
    } else if (kind === 'lanterns3') {
      const b = Fx.blink3(t, 0.7), n = low ? 9 : 24;
      for (let i = 0; i < n; i++) {
        const q = fr(t * (0.025 + 0.025 * rnd(i, 37)) + rnd(i, 38)), x = (rnd(i, 39) + 0.025 * Math.sin(t * 0.6 + i)) * w, y = h * (1.05 - q * 0.9), a = Math.sin(q * Math.PI), sz = S0 * (0.008 + 0.006 * rnd(i, 40)) * (1.3 - q * 0.6);
        glow(c, x, y, sz * (4 + 3 * b), '255,170,80', (0.25 + 0.35 * b) * a);
        c.fillStyle = 'rgba(255,214,140,' + (0.75 * a) + ')'; c.fillRect(x - sz * 0.7, y - sz, sz * 1.4, sz * 2);   // (the paper body)
        glow(c, x, y, sz * 0.9, '255,250,220', (0.6 + 0.4 * b) * a);
      }
      if (o.cam !== 'close') { const P = wiegeAt(o, w, h, 0.74, 0.16); Fx.wiege(c, P[0], P[1], S0 * 0.022, t, 1, low, 0.8, -0.3); }
    } else if (kind === 'answer3') {
      const col = Fx.STYLE_COL[o.style] || Fx.STYLE_COL.roam, P = wiegeAt(o, w, h, 0.68, 0.18), X0 = w * 0.42, Y0 = h * 0.98;
      const k = ease(u * 3);
      c.lineCap = 'round';
      for (let p = 0; p < 2; p++) {   // (a soft wide ribbon and its bright core)
        c.strokeStyle = 'rgba(' + col + ',' + ((p ? 0.6 : 0.18) * k) + ')'; c.lineWidth = Math.max(1, S0 * (p ? 0.004 : 0.02));
        c.beginPath(); c.moveTo(X0, Y0); c.quadraticCurveTo(X0 + (P[0] - X0) * 0.2, (Y0 + P[1]) * 0.45, P[0], P[1]); c.stroke();
      }
      for (let i = 0; i < 3; i++) {   // three pulses travelling up, one after another
        const q = fr(t / 4) * 4 - i * 0.45; if (q < 0 || q > 1.6) continue;
        const s = Math.min(1, q / 1.6), mx = (1 - s) * (1 - s) * X0 + 2 * (1 - s) * s * (X0 + (P[0] - X0) * 0.2) + s * s * P[0], my = (1 - s) * (1 - s) * Y0 + 2 * (1 - s) * s * ((Y0 + P[1]) * 0.45) + s * s * P[1];
        glow(c, mx, my, S0 * 0.05, col, 0.7 * k); glow(c, mx, my, S0 * 0.01, '255,255,245', k);
      }
      Fx.wiege(c, P[0], P[1], S0 * 0.035, t + 2, 1, low, 0.8, -0.35);
    } else if (kind === 'descend') {
      const s = ease(u), x = w * (0.72 - 0.2 * s), y = h * (0.16 + 0.36 * s);
      Fx.wiege(c, x, y, S0 * (0.045 + 0.03 * s), t, 1, low, 0.75, -0.6);
    } else if (kind === 'bloom') {
      const sow = o.opt === 'sow', n = low ? 10 : 28, col = sow ? '210,255,150' : '230,210,255';
      for (let i = 0; i < n; i++) {
        const at = rnd(i, 50) * 0.8, k = ease((u - at) * 5); if (k <= 0) continue;
        const x = (0.04 + 0.92 * rnd(i, 51)) * w, y = h * (0.68 + 0.28 * rnd(i, 52)), r = S0 * (0.01 + 0.014 * rnd(i, 53)) * k * (0.6 + 0.4 * (y / h));
        glow(c, x, y, r * 3.5, col, 0.35 * k);
        c.fillStyle = 'rgba(255,255,240,' + (0.75 * k) + ')'; c.beginPath();
        for (let j = 0; j < 10; j++) { const a = j / 10 * Math.PI * 2 + t * 0.2 + i, rr = j & 1 ? r * 0.4 : r; if (j) c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.6); else c.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.6); }
        c.closePath(); c.fill();
      }
      for (let i = 0; i < (low ? 6 : 16); i++) { const q = fr(t * 0.08 + rnd(i, 54)); glow(c, (rnd(i, 55) + 0.05 * Math.sin(t + i)) * w, h * (0.05 + q * 0.7), S0 * 0.005, '255,240,190', 0.7 * Math.sin(q * Math.PI)); }   // (seeds drifting down)
    }
    c.restore();
    return true;
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
