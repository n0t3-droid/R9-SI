// ============================================================================
// R9 Studio · ⚠ Browser-Speicher voll (v0.39). When the browser's storage refuses a
// write — a design, a favourite, a Werkbank change, a plan, a draft — one banner
// under the top bar says so (nothing shows a ✓ for what did not happen), with
// 🧹 Platz schaffen: it lists first what it would delete, then frees only what can
// be made again — the pictures of 🕘 Weitermachen (the Studio draws them anew),
// Werkbank batches the game has built already, drafts nobody can open any more,
// empty and no-op drafts. Designs, ★ favourites, worlds, plans, Bauteile and
// changes still waiting for the game are never touched.
// Any part of the page (the game's shared files too) reports with the window
// event 'r9-storage-full' (studio core: C.full(what)).
// ============================================================================
(function () {
  'use strict';
  const C = window.__studioCore; if (!C) return;
  const { $ } = C;
  const L = (k, de, v) => (VR.I18N && VR.I18N.t ? VR.I18N.t(k, v, de) : String(de).replace(/\{(\w+)\}/g, (m, x) => (v && v[x] !== undefined ? v[x] : m)));
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const SP = VR.StudioSpace = { on: false, open: false, freed: 0 };

  // ---------------------------------------------------------------- what may go
  const keys = () => { const out = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k) out.push(k); } } catch (e) { /* storage blocked */ } return out; };
  const raw = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const json = (k) => { try { return JSON.parse(raw(k) || 'null'); } catch (e) { return undefined; } };
  const bytes = (k) => { const v = raw(k); return (k.length + (v ? v.length : 0)) * 2; };     // the browser counts UTF-16
  const kb = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
  SP.candidates = function () {
    const ks = keys(), G = { pics: [], built: [], gone: [], empty: [] };
    // (the page's own list first: with a full storage it may hold entries the browser could not store yet)
    const reg = json('r9si.projects'), stored = reg && reg.items && typeof reg.items === 'object' ? reg.items : {};
    const PJ = VR.Projects, entry = (id) => (PJ && PJ.get ? PJ.get(id) : null) || stored[id] || null;
    for (const k of ks) {
      // 🕘 pictures: the Studio draws them again when you work on it (houses and furniture show a live picture anyway)
      if (k.startsWith('r9si.thumb.')) G.pics.push(k);
      // a draft whose project was removed from 🕘 (or never had one): nothing can open it any more
      else if (k.startsWith('r9si.wip.')) { const p = entry(k.slice(9)); if (!p || p.hide) G.gone.push(k); }
      // plan drafts with nothing in them
      else if (k.startsWith('r9si.draft.')) { const d = json(k); if (!d || !Array.isArray(d.plans) || !d.plans.length) G.empty.push(k); }
      // a 🎨 Stil preview that is exactly what the world has
      else if (k.startsWith('r9si.styledraft.')) { const d = json(k), s0 = json('r9si.style.' + k.slice(16)), sig = (x) => JSON.stringify([(x && x.rules) || [], (x && x.water) || null]); if (!d || sig(d) === sig(s0)) G.empty.push(k); }
    }
    // Werkbank batches the game has built (its own list keeps the ids, so nothing is built twice) or no list knows
    const E = VR.Edits;
    if (E) {
      const pre = 'r9si.edit.', worlds = new Set();
      for (const k of ks) if (k.startsWith(pre)) worlds.add(k.slice(pre.length).split('.')[0]);
      for (const w of worlds) {
        const listed = new Set(E.list(w)), done = new Set(E.done(w)), p = pre + w + '.';
        for (const k of ks) if (k.startsWith(p)) { const id = k.slice(p.length); if (done.has(id) || !listed.has(id)) G.built.push(k); }
      }
    }
    const sum = (a) => a.reduce((s, k) => s + bytes(k), 0);
    return [
      { id: 'pics', ic: '🖼', label: L('sp.pics', 'Bilder in 🕘 Weitermachen'), keys: G.pics, bytes: sum(G.pics) },
      { id: 'built', ic: '🧱', label: L('sp.built', 'fertige Werkbank-Pakete (das Spiel hat sie gebaut)'), keys: G.built, bytes: sum(G.built) },
      { id: 'gone', ic: '✎', label: L('sp.gone', 'verworfene Entwürfe'), keys: G.gone, bytes: sum(G.gone) },
      { id: 'empty', ic: '○', label: L('sp.empty', 'leere Entwürfe'), keys: G.empty, bytes: sum(G.empty) },
    ].filter(g => g.keys.length);
  };
  SP.free = function () {
    let n = 0, b = 0;
    for (const g of SP.candidates()) for (const k of g.keys) { b += bytes(k); try { localStorage.removeItem(k); n++; } catch (e) { /* */ } }
    if (VR.Projects && VR.Projects.changed) VR.Projects.changed();
    return { n, bytes: b };
  };

  // ---------------------------------------------------------------- the banner
  function bar() {
    let b = $('#fullBar');
    if (!b) { b = document.createElement('div'); b.id = 'fullBar'; ($('#bars') || $('#studio') || document.body).appendChild(b); }
    return b;
  }
  function draw() {
    const b = bar();
    b.classList.toggle('on', SP.on);
    if (!SP.on) { b.innerHTML = ''; return; }
    if (SP.freed) {
      b.innerHTML = `<span class="t">✓ ${esc(L('sp.freed', '{s} frei — mach das Letzte nochmal (💾 / Ins Spiel / ☆), jetzt passt es wieder', { s: kb(SP.freed) }))}</span><button class="x" data-act="close" title="${esc(L('sp.close', 'Schließen'))}">✕</button>`;
    } else if (!SP.open) {
      b.innerHTML = `<span class="t">⚠ <b>${esc(L('sp.full', 'Browser-Speicher voll'))}</b> — ${esc(L('sp.fullT', 'was du gerade gemacht hast, ist nur bis zum Schließen da'))}</span><button class="cbtn mini pri" data-act="free">🧹 ${esc(L('sp.make', 'Platz schaffen'))}</button><button class="x" data-act="close" title="${esc(L('sp.close', 'Schließen'))}">✕</button>`;
    } else {
      const gs = SP.candidates(), total = gs.reduce((s, g) => s + g.bytes, 0);
      const list = gs.length ? gs.map(g => `<span class="g">${g.ic} ${g.keys.length} ${esc(g.label)} · ${kb(g.bytes)}</span>`).join('') : `<span class="g">${esc(L('sp.nothing', 'Nichts, was sicher weg kann.'))}</span>`;
      b.innerHTML = `<span class="t">🧹 ${esc(L('sp.would', 'Das kann weg — alles lässt sich neu machen:'))}</span><span class="freeList">${list}</span><span class="keep dim">${esc(L('sp.keep', 'Bleibt: Designs, ★ Favoriten, Welten, Pläne, Bauteile, offene Änderungen.'))}</span>`
        + (gs.length ? `<button class="cbtn mini pri" data-act="freeGo">🧹 ${esc(L('sp.go', 'Löschen'))} · ${kb(total)}</button>` : (VR.StudioBridge ? `<button class="cbtn mini" data-act="pack">📦 ${esc(L('br.out', 'Mitnehmen'))}</button>` : ''))
        + `<button class="cbtn mini" data-act="cancel">${esc(L('sp.cancel', 'Abbrechen'))}</button>`;
    }
    const on = (a, fn) => { const x = b.querySelector(`[data-act="${a}"]`); if (x) x.onclick = fn; };
    on('free', () => { SP.open = true; draw(); });
    on('cancel', () => { SP.open = false; draw(); });
    on('freeGo', () => { const r = SP.free(); SP.open = false; SP.freed = r.bytes || 1; draw(); C.sys('🧹 ' + L('sp.done', '{n} Einträge gelöscht · {s} frei', { n: r.n, s: kb(r.bytes) }), 'ok'); });
    on('pack', () => VR.StudioBridge && VR.StudioBridge.exportPack());
    on('close', () => { SP.on = false; SP.open = false; SP.freed = 0; draw(); });
  }
  SP.show = function (what) { SP.what = what || ''; if (SP.on && !SP.freed) return; SP.on = true; SP.freed = 0; SP.open = false; draw(); };
  window.addEventListener('r9-storage-full', (e) => SP.show(e && e.detail && e.detail.what));
})();
