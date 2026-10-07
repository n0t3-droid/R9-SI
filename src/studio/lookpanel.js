// ============================================================================
// R9 Studio · 🎨 Aussehen (Phase B1 of the live loop): a block's colour and material for all your worlds — live in
// the game — and „⧉ Als Variante": an edited copy under its own id, the original stays.
//   · 🧱 Teile: ✏️ on a card (or the block's ✏️ Bearbeiten) opens the panel on the right: the colour roles the block
//     really has and its Material (VX pieces: walls, floors, windows, roofs, furniture of the building kit), or one
//     Farbe and „Oberfläche" — another cube's faces (textured blocks).
//   · ▣ Möbel: „🎨 Aussehen" — the model's main colours and their materials (an Item-Crafter override).
//   · Every change shows here at once (this page and its worker, the game's own mesher and formula); ✓ Für alle
//     stores it ('r9si.looks' · 'r9si.studio') and the game takes it at once; ↺ Original deletes it; ⧉ Als Variante
//     fills the next of the 256 variant slots — then 🏠 In diesem Haus · 🌍 In meiner Welt · ✋ In die Hand.
//   · Route #look/<name>[/w/<world>]: the game's „✏️ Aussehen ändern" opens the Studio here.
// Texts: VR.I18N.tx(key, vars, de, en) with live.st.* keys (lang_de.js / lang_en.js).
// ============================================================================
(function () {
  'use strict';
  const C = window.__studioCore; if (!C) return;
  const { S, $, $$ } = C;
  const R = VR.R, L = VR.Looks, VM = VR.VM, VX = VR.VX;
  if (!L) return;
  const tx = (k, v, de, en) => (VR.I18N && VR.I18N.tx ? VR.I18N.tx(k, v, de, en) : String(de).replace(/\{(\w+)\}/g, (m, x) => (v && v[x] !== undefined ? v[x] : m)));
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clone = (o) => (o ? JSON.parse(JSON.stringify(o)) : o);
  const LP = VR.LookPanel = { world: null, edit: null, model: null, msg: '', msgOk: true };
  const nameOf = (id) => { const t = R.byName[id]; return t ? (VM.MODELS[id] && VM.MODELS[id].display) || t.display || id : id; };
  const slotK = (name) => { const m = /^var_(\d+)$/.exec(name || ''); return m ? +m[1] : -1; };
  // the game this Studio lies over (its overlay), if any
  const host = () => { try { const w = window.parent; return w !== window && w.VR && w.VR.game && w.VR.LiveLoop ? w : null; } catch (e) { return null; } };

  // ---------------------------------------------------------------- this page and its worker: one apply
  // the stored looks (or a preview of them) here and in the worker; the previews that showed a changed block again
  function applyHere(data, o) {
    let ch = [];
    try { ch = L.apply(data); } catch (e) { console.warn('looks', e); }
    C.post({ type: 'looks', data: L.current() });
    if (!ch.length && !(o && o.force)) return ch;
    for (const id of ch) { const t = R.types[id]; if (t) C.forgetBlock(t.name); }
    if (VR.StudioCatalog && VR.StudioCatalog.iconsClear) VR.StudioCatalog.iconsClear();
    if (ch.some(id => R.types[id] && L.isSlot(R.types[id]))) { if (VR.StudioCatalog && VR.StudioCatalog.resetEntries) VR.StudioCatalog.resetEntries(); if (VR.Crafter && VR.Crafter.resetItems) VR.Crafter.resetItems(); }
    updateLum();
    const sc = S.scene; if (sc && sc.type === 'block' && ch.some(id => R.types[id] && R.types[id].name === sc.name)) C.showBlock(sc.name);
    return ch;
  }
  // the luminance table the recolour formula reads (the layers a look uses)
  let lumAlb = null, lum = null, lumDone = null;
  function updateLum() {
    const ti = C.texInfo(); if (!ti || !ti.albedo || !C.setAvgLum || !L.usesRC()) return;
    if (lumAlb !== ti.albedo[0]) { lumAlb = ti.albedo[0]; lum = new Float32Array(4096).fill(0.5); lumDone = new Uint8Array(4096); }
    const todo = L.rcLayers().filter(l => l >= 0 && l < 4096 && !lumDone[l]); if (!todo.length) return;
    L.lumFill(lum, lumAlb, ti.size, VR.textureMasks ? VR.textureMasks().cut : null, todo);
    for (const l of todo) lumDone[l] = 1;
    C.setAvgLum(lum);
  }
  LP.texReady = () => { lumAlb = null; setTimeout(updateLum, 0); };
  // what is stored now, and stored for good: here, in the worker, and in the game when this Studio lies over it
  function commit(data) {
    if (!L.save(data)) { C.full('looks'); return false; }
    applyHere(L.load(), { force: true });
    const w = host(); if (w) { try { w.VR.LiveLoop.apply(w.VR.game); } catch (e) { /* the storage event brings it */ } }
    for (const rec of C.HOUSE.values()) rec.stale = true;
    const sc = S.scene; if (sc && sc.type === 'house' && C.HOUSE.get(sc.index)) { const rec = C.HOUSE.get(sc.index); rec.stale = false; C.rebuildHouse(sc.index, { skin: rec.data.skin, mirror: rec.data.mirrored }); }
    if (S.mode === 'parts') { C.list(); C.chips(); }
    return true;
  }
  // the looks of this browser at once, before any palette or catalogue is built (the model variants are made again
  // when the Studio compiles its models: compileAll → Looks.remodel)
  applyHere(L.load());
  window.addEventListener('storage', (e) => { if (e.key === L.KEY && !LP.edit) { applyHere(L.load()); if (S.mode === 'parts') C.parts(); } });

  // ---------------------------------------------------------------- the editor's draft (a block or a variant)
  // LP.edit = { name, k (slot, -1), look (draft), stored (its stored look, JSON), vname }
  function begin(name) {
    const st = L.load(), k = slotK(name);
    const look = k >= 0 ? (st.slots[k] && st.slots[k].look) : st.looks[name];
    LP.edit = { name, k, look: clone(look) || {}, stored: JSON.stringify(look || {}), vname: k >= 0 && st.slots[k] ? st.slots[k].name : '' };
  }
  const dirty = () => !!LP.edit && JSON.stringify(L.cleanLook(LP.edit.look) || {}) !== JSON.stringify(L.cleanLook(JSON.parse(LP.edit.stored)) || {});
  function draftData() {
    const st = L.load(), E = LP.edit, c = L.cleanLook(E.look);
    if (E.k >= 0) { if (st.slots[E.k]) { st.slots[E.k].look = c || {}; if (E.vname && E.vname.trim()) st.slots[E.k].name = E.vname.trim().slice(0, 40); } }
    else if (c) st.looks[E.name] = c; else delete st.looks[E.name];
    return st;
  }
  let pvT = 0;
  function preview() { clearTimeout(pvT); pvT = setTimeout(() => { if (LP.edit) { applyHere(draftData()); say(tx('live.st.preview', null, 'Vorschau — ✓ Für alle bringt es ins Spiel', 'Preview — ✓ For all puts it into the game'), true, true); } }, 90); }
  // leaving the block: an unsaved preview goes back to what is stored
  LP.leave = function (next) {
    if (LP.edit && LP.edit.name !== next && dirty()) applyHere(L.load());
    if (!LP.edit || LP.edit.name !== next) { LP.edit = null; LP.msg = ''; }
  };
  function say(m, ok, soft) { LP.msg = m; LP.msgOk = ok !== false; const n = $('#partsBody .lookMsg'); if (n) { n.textContent = m; n.classList.toggle('warn', !LP.msgOk); } if (!soft) C.sys(m, ok === false ? 'err' : 'ok'); }

  // ---------------------------------------------------------------- the panel for a block (Teile)
  const SWATCH = ['#f4f1ea', '#e8dcc0', '#d8b87a', '#c8744a', '#b5423a', '#e88a2a', '#e7c24a', '#5e9a6a', '#2f8c8a', '#3f63a8', '#8a8f96', '#2b2f36'];
  const roleName = (k) => { const r = L.ROLES.find(x => x[0] === k); return r ? tx('live.role.' + k, null, r[1], r[2]) : k; };
  const patName = (sp, p) => { const list = sp && sp.kind === 'floor' ? L.FLOOR_PATS : L.WALL_PATS, e = list.find(x => x[0] === p); return e ? tx((sp && sp.kind === 'floor' ? 'live.fpat.' : 'live.wpat.') + p, null, e[1], e[2]) : p; };
  const toHex = (c) => L.int2hex(c);
  LP.box = function (el, name) {
    const kind = L.kindOf(name);
    if (!kind || kind === 'model') return;
    if (!LP.edit || LP.edit.name !== name) begin(name);
    const E = LP.edit, t = R.byName[name], k = E.k;
    const box = document.createElement('div'); box.className = 'lookBox'; box.dataset.look = name;
    const head = document.createElement('div'); head.className = 'ph lookH'; head.innerHTML = esc(tx('live.st.title', null, '🎨 Aussehen', '🎨 Looks')) + ' <small>' + esc(k >= 0 ? tx('live.st.ofVariant', null, 'dieser Variante', 'of this variant') : tx('live.st.forAll', null, 'für alle deine Welten', 'for all your worlds')) + '</small>';
    box.appendChild(head);
    const colorRow = (label, value, on, key) => {
      const r = document.createElement('div'); r.className = 'lookRow';
      const lb = document.createElement('span'); lb.className = 'lk'; lb.textContent = label;
      const inp = document.createElement('input'); inp.type = 'color'; inp.value = value; inp.dataset.role = key || '';
      inp.oninput = () => on(inp.value);
      r.appendChild(lb); r.appendChild(inp);
      return r;
    };
    if (kind === 'vx') {
      const sp = t.o.vx, orig = (r) => { const v = E.look.vx && E.look.vx[r]; return v || toHex(typeof sp[r] === 'number' ? sp[r] : 0x888888); };
      // (the spec may wear the preview already: the shown value is the draft's, else the block's own)
      const roles = L.rolesOf(name);
      for (const r of roles) box.appendChild(colorRow(roleName(r), orig(r), (v) => { E.look.vx = Object.assign({}, E.look.vx, { [r]: v }); preview(); }, r));
      const pats = L.patternsFor(name);
      if (pats.length) {
        const pr = document.createElement('div'); pr.className = 'lookPats';
        const lb = document.createElement('span'); lb.className = 'lk'; lb.textContent = tx('live.st.material', null, '🧱 Material', '🧱 Material'); pr.appendChild(lb);
        const cur = (E.look.vx && E.look.vx.pat) || sp.pat;
        for (const [p] of pats) {
          const b = document.createElement('button'); b.className = 'cbtn mini' + (p === cur ? ' on' : ''); b.dataset.pat = p; b.textContent = patName(sp, p);
          b.onclick = () => { E.look.vx = Object.assign({}, E.look.vx, { pat: p }); for (const x of pr.querySelectorAll('button')) x.classList.toggle('on', x === b); preview(); };
          pr.appendChild(b);
        }
        box.appendChild(pr);
      }
    } else {
      // Farbe: the block's own colour (its texture's detail stays)
      const cur = E.look.rc || null, ti = C.texInfo();
      let base = '#888888';
      if (ti && ti.avgColor) { const lay = R.T.tex[t.defaultState * 6 + 2] & 0xfff, a = ti.avgColor, g = (v) => Math.round(Math.pow(Math.max(0, Math.min(1, v)), 1 / 2.2) * 255); base = toHex((g(a[lay * 4]) << 16) | (g(a[lay * 4 + 1]) << 8) | g(a[lay * 4 + 2])); }
      const r = colorRow(tx('live.st.color', null, '🎨 Farbe', '🎨 Colour'), cur || base, (v) => { E.look.rc = v; sw.querySelectorAll('i').forEach(x => x.classList.remove('on')); preview(); }, 'rc');
      const none = document.createElement('button'); none.className = 'cbtn mini' + (cur ? '' : ' on'); none.dataset.act = 'noColor'; none.textContent = tx('live.st.noColor', null, '✕ wie gebaut', '✕ as built');
      none.title = tx('live.st.noColorT', null, 'Ohne eigene Farbe — die Farben der Textur', 'No colour of its own — the texture\'s colours');
      none.onclick = () => { delete E.look.rc; none.classList.add('on'); preview(); };
      r.appendChild(none); box.appendChild(r);
      const sw = document.createElement('div'); sw.className = 'lookSw';
      for (const c of SWATCH) { const i = document.createElement('i'); i.style.background = c; i.title = c; i.dataset.c = c; if (c === cur) i.className = 'on'; i.onclick = () => { E.look.rc = c; const inp = r.querySelector('input'); inp.value = c; none.classList.remove('on'); for (const x of sw.children) x.classList.toggle('on', x === i); preview(); }; sw.appendChild(i); }
      box.appendChild(sw);
      if (L.surfaceOK(name)) box.appendChild(surfaceBox(name));
    }
    // the buttons
    const row = document.createElement('div'); row.className = 'crow lookAct';
    const bOk = document.createElement('button'); bOk.className = 'cbtn pri'; bOk.dataset.act = 'lookAll'; bOk.textContent = tx('live.st.all', null, '✓ Für alle', '✓ For all');
    bOk.title = k >= 0 ? tx('live.st.allVarT', null, 'Diese Variante so speichern — im Spiel sofort', 'Save this variant like this — in the game at once') : tx('live.st.allT', null, 'In allen deinen Welten, sofort im Spiel', 'In all your worlds, in the game at once');
    bOk.onclick = () => { const d = draftData(); if (commit(d)) { LP.edit.stored = JSON.stringify(L.cleanLook(LP.edit.look) || {}); say(k >= 0 ? tx('live.st.savedVar', { n: nameOf(name) }, '✓ {n} — gespeichert, im Spiel', '✓ {n} — saved, in the game') : tx('live.st.saved', null, '✓ Im Spiel — in allen deinen Welten', '✓ In the game — in all your worlds')); } else say(tx('live.st.full', null, '⚠ Nicht gespeichert — der Browser-Speicher ist voll', '⚠ Not saved — the browser storage is full'), false); };
    const bOrig = document.createElement('button'); bOrig.className = 'cbtn'; bOrig.dataset.act = 'lookOrig'; bOrig.textContent = tx('live.st.orig', null, '↺ Original', '↺ Original');
    bOrig.title = tx('live.st.origT', null, 'Wieder wie im Original — überall', 'Back to the original — everywhere');
    bOrig.onclick = () => { LP.edit.look = {}; const d = draftData(); if (commit(d)) { LP.edit.stored = '{}'; say(tx('live.st.origDone', null, '↺ Wieder das Original', '↺ The original again')); C.parts(); } else say(tx('live.st.full', null, '⚠ Nicht gespeichert — der Browser-Speicher ist voll', '⚠ Not saved — the browser storage is full'), false); };
    const bVar = document.createElement('button'); bVar.className = 'cbtn'; bVar.dataset.act = 'lookVar'; bVar.textContent = tx('live.st.asVar', null, '⧉ Als Variante', '⧉ As a variant');
    bVar.title = tx('live.st.asVarT', null, 'Eine Kopie mit eigenem Namen — das Original bleibt', 'A copy with its own name — the original stays');
    bVar.onclick = () => asVariant(name);
    row.appendChild(bOk); row.appendChild(bOrig); row.appendChild(bVar);
    box.appendChild(row);
    const msg = document.createElement('div'); msg.className = 'note lookMsg' + (LP.msgOk ? '' : ' warn'); msg.textContent = LP.msg || (k >= 0 ? '' : tx('live.st.hint', null, 'Farbe ziehen: hier sofort zu sehen — ✓ Für alle bringt es in jede deiner Welten.', 'Drag a colour: you see it here at once — ✓ For all puts it into every world of yours.'));
    box.appendChild(msg);
    if (k >= 0) box.appendChild(variantBox(name));
    el.appendChild(box);
  };

  // „Oberfläche": the faces of another full cube — for all faces, or the top, the sides, the bottom alone
  let surfFace = 'all', surfQ = '';
  function surfaceBox(name) {
    const E = LP.edit, wrap = document.createElement('div'); wrap.className = 'lookSurf';
    const hd = document.createElement('div'); hd.className = 'lookRow';
    const lb = document.createElement('span'); lb.className = 'lk'; lb.textContent = tx('live.st.surface', null, '🪨 Oberfläche', '🪨 Surface'); hd.appendChild(lb);
    const seg = document.createElement('span'); seg.className = 'seg';
    for (const [f, de, en] of [['all', 'Alle', 'All'], ['top', 'Oben', 'Top'], ['side', 'Seite', 'Side'], ['bottom', 'Unten', 'Bottom']]) {
      const b = document.createElement('button'); b.className = 'cbtn mini' + (surfFace === f ? ' on' : ''); b.dataset.face = f; b.textContent = tx('live.st.face.' + f, null, de, en);
      b.onclick = () => { surfFace = f; for (const x of seg.children) x.classList.toggle('on', x === b); };
      seg.appendChild(b);
    }
    hd.appendChild(seg);
    const reset = document.createElement('button'); reset.className = 'cbtn mini'; reset.dataset.act = 'surfReset'; reset.textContent = tx('live.st.asBuilt', null, '✕ wie gebaut', '✕ as built');
    reset.onclick = () => { delete E.look.tex; preview(); };
    hd.appendChild(reset);
    wrap.appendChild(hd);
    const q = document.createElement('input'); q.className = 'lookQ'; q.placeholder = tx('live.st.search', null, 'Block suchen … (Stein, Ziegel, Holz)', 'Find a block … (stone, brick, wood)'); q.value = surfQ;
    const strip = document.createElement('div'); strip.className = 'lookDonors';
    const fill = () => {
      strip.innerHTML = '';
      const donors = R.types.filter(t => t.cat && L.donorOK(t.name)).map(t => t.name);
      let ids;
      if (surfQ && VR.StudioCatalog && VR.StudioCatalog.search) ids = VR.StudioCatalog.search(donors, surfQ);
      else { const sim = VR.Variants && VR.Variants.similar ? VR.Variants.similar(name, 40).filter(n => L.donorOK(n)) : []; ids = sim.concat(['stone', 'polished_andesite', 'stone_bricks', 'bricks', 'oak_planks', 'spruce_planks', 'quartz_block', 'smooth_sandstone', 'white_concrete', 'deepslate_tiles'].filter(n => R.byName[n] && L.donorOK(n) && !sim.includes(n))); }
      for (const id of ids.slice(0, 24)) {
        const b = document.createElement('button'); b.className = 'vt'; b.dataset.donor = id; b.title = nameOf(id);
        const cv = VR.StudioCatalog && VR.StudioCatalog.picture ? VR.StudioCatalog.picture(id, 34, 34) : null; if (cv) b.appendChild(cv); else b.textContent = '■';
        b.onclick = () => {
          const cur = typeof E.look.tex === 'string' ? { top: E.look.tex, side: E.look.tex, bottom: E.look.tex } : Object.assign({}, E.look.tex || {});
          if (surfFace === 'all') E.look.tex = id; else { cur[surfFace] = id; E.look.tex = cur; }
          preview();
        };
        strip.appendChild(b);
      }
    };
    q.oninput = () => { surfQ = q.value.trim(); fill(); };
    wrap.appendChild(q); wrap.appendChild(strip);
    fill();
    return wrap;
  }

  // ---------------------------------------------------------------- ⧉ Als Variante
  function defaultName(src) {
    const st = L.load(); let n = 1; const base = nameOf(src);
    const used = new Set(Object.values(st.slots).map(d => d.name));
    let nm = tx('live.st.varName', { n: base, k: n }, '{n} · Variante {k}', '{n} · variant {k}');
    while (used.has(nm) && n < 300) { n++; nm = tx('live.st.varName', { n: base, k: n }, '{n} · Variante {k}', '{n} · variant {k}'); }
    return nm;
  }
  function asVariant(name, modelPal) {
    const st = L.load(), k0 = slotK(name), srcDef = k0 >= 0 ? st.slots[k0] : null;
    const src = srcDef ? srcDef.src : name, isModel = L.kindOf(src) === 'model';
    if (!L.fits(src)) { say(L.why(R.byName[src] && R.byName[src].nstates > L.SLOT_STATES ? 'big' : 'bad'), false); return null; }
    const look = isModel ? {} : (L.cleanLook(LP.edit && LP.edit.name === name ? LP.edit.look : null) || (srcDef ? clone(srcDef.look) : {}) || {});
    const r = L.addVariant(st, { src, name: defaultName(src), look, model: isModel || undefined });
    if (!r.ok) { say(L.why(r.why), false); return null; }
    if (isModel && modelPal && VR.Custom) {
      // the variant's voxels: the source's, in the colours chosen here (its own Item-Crafter override)
      const cst = VR.Custom.load() || { v: 1, houses: {}, models: {} }; cst.models = cst.models || {};
      cst.models[r.name] = modelPal(r.name);
      if (!VR.Custom.save(cst)) { C.full('designs'); say(tx('live.st.full', null, '⚠ Nicht gespeichert — der Browser-Speicher ist voll', '⚠ Not saved — the browser storage is full'), false); return null; }
      VR.CUSTOM.models = VR.CUSTOM.models || {}; VR.CUSTOM.models[r.name] = cst.models[r.name];
      C.post({ type: 'custom', custom: VR.CUSTOM });
    }
    // the source keeps what is stored for it (an unsaved preview of it goes back)
    if (!commit(r.data)) { say(tx('live.st.full', null, '⚠ Nicht gespeichert — der Browser-Speicher ist voll', '⚠ Not saved — the browser storage is full'), false); return null; }
    LP.edit = null;
    say(tx('live.st.varNew', { n: nameOf(r.name), k: r.k + 1, m: L.SLOTS }, '⧉ {n} ist da — Platz {k} von {m}', '⧉ {n} is here — slot {k} of {m}'));
    if (isModel) { LP.model = r.name; C.setMode(C.isFacade(src) ? 'facade' : 'furn', true); C.selectModel(r.name); }
    else if (VR.StudioCatalog) { VR.StudioCatalog.edit = true; VR.StudioCatalog.open('block', r.name, S.from || null); }
    return r;
  }
  LP.asVariant = asVariant;
  // a variant: its name, where to use it, hide it
  function variantBox(name) {
    const st = L.load(), k = slotK(name), d = st.slots[k];
    const box = document.createElement('div'); box.className = 'lookVar';
    if (!d) return box;
    const hd = document.createElement('div'); hd.className = 'ph'; hd.innerHTML = esc(tx('live.st.variant', null, '⧉ Variante', '⧉ Variant')) + ' <b>' + esc(tx('live.st.slot', { k: k + 1, m: L.SLOTS }, 'Platz {k}/{m}', 'slot {k}/{m}')) + '</b>';
    box.appendChild(hd);
    const nr = document.createElement('div'); nr.className = 'lookRow';
    const lb = document.createElement('span'); lb.className = 'lk'; lb.textContent = tx('live.st.name', null, 'Name', 'Name');
    const inp = document.createElement('input'); inp.className = 'lookName'; inp.maxLength = 40; inp.value = LP.edit && LP.edit.vname ? LP.edit.vname : d.name;
    inp.oninput = () => { if (LP.edit) LP.edit.vname = inp.value; };
    inp.onchange = () => { const s2 = L.load(); if (s2.slots[k] && inp.value.trim()) { s2.slots[k].name = inp.value.trim().slice(0, 40); commit(s2); say(tx('live.st.renamed', { n: s2.slots[k].name }, '✓ Heißt jetzt {n}', '✓ Now called {n}')); } };
    nr.appendChild(lb); nr.appendChild(inp); box.appendChild(nr);
    const from = document.createElement('div'); from.className = 'note dim'; from.textContent = tx('live.st.from', { n: nameOf(d.src) }, 'eine Kopie von {n} — das Original bleibt, wie es ist', 'a copy of {n} — the original stays as it is'); box.appendChild(from);
    const row = document.createElement('div'); row.className = 'crow lookUse';
    const b1 = document.createElement('button'); b1.className = 'cbtn'; b1.dataset.act = 'varHouse'; b1.textContent = tx('live.st.inHouse', null, '🏠 In diesem Haus', '🏠 In this house');
    b1.title = tx('live.st.inHouseT', null, 'Im Crafter: alles davon in einem Haus wird die Variante', 'In the Crafter: all of it in a house becomes the variant');
    b1.onclick = () => houses(box, d.src, name);
    const b2 = document.createElement('button'); b2.className = 'cbtn'; b2.dataset.act = 'varWorld'; b2.textContent = tx('live.st.inWorld', null, '🌍 In meiner Welt', '🌍 In my world');
    b2.title = tx('live.st.inWorldT', null, 'Welt-Stil: was das Spiel davon gebaut hat, wird die Variante — was du gebaut hast, bleibt', 'World style: what the game built of it becomes the variant — what you built stays');
    b2.onclick = () => inWorld(box, d.src, name);
    const b3 = document.createElement('button'); b3.className = 'cbtn'; b3.dataset.act = 'varHand'; b3.textContent = tx('live.st.inHand', null, '✋ In die Hand', '✋ In hand');
    b3.title = tx('live.st.inHandT', null, 'In die Hand des Crafters — und im Spiel (Kreativ, Zen) in den gewählten Platz', "Into the Crafter's hand — and in the game (Creative, Zen) into the selected slot");
    b3.onclick = () => inHand(name);
    row.appendChild(b1); row.appendChild(b2); row.appendChild(b3);
    box.appendChild(row);
    const row2 = document.createElement('div'); row2.className = 'crow';
    const b4 = document.createElement('button'); b4.className = 'cbtn mini'; b4.dataset.act = 'varHide'; b4.textContent = d.hidden ? tx('live.st.show', null, '👁 Wieder zeigen', '👁 Show again') : tx('live.st.hide', null, '🗑 Ausblenden', '🗑 Hide');
    b4.title = tx('live.st.hideT', null, 'Aus den Listen nehmen — Welten, die sie enthalten, behalten sie', 'Take it out of the lists — worlds that contain it keep it');
    b4.onclick = () => { const s2 = L.hideVariant(L.load(), k, !d.hidden); if (commit(s2)) { say(d.hidden ? tx('live.st.shown', null, '👁 Wieder in den Listen', '👁 In the lists again') : tx('live.st.hidden', null, '🗑 Ausgeblendet — Welten, die sie enthalten, behalten sie', '🗑 Hidden — worlds that contain it keep it')); C.parts(); } };
    row2.appendChild(b4); box.appendChild(row2);
    return box;
  }
  // 🏠 the houses its source is built into → the Crafter on that house, every piece of the source → the variant
  function houses(box, src, varName) {
    for (const x of box.querySelectorAll('.lookPick')) x.remove();
    const p = document.createElement('div'); p.className = 'lookPick varHouses';
    const used = [];
    for (const rec of C.HOUSE.values()) { const d = rec.data || {}; if ((d.blocks || []).some(([n]) => n === src) || (d.models || []).some(([n]) => n === src)) used.push(rec); }
    const first = S.from && Number.isFinite(S.from.index) ? S.from.index : (VR.StudioCatalog && Number.isFinite(VR.StudioCatalog.lastHouse) ? VR.StudioCatalog.lastHouse : null);
    used.sort((a, b) => (b.index === first) - (a.index === first));
    if (!used.length) { p.textContent = C.HOUSE.size < C.HOUSES.length ? tx('live.st.housesWait', null, 'Die Häuser werden noch gebaut …', 'The houses are still being built …') : tx('live.st.noHouse', { n: nameOf(src) }, '{n} steckt in keinem Katalog-Haus.', '{n} is in no catalogue house.'); box.appendChild(p); return; }
    const t = document.createElement('span'); t.textContent = tx('live.st.whichHouse', null, '🏠 In welchem Haus?', '🏠 In which house?'); p.appendChild(t);
    for (const rec of used.slice(0, 8)) {
      const b = document.createElement('button'); b.className = 'cbtn mini'; b.dataset.house = rec.index; b.textContent = rec.name;
      b.onclick = () => { if (VR.Crafter && VR.Crafter.replaceIn) VR.Crafter.replaceIn(rec.index, src, varName); };
      p.appendChild(b);
    }
    box.appendChild(p);
  }
  // 🌍 a Welt-Stil rule source → variant in the world this Studio came from (or one picked here)
  async function inWorld(box, src, varName) {
    for (const x of box.querySelectorAll('.lookPick')) x.remove();
    const WM = VR.StudioWorld, WS = VR.WorldStyle;
    const go = (id, label) => {
      if (!WS) return;
      const why = WS.check(src, varName);
      if (why) { say(tx('live.st.ruleNo', null, 'Das passt nicht als Regel.', 'That does not fit as a rule.'), false); return; }
      const cur = WS.load(id), rules = ((cur && cur.rules) || []).filter(r => r[0] !== src).concat([[src, varName]]);
      if (!WS.save(id, WS.next(cur, rules, cur && cur.water))) { C.full('style'); say(tx('live.st.full', null, '⚠ Nicht gespeichert — der Browser-Speicher ist voll', '⚠ Not saved — the browser storage is full'), false); return; }
      say(tx('live.st.worldDone', { w: label || id, a: nameOf(src), b: nameOf(varName) }, '🌍 In {w}: {a} → {b} — was du gebaut hast, bleibt', '🌍 In {w}: {a} → {b} — what you built stays'));
    };
    const wid = LP.world || (WM && WM.world && WM.world.id) || null;
    if (wid) { const w = WM && WM.worlds ? WM.worlds.find(x => x.id === wid) : null; go(wid, w ? w.name : (WM && WM.world && WM.world.id === wid ? WM.world.name : '')); return; }
    if (WM && WM.list) { try { await WM.list(); } catch (e) { /* */ } }
    const ws = (WM && WM.worlds) || [];
    const p = document.createElement('div'); p.className = 'lookPick varHouses';
    if (!ws.length) { p.textContent = window.__R9_STANDALONE ? tx('live.st.noWorldSA', null, 'Dieses Studio sieht keine Welten — im Spiel: ⏸ → 🏗 Bauen.', 'This Studio sees no worlds — in the game: ⏸ → 🏗 Build.') : tx('live.st.noWorld', null, 'Noch keine Welt — spiel erst eine.', 'No world yet — play one first.'); box.appendChild(p); return; }
    const t = document.createElement('span'); t.textContent = tx('live.st.whichWorld', null, '🌍 In welcher Welt?', '🌍 In which world?'); p.appendChild(t);
    for (const w of ws.slice(0, 8)) { const b = document.createElement('button'); b.className = 'cbtn mini'; b.dataset.world = w.id; b.textContent = w.name || w.id; b.onclick = () => go(w.id, w.name); p.appendChild(b); }
    box.appendChild(p);
  }
  // ✋ into the Crafter's hand, and into the game's selected slot (Creative / Zen: start.js reads r9si.hand)
  function inHand(name) {
    const CR = VR.Crafter;
    if (CR && CR.hot) { CR.hot[CR.slot] = name; CR.recent = [name].concat((CR.recent || []).filter(x => x !== name)).slice(0, 40); if (CR.drawBar && CR.on) CR.drawBar(); }
    try { localStorage.setItem('r9si.hand', JSON.stringify({ v: 1, ding: 'b:' + name, world: LP.world || null, t: Date.now() })); } catch (e) { C.full('hand'); }
    say(tx('live.st.handDone', { n: nameOf(name) }, '✋ {n} in der Hand — im Crafter, und im Spiel (Kreativ, Zen)', '✋ {n} in hand — in the Crafter, and in the game (Creative, Zen)'));
  }

  // ---------------------------------------------------------------- ▣ Möbel: a model's colours and materials
  const MATS = [['fabric', 'Stoff', 'Fabric'], ['leather', 'Leder', 'Leather'], ['wood', 'Holz', 'Wood'], ['marble', 'Marmor', 'Marble'], ['metal', 'Metall', 'Metal'], ['plant', 'Pflanze', 'Plant'], ['stone', 'Stein', 'Stone'], ['matte', 'Matt', 'Matte'], ['gloss', 'Glanz', 'Gloss']];
  const MB = (m) => (VX.matBit ? VX.matBit(VX.MAT[m] || 0) : 0);
  const matOf = (v) => { const id = (v >>> 29) & 7; if (id) { const e = Object.entries(VX.MAT).find(x => x[1] === id); return e ? e[0] : 'matte'; } return (v & VX.GLOSS) ? 'gloss' : 'matte'; };
  const MATFLAGS = { fabric: () => MB('fabric'), leather: () => VX.GLOSS | MB('leather'), wood: () => VX.GLOSS | MB('wood'), marble: () => VX.GLOSS | MB('marble'), metal: () => VX.GLOSS | MB('metal'), plant: () => MB('plant'), stone: () => MB('stone'), matte: () => 0, gloss: () => VX.GLOSS };
  // the model's main colours: palette entries grouped by colour, the biggest first (glass and light keep their kind)
  function groups(m) {
    const n = new Map(), vol = m.vol, pal = m.pal;
    for (let i = 0; i < vol.length; i++) { const k = vol[i]; if (k) n.set(k, (n.get(k) || 0) + 1); }
    const by = new Map();
    for (const [k, cnt] of n) { const v = pal[k], key = (v & 0xffffff) + ':' + matOf(v) + ':' + (v & VX.GLASS ? 'g' : '') + (v & VX.EMIS ? 'e' : ''); let g = by.get(key); if (!g) { g = { col: v & 0xffffff, mat: matOf(v), glass: !!(v & VX.GLASS), emis: !!(v & VX.EMIS), idx: [], n: 0 }; by.set(key, g); } g.idx.push(k); g.n += cnt; }
    return [...by.values()].sort((a, b) => b.n - a.n).slice(0, 8);
  }
  // LP.model = name while the panel is open; its draft palette = { k: packed voxel }
  let MD = null;
  function modelBegin(name) {
    const m = VM.MODELS[name]; if (!m) return null;
    if (VR.Custom) { try { VR.Custom.applyModel(name, (VR.CUSTOM.models || {})[name] || null); } catch (e) { /* */ } }   // (its original is known to Custom from here on)
    MD = { name, base: Uint32Array.from(m.pal), pal: Uint32Array.from(m.pal), groups: groups(m) };
    return MD;
  }
  function modelPreview() {
    const m = VM.MODELS[MD.name]; if (!m) return;
    m.pal = Uint32Array.from(MD.pal); if (VR.Custom && VR.Custom.refreshModel) VR.Custom.refreshModel(m);
    clearTimeout(pvT); pvT = setTimeout(() => { if (S.scene && S.scene.type === 'model' && S.scene.name === MD.name) C.selectModel(MD.name, S.from); }, 60);
  }
  const overrideOf = (m, pal) => ({ v: 1, W: m.W, H: m.H, D: m.D, res: m.res, pal: Array.from(pal), rle: VR.Custom.b64(new Uint8Array(VR.Custom.rle(Uint16Array.from(m.vol)).buffer)), t: Date.now() });
  LP.modelLeave = function (next) {
    if (!MD || MD.name === next) return;
    const changed = MD.pal.some((v, i) => v !== MD.base[i]);
    if (changed && VR.Custom) { try { VR.Custom.applyModel(MD.name, (VR.CUSTOM.models || {})[MD.name] || null); } catch (e) { /* */ } C.THUMB.delete(MD.name); }
    MD = null; LP.model = null;
  };
  // the ▣ panel's 🎨 button and box (studio.js parts() → StudioCatalog.actions → here)
  LP.modelBox = function (el, name) {
    if (L.kindOf(name) !== 'model' || !VR.Custom) return;
    const row = document.createElement('div'); row.className = 'crow';
    const tb = document.createElement('button'); tb.className = 'cbtn' + (LP.model === name ? ' on' : ''); tb.dataset.act = 'lookModel'; tb.textContent = tx('live.st.title', null, '🎨 Aussehen', '🎨 Looks');
    tb.title = tx('live.st.modelT', null, 'Farben und Materialien — für alle deine Welten', 'Colours and materials — for all your worlds');
    tb.onclick = () => { if (LP.model === name) LP.modelLeave(null); else { LP.model = name; } C.parts(); };
    row.appendChild(tb); el.appendChild(row);
    if (LP.model !== name) return;
    if (!MD || MD.name !== name) modelBegin(name);
    if (!MD) return;
    const box = document.createElement('div'); box.className = 'lookBox'; box.dataset.look = name;
    const m = VM.MODELS[name], slot = slotK(name);
    for (const g of MD.groups) {
      const r = document.createElement('div'); r.className = 'lookRow';
      const inp = document.createElement('input'); inp.type = 'color'; inp.value = L.int2hex(MD.pal[g.idx[0]] & 0xffffff);
      inp.oninput = () => { const c = parseInt(inp.value.slice(1), 16); for (const k of g.idx) MD.pal[k] = ((MD.pal[k] & 0xff000000) | c) >>> 0; modelPreview(); };
      r.appendChild(inp);
      const sel = document.createElement('select'); sel.className = 'lookMat';
      for (const [k, de, en] of MATS) { const o = document.createElement('option'); o.value = k; o.textContent = tx('live.mat.' + k, null, de, en); if (k === matOf(MD.pal[g.idx[0]])) o.selected = true; sel.appendChild(o); }
      sel.disabled = g.glass || g.emis;
      sel.onchange = () => { const f = MATFLAGS[sel.value](); for (const k of g.idx) { const v = MD.pal[k]; MD.pal[k] = ((v & 0xffffff) | VX.PRESENT | (v & (VX.EMIS | VX.GLASS | VX.HOLO)) | f) >>> 0; } modelPreview(); };
      r.appendChild(sel);
      const share = document.createElement('span'); share.className = 'dim mono'; share.textContent = Math.round(g.n / Math.max(1, m.vox || g.n) * 100) + ' %'; r.appendChild(share);
      box.appendChild(r);
    }
    const act = document.createElement('div'); act.className = 'crow lookAct';
    const ok = document.createElement('button'); ok.className = 'cbtn pri'; ok.dataset.act = 'lookAll'; ok.textContent = tx('live.st.all', null, '✓ Für alle', '✓ For all');
    ok.onclick = () => {
      const cst = VR.Custom.load() || { v: 1, houses: {}, models: {} }; cst.models = cst.models || {};
      cst.models[name] = overrideOf(m, MD.pal);
      if (!VR.Custom.save(cst)) { C.full('designs'); say(tx('live.st.full', null, '⚠ Nicht gespeichert — der Browser-Speicher ist voll', '⚠ Not saved — the browser storage is full'), false); return; }
      VR.Custom.apply(cst); C.post({ type: 'custom', custom: VR.CUSTOM });
      MD.base = Uint32Array.from(MD.pal); C.THUMB.delete(name);
      const w = host(); if (w && w.VR.game && w.VR.game.reloadCustom) { try { w.VR.game.reloadCustom(); } catch (e) { /* the storage event brings it */ } }
      say(tx('live.st.saved', null, '✓ Im Spiel — in allen deinen Welten', '✓ In the game — in all your worlds'));
    };
    const orig = document.createElement('button'); orig.className = 'cbtn'; orig.dataset.act = 'lookOrig'; orig.textContent = tx('live.st.orig', null, '↺ Original', '↺ Original');
    orig.onclick = () => {
      const cst = VR.Custom.load() || { v: 1, houses: {}, models: {} };
      if (cst.models && cst.models[name]) { delete cst.models[name]; if (!VR.Custom.save(cst)) { C.full('designs'); return; } VR.Custom.apply(cst); C.post({ type: 'custom', custom: VR.CUSTOM }); const w = host(); if (w && w.VR.game && w.VR.game.reloadCustom) { try { w.VR.game.reloadCustom(); } catch (e) { /* */ } } }
      else if (VR.Custom.applyModel) VR.Custom.applyModel(name, null);
      MD = null; C.THUMB.delete(name); C.selectModel(name, S.from);
      say(tx('live.st.origDone', null, '↺ Wieder das Original', '↺ The original again'));
    };
    const vb = document.createElement('button'); vb.className = 'cbtn'; vb.dataset.act = 'lookVar'; vb.textContent = tx('live.st.asVar', null, '⧉ Als Variante', '⧉ As a variant');
    vb.title = tx('live.st.asVarT', null, 'Eine Kopie mit eigenem Namen — das Original bleibt', 'A copy with its own name — the original stays');
    vb.onclick = () => { const pal = Uint32Array.from(MD.pal); LP.modelLeave(null); asVariant(name, () => overrideOf(m, pal)); };
    act.appendChild(ok); act.appendChild(orig); if (slot < 0) act.appendChild(vb);
    box.appendChild(act);
    const msg = document.createElement('div'); msg.className = 'note lookMsg' + (LP.msgOk ? '' : ' warn'); msg.textContent = LP.msg || tx('live.st.modelHint', null, 'Farbe ziehen: hier sofort zu sehen — ✓ Für alle bringt es ins Spiel.', 'Drag a colour: you see it here at once — ✓ For all puts it into the game.');
    box.appendChild(msg);
    if (slot >= 0) box.appendChild(variantBox(name));
    el.appendChild(box);
  };

  // ---------------------------------------------------------------- the route: #look/<name>[/w/<world>]
  LP.openFor = function (name) {
    if (!R.byName[name]) { C.sys(tx('live.st.gone', { n: name }, 'Nicht gefunden: {n}', 'Not found: {n}'), 'err'); return false; }
    const kind = L.kindOf(name);
    if (kind === 'model') { LP.model = name; C.setMode(C.isFacade(name) ? 'facade' : 'furn', true); C.selectModel(name); return true; }
    if (!kind) { C.sys(tx('live.st.cannot', { n: nameOf(name) }, '{n}: Aussehen lässt sich nicht ändern', '{n}: its look cannot be changed'), 'err'); }
    if (VR.StudioCatalog) { VR.StudioCatalog.edit = true; VR.StudioCatalog.open('block', name); }
    return true;
  };
  function route() {
    const m = /^#look\/([^/]+)(?:\/w\/([^/]+))?/.exec(location.hash || ''); if (!m) return;
    let name = m[1]; try { name = decodeURIComponent(m[1]); } catch (e) { /* as it is */ }
    if (m[2]) { try { LP.world = decodeURIComponent(m[2]); } catch (e) { LP.world = m[2]; } }
    const go = () => { if (C.texInfo()) LP.openFor(name); else setTimeout(go, 300); };
    go();
  }
  window.addEventListener('load', () => setTimeout(route, 350));
  window.addEventListener('hashchange', () => { if (/^#look\//.test(location.hash || '')) route(); });
})();
