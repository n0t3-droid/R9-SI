// ============================================================================
// R9 Studio · Crafter · Spieler-Modus — build the house as the player does in
// the game: first person, walking with the game's own physics (WASD, Space
// jumps, Space twice flies, Shift sneaks / sinks, Ctrl sprints), the mouse
// looks around (click the view to catch the mouse; E or Esc frees it for the
// palette), left click breaks, right click places, middle click picks, T
// replaces (Shift+T every piece of that kind), wheel / 1–9 pick the hotbar
// slot, holding a button keeps breaking / placing. P switches back to the
// Studio camera — both work on the same house, the same undo, the same Update.
// ============================================================================
(function () {
  'use strict';
  const C = window.__studioCore; if (!C) return;
  const CR = VR.Crafter; if (!CR) return;
  const { S, HOOK, $ } = C;
  const R = VR.R, T = R.T, F = VR.F, PH = VR.PHYS;
  const W = 0.3, H = 1.8, EYE = 1.62, SNEAK_EYE = 1.27, REACH = 9;
  const HDX = [0, 1, 0, -1], HDZ = [-1, 0, 1, 0];
  const FDX = [1, -1, 0, 0, 0, 0], FDY = [0, 0, 1, -1, 0, 0], FDZ = [0, 0, 0, 0, 1, -1];
  const PM = CR.player = { on: false, pos: [0, 0, 0], vel: [0, 0, 0], yaw: 0, pitch: 0, eye: EYE, onGround: false, flying: false, sneaking: false, sprinting: false, keys: {}, lastSpace: 0, locked: false, noLock: false, hold: null, t: 0, bob: 0, bobAmt: 0, jumpCd: 0, house: null, clip: null };

  // ---------------------------------------------------------------- the house grid as the world, the meadow around it
  // Off the property the ground goes on (grass, the meadow the Crafter draws) up to a garden fence; past the fence the
  // garden ends (an invisible wall, also in the air).
  let STONE = 0, GRASS = 0, DIRT = 0, FENCE = 0;
  const stone = () => STONE || (STONE = R.byName.stone.defaultState);
  const getState = (x, y, z) => {
    const h = CR.house; if (!h) return 0;
    if (y < 0) return stone();
    if (x >= 0 && z >= 0 && x < h.sx && z < h.sz) return y >= h.sy ? 0 : h.blocks[(y * h.sz + z) * h.sx + x];
    const M = CR.MEADOW || 40;
    if (x < -M || z < -M || x >= h.sx + M || z >= h.sz + M) return stone();
    if (y > h.F) return 0;
    if (y === h.F) return (x === -M || z === -M || x === h.sx + M - 1 || z === h.sz + M - 1) ? (FENCE || (FENCE = R.byName.oak_fence.defaultState)) : 0;
    return y === h.F - 1 ? (GRASS || (GRASS = R.byName.grass_block.defaultState)) : (DIRT || (DIRT = R.byName.dirt.defaultState));
  };
  PM.getState = getState;
  const nb = (x, y, z, d) => getState(x + HDX[d], y, z + HDZ[d]);
  const fitsAt = (p, hh) => !PH.overlaps(getState, p[0] - W + 0.01, p[1] + 0.01, p[2] - W + 0.01, p[0] + W - 0.01, p[1] + (hh || H) - 0.02, p[2] + W - 0.01, nb);

  // ---------------------------------------------------------------- UI bits: crosshair, the held item, the mode button, a status chip
  function ensureUI() {
    const main = $('main'); if (!main || $('#pmCross')) return;
    const cross = document.createElement('div'); cross.id = 'pmCross'; main.appendChild(cross);
    const hand = document.createElement('canvas'); hand.id = 'pmHand'; hand.width = hand.height = 96; main.appendChild(hand);
  }
  let handId = null, swingT = 0;
  function drawHand(force) {
    const cv = $('#pmHand'); if (!cv) return;
    const id = CR.hot[CR.slot];
    if (!force && id === handId) return;
    handId = id;
    const x = cv.getContext('2d'); x.clearRect(0, 0, 96, 96);
    const ic = id && CR.iconOf ? CR.iconOf(id) : null;
    if (ic) { x.imageSmoothingEnabled = false; x.drawImage(ic, 0, 0, 96, 96); }
  }
  function syncUI() {
    ensureUI();
    $('#studio').classList.toggle('playing', PM.on);
    $('#studio').classList.toggle('pmlocked', PM.on && PM.locked);
    $('#studio').classList.toggle('pmfree', PM.on && PM.noLock);
    if (PM.locked || !PM.noLock) crossAt(null);
    drawHand();
    if (CR.drawHelp) CR.drawHelp();
    state();
  }
  // the little state chip in the legend: walking / flying / sprinting, and whether the mouse is caught
  function state() {
    const el = $('#pmState'); if (!el || !PM.on) return;
    const L = CR.L || ((k, d) => d), IC = CR.IC || (() => '');
    el.innerHTML = (PM.flying ? '✈ ' + L('pm.fly', 'Fliegen') : IC('walk', 13) + ' ' + L('pm.walk', 'Gehen')) + (PM.sprinting ? ' · ⚡' : '') + (PM.locked ? '' : ' · ' + (PM.noLock ? L('pm.drag', 'Ziehen = schauen') : L('pm.click', 'Klick ins Bild = Maus fangen')));
  }

  // ---------------------------------------------------------------- on / off
  function toggle() { if (PM.on) exit(); else enter(); }
  function enter() {
    if (!(CR.on && CR.kind === 'house' && CR.house && S.mode === 'craft')) { if (CR.tip) CR.tip('Erst im Crafter ein Haus öffnen.', false); return; }
    if (CR.areaMode && CR.toggleArea) { /* the area tool works in both views */ }
    PM.on = true; PM.keys = {}; PM.hold = null; PM.t = performance.now();
    PM.clip = S.clipY; S.clipY = 1e9;             // the section cut would hide the upper floors around you
    spawn();
    syncUI(); C.parts();
    CR.tip && CR.tip((CR.L || ((k, d) => d))('pm.enter', 'Spieler: Klick ins Bild fängt die Maus · WASD gehen · Rechtsklick öffnet Türen · 2× Leertaste fliegen · P zurück'), true);
    lock();
  }
  function exit(silent) {
    if (!PM.on) return;
    closeAutoDoors();
    if (PM.seat) standUp();
    PM.on = false; PM.hold = null; PM.keys = {};
    unlock();
    if (PM.clip !== null) { S.clipY = PM.clip; PM.clip = null; }
    // the Studio camera looks at where the player stood
    const sc = S.scene;
    if (sc && sc.center && CR.house) { sc.center[0] = PM.pos[0]; sc.center[1] = PM.pos[1] + 1; sc.center[2] = PM.pos[2]; S.cam.yaw = PM.yaw; S.cam.pitch = 0.45; S.cam.dist = 0; }
    S.cam.fly = null; CR.hover = null; CR.ghost = null;
    syncUI(); if (!silent) C.parts();
    if (!silent && CR.tip) CR.tip('Studio-Kamera', true);
  }
  function lookAtLot(x, z) { const h = CR.house, cx = h.pad + h.lot[0] / 2, cz = h.pad + h.lot[1] / 2; return Math.atan2(-(cx - x), -(cz - z)); }
  function spawn() {
    const h = CR.house; if (PM.house !== h) autoOpen.clear(); PM.house = h; PM.seat = null; PM.vel = [0, 0, 0]; PM.onGround = false; PM.eye = EYE;
    const fly = S.cam.fly && !S.cam.fly.player ? S.cam.fly : null;
    if (fly) { PM.pos = [fly.pos[0], fly.pos[1] - EYE, fly.pos[2]]; PM.yaw = fly.yaw; PM.pitch = fly.pitch; PM.flying = true; }
    else {
      // at the front corner of the lot (as far out as the ring allows), looking at the house
      const x = Math.max(1, h.pad - 3.5), z = Math.max(1, h.pad - 3.5);
      let y = h.F; for (let yy = h.sy - 1; yy >= 0; yy--) { const s = getState(Math.floor(x), yy, Math.floor(z)); if (s && (T.flags[s] & F.SOLID)) { y = yy + 1; break; } }
      PM.pos = [x, y, z]; PM.yaw = lookAtLot(x, z); PM.pitch = -0.12; PM.flying = false;
    }
    const M = (CR.MEADOW || 40) - 1;
    PM.pos[0] = Math.max(-M + W + 0.05, Math.min(h.sx + M - W - 0.05, PM.pos[0])); PM.pos[2] = Math.max(-M + W + 0.05, Math.min(h.sz + M - W - 0.05, PM.pos[2]));
    for (let k = 0; k < 400 && !fitsAt(PM.pos); k++) PM.pos[1] += 0.5;
    writeCam();
  }
  function lock() {
    const cv = C.view(); if (!cv || PM.noLock || !cv.requestPointerLock) return;
    try { const r = cv.requestPointerLock(); if (r && r.catch) r.catch(() => { PM.noLock = true; syncUI(); }); } catch (e) { PM.noLock = true; }
  }
  function unlock() { try { if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock(); } catch (e) { /* ignore */ } }
  document.addEventListener('pointerlockchange', () => { PM.locked = !!document.pointerLockElement && document.pointerLockElement === C.view(); if (!PM.locked) { PM.hold = null; PM.keys = {}; } syncUI(); });
  document.addEventListener('pointerlockerror', () => { PM.noLock = true; PM.locked = false; syncUI(); if (PM.on && CR.tip) CR.tip('Maus fangen geht hier nicht — ziehen schaut sich um, Klick baut.', false); });

  // ---------------------------------------------------------------- the camera: the Studio's free camera at the player's eyes
  function writeCam() {
    const bobY = PM.onGround && !PM.flying ? Math.abs(Math.sin(PM.bob * Math.PI)) * 0.05 * PM.bobAmt : 0;
    const f = S.cam.fly && S.cam.fly.player ? S.cam.fly : (S.cam.fly = { pos: [0, 0, 0], yaw: 0, pitch: 0, speed: 8, player: true });
    f.pos[0] = PM.pos[0]; f.pos[1] = PM.pos[1] + PM.eye + bobY; f.pos[2] = PM.pos[2]; f.yaw = PM.yaw; f.pitch = PM.pitch;
    f.fov = gameFov();
  }
  // the game's field of view (Settings → Field of view, 72° by default), sprinting widens it a little like the game
  let fovSet = 0, fovT = 0;
  function gameFov() {
    const now = performance.now();
    if (!fovSet || now - fovT > 3000) { fovT = now; let v = 72; try { const st = JSON.parse(localStorage.getItem('r9si.settings') || '{}'); if (st && st.fov >= 40 && st.fov <= 120) v = st.fov; } catch (e) { /* default */ } fovSet = v; }
    return fovSet * Math.PI / 180 * (PM.sprinting && !PM.flying ? 1.08 : 1);
  }
  // what the crosshair is on (or, without a caught mouse, what the pointer is on — the Crafter keeps that)
  function aim() {
    const f = S.cam.fly; if (!f) return;
    const d = [-Math.sin(f.yaw) * Math.cos(f.pitch), Math.sin(f.pitch), -Math.cos(f.yaw) * Math.cos(f.pitch)];
    let hv = CR.pickBlock({ o: f.pos.slice(), d });
    if (hv && hv.dist > REACH) hv = null;
    CR.hover = hv; CR.ghost = null;
    if (hv) {
      const cur = CR.gGet(hv.x, hv.y, hv.z);
      CR.ghost = (!hv.ground && cur && (T.flags[cur] & F.REPLACE)) ? [hv.x, hv.y, hv.z] : [hv.x + FDX[hv.face], hv.y + FDY[hv.face], hv.z + FDZ[hv.face]];
      if (!hv.ground) CR.lastHit = { x: hv.x, y: hv.y, z: hv.z };
    }
    if (CR.paint) CR.paint.update();
  }
  // no block into the player's body (like the game)
  CR.placeGuard = function (list) {
    if (!PM.on) return true;
    const hh = H * (PM.sneaking ? 0.83 : 1), p = PM.pos;
    for (const o of list) for (const b of PH.collision(o.state, null)) {
      if (o.x + b[3] > p[0] - W && o.x + b[0] < p[0] + W && o.y + b[4] > p[1] && o.y + b[1] < p[1] + hh && o.z + b[5] > p[2] - W && o.z + b[2] < p[2] + W) return false;
    }
    return true;
  };
  function act(b, shift) {
    const hv = CR.hover;
    if (CR.tool === 'paint') { if (b !== 0 && hv && !hv.ground) { CR.pickAt(hv); drawHand(true); } return; }
    if (CR.areaMode && hv && (b === 0 || b === 2)) {
      const c = [hv.x, hv.y, hv.z];
      if (b === 0 || !CR.area || !CR.area.a) CR.area = { a: c, b: null, dy: 0 }; else { CR.area.b = c; CR.area.dy = 0; }
      C.parts(); return;
    }
    if (!hv) { offLot(); return; }
    swingT = 1;
    let used = false;
    if (b === 0) { if (!hv.ground) CR.breakAt(hv); }
    else if (b === 2) {
      // like the game: a door, gate or trapdoor opens (Shift + right click with a block in hand places against it)
      if (!(shift && CR.hot[CR.slot]) && (sitAt(hv) || (CR.useAt && CR.useAt(hv)))) used = true;
      else CR.placeAt(hv);
    }
    else if (b === 1 && !hv.ground) { CR.pickAt(hv); drawHand(true); }
    aim();
    return used ? 'use' : 'act';
  }
  // sitting, like the game: right click on a chair, sofa, bench or stool (Shift stands up again)
  const isSeat = (t) => !!(t && (t.o.kind === 'seat' || t.o.seat));
  function sitAt(hv) {
    if (!hv || hv.ground) return false;
    const s = CR.gGet(hv.x, hv.y, hv.z), t = s && R.types[T.type[s]];
    if (!isSeat(t)) return false;
    const f = t.has('facing') ? t.get(s, 'facing') : 0;
    PM.seat = { x: hv.x, y: hv.y, z: hv.z, f }; PM.yaw = -f * Math.PI / 2; PM.pitch = -0.08; PM.flying = false; PM.vel = [0, 0, 0]; PM.hold = null;
    if (CR.tip) CR.tip((CR.L || ((k, d) => d))('pm.seated', 'Du sitzt · Shift = aufstehen'), true);
    return true;
  }
  function standUp() {
    const r = PM.seat; PM.seat = null; if (!r) return;
    const fx = HDX[r.f & 3], fz = HDZ[r.f & 3];
    const cands = [[r.x + 0.5 + fx, r.y, r.z + 0.5 + fz], [r.x + 0.5 - fx, r.y, r.z + 0.5 - fz], [r.x + 1.5, r.y, r.z + 0.5], [r.x - 0.5, r.y, r.z + 0.5], [r.x + 0.5, r.y, r.z + 1.5], [r.x + 0.5, r.y, r.z - 0.5], [r.x + 0.5, r.y + 1, r.z + 0.5]];
    PM.pos = cands.find(c => fitsAt(c)) || [r.x + 0.5, r.y + 1, r.z + 0.5];
    PM.vel = [0, 0, 0]; PM.onGround = false;
  }
  // a click at the meadow: building happens on the property (up to the blue line)
  let offT = 0;
  function offLot() {
    const now = performance.now(); if (now - offT < 2500) return; offT = now;
    if (CR.tip) CR.tip((CR.L || ((k, d) => d))('pm.offlot', 'Gebaut wird auf deinem Grundstück — bis zur blauen Linie.'), false);
  }

  // ---------------------------------------------------------------- input
  function pmPointer(e, type) {
    if (PM.locked) {
      if (type === 'move') {
        // the game's mouse look; the Maus-Tempo setting scales it; the odd huge jump some browsers send on capture is ignored
        const sens = 0.0022 * (S.sens || 1), mx = e.movementX || 0, my = e.movementY || 0;
        if (Math.abs(mx) > 300 || Math.abs(my) > 300) return true;
        PM.yaw -= mx * sens;
        PM.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, PM.pitch - my * sens * S.vy()));
        return true;
      }
      if (type === 'down') {
        if (CR.tool === 'paint' && e.button === 0) { aim(); CR.paint.down(); swingT = 1; return true; }   // paint: click small, hold big
        const r = act(e.button, e.shiftKey || !!PM.keys.shift); PM.hold = CR.tool === 'paint' || r === 'use' ? null : { b: e.button, next: performance.now() + 320 }; return true;
      }
      if (type === 'up') { PM.hold = null; if (CR.tool === 'paint' && e.button === 0) CR.paint.up(); return true; }
      return true;
    }
    // the mouse is free: a click into the view catches it (that click does nothing else)
    if (type === 'move') crossAt(PM.noLock ? e : null);
    if (type === 'down' && !PM.noLock && e.button === 0) { lock(); return true; }
    if (PM.noLock) return false;     // no pointer lock here: the Crafter's own drag-to-look and click-to-build
    return true;
  }
  function pmKey(e, down) {
    const k = e.key.toLowerCase();
    if (!down) {
      if (k === ' ' || k === 'spacebar') PM.keys[' '] = false; else PM.keys[k] = false;
      if (k === 'shift') PM.keys.shift = false; if (k === 'control') PM.keys.control = false;
      return undefined;                // the Crafter clears its own keys too
    }
    if (e.ctrlKey && (k === 'z' || k === 'y')) return undefined;          // undo / redo stay the Crafter's
    if (k === 'p') { exit(); return true; }
    if (k === 'e' || k === 'escape') { if (PM.locked) { unlock(); return true; } if (k === 'e') return true; return undefined; }
    if (k === 'f' && !CR.areaMode) { PM.flying = !PM.flying; PM.vel[1] = 0; syncUI(); return true; }
    if (k === ' ') {
      if (!e.repeat) { const now = performance.now(); if (now - PM.lastSpace < 320) { PM.flying = !PM.flying; PM.vel[1] = 0; PM.lastSpace = 0; syncUI(); } else PM.lastSpace = now; }
      PM.keys[' '] = true; return true;
    }
    if (k === 'shift') { PM.keys.shift = true; return true; }
    if (k === 'control') { PM.keys.control = true; return true; }
    if ('wasd'.includes(k) && k.length === 1) { PM.keys[k] = true; return true; }
    if (k === 'q' || k === 'c') return true;  // the Studio's fly keys have no meaning here
    return undefined;
  }
  function pmWheel(e) {
    CR.slot = (CR.slot + (e.deltaY > 0 ? 1 : 8)) % 9; CR.drawBar(); C.hud(); drawHand(); return true;
  }

  // ---------------------------------------------------------------- the step: the game's movement, on the house grid
  function pmTick() {
    const h = CR.house;
    if (!h || !CR.on || CR.kind !== 'house' || S.mode !== 'craft') { exit(true); return; }
    if (PM.house !== h) spawn();
    const now = performance.now();
    // without a caught mouse the Crafter's drag turns the camera: take its look
    if (!PM.locked && S.cam.fly && S.cam.fly.player) { PM.yaw = S.cam.fly.yaw; PM.pitch = S.cam.fly.pitch; }
    // real time at any frame rate: the physics runs in steps of at most 1/60 s (a jump is as high at 20 fps as at 144)
    let left = Math.min(0.5, Math.max(0.001, (now - PM.t) / 1000)); PM.t = now;
    while (left > 1e-4) { const dt = Math.min(1 / 60, left); left -= dt; physics(dt); }
    writeCam();
    if (PM.locked) aim();
    // holding a button keeps breaking / placing (a little slower than clicking)
    if (PM.hold && PM.locked && now >= PM.hold.next) { if (act(PM.hold.b, !!PM.keys.shift) === 'use') PM.hold = null; else PM.hold.next = now + 210; }
    autoDoors(Math.min(0.1, (now - (PM.td || now)) / 1000)); PM.td = now;
    // the hand swings when it does something
    const dtf = Math.min(0.1, (now - (PM.tf || now)) / 1000); PM.tf = now;
    if (swingT > 0) { swingT = Math.max(0, swingT - dtf * 5); }
    const hand = $('#pmHand'); if (hand) hand.style.transform = `translate(${(-Math.sin(PM.bob * Math.PI) * 6 * PM.bobAmt).toFixed(1)}px, ${(Math.abs(Math.cos(PM.bob * Math.PI)) * 5 * PM.bobAmt + swingT * 18).toFixed(1)}px) rotate(${(-12 - swingT * 22).toFixed(1)}deg)`;
    drawHand();
    if (PM.sprinting !== PM._spr || PM.flying !== PM._fly || PM.locked !== PM._lk) { PM._spr = PM.sprinting; PM._fly = PM.flying; PM._lk = PM.locked; state(); }
  }
  // the sliding glass doors open by themselves when you come close and close again behind you (like in the game)
  const autoOpen = new Map();
  let doorFrame = 0;
  function autoDoors(dt) {
    const h = CR.house; if (!h || !CR.openGroup) return;
    const p = PM.pos, near = [], fr = ++doorFrame;
    for (let y = Math.floor(p[1]); y <= Math.floor(p[1] + 1.8); y++) for (let z = Math.floor(p[2] - 2); z <= Math.floor(p[2] + 2); z++) for (let x = Math.floor(p[0] - 2); x <= Math.floor(p[0] + 2); x++) {
      const s = CR.gGet(x, y, z); if (!s) continue;
      const t = R.types[T.type[s]]; if (!(t && t.o.vx && t.o.vx.kind === 'mdoor')) continue;
      if (Math.hypot(x + 0.5 - p[0], z + 0.5 - p[2]) > 1.9) continue;
      // near: the whole door group opens and stays open while you are here
      for (const c of CR.openGroup(x, y, z, s)) { const k = c.join(','), a = autoOpen.get(k); if (a) { a.t = 0.6; a.fr = fr; } else { autoOpen.set(k, { c, t: 0.6, fr }); near.push(c); } }
    }
    if (near.length) CR.setOpen(near, 1);
    const close = [];
    for (const [k, a] of autoOpen) { if (a.fr === fr) continue; a.t -= dt; if (a.t <= 0) { autoOpen.delete(k); close.push(a.c); } }
    if (close.length) CR.setOpen(close, 0);
  }
  function closeAutoDoors() { const cells = [...autoOpen.values()].map(a => a.c); autoOpen.clear(); if (cells.length && CR.house && CR.setOpen) CR.setOpen(cells, 0); }
  // the crosshair: in the middle with a caught mouse, at the pointer without one (that is where you aim then)
  function crossAt(e) {
    const el = $('#pmCross'); if (!el) return;
    if (PM.locked || !e) { el.style.left = ''; el.style.top = ''; return; }
    const r = $('main').getBoundingClientRect(); el.style.left = (e.clientX - r.left) + 'px'; el.style.top = (e.clientY - r.top) + 'px';
  }
  // one physics step of dt seconds (the game's movement rules)
  function physics(dt) {
    const h = CR.house;
    const K = PM.keys;
    if (PM.seat) {
      const r = PM.seat, s = getState(r.x, r.y, r.z);
      if (!isSeat(s && R.types[T.type[s]]) || K.shift) { standUp(); K.shift = false; }
      else {
        PM.pos = [r.x + 0.5, r.y + 0.4, r.z + 0.5]; PM.vel = [0, 0, 0]; PM.onGround = true; PM.flying = false; PM.sneaking = false; PM.sprinting = false;
        PM.eye += (1.05 - PM.eye) * Math.min(1, dt * 10); PM.bobAmt = 0;
        return;
      }
    }
    const fw = (K.w ? 1 : 0) - (K.s ? 1 : 0), st = (K.d ? 1 : 0) - (K.a ? 1 : 0);
    const jump = !!K[' '], sneak = !!K.shift;
    if (K.control && fw > 0 && !sneak) PM.sprinting = true;
    if (fw <= 0 || sneak) PM.sprinting = false;
    PM.sneaking = sneak && !PM.flying;
    const cy = Math.cos(PM.yaw), sy = Math.sin(PM.yaw);
    let wx = -sy * fw + cy * st, wz = -cy * fw - sy * st;
    const wl = Math.hypot(wx, wz); if (wl > 1) { wx /= wl; wz /= wl; }
    const v = PM.vel;
    const feet = getState(Math.floor(PM.pos[0]), Math.floor(PM.pos[1] + 0.1), Math.floor(PM.pos[2])), mid = getState(Math.floor(PM.pos[0]), Math.floor(PM.pos[1] + 0.9), Math.floor(PM.pos[2]));
    const ladder = !!((T.flags[feet] | T.flags[mid]) & F.CLIMB);
    if (PM.flying) {
      const sp = 11 * (PM.sprinting ? 2.1 : 1), ty = ((jump ? 1 : 0) - (sneak ? 1 : 0)) * 8 * (PM.sprinting ? 1.5 : 1), a = 1 - Math.exp(-dt * 9);
      v[0] += (wx * sp - v[0]) * a; v[2] += (wz * sp - v[2]) * a; v[1] += (ty - v[1]) * a;
    } else {
      const sp = PM.sneaking ? 1.3 : PM.sprinting ? 5.6 : 4.3, a = 1 - Math.exp(-dt * (PM.onGround ? 14 : 3.2));
      v[0] += (wx * sp - v[0]) * a; v[2] += (wz * sp - v[2]) * a;
      v[1] = Math.max(-78, v[1] - 30 * dt);
      PM.jumpCd -= dt;
      if (jump && PM.onGround && PM.jumpCd <= 0) { v[1] = 9.1; PM.jumpCd = 0.25; PM.onGround = false; if (PM.sprinting) { v[0] += wx * 1.6; v[2] += wz * 1.6; } }
      if (ladder) { v[0] *= 0.85; v[2] *= 0.85; if (jump || (PM.hitWall && fw > 0)) v[1] = 2.4; else if (sneak) v[1] = Math.max(v[1], 0); else v[1] = Math.max(v[1], -2.4); }
    }
    let mx = v[0] * dt, my = v[1] * dt, mz = v[2] * dt;
    if (PM.sneaking && PM.onGround) {
      // the edge guard: sneaking never walks off a ledge
      const guard = (dx, dz) => PH.overlaps(getState, PM.pos[0] + dx - W + 0.01, PM.pos[1] - 0.61, PM.pos[2] + dz - W + 0.01, PM.pos[0] + dx + W - 0.01, PM.pos[1] - 0.01, PM.pos[2] + dz + W - 0.01, nb);
      if (mx && !guard(mx, 0)) { mx = 0; v[0] = 0; }
      if (mz && !guard(0, mz)) { mz = 0; v[2] = 0; }
      if (mx && mz && !guard(mx, mz)) { mx = 0; mz = 0; }
    }
    // something got built into the player (a placed block, an undo): step out upward
    if (!fitsAt(PM.pos, H * (PM.sneaking ? 0.83 : 1))) { for (let k = 0; k < 40 && !fitsAt(PM.pos); k++) PM.pos[1] += 0.25; mx = 0; my = 0; mz = 0; if (v[1] < 0) v[1] = 0; }
    let follow = null;
    if (!PM.flying && PM.onGround && v[1] <= 0) { follow = PH.walkSmooth(getState, PM.pos, mx, mz); if (follow !== null) { my = follow; v[1] = 0; } }
    const res = PH.move(getState, PM.pos, W, H * (PM.sneaking ? 0.83 : 1), mx, my, mz, 0.6, nb, PM.onGround && !PM.flying);
    PM.hitWall = res.hitX || res.hitZ;
    if (res.hitX) v[0] = 0; if (res.hitZ) v[2] = 0;
    if (follow !== null) { PM.onGround = true; v[1] = 0; }
    else {
      if (res.hitY) { if (v[1] < 0) PM.onGround = true; v[1] = 0; } else PM.onGround = res.onGround;
      if (my < 0 && !res.hitY) PM.onGround = false;
      if (!PM.flying && v[1] <= 0 && PH.snapSmooth(getState, PM.pos)) { PM.onGround = true; v[1] = 0; }
    }
    if (PM.flying && PM.onGround && !jump && v[1] <= 0) PM.flying = false;   // landing ends the flight
    PM.pos[1] = Math.min(PM.pos[1], h.sy + 48);
    // the eyes: lower when sneaking, a soft head bob when walking
    PM.eye += ((PM.sneaking ? SNEAK_EYE : EYE) - PM.eye) * Math.min(1, dt * 12);
    const hs = Math.hypot(v[0], v[2]);
    if (PM.onGround && hs > 0.1 && !PM.flying) { PM.bob += hs * dt * 0.55; PM.bobAmt = Math.min(1, PM.bobAmt + dt * 4); } else PM.bobAmt = Math.max(0, PM.bobAmt - dt * 4);
  }
  // tests and tools: n steps of dt with the current keys, then the camera
  PM.step = function (dt, n) { for (let i = 0; i < (n || 1); i++) physics(dt); writeCam(); };

  // ---------------------------------------------------------------- the Studio's hooks: the player answers while it is on
  const prev = { pointer: HOOK.pointer, key: HOOK.key, wheel: HOOK.wheel, tick: HOOK.tick, leave: HOOK.leave };
  HOOK.pointer = function (e, type) { if (PM.on) { const r = pmPointer(e, type); if (r !== false) return r; } return prev.pointer ? prev.pointer(e, type) : false; };
  HOOK.key = function (e, down) {
    if (!down && PM.on) pmKey(e, false);
    if (down && !e.altKey && !e.metaKey && e.key && e.key.toLowerCase() === 'p' && !e.ctrlKey && CR.on && CR.kind === 'house' && S.mode === 'craft' && !PM.on) { enter(); return true; }
    if (down && PM.on) { const r = pmKey(e, true); if (r !== undefined) return r; }
    return prev.key ? prev.key(e, down) : false;
  };
  HOOK.wheel = function (e) { if (PM.on) return pmWheel(e); return prev.wheel ? prev.wheel(e) : false; };
  HOOK.tick = function () { if (prev.tick) prev.tick(); if (PM.on) pmTick(); else syncUILazy(); };
  // (the view kept for 🕘 Weitermachen is the player's, taken before the Studio camera comes back)
  HOOK.leave = function () { if (PM.on) { if (CR.viewState) CR.viewAtLeave = CR.viewState(); exit(true); } if (prev.leave) return prev.leave.apply(null, arguments); };
  // the mode button follows the Crafter (shown only while a house is open)
  let uiSig = '';
  function syncUILazy() { const sig = (CR.on ? 1 : 0) + ':' + CR.kind + ':' + S.mode + ':' + PM.on; if (sig !== uiSig) { uiSig = sig; syncUI(); } }
  PM.toggle = toggle; PM.enter = enter; PM.exit = exit; PM.spawn = spawn; PM.aim = aim; PM.act = act; PM.autoDoors = autoDoors; PM.fitsAt = fitsAt; PM.sitAt = sitAt; PM.standUp = standUp;

  // ---------------------------------------------------------------- your hotbar from the game (the last world you played)
  PM.gameHotbar = async function () {
    try {
      if (!VR.Store) { CR.tip('Kein Zugriff auf die Spielstände.', false); return 0; }
      const st = new VR.Store(); await st.open();
      const ws = (await st.listWorlds()).filter(w => w && !w.guest && w.player && w.player.inv && Array.isArray(w.player.inv.slots)).sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
      if (!ws.length) { CR.tip('Noch keine gespeicherte Welt mit Inventar — erst im Spiel spielen (und speichern).', false); return 0; }
      let n = 0;
      ws[0].player.inv.slots.slice(0, 9).forEach((s, i) => { if (s && R.byName[s.id] && !R.byName[s.id].o.noItem) { CR.hot[i] = s.id; n++; } });
      CR.drawBar(); drawHand(true); C.hud();
      CR.tip(n ? `Hotbar aus „${ws[0].name || 'Welt'}“: ${n} Blöcke übernommen.` : `In „${ws[0].name || 'Welt'}“ liegen keine Blöcke in der Hotbar.`, !!n);
      return n;
    } catch (e) { console.warn('hotbar', e); CR.tip('Hotbar konnte nicht gelesen werden.', false); return 0; }
  };
})();
