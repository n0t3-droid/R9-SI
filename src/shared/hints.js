// ============================================================================
// 🧭 Hints (W1): one line at the bottom of the screen, with a row of pictograms
// (key caps, a mouse with the lit button, a finger) so a non-reader follows the
// picture. One at a time, never on a timer: a hint leaves when its action was
// done (done) or when ✕ is pressed (dismiss); an undone one may come back next
// session, at most three times in all.
//   'r9si.hints' = { v: 1, seen: { id: t }, done: { id: t }, n: { id: count } }
// VR.Hints.want(id) · show(id, {text, picto, onDismiss}) → false while another
// hint shows · done(id) · dismiss() · current() · read() · reset()
// ============================================================================
(function (VR) {
  'use strict';
  const KEY = 'r9si.hints', MAX = 3;
  const H = VR.Hints = { KEY };
  let cur = null, box = null, shownNow = new Set();
  const read = () => { let o = null; try { o = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { o = null; } if (!o || typeof o !== 'object') o = {}; return { v: 1, seen: o.seen && typeof o.seen === 'object' ? o.seen : {}, done: o.done && typeof o.done === 'object' ? o.done : {}, n: o.n && typeof o.n === 'object' ? o.n : {} }; };
  const write = (o) => { try { localStorage.setItem(KEY, JSON.stringify(o)); return true; } catch (e) { return false; } };
  H.read = read;
  H.want = (id) => { const o = read(); return !o.done[id] && (o.n[id] || 0) < MAX && !shownNow.has(id); };
  H.current = () => cur;
  // the pictograms: a key cap for a key name, the mouse (left button lit), a finger
  const picto = (p) => {
    if (p === 'mouse') { const s = document.createElement('span'); s.className = 'mouse'; s.setAttribute('aria-hidden', 'true'); s.innerHTML = '<svg viewBox="0 0 24 34" width="18" height="26"><rect x="2" y="2" width="20" height="30" rx="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v12M2 14h20" stroke="currentColor" stroke-width="2"/><path d="M3 3h9v11H3z" fill="currentColor" opacity=".55"/></svg>'; return s; }
    if (p === 'finger') { const s = document.createElement('span'); s.className = 'finger'; s.textContent = '👆'; return s; }
    const k = document.createElement('kbd'); k.textContent = p === 'Space' ? '␣' : p; return k;
  };
  function ensure() {
    if (box && box.parent !== null && (box.isConnected === undefined || box.isConnected)) return box;
    box = document.createElement('div'); box.setAttribute('id', 'hints'); if (box.id !== undefined) box.id = 'hints';
    box.setAttribute('role', 'status'); box.setAttribute('aria-live', 'polite');
    (H.host || document.body).appendChild(box);
    return box;
  }
  H.show = function (id, o) {
    if (cur || !H.want(id)) return false;
    o = o || {};
    const st = read(); st.seen[id] = Date.now(); st.n[id] = (st.n[id] || 0) + 1; write(st);
    shownNow.add(id); cur = id;
    const el = ensure(); el.innerHTML = '';
    const line = document.createElement('div'); line.className = 'hint'; line.setAttribute('data-hint', id);
    const row = document.createElement('span'); row.className = 'picto';
    for (const p of (Array.isArray(o.picto) ? o.picto : [])) row.appendChild(picto(p));
    const t = document.createElement('span'); t.className = 'txt'; t.textContent = String(o.text || '');
    const x = document.createElement('button'); x.className = 'x'; x.setAttribute('type', 'button'); x.textContent = '✕'; x.setAttribute('title', VR.I18N ? VR.I18N.tx('hint.close', null, 'Ausblenden', 'Hide') : 'Hide');
    x.onclick = (e) => { if (e && e.stopPropagation) e.stopPropagation(); H.dismiss(); if (o.onDismiss) o.onDismiss(); };
    line.appendChild(row); line.appendChild(t); line.appendChild(x); el.appendChild(line);
    el.classList.add('on');
    return true;
  };
  function hide() { cur = null; if (box) { box.classList.remove('on'); box.innerHTML = ''; } }
  H.dismiss = () => { if (!cur) return false; hide(); return true; };
  // the language changed while a hint shows: its line again, in the new words (nothing counted)
  H.retext = (text) => { if (!cur || !box) return false; const t = box.querySelector('.txt'); if (t) t.textContent = String(text || ''); const x = box.querySelector('.x'); if (x && VR.I18N) x.setAttribute('title', VR.I18N.tx('hint.close', null, 'Ausblenden', 'Hide')); return true; };
  H.done = (id) => { const st = read(); if (!st.done[id]) { st.done[id] = Date.now(); write(st); } if (cur === id) hide(); };
  H.reset = () => { try { localStorage.removeItem(KEY); } catch (e) { /* */ } shownNow = new Set(); hide(); };
  H._newSession = () => { shownNow = new Set(); hide(); };   // (tests: the next session)
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
