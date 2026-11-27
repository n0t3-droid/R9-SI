# R9-SI Lab

**Das Testlabor von R9-SI.** Hier wird ausprobiert, gemessen und gesucht, bevor etwas ins Spiel kommt. Es läuft in
node, ohne Browser, außer dem PC-Emulator. Es benutzt genau den Code, den auch das Spiel benutzt (`src/shared`).

| Teil | Wozu |
|---|---|
| **Weltlabor** (`lab.js map / iso / compare / places`) | Jeden Ort jeder Welt von oben oder schräg zeigen, in den echten Blockfarben. Zwei Generator-Versionen nebeneinander vergleichen. |
| **Spürhunde** (`lab.js scan`, `detect/`) | Viele Welten automatisch nach Fehlern absuchen: Erde auf der Straße, Löcher in der Fahrbahn, Laternen oder Hecken in der Fahrbahn, Türen, aus denen man nicht hinauskommt, Pflanzen auf Pflaster, ineinander gewachsene oder schwebende Baumkronen, die Himmelsbahn mitten durch einen Ort. |
| **Herkunft** (`lab.js why`) | Für einen Block sagen, welche Zeile des Generators ihn gesetzt hat (und was davor dort war). |
| **PC-Emulator** (`emu/run.sh`) | Das echte Spiel in einem Browser ohne Fenster laufen lassen, den Prozessor gebremst wie ein älterer PC. Bildzeiten, Ruckler, jede Entscheidung der Smart Quality und den Fehler ihrer Vorhersage aufzeichnen. Die Szene `pruef` startet den Prüfstand des Spiels. |
| **Prüfstand im Spiel** (`/prüfstand` im Chat) | Das Spiel belastet sich selbst mit bekannten Lastsprüngen (GPU, CPU, eine langsame Rampe) und misst, wie schnell und ruhig die Smart Quality antwortet — auf der echten Grafikkarte des Spielers. |
| **Zufallslabor** (`zufall/zufall.js`) | Tausende Zufallsproben am eigenen Code: dieselben Chunks zweimal und in anderer Reihenfolge, Wasserwände unter der Erde, Chunks bis 10⁹ Blöcke weit draußen, ähnliche Welten aus Nachbar-Keimen, Blocksuppen durch den Mesher, jeder Block einzeln vermessen, die Gesetze des Lichts, das Rauschen, zufällige Augen (wie viel die Grafikkarte zeichnen muss, wer es füllt, was hinter Hügeln liegt). Jede Probe lässt sich einzeln wiederholen (`--replay fam:nr`). |
| **Horizont** (`tools/horizon.js`, im Spiel `src/shared/hzcull.js`) | Welche Abschnitte hinter Hügeln liegen. Der Prototyp wurde zum Horizontschatten im Spiel, mit Beweistest (`test/hzcull.js`). |
| **Bericht** (`lab.js report`) | Alles als eine HTML-Seite mit Bildern; zwei Suchläufe (vorher, nachher) nebeneinander. |

```
node lab/lab.js places  --seed 3616214791 --at 294,-1044
node lab/lab.js compare --seed 3616214791 --vgen 21,22 --place Finkenbach --r 30 --px 8
node lab/lab.js iso     --seed 3616214791 --place Fliederfeld --view south
node lab/lab.js scan    --seeds 3616214791,1,12345 --vgen 21 --out lab/out/scan21.json
node lab/lab.js scan    --seeds 3616214791,1,12345 --vgen 22 --out lab/out/scan22.json
node lab/lab.js why     --seed 3616214791 --vgen 21 --at -895,67,-264
bash lab/emu/run.sh     --profiles office,old-laptop,potato --scenes town,sea,flight --seconds 30
node lab/zufall/zufall.js --fam gen-det,gen-water,mesh-fuzz,view --n 50 --out lab/out/zufall
node lab/zufall/zufall.js --fam gen-water --replay gen-water:1
node lab/lab.js report  --in lab/out/scan21.json,lab/out/scan22.json --emu lab/out/emu.json
```

Ergebnisse landen in `lab/out/`. Dieser Ordner wird nicht eingecheckt. Was die Spürhunde einmal gefunden haben und
behoben ist, prüfen Tests im normalen Testlauf weiter: `test/lab_roads.js` (Straßen, Türen, Pflanzen) und
`test/lab_rails.js` (die Bahn bleibt draußen).

**Ehrliche Grenzen des Emulators:** Gebremst wird der Prozessor (Chromes eigene CPU-Drosselung) des Hauptfadens der
Seite, nicht die Worker. Das Bild zeichnet SwiftShader in Software, die „Grafikkarte“ ist also auch der Prozessor; darum
ist das Bild klein (320 × 180, `EMU_W`/`EMU_H`). Die Zahlen vergleichen Builds und Profile miteinander — sie versprechen
nichts für einen bestimmten echten PC.

---

**The R9-SI test lab.** Things are tried, measured and searched for here before they go into the game. It runs in node,
without a browser, except for the PC emulator, and uses exactly the code the game uses (`src/shared`).

- **World lab:** show any place of any world from above or at an angle, in the real block colours, and compare two
  generator versions side by side.
- **Detectors:** scan many worlds for defects automatically: earth on the road, holes in a lane, lamps or hedges in a
  lane, doors you cannot walk out of, plants on paving, crowns of different trees grown into each other or floating, the
  sky rail running through a place.
- **Provenance:** for one block, the generator line that put it there (and what was there before).
- **PC emulator:** the real game in a headless browser, its processor slowed like an older PC; frame times, hitches,
  every Smart Quality decision and the error of its forecast. Honest limits: the throttling slows the page's main
  thread, not its workers; SwiftShader draws the picture in software, so the "graphics card" is the processor too —
  hence the small picture. The numbers compare builds and profiles; they promise nothing for a given real PC.
- **Test bench in the game:** `/prüfstand` in the chat puts known load steps on the player's own machine (GPU, CPU, a slow
  ramp) and times Smart Quality's answer; the emulator's scene `pruef` runs it headless.
- **Random lab:** thousands of random probes at the game's own code — the same chunk twice and in another order,
  water walls underground, chunks up to 10⁹ blocks out, look-alike worlds from neighbouring seeds, block soups through the
  mesher, every block measured alone, the light's local laws, the noise, random eyes (what the GPU must draw, who fills
  it, what lies behind hills). Every probe replays alone (`--replay fam:n`).
- **Horizon:** which sections lie behind hills; the prototype became the game's horizon culling (src/shared/hzcull.js)
  with its proof test (test/hzcull.js).
- **Report:** everything as one HTML page with pictures; two scans (before, after) side by side.

Results go to `lab/out/`, which is not checked in. What the detectors found once and is fixed stays checked in the
normal test run: `test/lab_roads.js` (roads, doors, plants) and `test/lab_rails.js` (the railway stays outside).
