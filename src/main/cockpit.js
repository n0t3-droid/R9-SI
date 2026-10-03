// ============================================================================
// Cockpit: when you fly a starship or shuttle in first person you sit behind a
// jet-style instrument panel (radar / nav / systems screens, glare shield,
// throttle and flight stick that move with the flight model, slim canopy frame
// that keeps the view wide open) — fixed to the ship while your head looks
// around — and a heads-up display on the ship's glass (pitch ladder, heading
// tape, speed & altitude tapes, flight path marker, throttle, boost energy,
// gear) that banks and pitches with the ship and fades when you look away.
// The ship's own hull right around your head is clipped away.
// ============================================================================
(function (VR) {
  'use strict';
  const mat4 = VR.mat4, TAU = Math.PI * 2;
  const H = (x, y, z, s) => VR.M.hash3(x, y, z, s) / 4294967296;
  const mul = (c, k) => { const r = Math.min(255, ((c >> 16) & 255) * k) | 0, g = Math.min(255, ((c >> 8) & 255) * k) | 0, b = Math.min(255, (c & 255) * k) | 0; return (r << 16) | (g << 8) | b; };

  // ---------------------------------------------------------------- the cockpit model (camera space, 1 voxel = 1/40 block)
  VR.VOXMODELS.cockpit = () => {
    const G = VR.VoxGrid;
    // dash: x -76..76, y -50..-12, z -76..-40 (1 voxel = 1/64 block ≈ 1.6 cm)
    const dash = new G(153, 39, 37, 76, 50, 76);
    const S = (x, y, z, c, e) => dash.set(x + 76, y + 50, z + 76, c, e);
    const metal = (x, y, z) => mul(0x2A2E36, 0.9 + H(x >> 1, y >> 1, z, 3) * 0.14);
    // instrument panel, tilted toward the pilot; wings curve back toward the side consoles
    const face = (x, y) => Math.round(-66 + (-(y + 18)) * 0.55 + Math.max(0, Math.abs(x) - 44) * 0.55);
    for (let y = -50; y <= -18; y++) for (let x = -74; x <= 74; x++) { const zf = face(x, y); for (let z = zf - 3; z <= zf; z++) if (z >= -76 && z <= -40) S(x, y, z, metal); }
    // glare shield hood with a glowing lip
    for (let x = -46; x <= 46; x++) { const hump = Math.round(3 - (x / 46) ** 2 * 3); for (let y = -17; y <= -15 + hump; y++) for (let z = -72; z <= -62; z++) S(x, y, z, mul(0x17191E, 0.94 + H(x, y, z, 4) * 0.08)); S(x, -17, -61, (Math.abs(x) % 23 === 0) ? 0xFF7A1A : 0x2AD8F0, 1); }
    // multifunction displays with bezels & soft-key buttons
    const mfd = (x0, x1, y0, y1, bg, draw) => {
      for (let y = y0 - 2; y <= y1 + 2; y++) for (let x = x0 - 2; x <= x1 + 2; x++) {
        const zf = face(x, y) + 1;
        const edge = x < x0 || x > x1 || y < y0 || y > y1;
        if (edge) {
          S(x, y, zf, 0x3C414A);
          const key = (y === y0 - 2 && (x - x0) % 5 === 2) || ((x === x0 - 2 || x === x1 + 2) && (y - y0) % 5 === 2);
          if (key) S(x, y, zf + 1, [0x3AF0FF, 0xFFB03A, 0x7AFF8A][(x + y + 300) % 3], 1);
          continue;
        }
        const c = draw(x - x0, y - y0, x1 - x0, y1 - y0);
        S(x, y, zf, c === null ? bg : c, 1);
      }
    };
    // left: radar scope
    mfd(-62, -38, -44, -22, 0x04120B, (u, v, W, Hh) => {
      const cx = W / 2, cy = Hh / 2, d = Math.hypot(u - cx, v - cy);
      if (Math.abs(d - 4) < 0.45 || Math.abs(d - 8) < 0.45 || Math.abs(d - 11.5) < 0.45) return 0x1A7A42;
      if ((u === Math.round(cx) || v === Math.round(cy)) && d < 11.5) return 0x0C3A22;
      for (const [bx, by] of [[5, 15], [18, 6], [16, 17]]) if (Math.abs(u - bx) + Math.abs(v - by) <= 1) return 0xFFA040;
      return null;
    });
    // centre: attitude / navigation with a terrain grid
    mfd(-12, 12, -46, -22, 0x04101C, (u, v, W, Hh) => {
      const hz = Math.round(Hh / 2);
      if (v === hz) return 0x3AD8FF;
      if (v < hz && ((u + v * 2) % 6 === 0 || v % 4 === 0)) return 0x0A3A5A;
      if (v > hz && (u % 6 === 3) && v % 2 === 0) return 0x0C2A48;
      if (v === hz + 1 && Math.abs(u - W / 2) <= 3) return 0xFFFFFF;
      if (u === Math.round(W / 2) && v === hz + 2) return 0xFFFFFF;
      return null;
    });
    // right: ship systems
    mfd(38, 62, -44, -22, 0x120A05, (u, v) => {
      const bars = [[2, 15, 0x3AF0FF], [6, 11, 0x7AFF8A], [10, 17, 0xFFB03A], [14, 7, 0xFF5A4A], [18, 13, 0xC08AFF]];
      for (const [bx, h, c] of bars) if (u >= bx && u <= bx + 2 && v <= h) return v === h ? 0xFFFFFF : c;
      if (v === 20 && u % 2 === 0) return 0x6A5A4A;
      return null;
    });
    // caution lights along the top edge
    for (let x = -70; x <= 70; x += 7) if (Math.abs(x) > 48) S(x, -19, face(x, -19) + 1, [0x7AFF8A, 0x3AF0FF, 0xFFB03A, 0xFF4A4A][((x + 140) / 7) % 4], 1);
    // centre pedestal with switch rows
    for (let y = -50; y <= -47; y++) for (let x = -10; x <= 10; x++) { const zf = face(x, y) + 1; S(x, y, zf, 0x33373F); if (y === -48 && x % 3 === 0) S(x, y, zf + 1, x % 2 ? 0xF0F0F0 : 0xFF6A1A, x % 2 ? 0 : 1); }
    // canopy frame: slim A-pillars and a thin overhead bow — the view stays wide open
    const frame = new G(181, 110, 30, 90, 60, 90);
    const Fr = (x, y, z, c) => frame.set(x + 90, y + 60, z + 90, c);
    for (let y = -30; y <= 46; y++) { const t = (y + 30) / 76; const x = Math.round(84 - t * 14), z = Math.round(-74 + t * 8); for (const sx of [-1, 1]) { Fr(sx * x, y, z, (y % 11 === 0) ? 0xFF6A1A : 0x2C3038); Fr(sx * (x + 1), y, z, 0x1E2126); Fr(sx * x, y, z - 1, 0x1E2126); } }
    for (let x = -70; x <= 70; x++) { const y = Math.round(47 - (x / 70) ** 2 * 5); Fr(x, y, -66, 0x2C3038); Fr(x, y + 1, -66, 0x1E2126); }
    // radar sweep (spins), throttle lever, flight stick
    const sweep = new G(25, 25, 1, 12, 12, 0);
    for (let k = 1; k <= 11; k++) sweep.set(12, 12 + k, 0, k > 8 ? 0x3AFF90 : 0x9AFFC8, 1);
    const thr = new G(9, 34, 9, 4, 0, 4);
    for (let y = 0; y < 26; y++) for (let x = 3; x <= 5; x++) thr.set(x, y, 4, 0x5A5E66);
    for (let y = 24; y < 34; y++) for (let z = 0; z < 9; z++) for (let x = 0; x < 9; x++) if (!((x === 0 || x === 8) && (z === 0 || z === 8))) thr.set(x, y, z, y === 33 ? 0xFF6A1A : mul(0x2A2E36, 0.9 + ((y + z) & 1) * 0.12));
    const stick = new G(13, 44, 13, 6, 0, 6);
    for (let y = 0; y < 26; y++) for (let z = 4; z <= 8; z++) for (let x = 4; x <= 8; x++) stick.set(x, y, z, y < 3 ? 0x16181C : 0x3A3E46);
    for (let y = 26; y < 44; y++) for (let z = 2; z <= 10; z++) for (let x = 2; x <= 10; x++) { if ((x === 2 || x === 10) && (z === 2 || z === 10)) continue; stick.set(x, y, z, y === 43 ? 0x16181C : mul(0x2A2E36, 0.9 + ((x + y) & 1) * 0.12)); }
    stick.set(6, 40, 1, 0xFF3A3A, 1); stick.set(6, 41, 1, 0xFF3A3A, 1); stick.set(6, 34, 1, 0xB02020); stick.set(1, 38, 6, 0x3AF0FF, 1);
    return {
      unit: 64, h: 1, w: 1, gait: 'none',
      parts: { dash: { grid: dash, pivot: [0, 0, 0] }, frame: { grid: frame, pivot: [0, 0, 0] }, sweep: { grid: sweep, pivot: [0, 0, 0] }, thr: { grid: thr, pivot: [0, 0, 0] }, stick: { grid: stick, pivot: [0, 0, 0] } },
      layout: { dash: [0, 0, 0], frame: [0, -5, 22], sweep: [-50, -33, face(-50, -33) + 2.2], thr: [-68, -58, -52], stick: [64, -66, -52] },
    };
  };

  const DEG = Math.PI / 180;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  class Cockpit {
    constructor(g) {
      this.g = g; this.t = 0; this.thr = 0; this.stickX = 0; this.stickY = 0; this.activeT = 0; this.wasActive = false; this.hudAcc = 1;
      this.mP = mat4.create(); this.mVP = mat4.create(); this.mB = mat4.create();
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
    // 3D: the instrument panel, part of the ship (drawn after the scene with its own depth range)
    draw(r, E, cam) {
      const st = this.state(); if (!st) return;
      const g = this.g, gl = r.gl, ent = g.entities, fl = st.fl;
      const model = VR.getVoxModel(gl, 'cockpit'); if (!model || !ent) return;
      // the scene's own field of view, so the panel and the world line up
      const proj = mat4.perspective(this.mP, cam.fov || 72 * DEG, r.W / r.H, 0.02, 10);
      const vp = mat4.mul(this.mVP, proj, r.view);
      const I = fl.info();
      this.thr += (Math.max(0, I.throttle) - this.thr) * 0.3;
      this.stickX += (clamp(fl.yawRate * 0.9, -1, 1) - this.stickX) * 0.2;
      this.stickY += (clamp(fl.b.vel[1] * 0.07, -1, 1) - this.stickY) * 0.2;
      const p = ent.beginVox(r, E, vp);
      const pos = fl.b.pos;
      gl.uniform1f(p.u.u_sky, Math.max(0.55, ent.lightAt(pos[0], pos[1] + 2, pos[2]).sky));
      gl.uniform3f(p.u.u_blockLight, 0.05, 0.12, 0.14);
      gl.uniform1f(p.u.u_flash, 0); gl.uniform3f(p.u.u_tint, 1, 1, 1); gl.uniform1f(p.u.u_noFog, 1);
      // rigid in the ship's frame, in front of the (unshaken) eye: the head looks around and shakes, the panel doesn't
      const e = fl.eyeWorld(), base = this.mB;
      base.set(fl.R3); base[12] = e[0] - cam.x; base[13] = e[1] - cam.y; base[14] = e[2] - cam.z;
      mat4.translate(base, base, 0, 0.024, -0.35);
      const pose = { sweep: [-0.5, 0, -this.t * 2.2], thr: [-0.35 + this.thr * 0.8, 0, 0], stick: [-this.stickY * 0.25, 0, -this.stickX * 0.3] };
      ent.drawModel(r, p, model, [0, 0, 0], { x: 0, y: 0, z: 0 }, 0, pose, { sky: 1, bl: [0.05, 0.12, 0.14] }, { baseMat: base, noFog: true });
    }
    // 2D: the heads-up display — ≤ 30 redraws a second, 1 canvas pixel per CSS pixel, no blur
    updateHud(dt, off) {
      this.t += dt;
      const st = off ? null : this.state(), c = this.canvas;
      // in the cockpit the regular HUD (hotbar, hearts, crosshair) steps aside for the instruments
      const on = !!st && !this.g.hideHud;
      if (on !== this.wasActive) { this.wasActive = on; this.activeT = 0; this.hudAcc = 1; const hud = document.getElementById('hud'); if (hud) hud.classList.toggle('cockpit', on); }
      if (on) this.activeT += dt;
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
  }
  VR.Cockpit = Cockpit;
})(VR);
