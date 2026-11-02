// ============================================================================
// v-light · Lichtpfützen, the GL side and the moving lights (plan docs/superpowers/plans/2026-11-02-v-light.md; the pure
// part: lightfield.js). Wraps additively:
//   Renderer.l2Frame   the field's frame: centre on the camera, scan ROWS rows, restamp STAMPS lights, the moving lights,
//                      compose, one 128 × 128 RGBA8 upload (only with the switch on: else nothing runs)
//   Renderer.common    the programs' uniforms (u_lf on unit 16 — no other unit is touched, u_lfO, u_lfK)
//   Villages.draw      the lanterns the villagers carry at night (one in three grown-ups on the street), drawn in hand
//   Villages.burst     a festival rocket's burst lights the plaza for a moment (not with the flash-free setting)
//   StoryGlow.draw     every soft glow (the fairies' dancers and lost lanterns, Funke, the story's lights) casts its pool
// The moving lights each frame: the lamp in the player's hand, the carried lanterns, the festival's fire and lantern
// ring and its bursts, the glows of the frame before.
// ============================================================================
(function (VR) {
  'use strict';
  const LF = VR.LField;
  if (!LF || !VR.Renderer) return;
  const R = VR.Renderer.prototype, UNIT = 16, TAU = Math.PI * 2;
  const H = (s) => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
  LF.cost = { ms: 0, n: 0 };

  // ---------------------------------------------------------------- the moving lights' sources
  const glows = [], glowsNext = [];   // [x, y, z, r, g, b, R] from StoryGlow (drawn the frame before)
  const flashes = [];                 // festival bursts: {x, y, z, c, t}
  // a villager carries a lantern: a grown-up, one in three, at night, on the street
  LF.carrier = (a) => !!(a && a.p && !a.kid && (H(a.p.seed !== undefined ? a.p.seed : a.p.id) % 3) === 0);
  LF.handPos = function (a, t, out) {
    const yw = a.yaw || 0, sw = Math.sin((a.t || t) * 5.2) * 0.04 * (a.walkAmt || 0);
    // (the right hand: the side of the facing −sin, −cos)
    out[0] = a.pos[0] + Math.cos(yw) * 0.36 - Math.sin(yw) * 0.08; out[1] = a.pos[1] + 0.62 + sw; out[2] = a.pos[2] - Math.sin(yw) * 0.36 - Math.cos(yw) * 0.08;
    return out;
  };
  // (the fairy models' light colours: LF.FAIRY in lightfield.js — f-polish8 moved them there with LF.fairyLights)
  const night = (E) => Math.max(0, Math.min(1, (E && E.night) || 0));
  const hp = [0, 0, 0];
  LF.gather = function (g, f, E, t) {
    f.clearDyn();
    const K = LF.K, nt = night(E);
    // the lamp in the player's hand (a block that gives light)
    const pl = g.player, held = pl && pl.inv && pl.inv.held;
    if (held && VR.R && VR.R.byName[held.id] && !(g.photoCam && g.photoCam.on)) {
      const ty = VR.R.byName[held.id], s = ty.defaultState, e = s ? VR.R.T.emit[s] : 0;
      if (e) { const gg = K.gain / 15 * 0.8, ep = pl.eyePos ? pl.eyePos() : [pl.pos[0], pl.pos[1] + 1.5, pl.pos[2]]; f.add(ep[0], ep[1] - 0.5, ep[2], ((e >> 8) & 15) * gg, ((e >> 4) & 15) * gg, (e & 15) * gg, 10); }
    }
    const V = g.villages;
    if (V && nt > 0.25) {
      // the carried lanterns (nearest first: the field's budget)
      const cam = f, L = [];
      for (const a of V.agents || []) {
        if (!a.drawn || !a.street || !LF.carrier(a)) continue;
        const dx = a.pos[0] - cam.cx, dz = a.pos[2] - cam.cz, d2 = dx * dx + dz * dz;
        if (d2 < 56 * 56) L.push([d2, a]);
      }
      L.sort((p, q) => p[0] - q[0]);
      const k = 1.15 * nt;   // (f-polish8: 0.85 → 1.15, the walking pool reads)
      for (let i = 0; i < L.length && i < 12; i++) { const a = L[i][1], fl = 0.92 + 0.08 * Math.sin(t * 9 + i * 1.7); LF.handPos(a, t, hp); f.add(hp[0], hp[1] + 0.25, hp[2], 1.0 * k * fl, 0.62 * k * fl, 0.28 * k * fl, 10); }
      // the festival: the fire in the middle, the ring of lanterns round the plaza
      const tod = g.env && g.env.timeOfDay;
      if (V.festivalOn && V.known) for (const vil of V.known.values()) {
        const pz = vil.plan && vil.plan.plaza; if (!pz || !vil.fest) continue;
        const dx = pz.x - f.cx, dz = pz.z - f.cz; if (dx * dx + dz * dz > 70 * 70) continue;
        if (!V.festivalOn(vil, tod)) continue;
        const cx = pz.x + 0.5, cz = pz.z + 0.5, y = pz.y, PR = (pz.r || 4) + 1.5, fl = 0.85 + 0.15 * Math.sin(t * 11) * Math.sin(t * 7.3 + 1);
        f.add(cx, y + 1.2, cz, 1.6 * fl, 0.75 * fl, 0.25 * fl, 14);
        for (let j = 0; j < 6; j++) { const a = j / 6 * TAU + 0.3; f.add(cx + Math.cos(a) * PR, y + 2.6, cz + Math.sin(a) * PR, 0.75, 0.5, 0.3, 10); }
      }
    }
    // the fairy places at night: their glowing models (LF.fairyLights: ×K.fairy, radius 12)
    LF.fairyLights(VR.Fairy && VR.Fairy.state, f, nt, t);
    // the bursts: a moment of coloured light from above
    for (let i = flashes.length - 1; i >= 0; i--) {
      const q = flashes[i], age = t - q.t;
      if (age > 1.4 || age < 0) { flashes.splice(i, 1); continue; }
      const k = 1.6 * Math.exp(-age * 3);
      f.add(q.x, q.gy + 8, q.z, q.c[0] * k, q.c[1] * k, q.c[2] * k, 22);
    }
    // the glows the frame before
    for (const q of glows) f.add(q[0], q[1], q[2], q[3], q[4], q[5], q[6]);
    glows.length = 0;
    for (const q of glowsNext) glows.push(q);
    glowsNext.length = 0;
  };

  // ---------------------------------------------------------------- the frame
  R.lfOn = function (F) { return !!(this.q && this.q.lfPools && F && F.world && F.cam && this.lfUnitOk()); };
  R.lfUnitOk = function () {
    if (this.lfUnits === undefined) { try { this.lfUnits = this.gl.getParameter(this.gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS) | 0; } catch (e) { this.lfUnits = 0; } }
    return this.lfUnits > UNIT;
  };
  R.lfTex = function () {
    if (this.lfT) return this.lfT;
    const gl = this.gl, t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + UNIT); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, LF.N, LF.N, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.activeTexture(gl.TEXTURE0);
    return (this.lfT = t);
  };
  R.lfFrame = function (F, E) {
    this.lfLive = false;
    if (!this.lfOn(F) || !isFinite(F.cam.x) || !isFinite(F.cam.z) || !isFinite(F.cam.y)) return;
    const t0 = performance.now(), gl = this.gl, c = F.cam, w = F.world, g = VR.game;
    const f = this.lfField || (this.lfField = new LF.Field());
    // the same frame drawn twice (a mirror, the far cache): the field once
    if (this.lfFrameNo === this.frameNo && this.lfDone) { this.lfLive = true; return; }
    this.lfFrameNo = this.frameNo;
    // (a jump — a teleport, a respawn, another world: the whole window scanned and stamped at once, ~10 ms, so the
    // place is not dark for half a second)
    if (f.center(c.x, c.y, c.z)) this.lfWarm(f);
    if (this.lfWorld !== w) { this.lfWorld = w; this.lfCol = (kx, kz) => w.col(kx, kz); f.started = false; if (f.center(c.x, c.y, c.z)) this.lfWarm(f); }   // (another world: the field anew)
    f.scan(this.lfCol, VR.R.T, LF.ROWS);
    f.rebuild(LF.STAMPS);
    if (g) LF.gather(g, f, E, g.time || t0 / 1000);
    const fresh = !this.lfT;
    this.lfTex();
    if (f.compose(fresh)) {   // (null: the picture of before stands — no upload)
      gl.activeTexture(gl.TEXTURE0 + UNIT); gl.bindTexture(gl.TEXTURE_2D, this.lfT);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, LF.N, LF.N, gl.RGBA, gl.UNSIGNED_BYTE, f.out);
      gl.activeTexture(gl.TEXTURE0);
      LF.uploads = (LF.uploads | 0) + 1;
    }
    const ox = c.x - 128 * Math.floor(c.x / 128), oz = c.z - 128 * Math.floor(c.z / 128);
    this.lfU = this.lfU || [0, 0, 0, 0];
    this.lfU[0] = ox; this.lfU[1] = oz; this.lfU[2] = c.y - f.Y0; this.lfU[3] = LF.K.str;
    this.lfLive = this.lfDone = true;
    const ms = performance.now() - t0; LF.cost.ms = LF.cost.ms * 0.95 + ms * 0.05; LF.cost.n++; LF.cost.last = ms;
  };
  // the whole window now: every row scanned, every light stamped (a jump; the tests)
  R.lfWarm = function (f) {
    f = f || this.lfField; if (!f || !this.lfCol) return 0;
    f.scan(this.lfCol, VR.R.T, LF.N);
    f.li = f.nList = 0; f.dirty = true;
    for (let i = 0; i < 200; i++) if (f.rebuild(4096)) break;
    return f.stats.lights;
  };
  const l2Frame0 = R.l2Frame;
  R.l2Frame = function (F, E) { if (l2Frame0) l2Frame0.call(this, F, E); this.lfFrame(F, E); };
  // the uniforms (common() runs for every program as it is bound)
  R.lfUniforms = function (p) {
    const u = p.u, gl = this.gl;
    if (!u.u_lfO) return;
    const on = !!(this.lfLive && this.lfT), U = this.lfU;
    gl.uniform4f(u.u_lfO, on ? U[0] : 0, on ? U[1] : 0, on ? U[2] : 0, on ? U[3] : 0);
    if (u.u_lfK) gl.uniform4f(u.u_lfK, LF.LMAX, LF.HSPAN, LF.K.kv, LF.K.fade0);
    if (u.u_lf) { gl.activeTexture(gl.TEXTURE0 + UNIT); gl.bindTexture(gl.TEXTURE_2D, this.lfT || this.lfTex()); gl.uniform1i(u.u_lf, UNIT); gl.activeTexture(gl.TEXTURE0); }
  };
  const common0 = R.common;
  R.common = function (p, E) { common0.call(this, p, E); if (p && p.u && p.u.u_lfO) this.lfUniforms(p); };

  // ---------------------------------------------------------------- the villagers' lanterns, the bursts
  const Vs = VR.Villages && VR.Villages.prototype;
  if (Vs && Vs.draw) {
    const draw0 = Vs.draw, MP = { scale: 0.55 }, pos = [0, 0, 0];
    Vs.draw = function (r, E, cam) {
      const out = draw0.apply(this, arguments);
      if (!r || !r.q || !r.q.lfPools || night(E) <= 0.25 || !VR.LifeKit || !this.agents || !this.agents.length) return out;
      const g = this.g, ent = g && g.entities; if (!ent) return out;
      let prog = null, n = 0;
      for (const a of this.agents) {
        if (!a.drawn || !a.street || !LF.carrier(a)) continue;
        const dx = a.pos[0] - cam.x, dz = a.pos[2] - cam.z; if (dx * dx + dz * dz > 48 * 48) continue;
        if (!prog) prog = ent.beginVox(r, E);
        LF.handPos(a, g.time || 0, pos); pos[1] -= 0.05;
        try { if (VR.LifeKit.drawModel(g, r, prog, 'fy_lantern', pos, a.yaw || 0, cam, MP)) n++; } catch (e) { LF.err = String(e); return out; }   // (a lantern never breaks the frame)
        if (n >= 12) break;
      }
      return out;
    };
  }
  if (Vs && Vs.burst) {
    const burst0 = Vs.burst;
    Vs.burst = function (F, r, dist) {
      const out = burst0.apply(this, arguments);
      try {
        const g = this.g, rr = g && g.renderer;
        if (rr && rr.q && rr.q.lfPools && r && r.p && (!VR.A11y || !VR.A11y.flash || VR.A11y.flash('fireworks')) && flashes.length < 4) {
          const c = r.col || [1, 0.8, 0.5], gy = g.player ? Math.min(r.p[1], g.player.pos[1] + 4) : r.p[1] - 20;
          flashes.push({ x: r.p[0], y: r.p[1], gy, z: r.p[2], c: [c[0], c[1], c[2]], t: g.time || 0 });
        }
      } catch (e) { /* a light, never the festival */ }
      return out;
    };
  }
  const SG = VR.StoryGlow;
  if (SG && SG.draw) {
    const sgDraw0 = SG.draw;
    SG.draw = function (r, cam, list) {
      if (r && r.q && r.q.lfPools && list) for (let i = 0; i < list.length && glowsNext.length < 10; i++) {
        const q = list[i]; if (!q || (q.kind | 0) !== 0 || !q.p || !q.col || !(q.a > 0.05)) continue;
        const dx = q.p[0] - cam.x, dz = q.p[2] - cam.z; if (dx * dx + dz * dz > 50 * 50) continue;
        const s = q.s ? (q.s[0] || 1) : 1, k = Math.min(1.2, q.a * 1.1);
        glowsNext.push([q.p[0], q.p[1], q.p[2], q.col[0] * k, q.col[1] * k, q.col[2] * k, Math.max(5, Math.min(10, 4 + s * 3))]);
      }
      return sgDraw0.apply(this, arguments);
    };
  }
})(VR);
