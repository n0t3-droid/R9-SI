// Build: bundle all sources into a single self-contained HTML file.
// Outputs dist/index.html (full document) and dist/artifact.html (body content for publishing).
const fs = require('fs'), path = require('path');
// syntax gate: every source file must compile, or the build stops with the file and the line (a script that does not
// parse would silently switch off a whole part of the game or the Studio)
{
  const vm = require('vm');
  for (const dir of ['src/shared', 'src/main', 'src/studio', 'src/worker', 'src/ui']) {
    const full = require('path').join(__dirname, dir); if (!require('fs').existsSync(full)) continue;
    for (const f of require('fs').readdirSync(full)) {
      if (!/\.js$/.test(f)) continue;
      try { new vm.Script(require('fs').readFileSync(require('path').join(full, f), 'utf8'), { filename: dir + '/' + f }); }
      catch (e) { console.error('SYNTAX ERROR in ' + dir + '/' + f + ': ' + e.message + '\n' + String(e.stack || '').split('\n').slice(0, 3).join('\n')); process.exit(1); }
    }
  }
}
const ROOT = __dirname;
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const SHARED = ['core', 'folkanim', 'noise', 'registry', 'models', 'voxarch', 'voxtech', 'voxlife', 'voxcity', 'voxhome', 'voxmodel', 'voxcells', 'voxfurn', 'voxfacade', 'blocks1', 'blocks2', 'blocks3', 'blocks_heart', 'blocks5', 'blocks6', 'voxmodern', 'blocks4', 'items', 'groceries', 'biomes', 'gen_common', 'gen_overworld', 'gen_realm', 'shipgen', 'starship', 'gen_village', 'gen_city', 'gen_modern', 'gen_plan', 'gen_villa', 'gen_villa_rooms', 'gen_rails', 'gen_citadel', 'gen_heart', 'gen_temple', 'gen_isles', 'gen_canyon', 'gen_hills', 'gen_station', 'lod', 'gen_dims', 'light_local', 'mesher', 'physics', 'custom', 'style', 'edits', 'mirror', 'forge', 'forge_kit', 'forge_tower', 'forge_house', 'forge_bridge', 'forge_civic', 'forge_park'];
const TEX = ['tex_core', 'tex_recipes1', 'tex_recipes2', 'tex_recipes3', 'tex_recipes4', 'tex_recipes5', 'tex_recipes6', 'tex_items', 'tex_groceries', 'tex_vox', 'tex_layout', 'tex_build'];
const MAIN = ['gl', 'shaders', 'renderer', 'horizon', 'zeit_rec', 'world', 'weather', 'env', 'input', 'place', 'player', 'storage', 'audio', 'ambience', 'particles', 'trails', 'trams', 'icons', 'voxmodels', 'entities', 'sim', 'crafting', 'gadgets', 'blueprints', 'mirrorbuild', 'starships', 'cockpit', 'traffic', 'villagers', 'folkmodel', 'villages', 'folklife', 'folkacts', 'festival', 'homes', 'shop', 'director', 'codex', 'map', 'net', 'mp', 'favs', 'pack', 'landing', 'ui', 'tex_cache', 'game', 'start', 'zeitraffer'];
// the UI both pages share (W1), before ui.js / studio.js: the languages first — the module and the game's two tables
// (de, en; the start screen's words are in them too) are there before any text is drawn — then r9si.ui (Einfach /
// Profi), the hints, the Ding cards, the tiles
const LANG = ['i18n', 'lang_en', 'lang_de'];
const UI_SHARED = ['uiprefs', 'hints', 'ding', 'tiles'];
const exists = (p) => fs.existsSync(path.join(ROOT, p));
const js = (dir, list) => list.filter(f => exists(`src/${dir}/${f}.js`)).map(f => `/* ${dir}/${f}.js */\n` + read(`src/${dir}/${f}.js`)).join('\n');
const shared = js('shared', SHARED);
const workerSrc = shared + '\n' + js('main', TEX) + '\n' + read('src/worker/worker_main.js');
// the texture cache's key (tex_cache.js): a hash of the worker's bundle (the shared code the block registry and the
// recipes come from, the recipes, the forge) and of the cache itself. Any change there forges the textures again, once;
// a change on the main thread alone (the UI, the game's own logic) keeps the cached textures.
const texHash = require('crypto').createHash('sha256').update(workerSrc).update(js('main', ['tex_cache'])).digest('hex').slice(0, 16);
const uiShared = js('main', LANG) + '\n' + js('shared', UI_SHARED);
const mainSrc = shared + '\n' + js('main', TEX.filter(t => t !== 'tex_build')) + '\n' + `VR.TEX_SRC_HASH = "${texHash}";\n` + uiShared + '\n' + js('main', MAIN) + `
window.addEventListener('load', function () { try { VR.game = new VR.Game(); VR.game.boot(); } catch (e) { console.error(e); document.body.insertAdjacentHTML('beforeend', '<pre style="color:#f88;position:fixed;top:0;left:0;z-index:99">' + (e && e.stack || e) + '</pre>'); } });
`;
const css = read('src/ui/style.css') + '\n' + (exists('src/ui/start.css') ? read('src/ui/start.css') : '');
const guard = (s) => s.replace(/<\/script/gi, '<\\/script');
const fonts = `<style>${read('src/ui/fonts/game_fonts.css')}</style>`;   // embedded (OFL): no request to Google's servers leaves the player's browser
// 📜 Rechtliches — Impressum, Datenschutz, Credits, Hinweis: one overlay with its styles for the game and the Studio
// (VR.Legal.open(section)); in the game before its own scripts, so its Esc comes first
const legal = `<style>${read('src/ui/legal.css')}</style>\n<script>${guard(read('src/main/legal.js'))}</script>`;
const body = `<div id="app"><canvas id="gl" tabindex="0"></canvas><div id="ui"></div></div>
<script type="text/js-worker" id="worker-src">${guard(workerSrc)}</script>
${legal}
<script>${guard(mainSrc)}</script>`;
const head = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><title>R9-SI</title>${fonts}<style>${css}</style>`;
fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist/index.html'), `<!doctype html>\n<html lang="en"><head>${head}</head><body>${body}</body></html>\n`);
// the published page can't hand out files: drop the direct-download branch there (screenshots still show in an overlay)
const bodyArtifact = body.replace(/\/\*DL\*\/[\s\S]*?\/\*\/DL\*\//g, '');
fs.writeFileSync(path.join(ROOT, 'dist/artifact.html'), `<title>R9-SI</title>${fonts}<style>${css}</style>\n${bodyArtifact}\n`);
// ---- the Model Studio: the live catalogue + editor page. Main thread: registry, model language, furniture and facade
// packs, the VX material textures. Worker (the game's own worker + a studio extension): block textures, whole
// catalogue houses built with the villa generator, lit and meshed with the game's mesher.
const STUDIO_MAIN = ['core', 'noise', 'registry', 'models', 'voxarch', 'voxtech', 'voxlife', 'voxcity', 'voxhome', 'voxmodel', 'voxcells', 'voxfurn', 'voxfacade', 'blocks1', 'blocks2', 'blocks3', 'blocks_heart', 'blocks5', 'blocks6', 'voxmodern', 'blocks4', 'items', 'groceries', 'physics', 'custom', 'style', 'edits', 'schem', 'forge', 'forge_kit', 'forge_tower', 'forge_house', 'forge_bridge', 'forge_civic', 'forge_park'];
const studioLibs = js('shared', STUDIO_MAIN) + `\nVR.TEXREC = VR.TEXREC || {}; VR.TEXPRE = VR.TEXPRE || {};\n` + js('main', ['tex_core', 'tex_vox', 'icons', 'place', 'storage', 'favs', 'pack', 'landing']) + '\n' + uiShared;   // (uiShared: the language module and its tables — the choice is shared with the game)
const studioWorkerSrc = shared + '\n' + js('main', TEX) + '\n' + read('src/worker/worker_main.js') + '\n' + read('src/studio/studio_worker.js');
const furnSrc = read('src/shared/voxfurn.js') + '\n' + read('src/shared/voxfacade.js') + '\n' + read('src/shared/voxmodern.js');
const notes = exists('src/studio/notes.md') ? read('src/studio/notes.md') : '';
const studioCss = read('src/studio/studio.css') + '\n' + (exists('src/ui/start.css') ? read('src/ui/start.css') : '');
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const studioFonts = `<style>${read('src/ui/fonts/studio_fonts.css')}</style>`;   // embedded (OFL), see src/ui/fonts/LICENSES.md
const studioBody = `<div id="studio" class="boot">
<header>
  <div class="brand"><span class="sig">R9</span><span class="t">MODEL STUDIO</span><span class="v">v4.0<!--PLAYTAG--></span></div>
  <div id="tiles"></div>
  <div id="navCrumb"></div>
  <div id="proSwitch" class="proswitch"></div>
  <nav class="modes"><button data-hub class="hubm" title="Weitermachen — alles, was du angefangen hast (Strg+O)"><i>🕘</i>Weitermachen<b class="hubN"></b></button><button data-mode="arch" class="on"><i>◈</i>Architektur</button><button data-mode="furn"><i>▣</i>Möbel</button><button data-mode="facade"><i>▤</i>Fassade</button><button data-mode="parts" title="Alle Blöcke des Spiels: Dächer, Licht, Fenster, Türen, Wände, Böden … mit ★ Favoriten"><i>🧱</i>Teile</button><button data-mode="craft" class="craftm"><i>⚒</i>Crafter</button><button data-mode="world" class="worldm"><i>◍</i>Welt</button><button data-create class="createm" title="Ein Haus aus dem Baukasten, alles Mögliche vom Genie, Bilder als Blöcke — alles hier, ohne Konto"><i>✨</i>Erschaffen</button></nav>
  <!--GAMELINK-->
  <div class="sys"><span class="dot" id="sysDot"></span><span id="sysText">boot</span></div>
</header>
<div id="bars"></div>
<aside id="left">
  <div class="search"><span class="ico">⌕</span><input id="search" placeholder="Suchen …" autocomplete="off" spellcheck="false"><kbd>/</kbd></div>
  <div id="chips"></div>
  <div id="crumb"></div>
  <div id="list"></div>
</aside>
<main>
  <canvas id="view"></canvas>
  <div id="hud"><div class="name" id="hudName">—</div><div class="mono" id="hudMeta"></div></div>
  <div id="houseTools"></div>
  <div id="viewTools">
    <div class="grp"><button data-face="0" class="on">N</button><button data-face="1">E</button><button data-face="2">S</button><button data-face="3">W</button></div>
    <div class="grp"><button id="gridT" class="on" title="Raster">▦</button><button id="texT" title="Ohne Textur (reine Form)">◻</button><button id="rot" title="Drehteller">↻</button><button id="invY" title="Maus hoch/runter umkehren (Ansicht ziehen)">⇅</button><button id="sensT" title="Maus-Tempo">🖱</button><button id="home" title="Ansicht zurücksetzen">⌂</button></div>
  </div>
  <div id="boot"><div class="logo">R9</div><div class="log" id="bootLog"></div><div class="bar"><i id="bootBar"></i></div></div>
</main>
<aside id="right">
  <div class="tabs"><div class="tab on" data-pane="parts">Bausteine</div><div class="tab pro" data-pane="edit">Quelle</div><div class="tab pro" data-pane="filePane">Datei</div><div class="tab pro" data-pane="notesPane">Log</div><div class="tab pro" data-pane="help">Sprache</div><button class="proT" title="Werkzeuge für Entwickler: Modell-Quelle, ganze Datei, Log, Modell-Sprache">⚙ Profi</button></div>
  <div class="pane on" id="parts"><div id="partsBody" class="empty">Wähle links ein Haus oder ein Modell.</div></div>
  <div class="pane" id="edit"><textarea id="src" spellcheck="false"></textarea><div class="row"><button id="run" class="pri">▶ Ausführen</button><button id="copy">Kopieren</button><span id="msg"></span></div></div>
  <div class="pane" id="filePane"><textarea id="file" spellcheck="false"></textarea><div class="row"><button id="runAll" class="pri">▶ Ganze Datei ausführen</button><span class="hint">Zum Ausprobieren: Änderungen gelten nur hier in diesem Browser.</span></div></div>
  <div class="pane" id="notesPane"><pre id="notes">${esc(notes)}</pre></div>
  <div class="pane" id="help"><pre id="helpText"></pre></div>
</aside>
</div>
<script type="text/js-worker" id="worker-src">${guard(studioWorkerSrc)}</script>
<script>${guard(studioLibs)}</script>
${legal}
<script>window.__FURN_SRC = ${JSON.stringify(furnSrc).replace(/<\/script/gi, '<\\/script')};</script>
<script>${guard(read('src/studio/studio.js'))}</script>
<script>${guard(read('src/studio/icons.js'))}</script>
<script>${guard(read('src/studio/projects.js'))}</script>
<script>${guard(read('src/studio/crafter.js'))}</script>
<script>${guard(read('src/studio/player.js'))}</script>
<script>${guard(read('src/studio/world.js'))}</script>
<script>${guard(read('src/studio/worldstyle.js'))}</script>
<script>${guard(read('src/studio/colors.js'))}</script>
<script>${guard(read('src/studio/workbench.js'))}</script>
<script>${guard(read('src/studio/housekit.js'))}</script>
<script>${guard(read('src/studio/genie_brain.js'))}</script>
<script>${guard(read('src/studio/genie.js'))}</script>
<script>${guard(read('src/studio/genie_site.js'))}</script>
<script>${guard(read('src/studio/imagine.js'))}</script>
<script>${guard(read('src/studio/catalog.js'))}</script>
<script>${guard(read('src/studio/modern.js'))}</script>
<script>${guard(read('src/studio/forge.js'))}</script>
<script>${guard(read('src/studio/variants.js'))}</script>
<script>${guard(read('src/studio/spawn.js'))}</script>
<script>${guard(read('src/studio/space.js'))}</script>
<script>${guard(read('src/studio/bridge.js'))}</script>
${['nav', 'start'].filter(f => exists('src/studio/' + f + '.js')).map(f => `<script>${guard(read('src/studio/' + f + '.js'))}</script>`).join('\n')}`;
const studioHead = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>R9 Model Studio</title>${studioFonts}<style>${studioCss}</style>`;
// two studios: studio.html sits next to the game (same origin → "Update ins Spiel" lands directly in the game; a link back
// to the game), studio_artifact.html is the standalone published Model Studio (export / import bridge)
// (W1: the ▶ tile in the header is the play button, #playBtn — src/studio/start.js gives it the id in the Studio that belongs to the game)
const inGame = studioBody.replace('<!--PLAYTAG-->', ' · ▶ Spielen').replace('<script type="text/js-worker"', '<script>window.__R9_IN_GAME = true;</script>\n<script type="text/js-worker"');
// the standalone Studio is its own artifact (another web origin, its own storage): it says so, and knows where the game is
const GAME_URL = 'https://claude.ai/artifact/EP9fJV6R8Grw4ev5RVUP4r';
const standalone = studioBody.replace('<!--PLAYTAG-->', '').replace('<script type="text/js-worker"', `<script>window.__R9_STANDALONE = true; window.__R9_GAME_URL = '${GAME_URL}';</script>\n<script type="text/js-worker"`);
fs.writeFileSync(path.join(ROOT, 'dist/studio.html'), `<!doctype html>\n<html lang="de"><head>${studioHead}</head><body>${inGame}</body></html>\n`);
// (the charset first: a host that serves the page as it is — not wrapped in its own document — still reads it as UTF-8)
fs.writeFileSync(path.join(ROOT, 'dist/studio_artifact.html'), `<meta charset="utf-8"><title>R9 Model Studio</title>${studioFonts}<style>${studioCss}</style>\n${standalone}\n`);
if (exists('dist/studio_index.html')) fs.unlinkSync(path.join(ROOT, 'dist/studio_index.html'));
const kb = (f) => (fs.statSync(path.join(ROOT, f)).size / 1024).toFixed(0) + ' KB';
console.log('built dist/index.html', kb('dist/index.html'), '· artifact.html', kb('dist/artifact.html'), '· studio.html', kb('dist/studio.html'), '· studio_artifact.html', kb('dist/studio_artifact.html'));
