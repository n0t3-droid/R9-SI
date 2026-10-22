// ============================================================================
// Das Ereignis-Logbuch (e-log; docs/superpowers/specs/2026-10-22-erlebnis-design.md §7, abenteuer §10; plan
// docs/superpowers/plans/2026-10-22-e-log.md §2): the instrument of „nie langweilig". What happens in the world is
// written into a ring of 4,096 records — {n, t, kind, sub, w, x, y, z, src, inView, frac} — by one marked line in each
// source (the life director's acts, the pads' landings, the sky traffic's nearest passes, the wow moments, the codex,
// the festival); once a second a sample says what the player saw and did — {t, movers, mv, landmark, sky, input, x, z,
// place, tod}. The session metrics (src/shared/sessionstats.js) and the scripted sessions (test/session.mjs) read it;
// so will the Regie (wave 5) and the highlight reel (wave 6).
//   t: the play clock (g.time, seconds, monotonic; the world's hour is in every sample's tod). kind: ambient · wow ·
//   discovery · encounter · story · social · sky · space · travel · build · milestone. w: 1 ambient · 2 noticeable ·
//   3 remarkable · 4 major · 5 peak (A§10). inView: inside the camera's frustum and a clear line over the height map
//   (the columns' sun-blocking runs, world.js shadowCol — the arrays renderer.updateHmap uploads): a hill or a roof
//   hides, a canopy's shade does not. frac: the share of the screen it covers. pos null: on the screen by itself (a
//   wow moment takes the camera: frac 1; a toast: frac 0).
//   The sample: movers — moving actors in view (villagers, animals, the sky traffic, the pads' craft, trams, the life
//   director's acts), counted to 9, mv per class (v a s c t l); landmark — the id of the most prominent known landmark
//   in view within 3 km (the Heartland's, and any a test or the game adds to EventLog.landmarks); sky — a sky act in
//   view (meteor, skyray, fireworks), the ringed giant or the blue planet in view, or the low sun (−12° … 10°) with open
//   sky over the eye; input — the most active class of the second: build (the Bauhand, breaking, a mouse button) >
//   micro (a movement key, a stick) > intent (the autopilot, the trailer director, VR.Intent) > idle (watching; turning
//   the view only counts as watching, and so does a wow moment).
//   Observed without a hook: a Baustelle site rising (build/site, 2) and standing (build/site_done, 3), read at 1 Hz.
// Read-only API: count, events(sinceN), samples(sinceT), last(minW, inViewOnly), sinceSeen(minW), dump(), inView(pos, r),
// cost; reset(world), bind(g). Switches: EventLog.on, EventLog.sampling. Cost tier 🟢 (the same on every preset): no
// allocation in a frame — the records and samples are preallocated —, the 1-Hz sample bounded (≤ 9 movers, ≤ 24 lines
// of sight); measured by itself (cost: frames, ms, worst, samples, sampleMs, emits, emitMs).
// ============================================================================
(function (VR) {
  'use strict';
  const L = VR.EventLog = VR.EventLog || {};
  const N = 4096, NS = 3600, DEG = Math.PI / 180;
  L.N = N; L.NS = NS;
  L.on = L.on !== false; L.sampling = L.sampling !== false;
  L.KINDS = ['ambient', 'wow', 'discovery', 'encounter', 'story', 'social', 'sky', 'space', 'travel', 'build', 'milestone'];
  const INPUTS = ['idle', 'intent', 'micro', 'build'];
  const REC = [], SMP = [];
  for (let i = 0; i < N; i++) REC.push({ n: 0, t: 0, kind: '', sub: '', w: 0, x: 0, y: 0, z: 0, src: '', inView: false, frac: 0 });
  for (let i = 0; i < NS; i++) SMP.push({ t: 0, movers: 0, mv: '', landmark: '', sky: '', input: 'idle', x: 0, z: 0, place: '', tod: 0 });
  const lastSeen = [0, -Infinity, -Infinity, -Infinity, -Infinity, -Infinity];
  let acc = 0, inMax = 0, siteSeen = new WeakMap();
  L.count = 0; L.nSamples = 0; L.g = null; L.world = undefined; L.landmarks = null;
  L.cost = { frames: 0, ms: 0, worst: 0, samples: 0, sampleMs: 0, emits: 0, emitMs: 0 };
  const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
  const game = () => L.g || VR.game || null;
  L.bind = (g) => { L.g = g || null; };
  L.reset = function (world) {
    L.count = 0; L.nSamples = 0; L.world = world; acc = 0; inMax = 0; siteSeen = new WeakMap();
    for (let i = 1; i < lastSeen.length; i++) lastSeen[i] = -Infinity;
  };
  const ready = (g) => { if (!L.on || !g || g.state !== 'play') return false; if (g.world !== L.world) L.reset(g.world); return true; };

  // ---------------------------------------------------------------- the camera, the frustum, the line of sight
  const CB = { ok: false, ex: 0, ey: 0, ez: 0, fx: 0, fy: 0, fz: -1, rx: 1, rz: 0, ux: 0, uy: 1, uz: 0, tx: 1, ty: 1, kx: 1, ky: 1, far: 3000 };
  function basis(g) {
    const c = g && g.cam; if (!c || !Number.isFinite(c.x)) { CB.ok = false; return CB; }
    const cy = Math.cos(c.yaw || 0), sy = Math.sin(c.yaw || 0), cp = Math.cos(c.pitch || 0), sp = Math.sin(c.pitch || 0);
    CB.ex = c.x; CB.ey = c.y; CB.ez = c.z;
    CB.fx = -sy * cp; CB.fy = sp; CB.fz = -cy * cp;          // the renderer's forward (setupCamera)
    CB.rx = cy; CB.rz = -sy;                                  // its right (no roll)
    CB.ux = -CB.rz * CB.fy; CB.uy = CB.rz * CB.fx - CB.rx * CB.fz; CB.uz = CB.rx * CB.fy;   // right × forward
    const r = g.renderer, asp = r && r.W > 0 && r.H > 0 ? r.W / r.H : 16 / 9;
    CB.ty = Math.tan((c.fov || 75 * DEG) / 2); CB.tx = CB.ty * asp;
    CB.kx = Math.sqrt(1 + CB.tx * CB.tx); CB.ky = Math.sqrt(1 + CB.ty * CB.ty);
    CB.ok = true;
    return CB;
  }
  // a sphere (x, y, z, rad) inside the frustum (its four side planes; no far plane short of 3 km)
  function inFrustum(B, x, y, z, rad) {
    const dx = x - B.ex, dy = y - B.ey, dz = z - B.ez;
    const zc = dx * B.fx + dy * B.fy + dz * B.fz;
    if (zc < -rad || zc > B.far + rad) return false;
    const xc = dx * B.rx + dz * B.rz, yc = dx * B.ux + dy * B.uy + dz * B.uz;
    return Math.abs(xc) <= zc * B.tx + rad * B.kx && Math.abs(yc) <= zc * B.ty + rad * B.ky;
  }
  // the line from a to b clear over the height map: a step is blocked inside a column's sun-blocking run [bottom, top + 1]
  // (1-m steps to 32 m, then growing to 4 m; up to 220 m — beyond, and over columns not loaded, it counts as clear);
  // it stops `short` metres before b (the thing itself, the ground it stands on)
  function clear(g, x0, y0, z0, x1, y1, z1, short) {
    const w = g.world; if (!w || !w.col) return true;
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, D = Math.hypot(dx, dy, dz);
    const end = Math.min(D - (short || 0), 220); if (end <= 1) return true;
    const ux = dx / D, uy = dy / D, uz = dz / D;
    let s = 1, step = 1, c = null, lcx = 1e9, lcz = 1e9;
    while (s < end) {
      const x = x0 + ux * s, y = y0 + uy * s, z = z0 + uz * s, fx = Math.floor(x), fz = Math.floor(z), cx = fx >> 4, cz = fz >> 4;
      if (cx !== lcx || cz !== lcz) { c = w.col(cx, cz); lcx = cx; lcz = cz; }
      if (c && c.sh) { const k = (((fz & 15) << 4) | (fx & 15)) << 1, top = c.sh[k]; if (top > 0 && y < top + 1 && y >= c.sh[k + 1]) return false; }
      s += step; if (s > 32) step = Math.min(4, step * 1.1);
    }
    return true;
  }
  function fracOf(B, x, y, z, rad) {
    const d = Math.hypot(x - B.ex, y - B.ey, z - B.ez); if (d <= rad) return 1;
    const ry = rad / (d * B.ty), rx = rad / (d * B.tx);
    return Math.min(1, Math.PI * rx * ry / 4);
  }
  const VIS = { inView: false, frac: 0 };
  function see(g, x, y, z, rad) {
    const B = basis(g); VIS.inView = false; VIS.frac = 0;
    if (!B.ok) return VIS;
    if (!inFrustum(B, x, y, z, rad) || !clear(g, B.ex, B.ey, B.ez, x, y, z, Math.max(1.5, rad * 0.5))) return VIS;
    VIS.inView = true; VIS.frac = fracOf(B, x, y, z, rad);
    return VIS;
  }
  // (a test, the Regie) is (pos, r) in view now: {inView, frac}
  L.inView = function (pos, r, g) { g = g || game(); if (!pos) return { inView: true, frac: 0 }; const v = see(g, +pos[0], +pos[1], +pos[2], r > 0 ? r : 2); return { inView: v.inView, frac: v.frac }; };

  // ---------------------------------------------------------------- the record
  const copy = (R) => ({ n: R.n, t: R.t, kind: R.kind, sub: R.sub, w: R.w, x: R.x, y: R.y, z: R.z, src: R.src, inView: R.inView, frac: R.frac });
  L.emit = function (kind, sub, w, pos, src, r) {
    const g = game(); if (!ready(g)) return null;
    const t0 = now(), R = REC[L.count % N];
    L.count++;
    R.n = L.count; R.t = +(g.time || 0); R.kind = String(kind || 'ambient'); R.sub = sub === undefined || sub === null ? '' : String(sub); R.w = w | 0; R.src = src ? String(src) : '';
    if (pos) {
      R.x = +pos[0]; R.y = +pos[1]; R.z = +pos[2];
      const v = see(g, R.x, R.y, R.z, r > 0 ? r : 2); R.inView = v.inView; R.frac = v.frac;
    } else {
      const p = g.player && g.player.pos; R.x = p ? p[0] : 0; R.y = p ? p[1] : 0; R.z = p ? p[2] : 0;
      R.inView = true; R.frac = R.kind === 'wow' || R.kind === 'story' ? 1 : 0;
    }
    if (R.inView) for (let k = 1; k <= Math.min(5, R.w); k++) lastSeen[k] = R.t;
    const C = L.cost; C.emits++; C.emitMs += now() - t0;
    return copy(R);
  };

  // ---------------------------------------------------------------- the sources' mappers (each hook is one line)
  const Q = [0, 0, 0];
  const put = (x, y, z) => { Q[0] = x; Q[1] = y; Q[2] = z; return Q; };
  const mid = (a, b, dy) => put((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + (dy || 0), (a[2] + b[2]) / 2);
  const centroid = (list, dy) => { if (!list || !list.length) return null; let x = 0, y = 0, z = 0; for (const p of list) { x += p[0]; y += p[1]; z += p[2]; } const n = list.length; return put(x / n, y / n + (dy || 0), z / n); };
  const runMid = (run, dy) => { if (!run || !run.length) return null; const p = run[run.length >> 1]; return put(p[0], p[1] + (dy || 0), p[2]); };
  const festPlaza = (D) => { const V = D && D.g && D.g.villages, vil = V && V.festivalNear ? V.festivalNear() : null, pz = vil && vil.plan && vil.plan.plaza; return pz ? put(pz.x + 0.5, pz.y + 28, pz.z + 0.5) : null; };
  const at = (o, dy) => (o && o.pos ? put(o.pos[0], o.pos[1] + (dy || 0), o.pos[2]) : null);
  const A = (kind, w, r, moving, atFn, nowFn) => ({ kind, w, r, moving, at: atFn, now: nowFn || atFn });
  // the life director's acts (lifedirector.js LD.ACTS): kind, weight (A§10), radius, a moving actor?, where it plays
  // (the stage, for the event) and where it is now (for the sample); the flyover and the convoy are flown by the sky
  // traffic, which logs them at their nearest pass
  L.ACTS = {
    birds: A('ambient', 1, 12, true, (ev) => (ev.from && ev.to ? mid(ev.from, ev.to) : null), (ev) => { if (!ev.from || !ev.to) return null; const u = Math.min(1, (ev.age || 0) / (ev.dur || 1)); return put(ev.from[0] + (ev.to[0] - ev.from[0]) * u, ev.from[1] + (ev.to[1] - ev.from[1]) * u, ev.from[2] + (ev.to[2] - ev.from[2]) * u); }),
    chimneys: A('ambient', 1, 4, false, (ev) => (ev.c && ev.c[0] ? put(ev.c[0][0] + 0.5, ev.c[0][1] + 2.5, ev.c[0][2] + 0.5) : null)),
    lanterns: A('social', 2, 6, (ev) => !!ev.fig, (ev) => centroid(ev.route, 0.5), (ev) => (ev.fig && ev.fig.pos ? at(ev.fig, 0.9) : centroid(ev.route, 0.5))),
    cat: A('ambient', 2, 0.6, true, (ev) => at(ev.q, 0.3)),
    pigeons: A('ambient', 2, 3, true, (ev) => (ev.c ? put(ev.c[0], ev.c[1] + 0.5, ev.c[2]) : null)),
    cart: A('travel', 2, 2, true, (ev) => runMid(ev.run, 1), (ev) => (ev.pos && ev.y !== null && ev.y !== undefined ? put(ev.pos[0], ev.y + 0.6, ev.pos[2]) : runMid(ev.run, 1))),
    meteor: A('sky', 2, 8, false, (ev) => (ev.m && ev.m[0] && ev.m[0].p ? put(ev.m[0].p[0], ev.m[0].p[1], ev.m[0].p[2]) : null)),
    balloon: A('sky', 2, 8, true, (ev) => at(ev, 4)),
    bells: A('social', 2, 12, true, (ev) => (ev.c ? put(ev.c[0], ev.c[1] + 4, ev.c[2]) : null)),
    fireworks: A('sky', 3, 15, false, (ev, D) => festPlaza(D)),
    kids: A('social', 2, 4, true, (ev) => (ev.k2 && ev.k2.length > 1 && ev.k2[0].pos && ev.k2[1].pos ? mid(ev.k2[0].pos, ev.k2[1].pos, 0.8) : null)),
    musician: A('social', 2, 1.2, false, (ev) => at(ev.fig, 1)),
    dog: A('ambient', 2, 1.5, true, (ev) => (ev.c ? put(ev.c[0], ev.c[1] + 0.5, ev.c[2]) : null), (ev) => at(ev.q, 0.4)),
    skyray: A('sky', 3, 20, true, (ev) => (ev.c ? put(ev.c[0], ev.c[1], ev.c[2]) : null), (ev) => (ev.age > 0 && ev.pos ? put(ev.pos[0], ev.pos[1], ev.pos[2]) : ev.c ? put(ev.c[0], ev.c[1], ev.c[2]) : null)),
    fisher: A('social', 2, 1.5, false, (ev) => at(ev.b, 0.8)),
    flyover: null, convoy: null,
  };
  // an act begins (lifedirector.js start)
  L.act = function (ev, D) {
    const M = ev && L.ACTS[ev.kind]; if (!M) return null;
    let q = null; try { q = M.at(ev, D); } catch (e) { q = null; }
    return q ? L.emit(M.kind, ev.kind, M.w, q, 'life', M.r) : null;
  };
  const actNow = (ev, D) => { const M = L.ACTS[ev.kind]; if (!M) return null; try { return M.now(ev, D); } catch (e) { return null; } };
  // a codex entry unlocked (codex.js unlock): b biome, c creature → discovery 2; w wonder (its banner and fanfare) →
  // discovery 4; m milestone, i invention → milestone 2. On the screen: its toast (a wonder: its banner)
  const CODEX = { w: ['discovery', 4], b: ['discovery', 2], c: ['discovery', 2], m: ['milestone', 2], i: ['milestone', 2] };
  L.found = function (id) {
    const s = String(id || ''), pre = s[1] === ':' ? s[0] : '', k = CODEX[pre] || ['discovery', 2];
    return L.emit(k[0], pre ? s.slice(2) : s, k[1], null, 'codex');
  };
  // a craft of the sky traffic at its nearest point to the player (traffic.js update, every frame with its distance d):
  // once per flight, its leader only; a low pass of the life director (contrail) and the convoy are noticeable (2) to
  // 400 m, the other traffic within 120 m noticeable, to 250 m ambient (1), farther nothing
  L.pass = function (s, d) {
    if (!s || s.wing || !(s.t >= 0) || s._elDone) return null;
    if (s._elD === undefined || d < s._elD) { s._elD = d; return null; }
    if (d <= s._elD + 1) return null;
    s._elDone = 1;
    const dm = s._elD, low = !!s.contrail, convoy = !low && !!s.tag;
    if (dm > (low || convoy ? 400 : 250)) return null;
    const m = s.d && s.d.meta;
    return L.emit('travel', s.defender ? 'defence' : low ? 'lowpass' : convoy ? 'convoy' : 'flyby', dm <= 120 || low || convoy ? 2 : 1, s.pos, 'traffic', m && m.length ? m.length * 0.5 : 8);
  };
  // a pad's visitor touches down (padlife.js craft: the first two seconds of its stay, once per visit)
  L.landed = function (c, q) {
    if (!c || !q || c._el || q.phase !== 'parked' || !(q.u < 2) || !q.pos) return null;
    c._el = 1;
    const m = c.d && c.d.meta, r = m && (m.length || m.width) ? Math.max(m.length || 0, m.width || 0) * 0.5 : 10;
    return L.emit('travel', 'landing', 2, put(q.pos[0], q.pos[1] + 3, q.pos[2]), 'pad', r);
  };
  // a Baustelle (baustelle.js; blueprints' sites) rising and standing — observed at 1 Hz, no hook in its file
  function observeSites(g) {
    const B = g.gadgets && g.gadgets.blue, list = B && B.sites; if (!list || !list.length) return;
    for (const s of list) {
      if (!s || s.mode === 'instant' || !s.box) continue;
      const st = siteSeen.get(s) | 0, ph = s.phase;
      if (st === 0) { if (ph === 'earth' || ph === 'build') { siteSeen.set(s, 1); site(s, 'site', 2); } else siteSeen.set(s, 3); }
      else if (st === 1 && (ph === 'done' || ph === 'gone')) { siteSeen.set(s, 2); site(s, 'site_done', 3); }
      else if (st === 1 && ph === 'cancel') siteSeen.set(s, 2);
    }
  }
  const site = (s, sub, w) => { const b = s.box; L.emit('build', sub, w, put((b[0] + b[3]) / 2 + 0.5, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2 + 0.5), 'site', Math.max(b[3] - b[0], b[4] - b[1], b[5] - b[2]) / 2 + 1); };

  // ---------------------------------------------------------------- the frame: the input, the 1-Hz sample
  const MOVE = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ControlLeft'];
  function inputClass(g) {
    const I = g.input, BH = VR.Bauhand, p = g.player, ms = I && I.mouse;
    if ((BH && BH.state && BH.state !== 'closed') || (p && p.breaking) || (I && I.captured && ms && ms.down && (ms.down[0] || ms.down[2]) && !(g.ui && g.ui.screen))) return 3;
    if (I) {
      if (((I.keys && I.keys.size) || (I.padDown && I.padDown.size) || (I.tDown && I.tDown.size)) && I.down) { for (let i = 0; i < MOVE.length; i++) if (I.down(MOVE[i])) return 2; }
      const pm = I.padMove, tm = I.touchMove;
      if ((pm && (Math.abs(pm.fwd) > 0.1 || Math.abs(pm.str) > 0.1)) || (tm && (Math.abs(tm.fwd) > 0.1 || Math.abs(tm.str) > 0.1))) return 2;
    }
    if ((g.flight && g.flight.auto) || (g.director && g.director.active) || (VR.Intent && VR.Intent.current && VR.Intent.current())) return 1;
    return 0;
  }
  L.frame = function (g, dt) {
    if (!g) return;
    L.g = g;
    if (!ready(g)) return;
    const t0 = now();
    const c = inputClass(g); if (c > inMax) inMax = c;
    if (L.sampling) { acc += dt > 0 ? dt : 0; if (acc >= 0.999999) { acc -= 1; if (acc > 1 || acc < 0) acc = 0; sample(g); } }
    const ms = now() - t0, C = L.cost; C.frames++; C.ms += ms; if (ms > C.worst) C.worst = ms;
  };

  // movers in view: villagers, animals, the sky traffic, the pads' craft, trams, the life director's moving acts
  const MV = { v: 0, a: 0, s: 0, c: 0, t: 0, l: 0 };
  let nMov = 0, nChk = 0;
  function tryMover(g, B, cls, x, y, z, rad, maxD) {
    if (nMov >= 9 || nChk >= 24) return;
    const dx = x - B.ex, dz = z - B.ez; if (dx * dx + dz * dz > maxD * maxD) return;
    if (!inFrustum(B, x, y, z, rad)) return;
    nChk++;
    if (!clear(g, B.ex, B.ey, B.ez, x, y, z, Math.max(1, rad))) return;
    nMov++; MV[cls]++;
  }
  function movers(g, B, S) {
    nMov = 0; nChk = 0; MV.v = MV.a = MV.s = MV.c = MV.t = MV.l = 0;
    const Vg = g.villages;
    if (Vg && Vg.agents) for (const a of Vg.agents) { if (nMov >= 9) break; const v = a.vel; if (!v || !a.pos || a.pose === 'sleep' || a.pose === 'sit' || a.pose === 'sitground' || v[0] * v[0] + v[2] * v[2] < 0.09) continue; tryMover(g, B, 'v', a.pos[0], a.pos[1] + 0.9, a.pos[2], 0.9, 160); }
    const En = g.entities;
    if (En && En.mobs) for (const m of En.mobs) { if (nMov >= 9) break; if (!m || m.dead || !m.pos) continue; const v = m.vel, fly = m.def && m.def.fly; if (!fly && (!v || v[0] * v[0] + v[2] * v[2] < 0.09)) continue; tryMover(g, B, 'a', m.pos[0], m.pos[1] + (m.h || 1) * 0.5, m.pos[2], (m.w || 0.4) + 0.3, 160); }
    const T = g.traffic;
    if (T && T.ships) for (const s of T.ships) { if (nMov >= 9) break; if (!s || s.dead || !(s.t >= 0) || !s.pos || (s.alpha !== undefined && s.alpha < 0.5)) continue; const m = s.d && s.d.meta; tryMover(g, B, 's', s.pos[0], s.pos[1], s.pos[2], m && m.length ? m.length * 0.5 : 8, 650); }
    const P = g.padLife;
    if (P && P.pads) for (const pad of P.pads.values()) { if (!pad.live) continue; for (const q of pad.live) { if (nMov >= 9) break; if (!q || q.phase === 'parked' || !q.pos) continue; tryMover(g, B, 'c', q.pos[0], q.pos[1] + 3, q.pos[2], 10, 650); } }
    const Tr = g.trams;
    if (Tr && Tr.cars) for (const c of Tr.cars) { if (nMov >= 9) break; const v = c.vel; if (!v || !c.pos || v[0] * v[0] + v[2] * v[2] < 0.25) continue; tryMover(g, B, 't', c.pos[0], c.pos[1] + 1.5, c.pos[2], 4, 300); }
    const D = g.lifeDirector;
    if (D && D.events) for (const ev of D.events) { if (nMov >= 9) break; const M = L.ACTS[ev.kind]; if (!M || !(typeof M.moving === 'function' ? M.moving(ev) : M.moving)) continue; const q = actNow(ev, D); if (q) tryMover(g, B, 'l', q[0], q[1], q[2], M.r, 400); }
    S.movers = nMov;
    let mv = ''; for (const k in MV) if (MV[k]) mv += (mv ? ' ' : '') + k + MV[k];
    S.mv = mv;
  }
  // the known landmarks: the Heartland's (gen_heart.js, gen_vista.js landmarks: id, x, z, base, top, r) and any added
  const HEART_LM = [['temple', 0, -15, 80, 167, 52], ['citadel', -420, 380, 112, 249, 30], ['isles', 330, 140, 130, 175, 110], ['nova', 0, -140, 80, 100, 95], ['station', -380, -150, 150, 230, 30], ['hills', 0, -322, 90, 125, 150]];
  L.HEART_LM = HEART_LM;
  let lmBest = '', lmSize = 0;
  function oneLandmark(g, B, id, x, z, base, top, r) {
    const dx = x - B.ex, dz = z - B.ez, d = Math.hypot(dx, dz);
    if (d > 3000 || d < r) return;                                    // (inside it — a town's streets — it is not a sight)
    const size = (top - base) / (Math.max(1, d) * 2 * B.ty);          // its height on the screen
    if (size < 0.03 || size <= lmSize) return;
    if (!inFrustum(B, x, (base + top) / 2, z, Math.max(r, (top - base) / 2))) return;
    if (!clear(g, B.ex, B.ey, B.ez, x, top - 1, z, Math.max(2, r * 0.5))) return;
    lmBest = id; lmSize = size;
  }
  function landmark(g, B) {
    lmBest = ''; lmSize = 0;
    const m = g.meta, heart = !!(m && (m.vgen | 0) >= 3 && m.type !== 'flat') && (g.dim || 'overworld') === 'overworld';
    if (heart) for (const q of HEART_LM) oneLandmark(g, B, q[0], q[1], q[2], q[3], q[4], q[5]);
    if (L.landmarks) for (const q of L.landmarks) if (q) oneLandmark(g, B, q.id, q.x, q.z, q.base, q.top, q.r || 4);
    return lmBest;
  }
  function bodyInView(g, B, d, ang) {
    if (!d) return false;
    const R = 1000, x = B.ex + d[0] * R, y = B.ey + d[1] * R, z = B.ez + d[2] * R;
    return inFrustum(B, x, y, z, R * Math.tan(ang)) && clear(g, B.ex, B.ey, B.ez, x, y, z, 0);
  }
  const SKY_ACTS = { meteor: 1, skyray: 1, fireworks: 1 };
  function sky(g, B, E) {
    const D = g.lifeDirector;
    if (D && D.events) for (const ev of D.events) { if (!SKY_ACTS[ev.kind]) continue; const q = actNow(ev, D); if (q && inFrustum(B, q[0], q[1], q[2], L.ACTS[ev.kind].r)) return ev.kind; }
    if (!E) return '';
    if (bodyInView(g, B, E.planetDir, 0.122)) return 'giant';
    if (bodyInView(g, B, E.planet2Dir, 0.085)) return 'blue';
    const sd = E.sunDir;
    if (sd) { const el = Math.asin(Math.max(-1, Math.min(1, sd[1]))); if (el > -12 * DEG && el < 10 * DEG && clear(g, B.ex, B.ey, B.ez, B.ex, B.ey + 60, B.ez, 0)) return 'low_sun'; }
    return '';
  }
  function sample(g) {
    const t0 = now(), S = SMP[L.nSamples % NS];
    L.nSamples++;
    const B = basis(g), p = g.player, E = g.env && g.env.E;
    S.t = +(g.time || 0); S.tod = g.env ? Math.round(g.env.timeOfDay || 0) : 0;
    S.x = p && p.pos ? Math.round(p.pos[0] * 10) / 10 : 0; S.z = p && p.pos ? Math.round(p.pos[2] * 10) / 10 : 0;
    S.input = INPUTS[inMax]; inMax = 0;
    S.place = g.lifeDirector && g.lifeDirector.st ? g.lifeDirector.st.place || '' : '';
    if (B.ok) { movers(g, B, S); S.landmark = landmark(g, B); S.sky = sky(g, B, E); }
    else { S.movers = 0; S.mv = ''; S.landmark = ''; S.sky = ''; }
    observeSites(g);
    const C = L.cost; C.samples++; C.sampleMs += now() - t0;
  }

  // ---------------------------------------------------------------- reading it (copies: nobody changes the ring)
  L.events = function (sinceN) {
    const out = [], first = Math.max(1, L.count - N + 1, (sinceN | 0) + 1);
    for (let n = first; n <= L.count; n++) out.push(copy(REC[(n - 1) % N]));
    return out;
  };
  const scopy = (S) => ({ t: S.t, movers: S.movers, mv: S.mv, landmark: S.landmark, sky: S.sky, input: S.input, x: S.x, z: S.z, place: S.place, tod: S.tod });
  L.samples = function (sinceT) {
    const out = [], n = Math.min(L.nSamples, NS), lo = sinceT === undefined ? -Infinity : +sinceT;
    for (let i = L.nSamples - n; i < L.nSamples; i++) { const S = SMP[i % NS]; if (S.t > lo) out.push(scopy(S)); }
    return out;
  };
  L.last = function (minW, inViewOnly) {
    for (let n = L.count; n >= Math.max(1, L.count - N + 1); n--) { const R = REC[(n - 1) % N]; if (R.w >= (minW | 0) && (!inViewOnly || R.inView)) return copy(R); }
    return null;
  };
  // seconds since the last event of weight ≥ minW in view (Infinity: none yet) — the Regie's trigger (A§10)
  L.sinceSeen = function (minW) { const g = game(), k = Math.max(1, Math.min(5, minW | 0)); return lastSeen[k] === -Infinity ? Infinity : +((g && g.time) || 0) - lastSeen[k]; };
  L.dump = function () { return { count: L.count, nSamples: L.nSamples, events: L.events(0), samples: L.samples(), cost: Object.assign({}, L.cost) }; };
})(VR);
