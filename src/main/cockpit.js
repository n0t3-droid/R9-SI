// ============================================================================
// Cockpit: when you fly a starship or shuttle in first person you sit behind a
// jet-style instrument panel (radar / nav / systems screens, glare shield,
// throttle and flight stick that move with your inputs, slim canopy frame
// that keeps the view wide open) and a glowing heads-up display (pitch
// ladder, heading tape, speed & altitude, boresight, throttle and boost).
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

  class Cockpit {
    constructor(g) {
      this.g = g; this.t = 0; this.thr = 0; this.stickX = 0; this.stickY = 0; this.activeT = 0; this.wasActive = false;
      const c = this.canvas = document.createElement('canvas');
      c.id = 'cockpitHud';
      c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:3;display:none';
      (document.getElementById('app') || document.body).appendChild(c);
      this.ctx = c.getContext('2d');
    }
    // flight state of whatever we're piloting in first person
    state() {
      const g = this.g;
      if (g.camMode !== 0 || g.hideHud === 'all') return null;
      const sp = g.starships && g.starships.pilot;
      if (sp && sp.d.meta) {
        const m = sp.d.meta;
        return { kind: 'starship', pos: sp.pos, vel: sp.vel, yaw: sp.yaw, pitch: sp.pitch, roll: sp.roll, turn: sp.turnVel || 0, gear: sp.gear, name: m.name, label: m.label, vmax: m.speed };
      }
      const gad = g.gadgets;
      if (gad && gad.riding && gad.riding.type === 'ship' && gad.ship) {
        const S = gad.ship;
        if (S.state === 'meshing') return null;
        return { kind: 'ship', pos: S.pos, vel: S.vel || [0, 0, 0], yaw: (S.yaw0 || 0) + (S.psi || 0), pitch: S.pitch || 0, roll: S.roll || 0, turn: S.turnVel || 0, gear: 0, name: S.name || 'Shuttle', label: '', vmax: S.maxSpeed || 40 };
      }
      return null;
    }
    active() { return !!this.state(); }
    // 3D: the instrument panel, attached to the camera (drawn after the scene with its own depth range)
    draw(r, E, cam) {
      const st = this.state(); if (!st) return;
      const g = this.g, gl = r.gl, ent = g.entities;
      const model = VR.getVoxModel(gl, 'cockpit'); if (!model || !ent) return;
      const aspect = r.W / r.H;
      const proj = mat4.perspective(mat4.create(), 72 * Math.PI / 180, aspect, 0.02, 10);
      const vp = mat4.mul(mat4.create(), proj, r.view);
      const inv = mat4.invert(mat4.create(), r.view);
      const input = g.input;
      const k = (c) => input && input.down(c) && !g.ui.typing;
      const fw = (k('KeyW') ? 1 : 0) - (k('KeyS') ? 1 : 0);
      this.thr += (Math.max(0, fw) * (k('ControlLeft') ? 1 : 0.75) - this.thr) * 0.08;
      const speed = Math.hypot(st.vel[0], st.vel[1], st.vel[2]);
      this.stickX += (Math.max(-1, Math.min(1, st.turn * 0.8)) - this.stickX) * 0.15;
      this.stickY += (Math.max(-1, Math.min(1, st.vel[1] * 0.08)) - this.stickY) * 0.15;
      const shake = Math.min(1, speed / 90) * 0.004;
      const p = ent.beginVox(r, E, vp);
      gl.uniform1f(p.u.u_sky, Math.max(0.55, ent.lightAt(st.pos[0], st.pos[1] + 2, st.pos[2]).sky));
      gl.uniform3f(p.u.u_blockLight, 0.05, 0.12, 0.14);
      gl.uniform1f(p.u.u_flash, 0); gl.uniform3f(p.u.u_tint, 1, 1, 1); gl.uniform1f(p.u.u_noFog, 1);
      // the panel belongs to the ship, not to your eyes: look around (free-look, autopilot) and it stays put
      const base = mat4.create();
      mat4.rotY(base, base, st.yaw); if (st.pitch) mat4.rotX(base, base, st.pitch * 0.5); if (st.roll) mat4.rotZ(base, base, st.roll * 0.6);
      void inv;
      mat4.translate(base, base, (Math.random() - 0.5) * shake, 0.024 + (Math.random() - 0.5) * shake, -0.35);
      const pose = { sweep: [-0.5, 0, -this.t * 2.2], thr: [-0.35 + this.thr * 0.8, 0, 0], stick: [-this.stickY * 0.25, 0, -this.stickX * 0.3] };
      ent.drawModel(r, p, model, [0, 0, 0], { x: 0, y: 0, z: 0 }, 0, pose, { sky: 1, bl: [0.05, 0.12, 0.14] }, { baseMat: base, noFog: true });
    }
    // 2D: the heads-up display
    updateHud(dt, off) {
      this.t += dt;
      const st = off ? null : this.state(), c = this.canvas;
      // in the cockpit the regular HUD (hotbar, hearts, crosshair) steps aside for the instruments
      const on = !!st && !this.g.hideHud;
      if (on !== this.wasActive) { this.wasActive = on; this.activeT = 0; const hud = document.getElementById('hud'); if (hud) hud.classList.toggle('cockpit', on); }
      if (on) this.activeT += dt;
      if (!st || this.g.hideHud) { if (c.style.display !== 'none') c.style.display = 'none'; return; }
      if (c.style.display !== 'block') c.style.display = 'block';
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = Math.round(c.clientWidth * dpr), Hh = Math.round(c.clientHeight * dpr);
      if (c.width !== W || c.height !== Hh) { c.width = W; c.height = Hh; }
      const x = this.ctx, g = this.g, cam = g.cam || {};
      x.clearRect(0, 0, W, Hh);
      const s = dpr, cx = W / 2, cy = Hh * 0.47;
      const col = 'rgba(125,252,255,0.92)', dim = 'rgba(125,252,255,0.45)';
      x.save();
      x.strokeStyle = col; x.fillStyle = col; x.lineWidth = 1.6 * s; x.shadowColor = 'rgba(80,240,255,0.9)'; x.shadowBlur = 6 * s;
      x.font = `${Math.round(12 * s)}px Orbitron, Rajdhani, monospace`; x.textAlign = 'center'; x.textBaseline = 'middle';
      // pitch ladder (camera pitch & roll)
      const fovY = (cam.fov || 1.25);
      const pxPerRad = Hh / fovY;
      const pitch = (g.player ? g.player.pitch : 0), roll = cam.roll || 0;
      x.save(); x.translate(cx, cy); x.rotate(-roll);
      for (let a = -60; a <= 60; a += 10) {
        const yy = (pitch - a * Math.PI / 180) * pxPerRad;
        if (Math.abs(yy) > Hh * 0.32) continue;
        const w = a === 0 ? 150 * s : 60 * s, gap = 34 * s;
        x.strokeStyle = a === 0 ? col : dim;
        x.setLineDash(a < 0 ? [6 * s, 5 * s] : []);
        x.beginPath(); x.moveTo(-gap - w, yy); x.lineTo(-gap, yy); x.moveTo(gap, yy); x.lineTo(gap + w, yy); x.stroke();
        if (a !== 0) { x.fillText(String(Math.abs(a)), -gap - w - 16 * s, yy); x.fillText(String(Math.abs(a)), gap + w + 16 * s, yy); }
      }
      x.setLineDash([]); x.restore();
      // boresight + flight path marker
      x.beginPath(); x.arc(cx, cy, 9 * s, 0, TAU); x.stroke();
      x.beginPath(); x.moveTo(cx - 22 * s, cy); x.lineTo(cx - 9 * s, cy); x.moveTo(cx + 9 * s, cy); x.lineTo(cx + 22 * s, cy); x.moveTo(cx, cy - 9 * s); x.lineTo(cx, cy - 16 * s); x.stroke();
      // heading tape
      const hdg = ((-st.yaw * 180 / Math.PI) % 360 + 360) % 360;
      const ty = Hh * 0.08, span = 70, tw = W * 0.34;
      x.strokeStyle = dim;
      x.beginPath(); x.moveTo(cx - tw / 2, ty + 12 * s); x.lineTo(cx + tw / 2, ty + 12 * s); x.stroke();
      for (let d = Math.ceil((hdg - span / 2) / 5) * 5; d <= hdg + span / 2; d += 5) {
        const xx = cx + (d - hdg) / span * tw;
        const big = d % 30 === 0;
        x.beginPath(); x.moveTo(xx, ty + 12 * s); x.lineTo(xx, ty + (big ? 2 : 7) * s); x.stroke();
        if (big) { const n = ((d % 360) + 360) % 360; x.fillStyle = dim; x.fillText(n === 0 ? 'N' : n === 90 ? 'E' : n === 180 ? 'S' : n === 270 ? 'W' : String(n / 10), xx, ty - 8 * s); }
      }
      x.fillStyle = col; x.strokeStyle = col;
      x.strokeRect(cx - 24 * s, ty + 16 * s, 48 * s, 18 * s); x.fillText(String(Math.round(hdg)).padStart(3, '0'), cx, ty + 25 * s);
      // speed (left) & altitude (right)
      const spd = Math.hypot(st.vel[0], st.vel[1], st.vel[2]);
      const box = (bx, label, val) => { x.strokeRect(bx - 38 * s, cy - 13 * s, 76 * s, 26 * s); x.fillText(val, bx, cy); x.fillStyle = dim; x.fillText(label, bx, cy - 24 * s); x.fillStyle = col; };
      box(cx - W * 0.2, 'SPD m/s', String(Math.round(spd)));
      box(cx + W * 0.2, 'ALT', String(Math.round(st.pos[1])));
      // vertical speed caret
      const vs = Math.max(-1, Math.min(1, st.vel[1] / 20));
      x.beginPath(); x.moveTo(cx + W * 0.2 + 46 * s, cy - vs * 40 * s); x.lineTo(cx + W * 0.2 + 54 * s, cy - vs * 40 * s - 5 * s); x.lineTo(cx + W * 0.2 + 54 * s, cy - vs * 40 * s + 5 * s); x.closePath(); x.fill();
      // throttle / boost / gear
      const bx = cx - W * 0.2 - 70 * s, by = cy + 60 * s;
      x.strokeRect(bx, by - 60 * s, 10 * s, 60 * s);
      x.fillRect(bx + 2 * s, by - 2 * s - this.thr * 56 * s, 6 * s, this.thr * 56 * s);
      x.textAlign = 'left'; x.fillStyle = dim;
      x.fillText('THR', bx - 2 * s, by + 12 * s);
      x.fillText(st.gear > 0.5 ? 'GEAR DN' : 'GEAR UP', cx + W * 0.2 - 38 * s, cy + 40 * s);
      x.fillText(st.name.toUpperCase(), cx - W * 0.2 - 38 * s, cy + 40 * s);
      if (this.g.input && this.g.input.down('ControlLeft')) { x.fillStyle = 'rgba(255,170,60,0.95)'; x.fillText('BOOST', cx - 24 * s, cy + 70 * s); }
      // navigation: autopilot status or the nearest village, with a marker on the canopy
      const SS = g.starships, ap = st.kind === 'starship' && SS ? SS.auto : null;
      let dest = null, line = null;
      if (ap) { const t = ap.spot || [ap.site.x, ap.site.y + 1, ap.site.z]; dest = [t[0], t[1] + 3, t[2]]; const eta = Math.round(ap.eta || 0); line = `AUTOPILOT ▸ ${ap.site.name.toUpperCase()} · ${(ap.dist / 1000).toFixed(2)} km` + (eta > 0 ? ` · ETA ${Math.floor(eta / 60)}:${String(eta % 60).padStart(2, '0')}` : ''); }
      else if (g.villages && g.villages.list) {
        let best = null, bd = 1e18;
        for (const v of g.villages.list()) { const d = (v.x - st.pos[0]) ** 2 + (v.z - st.pos[2]) ** 2; if (d > 140 * 140 && d < bd) { bd = d; best = v; } }
        if (best) { dest = [best.x, best.y + 8, best.z]; line = `⌂ ${best.name.toUpperCase()} ${(Math.sqrt(bd) / 1000).toFixed(1)} km` + (st.kind === 'starship' ? ' · G AUTOPILOT' : ''); }
      }
      if (line) { x.textAlign = 'center'; x.fillStyle = ap ? 'rgba(154,255,216,0.95)' : dim; x.fillText(line, cx, ty + 50 * s); }
      const r = g.renderer;
      if (dest && r && r.viewProj && cam.x !== undefined) {
        const m = r.viewProj, px = dest[0] - cam.x, py = dest[1] - cam.y, pz = dest[2] - cam.z;
        const X = m[0] * px + m[4] * py + m[8] * pz + m[12], Y = m[1] * px + m[5] * py + m[9] * pz + m[13], Wc = m[3] * px + m[7] * py + m[11] * pz + m[15];
        let sx = X / Math.abs(Wc || 1), sy = Y / Math.abs(Wc || 1);
        const behind = Wc <= 0.01;
        x.strokeStyle = ap ? 'rgba(154,255,216,0.95)' : col;
        if (!behind && Math.abs(sx) < 0.95 && Math.abs(sy) < 0.9) {
          const qx = (sx * 0.5 + 0.5) * W, qy = (0.5 - sy * 0.5) * Hh, d = 9 * s;
          x.beginPath(); x.moveTo(qx, qy - d); x.lineTo(qx + d, qy); x.lineTo(qx, qy + d); x.lineTo(qx - d, qy); x.closePath(); x.stroke();
          x.beginPath(); x.moveTo(qx, qy - d * 2.2); x.lineTo(qx, qy - d * 1.3); x.stroke();
        } else {
          // off-canopy: an arrow on the rim points the way
          if (behind) { sx = -sx; sy = -sy; }
          const a = Math.atan2(-sy, sx), rx = W * 0.3, ry = Hh * 0.3;
          const qx = cx + Math.cos(a) * rx, qy = cy + Math.sin(a) * ry, d = 10 * s;
          x.save(); x.translate(qx, qy); x.rotate(a);
          x.beginPath(); x.moveTo(d, 0); x.lineTo(-d * 0.7, -d * 0.7); x.lineTo(-d * 0.3, 0); x.lineTo(-d * 0.7, d * 0.7); x.closePath(); x.stroke();
          x.restore();
        }
      }
      x.restore();
    }
  }
  VR.Cockpit = Cockpit;
})(VR);
