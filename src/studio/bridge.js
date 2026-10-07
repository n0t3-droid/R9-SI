// ============================================================================
// R9 Studio · 🔌 the bridge (v0.39). The standalone Studio is published on its own
// (another web origin): its storage is not the game's, and nothing saved in it
// reaches the game by itself. So it says so — a slim banner under the top bar:
// 🎮 Zum Spiel (a new tab; when none can open, the link to copy), 📦 Mitnehmen, ✕.
// 📦 Mitnehmen (both Studios): favourites, designs and Werkbank Bauteile as ONE
// file, r9-paket-YYYY-MM-DD.json (VR.Pack) — through the host's downloads where
// the page has them (claude.ai), else as a normal download.
// 📥 Übernehmen (🕘 Weitermachen, the Crafter's "Meine Designs") — or the file
// dropped anywhere on the Studio — shows what is in it ("4 Favoriten · 2 Häuser ·
// 1 Möbel · 3 Bauteile") and takes it over with ✓ (★ added, the newer design
// wins, the same Bauteil is not doubled). The game's title screen reads it too.
// ============================================================================
(function () {
  'use strict';
  const C = window.__studioCore; if (!C || !VR.Pack) return;
  const { $, S } = C;
  const SA = !!C.SA, GAME_URL = window.__R9_GAME_URL || '';
  const L = (k, de, v) => (VR.I18N && VR.I18N.t ? VR.I18N.t(k, v, de) : String(de).replace(/\{(\w+)\}/g, (m, x) => (v && v[x] !== undefined ? v[x] : m)));
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const BR = VR.StudioBridge = {};
  // a word where it is seen: the Crafter's tip when it is open, else a toast; the status line always
  const say = (t, ok) => { const CR = VR.Crafter; if (CR && CR.on && CR.tip) CR.tip(t, ok); else if (VR.Projects && VR.Projects.toast) VR.Projects.toast(t); C.sys(t, ok === false ? 'err' : 'ok'); };

  // ---------------------------------------------------------------- 📦 out
  async function saveFile(name, text) {
    const data = new TextEncoder().encode(text);
    // the host's own saving where there is one (the Studio's window.claude, or the game's when the Studio is its overlay)
    let host = null, HW = window;
    try { if (window.claude && window.claude.use) host = window.claude; else if (window.parent !== window && window.parent.claude && window.parent.claude.use) { host = window.parent.claude; HW = window.parent; } } catch (e) { host = null; }
    if (host) {
      try {
        const dl = await host.use('downloads');
        if (dl) { const req = new HW.Object(); req.filename = name; req.data = new HW.Uint8Array(data); await dl.save(req); return true; }
      } catch (e) { if (e && e.code === 'declined') return false; console.warn('downloads', e); }
    }
    try {
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' })); a.download = name;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
      return true;
    } catch (e) { say('⚠ ' + L('br.noSave', 'Speichern geht hier nicht'), false); return false; }
  }
  BR.exportPack = async function () {
    if (VR.Projects && VR.Projects.flush) VR.Projects.flush({});
    const pk = VR.Pack.make(SA ? 'standalone' : 'game'), sum = VR.Pack.summary(pk), name = VR.Pack.fileName();
    const ok = await saveFile(name, JSON.stringify(pk));
    if (!ok) return false;
    // a Crafter draft is not a design yet: say so
    const CR = VR.Crafter, open = !!(CR && CR.on && ((CR.house && CR.house.dirty) || (CR.item && CR.item.dirty)));
    say('📦 ' + name + ' · ' + sum.text + (open ? ' · ✎ ' + (SA ? L('br.draftSA', 'der offene Entwurf fehlt — erst 💾 Speichern') : L('br.draft', 'der offene Entwurf fehlt — erst „Ins Spiel“')) : ''), true);
    return true;
  };

  // ---------------------------------------------------------------- 📥 in
  BR.pickFile = function () {
    let inp = document.getElementById('packFile');
    if (!inp) {
      inp = document.createElement('input'); inp.type = 'file'; inp.id = 'packFile'; inp.accept = '.json,application/json'; inp.style.display = 'none';
      inp.onchange = () => { const f = inp.files && inp.files[0]; inp.value = ''; if (f) BR.importFile(f); };
      document.body.appendChild(inp);
    }
    inp.click();
  };
  const benchOn = () => { const WM = VR.StudioWorld; return !!(WM && WM.on && S.mode === 'world' && WM.world && WM.tab === 'bench' && WM.wb && WM.wb.importFile); };
  BR.importFile = async function (file) {
    let text = ''; try { text = await file.text(); } catch (e) { text = ''; }
    const pk = VR.Pack.read(text);
    if (!pk) {
      // a Werkbank structure (.json from ⬇ .json, WorldEdit …): the Werkbank takes it when it is open
      if (benchOn()) { VR.StudioWorld.wb.importFile(file); return; }
      say('📥 ' + (file.name || '') + ': ' + L('br.notPack', 'kein R9-Paket'), false); return;
    }
    BR.show(pk, file.name || '');
  };
  BR.importText = function (text) { const pk = VR.Pack.read(text); if (pk) BR.show(pk, ''); return !!pk; };
  // what is in it, ✓ Übernehmen / Abbrechen
  BR.show = function (pk, name) {
    if (VR.Projects && VR.Projects.isOpen && VR.Projects.isOpen()) VR.Projects.show(false);    // (what comes next is seen)
    let d = $('#packDlg');
    if (!d) { d = document.createElement('div'); d.id = 'packDlg'; ($('#studio') || document.body).appendChild(d); d.addEventListener('mousedown', (e) => { if (e.target === d) close(); }); }
    const sum = VR.Pack.summary(pk), from = pk.from === 'standalone' ? L('br.fromSA', 'aus dem eigenständigen Studio') : pk.from === 'game' ? L('br.fromGame', 'aus dem Studio im Spiel') : '';
    const when = pk.at ? new Date(pk.at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
    d.innerHTML = `<div class="box" role="dialog" aria-label="${esc(L('br.title', 'R9-Paket übernehmen'))}"><h3>📥 ${esc(L('br.title', 'R9-Paket übernehmen'))}</h3>`
      + `<div class="sum">${esc(sum.text)}</div><div class="src dim">${esc([name, from, when].filter(Boolean).join(' · '))}</div>`
      + `<div class="how dim">${esc(L('br.how', '★ kommen dazu (die neuen zuerst) · bei Designs gewinnt das neuere · gleiche Bauteile nicht doppelt'))}</div>`
      + `<div class="crow"><button class="cbtn pri" data-act="ok">✓ ${esc(L('br.in', 'Übernehmen'))}</button><button class="cbtn" data-act="cancel">${esc(L('br.cancel', 'Abbrechen'))}</button></div></div>`;
    d.classList.add('on');
    const close = () => { d.classList.remove('on'); d.innerHTML = ''; };
    d.querySelector('[data-act="cancel"]').onclick = close;
    d.querySelector('[data-act="ok"]').onclick = () => { close(); BR.apply(pk); };
    setTimeout(() => { const b = d.querySelector('[data-act="ok"]'); if (b) b.focus(); }, 30);
  };
  window.addEventListener('keydown', (e) => { const d = $('#packDlg.on'); if (d && e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); d.classList.remove('on'); d.innerHTML = ''; } }, true);
  // take it over — and show it in this page at once (the designs in the worker, the pictures, the houses)
  BR.apply = function (pk) {
    const r = VR.Pack.merge(pk), CU = VR.Custom;
    if (r.houseIdx.length || r.modelNames.length) {
      const st = CU.load() || { v: 1, houses: {}, models: {} };
      CU.apply(st); C.post({ type: 'custom', custom: st });
      for (const n of r.modelNames) C.THUMB.delete(n);
      for (const k of [...C.HOUSE.keys()]) { const h = C.HOUSE.get(k); if (r.houseIdx.includes(k)) C.rebuildHouse(k, {}); else if (r.modelNames.length) C.rebuildHouse(k, { skin: h.data.skin, mirror: h.data.mirrored }); }
      if (VR.Crafter && VR.Crafter.upgradeDesigns) VR.Crafter.upgradeDesigns();
      if (VR.Projects && VR.Projects.sync) { VR.Projects.sync(); if (VR.Projects.changed) VR.Projects.changed(); }
    }
    C.chips(); C.list(); C.parts();
    if (!r.ok) C.full('pack');
    say(r.ok ? '✓ ' + L('br.done', 'Übernommen') + ': ' + r.text : '⚠ ' + L('br.partly', 'Nicht alles übernommen — der Browser-Speicher ist voll') + ' · ' + r.text, r.ok);
    return r;
  };

  // ---------------------------------------------------------------- a file dropped anywhere on the Studio
  const hasFiles = (e) => !!(e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files'));
  const jsonOf = (e) => { const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; return f && /\.json$/i.test(f.name || '') ? f : null; };
  let hintT = 0;
  const hint = (on) => { const st = $('#studio'); if (st) st.classList.toggle('packdrop', on && !benchOn()); clearTimeout(hintT); if (on) hintT = setTimeout(() => hint(false), 1500); };
  window.addEventListener('dragover', (e) => { if (!hasFiles(e)) return; e.preventDefault(); hint(true); }, true);
  window.addEventListener('drop', (e) => {
    hint(false);
    if (!hasFiles(e)) return;
    const f = jsonOf(e);
    if (!f) {
      // other files: the Werkbank's view takes them (.schem, pictures …); anywhere else the page must not open the file
      const toBench = benchOn() && e.target && e.target.closest && e.target.closest('main');
      if (!toBench) { e.preventDefault(); say('📥 ' + L('br.onlyJson', 'Hier kommt ein R9-Paket (.json) hin'), false); }
      return;
    }
    e.preventDefault(); e.stopPropagation();
    BR.importFile(f);
  }, true);

  // ---------------------------------------------------------------- 🔌 the standalone says it is not connected
  BR.toGame = function (anchor) {
    let w = null; try { w = window.open(GAME_URL, '_blank', 'noopener'); } catch (e) { w = null; }
    if (w) return;
    // (noopener hands nothing back — and a blocked one neither): the link, ready to copy
    const host = (anchor && anchor.closest && anchor.closest('#bridgeBar, .note, .crow')) || $('#bridgeBar') || $('#partsBody');
    if (!host) return;
    let box = host.querySelector('.gameLink');
    if (!box) {
      box = document.createElement('span'); box.className = 'gameLink';
      box.innerHTML = `<span>${esc(L('br.linkT', 'Kein neuer Tab? Link kopieren:'))}</span><input readonly value="${esc(GAME_URL)}"><button class="cbtn mini" data-act="copy" title="${esc(L('br.copy', 'Kopieren'))}">📋</button>`;
      host.appendChild(box);
      const inp = box.querySelector('input'); inp.onclick = () => inp.select();
      box.querySelector('[data-act="copy"]').onclick = () => { inp.select(); try { navigator.clipboard.writeText(GAME_URL).then(() => say('📋 ' + L('br.copied', 'Link kopiert'), true), () => { /* selected: Strg+C */ }); } catch (e) { /* selected: Strg+C */ } };
    }
    const inp = box.querySelector('input'); try { inp.focus(); inp.select(); } catch (e) { /* */ }
  };
  function banner() {
    if (!SA) return;
    let hidden = false; try { hidden = sessionStorage.getItem('r9si.bridge.hide') === '1'; } catch (e) { /* */ }
    const bars = $('#bars'); if (hidden || !bars || $('#bridgeBar')) return;
    const b = document.createElement('div'); b.id = 'bridgeBar';
    b.innerHTML = `<span class="t">🔌 ${esc(L('br.bar', 'Dieses Studio ist nicht mit deinem Spiel verbunden — live geht es im Studio im Spiel (⏸ → 🧰 R9 Studio).'))}</span>`
      + `<button class="cbtn mini pri" data-act="game" title="${esc(L('br.gameT', 'Das Spiel in einem neuen Tab öffnen'))}">🎮 ${esc(L('br.game', 'Zum Spiel'))}</button>`
      + `<button class="cbtn mini" data-act="pack" title="${esc(L('br.outT', 'Favoriten, Designs und Bauteile als eine Datei — für das Spiel oder ein anderes Studio'))}">📦 ${esc(L('br.out', 'Mitnehmen'))}</button>`
      + `<button class="x" data-act="hide" title="${esc(L('br.hide', 'Ausblenden, bis du das Studio wieder öffnest'))}">✕</button>`;
    bars.prepend(b);
    b.querySelector('[data-act="game"]').onclick = (e) => BR.toGame(e.currentTarget);
    b.querySelector('[data-act="pack"]').onclick = () => BR.exportPack();
    b.querySelector('[data-act="hide"]').onclick = () => { try { sessionStorage.setItem('r9si.bridge.hide', '1'); } catch (e) { /* this page only */ } b.remove(); };
  }
  banner();
})();
