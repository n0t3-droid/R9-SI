// ============================================================================
// Block definitions — Heartland set (TRAILER.md §2.2 / §4 / §3.7): the Gate
// Temple's slate stone with grooves, pilasters and carved bands, amber glowing
// windows, orange light bars and cyan slits, the portal veil; the Spire
// Citadel's tan/brown fluted stone with window slits and trim rings; asphalt
// roads with yellow dashes for the Sky Isles; red beacon lights.
// Loaded before blocks4.js (which finalizes the registry).
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R, T = R.tex, F = VR.F, ROT = R.ROT;
  const { def, G } = VR.BL;
  const { AXIS } = VR.PROPS;
  G.HEART = 'Heartland · Temple & Spire';
  VR.GROUP_ORDER.push(G.HEART);
  const stone = { cat: 'build', group: G.HEART, tool: 'pick', needTool: true, sound: 'stone', hard: 2, blast: 8 };
  // ---- Gate Temple ----
  VR.stoneFamily('temple_stone', 'Temple Stone', T('temple_stone'), { hard: 2, blast: 8 }, G.HEART, null, { slab: 1, stairs: 1, wall: 1 });
  def('temple_stone_smooth', Object.assign({ display: 'Smooth Temple Stone', tex: T('temple_stone_smooth') }, stone));
  def('temple_stone_band', Object.assign({ display: 'Carved Temple Band', tex: { top: T('temple_stone_smooth'), bottom: T('temple_stone_smooth'), side: T('temple_stone_band') } }, stone));
  def('temple_pilaster', Object.assign({ display: 'Temple Pilaster', props: [AXIS], tex: VR.axisTex(T('temple_pilaster'), T('temple_stone_smooth')) }, stone));
  def('temple_light_bar', Object.assign({ display: 'Orange Light Bar', tex: { top: T('temple_stone_smooth'), bottom: T('temple_stone_smooth'), side: T('temple_light_bar') }, light: [11, 5, 1], flags: F.EMISSIVE }, stone, { hard: 1 }));
  def('temple_slit', Object.assign({ display: 'Cyan Light Slit', tex: { top: T('temple_stone_smooth'), bottom: T('temple_stone_smooth'), side: T('temple_slit') }, light: [3, 9, 11], flags: F.EMISSIVE }, stone, { hard: 1 }));
  def('amber_window', Object.assign({ display: 'Amber Window', tex: T('amber_window'), light: [12, 8, 2], flags: F.EMISSIVE }, stone, { hard: 1, sound: 'glass' }));
  def('portal_veil', Object.assign({ display: 'Portal Veil', tex: T('portal_veil', { veil: true }), layer: 'trans', opaque: false, filter: 0, light: [13, 10, 3], flags: F.SELFCULL | F.EMISSIVE, solid: false }, stone, { hard: 50, blast: 500 }));
  def('beacon_red', Object.assign({ display: 'Red Beacon Light', tex: T('beacon_red'), light: [15, 3, 3], flags: F.EMISSIVE }, stone, { hard: 1, sound: 'glass' }));
  // ---- Spire Citadel ----
  def('spire_stone', Object.assign({ display: 'Spire Stone', tex: T('spire_stone') }, stone));
  def('spire_stone_dark', Object.assign({ display: 'Dark Spire Stone', tex: T('spire_stone_dark') }, stone));
  def('spire_window', Object.assign({ display: 'Spire Window Slit', tex: { top: T('spire_stone'), bottom: T('spire_stone'), side: T('spire_window') }, light: [3, 9, 11], flags: F.EMISSIVE }, stone, { hard: 1 }));
  def('spire_trim', Object.assign({ display: 'Spire Trim Ring', tex: { top: T('spire_stone'), bottom: T('spire_stone'), side: T('spire_trim') }, light: [11, 6, 1], flags: F.EMISSIVE }, stone, { hard: 1 }));
  def('spire_cap', Object.assign({ display: 'Spire Cap', tex: T('spire_cap') }, stone));
  def('flagstone', Object.assign({ display: 'Flagstones', tex: T('flagstone') }, stone, { hard: 1.5, flags: F.RANDROT }));
  // ---- Sky Isles roads ----
  def('asphalt', Object.assign({ display: 'Asphalt', tex: T('asphalt') }, stone, { hard: 1.5, flags: F.RANDROT }));
  def('asphalt_zebra', Object.assign({ display: 'Asphalt · Zebra Crossing', props: [AXIS], tex: (p) => ({ top: p.axis === 1 ? ROT(T('asphalt_zebra'), 1) : T('asphalt_zebra'), bottom: T('asphalt'), side: T('asphalt') }) }, stone, { hard: 1.5 }));
  def('asphalt_dash', Object.assign({ display: 'Asphalt · Yellow Dash', props: [AXIS], tex: (p) => ({ top: p.axis === 1 ? ROT(T('asphalt_dash'), 1) : T('asphalt_dash'), bottom: T('asphalt'), side: T('asphalt') }) }, stone, { hard: 1.5 }));
})(VR);
