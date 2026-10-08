# F3 · Da-Sein — plan (8 Oct 2026)

Branch `f-presence`, based on v041. Spec: `docs/superpowers/specs/2026-10-08-realism-wave-design.md`, section F3.
Goal: the player feels inside the world — real scale, living air, wind that carries, and a feel for placing and breaking —
at a cost tier per effect, with Very Low never slower than before.

## What

1. **Body and camera** (`src/main/presence.js`, pure curves, wired in `player.js` and `game.js`)
   - eye 1.62 (exists), crouch lowers the eye to 1.27 (exists, eased).
   - FOV: default 75 (was 72), settable 60–110. Sprint kick is now additive, +8°, eased with a 50 ms time constant
     (95 % after 150 ms), instead of the old ×1.1 at 167 ms.
   - head bob: the existing formula moved into `presence.js`; the Settings toggle `viewBob` stays.
   - hand sway by walking speed (added to the existing bob of the first-person arm).
   - landing dip: after a fall of more than 0.6 blocks the eye dips up to 0.14 blocks, eased back in ~0.3 s.
   - turn inertia: optional (Settings toggle, off by default); the drawn yaw trails the real yaw by at most 0.03 rad.
     Gameplay, the raycast and the crosshair keep the real yaw.
   - placing and breaking: a 0.012 rad (place) / 0.006 rad (break) view nudge that decays in about 0.2 s, and a hand
     push forward for placing (half of it for breaking).
2. **Living air** (`src/main/airlife.js`, spawns through the existing `Particles` system; new `force` option in
   `particles.js` so the air budget is not thinned by the global particle budget)
   - Tiers by preset: potato (0) · low (1) · balanced (2) · high (3) · ultra (4); a `custom` preset uses its
     `particles` setting. Each tier has per-kind caps; Very Low has only fireflies and snow.
   - Kinds: dust motes in sunbeams indoors (sample points under a roof whose ray to the sun is clear), pollen by day in
     grass, fireflies in grass at night (blink by colour), falling leaves under canopy in wind (settle on the ground),
     settling snow (collide = stops on the ground and stays), birds (a flock of 5–9, each 3 dots: body and two wing tips
     that flap), butterflies over flowers (wander around a flower).
   - Agents (birds, butterflies, fireflies) are re-spawned each frame with life 2·dt, so their motion is computed in JS
     and nothing is left alive between frames.
3. **Wind** (`weather.js` → `env.js` → `renderer.js` → `shaders.js`)
   - weather.js: wind direction from the world seed, drifting over the day; gusts every 6–14 s, 3 s long, value 0–1.
   - env.js: `E.windDir` (unit vector) and `E.gust`.
   - TERRAIN_VS sway: along the wind direction plus across it, amplitude × (1 + 0.8·gust). With direction (1, 0) and
     gust 0 the result is byte-for-byte the old formula (`rel.x += …`, `rel.z += …`), so the look is unchanged until the
     wind turns. Mesher data and hashes are untouched.
4. **Settings** (`ui.js`, `game.js` DEFAULTS, `lang_de.js` / `lang_en.js`): FOV slider 60–110; toggles `airLife`
   (default on) and `turnInertia` (default off). The bob toggle stays.

## Order

1. Node test `test/presence.js` written first (red: the module is missing).
2. `presence.js` → green. Node tests for wind and budgets join the same file.
3. Camera and feel wiring in `player.js` / `game.js` / `entities.js` (drawHand).
4. Settings and i18n keys (German first).
5. Wind: `weather.js`, `env.js`, `renderer.js` uniforms (`u_windDir`, `u_gust`), `shaders.js` TERRAIN_VS.
6. Air life: `particles.js` (`force`), `airlife.js`, hook in `game.js` `playFrame`, `build.js` MAIN list.
7. Browser test `test/presence.mjs`: four screenshots (sunbeam room, meadow at noon, field at night, sprint and jump
   pair) plus the cost measurement; LOOK at each picture.
8. `node build.js`, `REGRESS_ONLY=node` regression, browser smoke / player2 / presence.

## How it is measured

- Node (`test/presence.js`): every curve is bounded, zero at rest, and smooth (largest change per 1/60 s is small);
  the FOV ease reaches 95 % of the kick in 150 ms; the air budget per tier is monotone and Very Low holds only fireflies
  and snow; the wind is zero at zero strength and its direction drifts slowly.
- Browser (`test/presence.mjs`): the flat world of the classic tests (seed 31), noon for the meadow and the room, night
  for the field. Cost per effect: `renderer.stats` (draws, tris) and CPU time with `performance.now()` around
  `airlife.update` + `particles.update` + `renderer.render`, averaged over 60 frames, air life off and on, on Very Low
  (potato) and High. SwiftShader makes absolute frame times meaningless, so the draw/tri counts and the CPU time of the
  air update are the numbers that count.
- The Heartland-plaza scene of the spec is not reachable through `createWorld` in the headless test, so the fixed scene
  is the flat seed-31 world (documented deviation).

## Numbers

(filled in after the browser measurement; see the bottom of this file)
