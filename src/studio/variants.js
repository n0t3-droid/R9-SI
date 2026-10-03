// ============================================================================
// R9 Studio · ✏️ Varianten (v0.39): the same block in other colours and materials —
// the 12 roof colours of a roof, the 40 Vollton colours of a Vollton block, the
// other stairs of a stair — found from the names, among blocks of the same shape
// (kind and properties: a roof stays a roof that can be turned). Furniture: the
// pieces of the same kind (sofas, lamps …).
// VR.Variants.family(id) → [id, …] (itself included; [] when there is none)
// UI (in the Studio): strip(id, onPick) — a row of pictures; picker(…) — 🎨 "replace
// all of it in this house by …": the variants first, every block by search.
// No colour editing of single blocks here (that comes with its own editor).
// ============================================================================
(function () {
  'use strict';
  const V = VR.Variants = VR.Variants || {};
  const R = VR.R;

  // ---------------------------------------------------------------- families from the names
  const shapeOf = (t) => (t.o.kind || '') + '|' + Object.keys(t.propIndex || {}).sort().join(',') + '|' + (t.o.tall ? 't' : '') + (t.o.vxModel ? 'm' : '');
  let POOL = null;
  function pool() {
    if (POOL) return POOL;
    POOL = new Map();
    const VM = VR.VM;
    for (const t of R.types) {
      if (!t || !t.cat || t.o.noItem || t.o.cutOf || t.name === 'air') continue;
      if (VM && VM.MODELS && VM.MODELS[t.name]) continue;          // furniture: V.models
      if (t.o.kind === 'model' && t.has && t.has('part')) continue;
      const k = shapeOf(t); if (!POOL.has(k)) POOL.set(k, []); POOL.get(k).push(t.name);
    }
    return POOL;
  }
  // every way to cut the name into prefix · colour/material · suffix (whole words); the cut whose family is the
  // biggest wins (the more specific one on a tie). A member that is another member plus one more word ("white_gloss"
  // next to "white", "white_slab" …) is a twin with another finish, not another colour: it stays out.
  V.family = function (id) {
    const t = R.byName[id]; if (!t || id === 'air') return [];
    if (VR.VM && VR.VM.MODELS && VR.VM.MODELS[id]) return V.models ? V.models(id) : [];
    const cands = pool().get(shapeOf(t)) || []; if (cands.length < 2) return [];
    const all = new Set(cands), tok = id.split('_');
    let best = null, bestKeep = -1;
    for (let i = 0; i < tok.length; i++) for (let j = 0; i + j < tok.length; j++) {
      if (i + j === 0) continue;
      const pre = i ? tok.slice(0, i).join('_') + '_' : '', suf = j ? '_' + tok.slice(tok.length - j).join('_') : '';
      const list = [];
      for (const n of cands) {
        if (n.length <= pre.length + suf.length || !n.startsWith(pre) || !n.endsWith(suf)) continue;
        const m = n.slice(pre.length, n.length - suf.length), k = m.lastIndexOf('_');
        if (!m || m.startsWith('_') || m.endsWith('_')) continue;
        if (k > 0 && all.has(pre + m.slice(0, k) + suf)) continue;     // a twin
        list.push(n);
      }
      if (!list.includes(id) || list.length < 2) continue;
      if (!best || list.length > best.length || (list.length === best.length && i + j > bestKeep)) { best = list; bestKeep = i + j; }
    }
    return best || [];
  };
  // blocks of the same shape, the nearest colours first (when the Studio knows the colours) — for blocks without a family
  V.similar = function (id, max) {
    const t = R.byName[id]; if (!t) return [];
    const cands = (pool().get(shapeOf(t)) || []).filter(n => n !== id && R.byName[n].cat === t.cat);
    const BC = VR.BlockColors;
    if (BC && BC.ready && BC.ready() && BC.colorOf && BC.toLab) {
      const c0 = BC.colorOf(t.defaultState, 2), L0 = BC.toLab(c0[0], c0[1], c0[2]);
      const d = (n) => { const c = BC.colorOf(R.byName[n].defaultState, 2), q = BC.toLab(c[0], c[1], c[2]); return (q[0] - L0[0]) ** 2 + (q[1] - L0[1]) ** 2 + (q[2] - L0[2]) ** 2; };
      cands.sort((a, b) => d(a) - d(b));
    }
    return [id].concat(cands.slice(0, (max || 24) - 1));
  };

  // ---------------------------------------------------------------- the Studio's side
  const W = typeof window !== 'undefined' ? window : null;
  const C = W && W.__studioCore; if (!C) return;
  const VM = VR.VM;
  const L = (k, de, v) => (VR.I18N && VR.I18N.t ? VR.I18N.t(k, v, de) : String(de).replace(/\{(\w+)\}/g, (m, x) => (v && v[x] !== undefined ? v[x] : m)));
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const CAT = () => VR.StudioCatalog;
  const disp = (id) => { if (VM.MODELS[id]) return VM.MODELS[id].display; const t = R.byName[id]; return t ? (t.display || (t.o && t.o.display) || id) : id; };
  V.disp = disp;
  // furniture of the same kind: the same group of the catalogue (sofas with sofas), facade with facade
  V.models = function (name) {
    const m = VM.MODELS[name]; if (!m) return [];
    const fac = C.isFacade(name), cats = C.catsOf(name).filter(c => c !== 'all'), grp = (n) => VM.MODELS[n].display.split(' ·')[0].replace(/\s*\d+"?$/, '');
    const g0 = grp(name);
    const out = Object.keys(VM.MODELS).filter(n => C.isFacade(n) === fac && (grp(n) === g0 || C.catsOf(n).some(c => cats.includes(c))));
    out.sort((a, b) => (grp(b) === g0) - (grp(a) === g0));
    return out.slice(0, 60);
  };
  // a row of pictures; the current one lit; a click picks
  V.strip = function (ids, cur, onPick, title) {
    const box = document.createElement('div'); box.className = 'varStrip';
    if (title) { const h = document.createElement('div'); h.className = 'varT'; h.innerHTML = title; box.appendChild(h); }
    const row = document.createElement('div'); row.className = 'varRow'; box.appendChild(row);
    for (const id of ids) {
      const b = document.createElement('button'); b.className = 'vt' + (id === cur ? ' on' : ''); b.dataset.var = id; b.title = disp(id);
      const pic = CAT() && CAT().picture ? CAT().picture(id, 44, 44) : document.createElement('canvas'); pic.className = 'vp'; b.appendChild(pic);
      b.onclick = (e) => { e.stopPropagation(); onPick(id); };
      row.appendChild(b);
    }
    return box;
  };
  // 🎨 replace all of a block / model in a house: pick the new one (the variants first, any block by search)
  V.picker = function (o) {
    const isModel = !!VM.MODELS[o.id];
    const box = document.createElement('div'); box.className = 'varPick';
    box.innerHTML = `<div class="varT">🎨 ${esc(L('var.replaceIn', 'Alle {a} in {h} ersetzen durch …', { a: disp(o.id), h: o.houseName || '' }))}</div>`;
    const fam = (isModel ? V.models(o.id) : V.family(o.id)).filter(x => x !== o.id);
    const ids = fam.length ? fam : V.similar(o.id, 24).filter(x => x !== o.id);
    box.appendChild(V.strip(ids, null, (id) => o.onPick(id), fam.length ? L('var.variants', 'Varianten') : L('var.similar', 'Ähnliche')));
    // any other block (or piece): by name
    const q = document.createElement('input'); q.className = 'varQ'; q.placeholder = L('var.search', 'Anderes suchen …'); q.spellcheck = false; q.autocomplete = 'off';
    const res = document.createElement('div'); res.className = 'varRes';
    q.oninput = () => {
      res.innerHTML = '';
      const s = q.value.trim(); if (!s) return;
      const pool2 = isModel ? Object.keys(VM.MODELS).filter(n => C.isFacade(n) === C.isFacade(o.id)) : (CAT() && CAT().entries ? CAT().entries().map(e => e.id) : []);
      const hit = (CAT() && CAT().search ? CAT().search(pool2, s) : pool2.filter(n => n.includes(s))).filter(x => x !== o.id).slice(0, 24);
      if (hit.length) res.appendChild(V.strip(hit, null, (id) => o.onPick(id)));
      else res.innerHTML = `<div class="note dim">${esc(L('var.none', 'nichts gefunden'))}</div>`;
    };
    q.onkeydown = (e) => e.stopPropagation();
    box.appendChild(q); box.appendChild(res);
    const x = document.createElement('button'); x.className = 'cbtn mini'; x.dataset.act = 'cancel'; x.textContent = '✕ ' + L('var.cancel', 'Abbrechen'); x.onclick = (e) => { e.stopPropagation(); box.remove(); if (o.onCancel) o.onCancel(); };
    box.appendChild(x);
    box.onclick = (e) => e.stopPropagation();
    return box;
  };
})();
