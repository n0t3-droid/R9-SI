// ============================================================================
// ⚙ Settings registry (F5 · Steuerung & Einstellungen): every setting the panel
// shows is one entry — its group (img = Bild, snd = Klang, play = Spiel), its
// section, its key in the game's settings record, the label and the one-line
// tip (both language keys), a cost badge for each graphics option (low = 🟢 kaum,
// mid = 🟡 etwas, high = 🔴 viel), the type (slider · switch · choice · preset ·
// action · info), the range (snapped to `step`), and the default. The panel
// (settings_panel.js) renders from this list; other fronts add their entries with
// VR.Settings.add(item) so merges stay small.
//   item: { key, g, sec?, t, lab, tip, cost?, def, min?, max?, step?, fmt?, vals?, opts?, act? }
// VR.Settings.GROUPS · COST · SECTIONS · ITEMS · add(item) · items(g, sec?) · byKey(key) ·
// defaults() · snap(item, v) · costOf(item)
// ============================================================================
(function (VR) {
  'use strict';
  const GROUPS = [
    { id: 'img', lab: 'g.set.grp.img', de: 'Bild', en: 'Picture', icon: '🖼' },
    { id: 'snd', lab: 'g.set.grp.snd', de: 'Klang', en: 'Sound', icon: '🔊' },
    { id: 'play', lab: 'g.set.grp.play', de: 'Spiel', en: 'Game', icon: '🎮' },
  ];
  const COST = {
    low: { icon: '🟢', lab: 'g.set.cost.low', de: 'kaum', en: 'little' },
    mid: { icon: '🟡', lab: 'g.set.cost.mid', de: 'etwas', en: 'some' },
    high: { icon: '🔴', lab: 'g.set.cost.high', de: 'viel', en: 'a lot' },
  };
  // the sections of each group, in the order the panel shows them (the heading is 'g.set.sec.<id>')
  const SECTIONS = {
    img: ['auto', 'light', 'quality', 'objects', 'show'],
    snd: ['vol', 'air'],
    play: ['steer', 'play'],
  };
  const ITEMS = [
    // ---- Bild · Automatik and the quality preset
    // ---- Bild · Licht & Schatten
    { key: 'preset', g: 'img', sec: 'auto', t: 'preset', lab: 'g.set.preset', tip: 'g.set.preset.tip', def: 'balanced' },
    { key: 'renderDist', g: 'img', sec: 'light', t: 'slider', lab: 'g.set.renderDist', tip: 'g.set.renderDist.tip', cost: 'high', def: 10, min: 3, max: 24, maxKey: 'rdMax', step: 1, fmt: 'chunks' },   // (F-Far: the top follows the preset's rdMax — 32 on Ultra)
    { key: 'horizon', g: 'img', sec: 'light', t: 'slider', lab: 'g.set.horizon', tip: 'g.set.horizon.tip', cost: 'high', def: 4, min: 0, max: 4, step: 1, vals: 'g.set.horizonV' },
    { key: 'shadows', g: 'img', sec: 'light', t: 'slider', lab: 'g.set.shadows', tip: 'g.set.shadows.tip', cost: 'mid', def: 1, min: 0, max: 3, step: 1, vals: 'g.set.shadowsV' },
    { key: 'matTier', g: 'img', sec: 'light', t: 'slider', lab: 'g.set.matTier', tip: 'g.set.matTier.tip', cost: 'mid', def: 2, min: 0, max: 3, step: 1, vals: 'g.set.matTierV' },   // F2 materials
    { key: 'sunShadows', g: 'img', sec: 'light', t: 'switch', lab: 'g.set.sunShadows', tip: 'g.set.sunShadows.tip', cost: 'low', def: true },
    { key: 'rays', g: 'img', sec: 'light', t: 'switch', lab: 'g.set.rays', tip: 'g.set.rays.tip', cost: 'mid', def: false },
    { key: 'magic', g: 'img', sec: 'light', t: 'slider', lab: 'g.set.magic', tip: 'g.set.magic.tip', cost: 'low', def: 0.8, min: 0, max: 1, step: 0.05, fmt: 'pct' },
    // ---- Bild · Qualität
    { key: 'scale', g: 'img', sec: 'quality', t: 'slider', lab: 'g.set.scale', tip: 'g.set.scale.tip', cost: 'high', def: 0.9, min: 0.4, max: 1, step: 0.05, fmt: 'pct' },
    { key: 'tsr', g: 'img', sec: 'quality', t: 'switch', lab: 'g.set.tsr', tip: 'g.set.tsr.tip', cost: 'low', def: true },
    { key: 'fxaa', g: 'img', sec: 'quality', t: 'switch', lab: 'g.set.fxaa', tip: 'g.set.fxaa.tip', cost: 'low', def: true },
    { key: 'sharpen', g: 'img', sec: 'quality', t: 'switch', lab: 'g.set.sharpen', tip: 'g.set.sharpen.tip', cost: 'low', def: true },
    { key: 'dynRes', g: 'img', sec: 'quality', t: 'switch', lab: 'g.set.dynRes', tip: 'g.set.dynRes.tip', cost: 'low', def: true },
    { key: 'lite', g: 'img', sec: 'quality', t: 'switch', lab: 'g.set.lite', tip: 'g.set.lite.tip', cost: 'low', def: false },
    // ---- Bild · Dinge & Effekte
    { key: 'look', g: 'img', sec: 'objects', t: 'choice', lab: 'g.set.look', tip: 'g.set.look.tip', cost: 'low', def: 'seamless', opts: [['classic', 'g.set.look.classic', 'g.set.look.classic.tip'], ['seamless', 'g.set.look.seamless', 'g.set.look.seamless.tip']] },
    { key: 'particles', g: 'img', sec: 'objects', t: 'slider', lab: 'g.set.particles', tip: 'g.set.particles.tip', cost: 'low', def: 2, min: 0, max: 2, step: 1, vals: 'g.set.particlesV' },
    { key: 'clouds', g: 'img', sec: 'objects', t: 'slider', lab: 'g.set.clouds', tip: 'g.set.clouds.tip', cost: 'low', def: 2, min: 0, max: 2, step: 1, vals: 'g.set.cloudsV' },
    { key: 'bloom', g: 'img', sec: 'objects', t: 'switch', lab: 'g.set.bloom', tip: 'g.set.bloom.tip', cost: 'mid', def: true },
    { key: 'fancyLeaves', g: 'img', sec: 'objects', t: 'switch', lab: 'g.set.fancyLeaves', tip: 'g.set.fancyLeaves.tip', cost: 'mid', def: true },
    { key: 'smoothPlants', g: 'img', sec: 'objects', t: 'slider', lab: 'g.set.smoothPlants', tip: 'g.set.smoothPlants.tip', cost: 'mid', def: 2, min: 0, max: 2, step: 1, vals: 'g.set.smoothPlantsV' },   // t-smooth: palms as smooth props (props.js)
    { key: 'smoothFurn', g: 'img', sec: 'objects', t: 'switch', lab: 'g.set.smoothFurn', tip: 'g.set.smoothFurn.tip', cost: 'mid', def: true },   // t-smooth: the furniture as smooth props (props.js)
    { key: 'wetGround', g: 'img', sec: 'objects', t: 'switch', lab: 'g.set.wetGround', tip: 'g.set.wetGround.tip', cost: 'low', def: true },
    { key: 'airLife', g: 'img', sec: 'objects', t: 'switch', lab: 'g.set.airLife', tip: 'g.set.airLife.tip', cost: 'low', def: true },
    { key: 'anim', g: 'img', sec: 'objects', t: 'switch', lab: 'g.set.anim', tip: 'g.set.anim.tip', cost: 'low', def: true },
    { key: 'showFps', g: 'img', sec: 'show', t: 'switch', lab: 'g.set.showFps', tip: 'g.set.showFps.tip', def: false },
    { key: 'bench', g: 'img', sec: 'auto', t: 'action', lab: 'g.set.bench', tip: 'g.set.bench.tip', act: 'bench' },
    // ---- Klang
    { key: 'volMaster', g: 'snd', sec: 'vol', t: 'slider', lab: 'g.set.volMaster', tip: 'g.set.volMaster.tip', def: 0.8, min: 0, max: 1, step: 0.05, fmt: 'pct' },
    { key: 'volSfx', g: 'snd', sec: 'vol', t: 'slider', lab: 'g.set.volSfx', tip: 'g.set.volSfx.tip', def: 0.9, min: 0, max: 1, step: 0.05, fmt: 'pct' },
    { key: 'volMusic', g: 'snd', sec: 'vol', t: 'slider', lab: 'g.set.volMusic', tip: 'g.set.volMusic.tip', def: 0.45, min: 0, max: 1, step: 0.05, fmt: 'pct' },
    { key: 'volAmbient', g: 'snd', sec: 'vol', t: 'slider', lab: 'g.set.volAmbient', tip: 'g.set.volAmbient.tip', def: 0.6, min: 0, max: 1, step: 0.05, fmt: 'pct' },
    { key: 'wx', g: 'snd', sec: 'air', t: 'choice', lab: 'g.set.wx', tip: 'g.set.wx.tip', def: 'normal', opts: [['normal', 'g.set.wx.normal', 'g.set.wx.normal.tip'], ['calm', 'g.set.wx.calm', 'g.set.wx.calm.tip'], ['off', 'g.set.wx.off', 'g.set.wx.off.tip']] },
    { key: 'natSound', g: 'snd', sec: 'air', t: 'choice', lab: 'g.set.natSound', tip: 'g.set.natSound.tip', def: 'synth', opts: [['synth', 'g.set.natSound.synth', 'g.set.natSound.synth.tip'], ['off', 'g.set.natSound.off', 'g.set.natSound.off.tip']] },
    // ---- Spiel · Steuerung
    { key: 'fov', g: 'play', sec: 'steer', t: 'slider', lab: 'g.set.fov', tip: 'g.set.fov.tip', def: 75, min: 50, max: 110, step: 1, fmt: 'deg' },
    { key: 'sens', g: 'play', sec: 'steer', t: 'slider', lab: 'g.set.sens', tip: 'g.set.sens.tip', def: 1, min: 0.2, max: 3, step: 0.05, fmt: 'pct' },
    { key: 'rawInput', g: 'play', sec: 'steer', t: 'switch', lab: 'g.set.rawInput', tip: 'g.set.rawInput.tip', def: true },
    { key: 'mouseSmooth', g: 'play', sec: 'steer', t: 'switch', lab: 'g.set.mouseSmooth', tip: 'g.set.mouseSmooth.tip', def: false },
    { key: 'invertY', g: 'play', sec: 'steer', t: 'switch', lab: 'g.set.invertY', tip: 'g.set.invertY.tip', def: false },
    { key: 'viewBob', g: 'play', sec: 'steer', t: 'switch', lab: 'g.set.viewBob', tip: 'g.set.viewBob.tip', def: true },
    { key: 'turnInertia', g: 'play', sec: 'steer', t: 'switch', lab: 'g.set.turnInertia', tip: 'g.set.turnInertia.tip', def: false },
    { key: 'mouseSteer', g: 'play', sec: 'steer', t: 'switch', lab: 'g.set.mouseSteer', tip: 'g.set.mouseSteer.tip', def: false },   // 🚀 ships (flight.js): off = the mouse looks, the right button steers
    { key: 'camShake', g: 'play', sec: 'steer', t: 'switch', lab: 'g.set.camShake', tip: 'g.set.camShake.tip', def: true },          // 🚀 the ship's camera shake (flight.js)
    { key: 'sprintMode', g: 'play', sec: 'steer', t: 'choice', lab: 'g.set.sprintMode', tip: 'g.set.sprintMode.tip', def: 'hold', opts: [['hold', 'g.set.sprintMode.hold', 'g.set.sprintMode.hold.tip'], ['toggle', 'g.set.sprintMode.toggle', 'g.set.sprintMode.toggle.tip']] },
    { key: 'autoJump', g: 'play', sec: 'steer', t: 'choice', lab: 'g.set.autoJump', tip: 'g.set.autoJump.tip', def: 'auto', opts: [['auto', 'g.set.autoJump.auto', 'g.set.autoJump.auto.tip'], ['on', 'g.set.autoJump.on', 'g.set.autoJump.on.tip'], ['off', 'g.set.autoJump.off', 'g.set.autoJump.off.tip']] },
    { key: 'touch', g: 'play', sec: 'steer', t: 'choice', lab: 'g.set.touch', tip: 'g.set.touch.tip', def: 'auto', opts: [['auto', 'g.set.touch.auto', 'g.set.touch.auto.tip'], ['on', 'g.set.touch.on', 'g.set.touch.on.tip'], ['off', 'g.set.touch.off', 'g.set.touch.off.tip']] },
    { key: 'vibrate', g: 'play', sec: 'steer', t: 'switch', lab: 'g.set.vibrate', tip: 'g.set.vibrate.tip', def: true },
    { key: 'keys', g: 'play', sec: 'steer', t: 'action', lab: 'g.set.keys.open', tip: 'g.set.keys.open.tip', act: 'keys' },
    // ---- Spiel · Spielen
    { key: 'kids', g: 'play', sec: 'play', t: 'switch', lab: 'g.set.kids', tip: 'g.set.kids.tip', def: false },
    { key: 'showCoords', g: 'play', sec: 'play', t: 'switch', lab: 'g.set.showCoords', tip: 'g.set.showCoords.tip', def: false },
    { key: 'minimap', g: 'play', sec: 'play', t: 'switch', lab: 'g.set.minimap', tip: 'g.set.minimap.tip', def: true },
    { key: 'bau', g: 'play', sec: 'play', t: 'choice', lab: 'g.bau.setting', tip: 'g.bau.settingTip', def: 'site', opts: [['site', 'g.bau.site', 'g.bau.siteTip'], ['instant', 'g.bau.instant', 'g.bau.instantTip']] },   // 🏗 Baustelle (baustelle.js); Very Low's preset says instant
    { key: 'wonderCompass', g: 'play', sec: 'play', t: 'switch', lab: 'g.set.wonderCompass', tip: 'g.set.wonderCompass.tip', def: true },   // ✨ the Wunderkompass (wonders_game.js)
    { key: 'toasts', g: 'play', sec: 'play', t: 'switch', lab: 'g.set.toasts', tip: 'g.set.toasts.tip', def: true },
    { key: 'mpHost', g: 'play', sec: 'play', t: 'switch', lab: 'g.set.mpHost', tip: 'g.set.mpHost.tip', def: true },
  ];
  const S = VR.Settings = { GROUPS, COST, ITEMS, SECTIONS };
  S.add = function (item) {
    if (!item || typeof item.key !== 'string') return false;
    if (ITEMS.some(x => x.key === item.key)) return false;   // a key is one setting: the first entry stands
    ITEMS.push(item);
    return true;
  };
  S.items = (g, sec) => ITEMS.filter(x => x.g === g && (sec === undefined || x.sec === sec));
  S.byKey = (key) => ITEMS.find(x => x.key === key) || null;
  // the defaults of every setting that has one (the game's own table keeps the preset numbers)
  S.defaults = () => { const o = {}; for (const x of ITEMS) if (x.t !== 'action' && x.t !== 'info' && x.def !== undefined) o[x.key] = x.def; return o; };
  // the value a slider can show: snapped to its step and kept in the range
  S.snap = function (item, v) {
    const n = +v;
    if (!Number.isFinite(n)) return item.def;
    const lo = item.min, hi = item.max, st = item.step || 1;
    const c = Math.min(hi, Math.max(lo, n));
    const k = Math.round((c - lo) / st);
    return +(Math.min(hi, lo + k * st)).toFixed(6);
  };
  S.costOf = (item) => (item && COST[item.cost]) || null;
  // the top of a slider for these settings: a slider with maxKey takes it from the settings (F-Far: the render distance
  // reaches 32 on Ultra), never below its own max
  S.maxOf = (item, settings) => (item && item.maxKey && settings && settings[item.maxKey] > item.max ? settings[item.maxKey] : item.max);
  S.snapFor = function (item, v, settings) { const hi = S.maxOf(item, settings); return hi === item.max ? S.snap(item, v) : S.snap(Object.assign({}, item, { max: hi }), v); };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
