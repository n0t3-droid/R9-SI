// ============================================================================
// ✨ Erschaffen (W2, spec §5): one dialog in three steps — „Was? › Wie? ›
// Wohin?" — the same in the game (over the world, from the start screen, from
// the Bauhand's ✨) and in the R9 Studio. Was?: big picture tiles (VR.WizKinds)
// and one line „oder sag es: …". Wie?: six pictures, the first one lit; a click
// lights one, a click on the lit one (or Weiter) goes on; 🎲 shows six others;
// „✨ Sag, was anders sein soll" changes the lit one. Weiter keeps it in
// 🎒 Meins first (a Genie thing as g: and its blocks as a Bauteil, a Baukasten
// house as k: and its blocks, a Forge thing as f:<dna> ★). Wohin?: 🧍 Vor mir
// (in your hand) · 📍 An meinem Platz · 🗺 Auf der Karte — the page decides what
// it offers and does it. Nothing touches a world before Wohin?. ← one step
// back on every step, Esc closes, the keyboard does everything (Tab, arrows,
// 1–6, Enter). Pictures are drawn one per frame (VR.IsoPic, no WebGL).
// The page sets VR.Wizard.host = { name, ready() → Promise, colors() → colorOf,
//   forge(dna) → Promise<{ops}>, house(i) → Promise<{ops}>, model(name, w, h) →
//   canvas|null, projects?: {put, setData, thumb}, wheres(ctx) → [ids],
//   place(where, ding, thing, ctx) → boolean, studio(tile) }
// ============================================================================
(function (VR) {
  'use strict';
  const W = VR.Wizard = { host: null };
  const K = () => VR.WizKinds;
  const tx = (k, v, de, en) => (VR.I18N && VR.I18N.tx ? VR.I18N.tx(k, v, de, en) : String(de).replace(/\{(\w+)\}/g, (m, x) => (v && v[x] !== undefined ? v[x] : m)));
  const hasDoc = typeof document !== 'undefined';
  const $ = (s, r) => (hasDoc ? (r || document).querySelector(s) : null);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const label = (t) => tx(t.label[0], null, t.label[1], t.label[2]);
  // the state of one session: the step, the tile, its six, the lit one, what was kept
  let S = null;
  W.isOpen = () => !!S;
  W.state = () => S;

  // ---------------------------------------------------------------- open · close · steps
  W.open = function (o) {
    o = o || {};
    if (!hasDoc || !K()) return false;
    const H = W.host; if (!H) return false;
    S = { step: 1, from: o.from || H.name, tile: null, six: null, lit: 0, seed: 1, sub: null, more: false, kept: null, ctx: o, busy: 0, pics: new Map(), ver: 0 };
    ensure();
    const box = $('#wizard'); box.classList.add('on'); box.classList.toggle('studio', H.name === 'studio');
    if (H.onOpen) H.onOpen(o);
    Promise.resolve(H.ready ? H.ready() : true).catch(() => false).then(() => {
      if (!S) return;
      if (o.edit) return startEdit(o.edit);
      if (o.wish) return W.wish(o.wish);
      if (o.tile) return W.pick(o.tile);
      render();
    });
    render();
    return true;
  };
  W.close = function (why) {
    if (!S) return false;
    const H = W.host, ctx = S.ctx; S = null;
    const box = $('#wizard'); if (box) { box.classList.remove('on'); $('.wz-body', box).innerHTML = ''; }
    if (H && H.onClose) H.onClose(why || 'close', ctx);
    return true;
  };
  W.back = function () {
    if (!S) return;
    if (S.step === 3) { S.step = 2; render(); return; }
    if (S.step === 2) { if (S.ctx.edit) { W.close('back'); return; } S.step = 1; S.six = null; render(); return; }
    if (S.more) { S.more = false; render(); return; }
    W.close('back');
  };
  // a tile: its six
  W.pick = function (id) {
    if (!S) return;
    const t = K().tile(id); if (!t) return;
    if (t.src === 'more') { S.more = true; render(); return; }
    if (t.src === 'studio') { if (W.host.studio) { W.close('studio'); W.host.studio(t.studio); } return; }
    S.tile = id; S.seed = 1; S.sub = null; S.type = null; S.step = 2; S.lit = 0; S.note = '';
    S.six = K().six(id, { seed: 1 }); S.sub = S.six.sub || null;
    render();
  };
  W.reroll = function () { if (!S || !S.tile) return; S.seed++; S.six = K().six(S.tile, { seed: S.seed, sub: S.sub, type: S.type }); S.lit = 0; S.note = ''; render(); };
  W.chip = function (sub) { if (!S || !S.tile) return; S.sub = sub; S.seed = 1; S.six = K().six(S.tile, { seed: 1, sub }); S.lit = 0; render(); };
  W.light = function (i) {
    if (!S || !S.six || !S.six.things[i]) return;
    if (S.lit === i && S.step === 2) { W.next(); return; }
    S.lit = i;
    for (const c of document.querySelectorAll('#wizard .wz-var')) { const on = +c.dataset.i === i; c.classList.toggle('on', on); c.setAttribute('aria-pressed', String(on)); }
  };
  // a typed wish (Was?): its tile and six; an unknown one: suggestions as chips
  W.wish = function (text) {
    if (!S) return;
    const r = K().wish(text);
    if (!r || r.error) { S.note = r && r.error === 'unknown' ? { text: tx('wiz.unknown', { w: String(text).slice(0, 30) }, '„{w}" kenne ich noch nicht — vielleicht eins davon?', 'I don\'t know “{w}” yet — maybe one of these?'), chips: r.suggestions || [] } : ''; S.step = 1; S.more = false; render(); return; }
    S.tile = r.tile; S.six = r; S.sub = r.sub || null; S.type = r.type || null; S.seed = 1; S.lit = 0; S.step = 2; S.note = '';
    render();
  };
  // „✨ Sag, was anders sein soll": the lit one, changed (it takes the lit place)
  W.change = function (text) {
    if (!S || !S.six) return;
    const lit = S.six.things[S.lit], ch = K().change(lit, text);
    if (!ch) { S.note = { text: tx('wiz.nochange', null, 'Was soll anders werden? Zum Beispiel:', 'What should change? For example:'), chips: hintsFor(lit) }; render(); return; }
    S.six.things[S.lit] = ch; S.note = '';
    render();
  };
  const hintsFor = (t) => (t && t.src === 'forge' ? ['höher', 'breiter', 'mehr Glas', 'aus Stein'] : t && t.src === 'kit' ? ['rotes Dach', 'drei Etagen', 'mit Pool', 'aus Holz'] : t && t.src === 'genie' && VR.GenieBrain && t.design.recipe ? VR.GenieBrain.hintsFor(t.design.recipe.type).slice(0, 4) : ['größer', 'kleiner']);
  // Weiter: kept in 🎒 Meins, then Wohin?
  W.next = function () {
    if (!S || !S.six) return;
    const thing = S.six.things[S.lit]; if (!thing) return;
    let kept = null; try { kept = keep(thing); } catch (e) { console.warn('wizard keep', e); kept = null; }
    if (!kept) { S.note = { text: tx('wiz.notKept', null, 'Das ging nicht — noch einmal?', 'That did not work — once more?'), chips: [] }; render(); return; }
    S.kept = kept; S.step = 3;
    render();
  };
  W.where = function (id) {
    if (!S || !S.kept) return false;
    const H = W.host, k = S.kept, ctx = S.ctx;
    let ok = false; try { ok = H.place(id, k.ding, k.thing, Object.assign({ name: k.name }, ctx)); } catch (e) { console.warn('wizard place', e); ok = false; }
    if (ok !== false) W.close('placed');
    return ok;
  };

  // ---------------------------------------------------------------- ✏️ a ✨ thing that stands: open on its Wie?
  function startEdit(ding) {
    const D = VR.Ding, d = D && D.parse(ding); if (!d) { render(); return; }
    let first = null, tile = null;
    if (d.kind === 'f') { const F = VR.Forge, P = F && F.parse(d.key); if (P) { tile = K().forgeTile(P.type) || 'hochhaus'; first = { dna: d.key }; } }
    else if (d.kind === 'p') {
      const it = (VR.Pack && VR.Pack.libLoad ? VR.Pack.libLoad() : []).find(x => x && x.id === d.key), o = it && it.origin;
      if (o && o.kind === 'genie' && o.recipe && VR.GenieBrain) { const T = VR.GenieBrain.lib(o.recipe.type); tile = T ? ({ vehicle: 'fahrzeug', animal: 'tier', figure: 'figur', nature: 'natur', thing: 'ding', building: 'gebaeude' })[T.cat] : null; first = { recipe: o.recipe, name: it.name }; }
      else if (o && o.kind === 'kit' && o.spec) { tile = 'haus'; first = { spec: o.spec }; }
    }
    if (!tile) { render(); return; }
    let six = null;
    if (first.dna) six = { tile, things: K().six(tile, { base: first.dna }).things };
    else if (first.spec) { const s = K().six('haus', { seed: 1, sub: first.spec.style }); s.things = [{ key: 'k:edit', src: 'kit', spec: first.spec, name: first.spec.name || 'Haus' }].concat(s.things.slice(0, 5)); six = s; }
    else if (first.recipe) { const B = VR.GenieBrain, m = B.buildModel(first.recipe); const s = K().six(tile, { type: first.recipe.type }); s.things = [{ key: 'g:edit', src: 'genie', design: { kind: 'model', model: m, recipe: first.recipe, name: first.name }, name: first.name }].concat(s.things.filter(t => JSON.stringify(t.design.recipe) !== JSON.stringify(first.recipe)).slice(0, 5)); six = s; }
    S.tile = tile; S.six = six; S.lit = 0; S.step = 2; S.edit = ding;
    render();
  }

  // ---------------------------------------------------------------- Weiter: into 🎒 Meins
  // → {ding (what the hand holds), thing, name}
  const lsSet = (k, v) => { try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); return true; } catch (e) { return false; } };
  const lsGet = (k) => { try { const t = localStorage.getItem(k); return t ? JSON.parse(t) : null; } catch (e) { return null; } };
  // the projects list without the Studio (the game writes the same keys; the Studio reads them)
  const PJ_LS = {
    newId: (k) => k + Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36),
    put(id, patch) { const d = lsGet('r9si.projects') || { v: 1, items: {} }; if (!d.items || typeof d.items !== 'object') d.items = {}; const now = Date.now(); const p = d.items[id] || (d.items[id] = { id, created: now }); Object.assign(p, patch, { t: now, hide: false, done: false }); return lsSet('r9si.projects', d); },
    setData: (id, data) => lsSet('r9si.wip.' + id, data),
    thumb(id, cv) { if (!cv || !cv.width) return false; const c = document.createElement('canvas'); c.width = 480; c.height = 300; const x = c.getContext('2d'); x.fillStyle = '#0b1222'; x.fillRect(0, 0, 480, 300); const k = Math.min(480 / cv.width, 300 / cv.height); x.drawImage(cv, (480 - cv.width * k) / 2, (300 - cv.height * k) / 2, cv.width * k, cv.height * k); let u = ''; try { u = c.toDataURL('image/jpeg', 0.8); } catch (e) { return false; } return lsSet('r9si.thumb.' + id, u); },
  };
  function keep(thing) {
    const H = W.host, P = H.projects || PJ_LS, Favs = VR.Favs, pic = S.pics.get(thing.key) || null;
    if (thing.src === 'forge') { const ding = 'f:' + thing.dna; if (Favs) Favs.add(ding); return { ding, thing, name: thing.name }; }
    if (thing.src === 'model') { return { ding: thing.ding, thing, name: thing.name }; }
    if (thing.src === 'house') { return { ding: thing.ding, thing, name: thing.name }; }
    // a Baukasten house or a Genie thing: its blocks as a Bauteil (what the game builds), the project to tune it later
    const g = K().grid(thing); if (!g) return null;
    const small = smallThumb(pic);
    const origin = thing.src === 'kit' ? { kind: 'kit', spec: thing.spec, level: true } : { kind: 'genie', recipe: thing.design.recipe || null };
    const it = K().libItem(g, { name: thing.name, origin, thumb: small });
    const items = (VR.Pack && VR.Pack.libLoad ? VR.Pack.libLoad() : []).slice();
    items.unshift(it);
    if (!lsSet('r9si.library', { v: 1, items, t: Date.now() })) { if (H.full) H.full('library'); return null; }
    const kind = thing.src === 'kit' ? 'kit' : 'genie', pid = (P.newId || PJ_LS.newId)(kind === 'kit' ? 'k' : 'g');
    P.put(pid, kind === 'kit' ? { kind, name: thing.name, piece: it.id, info: { floors: thing.spec.floors, w: thing.spec.width, d: thing.spec.depth, style: thing.spec.style } } : { kind, name: thing.name, piece: it.id, info: { kind: 'model' } });
    P.setData(pid, kind === 'kit' ? { v: 1, spec: thing.spec, wish: '' } : { v: 1, last: thing.design, hist: [], text: '', size: 32 });
    if (pic) P.thumb(pid, pic, 'contain');
    if (Favs) Favs.add((kind === 'kit' ? 'k:' : 'g:') + pid);
    return { ding: 'p:' + it.id, thing, name: thing.name, project: (kind === 'kit' ? 'k:' : 'g:') + pid, piece: it.id };
  }
  function smallThumb(cv) { if (!cv || !cv.width) return undefined; const c = document.createElement('canvas'); c.width = 128; c.height = 96; const x = c.getContext('2d'); const k = Math.min(128 / cv.width, 96 / cv.height); x.drawImage(cv, (128 - cv.width * k) / 2, (96 - cv.height * k) / 2, cv.width * k, cv.height * k); try { return c.toDataURL('image/png'); } catch (e) { return undefined; } }
  W.keep = keep;

  // ---------------------------------------------------------------- pictures: one per frame
  const PW = 240, PH = 180;
  let queue = [], pumping = false;
  function want(thing, canvas) { queue.push([thing, canvas, S && S.ver]); if (!pumping) { pumping = true; requestAnimationFrame(pump); } }
  function pump() {
    pumping = false;
    if (!S || !queue.length) { queue = []; return; }
    const [thing, cv, ver] = queue.shift();
    if (ver !== S.ver || !cv.isConnected) { if (queue.length) { pumping = true; requestAnimationFrame(pump); } return; }
    draw(thing, cv).catch(() => false).then(() => { if (queue.length) { pumping = true; requestAnimationFrame(pump); } });
  }
  async function draw(thing, cv) {
    const H = W.host, have = S && S.pics.get(thing.key);
    const put = (src) => { if (!src) return; const x = cv.getContext('2d'); x.clearRect(0, 0, cv.width, cv.height); const k = Math.min(cv.width / src.width, cv.height / src.height); x.drawImage(src, (cv.width - src.width * k) / 2, (cv.height - src.height * k) / 2, src.width * k, src.height * k); cv.classList.add('done'); if (S) S.pics.set(thing.key, src); };
    if (have) { put(have); return; }
    if (thing.src === 'model') { const c = H.model ? H.model(thing.model, PW, PH) : null; put(c); return; }
    let src = null;
    if (thing.src === 'forge' && H.forge) src = await H.forge(thing.dna);
    else if (thing.src === 'house' && H.house) src = await H.house(thing.index);
    else src = K().grid(thing);
    if (!src || !S || !VR.IsoPic) return;
    const col = H.colors ? H.colors() : null; if (!col) return;
    if (src instanceof HTMLCanvasElement || (typeof HTMLImageElement !== 'undefined' && src instanceof HTMLImageElement)) { put(src); return; }
    put(VR.IsoPic.toCanvas(VR.IsoPic.render(src, PW, PH, col)));
  }

  // ---------------------------------------------------------------- the dialog
  function ensure() {
    if ($('#wizard')) return;
    const box = el('div', 'wizard'); box.id = 'wizard';
    box.innerHTML = `<div class="wz-panel" role="dialog" aria-modal="true"><header class="wz-head"><button type="button" class="wz-back"></button><ol class="wz-steps"><li data-s="1"></li><li data-s="2"></li><li data-s="3"></li></ol><button type="button" class="wz-x"></button></header><div class="wz-body"></div></div>`;
    const root = (W.host && W.host.root && W.host.root()) || $('#ui') || document.body;
    root.appendChild(box);
    $('.wz-back', box).onclick = () => W.back();
    $('.wz-x', box).onclick = () => W.close('x');
    box.addEventListener('mousedown', (e) => { if (e.target === box) W.close('outside'); });
  }
  function head() {
    const box = $('#wizard'); if (!box) return;
    $('.wz-panel', box).setAttribute('aria-label', tx('wiz.title', null, '✨ Erschaffen', '✨ Create'));
    const steps = [tx('wiz.step.was', null, 'Was?', 'What?'), tx('wiz.step.wie', null, 'Wie?', 'How?'), tx('wiz.step.wohin', null, 'Wohin?', 'Where?')];
    for (const li of box.querySelectorAll('.wz-steps li')) { const s = +li.dataset.s; li.textContent = steps[s - 1]; li.classList.toggle('on', S && S.step === s); li.classList.toggle('done', S && S.step > s); li.setAttribute('aria-current', S && S.step === s ? 'step' : 'false'); }
    const b = $('.wz-back', box); b.textContent = '←'; b.title = tx('wiz.backT', null, 'Zurück', 'Back'); b.setAttribute('aria-label', b.title);
    const x = $('.wz-x', box); x.textContent = '✕'; x.title = tx('wiz.closeT', null, 'Schließen · Esc', 'Close · Esc'); x.setAttribute('aria-label', x.title);
  }
  function render() {
    if (!S) return;
    S.ver++; queue = [];
    head();
    const body = $('#wizard .wz-body'); body.innerHTML = '';
    body.dataset.step = S.step;
    if (S.step === 1) renderWas(body);
    else if (S.step === 2) renderWie(body);
    else renderWohin(body);
  }
  W.render = render;
  function noteRow(body) {
    if (!S.note) return;
    const n = el('div', 'wz-note'); n.appendChild(el('span', '', esc(S.note.text)));
    for (const c of S.note.chips || []) { const b = el('button', 'wz-chip'); b.type = 'button'; b.textContent = c; b.onclick = () => (S.step === 2 ? W.change(c) : W.wish(c)); n.appendChild(b); }
    body.appendChild(n);
  }
  function wishRow(body, ph, go, val) {
    const row = el('form', 'wz-wish'); row.setAttribute('autocomplete', 'off');
    const inp = el('input'); inp.type = 'text'; inp.placeholder = ph; inp.value = val || ''; inp.maxLength = 120; inp.setAttribute('aria-label', ph); inp.spellcheck = false;
    inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); if (inp.value) inp.value = ''; else W.close('esc'); } });
    inp.addEventListener('keyup', (e) => e.stopPropagation());
    const b = el('button', 'wz-go'); b.type = 'submit'; b.textContent = '✨'; b.title = tx('wiz.goT', null, 'Los', 'Go'); b.setAttribute('aria-label', b.title);
    row.onsubmit = (e) => { e.preventDefault(); const v = inp.value.trim(); if (v) go(v); };
    row.appendChild(inp); row.appendChild(b); body.appendChild(row);
    return inp;
  }
  // Was?: the tiles (or „Mehr")
  function renderWas(body) {
    const list = S.more ? K().more() : K().tiles();
    body.appendChild(el('h2', 'wz-q', esc(S.more ? tx('wiz.more', null, 'Noch mehr', 'Even more') : tx('wiz.q.was', null, 'Was soll entstehen?', 'What shall it be?'))));
    const grid = el('div', 'wz-tiles' + (S.more ? ' more' : ''));
    list.forEach((t, i) => {
      const b = el('button', 'wz-tile'); b.type = 'button'; b.dataset.tile = t.id; b.style.setProperty('--i', i);
      b.innerHTML = `<span class="wz-ticon" aria-hidden="true">${t.icon}</span><span class="wz-tlbl">${esc(label(t))}</span>`;
      b.onclick = () => W.pick(t.id);
      grid.appendChild(b);
    });
    body.appendChild(grid);
    if (!S.more) wishRow(body, tx('wiz.say', null, 'oder sag es: Feuerwehrauto, Hochhaus mit 30 Stockwerken …', 'or say it: fire truck, skyscraper with 30 floors …'), (v) => W.wish(v));
    noteRow(body);
    setTimeout(() => { const f = $('#wizard .wz-tile'); if (f && S && S.step === 1) f.focus({ preventScroll: true }); }, 20);
  }
  // Wie?: six pictures, chips, 🎲, the change line, Weiter
  function renderWie(body) {
    const t = K().tile(S.tile), six = S.six || { things: [] };
    const top = el('div', 'wz-wiehead');
    top.appendChild(el('h2', 'wz-q', `<span aria-hidden="true">${t ? t.icon : '✨'}</span> ${esc(t ? label(t) : '')}`));
    if (six.chips && six.chips.length) {
      const ch = el('div', 'wz-chips');
      for (const c of six.chips) { const b = el('button', 'wz-chip' + (S.sub === c.id || (!S.sub && c.id === six.chips[0].id && t && t.src === 'model') ? ' on' : '')); b.type = 'button'; b.textContent = c.icon + ' ' + tx(c.label[0], null, c.label[1], c.label[2]); b.onclick = () => W.chip(c.id); ch.appendChild(b); }
      top.appendChild(ch);
    }
    body.appendChild(top);
    const grid = el('div', 'wz-vars');
    if (!six.things.length) grid.appendChild(el('div', 'wz-empty', esc(tx('wiz.loading', null, 'Einen Moment …', 'One moment …'))));
    six.things.forEach((th, i) => {
      const c = el('button', 'wz-var' + (i === S.lit ? ' on' : '')); c.type = 'button'; c.dataset.i = i; c.style.setProperty('--i', i); c.setAttribute('aria-pressed', String(i === S.lit));
      const cv = el('canvas'); cv.width = PW; cv.height = PH; c.appendChild(cv);
      c.appendChild(el('span', 'wz-vname', esc(th.name)));
      c.appendChild(el('kbd', '', String(i + 1))).setAttribute('aria-hidden', 'true');
      c.setAttribute('aria-label', (i + 1) + ' · ' + th.name);
      c.onclick = () => W.light(i);
      grid.appendChild(c);
      want(th, cv);
    });
    body.appendChild(grid);
    const row = el('div', 'wz-row');
    const other = el('button', 'wz-btn'); other.type = 'button'; other.dataset.act = 'other'; other.textContent = tx('wiz.other', null, '🎲 Andere', '🎲 Others'); other.onclick = () => W.reroll();
    row.appendChild(other);
    const lit = six.things[S.lit];
    const changeOK = lit && (lit.src === 'forge' || ((lit.src === 'kit' || lit.src === 'genie') && VR.GenieBrain));
    const ch = el('div', 'wz-change'); if (changeOK) wishRow(ch, tx('wiz.change', null, '✨ Sag, was anders sein soll …', '✨ Say what should be different …'), (v) => W.change(v));
    row.appendChild(ch);
    const nx = el('button', 'wz-btn pri'); nx.type = 'button'; nx.dataset.act = 'next'; nx.textContent = tx('wiz.next', null, 'Weiter ›', 'Next ›'); nx.disabled = !lit; nx.onclick = () => W.next();
    row.appendChild(nx);
    body.appendChild(row);
    noteRow(body);
    setTimeout(() => { const f = $('#wizard .wz-var.on') || $('#wizard .wz-var'); if (f && S && S.step === 2 && !(document.activeElement && document.activeElement.tagName === 'INPUT')) f.focus({ preventScroll: true }); }, 20);
  }
  // Wohin?: the kept thing, and the ways into a world the page offers
  const WHERE = {
    hand: () => ['🧍', tx('wiz.w.hand', null, 'Vor mir', 'In front of me'), tx('wiz.w.handS', null, 'In deiner Hand — ein Klick setzt es', 'In your hand — one click places it')],
    spot: () => ['📍', tx('wiz.w.spot', null, 'An meinem Platz', 'At my spot'), tx('wiz.w.spotS', null, 'Es entsteht vor deinem Platz — ohne Zielen', 'It appears in front of your spot — no aiming')],
    map: () => ['🗺', tx('wiz.w.map', null, 'Auf der Karte', 'On the map'), tx('wiz.w.mapS', null, 'Von oben aussuchen', 'Choose from above')],
    here: () => ['🔁', tx('wiz.w.here', null, 'An seiner Stelle', 'In its place'), tx('wiz.w.hereS', null, 'Das alte geht, das neue kommt', 'The old one goes, the new one comes')],
    keep: () => ['🎒', tx('wiz.w.keep', null, 'Nur merken', 'Just keep it'), tx('wiz.w.keepS', null, 'Es wartet in 🎒 Meins', 'It waits in 🎒 Mine')],
  };
  function renderWohin(body) {
    const k = S.kept, H = W.host;
    const wrap = el('div', 'wz-wohin');
    const left = el('div', 'wz-chosen');
    const cv = el('canvas'); cv.width = PW; cv.height = PH; left.appendChild(cv);
    left.appendChild(el('div', 'wz-cname', esc(k.name)));
    left.appendChild(el('div', 'wz-kept', esc(tx('wiz.kept', null, '✓ In 🎒 Meins', '✓ In 🎒 Mine'))));
    want(k.thing, cv);
    wrap.appendChild(left);
    const right = el('div', 'wz-wheres');
    right.appendChild(el('h2', 'wz-q', esc(tx('wiz.q.wohin', null, 'Wohin damit?', 'Where shall it go?'))));
    const ids = H.wheres ? H.wheres(Object.assign({ ding: k.ding, thing: k.thing, edit: S.edit }, S.ctx)) : ['hand'];
    ids.forEach((id, i) => {
      const w = WHERE[id]; if (!w) return;
      const [icon, name, sub] = w();
      const b = el('button', 'wz-where'); b.type = 'button'; b.dataset.where = id; b.style.setProperty('--i', i);
      b.innerHTML = `<span class="wz-wicon" aria-hidden="true">${icon}</span><span class="wz-wtxt"><b>${esc(name)}</b><small>${esc(sub)}</small></span><kbd aria-hidden="true">${i + 1}</kbd>`;
      b.onclick = () => W.where(id);
      right.appendChild(b);
    });
    wrap.appendChild(right);
    body.appendChild(wrap);
    setTimeout(() => { const f = $('#wizard .wz-where'); if (f && S && S.step === 3) f.focus({ preventScroll: true }); }, 20);
  }

  // ---------------------------------------------------------------- 📍 An meinem Platz: no aiming
  // the plan goes six blocks in front of the spawn point (the way you looked), its front toward the spawn; its floor is
  // found when the ground is loaded (settle); the landing is the spawn point, looking at it. Both pages use this.
  // → {plan, landing: {pos, yaw, pitch, label, box}}
  const ROT = [(u, v) => [u, v], (u, v) => [-v, u], (u, v) => [-u, -v], (u, v) => [v, -u]], FRONT = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  W.lotOf = function (ding) {
    const d = VR.Ding && VR.Ding.parse(ding); if (!d) return null;
    if (d.kind === 'f') { const m = VR.Forge && VR.Forge.meta(d.key); return m ? { lot: m.lot, level: m.level, top: 12 } : null; }
    if (d.kind === 'h') { const P = VR.VillageGen && VR.VillageGen.plan2, c = P && P.CATALOGUE[+d.key]; return c ? { lot: c.lot, level: true, top: 14 } : null; }
    if (d.kind === 'p') { const it = (VR.Pack && VR.Pack.libLoad ? VR.Pack.libLoad() : []).find(x => x && x.id === d.key); return it ? { lot: [it.sx, it.sz], level: !!(it.origin && it.origin.level), top: it.sy + (it.dy | 0) } : null; }
    if (d.kind === 'm') { const VM = VR.VM, m = VM && VM.MODELS[d.key]; if (!m) return null; let W0 = 1, D0 = 1, top = 1; try { for (const [dx, dy, dz] of VM.footprint(m, 0)) { W0 = Math.max(W0, dx + 1); D0 = Math.max(D0, dz + 1); top = Math.max(top, dy + 1); } } catch (e) { /* one block */ } return { lot: [W0, D0], level: false, top }; }
    return null;
  };
  W.spotPlan = function (ding, spawn, yaw, o) {
    o = o || {};
    const d = VR.Ding && VR.Ding.parse(ding), L = W.lotOf(ding); if (!d || !L || !Array.isArray(spawn)) return null;
    const bx = Math.sin(yaw || 0), bz = Math.cos(yaw || 0);   // (from the thing back to you)
    let r = 0, bd = -9; for (let k = 0; k < 4; k++) { const dd = FRONT[k][0] * bx + FRONT[k][1] * bz; if (dd > bd) { bd = dd; r = k; } }
    const sx = Math.floor(spawn[0]), sy = Math.floor(spawn[1]), sz = Math.floor(spawn[2]), dist = o.dist || 6;
    const ax = sx - FRONT[r][0] * dist, az = sz - FRONT[r][1] * dist, Wd = L.lot[0], Dd = L.lot[1], q = ROT[r](Wd >> 1, 0);
    const ox = ax - q[0], oz = az - q[1];
    const a = ROT[r](0, 0), b = ROT[r](Wd - 1, Dd - 1), x0 = ox + Math.min(a[0], b[0]), x1 = ox + Math.max(a[0], b[0]), z0 = oz + Math.min(a[1], b[1]), z1 = oz + Math.max(a[1], b[1]);
    const plan = { id: 'wz' + Date.now().toString(36) + Math.floor(Math.random() * 1e5).toString(36), ox, oz, F: sy, r, settle: true, status: 'pending', t: Date.now(), from: 'wizard', ding, wiz: true };
    if (d.kind === 'h') Object.assign(plan, { kind: 'house', index: +d.key });
    else if (d.kind === 'm') Object.assign(plan, { kind: 'model', name: d.key });
    else if (d.kind === 'f') Object.assign(plan, { kind: 'forge', dna: d.key });
    else Object.assign(plan, { kind: 'piece', piece: ding });
    const cx = (x0 + x1 + 1) / 2, cz = (z0 + z1 + 1) / 2, top = Math.max(3, L.top | 0), hd = Math.hypot(cx - spawn[0], cz - spawn[2]);
    const landing = { pos: [sx + 0.5, sy, sz + 0.5], yaw: Math.atan2(-(cx - spawn[0]), -(cz - spawn[2])), pitch: Math.max(-0.4, Math.min(0.5, Math.atan2(sy + top * 0.45 - (sy + 1.6), Math.max(1, hd)))), label: String(o.name || '').slice(0, 60), box: [x0, sy, z0, x1, sy + top, z1] };
    return { plan, landing };
  };

  // ---------------------------------------------------------------- the keyboard: Esc closes, ← back, arrows, 1–6, Enter
  if (hasDoc) window.addEventListener('keydown', (e) => {
    if (!S) return;
    const ae = document.activeElement, typing = ae && /INPUT|TEXTAREA|SELECT/.test(ae.tagName);
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); W.close('esc'); return; }
    if (typing) return;   // (the line keeps its keys)
    e.stopPropagation();   // (the world behind does not walk while you choose)
    const k = e.key;
    if (k === 'Backspace') { e.preventDefault(); W.back(); return; }
    if (S.step === 2 && /^[1-6]$/.test(k)) { e.preventDefault(); W.light(+k - 1); const c = $(`#wizard .wz-var[data-i="${+k - 1}"]`); if (c) c.focus({ preventScroll: true }); return; }
    if (S.step === 3 && /^[1-5]$/.test(k)) { const b = document.querySelectorAll('#wizard .wz-where')[+k - 1]; if (b) { e.preventDefault(); b.click(); } return; }
    if (/^Arrow/.test(k)) {
      const sel = S.step === 1 ? '.wz-tile' : S.step === 2 ? '.wz-var' : '.wz-where', items = [...document.querySelectorAll('#wizard ' + sel)]; if (!items.length) return;
      e.preventDefault();
      let at = items.indexOf(ae); if (at < 0) { items[0].focus(); return; }
      const cols = Math.max(1, Math.round(items[0].parentNode.clientWidth / Math.max(1, items[0].offsetWidth + 8)));
      const d = k === 'ArrowLeft' ? -1 : k === 'ArrowRight' ? 1 : k === 'ArrowUp' ? -cols : cols;
      at = Math.max(0, Math.min(items.length - 1, at + d));
      items[at].focus({ preventScroll: true });
      return;
    }
    if (k === 'Enter' && ae && ae.tagName === 'BUTTON' && ae.closest('#wizard')) { e.preventDefault(); ae.click(); }
  }, true);
  if (hasDoc) window.addEventListener('keyup', (e) => { if (S && !(document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName))) e.stopPropagation(); }, true);
  if (VR.I18N && VR.I18N.on) VR.I18N.on(() => { if (S) render(); });
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
