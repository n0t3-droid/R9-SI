# q-art · an art director's look at the first minutes (v0.55.36, Balanced and High)

Source: `/mnt/user-data/outputs/top_compare.jpg` (x-top's five normal-play views, before | after, Balanced and High).
x-top's tone fixes (Tiefe, Klarheit, Tonumfang) are visible only side by side: the frames' problems are not tone, they
are **shape, palette and material**. Ranked by how much each costs the picture, honestly:

1. **Tree canopies are cubes of leaves.** The biggest thing in three of five views (meadow, forest, street) is a
   hard-edged box of one flat green: every face one value, the box's corners razor sharp against the sky, no mass, no
   light-to-dark across the crown, no rim where the sun hits from behind, no gaps where the sky shows through. It reads
   as a placeholder, not a tree. A stylised voxel tree still needs *clumps*: rounded masses lit like a volume.
2. **The sky fights the ground.** The day sky is a stark violet-navy with a pink nebula and stars at 3 pm, over warm,
   saturated yellow-green grass and orange rooftops. Two unrelated colour worlds on one screen; the purple drains the
   ground's warmth and makes every midday frame look like dusk on another planet. There is no colour script — the hour
   does not set a palette, each element has its own.
3. **The plaza glares.** The village plaza is near-white (albedo ~0.85) with a thin grey grid: the brightest thing in
   the frame by far, with no pattern at the scale you see it, no tonal variation, no wear. It pulls the eye away from the
   people standing on it and looks like an untextured floor.
4. **Floating isles read as cardboard.** Flat brown undersides of identical stepped value, thin pale waterfalls, no
   atmospheric fade with distance — they sit on the same plane as the near trees.
5. **Grass is flat noisy tiles.** The top faces carry high-frequency texel noise at one value; the blades help up close,
   but at 10–30 m the lawn is a uniform green carpet with visible block tiling, no patches, no colour variation.
6. **Characters are boxes.** The villagers' faces and limbs are readable but flat-lit, the same saturation as the
   ground; they don't separate from the background (no rim, no value contrast).
7. **No value grouping, no focal point.** Everything is mid-to-bright and equally saturated; nothing is allowed to be
   dark, nothing leads the eye. (x-top's Tonumfang helped the range, not the grouping.)

## What q-art fixes (three, the biggest that are render-side)
- **(a) Laubkronen** — soft clumped canopies: a world-space field of rounded leaf masses gives the leaves a volume
  normal (light to dark across the crown, darker inside), a warm rim and translucency against the sun, and the corners
  of every leaf block are cut along a pixel-snapped ragged edge, so the silhouette breaks up into leaf clusters. Shader
  only (terrain cut-out programs): the mesh, the saved blocks and Very Low stay as they are.
- **(b) Farbdrehbuch** — a colour script for the sky: by day a warm haze at the horizon, a clear blue that is blue (not
  violet), a deep blue top with space and the nebula only faintly in the top third; the fill light and the far haze
  follow the same palette. Values only (env.js), no shader.
- **(c) Platzbelag** — the plaza floors: albedo down to a warm stone mid-tone, per-slab tone variation, soft wear
  mottling and darker joints, so the plaza is a surface and the people on it are the subject.

Not in scope here (next): isles' undersides and their distance haze, grass patches at mid distance, people's rim light,
a value plan per view (darks in the foreground frame).

Note for the owner: (b) deliberately departs from t-sky2's fit to the trailer stills (navy space over every day view).
It is a switch (Grafik › Licht › Farbdrehbuch); off gives the trailer's sky back.
