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
const SHARED = ['core', 'water_wave', 'wind', 'folkanim', 'folkcrowd', 'noise', 'registry', 'models', 'voxarch', 'voxtech', 'voxlife', 'voxcity', 'voxhome', 'voxmodel', 'voxcells', 'voxfurn', 'voxfacade', 'blocks1', 'blocks2', 'blocks3', 'blocks_heart', 'blocks5', 'blocks6', 'voxmodern', 'blocks_var', 'voxplants', 'voxnova', 'voxtown', 'blocks4', 'items', 'pets', 'groceries', 'biomes', 'gen_common', 'gen_overworld', 'gen_realm', 'shipgen', 'starship', 'cockpitkit', 'shipcabin', 'cabinkit', 'gen_village', 'gen_detail', 'gen_city', 'gen_hallcity', 'gen_modern', 'gen_plan', 'gen_villa', 'gen_villa_rooms', 'gen_nova', 'gen_rails', 'gen_citadel', 'gen_heart', 'gen_temple', 'gen_isles', 'gen_canyon', 'gen_hills', 'gen_station', 'gen_land', 'gen_vista', 'lod', 'stream', 'far', 'gen_dims', 'light_local', 'mesher', 'physics', 'custom', 'smoothvox', 'folksmooth', 'style', 'edits', 'looks', 'mirror', 'forge', 'forge_kit', 'forge_tower', 'forge_house', 'forge_bridge', 'forge_civic', 'forge_park', 'wonders', 'wonders_build', 'names_de', 'adventure', 'universe'];   // (u-orbit: VR.Universe — the orbits, skies and charts, main thread and workers)
const TEX = ['tex_core', 'tex_recipes1', 'tex_recipes2', 'tex_recipes3', 'tex_recipes4', 'tex_recipes5', 'tex_recipes6', 'tex_items', 'tex_groceries', 'tex_vox', 'tex_layout', 'tex_mat', 'tex_build', 'tex_hi'];
const MAIN = ['gl', 'gpuprof', 'light2', 'sky3', 'water_fx', 'shaders', 'skybodies', 'clouds', 'props', 'props2', 'ultralite', 'ipu', 'tex_pbr', 'renderer', 'light2_gl', 'sky3_gl', 'horizon', 'farring', 'zeit_rec', 'world', 'weather', 'env', 'wet', 'binds', 'pad', 'input', 'place', 'presence', 'player', 'storage', 'klang', 'audio', 'ambience', 'particles', 'airlife', 'trails', 'vents', 'trams', 'icons', 'voxmodels', 'peace', 'entities', 'landlife', 'sim', 'crafting', 'flight', 'gadgets', 'blueprints', 'baustelle', 'wonders_game', 'mirrorbuild', 'starships', 'cockpit', 'cabin', 'traffic', 'lifekit', 'padlife', 'villagers', 'folkmodel', 'villages', 'companions', 'crowd', 'folklife', 'folkacts', 'hangarflight', 'hall', 'festival', 'homes', 'folkjoy', 'shop', 'director', 'codex', 'map', 'net', 'mp', 'favs', 'pack', 'landing', 'inventions', 'bench', 'sweep', 'settings_reg', 'motion', 'folkgpu', 'lifedirector', 'wildsim', 'wildgpu', 'wildlife', 'wowmoment', 'settings_panel', 'touch', 'ui', 'liveloop', 'tex_cache', 'game', 'start', 'first', 'titlescene', 'photomode', 'invent', 'bauhand', 'wizard_game', 'zeitraffer', 'adventure'];
SHARED.splice(SHARED.indexOf('gen_dims'), 0, 'dimreg');   // u-dims: the dim registry (src/shared/dimreg.js, VR.DimReg) before the generators
MAIN.splice(MAIN.indexOf('game'), 0, 'travel');   // u-dims: VR.Travel (src/main/travel.js) — trips between the worlds of a save, the gates, Heimkehr
MAIN.splice(MAIN.indexOf('game'), 0, 'newlife');   // u-home: VR.NewLife (src/main/newlife.js) — one home on any world, 🌍 Herzwelt one click away, Heimkehr in a moment
MAIN.splice(MAIN.indexOf('lifedirector'), 0, 'eventlog');   // e-log: VR.EventLog (src/main/eventlog.js), the never-boring measure
SHARED.push('bodytex'); MAIN.push('space_shaders', 'spacescene');   // u-space0: the bodies' textures (main and workers), the space scene (after game.js: it wraps two of its methods)
SHARED.push('planetlod'); MAIN.push('planetlod_gl');   // u-orbitlod: the planet tiles (the job in the workers, the GL after the space scene)
MAIN.splice(MAIN.indexOf('photomode') + 1, 0, 'funke');   // e-funke: VR.Funke (src/main/funke.js), the companion drone
MAIN.push('quests');   // a-quests: VR.Quests (src/main/quests.js) — after adventure.js and photomode.js, whose parts it wraps (shop.js is listed already)
SHARED.splice(SHARED.indexOf('blocks4'), 0, 'bodies'); SHARED.splice(SHARED.indexOf('gen_dims') + 1, 0, 'gen_body'); TEX.splice(TEX.indexOf('tex_items'), 0, 'tex_body');   // u-moons1: the bodies' profiles and blocks (before blocks4 closes the registry), their generator, their textures
MAIN.splice(MAIN.indexOf('space_shaders'), 1); MAIN.splice(MAIN.indexOf('shaders'), 0, 'space_shaders'); MAIN.push('bodysky', 'bodylife');   // u-moons1: the space GLSL before shaders.js (its COMMON takes the airless sky from it), the moons' sky and life
MAIN.splice(MAIN.indexOf('settings_panel'), 0, 'directorcam', 'intent', 'ctx', 'hudfade');   // e-ctx: the travel camera, travel by intent, the Aktion key, the fading HUD (src/main/)
MAIN.push('ascent', 'spaceflight', 'entry');   // u-ascent: the climb, space, the way down (after the space scene: they draw with it and wrap the play frame after it)
MAIN.push('cruise');
SHARED.push('galaxy'); MAIN.push('starjump', 'starmap');   // u-stars: VR.Galaxy (src/shared/galaxy.js, after universe), the Sternensprung and the other systems (starjump.js), the star map (starmap.js)   // u-cruise: the Reiseantrieb between the worlds, the descent into a moon's world, the Konvoi (src/main/cruise.js)
SHARED.splice(SHARED.indexOf('blocks4'), 0, 'foeblocks'); MAIN.push('foemodels', 'foes', 'liberate');   // a-foes: the Leuchtfeuer (appended last, after the bodies' blocks), the foes' models, VR.Foes, VR.Liberate (after quests.js and ctx.js, whose parts they use)
SHARED.splice(SHARED.indexOf('blocks4'), 0, 'voxhangar');   // t-hangar: the Hangar Hall's and the Gate Temple's pieces (vgen 14), the last blocks
SHARED.splice(SHARED.indexOf('blocks4'), 0, 'bodies2'); SHARED.splice(SHARED.indexOf('gen_body') + 1, 0, 'gen_body2'); MAIN.splice(MAIN.indexOf('bodysky'), 0, 'atmo_lut'); MAIN.push('bodylife2');   // u-moons2: Zinnober's blocks (after t-hangar's), the three new kinds, the air LUTs, their life
SHARED.splice(SHARED.indexOf('blocks4'), 0, 'fields_blocks'); SHARED.splice(SHARED.indexOf('gen_body2') + 1, 0, 'gen_rubble'); MAIN.push('fields'); MAIN.push('fields2');   // u-fields: carbon_rubble (after ocker_dust), the rubble bodies and their dims, VR.Fields (the ring, the cloud tops, the swarm, the boots)
SHARED.splice(SHARED.indexOf('blocks4'), 0, 'exo_blocks'); SHARED.push('exoworld'); TEX.splice(TEX.indexOf('tex_body') + 1, 0, 'tex_exo'); MAIN.push('starexo');   // u-stars2: the exo blocks (after u-fields' glowspar), VR.Exo (after galaxy), their textures, the landed sky of other stars
MAIN.push('../shared/story', 'regie', 'story_art', 'story_glow', 'story_neb', 'story');   // (a-story2: story_art — the speakers' faces, the Eiswächter's model; before the player)
MAIN.push('regie_acts');   // a-regie: the Regie's own acts — the adventurer's first encounter (after foes, liberate, funke and the Regie)   // a-story: the book (src/shared/story.js — pure, main thread only), die Regie, the story's player (after funke, quests, liberate, ctx and the space scene, whose parts it uses)
MAIN.splice(MAIN.indexOf('audio'), 0, 'score', 'scoresynth');   // e-music: VR.Score (src/main/score.js, the themes and the director) and VR.ScoreSynth (scoresynth.js) before audio.js
MAIN.push('ux');   // e-ux: VR.UX (src/main/ux.js) — the UI scale, the key-hint strip, the first minute's hints, the settings' search; last: it wraps ui.js and game.js
MAIN.push('firstlook');
MAIN.push('konvoi');
MAIN.splice(MAIN.indexOf('ui'), 0, 'pickfind', 'stamp'); MAIN.push('buildfx', 'showcase');   // a-builder: the picker's search, the stamps (pure), then the placement's pop, the picker, the stamp ghost (wraps player, ui, gadgets, game) and the showcase (wraps photomode)   // a-konvoi: VR.Konvoi (src/main/konvoi.js) — Mitreisen, the world on the wire, together in the Abenteuer, the roster and the emote wheel (last: it wraps mp.js, cruise.js, liberate.js and story.js)   // f-first: VR.FirstLook (src/main/firstlook.js) — the pause menu in two steps, one prompt per key, readable start texts (after ux: it wraps ui.js's pause last)
MAIN.push('../shared/rpg', 'rpg', 'rpg_boss');
MAIN.push('rpg_boss2');   // a-boss2: the boss fight as a cinematic experience (src/main/rpg_boss2.js: the arena, the entrance, the decals, the wave, the pedestal, the map) — after rpg_boss: it wraps it   // a-rpg: VR.RPG (src/shared/rpg.js — pure, main thread only), the character screen, gear, the conquest map and the loot burst (src/main/rpg.js), Der Turmgänger (src/main/rpg_boss.js) — last: they wrap adventure.js, foes.js and liberate.js
SHARED.splice(SHARED.indexOf('blocks4'), 0, 'lifeblocks'); MAIN.push('ferries');   // a-life: the ferry dock and the grow lamp (the last blocks, after u-stars2's exo blocks), VR.Ferries (src/main/ferries.js: the moons' settlements, the ferries, the traffic between the worlds — after padlife, ctx, the space scene, the star map and liberate)
SHARED.push('worldeco'); MAIN.push('worldlife'); MAIN.push('natives'); MAIN.push('towns');   /* u-worlds5: VR.Towns (src/main/towns.js) — the species market, the landmark's view */   // u-worlds: VR.WorldEco (src/shared/worldeco.js, after exoworld and the bodies' generators: bgen 3's ecosystems and natives) and its game glue (src/main/worldlife.js: the creatures, the natives' looks, the trade, the Kreativ worlds, the gravity switch)
SHARED.splice(SHARED.indexOf('core') + 1, 0, 'names');   // n-names: VR.Names (src/shared/names.js) — the one table of the game's names, right after core (the generators and the language tables use it)
MAIN.push('a11y');   // e-access: VR.A11y (src/main/a11y.js) — Weniger Bewegung, the flash limiter, subtitles, Ein-Hand, mono, text size, contrast, the pad's glyphs (last: it wraps ui.js)
MAIN.push('reel');   // e-cam: VR.Reel (src/main/reel.js) — 🎬 the highlight reel (F9): the track, the highlights, the director's shots (after director, game, photomode, eventlog)
MAIN.push('first2');   // f-first2: VR.First2 (src/main/first2.js) — the held block, the Abenteuer start, open ground, the trips' ends, ⚙ Einfach, J/O (last: it wraps ui.js, game.js, cruise.js and fields2.js)
MAIN.push('hitfeel');   // f-hud: VR.HitFeel (src/main/hitfeel.js) — the HUD up in a new world, the hit's feel, the XP pop, Funke's what now (after first2: it wraps its Einfach page)
SHARED.splice(SHARED.indexOf('blocks4'), 0, 'stn_blocks'); SHARED.splice(SHARED.indexOf('forge_park') + 1, 0, 'forge_station', 'gen_stn'); MAIN.push('stations');   // u-stations: the gravity plate and the docking clamp (the last blocks, after a-life's), the Forge's station kind, the stn.* dims, VR.Stations (src/main/stations.js: last — it wraps spaceflight, cruise, ascent, padlife, shop, story)
MAIN.push('portal_core', 'portal_film', 'portal_space', 'portal');   // e-portal (+ e-portal2: portal_space, the film's space shots): the Leuchtpfad — the rules (portal_core.js), the film (portal_film.js), the gates, the picker, the journey, fast flight (portal.js; last: it wraps playFrame and the pause menu)
MAIN.push('quiet');   // f-quiet: VR.Quiet (src/main/quiet.js) — one quiet message channel, ⚙ Hinweise, Funke's budget and bubble at the edge (last: it wraps ui.js, funke.js, the hints, first2's Einfach page)
MAIN.push('wander');   // o-wander: VR.Wander (src/main/wander.js) — the Wanderregisseur, the Wegballon, the Wanderbuch (after lifedirector, first2, quests, quiet: it wraps them)
MAIN.push('journey_core', 'journey');   // o-seamless: VR.JourneyCore (the pure journeys) and VR.Journey (src/main/journey.js) — die Himmelsleiter, die Lichtbrücken, die Karawanen; after portal and wander (it wraps Portal.route, playFrame, the life director's draw)
MAIN.push('fairy_models', 'fairy');   // a-fairy: the enchanted places' models (src/main/fairy_models.js) and VR.Fairy (src/main/fairy.js: the places, the Flausel folk, their adventures — after ctx, lifekit, quiet, settings: it uses them)
MAIN.push('movein');
MAIN.push('seasons', 'seasons_fest');   // w-seasons: VR.Seasons (src/main/seasons.js: the calendar, the tints, the snow, the air's leaves; wraps env, game, mp, wander) and the festivals (seasons_fest.js: wraps VR.Villages after festival.js and movein.js)   // u-movein: VR.MoveIn (src/main/movein.js) — build a home, a family moves in; your settlement grows (after homes, festival, lifekit, quiet: it wraps VR.Villages)
MAIN.push('liberate_fest');   // a-adventure: das Fest am Leuchtfeuer (src/main/liberate_fest.js: the goal line, the reward chest, the Wanderbuch page, the cheer, the next goal — wraps VR.Liberate's beat and look)
// the UI both pages share (W1), before ui.js / studio.js: the languages first — the module and the game's two tables
// (de, en; the start screen's words are in them too) are there before any text is drawn — then r9si.ui (Einfach /
// Profi), the hints, the Ding cards, the tiles
const LANG = ['i18n', 'lang_en', 'lang_de'];
const UI_SHARED = ['uiprefs', 'hints', 'ding', 'tiles', 'isopic', 'wizkinds', 'wizard'];   // (W2: the pictures, the ✨ wizard's kinds and its dialog, both pages)
const exists = (p) => fs.existsSync(path.join(ROOT, p));
const js = (dir, list) => list.filter(f => exists(`src/${dir}/${f}.js`)).map(f => `/* ${dir}/${f}.js */\n` + read(`src/${dir}/${f}.js`)).join('\n');
const shared = js('shared', SHARED);
// (t-folk: the villagers' rig — voxmodels' grid, the looks, folkmodel.js — in the worker too: it builds and meshes the
// smooth people, folksmooth.js FS.personFromLook)
const WORKER_MAIN = ['voxmodels', 'villagers', 'folkmodel'];
// (t-material · hero textures: the texture modules are kept as one function, VR.TEX_MODS, run once here as before — the
// hero forge, tex_hi.js, runs them again on a namespace of its own with VR.TEX_N = 64)
// (f-slim, R55-06) the shared code is in the game page once: a script of its own (id="r9-shared", run on the main
// thread) whose text the worker pool puts before the worker's own part (game.js makePool) — before, the page carried
// it twice, once in the worker's text and once in the main script (−2 MB). workerOwn is the worker's part after the shared code.
const workerOwn = '\nVR.TEX_MODS = function (VR) {\n' + js('main', TEX) + '\n};\nVR.TEX_MODS(VR);\n' + js('main', WORKER_MAIN) + '\n' + read('src/worker/worker_main.js');
// the texture cache's key (tex_cache.js): a hash of the worker's bundle (the shared code the block registry and the
// recipes come from, the recipes, the forge) and of the cache itself. Any change there forges the textures again, once;
// a change on the main thread alone (the UI, the game's own logic) keeps the cached textures.
// (t-folk: the villagers' rig and their smooth meshing make no texture — they stay out of the key, so a change to the
// people does not forge every texture again)
// (u-orbit: the orbits make no texture either — universe.js stays out of the key)
const texHash = require('crypto').createHash('sha256').update(js('shared', SHARED.filter(f => f !== 'folksmooth' && f !== 'universe')) + '\n' + js('main', TEX) + '\n' + read('src/worker/worker_main.js')).update(js('main', ['tex_cache'])).digest('hex').slice(0, 16);
const uiShared = js('main', LANG) + '\n' + js('shared', UI_SHARED);
// (W2) the ✨ wizard in the game: the Studio's block colours, Baukasten and Genie, compiled only on the first ✨ (a function
// the browser parses lazily: nothing runs on a start that never opens the wizard); the block colours read the game's textures
const GENIE_LAZY = ['colors', 'housekit', 'genie_brain', 'genie'];
const genieLazy = `VR.GenieLazy = function () {\n  if (VR.GenieLazy.done) return !!VR.GenieBrain; VR.GenieLazy.done = true;\n  if (!window.__studioCore) window.__r9TexHost = { texInfo: function () { var t = VR.game && VR.game.tex; return t && t.albedo ? t : null; } };\n  try {\n${js('studio', GENIE_LAZY)}\n  } catch (e) { console.warn('Genie', e); }\n  return !!VR.GenieBrain;\n};\n`;
const mainOwn = js('main', TEX.filter(t => t !== 'tex_build')) + '\n' + `VR.TEX_SRC_HASH = "${texHash}";\n` + uiShared + '\n' + js('main', MAIN) + '\n' + genieLazy + `
window.addEventListener('load', function () { try { VR.game = new VR.Game(); VR.game.boot(); } catch (e) { console.error(e); document.body.insertAdjacentHTML('beforeend', '<pre style="color:#f88;position:fixed;top:0;left:0;z-index:99">' + (e && e.stack || e) + '</pre>'); } });
`;
const uiCss = ['start', 'bauhand', 'wizard', 'controls', 'invent'].filter(f => exists('src/ui/' + f + '.css')).map(f => read('src/ui/' + f + '.css')).join('\n');   // (W1 + W2 + F5: both pages)
const css = read('src/ui/style.css') + '\n' + uiCss;
// e-ux: the design tokens (the one palette, the aliases of the older variables) and the shared components, last: they win
const uxCss = ['tokens', 'ux'].filter(f => exists('src/ui/' + f + '.css')).map(f => read('src/ui/' + f + '.css')).join('\n');
const guard = (s) => s.replace(/<\/script/gi, '<\\/script');
const fonts = `<style>${read('src/ui/fonts/game_fonts.css')}</style>`;   // embedded (OFL): no request to Google's servers leaves the player's browser
// 📜 Rechtliches — Impressum, Datenschutz, Credits, Hinweis: one overlay with its styles for the game and the Studio
// (VR.Legal.open(section)); in the game before its own scripts, so its Esc comes first
const legal = `<style>${read('src/ui/legal.css')}</style>\n<script>${guard(read('src/main/legal.js'))}</script>`;
const body = `<div id="app"><canvas id="gl" tabindex="0"></canvas><div id="ui"></div></div>
<script type="text/js-worker" id="worker-src">${guard(workerOwn)}</script>
${legal}
<script id="r9-shared">${guard(shared)}</script>
<script>${guard(mainOwn)}</script>`;
const head = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><title>R9-SI</title>${fonts}<style>${css}\n${uxCss}</style>`;
fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
// (f-build, R50-09) the player pages go out without comments and indentation — src/build/strip.js, test/strip.js — and
// every stripped script must parse, or the build stops. dist/index.debug.html is the game with its source text: the same
// page, the same lines (an error's line in the player page is that line in the debug page).
const Strip = require('./src/build/strip.js');
const stripMemo = new Map();   // (the worker and the libraries are the same script in two pages: stripped once)
// a page is written whole or not at all (a temporary file renamed): a browser test loading dist/ while another test
// builds never reads half a page
const putPage = (file, text) => { const p = path.join(ROOT, 'dist', file), t = p + '.' + process.pid + '.tmp'; fs.writeFileSync(t, text); fs.renameSync(t, p); };
const writePage = (file, html) => {
  const out = html.replace(Strip.SCRIPT_RE, (m, open, attrs, code, close) => {
    const key = attrs + '\u0000' + code;
    if (!stripMemo.has(key)) {
      let s = null;
      try { s = Strip.script(attrs, code); if (s !== null && Strip.kind(attrs) === 'classic') new (require('vm').Script)(s, { filename: 'dist/' + file }); }
      catch (e) { console.error('STRIPPING FAILED in dist/' + file + ': ' + e.message + ' — build stopped (dist/index.debug.html has the source text)'); process.exit(1); }
      stripMemo.set(key, s);
    }
    const s = stripMemo.get(key);
    return s === null ? m : open + s + close;
  });
  putPage(file, out);
};
const gamePage = `<!doctype html>\n<html lang="en"><head>${head}</head><body>${body}</body></html>\n`;
putPage('index.debug.html', gamePage);
writePage('index.html', gamePage);
// the published page can't hand out files: drop the direct-download branch there (screenshots still show in an overlay)
const bodyArtifact = body.replace(/\/\*DL\*\/[\s\S]*?\/\*\/DL\*\//g, '');
writePage('artifact.html', `<title>R9-SI</title>${fonts}<style>${css}\n${uxCss}</style>\n${bodyArtifact}\n`);
// ---- the Model Studio: the live catalogue + editor page. Main thread: registry, model language, furniture and facade
// packs, the VX material textures. Worker (the game's own worker + a studio extension): block textures, whole
// catalogue houses built with the villa generator, lit and meshed with the game's mesher.
const STUDIO_MAIN = ['core', 'noise', 'registry', 'models', 'voxarch', 'voxtech', 'voxlife', 'voxcity', 'voxhome', 'voxmodel', 'voxcells', 'voxfurn', 'voxfacade', 'blocks1', 'blocks2', 'blocks3', 'blocks_heart', 'blocks5', 'blocks6', 'voxmodern', 'blocks_var', 'voxplants', 'voxnova', 'voxtown', 'blocks4', 'items', 'groceries', 'physics', 'custom', 'smoothvox', 'style', 'edits', 'looks', 'schem', 'forge', 'forge_kit', 'forge_tower', 'forge_house', 'forge_bridge', 'forge_civic', 'forge_park', 'wonders', 'wonders_build', 'names_de'];
STUDIO_MAIN.splice(STUDIO_MAIN.indexOf('blocks4'), 0, 'bodies');   // u-moons1: the bodies' blocks (the Studio keeps the game's ids)
STUDIO_MAIN.splice(STUDIO_MAIN.indexOf('blocks4'), 0, 'foeblocks');   // a-foes: the Leuchtfeuer (the Studio keeps the game's ids)
STUDIO_MAIN.splice(STUDIO_MAIN.indexOf('blocks4'), 0, 'voxhangar');   // t-hangar (after the Leuchtfeuer)
STUDIO_MAIN.splice(STUDIO_MAIN.indexOf('blocks4'), 0, 'bodies2');   // u-moons2 (after t-hangar's pieces)
STUDIO_MAIN.splice(STUDIO_MAIN.indexOf('blocks4'), 0, 'fields_blocks');   // u-fields (after u-moons2's)
STUDIO_MAIN.splice(STUDIO_MAIN.indexOf('blocks4'), 0, 'exo_blocks');   // u-stars2 (after u-fields')
STUDIO_MAIN.splice(STUDIO_MAIN.indexOf('blocks4'), 0, 'lifeblocks');   // a-life (after u-stars2's exo blocks)
STUDIO_MAIN.splice(STUDIO_MAIN.indexOf('core') + 1, 0, 'names');   // n-names: VR.Names in the Studio too (the language tables' renames)
const studioLibs = js('shared', STUDIO_MAIN) + `\nVR.TEXREC = VR.TEXREC || {}; VR.TEXPRE = VR.TEXPRE || {};\n` + js('main', ['tex_core', 'tex_vox', 'icons', 'place', 'storage', 'favs', 'pack', 'landing']) + '\n' + uiShared;   // (uiShared: the language module and its tables — the choice is shared with the game)
const studioWorkerSrc = shared + '\n' + js('main', TEX) + '\n' + read('src/worker/worker_main.js') + '\n' + read('src/studio/studio_worker.js');
const furnSrc = read('src/shared/voxfurn.js') + '\n' + read('src/shared/voxfacade.js') + '\n' + read('src/shared/voxmodern.js');
const notes = exists('src/studio/notes.md') ? read('src/studio/notes.md') : '';
const studioCss = read('src/studio/studio.css') + '\n' + uiCss;
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
<script>${guard(read('src/studio/formtools.js'))}</script>
<script>${guard(read('src/studio/modern.js'))}</script>
<script>${guard(read('src/studio/forge.js'))}</script>
<script>${guard(read('src/studio/variants.js'))}</script>
<script>${guard(read('src/studio/lookpanel.js'))}</script>
<script>${guard(read('src/studio/spawn.js'))}</script>
<script>${guard(read('src/studio/space.js'))}</script>
<script>${guard(read('src/studio/bridge.js'))}</script>
${['nav', 'start', 'wizard'].filter(f => exists('src/studio/' + f + '.js')).map(f => `<script>${guard(read('src/studio/' + f + '.js'))}</script>`).join('\n')}`;
const studioHead = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>R9 Model Studio</title>${studioFonts}<style>${studioCss}</style>`;
// two studios: studio.html sits next to the game (same origin → "Update ins Spiel" lands directly in the game; a link back
// to the game), studio_artifact.html is the standalone published Model Studio (export / import bridge)
// (W1: the ▶ tile in the header is the play button, #playBtn — src/studio/start.js gives it the id in the Studio that belongs to the game)
const inGame = studioBody.replace('<!--PLAYTAG-->', ' · ▶ Spielen').replace('<script type="text/js-worker"', '<script>window.__R9_IN_GAME = true;</script>\n<script type="text/js-worker"');
// the standalone Studio is its own artifact (another web origin, its own storage): it says so, and knows where the game is
const GAME_URL = 'https://claude.ai/artifact/EP9fJV6R8Grw4ev5RVUP4r';
const standalone = studioBody.replace('<!--PLAYTAG-->', '').replace('<script type="text/js-worker"', `<script>window.__R9_STANDALONE = true; window.__R9_GAME_URL = '${GAME_URL}';</script>\n<script type="text/js-worker"`);
writePage('studio.html', `<!doctype html>\n<html lang="de"><head>${studioHead}</head><body>${inGame}</body></html>\n`);
// (the charset first: a host that serves the page as it is — not wrapped in its own document — still reads it as UTF-8)
writePage('studio_artifact.html', `<meta charset="utf-8"><title>R9 Model Studio</title>${studioFonts}<style>${studioCss}</style>\n${standalone}\n`);
if (exists('dist/studio_index.html')) fs.unlinkSync(path.join(ROOT, 'dist/studio_index.html'));
const kb = (f) => (fs.statSync(path.join(ROOT, f)).size / 1024).toFixed(0) + ' KB';
console.log('built dist/index.html', kb('dist/index.html'), '· artifact.html', kb('dist/artifact.html'), '· studio.html', kb('dist/studio.html'), '· studio_artifact.html', kb('dist/studio_artifact.html'), '· index.debug.html', kb('dist/index.debug.html'));
