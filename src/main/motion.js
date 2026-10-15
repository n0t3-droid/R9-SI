// ============================================================================
// t-motion · WOW III · Alles bewegt sich (docs/superpowers/plans/2026-10-15-t-motion.md): the settings of the motion
// front and the small runtime pieces that do not belong to one older module. The three switches (game.js PRESETS):
//   motion       Wind in allem — the MOTION shaders (wind.js: the gust bands over the meadows, the lean of the plants,
//                the swing of the hung pieces, the palm fronds) and the hung pieces' sway levels in the mesh; Very Low off
//   cloudShadow  Wolkenschatten — the cumulus' shadows drift over the land (clouds.js shadowMask, renderer u_cloudShadow);
//                where the clouds are sprites (Balanced and up)
//   wxDrama      Wetter-Drama — the storm's front, the bolts, the rain blown sideways, the rainbow after the rain, the
//                valley fog at dawn (weather.js); Very Low off
// ============================================================================
(function (VR) {
  'use strict';
  const S = VR.Settings;
  if (S && S.add) {
    S.add({ key: 'motion', g: 'img', sec: 'objects', t: 'switch', lab: 'g.set.motion', tip: 'g.set.motion.tip', cost: 'low', def: true });
    S.add({ key: 'cloudShadow', g: 'img', sec: 'objects', t: 'switch', lab: 'g.set.cloudShadow', tip: 'g.set.cloudShadow.tip', cost: 'low', def: true });
    S.add({ key: 'wxDrama', g: 'img', sec: 'objects', t: 'switch', lab: 'g.set.wxDrama', tip: 'g.set.wxDrama.tip', cost: 'low', def: true });
  }
  VR.Motion = VR.Motion || {};
})(VR);
