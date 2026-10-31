# Namensbuch — die Namen von R9-SI (naming bible, n-names)

The one table is `VR.Names` (`src/shared/names.js`); the searches are recorded in `test/names.js` (NAMES, RETIRED),
the star names' block list in `test/star_names.js`. Names are **display only**: ids, save keys, block ids and the
generator versions never change, so an old save shows the new names at once.

---

## Für den Besitzer: das Namensbuch auf einer Seite (Deutsch)

**Die Regel.** Jeder Name klingt nach seiner Welt, ist leicht zu sagen (auch für Kinder), steht zuerst auf Deutsch, ist
unser eigener — und wurde gesucht: kein Markenname, keine berühmte Figur, kein Name aus einem anderen Spiel oder Film.
Kein Name steht für zwei Dinge.

**Der Himmel — die Edelsteinfamilie.** Die Sonne heißt **Helia**. Um sie kreist der Ringriese **Turmalin** (englisch
*Tourmaline*) — der „Regenbogenstein", der in vielen Farben vorkommt, wie die Bänder und Ringe des Riesen. Er ersetzt
„Amarant": so heißt eine Figur aus Final Fantasy IX, und das Englische hatte zwei Schreibweisen. Turmalins Monde und
Geschwister sind Steine und Farben: **Herzwelt** (unsere Heimat), ihr Mond **Aquamarin**, dazu **Zinnober**, **Opal**,
**Basalt**, **Ocker**, der heiße **Bernstein**, der Eisriese **Cölestin** und der **Trümmerschwarm**. Die vier Nebel:
**Rosenschleier, Glutwiege, Türkisherz, Lichtwiege**. Die Sterne der Nachbarschaft bekommen weiche Namen aus eigenen
Silben (*Sellaenor, Feldalan, Vinaeven*) — Wörter wie „Ussr" oder „Nemo" kann es nicht mehr geben.

**Die Völker — jedes hat seinen eigenen Klang.**
| Volk | Welt | Klang | so heißen sie |
|---|---|---|---|
| die Herzweltler | Herzwelt | warm, heimelig, märchenhaft deutsch | Greta Lindenblatt, Hannes Moosbach; Kinder: Fips, Lenchen; Ältere: Adelheid, Bertram |
| **Wellari** | Aquamarin | weich und fließend wie Wellen auf Sand (l, m, n, w, s) | Mirel Shavenor, Sharuel Iosira; Kinder: Nawi, Mali; Ältere: Milune, Orithamar |
| **Dunelin** | Ocker | warm und erdig wie Schritte auf warmem Sand (d, b, m, r, k, h) | Dukar Duoshir, Omrin Tadunar; Kinder: Zabu, Haki; Ältere: Hakemar |
| **Glimari** (neu, statt Glutani) | Zinnober | hell und knisternd wie Funken über Glut (f, l, r, s, t, k) — von „glimmen" | Arkai Tevash, Tevio Varenn; Kinder: Fiki, Rizi; Ältere: Solvaris |
| **Regoli** | Basalt | tief und rund wie ein Summen in der Steinkuppel (m, n, g, d, b) | Mogon Bemund, Gomun Gubel; Kinder: Molo, Bulo; Ältere: Gundor |
| **Isveli** (neu, statt Nivari) | Opal | klar und hell wie Frost auf Glas (s, v, l, k, y) — von „Eis" | Ylvie Sildal, Silvie Lyvik; Kinder: Seli, Lyli; Ältere: Nisyren |

„Glutani" fand der Kritiker als Wort eines Fan-Wikis, „Nivari" ist nah an „Nivarians" (eine Spezies auf World Anvil) und
an „Sylvari". Die Sprecherinnen und Sprecher der Geschichte bleiben, wie die Geschichte sie liebt: **Funke, Lumi,
Meisterin Ilka, Kapitän Jonte, Oskar, Selma, Opa Anselm, Solgani, Ariveli, Selkatun, Dumarin, Ylosenis, Flimmi, Echo.**

**Jeder Dorfbewohner hat einen Vor- und Familiennamen**, Kinder und Ältere klingen anders als die Großen: Kinder
kurz und singend (Fips, Nawi, Fiki), Ältere lang und würdig (Adelheid, Orithamar, Solvaris). Jedes Volk hat über
2000 verschiedene volle Namen; kein Name kommt in zwei Völkern vor.

**Die Orte.** Herzwelts Dörfer heißen jetzt deutsch nach Baum, Blume, Vogel oder Licht und einem Wort des Landes:
**Lindenau, Mohnbrunn, Lerchenhain, Kirschdorf, Finkenberg** (statt „Brightwater", „Oakhaven"). Die Dörfer der Völker
heißen in deren Sprache: *Vesela* (Wellari), *Rubotob* (Dunelin), *Orliskesh* (Glimari), *Dogolmund* (Regoli),
*Lyraskel* (Isveli).

**Kleinigkeiten.** Ein Glimmerfuchs hieß „Funke" oder „Lumi" — jetzt **Flämmchen** und **Leuchti** (die Namen gehören
den Figuren der Geschichte).

**Geblieben, mit Grund.** *Nova Haven* und *Weißstadt* (die Städte des Trailers), *Ringstation*, *Heliataler*,
*Wolkenrochen*, die Außenposten (Nordwiese, Kupferhang …), die Schiffsfarben — alle schon gesucht und gut.

---

## 1 · How it works (for developers)

- **Renames** — `VR.Names.RENAME` maps an old display word to the new one per language (`Amarant(s)` → `Turmalin(s)`,
  `Amaranth`/`Amarant` → `Tourmaline`, `Glutani` → `Glimari`, `Nivari` → `Isveli`). `VR.I18N.add` runs
  `VR.Names.fixTable` on every table it is given, and `tx()`/`t()` run `VR.Names.fixText` on the fallback texts written
  at a call. So the lang tables keep their old lines for now and a parallel front's new line with an old word still
  shows the new name; a later sweep can rewrite the source lines (`test/names.js` §6 proves no table value shows an old
  word). The data names are changed at the source: `universe.js` (the giant), `worldeco.js` (the two peoples).
- **Peoples** — `VR.Names.PEOPLES[kind]`: Herzwelt (`herz`) has hand lists (`first`, `kids`, `elders`, `sur`); the five
  native peoples (`aqua`, `ocker`, `zinn`, `basalt`, `opal`) have a head set `A` (disjoint between peoples, so no
  two peoples share a name) and tails: `B` grown-ups, `K` children, `E` elders, `F` families, `L` places. Heads end in
  a vowel or a soft consonant, tails begin with a consonant: every join is easy to say; a stutter (Ve·veliar) is
  drawn again. `VR.Names.pool(kind)` → `{first, kids, elders, sur}` (48/24/24/32 natives, cached, deterministic);
  `WorldEco.names` and `WorldEco.word` speak through it; `villages.js` gives elders their own names.
- **Villages of Herzwelt** — `VR.Names.village(seed)` = one of 30 heads (Linden, Rosen, Mohn, Lerchen …) + one of 20
  land words (au, bach, brunn, hain, tal, furt …): ~600 names, one form in both languages (a town keeps its name).
- **Stars** — `VR.Names.star(seed)`: a soft onset + a consonant + a vowel + an ending (4–11 letters), drawn from the
  system's own seed after galaxy.js's old draw (which still runs, so the systems — binaries, planets — stay the same).
- **Never generated** — `VR.Names.blocked(w)`: famous characters of films, books, series and games, brands (incl. the
  German children's classics: Pumuckl, Pippi, Ronja, Momo, Jim Knopf …), rude or cruel words in German and English as
  substrings, and galaxy.js's block list. `VR.Names.reserved(w)`: the story's speakers, the sky's bodies, the peoples,
  the outposts, the nebulae — no villager, pet or star is called like them.
- **Cost** — no per-frame work. Pools and village names: < 0.1 ms once. Star names: +16 ms once per neighbourhood
  (Galaxy.build is cached per seed; 34 → 50 ms in node) — on every preset, Very Low included, once.

## 2 · The sound of each people (the story behind the names)

| kind | people | heads (A) | grown-ups (B) | children (K) | elders (E) | families (F) | places (L) |
|---|---|---|---|---|---|---|---|
| aqua | Wellari — the shell folk of the islands; „Welle", wave | Li Ma Ne Wa Sa Mi Lu Na Ise Ari Ela Ori Sha The Ve Io | wen rel lia mar sel na rin lis ruel sa mira wa | li mi lu ni po wi | mareth veliar thamar meriel sorine lune wanne resa | nami rasel loweth marin shalu venor wellin sira | mar lune wel sela thal nore |
| ocker | Dunelin — the earth folk of the dunes; „Düne" | Da Du Ba Bo Ka Ko Ru Mu Ra Ha Ho Ta Za Om Ur Ame | rin mar dun bek sim hal kar tem ra nu bo rik | bu ko mo ti pu ki | mirun barak hadem oruk kemar sabir tumar dahar | bekar dunar hadin oshir rumab kesim talun barun | kar dun mesa barra hum tob |
| zinn | Glimari — the ember folk of the sulfur plains; „glimmen" | Fi Fa Ri So Te Va Zi Ar Or Gli Fla Ti Pi Sol Kir Tal | ra ven kan lis ro zar fen tari lo kai vio sen | fi ki zi pi ti pa | ombar varis elgor riska koran tefar sulvan farion | vash korr fell rast tix renn zarin lohr | flar zor kesh rion vel fira |
| basalt | Regoli — the dome folk of the craters; „Regolith" | Re Ro Go Gu Mo Do Be No Nu Lo Tu Ul Bu Gom Dro Mur | mun dor bel gon mo lun kum rod tun bo nem gol | bo mu po pu nu lo | moram undor belkun gorrel umbor degon tarun lomund | dom gor mund bel rod goth berun kolm | krat dom mund olm ruk bom |
| opal | Isveli — the frost folk of the ice; „Eis" | I Is Ve Vi Sel Sil Ly Yl Fe Ni Ki Se Ys El Sy Eli | vi ka sen lin ris vel ya fen kis vie ra sil | li fi pi ni ki sy | velvar syren sande korvel skil vane lisvin frida | vik fjel sen dal skar kel lind vist | frost krist ven lys mir skel |

Herzwelt's folk: given names old-fashioned and North-German-soft (Alma, Hannes, Fenja, Tjark, Wendelin); children by
pet names (Bommel, Fips, Lenchen, Wichtel); elders by the grandparents' names (Adelheid, Hubertus, Ottilie); families
after the land round their houses (Lindenblatt, Moosbach, Heckenrose, Zaunkönig). Names that are famous characters were
left out on purpose (Bruno — Encanto, Linus — Peanuts, Wilma — the Flintstones, Lotte/Lotti, Fiete — a children's app,
Moritz, Hedwig, Hermine, Momo, Ronja, Pumuckl …).

## 3 · What changed and why

| was | now | why (search 2026-10-31, test/names.js) |
|---|---|---|
| Amarant / Amaranth | **Turmalin / Tourmaline** | a Final Fantasy IX character; two English spellings (R54-13, R55-14); „Malvara" ≈ Pokémon's Malva and a Nickelodeon „Malvaron", „Kronalis" ≈ Kronus (Warhammer) — set aside |
| Glutani | **Glimari** | a fan wiki's word (R55-14); „Lohari" ≈ Lohri, a harvest festival — set aside |
| Nivari | **Isveli** | „Nivarians" (World Anvil), ≈ Sylvari (R55-14) |
| Brightwater, Oakhaven … (English) | **Lindenau, Mohnbrunn …** | German first; „Copperfield", „Nightingale" in the old surname list |
| villagers Mira, Opal, Nova, Sol, Vesper, Kael, Juno … | the Herzwelt lists above | Mira and Vega are stars, Opal a moon, Vesper a film character, Kael a game character; „Wiggles", „Tink" (kids) brands/characters |
| star names Ussr, Paul, Grosklan … | soft names | rude or real words could come out of the old syllables |
| the glimmer fox „Funke", „Lumi" | **Flämmchen, Leuchti** | the companion's and Lumi's names |

## 4 · Next (not done here)

- A codex page „Völker" in the game (today the names live in the talk card, the bubbles and the toasts).
- Sweep the old words out of the lang source lines once the parallel fronts have merged (the display is already right).
- Echo (the oldest beacon's voice) is also a common word and a hero's name in a shooter: kept — the story loves it;
  watch it if the owner wants a name of our own.
