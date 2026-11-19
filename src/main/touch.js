// ============================================================================
// 👆 Touch layer and gamepad menus (F5 · Steuerung, the W3 phase of the all-ages
// spec): on a touch screen (Steuerung → Bedienung mit dem Finger: auto, an, aus)
// a left virtual stick walks, a drag on the picture still turns the view (the
// canvas handler in input.js), and five big buttons jump, place, break, open the
// inventory and sprint. The buttons only ever write the input's touch sets, so the
// keyboard and the pad keep working. PadNav moves the focus over the visible
// buttons of an open menu with the D-pad and presses A; B goes back (Escape).
// VR.Touch.wanted(S) · mount(game) · frame(game) · VR.PadNav.frame(game)
// ============================================================================
(function (VR) {
  'use strict';
  const TOUCH = VR.Touch = {};
  const T = (k, v, fb) => (VR.I18N ? VR.I18N.t(k, v, fb) : (fb !== undefined ? fb : k));
  const R = 56;          // the stick's travel in pixels
  let root = null, stick = null, knob = null, game = null, sid = null, origin = null, zone = null, sprinting = false;
  // ---- Handy-Steuerung 2 (v0.55.72): the picture itself is the tool — tap places (or uses), a finger held still breaks
  // for as long as it stays (aiming while it mines), a drag turns; the stick floats under the left thumb wherever it lands
  // and sprints when pushed to its rim. Style „Gesten" (default) or „Tasten" (the place / break / sprint buttons as before)
  TOUCH.HOLD_MS = 260; TOUCH.TAP_PX = 12; TOUCH.SPRINT_K = 0.9;
  TOUCH.classify = (ms, moved, holding) => (holding ? 'hold' : moved >= TOUCH.TAP_PX ? 'drag' : ms >= TOUCH.HOLD_MS ? 'hold' : 'tap');
  TOUCH.sprintAt = (len) => len >= TOUCH.SPRINT_K;
  TOUCH.styleOf = (S) => (S && S.touchStyle === 'tasten' ? 'tasten' : 'gesten');
  if (VR.Settings && VR.Settings.add) VR.Settings.add({ key: 'touchStyle', g: 'play', sec: 'steer', t: 'choice', lab: 'g.set.touchStyle', tip: 'g.set.touchStyle.tip', def: 'gesten', opts: [['gesten', 'g.set.touchStyle.gesten', 'g.set.touchStyle.gesten.tip'], ['tasten', 'g.set.touchStyle.tasten', 'g.set.touchStyle.tasten.tip']] });
  if (VR.Settings && VR.Settings.add) VR.Settings.add({ key: 'haptics', g: 'play', sec: 'steer', t: 'switch', lab: 'g.set.haptics', tip: 'g.set.haptics.tip', def: true });
  // the ring under a held finger (it mines there)
  let ringEl = null;
  TOUCH.ring = function (x, y, on) {
    if (typeof document === 'undefined') return;
    if (!ringEl) { ringEl = document.createElement('div'); ringEl.id = 'tRing'; (document.getElementById('ui') || document.body).appendChild(ringEl); }
    ringEl.classList.toggle('on', !!on);
    if (on) { ringEl.style.left = x + 'px'; ringEl.style.top = y + 'px'; }
  };
  TOUCH.buzz = function (ms) { try { if (game && game.settings && game.settings.haptics === false) return; if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* no vibration */ } };
  TOUCH.wanted = function (S) {
    const v = S && S.touch;
    if (v === 'on') return true;
    if (v === 'off') return false;
    return (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) || (typeof window !== 'undefined' && 'ontouchstart' in window);
  };
  // the five buttons: id, icon, label key, what they do (the input's sets, the mouse buttons)
  const BUTTONS = [
    { id: 'jump', icon: '⤒', k: 'touch.jump', fb: 'Springen', en: 'Jump', cls: 'tb-jump' },
    { id: 'place', icon: '🧱', k: 'touch.place', fb: 'Setzen', en: 'Place', cls: 'tb-place' },
    { id: 'break', icon: '⛏', k: 'touch.break', fb: 'Abbauen', en: 'Break', cls: 'tb-break' },
    { id: 'inv', icon: '🎒', k: 'touch.inv', fb: 'Inventar', en: 'Inventory', cls: 'tb-inv' },
    { id: 'sprint', icon: '🏃', k: 'touch.sprint', fb: 'Sprint', en: 'Sprint', cls: 'tb-sprint' },
    { id: 'veh', icon: '◉', k: 'touch.act', fb: 'Aktion', en: 'Action', cls: 'tb-act' },   // e-ctx: the round Aktion button — its icon follows the action (ctx.js)
  ];
  TOUCH.mount = function (g) {
    game = g;
    if (typeof document === 'undefined' || document.getElementById('touch')) return;
    root = document.createElement('div');
    root.id = 'touch'; root.setAttribute('role', 'group'); root.setAttribute('aria-label', 'Touch');
    root.style.display = 'none';
    // the left thumb's zone: the stick appears where it lands
    zone = document.createElement('div'); zone.id = 'tZone'; root.appendChild(zone);
    const menu = document.createElement('button'); menu.type = 'button'; menu.id = 'tMenu'; menu.className = 'tb tb-menu';
    menu.innerHTML = '<span class="ti" aria-hidden="true">☰</span>'; menu.setAttribute('aria-label', T('touch.menu', null, 'Menü'));
    menu.addEventListener('pointerdown', (e) => { e.preventDefault(); if (game && game.ui && game.ui.pause) game.ui.pause(); });
    root.appendChild(menu);
    stick = document.createElement('div'); stick.id = 'tStick'; stick.className = 'tstick'; stick.innerHTML = '<i></i>';
    knob = stick.querySelector('i');
    root.appendChild(stick);
    const bar = document.createElement('div'); bar.className = 'tbtns';
    for (const b of BUTTONS) {
      const e = document.createElement('button'); e.type = 'button'; e.className = 'tb ' + b.cls; e.dataset.b = b.id;
      e.innerHTML = `<span class="ti" aria-hidden="true">${b.icon}</span><span class="tl">${T(b.k, null, b.fb)}</span>`;
      e.setAttribute('aria-label', T(b.k, null, b.fb));
      wireButton(e, b.id);
      bar.appendChild(e);
    }
    root.appendChild(bar);
    (document.getElementById('ui') || document.body).appendChild(root);
    wireStick();
    // a tap on a hotbar slot picks it (the number keys of a phone)
    const hb = document.getElementById('hotbar');
    if (hb) hb.addEventListener('pointerdown', (e) => {
      if (!TOUCH.wanted(game && game.settings)) return;
      const sl = e.target && e.target.closest ? e.target.closest('.slot') : null; if (!sl || !game || !game.player) return;
      const i = Array.prototype.indexOf.call(hb.querySelectorAll('.slot'), sl); if (i < 0) return;
      game.player.inv.sel = i; game.player.inv.changed = true; TOUCH.buzz(6); e.preventDefault();
    });
  };
  function input() { return game && game.input; }
  function wireStick() {
    // the stick floats: wherever the left thumb lands in the zone (or on the stick itself), that is its middle
    const down = (src) => (e) => {
      if (sid !== null) return;
      sid = e.pointerId; origin = { x: e.clientX, y: e.clientY }; stick.classList.add('on');
      const zr = root.getBoundingClientRect();
      stick.style.left = (e.clientX - zr.left - stick.offsetWidth / 2) + 'px'; stick.style.top = (e.clientY - zr.top - stick.offsetHeight / 2) + 'px'; stick.style.bottom = 'auto';
      try { src.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
      moveStick(e);
      e.preventDefault();
    };
    const move = (e) => { if (e.pointerId === sid) { moveStick(e); e.preventDefault(); } };
    const end = (e) => {
      if (e.pointerId !== sid) return;
      sid = null; origin = null; stick.classList.remove('on'); knob.style.transform = ''; stick.style.left = ''; stick.style.top = ''; stick.style.bottom = '';
      const i = input(); if (i) { i.touchMove = { fwd: 0, str: 0 }; if (sprinting) { sprinting = false; if (i.tRelease) i.tRelease.add('sprint'); else i.tDown.delete('sprint'); } }
    };
    for (const el of [stick, zone]) { el.addEventListener('pointerdown', down(el)); el.addEventListener('pointermove', move); el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); }
  }
  function moveStick(e) {
    const dx = Math.max(-R, Math.min(R, e.clientX - origin.x)), dy = Math.max(-R, Math.min(R, e.clientY - origin.y));
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const i = input(); if (!i || !VR.Pad) return;
    // the same dead zone as the pad; up is forward
    const v = VR.Pad.stick(dx / R, dy / R);
    i.touchMove = { fwd: -v[1], str: v[0] };
    // Gesten: pushed to the rim, forward, it sprints (no button needed); the knob glows
    const len = Math.hypot(dx, dy) / R, sp = TOUCH.styleOf(game && game.settings) === 'gesten' && TOUCH.sprintAt(len) && -v[1] > 0.5;
    if (sp !== sprinting) { sprinting = sp; if (sp) { i.tDown.add('sprint'); i.tPressed.add('sprint'); TOUCH.buzz(8); } else if (i.tRelease) i.tRelease.add('sprint'); else i.tDown.delete('sprint'); }
    stick.classList.toggle('sprint', sp);
  }
  function wireButton(e, id) {
    const press = (ev) => {
      ev.preventDefault();
      const i = input(); if (!i) return;
      e.classList.add('on');
      if (id === 'jump' || id === 'sprint') { i.tDown.add(id === 'jump' ? 'jump' : 'sprint'); i.tPressed.add(id === 'jump' ? 'jump' : 'sprint'); }
      if (id === 'veh') { i.tDown.add('veh'); i.tPressed.add('veh'); }   // e-ctx
      if (id === 'inv') i.tPressed.add('inv');
      if (id === 'place') { i.mouse.down[2] = true; i.mouse.clicked[2] = true; }
      if (id === 'break') { i.mouse.down[0] = true; i.mouse.clicked[0] = true; }
    };
    const release = (ev) => {
      ev.preventDefault();
      const i = input(); e.classList.remove('on'); if (!i) return;
      if (id === 'jump' || id === 'sprint') { const a = id === 'jump' ? 'jump' : 'sprint'; if (i.tRelease) i.tRelease.add(a); else i.tDown.delete(a); }   // (let go at the frame's end: a tap still counts)
      if (id === 'veh') { if (i.tRelease) i.tRelease.add('veh'); else i.tDown.delete('veh'); }   // e-ctx (held: the Heimkehr ring)
      if (id === 'place') { i.mouse.down[2] = false; i.mouse.releasedBtn[2] = true; }
      if (id === 'break') { i.mouse.down[0] = false; i.mouse.releasedBtn[0] = true; }
    };
    e.addEventListener('pointerdown', press);
    e.addEventListener('pointerup', release);
    e.addEventListener('pointercancel', release);
    e.addEventListener('pointerleave', (ev) => { if (ev.buttons === 0 && e.classList.contains('on')) release(ev); });
    e.addEventListener('contextmenu', (ev) => ev.preventDefault());
  }
  // once per frame: the layer shows in a game with no menu open, when the setting asks for it
  TOUCH.frame = function (g) {
    if (!root || !g) return;
    const open = !!(g.ui && g.ui.screen);
    const on = g.state === 'play' && !open && TOUCH.wanted(g.settings);
    if (root.style.display !== (on ? '' : 'none')) root.style.display = on ? '' : 'none';
    const ges = TOUCH.styleOf(g.settings) === 'gesten'; if (root.classList.contains('gesten') !== ges) root.classList.toggle('gesten', ges);
    if (root.parentNode && root.parentNode.classList.contains('touchon') !== on) root.parentNode.classList.toggle('touchon', on);   // the hotbar moves up (controls.css)
    if (!on && input()) input().touchMove = { fwd: 0, str: 0 };
  };

  // ---- gamepad in menus: the D-pad moves the focus over the visible buttons, A presses, B goes back (Escape)
  const PN = VR.PadNav = {};
  let cur = null;
  function focusables() {
    if (typeof document === 'undefined') return [];
    const list = Array.from(document.querySelectorAll('#title button, #ui .screen.on button'));
    return list.filter(b => !b.disabled && b.getClientRects().length > 0 && b.offsetWidth > 0 && b.offsetHeight > 0 && !(b.closest && b.closest('#touch')));
  }
  PN.frame = function (g) {
    const i = g && g.input, pad = i && i.pad;
    if (!pad || !pad.connected || typeof document === 'undefined') return;
    const open = !!(g.ui && g.ui.screen) || g.state !== 'play';
    if (!open) { cur = null; return; }
    const els = focusables();
    if (!els.length) return;
    let k = els.indexOf(cur);
    if (k < 0) { const a = els.indexOf(document.activeElement); k = a >= 0 ? a : 0; }
    for (const d of pad.dpad) {
      const rects = els.map(e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
      k = VR.Pad.navNearest(rects, k, d);
    }
    cur = els[k];
    for (const e of els) e.classList.toggle('padfocus', e === cur);
    if (cur && document.activeElement !== cur) { try { cur.focus({ preventScroll: true }); } catch (err) { /* no focus */ } }
    if (pad.menu.indexOf('ok') >= 0 && cur) cur.click();
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
