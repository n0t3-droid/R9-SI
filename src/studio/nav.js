// ============================================================================
// R9 Studio · the layer stack (W1): every card or editor opened from a card is
// a layer on one stack; ← (the breadcrumb's back button) and Esc pop one layer
// and run its restore — the mode, the selection, the scroll, the lit part are
// back as they were. Depth ≤ 3 (the bottom layer is dropped). The breadcrumb in
// the header shows the stack: „🎒 Meins › Sofa Petrol › ✏️".
// VR.Nav.push({ kind, label, base, restore, escapable }) · pop() · top() ·
// depth() · clear() · crumb()
// ============================================================================
(function () {
  'use strict';
  const N = VR.Nav = { stack: [], base: '' };
  const $ = (s) => document.querySelector(s);
  const tx = (k, v, de, en) => (VR.I18N && VR.I18N.tx ? VR.I18N.tx(k, v, de, en) : de);
  N.push = function (layer) {
    layer = Object.assign({ kind: 'view', label: '', restore: null, escapable: true, t: Date.now() }, layer || {});
    if (!N.stack.length) N.base = layer.base || N.base || '';
    N.stack.push(layer);
    while (N.stack.length > 3) N.stack.shift();
    N.crumb();
    return layer;
  };
  N.pop = function () {
    const l = N.stack.pop(); if (!l) return false;
    try { if (l.restore) l.restore(); } catch (e) { console.warn('nav restore', e); }
    N.crumb();
    return true;
  };
  N.top = () => (N.stack.length ? N.stack[N.stack.length - 1] : null);
  N.depth = () => N.stack.length;
  N.clear = () => { N.stack.length = 0; N.crumb(); };
  // the breadcrumb: hidden at depth 0; ← then the base and every layer's label
  N.crumb = function () {
    const el = $('#navCrumb'); if (!el) return;
    el.innerHTML = '';
    el.classList.toggle('on', N.stack.length > 0);
    if (!N.stack.length) return;
    const b = document.createElement('button'); b.className = 'back'; b.type = 'button'; b.textContent = '←'; b.title = tx('nav.back', null, 'Zurück, wo du warst (Esc)', 'Back where you were (Esc)'); b.onclick = () => N.pop();
    el.appendChild(b);
    const parts = [N.base].concat(N.stack.map(l => l.label)).filter(Boolean);
    parts.forEach((p, i) => { if (i) { const s = document.createElement('span'); s.className = 'sep'; s.textContent = '›'; el.appendChild(s); } const c = document.createElement('span'); c.className = 'c' + (i === parts.length - 1 ? ' cur' : ''); c.textContent = p; el.appendChild(c); });
  };
  // Esc pops one layer — unless a dialog is open (it takes the Esc), a field has the focus, or the layer is an editor
  // with Esc of its own (the Crafter): then its ← does it
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !N.stack.length) return;
    const t = N.top(); if (!t || t.escapable === false) return;
    const ae = document.activeElement; if (ae && /INPUT|TEXTAREA|SELECT/.test(ae.tagName)) return;
    if (document.querySelector('#imagine.on, #hub.on, #packDlg.on, #imPad, #craftCard.on')) return;
    e.preventDefault(); e.stopImmediatePropagation();
    N.pop();
  }, true);
})();
