// ============================================================================
// Input: keyboard, mouse (pointer lock with drag-to-look fallback), wheel, touch, gamepad
// ============================================================================
(function (VR) {
  'use strict';
  class Input {
    constructor(canvas) {
      this.canvas = canvas;
      this.keys = new Set();
      this.pressed = new Set();     // keys pressed this frame
      this.released = new Set();
      this.mouse = { dx: 0, dy: 0, buttons: 0, down: [false, false, false], clicked: [false, false, false], releasedBtn: [false, false, false], wheel: 0, x: 0, y: 0 };
      this.locked = false;
      this.dragLook = false;         // fallback when pointer lock is unavailable
      this.captured = false;         // game wants mouse input
      this.sensitivity = 0.0024;
      this.invertY = false;
      this.lastTap = {};
      this.doubleTap = new Set();
      this.enabled = true;
      this.lockFailed = false;       // permanent: pointer lock not available at all
      this.lockFails = 0;            // consecutive failed attempts (a click retries)
      this.dragStart = null;
      this.padKeys = new Set(); this.padBtn = [false, false, false]; this.padT = 0; this.padActive = false;
      this.bind();
    }
    bind() {
      const c = this.canvas;
      window.addEventListener('keydown', (e) => {
        if (!this.enabled) return;
        const tgt = e.target;
        if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA')) return;
        const k = e.code;
        if (!this.keys.has(k)) {
          this.pressed.add(k);
          const now = performance.now();
          if (this.lastTap[k] && now - this.lastTap[k] < 280) this.doubleTap.add(k);
          this.lastTap[k] = now;
        }
        this.keys.add(k);
        if (this.captured && (k === 'Space' || k.startsWith('Arrow') || k === 'Tab' || k === 'F3' || k === 'F1' || k === 'F2' || k === 'F5' || k === 'Slash' || (e.ctrlKey && (k === 'KeyW' || k === 'KeyS' || k === 'KeyD')))) e.preventDefault();
      });
      window.addEventListener('keyup', (e) => { this.keys.delete(e.code); this.released.add(e.code); });
      window.addEventListener('blur', () => { this.keys.clear(); this.mouse.down = [false, false, false]; });
      c.addEventListener('contextmenu', (e) => e.preventDefault());
      c.addEventListener('mousedown', (e) => {
        if (!this.enabled) return;
        // a click on the game always tries to (re)capture the mouse; drag-look is only a temporary fallback
        if (!this.locked && this.captured && !this.lockFailed) this.requestLock();
        this.mouse.down[e.button] = true; this.mouse.clicked[e.button] = true;
        this.dragStart = { x: e.clientX, y: e.clientY, moved: 0 };
        e.preventDefault();
      });
      window.addEventListener('mouseup', (e) => { this.mouse.down[e.button] = false; this.mouse.releasedBtn[e.button] = true; });
      window.addEventListener('mousemove', (e) => {
        this.mouse.x = e.clientX; this.mouse.y = e.clientY;
        if (!this.enabled || !this.captured) return;
        if (this.locked) { this.mouse.dx += e.movementX; this.mouse.dy += e.movementY; }
        else if (this.dragLook && (this.mouse.down[0] || this.mouse.down[2])) {
          this.mouse.dx += e.movementX * 1.2; this.mouse.dy += e.movementY * 1.2;
          if (this.dragStart) this.dragStart.moved += Math.abs(e.movementX) + Math.abs(e.movementY);
        }
      });
      c.addEventListener('wheel', (e) => { if (this.captured) { this.mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); } }, { passive: false });
      document.addEventListener('pointerlockchange', () => {
        this.locked = document.pointerLockElement === this.canvas;
        if (this.locked) { this.dragLook = false; this.lockFails = 0; this.lockFailed = false; }
        if (this.onLockChange) this.onLockChange(this.locked);
      });
      document.addEventListener('pointerlockerror', () => { this.failLock(); });
      // touch: one finger look, two finger tap = place
      let touch = null;
      c.addEventListener('touchstart', (e) => { if (!this.captured) return; const t = e.changedTouches[0]; touch = { id: t.identifier, x: t.clientX, y: t.clientY, t: performance.now(), moved: 0 }; e.preventDefault(); }, { passive: false });
      c.addEventListener('touchmove', (e) => { if (!touch) return; for (const t of e.changedTouches) if (t.identifier === touch.id) { const dx = t.clientX - touch.x, dy = t.clientY - touch.y; this.mouse.dx += dx * 1.5; this.mouse.dy += dy * 1.5; touch.moved += Math.abs(dx) + Math.abs(dy); touch.x = t.clientX; touch.y = t.clientY; } e.preventDefault(); }, { passive: false });
      c.addEventListener('touchend', (e) => { if (touch && touch.moved < 10) { this.mouse.clicked[performance.now() - touch.t > 350 ? 0 : 2] = true; } touch = null; });
    }
    requestLock() {
      if (this.locked || this.lockFailed) return;
      if (!this.canvas.requestPointerLock) { this.lockFailed = true; this.dragLook = true; return; }
      const stamp = this.lockReq = (this.lockReq || 0) + 1;
      try {
        const p = this.canvas.requestPointerLock();
        if (p && p.catch) p.catch(() => { if (stamp === this.lockReq) this.failLock(); });
      } catch (e) { this.failLock(); }
      setTimeout(() => { if (stamp === this.lockReq && !this.locked && this.captured) this.failLock(true); }, 700);
    }
    // a refused lock (no user gesture yet, browser cooldown, iframe policy…) only switches to drag-to-look
    // for now — the next click on the game grabs the mouse again. Only repeated hard errors give up for good.
    failLock(soft) {
      this.dragLook = true;
      if (!soft) this.lockFails++;
      if (this.lockFails >= 5) this.lockFailed = true;
      if (this.onLockChange) this.onLockChange(false, true);
    }
    releaseLock() { if (document.pointerLockElement) document.exitPointerLock(); }
    down(k) { return this.keys.has(k); }
    hit(k) { return this.pressed.has(k); }
    dbl(k) { return this.doubleTap.has(k); }
    // a click counts as action; in drag-look mode only if the mouse barely moved
    clickAction(b) {
      if (!this.mouse.releasedBtn[b] && !this.mouse.clicked[b]) return false;
      if (this.dragLook) return this.mouse.releasedBtn[b] && (!this.dragStart || this.dragStart.moved < 6);
      return this.mouse.clicked[b];
    }
    holdAction(b) {
      if (this.dragLook) return this.mouse.down[b] && this.dragStart && this.dragStart.moved < 6 && performance.now() - (this.dragStartT || 0) > 0;
      return this.mouse.down[b];
    }
    endFrame() {
      this.pressed.clear(); this.released.clear(); this.doubleTap.clear();
      this.mouse.dx = 0; this.mouse.dy = 0; this.mouse.wheel = 0;
      this.mouse.clicked = [false, false, false]; this.mouse.releasedBtn = [false, false, false];
      // the gamepad's state for the next frame
      try { this.pollPad(); } catch (e) { this.pollPad = () => { }; }
    }
    // ---- gamepad (standard mapping): sticks and buttons become the keys and mouse moves the game reads anyway.
    // On foot: left stick walks (WASD), right stick looks, A jump, B sneak, RT break / use, LT place, X inventory (E),
    // Y camera (F5), LB drop (Q), d-pad left/right the hotbar (wheel), Start pauses.
    // In a ship: left stick turns (A/D) and climbs (Space/Shift), RT/LT push the throttle (W/S), the right stick looks
    // around the cockpit (click it to re-centre), A boost (B), B hover (X), X gear (F), Y view (C), LB look back (Q),
    // RB the left mouse button (the control you aim at, or the guns), d-pad: up autopilot (G), down land / get out (V),
    // left lights (L), right ramp (R).
    pollPad() {
      const list = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : null;
      let gp = null; if (list) for (const p of list) if (p && p.connected && p.buttons && p.buttons.length >= 16) { gp = p; break; }
      const now = performance.now(), dt = Math.min(0.1, Math.max(0, (now - (this.padT || now)) / 1000)); this.padT = now;
      const want = new Set(), btn = [false, false, false];
      if (gp && this.captured && this.enabled) {
        const B = (i) => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.4)), ax = (i) => { const v = gp.axes[i] || 0; return Math.abs(v) < 0.18 ? 0 : v; };
        const ship = !!(VR.game && VR.game.flight), lx = ax(0), ly = ax(1), rx = ax(2), ry = ax(3);
        if (lx || ly || rx || ry || gp.buttons.some(b => b && b.pressed)) this.padActive = true;
        if (ship) {
          if (lx < -0.45) want.add('KeyA'); if (lx > 0.45) want.add('KeyD');
          if (ly < -0.45) want.add('Space'); if (ly > 0.45) want.add('ShiftLeft');
          if (B(7)) want.add('KeyW'); if (B(6)) want.add('KeyS');
          if (B(0)) want.add('KeyB'); if (B(1)) want.add('KeyX'); if (B(2)) want.add('KeyF'); if (B(3)) want.add('KeyC'); if (B(4)) want.add('KeyQ');
          if (B(12)) want.add('KeyG'); if (B(13)) want.add('KeyV'); if (B(14)) want.add('KeyL'); if (B(15)) want.add('KeyR');
          if (B(5)) btn[0] = true; if (B(11)) btn[1] = true;
        } else {
          if (lx < -0.45) want.add('KeyA'); if (lx > 0.45) want.add('KeyD'); if (ly < -0.45) want.add('KeyW'); if (ly > 0.45) want.add('KeyS');
          if (B(0)) want.add('Space'); if (B(1)) want.add('ShiftLeft'); if (B(2)) want.add('KeyE'); if (B(3)) want.add('F5'); if (B(4)) want.add('KeyQ'); if (B(10)) want.add('ControlLeft');
          if (B(7) || B(5)) btn[0] = true; if (B(6)) btn[2] = true;
          if (B(14) && !this.padKeys.has('PadL')) this.mouse.wheel -= 1; if (B(15) && !this.padKeys.has('PadR')) this.mouse.wheel += 1;
          if (B(14)) want.add('PadL'); if (B(15)) want.add('PadR');
        }
        if (B(9)) want.add('Escape');
        // the right stick looks (a curve for fine aim), like a mouse moving
        const k = 950 * dt;
        this.mouse.dx += Math.sign(rx) * Math.pow(Math.abs(rx), 1.7) * k; this.mouse.dy += Math.sign(ry) * Math.pow(Math.abs(ry), 1.7) * k;
      }
      for (const c of want) if (!this.padKeys.has(c)) { this.padKeys.add(c); if (!c.startsWith('Pad')) { this.keys.add(c); this.pressed.add(c); } }
      for (const c of [...this.padKeys]) if (!want.has(c)) { this.padKeys.delete(c); if (!c.startsWith('Pad')) { this.keys.delete(c); this.released.add(c); } }
      for (let b = 0; b < 3; b++) {
        if (btn[b] && !this.padBtn[b]) { this.mouse.down[b] = true; this.mouse.clicked[b] = true; }
        else if (!btn[b] && this.padBtn[b]) { this.mouse.down[b] = false; this.mouse.releasedBtn[b] = true; }
        this.padBtn[b] = btn[b];
      }
    }
  }
  VR.Input = Input;
})(VR);
