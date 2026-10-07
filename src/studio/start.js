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
    const L = (k, de, en, sub, title) => { const b = $(`#tiles .tile[data-tile="${k}"]`); if (!b) return; if (k !== 'play' || SA) b.querySelector('.lbl').textContent = k === 'play' ? tx('st.toGame', null, '🎮 Zum Spiel', '🎮 To the game') : tx('start.' + k, null, de, en); b.querySelector('.sub2').textContent = sub || ''; if (title) b.title = title; };
    L('play', '▶ Spielen', '▶ Play', '', SA ? tx('st.toGameT', null, 'Das Spiel in einem neuen Tab — 📦 Mitnehmen bringt deine Sachen hin', 'The game in a new tab — 📦 take-along brings your things there') : '');
    L('bauen', '🏗 Bauen', '🏗 Build', '', tx('st.bauenT', null, 'Häuser und Möbel auf die Karte setzen — das Spiel baut sie', 'Place houses and furniture on the map — the game builds them'));
    L('erschaffen', '✨ Erschaffen', '✨ Create', '', tx('st.erschaffenT', null, 'Ein Haus aus dem Baukasten, alles Mögliche vom Genie, Bilder als Blöcke', 'A house from the kit, anything from the Genie, pictures as blocks'));
    L('meins', '🎒 Meins', '🎒 Mine', '', tx('st.meinsT', null, 'Deine Sachen: Favoriten, Designs, Bauteile, Welten', 'Your things: favourites, designs, pieces, worlds'));
    for (const b of $$('#proSwitch button')) { const on = (b.dataset.pro === '1') === !!prefs().pro; b.classList.toggle('on', on); b.textContent = b.dataset.pro === '1' ? tx('start.pro', null, 'Profi', 'Profi') : tx('start.einfach', null, 'Einfach', 'Simple'); b.title = b.dataset.pro === '1' ? tx('start.proT', null, 'Alles: Werkbank, Crafter, Welten-Formular, Befehle, Entwickler-Reiter', 'Everything: workbench, crafter, the world form, commands, developer tabs') : tx('start.einfachT', null, 'Nur das Nötige, groß und klar', 'Only what you need, big and clear'); }
  }
  function proSwitch() {
    const host = $('#proSwitch'); if (!host || host.children.length) return;
    for (const v of ['0', '1']) { const b = document.createElement('button'); b.type = 'button'; b.dataset.pro = v; b.onclick = () => { if (VR.UIPrefs) VR.UIPrefs.set({ pro: v === '1' }); }; host.appendChild(b); }
  }
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
        if (!W || SA) { C.setMode('arch'); if (SA) toast(tx('st.saBauen', null, 'Die Häuser und Möbel — 📍 wird im Spiel zum Setzen; hier: 🎒 Merken', 'The houses and furniture — 📍 places in the game; here: 🎒 keep')); return; }
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
    else if (st.mode === 'world' && W) { if (st.tab) W.tab = st.tab; if (S.mode !== 'world') C.setMode('world'); else W.refresh(); }
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
  function layer(kind, label, extra) {
    const st = stateNow();
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
    if (!(opt && opt.noLayer)) layer('view', D().name(id));
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

  // ---------------------------------------------------------------- wiring
  function init() {
    tiles(); proSwitch(); labels();
    if (VR.UIPrefs) VR.UIPrefs.on(() => labels());
    if (VR.I18N && VR.I18N.on) VR.I18N.on(() => labels());
    // the mode bar (Profi): a mode switch drops the layers
    for (const b of $$('nav.modes button[data-mode]')) if (!b.disabled) b.onclick = () => { if (NAV()) NAV().clear(); C.setMode(b.dataset.mode); };
    setInterval(light, 400);
    window.addEventListener('load', () => setTimeout(routes, 450));
    window.addEventListener('hashchange', () => { if (/^#(bauen|erschaffen|ding\/)/.test(location.hash || '')) routes(); });
  }
  init();
})();
