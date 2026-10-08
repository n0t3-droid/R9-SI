# The trailers are the target — fidelity brief (8 Oct 2026)

`frames/` holds 34 stills (640 px, one per second) from the owner's three R9-SI trailers. `TRAILER.md` at the repo
root is the frame-by-frame specification written from the first trailer (shots A–F, sizes, palette, lights). The
owner's complaint: "the whole world environment and architecture, infrastructure and graphics, animations, the
shuttles' behaviour and look — everything in the trailers — was started and then left half done." This wave closes
the gap shot by shot. The method for every shot: (1) open the frame with the Read tool and describe what you see in
your plan, (2) put the game's camera at the matching place (a browser test that teleports and frames, see
test/classic_v2.mjs look()/shot()) and take the game's picture, (3) write down the differences — geometry, materials,
colours, lights, life, motion — ordered by how much they change the impression, (4) fix them from the top, (5) take
the picture again and LOOK at both side by side; repeat until a stranger would say "that is the same place".
Pictures are the evidence: every delivery ends with before/after pairs in test/shots/trailer_<shot>_*.png.

What each shot needs to look and feel like:

**A · Canyon flyover** (t1_01, t1_03, t1_05, t3_01, t3_02): ember mesas with green caps and ochre/umber strata, lava
cracks that GLOW (emissive, warm light on the rock, heat shimmer, smoke columns rising from vents), the cyan aether
river glowing with foam, rail viaducts on stone arches with trams, giant magenta/cyan crystal clusters glowing,
shuttles with white-blue engine trails crossing in loose formation, contrails, the cosmic sky (nebula veil, the
ringed gas giant, a blue-green planet, small moons) visible by day, puffy clouds below the peaks. Colours saturated:
the trailer is high-key, clean and bright, not murky.

**B · Spire Citadel** (t1_07, t1_09, t1_10): a tan fluted spire cluster with cyan window slits, orange trim rings,
a red tip beacon blinking, a watchtower, stone-arch viaducts, smoke/steam plumes, shuttles circling; sun low and
warm, long shadows, haze between the spires.

**C · Sky Isles** (t1_11, t1_12, t1_13): chunky floating islands with grass domes, layered earth and rock sides,
inverted-cone undersides, waterfalls falling into mist, lava falls, hanging crystals, a lava river below, roads and
trestle bridges between isles, the shuttle followed from behind with its blue trails, the gas giant on the horizon.

**D · Gate Temple approach** (t1_16, t1_17, t3_03, t3_04): a monumental slate-blue temple on a flagstone plaza, the
octagonal portal glowing orange-white with a swirling energy veil (animated), stepped tiers with amber windows and
orange light strips, cyan slits, a hangar mouth with a glowing landing strip; the shuttle lands with thrusters
flaring and dust; through the portal the palm city is visible (t3_04).

**E · Hangar Hall** (t1_19, t1_21, t1_22, t1_24): a navy octagonal hall lit cyan — concentric octagon floor lines
around a central landing pad, holo screens with radar sweeps and scrolling readouts (animated), button consoles with
blinking lights, light strips in the walls, a hovering drone/pod on the pad with its thrusters, the two heroes
(blue armour, orange armour) with blasters standing at the consoles; the hall opens through a hexagonal corridor to
the city (t1_24).

**F · Palm City Nova Haven** (t1_26, t1_27, t2_14, t2_20, t2_23, t3_05–t3_09): white stepped villas with turquoise
glass bands in amber frames and orange/cyan light strips along the edges, roof gardens, palms (tall, with real
fronds), hedges and lawns, curved paths with cyan light lines, villagers and heroes walking, a starry dusk sky, and
on the hills behind: terraced green fields with villas on the terraces (t3_07–t3_09).

**G · White interior** (t1_29, t1_30, t2_25, t2_28, t3_10): white gloss floors, glass walls to the garden, floating
glass stairs, cove light strips in the ceiling, round pads with cyan rings, plants — bright, clean, reflective.

**Shuttles** (t1_01, t1_03, t1_12, t1_16, t1_17, t3_03): white hull with orange stripes, blue canopy, twin engines
with cyan-white glow and long luminous trails that fade to a thin white contrail, a sparkle stream; they bank into
turns, climb and dive smoothly, fly in loose formations of 2–4, dock in the hangar mouth, and the player's own
shuttle flies the same way from the cockpit (the cabin of docs/superpowers/specs: shuttle Step 3).
