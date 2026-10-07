// ============================================================================
// R9 Studio · 🏭 Forge — architecture by symbol. Pick a type (🏢 🏠 🌉 🗼 🏛 🏰
// 🚀 🌳 🧱) or say what should come to be („Hochhaus 30 Stockwerke Glas",
// „modern house two floors flat roof"), see nine nearby variants built live
// by the worker, turn the parameter sliders and material chips (every change
// rebuilds the nine), tweak in words („höher", „mehr Glas"), then „📍 Setzen"
// puts it into the open world (the World mode's ghost; the game rebuilds it
// from the DNA, levelling the lot or dropping piers onto the land) or „🧩 Als
// Bauteil" keeps it for the Werkbank. Everything runs here and in the game,
// without any account. The ✨ wizard (Was? › Wie? › Wohin?) can drive the
// same API: VR.StudioForge.open(dna) · setText · setParam · setStyle · place.
// ============================================================================
(function () {
  'use strict';
  const C = window.__studioCore; if (!C) return;
  const { S, HOOK, $, $$ } = C;
  const Fg = VR.Forge; if (!Fg) return;
  const WM = VR.StudioWorld;
  const L = (k, de, v) => (VR.I18N && VR.I18N.t ? VR.I18N.t(k, v, de) : String(de).replace(/\{(\w+)\}/g, (m, x) => (v && v[x] !== undefined ? v[x] : m)));
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const FM = VR.StudioForge = { on: false, type: 'tower', dna: null, variants: [], sel: 0, text: '', meshes: new Map(), ver: 0, busy: 0, queue: [], lastSeed: 1 };
  const KEEP = 0xFFFF, PREV_W = 150, PREV_H = 104;

  // ---------------------------------------------------------------- the mode button in the header (added here: the header belongs to the Studio)
  (function addNav() {
    const nav = $('nav.modes'); if (!nav || nav.querySelector('[data-mode="forge"]')) return;
    const b = document.createElement('button'); b.dataset.mode = 'forge'; b.className = 'forgem';
    b.title = L('fg.navTip', '🏭 Forge — Architektur nach Symbol: Hochhaus, Haus, Brücke, Turm, Halle, Burg, Shuttle, Park, Mauer — alles hier, ohne Konto');
    b.innerHTML = '<i>🏭</i>' + esc(L('fg.nav', 'Forge'));
    nav.insertBefore(b, nav.querySelector('[data-create]') || null);
  })();

  // ---------------------------------------------------------------- state
  function current() { return FM.variants[FM.sel] || FM.dna; }
  function setBase(dna, keepSel) {
    const P = Fg.parse(dna); if (!P) return false;
    FM.dna = Fg.dna(P); FM.type = P.type;
    FM.variants = Fg.variants(FM.dna, 9);
    if (!keepSel) FM.sel = 0;
    FM.ver++;
    rebuild();
    return true;
  }
  FM.open = function (dna) { if (S.mode !== 'forge') C.setMode('forge'); if (dna) setBase(dna); };
  FM.setType = function (id) { const t = Fg.type(id); if (!t) return; FM.lastSeed = (FM.lastSeed * 1103515245 + 12345) & 0xffff || 1; setBase(Fg.dna(id, {}, FM.lastSeed, t.styles[0].id)); };
  // a wish in words: a new type when one is named, else a change of the current one
  FM.setText = function (text) {
    FM.text = text || '';
    const n = Fg.norm(text), ty = Fg.typeOf(n);
    const dna = ty ? Fg.fromText(text) : (current() ? Fg.tweak(current(), text) : Fg.fromText(text));
    if (!dna) { C.sys(L('fg.noType', 'Sag, was es sein soll: Hochhaus, Haus, Brücke, Turm, Halle, Burg, Shuttle, Park oder Mauer'), 'err'); return false; }
    setBase(dna); return true;
  };
  FM.setParam = function (k, v) { const P = Fg.parse(current()); if (!P) return; P.params[k] = +v; setBase(Fg.dna(P), false); };
  FM.setStyle = function (id) { const P = Fg.parse(current()); if (!P) return; P.style = id; setBase(Fg.dna(P), false); };
  FM.reseed = function () { const P = Fg.parse(current()); if (!P) return; P.seed = ((P.seed * 1103515245 + 12345) >>> 0) & 0xffff || 1; setBase(Fg.dna(P), false); };
  FM.select = function (i) { FM.sel = Math.max(0, Math.min(FM.variants.length - 1, i)); showSelected(); C.list(); C.parts(); C.hud(); };
  // 📍 into the open world (the World mode holds it as a ghost), else a hint
  FM.place = function () {
    const dna = current(); if (!dna) return false;
    if (!WM || !WM.world) { C.sys(L('fg.noWorld', 'Erst eine Welt öffnen (◍ Welt) — dann setzt du es hinein. Ohne Welt: 🧩 Als Bauteil.'), 'err'); tip(L('fg.noWorldTip', 'Öffne zuerst eine Welt (◍ Welt)'), false); return false; }
    C.setMode('world');
    if (WM.tab !== 'houses' && WM.tab !== 'bench') { WM.tab = 'houses'; }
    WM.toolForge(dna);
    return true;
  };
  // 🧩 the grid as a Werkbank piece (built by the worker; keep-world cells stay transparent)
  FM.asPiece = function () {
    const dna = current(); if (!dna || !WM || !WM.wb) return false;
    const m = FM.meshes.get(dna); if (!m || !m.ready) { tip(L('fg.wait', 'Noch nicht fertig gebaut — gleich'), false); return false; }
    const ops = m.ops, W = m.lot[0], D = m.lot[1];
    let y0 = 1e9, y1 = -1e9; for (let i = 1; i < ops.length; i += 4) { if (ops[i] < y0) y0 = ops[i]; if (ops[i] > y1) y1 = ops[i]; }
    if (y1 < y0) return false;
    const sy = y1 - y0 + 1, blocks = new Uint16Array(W * sy * D).fill(KEEP);
    for (let i = 0; i < ops.length; i += 4) { const x = ops[i], y = ops[i + 1] - y0, z = ops[i + 2]; if (x < 0 || z < 0 || x >= W || z >= D) continue; blocks[(y * D + z) * W + x] = ops[i + 3]; }
    WM.wb.setClip({ sx: W, sy, sz: D, blocks, name: Fg.describe(dna, true), dy: y0 });
    WM.wb.libAdd();
    return true;
  };

  // ---------------------------------------------------------------- building: every variant through the worker, one at a time
  function rebuild() {
    for (const [k, m] of FM.meshes) { if (!FM.variants.includes(k)) { if (m.gpu) C.freeSections(m.gpu); FM.meshes.delete(k); } }
    FM.queue = FM.variants.filter(d => !FM.meshes.has(d));
    pump();
    showSelected(); C.chips(); C.list(); C.parts(); C.hud();
  }
  function pump() {
    if (FM.busy || !FM.queue.length) return;
    const dna = FM.queue.shift(); if (FM.meshes.has(dna)) { pump(); return; }
    const m = { ready: false, dna }; FM.meshes.set(dna, m); FM.busy = 1;
    const ver = FM.ver;
    C.call({ type: 'place_mesh', kind: 'forge', dna }).then((r) => {
      FM.busy = 0;
      if (r.type !== 'place_mesh') { console.error(r.msg); FM.meshes.delete(dna); C.sys(L('fg.fail', 'Konnte {d} nicht bauen', { d: dna }), 'err'); pump(); return; }
      if (!FM.variants.includes(dna)) { pump(); return; }
      Object.assign(m, { ready: true, gpu: C.uploadSections(r.sections), lot: r.lot, bounds: r.bounds, top: r.top, origin: r.origin, title: r.title, ops: r.ops, n: r.ops.length / 4, level: r.level, terrain: r.terrain });
      r.sections = null;
      paint(dna);
      if (ver === FM.ver && FM.variants[FM.sel] === dna) showSelected();
      C.hud(); pump();
    });
  }
  // the scene of a built variant: its sections in grid space (one block of air around the structure)
  function sceneOf(m, dna) {
    const b = m.bounds, sx = b[3] - b[0] + 3, sy = b[4] - b[1] + 3, sz = b[5] - b[2] + 3;
    return { type: 'clip', name: dna, gpu: m.gpu, off: [0, 0, 0], center: [sx / 2, Math.min(sy / 2, 28 + sy * 0.15), sz / 2], span: Math.max(sx, sz, sy * 0.55) * 0.72, groundY: 1, noGrid: false, instances: [] };
  }
  const camOf = () => ({ yaw: 0.72, pitch: 0.42, dist: 0 });
  function paint(dna) {
    const m = FM.meshes.get(dna); if (!m || !m.ready) return;
    const cv = document.querySelector('#list .fvar[data-dna="' + CSS.escape(dna) + '"] canvas'); if (!cv) return;
    try { const shot = C.renderThumb(sceneOf(m, dna), cv.width, cv.height, camOf()); const x = cv.getContext('2d'); x.clearRect(0, 0, cv.width, cv.height); x.drawImage(shot, 0, 0); cv.classList.add('done'); } catch (e) { /* no picture then */ }
  }
  function showSelected() {
    if (!FM.on) return;
    const dna = current(), m = dna && FM.meshes.get(dna);
    if (!m || !m.ready) { if (!S.scene || S.scene.type !== 'clip' || S.scene.name !== dna) C.setScene(null); return; }
    if (S.scene && S.scene.type === 'clip' && S.scene.name === dna) return;
    const keepCam = S.scene && S.scene.type === 'clip';
    const yaw = S.cam.yaw, pitch = S.cam.pitch;
    C.setScene(sceneOf(m, dna));
    if (keepCam) { S.cam.yaw = yaw; S.cam.pitch = pitch; } else { S.cam.yaw = 0.72; S.cam.pitch = 0.36; }
    location.hash = 'forge/' + encodeURIComponent(dna);
  }

  // ---------------------------------------------------------------- hooks: the icon row, the 3 × 3 grid, the panel, the hud
  function wrap(name, fn) { const prev = HOOK[name]; HOOK[name] = function (...a) { if (FM.on && S.mode === 'forge') { const r = fn.apply(null, a); if (r !== false) return r; } return prev ? prev.apply(null, a) : false; }; }
  wrap('chips', function () {
    const el = $('#chips'); el.innerHTML = '';
    for (const t of Fg.types) { const b = document.createElement('button'); b.className = 'fgt' + (FM.type === t.id ? ' on' : ''); b.dataset.ftype = t.id; b.textContent = t.icon + ' ' + t.name; b.title = t.name; b.onclick = () => FM.setType(t.id); el.appendChild(b); }
    return true;
  });
  wrap('list', function () {
    const el = $('#list'); el.innerHTML = ''; el.classList.remove('houses', 'palette'); el.classList.add('forge');
    if (!FM.variants.length) { const d = document.createElement('div'); d.className = 'note dim'; d.textContent = L('fg.pick', 'Wähle oben ein Symbol oder sag rechts, was entstehen soll.'); el.appendChild(d); el.classList.remove('forge'); return true; }
    FM.variants.forEach((dna, i) => {
      const c = document.createElement('div'); c.className = 'card fvar' + (i === FM.sel ? ' on' : ''); c.dataset.dna = dna; c.dataset.i = i;
      const cv = document.createElement('canvas'); cv.width = PREV_W; cv.height = PREV_H; cv.className = 'th'; c.appendChild(cv);
      const P = Fg.parse(dna), t = Fg.type(P.type), st = t.style(P.style);
      c.insertAdjacentHTML('beforeend', `<div class="cap"><div class="n">${i === 0 ? '★ ' : ''}${esc(Fg.describe(dna, true).replace(/^\S+ /, ''))}</div><div class="s">${esc(st ? st.name : '')} · #${P.seed.toString(16)}</div></div>`);
      c.onclick = () => FM.select(i);
      el.appendChild(c);
      paint(dna);
    });
    return true;
  });
  let paramT = 0;
  wrap('parts', function () {
    const el = $('#partsBody'); el.innerHTML = ''; el.classList.remove('empty');
    const H = (t, b) => { const d = document.createElement('div'); d.className = 'ph'; d.innerHTML = t + (b !== undefined ? ' <b>' + b + '</b>' : ''); el.appendChild(d); };
    const btn = (label, cls, fn, title) => { const b = document.createElement('button'); b.className = 'cbtn ' + (cls || ''); b.innerHTML = label; if (title) b.title = title; b.onclick = fn; return b; };
    const row = (...bs) => { const r = document.createElement('div'); r.className = 'crow'; for (const b of bs) r.appendChild(b); el.appendChild(r); return r; };
    const note = (html, cls) => { const p = document.createElement('div'); p.className = 'note' + (cls ? ' ' + cls : ''); p.innerHTML = html; el.appendChild(p); };
    H('🏭 Forge');
    // the wish
    const tr = document.createElement('div'); tr.className = 'crow ftextrow';
    const inp = document.createElement('input'); inp.className = 'ftext'; inp.placeholder = L('fg.ask', 'Was soll entstehen? — „Hochhaus 30 Stockwerke Glas“'); inp.value = FM.text || ''; inp.autocomplete = 'off'; inp.spellcheck = false;
    inp.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); FM.setText(inp.value); } e.stopPropagation(); };
    inp.onkeyup = (e) => e.stopPropagation();
    const go = btn('✨', 'pri', () => FM.setText(inp.value), L('fg.goTip', 'Lies den Wunsch und baue ihn')); go.style.flex = '0 0 auto';
    tr.appendChild(inp); tr.appendChild(go); el.appendChild(tr);
    const dna = current();
    if (!dna) { note(L('fg.intro', 'Ein Symbol oben, ein Satz hier — die Forge baut neun Varianten, du wählst eine, stellst sie ein und setzt sie in deine Welt. Alles hier, ohne Konto.'), 'dim'); return true; }
    const P = Fg.parse(dna), t = Fg.type(P.type), m = FM.meshes.get(dna);
    H(t.icon + ' ' + esc(t.name), m && m.ready ? m.n.toLocaleString('de-DE') + ' ' + L('fg.cells', 'Zellen') : '…');
    note(esc(Fg.describe(dna)) + ' <span class="dim mono">' + esc(dna) + '</span>');
    // the parameters: a slider (or a choice) per parameter, every change rebuilds the nine after a short pause
    const pf = document.createElement('div'); pf.className = 'fparams';
    for (const pr of t.params) {
      const line = document.createElement('label'); line.className = 'fparam';
      const v = P.params[pr.k];
      if (pr.names) {
        line.innerHTML = `<span>${esc(pr.label)}</span>`;
        const sel = document.createElement('select'); sel.dataset.fp = pr.k;
        for (let i = pr.min; i <= pr.max; i++) { const o = document.createElement('option'); o.value = i; o.textContent = pr.names[i - pr.min] || String(i); if (i === v) o.selected = true; sel.appendChild(o); }
        sel.onchange = () => FM.setParam(pr.k, +sel.value);
        line.appendChild(sel);
      } else {
        line.innerHTML = `<span>${esc(pr.label)}</span><b>${v}</b>`;
        const r = document.createElement('input'); r.type = 'range'; r.min = pr.min; r.max = pr.max; r.step = pr.step || 1; r.value = v; r.dataset.fp = pr.k;
        r.oninput = () => { line.querySelector('b').textContent = r.value; clearTimeout(paramT); paramT = setTimeout(() => FM.setParam(pr.k, +r.value), 250); };
        line.appendChild(r);
      }
      pf.appendChild(line);
    }
    el.appendChild(pf);
    // materials
    const sr = document.createElement('div'); sr.className = 'fstyles';
    for (const st of t.styles) { const b = document.createElement('button'); b.className = 'fstyle' + (st.id === P.style ? ' on' : ''); b.dataset.fstyle = st.id; b.textContent = st.name; b.onclick = () => FM.setStyle(st.id); sr.appendChild(b); }
    el.appendChild(sr);
    row(btn('🎲 ' + L('fg.other', 'Andere'), '', FM.reseed, L('fg.otherTip', 'Neun andere Varianten')), btn('⬆ ' + L('fg.taller', 'Höher'), '', () => FM.setText('höher')), btn('↔ ' + L('fg.wider', 'Breiter'), '', () => FM.setText('breiter')));
    // where it goes
    H(L('fg.where', 'Wohin?'));
    const pb = btn('📍 ' + L('fg.place', 'Setzen'), 'pri', FM.place, WM && WM.world ? L('fg.placeTip', 'In die offene Welt: zeig auf den Boden, Klick setzt — das Spiel baut es') : L('fg.placeNoWorld', 'Erst eine Welt öffnen (◍ Welt)'));
    pb.dataset.act = 'fplace';
    const lb = btn('🧩 ' + L('fg.piece', 'Als Bauteil'), WM && WM.world ? '' : 'pri', FM.asPiece, L('fg.pieceTip', 'Für die Werkbank behalten')); lb.dataset.act = 'fpiece';
    row(pb, lb);
    if (!(WM && WM.world)) note(L('fg.noWorldNote', 'Keine Welt offen: ◍ Welt öffnet eine — oder behalte es als 🧩 Bauteil.'), 'dim');
    else note(WM && WM.world ? L('fg.inWorld', 'Welt: <b>{n}</b> — das Spiel ebnet das Grundstück (Brücken und Mauern folgen dem Gelände) und baut große Stücke in Scheiben; ▶ Spielen landet davor.', { n: esc(WM.world.name) }) : '', 'dim');
    H(L('fg.how', 'So geht’s'));
    note(L('fg.help', '<b>Symbol</b> oben = Art · <b>Satz</b> = Wunsch (auch „höher“, „mehr Glas“, „ohne Balkon“) · <b>Karte</b> links = Variante · <b>Regler</b> = Maße · <b>Stoff</b> = Material. Jede Änderung baut die neun neu.'));
    return true;
  });
  wrap('hud', function () {
    const dna = current(), m = dna && FM.meshes.get(dna);
    $('#hudName').textContent = dna ? Fg.describe(dna, true) : '🏭 Forge';
    $('#hudMeta').innerHTML = dna ? (m && m.ready ? `<b>${m.lot[0]} × ${m.lot[1]}</b> · <b>${m.top + 1}</b> hoch · <b>${m.n.toLocaleString('de-DE')}</b> Zellen` : L('fg.building', 'wird gebaut …')) + (FM.queue.length || FM.busy ? ' · ⏳ ' + (FM.queue.length + FM.busy) : '') : L('fg.hudIdle', 'Symbol wählen oder einen Satz sagen');
    return true;
  });
  wrap('key', function (e, down) {
    if (!down) return false;
    if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return false;
    const k = e.key;
    if (k >= '1' && k <= '9' && FM.variants.length) { FM.select(+k - 1); return true; }
    if (k === 'r' || k === 'R') { FM.reseed(); return true; }
    return false;
  });
  let tipT = 0;
  function tip(text, ok) { let t = $('#worldTip'); if (!t) { t = document.createElement('div'); t.id = 'worldTip'; $('main').appendChild(t); } t.textContent = text; t.className = 'on' + (ok === false ? ' err' : ok ? ' ok' : ''); clearTimeout(tipT); tipT = setTimeout(() => { t.className = ''; }, 2600); }

  // ---------------------------------------------------------------- the mode
  C.MODES.forge = {
    enter() {
      FM.on = true; S.mode = 'forge'; S.cat = 'all';
      for (const b of $$('nav.modes button[data-mode]')) b.classList.toggle('on', b.dataset.mode === 'forge');
      for (const t of $$('.tab')) t.classList.toggle('on', t.dataset.pane === 'parts');
      for (const p of $$('.pane')) p.classList.toggle('on', p.id === 'parts');
      $('#studio').classList.add('forging');
      if (!FM.dna) { const h = (location.hash || '').slice(1); if (h.startsWith('forge/') && Fg.parse(decodeURIComponent(h.slice(6)))) setBase(decodeURIComponent(h.slice(6))); else setBase(Fg.dna('tower', {}, 3, 'glas')); }
      else rebuild();
      location.hash = 'forge/' + encodeURIComponent(current() || '');
    },
    leave() { FM.on = false; $('#studio').classList.remove('forging'); },
  };
  // deep link: #forge/<dna>
  window.addEventListener('load', () => setTimeout(() => { const h = location.hash || ''; if (h.startsWith('#forge')) C.setMode('forge'); }, 300));
})();
