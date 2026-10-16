// ============================================================================
// 📷 Fotomodus (t-first · WOW VII; docs/superpowers/plans/2026-10-16-t-first.md): F8 (the photo action's second key — P
// stays) or the pause menu's 📷. The HUD and the hand go; a free camera leaves the eye and glides at walking speed
// (W A S D, Space / Shift up and down, Ctrl faster), it does not pass through blocks; the player stays where it stood.
// Q / E roll the picture (± 20°); [ and ] (or , and .) move the time of day, which is held while the mode is on and
// given back when it ends. F2, Enter or a click save the picture at twice the screen's pixels (renderer.capNext: one
// frame rendered at 2× scale 1, read back, the size restored in the same task), as 'R9-SI-<world>-<n>.png' through a
// blob link — the claude.ai page shows it in the screenshot overlay instead. No request leaves the browser. The first
// time a hint line names the keys. Esc ends it. (The photo drone keeps the old mode: gadgets.js drives its own camera.)
// ============================================================================
(function (VR) {
  'use strict';
  const tx = (k, v, de, en) => (VR.I18N && VR.I18N.tx ? VR.I18N.tx(k, v, de, en) : de);
  const PM = VR.PhotoMode = {};
  PM.SPEED = 4.3;               // blocks a second: the player's walk
  PM.FAST = 2.5;                // Ctrl
  PM.ROLL = 20 * Math.PI / 180; // the roll's limit
  PM.ROLL_RATE = 0.6;           // radians a second while Q / E are held
  PM.TIME_RATE = 600;           // ticks a second while [ / ] are held (a 20-minute day in 40 s)
  PM.SCALE = 2;                 // the picture: twice the screen's pixels
  PM.EASE = 10;                 // the glide's velocity eases in and out (1 / s)
  const HINT_KEY = 'r9si.photoHint';
  // ---- the pure parts (test/first.js)
  const SPELL = { ä: 'ae', ö: 'oe', ü: 'ue', Ä: 'Ae', Ö: 'Oe', Ü: 'Ue', ß: 'ss' };
  PM.fileName = function (world, n) {
    let s = String(world == null ? '' : world).replace(/[äöüÄÖÜß]/g, (c) => SPELL[c]).normalize('NFKD').replace(/[̀-ͯ]/g, '');
    s = s.replace(/\s+/g, '-').replace(/[^A-Za-z0-9_-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40).replace(/-$/, '');
    return 'R9-SI-' + (s || 'Welt') + '-' + Math.max(1, n | 0) + '.png';
  };
  PM.state = (o) => ({ x: o.x, y: o.y, z: o.z, yaw: o.yaw || 0, pitch: o.pitch || 0, roll: 0, vel: [0, 0, 0] });
  // one step of the glide: keys {fw, st, up (−1..1), fast, roll (−1..1), time}; move(pos, dx, dy, dz) (blocks in the way)
  // or a free move without it
  PM.glide = function (s, k, dt, move) {
    const sp = PM.SPEED * (k.fast ? PM.FAST : 1), cp = Math.cos(s.pitch);
    const f = [-Math.sin(s.yaw) * cp, Math.sin(s.pitch), -Math.cos(s.yaw) * cp], rx = [Math.cos(s.yaw), 0, -Math.sin(s.yaw)];
    const tv = [(f[0] * k.fw + rx[0] * k.st) * sp, (f[1] * k.fw + k.up) * sp, (f[2] * k.fw + rx[2] * k.st) * sp];
    const a = 1 - Math.exp(-dt * PM.EASE);
    for (let i = 0; i < 3; i++) s.vel[i] += (tv[i] - s.vel[i]) * a;
    if (move) move(s, s.vel[0] * dt, s.vel[1] * dt, s.vel[2] * dt);
    else { s.x += s.vel[0] * dt; s.y += s.vel[1] * dt; s.z += s.vel[2] * dt; }
    s.roll = Math.max(-PM.ROLL, Math.min(PM.ROLL, s.roll + (k.roll || 0) * PM.ROLL_RATE * dt));
    return s;
  };
  PM.timeStep = (tod, dir, dt) => ((tod + dir * PM.TIME_RATE * dt) % 24000 + 24000) % 24000;

  // ---- the game's actor
  class Photo {
    constructor(g) { this.g = g; this.on = false; this.s = null; this.first = false; this.busy = false; }
    enter() {
      const g = this.g, p = g.player; if (!p || this.on || (g.gadgets && g.gadgets.controlling)) return;   // (riding: the old photo look only)
      const e = p.eyePos();
      this.s = PM.state({ x: e[0], y: e[1], z: e[2], yaw: p.yaw, pitch: p.pitch });
      this.on = true; this.first = true;
      this.keep = { hideHud: g.hideHud, tod: g.env.ticks };
      this.held = g.env.timeOfDay;   // (the time of day stands while the mode is on; [ ] move it)
      g.hideHud = true;
      if (g.input && g.input.requestLock) g.input.requestLock();   // (the mouse looks round at once — a click is a photo)
      let seen = false; try { seen = localStorage.getItem(HINT_KEY) === '1'; localStorage.setItem(HINT_KEY, '1'); } catch (err) { seen = false; }
      g.ui.hint(seen ? tx('g.photo.short', null, '📷 Fotomodus · F2 oder Klick: Foto · Esc: zurück', '📷 Photo mode · F2 or click: photo · Esc: back') : tx('g.photo.hint', null, '📷 Fotomodus — Maus: schauen · W A S D: gleiten · Leertaste / Umschalt: hoch / runter · Q / E: neigen · [ ] oder , .: Tageszeit · F2, Eingabe oder Klick: Foto (2×) · Esc: zurück', '📷 Photo mode — mouse: look · W A S D: glide · Space / Shift: up / down · Q / E: tilt · [ ] or , .: time of day · F2, Enter or click: photo (2×) · Esc: back'), seen ? 2600 : 9000);
    }
    leave() {
      const g = this.g; if (!this.on) return;
      this.on = false;
      if (this.keep) { g.hideHud = this.keep.hideHud; g.env.setTime(this.keep.tod); }   // (the time of day as it was: the photo mode changes nothing in the world)
      const hud = document.getElementById('hud'); if (hud) hud.style.visibility = g.hideHud ? 'hidden' : 'visible';
      if (g.ui) g.ui.hint(null);
    }
    // a frame in the mode: the look (the mouse), the glide, the roll, the time, a picture
    update(dt, I) {
      const g = this.g, s = this.s, w = g.world; if (!this.on || !s) return;
      const typing = g.ui && g.ui.typing, dn = (c) => !typing && I.down(c);
      const sens = I.sensitivity || 0.0024;
      s.yaw -= I.mouse.dx * sens; s.pitch = Math.max(-1.55, Math.min(1.55, s.pitch - I.mouse.dy * sens * (I.invertY ? -1 : 1)));
      const k = { fw: (dn('KeyW') ? 1 : 0) - (dn('KeyS') ? 1 : 0), st: (dn('KeyD') ? 1 : 0) - (dn('KeyA') ? 1 : 0), up: (dn('Space') ? 1 : 0) - (dn('ShiftLeft') ? 1 : 0), fast: dn('ControlLeft'), roll: (dn('KeyE') ? 1 : 0) - (dn('KeyQ') ? 1 : 0) };
      const PH = VR.PHYS;
      PM.glide(s, k, dt, w && PH ? (st, dx, dy, dz) => { const pos = [st.x, st.y - 0.15, st.z]; PH.move((x, y, z) => w.getBlock(x, y, z), pos, 0.15, 0.3, dx, dy, dz, 0, w.nbFn()); st.x = pos[0]; st.y = pos[1] + 0.15; st.z = pos[2]; } : null);
      const td = (dn('BracketRight') || dn('Period') ? 1 : 0) - (dn('BracketLeft') || dn('Comma') ? 1 : 0);
      if (td) this.held = PM.timeStep(this.held, td, dt);
      g.env.setTime(this.held);   // (held: the env's own step this frame is undone the next)
      if (!this.first && I.hit('KeyP')) { g.photoMode(false); return; }   // (P or F8 again: back)
      if (!this.first && !this.busy && (I.hit('F2') || I.hit('Enter') || I.hit('NumpadEnter') || (I.dragLook ? I.clickAction(0) : I.mouse.clicked[0]))) this.shoot();
      this.first = false;
    }
    // the camera handed to the renderer
    cam(base) {
      const s = this.s; if (!this.on || !s) return null;
      return Object.assign({}, base, { x: s.x, y: s.y, z: s.z, yaw: s.yaw, pitch: s.pitch, roll: s.roll, fixed: true });
    }
    // the picture: the next frame once more at 2× (renderer.capNext), then the PNG out
    shoot() {
      const g = this.g, r = g.renderer; if (!r || this.busy) return;
      this.busy = true;
      r.capNext = { k: PM.SCALE, cb: (img) => this.save(img) };
      if (g.audio) g.audio.play('click');
    }
    save(img) {
      const g = this.g, done = () => { this.busy = false; };
      if (!img || typeof document === 'undefined') { g.ui.hint(tx('g.photo.fail', null, '📷 Dieses Foto ging nicht — der Grafikspeicher reicht nicht für die doppelte Größe.', '📷 That photo did not work — the graphics memory is too small for twice the size.'), 3200); done(); return; }
      const m = g.meta || {}; m.photoN = (m.photoN | 0) + 1;
      const name = PM.fileName(m.name, m.photoN);
      const c = document.createElement('canvas'); c.width = img.w; c.height = img.h;
      const ctx = c.getContext('2d'), id = ctx.createImageData(img.w, img.h), row = img.w * 4;
      for (let y = 0; y < img.h; y++) id.data.set(img.data.subarray((img.h - 1 - y) * row, (img.h - y) * row), y * row);   // (GL reads bottom-up)
      ctx.putImageData(id, 0, 0);
      c.toBlob((blob) => {
        if (!blob) { done(); return; }
        const url = URL.createObjectURL(blob);
        let shown = false;
        /*DL*/let embedded = true; try { embedded = window.self !== window.top; } catch (e) { embedded = true; }
        if (!embedded) { try { const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); shown = true; } catch (e) { shown = false; } }/*/DL*/
        if (!shown && g.ui.showShot) g.ui.showShot(url);
        if (g.ui.toast) g.ui.toast('📷 ' + tx('g.photo.saved', { n: name, w: img.w, h: img.h }, 'Gespeichert: {n} ({w} × {h})', 'Saved: {n} ({w} × {h})'), '', null);
        PM.last = { name, w: img.w, h: img.h, bytes: blob.size, url };
        setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) { /* */ } }, 60000);   // (the overlay closes after 10 s)
        if (g.saveMeta) { try { g.saveMeta(); } catch (e) { /* */ } }
        done();
      }, 'image/png');
    }
  }
  PM.Photo = Photo;

  // ---- hooks into game.js: photoMode(on) opens the free camera (unless the photo drone has the view)
  const G = VR.Game; if (!G) return;
  const orig = G.prototype.photoMode;
  G.prototype.photoMode = function (on) {
    orig.call(this, on);
    if (!this.photoCam) this.photoCam = new Photo(this);
    if (on && !(this.gadgets && this.gadgets.drone) && this.state === 'play' && this.player) this.photoCam.enter();
    else if (!on) this.photoCam.leave();
  };
  // (a world that goes ends the mode: its look and its keys belong to that world)
  const origTear = G.prototype.teardownWorld;
  G.prototype.teardownWorld = function () { if (this.photo || (this.photoCam && this.photoCam.on)) { try { this.photoMode(false); } catch (e) { /* */ } } return origTear.call(this); };
})(VR);
