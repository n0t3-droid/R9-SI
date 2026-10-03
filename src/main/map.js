// ============================================================================
// Maps: rotating minimap + compass line, full-screen world map (zoom, pan,
// click to drop a waypoint, right-click to remove one).
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R;
  const MS = 128; // minimap sample size (blocks)

  class MapView {
    constructor(g) {
      this.g = g;
      this.mini = document.getElementById('minimap');
      this.mctx = this.mini.getContext('2d');
      this.compass = document.getElementById('compass');
      this.off = document.createElement('canvas'); this.off.width = this.off.height = MS;
      this.octx = this.off.getContext('2d');
      this.img = this.octx.createImageData(MS, MS);
      this.row = MS; this.snap = null; this.shown = null; this.ct = 0;
      this.big = document.getElementById('bigmap');
      this.bctx = this.big.getContext('2d');
      this.bimg = this.bctx.createImageData(this.big.width, this.big.height);
      this.scale = 1; this.center = null; this.drag = null;
      this.bindBig();
    }
    // ---------------------------------------------------------------- sampling
    colorAt(x, z, out) {
      const w = this.g.world, c = w.col(x >> 4, z >> 4);
      if (!c) return false;
      const ci = ((z & 15) << 4) | (x & 15);
      const y = c.height[ci];
      const s = c.blocks[(y << 8) | ci];
      if (!s) { out[0] = out[1] = out[2] = 0.05; out[3] = 0; return true; }
      const T = R.T, A = this.g.tex.avgColor;
      const layer = T.tex[s * 6 + 2] & 0xfff;
      let r = A[layer * 4], gg = A[layer * 4 + 1], b = A[layer * 4 + 2];
      const tint = T.tint[s];
      if (tint) {
        const v = tint === 1 ? c.grass[ci] : tint === 3 ? c.water[ci] : c.foliage[ci];
        const k = tint === 3 ? 1.1 : 1.35;
        r *= ((v >> 11) & 31) / 31 * k; gg *= ((v >> 5) & 63) / 63 * k; b *= (v & 31) / 31 * k;
      }
      if (T.flags[s] & VR.F.WATER) { // deeper water is darker
        let d = 0; for (let yy = y - 1; yy > y - 12 && yy > 0; yy--) { if (!(T.flags[c.blocks[(yy << 8) | ci]] & VR.F.WATER)) break; d++; }
        const k = 1 - Math.min(0.5, d * 0.05); r *= k; gg *= k; b *= k;
      }
      out[0] = r; out[1] = gg; out[2] = b; out[3] = y;
      return true;
    }
    heightAt(x, z) { const w = this.g.world, c = w.col(x >> 4, z >> 4); return c ? c.height[((z & 15) << 4) | (x & 15)] : -1; }
    // ---------------------------------------------------------------- minimap
    update(dt) {
      const g = this.g, S = g.settings, p = g.player;
      const vis = S.minimap && g.state === 'play' && !g.hideHud && !g.photo;
      if (vis !== this.shown) { this.shown = vis; this.mini.style.display = vis ? 'block' : 'none'; this.compass.style.display = vis ? 'block' : 'none'; }
      if (!vis || !p) return;
      // progressive refresh: 16 rows per frame
      if (this.row >= MS) { this.row = 0; this.pending = [Math.floor(p.pos[0]) - MS / 2, Math.floor(p.pos[2]) - MS / 2]; }
      const [x0, z0] = this.pending, d = this.img.data, col = [0, 0, 0, 0], nb = [0, 0, 0, 0];
      for (let k = 0; k < 16 && this.row < MS; k++, this.row++) {
        const z = z0 + this.row;
        for (let i = 0; i < MS; i++) {
          const x = x0 + i, o = (this.row * MS + i) * 4;
          if (!this.colorAt(x, z, col)) { d[o] = 8; d[o + 1] = 10; d[o + 2] = 18; d[o + 3] = 255; continue; }
          const hn = this.heightAt(x, z - 1), hw = this.heightAt(x - 1, z);
          let shade = 1;
          if (hn >= 0) shade += (col[3] - hn) * 0.07; if (hw >= 0) shade += (col[3] - hw) * 0.05;
          shade = Math.max(0.6, Math.min(1.35, shade));
          d[o] = Math.min(255, col[0] * 255 * shade); d[o + 1] = Math.min(255, col[1] * 255 * shade); d[o + 2] = Math.min(255, col[2] * 255 * shade); d[o + 3] = 255;
        }
      }
      void nb;
      let fresh = false;
      if (this.row >= MS) { this.octx.putImageData(this.img, 0, 0); this.snap = this.pending; fresh = true; }
      const now = performance.now(), key = p.yaw.toFixed(3) + ',' + p.pos[0].toFixed(1) + ',' + p.pos[2].toFixed(1);
      if ((fresh || key !== this.lastKey) && now - (this.lastDraw || 0) > 33) { this.lastKey = key; this.lastDraw = now; this.drawMini(); }
      this.ct -= dt;
      if (this.ct <= 0) { this.ct = 0.2; this.updateCompass(); }
    }
    drawMini() {
      const g = this.g, p = g.player, ctx = this.mctx, W = this.mini.width, H = this.mini.height;
      ctx.clearRect(0, 0, W, H);
      if (!this.snap) return;
      const sc = W / (MS * 0.8); // show ~100 blocks across
      ctx.save();
      ctx.beginPath(); ctx.arc(W / 2, H / 2, W / 2 - 1, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = '#080a12'; ctx.fillRect(0, 0, W, H);
      ctx.translate(W / 2, H / 2);
      ctx.rotate(p.yaw);
      ctx.scale(sc, sc);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.off, this.snap[0] - p.pos[0], this.snap[1] - p.pos[2]);
      // waypoints
      const gad = g.gadgets;
      if (gad) for (const wp of gad.waypoints) {
        let dx = wp.x + 0.5 - p.pos[0], dz = wp.z + 0.5 - p.pos[2];
        const L = Math.hypot(dx, dz), lim = (W / 2 - 8) / sc;
        if (L > lim) { dx *= lim / L; dz *= lim / L; }
        ctx.save(); ctx.translate(dx, dz); ctx.rotate(-p.yaw); ctx.scale(1 / sc, 1 / sc);
        ctx.fillStyle = wp.col; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(5, 0); ctx.lineTo(0, 6); ctx.lineTo(-5, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      // villages (little gold houses, pinned to the rim when far) and villagers
      const vils = g.villages;
      if (vils) {
        for (const s of vils.sites) {
          let dx = s.x + 0.5 - p.pos[0], dz = s.z + 0.5 - p.pos[2];
          const L = Math.hypot(dx, dz), lim = (W / 2 - 9) / sc;
          if (L > 700) continue;
          if (L > lim) { dx *= lim / L; dz *= lim / L; }
          ctx.save(); ctx.translate(dx, dz); ctx.rotate(-p.yaw); ctx.scale(1 / sc, 1 / sc);
          ctx.fillStyle = '#ffd166'; ctx.strokeStyle = '#1a1206'; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(-5, 5); ctx.lineTo(-5, -1); ctx.lineTo(0, -6); ctx.lineTo(5, -1); ctx.lineTo(5, 5); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.restore();
        }
        for (const a of vils.agents) { const dx = a.pos[0] - p.pos[0], dz = a.pos[2] - p.pos[2]; if (dx * dx + dz * dz > 48 * 48) continue; ctx.fillStyle = '#7ad8ff'; ctx.fillRect(dx - 0.7, dz - 0.7, 1.4, 1.4); }
      }
      // friends playing with you
      if (g.mp && g.mp.active) for (const q of g.mp.players()) {
        let dx = q.pos[0] - p.pos[0], dz = q.pos[2] - p.pos[2];
        const L = Math.hypot(dx, dz), lim = (W / 2 - 9) / sc;
        if (L > lim) { dx *= lim / L; dz *= lim / L; }
        ctx.save(); ctx.translate(dx, dz); ctx.rotate(-p.yaw); ctx.scale(1 / sc, 1 / sc);
        ctx.fillStyle = q.host ? '#ffd166' : '#5cffc4'; ctx.strokeStyle = '#04120c'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(q.name.slice(0, 10), 0, -6);
        ctx.restore();
      }
      // nearby creatures
      if (g.entities) for (const m of g.entities.mobs) {
        const dx = m.pos[0] - p.pos[0], dz = m.pos[2] - p.pos[2]; if (dx * dx + dz * dz > 48 * 48) continue;
        ctx.fillStyle = m.def.hostile ? '#ff4a4a' : '#e8e8e8'; ctx.fillRect(dx - 0.8, dz - 0.8, 1.6, 1.6);
      }
      ctx.restore();
      // north marker
      ctx.save(); ctx.translate(W / 2, H / 2); ctx.rotate(p.yaw);
      ctx.fillStyle = '#ff5a5a'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.translate(0, -(W / 2 - 11)); ctx.rotate(-p.yaw); ctx.fillText('N', 0, 0);
      ctx.restore();
      // player arrow
      ctx.save(); ctx.translate(W / 2, H / 2);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 7); ctx.lineTo(0, 3); ctx.lineTo(-6, 7); ctx.closePath(); ctx.stroke(); ctx.fill();
      ctx.restore();
    }
    updateCompass() {
      const g = this.g, p = g.player;
      const deg = ((Math.round(-p.yaw * 180 / Math.PI) % 360) + 360) % 360;
      const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
      let s = `${dirs[Math.round(deg / 45) % 8]} ${deg}°`;
      if (g.settings.showCoords) s += ` · ${Math.floor(p.pos[0])} ${Math.floor(p.pos[1])} ${Math.floor(p.pos[2])}`;
      const gad = g.gadgets;
      if (gad && gad.waypoints.length) {
        let best = null, bd = 1e18;
        for (const wp of gad.waypoints) { const d = (wp.x - p.pos[0]) ** 2 + (wp.z - p.pos[2]) ** 2; if (d < bd) { bd = d; best = wp; } }
        if (best) s += `<br><span style="color:${best.col}">◆</span> ${best.name.replace(/[<>&]/g, '')} ${Math.round(Math.sqrt(bd))}m`;
      }
      // the nearest village is always one glance away
      if (g.villages) {
        const nv = g.villages.nearestSite(p.pos[0], p.pos[2]);
        if (nv && nv.dist > 70) {
          const a = Math.atan2(nv.site.x - p.pos[0], -(nv.site.z - p.pos[2]));
          const rel = ((Math.round((a + p.yaw) * 180 / Math.PI) % 360) + 540) % 360 - 180;
          const arrow = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'][((Math.round(rel / 45) % 8) + 8) % 8];
          s += `<br><span style="color:#ffd166">⌂</span> ${nv.site.name} ${Math.round(nv.dist)}m ${arrow}`;
        }
      }
      if (s !== this.lastCompass) { this.lastCompass = s; this.compass.innerHTML = s; }
    }
    // ---------------------------------------------------------------- big map
    openBig() {
      const g = this.g, p = g.player;
      this.center = [p.pos[0], p.pos[2]];
      g.ui.show('mapscreen');
      this.renderBig();
    }
    renderBig() {
      const g = this.g, p = g.player, W = this.big.width, H = this.big.height, s = this.scale;
      const d = this.bimg.data, col = [0, 0, 0, 0];
      const cx = this.center[0], cz = this.center[1];
      for (let py = 0; py < H; py++) {
        const z = Math.floor(cz + (py - H / 2) * s);
        for (let px = 0; px < W; px++) {
          const x = Math.floor(cx + (px - W / 2) * s), o = (py * W + px) * 4;
          if (!this.colorAt(x, z, col)) { const k = ((x >> 4) + (z >> 4)) & 1 ? 14 : 18; d[o] = k; d[o + 1] = k; d[o + 2] = k + 10; d[o + 3] = 255; continue; }
          const hn = this.heightAt(x, z - Math.max(1, s | 0));
          let shade = 1; if (hn >= 0) shade += (col[3] - hn) * 0.06 / Math.max(1, s);
          shade = Math.max(0.6, Math.min(1.35, shade));
          d[o] = Math.min(255, col[0] * 255 * shade); d[o + 1] = Math.min(255, col[1] * 255 * shade); d[o + 2] = Math.min(255, col[2] * 255 * shade); d[o + 3] = 255;
        }
      }
      const ctx = this.bctx;
      ctx.putImageData(this.bimg, 0, 0);
      const toScr = (x, z) => [(x - cx) / s + W / 2, (z - cz) / s + H / 2];
      // waypoints
      const gad = g.gadgets;
      ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      if (gad) for (const wp of gad.waypoints) {
        const [sx, sy] = toScr(wp.x + 0.5, wp.z + 0.5);
        if (sx < -20 || sy < -20 || sx > W + 20 || sy > H + 20) continue;
        ctx.fillStyle = wp.col; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(sx, sy - 8); ctx.lineTo(sx + 7, sy); ctx.lineTo(sx, sy + 8); ctx.lineTo(sx - 7, sy); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeText(wp.name, sx + 11, sy); ctx.fillText(wp.name, sx + 11, sy);
      }
      // villages
      if (g.villages) for (const v of g.villages.sites) {
        const [sx, sy] = toScr(v.x + 0.5, v.z + 0.5);
        if (sx < -40 || sy < -20 || sx > W + 40 || sy > H + 20) continue;
        ctx.fillStyle = '#ffd166'; ctx.strokeStyle = '#1a1206'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(sx - 7, sy + 6); ctx.lineTo(sx - 7, sy - 1); ctx.lineTo(sx, sy - 8); ctx.lineTo(sx + 7, sy - 1); ctx.lineTo(sx + 7, sy + 6); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#000'; ctx.strokeText(v.name, sx + 11, sy); ctx.fillStyle = '#ffe6a8'; ctx.fillText(v.name, sx + 11, sy);
      }
      // player
      const [px, py] = toScr(p.pos[0], p.pos[2]);
      ctx.save(); ctx.translate(px, py); ctx.rotate(-p.yaw);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(7, 8); ctx.lineTo(0, 4); ctx.lineTo(-7, 8); ctx.closePath(); ctx.stroke(); ctx.fill();
      ctx.restore();
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(8, H - 30, 250, 22);
      ctx.fillStyle = '#cfe6ff'; ctx.font = '12px sans-serif';
      ctx.fillText(`${s} block${s > 1 ? 's' : ''}/px · centre ${Math.round(cx)}, ${Math.round(cz)}`, 14, H - 19);
    }
    bindBig() {
      const c = this.big;
      const worldAt = (e) => { const r = c.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width * c.width, py = (e.clientY - r.top) / r.height * c.height; return [this.center[0] + (px - c.width / 2) * this.scale, this.center[1] + (py - c.height / 2) * this.scale, px, py]; };
      c.addEventListener('wheel', (e) => { e.preventDefault(); if (!this.center) return; this.scale = Math.max(1, Math.min(8, this.scale * (e.deltaY > 0 ? 2 : 0.5))); this.renderBig(); }, { passive: false });
      c.addEventListener('mousedown', (e) => { if (!this.center) return; this.drag = { x: e.clientX, y: e.clientY, c: this.center.slice(), moved: 0, btn: e.button }; });
      window.addEventListener('mousemove', (e) => {
        if (!this.drag) return;
        const r = c.getBoundingClientRect(), k = c.width / r.width * this.scale;
        const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
        this.drag.moved = Math.max(this.drag.moved, Math.abs(dx) + Math.abs(dy));
        if (this.drag.moved > 4) { this.center = [this.drag.c[0] - dx * k, this.drag.c[1] - dy * k]; clearTimeout(this.rt); this.rt = setTimeout(() => this.renderBig(), 16); }
      });
      window.addEventListener('mouseup', (e) => {
        const d = this.drag; this.drag = null;
        if (!d || d.moved > 4 || this.g.ui.screen !== 'mapscreen') return;
        const [wx, wz, px, py] = worldAt(e);
        const gad = this.g.gadgets; if (!gad) return;
        if (d.btn === 2) {
          let bi = -1, bd = 14 * 14;
          gad.waypoints.forEach((wp, i) => { const sx = (wp.x + 0.5 - this.center[0]) / this.scale + c.width / 2, sy = (wp.z + 0.5 - this.center[1]) / this.scale + c.height / 2; const dd = (sx - px) ** 2 + (sy - py) ** 2; if (dd < bd) { bd = dd; bi = i; } });
          if (bi >= 0) { const wp = gad.waypoints.splice(bi, 1)[0]; this.g.ui.chatLine('Removed ' + wp.name, '#cfe6ff'); }
        } else if (d.btn === 0) {
          const x = Math.floor(wx), z = Math.floor(wz), h = this.heightAt(x, z);
          gad.addWaypoint(x, h >= 0 ? h + 1 : 64, z);
        }
        this.renderBig();
      });
      c.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }
  VR.MapView = MapView;
})(VR);
