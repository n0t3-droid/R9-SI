// ============================================================================
// Der erste Eindruck (f-first; plan docs/superpowers/plans/2026-10-30-f-first.md; review docs/reviews/v0.52.md):
//   · the pause menu in two steps (R53-04): five at its top — ▶ Weiterspielen, the Tagebuch (Abenteuer) or the Codex,
//     📷 Foto, ⚙ Einstellungen, ⏏ Speichern & zum Start — and „Mehr …" with everything else the modules put in
//     (Bauen, Meins, Abenteuer, Erfinden, Zeitraffer, Pfeifen, Zuhause, the Zen tools, Spiegeln, multiplayer, Impressum);
//     „Mehr" swaps the panel's content for the rest in two columns and „‹ Zurück" swaps it back — 720 px tall at most
//   · one prompt per key (R53-05): while a story offer's card stands, the card owns V — the Aktion's prompt under the
//     crosshair is hidden (ctx.js asks VR.FirstLook.keyFree) and Funke's line names no key (story.js)
//   · readable start and create screens (R53-08): the tiles' and the create dialog's small lines brighter and larger
// Cost: nothing in the frame — the pause menu is sorted when it opens; keyFree is two property reads at 10 Hz.
// ============================================================================
(function (VR) {
  'use strict';
  const FL = VR.FirstLook = VR.FirstLook || {};
  const hasDoc = typeof document !== 'undefined' && !!document.createElement;
  const T = (k, v) => (VR.I18N ? VR.I18N.t(k, v) : k);

  // ---------------------------------------------------------------- one prompt per key
  // the V key belongs to the story's card while it stands (its button shows the key); the Aktion's prompt waits
  FL.cardUp = function (g) {
    const S = VR.Story; if (!S || !S.offer) return false;
    try { return !!S.offer(g); } catch (e) { return false; }
  };
  FL.keyFree = (g) => !FL.cardUp(g);

  // ---------------------------------------------------------------- the pause menu
  // the five at the top, in this order; the first match of each slot wins (a hidden one does not count)
  FL.PRIMARY = [['[data-act="resume"]'], ['[data-act="journal"]', '[data-act="codex"]'], ['[data-act="photo"]'], ['[data-act="settings"]'], ['[data-act="quit"]']];
  const shown = (e) => !!e && e.style.display !== 'none';
  // which children of the panel stay at the top: the title, the note, the five, the Mehr button; the rest → „Mehr"
  FL.sort = function (panel) {
    if (!panel || !panel.querySelector) return null;
    let more = panel.querySelector('#pmore'), mb = panel.querySelector('[data-act="pausemore"]');
    if (!more) {
      more = document.createElement('div'); more.id = 'pmore'; more.className = 'pmore';
      const back = document.createElement('button'); back.type = 'button'; back.className = 'btn pless'; back.dataset.act = 'pauseless';
      back.textContent = T('g.pause.less');
      back.onclick = (e) => { if (e && e.stopPropagation) e.stopPropagation(); panel.classList.remove('moreon'); };
      more.appendChild(back);
      const grid = document.createElement('div'); grid.className = 'pmgrid'; more.appendChild(grid);
    }
    if (!mb) {
      mb = document.createElement('button'); mb.type = 'button'; mb.className = 'btn pmorebtn'; mb.dataset.act = 'pausemore';
      mb.onclick = (e) => { if (e && e.stopPropagation) e.stopPropagation(); panel.classList.add('moreon'); };
    }
    mb.textContent = T('g.pause.more');
    const grid = more.querySelector('.pmgrid');
    // the five: found anywhere in the panel (a module may have put one into a row), brought to the top level
    const keep = [];
    for (const slot of FL.PRIMARY) {
      let hit = null;
      for (const sel of slot) { const e = panel.querySelector(sel); if (e && shown(e)) { hit = e; break; } }
      if (hit) keep.push(hit);
    }
    const title = panel.querySelector('h2'), note = panel.querySelector('#pausenote');
    // everything else at the top level goes into „Mehr" (in its order); the five out of „Mehr" again
    for (const c of [...panel.children]) {
      if (c === title || c === note || c === more || c === mb || keep.includes(c)) continue;
      if (keep.some(k => c.contains && c.contains(k))) { for (const k of keep) if (c.contains(k)) panel.appendChild(k); }
      grid.appendChild(c);
    }
    // the order: title, Weiterspielen, Tagebuch/Codex, Foto, Einstellungen, Mehr …, Speichern & zum Start, the note
    const quit = keep.find(k => k.dataset && k.dataset.act === 'quit');
    if (title) panel.appendChild(title);
    for (const k of keep) if (k !== quit) panel.appendChild(k);
    panel.appendChild(mb);
    if (quit) panel.appendChild(quit);
    panel.appendChild(more);
    if (note) panel.appendChild(note);
    // „Mehr" only when it holds something to show
    const n = [...grid.querySelectorAll('button, input')].filter(shown).length;
    mb.style.display = n ? '' : 'none';
    return { top: keep.length, more: n };
  };
  FL.css = function () {
    if (!hasDoc || document.getElementById('firstlookcss')) return;
    const s = document.createElement('style'); s.id = 'firstlookcss';
    s.textContent = [
      '#pause .panel.box { min-width: min(400px, 94vw) !important; max-height: 96vh; overflow: auto; }',
      '#pause .panel:not(.moreon) > #pmore { display: none; }',
      '#pause .panel.moreon > :not(h2):not(#pmore) { display: none !important; }',
      '#pause .panel.moreon { min-width: min(760px, 96vw) !important; }',
      '#pause .pmorebtn { opacity: .95; }',
      '#pmore { display: flex; flex-direction: column; gap: 8px; }',
      '#pmore .pless { align-self: flex-start; min-width: 0; padding: 0 16px; }',
      '#pmore .pmgrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 8px 14px; align-items: start; }',
      '#pmore .pmgrid > * { margin: 0; }',
      // R53-08: the start screen's and the create dialog's small lines readable on the bright sky
      '.tile .sub2 { color: #d3ddef; font-size: calc(var(--st-fs) * 0.82); }',
      '#create .seg button small, #create .advcards button small { color: #cdd8ec; font-size: calc(var(--st-fs, 18px) * 0.8); }',
      '#title .sub, #title .foot, #title .foot .credit { color: #d3ddef; }',
      // the living title's lower half calmer behind the buttons (the land far below in a dusk shade, the sky untouched)
      '#title.live { background: linear-gradient(180deg, rgba(8, 10, 24, 0) 0%, rgba(8, 10, 24, 0) 48%, rgba(16, 12, 32, 0.38) 70%, rgba(10, 9, 22, 0.62) 100%); }',
    ].join('\n');
    (document.head || document.body).appendChild(s);
  };

  const UI = VR.UI;
  if (UI && UI.prototype && !UI.prototype.pause.__first) {
    const op = UI.prototype.pause;
    UI.prototype.pause = function () {
      const r = op.apply(this, arguments);
      if (!hasDoc) return r;
      FL.css();
      const panel = document.querySelector('#pause .panel');
      if (panel) {
        panel.classList.remove('moreon');
        try { FL.sort(panel); } catch (e) { console.warn('firstlook pause', e); }
        // (the modules that put their buttons in after this call returned — quests', a-core's — are sorted at once after)
        setTimeout(() => { try { FL.sort(panel); } catch (e) { /* next time */ } }, 0);
        setTimeout(() => { try { FL.sort(panel); } catch (e) { /* next time */ } }, 60);
      }
      return r;
    };
    UI.prototype.pause.__first = true;
  }
  if (hasDoc) FL.css();
})(VR);
