// ============================================================================
// o-seamless · VR.Journey — journeys you walk or ride, the world visible all the way (docs/superpowers/plans/
// 2026-11-01-o-seamless.md; the rules in journey_core.js). The owner: „es fühlt sich depressiv an, alles manuell separat
// zu besichtigen".
//   · die Himmelsleiter (Herzwelt → Ringstation): a glass cabin rides you up — over the voxel world to 2,350 m (the climb
//     band's own sky: the air thins, the curve, the impostor), then through the orbit renderer up the tether to the
//     station, the world switch under it. At the Bergstation (stand in the glowing cabin) or the Leuchtpfad's Ringstation
//   · die Lichtbrücken: every gate trip (Low and up) is a shining path through space you walk along (W) or are carried
//     on, the destination swelling ahead; the arrival on foot at its gate (VR.Portal.go with o.walk, o.player, o.adv)
//   · die Karawanen: at every village and town a hover-cart with its driver waits; [V] rides to the next place, the land
//     passing, a line or two, a moment on the way; Shift gets off
//   · the arrival is alive: the Wanderregisseur is asked for a moment 3 s after it
//   · meta.journey: a running journey is kept (save / resume mid-journey)
// Cost: idle a look at the carts every 0.25 s; a ride one model and one figure; the lift's ground phase the climb band
// (render distance 2 above 800 m) and a 2-D cabin overlay; the space phases one space frame (the renderer's tier).
// Very Low and ⚙ „Reisen zu Fuß" off: the films as before (VR.Portal), the caravans stay (a walk on a cart).
// Test hooks: VR.Journey.stats() · lift(g) · bridge(g, dim) · ride(g) · carts(g) · pause(on) · cost(g, n)
// ============================================================================
(function (VR) {
  'use strict';
  if (typeof window === 'undefined' || !VR.Game || !VR.JourneyCore) return;
  const K = VR.JourneyCore, JY = VR.Journey = {}, doc = document;
  const T = (k, v) => (VR.I18N ? VR.I18N.t(k, v) : k);
  const now = () => performance.now();
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const ease = (t) => t * t * (3 - 2 * t);
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = (a) => Math.hypot(a[0], a[1], a[2]);
  const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const perp = (v, n) => { const d = dot(v, n); return norm([v[0] - n[0] * d, v[1] - n[1] * d, v[2] - n[2] * d]); };
  const perm = (v) => [v[1], v[2], v[0]];   // (VR.Universe's axes → the space scene's, as stations.js)
  const D2R = Math.PI / 180;
  if (VR.Settings && VR.Settings.add) VR.Settings.add({ key: 'journeys', g: 'play', sec: 'play', t: 'switch', lab: 'g.set.journeys', tip: 'g.set.journeys.tip', cost: 'low', def: true });

  const M = { J: null, carts: [], cartT: 0, offer: null, saveT: 0, resumed: {}, paused: false, alive: null, log: [], cab: null, keyHeld: false, lastSkip: false };
  JY.M = M;
  const ctxOf = (g) => ({ off: !!(g.settings && g.settings.journeys === false), potato: !!(g.settings && g.settings.preset === 'potato'), guest: !!(g.mp && g.mp.guest), flight: !!(g.flight && g.flight.regime && g.flight.regime !== 'air') || !!(g.gadgets && g.gadgets.riding && g.gadgets.riding.type !== 'journey') });
  const palOf = (dim) => { const d = dim && VR.DimReg && VR.DimReg.get(dim); return (d && d.veil) || ['#ffffff', '#c8d8ff', '#202850']; };
  const hex = (s) => { const n = parseInt(String(s).slice(1), 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgba = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a.toFixed(3) + ')';
  const worldT = (g) => (VR.SpaceScene && g.env ? VR.SpaceScene.worldTime(g.env.day, g.env.ticks) : 0);
  const note = (g, text, ms) => { try { if (g.ui && g.ui.hint) g.ui.hint(text, ms || 4200); } catch (e) { /* no hint */ } };
  const ev = (what) => { M.log.push({ t: Math.round(now()) / 1000, what }); if (M.log.length > 80) M.log.shift(); };
  const save = (g, rec) => { try { if (!g.meta) return; if (rec) g.meta.journey = rec; else delete g.meta.journey; if (g.saveMeta) g.saveMeta(); } catch (e) { /* the next save */ } };
  const snap = (J) => Object.assign(K.snap(J.st), J.base ? { base: J.base } : {}, J.dest ? { dest: { dim: J.dest.dim, at: J.dest.at || null } } : {}, J.place ? { place: J.place } : {});
  // the stars of a painted backdrop (made once)
  const STARS = []; for (let i = 0; i < 160; i++) { const a = Math.sin(i * 12.9898) * 43758.5453, b = Math.sin(i * 78.233) * 12543.123; STARS.push([a - Math.floor(a), b - Math.floor(b), 0.3 + ((i * 37) % 10) / 14]); }
  function paintSpace(X, W, H, tint) {
    const gr = X.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#02030a'); gr.addColorStop(1, tint ? rgba(tint, 1) : '#080c22');
    X.fillStyle = gr; X.fillRect(0, 0, W, H);
    for (const s of STARS) { X.fillStyle = 'rgba(235,240,255,' + (s[2] * 0.8).toFixed(2) + ')'; X.fillRect(s[0] * W, s[1] * H, 1.4, 1.4); }
  }

  // ================================================================ the cabin (a 2-D overlay: the glass, the brass, the tether)
  function cabin(X, W, H, t, alt, rate) {
    X.save();
    const gl = X.createLinearGradient(0, 0, W, 0);
    gl.addColorStop(0, 'rgba(170,215,255,0.13)'); gl.addColorStop(0.12, 'rgba(170,215,255,0.0)'); gl.addColorStop(0.88, 'rgba(170,215,255,0.0)'); gl.addColorStop(1, 'rgba(170,215,255,0.13)');
    X.fillStyle = gl; X.fillRect(0, 0, W, H);
    // the reflection's streak across the glass
    X.globalAlpha = 0.06; X.fillStyle = '#ffffff'; X.beginPath(); X.moveTo(W * 0.18, 0); X.lineTo(W * 0.26, 0); X.lineTo(W * 0.12, H * 0.86); X.lineTo(W * 0.04, H * 0.86); X.fill(); X.globalAlpha = 1;
    // the tether beside the cabin, its marker lights sliding down as you rise
    const tx = W * 0.83, sp = H * 0.11, off = ((alt * 0.9) % sp + sp) % sp;
    X.strokeStyle = 'rgba(255,236,190,0.75)'; X.lineWidth = Math.max(2, W * 0.004); X.beginPath(); X.moveTo(tx, 0); X.lineTo(tx, H * 0.88); X.stroke();
    for (let y = off - sp; y < H * 0.88; y += sp) { const k = 0.5 + 0.5 * Math.sin(t * 6 + y); X.fillStyle = 'rgba(255,214,140,' + (0.45 + 0.4 * k).toFixed(2) + ')'; X.beginPath(); X.arc(tx, y, Math.max(2.5, W * 0.0045), 0, Math.PI * 2); X.fill(); }
    if (rate > 30) { X.strokeStyle = 'rgba(255,236,190,' + clamp((rate - 30) / 400, 0, 0.35).toFixed(2) + ')'; X.lineWidth = W * 0.012; X.beginPath(); X.moveTo(tx, 0); X.lineTo(tx, H * 0.88); X.stroke(); }
    // the frame: two slim mullions, the top beam, the rail and the floor
    const br = (x, y, w, h) => { const g2 = X.createLinearGradient(x, y, x + w, y); g2.addColorStop(0, '#5a4220'); g2.addColorStop(0.5, '#d8b46a'); g2.addColorStop(1, '#6a4c22'); X.fillStyle = g2; X.fillRect(x, y, w, h); };
    br(W * 0.035, 0, W * 0.014, H); br(W * 0.951, 0, W * 0.014, H);
    X.fillStyle = '#3a2c18'; X.fillRect(0, 0, W, H * 0.035); X.fillStyle = 'rgba(255,220,150,0.5)'; X.fillRect(0, H * 0.035, W, Math.max(1, H * 0.003));
    const fl = X.createLinearGradient(0, H * 0.9, 0, H); fl.addColorStop(0, '#2a2420'); fl.addColorStop(1, '#14100c'); X.fillStyle = fl; X.fillRect(0, H * 0.9, W, H * 0.1);
    X.strokeStyle = 'rgba(255,200,120,0.18)'; X.lineWidth = 1; for (let i = 1; i < 12; i++) { X.beginPath(); X.moveTo(W * i / 12, H * 0.9); X.lineTo(W * (0.5 + (i / 12 - 0.5) * 1.6), H); X.stroke(); }
    br(0, H * 0.865, W, Math.max(3, H * 0.012));
    for (let i = 1; i < 8; i++) br(W * i / 8 - W * 0.004, H * 0.87, W * 0.008, H * 0.035);
    // the reading: calm, small, bottom left
    X.font = Math.round(clamp(H * 0.022, 11, 18)) + 'px sans-serif'; X.fillStyle = 'rgba(255,240,215,0.78)';
    X.fillText(T('g.jy.lift.name') + ' · ' + T('g.jy.lift.alt', { m: Math.round(alt).toLocaleString(VR.I18N && VR.I18N.lang === 'en' ? 'en' : 'de') }), W * 0.06, H * 0.955);
    X.restore();
  }
  function overlay(on) {
    let c = doc.getElementById('jyCab');
    if (!on) { if (c) c.style.display = 'none'; return null; }
    if (!c) { c = doc.createElement('canvas'); c.id = 'jyCab'; c.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:40'; (doc.getElementById('game') || doc.body).appendChild(c); }
    const sc = 0.6, w = Math.max(320, Math.round(innerWidth * sc)), h = Math.max(180, Math.round(innerHeight * sc));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    c.style.display = 'block';
    return c;
  }

  // ================================================================ die Himmelsleiter
  const STN = () => VR.Stations;
  JY.liftDest = function () { const S = STN(); if (!S) return null; const H0 = S.handoff ? S.handoff('ring') : null; return Object.assign({ dim: 'stn.ring', id: 'stn.ring' }, H0 ? { at: H0.at, yaw: H0.yaw } : {}); };
  JY.lift = function (g, dest, o) {
    o = o || {};
    if (M.J || !g || !g.player) return false;
    dest = dest || JY.liftDest(); if (!dest) return false;
    if (!o.st && VR.Portal && VR.Portal.check && !VR.Portal.check(g, dest)) return false;
    const p = g.player, base = o.base || [p.pos[0], p.pos[1], p.pos[2]];
    const top = STN() && STN().ringAlt ? STN().ringAlt() : K.LIFT.top;
    const st = o.st || K.start('lift', { from: g.dim, to: dest.dim, top, seed: (g.meta && g.meta.seed) | 0 });
    M.J = { kind: 'lift', g, st, dest, base, tw: worldT(g), t0: now(), shots: 0, rd: null, frames: 0 };
    if (g.gadgets) g.gadgets.riding = { type: 'journey' };
    p.flying = true;
    doc.documentElement.classList.add('pt-on');
    if (g.audio && g.audio.cue) g.audio.cue('wonder');
    save(g, snap(M.J)); ev('lift');
    return true;
  };
  // the journey's own clock: the wall clock (a slow frame does not slow the trip — as the Leuchtpfad's film), capped;
  // nothing while paused (the test's pictures)
  function wallDt(J, dt, cap) {
    const tn = now(), w = J.lastW ? (tn - J.lastW) / 1000 : Math.min(cap, dt || 0); J.lastW = tn;
    return M.paused ? 0 : Math.min(cap, Math.max(0, w));
  }
  function liftGround(J, dt) {
    const g = J.g, p = g.player, st = J.st;
    const keys = g.input && g.input.keys, sp = !!(keys && keys.has && keys.has('Space')), fresh = sp && !M.keyHeld; M.keyHeld = sp;
    if (fresh || M.skipReq) { M.skipReq = false; if (K.skip(st)) ev('skip'); }
    const wall = wallDt(J, dt, 2), a0 = K.at(st).alt;
    const evs = K.step(st, wall, {});
    const a = K.at(st).alt, rate = wall > 0 ? (a - a0) / wall : 0;
    if (p) { p.pos[0] = J.base[0]; p.pos[1] = J.base[1] + a; p.pos[2] = J.base[2]; p.vel[0] = p.vel[1] = p.vel[2] = 0; p.fallStart = null; p.flying = true; }
    const w = g.world;
    if (w) { if (a > 800 && w.renderDist !== 2) { J.rd = J.rd || w.renderDist; w.renderDist = 2; } }
    const c = overlay(true); if (c) cabin(c.getContext('2d'), c.width, c.height, st.t, a, rate);
    for (const e of evs) if (e === 'handoff') toSpace(J);
  }
  function restore(J) {
    const g = J.g, w = g.world;
    if (w && J.rd) { w.renderDist = J.rd; J.rd = null; }
    if (g.gadgets && g.gadgets.riding && g.gadgets.riding.type === 'journey') g.gadgets.riding = null;
    if (g.player) { g.player.flying = false; g.player.fallStart = null; }
    overlay(false);
  }
  function toSpace(J) {
    const g = J.g, p = g.player;
    restore(J);
    if (p) { p.pos[0] = J.base[0]; p.pos[1] = J.base[1]; p.pos[2] = J.base[2]; }   // (the place kept for Herzwelt is the cabin's foot)
    const L = K.LIFT, sl = L.len - L.ground;
    const film = { id: 'lift', len: sl, low: false, from: g.dim, to: J.dest.dim, shots: [{ id: 'up', v: 0, dur: 0.05 }, { id: 'top', v: 0, dur: sl - 0.05 }] };
    J.ph = 'space'; J.tw = worldT(g);
    const P = liftPlayer(J, film);
    const adv = (PJ, wall) => {
      if (PJ.t > (J.lastT || 0) + 1e-6 && PJ.t >= sl - 1e-6) { J.st.t = Math.max(J.st.t, L.len); }   // (the Leuchtpfad's skip)
      for (const e of K.step(J.st, M.paused ? 0 : Math.min(2, wall), { loaded: !!PJ.arrived })) ev('lift ' + e);
      J.lastT = clamp(J.st.t - L.ground, 0, sl);
      return J.lastT - PJ.t;
    };
    const ok = VR.Portal && VR.Portal.go(g, J.dest, { walk: true, player: P, adv, film });
    if (!ok) { end(J, false); return; }
    save(g, snap(J)); ev('handoff');
  }
  function liftPlayer(J, film) {
    const g = J.g, st = J.st, PS = VR.PortalSpace, S = STN(), SS = VR.SpaceScene;
    const pal = palOf('overworld').map(hex);
    return {
      len: film.len, film, gl: false, shotAt: (t) => (t < 0.05 ? 'up' : 'top'),
      draw(X, W, H, t) {
        const a = K.at(st), alt = a.alt, ks = a.ks;
        const PJ = VR.Portal.J(), noGL = !PS || !SS || (PJ && PJ.noGL && !JY.forceGL) || ctxOf(g).potato;
        const eph = PS && PS.eph ? PS.eph(J.tw + ks * 30) : null;
        let view = null, Nn = null, Hc = null, R = 1e5, St = null;
        if (eph && eph.bodies && eph.bodies.herz && S && S.place && SS.BODIES) {
          R = SS.BODIES.herz.R; Hc = eph.bodies.herz.p;
          const P = S.place('ring', J.tw + ks * 30); Nn = norm(perm(P.r)); St = add(Hc, perm(P.r));
          const sun = norm(sub(eph.bodies.helia.p, Hc)), hs = perp(sun, Nn), hd = norm(cross(Nn, hs));
          const dip = Math.acos(R / (R + alt)), fov = 70 * D2R, up0 = -dip + 0.24 * fov, look = ease(clamp((ks - 0.62) / 0.38, 0, 1));
          const pt = up0 + (80 * D2R - up0) * look, fwd = norm(add(mul(hd, Math.cos(pt)), mul(Nn, Math.sin(pt))));
          view = { pos: add(Hc, mul(Nn, R + alt)), fwd, up: perp(Nn, fwd), fov, ref: 'herz', body: 'herz' };
        }
        let drawn = false;
        if (view && !noGL) { drawn = !!PS.renderView(g, view, eph); if (drawn) J.shots++; }
        this.gl = drawn;
        if (drawn) X.clearRect(0, 0, W, H);
        else {
          paintSpace(X, W, H, null);
          // the world below, painted: its disc from the height, the air's limb
          const look = ease(clamp((ks - 0.62) / 0.38, 0, 1)), rr = H * (0.55 + 3.2 * (1 - ks) * (1 - ks)), cy = H * (0.66 + 0.3 * look);
          const gg = X.createRadialGradient(W / 2, cy + rr, rr * 0.2, W / 2, cy + rr, rr);
          gg.addColorStop(0, rgba(pal[1], 1)); gg.addColorStop(0.85, rgba(pal[1].map(v => v * 0.7 | 0), 1)); gg.addColorStop(1, 'rgba(140,190,255,0.9)');
          X.fillStyle = gg; X.beginPath(); X.arc(W / 2, cy + rr, rr, 0, Math.PI * 2); X.fill();
        }
        // the station: a wheel of our own, growing above (projected from its true place)
        if (view && St) {
          const f = view.fwd, u = view.up, r = cross(f, u), rel = sub(St, view.pos), z = dot(rel, f), d = len(rel);
          if (z > 1) {
            const fpx = H / 2 / Math.tan(view.fov / 2), sx = W / 2 + dot(rel, r) / z * fpx, sy = H / 2 - dot(rel, u) / z * fpx;
            const rad = Math.max(2.5, 160 / d * fpx), tilt = Math.max(0.18, Math.abs(dot(norm(rel), Nn)));
            wheel(X, sx, sy, rad, tilt, st.t);
            // the tether up to it
            X.strokeStyle = 'rgba(255,236,190,0.55)'; X.lineWidth = Math.max(1, W * 0.0025); X.beginPath(); X.moveTo(W * 0.83, H * 0.88); X.lineTo(sx, sy + rad * tilt); X.stroke();
          }
        }
        cabin(X, W, H, st.t, alt, 1000);
        if (ks < 0.18) { X.fillStyle = 'rgba(255,240,215,' + (0.8 * (1 - ks / 0.18)).toFixed(2) + ')'; X.font = Math.round(clamp(H * 0.026, 12, 20)) + 'px sans-serif'; X.textAlign = 'center'; X.fillText(T('g.jy.lift.space'), W / 2, H * 0.12); X.textAlign = 'left'; }
      },
    };
  }
  // the Ringstation, painted: the rim with its windows lit, six spokes, the hub, two solar wings, the red beacon
  function wheel(X, x, y, r, tilt, t) {
    X.save(); X.translate(x, y);
    const glow = X.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 1.8); glow.addColorStop(0, 'rgba(255,240,220,0.18)'); glow.addColorStop(1, 'rgba(255,240,220,0)');
    X.fillStyle = glow; X.fillRect(-r * 2, -r * 2, r * 4, r * 4);
    X.scale(1, tilt);
    X.strokeStyle = '#d9dde6'; X.lineWidth = Math.max(1.5, r * 0.14); X.beginPath(); X.arc(0, 0, r, 0, Math.PI * 2); X.stroke();
    X.strokeStyle = 'rgba(255,214,140,0.9)'; X.lineWidth = Math.max(1, r * 0.03); X.setLineDash([Math.max(1, r * 0.05), Math.max(1, r * 0.07)]); X.beginPath(); X.arc(0, 0, r * 1.0, t * 0.05, t * 0.05 + Math.PI * 2); X.stroke(); X.setLineDash([]);
    X.strokeStyle = '#9aa3b2'; X.lineWidth = Math.max(1, r * 0.035);
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + t * 0.05; X.beginPath(); X.moveTo(Math.cos(a) * r * 0.16, Math.sin(a) * r * 0.16); X.lineTo(Math.cos(a) * r * 0.93, Math.sin(a) * r * 0.93); X.stroke(); }
    X.fillStyle = '#eef0f4'; X.beginPath(); X.arc(0, 0, r * 0.17, 0, Math.PI * 2); X.fill();
    X.restore(); X.save(); X.translate(x, y);
    X.fillStyle = '#2b4a8a'; X.strokeStyle = '#8fb0ff'; X.lineWidth = 1;
    for (const s of [-1, 1]) { X.fillRect(s > 0 ? r * 0.2 : -r * 0.75, -r * 0.06, r * 0.55, r * 0.12); X.strokeRect(s > 0 ? r * 0.2 : -r * 0.75, -r * 0.06, r * 0.55, r * 0.12); }
    const u = ((t % 1.6) + 1.6) % 1.6, bl = u < 0.42 ? 1 : 0.15;
    X.fillStyle = 'rgba(255,40,30,' + bl + ')'; X.beginPath(); X.arc(0, -r * 0.32 * tilt - r * 0.1, Math.max(1.5, r * 0.04), 0, Math.PI * 2); X.fill();
    X.restore();
  }

  // ================================================================ die Lichtbrücken
  JY.bridge = function (g, dest, o) {
    o = o || {};
    if (M.J || !g || !dest || !VR.Portal) return false;
    const st = o.st || K.start('bridge', { from: g.dim, to: dest.dim, seed: (g.meta && g.meta.seed) | 0 });
    const B = K.BRIDGE, film = { id: 'bridge', len: B.len, low: false, from: g.dim, to: dest.dim, shots: [{ id: 'step', v: 0, dur: B.depart }, { id: 'walk', v: 0, dur: B.len - B.depart }] };
    const J = M.J = { kind: 'bridge', g, st, dest, tw: worldT(g), t0: now(), shots: 0, from: g.dim, lastT: st.s };
    const P = bridgePlayer(J, film);
    const adv = (PJ, wall) => {
      if (PJ.t > J.lastT + 1e-6) { st.s = Math.max(st.s, PJ.t); if (st.ph === 'board') st.ph = 'way'; }   // (the Leuchtpfad's skip)
      const ks = g.input && g.input.keys, has = (c) => !!(ks && ks.has && ks.has(c));
      J.fwd = has('KeyW') || has('ArrowUp'); J.back = has('KeyS') || has('ArrowDown');
      for (const e of K.step(st, M.paused ? 0 : Math.min(2, wall), { fwd: J.fwd, back: J.back, loaded: !!PJ.arrived })) ev('bridge ' + e);
      J.lastT = st.s;
      return st.s - PJ.t;
    };
    const r = VR.Portal.go(g, dest, { walk: true, player: P, adv, film });
    if (!r) { M.J = null; return false; }
    if (o.st && o.st.s > 0) { const PJ = VR.Portal.J(); if (PJ) PJ.t = o.st.s; }
    save(g, snap(J)); ev('bridge ' + dest.dim);
    return r;
  };
  // the camera's way: from just over the world you leave toward the one you go to (its distance shrinking exponentially:
  // it swells smoothly), the destination a little above the path's end; between two places of one world an arc over it
  function bridgeView(J, k, eph) {
    const PS = VR.PortalSpace, SS = VR.SpaceScene; if (!PS || !SS || !eph || !eph.bodies) return null;
    const fb = PS.bodyOf(J.from), tb = PS.bodyOf(J.dest.dim);
    if (!fb || !tb || !eph.bodies[fb] || !eph.bodies[tb]) return null;
    if (fb === tb) return PS.pose('curve', 0.12 + 0.55 * Math.sin(Math.PI * clamp(k, 0, 1)), 1, fb, eph);
    const A = eph.bodies[fb].p, Bp = eph.bodies[tb].p, RA = SS.BODIES[fb].R, RB = SS.BODIES[tb].R;
    const dir = norm(sub(Bp, A)), s0 = add(A, mul(dir, RA * 1.3)), D0 = len(sub(Bp, s0)), D1 = RB * 2.6;
    const D = D0 * Math.pow(D1 / D0, ease(clamp(k, 0, 1))), up0 = perp(eph.bodies[tb].axis || [0, 1, 0], dir);
    const pos = sub(Bp, mul(dir, D)), fwd = norm(sub(dir, mul(up0, 0.16)));
    return { pos, fwd, up: perp(up0, fwd), fov: 62 * D2R, ref: tb, body: null };
  }
  function bridgePlayer(J, film) {
    const g = J.g, st = J.st, PS = VR.PortalSpace, pal = palOf(J.dest.dim).map(hex), deep = pal[2];
    const sparks = []; for (let i = 0; i < 46; i++) sparks.push([(i * 7.31) % 1, (i * 0.618) % 1, (i * 3.7) % 1]);
    return {
      len: film.len, film, gl: false, shotAt: (t) => (t < K.BRIDGE.depart ? 'step' : 'walk'),
      draw(X, W, H, t) {
        const k = clamp(t / film.len, 0, 1), PJ = VR.Portal.J(), noGL = !PS || (PJ && PJ.noGL && !JY.forceGL) || ctxOf(g).potato;
        let drawn = false;
        if (!noGL && PS.eph && PS.renderView) { const eph = PS.eph(J.tw + k * 30), v = bridgeView(J, k, eph); if (v) { drawn = !!PS.renderView(g, v, eph); if (drawn) J.shots++; } }
        this.gl = drawn;
        if (drawn) X.clearRect(0, 0, W, H); else { paintSpace(X, W, H, deep); const r0 = H * (0.03 + 0.5 * Math.pow(k, 3)); const gg = X.createRadialGradient(W / 2, H * 0.36, r0 * 0.1, W / 2, H * 0.36, r0); gg.addColorStop(0, rgba(pal[0], 1)); gg.addColorStop(0.8, rgba(pal[1], 1)); gg.addColorStop(1, rgba(pal[1], 0)); X.fillStyle = gg; X.beginPath(); X.arc(W / 2, H * 0.36, r0, 0, Math.PI * 2); X.fill(); }
        path(X, W, H, t, k, pal, sparks, J.fwd);
      },
    };
  }
  // the shining path: light tiles in perspective toward the vanishing point, its rails, sparks rising, the gate at the end
  function path(X, W, H, s, k, pal, sparks, walking) {
    const B = K.BRIDGE, rem = Math.max(0.01, B.len - s), f = H * 0.95, eye = 1.6, hw = 1.25;
    const bob = walking ? Math.sin(s * 2.4) * H * 0.004 : 0, vx = W / 2, vy = H * 0.56 + bob;
    const P = (z, x, y) => [vx + x / z * f, vy + (eye - y) / z * f];
    const L = [Math.round(pal[0][0] * 0.4 + 150 * 0.6), Math.round(pal[0][1] * 0.4 + 225 * 0.6), Math.round(pal[0][2] * 0.4 + 255 * 0.6)], Lm = pal[1];   // (the light's own glow: a cool shine tinted by the destination)
    X.save();
    X.globalCompositeOperation = 'lighter';
    // the tiles, far to near (1.6 m long, 0.25 m apart, sliding toward you as you walk)
    const tl = 1.85, ph = s % tl, zMax = Math.min(rem, 80);
    for (let z = zMax - ((zMax + ph) % tl); z > 0.55; z -= tl) {
      const z0 = Math.max(0.55, z - 1.6), a = clamp(1.2 - z / 70, 0.12, 0.9);
      const p0 = P(z, -hw, 0), p1 = P(z, hw, 0), p2 = P(z0, hw, 0), p3 = P(z0, -hw, 0);
      const tg = X.createLinearGradient(p3[0], p3[1], p0[0], p0[1]); tg.addColorStop(0, rgba(L, a * 0.75)); tg.addColorStop(1, rgba(L, a * 0.3));
      X.fillStyle = tg; X.beginPath(); X.moveTo(p0[0], p0[1]); X.lineTo(p1[0], p1[1]); X.lineTo(p2[0], p2[1]); X.lineTo(p3[0], p3[1]); X.fill();
      X.strokeStyle = rgba([255, 250, 235], a * 0.8); X.lineWidth = 1; X.beginPath(); X.moveTo(p3[0], p3[1]); X.lineTo(p2[0], p2[1]); X.stroke();
    }
    // the rails
    for (const sd of [-1, 1]) { const a = P(zMax, sd * hw * 1.05, 0.05), b = P(0.6, sd * hw * 1.05, 0.05); const gr = X.createLinearGradient(a[0], a[1], b[0], b[1]); gr.addColorStop(0, rgba(Lm, 0.15)); gr.addColorStop(1, rgba(L, 0.95)); X.strokeStyle = gr; X.lineWidth = Math.max(1.5, H * 0.006); X.beginPath(); X.moveTo(a[0], a[1]); X.lineTo(b[0], b[1]); X.stroke(); }
    // the sparks rising beside the path
    for (const q of sparks) {
      const z = 1 + ((q[0] * 60 - s) % 60 + 60) % 60; if (z > zMax) continue;
      const side = q[1] < 0.5 ? -1 : 1, y = ((q[2] + s * 0.01) % 1) * 2.4, p = P(z, side * hw * (1.2 + q[2] * 0.6), y), rr = Math.min(H * 0.006, Math.max(0.8, 0.05 / z * f));
      X.fillStyle = rgba(L, clamp(0.9 - z / 60, 0.1, 0.9)); X.beginPath(); X.arc(p[0], p[1], rr, 0, Math.PI * 2); X.fill();
    }
    // the gate at the path's end: a ring of the destination's light, its glow filling the view as you come near
    if (rem < 80) {
      const gp = P(rem, 0, 2.0), gr = 2.0 / rem * f, a = clamp(1.1 - rem / 80, 0.15, 1);
      const gl = X.createRadialGradient(gp[0], gp[1], gr * 0.1, gp[0], gp[1], gr * 1.6); gl.addColorStop(0, rgba(L, 0.75 * a)); gl.addColorStop(0.6, rgba(Lm, 0.35 * a)); gl.addColorStop(1, rgba(Lm, 0));
      X.fillStyle = gl; X.beginPath(); X.arc(gp[0], gp[1], gr * 1.6, 0, Math.PI * 2); X.fill();
      X.strokeStyle = rgba(L, a); X.lineWidth = Math.max(1.5, gr * 0.09); X.beginPath(); X.arc(gp[0], gp[1], gr, 0, Math.PI * 2); X.stroke();
    }
    X.restore();
    if (rem < 7) { X.fillStyle = rgba(L, clamp((7 - rem) / 7, 0, 1) * 0.85); X.fillRect(0, 0, W, H); }
    if (s < 30 && s > 0) { X.fillStyle = 'rgba(255,246,228,' + (0.75 * clamp(1 - s / 30, 0, 1)).toFixed(2) + ')'; X.font = Math.round(clamp(H * 0.024, 11, 18)) + 'px sans-serif'; X.textAlign = 'center'; X.fillText(T('g.jy.bridge.walk'), W / 2, H * 0.93); X.textAlign = 'left'; }
  }

  // ================================================================ die Karawanen
  const CART_O = { scale: 1.35 };
  function placesOf(g) { const D = g.wanderer; if (D && D._key !== (g.meta && g.meta.id) + ':' + g.dim) return [];   // (the last world's director: its places are not here)
    return D && D.places ? D.places.filter(P => P.kind === 'village' || P.kind === 'city' || P.kind === 'temple' || P.kind === 'landmark' || P.kind === 'farm' || P.kind === 'landing') : []; }
  function groundAt(g, x, z, y0) {
    const D = g.wanderer; if (D && D.ground) { const y = D.ground(x, z, y0); if (y !== null) return y; }
    const w = g.world; if (w && w.topAt) { const t = w.topAt(Math.floor(x), Math.floor(z)); if (t > 0) return t + 1; }
    return null;
  }
  // a cart stands at each place near (within 90 m), on the ground at the place's edge toward its middle
  function refreshCarts(g) {
    const p = g.player; if (!p) return;
    if (M.cartDim !== g.dim) { M.cartDim = g.dim; M.carts = []; M.offer = null; }   // (a new world: none of the last one's carts)
    const out = [];
    for (const P of placesOf(g)) {
      const d = Math.hypot(P.x - p.pos[0], P.z - p.pos[2]); if (d > 90 + (P.rad || 30)) continue;
      let c = M.carts.find(q => q.id === P.id);
      if (!c) {
        const a = ((P.id.length * 2.399) + (P.x * 0.01)) % (Math.PI * 2), r0 = Math.min(26, (P.rad || 30) * 0.45);
        c = { id: P.id, place: P, x: P.x + Math.cos(a) * r0, z: P.z + Math.sin(a) * r0, y: null, yaw: Math.atan2(-Math.cos(a), -Math.sin(a)), F: null };
      }
      if (c.y === null) c.y = groundAt(g, c.x, c.z, p.pos[1] + 10);
      if (c.y !== null) out.push(c);
    }
    M.carts = out;
  }
  function driver(seed, pos) { const LK = VR.LifeKit; return { look: LK && LK.folk ? LK.folk(seed >>> 0, 'farmer', 'adult') : null, pos: pos.slice(), yaw: 0, state: 'idle', walk: 0, walkAmt: 0, seed: (seed % 97) / 97 }; }
  JY.ride = function (g, cart, o) {
    o = o || {};
    if (M.J || !g || !g.player) return false;
    if (K.ok(ctxOf(g), 'ride') === 'busy') return false;
    let st = o.st, place = o.place;
    if (!st) {
      cart = cart || M.offer; if (!cart) return false;
      const B = VR.Wander && VR.Wander.book ? VR.Wander.book(g.meta) : null;
      const dst = K.pickRide(placesOf(g).filter(P => P.id !== cart.id), [cart.x, cart.z], B ? B.places : {}); if (!dst) return false;
      const dx = dst.x - cart.x, dz = dst.z - cart.z, D = Math.hypot(dx, dz) || 1, edge = Math.min(30, (dst.rad || 30) * 0.6);
      const path = K.ridePath([cart.x, cart.z], [dst.x - dx / D * edge, dst.z - dz / D * edge], ((g.meta && g.meta.seed) | 0) ^ (cart.id.length * 977));
      st = K.start('ride', { from: g.dim, to: dst.id, path, seed: (now() | 0), name: dst.name });
      place = { id: dst.id, name: dst.name };
    }
    const p = g.player, P0 = K.rideAt(st.path, st.s, {});
    const y0 = o.y !== undefined ? o.y : (cart && cart.y !== null ? cart.y : p.pos[1]);
    M.J = { kind: 'ride', g, st, place, y: y0, ty: y0, yT: 0, at: P0, F: driver(st.seed ^ 0x51, [P0.x, y0, P0.z]), t0: now(), lines: 0, moments: 0, slowK: 0 };
    if (g.gadgets) g.gadgets.riding = { type: 'journey' };
    p.flying = false;
    note(g, T('g.jy.ride.board', { place: st.name || place.name || '' }), 5000);
    save(g, snap(M.J)); ev('ride ' + st.to + ' ' + Math.round(st.len) + 'm');
    return true;
  };
  function rideTick(J, dt) {
    const g = J.g, p = g.player, st = J.st;
    const ks = g.input && g.input.keys, sh = !!(ks && ks.has && (ks.has('ShiftLeft') || ks.has('ShiftRight')));
    if ((sh && st.t > 1) || M.skipReq) { M.skipReq = false; K.skip(st); }
    // slower where the land ahead is not built yet, or a moment is near (the driver lets you look)
    const ah = K.rideAt(st.path, st.s + 24, {}), gy = groundAt(g, ah.x, ah.z, J.y + 8), D = g.wanderer;
    let near = false; if (D && D.ms) for (const m of D.ms) if (m.pos && Math.hypot(m.pos[0] - J.at.x, m.pos[2] - J.at.z) < 30) near = true;
    const evs = K.step(st, wallDt(J, dt, 1), { slow: gy === null || near });
    J.at = K.rideAt(st.path, st.s, J.at);
    if ((J.yT -= dt) <= 0) { J.yT = 0.2; const y = groundAt(g, J.at.x, J.at.z, J.y - 2); if (y !== null) J.ty = y; }   // (from just under the cart: never up onto a tree's crown)
    J.y += clamp(J.ty - J.y, -4 * dt, 4 * dt);
    const fx = -Math.sin(J.at.yaw), fz = -Math.cos(J.at.yaw), bobY = Math.sin(st.t * 2.1) * 0.05;
    if (p && st.ph !== 'done') { p.pos[0] = J.at.x - fx * 0.55; p.pos[1] = J.y + 0.75 + bobY; p.pos[2] = J.at.z - fz * 0.55; p.vel[0] = p.vel[1] = p.vel[2] = 0; p.fallStart = null; p.onGround = true; }
    const F = J.F; F.pos[0] = J.at.x + fx * 1.15; F.pos[1] = J.y + 0.55 + bobY; F.pos[2] = J.at.z + fz * 1.15; F.yaw = J.at.yaw;
    for (const e of evs) {
      ev('ride ' + e);
      if (e.indexOf('line:') === 0) { J.lines++; note(g, T('g.jy.ride.who') + ': „' + T(e.slice(5)) + '"', 6000); if (g.audio && g.audio.cue) g.audio.cue('funke'); save(g, snap(J)); }
      else if (e === 'moment') { J.moments++; askMoment(g, 1); }
      else if (e === 'arrive') note(g, T('g.jy.ride.arrive', { place: st.name || '' }), 5000);
      else if (e === 'done') {
        restore(J);
        if (p) { const sx = J.at.x + fz * 1.6, sz = J.at.z - fx * 1.6, sy = groundAt(g, sx, sz, J.y + 3); if (p.safeTeleport) p.safeTeleport(sx, sy !== null ? sy : J.y + 1, sz); }
        if (st.off) note(g, T('g.jy.ride.off'), 2500);
        end(J, !st.off);
      }
    }
  }
  // the Wanderregisseur: a moment soon (on the way, on the arrival)
  function askMoment(g, delay) {
    const D = g.wanderer; if (!D) return false;
    M.momentN = (M.momentN || 0) + 1;
    D.retry = { k: 700000 + M.momentN, until: D.time + delay + 14, nextT: D.time + delay };
    return true;
  }
  JY.alive = function (g) {
    M.alive = { g, t0: now(), n0: g.wanderer ? g.wanderer.timeline.length : 0, dim: g.dim, at: null, kind: null };
    setTimeout(() => { if (M.alive && M.alive.g === g) { if (!g.wanderer || g.wanderer._key !== (g.meta && g.meta.id) + ':' + g.dim) M.alive.n0 = 0; askMoment(g, 0); } }, 3000);
  };

  // ================================================================ the cabin at the Bergstation (a model of our own)
  const VM = VR.VOXMODELS, Grid = VR.VoxGrid;
  if (VM && Grid) {
    const part = (sx, sy, sz, pv, fn) => { const gr = new Grid(sx, sy, sz, pv[0], pv[1], pv[2]); fn(gr); return { grid: gr, pivot: [0, 0, 0] }; };
    // the cabin (1 voxel = 1/8 m): 2.5 m round-cornered glass box on a brass ring, a glowing floor, a domed roof cap
    VM.jy_cabin = () => ({ unit: 8, radius: 2.4, parts: { cab: part(20, 26, 20, [10, 0, 10], (gr) => {
      for (let y = 0; y < 26; y++) for (let z = 0; z < 20; z++) for (let x = 0; x < 20; x++) {
        const dx = x - 9.5, dz = z - 9.5, d = Math.hypot(dx, dz);
        if (y <= 1 && d < 10) gr.set(x, y, z, y === 0 ? 0x6a4c22 : 0x7fe8ff, y === 1 && d < 7 ? 1 : 0);
        else if (y >= 23 && d < 10 - (y - 23) * 2) gr.set(x, y, z, y === 23 ? 0xd8b46a : 0xeef0f4, 0);
        else if (y > 1 && y < 23 && d > 8.6 && d < 10) { const post = Math.abs(Math.round(Math.atan2(dz, dx) / (Math.PI / 4)) * (Math.PI / 4) - Math.atan2(dz, dx)) < 0.09; if (post || y === 12) gr.set(x, y, z, 0xd8b46a, 0); else if ((x + y + z) % 7 === 0) gr.set(x, y, z, 0xbfe8ff, 1); }
      }
    }) }, layout: { cab: [0, 0, 0] } });
    // the tether (1 voxel = 1/4 m): a slim pale gold line 160 m up, a marker light every 8 m
    VM.jy_tether = () => ({ unit: 4, radius: 80, parts: { line: part(1, 640, 1, [0, 0, 0], (gr) => { for (let y = 0; y < 640; y++) gr.set(0, y, 0, y % 32 < 2 ? 0xffc870 : 0xfff0c8, 1); }) }, layout: { line: [0, 0, 0] } });
  }
  function baseOf(g) {
    const L = VR.Land; if (g.dim !== 'overworld' || !L || !L.SITES || (g.meta && g.meta.type === 'flat')) return null;
    if (M.base && M.base.key === (g.meta && g.meta.id)) return M.base.y === null ? null : M.base;
    const s = L.SITES.find(q => q[0] === 'station'); if (!s) return null;
    const b = { key: g.meta && g.meta.id, x: s[1] + 0.5, z: s[2] + 0.5, y: null };
    const p = g.player; if (!p || Math.hypot(b.x - p.pos[0], b.z - p.pos[2]) > 120) return null;
    b.y = groundAt(g, b.x, b.z, p.pos[1] + 30); if (b.y === null) return null;
    M.base = b; return b;
  }

  // ================================================================ the game's hooks
  Object.assign(JY, { stats() {
    const J = M.J, a = J ? K.at(J.st) : null, PJ = VR.Portal && VR.Portal.J ? VR.Portal.J() : null;
    return { kind: J ? J.kind : null, ph: J ? J.st.ph : null, t: J ? +J.st.t.toFixed(2) : 0, s: J ? +J.st.s.toFixed(1) : 0, alt: a ? Math.round(a.alt) : 0, k: a ? +a.k.toFixed(3) : 0, shots: J ? J.shots || 0 : 0, portal: PJ ? { t: +PJ.t.toFixed(2), phase: PJ.phase, went: PJ.went, arrived: PJ.arrived, noGL: !!PJ.noGL } : null, lines: J ? J.lines || 0 : 0, carts: M.carts.length, offer: M.offer ? M.offer.id : null, alive: M.alive ? { at: M.alive.at, kind: M.alive.kind } : null, log: M.log.slice(-12), saved: !!(VR.game && VR.game.meta && VR.game.meta.journey), cost: M.cost || 0 };
  } });
  JY.carts = () => M.carts.map(c => ({ id: c.id, x: c.x, y: c.y, z: c.z, name: c.place.name }));
  JY.pause = (on) => { M.paused = !!on; };
  JY.skip = () => { M.skipReq = true; };
  // the test's reload: the running ride let go as a closed page would, then resumed from meta.journey
  JY.reload = function (g) { const J = M.J; if (!J || J.kind !== 'ride') return false; save(g, snap(J)); restore(J); M.J = null; M.resumed = {}; resume(g); return !!M.J; };
  JY.offerFor = function (g) {
    const p = g.player; if (!p || M.J) return null;
    let best = null, bd = 4.2;
    for (const c of M.carts) { const d = Math.hypot(c.x - p.pos[0], c.z - p.pos[2]); if (d < bd && Math.abs(c.y - p.pos[1]) < 3) { bd = d; best = c; } }
    return best;
  };
  // the idle look: carts near, an offer when you stand by one, the Bergstation's cabin (no allocation but every 0.25 s)
  function idle(g, dt) {
    if ((M.cartT -= dt) > 0) return;
    M.cartT = 0.25;
    const t0 = now();
    if (g.state !== 'play' || !g.player || (g.ui && g.ui.screen)) { M.offer = null; return; }
    refreshCarts(g);
    const c = JY.offerFor(g);
    if (c && c !== M.offer) {
      const B = VR.Wander && VR.Wander.book ? VR.Wander.book(g.meta) : null, dst = K.pickRide(placesOf(g).filter(P => P.id !== c.id), [c.x, c.z], B ? B.places : {});
      if (dst) note(g, T('g.jy.ride.offer', { place: dst.name, d: Math.round(Math.hypot(dst.x - c.x, dst.z - c.z) / 10) * 10 }), 5000); else c.none = true;
    }
    M.offer = c && !c.none ? c : null;
    // the Himmelsleiter's foot: stand in the cabin 1.5 s
    const b = baseOf(g), p = g.player;
    if (b) {
      const d = Math.hypot(b.x - p.pos[0], b.z - p.pos[2]);
      if (d < 22 && !M.baseHint) { M.baseHint = true; note(g, T('g.jy.lift.cabin'), 5000); }
      if (d > 40) M.baseHint = false;
      if (d < 1.6 && Math.abs(p.pos[1] - b.y) < 2.5) { M.baseT = (M.baseT || 0) + 0.25; if (M.baseT >= 1.5) { M.baseT = -6; const dest = JY.liftDest(); if (dest) { if (K.mode(ctxOf(g)) === 'film') VR.Portal.go(g, dest); else JY.lift(g, dest, { base: [b.x, b.y, b.z] }); } } }
      else if (M.baseT > 0) M.baseT = 0; else if (M.baseT < 0) M.baseT = Math.min(0, M.baseT + 0.25);
    }
    M.cost = M.cost * 0.9 + (now() - t0) * 0.1;
  }
  function end(J, arrived) {
    if (M.J !== J) return;
    restore(J);
    doc.documentElement.classList.remove('pt-on');
    M.J = null;
    save(J.g, null);
    ev('end ' + J.kind + (arrived ? ' arrived' : ''));
    if (arrived) JY.alive(J.g);
  }
  function resume(g) {
    const key = (g.meta && g.meta.id) + ':' + g.dim; if (M.resumed[key]) return; M.resumed[key] = true;
    const rec = g.meta && g.meta.journey; if (!rec) return;
    const R = K.resume(rec, g.dim);
    ev('resume ' + (R ? R.act : 'none'));
    if (!R) { save(g, null); return; }
    if (R.act === 'arrived') { save(g, null); JY.alive(g); return; }
    if (R.act === 'ride') { JY.ride(g, null, { st: R.st, place: rec.place || { id: R.st.to, name: R.st.name } }); return; }
    if (R.st.kind === 'lift' && Array.isArray(rec.base)) { JY.lift(g, Object.assign(JY.liftDest() || {}, rec.dest || {}), { st: R.st, base: rec.base }); return; }
    if (R.st.kind === 'bridge' && rec.dest && rec.dest.dim) { JY.bridge(g, { dim: rec.dest.dim, at: rec.dest.at || undefined }, { st: R.st }); return; }
    save(g, null);
  }
  const origPlay = VR.Game.prototype.playFrame;
  VR.Game.prototype.playFrame = function (dt) {
    try {
      const J = M.J;
      if (J && J.g === this) {
        if (J.kind === 'lift' && J.ph !== 'space') liftGround(J, dt);
        else if (J.kind === 'ride') rideTick(J, dt);
        else if ((J.kind === 'bridge' || J.kind === 'lift') && !(VR.Portal && VR.Portal.J && VR.Portal.J())) end(J, J.st.ph === 'arrive' || J.st.ph === 'done' || J.g.dim === J.dest.dim);
        if (M.J && (M.saveT -= dt) <= 0) { M.saveT = 10; save(this, snap(M.J)); }
      } else if (!J && this.state === 'play') {
        if (this.meta && this.meta.journey && !(VR.Portal && VR.Portal.J && VR.Portal.J())) resume(this);
        idle(this, dt);
      }
      const A = M.alive;
      if (A && A.g === this && A.at === null) {
        const D = this.wanderer, n = D ? D.timeline.length : 0;
        if (D && n > A.n0) { A.at = +((now() - A.t0) / 1000).toFixed(1); A.kind = D.timeline[n - 1].kind; ev('alive ' + A.kind + ' ' + A.at + 's'); }
        else if (now() - A.t0 > 60000) A.at = -1;
      }
    } catch (e) { if (!M.warned) { M.warned = true; console.warn('journey', e); } }
    return origPlay.call(this, dt);
  };
  // the far plane in the cabin: the land seen from up there
  const origFar = VR.Game.prototype.farFor;
  VR.Game.prototype.farFor = function (w, extra) {
    const f = origFar.call(this, w, extra), J = M.J;
    if (!J || J.kind !== 'lift' || J.ph === 'space') return f;
    const alt = K.at(J.st).alt, A = VR.Ascent, hz = A && A.view ? A.view.hzR || 0 : 0;
    return alt > 200 ? Math.max(f, Math.hypot(hz + 600, alt) + 300) : f;
  };
  // the Leuchtpfad: the Ringstation from Herzwelt is the Himmelsleiter, every other world a Lichtbrücke (Low and up)
  if (VR.Portal) VR.Portal.route = function (g, dest, o) {
    void o;
    if (!dest || K.mode(ctxOf(g)) === 'film' || dest.dim === g.dim || M.J) return null;
    if (K.ok(ctxOf(g), 'bridge')) return null;
    if (g.dim === 'overworld' && dest.dim === 'stn.ring' && STN()) return JY.lift(g, Object.assign(JY.liftDest() || {}, dest)) ? { id: 'lift' } : null;
    return JY.bridge(g, dest) || null;
  };
  // [V] by a cart: climb on (before the game's own V: a ferry's dock, a seat)
  window.addEventListener('keydown', (e) => {
    const g = VR.game; if (!g || g.state !== 'play' || (g.ui && (g.ui.screen || g.ui.typing))) return;
    if (e.code === 'KeyV' && M.offer && !M.J) { e.preventDefault(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); JY.ride(g, M.offer); }
    else if (e.code === 'Space' && M.J && M.J.kind === 'lift' && M.J.ph !== 'space' && !e.repeat) { M.skipReq = true; }
  }, true);
  // the carts, their drivers, the cabin at the Bergstation — drawn with the life director's opaque layer
  const LD = VR.LifeDirector, LK = VR.LifeKit;
  if (LD && LD.Actor && LK && !LD.Actor.prototype.__journey) {
    const AP = LD.Actor.prototype; AP.__journey = true;
    const dr = AP.draw;
    AP.draw = function (r, E, layer, cam) {
      const out = dr.apply(this, arguments);
      try {
        const g = this.g, ent = g.entities; if (layer !== 'opaque' || !ent) return out;
        cam = cam || r.cam;
        let p = null; const prog = () => p || (p = ent.beginVox(r, E));
        const J = M.J;
        if (J && J.kind === 'ride' && J.g === g) { LK.drawModel(g, r, prog(), 'life_cart', [J.at.x, J.y + 0.1 + Math.sin(J.st.t * 2.1) * 0.05, J.at.z], J.at.yaw, cam, CART_O); LK.drawFolk(g, r, prog(), J.F, cam, g.time || 0); }
        for (const c of M.carts) {
          if (J && J.kind === 'ride' && J.st.t < 4 && Math.hypot(c.x - J.at.x, c.z - J.at.z) < 3) continue;
          LK.drawModel(g, r, prog(), 'life_cart', [c.x, c.y + 0.1, c.z], c.yaw, cam, CART_O);
          if (!c.F) c.F = driver(c.id.length * 131 + Math.round(c.x), [c.x + Math.sin(c.yaw) * 2.2, c.y, c.z + Math.cos(c.yaw) * 2.2]);
          c.F.yaw = c.yaw + Math.PI; LK.drawFolk(g, r, prog(), c.F, cam, g.time || 0);
        }
        const b = M.base && g.dim === 'overworld' && M.base.y !== null ? M.base : null;
        if (b && !(J && J.kind === 'lift')) { LK.drawModel(g, r, prog(), 'jy_cabin', [b.x, b.y, b.z], 0, cam, {}); LK.drawModel(g, r, prog(), 'jy_tether', [b.x + 1.5, b.y, b.z], 0, cam, {}); }
      } catch (e) { if (!M.warnD) { M.warnD = true; console.warn('journey draw', e); } }
      return out;
    };
  }
  // the idle cost (the test): n looks, ms each
  JY.cost = (g, n) => { const t0 = now(); for (let i = 0; i < n; i++) { M.cartT = 0; idle(g, 0.016); } return (now() - t0) / n; };
})(VR);
