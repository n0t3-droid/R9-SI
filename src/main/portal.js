// ============================================================================
// e-portal · VR.Portal — the Leuchtpfad in the game (docs/superpowers/plans/2026-10-31-e-portal.md; the rules in
// portal_core.js, the film in portal_film.js):
//   · the gates: stand a moment in the Gate Temple's portal veil (or a station's, or the gate's glow) and the picker
//     opens; also 🌍 Reisen in the pause menu and holding K (K is the convoy wheel only in a multiplayer session)
//   · the picker: 🎲 Überrasch mich, home, your ★ spots, every world (locked ones shown, with how to open them), a live
//     postcard on each card, ★ on a world, ★ Diesen Ort merken for where you stand
//   · the journey: a 10–15 s film you watch (skippable after 2 s); under it VR.Travel.go({via: 'portal'}) loads the
//     world (a-konvoi's rules for a host with guests); the film ends in a sweeping reveal, a caption (the name, a
//     story hook) and, on the first gate arrival at a world, a tiny episode of „Funke und die Leuchtfeuer". No chat
//     lines: the caption fades by itself.
//   · fast flight (Kreativ, single-player): ×1 … ×8 — the mouse wheel while flying fast (sprint) or the slider in ⚙
//     Spiel › Steuerung; a gentle FOV widening and wind at speed; the soft cap when the land can't keep up; ×1 in
//     multiplayer (host or guest), Überleben and Abenteuer.
// Cost: idle, two block looks a frame (no allocation); the picker draws its postcards at 8 fps; the film is a 2D canvas
// at 0.75 of the screen (Very Low 0.4, fewer particles) while the 3D world is mostly not drawn (the trip's veil).
// Test hooks: VR.Portal.open(g) · go(g, dest, {dry}) · seek(t) · play() · stats() · places(g) · close().
// ============================================================================
(function (VR) {
  'use strict';
  const C = VR.PortalCore, F = VR.PortalFilm, D = VR.DimReg;
  if (!C || !F || !D || !VR.Game) return;
  const T = (k, v) => (VR.I18N ? VR.I18N.t(k, v) : k);
  const now = () => performance.now();
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const ease = (t) => t * t * (3 - 2 * t);
  const doc = typeof document !== 'undefined' && document.createElement ? document : null;
  const Portal = VR.Portal = { GATE_S: 1.0, HOLD_K: 0.5, SKIP_AFTER: 2, REVEAL: 3.2 };
  const M = { pick: null, J: null, cap: null, gateT: 0, armed: true, kT: 0, fly: { lastSet: null, slow: 0, fov: 0, wind: null, k: 0, pill: null, pillT: 0, capped: false }, drawMs: 0, draws: 0, maxMs: 0, padSt: { held: false }, skipReq: false };

  // ---------------------------------------------------------------- facts
  const ctxOf = (g) => {
    const p = g && g.player, mp = g && g.mp;
    return {
      creative: !!(p && p.mode !== 'survival'),
      adventure: !!(VR.Adventure && VR.Adventure.on && VR.Adventure.on()),
      guest: !!(g && g.meta && g.meta.guest) || !!(mp && (mp.role === 'client' || mp.role === 'joining')),
      mp: !!(mp && mp.role === 'host'),
    };
  };
  Portal.ctx = ctxOf;
  const low = (g) => !!(g && g.settings && g.settings.preset === 'potato');
  const palOf = (dim) => { const d = dim && D.get(dim); return (d && d.veil) || ['#ffffff', '#c8d8ff', '#202850']; };
  const dimName = (dim) => (VR.Travel ? VR.Travel.dimName(dim) : dim);
  const stationDims = () => { const S = VR.Stations; return S && S.IDS ? S.IDS.map((id) => S.LIST[id].dim).filter((d) => D.has(d)) : []; };
  const nameOf = (q, rec) => {
    if (!q) return '';
    if (q.id === 'surprise') return T('g.pt.surprise');
    if (q.fav) { if (q.name) return q.name; const same = rec.favs.filter((f) => f.at && f.dim === q.dim).reverse(); return T('g.pt.favSpot', { world: dimName(q.dim), n: same.findIndex((f) => f.id === q.id) + 1 }); }
    return dimName(q.dim);
  };
  const seedOf = (g) => ((g && g.meta && g.meta.seed) | 0) ^ ((now() * 1000) | 0);
  Portal.places = (g) => C.places(ctxOf(g), g.meta, g.dim, { stations: stationDims() });
  Portal.busy = () => !!(M.pick || M.J);
  Portal.holds = (g) => !!(M.J && M.J.g === g && !M.J.dry);

  // ---------------------------------------------------------------- the look
  let styled = false;
  function style() {
    if (styled || !doc) return; styled = true;
    const s = doc.createElement('style');
    s.textContent = [
      '#ptPick{position:fixed;inset:0;z-index:880;display:none;align-items:center;justify-content:center;background:radial-gradient(ellipse at 50% 40%,rgba(30,24,70,.55),rgba(4,6,18,.82));backdrop-filter:blur(3px)}',
      '#ptPick .pt-box{width:min(1040px,96vw);max-height:92vh;overflow:auto;padding:18px 20px;border-radius:18px;background:rgba(12,14,34,.78);border:1px solid rgba(255,214,140,.28);box-shadow:0 20px 70px rgba(0,0,0,.5)}',
      '#ptPick h2{margin:0;font:800 clamp(20px,2.6vw,30px) var(--display,sans-serif);color:#ffe2a8;letter-spacing:1px}',
      '#ptPick .pt-sub{margin:4px 0 14px;font:500 14px var(--font,sans-serif);color:rgba(230,236,255,.75)}',
      '#ptPick .pt-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(176px,1fr));gap:12px}',
      '#ptPick .pt-card{position:relative;display:flex;flex-direction:column;align-items:stretch;padding:0;border-radius:12px;overflow:hidden;cursor:pointer;background:#141832;border:1px solid rgba(255,255,255,.12);color:#fff;text-align:left;font:inherit;transition:transform .15s,box-shadow .15s,border-color .15s}',
      '#ptPick .pt-card:hover,#ptPick .pt-card:focus-visible{transform:translateY(-3px);border-color:rgba(255,214,140,.8);box-shadow:0 8px 26px rgba(255,190,90,.25);outline:none}',
      '#ptPick .pt-card canvas{display:block;width:100%;aspect-ratio:16/9;height:auto}',
      '#ptPick .pt-card .pt-n{padding:7px 10px 1px;font:700 15px var(--font,sans-serif)}',
      '#ptPick .pt-card .pt-k{padding:0 10px 8px;font:500 12px var(--font,sans-serif);color:rgba(220,228,255,.7)}',
      '#ptPick .pt-card.locked{cursor:default;filter:grayscale(.75) brightness(.7)}#ptPick .pt-card.locked:hover{transform:none;box-shadow:none;border-color:rgba(255,255,255,.12)}',
      '#ptPick .pt-card.here{border-color:rgba(140,230,255,.55)}',
      '#ptPick .pt-star{position:absolute;top:6px;right:6px;width:28px;height:28px;border-radius:14px;border:0;background:rgba(0,0,0,.4);color:#ffd166;font-size:16px;cursor:pointer;line-height:28px;padding:0}',
      '#ptPick .pt-foot{display:flex;gap:10px;justify-content:space-between;margin-top:14px;flex-wrap:wrap}',
      '#ptFilm{position:fixed;inset:0;width:100vw;height:100vh;z-index:900;display:none;pointer-events:auto;image-rendering:auto}',
      '#ptSkip{position:fixed;right:18px;bottom:calc(8.5vh + 10px);z-index:901;display:none;font:600 12px var(--font,sans-serif);color:rgba(255,255,255,.55);letter-spacing:1px}',
      '#ptCap{position:fixed;left:50%;bottom:15vh;transform:translateX(-50%);z-index:905;pointer-events:none;text-align:center;opacity:0;transition:opacity .8s ease;max-width:min(860px,92vw)}',
      '#ptCap .pt-cn{font:800 clamp(30px,5vw,58px)/1.05 var(--display,sans-serif);color:#fff;letter-spacing:2px;text-shadow:0 0 28px rgba(255,220,160,.55),0 2px 0 rgba(10,8,30,.4)}',
      '#ptCap .pt-ck{margin-top:4px;font:700 13px var(--font,sans-serif);letter-spacing:3px;text-transform:uppercase;color:rgba(255,226,168,.9)}',
      '#ptCap .pt-ch{margin-top:10px;font:italic 500 clamp(15px,1.7vw,19px) var(--font,sans-serif);color:rgba(255,255,255,.95);text-shadow:0 1px 8px rgba(0,0,0,.6)}',
      '#ptCap .pt-ce{margin-top:14px;font:500 clamp(14px,1.5vw,17px) var(--font,sans-serif);color:#fff;text-shadow:0 1px 8px rgba(0,0,0,.7);min-height:1.4em;transition:opacity .4s}',
      '#ptCap .pt-ce b{color:#ffd166}',
      '#ptRing{position:fixed;left:50%;top:50%;width:64px;height:64px;margin:-32px 0 0 -32px;z-index:870;pointer-events:none;border-radius:50%;opacity:0;box-shadow:0 0 0 2px rgba(255,214,140,.9),0 0 30px rgba(255,190,90,.6);transition:opacity .2s}',
      'html.pt-gl #ui,html.pt-gl #ui *,html.pt-gl #app>*:not(#gl):not(#ptFilm):not(#ptSkip):not(#ptCap),html.pt-gl body>*:not(#app),html.pt-gl body>*:not(#app) *{visibility:hidden !important}',   // (e-portal2: a 3-D shot shows through the film's canvas — nothing of the HUD over it)
      'html.pt-on #ctxprompt,html.pt-on #keystrip,html.pt-on #hints,html.pt-on #hint,html.pt-on #toasts{visibility:hidden !important}',   // (a film's moment: no prompts, hints or toasts over it)
      '#ptFly{position:fixed;left:50%;bottom:120px;transform:translateX(-50%);z-index:860;pointer-events:none;padding:4px 12px;border-radius:12px;background:rgba(8,10,26,.55);color:#ffe2a8;font:700 14px var(--font,sans-serif);opacity:0;transition:opacity .4s}',
    ].join('\n');
    doc.head.appendChild(s);
  }
  const el = (tag, cls, txt) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
  const host = () => doc.getElementById('app') || doc.body;

  // ---------------------------------------------------------------- the picker
  Portal.open = function (g, via) {
    if (!doc || !g || g.state !== 'play' || M.J || M.pick) return false;
    const ctx = ctxOf(g);
    if (ctx.guest) { if (g.ui && g.ui.hint) g.ui.hint(T('g.pt.guest'), 2200); return false; }
    if (VR.Travel && VR.Travel.busy(g)) return false;
    style();
    let root = doc.getElementById('ptPick');
    if (!root) { root = el('div'); root.id = 'ptPick'; host().appendChild(root); root.addEventListener('mousedown', (e) => { if (e.target === root) Portal.close(); }); }
    M.pick = { g, root, via: via || 'menu', cards: [], t: 0, last: 0 };
    Portal.prewarm(g);   // (e-portal2: the film's space textures, asked for while you choose)
    build();
    root.style.display = 'flex';
    if (doc.pointerLockElement && doc.exitPointerLock) doc.exitPointerLock();
    if (g.audio && g.audio.play) g.audio.play('portal');
    tickPick();
    return true;
  };
  function build() {
    const K = M.pick, g = K.g, root = K.root, rec = C.rec(g.meta), ctx = ctxOf(g), list = Portal.places(g);
    root.textContent = '';
    const box = el('div', 'pt-box'); root.appendChild(box);
    box.appendChild(el('h2', '', T('g.pt.title')));
    box.appendChild(el('div', 'pt-sub', T(C.free(ctx) ? 'g.pt.sub.free' : 'g.pt.sub.earned')));
    const grid = el('div', 'pt-grid'); box.appendChild(grid);
    K.cards = []; K.list = list;
    const lo = low(g), cw = lo ? 128 : 192, ch = lo ? 72 : 108;
    list.forEach((q, i) => {
      const b = el('button', 'pt-card' + (q.open ? '' : ' locked') + (q.here ? ' here' : '')); b.type = 'button';
      b.setAttribute('data-pt', q.id);
      const cv = el('canvas'); cv.width = cw; cv.height = ch; b.appendChild(cv);
      b.appendChild(el('div', 'pt-n', (q.dim === D.home(g.meta) && !q.fav ? '🏠 ' : '') + nameOf(q, rec)));
      const kind = q.id === 'surprise' ? T('g.pt.surpriseTip') : q.here ? T('g.pt.here') : !q.open ? T('g.pt.locked') : q.fav ? T('g.pt.kind.fav') : T('g.pt.kind.' + q.kind) + (q.star ? ' · ★' : '');
      b.appendChild(el('div', 'pt-k', kind));
      if (!q.open && q.why === 'locked') b.title = T('g.pt.lockedTip');
      if (q.id !== 'surprise' && (q.fav || q.dim !== D.home(g.meta))) {
        const s = el('button', 'pt-star', q.fav || q.star ? '★' : '☆'); s.type = 'button'; s.title = T(q.fav || q.star ? 'g.pt.unfav' : 'g.pt.favWorld');
        s.addEventListener('click', (e) => { e.stopPropagation(); if (q.fav) C.favRemove(rec, q.id); else C.favToggleWorld(rec, q.dim); save(g); build(); });
        b.appendChild(s);
      }
      b.addEventListener('click', () => choose(q));
      grid.appendChild(b);
      K.cards.push({ q, cv, x: cv.getContext('2d'), seed: i * 977 + 13 });
    });
    const foot = el('div', 'pt-foot'); box.appendChild(foot);
    const fav = el('button', 'btn', T('g.pt.favHere')); fav.type = 'button';
    fav.addEventListener('click', () => { const p = g.player; if (!p) return; const f = C.favAdd(rec, { dim: g.dim, at: p.pos, yaw: p.yaw, t: Date.now() }); if (f) { save(g); fav.textContent = T('g.pt.favHereDone', { name: nameOf(Object.assign({ fav: true }, f), rec) }); setTimeout(() => { if (M.pick) build(); }, 900); } });
    foot.appendChild(fav);
    const close = el('button', 'btn', T('g.pt.close')); close.type = 'button'; close.addEventListener('click', () => Portal.close());
    foot.appendChild(close);
  }
  function tickPick() {
    const K = M.pick; if (!K) return;
    const t = now() / 1000;
    if (t - K.last > 0.125) { K.last = t; for (const c of K.cards) { if (!c.x) continue; F.card(c.x, c.cv.width, c.cv.height, c.q.id === 'surprise' ? 'surprise' : c.q.kind, palOf(c.q.dim), t, c.seed); } }
    requestAnimationFrame(tickPick);
  }
  Portal.close = function (resume) {
    const K = M.pick; if (!K) return;
    M.pick = null; K.root.style.display = 'none';
    M.armed = false; M.gateT = 0;
    const g = K.g; if (resume !== false && g && g.ui && !g.ui.screen && g.input) { g.input.captured = true; if (g.input.requestLock) g.input.requestLock(); }
  };
  const save = (g) => { try { if (g.saveMeta) g.saveMeta(); } catch (e) { /* the next save takes it */ } };
  function choose(q) {
    const K = M.pick; if (!K || !q) return;
    const g = K.g, rec = C.rec(g.meta);
    let dest = q;
    if (q.id === 'surprise') dest = C.surprise(K.list, seedOf(g), rec.last, g.dim);
    if (!dest || !dest.open) { if (g.audio && g.audio.play) g.audio.play('deny'); return; }
    Portal.close(true);
    Portal.go(g, dest);
  }
  // K held (as the convoy's wheel reads it, konvoi.js: the raw key; in a session K is the wheel's)
  if (typeof window !== 'undefined' && window.addEventListener) { window.addEventListener('keydown', (e) => { if (e.code === 'KeyK' && !e.repeat) M.kDown = true; }, true); window.addEventListener('keyup', (e) => { if (e.code === 'KeyK') M.kDown = false; }, true); window.addEventListener('blur', () => { M.kDown = false; }); }
  if (doc) doc.addEventListener('keydown', (e) => {
    if (M.pick && e.code === 'Escape') { e.preventDefault(); e.stopPropagation(); Portal.close(); return; }
    if (M.J && !M.J.dry && SKIP_KEYS[e.code]) { e.preventDefault(); e.stopPropagation(); skip(); }
  }, true);
  // e-portal2 (R55-08): the skip always takes — the window's own capture listener too (a screen's listener cannot eat
  // it), the keys and the gamepad read again in the film's frame
  const SKIP_KEYS = { Space: 1, Escape: 1, Enter: 1, NumpadEnter: 1 };
  if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('keydown', (e) => { if (M.J && !M.J.dry && SKIP_KEYS[e.code]) skip(); }, true);

  // ---------------------------------------------------------------- the journey
  // dest: {dim, at?, yaw?, fav?, id?} · o: {dry: the film only (pictures, tests), seed, film: a given film}
  Portal.go = function (g, dest, o) {
    o = o || {};
    if (!doc || !g || !dest || !dest.dim || M.J) return false;
    const rec = C.rec(g.meta), local = dest.dim === g.dim;
    if (!o.dry) {
      const why = C.why(ctxOf(g), g.meta, g.dim, dest);
      if (why) { if (g.ui && g.ui.hint) g.ui.hint(T(why === 'guest' ? 'g.pt.guest' : 'g.pt.lockedTip'), 2200); return false; }
      if (!local && VR.Travel) { const w = VR.Travel.canGo(g, dest.dim); if (w) { if (g.ui && g.ui.hint) g.ui.hint(T(w, { dim: dimName(dest.dim) }), 2200); return false; } }
    }
    style();
    const film = o.film || C.film(rec, (o.seed !== undefined ? o.seed : seedOf(g)) >>> 0, g.dim, dest.dim, { low: low(g) });
    rec.last = dest.id || null;
    const homeBody = palOf(D.home(g.meta));
    const fromBody = C.kindOf(g.dim) === 'deep' || C.kindOf(g.dim) === 'station' ? D.home(g.meta) : g.dim;
    const plan = spacePlan(g, film, g.dim, dest.dim);
    const P = F.make(film, palOf(dest.dim), palOf(g.dim), { air: C.airOf(dest.dim), curveFrom: C.kindOf(g.dim) === 'deep' ? homeBody : palOf(g.dim), to: dest.dim, from: g.dim, fromBody, kind: C.kindOf(dest.dim), gl: spaceDraw(g, plan) });
    let cv = doc.getElementById('ptFilm');
    if (!cv) { cv = el('canvas'); cv.id = 'ptFilm'; host().appendChild(cv); cv.addEventListener('pointerdown', () => skip()); const sk = el('div'); sk.id = 'ptSkip'; host().appendChild(sk); }
    const sc = low(g) ? 0.4 : 0.75;
    cv.width = Math.max(320, Math.round(innerWidth * sc)); cv.height = Math.max(180, Math.round(innerHeight * sc));
    cv.style.display = 'block'; cv.style.opacity = '1'; cv.style.transition = 'none';
    const firstGate = !rec.gated.includes(dest.dim);
    M.J = { g, dest, film, P, cv, x: cv.getContext('2d'), t: 0, t0: now(), last: now(), went: false, arrived: false, local, dry: !!o.dry, paused: false, phase: 'film', rt: 0, firstGate, failed: false, plan, want: false, skipped: false, hour: false };
    M.padSt.held = true; M.keyHeld = true;   // (a button or key held from before is not a skip)
    Portal.prewarm(g);
    if (doc.pointerLockElement && doc.exitPointerLock && o.dry) doc.exitPointerLock();
    if (g.audio && g.audio.play && !o.dry) g.audio.play('portal');
    if (g.audio && g.audio.cue && !o.dry) g.audio.cue('hold');   // (the score makes room: the film has its own swell)
    save(g);
    hush(g);
    if (!o.dry) cinema(true);
    requestAnimationFrame(frame);
    return film;
  };
  // while the film covers the whole screen the 3D world is not drawn (the camera is still set: streaming follows it)
  Portal.covers = () => { const J = M.J; return !!(J && J.phase === 'film' && !J.covered && (J.P.gl || (!J.dry && J.t > J.film.shots[0].dur * 0.85))); };   // (e-portal2: a 3-D shot covers it in a dry film too)
  function hush(g) {
    const r = g && g.renderer; if (!r || r.__ptHush) return;
    const orig = r.render; r.__ptHush = true; r.__ptOrig = orig;   // (e-portal2: the film's space shots draw through the unhushed one)
    r.render = function (F) { if (Portal.covers() && F && F.cam) { if (this.setupCamera) this.setupCamera(F.cam); return; } return orig.apply(this, arguments); };
  }
  // the film's own cost (the test): n frames across a film drawn into a canvas of the preset's size → ms a frame
  Portal.bench = function (film, n, lowP) {
    if (!doc) return 0;
    const c = el('canvas'), sc = lowP ? 0.4 : 0.75; c.width = Math.max(320, Math.round(innerWidth * sc)); c.height = Math.max(180, Math.round(innerHeight * sc));
    const g = VR.game, plan = g ? spacePlan(g, film, film.from, film.to) : null;   // (e-portal2: the 3-D shots counted, at the preset's own tier)
    const x = c.getContext('2d'), P = F.make(Object.assign({}, film, { low: !!lowP }), palOf(film.to), palOf(film.from), { air: C.airOf(film.to), to: film.to, from: film.from, kind: C.kindOf(film.to), gl: plan ? spaceDraw(g, plan) : null });
    if (g && g.renderer) hush(g);
    P.draw(x, c.width, c.height, 0.5);
    const gl = g && g.renderer && g.renderer.gl, sync = () => { x.getImageData(0, 0, 1, 1); if (gl) gl.finish(); };
    sync();
    const t0 = now(); let n3 = 0; for (let i = 0; i < n; i++) { P.draw(x, c.width, c.height, (i + 0.5) / n * P.len); if (P.gl) n3++; } sync();
    if (g && g.renderer) g.renderer.tsrReset = true;
    Portal.bench.n3 = n3;
    return (now() - t0) / n;
  };
  Portal.seek = (t) => { const J = M.J; if (!J) return false; J.t = t; J.paused = true; draw(J); return J.P.shotAt(t); };
  Portal.play = () => { const J = M.J; if (J) { J.paused = false; J.last = now(); } };
  Portal.cancel = () => { const J = M.J; if (!J) return; if (!J.dry && J.went) return; end(J); };
  // e-portal2: a press is never lost — before 2 s it is kept and taken at 2 s; then the film is at its end, and the
  // reveal follows the moment the land is there
  function skip() { const J = M.J; if (!J || J.dry || J.phase !== 'film') return; J.want = true; takeSkip(J); }
  function takeSkip(J) {
    if (!J.want || J.phase !== 'film') return;
    const to = C.skipTo(J.t, J.P.len, Portal.SKIP_AFTER); if (to === null) return;
    J.want = false; J.skipped = true; J.t = Math.max(J.t, to);
  }
  // the film's space shots (VR.PortalSpace): the plan at the world's clock, the draw through the real renderer
  function spacePlan(g, film, from, to) {
    const PS = VR.PortalSpace, SS = VR.SpaceScene; if (!PS || !SS || !g || !g.env) return null;
    if (g.settings && g.settings.preset === 'potato') return null;   // (Very Low never slower: the painted film, as before e-portal2)
    try { return PS.plan(film, from, to, SS.worldTime(g.env.day, g.env.ticks)); } catch (e) { return null; }
  }
  function spaceDraw(g, plan) {
    const PS = VR.PortalSpace; if (!PS || !plan || !PS.render) return null;
    let lastI = -1;
    return (id, k, v, i) => {
      const it = plan[i]; if (!it || !it.gl) return false;
      const J = M.J; if (J && J.plan === plan && J.noGL) return false;   // (too slow here: the painted film)
      if (i !== lastI && g.renderer) { g.renderer.tsrReset = true; lastI = i; }   // (a new shot: no ghost of the last one)
      return PS.render(g, id, k, v, it);
    };
  }
  Portal.prewarm = (g) => !!(VR.PortalSpace && VR.PortalSpace.ready && VR.PortalSpace.ready(g));
  Portal.spaceReady = Portal.prewarm;
  // a trip keeps the space textures across the world switch (the same save: the same Herzwelt) once they are all there
  if (VR.SpaceScene && VR.SpaceScene.drop) {
    const SSd = VR.SpaceScene, od = SSd.drop;
    SSd.drop = function (g) { const J = M.J; if (J && !J.dry && J.texKept) return; return od.apply(this, arguments); };
  }
  function depart(J) {
    J.went = true;
    const g = J.g, d = J.dest;
    if (J.dry) return;
    J.texKept = Portal.prewarm(g);
    if (J.local) {   // a ★ spot on this world: the jump happens under the film
      const p = g.player; if (p && d.at) p.safeTeleport(d.at[0], d.at[1], d.at[2]);
      J.arrived = true; return;
    }
    if (C.kindOf(d.dim) === 'exo' && g.meta) { const sys = parseInt(String(d.dim).split('.')[1], 10); if (sys > 0) { if (!g.meta.stars) g.meta.stars = { v: [] }; g.meta.stars.at = sys; } }
    Promise.resolve(VR.Travel.go(g, { dim: d.dim, via: 'portal', at: d.at })).then((ok) => { if (!ok) J.failed = true; }, () => { J.failed = true; });
  }
  function draw(J) {
    const t0 = now(), W = J.cv.width, H = J.cv.height;
    // e-portal2: while the land loads under a 3-D last shot (a still picture), one space frame a second — the loading
    // gets the frame's time (under SwiftShader a space frame cost seconds and the land came late)
    if (J.t >= J.P.len && !J.arrived && J.P.gl && t0 - (J.holdT || 0) < 1000) return;
    if (J.t >= J.P.len && !J.arrived) J.holdT = t0;
    J.P.draw(J.x, W, H, J.t); if (J.P.gl) J.glN = (J.glN || 0) + 1;
    glClass(!J.covered && J.P.gl);
    // the arrival waits for the land: a soft breathing light over the last look
    if (J.t >= J.P.len && !J.arrived) { J.x.fillStyle = 'rgba(255,246,228,' + (0.05 + 0.04 * Math.sin(J.t * 2)).toFixed(3) + ')'; J.x.fillRect(0, 0, W, H); }   // (e-portal2: a soft breath, not a white veil)
    const ms = now() - t0; M.drawMs = M.drawMs * 0.9 + ms * 0.1; M.maxMs = Math.max(M.maxMs, ms); M.draws++;
    const sk = doc.getElementById('ptSkip'); if (sk) { const wt = J.t >= J.P.len && !J.arrived; sk.textContent = T(wt ? 'g.pt.skipWait' : 'g.pt.skip'); sk.style.display = !J.dry && J.phase === 'film' && (J.t > Portal.SKIP_AFTER || wt) ? 'block' : 'none'; }
  }
  function frame() {
    const J = M.J; if (!J) return;
    // (the wall clock: a slow frame does not slow the film — e-portal2, R55-08: no cap; under load a frame took seconds and
    // the film crawled 0.25 s a frame, so a test's skip came minutes late; the reveal's own fade keeps its cap)
    const tn = now(), wall = Math.max(0, (tn - J.last) / 1000), dt = Math.min(0.25, wall); J.last = tn;
    const g = J.g;
    if (J.phase === 'film') {
      if (!J.paused && !J.covered) J.t += wall;   // (a menu over the trip: the film waits under it)
      // e-portal2: a machine that cannot draw the space shots smoothly (three frames over 0.25 s while one is shown —
      // software GL, a weak chip under load) gets the painted film for the rest of the trip: never slower than before
      if (!J.dry && J.P.gl && J.t < J.P.len) { J.slowN = wall > 0.25 ? (J.slowN || 0) + 1 : Math.max(0, (J.slowN || 0) - 1); if (J.slowN >= 3) J.noGL = true; }
      if (!J.dry) {   // e-portal2: the keys held and the gamepad, read here too
        const ks = g.input && g.input.keys, pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : null;
        const kh = !!(ks && ks.has && (ks.has('Space') || ks.has('Escape') || ks.has('Enter'))), kFresh = kh && !M.keyHeld; M.keyHeld = kh;   // (fresh presses only: Space held to fly up through the gate is no skip)
        if (C.padSkip(pads, M.padSt) || kFresh) J.want = true;
        takeSkip(J);
      }
      if (!J.went && J.t >= J.film.shots[0].dur) depart(J);
      if (!J.dry && J.went && !J.arrived && !J.local && VR.Travel && !VR.Travel.busy(g) && g.state === 'play' && g.dim === J.dest.dim) J.arrived = true;
      if (J.failed) { end(J); return; }
      if (J.went && g.state === 'title') { end(J); return; }   // (the trip broke: the title shows)
      if (!J.dry) { const cover = !!(g.ui && g.ui.screen); if (cover !== !!J.covered) { J.covered = cover; J.cv.style.visibility = cover ? 'hidden' : 'visible'; } }   // (a menu opened over the trip — the pause: it stays usable, the film waits under it)
      draw(J);
      if (!J.paused && J.t >= J.P.len && (J.arrived || J.dry)) {
        if (J.dry) { end(J); return; }
        reveal(J);
      }
    } else if (J.phase === 'reveal') {
      J.rt += Math.min(1, wall);   // (e-portal2: the wall clock here too — under load a frame took seconds and the reveal crawled)
      const k = clamp(J.rt / 1.3, 0, 1); J.cv.style.opacity = String(1 - ease(k));
      if (J.rt > 1.3) J.cv.style.display = 'none';
      if (J.rt >= Portal.REVEAL) { end(J); return; }
    }
    requestAnimationFrame(frame);
  }
  function reveal(J) {
    const g = J.g, d = J.dest, p = g.player, rec = C.rec(g.meta);
    J.phase = 'reveal'; J.rt = 0; glClass(false);
    const sk = doc.getElementById('ptSkip'); if (sk) sk.style.display = 'none';
    if (p && d.fav && Number.isFinite(d.yaw)) { p.yaw = d.yaw; if ('viewYaw' in p) p.viewYaw = d.yaw; p.pitch = 0; }
    else if (p && !J.local) bestLight(g, J);   // e-portal2: the destination at its best hour (Kreativ alone), the land side-lit
    if (J.local && g.audio && g.audio.cue) g.audio.cue('wonder');
    const ep = J.firstGate ? C.episode(rec, seedOf(g), d.dim) : null;
    caption(g, nameOf(d, rec), d.fav ? T('g.pt.kind.fav') : (ep ? T('g.pt.episode') + ' · ' : '') + T('g.pt.kind.' + C.kindOf(d.dim)) + (J.hour ? ' · ' + T('g.pt.bestHour') : ''), T(C.hook(rec, seedOf(g), d.dim, !!d.fav)), ep);
    if (!rec.gated.includes(d.dim)) rec.gated.push(d.dim);
    save(g);
    Portal.last = { film: J.film.id, len: J.film.len, shots: J.film.shots.map((s) => s.id), to: d.dim, noGL: !!J.noGL, episode: ep ? ep.id : null, ms: Math.round(now() - J.t0), skipped: !!J.skipped, hour: !!J.hour, gl: J.glN || 0 };
  }
  // e-portal2: Kreativ alone (the clock not frozen): the clock goes forward (as sleeping does) to the next moment Helia
  // stands 6–17° over the landing; every mode: the view turns 55° off the sun, so the land is lit from the side
  function bestLight(g, J) {
    const PS = VR.PortalSpace, U = VR.Universe, p = g.player, E = g.env;
    if (!PS || !U || !U.localSky || !E || !p) return;
    try {
      let t = U.worldSeconds(E.day | 0, E.ticks);
      if (C.fastOk(ctxOf(g)) && !g.zenFreezeTime) {
        const tb = PS.bestHour(g.dim, p.pos, t);
        if (tb !== null && tb > t + 1) { const all = Math.round(tb * 20); E.day = Math.floor(all / 24000); E.ticks = all - E.day * 24000; t = tb; J.hour = true; }
      }
      const sun = U.localSky(g.dim, p.pos, t).sun.dir;
      if (sun[1] > 0.02 && Math.hypot(sun[0], sun[2]) > 0.05) { const y = Math.atan2(-sun[0], -sun[2]) + 0.95; p.yaw = y; if ('viewYaw' in p) p.viewYaw = y; p.pitch = -0.08; }
    } catch (e) { /* the light as it is */ }
  }
  let glOn = false;
  const glClass = (on) => { on = !!on; if (on === glOn) return; glOn = on; try { doc.documentElement.classList.toggle('pt-gl', on); } catch (e) { /* no page */ } };
  const cinema = (on) => { try { doc.documentElement.classList.toggle('pt-on', !!on); } catch (e) { /* no page */ } };
  function end(J) {
    if (M.J !== J) return;
    M.J = null; J.cv.style.display = 'none'; glClass(false);
    if (J.phase !== 'reveal') cinema(false);
    const sk = doc.getElementById('ptSkip'); if (sk) sk.style.display = 'none';
    if (J.g && J.g.renderer) J.g.renderer.tsrReset = true;   // (e-portal2: the world again, no ghost of space)
    const g = J.g; if (!J.dry && g && g.input && g.state === 'play' && g.ui && !g.ui.screen) { g.input.captured = true; if (g.input.requestLock) g.input.requestLock(); }
  }
  // the caption: the place's name, its kind, a one-line hook; the episode's lines after it, one by one; then gone
  function caption(g, name, kind, hook, ep) {
    let c = doc.getElementById('ptCap');
    if (!c) { c = el('div'); c.id = 'ptCap'; host().appendChild(c); }
    c.textContent = '';
    c.appendChild(el('div', 'pt-cn', name)); c.appendChild(el('div', 'pt-ck', kind)); c.appendChild(el('div', 'pt-ch', hook));
    const e = el('div', 'pt-ce'); e.style.opacity = '0'; c.appendChild(e);
    const token = (M.capTok = (M.capTok || 0) + 1);
    c.style.opacity = '1';
    const lines = ep ? ep.lines : [];
    const at = (ms, f) => setTimeout(() => { if (M.capTok === token) f(); }, ms);
    lines.forEach((l, i) => at(3600 + i * 3400, () => { e.textContent = ''; const b = el('b', '', T('story.who.' + l.who) + ': '); e.appendChild(b); e.appendChild(doc.createTextNode(T(l.key))); e.style.opacity = '1'; if (i === 0 && g.audio && g.audio.cue) g.audio.cue('funke'); }));
    at(6200 + lines.length * 3400, () => { c.style.opacity = '0'; cinema(false); });
  }
  Portal.caption = caption;
  // the reveal's camera: from above and aside it swings down into your eyes
  Portal.cam = function (g, cam) {
    const J = M.J, FL = M.fly;
    if (J && J.g === g && J.phase === 'reveal' && !(VR.A11y && VR.A11y.less && VR.A11y.less(g.settings))) {
      const u = ease(clamp(J.rt / Portal.REVEAL, 0, 1)), deep = C.kindOf(g.dim) === 'deep' || C.kindOf(g.dim) === 'station';
      return Object.assign({}, cam, { y: cam.y + (1 - u) * (deep ? 2.5 : 16), yaw: cam.yaw + (1 - u) * 0.85, pitch: cam.pitch + (1 - u) * (-0.42 - cam.pitch * 0.5) });
    }
    if (FL.fov > 0.05 && !g.zoom) return Object.assign({}, cam, { fov: cam.fov + FL.fov * Math.PI / 180 });
    return null;
  };

  // ---------------------------------------------------------------- fast flight
  function flyTick(g, dt) {
    const p = g.player, FL = M.fly, input = g.input; if (!p) return;
    if (FL.p !== p) { FL.p = p; FL.lastSet = null; FL.slow = 0; }   // (a new world, a new player: nothing of the last one's speed is taken for a /fly)
    const ctx = ctxOf(g), ok = C.fastOk(ctx), S = g.settings || {};
    let chosen = Math.max(1, Math.min(C.FLY_MAX, S.flyFast | 0 || 1));
    if (ok && p.flying && p.sprinting && input && input.mouse && input.mouse.wheel && !(g.ui && (g.ui.screen || g.ui.typing))) {
      chosen = C.step(chosen, input.mouse.wheel); input.mouse.wheel = 0; FL.slow = 0;
      S.flyFast = chosen; if (g.saveSettings) g.saveSettings(); pill(T('g.pt.fly', { v: chosen }));
    }
    const pend = g.world && g.world.pending && g.world.pending.size || 0;
    const mul = C.flyMul(chosen, ctx, pend);
    if (ok) {
      if (FL.lastSet !== null && p.flySpeed !== FL.lastSet) {   // /fly: the command's speed becomes the setting (a slow one is kept)
        if (p.flySpeed < 1) { FL.slow = p.flySpeed; S.flyFast = 1; } else { FL.slow = 0; S.flyFast = Math.max(1, Math.min(C.FLY_MAX, Math.round(p.flySpeed))); }
      } else p.flySpeed = chosen === 1 && FL.slow ? FL.slow : mul;
      FL.lastSet = p.flySpeed;
      const capped = mul < chosen && p.flying; if (capped && !FL.capped) pill(T('g.pt.slow')); FL.capped = capped;
    } else { if (p.flySpeed > 1) p.flySpeed = 1; FL.lastSet = null; }
    // the feel of speed: the view widens a little, the wind rises (only past the normal sprint)
    const hs = p.flying && p.vel ? Math.hypot(p.vel[0], p.vel[2]) : 0, k = clamp((hs - 24) / 140, 0, 1);
    FL.k += (k - FL.k) * Math.min(1, dt * 3);
    const reduce = !!(VR.A11y && VR.A11y.less && VR.A11y.less(g.settings));   // (Weniger Bewegung: no widening)
    FL.fov = reduce ? 0 : C.fovAdd(1 + 7 * FL.k);
    wind(g, FL.k);
    if (FL.pillT > 0 && (FL.pillT -= dt) <= 0 && FL.pill) FL.pill.style.opacity = '0';
  }
  function pill(text) {
    if (!doc) return; style();
    const FL = M.fly; if (!FL.pill) { FL.pill = el('div'); FL.pill.id = 'ptFly'; host().appendChild(FL.pill); }
    FL.pill.textContent = text; FL.pill.style.opacity = '1'; FL.pillT = 1.4;
  }
  function wind(g, k) {
    const A = g.audio, FL = M.fly;
    if (!A || !A.ctx || !A.noise || !A.sfx) return;
    if (k < 0.02) { if (FL.wind) { FL.wind.g.gain.setTargetAtTime(0, A.ctx.currentTime, 0.3); if (k < 0.005 && FL.wind.on) { const w = FL.wind; w.on = false; setTimeout(() => { try { if (!w.on) { w.src.stop(); FL.wind = FL.wind === w ? null : FL.wind; } } catch (e) { /* stopped */ } }, 1200); } } return; }
    if (!FL.wind) {
      const c = A.ctx, src = c.createBufferSource(); src.buffer = A.noise; src.loop = true;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.7;
      const gn = c.createGain(); gn.gain.value = 0;
      src.connect(bp); bp.connect(gn); gn.connect(A.sfx); src.start();
      FL.wind = { src, bp, g: gn, on: true };
    }
    FL.wind.on = true;
    const t = A.ctx.currentTime;
    FL.wind.g.gain.setTargetAtTime(0.22 * Math.pow(k, 1.2), t, 0.25);
    FL.wind.bp.frequency.setTargetAtTime(420 + k * 1100, t, 0.3);
  }
  Portal.fly = () => ({ k: +M.fly.k.toFixed(3), fov: M.fly.fov, slow: M.fly.slow, capped: M.fly.capped, wind: !!M.fly.wind });
  if (VR.Settings && VR.Settings.add) VR.Settings.add({ key: 'flyFast', g: 'play', sec: 'steer', t: 'slider', lab: 'g.set.flyFast', tip: 'g.set.flyFast.tip', def: 1, min: 1, max: 8, step: 1 });

  // ---------------------------------------------------------------- the gates and the key
  let VEIL_ID = -2, GLOW_ID = -2;
  function inGate(g) {
    const R = VR.R, p = g.player, w = g.world; if (!R || !p || !w || !p.pos) return false;
    if (VEIL_ID === -2) { VEIL_ID = R.byName.portal_veil ? R.byName.portal_veil.id : -1; GLOW_ID = R.byName.gate_glow ? R.byName.gate_glow.id : -1; }
    if (VEIL_ID < 0 && GLOW_ID < 0) return false;
    const TY = R.T.type, x = Math.floor(p.pos[0]), z = Math.floor(p.pos[2]);
    for (let k = 0; k < 2; k++) { const s = w.getBlock(x, Math.floor(p.pos[1] + (k ? 0.9 : 0.1)), z); if (!s) continue; const t = TY[s]; if (t === VEIL_ID || t === GLOW_ID) return true; }
    return false;
  }
  function ring(k) { if (!doc) return; let r = doc.getElementById('ptRing'); if (!r) { if (!k) return; style(); r = el('div'); r.id = 'ptRing'; host().appendChild(r); } r.style.opacity = String(k * 0.9); r.style.transform = 'scale(' + (0.6 + k * 0.6).toFixed(3) + ')'; }
  function gateTick(g, dt) {
    const ui = g.ui, p = g.player, input = g.input;
    const frozen = !p || p.dead || (ui && (ui.screen || ui.typing || ui.blocking)) || (g.director && g.director.active) || g.studioOpen || (VR.Travel && VR.Travel.busy(g));
    // K held: the picker (in a multiplayer session K is the convoy's wheel)
    if (!frozen && M.kDown && !(g.mp && g.mp.session)) { M.kT += dt; if (M.kT >= Portal.HOLD_K) { M.kT = 0; M.kDown = false; Portal.open(g, 'key'); return; } } else M.kT = 0;
    const inside = !frozen && inGate(g);
    if (!inside) { if (M.gateT) { M.gateT = 0; ring(0); } if (!frozen) M.armed = true; return; }
    if (!M.armed) return;
    M.gateT += dt; ring(clamp(M.gateT / Portal.GATE_S, 0, 1));
    if (M.gateT >= Portal.GATE_S) { M.gateT = 0; M.armed = false; ring(0); Portal.open(g, 'gate'); }
  }

  // ---------------------------------------------------------------- the game's hooks
  const origPlay = VR.Game.prototype.playFrame;
  VR.Game.prototype.playFrame = function (dt) {
    if (M.pick && M.pick.g === this) { if (this.pool && this.pool.pump) this.pool.pump(); return; }   // (the picker: the world waits behind it)
    if (!M.J) { try { gateTick(this, dt); } catch (e) { console.warn('portal', e); } }
    if (M.pick) return;
    try { flyTick(this, dt); } catch (e) { console.warn('portal fly', e); }
    return origPlay.call(this, dt);
  };
  // the pause menu: 🌍 Reisen (after the star map's button, or the codex's)
  if (VR.UI && VR.UI.prototype.pause) {
    const origPause = VR.UI.prototype.pause;
    VR.UI.prototype.pause = function () {
      const r = origPause.apply(this, arguments);
      try {
        const g = this.game, root = doc && doc.getElementById('pause'); if (!root) return r;
        let b = root.querySelector('#ptMenuBtn');
        if (!b) {
          const after = root.querySelector('#starMapBtn') || root.querySelector('[data-act="codex"]'); if (!after) return r;
          b = el('button', 'btn'); b.id = 'ptMenuBtn'; b.type = 'button';
          b.onclick = () => { const gg = this.game; this.resume(); setTimeout(() => Portal.open(gg, 'menu'), 30); };
          after.after(b);
        }
        b.textContent = T('g.pt.menu'); b.title = T('g.pt.menuTip');
        b.style.display = ctxOf(g).guest ? 'none' : '';
      } catch (e) { console.warn('portal menu', e); }
      return r;
    };
  }
  // the idle cost (the test): n frames of the gates' and fast flight's look, ms per frame
  Portal.idleCost = (g, n) => { const t0 = now(); for (let i = 0; i < n; i++) { gateTick(g, 0.016); flyTick(g, 0.016); } return (now() - t0) / n; };
  Portal.stats = () => ({ pick: !!M.pick, cards: M.pick ? M.pick.cards.length : 0, film: M.J ? { id: M.J.film.id, t: +M.J.t.toFixed(2), len: M.J.film.len, phase: M.J.phase, went: M.J.went, arrived: M.J.arrived, shot: M.J.P.shotAt(M.J.t), low: M.J.film.low, gl: !!M.J.P.gl, skip: !!M.J.skipped, rt: +M.J.rt.toFixed(2), w: M.J.cv.width, h: M.J.cv.height } : null, drawMs: +M.drawMs.toFixed(2), maxMs: +M.maxMs.toFixed(2), draws: M.draws, last: Portal.last || null, fly: Portal.fly() });
})(VR);
