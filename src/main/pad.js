// ============================================================================
// 🎮 Gamepad (F5 · Steuerung): the standard layout read each frame, no DOM in
// the mapping itself (tested in node: test/pad_map.js).
//   sticks: left = walk (analog), right = look; a radial dead zone of 0.15
//   A jump · B sneak (menus: back) · X undo · Y inventory · View map · Start pause (Escape)
//   LB / RB turn the hotbar · LT place (right button) · RT break (left button, held)
//   stick click sprint · R3 camera · D-pad: menu focus, and left / right turn the hotbar
// poll(list, prev) → { connected, index, id, move[x,y], look[x,y], down[], pressed[],
//   released[], physPressed[], mouseDown[3], mouseClicked[3], wheel, dpad[], menu[], buttons[] }
// stick(x, y, dz) · rumbleFor(fallBlocks) → { strong, weak, duration } | null
// navNearest(rects, cur, dir) → index of the button the focus moves to (or cur)
// vibrate(plan) plays the plan on the last connected pad that has an actuator
// ============================================================================
(function (VR) {
  'use strict';
  const DZ = 0.15;
  // button index → what it does: an action id (held and pressed), a physical key name, a mouse button, a wheel step,
  // a D-pad direction, or a menu key
  const MAP = {
    0: { act: 'jump', menu: 'ok' },
    1: { act: 'sneak', menu: 'back' },
    2: { act: 'undo' },
    3: { act: 'inv' },
    4: { wheel: -1 },
    5: { wheel: 1 },
    6: { mouse: 2, trig: true },
    7: { mouse: 0, trig: true },
    8: { act: 'map' },
    9: { phys: 'Escape' },
    10: { act: 'sprint' },
    11: { act: 'cam' },
    12: { dpad: 'up' }, 13: { dpad: 'down' }, 14: { dpad: 'left' }, 15: { dpad: 'right' },
  };
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  function stick(x, y, dz) {
    const z = dz === undefined ? DZ : dz;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return [0, 0];
    const m = Math.hypot(x, y);
    if (m <= z || m === 0) return [0, 0];
    const r = Math.min(1, (m - z) / (1 - z));   // the magnitude after the dead zone, 0..1
    return [clamp(x * r / m, -1, 1), clamp(y * r / m, -1, 1)];
  }
  const isDown = (b) => !!b && (b.pressed === true || b.value > 0.5);
  function pickPad(list) {
    if (!list || typeof list.length !== 'number') return null;
    for (let i = 0; i < list.length; i++) {
      const g = list[i];
      if (g && g.connected !== false && Array.isArray(g.buttons)) return g;
    }
    return null;
  }
  // one frame of the pad: the state, with the edges (pressed / released / clicked / wheel / dpad / menu) since prev
  function poll(list, prev) {
    const g = pickPad(list);
    const out = { connected: false, index: -1, id: '', move: [0, 0], look: [0, 0], down: [], pressed: [], released: [], physPressed: [], mouseDown: [false, false, false], mouseClicked: [false, false, false], wheel: 0, dpad: [], menu: [], buttons: [] };
    if (!g) return out;
    const was = (prev && Array.isArray(prev.buttons)) ? prev.buttons : [];
    const ax = Array.isArray(g.axes) ? g.axes : [];
    out.connected = true; out.index = g.index === undefined ? 0 : g.index; out.id = String(g.id || '');
    out.move = stick(ax[0], ax[1]);
    out.look = stick(ax[2], ax[3]);
    const seen = new Set();
    for (let i = 0; i < g.buttons.length && i < 17; i++) {
      const on = isDown(g.buttons[i]);
      out.buttons[i] = on;
      const edge = on && !was[i];
      const fell = !on && !!was[i];
      const m = MAP[i];
      if (on) {
        if (m && m.act) { if (!seen.has(m.act)) { out.down.push(m.act); seen.add(m.act); } }
        if (m && m.mouse !== undefined) out.mouseDown[m.mouse] = true;
      }
      if (!m) continue;
      if (edge) {
        if (m.act) out.pressed.push(m.act);
        if (m.phys) out.physPressed.push(m.phys);
        if (m.mouse !== undefined) out.mouseClicked[m.mouse] = true;
        if (m.wheel) out.wheel += m.wheel;
        if (m.dpad) out.dpad.push(m.dpad);
        if (m.menu) out.menu.push(m.menu);
      }
      if (fell && m.act) out.released.push(m.act);
    }
    return out;
  }
  // the rumble for a landing: nothing for a step, a firmer and longer buzz for a longer fall
  function rumbleFor(h) {
    if (!Number.isFinite(h) || h < 0.9) return null;
    const i = clamp((h - 0.9) / 5, 0.1, 1);
    return { strong: +(0.25 + 0.6 * i).toFixed(3), weak: +(0.15 + 0.5 * i).toFixed(3), duration: Math.round(80 + 120 * i) };
  }
  // the focus moves to the nearest rect in the pressed direction (a 45° cone); no candidate → stay
  function navNearest(rects, cur, dir) {
    if (!Array.isArray(rects) || !rects[cur]) return -1;
    const c = rects[cur], cx = c.x + c.w / 2, cy = c.y + c.h / 2;
    let best = cur, bs = Infinity;
    rects.forEach((r, j) => {
      if (j === cur) return;
      const dx = r.x + r.w / 2 - cx, dy = r.y + r.h / 2 - cy;
      const along = dir === 'right' ? dx : dir === 'left' ? -dx : dir === 'down' ? dy : dir === 'up' ? -dy : 0;
      const across = dir === 'right' || dir === 'left' ? Math.abs(dy) : Math.abs(dx);
      if (along <= 0 || across > along) return;
      const score = along + 2 * across;
      if (score < bs) { bs = score; best = j; }
    });
    return best;
  }
  let last = null;
  function vibrate(plan, index) {
    if (!plan || typeof navigator === 'undefined' || !navigator.getGamepads) return false;
    const list = navigator.getGamepads() || [];
    const g = (index !== undefined && list[index]) || pickPad(list);
    const a = g && g.vibrationActuator;
    if (!a || typeof a.playEffect !== 'function') return false;
    try { a.playEffect('dual-rumble', { startDelay: 0, duration: plan.duration, weakMagnitude: plan.weak, strongMagnitude: plan.strong }); last = g; return true; } catch (e) { return false; }
  }
  VR.Pad = { MAP, DZ, stick, poll, rumbleFor, navNearest, vibrate, pickPad, last: () => last };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
