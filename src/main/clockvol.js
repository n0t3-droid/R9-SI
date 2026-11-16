// ============================================================================
// e-uhr · E1 · Schattenuhr in the game — the clock volume (spec docs/superpowers/specs/2026-11-15-echt.md).
// The workers bake, once per section, WHEN the sun (and the moon, on the same arc) reaches each air cell beside a
// surface (src/shared/sunclock.js bakeSection: four bytes, two lit intervals of the arc). The renderer keeps those
// clocks in one 3-D texture round the eye (128 × 128 blocks wide, 64 high; toroidal: texel = world x & 127, z & 127,
// y & 63) and the terrain's fragment shader reads ONE filtered texel at the cell in front of the face and turns it into
// the light: d = max(min(s − r1, e1 − s), min(s − r2, e2 − s)) at the arc time s of the light that is up. No shadow pass,
// no march per pixel — on every tier, Very Low included (which had no sun shadows at all before).
//   world side   per section and column a bit layer of what stops the sun (cached by the section's version); a bake
//                job = the 5 × 5 columns' bits round the section (80 × 48 × 80), the 13 × 13 columns' tops (c.sh) for
//                the far field, the layer under the section; results kept per section (s.clk, s.clkSig)
//   scheduling   the sections of the window (8 × 4 × 8 round the eye) that meet the land, nearest first, at most
//                INFLIGHT jobs, never while columns in view still wait for their first mesh
//   GL           u_clockVol (unit 5, RGBA8, LINEAR, REPEAT), u_clockOk (256 bits: which window slot holds a baked
//                section of this window), u_clockWin (the window's origin, s), u_clockK (the edge's sharpness)
// Switch ⚙ Bild · Licht „Schattenuhr" (sunclock, on by default on every preset). Off: exactly the old picture.
// ============================================================================
(function (VR) {
  'use strict';
  const SC = VR.SunClock, CV = VR.ClockVol = VR.ClockVol || {};
  if (!SC) return;
  CV.W = 128; CV.H = 64; CV.SX = 8; CV.SY = 4;   // the window: 8 × 4 × 8 sections
  CV.INFLIGHT = 2; CV.REACH = 6;                 // bake jobs at once; the far field's columns each way
  CV.stats = { baked: 0, ms: 0, up: 0, jobs: 0 };
  if (VR.Settings && VR.Settings.add) VR.Settings.add({ key: 'sunclock', g: 'img', sec: 'light', t: 'switch', lab: 'g.set.sunclock', tip: 'g.set.sunclock.tip', cost: 'low', def: true });
  CV.on = (s) => !s || s.sunclock !== false;
  // E2 · Himmelslicht: the sky's light on a face by how much of the sky its cell really sees — ×SKY_LO where it sees
  // none (under a porch, a crown, deep in a lane), ×SKY_HI in the open. Switch „Himmelslicht" (with the Schattenuhr).
  CV.SKY_LO = 0.42; CV.SKY_HI = 1.08;
  // E2b · Rückstrahlung: the light the surroundings give back, in their colour (a red wall tints the street, a sunlit
  // meadow lifts the shade under the crowns); strength BOUNCE × the sun's light. Switch „Rückstrahlung" (with the clock)
  CV.BOUNCE = 0.42;
  CV.bounce = (s) => CV.on(s) && (!s || s.bounce !== false);
  if (VR.Settings && VR.Settings.add) VR.Settings.add({ key: 'bounce', g: 'img', sec: 'light', t: 'switch', lab: 'g.set.bounce', tip: 'g.set.bounce.tip', cost: 'low', def: true });
  if (VR.Settings && VR.Settings.add) VR.Settings.add({ key: 'skylight', g: 'img', sec: 'light', t: 'switch', lab: 'g.set.skylight', tip: 'g.set.skylight.tip', cost: 'low', def: true });

  // ---------------------------------------------------------------- the arc time of the light that is up (from env's sun)
  // env.js: sun = arc(th / π) with th = tod·2π; the moon = −sun = the sun twelve hours later. The shaders switch to the
  // moon where sunUp = smoothstep(−0.12, 0.12, sun.y) reaches 0.
  CV.arcTime = function (sun) {
    const up = sun[1] > -0.1199, d = up ? sun : [-sun[0], -sun[1], -sun[2]];
    let th = Math.atan2(d[2], d[0]) - SC.AZ0;
    while (th < -Math.PI / 2) th += Math.PI * 2;
    while (th >= Math.PI * 1.5) th -= Math.PI * 2;
    return th / Math.PI;
  };

  // ---------------------------------------------------------------- the bits of a section (what stops the sun)
  function slab(c, sy) {
    const s = c.sec[sy]; if (!s) return null;
    const ver = s.ver | 0;
    if (s.occ && s.occVer === ver) return s.occ;
    const O = SC.opaqueTable(), B = c.blocks, bits = s.occ || new Uint16Array(256);
    bits.fill(0);
    const H = c.H || 256;
    for (let y = 0; y < 16; y++) { const wy = sy * 16 + y; if (wy >= H) break; const base = wy << 8; for (let z = 0; z < 16; z++) { let row = 0; const i = base | (z << 4); for (let x = 0; x < 16; x++) if (O[B[i | x]]) row |= 1 << x; bits[y * 16 + z] = row; } }
    s.occ = bits; s.occVer = ver;
    return bits;
  }
  // the signature of a bake: the versions of the 5 × 5 × 3 sections it read
  function sig(world, cx, cz, sy) {
    let h = 17;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      const c = world.col(cx + dx, cz + dz);
      if (!c || !c.ready) { h = (h * 31 + 7) | 0; continue; }
      for (let k = 0; k < 3; k++) { const s = c.sec[sy + k]; h = (h * 31 + (s ? (s.ver | 0) + 1 : 0)) | 0; }
    }
    return h;
  }
  CV.buildJob = function (world, c, sy) {
    const cx = c.cx, cz = c.cz, oy = sy * 16, vol = SC.newVolume(), VZ = SC.VZ;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      const n = world.col(cx + dx, cz + dz); if (!n || !n.ready) continue;
      const w = dx + 2;
      for (let k = 0; k < 3; k++) {
        const b = slab(n, sy + k); if (!b) continue;
        for (let y = 0; y < 16; y++) { const vy = k * 16 + y, rowBase = (vy * VZ + (dz + 2) * 16) * 5 + w; for (let z = 0; z < 16; z++) vol[rowBase + z * 5] = b[y * 16 + z]; }
      }
    }
    // E2b · Rückstrahlung: the block ids of the 3 × 3 columns round the section, the volume's 48 layers (what a bounce
    // ray hit), row by row out of the columns
    const ids = CV.bounce(S()) ? SC.bounceIds() : null;
    if (ids) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const n = world.col(cx + dx, cz + dz); if (!n || !n.ready) continue;
      const B = n.blocks, H = n.H || 256;
      for (let y = 0; y < 48; y++) { const wy = oy + y; if (wy >= H) break; for (let z = 0; z < 16; z++) { const src = (wy << 8) | (z << 4), dst = (y * 48 + (dz + 1) * 16 + z) * 48 + (dx + 1) * 16; ids.set(B.subarray(src, src + 16), dst); } }
    }
    const below = new Uint16Array(16);
    if (sy > 0) { const b = slab(c, sy - 1); if (b) for (let z = 0; z < 16; z++) below[z] = b[15 * 16 + z]; }
    // the far field: the columns' tops (c.sh: the top of the sun-blocking layer) 13 × 13 columns round
    const R = CV.REACH, tw = (2 * R + 1) * 16, top = new Uint8Array(tw * tw);
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const n = world.col(cx + dx, cz + dz); if (!n || !n.ready || !n.sh) continue;
      for (let z = 0; z < 16; z++) { const o = ((dz + R) * 16 + z) * tw + (dx + R) * 16; for (let x = 0; x < 16; x++) { const h = n.sh[((z << 4) | x) * 2]; top[o + x] = h ? Math.min(255, h + 1) : 0; } }
    }
    return { type: 'clock', key: c.key, sy, ox: cx * 16, oy, oz: cz * 16, vol, below, ids, top, topX0: (cx - R) * 16, topZ0: (cz - R) * 16, topW: tw };
  };
  // does a section meet the land (so a face in it, or on its floor, can ask for a clock)? the columns' sun-blocking
  // layers [bottom − 16, top + 1]
  function meetsLand(c, sy) {
    if (!c.sh) return false;
    let lo = 1e9, hi = -1;
    const now = CV.tick | 0;
    if (c.clkBand === undefined || now - c.clkBandAt > 30) {   // (refreshed every 30 runs: an edit seldom moves a column's band)
      for (let i = 0; i < 256; i++) { const t = c.sh[i * 2], b = c.sh[i * 2 + 1]; if (!t) continue; if (t > hi) hi = t; if (b < lo) lo = b; }
      c.clkBand = [lo, hi]; c.clkBandAt = now;
    }
    const y0 = sy * 16, y1 = y0 + 15;
    return y1 >= c.clkBand[0] - 16 && y0 <= c.clkBand[1] + 1;
  }

  // ---------------------------------------------------------------- the renderer's side
  if (!VR.Renderer) return;
  const RP = VR.Renderer.prototype;
  const S = () => VR.game && VR.game.settings;
  RP.ensureClockVol = function () {
    if (this.clockTex) return;
    const gl = this.gl;
    this.clockTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_3D, this.clockTex);
    gl.texStorage3D(gl.TEXTURE_3D, 1, gl.RGBA8, CV.W, CV.W, CV.H);   // (x, z, y: a section's 16³ bytes go in as they are)
    for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) gl.texParameteri(gl.TEXTURE_3D, p, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    // E2 · Himmelslicht: the share of the sky each cell sees, beside the clocks (R8, the same window and slots)
    this.skyTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_3D, this.skyTex);
    gl.texStorage3D(gl.TEXTURE_3D, 1, gl.RGBA8, CV.W, CV.W, CV.H);   // (e-bounce: rgb the colour given back, a the sky)
    for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) gl.texParameteri(gl.TEXTURE_3D, p, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    this.clockOwner = new Int32Array(CV.SX * CV.SX * CV.SY).fill(-1);   // the slot's section (a hash) or −1
    this.clockSig = new Int32Array(CV.SX * CV.SX * CV.SY);
    this.clockOk = new Uint32Array(8);
    this.clockWin = [0, 0, 0];
  };
  const slotOf = (cx, sy, cz) => ((cx & 7) + 8 * (cz & 7) + 64 * (sy & 3));
  const secHash = (cx, sy, cz) => (((cx & 0x7ff) << 20) | ((cz & 0x7ff) << 9) | (sy & 0x1ff)) | 0;
  // every frame (after the height map): the window round the eye, uploads of baked sections, new bake jobs
  RP.updateClockVol = function (world, E) {
    const st = S(), cam = this.cam;
    this.clockLive = false;
    if (!CV.on(st) || !world || !cam || world.dim !== 'overworld' || !world.hasSky || !world.pool) return;
    this.ensureClockVol();
    // (e-bounce: the workers need the blocks' colours — the textures' averages, as the far land gets them)
    if (!CV.sentAvg && VR.game && VR.game.tex && VR.game.tex.avgColor && world.pool.broadcast) { world.pool.broadcast({ type: 'clockcol', avg: VR.game.tex.avgColor }); CV.sentAvg = true; }
    const gl = this.gl, pcx = Math.floor(cam.x / 16), pcz = Math.floor(cam.z / 16), psy = Math.floor(cam.y / 16);
    const wx = pcx - 4, wz = pcz - 4, wy = Math.max(0, psy - 1);
    this.clockWin[0] = wx * 16; this.clockWin[1] = wy * 16; this.clockWin[2] = wz * 16;
    this.clockLive = true;
    if (this.clockWorld !== world) { this.clockWorld = world; this.clockOwner.fill(-1); this.clockOk.fill(0); this.clockRun = 0; }
    // (the scan runs every 4th frame, or at once when the window moved: Very Low's frame stays as it was)
    const moved = this.clockWinKey !== wx + ',' + wy + ',' + wz; this.clockWinKey = wx + ',' + wy + ',' + wz;
    if (!moved && ((this.clockRun = (this.clockRun | 0) + 1) & 3) !== 0) return;
    CV.tick = (CV.tick | 0) + 1;
    // the slots: a section of this window, baked and uploaded → its bit; uploads (at most 6 a frame)
    const ok = this.clockOk; ok.fill(0);
    let up = 0;
    const want = [];
    for (let dz = 0; dz < 8; dz++) for (let dx = 0; dx < 8; dx++) {
      const cx = wx + dx, cz = wz + dz, c = world.col(cx, cz);
      if (!c || !c.ready) continue;
      for (let k = 0; k < 4; k++) {
        const sy = wy + k; if (!c.sec[sy]) continue;
        const s = c.sec[sy], sl = slotOf(cx, sy, cz), h = secHash(cx, sy, cz);
        if (s.clk) {
          if (this.clockOwner[sl] !== h || this.clockSig[sl] !== s.clkSig) {
            if (up < 6) {
              gl.bindTexture(gl.TEXTURE_3D, this.clockTex); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
              gl.texSubImage3D(gl.TEXTURE_3D, 0, (cx & 7) * 16, (cz & 7) * 16, (sy & 3) * 16, 16, 16, 16, gl.RGBA, gl.UNSIGNED_BYTE, s.clk);
              if (s.envB) { gl.bindTexture(gl.TEXTURE_3D, this.skyTex); gl.texSubImage3D(gl.TEXTURE_3D, 0, (cx & 7) * 16, (cz & 7) * 16, (sy & 3) * 16, 16, 16, 16, gl.RGBA, gl.UNSIGNED_BYTE, s.envB); }
              gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
              this.clockOwner[sl] = h; this.clockSig[sl] = s.clkSig; up++; CV.stats.up++;
            }
          }
          if (this.clockOwner[sl] === h) ok[sl >> 5] |= 1 << (sl & 31);
        }
        if (!s.clkPending && (!s.clk || ((CV.tick + sl) & 7) === 0 && s.clkSig !== sig(world, cx, cz, sy)) && meetsLand(c, sy)) {
          const ddx = cx + 0.5 - cam.x / 16, ddz = cz + 0.5 - cam.z / 16, ddy = sy + 0.5 - cam.y / 16;
          want.push([ddx * ddx + ddz * ddz + ddy * ddy * 0.5, c, sy]);
        }
      }
    }
    // new jobs: nearest first, a few at a time, not while the streaming has meshes to make
    // (while the streaming meshes, one bake at a time beside it: a walk through new land still gets its shadows)
    const cap = (world.meshInflight | 0) > 1 ? 1 : CV.INFLIGHT;
    if (want.length) {
      want.sort((a, b) => a[0] - b[0]);
      for (const [, c, sy] of want) {
        if ((CV.inflight | 0) >= cap) break;
        // the 5 × 5 columns must be there (else the bake would see holes)
        let all = true; for (let dz = -2; dz <= 2 && all; dz++) for (let dx = -2; dx <= 2 && all; dx++) { const n = world.col(c.cx + dx, c.cz + dz); if (!n || !n.ready) all = false; }
        if (!all) continue;
        const s = c.sec[sy], g = sig(world, c.cx, c.cz, sy), job = CV.buildJob(world, c, sy);
        s.clkPending = true; CV.inflight = (CV.inflight | 0) + 1; CV.stats.jobs++;
        world.pool.submit(job, [job.vol.buffer, job.top.buffer, job.below.buffer].concat(job.ids ? [job.ids.buffer] : []), (m) => {
          s.clkPending = false; CV.inflight = Math.max(0, (CV.inflight | 0) - 1);
          if (m.type !== 'clock') { CV.stats.err = (CV.stats.err | 0) + 1; CV.stats.last = m.type + ' ' + String(m.msg || m.error || '').slice(0, 160); return; }
          if (world.cols.get(c.key) !== c) { CV.stats.gone = (CV.stats.gone | 0) + 1; return; }
          s.clk = m.data; s.envB = m.env || null; s.clkSig = g; CV.stats.baked++; CV.stats.ms += m.ms || 0;
        }, 1e5);   // (behind every gen and mesh job: the world loads first, its light refines after)
      }
    }
  };
  const uh0 = RP.updateHmap;
  RP.updateHmap = function (world) {
    const r = uh0.apply(this, arguments);
    try { this.updateClockVol(world); } catch (e) { if (!CV.warned) { CV.warned = true; console.warn('clockvol', e); } }
    return r;
  };
  // the uniforms (every program that has them: the terrain's)
  const c0 = RP.common;
  RP.common = function (p, E) {
    const r = c0.apply(this, arguments);
    const u = p && p.u;
    if (u && u.u_clockWin) {
      const gl = this.gl, live = !!(this.clockLive && this.clockTex && E && E.sunDir && !E.dimId);
      if (this.clockTex) { gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_3D, this.clockTex); }
      if (u.u_clockVol) gl.uniform1i(u.u_clockVol, 5);
      if (u.u_skyVol) { if (this.skyTex) { gl.activeTexture(gl.TEXTURE8); gl.bindTexture(gl.TEXTURE_3D, this.skyTex); } gl.uniform1i(u.u_skyVol, 8); }
      if (u.u_bounceK) gl.uniform4f(u.u_bounceK, live && CV.bounce(S()) ? CV.BOUNCE : 0, 0, 0, 0);
      if (u.u_skyK) gl.uniform4f(u.u_skyK, live && (!S() || S().skylight !== false) ? 1 : 0, CV.SKY_LO, CV.SKY_HI, 0);
      const w = this.clockWin || [0, 0, 0], s = live ? CV.arcTime(E.sunDir) : -9;
      gl.uniform4f(u.u_clockWin, w[0], w[1], w[2], s);
      if (u.u_clockOk) gl.uniform4uiv(u.u_clockOk, live ? this.clockOk : new Uint32Array(8));
      if (u.u_clockK) gl.uniform4f(u.u_clockK, 1 / (2 * SC.W), 0, 0, 0);
    }
    return r;
  };
  // ---------------------------------------------------------------- the figures (animals, people): the same clocks on the CPU
  // the clock of the air cell at a world point from the section's baked bytes (null: not baked) → the light 0…1 at s
  CV.visAt = function (world, x, y, z, s) {
    const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z), c = world.col(X >> 4, Z >> 4);
    const sec = c && c.sec[Y >> 4]; if (!sec || !sec.clk) return null;
    const i = (((Y & 15) * 16 + (Z & 15)) * 16 + (X & 15)) * 4, d = sec.clk;
    return SC.vis((d[i] | (d[i + 1] << 8) | (d[i + 2] << 16) | (d[i + 3] << 24)) >>> 0, s);
  };
  if (VR.Entities && VR.Entities.prototype && VR.Entities.prototype.sunShade) {
    const ss0 = VR.Entities.prototype.sunShade;
    VR.Entities.prototype.sunShade = function (pos, h) {
      const g = this.game, w = g && g.world, E = g && g.env && g.env.E;
      if (w && E && E.sunDir && !E.dimId && CV.on(S()) && w.dim === 'overworld') {
        const v = CV.visAt(w, pos[0], pos[1] + (h || 1), pos[2], CV.arcTime(E.sunDir));
        if (v !== null) return 1 - v;
      }
      return ss0.apply(this, arguments);
    };
  }
  // the define: SUNCLOCK in the terrain's programs while the switch is on
  CV.defs = (name, s) => ((name === 'terrain' || name === 'terrainCut') && CV.on(s) ? ['SUNCLOCK'] : []);
  if (VR.GL) { const prev = VR.GL.defineHook || null; VR.GL.defineHook = (name, defines) => { let d = prev ? prev(name, defines) : (defines || []); for (const k of CV.defs(name, S())) if (!d.includes(k)) d = d.concat([k]); return d; }; }
  const aq0 = RP.applyQ;
  RP.applyQ = function (full) {
    const res = aq0.call(this, full);
    const k = CV.on(S()) ? 1 : 0;
    if (this.cvKey !== undefined && k !== this.cvKey && this.P) this.buildPrograms();
    this.cvKey = k;
    return res;
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
