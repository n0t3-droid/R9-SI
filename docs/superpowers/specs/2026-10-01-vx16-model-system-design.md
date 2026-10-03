# VX16 model system — design (2026-10-01)

Approved in chat by R9 ("Ja, so starten"). Goal: furniture and facade pieces that look like
real objects, not 8-voxel toys, authored fast through a model language instead of hand-placed
voxels, without hurting low-end PCs.

## Problem
Every VX block is an 8×8×8 sculpture painted per block by hand-written box calls. Furniture is
therefore one block per piece, 2-voxel cushions, no proportions across blocks, flat per-voxel
colours. Facades are plain block textures with 1-block glass: no frames, reveals, sills,
cornices, gutters.

## Design
1. **16³ grid (VX16).** `voxarch.js` gets a second grid `G16` (16×16×16) and a resolution-aware
   mesher (`meshGridN`) — quads are already in 1/16-block units, so the vertex stream, far-LOD box
   averaging, lighting and the per-state cache stay unchanged. A spec with `res: 16` paints into
   `G16`; everything else keeps the 8³ path. Icons downsample the whole model into the 8³ icon
   grid so the inventory shows the complete object.
2. **Model language (`voxmodel.js`, shared).** `VM.define(name, {size:[W,H,D] blocks, build(m)})`.
   Builder ops in voxel units (16 per block): `box`, `rbox` (rounded), `cyl`, `sphere`, `lathe`
   (revolve a profile), `extrude` (2-D polygon along an axis), `cut`, `mirrorX/Z`, `repeat`.
   Materials are functions `(x,y,z) → packed voxel`: `fabric`, `leather`, `wood(axis)`, `marble`,
   `matte`, `gloss`, `chrome`, `glass`, `light`. The build compiles once into a voxel volume,
   split into W·H·D parts (16³ each). Registration: one block type per model, props
   `[FACING4, part]`, kind `model`; collision boxes from each part's voxel bounds.
3. **Multi-part placement/removal.** Placing a model block places all parts (rotated by the
   player's facing) when the volume is free; breaking any part removes every part and drops one
   item. Generators place parts with `VM.put(P, u, y, v, name, facing)`.
4. **Furniture set** (first pass, ~25 models): modular sofa (straight 3×1, corner 2×1, chaise),
   armchair, coffee table 2×1, lowboard 3×1 + wall TV 2×1, dining table 3×1 + chair, kitchen base
   modules (drawers/sink/hob/oven), island 2×1, fridge 1×2, tall cabinet 1×2, double bed 2×2,
   nightstand, wardrobes 1×2 / 2×2, desk 2×1 + office chair, freestanding tub 2×1, vanity +
   mirror, glass shower 1×2, toilet, arc lamp, pendant, big plants.
5. **Furnish integration.** `gen_villa_rooms.js` uses the models through a footprint-aware
   `putModel` (checks every cell free, records seats/beds), replacing the 8³ pieces room by room.
6. **Facade kit (next step after furniture).** VX16 window assemblies (frame, mullions, sill,
   reveal, roller-shutter box), entrance door with side lights, cornice bands, eaves with gutter
   and downpipes, lanterns, house numbers, railings; the villa builder places them as units.

## Performance
Models are context-free, so each state meshes once and is cached. Far away the existing
`vxLod` path draws one averaged box per part. Painting a 16³ part is a 4096-entry copy.

## Testing
`test/model_smoke.js` (node): every model compiles, every part paints and meshes, boxes exist,
no part is empty; `test/villa_kit.mjs` renders houses for visual review against the reference
photos.
