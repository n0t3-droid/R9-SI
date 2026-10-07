// ============================================================================
// The four picture tiles of the start screen (W1), shared by the game and the
// R9 Studio: ▶ (play) · 🏗 (bauen) · ✨ (erschaffen) · 🎒 (meins). One accent
// colour, a pictogram (inline SVG: no font, no emoji needed) and one line.
// VR.Tiles.make(kind, { id, cls, label, sub, title }) → button.tile[data-tile]
// ============================================================================
(function (VR) {
  'use strict';
  const T = VR.Tiles = {};
  T.KINDS = ['play', 'bauen', 'erschaffen', 'meins'];
  T.SVG = {
    play: '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="27" fill="none" stroke="currentColor" stroke-width="3"/><path d="M26 20l18 12-18 12z" fill="currentColor"/></svg>',
    bauen: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M8 30L32 10l24 20" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/><path d="M14 27v26h36V27" fill="none" stroke="currentColor" stroke-width="3"/><path d="M14 36h36M14 45h36M26 36v9M38 27v9M32 45v8M20 45v8M44 45v8" stroke="currentColor" stroke-width="2.2" opacity=".75"/><path d="M40 8h14l-4 6h-6z" fill="currentColor"/><path d="M47 14v10" stroke="currentColor" stroke-width="3"/></svg>',
    erschaffen: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M30 8c2 14 6 18 20 20-14 2-18 6-20 20-2-14-6-18-20-20 14-2 18-6 20-20z" fill="currentColor"/><path d="M49 36c1 6 3 8 9 9-6 1-8 3-9 9-1-6-3-8-9-9 6-1 8-3 9-9z" fill="currentColor" opacity=".8"/><path d="M14 44c.7 4 2 5.3 6 6-4 .7-5.3 2-6 6-.7-4-2-5.3-6-6 4-.7 5.3-2 6-6z" fill="currentColor" opacity=".6"/></svg>',
    meins: '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M20 20h24a8 8 0 0 1 8 8v20a6 6 0 0 1-6 6H18a6 6 0 0 1-6-6V28a8 8 0 0 1 8-8z" fill="none" stroke="currentColor" stroke-width="3"/><path d="M24 20v-4a8 8 0 0 1 16 0v4" fill="none" stroke="currentColor" stroke-width="3"/><path d="M18 36h28v10a4 4 0 0 1-4 4H22a4 4 0 0 1-4-4z" fill="currentColor" opacity=".35"/><path d="M28 36v6h8v-6" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>',
  };
  T.make = function (kind, o) {
    o = o || {};
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'tile ' + kind + (o.cls ? ' ' + o.cls : ''); b.dataset.tile = kind; if (o.id) b.id = o.id;
    b.innerHTML = `<span class="pic" aria-hidden="true">${T.SVG[kind] || ''}</span><span class="lbl"></span><span class="sub2"></span>`;
    b.querySelector('.lbl').textContent = o.label || ''; b.querySelector('.sub2').textContent = o.sub || '';
    if (o.title) b.title = o.title;
    return b;
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
