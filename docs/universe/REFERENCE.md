# R9-SI — The Real-Space Reference

*Research front, 22 Oct 2026. The factual base the space layer is built from: what telescopes, satellites and missions actually show, in numbers and in words a shader programmer can use.*

**Rules of this file.** We take *facts* (numbers, measured colours, structures, processes) and generate everything ourselves. No images, no copied texts: every sentence here is our own wording, every measured number carries a source key like `[NSSDC-planets]` that resolves in the **Sources** list at the end. Values marked **(d)** are *derived* for this file from sourced inputs with the formulas in Appendix A; textbook constants (emission-line wavelengths, Fresnel, gas laws) stand without a key. "→ Game:" lines say what a fact means for R9-SI (peaceful by default, low-end PCs first, everything procedural, the home world always one step away).

---

## 0. The fifteen facts that matter most

1. **Space is almost empty.** The asteroid belt's km-sized bodies are ~3 million km apart; from inside the belt you see *no* asteroid with the naked eye [NASA-dawn-faq] (d). Dense "fields" of chunks exist for real only inside planetary rings (Saturn: ice from dust to house-size, ~10 m thick) [NASA-saturn].
2. **The Sun is white** in space (5772 K → sRGB ≈ `#fff1ea` (d), stellar-model `#ffede6` [Harre-Heller2021]). Yellow, orange and red suns are made by air, not by the star.
3. **Earth's sky = Rayleigh (λ⁻⁴) + a little Mie + ozone.** Production constants: β_R = (5.802, 13.558, 33.1)·10⁻⁶ m⁻¹ at 680/550/440 nm, H_R = 8 km; β_M,sca = 3.996·10⁻⁶ m⁻¹, H_M = 1.2 km, g = 0.8; ozone σ_a = (0.650, 1.881, 0.085)·10⁻⁶ m⁻¹ in a 25 ± 15 km tent [Hillaire2020][SL-llatmosphere].
4. **Mars:** butterscotch day sky, **blue sunset** around the Sun (fine dust, r ≈ 1.5 µm, forward-scattering) [NASA-mars-sunset][Lemmon2004]; Sun ⅔ the size, 43 % of the light (d).
5. **Titan:** orange smog lets ~10 % of the light through; with sunlight already ~1 % of Earth's, noon is ~1/1000 of Earth daylight (≈ 140 lx (d)); air 4.4× denser than Earth's → you could fly with wings [PIA-titan][NASA-titan] (d).
6. **Venus surface:** 92 bar, 464 °C, dim **orange** light of 6,900–10,500 lx measured by Venera 9/10 [NSSDC-venus][Venera-NTRS].
7. **Airless worlds have black skies at noon** (Moon, Mercury, asteroids); shadows are pitch black, lit only by bounce light.
8. **Parents fill the sky of their moons:** Jupiter spans 19.6° from Io, Saturn 29° from Enceladus, Earth 1.9° from the Moon (d). Moons in the ring plane see Saturn's rings **edge-on** as a thin line.
9. **From the ISS** (≈400 km, 92 min, 7.66 km/s) the atmosphere is a thin shell (100 km = 1.6 % of Earth's radius); green airglow sits as a constant shell at ~100 km; aurora: green O 557.7 nm ~100–200 km, red O 630 nm above ~200–300 km, blue/pink N₂ at the bottom [NASA-ISS-aurora][NASA-auroras][AO-airglow].
10. **Jupiter**: cream zones, orange-brown belts, a shrinking Great Red Spot (41,000 km in the 1800s → 16,500 km in 2014); 8 polar cyclones around one in the north, 5→6 around one in the south [NASA-jupiter][NASA-GRS-2014][SwRI-juno-south].
11. **Saturn's rings**: 282,000 km span, ~10 m thick — like a 0.1 mm sheet of paper 2.7 km wide (d); particles cm to m, almost pure water ice [NASA-saturn][JPL-ring-faq].
12. **Uranus and Neptune are nearly the same pale greenish blue**; old deep-blue Neptune pictures were contrast-stretched [SciAm-irwin2024].
13. **Rubble piles** (Bennu, Ryugu): spinning tops, ~50 % empty, albedo ~0.04 (charcoal), boulder-covered; nothing larger than ~200 m spins faster than ~2.2 h [Lauretta2019][TPS-ryugu][Walsh2018].
14. **Stars are white-ish**: O/B stars pale blue (`#5b7bff`…`#7996ff`), M dwarfs orange (`#ffa349`), not saturated red or blue [Harre-Heller2021].
15. **Distances force a jump.** Voyager 1 reaches one light-day on 18 Nov 2026 after 49 years; the nearest star is 4.24 ly — 75,000 years at Voyager speed [NASA-voyager-lightday] (d).

---

## 1. Scale and motion

### 1.0 The ladder of scales (orders of magnitude)

| Thing | Size or distance | Light time |
|---|---|---|
| Player | 1.8 m | — |
| Bennu (rubble pile) | 490 m diameter [Lauretta2019] | — |
| Ceres | ≈ 950 km diameter [NASA-ceres] | — |
| Earth | 12,756 km diameter [NSSDC-planets] | 0.04 s |
| Earth → Moon | 384,400 km = 30 Earth diameters [NSSDC-moon] (d) | 1.3 s |
| Earth's sphere of influence | 0.92 million km (d) | 3 s |
| Earth → Sun (1 AU) | 149.6 million km | 8.3 min |
| Sun → Jupiter / → Neptune | 5.2 AU / 30 AU | 43 min / 4.2 h |
| Voyager 1, 18 Nov 2026 | 25.9 billion km ≈ 173 AU | 1 light-day [NASA-voyager-lightday] |
| Proxima Centauri | 4.24 ly ≈ 268,000 AU | 4.24 yr |
| Pillars of Creation | 4–5 ly tall, 6,500–7,000 ly away [NASA-M16][NASA-webb-pillars] | — |
| Milky Way | ~100,000 ly across, Sun ~26,000 ly from centre [NASA-milkyway] | — |
| M87 (black hole galaxy) | 16.8 Mpc ≈ 55 million ly [EHT2019] | — |

→ Game: every step of the ladder is a factor 10–1000; no single camera or float range covers it. Use nested frames (surface / orbit / system / interstellar) with a jump between frames.

### 1.1 The Sun [NSSDC-sun][NSSDC-earth]

| Quantity | Value |
|---|---|
| Radius | 695,700 km (109 Earth radii) |
| Mass | 1.9884·10³⁰ kg |
| Surface gravity / escape velocity | 274 m/s² / 617.6 km/s |
| Luminosity | 3.828·10²⁶ W |
| Effective temperature | 5772 K (photosphere 4400 K top → 6600 K bottom; chromosphere top ~30,000 K) |
| Rotation | 609 h (25.4 d) at 16° latitude — differential, faster at the equator |
| Spectral type | G2 V, absolute magnitude +4.83 |
| Apparent diameter from Earth | 1919″ mean (31.98′), 1887″–1952″ over the year |
| Solar constant at 1 AU | 1361 W/m² |

→ Game: space Sun = white disc, slight limb darkening; tint only through atmospheres. Angular radius ≈ 0.00465 rad from Earth, scale with 1/d elsewhere (table 1.3).

### 1.2 The planets [NSSDC-planets]

| Body | Diam. km | Mass 10²⁴ kg | g m/s² | v_esc km/s | Solar day h | Tilt ° | a 10⁶ km | Year d | e | Mean T °C | p bar | Moons |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Mercury | 4,879 | 0.330 | 3.7 | 4.3 | 4222.6 | 0.03 | 57.9 | 88.0 | 0.206 | 167 | 0 | 0 |
| Venus | 12,104 | 4.87 | 8.9 | 10.4 | 2802.0 (retro.) | 177.4 | 108.2 | 224.7 | 0.007 | 464 | 92 | 0 |
| Earth | 12,756 | 5.97 | 9.8 | 11.2 | 24.0 | 23.4 | 149.6 | 365.2 | 0.017 | 15 | 1 | 1 |
| Moon | 3,475 | 0.073 | 1.6 | 2.4 | 708.7 | 6.7 | 0.384 (Earth) | 27.3 | 0.055 | −20 | 0 | — |
| Mars | 6,792 | 0.642 | 3.7 | 5.0 | 24.7 | 25.2 | 228.0 | 687.0 | 0.094 | −65 | 0.01 | 2 |
| Jupiter | 142,984 | 1898 | 23.1 | 59.5 | 9.9 | 3.1 | 778.5 | 4331 | 0.049 | −110 | — | 95* |
| Saturn | 120,536 | 568 | 9.0 | 35.5 | 10.7 | 26.7 | 1432.0 | 10,747 | 0.052 | −140 | — | 274 |
| Uranus | 51,118 | 86.8 | 8.7 | 21.3 | 17.2 (retro.) | 97.8 | 2867.0 | 30,589 | 0.047 | −195 | — | 28 |
| Neptune | 49,528 | 102 | 11.0 | 23.5 | 16.1 | 28.3 | 4515.0 | 59,800 | 0.010 | −200 | — | 16 |
| Pluto | 2,376 | 0.0130 | 0.7 | 1.3 | 153.3 (retro.) | 119.5 | 5906.4 | 90,560 | 0.244 | −225 | 0.00001 | 5 |

\*Moon counts grow every year; NASA's Jupiter page lists 115 recognised moons [NASA-jupiter]. Giant planets are visibly flattened by fast spin: Jupiter polar radius 66,854 vs equatorial 71,492 km (flattening 0.065), Saturn 54,364 vs 60,268 km (0.098) [NSSDC-jupiter][NSSDC-saturn].

→ Game: render Jupiter and Saturn as oblate spheroids (6.5 % and 9.8 %), not spheres; tilts set the seasons and the ring opening angle; Venus/Uranus/Pluto spin backwards (Sun rises in the west).

### 1.3 The Sun seen from each world (d)

| From | Distance AU | Sun diameter | Irradiance W/m² | ≈ Illuminance | Feel |
|---|---|---|---|---|---|
| Mercury | 0.39 | 82.6′ (2.6× Earth view) | 9,086 | 845 klx | blinding; 6.7× (mean) to 10.6× (perihelion) Earth's light |
| Venus (cloud top) | 0.72 | 44.2′ | 2,602 | 242 klx | white glare over a white deck |
| Earth | 1.00 | 32.0′ | 1,361 | 127 klx (above air) | — |
| Mars | 1.52 | 21.0′ (⅔) | 586 | 54 klx | bright, hazy |
| Ceres | 2.76 | 11.6′ | 179 | 17 klx | bright overcast day |
| Jupiter | 5.20 | 6.1′ | 50 | 4.7 klx | dark overcast day |
| Saturn | 9.57 | 3.3′ | 15 | 1.4 klx | very dull day |
| Uranus | 19.2 | 1.7′ | 3.7 | 350 lx | office lighting |
| Neptune | 30.2 | 1.1′ | 1.5 | 140 lx | dim room; Sun a dazzling star |
| Pluto | 39.5 | 0.8′ | 0.87 | 80 lx | like Earth just after sunset — "Pluto Time" [NASA-pluto-time] |

Inputs: [NSSDC-planets][NSSDC-sun][NSSDC-earth]; illuminance uses ~93 lm/W for sunlight (d). Pluto's noon is still ~300× brighter than full moonlight (d).

→ Game: drive exposure/auto-adaptation from these ratios; past ~Uranus the Sun is a point with a bloom, not a disc, yet the ground stays readable. Never make outer worlds pitch black.

### 1.4 Dwarf planets

| Body | Size | Day | Orbit | Notes |
|---|---|---|---|---|
| Ceres | radius ≈ 470–476 km [NASA-ceres] | ≈ 9 h | 2.8 AU, 4.6 yr | holds ~¼ (NASA) to ~⅖ (d, with [Pitjeva2018]) of the belt's mass; up to ~25 % water; largest crater 280 km |
| Pluto | radius 1,188 km [NSSDC-pluto] | 6.39 d (retro.) | 39.5 AU, 248 yr, e 0.24 | N₂ atmosphere 10–13 µbar, 24–38 K, Bond albedo 0.72 |
| Charon | radius 606 km [NSSDC-pluto] | 6.39 d | 19,596 km from Pluto | both tidally locked to each other |
| Haumea | equatorial ≈ 1,740 km, elongated [NASA-haumea] | ≈ 4 h | 43 AU, 285 yr | stretched by fast spin; has a ring and two moons |

→ Game: Haumea is the model for "fast-spin egg worlds"; Pluto–Charon for a double world whose partner hangs motionless in the sky.

### 1.5 Major moons [JPL-sats][NSSDC-galilean][NSSDC-saturn-sats][NSSDC-neptune-sats][NSSDC-mars]

| Moon | Mean radius km | Density g/cm³ | a 10³ km | Period d | g m/s² (d) | Parent in its sky (d) |
|---|---|---|---|---|---|---|
| Moon | 1737.4 | 3.34 | 384.4 | 27.32 | 1.62 | Earth 1.9° |
| Phobos | 11.1 | 1.87 | 9.38 | 0.319 | 0.006 | Mars 42.5° |
| Deimos | 6.2 | 1.47 | 23.46 | 1.262 | 0.003 | Mars 16.7° |
| Io | 1821.5 | 3.53 | 421.7 | 1.769 | 1.80 | Jupiter 19.6° |
| Europa | 1560.8 | 3.01 | 671.0 | 3.551 | 1.31 | Jupiter 12.3° |
| Ganymede | 2631.2 | 1.94 | 1070.4 | 7.155 | 1.43 | Jupiter 7.7° |
| Callisto | 2410.3 | 1.83 | 1882.7 | 16.69 | 1.24 | Jupiter 4.4° |
| Mimas | 198.2 | 1.15 | 185.5 | 0.942 | 0.064 | Saturn 38.0° |
| Enceladus | 252.1 | 1.61 | 238.0 | 1.370 | 0.113 | Saturn 29.4° |
| Tethys | 531.1 | 0.98 | 294.7 | 1.888 | 0.146 | Saturn 23.7° |
| Dione | 561.4 | 1.48 | 377.4 | 2.737 | 0.232 | Saturn 18.4° |
| Rhea | 763.5 | 1.24 | 527.0 | 4.518 | 0.264 | Saturn 13.2° |
| Titan | 2574.8 | 1.88 | 1221.9 | 15.95 | 1.35 | Saturn 5.7° (behind haze) |
| Iapetus | 734.3 | 1.09 | 3560.9 | 79.33 | 0.224 | Saturn 1.9° |
| Miranda | 235.8 | 1.18 | 129.4 | 1.41 | 0.077 | Uranus 22.8° |
| Ariel | 578.9 | 1.54 | 191.0 | 2.52 | 0.249 | Uranus 15.4° |
| Titania | 788.9 | 1.65 | 435.9 | 8.71 | 0.365 | Uranus 6.7° |
| Triton | 1352.6 | 2.06 | 354.8 | 5.877 (retrograde) | 0.78 | Neptune 8.0° |
| Charon | 606.0 | 1.85 | 19.6 | 6.387 | 0.29 | Pluto 7.2° |

For scale: the full Moon from Earth is 0.53°. Densities tell the recipe: ~3.0–3.5 = rock (Io, Europa, Moon), ~1.8–1.9 = half ice (Ganymede, Callisto, Titan), ~1.0–1.2 = nearly pure ice (Tethys, Iapetus). Iapetus is two-toned: geometric albedo 0.05 on one hemisphere, 0.5 on the other [NSSDC-saturn-sats]. Enceladus' albedo ≈ 1.0 — the brightest surface known [NSSDC-saturn-sats][NASA-enceladus].

→ Game: almost all big moons are tidally locked — the parent planet hangs fixed in the sky and only goes through phases. Pick the moon for the "wow": Io/Mimas/Enceladus = planet-filled skies.

### 1.6 The asteroid belt — reality versus the game

- About 2 million objects of ≳1.6 km (1 mile) share the belt; their average spacing is ~3 million km (1.9 million miles, ~8 Earth–Moon distances); asteroids orbit "largely in isolation" [NASA-dawn-faq].
- Total mass ≈ 2.39·10²¹ kg = 4.0·10⁻⁴ Earth masses = **3.3 % of our Moon** [Pitjeva2018] (d); Ceres alone (9.4·10²⁰ kg) is ~39 % of it (d).
- Visibility (d): a 1 km rock of albedo 0.10 at the typical 3 million km neighbour distance shines at magnitude ~12 (naked-eye limit ~6.6–7); it becomes naked-eye bright inside ~100,000 km and shows a disc (1′) only inside ~3,400 km.

→ Game: a real belt looks like empty black sky. For play, use *local* debris clouds compressed 10⁵–10⁷× around the ship (a "fresh collision family" or a ring), keep them rare and special. If we want the dense field look and stay honest, set it in a ring: Saturn's rings are the real "asteroid field" (section 4.2).

### 1.7 Small bodies up close

| Body | Size | Spin | Density / porosity | Surface | Source |
|---|---|---|---|---|---|
| Bennu (B-type) | 490 m mean, spinning top, muted equatorial ridge | 4.296 h | 1.19 g/cm³, ~50 % voids | geometric albedo 0.044; 208 boulders >10 m, largest 58 m long × 30 m tall; mean slope 17°; >300 particle-ejection events; −100 to +116 °C | [Lauretta2019][NASA-bennu] |
| Ryugu (Cb-type) | 1004 × 875 m, top/diamond shape | 7.633 h, retrograde (171.6°) | 1.19 g/cm³, >50 % voids | brownish black, reflectance mostly 1.4–1.8 %; boulder Otohime ~160 m; boulders 2× denser than on Itokawa; equator slightly bluer | [TPS-ryugu] |
| Didymos | ~805 m, top with ridge | 2.26 h | — | surface ~12.5 Myr old | [NASA-didymos] |
| Dimorphos | ~170 m (moonlet) | orbit ~12 h → 33 min shorter after DART | — | boulders; DART (6.1 km/s) turned a squashed ball into an "oblong watermelon"; surface <0.3 Myr | [NASA-didymos] |
| Psyche (metal-rich) | 280 × 232 km, potato | just over 4 h | 30–60 % metal by volume | radar/optical: two crater-like hollows, patchy metal and colour | [NASA-psyche][JPL-psyche] |
| Comet 67P | two lobes 4.1×3.3×1.8 and 2.6×2.3×1.8 km, 21.4 km³ | 12.4 h | 470 kg/m³, 70–80 % voids | 10 billion t; dust up to metres thick; "goosebumps" at ~3 m; 500 m crack at the neck; jets from the neck and pits | [ESA-67P] |

**Rules from the population** [Walsh2018]:
- **Spin barrier:** no body larger than ~200 m spins faster than ~2.2 h — loose rubble would fly off. Smaller bodies can be monoliths spinning in minutes.
- **Rubble piles** (~200 m to ~10 km): self-gravity aggregates, typical porosity ~35 %, some >50 %.
- **Shapes:** spinning tops with an equatorial ridge (YORP spin-up); ~10–14 % of near-Earth asteroids >200 m are **contact binaries** (two lobes, like 67P's comet nucleus).
- **YORP:** sunlight re-emission doubles or halves a 1 km body's spin in ~1 million years.
- **Surfaces:** every grain size from metre boulders to powder; boulders line up with local slopes.

→ Game generator rules (d from the table): largest boulder ≈ 10–20 % of the body's diameter; mean slope ~15–20°; colour near-black brownish grey (albedo 0.02–0.05) for primitive bodies; spin never faster than ~2.2 h for bodies >200 m (Bennu 4.3 h, Ryugu 7.6 h, 67P 12.4 h); low gravity means a 3 m/s jump *escapes* Bennu (v_esc 0.2 m/s, section 8).

### 1.8 Comets and their tails

- **Ion tail:** straight, pointing **directly away from the Sun**, driven by the solar wind; **blue** from CO⁺ ions recombining [APOD-comet-tails].
- **Dust tail:** grit pushed by sunlight pressure, pale white-yellow (reflected sunlight), pointing *nearly* away from the Sun and curving back along the orbit [APOD-comet-tails].
- 67P near the Sun: water output rose from 0.3 to 1.2 L/s as it approached (2014); dust mass ~4× gas mass [ESA-67P].

→ Game: tails always anti-sunward (not "behind" the motion); ion tail thin and blue, dust tail broad, curved and warm white; nucleus near-black.

### 1.9 Orbital mechanics a game needs

Formulas (μ = GM): Kepler III `T = 2π·√(a³/μ)`; vis-viva `v² = μ·(2/r − 1/a)`; circular `v_c = √(μ/r)`; escape `v_e = √2·v_c`; Hohmann burns `Δv₁ = √(μ/r₁)·(√(2r₂/(r₁+r₂)) − 1)`, `Δv₂ = √(μ/r₂)·(1 − √(2r₁/(r₁+r₂)))`, transfer time `π·√(a_t³/μ)`, `a_t = (r₁+r₂)/2`; sphere of influence `r_SOI = a·(m/M)^(2/5)` (patched conics: inside it only the planet pulls) [BSF-ch4].

**Low orbit around each body (5 % above the surface) (d):**

| Body | Orbit speed | Escape speed | Period |
|---|---|---|---|
| Earth | 7.72 km/s | 11.19 km/s | 1.51 h |
| Moon | 1.64 km/s | 2.38 km/s | 1.94 h |
| Mars | 3.47 km/s | 5.03 km/s | 1.79 h |
| Titan | 1.82 km/s | 2.64 km/s | 2.59 h |
| Ceres | 356 m/s | 516 m/s | 2.42 h |
| Enceladus | 165 m/s | 239 m/s | 2.80 h |
| Phobos | 7.8 m/s | 11.3 m/s | 2.60 h |
| Bennu | 0.14 m/s | 0.20 m/s | 3.26 h |

**Transfers (d):** LEO (400 km: 7.67 km/s, 92.4 min) → GEO: 2.40 + 1.46 = 3.86 km/s, 5.3 h. LEO → Moon distance: 3.08 km/s, ~5 days on a Hohmann path (Apollo flew faster, ~3 days).

| Earth → | v∞ departure | v∞ arrival | Δv from LEO | Hohmann time |
|---|---|---|---|---|
| Venus | 2.50 km/s | 2.71 km/s | 3.46 km/s | 146 d |
| Mars | 2.95 km/s | 2.65 km/s | 3.57 km/s | 259 d |
| Jupiter | 8.79 km/s | 5.64 km/s | 6.29 km/s | 2.7 yr |
| Saturn | 10.30 km/s | 5.44 km/s | 7.29 km/s | 6.1 yr |
| Neptune | 11.66 km/s | 4.05 km/s | 8.25 km/s | 30.8 yr |

Launch windows repeat with the synodic period: Mars every ~780 d (~25–26 months), Venus ~584 d (~19 months) (d)[BSF-ch4]. Gravity assists trade momentum with a planet (Voyager 2 at Jupiter, Saturn, Uranus) [BSF-ch4].

**Spheres of influence (d):** Earth 925,000 km; Moon (vs Earth) 66,000 km; Mars 577,000 km; Ceres 77,000 km; Jupiter 48 million km; Saturn 55 million km.

**Aerobraking (real example):** Mars Reconnaissance Orbiter dipped **426 times** through the upper atmosphere at 98–105 km over ~5 months, lowering its apoapsis from 45,000 km to 486 km and its period from >35 h to ~2 h, saving ~600 kg of propellant [JPL-MRO-aerobraking].

**Re-entry heating and plasma colours:**
- Orion returns at ~11 km/s (25,000 mph); its Avcoat shield faces ~2,760 °C (5,000 °F) while the back stays ~93 °C (200 °F); speed drops to ~480 km/h within minutes [NASA-orion-shield].
- Spectra of Hayabusa's 12 km/s re-entry [Abe2011-hayabusa]: the **shock layer** glows in N₂⁺ bands (violet-blue, ~13,000 K vibrational temperature); the **ablating heat shield** adds CN violet bands; ~100 atomic lines (Fe, Mg, Na, Al…) from melting metal; **orange FeO** bands in the wake; the capsule itself glowed as a ~2,440 K grey body (incandescent orange-yellow); peak brightness magnitude −12.6 at 66.9 km.

→ Game: re-entry = white-yellow core at the nose, violet-blue sheath edge, orange-yellow trailing wake with sparks; the effect peaks around 60–70 km and fades below ~40 km. Orbits: show the ghost path (vis-viva) and let players *see* that "speeding up" raises the far side of the orbit.

---

## 2. Atmospheres and skies from the surface

### 2.1 Earth — the physically based sky

Constants used by Bruneton's precomputed scattering and Hillaire's production technique [Hillaire2020][Bruneton-repo][SL-llatmosphere]:

| Parameter | Value |
|---|---|
| Ground / top radius | 6360 km / 6460 km — a 100 km participating layer (Hillaire) |
| Rayleigh scattering β_R | 1.24062·10⁻⁶·λ⁻⁴ (λ in µm) = **(5.802, 13.558, 33.1)·10⁻⁶ m⁻¹** at 680 / 550 / 440 nm; no absorption |
| Rayleigh density | exp(−h / 8 km); phase 3(1+cos²θ)/(16π) |
| Mie (aerosol) | extinction 5.328·10⁻³/1200 m = 4.44·10⁻⁶ m⁻¹, single-scattering albedo 0.9 → scattering **3.996·10⁻⁶**, absorption 0.444·10⁻⁶ m⁻¹ |
| Mie density / phase | exp(−h / 1.2 km); Cornette–Shanks (or Henyey–Greenstein), **g = 0.8** |
| Ozone absorption | **(0.650, 1.881, 0.085)·10⁻⁶ m⁻¹** at the peak; tent profile max(0, 1 − abs(h − 25 km)/15 km) (300 Dobson units) |
| Ground albedo | 0.1 (Bruneton) / 0.3 (Hillaire) |
| Sun angular radius | 0.00465 rad (959.5″ mean) [NSSDC-sun] |

Caution: the text of the EGSR 2020 paper (as extracted) shows the two scale heights in swapped order and lists 4.40 under Mie absorption; Bruneton's constants (and physics: air H ≈ 8.5 km [NSSDC-earth]) give H_R = 8 km, H_M = 1.2 km and ~4.4·10⁻⁶ m⁻¹ as Mie *extinction*. Use those.

**Cost on weak GPUs** (Hillaire's LUTs; PC = GTX 1080, mobile = iPhone 6s) [Hillaire2020]: transmittance 256×64 (0.01 / 0.53 ms), multi-scattering 32×32 with 64 directions (0.07 / 0.12 ms), sky-view 200×100 (mobile 96×50, 8 steps; 0.05 / 0.27 ms), aerial perspective 32×32×32 over 32 km (mobile 32×32×16; 0.04 / 0.11 ms); whole sky ≈ 0.14 ms on PC.

**Derived optical depths (zenith):** Rayleigh τ = 0.046 / 0.108 / 0.265 (R/G/B), Bruneton's clean-air Mie τ = 0.005, ozone τ = 0.010 / 0.028 / 0.001 (d). Blue scatters 5.7× more than red (d). Ozone absorbs mostly green-orange (Chappuis band) — it is what keeps the twilight zenith blue instead of grey.

**Sun disc colour vs elevation** (white sunlight × transmittance with the constants above, normalised) (d):

| Elevation | 90° | 45° | 20° | 10° | 5° | 2° | 0° |
|---|---|---|---|---|---|---|---|
| Air mass | 1.0 | 1.41 | 2.9 | 5.6 | 10.3 | 19.4 | 37.9 |
| Colour | `#fff6e8` | `#fff3e0` | `#ffe6c3` | `#ffd197` | `#ffb05f` | `#ff7e23` | `#ff3d01` |

→ Game: keep the 3-wavelength model (cheap, proven); swap the constants per planet; the mobile timings (an iPhone 6s does all LUTs in ~1 ms) suggest an integrated GPU like the owner's Vega can afford them, and the potato tier can freeze the LUTs per hour of day.

### 2.2 Twilight phenomena (Earth)

- **Earth's shadow + Belt of Venus:** after sunset a dark blue-grey band (unlit air) rises in the east; above it a pink band — air still lit by reddened sunlight (its blue removed by the long path), mixed with blue skylight [AO-earthshadow]. The edge rises and blurs as the Sun sinks.
- **Crepuscular rays:** shadow and light beams through cloud gaps are physically parallel; perspective fans them out from the Sun and makes them **converge again at the antisolar point** (anticrepuscular rays), like rails meeting at the horizon; visible even with the Sun fairly high [AO-anticrep].
- **Green flash:** at the Sun's upper limb, usually ≤ 2 s (up to ~15 s under a strong inversion); refraction separates colours and Rayleigh scattering removes the blue, leaving green; a green rim is always there but too thin to see; mirages amplify it; a blue flash is rare [WP-greenflash].
- **Noctilucent clouds:** ice at ~80 km (ice layer 82–89 km), high latitudes in summer (northern late May–August); they shine after sunset when the air below is already in shadow; brightness varies on ~3 km scales (ripples) [NASA-AIM-NLC]. Typically silvery electric blue.
- **Twilight on Mars** lasts up to ~2 h because high dust scatters light onto the night side [NASA-mars-sunset].

→ Game: these five are cheap "always something happening" moments: shadow band + pink belt (sky shader term), ray fans (shadow-map shafts), green rim (one-frame tint at the solar limb), NLC at high latitudes after sunset.

### 2.3 Mars

- Air: 6.36 mbar mean (4.0–8.7 by season), CO₂ 95.1 %, N₂ 2.6 %, Ar 1.9 %; scale height 11.0 km; Viking 1 site −89 to −31 °C [NSSDC-mars]; equator at noon ~24 °C at the feet but ~0 °C at head height; overall 20 °C to −153 °C [NASA-mars].
- **Dust is the sky:** cross-section-weighted radius 1.47 ± 0.21 µm (Gusev) / 1.52 µm (Meridiani), dust scale height 11.6 km, visible optical depth ~0.9 at landing [Lemmon2004]; typical τ 0.3–1, local storms 1–1.5, the 2007 global storm reached τ 4.3–4.6 (~5) [Lemmon2015]; effective radius ~1 µm in quiet seasons, >2 µm at storm onset; water-ice cirrus in northern summer [Lemmon2015].
- **Day sky: butterscotch / tan**, pink-red around sunrise and sunset away from the Sun; dust particles absorb blue (iron oxides incl. ~1 % magnetite) [WebExhibits-mars].
- **Sunset: blue around the Sun** — the fine dust passes and forward-scatters blue light in a narrow cone near the Sun, while red and yellow spread over the whole sky; dustier air = stronger blue [NASA-mars-sunset][JPL-curiosity-sunset]. Sun ⅔ of Earth's size [NASA-mars-sunset].
- Phobos from the ground: 0.21° (0.4× our full Moon), orbiting faster than Mars spins, so it rises in the **west** twice a day; Deimos only 2.1′ — a bright star (d) [NSSDC-mars].

→ Game: Mars sky = Mie-dominated (a strong forward lobe — tune g around 0.6–0.8 — tinted *blue* near the Sun, yellow-brown elsewhere), Rayleigh nearly off; dust τ is the weather slider (0.3 clear → 4–5 global storm, day turns to dusk).

### 2.4 Titan

- 1.5 bar, 94 K (−179 °C), ~95 % N₂ + ~5 % CH₄; atmosphere reaches ~600 km (10× Earth's) [ESA-titan][NASA-titan].
- Sunlight at Saturn ~100× fainter than at Earth; the orange organic haze lets only ~10 % reach the ground [NASA-titan][PIA-titan] → noon ≈ 1.5 W/m² ≈ 140 lx (d) — a dim, shadowless orange day.
- The haze scatters blue/UV high up (blue layers seen from space) but is a poor greenhouse ("anti-greenhouse") [PIA-titan].
- Huygens on the surface: darker ground than expected, water ice + hydrocarbon ice, **rounded pebbles 4–15 cm** with erosion at their base (river action) [ESA-huygens-colour].
- Methane clouds and storms, lakes and seas of liquid methane/ethane, equatorial dunes of dark hydrocarbon grains [NASA-titan].
- Air density ≈ 5.4 kg/m³ = 4.4× Earth's (d, ideal gas).

→ Game: Titan = low-contrast orange world, distant terrain fading into orange haze, no visible Saturn through the haze (at most a faint glow), methane drizzle, pebble river beds, flying with wings (8 m/s terminal velocity, section 8).

### 2.5 Venus

- Surface: 92 bar, ~65 kg/m³, 737 K (464 °C), CO₂ 96.5 % / N₂ 3.5 %, scale height 15.9 km, winds only 0.3–1 m/s; Bond albedo 0.77 [NSSDC-venus].
- Clouds of sulfuric acid from 45 to 70 km in three tracked layers (~45–47, ~61, ~66 km); cloud-top winds ~370 km/h circling the planet in ~5 days (super-rotation), polar vortices above 65° [ESA-venus-winds].
- Light at the ground (Venera 9/10): 33–61 W/m², **6,900–10,500 lx, orange** spectral composition; ground albedo ~0.1–0.15 [Venera-NTRS].

→ Game: no Sun disc, uniform dull yellow-orange overcast, very dense air (swimming-like movement, 5.6 m/s terminal velocity), heat shimmer; from above the clouds: blinding white-yellow deck.

### 2.6 Airless worlds

- **Moon:** black sky at noon; surface 120 °C (400 K) by day, −130 °C at night, 25 K in Hermite crater — the coldest place measured [LRO-diviner]; Bond albedo 0.11, geometric 0.12 [NSSDC-moon]. Earth hangs nearly fixed (tidal lock) at 1.9° — 3.7× our full Moon — and shows phases opposite to the Moon's (d). Full Earth casts ~0.15 W/m² (≈ 0.01 % of sunlight, about half of it thermal infrared) [NTRS-earthshine], ~40–50× the brightness of our full Moon (d).
- **Mercury:** 430 °C by day, −180 °C at night; a solar day lasts 176 Earth days; the Sun looks >3× as large and up to ~7× as bright (NASA; 10.6× at perihelion (d)) [NASA-mercury].

→ Game: zero sky radiance, hard shadows, all fill light from the ground and from the parent planet (earthshine as a soft blue-white fill on the night side). Stars appear only when the eye is not adapted to sunlit ground (exposure), which a game camera can honour.

### 2.7 Pluto

- Blue sky: more than a dozen haze layers of small soot-like tholin particles scatter blue, although the particles themselves are grey or red [NASA-pluto-blue][NASA-pluto-haze-mtns].
- Atmosphere ~1/100,000 of Earth's density [NASA-pluto-10]; noon light ≈ Earth twilight [NASA-pluto-time].
- Charon hangs fixed at 3.8° above one hemisphere and is never seen from the other (d).

### 2.8 Big things in other skies (angular diameter, observer at the sub-planet point) (d)

| From → seeing | Size | × our full Moon |
|---|---|---|
| Earth → Moon | 0.53° | 1 |
| Moon → Earth | 1.91° | 3.7 |
| Phobos → Mars | 42.5° | 82 |
| Io → Jupiter | 19.6° | 38 |
| Europa → Jupiter | 12.3° | 24 |
| Ganymede → Jupiter | 7.7° | 15 |
| Callisto → Jupiter | 4.4° | 8 |
| Mimas → Saturn | 38.0° | 73 |
| Enceladus → Saturn | 29.4° | 56 (main rings span 60° — but seen edge-on) |
| Titan → Saturn | 5.7° | 11 (rings 12.8°, edge-on) |
| Iapetus → Saturn | 1.9° | 3.7 (orbit tilted ~15°: rings seen opened, 4.4° wide) |
| Miranda → Uranus | 22.8° | 44 |
| Triton → Neptune | 8.0° | 15 |
| Charon → Pluto | 7.2° | 14 |
| Pluto → Charon | 3.8° | 7 |

→ Game: a "Planetenhimmel" (planet-filled sky) moon is the strongest postcard: phases of the parent, its night side lit by its own moons, eclipses when the parent blocks the Sun.

---

## 3. Earth from orbit

- **ISS:** ~400 km, one orbit per ~90 min, ~28,000 km/h, 16 sunrises and sunsets a day [NASA-ISS-faq]. At 420 km (d): 7.66 km/s, 92.8 min; the horizon is 2,350 km away and 20.3° below horizontal; Earth's disc spans 139° of the view; from GEO it is a 17.4° ball.
- **The limb:** 100 km of atmosphere is 1.6 % of Earth's radius, the 12 km troposphere 0.2 % (d). At an ISS sunset the limb shows deep orange and yellow in the troposphere (≈ 6–20 km, with dark cloud layers), pink-to-white in the lower stratosphere (to ~50 km), then blue layers fading into black [NASA-ISS-sunset].
- **Airglow** (night, ~1/10 the brightness of all starlight [NASA-ICON]; ~1/1000 of the day-side glow [AO-airglow]):

| Emission | Wavelength | Altitude | Look |
|---|---|---|---|
| Atomic O, green line | 557.7 nm ("558") | 90–100 km | the brightest; a thin greenish shell above the limb, seen clearly from orbit |
| Atomic O, red line | 630 nm | 150–300 km | faint red, slow (forbidden transition, ~110 s) |
| Sodium | 589 nm (yellow) | ~92 km | thin layer |
| OH Meinel bands | red + near-IR | 86–87 km, 6–10 km thick | invisible to the eye mostly; red in cameras |
| O₂ | weak blue | ~95 km | — |

  Gravity waves make bands and ripples drifting over minutes [AO-airglow].
- **Aurora:**

| Colour | Emitter | Altitude |
|---|---|---|
| Green (most common) | atomic O, 557.7 nm | ~100–200 km [NASA-auroras] (NOAA: 120–400 km [NOAA-aurora]) |
| Red (tops, rarer) | atomic O, 630 nm | above ~200 km; 300–500 km in the ISS crews' view [NASA-auroras][NASA-ISS-aurora] |
| Blue | N₂ | ~100–200 km |
| Pink / purple lower border | N₂ | ≤ ~100 km |

  The green state lives ~1 s, the red one >150 s — green edges are crisp, red tops are a diffuse fog [NOAA-aurora]. Electrons arrive at ~20,000 km/s; in storms curls cross the sky in tens of seconds; morning patches pulse with ~10 s periods; arcs run east–west horizon to horizon; the oval moves equatorward with Kp (Kp 8–9 reaches Europe's north half) [NOAA-aurora]. From the ISS: concave arcs spanning 30–70° of the horizon, curtains and rays (0 to 6+) below, green swirls *above* the 100 km airglow shell, a red fog higher still; the station once flew through a curtain at 388 km [NASA-ISS-aurora].
- **City lights:** orange sodium lamps, green-blue mercury lamps (older districts, Tokyo); grids, highways as bright strings, ports; the Las Vegas Strip is "reputedly the brightest spot" [NASA-cities].
- **Lightning and sprites:** flashes light storm clouds from inside (blue-white); red sprites flick upward into the mesosphere above strong lightning [NASA-sprite].
- **Sunglint:** mirror reflection of the Sun on water — calm water bright, wind-roughened water darker, so glint draws coastlines, lakes and wind lanes [NASA-sunglint]. Water's Fresnel reflectance is ~2 % at normal incidence and rises toward 100 % at grazing angles (d, n = 1.33).
- **The terminator:** civil-to-astronomical twilight spans 18° of arc ≈ 2,000 km at the equator (d) — a wide, colour-graded band, not a line.

→ Game: orbit view = black space, thin layered limb, green airglow shell, auroral ovals at the poles, glinting oceans on the day side, orange city webs at night; the cheapest wow is the sunrise limb.

---

## 4. Giant planets and rings

### 4.1 Jupiter [NASA-jupiter][NSSDC-jupiter]
- Bands: lighter **zones** and dark orange-brown **belts** flowing in opposite directions; three cloud decks within ~71 km — ammonia ice (top), ammonium hydrosulfide, water; colours possibly from sulfur and phosphorus compounds. Bond albedo 0.343, geometric 0.538; 1-bar temperature 165 K; scale height 27 km.
- Winds up to 150 m/s (≈ 540 km/h) below 30° latitude; jets reach ~3,200 km deep; rotation 9.9 h.
- **Great Red Spot:** ~41,000 km long in the late 1800s, 23,300 km in 1979, ~16,500 km in 2014 (shrinking ~930 km/yr then, turning from oval to round) [NASA-GRS-2014]; still larger than Earth; "cherry red" in a cream setting; it wobbles in size and shape over ~90 days (Hubble 2023–24) [NASA-GRS-2024]; ~500 km deep.
- **Polar cyclones (Juno):** north — 8 cyclones in a ring around a central one ~4,000 km wide [APOD-juno-cyclones]; south — 5 around 1 (a pentagon), joined by a 6th in Nov 2019 (hexagon), winds ~360 km/h [SwRI-juno-south].
- Rings: faint, small dark particles, visible mainly when backlit [NASA-jupiter]. Magnetic field 16–54× Earth's, strong aurorae, radiation that bathes the inner moons [NASA-jupiter].

### 4.2 Saturn and its rings [NASA-saturn][NSSDC-saturn][NSSDC-saturn-rings][JPL-ring-faq][NASA-hexagon]
- Cloud colours: shades of yellow, brown and grey (haze-muted); winds up to 400–500 m/s near the equator; density below water; 10.7 h day; tilt 26.7° → seasons of >7 years; Bond albedo 0.342.
- **Hexagon:** a jet stream (~322 km/h) ~30,000 km across around the north pole with a storm at the centre; embedded vortices up to ~3,500 km [NASA-saturn][NASA-hexagon].
- **Rings** (radius from Saturn's centre):

| Ring | Radius km | Thickness | Optical depth | Albedo / look |
|---|---|---|---|---|
| D | 66,900–74,510 | — | 10⁻⁵ | almost invisible |
| C | 74,658–91,975 | ~5 m | 0.05–0.35 | darker grey, translucent (0.12–0.3) |
| B | 91,975–117,507 | 5–10 m | 0.4–2.5 | brightest, opaque (0.4–0.6); spokes |
| Cassini Division | ~117,500–122,340 (≈ 4,700 km wide) | — | 0–0.1 | dark gap, dusty grey |
| A | 122,340–136,780 | 10–30 m | 0.4–1.0 | bright (0.4–0.6); Encke gap at 133,410 |
| F | 139,826 | narrow | 0.1 | bright twisted strand |
| G | 166,000–173,000 | — | 10⁻⁶ | faint dust |
| E | 180,000–480,000 | thick, diffuse | 10⁻⁶ | ice fog fed by Enceladus |

  Particles mostly water ice, ~1 cm to 5 m, a few km-sized moonlets (Pan, 20 km, in the Encke gap); main rings typically ~10 m thick; all inside the Roche limit (147,000 km); **spokes** up to 20,000 km long on the B ring rotate with the magnetic field [JPL-ring-faq][NASA-saturn][NSSDC-saturn-rings]. Aspect ratio 2.7·10⁷ : 1 (d).
- Geometry for rendering: the rings cast thin dark bands on the globe that slide with the season; the planet throws a dark wedge across the rings behind it; twice per orbit (~every 15 years) the Sun and Earth cross the ring plane and the rings vanish to a line (d from the 26.7° tilt and 29.4-yr orbit).

### 4.3 Uranus and Neptune
- Both are a **similar pale greenish blue**; methane absorbs red; Uranus is a little paler (more haze), greener at solstice and bluer at equinox (half the methane near its poles); 1989 Voyager images were stretched and look too blue [SciAm-irwin2024][NASA-neptune].
- Uranus: tilt 97.8°, each pole gets a ~21-year dark winter; winds to 900 km/h (retrograde at the equator); minimum 49 K; 13 rings — narrow, dark grey; the outer two reddish (dusty) and blue [NASA-uranus].
- Neptune: winds >2,000 km/h — the fastest; the Great Dark Spot (1989) was Earth-sized and has gone; 5 rings, Galle (41,900 km) to Adams (62,930 km, <50 km wide) with four dusty **arcs** (Liberté, Égalité, Fraternité, Courage); Triton orbits backwards, −235 °C, with geysers >8 km high [NASA-neptune][NSSDC-neptune-sats].

→ Game: giant planets are shader work (banded noise along latitude, vortices, oblate silhouette, ring plane with optical-depth texture, ring shadow); Saturn's rings are the honest home for a dense "asteroid field" of ice chunks — thin as paper, so flying *through* them means crossing a 10–30 m sheet.

---

## 5. Rocky and icy surfaces

### 5.1 The Moon [NASA-moon-comp][LRO-diviner][NSSDC-moon]
- Regolith: tiny dust to house-sized boulders; rock chips, glasses, agglutinates (grains welded by micrometeorite melt); finest dust <10–20 µm. Thin (a few feet to metres) on the young maria, up to ~20 m on the old highlands — older surface, thicker regolith.
- **Maria:** dark basalt lava (more iron and titanium), 4.2–1.2 Gyr old; **highlands:** bright whitish-grey, calcium- and aluminium-rich, older. Crust ~40 km (near side) vs ~60 km (far side).
- Craters: Tycho 85 km, ~108 Myr, bright rays across much of the near side [NASA-tycho]; rays darken with age (space weathering) [NASA-mercury].

### 5.2 Impact craters — generator rules [LPL-craters]
- **Simple craters:** bowls, depth/diameter ≈ 0.2 at all sizes.
- **Complex craters:** flat floors, central peaks, terraced walls, melt; shallower, size-dependent d/D.
- **Transition diameter** D_T ∝ 1/g (D_T ≈ Y/(ρg)): Earth ~3 km, Moon ~18 km, Mars ~9 km (rock) / ~2.7 km (ice); Mercury ≈ Mars (same gravity) (d).
- Progression with size: pit → bowl → central peak → peak ring (Schrödinger ~320 km) → multi-ring basin (Orientale ~970 km).
- Continuous ejecta blanket ≈ one crater radius; big ejecta blocks make **secondary craters** that dominate small crater counts.
- Crater size ≫ impactor: Meteor Crater 1.2 km from a ~50 m body (×24); impacts at 11–72 km/s on Earth.
- Size–frequency: power law (more small ones); Bennu's cumulative slope −2.9 down to 8 m [Lauretta2019].

### 5.3 Mercury [NASA-mercury]
Greyish-brown, bright crater rays that fade with age; Caloris basin ~1,550 km; lobate scarps (cooling contraction) hundreds of km long and up to ~1.6 km high; possible water ice in permanently shadowed polar craters.

### 5.4 Mars [NASA-mars][SVS-MOLA][JPL-dustdevil][NSSDC-mars]
- **Olympus Mons:** summit ~25 km above the planetary mean (MOLA), bulge ~550 km east–west, base about the size of Arizona; >40 km from base to top in NASA's wording.
- **Valles Marineris:** >4,000 km long (3,870 km in NASA's figure), up to 600 km wide, up to ~9.3 km deep.
- **Hellas basin:** 2,100 km across, >9 km deep.
- **Dust devils:** up to ~20 km tall and ~70 m wide (Amazonis Planitia, HiRISE 2012); they leave dark tracks.
- Colours: rust from oxidised iron in dust and rock, with brown, gold and tan [NASA-mars]; Bond albedo 0.25.
- Seasons unequal (eccentricity 0.094): northern spring 194 sols, autumn 142 sols; year 669.6 sols [NASA-mars].
- Phobos is spiralling in and will break up or crash in ~50 Myr [NASA-mars].

### 5.5 Io [JPL-io-juno][JPL-pele][APOD-io]
~400 volcanoes; Pele's plume 300 km (Voyager 1979) to ~400 km (Hubble); a 2024 hotspot of ~100,000 km² (bigger than Lake Superior) released ~80 TW; Loki lava lake ~20,000 km². Colour: mostly bright yellow (sulfur) with molten silicate lava hot enough to glow at night. Tidal stretching by Jupiter is ~5,600× the Moon's tide on Earth (d) — the engine of the volcanism.

### 5.6 Europa and Enceladus
- **Europa:** ice shell 15–25 km over a 60–150 km deep ocean (~2× Earth's ocean water); **dark reddish-brown lineae** 1–2 km wide and thousands of km long, ridges hundreds of m tall, reddish blocky **chaos terrain**, pits and domes; surface 40–90 Myr old; possible plumes ~160 km (unconfirmed); reflects 5.5× more light than the Moon; sunlight 1/25 of Earth's [NASA-europa].
- **Enceladus:** 500 km across, the most reflective body known; four **tiger stripes** ~135 km long across the south pole; jets at ~400 m/s, plumes hundreds of km high, partly falling back, partly feeding the E ring; ocean ~10 km deep under 30–40 km of ice; silica nanograins point to >90 °C hydrothermal vents [NASA-enceladus]. One Cassini mosaic counts >30 individual geysers; hotspots ≤1 km wide, >180 K against 50 K surroundings [JPL-enceladus-jets].

### 5.7 Pluto [NASA-pluto-10][NASA-pluto-haze-mtns][NASA-pluto-blue]
Sputnik Planitia: a nitrogen-ice glacier >1,000 km across and ≥4 km thick, cut into convection **polygons** ≥10 km wide; water-ice mountains up to ~3.5 km (Norgay, Hillary Montes); methane-ice dunes along its western edge; faults ~4 km deep; reddish tholin deposits; exposed water ice near craters and valleys; Charon's north pole reddish.

### 5.8 Generator rules that the surfaces suggest
- Crater shape by size and gravity (5.2); rays only on young craters; rays and fresh ice/rock darken with age.
- Regolith thicker on older terrain; boulders cluster near fresh craters and on rubble-pile ridges.
- Low gravity + no plate motion → giant shield volcanoes and deep canyons (Mars); tidal heating → active volcanism (Io) or cryo-jets along fractures (Enceladus); young ice = few craters (Europa).
- Ice worlds: bright (albedo 0.5–1.0), cracked in long lineae; organic-rich ices redden (tholins).
- Colour palettes come from chemistry: iron oxide (Mars rust), sulfur (Io yellows), tholins (Pluto/Titan reds-browns), carbon (asteroids near-black).

---

## 6. Stars and deep space

### 6.1 Star colour by temperature

| Type | T_eff K | Stellar-model sRGB [Harre-Heller2021] | Blackbody sRGB (d) | Looks |
|---|---|---|---|---|
| O5 | 40,000 | `#5b7bff` | `#9eb8ff` | pale electric blue |
| B0.5 | 28,000 | `#5e7fff` | `#a6bdff` (25,000 K) | blue-white |
| A0 | 10,000 | `#7996ff` | `#cdd9ff` | white with blue tint |
| F0 | 7,200 | `#b8c5ff` | `#ebecff` (7,500 K) | white |
| F5 | 6,500 | `#dddeff` | `#fff9fe` | white |
| G2 (Sun) | 5,800 | `#ffede6` | `#fff1ea` (5,772 K) | white, faintly warm |
| K0 | 5,300 | `#ffdec0` | `#ffe7d0` (5,000 K) | cream |
| K5 | 4,400 | `#ffb177` | `#ffdebc` (4,500 K) | light orange |
| M0 | 3,900 | `#ffa25a` | `#ffd4a6` (4,000 K) | orange |
| M5.5 | 3,000 | `#ffa349` | `#ffb96e` | orange |
| M9.5 | 2,300 | `#ff7d24` | `#ff9d38` | deep orange |

The stellar-model codes (PHOENIX/TLUSTY spectra, CIE 2006 matching functions) differ most from blackbodies for the hottest and coolest stars [Harre-Heller2021] — real spectra are not Planck curves (cool dwarfs carry strong molecular absorption bands), so model colours come out bluer for O/B and oranger for M stars. → Game: use the model column for star discs; never pure red or pure blue stars.

### 6.2 The main sequence [Mamajek]

| SpT | T_eff K | L / L☉ | R / R☉ (d) | M / M☉ | B−V |
|---|---|---|---|---|---|
| O5V | 41,400 | 3.5·10⁵ | 11.4 | 43 | −0.32 |
| B0V | 31,400 | 4.5·10⁴ | 7.1 | 17.7 | −0.30 |
| B5V | 15,700 | 590 | 3.3 | 4.7 | −0.16 |
| A0V | 9,700 | 38 | 2.2 | 2.18 | 0.00 |
| A5V | 8,100 | 12.3 | 1.8 | 1.88 | 0.16 |
| F0V | 7,220 | 7.2 | 1.7 | 1.61 | 0.30 |
| F5V | 6,550 | 3.6 | 1.5 | 1.33 | 0.44 |
| G2V | 5,770 | 1.02 | 1.01 | 1.00 | 0.65 |
| K0V | 5,270 | 0.46 | 0.81 | 0.88 | 0.82 |
| K5V | 4,440 | 0.17 | 0.70 | 0.70 | 1.15 |
| M0V | 3,850 | 0.069 | 0.59 | 0.57 | 1.42 |
| M3V | 3,430 | 0.016 | 0.36 | 0.37 | 1.53 |
| M5V | 3,060 | 0.0030 | 0.20 | 0.162 | 1.83 |
| M8V | 2,570 | 0.00052 | 0.12 | 0.085 | 2.15 |

Radii from L = 4πR²σT⁴ (d). A red giant of 100 R☉ seen from 1 AU would span ~50° of sky (d).

### 6.3 Binaries, flares, red dwarfs
- **Kepler-16:** an orange K star (0.69 M☉) and a red M dwarf (0.20 M☉), radius ratio ~3:1, orbiting each other every ~41 days; a Saturn-sized planet circles both every 229 days; an observer would cast two shadows, a deep one and a faint reddish one [NASA-kepler16][SnT-kepler16].
- **Proxima Centauri** (M5.5V, ~0.14 R☉, ~3,050 K, 0.00165 L☉) [Barnes2016]: giant flares every day, the largest made it **14,000× brighter in ultraviolet** for a moment (2019 campaign) [NASA-proxima-flares].

→ Game: red-dwarf systems get sudden flare flashes (sky brightening, aurora storms) — spectacle, not damage, in the peaceful mode.

### 6.4 Nebulae — what the colours are

Emission lines (rest wavelengths): Hα 656.3 nm (deep red), Hβ 486.1 nm (blue-green), [O III] 495.9/500.7 nm (teal), [N II] 654.8/658.4 nm (red), [S II] 671.6/673.1 nm (deep red). In true colour, hydrogen nebulae look pink-red (Hα plus some Hβ), oxygen-rich cores look teal; reflection nebulae are blue (dust scatters blue starlight); dark nebulae are dense dust clouds that block light [NASA-decoding-nebulae].

**Published images are mapped, not true colour:**
- Hubble narrow-band "SHO" mapping: **red = sulfur, green = hydrogen, blue = oxygen** (M17) [NASA-M17]; other releases map Hα red, [O III] green, Hβ blue [ESA-heic0114] or green = nitrogen + hydrogen [NASA-decoding-nebulae].
- Webb sees infrared; filters are assigned by **chromatic order** — shortest wavelength blue, longest red, NIRCam's 0.7–2 µm filters → violet/blue/cyan, 2–3.6 µm → green/yellow, 3.6–4.4 µm → orange/red; images are brightness-stretched and white-balanced on star cores [NASA-webb-colour].
- **Pillars of Creation** (Eagle Nebula, 70 × 55 ly region, 6,500–7,000 ly away): columns 4–5 ly tall of cold gas and dust eroded by UV and winds from young stars [NASA-M16]; in Webb's view: semi-opaque rusty-red dust, darker brown peaks with glowing red edges, wavy lava-like lines of jets and bow shocks, a crimson glow of excited molecular hydrogen, newborn stars as red points, few background galaxies [NASA-webb-pillars]. Structure in published images: ionised walls glowing on the side facing the hot stars, dark dust lanes, bright cores.

→ Game: our nebulae are procedural volumes with emission colours from the line list (true-colour mode) plus an optional "telescope palette" toggle; diffraction spikes belong to telescopes, not to the eye.

### 6.5 The Milky Way from a dark site [NPS-nightsky][NASA-great-rift][NASA-milkyway]
- Darkest pristine sky 22.0 mag/arcsec² (172 µcd/m²); mean all-sky 21.6 (250 µcd/m²); the **Milky Way is the brightest natural feature at 19.6 mag/arcsec² (1,500 µcd/m²)** — only ~9× the darkest background (d); moonless ground illuminance 0.8 mlux; ~4,000 stars to the eye; limiting magnitude 6.6–7.4.
- The **Great Rift**: dust clouds between us and the inner galaxy split the band from the Summer Triangle down to Sagittarius; the brightest star clouds are toward Scorpius–Sagittarius (the centre); thick air near the horizon hides it.
- Galaxy: ~100,000 ly across; the Sun ~8 kpc ≈ 26,000 ly from the centre.

→ Game: Milky Way = a low-contrast band (×9 over background) with dark rift masks; brightness must sit *below* bright stars; airglow and zodiacal light are natural extras.

### 6.6 Galaxies
Spirals: older, cooler stars make bulges warm yellow-white; arms carry young blue-white stars, pink hydrogen nebulae and dark dust lanes (colours per 6.1/6.4). → Game: galaxy sprites = bulge (K/G colours) + arm noise (B/A colours) + pink knots + dust lanes.

### 6.7 Black holes — what the Event Horizon Telescope shows (physics only)
- **M87\***: an asymmetric bright ring **42 ± 3 µas** across, width <20 µas, brighter in the south by >10:1; dark centre = the shadow; M = 6.5·10⁹ M☉ at 16.8 Mpc; observed at 1.3 mm [EHT2019]. The brightness asymmetry is relativistic beaming: plasma moving toward us at near light speed looks brighter.
- **Sgr A\*** (our galaxy's centre): a ring of ~52 µas, strongly variable (up to ~100 % on some baselines) [EHT2022]; derived shadow ≈ 50 µas for 4·10⁶ M☉ at 8.18 kpc (d).
- Geometry (d): Schwarzschild radius r_s = 2GM/c²; photon sphere 1.5 r_s; shadow diameter √27·GM/c²·2 ≈ 5.2 r_s (667 AU for M87\*, 0.41 AU for Sgr A\*); innermost stable orbit 3 r_s (non-spinning); light bending shows the disc's far side above and below the hole.

→ Game: disc brighter and bluer on the approaching side, thin photon ring, black shadow ~2.6× the horizon radius — all three are shader terms.

### 6.8 Distances and why every game jumps
Light times (d): Moon 1.3 s, Sun 8.3 min, Mars 3–22 min, Jupiter ~35 min, Neptune ~4 h. Voyager 1 needs 49 years to be one light-day away (~61,000 km/h) [NASA-voyager-lightday]; at that speed Proxima (4.24 ly) takes ~75,000 years; even 10 % of light speed takes 42 years (d).

→ Game: interstellar travel is a jump by necessity, and the jump home is always available — physics gives no reason to make returning harder than leaving.

---

## 7. Exoplanets

- **Census:** 6,000 confirmed (NASA, Sept 2025), >8,000 candidates; <100 directly imaged; Webb has analysed >100 atmospheres [NASA-6000].
- **Classes** [NASA-planet-types]: gas giants (Saturn/Jupiter-size or larger), incl. **hot Jupiters** hugging their stars at thousands of degrees (51 Pegasi b, ~50 ly); Neptune-like, incl. **mini-Neptunes** (between Earth and Neptune in size — none in our system); **super-Earths** (2–10 Earth masses, rock, gas or both); terrestrial (Earth-size and smaller). NASA's list of oddities: planets orbiting two stars, rogue planets, planets around dead stars, lava-covered planets, Styrofoam-density planets, clouds of gemstones [NASA-6000].
- **Lava worlds:** 55 Cancri e — diameter ~2× Earth's, slightly denser, 41 ly, 1/25 of Mercury's distance from its star, probably tidally locked, dayside ~1,540 °C, magma ocean, possible CO₂/CO atmosphere [NASA-55cnce]; TOI-561 b — ~1.4 Earth radii, year <11 h, dayside ~1,800 °C, thick volatile atmosphere over a global magma ocean [NASA-toi561b].
- **Tidally locked red-dwarf worlds:** Proxima b — ~1.06 Earth masses, 0.0485 AU, 11.2 d [NASA-proxima-b], ~65 % of Earth's insolation, locked within ~10⁴ yr [Barnes2016]; its star spans 1.5° (2.9× our Sun) (d). Eternal day side, eternal night side, a ring-shaped **eternal terminator** where the star sits on the horizon forever.
- **TRAPPIST-1** (40 ly; star 0.1192 R☉, 2,566 K, 0.000553 L☉) [Agol2021][NASA-trappist-10]: seven Earth-sized rocky planets with years of 1.51–18.77 days; planet e (0.92 R⊕, 0.69 M⊕, 0.02925 AU, 6.1 d) gets 0.65× Earth's light; the star spans 2.2° from e and 5.5° from b (d); neighbouring planets appear in the sky like moons [NASA-trappist-10].
- **Habitable zone** [Kopparapu2013]: for the Sun 0.99 AU (moist greenhouse) to 1.70 AU (maximum greenhouse); optimistic 0.75 (recent Venus) to 1.77 AU (early Mars); scale with d = √(L/S_eff) (S_eff = 1.014 / 0.344 for the Sun, slightly lower for cooler stars). Examples with the solar S_eff (d; cooler stars sit a few % farther out): K5V 0.41–0.71 AU, Proxima 0.040–0.069 AU, TRAPPIST-1 0.023–0.040 AU.
- **Sky colour under other stars** (d, single Rayleigh scattering of the star's spectrum, no eye adaptation):

| Star | Star colour | Rayleigh sky |
|---|---|---|
| 2,566 K (TRAPPIST-1) | `#ffa94f` | `#ffdcab` pale peach |
| 3,050 K (Proxima) | `#ffba71` | `#fff5e3` cream-white |
| 3,850 K (M0) | `#ffd19e` | `#d2e4ff` very pale blue |
| 4,450 K (K5) | `#ffddba` | `#b3cfff` pale blue |
| 5,772 K (Sun) | `#fff1ea` | `#8eb3ff` blue |
| 10,000 K (A0) | `#cdd9ff` | `#6891ff` deep blue |

  An eye adapted to the orange star sees these skies bluer relative to the light (white balance) — but red-dwarf skies are paler and warmer than ours, and noon light is orange.

→ Game: "start a life elsewhere" worlds come from these classes; derive star colour, sky colour, star size and day length from (T_eff, L, a), lock close-in planets, and give circumbinary worlds two shadows.

---

## 8. Physics for gameplay on other worlds

**Jumping and falling** (a 0.5 m standing jump on Earth = 3.13 m/s take-off; flat-gravity approximation) (d):

| World | g | Jump height | Air time | Fall 10 m: time / impact |
|---|---|---|---|---|
| Earth | 9.81 | 0.50 m | 0.64 s | 1.4 s / 14.0 m/s |
| Venus | 8.87 | 0.55 m | 0.71 s | 1.5 s / 13.3 m/s (air slows you, below) |
| Mars | 3.73 | 1.3 m | 1.7 s | 2.3 s / 8.6 m/s |
| Moon | 1.62 | 3.0 m | 3.9 s | 3.5 s / 5.7 m/s |
| Io | 1.80 | 2.7 m | 3.5 s | 3.3 s / 6.0 m/s |
| Titan | 1.35 | 3.6 m | 4.6 s | 3.8 s / 5.2 m/s (air slows you) |
| Pluto | 0.62 | 8.0 m | 10 s | 5.7 s / 3.5 m/s |
| Ceres | 0.28 | 17 m | 22 s | 8.4 s / 2.4 m/s |
| Enceladus | 0.11 | 43 m | 55 s | 13 s / 1.5 m/s |
| Phobos | 0.006 | — (curved path, minutes aloft; v_esc 11 m/s) | | 59 s / 0.3 m/s |
| Bennu | 0.0001 | **escape** (v_esc 0.2 m/s) | | |

Walking: the walk-to-run switch happens near Froude number v²/(gL) ≈ 0.5, so with 0.9 m legs the natural top walking speed is ~2.1 m/s on Earth, ~1.3 m/s on Mars, ~0.85 m/s on the Moon (d) — low gravity favours loping and hopping.

**Terminal velocity, belly-down 80 kg human, C_dA = 0.7 m²** (d): Earth 43 m/s; Titan 7.6 m/s (air 5.4 kg/m³ — arm-wings are enough); Venus 5.6 m/s (65 kg/m³); Mars 234 m/s (0.016 kg/m³ — parachutes must be huge, landers add rockets).

**Sound:** none in vacuum. Mars: ~240 m/s for low and ~250 m/s for high pitches (two speeds), very quiet, high tones fade within ~8 m (Earth: ~65 m); Ingenuity's rotors hummed at 84 Hz [JPL-mars-sounds]. Titan's cold dense nitrogen carries sound at ~200 m/s and carries it well; Venus ~400 m/s (d, ideal gas).

**Temperature extremes:** Mercury 430 / −180 °C [NASA-mercury]; Venus 464 °C [NSSDC-venus]; Moon 120 / −130 °C, 25 K in shadowed craters [LRO-diviner]; Mars 20 to −153 °C [NASA-mars]; Titan −179 °C [ESA-titan]; Triton −235 °C [NASA-neptune]; Pluto 24–38 K [NSSDC-pluto].

**Radiation:** Earth background ~3 mSv/yr (~0.008 mSv/day); Mars surface ~0.7 mSv/day (Curiosity RAD, ~85× Earth) and roughly twice that in cruise [SpaceMath-RAD]; a 180 + 500 + 180-day Mars mission totals ~1 Sv in three roughly equal parts [JPL-mars-trip-dose]; Jupiter's belts bombard the inner moons [NASA-jupiter].

**Pressure:** below the **Armstrong limit** (6.3 kPa, ~18–19 km on Earth) water boils at body temperature; unprotected, consciousness goes quickly and death follows unless pressure returns within ~60–90 s [WP-armstrong]. NASA's spacewalk suit runs at **29.6 kPa (4.3 psi)** [NASA-EMU]. Mars (0.6 kPa) needs a pressure suit; Titan (150 kPa) needs only heat, oxygen and a mask; Venus (9.2 MPa, 464 °C) needs a hardened vehicle.

**Suit and ship tasks (d from the above):** hold pressure (or survive 92 bar), hold temperature (−240…+460 °C), shield radiation (storm shelter for flares), supply oxygen, cool the occupant, and manage dust (Moon/Mars) — each is a natural HUD gauge.

**Days and seasons:** solar days from 9.9 h (Jupiter) to 176 Earth days (Mercury) and 117 days (Venus, retrograde); a Titan day = its 16-day orbit; Uranus' poles get 21-year nights [NSSDC-planets][NASA-uranus]; Mars seasons are unequal (194-sol spring vs 142-sol autumn) [NASA-mars].

**Tides (d):** the Moon pulls Earth's tide at 1.1·10⁻⁶ m/s² (the Sun adds 46 % of that); Earth's tide on the Moon is 22× stronger; Jupiter on Io ~5,600×, Saturn on Enceladus ~1,300× — the heat source of their volcanoes and geysers.

→ Game: every world gets (g, air density, sound speed, temperature, radiation, day length) as six numbers; movement, audio, suit HUD and weather follow from them. In peaceful mode hazards warn and guide, they don't punish; the home jump is always one button away.

---

## Appendix A — how the (d) numbers were made

- Angular size of a body of radius R from distance d: `2·asin(R/d)` (observer on the facing surface: d = orbit radius − own radius).
- Sunlight: `S = 1361 W/m² · (1 AU/d)²`; illuminance ≈ 93 lm/W × S.
- Surface gravity `g = GM/R²`; escape `√(2GM/R)`; jump `h = v²/2g`, air time `2v/g`, fall `t = √(2h/g)`.
- Hohmann, synodic period `1/|1/P₁ − 1/P₂|`, sphere of influence as in 1.9; Δv from LEO = `√(v∞² + v_esc,LEO²) − v_LEO`.
- Asteroid brightness: `H = 5·log₁₀(1329 km / (D·√p))`, `V = H + 5·log₁₀(r·Δ)` (AU, opposition).
- Tidal acceleration `2GMr/d³`.
- Sky constants: β_R(λ) = 1.24062·10⁻⁶ λ⁻⁴ (µm), τ = β·H, air mass (Kasten–Young 1989), transmittance `exp(−m·Σ τ)`.
- Colours: Planck spectra (and Planck × λ⁻⁴ for Rayleigh skies) integrated with the Wyman–Sloan–Shirley (2013) analytic fit of the CIE 1931 2° matching functions, converted to linear sRGB (D65), clipped, normalised to the brightest channel, gamma-encoded.
- Stellar radius `R/R☉ = √(L/L☉) / (T/5772 K)²`.
- Terminal velocity `√(2mg/(ρ·C_dA))`, air density `ρ = pM/(RT)`; sound speed `√(γRT/M)`.
- Black-hole shadow diameter `2√27·GM/c²`; angular size = diameter / distance.

**Missions whose new data should refresh this file:** Juno, Europa Clipper, JUICE, Psyche, Hera (Didymos), BepiColombo, Lucy, OSIRIS-APEX, Perseverance, LRO, JWST, the EHT. Re-check the moon counts, the Great Red Spot size and the exoplanet census every release cycle.

---

## Sources

Fact sheets and catalogues
- [NSSDC-planets] NASA NSSDCA, Planetary Fact Sheet – Metric: https://nssdc.gsfc.nasa.gov/planetary/factsheet/index.html
- [NSSDC-sun] NASA NSSDCA, Sun Fact Sheet: https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html
- [NSSDC-moon] NASA NSSDCA, Moon Fact Sheet: https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html
- [NSSDC-earth] NASA NSSDCA, Earth Fact Sheet: https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html
- [NSSDC-mars] NASA NSSDCA, Mars Fact Sheet: https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html
- [NSSDC-venus] NASA NSSDCA, Venus Fact Sheet: https://nssdc.gsfc.nasa.gov/planetary/factsheet/venusfact.html
- [NSSDC-jupiter] NASA NSSDCA, Jupiter Fact Sheet: https://nssdc.gsfc.nasa.gov/planetary/factsheet/jupiterfact.html
- [NSSDC-saturn] NASA NSSDCA, Saturn Fact Sheet: https://nssdc.gsfc.nasa.gov/planetary/factsheet/saturnfact.html
- [NSSDC-pluto] NASA NSSDCA, Pluto Fact Sheet: https://nssdc.gsfc.nasa.gov/planetary/factsheet/plutofact.html
- [NSSDC-galilean] NASA NSSDCA, Galilean satellites table: https://nssdc.gsfc.nasa.gov/planetary/factsheet/galileanfact_table.html
- [NSSDC-saturn-sats] NASA NSSDCA, Saturnian Satellite Fact Sheet: https://nssdc.gsfc.nasa.gov/planetary/factsheet/saturniansatfact.html
- [NSSDC-neptune-sats] NASA NSSDCA, Neptunian Satellite Fact Sheet: https://nssdc.gsfc.nasa.gov/planetary/factsheet/neptuniansatfact.html
- [NSSDC-saturn-rings] NASA NSSDCA, Saturnian Rings Fact Sheet: https://nssdc.gsfc.nasa.gov/planetary/factsheet/satringfact.html
- [JPL-sats] JPL Solar System Dynamics, Planetary Satellite Physical Parameters: https://ssd.jpl.nasa.gov/sats/phys_par/

Small bodies, orbits, re-entry
- [NASA-bennu] NASA, Bennu Facts: https://science.nasa.gov/solar-system/asteroids/101955-bennu/facts/
- [Lauretta2019] Lauretta et al. 2019, Nature, "The unexpected surface of asteroid (101955) Bennu": https://science.gsfc.nasa.gov/sed/content/uploadFiles/publication_files/Lauretta2019.pdf
- [TPS-ryugu] The Planetary Society, First science results from Hayabusa2 (Watanabe, Kitazato, Sugita et al. 2019): https://www.planetary.org/articles/hayabusa2-science-results
- [NASA-didymos] NASA, Didymos & Dimorphos: https://science.nasa.gov/solar-system/asteroids/didymos/
- [NASA-psyche] NASA, Asteroid Psyche: https://science.nasa.gov/solar-system/asteroids/16-psyche/
- [JPL-psyche] JPL, Psyche press kit quick facts: https://www.jpl.nasa.gov/press-kits/psyche/quick-facts/
- [ESA-67P] ESA, Getting to know Rosetta's comet: https://www.esa.int/Science_Exploration/Space_Science/Rosetta/Getting_to_know_Rosetta_s_comet
- [NASA-dawn-faq] NASA, Dawn FAQ: https://science.nasa.gov/mission/dawn/faq/
- [Pitjeva2018] Pitjeva & Pitjev 2018, masses of the main asteroid belt and Kuiper belt: https://arxiv.org/pdf/1811.05191
- [Walsh2018] Walsh 2018, Annual Review, "Rubble Pile Asteroids": https://arxiv.org/pdf/1810.01815
- [APOD-comet-tails] NASA APOD 2005 May 22, dust and ion tails of Hale-Bopp: https://science.nasa.gov/image-article/apod-2005-may-22-the-dust-and-ion-tails-of-comet-hale-bopp/
- [NASA-ceres] NASA, Ceres facts: https://science.nasa.gov/dwarf-planets/ceres/facts/
- [NASA-haumea] NASA, Haumea: https://science.nasa.gov/dwarf-planets/haumea/
- [BSF-ch4] NASA/JPL, Basics of Space Flight, Chapter 4 Trajectories: https://science.nasa.gov/learn/basics-of-space-flight/chapter4-1/
- [JPL-MRO-aerobraking] JPL, Mars Reconnaissance Orbiter reaches planned flight path: https://www.jpl.nasa.gov/news/nasa-mars-reconnaissance-orbiter-reaches-planned-flight-path/
- [NASA-orion-shield] NASA, Orion's heat shield ready to take the heat: https://www.nasa.gov/humans-in-space/after-15-years-1000-tests-orions-heat-shield-ready-to-take-the-heat/
- [Abe2011-hayabusa] Abe et al., Near-UV and visible spectroscopy of Hayabusa re-entry: https://ar5iv.arxiv.org/html/1108.5982
- [NASA-ISS-faq] NASA, Spot the Station FAQ: https://www.nasa.gov/missions/station/spot-the-station-frequently-asked-questions/

Atmospheres and skies
- [Hillaire2020] Hillaire 2020, "A Scalable and Production Ready Sky and Atmosphere Rendering Technique", EGSR / CGF 39(4): https://diglib7.eg.org/bitstream/handle/10.1111/cgf14050/v39i4pp013-022.pdf
- [Bruneton-repo] Bruneton, Precomputed Atmospheric Scattering (docs and code): https://ebruneton.github.io/precomputed_atmospheric_scattering/ and https://github.com/ebruneton/precomputed_atmospheric_scattering
- [SL-llatmosphere] Bruneton's Earth constants as used in an open-source viewer (llatmosphere.cpp): https://darapsa.org/viewer.git/plain/indra/llrender/llatmosphere.cpp?h=main
- [NASA-mars-sunset] NASA, What do sunrises and sunsets look like on Mars: https://science.nasa.gov/solar-system/planets/mars/what-does-a-sunrise-sunset-look-like-on-mars/
- [JPL-curiosity-sunset] JPL, Curiosity views serene sundown: https://www.jpl.nasa.gov/news/nasas-curiosity-rover-views-serene-sundown-on-mars/
- [Lemmon2004] Lemmon et al. 2004, Science, atmospheric imaging results from Spirit and Opportunity: https://experts.arizona.edu/en/publications/atmospheric-imaging-results-from-the-mars-exploration-rovers-spir/
- [Lemmon2015] Lemmon et al. 2015, dust aerosol, clouds and optical depth over 5 Mars years: https://www.arxiv.org/pdf/1403.4234
- [WebExhibits-mars] WebExhibits, Causes of Color — Mars sky: https://www.webexhibits.org/causesofcolor/14C.html
- [PIA-titan] NASA Photojournal PIA06236, Titan's complex anti-greenhouse: https://science.nasa.gov/photojournal/titan-complex-anti-greenhouse/
- [NASA-titan] NASA, Titan facts: https://science.nasa.gov/saturn/moons/titan/facts/
- [ESA-titan] ESA, Facts about Titan: https://www.esa.int/Science_Exploration/Space_Science/Cassini-Huygens/Facts_about_Titan
- [ESA-huygens-colour] ESA, First colour view of Titan's surface: https://www.esa.int/ESA_Multimedia/Images/2005/01/First_colour_view_of_Titan_s_surface
- [Venera-NTRS] NASA technical translation, Venera 9/10 surface illumination: https://ntrs.nasa.gov/api/citations/19800002742/downloads/19800002742.pdf
- [ESA-venus-winds] ESA, How windy is it on Venus? Venus Express answers: https://www.esa.int/Science_Exploration/Space_Science/Venus_Express/How_windy_is_it_on_Venus_Venus_Express_answers
- [NTRS-earthshine] NASA NTRS, Earthshine as an illumination source at the Moon: https://ntrs.nasa.gov/citations/20190001705
- [AO-earthshadow] Atmospheric Optics (L. Cowley), Earth shadow & Belt of Venus: https://old.atoptics.co.uk/fz680.htm
- [AO-anticrep] Atmospheric Optics, Anticrepuscular (antisolar) rays: https://atoptics.co.uk/blog/anticrepuscular-antisolar-rays-opod/
- [WP-greenflash] Wikipedia, Green flash (secondary; summarises A. T. Young, SDSU): https://en.wikipedia.org/wiki/Green_flash
- [NASA-AIM-NLC] NASA AIM, Noctilucent clouds: https://science.nasa.gov/missions/aim/nasa-noctilucent-clouds/

Earth from orbit
- [AO-airglow] Atmospheric Optics, Airglow: https://old.atoptics.co.uk/highsky/airglow2.htm
- [NASA-ICON] NASA Earth Observatory, ICONic views of the atmosphere: https://science.nasa.gov/earth/earth-observatory/iconic-views-of-the-atmosphere-146079/
- [NASA-auroras] NASA, Auroras: https://science.nasa.gov/sun/auroras/
- [NOAA-aurora] NOAA SWPC, Aurora tutorial: https://swpc-drupal.woc.noaa.gov/content/aurora-tutorial
- [NASA-ISS-aurora] NASA Earth Observatory, Auroras: dancing in the night: https://science.nasa.gov/earth/earth-observatory/auroras-dancing-in-the-night/
- [NASA-ISS-sunset] NASA Earth Observatory, Sunset from the ISS: https://science.nasa.gov/earth/earth-observatory/sunset-from-the-international-space-station-44267/
- [NASA-cities] NASA Earth Observatory, Cities at night: https://science.nasa.gov/earth/earth-observatory/cities-at-night-the-view-from-space/
- [NASA-sprite] NASA, A midsummer red sprite seen from space: https://www.nasa.gov/image-article/a-midsummer-red-sprite-seen-from-space/
- [NASA-sunglint] NASA Earth Observatory, Mediterranean sunglint: https://science.nasa.gov/earth/earth-observatory/mediterranean-sunglint/

Giant planets
- [NASA-jupiter] NASA, Jupiter facts: https://science.nasa.gov/jupiter/jupiter-facts/
- [NASA-GRS-2014] NASA, Hubble shows the Great Red Spot smaller than ever measured: https://science.nasa.gov/missions/hubble/nasas-hubble-shows-jupiters-great-red-spot-is-smaller-than-ever-measured/
- [NASA-GRS-2024] NASA, Hubble watches the Great Red Spot behave like a stress ball: https://science.nasa.gov/missions/hubble/nasas-hubble-watches-jupiters-great-red-spot-behave-like-a-stress-ball/
- [APOD-juno-cyclones] NASA APOD 2025 March 9, Cyclones at Jupiter's north pole: https://science.nasa.gov/image-article/apod-2025-march-9-cyclones-at-jupiters-north-pole/
- [SwRI-juno-south] SwRI Mission Juno, Juno navigators enable cyclone discovery: https://www.missionjuno.swri.edu/news/juno_navigators_enable_jupiter_cyclone_discovery
- [NASA-saturn] NASA, Saturn facts: https://science.nasa.gov/saturn/facts/
- [JPL-ring-faq] JPL, Frequently asked questions about Saturn's rings: https://www2.jpl.nasa.gov/saturn/faq.html
- [NASA-hexagon] NASA, Cassini obtains best views of Saturn hexagon: https://www.nasa.gov/news-release/nasas-cassini-spacecraft-obtains-best-views-of-saturn-hexagon/
- [SciAm-irwin2024] Scientific American on Irwin et al. 2024 (MNRAS), Uranus and Neptune have similar hues: https://www.scientificamerican.com/article/uranus-and-neptune-have-similar-hues-new-study-shows
- [NASA-uranus] NASA, Uranus facts: https://science.nasa.gov/uranus/facts/
- [NASA-neptune] NASA, Neptune facts: https://science.nasa.gov/neptune/neptune-facts/

Rocky and icy surfaces
- [NASA-moon-comp] NASA, Moon composition: https://science.nasa.gov/moon/composition/
- [LRO-diviner] NASA LRO lithograph, temperature variation (Diviner): https://science.nasa.gov/wp-content/uploads/2024/01/lrolitho7temperaturevariation27may2014.pdf
- [LPL-craters] Univ. of Arizona LPL, PTYS 206 lecture "Craters": https://www.lpl.arizona.edu/~shane/PTYS_206/lectures/PTYS_206_craters.pdf
- [NASA-tycho] NASA, Tycho crater: https://science.nasa.gov/resource/tycho-crater-on-the-moon-labeled/
- [NASA-mercury] NASA, Mercury facts: https://science.nasa.gov/mercury/facts/
- [NASA-mars] NASA, Mars facts: https://science.nasa.gov/mars/facts/
- [SVS-MOLA] NASA SVS, MOLA: a planet of superlatives: https://svs.gsfc.nasa.gov/stories/MOLA/index_pg2.html
- [JPL-dustdevil] JPL, 12-mile-high Martian dust devil: https://www.jpl.nasa.gov/news/12-mile-high-martian-dust-devil-caught-in-act/
- [JPL-pele] JPL PIA01256, Hubble captures volcanic eruption plume from Io: https://www.jpl.nasa.gov/images/pia01256-hubble-captures-volcanic-eruption-plume-from-io/
- [JPL-io-juno] JPL, Juno spots most powerful volcanic activity on Io to date (2025): https://www.jpl.nasa.gov/news/nasa-juno-mission-spots-most-powerful-volcanic-activity-on-io-to-date/
- [APOD-io] NASA APOD 2010 October 3, Io in true color: https://science.nasa.gov/image-article/apod-2010-october-3-io-in-true-color/
- [NASA-europa] NASA, Europa facts: https://science.nasa.gov/jupiter/jupiter-moons/europa/europa-facts/
- [NASA-enceladus] NASA Cassini, Enceladus: https://science.nasa.gov/mission/cassini/science/enceladus/
- [JPL-enceladus-jets] JPL, Cassini finds plethora of plumes, hotspots at Enceladus: https://www.jpl.nasa.gov/news/cassini-finds-plethora-of-plumes-hotspots-at-enceladus/
- [NASA-pluto-10] NASA, 10 cool things we learned about Pluto: https://www.nasa.gov/solar-system/five-years-after-new-horizons-historic-flyby-here-are-10-cool-things-we-learned-about-pluto/
- [NASA-pluto-haze-mtns] NASA, Pluto's majestic mountains, frozen plains and foggy hazes: https://science.nasa.gov/resource/plutos-majestic-mountains-frozen-plains-and-foggy-hazes/
- [NASA-pluto-blue] NASA, New Horizons finds blue skies and water ice on Pluto: https://www.nasa.gov/missions/new-horizons-finds-blue-skies-and-water-ice-on-pluto/
- [NASA-pluto-time] NASA, Find your Pluto Time: https://science.nasa.gov/dwarf-planets/pluto/plutotime/

Stars and deep space
- [Harre-Heller2021] Harre & Heller 2021, "Digital color codes of stars", Astron. Nachr.: https://arxiv.org/pdf/2101.06254
- [Mamajek] Pecaut & Mamajek, A modern mean dwarf stellar color and effective temperature sequence (v2022.04.16): https://www.pas.rochester.edu/~emamajek/EEM_dwarf_UBVIJHK_colors_Teff.txt
- [NASA-proxima-flares] NASA, Neighboring star's bad behavior: large and frequent flares: https://science.nasa.gov/universe/exoplanets/neighboring-stars-bad-behavior-large-and-frequent-flares/
- [ESA-heic0114] ESA/Hubble heic0114, Painting with oxygen and hydrogen: https://esahubble.org/news/heic0114/
- [NASA-M17] NASA Hubble, M17 Omega Nebula image: https://science.nasa.gov/image-detail/a-perfect-storm-of-turbulent-gases-2/
- [NASA-decoding-nebulae] NASA, Decoding nebulae: https://science.nasa.gov/universe/stories/quick-reads/decoding-nebulae/
- [NASA-webb-colour] NASA, How are Webb's full-color images made: https://science.nasa.gov/mission/webb/science-overview/science-explainers/how-are-webbs-full-color-images-made/
- [NASA-webb-pillars] NASA, Webb's star-filled portrait of the Pillars of Creation: https://science.nasa.gov/missions/webb/nasas-webb-takes-star-filled-portrait-of-pillars-of-creation/
- [NASA-M16] NASA Hubble Messier catalog, Messier 16: https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-16/
- [NPS-nightsky] US National Park Service, Metrics guide to night sky quality: https://www.nps.gov/subjects/nightskies/NSQmetrics.html
- [NASA-great-rift] NASA Night Sky Network, The Great Rift: https://science.nasa.gov/solar-system/skywatching/night-sky-network/augusts-night-sky-notes-the-great-rift/
- [NASA-milkyway] NASA Imagine the Universe, Milky Way: https://imagine.gsfc.nasa.gov/features/cosmic/milkyway_info.html
- [EHT2019] Event Horizon Telescope Collaboration 2019, First M87 results I: https://www.arxiv.org/pdf/1906.11238
- [EHT2022] Event Horizon Telescope Collaboration 2022, First Sgr A* results IV: https://authors.library.caltech.edu/records/b1tzs-rhx68
- [NASA-voyager-lightday] NASA, Voyager 1: what is a light-day: https://science.nasa.gov/mission/voyager/voyager-1/voyager-1-what-is-a-light-day/

Exoplanets
- [NASA-6000] NASA, Tally of exoplanets reaches 6,000: https://www.nasa.gov/universe/exoplanets/nasas-tally-of-planets-outside-our-solar-system-reaches-6000/
- [NASA-planet-types] NASA, Exoplanet types overview: https://science.nasa.gov/exoplanets/planet-types/
- [Kopparapu2013] Kopparapu et al. 2013, Habitable zones around main-sequence stars: https://web3.arxiv.org/pdf/1301.6674
- [Agol2021] Agol et al. 2021, Refining the transit-timing and photometric analysis of TRAPPIST-1: https://ntrs.nasa.gov/api/citations/20210000129/downloads/Agol_2021_Planet._Sci._J._2_1_Refining.Trappist1.pdf
- [NASA-trappist-10] NASA, 10 things: all about TRAPPIST-1: https://science.nasa.gov/universe/exoplanets/10-things-all-about-trappist-1-2/
- [NASA-proxima-b] NASA exoplanet catalog, Proxima Centauri b: https://science.nasa.gov/exoplanet-catalog/proxima-centauri-b/
- [Barnes2016] Barnes et al. 2016, The habitability of Proxima Centauri b I: https://arxiv.org/pdf/1608.06919
- [NASA-kepler16] NASA, Kepler-16 b: (almost) a real-life Tatooine: https://science.nasa.gov/exoplanets/other-stars-other-worlds/kepler-16-b-almost-a-real-life-tatooine/
- [SnT-kepler16] Sky & Telescope, A planet orbiting two suns: https://skyandtelescope.org/astronomy-news/a-planet-orbiting-two-suns/
- [NASA-55cnce] NASA, Webb hints at possible atmosphere surrounding rocky exoplanet (55 Cancri e): https://science.nasa.gov/missions/webb/nasas-webb-hints-at-possible-atmosphere-surrounding-rocky-exoplanet/
- [NASA-toi561b] NASA, Webb detects thick atmosphere around broiling lava world (TOI-561 b): https://science.nasa.gov/missions/webb/nasas-webb-detects-thick-atmosphere-around-broiling-lava-world/

Physics for gameplay
- [JPL-mars-sounds] JPL, What sounds captured by Perseverance reveal about Mars: https://www.jpl.nasa.gov/news/what-sounds-captured-by-nasas-perseverance-rover-reveal-about-mars/
- [SpaceMath-RAD] NASA Space Math, Radiation levels on the surface of Mars: https://spacemath.gsfc.nasa.gov/weekly/10Page74.pdf
- [JPL-mars-trip-dose] JPL PIA17601, Radiation exposure comparisons with Mars trip calculation: https://www.jpl.nasa.gov/images/pia17601-radiation-exposure-comparisons-with-mars-trip-calculation/
- [WP-armstrong] Wikipedia, Armstrong limit (secondary): https://en.wikipedia.org/wiki/Armstrong_limit
- [NASA-EMU] NASA, Extravehicular Mobility Unit fact sheet: https://www.nasa.gov/wp-content/uploads/2015/07/2019_07_ea_emu.pdf
