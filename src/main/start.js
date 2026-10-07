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
// Texts: VR.I18N.tx(key, vars, de, en) — German first, English second.
// ============================================================================
(function (VR) {
  'use strict';
  const ST = VR.Start = {};
  const $ = (s, r) => (r || document).querySelector(s);
  const tx = (k, v, de, en) => (VR.I18N && VR.I18N.tx ? VR.I18N.tx(k, v, de, en) : de);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const prefs = () => (VR.UIPrefs ? VR.UIPrefs.get() : { pro: false, scale: 1.15 });
  const game = () => VR.game;
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const SVG = {
    play: '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="27" fill="none" stroke="currentColor" stroke-width="3"/><path d="M26 20l18 12-18 12z" fill="currentColor"/></svg>',
    bauen: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M8 30L32 10l24 20" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M14 27v26h36V27" fill="none" stroke="currentColor" stroke-width="3"/><path d="M14 36h36M14 45h36M26 36v9M38 27v9M32 45v8M20 45v8M44 45v8" stroke="currentColor" stroke-width="2.2" opacity=".75"/><path d="M40 8h14l-4 6h-6z" fill="currentColor"/><path d="M47 14v10" stroke="currentColor" stroke-width="3"/></svg>',
    erschaffen: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M30 8c2 14 6 18 20 20-14 2-18 6-20 20-2-14-6-18-20-20 14-2 18-6 20-20z" fill="currentColor"/><path d="M49 36c1 6 3 8 9 9-6 1-8 3-9 9-1-6-3-8-9-9 6-1 8-3 9-9z" fill="currentColor" opacity=".8"/><path d="M14 44c.7 4 2 5.3 6 6-4 .7-5.3 2-6 6-.7-4-2-5.3-6-6 4-.7 5.3-2 6-6z" fill="currentColor" opacity=".6"/></svg>',
    meins: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M20 20h24a8 8 0 0 1 8 8v20a6 6 0 0 1-6 6H18a6 6 0 0 1-6-6V28a8 8 0 0 1 8-8z" fill="none" stroke="currentColor" stroke-width="3"/><path d="M24 20v-4a8 8 0 0 1 16 0v4" fill="none" stroke="currentColor" stroke-width="3"/><path d="M18 36h28v10a4 4 0 0 1-4 4H22a4 4 0 0 1-4-4z" fill="currentColor" opacity=".35"/><path d="M28 36v6h8v-6" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>',
  };
  const TILES = ['play', 'bauen', 'erschaffen', 'meins'];
  const T = {   // the tile labels (de, en)
    play: ['▶ Weiterspielen', '▶ Play on'], first: ['▶ Losspielen', '▶ Play'], bauen: ['🏗 Bauen', '🏗 Build'], erschaffen: ['✨ Erschaffen', '✨ Create'], meins: ['🎒 Meins', '🎒 Mine'],
  };
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
    for (const v of ['0', '1']) { const b = el('button', 'lnk'); b.dataset.act = 'pro'; b.dataset.pro = v; sw.appendChild(b); }
    strip.appendChild(sw);
    if (VR.I18N && VR.I18N.picker) strip.appendChild(VR.I18N.picker({ cls: 'onstart' }));
    const aa = el('button', 'lnk'); aa.dataset.act = 'scale'; aa.textContent = 'Aa'; strip.appendChild(aa);
    const set = el('button', 'lnk'); set.dataset.act = 'settings'; strip.appendChild(set);
    box.appendChild(strip);
    const brand = el('div', 'brand'); brand.appendChild(el('div', 'logo', 'R9&#8209;SI')); if (splash) { splash.style.position = 'static'; splash.style.margin = '0'; brand.appendChild(splash); } box.appendChild(brand);
    const tiles = el('div', 'tiles');
    for (const k of TILES) { const b = el('button', 'tile ' + k); b.dataset.act = 'tile'; b.dataset.tile = k; b.innerHTML = `<span class="pic">${SVG[k]}</span><span class="lbl"></span><span class="sub2"></span>`; tiles.appendChild(b); }
    box.appendChild(tiles);
    const sub = el('div', 'sub'); const w = el('button', 'lnk'); w.dataset.act = 'worlds'; const n = el('button', 'lnk'); n.dataset.act = 'newworld'; sub.appendChild(w); sub.appendChild(document.createTextNode(' · ')); sub.appendChild(n); box.appendChild(sub);
    const foot = el('div', 'below');
    foot.appendChild(el('div', 'studionote', '')).id = 'studionote';
    foot.appendChild(el('div', 'mphosts', '')).id = 'mphosts';
    foot.appendChild(el('div', 'titlenote', '')).id = 'titlenote';
    box.appendChild(foot);
    const f2 = el('div', 'foot'); if (gpu) f2.appendChild(gpu); else f2.appendChild(el('span', '', '')).id = 'gpuinfo'; f2.appendChild(el('span', 'credit', '')); box.appendChild(f2);
    title.appendChild(box);
    if (VR.Hints) VR.Hints.host = ui.root;
    // 🎒 Meins: its own screen (the cards come with renderMeins)
    if (!$('#meins')) { const m = el('div', 'screen'); m.id = 'meins'; m.innerHTML = '<div class="panel box meins"><div class="mhead"><h2></h2><button class="btn small" data-act="meinsback"></button></div><div class="mchips"></div><div class="mbody"></div></div>'; ui.root.appendChild(m); }
    worldsPanel(); createForm();
    texts();
    if (VR.UIPrefs) VR.UIPrefs.on(() => { texts(); });
    if (VR.I18N && VR.I18N.on) VR.I18N.on(() => { texts(); worldsPanel(); createForm(); if (ui.screen === 'worlds') ST.worlds(ui); });
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
      const lbl = k === 'play' ? (ws === null ? '▶ …' : ws.length ? tx('start.play', null, T.play[0], T.play[1]) : tx('start.first', null, T.first[0], T.first[1])) : tx('start.' + k, null, T[k][0], T[k][1]);
      $('.lbl', b).textContent = lbl;
      $('.sub2', b).textContent = k === 'play' ? (last ? last.name : (ws && ws.length === 0 ? tx('start.myWorld', null, 'Meine Welt', 'My World') : '')) : k === 'bauen' ? tx('start.bauenSub', null, 'Häuser & Möbel setzen', 'Place houses & furniture') : k === 'erschaffen' ? tx('start.erschaffenSub', null, 'Haus · Fahrzeug · Figur …', 'House · vehicle · figure …') : tx('start.meinsSub', null, 'Favoriten · Designs · Welten', 'Favourites · designs · worlds');
      b.title = k === 'play' ? (last ? tx('start.playT', { n: last.name }, 'Weiter in „{n}", wo du warst', 'Back into “{n}”, where you were') : tx('start.firstT', null, 'Macht deine erste Welt und bringt dich hinein', 'Makes your first world and takes you in')) : '';
      if (k === 'play') b.classList.toggle('pulse', !!(VR.Hints && VR.Hints.want('play')));
    }
    $('#title [data-act="worlds"]').textContent = tx('start.worlds', null, 'Andere Welt', 'Another world');
    $('#title [data-act="newworld"]').textContent = tx('start.newWorld', null, '＋ Neue Welt', '＋ New world');
    $('#title [data-act="settings"]').textContent = tx('start.settings', null, '⚙ Einstellungen', '⚙ Settings');
    const aa = $('#title [data-act="scale"]'); aa.title = tx('start.scaleT', null, 'Große Schrift', 'Large text'); aa.classList.toggle('on', p.scale >= 1.3);
    pauseTexts();
    for (const b of document.querySelectorAll('#proSwitch button, .proswitch button')) { const on = (b.dataset.pro === '1') === !!p.pro; b.classList.toggle('on', on); b.textContent = b.dataset.pro === '1' ? tx('start.pro', null, 'Profi', 'Profi') : tx('start.einfach', null, 'Einfach', 'Simple'); b.title = b.dataset.pro === '1' ? tx('start.proT', null, 'Alles: Werkbank, Crafter, Welten-Formular, Befehle, Entwickler-Reiter', 'Everything: workbench, crafter, the world form, commands, developer tabs') : tx('start.einfachT', null, 'Nur das Nötige, groß und klar', 'Only what you need, big and clear'); }
    { const h = $('#meins .mhead h2'), bk = $('#meins [data-act="meinsback"]'); if (h) h.textContent = tx('start.meins', null, T.meins[0], T.meins[1]); if (bk) bk.textContent = tx('start.back', null, '← Zurück', '← Back'); }
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
  ST.worlds = async function (ui) {
    ui = ui || ST.ui; ui.show('worlds');
    const list = await ST.listWorlds(), wl = $('#worldlist'); if (!wl) return;
    wl.innerHTML = '';
    if (!list.length) { wl.appendChild(el('div', 'note', esc(tx('start.noWorlds', null, 'Noch keine Welt — ＋ Neue Welt macht eine.', 'No world yet — ＋ New world makes one.')))); return; }
    const mode = (m) => (m === 'zen' ? tx('start.zen', null, 'Zen-Baumeister', 'Zen Builder') : m === 'creative' ? tx('start.creative', null, 'Kreativ', 'Creative') : tx('start.survival', null, 'Überleben', 'Survival'));
    for (const w of list) {
      const c = el('div', 'wcard'); c.dataset.id = w.id;
      c.innerHTML = `<div class="wtxt"><div class="wn"></div><div class="wm"></div></div><div class="wacts"></div>`;
      $('.wn', c).textContent = w.name || tx('start.world', null, 'Welt', 'World');
      $('.wm', c).textContent = mode(w.mode) + ' · Seed ' + (w.seed >>> 0) + (w.lastPlayed ? ' · ' + new Date(w.lastPlayed).toLocaleString(VR.I18N ? VR.I18N.locale() : undefined, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
      const acts = $('.wacts', c);
      for (const [k, de, en, cls] of [['play', '▶ Spielen', '▶ Play', 'primary'], ['bauen', '🏗 Bauen', '🏗 Build', ''], ['rename', '✎ Name', '✎ Name', ''], ['del', '🗑 Löschen', '🗑 Delete', 'danger']]) { const b = el('button', 'btn small ' + cls); b.dataset.act = 'w:' + k; b.dataset.w = k; b.dataset.id = w.id; b.textContent = tx('start.w.' + k, null, de, en); acts.appendChild(b); }
      wl.appendChild(c);
    }
  };
  async function worldAct(k, b) {
    const g = game(), id = b.dataset.id, w = (ST.worldsCache || []).find(x => x.id === id); if (!w) return;
    if (k === 'play') { g.loadWorld(w); return; }
    if (k === 'bauen') { try { location.href = 'studio.html' + (location.search || '') + '#world/' + encodeURIComponent(id) + '/karte'; } catch (e) { /* */ } return; }
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
      b.classList.add('arm'); b.dataset.armAt = String(Date.now()); b.textContent = tx('start.delSure', null, 'Sicher? Nochmal 🗑', 'Sure? Again 🗑');
      setTimeout(() => { if (b.isConnected && b.classList.contains('arm')) { b.classList.remove('arm'); b.textContent = tx('start.del', null, '🗑 Löschen', '🗑 Delete'); } }, 4000);
    }
  }

  // ---------------------------------------------------------------- the pause menu (Einfach: seven things; Profi adds the rest)
  function pauseMenu() {
    const panel = $('#pause .panel'); if (!panel || panel.dataset.w1) return;
    panel.dataset.w1 = '1';
    panel.innerHTML = `<h2 class="ptitle"></h2>
      <button class="btn primary" data-act="resume"></button>
      <button class="btn" data-act="bauenlive"></button>
      <button class="btn" data-act="meins"></button>
      <div id="mppanel" class="col gap"></div>
      <div class="row gap"><button class="btn" data-act="gohome" style="flex:1"></button><button class="btn" data-act="sethome" style="flex:1"></button></div>
      <div id="zenpanel" class="col gap"></div>
      <button class="btn studio pro" data-act="studiolive" id="studiolive"></button>
      <button class="btn pro" data-act="codex"></button>
      <button class="btn pro" data-act="photo"></button>
      <button class="btn" data-act="settings"></button>
      <button class="btn" data-act="quit"></button>
      <div class="row prorow"><div class="proswitch"><button class="lnk" data-act="pro" data-pro="0"></button><button class="lnk" data-act="pro" data-pro="1"></button></div></div>
      <div class="note" style="text-align:center" id="pausenote"></div>`;
    texts();
  }
  function pauseTexts() {
    const panel = $('#pause .panel'); if (!panel || !panel.dataset.w1) return;
    const t = (act, de, en, title) => { const b = $(`#pause [data-act="${act}"]`); if (!b) return; b.textContent = tx('pause.' + act, null, de, en); if (title) b.title = title; };
    $('#pause .ptitle').textContent = tx('pause.title', null, '⏸ Pause', '⏸ Paused');
    t('resume', '▶ Weiterspielen', '▶ Play on');
    t('bauenlive', '🏗 Bauen', '🏗 Build', tx('pause.bauenT', null, 'Häuser und Möbel auf die Karte setzen — das Spiel baut sie', 'Place houses and furniture on the map — the game builds them'));
    t('meins', '🎒 Meins', '🎒 Mine');
    t('gohome', '🏠 Zu meinem Platz', '🏠 To my spot');
    t('sethome', '📍 Mein Platz ist hier', '📍 My spot is here', tx('pause.sethomeT', null, 'Dein Platz ist, wo du jetzt stehst: 🏠 und ▶ Spielen aus dem Studio bringen dich hierher', 'Your spot is where you stand now: 🏠 and ▶ Play from the Studio bring you back here'));
    t('studiolive', '🧰 Werkbank · diese Welt', '🧰 Workbench · this world', tx('pause.studioliveT', null, 'Die Werkbank des R9 Studios auf dieser Welt — auswählen, füllen, kopieren, Häuser planen, umgestalten', 'The R9 Studio\'s workbench on this world — select, fill, copy, plan houses, restyle'));
    t('codex', '📖 Codex', '📖 Codex');
    t('photo', '📷 Fotomodus', '📷 Photo mode');
    t('settings', '⚙ Einstellungen', '⚙ Settings');
    t('quit', '⏏ Speichern & zum Start', '⏏ Save & to the start');
  }
  ST.pauseMenu = pauseMenu;

  // ---------------------------------------------------------------- the create form (Profi), in German
  function createForm() {
    const panel = $('#create .panel'); if (!panel) return;
    const seg = (id, items, on) => `<div class="seg" id="${id}">` + items.map(([v, de, en, sde, sen]) => `<button data-v="${v}"${v === on ? ' class="on"' : ''}>${esc(tx('start.cw.' + v, null, de, en))}${sde ? `<small>${esc(tx('start.cw.' + v + 'S', null, sde, sen))}</small>` : ''}</button>`).join('') + '</div>';
    panel.innerHTML = `<h2>${esc(tx('start.newWorldTitle', null, '＋ Neue Welt', '＋ New world'))}</h2>
      <div class="field"><label>${esc(tx('start.cw.name', null, 'Weltname', 'World name'))}</label><input type="text" id="cw_name" maxlength="40"></div>
      <div class="field"><label>${esc(tx('start.cw.mode', null, 'Spielart', 'Game mode'))}</label>${seg('cw_mode', [['survival', 'Überleben', 'Survival', 'Sammeln, bauen, überleben', 'Gather, craft, survive'], ['creative', 'Kreativ', 'Creative', 'Alle Blöcke, Fliegen', 'Unlimited blocks, flight'], ['zen', 'Zen-Baumeister', 'Zen Builder', 'In Ruhe: keine Monster, kein Schaden', 'Unbothered: no mobs, no damage']], 'zen')}</div>
      <div class="field"><label>${esc(tx('start.cw.diff', null, 'Schwierigkeit', 'Difficulty'))}</label>${seg('cw_diff', [['peaceful', 'Friedlich', 'Peaceful'], ['easy', 'Leicht', 'Easy'], ['normal', 'Normal', 'Normal'], ['hard', 'Schwer', 'Hard']], 'normal')}</div>
      <div class="field"><label>${esc(tx('start.cw.type', null, 'Welttyp', 'World type'))}</label>${seg('cw_type', [['default', 'Realm', 'Realm'], ['large', 'Große Biome', 'Large biomes'], ['amplified', 'Verstärkt', 'Amplified'], ['flat', 'Flach', 'Flat']], 'default')}</div>
      <div class="field"><label>${esc(tx('start.cw.seed', null, 'Seed (optional)', 'Seed (optional)'))}</label><input type="text" id="cw_seed" placeholder="${esc(tx('start.cw.seedP', null, 'Leer lassen für Zufall', 'Leave blank for random'))}"></div>
      <div class="row gap" style="flex-wrap:wrap">
        <label class="row gap note"><input type="checkbox" id="cw_cheats" checked> ${esc(tx('start.cw.cheats', null, 'Befehle', 'Commands'))}</label>
        <label class="row gap note"><input type="checkbox" id="cw_keep"> ${esc(tx('start.cw.keep', null, 'Inventar behalten', 'Keep inventory'))}</label>
        <label class="row gap note"><input type="checkbox" id="cw_kit" checked> ${esc(tx('start.cw.kit', null, 'Starter-Kit', 'Starter kit'))}</label>
      </div>
      <div class="hr"></div>
      <div class="row gap"><button class="btn primary" data-act="docreate">${esc(tx('start.cw.go', null, 'Welt erstellen', 'Create world'))}</button><button class="btn small" data-act="toworlds">${esc(tx('start.cw.cancel', null, 'Abbrechen', 'Cancel'))}</button></div>`;
    for (const id of ['cw_mode', 'cw_diff', 'cw_type']) $('#' + id).addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; for (const x of b.parentNode.children) x.classList.toggle('on', x === b); });
    for (const i of ['cw_name', 'cw_seed']) $('#' + i).addEventListener('keydown', (e) => e.stopPropagation());
  }

  // ---------------------------------------------------------------- the actions (before ui.js's own)
  ST.act = function (a, b, ui) {
    switch (a) {
      case 'tile': { const k = b && b.dataset.tile; if (k === 'play') ST.play(); else if (k === 'bauen') ST.bauen(); else if (k === 'erschaffen') ST.erschaffen(); else if (k === 'meins') ST.meins(ui.screen === 'pause' ? 'pause' : 'title'); return true; }
      case 'worlds': ST.worlds(ui); return true;
      case 'newworld': if (prefs().pro) { ui.show('create'); const n = $('#cw_name'); if (n) n.value = tx('start.newWorldName', null, 'Neue Welt', 'New World'); const s = $('#cw_seed'); if (s) s.value = ''; } else ST.newWorld(); return true;
      case 'bauenlive': { const g = game(); if (!g || !g.openStudio('karte')) ui.hint(tx('start.noStudioGuest', null, 'Das Studio öffnet nur deine eigenen Welten (nicht als Gast).', 'The Studio opens your own worlds (not as a guest).'), 2400); return true; }
      case 'meins': ST.meins(ui.screen === 'pause' ? 'pause' : 'title'); return true;
      case 'sethome': { const g = game(); if (g && g.setSpawnHere()) { ui.hint(tx('start.spawnSet', null, '📍 Dein Platz ist jetzt hier — 🏠 bringt dich zurück', '📍 Your spot is here now — 🏠 brings you back'), 2600); if (ui.chatLine) ui.chatLine(tx('start.spawnSetLine', null, '📍 Dein Platz ist jetzt hier.', '📍 Your spot is here now.'), '#9affd8'); } return true; }
      case 'meinsback': ui.show(ST.meinsFrom === 'pause' && game() && game().state === 'play' ? 'pause' : 'title'); return true;
      case 'pro': if (VR.UIPrefs) VR.UIPrefs.set({ pro: b.dataset.pro === '1' }); return true;
      case 'scale': if (VR.UIPrefs) VR.UIPrefs.set({ scale: prefs().scale >= 1.3 ? 1.15 : 1.3 }); return true;
      default:
        if (a && a.startsWith('w:')) { worldAct(a.slice(2), b); return true; }
        return false;
    }
  };
  // 🎒 Meins (filled in by meins.js's part of this file later): the screen with your things
  ST.meins = function (from) { const ui = ST.ui; if (!ui) return; ST.meinsFrom = from || 'title'; if (ST.renderMeins) ST.renderMeins(); ui.show('meins'); };

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
    if (!st.done.move) { if (now - hintState.standAt > 5000 && H.want('move')) H.show('move', touch() ? { text: tx('hint.moveTouch', null, '👆 ziehen = umschauen · 🕹 laufen', '👆 drag = look around · 🕹 walk'), picto: ['finger'] } : { text: tx('hint.move', null, '🖱 bewegen = umschauen · W A S D = gehen', '🖱 move = look around · W A S D = walk'), picto: ['mouse', 'W', 'A', 'S', 'D'] }); return; }
    if (!st.done.fly && p.mode !== 'survival' && H.want('fly')) H.show('fly', { text: tx('hint.fly', null, 'Leertaste 2× = fliegen', 'Space twice = fly'), picto: ['Space', 'Space'] });
  }
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
  UI.prototype.show = function (id) { origShow.call(this, id); if (id === 'title') ST.render(); };
  UI.prototype.showWorlds = function () { return ST.worlds(this); };
  const origPause = UI.prototype.pause;
  UI.prototype.pause = function () { if (this.game.state !== 'play') return; pauseMenu(); origPause.call(this); };
  // chat commands are a Profi thing (Einfach: the chat stays, a /command gets the note)
  if (VR.Game) {
    const origChat = VR.Game.prototype.chat;
    VR.Game.prototype.chat = function (text) {
      if (typeof text === 'string' && text.startsWith('/') && !prefs().pro) { this.ui.chatLine(tx('start.cmdPro', null, 'Befehle gibt es im Profi-Modus (Start · Profi).', 'Commands are a Profi thing (Start · Profi).'), '#ffd27a'); return; }
      return origChat.call(this, text);
    };
  }
  // the multiplayer box on the start screen: in Einfach only when there is a friend's world to join
  const origHosts = UI.prototype.renderHosts;
  if (origHosts) UI.prototype.renderHosts = function () { origHosts.call(this); const box = $('#mphosts'); if (box) box.classList.toggle('has', !!box.querySelector('.mphost')); };
})(VR);
