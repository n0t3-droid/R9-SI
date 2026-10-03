// ============================================================================
// R9 Studio · icon set — one drawing language for every tool and action, so the
// Studio reads without words: 24 × 24, 2 px strokes, round ends, currentColor.
// window.__studioIcons.svg(name, size, cls) → '<svg …>'.
// ============================================================================
(function () {
  'use strict';
  const P = {
    // tools
    hammer: '<path d="M13.6 3.6l6.8 6.8-2.6 2.6-6.8-6.8z"/><path d="M12.3 7.6L3.9 16a1.9 1.9 0 0 0 2.7 2.7l8.4-8.4"/>',
    brush: '<path d="M19 3.3a2 2 0 0 1 2.8 2.8l-8.4 8.6-2.9-2.9z"/><path d="M10.2 12c-2.4 0-3.9 1.5-4.2 3.6-.3 1.9-1.1 3.3-2.6 4 3.5.6 7.7-.4 8.6-3.8l.1-.9"/>',
    area: '<rect x="4" y="4" width="16" height="16" rx="1.5" stroke-dasharray="3.2 2.6"/><circle cx="4" cy="4" r="1.7" fill="currentColor" stroke="none"/><circle cx="20" cy="20" r="1.7" fill="currentColor" stroke="none"/>',
    walk: '<circle cx="12" cy="4.6" r="2.2"/><path d="M12 8.4v6.2M12 14.6l-3.6 6.2M12 14.6l3.6 6.2M7.2 11.2h9.6"/>',
    camera: '<rect x="2.8" y="7" width="13" height="10" rx="2"/><path d="M15.8 11.2l5.2-3v7.6l-5.2-3"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.6.3-1 .9-1 1.6v.6"/><circle cx="12" cy="17.2" r="1" fill="currentColor" stroke="none"/>',
    // actions
    pick: '<path d="M3.4 9.6C8 4.6 15 3.2 20.6 5.6"/><path d="M12.6 5.4L5 20.6"/>',
    cube: '<path d="M12 2.8l8 4.6v9.2l-8 4.6-8-4.6V7.4z"/><path d="M4 7.4l8 4.6 8-4.6M12 12v9.2"/>',
    pipette: '<path d="M19.8 4.2a2.2 2.2 0 0 0-3.1 0l-2.6 2.6-1-1-1.6 1.6 5.1 5.1 1.6-1.6-1-1 2.6-2.6a2.2 2.2 0 0 0 0-3.1z"/><path d="M13.6 8.6L5 17.2l-1 2.8 2.8-1 8.6-8.6"/>',
    turn: '<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 3.5v5h-5"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
    reset: '<path d="M3.2 12a8.8 8.8 0 1 0 2.9-6.6L3.2 8"/><path d="M3.2 3.2v4.8H8"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    upload: '<path d="M12 15.5V3.8m0 0L7 8.8m5-5 5 5"/><path d="M4 14.5v4.6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4.6"/>',
    download: '<path d="M12 3.8v11.7m0 0l-5-5m5 5 5-5"/><path d="M4 14.5v4.6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4.6"/>',
    check: '<path d="M4.8 12.6l4.6 4.6L19.4 7"/>',
    backpack: '<path d="M6.5 9a5.5 5.5 0 0 1 11 0v10a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2z"/><path d="M10 3.6V2.5h4v1.1M9 13.2h6v4.2H9z"/>',
    house: '<path d="M3 11l9-7 9 7"/><path d="M5.2 9.6V20h13.6V9.6"/><path d="M10 20v-5.2h4V20"/>',
    trash: '<path d="M4 6.5h16M9.5 6.5V4h5v2.5M6.5 6.5l1 13.5h9l1-13.5"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    arrow: '<path d="M4 12h15m0 0l-5-5m5 5-5 5"/>',
    pencil: '<path d="M15.5 4.5l4 4L8 20H4v-4z"/><path d="M13.5 6.5l4 4"/>',
    height: '<path d="M12 3v18m0-18l-4 4m4-4 4 4m-4 14l-4-4m4 4 4-4"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.9 1.8-1.9 0-1.3-1.2-1.7-1.2-2.9 0-1 .8-1.7 1.8-1.7H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/><circle cx="7.6" cy="11" r="1.2" fill="currentColor" stroke="none"/><circle cx="10.4" cy="7.2" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="7.6" r="1.2" fill="currentColor" stroke="none"/>',
    // paint reach: one piece, one surface, everything of that kind
    one: '<rect x="3" y="3" width="18" height="18" rx="2" opacity=".35"/><rect x="8.6" y="8.6" width="6.8" height="6.8" rx="1" fill="currentColor" stroke="none"/>',
    face: '<rect x="3" y="3" width="18" height="18" rx="2" fill="currentColor" fill-opacity=".38"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
    all: '<path d="M2.6 11.2L12 3.8l9.4 7.4"/><path d="M5 9.6V20.4h14V9.6"/><rect x="8" y="11.6" width="3.2" height="3.2" fill="currentColor" stroke="none"/><rect x="12.8" y="11.6" width="3.2" height="3.2" fill="currentColor" stroke="none"/><rect x="8" y="16.2" width="3.2" height="3.2" fill="currentColor" stroke="none"/><rect x="12.8" y="16.2" width="3.2" height="3.2" fill="currentColor" stroke="none"/>',
    // area actions
    fill: '<rect x="4" y="4" width="16" height="16" rx="1.6" fill="currentColor" fill-opacity=".85"/>',
    walls: '<rect x="4" y="4" width="16" height="16" rx="1.6"/><rect x="8.2" y="8.2" width="7.6" height="7.6" rx="1" fill="currentColor" fill-opacity=".25"/>',
    hollow: '<path d="M12 2.8l8 4.6v9.2l-8 4.6-8-4.6V7.4z" stroke-dasharray="2.6 2.2"/><path d="M4 7.4l8 4.6 8-4.6M12 12v9.2" opacity=".5"/>',
    // 🕘 Weitermachen
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7.2V12l3.4 2.2"/>',
    pin: '<path d="M9.2 3.5h5.6l-.9 5.4 3.7 3.4H6.4l3.7-3.4z"/><path d="M12 12.3v8.2"/>',
    play: '<path d="M8 5.2v13.6L18.8 12z" fill="currentColor" fill-opacity=".9"/>',
    save: '<path d="M5 3.5h11.4l4.1 4.1V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V5A1.5 1.5 0 0 1 5 3.5z"/><path d="M8 3.5V8h7V3.5M7.5 20.5v-6h9v6"/>',
    eraser: '<path d="M7 20h13"/><path d="M5.6 15.4l9-9a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L12.2 19H8.8z"/><path d="M10.2 10.8l5 5"/>',
  };
  function svg(name, size, cls) {
    const p = P[name] || P.help, s = size || 20;
    return `<svg class="ico${cls ? ' ' + cls : ''}" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  }
  window.__studioIcons = { svg, names: Object.keys(P) };
})();
