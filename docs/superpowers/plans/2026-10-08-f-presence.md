# F3 · Da-Sein — plan (8 Oct 2026)

Branch `f-presence`, based on v041. Spec: `docs/superpowers/specs/2026-10-08-realism-wave-design.md`, section F3.
Goal: the player feels inside the world — real scale, living air, wind that carries, and a feel for placing and breaking —
at a cost tier per effect, with Very Low never slower than before.

## What

1. **Body and camera** (`src/main/presence.js`, pure curves, wired in `player.js` and `game.js`)
   - eye 1.62 (exists), crouch lowers the eye to 1.27 (exists, eased).
   - FOV: default 75 (was 72), settable 60–110. Sprint kick is now additive, +8°, eased with a 45 ms time constant
     (96 % after 150 ms), instead of the old ×1.1 at 167 ms.
   - head bob: the existing formula moved into `presence.js`; the Settings toggle `viewBob` stays.
   - hand sway by walking speed (added to the existing bob of the first-person arm).
   - landing dip: a fall of more than 0.6 blocks dips the eye by 0.03 per block (at most 0.14), rising in 0.05 s and
     decaying with a 0.11 s time constant (under 1 % after 0.6 s).
   - turn inertia: optional (Settings toggle, off by default); the drawn yaw trails the real yaw by at most 0.03 rad.
     Gameplay, the raycast and the crosshair keep the real yaw.
   - placing and breaking: a 0.012 rad (place) / 0.006 rad (break) view nudge that decays in about 0.2 s, and a hand
     push forward for placing (half of it for breaking).
2. **Living air** (`src/main/airlife.js`, spawns through the existing `Particles` system; new `force` option in
   `particles.js` so the air budget is not thinned by the global particle budget)
   - Tiers by preset: potato (0) · low (1) · balanced (2) · high (3) · ultra (4); a `custom` preset uses its
     `particles` setting. Each tier has per-kind caps; Very Low has only fireflies and snow.
   - Kinds: dust motes in sunbeams indoors (air points walled in on all four sides, whose ray to the sun is clear), pollen by day in
     grass, fireflies in grass at night (blink by colour), falling leaves under canopy in wind (settle on the ground),
     settling snow (collide = stops on the ground and stays), birds (a flock of 5–9, each 3 dots: body and two wing tips
     that flap), butterflies over flowers (wander around a flower).
   - Agents (birds, butterflies, fireflies) are re-spawned each frame with life 1.5·dt, so their motion is computed in JS
     and nothing is left alive between frames.
3. **Wind** (`weather.js` → `env.js` → `renderer.js` → `shaders.js`)
   - weather.js: wind direction from the world seed, drifting over the day; gusts in 10 s slots (60 % of the slots), 3 s long with a sin² envelope, value 0–1.
   - env.js: `E.windDir` (unit vector) and `E.gust`.
   - TERRAIN_VS sway: along the wind direction plus across it, amplitude × (1 + 0.5·gust). With direction (1, 0) and
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
  a frame loop of 24 frames per round (`g.loop`, then `gl.finish()`), four alternating rounds (off, on, off, on) per preset,
  the median per state; the air cost is the window mean of the time inside `airLife.update`. Run on Very Low (potato) and High. SwiftShader makes absolute frame times meaningless, so the draw/tri counts and the CPU time of the
  air update are the numbers that count.
- The Heartland-plaza scene of the spec is not reachable through `createWorld` in the headless test, so the fixed scene
  is the flat seed-31 world (documented deviation).

## Numbers

Final build, measured by `test/presence.mjs` in SwiftShader on the shared 2-CPU machine. Scene: the meadow at noon,
`renderDist` 6. Results of the same run: 19 browser checks ALL OK, no page errors.

| Preset (tier) | Air off, frame | Air on, frame | Air update, CPU per frame | Terrain draws off / on | Tris off / on |
|---|---|---|---|---|---|
| potato (Very Low, tier 0) | 2.54 ms | 1.57 ms | 0.006 ms | 2 / 2 | 3016 / 3016 |
| high (tier 3) | 0.83 ms | 1.61 ms | 0.006 ms | 2 / 2 | 3648 / 3648 |

- "Before" is air off in the same build. The pre-F3 build (v041) was not run through this test. The terrain shader change
  (`u_windDir`, `u_gust`) is in both states.
- The air update costs 0.006 ms per frame on both tiers (the test asserts under 1.5 ms on Very Low and 3 ms on High).
- The frame times do not isolate the air. Very Low reads faster with air on, which is noise. High reads 0.8 ms slower
  with air on, which a 0.006 ms update does not explain. The likely source is the particle pass (`drawParticles`, one
  instanced draw that `renderer.stats.draws` does not count), rasterised on the CPU by SwiftShader. There is no GPU
  timer on this machine, so the GPU cost of the air is not measured.
- Very Low adds at most 12 fireflies and 48 snow flakes to the existing particle pass. At noon its counters show no
  birds, butterflies, pollen or motes.
- Node: `test/presence.js` 53 checks ALL OK; `test/airlife_tiers.js` 9 checks ALL OK; node regression 17 tests, 0 failed.
