// ============================================================================
// Input: keyboard (through the player's key bindings, binds.js), mouse (pointer
// lock with drag-to-look fallback, raw movement, optional smoothing), wheel,
// touch (one finger look; the on-screen layer in touch.js), gamepad (pad.js).
// The game asks for its default key names (input.down('KeyW')); a name owned by a
// rebound action is translated to the keys the player chose (codesFor).
// ============================================================================
(function (VR) {
  'use strict';
  const LOOK_PAD = 1400;   // the right stick at full push turns the view by this many "mouse pixels" a second
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
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
      this.raw = true;               // raw mouse movement (no OS acceleration) when the browser allows it
      this.smooth = false;           // mouse smoothing (F5, off by default)
      this.smX = 0; this.smY = 0;
      this.lastTap = {};
      this.doubleTap = new Set();
      this.enabled = true;
      this.lockFailed = false;       // permanent: pointer lock not available at all
      this.lockFails = 0;            // consecutive failed attempts (a click retries)
      this.dragStart = null;
      // actions and keys that do not come from the keyboard: the gamepad and the touch layer name an action id
      this.padDown = new Set(); this.padPressed = new Set();   // the gamepad's held and pressed actions (by action id)
      this.tDown = new Set(); this.tPressed = new Set();       // the touch layer's (by action id)
      this.vPhys = new Set();                                 // physical names pressed by the pad (Start = Escape)
      this.touchMove = { fwd: 0, str: 0 };                     // the touch stick, set by touch.js
      this.padMove = { fwd: 0, str: 0 };
      this.padPrev = null; this.pad = null; this.padHeld = [false, false, false];
      this.menuOpen = false;         // set by the game: menus take the pad as focus moves, not as game keys
      this.capture = null;           // the next key goes to this callback (the key-binding screen)
      this.bind();
    }
    bind() {
      const c = this.canvas;
      window.addEventListener('keydown', (e) => {
        if (!this.enabled) return;
        const tgt = e.target;
        if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA')) return;
        const k = e.code;
        if (this.capture) { const cb = this.capture; this.capture = null; e.preventDefault(); cb(k); return; }
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
      window.addEventListener('blur', () => { this.keys.clear(); this.mouse.down = [false, false, false]; this.padDown.clear(); this.tDown.clear(); this.padHeld = [false, false, false]; });
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
        // a lock that arrives after the game stopped wanting the mouse (a request made just before the wizard or a screen
        // opened: the ring's ✨ closes the hand first) is given back at once, or the pointer is locked under the open dialog
        if (this.locked && !this.captured) { this.locked = false; document.exitPointerLock(); return; }
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
    // ---- the names the game asks for, through the player's bindings (VR.Binds.current)
    // a name owned by an action is answered by that action's keys, and by the pad or the touch layer naming the action;
    // any other name (Escape, Enter, F12 …) is the physical key itself, as before (and the pad's Start is Escape)
    anyOf(name, set, a1, a2, pset) {
      const B = VR.Binds, b = B && B.current;
      const codes = b ? b.codesFor(name) : null;
      if (codes === null) return set.has(name) || (!!pset && pset.has(name));
      for (const c of codes) if (set.has(c)) return true;
      const id = B.byName(name);
      if (id && ((a1 && a1.has(id)) || (a2 && a2.has(id)))) return true;
      return !!pset && pset.has(name);
    }
    down(k) { return this.anyOf(k, this.keys, this.padDown, this.tDown, this.vPhys); }
    hit(k) { return this.anyOf(k, this.pressed, this.padPressed, this.tPressed, this.vPhys); }
    dbl(k) { return this.anyOf(k, this.doubleTap, null, null, null); }
    // the next key pressed goes to cb (the key-binding screen); cb gets e.code, Escape cancels there
    captureNext(cb) { this.capture = cb; }
    cancelCapture() { this.capture = null; }
    // ---- pointer lock: raw movement first, the plain request when the platform refuses raw
    requestLock() {
      if (this.locked || this.lockFailed) return;
      if (!this.canvas.requestPointerLock) { this.lockFailed = true; this.dragLook = true; return; }
      const stamp = this.lockReq = (this.lockReq || 0) + 1;
      const plain = () => { try { const q = this.canvas.requestPointerLock(); if (q && q.catch) q.catch(() => { if (stamp === this.lockReq) this.failLock(); }); } catch (e) { this.failLock(); } };
      try {
        const p = this.raw ? this.canvas.requestPointerLock({ unadjustedMovement: true }) : this.canvas.requestPointerLock();
        if (p && p.catch) p.catch((err) => { if (stamp !== this.lockReq) return; if (this.raw && err && err.name === 'NotSupportedError') { this.raw = false; plain(); } else this.failLock(); });
      } catch (e) {
        if (this.raw) { this.raw = false; plain(); } else this.failLock();
      }
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
    // ---- once per frame, before the game reads the input: smoothing, the gamepad, the stick look, the touch stick
    beginFrame(dt) {
      const k = clamp(dt || 0.016, 0, 0.1);
      // mouse smoothing (F5, off by default): an exponential glide on the look delta; the total turn is kept
      if (this.smooth) {
        const a = 1 - Math.exp(-k * 26);
        this.smX += (this.mouse.dx - this.smX) * a; this.smY += (this.mouse.dy - this.smY) * a;
        this.mouse.dx = this.smX; this.mouse.dy = this.smY;
      } else { this.smX = this.mouse.dx; this.smY = this.mouse.dy; }
      let pad = null, list = null;
      if (VR.Pad && typeof navigator !== 'undefined' && navigator.getGamepads) {
        try { list = navigator.getGamepads(); } catch (e) { list = null; }
        pad = this.pad = VR.Pad.poll(list, this.padPrev);
        this.padPrev = pad;
      }
      const menu = this.menuOpen;
      // Start pauses (Escape) in or out of a menu; B goes back in a menu (also Escape)
      if (pad && pad.connected) {
        for (const p of pad.physPressed) this.vPhys.add(p);
        if (menu && pad.menu.indexOf('back') >= 0) this.vPhys.add('Escape');
      }
      const live = !!pad && pad.connected && !menu;     // the pad drives the game only when no menu is open
      this.padDown = live ? new Set(pad.down) : new Set();
      if (live) for (const a of pad.pressed) this.padPressed.add(a);
      for (let b = 0; b < 3; b++) {
        const on = live && !!pad.mouseDown[b];
        if (on && !this.padHeld[b]) { this.mouse.down[b] = true; this.mouse.clicked[b] = true; }
        if (!on && this.padHeld[b]) { this.mouse.down[b] = false; this.mouse.releasedBtn[b] = true; }
        this.padHeld[b] = on;
      }
      if (live) {
        this.mouse.wheel += pad.wheel;
        if (pad.dpad.indexOf('left') >= 0) this.mouse.wheel -= 1;
        if (pad.dpad.indexOf('right') >= 0) this.mouse.wheel += 1;
        this.mouse.dx += pad.look[0] * LOOK_PAD * k; this.mouse.dy += pad.look[1] * LOOK_PAD * k;
      }
      const tm = menu ? { fwd: 0, str: 0 } : (this.touchMove || { fwd: 0, str: 0 });
      const pf = live ? -pad.move[1] : 0, ps = live ? pad.move[0] : 0;
      this.padMove = { fwd: clamp(pf + tm.fwd, -1, 1), str: clamp(ps + tm.str, -1, 1) };
    }
    endFrame() {
      this.pressed.clear(); this.released.clear(); this.doubleTap.clear();
      this.padPressed.clear(); this.tPressed.clear(); this.vPhys.clear();
      this.mouse.dx = 0; this.mouse.dy = 0; this.mouse.wheel = 0;
      this.mouse.clicked = [false, false, false]; this.mouse.releasedBtn = [false, false, false];
    }
  }
  VR.Input = Input;
})(VR);
