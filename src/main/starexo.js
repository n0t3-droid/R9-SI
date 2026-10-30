// ============================================================================
// u-stars2 · the worlds of other stars from the ground, the first visit, the route (docs/superpowers/plans/
// 2026-10-30-u-stars2.md). After starjump.js, which already wraps U.localSky / BodySky.compute for the x.* dims:
//   · U.localSky for an x.* dim: the system's own sun (VR.Exo.sky — the world's own day clock, a locked world's sun that
//     stands), no Helia family, no eclipse; the light, the shadows and the air's LUT follow it (bodysky.js reads it)
//   · BodySky: the star's colour harder (a red dwarf's peach day, a hot star's harsh white), the companion of a pair as
//     a second sun in the sky (its colour, its disc or its point, its glare: bsSun2), the world's own ring arching over
//     the sky (bsAmarant with the eye on the surface), and on a binary world from Low up (q.hshadow, never Very Low) a
//     second direct light in the terrain with heightmap shadows toward the companion (SUN2): two shadows
//   · the first visit of a system: the codex milestone „Fremde Sonne", AWARDS.system (200 XP, 150 Taler), a chat line;
//     the route (meta.stars.route, the last 64 stops) for the star map
// Cost: nothing at home (no program changes); on an exo world the sky's two small functions; SUN2 one more heightmap
// ray per sunlit terrain pixel on binary worlds from Low up.
// ============================================================================
(function (VR) {
  'use strict';
  const SJ = VR.StarJump, E = VR.Exo, U = VR.Universe, G = VR.Galaxy;
  // f-polish: a day with air no longer blown out — the eye adapts to the star's sky: the exposure capped so the sky's
  // mean (zenith and horizon, exposed) is about 0.4 before the tone curve, never below half the base's (pure: node)
  VR.ExoDayExpo = (expo, skyLum) => (skyLum > 0 ? expo * Math.min(1, Math.max(0.5, 0.4 / (skyLum * expo))) : expo);
  if (!SJ || !SJ.page || !E || !U) return;
  const X2 = VR.StarExo = { cur: null };
  const T = (k, v) => (VR.I18N ? VR.I18N.t(k, v) : k);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const ss = (a, b, x) => { let t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
  const lumOf = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const colOf = (hex) => { const c = G.lin(hex), l = lumOf(c) || 1; return [c[0] / l, c[1] / l, c[2] / l]; };

  // ---------------------------------------------------------------- the sky of the moment (the exo sun)
  const FAKE = { id: '_exo', dir: [0, -1, 0], ang: 1e-6, phase: 0, pole: [0, 1, 0] }, NOB = [];
  const OUT = { sun: { dir: [0, 1, 0], ang: 0.005, el: 0 }, bodies: NOB, parent: FAKE, eclipse: 0, _byId: null };
  let IN = undefined;
  const SK = { sun: [0, 1, 0], sun2: [0, 1, 0] };
  const base = U.localSky;
  U.localSky = function (dim, pos, t, out) {
    const x = typeof dim === 'string' && dim[0] === 'x' ? SJ.exoStar(dim) : null;
    if (!x || !x.pl) return base.call(this, dim, pos, t, out);
    IN = base.call(this, dim, pos, t, IN);
    if (!IN) return null;
    const s = E.sky(x.def, x.pl, t, SK);
    const o = out && out.exo ? out : OUT;
    o.sun.dir[0] = s.sun[0]; o.sun.dir[1] = s.sun[1]; o.sun.dir[2] = s.sun[2]; o.sun.ang = s.ang; o.sun.el = Math.asin(clamp(s.sun[1], -1, 1));
    o.bodies = NOB; o.parent = FAKE; o.eclipse = 0; o._byId = null; o.dim = dim; o.lat = IN.lat; o.lon = IN.lon; o.exo = s;
    return o;
  };
  X2.sky = SK;

  // ---------------------------------------------------------------- the light and the sky's uniforms
  const SUN = [2.85, 2.9, 3.05], SUN2U = new Float32Array(4), SUN2C = new Float32Array(4);
  const wrapBS = () => {
    const BS = VR.BodySky; if (!BS || BS.stars2Wrapped) return;
    BS.stars2Wrapped = true;
    const base2 = BS.compute;
    BS.compute = function (dim, eye, tt, o) {
      const r = base2.call(this, dim, eye, tt, o);
      const x = r && typeof dim === 'string' && dim[0] === 'x' ? SJ.exoStar(dim) : null;
      if (!x || !x.pl) return r;
      const st = x.def.star, s = r.raw && r.raw.exo ? r.raw.exo : E.sky(x.def, x.pl, tt, SK), L = r.light;
      // the star's colour: a red dwarf's day peach — u-stars' 0.6 of its colour made the light 9 : 1 red over blue and
      // a violet ground red (run 2 at 0.98: 39 : 1, everything red); the eye adapts further, to about 3 : 1 — a K star's
      // orange a little warmer; a hot star's harsh white — brighter, its shade darker
      const tint = colOf(st.color), Hs = colOf('#dddeff');
      const ex = st.T < 3900 ? -0.3 : st.T < 5200 ? 0.1 : 0;
      const kx = [0, 1, 2].map(i => Math.pow(tint[i] / Hs[i], ex));
      const hot = st.T >= 7500 ? 1 : 0;
      L.sunColor = L.sunColor.map((v, i) => v * kx[i] * (1 + 0.3 * hot));
      L.ambSky = L.ambSky.map((v, i) => v * kx[i] * (1 - 0.25 * hot));
      L.far = L.far.map((v, i) => v * kx[i]);
      r.sky.sunCol = r.sky.sunCol.map((v, i) => v * kx[i]);
      // f-polish: the air's stops in the star's colour too (a red dwarf's sky deeper peach), the eye adapted to them
      if (r.sky.air3 && !(VR.Polish && VR.Polish.off && VR.Polish.off.exo)) {
        const a3 = r.sky.air3; for (let i = 0; i < a3.length; i++) a3[i] *= kx[i % 3];
        if (r.sky.airB) r.sky.airB = r.sky.airB.map((v, i) => v * kx[i % 3]);
        const Ls = 0.5 * (lumOf([a3[0], a3[1], a3[2]]) + lumOf([a3[3], a3[4], a3[5]]));
        r.expo = VR.ExoDayExpo(r.expo, Ls); r.exoLs = Ls;
      }
      // the companion: a second sun (close pair) or a brilliant point (wide pair)
      const S2 = r.sky.sun2 = SUN2U, C2 = r.sky.sun2c = SUN2C;   // (kept arrays: no allocation per frame)
      let sun2 = null;
      if (s.has2) {
        const c2 = colOf(s.color2), d = s.sun2;
        S2[0] = d[0]; S2[1] = d[1]; S2[2] = d[2]; S2[3] = Math.max(s.ang2, 0.0012);
        const rad = 60 * clamp(Math.pow(s.T2 / st.T, 2), 0.15, 2);
        C2[0] = c2[0] * rad; C2[1] = c2[1] * rad; C2[2] = c2[2] * rad; C2[3] = clamp(Math.sqrt(s.k2) * 0.9, 0.03, 1.2);
        // its light on the ground (the eye adapted to the primary: its colour relative to the primary's)
        const up = ss(-0.03, 0.06, d[1]);
        if (s.k2 > 0.02 && up > 0) {
          const c1 = tint, sc = Hs.map((h, i) => Math.pow(c2[i] / h, 0.6) / Math.pow(c1[i] / h, 0.6));
          sun2 = [d[0], d[1], d[2], up, SUN[0] * s.k2 * sc[0] * up, SUN[1] * s.k2 * sc[1] * up, SUN[2] * s.k2 * sc[2] * up];
          L.ambSky = L.ambSky.map((v, i) => v + sun2[4 + i] * 0.035);
        }
      } else { S2[3] = 0; C2[3] = 0; }
      // the world's own ring over the sky (bsAmarant: the eye on the surface — its body skipped, the ring and the
      // world's shadow on it kept)
      const rg = E.ring(x.def, x.pl);
      if (rg) {
        const ph = s.phi;
        r.sky.par = [0, -1, 0, 1.0005]; r.sky.pole = [0, Math.sin(ph), -Math.cos(ph), 1]; r.sky.parX = [1, 0, 0, 0]; r.sky.parK = [-1, 0, 0, s.ang];
        r.sky.lum[0] = Math.min(1, r.sky.lum[0] * 1.2);
      }
      r.exo2 = { sun2, ring: !!rg, sig: E.signature(x.def, x.pl), day: s.day, locked: s.locked, T: st.T, k2: s.k2, sep: s.sep };
      if (VR.game && dim === VR.game.dim) X2.cur = { dim, sun2, exo: r.exo2 };
      return r;
    };
    // the sky program's two new uniforms (the companion)
    const un0 = BS.uniforms;
    const Z4 = new Float32Array(4);
    BS.uniforms = function (gl, u, S) {
      un0.apply(this, arguments);
      if (u.u_bsSun2) gl.uniform4fv(u.u_bsSun2, (S && S.sun2) || Z4);
      if (u.u_bsSun2C) gl.uniform4fv(u.u_bsSun2C, (S && S.sun2c) || Z4);
    };
  };
  wrapBS();

  // ---------------------------------------------------------------- SUN2: the second sun's light and shadows in the terrain
  X2.want = (r) => {
    const g = VR.game, c = X2.cur;
    return !!(g && c && c.sun2 && g.dim === c.dim && r && r.q && r.q.hshadow && !r.q.lite && (!g.settings || g.settings.sun2 !== false));
  };
  if (VR.GL && !VR.GL.__stars2) {
    const prev = VR.GL.defineHook || null;
    VR.GL.defineHook = (name, defines) => {
      const d = prev ? prev(name, defines) : (defines || []);
      if ((name === 'terrain' || name === 'terrainCut') && X2.built) return d.concat(['SUN2']);
      return d;
    };
    VR.GL.__stars2 = true;
  }
  const Rn = VR.Renderer;
  if (Rn && !Rn.prototype.__stars2) {
    const render0 = Rn.prototype.render;
    Rn.prototype.render = function (F) {
      const w = X2.want(this);
      if (w !== !!X2.built) { X2.built = w; this.buildPrograms(); }
      return render0.call(this, F);
    };
    const common0 = Rn.prototype.common;
    Rn.prototype.common = function (p, Ev) {
      common0.call(this, p, Ev);
      if (p.u.u_sun2D) {
        const s = X2.cur && X2.cur.sun2;
        if (s) { this.gl.uniform4f(p.u.u_sun2D, s[0], s[1], s[2], s[3]); this.gl.uniform4f(p.u.u_sun2C, s[4], s[5], s[6], 0); }
        else { this.gl.uniform4f(p.u.u_sun2D, 0, -1, 0, 0); this.gl.uniform4f(p.u.u_sun2C, 0, 0, 0, 0); }
      }
    };
    Rn.prototype.__stars2 = true;
  }
  if (VR.Settings && VR.Settings.add) VR.Settings.add({ key: 'sun2', g: 'img', sec: 'show', t: 'switch', lab: 'g.set.sun2', tip: 'g.set.sun2.tip', cost: 'low', def: true });

  // ---------------------------------------------------------------- the first visit, the route
  const route = (g) => { const m = g.meta; if (!m.stars) m.stars = { v: [] }; if (!Array.isArray(m.stars.route)) m.stars.route = []; return m.stars.route; };
  X2.route = route;
  X2.push = (g, idx) => { const r = route(g); if (r[r.length - 1] !== idx) r.push(idx); if (r.length > 64) r.splice(0, r.length - 64); };
  const enter0 = SJ.enter;
  SJ.enter = function (g, idx, o) {
    const first = !!(g && g.meta && !(SJ.visited(g).includes(idx)));
    const ok = enter0.apply(this, arguments);
    if (!ok) return ok;
    if (!route(g).length) X2.push(g, 0);
    X2.push(g, idx);
    if (first && !(g.meta && g.meta.guest)) {
      const S = g.stars, nm = S && S.def ? SJ.nameOf(S.def.name) : '';
      if (g.codex && g.codex.event) g.codex.event('stars');
      if (VR.Adventure && VR.Adventure.award) VR.Adventure.award('system', { id: 'x' + idx });
      if (g.ui && g.ui.chatLine && !(o && o.quiet)) g.ui.chatLine(T('g.stars2.first', { name: nm }), '#ffe08a');
      X2.lastFirst = idx;
    }
    return ok;
  };
  const jump0 = SJ.jump;
  SJ.jump = function (g, idx) { const ok = jump0.apply(this, arguments); if (ok && idx === 0) X2.push(g, 0); return ok; };
  // the landing's words: what makes this world (once per landing)
  const go0 = VR.Travel && VR.Travel.go;
  X2.said = '';
  X2.landLine = function (g) {
    const x = g && g.dim && g.dim[0] === 'x' ? SJ.exoStar(g.dim) : null; if (!x || !x.pl || X2.said === g.dim) return;
    X2.said = g.dim;
    const sig = (g.meta.universe && g.meta.universe.xgen >= 2) ? E.signature(x.def, x.pl) : null, out = [];
    if (sig) out.push(T('g.stars2.land.' + sig));
    if (E.ring(x.def, x.pl)) out.push(T('g.stars2.ring'));
    if (x.def.star2 && x.def.star2.close) out.push(T('g.stars2.sun2'));
    if (out.length && g.ui && g.ui.chatLine) g.ui.chatLine(out.join(' '), '#c9b8ff');
  };
  void go0;
  const pf0 = VR.Game.prototype.playFrame;
  VR.Game.prototype.playFrame = function (dt) {
    if (this.dim && this.dim[0] === 'x' && X2.said !== this.dim && this.state === 'play' && this.player) X2.landLine(this);
    return pf0.call(this, dt);
  };
})(VR);
