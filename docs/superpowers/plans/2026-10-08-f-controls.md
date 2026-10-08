# F5 · Steuerung & Einstellungen — plan (8 Oct 2026, branch f-controls on v041)

Source: docs/superpowers/specs/2026-10-08-realism-wave-design.md §F5 and the W3 phase of
2026-10-07-all-ages-workflow-design.md (touch, gamepad, Kindersicher). Rules from the spec's top apply.

## What, per cost tier

**Tier 0 — free on every preset** (no per-frame GPU or CPU cost beyond a few array reads):
- Key bindings (`src/main/binds.js`): every game key is an action with two slots (primary, alternative).
  Physical codes come from the bindings; the game code keeps asking for its default names (`input.down('KeyW')`),
  so the call sites in gadgets / cockpit / starships / trams stay untouched (merge-friendly). Conflicts reported,
  reserved keys (Escape, Enter, Tab, F12, the system keys) refused, reset per action and all, JSON round-trip with sanitising.
- Raw input: pointer lock with `unadjustedMovement` when the browser offers it (default on), fallback silent.
- Mouse smoothing (off by default): exponential smoothing of the look delta, frame-rate independent.
- Gamepad (`src/main/pad.js`, standard mapping): left stick move (analog), right stick look, A jump, B sneak,
  X undo, Y inventory, Back map, LB/RB hotbar, LT place, RT break, D-pad hotbar and menu focus, Start pause (Escape),
  left stick click sprint, right stick click camera.
  Menus: D-pad moves focus between the visible buttons of the open layer, A clicks, B goes back.
  Vibration on landing (`vibrationActuator` when present), strength by fall height.
- Sprint toggle or hold (`S.sprintMode`), auto-jump (`S.autoJump`, default on in Einfach = `!UIPrefs.pro`).
- Settings registry (`src/main/settings_reg.js`): group (img / snd / play), key, label, tip, cost (low/mid/high),
  type, range, default. The panel renders from the registry; other fronts append entries.
- Settings panel in three groups Bild · Klang · Spiel, every slider snaps and shows its value, every switch has a
  one-line sentence, cost badge 🟢 kaum / 🟡 etwas / 🔴 viel on each graphics option.
- The aq governor made visible: a small "⚙ passt an" hint while it has lowered something (DOM only).
- Kindersicher: one tap on the start screen = a Zen world (peaceful, no hostiles), auto-jump on.

**Tier 1 — costs only when used:**
- Live preview thumbnail: one `drawImage` of the game canvas, two frames after a graphics option changed.
- Automatik: a 3 s benchmark (warm-up 0.5 s, median of frame times on the current scene), then the decision table
  (`src/main/bench.js`) picks preset and view distance for 60 fps (30 on weak machines). The governor is paused
  during the run.
- Touch layer (`src/main/touch.js`): DOM only, shown on touch devices (auto) or when switched on: a left virtual
  stick, look by drag (existing canvas handler), big buttons jump / break (hold) / place / inventory / sprint.

## Order (test first, commit small)

1. Baseline numbers on the untouched checkout (Very Low and High, the spawn of the default world at noon, seed 1, 1280×720): renderer.stats
   draws, tris, sections and the frame time, before any change. Written into this plan under "Measured".
2. `binds.js` + `test/binds_model.js` (node): conflicts, reset, serialization, reserved keys, name → codes.
3. `bench.js` + `test/bench_table.js` (node): median, decision table, weak-machine rule.
4. `settings_reg.js` + `test/settings_reg.js` (node): shape, cost badges, every label/tip key exists in both tables.
5. `pad.js` + `test/pad_map.js` (node): deadzone, stick mapping, press edges, rumble plan, menu focus geometry.
6. `input.js`: translation layer (`down` / `hit` / `dbl` through the bindings), capture of the next key, smoothing,
   raw input. `test/input_bind.js` (node, stubbed window/canvas).
7. `player.js`: analog move from the pad, sprint toggle, auto-jump, landing hook. `game.js`: preview hook in the
   loop, bench runner hook, aq hint, Kindersicher, settings apply for the new keys.
8. `settings_panel.js` + `ui.js` settings screen (three groups, bindings screen, Automatik button, thumbnail).
9. `touch.js`, `start.js` Kindersicher, CSS in `src/ui/controls.css` (build.js reads it), i18n keys (de first).
10. `test/controls.mjs` (browser, de-DE): rebind W→I and walk with I; a simulated Gamepad moves the player; every
    graphics option has a badge; Automatik picks a preset; the touch layer shows at 390×844 with touch; screenshots
    in test/shots/ (settings Bild, Tasten, phone touch, Automatik result), then LOOK at them.
11. `node build.js`, `test/lang.js`, `test/id_snapshot.js`, `test/mesh_same.js`, `test/gen_same.js`,
    `test/light_same.js`, `REGRESS_ONLY=node bash test/regress.sh`, browser smoke.mjs, start.mjs, lang.mjs, controls.mjs.

## How measured

- Frame cost: `renderer.stats` (draws, tris, sections) and `performance.now()` around the frame in a fixed scene
  (the spawn of the default world, seed 1, noon, 1280×720), Very Low (potato) and High, with the new code on and the settings panel closed.
  F5 adds no per-frame GPU work, so the expected result is identical draws and tris and a frame time within noise.
- Preview thumbnail and Automatik: their cost is measured as the ms of one capture and of the benchmark's
  decision (both on the main thread), reported with the numbers.
- Gamepad and touch: unit-level (node) for the mapping and the layout math; browser-level for the wiring.

## Measured

(filled in during the work — see the final report)

## Known gaps (to be reported honestly)

- Mouse buttons (break / place) stay on the mouse; key binding of break and place is a stretch goal.
- Gamepad buttons are the standard mapping, not rebindable (the keyboard screen is).
- The preview thumbnail is a capture of the live frame, not a separate render at another setting.
