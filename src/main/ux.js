// ============================================================================
// e-ux · the UI's own rules (plan docs/superpowers/plans/2026-10-30-e-ux.md): one design system (the tokens in
// src/ui/tokens.css, the components in src/ui/ux.css) and the small things that keep a new player from hanging on the
// controls:
//   · the UI scale (⚙ Spiel · „Größe der Anzeige", 90–140 %): --ux-scale on <html>, the HUD and the menus follow it
//   · the key-hint strip (#keystrip, bottom right): only what you can do now — on foot or flying, never in a menu, the
//     photo mode, a vehicle or the cockpit (they speak for themselves), never the key the Aktion prompt shows already;
//     it comes when what you can do changes and steps back after a while (the HUD whispers)
//   · the first minute: three gentle hints, one after the other — move, look, V (the Aktion) — each after a quiet
//     moment, through VR.Hints (one line at a time, ✕ hides it, a done one never comes back)
//   · ⚙ Empfohlen and a search in the settings
// Pure (node, test/ux.js): strip(s, lang, binds) · onboard(st) · recommend(m) · match(q, text) · clampScale(v)
// Cost 🟢 on every preset: nothing in the game loop — one 4 Hz timer reads a few flags and writes the DOM on change.
// ============================================================================
(function (VR) {
  'use strict';
  const X = VR.UX = VR.UX || {};
  const dict = (l) => (VR.I18N && VR.I18N.dict && VR.I18N.dict[l]) || {};
  const W = (k, de, en, l) => { const v = dict(l)[k]; return typeof v === 'string' ? v : (l === 'en' ? en : de); };
  const lang = () => (VR.I18N && VR.I18N.lang === 'en' ? 'en' : 'de');
  const tx = (k, v, de, en) => W(k, de, en, lang());   // (the game's signature: tx(key, vars, de, en))

  // ---------------------------------------------------------------- the UI scale
  X.SCALE_MIN = 0.9; X.SCALE_MAX = 1.4;
  X.clampScale = function (v) {
    const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? +v : NaN;
    if (!Number.isFinite(n)) return 1;
    return Math.min(X.SCALE_MAX, Math.max(X.SCALE_MIN, Math.round(n * 20) / 20));
  };

  // ---------------------------------------------------------------- the key-hint strip (pure)
  // s = { mode: 'foot'|'photo'|'vehicle'|'cockpit', menu, touch, flying, canFly, creative, quests, ctxKey }
  const KEYLAB = { de: { Space: 'Leertaste', ShiftLeft: 'Umschalt', ShiftRight: 'Umschalt' }, en: { Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'Shift' } };
  const keyLab = (code, l) => { if (!code) return '—'; const t = KEYLAB[l][code]; if (t) return t; let m = /^Key([A-Z])$/.exec(code); if (m) return m[1]; m = /^Digit(\d)$/.exec(code); if (m) return m[1]; return code; };
  const keyOf = (name, l, binds) => { const B = binds || (VR.Binds && VR.Binds.current) || null; const c = B && B.codesFor ? B.codesFor(name) : null; return keyLab(c && c.length ? c[0] : name, l); };
  X.STRIP_MAX = 4;
  X.strip = function (s, l, binds) {
    l = l === 'en' ? 'en' : 'de';
    if (!s || s.menu || s.touch || s.mode !== 'foot') return [];
    const out = [], add = (id, name, k, de, en, keyText) => { if (out.length < X.STRIP_MAX) out.push({ id, key: keyText || keyOf(name, l, binds), text: W(k, de, en, l) }); };
    if (s.flying) { add('up', 'Space', 'ux.k.up', 'Hoch', 'Up'); add('down', 'ShiftLeft', 'ux.k.down', 'Runter', 'Down'); }
    else if (s.canFly) add('fly', 'Space', 'ux.k.fly', 'Fliegen', 'Fly', keyOf('Space', l, binds) + ' 2×');
    add('inv', 'KeyE', s.creative ? 'ux.k.build' : 'ux.k.inv', s.creative ? 'Bauen' : 'Inventar', s.creative ? 'Build' : 'Inventory');
    if (s.quests) add('journal', 'KeyJ', 'ux.k.journal', 'Tagebuch', 'Journal');
    add('map', 'KeyM', 'ux.k.map', 'Karte', 'Map');
    if (s.ctxKey !== 'veh') add('veh', 'KeyV', 'ux.k.veh', 'Aktion', 'Action');
    return out;
  };

  // ---------------------------------------------------------------- the first minute (pure)
  // st = { done: {move, look, v}, quiet: s without input, menu, ctx: the Aktion has something to do }
  X.ONBOARD = ['move', 'look', 'v'];
  X.onboard = function (st) {
    if (!st || st.menu) return null;
    const d = st.done || {}, q = +st.quiet || 0;
    for (const id of X.ONBOARD) {
      if (d[id]) continue;
      if (id === 'v') return st.ctx || q >= 10 ? 'v' : null;
      return q >= 3 ? id : null;
    }
    return null;
  };

  // ---------------------------------------------------------------- ⚙ Empfohlen (pure; the first start's pick, game.js)
  const WEAK = /SwiftShader|llvmpipe|Mesa|Mali-[4T]|Mali-G[0-6]\d\b|Adreno \(TM\) [3-5]|PowerVR|Intel\(R\) HD Graphics( [2-5]\d{3})?\b|Intel\(R\) HD Graphics [2-5]\d{2}\b|GMA|Apple A[0-9]\b/i;
  const MID = /Intel\(R\) (UHD|Iris)|Intel\(R\) HD Graphics 6|Adreno \(TM\) 6|Mali-G7|Radeon\(TM\) (Vega|Graphics)|GeForce (9|GT |MX)/i;
  X.recommend = function (m) {
    m = m || {}; const cores = m.cores || 4, mem = m.mem || 8, gpu = String(m.gpu || '');
    if (cores <= 2 || mem <= 2 || WEAK.test(gpu)) return 'potato';
    if (cores <= 4 || MID.test(gpu)) return 'low';
    return 'balanced';
  };

  // ---------------------------------------------------------------- the settings search (pure)
  const fold = (s) => String(s || '').toLowerCase().replace(/ß/g, 'ss').replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u')
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
  X.match = function (q, text) {
    const words = fold(q).split(/\s+/).filter(Boolean); if (!words.length) return true;
    const t = fold(text); return words.every(w => t.indexOf(w) >= 0);
  };

  // ================================================================ the browser
  if (typeof document === 'undefined' || typeof window === 'undefined' || !document.documentElement || !document.documentElement.style) return;
  const game = () => VR.game;
  const $ = (id) => document.getElementById(id);

  // ---- the UI scale: the setting, the CSS variable
  X.applyScale = function (v) { const s = X.clampScale(v); try { document.documentElement.style.setProperty('--ux-scale', String(s)); } catch (e) { /* */ } return s; };
  X.setScale = function (v) { const g = game(), s = X.applyScale(v); if (g && g.settings) { g.settings.uiScale = s; if (g.saveSettings) g.saveSettings(); } return s; };
  if (VR.Settings && VR.Settings.add) VR.Settings.add({ key: 'uiScale', g: 'play', sec: 'play', t: 'slider', lab: 'ux.set.scale', tip: 'ux.set.scaleTip', def: 1, min: X.SCALE_MIN, max: X.SCALE_MAX, step: 0.05, fmt: 'pct' });
  const G = VR.Game;
  if (G && G.prototype.applySettings && !G.prototype.applySettings.__ux) {
    const oa = G.prototype.applySettings;
    G.prototype.applySettings = function (key) { const r = oa.apply(this, arguments); if (key === '*' || key === 'uiScale' || key === undefined) X.applyScale(this.settings && this.settings.uiScale !== undefined ? this.settings.uiScale : 1); return r; };
    G.prototype.applySettings.__ux = true;
  }

  // ---- the key-hint strip
  let strip = null, stripSig = '', stripAt = 0;
  const SHOW_S = 9;   // s the strip stays after a change
  function stripEl() {
    if (strip && strip.isConnected) return strip;
    const hud = $('hud'); if (!hud) return null;
    strip = document.createElement('div'); strip.id = 'keystrip'; strip.setAttribute('role', 'status'); strip.setAttribute('aria-live', 'off');
    hud.appendChild(strip); return strip;
  }
  X.state = function (g) {
    const p = g.player, ui = g.ui, gad = g.gadgets, pr = $('ctxprompt');
    const mode = (g.photo || (g.photoCam && g.photoCam.on)) ? 'photo' : (gad && (gad.riding || gad.drone)) ? ((g.cockpit && g.cockpit.wasActive) ? 'cockpit' : 'vehicle') : 'foot';
    let quests = false; try { quests = !!(VR.Quests && VR.Quests.on && VR.Quests.on()); } catch (e) { quests = false; }
    return {
      mode, menu: !!(ui.screen || ui.typing || g.studioOpen || g.arrival || (g.wow && g.wow.active)),
      touch: !!(document.getElementById('ui') && document.getElementById('ui').classList.contains('touchon')),
      flying: !!p.flying, canFly: p.mode !== 'survival', creative: p.mode !== 'survival', quests,
      ctxKey: pr && pr.classList.contains('on') ? 'veh' : null,
    };
  };
  function stripTick(g, now) {
    const el = stripEl(); if (!el) return;
    const st = g.state === 'play' && g.player ? X.state(g) : null, list = st ? X.strip(st, lang()) : [];
    const ride = !!st && (st.mode === 'vehicle' || st.mode === 'cockpit'), hud = el.parentNode;
    if (hud && hud.classList.contains('ux-ride') !== ride) hud.classList.toggle('ux-ride', ride);   // (the walking chips step away in a vehicle, ux.css)
    const sig = list.map(e => e.id + e.key + e.text).join('|');
    if (sig !== stripSig) {
      stripSig = sig; stripAt = now; el.innerHTML = '';
      for (const e of list) { const r = document.createElement('span'); r.className = 'ks'; r.dataset.k = e.id; const k = document.createElement('kbd'); k.textContent = e.key; const t = document.createElement('span'); t.textContent = e.text; r.appendChild(t); r.appendChild(k); el.appendChild(r); }
    }
    const pro = document.documentElement.classList.contains('pro'), mode = (g.settings && g.settings.hudMode) || 'auto';
    const show = list.length > 0 && (mode === 'always' || now - stripAt < SHOW_S * 1000 || (!pro && firstMin.active));
    el.classList.toggle('on', show);
  }

  // ---- the first minute: move, look, V
  const firstMin = { active: false, quiet: 0, last: 0, pos: null, yaw: 0, look: 0, playing: false };
  const hintOf = (id) => {
    const touch = document.getElementById('ui') && document.getElementById('ui').classList.contains('touchon');
    if (id === 'move') return touch ? { text: tx('ux.h.moveTouch', null, '🕹 links ziehen = laufen', '🕹 drag on the left = walk'), picto: [] } : { text: tx('ux.h.move', null, 'laufen', 'walk'), picto: ['W', 'A', 'S', 'D'] };
    if (id === 'look') return touch ? { text: tx('ux.h.lookTouch', null, 'rechts ziehen = umschauen', 'drag on the right = look around'), picto: ['finger'] } : { text: tx('ux.h.look', null, 'Maus bewegen = umschauen', 'move the mouse = look around'), picto: ['mouse'] };
    if (id === 'v') return { text: tx('ux.h.v', null, 'tut das Passende: reden, einsteigen, reisen', 'does the right thing: talk, get in, travel'), picto: [keyOf('KeyV', lang())] };
    return null;
  };
  function firstTick(g, now, dt) {
    const H = VR.Hints, p = g.player; if (!H || !p) return;
    const playing = g.state === 'play' && !g.studioOpen;
    if (playing && !firstMin.playing) { firstMin.pos = p.pos.slice(); firstMin.yaw = p.yaw; firstMin.look = 0; firstMin.quiet = 0; }
    firstMin.playing = playing;
    const st = H.read(), allDone = X.ONBOARD.every(id => st.done[id]);
    firstMin.active = playing && !allDone;
    if (!playing || allDone) return;
    const inp = g.input, down = (k) => !!(inp && inp.down && inp.down(k));
    const moved = down('KeyW') || down('KeyA') || down('KeyS') || down('KeyD') || Math.hypot(p.pos[0] - firstMin.pos[0], p.pos[2] - firstMin.pos[2]) > 1.5;
    let dy = Math.abs(p.yaw - firstMin.yaw); if (dy > Math.PI) dy = Math.abs(dy - Math.PI * 2);
    firstMin.look += dy; firstMin.yaw = p.yaw;
    if (moved) { H.done('move'); firstMin.pos = p.pos.slice(); }
    if (firstMin.look > 0.6) H.done('look');
    if (down('KeyV')) H.done('v');
    const busy = moved || dy > 0.01;
    firstMin.quiet = busy ? 0 : firstMin.quiet + dt;
    const pr = $('ctxprompt'), menu = !!(g.ui.screen || g.ui.typing || g.arrival || (g.wow && g.wow.active) || (g.photoCam && g.photoCam.on));
    const want = X.onboard({ done: H.read().done, quiet: firstMin.quiet, menu, ctx: !!(pr && pr.classList.contains('on')) });
    const cur = H.current();
    if (cur && X.ONBOARD.indexOf(cur) >= 0 && H.read().done[cur]) H.done(cur);
    if (want && !H.current() && H.want(want)) { const h = hintOf(want); if (h) H.show(want, h); }
  }
  X.firstMin = firstMin;
  // (start.js's own move hint waits for the three; its fly hint comes after them)
  X.ownsHints = () => !!(VR.Hints && !X.ONBOARD.every(id => VR.Hints.read().done[id]));

  let lastT = 0;
  X.tick = function () {
    const g = game(); if (!g || !g.ui) return;
    const now = performance.now(), dt = lastT ? Math.min(1, (now - lastT) / 1000) : 0.25; lastT = now;
    try { stripTick(g, now); } catch (e) { /* the strip is a nicety */ }
    try { firstTick(g, now, dt); } catch (e) { /* */ }
  };
  setInterval(X.tick, 250);
  if (VR.I18N && VR.I18N.on) VR.I18N.on(() => { stripSig = ''; const H = VR.Hints, id = H && H.current(); if (id && X.ONBOARD.indexOf(id) >= 0 && H.retext) H.retext(hintOf(id).text); });

  // ---- the settings: a search over every group and ⚙ Empfohlen
  const UI = VR.UI;
  // ---- the start screen: 🧸 Kindersicher joins „Andere Welt · ＋ Neue Welt" — one quiet row under the tiles
  if (UI && UI.prototype.build && !UI.prototype.build.__ux) {
    const ob = UI.prototype.build;
    UI.prototype.build = function () {
      const r = ob.apply(this, arguments);
      try {
        const k = document.querySelector('#title .kids'), sub = document.querySelector('#title .sub');
        if (k && sub && k.parentNode !== sub) { k.classList.remove('btn'); k.classList.add('lnk'); sub.insertBefore(k, sub.firstChild); const d = document.createElement('span'); d.className = 'dot'; d.setAttribute('aria-hidden', 'true'); d.textContent = '·'; k.after(d); }
      } catch (e) { /* the start screen as it was */ }
      return r;
    };
    UI.prototype.build.__ux = true;
  }
  X.settingsQuery = '';
  if (UI && UI.prototype.showSettings && !UI.prototype.showSettings.__ux) {
    const os = UI.prototype.showSettings;
    UI.prototype.showSettings = function (group) {
      if (group) X.settingsQuery = '';
      const r = os.apply(this, arguments);
      try { settingsBar(this); if (X.settingsQuery) searchRender(this); } catch (e) { console.warn('ux settings', e); }
      return r;
    };
    UI.prototype.showSettings.__ux = true;
  }
  function settingsBar(ui) {
    const tabs = $('settabs'); if (!tabs) return;
    let bar = $('setbar');
    if (!bar) {
      bar = document.createElement('div'); bar.id = 'setbar';
      const inp = document.createElement('input'); inp.type = 'search'; inp.id = 'setsearch'; inp.autocomplete = 'off'; inp.spellcheck = false;
      inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape' && inp.value) { e.preventDefault(); inp.value = ''; X.settingsQuery = ''; ui.showSettings(); } });
      inp.addEventListener('input', () => { X.settingsQuery = inp.value; if (!inp.value.trim()) { ui.showSettings(); inp.focus(); } else searchRender(ui); });
      const rec = document.createElement('button'); rec.type = 'button'; rec.className = 'btn small'; rec.id = 'setrec';
      rec.onclick = () => recommendNow(ui);
      bar.appendChild(inp); bar.appendChild(rec);
      tabs.after(bar);
    }
    const inp = $('setsearch'), rec = $('setrec');
    inp.placeholder = tx('ux.set.search', null, '🔎 Einstellung suchen …', '🔎 Find a setting …'); inp.setAttribute('aria-label', inp.placeholder);
    if (inp.value !== X.settingsQuery) inp.value = X.settingsQuery;
    rec.textContent = tx('ux.set.rec', null, '↺ Empfohlen', '↺ Recommended');
    rec.title = tx('ux.set.recTip', null, 'Stellt Bild, Anzeige und Größe so ein, wie es für diesen Rechner empfohlen ist.', 'Sets picture, display and size to what this computer is recommended.');
    tabs.classList.toggle('dim', !!X.settingsQuery.trim());
  }
  // every group's rows, then only those whose label and tip hold every word of the search
  function searchRender(ui) {
    const body = $('setbody'); if (!body || !VR.SettingsPanel) return;
    body.innerHTML = '';
    for (const gr of VR.Settings.GROUPS) {
      const part = document.createElement('div'); part.className = 'setgroup';
      VR.SettingsPanel.render(ui, part, gr.id);
      const pv = part.querySelector('.pvwrap'); if (pv) pv.remove();
      let n = 0;
      for (const row of part.querySelectorAll('.setrow')) { const ok = X.match(X.settingsQuery, row.textContent + ' ' + (row.title || '')); row.hidden = !ok; if (ok) n++; }
      for (const sec of part.querySelectorAll('.setsec')) sec.hidden = !sec.querySelector('.setrow:not([hidden])');
      for (const nt of part.querySelectorAll('.gpunote')) nt.remove();
      if (!n) continue;
      const h = document.createElement('div'); h.className = 'setgrouphead'; h.textContent = (gr.icon ? gr.icon + ' ' : '') + (VR.I18N ? VR.I18N.t(gr.lab) : gr.de);
      body.appendChild(h); body.appendChild(part);
    }
    if (!body.children.length) { const e = document.createElement('div'); e.className = 'note setnone'; e.textContent = tx('ux.set.none', null, 'Nichts gefunden — versuch ein anderes Wort.', 'Nothing found — try another word.'); body.appendChild(e); }
  }
  function recommendNow(ui) {
    const g = ui.game; if (!g) return;
    const p = X.recommend({ cores: navigator.hardwareConcurrency, mem: navigator.deviceMemory, gpu: VR.GL && VR.GL.rendererName });
    if (g.applyPreset) g.applyPreset(p);
    g.settings.uiScale = 1; g.settings.hudMode = 'auto';
    g.applySettings('*'); g.saveSettings();
    X.settingsQuery = ''; ui.showSettings();
    const name = VR.I18N ? VR.I18N.t({ potato: 'g.set.pVeryLow', low: 'g.set.pLow', balanced: 'g.set.pBalanced' }[p]) : p;
    if (ui.hint) ui.hint(tx('ux.set.recDone', null, '↺ Empfohlen: ', '↺ Recommended: ') + name, 2600);
  }
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
