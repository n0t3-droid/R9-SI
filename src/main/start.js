// ============================================================================
// The game's start screen (W1 „Eine Tür, eine Karte"): four picture tiles —
// ▶ Weiterspielen (▶ Losspielen when there is no world yet: one click makes
// „Meine Welt" and enters it) · 🏗 Bauen (the R9 Studio's Karte view on the last
// world) · ✨ Erschaffen · 🎒 Meins — with „Andere Welt · ＋ Neue Welt" below,
// the Einfach / Profi switch, the language picker and ⚙ Einstellungen. The
// worlds are cards (▶ · 🏗 · ✎ · 🗑, 🗑 asks twice); the create form is German
// and waits in Profi. Everything here hooks VR.UI at runtime: ui.js keeps its
// screens and ids (#title #worlds #create #splash #studionote #mphosts
// #titlenote #gpuinfo), this file re-draws what the player sees on them.
// Texts: the game's tables (lang_de.js / lang_en.js) — German first, English
// second; VR.I18N.tx(key, vars, de, en) writes the same texts at the call (they
// are checked against the tables by test/lang.js), t(key) reads a table key.
// ============================================================================
(function (VR) {
  'use strict';
  const ST = VR.Start = {};
  const $ = (s, r) => (r || document).querySelector(s);
  const tx = (k, v, de, en) => (VR.I18N && VR.I18N.tx ? VR.I18N.tx(k, v, de, en) : de);
  const t = (k, v) => (VR.I18N ? VR.I18N.t(k, v) : k);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const prefs = () => (VR.UIPrefs ? VR.UIPrefs.get() : { pro: false, scale: 1.15 });
  const game = () => VR.game;
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const SVG = VR.Tiles ? VR.Tiles.SVG : {};
  const TILES = ['play', 'bauen', 'erschaffen', 'meins'];
  const T = {   // the tile labels: key, de, en
    play: ['start.play', '▶ Weiterspielen', '▶ Play on'], first: ['start.first', '▶ Losspielen', '▶ Play'], bauen: ['start.bauen', '🏗 Bauen', '🏗 Build'], erschaffen: ['start.erschaffen', '✨ Erschaffen', '✨ Create'], meins: ['start.meins', '🎒 Meins', '🎒 Mine'],
  };
  const tl = (k) => tx(T[k][0], null, T[k][1], T[k][2]);
  const modeName = (m) => t(m === 'zen' ? 'g.mode.zen' : m === 'creative' ? 'g.mode.creative' : 'g.mode.survival');
  // 📜 Impressum, Datenschutz, Credits: VR.Legal (its own module) — the button shows only when it is there
  const legalOK = () => !!(VR.Legal && typeof VR.Legal.open === 'function');
  ST.worldsCache = null;

  // ---------------------------------------------------------------- the start screen
  function mount(ui) {
    ST.ui = ui;
    const title = $('#title'); if (!title) return;
    const splash = $('#splash'), gpu = $('#gpuinfo');
    title.innerHTML = '';
    const box = el('div', 'start');
    const strip = el('div', 'strip');
    const sw = el('div', '', ''); sw.id = 'proSwitch';
    for (const v of ['0', '1']) { const b = el('button', 'lnk'); b.type = 'button'; b.dataset.act = 'pro'; b.dataset.pro = v; sw.appendChild(b); }
    sw.setAttribute('role', 'group');
    strip.appendChild(sw);
    if (VR.I18N && VR.I18N.picker) strip.appendChild(VR.I18N.picker({ cls: 'onstart', ready: true }));   // (the languages with a table: Deutsch, English)
    const aa = el('button', 'lnk'); aa.type = 'button'; aa.dataset.act = 'scale'; aa.textContent = 'Aa'; strip.appendChild(aa);
    const set = el('button', 'lnk'); set.type = 'button'; set.dataset.act = 'settings'; strip.appendChild(set);
    const brand = el('div', 'brand'); brand.appendChild(el('h1', 'logo', 'R9&#8209;SI')); if (splash) { splash.style.position = 'static'; splash.style.margin = '0'; brand.appendChild(splash); } box.appendChild(brand);
    const tiles = el('div', 'tiles');
    for (const k of TILES) { const b = el('button', 'tile ' + k); b.type = 'button'; b.dataset.act = 'tile'; b.dataset.tile = k; b.innerHTML = `<span class="pic" aria-hidden="true">${SVG[k]}</span><span class="lbl"></span><span class="sub2"></span>`; tiles.appendChild(b); }
    box.appendChild(tiles);
    const sub = el('div', 'sub'); const w = el('button', 'lnk'); w.type = 'button'; w.dataset.act = 'worlds'; const n = el('button', 'lnk'); n.type = 'button'; n.dataset.act = 'newworld'; sub.appendChild(w); sub.appendChild(el('span', 'dot', '·')).setAttribute('aria-hidden', 'true'); sub.appendChild(n); box.appendChild(sub);
    const foot = el('div', 'below');
    foot.appendChild(el('div', 'studionote', '')).id = 'studionote';
    foot.appendChild(el('div', 'mphosts', '')).id = 'mphosts';
    foot.appendChild(el('div', 'titlenote', '')).id = 'titlenote';
    box.appendChild(foot);
    // (the strip comes after the tiles in the page: the first Tab lands on ▶; it still shows top right — on a phone on top)
    box.appendChild(strip);
    const f2 = el('div', 'foot'); if (gpu) f2.appendChild(gpu); else f2.appendChild(el('span', '', '')).id = 'gpuinfo';
    const lg = el('button', 'lnk legal'); lg.type = 'button'; lg.dataset.act = 'legal'; lg.dataset.legal = 'start'; lg.hidden = true; f2.appendChild(lg);   // (data-legal: VR.Legal adds no second one)
    f2.appendChild(el('span', 'credit', '')); box.appendChild(f2);
    title.appendChild(box);
    if (VR.Hints) VR.Hints.host = ui.root;
    // 🎒 Meins: its own screen (the cards come with renderMeins)
    if (!$('#meins')) { const m = el('div', 'screen'); m.id = 'meins'; m.innerHTML = '<div class="panel box meins"><div class="mhead"><h2></h2><button class="btn small" data-act="meinsback"></button></div><div class="mchips"></div><div class="mbody"></div></div>'; ui.root.appendChild(m); }
    worldsPanel(); createForm();
    texts();
    if (VR.UIPrefs) VR.UIPrefs.on(() => { texts(); });
    if (VR.I18N && VR.I18N.on) VR.I18N.on(() => { texts(); worldsPanel(); createForm(); if (ui.screen === 'worlds') ST.worlds(ui); else if (ui.screen === 'meins') ST.renderMeins(); try { if (ui.renderHosts) ui.renderHosts(); if (ui.studioNote) ui.studioNote(); } catch (e) { /* not built yet */ } });
    // the worlds, read once now and again whenever the start screen shows
    ST.listWorlds().then(() => texts());
  }
  ST.mount = mount;
  // every label on the start screen (also after a language change, also after a Profi switch)
  function texts() {
    const title = $('#title'); if (!title) return;
    const p = prefs(), ws = ST.worldsCache, last = ws && ws[0];
    for (const k of TILES) {
      const b = $(`#title .tile[data-tile="${k}"]`); if (!b) continue;
      const lbl = k === 'play' ? (ws === null ? '▶ …' : ws.length ? tl('play') : tl('first')) : tl(k);
      $('.lbl', b).textContent = lbl;
      $('.sub2', b).textContent = k === 'play' ? (last ? last.name : (ws && ws.length === 0 ? tx('start.myWorld', null, 'Meine Welt', 'My World') : '')) : k === 'bauen' ? tx('start.bauenSub', null, 'Häuser & Möbel setzen', 'Place houses & furniture') : k === 'erschaffen' ? tx('start.erschaffenSub', null, 'Haus · Fahrzeug · Figur …', 'House · vehicle · figure …') : tx('start.meinsSub', null, 'Favoriten · Designs · Welten', 'Favourites · designs · worlds');
      b.title = k === 'play' ? (last ? tx('start.playT', { n: last.name }, 'Weiter in „{n}“, wo du warst', 'Back into “{n}”, where you were') : tx('start.firstT', null, 'Macht deine erste Welt und bringt dich hinein', 'Makes your first world and takes you in')) : '';
      if (k === 'play') b.classList.toggle('pulse', !!(VR.Hints && VR.Hints.want('play')));
    }
    $('#title [data-act="worlds"]').textContent = tx('start.worlds', null, 'Andere Welt', 'Another world');
    $('#title [data-act="newworld"]').textContent = tx('start.newWorld', null, '＋ Neue Welt', '＋ New world');
    $('#title [data-act="settings"]').textContent = tx('start.settings', null, '⚙ Einstellungen', '⚙ Settings');
    const aa = $('#title [data-act="scale"]'); aa.title = tx('start.scaleT', null, 'Große Schrift', 'Large text'); aa.setAttribute('aria-label', aa.title); aa.setAttribute('aria-pressed', String(p.scale >= 1.3)); aa.classList.toggle('on', p.scale >= 1.3);
    // (VR.Legal's own words when it has them — the overlay and its buttons say the same)
    for (const b of document.querySelectorAll('#ui [data-act="legal"]')) { const LG = VR.Legal; b.hidden = !legalOK(); b.textContent = LG && typeof LG.label === 'function' ? LG.label() : tx('start.legal', null, '📜 Impressum & Datenschutz', '📜 Legal notice & privacy'); if (LG && typeof LG.tip === 'function') b.title = LG.tip(); }
    pauseTexts();
    for (const b of document.querySelectorAll('#proSwitch button, .proswitch button')) { const on = (b.dataset.pro === '1') === !!p.pro; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); b.textContent = b.dataset.pro === '1' ? tx('start.pro', null, 'Profi', 'Pro') : tx('start.einfach', null, 'Einfach', 'Simple'); b.title = b.dataset.pro === '1' ? tx('start.proT', null, 'Alles: Werkbank, Crafter, Welten-Formular, Befehle, Entwickler-Reiter', 'Everything: workbench, crafter, the world form, commands, developer tabs') : tx('start.einfachT', null, 'Nur das Nötige, groß und klar', 'Only what you need, big and clear'); }
    { const h = $('#meins .mhead h2'), bk = $('#meins [data-act="meinsback"]'); if (h) h.textContent = tl('meins'); if (bk) bk.textContent = tx('start.back', null, '← Zurück', '← Back'); }
    const credit = $('#title .credit'); if (credit) credit.textContent = tx('start.credit', null, 'Ein eigenes Voxelspiel · inspiriert vom Block-Sandbox-Genre', 'Original voxel game · inspired by the block sandbox genre');
  }
  ST.texts = texts;
  ST.render = () => { texts(); ST.listWorlds().then(() => texts()); };
  ST.listWorlds = async function () {
    const g = game(); if (!g || !g.store) return [];
    let ws = []; try { ws = await g.store.listWorlds(); } catch (e) { ws = []; }
    ST.worldsCache = ws.filter(w => w && w.id && !w.guest).sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
    return ST.worldsCache;
  };

  // ---------------------------------------------------------------- ▶ one click into a world
  ST.play = async function () {
    const g = game(); if (!g || g.state !== 'title') return false;
    if (VR.Hints) VR.Hints.done('play');
    const ws = await ST.listWorlds();
    if (!ws.length) return ST.newWorld();
    g.loadWorld(ws[0]);
    return true;
  };
  // „Meine Welt" (Zen, Realm), „Meine Welt 2", …
  ST.newWorld = async function () {
    const g = game(); if (!g || g.state !== 'title') return false;
    const ws = await ST.listWorlds(), base = tx('start.myWorld', null, 'Meine Welt', 'My World');
    const n = ws.filter(w => String(w.name || '').startsWith(base)).length;
    g.createWorld({ name: base + (n ? ' ' + (n + 1) : ''), mode: 'zen', difficulty: 'peaceful', type: 'default', seed: '', cheats: true, kit: true });
    return true;
  };
  ST.bauen = async function () {
    const ws = await ST.listWorlds();
    const h = ws.length ? '#world/' + encodeURIComponent(ws[0].id) + '/karte' : '#bauen';
    try { location.href = 'studio.html' + (location.search || '') + h; } catch (e) { /* no studio page next to this one */ }
  };
  ST.erschaffen = function () { try { location.href = 'studio.html' + (location.search || '') + '#erschaffen'; } catch (e) { /* */ } };

  // ---------------------------------------------------------------- the worlds as cards
  function worldsPanel() {
    const panel = $('#worlds .panel'); if (!panel) return;
    panel.innerHTML = `<h2>🌍 ${esc(tx('start.worldsTitle', null, 'Welten', 'Worlds'))}</h2><div class="worldlist" id="worldlist"></div><div class="row gap wrow"><button class="btn primary" data-act="newworld">${esc(tx('start.newWorld', null, '＋ Neue Welt', '＋ New world'))}</button><button class="btn" data-act="back">${esc(tx('start.back', null, '← Zurück', '← Back'))}</button></div>`;
    panel.onclick = (e) => { const arm = $('#worlds .wcard button.arm'); if (arm && !arm.contains(e.target)) { arm.classList.remove('arm'); arm.textContent = tx('start.del', null, '🗑 Löschen', '🗑 Delete'); } };
  }
  // one world, one card: ▶ · 🏗 · ✎ · 🗑 (the worlds screen and 🎒 Meins; 🎒 Meins adds 📽 Zeitraffer); seed and time
  // are a Profi detail
  function worldCard(w, zeit) {
    const c = el('div', 'wcard'); c.dataset.id = w.id;
    c.innerHTML = `<div class="wtxt"><div class="wn"></div><div class="wm"></div></div><div class="wacts"></div>`;
    $('.wn', c).textContent = w.name || tx('start.world', null, 'Welt', 'World');
    const when = w.lastPlayed ? new Date(w.lastPlayed).toLocaleString(VR.I18N ? VR.I18N.locale() : undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
    $('.wm', c).innerHTML = esc(modeName(w.mode)) + (when ? ' · ' + esc(when) : '') + `<span class="pro"> · Seed ${w.seed >>> 0}</span>`;
    const acts = $('.wacts', c);
    const BTN = [['play', tx('start.w.play', null, '▶ Spielen', '▶ Play'), 'primary'], ['bauen', tx('start.w.bauen', null, '🏗 Bauen', '🏗 Build'), ''], ['rename', tx('start.w.rename', null, '✎ Name', '✎ Rename'), ''], ['del', tx('start.del', null, '🗑 Löschen', '🗑 Delete'), 'danger']];
    if (zeit) BTN.splice(2, 0, ['zeit', tx('meins.zeit', null, '📽 Zeitraffer', '📽 Time-lapse'), '']);
    for (const [k, label, cls] of BTN) { const b = el('button', 'btn small ' + cls); b.type = 'button'; b.dataset.act = 'w:' + k; b.dataset.w = k; b.dataset.id = w.id; b.textContent = label; if (k === 'rename' || k === 'del') b.setAttribute('aria-label', label + ' · ' + (w.name || '')); acts.appendChild(b); }
    return c;
  }
  ST.worlds = async function (ui) {
    ui = ui || ST.ui; ui.show('worlds');
    const list = await ST.listWorlds(), wl = $('#worldlist'); if (!wl) return;
    wl.innerHTML = '';
    if (!list.length) { wl.appendChild(el('div', 'note', esc(tx('start.noWorlds', null, 'Noch keine Welt — ＋ Neue Welt macht eine.', 'No world yet — ＋ New world makes one.')))); return; }
    for (const w of list) wl.appendChild(worldCard(w));
    const first = $('#worldlist .wcard [data-w="play"]'); if (first && ST.kbd) first.focus({ preventScroll: true });   // (keyboard: Enter plays the newest world)
  };
  async function worldAct(k, b) {
    const g = game(), id = b.dataset.id, w = (ST.worldsCache || []).find(x => x.id === id); if (!w) return;
    if (k === 'play') { g.loadWorld(w); return; }
    if (k === 'bauen') { try { location.href = 'studio.html' + (location.search || '') + '#world/' + encodeURIComponent(id) + '/karte'; } catch (e) { /* */ } return; }
    if (k === 'zeit') { if (VR.Zeit) VR.Zeit.openWorld(w); return; }   // 📽: in this world now, or it opens and plays
    if (k === 'rename') {
      const card = b.closest('.wcard'), nm = $('.wn', card); if (!nm || $('input', nm)) return;
      const inp = document.createElement('input'); inp.type = 'text'; inp.maxLength = 40; inp.value = w.name || ''; nm.textContent = ''; nm.appendChild(inp); inp.focus(); inp.select();
      let fin = false;
      const end = async (ok) => { if (fin) return; fin = true; const v = inp.value.replace(/[<>]/g, '').trim().slice(0, 40); if (ok && v && v !== w.name) { w.name = v; try { await g.store.saveWorld(w); } catch (e) { /* */ } } ST.worlds(); };
      inp.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') end(true); else if (e.key === 'Escape') end(false); };
      inp.onblur = () => end(true);
      return;
    }
    if (k === 'del') {
      if (b.classList.contains('arm') && Date.now() - (+b.dataset.armAt || 0) < 4000) { b.classList.remove('arm'); try { await g.store.deleteWorld(id); } catch (e) { /* */ } ST.worldsCache = null; ST.worlds(); return; }
      b.classList.add('arm'); b.dataset.armAt = String(Date.now()); b.textContent = tx('start.delSure', null, 'Sicher? Nochmal 🗑', 'Sure? 🗑 again');
      setTimeout(() => { if (b.isConnected && b.classList.contains('arm')) { b.classList.remove('arm'); b.textContent = tx('start.del', null, '🗑 Löschen', '🗑 Delete'); } }, 4000);
    }
  }

  // ---------------------------------------------------------------- the pause menu (Einfach: seven things; Profi adds the rest)
  // its words are the game's table keys (data-t / data-tt): ui.js's retext() renews them when the language changes
  function pauseMenu() {
    const panel = $('#pause .panel'); if (!panel || panel.dataset.w1) return;
    panel.dataset.w1 = '1';
    // three groups: the way on (▶ 🏗 🎒 🏠 📍), the tools (multiplayer, Zen, Profi's Werkbank · Codex · Foto), the way out
    // (⚙ ⏏) — one column in Einfach; Profi puts the tools beside the rest, so the longer menu still fits a 720 px screen
    panel.innerHTML = `<h2 class="ptitle" data-t="g.pause.title"></h2>
      <div class="pgrid">
        <div class="pgrp ptop">
          <button type="button" class="btn primary" data-act="resume" data-t="g.pause.resume"></button>
          <button type="button" class="btn" data-act="bauenlive" data-t="g.pause.bauen" data-tt="g.pause.bauenTip"></button>
          <button type="button" class="btn" data-act="meins" data-t="g.pause.meins"></button>
          <button type="button" class="btn" data-act="zeitraffer" data-t="g.pause.zeit" data-tt="g.pause.zeitTip"></button>
          <div class="row gap"><button type="button" class="btn" data-act="gohome" style="flex:1" data-t="g.pause.home"></button><button type="button" class="btn" data-act="sethome" style="flex:1" data-t="g.pause.spawn" data-tt="g.pause.spawnTip"></button></div>
        </div>
        <div class="pgrp pside">
          <div id="mppanel" class="col gap"></div>
          <div id="zenpanel" class="col gap"></div>
          <button type="button" class="btn studio pro" data-act="studiolive" id="studiolive" data-t="g.pause.studio" data-tt="g.pause.studioTip"></button>
          <button type="button" class="btn pro" data-act="codex" data-t="g.pause.codex"></button>
          <button type="button" class="btn pro" data-act="photo" data-t="g.pause.photo"></button>
        </div>
        <div class="pgrp pbottom">
          <button type="button" class="btn" data-act="settings" data-t="g.pause.settings"></button>
          <button type="button" class="btn" data-act="quit" data-t="g.pause.quit"></button>
        </div>
      </div>
      <div class="row prorow"><div class="proswitch" role="group"><button type="button" class="lnk" data-act="pro" data-pro="0"></button><button type="button" class="lnk" data-act="pro" data-pro="1"></button></div><button type="button" class="lnk legal" data-act="legal" data-legal="pause" hidden></button></div>
      <div class="note" style="text-align:center" id="pausenote"></div>`;
    if (VR.I18N && VR.I18N.retext) VR.I18N.retext(panel);
    texts();
  }
  function pauseTexts() {
    const panel = $('#pause .panel'); if (!panel || !panel.dataset.w1) return;
    if (VR.I18N && VR.I18N.retext) VR.I18N.retext(panel);
  }
  ST.pauseMenu = pauseMenu;

  // ---------------------------------------------------------------- the create form (Profi), in German
  function createForm() {
    const panel = $('#create .panel'); if (!panel) return;
    const seg = (id, label, items, on) => `<div class="seg" id="${id}" role="group" aria-label="${esc(label)}">` + items.map(([v, name, sub]) => `<button type="button" data-v="${v}"${v === on ? ' class="on"' : ''}>${esc(name)}${sub ? `<small>${esc(sub)}</small>` : ''}</button>`).join('') + '</div>';
    const L = { name: tx('start.cw.name', null, 'Weltname', 'World name'), mode: tx('start.cw.mode', null, 'Spielart', 'Game mode'), diff: tx('start.cw.diff', null, 'Schwierigkeit', 'Difficulty'), type: tx('start.cw.type', null, 'Welttyp', 'World type'), seed: tx('start.cw.seed', null, 'Seed (optional)', 'Seed (optional)') };
    panel.innerHTML = `<h2>${esc(tx('start.newWorld', null, '＋ Neue Welt', '＋ New world'))}</h2>
      <div class="field"><label for="cw_name">${esc(L.name)}</label><input type="text" id="cw_name" maxlength="40"></div>
      <div class="field"><label>${esc(L.mode)}</label>${seg('cw_mode', L.mode, [['survival', t('g.mode.survival'), tx('start.cw.survivalS', null, 'Sammeln, bauen, überleben', 'Gather, craft, survive')], ['creative', t('g.mode.creative'), tx('start.cw.creativeS', null, 'Alle Blöcke, Fliegen', 'Every block, flying')], ['zen', t('g.mode.zen'), tx('start.cw.zenS', null, 'In Ruhe: keine Monster, kein Schaden', 'At ease: no monsters, no damage')]], 'zen')}</div>
      <div class="field"><label>${esc(L.diff)}</label>${seg('cw_diff', L.diff, [['peaceful', tx('start.cw.peaceful', null, 'Friedlich', 'Peaceful')], ['easy', tx('start.cw.easy', null, 'Leicht', 'Easy')], ['normal', tx('start.cw.normal', null, 'Normal', 'Normal')], ['hard', tx('start.cw.hard', null, 'Schwer', 'Hard')]], 'normal')}</div>
      <div class="field"><label>${esc(L.type)}</label>${seg('cw_type', L.type, [['default', tx('start.cw.default', null, 'Realm', 'Realm')], ['large', tx('start.cw.large', null, 'Große Biome', 'Large biomes')], ['amplified', tx('start.cw.amplified', null, 'Verstärkt', 'Amplified')], ['flat', tx('start.cw.flat', null, 'Flach', 'Flat')]], 'default')}</div>
      <div class="field"><label for="cw_seed">${esc(L.seed)}</label><input type="text" id="cw_seed" placeholder="${esc(tx('start.cw.seedP', null, 'Leer lassen für Zufall', 'Leave empty for a random one'))}"></div>
      <div class="row gap" style="flex-wrap:wrap">
        <label class="row gap note"><input type="checkbox" id="cw_cheats" checked> ${esc(tx('start.cw.cheats', null, 'Befehle', 'Commands'))}</label>
        <label class="row gap note"><input type="checkbox" id="cw_keep"> ${esc(tx('start.cw.keep', null, 'Inventar behalten', 'Keep inventory'))}</label>
        <label class="row gap note"><input type="checkbox" id="cw_kit" checked> ${esc(tx('start.cw.kit', null, 'Starter-Kit', 'Starter kit'))}</label>
      </div>
      <div class="hr"></div>
      <div class="row gap"><button type="button" class="btn primary" data-act="docreate">${esc(tx('start.cw.go', null, 'Welt erstellen', 'Create world'))}</button><button type="button" class="btn small" data-act="toworlds">${esc(tx('start.cw.cancel', null, 'Abbrechen', 'Cancel'))}</button></div>`;
    for (const id of ['cw_mode', 'cw_diff', 'cw_type']) $('#' + id).addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; for (const x of b.parentNode.children) { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); } });
    for (const id of ['cw_mode', 'cw_diff', 'cw_type']) for (const x of $('#' + id).children) x.setAttribute('aria-pressed', String(x.classList.contains('on')));
    for (const i of ['cw_name', 'cw_seed']) $('#' + i).addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') { const go = $('#create [data-act="docreate"]'); if (go) go.click(); } });
  }

  // ---------------------------------------------------------------- the actions (before ui.js's own)
  ST.act = function (a, b, ui) {
    switch (a) {
      case 'tile': { const k = b && b.dataset.tile; if (k === 'play') ST.play(); else if (k === 'bauen') ST.bauen(); else if (k === 'erschaffen') ST.erschaffen(); else if (k === 'meins') ST.meins(ui.screen === 'pause' ? 'pause' : 'title'); return true; }
      case 'worlds': ST.worlds(ui); return true;
      case 'newworld': if (prefs().pro) { ui.show('create'); const n = $('#cw_name'); if (n) { n.value = tx('start.newWorldName', null, 'Neue Welt', 'New World'); try { n.focus({ preventScroll: true }); n.select(); } catch (e) { /* */ } } const s = $('#cw_seed'); if (s) s.value = ''; } else ST.newWorld(); return true;
      case 'bauenlive': { const g = game(); if (!g || !g.openStudio('karte')) ui.hint(t('g.pause.studioGuest'), 2400); return true; }
      case 'meins': ST.meins(ui.screen === 'pause' ? 'pause' : 'title'); return true;
      case 'zeitraffer': if (VR.Zeit) VR.Zeit.open(ui.screen === 'pause' ? 'pause' : null); return true;
      case 'legal': if (legalOK()) VR.Legal.open('impressum'); return true;
      case 'meinsback': ui.show(ST.meinsFrom === 'pause' && game() && game().state === 'play' ? 'pause' : 'title'); return true;
      case 'pro': if (VR.UIPrefs) VR.UIPrefs.set({ pro: b.dataset.pro === '1' }); return true;
      case 'scale': if (VR.UIPrefs) VR.UIPrefs.set({ scale: prefs().scale >= 1.3 ? 1.15 : 1.3 }); return true;
      default:
        if (a && a.startsWith('w:')) { worldAct(a.slice(2), b); return true; }
        return false;
    }
  };
  // ---------------------------------------------------------------- 🎒 Meins: your things as cards (and the worlds)
  ST.meins = function (from) { const ui = ST.ui; if (!ui) return; ST.meinsFrom = from || 'title'; ui.show('meins'); ST.renderMeins().then(() => { const c = $('#meins .mchips button.on'); if (c && ST.kbd) c.focus({ preventScroll: true }); }); };
  ST.meinsChip = 'all';
  const CHIPS = () => [['all', tx('meins.all', null, 'Alles', 'All')], ['fav', '★ ' + tx('meins.fav', null, 'Favoriten', 'Favourites')], ['house', '🏠 ' + tx('meins.house', null, 'Häuser', 'Houses')], ['furn', '🪑 ' + tx('meins.furn', null, 'Möbel', 'Furniture')], ['parts', '🧱 ' + tx('meins.parts', null, 'Bauteile', 'Pieces')], ['worlds', '🌍 ' + tx('start.worldsTitle', null, 'Welten', 'Worlds')]];
  const chipOf = (id) => { const k = id[0]; return k === 'h' || k === 'k' || k === 's' ? 'house' : k === 'm' || k === 'g' ? 'furn' : k === 'p' ? 'parts' : 'other'; };
  ST.renderMeins = async function () {
    const Dg = VR.Ding, chips = $('#meins .mchips'), body = $('#meins .mbody'); if (!Dg || !chips || !body) return;
    dingHandlers();
    chips.innerHTML = '';
    for (const [k, label] of CHIPS()) { const b = el('button', k === ST.meinsChip ? 'on' : '', esc(label)); b.type = 'button'; b.dataset.chip = k; b.setAttribute('aria-pressed', String(k === ST.meinsChip)); b.onclick = () => { ST.meinsChip = k; ST.renderMeins().then(() => { const n = $(`#meins .mchips [data-chip="${k}"]`); if (n && ST.kbd) n.focus({ preventScroll: true }); }); }; chips.appendChild(b); }
    body.innerHTML = '';
    const all = Dg.list().filter(x => Dg.parse(x.id));
    const chip = ST.meinsChip, items = chip === 'all' ? all : chip === 'fav' ? all.filter(x => Dg.isFav(x.id)) : chip === 'worlds' ? [] : all.filter(x => chipOf(x.id) === chip);
    const ws = chip === 'all' || chip === 'worlds' ? await ST.listWorlds() : [];
    if (!items.length && !ws.length) { body.appendChild(el('div', 'note', esc(chip === 'worlds' ? tx('start.noWorlds', null, 'Noch keine Welt — ＋ Neue Welt macht eine.', 'No world yet — ＋ New world makes one.') : tx('meins.empty', null, 'Noch nichts hier — ✨ Erschaffen macht dein erstes Ding.', 'Nothing here yet — ✨ Create makes your first thing.')))); return; }
    for (const x of items.slice(0, 200)) body.appendChild(Dg.render(x.id, { picW: 220, picH: 120 }));
    Dg.fillNow(body, 24);   // (the first screen of cards has its pictures at once; the rest as they scroll in)
    if (ws.length) {
      body.appendChild(el('div', 'grp', '🌍 ' + esc(tx('start.worldsTitle', null, 'Welten', 'Worlds'))));
      for (const w of ws) { const c = worldCard(w, true); c.style.gridColumn = '1 / -1'; body.appendChild(c); }
    }
  };
  // the cards' actions on this page: 👁 and ✏️ open the R9 Studio on the thing, 📍 puts it in your hand (in play now,
  // else when ▶ opens the world), 📦 makes the one-thing pack
  function dingHandlers() {
    const Dg = VR.Ding; if (!Dg || Dg.handlers.__game) return;
    // in play the Studio opens over the game (nothing is lost); from the start screen it is the page itself
    const studio = (h) => { const g = game(); if (g && g.state === 'play') { if (!g.openStudio(h)) g.ui.hint(t('g.pause.studioGuest'), 2400); return; } try { location.href = 'studio.html' + (location.search || '') + h; } catch (e) { /* no studio page next to this one */ } };
    Dg.handlers = {
      __game: true,
      view: (id) => studio('#ding/' + id),
      edit: (id) => studio('#ding/' + id + '/edit'),
      canSet: (id) => /^[bmh]:/.test(id),
      canEdit: (id) => !/^p:/.test(id) || prefs().pro,
      set: (id) => {
        const g = game(), d = Dg.parse(id); if (!g || !d) return false;
        const item = d.kind === 'h' ? 'blueprint_' + d.key : d.key;
        if (g.state === 'play' && g.player && ST.handAllowed(g.meta) && VR.itemDef(item)) {
          const inv = g.player.inv; inv.slots[inv.sel] = { id: item, n: VR.maxStack(item) }; inv.changed = true; g.ui.updateHUD(true);
          g.ui.resume(); g.ui.hint(tx('hand.toast', { n: VR.itemName(item) }, '{n} — Rechtsklick setzt es', '{n} — right click places it'), 2600);
          return true;
        }
        if (g.state === 'play') { g.ui.hint(tx('hand.noSurvival', null, 'Setzen geht in deiner eigenen Welt im Kreativ- oder Zen-Modus', 'Placing works in your own world in Creative or Zen'), 2600); return false; }
        try { localStorage.setItem('r9si.hand', JSON.stringify({ v: 1, ding: id, world: null, t: Date.now() })); } catch (e) { /* */ }
        ST.play();
        return true;
      },
      pic: (id, w, h) => {
        const g = game(), d = Dg.parse(id); if (!g || !g.icons || !d) return null;
        const item = d.kind === 'h' ? 'blueprint_' + d.key : d.kind === 'b' || d.kind === 'm' ? d.key : null;
        if (!item || !VR.itemDef(item)) return null;
        const c = document.createElement('canvas'); c.width = 64; c.height = 64; c.style.imageRendering = 'pixelated'; c.style.objectFit = 'contain'; c.style.width = '64px'; c.style.height = '64px';
        try { g.icons.paint(c, item, 64); } catch (e) { return null; }
        return c;
      },
    };
  }
  ST.dingHandlers = dingHandlers;

  // ---------------------------------------------------------------- 🧭 hints 2 and 3, and the Ding in your hand
  // polled four times a second (no per-frame work, nothing in the game loop): after 5 s standing in the world the move
  // hint; walking (W A S D or 1.5 blocks) ends it and brings the fly hint (not in Survival); flying ends that one
  let hintState = { lastPos: null, standAt: 0, wasPlay: false };
  const touch = () => (typeof window !== 'undefined' && ('ontouchstart' in window) && !window.matchMedia('(hover: hover)').matches);
  function hintTick() {
    const g = game(), H = VR.Hints; if (!g || !H) return;
    const p = g.player, playing = g.state === 'play' && !!p && !g.studioOpen;
    if (playing && !hintState.wasPlay) { hintState.lastPos = null; handIn(g); }
    hintState.wasPlay = playing;
    if (!playing) { if (H.current()) H.dismiss(); return; }
    if (g.ui.screen || g.ui.typing) return;   // a menu is open: wait
    const now = performance.now();
    if (!hintState.lastPos) { hintState.lastPos = p.pos.slice(); hintState.standAt = now; }
    const inp = g.input, keys = !!(inp && (inp.down('KeyW') || inp.down('KeyA') || inp.down('KeyS') || inp.down('KeyD')));
    const d = Math.hypot(p.pos[0] - hintState.lastPos[0], p.pos[2] - hintState.lastPos[2]);
    if (keys || d > 1.5) { H.done('move'); hintState.lastPos = p.pos.slice(); hintState.standAt = now; }
    if (p.flying) H.done('fly');
    const st = H.read();
    if (!st.done.move) { if (now - hintState.standAt > 5000 && H.want('move')) H.show('move', hintOf('move')); return; }
    if (!st.done.fly && p.mode !== 'survival' && H.want('fly')) H.show('fly', hintOf('fly'));
  }
  // a hint's line and pictograms (again when the language changes while it shows)
  function hintOf(id) {
    if (id === 'move') return touch() ? { text: tx('hint.moveTouch', null, '👆 ziehen = umschauen · 🕹 laufen', '👆 drag = look around · 🕹 walk'), picto: ['finger'] } : { text: tx('hint.move', null, '🖱 bewegen = umschauen · W A S D = laufen', '🖱 move = look around · W A S D = walk'), picto: ['mouse', 'W', 'A', 'S', 'D'] };
    if (id === 'fly') return { text: tx('hint.fly', null, 'Leertaste 2× = fliegen', 'Space twice = fly'), picto: ['Space', 'Space'] };
    return null;
  }
  if (VR.I18N && VR.I18N.on) VR.I18N.on(() => { const H = VR.Hints, id = H && H.current(), h = id && hintOf(id); if (h && H.retext) H.retext(h.text); });
  // a Ding set from the start screen (📍 Setzen on a card) is in your hand when the world opens — your own world,
  // Creative or Zen (never a free item in Survival); r9si.hand is read once
  ST.handAllowed = (meta) => !!(meta && !meta.guest && (meta.mode === 'creative' || meta.mode === 'zen'));
  function handIn(g) {
    let h = null; try { h = JSON.parse(localStorage.getItem('r9si.hand') || 'null'); } catch (e) { h = null; }
    if (!h) return;
    try { localStorage.removeItem('r9si.hand'); } catch (e) { /* */ }
    const d = VR.Ding && VR.Ding.parse(h.ding); if (!d || !ST.handAllowed(g.meta) || (h.world && h.world !== g.meta.id)) return;
    const id = d.kind === 'h' ? 'blueprint_' + d.key : d.kind === 'b' || d.kind === 'm' ? d.key : null;
    if (!id || !VR.itemDef(id) || !g.player) return;
    const inv = g.player.inv; inv.slots[inv.sel] = { id, n: VR.maxStack(id) }; inv.changed = true;
    if (g.ui.updateHUD) g.ui.updateHUD(true);
    if (g.ui.toast) g.ui.toast(tx('hand.title', null, '🖐 In der Hand', '🖐 In hand'), tx('hand.toast', { n: VR.itemName(id) }, '{n} — Rechtsklick setzt es', '{n} — right click places it'), id);
  }
  setInterval(hintTick, 250);

  // ---------------------------------------------------------------- hooks into ui.js (kept to one wrapper each)
  const UI = VR.UI; if (!UI) return;
  const origBuild = UI.prototype.build;
  UI.prototype.build = function () { origBuild.call(this); try { mount(this); } catch (e) { console.error('start screen', e); } };
  const origAct = UI.prototype.act;
  UI.prototype.act = function (a, b) { if (ST.act(a, b, this)) return; origAct.call(this, a, b); };
  const origShow = UI.prototype.show;
  UI.prototype.show = function (id) {
    origShow.call(this, id); if (id === 'title') ST.render();
    // (the canvas leaves the Tab order while a screen is up: the first Tab on the start screen is ▶)
    const gl = document.getElementById('gl'); if (gl) gl.tabIndex = id ? -1 : 0;
  };
  UI.prototype.showWorlds = function () { return ST.worlds(this); };
  // Esc: one step back — 🎒 Meins to where it came from; at the start the worlds, the create form and the settings too
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !ST.ui) return;
    const ui = ST.ui, g = game(), sc = ui.screen, ae = document.activeElement;
    if (ae && /INPUT|TEXTAREA|SELECT/.test(ae.tagName) && ae.value && sc !== 'meins') return;   // (a field with text: Esc stays with it)
    let to = null;
    if (sc === 'meins') { e.preventDefault(); e.stopImmediatePropagation(); ST.act('meinsback', null, ui); to = ui.screen === 'pause' ? '#pause [data-act="meins"]' : '#title .tile[data-tile="meins"]'; }
    else if (g && g.state === 'title' && (sc === 'worlds' || sc === 'create' || sc === 'settings')) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (sc === 'worlds') { ui.show('title'); to = '#title [data-act="worlds"]'; }
      else if (sc === 'create') { ST.worlds(ui); to = '#worlds [data-act="newworld"]'; }
      else { ui.act('setback'); to = '#title [data-act="settings"]'; }
    }
    if (to && ST.kbd) setTimeout(() => { const t = $(to) || $('#title .tile[data-tile="play"]'); if (t && t.focus) t.focus({ preventScroll: true }); }, 30);
  }, true);
  const origPause = UI.prototype.pause;
  UI.prototype.pause = function () {
    if (this.game.state !== 'play') return; pauseMenu(); origPause.call(this);
    // (Einfach: the multiplayer box only where playing together works — the note why it does not is a Profi detail)
    const mpp = $('#mppanel'), mp = this.game.mp; if (mpp) mpp.classList.toggle('pro', !(mp && mp.ready));
    const pn = $('#pausenote'), g = this.game; if (pn && g.meta && !prefs().pro) pn.textContent = g.meta.name || '';   // (the seed: Profi)
  };
  // the cheat-like chat commands are a Profi thing (Einfach: the chat stays, /give, /time, /tp … get the note). The
  // friendly ones work in Einfach too: the language, the way home, the block look, the weather and 🏭 /bau — they change
  // nothing a world's rules forbid (survival without cheats still refuses /bau and /wetter after this gate)
  ST.einfachCmd = (text) => /^\/(lang|sprache|home|spawn|sethome|look|wetter|weather|bau|forge|players|list|tphost|call)(\s|$)/i.test(text);
  if (VR.Game) {
    const origChat = VR.Game.prototype.chat;
    VR.Game.prototype.chat = function (text) {
      if (typeof text === 'string' && /^\/help(\s|$)/i.test(text) && !prefs().pro) { this.ui.chatLine(tx('start.cmdHelp', null, 'Befehle: /bau <Wunsch> (z. B. „/bau Holzhaus mit Pool“) · /home · /sethome · /look klassisch | nahtlos · /wetter · /sprache — alle weiteren im Profi-Modus. (/bau und /wetter nicht im Überleben ohne Cheats.)', 'Commands: /bau <wish> (e.g. “/bau wooden house with pool”) · /home · /sethome · /look classic | seamless · /wetter · /lang — all others with Pro. (/bau and /wetter: not in survival without cheats.)'), '#cfe6ff'); return; }
      if (typeof text === 'string' && text.startsWith('/') && !prefs().pro && !ST.einfachCmd(text)) { this.ui.chatLine(tx('start.cmdPro', null, 'Befehle gibt es im Profi-Modus (Start · Profi).', 'Commands come with Pro (start screen · Pro).'), '#ffd27a'); return; }
      return origChat.call(this, text);
    };
  }
  // keyboard or pointer: a screen opened with the keyboard puts the focus on its first button (Tab · Enter · Esc)
  let kbd = false;
  window.addEventListener('keydown', (e) => { if (e.key === 'Tab' || e.key === 'Enter' || e.key === ' ' || e.key === 'Escape' || /^Arrow/.test(e.key)) kbd = true; }, true);
  window.addEventListener('pointerdown', () => { kbd = false; }, true);
  Object.defineProperty(ST, 'kbd', { get: () => kbd });
  // the multiplayer box on the start screen: in Einfach only when there is a friend's world to join
  const origHosts = UI.prototype.renderHosts;
  if (origHosts) UI.prototype.renderHosts = function () { origHosts.call(this); const box = $('#mphosts'); if (box) box.classList.toggle('has', !!box.querySelector('.mphost')); };
})(VR);
