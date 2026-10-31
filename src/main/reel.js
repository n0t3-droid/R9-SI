// ============================================================================
// 🎬 Die Highlight-Rolle (e-cam; docs/superpowers/plans/2026-10-31-e-cam.md; erlebnis §5): your session as a little film.
// F9 or the pause menu's 🎬 plays a 30–90 s cut of the session: the event log's highlights (weight ≥ 3 — an outpost
// freed, the boss, a build finished, an arrival, a vista, a sky act — and the golden hours its samples saw), each one
// staged at its place and its time of day by the director camera (directorcam.js: DirCam.pick / reelPlan / stage), your
// hero replaying its track there (pose at 5 Hz, 20 minutes, DirCam.Track), the pads' visitors and the trams wound back
// to that moment, letterbox, a caption of the deed and the place, the day's music rising (score.js). A moment on another
// world (a moon's landing, a star jump's arrival) can't be staged in today's world: its postcard — the frame drawn just
// after it, kept at 480 × 270 — is shown instead. Any key ends it; B saves the frames (one per shot at 2×, photomode's
// download), V plays it again from the start and records it as a WebM (MediaRecorder, the canvas and the music; a local
// download — nothing leaves the machine). Everything given back afterwards (DirCam.reelSave / reelRestore).
// meta.highlights keeps the world's best 50 (no pictures) for the story's finale.
// Cost 🟢: during play the track (a compare a frame, seven stores at 5 Hz) and a copy of the frame for a postcard (rare,
// ~1 ms; not on Very Low); the reel plays at the game's own cost — on Very Low at 0.45 of the screen's pixels.
// Honest limit: the reel shows today's world at the moments' places — blocks built since stay built, the free animals are
// as they are now.
// ============================================================================
(function (VR) {
  'use strict';
  const D = VR.DirCam; if (!D) return;
  const tx = (k, v, de, en) => (VR.I18N && VR.I18N.tx ? VR.I18N.tx(k, v, de, en) : de);
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const R = VR.Reel = {
    on: true, track: new D.Track(), hl: [], cards: 0, dims: ['overworld'], world: null, run: null, want: null,
    stats: { calls: 0, frames: 0, recMs: 0, cardMs: 0, cards: 0, saved: 0, video: null, startMs: 0 },
  };
  R.CARD_W = 480; R.CARD_H = 270; R.MAX_CARDS = 8; R.MAX_HL = 64; R.BEST = 50; R.LOW_SCALE = 0.45;
  const low = (g) => !!(g && g.settings && g.settings.preset === 'potato');
  const dimI = (d) => { d = d || 'overworld'; let i = R.dims.indexOf(d); if (i < 0) { R.dims.push(d); i = R.dims.length - 1; } return i; };
  const fresh = (g) => { const k = (g.meta && (g.meta.id || g.meta.name)) || g.world; if (k !== R.world) { R.world = k;   /* (one save: its moons and stars stay in the reel) */ R.track.clear(); R.hl.length = 0; R.cards = 0; R.want = null; } };

  // ---------------------------------------------------------------- the highlights as they happen (EventLog.emit)
  R.note = function (g, rec, r) {
    if (!rec || rec.w < 3 || !g || R.run) return;
    fresh(g);
    const h = { t: rec.t, kind: rec.kind, sub: rec.sub, w: rec.w, x: rec.x, y: rec.y, z: rec.z, r: r > 0 ? r : 6, inView: rec.inView, self: rec.src === 'wow' || rec.src === 'codex' || rec.src === 'story' || rec.src === 'moon' || rec.src === 'stars',
      dim: g.dim || 'overworld', tod: g.env ? Math.round(g.env.timeOfDay) : 6000, place: R.placeAt(g, rec.x, rec.z), card: null };
    R.hl.push(h);
    if (R.hl.length > R.MAX_HL) { let wi = 0; for (let i = 1; i < R.hl.length; i++) if (R.hl[i].w < R.hl[wi].w) wi = i; R.hl.splice(wi, 1); }
    // a moment away from the Herzwelt's ground (a moon, another star, space): its postcard from the next frame drawn
    if ((h.dim !== 'overworld' || h.kind === 'space') && !low(g) && R.cards < R.MAX_CARDS) R.want = h;
    R.keep(g, h);
  };
  // meta.highlights: the world's best 50 (the story's finale rolls the best 20)
  R.keep = function (g, h) {
    const m = g.meta; if (!m || m.guest) return;
    const L = m.highlights = Array.isArray(m.highlights) ? m.highlights : [];
    L.push({ t: Math.round(h.t), at: Date.now(), kind: h.kind, sub: h.sub, w: h.w, x: Math.round(h.x), y: Math.round(h.y), z: Math.round(h.z), dim: h.dim, tod: h.tod, place: h.place || '' });
    if (L.length > R.BEST) { L.sort((a, b) => b.w - a.w || b.at - a.at); L.length = R.BEST; L.sort((a, b) => a.at - b.at); }
  };
  R.placeAt = function (g, x, z) {
    const V = g.villages; let best = '', bd = 260 * 260;
    if (V && V.known) for (const v of V.known.values()) { const pz = v && v.plan && v.plan.plaza; if (!pz || !v.name) continue; const d = (pz.x - x) ** 2 + (pz.z - z) ** 2; if (d < bd) { bd = d; best = v.name; } }
    return best;
  };
  // the postcard: the frame just drawn (the drawing buffer is still there in the same task) into a small canvas
  R.grab = function (canvas) {
    const h = R.want; R.want = null; if (!h || typeof document === 'undefined') return;
    const t0 = now();
    try {
      const c = document.createElement('canvas'); c.width = R.CARD_W; c.height = R.CARD_H;
      const W = canvas.width, H = canvas.height, k = Math.min(W / 16, H / 9), sw = 16 * k, sh = 9 * k;
      c.getContext('2d').drawImage(canvas, (W - sw) / 2, (H - sh) / 2, sw, sh, 0, 0, R.CARD_W, R.CARD_H);
      h.card = c; R.cards++; R.stats.cards++;
    } catch (e) { /* no postcard */ }
    R.stats.cardMs += now() - t0;
  };

  // ---------------------------------------------------------------- the track (EventLog.frame, every frame)
  R.frame = function (g) {
    if (!R.on || R.run || !g || g.state !== 'play' || !g.player) return;
    const t0 = now(); fresh(g); R.stats.calls++;
    if (g.director && g.director.active) return;
    const p = g.player;
    if (R.track.rec(+(g.time || 0), p.pos[0], p.pos[1], p.pos[2], p.yaw, g.env ? g.env.timeOfDay : 6000, dimI(g.dim))) R.stats.frames++;
    R.stats.recMs += now() - t0;
    if (!R.rHooked && g.renderer) {   // (the postcard's copy right after a frame is drawn)
      const r = g.renderer, r0 = r.render; R.rHooked = true;
      r.render = function () { const n0 = this.frameNo, o = r0.apply(this, arguments); if (R.want && !this.capK && this.frameNo !== n0) R.grab(this.canvas); return o; };   // (only a frame really drawn)
    }
  };

  // ---------------------------------------------------------------- the reel
  const groundOf = (g) => (x, z) => { const w = g.world, col = w && w.col(Math.floor(x) >> 4, Math.floor(z) >> 4); return col && col.ready ? col.height[((Math.floor(z) & 15) << 4) | (Math.floor(x) & 15)] + 1 : null; };
  R.caption = function (s) {
    if (s.frame === 'title') return tx('g.reel.title', { name: R.run && R.run.name }, '🎬 Deine Highlights · {name}', '🎬 Your highlights · {name}');
    if (s.frame === 'end') return tx('g.reel.end', null, 'Bis zum nächsten Abenteuer', 'Until the next adventure');
    const deed = tx(s.cap, null, '', '') || tx('g.reel.c.k_other', null, 'Ein Moment', 'A moment');
    const pl = s.h && s.h.place;
    return pl ? tx('g.reel.at', { deed, place: pl }, '{deed} · bei {place}', '{deed} · near {place}') : deed;
  };
  R.play = function (g) {
    const t0 = now();
    if (!R.on || R.run || !g || g.state !== 'play' || !g.player || !g.director) return false;
    if (g.director.active || (g.photoCam && g.photoCam.on) || (g.wow && g.wow.active)) return false;
    fresh(g);
    const dim = g.dim || 'overworld', di = dimI(dim);
    const evs = R.hl.filter((h) => h.dim === dim || h.card);
    const smp = VR.EventLog && VR.EventLog.samples ? VR.EventLog.samples() : [];
    const hl = D.pick(evs, smp, { dimAt: (t) => { const a = R.track.at(t); return a ? R.dims[a.dim | 0] : dim; } }).filter((h) => h.dim === dim || h.card);
    if (!hl.length) { if (g.ui && g.ui.toast) g.ui.toast('🎬 ' + tx('g.reel.none', null, 'Noch keine Highlights', 'No highlights yet'), tx('g.reel.noneTip', null, 'Befreie einen Außenposten, bau etwas fertig, reise — dann zeigt F9 deinen Film.', 'Free an outpost, finish a build, travel — then F9 shows your film.')); return false; }
    const plan = D.reelPlan(hl, {});
    const p = g.player, saved = D.reelSave(g);
    const run = R.run = { plan, saved, name: (g.meta && g.meta.name) || '', home: { x: p.pos[0], y: p.pos[1], z: p.pos[2], yaw: p.yaw }, t0: +(g.time || 0), di, ground: groundOf(g), shot: null, st: null, frames: false, nSaved: 0, rec: null, shotI: -1 };
    const shots = plan.shots.map((s) => ({ name: 'reel', dur: s.dur, fov: 60, tod: s.tod, keys: [[0, [p.pos[0], p.pos[1] + 2, p.pos[2]], [p.pos[0] + 1, p.pos[1] + 2, p.pos[2]]], [s.dur, [p.pos[0], p.pos[1] + 2, p.pos[2]], [p.pos[0] + 1, p.pos[1] + 2, p.pos[2]]]], caption: R.caption(s), capSmall: s.frame !== 'title', reel: s }));
    if (!g.director.play(shots, { quick: true, skipAny: true })) { R.run = null; return false; }
    g.zenFreezeTime = true;   // (each shot holds its moment's hour; the hour of now comes back after)
    if (low(g) && g.renderer && g.renderer.q) { g.renderer.q.scale = Math.min(g.renderer.q.scale, R.LOW_SCALE); try { g.renderer.resize(true); } catch (e) { /* */ } }
    const d = g.director.ui(), hc = d.querySelector('.hintc');
    run.hint0 = hc ? hc.textContent : '';
    if (hc) hc.textContent = tx('g.reel.keys', null, 'Taste: Ende · B: Bilder speichern · V: als Video', 'Any key: end · B: save frames · V: as a video');
    d.classList.add('reel');
    R.music(g, true);
    R.stats.startMs = now() - t0;
    return true;
  };
  R.music = function (g, start) {
    try {
      const a = g.audio, sc = a && a.score; if (!sc || !a.ctx || !start) return;
      const t = a.ctx.currentTime, space = R.run && R.run.plan.shots.every((s) => !s.h || s.h.kind === 'space');
      sc.event('hold', t, t + 0.8); sc.after = { id: space ? 'space' : 'home', variant: space ? 'day' : 'bright', lv: 1 };
    } catch (e) { /* the music never breaks the reel */ }
  };
  R.stop = function (g) { if (R.run && g.director && g.director.active) g.director.stop(); };
  // the director gave the view back: the reel gives back the rest
  R.after = function (g) {
    const run = R.run; if (!run) return;
    R.run = null;
    if (run.rec) R.recStop(g, run);
    D.reelRestore(g, run.saved);
    if (g.renderer && run.saved.scale !== undefined) { try { g.renderer.resize(true); } catch (e) { /* */ } }
    if (g.director && g.director.dom) { const d = g.director.dom, hc = d.querySelector('.hintc'); if (hc) hc.textContent = run.hint0; d.classList.remove('reel'); }
    R.cardEl(g, null);
    document.getElementById('hud').style.visibility = g.hideHud ? 'hidden' : 'visible';
    if (run.saved && g.player) g.player.noClip = false;
  };

  // one frame of the reel: the shot staged when its ground is in, the camera, the avatar on its track, the postcard
  R.tick = function (g, dir, dt) {
    const run = R.run; if (!run || dir.si < 0 || !dir.shots) return;
    const shot = dir.shots[dir.si], s = shot && shot.reel; if (!s) return;
    if (run.shotI !== dir.si) {
      run.shotI = dir.si; run.st = null; run.shot = s; run.grabbed = false;
      D.reelRewind(g, run.saved, s.h ? Math.max(0, run.t0 - s.h.t) : 0);
      R.cardEl(g, s.h && s.h.card && (s.frame === 'card' || s.frame === 'cardpan') ? s : null);
    }
    if (!run.st || (dir.phase === 'run' && !run.staged)) { run.st = R.stageOf(g, s); run.staged = dir.phase === 'run'; }
    const t = dir.phase === 'run' ? dir.t : 0, c = run.st.cam(t);
    run.cam = c;
    // the avatar: your track at that moment (the hero is drawn when camMode ≠ 0); without one the camera carries you
    const A = run.st.avatar ? run.st.avatar(t) : null, p = g.player;
    if (A) {
      const mv = Math.hypot(A.x - p.pos[0], A.z - p.pos[2]);
      p.pos = [A.x, A.y, A.z]; p.yaw = A.yaw; p.pitch = 0; p.flying = false; p.vel = [0, 0, 0];
      const sp = dt > 0 && mv < 5 ? mv / dt : 0; p.bob = (p.bob || 0) + mv * 0.9; p.bobAmt += ((sp > 0.6 ? 1 : 0) - (p.bobAmt || 0)) * Math.min(1, dt * 8);
      g.camMode = 1;
    } else { p.pos = [c.x, c.y - (p.eye || 1.62), c.z]; g.camMode = 0; }
    // the cards keep the fade off between shots: a cut, not a dip to black (only the first fades in, the last out)
    if (dir.phase === 'run') {
      const f = dir.dom && dir.dom.querySelector('.fade'), last = dir.si === dir.shots.length - 1;
      if (f) f.style.opacity = dir.si === 0 ? Math.max(0, 1 - dir.t / 0.6) : last ? Math.max(0, 1 - (shot.dur - dir.t) / 0.5) : 0;
      if (run.frames && !run.grabbed && dir.t >= shot.dur * 0.5) { run.grabbed = true; R.saveFrame(g, s); }
    }
  };
  R.stageOf = function (g, s) {
    const run = R.run, H = s.h, gnd = run.ground, hm = run.home;
    if (!H || H.card) {   // the cards: a slow orbit round you as you are now (behind a postcard, it is the picture's rest)
      const T = [hm.x, hm.y + 1.2, hm.z];
      const st = D.stage({ frame: 'orbit', dur: s.dur, h: { t: s.frame === 'end' ? 1 : 0 } }, { target: T, r: 2, avatar: () => hm, ground: gnd });
      st.avatar = () => hm; return st;
    }
    const gy = gnd(H.x, H.z), T = [H.x, H.y !== null && H.y !== undefined && Number.isFinite(H.y) ? H.y : (gy !== null ? gy + 1.6 : hm.y + 1.6), H.z];
    const near = (a) => a && (a.dim | 0) === run.di && Math.hypot(a.x - H.x, a.z - H.z) < 150;
    const A0 = R.track.at(H.t);
    const av = near(A0) ? (t) => { const a = R.track.at(H.t - s.dur / 2 + t); return near(a) ? a : A0; } : null;
    const st = D.stage(s, { target: T, r: H.r, avatar: av, ground: gnd, sunAz: D.sunAz(s.tod) });
    st.avatar = av; return st;
  };
  // the postcard over the picture (a push or a pan in CSS), or nothing
  R.cardEl = function (g, s) {
    const dir = g.director; if (!dir || !dir.dom) return;
    let el = dir.dom.querySelector('.reelcard');
    if (!s) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.className = 'reelcard'; dir.dom.insertBefore(el, dir.dom.querySelector('.bar')); }
    el.innerHTML = ''; const c = s.h.card; c.className = s.frame; el.appendChild(c);
    c.style.animationDuration = s.dur + 's';
  };
  // B: this shot's picture at 2× (renderer.capNext, the photo mode's download)
  R.saveFrame = function (g, s) {
    const r = g.renderer, run = R.run; if (!r || r.capNext || !run || run.nSaved >= 12) return;
    if (s.h && s.h.card) return;
    run.nSaved++;
    r.capNext = { k: (VR.PhotoMode && VR.PhotoMode.SCALE) || 2, cb: (img) => { if (!img) return; R.stats.saved++; try { const ph = g.photoCam || (VR.PhotoMode && VR.PhotoMode.Photo ? (g.photoCam = new VR.PhotoMode.Photo(g)) : null); if (ph) ph.save(img); } catch (e) { /* */ } } };
  };
  // V: from the start again, recorded — the canvas at 30 frames a second and the music's bus, a WebM saved locally
  R.recStart = function (g) {
    const run = R.run; if (!run || run.rec || typeof MediaRecorder === 'undefined' || !g.canvas || !g.canvas.captureStream) return false;
    try {
      const st = g.canvas.captureStream(30), a = g.audio;
      if (a && a.ctx && a.master && a.ctx.createMediaStreamDestination) { const dst = a.ctx.createMediaStreamDestination(); a.master.connect(dst); run.recDst = dst; for (const tr of dst.stream.getAudioTracks()) st.addTrack(tr); }
      const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
      const rec = new MediaRecorder(st, mime ? { mimeType: mime, videoBitsPerSecond: 5e6 } : undefined), parts = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size) parts.push(e.data); };
      rec.onstop = () => R.recSave(g, new Blob(parts, { type: 'video/webm' }));
      rec.start(1000); run.rec = rec;
      const dir = g.director; dir.si = -1; dir.phase = 'next'; run.shotI = -2; run.frames = false;
      return true;
    } catch (e) { run.rec = null; return false; }
  };
  R.recStop = function (g, run) {
    try { if (run.rec && run.rec.state !== 'inactive') run.rec.stop(); } catch (e) { /* */ }
    try { if (run.recDst && g.audio && g.audio.master) g.audio.master.disconnect(run.recDst); } catch (e) { /* */ }
  };
  R.recSave = function (g, blob) {
    R.stats.video = { bytes: blob.size, type: blob.type };
    const SP = { ä: 'ae', ö: 'oe', ü: 'ue', Ä: 'Ae', Ö: 'Oe', Ü: 'Ue', ß: 'ss' };
    const nm = 'R9-SI-' + (String((g.meta && g.meta.name) || 'Welt').replace(/[äöüÄÖÜß]/g, (c) => SP[c]).replace(/[^A-Za-z0-9_-]+/g, '-').slice(0, 40) || 'Welt') + '-Highlights.webm';
    const url = URL.createObjectURL(blob); R.lastVideo = { url, name: nm, bytes: blob.size };
    let embedded = true; try { embedded = window.self !== window.top; } catch (e) { embedded = true; }
    if (!embedded) { try { const a = document.createElement('a'); a.href = url; a.download = nm; document.body.appendChild(a); a.click(); a.remove(); } catch (e) { /* */ } }
    if (g.ui && g.ui.toast) g.ui.toast('🎬 ' + tx('g.reel.videoSaved', { n: nm }, 'Video gespeichert: {n}', 'Video saved: {n}'), embedded ? tx('g.reel.videoEmbed', null, 'In dieser Ansicht sind Downloads gesperrt — spiel die Datei-Version für das Video.', 'Downloads are blocked in this view — play the file version for the video.') : '');
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) { /* */ } }, 120000);
  };

  // ---------------------------------------------------------------- the hooks
  const L = VR.EventLog;
  if (L && L.emit) { const e0 = L.emit; L.emit = function (kind, sub, w, pos, src, r) { const rec = e0.apply(this, arguments); try { if (rec && rec.w >= 3) R.note(L.g || VR.game, rec, r); } catch (e) { /* */ } return rec; }; }
  if (L && L.frame) { const f0 = L.frame; L.frame = function (g) { const o = f0.apply(this, arguments); try { R.frame(g); } catch (e) { /* */ } return o; }; }
  const Dir = VR.Director;
  if (Dir) {
    const P = Dir.prototype, up0 = P.update, cam0 = P.cam, stop0 = P.stop;
    P.update = function (dt) {
      const g = this.g, run = R.run;
      if (run && this.active && this.opts && this.opts.skipAny && this.phase === 'run') {
        if (run.wantB) { run.wantB = false; run.frames = true; run.grabbed = false; if (VR.PhotoMode && VR.PhotoMode.note) VR.PhotoMode.note('📷 ' + tx('g.reel.frames', null, 'Bilder werden gespeichert — eins je Szene, doppelte Größe', 'Saving frames — one a shot, at twice the size'), 2500); }
        if (run.wantV) { run.wantV = false; if (!run.rec && R.recStart(g) && VR.PhotoMode && VR.PhotoMode.note) VR.PhotoMode.note('⏺ ' + tx('g.reel.recording', null, 'Aufnahme — von vorn', 'Recording — from the start'), 2500); }
      }
      const o = up0.apply(this, arguments);
      if (R.run && this.active) { try { R.tick(g, this, dt); } catch (e) { console.warn('reel', e); this.stop(); } }
      return o;
    };
    P.camAt = (function (a0) { return function (shot, t) { const run = R.run; if (run && shot && shot.reel && run.cam && run.shotI === this.si) { const c = run.cam; return { pos: [c.x, c.y, c.z], yaw: c.yaw, pitch: c.pitch }; } return a0.call(this, shot, t); }; })(P.camAt);
    P.cam = function (base) {
      const run = R.run; if (!run || !this.active || !run.cam) return cam0.call(this, base);
      const c = run.cam; return Object.assign({}, base, { x: c.x, y: c.y, z: c.z, yaw: c.yaw, pitch: c.pitch, roll: 0, fov: c.fov, fixed: true });
    };
    P.stop = function () { const was = this.active; const o = stop0.apply(this, arguments); if (was && R.run) { try { R.after(this.g); } catch (e) { console.warn('reel', e); R.run = null; } } return o; };
  }
  const G = VR.Game;
  if (G) {
    const hk0 = G.prototype.handleKeys;
    G.prototype.handleKeys = function () {
      const i = this.input, run = R.run;
      // (the reel's own keys never reach the Bauhand or the Aktion key: B and V are taken here, before anyone polls them)
      if (run) { if (i.pressed.has('KeyB')) { i.pressed.delete('KeyB'); run.wantB = true; } if (i.pressed.has('KeyV')) { i.pressed.delete('KeyV'); run.wantV = true; } }
      if (!this.ui.typing && !this.ui.screen && i.hit('F9') && this.state === 'play') { if (R.run) R.stop(this); else R.play(this); return; }
      return hk0.apply(this, arguments);
    };
  }
  // the postcards' look (a slow push, or a pan) under the letterbox and the caption
  if (typeof document !== 'undefined' && document.head) {
    const st = document.createElement('style');
    st.textContent = '#cine .reelcard{position:absolute;inset:0;background:#000;overflow:hidden}#cine .reelcard canvas{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;animation:reelPush linear forwards}#cine .reelcard canvas.cardpan{animation-name:reelPan}@keyframes reelPush{from{transform:scale(1.02)}to{transform:scale(1.14)}}@keyframes reelPan{from{transform:scale(1.16) translateX(-3%)}to{transform:scale(1.16) translateX(3%)}}#cine.reel .cap{font-size:26px}';
    document.head.appendChild(st);
  }
  // 🎬 in the pause menu (start.js's button)
  if (typeof document !== 'undefined') document.addEventListener('click', (e) => {
    const b = e.target && e.target.closest && e.target.closest('[data-act="reel"]'); if (!b) return;
    const g = VR.game; if (!g || g.state !== 'play') return;
    e.preventDefault(); e.stopPropagation();
    if (g.ui && g.ui.resume) g.ui.resume();
    setTimeout(() => R.play(g), 60);
  }, true);
})(VR);
