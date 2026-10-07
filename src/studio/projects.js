// ============================================================================
// R9 Studio · 🕘 Weitermachen (v0.36) — everything you started, one click away.
// Every house and every piece of furniture you change in the Crafter is kept as
// a draft two seconds after each change (with the camera, the tool and the
// hotbar); the game sees it only when you press "Ins Spiel". Baukasten houses,
// Genie creations, planned places and the worlds you worked in are remembered
// the same way. 🕘 in the top bar — or Strg+O, from anywhere — shows them all as
// big pictures, the last one first; one click and you are back exactly there.
// 📌 pin, ✓ done, ✎ rename, 🗑 remove. The Studio opens on this page whenever
// there is something to continue.
// Storage (localStorage of this page — in the game that is the game's own):
//   'r9si.projects'    the list {v:1, items: {id: entry}}
//   'r9si.wip.<id>'    a project's own data (a Crafter draft, a Baukasten house, a Genie design, a plan)
//   'r9si.thumb.<id>'  its picture (a small JPEG)
// ids: h:<house index> · m:<model name> · k… Baukasten · g… Genie · s… Ort · w:<world id>
// Each kind plugs in with VR.Projects.kind(name, {icon, label, state, live, open, discard, rename});
// the modules that own unsaved work register a flush (VR.Projects.onFlush) that runs before the
// page goes away, when the list opens and on Strg+S.
// ============================================================================
(function () {
  'use strict';
  const C = window.__studioCore; if (!C) return;
  const { $ } = C;
  const KEY = 'r9si.projects', WIP = 'r9si.wip.', THK = 'r9si.thumb.';
  const L = (k, de, v) => (VR.I18N && VR.I18N.t ? VR.I18N.t(k, v, de) : String(de).replace(/\{(\w+)\}/g, (m, x) => (v && v[x] !== undefined ? v[x] : m)));
  const IC = (n, sz, cls) => (window.__studioIcons ? window.__studioIcons.svg(n, sz, cls) : '');
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = C.fmt;
  const SA = !!C.SA;   // the standalone Studio: "💾 gespeichert", never "im Spiel"

  // ---------------------------------------------------------------- storage: when the browser's storage is full, pictures go first
  let warned = false, failAt = 0;
  const thumbMem = new Map();
  const ls = {
    raw(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    get(k) { const t = ls.raw(k); if (!t) return null; try { return JSON.parse(t); } catch (e) { return null; } },
    set(k, v) {
      const s = typeof v === 'string' ? v : JSON.stringify(v);
      let lv = 0;
      for (;;) {
        try { localStorage.setItem(k, s); return true; } catch (e) { /* full, or storage blocked */ }
        let freed = false; while (!freed && lv < 2) freed = prune(lv++);
        if (!freed) break;
      }
      if (!warned) { warned = true; C.sys('⚠ ' + L('pj.full2', 'Browser-Speicher voll — Entwürfe und Bilder sind nur bis zum Schließen da'), 'err'); }
      failAt = Date.now();
      if (C.full) C.full('projects');
      return false;
    },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* */ } },
  };
  // level 0: pictures of finished, removed and old projects · level 1: all but the ten newest pictures
  function prune(level) {
    const items = Object.values(reg().items).sort((a, b) => (b.t || 0) - (a.t || 0));
    let n = 0;
    items.forEach((p, i) => { const drop = level === 0 ? (p.done || p.hide || i >= 30) : i >= 10; if (drop && ls.raw(THK + p.id) !== null) { ls.del(THK + p.id); thumbMem.delete(p.id); n++; } });
    return n > 0;
  }

  // ---------------------------------------------------------------- the list
  let REG = null;
  function reg() {
    if (!REG) { const d = ls.get(KEY); REG = d && d.items && typeof d.items === 'object' && !Array.isArray(d.items) ? d : { v: 1, items: {} }; }
    return REG;
  }
  const persist = () => ls.set(KEY, reg());
  // another tab (or the game) changed the list
  window.addEventListener('storage', (e) => { if (e.key === KEY) { REG = null; changed(); } else if (e.key && e.key.startsWith(THK)) { thumbMem.delete(e.key.slice(THK.length)); changed(); } });

  const PJ = VR.Projects = {
    kinds: {},
    get: (id) => reg().items[id] || null,
    // create or change an entry; touch (default): it counts as worked on now (back in the list, no longer "done")
    put(id, patch, opt) {
      const it = reg().items, now = Date.now(), touch = !opt || opt.touch !== false;
      let p = it[id];
      if (!p) { if (opt && opt.ifExists) return null; p = it[id] = { id, created: now, t: now }; }
      Object.assign(p, patch || {});
      if (touch) { p.t = now; p.hide = false; p.done = false; }
      persist(); changed();
      return p;
    },
    seen(id) { const p = reg().items[id]; if (p) { p.seen = Date.now(); persist(); } return p; },
    remove(id) { delete reg().items[id]; ls.del(WIP + id); ls.del(THK + id); thumbMem.delete(id); persist(); changed(); },
    data: (id) => ls.get(WIP + id),
    hasData: (id) => ls.raw(WIP + id) !== null,
    setData: (id, d) => ls.set(WIP + id, d),
    dropData: (id) => ls.del(WIP + id),
    dropThumb: (id) => { ls.del(THK + id); thumbMem.delete(id); },
    thumbURL: (id) => { if (thumbMem.has(id)) return thumbMem.get(id); const u = ls.raw(THK + id); if (u) thumbMem.set(id, u); return u; },
    // a picture for the card (480 × 300 JPEG — sharp enough for the big card); fit 'contain' keeps the whole picture (a map), else it fills the card
    thumb(id, src, fit) {
      if (!src || !src.width || !src.height || !reg().items[id]) return false;
      const W = 480, H = 300, c = document.createElement('canvas'); c.width = W; c.height = H;
      const x = c.getContext('2d'); x.fillStyle = '#07090d'; x.fillRect(0, 0, W, H);
      const k = fit === 'contain' ? Math.min(W / src.width, H / src.height) : Math.max(W / src.width, H / src.height), w = src.width * k, h = src.height * k;
      try { x.drawImage(src, (W - w) / 2, (H - h) / 2, w, h); } catch (e) { return false; }
      let url = ''; try { url = c.toDataURL('image/jpeg', 0.8); } catch (e) { return false; }
      if (!ls.set(THK + id, url)) return false;
      thumbMem.set(id, url); changed();
      return true;
    },
    newId: (k) => k + Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36),
    kind(name, def) { PJ.kinds[name] = def; },
    rename(id, name) {
      const p = reg().items[id]; if (!p) return;
      name = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 60);
      const K = PJ.kinds[p.kind];
      if (K && K.rename) K.rename(p, name); else p.label = name && name !== p.name ? name : '';
      persist(); changed();
    },
    // 🗑: the kind decides (a Crafter house only leaves the list and drops its draft — the game keeps what it has)
    discard(id) { const p = reg().items[id]; if (!p) return; const K = PJ.kinds[p.kind]; if (K && K.discard) K.discard(p); else PJ.remove(id); changed(); },
    nameOf: (p) => (p && (p.label || p.name)) || '…',
    // room for what matters more (the designs the game reads): pictures go
    freeSpace: () => prune(0) || prune(1),
  };

  // designs saved before this list existed (or imported) are projects too
  function sync() {
    const it = reg().items; let add = 0;
    const st = (VR.Custom && VR.Custom.load()) || {};
    for (const k of Object.keys(st.houses || {})) {
      const id = 'h:' + k; if (it[id]) continue;
      const h = st.houses[k] || {}, H = C.HOUSES.find(x => x.i === +k);
      it[id] = { id, kind: 'house', name: H ? H.name : h.name || 'Haus ' + k, ref: { index: +k }, created: h.t || 0, t: h.t || 0 }; add++;
    }
    for (const n of Object.keys(st.models || {})) {
      const id = 'm:' + n; if (it[id]) continue;
      const m = VR.VM && VR.VM.MODELS && VR.VM.MODELS[n];
      it[id] = { id, kind: 'item', name: m ? m.display || n : n, ref: { name: n }, created: st.models[n].t || 0, t: st.models[n].t || 0 }; add++;
    }
    if (add) persist();
    return st;
  }
  PJ.sync = sync;
  // what the list shows: every live project, the last one worked on first
  function list() {
    const st = sync(), out = [];
    for (const p of Object.values(reg().items)) {
      if (!p || p.hide) continue;
      const K = PJ.kinds[p.kind]; if (!K) continue;
      let s = null; try { s = K.state ? K.state(p, st) : { live: true }; } catch (e) { s = null; }
      if (!s || !s.live) continue;
      out.push({ p, s, K });
    }
    out.sort((a, b) => (b.p.t || 0) - (a.p.t || 0));
    return out;
  }
  PJ.list = list;

  // ---------------------------------------------------------------- unsaved work goes to storage: before the page goes, when the list opens, on Strg+S
  const flushers = [];
  PJ.onFlush = (fn) => { flushers.push(fn); };
  PJ.flush = function (opt) { for (const f of flushers) { try { f(opt || {}); } catch (e) { console.warn('flush', e); } } };
  window.addEventListener('pagehide', () => PJ.flush({ thumbs: true, final: true }));
  document.addEventListener('visibilitychange', () => { if (document.hidden) PJ.flush({ thumbs: false }); });

  // ---------------------------------------------------------------- when the Studio can open things (textures forged)
  const ready = () => { const st = $('#studio'); return !!st && !st.classList.contains('boot') && !!C.texInfo(); };
  PJ.ready = ready;
  function whenReady(fn, t0) {
    t0 = t0 || Date.now();
    if (ready()) { fn(); return; }
    if (Date.now() - t0 > 120000) return;
    setTimeout(() => whenReady(fn, t0), 200);
  }
  PJ.whenReady = whenReady;
  function openProject(id) {
    const p = PJ.get(id); if (!p) return;
    const K = PJ.kinds[p.kind]; if (!K || !K.open) return;
    show(false);
    PJ.seen(id);
    if (!ready()) toast('⏳ ' + L('pj.opening', '{n} öffnet, sobald das Studio bereit ist …', { n: PJ.nameOf(p) }));
    whenReady(() => {
      // a house, an item or a world opens in the Studio itself: the ✨ dialog makes way
      const IM = VR.StudioWorld && VR.StudioWorld.imagine;
      if (!/^(kit|genie|site)$/.test(p.kind) && IM && IM.close && $('#imagine.on')) IM.close();
      try {
        const r = K.open(p);
        if (r && r.catch) r.catch((e) => { console.warn('project open', e); C.sys(L('pj.openFail', '{n} ließ sich nicht öffnen', { n: PJ.nameOf(p) }), 'err'); });
      } catch (e) { console.warn('project open', e); C.sys(L('pj.openFail', '{n} ließ sich nicht öffnen', { n: PJ.nameOf(p) }), 'err'); }
    });
  }
  PJ.open = openProject;

  // ---------------------------------------------------------------- the page
  const HUB = { on: false, f: 'all', q: '', doneOpen: false, ren: null };
  const GROUPS = [['all', '🗂', 'pj.f.all', 'Alle'], ['house', '🏠', 'pj.f.house', 'Häuser'], ['item', '🪑', 'pj.f.item', 'Möbel'], ['create', '✨', 'pj.f.create', 'Erschaffen'], ['site', '🏘', 'pj.f.site', 'Orte'], ['world', '🌍', 'pj.f.world', 'Welten']];
  const groupOf = (k) => (k === 'kit' || k === 'genie' ? 'create' : k);
  function ago(t) {
    if (!t) return '';
    const d = Date.now() - t, m = Math.round(d / 60000), dt = new Date(t), now = new Date();
    if (d < 45000) return L('pj.now', 'gerade eben');
    if (m < 60) return L('pj.min', 'vor {n} Min.', { n: Math.max(1, m) });
    const hm = dt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const day0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (t >= day0) return m < 300 ? L('pj.hours', 'vor {n} Std.', { n: Math.round(m / 60) }) : L('pj.today', 'heute {t}', { t: hm });
    if (t >= day0 - 864e5) return L('pj.yesterday', 'gestern {t}', { t: hm });
    if (t >= day0 - 6 * 864e5) return dt.toLocaleDateString('de-DE', { weekday: 'short' }) + ' ' + hm;
    return dt.toLocaleDateString('de-DE', t < day0 - 300 * 864e5 ? { day: '2-digit', month: '2-digit', year: '2-digit' } : { day: '2-digit', month: '2-digit' });
  }
  PJ.ago = ago;
  function chip(s) {
    if (s.status === 'wip') return `<span class="st wip" title="${esc(SA ? L('pj.wipTSA', 'In Arbeit — automatisch gesichert, noch nicht gespeichert') : L('pj.wipT', 'In Arbeit — automatisch gespeichert, noch nicht im Spiel'))}">✎ ${s.n ? fmt(s.n) : L('pj.wip', 'in Arbeit')}</span>`;
    if (s.status === 'game') return SA ? `<span class="st ok" title="${esc(L('pj.gameTSA', 'Gespeichert in diesem Studio — 📦 Mitnehmen bringt es ins Spiel'))}">💾 ${L('pj.savedSA', 'gespeichert')}</span>` : `<span class="st ok" title="${esc(L('pj.gameT', 'So steht es im Spiel'))}">✓ ${L('pj.game', 'im Spiel')}</span>`;
    if (s.status === 'built') return `<span class="st ok">✓ ${L('pj.built', 'gebaut')}</span>`;
    if (s.status === 'plan') return `<span class="st plan">${L('pj.plan', 'geplant')}</span>`;
    return '';
  }
  function card(x, hero) {
    const { p, s, K } = x, url = PJ.thumbURL(p.id);
    const img = url ? `<img src="${url}" alt="" draggable="false">` : `<div class="ph" data-live="${esc(p.id)}">${K.icon || '◈'}</div>`;
    const acts = `<div class="acts">`
      + `<button data-a="pin" class="${p.pin ? 'on' : ''}" title="${esc(p.pin ? L('pj.unpin', 'Nicht mehr anheften') : L('pj.pin', 'Anheften — bleibt oben'))}">${IC('pin', 15)}</button>`
      + `<button data-a="done" class="${p.done ? 'on' : ''}" title="${esc(p.done ? L('pj.undone', 'Doch nicht fertig') : L('pj.done', 'Fertig — kommt nach unten'))}">${IC('check', 15)}</button>`
      + `<button data-a="ren" title="${esc(L('pj.ren', 'Umbenennen'))}">${IC('pencil', 15)}</button>`
      + `<button data-a="del" title="${esc(K.delTip ? K.delTip(p, s) : L('pj.del', 'Löschen'))}">${IC('trash', 15)}</button></div>`;
    const sub = esc([K.label, s.sub].filter(Boolean).join(' · '));
    return `<div class="pj${hero ? ' hero' : ''}${p.done ? ' done' : ''}${p.pin ? ' pinned' : ''}" data-id="${esc(p.id)}" tabindex="0" role="button" aria-label="${esc(PJ.nameOf(p))}">`
      + `<div class="im">${img}<span class="kd">${K.icon || ''}</span>${chip(s)}<span class="go">${IC('play', hero ? 46 : 34)}</span>${acts}</div>`
      + `<div class="tx"><b class="nm" title="${esc(PJ.nameOf(p))}">${esc(PJ.nameOf(p))}</b><span class="tm">${esc(ago(p.t))}</span><span class="sb">${sub}</span>`
      + (hero ? `<button class="cbtn pri big" data-a="go">${IC('play', 18)} ${L('pj.go', 'Weitermachen')}</button>` : '')
      + `</div></div>`;
  }
  function ensureEl() {
    let el = $('#hub'); if (el) return el;
    el = document.createElement('div'); el.id = 'hub';
    el.innerHTML = `<div class="hubBox" role="dialog" aria-label="${esc(L('pj.title', 'Weitermachen'))}">
      <header><span class="t">${IC('clock', 20)} ${L('pj.title', 'Weitermachen')}</span><div class="hubF"></div><input class="hubQ" placeholder="${esc(L('pj.search', 'Suchen …'))}" autocomplete="off" spellcheck="false"><button class="x" data-a="close" title="${esc(L('pj.close', 'Schließen (Esc)'))}">${IC('close', 18)}</button></header>
      <div class="hubBody"></div>
      <footer><span class="lbl">${L('pj.new', 'Neu')}</span><div class="new"></div><span class="boot"></span><div class="xfer"><button data-pack="out" title="${esc(L('br.outT', 'Favoriten, Designs und Bauteile als eine Datei — für das Spiel oder ein anderes Studio'))}">📦 ${L('br.out', 'Mitnehmen')}</button><button data-pack="in" title="${esc(L('br.inT', 'Ein R9-Paket (.json) übernehmen — oder die Datei einfach hierher ziehen'))}">📥 ${L('br.in', 'Übernehmen')}</button></div><span class="keys"><kbd>Strg</kbd>+<kbd>O</kbd> ${L('pj.keys', 'öffnet diese Seite überall')}</span></footer></div>`;
    ($('#studio') || document.body).appendChild(el);
    // 📦 everything in one file · 📥 a file from the other Studio (bridge.js)
    el.querySelector('[data-pack="out"]').onclick = () => { if (VR.StudioBridge) VR.StudioBridge.exportPack(); };
    el.querySelector('[data-pack="in"]').onclick = () => { if (VR.StudioBridge) VR.StudioBridge.pickFile(); };
    el.addEventListener('mousedown', (e) => { if (e.target === el) show(false); });
    el.querySelector('[data-a="close"]').onclick = () => show(false);
    const q = el.querySelector('.hubQ');
    q.oninput = () => { HUB.q = q.value; renderBody(); };
    q.onkeydown = (e) => { if (e.key === 'Enter') { const first = el.querySelector('.hubBody .pj'); if (first) openProject(first.dataset.id); } else if (e.key === 'ArrowDown') { e.preventDefault(); const first = el.querySelector('.hubBody .pj'); if (first) first.focus(); } };
    // one place for every click in the body: a card opens, its little buttons act
    const body = el.querySelector('.hubBody');
    body.addEventListener('click', (e) => {
      const cardEl = e.target.closest('.pj'); if (!cardEl) { const t = e.target.closest('[data-toggle-done]'); if (t) { HUB.doneOpen = !HUB.doneOpen; renderBody(); } return; }
      const id = cardEl.dataset.id, a = e.target.closest('[data-a]');
      if (HUB.ren === id && e.target.closest('input')) return;
      if (!a || a.dataset.a === 'go') { openProject(id); return; }
      e.stopPropagation();
      act(a, id, cardEl);
    });
    // arrows walk through the cards (the search box sits before the first), Enter / Space opens
    body.addEventListener('keydown', (e) => {
      const cardEl = e.target.closest && e.target.closest('.pj'); if (!cardEl || e.target.tagName === 'INPUT') return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openProject(cardEl.dataset.id); return; }
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]; if (!step) return;
      e.preventDefault();
      const cards = [...body.querySelectorAll('.pj')], to = cards.indexOf(cardEl) + step;
      if (to < 0) el.querySelector('.hubQ').focus(); else if (cards[to]) cards[to].focus();
    });
    return el;
  }
  // 📌 ✓ ✎ 🗑 on a card
  function act(a, id, cardEl) {
    const p = PJ.get(id); if (!p) return;
    const k = a.dataset.a;
    if (k === 'pin') { PJ.put(id, { pin: !p.pin }, { touch: false }); return; }
    if (k === 'done') { PJ.put(id, { done: !p.done }, { touch: false }); return; }
    if (k === 'ren') { rename(id, cardEl); return; }
    if (k === 'del') {
      if (a.classList.contains('arm')) { PJ.discard(id); return; }
      a.classList.add('arm'); a.innerHTML = IC('check', 15); a.title = L('pj.delAgain', 'Nochmal klicken: weg damit');
      setTimeout(() => { if (a.isConnected) { a.classList.remove('arm'); a.innerHTML = IC('trash', 15); a.title = ''; } }, 2600);
    }
  }
  function rename(id, cardEl) {
    const nm = cardEl.querySelector('.nm'); if (!nm) return;
    const p = PJ.get(id); HUB.ren = id;
    nm.innerHTML = `<input value="${esc(PJ.nameOf(p))}" maxlength="60">`;
    const inp = nm.querySelector('input'); inp.focus(); inp.select();
    let done = false;
    const end = (ok) => { if (done) return; done = true; HUB.ren = null; if (ok) PJ.rename(id, inp.value); renderBody(); const c = $(`#hub .pj[data-id="${cssId(id)}"]`); if (c) c.focus(); };
    inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') end(true); else if (e.key === 'Escape') end(false); };
    inp.onblur = () => end(true);
    inp.onclick = (e) => e.stopPropagation();
  }
  const cssId = (id) => String(id).replace(/["\\]/g, '\\$&');
  function renderHead(all) {
    const el = ensureEl(), f = el.querySelector('.hubF');
    const n = {}; for (const x of all) { const g = groupOf(x.p.kind); n[g] = (n[g] || 0) + 1; }
    const groups = GROUPS.filter(g => g[0] === 'all' || n[g[0]]);
    if (HUB.f !== 'all' && !n[HUB.f]) HUB.f = 'all';
    f.innerHTML = groups.length > 2 ? groups.map(([id, ic, k, de]) => `<button data-f="${id}" class="${HUB.f === id ? 'on' : ''}">${ic} ${esc(L(k, de))}<b>${id === 'all' ? all.length : n[id]}</b></button>`).join('') : '';
    for (const b of f.querySelectorAll('[data-f]')) b.onclick = () => { HUB.f = b.dataset.f; renderHead(list()); renderBody(); };
    // what can be started new from here
    const nw = el.querySelector('.new');
    const NEW = [['house', '🏠', 'pj.n.house', 'Haus umbauen', 'pj.n.houseT', 'Ein Haus aus dem Katalog wählen, dann ⚒ Crafter'], ['furn', '🪑', 'pj.n.furn', 'Möbel', 'pj.n.furnT', 'Ein Möbel wählen, dann ⚒ verschönern'], ['create', '✨', 'pj.n.create', 'Erschaffen', 'pj.n.createT', 'Baukasten-Haus, Genie, Bild → 3D'], ['world', '🌍', 'pj.n.world', 'Welt', 'pj.n.worldT', 'Eine deiner Welten öffnen']].filter(x => x[0] !== 'world' || window.__R9_IN_GAME);
    nw.innerHTML = NEW.map(([id, ic, k, de, kt, dt]) => `<button data-new="${id}" title="${esc(L(kt, dt))}">${ic} ${esc(L(k, de))}</button>`).join('');
    for (const b of nw.querySelectorAll('[data-new]')) b.onclick = () => startNew(b.dataset.new);
  }
  function startNew(what) {
    show(false);
    whenReady(() => {
      if (what === 'house') C.setMode('arch');
      else if (what === 'furn') C.setMode('furn');
      else if (what === 'world') C.setMode('world');
      else if (what === 'create') { const IM = VR.StudioWorld && VR.StudioWorld.imagine; if (IM && IM.open) IM.open(null, IM.aiOK ? 'genie' : 'house'); }
    });
  }
  let liveT = 0;
  function renderBody() {
    const el = ensureEl(); if (!HUB.on) return;
    const all = list(); renderHead(all);
    const q = HUB.q.trim().toLowerCase();
    const shown = all.filter(x => (HUB.f === 'all' || groupOf(x.p.kind) === HUB.f) && (!q || (PJ.nameOf(x.p) + ' ' + (x.p.name || '') + ' ' + (x.K.label || '') + ' ' + (x.s.sub || '')).toLowerCase().includes(q)));
    const active = shown.filter(x => !x.p.done), done = shown.filter(x => x.p.done);
    const hero = !q && active.length ? active[0] : null;    // the last thing you worked on: big
    const pinned = active.filter(x => x.p.pin && x !== hero), rest = active.filter(x => !x.p.pin && x !== hero);
    let h = '';
    if (hero) h += card(hero, true);
    if (pinned.length) h += `<h4>${IC('pin', 13)} ${L('pj.pinned', 'Angeheftet')}</h4><div class="grid">${pinned.map(x => card(x)).join('')}</div>`;
    if (rest.length) h += `<h4>${IC('clock', 13)} ${hero ? L('pj.recent', 'Zuletzt') : L('pj.found', 'Gefunden')}</h4><div class="grid">${rest.map(x => card(x)).join('')}</div>`;
    if (done.length) h += `<h4 class="tog" data-toggle-done>${IC('check', 13)} ${L('pj.doneN', 'Fertig')} <b>${done.length}</b> <span>${HUB.doneOpen ? '▾' : '▸'}</span></h4>` + (HUB.doneOpen || q ? `<div class="grid">${done.map(x => card(x)).join('')}</div>` : '');
    if (!shown.length) h += q ? `<div class="empty"><i>⌕</i><b>${L('pj.none', 'Nichts gefunden')}</b></div>` : `<div class="empty"><i>${IC('clock', 54)}</i><b>${L('pj.empty', 'Noch nichts angefangen')}</b><span>${L('pj.emptyT', 'Alles, was du im Crafter umbaust oder erschaffst, landet hier automatisch — mit Bild, auch wenn du es nicht fertig machst.')}</span></div>`;
    const body = el.querySelector('.hubBody');
    const ae = document.activeElement, keep = ae && body.contains(ae) && ae.closest('.pj') ? ae.closest('.pj').dataset.id : null;
    body.innerHTML = h;
    if (keep) { const c = body.querySelector(`.pj[data-id="${cssId(keep)}"]`); if (c) c.focus(); }     // the card you were on keeps the focus
    clearTimeout(liveT); fillLive(body, 0);
    bootLine();
  }
  // cards without a stored picture: the Studio's own (catalogue houses, models) once it has them
  function fillLive(body, tries) {
    let missing = 0;
    for (const ph of body.querySelectorAll('.ph[data-live]')) {
      const p = PJ.get(ph.dataset.live), K = p && PJ.kinds[p.kind]; if (!K || !K.live) continue;
      let c = null; try { c = K.live(p); } catch (e) { c = null; }
      if (!c || !c.width) { missing++; continue; }
      const cc = document.createElement('canvas'); cc.width = c.width; cc.height = c.height; cc.getContext('2d').drawImage(c, 0, 0);
      ph.replaceWith(cc);
    }
    if (missing && HUB.on && tries < 60) liveT = setTimeout(() => { if (body.isConnected) fillLive(body, tries + 1); }, 1500);
  }
  let bootT = 0;
  function bootLine() {
    const el = $('#hub .boot'); if (!el) return;
    clearTimeout(bootT);
    if (ready()) { el.textContent = ''; return; }
    el.textContent = '⏳ ' + L('pj.booting', 'Studio startet …');
    if (HUB.on) bootT = setTimeout(bootLine, 600);
  }
  // the list changed: the page (if open) and the badge follow, a moment later
  let chT = 0;
  function changed() { clearTimeout(chT); chT = setTimeout(() => { if (HUB.on && !HUB.ren) renderBody(); badge(); }, 120); }
  PJ.changed = changed;
  function badge() {
    const b = $('nav.modes [data-hub] .hubN'); if (!b) return;
    let n = 0; for (const p of Object.values(reg().items)) if (p && !p.hide && !p.done && (p.kind === 'house' || p.kind === 'item') && PJ.hasData(p.id)) n++;
    b.textContent = n ? String(n) : '';
    b.title = n ? (SA ? L('pj.badgeSA', '{n} in Arbeit (noch nicht gespeichert)', { n }) : L('pj.badge', '{n} in Arbeit (noch nicht im Spiel)', { n })) : '';
  }
  function show(on) {
    on = on === undefined ? !HUB.on : !!on;
    const el = ensureEl();
    if (on) { try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* */ } PJ.flush({ thumbs: true }); HUB.q = ''; el.querySelector('.hubQ').value = ''; }
    HUB.on = on; el.classList.toggle('on', on);
    for (const b of document.querySelectorAll('nav.modes [data-hub]')) b.classList.toggle('on', on);
    if (on) {
      renderBody();
      const first = el.querySelector('.hubBody .pj');
      setTimeout(() => { if (HUB.on) (first || el.querySelector('.hubQ')).focus(); }, 30);
    } else { clearTimeout(liveT); clearTimeout(bootT); if (document.activeElement && el.contains(document.activeElement)) document.activeElement.blur(); }
    badge();
  }
  PJ.show = show;
  PJ.isOpen = () => HUB.on;
  // a short message over the view (the status line at the top is busy while the Studio builds)
  let toastT = 0;
  function toast(text) {
    let t = $('#pjToast'); if (!t) { t = document.createElement('div'); t.id = 'pjToast'; ($('main') || document.body).appendChild(t); }
    t.textContent = text; t.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2600);
  }
  PJ.toast = toast;

  // ---------------------------------------------------------------- keys: Strg+O from anywhere, Strg+S saves now, Esc closes
  window.addEventListener('keydown', (e) => {
    const k = (e.key || '').toLowerCase(), mod = (e.ctrlKey || e.metaKey) && !e.altKey;
    if (mod && k === 'o') { e.preventDefault(); e.stopImmediatePropagation(); show(); return; }
    if (mod && k === 's') {
      e.preventDefault(); e.stopImmediatePropagation();
      const t0 = Date.now();
      PJ.flush({ thumbs: true, now: true });
      // nothing claims what did not happen: a full storage says so instead of ✓
      if (failAt >= t0) { const CR0 = VR.Crafter, m0 = '⚠ ' + L('pj.notSaved', 'Nicht gesichert — der Browser-Speicher ist voll · 🧹 Platz schaffen (oben)'); if (CR0 && CR0.on && CR0.tip) CR0.tip(m0, false); else toast(m0); return; }
      const CR = VR.Crafter, msg = '✓ ' + L('pj.saved', 'Gespeichert — alles wird auch automatisch gesichert');
      if (CR && CR.on && CR.tip) CR.tip(msg + (CR.kind ? ' · ' + (SA ? L('pj.saved2SA', '💾 Speichern behält es fest') : L('pj.saved2', '„Ins Spiel“ bringt es ins Spiel')) : ''), true); else toast(msg);
      return;
    }
    if (!HUB.on) return;
    if (k === 'escape') { if (HUB.ren) return; e.preventDefault(); e.stopImmediatePropagation(); show(false); return; }
    // typing searches (the Studio's own keys stay off while the page is open: studio.js checks #hub.on)
    const q = $('#hub .hubQ'), ae = document.activeElement;
    if (q && !mod && !e.altKey && k.length === 1 && k !== ' ' && ae !== q && !(ae && ae.tagName === 'INPUT')) q.focus();
  }, true);
  document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('[data-hub]'); if (!b || b.closest('#hub')) return; e.preventDefault(); show(); });

  // ---------------------------------------------------------------- start: on this page when there is something to continue
  // (a link into a world or into the Crafter goes straight there; a catalogue position is just where you browsed)
  window.addEventListener('load', () => setTimeout(() => {
    badge();
    const h = location.hash || '';
    if (h && !/^#(h|m|b)\//.test(h)) return;
    if (list().some(x => !x.p.done)) show(true);
  }, 30));
})();
