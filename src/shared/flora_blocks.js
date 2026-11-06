// ============================================================================
// v-flora · the blocks of the blooming flora (docs/superpowers/plans/2026-11-05-v-flora.md), our own:
//   bloom_snow_leaves · bloom_lilac_leaves · bloom_gold_leaves · bloom_rose_leaves   blossom leaves (Schneeblüte,
//        Lilablüte, Goldblüte, Rosenblüte): leaves in bloom, the wind sways them like every leaf (WAVELEAF)
//   candle_flower (Kerzenblume, a violet-blue spike) · umbel_flower (Schirmblume, white umbels) · bell_tower_flower
//        (Glockenturm, pink bells up a stem): tall meadow flowers, two blocks high
//   glowbell (Glimmglocke): a small flower whose bells glow softly (light 7) — the wonder spots' rings at night
//   clover (Klee): ground cover, round leaves with white and pink heads, on the ways' edges
// All are ordinary blocks (cubes, crossed sprites, ground cover): Very Low draws them as any leaf or flower.
// Registered LATE — one VR.BL.late push after every older pack (u-stations' stn_clamp is the block before them):
// build.js puts this file right before blocks4 after stn_blocks (AGENTS.md rule 1, test/id_snapshot.js).
// Textures: src/main/tex_flora.js.
// ============================================================================
(function (VR) {
  'use strict';
  if (!VR.BL || (VR.R && VR.R.T)) return;
  VR.BL.late = VR.BL.late || [];
  VR.BL.late.push(function () {
    const R = VR.R, T = R.tex, MD = VR.MODEL, F = VR.F, FF = VR.FFLAG || {}, def = VR.BL.def || R.def, G = VR.BL.G || {};
    if (!MD || !def || R.byName.bloom_snow_leaves || !R.byName.stn_clamp) return;
    const P = VR.PROPS || {};
    const leafS = { cat: 'nature', group: G.PLANT, layer: 'cutout', opaque: false, hard: 0.2, blast: 0.2, tool: 'hoe', sound: 'leaves', flam: [30, 60], filter: 1 };
    for (const [id, D] of [['bloom_snow_leaves', 'Snow Blossom'], ['bloom_lilac_leaves', 'Lilac Blossom'], ['bloom_gold_leaves', 'Gold Blossom'], ['bloom_rose_leaves', 'Rose Blossom']])
      def(id, Object.assign({ display: D, props: [['persistent', 2], ['distance', 8]], tex: T(id.replace('_leaves', '')), tint: 0, flags: F.LEAVES | F.RANDTICK | F.WAVELEAF, wood: 'cherry', sapling: 'cherry' }, leafS));
    const plantS = { cat: 'nature', group: G.FLOWER, shape: 'model', layer: 'cutout', hard: 0, blast: 0, sound: 'plant', solid: false, flower: true, flam: [60, 100], jitter: true };
    const wv = FF.WAVE || 0;
    for (const [id, D, dye] of [['candle_flower', 'Candle Flower', 'blue'], ['umbel_flower', 'Umbel Flower', 'white'], ['bell_tower_flower', 'Bell Tower Flower', 'pink']]) {
      const lo = T(id + '_bottom'), hi = T(id + '_top');
      def(id, Object.assign({ display: D, props: [P.HALF], tex: (p) => p.half ? hi : lo, model: (p) => MD.cross(p.half ? hi : lo, { flags: wv }), flags: F.PLANT, tall: true, dye }, plantS));
    }
    const gt = T('glowbell');
    def('glowbell', Object.assign({ display: 'Glowbell', tex: gt, model: () => MD.cross(gt, { flags: wv }), flags: F.PLANT, light: [3, 6, 7], dye: 'light_blue' }, plantS));
    const ct = T('clover');
    def('clover', Object.assign({ display: 'Clover', props: [['count', [1, 2, 3, 4]], P.FACING4], tex: ct, model: (p) => VR.groundCoverModel(p.count + 1, p.facing, ct), flags: F.PLANT | F.REPLACE, dye: 'white' }, plantS, { flower: false, group: G.PLANT }));
  });
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
