// ============================================================================
// R9 Studio · one front door (W1): the four picture tiles in the header —
// ▶ Spielen (the Studio that belongs to the game; „🎮 Zum Spiel" in the
// standalone one) · 🏗 Bauen (the Karte view on the last world) · ✨ Erschaffen ·
// 🎒 Meins — the breadcrumb of the layer stack (nav.js), the Einfach / Profi
// switch (r9si.ui: the mode bar, the dev tabs and the Werkbank / Crafter / Stil
// entry points wait behind Profi), the routes #bauen · #erschaffen · #ding/<id>,
// the Ding cards' handlers (👁 ✏️ ☆ 📍 📦) for this page, the Karte tab of the
// Welt mode (cards left, the ghost on the map, every click commits) and the
// 🎒 Meins cards. Texts: VR.I18N.tx(key, vars, de, en).
// ============================================================================
(function () {
  'use strict';
  const C = window.__studioCore; if (!C) return;
  const { S, HOOK, $, $$ } = C;
  const SA = !!C.SA;
  const tx = (k, v, de, en) => (VR.I18N && VR.I18N.tx ? VR.I18N.tx(k, v, de, en) : de);
  const WM = () => VR.StudioWorld, PJ = () => VR.Projects, D = () => VR.Ding, NAV = () => VR.Nav, BR = () => VR.StudioBridge;
  const prefs = () => (VR.UIPrefs ? VR.UIPrefs.get() : { pro: true });
  const toast = (t) => { const P = PJ(); if (P && P.toast) P.toast(t); else C.sys(t, 'ok'); };
  const SS = VR.StudioStart = {};
  const MODE_NAME = () => ({ arch: tx('mode.arch', null, 'Architektur', 'Architecture'), furn: tx('mode.furn', null, 'Möbel', 'Furniture'), facade: tx('mode.facade', null, 'Fassade', 'Facade'), parts: tx('mode.parts', null, 'Teile', 'Parts'), craft: tx('mode.craft', null, 'Crafter', 'Crafter'), world: tx('st.karte', null, '🗺 Karte', '🗺 Map') });

  // ---------------------------------------------------------------- the tiles
  function tiles() {
    const host = $('#tiles'); if (!host || host.children.length) return;
    const T = VR.Tiles; if (!T) return;
    const play = T.make('play', { id: SA ? 'gameBtn' : 'playBtn', cls: 'gamelink playb' });
    const bauen = T.make('bauen'), ersch = T.make('erschaffen'), meins = T.make('meins');
    for (const b of [play, bauen, ersch, meins]) host.appendChild(b);
    bauen.onclick = () => SS.go('bauen'); ersch.onclick = () => SS.go('erschaffen'); meins.onclick = () => SS.go('meins');
    if (SA) play.onclick = (e) => { if (BR()) BR().toGame(e.currentTarget); };
    else if (WM() && WM().play) { const P = WM().play; play.onclick = (e) => { e.preventDefault(); P.go(); }; P.label(); setInterval(P.label, 1500); if (!WM().worlds && WM().list) setTimeout(() => { WM().list().then(P.label).catch(() => { /* */ }); }, 1500); }
    labels();
  }
  function labels() {
    // (the in-game Studio's ▶ reads what spawn.js writes: „▶ Spielen · <world>"; the standalone one: 🎮 Zum Spiel)
    const L = (k, label, title) => { const b = $(`#tiles .tile[data-tile="${k}"]`); if (!b) return; if (label) b.querySelector('.lbl').textContent = label; b.querySelector('.sub2').textContent = ''; if (title) { b.title = title; b.setAttribute('aria-label', (label || b.querySelector('.lbl').textContent) + ' — ' + title); } };
    L('play', SA ? tx('st.toGame', null, '🎮 Zum Spiel', '🎮 To the game') : '', SA ? tx('st.toGameT', null, 'Das Spiel in einem neuen Tab — 📦 Mitnehmen bringt deine Sachen hin', 'The game in a new tab — 📦 Take along brings your things there') : '');
    L('bauen', tx('start.bauen', null, '🏗 Bauen', '🏗 Build'), tx('st.bauenT', null, 'Häuser und Möbel auf die Karte setzen — das Spiel baut sie', 'Place houses and furniture on the map — the game builds them'));
    L('erschaffen', tx('start.erschaffen', null, '✨ Erschaffen', '✨ Create'), tx('st.erschaffenT', null, 'Ein Haus aus dem Baukasten, alles Mögliche vom Genie, Bilder als Blöcke', 'A house from the kit, anything from the Genie, pictures as blocks'));
    L('meins', tx('start.meins', null, '🎒 Meins', '🎒 Mine'), tx('st.meinsT', null, 'Deine Sachen: Favoriten, Designs, Bauteile, Welten', 'Your things: favourites, designs, pieces, worlds'));
    for (const b of $$('#proSwitch button')) { const on = (b.dataset.pro === '1') === !!prefs().pro; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); b.textContent = b.dataset.pro === '1' ? tx('start.pro', null, 'Profi', 'Pro') : tx('start.einfach', null, 'Einfach', 'Simple'); b.title = b.dataset.pro === '1' ? tx('start.proT', null, 'Alles: Werkbank, Crafter, Welten-Formular, Befehle, Entwickler-Reiter', 'Everything: workbench, crafter, the world form, commands, developer tabs') : tx('start.einfachT', null, 'Nur das Nötige, groß und klar', 'Only what you need, big and clear'); }
  }
  function proSwitch() {
    const host = $('#proSwitch'); if (!host || host.children.length) return;
    host.setAttribute('role', 'group');
    for (const v of ['0', '1']) { const b = document.createElement('button'); b.type = 'button'; b.dataset.pro = v; b.onclick = () => { if (VR.UIPrefs) VR.UIPrefs.set({ pro: v === '1' }); }; host.appendChild(b); }
  }
  // 📜 Impressum, Datenschutz, Credits: VR.Legal (its own module) — the button shows only when it is there
  function legal() {
    const ok = !!(VR.Legal && typeof VR.Legal.open === 'function');
    let b = $('#legalBtn');
    if (!b) { const head = $('#studio header'); if (!head) return; b = document.createElement('button'); b.type = 'button'; b.id = 'legalBtn'; b.className = 'cbtn'; b.dataset.legal = 'short'; b.textContent = '📜'; b.onclick = () => { if (VR.Legal && VR.Legal.open) VR.Legal.open('impressum'); }; const sys = head.querySelector('.sys'); head.insertBefore(b, sys || null); }   // (data-legal: VR.Legal adds no second one)
    const LG = VR.Legal;
    b.hidden = !ok; b.title = LG && typeof LG.tip === 'function' ? LG.tip() : tx('start.legal', null, '📜 Impressum & Datenschutz', '📜 Legal notice & privacy'); b.setAttribute('aria-label', LG && typeof LG.label === 'function' ? LG.label() : b.title);
  }
  SS.legal = legal;
  // which tile is lit: 🏗 on the Karte, 🎒 while Meins is open, ✨ while the dialog is open
  function light() {
    const P = PJ(), im = $('#imagine.on'), hub = !!(P && P.isOpen && P.isOpen());
    const on = (k, v) => { const b = $(`#tiles .tile[data-tile="${k}"]`); if (b) b.classList.toggle('on', !!v); };
    on('meins', hub); on('erschaffen', !!im && !hub); on('bauen', !hub && !im && S.mode === 'world'); on('play', false);
  }
  SS.light = light;

  // ---------------------------------------------------------------- what a tile does
  SS.go = function (what) {
    const P = PJ(), W = WM();
    const ready = (fn) => (P && P.whenReady ? P.whenReady(fn) : fn());
    if (what === 'meins') { if (P && P.show) P.show(true); return; }
    if (what === 'erschaffen') { if (P && P.isOpen && P.isOpen()) P.show(false); ready(() => { const IM = W && W.imagine; if (IM && IM.open) IM.open(null, IM.aiOK ? 'genie' : 'house'); }); return; }
    if (what === 'bauen') {
      if (P && P.isOpen && P.isOpen()) P.show(false);
      ready(async () => {
        if (NAV()) NAV().clear();
        if (!W || SA) { C.setMode('arch'); if (SA) toast(tx('st.saBauen', null, 'Häuser und Möbel — setzen kannst du sie im Spiel, hier: 🎒 Merken', 'Houses and furniture — you place them in the game, here: 🎒 Keep')); return; }
        if (W.world) { W.tab = 'karte'; C.setMode('world'); W.refresh(); return; }
        if (!W.worlds && W.list) { try { await W.list(); } catch (e) { /* */ } }
        const last = W.worlds && W.worlds[0];
        if (last) { await W.openId(last.id, 'karte'); return; }
        C.setMode('arch');
        toast(tx('st.firstWorld', null, 'Erst eine Welt: ▶ Losspielen im Spiel', 'A world first: ▶ Play in the game'));
      });
    }
  };

  // ---------------------------------------------------------------- 👁 a thing, by its id (the #ding/<id> route, the cards)
  // the state to come back to: the mode, the Welt tab, the list's scroll, the hub, the camera
  function stateNow() {
    const W = WM(), P = PJ(), list = $('#list'), hub = $('#hub .hubBody');
    return { mode: S.mode, tab: W ? W.tab : null, cat: S.cat, scroll: list ? list.scrollTop : 0, hubOpen: !!(P && P.isOpen && P.isOpen()), hubScroll: hub ? hub.scrollTop : 0, hubF: P && P.filterNow ? P.filterNow() : null, scene: S.scene ? { type: S.scene.type, index: S.scene.index, name: S.scene.name } : null, cam: { yaw: S.cam.yaw, pitch: S.cam.pitch, dist: S.cam.dist }, center: S.scene && S.scene.center ? S.scene.center.slice() : null, sel: $('#list .ding.on') ? $('#list .ding.on').dataset.ding : ($('#list .card.on') ? ($('#list .card.on').dataset.ding || $('#list .card.on').dataset.name || $('#list .card.on').dataset.house) : null) };
  }
  function restoreTo(st) {
    const W = WM(), P = PJ();
    if (!st) return;
    if (st.mode === 'craft') C.setMode('arch', true);
    else if (st.mode === 'world' && W) { if (st.tab) W.tab = st.tab; W.karteSel = st.sel || null; W.karteScroll = st.scroll || 0; if (S.mode !== 'world') C.setMode('world'); else { C.chips(); C.list(); C.parts(); } }
    else if (st.mode && S.mode !== st.mode) C.setMode(st.mode, true);
    if (st.cat && st.cat !== S.cat && st.mode !== 'world') { S.cat = st.cat; C.chips(); C.list(); }
    if (st.scene && st.mode !== 'world') { if (st.scene.type === 'house' && Number.isFinite(st.scene.index)) C.selectHouse(st.scene.index); else if (st.scene.type === 'model' && st.scene.name) C.selectModel(st.scene.name); else if (st.scene.type === 'block' && st.scene.name && VR.StudioCatalog) VR.StudioCatalog.select(st.scene.name); }
    if (st.cam) { S.cam.yaw = st.cam.yaw; S.cam.pitch = st.cam.pitch; S.cam.dist = st.cam.dist; }
    if (st.center && S.scene && S.scene.center && st.mode === 'world') S.scene.center = st.center.slice();
    const list = $('#list'); if (list) { list.scrollTop = st.scroll || 0; for (const c of list.querySelectorAll('.ding, .card')) c.classList.toggle('on', !!st.sel && (c.dataset.ding === st.sel || c.dataset.name === st.sel || c.dataset.house === st.sel)); }
    if (st.hubOpen && P && P.show) { P.show(true); const hub = $('#hub .hubBody'); if (hub) setTimeout(() => { hub.scrollTop = st.hubScroll || 0; }, 60); }
    light();
  }
  SS.stateNow = stateNow; SS.restoreTo = restoreTo;
  const baseLabel = () => { const P = PJ(); if (P && P.isOpen && P.isOpen()) return tx('start.meins', null, '🎒 Meins', '🎒 Mine'); return MODE_NAME()[S.mode] || ''; };
  // a layer: what was open comes back with ←
  function layer(kind, label, extra, sel) {
    const st = stateNow(); if (sel) st.sel = sel;
    if (NAV()) NAV().push(Object.assign({ kind, label, base: baseLabel(), restore: () => restoreTo(st) }, extra || {}));
  }
  SS.layer = layer;
  function known(id) {
    const d = D() && D().parse(id); if (!d) return false;
    if (d.kind === 'h') return C.HOUSES.some(h => h.i === +d.key);
    if (d.kind === 'm') return !!VR.VM.MODELS[d.key];
    if (d.kind === 'b') return !!(VR.R.byName[d.key] || (VR.ITEMS && VR.ITEMS[d.key]));
    if (d.kind === 'p') return (VR.Pack ? VR.Pack.libLoad() : []).some(it => it && it.id === d.key);
    return !!(PJ() && PJ().get(d.key));
  }
  SS.known = known;
  // 👁 Ansehen: the viewer for it (a layer above whatever is open)
  SS.view = function (id, opt) {
    const d = D() && D().parse(id); if (!d || !known(id)) { toast(tx('st.gone', null, 'Das gibt es hier nicht (mehr).', 'That is not here (any more).')); return false; }
    const P = PJ();
    if (!(opt && opt.noLayer)) layer('view', D().name(id), null, id);
    if (P && P.isOpen && P.isOpen()) P.show(false);
    if (d.kind === 'h') { C.setMode('arch', true); C.selectHouse(+d.key); }
    else if (d.kind === 'm') { C.setMode(C.isFacade(d.key) ? 'facade' : 'furn', true); C.selectModel(d.key); }
    else if (d.kind === 'b') { if (VR.StudioCatalog) VR.StudioCatalog.open('block', d.key); }
    else if (d.kind === 'p') { SS.showPiece(id); }
    else if (P) P.open(d.key);
    light();
    return true;
  };
  // a Bauteil: its picture, large (the Werkbank edits it — Profi)
  SS.showPiece = function (id) {
    const it = (VR.Pack ? VR.Pack.libLoad() : []).find(x => x && x.id === id.slice(2)); if (!it) return;
    let v = $('#dingView'); if (!v) { v = document.createElement('div'); v.id = 'dingView'; ($('#studio') || document.body).appendChild(v); }
    v.innerHTML = `<div class="box"><h3></h3><div class="pic"></div><div class="meta"></div><div class="crow"><button class="cbtn" data-act="close">${tx('st.close', null, '✕ Schließen', '✕ Close')}</button></div></div>`;
    v.querySelector('h3').textContent = it.name || id;
    if (typeof it.thumb === 'string') { const img = document.createElement('img'); img.src = it.thumb; img.alt = ''; v.querySelector('.pic').appendChild(img); } else v.querySelector('.pic').textContent = '🧩';
    v.querySelector('.meta').textContent = `${it.sx} × ${it.sy} × ${it.sz} ` + tx('st.blocks', null, 'Blöcke', 'blocks');
    v.classList.add('on');
    v.querySelector('[data-act="close"]').onclick = () => { v.classList.remove('on'); if (NAV() && NAV().top() && NAV().top().kind === 'view') NAV().pop(); };
  };

  // ---------------------------------------------------------------- the routes: #bauen · #erschaffen · #ding/<id>
  function routes() {
    const h = location.hash || '';
    const P = PJ(), ready = (fn) => (P && P.whenReady ? P.whenReady(fn) : fn());
    if (h === '#bauen') ready(() => SS.go('bauen'));
    else if (h === '#erschaffen') ready(() => SS.go('erschaffen'));
    else if (h.startsWith('#ding/')) { const id = decodeURIComponent(h.slice(6)).replace(/\/edit$/, ''), edit = /\/edit$/.test(h); ready(() => { if (!known(id)) { toast(tx('st.gone', null, 'Das gibt es hier nicht (mehr).', 'That is not here (any more).')); return; } if (edit && D().handlers.edit) D().handlers.edit(id); else SS.view(id, { noLayer: true }); }); }
  }

  // ---------------------------------------------------------------- the Ding cards' handlers on this page
  function handlers() {
    const Dg = D(); if (!Dg) return;
    Dg.houseNames = {}; for (const h of C.HOUSES) Dg.houseNames[h.i] = h.name;
    Dg.handlers = {
      view: (id) => SS.view(id),
      edit: (id) => SS.edit(id),
      set: (id) => SS.set(id),
      share: (id) => Dg.share(id),
      canSet: (id) => (SA ? true : /^[hmb]:/.test(id)),   // (h: m: → the Karte; b: → into your hand in the game; k: g: p: s: come with W2's wizard)
      canEdit: (id) => (/^p:/.test(id) ? !!prefs().pro : true),
      pic: (id, w, h) => {
        const d = Dg.parse(id); if (!d) return null;
        const copy = (th) => { if (!th) return null; const c = document.createElement('canvas'); c.width = th.width; c.height = th.height; c.getContext('2d').drawImage(th, 0, 0); return c; };
        if (d.kind === 'h') { const rec = C.HOUSE.get(+d.key); return rec && rec.thumb ? copy(rec.thumb) : null; }
        if (d.kind === 'm') return VR.VM.MODELS[d.key] ? copy(C.thumbOf(d.key)) : null;
        if (d.kind === 'b' && VR.StudioCatalog) return VR.StudioCatalog.picture(d.key, w || 128, h || 84);
        return null;
      },
    };
  }
  // ✏️ Bearbeiten: the right editor, as a layer (← comes back here)
  SS.edit = function (id) {
    const d = D() && D().parse(id); if (!d || !known(id)) { toast(tx('st.gone', null, 'Das gibt es hier nicht (mehr).', 'That is not here (any more).')); return false; }
    const P = PJ();
    if (d.kind === 'h' || d.kind === 'm' || d.kind === 'p') layer('editor', '✏️', { escapable: false }, id);
    else layer('editor', '✏️', null, id);
    if (P && P.isOpen && P.isOpen()) P.show(false);
    if (d.kind === 'h') C.editHouse(+d.key);
    else if (d.kind === 'm') C.editModel(d.key);
    else if (d.kind === 'b') { if (VR.StudioCatalog) { VR.StudioCatalog.edit = true; VR.StudioCatalog.open('block', d.key); } }
    else if (d.kind === 'p') { const W = WM(); if (W && W.world) { W.tab = 'bench'; C.setMode('world'); W.refresh(); } else toast(tx('st.pieceNeedsWorld', null, 'Ein Bauteil bearbeitest du in der Werkbank einer Welt (🏗 Bauen, Profi).', 'A piece is edited in a world\'s workbench (🏗 Build, Pro).')); }
    else if (P) P.open(d.key);
    light();
    return true;
  };
  // 📍 Setzen: the Karte view with it in hand (standalone: 🎒 Merken = a favourite)
  SS.set = async function (id) {
    const Dg = D(), W = WM(), P = PJ();
    if (SA) { const on = Dg.toggleFav(id); toast((on ? '★ ' : '☆ ') + Dg.name(id)); return on; }
    const d = Dg.parse(id); if (!d || !/^[hmb]$/.test(d.kind) || !W) return false;
    if (P && P.isOpen && P.isOpen()) P.show(false);
    if (d.kind === 'b') {
      // a block: into your hand — ▶ opens the world with it (the game reads r9si.hand once)
      const target = W.play && W.play.target ? W.play.target() : null;
      try { localStorage.setItem('r9si.hand', JSON.stringify({ v: 1, ding: id, world: target ? target.id : null, t: Date.now() })); } catch (e) { toast(tx('karte.full', null, '⚠ Gesetzt, aber nicht gemerkt — Browser-Speicher voll', '⚠ Placed, but not kept — browser storage full')); return false; }
      if (W.play && W.play.go) W.play.go();
      return true;
    }
    if (!W.world) {
      if (!W.worlds && W.list) { try { await W.list(); } catch (e) { /* */ } }
      const last = W.worlds && W.worlds[0];
      if (!last) { toast(tx('st.firstWorld', null, 'Erst eine Welt: ▶ Losspielen im Spiel', 'A world first: ▶ Play in the game')); return false; }
      await W.openId(last.id, 'karte');
    } else if (S.mode !== 'world' || W.tab !== 'karte') { W.tab = 'karte'; C.setMode('world'); W.refresh(); }
    if (NAV()) NAV().clear();
    W.tool = d.kind === 'h' ? W.houseItem(+d.key) : { kind: 'model', name: d.key };
    W.ghost = null; W.sel = null; W.karteSel = null; W.meshFor(W.tool); W.refresh();
    if (W.tipW) W.tipW(tx('karte.aim', null, 'Zeig auf den Boden — Klick setzt es · R dreht · Esc fertig', 'Point at the ground — a click places it · R turns · Esc done'), true);
    return true;
  };

  // ---------------------------------------------------------------- the Karte tab of the Welt mode
  const karte = () => { const W = WM(); return !!(W && W.on && S.mode === 'world' && W.world && W.tab === 'karte'); };
  const toolId = () => { const W = WM(); return W && W.tool ? (W.tool.kind === 'house' ? 'h:' + W.tool.index : 'm:' + W.tool.name) : null; };
  const newId = () => 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  function wrap(name, fn) { const prev = HOOK[name]; HOOK[name] = function (...a) { const r = fn.apply(null, a); if (r !== false) return r; return prev ? prev.apply(null, a) : false; }; }
  // the chips: Einfach → ★ · 🏠 Häuser · 🪑 Möbel · 🌍 Welten; Profi → the world's tabs with 🗺 Karte first
  const prevChips = HOOK.chips;
  HOOK.chips = function (...a) {
    const W = WM(); if (!W || !W.on || S.mode !== 'world' || !W.world) return prevChips ? prevChips.apply(null, a) : false;
    const el = $('#chips');
    const favN = (VR.Favs ? VR.Favs.list() : []).map(f => D().fromFav(f)).filter(id => id && /^[hm]:/.test(id) && known(id)).length;
    if (prefs().pro) {
      // the world's own tabs, 🗺 Karte in front of them
      const r = prevChips ? prevChips.apply(null, a) : false;
      const b = document.createElement('button'); b.className = W.tab === 'karte' ? 'on' : ''; b.dataset.kcat = 'karte'; b.innerHTML = tx('st.karte', null, '🗺 Karte', '🗺 Map') + '<b>' + W.plans.filter(p => p.status !== 'built').length + '</b>'; b.onclick = () => { W.tab = 'karte'; W.refresh(); };
      el.insertBefore(b, el.firstChild);
      return r;
    }
    el.innerHTML = '';
    if (W.tab === 'bench' || W.tab === 'style' || W.tab === 'plan') W.tab = 'karte';   // (the Profi tabs wait behind the switch; houses / furn stay reachable for tools and tests)
    const cat = W.karteCat || (favN ? 'fav' : 'house');
    const own = Object.keys((VR.CUSTOM && VR.CUSTOM.models) || {}).filter(n => VR.VM.MODELS[n] && !C.isFacade(n)).length, nFurn = Object.keys(VR.VM.MODELS).filter(n => !C.isFacade(n)).length;
    for (const [id, label, n] of [['fav', '★ ' + tx('st.favs', null, 'Favoriten', 'Favourites'), favN], ['house', '🏠 ' + tx('st.houses', null, 'Häuser', 'Houses'), C.HOUSES.length], ['furn', '🪑 ' + tx('st.furn', null, 'Möbel', 'Furniture'), own ? own + ' ✏️ · ' + nFurn : nFurn], ['worlds', '🌍 ' + tx('start.worldsTitle', null, 'Welten', 'Worlds'), W.worlds ? W.worlds.length : '']]) {
      const b = document.createElement('button'); b.className = cat === id && id !== 'worlds' ? 'on' : ''; b.dataset.kcat = id; b.innerHTML = label + '<b>' + n + '</b>';
      b.onclick = () => { if (id === 'worlds') { W.world = null; C.setScene(null); W.tab = 'karte'; if (NAV()) NAV().clear(); C.setMode('world'); W.list().then(() => W.refresh()); return; } W.karteCat = id; W.karteScroll = 0; C.chips(); C.list(); C.parts(); };
      el.appendChild(b);
    }
    return true;
  };
  // the cards: ★ first, then the houses or the furniture (own designs first); a tap on the picture = 📍 Setzen
  wrap('list', function () {
    if (!karte()) return false;
    const W = WM(), Dg = D(), el = $('#list');
    const keepScroll = W.karteScroll !== undefined && W.karteScroll !== null ? W.karteScroll : el.scrollTop; W.karteScroll = null;
    el.classList.remove('palette'); el.classList.add('houses', 'dings');
    const favIds = (VR.Favs ? VR.Favs.list() : []).map(f => Dg.fromFav(f)).filter(id => id && /^[hm]:/.test(id) && known(id) && !(id[0] === 'm' && C.isFacade(id.slice(2))));
    const cat = prefs().pro ? (W.karteCat || 'house') : (W.karteCat || (favIds.length ? 'fav' : 'house'));
    let ids = [];
    if (cat === 'fav') ids = favIds;
    else if (cat === 'house') ids = favIds.filter(id => id[0] === 'h').concat(C.HOUSES.map(h => 'h:' + h.i).filter(id => !favIds.includes(id)));
    else { const own = Object.keys((VR.CUSTOM && VR.CUSTOM.models) || {}).filter(n => VR.VM.MODELS[n] && !C.isFacade(n)).map(n => 'm:' + n); const all = Object.keys(VR.VM.MODELS).filter(n => !C.isFacade(n)).map(n => 'm:' + n); ids = favIds.filter(id => id[0] === 'm').concat(own.filter(id => !favIds.includes(id))).concat(all.filter(id => !favIds.includes(id) && !own.includes(id))); }
    const f = (S.filter || '').toLowerCase();
    if (f) ids = ids.filter(id => (id + ' ' + Dg.name(id)).toLowerCase().includes(f));
    const cur = toolId(), lit = W.karteSel || null;
    // the same cards as before (a click set something, R turned it): only the lit one changes — no re-render, no flicker,
    // the scroll stays
    const key = cat + '|' + f + '|' + ids.slice(0, 400).join(',');
    if (el.dataset.karteKey === key && el.querySelector('.ding')) { for (const c of el.querySelectorAll('.ding')) c.classList.toggle('on', c.dataset.ding === cur || c.dataset.ding === lit); if (el.scrollTop !== keepScroll) el.scrollTop = keepScroll; return true; }
    el.innerHTML = ''; el.dataset.karteKey = key;
    if (!ids.length) { const d = document.createElement('div'); d.className = 'note dim'; d.textContent = cat === 'fav' ? tx('st.noFavs', null, 'Noch keine Favoriten — der ☆ an einer Karte legt sie hierher.', 'No favourites yet — ☆ on a card puts them here.') : tx('cat.none', null, 'nichts gefunden', 'nothing found'); el.appendChild(d); return true; }
    let k = 0;
    for (const id of ids.slice(0, 400)) { const c = Dg.render(id, { picW: 280, picH: 160, on: id === cur || id === lit, onOpen: () => SS.set(id) }); c.style.animationDelay = (Math.min(k++, 24) * 18) + 'ms'; el.appendChild(c); }
    Dg.fillNow(el, 6);
    if (keepScroll) el.scrollTop = keepScroll;
    return true;
  });
  // with something in hand: a click places it — left or right button; a drag turns the view (Shift / middle: pan);
  // the hover (the ghost) stays world.js's
  let kp = null;
  wrap('pointer', function (e, type) {
    const W = WM(); if (!karte() || !W.tool) { kp = null; return false; }
    if (type === 'down') { kp = { x: e.clientX, y: e.clientY, b: e.button, shift: e.shiftKey, moved: false }; try { C.view().setPointerCapture(e.pointerId); } catch (er) { /* */ } return true; }
    if (type === 'move') {
      if (!kp) return false;
      const dx = e.clientX - kp.x, dy = e.clientY - kp.y;
      if (!kp.moved && Math.hypot(dx, dy) < 5) return true;
      kp.moved = true; kp.x = e.clientX; kp.y = e.clientY;
      if (kp.shift || kp.b === 1) C.CAM.pan(dx, dy); else C.CAM.rotate(dx, dy);
      return true;
    }
    if (type === 'up') { const q = kp; kp = null; if (q && !q.moved && (q.b === 0 || q.b === 2)) W.placeNow(); return true; }
    if (type === 'leave') { kp = null; return false; }
    return false;
  });
  // the piece in hand goes where the ghost stands and is handed to the game at once (status pending); the tool stays
  function placeNow() {
    const W = WM(), Dg = D(); if (!W || !W.tool) return null;
    const m = W.meshFor(W.tool), gp = W.ghost;
    if (!m || !gp || !gp.ok) { if (W.tipW) W.tipW(tx('karte.noGround', null, 'Zeig auf den Boden', 'Point at the ground'), false); return null; }
    let plan = null;
    W.change(() => { plan = Object.assign({}, gp, { id: newId(), status: 'draft', t: Date.now(), from: 'map' }); delete plan.ok; W.plans.push(plan); W.sel = plan.id; });
    if (!plan) return null;
    const r = W.commit(true);
    const name = Dg ? Dg.name(toolId()) : (m.title || '');
    if (W.tipW) W.tipW(r.ok ? tx('karte.set', { n: name }, '✓ {n} gesetzt — ▶ bringt dich hin', '✓ {n} placed — ▶ takes you there') : tx('karte.full', null, '⚠ Gesetzt, aber nicht gemerkt — Browser-Speicher voll', '⚠ Placed, but not kept — browser storage full'), r.ok);
    return W.plans.find(p => p.id === plan.id) || plan;
  }
  // the right side: where you land, the chosen card, the keys as buttons — no ⬆, no key list
  wrap('parts', function () {
    if (!karte()) return false;
    const W = WM(), Dg = D(), el = $('#partsBody'); el.innerHTML = ''; el.classList.remove('empty');
    if (W.landingBox && !W.loading) W.landingBox(el);
    const H = (t, b) => { const d = document.createElement('div'); d.className = 'ph'; d.innerHTML = t + (b !== undefined ? ' <b>' + b + '</b>' : ''); el.appendChild(d); };
    const btn = (label, fn, cls) => { const b = document.createElement('button'); b.className = 'cbtn ' + (cls || ''); b.textContent = label; b.onclick = fn; return b; };
    const row = (...bs) => { const r = document.createElement('div'); r.className = 'crow'; for (const b of bs) r.appendChild(b); el.appendChild(r); };
    const note = (t, cls) => { const p = document.createElement('div'); p.className = 'note' + (cls ? ' ' + cls : ''); p.textContent = t; el.appendChild(p); };
    const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const pend = W.plans.filter(p => p.status === 'pending').length, built = W.plans.filter(p => p.status === 'built').length;
    H(tx('st.karte', null, '🗺 Karte', '🗺 Map'), esc(W.world.name));
    note((W.loading ? tx('st.loading', { p: Math.round(100 * W.loading.done / Math.max(1, W.loading.total)) }, 'Die Gegend lädt … {p} %', 'The land is loading … {p} %') + ' · ' : '') + tx('st.planLine', { p: pend, b: built }, '{p} gesetzt · {b} gebaut', '{p} placed · {b} built'), 'dim');
    const tid = toolId();
    if (tid) {
      H(tx('ding.set', null, '📍 Setzen', '📍 Place'));
      const card = Dg.render(tid, { compact: true, picW: 280, picH: 120 }); card.classList.add('inhand'); el.appendChild(card);
      note(W.meshFor(W.tool) ? tx('karte.how', null, 'Zeig auf den Boden: jeder Klick setzt es — das Spiel baut es, ▶ bringt dich hin.', 'Point at the ground: every click places it — the game builds it, ▶ takes you there.') : tx('st.preparing', null, 'wird vorbereitet …', 'preparing …'));
      const rb = btn('↻ ' + tx('st.turn', null, 'Drehen · R', 'Turn · R'), () => { W.rot = (W.rot + 1) & 3; W.ghost = null; W.refresh(); }); rb.dataset.act = 'wrot';
      const own = W.tool.kind === 'house' && VR.Custom && VR.Custom.houseFor(W.tool.index);
      const fb = W.tool.kind === 'house' && !own ? btn('◐ ' + tx('st.facade', null, 'Fassade · F', 'Facade · F'), () => { const rec = C.HOUSE.get(W.tool.index), skins = rec ? rec.data.skins.filter((v, j, a) => a.indexOf(v) === j) : [W.tool.skin]; const list = []; for (const mi of [false, true]) for (const sk of skins) list.push([sk, mi]); const k = list.findIndex(([sk, mi]) => sk === W.tool.skin && mi === !!W.tool.mirror); const [sk, mi] = list[(k + 1) % list.length]; W.tool.skin = sk; W.tool.mirror = mi; W.ghost = null; W.refresh(); }) : null; if (fb) fb.dataset.act = 'wfac';
      if (fb) row(rb, fb); else row(rb);
      row(btn('✕ ' + tx('st.done', null, 'Fertig · Esc', 'Done · Esc'), () => { W.tool = null; W.ghost = null; W.refresh(); }));
    } else {
      const sel = W.plans.find(p => p.id === W.sel);
      if (sel && sel.status !== 'built') {
        const sid = sel.kind === 'house' ? 'h:' + sel.index : 'm:' + sel.name;
        H(tx('st.selected', null, 'Ausgewählt', 'Selected'), esc(Dg.name(sid)));
        row(btn('↻ ' + tx('st.turn', null, 'Drehen · R', 'Turn · R'), () => { const m = W.meshFor(sel); if (m) W.change(() => W.rotate(sel, m)); }), btn('✕ ' + tx('st.remove', null, 'Weg damit', 'Remove'), () => { W.change(() => { W.plans = W.plans.filter(q => q !== sel); W.sel = null; }); W.commit(true); }));
        note(sel.status === 'pending' ? tx('st.pendingNote', null, 'Das Spiel baut es, sobald die Gegend geladen ist.', 'The game builds it as soon as that land is loaded.') : '', 'dim');
      } else note(tx('st.karteHint', null, 'Tipp auf ein Bild links — dann auf den Boden.', 'Tap a picture on the left — then the ground.'));
    }
    return true;
  });
  // Esc puts the tool away on the Karte too (world.js's key hook does it); R turns (world.js)

  // ---------------------------------------------------------------- 🎒 Meins: the hub's cards get the five actions; ★ and Bauteile join
  function decorate(body) {
    const Dg = D(), P = PJ(); if (!Dg || !P) return;
    const shown = new Set();
    const dingOf = (p) => (!p ? null : p.kind === 'house' ? 'h:' + (p.ref && p.ref.index) : p.kind === 'item' ? 'm:' + (p.ref && p.ref.name) : p.kind === 'kit' ? 'k:' + p.id : p.kind === 'genie' ? 'g:' + p.id : p.kind === 'site' ? 's:' + p.id : null);
    for (const card of body.querySelectorAll('.pj')) {
      const p = P.get(card.dataset.id), id = dingOf(p); if (!id || !Dg.parse(id)) continue;
      shown.add(id); card.classList.add('ding'); card.dataset.ding = id;
      const tmp = Dg.render(id, { setLabel: SA ? tx('st.merken', null, '🎒 Merken', '🎒 Keep') : undefined }), acts = tmp.querySelector('.dacts');
      const tx0 = card.querySelector('.tx'); if (acts && tx0) tx0.appendChild(acts);
    }
    // everything else you have: ★ favourites, then the Bauteile
    const rest = Dg.list().filter(x => !shown.has(x.id) && known(x.id));
    const favs = rest.filter(x => x.id[0] !== 'p'), parts = rest.filter(x => x.id[0] === 'p');
    const grid = (title, items) => {
      if (!items.length) return;
      const h4 = document.createElement('h4'); h4.textContent = title; body.appendChild(h4);
      const g = document.createElement('div'); g.className = 'grid dings';
      for (const x of items.slice(0, 120)) g.appendChild(Dg.render(x.id, { picW: 240, picH: 150, setLabel: SA ? tx('st.merken', null, '🎒 Merken', '🎒 Keep') : undefined, onOpen: () => SS.view(x.id) }));
      body.appendChild(g); Dg.fillNow(g, 8);
    };
    if (favs.length || parts.length) { const e = body.querySelector('.empty'); if (e) e.remove(); }
    grid('★ ' + tx('st.favs', null, 'Favoriten', 'Favourites'), favs);
    grid('🧱 ' + tx('st.parts', null, 'Bauteile', 'Pieces'), parts);
    if (SA) { const out = document.querySelector('#hub footer [data-pack="out"]'); if (out) out.textContent = '📦 ' + tx('st.takeAll', null, 'Alles mitnehmen', 'Take everything along'); }
  }

  // ---------------------------------------------------------------- wiring
  function init() {
    if (PJ()) PJ().decorate = decorate;
    // the Crafter's own ✕ / „← …" pops the editor layer it was opened as
    if (VR.Crafter && VR.Crafter.back) { const orig = VR.Crafter.back; VR.Crafter.back = function () { const N = NAV(); if (N && N.top() && N.top().kind === 'editor') { N.pop(); return; } return orig.apply(this, arguments); }; }
    handlers();
    if (WM()) WM().placeNow = placeNow;
    tiles(); proSwitch(); labels(); legal();
    window.addEventListener('load', legal);   // (a module after this one)
    if (VR.UIPrefs) VR.UIPrefs.on(() => { labels(); const W = WM(); if (W && W.on && S.mode === 'world') { C.chips(); C.list(); C.parts(); } });   // (Einfach ↔ Profi changes the Welt mode's chips)
    if (VR.I18N && VR.I18N.on) VR.I18N.on(() => { labels(); legal(); });
    // the mode bar (Profi): a mode switch drops the layers
    for (const b of $$('nav.modes button[data-mode]')) if (!b.disabled) b.onclick = () => { if (NAV()) NAV().clear(); C.setMode(b.dataset.mode); };
    setInterval(light, 400);
    window.addEventListener('load', () => setTimeout(routes, 450));
    window.addEventListener('hashchange', () => { if (/^#(bauen|erschaffen|ding\/)/.test(location.hash || '')) routes(); });
  }
  init();
})();
