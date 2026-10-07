// ============================================================================
// R9 Studio · Crafter — build in the catalogue houses with every item of the
// game, and repaint / reshape furniture voxel by voxel. "Update ins Spiel"
// stores the result (VR.Custom, localStorage 'r9si.studio'); the game builds
// the house exactly like this in every town and draws the item like this
// everywhere. The grid grows upward while you build (no height limit here).
//
// House: left click breaks, right click places the hotbar item, middle click
// picks; drag orbits (Shift / middle drag pans), wheel zooms; F flies (WASD,
// Q/E or Space/C); R turns the next piece; 1–9 / Shift+wheel pick the slot;
// Ctrl+Z / Ctrl+Y undo / redo. Item: the same camera; left click uses the
// tool (paint, add, erase, fill, pick), right click adds, middle click picks.
// ============================================================================
(function () {
  'use strict';
  const C = window.__studioCore; if (!C) return;
  const { S, HOOK, $, $$ } = C;
  const R = VR.R, T = R.T, F = VR.F, VM = VR.VM, VX = VR.VX, PH = VR.PHYS, PL = VR.Place, CU = VR.Custom;
  const fmt = C.fmt;
  const firstModel = (re) => Object.keys(VM.MODELS).find(n => re.test(n)) || null;
  const CR = VR.Crafter = { on: false, kind: null, hot: ['vollton_white', 'panorama_black', 'door_glass_black', 'oak_herringbone', 'vollton_anthracite', 'vollton_coral', 'panorama_grid', firstModel(/sofa/), firstModel(/lamp|pendant/)], slot: 0, rot: 0, recent: [], undo: [], redo: [], keys: {}, hover: null, msg: '' };
  // the standalone Studio (its own artifact, its own storage): it saves here, 📦 Mitnehmen brings it into the game
  const SA = !!window.__R9_STANDALONE;
  const SAVE_TIP = 'Gespeichert in diesem Studio — 📦 Mitnehmen bringt es ins Spiel';
  const PJ = () => VR.Projects;
  const store = () => CU.load() || { v: 1, houses: {}, models: {} };
  // the designs the game reads come first: when the browser's storage is full, project pictures make room
  const saveStore = (d) => { let ok = CU.save(d); if (!ok && PJ() && PJ().freeSpace && PJ().freeSpace()) ok = CU.save(d); if (ok) C.post({ type: 'custom', custom: d }); else C.full('designs'); return ok; };

  // ---------------------------------------------------------------- icons from the game's textures
  let icons = null;
  const iconOf = (id) => { if (!icons) { const t = C.texInfo(); if (!t || !VR.Icons) return null; icons = new VR.Icons(t); } try { return icons.get(id); } catch (e) { return null; } };
  const nameOf = (id) => { const t = R.byName[id]; return t ? (t.display || id) : (VR.ITEMS && VR.ITEMS[id] ? VR.ITEMS[id].name || id : id); };

  // ---------------------------------------------------------------- the palette: every placeable item
  const PCATS = [['all', 'Alle'], ['fav', '★ Favoriten'], ['recent', 'Zuletzt'], ['modern', 'Modern & Vollton'], ['build', 'Bauen'], ['arch', 'Voxel Homes'], ['vtech', 'Möbel & Technik'], ['vlife', 'Leben'], ['vshop', 'Markt'], ['nature', 'Natur'], ['func', 'Funktion'], ['volt', 'Mechanik'], ['tech', 'Starforge']];
  PCATS.splice(4, 0, ['vmodern', '✨ Modern Living']);   // the Modern Living pack (voxmodern.js)
  let itemsByCat = null, itemSet = null;
  const FV = () => VR.Favs;
  // ★ favourites that can be placed here (the same list as in Teile, the Werkbank, the World and the game)
  const favItems = () => { if (!itemsByCat) buildItems(); return FV() ? FV().list().filter(id => itemSet.has(id)) : []; };
  function buildItems() {
    itemsByCat = { all: [] };
    for (const t of R.types) {
      if (!t.cat || t.o.noItem || t.o.cutOf || t.name === 'air') continue;
      if (t.o.kind === 'model' && t.has && t.has('part') && !VM.MODELS[t.name] && !(VX.spec && VX.spec(t.defaultState))) continue;
      let c = t.cat; if (t.group && /Starforge|Realm/.test(t.group) && t.group.indexOf('Starforge') >= 0) c = 'tech'; if (c === 'creative') c = 'func';
      (itemsByCat[c] || (itemsByCat[c] = [])).push(t.name); itemsByCat.all.push(t.name);
    }
    itemSet = new Set(itemsByCat.all);
  }
  function paletteList() {
    if (!itemsByCat) buildItems();
    const q = (S.filter || '').trim();
    let arr = S.cat === 'recent' ? CR.recent.slice() : S.cat === 'fav' ? favItems() : (itemsByCat[S.cat] || itemsByCat.all);
    if (q) { const qq = q.replace(/ /g, '_'), CATL = VR.StudioCatalog; arr = CATL && CATL.search ? CATL.search(itemsByCat.all, q) : itemsByCat.all.filter(id => id.indexOf(qq) >= 0 || nameOf(id).toLowerCase().indexOf(q) >= 0); }
    return arr.slice(0, 900);
  }
  HOOK.chips = function () {
    if (S.mode !== 'craft') return false;
    const el = $('#chips'); el.innerHTML = '';
    if (CR.kind === 'item') return true;
    if (!itemsByCat) buildItems();
    for (const [id, label] of PCATS) {
      const n = id === 'recent' ? CR.recent.length : id === 'fav' ? favItems().length : (itemsByCat[id] || []).length; if (!n && id !== 'recent' && id !== 'all' && id !== 'fav') continue;
      const b = document.createElement('button'); b.className = S.cat === id ? 'on' : ''; b.innerHTML = label + '<b>' + n + '</b>'; b.dataset.pcat = id;
      b.onclick = () => { S.cat = id; HOOK.chips(); C.list(); }; el.appendChild(b);
    }
    return true;
  };
  HOOK.list = function () {
    if (S.mode !== 'craft') return false;
    const el = $('#list'); el.innerHTML = ''; el.classList.remove('houses'); el.classList.add('palette');
    if (CR.kind === 'item') { itemTools(el); return true; }
    const arr = paletteList();
    let k = 0;
    for (const id of arr) {
      const d = document.createElement('div'); d.className = 'tile' + (CR.hot[CR.slot] === id ? ' on' : ''); d.dataset.id = id; d.title = nameOf(id) + '\n' + id;
      d.style.animationDelay = Math.min(k++, 40) * 8 + 'ms';
      const cv = document.createElement('canvas'); cv.width = cv.height = 48; d.appendChild(cv);
      d.onclick = () => { CR.hot[CR.slot] = id; useRecent(id); drawBar(); for (const x of $$('#list .tile')) x.classList.toggle('on', x.dataset.id === id); C.hud(); };
      // ☆ on the tile (hover; always there on touch) or a right click: a favourite, the same everywhere
      if (FV()) {
        const fb = document.createElement('button'); const on = FV().has(id); fb.className = 'favb sm' + (on ? ' on' : ''); fb.textContent = on ? '★' : '☆'; fb.title = on ? 'Aus den Favoriten nehmen' : 'Zu den Favoriten (Rechtsklick geht auch)';
        const tog = (ev) => { ev.stopPropagation(); ev.preventDefault(); const now = FV().toggle(id); fb.classList.toggle('on', now); fb.textContent = now ? '★' : '☆'; if (FV().ok === false) C.sys('⚠ ' + nameOf(id) + ' — ' + L('fav.unsaved', 'nur bis zum Schließen: Browser-Speicher voll'), 'err'); else C.sys((now ? '★ ' : '☆ ') + nameOf(id) + (now ? ' — bei den Favoriten' : ' — nicht mehr bei den Favoriten'), 'ok'); HOOK.chips(); if (S.cat === 'fav') C.list(); };
        fb.onclick = tog; d.oncontextmenu = tog; d.appendChild(fb);
      }
      el.appendChild(d); queueIcon(cv, id);
    }
    if (!arr.length) { const d = document.createElement('div'); d.className = 'grp'; d.textContent = S.cat === 'recent' ? 'Noch nichts benutzt.' : S.cat === 'fav' ? (SA ? 'Noch keine Favoriten — ☆ auf einer Kachel (oder Rechtsklick) legt sie hierher. Sie gelten überall im Studio — 📦 Mitnehmen bringt sie ins Spiel.' : 'Noch keine Favoriten — ☆ auf einer Kachel (oder Rechtsklick) legt sie hierher. Sie gelten überall: Teile, Werkbank, Welt, Spiel.') : 'nichts gefunden'; el.appendChild(d); }
    return true;
  };
  // ★ changed elsewhere (Teile, the World, the game in another tab): the palette follows
  if (FV()) FV().on(() => { if (S.mode === 'craft' && CR.kind !== 'item') { HOOK.chips(); if (S.cat === 'fav') C.list(); } });
  // icons paint a few per frame (hundreds of tiles)
  const iconQ = [];
  function queueIcon(cv, id) { iconQ.push([cv, id]); }
  function pumpIcons() {
    let n = 0;
    while (iconQ.length && n < 24) { const [cv, id] = iconQ[0]; if (!cv.isConnected) { iconQ.shift(); continue; } const ic = iconOf(id); if (!ic && !C.texInfo()) break; iconQ.shift(); if (ic) { const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.clearRect(0, 0, 48, 48); x.drawImage(ic, 0, 0, 48, 48); } n++; }
    requestAnimationFrame(pumpIcons);
  }
  pumpIcons();
  const useRecent = (id) => { CR.recent = [id].concat(CR.recent.filter(x => x !== id)).slice(0, 40); };

  // ---------------------------------------------------------------- words: short, translatable (VR.I18N), German as the fallback
  const IC = (n, sz, cls) => (window.__studioIcons ? window.__studioIcons.svg(n, sz, cls) : '');
  const L = (k, de, v) => (VR.I18N && VR.I18N.t ? VR.I18N.t(k, v, de) : String(de).replace(/\{(\w+)\}/g, (m, x) => (v && v[x] !== undefined ? v[x] : m)));
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  CR.L = L; CR.IC = IC;

  // ---------------------------------------------------------------- the hotbar, the tool strip, the mouse legend, the paint badge, the help card
  CR.tool = 'build'; CR.scope = 'face';
  const HTOOLS = [['build', 'hammer', 'cr.tool.build', 'Bauen', 'Esc'], ['paint', 'brush', 'cr.tool.paint', 'Malen', 'T'], ['area', 'area', 'cr.tool.area', 'Bereich', 'B']];
  const SCOPES = [['one', 'cr.scope.one', '1 Teil'], ['face', 'cr.scope.face', 'Fläche'], ['all', 'cr.scope.all', 'Alle']];
  function ensureOverlay() {
    if ($('#craftBar')) return;
    const main = $('main');
    const mk = (id, tag) => { const e = document.createElement(tag || 'div'); e.id = id; main.appendChild(e); return e; };
    mk('craftBar'); mk('craftTip'); mk('craftTools'); mk('craftLegend'); mk('paintBadge'); mk('craftCard');
    $('#craftCard').onclick = () => showCard(false);
  }
  function drawBar() {
    const bar = $('#craftBar'); if (!bar) return;
    bar.classList.toggle('on', CR.on && CR.kind === 'house');
    if (!(CR.on && CR.kind === 'house')) return;
    bar.innerHTML = '';
    CR.hot.forEach((id, i) => {
      const s = document.createElement('div'); s.className = 'slot' + (i === CR.slot ? ' on' : ''); s.title = id ? nameOf(id) : 'leer';
      const cv = document.createElement('canvas'); cv.width = cv.height = 40; s.appendChild(cv);
      const k = document.createElement('i'); k.textContent = i + 1; s.appendChild(k);
      s.onclick = () => { CR.slot = i; drawBar(); C.hud(); };
      bar.appendChild(s);
      if (id) { const ic = iconOf(id); if (ic) { const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(ic, 0, 0, 40, 40); } }
    });
    const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = CR.hot[CR.slot] ? nameOf(CR.hot[CR.slot]) + (CR.rot ? '  ·  ↻' + CR.rot * 90 + '°' : '') : '—'; bar.appendChild(nm);
    // R without a keyboard: turn the next piece (doors, stairs, furniture)
    const rb = document.createElement('button'); rb.className = 'rotb'; rb.textContent = '↻'; rb.title = L('cr.rot', 'Nächstes Teil drehen') + ' (R)';
    rb.onclick = (e) => { e.stopPropagation(); turnNext(); }; bar.appendChild(rb);
    // the backpack: your hotbar from the game
    if (CR.player && CR.player.gameHotbar && !SA) {      // (the standalone Studio cannot see the game's worlds)
      const bp = document.createElement('button'); bp.className = 'pack'; bp.innerHTML = IC('backpack', 22); bp.title = L('cr.pack', 'Hotbar aus dem Spiel holen (zuletzt gespielte Welt)');
      bp.onclick = (e) => { e.stopPropagation(); CR.player.gameHotbar(); }; bar.insertBefore(bp, bar.firstChild);
    }
  }
  // the tool strip at the left edge of the view: big icons, one word, the key
  function drawTools() {
    const el = $('#craftTools'); if (!el) return;
    const on = CR.on && CR.kind === 'house';
    el.classList.toggle('on', on);
    if (!on) { el.innerHTML = ''; return; }
    const pm = CR.player && CR.player.on;
    const b = (cls, icon, label, key, title, fn) => `<button class="${cls}" title="${title}" data-fn="${fn}">${IC(icon, 26)}<span>${label}</span><kbd>${key}</kbd></button>`;
    let h = '';
    for (const [id, icon, k, de, key] of HTOOLS) {
      h += b('tool' + (CR.tool === id ? ' on' : ''), icon, L(k, de), key, L(k + '.tip', de), 'tool:' + id);
      if (id === 'paint' && CR.tool === 'paint') {
        h += '<div class="sub">' + SCOPES.map(([sid, sk, sde], i) => `<button class="scope${CR.scope === sid ? ' on' : ''}" data-fn="scope:${sid}" title="${L(sk + '.tip', sde)}">${IC(sid, 22)}<span>${L(sk, sde)}</span>${i === 0 ? '<kbd>Tab</kbd>' : ''}</button>`).join('') + '</div>';
      }
      if (id === 'area' && CR.tool === 'area') {
        const A = [['fill', 'fill', 'F', 'cr.area.fill', 'Füllen'], ['walls', 'walls', 'G', 'cr.area.walls', 'Wände'], ['hollow', 'hollow', 'H', 'cr.area.hollow', 'Hohl'], ['clear', 'eraser', 'X', 'cr.area.clear', 'Leeren'], ['up', 'plus', '+', 'cr.area.up', 'Höher'], ['down', 'minus', '−', 'cr.area.down', 'Niedriger']];
        h += '<div class="sub">' + A.map(([fid, icon, key, k, de]) => `<button class="scope" data-fn="area:${fid}" title="${L(k, de)} (${key})">${IC(icon, 22)}<span>${L(k, de)}</span><kbd>${key}</kbd></button>`).join('') + '</div>';
      }
    }
    h += '<i class="sep"></i>';
    h += b('tool' + (pm ? ' on' : ''), pm ? 'camera' : 'walk', pm ? L('cr.tool.cam', 'Kamera') : L('cr.tool.player', 'Spieler'), 'P', pm ? L('cr.tool.cam.tip', 'Zurück zur Studio-Kamera') : L('cr.tool.player.tip', 'Als Spieler bauen: gehen, springen, fliegen wie im Spiel'), 'player');
    h += b('tool', 'help', L('cr.tool.help', 'Hilfe'), '?', L('cr.tool.help.tip', 'Was macht was?'), 'help');
    el.innerHTML = h;
    for (const x of el.querySelectorAll('button')) x.onclick = (e) => { e.stopPropagation(); toolAction(x.dataset.fn); };
  }
  function toolAction(fn) {
    const [a, v] = fn.split(':');
    if (a === 'tool') setTool(v);
    else if (a === 'scope') { CR.scope = v; pvKey = ''; drawTools(); drawLegend(); }
    else if (a === 'area') { if (v === 'up' || v === 'down') { if (CR.area && CR.area.a) { CR.area.dy = (CR.area.dy || 0) + (v === 'up' ? 1 : -1); C.parts(); } } else areaApply(v); }
    else if (a === 'player') { if (CR.player) CR.player.toggle(); }
    else if (a === 'help') showCard();
  }
  function setTool(t) {
    if (CR.kind !== 'house') return;
    if (t === CR.tool && t !== 'build') t = 'build';           // a second press puts the tool away
    CR.tool = t;
    if ((t === 'area') !== !!CR.areaMode) areaMode(t === 'area', true);
    pvKey = ''; hold = null;
    drawTools(); drawLegend(); C.parts();
    const n = HTOOLS.find(x => x[0] === t);
    tip(L(n[2], n[3]), true);
  }
  // the mouse legend: what the buttons and the wheel do right now — pictures, one word each
  const MOUSE = (l, r, m) => `<svg class="mouse" viewBox="0 0 48 70" width="44" height="64"><rect x="3" y="3" width="42" height="64" rx="21" fill="rgba(10,15,22,.85)" stroke="currentColor" stroke-width="2"/><path d="M3 30h42M24 3v27" stroke="currentColor" stroke-width="2"/><rect x="20.5" y="11" width="7" height="12" rx="3.5" fill="${m ? 'var(--acc2)' : 'currentColor'}" opacity="${m ? 0.95 : 0.5}"/><foreignObject x="5" y="8" width="17" height="17"><div class="mi">${IC(l, 15)}</div></foreignObject><foreignObject x="27" y="8" width="17" height="17"><div class="mi">${IC(r, 15)}</div></foreignObject></svg>`;
  function drawLegend() {
    const el = $('#craftLegend'); if (!el) return;
    el.classList.toggle('on', CR.on);
    if (!CR.on) { el.innerHTML = ''; return; }
    const pm = CR.player && CR.player.on;
    let rows;
    if (CR.kind === 'item') rows = [['brush', L('cr.m.tool', 'Werkzeug')], ['plus', L('cr.m.add', 'Voxel setzen')], ['pipette', L('cr.m.pick', 'Farbe nehmen')]];
    else if (CR.tool === 'paint') rows = [['brush', L('cr.m.paint', 'malen')], ['pipette', L('cr.m.take', 'Farbe nehmen')], ['pipette', L('cr.m.take', 'Farbe nehmen')]];
    else if (CR.tool === 'area') rows = [['area', L('cr.m.cornerA', 'Ecke 1')], ['area', L('cr.m.cornerB', 'Ecke 2')], ['pipette', L('cr.m.take', 'Farbe nehmen')]];
    else rows = [['pick', L('cr.m.break', 'abbauen')], ['cube', pm ? L('cr.m.placeUse', 'setzen · Tür · sitzen') : L('cr.m.place', 'setzen')], ['pipette', L('cr.m.take', 'Farbe nehmen')]];
    let h = MOUSE(rows[0][0], rows[1][0], true) + '<div class="rows">'
      + `<div><b class="k">L</b>${IC(rows[0][0], 16)}<span>${rows[0][1]}</span></div>`
      + `<div><b class="k">R</b>${IC(rows[1][0], 16)}<span>${rows[1][1]}</span></div>`
      + `<div><b class="k">${IC('pipette', 12)}</b>${IC(rows[2][0], 16)}<span>${L('cr.m.middle', 'Mitte')}: ${rows[2][1]}</span></div>`
      + (CR.kind === 'house' ? `<div><b class="k">⇵</b><span>${pm ? L('cr.m.slots', 'Rad: Hotbar 1–9') : L('cr.m.zoom', 'Rad: Zoom · 1–9 Hotbar')}</span></div>` : '')
      + '</div>';
    if (pm) h += `<div class="keys"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>${L('cr.k.walk', 'gehen')}</span><kbd class="w">␣</kbd><span>${L('cr.k.jump', 'springen · 2× fliegen')}</span><kbd>⇧</kbd><span>${L('cr.k.sneak', 'schleichen')}</span><kbd>E</kbd><span>${L('cr.k.mouse', 'Maus frei')}</span><i id="pmState"></i></div>`;
    el.innerHTML = h;
  }
  function drawHelp() { drawTools(); drawLegend(); }
  // the help card: every tool as a picture with one line
  function showCard(on) {
    const el = $('#craftCard'); if (!el) return;
    on = on === undefined ? !el.classList.contains('on') : on;
    el.classList.toggle('on', on);
    if (!on) return;
    const row = (icon, title, text) => `<div class="cc">${IC(icon, 30)}<div><b>${title}</b><span>${text}</span></div></div>`;
    el.innerHTML = `<div class="card"><h3>${IC('help', 20)} ${L('cr.card.title', 'So geht’s')}</h3>`
      + row('hammer', L('cr.tool.build', 'Bauen'), L('cr.card.build', 'Links abbauen · Rechts setzen · Mitte: Block aufnehmen'))
      + row('brush', L('cr.tool.paint', 'Malen'), L('cr.card.paint', 'Wähle unten einen Block, zeig auf eine Wand oder ein Fenster: was leuchtet, wird neu. Klein = Klick, groß = gedrückt halten.'))
      + row('face', L('cr.scope.face', 'Fläche'), L('cr.card.face', '1 Teil · eine ganze Fläche · alles dieser Art im Haus'))
      + row('area', L('cr.tool.area', 'Bereich'), L('cr.card.area', 'Zwei Ecken setzen, dann füllen, Wände, hohl oder leeren'))
      + row('walk', L('cr.tool.player', 'Spieler'), L('cr.card.player', 'Herumlaufen und bauen wie im Spiel: Rechtsklick öffnet Türen und setzt dich auf Stühle und Sofas, Schiebetüren gehen von selbst auf, rund ums Grundstück ist Wiese'))
      + row('undo', L('cr.undo', 'Zurück'), L('cr.card.undo', 'Strg+Z nimmt alles zurück — auch große Änderungen'))
      + (SA ? row('save', L('cr.saveSA', '💾 Speichern'), L('cr.card.saveSA', 'Hier gespeichert — 📦 Mitnehmen bringt es ins Spiel')) : row('upload', L('cr.save', 'Ins Spiel'), L('cr.card.save2', 'Neue Städte bauen dein Haus genau so — schon stehende bleiben, wie sie sind')))
      + `<p class="dim">${L('cr.card.close', 'Klick zum Schließen')}</p></div>`;
  }
  function tip(text, ok) { const t = $('#craftTip'); if (!t) return; t.innerHTML = (ok === false ? IC('close', 16) : ok ? IC('check', 16) : '') + '<span></span>'; t.lastChild.textContent = text; t.className = 'on' + (ok === false ? ' err' : ok ? ' ok' : ''); clearTimeout(tip.t); tip.t = setTimeout(() => { t.className = ''; }, 2600); }

  // ---------------------------------------------------------------- entering / leaving
  HOOK.enter = function () {
    // 🕘 Weitermachen (or ⚒ / 🎨 / ✏️ elsewhere) asked for something particular; then: what to do once it is open
    if (CR.want) {
      const w = CR.want; CR.want = null;
      const p = w.kind === 'item' ? openItem(w.name) : openHouse(w.idx);
      if (w.then) Promise.resolve(p).then(() => { if (S.mode === 'craft' && (w.kind === 'item' ? CR.item && CR.item.name === w.name : CR.house && CR.house.index === w.idx)) w.then(); }).catch((e) => console.warn('Crafter: want', e));
      return p;
    }
    const sc = S.scene;
    if (sc && (sc.type === 'model' || sc.type === 'vedit')) return openItem(sc.name);
    const idx = sc && (sc.type === 'house' || sc.type === 'craft') ? sc.index : (S.pendingHouse || 0);
    return openHouse(idx);
  };
  HOOK.leave = function () {
    if (!CR.on) return;
    keepWork(true);           // the draft, the view and a picture — while the house is still on the GPU
    const kind = CR.kind, idx = CR.house && CR.house.index, name = CR.item && CR.item.name;
    if (CR.gpu) { C.freeSections([...CR.gpu.values()]); CR.gpu = null; }
    CR.on = false; CR.kind = null; CR.house = null; CR.item = null; CR.hover = null; S.cam.fly = null; CR.tool = 'build'; CR.areaMode = false; pvKey = ''; hold = null; setPreview(null);
    drawBar(); drawHelp(); showCard(false); $('#studio').classList.remove('crafting');
    // the mode switch that called us selects what comes next; remember what was open so it can go back to it
    CR.last = { kind, idx, name };
    CR.origin = null; C.crumb();
  };
  // ---------------------------------------------------------------- where the Crafter was opened from (← back there)
  // {mode, …the selection there}: Architektur and its house, Möbel / Fassade and the model (and its "← zurück zu"),
  // Teile and its block (or the favourite shown there), Welt and its tab
  const MODE_NAME = { arch: 'Architektur', furn: 'Möbel', facade: 'Fassade', parts: 'Teile', world: 'Welt' };
  function originNow() {
    const m = S.mode, sc = S.scene, CATL = VR.StudioCatalog, WM = VR.StudioWorld;
    if (!MODE_NAME[m]) return null;
    const o = { mode: m, cat: S.cat };
    if (m === 'arch') o.index = sc && sc.type === 'house' ? sc.index : null;
    else if (m === 'furn' || m === 'facade') { o.name = sc && sc.type === 'model' ? sc.name : null; o.from = S.from || null; }
    else if (m === 'parts') { o.scene = sc ? sc.type : null; o.id = sc && sc.type === 'block' ? sc.name : CATL ? CATL.sel : null; o.name = sc && sc.type === 'model' ? sc.name : null; o.index = sc && sc.type === 'house' ? sc.index : null; o.from = S.from || null; }
    else if (m === 'world') { o.tab = WM ? WM.tab : null; o.world = WM && WM.world ? WM.world.name : ''; }
    return o;
  }
  function originLabel(o) {
    const H = (i) => { const h = C.HOUSES.find(x => x.i === i); return h ? h.name : ''; };
    const nm = o.mode === 'arch' ? (Number.isFinite(o.index) ? H(o.index) : '') : (o.mode === 'furn' || o.mode === 'facade') ? (o.name && VM.MODELS[o.name] ? VM.MODELS[o.name].display : '')
      : o.mode === 'parts' ? (o.scene === 'model' && o.name ? (VM.MODELS[o.name] || {}).display || '' : o.scene === 'house' ? H(o.index) : o.id ? nameOf(o.id) : '') : o.mode === 'world' ? o.world || '' : '';
    return '← ' + L('mode.' + o.mode, MODE_NAME[o.mode]) + (nm ? ' · ' + nm : '');
  }
  // ✕ and "← <Herkunft>": back there, with the same selection
  CR.back = function () {
    const o = CR.origin, wasItem = CR.kind === 'item' && CR.item ? CR.item.name : null; CR.origin = null;
    if (!o) { C.setMode(wasItem ? (C.isFacade(wasItem) ? 'facade' : 'furn') : 'arch'); return; }
    const CATL = VR.StudioCatalog, WM = VR.StudioWorld;
    const cat = () => { if (o.cat && o.cat !== S.cat) { S.cat = o.cat; C.chips(); C.list(); } };
    if (o.mode === 'arch') { C.setMode('arch', true); cat(); C.selectHouse(Number.isFinite(o.index) ? o.index : (CR.last && Number.isFinite(CR.last.idx) ? CR.last.idx : 0)); }
    else if (o.mode === 'furn' || o.mode === 'facade') { C.setMode(o.mode, true); cat(); const n = o.name && VM.MODELS[o.name] ? o.name : wasItem; if (n) C.selectModel(n, o.from || null); }
    else if (o.mode === 'parts') {
      if (CATL) { CATL.cat = o.cat || CATL.cat; if (o.id) CATL.sel = o.id; CATL.restore = o.scene === 'model' && o.name ? () => C.selectModel(o.name, o.from || null) : o.scene === 'house' && Number.isFinite(o.index) ? () => C.selectHouse(o.index) : null; CATL.openFrom = o.from || null; }
      C.setMode('parts');
    } else if (o.mode === 'world') { if (WM && o.tab) WM.tab = o.tab; C.setMode('world'); }
    else C.setMode('arch');
  };
  HOOK.crumb = function (el) {
    if (!CR.on || !CR.origin) return false;
    const b = document.createElement('button'); b.className = 'back'; b.textContent = originLabel(CR.origin); b.title = L('cr.backT', 'Zurück, wo du warst');
    b.onclick = () => CR.back(); el.appendChild(b);
    return true;
  };
  function enterUI(kind) {
    ensureOverlay();
    if (S.mode !== 'craft') CR.origin = originNow();          // opened from another mode: the way back
    S.mode = 'craft'; S.cat = kind === 'house' ? 'modern' : 'all'; CR.on = true; CR.kind = kind; CR.undo = []; CR.redo = []; CR.hover = null;
    $('#studio').classList.add('crafting');
    for (const b of $$('nav.modes button')) b.classList.toggle('on', b.dataset.mode === 'craft');
    for (const t of $$('.tab')) t.classList.toggle('on', t.dataset.pane === 'parts');
    for (const p of $$('.pane')) p.classList.toggle('on', p.id === 'parts');
    C.chips(); C.list(); drawBar(); drawHelp(); C.crumb();
  }

  // ================================================================ HOUSE CRAFTER
  // opt.fresh: without the draft (🗑 / "Spielversion laden")
  async function openHouse(index, opt) {
    endPlayer(); keepWork(true);          // whatever was open keeps its unsaved work
    const H = C.HOUSES.find(h => h.i === index) || C.HOUSES[0];
    const rec = C.HOUSE.get(H.i);
    const saved = store().houses[H.i];
    // unsaved work from last time comes back as it was (the game still has the saved design)
    const P = PJ(), id = 'h:' + H.i, dr = !(opt && opt.fresh) && P ? P.data(id) : null, draft = dr && dr.tpl ? dr : null;
    const src = draft || saved;
    const skin = src ? src.skin : rec ? rec.data.skin : undefined, mirror = src ? !!src.mirror : rec ? !!rec.data.mirrored : false;
    enterUI('house'); CR.item = null;
    C.sys('Crafter: ' + H.name + ' wird geöffnet …');
    const m = await C.call({ type: 'craft_open', index: H.i, seed: src ? src.seed || 7 : 7, beds: src ? src.beds || 3 : 3, skin, mirror, edit: src || null });
    if (m.type !== 'craft_open') { console.error(m.msg); C.sys('Crafter-Fehler', 'err'); return; }
    if (S.mode !== 'craft') return;
    if (CR.gpu) C.freeSections([...CR.gpu.values()]);
    CR.house = { index: H.i, name: H.name, sx: m.dims[0], sy: m.dims[1], sz: m.dims[2], F: m.floorY, pad: m.pad, lot: m.lot, rect: m.house, storeys: m.storeys, storeyH: m.storeyH, roofTop: m.roofTop, skin: m.skin, mirror: m.mirrored, blocks: m.blocks, base: m.base, wrote: m.wrote, savedAt: saved ? saved.t : 0, dirty: !!draft };
    CR.area = null; CR.ver = (CR.ver || 0) + 1;
    CR.gpu = new Map();
    for (const g of C.uploadSections(m.sections)) CR.gpu.set(g.ox + ',' + g.oy + ',' + g.oz, g);
    const [hx, hz, hw, hd] = m.house;
    const sc = { type: 'craft', index: H.i, name: H.name, gpu: [...CR.gpu.values()], off: [0, 0, 0], center: [hx + hw / 2, m.floorY + (m.roofTop - m.floorY) * 0.4, hz + hd / 2], span: Math.max(hw, hd, m.roofTop - m.floorY) * 1.15, groundY: m.floorY,
      data: { storeys: m.storeys, floorY: m.floorY, storeyH: m.storeyH, skins: [], skin: m.skin, mirrored: m.mirrored } };
    C.setScene(sc);
    S.cam.yaw = 0.72; S.cam.pitch = 0.5;
    // the camera, the floor cut, the tool and the hotbar as you left them
    const pj = P && P.get(id);
    if (pj && pj.view && !(opt && opt.fresh)) restoreView(pj.view, sc);
    if (draft && draft.undo) CR.undo = unpackUndo(draft.undo);      // Strg+Z goes on where it stopped
    C.hud(); C.parts(); drawBar(); drawHelp();
    if (draft) {
      C.sys(`Crafter · ${H.name} · ✎ ${SA ? L('cr.draftSysSA', 'Entwurf: {n} Änderungen, noch nicht gespeichert', { n: fmt(draft.n || 0) }) : L('cr.draftSys', 'Entwurf: {n} Änderungen, noch nicht im Spiel', { n: fmt(draft.n || 0) })}`, 'ok');
      tip((SA ? L('cr.resumedSA', 'Weiter, wo du warst — {n} Änderungen, noch nicht gespeichert', { n: fmt(draft.n || 0) }) : L('cr.resumed', 'Weiter, wo du warst — {n} Änderungen, noch nicht im Spiel', { n: fmt(draft.n || 0) })) + (pj && pj.view && pj.view.player ? ' · P: ' + L('cr.asPlayer', 'als Spieler weiter') : ''), true);
    } else C.sys(`Crafter · ${H.name} · ${m.applied ? fmt(m.applied) + ' eigene Änderungen geladen' : 'Original'}`, 'ok');
    if (pj) P.seen(id);
    loadMeadow(sc);
  }
  // the meadow around the lot: the house stands in a garden, and the player can walk off the property (a fence
  // marks the garden's end); meshed once per lot size, drawn as an instance moved to the grid's −M corner
  const MEADOW = CR.MEADOW = 40;
  async function loadMeadow(sc) {
    const h = CR.house; if (!h) return;
    const key = h.sx + 'x' + h.sz + '@' + h.F;
    if (!CR.meadow || CR.meadow.key !== key) {
      const m = await C.call({ type: 'craft_meadow', sx: h.sx, sz: h.sz, F: h.F, M: MEADOW });
      if (m.type !== 'craft_meadow') return;
      if (!CR.meadow || CR.meadow.key !== key) { if (CR.meadow) C.freeSections(CR.meadow.gpu); CR.meadow = { key, gpu: C.uploadSections(m.sections), M: m.M }; }
    }
    if (S.scene === sc) sc.instances = [{ gpu: CR.meadow.gpu, pre: [0, 0, 0], rc: [1, 0], t: [-CR.meadow.M, 0, -CR.meadow.M], mul: [1, 1, 1] }];
  }
  const gIdx = (x, y, z) => { const h = CR.house; return (y * h.sz + z) * h.sx + x; };
  const gGet = (x, y, z) => { const h = CR.house; if (!h || x < 0 || y < 0 || z < 0 || x >= h.sx || y >= h.sy || z >= h.sz) return 0; return h.blocks[gIdx(x, y, z)]; };
  // what can be edited: the lot and the ring around it the house itself builds on (front steps, portico, bay windows)
  const EDGE = 4;
  const inLot = (x, z) => { const h = CR.house, m = Math.min(EDGE, h.pad - 1); return x >= h.pad - m && z >= h.pad - m && x < h.pad + h.lot[0] + m && z < h.pad + h.lot[1] + m; };
  function gGrow(top) {
    const h = CR.house; if (top < h.sy - 2) return;
    const ny = Math.ceil((top + 18) / 16) * 16, n = h.sx * ny * h.sz;
    const b = new Uint16Array(n), bb = new Uint16Array(n), bw = new Uint8Array(n); b.set(h.blocks); bb.set(h.base); if (h.wrote) bw.set(h.wrote); h.blocks = b; h.base = bb; h.wrote = bw; h.sy = ny;
  }
  // apply a list of [x, y, z, state] to the grid, remember the old states for undo, re-mesh in the worker
  // play: a door opened or closed while walking around — no undo step, the design stays unchanged (doors are saved
  // the way the house came with them)
  function applyChanges(list, undoable, play) {
    const h = CR.house; if (!h || !list.length) return;
    let top = 0; for (const c of list) top = Math.max(top, c[1]);
    gGrow(top);
    const rec = [], flat = new Int32Array(list.length * 4);
    list.forEach((c, k) => { const i = gIdx(c[0], c[1], c[2]); rec.push([c[0], c[1], c[2], h.blocks[i], c[3]]); h.blocks[i] = c[3]; flat.set(c, k * 4); });
    if (undoable !== false) { CR.undo.push(rec); if (CR.undo.length > 300) CR.undo.shift(); CR.redo = []; }
    if (!play) { h.dirty = true; draftSoon(); }
    CR.ver = (CR.ver || 0) + 1;
    remesh(flat);
    C.hud(); if (!play) C.parts();
  }
  let meshBusy = false, meshQ = [];
  async function remesh(flat) {
    meshQ.push(flat);
    if (meshBusy) return;
    meshBusy = true;
    while (meshQ.length) {
      const all = meshQ.splice(0); let n = 0; for (const a of all) n += a.length;
      const changes = new Int32Array(n); let o = 0; for (const a of all) { changes.set(a, o); o += a.length; }
      const m = await C.call({ type: 'craft_edit', changes }, [changes.buffer]);
      if (m.type !== 'craft_edit' || !CR.gpu) break;
      for (const sc of m.sections) {
        const k = sc.ox + ',' + sc.oy + ',' + sc.oz, old = CR.gpu.get(k);
        if (old) { C.freeSections([old]); CR.gpu.delete(k); }
        if (!sc.empty) { const g = C.uploadSections([sc])[0]; CR.gpu.set(k, g); }
      }
      if (S.scene && S.scene.type === 'craft') S.scene.gpu = [...CR.gpu.values()];
    }
    meshBusy = false;
  }
  function undo(redo) {
    const from = redo ? CR.redo : CR.undo, to = redo ? CR.undo : CR.redo;
    const rec = from.pop(); if (!rec) return;
    to.push(rec);
    const list = rec.map(r => [r[0], r[1], r[2], redo ? r[4] : r[3]]);
    const h = CR.house; for (const c of list) h.blocks[gIdx(c[0], c[1], c[2])] = c[3];
    h.dirty = true; CR.ver = (CR.ver || 0) + 1; draftSoon();
    const flat = new Int32Array(list.length * 4); list.forEach((c, k) => flat.set(c, k * 4));
    remesh(flat); C.hud(); C.parts();
  }

  // ---------------------------------------------------------------- picking
  function rayFromMouse(e) {
    const cv = C.view(), r = cv.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1, ny = 1 - ((e.clientY - r.top) / r.height) * 2;
    const cam = C.camFor(S.scene, S.cam, r.width, r.height);
    const eye = cam.eye, tg = cam.target;
    const fw = norm([tg[0] - eye[0], tg[1] - eye[1], tg[2] - eye[2]]), rt = norm(cross(fw, [0, 1, 0])), up = cross(rt, fw);
    const th = Math.tan(cam.fov / 2), asp = r.width / r.height;
    const d = norm([fw[0] + rt[0] * nx * th * asp + up[0] * ny * th, fw[1] + rt[1] * nx * th * asp + up[1] * ny * th, fw[2] + rt[2] * nx * th * asp + up[2] * ny * th]);
    return { o: eye, d };
  }
  const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const HDX = [0, 1, 0, -1], HDZ = [-1, 0, 1, 0];
  // DDA through the house grid against every block's selection boxes; cells above the section cut are invisible
  function pickBlock(ray) {
    const h = CR.house; if (!h) return null;
    const [ox, oy, oz] = ray.o, [dx, dy, dz] = ray.d;
    // enter the grid box
    const B = [0, 0, 0, h.sx, h.sy, h.sz];
    let t0 = 0;
    { const r = PH.rayBox(ox, oy, oz, dx, dy, dz, B, 0, 0, 0); if (!r) return null; t0 = r[0]; }
    let px = ox + dx * (t0 + 1e-4), py = oy + dy * (t0 + 1e-4), pz = oz + dz * (t0 + 1e-4);
    let x = Math.floor(px), y = Math.floor(py), z = Math.floor(pz);
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const tdx = Math.abs(1 / dx), tdy = Math.abs(1 / dy), tdz = Math.abs(1 / dz);
    let tx = (dx > 0 ? (x + 1 - px) : (px - x)) * tdx, ty = (dy > 0 ? (y + 1 - py) : (py - y)) * tdy, tz = (dz > 0 ? (z + 1 - pz) : (pz - z)) * tdz;
    const clip = S.clipY;
    for (let i = 0; i < 800; i++) {
      if (x < 0 || y < 0 || z < 0 || x >= h.sx || y >= h.sy || z >= h.sz) break;
      const s = h.blocks[gIdx(x, y, z)];
      if (s && y < clip) {
        const boxes = PH.selection(s, (d) => gGet(x + HDX[d], y, z + HDZ[d]));
        let best = null;
        for (const b of boxes) { const r = PH.rayBox(ox, oy, oz, dx, dy, dz, b, x, y, z); if (r && (!best || r[0] < best[0])) best = r; }
        if (best) return { x, y, z, face: best[1], dist: best[0], state: s, px: ox + dx * best[0], py: oy + dy * best[0], pz: oz + dz * best[0], boxes };
      }
      if (tx < ty && tx < tz) { x += sx; tx += tdx; } else if (ty < tz) { y += sy; ty += tdy; } else { z += sz; tz += tdz; }
    }
    // nothing hit: the ground plane of the lot (y = floor) so the first block can go anywhere
    if (dy < 0) { const t = (h.F - oy) / dy; if (t > 0) { const gx = Math.floor(ox + dx * t), gz = Math.floor(oz + dz * t); if (gx >= 0 && gz >= 0 && gx < h.sx && gz < h.sz) return { x: gx, y: h.F - 1, z: gz, face: 2, dist: t, state: gGet(gx, h.F - 1, gz), px: ox + dx * t, py: h.F, pz: oz + dz * t, ground: true }; } }
    return null;
  }
  const FDX = [1, -1, 0, 0, 0, 0], FDY = [0, 0, 1, -1, 0, 0], FDZ = [0, 0, 0, 0, 1, -1];

  // ---------------------------------------------------------------- break / place / pick (as in the game)
  // the other cells of a multi-cell piece (door halves, tall plants, bed halves, every part of a furniture model)
  function partners(x, y, z, s) {
    const t = R.types[T.type[s]], out = [];
    if (!t) return out;
    if (t.o.kind === 'door' || (t.o.tall && t.has('half'))) { const oy = t.get(s, 'half') ? -1 : 1; if (T.type[gGet(x, y + oy, z)] === t.id) out.push([x, y + oy, z]); }
    if ((t.o.kind === 'model' || t.o.vxModel) && VM.MODELS[t.name]) {
      const f = t.get(s, 'facing'), pi = t.get(s, 'part'), fp = VM.footprint(VM.MODELS[t.name], f), me = fp.find(o => o[3] === pi) || [0, 0, 0, 0];
      const ax = x - me[0], ay = y - me[1], az = z - me[2];
      for (const [dx, dy, dz] of fp) { const bx = ax + dx, by = ay + dy, bz = az + dz; if ((bx !== x || by !== y || bz !== z) && T.type[gGet(bx, by, bz)] === t.id) out.push([bx, by, bz]); }
    }
    if (t.o.kind === 'bed') { const f = t.get(s, 'facing'), head = t.get(s, 'part'), d = head ? -1 : 1, ox = x + VR.HF_DX[f] * d, oz = z + VR.HF_DZ[f] * d; if (T.type[gGet(ox, y, oz)] === t.id) out.push([ox, y, oz]); }
    return out;
  }
  // ---------------------------------------------------------------- using a block like the game's right click
  // doors (both halves), trapdoors, gates and the sliding glass doors open and close
  const OPENABLE = (t) => !!(t && t.has && t.has('open') && (t.o.kind === 'door' || t.o.kind === 'trapdoor' || t.o.kind === 'gate' || (t.o.vx && t.o.vx.kind === 'mdoor')));
  // the cells that open together: a door's two halves, a sliding door's panels (side by side and stacked)
  function openGroup(x, y, z, s) {
    const t = R.types[T.type[s]];
    if (t.o.kind === 'door') return [[x, y, z]].concat(partners(x, y, z, s));
    if (!(t.o.vx && t.o.vx.kind === 'mdoor')) return [[x, y, z]];
    const out = [], seen = new Set([x + ',' + y + ',' + z]), q = [[x, y, z]];
    while (q.length && out.length < 12) {
      const c = q.shift(); out.push(c);
      for (let d = 0; d < 6; d++) {
        const nx = c[0] + FDX[d], ny = c[1] + FDY[d], nz = c[2] + FDZ[d], k = nx + ',' + ny + ',' + nz;
        if (seen.has(k)) continue; seen.add(k);
        if (Math.abs(nx - x) > 2 || Math.abs(ny - y) > 2 || Math.abs(nz - z) > 2) continue;
        if (T.type[gGet(nx, ny, nz)] === t.id) q.push([nx, ny, nz]);
      }
    }
    return out;
  }
  function setOpen(cells, open) {
    const list = [];
    for (const c of cells) { const s = gGet(c[0], c[1], c[2]), t = R.types[T.type[s]]; if (OPENABLE(t) && t.get(s, 'open') !== open) list.push([c[0], c[1], c[2], t.with(s, 'open', open)]); }
    if (list.length) applyChanges(list, false, true);
    return list.length;
  }
  function useAt(hit) {
    if (!hit || hit.ground) return false;
    const s = gGet(hit.x, hit.y, hit.z), t = R.types[T.type[s]];
    if (!OPENABLE(t)) return false;
    setOpen(openGroup(hit.x, hit.y, hit.z, s), t.get(s, 'open') ? 0 : 1);
    return true;
  }
  function breakAt(hit) {
    const { x, y, z } = hit, s = gGet(x, y, z); if (!s) return;
    if (!inLot(x, z)) { tip('Zu weit draußen — bearbeitbar ist das Grundstück und 4 Blöcke drumherum.', false); return; }
    applyChanges([[x, y, z, 0]].concat(partners(x, y, z, s).map(p => [p[0], p[1], p[2], 0])));
  }

  // ---------------------------------------------------------------- the area tool: two corners, then fill / walls / hollow / clear
  const AREA_MAX = 160000;
  function areaBox() {
    const A = CR.area; if (!A || !A.a) return null;
    const b = A.b || A.a, top = A.b ? b[1] + (A.dy || 0) : A.a[1] + (A.dy || 0);
    return [Math.min(A.a[0], b[0]), Math.max(0, Math.min(A.a[1], top)), Math.min(A.a[2], b[2]), Math.max(A.a[0], b[0]), Math.max(A.a[1], top), Math.max(A.a[2], b[2])];
  }
  function areaMode(on, quiet) {
    CR.areaMode = on === undefined ? !CR.areaMode : !!on;
    if (!CR.areaMode) CR.area = null;
    if (CR.areaMode) CR.tool = 'area'; else if (CR.tool === 'area') CR.tool = 'build';
    drawHelp(); drawBar(); if (!quiet) C.parts();
    if (!quiet) tip(CR.areaMode ? L('cr.area.on', 'Bereich: Klick = Ecke 1, Rechtsklick = Ecke 2') : L('cr.area.off', 'Bereich aus'), true);
  }
  function areaApply(mode) {
    const h = CR.house, B = areaBox();
    if (!h || !B) { tip('Erst die Ecken setzen: Klick und Rechtsklick auf Blöcke.', false); return; }
    const vol = (B[3] - B[0] + 1) * (B[4] - B[1] + 1) * (B[5] - B[2] + 1);
    if (vol > AREA_MAX) { tip(`Zu groß (${fmt(vol)} Blöcke, höchstens ${fmt(AREA_MAX)}).`, false); return; }
    let s = 0, id = null;
    if (mode !== 'clear') {
      id = CR.hot[CR.slot]; const t = id && R.byName[id];
      if (!t) { tip('Wähle in der Hotbar einen Block.', false); return; }
      if (t.o.kind === 'model' || t.o.vxModel || t.o.kind === 'door' || t.o.kind === 'bed' || t.o.tall || t.o.modernDoor) { tip('Bereiche füllen geht mit einfachen Blöcken — Möbel, Türen und Betten einzeln setzen.', false); return; }
      s = t.defaultState;
    }
    const cells = new Map(), key = (x, y, z) => x + ',' + y + ',' + z;
    for (let y = B[1]; y <= B[4]; y++) for (let z = B[2]; z <= B[5]; z++) for (let x = B[0]; x <= B[3]; x++) {
      if (!inLot(x, z)) continue;
      const ex = x === B[0] || x === B[3], ey = y === B[1] || y === B[4], ez = z === B[2] || z === B[5];
      if (mode === 'hollow' && !(ex || ey || ez)) continue;
      if (mode === 'walls' && !(ex || ez)) continue;
      const cur = gGet(x, y, z); if (cur === s) continue;
      cells.set(key(x, y, z), [x, y, z, s]);
      // a piece that loses one of its cells loses all of them (no half sofas)
      if (cur) for (const p of partners(x, y, z, cur)) { const k = key(p[0], p[1], p[2]); if (!cells.has(k)) cells.set(k, [p[0], p[1], p[2], 0]); }
    }
    const list = [...cells.values()];
    if (!list.length) { tip('Nichts zu ändern.', true); return; }
    applyChanges(list);
    if (id) useRecent(id);
    const what = { fill: 'gefüllt', walls: 'Wände gezogen', hollow: 'hohl gebaut', clear: 'geleert' }[mode];
    tip(`${fmt(list.length)} Blöcke · Bereich ${what} — Strg+Z nimmt es zurück.`, true);
  }
  function placeAt(hit) {
    const id = CR.hot[CR.slot]; if (!id) { tip('Leerer Platz — links ein Item wählen.', false); return; }
    const type = R.byName[id]; if (!type) { tip('Das ist kein Block (Werkzeug/Material).', false); return; }
    const h = CR.house;
    // slab on slab of the same kind → double slab
    if (!hit.ground) { const ms = PL.slabMerge(type, hit.state, hit.face, hit.py - hit.y); if (ms >= 0) { applyChanges([[hit.x, hit.y, hit.z, ms]]); useRecent(id); return; } }
    let x = hit.x, y = hit.y, z = hit.z;
    const cur = gGet(x, y, z);
    if (!(cur && (T.flags[cur] & F.REPLACE)) || hit.ground) { x += FDX[hit.face]; y += FDY[hit.face]; z += FDZ[hit.face]; }
    if (y < 0) return;
    if (!inLot(x, z)) { tip('Zu weit draußen — bearbeitbar ist das Grundstück und 4 Blöcke drumherum.', false); return; }
    const tgt = gGet(x, y, z); if (tgt && !(T.flags[tgt] & F.REPLACE)) return;
    const [yaw, pitch] = camLook();
    const world = { getBlock: (a, b, c) => gGet(a, b, c) };
    let out = null;
    try { out = PL.compute(type, { world, face: hit.face, fx: hit.px - hit.x, fy: hit.py - hit.y, fz: hit.pz - hit.z, yaw, pitch, x, y, z }); } catch (e) { out = [{ x, y, z, state: type.defaultState }]; }
    if (!out || !out.length) { tip('Passt hier nicht hin.', false); return; }
    for (const o of out) { if (!inLot(o.x, o.z) || o.y < 0) { tip('Ragt zu weit hinaus.', false); return; } const c = gGet(o.x, o.y, o.z); if (c && !(T.flags[c] & F.REPLACE) && !(o.x === x && o.y === y && o.z === z)) { tip('Kein Platz für das ganze Teil.', false); return; } }
    if (CR.placeGuard && !CR.placeGuard(out)) { tip('Da stehst du gerade.', false); return; }
    applyChanges(out.map(o => [o.x, o.y, o.z, o.state]));
    useRecent(id);
  }
  // the camera's look as the game's player yaw / pitch (plus the R-key turn for the next piece)
  function camLook() {
    const cam = C.camFor(S.scene, S.cam, 1, 1), eye = cam.eye, tg = cam.target;
    return [Math.atan2(-(tg[0] - eye[0]), -(tg[2] - eye[2])) + CR.rot * Math.PI / 2, Math.atan2(tg[1] - eye[1], Math.hypot(tg[0] - eye[0], tg[2] - eye[2]))];
  }

  // ---------------------------------------------------------------- replace: one piece, or every piece of its kind
  // The hotbar item takes the old piece's place and turn: a sofa becomes the other sofa facing the same way, a door
  // the other door (same hinge), stairs keep their direction and half, slabs their top / bottom; a plain block fills
  // every cell the old piece had (a door replaced by wall blocks closes the opening). All in one undo step.
  const PF_KINDS = new Set(['stairs', 'vxroof', 'door', 'gate', 'bed', 'repeater', 'comparator']);
  const doorLike = (t) => t.o.kind === 'door' || !!(t.o.vx && /door/.test(t.o.vx.kind || ''));
  function pieceOf(x, y, z, s) {
    const t = R.types[T.type[s]], cells = [[x, y, z]].concat(partners(x, y, z, s));
    // the voxel glass doors stand as two single blocks on top of each other: for replacing they are one door
    if (t.o.vx && /door/.test(t.o.vx.kind || '')) {
      for (const dy of [1, -1]) if (T.type[gGet(x, y + dy, z)] === t.id) { cells.push([x, y + dy, z]); break; }
    }
    let a = cells[0];
    if (VM.MODELS[t.name] && t.has('part')) {
      // a furniture model: the cell the game anchors it on (its footprint's origin)
      const f = t.get(s, 'facing'), fp = VM.footprint(VM.MODELS[t.name], f), me = fp.find(o => o[3] === t.get(s, 'part')) || [0, 0, 0, 0];
      a = [x - me[0], y - me[1], z - me[2]];
    } else if (t.o.kind === 'bed') a = cells.find(c => t.get(gGet(c[0], c[1], c[2]), 'part') === 0) || cells[0];
    else for (const c of cells) if (c[1] < a[1]) a = c;
    return { t, s, cells, anchor: a };
  }
  // the old state's turn, half, axis, slab type … on the new block where it has the same property
  function carryProps(nt, st, ot, os) {
    for (const p of Object.keys(nt.propIndex || {})) {
      if (p === 'part' || !ot.has(p)) continue;
      if (p === 'half' && (ot.o.kind === 'door' || ot.o.tall)) continue;
      if (p === 'type' && !(ot.o.kind === 'slab' && nt.o.kind === 'slab')) continue;
      const v = ot.get(os, p); if (v < nt.props[nt.propIndex[p]].n) st = nt.with(st, p, v);
    }
    return st;
  }
  // plan one replacement on the overlay grid (get / put); the number of cells written, 0 when it does not fit
  function replacePlan(pc, nt, get, put, camPf) {
    const { t, s, cells, anchor } = pc;
    const old = cells.map(c => get(c[0], c[1], c[2]));
    for (const c of cells) put(c[0], c[1], c[2], 0);
    let pf = camPf;
    if (t.has('facing')) { const f = t.get(s, 'facing'); if (f < 4) pf = PF_KINDS.has(t.o.kind) || doorLike(t) ? f : (f + 2) % 4; }
    const top = (t.has('half') && t.o.kind !== 'door' && !t.o.tall && t.get(s, 'half') === 1) || (t.o.kind === 'slab' && t.get(s, 'type') === 1);
    let out = null;
    try { out = PL.compute(nt, { world: { getBlock: get }, face: top ? 3 : 2, fx: 0.5, fy: top ? 0.75 : 0.25, fz: 0.5, yaw: -pf * Math.PI / 2, pitch: 0, x: anchor[0], y: anchor[1], z: anchor[2] }); } catch (e) { out = null; }
    if (out && doorLike(t) && doorLike(nt)) {
      // door for door: exactly the old one's direction, hinge side and open / shut
      for (const o of out) for (const p of ['facing', 'hinge', 'open']) if (t.has(p) && nt.has(p)) { const v = t.get(s, p); if (v < nt.props[nt.propIndex[p]].n) o.state = nt.with(o.state, p, v); }
      // a single-block voxel door takes the old door's whole opening (both cells)
      if (out.length === 1 && cells.length > 1) { const st0 = out[0].state; out = cells.map(c => ({ x: c[0], y: c[1], z: c[2], state: st0 })); }
    } else if (out && out.length === 1 && !nt.has('part') && nt.o.kind !== 'door' && nt.o.kind !== 'bed' && !nt.o.tall) {
      const st0 = out[0].state;
      out = cells.map((c, k) => ({ x: c[0], y: c[1], z: c[2], state: carryProps(nt, st0, t, old[k]) }));
    }
    const fits = out && out.length && out.every(o => { if (o.y < 0 || !inLot(o.x, o.z)) return false; const c = get(o.x, o.y, o.z); return !c || (T.flags[c] & F.REPLACE); });
    if (!fits) { cells.forEach((c, k) => put(c[0], c[1], c[2], old[k])); return 0; }
    for (const o of out) put(o.x, o.y, o.z, o.state);
    return out.length;
  }
  // what a paint stroke reaches: 'one' piece, the 'face' — the connected surface of that block on the side you point
  // at (a whole wall of a facade, one window), or 'all' of that kind in the house; as whole pieces, never half a sofa
  const multiCell = (t) => t.o.kind === 'door' || t.o.kind === 'bed' || !!t.o.tall || !!(VM.MODELS[t.name] && t.has('part')) || !!(t.o.vx && /door/.test(t.o.vx.kind || ''));
  const FACE_MAX = 6000;
  function floodFace(hit, ot) {
    const f = hit.face, nx = FDX[f], ny = FDY[f], nz = FDZ[f], ax = f >> 1, out = [], seen = new Set();
    const dirs = [0, 1, 2, 3, 4, 5].filter(d => (d >> 1) !== ax);
    const ok = (x, y, z) => { if (!inLot(x, z) || T.type[gGet(x, y, z)] !== ot.id || !gGet(x, y, z)) return false; const n = gGet(x + nx, y + ny, z + nz); return !n || !(T.flags[n] & F.OPAQUE); };
    const q = [[hit.x, hit.y, hit.z]]; seen.add(gIdx(hit.x, hit.y, hit.z));
    while (q.length && out.length < FACE_MAX) {
      const c = q.pop(); out.push(c);
      for (const d of dirs) { const x = c[0] + FDX[d], y = c[1] + FDY[d], z = c[2] + FDZ[d]; if (y < 0 || x < 0 || z < 0 || x >= CR.house.sx || z >= CR.house.sz || y >= CR.house.sy) continue; const k = gIdx(x, y, z); if (seen.has(k)) continue; seen.add(k); if (ok(x, y, z)) q.push([x, y, z]); }
    }
    return out;
  }
  function cellsOfType(ot) {
    const h = CR.house, out = [];
    for (let i = 0; i < h.blocks.length; i++) if (h.blocks[i] && T.type[h.blocks[i]] === ot.id) { const x = i % h.sx, z = Math.floor(i / h.sx) % h.sz; if (inLot(x, z)) out.push([x, Math.floor(i / (h.sx * h.sz)), z]); }
    return out;
  }
  function paintTargets(hit, scope) {
    const s0 = gGet(hit.x, hit.y, hit.z); if (!s0) return null;
    const ot = R.types[T.type[s0]];
    const starts = scope === 'all' ? cellsOfType(ot) : scope === 'face' && !multiCell(ot) ? floodFace(hit, ot) : [[hit.x, hit.y, hit.z]];
    return piecesAt(starts, ot);
  }
  // the whole pieces the start cells belong to (a door is both halves, a sofa every cell)
  function piecesAt(starts, ot) {
    const seen = new Set(), pieces = [], cells = [];
    for (const c of starts) {
      if (seen.has(gIdx(c[0], c[1], c[2]))) continue;
      const pc = pieceOf(c[0], c[1], c[2], gGet(c[0], c[1], c[2]));
      for (const q of pc.cells) { const k = gIdx(q[0], q[1], q[2]); if (!seen.has(k)) { seen.add(k); cells.push(q); } }
      if (pc.cells.every(q => inLot(q[0], q[2]))) pieces.push(pc);
    }
    return { from: ot, cells, pieces };
  }
  // 🎨 "Verbaut in": every piece of one kind in the open house becomes another — the paint tool's "Alle im Haus", as
  // one undo step, each piece keeping its turn, half and the rest (then "Ins Spiel" takes it into the game)
  function replaceAll(fromId, toId) {
    const h = CR.house, ot = R.byName[fromId], nt = R.byName[toId];
    if (!h || !ot || !nt) { tip(L('cr.paint.pick', 'Wähle unten in der Hotbar den neuen Block.'), false); return null; }
    if (ot.id === nt.id) { tip(L('cr.paint.same', 'Ist schon {n}.', { n: nameOf(nt.name) }), true); return null; }
    const tg = piecesAt(cellsOfType(ot), ot);
    if (!tg.pieces.length) { tip(L('cr.all.none', 'Kein {n} in diesem Haus.', { n: nameOf(ot.name) }), false); return null; }
    const r = replacePieces(tg.pieces, nt);
    if (!r.done) { tip(L('cr.paint.nofit', '{n} passt dort nicht hin.', { n: nameOf(nt.name) }), false); return null; }
    if (!r.list.length) { tip(L('cr.nothing', 'Nichts zu ändern.'), true); return null; }
    applyChanges(r.list); useRecent(nt.name);
    CR.hot[CR.slot] = nt.name; drawBar();
    flashCells(tg.cells);
    tip(`${nameOf(ot.name)} → ${nameOf(nt.name)} ×${r.done}${r.failed ? ' · ' + L('cr.paint.failed', '{n} passten nicht', { n: r.failed }) : ''} — ${SA ? L('cr.all.thenSA', '💾 Speichern behält es') : L('cr.all.then', '„Ins Spiel“ übernimmt es')} · Strg+Z`, true);
    return { done: r.done, failed: r.failed };
  }
  CR.replaceAll = replaceAll;
  // ⚒ "Verbaut in": that house in the Crafter, the piece in the hand, 🖌 Malen ready — point at something, it becomes that
  CR.openWith = function (idx, id) {
    const then = () => { CR.hot[CR.slot] = id; useRecent(id); if (CR.tool !== 'paint') setTool('paint'); drawBar(); C.hud(); tip('🖌 ' + nameOf(id) + ' — ' + L('cr.with', 'in der Hand: zeig auf etwas, Klick macht es dazu (Tab: Fläche · Alle)'), true); };
    if (S.mode === 'craft' && CR.on && CR.kind === 'house' && CR.house && CR.house.index === idx) { then(); return; }
    CR.want = { kind: 'house', idx, then }; C.setMode('craft');
  };
  // 🎨 "Verbaut in": that house in the Crafter, every piece of one kind replaced by the chosen one
  CR.replaceIn = function (idx, fromId, toId) {
    const then = () => replaceAll(fromId, toId);
    if (S.mode === 'craft' && CR.on && CR.kind === 'house' && CR.house && CR.house.index === idx) { then(); return; }
    CR.want = { kind: 'house', idx, then }; C.setMode('craft');
  };
  // carry out the replacement of whole pieces by the type nt: the list of changes, and how many fit
  function replacePieces(pieces, nt) {
    const h = CR.house, K = (x, y, z) => (y * h.sz + z) * h.sx + x, plan = new Map();
    const get = (x, y, z) => { if (x < 0 || y < 0 || z < 0 || x >= h.sx || z >= h.sz) return 0; const k = K(x, y, z); return plan.has(k) ? plan.get(k) : y < h.sy ? h.blocks[k] : 0; };
    const put = (x, y, z, v) => plan.set(K(x, y, z), v);
    const camPf = PL.playerFacing(camLook()[0]);
    let done = 0, failed = 0;
    for (const pc of pieces) { if (replacePlan(pc, nt, get, put, camPf)) done++; else failed++; }
    const list = [];
    for (const [k, v] of plan) { const x = k % h.sx, z = Math.floor(k / h.sx) % h.sz, y = Math.floor(k / (h.sx * h.sz)); if ((y < h.sy ? h.blocks[k] : 0) !== v) list.push([x, y, z, v]); }
    return { list, done, failed };
  }
  function replaceAt(hit, scope) {
    const h = CR.house; if (!h) return;
    scope = scope === true ? 'all' : scope === false || scope === undefined ? 'one' : scope;
    if (!hit || hit.ground || !gGet(hit.x, hit.y, hit.z)) { tip(L('cr.paint.aim', 'Zeig auf das, was neu werden soll.'), false); return; }
    const id = CR.hot[CR.slot], nt = id && R.byName[id];
    if (!nt) { tip(L('cr.paint.pick', 'Wähle unten in der Hotbar den neuen Block.'), false); return; }
    if (!inLot(hit.x, hit.z)) { tip(L('cr.far', 'Zu weit draußen — Grundstück + 4 Blöcke.'), false); return; }
    const tg = paintTargets(hit, scope), ot = tg.from;
    if (ot.id === nt.id) { tip(L('cr.paint.same', 'Ist schon {n}.', { n: nameOf(nt.name) }), true); return; }
    const r = replacePieces(tg.pieces, nt);
    if (!r.done) { tip(L('cr.paint.nofit', '{n} passt dort nicht hin.', { n: nameOf(nt.name) }), false); return; }
    if (!r.list.length) { tip(L('cr.nothing', 'Nichts zu ändern.'), true); return; }
    applyChanges(r.list); useRecent(nt.name);
    flashCells(tg.cells);
    tip(`${nameOf(ot.name)} → ${nameOf(nt.name)}${r.done > 1 ? ' ×' + r.done : ''}${r.failed ? ' · ' + L('cr.paint.failed', '{n} passten nicht', { n: r.failed }) : ''}`, true);
    return { done: r.done, failed: r.failed };
  }

  // ---------------------------------------------------------------- the paint preview: what will change glows before you click
  const HOLD_N = 24, HOLD_MS = 650, SHOW_MAX = 3000;
  let pv = null, pvKey = '', pvMesh = null, hold = null, flash = null;
  function faceQuad(x, y, z, d, e, out, c) {
    const X0 = x - (d === 1 ? e : 0), X1 = x + 1 + (d === 0 ? e : 0), Y0 = y - (d === 3 ? e : 0), Y1 = y + 1 + (d === 2 ? e : 0), Z0 = z - (d === 5 ? e : 0), Z1 = z + 1 + (d === 4 ? e : 0);
    if (d === 0) out.push(X1, Y0, Z0, X1, Y1, Z0, X1, Y1, Z1, X1, Y0, Z1);
    else if (d === 1) out.push(X0, Y0, Z0, X0, Y0, Z1, X0, Y1, Z1, X0, Y1, Z0);
    else if (d === 2) out.push(X0, Y1, Z0, X0, Y1, Z1, X1, Y1, Z1, X1, Y1, Z0);
    else if (d === 3) out.push(X0, Y0, Z0, X1, Y0, Z0, X1, Y0, Z1, X0, Y0, Z1);
    else if (d === 4) out.push(X0, Y0, Z1, X1, Y0, Z1, X1, Y1, Z1, X0, Y1, Z1);
    else out.push(X0, Y0, Z0, X0, Y1, Z0, X1, Y1, Z0, X1, Y0, Z0);
    out.push(c[0], c[1], c[2]);
  }
  // the visible skin of a set of cells (faces toward something you can see through), as overlay quads
  function skinMesh(cells, col) {
    const set = new Set(cells.map(c => gIdx(c[0], c[1], c[2]))), q = [];
    for (let i = 0; i < cells.length && i < SHOW_MAX; i++) {
      const [x, y, z] = cells[i];
      for (let d = 0; d < 6; d++) {
        const ax = x + FDX[d], ay = y + FDY[d], az = z + FDZ[d];
        if (set.has(gIdx(ax, ay, az)) && ay >= 0) continue;
        const n = gGet(ax, ay, az); if (n && (T.flags[n] & F.OPAQUE)) continue;
        faceQuad(x, y, z, d, 0.012, q, col);
      }
    }
    return C.quadMesh(q);
  }
  function setPreview(p) {
    if (pvMesh) { C.freeQuadMesh(pvMesh); pvMesh = null; }
    pv = p;
    if (p && p.cells.length) pvMesh = skinMesh(p.cells, p.same ? [0.6, 0.62, 0.66] : [0.25, 0.9, 1.0]);
    drawBadge();
  }
  function flashCells(cells) {
    if (flash && flash.mesh) C.freeQuadMesh(flash.mesh);
    flash = { mesh: skinMesh(cells, [0.45, 1, 0.55]), t0: performance.now() };
    pvKey = ''; hold = null;
  }
  // recomputed when the target, the reach, the hotbar block or the house change
  function updatePreview() {
    const hv = CR.hover;
    if (!(CR.on && CR.kind === 'house' && CR.tool === 'paint') || !hv || hv.ground || !gGet(hv.x, hv.y, hv.z)) { if (pv) setPreview(null); pvKey = ''; drawBadge(); return; }
    const id = CR.hot[CR.slot] || '';
    const key = [hv.x, hv.y, hv.z, hv.face, CR.scope, id, CR.ver || 0].join(',');
    if (key === pvKey) { drawBadge(); return; }
    pvKey = key; hold = null;
    const tg = paintTargets(hv, CR.scope); if (!tg) { setPreview(null); return; }
    const nt = id && R.byName[id];
    setPreview({ hit: { x: hv.x, y: hv.y, z: hv.z, face: hv.face }, from: tg.from, to: nt || null, cells: tg.cells, pieces: tg.pieces, n: tg.pieces.length, same: !nt || nt.id === tg.from.id });
  }
  // the badge at the pointer: [old] → [new] ×n, and the ring that fills while you hold for a big change
  let badgeSig = '';
  function drawBadge() {
    const el = $('#paintBadge'); if (!el) return;
    const show = !!(pv && !pv.same && CR.tool === 'paint' && CR.on);
    el.classList.toggle('on', show);
    if (!show) { badgeSig = ''; return; }
    const pm = CR.player && CR.player.on && CR.player.locked;
    const main = $('main').getBoundingClientRect();
    const x = pm ? main.width / 2 + 26 : (CR.mx || 0) + 22, y = pm ? main.height / 2 + 22 : (CR.my || 0) + 18;
    el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    const big = pv.n > HOLD_N || CR.scope === 'all';
    const sig = pv.from.name + '>' + (pv.to ? pv.to.name : '') + ':' + pv.n + ':' + big;
    if (sig !== badgeSig) {
      badgeSig = sig;
      el.innerHTML = `<canvas width="34" height="34"></canvas>${IC('arrow', 18, 'ar')}<canvas width="34" height="34"></canvas><b>×${pv.n}</b>${big ? `<svg class="ring" viewBox="0 0 40 40" width="40" height="40"><circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="4"/><circle class="p" cx="20" cy="20" r="16" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-dasharray="100.5" stroke-dashoffset="100.5" transform="rotate(-90 20 20)"/></svg><small>${IC('pencil', 12)} ${L('cr.paint.hold', 'halten')}</small>` : ''}`;
      const cv = el.querySelectorAll('canvas');
      const put = (c, id) => { const ic = id && iconOf(id); if (ic) { const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(ic, 0, 0, 34, 34); } };
      put(cv[0], pv.from.name); if (pv.to) put(cv[1], pv.to.name);
      el.classList.toggle('same', !!pv.same);
    }
    const ring = el.querySelector('.ring .p');
    if (ring) ring.setAttribute('stroke-dashoffset', String(100.5 * (1 - (hold && !hold.quick ? Math.min(1, (performance.now() - hold.t0) / HOLD_MS) : 0))));
  }
  // left button on the paint tool: small changes on click, big ones when held until the ring is full
  function paintDown() {
    updatePreview();
    if (!pv) { tip(L('cr.paint.aim', 'Zeig auf das, was neu werden soll.'), false); return; }
    if (pv.same) { tip(pv.to ? L('cr.paint.same', 'Ist schon {n}.', { n: nameOf(pv.to.name) }) : L('cr.paint.pick', 'Wähle unten in der Hotbar den neuen Block.'), !!pv.to); return; }
    hold = { t0: performance.now(), key: pvKey, quick: !(pv.n > HOLD_N || CR.scope === 'all') };
  }
  function paintUp() {
    const hd = hold; hold = null; if (!hd || hd.done) return;
    if (hd.quick || performance.now() - hd.t0 >= HOLD_MS) { if (hd.key === pvKey) paintApply(); return; }
    tip(L('cr.paint.holdtip', 'Große Änderung: gedrückt halten, bis der Ring voll ist.'), false);
    drawBadge();
  }
  function paintTick() {
    if (CR.tool !== 'paint') return;
    if (hold && !hold.quick && !hold.done) {
      if (hold.key !== pvKey) hold = null;
      else if (performance.now() - hold.t0 >= HOLD_MS) { hold.done = true; paintApply(); }
    }
    drawBadge();
  }
  function paintCancel() { hold = null; drawBadge(); }
  function paintApply() {
    if (!pv || !pv.to || pv.same) return;
    const r = replacePieces(pv.pieces, pv.to);
    if (!r.done) { tip(L('cr.paint.nofit', '{n} passt dort nicht hin.', { n: nameOf(pv.to.name) }), false); return; }
    if (!r.list.length) return;
    const from = pv.from, to = pv.to, cells = pv.cells;
    applyChanges(r.list); useRecent(to.name);
    flashCells(cells);
    tip(`${nameOf(from.name)} → ${nameOf(to.name)} ×${r.done}${r.failed ? ' · ' + L('cr.paint.failed', '{n} passten nicht', { n: r.failed }) : ''}`, true);
  }
  CR.paint = { down: paintDown, up: paintUp, cancel: paintCancel, tick: paintTick, update: updatePreview, apply: paintApply, preview: () => pv };
  function pickAt(hit) {
    const s = hit.state; if (!s) return;
    let t = R.types[T.type[s]]; if (!t) return;
    if (t.o.cutOf && R.byName[t.o.cutOf]) t = R.byName[t.o.cutOf];
    const i = CR.hot.indexOf(t.name);
    if (i >= 0) CR.slot = i; else CR.hot[CR.slot] = t.name;
    useRecent(t.name); drawBar(); C.hud(); tip('Aufgenommen: ' + nameOf(t.name), true);
  }

  // ---------------------------------------------------------------- the house as the game stores it
  // v2: the whole lot as a template (every cell the house or the player put there) — the game lays it down
  // exactly, whatever later versions of the villa builder would generate
  // the facade the game builds a house in without a design: the catalogue's own pick (the villa builder's first
  // choice with seed 7, not mirrored) — another facade or a mirrored plan is a choice worth keeping as a design
  function skin0(index) {
    const rec = C.HOUSE.get(index), skins = rec && rec.data && rec.data.skins;
    if (!skins || !skins.length || !VR.RNG) return null;
    try { return skins[new VR.RNG(7).int(skins.length)]; } catch (e) { return null; }
  }
  function updateHouse() {
    const h = CR.house; if (!h) return;
    clearTimeout(draftT); draftT = 0; draftDue = 0;
    const st = store(), P = PJ(), id = 'h:' + h.index;
    const r = CU.makeTemplate({ sx: h.sx, sy: h.sy, sz: h.sz, pad: h.pad, F: h.F, lot: h.lot, blocks: h.blocks, base: h.base, wrote: h.wrote });
    const changed = r ? r.changed : 0, s0 = skin0(h.index), ownLook = !!h.mirror || !!(s0 && h.skin && h.skin !== s0);
    let what;
    if (!changed && !ownLook) {
      // exactly the original: no design
      delete st.houses[h.index];
      if (!saveStore(st)) { tip(L('cr.saveFail', 'Speichern fehlgeschlagen — der Browser-Speicher ist voll'), false); draftSoon(); return; }
      h.dirty = false; h.savedAt = 0; if (P) { P.dropData(id); if (P.get(id)) P.put(id, { n: 0 }); }
      tip(SA ? L('cr.origSA', 'Keine Änderungen — gespeichert ist das Original') : L('cr.orig2', 'Keine Änderungen — neue Städte bauen das Original'), true); C.parts(); return;
    }
    // only another facade (or the mirrored plan): kept as a design of its own, so the choice reaches the game
    st.houses[h.index] = changed
      ? { v: 2, name: h.name, index: h.index, seed: 7, beds: 3, skin: h.skin, mirror: !!h.mirror, tpl: r.tpl, n: changed, top: r.top, t: Date.now() }
      : { v: 2, name: h.name, index: h.index, seed: 7, beds: 3, skin: h.skin, mirror: !!h.mirror, n: 0, t: Date.now() };
    what = changed ? fmt(changed) + ' ' + L('cr.blocks', 'Blöcke geändert') : L('cr.facade', 'Fassade {s}', { s: h.skin + (h.mirror ? ' ⇋' : '') });
    if (!saveStore(st)) { tip(L('cr.saveFail', 'Speichern fehlgeschlagen — der Browser-Speicher ist voll'), false); draftSoon(); return; }
    h.dirty = false; h.savedAt = Date.now();
    // saved: the draft has done its job
    if (P) { P.dropData(id); P.put(id, { kind: 'house', name: h.name, ref: { index: h.index }, n: changed, view: viewState() }); shootProject(id); }
    tip(SA ? `💾 ${h.name} ${L('cr.savedSA', 'gespeichert')} (${what}) — ${L('cr.takeSA', '📦 Mitnehmen bringt es ins Spiel')}`
      : `✓ ${h.name}: ${L('cr.inGame', 'neue Städte bauen es so — schon stehende Häuser bleiben, wie sie sind')} (${what})`, true);
    C.rebuildHouse(h.index, { skin: h.skin, mirror: h.mirror }).then(() => { if (S.mode === 'craft') { C.hud(); } });
    C.parts();
  }
  const designCount = (hh) => hh.n || (hh.cells ? hh.cells.length : 0);
  // designs saved by older Studios (v1: only the changed cells) become templates, built on today's villa builder
  let upgrading = false;
  async function upgradeDesigns() {
    if (upgrading) return 0;
    upgrading = true;
    let n = 0;
    try {
      const st = store();
      for (const k of Object.keys(st.houses || {})) {
        const hh = st.houses[k]; if (!hh || hh.tpl || !hh.cells) continue;
        const m = await C.call({ type: 'craft_tpl', index: hh.index, seed: hh.seed || 7, beds: hh.beds || 3, skin: hh.skin, mirror: !!hh.mirror, edit: hh });
        if (m.type !== 'craft_tpl' || !m.tpl) continue;
        const cur = store(); if (!cur.houses[k] || cur.houses[k].t !== hh.t) continue;   // changed meanwhile
        cur.houses[k] = { v: 2, name: hh.name, index: hh.index, seed: hh.seed || 7, beds: hh.beds || 3, skin: hh.skin, mirror: !!hh.mirror, tpl: m.tpl, n: m.changed, top: m.top, t: hh.t };
        if (saveStore(cur)) n++;
      }
      if (n) { CU.apply(store()); C.sys(`${n} eigene${n === 1 ? 's' : ''} Design${n === 1 ? '' : 's'} ins neue Format übernommen`, 'ok'); if (CR.on) C.parts(); }
    } catch (e) { console.warn('design upgrade', e); }
    upgrading = false;
    return n;
  }
  CR.upgradeDesigns = upgradeDesigns;
  { const go = () => { if (!$('#studio').classList.contains('boot') && C.HOUSE.size) upgradeDesigns(); else setTimeout(go, 700); }; setTimeout(go, 700); }
  function resetHouse() {
    const h = CR.house; if (!h) return;
    const list = [];
    for (let i = 0; i < h.blocks.length; i++) if (h.blocks[i] !== h.base[i]) { const x = i % h.sx, z = Math.floor(i / h.sx) % h.sz, y = Math.floor(i / (h.sx * h.sz)); list.push([x, y, z, h.base[i]]); }
    if (!list.length) { tip('Schon das Original.', true); return; }
    applyChanges(list); tip(SA ? L('cr.resetSA', 'Original wiederhergestellt — 💾 Speichern behält es') : L('cr.reset2', 'Original wiederhergestellt — „Ins Spiel“ übernimmt es'), true);
  }

  // ---------------------------------------------------------------- 🕘 drafts: unfinished work is never lost
  // Two seconds after a change (at most eight while you keep building) the house — or the item — is kept in the
  // browser's storage as a draft, apart from the designs the game reads: the game sees it only after "Ins Spiel".
  // With it go the camera, the floor cut, the tool and the hotbar; opening the house again brings all of it back.
  let draftT = 0, draftDue = 0, draftFail = false;
  const shotAt = new Map();
  const pid = () => (CR.kind === 'house' && CR.house ? 'h:' + CR.house.index : CR.kind === 'item' && CR.item ? 'm:' + CR.item.name : null);
  function draftSoon() {
    const now = Date.now(); if (!draftDue) draftDue = now + 8000;
    clearTimeout(draftT);
    draftT = setTimeout(saveDraft, Math.max(50, Math.min(2000, draftDue - now)));
  }
  function saveDraft() {
    clearTimeout(draftT); draftT = 0; draftDue = 0;
    try { if (CR.kind === 'house' && CR.house) saveHouseDraft(); else if (CR.kind === 'item' && CR.item) saveItemDraft(); }
    catch (e) { console.warn('draft', e); }
    if (CR.on) C.hud();
  }
  const draftFull = () => { C.full('drafts'); if (!draftFail) { draftFail = true; tip(L('cr.draftFail3', 'Browser-Speicher voll — der Entwurf ist nur bis zum Schließen da'), false); } };
  function saveHouseDraft() {
    const P = PJ(), h = CR.house; if (!P || !h) return;
    const id = 'h:' + h.index, saved = store().houses[h.index];
    const r = CU.makeTemplate({ sx: h.sx, sy: h.sy, sz: h.sz, pad: h.pad, F: h.F, lot: h.lot, blocks: h.blocks, base: h.base, wrote: h.wrote });
    const n = r ? r.changed : 0;
    // back to exactly what the game has (or to the original): no draft
    const same = saved ? !!(r && saved.tpl && JSON.stringify(r.tpl) === JSON.stringify(saved.tpl)) : !n;
    if (same) {
      P.dropData(id);
      if (h.dirty) { h.dirty = false; C.parts(); }
      if (P.get(id)) P.put(id, { n: saved ? saved.n || n : 0, view: viewState() });
    } else {
      if (!P.setData(id, { v: 2, index: h.index, name: h.name, seed: 7, beds: 3, skin: h.skin, mirror: !!h.mirror, tpl: r.tpl, n, top: r.top, t: Date.now(), on: saved ? saved.t : 0, undo: packUndo() })) draftFull(); else draftFail = false;
      P.put(id, { kind: 'house', name: h.name, ref: { index: h.index }, n, view: viewState() });
    }
    shootSoon(id);
  }
  function saveItemDraft() {
    const P = PJ(), it = CR.item; if (!P || !it) return;
    const id = 'm:' + it.name;
    let same = true; for (let i = 0; i < it.V.length; i++) if (it.V[i] !== it.orig[i]) { same = false; break; }
    if (same) {
      P.dropData(id);
      if (it.dirty) { it.dirty = false; C.parts(); }
      if (P.get(id)) P.put(id, { n: 0, view: viewState() });
    } else {
      const { idx, pal } = itemModel();
      if (!P.setData(id, { v: 1, W: it.W, H: it.H, D: it.D, res: it.res, pal: Array.from(pal), rle: CU.b64(new Uint8Array(CU.rle(idx).buffer)), n: it.changed || 0, t: Date.now(), undo: packVUndo() })) draftFull(); else draftFail = false;
      P.put(id, { kind: 'item', name: it.display, ref: { name: it.name }, n: it.changed || 0, view: viewState() });
    }
    shootSoon(id);
  }
  // the last steps of Strg+Z go with the draft (blocks by name, so a newer game still reads them): at most 30 steps
  // and 3000 cells for a house, 2000 voxels for an item
  function packUndo() {
    const steps = [], pal = [], map = new Map(); let cells = 0;
    const pi = (st) => { let i = map.get(st); if (i === undefined) { i = pal.length; pal.push(CU.portable(st)); map.set(st, i); } return i; };
    for (let k = CR.undo.length - 1; k >= 0 && steps.length < 30; k--) {
      const rec = CR.undo[k]; if (cells + rec.length > 3000) break;
      const flat = []; for (const r of rec) flat.push(r[0], r[1], r[2], pi(r[3]), pi(r[4]));
      steps.unshift(flat); cells += rec.length;
    }
    return steps.length ? { pal, steps } : null;
  }
  function unpackUndo(u) {
    if (!u || !Array.isArray(u.pal) || !Array.isArray(u.steps)) return [];
    const st = u.pal.map(e => CU.fromPortable(e)), out = [];
    for (const flat of u.steps) {
      const rec = []; let bad = !Array.isArray(flat);
      for (let i = 0; !bad && i + 4 < flat.length; i += 5) { const a = st[flat[i + 3]], b = st[flat[i + 4]]; if (!(a >= 0) || !(b >= 0)) bad = true; else rec.push([flat[i], flat[i + 1], flat[i + 2], a, b]); }
      if (bad) { out.length = 0; continue; }      // a block this game does not know: nothing before it can be undone
      if (rec.length) out.push(rec);
    }
    return out;
  }
  function packVUndo() {
    const it = CR.item, steps = []; let n = 0;
    for (let k = it.vundo.length - 1; k >= 0 && steps.length < 30; k--) {
      const rec = it.vundo[k]; if (n + rec.length > 2000) break;
      const flat = []; for (const r of rec) flat.push(r[0], r[1] >>> 0, r[2] >>> 0);
      steps.unshift(flat); n += rec.length;
    }
    return steps.length ? { steps } : null;
  }
  function unpackVUndo(u, len) {
    if (!u || !Array.isArray(u.steps)) return [];
    const out = [];
    for (const flat of u.steps) { if (!Array.isArray(flat)) continue; const rec = []; for (let i = 0; i + 2 < flat.length; i += 3) if (flat[i] >= 0 && flat[i] < len) rec.push([flat[i], flat[i + 1] >>> 0, flat[i + 2] >>> 0]); if (rec.length) out.push(rec); }
    return out;
  }
  // the view as it is now (in player mode: the Studio camera at the player, looking where the player looks)
  function viewState() {
    const sc = S.scene, v = { tool: CR.tool, scope: CR.scope, hot: CR.hot.slice(), slot: CR.slot, rot: CR.rot, cut: S.cutLevel || 0 };
    const PM = CR.player;
    if (PM && PM.on) { v.center = [PM.pos[0], PM.pos[1] + 1, PM.pos[2]]; v.yaw = PM.yaw; v.pitch = 0.45; v.dist = 9; v.player = true; }
    else if (sc && sc.center) {
      v.center = sc.center.slice(); v.yaw = S.cam.yaw; v.pitch = S.cam.pitch; v.dist = S.cam.dist || 0;
      const f = S.cam.fly; if (f && !f.player) v.fly = { pos: f.pos.slice(), yaw: f.yaw, pitch: f.pitch, speed: f.speed || 8 };
    }
    if (CR.kind === 'item' && CR.item) { const it = CR.item; v.item = { tool: it.tool, brush: it.brush, round: it.round, mirror: it.mirror, mat: it.mat, color: it.color }; }
    return v;
  }
  function restoreView(v, sc) {
    if (!v || !sc) return;
    const num = Number.isFinite;
    if (Array.isArray(v.center) && v.center.length === 3 && v.center.every(num)) sc.center = v.center.slice();
    if (num(v.yaw)) S.cam.yaw = v.yaw;
    if (num(v.pitch)) S.cam.pitch = Math.max(-1.2, Math.min(1.45, v.pitch));
    if (num(v.dist) && v.dist >= 0) S.cam.dist = v.dist;
    if (v.fly && Array.isArray(v.fly.pos) && v.fly.pos.length === 3 && v.fly.pos.every(num)) S.cam.fly = { pos: v.fly.pos.slice(), yaw: +v.fly.yaw || 0, pitch: +v.fly.pitch || 0, speed: +v.fly.speed || 8 };
    if (CR.kind === 'house') {
      const d = sc.data;
      if (d && v.cut > 0 && v.cut <= d.storeys) { S.cutLevel = v.cut; S.clipY = d.floorY + v.cut * d.storeyH - 1.05; C.houseTools(); }
      if (Array.isArray(v.hot) && v.hot.length === CR.hot.length) CR.hot = v.hot.map((x, i) => (x === null ? null : x && R.byName[x] ? x : CR.hot[i]));
      if (Number.isInteger(v.slot) && v.slot >= 0 && v.slot < CR.hot.length) CR.slot = v.slot;
      if (Number.isInteger(v.rot)) CR.rot = v.rot & 3;
      if (SCOPES.some(s => s[0] === v.scope)) CR.scope = v.scope;
      if (v.tool === 'paint' || v.tool === 'area') setTool(v.tool);
    } else if (CR.kind === 'item' && CR.item && v.item) {
      const it = CR.item, w = v.item;
      if (TOOLS.some(t => t[0] === w.tool)) it.tool = w.tool;
      if ([1, 2, 3, 5, 8].includes(w.brush)) it.brush = w.brush;
      it.round = !!w.round; it.mirror = !!w.mirror;
      if (MATS.some(m => m[0] === w.mat)) it.mat = w.mat;
      if (/^#[0-9a-f]{6}$/i.test(w.color || '')) it.color = w.color;
    }
  }
  // a picture for 🕘: the whole house (or item) from the usual angle
  function shootProject(id) {
    const P = PJ(), sc = S.scene; if (!P || !sc || !P.get(id)) return;
    let c = null;
    try {
      if (CR.kind === 'house' && sc.type === 'craft' && CR.gpu) c = C.renderThumb(Object.assign({}, sc, { center: (sc.home || sc.center).slice() }), 480, 300, { yaw: 0.72, pitch: 0.36, dist: sc.span * 1.6 + 2 });
      else if (CR.kind === 'item' && sc.type === 'vedit') c = C.renderThumb(Object.assign({}, sc, { center: [sc.size[0] / 2, sc.size[1] / 2, sc.size[2] / 2] }), 480, 300, { yaw: 2.42, pitch: 0.4, dist: (sc.span * 2.4 + 2.2) * 0.62 });
    } catch (e) { c = null; }
    if (c) { P.thumb(id, c); shotAt.set(id, Date.now()); }
  }
  function shootSoon(id) {
    if (Date.now() - (shotAt.get(id) || 0) < 20000) return;
    shotAt.set(id, Date.now());
    requestAnimationFrame(() => { if (pid() === id) shootProject(id); });
  }
  // the player mode ends before the house changes: its view is the one to keep
  function endPlayer() { const PM = CR.player; if (PM && PM.on) { CR.viewAtLeave = viewState(); PM.exit(true); } }
  // everything about the open house that should survive: the pending draft, the view, a picture
  function keepWork(pic) {
    if (!CR.on) { CR.viewAtLeave = null; return; }
    if (draftT) saveDraft();
    const P = PJ(), id = pid(), view = CR.viewAtLeave || viewState(); CR.viewAtLeave = null;
    if (!P || !id) return;
    if (!P.get(id)) { P.sync(); if (!P.get(id)) return; }        // never changed: not a project (yet)
    P.put(id, { view }, { touch: false });
    if (pic) shootProject(id);
  }
  // 🗑 / "Spielversion laden": the draft goes; if it is open, the house comes back as the game has it
  function discardDraft(id) {
    const P = PJ(); if (!P) return;
    P.dropData(id);
    if (pid() === id) { clearTimeout(draftT); draftT = 0; draftDue = 0; if (CR.kind === 'house') { CR.house.dirty = false; openHouse(CR.house.index, { fresh: true }); } else { CR.item.dirty = false; openItem(CR.item.name, { fresh: true }); } }
  }
  // 🕘 opens a house or an item: straight from another one, or from any mode
  CR.resume = function (want) {
    if (S.mode === 'craft' && CR.on) {
      if (want.kind === 'house' && CR.kind === 'house' && CR.house && CR.house.index === want.idx) return;
      if (want.kind === 'item' && CR.kind === 'item' && CR.item && CR.item.name === want.name) return;
      return want.kind === 'item' ? openItem(want.name) : openHouse(want.idx);
    }
    CR.want = want; C.setMode('craft');
  };
  if (PJ()) {
    const P = PJ();
    P.kind('house', {
      icon: '🏠', label: L('pj.k.house', 'Haus'),
      state(p, st) {
        const i = p.ref ? p.ref.index : -1; if (!C.HOUSES.some(h => h.i === i)) return null;
        if (P.hasData(p.id)) return { live: true, status: 'wip', n: p.n || 0, sub: SA ? L('pj.wipSubSA', '{n} Änderungen · noch nicht gespeichert', { n: fmt(p.n || 0) }) : L('pj.wipSub', '{n} Änderungen · noch nicht im Spiel', { n: fmt(p.n || 0) }) };
        const sv = st.houses && st.houses[i];
        if (sv) { const n = sv.n || (sv.cells ? sv.cells.length : 0), what = n ? L('pj.changes', '{n} Änderungen', { n: fmt(n) }) : L('pj.facade', 'Fassade {s}', { s: (sv.skin || '') + (sv.mirror ? ' ⇋' : '') }); return { live: true, status: 'game', n, sub: what + ' · ' + (SA ? L('pj.savedSA', 'gespeichert') : L('pj.inGame', 'im Spiel')) }; }
        return { live: !!p.pin, status: 'orig', sub: L('pj.orig', 'Original') };
      },
      live(p) { const r = C.HOUSE.get(p.ref.index); return r && r.thumb; },
      open(p) { return CR.resume({ kind: 'house', idx: p.ref.index }); },
      delTip: (p, s) => (s.status === 'wip' ? (SA ? L('pj.delWipSA', 'Entwurf verwerfen und aus der Liste — was gespeichert ist, bleibt') : L('pj.delWip', 'Entwurf verwerfen und aus der Liste — was im Spiel ist, bleibt')) : (SA ? L('pj.delGameSA', 'Aus der Liste — gespeichert bleibt es (Crafter → Meine Designs entfernt es)') : L('pj.delGame', 'Aus der Liste — im Spiel bleibt es (Crafter → Meine Designs entfernt es dort)'))),
      discard(p) { discardDraft(p.id); P.dropThumb(p.id); P.put(p.id, { hide: true, pin: false }, { touch: false }); },
    });
    P.kind('item', {
      icon: '🪑', label: L('pj.k.item', 'Möbel'),
      state(p, st) {
        const n = p.ref && p.ref.name; if (!n || !VM.MODELS[n]) return null;
        if (P.hasData(p.id)) return { live: true, status: 'wip', n: p.n || 0, sub: SA ? L('pj.wipSubVSA', '{n} Voxel · noch nicht gespeichert', { n: fmt(p.n || 0) }) : L('pj.wipSubV', '{n} Voxel · noch nicht im Spiel', { n: fmt(p.n || 0) }) };
        if (st.models && st.models[n]) return { live: true, status: 'game', sub: SA ? L('pj.gameSubVSA', 'eigenes Design · gespeichert') : L('pj.gameSubV', 'eigenes Design · im Spiel') };
        return { live: !!p.pin, status: 'orig', sub: L('pj.orig', 'Original') };
      },
      live(p) { return C.thumbOf(p.ref.name); },
      open(p) { return CR.resume({ kind: 'item', name: p.ref.name }); },
      delTip: (p, s) => (s.status === 'wip' ? (SA ? L('pj.delWipSA', 'Entwurf verwerfen und aus der Liste — was gespeichert ist, bleibt') : L('pj.delWip', 'Entwurf verwerfen und aus der Liste — was im Spiel ist, bleibt')) : (SA ? L('pj.delGame2SA', 'Aus der Liste — gespeichert bleibt es') : L('pj.delGame2', 'Aus der Liste — im Spiel bleibt es'))),
      discard(p) { discardDraft(p.id); P.dropThumb(p.id); P.put(p.id, { hide: true, pin: false }, { touch: false }); },
    });
    P.onFlush((o) => keepWork(!!o.thumbs));
  }

  // ---------------------------------------------------------------- overlays: hovered block, ghost, lot outline
  const box12 = (b, x, y, z, e, c, out) => {
    const x0 = x + b[0] - e, y0 = y + b[1] - e, z0 = z + b[2] - e, x1 = x + b[3] + e, y1 = y + b[4] + e, z1 = z + b[5] + e;
    const P = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]];
    for (const [a, b2] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) out.push(...P[a], ...P[b2], c[0], c[1], c[2]);
  };
  HOOK.overlay = function (sc, eye, vp) {
    if (!CR.on) return;
    const segs = [];
    if (CR.kind === 'house' && CR.house) {
      const h = CR.house, y = h.F + 0.02, x0 = h.pad, z0 = h.pad, x1 = h.pad + h.lot[0], z1 = h.pad + h.lot[1], c = [1, 0.78, 0.28];
      segs.push(x0, y, z0, x1, y, z0, ...c, x1, y, z0, x1, y, z1, ...c, x1, y, z1, x0, y, z1, ...c, x0, y, z1, x0, y, z0, ...c);
      // where building ends (the lot and the ring around it): beyond it is the meadow
      const em = Math.min(EDGE, h.pad - 1), ex0 = h.pad - em, ez0 = h.pad - em, ex1 = h.pad + h.lot[0] + em, ez1 = h.pad + h.lot[1] + em, ce = [0.3, 0.72, 1], ye = h.F + 0.03;
      segs.push(ex0, ye, ez0, ex1, ye, ez0, ...ce, ex1, ye, ez0, ex1, ye, ez1, ...ce, ex1, ye, ez1, ex0, ye, ez1, ...ce, ex0, ye, ez1, ex0, ye, ez0, ...ce);
      const hv = CR.hover;
      if (hv && !hv.ground) for (const b of hv.boxes || [[0, 0, 0, 1, 1, 1]]) box12(b, hv.x, hv.y, hv.z, 0.004, [1, 1, 1], segs);
      if (hv && CR.ghost && !CR.areaMode) box12([0, 0, 0, 1, 1, 1], CR.ghost[0], CR.ghost[1], CR.ghost[2], -0.03, [0.36, 1, 0.8], segs);
      const AB = CR.areaMode && areaBox();
      if (AB) { box12([0, 0, 0, AB[3] - AB[0] + 1, AB[4] - AB[1] + 1, AB[5] - AB[2] + 1], AB[0], AB[1], AB[2], 0.02, [1, 0.84, 0.25], segs); const a = CR.area.a; box12([0, 0, 0, 1, 1, 1], a[0], a[1], a[2], 0.05, [1, 0.5, 0.15], segs); }
      C.drawLines(segs, vp, eye, true);
      // the paint preview glows (pulsing; brighter while you hold), everything of a kind also shows through walls
      if (pvMesh && CR.tool === 'paint') {
        const t = performance.now() / 1000, held = hold && !hold.quick ? Math.min(1, (performance.now() - hold.t0) / HOLD_MS) : 0;
        C.drawQuadMesh(pvMesh, vp, eye, pv && pv.same ? 0.22 : 0.3 + 0.12 * Math.sin(t * 5) + held * 0.35, CR.scope === 'all' ? 0.12 : 0);
      }
      if (flash) { const a = 1 - (performance.now() - flash.t0) / 450; if (a <= 0) { C.freeQuadMesh(flash.mesh); flash = null; } else C.drawQuadMesh(flash.mesh, vp, eye, 0.55 * a, 0); }
    } else if (CR.kind === 'item' && CR.item) {
      const it = CR.item, hv = CR.hover;
      if (hv) { const r = it.res, s = it.brush, x = hv.x - (s >> 1), y = hv.y - (s >> 1), z = hv.z - (s >> 1); box12([0, 0, 0, s / r, s / r, s / r], x / r, y / r, z / r, 0.002, [1, 1, 1], segs); }
      if (it.mirror) { const mx = it.W / 2; segs.push(mx, 0, 0, mx, it.H, 0, 0.36, 1, 0.8, mx, it.H, 0, mx, it.H, it.D, 0.36, 1, 0.8, mx, it.H, it.D, mx, 0, it.D, 0.36, 1, 0.8, mx, 0, it.D, mx, 0, 0, 0.36, 1, 0.8); }
      C.drawLines(segs, vp, eye, true);
    }
  };
  function updateHover(e) {
    if (CR.kind === 'house') {
      CR.hover = S.scene && S.scene.type === 'craft' ? pickBlock(rayFromMouse(e)) : null;
      CR.ghost = null;
      const hv = CR.hover;
      if (hv) { const cur = gGet(hv.x, hv.y, hv.z); CR.ghost = (!hv.ground && cur && (T.flags[cur] & F.REPLACE)) ? [hv.x, hv.y, hv.z] : [hv.x + FDX[hv.face], hv.y + FDY[hv.face], hv.z + FDZ[hv.face]]; }
      if (hv && !hv.ground) CR.lastHit = { x: hv.x, y: hv.y, z: hv.z };
      updatePreview();
      C.hud();
    } else if (CR.kind === 'item') { CR.hover = pickVoxel(rayFromMouse(e)); }
  }

  // ---------------------------------------------------------------- input: orbit / pan / fly, click = action
  let ptr = null;
  HOOK.pointer = function (e, type) {
    if (!CR.on) return false;
    const cv = C.view();
    { const r = $('main').getBoundingClientRect(); CR.mx = e.clientX - r.left; CR.my = e.clientY - r.top; }
    if (type === 'down') {
      ptr = { x: e.clientX, y: e.clientY, b: e.button, shift: e.shiftKey, moved: false }; try { cv.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
      if (CR.kind === 'house' && CR.tool === 'paint' && e.button === 0 && !e.shiftKey) { updateHover(e); paintDown(); }
      return true;
    }
    if (type === 'move') {
      if (!ptr) { updateHover(e); return true; }
      const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y;
      // a click may wobble a little (7 px) and still be a click; beyond that it turns / pans the view
      if (!ptr.moved && Math.hypot(dx, dy) < 7) return true;
      if (!ptr.moved) paintCancel();          // a drag turns the view — it never paints
      ptr.moved = true; ptr.x = e.clientX; ptr.y = e.clientY;
      if (S.cam.fly) { const f = S.cam.fly; f.yaw -= dx * 0.005 * S.sens; f.pitch = Math.max(-1.5, Math.min(1.5, f.pitch + dy * 0.005 * S.sens * S.vy())); }
      else if (ptr.shift || ptr.b === 1) C.CAM.pan(dx, dy);
      else C.CAM.rotate(dx, dy);
      return true;
    }
    if (type === 'up') {
      const p = ptr; ptr = null;
      if (p && !p.moved) {
        updateHover(e);
        const hv = CR.hover;
        if (CR.kind === 'house' && hv && CR.areaMode && (p.b === 0 || p.b === 2)) {
          const c = [hv.x, hv.y, hv.z];
          if (p.b === 0 || !CR.area || !CR.area.a) CR.area = { a: c, b: null, dy: 0 }; else { CR.area.b = c; CR.area.dy = 0; }
          const B = areaBox(); tip(B ? `${B[3] - B[0] + 1} × ${B[4] - B[1] + 1} × ${B[5] - B[2] + 1}` : L('cr.m.cornerA', 'Ecke 1'), true); C.parts();
        } else if (CR.kind === 'house' && CR.tool === 'paint') {
          if (p.b === 0 && !p.shift) paintUp(); else if (hv && !hv.ground && (p.b === 2 || p.b === 1)) pickAt(hv);
          updateHover(e);
        } else if (CR.kind === 'house' && hv) {
          if (p.b === 0) { if (!hv.ground) breakAt(hv); }
          // as the player (mouse not caught): a right click opens doors like in the game, Shift + right click places
          else if (p.b === 2) { if (!(CR.player && CR.player.on && !p.shift && (CR.player.sitAt(hv) || useAt(hv)))) placeAt(hv); }
          else if (p.b === 1 && !hv.ground) pickAt(hv);
          updateHover(e);
        }
        else if (CR.kind === 'item' && hv) { voxelClick(hv, p.b); updateHover(e); }
      }
      return true;
    }
    if (type === 'up') { paintCancel(); }
    if (type === 'leave') { CR.hover = null; CR.ghost = null; updatePreview(); }
    return true;
  };
  // in the Crafter a click builds, so a double-click is two clicks — no fly-to here (the wheel zooms to the pointer)
  HOOK.dblclick = function () { return !!CR.on; };
  // zoom-to-pointer aims at the block under the pointer
  HOOK.pickPoint = function (e) {
    if (!CR.on || CR.kind !== 'house' || S.cam.fly) return null;
    const h = pickBlock(rayFromMouse(e)); return h ? [h.px, h.py, h.pz] : null;
  };
  HOOK.wheel = function (e) {
    if (!CR.on) return false;
    if (CR.kind === 'house' && (e.shiftKey || e.altKey)) { CR.slot = (CR.slot + (e.deltaY > 0 ? 1 : 8)) % 9; drawBar(); C.hud(); return true; }
    if (S.cam.fly) { S.cam.fly.speed = Math.max(1, Math.min(40, (S.cam.fly.speed || 8) * (e.deltaY > 0 ? 0.85 : 1.18))); tip('Fluggeschwindigkeit ' + S.cam.fly.speed.toFixed(1)); return true; }
    return false;
  };
  HOOK.key = function (e, down) {
    if (!CR.on) return false;
    const k = e.key.toLowerCase();
    if (!down) { CR.keys[k] = false; return false; }
    if ((e.ctrlKey || e.metaKey) && k === 'z') { if (CR.kind === 'house') undo(e.shiftKey); else vUndo(e.shiftKey); return true; }
    if ((e.ctrlKey || e.metaKey) && k === 'y') { if (CR.kind === 'house') undo(true); else vUndo(true); return true; }
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    if (CR.kind === 'house' && /^[1-9]$/.test(k)) { CR.slot = +k - 1; drawBar(); C.hud(); return true; }
    if (CR.kind === 'house' && k === 'r') { turnNext(); return true; }
    if (k === '?' || k === 'f1') { showCard(); return true; }
    if ($('#craftCard') && $('#craftCard').classList.contains('on') && k === 'escape') { showCard(false); return true; }
    if (CR.kind === 'house' && k === 'b') { setTool('area'); return true; }
    if (CR.kind === 'house' && k === 't') { setTool('paint'); return true; }
    if (CR.kind === 'house' && k === 'tab' && CR.tool === 'paint') { const i = SCOPES.findIndex(x => x[0] === CR.scope); CR.scope = SCOPES[(i + (e.shiftKey ? 2 : 1)) % 3][0]; pvKey = ''; updatePreview(); drawTools(); tip(L(SCOPES.find(x => x[0] === CR.scope)[1], SCOPES.find(x => x[0] === CR.scope)[2]), true); return true; }
    if (CR.kind === 'house' && k === 'escape' && CR.tool === 'paint') { setTool('build'); return true; }
    if (CR.kind === 'house' && CR.areaMode) {
      if (k === 'f') { areaApply('fill'); return true; }
      if (k === 'g') { areaApply('walls'); return true; }
      if (k === 'h') { areaApply('hollow'); return true; }
      if (k === 'x' || k === 'delete' || k === 'backspace') { areaApply('clear'); return true; }
      if (k === '+' || k === '=' || k === 'pageup' || k === '-' || k === 'pagedown') { if (CR.area && CR.area.a) { CR.area.dy = (CR.area.dy || 0) + (k === '-' || k === 'pagedown' ? -1 : 1); const B = areaBox(); tip(`Höhe ${B[4] - B[1] + 1}`, true); C.parts(); } return true; }
      if (k === 'escape') { if (CR.area) { CR.area = null; C.parts(); tip(L('cr.area.none', 'Auswahl weg')); } else setTool('build'); return true; }
    }
    if (CR.kind === 'item' && k === 'x') { CR.item.mirror = !CR.item.mirror; C.list(); return true; }
    // the view without the mouse: arrows turn it, Bild ↑/↓ zoom (easier for some hands than dragging)
    if (!S.cam.fly && (k === 'arrowleft' || k === 'arrowright')) { C.CAM.rotate(k === 'arrowleft' ? -24 : 24, 0); return true; }
    if (!S.cam.fly && (k === 'arrowup' || k === 'arrowdown')) { C.CAM.rotate(0, k === 'arrowup' ? 18 : -18); return true; }
    if (!S.cam.fly && !CR.areaMode && (k === 'pageup' || k === 'pagedown')) { C.CAM.zoomAt(null, k === 'pageup' ? -160 : 160); return true; }
    if (k === 'f') { toggleFly(); return true; }
    if (k === 'escape' && S.cam.fly) { toggleFly(); return true; }
    if ('wasdqec '.includes(k) || k === 'shift') { CR.keys[k] = true; return !!S.cam.fly || 'wasdqe'.includes(k); }
    return false;
  };
  // R (or ↻ on the hotbar): the next piece turns a quarter
  function turnNext() { CR.rot = (CR.rot + 1) & 3; drawBar(); tip(L('cr.turned', 'Nächstes Teil gedreht: {d}°', { d: CR.rot * 90 })); }
  function toggleFly() {
    const sc = S.scene; if (!sc) return;
    if (S.cam.fly) { S.cam.fly = null; drawHelp(); tip('Orbit-Kamera'); return; }
    const cv = C.view(), cam = C.camFor(sc, S.cam, cv.clientWidth, cv.clientHeight), eye = cam.eye, tg = cam.target;
    S.cam.fly = { pos: eye.slice(), yaw: Math.atan2(-(tg[0] - eye[0]), -(tg[2] - eye[2])), pitch: Math.atan2(tg[1] - eye[1], Math.hypot(tg[0] - eye[0], tg[2] - eye[2])), speed: CR.kind === 'item' ? 2 : 8 };
    drawHelp(); tip('Flug-Kamera: WASD bewegen, Q/E runter/hoch, Ziehen schaut, F zurück');
  }
  let lastT = performance.now();
  HOOK.tick = function () {
    const now = performance.now(), dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    if (!CR.on) return;
    paintTick();
    const K = CR.keys;
    if (S.cam.fly && !S.cam.fly.player) {
      const f = S.cam.fly, sp = (f.speed || 8) * dt, fx = -Math.sin(f.yaw), fz = -Math.cos(f.yaw);
      if (K.w) { f.pos[0] += fx * sp; f.pos[2] += fz * sp; } if (K.s) { f.pos[0] -= fx * sp; f.pos[2] -= fz * sp; }
      if (K.a) { f.pos[0] += fz * sp; f.pos[2] -= fx * sp; } if (K.d) { f.pos[0] -= fz * sp; f.pos[2] += fx * sp; }
      if (K.e || K[' ']) f.pos[1] += sp; if (K.q || K.c) f.pos[1] -= sp;
    } else if (S.scene && (K.w || K.a || K.s || K.d || K.q || K.e)) {
      // WASD pans the orbit centre over the ground, Q/E lower/raise it
      const sc = S.scene, sp = Math.max(2, sc.span) * dt * 0.6, fx = -Math.sin(S.cam.yaw), fz = -Math.cos(S.cam.yaw);
      if (K.w) { sc.center[0] += fx * sp; sc.center[2] += fz * sp; } if (K.s) { sc.center[0] -= fx * sp; sc.center[2] -= fz * sp; }
      if (K.a) { sc.center[0] += fz * sp; sc.center[2] -= fx * sp; } if (K.d) { sc.center[0] -= fz * sp; sc.center[2] += fx * sp; }
      if (K.e) sc.center[1] += sp; if (K.q) sc.center[1] -= sp;
    }
  };

  // ---------------------------------------------------------------- HUD + right panel
  HOOK.hud = function () {
    if (!CR.on) return false;
    if (CR.kind === 'house' && CR.house) {
      const h = CR.house, d = houseDiffCount();
      $('#hudName').textContent = h.name;
      const hv = CR.hover, tgt = hv && !hv.ground && hv.state ? nameOf(R.types[T.type[hv.state]].name) : '';
      $('#hudMeta').innerHTML = `<span class="chip" title="${L('cr.changes', 'Änderungen')}">${IC('pencil', 13)}<b>${fmt(d)}</b></span>`
        + (h.dirty ? `<span class="chip warn" title="${SA ? L('cr.unsavedSA', 'noch nicht gespeichert') : L('cr.unsaved', 'noch nicht im Spiel')}">${IC('upload', 13)}</span><span class="chip saved${draftT ? ' busy' : ''}" title="${draftT ? L('cr.saving', 'wird gleich gesichert …') : L('cr.autosaved', 'Entwurf gesichert — nichts geht verloren · 🕘 Strg+O')}">${IC('save', 13)}${draftT ? '…' : ''}</span>` : h.savedAt ? `<span class="chip good" title="${SA ? L('cr.savedSA', 'gespeichert') : L('cr.saved', 'im Spiel')}">${IC('check', 13)}</span>` : '')
        + `<span class="chip" title="${L('cr.height', 'Bauhöhe über dem Boden')}">${IC('height', 13)}<b>${h.sy - h.F}</b></span>`
        + (tgt ? `<span class="chip tgt">${IC('eye', 13)}${tgt}</span>` : '');
      return true;
    }
    if (CR.kind === 'item' && CR.item) {
      const it = CR.item;
      $('#hudName').textContent = 'Crafter · ' + it.display;
      $('#hudMeta').innerHTML = `<b>${it.W}×${it.H}×${it.D}</b> Blöcke · 1/${it.res} · <b>${fmt(it.changed || 0)}</b> Voxel geändert${it.dirty ? ` · <span class="warn">${SA ? L('cr.itemDraftSA', 'Entwurf gesichert, noch nicht gespeichert') : L('cr.itemDraft', 'Entwurf gesichert, noch nicht im Spiel')}</span>` : it.savedAt ? ` · <span class="good">${SA ? L('cr.savedSA', 'gespeichert') : L('cr.saved', 'im Spiel')}</span>` : ''} · Werkzeug <b>${TOOLS.find(t => t[0] === it.tool)[1]}</b>`;
      return true;
    }
    return false;
  };
  let diffMemo = { n: 0, at: -1 };
  function houseDiffCount() {
    const h = CR.house; if (!h) return 0;
    const ver = CR.ver || 0;
    if (diffMemo.at === ver && diffMemo.h === h) return diffMemo.n;
    const po = CU.playOnly || (() => false);
    let n = 0; for (let i = 0; i < h.blocks.length; i++) if (h.blocks[i] !== h.base[i] && !po(h.blocks[i], h.base[i])) n++;
    diffMemo = { n, at: ver, h }; return n;
  }
  HOOK.parts = function () {
    if (!CR.on) return false;
    const el = $('#partsBody'); el.innerHTML = ''; el.classList.remove('empty');
    const H = (t, b) => { const d = document.createElement('div'); d.className = 'ph'; d.innerHTML = t + (b !== undefined ? ' <b>' + b + '</b>' : ''); el.appendChild(d); };
    const btn = (label, cls, fn, title) => { const b = document.createElement('button'); b.className = 'cbtn ' + (cls || ''); b.innerHTML = label; if (title) b.title = title; b.onclick = fn; return b; };
    const row = (...bs) => { const r = document.createElement('div'); r.className = 'crow'; for (const b of bs) r.appendChild(b); el.appendChild(r); };
    if (CR.kind === 'house' && CR.house) {
      const h = CR.house, n = houseDiffCount();
      H(IC('house', 15) + ' ' + h.name);
      // one big button that says what it does; it glows while there is something new to take into the game
      row(saveButton(!h.dirty && h.savedAt, h.dirty, updateHouse, L('cr.save.tip3', 'Neue Städte bauen dein Haus genau so — schon stehende bleiben, wie sie sind')));
      // small things as pictures: back, forward, original, leave
      const ib = (icon, title, fn, cls) => btn(IC(icon, 20), 'ico ' + (cls || ''), fn, title);
      let armed = 0;
      const reset = ib('reset', L('cr.reset', 'Original (alles zurück)'), () => { if (Date.now() - armed < 2500) { resetHouse(); return; } armed = Date.now(); reset.classList.add('arm'); reset.innerHTML = IC('check', 20); tip(L('cr.reset.again', 'Nochmal klicken: zurück zum Original'), false); setTimeout(() => { reset.classList.remove('arm'); reset.innerHTML = IC('reset', 20); }, 2500); });
      const close = ib('close', CR.origin ? originLabel(CR.origin) : L('cr.leave', 'Crafter schließen'), () => CR.back()); close.dataset.act = 'close';
      row(ib('undo', L('cr.undo', 'Zurück') + ' (Strg+Z)', () => undo(false)), ib('redo', L('cr.redo', 'Vor') + ' (Strg+Y)', () => undo(true)), reset, close);
      const st = document.createElement('div'); st.className = 'chips3';
      st.innerHTML = `<span title="${L('cr.changes', 'Änderungen')}">${IC('pencil', 15)}<b>${fmt(n)}</b></span><span title="${L('cr.height', 'Bauhöhe über dem Boden')}">${IC('height', 15)}<b>${h.sy - h.F}</b></span><span title="${L('cr.skin', 'Fassade')}">${IC('palette', 15)}<b>${h.skin}${h.mirror ? ' ⇋' : ''}</b></span>`;
      el.appendChild(st);
      // unsaved work is safe: say so, and offer the way back to what the game has
      if (h.dirty) {
        const nt = document.createElement('div'); nt.className = 'note dim draftNote';
        nt.innerHTML = IC('save', 14) + ' ' + (SA ? L('cr.draftNoteSA', 'Entwurf — automatisch gesichert. Fest gespeichert erst mit 💾 Speichern.') : L('cr.draftNote', 'Entwurf — automatisch gesichert. Ins Spiel kommt er erst mit „Ins Spiel“.'));
        el.appendChild(nt);
        if (h.savedAt && PJ() && PJ().hasData('h:' + h.index)) {
          let armG = 0;
          const g = btn(IC('undo', 16) + `<span>${SA ? L('cr.toSaved', 'Gespeicherte Version laden') : L('cr.toGame', 'Spielversion laden')}</span>`, '', () => {
            if (Date.now() - armG < 2600) { discardDraft('h:' + h.index); tip(SA ? L('cr.toSavedDone', 'Zurück zur gespeicherten Version — der Entwurf ist weg') : L('cr.toGameDone', 'Zurück zur Spielversion — der Entwurf ist weg'), true); return; }
            armG = Date.now(); g.classList.add('arm'); tip(SA ? L('cr.toSavedAgain', 'Nochmal klicken: Entwurf verwerfen, gespeicherte Version laden') : L('cr.toGameAgain', 'Nochmal klicken: Entwurf verwerfen, Spielversion laden'), false);
            setTimeout(() => g.classList.remove('arm'), 2600);
          }, SA ? L('cr.toSavedT', 'Den Entwurf verwerfen und das Haus so laden, wie es gespeichert ist') : L('cr.toGameT', 'Den Entwurf verwerfen und das Haus so laden, wie es im Spiel steht'));
          row(g);
        }
      }
      designList(el, H, btn, row);
      return true;
    }
    if (CR.kind === 'item' && CR.item) { itemPanel(el, H, btn, row); designList(el, H, btn, row); return true; }
    return true;
  };
  // the big button: "⬆ Ins Spiel" (the Studio in the game) or "💾 Speichern" (the standalone Studio); ✓ once it is done
  function saveButton(saved, dirty, fn, tipGame) {
    const b = document.createElement('button');
    b.className = 'cbtn big ' + (saved ? 'done' : 'pri') + (dirty ? ' glow' : ''); b.dataset.act = 'save';
    b.innerHTML = SA ? (saved ? IC('check', 22) + `<span>${L('cr.savedSA2', 'Gespeichert')}</span>` : `💾 <span>${L('cr.saveSA2', 'Speichern')}</span>`)
      : saved ? IC('check', 22) + `<span>${L('cr.saved', 'Im Spiel')}</span>` : IC('upload', 22) + `<span>${L('cr.save', 'Ins Spiel')}</span>`;
    b.title = SA ? SAVE_TIP : tipGame; b.onclick = fn;
    return b;
  }
  // 🗑 asks twice (like ↺ Original): the first click arms it, the second within 2½ s removes
  function delButton(btn, fn, title) {
    let armed = 0;
    const b = btn(IC('trash', 16), 'mini', () => {
      if (Date.now() - armed < 2600) { fn(); return; }
      armed = Date.now(); b.classList.add('arm'); b.innerHTML = IC('check', 16); tip(L('cr.del.again', 'Nochmal klicken: Design entfernen (Original zurück)'), false);
      setTimeout(() => { if (b.isConnected) { b.classList.remove('arm'); b.innerHTML = IC('trash', 16); } }, 2600);
    }, title);
    b.dataset.act = 'del';
    return b;
  }
  // every saved design, with open / remove
  function designList(el, H, btn, row) {
    const st = store(), hs = Object.values(st.houses || {}), ms = Object.keys(st.models || {}), P = PJ();
    // unfinished work that never went into the game is listed too
    const drafts = P ? P.list().filter(x => x.s.status === 'wip' && ((x.p.kind === 'house' && !(st.houses || {})[x.p.ref.index]) || (x.p.kind === 'item' && !(st.models || {})[x.p.ref.name]))) : [];
    H(IC('palette', 15) + ' ' + L('cr.designs', 'Meine Designs'), hs.length + ms.length + drafts.length);
    if (P) row(btn(IC('clock', 18) + `<span>${L('pj.title', 'Weitermachen')}</span><kbd>Strg+O</kbd>`, 'hubBtn', () => P.show(true), L('pj.tip', 'Alles, was du angefangen hast — mit Bild, das Letzte zuerst')));
    if (!hs.length && !ms.length && !drafts.length) { const p = document.createElement('div'); p.className = 'note dim'; p.textContent = L('cr.designs.none', 'Noch keine.'); el.appendChild(p); }
    const when = (t) => new Date(t || 0).toLocaleString(VR.I18N && VR.I18N.locale ? VR.I18N.locale() : 'de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const wip = (id) => (P && P.hasData(id) ? ` · <span class="warn">✎ ${L('pj.wip', 'in Arbeit')}</span>` : '');
    for (const x of drafts) {
      const p = x.p, d = document.createElement('div'); d.className = 'design';
      d.innerHTML = `<span class="ic">${IC(p.kind === 'house' ? 'house' : 'cube', 18)}</span><span class="n">${esc(P.nameOf(p))}<small><span class="warn">✎ ${L('pj.wip', 'in Arbeit')}</span> · ${fmt(p.n || 0)} · ${when(p.t)}</small></span>`;
      d.appendChild(btn(IC('arrow', 16), 'mini', () => CR.resume(p.kind === 'house' ? { kind: 'house', idx: p.ref.index } : { kind: 'item', name: p.ref.name }), L('cr.open', 'öffnen')));
      el.appendChild(d);
    }
    for (const hh of hs) {
      const d = document.createElement('div'); d.className = 'design';
      const cnt = designCount(hh), what = cnt ? IC('pencil', 11) + ' ' + fmt(cnt) : IC('palette', 11) + ' ' + esc(hh.skin || '') + (hh.mirror ? ' ⇋' : '');
      d.innerHTML = `<span class="ic">${IC('house', 18)}</span><span class="n">${esc(hh.name)}<small>${what} · ${when(hh.t)}${wip('h:' + hh.index)}</small></span>`;
      d.appendChild(btn(IC('arrow', 16), 'mini', () => openHouse(hh.index), L('cr.open', 'öffnen')));
      d.appendChild(delButton(btn, () => { const s2 = store(); delete s2.houses[hh.index]; if (!saveStore(s2)) { tip(L('cr.saveFail', 'Speichern fehlgeschlagen — der Browser-Speicher ist voll'), false); return; } if (CR.house && CR.house.index === hh.index) CR.house.savedAt = 0; C.rebuildHouse(hh.index, {}); tip(hh.name + ' → ' + L('cr.original', 'Original'), true); C.parts(); }, L('cr.remove', 'Design entfernen (Original zurück)')));
      el.appendChild(d);
    }
    for (const n of ms) {
      const m = VM.MODELS[n], d = document.createElement('div'); d.className = 'design';
      d.innerHTML = `<span class="ic">${IC('cube', 18)}</span><span class="n">${m ? m.display : n}<small>${when(st.models[n].t)}${wip('m:' + n)}</small></span>`;
      d.appendChild(btn(IC('arrow', 16), 'mini', () => openItem(n), L('cr.open', 'öffnen')));
      d.appendChild(delButton(btn, () => { const s2 = store(); delete s2.models[n]; if (!saveStore(s2)) { tip(L('cr.saveFail', 'Speichern fehlgeschlagen — der Browser-Speicher ist voll'), false); return; } CU.applyModel(n, null); C.THUMB.delete(n); if (CR.item && CR.item.name === n) openItem(n); tip((m ? m.display : n) + ' → ' + L('cr.original', 'Original'), true); C.parts(); }, L('cr.remove', 'Design entfernen (Original zurück)')));
      el.appendChild(d);
    }
    // everything in one file: 📦 Mitnehmen (to the other Studio, to the game) · 📥 Übernehmen (a file from there)
    const BR = VR.StudioBridge;
    if (BR) row(btn(`📦 <span>${L('br.out', 'Mitnehmen')}</span>`, '', () => BR.exportPack(), L('br.outT', 'Favoriten, Designs und Bauteile als eine Datei — für das Spiel oder ein anderes Studio')), btn(`📥 <span>${L('br.in', 'Übernehmen')}</span>`, '', () => BR.pickFile(), L('br.inT', 'Ein R9-Paket (.json) übernehmen — oder die Datei einfach hierher ziehen')));
    if (BR && VR.Legal) { const p = document.createElement('div'); p.className = 'note dim share'; p.textContent = VR.Legal.shareHint(); el.appendChild(p); }   // one line, no dialog (src/main/legal.js)
  }

  // ================================================================ ITEM CRAFTER (voxel models)
  const TOOLS = [['paint', 'Malen', '🖌'], ['add', 'Anbauen', '＋'], ['erase', 'Radieren', '⌫'], ['fill', 'Umfärben', '◍'], ['pick', 'Pipette', '⌖']];
  const MATS = [['matte', 'Matt'], ['gloss', 'Lack'], ['fabric', 'Stoff'], ['velvet', 'Samt'], ['leather', 'Leder'], ['wood', 'Holz'], ['marble', 'Marmor'], ['metal', 'Metall'], ['stone', 'Stein'], ['plant', 'Pflanze'], ['glass', 'Glas'], ['light', 'Leuchtend']];
  const MAT_OF = (v) => { const fl = v >>> 24; void fl; if (v & VX.GLASS) return 'glass'; if (v & VX.EMIS) return 'light'; const mb = (v >>> 0) & ~0xffffff & ~(VX.PRESENT | VX.GLASS | VX.EMIS | VX.GLOSS); for (const [m] of MATS) { if (m === 'matte' || m === 'gloss' || m === 'glass' || m === 'light') continue; const p = VM.M[m](0); if (((p >>> 0) & ~0xffffff & ~(VX.PRESENT | VX.GLOSS)) === mb && mb) return m; } return (v & VX.GLOSS) ? 'gloss' : 'matte'; };
  function openItem(name, opt) {
    const m = VM.MODELS[name]; if (!m) return;
    endPlayer(); keepWork(true);          // whatever was open keeps its unsaved work
    if (CR.gpu) { C.freeSections([...CR.gpu.values()]); CR.gpu = null; }   // a house that was open
    CR.house = null; CR.area = null;
    const res = m.res, VW = m.VW, VH = m.VH, VD = m.VD, V = new Uint32Array(VW * VH * VD);
    for (let i = 0; i < V.length; i++) { const k = m.vol[i]; if (k) V[i] = m.pal[k]; }
    const orig = V.slice();       // what the game has
    // unsaved work from last time
    const P = PJ(), id = 'm:' + name, d = !(opt && opt.fresh) && P ? P.data(id) : null;
    let resumed = false;
    if (d && d.rle && d.W === m.W && d.H === m.H && d.D === m.D && d.res === m.res && Array.isArray(d.pal)) {
      try { const idx = CU.unrle(new Uint16Array(CU.unb64(d.rle).buffer), V.length); for (let i = 0; i < V.length; i++) { const k = idx[i]; V[i] = k ? (d.pal[k] >>> 0) : 0; } resumed = true; } catch (e) { V.set(orig); }
    }
    const st = store().models[name];
    CR.item = { name, display: m.display || name, m, res, W: m.W, H: m.H, D: m.D, VW, VH, VD, V, orig, tool: 'paint', brush: 1, round: false, mirror: false, mat: 'fabric', color: '#3a6fd8', changed: 0, dirty: resumed, savedAt: st ? st.t : 0, vundo: [], vredo: [] };
    // the original (registry) volume, for "Original"
    CR.item.base = null;
    enterUI('item');
    S.facing = 0; for (const x of $$('[data-face]')) x.classList.toggle('on', x.dataset.face === '0');
    remeshItem(true);
    const pj = P && P.get(id);
    if (pj && pj.view && !(opt && opt.fresh)) restoreView(pj.view, S.scene);
    if (resumed && d.undo) CR.item.vundo = unpackVUndo(d.undo, V.length);
    countItem();
    C.list(); C.parts(); C.hud(); drawHelp();
    if (resumed) tip(SA ? L('cr.resumedItemSA', 'Weiter, wo du warst — {n} Voxel, noch nicht gespeichert', { n: fmt(CR.item.changed) }) : L('cr.resumedItem', 'Weiter, wo du warst — {n} Voxel, noch nicht im Spiel', { n: fmt(CR.item.changed) }), true);
    if (pj) P.seen(id);
  }
  // the edited volume as a compiled model (same parts and states as the original)
  function itemModel() {
    const it = CR.item, m = it.m, V = it.V, palMap = new Map([[0, 0]]), pal = [0], idx = new Uint16Array(V.length);
    for (let i = 0; i < V.length; i++) { const v = V[i]; if (!v) continue; let k = palMap.get(v); if (k === undefined) { k = pal.length; pal.push(v); palMap.set(v, k); } idx[i] = k; }
    const tmp = { name: m.name, display: m.display, def: m.def, W: m.W, H: m.H, D: m.D, res: m.res, VW: m.VW, VH: m.VH, VD: m.VD, at: m.at, parts: m.parts.map(p => ({ px: p.px, py: p.py, pz: p.pz, bounds: p.bounds.slice() })), col: m.col, vox: 0 };
    CU.setVolume(tmp, idx, Uint32Array.from(pal));
    return { tmp, idx, pal };
  }
  function remeshItem(first) {
    const it = CR.item; if (!it) return;
    const { tmp } = itemModel();
    const mesh = C.meshModel(tmp, 0);
    const sz = [it.W, it.H, it.D];
    const sc = { type: 'vedit', name: it.name, model: tmp, mesh, center: first || !S.scene || S.scene.type !== 'vedit' ? [sz[0] / 2, sz[1] / 2, sz[2] / 2] : S.scene.center, span: Math.max(sz[0], sz[1], sz[2]), size: sz, ms: 0 };
    if (first) { C.setScene(sc); S.cam.yaw = 2.42; S.cam.pitch = 0.42; S.cam.dist = sc.span * 1.55 + 1.2; }
    else { S.scene = sc; C.uploadVM(mesh); }
  }
  const vI = (x, y, z) => { const it = CR.item; return (y * it.VD + z) * it.VW + x; };
  const vIn = (x, y, z) => { const it = CR.item; return x >= 0 && y >= 0 && z >= 0 && x < it.VW && y < it.VH && z < it.VD; };
  // only cells that are parts of the model hold voxels (the parts are the model's block states in the game)
  const vCellOK = (x, y, z) => { const it = CR.item, r = it.res; return it.m.at.has(Math.floor(x / r) + ',' + Math.floor(y / r) + ',' + Math.floor(z / r)); };
  function pickVoxel(ray) {
    const it = CR.item; if (!it) return null;
    const r = it.res, [ox, oy, oz] = ray.o.map(v => v * r), [dx, dy, dz] = ray.d;
    const B = [0, 0, 0, it.VW, it.VH, it.VD];
    const hb = PH.rayBox(ox, oy, oz, dx, dy, dz, B, 0, 0, 0); if (!hb) return null;
    let t = hb[0] + 1e-4, px = ox + dx * t, py = oy + dy * t, pz = oz + dz * t;
    let x = Math.min(it.VW - 1, Math.floor(px)), y = Math.min(it.VH - 1, Math.floor(py)), z = Math.min(it.VD - 1, Math.floor(pz));
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const tdx = Math.abs(1 / dx), tdy = Math.abs(1 / dy), tdz = Math.abs(1 / dz);
    let tx = (dx > 0 ? (x + 1 - px) : (px - x)) * tdx, ty = (dy > 0 ? (y + 1 - py) : (py - y)) * tdy, tz = (dz > 0 ? (z + 1 - pz) : (pz - z)) * tdz;
    let face = hb[1];
    for (let i = 0; i < 2000; i++) {
      if (!vIn(x, y, z)) return null;
      if (it.V[vI(x, y, z)]) return { x, y, z, face, v: it.V[vI(x, y, z)] };
      if (tx < ty && tx < tz) { x += sx; tx += tdx; face = sx > 0 ? 1 : 0; } else if (ty < tz) { y += sy; ty += tdy; face = sy > 0 ? 3 : 2; } else { z += sz; tz += tdz; face = sz > 0 ? 5 : 4; }
    }
    return null;
  }
  function curVoxel() { const it = CR.item, c = parseInt(it.color.slice(1), 16); return (VM.M[it.mat] || VM.M.matte)(c) >>> 0; }
  function brushCells(cx, cy, cz) {
    const it = CR.item, s = it.brush, o = s >> 1, out = [];
    for (let y = 0; y < s; y++) for (let z = 0; z < s; z++) for (let x = 0; x < s; x++) {
      if (it.round && s > 2) { const ddx = x - (s - 1) / 2, ddy = y - (s - 1) / 2, ddz = z - (s - 1) / 2; if (ddx * ddx + ddy * ddy + ddz * ddz > (s / 2) * (s / 2)) continue; }
      out.push([cx - o + x, cy - o + y, cz - o + z]);
    }
    if (it.mirror) for (const c of out.slice()) out.push([it.VW - 1 - c[0], c[1], c[2]]);
    return out;
  }
  function vApply(list) {
    const it = CR.item, rec = [];
    for (const [x, y, z, v] of list) { if (!vIn(x, y, z)) continue; if (v && !vCellOK(x, y, z)) continue; const i = vI(x, y, z); if (it.V[i] === v) continue; rec.push([i, it.V[i], v]); it.V[i] = v; }
    if (!rec.length) return;
    it.vundo.push(rec); if (it.vundo.length > 200) it.vundo.shift(); it.vredo = [];
    it.dirty = true; countItem(); remeshItem(false); draftSoon(); C.hud(); C.parts(); C.list();
  }
  function countItem() { const it = CR.item; let n = 0; for (let i = 0; i < it.V.length; i++) if (it.V[i] !== it.orig[i]) n++; it.changed = n; }
  function vUndo(redo) {
    const it = CR.item; if (!it) return;
    const rec = (redo ? it.vredo : it.vundo).pop(); if (!rec) return;
    (redo ? it.vundo : it.vredo).push(rec);
    for (const [i, a, b] of rec) it.V[i] = redo ? b : a;
    it.dirty = true; countItem(); remeshItem(false); draftSoon(); C.hud(); C.parts();
  }
  function voxelClick(hv, button) {
    const it = CR.item;
    let tool = it.tool;
    if (button === 2) tool = 'add'; else if (button === 1) tool = 'pick';
    if (tool === 'pick') { const v = hv.v; it.color = '#' + (v & 0xffffff).toString(16).padStart(6, '0'); it.mat = MAT_OF(v); C.list(); tip('Farbe aufgenommen', true); return; }
    if (tool === 'fill') {
      // recolour every voxel of exactly this colour + material (a whole fabric, all wood parts …)
      const from = hv.v, to = curVoxel(), list = [];
      for (let i = 0; i < it.V.length; i++) if (it.V[i] === from) { const x = i % it.VW, z = Math.floor(i / it.VW) % it.VD, y = Math.floor(i / (it.VW * it.VD)); list.push([x, y, z, to]); }
      vApply(list); tip(fmt(list.length) + ' Voxel umgefärbt', true); return;
    }
    if (tool === 'add') { const c = [hv.x + FDX[hv.face], hv.y + FDY[hv.face], hv.z + FDZ[hv.face]]; const v = curVoxel(); vApply(brushCells(c[0], c[1], c[2]).filter(p => vIn(...p) && !it.V[vI(...p)]).map(p => [p[0], p[1], p[2], v])); return; }
    if (tool === 'erase') { vApply(brushCells(hv.x, hv.y, hv.z).filter(p => vIn(...p)).map(p => [p[0], p[1], p[2], 0])); return; }
    // paint: only voxels that exist
    const v = curVoxel(); vApply(brushCells(hv.x, hv.y, hv.z).filter(p => vIn(...p) && it.V[vI(...p)]).map(p => [p[0], p[1], p[2], v]));
  }
  // left side in item mode: tools, brush, material, colour, the model's own colours
  function itemTools(el) {
    const it = CR.item; if (!it) return;
    const sec = (t) => { const d = document.createElement('div'); d.className = 'grp'; d.textContent = t; el.appendChild(d); };
    const seg = (items, cur, fn) => { const d = document.createElement('div'); d.className = 'seg'; for (const [v, label, ic] of items) { const b = document.createElement('button'); b.className = v === cur ? 'on' : ''; b.innerHTML = (ic ? '<i>' + ic + '</i>' : '') + label; b.onclick = () => { fn(v); C.list(); C.hud(); }; d.appendChild(b); } el.appendChild(d); };
    sec('Werkzeug'); seg(TOOLS, it.tool, (v) => { it.tool = v; });
    sec('Pinsel'); seg([[1, '1'], [2, '2'], [3, '3'], [5, '5'], [8, '8']], it.brush, (v) => { it.brush = v; });
    seg([[false, 'Würfel'], [true, 'Kugel'], ['m', it.mirror ? 'Spiegel X ✓' : 'Spiegel X']], it.round, (v) => { if (v === 'm') it.mirror = !it.mirror; else it.round = v; });
    sec('Material'); seg(MATS, it.mat, (v) => { it.mat = v; });
    sec('Farbe');
    const row = document.createElement('div'); row.className = 'colrow';
    const ci = document.createElement('input'); ci.type = 'color'; ci.value = it.color; ci.oninput = () => { it.color = ci.value; sw.style.background = ci.value; };
    const sw = document.createElement('span'); sw.className = 'cur'; sw.style.background = it.color;
    row.appendChild(ci); row.appendChild(sw); el.appendChild(row);
    sec('Farben des Modells');
    const pal = new Map(); for (let i = 0; i < it.V.length; i++) { const v = it.V[i]; if (v) pal.set(v, (pal.get(v) || 0) + 1); }
    const sws = document.createElement('div'); sws.className = 'swatches';
    for (const [v, n] of [...pal.entries()].sort((a, b) => b[1] - a[1]).slice(0, 48)) {
      const b = document.createElement('button'); b.style.background = '#' + (v & 0xffffff).toString(16).padStart(6, '0'); b.title = MAT_OF(v) + ' · ' + fmt(n) + ' Voxel';
      if (v & VX.GLASS) b.classList.add('glass'); if (v & VX.EMIS) b.classList.add('light');
      b.onclick = () => { it.color = '#' + (v & 0xffffff).toString(16).padStart(6, '0'); it.mat = MAT_OF(v); C.list(); };
      sws.appendChild(b);
    }
    el.appendChild(sws);
    const p = document.createElement('div'); p.className = 'note dim'; p.innerHTML = '<b>Umfärben</b> färbt alle Voxel genau dieser Farbe auf einmal — ideal, um den Stoff, das Holz oder das Metall eines Möbels zu tauschen.'; el.appendChild(p);
  }
  function itemPanel(el, H, btn, row) {
    const it = CR.item;
    H('Crafter · Item', esc(it.display));
    row(saveButton(!it.dirty && it.savedAt, it.dirty, updateItem, L('cr.saveItemT', 'Das Item sieht überall im Spiel so aus — auch wo es schon steht')));
    const kv = document.createElement('div'); kv.className = 'kv';
    kv.innerHTML = `<span>Modell</span><b>${esc(it.name)}</b><span>Größe</span><b>${it.W} × ${it.H} × ${it.D} Blöcke · ${it.res}³ Voxel je Block</b><span>Geändert</span><b>${fmt(it.changed || 0)} Voxel</b><span>${SA ? L('cr.kvSavedSA', 'Gespeichert') : L('cr.kvSaved', 'Im Spiel')}</span><b>${it.savedAt ? L('cr.ownDesign', 'eigenes Design') : 'Original'}${it.dirty ? ' · ✎ ' + L('cr.draftAuto', 'Entwurf (automatisch gesichert)') : ''}</b>`;
    el.appendChild(kv);
    row(btn('⟲ Rückgängig', '', () => vUndo(false), 'Strg+Z'), btn('⟳ Wiederholen', '', () => vUndo(true), 'Strg+Y'));
    const x = btn('✕ ' + (CR.origin ? esc(originLabel(CR.origin).replace(/^← /, '')) : L('cr.leave', 'Crafter schließen')), '', () => CR.back(), L('cr.backT', 'Zurück, wo du warst')); x.dataset.act = 'close';
    row(btn('↺ Original', '', resetItem, 'Alle Voxel-Änderungen zurücknehmen'), x);
  }
  function updateItem() {
    const it = CR.item; if (!it) return;
    clearTimeout(draftT); draftT = 0; draftDue = 0;
    const { tmp, idx, pal } = itemModel(), st = store(), P = PJ(), id = 'm:' + it.name;
    let same = true; const o = VM.MODELS[it.name];
    // compare with the compiled original source (not with an earlier design)
    const fresh = VM.compile(it.name, o.def ? o.def.o : o.def);
    for (let i = 0; i < it.V.length && same; i++) { const k = fresh.vol[i]; if ((k ? fresh.pal[k] : 0) !== it.V[i]) same = false; }
    if (same) {
      delete st.models[it.name];
      if (!saveStore(st)) { tip(L('cr.saveFail', 'Speichern fehlgeschlagen — der Browser-Speicher ist voll'), false); draftSoon(); return; }
      CU.applyModel(it.name, null); it.savedAt = 0; it.dirty = false; it.orig = it.V.slice(); countItem(); if (P) { P.dropData(id); if (P.get(id)) P.put(id, { n: 0 }); }
      tip(SA ? L('cr.sameSA', 'Wie das Original — gespeichert ist das Original') : L('cr.same2', 'Wie das Original — im Spiel steht wieder das Original'), true); C.THUMB.delete(it.name); C.parts(); C.hud(); return;
    }
    st.models[it.name] = { v: 1, W: it.W, H: it.H, D: it.D, res: it.res, pal: Array.from(pal), rle: CU.b64(new Uint8Array(CU.rle(idx).buffer)), t: Date.now() };
    if (!saveStore(st)) { tip(L('cr.saveFail', 'Speichern fehlgeschlagen — der Browser-Speicher ist voll'), false); draftSoon(); return; }
    CU.applyModel(it.name, st.models[it.name]);
    it.savedAt = Date.now(); it.dirty = false; it.orig = it.V.slice(); countItem();
    if (P) { P.dropData(id); P.put(id, { kind: 'item', name: it.display, ref: { name: it.name }, n: 0, view: viewState() }); shootProject(id); }
    C.THUMB.delete(it.name);
    tip(SA ? `💾 ${it.display} ${L('cr.savedSA', 'gespeichert')} — ${L('cr.takeSA', '📦 Mitnehmen bringt es ins Spiel')}` : `✓ ${it.display} ${L('cr.itemInGame', 'ist im Spiel — überall, wo es steht.')}`, true);
    for (const k of C.HOUSE.keys()) C.rebuildHouse(k, { skin: C.HOUSE.get(k).data.skin, mirror: C.HOUSE.get(k).data.mirrored });
    C.parts(); C.hud();
  }
  function resetItem() {
    const it = CR.item; if (!it) return;
    const o = VM.MODELS[it.name], fresh = VM.compile(it.name, o.def.o), list = [];
    for (let i = 0; i < it.V.length; i++) { const k = fresh.vol[i], v = k ? fresh.pal[k] : 0; if (v !== it.V[i]) { const x = i % it.VW, z = Math.floor(i / it.VW) % it.VD, y = Math.floor(i / (it.VW * it.VD)); list.push([x, y, z, v]); } }
    if (!list.length) { tip('Schon das Original.', true); return; }
    vApply(list); tip(SA ? L('cr.resetSA', 'Original wiederhergestellt — 💾 Speichern behält es') : L('cr.reset2', 'Original wiederhergestellt — „Ins Spiel“ übernimmt es'), true);
  }
  CR.open = { house: openHouse, item: openItem };
  CR.update = { house: updateHouse, item: updateItem };
  CR.applyChanges = (l) => applyChanges(l);
  CR.areaApply = areaApply; CR.toggleArea = areaMode; CR.partners = partners;
  CR.pickBlock = pickBlock;
  Object.assign(CR, { breakAt, placeAt, pickAt, replaceAt, useAt, setOpen, openGroup, OPENABLE, gGet, inLot, drawBar, drawHelp, tip, useRecent, nameOf, iconOf, undoStep: undo, camLook, toggleFly, store });   // (CR.undo is the undo stack)
  Object.assign(CR, { viewState, keepWork, saveDraft, discardDraft, draftPending: () => !!draftT, vApply: (l) => vApply(l) });
  // deep link: #craft/h/<index> · #craft/m/<model>
  window.addEventListener('load', () => setTimeout(() => {
    const h = (location.hash || '').slice(1);
    if (h.startsWith('craft/h/')) { const i = +h.slice(8) || 0; const go = () => { if (C.HOUSE.get(i) || C.texInfo()) openHouse(i); else setTimeout(go, 400); }; go(); }
    else if (h.startsWith('craft/m/') && VM.MODELS[h.slice(8)]) openItem(h.slice(8));
  }, 300));
})();
