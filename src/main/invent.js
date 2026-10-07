// ============================================================================
// 💡 Erfinden — the screen of the Erfinderwerkstatt (the cards, the pairs and the rules are src/main/inventions.js).
// A child puts two picture cards together: tap two cards, or drag one onto another card, onto a slot or onto the
// workbench. A match shows the invention big (name, one friendly line, confetti, a little jingle) and the new card joins
// the others; a miss only wobbles — nothing is lost. 💡 Tipp puts a working pair on the workbench (the child still taps
// the last "="), 📖 is the book of everything (what is still to find is a silhouette), ⌫ forgets it all after asking.
// Rewards: Creative and Zen get the item (one stack, the hotbar first) with a „💡 Neu im Inventar“ toast; Survival and a
// guest get no free item — the codex remembers it and the screen shows the crafting recipe where there is one.
// It hooks into the game by wrapping, so ui.js, game.js, start.js and audio.js stay as they are: the pause menu
// (Einfach and Profi) and 🎒 Meins get their button, key I opens it in the game, Esc steps back one layer at a time.
// Low-end PCs first: the screen opens at once (no picture is painted before it shows; the pictures come a few per
// frame, the game's icon cache keeps them), the confetti is 36 small pieces, the sound is synthesized.
// ============================================================================
(function (VR) {
  'use strict';
  const Inv = VR.Inventions, UI = VR.UI;
  if (!Inv || !UI || typeof document === 'undefined') return;
  const E = VR.Invent = {};
  const doc = document;
  const $ = (s, r) => (r || doc).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || doc).querySelectorAll(s));
  const T = (k, v) => (VR.I18N ? VR.I18N.t(k, v, k) : k);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const el = (tag, cls, html) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const game = () => VR.game;
  const calm = () => { try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } };
  const nameOf = (k) => Inv.text(k).name;
  const catOf = (k) => { const c = Inv.card(k); return c && c.cat ? c.cat : 'anfang'; };

  // ---------------------------------------------------------------- state
  let ui = null, root = null, from = 'game';
  let slots = [null, null];             // the two cards on the workbench
  let cat = 'all';                      // the tray's chapter
  let busy = false;                     // a merge, a wobble or a reveal is running
  let layer = null;                     // null | 'reveal' | 'book' | 'detail' | 'ask'
  let detailKey = null, revealAt = 0, tipPair = null, byKey = false;
  let fresh = new Set();                // found while this screen was open: a star on the card
  let toasts = [];                      // shown when the screen is left for the game
  let autoT = 0, mergeT = 0, wobbleT = 0, askT = 0;
  const cardEls = new Map();            // key → the tray card (made once, kept)
  const isOpen = () => !!(ui && root && root.isConnected && ui.screen === 'invent');

  // ---------------------------------------------------------------- pictures: a few per frame, the icon cache keeps them
  const queue = []; let pumpId = 0, pumpWait = 0;
  function paintLater(cv, id, size) { queue.push([cv, id, size || 64]); pump(); }
  function pump() {
    if (pumpId || pumpWait) return;
    const step = () => {
      pumpId = 0;
      const g = game();
      if (!g || !g.icons) { if (queue.length) pumpWait = setTimeout(() => { pumpWait = 0; pump(); }, 250); return; }
      const t0 = performance.now();
      while (queue.length && performance.now() - t0 < 6) {
        const q = queue.shift();
        try { g.icons.paint(q[0], q[1], q[2]); q[0].dataset.p = '1'; } catch (e) { /* a picture that cannot be drawn: the name is still there */ }
      }
      if (queue.length) pumpId = requestAnimationFrame(step);
    };
    pumpId = requestAnimationFrame(step);
  }
  function paintNow(cv, id, size) { const g = game(); if (!g || !g.icons || !id) return false; try { g.icons.paint(cv, id, size || 64); cv.dataset.p = '1'; return true; } catch (e) { return false; } }
  // a small picture (the formula, the recipe): painted at once, the icon cache makes the second time free
  function pic(id, cls) { const s = el('span', cls || 'erf-pic'); const c = doc.createElement('canvas'); c.width = 64; c.height = 64; c.setAttribute('aria-hidden', 'true'); s.appendChild(c); if (!paintNow(c, id)) paintLater(c, id); return s; }

  // ---------------------------------------------------------------- sound: the game's own synth (audio.tone), nothing loaded
  function sfx(kind, k) {
    const a = game() && game().audio; if (!a) return;
    try {
      if (a.resume) a.resume();
      if (!a.ctx || !a.tone) return;
      const t = a.ctx.currentTime + 0.02;
      if (kind === 'tap') { a.tone(520 + Math.random() * 140, 0.07, 0.08, 'sine', false, t); return; }
      if (kind === 'merge') { const o = a.tone(300, 0.08, 0.3, 'triangle', false, t); if (o) o.frequency.exponentialRampToValueAtTime(720, t + 0.28); return; }
      if (kind === 'nope') { const o = a.tone(310, 0.12, 0.28, 'triangle', false, t); if (o) o.frequency.exponentialRampToValueAtTime(170, t + 0.26); a.tone(150, 0.09, 0.22, 'sine', false, t + 0.15); return; }
      if (kind === 'tip') { a.tone(988, 0.08, 0.22, 'sine', true, t); a.tone(1319, 0.07, 0.32, 'sine', true, t + 0.09); return; }
      if (kind === 'again') { a.tone(784, 0.09, 0.3, 'triangle', true, t); a.tone(988, 0.08, 0.45, 'triangle', true, t + 0.1); return; }
      if (kind === 'new') {
        // a rising run on a major scale; the key of the invention picks where it starts, so each one sounds a little its own
        let h = 0; for (const ch of String(k)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
        const root0 = [523.25, 587.33, 659.25, 698.46, 783.99][h % 5], steps = [0, 2, 4, 7, 9, 12, 16];
        for (let i = 0; i < steps.length - 1; i++) a.tone(root0 * Math.pow(2, steps[i] / 12), 0.11, 0.55, 'triangle', true, t + i * 0.075);
        a.tone(root0 * 2, 0.08, 1.0, 'sine', true, t + 0.45); a.tone(root0 * 4, 0.045, 1.1, 'sine', true, t + 0.47);
      }
    } catch (e) { /* no sound is fine */ }
  }

  // ---------------------------------------------------------------- the screen
  const SHELL = `<div class="erf" role="dialog" aria-modal="true" aria-labelledby="erf-title">
    <div class="erf-under">
      <header class="erf-head">
        <button type="button" class="erf-back" data-erf="back" data-t="erf.back"></button>
        <div class="erf-ttl"><h2 id="erf-title" data-t="erf.title"></h2><p class="erf-sub" data-t="erf.sub"></p></div>
        <div class="erf-count"><span class="erf-cn" id="erf-count" aria-live="polite"></span><i class="erf-bar" aria-hidden="true"><b></b></i></div>
      </header>
      <div class="erf-main">
        <section class="erf-left">
          <div class="erf-bench" id="erf-bench">
            <button type="button" class="erf-slot" data-slot="0"><canvas width="64" height="64" aria-hidden="true"></canvas><span class="erf-name"></span><span class="erf-q" aria-hidden="true">?</span></button>
            <span class="erf-op" aria-hidden="true">+</span>
            <button type="button" class="erf-slot" data-slot="1"><canvas width="64" height="64" aria-hidden="true"></canvas><span class="erf-name"></span><span class="erf-q" aria-hidden="true">?</span></button>
            <button type="button" class="erf-eq" data-erf="make" data-tt="erf.equals" disabled><span aria-hidden="true">=</span></button>
          </div>
          <p class="erf-msg" id="erf-msg" role="status" aria-live="polite"></p>
          <div class="erf-tools">
            <button type="button" class="erf-btn erf-tipb" data-erf="tip" data-t="erf.tip" data-tt="erf.tipT"></button>
            <button type="button" class="erf-btn" data-erf="book" data-t="erf.book" data-tt="erf.bookT"></button>
            <button type="button" class="erf-btn erf-ico" data-erf="reset" data-tt="erf.resetT"><span aria-hidden="true">⌫</span></button>
          </div>
        </section>
        <section class="erf-right">
          <nav class="erf-chips" id="erf-chips"></nav>
          <div class="erf-tray" id="erf-tray"></div>
        </section>
      </div>
    </div>
    <div class="erf-layer" id="erf-layer" hidden></div>
  </div>`;

  function build() {
    if (root && root.isConnected) return;
    if (!ui || !ui.root) return;
    root = el('div', 'screen'); root.id = 'invent';
    root.innerHTML = SHELL;
    ui.root.appendChild(root);
    if (VR.I18N && VR.I18N.retext) VR.I18N.retext(root);
    bind();
  }

  // ---------------------------------------------------------------- drawing
  function hintSet() { return new Set(tipPair || (Inv.count() === 0 ? ['feuer', 'stein'] : [])); }
  function cardEl(k) {
    let b = cardEls.get(k); if (b) return b;
    b = el('button', 'erf-card'); b.type = 'button'; b.dataset.k = k;
    b.innerHTML = '<canvas width="64" height="64" aria-hidden="true"></canvas><span class="erf-name"></span>';
    cardEls.set(k, b);
    paintLater(b.firstChild, Inv.idOf(k));
    return b;
  }
  function markCards() {
    const hints = hintSet();
    for (const [k, b] of cardEls) {
      const on = slots.indexOf(k) >= 0;
      b.classList.toggle('used', on); b.classList.toggle('hint', hints.has(k) && !on); b.classList.toggle('fresh', fresh.has(k));
      b.setAttribute('aria-pressed', String(on));
    }
  }
  function renderTray() {
    const tray = $('#erf-tray', root); if (!tray) return;
    const keys = Inv.cards(), order = keys.slice(0, 6).concat(keys.slice(6).reverse());   // the start cards, then the newest first
    const frag = doc.createDocumentFragment();
    for (const k of order) {
      if (cat !== 'all' && catOf(k) !== cat) continue;
      const b = cardEl(k), nm = nameOf(k);
      b.querySelector('.erf-name').textContent = nm; b.setAttribute('aria-label', nm);
      frag.appendChild(b);
    }
    tray.textContent = ''; tray.appendChild(frag);
    markCards();
  }
  function renderChips() {
    const nav = $('#erf-chips', root); if (!nav) return;
    const mk = (k, label, icon) => { const b = el('button', 'erf-chip' + (cat === k ? ' on' : '')); b.type = 'button'; b.dataset.cat = k; b.setAttribute('aria-pressed', String(cat === k)); b.innerHTML = '<i aria-hidden="true">' + icon + '</i><span>' + esc(label) + '</span>'; return b; };
    const frag = doc.createDocumentFragment();
    frag.appendChild(mk('all', T('erf.all'), '✨'));
    for (const c of Inv.CATS) frag.appendChild(mk(c.k, T(c.t), c.icon));
    nav.textContent = ''; nav.appendChild(frag);
  }
  function renderCount() {
    const n = Inv.count(), all = Inv.TOTAL, c = $('#erf-count', root), b = $('.erf-bar b', root);
    if (c) c.textContent = T('erf.count', { n, all });
    if (b) b.style.width = Math.round(100 * n / all) + '%';
  }
  function renderSlots() {
    $$('.erf-slot', root).forEach((s, i) => {
      const k = slots[i], cv = s.querySelector('canvas'), nm = s.querySelector('.erf-name');
      s.classList.toggle('full', !!k);
      s.setAttribute('aria-label', T(i ? 'erf.slotB' : 'erf.slotA') + (k ? ': ' + nameOf(k) : ''));
      nm.textContent = k ? nameOf(k) : '';
      if (k) { if (cv.dataset.k !== k) { cv.dataset.k = k; if (!paintNow(cv, Inv.idOf(k))) paintLater(cv, Inv.idOf(k)); } }
      else if (cv.dataset.k) { delete cv.dataset.k; cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); }
    });
    const eq = $('.erf-eq', root), ready = !!(slots[0] && slots[1]) && !busy && !layer;
    eq.disabled = !ready; eq.classList.toggle('ready', ready);
    eq.classList.toggle('glow', ready && !!tipPair);
  }
  function setMsg(kind, text) { const m = $('#erf-msg', root); if (!m) return; m.dataset.kind = kind; m.textContent = text || ''; }
  function defaultMsg() { setMsg('help', Inv.count() === 0 ? T('erf.firstTry') : T('erf.help')); }
  function renderAll() {
    renderChips(); renderTray(); renderSlots(); renderCount();
    const m = $('#erf-msg', root); if (m && (!m.dataset.kind || m.dataset.kind === 'help')) defaultMsg();
    $$('.erf-ico', root).forEach((b) => b.setAttribute('aria-label', T('erf.resetT')));
    const eq = $('.erf-eq', root); if (eq) eq.setAttribute('aria-label', T('erf.equals'));
  }
  function afterSlots() { renderSlots(); markCards(); }

  // ---------------------------------------------------------------- the workbench
  function pick(k) {
    if (busy || layer || !Inv.known(k)) return;
    clearTimeout(autoT);
    const free = slots.indexOf(null);
    if (free < 0) slots = [k, null]; else slots[free] = k;   // (both full after a Tipp: a new try starts with this card; the same card twice is fine: Luft + Luft)
    tipPair = null; defaultMsg(); sfx('tap'); afterSlots();
    if (slots[0] && slots[1]) autoT = setTimeout(go, 280);
  }
  function put(i, k) {
    if (busy || layer || !Inv.known(k)) return;
    clearTimeout(autoT); slots[i] = k; tipPair = null; defaultMsg(); sfx('tap'); afterSlots();
    if (slots[0] && slots[1]) autoT = setTimeout(go, 220);
  }
  function clearSlot(i) { if (busy || layer) return; clearTimeout(autoT); slots[i] = null; tipPair = null; defaultMsg(); afterSlots(); }
  function go() {
    clearTimeout(autoT);
    if (busy || layer || !slots[0] || !slots[1]) return;
    const a = slots[0], b = slots[1], r = Inv.combine(a, b);
    busy = true; renderSlots();
    if (!r.ok) { wobble(); return; }
    const bench = $('#erf-bench', root); bench.classList.add('merge'); sfx('merge');
    mergeT = setTimeout(() => { bench.classList.remove('merge'); reveal(r, a, b); }, calm() ? 60 : 320);
  }
  function wobble() {
    const bench = $('#erf-bench', root);
    bench.classList.add('wobble'); setMsg('nope', T('erf.nope')); sfx('nope');
    wobbleT = setTimeout(() => { bench.classList.remove('wobble'); slots = [null, null]; busy = false; tipPair = null; afterSlots(); }, 720);
  }
  function tip() {
    if (busy || layer) return;
    const t = Inv.tip();
    if (!t) { setMsg('done', T('erf.tipNone')); return; }
    clearTimeout(autoT); cat = 'all'; slots = [t.a, t.b]; tipPair = [t.a, t.b];
    setMsg('tip', T('erf.tipSay')); sfx('tip');
    renderChips(); renderTray(); afterSlots();
  }

  // ---------------------------------------------------------------- the layer (reveal · book · detail · ask)
  const layerEl = () => $('#erf-layer', root);
  function showLayer(kind, cls) {
    const L = layerEl(), under = $('.erf-under', root);
    layer = kind; L.hidden = false; L.className = 'erf-layer ' + (cls || kind);
    if (under) under.inert = true;
    renderSlots();
    return L;
  }
  function hideLayer() {
    const L = layerEl(), under = $('.erf-under', root);
    layer = null; if (L) { L.hidden = true; L.innerHTML = ''; L.className = 'erf-layer'; }
    if (under) under.inert = false;
    renderSlots();
  }
  const focusIn = (sel) => { const L = layerEl(), b = L && $(sel, L); if (b && b.focus) { try { b.focus({ preventScroll: true }); } catch (e) { b.focus(); } } };

  // the crafting recipe the item has in Survival, as pictures
  function recipeEl(id) {
    const rc = Inv.recipeFor(id), wrap = el('div', 'erf-craft');
    if (!rc) { wrap.appendChild(el('p', 'erf-note', esc(T('erf.onlyInvent')))); return wrap; }
    wrap.appendChild(el('p', 'erf-note', esc(T('erf.recipe'))));
    const row = el('div', 'erf-crow');
    if (rc.kind === 'shaped') {
      const g = el('div', 'erf-cgrid'); g.style.gridTemplateColumns = 'repeat(' + rc.w + ', 1fr)';
      for (const r of rc.grid) for (const c of r) g.appendChild(c ? pic(c, 'erf-cc') : el('i', 'erf-cc empty'));
      row.appendChild(g);
    } else {
      rc.list.forEach((c, i) => { if (i) row.appendChild(el('b', 'erf-cplus', '+')); row.appendChild(pic(c, 'erf-cc')); });
    }
    row.appendChild(el('b', 'erf-carrow', '→'));
    const out = pic(id, 'erf-cc out'); if (rc.n > 1) out.appendChild(el('em', 'erf-cn2', '×' + rc.n)); row.appendChild(out);
    wrap.appendChild(row);
    return wrap;
  }
  // 36 small pieces of paper, thrown from the middle (Web Animations; none for a player who wants calm)
  function confetti(host) {
    if (calm() || !host || !host.animate) return;
    const cols = ['#ffd24d', '#ff7a59', '#5fe3c0', '#6aa8ff', '#ff6fd0', '#ffffff'], r = host.getBoundingClientRect();
    const cx = r.width / 2, cy = Math.min(r.height * 0.4, 260);
    for (let i = 0; i < 36; i++) {
      const p = el('i', 'erf-cf'), a = Math.random() * Math.PI * 2, d = 110 + Math.random() * Math.min(300, r.width * 0.42);
      p.style.cssText = 'left:' + cx + 'px;top:' + cy + 'px;background:' + cols[i % cols.length] + ';width:' + (6 + Math.random() * 6) + 'px;height:' + (9 + Math.random() * 8) + 'px';
      host.appendChild(p);
      const dx = Math.cos(a) * d, dy = Math.sin(a) * d * 0.75 - 50, rot = (Math.random() - 0.5) * 900;
      const an = p.animate([
        { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
        { transform: 'translate(' + dx + 'px,' + dy + 'px) rotate(' + rot + 'deg)', opacity: 1, offset: 0.55 },
        { transform: 'translate(' + dx * 1.06 + 'px,' + (dy + 110) + 'px) rotate(' + rot * 1.3 + 'deg)', opacity: 0 },
      ], { duration: 1100 + Math.random() * 800, easing: 'cubic-bezier(.15,.7,.3,1)', fill: 'forwards' });
      an.onfinish = () => { if (p.parentNode) p.remove(); };
    }
  }
  function reveal(r, a, b) {
    const g = game(), ctx = Inv.ctxOf(g), reward = Inv.reward(ctx), k = r.k, id = r.id, tx = Inv.text(k);
    let pill = null;
    if (reward === 'inventory') {
      const res = Inv.grant(g, k);
      if (res.ok && res.added > 0) { pill = ['inv', T('erf.toInv')]; toasts.push([T('erf.toInv'), tx.name, id]); try { if (ui.updateHUD) ui.updateHUD(true); } catch (e) { /* the hotbar catches up */ } }
      else if (res.ok) pill = ['inv', T('erf.toInv')];
      else if (res.reason === 'full') pill = ['full', T('erf.invFull')];
    } else if (reward === 'codex') {
      pill = ['codex', T('erf.codexNote')];
      if (r.isNew) toasts.push([T('g.codex.toastInvention'), tx.name, id]);
    }
    if (r.isNew) fresh.add(k);
    detailKey = k; revealAt = performance.now();
    const L = showLayer('reveal');
    L.innerHTML = '<div class="erf-rv" role="dialog" aria-modal="true" aria-labelledby="erf-rvn" tabindex="-1"><div class="erf-conf" aria-hidden="true"></div><div class="erf-rays" aria-hidden="true"></div>' +
      '<div class="erf-from" aria-hidden="true"></div><div class="erf-big"></div>' +
      '<div class="erf-badge">' + esc(T(r.isNew ? 'erf.new' : 'erf.again')) + '</div>' +
      '<h3 class="erf-rn" id="erf-rvn">' + esc(tx.name) + '</h3><p class="erf-rl">' + esc(tx.line) + '</p>' +
      (pill ? '<div class="erf-pill ' + pill[0] + '">' + esc(pill[1]) + '</div>' : '') +
      '<button type="button" class="erf-btn primary erf-go" data-erf="close">' + esc(T('erf.cont')) + '</button></div>';
    const from0 = $('.erf-from', L);
    from0.appendChild(pic(Inv.idOf(a), 'erf-pic')); from0.appendChild(el('b', '', '+')); from0.appendChild(pic(Inv.idOf(b), 'erf-pic'));
    const big = $('.erf-big', L), cv = doc.createElement('canvas'); cv.width = 64; cv.height = 64; cv.setAttribute('aria-hidden', 'true'); big.appendChild(cv);
    if (!paintNow(cv, id)) paintLater(cv, id);
    if (reward === 'codex') $('.erf-rv', L).insertBefore(recipeEl(id), $('.erf-go', L));
    renderCount(); renderTray();
    if (r.isNew) { sfx('new', k); confetti($('.erf-conf', L)); } else sfx('again');
    focusIn('.erf-go');
  }
  function closeReveal() {
    if (layer !== 'reveal' || performance.now() - revealAt < 450) return;
    hideLayer();
    const k = detailKey; slots = [null, null]; tipPair = null; busy = false;
    const tray = $('#erf-tray', root); if (tray) tray.scrollTop = 0;
    renderChips(); renderTray(); afterSlots(); renderCount();
    if (Inv.count() >= Inv.TOTAL) setMsg('done', T('erf.allDone')); else defaultMsg();
    const c = k && cardEls.get(k);
    if (c && !calm()) { c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); setTimeout(() => c.classList.remove('pop'), 900); }
    if (byKey && c && c.isConnected) { try { c.focus({ preventScroll: true }); } catch (e) { /* */ } }
  }

  // ---------------------------------------------------------------- 📖 the book
  let io = null;
  function openBook() {
    if (busy || layer) return;
    const L = showLayer('book');
    L.innerHTML = '<div class="erf-bk" role="document"><header class="erf-bkh"><div><h3>' + esc(T('erf.bookTitle')) + '</h3><p class="erf-note" id="erf-bksum"></p></div><button type="button" class="erf-btn erf-x" data-erf="close" aria-label="' + esc(T('erf.back')) + '"><span aria-hidden="true">✕</span></button></header><div class="erf-bkbody" id="erf-bkbody"></div></div>';
    renderBook(); focusIn('.erf-x');
  }
  function renderBook() {
    const L = layerEl(), body = $('#erf-bkbody', L); if (!body) return;
    layer = 'book'; L.className = 'erf-layer book';
    const sum = $('#erf-bksum', L); if (sum) sum.textContent = T('erf.bookSum', { n: Inv.count(), all: Inv.TOTAL });
    if (io) { io.disconnect(); io = null; }
    if ('IntersectionObserver' in window) io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { io.unobserve(e.target); paintLater(e.target, e.target.dataset.id, 64); } }, { root: body, rootMargin: '200px' });
    const frag = doc.createDocumentFragment();
    for (const c of Inv.CATS) {
      const list = Inv.LIST.filter((x) => x.cat === c.k), got = list.filter((x) => Inv.has(x.k)).length;
      frag.appendChild(el('h4', 'erf-bkc', '<i aria-hidden="true">' + c.icon + '</i> ' + esc(T(c.t)) + ' <span>' + got + ' / ' + list.length + '</span>'));
      const grid = el('div', 'erf-tiles');
      for (const x of list) {
        const have = Inv.has(x.k), t = have ? el('button', 'erf-tile') : el('div', 'erf-tile locked');
        if (have) { t.type = 'button'; t.dataset.k = x.k; t.setAttribute('aria-label', nameOf(x.k)); } else { t.setAttribute('role', 'img'); t.setAttribute('aria-label', T('erf.locked')); }
        const cv = doc.createElement('canvas'); cv.width = 64; cv.height = 64; cv.dataset.id = x.id; cv.setAttribute('aria-hidden', 'true');
        t.appendChild(cv); t.appendChild(el('span', 'erf-name', have ? esc(nameOf(x.k)) : '???'));
        grid.appendChild(t);
        if (io) io.observe(cv); else paintLater(cv, x.id, 64);
      }
      frag.appendChild(grid);
    }
    body.textContent = ''; body.appendChild(frag); body.scrollTop = 0;
  }
  function closeBook() {
    if (io) { io.disconnect(); io = null; }
    hideLayer(); defaultMsg();
    const b = $('[data-erf="book"]', root); if (b && byKey) b.focus({ preventScroll: true });
  }
  function openDetail(k) {
    const L = layerEl(), body = $('#erf-bkbody', L); if (!body || !Inv.has(k)) return;
    layer = 'detail'; detailKey = k; L.className = 'erf-layer book detail';
    const tx = Inv.text(k), id = Inv.idOf(k), pr = Inv.pairOf(k), reward = Inv.reward(Inv.ctxOf(game()));
    body.innerHTML = '<div class="erf-dt"><button type="button" class="erf-btn erf-bb" data-erf="bookback" data-t="erf.back"></button>' +
      '<div class="erf-big"></div><h3 class="erf-rn">' + esc(tx.name) + '</h3><p class="erf-rl">' + esc(tx.line) + '</p>' +
      '<p class="erf-note">' + esc(T('erf.mix')) + '</p><div class="erf-formula"></div><div class="erf-dx"></div></div>';
    if (VR.I18N && VR.I18N.retext) VR.I18N.retext(body);
    const big = $('.erf-big', body), cv = doc.createElement('canvas'); cv.width = 64; cv.height = 64; big.appendChild(cv); if (!paintNow(cv, id)) paintLater(cv, id);
    const f = $('.erf-formula', body);
    const part = (kk) => { const d = el('div', 'erf-fp'); d.appendChild(pic(Inv.idOf(kk), 'erf-pic')); d.appendChild(el('span', 'erf-name', esc(nameOf(kk)))); return d; };
    if (pr) { f.appendChild(part(pr[0])); f.appendChild(el('b', '', '+')); f.appendChild(part(pr[1])); f.appendChild(el('b', '', '=')); const d = el('div', 'erf-fp out'); d.appendChild(pic(id, 'erf-pic')); d.appendChild(el('span', 'erf-name', esc(tx.name))); f.appendChild(d); }
    const dx = $('.erf-dx', body);
    if (reward === 'codex') dx.appendChild(recipeEl(id));
    else if (reward === 'inventory') { const t = el('button', 'erf-btn primary erf-take', esc(T('erf.take'))); t.type = 'button'; t.dataset.erf = 'take'; dx.appendChild(t); dx.appendChild(el('p', 'erf-note erf-takemsg', '')); }
    body.scrollTop = 0; focusIn('.erf-bb');
  }
  function takeIt() {
    const k = detailKey; if (!k || layer !== 'detail') return;
    const res = Inv.grant(game(), k), note = $('.erf-takemsg', layerEl());
    if (res.ok && res.added > 0) { toasts.push([T('erf.toInv'), nameOf(k), Inv.idOf(k)]); try { if (ui.updateHUD) ui.updateHUD(true); } catch (e) { /* */ } if (note) note.textContent = T('erf.toInv'); sfx('again'); }
    else if (res.ok) { if (note) note.textContent = T('erf.toInv'); }
    else if (note) note.textContent = res.reason === 'full' ? T('erf.invFull') : '';
  }

  // ---------------------------------------------------------------- ⌫ forget everything (after asking)
  function openAsk() {
    if (busy || layer) return;
    const L = showLayer('ask');
    L.innerHTML = '<div class="erf-ak" role="alertdialog" aria-labelledby="erf-akt"><h3 id="erf-akt">' + esc(T('erf.askTitle')) + '</h3><p>' + esc(T('erf.askText')) + '</p>' +
      '<div class="erf-akb"><button type="button" class="erf-btn primary erf-no" data-erf="no">' + esc(T('erf.askNo')) + '</button><button type="button" class="erf-btn danger" data-erf="yes">' + esc(T('erf.askYes')) + '</button></div></div>';
    focusIn('.erf-no');
  }
  function closeAsk(yes) {
    if (layer !== 'ask') return;
    hideLayer();
    if (yes) {
      Inv.reset(); slots = [null, null]; fresh = new Set(); tipPair = null; cat = 'all'; toasts = [];
      renderChips(); renderTray(); afterSlots(); renderCount(); setMsg('help', T('erf.askDone'));
    } else { const b = $('[data-erf="reset"]', root); if (b && byKey) b.focus({ preventScroll: true }); }
  }

  // ---------------------------------------------------------------- opening and leaving
  E.open = function (u, where) {
    ui = u || (game() && game().ui); if (!ui) return false;
    if (isOpen()) return true;
    build(); if (!root) return false;
    from = where && where !== 'key' ? where : (ui.screen === 'pause' ? 'pause' : ui.screen === 'meins' ? 'meins' : 'game');
    clearTimeout(autoT); clearTimeout(mergeT); clearTimeout(wobbleT);
    slots = [null, null]; cat = 'all'; busy = false; layer = null; tipPair = null; fresh = new Set(); toasts = [];
    hideLayer();
    ui.show('invent');
    byKey = (VR.Start && VR.Start.kbd) || where === 'key';
    if (VR.I18N && VR.I18N.retext) VR.I18N.retext(root);   // (the words may have changed while it was closed)
    renderAll(); defaultMsg();
    if (byKey) { const c = $('#erf-tray .erf-card', root); if (c) c.focus({ preventScroll: true }); }
    return true;
  };
  E.close = function () {
    if (!isOpen()) return;
    cancelDrag(); clearTimeout(autoT); clearTimeout(mergeT); clearTimeout(wobbleT);
    if (io) { io.disconnect(); io = null; }
    busy = false; if (layer) hideLayer();
    const g = game(), ts = toasts; toasts = [];
    if (from === 'pause' && g && g.state === 'play') ui.show('pause');
    else if (from === 'meins' && VR.Start && VR.Start.meins) VR.Start.meins(VR.Start.meinsFrom);
    else if (g && g.state === 'play') ui.resume();
    else ui.show('title');
    if (from === 'game' && g && g.state === 'play') for (const t of ts.slice(-3)) { try { ui.toast(t[0], t[1], t[2]); } catch (e) { /* */ } }
  };
  // Esc: one layer back, then out
  E.back = function () {
    if (!isOpen()) return;
    if (layer === 'ask') closeAsk(false);
    else if (layer === 'detail') { renderBook(); focusIn('.erf-x'); }
    else if (layer === 'book') closeBook();
    else if (layer === 'reveal') { revealAt = 0; closeReveal(); }
    else if (drag) cancelDrag();
    else E.close();
  };
  E.isOpen = isOpen;
  E.state = () => ({ open: isOpen(), slots: slots.slice(), layer, cat, busy, from, count: Inv.count(), tip: tipPair ? tipPair.slice() : null });

  // ---------------------------------------------------------------- drag (a mouse moves at once; a finger holds a moment)
  let drag = null, ghost = null, swallow = 0, dropT = null;
  function startDrag(x, y) {
    if (!drag) return;
    drag.on = true; swallow = 1;
    ghost = el('div', 'erf-ghost'); const cv = doc.createElement('canvas'); cv.width = 64; cv.height = 64; paintNow(cv, Inv.idOf(drag.k)); ghost.appendChild(cv);
    root.appendChild(ghost); drag.src.classList.add('lift'); moveGhost(x, y);
  }
  function moveGhost(x, y) {
    if (!ghost) return;
    ghost.style.transform = 'translate(' + (x - 40) + 'px,' + (y - 52) + 'px) rotate(-6deg) scale(1.08)';
    if (drag && !drag.raf) drag.raf = requestAnimationFrame(() => {
      if (!drag) return; drag.raf = 0;
      const t = doc.elementFromPoint(x, y), tgt = t && t.closest ? (t.closest('.erf-slot') || t.closest('.erf-card')) : null;
      if (dropT && dropT !== tgt) dropT.classList.remove('drop');
      dropT = tgt && !(tgt.classList.contains('erf-card') && tgt.dataset.k === drag.k) ? tgt : null; if (dropT) dropT.classList.add('drop');
    });
  }
  function endGhost() {
    if (ghost) { ghost.remove(); ghost = null; }
    if (dropT) { dropT.classList.remove('drop'); dropT = null; }
    $$('.lift', root).forEach((n) => n.classList.remove('lift'));
  }
  function cancelDrag() { if (!drag) return; clearTimeout(drag.hold); if (drag.raf) cancelAnimationFrame(drag.raf); const on = drag.on; drag = null; endGhost(); if (on) setTimeout(() => { swallow = 0; }, 60); }
  function onDown(e) {
    if (busy || layer || (e.button !== undefined && e.button > 0) || drag) return;
    const c = e.target.closest ? e.target.closest('.erf-card') : null; if (!c || !c.dataset.k) return;
    drag = { k: c.dataset.k, id: e.pointerId, x0: e.clientX, y0: e.clientY, on: false, touch: e.pointerType === 'touch' || e.pointerType === 'pen', src: c, hold: 0, raf: 0 };
    if (drag.touch) drag.hold = setTimeout(() => { if (drag && !drag.on) startDrag(drag.x0, drag.y0); }, 280);
  }
  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.on) {
      const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
      if (dx * dx + dy * dy < (drag.touch ? 100 : 36)) return;
      if (drag.touch) { clearTimeout(drag.hold); drag = null; return; }   // the finger moved first: it scrolls the tray
      startDrag(e.clientX, e.clientY);
    }
    moveGhost(e.clientX, e.clientY);
  }
  function onUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    clearTimeout(drag.hold);
    const d = drag, x = e.clientX, y = e.clientY; if (d.raf) cancelAnimationFrame(d.raf);
    drag = null;
    if (!d.on) return;
    endGhost(); setTimeout(() => { swallow = 0; }, 60);
    const t = doc.elementFromPoint(x, y); if (!t || !t.closest || !isOpen()) return;
    const slot = t.closest('.erf-slot'), card = t.closest('.erf-card');
    if (slot) put(+slot.dataset.slot, d.k);
    else if (card && card.dataset.k) { if (busy || layer) return; clearTimeout(autoT); slots = [d.k, card.dataset.k]; tipPair = null; defaultMsg(); sfx('tap'); afterSlots(); autoT = setTimeout(go, 120); }
    else if (t.closest('.erf-bench')) pick(d.k);
  }

  // ---------------------------------------------------------------- events
  function act(a) {
    switch (a) {
      case 'back': E.close(); break;
      case 'make': go(); break;
      case 'tip': tip(); break;
      case 'book': openBook(); break;
      case 'reset': openAsk(); break;
      case 'close': if (layer === 'reveal') closeReveal(); else if (layer === 'book' || layer === 'detail') closeBook(); break;
      case 'bookback': renderBook(); focusIn('.erf-x'); break;
      case 'take': takeIt(); break;
      case 'yes': closeAsk(true); break;
      case 'no': closeAsk(false); break;
    }
  }
  function bind() {
    root.addEventListener('click', (e) => {
      if (swallow) { swallow = 0; return; }
      const t = e.target, a = t.closest('[data-erf]');
      if (a) { act(a.dataset.erf); return; }
      if (layer === 'reveal') { closeReveal(); return; }   // (a tap anywhere on the invention goes on)
      const tile = t.closest('.erf-tile'); if (tile && tile.dataset.k && layer === 'book') { openDetail(tile.dataset.k); return; }
      if (layer) { if (t.id === 'erf-layer') { if (layer === 'ask') closeAsk(false); else closeBook(); } return; }
      const card = t.closest('.erf-card'); if (card) { pick(card.dataset.k); return; }
      const slot = t.closest('.erf-slot'); if (slot) { clearSlot(+slot.dataset.slot); return; }
      const chip = t.closest('.erf-chip');
      if (chip) {
        cat = chip.dataset.cat; renderChips(); renderTray();
        const tray = $('#erf-tray', root); if (tray) tray.scrollTop = 0;
        if (byKey) { const c = $('[data-cat="' + cat + '"]', root); if (c) c.focus({ preventScroll: true }); }
      }
    });
    root.addEventListener('pointerdown', onDown);
    root.addEventListener('contextmenu', (e) => { if (e.target.closest && e.target.closest('.erf-card, .erf-slot, .erf-ghost')) e.preventDefault(); });
    root.addEventListener('touchmove', (e) => { if (drag && drag.on && e.cancelable) e.preventDefault(); }, { passive: false });
    root.addEventListener('keydown', (e) => {
      if (e.key === 'Tab' && layer) {
        const f = $$('button:not([disabled])', layerEl()); if (!f.length) return;
        const first = f[0], last = f[f.length - 1], on = doc.activeElement;
        if (!layerEl().contains(on)) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && on === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && on === last) { e.preventDefault(); first.focus(); }
        return;
      }
      if (layer || !/^Arrow(Left|Right|Up|Down)$/.test(e.key)) return;
      const on = doc.activeElement; if (!on || !on.classList || !on.classList.contains('erf-card')) return;
      const list = $$('#erf-tray .erf-card', root), i = list.indexOf(on); if (i < 0) return;
      let j = i;
      if (e.key === 'ArrowRight') j = i + 1; else if (e.key === 'ArrowLeft') j = i - 1;
      else { const top = on.offsetTop, row = list.filter((n) => n.offsetTop === top).length || 1; j = e.key === 'ArrowDown' ? i + row : i - row; }
      if (j >= 0 && j < list.length && j !== i) { e.preventDefault(); list[j].focus({ preventScroll: false }); }
    });
  }

  // ---------------------------------------------------------------- the listeners that are there from the start
  function bindGlobal() {
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', () => cancelDrag());
    // key I: the workshop, in the game (never while typing, with a menu up, in photo mode, dead, or with the Studio over it)
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'KeyI' || e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
      const t = e.target; if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
      if (isOpen()) { if (!layer && !busy) { e.preventDefault(); E.close(); } return; }
      const g = game(); if (!g || g.state !== 'play' || !g.player || g.player.dead || !g.ui) return;
      if (g.ui.screen || g.ui.typing || g.photo || g.studioOpen || (g.director && g.director.active)) return;
      e.preventDefault(); E.open(g.ui, 'key');
    });
    // Esc: one step back (capture: the game's own Esc must not open the pause menu on top)
    window.addEventListener('keydown', (e) => { if (e.key !== 'Escape' || !isOpen()) return; e.preventDefault(); e.stopImmediatePropagation(); E.back(); }, true);
    // the language switches live; another tab found something
    if (VR.I18N && VR.I18N.on) VR.I18N.on(() => { if (isOpen()) { if (VR.I18N.retext) VR.I18N.retext(root); renderAll(); if (layer === 'book') renderBook(); } });
    Inv.on((e) => { if ((e.type === 'sync' || e.type === 'reset') && isOpen() && !layer) { slots = [null, null]; busy = false; renderAll(); } });
  }

  // ---------------------------------------------------------------- the ways in: the pause menu, 🎒 Meins
  const origAct = UI.prototype.act;
  UI.prototype.act = function (a, b) { if (a === 'invent') { E.open(this); return; } return origAct.call(this, a, b); };
  // the pause menu (Einfach and Profi): 💡 beside 🎒 Meins, one row — the Einfach menu stays as high as it was
  function hookPause() {
    const panel = $('#pause .panel'); if (!panel || !panel.dataset.w1 || panel.querySelector('[data-act="invent"]')) return;
    const meins = panel.querySelector('[data-act="meins"]'); if (!meins || !meins.parentNode) return;
    const row = el('div', 'row gap erf-prow'); meins.parentNode.insertBefore(row, meins); row.appendChild(meins); meins.style.flex = '1';
    row.insertAdjacentHTML('beforeend', '<button type="button" class="btn" data-act="invent" style="flex:1" data-t="g.pause.invent" data-tt="g.pause.inventTip"></button>');
    if (VR.I18N && VR.I18N.retext) VR.I18N.retext(row);
  }
  const origPause = UI.prototype.pause;
  UI.prototype.pause = function () { origPause.call(this); try { hookPause(); } catch (e) { console.warn('invent: pause menu', e); } };
  // 🎒 Meins: a card first in „Alles“, drawn in pictures (🔥 + 🪨 = 💡), no reading needed
  const ST = VR.Start;
  if (ST && ST.renderMeins) {
    const origMeins = ST.renderMeins;
    ST.renderMeins = async function () {
      const r = await origMeins.apply(this, arguments);
      try {
        const body = $('#meins .mbody');
        if (body && !body.querySelector('.erf-mcard') && (ST.meinsChip || 'all') === 'all') {
          const b = el('button', 'erf-mcard'); b.type = 'button'; b.dataset.act = 'invent';
          b.innerHTML = '<span class="erf-mpic" aria-hidden="true"><i>🔥</i><b>+</b><i>🪨</i><b>=</b><i>💡</i></span><span class="erf-mlbl">' + esc(T('erf.meins')) + '</span><span class="erf-msub">' + esc(T('erf.meinsSub')) + '</span>';
          body.insertBefore(b, body.firstChild);
        }
      } catch (e) { console.warn('invent: meins card', e); }
      return r;
    };
  }
  bindGlobal();
})(VR);
