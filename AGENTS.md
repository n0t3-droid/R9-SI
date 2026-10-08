# Working on R9-SI with an AI agent (or as a human) — read this first

R9-SI is a browser voxel game (WebGL 2, web workers, no framework, no build step beyond `node build.js`) with its
editor R9 Studio. Everything is plain JavaScript under `src/`; `build.js` bundles it into single HTML files in `dist/`.

## Build and run
- `node build.js` → `dist/index.html` (the game, double-click to play), `dist/studio.html` (the Studio),
  `dist/artifact.html` / `dist/studio_artifact.html` (the same pages as body fragments for claude.ai artifacts).
- Serve `dist/` with any static server to test in a browser (`python3 -m http.server --directory dist`).
- GitHub Pages: `.github/workflows/pages.yml` builds and publishes `dist/` on every push to `master`.

## Tests (every real test ends with `ALL OK` or `FAILED n`)
- Node tests: `node test/<name>.js` (e.g. `id_snapshot.js`, `lang.js`, `gen_same.js`, `mesh_same.js`).
- Browser tests (Playwright, headless Chromium with SwiftShader): `node test/<name>.mjs`; they serve `dist/`
  themselves. `bash test/wt_run.sh <name>` runs one test with the machine-wide slot locks used here.
- `bash test/regress.sh` runs every test that prints `ALL OK` (a script opts out with a line `regress: skip`).
- `test/SUITE.md` describes the suite; screenshots land in `test/shots/` (git-ignored) — look at them.

## Hard rules (they protect saved worlds, players and the law)
1. **Block ids are append-only.** Saved worlds store raw state ids. Never insert, reorder or remove a block/state;
   new blocks only at the very end (`VR.BL.late`). `node test/id_snapshot.js` must stay `ALL OK`.
2. **Reference hashes.** `test/gen_same.js`, `mesh_same.js`, `light_same.js` pin the generator, mesher and light output.
   Change them only on purpose, with a new reference and a note in the commit; old worlds' generated chunks must stay
   identical (world generation is versioned by `vgen`).
3. **Every player-facing text is bilingual**: `VR.I18N.tx(key, vars, de, en)` or `T(key)` with keys in
   `src/main/lang_de.js` and `src/main/lang_en.js` (`node test/lang.js` checks). German first.
4. **Players never need an AI account.** The game and the Studio run fully offline; no `sample`/LLM calls at runtime,
   no requests to external servers (fonts are embedded, OFL licensed).
5. **Low-end PCs first.** Every effect has a cost tier and a switch; the Very Low (`potato`) preset must not get slower.
   No per-frame allocations in hot paths; workers do the heavy lifting.
6. **Everything is our own.** No assets, names, textures, sounds or code copied from other games or brands
   (the legal audit is in `docs/legal/`). Procedural only.
7. **Commit small, test first.** Write the failing test, make it pass, commit with a message that says what changed and
   why. Don't edit `README.md` / `ROADMAP.md` for feature work; the coordinator writes release notes.

## Where things are
- `src/shared/` — code the main thread AND the workers run: block registry (`registry.js`, `blocks*.js`), world
  generators (`gen_*.js`, `biomes.js`), mesher, physics, the R9 Forge (`forge*.js`), voxel model packs (`vox*.js`).
- `src/main/` — the game: renderer, shaders, world streaming, player, UI (`ui.js`, `start.js`), weather, audio,
  villagers, ships, the Bauhand/wizard, Zeitraffer, mirror building, legal screens, the language tables.
- `src/studio/` — R9 Studio (editor): catalogue, crafter, workbench, world mode, Forge, wizard, bridge to the game.
- `src/worker/worker_main.js` — the worker entry (generation, meshing, lighting, textures, Forge jobs).
- `docs/superpowers/specs/` — design specs; `docs/superpowers/plans/` — implementation plans; `docs/trailer/` — the
  trailers (34 stills) and the fidelity brief: the trailers are the visual target of the project.
- `TRAILER.md` — the frame-by-frame specification of the Heartland (the trailer's world).

## Branches
`master` = the last release (tags `v0.NN`). `vNNN` = the integration branch of the next release. Feature branches
(`f-*` realism fronts, `t-*` trailer fidelity, and named ones) are merged into the integration branch by the coordinator.
