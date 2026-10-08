// ============================================================================
// Cockpit: the room you fly from. Starships carry a real cockpit in their hull
// (the generator carves it and glazes the canopy); cockpitkit.js furnishes it
// in a worker — tread plates, an instrument panel with three live screens
// (flight · navigation · systems) in bezels with soft keys, a glare shield
// with the autopilot panel, side consoles, a centre pedestal with the throttle
// quadrant, bucket seats with harnesses, padded walls, a rear bulkhead with a
// sliding door, the coaming and the canopy's slim frame — and this file draws
// it with the ship (no hull clipping, the glass nearly clear from inside) and
// makes it work. Real controls: aim the crosshair and left click — a guarded
// POWER switch, START (3 s spool-up while the panels light up), the throttle
// lever (click a spot in its slot, or hold the button and push the mouse),
// the gear lever with its three lamps, lights, ramp, autopilot, radio and a
// guarded weapons switch. Controls in reach glow and name themselves with an
// icon and one German word; backlit legends name them on the panels too.
// Block-built ships get the same console in front of their helm seat. On top:
// a heads-up display on the ship's glass (pitch ladder, heading, speed &
// altitude tapes, flight path marker, throttle, boost energy, gear) that banks
// and pitches with the ship, fades when you look away, ≤ 30 redraws a second
// at 1× pixels, no shadow blur.
// ============================================================================
(function (VR) {
  'use strict';
  const mat4 = VR.mat4, DEG = Math.PI / 180, TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // a console in front of a seat (block-built ships, the big bridges): built around x = 0, shifted onto the eye (ox)
  VR.consoleRoom = (eye) => ({ hw: 0.85, floor: eye[1] - 1.2, rim: eye[1] - 0.4, zNose: eye[2] - 1.5, zf: eye[2] - 1.45, zb: eye[2] + 0.6, seats: [[0, eye[2] + 0.14]], eye: [0, eye[1], eye[2]], top: eye[1] + 0.4, roof: null, ox: eye[0] });

  // ---------------------------------------------------------------- textured quads: the live screens & the backlit legends
  VR.SHADERS.SCREEN_VS = `
layout(location=0) in vec3 a_pos;
layout(location=1) in vec2 a_uv;
uniform mat4 u_viewProj;
uniform mat4 u_model;
out vec2 v_uv;
void main() { v_uv = a_uv; gl_Position = u_viewProj * u_model * vec4(a_pos, 1.0); }`;
  VR.SHADERS.SCREEN_FS = `
uniform sampler2D u_tex;
uniform float u_on;
in vec2 v_uv;
out vec4 o;
void main() {
  vec3 c = pow(texture(u_tex, v_uv).rgb, vec3(2.2));
  float scan = 0.9 + 0.1 * sin(v_uv.y * 1400.0);
  o = vec4(c * (1.65 * scan) * u_on + vec3(0.004, 0.006, 0.008), 1.0);
}`;
  // a legend: the glyphs only (the panel shows through), painted light grey by day, glowing when the panels are lit
  VR.SHADERS.LEGEND_FS = `
uniform sampler2D u_tex;
uniform vec3 u_col;
in vec2 v_uv;
out vec4 o;
void main() { if (texture(u_tex, v_uv).r < 0.42) discard; o = vec4(u_col, 1.0); }`;
  // quads (pos + uv) in ship metres → a VAO
  function quadVAO(gl, list) {
    const v = [];
    for (const q of list) {
      const c = q.c, r = q.r, u = q.u, hw = q.w / 2, hh = q.h / 2, [u0, v0, u1, v1] = q.uv;
      const P = (a, b) => [c[0] + r[0] * a + u[0] * b, c[1] + r[1] * a + u[1] * b, c[2] + r[2] * a + u[2] * b];
      const k = [[P(-hw, -hh), u0, v1], [P(hw, -hh), u1, v1], [P(hw, hh), u1, v0], [P(-hw, hh), u0, v0]];
      for (const i of [0, 1, 2, 0, 2, 3]) v.push(k[i][0][0], k[i][0][1], k[i][0][2], k[i][1], k[i][2]);
    }
    const vao = gl.createVertexArray(), vbo = gl.createBuffer();
    gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);
    gl.bindVertexArray(null);
    return { vao, vbo, count: v.length / 5 };
  }
  const tex2d = (gl, cv, mip) => {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    if (mip) gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };

  // ---------------------------------------------------------------- live screens: one small canvas atlas, ≈ 8 Hz
  // tiles: 0 flight · 1 navigation · 2 systems (200×128 drawn at 1.25×) · 3 autopilot panel · 4 clock · 5 radio
  const TW = 200, TH = 128, AW = 1024, AH = 256, SK = 1.25;
  const TILE = [[0, 0, 250, 160], [256, 0, 250, 160], [512, 0, 250, 160], [768, 0, 250, 48], [768, 64, 96, 96], [872, 64, 144, 48]];
  const tileUV = (n) => { const t = TILE[n] || TILE[0]; return [(t[0] + 1) / AW, (t[1] + 1) / AH, (t[0] + t[2] - 1) / AW, (t[1] + t[3] - 1) / AH]; };
  class Screens {
    constructor() { const c = this.cv = document.createElement('canvas'); c.width = AW; c.height = AH; this.x = c.getContext('2d'); this.tex = null; }
    upload(gl) {
      if (!this.x) return;
      if (!this.tex) { this.tex = tex2d(gl, this.cv, false); return; }
      gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.cv);
    }
    // the pictures from the flight; boot = 0…1 while the systems start
    paint(g, fl, boot) {
      const x = this.x; if (!x) return;
      x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#000'; x.fillRect(0, 0, AW, AH);
      if (fl.power === 'off') return;
      const I = fl.info(), b = fl.b;
      for (let n = 0; n < 3; n++) {
        const t = TILE[n];
        x.save(); x.translate(t[0], t[1]); x.beginPath(); x.rect(0, 0, t[2], t[3]); x.clip(); x.scale(SK, SK);
        const on = boot >= 1 ? 1 : clamp((boot - n * 0.18) / 0.25, 0, 1);
        if (on < 1) this.bootTile(x, n, boot, on);
        else if (n === 0) this.flightTile(x, I, b, fl);
        else if (n === 1) this.navTile(x, I, b, g, fl);
        else this.sysTile(x, I, b, fl);
        x.restore();
      }
      if (boot < 0.5) return;
      // the autopilot panel's display: heading · altitude · mode, amber segments
      {
        const t = TILE[3]; x.save(); x.translate(t[0], t[1]);
        x.fillStyle = '#0b0703'; x.fillRect(0, 0, t[2], t[3]);
        x.font = 'bold 26px monospace'; x.textBaseline = 'middle'; x.textAlign = 'left'; x.fillStyle = '#ffb347';
        const hdg = String(Math.round(I.heading) % 360).padStart(3, '0'), alt = String(Math.max(0, Math.round(I.alt))).padStart(3, '0');
        x.fillText(hdg, 8, t[3] / 2); x.fillText(alt, 96, t[3] / 2);
        x.font = 'bold 20px monospace'; x.fillStyle = I.auto ? '#9affd8' : 'rgba(255,179,71,0.35)'; x.fillText('AP', 196, t[3] / 2);
        x.restore();
      }
      // the clock (the world's time of day)
      {
        const t = TILE[4], cx = t[0] + t[2] / 2, cy = t[1] + t[3] / 2, R = t[2] / 2 - 4;
        x.fillStyle = '#05080a'; x.beginPath(); x.arc(cx, cy, R, 0, TAU); x.fill();
        x.strokeStyle = '#9ad8ff'; x.lineWidth = 2;
        for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; x.beginPath(); x.moveTo(cx + Math.sin(a) * R * 0.82, cy - Math.cos(a) * R * 0.82); x.lineTo(cx + Math.sin(a) * R * 0.95, cy - Math.cos(a) * R * 0.95); x.stroke(); }
        const tod = g.env && g.env.timeOfDay !== undefined ? g.env.timeOfDay : 6000, hrs = ((tod / 1000 + 6) % 24), mins = (hrs % 1) * 60;
        const hand = (a, L, w) => { x.lineWidth = w; x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + Math.sin(a) * L, cy - Math.cos(a) * L); x.stroke(); };
        x.strokeStyle = '#e8f6ff'; hand((hrs % 12) / 12 * TAU, R * 0.5, 4); hand(mins / 60 * TAU, R * 0.78, 2.5);
      }
      // the radio's frequency
      {
        const t = TILE[5]; x.fillStyle = '#030805'; x.fillRect(t[0], t[1], t[2], t[3]);
        if (fl.radio) { x.font = 'bold 26px monospace'; x.textBaseline = 'middle'; x.textAlign = 'center'; x.fillStyle = '#7aff8a'; x.fillText('108.5', t[0] + t[2] / 2, t[1] + t[3] / 2); }
      }
    }
    bootTile(x, n, boot, on) {
      if (on <= 0) return;
      x.fillStyle = `rgba(6,18,26,${on})`; x.fillRect(0, 0, TW, TH);
      x.fillStyle = `rgba(90,240,255,${on})`; x.font = 'bold 20px Orbitron, monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText('R9-SI', TW / 2, TH * 0.4);
      x.font = '10px Rajdhani, monospace'; x.fillText(['FLUG', 'NAVIGATION', 'SYSTEME'][n] + ' · START', TW / 2, TH * 0.58);
      x.strokeStyle = `rgba(90,240,255,${on * 0.8})`; x.strokeRect(30, TH * 0.72, TW - 60, 8);
      x.fillRect(32, TH * 0.72 + 2, (TW - 64) * clamp(boot, 0, 1), 4);
    }
    flightTile(x, I, b, fl) {
      // attitude: sky / ground, rolled and pitched with the ship
      const cx = TW / 2, cy = TH / 2 - 4, ppd = 2.2;
      x.save(); x.translate(cx, cy); x.rotate(fl.roll); x.translate(0, fl.pitch / DEG * ppd);
      x.fillStyle = '#1d5a8c'; x.fillRect(-200, -260, 400, 260);
      x.fillStyle = '#5a3a1e'; x.fillRect(-200, 0, 400, 260);
      x.strokeStyle = '#fff'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(-200, 0); x.lineTo(200, 0); x.stroke();
      x.lineWidth = 1; x.font = '8px monospace'; x.fillStyle = '#fff'; x.textAlign = 'left'; x.textBaseline = 'middle';
      for (let a = -30; a <= 30; a += 10) { if (!a) continue; const y = -a * ppd, w = a % 20 ? 10 : 18; x.beginPath(); x.moveTo(-w, y); x.lineTo(w, y); x.stroke(); x.fillText(String(Math.abs(a)), w + 3, y); }
      x.restore();
      // the ship symbol
      x.strokeStyle = '#ffd040'; x.lineWidth = 3; x.beginPath(); x.moveTo(cx - 34, cy); x.lineTo(cx - 12, cy); x.lineTo(cx - 6, cy + 6); x.moveTo(cx + 34, cy); x.lineTo(cx + 12, cy); x.lineTo(cx + 6, cy + 6); x.stroke();
      x.fillStyle = '#ffd040'; x.fillRect(cx - 2, cy - 2, 4, 4);
      // speed (left) & altitude (right) tapes
      const tape = (tx, val, step, label, warn) => {
        x.fillStyle = 'rgba(0,0,0,0.55)'; x.fillRect(tx, 6, 36, TH - 24);
        x.strokeStyle = 'rgba(255,255,255,0.7)'; x.fillStyle = 'rgba(255,255,255,0.8)'; x.font = '8px monospace'; x.textAlign = 'center';
        for (let k = Math.floor((val - 30 * step) / step) * step; k <= val + 30 * step; k += step) { const y = TH / 2 - 4 - (k - val) * (6 / step); if (y < 10 || y > TH - 22) continue; const big = Math.round(k / step) % 5 === 0; x.beginPath(); x.moveTo(tx + (big ? 26 : 30), y); x.lineTo(tx + 36, y); x.stroke(); if (big) x.fillText(String(Math.round(k)), tx + 13, y + 3); }
        x.fillStyle = '#000'; x.fillRect(tx, cy - 8, 36, 16); x.strokeStyle = warn ? '#ffb040' : '#5af4ff'; x.strokeRect(tx + 0.5, cy - 7.5, 35, 15);
        x.fillStyle = warn ? '#ffb040' : '#fff'; x.font = 'bold 10px monospace'; x.fillText(String(Math.round(val)), tx + 18, cy + 4);
        x.font = '8px monospace'; x.fillStyle = '#9ad8ff'; x.fillText(label, tx + 18, TH - 12);
      };
      tape(4, I.speed, 2, 'M/S', I.boost);
      tape(TW - 40, I.alt, 2, 'HÖHE', false);
      // radar height & vertical speed, mode line
      x.font = 'bold 9px monospace'; x.textAlign = 'center';
      if (I.agl !== null && I.agl < 60) { x.fillStyle = I.agl < 8 ? '#ffb040' : '#7affb0'; x.fillText('R ' + (I.agl < 10 ? I.agl.toFixed(1) : Math.round(I.agl)), cx, TH - 22); }
      x.fillStyle = '#9ad8ff'; x.fillText((I.vs >= 0 ? '▲ ' : '▼ ') + Math.abs(I.vs).toFixed(1), cx, TH - 10);
      const mode = I.state === 'landed' ? 'GELANDET' : I.state === 'landing' ? 'LANDUNG' : I.auto ? 'AUTOPILOT' : I.boost ? 'BOOST' : Math.abs(I.speed) < 0.5 ? 'SCHWEBEN' : '';
      if (mode) { x.fillStyle = I.boost ? '#7ad8ff' : '#9affd8'; x.fillText(mode, cx, 12); }
    }
    navTile(x, I, b, g, fl) {
      x.fillStyle = '#06161d'; x.fillRect(0, 0, TW, TH);
      const cx = TW / 2, cy = TH / 2 + 6, R0 = 50, hd = b.heading, p = b.pos, span = 64;   // the circle shows ±64 blocks
      // the ground below: the minimap's terrain snapshot, heading up
      const Mv = g.map;
      x.save(); x.beginPath(); x.arc(cx, cy, R0, 0, TAU); x.clip();
      x.fillStyle = '#0d2c38'; x.fillRect(cx - R0, cy - R0, R0 * 2, R0 * 2);
      if (Mv && Mv.snap && Mv.off) { const k = R0 / span; x.translate(cx, cy); x.rotate(hd); x.scale(k, k); x.imageSmoothingEnabled = false; x.globalAlpha = 0.9; x.drawImage(Mv.off, Mv.snap[0] - p[0], Mv.snap[1] - p[2]); x.globalAlpha = 1; }
      else {
        // no map snapshot (the minimap is off): a radar sweep over a grid
        x.strokeStyle = 'rgba(120,240,255,0.12)'; x.beginPath(); for (let a = -R0; a <= R0; a += R0 / 4) { x.moveTo(cx + a, cy - R0); x.lineTo(cx + a, cy + R0); x.moveTo(cx - R0, cy + a); x.lineTo(cx + R0, cy + a); } x.stroke();
        const sw = (fl.t * 1.6) % TAU; x.fillStyle = 'rgba(90,240,255,0.16)'; x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, R0, sw - 0.5, sw); x.closePath(); x.fill();
      }
      x.restore();
      x.strokeStyle = 'rgba(120,240,255,0.75)'; x.lineWidth = 1.5;
      x.beginPath(); x.arc(cx, cy, R0, 0, TAU); x.stroke(); x.lineWidth = 1;
      x.strokeStyle = 'rgba(120,240,255,0.35)'; x.beginPath(); x.arc(cx, cy, R0 / 2, 0, TAU); x.stroke();
      // compass rose on the rim (heading up)
      x.font = 'bold 9px monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
      for (let d = 0; d < 360; d += 30) {
        const a = d * DEG + hd, sx = cx + Math.sin(a) * (R0 + 8), sy = cy - Math.cos(a) * (R0 + 8);
        const lbl = d === 0 ? 'N' : d === 90 ? 'O' : d === 180 ? 'S' : d === 270 ? 'W' : '';
        if (lbl) { x.fillStyle = lbl === 'N' ? '#ff6a5a' : '#9ad8ff'; x.fillText(lbl, sx, sy); }
        else { x.strokeStyle = 'rgba(154,216,255,0.6)'; x.beginPath(); x.moveTo(cx + Math.sin(a) * (R0 + 2), cy - Math.cos(a) * (R0 + 2)); x.lineTo(cx + Math.sin(a) * (R0 + 5), cy - Math.cos(a) * (R0 + 5)); x.stroke(); }
      }
      // world → screen (nose up); far things sit on the rim
      const c = Math.cos(hd), s = Math.sin(hd), k = R0 / span;
      const toS = (wx, wz) => { const dx = wx - p[0], dz = wz - p[2], fx = dx * c - dz * s, fz = dx * s + dz * c, L = Math.hypot(fx, fz) * k, q = L > R0 - 3 ? (R0 - 3) / L : 1; return [cx + fx * k * q, cy + fz * k * q, L > R0 - 3]; };
      const V = g.villages && g.villages.list ? g.villages.list() : [];
      x.font = '8px monospace';
      for (const v of V) {
        const d = Math.hypot(v.x - p[0], v.z - p[2]); if (d > 2500) continue;
        const q = toS(v.x, v.z), sel = I.auto && I.auto.site.id === v.id;
        x.fillStyle = sel ? '#9affd8' : '#ffd88a';
        if (q[2]) { x.beginPath(); x.arc(q[0], q[1], 2.5, 0, TAU); x.fill(); }
        else { x.fillRect(q[0] - 2.5, q[1] - 2.5, 5, 5); x.fillText(v.name.slice(0, 10).toUpperCase(), q[0], q[1] - 7); }
      }
      // autopilot route
      if (I.auto) {
        const A = I.auto, t = A.spot || [A.site.x, 0, A.site.z], q = toS(t[0], t[2]);
        x.setLineDash([3, 3]); x.strokeStyle = '#9affd8'; x.beginPath(); x.moveTo(cx, cy); x.lineTo(q[0], q[1]); x.stroke(); x.setLineDash([]);
        const eta = Math.round(A.eta || 0);
        x.fillStyle = '#9affd8'; x.font = 'bold 9px monospace'; x.fillText('▸ ' + A.site.name.slice(0, 14).toUpperCase(), cx, 7);
        x.font = '8px monospace'; x.fillText((A.dist / 1000).toFixed(2) + ' km' + (eta > 0 ? ' · ' + Math.floor(eta / 60) + ':' + String(eta % 60).padStart(2, '0') : ''), cx, TH - 6);
      } else {
        let best = null, bd = 1e18; for (const v of V) { const d = (v.x - p[0]) ** 2 + (v.z - p[2]) ** 2; if (d < bd && d > 140 * 140) { bd = d; best = v; } }
        x.fillStyle = '#9ad8ff'; x.font = '8px monospace';
        if (best) x.fillText('⌂ ' + best.name.slice(0, 12).toUpperCase() + ' ' + (Math.sqrt(bd) / 1000).toFixed(1) + ' km', cx, TH - 6);
        x.fillText('KURS ' + String(Math.round(I.heading) % 360).padStart(3, '0'), cx, 7);
      }
      x.textAlign = 'right'; x.fillStyle = 'rgba(154,216,255,0.7)'; x.fillText(span + ' m', TW - 4, TH - 6);
      // the ship
      x.fillStyle = '#5af4ff'; x.strokeStyle = '#03222a'; x.beginPath(); x.moveTo(cx, cy - 6); x.lineTo(cx + 4, cy + 4); x.lineTo(cx, cy + 2); x.lineTo(cx - 4, cy + 4); x.closePath(); x.fill(); x.stroke();
    }
    sysTile(x, I, b, fl) {
      x.fillStyle = '#0c0a06'; x.fillRect(0, 0, TW, TH);
      x.font = 'bold 9px monospace'; x.textAlign = 'left'; x.textBaseline = 'middle';
      x.fillStyle = '#ffb05a'; x.fillText('SYSTEME', 8, 10);
      x.textAlign = 'right'; x.fillStyle = fl.power === 'running' ? '#7aff8a' : '#ffd040'; x.fillText(fl.power === 'running' ? 'BEREIT' : fl.power === 'starting' ? 'START…' : 'STROM', TW - 8, 10);
      // engines: one bar per exhaust
      const ex = Math.max(1, Math.min(6, (b.exhaust || []).length)), t = fl.t;
      x.textAlign = 'left'; x.fillStyle = '#9ad8ff'; x.font = '8px monospace'; x.fillText('ANTRIEB', 8, 26);
      for (let n = 0; n < ex; n++) {
        const v = clamp(fl.spool * (0.94 + 0.06 * Math.sin(t * 7 + n * 1.7)), 0, 1.45) / 1.45, bx = 8 + n * 12, h = 40;
        x.strokeStyle = 'rgba(154,216,255,0.5)'; x.strokeRect(bx + 0.5, 34.5, 8, h);
        x.fillStyle = v > 0.8 ? '#7ad8ff' : '#5af4a0'; x.fillRect(bx + 1, 35 + h * (1 - v), 7, h * v);
      }
      // boost energy
      x.fillStyle = '#9ad8ff'; x.fillText('BOOST', 92, 26);
      x.strokeStyle = 'rgba(154,216,255,0.5)'; x.strokeRect(92.5, 34.5, 14, 40);
      x.fillStyle = I.boost ? '#7ad8ff' : I.energy < 0.15 ? '#ff6a5a' : '#ffd040'; x.fillRect(93, 35 + 40 * (1 - I.energy), 13, 40 * I.energy);
      // gear: three lamps
      x.fillStyle = '#9ad8ff'; x.fillText('FAHRWERK', 118, 26);
      const gcol = I.gear > 0.98 ? '#3aff6a' : I.gear < 0.02 ? '#1a2a1e' : '#ff4a3a';
      for (let n = 0; n < 3; n++) { x.fillStyle = gcol; x.beginPath(); x.arc(126 + n * 22, 46, 6, 0, TAU); x.fill(); }
      x.fillStyle = '#9ad8ff'; x.fillText(I.gear > 0.98 ? 'AUSGEFAHREN' : I.gear < 0.02 ? 'EINGEFAHREN' : 'BEWEGT', 118, 62);
      // ramp, lights, weapons, radio
      x.font = '8px monospace';
      const row = (y, lbl, val, on) => { x.fillStyle = '#9ad8ff'; x.textAlign = 'left'; x.fillText(lbl, 8, y); x.textAlign = 'right'; x.fillStyle = on ? '#7aff8a' : '#6a7480'; x.fillText(val, 100, y); };
      row(90, 'RAMPE', I.ramp > 0.98 ? 'OFFEN' : I.ramp < 0.02 ? 'ZU' : Math.round(I.ramp * 100) + '%', I.ramp > 0.02);
      row(102, 'LICHT', I.lights ? 'AN' : 'AUS', I.lights);
      row(114, 'WAFFEN', fl.armed ? 'SCHARF' : 'SICHER', fl.armed);
      x.textAlign = 'left'; x.fillStyle = '#9ad8ff'; x.fillText('SCHUB', 118, 90); x.textAlign = 'right'; x.fillStyle = I.throttle < 0 ? '#ffb040' : '#fff'; x.fillText(I.throttle < 0 ? 'RÜCK' : Math.round(I.throttle * 100) + '%', TW - 8, 90);
      x.textAlign = 'left'; x.fillStyle = '#9ad8ff'; x.fillText('FUNK', 118, 102); x.textAlign = 'right'; x.fillStyle = fl.radio ? '#7aff8a' : '#6a7480'; x.fillText(fl.radio ? 'R9 FM' : 'AUS', TW - 8, 102);
    }
  }

  // ---------------------------------------------------------------- label icons (vector: no emoji fonts needed)
  function icon(x, kind, s) {
    x.save(); x.lineWidth = Math.max(1.2, s * 0.13); x.lineCap = 'round'; x.lineJoin = 'round';
    x.beginPath();
    switch (kind) {
      case 'power': x.arc(0, 0, s * 0.42, -Math.PI * 0.3, Math.PI * 1.3); x.moveTo(0, -s * 0.55); x.lineTo(0, -s * 0.05); break;
      case 'start': x.moveTo(-s * 0.3, -s * 0.42); x.lineTo(s * 0.42, 0); x.lineTo(-s * 0.3, s * 0.42); x.closePath(); break;
      case 'light': x.arc(0, -s * 0.12, s * 0.3, Math.PI * 0.8, Math.PI * 2.2); x.lineTo(s * 0.14, s * 0.3); x.lineTo(-s * 0.14, s * 0.3); x.closePath(); x.moveTo(-s * 0.12, s * 0.45); x.lineTo(s * 0.12, s * 0.45); break;
      case 'ramp': x.moveTo(-s * 0.5, s * 0.35); x.lineTo(s * 0.5, s * 0.35); x.moveTo(-s * 0.4, s * 0.35); x.lineTo(s * 0.3, -s * 0.35); x.lineTo(s * 0.45, -s * 0.35); break;
      case 'gear': x.arc(0, s * 0.12, s * 0.3, 0, TAU); x.moveTo(0, -s * 0.18); x.lineTo(0, -s * 0.55); x.moveTo(-s * 0.3, -s * 0.55); x.lineTo(s * 0.3, -s * 0.55); break;
      case 'auto': x.arc(0, 0, s * 0.45, 0, TAU); x.moveTo(0, -s * 0.45); x.lineTo(0, s * 0.45); x.moveTo(-s * 0.45, 0); x.lineTo(s * 0.45, 0); x.moveTo(s * 0.18, 0); x.arc(0, 0, s * 0.18, 0, TAU); break;
      case 'throttle': x.moveTo(-s * 0.35, s * 0.45); x.lineTo(-s * 0.35, s * 0.1); x.moveTo(0, s * 0.45); x.lineTo(0, -s * 0.15); x.moveTo(s * 0.35, s * 0.45); x.lineTo(s * 0.35, -s * 0.45); break;
      case 'weapons': x.arc(0, 0, s * 0.32, 0, TAU); x.moveTo(0, -s * 0.55); x.lineTo(0, -s * 0.15); x.moveTo(0, s * 0.15); x.lineTo(0, s * 0.55); x.moveTo(-s * 0.55, 0); x.lineTo(-s * 0.15, 0); x.moveTo(s * 0.15, 0); x.lineTo(s * 0.55, 0); break;
      case 'radio': x.moveTo(-s * 0.1, s * 0.5); x.lineTo(0, -s * 0.1); x.lineTo(s * 0.1, s * 0.5); x.moveTo(-s * 0.3, -s * 0.35); x.arc(0, -s * 0.1, s * 0.32, Math.PI * 1.15, Math.PI * 1.85); x.moveTo(-s * 0.45, -s * 0.5); x.arc(0, -s * 0.1, s * 0.52, Math.PI * 1.2, Math.PI * 1.8); break;
    }
    x.stroke(); x.restore();
  }

  // ---------------------------------------------------------------- the furnished cockpits (worker built, cached per room)
  const KITS = new Map();
  const roofHash = (C) => { let h = 0; const a = C.roof && C.roof.h; if (a) for (let i = 0; i < a.length; i++) h = (h * 31 + Math.round(a[i] * 8) + i) % 1000003; return h; };
  const kitKey = (C, pal, res, solo) => [C.hw, C.floor, C.rim, C.zf, C.zb, C.zNose, JSON.stringify(C.seats), C.eye.join(','), C.top, roofHash(C), res, pal ? pal.key : '', solo ? 1 : 0].join('|');
  function freeKit(gl, K) {
    if (!K.gpu || !gl) return;
    for (const m of [K.gpu.body, K.gpu.glow, K.gpu.scr, K.gpu.lbl, ...Object.values(K.gpu.parts || {})]) if (m) { gl.deleteBuffer(m.vbo); gl.deleteVertexArray(m.vao); }
    if (K.gpu.lblTex) gl.deleteTexture(K.gpu.lblTex);
    K.gpu = null;
  }
  // the backlit legends: every word once in a small atlas (white on black, mipmapped), a quad on the panel each
  function legendAtlas(gl, labels) {
    const words = [...new Set(labels.map(l => l.t))], RH = 32, cv = document.createElement('canvas'), x = cv.getContext && cv.getContext('2d');
    if (!x || !labels.length) return null;
    cv.width = 512; cv.height = Math.max(32, Math.pow(2, Math.ceil(Math.log2(words.length * RH))));
    x.fillStyle = '#000'; x.fillRect(0, 0, cv.width, cv.height);
    x.font = '600 24px Rajdhani, "Arial Narrow", Arial, sans-serif'; x.textBaseline = 'middle'; x.textAlign = 'left'; x.fillStyle = '#fff';
    const at = {};
    words.forEach((w, i) => { const tw = Math.min(500, x.measureText(w).width); x.fillText(w, 4, i * RH + RH / 2 + 1, 500); at[w] = { y: i * RH, w: tw + 8 }; });
    const quads = labels.map(l => { const a = at[l.t], hq = l.h * 1.5, wq = hq * a.w / RH; return { c: l.c, r: l.r, u: l.u, w: wq, h: hq, uv: [0, a.y / cv.height, a.w / cv.width, (a.y + RH) / cv.height] }; });
    return { tex: tex2d(gl, cv, true), vao: quadVAO(gl, quads) };
  }

  // ---------------------------------------------------------------- the cockpit while you fly
  const REACH = 1.55;
  class Cockpit {
    constructor(g) {
      this.g = g; this.t = 0; this.activeT = 0; this.wasActive = false; this.hudAcc = 1; this.scrAcc = 1;
      this.mP = mat4.create(); this.mVP = mat4.create(); this.mB = mat4.create(); this.mS = mat4.create(); this.mT = mat4.create();
      this.hover = null; this.near = null; this.drag = null; this.screens = new Screens(); this.scrDirty = true;
      const c = this.canvas = document.createElement('canvas');
      c.id = 'cockpitHud';
      c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:3;display:none';
      (document.getElementById('app') || document.body).appendChild(c);
      this.ctx = c.getContext('2d');
    }
    // the flight we sit in, in the cockpit view
    state() {
      const g = this.g, fl = g.flight;
      if (!fl || g.camMode !== 0 || fl.view !== 0 || g.hideHud === 'all') return null;
      const b = fl.b;
      if (b.kind === 'ship' && b.ship && b.ship.state !== 'flying') return null;
      return { fl, kind: b.kind, name: b.name || 'Ship', label: b.label || '' };
    }
    active() { return !!this.state(); }
    res() { const S = this.g.settings || {}; return S.preset === 'potato' ? 16 : 32; }
    // the furnished cockpit for a flight: asked from a worker the first time (null until it is there)
    kit(fl) {
      const g = this.g, gl = g.renderer && g.renderer.gl, b = fl && fl.b; if (!gl || !b || !b.cockpit) return null;
      const res = this.res(), key = kitKey(b.cockpit, b.palette, res, b.consoleOnly);
      let K = KITS.get(key);
      if (K) { K.used = performance.now(); return K.ready ? K : null; }
      K = { key, ready: false, failed: false, used: performance.now() };
      KITS.set(key, K);
      const msg = { type: 'cockpit', C: b.cockpit, pal: b.palette ? b.palette.key : null, res, console: !!b.consoleOnly };
      const done = (r) => {
        if (!r || r.type !== 'cockpit') { K.failed = true; console.warn('cockpit kit failed', r && r.msg); return; }
        if (KITS.get(key) !== K) return;
        try { this.upload(gl, K, r); } catch (e) { K.failed = true; console.warn('cockpit kit upload', e); }
      };
      const pool = g.pool;
      if (pool && pool.workers && pool.workers.length && pool.direct) { let wi = 0; pool.workers.forEach((w, i) => { if (w.inflight < pool.workers[wi].inflight) wi = i; }); pool.direct(wi, msg, null, done); }
      else { try { const r = VR.CockpitKit.job(msg); delete r.transfer; r.type = 'cockpit'; done(r); } catch (e) { K.failed = true; console.warn('cockpit kit', e); } }
      // keep a handful of rooms
      if (KITS.size > 6) { let old = null; for (const [k, o] of KITS) if (o !== K && (!old || o.used < old.used)) old = o; if (old) { freeKit(gl, old); KITS.delete(old.key); } }
      return null;
    }
    ready(fl) { return !!this.kit(fl); }
    upload(gl, K, r) {
      const up = (m) => (m && m.count ? VR.VoxGPU.upload(gl, m) : null);
      K.def = r; K.tris = r.tris;
      K.gpu = { body: up(r.meshes.body), glow: up(r.meshes.glow), parts: {} };
      for (const n in r.meshes.parts) K.gpu.parts[n] = up(r.meshes.parts[n]);
      K.gpu.scr = r.screens && r.screens.length ? quadVAO(gl, r.screens.map(s => Object.assign({ uv: tileUV(s.tile) }, s))) : null;
      const L = legendAtlas(gl, r.labels || []);
      if (L) { K.gpu.lbl = L.vao; K.gpu.lblTex = L.tex; }
      K.tris += (K.gpu.scr ? K.gpu.scr.count / 3 : 0) + (K.gpu.lbl ? K.gpu.lbl.count / 3 : 0);
      K.ready = true;
    }
    // ---- aiming at controls: the crosshair ray in the ship's frame against each control (within reach)
    pick(fl, K) {
      const g = this.g, r = g.renderer, cam = g.cam; if (!cam || !r || !r.camFwd) return null;
      const m = fl.R3, P = fl.b.pos, o = [cam.x - P[0], cam.y - P[1] - fl.dip, cam.z - P[2]], d = r.camFwd;
      const lo = [m[0] * o[0] + m[1] * o[1] + m[2] * o[2] - (fl.b.cockpit.ox || 0), m[4] * o[0] + m[5] * o[1] + m[6] * o[2], m[8] * o[0] + m[9] * o[1] + m[10] * o[2]];
      const ld = [m[0] * d[0] + m[1] * d[1] + m[2] * d[2], m[4] * d[0] + m[5] * d[1] + m[6] * d[2], m[8] * d[0] + m[9] * d[1] + m[10] * d[2]];
      let best = null, bt = REACH, bx = 0, pt = null; const near = [];
      for (const c of K.def.controls) {
        let t = -1, tx = 0;
        if (c.ext) {
          let t0 = -1e9, t1 = 1e9;
          for (let a = 0; a < 3; a++) {
            const lo2 = c.p[a] - c.ext[a] - lo[a], hi2 = c.p[a] + c.ext[a] - lo[a];
            if (Math.abs(ld[a]) < 1e-6) { if (lo2 > 0 || hi2 < 0) { t0 = 1; t1 = 0; break; } continue; }
            let ta = lo2 / ld[a], tb = hi2 / ld[a]; if (ta > tb) { const q = ta; ta = tb; tb = q; }
            t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
          }
          if (t0 <= t1 && t1 > 0.05) { t = Math.max(0.05, t0); tx = t1; }
        } else {
          const vx = c.p[0] - lo[0], vy = c.p[1] - lo[1], vz = c.p[2] - lo[2], tc = vx * ld[0] + vy * ld[1] + vz * ld[2];
          if (tc > 0.05) { const m2 = vx * vx + vy * vy + vz * vz - tc * tc; if (m2 <= c.r * c.r) t = tc; if (m2 < 0.2 * 0.2 && tc < REACH) near.push(c.id); }
          if (t > 0 && t < REACH && (!pt || t < pt.t)) pt = { c, t };
        }
        if (t > 0 && t < bt) { bt = t; bx = tx; best = { c, t, hit: [lo[0] + ld[0] * t, lo[1] + ld[1] * t, lo[2] + ld[2] * t] }; }
      }
      // a slider's box is a generous click zone: a switch or knob seen through it (inside its depth) wins
      if (best && best.c.ext && pt && pt.t <= bx + 0.02) best = { c: pt.c, t: pt.t, hit: [lo[0] + ld[0] * pt.t, lo[1] + ld[1] * pt.t, lo[2] + ld[2] * pt.t] };
      this.near = near;
      return best;
    }
    // called by the ship systems every frame before the flight runs: hover, clicks, dragging the throttle.
    // true = the left button belongs to a control this frame
    interact(fl, input, blocked) {
      this.hover = null; fl.onControl = false;
      const st = this.state(); if (!st || st.fl !== fl || blocked || (this.g.ui && this.g.ui.typing)) { this.drag = null; return false; }
      const K = this.kit(fl); if (!K) return false;
      // the moving parts follow the switches in game time (drawn or not)
      this.pose = this.poses(fl, K, Math.min(0.1, Math.max(0.001, fl.dt || 0.016))); this.poseFl = fl;
      // holding the throttle: the mouse pushes it (forward = more), the head stays put
      if (this.drag) {
        if (!input.mouse.down[0]) { this.drag = null; this.g.audio && this.g.audio.play('lever', { vol: 0.5 }); }
        else {
          const d = (input.mouse.dy || 0) * (input.invertY ? -1 : 1);
          if (d) fl.setThrottle(fl.throttle - d * 0.0035);
          input.mouse.dx = 0; input.mouse.dy = 0; fl.onControl = true;
          this.hover = this.drag; return true;
        }
      }
      const h = this.pick(fl, K); this.hover = h; fl.onControl = !!h;
      if (!h) return false;
      const click = input.dragLook ? input.clickAction(0) : input.mouse.clicked[0];
      if (click) this.operate(fl, h, input);
      return true;
    }
    operate(fl, h, input) {
      const c = h.c, A = fl.anim, snd = (n, o) => this.g.audio && this.g.audio.play(n, o);
      A.press = A.press || {};
      const guarded = (gk, then) => {
        if (!((A[gk] || 0) > 0.5)) { A[gk] = 1; A[gk + 'T'] = 4; snd('clunk', { vol: 0.6 }); return; }
        A[gk + 'T'] = 3; then();
      };
      switch (c.id) {
        case 'power': guarded('guard_power', () => fl.setPower(fl.power === 'off')); break;
        case 'weapons': guarded('guard_weapons', () => { fl.armed = !fl.armed; snd('switch'); if (fl.armed) snd('zap'); if (this.g.ui) this.g.ui.hint(fl.armed ? 'Weapons armed — left click fires' : 'Weapons safe', 1600); }); break;
        case 'start': A.press.btn_start = 0.2; snd('button'); fl.startEngines(); break;
        case 'auto': A.press.btn_auto = 0.2; snd('button'); if (!fl.running) fl.autoStart(); fl.toggleAuto(); break;
        case 'lights': fl.setLights(!fl.lights); break;
        case 'ramp': if (!fl.setRamp(!fl.rampOpen)) A.denyRamp = 0.45; break;
        case 'gear': if (fl.state === 'landed') { A.denyGear = 0.45; fl.toggleGear(); snd('deny'); } else { fl.toggleGear(); snd('lever'); } break;
        case 'throttle': {
          const z0 = c.slot[0], z1 = c.slot[1];
          fl.setThrottle(clamp((z1 - h.hit[2]) / (z1 - z0), -0.25, 1)); snd('lever');
          if (input && input.mouse.down[0]) this.drag = h;
          break;
        }
        case 'radio': fl.radio = !fl.radio; snd('switch'); if (fl.radio) snd('static'); break;
      }
    }
    // ---- drawing the furnished cockpit: in the scene (a starship's room) or over it (a console)
    poses(fl, K, dt) {
      const A = fl.anim, I = fl.info(), sm = (k, target, rate) => { const v = A[k] === undefined ? target : A[k]; A[k] = v + (target - v) * Math.min(1, dt * (rate || 14)); return A[k]; };
      A.press = A.press || {};
      for (const gk of ['guard_power', 'guard_weapons']) { if (A[gk + 'T'] > 0) { A[gk + 'T'] -= dt; if (A[gk + 'T'] <= 0) A[gk] = 0; } }
      for (const k in A.press) A.press[k] = Math.max(0, A.press[k] - dt);
      A.denyRamp = Math.max(0, (A.denyRamp || 0) - dt); A.denyGear = Math.max(0, (A.denyGear || 0) - dt);
      const thrC = K.def.controls.find(c => c.id === 'throttle'), slot = thrC ? thrC.slot[1] - thrC.slot[0] : 0;
      const thr = clamp(I.throttle, -0.25, 1), wig = (k) => (A[k] ? Math.sin(A[k] * 40) * 0.25 : 0), cv = 1 / K.def.pr;
      return {
        sw_power: [sm('a_power', fl.power !== 'off' ? -0.45 : 0.45), 0, 0],
        guard_power: [sm('a_gp', (A.guard_power || 0) > 0.5 ? 1.95 : 0, 10), 0, 0],
        btn_start: [0, 0, 0, 0, A.press.btn_start > 0 ? -cv : 0, 0],
        sw_lights: [sm('a_lights', fl.lights ? -0.45 : 0.45), 0, 0],
        sw_ramp: [sm('a_ramp', fl.rampOpen ? -0.45 : 0.45) + wig('denyRamp'), 0, 0],
        gear_lever: [sm('a_gear', fl.gearDown ? 0.5 : -0.5, 6) + wig('denyGear') * 0.5, 0, 0],
        btn_auto: [0, 0, 0, 0, 0, A.press.btn_auto > 0 ? -cv : 0],
        thr: [0, 0, 0, 0, 0, -sm('a_thr', thr, 10) * slot],
        sw_weapons: [sm('a_weap', fl.armed ? -0.45 : 0.45), 0, 0],
        guard_weapons: [sm('a_gw', (A.guard_weapons || 0) > 0.5 ? 1.95 : 0, 10), 0, 0],
        knob_radio: K.def.two ? [0, sm('a_radio', fl.radio ? 1.6 : 0, 8), 0] : [0, 0, sm('a_radio', fl.radio ? 1.6 : 0, 8)],
        // the cockpit door slides along the rear wall (the ship's hatch state, cabin.js)
        cdoor: [0, 0, 0, (fl.b.hatch ? fl.b.hatch.cdoor : 0) * ((K.def.door ? K.def.door.w : 0.7) + 0.04), 0, 0],
      };
    }
    // panel light level: dark when cold, flickering up while the systems start
    panel(fl) { return fl.power === 'off' ? 0.06 : fl.power === 'on' ? 0.55 : fl.power === 'starting' ? clamp(0.55 + fl.startT / 3 * 0.45 + (Math.random() - 0.5) * 0.15, 0.3, 1) : 1; }
    drawKit(r, E, fl, K, vp, overlay) {
      const g = this.g, gl = r.gl, p = r.P.vox, cam = r.cam, def = K.def, dt = Math.min(0.1, Math.max(0.001, fl.dt || 0.016));
      if (this.drawnAt === g.frame && !overlay) return; this.drawnAt = g.frame;
      gl.useProgram(p.p); r.common(p, E);
      gl.uniformMatrix4fv(p.u.u_viewProj, false, vp);
      gl.uniform1f(p.u.u_alpha, 1); gl.uniform1f(p.u.u_flash, 0); gl.uniform1f(p.u.u_noFog, 1);
      if (p.u.u_clipNear) gl.uniform1f(p.u.u_clipNear, 0);
      if (p.u.u_sunShadow) gl.uniform1f(p.u.u_sunShadow, 0.15);
      gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.disable(gl.BLEND); gl.depthMask(true);
      const P = fl.b.pos, e = fl.toWorld(fl.b.eye), ent = g.entities;
      const sky = ent ? Math.max(0.45, ent.lightAt(e[0], e[1], e[2]).sky) : 1, lv = this.panel(fl);
      const bl = fl.lights ? [0.55, 0.5, 0.42] : [0.05 * lv, 0.1 * lv, 0.13 * lv];
      gl.uniform1f(p.u.u_sky, sky); gl.uniform3f(p.u.u_blockLight, bl[0], bl[1], bl[2]);
      const B = this.mB; B.set(fl.R3); B[12] = P[0] - cam.x; B[13] = P[1] + fl.dip - cam.y; B[14] = P[2] - cam.z;
      if (fl.b.cockpit.ox) mat4.translate(B, B, fl.b.cockpit.ox, 0, 0);
      const S = this.mS, T = this.mT;
      let draws = 0;
      const tint = (a, b2, c) => gl.uniform3f(p.u.u_tint, a, b2, c);
      const mesh = (m, M) => { if (!m) return; gl.uniformMatrix4fv(p.u.u_model, false, M); gl.bindVertexArray(m.vao); gl.drawArrays(gl.TRIANGLES, 0, m.count); draws++; };
      // the room (or console) and its lights
      S.set(B); mat4.scale(S, S, 1 / def.res, 1 / def.res, 1 / def.res);
      tint(1, 1, 1); mesh(K.gpu.body, S);
      tint(lv, lv, lv); mesh(K.gpu.glow, S);
      // the controls
      const pose = this.poseFl === fl && this.pose ? this.pose : this.poses(fl, K, dt), hv = this.hover && this.hover.c, pulse = 1.55 + Math.sin(this.t * 7) * 0.25, I = fl.info();
      const glowOf = (name) => { const c = def.controls.find(q => q.part === name || q.guard === name || q.lamp === name); if (!c) return 1; if (hv && c === hv) return pulse; return this.near && this.near.indexOf(c.id) >= 0 ? 1.18 : 1; };
      const warn = fl.power !== 'off' && ((fl.state !== 'landed' && (fl.ramp > 0.02 || (I.gear < 0.98 && fl.alt !== null && fl.alt < 6 && fl.b.vel[1] < -1))) || (fl.running && fl.energy < 0.12));
      const blink = Math.sin(this.t * 9) > 0;
      for (const name in K.gpu.parts) {
        const m = K.gpu.parts[name]; if (!m) continue;
        const L = def.layout[name] || [0, 0, 0], q = pose[name];
        T.set(B); mat4.translate(T, T, L[0], L[1], L[2]);
        if (q) { if (q.length > 3) mat4.translate(T, T, q[3] || 0, q[4] || 0, q[5] || 0); if (q[1]) mat4.rotY(T, T, q[1]); if (q[0]) mat4.rotX(T, T, q[0]); if (q[2]) mat4.rotZ(T, T, q[2]); }
        mat4.scale(T, T, 1 / def.pr, 1 / def.pr, 1 / def.pr);
        // lamps: their colour tells the state
        if (name.startsWith('gear_lamp')) { if (fl.power === 'off') tint(0.05, 0.06, 0.05); else if (I.gear > 0.98) tint(0.25, 1, 0.35); else if (I.gear < 0.02) tint(0.06, 0.09, 0.07); else tint(1, 0.22, 0.12); }
        else if (name.startsWith('caution')) { if (warn && blink) tint(1, 0.55, 0.1); else tint(0.08 * lv, 0.05 * lv, 0.02); }
        else if (name === 'btn_start_lamp') { const on = fl.power === 'running' ? 1 : fl.power === 'starting' ? (Math.sin(this.t * 12) > 0 ? 1 : 0.3) : fl.power === 'on' ? (Math.sin(this.t * 4) > 0 ? 0.8 : 0.15) : 0.04; tint(0.2 * on, on, 0.4 * on); }
        else if (name === 'btn_auto_lamp') { const on = fl.auto ? 1 : fl.power === 'off' ? 0.04 : 0.12; tint(0.3 * on, 0.95 * on, on); }
        else { const k = glowOf(name); tint(k, k, k); }
        mesh(m, T);
      }
      tint(1, 1, 1);
      // the live screens
      if (K.gpu.scr && this.screens.x) {
        if (!this.sprog) this.sprog = VR.GL.program(VR.SHADERS.SCREEN_VS, VR.SHADERS.SCREEN_FS, 'screen');
        if (this.scrDirty || !this.screens.tex) { this.screens.upload(gl); this.scrDirty = false; }
        const sp = this.sprog; gl.useProgram(sp.p);
        gl.uniformMatrix4fv(sp.u.u_viewProj, false, vp); gl.uniformMatrix4fv(sp.u.u_model, false, B);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.screens.tex); gl.uniform1i(sp.u.u_tex, 0);
        gl.uniform1f(sp.u.u_on, fl.power === 'off' ? 0 : 1);
        gl.bindVertexArray(K.gpu.scr.vao); gl.drawArrays(gl.TRIANGLES, 0, K.gpu.scr.count); draws++;
      }
      // the legends: paint by day (lit like the panel), glowing with the panel lights
      if (K.gpu.lbl) {
        if (!this.lprog) this.lprog = VR.GL.program(VR.SHADERS.SCREEN_VS, VR.SHADERS.LEGEND_FS, 'legend');
        const lp = this.lprog; gl.useProgram(lp.p);
        gl.uniformMatrix4fv(lp.u.u_viewProj, false, vp); gl.uniformMatrix4fv(lp.u.u_model, false, B);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, K.gpu.lblTex); gl.uniform1i(lp.u.u_tex, 0);
        const amb = E && E.ambSky ? (E.ambSky[0] + E.ambSky[1] + E.ambSky[2]) / 3 : 0.5, day = clamp(amb * sky * sky * 1.6, 0.02, 0.5);
        const gw = fl.power === 'off' ? 0 : lv * 0.55;
        gl.uniform3f(lp.u.u_col, day * 0.62 + gw * 0.75, day * 0.66 + gw * 0.92, day * 0.7 + gw * 1.1);
        gl.bindVertexArray(K.gpu.lbl.vao); gl.drawArrays(gl.TRIANGLES, 0, K.gpu.lbl.count); draws++;
      }
      gl.bindVertexArray(null);
      r.stats.draws += draws; r.stats.tris += K.tris;
      this.lastDraws = draws; this.lastTris = K.tris;
    }
    // walking aboard: that ship's furnished cockpit (you see it through its door) — the panels as they are, no controls
    drawRoomOf(r, E, fl) {
      if (!fl || this.state()) return;
      const K = this.kit(fl); if (!K) return;
      this.hover = null; this.near = null;
      this.drawKit(r, E, fl, K, r.viewProj, false);
    }
    // ---- the shuttle's furnished cabin & cargo bay (cabinkit.js, from a worker; per design)
    cabinKit(s) {
      const g = this.g, gl = g.renderer && g.renderer.gl, d = s && s.d, C = d && d.meta && d.meta.cabin; if (!gl || !C || !d.walk) return null;
      const res = this.res(), key = 'cabin|' + d.key + '|' + res;
      let K = KITS.get(key);
      if (K) { K.used = performance.now(); return K.ready ? K : null; }
      K = { key, ready: false, failed: false, used: performance.now() };
      KITS.set(key, K);
      const msg = { type: 'cabin', cabin: C, walk: { res: d.walk.res, origin: d.walk.origin, dims: d.walk.dims, bits: d.walk.bits, hull: d.walk.hull }, pal: d.meta.palette || null, res };
      const done = (m) => { if (!m || m.type !== 'cabin') { K.failed = true; console.warn('cabin kit failed', m && m.msg); return; } if (KITS.get(key) !== K) return; try { this.upload(gl, K, m); } catch (e) { K.failed = true; console.warn('cabin kit upload', e); } };
      const pool = g.pool;
      if (pool && pool.workers && pool.workers.length && pool.direct) { let wi = 0; pool.workers.forEach((w, i) => { if (w.inflight < pool.workers[wi].inflight) wi = i; }); pool.direct(wi, msg, null, done); }
      else { try { const m = VR.CabinKit.job(msg); delete m.transfer; m.type = 'cabin'; done(m); } catch (e) { K.failed = true; console.warn('cabin kit', e); } }
      if (KITS.size > 6) { let old = null; for (const [k, o] of KITS) if (o !== K && (!old || o.used < old.used)) old = o; if (old) { freeKit(gl, old); KITS.delete(old.key); } }
      return null;
    }
    cabinReady(s) { return !!this.cabinKit(s); }
    // drawn with the ship's own lamps: dim ambient, warm light, the lamps glowing; the holo map turns
    drawCabin(r, E, s) {
      const K = this.cabinKit(s); if (!K) return;
      const g = this.g, gl = r.gl, p = r.P.vox, cam = r.cam, def = K.def, H = s.hatch || {}, mgr = g.starships;
      gl.useProgram(p.p); r.common(p, E);
      gl.uniformMatrix4fv(p.u.u_viewProj, false, r.viewProj);
      gl.uniform1f(p.u.u_alpha, 1); gl.uniform1f(p.u.u_flash, 0); gl.uniform1f(p.u.u_noFog, 0);
      if (p.u.u_clipNear) gl.uniform1f(p.u.u_clipNear, 0);
      if (p.u.u_sunShadow) gl.uniform1f(p.u.u_sunShadow, 0.6);
      gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.disable(gl.BLEND); gl.depthMask(true);
      gl.uniform1f(p.u.u_sky, 0.4 + 0.25 * (H.ramp || 0)); gl.uniform3f(p.u.u_blockLight, 0.62, 0.58, 0.52);
      const B = this.mB; B.set(s.rot || (mgr && mgr.rotOf(s))); B[12] = s.pos[0] - cam.x; B[13] = s.pos[1] + (s.dip || 0) - (s.kneel || 0) - cam.y; B[14] = s.pos[2] - cam.z;
      const S = this.mS, T = this.mT;
      const mesh = (m, M) => { if (!m) return; gl.uniformMatrix4fv(p.u.u_model, false, M); gl.bindVertexArray(m.vao); gl.drawArrays(gl.TRIANGLES, 0, m.count); };
      S.set(B); mat4.scale(S, S, 1 / def.res, 1 / def.res, 1 / def.res);
      gl.uniform3f(p.u.u_tint, 1, 1, 1); mesh(K.gpu.body, S);
      mesh(K.gpu.glow, S);
      for (const name in K.gpu.parts) {
        if (name === 'holo' && s.holo === false) continue;
        const L = def.layout[name] || [0, 0, 0];
        T.set(B); mat4.translate(T, T, L[0], L[1], L[2]);
        if (name === 'holo') { mat4.rotY(T, T, this.t * 0.6); gl.uniform3f(p.u.u_tint, 0.75 + 0.25 * Math.sin(this.t * 3.1), 0.9, 1); }
        mat4.scale(T, T, 1 / def.pr, 1 / def.pr, 1 / def.pr);
        mesh(K.gpu.parts[name], T);
        gl.uniform3f(p.u.u_tint, 1, 1, 1);
      }
      if (K.gpu.lbl) {
        if (!this.lprog) this.lprog = VR.GL.program(VR.SHADERS.SCREEN_VS, VR.SHADERS.LEGEND_FS, 'legend');
        const lp = this.lprog; gl.useProgram(lp.p);
        gl.uniformMatrix4fv(lp.u.u_viewProj, false, r.viewProj); gl.uniformMatrix4fv(lp.u.u_model, false, B);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, K.gpu.lblTex); gl.uniform1i(lp.u.u_tex, 0);
        gl.uniform3f(lp.u.u_col, 0.75, 0.86, 0.95);
        gl.bindVertexArray(K.gpu.lbl.vao); gl.drawArrays(gl.TRIANGLES, 0, K.gpu.lbl.count);
      }
      gl.bindVertexArray(null);
      r.stats.draws += 3 + Object.keys(K.gpu.parts).length; r.stats.tris += K.tris;
      this.lastCabinTris = K.tris;
    }
    // a starship's furnished cockpit, drawn with the scene (starships.draw, opaque)
    drawRoom(r, E, fl) {
      const st = this.state(); if (!st || st.fl !== fl) return;
      const K = this.kit(fl); if (!K) return;
      this.drawKit(r, E, fl, K, r.viewProj, false);
    }
    // a console in front of the helm seat (block ships, bridges): over the scene with its own depth range
    draw(r, E, cam) {
      const st = this.state(); if (!st) return;
      const fl = st.fl; if (!fl.b.consoleOnly) return;
      const K = this.kit(fl); if (!K) return;
      const proj = mat4.perspective(this.mP, cam.fov || 72 * DEG, r.W / r.H, 0.02, 10);
      this.drawKit(r, E, fl, K, mat4.mul(this.mVP, proj, r.view), true);
    }
    // 2D: the heads-up display — ≤ 30 redraws a second, 1 canvas pixel per CSS pixel, no blur
    updateHud(dt, off) {
      this.t += dt;
      const st = off ? null : this.state(), c = this.canvas;
      // in the cockpit the regular HUD (hotbar, hearts, crosshair) steps aside for the instruments
      const on = !!st && !this.g.hideHud;
      if (on !== this.wasActive) { this.wasActive = on; this.activeT = 0; this.hudAcc = 1; const hud = document.getElementById('hud'); if (hud) hud.classList.toggle('cockpit', on); }
      if (on) this.activeT += dt;
      // the cockpit screens: repainted ≈ 8 times a second (uploaded when the cockpit is drawn)
      if (st && st.fl.b.cockpit) { this.scrAcc += dt; if (this.scrAcc > 0.12) { this.scrAcc = 0; const fl = st.fl; this.screens.paint(this.g, fl, fl.power === 'starting' ? fl.startT / 3 : fl.power === 'on' ? 0 : 1); this.scrDirty = true; } }
      if (!on) { if (c.style.display !== 'none') c.style.display = 'none'; return; }
      if (c.style.display !== 'block') c.style.display = 'block';
      this.hudAcc += dt;
      if (this.hudAcc < 1 / 31) return;
      this.hudAcc = 0;
      const W = c.clientWidth | 0, H = c.clientHeight | 0;
      if (!W || !H) return;
      if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
      this.drawHud(st, W, H);
      this.hudDraws = (this.hudDraws || 0) + 1;
    }
    drawHud(st, W, H) {
      const x = this.ctx, g = this.g, r = g.renderer, fl = st.fl, b = fl.b, I = fl.info();
      x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, W, H);
      const VP = r && r.viewProj; if (!VP) return;
      this.drawAim(x, W, H, fl);
      x.setTransform(1, 0, 0, 1, 0, 0);
      // the HUD projector needs power (it flickers on while the systems start)
      if (fl.power === 'off' || fl.power === 'on' || (fl.power === 'starting' && Math.random() < 0.4 - fl.startT * 0.12)) return;
      // a direction from the eye → screen pixels (the view matrix has no translation)
      const P = (d) => { const X = VP[0] * d[0] + VP[4] * d[1] + VP[8] * d[2], Y = VP[1] * d[0] + VP[5] * d[1] + VP[9] * d[2], Wc = VP[3] * d[0] + VP[7] * d[1] + VP[11] * d[2]; if (Wc <= 1e-3) return null; return [(X / Wc * 0.5 + 0.5) * W, (0.5 - Y / Wc * 0.5) * H]; };
      const fwd = fl.dirWorld([0, 0, -1]), up = fl.dirWorld([0, 1, 0]), rt = fl.dirWorld([1, 0, 0]);
      // drawn on the ship's combiner glass: it fades as the head turns away from the nose
      const cf = r.camFwd || [0, 0, -1], ang = Math.acos(clamp(fwd[0] * cf[0] + fwd[1] * cf[1] + fwd[2] * cf[2], -1, 1)) / DEG;
      const fade = clamp(1 - (ang - 16) / 16, 0, 1);
      if (fade < 0.02) return;
      const c = P(fwd); if (!c) return;
      const t1 = Math.tan(DEG), pr = P([fwd[0] + rt[0] * t1, fwd[1] + rt[1] * t1, fwd[2] + rt[2] * t1]), pu = P([fwd[0] + up[0] * t1, fwd[1] + up[1] * t1, fwd[2] + up[2] * t1]);
      if (!pr || !pu) return;
      const ux = [pr[0] - c[0], pr[1] - c[1]], uy = [pu[0] - c[0], pu[1] - c[1]], ppd = Math.hypot(ux[0], ux[1]) || 1;
      const S = H / 720, A = fade;
      const col = `rgba(125,252,255,${0.92 * A})`, dim = `rgba(125,252,255,${0.45 * A})`, warm = `rgba(255,190,90,${0.95 * A})`, mint = `rgba(154,255,216,${0.95 * A})`;
      x.lineWidth = Math.max(1, 1.5 * S); x.lineCap = 'round';
      x.font = `${Math.round(12 * S)}px Orbitron, Rajdhani, monospace`; x.textAlign = 'center'; x.textBaseline = 'middle';
      // ---- pitch ladder & horizon: the world's horizon around the ship's heading (projected, so it banks and pitches)
      const hd = b.heading, hr = [Math.cos(hd), 0, -Math.sin(hd)], R0 = 210 * S;
      x.save(); x.beginPath(); x.arc(c[0], c[1], R0, 0, Math.PI * 2); x.clip();
      for (let a = -60; a <= 60; a += 10) {
        const e = a * DEG, ce = Math.cos(e), se = Math.sin(e), d0 = [-Math.sin(hd) * ce, se, -Math.cos(hd) * ce];
        const gap = Math.tan(3.2 * DEG), len = Math.tan((a ? 9 : 26) * DEG);
        const L0 = P([d0[0] - hr[0] * (gap + len), d0[1], d0[2] - hr[2] * (gap + len)]), L1 = P([d0[0] - hr[0] * gap, d0[1], d0[2] - hr[2] * gap]);
        const R1 = P([d0[0] + hr[0] * gap, d0[1], d0[2] + hr[2] * gap]), R2 = P([d0[0] + hr[0] * (gap + len), d0[1], d0[2] + hr[2] * (gap + len)]);
        if (!L0 || !L1 || !R1 || !R2) continue;
        x.strokeStyle = a === 0 ? col : dim; x.setLineDash(a < 0 ? [6 * S, 5 * S] : []);
        x.beginPath(); x.moveTo(L0[0], L0[1]); x.lineTo(L1[0], L1[1]); x.moveTo(R1[0], R1[1]); x.lineTo(R2[0], R2[1]); x.stroke();
        if (a) { x.fillStyle = dim; x.fillText(String(Math.abs(a)), L0[0] - 14 * S, L0[1]); x.fillText(String(Math.abs(a)), R2[0] + 14 * S, R2[1]); }
      }
      x.setLineDash([]);
      // flight path marker: where the ship is really going
      const v = b.vel, sp = I.speed;
      if (sp > 2.5) {
        const q = P([v[0] / sp, v[1] / sp, v[2] / sp]);
        if (q) { x.strokeStyle = col; x.beginPath(); x.arc(q[0], q[1], 6 * S, 0, Math.PI * 2); x.moveTo(q[0] - 15 * S, q[1]); x.lineTo(q[0] - 6 * S, q[1]); x.moveTo(q[0] + 6 * S, q[1]); x.lineTo(q[0] + 15 * S, q[1]); x.moveTo(q[0], q[1] - 6 * S); x.lineTo(q[0], q[1] - 12 * S); x.stroke(); }
      }
      x.restore();
      // ---- everything else sits on the glass: the ship's frame (right / down in pixels at the nose)
      x.setTransform(ux[0] / ppd, ux[1] / ppd, -uy[0] / ppd, -uy[1] / ppd, c[0], c[1]);
      x.strokeStyle = col; x.fillStyle = col;
      // boresight (waterline)
      x.beginPath(); x.moveTo(-26 * S, 0); x.lineTo(-11 * S, 0); x.lineTo(-6 * S, 6 * S); x.lineTo(0, 0); x.lineTo(6 * S, 6 * S); x.lineTo(11 * S, 0); x.lineTo(26 * S, 0); x.stroke();
      // heading tape
      const hdg = I.heading, ty = -235 * S, span = 60, tw = 330 * S;
      x.strokeStyle = dim; x.beginPath(); x.moveTo(-tw / 2, ty + 12 * S); x.lineTo(tw / 2, ty + 12 * S); x.stroke();
      for (let d = Math.ceil((hdg - span / 2) / 5) * 5; d <= hdg + span / 2; d += 5) {
        const xx = (d - hdg) / span * tw, big = d % 30 === 0;
        x.beginPath(); x.moveTo(xx, ty + 12 * S); x.lineTo(xx, ty + (big ? 2 : 7) * S); x.stroke();
        if (d % 10 === 0) { const n = ((d % 360) + 360) % 360; x.fillStyle = big ? col : dim; x.fillText(n === 0 ? 'N' : n === 90 ? 'E' : n === 180 ? 'S' : n === 270 ? 'W' : String(n / 10).padStart(2, '0'), xx, ty - 6 * S); }
      }
      x.fillStyle = col; x.strokeStyle = col;
      x.strokeRect(-24 * S, ty + 16 * S, 48 * S, 18 * S); x.fillText(String(Math.round(hdg) % 360).padStart(3, '0'), 0, ty + 25 * S);
      // speed (left) & altitude (right) with tapes
      const tape = (cx, val, step, label, right) => {
        x.strokeStyle = dim; x.fillStyle = dim;
        const pxPer = 5 * S / step * 2, top = -110 * S, bot = 110 * S;
        x.beginPath(); x.moveTo(cx, top); x.lineTo(cx, bot); x.stroke();
        for (let k = Math.ceil((val - 22 * step) / step) * step; k <= val + 22 * step; k += step) {
          const yy = (val - k) * pxPer; if (yy < top || yy > bot) continue;
          const big = Math.round(k / step) % 5 === 0;
          x.beginPath(); x.moveTo(cx, yy); x.lineTo(cx + (right ? 1 : -1) * (big ? 9 : 5) * S, yy); x.stroke();
          if (big && Math.abs(yy) > 16 * S) x.fillText(String(Math.round(k)), cx + (right ? 1 : -1) * 24 * S, yy);
        }
        x.fillStyle = col; x.strokeStyle = col;
        const bx = cx + (right ? 1 : -1) * 30 * S;
        x.clearRect(bx - 30 * S, -12 * S, 60 * S, 24 * S); x.strokeRect(bx - 30 * S, -12 * S, 60 * S, 24 * S); x.fillText(String(Math.round(val)), bx, 0);
        x.fillStyle = dim; x.fillText(label, bx, -24 * S); x.fillStyle = col;
      };
      tape(-235 * S, sp, 2, 'm/s', false);
      tape(235 * S, I.alt, 2, 'ALT', true);
      // height above ground & vertical speed under the altitude
      x.textAlign = 'left';
      if (I.agl !== null && I.agl < 200) { x.fillStyle = I.agl < 8 ? warm : col; x.fillText('R ' + (I.agl < 10 ? I.agl.toFixed(1) : Math.round(I.agl)), 237 * S, 32 * S); }
      x.fillStyle = dim; x.fillText('VS ' + (I.vs >= 0 ? '+' : '') + I.vs.toFixed(1), 237 * S, 50 * S);
      // throttle lever (with the reverse range) and the boost energy bar
      const thx = -330 * S, th0 = 70 * S, th1 = -70 * S, thr = I.throttle;
      x.strokeStyle = dim; x.strokeRect(thx - 5 * S, th1, 10 * S, th0 - th1 + 18 * S);
      x.fillStyle = thr < 0 ? warm : (I.boost ? `rgba(120,200,255,${A})` : col);
      if (thr >= 0) x.fillRect(thx - 3 * S, th0 - thr * (th0 - th1), 6 * S, thr * (th0 - th1)); else x.fillRect(thx - 3 * S, th0, 6 * S, -thr / 0.25 * 16 * S);
      x.strokeStyle = col; x.beginPath(); x.moveTo(thx - 9 * S, th0); x.lineTo(thx + 9 * S, th0); x.stroke();
      const ex = thx - 18 * S; x.strokeStyle = dim; x.strokeRect(ex - 3 * S, th1, 6 * S, th0 - th1);
      x.fillStyle = I.boost ? `rgba(120,200,255,${A})` : I.energy < 0.15 ? warm : dim; x.fillRect(ex - 2 * S, th0 - I.energy * (th0 - th1), 4 * S, I.energy * (th0 - th1));
      x.textAlign = 'center'; x.fillStyle = dim;
      x.fillText(thr < 0 ? 'REV' : Math.round(thr * 100) + '%', thx, th0 + 30 * S);
      if (I.boost) { x.fillStyle = `rgba(120,200,255,${A})`; x.fillText('BOOST', 0, 70 * S); }
      // systems line: gear, lights, ramp, state
      const lamp = (on, txt) => (on ? txt : '');
      const sys = [I.gear > 0.98 ? 'GEAR ▼' : I.gear < 0.02 ? 'GEAR ▲' : 'GEAR ◆', lamp(I.lights, 'LIGHTS'), lamp(I.ramp > 0.02, 'RAMP'), I.state === 'landed' ? 'LANDED' : I.state === 'landing' ? 'LANDING' : ''].filter(Boolean).join('   ');
      x.fillStyle = I.state === 'landing' || (I.gear > 0.02 && I.gear < 0.98) ? warm : dim; x.fillText(sys, 0, 150 * S);
      x.fillStyle = dim; x.fillText(st.name.toUpperCase(), 0, 170 * S);
      // navigation: autopilot or the nearest village, a marker on the canopy
      const SS = g.villages, ap = I.auto, pos = b.pos;
      let dest = null, line = null;
      if (ap) { const t = ap.spot || [ap.site.x, ap.site.y + 1, ap.site.z]; dest = [t[0], t[1] + 3, t[2]]; const eta = Math.round(ap.eta || 0); line = `AUTOPILOT ▸ ${ap.site.name.toUpperCase()} · ${(ap.dist / 1000).toFixed(2)} km` + (eta > 0 ? ` · ETA ${Math.floor(eta / 60)}:${String(eta % 60).padStart(2, '0')}` : ''); }
      else if (SS && SS.list) {
        let best = null, bd = 1e18;
        for (const vv of SS.list()) { const d = (vv.x - pos[0]) ** 2 + (vv.z - pos[2]) ** 2; if (d > 140 * 140 && d < bd) { bd = d; best = vv; } }
        if (best) { dest = [best.x, best.y + 8, best.z]; line = `⌂ ${best.name.toUpperCase()} ${(Math.sqrt(bd) / 1000).toFixed(1)} km · G AUTOPILOT`; }
      }
      if (line) { x.fillStyle = ap ? mint : dim; x.fillText(line, 0, ty + 52 * S); }
      x.setTransform(1, 0, 0, 1, 0, 0);
      const cam = g.cam;
      if (dest && cam && cam.x !== undefined) {
        const q = P([dest[0] - cam.x, dest[1] - cam.y, dest[2] - cam.z]);
        x.strokeStyle = ap ? mint : col;
        const inView = q && q[0] > W * 0.04 && q[0] < W * 0.96 && q[1] > H * 0.06 && q[1] < H * 0.94;
        if (inView) {
          const d = 9 * S;
          x.beginPath(); x.moveTo(q[0], q[1] - d); x.lineTo(q[0] + d, q[1]); x.lineTo(q[0], q[1] + d); x.lineTo(q[0] - d, q[1]); x.closePath(); x.stroke();
          x.beginPath(); x.moveTo(q[0], q[1] - d * 2.2); x.lineTo(q[0], q[1] - d * 1.3); x.stroke();
        } else {
          // off the canopy: an arrow on the HUD rim points the way (relative to the nose)
          const dd = [dest[0] - pos[0], dest[1] - pos[1], dest[2] - pos[2]];
          const lr = dd[0] * rt[0] + dd[1] * rt[1] + dd[2] * rt[2], lu = dd[0] * up[0] + dd[1] * up[1] + dd[2] * up[2];
          const a = Math.atan2(lu, lr), sx = Math.cos(a), sy = -Math.sin(a);
          const qx = c[0] + (ux[0] * sx - uy[0] * sy) / ppd * 190 * S, qy = c[1] + (ux[1] * sx - uy[1] * sy) / ppd * 190 * S, d = 10 * S, ra = Math.atan2(qy - c[1], qx - c[0]);
          x.save(); x.translate(qx, qy); x.rotate(ra);
          x.beginPath(); x.moveTo(d, 0); x.lineTo(-d * 0.7, -d * 0.7); x.lineTo(-d * 0.3, 0); x.lineTo(-d * 0.7, d * 0.7); x.closePath(); x.stroke();
          x.restore();
        }
      }
    }
    // the aim point (the crosshair steps aside in the cockpit) and the control under it: icon + one German word
    drawAim(x, W, H, fl) {
      const S = H / 720, cx = W / 2, cy = H / 2, h = this.hover;
      x.save();
      x.strokeStyle = h ? 'rgba(255,214,120,0.95)' : 'rgba(220,240,255,0.55)'; x.lineWidth = Math.max(1, 1.5 * S);
      x.beginPath(); x.arc(cx, cy, (h ? 7 : 2.5) * S, 0, TAU); x.stroke();
      if (h) {
        const c = h.c, closed = c.guard && !((fl.anim[c.guard] || 0) > 0.5), label = c.label + (closed ? ' ▸' : '');
        x.font = '600 ' + Math.round(15 * S) + 'px Rajdhani, Orbitron, sans-serif'; x.textBaseline = 'middle'; x.textAlign = 'left';
        const tw = x.measureText(label).width, bx = cx + 16 * S, by = cy + 14 * S, bw = tw + 38 * S, bh = 24 * S;
        x.fillStyle = 'rgba(8,16,24,0.72)'; x.beginPath(); if (x.roundRect) x.roundRect(bx, by - bh / 2, bw, bh, 6 * S); else x.rect(bx, by - bh / 2, bw, bh); x.fill();
        x.strokeStyle = 'rgba(255,214,120,0.95)'; x.fillStyle = 'rgba(255,214,120,0.95)';
        x.save(); x.translate(bx + 14 * S, by); icon(x, c.icon, 14 * S); x.restore();
        x.fillStyle = '#fff'; x.fillText(label, bx + 28 * S, by + 1 * S);
      }
      x.restore();
    }
  }
  VR.Cockpit = Cockpit;
})(VR);
