// ============================================================================
// Flight: one flight model for every ship you pilot — the mini-voxel starships
// (starships.js) and the block-built ships behind a Ship Helm (gadgets.js).
// The mouse is your head: it looks around the cockpit and never steers (hold
// the right mouse button — or switch on "Maus lenkt" — to fly where you look,
// middle click re-centres). A throttle lever that stays where you leave it
// (W/S, wheel; below zero it brakes, then reverses at up to 25 %; X = zero =
// hover), A/D turn with an automatic bank that levels itself, Space/Shift climb
// and sink with altitude hold, B boosts on an energy bar, F gear (automatic
// below 10 m), L lights, R ramp, G autopilot, V flies the ship down onto its
// gear (no teleport) and, once landed, gets you out, C/F5 cockpit → chase →
// cinematic, hold Q to look back. Movement is sub-stepped (≤ 0.5 m), slides
// along walls, shakes off blocks that end up inside the hull and skips all
// collision tests while the whole ship is 3 m above everything below it.
// Speed feel: FOV, turbine whine, wind, smooth camera shake, wingtip vapour, a
// blue boost flame and the dust the engines blow off the ground below 8 m.
//
// A ship system hands in a body (ship-frame metres: nose −z, x starboard, y up,
// origin = body.pos):
//   kind, pos, vel (live arrays), heading (get/set), setAttitude(pitch, roll), setGear(v),
//   hits(x, y, z, heading) (hull surface), overlaps(x, y, z, heading) (every hull cell),
//   cruiseBase (m/s), agility, eye, center, radius, length, width, height, extent [hx, hz],
//   gearFeet [[x, y, z]…], belly [[x, y, z]…], exhaust [[x, y, z, size]…], wingtips, name
// ============================================================================
(function (VR) {
  'use strict';
  // the player's language (lang_de.js / lang_en.js)
  const T = (k, v, fb) => (VR.I18N ? VR.I18N.t(k, v, fb) : (fb !== undefined ? fb : k));
  const R = VR.R, F = VR.F, PH = VR.PHYS, mat4 = VR.mat4;
  const TAU = Math.PI * 2, DEG = Math.PI / 180;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const wrapA = (a) => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };
  const k1 = (rate, dt) => 1 - Math.exp(-rate * dt);
  const smooth = (t) => t * t * (3 - 2 * t);
  const IDENT = mat4.create();

  const TUNE = {
    accel: 8, brake: 12, boostK: 1.8, boostAccel: 18, rev: 0.25, thrRate: 0.75,
    turnHover: 1.2, turnCruise: 0.8, turnTau: 0.22,
    bank: 34 * DEG, bankTau: 0.2,
    climb: 14, vAcc: 16, slip: 2.5,
    cushion: 8, gearAlt: 10, gearSpeed: 25, gearTime: 1.2, landSpeed: 8,
    stepLen: 0.5, stuck: 0.2,
    headYaw: 150 * DEG, headUp: 80 * DEG, headDown: 70 * DEG, lookBack: 150 * DEG,
    boostTime: 5, boostRefill: 9, rampMax: 8, startTime: 3,
  };

  let NEXT = 1;
  class Flight {
    constructor(g, body) {
      this.g = g; this.b = body; this.id = NEXT++;
      this.state = 'landed'; this.view = 0;
      this.throttle = 0; this.detent = 0;
      this.boost = false; this.boostWant = false; this.energy = 1; this.boostCool = 0;
      this.ctl = { turn: 0, climb: 0, strafe: 0, speed: null };
      this.yawRate = 0; this.roll = 0; this.pitch = 0; this.holdAlt = null; this.vF = 0;
      this.gear = 1; this.gearDown = true; this.gearAuto = true; this.gearHigh = false;
      this.lights = false; this.ramp = 0; this.rampOpen = false;
      this.headYaw = 0; this.headPitch = 0; this.backT = 0; this.recenter = false; this.mouseIdle = 9; this.steering = false; this.onControl = false;
      this.spool = 0; this.speed = 0; this.alt = null; this.stuckT = 0; this.dip = 0; this.dipV = 0;
      this.shakeAmp = 0; this.bump = 0; this.shake = [0, 0, 0, 0]; this.fovK = 1; this.fovKick = 0;
      this.t = 0; this.dt = 1 / 60; this.auto = null; this.skyClear = false; this.strobeT = 0;
      // cockpit systems: a ship starts cold (POWER, then START: a 3 s spool-up; W, Space or G does both)
      this.power = 'off'; this.startT = 0; this.armed = false; this.radio = false; this.anim = {}; this.chatT = 2;
      this.R3 = mat4.create(); this.C4 = mat4.create();
      this.chaseYaw = null; this.shot = null; this.accSm = [0, 0, 0]; this.lastV = [0, 0, 0];
      this.orient();
    }
    get cruise() { return clamp(this.b.cruiseBase * 1.35, 30, 80); }
    get heading() { return this.b.heading; }
    get running() { return this.power === 'running'; }
    static get TUNE() { return TUNE; }

    // ---------------------------------------------------------------- frames
    orient() {
      const m = this.R3; m.set(IDENT);
      mat4.rotY(m, m, this.b.heading); if (this.pitch) mat4.rotX(m, m, this.pitch); if (this.roll) mat4.rotZ(m, m, this.roll);
      return m;
    }
    // ship-frame metres → world (full attitude)
    toWorld(l, out) {
      const m = this.R3, p = this.b.pos; out = out || [0, 0, 0];
      out[0] = p[0] + m[0] * l[0] + m[4] * l[1] + m[8] * l[2]; out[1] = p[1] + m[1] * l[0] + m[5] * l[1] + m[9] * l[2]; out[2] = p[2] + m[2] * l[0] + m[6] * l[1] + m[10] * l[2];
      return out;
    }
    dirWorld(l, out) {
      const m = this.R3; out = out || [0, 0, 0];
      out[0] = m[0] * l[0] + m[4] * l[1] + m[8] * l[2]; out[1] = m[1] * l[0] + m[5] * l[1] + m[9] * l[2]; out[2] = m[2] * l[0] + m[6] * l[1] + m[10] * l[2];
      return out;
    }
    // ship-frame metres → world, heading only (ground probes)
    flat(l, h) { const c = Math.cos(h), s = Math.sin(h), p = this.b.pos; return [p[0] + l[0] * c + l[2] * s, p[1] + l[1], p[2] - l[0] * s + l[2] * c]; }
    inside() { const b = this.b, p = b.pos; return !!b.overlaps(p[0], p[1], p[2], b.heading); }

    // ---------------------------------------------------------------- boarding
    // resume: back into the seat of a ship that kept flying on its own (hover hold / the autopilot) — it carries on
    enter(resume) {
      const g = this.g, b = this.b;
      g.flight = this;
      if (b.hatch) { this.rampOpen = b.hatch.rampOpen; this.ramp = b.hatch.ramp; }
      if (resume) { this.headYaw = 0; this.headPitch = 0; this.backT = 0; this.recenter = false; g.camMode = this.view === 0 ? 0 : 1; return; }
      this.headYaw = 0; this.headPitch = 0; this.backT = 0; this.recenter = false;
      this.ctl.turn = 0; this.ctl.climb = 0; this.ctl.strafe = 0; this.ctl.speed = null;
      this.throttle = 0; this.yawRate = 0; this.boost = false; this.boostWant = false; this.auto = null; this.chaseYaw = null; this.shot = null;
      b.vel[0] = 0; b.vel[1] = 0; b.vel[2] = 0; this.vF = 0;
      this.gearAuto = true; this.stuckT = 0; this.dip = 0; this.dipV = 0;
      this.alt = this.clearance();
      if (this.alt !== null && this.alt < 0.4) { this.state = 'landed'; this.gear = 1; this.gearDown = true; }
      else { this.state = 'flying'; this.holdAlt = b.pos[1]; }
      this.roll = 0; this.pitch = 0; b.setAttitude(0, 0); this.orient();
      if (b.setGear) b.setGear(this.gear);
      g.camMode = this.view === 0 ? 0 : 1;
      // up in the air the engines are running; on the ground the ship waits cold
      if (this.state !== 'landed') { this.power = 'running'; this.startT = TUNE.startTime; }
      this.spool = this.running ? 0.25 : 0;
      if (!this.running && g.ui && g.ui.hint) g.ui.hint(T('g.fl.cold'), 4500);
    }
    leave() {
      const g = this.g;
      if (g.flight === this) g.flight = null;
      g.camMode = 0; g.flightWind = 0; this.auto = null; this.boost = false;
      // getting out shuts the ship down
      if (this.state === 'landed') { this.power = 'off'; this.startT = 0; this.throttle = 0; }
      if (g.audio) { g.audio.loop('engine', 0); g.audio.loop('radio', 0); if (g.audio.turbine) g.audio.turbine(0, 0); }
    }
    // ---- cockpit systems
    setPower(on) {
      if (on) { if (this.power === 'off') { this.power = 'on'; this.sfx('switch'); this.say(T('g.fl.powerOn')); } return true; }
      if (this.power === 'off') return true;
      if (this.state !== 'landed') { this.say(T('g.fl.notFlying')); this.sfx('deny'); return false; }
      this.power = 'off'; this.startT = 0; this.throttle = 0; this.boost = false; this.auto = null; this.sfx('switch');
      return true;
    }
    startEngines() {
      if (this.power === 'running' || this.power === 'starting') return true;
      if (this.power === 'off') { this.say(T('g.fl.noPower')); this.sfx('deny'); return false; }
      this.power = 'starting'; this.startT = 0; this.sfx('spool');
      return true;
    }
    autoStart() { if (this.power === 'off') this.power = 'on'; return this.startEngines(); }
    setThrottle(v) { this.throttle = clamp(v, -TUNE.rev, 1); this.detent = 0; if (this.throttle > 0.05 && !this.running) this.autoStart(); }
    setView(v) {
      this.view = v; this.g.camMode = v === 0 ? 0 : 1; this.shot = null; this.chaseYaw = null;
      if (this.g.audio) this.g.audio.play('click');
    }

    // ---------------------------------------------------------------- per frame (called by the ship system)
    update(dt, input, blocked) {
      dt = Math.max(1e-4, Math.min(0.1, dt || 0.016));
      this.dt = dt; this.t += dt;
      if (this.controls(dt, input, blocked) === 'exit') return 'exit';
      if (this.auto) this.autoStep(dt);
      this.simulate(dt);
      this.effects(dt);
      return null;
    }

    // ---------------------------------------------------------------- controls
    controls(dt, input, blocked) {
      const g = this.g, S = g.settings || {}, live = !blocked && !(g.ui && g.ui.typing);
      const down = (c) => live && input.down(c), hit = (c) => live && input.hit(c);
      if (hit('KeyC') || hit('F5')) this.setView((this.view + 1) % 3);
      this.backT = clamp(this.backT + (down('KeyQ') ? dt : -dt) / 0.18, 0, 1);
      // the mouse: your head (or, right button held, the stick)
      const cap = live && input.captured;
      const dx = cap ? input.mouse.dx : 0, dy = cap ? input.mouse.dy : 0;
      const sens = input.sensitivity || 0.0024, inv = input.invertY ? -1 : 1;
      this.steering = cap && ((input.mouse.down[2] && !this.onControl) || (!!S.mouseSteer && !down('AltLeft')));
      if (dx || dy) { this.mouseIdle = 0; this.recenter = false; } else this.mouseIdle += dt;
      if (cap && input.mouse.clicked[1]) this.recenter = true;
      this.headYaw = clamp(this.headYaw - dx * sens, -TUNE.headYaw, TUNE.headYaw);
      this.headPitch = clamp(this.headPitch - dy * sens * inv, -TUNE.headDown, TUNE.headUp);
      if (this.recenter) {
        const k = k1(16, dt); this.headYaw -= this.headYaw * k; this.headPitch -= this.headPitch * k;
        if (Math.abs(this.headYaw) + Math.abs(this.headPitch) < 0.002) { this.headYaw = 0; this.headPitch = 0; this.recenter = false; }
      }
      // chase view: the orbit eases back behind the ship once the mouse rests
      if (this.view === 1 && !this.steering && this.mouseIdle > 1) { const k = k1(1.6, dt); this.headYaw -= this.headYaw * k; this.headPitch -= this.headPitch * k; }
      // switches
      if (hit('KeyF')) this.toggleGear();
      if (hit('KeyL')) this.setLights(!this.lights);
      if (hit('KeyR')) this.setRamp(!this.rampOpen);
      if (hit('KeyG')) this.toggleAuto();
      if (hit('KeyV')) { if (this.state === 'landed') return 'exit'; this.assistLand(this.state !== 'landing'); }
      // throttle lever: W/S move it and it stays; a short detent at zero before reverse; wheel in 10 % notches
      const thrIn = (down('KeyW') || down('ArrowUp') ? 1 : 0) - (down('KeyS') || down('ArrowDown') ? 1 : 0);
      const x0 = hit('KeyX');
      if (x0) { this.throttle = 0; this.detent = 0; this.boostWant = false; }
      if (thrIn) {
        let nt = this.throttle + thrIn * dt * TUNE.thrRate;
        if (thrIn < 0 && this.throttle > 0 && nt <= 0) { nt = 0; this.detent = 0.35; }
        else if (thrIn < 0 && this.throttle <= 0 && this.detent > 0) { this.detent -= dt; nt = 0; }
        this.throttle = clamp(nt, -TUNE.rev, 1);
      }
      const wheel = cap ? input.mouse.wheel : 0;
      if (wheel) this.throttle = clamp(Math.round((this.throttle - wheel * 0.1) * 20) / 20, -TUNE.rev, 1);
      // stick
      const turnK = (down('KeyA') || down('ArrowLeft') ? 1 : 0) - (down('KeyD') || down('ArrowRight') ? 1 : 0);
      const climbK = (down('Space') ? 1 : 0) - (down('ShiftLeft') || down('ShiftRight') ? 1 : 0);
      this.boostWant = down('KeyB');
      let turn = turnK, climb = climbK;
      if (this.steering && !turnK) turn = clamp(this.headYaw / (28 * DEG), -1, 1);
      if (this.steering && !climbK && this.state !== 'landed') { const hp = this.headPitch, dz = 2 * DEG; climb = clamp((Math.abs(hp) < dz ? 0 : hp - Math.sign(hp) * dz) / (22 * DEG), -1, 1); }
      // a cold ship starts by itself when you ask it to fly
      if (!this.running && (thrIn > 0 || climbK > 0 || wheel < 0)) this.autoStart();
      // any flight input hands the controls back (autopilot, assisted landing)
      const mouseFly = this.steering && (dx || dy);
      if (this.auto && (thrIn || turnK || climbK || x0 || wheel || mouseFly)) this.stopAuto(T('g.fl.autoOff'));
      if (this.state === 'landing' && (thrIn > 0 || turnK || climbK > 0 || x0 || wheel < 0 || mouseFly)) this.state = 'flying';
      if (!this.auto) { this.ctl.turn = turn; this.ctl.climb = climb; this.ctl.strafe = 0; this.ctl.speed = null; }
      return null;
    }
    toggleGear() {
      if (this.state === 'landed') { this.say(T('g.fl.gearGround')); return; }
      this.gearAuto = false; this.gearHigh = false; this.gearDown = !this.gearDown;
      this.sfx('servo');
    }
    setLights(on) { this.lights = !!on; this.sfx('switch'); }
    setRamp(open) {
      if (open && this.speed > TUNE.rampMax) { this.say(T('g.fl.rampLocked', { v: TUNE.rampMax })); this.sfx('deny'); return false; }
      this.rampOpen = !!open; this.sfx('servo'); return true;
    }
    assistLand(on) {
      if (!on) { this.state = 'flying'; this.holdAlt = null; return; }
      if (this.state === 'landed') return;
      this.state = 'landing'; this.throttle = 0; this.boost = false; this.holdAlt = null;
      if (this.auto && !this.auto.landing) this.stopAuto(null);
      this.say(T('g.fl.landing'));
    }
    say(t) { const ui = this.g.ui; if (ui && ui.hint) ui.hint(t, 1800); }
    sfx(n, o) { const a = this.g.audio; if (a) a.play(n, o); }

    // ---------------------------------------------------------------- physics
    simulate(dt) {
      const b = this.b, p = b.pos, v = b.vel, cr = this.cruise;
      if (this.power === 'starting') { this.startT += dt; if (this.startT >= TUNE.startTime) { this.power = 'running'; this.startT = TUNE.startTime; this.sfx('clunk', { vol: 0.5 }); } }
      for (let i = 0; i < 3; i++) { if (!isFinite(p[i])) p[i] = this.lastGood ? this.lastGood[i] : 100; if (!isFinite(v[i])) v[i] = 0; }
      // boost: B burns the energy bar (≈ 5 s), it refills a moment after you let go
      const wantB = this.boostWant && this.state === 'flying';
      if (wantB && !this.boost && this.energy > 0.15) { this.boost = true; this.fovKick = 0.09; this.bump = Math.max(this.bump, 0.5); this.sfx('boost'); }
      if (this.boost && (!wantB || this.energy <= 0)) { this.boost = false; this.boostCool = 0.8; }
      if (this.boost) this.energy = Math.max(0, this.energy - dt / TUNE.boostTime);
      else { this.boostCool -= dt; if (this.boostCool <= 0) this.energy = Math.min(1, this.energy + dt / TUNE.boostRefill); }
      // gear: automatic below 10 m and 25 m/s (F takes over until you have been high again)
      const hs0 = Math.hypot(v[0], v[2]);
      if (!this.gearAuto && this.alt !== null && this.alt > 30) this.gearHigh = true;
      if (!this.gearAuto && this.gearHigh && this.alt !== null && this.alt < TUNE.gearAlt) this.gearAuto = true;
      if (this.gearAuto) { const low = this.alt !== null && this.alt < TUNE.gearAlt && hs0 < TUNE.gearSpeed; if (this.state === 'landed' || this.state === 'landing' || low) this.gearDown = true; else if (this.alt === null || this.alt > TUNE.gearAlt + 2 || hs0 > TUNE.gearSpeed + 3) this.gearDown = false; }
      const g0 = this.gear;
      this.gear = clamp(this.gear + (this.gearDown ? 1 : -1) * dt / TUNE.gearTime, 0, 1);
      if (g0 !== this.gear && (this.gear === 1 || this.gear === 0)) this.sfx('clunk', { vol: 0.5 });
      if (b.setGear) b.setGear(this.gear);
      if (!b.hatch) this.ramp = clamp(this.ramp + (this.rampOpen ? 1 : -1) * dt / 2.2, 0, 1);   // (a cabin's ramp moves with its hatches)
      if (this.rampOpen && this.speed > TUNE.rampMax + 4) this.rampOpen = false;   // the slipstream slams it shut
      // ---- on the ground
      if (this.state === 'landed') {
        v[0] = 0; v[1] = 0; v[2] = 0; this.vF = 0; this.yawRate = 0;
        if (this.running && (this.throttle > 0.05 || this.ctl.climb > 0.05 || (this.ctl.speed !== null && this.ctl.speed > 0.5))) { this.state = 'flying'; this.holdAlt = p[1] + 2.5; this.sfx('clunk', { vol: 0.3 }); }
        else { this.attitude(dt, 0, 0); this.suspension(dt); this.lastGood = p.slice(); return; }
      }
      const h0 = b.heading, fx = -Math.sin(h0), fz = -Math.cos(h0), rx = Math.cos(h0), rz = -Math.sin(h0);
      let vF = v[0] * fx + v[2] * fz, vR = v[0] * rx + v[2] * rz, vy = v[1];
      const vF0 = vF;
      // ---- forward: the lever sets a target speed; accelerate 8, brake 12 m/s² (afterburner 18)
      let tgt = this.ctl.speed !== null ? this.ctl.speed : this.boost ? cr * TUNE.boostK : this.throttle * cr;
      if (this.state === 'landing' && this.ctl.speed === null) tgt = 0;
      if (vF < tgt) vF = Math.min(tgt, vF + (vF < 0 ? TUNE.brake : this.boost ? TUNE.boostAccel : TUNE.accel) * dt);
      else if (vF > tgt) vF = Math.max(tgt, vF - (vF > 0 ? TUNE.brake : TUNE.accel) * dt);
      // ---- sideways: slip fades (the autopilot may slide sideways on its final approach)
      const st = this.ctl.strafe || 0;
      vR = st + (vR - st) * Math.exp(-TUNE.slip * dt);
      // ---- turn: yaw rate follows the stick in 0.22 s; 1.2 rad/s hovering, 0.8 at cruise
      const sp = Math.abs(vF);
      const rmax = (TUNE.turnHover + (TUNE.turnCruise - TUNE.turnHover) * clamp(sp / cr, 0, 1)) * (this.b.agility || 1) * (this.boost ? 0.85 : 1);
      this.yawRate += (clamp(this.ctl.turn, -1, 1) * rmax - this.yawRate) * k1(1 / TUNE.turnTau, dt);
      let dh = this.yawRate * dt;
      this.skyClear = this.clearSky(Math.hypot(v[0], v[1], v[2]) * dt + 1);
      if (dh && !this.skyClear && !this.stuckT && b.hits(p[0], p[1], p[2], h0 + dh)) { dh = 0; this.yawRate *= 0.3; }
      if (dh) b.heading = h0 + dh;
      // flying with the mouse: the aim stays where you put it while the ship turns under it
      if (this.steering && dh) this.headYaw = clamp(this.headYaw - dh, -TUNE.headYaw, TUNE.headYaw);
      // ---- vertical: Space/Shift climb up to 14 m/s, otherwise hold the altitude
      let vyT;
      if (this.state === 'landing') vyT = this.flareSink();
      else if (Math.abs(this.ctl.climb) > 0.01) { vyT = this.ctl.climb * TUNE.climb; this.holdAlt = null; }
      else { if (this.holdAlt === null) this.holdAlt = p[1] + vy * 0.3; vyT = clamp((this.holdAlt - p[1]) * 2.2, -TUNE.climb, TUNE.climb); }
      if (p[1] + (b.height || 4) > 252 && vyT > 0) vyT = 0;
      // ground cushion: below 8 m the ship can't sink faster than max(1.5, 0.8 × height) (and it starts easing off above)
      const alt = this.alt;
      if (alt !== null) { const lim = Math.max(1.5, 0.8 * clamp(alt, 0, TUNE.cushion) + Math.sqrt(18 * Math.max(0, alt - TUNE.cushion))); if (vyT < -lim) vyT = -lim; }
      vy += clamp(vyT - vy, -TUNE.vAcc * dt, TUNE.vAcc * dt);
      if (alt !== null && alt < TUNE.cushion && vy < 0) vy = Math.max(vy, -Math.max(1.5, 0.8 * Math.max(0, alt)) - 0.4);
      // ---- compose & move
      v[0] = fx * vF + rx * vR; v[1] = vy; v[2] = fz * vF + rz * vR;
      this.vF = vF;
      this.move(dt);
      // ---- contact with the ground: the gear carries the ship; slow + low = landed
      this.alt = this.clearance();
      this.contact(dt);
      // ---- a block inside the hull: after 0.2 s look for free space (8 m up, then ±4 m sideways)
      if (!this.skyClear && this.inside()) { this.stuckT += dt; if (this.stuckT > TUNE.stuck) this.unstick(); }
      else this.stuckT = 0;
      // ---- attitude: bank into the turn, nose follows climb / acceleration
      const acc = (vF - vF0) / dt;
      const bankK = clamp(0.25 + sp / 20, 0.25, 1);
      const rollT = clamp(this.yawRate / (TUNE.turnCruise * (this.b.agility || 1)), -1, 1) * TUNE.bank * bankK;
      let pitchT = clamp(v[1] / TUNE.climb * 0.12 - acc * 0.006, -0.18, 0.18);
      // the flare: the nose comes up over the last 9 m of the approach
      if (this.state === 'landing' && alt !== null && alt < 9) pitchT = clamp(pitchT + 0.1 * (1 - Math.max(0, alt) / 9), -0.18, 0.2);
      this.attitude(dt, rollT, pitchT);
      this.suspension(dt);
      this.lastGood = p.slice();
    }
    attitude(dt, rollT, pitchT) {
      this.roll += (rollT - this.roll) * k1(1 / TUNE.bankTau, dt);
      this.pitch += (pitchT - this.pitch) * k1(3, dt);
      if (Math.abs(this.roll) < 1e-5) this.roll = 0; if (Math.abs(this.pitch) < 1e-5) this.pitch = 0;
      this.b.setAttitude(this.pitch, this.roll); this.orient();
    }
    suspension(dt) {
      // the dip after a touchdown: a damped spring (visual only)
      this.dipV += (-this.dip * 140 - this.dipV * 11) * dt; this.dip += this.dipV * dt;
      if (Math.abs(this.dip) < 1e-4 && Math.abs(this.dipV) < 1e-3) { this.dip = 0; this.dipV = 0; }
      this.dip = clamp(this.dip, -0.35, 0.2);
      if (this.b.setDip) this.b.setDip(this.dip);
    }
    // sub-stepped movement (≤ 0.5 m a step): slides along whatever it touches
    move(dt) {
      const b = this.b, p = b.pos, v = b.vel, h = b.heading;
      let dx = v[0] * dt, dy = v[1] * dt, dz = v[2] * dt;
      const L = Math.hypot(dx, dy, dz); if (!(L > 0)) return;
      const n = Math.max(1, Math.ceil(L / TUNE.stepLen));
      const free = this.skyClear || this.stuckT > 0;
      let imp = 0;
      for (let i = 0; i < n; i++) {
        const sx = dx / n, sy = dy / n, sz = dz / n;
        if (free || !b.hits(p[0] + sx, p[1] + sy, p[2] + sz, h)) { p[0] += sx; p[1] += sy; p[2] += sz; continue; }
        // blocked: horizontal and vertical separately, then x and z alone
        if ((sx || sz) && !b.hits(p[0] + sx, p[1], p[2] + sz, h)) { p[0] += sx; p[2] += sz; }
        else {
          if (sx && !b.hits(p[0] + sx, p[1], p[2], h)) p[0] += sx; else if (sx) { imp += v[0] * v[0]; v[0] = Math.abs(v[0]) > 12 ? -v[0] * 0.12 : 0; dx = 0; }
          if (sz && !b.hits(p[0], p[1], p[2] + sz, h)) p[2] += sz; else if (sz) { imp += v[2] * v[2]; v[2] = Math.abs(v[2]) > 12 ? -v[2] * 0.12 : 0; dz = 0; }
        }
        if (sy && !b.hits(p[0], p[1] + sy, p[2], h)) p[1] += sy;
        else if (sy) { if (sy < 0) this.belly = true; imp += v[1] * v[1]; v[1] = 0; dy = 0; }
      }
      if (imp > 4) this.impact(Math.sqrt(imp));
    }
    impact(s) {
      const g = this.g, now = this.t;
      this.bump = Math.max(this.bump, Math.min(3, s / 10));
      // (pressing on against a wall must not rattle every frame)
      if (now - (this.impT || -9) < 0.3 && s < (this.impS || 0) * 1.5) return;
      this.impT = now; this.impS = s;
      if (s > 12) { this.sfx('explode', { vol: Math.min(0.6, 0.12 + s / 80) }); g.damageFlash = Math.min(0.5, s / 60); }
      else this.sfx('thump', { vol: Math.min(1, 0.25 + s / 14) });
      if (s > 6 && g.particles) { const c = this.toWorld(this.b.center); g.particles.spark(c[0], c[1], c[2], [1, 0.75, 0.4], Math.min(24, 4 + s | 0), 4); }
    }
    // touchdown & gear contact
    contact(dt) {
      const b = this.b, p = b.pos, v = b.vel;
      let alt = this.alt;
      const onGear = this.gear > 0.5 && b.gearFeet && b.gearFeet.length;
      if (alt !== null && onGear && alt < 0) {
        // feet below the ground (sloping ground, a skimming pass): the gear lifts the ship
        const push = Math.min(-alt, 1.2);
        if (!b.hits(p[0], p[1] + push, p[2], b.heading)) { p[1] += push; alt += push; }
        if (v[1] < 0) { if (v[1] < -3) this.impact(-v[1]); v[1] = 0; }
        this.alt = alt;
      }
      const hs = Math.hypot(v[0], v[2]);
      const touching = (alt !== null && alt <= 0.04) || this.belly;
      this.belly = false;
      if (touching && hs < TUNE.landSpeed && v[1] <= 0.05 && this.ctl.climb <= 0 && (this.state === 'landing' || (this.ctl.speed === null && this.throttle <= 0.05))) this.touchdown(alt);
    }
    touchdown(alt) {
      const b = this.b, p = b.pos, v = b.vel, vimp = Math.max(0, -v[1]);
      if (alt !== null && alt > 0 && alt < 0.3 && !b.hits(p[0], p[1] - alt, p[2], b.heading)) p[1] -= alt;
      this.state = 'landed'; this.throttle = 0; this.boost = false; this.holdAlt = null;
      v[0] = 0; v[1] = 0; v[2] = 0; this.vF = 0; this.yawRate = 0; this.alt = Math.max(0, alt || 0);
      this.dipV = -Math.min(2.4, 0.5 + vimp * 0.7);
      this.sfx('thump', { vol: Math.min(1, 0.35 + vimp * 0.25) });
      this.dust(1.4, 40);
      const A = this.auto;
      if (A && A.landing) {
        this.auto = null;
        const g = this.g, name = A.site.name;
        g.ui.chatLine(T('g.fl.welcomeChat', { name }), '#ffd98a'); g.ui.hint(T('g.fl.welcome', { name }), 3000);
        if (g.codex && g.codex.event) g.codex.event('autopilot');
      }
    }
    // the approach glides down at up to 10 m/s, then the flare: the sink eases off as the gear nears the ground
    // (a 1.4 s time constant), so the touchdown is soft and nothing bounces
    flareSink() {
      const a = this.alt;
      return a === null ? -6 : -clamp(0.7 * a + 0.5, 0.5, 10);
    }
    unstick() {
      const b = this.b, p = b.pos, h = b.heading;
      const ok = (x, y, z) => !b.overlaps(x, y, z, h);
      let to = null;
      for (let dy = 1; dy <= 8 && !to; dy++) if (ok(p[0], p[1] + dy, p[2])) to = [p[0], p[1] + dy, p[2]];
      for (let r = 1; r <= 4 && !to; r++) for (const [ox, oz] of [[r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, -r], [r, -r], [-r, r]]) {
        for (const dy of [0, 1, 2, 3, 4, 6, 8]) if (ok(p[0] + ox, p[1] + dy, p[2] + oz)) { to = [p[0] + ox, p[1] + dy, p[2] + oz]; break; }
        if (to) break;
      }
      this.stuckT = 0;
      if (!to) return false;
      p[0] = to[0]; p[1] = to[1]; p[2] = to[2];
      b.vel[0] = 0; b.vel[1] = 0; b.vel[2] = 0;
      if (this.holdAlt !== null) this.holdAlt = p[1];
      if (this.state === 'landed') this.state = 'flying';
      this.bump = Math.max(this.bump, 1); this.sfx('thump', { vol: 0.5 });
      return true;
    }

    // ---------------------------------------------------------------- the ground below
    // top surface (solid or fluid) at or below y in the column (x, z); null when the column isn't loaded
    groundTop(x, y, z, depth) {
      const w = this.g.world; if (!w) return null;
      const xi = Math.floor(x), zi = Math.floor(z), c = w.col(xi >> 4, zi >> 4);
      if (!c) return null;
      const top = c.height[((zi & 15) << 4) | (xi & 15)];
      if (top + 1 <= y) return top + 1;
      const BT = R.T;
      for (let yy = Math.min(Math.floor(y), VR.MAXY - 1); yy > y - depth && yy >= 0; yy--) {
        const s = c.blocks[(yy << 8) | ((zi & 15) << 4) | (xi & 15)];
        if (s && (BT.flags[s] & (F.SOLID | F.FLUID)) && !(BT.flags[s] & F.REPLACE)) return yy + 1;
      }
      return -1e9;
    }
    // height of the lowest support point (gear feet, or the belly) above the ground; null = nothing loaded below
    clearance() {
      const b = this.b, feet = this.gear > 0.5 && b.gearFeet && b.gearFeet.length ? b.gearFeet : b.belly;
      if (!feet || !feet.length) return null;
      const h = b.heading, c = Math.cos(h), s = Math.sin(h), p = b.pos;
      let best = Infinity;
      for (const f of feet) {
        const wx = p[0] + f[0] * c + f[2] * s, wz = p[2] - f[0] * s + f[2] * c, wy = p[1] + f[1];
        const gt = this.groundTop(wx, wy + 0.6, wz, 96);
        if (gt === null) continue;
        if (wy - gt < best) best = wy - gt;
      }
      return best === Infinity ? null : (best < -1e8 ? 999 : best);
    }
    // the whole ship is 3 m above everything around it: no collision tests needed this frame
    clearSky(margin) {
      const b = this.b, p = b.pos, w = this.g.world; if (!w) return false;
      const r = (b.radius || 8) + margin + 1;
      const bottom = p[1] + (b.bottom || 0);
      const cx0 = Math.floor(p[0] - r) >> 4, cx1 = Math.floor(p[0] + r) >> 4, cz0 = Math.floor(p[2] - r) >> 4, cz1 = Math.floor(p[2] + r) >> 4;
      // (the height maps of the few chunks around: a couple of thousand reads, fresh every frame so a block set
      // right next to the ship counts at once)
      const lim = bottom - 4 - margin;
      for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) {
        const c = w.col(cx, cz); if (!c) continue;
        const H = c.height; for (let i = 0; i < 256; i++) if (H[i] > lim) return false;
      }
      return true;
    }

    // ---------------------------------------------------------------- sound, shake, particles
    effects(dt) {
      const g = this.g, b = this.b, v = b.vel, S = g.settings || {};
      const sp = this.speed = Math.hypot(v[0], v[1], v[2]);
      const cr = this.cruise;
      // engine spool follows the lever (hovering needs some thrust too)
      const demand = !this.running ? (this.power === 'starting' ? 0.3 * this.startT / TUNE.startTime : 0) : this.state === 'landed' ? 0.08 : clamp(Math.max(Math.abs(this.ctl.speed !== null ? this.ctl.speed / cr : this.throttle), Math.abs(this.ctl.climb) * 0.6, 0.2) + (this.boost ? 0.45 : 0), 0, 1.45);
      this.spool += (demand - this.spool) * k1(this.spool < demand ? 1.1 : 0.6, dt);
      if (g.audio) {
        g.audio.loop('engine', 0.08 + this.spool * 0.2, 0.22 + Math.min(1, sp / 70) * 0.8);
        if (g.audio.turbine) g.audio.turbine(0.025 + this.spool * 0.05, this.spool);
      }
      g.flightWind = Math.min(0.9, (sp / 75) * (sp / 75) * 0.7);
      // the radio: soft static with bursts of chatter
      if (g.audio) {
        let lv = 0;
        if (this.radio && this.power !== 'off') { this.chatT -= dt; if (this.chatT < -1.4) this.chatT = 2 + Math.random() * 5; lv = 0.025 + (this.chatT < 0 ? 0.07 * (0.6 + 0.4 * Math.sin(this.t * 31) * Math.sin(this.t * 7.3)) : 0); }
        g.audio.loop('radio', lv);
      }
      // smooth camera shake: speed rumble, ground effect, boost, impacts
      const lowAlt = this.alt !== null && this.alt < 6 && sp > 6 ? (1 - this.alt / 6) * 0.35 : 0;
      const amp = S.camShake === false ? 0 : clamp(0.22 * (sp / cr) * (sp / cr) * (this.boost ? 1.5 : 1) + lowAlt + this.bump + 0.03 * this.spool, 0, 3);
      this.bump = Math.max(0, this.bump - dt * 2.2);
      this.shakeAmp += (amp - this.shakeAmp) * k1(5, dt);
      const t = this.t, A = this.shakeAmp;
      const n = (a, b2, c) => Math.sin(t * a + b2) * 0.5 + Math.sin(t * a * 1.73 + c) * 0.32 + Math.sin(t * a * 2.71 + b2 * 2.1) * 0.18;
      this.shake[0] = n(9.3, 1.7, 2.9) * A * 0.006; this.shake[1] = n(11.7, 0.3, 4.1) * A * 0.006; this.shake[2] = n(7.9, 2.2, 1.3) * A * 0.007; this.shake[3] = n(13.1, 3.1, 0.7) * A * 0.02;
      // FOV: up to +10 % with speed, a kick when the boost lights
      const vmax = cr * TUNE.boostK;
      this.fovKick += ((this.boost ? 0.05 : 0) - this.fovKick) * k1(1.8, dt);
      this.fovK = 1 + 0.1 * clamp((sp - cr * 0.25) / (vmax - cr * 0.25), 0, 1) + this.fovKick;
      // acceleration (for the chase camera's lag)
      for (let i = 0; i < 3; i++) { const a = (v[i] - this.lastV[i]) / dt; this.accSm[i] += (clamp(a, -40, 40) - this.accSm[i]) * k1(4, dt); this.lastV[i] = v[i]; }
      this.fx(dt, sp);
    }
    fx(dt, sp) {
      const g = this.g, b = this.b, P = g.particles, TR = g.trails;
      const low = g.settings && (g.settings.preset === 'potato' || g.settings.particles === 0);
      const thrust = clamp(this.spool, 0.1, 1.45), boost = this.boost;
      const ex = b.exhaust || [];
      const dir = this.dirWorld([0, 0, 1]);
      // the plume: cyan-white at cruise (the trailer's long luminous trails), orange-white flames while hovering
      const hot = !boost && sp < this.cruise * 0.3;
      for (let i = 0; i < ex.length; i++) {
        const e = ex[i];
        if (TR && this.spool > 0.05) TR.engine('fl' + this.id + ':' + i, this.toWorld([e[0], e[1], e[2] + 0.3]), sp, { thrust: Math.min(1.3, thrust), size: (e[3] || 0.5) * (boost ? 1.45 : 1), col: hot ? [1, 0.6, 0.28] : boost ? [0.42, 0.85, 1] : [0.52, 0.92, 1], minor: i > 1 });
        if (!P || this.state === 'landed' || !this.running || Math.random() > (low ? 0.25 : 0.35) + thrust * 0.5) continue;
        const wp = this.toWorld([e[0] + (Math.random() - 0.5) * e[3], e[1] + (Math.random() - 0.5) * e[3], e[2] + 0.2]), vv = 6 + thrust * 16 + (boost ? 14 : 0), v = b.vel;
        P.spawn(wp[0], wp[1], wp[2], dir[0] * vv + v[0] * 0.7, dir[1] * vv + v[1] * 0.7, dir[2] * vv + v[2] * 0.7, { life: 0.14 + thrust * 0.2 + (boost ? 0.12 : 0), size: (e[3] || 0.5) * (0.5 + thrust * 0.45) * (boost ? 1.3 : 1), grav: 0, col: boost ? [0.6, 0.9, 1] : hot ? [1, 0.7, 0.35] : [0.48, 0.82, 1], emis: 1, drag: 2, grow: 0.7, collide: false });
      }
      // engine wash: dust (or spray) blown off the ground below 8 m
      if (this.alt !== null && this.alt < TUNE.cushion && this.state !== 'landed' && P) {
        const k = (1 - this.alt / TUNE.cushion) * (0.4 + Math.min(1, this.spool));
        this.dust(k, low ? 1 : 3);
      }
      // wingtip vapour in hard, fast turns and on the boost
      const wt = b.wingtips;
      if (TR && wt && sp > this.cruise * 0.7 && (Math.abs(this.yawRate) > 0.3 || boost || Math.abs(this.roll) > 0.35)) {
        const k = clamp((sp - this.cruise * 0.7) / (this.cruise * 0.5), 0.15, 1) * (boost ? 1 : clamp(Math.abs(this.yawRate) / 0.8, 0.3, 1));
        for (let i = 0; i < wt.length; i++) { const q = this.toWorld(wt[i]); TR.emit('fl' + this.id + 'v' + i, q[0], q[1], q[2], { kind: 'smoke', col: [1, 1, 1], width: 0.22, grow: 1.4, life: low ? 0.5 : 0.9, step: 0.9, k: k * 0.85, max: low ? 16 : 40 }); }
      }
      // strobes on the wingtips with the lights on
      if (this.lights && P && wt && (this.strobeT -= this.dt) <= 0) {
        this.strobeT = 1.1;
        wt.forEach((q, i) => { const w = this.toWorld(q); P.spawn(w[0], w[1], w[2], b.vel[0], b.vel[1], b.vel[2], { life: 0.12, size: 0.5, grav: 0, col: i ? [0.4, 1, 0.5] : [1, 0.3, 0.3], emis: 1, drag: 0, collide: false }); });
      }
    }
    dust(k, n) {
      const g = this.g, P = g.particles, b = this.b; if (!P || k <= 0) return;
      const c = this.flat(b.center || [0, 0, 0], b.heading), r = Math.max(2, (b.radius || 6) * 0.6);
      for (let i = 0; i < n; i++) {
        if (Math.random() > k) continue;
        const a = Math.random() * TAU, d = Math.random() * r, x = c[0] + Math.cos(a) * d, z = c[2] + Math.sin(a) * d;
        const gt = this.groundTop(x, b.pos[1] + 1, z, 12); if (gt === null || gt < -1e8) continue;
        const w = this.g.world.getBlock(Math.floor(x), gt - 1, Math.floor(z)), wet = w && (R.T.flags[w] & F.FLUID);
        const s = 4 + Math.random() * 6;
        P.spawn(x, gt + 0.15, z, Math.cos(a) * s, 0.4 + Math.random() * (wet ? 2.5 : 1), Math.sin(a) * s, { life: 0.7 + Math.random() * 0.7, size: 0.25 + Math.random() * 0.3, grav: wet ? 6 : -0.3, col: wet ? [0.85, 0.92, 1] : [0.66, 0.6, 0.5], drag: 1.6, grow: 1.1, collide: false });
      }
    }

    // ---------------------------------------------------------------- cameras
    headYawEff() { const k = smooth(this.backT); if (!k) return this.headYaw; const side = this.headYaw < -0.05 ? -1 : 1; return this.headYaw + (side * TUNE.lookBack - this.headYaw) * k; }
    headPitchEff() { const k = smooth(this.backT); return this.headPitch + (0.04 - this.headPitch) * k; }
    // renderer angles (yaw, pitch, roll) of a camera-to-world rotation
    euler(C) {
      const fx = -C[8], fy = -C[9], fz = -C[10];
      const yaw = Math.atan2(-fx, -fz), pitch = Math.asin(clamp(fy, -1, 1));
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      const a = C[0] * cy - C[2] * sy, bb = C[0] * sy * sp + C[1] * cp + C[2] * cy * sp;
      return { yaw, pitch: clamp(pitch, -1.55, 1.55), roll: -Math.atan2(bb, a) };
    }
    eyeWorld() { const e = this.b.eye; return this.toWorld([e[0], e[1] + this.dip, e[2]]); }
    camera(cam) {
      const g = this.g, p = g.player, dt = this.dt;
      this.orient();
      g.camMode = this.view === 0 ? 0 : 1;   // the ship's view decides first / third person while you fly
      const fov = cam.fov * this.fovK;
      let out;
      if (this.view === 0) out = this.cockpitCam(cam);
      else if (this.view === 1) out = this.chaseCam(cam, dt);
      else out = this.cineCam(cam, dt);
      out.fixed = true; out.fov = out.fov || fov; if (this.view !== 0) out.far = (cam.far || 1000) + 60;
      if (p) { p.yaw = out.yaw; p.pitch = clamp(out.pitch, -1.55, 1.55); }
      return out;
    }
    cockpitCam(cam) {
      const sh = this.shake, e = this.b.eye;
      const w = this.toWorld([e[0], e[1] + this.dip + sh[3], e[2]]);
      const C = this.C4; C.set(this.R3);
      mat4.rotY(C, C, this.headYawEff() + sh[0]); mat4.rotX(C, C, this.headPitchEff() + sh[1]); if (sh[2]) mat4.rotZ(C, C, sh[2]);
      const a = this.euler(C);
      return Object.assign(cam, { x: w[0], y: w[1], z: w[2], yaw: a.yaw, pitch: a.pitch, roll: a.roll, fov: cam.fov * this.fovK });
    }
    // behind the ship on a spring that follows its heading; the mouse orbits and it eases back
    chaseCam(cam, dt) {
      const b = this.b, w = this.g.world, h = b.heading;
      if (this.chaseYaw === null) this.chaseYaw = h;
      this.chaseYaw += wrapA(h - this.chaseYaw) * k1(3.2, dt);
      const c = this.flat(b.center || [0, 0, 0], h);
      const D = Math.max(8, (b.radius || 6) * 1.9), el = clamp(0.2 + this.headPitchEff(), -0.35, 1.3), a = this.chaseYaw + this.headYawEff();
      const A = this.accSm;
      let tx = c[0] + Math.sin(a) * Math.cos(el) * D - A[0] * 0.035, ty = c[1] + Math.sin(el) * D + (b.height || 3) * 0.3 - A[1] * 0.02, tz = c[2] + Math.cos(a) * Math.cos(el) * D - A[2] * 0.035;
      const dx = tx - c[0], dy = ty - c[1], dz = tz - c[2], L = Math.hypot(dx, dy, dz) || 1;
      const hit = w ? PH.raycast((x, y, z) => w.getBlock(x, y, z), c[0], c[1], c[2], dx / L, dy / L, dz / L, L) : null;
      if (hit) { const d = Math.max(1.5, hit.dist - 0.6); tx = c[0] + dx / L * d; ty = c[1] + dy / L * d; tz = c[2] + dz / L * d; }
      const sh = this.shake;
      const fwd = [-Math.sin(h), 0, -Math.cos(h)], lx = c[0] + fwd[0] * D * 0.3, ly = c[1] + 0.8, lz = c[2] + fwd[2] * D * 0.3;
      const vx = lx - tx, vy = ly - ty, vz = lz - tz;
      return Object.assign(cam, { x: tx, y: ty + sh[3] * 0.5, z: tz, yaw: Math.atan2(-vx, -vz) + sh[0] * 0.5, pitch: Math.atan2(vy, Math.hypot(vx, vz)) + sh[1] * 0.5, roll: -this.roll * 0.22, fov: cam.fov * (1 + (this.fovK - 1) * 0.6) });
    }
    // automatic shots every 6–8 s: fly-bys, wing cam, slow orbits, low tracking (eased with the Director's keys)
    cineCam(cam, dt) {
      const b = this.b, h = b.heading, sp = this.speed;
      if (this.chaseYaw === null) this.chaseYaw = h;
      this.chaseYaw += wrapA(h - this.chaseYaw) * k1(1.5, dt);
      const c = this.flat(b.center || [0, 0, 0], h);
      const D = Math.max(9, (b.radius || 6) * 2.1), H = b.height || 3;
      let s = this.shot;
      if (!s || s.t > s.dur) {
        const kinds = ['orbit', 'flyby', 'wing', 'low', 'top'];
        let kind = kinds[Math.floor(Math.random() * kinds.length)];
        if (s && kind === s.kind) kind = kinds[(kinds.indexOf(kind) + 1) % kinds.length];
        if (kind === 'flyby' && sp < 8) kind = 'orbit';
        const side = Math.random() < 0.5 ? -1 : 1;
        s = this.shot = { kind, t: 0, dur: 6 + Math.random() * 2, side };
        if (kind === 'flyby') {
          const v = b.vel, L = Math.hypot(v[0], v[1], v[2]) || 1, ahead = sp * 3.2 + D * 1.5, rx = -v[2] / L, rz = v[0] / L;
          const x = c[0] + v[0] / L * ahead + rx * side * (D * 0.9 + 4), z = c[2] + v[2] / L * ahead + rz * side * (D * 0.9 + 4);
          const gt = this.groundTop(x, c[1] + 40, z, 80);
          s.pos = [x, Math.max(c[1] + v[1] / L * ahead + (Math.random() * 6 - 2), (gt !== null && gt > -1e8 ? gt : 0) + 2.5), z];
        } else if (kind === 'orbit') { const a0 = Math.random() * TAU; s.keys = [[0, [Math.sin(a0) * D * 1.3, H * 0.8, Math.cos(a0) * D * 1.3], [0, H * 0.4, 0]], [s.dur, [Math.sin(a0 + side * 1.1) * D * 1.4, H * 1.6, Math.cos(a0 + side * 1.1) * D * 1.4], [0, H * 0.4, 0]]]; }
        else if (kind === 'low') s.keys = [[0, [-side * D * 0.45, 0.6, D * 0.95], [0, H * 0.35, -D * 0.7]], [s.dur, [side * D * 0.55, H * 1.2, D * 1.35], [0, H * 0.45, -D * 0.5]]];
        else if (kind === 'top') s.keys = [[0, [side * D * 0.3, D * 1.5, D * 0.5], [0, 0, -D * 0.2]], [s.dur, [side * D * 0.1, D * 1.1, -D * 0.3], [0, 0, -D * 0.6]]];
      }
      s.t += dt;
      const sh = this.shake;
      if (s.kind === 'flyby') {
        const vx = c[0] - s.pos[0], vy = c[1] + H * 0.3 - s.pos[1], vz = c[2] - s.pos[2];
        if (Math.hypot(vx, vz) > D * 9) s.t = s.dur + 1;
        return Object.assign(cam, { x: s.pos[0], y: s.pos[1], z: s.pos[2], yaw: Math.atan2(-vx, -vz), pitch: Math.atan2(vy, Math.hypot(vx, vz)), roll: 0, fov: cam.fov * 0.8 });
      }
      if (s.kind === 'wing') {
        const wt = b.wingtips && b.wingtips.length ? b.wingtips[s.side > 0 ? 1 : 0] : [s.side * (b.width || 6) * 0.5, H * 0.5, 0];
        const l = [wt[0] + s.side * 1.6, wt[1] + 1.1, wt[2] + (b.length || 10) * 0.18], q = this.toWorld(l), look = this.toWorld([0, H * 0.35, -(b.length || 10) * 0.9]);
        const vx = look[0] - q[0], vy = look[1] - q[1], vz = look[2] - q[2];
        return Object.assign(cam, { x: q[0], y: q[1] + sh[3], z: q[2], yaw: Math.atan2(-vx, -vz), pitch: Math.atan2(vy, Math.hypot(vx, vz)), roll: -this.roll, fov: cam.fov });
      }
      // eased keys in the heading frame (the Director's easing)
      const D0 = VR.Director && VR.Director.prototype.camAt ? VR.Director.prototype.camAt : null;
      const k = D0 ? D0.call(null, { keys: s.keys }, s.t) : { pos: s.keys[0][1], yaw: 0, pitch: -0.2 };
      const hy = this.chaseYaw, cy = Math.cos(hy), sy = Math.sin(hy), q = k.pos;
      return Object.assign(cam, { x: c[0] + q[0] * cy + q[2] * sy, y: c[1] + q[1], z: c[2] - q[0] * sy + q[2] * cy, yaw: k.yaw + hy, pitch: k.pitch, roll: 0, fov: cam.fov * 0.9 });
    }

    // ---------------------------------------------------------------- autopilot: fly me to the next village
    autoTargets() {
      const g = this.g, V = g.villages, p = this.b.pos; if (!V || !V.list) return [];
      const list = V.list().filter(v => Math.hypot(v.x - p[0], v.z - p[2]) > 140);
      // the Gate Temple's apron is a landing site too: the autopilot docks on the runway in front of the portal
      const H = VR.Heart;
      if (H && Math.hypot(H.TEMPLE.x - p[0], H.TEMPLE.front + 10 - p[2]) > 140) list.push({ id: 'temple', name: T('g.fl.templeName'), x: H.TEMPLE.x, z: H.TEMPLE.front + 10, y: H.PLAT + 1, dock: true });
      return list.sort((a, c) => Math.hypot(a.x - p[0], a.z - p[2]) - Math.hypot(c.x - p[0], c.z - p[2]));
    }
    toggleAuto() {
      const g = this.g, list = this.autoTargets();
      if (!list.length) { g.ui.hint(T('g.fl.noVillage'), 2600); return; }
      // G cycles through the villages, nearest first, then switches the autopilot off
      let i = 0;
      if (this.auto) { i = list.findIndex(v => v.id === this.auto.site.id) + 1; if (i <= 0 || i >= Math.min(list.length, 6)) { this.stopAuto(T('g.fl.autoOff2')); return; } }
      this.startAuto(list[i]);
    }
    startAuto(site) {
      const g = this.g, b = this.b, p = b.pos;
      if (!this.running) this.autoStart();
      const dx = site.x - p[0], dz = site.z - p[2], L = Math.hypot(dx, dz) || 1;
      const RAD = site.rad || (VR.VillageGen && VR.VillageGen.RAD) || 58;
      const A = this.auto = { site, spot: null, cruise: Math.max(p[1] + 18, site.y + 60, 120), t: 0, tries: 0, climb: 0, dist: L, eta: 0, refined: false, landing: false };
      // a dock site (the temple's apron) is a known field: no survey, the spot is the apron itself
      if (site.dock) { A.spot = [site.x + 0.5, site.y, site.z + 0.5]; A.refined = true; }
      if (this.state !== 'flying') { this.state = 'flying'; this.holdAlt = null; }
      // touch down just outside the houses, on the side we arrive from
      const base = Math.atan2(-dx, -dz), cand = [];
      for (const off of [0, 0.45, -0.45, 0.9, -0.9, 1.4, -1.4]) { const a = base + off, r = RAD + 10 + Math.max(b.length || 10, b.width || 8) * 0.5; cand.push([Math.round(site.x + Math.sin(a) * r), Math.round(site.z + Math.cos(a) * r)]); }
      const pts = [];
      for (const c of cand) for (const [ox, oz] of [[0, 0], [-6, -6], [6, -6], [-6, 6], [6, 6]]) pts.push([c[0] + ox, c[1] + oz]);
      // cruise altitude clears the highest ground under the whole route
      const N = Math.min(60, Math.ceil(L / 24));
      for (let i = 1; i <= N; i++) pts.push([Math.round(p[0] + dx * i / N), Math.round(p[2] + dz * i / N)]);
      if (g.pool) g.pool.direct(0, { type: 'surface', dim: g.dim || 'overworld', points: pts }, null, (msg) => {
        if (this.auto !== A || !msg.res || A.refined) return;
        const Hh = msg.res, SEA = VR.C.SEA;
        let best = null, bv = 1e9;
        cand.forEach((c, k) => { const hs = Hh.slice(k * 5, k * 5 + 5); const mn = Math.min(...hs), mx = Math.max(...hs); const v = (mx - mn) * 2 + k * 0.8 + (mn <= SEA + 1 ? 40 : 0); if (v < bv) { bv = v; best = [c[0] + 0.5, mx + 1, c[1] + 0.5]; } });
        A.spot = best;
        let top = 0; for (let i = cand.length * 5; i < Hh.length; i++) top = Math.max(top, Hh[i]);
        A.cruise = clamp(Math.max(top + 34, (best ? best[1] : site.y) + 45), 100, 236);
      });
      g.ui.chatLine(T('g.fl.auto', { site: site.name, km: (L / 1000).toFixed(1) }), '#9affd8');
      if (g.audio && g.audio.tone) g.audio.tone(660, 0.08, 0.1, 'triangle', true);
    }
    stopAuto(msg) { if (!this.auto) return; this.auto = null; this.ctl.speed = null; this.ctl.strafe = 0; if (msg) this.g.ui.hint(msg, 2200); }
    // near the destination, pick a real landing field from the loaded chunks: flat, dry, no trees or houses
    refineSpot(A) {
      const g = this.g, w = g.world, BT = R.T, VG = VR.VillageGen, site = A.site, RAD = site.rad || (VG && VG.RAD) || 58, p = this.b.pos;
      const ext = this.b.extent || [6, 8], hx = Math.ceil(ext[0]) + 1, hz = Math.ceil(ext[1]) + 1;
      const BAD = /leaves|log|wood|vx_|glass|fence|door|wheat|carrot|potato|beet|farmland|planks|bed|lamp|torch|chest|landing_pad|hazard|crystal|ice$/;
      const ground = (x, z) => {
        const c = w.col(x >> 4, z >> 4); if (!c || !c.ready) return null;
        let y = c.height[((z & 15) << 4) | (x & 15)];
        for (let k = 0; k < 3 && y > 1; k++) { const bl = w.getBlock(x, y, z); if (bl && (BT.flags[bl] & F.SOLID)) break; y--; }
        const bl = w.getBlock(x, y, z);
        if (!bl || (BT.flags[bl] & (F.WATER | F.LAVA))) return -1;
        const t = R.types[BT.type[bl]];
        if (t && BAD.test(t.name)) return -1;
        return y;
      };
      let best = null, bs = 1e9, missing = 0;
      const a0 = Math.atan2(p[0] - site.x, p[2] - site.z);
      for (const rho of [RAD - 4, RAD + 4, RAD + 12, RAD + 22, RAD + 34, RAD + 48, RAD + 64]) for (let k = 0; k < 20; k++) {
        const a = a0 + (k % 2 ? -1 : 1) * Math.ceil(k / 2) * (Math.PI / 10);
        for (const rot of [0, 1]) {
          const ex = rot ? hz : hx, ez = rot ? hx : hz;
          const cx = Math.round(site.x + Math.sin(a) * (rho + Math.max(ex, ez) * 0.5)), cz = Math.round(site.z + Math.cos(a) * (rho + Math.max(ex, ez) * 0.5));
          let mn = 999, mx = -1, bad = 0, n = 0, miss = false;
          for (let dz = -ez; dz <= ez && !miss; dz += 2) for (let dx = -ex; dx <= ex; dx += 2) {
            const y = ground(cx + dx, cz + dz); n++;
            if (y === null) { miss = true; break; }
            if (y < 0) { bad++; continue; }
            if (y < mn) mn = y; if (y > mx) mx = y;
          }
          if (miss) { missing++; continue; }
          if (mx < 0 || bad > n * 0.35) continue;
          const score = rho + Math.max(0, mx - mn - 1) * 6 + bad * 30 + Math.ceil(k / 2) * 3;
          if (score < bs) { bs = score; best = [cx + 0.5, mx + 1, cz + 0.5, bad]; }
        }
      }
      A.refineTries = (A.refineTries || 0) + 1;
      if (best && (!best[3] || !missing || A.refineTries > 6)) { A.spot = best.slice(0, 3); A.refined = true; }
      else if (!missing || A.refineTries > 6) A.refined = true;
    }
    // the autopilot flies through the same flight model: it sets the stick, the speed and the climb
    autoStep(dt) {
      const g = this.g, w = g.world, A = this.auto, b = this.b, p = b.pos, v = b.vel, cr = this.cruise;
      A.t += dt;
      if (A.landing) { this.ctl.turn = 0; this.ctl.climb = 0; this.ctl.strafe = 0; this.ctl.speed = 0; return; }
      const site = A.site, d0 = Math.hypot(site.x - p[0], site.z - p[2]);
      if (!A.refined && d0 < 150 && (A.refineT = (A.refineT || 0) - dt) <= 0) { A.refineT = 0.5; this.refineSpot(A); }
      const tgt = A.spot || [site.x + 0.5, site.y + 1, site.z + 0.5];
      const dx = tgt[0] - p[0], dz = tgt[2] - p[2], dist = Math.hypot(dx, dz);
      A.dist = dist;
      const h = b.heading, yaw = Math.atan2(-dx, -dz), off = Math.abs(wrapA(yaw - h));
      const speed = Math.hypot(v[0], v[2]);
      A.eta = speed > 1 ? dist / speed : 0;
      const vcruise = Math.min(110, cr * 1.5), brake = Math.max(70, vcruise * 2.2);
      // altitude: cruise high, glide down over the last stretch
      let alt = A.cruise;
      if (dist < brake) alt = tgt[1] + 2 + (A.cruise - tgt[1] - 2) * Math.max(0, (dist - 5) / brake) ** 1.4;
      // obstacles ahead in the direction of travel (sky islands, a mountain the survey missed): pull up
      if (dist > 20) {
        const look = Math.min(1.4, 8 / Math.max(1, speed) + 0.6);
        if (b.hits(p[0] + v[0] * look, p[1] + 1, p[2] + v[2] * look, h) || b.hits(p[0] + v[0] * look * 0.5, p[1] + 1, p[2] + v[2] * look * 0.5, h)) A.climb = 1.6;
      }
      A.climb = Math.max(0, A.climb - dt);
      if (A.climb > 0) { alt = Math.max(alt, p[1] + 14); if (dist > brake) A.cruise = Math.min(236, Math.max(A.cruise, p[1] + 10)); }
      const up = clamp((alt - p[1]) / 7, -1, 1);
      // final approach: hold the heading and slide sideways onto the spot, then the assisted landing takes over
      if (dist < 18) {
        if (A.finalYaw === undefined) A.finalYaw = h;
        const vd = Math.min(7, dist * 0.9) / Math.max(dist, 1e-3), vx = dx * vd, vz = dz * vd, fx = -Math.sin(h), fz = -Math.cos(h), rx = Math.cos(h), rz = -Math.sin(h);
        this.ctl.speed = vx * fx + vz * fz; this.ctl.strafe = vx * rx + vz * rz;
        this.ctl.turn = clamp(wrapA(A.finalYaw - h) * 2.5, -1, 1);
        this.ctl.climb = dist < 6 ? up : Math.max(up, -0.3);
        const c = w.col(Math.floor(tgt[0]) >> 4, Math.floor(tgt[2]) >> 4);
        if (dist < 2.5 && (p[1] - tgt[1] < 6 || (this.alt !== null && this.alt < 6)) && c && c.ready) { A.landing = true; this.state = 'landing'; this.ctl.speed = 0; this.ctl.strafe = 0; }
        return;
      }
      A.finalYaw = undefined;
      // speed: gentle while climbing out or turning, slower on the approach, quick when far
      let sp = cr;
      if (p[1] < Math.min(alt, A.cruise) - 25 && dist > brake) sp = cr * 0.35;
      if (off > 0.5) sp = Math.min(sp, cr * 0.3);
      if (A.climb > 0) sp = Math.min(sp, cr * 0.15);
      if (dist < brake) sp = Math.min(sp, cr * clamp(dist / brake, 0.12, 1));
      if (dist > brake * 1.5 && off < 0.2 && A.climb <= 0) sp = vcruise;
      this.ctl.speed = sp; this.ctl.strafe = 0;
      this.ctl.turn = clamp(wrapA(yaw - h) * 2.2, -1, 1);
      this.ctl.climb = up;
    }

    // ---------------------------------------------------------------- for the HUD & cockpit
    info() {
      const b = this.b, v = b.vel, p = b.pos;
      return { speed: this.speed, vs: v[1], alt: p[1], agl: this.alt, heading: ((-b.heading * 180 / Math.PI) % 360 + 360) % 360, throttle: this.ctl.speed !== null ? clamp(this.ctl.speed / this.cruise, -TUNE.rev, 1) : this.throttle, boost: this.boost, energy: this.energy, gear: this.gear, gearDown: this.gearDown, lights: this.lights, ramp: this.ramp, state: this.state, spool: this.spool, auto: this.auto, power: this.power, armed: this.armed, radio: this.radio };
    }
  }
  VR.Flight = Flight;
})(VR);
