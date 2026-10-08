// ============================================================================
// ⚙ Settings panel (F5 · Steuerung & Einstellungen): renders the three groups
// Bild · Klang · Spiel from the registry (settings_reg.js) — every row has its
// label, a one-line tip and, for each graphics option, a cost badge (🟢 kaum ·
// 🟡 etwas · 🔴 viel). Bild shows a live preview thumbnail of the scene (the
// game captures its own frame two frames after a change) and the ⚙ passt an line
// while the quality governor has lowered something. Keys: the key-binding screen
// (every action, two keys each, conflicts shown, reset). Used by ui.js.
// VR.SettingsPanel.render(ui, body, group) · keys(ui, body)
// ============================================================================
(function (VR) {
  'use strict';
  const SP = VR.SettingsPanel = {};
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const T = (k, v, fb) => (VR.I18N ? VR.I18N.t(k, v, fb) : (fb !== undefined ? fb : k));
  const TL = (k) => (VR.I18N && VR.I18N.list ? VR.I18N.list(k) : []);
  const lang = () => (VR.I18N && VR.I18N.lang === 'en' ? 'en' : 'de');
  const PRESET = { potato: 'g.set.pVeryLow', low: 'g.set.pLow', balanced: 'g.set.pBalanced', high: 'g.set.pHigh', ultra: 'g.set.pUltra' };

  function fmt(item, v) {
    if (item.vals) { const names = TL(item.vals); return names[Math.round(v) - item.min] || String(v); }
    if (item.fmt === 'pct') return Math.round(v * 100) + '%';
    if (item.fmt === 'deg') return v + '°';
    if (item.fmt === 'chunks') return T('g.set.chunks', { v, m: v * 16 });
    return String(v);
  }
  const badge = (item) => {
    const c = VR.Settings.costOf(item);
    return c ? `<span class="cost cost-${item.cost}" title="${esc(T('g.set.cost.title'))}">${c.icon} ${esc(T(c.lab))}</span>` : '';
  };
  const tipOf = (item) => `<div class="setip">${esc(T(item.tip))}</div>`;

  // one row for one registry entry; ctx = { game, ui, S, group, rerender }
  function row(item, ctx) {
    const { S, game } = ctx;
    const label = esc(T(item.lab));
    const after = (key) => { game.applySettings(key); if (item.g === 'img') game.requestPreview(); };
    if (item.t === 'slider') {
      const d = el('div', 'setrow'); d.dataset.key = item.key;
      d.innerHTML = `<div class="sethead"><label>${label}</label><span class="val">${esc(fmt(item, S[item.key]))}</span>${badge(item)}</div>`;
      const inp = el('input'); inp.type = 'range'; inp.min = item.min; inp.max = item.max; inp.step = item.step; inp.value = S[item.key];
      inp.setAttribute('aria-label', T(item.lab));
      const val = d.querySelector('.val');
      inp.oninput = () => { S[item.key] = VR.Settings.snap(item, inp.value); inp.value = S[item.key]; val.textContent = fmt(item, S[item.key]); after(item.key); };
      inp.onchange = () => game.saveSettings();
      d.appendChild(inp); d.insertAdjacentHTML('beforeend', tipOf(item));
      return d;
    }
    if (item.t === 'switch') {
      const d = el('div', 'setrow sw'); d.dataset.key = item.key;
      d.innerHTML = `<label class="swl"><input type="checkbox" ${S[item.key] ? 'checked' : ''}> <span class="lab">${label}</span></label>${badge(item)}`;
      d.querySelector('input').onchange = (e) => { S[item.key] = e.target.checked; after(item.key); game.saveSettings(); };
      d.insertAdjacentHTML('beforeend', tipOf(item));
      return d;
    }
    if (item.t === 'choice') {
      const d = el('div', 'setrow'); d.dataset.key = item.key;
      d.innerHTML = `<div class="sethead"><label>${label}</label>${badge(item)}</div>`;
      const seg = el('div', 'seg');
      for (const [v, lk, tk] of item.opts) {
        const b = el('button', S[item.key] === v ? 'on' : '', esc(T(lk)));
        b.dataset.set = item.key + ':' + v; b.title = T(tk);
        b.onclick = () => { S[item.key] = v; after(item.key); game.saveSettings(); ctx.rerender(); };
        seg.appendChild(b);
      }
      d.appendChild(seg); d.insertAdjacentHTML('beforeend', tipOf(item));
      return d;
    }
    if (item.t === 'preset') {
      const d = el('div', 'setrow'); d.dataset.key = 'preset';
      d.innerHTML = `<div class="sethead"><label>${esc(T(item.lab))}</label></div>`;
      const seg = el('div', 'seg');
      for (const p of ['potato', 'low', 'balanced', 'high', 'ultra']) {
        const b = el('button', S.preset === p ? 'on' : '', esc(T(PRESET[p])));
        b.dataset.preset = p; b.title = p === 'potato' ? T('g.set.pVeryLowTip') : '';
        b.onclick = () => { game.applyPreset(p); ctx.rerender(); };
        seg.appendChild(b);
      }
      d.appendChild(seg); d.insertAdjacentHTML('beforeend', tipOf(item));
      return d;
    }
    if (item.t === 'action') {
      const d = el('div', 'setrow act'); d.dataset.key = item.key;
      const b = el('button', 'btn' + (item.key === 'bench' ? ' pri' : ''), esc(T(item.lab)));
      b.dataset.act = item.act;
      b.onclick = () => ctx.act(item.act);
      d.appendChild(b); d.insertAdjacentHTML('beforeend', tipOf(item));
      return d;
    }
    return el('div', 'setrow');
  }

  // the group's body: sections in registry order, each with a heading
  SP.render = function (ui, body, group) {
    const game = ui.game, S = game.settings;
    const ctx = { game, S, ui, group, rerender: () => ui.showSettings(), act: (name) => ui.settingsAct(name) };
    if (group === 'img') {
      const pv = el('div', 'pvwrap');
      pv.innerHTML = `<canvas class="pv" width="240" height="135" aria-label="${esc(T('g.set.preview'))}"></canvas><div class="pvnote">${esc(T('g.set.preview'))}</div><div class="aqline" hidden></div>`;
      body.appendChild(pv);
      ui.previewCtx = pv.querySelector('canvas').getContext('2d');
      if (game.requestPreview) game.requestPreview();   // a new canvas (after a redraw of the group) gets a fresh picture
      SP.aqLine(ui);
    }
    for (const sec of VR.Settings.SECTIONS[group] || []) {
      const items = VR.Settings.items(group, sec);
      if (!items.length) continue;
      const wrap = el('div', 'setsec');
      wrap.appendChild(el('h3', '', esc(T('g.set.sec.' + sec))));
      for (const item of items) wrap.appendChild(row(item, ctx));
      body.appendChild(wrap);
    }
    if (group === 'img') {
      const r = game.renderer;
      const note = el('div', 'note gpunote', T('g.set.gpuNote', { gpu: esc(VR.GL.rendererName || ''), r: r ? r.w + '×' + r.h : '?', s: r ? r.W + '×' + r.H : '?', tsr: S.tsr ? T('g.set.gpuTsr') : '', dyn: S.dynRes ? T('g.set.gpuDyn') : '' }));
      body.appendChild(note);
    }
  };

  // ⚙ passt an: shown while the governor has lowered something, with the list of what (never a surprise)
  SP.aqLine = function (ui) {
    const line = ui.root && ui.root.querySelector ? ui.root.querySelector('.aqline') : null;
    const g = ui.game, aq = g && g.aq;
    const on = !!(aq && aq.stack && aq.stack.length && g.state === 'play');
    const line2 = line || document.querySelector('#settings .aqline');
    if (!line2) return;
    line2.hidden = !on;
    if (on) line2.textContent = T('g.aq.hint') + ' · ' + T('g.aq.tip', { what: g.aqWhat ? g.aqWhat() : '' });
  };

  // the key-binding screen: every action with its keys; a key used twice is shown with a way out (swap back).
  // opts.note = { text, swap: { id, slot, code } } carries the message of the last change over the redraw
  SP.keys = function (ui, body, opts) {
    const B = VR.Binds, game = ui.game, cur = B.current, L = lang(), note = (opts && opts.note) || null;
    body.innerHTML = '';
    const top = el('div', 'row gap keytop');
    const back = el('button', 'btn small', esc(T('g.keys.back'))); back.onclick = () => ui.showSettings('play');
    const reset = el('button', 'btn small', esc(T('g.keys.resetAll'))); reset.onclick = () => { cur.resetAll(); B.write(cur); SP.keys(ui, body, { note: { text: T('g.keys.reset.done') } }); };
    top.appendChild(back); top.appendChild(reset);
    body.appendChild(top);
    body.appendChild(el('div', 'note', esc(T('g.keys.help'))));
    const conf = cur.conflicts();
    if (conf.length) body.appendChild(el('div', 'keywarn', `⚠ ${esc(T('g.keys.conflict', { keys: conf.map(c => B.label(c.code, L)).join(', ') }))}`));
    const msg = el('div', 'keymsg', esc(note ? note.text : '')); msg.setAttribute('role', 'status');
    body.appendChild(msg);
    if (note && note.swap) {
      const sw = el('button', 'btn tiny', esc(T('g.keys.swap', { key: B.label(note.swap.prev, L) })));
      sw.onclick = () => { cur.set(note.swap.other, note.swap.otherSlot, note.swap.prev); B.write(cur); SP.keys(ui, body, { note: { text: T('g.keys.swapped') } }); };
      msg.appendChild(document.createTextNode(' ')); msg.appendChild(sw);
    }
    for (const g of ['move', 'act', 'view', 'hotbar']) {
      const acts = B.ACTIONS.filter(a => a.group === g);
      body.appendChild(el('h3', '', esc(T('ctl.grp.' + g))));
      for (const a of acts) {
        const r = el('div', 'keyrow');
        r.dataset.action = a.id;
        r.appendChild(el('span', 'klab', esc(T('ctl.' + a.id))));
        const slots = el('span', 'kslots');
        for (let s = 0; s < 2; s++) {
          const code = cur.slots(a.id)[s];
          const b = el('button', 'key' + (code ? '' : ' empty'), esc(code ? B.label(code, L) : (s === 0 ? '—' : '＋')));
          b.dataset.slot = String(s); b.title = T('g.keys.slot', { n: s + 1 });
          b.setAttribute('aria-label', T('ctl.' + a.id) + ' ' + T('g.keys.slot', { n: s + 1 }));
          b.onclick = () => {
            b.textContent = '…'; b.classList.add('wait');
            game.input.captureNext((next) => {
              if (next === 'Escape') { SP.keys(ui, body, { note: { text: T('g.keys.cancel') } }); return; }
              const prev = cur.slots(a.id)[s];
              const res = cur.set(a.id, s, next);
              if (!res.ok) { SP.keys(ui, body, { note: { text: res.reason === 'reserved' ? T('g.keys.reserved', { key: B.label(next, L) }) : T('g.keys.invalid') } }); return; }
              B.write(cur);
              if (res.conflicts.length) {
                const other = res.conflicts[0], otherSlot = cur.slots(other).indexOf(next);
                const text = T('g.keys.shared', { key: B.label(next, L), other: T('ctl.' + other) });
                SP.keys(ui, body, { note: { text, swap: { other, otherSlot: otherSlot < 0 ? 0 : otherSlot, prev } } });
              } else SP.keys(ui, body, { note: { text: T('g.keys.set', { key: B.label(next, L), name: T('ctl.' + a.id) }) } });
            });
          };
          slots.appendChild(b);
        }
        r.appendChild(slots);
        const others = cur.conflictsOf(a.id);
        if (others.length) r.appendChild(el('span', 'kwarn', `⚠ ${esc(T('g.keys.alsoAt', { other: others.map(id => T('ctl.' + id)).join(', ') }))}`));
        const rs = el('button', 'btn tiny kreset', '↺'); rs.title = T('g.keys.reset'); rs.setAttribute('aria-label', T('g.keys.reset'));
        rs.onclick = () => { cur.reset(a.id); B.write(cur); SP.keys(ui, body, { note: { text: T('g.keys.reset.one', { name: T('ctl.' + a.id) }) } }); };
        r.appendChild(rs);
        body.appendChild(r);
      }
    }
    body.appendChild(el('h3', '', esc(T('g.keys.pad.title'))));
    body.appendChild(el('div', 'note', esc(T('g.keys.pad.text'))));
    // 🚀 in a ship (flight.js): its keys by their default names (a rebound action moves its ship key along)
    body.appendChild(el('h3', '', esc(T('g.keys.ship.title'))));
    body.appendChild(el('div', 'note', esc(T('g.keys.ship.text'))));
  };
  function slotOf(id, code) { const S = VR.Binds.current.slots(id); return S[0] === code ? 0 : 1; }
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
