<p align="center"><img src="docs/media/banner.jpg" alt="R9-SI — eine Voxelwelt im Browser" width="100%"></p>

<p align="center"><b>A whole voxel world in one HTML file.</b> Kostenlos · free · open source · no install.</p>

<p align="center">
<a href="https://n0t3-droid.github.io/R9-SI/"><img src="docs/media/btn_play.svg" alt="Jetzt spielen · play in your browser" height="50"></a>
<a href="https://github.com/n0t3-droid/R9-SI/releases/latest/download/R9-SI.html"><img src="docs/media/btn_download.svg" alt="R9-SI.html herunterladen · download" height="50"></a>
<a href="docs/R9-SI_Mathematik_und_Physik.pdf"><img src="docs/media/btn_book.svg" alt="Mathe-Heft · math book (PDF)" height="50"></a>
<a href="lab/README.md"><img src="docs/media/btn_lab.svg" alt="Das Labor · the lab" height="50"></a>
</p>

<p align="center">
<a href="https://github.com/n0t3-droid/R9-SI/tags"><img alt="Version" src="https://img.shields.io/github/v/tag/n0t3-droid/R9-SI?sort=semver&label=Version&color=0f8a8f"></a>
<a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/Lizenz-MIT-e0752f"></a>
<img alt="0 dependencies" src="https://img.shields.io/badge/Abh%C3%A4ngigkeiten-0-7a46c8">
<img alt="WebGL 2" src="https://img.shields.io/badge/WebGL-2-1b2130">
<a href="https://github.com/n0t3-droid/R9-SI/actions/workflows/pages.yml"><img alt="Pages" src="https://github.com/n0t3-droid/R9-SI/actions/workflows/pages.yml/badge.svg"></a>
</p>

<p align="center"><img src="docs/media/facts.svg" alt="1 HTML file · 0 install · 0 dependencies · 2 364 block types · 109 biomes · 176 657 lines · 691 tests · 327 formulas" width="720"></p>

Öffnen, und du bist in deiner Welt: kein Konto, kein Server, keine Installation. Alles darin ist eigener Code, von
Gelände und Städten bis Himmel, Wasser, Klang und Planetenbahnen.
*Open it and you are in your world: no account, no server, no install. Everything in it is our own code.*

## 🖼 Bilder · Gallery

<table>
<tr><td><img src="docs/media/shot_vista.jpg" alt="The arrival vista at the golden hour"></td><td><img src="docs/media/shot_isles.jpg" alt="The Sky Isles by day"></td></tr>
<tr><td><img src="docs/media/shot_pier.jpg" alt="Water at the pier: waves, refraction, fish"></td><td><img src="docs/media/shot_aurora.jpg" alt="Nova Haven at night"></td></tr>
<tr><td colspan="2"><img src="docs/media/shot_citadel.jpg" alt="The Spire Citadel at night"></td></tr>
</table>
<sub>Jedes Bild ist das Spiel selbst auf Ultra, ohne Nachbearbeitung · every picture is the game itself
(<a href="test/marketing_shots.mjs">test/marketing_shots.mjs</a>).</sub>

## ⚙️ So funktioniert's · How it works

```mermaid
flowchart TB
  subgraph W ["Web Worker · im Hintergrund · in the background"]
    direction LR
    seed(["Seed"]) --> gen["Generator<br/>Rauschen · Klima · Städte"] --> light["Licht<br/>Flutfüllung"] --> mesh["Mesher<br/>Quads · Surface Nets"]
  end
  subgraph M ["Hauptthread und GPU · main thread and GPU"]
    direction LR
    up["Upload<br/>Byte-Budget"] --> cull["Culling<br/>Höhlen · Horizont · Sichtfeld"] --> draw["Bild<br/>Schatten · Wasser · Himmel · ACES"] --> sq{"Smart Quality<br/>Vorhersage · UCB"}
    sq -. "Stufe ±" .-> draw
  end
  W -- "Meshes" --> M
```

<sub>Generation is versioned (`vgen`): a world regenerates byte-identical for ever. Long tour: <a href="docs/TECHNIK.md">docs/TECHNIK.md</a>.</sub>

## 📐 Mathe, die man sieht · Math you can see

Jede Formel steht so im Code, mit Datei. Jedes Diagramm ist aus dem Code oder aus Messungen gezeichnet
([`docs/media/make_charts.js`](docs/media/make_charts.js), Rohdaten [`zahlen.json`](docs/media/data/zahlen.json)).

### 🌄 Gelände · Terrain

<img src="docs/media/terrain_profile.svg" alt="A kilometre of terrain from the generator" width="720">

```math
h(x,z)=\frac{\sum_{i=0}^{n-1} p^{\,i}\, S_i\!\left(\lambda^{i} f x,\ \lambda^{i} f z\right)}{\sum_{i=0}^{n-1} p^{\,i}},\qquad p=\tfrac12,\ \ \lambda=2
```

<img src="docs/media/noise_octaves.svg" alt="Four noise octaves and their sum" width="720">

Jede Oktave hat ihren eigenen Keim, $`p`$ und $`\lambda`$ sind die Standardwerte · every octave has its own seed. → [`src/shared/noise.js`](src/shared/noise.js)

### 💡 Licht · Light

```math
L(\mathbf p)=\max\Bigl(E(\mathbf p),\ \max_{\mathbf q\sim\mathbf p} L(\mathbf q)-1-\varphi(\mathbf p)\Bigr),\qquad w=2^{12}s+2^{8}r+2^{4}g+b
```

Himmelslicht 15 fällt senkrecht, Blocklicht flutet in R, G, B zugleich; vier Bits je Kanal in einem 16-Bit-Wort.
*Sky light falls straight down, block light floods in three colours at once.* → [`src/shared/light_local.js`](src/shared/light_local.js)

### ⛰ Horizontschatten · Horizon culling

<img src="docs/media/horizon_map.svg" alt="The land round an eye, the hidden part darkened" width="720">

```math
T\ \text{verborgen}\iff\forall\beta\in B(T):\ \bigl[s^{\min}_\beta(T^{+\delta}),\ s^{\max}_\beta(T^{+\delta})\bigr]\subseteq I_\beta\!\left(O^{-\delta}\right)
```

```math
s=\frac{y-e_y}{\lVert (x,z)-(e_x,e_z)\rVert}\qquad\text{(Hangneigung vom Auge } e\text{ aus; slope seen from the eye)}
```

Pro Richtung $`\beta`$ die Hangneigungen, die näherer Boden verdeckt; Wände um $`\delta`$ geschrumpft, Ziele gewachsen:
das gilt dann für jedes Auge im Umkreis $`\delta`$. *Per direction the slopes nearer ground blocks; shrink the walls,
grow the targets, and the verdict holds for every eye within δ.* → [`src/shared/hzcull.js`](src/shared/hzcull.js) ·
Beweis · proof: [`test/hzcull.js`](test/hzcull.js)

<img src="docs/media/horizon.svg" alt="Share of quads behind hills, 18 random eyes" width="720">

### 🌈 Himmel und Bild · Sky and picture

<img src="docs/media/sky_tone.svg" alt="Rayleigh scattering and the ACES tone curve" width="720">

```math
\tau_R(\lambda)\propto\lambda^{-4},\qquad P_R(\theta)=\tfrac34\left(1+\cos^2\theta\right),\qquad P_M(\theta)=\frac{1-g^2}{\left(1+g^2-2g\cos\theta\right)^{3/2}},\ \ g=0.76
```

```math
f(x)=\frac{x\,(2.51x+0.03)}{x\,(2.43x+0.59)+0.14},\qquad D_{\mathrm{GGX}}(\mathbf h)=\frac{\alpha^2}{\pi\left((\mathbf n\cdot\mathbf h)^2(\alpha^2-1)+1\right)^2}
```

→ [`src/main/space_shaders.js`](src/main/space_shaders.js) · [`src/main/shaders.js`](src/main/shaders.js)

### 🎸 Klang · Sound

<img src="docs/media/sound.svg" alt="A plucked string and Eyring reverberation" width="720">

```math
y[n]=\rho\,\frac{y[n-N]+y[n-N-1]}{2},\qquad N=\frac{f_s}{f},\qquad \rho=\frac{10^{-3/(T_{60}f)}}{\cos(\pi f/f_s)}
```

```math
T_{60}=\frac{0.161\,V}{-S\ln(1-\bar\alpha)+4mV},\qquad \frac{V}{S}=\frac{\bar\ell}{4}
```

Saiten werden gezupft, nicht abgespielt; der Hall kommt aus 48 Strahlen vom Ohr in die Blöcke.
*Strings are plucked, not played back; the reverb comes from 48 rays cast from the ear.* → [`src/main/klangphys.js`](src/main/klangphys.js)

### 🪐 Bahnen · Orbits

<img src="docs/media/kepler.svg" alt="A transfer orbit, equal times sweep equal areas" width="720">

```math
\sqrt{\mu}\,\Delta t=\frac{\mathbf r_0\cdot\mathbf v_0}{\sqrt\mu}\,\chi^2C(z)+\left(1-\alpha r_0\right)\chi^3S(z)+r_0\,\chi,\qquad z=\alpha\chi^2,\quad \alpha=\frac{2}{r_0}-\frac{v_0^2}{\mu}
```

```math
C(z)=\frac{1-\cos\sqrt z}{z},\qquad S(z)=\frac{\sqrt z-\sin\sqrt z}{\sqrt{z^3}}
```

→ [`src/shared/universe.js`](src/shared/universe.js) · Sonne, Riesenplanet, Monde und Schiffe · sun, giant, moons and ships

### 🎛 Smart Quality

```math
\hat m(t+0.5\,\mathrm s)=a+b\,(t+0.5\,\mathrm s),\qquad z=\frac{\bar m_{\text{schnell}}-\bar m_{\text{langsam}}}{\sqrt{\sigma^2_{\text{langsam}}+1\,\mathrm{ms}^2}},\qquad \mathrm{UCB}_k=\bar r_k+c\sqrt{\frac{\ln N}{n_k}}
```

Das Spiel sieht teure Bilder kommen (Gerade durch 0,6 s), erkennt Überraschungen (z) und probiert die Stufe, die am
meisten verspricht (UCB1). *It sees slow frames coming, tells surprise from noise and tries the most promising rung.*
→ [`src/main/aqpredict.js`](src/main/aqpredict.js)

### 🧊 Eine Koordinate in 16 Bit · a coordinate in 16 bits

```math
\mathbf p=\frac{\mathbf a}{2048}-4,\qquad \mathbf a\in\{0,\dots,65535\}^3\quad\Rightarrow\quad \Delta p=\tfrac{1}{2048}\ \text{Block}
```

→ [`src/shared/mesher.js`](src/shared/mesher.js) · [`src/main/shaders.js`](src/main/shaders.js) · alle 327 Formeln · all
327 formulas: [**Mathe-Heft (PDF)**](docs/R9-SI_Mathematik_und_Physik.pdf)

## 📊 Gemessen · Measured

<img src="docs/media/gpu_costs.svg" alt="What a frame costs on a Ryzen APU at Ultra" width="720">

<img src="docs/media/town_quads.svg" alt="Who fills a town's geometry" width="720">

## ⬇ Alles kostenlos · Everything free

| | Was · what | Wo · where |
|---|---|---|
| ▶ | Spiel online · play online | [n0t3-droid.github.io/R9-SI](https://n0t3-droid.github.io/R9-SI/) |
| 🎮 | Spiel als eine Datei · the game as one file | [`R9-SI.html`](https://github.com/n0t3-droid/R9-SI/releases/latest/download/R9-SI.html) · [`play/`](play/) |
| 🛠 | Editor R9 Studio (.schem .nbt .litematic .vox .json) | [`R9-SI-Studio.html`](https://github.com/n0t3-droid/R9-SI/releases/latest/download/R9-SI-Studio.html) |
| 📦 | Alles in einem ZIP · everything zipped | [`R9-SI.zip`](https://github.com/n0t3-droid/R9-SI/releases/latest/download/R9-SI.zip) · [alle Versionen · all versions](https://github.com/n0t3-droid/R9-SI/releases) |
| 📘 | Mathe-Heft, 33 Seiten · math book | [PDF](docs/R9-SI_Mathematik_und_Physik.pdf) · [Quelle · source](docs/math/r9si_mathematik.html) |
| 🧪 | Labor: Welten vermessen, Fehler finden · the lab | [`lab/`](lab/README.md) |
| 📈 | Rohdaten der Diagramme · the charts' data | [`zahlen.json`](docs/media/data/zahlen.json) · [`make_charts.js`](docs/media/make_charts.js) |
| 🧾 | Der ganze Quelltext · all the source | [ZIP](https://github.com/n0t3-droid/R9-SI/archive/refs/heads/main.zip) · MIT |

## 🔧 Selbst bauen · Build it yourself

```bash
git clone https://github.com/n0t3-droid/R9-SI && cd R9-SI
node build.js                 # → dist/index.html (game) · dist/studio.html (editor)
node test/hzcull.js           # one of 691 tests: ✓ / ✗ per check
bash test/regress.sh          # the release set (browser tests need Playwright)
```

Bauen braucht nur Node, kein `npm install` · building needs Node only. Mitmachen · contributing: [CONTRIBUTING.md](CONTRIBUTING.md) ·
alle Versionen · every release: [docs/CHANGELOG.md](docs/CHANGELOG.md)

## ⚖️ Rechtliches · Legal

**An independent work.** R9-SI and R9 Studio are an independent, non-commercial hobby project — an original voxel game
inspired by the block sandbox genre. They are not affiliated with, endorsed, sponsored or approved by any other game
company. NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT. Minecraft is a
trademark of Mojang. Impressum, privacy policy and credits: 📜 in the pause menu, the settings and the Studio's header.

**Files.** The Studio opens structures from WorldEdit / Amulet / Axiom (.schem), vanilla structure files (.nbt),
Litematica (.litematic), MagicaVoxel (.vox) and R9 Bauteile (.json), and exports .schem, .vox and .json.
NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT. WorldEdit, Amulet,
Axiom, Litematica, MCEdit and MagicaVoxel are names or trademarks of their respective owners, named only to describe
which files the Studio reads and writes. Share only what is yours — every export says so in one line. Code: [MIT](LICENSE).
