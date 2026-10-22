// ============================================================================
// Das HUD, das ausblendet (e-ctx; docs/superpowers/specs/2026-10-22-erlebnis-design.md §4, plan docs/superpowers/plans/
// 2026-10-22-e-ctx.md §2.4): the world speaks, the HUD whispers. ⚙ Bild · „Anzeigen am Rand (HUD)" (hudMode):
// Automatisch (default) · Immer · Minimal. Each element of ui.js 85–100 has a rule:
//   hotbar, the item's name   4 s after a slot change, a pickup or a use; while building (Minimal: the slot keys only)
//   hearts, food, air        changed in the last 6 s, below 50 %, under water, a fight, 5 s after entering a world
//   XP bar and level         4 s after a gain
//   minimap and compass      faster than 6 m/s, a target set (a trip, a target in the aim, a waypoint just placed),
//                            8 s after loading, M held
//   crosshair                a small dot; a ring when V has something to do in reach (ctx.js row 4) or a target (row 5)
//   vehicle HUD              hidden in the cockpit view after its 9-s key hint (the instruments say the same)
//   during a trip            the picture is the film: all of it fades (the travel camera's letterbox and its bar speak)
// Never hidden: hearts below 30 %, the air running out (every mode, every trip); the Heimkehr ring, the story chips and
// everything else this file does not manage. CSS classes (hf-off: opacity over 0.35 s); the rules run at 4 Hz and a class
// changes only when its rule does — no DOM work in between.
// VR.HudFade.rules(s, mode) pure (test/hudfade.js) · apply(r) · tick(g, dt) (one hook in game.js) · ELEMENTS
// Cost 🟢 on every preset: two reads a frame (the mouse buttons), the rules four times a second.
// ============================================================================
(function (VR) {
  'use strict';
  const H = VR.HudFade = VR.HudFade || {};
  H.on = true;
  // ---------------------------------------------------------------- the rules (pure)
  H.rules = function (s, mode) {
    const t = s.t, surv = !!s.survival;
    const danger = surv && (s.hp < 0.3 || s.air < 0.3);
    const r = { hotbar: true, stats: surv, xp: surv, map: true, vehicle: true, cross: 'full', danger };
    if (s.travel) { r.hotbar = false; r.stats = danger; r.xp = false; r.map = false; r.vehicle = false; r.cross = 'none'; return r; }
    if (mode === 'always') return r;
    if (mode === 'minimal') {
      r.hotbar = t - s.slotT < 4; r.stats = danger; r.xp = false; r.map = !!s.mHeld; r.vehicle = !s.cockpit;
      r.cross = s.interact ? 'ring' : 'dot';
      return r;
    }
    r.hotbar = t - Math.max(s.slotT, s.useT, s.pickT) < 4 || !!s.building;
    r.stats = surv && (t - s.statT < 6 || s.hp < 0.5 || s.food < 0.5 || s.air < 1 || !!s.fight || t - s.enterT < 5);
    if (danger) r.stats = true;
    r.xp = surv && t - s.xpT < 4;
    r.map = s.speed > 6 || !!s.target || t - s.loadT < 8 || !!s.mHeld;
    r.vehicle = !(s.cockpit && s.cockpitT >= 9);
    r.cross = s.interact ? 'ring' : 'dot';
    return r;
  };
  // ---------------------------------------------------------------- the classes
  H.ELEMENTS = { hotbar: ['hotbar', 'itemname'], stats: ['stats', 'air'], xp: ['xpbar', 'xplvl'], map: ['minimap', 'compass'], vehicle: ['vehiclehud'] };
  const shown = {}, els = {};
  let crossNow = null, styled = false;
  const byId = (id) => (typeof document !== 'undefined' && document.getElementById ? document.getElementById(id) : null);
  function style() {
    if (styled || typeof document === 'undefined' || !document.head || document.getElementById('hfstyle')) { styled = true; return; }
    styled = true;
    const s = document.createElement('style'); s.id = 'hfstyle';
    s.textContent = '#hud .hf{transition:opacity .35s}#hud .hf-off{opacity:0!important;pointer-events:none}' +
      '#crosshair.hf-dot::before,#crosshair.hf-ring::before{left:9px;top:9px;width:4px;height:4px;border-radius:50%}#crosshair.hf-dot::after{display:none}' +
      '#crosshair.hf-ring::after{left:2px;top:2px;width:18px;height:18px;border-radius:50%;background:transparent;border:2px solid #fff;box-sizing:border-box}#crosshair.hf-none{opacity:0}';
    document.head.appendChild(s);
  }
  // r → the classes (only where a rule changed)
  H.apply = function (r) {
    style();
    for (const k in H.ELEMENTS) {
      const on = !!r[k];
      if (shown[k] === on) continue;
      shown[k] = on;
      for (const id of H.ELEMENTS[k]) {
        let e = els[id]; if (!e || !e.parentNode && !e.parent) e = els[id] = byId(id);
        if (!e) continue;
        e.classList.add('hf'); e.classList.toggle('hf-off', !on);
      }
    }
    if (r.cross !== crossNow) {
      crossNow = r.cross;
      const e = els.crosshair || (els.crosshair = byId('crosshair'));
      if (e) { e.classList.toggle('hf-dot', r.cross === 'dot'); e.classList.toggle('hf-ring', r.cross === 'ring'); e.classList.toggle('hf-none', r.cross === 'none'); }
    }
  };
  H.reset = () => { for (const k in shown) delete shown[k]; for (const k in els) delete els[k]; crossNow = null; };

  // ---------------------------------------------------------------- the game side
  const ST = { t: 0, slotT: -99, useT: -99, pickT: -99, building: false, statT: -99, hp: 1, food: 1, air: 1, fight: false, enterT: 0, loadT: 0, xpT: -99, speed: 0, target: false, mHeld: false, cockpit: false, cockpitT: 0, interact: false, survival: false, travel: false };
  let acc = 0, world = undefined, lastSel = -1, lastCount = -1, lastHp = -1, lastFood = -1, lastAir = -1, lastXp = -1, lastWp = -1, wpT = -99;
  H.cost = { frames: 0, ms: 0, worst: 0, evals: 0 };
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  H.tick = function (g, dt) {
    if (!H.on || !g || g.state !== 'play' || !g.player) return;
    const t0 = now(), p = g.player, I = g.input, s = ST;
    s.t = g.time || 0;
    if (g.world !== world) { world = g.world; s.enterT = s.t; s.loadT = s.t; lastSel = -1; lastCount = -1; lastHp = -1; lastFood = -1; lastAir = -1; lastXp = -1; lastWp = -1; H.reset(); }
    // a use (either mouse button, a pad trigger) is caught in the frame it happens
    if (I && I.captured && I.mouse && (I.mouse.down[0] || I.mouse.down[2]) && !(g.ui && g.ui.screen)) s.useT = s.t;
    acc += dt; if (acc < 0.25) { const Cs = H.cost; Cs.frames++; Cs.ms += now() - t0; return; }
    acc = 0;
    const inv = p.inv;
    if (inv) {
      if (inv.sel !== lastSel) { if (lastSel >= 0) s.slotT = s.t; lastSel = inv.sel; }
      let n = 0; for (let i = 0; i < inv.slots.length; i++) { const q = inv.slots[i]; if (q) n += q.n || 1; }
      if (lastCount >= 0 && n > lastCount) s.pickT = s.t;
      lastCount = n;
    }
    const mx = p.maxHealth || 20;
    s.hp = Math.max(0, Math.min(1, (p.health === undefined ? mx : p.health) / mx)); s.food = Math.max(0, Math.min(1, (p.food === undefined ? 20 : p.food) / 20)); s.air = Math.max(0, Math.min(1, (p.air === undefined ? 300 : p.air) / 300));
    if (lastHp >= 0 && (s.hp !== lastHp || s.food !== lastFood || s.air !== lastAir)) s.statT = s.t;
    lastHp = s.hp; lastFood = s.food; lastAir = s.air;
    const xp = (p.level || 0) * 1000 + (p.xp || 0) * 999;
    if (lastXp >= 0 && xp > lastXp) s.xpT = s.t;
    lastXp = xp;
    const wps = g.gadgets && g.gadgets.waypoints ? g.gadgets.waypoints.length : 0;
    if (lastWp >= 0 && wps > lastWp) wpT = s.t;
    lastWp = wps;
    s.survival = p.mode === 'survival';
    s.building = !!(VR.Bauhand && VR.Bauhand.state && VR.Bauhand.state !== 'closed') || !!p.breaking;
    s.fight = !!g.raidActive;
    const fl = g.flight;
    s.speed = fl ? (fl.speed || 0) : Math.hypot((p.vel && p.vel[0]) || 0, (p.vel && p.vel[2]) || 0);
    const In = VR.Intent;
    s.target = !!(In && ((In.current && In.current()) || In.aimed)) || s.t - wpT < 8;
    s.mHeld = !!(I && I.down && I.down('KeyM'));
    const ck = g.cockpit;
    s.cockpit = !!(ck && ck.active && ck.active());
    s.cockpitT = ck && ck.activeT !== undefined ? ck.activeT : 0;
    s.interact = g.ctxRow === 4 || g.ctxRow === 5;
    s.travel = !!(In && In.current && In.current() && !(g.settings && g.settings.travelCam === false));
    const mode = (g.settings && g.settings.hudMode) || 'auto';
    H.apply(H.rules(s, mode));
    const Cs = H.cost, ms = now() - t0; Cs.frames++; Cs.evals++; Cs.ms += ms; if (ms > Cs.worst) Cs.worst = ms;
  };
  H.state = () => Object.assign({}, ST);
  // ⚙ the switches (settings_reg.js takes rows from any file): Bild · the HUD's mode; Spiel · the travel camera
  if (VR.Settings && VR.Settings.add) {
    try {
      if (!VR.Settings.byKey || !VR.Settings.byKey('hudMode')) VR.Settings.add({ key: 'hudMode', g: 'img', sec: 'show', t: 'choice', lab: 'g.set.hudMode', tip: 'g.set.hudMode.tip', cost: 'low', def: 'auto', opts: [['auto', 'g.set.hudMode.auto', 'g.set.hudMode.auto.tip'], ['always', 'g.set.hudMode.always', 'g.set.hudMode.always.tip'], ['minimal', 'g.set.hudMode.minimal', 'g.set.hudMode.minimal.tip']] });
      if (!VR.Settings.byKey || !VR.Settings.byKey('travelCam')) VR.Settings.add({ key: 'travelCam', g: 'play', sec: 'play', t: 'switch', lab: 'g.set.travelCam', tip: 'g.set.travelCam.tip', def: true });
    } catch (e) { /* an older registry: the defaults hold */ }
  }
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
