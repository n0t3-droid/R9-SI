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
      this.tRelease = new Set();                                // touch buttons let go this frame: they stay down until endFrame, so a tap between two frames still counts
      this.vPhys = new Set();                                 // physical names pressed by the pad (Start = Escape)
      this.touchMove = { fwd: 0, str: 0 };                     // the touch stick, set by touch.js
      this.padMove = { fwd: 0, str: 0 };
      this.padPrev = null; this.pad = null; this.padHeld = [false, false, false];
      this.menuOpen = false;         // set by the game: menus take the pad as focus moves, not as game keys
      this.capture = null;           // the next key goes to this callback (the key-binding screen)
      // 🚀 piloting a ship: the pad answers flight.js's own key names (VR.Pad.ship), held and pressed this frame
      this.shipPad = { keys: [], mouse: [false, false, false] }; this.shipDown = new Set(); this.shipPressed = new Set();
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
      window.addEventListener('blur', () => { this.keys.clear(); this.mouse.down = [false, false, false]; this.padDown.clear(); this.tDown.clear(); this.shipDown.clear(); this.padHeld = [false, false, false]; });
      c.addEventListener('contextmenu', (e) => e.preventDefault());
      c.addEventListener('mousedown', (e) => {
        if (!this.enabled) return;
        if (this.lastTouchT && performance.now() - this.lastTouchT < 900) return;   // (the mouse a browser fakes after a touch: the touch handled it)
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
      // touch (Handy-Steuerung 2, touch.js): a drag turns; a short tap places or uses (the right button); a finger held
      // still for TOUCH.HOLD_MS breaks (the left button held) for as long as it stays — moving it then aims while it mines
      let touch = null;
      const TO = () => VR.Touch || { HOLD_MS: 260, TAP_PX: 12, ring() {}, buzz() {} };
      const aimAt = (x, y) => { const r = c.getBoundingClientRect(); this.touchAim = { nx: ((x - r.left) / r.width) * 2 - 1, ny: 1 - ((y - r.top) / r.height) * 2 }; };   // (the ray goes through the finger, not the crosshair)
      const holdStart = () => { if (!touch || touch.hold || touch.moved >= TO().TAP_PX) return; touch.hold = true; this.mouse.down[0] = true; this.mouse.clicked[0] = true; TO().ring(touch.cx, touch.cy, true); TO().buzz(12); };
      c.addEventListener('touchstart', (e) => { this.lastTouchT = performance.now(); if (!this.captured) { const g = VR.game; if (g && g.state === 'play' && g.ui && !g.ui.blocking) this.captured = true; else return; }   // (a finger on the picture in a game is always the game's: no lock to ask for)
       const t = e.changedTouches[0]; if (touch) return; touch = { id: t.identifier, x: t.clientX, y: t.clientY, cx: t.clientX, cy: t.clientY, t: performance.now(), moved: 0, hold: false }; this.touchActive = true; this.holdCheck = holdStart; this.tch = touch; aimAt(t.clientX, t.clientY); e.preventDefault(); }, { passive: false });
      c.addEventListener('touchmove', (e) => { if (!touch) return; for (const t of e.changedTouches) if (t.identifier === touch.id) { const dx = t.clientX - touch.x, dy = t.clientY - touch.y; this.mouse.dx += dx * 1.5; this.mouse.dy += dy * 1.5; touch.moved += Math.abs(dx) + Math.abs(dy); touch.x = t.clientX; touch.y = t.clientY; if (touch.hold) { TO().ring(t.clientX, t.clientY, true); aimAt(t.clientX, t.clientY); } } e.preventDefault(); }, { passive: false });
      const tEnd = (e) => {
        if (!touch) return;
        let mine = !e.touches || e.touches.length === 0; for (const t of e.changedTouches) if (t.identifier === touch.id) mine = true;   // (no finger left: ours ended too)
        if (!mine) return;
        if (touch.hold) { this.mouse.down[0] = false; this.mouse.releasedBtn[0] = true; TO().ring(0, 0, false); }
        else if (touch.moved < TO().TAP_PX) { this.mouse.clicked[2] = true; TO().buzz(6); }
        else this.touchAim = null;   // (a drag: the look moved, nothing to aim)
        touch = null; this.tch = null; this.touchActive = false;
      };
      c.addEventListener('touchend', tEnd); c.addEventListener('touchcancel', tEnd);
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
    down(k) { return this.anyOf(k, this.keys, this.padDown, this.tDown, this.vPhys) || (this.shipDown.size !== 0 && this.shipDown.has(k)); }
    hit(k) { return this.anyOf(k, this.pressed, this.padPressed, this.tPressed, this.vPhys) || (this.shipPressed.size !== 0 && this.shipPressed.has(k)); }
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
      // (Handy-Steuerung 2: a finger held still becomes a hold here, at a frame's start — after any touchend that came in)
      if (this.tch && !this.tch.hold && this.holdCheck && performance.now() - this.tch.t >= ((VR.Touch && VR.Touch.HOLD_MS) || 260)) this.holdCheck();
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
      // 🚀 in a ship the pad flies it (VR.Pad.ship): flight.js's key names, RB / R3 the mouse buttons; the walking
      // actions, the walk stick and the hotbar wait until the player gets out (Start and the look stick stay)
      const ship = live && !!(VR.game && VR.game.flight) && !!VR.Pad.ship;
      this.padDown = live && !ship ? new Set(pad.down) : new Set();
      if (live && !ship) for (const a of pad.pressed) this.padPressed.add(a);
      const sp = this.shipPad;
      if (ship) VR.Pad.ship(pad, sp); else { sp.keys.length = 0; sp.mouse[0] = false; sp.mouse[1] = false; sp.mouse[2] = false; }
      for (let i = 0; i < sp.keys.length; i++) if (!this.shipDown.has(sp.keys[i])) this.shipPressed.add(sp.keys[i]);
      this.shipDown.clear(); for (let i = 0; i < sp.keys.length; i++) this.shipDown.add(sp.keys[i]);
      for (let b = 0; b < 3; b++) {
        const on = live && !!(ship ? sp.mouse[b] : pad.mouseDown[b]);
        if (on && !this.padHeld[b]) { this.mouse.down[b] = true; this.mouse.clicked[b] = true; }
        if (!on && this.padHeld[b]) { this.mouse.down[b] = false; this.mouse.releasedBtn[b] = true; }
        this.padHeld[b] = on;
      }
      if (live) {
        if (!ship) {
          this.mouse.wheel += pad.wheel;
          if (pad.dpad.indexOf('left') >= 0) this.mouse.wheel -= 1;
          if (pad.dpad.indexOf('right') >= 0) this.mouse.wheel += 1;
        }
        this.mouse.dx += pad.look[0] * LOOK_PAD * k; this.mouse.dy += pad.look[1] * LOOK_PAD * k;
      }
      const tm = menu ? { fwd: 0, str: 0 } : (this.touchMove || { fwd: 0, str: 0 });
      const pf = live && !ship ? -pad.move[1] : 0, ps = live && !ship ? pad.move[0] : 0;
      this.padMove = { fwd: clamp(pf + tm.fwd, -1, 1), str: clamp(ps + tm.str, -1, 1) };
      if (VR.A11y && VR.A11y.inputFrame) VR.A11y.inputFrame(this, k);   // e-access: the device in use, the one-hand modes
    }
    endFrame() {
      if (this.touchAim && !this.touchActive && !this.mouse.down[0]) this.touchAim = null;   // (the tap's aim lives until its click was played)
      if (this.tRelease.size) { for (const id of this.tRelease) this.tDown.delete(id); this.tRelease.clear(); }
      this.pressed.clear(); this.released.clear(); this.doubleTap.clear();
      this.padPressed.clear(); this.tPressed.clear(); this.vPhys.clear(); this.shipPressed.clear();
      this.mouse.dx = 0; this.mouse.dy = 0; this.mouse.wheel = 0;
      this.mouse.clicked = [false, false, false]; this.mouse.releasedBtn = [false, false, false];
    }
  }
  VR.Input = Input;
})(VR);
