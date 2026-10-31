// ============================================================================
// f-quiet — the screen belongs to the world, not to messages (plan docs/superpowers/plans/2026-10-31-f-quiet.md).
// The owner (31 Oct): the „Funke fragen" line and the messages on the screen bother the player. One message channel:
//   · #notes — bottom left (touch: top left), small, two lines at most, each LIFE s then a short fade, never in the
//     centre. ui.toast, ui.hint and the game's own chat lines all arrive here with a priority: 3 must-see (the answer to
//     what you just did, a quest done), 2 normal (a quest, a village, a moon), 1 low (discoveries, tips, growth, system
//     chat). The same text again within REPEAT s drops; the same key while it shows merges (×2 / the new text in place).
//   · ⚙ Hinweise (notices): Normal (1+) · Wenig (default: 2+, one new normal notice per GAP_FEW s, two may wait WAIT s)
//     · Aus (only 3). Also Funke: one unprompted line per FUNKE_GAP s, none while building, while the player stands and
//     looks round a view, in a cinematic scene, or at Aus; his bubble small at the left edge. The 🧭 hints and the
//     key-hint strip: Wenig only in a world's first FIRST s (a hint steps back after HINT_HIDE s), Aus never.
//   · a cinematic scene (a story scene, the director, a wow moment, the arrival's moment, the photo mode, F1) holds the
//     channel: low notices drop, the rest shows after it; subtitles are the story's own and stay.
//   · everything that reached the channel (shown or not) is kept: the pause menu lists the last six, the journal (J) more.
// Pure (node, test/quiet.js): Notes · toastPrio(title, text) · hintPrio(t, lastInput) · Look · funkeMay(o) · hintOk
// Cost 🟢 on every preset: nothing per frame — one 4-Hz timer (the hold, the look detector, the fades); DOM on change.
// ============================================================================
(function (VR) {
  'use strict';
  const Q = VR.Quiet = VR.Quiet || {};
  Q.LEVELS = ['normal', 'few', 'off']; Q.DEF = 'few';
  Q.LIFE = 3.6;        // s a line shows (then FADE s of fading)
  Q.FADE = 0.4;
  Q.MAX_VIS = 2;       // lines at most
  Q.REPEAT = 30;       // s: the same text again within this drops
  Q.GAP_FEW = 6;       // s between two new normal notices at Wenig
  Q.GAP_NORMAL = 1.2;  // … at Normal
  Q.WAIT = 12;         // s a waiting notice may wait
  Q.QMAX = 2;          // notices that may wait
  Q.HIST = 40;         // the history's length
  Q.FIRST = 300;       // s of a new world in which Wenig still shows the 🧭 hints and the key strip
  Q.HINT_HIDE = 12;    // s after which a 🧭 hint steps back at Wenig
  Q.FUNKE_GAP = 180;   // s between two unprompted lines of Funke
  Q.FUNKE_DIRECT = 25; // s between two of Funke's event lines (a fight's „Volltreffer") at Wenig
  const MIN_PRIO = { normal: 1, few: 2, off: 3 };
  const lvl = (l) => (MIN_PRIO[l] ? l : Q.DEF);

  // ---------------------------------------------------------------- the notice manager (pure)
  class Notes {
    constructor(o) { o = o || {}; this.level = lvl(o.level); this.vis = []; this.wait = []; this.last = new Map(); this.lastNew = -Infinity; this.held = false; this.history = []; this.stats = { shown: 0, merged: 0, dropped: 0, queued: 0, expired: 0 }; }
    setLevel(l) { this.level = lvl(l); }
    gap() { return this.level === 'normal' ? Q.GAP_NORMAL : Q.GAP_FEW; }
    rec(n, t, r) { this.history.push({ text: n.text, prio: n.prio, t, r }); if (this.history.length > Q.HIST) this.history.splice(0, this.history.length - Q.HIST); }
    // → 'shown' | 'merged' | 'queued' | 'dropped'
    push(n, t) {
      if (!n || !n.text) return 'dropped';
      const prio = n.prio || 2, text = String(n.text), key = n.key || null, e0 = { text, prio, key };
      // the same key or text while it shows: merged
      for (const v of this.vis) {
        if ((key && v.key === key) || (!key && !v.key && v.text === text)) {
          if (v.text === text) v.count++; else { v.text = text; v.count = 1; }
          v.until = Math.max(v.until, t + Q.LIFE * (key ? 1 : 0.55)); v.prio = Math.max(v.prio, prio);
          this.last.set(text, t); this.stats.merged++; return 'merged';
        }
      }
      for (const w of this.wait) if ((key && w.key === key) || w.text === text) { w.text = text; w.t = t; return 'merged'; }
      this.rec(e0, t, '');
      const h = this.history[this.history.length - 1];
      if (prio < MIN_PRIO[this.level]) { h.r = 'level'; this.stats.dropped++; return 'dropped'; }
      const lt = this.last.get(text);
      if (!key && lt !== undefined && t - lt < Q.REPEAT) { h.r = 'repeat'; this.stats.dropped++; return 'dropped'; }
      this.last.set(text, t);
      if (this.last.size > 200) this.last.clear();
      if (this.held) { if (prio < 2) { h.r = 'held'; this.stats.dropped++; return 'dropped'; } return this.enqueue(e0, t, h); }
      if (prio >= 3) { this.show(e0, t, true); h.r = 'shown'; return 'shown'; }
      if (this.vis.length >= Q.MAX_VIS || t - this.lastNew < this.gap() || this.wait.length) return this.enqueue(e0, t, h);
      this.show(e0, t, false); h.r = 'shown'; return 'shown';
    }
    enqueue(e0, t, h) {
      if (this.wait.length >= Q.QMAX) { h.r = 'full'; this.stats.dropped++; return 'dropped'; }
      this.wait.push(Object.assign({ t }, e0)); h.r = 'queued'; this.stats.queued++; return 'queued';
    }
    show(e0, t, force) {
      if (this.vis.length >= Q.MAX_VIS) {
        if (!force) return false;
        // a must-see one takes the place of the lowest, then the oldest
        let k = 0; for (let i = 1; i < this.vis.length; i++) if (this.vis[i].prio < this.vis[k].prio) k = i;
        this.vis.splice(k, 1);
      }
      this.vis.push({ text: e0.text, prio: e0.prio, key: e0.key, count: 1, t0: t, until: t + Q.LIFE });
      if (e0.prio < 3) this.lastNew = t;
      this.stats.shown++; return true;
    }
    remove(key, t) { this.vis = this.vis.filter(v => v.key !== key); this.wait = this.wait.filter(w => w.key !== key); void t; }
    hold(on, t) { on = !!on; if (on && !this.held) { this.vis.length = 0; } this.held = on; void t; }
    tick(t) {
      if (this.vis.length) this.vis = this.vis.filter(v => t < v.until + Q.FADE);
      if (this.held) return this.vis;
      // the waiting ones: too old → let go; else one when there is room and the gap has passed
      if (this.wait.length) {
        const keep = []; for (const w of this.wait) { if (t - w.t > Q.WAIT) this.stats.expired++; else keep.push(w); }
        this.wait = keep;
        while (this.wait.length && this.vis.length < Q.MAX_VIS && (this.wait[0].prio >= 3 || t - this.lastNew >= this.gap())) { const w = this.wait.shift(); this.show(w, t, w.prio >= 3); if (w.prio < 3) break; }
      }
      return this.vis;
    }
    visible(t) { this.tick(t); return this.vis.filter(v => t < v.until + Q.FADE); }
  }
  Q.Notes = Notes;

  // ---------------------------------------------------------------- the old channels' priorities (pure)
  // [key, prio, de fallback, en fallback] — a title made from this key's template (the {vars} anything)
  Q.RULES = [
    ['g.codex.toastFound', 1], ['g.codex.toastMilestone', 1], ['g.fest.toastTitle', 1], ['g.vil.growing', 1], ['g.vil.movedTitle', 1],
    ['g.fe.neighbours', 1], ['g.fe.grows', 1], ['g.fe.founded', 1], ['live.title', 1, '🎨 Aussehen', '🎨 Looks'], ['g.zr.tipT', 1, '📽 Zeitraffer', '📽 Time-lapse'],
    ['hand.title', 1, '🖐 In der Hand', '🖐 In hand'], ['g.style.title', 1, 'Welt-Stil', 'World style'], ['g.studio.designs', 1],
    ['g.q.toast.done', 3], ['g.q.dropped', 3], ['g.hf.hidden', 3, 'HUD ausgeblendet — [{key}] zeigt es wieder.', 'HUD hidden — [{key}] brings it back.'],
    ['g.first2.jTitle', 3, '📖 Tagebuch', '📖 Journal'], ['g.first2.oTitle', 3, '🧭 Charakter', '🧭 Character'], ['g.foe.easier.done', 3], ['g.pet.tamed', 3],
    ['g.sweep.title', 3], ['g.bench.title', 3],
  ];
  const esc = (s) => s.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
  let rx = null, rxLang = '';
  function rules() {
    const I = VR.I18N, l = (I && I.lang) || 'de';
    if (rx && rxLang === l) return rx;
    rxLang = l; rx = [];
    for (const r of Q.RULES) {
      const d = I && I.dict && I.dict[l], tpl = d && typeof d[r[0]] === 'string' ? d[r[0]] : (l === 'en' ? r[3] : r[2]);
      if (!tpl) continue;
      if (tpl.replace(/\{[a-zA-Z0-9_]+\}/g, '').replace(/[\s·—:,.!]/g, '').length < 3) continue;   // (a bare „{name}" would match anything)
      const src = esc(tpl).replace(/\{[a-zA-Z0-9_]+\}/g, '.*');
      try { rx.push([new RegExp(src), r[1]]); } catch (e) { /* a template we cannot read */ }
    }
    rx.push([/^R9 Studio$/, 1]);
    return rx;
  }
  Q.toastPrio = function (title, text) {
    const s = String(title || ''); void text;
    for (const r of rules()) if (r[0].test(s)) return r[1];
    return 2;
  };
  Q.INPUT_T = 1.5;   // s: a notice this soon after a key or a click is its answer
  Q.hintPrio = (t, lastInput) => (t - (lastInput === undefined ? -Infinity : lastInput) <= Q.INPUT_T ? 3 : 2);

  // ---------------------------------------------------------------- looking round a view (pure; 4 samples a second)
  // standing (< 0.6 m/s) and turning ≥ 0.5 rad within the last 4 s → looking (and for 4 s after)
  class Look {
    constructor() { this.s = []; this.until = -Infinity; }
    step(t, speed, yaw) {
      const s = this.s;
      s.push(t, speed, yaw); while (s.length > 3 && t - s[0] > 4) s.splice(0, 3);
      let still = true, turn = 0;
      for (let i = 0; i < s.length; i += 3) { if (s[i + 1] >= 0.6) still = false; if (i) { let d = Math.abs(s[i + 2] - s[i - 1]); if (d > Math.PI) d = Math.PI * 2 - d; turn += d; } }
      if (still && turn >= 0.5 && s.length >= 9) this.until = t + 4;
      return t < this.until;
    }
  }
  Q.Look = Look;
  Q.funkeMay = (o) => !!o && o.level !== 'off' && !o.looking && !o.held && !o.building;
  Q.hintOk = (level, age) => (level === 'normal' ? true : level === 'off' ? false : (age || 0) <= Q.FIRST);

  // ---------------------------------------------------------------- the setting
  const S = VR.Settings;
  if (S && S.add) S.add({ key: 'notices', g: 'play', sec: 'play', t: 'choice', lab: 'g.set.notices', tip: 'g.set.notices.tip', def: Q.DEF, opts: [['normal', 'g.set.notices.normal', 'g.set.notices.normal.tip'], ['few', 'g.set.notices.few', 'g.set.notices.few.tip'], ['off', 'g.set.notices.off', 'g.set.notices.off.tip']] });
  // Funke's numbers follow (one unprompted line per 3 min)
  if (VR.Funke) VR.Funke.GAP = Q.FUNKE_GAP;

  // ================================================================ the browser
  if (typeof document === 'undefined' || typeof window === 'undefined' || !document.documentElement || !document.documentElement.style || typeof setInterval === 'undefined' || !document.head) return;
  const T = (k, v) => (VR.I18N ? VR.I18N.t(k, v) : k);
  const game = () => VR.game;
  const nowS = () => performance.now() / 1000;
  const level = () => { const g = game(); return lvl(g && g.settings && g.settings.notices); };
  const N = Q.notes = new Notes({ level: level() });
  Q.cost = { ticks: 0, ms: 0, worst: 0 };
  let lastInput = -Infinity, chatClosed = -Infinity;
  Q.lastInput = () => lastInput;
  const onIn = () => { lastInput = nowS(); };
  window.addEventListener('keydown', onIn, true); window.addEventListener('mousedown', onIn, true); window.addEventListener('touchstart', onIn, { capture: true, passive: true });

  // ---- the look
  (function css() {
    const s = document.createElement('style'); s.id = 'quietcss';
    s.textContent = '#notes{position:absolute;left:14px;bottom:82px;max-width:min(420px,40vw);display:flex;flex-direction:column;gap:3px;align-items:flex-start;pointer-events:none;z-index:6}'
      + '#notes .qn{max-width:100%;padding:2px 9px;border-radius:9px;background:rgba(6,9,20,.38);color:#eef3ff;font:500 13px/1.35 var(--font,sans-serif);text-shadow:0 1px 2px rgba(0,0,0,.75);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:1;transition:opacity .4s ease}'
      + '#notes .qn.p3{color:#fff;background:rgba(6,9,20,.5)}#notes .qn.p1{color:#cfd8e8}#notes .qn i{font-style:normal;color:#9affd8;margin-left:5px}#notes .qn.out{opacity:0}'
      + '#ui.touchon #notes{bottom:auto;top:64px}#hud.q-held #notes{display:none}'
      + '#toasts{display:none !important}#hint{display:none !important}'
      + '#chatlog>div.sys{display:none}#chatlog.open>div.sys{display:block}'
      + 'html body #funkebub{max-width:min(260px,36vw);padding:4px 10px 5px;border-radius:11px;font:600 13px/1.3 var(--font,sans-serif);box-shadow:0 2px 8px rgba(0,0,0,.28),0 0 0 1px rgba(70,232,255,.6)}'
      + 'html body #funkebub b{display:inline;font-size:11px;margin-right:6px}html body #funkebub:after{display:none}'
      + '#qrecent{margin-top:8px;font:500 12px/1.4 var(--font,sans-serif);color:#b9c6da;text-align:left;max-height:8.5em;overflow:hidden}#qrecent b{display:block;color:#dfe8f8;font-size:12px;margin-bottom:2px}'
      + '@media (prefers-reduced-motion: reduce){#notes .qn{transition:none}}';
    document.head.appendChild(s);
  })();
  let box = null;
  function notesEl() {
    if (box && box.isConnected) return box;
    const hud = document.getElementById('hud'); if (!hud) return null;
    box = document.createElement('div'); box.id = 'notes'; box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite');
    hud.appendChild(box); return box;
  }
  let sig = '';
  function render(t) {
    const el = notesEl(); if (!el) return;
    const vis = N.vis, s = vis.map(v => v.text + '#' + v.count + (t >= v.until ? 'o' : '')).join('|');
    if (s === sig) return;
    sig = s; el.textContent = '';
    for (const v of vis) {
      const d = document.createElement('div'); d.className = 'qn p' + v.prio + (t >= v.until ? ' out' : '');
      d.textContent = v.text;
      if (v.count > 1) { const i = document.createElement('i'); i.textContent = '×' + v.count; d.appendChild(i); }
      el.appendChild(d);
    }
  }
  Q.note = function (text, prio, key) { const t = nowS(); N.setLevel(level()); const r = N.push({ text, prio, key }, t); render(t); return r; };

  // ---- the hold: a cinematic scene, the photo mode, the HUD hidden
  const heldNow = (g) => !!(g && (g.state !== 'play' || (document.body && document.body.classList.contains('storyon')) || (g.director && g.director.active) || (g.wow && g.wow.active) || (g.arrival && g.arrival.phase === 'moment') || (g.photoCam && g.photoCam.on) || g.photo || g.hideHud));
  Q.held = () => heldNow(game());
  // ---- the world's age (for the first minutes' hints): seconds played in it, kept per world
  const AGE_KEY = 'r9si.quiet';
  let ages = null, ageId = null, ageSaved = 0;
  const readAges = () => { if (ages) return ages; try { ages = JSON.parse(localStorage.getItem(AGE_KEY) || 'null'); } catch (e) { ages = null; } if (!ages || typeof ages !== 'object' || !ages.a) ages = { v: 1, a: {} }; return ages; };
  const worldId = (g) => (g && g.meta ? String(g.meta.id || g.meta.name || g.meta.seed || '') : '');
  Q.age = function () { const g = game(), id = worldId(g); if (!id) return 0; return readAges().a[id] || 0; };
  // ---- the look detector
  const look = new Look();
  let looking = false;
  Q.looking = () => looking;

  let lastTick = 0, hintAt = 0;
  function tick() {
    const t0 = performance.now(), g = game();
    try {
      const t = t0 / 1000, dt = lastTick ? Math.min(1, t - lastTick) : 0.25; lastTick = t;
      N.setLevel(level());
      const held = heldNow(g);
      N.hold(held, t);
      const hud = document.getElementById('hud'); if (hud && hud.classList.contains('q-held') !== held) hud.classList.toggle('q-held', held);
      if (g && g.state === 'play' && g.player && !held) {
        const p = g.player, v = p.vel || [0, 0, 0];
        looking = look.step(t, Math.hypot(v[0] || 0, v[2] || 0), p.yaw || 0);
        const id = worldId(g);
        if (id) { const A = readAges().a; if (ageId !== id) { ageId = id; } A[id] = (A[id] || 0) + dt; if (t - ageSaved > 10) { ageSaved = t; try { const ks = Object.keys(A); if (ks.length > 64) delete A[ks[0]]; localStorage.setItem(AGE_KEY, JSON.stringify(ages)); } catch (e) { /* a convenience */ } } }
      } else looking = false;
      N.tick(t); render(t);
      // a 🧭 hint at Wenig steps back after HINT_HIDE s
      const H = VR.Hints;
      if (H && hintAt && H.current() && level() !== 'normal' && t - hintAt > Q.HINT_HIDE) { hintAt = 0; H.dismiss(); }
      if (H && !H.current()) hintAt = 0;
    } catch (e) { /* the channel is a nicety */ }
    const ms = performance.now() - t0, C = Q.cost; C.ticks++; C.ms += ms; if (ms > C.worst) C.worst = ms;
  }
  setInterval(tick, 250);

  // ---- the old channels
  const UI = VR.UI;
  if (UI && UI.prototype.toast && !UI.prototype.toast.__q) {
    const ot = UI.prototype.toast, oh = UI.prototype.hint, oc = UI.prototype.chatLine, oo = UI.prototype.openChat, ox = UI.prototype.closeChat;
    UI.prototype.toast = function (title, text, iconId, prio) {
      const g = this.game;
      if (!g || g.state !== 'play') return ot.apply(this, arguments);
      const s = String(title || '') + (text ? ' · ' + text : '');
      const p = prio || Q.toastPrio(title, text);
      const r = Q.note(s, p);
      if (r === 'shown' && p >= 2 && g.audio && g.audio.play) g.audio.play('toast');
      return r;
    };
    UI.prototype.toast.__q = true;
    UI.prototype.hint = function (text, ms) {
      const g = this.game;
      if (!g || g.state !== 'play') return oh.apply(this, arguments);
      if (!text) { N.remove('hint', nowS()); render(nowS()); return; }
      void ms;
      return Q.note(String(text), Q.hintPrio(nowS(), lastInput), 'hint');
    };
    UI.prototype.chatLine = function (text, color) {
      const r = oc.apply(this, arguments);
      try {
        const t = nowS(), s = String(text || ''), log = document.getElementById('chatlog');
        const chat = this.typing || /^</.test(s) || t - chatClosed < 2.5 || (this.game && this.game.mp && this.game.mp.active && /^\S+: /.test(s));
        if (!chat && log && log.lastChild) {
          log.lastChild.classList.add('sys');
          const bt = document.getElementById('bhToast');
          if (!(bt && bt.classList.contains('on') && bt.textContent === s)) Q.note(s, Q.hintPrio(t, lastInput) >= 3 ? 3 : 1);
        }
      } catch (e) { /* the log as it was */ }
      return r;
    };
    if (oo) UI.prototype.openChat = function () { const l = document.getElementById('chatlog'); if (l) l.classList.add('open'); return oo.apply(this, arguments); };
    if (ox) UI.prototype.closeChat = function () { chatClosed = nowS(); const l = document.getElementById('chatlog'); if (l) setTimeout(() => { if (!this.typing) l.classList.remove('open'); }, 6000); return ox.apply(this, arguments); };
    // the pause menu: the last six
    const op = UI.prototype.pause;
    if (op) UI.prototype.pause = function () {
      const r = op.apply(this, arguments);
      try {
        const pan = document.querySelector('#pause .panel'); if (!pan) return r;
        let d = document.getElementById('qrecent'); if (!d) { d = document.createElement('div'); d.id = 'qrecent'; pan.appendChild(d); }
        const hs = N.history.slice(-6).reverse();
        d.innerHTML = ''; const b = document.createElement('b'); b.textContent = T('g.quiet.recent'); d.appendChild(b);
        if (!hs.length) d.appendChild(document.createTextNode(T('g.quiet.none')));
        for (const h of hs) { const l = document.createElement('div'); l.textContent = '· ' + h.text; d.appendChild(l); }
      } catch (e) { /* the menu as it was */ }
      return r;
    };
  }
  // the journal (J): the last twenty
  if (VR.Quests && Array.isArray(VR.Quests.journalSections)) VR.Quests.journalSections.push(() => {
    const hs = N.history.slice(-20).reverse(); if (!hs.length) return '';
    const e = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    return '<div class="jsec qrec"><h3>' + e(T('g.quiet.recent')) + '</h3>' + hs.map(h => '<div class="note">· ' + e(h.text) + '</div>').join('') + '</div>';
  });

  // ---- Funke: the unprompted lines by level, the look, the hold; his event lines; the bubble at the edge
  const F = VR.Funke, A = F && F.Actor;
  if (F && F.Budget && !F.Budget.prototype.can.__q) {
    const oc = F.Budget.prototype.can;
    F.Budget.prototype.can = function (t, prompted) {
      if (!prompted && !Q.funkeMay({ level: level(), looking, held: heldNow(game()), building: this.quiet(t) })) return false;
      return oc.apply(this, arguments);
    };
    F.Budget.prototype.can.__q = true;
  }
  if (A && A.prototype.show && !A.prototype.show.__q) {
    const osay = A.prototype.say, oshow = A.prototype.show, opl = A.prototype.placeBubble;
    let inSay = false, directAt = -Infinity;
    A.prototype.say = function () { inSay = true; try { return osay.apply(this, arguments); } finally { inSay = false; } };
    A.prototype.show = function (text, o) {
      if (!inSay && !(o && o.hint)) {
        // an event line straight from a sibling (a fight, a freed outpost): Funke says it at most every FUNKE_DIRECT s at
        // Wenig, never at Aus or in a cinematic — else it is a notice (and in the history)
        const g = this.g, t = nowS(), lv = level();
        const ok = lv === 'normal' ? !heldNow(g) : lv === 'few' ? (!heldNow(g) && t - directAt >= Q.FUNKE_DIRECT) : false;
        if (!ok) { Q.note('✨ ' + String(text || ''), 2); return; }
        directAt = t;
      }
      return oshow.apply(this, arguments);
    };
    A.prototype.placeBubble = function () {
      const el = document.getElementById('funkebub'), g = this.g;
      if (!el) return opl.apply(this, arguments);
      const hidden = (g.hideHud && !(g.photoCam && g.photoCam.on)) || !!(g.ui && g.ui.screen) || heldNow(g);
      if (hidden) { if (el.style.display !== 'none') el.style.display = 'none'; return; }
      if (el.style.display === 'none') el.style.display = 'block';
      const H = innerHeight || 720, bh = el.offsetHeight || 30, nb = box && box.isConnected ? box.offsetHeight : 0;
      const touch = !!(document.getElementById('ui') && document.getElementById('ui').classList.contains('touchon'));
      const X = 14, Y = touch ? 64 + nb + 6 : H - 82 - nb - 6 - bh;
      if (!this.bx || Math.abs(this.bx[0] - X) >= 1 || Math.abs(this.bx[1] - Y) >= 1) { this.bx = [X, Y, false]; el.style.transform = 'translate(' + X + 'px,' + (Y | 0) + 'px)'; el.className = 'q'; }
    };
    A.prototype.show.__q = true;
  }

  // ---- the 🧭 hints: Normal always, Wenig in a world's first minutes (and back after HINT_HIDE s), Aus never
  const Hn = VR.Hints;
  if (Hn && Hn.show && !Hn.show.__q) {
    const os = Hn.show;
    Hn.show = function (id, o) {
      if (!Q.hintOk(level(), Q.age())) return false;
      const ok = os.apply(this, arguments);
      if (ok) hintAt = nowS();
      return ok;
    };
    Hn.show.__q = true;
  }
  // the key-hint strip (ux.js asks): Wenig only in the first minutes, Aus never (⚙ HUD „immer" keeps it)
  Q.stripOff = function (g) { const l = level(); if (g && g.settings && g.settings.hudMode === 'always') return false; return l === 'off' || (l === 'few' && Q.age() > Q.FIRST); };

  // ---- ⚙ Einfach: „Hinweise" under the sliders (after hitfeel's switch)
  const F2 = VR.First2;
  if (F2 && F2.renderSimple && !F2.renderSimple.__q) {
    const ors = F2.renderSimple;
    F2.renderSimple = function (ui) {
      const r = ors.apply(this, arguments);
      try {
        const body = r ? document.getElementById('setbody') : null, g = ui.game, St = g.settings;
        if (body) {
          const d = document.createElement('div'); d.className = 'setrow f2row qrow';
          const lab = document.createElement('label'); lab.textContent = T('g.set.notices');
          const sel = document.createElement('select'); sel.setAttribute('aria-label', T('g.set.notices'));
          for (const v of Q.LEVELS) { const op = document.createElement('option'); op.value = v; op.textContent = T('g.set.notices.' + v); sel.appendChild(op); }
          sel.value = lvl(St.notices);
          const tip = document.createElement('div'); tip.className = 'setip'; tip.textContent = T('g.set.notices.' + sel.value + '.tip');
          sel.onchange = () => { St.notices = lvl(sel.value); tip.textContent = T('g.set.notices.' + St.notices + '.tip'); if (g.saveSettings) g.saveSettings(); };
          d.appendChild(lab); d.appendChild(document.createTextNode(' ')); d.appendChild(sel); d.appendChild(tip); body.appendChild(d);
        }
      } catch (e) { /* the sliders */ }
      return r;
    };
    F2.renderSimple.__q = true;
  }
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
