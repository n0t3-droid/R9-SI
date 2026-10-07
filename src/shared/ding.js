// ============================================================================
// One „Ding" (W1): every block, furniture piece, catalogue house, Baukasten or
// Genie thing, Bauteil and planned place is a card with the same five actions,
// in this order, a missing one absent and never greyed:
//   👁 Ansehen · ✏️ Bearbeiten · ☆ Favorit · 📍 Setzen · 📦 Teilen
// Ids: b:<block>  m:<model>  h:<catalogue i>  k:<kit id>  g:<genie id>  p:<Bauteil id>  s:<site id>
// The page that shows the cards fills VR.Ding.handlers — view(id, el), edit(id, el),
// set(id, el), share(id, el), pic(id, w, h) → canvas | img | null — and may veto
// one with canView / canEdit / canSet / canShare(id). The favourites and the 📦
// r9-paket take the new ids as they are; a house is its blueprint item.
// VR.Ding.card(id) · render(id, opts) · actions(id) · list(filter) · sharePack(id)
// · share(id) · toggleFav(id) · name(id) · state(id) · favId / fromFav
// ============================================================================
(function (VR) {
  'use strict';
  const D = VR.Ding = { handlers: {}, houseNames: null };
  const KINDS = 'bmhkgps';
  const tx = (k, v, de, en) => (VR.I18N && VR.I18N.tx ? VR.I18N.tx(k, v, de, en) : String(de).replace(/\{(\w+)\}/g, (m, x) => (v && v[x] !== undefined ? v[x] : m)));
  const lsGet = (k) => { try { const t = localStorage.getItem(k); return t ? JSON.parse(t) : null; } catch (e) { return null; } };
  const obj = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? o : null);

  // ---------------------------------------------------------------- ids
  D.parse = (id) => { if (typeof id !== 'string' || id.length < 3 || id[1] !== ':' || KINDS.indexOf(id[0]) < 0) return null; return { kind: id[0], key: id.slice(2) }; };
  D.of = (kind, key) => kind + ':' + key;
  // the id a favourite is stored under: blocks and models by their bare name (the game's ★ tab reads those),
  // a catalogue house as its blueprint item, everything else as it is
  D.favId = (id) => { const p = D.parse(id); if (!p) return id; return p.kind === 'b' || p.kind === 'm' ? p.key : p.kind === 'h' ? 'blueprint_' + p.key : id; };
  D.fromFav = (fav) => {
    if (typeof fav !== 'string' || !fav) return null;
    if (D.parse(fav)) return fav;
    const m = /^blueprint_(\d{1,2})$/.exec(fav); if (m) return 'h:' + (+m[1]);
    if (VR.VM && VR.VM.MODELS && VR.VM.MODELS[fav]) return 'm:' + fav;
    if ((VR.R && VR.R.byName && VR.R.byName[fav]) || (VR.ITEMS && VR.ITEMS[fav])) return 'b:' + fav;
    return null;
  };
  D.isFav = (id) => !!(VR.Favs && VR.Favs.has(D.favId(id)));
  D.toggleFav = (id) => (VR.Favs ? VR.Favs.toggle(D.favId(id)) : false);

  // ---------------------------------------------------------------- what is stored about it
  const designs = () => { const st = (VR.Custom && VR.Custom.load && VR.Custom.load()) || {}; return { houses: obj(st.houses) || {}, models: obj(st.models) || {} }; };
  const libItem = (key) => (VR.Pack && VR.Pack.libLoad ? VR.Pack.libLoad() : []).find(it => it && it.id === key) || null;
  const projects = () => { const d = lsGet('r9si.projects'); return d && obj(d.items) ? d.items : {}; };
  const project = (key) => projects()[key] || null;
  D.houseName = (i) => { if (D.houseNames && D.houseNames[i]) return D.houseNames[i]; const PL = VR.VillageGen && VR.VillageGen.plan2, c = PL && PL.CATALOGUE && PL.CATALOGUE[i]; return c ? c.name : tx('ding.house', { i }, 'Haus {i}', 'House {i}'); };
  D.name = function (id) {
    const p = D.parse(id); if (!p) return String(id || '');
    if (p.kind === 'h') return D.houseName(+p.key);
    if (p.kind === 'm') { const m = VR.VM && VR.VM.MODELS && VR.VM.MODELS[p.key]; return m ? m.display : p.key; }
    if (p.kind === 'b') { if (VR.itemName) { const n = VR.itemName(p.key); if (n) return n; } const t = VR.R && VR.R.byName && VR.R.byName[p.key]; return t ? (t.display || (t.o && t.o.display) || p.key) : p.key; }
    if (p.kind === 'p') { const it = libItem(p.key); return it ? it.name || tx('ding.piece', null, 'Bauteil', 'Piece') : p.key; }
    const pj = project(p.key); return pj ? (pj.label || pj.name || p.key) : p.key;
  };
  // one state line: „✎ Entwurf" (a draft in the Studio) · „✓ im Spiel" (a saved design) · ''
  D.state = function (id) {
    const p = D.parse(id); if (!p) return '';
    let raw = null; try { raw = localStorage.getItem('r9si.wip.' + (p.kind === 'h' ? 'h:' + p.key : p.kind === 'm' ? 'm:' + p.key : p.key)); } catch (e) { raw = null; }
    if (raw !== null && (p.kind === 'h' || p.kind === 'm')) return tx('ding.draft', null, '✎ Entwurf', '✎ draft');
    if (p.kind === 'h' || p.kind === 'm') { const d = designs(); if ((p.kind === 'h' ? d.houses : d.models)[p.key]) return tx('ding.inGame', null, '✓ im Spiel', '✓ in the game'); }
    return '';
  };
  // the picture: the page's painter, else a placeholder glyph by kind
  const GLYPH = { b: '🧱', m: '🪑', h: '🏠', k: '🏠', g: '✨', p: '🧩', s: '🏘' };
  D.thumbURL = function (id) {
    const p = D.parse(id); if (!p) return null;
    if (p.kind === 'p') { const it = libItem(p.key); return it && typeof it.thumb === 'string' ? it.thumb : null; }
    if (p.kind === 'k' || p.kind === 'g' || p.kind === 's') { try { return localStorage.getItem('r9si.thumb.' + p.key); } catch (e) { return null; } }
    return null;
  };
  D.pic = function (id, w, h) {
    const H = D.handlers;
    if (H.pic) { try { const c = H.pic(id, w, h); if (c) return c; } catch (e) { /* no picture then */ } }
    const url = D.thumbURL(id);
    if (url && typeof document !== 'undefined') { const img = document.createElement('img'); img.src = url; img.alt = ''; img.draggable = false; return img; }
    return null;
  };

  // ---------------------------------------------------------------- the five actions
  const can = (name, id) => { const f = D.handlers['can' + name[0].toUpperCase() + name.slice(1)]; return typeof f === 'function' ? !!f(id) : true; };
  D.actions = function (id) {
    const p = D.parse(id); if (!p) return [];
    const H = D.handlers, out = [];
    if (H.view && can('view', id)) out.push('view');
    if (H.edit && can('edit', id)) out.push('edit');
    out.push('fav');
    if (H.set && can('set', id)) out.push('set');
    if ('bmhp'.indexOf(p.kind) >= 0 && can('share', id)) out.push('share');
    return out;
  };
  const LABEL = {
    view: () => tx('ding.view', null, '👁 Ansehen', '👁 View'),
    edit: () => tx('ding.edit', null, '✏️ Bearbeiten', '✏️ Edit'),
    fav: (id) => (D.isFav(id) ? '★ ' : '☆ ') + tx('ding.fav', null, 'Favorit', 'Favourite'),
    set: () => tx('ding.set', null, '📍 Setzen', '📍 Place'),
    share: () => tx('ding.share', null, '📦 Teilen', '📦 Share'),
  };
  D.card = (id) => ({ id, kind: (D.parse(id) || {}).kind || null, name: D.name(id), state: D.state(id), actions: D.actions(id), pic: (w, h) => D.pic(id, w, h), route: 'ding/' + id });
  let io = null;
  const observe = (el, fill) => {
    if (typeof IntersectionObserver === 'undefined') { fill(); return; }
    if (!io) io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { io.unobserve(e.target); if (e.target.__fill) { const f = e.target.__fill; e.target.__fill = null; f(); } } }, { rootMargin: '240px' });
    el.__fill = fill; io.observe(el);
  };
  // the first cards of a list get their picture at once (the observer paints the rest as they scroll into view):
  // a slow machine shows no placeholders on the first screen
  D.fillNow = function (root, n) {
    let k = 0;
    for (const el of (root || document).querySelectorAll('.ding')) { if (k >= (n || 12)) break; if (el.__fill) { const f = el.__fill; el.__fill = null; if (io) io.unobserve(el); f(); } k++; }
  };
  // the card: picture ≥ 56 px, name, one state line, the actions in their fixed order
  D.render = function (id, opts) {
    opts = opts || {};
    const c = D.card(id), el = document.createElement('div');
    el.className = 'ding' + (opts.compact ? ' compact' : '') + (opts.on ? ' on' : ''); el.setAttribute('data-ding', id); if (el.dataset) el.dataset.ding = id;
    const pic = document.createElement('div'); pic.className = 'pic'; pic.textContent = GLYPH[c.kind] || '◈';
    const W = opts.picW || 160, Hh = opts.picH || 100;
    observe(el, () => { const p = D.pic(id, W, Hh); if (p) { pic.textContent = ''; pic.appendChild(p); pic.classList.add('has'); } });
    const cap = document.createElement('div'); cap.className = 'cap';
    const n = document.createElement('div'); n.className = 'n'; n.textContent = c.name; n.setAttribute('title', c.name);
    const st = document.createElement('div'); st.className = 'st'; st.textContent = c.state;
    cap.appendChild(n); cap.appendChild(st);
    const acts = document.createElement('div'); acts.className = 'dacts';
    for (const a of c.actions) {
      const b = document.createElement('button'); b.setAttribute('type', 'button'); b.setAttribute('data-da', a); if (b.dataset) b.dataset.da = a;
      b.className = 'da ' + a + (a === 'fav' && D.isFav(id) ? ' on' : '');
      b.textContent = a === 'set' && opts.setLabel ? opts.setLabel : LABEL[a](id);
      b.onclick = (e) => {
        if (e && e.stopPropagation) e.stopPropagation();
        if (a === 'fav') { const on = D.toggleFav(id); b.textContent = LABEL.fav(id); b.classList.toggle('on', on); if (D.handlers.fav) D.handlers.fav(id, on, el); return; }
        if (a === 'share') { (D.handlers.share || D.share)(id, el); return; }
        const f = D.handlers[a]; if (f) f(id, el);
      };
      acts.appendChild(b);
    }
    el.appendChild(pic); el.appendChild(cap); el.appendChild(acts);
    if (opts.onOpen) el.onclick = () => opts.onOpen(id, el);
    return el;
  };

  // ---------------------------------------------------------------- 📦 Teilen: one r9-paket with this one thing
  D.sharePack = function (id) {
    const p = D.parse(id); if (!p || !VR.Pack || !VR.Pack.make) return null;
    const from = (typeof window !== 'undefined' && window.__R9_STANDALONE) ? 'standalone' : 'game';
    const d = designs();
    if (p.kind === 'b') return VR.Pack.make(from, { favs: [p.key] });
    if (p.kind === 'm') return d.models[p.key] ? VR.Pack.make(from, { models: [p.key] }) : VR.Pack.make(from, { favs: [p.key] });
    if (p.kind === 'h') return d.houses[p.key] ? VR.Pack.make(from, { houses: [+p.key] }) : VR.Pack.make(from, { favs: ['blueprint_' + p.key] });
    if (p.kind === 'p') return libItem(p.key) ? VR.Pack.make(from, { lib: [p.key] }) : null;
    return null;
  };
  const slug = (s) => String(s || '').toLowerCase().replace(/[äöüß]/g, (c) => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }[c])).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24);
  // the file: the host's own downloads where the page has them (claude.ai, also for the Studio in the game's frame),
  // else a normal download. Replaceable (tests, the standalone bridge).
  D.download = async function (name, text) {
    const data = new TextEncoder().encode(text);
    let host = null, HW = typeof window !== 'undefined' ? window : null;
    try { if (HW && HW.claude && HW.claude.use) host = HW.claude; else if (HW && HW.parent && HW.parent !== HW && HW.parent.claude && HW.parent.claude.use) { host = HW.parent.claude; HW = HW.parent; } } catch (e) { host = null; }
    if (host) {
      try { const dl = await host.use('downloads'); if (dl) { const req = new HW.Object(); req.filename = name; req.data = new HW.Uint8Array(data); await dl.save(req); return true; } }
      catch (e) { if (e && e.code === 'declined') return false; }
    }
    try {
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: 'application/json' })); a.download = name;
      document.body.appendChild(a); a.click(); setTimeout(() => { try { URL.revokeObjectURL(a.href); } catch (e) { /* */ } a.remove(); }, 4000);
      return true;
    } catch (e) { return false; }
  };
  D.share = function (id) {
    const pk = D.sharePack(id); if (!pk) return null;
    const base = VR.Pack.fileName(), name = base.replace(/\.json$/, '') + '-' + (slug(D.name(id)) || 'ding') + '.json';
    D.download(name, JSON.stringify(pk));
    return pk;
  };

  // ---------------------------------------------------------------- your things, the last one touched first
  D.list = function (filter) {
    filter = filter || {};
    const seen = new Map(), put = (id, t) => { if (!id) return; const old = seen.get(id); if (old === undefined || t > old) seen.set(id, t); };
    const favs = VR.Favs ? VR.Favs.list() : [];
    favs.forEach((f, i) => put(D.fromFav(f), -i));
    const d = designs();
    for (const k of Object.keys(d.houses)) put('h:' + (+k), +(d.houses[k] && d.houses[k].t) || 1);
    for (const n of Object.keys(d.models)) put('m:' + n, +(d.models[n] && d.models[n].t) || 1);
    for (const it of (VR.Pack && VR.Pack.libLoad ? VR.Pack.libLoad() : [])) if (it && it.id) put('p:' + it.id, +it.t || 1);
    const pj = projects();
    for (const k of Object.keys(pj)) { const p = pj[k]; if (!p || p.hide) continue; const kind = p.kind === 'kit' ? 'k' : p.kind === 'genie' ? 'g' : p.kind === 'site' ? 's' : null; if (kind) put(kind + ':' + k, +p.t || 1); }
    let out = [...seen.entries()].map(([id, t]) => ({ id, t }));
    if (filter.kind) out = out.filter(x => x.id[0] === filter.kind);
    out.sort((a, b) => b.t - a.t);
    return out;
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
