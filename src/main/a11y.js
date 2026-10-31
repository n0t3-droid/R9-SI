// ============================================================================
// e-access · everyone can play (plan docs/superpowers/plans/2026-10-31-e-access.md; spec waves §6.6, erlebnis §6)
//   · Weniger Bewegung (lessMotion): no shake (flight.js, ascent.js), no head bob (game.js), the wow swing at double
//     speed (wowmoment.js), the star jump as a fade (starjump.js), no glitter strobes (festival.js)
//   · the flash limiter — ALWAYS on: never more than three flashes in any second, whatever schedules them:
//     flash(src, n) asks for n flashes now; pulse(key, v, n) gates a continuous flash curve at its rising edge
//     (a pulse that is refused is clipped to CLIP); countFlashes(series, dt) measures a curve (the test)
//   · markers never by colour alone (MARKERS: each pair that must be told apart differs in shape)
//   · subtitle timing: subDur(text, speed) ≥ 0.06 s a character, ≥ 2.5 s a line, ×0.75–×2 (subSpeed); stretch(tl)
//   · Ein-Hand: 'mouse' (right tap = Aktion, hold right = walk ahead, wheel = hotbar, middle = place) or 'keys'
//     (arrows walk and turn, PageUp / PageDown look, Right Shift jump, Right Ctrl Aktion, . break, , place, [ ] hotbar)
//   · mono audio (the master bus downmixed) · text size (Aa) · high-contrast HUD
//   · gamepad prompts: the device used last decides; glyph(i) draws our own button shapes (no brand icons)
//   · the session gate lives in src/shared/sessionstats.js (SS.gate), the release lane in test/regress.sh
// Pure parts are tested in node (test/a11y.js, test/gamepad.js). Cost 🟢: a 4 Hz DOM timer, a ring of 8 numbers.
// ============================================================================
(function (VR) {
  'use strict';
  const A = VR.A11y = VR.A11y || {};
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const game = () => VR.game || null;
  const lang = () => (VR.I18N && VR.I18N.lang === 'en' ? 'en' : 'de');
  const tx = (k, v, de, en) => (VR.I18N && VR.I18N.tx ? VR.I18N.tx(k, v, de, en) : de);
  const nowS = () => (typeof performance !== 'undefined' && performance.now ? performance.now() / 1000 : Date.now() / 1000);
  A.now = nowS;

  // ---------------------------------------------------------------- the settings
  A.ROWS = [
    { key: 'lessMotion', g: 'play', sec: 'access', t: 'switch', lab: 'g.a11y.less', tip: 'g.a11y.less.tip', cost: 'low', def: false },
    { key: 'oneHand', g: 'play', sec: 'access', t: 'choice', lab: 'g.a11y.hand', tip: 'g.a11y.hand.tip', def: 'off', opts: [['off', 'g.a11y.hand.off', 'g.a11y.hand.off.tip'], ['mouse', 'g.a11y.hand.mouse', 'g.a11y.hand.mouse.tip'], ['keys', 'g.a11y.hand.keys', 'g.a11y.hand.keys.tip']] },
    { key: 'subSpeed', g: 'play', sec: 'access', t: 'slider', lab: 'g.a11y.sub', tip: 'g.a11y.sub.tip', def: 1, min: 0.75, max: 2, step: 0.25, fmt: 'pct' },
    { key: 'textSize', g: 'play', sec: 'access', t: 'slider', lab: 'g.a11y.text', tip: 'g.a11y.text.tip', def: 1, min: 1, max: 1.5, step: 0.125, fmt: 'pct' },
    { key: 'highContrast', g: 'play', sec: 'access', t: 'switch', lab: 'g.a11y.hc', tip: 'g.a11y.hc.tip', cost: 'low', def: false },
    { key: 'monoAudio', g: 'snd', sec: 'vol', t: 'switch', lab: 'g.a11y.mono', tip: 'g.a11y.mono.tip', def: false },
  ];
  if (VR.Settings && VR.Settings.add) {
    const SE = VR.Settings.SECTIONS;
    if (SE && SE.play && SE.play.indexOf('access') < 0) SE.play.push('access');
    for (const r of A.ROWS) VR.Settings.add(Object.assign({}, r));
  }
  const S = () => { const g = game(); return (g && g.settings) || {}; };
  A.less = (s) => { const q = s || S(); return !!(q.lessMotion || q.reduceMotion); };

  // ---------------------------------------------------------------- the flash limiter (always on)
  A.FLASH_MAX = 3; A.FLASH_WIN = 1; A.PULSE_HI = 0.25; A.PULSE_LO = 0.1; A.CLIP = 0.06;   // (a refused pulse stays below the 10 % a flash needs)
  class Limiter {
    constructor(max, win) { this.max = max || 3; this.win = win || 1; this.t = new Float64Array(16).fill(-1e9); this.i = 0; this.ok = 0; this.denied = 0; }
    count(now) { let n = 0; for (let k = 0; k < this.t.length; k++) if (this.t[k] > now - this.win) n++; return n; }
    allow(now, n) {
      n = Math.max(1, n | 0);
      if (this.count(now) + n > this.max) { this.denied++; return false; }
      for (let k = 0; k < n; k++) { this.t[this.i] = now; this.i = (this.i + 1) % this.t.length; }
      this.ok++; return true;
    }
    reset() { this.t.fill(-1e9); this.ok = 0; this.denied = 0; }
  }
  A.Limiter = Limiter;
  A.limiter = new Limiter(A.FLASH_MAX, A.FLASH_WIN);
  A.stats = {};   // per source: { ok, denied }
  A.flash = function (src, n, now) {
    const t = now === undefined ? A.now() : now, ok = A.limiter.allow(t, n || 1);
    const s = A.stats[src] || (A.stats[src] = { ok: 0, denied: 0 }); if (ok) s.ok++; else s.denied++;
    return ok;
  };
  // a continuous curve (0..1): its rising edge asks the limiter; a refused pulse stays at most PULSE_LO until it falls
  const PS = {};
  A.pulse = function (key, v, n, now) {
    const st = PS[key] || (PS[key] = { on: false, ok: true });
    if (!st.on && v > A.PULSE_HI) { st.on = true; st.ok = A.flash(key, n || 1, now); }
    else if (st.on && v < A.PULSE_LO) st.on = false;
    return st.on && !st.ok ? Math.min(v, A.CLIP) : v;
  };
  A.pulseReset = () => { for (const k in PS) delete PS[k]; };
  // the most flashes in any window of win seconds of a sampled curve (values 0..1, a sample every dt seconds): a
  // flash is a pair of opposing changes of ≥ 0.1 where the darker side is below 0.8 (the general-flash rule)
  A.countFlashes = function (series, dt, win) {
    win = win || 1;
    const turns = [];   // the times a swing of ≥ 0.1 completed
    let hi = series[0] || 0, lo = hi, dir = 0;
    for (let i = 1; i < series.length; i++) {
      const v = series[i];
      if (v > hi) hi = v; if (v < lo) lo = v;
      if (dir >= 0 && hi - v >= 0.1 && v < 0.8) { turns.push(i * dt); dir = -1; lo = v; hi = v; }
      else if (dir <= 0 && v - lo >= 0.1 && lo < 0.8) { turns.push(i * dt); dir = 1; hi = v; lo = v; }
    }
    let best = 0;
    for (let a = 0, b = 0; b < turns.length; b++) { while (turns[b] - turns[a] >= win) a++; best = Math.max(best, b - a + 1); }
    return Math.ceil(best / 2);
  };

  // ---------------------------------------------------------------- markers: a shape as well as a colour
  // groups: the markers a player must tell apart; each differs from the others of its group in shape
  A.MARKERS = [
    { id: 'quest.offer', group: 'quest', colour: '#ffd166', shape: 'star5', where: 'quests.js quest_star' },
    { id: 'quest.ready', group: 'quest', colour: '#7cf3ff', shape: 'star4', where: 'quests.js quest_star_c' },
    { id: 'outpost.disturbed', group: 'outpost', colour: '#c06bff', shape: 'diamond-bang', where: 'rpg_boss2.js drawMap' },
    { id: 'outpost.free', group: 'outpost', colour: '#7ff6ff', shape: 'diamond-check', where: 'rpg_boss2.js drawMap' },
    { id: 'boss.ready', group: 'boss', colour: '#ff5ea8', shape: 'hex-bar', where: 'rpg_boss2.js drawMap' },
    { id: 'boss.won', group: 'boss', colour: '#ffd76a', shape: 'hex-check', where: 'rpg_boss2.js drawMap' },
    { id: 'foe.hostile', group: 'foe', colour: '#ff29cc', shape: 'ring-pulse', where: 'foes.js A11y.foeRing' },
    { id: 'foe.calm', group: 'foe', colour: '#47ff75', shape: 'none', where: 'foes.js (no ring)' },
    { id: 'beacon.disturbed', group: 'beacon', colour: '#ff40cc', shape: 'beam-short-flicker', where: 'liberate.js drawBeacons' },
    { id: 'beacon.free', group: 'beacon', colour: '#40d8ff', shape: 'beam-tall-ring', where: 'liberate.js drawBeacons' },
  ];
  // deuteranopia (Machado, Oliveira & Fernandes 2009, severity 1) on linear RGB; in and out 0..1 sRGB
  A.DEUTAN = [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]];
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const srgb = (c) => { c = clamp(c, 0, 1); return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; };
  A.simDeutan = function (rgb) {
    const l = rgb.map(lin), M = A.DEUTAN;
    return M.map(r => srgb(r[0] * l[0] + r[1] * l[1] + r[2] * l[2]));
  };
  A.hexRgb = (h) => { const n = parseInt(String(h).replace('#', ''), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };

  // the weak point's ring (foes.js F.draw calls it after the machine): a hostile machine within 24 m shows a ring of
  // its own colour round its weak point, breathing at 0.8 Hz (soft: never a flash); calm, a Helfer, down: no ring
  A.RING_D = 24; A.RING_HZ = 0.8;
  const RING_PART = { back: 'core', core: 'core', joint: 'core', eye: 'optic' };
  A.ringPart = (K) => (K && K.fam !== 'shadow' ? RING_PART[K.weak] || null : null);
  A.ringOn = (f, K, d2) => !!f && !f.helper && !(f.st in { calm: 1, helper: 1, down: 1, leave: 1 }) && !!A.ringPart(K) && d2 < A.RING_D * A.RING_D;
  A.ringK = (t) => 0.75 + 0.25 * Math.sin(t * 2 * Math.PI * A.RING_HZ);
  const RT = [0, 0, 0], RL = [0, 0, 0];
  A.foeRing = function (r, p, m, model, B, cam, time, part, opt) {
    const f = m.foe, K = VR.Foes && VR.Foes.KINDS && f ? VR.Foes.KINDS[f.k] : null;
    const dx = cam.x - m.pos[0], dz = cam.z - m.pos[2];
    if (!A.ringOn(f, K, dx * dx + dz * dz)) return false;
    const ring = VR.getVoxModel && VR.getVoxModel(r.gl, 'a11y_ring'); if (!ring || !ring.parts.ring) return false;
    const pn = A.ringPart(K), lay = model.def.layout[pn]; if (!lay) return false;
    RL[0] = lay[0]; RL[1] = lay[1]; RL[2] = lay[2];
    const k = A.ringK(time || 0) * 1.5;
    RT[0] = Math.max(0.5, opt ? opt[0] : 1) * k; RT[1] = (opt ? opt[1] : 0.2) * k; RT[2] = Math.max(0.5, opt ? opt[2] : 0.8) * k;
    part(r, p, ring, 'ring', B, RL, 0, Math.atan2(dx, dz) - m.yaw, 0, RT, 0);
    A.ringDraws = (A.ringDraws || 0) + 1;
    return true;
  };
  if (VR.VOXMODELS && VR.VoxGrid) {
    const Grid = VR.VoxGrid;
    VR.VOXMODELS.a11y_ring = () => {
      const gr = new Grid(17, 17, 1, 8, 8, 0);
      for (let y = 0; y < 17; y++) for (let x = 0; x < 17; x++) { const d = Math.hypot(x - 8, y - 8); if (d > 6.6 && d < 8.4) gr.set(x, y, 0, 0xffffff, 1); }
      return { unit: 16, radius: 0.6, parts: { ring: { grid: gr, pivot: [0, 0, 0] } }, layout: { ring: [0, 0, 0] } };
    };
  }

  // ---------------------------------------------------------------- subtitles
  A.SUB_CHAR = 0.06; A.SUB_LINE = 2.5;
  A.subK = (s) => { const v = +((s || S()).subSpeed); return Number.isFinite(v) && v > 0 ? clamp(v, 0.75, 2) : 1; };
  A.subDur = (text, k) => (k === undefined ? 1 : clamp(+k || 1, 0.75, 2)) * Math.max(A.SUB_LINE, A.SUB_CHAR * String(text || '').length);
  // a scene's timeline {len, lines: [{i, t0, t1}]} stretched so every line lasts its time; later lines move on, the
  // scene grows (its last shot holds)
  A.stretch = function (tl, texts, k) {
    if (!tl || !Array.isArray(tl.lines)) return tl;
    let shift = 0;
    for (const q of tl.lines) {
      q.t0 += shift; q.t1 += shift;
      const need = A.subDur(texts ? texts[q.i] : '', k);
      if (q.t1 - q.t0 < need) { shift += need - (q.t1 - q.t0); q.t1 = q.t0 + need; }
    }
    const last = tl.lines.length ? tl.lines[tl.lines.length - 1].t1 : 0;
    if (last + 0.6 > tl.len) tl.len = last + 0.6;
    return tl;
  };
  A.hintMs = (text, ms, k) => (ms ? Math.max(ms, Math.round(A.subDur(text, k) * 1000)) : ms);

  // ---------------------------------------------------------------- Ein-Hand
  A.HOLD_S = 0.35;
  // the keyboard preset: everything round the arrows (the second slot keeps the usual key)
  A.ONEHAND_KEYS = {
    fwd: ['ArrowUp', 'KeyW'], back: ['ArrowDown', 'KeyS'], turnL: ['ArrowLeft', ''], turnR: ['ArrowRight', ''],
    jump: ['ShiftRight', 'Space'], sneak: ['ShiftLeft', ''], veh: ['ControlRight', 'KeyV'], sprint: ['ControlLeft', ''],
    inv: ['Quote', 'KeyE'], map: ['Semicolon', 'KeyM'],
  };
  A.ONEHAND_EXTRA = { brk: 'Period', plc: 'Comma', lookUp: 'PageUp', lookDown: 'PageDown', prev: 'BracketLeft', next: 'BracketRight' };
  A.presetBindings = function (mode) {
    const B = VR.Binds; if (!B) return null;
    const b = B.Bindings.fromJSON(B.current ? B.current.toJSON() : null);
    if (mode !== 'keys') return b;
    for (const id in A.ONEHAND_KEYS) { const v = A.ONEHAND_KEYS[id]; b.m[id] = v.slice(); }
    return b;
  };
  A.handMode = (s) => { const v = (s || S()).oneHand; return v === 'mouse' || v === 'keys' ? v : 'off'; };
  let handApplied = 'off', handSaved = null;
  A.applyHand = function (mode) {
    const B = VR.Binds; if (!B || mode === handApplied) return;
    if (mode === 'keys') { handSaved = B.current; B.current = A.presetBindings('keys'); }
    else if (handApplied === 'keys') { B.current = handSaved || B.read(); handSaved = null; }
    handApplied = mode;
  };
  // once a frame (input.js beginFrame): the pad decides the device; the one-hand modes translate the mouse / keys
  const HS = { r: false, t0: 0, walk: false };
  A.inputFrame = function (inp, dt, mode) {
    const pad = inp.pad;
    if (pad && pad.connected && (pad.buttons.some(Boolean) || Math.hypot(pad.move[0], pad.move[1]) > 0.3 || Math.hypot(pad.look[0], pad.look[1]) > 0.3)) A.setDevice('pad');
    const m = mode || A.handMode();
    const M = inp.mouse;
    if (m === 'mouse' && !inp.menuOpen) {
      const was = HS.r, now = was ? !M.releasedBtn[2] || M.down[2] : (M.clicked[2] || M.down[2]);
      if (now && !was) { HS.r = true; HS.t0 = 0; HS.walk = false; }
      if (HS.r) HS.t0 += dt || 0;
      if (now && HS.t0 >= A.HOLD_S) HS.walk = true;
      if (HS.walk && now) inp.padDown.add('fwd');
      if (was && !now) { if (!HS.walk) inp.padPressed.add('veh'); HS.r = false; HS.walk = false; }
      // the right button is the Aktion now: the middle one places
      M.down[2] = !!M.down[1]; M.clicked[2] = !!M.clicked[1]; M.releasedBtn[2] = !!M.releasedBtn[1];
      M.down[1] = false; M.clicked[1] = false; M.releasedBtn[1] = false;
    } else if (HS.r) { HS.r = false; HS.walk = false; }
    if (m === 'keys' && !inp.menuOpen) {
      const E = A.ONEHAND_EXTRA, K = inp.keys, P = inp.pressed;
      if (K.has(E.brk)) { if (P.has(E.brk)) M.clicked[0] = true; M.down[0] = true; } else if (inp.released.has(E.brk)) { M.down[0] = false; M.releasedBtn[0] = true; }
      if (K.has(E.plc)) { if (P.has(E.plc)) M.clicked[2] = true; M.down[2] = true; } else if (inp.released.has(E.plc)) { M.down[2] = false; M.releasedBtn[2] = true; }
      const k = clamp(dt || 0.016, 0, 0.1) * 700;
      if (K.has(E.lookUp)) M.dy -= k; if (K.has(E.lookDown)) M.dy += k;
      if (P.has(E.prev)) M.wheel -= 1; if (P.has(E.next)) M.wheel += 1;
    }
  };
  A.handState = HS;

  // ---------------------------------------------------------------- mono
  A.applyMono = function (au, on) {
    if (!au || !au.ctx || !au.monoNode) return false;
    const n = au.monoNode;
    try { n.channelCount = on ? 1 : 2; n.channelCountMode = 'explicit'; n.channelInterpretation = 'speakers'; } catch (e) { return false; }
    au.mono = !!on; return true;
  };

  // ---------------------------------------------------------------- the device and the pad's glyphs
  A.device = 'kb';
  const devL = [];
  A.onDevice = (f) => devL.push(f);
  A.setDevice = function (d) { if (d === A.device) return; A.device = d; for (const f of devL) { try { f(d); } catch (e) { /* */ } } };
  A.padMode = () => A.device === 'pad';
  // the button of the standard layout for an action, a strip row or a mouse role (null: the pad has none)
  A.PAD_OF = { jump: 0, up: 0, fly: 0, sneak: 1, down: 1, back: 1, veh: 2, inv: 3, build: 3, prev: 4, next: 5, place: 6, brk: 7, map: 8, menu: 9, sprint: 10, cam: 11, undo: 13 };
  A.padOf = (id) => (Object.prototype.hasOwnProperty.call(A.PAD_OF, id) ? A.PAD_OF[id] : null);
  const NAMES = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Start', 'L3', 'R3', '↑', '↓', '←', '→'];
  A.padName = (i, l) => (i === 8 ? (l === 'en' ? 'View' : 'Ansicht') : i === 9 ? (l === 'en' ? 'Menu' : 'Menü') : NAMES[i] || '?');
  // our own shapes: four round face buttons, each with a notch at its place in the diamond (south · east · west ·
  // north) and its letter; bumpers, triggers, sticks, the D-pad's cross with the pressed arm lit, two small pills
  const INK = '#f2f5fb', BODY = '#151a26';
  const svg = (w, h, body, i) => `<svg class="a11y-g" data-b="${i}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${A.padName(i, lang())}">${body}</svg>`;
  const txt = (x, y, s, fs) => `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-family="sans-serif" font-weight="700" font-size="${fs || 10}" fill="${INK}">${s}</text>`;
  A.glyph = function (i) {
    if (i === null || i === undefined || i < 0 || i > 15) return '';
    if (i <= 3) {
      const N = [[11, 18.6], [18.6, 11], [3.4, 11], [11, 3.4]][i];
      return svg(22, 22, `<circle cx="11" cy="11" r="9.6" fill="${BODY}" stroke="${INK}" stroke-width="1.6"/><circle cx="${N[0]}" cy="${N[1]}" r="1.7" fill="${INK}"/>` + txt(11, 11.2, NAMES[i], 10.5), i);
    }
    if (i === 4 || i === 5) return svg(30, 18, `<path d="M3 15 L3 8 Q3 3 9 3 L21 3 Q27 3 27 8 L27 15 Z" fill="${BODY}" stroke="${INK}" stroke-width="1.5"/>` + txt(15, 9.6, NAMES[i], 9), i);
    if (i === 6 || i === 7) return svg(26, 22, `<path d="M4 20 L4 10 Q4 2 13 2 Q22 2 22 10 L22 20 Z" fill="${BODY}" stroke="${INK}" stroke-width="1.5"/>` + txt(13, 12.5, NAMES[i], 9), i);
    if (i === 8) return svg(28, 18, `<rect x="1.5" y="2" width="25" height="14" rx="7" fill="${BODY}" stroke="${INK}" stroke-width="1.4"/><rect x="9" y="5.5" width="7" height="5.5" fill="none" stroke="${INK}" stroke-width="1.2"/><rect x="12" y="7.5" width="7" height="5.5" fill="${BODY}" stroke="${INK}" stroke-width="1.2"/>`, i);
    if (i === 9) return svg(28, 18, `<rect x="1.5" y="2" width="25" height="14" rx="7" fill="${BODY}" stroke="${INK}" stroke-width="1.4"/><path d="M9 6.2 H19 M9 9 H19 M9 11.8 H19" stroke="${INK}" stroke-width="1.4"/>`, i);
    if (i === 10 || i === 11) return svg(22, 22, `<circle cx="11" cy="11" r="9.6" fill="${BODY}" stroke="${INK}" stroke-width="1.4"/><circle cx="11" cy="11" r="5.6" fill="none" stroke="${INK}" stroke-width="1.2"/>` + txt(11, 11.2, i === 10 ? 'L' : 'R', 8), i);
    const arm = { 12: 'M8.5 2 h5 v6.5 h-5 Z', 13: 'M8.5 13.5 h5 V20 h-5 Z', 14: 'M2 8.5 h6.5 v5 H2 Z', 15: 'M13.5 8.5 H20 v5 h-6.5 Z' }[i];
    return svg(22, 22, `<path d="M8 1.5 h6 v6.5 h6.5 v6 H14 v6.5 H8 V14 H1.5 V8 H8 Z" fill="${BODY}" stroke="${INK}" stroke-width="1.4"/><path d="${arm}" fill="${INK}"/>`, i);
  };
  // the prompt key for an action: a glyph (HTML) with a pad, the key's name as text without
  A.keyHtml = function (id, code) {
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    if (A.padMode()) { const b = A.padOf(id); if (b !== null) return A.glyph(b); }
    const B = VR.Binds; return esc(B ? B.label(code, lang()) : code);
  };

  // ---------------------------------------------------------------- the key names the game polls: all bindable
  // keys of a viewer (the Zeitraffer's replay is a player of its own) and of the menus are not game actions
  A.VIEWER_KEYS = { Equal: 'zeitraffer', NumpadAdd: 'zeitraffer', BracketRight: 'zeitraffer', Minus: 'zeitraffer', NumpadSubtract: 'zeitraffer', Home: 'zeitraffer', End: 'zeitraffer', ArrowUp: 'menus', ArrowDown: 'menus', Digit: 'hotbar (prefix)' };

  // ---------------------------------------------------------------- the page: classes, the CSS, the timer
  const hasDoc = typeof document !== 'undefined' && !!document.createElement && !!document.head;
  A.CSS = [
    ':root{--a11y-text:1}',
    'html.a11y-text #hint,html.a11y-text #ctxprompt,html.a11y-text #storybox .sub,html.a11y-text #keystrip,html.a11y-text #hints,html.a11y-text #toasts,html.a11y-text #itemname,html.a11y-text #chat{zoom:var(--a11y-text)}',
    // high contrast: solid dark plates, white ink, a 2-px outline; the crosshair drawn black-on-white
    'html.a11y-hc #hint,html.a11y-hc #ctxprompt,html.a11y-hc #keystrip .ks,html.a11y-hc #hints .hint,html.a11y-hc #storybox .sub,html.a11y-hc #itemname,html.a11y-hc .toast{background:#000 !important;color:#fff !important;outline:2px solid #fff;outline-offset:0;text-shadow:none !important;box-shadow:none !important;opacity:1}',
    'html.a11y-hc #hotbar{background:#000 !important;outline:2px solid #fff}',
    'html.a11y-hc #hotbar .slot,html.a11y-hc #hotbar > div{border-color:#fff !important}',
    'html.a11y-hc #hotbar .slot.sel,html.a11y-hc #hotbar .sel{outline:3px solid #ffe600;outline-offset:1px}',
    'html.a11y-hc #crosshair{filter:drop-shadow(0 0 0 #000) drop-shadow(1px 1px 0 #000) drop-shadow(-1px -1px 0 #000)}',
    'html.a11y-hc #keystrip kbd,html.a11y-hc #ctxprompt b{background:#fff !important;color:#000 !important}',
    'html.a11y-hc #stats,html.a11y-hc #compass,html.a11y-hc #minimap{outline:2px solid #fff;background:#000}',
    // the pad's glyphs in the prompts
    '.a11y-g{display:inline-block;vertical-align:middle;filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.6))}',
    '#keystrip kbd.pad,#ctxprompt b.pad{background:none !important;border:0 !important;padding:0 !important;box-shadow:none !important;min-width:0}',
    '#a11ybump{position:absolute;pointer-events:none;display:none;z-index:5}',
    '#a11ybump.on{display:block}#a11ybump .l,#a11ybump .r{position:absolute;top:0}',
    'html.a11y-hc .a11y-g{filter:none}',
  ].join('\n');
  let cssOn = false, bump = null;
  function css() { if (cssOn || !hasDoc) return; cssOn = true; const s = document.createElement('style'); s.id = 'a11ycss'; s.textContent = A.CSS; document.head.appendChild(s); }
  const applied = { text: null, hc: null, pad: null, mono: null };
  A.applyPage = function (s) {
    if (!hasDoc) return;
    css();
    const de = document.documentElement, t = clamp(+s.textSize || 1, 1, 1.5);
    if (applied.text !== t) { applied.text = t; de.style.setProperty('--a11y-text', String(t)); de.classList.toggle('a11y-text', t > 1); }
    const hc = !!s.highContrast; if (applied.hc !== hc) { applied.hc = hc; de.classList.toggle('a11y-hc', hc); }
    const pad = A.padMode(); if (applied.pad !== pad) { applied.pad = pad; de.classList.toggle('a11y-pad', pad); }
    de.classList.toggle('a11y-less', A.less(s));
  };
  // LB / RB beside the hotbar while a pad is in use
  function bumpers(g) {
    const hb = document.getElementById('hotbar'); if (!hb) return;
    if (!bump || !bump.isConnected) {
      bump = document.createElement('div'); bump.id = 'a11ybump';
      bump.innerHTML = '<span class="l">' + A.glyph(4) + '</span><span class="r">' + A.glyph(5) + '</span>';
      (hb.parentNode || document.body).appendChild(bump);
    }
    const on = A.padMode() && g.state === 'play' && !(g.ui && g.ui.screen) && hb.offsetWidth > 0;
    bump.classList.toggle('on', on);
    if (on) { const r = hb.getBoundingClientRect(), pr = (hb.offsetParent || document.body).getBoundingClientRect(); bump.style.left = (r.left - pr.left - 36) + 'px'; bump.style.top = (r.top - pr.top + r.height / 2 - 9) + 'px'; bump.style.width = (r.width + 72) + 'px'; bump.querySelector('.r').style.left = (r.width + 42) + 'px'; }
  }
  A.tick = function () {
    const g = game(); if (!g || !g.settings) return;
    const s = g.settings;
    try { A.applyPage(s); } catch (e) { /* */ }
    try { A.applyHand(A.handMode(s)); } catch (e) { /* */ }
    const mono = !!s.monoAudio; if (g.audio && g.audio.monoNode && applied.mono !== mono) { if (A.applyMono(g.audio, mono)) applied.mono = mono; }
    try { if (hasDoc) bumpers(g); } catch (e) { /* */ }
  };
  if (hasDoc && typeof window !== 'undefined' && window.addEventListener && typeof setInterval === 'function') {
    let mv = 0;
    window.addEventListener('keydown', () => A.setDevice('kb'), true);
    window.addEventListener('mousedown', () => A.setDevice('kb'), true);
    window.addEventListener('mousemove', (e) => { mv += Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0); if (mv > 24) { mv = 0; A.setDevice('kb'); } }, true);
    setInterval(A.tick, 250);
  }

  // ---------------------------------------------------------------- hooks into the UI (wrapped: no other file grows)
  const UI = VR.UI;
  if (UI && UI.prototype.hint && !UI.prototype.hint.__a11y) {
    const oh = UI.prototype.hint;
    UI.prototype.hint = function (text, ms) { return oh.call(this, text, text ? A.hintMs(text, ms, A.subK()) : ms); };
    UI.prototype.hint.__a11y = true;
  }
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
