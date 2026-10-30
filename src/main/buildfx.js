// ============================================================================
// ✨ Bauen fühlt sich gut an (a-builder; plan docs/superpowers/plans/2026-10-30-a-builder.md §2): three of the builder's
// five wins, hooked in by wrapping so player.js, ui.js, gadgets.js and game.js stay as they are.
//  1 · Juicy placement: a block set by the hand pops in — a cube in the block's own textures scales 0.62 → 1.07 → 1 in
//      0.16 s (the decal program, ≤ 8 at once, one upload and six draws each, no allocation in the frame) —, a little
//      dust, wood chips, a sparkle or leaves by the material family (≤ 10 particles), and a run of quick placements
//      climbs a pentatonic step each (back to the root after 0.7 s or a break). Breaking adds a soft puff.
//      Cost tier 🟢, switch „Bau-Effekte" (buildFx): on from Low up, off on Very Low (it draws and spawns nothing there).
//  2 · The picker: a search line on top of the creative inventory (typing a letter anywhere starts it; ranked over both
//      languages and the id — VR.PickFind), Enter puts the first hit in the hand; the „Zuletzt" row (the last 12 blocks
//      placed or picked); Profi adds the ★ row, eight material chips and sixteen colour dots. Its open time is measured
//      (ui.pickMs).
//  3 · Bauplan-Stempel: the wand's copy (C) is kept as a stamp in this browser (VR.Stamp, ≤ 12); holding the wand shows
//      the stamp as a translucent ghost in its own colours where V would put it; R turns, L mirrors, U takes the next
//      saved one, V stamps (as far as 48 blocks away), Z undoes. The newest saved stamp is in the wand when a world starts.
// VR.BuildFx (pure): POP_DUR · MAX_POPS · popScale(t) · popAlpha(t) · Combo · PENTA · FX · enabled(settings).
// ============================================================================
(function (VR) {
  'use strict';
  const tx = (k, v, de, en) => (VR.I18N && VR.I18N.tx ? VR.I18N.tx(k, v, de, en) : String(de).replace(/\{(\w+)\}/g, (m, n) => (v && v[n] !== undefined ? v[n] : m)));
  const BF = VR.BuildFx = {};
  BF.POP_DUR = 0.16; BF.MAX_POPS = 8;
  const easeOut = (u) => 1 - (1 - u) * (1 - u) * (1 - u);
  BF.popScale = function (t) {
    const u = Math.max(0, t / BF.POP_DUR);
    if (u >= 1) return 1;
    if (u < 0.55) return 0.62 + 0.45 * easeOut(u / 0.55);
    const v = (u - 0.55) / 0.45; return 1.07 - 0.07 * v * v * (3 - 2 * v);
  };
  BF.popAlpha = (t) => { const u = t / BF.POP_DUR; return u <= 0.6 ? 1 : u >= 1 ? 0 : 1 - (u - 0.6) / 0.4; };
  BF.PENTA = [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3, 2]; BF.COMBO_GAP = 0.7;
  class Combo {
    constructor() { this.reset(); }
    reset() { this.step = -1; this.last = -1e9; }
    hit(t) { this.step = t - this.last <= BF.COMBO_GAP && this.step >= 0 ? Math.min(this.step + 1, BF.PENTA.length - 1) : 0; this.last = t; return BF.PENTA[this.step]; }
  }
  BF.Combo = Combo;
  BF.FX = {
    grass: { kind: 'leaves', n: 6, col: [0.36, 0.6, 0.22] }, dirt: { kind: 'dust', n: 7, col: [0.46, 0.35, 0.25] },
    stone: { kind: 'dust', n: 7, col: [0.64, 0.63, 0.61] }, gravel: { kind: 'chips', n: 8, col: [0.5, 0.48, 0.46] },
    wood: { kind: 'chips', n: 7, col: [0.68, 0.51, 0.3] }, sand: { kind: 'puff', n: 8, col: [0.88, 0.8, 0.58] },
    snow: { kind: 'puff', n: 8, col: [0.95, 0.97, 1] }, metal: { kind: 'sparkle', n: 6, col: [1, 0.86, 0.56], emis: 1 },
    glass: { kind: 'sparkle', n: 6, col: [0.76, 0.92, 1], emis: 1 }, carpet: { kind: 'puff', n: 5, col: [0.92, 0.87, 0.82] },
    water: { kind: 'splash', n: 6, col: [0.7, 0.85, 1] },
  };
  BF.enabled = (S) => (S && S.buildFx !== undefined ? !!S.buildFx : !(S && S.preset === 'potato'));

  // ---- the particles of one placement (on the block's surface, by kind)
  const rnd = Math.random;
  BF.burst = function (P, x, y, z, fam, k) {
    const R0 = BF.FX[fam] || BF.FX.stone, n = Math.max(1, Math.round(R0.n * (k || 1))), c = R0.col;
    for (let i = 0; i < n; i++) {
      const a = rnd() * 6.283, cx = x + 0.5 + Math.cos(a) * 0.55, cz = z + 0.5 + Math.sin(a) * 0.55, ox = Math.cos(a), oz = Math.sin(a);
      const shade = 0.85 + rnd() * 0.3, col = [c[0] * shade, c[1] * shade, c[2] * shade];
      switch (R0.kind) {
        case 'dust': case 'puff': P.spawn(cx, y + 0.05 + rnd() * 0.15, cz, ox * (1.2 + rnd() * 0.8), 0.35 + rnd() * 0.5, oz * (1.2 + rnd() * 0.8), { life: 0.55 + rnd() * 0.35, size: (R0.kind === 'puff' ? 0.16 : 0.13) + rnd() * 0.06, grav: -0.3, col, drag: 3, grow: R0.kind === 'puff' ? 0.55 : 0.35, collide: false, alpha: 0.85 }); break;
        case 'chips': P.spawn(cx, y + 0.3 + rnd() * 0.6, cz, ox * (1 + rnd()), 2 + rnd() * 1.5, oz * (1 + rnd()), { life: 0.45 + rnd() * 0.25, size: 0.045 + rnd() * 0.03, grav: 14, col }); if (i % 2 === 0) P.spawn(cx, y + 0.05, cz, ox * 1.4, 0.4, oz * 1.4, { life: 0.5, size: 0.12 + rnd() * 0.05, grav: -0.3, col: [0.7, 0.66, 0.6], drag: 3, grow: 0.35, collide: false, alpha: 0.55 }); break;   // (and a little dust where it lands)
        case 'leaves': P.spawn(cx, y + 0.5 + rnd() * 0.5, cz, ox * 0.8, 1 + rnd() * 0.8, oz * 0.8, { life: 0.8 + rnd() * 0.4, size: 0.05 + rnd() * 0.025, grav: 2.5, col, drag: 1.8, collide: false }); break;
        case 'splash': P.spawn(cx, y + 0.9, cz, ox * 1.2, 2 + rnd() * 2, oz * 1.2, { life: 0.5 + rnd() * 0.3, size: 0.045, grav: 16, col }); break;
        default: {   // sparkle: on the corners and edges, a glint that hangs
          const ex = x + (rnd() < 0.5 ? 0 : 1), ey = y + rnd(), ez = z + (rnd() < 0.5 ? 0 : 1);
          P.spawn(ex, ey, ez, (rnd() - 0.5) * 0.4, 0.3 + rnd() * 0.3, (rnd() - 0.5) * 0.4, { life: 0.35 + rnd() * 0.3, size: 0.035 + rnd() * 0.02, grav: 0, col, emis: 1, drag: 1.5, collide: false });
        }
      }
    }
  };

  // ======================================================================== the game's part
  const G = VR.Game, Player = VR.Player, Ren = VR.Renderer, R = VR.R;
  if (!G || !Player || !Ren || typeof document === 'undefined') return;
  if (G.PRESETS) for (const p in G.PRESETS) G.PRESETS[p].buildFx = p !== 'potato';
  if (VR.Settings && VR.Settings.add) VR.Settings.add({ key: 'buildFx', g: 'img', sec: 'objects', t: 'switch', lab: 'g.set.buildFx', tip: 'g.set.buildFx.tip', cost: 'low', def: true });
  const famOf = (g, s) => (g.audio && g.audio.familyOf ? g.audio.familyOf(s) : 'stone');

  // ---- 1 · placing and breaking
  const oAfter = Player.prototype.afterPlace;
  Player.prototype.afterPlace = function (type, x, y, z, s, list) {
    const g = this.game, me = g && g.player === this;
    const on = me && BF.enabled(g.settings);
    if (on && g.audio) { const C = g._bfCombo || (g._bfCombo = new Combo()); g.audio.pitchMul = C.hit(g.time || performance.now() / 1000); }
    try { oAfter.call(this, type, x, y, z, s, list); } finally { if (g && g.audio) g.audio.pitchMul = 1; }
    if (!me) return;
    if (VR.PickFind && type && type.name) VR.PickFind.noteRecent(type.name);
    if (!on) return;
    BF.pop(g, x, y, z, s);
    if (g.particles && (g.settings.particles | 0) > 0) BF.burst(g.particles, x, y, z, famOf(g, s), (g.settings.particles | 0) >= 2 ? 1 : 0.6);
  };
  const oBreak = Player.prototype.breakBlock;
  Player.prototype.breakBlock = function (x, y, z, s, survival, hand) {
    oBreak.call(this, x, y, z, s, survival, hand);
    const g = this.game; if (!g || g.player !== this || !BF.enabled(g.settings)) return;
    if (g._bfCombo) g._bfCombo.reset();
    if (g.particles && (g.settings.particles | 0) > 0) { const f = famOf(g, s); if (f !== 'glass' && f !== 'metal' && f !== 'water') BF.burst(g.particles, x, y, z, f === 'grass' ? 'dirt' : f, 0.5); }
  };
  // the pops: a ring of MAX_POPS records, made once
  BF.pop = function (g, x, y, z, s) {
    const L = g._bfPops || (g._bfPops = Array.from({ length: BF.MAX_POPS }, () => ({ on: false, x: 0, y: 0, z: 0, s: 0, t: 0, sky: 15, blk: 0 })));
    let q = L[0]; for (const p of L) { if (!p.on) { q = p; break; } if (p.t < q.t) q = p; }
    q.on = true; q.x = x; q.y = y; q.z = z; q.s = s; q.t = +g.time || 0;   // (the play clock: a slow frame shows the pop's middle, not its end)
    let sky = 0, blk = 0;   // the light around it (the cell itself is solid now)
    const w = g.world;
    for (let f = 0; f < 6; f++) { const v = w.getLight(x + VR.DX[f], y + VR.DY[f], z + VR.DZ[f]); sky = Math.max(sky, v >>> 12); blk = Math.max(blk, (v >> 8) & 15, (v >> 4) & 15, v & 15); }
    q.sky = sky; q.blk = blk;
  };

  // ---- the renderer: the pops and the stamp's ghost, after the crack (renderer.render calls popFx)
  const CUBE = [
    [[1, 1, 1], [1, 0, 1], [1, 0, 0], [1, 1, 0]], [[0, 1, 0], [0, 0, 0], [0, 0, 1], [0, 1, 1]],
    [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]], [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]],
    [[0, 1, 1], [0, 0, 1], [1, 0, 1], [1, 1, 1]], [[1, 1, 0], [1, 0, 0], [0, 0, 0], [0, 1, 0]]];
  const UVS = [[0, 0], [0, 1], [1, 1], [1, 0]], ORD = [0, 1, 2, 0, 2, 3], SHADE = [0.8, 0.8, 1, 0.55, 0.9, 0.9];
  const popBuf = new Float32Array(BF.MAX_POPS * 36 * 5);
  // f-polish: one line buffer for the pops' bright rims and the stamp ghost's edges (the line program, a draw each)
  const POff = (k) => !!(VR.Polish && VR.Polish.off && VR.Polish.off[k]);
  const EDGES = [[0, 0, 0, 1, 0, 0], [0, 1, 0, 1, 1, 0], [0, 0, 1, 1, 0, 1], [0, 1, 1, 1, 1, 1], [0, 0, 0, 0, 1, 0], [1, 0, 0, 1, 1, 0], [0, 0, 1, 0, 1, 1], [1, 0, 1, 1, 1, 1], [0, 0, 0, 0, 0, 1], [1, 0, 0, 1, 0, 1], [0, 1, 0, 0, 1, 1], [1, 1, 0, 1, 1, 1]];
  const rimBuf = new Float32Array(BF.MAX_POPS * 24 * 3);
  BF.RIM_DUR = 0.16;   // s: the pop's rim, bright, fading
  const THICK = [[0, 0, 0], [0.018, 0.018, 0], [0, 0.018, 0.018]];
  Ren.prototype.bfLines = function (data, nFloats, ver) {
    const gl = this.gl;
    if (!this.bfLineVBO) {
      this.bfLineVBO = gl.createBuffer(); this.bfLineVAO = gl.createVertexArray();
      gl.bindVertexArray(this.bfLineVAO); gl.bindBuffer(gl.ARRAY_BUFFER, this.bfLineVBO); gl.bufferData(gl.ARRAY_BUFFER, 4, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
      this.bfLineCap = 4; this.bfLineVer = -1;
    }
    gl.bindVertexArray(this.bfLineVAO); gl.bindBuffer(gl.ARRAY_BUFFER, this.bfLineVBO);
    if (ver === undefined || ver !== this.bfLineVer) {
      if (nFloats * 4 > this.bfLineCap) { gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, nFloats), gl.DYNAMIC_DRAW); this.bfLineCap = nFloats * 4; } else gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, nFloats);
      this.bfLineVer = ver === undefined ? -1 : ver;
    }
  };
  Ren.prototype.popFx = function (F) {
    const g = VR.game; if (!g || !F || !F.cam) return;
    if (g._bfPops) this.drawPops(g, F);
    if (g.gadgets && g.gadgets.wand && g.gadgets.wand.clip) this.drawStampGhost(g, F);
  };
  Ren.prototype.drawPops = function (g, F) {
    const now = +g.time || 0, L = g._bfPops, gl = this.gl, p = this.P.decal, cam = this.cam;
    let n = 0, bx = 0, by = 0, bz = 0;
    for (const q of L) {
      if (!q.on) continue;
      const age = now - q.t; if (age >= BF.POP_DUR || age < 0) { q.on = false; continue; }
      if (!n) { bx = q.x; by = q.y; bz = q.z; }
      const s = BF.popScale(age), h = s / 2, cx = q.x - bx + 0.5, cy = q.y - by + 0.5, cz = q.z - bz + 0.5;
      let o = n * 180;
      for (let f = 0; f < 6; f++) for (const k of ORD) { const c = CUBE[f][k]; popBuf[o++] = cx + (c[0] - 0.5) * 2 * h; popBuf[o++] = cy + (c[1] - 0.5) * 2 * h; popBuf[o++] = cz + (c[2] - 0.5) * 2 * h; popBuf[o++] = UVS[k][0]; popBuf[o++] = UVS[k][1]; }
      q._i = n; n++;
    }
    if (!n || !p) return;
    const E = F.env || {}, day = 1 - 0.82 * Math.min(1, Math.max(0, E.night || 0));
    gl.useProgram(p.p);
    gl.uniformMatrix4fv(p.u.u_viewProj, false, this.viewProj);
    gl.uniform3f(p.u.u_offset, bx - cam.x, by - cam.y, bz - cam.z);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.texAlbedo); gl.uniform1i(p.u.u_albedo, 0);
    gl.bindVertexArray(this.decalVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.decalVBO);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, popBuf, 0, n * 180);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    for (const q of L) {
      if (!q.on) continue;
      const age = now - q.t, a = BF.popAlpha(age), flash = 1 + 0.6 * Math.max(0, 1 - age / (BF.POP_DUR * 0.7)), br = Math.max(0.16, (q.sky / 15) * day, q.blk / 15) * 1.3 * flash;   // (1.3: the sunlit block's level in the scene — at 0.92 the pop read darker than the block, builder.mjs run 3)   // (it lands with a flash of light that fades as it settles)
      for (let f = 0; f < 6; f++) {
        gl.uniform1f(p.u.u_layer, R.T.tex[q.s * 6 + f] & 0xfff);
        const b = br * SHADE[f]; gl.uniform4f(p.u.u_color, b, b, b, a);
        gl.drawArrays(gl.TRIANGLES, q._i * 36 + f * 6, 6);
      }
    }
    gl.depthMask(true); gl.disable(gl.BLEND);
    this.stats.pops = n;
    // f-polish: a thin bright rim on each young pop's edges (its first 0.16 s, fading), additive
    const pl = this.P.line;
    if (pl && !POff('pop')) {
      let m = 0;
      for (const q of L) {
        if (!q.on) continue; const age = now - q.t; if (age > BF.RIM_DUR) continue;
        const h = BF.popScale(age) / 2 + 0.01, cx = q.x - bx + 0.5, cy = q.y - by + 0.5, cz = q.z - bz + 0.5;
        for (const e of EDGES) { const o = m * 6; rimBuf[o] = cx + (e[0] - 0.5) * 2 * h; rimBuf[o + 1] = cy + (e[1] - 0.5) * 2 * h; rimBuf[o + 2] = cz + (e[2] - 0.5) * 2 * h; rimBuf[o + 3] = cx + (e[3] - 0.5) * 2 * h; rimBuf[o + 4] = cy + (e[4] - 0.5) * 2 * h; rimBuf[o + 5] = cz + (e[5] - 0.5) * 2 * h; m++; }
      }
      if (m) {
        const ag = L.reduce((a, q) => (q.on && now - q.t <= BF.RIM_DUR ? Math.min(a, now - q.t) : a), 1), k = 1 - ag / BF.RIM_DUR;
        this.bfLines(rimBuf, m * 6);
        gl.useProgram(pl.p); gl.uniformMatrix4fv(pl.u.u_viewProj, false, this.viewProj); gl.uniform3f(pl.u.u_offset, bx - cam.x, by - cam.y, bz - cam.z);
        gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE); gl.depthMask(false);
        gl.uniform4f(pl.u.u_color, 1.0 * (1 + day), 0.95 * (1 + day), 0.8 * (1 + day), 0.9 * k);
        for (const d of THICK) { gl.uniform3f(pl.u.u_offset, bx - cam.x + d[0], by - cam.y + d[1], bz - cam.z + d[2]); gl.drawArrays(gl.LINES, 0, m * 2); }   // (three passes a hair apart: a 2–3 px line where GL draws 1)
        gl.depthMask(true); gl.disable(gl.BLEND); gl.bindVertexArray(null);
        this.stats.popRims = m / 12;
      }
    }
  };

  // ---- 3 · the stamp's ghost
  const colourOf = (g) => (s) => {
    const A = g.tex && g.tex.avgColor, layer = R.T.tex[s * 6 + 2] & 0xfff;
    if (!A) return [0.6, 0.6, 0.6];
    return [Math.min(1, A[layer * 4] * 1.15), Math.min(1, A[layer * 4 + 1] * 1.15), Math.min(1, A[layer * 4 + 2] * 1.15)];   // (linear: the scene's own space before the tone curve)
  };
  const holdsWand = (g) => { const h = g.player && g.player.inv && g.player.inv.held, d = h ? VR.itemDef(h.id) : null; return !!(d && d.use === 'wand'); };
  Ren.prototype.drawStampGhost = function (g, F) {
    const gad = g.gadgets, c = gad.wand.clip;
    if (!holdsWand(g) || g.hideHud || !VR.Stamp) return;
    const o = gad.pasteOrigin(); if (!o) return;
    if (!c._ghost) { c._ghost = VR.Stamp.ghost(c, colourOf(g), 40000); c._ghost.ver = (BF.ghostVer = (BF.ghostVer | 0) + 1); }
    const G2 = c._ghost; if (!G2.faces) return;
    const gl = this.gl, p = this.P.line, cam = this.cam;
    if (!this.ghostVBO) {
      this.ghostVBO = gl.createBuffer(); this.ghostVAO = gl.createVertexArray();
      gl.bindVertexArray(this.ghostVAO); gl.bindBuffer(gl.ARRAY_BUFFER, this.ghostVBO); gl.bufferData(gl.ARRAY_BUFFER, 4, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
      this.ghostVer = -1; this.ghostCap = 4;
    }
    gl.bindVertexArray(this.ghostVAO); gl.bindBuffer(gl.ARRAY_BUFFER, this.ghostVBO);
    if (this.ghostVer !== G2.ver) {
      if (G2.verts.byteLength > this.ghostCap) { gl.bufferData(gl.ARRAY_BUFFER, G2.verts, gl.DYNAMIC_DRAW); this.ghostCap = G2.verts.byteLength; } else gl.bufferSubData(gl.ARRAY_BUFFER, 0, G2.verts);
      this.ghostVer = G2.ver;
    }
    gl.useProgram(p.p);
    gl.uniformMatrix4fv(p.u.u_viewProj, false, this.viewProj);
    gl.uniform3f(p.u.u_offset, o[0] - cam.x, o[1] - cam.y, o[2] - cam.z);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.disable(gl.CULL_FACE);
    const pulse = 0.85 + 0.15 * Math.sin(performance.now() / 260);
    for (const q of G2.parts) { gl.uniform4f(p.u.u_color, q.c[0], q.c[1], q.c[2], q.c[3] * pulse); gl.drawArrays(gl.TRIANGLES, q.at, q.n); }
    // f-polish: the stamp's edges as bright lines (one draw) — the ghost's shape reads, not one flat tint
    if (G2.lines && G2.lines.length && !POff('ghost')) {
      this.bfLines(G2.lines, G2.lines.length, 'g' + G2.ver);
      gl.uniform4f(p.u.u_color, 1.0, 0.98, 0.88, 0.8 + 0.2 * pulse);
      for (const d of THICK) { gl.uniform3f(p.u.u_offset, o[0] - cam.x + d[0], o[1] - cam.y + d[1], o[2] - cam.z + d[2]); gl.drawArrays(gl.LINES, 0, G2.lines.length / 3); }
      this.stats.ghostEdges = G2.lines.length / 6;
    }
    gl.depthMask(true); gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE);
    gl.bindVertexArray(null);
    this.stats.ghost = G2.faces;
  };
  const Gad = VR.Gadgets;
  if (Gad && VR.Stamp) {
    const ST = VR.Stamp;
    const sizeOf = (c) => ({ sx: c.sx, sy: c.sy, sz: c.sz });
    const keysHint = (g) => g.ui && g.ui.hint(tx('g.stamp.keys', null, '📐 V stempelt · R dreht · L spiegelt · U nächster Bauplan · Z zurück', '📐 V stamps · R turns · L mirrors · U next blueprint · Z undo'), 4200);
    const oCopy = Gad.prototype.wandCopy;
    Gad.prototype.wandCopy = function () {
      const before = this.wand.clip;
      oCopy.call(this);
      const c = this.wand.clip; if (!c || c === before) return;
      const ok = ST.save({ name: tx('g.stamp.name', sizeOf(c), 'Bauplan {sx} × {sy} × {sz}', 'Blueprint {sx} × {sy} × {sz}'), code: ST.encode(c), at: Date.now() });
      this.wand.libI = 0;
      this.g.ui.hint(ok ? tx('g.stamp.saved', sizeOf(c), '📐 Als Bauplan gemerkt ({sx} × {sy} × {sz}) — V stempelt ihn überall, R dreht, L spiegelt', '📐 Kept as a blueprint ({sx} × {sy} × {sz}) — V stamps it anywhere, R turns, L mirrors') : tx('g.stamp.full', null, '📐 Kopiert — der Browserspeicher ist voll, der Bauplan gilt nur bis zum Schließen', '📐 Copied — the browser storage is full, the blueprint lasts until you close'), 4200);
    };
    const oInput = Gad.prototype.wandInput;
    Gad.prototype.wandInput = function (input, p, lmb, rmb) {
      const W = this.wand, g = this.g;
      if (!W.clip && !W._libTried) {   // (the newest saved stamp is in the wand when a world starts)
        W._libTried = true;
        const L = ST.lib(); const c = L.length ? ST.decode(L[0].code) : null;
        if (c) { W.clip = c; W.libI = 0; }
      }
      if (!(g.ui && g.ui.typing) && !lmb && !rmb) {
        if (input.hit('KeyL') && W.clip) { W.clip = ST.transform(W.clip, 0, true); g.ui.hint(tx('g.stamp.mirrored', null, '📐 Gespiegelt', '📐 Mirrored'), 1200); }
        else if (input.hit('KeyU')) {
          const L = ST.lib();
          if (!L.length) g.ui.hint(tx('g.stamp.none', null, '📐 Noch kein Bauplan — zwei Ecken setzen (Klick links / rechts), dann C', '📐 No blueprint yet — set two corners (left / right click), then C'), 3000);
          else { W.libI = ((W.libI | 0) + 1) % L.length; const c = ST.decode(L[W.libI].code); if (c) { W.clip = c; g.ui.hint(tx('g.stamp.next', { i: W.libI + 1, n: L.length, name: L[W.libI].name }, '📐 Bauplan {i} / {n}: {name}', '📐 Blueprint {i} / {n}: {name}'), 2200); } }
        }
      }
      const had = W.clip, shown = W._hintFor;
      const r = oInput.call(this, input, p, lmb, rmb);
      if (W.clip && shown !== W.clip && had === W.clip && !W._keysShown) { W._keysShown = true; keysHint(g); }
      W._hintFor = W.clip;
      return r;
    };
    // a stamp reaches 48 blocks (a house is placed from where you can see it whole, not from its doorstep)
    const oOrigin = Gad.prototype.pasteOrigin;
    Gad.prototype.pasteOrigin = function () {
      const o = oOrigin.call(this); if (o) return o;
      const c = this.wand.clip, p = this.g.player, PH = VR.PHYS; if (!c || !p || !PH || (this.g.ui && this.g.ui.blocking)) return null;
      const w = this.g.world, e = p.eyePos(), d = p.lookDir();
      const t = PH.raycast((x, y, z) => w.getBlock(x, y, z), e[0], e[1], e[2], d[0], d[1], d[2], 48, null);
      return t ? ST.origin(c, t.x + VR.DX[t.face], t.y + VR.DY[t.face], t.z + VR.DZ[t.face]) : null;
    };
    const oPaste = Gad.prototype.wandPaste;
    Gad.prototype.wandPaste = function () {
      const c = this.wand.clip, o = this.pasteOrigin(), n0 = this.wand.undo.length;
      oPaste.call(this);
      if (c && o && this.wand.undo.length > n0) {
        const g = this.g, P = g.particles;
        if (BF.enabled(g.settings) && P && (g.settings.particles | 0) > 0) for (let i = 0; i < 24; i++) P.spawn(o[0] + Math.random() * c.sx, o[1] + Math.random() * c.sy, o[2] + Math.random() * c.sz, 0, 0.4 + Math.random() * 0.4, 0, { life: 0.6 + Math.random() * 0.5, size: 0.05, grav: 0, col: [1, 0.86, 0.5], emis: 1, drag: 1, collide: false });
        if (VR.EventLog && VR.EventLog.emit) VR.EventLog.emit('build', 'stamp', 2, [o[0] + c.sx / 2, o[1] + c.sy / 2, o[2] + c.sz / 2], 'stamp', Math.max(c.sx, c.sy, c.sz) / 2);
      }
    };
  }

  // ---- 2 · the picker
  const UI = VR.UI, PF = VR.PickFind;
  if (!UI || !PF) return;
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pro = () => (VR.UIPrefs ? !!VR.UIPrefs.get().pro : true);
  const emitOf = (id) => { const t = R.byName[id]; return t ? R.T.emit[t.defaultState] : 0; };
  BF.allItems = function (g) {
    if (!g._cat) g.creativeItems('build');
    if (g._bfAll) return g._bfAll;
    const all = [], seen = new Set();
    for (const c in g._cat) for (const id of g._cat[c]) if (!seen.has(id)) { seen.add(id); all.push(id); }
    return (g._bfAll = all);
  };
  BF.index = function (g) {
    const lang = VR.I18N ? VR.I18N.lang : 'de';
    if (g._bfIdx && g._bfIdxLang === lang) return g._bfIdx;
    const t0 = performance.now();
    g._bfIdx = PF.index(BF.allItems(g), (id) => { const d = VR.itemDef(id); return [VR.itemName(id), d ? (d.block ? d.block.display : d.name) : id]; }, (id) => (R.byName[id] ? 10 : 0));
    g._bfIdxLang = lang; BF.indexMs = performance.now() - t0;
    return g._bfIdx;
  };
  const oItems = G.prototype.creativeItems;
  G.prototype.creativeItems = function (tab, search) {
    if (tab === 'search' && search && search.trim()) return PF.searchIndex(BF.index(this), search, 600);
    if (typeof tab === 'string' && tab.indexOf('fam:') === 0) return PF.filter(BF.allItems(this), { family: tab.slice(4) }, emitOf).slice(0, 600);
    if (typeof tab === 'string' && tab.indexOf('col:') === 0) return PF.filter(BF.allItems(this), { colour: tab.slice(4) }, emitOf).slice(0, 600);
    return oItems.call(this, tab, search);
  };
  const exists = (id) => !!((R.byName[id] && !R.byName[id].o.noItem && R.byName[id].cat) || (VR.ITEMS && VR.ITEMS[id]));
  function row(ui, label, ids) {
    const r = el('div', 'pickrow'); r.appendChild(el('span', 'picklab', esc(label)));
    for (const id of ids) {
      const s = el('div', 'slot'); s.innerHTML = '<canvas width="48" height="48"></canvas>'; s.dataset.id = id;
      s.onmousedown = (e) => { e.preventDefault(); ui.paletteClick(id, e); };
      s.onmouseenter = () => ui.showTooltip(id); s.onmouseleave = () => ui.hideTooltip();
      r.appendChild(s); ui.iconPump().add(s.firstChild, id);
    }
    return r;
  }
  BF.pickerBar = function (ui) {
    const g = ui.game, left = document.querySelector('#invpanel .invwrap > .col'); if (!left) return;
    const tabs = left.querySelector('.tabs'), pal = left.querySelector('.palette'); if (!tabs || !pal) return;
    const old = left.querySelector('input.search'); if (old) old.remove();   // (the search is always on top now)
    const bar = el('div', 'pickbar');
    const inp = el('input', 'picksearch'); inp.type = 'text'; inp.spellcheck = false;
    inp.placeholder = tx('g.pick.ph', null, '🔍 Block suchen — einfach lostippen: Holz, Ziegel, Glas, Laterne …', '🔍 Find a block — just start typing: wood, brick, glass, lantern…');
    if (ui.creativeTab === 'search') inp.value = ui.searchText || '';
    const refill = () => { for (const b of tabs.children) b.classList.toggle('on', b.dataset.cat === ui.creativeTab); for (const b of bar.querySelectorAll('[data-pick]')) b.classList.toggle('on', b.dataset.pick === ui.creativeTab); ui.fillPalette(pal); };
    inp.oninput = () => {
      const v = inp.value;
      if (v && ui.creativeTab !== 'search') ui._pickPrev = ui.creativeTab;
      ui.searchText = v; ui.creativeTab = v ? 'search' : (ui._pickPrev || 'build');
      refill();
    };
    inp.onkeydown = (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') { if (inp.value) { inp.value = ''; inp.oninput(); } else inp.blur(); e.preventDefault(); }
      else if (e.key === 'Enter') {
        const first = g.creativeItems('search', inp.value)[0];
        if (first && g.player) { if (R.byName[first]) g.player.pickBlock(first); else { const inv = g.player.inv; inv.slots[inv.sel] = { id: first, n: VR.maxStack(first) }; inv.changed = true; } PF.noteRecent(first); ui.updateHUD(true); ui.hint(tx('g.pick.inHand', { name: VR.itemName(first) }, '✋ {name} in der Hand', '✋ {name} in your hand'), 1600); ui.closeInventory(); }
        e.preventDefault();
      }
    };
    bar.appendChild(inp);
    if (pro()) {
      const chips = el('div', 'pickchips');
      for (const f of PF.FAMILIES) {
        const b = el('button', 'pickchip'); b.dataset.pick = 'fam:' + f.id;
        b.textContent = f.icon + ' ' + tx('g.pick.fam.' + f.id, null, f.de, f.en);
        b.onclick = () => { ui.creativeTab = 'fam:' + f.id; inp.value = ''; ui.searchText = ''; refill(); };
        chips.appendChild(b);
      }
      for (const c of PF.COLOURS) {
        const b = el('button', 'pickdot'); b.dataset.pick = 'col:' + c.id; b.style.background = c.hex;
        b.title = tx('g.pick.col.' + c.id, null, c.de, c.en);
        b.onclick = () => { ui.creativeTab = 'col:' + c.id; inp.value = ''; ui.searchText = ''; refill(); };
        chips.appendChild(b);
      }
      bar.appendChild(chips);
    }
    const rec = PF.recent().filter(exists);
    if (rec.length) bar.appendChild(row(ui, tx('g.pick.recent', null, '🕘 Zuletzt', '🕘 Recent'), rec.slice(0, PF.RECENT_MAX)));
    if (pro() && VR.Favs) { const fav = VR.Favs.list().filter(exists).slice(0, 12); if (fav.length) bar.appendChild(row(ui, tx('g.pick.favs', null, '★ Favoriten', '★ Favourites'), fav)); }
    left.insertBefore(bar, tabs);
    for (const b of bar.querySelectorAll('[data-pick]')) b.classList.toggle('on', b.dataset.pick === ui.creativeTab);
    if (ui.creativeTab === 'search') setTimeout(() => { try { inp.focus(); const n = inp.value.length; inp.setSelectionRange(n, n); } catch (e) { /* */ } }, 0);
    ui._pickInput = inp;
    // the search's index in idle time (the first letter is then at once)
    if (!g._bfIdx) setTimeout(() => { try { BF.index(g); } catch (e) { /* */ } }, 30);
  };
  const oRender = UI.prototype.renderInventory;
  UI.prototype.renderInventory = function () {
    const t0 = performance.now();
    oRender.call(this);
    if (this.invKind === 'creative') { try { BF.pickerBar(this); } catch (e) { console.warn('picker', e); } }
    this.pickMs = performance.now() - t0;
  };
  const oPick = UI.prototype.paletteClick;
  UI.prototype.paletteClick = function (id, e) { if (id && R.byName[id]) PF.noteRecent(id); return oPick.call(this, id, e); };
  // typing a letter anywhere in the creative inventory starts the search (E still closes it; digits stay the hotbar's)
  window.addEventListener('keydown', (e) => {
    const g = VR.game, ui = g && g.ui;
    if (!ui || ui.screen !== 'inventory' || ui.invKind !== 'creative') return;
    const tg = e.target; if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA')) return;
    if (e.ctrlKey || e.metaKey || e.altKey || !e.key || e.key.length !== 1 || !/\p{L}/u.test(e.key) || e.code === 'KeyE') return;
    const inp = ui._pickInput; if (!inp || !inp.isConnected) return;
    inp.focus(); e.stopPropagation();
  }, true);
  // the picker's look (tokens.css colours; small)
  const css = el('style'); css.textContent = `
.pickbar{display:flex;flex-direction:column;gap:6px;margin:0 0 8px}
.picksearch{width:100%;box-sizing:border-box;padding:9px 12px;border-radius:10px;border:1px solid rgba(120,200,255,.35);background:rgba(8,14,28,.85);color:#eef4ff;font:600 15px/1.2 var(--st-font,sans-serif)}
.picksearch:focus{outline:2px solid rgba(255,200,90,.8)}
.pickchips{display:flex;flex-wrap:wrap;gap:5px;align-items:center}
.pickchip{padding:4px 9px;border-radius:999px;border:1px solid rgba(120,200,255,.25);background:rgba(20,30,52,.85);color:#dfe9ff;font:600 12px/1.2 var(--st-font,sans-serif);cursor:pointer}
.pickchip.on,.pickdot.on{outline:2px solid #ffc85a}
.pickdot{width:18px;height:18px;border-radius:50%;border:1px solid rgba(255,255,255,.35);cursor:pointer;padding:0}
.pickrow{display:flex;gap:4px;align-items:center;flex-wrap:nowrap;overflow:hidden}
.pickrow .slot{width:44px;height:44px}.pickrow .slot canvas{width:34px;height:34px}
.picklab{min-width:92px;color:#b9c8e6;font:600 12px/1.2 var(--st-font,sans-serif)}`;
  document.head.appendChild(css);
})(VR);
