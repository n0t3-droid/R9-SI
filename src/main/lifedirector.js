// ============================================================================
// The Regisseur des Lebens (t-life, docs/superpowers/plans/2026-10-09-t-life.md §3.3–3.4). The owner: "ich mag es
// vibrant, immer etwas los". Its switches live in ⚙ Bild · Dinge & Effekte: padLife (padlife.js, hangarflight.js) and
// lifeDir (this file). Registered here: this file loads after the settings registry.
// ============================================================================
(function (VR) {
  'use strict';
  const LD = VR.LifeDirector = VR.LifeDirector || {};
  if (VR.Settings && VR.Settings.add) {
    VR.Settings.add({ key: 'padLife', g: 'img', sec: 'objects', t: 'switch', lab: 'g.set.padLife', tip: 'g.set.padLife.tip', cost: 'low', def: true });
    VR.Settings.add({ key: 'lifeDir', g: 'img', sec: 'objects', t: 'switch', lab: 'g.set.lifeDir', tip: 'g.set.lifeDir.tip', cost: 'low', def: true });
  }
  void LD;
})(VR);
