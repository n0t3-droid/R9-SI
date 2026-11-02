// ============================================================================
// u-stars · VR.StarMap — the star map (docs/superpowers/plans/2026-10-30-u-stars.md; universe spec §8.5).
// A 2-D canvas over the game: the 1,508 systems of the neighbourhood (VR.Galaxy) in 3-D — drag to turn, wheel to zoom,
// every system in its star's colour and by its brightness, the 30-ly range sphere round where you are, visited systems
// ringed, home (Helia) always marked, filters (star types, binaries, nebulae, visited, in reach, worlds to land on),
// the distance to the one you point at; a card with its star, planets and „Springen" (or why not). In another system
// the card of that system shows its live orrery: a click on a world turns the view to it (the autopilot's orbit).
// Open: O (the star-map key), the pause menu (🌌 Sternkarte), /sterne; Esc or O closes.
// Cost: while open the 3-D frame is not drawn; the canvas is redrawn only when something changed (drag, zoom, hover,
// a filter) and the small orrery four times a second. Nothing when closed.
// ============================================================================
(function (VR) {
  'use strict';
  // ---- e-portal2 (R55-05): the first view of a new player's map — the nearest n systems round `here` (their indices,
  // nearest first) and the zoom that frames them (the farthest at ~38 % of the picture's height from the middle)
  VR.StarMapFit = function (N, here, n) {
    const c = N.list[here].p, d = N.list.map((s, i) => [i, Math.hypot(s.p[0] - c[0], s.p[1] - c[1], s.p[2] - c[2])]).filter(q => q[0] !== here).sort((a, b) => a[1] - b[1]).slice(0, n || 24);
    const far = d.length ? d[d.length - 1][1] : 30;
    return { labels: d.map(q => q[0]), dist: Math.max(12, Math.min(520, far * 0.95 / 0.38 + far)), far };
  };
  // ---- e-portal2 end
  // ---- w-golden: the range sphere's radius in pixels → what is drawn: 'ring' (the outline, its fill, the equator),
  // 'all' (wider than four screens — creative's 1e6 ly: the whole map in reach, a faint tint alone; a canvas circle
  // millions of pixels round with a fill spun the software canvas for minutes: O hung the game), 'none' (behind the eye)
  VR.StarMapSphere = (rp, W, H) => (!(rp > 0) ? 'none' : rp > 4 * Math.max(W, H) ? 'all' : 'ring');
  // ---- w-golden end
  if (typeof window === 'undefined' || !VR.Game) return;
  const SM = VR.StarMap = {};
  const T = (k, v) => (VR.I18N ? VR.I18N.t(k, v) : k);
  const G = () => VR.Galaxy, SJ = () => VR.StarJump;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (x, d) => { const s = Number(x).toFixed(d === undefined ? 1 : d); return (VR.I18N && (typeof VR.I18N.lang === 'function' ? VR.I18N.lang() : VR.I18N.lang) === 'en') ? s : s.replace('.', ','); };
  const CLS = ['O', 'B', 'A', 'F', 'G', 'K', 'M', 'D'];
  const M = SM.st = { open: false, g: null, yaw: 0.6, pitch: 0.55, dist: 95, sel: -1, hov: -1, dirty: true, filt: { cls: {}, bin: false, neb: false, vis: false, reach: false, land: '' }, drag: null, proj: null, orrT: 0, drawMs: 0, draws: 0 };
  for (const c of CLS) M.filt.cls[c] = true;
  let root = null, cv = null, ctx = null, card = null, orr = null;
  SM.isOpen = () => M.open;

  // ---------------------------------------------------------------- the DOM (made once)
  function build() {
    if (root) return;
    root = document.createElement('div'); root.id = 'starMap';
    root.style.cssText = 'position:fixed;inset:0;z-index:40;background:#03050b;display:none;color:#e6eefc;font:14px/1.35 system-ui,sans-serif;user-select:none';
    root.innerHTML = `<canvas id="smCv" style="position:absolute;inset:0;width:100%;height:100%;cursor:grab"></canvas>
      <div id="smTop" style="position:absolute;left:16px;top:12px;right:16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;pointer-events:none">
        <b style="font-size:18px;letter-spacing:.02em">🌌 <span data-t="g.stars.map"></span></b><span id="smWhere" style="opacity:.8"></span>
      </div>
      <div id="smFilt" style="position:absolute;left:16px;top:46px;display:flex;flex-direction:column;gap:6px;background:#0a1222cc;border:1px solid #9cc4ff30;border-radius:10px;padding:10px;max-width:240px"></div>
      <div id="smCard" style="position:absolute;right:16px;top:46px;width:310px;max-height:calc(100% - 110px);overflow:auto;background:#0a1222e6;border:1px solid #9cc4ff40;border-radius:12px;padding:12px;display:none"></div>
      <div id="smHelp" style="position:absolute;left:0;right:0;bottom:12px;text-align:center;opacity:.75;pointer-events:none"></div>
      <button id="smClose" class="btn small" style="position:absolute;right:16px;top:10px">✕</button>`;
    document.body.appendChild(root);
    cv = root.querySelector('#smCv'); ctx = cv.getContext('2d', { alpha: false }); card = root.querySelector('#smCard');
    root.querySelector('#smClose').onclick = () => SM.close(M.g);
    cv.addEventListener('pointerdown', (e) => { M.drag = { x: e.clientX, y: e.clientY, yaw: M.yaw, pitch: M.pitch, moved: 0 }; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; });
    cv.addEventListener('pointermove', (e) => {
      if (M.drag) { const dx = e.clientX - M.drag.x, dy = e.clientY - M.drag.y; M.drag.moved = Math.max(M.drag.moved, Math.abs(dx) + Math.abs(dy)); M.yaw = M.drag.yaw - dx * 0.006; M.pitch = clamp(M.drag.pitch + dy * 0.006, -1.45, 1.45); M.dirty = true; return; }
      const h = pick(e.clientX, e.clientY); if (h !== M.hov) { M.hov = h; M.dirty = true; }
    });
    cv.addEventListener('pointerup', (e) => { const d = M.drag; M.drag = null; cv.style.cursor = 'grab'; if (d && d.moved < 5) { const h = pick(e.clientX, e.clientY); if (h >= 0) select(h); } });
    cv.addEventListener('wheel', (e) => { e.preventDefault(); M.dist = clamp(M.dist * Math.exp(e.deltaY * 0.0012), 12, 520); M.dirty = true; }, { passive: false });
    window.addEventListener('keydown', (e) => { if (!M.open) return; if (e.code === 'Escape' || e.code === 'KeyO') { e.preventDefault(); e.stopPropagation(); SM.close(M.g); } }, true);
    const f = root.querySelector('#smFilt');
    f.innerHTML = `<div style="font-weight:600;opacity:.85" data-t="g.stars.filters"></div>
      <div id="smCls" style="display:flex;flex-wrap:wrap;gap:4px"></div>
      ${['reach', 'vis', 'bin', 'neb'].map(k => `<label style="display:flex;gap:6px;align-items:center;cursor:pointer"><input type="checkbox" data-f="${k}"><span data-t="g.stars.f.${k}"></span></label>`).join('')}
      <label style="display:flex;gap:6px;align-items:center"><span data-t="g.stars.f.land"></span><select data-f="land" style="flex:1;background:#101a30;color:#e6eefc;border:1px solid #9cc4ff40;border-radius:6px">
        <option value=""></option>${G().KINDS.map(k => `<option value="${k}"></option>`).join('')}</select></label>`;
    const cl = f.querySelector('#smCls');
    for (const c of CLS) {
      const b = document.createElement('button'); b.className = 'btn small'; b.dataset.cls = c; b.textContent = c === 'D' ? 'WD' : c;
      b.style.cssText = 'min-width:34px;padding:2px 6px;border-radius:12px;border:1px solid #fff3;color:#05070c;font-weight:700';
      b.style.background = G().colorOf({ O: 40000, B: 20000, A: 9000, F: 6800, G: 5700, K: 4500, M: 3200, D: 12000 }[c]);
      b.onclick = () => { M.filt.cls[c] = !M.filt.cls[c]; b.style.opacity = M.filt.cls[c] ? 1 : 0.3; M.dirty = true; };
      cl.appendChild(b);
    }
    f.querySelectorAll('input[data-f]').forEach(x => { x.onchange = () => { M.filt[x.dataset.f] = x.checked; M.dirty = true; }; });
    f.querySelector('select[data-f]').onchange = (e) => { M.filt.land = e.target.value; M.dirty = true; };
  }
  function words() {
    root.querySelectorAll('[data-t]').forEach(e => { e.textContent = T(e.dataset.t); });
    const sel = root.querySelector('select[data-f="land"]');
    sel.options[0].textContent = T('g.stars.f.any');
    for (let i = 1; i < sel.options.length; i++) sel.options[i].textContent = T('g.stars.kind.' + sel.options[i].value);
    root.querySelector('#smHelp').textContent = T('g.stars.mapHelp');
  }

  // ---------------------------------------------------------------- open, close, the frame
  SM.open = function (g) {
    if (!g || g.state !== 'play') return false;
    build();
    M.g = g; M.open = true; M.N = SJ().hood(g); M.here = SJ().here(g); M.dirty = true; M.hov = -1;
    if (M.sel < 0 || !M.N.list[M.sel]) M.sel = M.here;
    if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
    words();
    root.style.display = 'block';
    resize(); showCard();
    M.opened = performance.now();
    // ---- e-portal2 (R55-05): Helia's neighbourhood framed on the first open (here), and the first frame drawn now —
    // not only from the next play frame (a held or slow frame showed a black map)
    if (M.fitHere !== M.here && VR.StarMapFit) { const f = VR.StarMapFit(M.N, M.here, 28); M.fitLabels = f.labels; M.fitHere = M.here; M.dist = f.dist; }
    try { const t0 = performance.now(); draw(); M.drawMs = performance.now() - t0; M.draws++; M.dirty = false; } catch (e) { M.dirty = true; }
    // ---- e-portal2 end
    return true;
  };
  SM.close = function (g, quiet) {
    if (!M.open) return;
    M.open = false; if (root) root.style.display = 'none';
    if (g && g.renderer) g.renderer.tsrReset = true;
    void quiet;
  };
  function resize() { const W = window.innerWidth, H = window.innerHeight; if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; M.dirty = true; } }
  // the play frame while the map is open: the clock waits, the map draws when something changed
  SM.frame = function (g, dt) {
    if (!M.open) return false;
    if (g.pool && g.pool.pump) g.pool.pump();
    resize();
    if (M.dirty) { const t0 = performance.now(); draw(); M.drawMs = performance.now() - t0; M.draws++; M.dirty = false; }
    if ((M.orrT -= dt) <= 0 && orr && orr.isConnected) { M.orrT = 0.25; drawOrrery(); }
    return true;
  };

  // ---------------------------------------------------------------- the projection
  function proj() {
    const N = M.N, c = N.list[M.here].p, W = cv.width, H = cv.height, f = H * 0.95;
    const cy = Math.cos(M.yaw), sy = Math.sin(M.yaw), cp = Math.cos(M.pitch), sp = Math.sin(M.pitch);
    // camera on a sphere round the centre, looking at it (y up)
    const P = M.proj || (M.proj = { x: new Float32Array(N.list.length), y: new Float32Array(N.list.length), z: new Float32Array(N.list.length) });
    if (P.x.length !== N.list.length) { P.x = new Float32Array(N.list.length); P.y = new Float32Array(N.list.length); P.z = new Float32Array(N.list.length); }
    P.f = f; P.W = W; P.H = H; P.c = c;
    P.to = (p) => {
      const x = p[0] - c[0], y = p[1] - c[1], z = p[2] - c[2];
      const x1 = x * cy - z * sy, z1 = x * sy + z * cy;
      const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
      const d = M.dist - z2;
      return [W / 2 + x1 * f / d, H / 2 - y2 * f / d, d];
    };
    for (let i = 0; i < N.list.length; i++) { const q = P.to(N.list[i].p); P.x[i] = q[0]; P.y[i] = q[1]; P.z[i] = q[2]; }
    return P;
  }
  function pick(x, y) {
    const P = M.proj; if (!P) return -1;
    let best = -1, bd = 14 * 14;
    for (let i = 0; i < P.x.length; i++) { if (P.z[i] < 1 || !shown(i)) continue; const dx = P.x[i] - x, dy = P.y[i] - y, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = i; } }
    return best;
  }
  const distLy = (a, b) => G().dist(M.N.list[a], M.N.list[b]);
  function shown(i) {
    const s = M.N.list[i], F = M.filt;
    if (s.home || i === M.here) return true;
    if (!F.cls[s.cls]) return false;
    if (F.bin && !s.bin) return false;
    if (F.neb && s.neb < 0) return false;
    if (F.vis && !SJ().visited(M.g).includes(i)) return false;
    if (F.reach && distLy(i, M.here) > SJ().range(M.g)) return false;
    if (F.land) { const d = G().system(M.N, i); if (!d || !d.bodies.some(b => b.landable && b.base === F.land)) return false; }
    return true;
  }
  SM.shown = shown;

  // ---------------------------------------------------------------- the picture
  function draw() {
    const N = M.N, P = proj(), W = P.W, H = P.H, X = ctx, range = SJ().range(M.g), vis = SJ().visited(M.g);
    X.fillStyle = '#03050b'; X.fillRect(0, 0, W, H);
    // the galactic plane round where you are: rings every 50 ly, the disc's edge
    X.lineWidth = 1;
    for (let rr = 50; rr <= 400; rr += 50) {
      X.strokeStyle = rr % 100 ? '#26385a40' : '#3a5a8a55'; X.beginPath();
      for (let k = 0; k <= 72; k++) { const a = k / 72 * Math.PI * 2, q = P.to([P.c[0] + rr * Math.cos(a), 0, P.c[2] + rr * Math.sin(a)]); if (q[2] < 1) { X.moveTo(q[0], q[1]); continue; } k ? X.lineTo(q[0], q[1]) : X.moveTo(q[0], q[1]); }
      X.stroke();
    }
    // the range sphere: its outline and its equator
    const cq = P.to(P.c), rp = range * P.f / cq[2], sph = VR.StarMapSphere(rp, W, H);   // (w-golden: see VR.StarMapSphere)
    if (sph === 'all') { X.fillStyle = '#7fd4ff0d'; X.fillRect(0, 0, W, H); }
    else if (sph === 'ring') {
      X.strokeStyle = '#7fd4ff88'; X.lineWidth = 1.5; X.beginPath(); X.arc(cq[0], cq[1], rp, 0, Math.PI * 2); X.stroke();
      X.fillStyle = '#7fd4ff0d'; X.fill();
      X.strokeStyle = '#7fd4ff44'; X.beginPath();
      for (let k = 0; k <= 64; k++) { const a = k / 64 * Math.PI * 2, q = P.to([P.c[0] + range * Math.cos(a), P.c[1], P.c[2] + range * Math.sin(a)]); k ? X.lineTo(q[0], q[1]) : X.moveTo(q[0], q[1]); }
      X.stroke();
    }
    // the systems, far first
    const order = M.order || (M.order = new Int32Array(N.list.length).map((_, i) => i));
    order.sort((a, b) => P.z[b] - P.z[a]);
    for (let k = 0; k < order.length; k++) {
      const i = order[k], s = N.list[i], z = P.z[i]; if (z < 1) continue;
      const x = P.x[i], y = P.y[i]; if (x < -20 || y < -20 || x > W + 20 || y > H + 20) continue;
      const on = shown(i), pr = clamp(80 / z, 0.35, 2.2);
      const r = clamp((1.6 + 0.55 * Math.log10(s.L + 0.001)) * pr, 1.1, 7);
      if (s.neb >= 0 && on) { X.fillStyle = '#ff4f8a22'; X.beginPath(); X.arc(x, y, r * 4, 0, Math.PI * 2); X.fill(); }
      X.globalAlpha = on ? 1 : 0.12;
      X.fillStyle = s.color; X.beginPath(); X.arc(x, y, r, 0, Math.PI * 2); X.fill();
      if (s.bin && on) { X.fillStyle = s.bin.color; X.beginPath(); X.arc(x + r + 1.6, y - r * 0.5, Math.max(0.8, r * 0.55), 0, Math.PI * 2); X.fill(); }
      if (on && vis.includes(i) && !s.home) { X.strokeStyle = '#ffffffb0'; X.lineWidth = 1; X.beginPath(); X.arc(x, y, r + 3.5, 0, Math.PI * 2); X.stroke(); }
      X.globalAlpha = 1;
    }
    // ---- u-stars2: the route (meta.stars.route — where you have been, in order) and the nearest system worth a jump
    const RT = M.g && M.g.meta && M.g.meta.stars && Array.isArray(M.g.meta.stars.route) ? M.g.meta.stars.route : [];
    if (RT.length > 1) {
      X.strokeStyle = '#ffcf6acc'; X.lineWidth = 1.8; X.setLineDash([]); X.beginPath();
      let on = false;
      for (const i of RT) { if (!(P.z[i] >= 1)) { on = false; continue; } on ? X.lineTo(P.x[i], P.y[i]) : X.moveTo(P.x[i], P.y[i]); on = true; }
      X.stroke();
      X.fillStyle = '#ffcf6a'; for (const i of RT) if (P.z[i] >= 1) { X.beginPath(); X.arc(P.x[i], P.y[i], 2.4, 0, Math.PI * 2); X.fill(); }
    }
    const NX = VR.Exo ? VR.Exo.interesting(N, M.here, vis, range) : null;
    M.next = NX;
    if (NX && P.z[NX.idx] >= 1) {
      const x = P.x[NX.idx], y = P.y[NX.idx], r = 11;
      X.strokeStyle = '#ffd36a'; X.lineWidth = 2; X.beginPath(); X.moveTo(x, y - r); X.lineTo(x + r, y); X.lineTo(x, y + r); X.lineTo(x - r, y); X.closePath(); X.stroke();
      X.setLineDash([2, 6]); X.strokeStyle = '#ffd36a88'; X.lineWidth = 1.2; X.beginPath(); X.moveTo(P.x[M.here], P.y[M.here]); X.lineTo(x, y); X.stroke(); X.setLineDash([]);
    }
    // ---- u-stars2 end
    // home, here, the selection, the hovered — and the names in reach
    X.font = '600 12px system-ui,sans-serif'; X.textBaseline = 'middle';
    // (e-portal2: the labels counted and kept apart — a name over another is left out, except the marked ones)
    const boxes = []; M.labels = 0;
    const label = (i, col, txt, opt) => {
      if (P.z[i] < 1) return; const w = X.measureText(txt).width, bx = P.x[i] + 9, by = P.y[i] - 8;
      if (bx > W || by > H || bx + w < 0 || by < -16) return;
      if (opt) for (const b of boxes) if (bx < b[0] + b[2] && bx + w + 6 > b[0] && by < b[1] + 16 && by + 16 > b[1]) return;
      boxes.push([bx, by, w + 6]); M.labels++;
      X.fillStyle = '#000a'; X.fillRect(bx, by, w + 6, 16); X.fillStyle = col; X.fillText(txt, P.x[i] + 12, P.y[i]);
    };
    const near0 = G().systemsNear(N, N.list[M.here].p, range), near = VR.Diegetic && VR.Diegetic.capNear ? VR.Diegetic.capNear(near0, VR.Diegetic.STAR_LABELS) : near0;   // f-ux: the labels in reach, the nearest 24 (creative: all 1518 were)
    for (const q of near) if (q.idx !== M.here && shown(q.idx)) label(q.idx, '#cfe6ffcc', q.s.name + ' · ' + fmt(q.d) + ' ' + T('g.stars.ly'), true);
    // ---- e-portal2 (R55-05): the neighbourhood's names beyond the jump's reach too (the nearest 28, dimmer)
    if (M.fitHere === M.here && M.fitLabels) for (const i of M.fitLabels) if (shown(i) && !near.some(q => q.idx === i)) label(i, '#9fb8d8b0', N.list[i].name + ' · ' + fmt(distLy(i, M.here)) + ' ' + T('g.stars.ly'), true);
    // ---- e-portal2 end
    { const i = 0; X.strokeStyle = '#ffd36a'; X.lineWidth = 2; X.beginPath(); X.arc(P.x[i], P.y[i], 9, 0, Math.PI * 2); X.stroke(); label(i, '#ffd36a', '🏠 ' + T('g.stars.home') + (M.here ? ' · ' + fmt(distLy(0, M.here)) + ' ' + T('g.stars.ly') : '')); }
    if (M.here) { const i = M.here; X.strokeStyle = '#7fffd4'; X.lineWidth = 2; X.beginPath(); X.moveTo(P.x[i] - 12, P.y[i]); X.lineTo(P.x[i] - 5, P.y[i]); X.moveTo(P.x[i] + 5, P.y[i]); X.lineTo(P.x[i] + 12, P.y[i]); X.moveTo(P.x[i], P.y[i] - 12); X.lineTo(P.x[i], P.y[i] - 5); X.moveTo(P.x[i], P.y[i] + 5); X.lineTo(P.x[i], P.y[i] + 12); X.stroke(); label(i, '#7fffd4', T('g.stars.here') + ': ' + N.list[i].name); }
    for (const i of [M.sel, M.hov]) {
      if (i < 0 || i === M.here || P.z[i] < 1) continue;
      const d = distLy(i, M.here), ok = d <= range || i === 0;
      X.setLineDash([5, 5]); X.strokeStyle = ok ? '#7fd4ffaa' : '#ff9a7a88'; X.lineWidth = 1.2; X.beginPath(); X.moveTo(P.x[M.here], P.y[M.here]); X.lineTo(P.x[i], P.y[i]); X.stroke(); X.setLineDash([]);
      X.strokeStyle = '#fff'; X.lineWidth = 1.5; X.beginPath(); X.arc(P.x[i], P.y[i], 8, 0, Math.PI * 2); X.stroke();
      label(i, '#fff', N.list[i].name + ' · ' + fmt(d) + ' ' + T('g.stars.ly'));
    }
    if (NX && P.z[NX.idx] >= 1) label(NX.idx, '#ffd36a', T('g.stars2.next', { name: NX.name, ly: fmt(NX.d), why: T('g.stars2.why.' + NX.why) }));   // u-stars2
    root.querySelector('#smWhere').textContent = T('g.stars.mapWhere', { name: N.list[M.here].name, n: near0.length - 1, ly: range, all: N.list.length }) + (RT.length > 1 ? ' · ' + T('g.stars2.route', { n: RT.length - 1 }) : '');   // (u-stars2: the route)
  }

  // ---------------------------------------------------------------- the card
  function select(i) { M.sel = i; M.dirty = true; showCard(); }
  SM.select = select;
  function showCard() {
    const N = M.N, i = M.sel, s = N.list[i]; if (!s) { card.style.display = 'none'; return; }
    const def = G().system(N, i), here = i === M.here, d = distLy(i, M.here), range = SJ().range(M.g), why = SJ().canJump(M.g);
    const pl = def.bodies.filter(b => b.planet || b.kind !== 'star' && !b.moon);
    const star = s.home ? { type: 'F5 V', T: 6550 } : def.star;
    let h = `<div style="display:flex;gap:10px;align-items:center"><div style="width:30px;height:30px;border-radius:50%;background:${s.color};box-shadow:0 0 14px ${s.color}"></div>
      <div><div style="font-size:17px;font-weight:700">${esc(s.name)}${s.home ? ' 🏠' : ''}</div><div style="opacity:.8">${esc(star.type)} · ${fmt(star.T, 0)} K${s.bin ? ' · ' + esc(T(s.bin.close ? 'g.stars.binClose' : 'g.stars.binWide', { type: s.bin.sub, au: fmt(s.bin.a, s.bin.close ? 2 : 0) })) : ''}</div></div></div>`;
    h += `<div style="margin:8px 0;opacity:.9">${here ? T('g.stars.youAreHere') : esc(T('g.stars.dist', { ly: fmt(d) })) + ' · ' + (d <= range || i === 0 ? '✅ ' + T('g.stars.inReach') : '⛔ ' + esc(T('g.stars.outReach', { ly: range })))}</div>`;
    if (s.neb >= 0) h += `<div style="color:#ff9ac0">🌸 ${T('g.stars.inNebula')} · ${esc(VR.StarJump.nameOf(N.nebs[s.neb].name))}</div>`;
    if (SJ().visited(M.g).includes(i)) h += `<div style="opacity:.8">◯ ${T('g.stars.visited')}</div>`;
    if (!s.home) {
      h += `<div style="margin-top:8px;font-weight:600">${esc(T('g.stars.planets', { n: pl.length }))}</div><div style="display:flex;flex-direction:column;gap:2px;margin-top:4px">`;
      for (const b of pl) {
        const moons = def.bodies.filter(x => x.parent === b.id).length;
        h += `<div data-body="${b.id}" style="display:flex;justify-content:space-between;gap:6px;padding:2px 4px;border-radius:6px;${here ? 'cursor:pointer;' : ''}${here && SJ() && M.g.stars && M.g.stars.focus === b ? 'background:#7fd4ff22' : ''}"><span>${esc(VR.StarJump.nameOf(b.name).replace(s.name + ' ', ''))} · ${esc(T('g.stars.cls.' + b.cls))}${moons ? ' · ☾' + moons : ''}</span><span style="opacity:.85">${b.landable ? '🛬 ' + esc(T('g.stars.kind.' + b.base)) : ''}</span></div>`;
      }
      h += '</div>';
    }
    if (here && s.home && VR.Ferries && VR.Ferries.drawRoutes) h += `<div style="margin-top:8px;font-weight:600">${esc(T('g.fe.routes'))}</div><canvas id="smOrr" data-routes="1" width="286" height="190" style="margin-top:4px;width:286px;height:190px;background:#050914;border-radius:8px"></canvas>`;   // a-life: Helia's trade routes
    if (here && !s.home) h += `<canvas id="smOrr" width="286" height="190" style="margin-top:8px;width:286px;height:190px;background:#050914;border-radius:8px"></canvas>`;
    if (!here) {
      const ok = !why && (d <= range || i === 0);
      h += `<button class="btn primary" id="smJump" style="margin-top:10px;width:100%;${ok ? '' : 'opacity:.4;filter:grayscale(1);cursor:not-allowed'}" ${ok ? '' : 'disabled'}>🚀 ${esc(T(i === 0 ? 'g.stars.jumpHome' : 'g.stars.jump'))}</button>`;
      if (!ok) h += `<div style="margin-top:6px;opacity:.8;font-size:12px">${esc(T(why || 'g.stars.range', { ly: fmt(d), max: range }))}</div>`;
    }
    card.innerHTML = h; card.style.display = 'block';
    const jb = card.querySelector('#smJump');
    if (jb) jb.onclick = () => { const g = M.g; SM.close(g); SJ().jump(g, i); };
    orr = card.querySelector('#smOrr'); M.orrT = 0;
    if (here) card.querySelectorAll('[data-body]').forEach(e => { e.onclick = () => { const g = M.g, S = g.stars; if (!S || !S.on) return; const b = S.def.bodies.find(x => x.id === e.dataset.body); if (b) { const pl2 = S.def.bodies.filter(x => x.planet); SJ().nextFocus(g, pl2.indexOf(b) - pl2.indexOf(S.focus)); showCard(); } }; });
  }
  // the live orrery of the system you are in (log radius, the worlds where they are now)
  function drawOrrery() {
    if (orr && orr.dataset && orr.dataset.routes && VR.Ferries) { VR.Ferries.drawRoutes(orr, M.g); return; }   // a-life
    const g = M.g, S = g.stars; if (!orr || !S || !S.def) return;
    const X = orr.getContext('2d'), W = orr.width, H = orr.height, def = S.def, P = SJ().place(def, SJ().worldT(g));
    X.fillStyle = '#050914'; X.fillRect(0, 0, W, H);
    const pl = def.bodies.filter(b => b.planet), amin = Math.min(...pl.map(b => b.orbit.a)), amax = Math.max(...pl.map(b => b.orbit.a));
    const rOf = (a) => 14 + (Math.log(a / amin) / Math.max(0.3, Math.log(amax / amin))) * (Math.min(W, H) / 2 - 22);
    const cx = W / 2, cy = H / 2, c0 = P[def.bodies[0].id];
    X.fillStyle = def.star.color; X.beginPath(); X.arc(cx, cy, 6, 0, Math.PI * 2); X.fill();
    if (def.star2) { X.fillStyle = def.star2.color; X.beginPath(); X.arc(cx + 9, cy - 3, 3, 0, Math.PI * 2); X.fill(); }
    for (const b of pl) {
      const r = rOf(b.orbit.a), p = P[b.id], ang = Math.atan2(p[2] - c0[2], p[0] - c0[0]);
      X.strokeStyle = '#7fd4ff30'; X.lineWidth = 1; X.beginPath(); X.ellipse(cx, cy, r, r * 0.55, 0, 0, Math.PI * 2); X.stroke();
      const x = cx + r * Math.cos(ang), y = cy + r * 0.55 * Math.sin(ang);
      X.fillStyle = b.landable ? '#9affd8' : b.kind === 'giant' ? '#e8c49a' : '#9ab8ff'; X.beginPath(); X.arc(x, y, b.kind === 'giant' ? 4 : 3, 0, Math.PI * 2); X.fill();
      if (S.focus === b) { X.strokeStyle = '#fff'; X.beginPath(); X.arc(x, y, 7, 0, Math.PI * 2); X.stroke(); }
    }
  }

  // ---------------------------------------------------------------- the pause menu and the key
  SM.pauseMenu = function (ui) {
    const g = ui.game, r = ui.root || document;
    let b = r.querySelector('#starMapBtn');
    if (!b) {
      const after = r.querySelector('#pause [data-act="codex"]'); if (!after) return;
      b = document.createElement('button'); b.className = 'btn'; b.id = 'starMapBtn';
      b.onclick = () => { ui.resume(); SM.open(g); };
      after.after(b);
    }
    b.textContent = '🌌 ' + T('g.stars.map');
  };
  // O anywhere in play opens the map (in the cockpit too: the space frame runs inside the play frame)
  const origPlay = VR.Game.prototype.playFrame;
  VR.Game.prototype.playFrame = function (dt) {
    const i = this.input, ui = this.ui;
    if (!M.open && i && ui && !ui.typing && !ui.screen && i.hit && i.hit('KeyO') && !(this.stars && this.stars.on) && !this.photo && !(this.photoCam && this.photoCam.on)) { SM.open(this); return; }
    return origPlay.call(this, dt);
  };
  SM.stats = () => ({ open: M.open, drawMs: +M.drawMs.toFixed(2), draws: M.draws, sel: M.sel, here: M.here, dist: M.dist, labels: M.labels || 0 });
})(VR);
