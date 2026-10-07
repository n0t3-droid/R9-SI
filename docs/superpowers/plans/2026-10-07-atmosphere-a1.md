# A1 „Atmosphäre" (Wetter & Klang & Tag/Nacht) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The world feels alive — biome-weighted weather with smooth transitions, lightning and thunder, wet ground and rainbows, a synthesized soundscape by place and hour, golden/blue hours, moon phases and village glow — at ≤ 0.5 ms extra frame time on „Sehr niedrig".

**Architecture:** `VR.Weather` (new `src/main/weather.js`) derives the weather kind deterministically from world seed + absolute ticks + the climate under the player and smooths it into a *sample* that `VR.Env` turns into sky, light and fog values. `VR.Ambience` (new `src/main/ambience.js`) mixes synthesized layers from a context sampled every 0.5 s through a capped Web Audio graph. Shaders get four `vec4` uniforms in COMMON; everything else is CPU-side.

**Tech Stack:** plain ES2017 in one HTML file (build.js), WebGL2/GLSL ES 3.0, Web Audio, Node tests (`bash test/wt_run.sh x.js`), Playwright + SwiftShader browser tests (`bash test/wt_run.sh x.mjs`).

**Spec:** `docs/superpowers/specs/2026-10-07-import-atmosphere-design.md` §4 (A1 row set), §5 budgets, decision 2 (Himmel).

## Global Constraints

- Every effect has a ⚙ switch and a documented potato cost; „Aus" = today's behaviour (Env output for clear weather is byte-identical to v0.39, pinned by `test/env_v039.json`).
- ≤ 0.5 ms extra frame time on potato with everything on; weather/ambience context ≤ 0.2 ms per frame; shader additions a few ALU ops, no new texture reads; ≤ 12 Web Audio nodes alive for the ambience.
- Zero new bytes for sounds (synthesized only; no „Aufnahmen" pack in A1), no Claude/AI dependency, block ids unchanged, saved worlds valid.
- German texts via `VR.I18N.tx(key, vars, de, en)` when present (fallback: `r9si.lang`, else browser language); do not edit README.md / ROADMAP.md.
- Shader edits stay in sky / fog / weather / post paths: COMMON, SKY_FS, CLOUD_FS, RAIN_VS; TERRAIN_FS gets a single `#ifndef LITE` hook line (branch `gfx` rewrites that shader's albedo part).
- Host and guests agree: kind = f(world seed, absolute ticks = day·24000 + ticks, climate); a forced `/wetter` state and the world's Himmel ride along the 3-s `env` sync (`wx`, `ws`, `hm`).

## Decisions (spec gaps filled)

| Topic | Decision |
|---|---|
| Kinds & order | `clear, cloudy, fog, rain, storm, snow` (Klar, Bewölkt, Nebel, Regen, Gewitter, Schnee). |
| Weights | biomes.js `wx` climate: dry 85/10/5/0/0/0, temperate 45/25/10/15/5/0, wet 30/25/10/25/10/0, cold 40/25/10/0/0/25, `none` (Underforge, Hollow) = no weather. Climate: temp < 0.15 cold · down ≤ 0 dry · down ≥ 0.85 wet · else temperate. |
| Schedule | Windows of 24000 ticks shifted by a seed phase; inside, slots of 6000–24000 ticks (5–20 min) from `M.hash2`; a remainder < 6000 joins the previous slot. Each slot has one value `u ∈ [0,1)`; the kind is `u` mapped through the local climate's cumulative weights (so a temperate shower is snow in the cold biome next door and clear in the desert). Day 0 (absolute ticks < 24000) is always clear: new worlds start fair (and older screenshot tests keep their look). |
| Modes | Wetter `normal` · `calm` (rain/storm/snow/fog → cloudy) · `off` (always clear, no wet, no lightning). Zen „Weather locked" = clear. Sleeping forces clear for 6000 ticks. |
| `/wetter <kind>` | de/en names (`klar clear sonne`, `bewölkt bewoelkt wolken cloudy`, `nebel fog`, `regen rain`, `gewitter sturm storm thunder`, `schnee snow`, `auto`); lasts 12000 ticks then the schedule resumes; `/weather` maps onto it; guests are told the host decides. |
| Smoothing | per-second exponential approach: rain τ 12 s, cloud/overcast τ 20 s, fog τ 25 s, wind τ 10 s, storm τ 8 s; wet rises τ 40 s while rain > 0.2, dries τ 100 s; `snap()` jumps to the targets. |
| Lightning | while storm > 0.6: a strike every 8–25 s; distance 170–1370 blocks, thunder delay = distance / 343 (0.5–4 s); flash 0.25–1 by distance; bolt drawn in the sky 0.3 s; ⚙ „Blitze" off → no flash/bolt, thunder stays. |
| Nebel | kind fog: height-fog layer (top = sea + 9, falloff 5 blocks, density 0.05 at dawn 22000–2500, 0.02 otherwise) + distance fog: at dawn with the player below top + 10 or near water, density ×3 and fogEnd = max(48, …) toward 48. |
| Wet look | `u_wx.x` wet; TERRAIN_FS (not LITE): up faces outdoors ×(1 − 0.15·wet), extra specular (power 48, 0.5·wet) + a cheap sky sheen; rainbow alpha = 0.35·sun·smoothstep(0.3,0.6,wet)·(1 − smoothstep(0.05,0.2,rain))·(1 − overcast) at 42° around the anti-solar point, 6 bands + a faint 51° bow. ⚙ „Nasser Boden & Regenbogen" (potato off). |
| Day & night | Himmel per world `meta.sky`: `dusk` (default, unchanged) / `real`: sun to 70°, golden hour fades at |sun y| = 0.357 (±1.5 h), blue hour (sun −2°…−12°) deep-blue palette, nights ×0.6. Moon phase = ((day + tod) mod 8) / 8 for everyone. Stars/nebula dim with overcast. City glow: warm dome toward the nearest village site at night, strength 0.35·night·(1 − (d − 80)/600), ⚙ „Dorflichter". |
| Snow layer | sim random tick on sky-lit (15) grass/leaves with air above, in `precip === 'snow'` biomes, while the local weather snows (`weather.snowing`): 1-layer `snow`, p = 0.15; ⚙ „Schnee bleibt liegen". Host only (sim runs on the host). |
| Ambience | layers wind, rain, thunder, water, town, birds, crickets through one muffle lowpass into `audio.amb` (the existing „Umgebung" volume). Node costs: shared 2 (noise source, muffle), wind/rain/water/town/thunder 2 each, crickets 2, birds 3. Allocation by priority thunder > rain > wind > water > crickets > birds > town; a layer only starts when alive + cost ≤ 12; silent layers free their nodes 1.5 s after fading. Indoors (sky light < 4 with a roof): muffle 800 Hz and −9 dB. Natur-Klänge „Aus" → the v0.39 rain/wind loops exactly. |
| Settings | `wx` ('normal'), `wxWet` (true; potato false), `wxBolts` (true), `wxSnow` (true), `amb` ('synth'), `ambLayers` {wind, rain, birds, crickets, water, town: true}, `skyGlow` (true); tab „🌦 Atmosphäre"; potato preset: `wxWet: false`. Missing keys in old saves come from the saved preset. |

## Review Focus

- Time jumps (`/time set`, sleeping, MP catch-up): the slot lookup is O(1) per window and the smoothing must not flash — covered in Task 2 (`slotAt` far in the future, `update` after a jump stays continuous).
- A guest joining mid-storm sees the same kind as the host (seed + host ticks + forced state) — Task 2 `toNet/fromNet` round trip, Task 5 browser check of `wx` in envData.
- Audio context missing or suspended (no user gesture yet): Ambience must no-op, not throw — Task 3 test with `audio.ctx = null`.
- Switching Natur-Klänge to „Aus" mid-storm frees every node and returns to the old loops — Task 3 test (nodes = 0 after `setEnabled(false)` + update).
- Old saved settings without the new keys keep working (potato users get `wxWet: false` from their preset) — Task 5 browser check through `loadSettings`.

---

### Task 1: Climate weights and the deterministic schedule

**Files:**
- Modify: `src/shared/biomes.js` (the `b()` factory: `wx`)
- Create: `src/main/weather.js` (static part), `build.js` (MAIN: `'weather'` after `'env'`)
- Test: `test/weather.js`

**Interfaces:**
- Produces: `VR.Weather.KINDS`, `VR.Weather.WEIGHTS`, `VR.Weather.climate(biome) -> 'dry'|'temperate'|'wet'|'cold'|null`, `VR.Weather.slotAt(seed, T) -> {k, j, start, end, u}`, `VR.Weather.kindFor(u, climate) -> kind`, `VR.Weather.absTicks(env) -> number`.

- [ ] Step 1: tests — same seed & T → same slot and kind; different seeds differ on ≥ 30 % of 200 slots; every slot 6000 ≤ len ≤ 30000 and contiguous (end of one = start of next over 40 days); `slotAt(seed, T)` for T at 10^9 ticks returns in < 1 ms; first day (T < 24000) clear; climate of plains/desert/jungle/snowy_plains/ember_wastes = temperate/dry/wet/cold/null; kind frequencies over 4000 slots within ±4 points of the weights per climate; dry never rain/storm/snow; cold never rain/storm; monotone: for one `u`, temperate rain ⇒ cold snow.
- [ ] Step 2: run `bash test/wt_run.sh weather.js 300` → fails (no VR.Weather).
- [ ] Step 3: implement (algorithm in Decisions/Schedule).
- [ ] Step 4: run → passes. Step 5: commit.

### Task 2: Weather session — force, modes, smoothing, wet, rainbow, fog, lightning, net

**Files:** Modify `src/main/weather.js`; Test `test/weather.js`

**Interfaces:**
- Produces: `new VR.Weather(seed)`; `w.mode` ('normal'|'calm'|'off'); `w.force(kind|null, T, dur = 12000)`; `w.kindAt(T, climate) -> kind`; `w.update(dt, ctx) -> S` with ctx `{T, biome, y, sunUp, tod, nearWater, freeze}` and S `{kind, climate, rain, snow, cloud, overcast, sunMul, expMul, fog, fogEnd, fogMul, fogLayer:[top, dens], wind, windDir:[x,z], wet, rainbow, storm, next}`; `w.snap()`; `w.takeStrike() -> null | {dir:[x,z], dist, flash, delay, gain}`; `w.snowing`; `w.toNet() -> {wx, ws}`; `w.fromNet(o)`; `VR.Weather.CLEAR` (the sample Env uses when no weather runs).
- Consumes: Task 1 statics.

- [ ] Step 1: tests — force('storm') wins until T + 12000, then the schedule; mode calm never yields fog/rain/storm/snow, off always clear; freeze → clear; after clear→rain the rain value is < 0.2 at 1 s and > 0.9 at 60 s (dt 0.1 steps); wet > 0.9 after 2 min of rain, wet < 0.3 three minutes after it stops; rainbow > 0.1 when wet 0.6, rain 0, sun up, clear and 0 while raining; fog at tod 23500 below top → fogMul ≈ 3 and fogEnd 48, at noon fogMul < 3; storm: over 120 s, 4–15 strikes, each delay in [0.5, 4] and = dist/343; mode off → no strikes; toNet/fromNet round trip reproduces the forced kind.
- [ ] Step 2: run → fails. Step 3: implement. Step 4: run → passes. Step 5: commit.

### Task 3: Ambience mixer

**Files:** Create `src/main/ambience.js`, `build.js` (MAIN: `'ambience'` after `'audio'`); Test `test/ambience.js`

**Interfaces:**
- Produces: `new VR.Ambience(audio, {rand})`; `amb.setEnabled(bool)`; `amb.setLayers({wind, rain, birds, crickets, water, town})`; `amb.update(dt, ctx)` with ctx `{tod, night, birdK, temp, rain, snow, storm, wind, y, speed, indoors, cave, underwater, water (0..1), village (0..1)}`; `amb.thunder(delay, gain, dist)`; `amb.alive() -> nodes`; `amb.levels -> {layer: target}`; `amb.muffled -> bool`; `VR.Ambience.context(game, S) -> ctx` (game-side sampler).
- Consumes: `VR.Audio` instance fields `ctx`, `amb`, `noise`.

- [ ] Step 1: tests with a stub AudioContext (counts live nodes, records AudioParam automation): night meadow (tod 18000, temp 0.8, dry) → crickets > 0, birds 0; day forest (tod 3000, birdK 1) → birds > 0 and oscillator frequency automation between 1500 and 6000 Hz; indoors → muffle frequency target 800 and wind level ×0.355; storm + `thunder(2, 1)` → a thunder gain automation ≥ 2 s ahead; a crowded dusk (every layer wanted) never exceeds 12 live nodes over 60 s; layer switched off → its nodes freed; `setEnabled(false)` → 0 nodes; `audio.ctx = null` → update is a no-op.
- [ ] Step 2: run → fails. Step 3: implement. Step 4: run → passes. Step 5: commit.

### Task 4: Env + shaders + renderer

**Files:** Modify `src/main/env.js`, `src/main/shaders.js` (COMMON, SKY_FS, CLOUD_FS, RAIN_VS/FS, TERRAIN_FS hook), `src/main/renderer.js` (`common()`, `drawPrecip()`, `updateClouds()`); Test `test/env_atmo.js`, fixture `test/env_v039.json` (recorded from v0.39's env.js: freezeWeather, dt 1).

**Interfaces:**
- Consumes: S from Task 2 (`o.wx`), `o.sky` ('dusk'|'real'), `o.glow` ([dx, dz, strength] or null), `o.bolts` (bool), `o.wet` (bool).
- Produces on E: `wx: [wet, overcast, rainbow, moonPhase]`, `fogH: [camY, top, dens, skyFog]` (camY filled by the renderer), `bolt: [x, y, z, k]`, `glow: [x, y, z, k]`, `windV: [x, z]`, `cloudX` (integrated cloud drift); renderer sets `u_wx`, `u_fogH`, `u_bolt`, `u_glow`, `u_windV`.

- [ ] Step 1: tests — every fixture case with `wx: CLEAR`, `sky: 'dusk'` equals v0.39 to 1e-6; cloudy → cloudCover 0.8 and sunColor = clear × 0.6; storm → exposure × 0.7; fog sample at dawn → fog[1] = 48 and fog[2] = 3 × clear; real sky: noon sun elevation 70° ± 1°, sunset palette (E.sunset) zero 2 h after sunrise and > 0 at 0.5 h, midnight ambSky = 0.6 × dusk mode's, blue hour (sun y −0.1) zenith bluer than the dusk mode's (b/r ratio); moon phase advances by 1/8 per day.
- [ ] Step 2: run → fails. Step 3: implement Env; shaders (rainbow, bolt, overcast stars, city glow, moon phase from `u_wx.w`, height fog in `applyFog` behind `u_fogH.z > 0`, `wetSheen()` + the TERRAIN_FS hook, wind slant in RAIN_VS); renderer uniforms. Step 4: node test passes and `node build.js` builds. Step 5: commit.

### Task 5: Game wiring, settings, UI, MP, sim, commands

**Files:** Modify `src/main/game.js` (DEFAULTS/PRESETS, `loadSettings`, `applySettings`, `envFor`, `playFrame`, `debugText`, `chat`), `src/main/ui.js` (tab „🌦 Atmosphäre", zen lock, create-world Himmel), `src/main/mp.js` (`envData`, `onEnv`), `src/main/sim.js` (snow layer), `src/main/crafting.js` (sleep clears), `src/main/villages.js` (18:00 bell); Test `test/atmosphere.mjs`.

**Interfaces:**
- Consumes: Tasks 2–4.
- Produces: `game.weather` (VR.Weather per world), `game.ambience`, `game.wxSample`, `game.weatherCommand(arg)`, `game.skyMode()`, `game.setSkyMode(m)`, `game.atmoText(key, vars)`.

- [ ] Step 1: browser test (shots `test/shots/atmo_*.png`): each kind renders via `/wetter` (rain, storm with a strike, fog at dawn from a hill, snow in a cold biome, wet + rainbow after rain), golden and blue hour in Echter Tag, clear night with stars and moon, a village at night with glow; `/wetter regen` → kind rain and a chat line; F3 contains „Wetter"; toggles: wx off → no precip, amb off → 0 nodes, wxWet off → `u_wx.x` 0; fog raises density ×3; storm flashes; potato: frame delta (all on vs all off, interleaved, median) ≤ 0.5 ms; no pageerror.
- [ ] Step 2: run → fails. Step 3: implement. Step 4: run → passes; look at every shot. Step 5: commit.

### Task 6: Regression + beauty pass

- [ ] Rebuild; run `smoke.mjs`, `player2.mjs`, `sky.mjs`, `water_look.mjs`, `test/id_snapshot.js` one at a time in the background; compare shots with the v0.39 ones; iterate on colours until rain, wet ground, fog, storm light, snow, golden/blue hour, night and village glow look right; commit.
