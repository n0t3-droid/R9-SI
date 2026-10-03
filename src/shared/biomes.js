// ============================================================================
// Biomes (shared): climate colors from research (grass/foliage/sky/water)
// ============================================================================
(function (VR) {
  'use strict';
  const B = VR.BIOMES = [];
  const BI = VR.BIOME = {};
  // id, key, name, temp, downfall, grass, foliage, water, sky, fog(optional), flags
  function b(key, name, temp, down, grass, foliage, water, sky, o) {
    const e = Object.assign({ id: B.length, key, name, temp, down, grass, foliage, water, sky, fog: null, precip: temp < 0.15 ? 'snow' : (down <= 0.0 ? 'none' : 'rain') }, o || {});
    B.push(e); BI[key] = e.id; return e;
  }
  const OW = 0x3F76E4;
  // Oceans
  b('ocean', 'Ocean', 0.5, 0.5, 0x8eb971, 0x71a74d, OW, 0x7ba4ff, { ocean: 1 });
  b('deep_ocean', 'Deep Ocean', 0.5, 0.5, 0x8eb971, 0x71a74d, OW, 0x7ba4ff, { ocean: 1, deep: 1 });
  b('warm_ocean', 'Warm Ocean', 0.5, 0.5, 0x8eb971, 0x71a74d, 0x43D5EE, 0x7ba4ff, { ocean: 1, warm: 1 });
  b('lukewarm_ocean', 'Lukewarm Ocean', 0.5, 0.5, 0x8eb971, 0x71a74d, 0x45ADF2, 0x7ba4ff, { ocean: 1 });
  b('deep_lukewarm_ocean', 'Deep Lukewarm Ocean', 0.5, 0.5, 0x8eb971, 0x71a74d, 0x45ADF2, 0x7ba4ff, { ocean: 1, deep: 1 });
  b('cold_ocean', 'Cold Ocean', 0.5, 0.5, 0x8eb971, 0x71a74d, 0x3D57D6, 0x7ba4ff, { ocean: 1 });
  b('deep_cold_ocean', 'Deep Cold Ocean', 0.5, 0.5, 0x8eb971, 0x71a74d, 0x3D57D6, 0x7ba4ff, { ocean: 1, deep: 1 });
  b('frozen_ocean', 'Frozen Ocean', 0.0, 0.5, 0x80b497, 0x60a17b, 0x3938C9, 0x7fa1ff, { ocean: 1, frozen: 1 });
  b('deep_frozen_ocean', 'Deep Frozen Ocean', 0.5, 0.5, 0x80b497, 0x60a17b, 0x3938C9, 0x7fa1ff, { ocean: 1, deep: 1, frozen: 1 });
  b('mushroom_fields', 'Mushroom Fields', 0.9, 1.0, 0x55c93f, 0x2bbb0f, OW, 0x77a8ff);
  // Highlands
  b('jagged_peaks', 'Jagged Peaks', -0.7, 0.9, 0x80b497, 0x60a17b, OW, 0x859dff, { cold: 1 });
  b('frozen_peaks', 'Frozen Peaks', -0.7, 0.9, 0x80b497, 0x60a17b, OW, 0x859dff, { cold: 1 });
  b('stony_peaks', 'Stony Peaks', 1.0, 0.3, 0x9abe4b, 0x82ac1e, OW, 0x76a8ff);
  b('meadow', 'Meadow', 0.5, 0.8, 0x83bb6d, 0x63a948, 0x0E4ECF, 0x7ba4ff);
  b('cherry_grove', 'Cherry Grove', 0.5, 0.8, 0xb6db61, 0xb6db61, 0x5DB7EF, 0x7ba4ff);
  b('grove', 'Grove', -0.2, 0.8, 0x80b497, 0x60a17b, OW, 0x81a0ff, { cold: 1 });
  b('snowy_slopes', 'Snowy Slopes', -0.3, 0.9, 0x80b497, 0x60a17b, OW, 0x829fff, { cold: 1 });
  b('windswept_hills', 'Windswept Hills', 0.2, 0.3, 0x8ab689, 0x6da36b, OW, 0x7da2ff);
  b('windswept_gravelly_hills', 'Windswept Gravelly Hills', 0.2, 0.3, 0x8ab689, 0x6da36b, OW, 0x7da2ff);
  b('windswept_forest', 'Windswept Forest', 0.2, 0.3, 0x8ab689, 0x6da36b, OW, 0x7da2ff);
  // Woodlands
  b('forest', 'Forest', 0.7, 0.8, 0x79c05a, 0x59ae30, OW, 0x79a6ff);
  b('flower_forest', 'Flower Forest', 0.7, 0.8, 0x79c05a, 0x59ae30, OW, 0x79a6ff);
  b('taiga', 'Taiga', 0.25, 0.8, 0x86b783, 0x68a464, 0x287082, 0x7da3ff);
  b('old_growth_pine_taiga', 'Old Growth Pine Taiga', 0.3, 0.8, 0x86b87f, 0x68a55f, OW, 0x7ca3ff);
  b('old_growth_spruce_taiga', 'Old Growth Spruce Taiga', 0.25, 0.8, 0x86b783, 0x68a464, OW, 0x7da3ff);
  b('snowy_taiga', 'Snowy Taiga', -0.5, 0.4, 0x80b497, 0x60a17b, 0x3D57D6, 0x839eff, { cold: 1 });
  b('birch_forest', 'Birch Forest', 0.6, 0.6, 0x88bb67, 0x6ba941, OW, 0x7aa5ff);
  b('old_growth_birch_forest', 'Old Growth Birch Forest', 0.6, 0.6, 0x88bb67, 0x6ba941, OW, 0x7aa5ff);
  b('dark_forest', 'Dark Forest', 0.7, 0.8, 0x507a32, 0x59ae30, OW, 0x79a6ff);
  b('pale_garden', 'Pale Garden', 0.7, 0.8, 0x778272, 0x878d76, 0x76889D, 0xb9b9b9, { fog: 0x817770 });
  b('jungle', 'Jungle', 0.95, 0.9, 0x59c93c, 0x30bb0b, OW, 0x77a8ff);
  b('sparse_jungle', 'Sparse Jungle', 0.95, 0.8, 0x64c73f, 0x3eb80f, OW, 0x77a8ff);
  b('bamboo_jungle', 'Bamboo Jungle', 0.95, 0.9, 0x59c93c, 0x30bb0b, OW, 0x77a8ff);
  b('dappled_forest', 'Dappled Forest', 0.3, 0.6, 0xdf6827, 0xe68e30, 0x16213A, 0x7ca3ff);
  // Wetlands
  b('river', 'River', 0.5, 0.5, 0x8eb971, 0x71a74d, OW, 0x7ba4ff, { river: 1 });
  b('frozen_river', 'Frozen River', 0.0, 0.5, 0x80b497, 0x60a17b, 0x3938C9, 0x7fa1ff, { river: 1, frozen: 1 });
  b('swamp', 'Swamp', 0.8, 0.9, 0x6a7039, 0x6a7039, 0x617B64, 0x78a7ff, { fog: 0x7d8a6a });
  b('mangrove_swamp', 'Mangrove Swamp', 0.8, 0.9, 0x6a7039, 0x8db127, 0x3A7A6A, 0x78a7ff, { fog: 0x7d8a6a });
  b('beach', 'Beach', 0.8, 0.4, 0x91bd59, 0x77ab2f, OW, 0x78a7ff);
  b('snowy_beach', 'Snowy Beach', 0.05, 0.3, 0x83b593, 0x64a278, 0x3D57D6, 0x7fa1ff, { cold: 1 });
  b('stony_shore', 'Stony Shore', 0.2, 0.3, 0x8ab689, 0x6da36b, OW, 0x7da2ff);
  // Flatlands
  b('plains', 'Plains', 0.8, 0.4, 0x91bd59, 0x77ab2f, OW, 0x78a7ff);
  b('sunflower_plains', 'Sunflower Plains', 0.8, 0.4, 0x91bd59, 0x77ab2f, OW, 0x78a7ff);
  b('snowy_plains', 'Snowy Plains', 0.0, 0.5, 0x80b497, 0x60a17b, OW, 0x7fa1ff, { cold: 1 });
  b('ice_spikes', 'Ice Spikes', 0.0, 0.5, 0x80b497, 0x60a17b, OW, 0x7fa1ff, { cold: 1 });
  // Arid
  b('desert', 'Desert', 2.0, 0.0, 0xbfb755, 0xaea42a, 0x32A598, 0x6eb1ff);
  b('savanna', 'Savanna', 2.0, 0.0, 0xbfb755, 0xaea42a, 0x2C8B9C, 0x6eb1ff);
  b('savanna_plateau', 'Savanna Plateau', 2.0, 0.0, 0xbfb755, 0xaea42a, 0x2590A8, 0x6eb1ff);
  b('windswept_savanna', 'Windswept Savanna', 2.0, 0.0, 0xbfb755, 0xaea42a, 0x2590A8, 0x6eb1ff);
  b('badlands', 'Badlands', 2.0, 0.0, 0x90814d, 0x9e814d, 0x4E7F81, 0x6eb1ff);
  b('wooded_badlands', 'Wooded Badlands', 2.0, 0.0, 0x90814d, 0x9e814d, 0x55809E, 0x6eb1ff);
  b('eroded_badlands', 'Eroded Badlands', 2.0, 0.0, 0x90814d, 0x9e814d, 0x497F99, 0x6eb1ff);
  // Caves
  b('deep_dark', 'Deep Dark', 0.8, 0.4, 0x91bd59, 0x77ab2f, OW, 0x78a7ff, { cave: 1, fog: 0x0a0f14 });
  b('dripstone_caves', 'Dripstone Caves', 0.8, 0.4, 0x91bd59, 0x77ab2f, OW, 0x78a7ff, { cave: 1 });
  b('lush_caves', 'Lush Caves', 0.5, 0.5, 0x8eb971, 0x71a74d, OW, 0x7ba4ff, { cave: 1 });
  b('sulfur_caves', 'Sulfur Caves', 0.8, 0.4, 0xaba64f, 0x9c9a2c, 0x9FD83A, 0x78a7ff, { cave: 1, fog: 0x6e7d2e });
  b('ice_caves', 'Ice Caves', -0.5, 0.5, 0x80b497, 0x60a17b, 0x3938C9, 0x7fa1ff, { cave: 1, fog: 0x7fa6c8 });
  // Underforge
  b('ember_wastes', 'Ember Wastes', 2.0, 0.0, 0xbfb755, 0xaea42a, OW, 0x6eb1ff, { forge: 1, fog: 0x3b0f0a });
  b('gloom_valley', 'Gloom Valley', 2.0, 0.0, 0xbfb755, 0xaea42a, OW, 0x6eb1ff, { forge: 1, fog: 0x1b4745 });
  b('crimson_grove', 'Crimson Grove', 2.0, 0.0, 0xbfb755, 0xaea42a, OW, 0x6eb1ff, { forge: 1, fog: 0x330303 });
  b('teal_grove', 'Teal Grove', 2.0, 0.0, 0xbfb755, 0xaea42a, OW, 0x6eb1ff, { forge: 1, fog: 0x1a051a });
  b('basalt_deltas', 'Basalt Deltas', 2.0, 0.0, 0xbfb755, 0xaea42a, OW, 0x6eb1ff, { forge: 1, fog: 0x685f70 });
  // Hollow
  b('hollow_core', 'The Hollow', 0.5, 0.0, 0x8eb971, 0x71a74d, OW, 0x000000, { hollow: 1, fog: 0x0a0812 });
  b('hollow_highlands', 'Hollow Highlands', 0.5, 0.0, 0x8eb971, 0x71a74d, OW, 0x000000, { hollow: 1, fog: 0x0a0812 });
  b('hollow_barrens', 'Hollow Barrens', 0.5, 0.0, 0x8eb971, 0x71a74d, OW, 0x000000, { hollow: 1, fog: 0x0a0812 });
  // Drift (our own sky archipelago dimension)
  b('drift_isles', 'Drift Isles', 0.6, 0.6, 0x6fd6a0, 0x4fcf8f, 0x66E0FF, 0x9ec7ff, { drift: 1, fog: 0xcfe3ff });
  b('drift_meadow', 'Drift Meadow', 0.6, 0.6, 0x9ae07a, 0x6fcf5a, 0x66E0FF, 0x9ec7ff, { drift: 1, fog: 0xcfe3ff });
  b('prism_reach', 'Prism Reach', 0.4, 0.6, 0xb0b8ff, 0x9fa8ff, 0x8AB8FF, 0xb4b4ff, { drift: 1, fog: 0xd8d4ff });
  VR.biomeByKey = (k) => B[BI[k]];
})(VR);
