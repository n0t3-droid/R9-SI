# x-top · Kritik: der Trailer „Die Welt heute" gegen das Handwerk der Spitzenspiele

Source: `/mnt/user-data/outputs/trailer_welt_v2.mp4` (46 s, 1280 × 720, 24 fps), ten frames at 5 %, 15 %, … 95 %
(`test/shots/xtop_before/f1..f10.jpg`, sheet `test/shots/xtop_before_sheet.jpg`), compared with the project's own
target stills (`docs/trailer/frames`, sheet `test/shots/xtop_target_sheet.jpg`). Judged on general craft principles
only — no game's assets or style copied.

## What the frames show

| # | Shot | What an art director would say |
|---|------|--------------------------------|
| 1 | Isles over the lake | Milky. The whole frame sits between 30 % and 85 % grey: no black anywhere, the haze and the falls' spray veil the isles' undersides. The isles do not separate from the land behind (no value step, no aerial-perspective layering). |
| 2 | Meadow, family | Grass texture reads well; the animals float — no contact darkening under their feet; the hedge blocks are flat lime cubes, no crevice darkness between them. Stars in the day sky are intentional (the target stills have them). |
| 3 | Village plaza | The best composition, but flat ambient: palm trunks, lanterns and people stand on the tiles without a contact shadow; the building's recesses are as bright as its face. Bloom eats the portal. |
| 4 | The old tree | Good silhouette; the trunk's block steps have no occlusion in the inner corners, so the form reads as a pixel sprite, not a mass. |
| 5–6 | Isles from below, ship | The glowing spheres bloom into soft white blobs; the isles' undersides are a uniform orange-brown: no gradient from the light above into dark below. |
| 7–8 | Outpost, BEFREIT | Best colour script (violet sky against green); the cliff on the right is mid-grey mush, the frame lacks a dark foreground anchor. Caption over grass is low-contrast. |
| 9–10 | Night isles, title | Nice warm/cool split, but the blacks are lifted blue-grey; the neon lines shimmer (8 fps interpolated). |

Across all frames: **softness** — the picture is blurred (render scale 0.75 upscaled, then motion-interpolated from
12 captured fps; interpolation smears edges in every pan) and there are **no darks**: the target stills keep deep
crevices and a black point, ours never go below ~25 % grey.

## The five biggest gaps (by visible impact per effort)

1. **Softness of the capture** (resolution, AA, interpolation smear) — *capture problem first*. The recorder ran on
   SwiftShader at **High**, render scale **0.75** (56 % of the pixels), 12 fps → 24 interpolated. Ultra itself only adds
   the 3072 shadow map, 96-block detail ring and folk 120 (`game.js PRESETS.ultra`; SSR, bloom, SSAO 12 taps and the
   volumetric light are already on at High). Fix: record at Ultra, scale 1, rendered at 1.5 × (1920 × 1080) and
   downscaled with Lanczos (true supersampling), and a camera motion blur so the interpolated frames don't strobe.
   Effort: low (recorder) + medium (blur).
2. **No depth in the forms (AO / contact shadows)** — the contact shadows exist (light2 `l2Ssao`, 12 taps) but reach
   1.2 blocks and darken only the sky's ambient, "never the sun": in a sunlit frame (most of the trailer) they are
   invisible. The vertex AO is linear and mild. Result: everything floats. Effort: low (it is all there; tune and let
   a share of it reach the sun light on High/Ultra).
3. **Value grouping / local contrast** — the haze, bloom and grade lift every dark; nothing has a black point and the
   mid-tones never separate (frame 1, 7, 9). Top stylized games keep a clear value structure: dark anchors near,
   lighter planes behind. Effort: low (a local-contrast term in the composite, from the soft copy High already makes).
4. **Bloom/glow hygiene** — emissive spheres and the portal bloom into white blobs that read as artefacts.
   Effort: low–medium (bloom threshold/knee by emissive), not done here.
5. **Character fidelity & animation** — villagers and animals are small stiff voxel figures at trailer distance.
   Effort: high (rig and animation work); out of scope here.

(Foliage density/motion and the sky are already strong at High; the sky's stars by day are the target stills' style.)

## What x-top does
Gaps 1–3: **Tiefe** (deeper AO, a share on the sun, wider reach), **Klarheit** (local contrast and a black point,
near land only), **Filmkamera** (camera motion blur while a director shot plays) — High and Ultra only, each a
setting with a cost tier — and the re-recording at Ultra, scale 1, 1.5 × supersampled. Plan:
`docs/superpowers/plans/2026-11-06-x-top.md`.
