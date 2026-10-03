// ============================================================================
// R9 Studio · ✨ the Genie's own brain (v0.37) — wishes understood and built
// right here in the page: no Claude, no account, no limit, the same for every
// player. A sentence in German or English (or a photo, or both) becomes
//  · a house for the 🏠 Baukasten — its kind (Villa, Hütte, Bungalow, Strandhaus,
//    Fachwerk, Toskana …), style, size, floors, roof, walls, colours, windows, door
//    and extras ("rotes Landhaus mit Pool, zwei Etagen, Dach schwarz");
//  · or one of the things in its library (vehicles, ships, planes, towers, a
//    castle, a church, trees, animals, figures, everyday things …) built from
//    shapes in the colours and with the features asked for ("Feuerwehrauto mit
//    Leiter", "Segelboot mit roten Segeln", "großer Kirschbaum");
//  · or, from a photo of anything else, a rounded 3D relief in the photo's colours.
// "Ändern" works on what is there ("Dach blau", "größer", "ohne Pool", "mit
// Spoiler", "mach ein Boot daraus"). Everything is deterministic and instant.
// VR.GenieBrain.design({text, image, size, base}) → {kind:'house', spec, …} |
// {kind:'model', model:{size, parts}, recipe, …}; throws {code:'unknown', …}.
// ============================================================================
(function () {
  'use strict';
  const B = VR.GenieBrain = {};
  const HK = () => VR.HouseKit;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------------------------------------------------------------- words
  // lower case, umlauts folded (so "gruen", "grün" and "grun" are one word), punctuation gone
  B.norm = function (t) {
    return String(t || '').toLowerCase()
      .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss').replace(/[éèê]/g, 'e').replace(/[àâá]/g, 'a').replace(/[óô]/g, 'o')
      .replace(/(\d)\s*[x×*]\s*(\d)/g, '$1 x $2')
      // "gruen", "Tuer", "Raeder" (typed without umlauts) are the same words; English "blue" stays blue
      .replace(/\bblue/g, 'blau').replace(/(statue|uell|uett|fondue|revue|true|glue|value|rescue|tissue|avenue|shoe|canoe|oboe|poet|aero|israel)/g, (m) => m.toUpperCase())
      .replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/(^|[^aeq])ue/g, '$1u').toLowerCase()
      .replace(/[,;:.!?()\n]+/g, ' , ').replace(/[^a-z0-9#,\s]/g, ' ').replace(/\s+/g, ' ').replace(/^( ?, ?)+|( ?, ?)+$/g, '').trim();
  };
  const NUMW = { ein: 1, eine: 1, einen: 1, einem: 1, einer: 1, eins: 1, one: 1, zwei: 2, two: 2, drei: 3, three: 3, vier: 4, four: 4, funf: 5, five: 5, sechs: 6, six: 6, sieben: 7, seven: 7, acht: 8, eight: 8, neun: 9, nine: 9, zehn: 10, ten: 10, elf: 11, eleven: 11, zwolf: 12, twelve: 12, zwanzig: 20, twenty: 20, dutzend: 12, paar: 2, einige: 4, mehrere: 4, viele: 9, several: 4, many: 9, few: 3, wenige: 3 };
  const numOf = (w) => (/^\d+$/.test(w) ? +w : NUMW[w] !== undefined ? NUMW[w] : null);
  const tokIndex = (n, i) => { let k = 0; for (let j = 0; j < i; j++) if (n[j] === ' ') k++; return k; };
  // a list of stems → one pattern. Compounds end in their head noun ("Polizeiauto" is an Auto), so a stem may sit at the
  // end of a longer word; a stem written "=ente" must start a word (short words hide inside others: Rente, Motor)
  function stemRe(stems, flags) {
    const one = (s) => (s[0] === '=' ? '\\b' + s.slice(1) : s).replace(/ /g, ' ?'), bare = (s) => s.replace(/^=/, '');
    const long = stems.filter(s => bare(s).length >= 4).map(one), short = stems.filter(s => bare(s).length < 4).map(s => '\\b' + bare(s).replace(/ /g, ' ?'));
    const parts = [];
    if (long.length) parts.push('(' + long.join('|') + ')(s|e|en|n|es|er|chen)?\\b');
    if (short.length) parts.push('(?:' + short.join('|') + ')\\b');
    return new RegExp(parts.join('|') || '(?!)', flags || 'g');
  }
  // every place a pattern matches: [token index, length]
  function hits(n, re) { const out = []; re.lastIndex = 0; let m; while ((m = re.exec(n))) { out.push([tokIndex(n, m.index), m[0].length, m.index, m[0].length - ((m[2] || '').length)]); if (!re.global) break; } return out; }
  // "ohne Pool", "kein Kamin", "no chimney", "without a pool": the word right before (or two before) says no
  const NEG = /^(ohne|kein|keine|keinen|keiner|keinem|no|without|nicht|weg|entferne|remove)$/;
  const negated = (toks, i) => { for (let k = 1; k <= 3 && i - k >= 0; k++) { if (NEG.test(toks[i - k])) return true; if (/^(mit|und|plus|with|and)$/.test(toks[i - k])) return false; } return false; };

  // ---------------------------------------------------------------- colours
  // [stems, colour, the adjective for a name (null: it does not decline)]
  const COLS = [
    [['dunkelrot', 'weinrot', 'bordeaux', 'burgund', 'burgundy', 'maroon', 'dark red', 'kirschrot'], '#7a1f24', 'dunkelrot'],
    [['hellrot', 'light red', 'koralle', 'korallenrot', 'coral', 'lachs', 'salmon'], '#ef6f5e', 'hellrot'],
    [['terrakotta', 'terracotta', 'ziegelrot', 'rostrot', 'rostbraun'], '#c8693f', null],
    [['rot', 'red', 'feuerrot', 'knallrot', 'signalrot', 'scharlach'], '#c0392b', 'rot'],
    [['orange', 'apricot', 'mandarine'], '#e67e22', null],
    [['gold', 'golden', 'goldig', 'goldfarben', 'golden'], '#d4af37', 'golden'],
    [['gelb', 'yellow', 'zitronengelb', 'sonnengelb', 'senf', 'mustard', 'ocker', 'ochre'], '#f1c40f', 'gelb'],
    [['dunkelgrun', 'dark green', 'tannengrun', 'waldgrun', 'flaschengrun', 'jagergrun', 'smaragd', 'emerald'], '#1f5f3a', 'dunkelgrün'],
    [['hellgrun', 'light green', 'lindgrun', 'limette', 'lime', 'limettengrun', 'apfelgrun', 'maigrun'], '#7ed957', 'hellgrün'],
    [['olivgrun', 'oliv', 'olive', 'khaki', 'armeegrun'], '#6b7a2f', null],
    [['mint', 'mintgrun', 'pastellgrun'], '#98e0c0', null],
    [['grun', 'green', 'grasgrun'], '#2e9e4f', 'grün'],
    [['turkis', 'turquoise', 'petrol', 'aqua', 'cyan', 'turkisblau'], '#1abc9c', 'türkis'],
    [['dunkelblau', 'dark blau', 'dark blue', 'navy', 'marineblau', 'nachtblau', 'mitternachtsblau', 'indigo'], '#1f3a7a', 'dunkelblau'],
    [['hellblau', 'light blau', 'light blue', 'himmelblau', 'sky blau', 'sky blue', 'babyblau', 'eisblau', 'pastellblau'], '#7fb8ef', 'hellblau'],
    [['blau', 'blue', 'royalblau', 'konigsblau', 'kobalt', 'cobalt'], '#2e6fd8', 'blau'],
    [['lila', 'violett', 'purple', 'violet', 'flieder', 'lavendel', 'lavender', 'purpur', 'pflaume'], '#8e44ad', null],
    [['magenta', 'fuchsia', 'pink', 'neonpink'], '#e8478f', null],
    [['rosa', 'rosarot', 'altrosa', 'pastellrosa', 'rose farben'], '#ff9fc4', null],
    [['dunkelbraun', 'dark brown', 'schokolade', 'schokobraun', 'chocolate', 'mokka', 'espresso', 'nussbaum', 'walnut'], '#4a2c1a', 'dunkelbraun'],
    [['hellbraun', 'light brown', 'karamell', 'caramel', 'haselnuss', 'honig', 'eiche', 'oak'], '#b07a4a', 'hellbraun'],
    [['braun', 'brown', 'kastanie', 'zimt'], '#7a4a2a', 'braun'],
    [['beige', 'sandfarben', 'sandfarbig', 'sandig', 'taupe', 'latte'], '#e2d3b0', null],
    [['creme', 'cremefarben', 'cream', 'elfenbein', 'ivory', 'vanille', 'champagner'], '#f3ead2', null],
    [['kupfer', 'copper', 'kupferfarben'], '#b87333', null],
    [['bronze', 'bronzen'], '#a0703a', null],
    [['silber', 'silbern', 'silver', 'chrom', 'chrome', 'metallic', 'edelstahl', 'stahl', 'steel'], '#c0c7cf', 'silbern'],
    [['anthrazit', 'anthracite', 'graphit', 'graphite', 'dunkelgrau', 'dark grey', 'dark gray', 'schiefergrau', 'slate'], '#3a3d42', 'dunkelgrau'],
    [['hellgrau', 'light grey', 'light gray', 'silbergrau', 'steingrau', 'zementgrau'], '#c8ccd2', 'hellgrau'],
    [['grau', 'grey', 'gray', 'betongrau', 'mausgrau'], '#8a8f96', 'grau'],
    [['schwarz', 'black', 'tiefschwarz', 'pechschwarz', 'mattschwarz'], '#1d1f22', 'schwarz'],
    [['weiss', 'white', 'schneeweiss', 'reinweiss', 'cremeweiss', 'perlweiss', 'kalkweiss'], '#f4f4f2', 'weiß'],
  ].map(([stems, hex, adj]) => ({ re: new RegExp('\\b(' + stems.map(s => s.replace(/ /g, ' ?')).join('|') + ')(e|er|es|en|em|n|s|farben|farbig|farbene|farbenen|farbenes|farbener|lich|liche|liches|lichen)?\\b', 'g'), hex, adj, stems }));
  // every colour named in the text, in order: {i: token index, hex, adj}
  B.colors = function (n) {
    const out = [], taken = [];
    for (const C of COLS) {
      C.re.lastIndex = 0; let m;
      while ((m = C.re.exec(n))) { const at = m.index, len = m[0].length; if (taken.some(([a, b]) => at < b && at + len > a)) continue; taken.push([at, at + len]); out.push({ i: tokIndex(n, at), hex: C.hex, adj: C.adj, at, infl: /^(e|er|es|en|em)$/.test(m[2] || '') }); }
    }
    // colours written as #rrggbb
    const hx = /#([0-9a-f]{6})\b/g; let m; while ((m = hx.exec(n))) out.push({ i: tokIndex(n, m.index), hex: '#' + m[1], adj: null, at: m.index });
    return out.sort((a, b) => a.at - b.at);
  };
  // a colour belongs to the thing named next to it: "rotes Dach", "Dach rot", "Dach in Rot", "mit rotem Dach"
  function bindColors(toks, cols, targets) {
    const bound = {}, free = [];
    for (const c of cols) {
      let best = null;
      // an inflected adjective stands before its noun ("rotes Dach"); a bare colour mostly after it ("Dach rot"), in English before ("red roof")
      for (const d of c.infl ? [1, 2, -1, -2, 3] : [-1, 1, -2, 2, 3]) {
        const j = c.i + d; if (j < 0 || j >= toks.length) continue;
        const between = d > 0 ? toks.slice(c.i + 1, j) : toks.slice(j + 1, c.i);
        if (between.includes(',') || toks[j] === ',') continue;
        if (between.some(w => !/^(in|im|ganz|komplett|soll|sein|ist|wird|werden|mit|aus|farbe|color|colour|painted|gestrichen|lackiert|die|der|das|den|dem|the|a|an|ein|eine|einem|einen|sehr|leicht|kraftig)$/.test(w))) continue;
        const t = targets.find(([, re]) => re.test(toks[j]));
        if (t) { best = t[0]; break; }
      }
      if (best && !bound[best]) bound[best] = c; else if (best) bound[best + '2'] = c; else free.push(c);
    }
    return { bound, free };
  }
  const ADJ_END = { m: 'er', f: 'e', n: 'es' };
  const adjName = (c, noun, g) => (c && c.adj ? c.adj[0].toUpperCase() + c.adj.slice(1) + ADJ_END[g || 'n'] + ' ' + noun : noun);
  // a name the user gave: „Sonnenhof", "namens Sonnenhof", "called Sunny"
  function givenName(raw) {
    const q = /[„"“']([^"“”„']{2,40})["“”']/.exec(raw || ''); if (q) return q[1].trim();
    const m = /\b(?:namens|names|genannt|called|named|heisst|heißt)\s+([A-Za-zÄÖÜäöüß0-9][\wÄÖÜäöüß-]{1,30}(?:\s+[A-ZÄÖÜ][\wÄÖÜäöüß-]{1,20})?)/.exec(raw || '');
    return m ? m[1].trim() : null;
  }
  // size words: klein ×0.6 · groß ×1.4 · riesig ×2 (and their English)
  function sizeWord(n) {
    if (/\b(riesig|riesige|riesigen|riesiges|riesiger|riesen|riesengross\w*|riesenhaft\w*|gigantisch\w*|enorm\w*|huge|giant|gigantic|massiv\w*|monumental\w*)\b/.test(n)) return 2;
    if (/\b(winzig\w*|mini|tiny|klitzeklein\w*)\b/.test(n)) return 0.45;
    if (/\b(klein|kleine|kleinen|kleiner|kleines|small|little)\b/.test(n)) return 0.62;
    if (/\b(gross|grosse|grossen|grosser|grosses|big|large|hoch|hohe|hoher|hohes|tall)\b/.test(n)) return 1.4;
    return 1;
  }
  B.sizeWord = sizeWord;

  B.givenName = (raw) => givenName(raw);

  // ---------------------------------------------------------------- houses
  // [id, stems, name, gender, preset] — the first that matches the earliest word decides the kind of house
  const HOUSES = [
    ['mansion', ['herrenhaus', 'anwesen', 'palast', 'palais', 'manor', 'mansion', 'palace', 'landsitz', 'gutshaus'], 'Herrenhaus', 'n', { style: 'classic', width: 22, depth: 14, floors: 3, roof: { type: 'mansard' }, walls: { material: 'plaster', color: '#eeddb8' }, windows: { style: 'tall' }, door: { kind: 'double' }, extras: ['columns', 'dormers', 'garden', 'fence'] }],
    ['tuscan', ['toskana', 'tuscan', 'mediterran', 'mediterranean', 'finca', 'spanisch', 'italienisch', 'provence'], 'Toskana-Villa', 'f', { style: 'classic', width: 16, depth: 12, walls: { material: 'plaster', color: '#e8c48a' }, roof: { type: 'hip', color: '#c8693f' }, windows: { style: 'arch', shutters: '#4e7f46' }, extras: ['terrace', 'pool', 'garden'] }],
    ['cityvilla', ['stadtvilla', 'luxusvilla', 'traumvilla', 'designervilla', 'designvilla'], 'Stadtvilla', 'f', { style: 'modern', width: 16, depth: 13, floors: 2, roof: { type: 'hip', color: '#3a3d42' }, walls: { material: 'plaster', color: '#f4f4f2' }, windows: { style: 'tall', frame: 'black' }, door: { kind: 'modern' }, extras: ['garage', 'terrace'] }],
    ['villa', ['villa', 'villen'], 'Villa', 'f', { style: 'classic', width: 17, depth: 13, floors: 2, roof: { type: 'hip' }, extras: ['columns', 'terrace', 'garden'] }],
    ['cabin', ['blockhutte', 'blockhaus', 'holzhutte', 'berghutte', 'jagdhutte', 'waldhutte', 'skihutte', 'almhutte', 'hutte', 'cabin', 'chalet', 'log cabin', 'lodge'], 'Hütte', 'f', { style: 'cabin', width: 9, depth: 8, floors: 1, walls: { material: 'log', color: '#8a5e36' }, roof: { color: '#8e6a45' }, windows: { frame: 'wood' }, extras: ['chimney', 'porch'] }],
    ['bungalow', ['bungalow', 'flachbau'], 'Bungalow', 'm', { style: 'modern', width: 15, depth: 11, floors: 1, roof: { type: 'hip', color: '#4f5663' }, extras: ['terrace', 'garden'] }],
    ['farm', ['bauernhaus', 'bauernhof', 'gutshof', 'farmhaus', 'farmhouse', 'farm', '=hof'], 'Bauernhaus', 'n', { style: 'cottage', width: 14, depth: 10, floors: 2, walls: { material: 'timber' }, roof: { color: '#b0453a' }, extras: ['chimney', 'porch', 'fence', 'garden', 'flowers'] }],
    ['beach', ['strandhaus', 'ferienhaus', 'beach house', 'surfhaus', 'seehaus', 'haus am see', 'haus am meer'], 'Strandhaus', 'n', { style: 'modern', width: 12, depth: 10, floors: 2, walls: { material: 'wood', color: '#f4f4f2' }, roof: { type: 'flat', color: '#4f5663' }, windows: { style: 'panorama' }, extras: ['terrace', 'balcony'] }],
    ['swedish', ['schwedenhaus', 'skandinavisch', 'scandinavian', 'nordisch'], 'Schwedenhaus', 'n', { style: 'cottage', walls: { material: 'wood', color: '#a8322a' }, accent: '#ffffff', roof: { type: 'gable', color: '#3a3d42' }, windows: { frame: 'white' }, extras: ['porch', 'flowers'] }],
    ['timber', ['fachwerkhaus', 'fachwerk', 'half timbered', 'tudor'], 'Fachwerkhaus', 'n', { style: 'cottage', walls: { material: 'timber' }, roof: { type: 'gable', color: '#b0453a' }, extras: ['flowers', 'chimney'] }],
    ['witch', ['hexenhaus', 'lebkuchenhaus', 'knusperhaus', 'pfefferkuchenhaus', 'gingerbread'], 'Hexenhaus', 'n', { style: 'cottage', width: 9, depth: 8, floors: 1, walls: { material: 'wood', color: '#8b5a2b' }, roof: { type: 'gable', color: '#f3ead2' }, door: { color: '#c0392b' }, windows: { style: 'round', shutters: '#c0392b' }, extras: ['chimney', 'flowers', 'fence'] }],
    ['station', ['feuerwache', 'feuerwehrhaus', 'fire station', 'polizeiwache', 'wache'], 'Feuerwache', 'f', { style: 'classic', width: 16, depth: 12, floors: 2, walls: { material: 'brick', color: '#a84e3a' }, roof: { type: 'flat', color: '#3a3d42' }, door: { kind: 'double', color: '#c0392b' }, extras: ['garage'] }],
    ['shop', ['=laden', 'dorfladen', 'bioladen', 'kramerladen', 'tante emma laden', 'geschaft', 'shop', 'store', 'cafe', 'kaffeehaus', 'backerei', 'bakery', 'kiosk', 'boutique', 'restaurant', 'pizzeria', 'imbiss', 'bistro', 'eisdiele', 'metzgerei', 'apotheke', 'gasthaus', 'gasthof', 'wirtshaus', 'kneipe', 'taverne', 'pub', 'inn'], 'Laden', 'm', { style: 'cottage', width: 11, depth: 9, floors: 2, windows: { style: 'wide' }, door: { kind: 'glass' }, extras: ['porch', 'flowers'] }],
    ['hall', ['rathaus', 'town hall', 'schule', 'school', 'museum', 'bibliothek', 'library', 'bahnhof', 'station', 'kaserne', 'akademie', 'universitat', 'gericht'], 'Rathaus', 'n', { style: 'classic', width: 24, depth: 14, floors: 3, roof: { type: 'hip' }, windows: { style: 'tall' }, door: { kind: 'double' }, extras: ['columns', 'dormers'] }],
    ['tower', ['hochhaus', 'wohnblock', 'mehrfamilienhaus', 'apartmenthaus', 'apartment', 'hotel', 'burohaus', 'office'], 'Hotel', 'n', { style: 'modern', width: 20, depth: 14, floors: 4, roof: { type: 'flat', color: '#3a3d42' }, windows: { style: 'tall', frame: 'black' }, extras: ['balcony'] }],
    ['green', ['gewachshaus', 'glashaus', 'greenhouse', 'wintergarten', 'orangerie'], 'Gewächshaus', 'n', { style: 'modern', width: 9, depth: 7, floors: 1, walls: { material: 'glass', color: '#dfe9ee' }, roof: { type: 'gable', color: '#dde8ee' }, interior: false, extras: ['garden'] }],
    ['tiny', ['tiny house', 'tinyhouse', 'minihaus', 'gartenhaus', 'gartenlaube', 'laube', 'hauschen', 'cottage klein'], 'Häuschen', 'n', { style: 'cottage', width: 7, depth: 7, floors: 1, extras: ['flowers', 'porch'] }],
    ['cube', ['kubus', 'bauhaus', 'cube house', 'wurfelhaus', 'smart home', 'designerhaus', 'architektenhaus'], 'Kubus', 'm', { style: 'modern', width: 13, depth: 11, floors: 2, roof: { type: 'flat', color: '#3a3d42' }, windows: { style: 'panorama', frame: 'black' }, walls: { material: 'plaster', color: '#f4f4f2' }, door: { kind: 'modern' } }],
    ['cottage', ['landhaus', 'cottage', 'einfamilienhaus', 'familienhaus', 'siedlungshaus', 'wohnhaus', 'eigenheim', 'zuhause', 'heim', '=haus', 'house', '=home', 'gebaude', 'building', 'domizil', 'unterkunft'], 'Landhaus', 'n', {}],
  ].map(([id, stems, name, g, preset]) => ({ id, re: stemRe(stems), name, g, preset, stems }));
  // the look of a house, word by word
  const HSTYLE = [['modern', stemRe(['modern', 'modernes', 'zeitgemass', 'minimalistisch', 'minimal', 'futuristisch', 'contemporary', 'neubau', 'designer'])], ['classic', stemRe(['klassisch', 'klassizistisch', 'classic', 'elegant', 'barock', 'viktorianisch', 'victorian', 'historisch', 'herrschaftlich', 'nobel', 'jugendstil', 'altbau'])], ['cabin', stemRe(['rustikal', 'rustic', 'urig', 'gemutlich holz', 'holzig'])], ['cottage', stemRe(['gemutlich', 'cozy', 'cosy', 'landlich', 'romantisch', 'verspielt', 'idyllisch'])]];
  const ROOFW = [['gable', stemRe(['satteldach', 'giebeldach', 'spitzdach', 'steildach', 'gable', 'giebel'])], ['hip', stemRe(['walmdach', 'hip roof', '=walm'])], ['flat', stemRe(['flachdach', 'flat roof', 'dachterrasse'])], ['shed', stemRe(['pultdach', 'shed roof', 'schragdach'])], ['pyramid', stemRe(['zeltdach', 'pyramidendach', 'pyramid roof'])], ['mansard', stemRe(['mansarddach', 'mansarde', 'mansard'])]];
  const ROOFC = [[stemRe(['schieferdach', 'slate roof', 'schiefer']), '#3f454c'], [stemRe(['ziegeldach', 'tile roof', 'dachziegel']), '#b0453a'], [stemRe(['reetdach', 'strohdach', 'thatch', 'thatched']), '#b89a5a'], [stemRe(['kupferdach', 'copper roof', 'grunspan']), '#4e9e86'], [stemRe(['grasdach', 'grundach', 'green roof', 'begrunt']), '#4e7f46']];
  const WALLW = [['brick', stemRe(['ziegelhaus', 'backstein', 'klinker', 'brick', 'mauerwerk', 'rotklinker', 'ziegelstein', 'ziegelwand', 'ziegelwande'])], ['timber', stemRe(['fachwerk', 'timber', 'tudor'])], ['log', stemRe(['blockhaus', 'baumstamm', 'baumstamme', 'log', 'logs', 'rundholz', 'blockbohlen'])], ['wood', stemRe(['holz', 'holzhaus', 'holzfassade', 'holzverkleidung', 'wood', 'wooden', 'schindel', 'brett', 'bretter', 'planken', 'lark'])], ['stone', stemRe(['stein', 'naturstein', 'bruchstein', 'feldstein', 'stone', 'granit', 'sandstein', 'marmor', 'marble', 'steinhaus'])], ['concrete', stemRe(['beton', 'sichtbeton', 'concrete', 'zement'])], ['glass', stemRe(['glas', 'glass', 'verglast', 'glasfassade', 'glaswand', 'glaswande'])], ['plaster', stemRe(['putz', 'verputzt', 'plaster', 'stuck', 'stucco', 'gestrichen'])]];
  const EXTRAW = [['chimney', ['kamin', 'schornstein', 'chimney', 'schlot', 'feuerstelle', 'ofen']], ['porch', ['veranda', 'vordach', 'porch', 'uberdachung', 'uberdacht', 'eingangsdach', 'portal']], ['balcony', ['balkon', 'balcony', 'balkone']], ['garage', ['garage', 'carport', 'doppelgarage', 'stellplatz']], ['terrace', ['terrasse', 'terrace', 'patio', 'grill', 'bbq', 'sitzplatz', 'dachterrasse']], ['fence', ['zaun', 'fence', 'gartenzaun', 'lattenzaun', 'umzaunt', 'eingezaunt']], ['columns', ['saule', 'saulen', 'columns', 'column', 'portikus', 'pfeiler']], ['flowers', ['blume', 'blumen', 'flowers', 'blumenkasten', 'blumenkasten', 'blumenbeet', 'rosen', 'blumig']], ['dormers', ['gaube', 'gauben', 'dachgaube', 'dachgauben', 'dormer', 'dormers', 'dachfenster']], ['garden', ['garten', 'garden', 'obstbaum', 'obstbaume', 'gartenteich', 'rasen', 'beet']], ['pool', ['pool', 'schwimmbad', 'swimmingpool', 'schwimmbecken', 'swimming pool', 'whirlpool']], ['solar', ['solar', 'solaranlage', 'solardach', 'photovoltaik', 'solarzellen', 'pv', 'solarpanel', 'solarpanele']]].map(([id, stems]) => ({ id, re: stemRe(stems) }));
  const HTARGETS = [
    ['roof', /^(dach|dacher|dachern|daches|roof|roofs|dachziegel|ziegel|dachpfannen|schindeln|dacheindeckung)$/],
    ['door', /^(tur|ture|turen|haustur|haustur|eingang|eingangstur|door|doors|tor|tore|garagentor)$/],
    ['shutters', /^(laden|fensterladen|klappladen|klappladen|shutters?|holzladen)$/],
    ['frame', /^(fenster|fensterrahmen|rahmen|windows?|frames?|fensterrahmen)$/],
    ['accent', /^(akzent|akzente|zierleisten|leisten|trim|rand|rander|kanten|details?|gesims|sockel|ecken)$/],
    ['walls', /^(wand|wande|wanden|fassade|fassaden|mauer|mauern|aussenwand|aussenwande|putz|walls?|facade|haus|hauses|hauschen|villa|hutte|bungalow|cottage|house|home|landhaus|chalet|gebaude|anstrich)$/],
  ];
  const hueOf = (hex) => { const v = parseInt(hex.slice(1), 16), r = (v >> 16 & 255) / 255, g = (v >> 8 & 255) / 255, b = (v & 255) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (d < 0.12) return null; let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (h * 60 + 360) % 360; };
  const hueNear = (a, b) => { const x = hueOf(a), y = hueOf(b); if (x === null || y === null) return false; const d = Math.abs(x - y); return Math.min(d, 360 - d) < 28; };
  const FRAMEOF = (hex) => { const v = parseInt(hex.slice(1), 16), l = 0.299 * (v >> 16 & 255) + 0.587 * (v >> 8 & 255) + 0.114 * (v & 255); return l < 90 ? 'black' : l > 200 ? 'white' : 'wood'; };
  const ROOFN = { gable: 'Satteldach', hip: 'Walmdach', flat: 'Flachdach', shed: 'Pultdach', pyramid: 'Zeltdach', mansard: 'Mansarddach' };
  const EXTRAN = { chimney: 'Kamin', porch: 'Vordach', balcony: 'Balkon', garage: 'Garage', terrace: 'Terrasse', fence: 'Zaun', columns: 'Säulen', flowers: 'Blumen', dormers: 'Gauben', garden: 'Garten', pool: 'Pool', solar: 'Solar' };
  const WALLN = { plaster: 'verputzt', brick: 'aus Ziegeln', wood: 'aus Holz', stone: 'aus Stein', timber: 'mit Fachwerk', log: 'aus Baumstämmen', concrete: 'aus Beton', glass: 'aus Glas' };
  // which house the words mean (null: none)
  B.houseKind = function (n) {
    let best = null;
    for (const H of HOUSES) for (const [i, len, , st] of hits(n, H.re)) if (!best || i < best.i || (i === best.i && (st > best.st || (st === best.st && len > best.len)))) best = { H, i, len, st };
    return best;
  };
  // the words applied to a house spec (a fresh one from the preset, or the current one when changing it)
  function houseWords(n, raw, spec, kind, photo) {
    const toks = n.split(' '), S = JSON.parse(JSON.stringify(spec));
    const set = (path, v) => { const ks = path.split('.'), last = ks.pop(); let t = S; for (const k of ks) { if (!t[k] || typeof t[k] !== 'object') t[k] = {}; t = t[k]; } t[last] = v; };
    for (const [st, re] of HSTYLE) if (hits(n, re).length) {
      S.style = st;
      if (st === 'modern') { if (!/dach/.test(n)) set('roof.type', 'flat'); set('roof.color', '#3a3d42'); set('windows.frame', 'black'); if (!S.windows || S.windows.style === 'std' || S.windows.style === 'arch') set('windows.style', 'tall'); set('door.kind', 'modern'); if (!S.walls || S.walls.material !== 'glass') set('walls.color', '#f4f4f2'); S.floorHeight = 5; S.extras = (S.extras || []).filter(e => e !== 'columns' && e !== 'dormers' && e !== 'flowers'); }
      if (st === 'classic') { S.floorHeight = 5; if (!S.windows || S.windows.style === 'std') set('windows.style', 'tall'); }
      if (st === 'cabin') { set('walls.material', 'log'); set('walls.color', '#8a5e36'); set('windows.frame', 'wood'); }
    }
    for (const [t, re] of ROOFW) for (const [i] of hits(n, re)) if (!negated(toks, i)) set('roof.type', t);
    if (/\b(giebel (vorne|vorn|zur strasse)|giebelseite vorne|gable front)\b/.test(n)) set('roof.ridge', 'front');
    for (const [re, hex] of ROOFC) if (hits(n, re).length) set('roof.color', hex);
    for (const [m, re] of WALLW) for (const [i] of hits(n, re)) { if (negated(toks, i)) continue; set('walls.material', m); if (m === 'log') S.style = S.style === 'modern' ? 'modern' : 'cabin'; }
    if (/\baus (rot\w* |roten |hellen |weissen )?(ziegel|ziegeln|backstein|backsteinen|klinker|klinkern|bricks?)\b/.test(n)) set('walls.material', 'brick');
    // floors: "zwei Etagen", "3 Stockwerke", "dreistöckig", "eingeschossig", "Bungalow"
    const fl = /\b(\d+|[a-z]+) ?(etage|etagen|stockwerk|stockwerke|stockwerken|stock|stocke|geschoss|geschosse|geschossen|floor|floors|stories|storeys|levels?)\b/.exec(n);
    if (fl && numOf(fl[1])) S.floors = clamp(numOf(fl[1]), 1, 4);
    const fl2 = /\b(ein|zwei|drei|vier|1|2|3|4) ?(stockig|geschossig|etagig|story|storey)\w*/.exec(n); if (fl2) S.floors = clamp(numOf(fl2[1]), 1, 4);
    if (/\b(eingeschossig\w*|ebenerdig\w*|einstockig\w*|flach gebaut|single storey|one storey|ohne obergeschoss)\b/.test(n)) S.floors = 1;
    if (/\b(hohe raume|hohen raumen|hohe decken|high ceilings|grosszugig)\b/.test(n)) S.floorHeight = 5;
    // size: "klein", "groß", "riesig", "20 x 14"
    const dim = /\b(\d{1,2}) x (\d{1,2})\b/.exec(n);
    if (dim) { S.width = clamp(+dim[1], 7, 31); S.depth = clamp(+dim[2], 7, 25); }
    else { const k = sizeWord(n); if (k !== 1) { S.width = Math.round(clamp((S.width || 11) * k, 7, 31)); S.depth = Math.round(clamp((S.depth || 9) * Math.sqrt(k), 7, 25)); if (k >= 2 && !fl) S.floors = clamp((S.floors || 2) + 1, 1, 4); if (k < 0.7 && !fl) S.floors = Math.min(S.floors || 2, 1 + (k > 0.5 ? 1 : 0)); } }
    // windows
    if (/\b(panoramafenster|fensterfront|glasfront|bodentiefe\w*|grosse fenster|grossen fenstern|riesige fenster|viel glas|large windows|big windows|floor to ceiling)\b/.test(n)) set('windows.style', 'panorama');
    if (/\b(hohe fenster|hohen fenstern|tall windows|sprossenfenster)\b/.test(n)) set('windows.style', 'tall');
    if (/\b(breite fenster|breiten fenstern|wide windows)\b/.test(n)) set('windows.style', 'wide');
    if (/\b(kleine fenster|kleinen fenstern|small windows)\b/.test(n)) set('windows.style', 'small');
    if (/\b(bogenfenster|rundbogen\w*|arched|arch windows|gewolbte fenster)\b/.test(n)) set('windows.style', 'arch');
    if (/\b(runde fenster|runden fenstern|rundfenster|bullauge\w*|round windows|porthole)\b/.test(n)) set('windows.style', 'round');
    if (/\b(viele fenster|mehr fenster|many windows|more windows)\b/.test(n)) { set('windows.front', clamp(((S.windows && S.windows.front) || 3) + 2, 1, 9)); set('windows.side', clamp(((S.windows && S.windows.side) || 2) + 1, 0, 7)); }
    if (/\b(weniger fenster|fewer windows)\b/.test(n)) { set('windows.front', 2); set('windows.side', 1); }
    if (/\b(fensterladen|fensterladen|klappladen|shutters|holzladen)\b/.test(n) && !(S.windows && S.windows.shutters)) set('windows.shutters', '#5e9a6a');
    if (/\b(ohne (fenster)?laden|keine (fenster)?laden|no shutters)\b/.test(n)) set('windows.shutters', null);
    // door
    if (/\b(tur|eingang|door)\w* (links|left)|\blinke\w* (tur|eingang)/.test(n)) set('door.position', 'left');
    if (/\b(tur|eingang|door)\w* (rechts|right)|\brechte\w* (tur|eingang)/.test(n)) set('door.position', 'right');
    if (/\b(tur|eingang|door)\w* (mitte|mittig|in der mitte|center|centre)/.test(n)) set('door.position', 'center');
    if (/\b(glastur\w*|glass door)\b/.test(n)) set('door.kind', 'glass');
    if (/\b(doppeltur\w*|flugeltur\w*|zweiflugelig\w*|double door\w*|portal)\b/.test(n)) set('door.kind', 'double');
    if (/\b(holztur\w*|wooden door)\b/.test(n)) set('door.kind', 'wood');
    if (/\b(moderne tur|modern door|designtur)\b/.test(n)) set('door.kind', 'modern');
    // extras: "mit Pool und Garage", "ohne Kamin"
    const ex = new Set(S.extras || []);
    for (const E of EXTRAW) for (const [i] of hits(n, E.re)) { if (negated(toks, i)) ex.delete(E.id); else ex.add(E.id); }
    if (/\b(ohne extras|keine extras|schlicht|plain|simple)\b/.test(n)) ex.clear();
    S.extras = [...ex];
    if (/\b(leer|unmobliert|ohne mobel|ohne einrichtung|unfurnished|empty)\b/.test(n)) S.interior = false;
    if (/\b(mobliert|eingerichtet|mit mobeln|furnished)\b/.test(n)) S.interior = true;
    // colours, each to what it is next to; a lone colour paints the walls (the roof when the walls are given)
    const { bound, free } = bindColors(toks, B.colors(n), HTARGETS);
    if (bound.walls) set('walls.color', bound.walls.hex);
    if (bound.roof) set('roof.color', bound.roof.hex);
    if (bound.door) set('door.color', bound.door.hex);
    if (bound.shutters) set('windows.shutters', bound.shutters.hex);
    if (bound.frame) set('windows.frame', FRAMEOF(bound.frame.hex));
    if (bound.accent) S.accent = bound.accent.hex;
    if (free[0]) { if (!bound.walls) set('walls.color', free[0].hex); else if (!bound.roof) set('roof.color', free[0].hex); }
    if (free[1] && !bound.roof && !bound.walls) set('roof.color', free[1].hex);
    if ((bound.walls || free[0]) && !bound.roof && !(free[1] && !bound.walls)) { const w = (bound.walls || free[0]).hex, r = S.roof && S.roof.color; if (r && hueNear(w, r)) set('roof.color', /^#(f|e|d)/i.test(w) ? '#4f5663' : '#3a3d42'); }
    // a photo: the walls and the roof take its colours (unless the words said otherwise)
    if (photo && photo.ok) {
      if (!bound.walls && !free[0] && photo.mid) set('walls.color', photo.mid);
      if (!bound.roof && !(free[1] && !bound.walls) && photo.top) set('roof.color', photo.top);
      if (!fl && photo.aspect) S.floors = clamp(Math.round(photo.aspect * 2.4), 1, 3);
    }
    return { spec: S, bound, free };
  }
  function houseName(raw, kind, bound, free, spec) {
    const own = givenName(raw); if (own) return own.slice(0, 40);
    const noun = kind && kind.H.name ? kind.H.name : (spec.style === 'cabin' ? 'Hütte' : spec.style === 'modern' ? 'Haus' : 'Landhaus');
    const g = kind && kind.H.g ? kind.H.g : (noun === 'Hütte' ? 'f' : 'n');
    return adjName(bound.walls || free[0] || null, noun, g).slice(0, 40);
  }
  B.houseNote = function (spec) {
    const fl = spec.floors === 1 ? 'eine Etage' : ['', 'eine', 'zwei', 'drei', 'vier'][spec.floors] + ' Etagen';
    const ex = spec.extras.map(e => EXTRAN[e]).filter(Boolean);
    return `${WALLN[spec.walls.material] ? spec.walls.material === 'plaster' ? 'Verputzt' : WALLN[spec.walls.material][0].toUpperCase() + WALLN[spec.walls.material].slice(1) : 'Ein Haus'}, ${fl}, ${ROOFN[spec.roof.type] || 'Dach'}${ex.length ? ', mit ' + (ex.length > 1 ? ex.slice(0, -1).join(', ') + ' und ' + ex[ex.length - 1] : ex[0]) : ''} — innen eingerichtet.`;
  };
  B.house = function (raw, base, photo) {
    const n = B.norm(raw), kind = B.houseKind(n);
    const start = base ? base : HK().normalize(Object.assign({}, HK().DEFAULT, kind && kind.H.preset ? JSON.parse(JSON.stringify(kind.H.preset)) : {}, { extras: (kind && kind.H.preset && kind.H.preset.extras) || HK().DEFAULT.extras }));
    const { spec, bound, free } = houseWords(n, raw, start, kind, photo);
    // a changed house keeps its name unless the words give it a new one (or it becomes another kind of house)
    spec.name = base && !givenName(raw) && !(kind && kind.H.name && kind.H.id !== 'cottage') ? (base.name || 'Haus') : houseName(raw, kind, bound, free, spec);
    const out = HK().normalize(spec);
    return { kind: 'house', spec: out, name: out.name, notes: B.houseNote(out) };
  };

  // ================================================================ the library: things built from shapes
  // Every thing is designed once at a canonical size (front toward z = 0, x = width, y = up) with colour slots and
  // features; the wish picks the colours (each to its slot: "rote Segel", "Räder schwarz"), the features ("mit
  // Spoiler", "ohne Leiter") and the size, and the shapes are scaled so the longest side has the size asked for.
  const box = (x0, y0, z0, x1, y1, z1, color, mat, o) => Object.assign({ box: [x0, y0, z0, x1, y1, z1], color }, mat ? { mat } : null, o);
  const wedge = (x0, y0, z0, x1, y1, z1, down, color, mat, o) => Object.assign({ wedge: [x0, y0, z0, x1, y1, z1], down, color }, mat ? { mat } : null, o);
  const cyl = (x, y, z, r, len, axis, color, mat, o) => Object.assign({ cyl: [x, y, z, r, len], axis, color }, mat ? { mat } : null, o);
  const ball = (x, y, z, rx, ry, rz, color, mat, o) => Object.assign({ ball: [x, y, z, rx, ry, rz], color }, mat ? { mat } : null, o);
  const cone = (x, y, z, r, h, axis, color, mat, o) => Object.assign({ cone: [x, y, z, r, h], axis, color }, mat ? { mat } : null, o);
  const line = (x0, y0, z0, x1, y1, z1, r, color, mat, o) => Object.assign({ line: [x0, y0, z0, x1, y1, z1], r, color }, mat ? { mat } : null, o);
  const shade = (hex, k) => { const v = parseInt(String(hex).slice(1), 16); if (!Number.isFinite(v)) return hex; const f = (x) => Math.max(0, Math.min(255, Math.round(x * k))).toString(16).padStart(2, '0'); return '#' + f(v >> 16 & 255) + f(v >> 8 & 255) + f(v & 255); };
  const MR = { mirror: true }, AIR = 'air', UP = { clip: [-999, 0, -999, 999, 999, 999] };   // UP: only what is above the ground
  const DARK = '#1b1b1d', RIM = '#c0c7cf', GLASSC = '#9cc8e8', LAMP = '#fff4c0', TAIL = '#ff3030', TRIM = '#2a2a2a', WOOD = '#8b5a2b', STONE = '#9c9a94', WHITE = '#f4f4f2', LEAF = '#3f8a3a', GOLD = '#d4af37';
  const SYN = {
    wheels: 'rad|rader|radern|reifen|felge|felgen|wheels?|tires?|tyres?',
    glass: 'fenster|scheibe|scheiben|windows?|glass?|verglasung|windschutzscheibe|kuppel|dome',
    stripe: 'streifen|stripes?|rallyestreifen|dekor|zierstreifen|band|bander|ring|ringe',
    roof: 'dach|dacher|roof|spitze|spitzen|haube|kappe',
    leaves: 'blatt|blatter|blattern|laub|krone|baumkrone|leaves|blattwerk|nadeln|zweige',
    trunk: 'stamm|stamme|baumstamm|trunk|ast|aste|holz',
    sail: 'segel|sails?|segeln',
    eyes: 'auge|augen|eyes?',
  };
  const LIB = B.LIB = [];
  let CAT = 'vehicle';   // what kind of thing the next ones are (vehicle, building, nature, animal, figure, thing)
  const sufRe = (syn) => new RegExp('^\\w*(' + syn + ')(s|e|en|n|es|er|chen)?$');
  function T(id, def) {
    def.id = id; def.cat = def.cat || CAT; def.re = stemRe(def.words);
    def.slotRe = {}; for (const k in def.slots) def.slotRe[k] = def.slots[k][1] ? sufRe(def.slots[k][1]) : null;
    def.featRe = {}; for (const k in (def.feats || {})) def.featRe[k] = stemRe(def.feats[k]);
    LIB.push(def); return def;
  }
  B.T = T;

  // ---------------------------------------------------------------- vehicles
  T('firetruck', { de: 'Feuerwehrauto', g: 'n', words: ['feuerwehrauto', 'feuerwehrwagen', 'loschfahrzeug', 'loschzug', 'drehleiter', 'fire truck', 'firetruck', 'fire engine', '=feuerwehr'],
    slots: { body: ['#c8201e', 'auto|wagen|feuerwehrauto|feuerwehr|karosserie|lack|truck|body'], stripe: [WHITE, SYN.stripe], wheels: [DARK, SYN.wheels], ladder: [RIM, 'leiter|ladder'] },
    feats: { ladder: ['leiter', 'drehleiter', 'ladder'] }, on: { ladder: true },
    size: [14, 13, 36],
    build(c, f) {
      const P = [box(1, 2, 0, 12, 10, 8, c.body), box(2, 6, 0, 11, 9, 0, GLASSC, 'glass'), box(1, 7, 2, 1, 9, 6, GLASSC, 'glass', MR), box(5, 3, 0, 8, 4, 0, TRIM), box(1, 2, 0, 12, 2, 0, TRIM),
        box(2, 4, 0, 3, 4, 0, LAMP, 'light', MR), box(1, 2, 9, 12, 9, 35, c.body), box(1, 5, 0, 12, 5, 35, c.stripe),
        box(1, 3, 11, 1, 8, 16, '#b8bcc2', 'metal', MR), box(1, 3, 19, 1, 8, 24, '#b8bcc2', 'metal', MR), box(1, 3, 27, 1, 8, 32, '#b8bcc2', 'metal', MR),
        box(2, 11, 2, 4, 11, 4, '#2050ff', 'light', MR), box(2, 3, 35, 3, 4, 35, TAIL, 'light', MR),
        cyl(0, 2.5, 4, 2.6, 2, 'x', c.wheels, null, MR), cyl(0, 2.5, 23, 2.6, 2, 'x', c.wheels, null, MR), cyl(0, 2.5, 30, 2.6, 2, 'x', c.wheels, null, MR),
        cyl(0, 2.5, 4, 1.2, 1, 'x', RIM, 'metal', MR), cyl(0, 2.5, 23, 1.2, 1, 'x', RIM, 'metal', MR), cyl(0, 2.5, 30, 1.2, 1, 'x', RIM, 'metal', MR)];
      if (f.ladder) { P.push(box(5, 10, 26, 8, 10, 30, TRIM), box(3, 11, 7, 3, 11, 35, c.ladder, 'metal'), box(10, 11, 7, 10, 11, 35, c.ladder, 'metal')); for (let z = 8; z <= 34; z += 3) P.push(box(4, 11, z, 9, 11, z, c.ladder, 'metal')); }
      return P;
    },
    note: (c, f) => 'Ein Feuerwehrauto' + (f.ladder ? ' mit Drehleiter' : '') + ', Blaulicht und Geräteklappen.' });
  T('ambulance', { de: 'Krankenwagen', g: 'm', words: ['krankenwagen', 'rettungswagen', 'notarztwagen', 'ambulance', 'rtw'],
    slots: { body: [WHITE, 'wagen|krankenwagen|karosserie|lack|body'], stripe: ['#d02020', SYN.stripe], wheels: [DARK, SYN.wheels] },
    size: [14, 12, 28],
    build: (c) => [box(1, 2, 0, 12, 5, 5, c.body), wedge(1, 6, 2, 12, 9, 5, '-z', GLASSC, 'glass'), box(1, 2, 5, 12, 10, 27, c.body), box(1, 7, 6, 1, 8, 10, GLASSC, 'glass', MR), box(1, 4, 0, 12, 4, 27, c.stripe),
      box(5, 11, 6, 6, 11, 7, '#2050ff', 'light', MR), box(2, 3, 0, 3, 3, 0, LAMP, 'light', MR), box(2, 3, 27, 3, 4, 27, TAIL, 'light', MR), box(5, 6, 27, 8, 8, 27, '#d02020'),
      cyl(0, 2.5, 4, 2.4, 2, 'x', c.wheels, null, MR), cyl(0, 2.5, 22, 2.4, 2, 'x', c.wheels, null, MR), cyl(0, 2.5, 4, 1.1, 1, 'x', RIM, 'metal', MR), cyl(0, 2.5, 22, 1.1, 1, 'x', RIM, 'metal', MR)],
    note: () => 'Ein Krankenwagen mit Blaulicht und rotem Streifen.' });
  T('truck', { de: 'Lastwagen', g: 'm', words: ['lastwagen', 'lastkraftwagen', '=lkw', 'laster', 'truck', 'lorry', 'sattelschlepper', 'kipper', 'tankwagen', 'tanklaster', 'mullauto', 'mullwagen', 'transporter', 'lieferwagen', 'van'],
    slots: { cab: ['#2e6fd8', 'kabine|fuhrerhaus|lastwagen|laster|lkw|truck|cab'], cargo: ['#e6e6e6', 'ladung|aufbau|container|anhanger|kasten|cargo|tank|mulde'], wheels: [DARK, SYN.wheels] },
    feats: { tank: ['tankwagen', 'tanklaster', 'tank', 'tanker'], dump: ['kipper', 'mulde', 'dump', 'mullauto', 'mullwagen'] },
    size: [14, 14, 36],
    build(c, f) {
      const P = [box(1, 2, 0, 12, 11, 8, c.cab), box(2, 7, 0, 11, 10, 0, GLASSC, 'glass'), box(1, 8, 2, 1, 10, 6, GLASSC, 'glass', MR), box(5, 3, 0, 8, 5, 0, TRIM), box(2, 4, 0, 3, 4, 0, LAMP, 'light', MR), box(1, 2, 9, 12, 3, 35, TRIM)];
      if (f.tank) P.push(cyl(6.5, 8, 10, 5, 25, 'z', c.cargo === '#e6e6e6' ? RIM : c.cargo, 'metal'));
      else if (f.dump) P.push(box(1, 4, 10, 12, 10, 35, c.cargo === '#e6e6e6' ? '#e67e22' : c.cargo), box(2, 6, 11, 11, 10, 34, AIR));
      else P.push(box(0, 4, 10, 13, 13, 35, c.cargo));
      P.push(box(2, 4, 35, 3, 5, 35, TAIL, 'light', MR));
      for (const z of [4, 24, 30]) P.push(cyl(0, 2.5, z, 2.7, 2, 'x', c.wheels, null, MR), cyl(0, 2.5, z, 1.2, 1, 'x', RIM, 'metal', MR));
      return P;
    },
    note: (c, f) => f.tank ? 'Ein Tanklaster.' : f.dump ? 'Ein Kipper.' : 'Ein Lastwagen mit Kofferaufbau.' });
  T('bus', { de: 'Bus', g: 'm', words: ['=bus', 'busse', 'omnibus', 'reisebus', 'schulbus', 'linienbus', 'doppeldecker', 'doppeldeckerbus', 'school bus', 'double decker', 'coach'],
    slots: { body: ['#e8b400', 'bus|omnibus|karosserie|lack|body'], wheels: [DARK, SYN.wheels], stripe: [WHITE, SYN.stripe] },
    feats: { double: ['doppeldecker', 'double decker', 'zwei stockig', 'zweistockig'], school: ['schulbus', 'school'] },
    def: (f) => (f.double ? { body: '#c8201e' } : f.school ? { body: '#f5c400' } : {}),
    size: (f) => [14, f.double ? 19 : 13, 40],
    build(c, f) {
      const top = f.double ? 18 : 12, P = [box(0, 2, 0, 13, top, 39, c.body), box(1, 5, 0, 12, 10, 0, GLASSC, 'glass'), box(0, 7, 2, 0, 10, 37, GLASSC, 'glass', MR), box(2, 8, 39, 11, 10, 39, GLASSC, 'glass'), box(13, 2, 3, 13, 9, 6, '#3a3d42'),
        box(0, 4, 1, 13, 4, 38, c.stripe), box(2, 3, 0, 3, 3, 0, LAMP, 'light', MR), box(2, 3, 39, 3, 4, 39, TAIL, 'light', MR), box(4, top + 1, 15, 9, top + 1, 24, '#d0d0d0')];
      if (f.double) P.push(box(0, 13, 2, 0, 16, 37, GLASSC, 'glass', MR), box(1, 13, 0, 12, 16, 0, GLASSC, 'glass'));
      for (const z of [6, 33]) P.push(cyl(0, 2.5, z, 2.6, 2, 'x', c.wheels, null, MR), cyl(0, 2.5, z, 1.2, 1, 'x', RIM, 'metal', MR));
      return P;
    },
    note: (c, f) => f.double ? 'Ein Doppeldeckerbus.' : 'Ein Bus mit großen Fenstern.' });
  T('tractor', { de: 'Traktor', g: 'm', words: ['traktor', 'trecker', 'schlepper', 'tractor', 'bulldog'],
    slots: { body: ['#2e9e4f', 'traktor|trecker|karosserie|lack|body'], rim: ['#f1c40f', 'felge|felgen|rims?'], wheels: [DARK, 'rad|rader|reifen|wheels?|tires?'] },
    size: [14, 14, 22],
    build: (c) => [box(4, 4, 0, 9, 7, 10, c.body), box(5, 5, 0, 8, 6, 0, TRIM), box(3, 4, 11, 10, 5, 19, c.body), box(3, 6, 11, 10, 12, 19, GLASSC, 'glass'), box(3, 6, 11, 3, 12, 11, c.body, null, MR), box(3, 6, 19, 3, 12, 19, c.body, null, MR), box(2, 13, 10, 11, 13, 20, c.body),
      box(0, 7, 12, 2, 7, 20, c.body, null, MR), cyl(8, 8, 3, 0.6, 6, 'y', '#555555', 'metal'), box(5, 7, 0, 6, 7, 0, LAMP, 'light', MR),
      cyl(0, 5, 15.5, 5, 3, 'x', c.wheels, null, MR), cyl(0, 5, 15.5, 2.4, 1, 'x', c.rim, null, MR), cyl(1, 3, 4, 2.8, 2, 'x', c.wheels, null, MR), cyl(1, 3, 4, 1.3, 1, 'x', c.rim, null, MR)],
    note: () => 'Ein Traktor mit großen Hinterrädern und Kabine.' });
  T('digger', { de: 'Bagger', g: 'm', words: ['bagger', 'baggers', 'excavator', 'digger', 'radlader', 'raupe', 'planierraupe', 'bulldozer'],
    slots: { body: ['#f1c40f', 'bagger|karosserie|lack|body'], tracks: [TRIM, 'kette|ketten|tracks?'] },
    size: [13, 16, 28],
    build: (c) => [box(0, 0, 6, 3, 3, 26, c.tracks, null, MR), box(4, 3, 10, 8, 4, 22, '#333333'), box(1, 4, 9, 11, 8, 24, c.body), box(1, 9, 9, 6, 14, 16, c.body), box(1, 10, 9, 6, 13, 9, GLASSC, 'glass'), box(1, 10, 10, 1, 13, 15, GLASSC, 'glass'), box(1, 4, 24, 11, 7, 27, c.body),
      line(9, 8, 11, 9, 15, 4, 1.1, c.body), line(9, 15, 4, 9, 6, 1, 1, c.body), box(7, 2, 0, 11, 5, 2, '#3a3a3a', 'metal'), box(2, 15, 9, 5, 15, 16, c.body)],
    note: () => 'Ein Bagger mit Ketten, Kabine und Schaufel.' });
  T('car', { de: 'Auto', g: 'n', words: ['auto', 'wagen', '=pkw', 'limousine', 'kombi', 'kleinwagen', '=car', 'cars', 'sedan', 'coupe', 'cabrio', 'cabriolet', 'convertible', 'sportwagen', 'flitzer', 'rennwagen', 'race car', 'racecar', 'sports car', 'taxi', 'streifenwagen', 'police car', 'jeep', 'gelandewagen', '=suv', 'pickup', 'oldtimer', 'fahrzeug', 'vehicle'],
    slots: { body: ['#c0392b', 'auto|wagen|pkw|karosserie|lack|car|body|limousine|cabrio|taxi|jeep|suv|flitzer|oldtimer|kombi|fahrzeug'], wheels: [DARK, SYN.wheels], stripe: [WHITE, SYN.stripe], glass: [GLASSC, SYN.glass] },
    feats: { sport: ['sport', 'sportwagen', 'sportauto', 'rennwagen', 'rennauto', 'race', 'racing', 'flitzer', 'schnell', 'sports'], cabrio: ['cabrio', 'cabriolet', 'convertible', 'offen', 'ohne dach'], spoiler: ['spoiler', 'heckflugel', 'flugel'], police: ['polizei', 'police', 'streifenwagen', 'blaulicht'], taxi: ['taxi', '=cab'], stripe: ['streifen', 'stripes', 'rallyestreifen'], jeep: ['jeep', 'gelandewagen', '=suv', 'offroad', 'pickup', 'gelande'] },
    def: (f) => (f.police ? { body: WHITE } : f.taxi ? { body: '#f5c400' } : f.jeep ? { body: '#5a6a3a' } : {}),
    size: [14, 12, 30],
    build(c, f) {
      const lo = f.sport ? 1 : 0, J = f.jeep ? 1 : 0, top = f.jeep ? 11 : f.sport ? 7 : 9, wr = f.jeep ? 3.1 : 2.6, wy = f.jeep ? 3 : 2.5;
      const P = [box(1, 2 + J, 1, 12, 5 - lo + J, 28, c.body), wedge(1, 5 - lo + J, 1, 12, 6 - lo + J, 7, '-z', c.body), box(1, 5 - lo + J, 23, 12, 6 - lo + J, 28, c.body)];
      if (f.cabrio) P.push(wedge(2, 6 - lo + J, 7, 11, 7 - lo + J, 9, '-z', c.glass, 'glass'), box(3, 6 - lo + J, 11, 5, 7 - lo + J, 13, '#3a2a20', null, MR), box(3, 6 - lo + J, 17, 10, 7 - lo + J, 19, '#3a2a20'));
      else if (f.jeep) P.push(box(2, 7, 8, 11, top, 22, c.body), box(2, 8, 8, 11, 10, 8, c.glass, 'glass'), box(2, 8, 10, 2, 10, 20, c.glass, 'glass', MR), box(2, 8, 15, 2, 10, 15, c.body, null, MR), cyl(6.5, 6, 29, 2.6, 1, 'z', c.wheels));
      else P.push(box(2, 6 - lo, 9 + lo, 11, top, 21, c.body), wedge(2, 6 - lo, 6 + lo, 11, top, 9 + lo, '-z', c.glass, 'glass'), wedge(2, 6 - lo, 21, 11, top, 24, '+z', c.glass, 'glass'), box(2, 7 - lo, 10 + lo, 2, top - 1, 20, c.glass, 'glass', MR), box(2, 7 - lo, 15, 2, top - 1, 15, c.body, null, MR));
      if (f.spoiler || f.sport) P.push(box(1, 7 - lo + J, 27, 12, 7 - lo + J, 28, f.sport ? TRIM : c.body), box(3, 6 - lo + J, 27, 3, 6 - lo + J, 27, TRIM, null, MR));
      if (f.stripe) { P.push(box(6, 6 - lo + J, 23, 7, 6 - lo + J, 28, c.stripe)); if (!f.cabrio && !f.jeep) P.push(box(6, top, 10, 7, top, 20, c.stripe)); }
      if (f.police) P.push(box(1, 3 + J, 3, 1, 4 + J, 26, '#1f4ed8', null, MR), box(4, top + 1, 14, 6, top + 1, 16, '#2050ff', 'light'), box(7, top + 1, 14, 9, top + 1, 16, '#ff2020', 'light'));
      if (f.taxi) P.push(box(5, top + 1, 14, 8, top + 2, 16, LAMP, 'light'));
      P.push(box(2, 4 - lo + J, 0, 3, 4 - lo + J, 0, LAMP, 'light', MR), box(2, 4 - lo + J, 29, 3, 4 - lo + J, 29, TAIL, 'light', MR), box(5, 3 + J, 0, 8, 3 + J, 0, TRIM), box(1, 2 + J, 0, 12, 2 + J, 0, TRIM), box(1, 2 + J, 29, 12, 2 + J, 29, TRIM), box(1, 7 - lo + J, 8, 1, 7 - lo + J, 8, c.body, null, MR));
      for (const z of [6, 23]) P.push(cyl(0, wy, z, wr, 2, 'x', c.wheels, null, MR), cyl(0, wy, z, wr * 0.45, 1, 'x', RIM, 'metal', MR));
      return P;
    },
    note: (c, f) => 'Ein ' + (f.police ? 'Polizeiauto mit Blaulicht' : f.taxi ? 'Taxi' : f.jeep ? 'Geländewagen' : f.sport ? 'Sportwagen' : f.cabrio ? 'Cabrio' : 'Auto') + (f.spoiler && !f.sport ? ' mit Spoiler' : '') + (f.stripe ? ' mit Streifen' : '') + '.' });
  T('train', { de: 'Lokomotive', g: 'f', words: ['lokomotive', '=lok', 'dampflok', 'dampflokomotive', 'eisenbahn', '=zug', 'zuge', 'train', 'locomotive', 'steam engine', 'bahn'],
    slots: { body: ['#1d1f22', 'lok|lokomotive|kessel|dampflok|boiler|zug|train'], cab: ['#8b1e1e', 'kabine|fuhrerhaus|cab|fuhrerstand'], wheels: ['#c0392b', SYN.wheels], wagon: ['#2e6a4f', 'wagen|wagon|waggon|anhanger|wagons'] },
    feats: { wagon: ['=zug', 'zuge', 'train', 'wagen', 'wagon', 'waggon', 'personenzug', 'eisenbahn'] },
    size: (f) => [12, 15, f.wagon ? 56 : 30],
    build(c, f) {
      const P = [box(1, 2, 1, 10, 3, 28, TRIM), cyl(5.5, 7, 1, 3.4, 19, 'z', c.body), cyl(5.5, 7, 0, 3.6, 1, 'z', '#333333'), box(5, 7, 0, 6, 7, 0, LAMP, 'light'), cyl(5.5, 10, 4, 1.1, 4, 'y', TRIM), cyl(5.5, 13, 4, 1.6, 1, 'y', TRIM), cyl(5.5, 10, 11, 1.4, 2, 'y', GOLD, 'metal'),
        box(1, 4, 20, 10, 12, 27, c.cab), box(1, 9, 21, 1, 11, 26, GLASSC, 'glass', MR), box(0, 13, 19, 11, 13, 28, TRIM), box(1, 1, 0, 10, 2, 0, '#555555', 'metal')];
      for (const z of [5, 12, 19]) P.push(cyl(0, 3, z, 3, 2, 'x', c.wheels, null, MR), cyl(0, 3, z, 1.2, 1, 'x', RIM, 'metal', MR));
      if (f.wagon) { P.push(box(1, 3, 31, 10, 11, 54, c.wagon), box(1, 7, 33, 1, 9, 52, GLASSC, 'glass', MR), box(0, 12, 30, 11, 12, 55, '#3a3d42'), box(5, 3, 28, 6, 3, 31, TRIM)); for (const z of [34, 51]) P.push(cyl(0, 2.5, z, 2.4, 2, 'x', TRIM, null, MR)); }
      return P;
    },
    note: (c, f) => 'Eine Dampflok' + (f.wagon ? ' mit Personenwagen' : '') + '.' });
  T('bike', { de: 'Fahrrad', g: 'n', words: ['fahrrad', 'fahrrader', 'velo', 'rad fahren', 'bicycle', '=bike', 'mountainbike', 'rennrad'],
    slots: { body: ['#2e6fd8', 'fahrrad|rahmen|frame|bike|rad'], wheels: [DARK, 'reifen|rader|wheels?|tires?'] },
    size: [5, 13, 20],
    build: (c) => [cyl(2, 5, 4, 4.5, 1, 'x', c.wheels, null, { inner: 3.4 }), cyl(2, 5, 15, 4.5, 1, 'x', c.wheels, null, { inner: 3.4 }), box(2, 5, 4, 2, 5, 4, RIM), box(2, 5, 15, 2, 5, 15, RIM),
      line(2, 5, 4, 2, 10, 7, 0.45, c.body), line(2, 9, 7, 2, 9, 13, 0.45, c.body), line(2, 9, 13, 2, 5, 15, 0.45, c.body), line(2, 5, 15, 2, 5, 10, 0.45, c.body), line(2, 5, 10, 2, 9, 7, 0.45, c.body), line(2, 9, 13, 2, 11, 13, 0.45, c.body),
      box(1, 11, 12, 3, 11, 14, TRIM), box(0, 10, 7, 4, 10, 7, TRIM), box(1, 4, 10, 3, 4, 10, TRIM)],
    note: () => 'Ein Fahrrad.' });
  T('motorbike', { de: 'Motorrad', g: 'n', words: ['motorrad', 'motorrader', 'roller', 'vespa', 'moped', 'motorcycle', 'motorbike', 'chopper', 'scooter'],
    slots: { body: ['#c0392b', 'motorrad|tank|verkleidung|body|roller'], wheels: [DARK, SYN.wheels] },
    size: [7, 11, 19],
    build: (c) => [cyl(2, 3.5, 3.5, 3.5, 3, 'x', c.wheels), cyl(2, 3.5, 3.5, 1.4, 3, 'x', RIM, 'metal'), cyl(2, 3.5, 15, 3.5, 3, 'x', c.wheels), cyl(2, 3.5, 15, 1.4, 3, 'x', RIM, 'metal'),
      box(2, 4, 7, 4, 6, 12, '#555555', 'metal'), ball(3, 8, 9, 2, 1.5, 3, c.body), box(2, 8, 11, 4, 8, 15, TRIM), line(3, 4, 3.5, 3, 10, 5, 0.5, RIM, 'metal'), box(0, 10, 5, 6, 10, 5, TRIM), box(3, 8, 3, 3, 8, 3, LAMP, 'light'), line(5, 4, 9, 5, 4, 17, 0.5, RIM, 'metal'), box(2, 7, 15, 4, 7, 17, c.body)],
    note: () => 'Ein Motorrad.' });

  // ---------------------------------------------------------------- air and space
  T('plane', { de: 'Flugzeug', g: 'n', words: ['flugzeug', 'flugzeuge', 'flieger', 'jet', 'airplane', 'aeroplane', 'plane', 'passagierflugzeug', 'airbus', 'boing', 'doppeldecker flugzeug', 'propellerflugzeug', 'kampfjet', 'segelflugzeug'],
    slots: { body: [WHITE, 'flugzeug|flieger|rumpf|jet|body|plane'], stripe: ['#2e6fd8', 'streifen|leitwerk|heck|stripes?|tail'], wings: [WHITE, 'flugel|tragflachen|wings?'] },
    feats: { prop: ['propeller', 'propellerflugzeug', 'doppeldecker', 'oldtimer'] },
    size: [27, 11, 32],
    build(c, f) {
      const P = [cyl(13, 4, 4, 3, 24, 'z', c.body), cone(13, 4, 4, 3, 4, '-z', c.body), cone(13, 4.5, 28, 2.6, 4, '+z', c.body), box(11, 6, 3, 15, 6, 6, GLASSC, 'glass'), box(0, 3, 12, 26, 3, 18, c.wings), box(0, 4, 16, 0, 6, 18, c.stripe, null, MR),
        box(7, 5, 27, 19, 5, 31, c.body), wedge(13, 6, 24, 13, 11, 31, '-z', c.stripe), box(10, 5, 7, 10, 5, 26, GLASSC, 'glass', MR)];
      if (f.prop) P.push(box(9, 4, 0, 17, 4, 0, '#555555', 'metal'), box(13, 0, 0, 13, 8, 0, '#555555', 'metal'), box(12, 3, 0, 14, 5, 0, TRIM));
      else P.push(cyl(6, 2, 10, 1.3, 5, 'z', RIM, 'metal', MR));
      return P;
    },
    note: (c, f) => f.prop ? 'Ein Propellerflugzeug.' : 'Ein Passagierflugzeug mit Triebwerken.' });
  T('heli', { de: 'Hubschrauber', g: 'm', words: ['hubschrauber', 'helikopter', 'helicopter', 'heli', 'rettungshubschrauber'],
    slots: { body: ['#c0392b', 'hubschrauber|helikopter|rumpf|body|heli'], rotor: [TRIM, 'rotor|rotoren|blatter|propeller'] },
    size: [25, 12, 30],
    build: (c) => [ball(12, 5, 9, 4, 4, 6, c.body), ball(12, 5, 5, 3.4, 3.2, 3, GLASSC, 'glass'), line(12, 6, 14, 12, 7, 27, 0.9, c.body), box(12, 7, 26, 12, 10, 29, c.body), box(13, 7, 26, 13, 9, 28, c.rotor), cyl(12, 9, 9, 0.6, 2, 'y', '#555555', 'metal'),
      box(0, 11, 8, 24, 11, 9, c.rotor), box(12, 11, 0, 12, 11, 19, c.rotor), box(8, 0, 4, 8, 0, 14, '#555555', 'metal', MR), box(8, 1, 6, 8, 2, 6, '#555555', 'metal', MR), box(8, 1, 12, 8, 2, 12, '#555555', 'metal', MR)],
    note: () => 'Ein Hubschrauber mit Rotor und Kufen.' });
  T('rocket', { de: 'Rakete', g: 'f', words: ['rakete', 'raketen', 'rocket', 'raumschiff', 'spaceship', 'space shuttle', 'shuttle'],
    slots: { body: [WHITE, 'rakete|korper|body|rocket|rumpf'], nose: ['#c0392b', 'spitze|nase|nose|flossen|fins?'], stripe: ['#2e6fd8', SYN.stripe] },
    size: [13, 33, 13],
    build: (c) => [cone(6, 4, 6, 2.5, 4, '-y', '#ff8c1a', 'light'), cyl(6, 4, 6, 4, 20, 'y', c.body), cyl(6, 10, 6, 4, 2, 'y', c.stripe), cone(6, 24, 6, 4, 9, 'y', c.nose), ball(6, 17, 2.2, 1.6, 1.6, 1.2, GLASSC, 'glass'),
      wedge(0, 4, 5, 2, 10, 7, '-x', c.nose, null, MR), wedge(5, 4, 0, 7, 10, 2, '-z', c.nose), wedge(5, 4, 10, 7, 10, 12, '+z', c.nose)],
    note: () => 'Eine Rakete mit Flossen und Bullauge.' });
  T('ufo', { de: 'UFO', g: 'n', words: ['ufo', 'ufos', 'fliegende untertasse', 'flying saucer', 'alien', 'aliens', 'raumschiff alien'],
    slots: { body: ['#b8c2cc', 'ufo|untertasse|body|scheibe'], glass: ['#9cf0e0', 'kuppel|dome|glass?'], lights: ['#7fffd4', 'licht|lichter|lights?|lampen'] },
    size: [21, 10, 21],
    build(c) { const P = [ball(10, 4, 10, 10, 1.8, 10, c.body, 'metal'), ball(10, 6, 10, 5, 4, 5, c.glass, 'glass'), ball(10, 7, 10, 1.6, 1.6, 1.6, '#5fd35f'), line(5, 3, 5, 3, 0, 3, 0.5, RIM, 'metal', MR), line(5, 3, 15, 3, 0, 17, 0.5, RIM, 'metal', MR)]; for (let a = 0; a < 8; a++) P.push(ball(10 + 7.6 * Math.cos(a * Math.PI / 4), 3.2, 10 + 7.6 * Math.sin(a * Math.PI / 4), 0.8, 0.8, 0.8, c.lights, 'light')); return P; },
    note: () => 'Eine fliegende Untertasse — mit Gast unter der Kuppel.' });
  T('balloon', { de: 'Heißluftballon', g: 'm', words: ['heissluftballon', 'ballon', 'ballone', 'hot air balloon', 'balloon', 'luftballon'],
    slots: { body: ['#d6281f', 'ballon|hulle|body|balloon'], stripe: ['#f1c40f', SYN.stripe], basket: [WOOD, 'korb|basket|gondel'] },
    size: [17, 28, 17],
    build: (c) => [ball(8, 18, 8, 7.5, 8.5, 7.5, c.body), cyl(8, 16, 8, 7.6, 2, 'y', c.stripe), cyl(8, 21, 8, 7.2, 1, 'y', c.stripe), cone(8, 10.5, 8, 5, 4, '-y', c.body), box(6, 0, 6, 10, 3, 10, c.basket, 'wood'), box(7, 1, 7, 9, 3, 9, AIR), box(7, 5, 7, 9, 5, 9, '#555555', 'metal'),
      line(6, 3, 6, 4.5, 9, 4.5, 0.35, '#5a4630', null, MR), line(6, 3, 10, 4.5, 9, 11.5, 0.35, '#5a4630', null, MR)],
    note: () => 'Ein Heißluftballon mit Korb.' });

  // ---------------------------------------------------------------- on the water
  T('sailboat', { de: 'Segelboot', g: 'n', words: ['segelboot', 'segelboote', 'segelyacht', 'segler', 'sailboat', 'sailing boat', 'yacht', 'jacht', 'katamaran'],
    slots: { body: [WHITE, 'boot|rumpf|segelboot|yacht|hull|boat'], sail: [WHITE, SYN.sail], cabin: ['#8b5a2b', 'kabine|aufbau|cabin|deck'] },
    size: [13, 26, 26],
    build: (c) => [ball(6, 3, 12.5, 6, 3, 12.5, c.body), box(0, 4, 0, 12, 7, 25, AIR), ball(6, 4, 12.5, 4.8, 1, 10.5, AIR), box(4, 3, 14, 8, 5, 19, c.cabin, 'wood'), box(5, 4, 14, 7, 4, 14, GLASSC, 'glass'),
      line(6, 3, 10, 6, 25, 10, 0.5, WOOD, 'wood'), line(6, 6, 10, 6, 6, 21, 0.4, WOOD, 'wood'), wedge(6, 7, 11, 6, 24, 20, '+z', c.sail), wedge(6, 5, 2, 6, 22, 9, '-z', c.sail), box(6, 25, 10, 6, 25, 12, '#c0392b')],
    note: () => 'Ein Segelboot mit Großsegel, Fock und Kajüte.' });
  T('pirate', { de: 'Piratenschiff', g: 'n', words: ['piratenschiff', 'piraten', 'pirate ship', 'galeone', 'galleon', 'segelschiff', 'viermaster', 'dreimaster', 'tall ship'],
    slots: { body: ['#6b4423', 'rumpf|schiff|hull|ship|holz'], sail: [WHITE, SYN.sail], flag: ['#111111', 'flagge|fahne|flag'] },
    size: [16, 30, 44],
    build(c) {
      const P = [];
      for (let k = 0; k < 6; k++) P.push(box(1 + k, 0, 6 - k, 14 - k, 6, 6 - k, c.body, 'wood'));
      P.push(box(1, 0, 6, 14, 6, 41, c.body, 'wood'), box(2, 2, 7, 13, 6, 40, AIR), box(2, 2, 7, 13, 2, 40, '#8b5a2b', 'wood'), box(1, 7, 34, 14, 11, 43, c.body, 'wood'), box(1, 7, 6, 14, 7, 33, '#4a2c1a', 'wood'),
        box(2, 9, 43, 13, 10, 43, GLASSC, 'glass'), box(1, 1, 0, 14, 1, 41, GOLD));
      for (const [z, h] of [[12, 27], [22, 29], [31, 24]]) { P.push(line(7.5, 2, z, 7.5, h, z, 0.55, WOOD, 'wood'), box(2, h - 12, z + 1, 13, h - 4, z + 1, c.sail), box(3, h - 20, z + 1, 12, h - 13, z + 1, c.sail)); }
      P.push(box(7, 26, 22, 7, 28, 25, c.flag), line(7.5, 6, 0, 7.5, 10, -6, 0.4, WOOD, 'wood'));
      for (const z of [10, 16, 22, 28]) P.push(cyl(0, 4, z, 0.8, 2, 'x', '#222222', 'metal', MR));
      return P;
    },
    note: () => 'Ein Piratenschiff mit drei Masten, Rahsegeln und Kanonen.' });
  T('cruise', { de: 'Kreuzfahrtschiff', g: 'n', words: ['kreuzfahrtschiff', 'kreuzfahrer', 'cruise ship', 'ozeandampfer', 'dampfer', 'passagierschiff', 'titanic', 'luxusliner', 'fahre', 'ferry'],
    slots: { body: [WHITE, 'schiff|rumpf|hull|ship'], stripe: ['#1f3a7a', SYN.stripe], chimney: ['#c0392b', 'schornstein|kamin|schlot|funnel'] },
    size: [16, 22, 50],
    build(c) {
      const P = [];
      for (let k = 0; k < 6; k++) P.push(box(1 + k, 0, 6 - k, 14 - k, 6, 6 - k, c.body));
      P.push(box(1, 0, 6, 14, 6, 47, c.body), box(1, 2, 0, 14, 2, 47, c.stripe), box(2, 7, 9, 13, 9, 45, c.body), box(2, 8, 10, 2, 8, 44, GLASSC, 'glass', MR), box(3, 10, 13, 12, 12, 42, c.body), box(3, 11, 14, 3, 11, 41, GLASSC, 'glass', MR),
        box(4, 13, 17, 11, 14, 38, c.body), box(4, 13, 17, 11, 14, 17, GLASSC, 'glass'), cyl(7.5, 15, 33, 2, 6, 'y', c.chimney), cyl(7.5, 20, 33, 2.1, 1, 'y', TRIM), box(5, 10, 23, 10, 10, 28, '#3fa7d6', 'water'));
      return P;
    },
    note: () => 'Ein Kreuzfahrtschiff mit Decks, Fensterreihen, Pool und Schornstein.' });
  T('submarine', { de: 'U-Boot', g: 'n', words: ['u boot', 'uboot', 'unterseeboot', 'submarine', 'gelbes u boot'],
    slots: { body: ['#3a3d42', 'boot|rumpf|hull|body'], tower: ['#3a3d42', 'turm|tower'] },
    def: (f, raw) => (/gelb|yellow/.test(raw) ? { body: '#f1c40f', tower: '#f1c40f' } : {}),
    size: [10, 14, 40],
    build: (c) => [ball(4.5, 4.5, 20, 4.5, 4.5, 19.5, c.body, 'metal'), box(3, 8, 14, 6, 12, 22, c.tower, 'metal'), line(4.5, 12, 16, 4.5, 14, 16, 0.4, '#555555', 'metal'), box(4, 14, 15, 5, 14, 16, '#555555'), cyl(4.5, 4.5, 39, 2, 1, 'z', GOLD, 'metal'),
      box(0, 4, 26, 1, 4, 30, c.body, null, MR), ball(4.5, 5, 1.5, 1.2, 1.2, 0.8, GLASSC, 'glass'), box(4, 10, 14, 5, 11, 14, GLASSC, 'glass')],
    note: () => 'Ein U-Boot mit Turm und Periskop.' });
  T('ship', { de: 'Schiff', g: 'n', words: ['schiff', 'schiffe', 'frachter', 'frachtschiff', 'containerschiff', 'tanker', 'kutter', 'fischkutter', 'trawler', 'ship', 'freighter', 'cargo ship', 'dampfschiff'],
    slots: { body: ['#1f3a7a', 'schiff|rumpf|hull|ship|frachter|kutter'], deck: ['#8a4a2a', 'deck|decks'], bridge: [WHITE, 'brucke|aufbau|bridge|kabine'] },
    feats: { containers: ['container', 'containerschiff', 'frachter', 'fracht', 'cargo', 'ladung'] }, on: { containers: true },
    size: [16, 20, 50],
    build(c, f) {
      const P = [];
      for (let k = 0; k < 6; k++) P.push(box(1 + k, 0, 6 - k, 14 - k, 5, 6 - k, c.body), box(1 + k, 5, 6 - k, 14 - k, 5, 6 - k, c.deck));
      P.push(box(1, 0, 6, 14, 5, 47, c.body), box(1, 5, 6, 14, 5, 47, c.deck), box(1, 1, 0, 14, 1, 47, '#c0392b'),
        box(3, 6, 38, 12, 13, 45, c.bridge), box(3, 11, 38, 12, 12, 38, GLASSC, 'glass'), box(3, 9, 39, 3, 10, 44, GLASSC, 'glass', MR), cyl(7.5, 14, 42, 1.6, 5, 'y', '#c0392b'), cyl(7.5, 18, 42, 1.7, 1, 'y', TRIM), line(7.5, 6, 3, 7.5, 13, 3, 0.4, '#555555', 'metal'));
      if (f.containers) { const K = ['#c0392b', '#2e6fd8', '#27ae60', '#e67e22', '#8e44ad', '#f1c40f']; let i = 0; for (let z = 9; z <= 31; z += 6) for (const [x0, x1] of [[2, 6], [9, 13]]) P.push(box(x0, 6, z, x1, 9, z + 4, K[i++ % K.length], 'metal')); }
      return P;
    },
    note: (c, f) => f.containers ? 'Ein Containerschiff mit Brücke und Schornstein.' : 'Ein Schiff mit Brücke und Schornstein.' });
  T('boat', { de: 'Boot', g: 'n', words: ['=boot', 'boote', 'ruderboot', 'fischerboot', 'kanu', 'kanus', 'cano', 'canoe', 'kajak', 'kayak', 'gondel', 'motorboot', 'speedboot', '=boat', 'rowboat', 'dinghy', 'hausboot', 'floss', 'raft'],
    slots: { body: ['#8b5a2b', 'boot|rumpf|hull|boat|kanu|holz'], seat: ['#a0703a', 'sitz|sitze|bank|seats?'] },
    feats: { motor: ['motorboot', 'speedboot', 'motor', 'speedboat', 'aussenborder'] },
    def: (f) => (f.motor ? { body: WHITE } : {}),
    size: [10, 5, 22],
    build(c, f) {
      const P = [ball(4.5, 3, 10.5, 4.5, 3, 10.5, c.body, f.motor ? null : 'wood'), box(0, 4, 0, 9, 7, 21, AIR), ball(4.5, 4, 10.5, 3.5, 1, 9.5, AIR), box(1, 3, 8, 8, 3, 8, c.seat, 'wood'), box(1, 3, 14, 8, 3, 14, c.seat, 'wood')];
      if (f.motor) P.push(box(3, 3, 19, 6, 6, 21, TRIM), box(2, 4, 5, 7, 5, 6, GLASSC, 'glass'));
      return P;
    },
    note: (c, f) => f.motor ? 'Ein Motorboot.' : 'Ein Holzboot mit zwei Sitzbänken.' });

  // ---------------------------------------------------------------- buildings and landmarks (one piece: a model, not a house)
  CAT = 'building';
  // merlons around a round tower's top
  const crown = (cx, y, cz, r, color, mat) => { const P = [], n = Math.max(6, Math.round(r * 1.6)); for (let a = 0; a < n; a++) { const t = a * 2 * Math.PI / n; P.push(box(Math.round(cx + (r - 0.5) * Math.cos(t)), y, Math.round(cz + (r - 0.5) * Math.sin(t)), Math.round(cx + (r - 0.5) * Math.cos(t)), y + 1, Math.round(cz + (r - 0.5) * Math.sin(t)), color, mat)); } return P; };
  // merlons along a wall top (x0..x1 at z, or along z when alongZ)
  const merlons = (a0, a1, y, at, alongZ, color, mat) => { const P = []; for (let a = a0; a <= a1; a += 2) P.push(alongZ ? box(at, y, a, at, y, a, color, mat) : box(a, y, at, a, y, at, color, mat)); return P; };
  // a cylinder tapering from r0 to r1, in bands of alternating colours
  const taper = (cx, y0, cz, r0, r1, h, cols, band, mat) => { const P = []; for (let y = 0; y < h; y += band) { const t = Math.min(1, (y + band / 2) / h); P.push(cyl(cx, y0 + y, cz, r0 + (r1 - r0) * t, Math.min(band, h - y), 'y', cols[(y / band | 0) % cols.length], mat)); } return P; };
  T('lighthouse', { de: 'Leuchtturm', g: 'm', words: ['leuchtturm', 'leuchtturme', 'lighthouse', 'leuchtfeuer', 'leuchtturmchen'],
    slots: { body: [WHITE, 'turm|tower|leuchtturm|wand|wande|walls?'], stripe: ['#c0392b', 'streifen|stripes?|ringe|bander'], roof: ['=stripe', SYN.roof + '|kuppel|haube'], lamp: [LAMP, 'licht|lampe|leuchte|light|lamp'] },
    feats: { stripes: ['streifen', 'gestreift', 'geringelt', 'stripes', 'striped'] }, on: { stripes: true }, alt: 'stripe',
    size: [15, 42, 15],
    build(c, f) {
      const P = [cyl(7, 0, 7, 7, 3, 'y', STONE, 'stone'), cyl(7, 3, 7, 6, 1, 'y', '#7d7a74', 'stone')];
      P.push(...taper(7, 4, 7, 4.8, 3.2, 26, f.stripes ? [c.body, c.stripe] : [c.body], f.stripes ? 5 : 26));
      P.push(box(6, 4, 2, 8, 7, 3, WOOD, 'wood'), box(7, 13, 3, 7, 14, 3, GLASSC, 'glass'), box(7, 22, 3, 7, 23, 3, GLASSC, 'glass'),
        cyl(7, 30, 7, 5, 1, 'y', TRIM, 'metal'), cyl(7, 31, 7, 5, 1, 'y', TRIM, 'metal', { inner: 4.1 }),
        cyl(7, 31, 7, 2.7, 5, 'y', GLASSC, 'glass'), cyl(7, 32, 7, 1.3, 3, 'y', c.lamp, 'light'), cyl(7, 36, 7, 3.3, 1, 'y', c.roof), cone(7, 37, 7, 3.3, 4, 'y', c.roof), line(7, 40, 7, 7, 42, 7, 0.3, TRIM, 'metal'));
      return P;
    },
    note: (c, f) => 'Ein Leuchtturm' + (f.stripes ? ' mit Streifen' : '') + ', Galerie und leuchtender Laterne.' });
  T('windmill', { de: 'Windmühle', g: 'f', words: ['windmuhle', 'windmuhlen', '=muhle', 'windmill', '=mill', 'hollandermuhle', 'getreidemuhle'],
    slots: { body: ['#efe6cf', 'turm|muhle|windmuhle|wand|wande|tower|body|walls?'], roof: ['#6b4a2b', SYN.roof], sail: [WHITE, 'flugel|flugeln|segel|blatter|sails?|blades?'] },
    size: [26, 38, 14],
    build(c) {
      const P = [...taper(13, 0, 8, 6, 4.4, 22, [c.body], 22), cyl(13, 0, 8, 6.2, 2, 'y', STONE, 'stone'), cone(13, 22, 8, 5.4, 7, 'y', c.roof),
        box(12, 2, 2, 14, 6, 3, WOOD, 'wood'), box(13, 10, 2, 13, 11, 3, GLASSC, 'glass'), box(13, 15, 3, 13, 16, 3, GLASSC, 'glass'), box(9, 8, 6, 9, 9, 6, GLASSC, 'glass', MR),
        cyl(13, 22, 1, 1.2, 3, 'z', TRIM, 'metal')];
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        P.push(line(13, 22, 1, 13 + dx * 12, 22 + dy * 12, 1, 0.45, WOOD, 'wood'));
        for (let t = 0.3; t <= 1; t += 0.12) { const x = 13 + dx * 12 * t, y = 22 + dy * 12 * t; P.push(line(x - dy * 0.2, y + dx * 0.2, 0, x + dy * 2.2, y - dx * 2.2, 0, 0.55, c.sail)); }
      }
      return P;
    },
    note: () => 'Eine Windmühle mit vier Flügeln und Kappe.' });
  T('turbine', { de: 'Windrad', g: 'n', words: ['windrad', 'windrader', 'windkraftanlage', 'windkraftwerk', 'wind turbine', 'windturbine'],
    slots: { body: [WHITE, 'mast|turm|windrad|tower|body'], blades: [WHITE, 'flugel|rotor|blatter|blades?'] },
    size: [26, 46, 8],
    build: (c) => [cyl(13, 0, 4, 1.6, 30, 'y', c.body), box(11, 29, 3, 15, 32, 9, c.body), cyl(13, 30.5, 1, 1.4, 2, 'z', c.blades),
      line(13, 30.5, 1, 13, 45, 1, 0.8, c.blades), line(13, 30.5, 1, 0.5, 23.5, 1, 0.8, c.blades), line(13, 30.5, 1, 25.5, 23.5, 1, 0.8, c.blades), box(12, 1, 2, 14, 3, 2, TRIM)],
    note: () => 'Ein Windrad mit drei Rotorblättern.' });
  T('castle', { de: 'Burg', g: 'f', words: ['burg', 'burgen', 'ritterburg', 'festung', 'castle', 'fortress', 'fort', 'schloss', 'schlosser', 'marchenschloss', 'prinzessinnenschloss', 'zauberschloss', 'sandburg', 'sandcastle', 'sand castle', 'citadel', 'zitadelle'],
    slots: { body: ['#9c9a94', 'mauer|mauern|wand|wande|burg|schloss|stein|walls?|castle|turme|turm'], roof: ['#3a5fb0', SYN.roof + '|turmspitzen|spitzdacher'], flag: ['#c0392b', 'flagge|fahne|fahnen|flags?|banner'] },
    feats: { fairy: ['schloss', 'marchenschloss', 'prinzessinnenschloss', 'zauberschloss', 'prinzessin', 'marchen', 'fairy', 'palace', 'spitze turme', 'spitzdach', 'spitzdacher'], sand: ['sandburg', 'sandcastle', 'sand castle', '=sand'] },
    def: (f) => (f.sand ? { body: '#e2c98f', flag: '#e74c3c', roof: '#d9bd7e' } : f.fairy ? { body: '#f4efe6', roof: '#e8478f' } : {}),
    nameOf: (f) => (f.sand ? ['Sandburg', 'f'] : f.fairy ? ['Schloss', 'n'] : null),
    size: (f) => [37, f.fairy ? 40 : 30, 33],
    build(c, f) {
      const P = [], B0 = c.body, sandy = f.sand ? null : 'stone', H = f.fairy ? 12 : 11, TH = f.fairy ? 20 : 16, D = '#5f5d58';
      // walls with a walk on top
      P.push(box(4, 0, 2, 32, H, 3, B0, sandy), box(4, 0, 29, 32, H, 30, B0, sandy), box(2, 0, 4, 3, H, 28, B0, sandy), box(33, 0, 4, 34, H, 28, B0, sandy));
      if (!f.fairy) P.push(...merlons(5, 31, H + 1, 2, false, B0, sandy), ...merlons(5, 31, H + 1, 30, false, B0, sandy), ...merlons(5, 27, H + 1, 2, true, B0, sandy), ...merlons(5, 27, H + 1, 34, true, B0, sandy));
      // corner towers
      for (const [x, z] of [[4, 4], [32, 4], [4, 28], [32, 28]]) {
        P.push(cyl(x, 0, z, 4, TH, 'y', B0, sandy), box(x, 7, z - 4, x, 8, z - 4, D));
        if (f.fairy) P.push(cyl(x, TH, z, 4.4, 1, 'y', B0, sandy), cone(x, TH + 1, z, 4.6, 9, 'y', c.roof), line(x, TH + 9, z, x, TH + 12, z, 0.3, TRIM, 'metal'), box(x, TH + 11, z, x, TH + 12, z + 2, c.flag));
        else P.push(cyl(x, TH, z, 4.6, 1, 'y', B0, sandy), ...crown(x, TH + 1, z, 4.6, B0, sandy));
      }
      // gatehouse with a gate and a portcullis
      P.push(box(13, 0, 0, 23, H + 4, 5, B0, sandy), box(15, 0, 0, 21, 7, 5, AIR), cyl(18, 7, 0, 3, 6, 'z', AIR), box(15, 0, 0, 21, 9, 0, AIR), box(16, 0, 1, 20, 8, 1, '#3a3a3a', 'metal'), box(17, 0, 1, 19, 7, 1, AIR));
      if (!f.fairy) P.push(...merlons(13, 23, H + 5, 0, false, B0, sandy)); else P.push(wedge(13, H + 5, 0, 18, H + 9, 5, '-x', c.roof), wedge(18, H + 5, 0, 23, H + 9, 5, '+x', c.roof));
      // the keep
      const KH = f.fairy ? 26 : 22;
      P.push(box(11, 0, 14, 25, KH, 26, B0, sandy), box(15, 14, 13, 15, 16, 13, GLASSC, 'glass'), box(21, 14, 13, 21, 16, 13, GLASSC, 'glass'), box(18, 9, 13, 18, 11, 13, GLASSC, 'glass'));
      if (f.fairy) P.push(wedge(11, KH + 1, 14, 18, KH + 7, 26, '-x', c.roof), wedge(18, KH + 1, 14, 25, KH + 7, 26, '+x', c.roof), cyl(18, KH + 1, 20, 3, 4, 'y', B0), cone(18, KH + 5, 20, 3.5, 9, 'y', c.roof), box(18, KH + 13, 20, 18, KH + 14, 22, c.flag));
      else P.push(...merlons(11, 25, KH + 1, 14, false, B0, sandy), ...merlons(11, 25, KH + 1, 26, false, B0, sandy), ...merlons(15, 25, KH + 1, 11, true, B0, sandy), ...merlons(15, 25, KH + 1, 25, true, B0, sandy), line(18, KH + 1, 20, 18, KH + 8, 20, 0.35, TRIM, 'metal'), box(18, KH + 6, 21, 18, KH + 8, 24, c.flag));
      if (!f.sand) P.push(box(5, 0, 5, 31, 0, 27, f.fairy ? '#7ec850' : '#7d7a74'));
      return P;
    },
    note: (c, f) => f.sand ? 'Eine Sandburg mit Türmen, Tor und Fahnen.' : f.fairy ? 'Ein Märchenschloss mit spitzen Türmen und Fahnen.' : 'Eine Burg mit Mauern, vier Türmen, Tor mit Fallgitter und Bergfried.' });
  T('church', { de: 'Kirche', g: 'f', words: ['kirche', 'kirchen', 'kapelle', 'kapellen', '=dom', 'kathedrale', 'munster', 'church', 'chapel', 'cathedral', 'gotteshaus', 'dorfkirche', 'bergkapelle'],
    slots: { body: [WHITE, 'kirche|kapelle|wand|wande|walls?|church|turm|tower'], roof: ['#7a3b2e', SYN.roof + '|turmspitze|spire'] },
    feats: { small: ['kapelle', 'kapellen', 'chapel', 'bergkapelle', 'klein', 'kleine'] },
    nameOf: (f) => (f.small ? ['Kapelle', 'f'] : null),
    size: (f) => [16, f.small ? 26 : 38, f.small ? 22 : 32],
    build(c, f) {
      const L = f.small ? 21 : 31, TH = f.small ? 13 : 21, P = [];
      P.push(box(2, 0, 7, 13, 9, L, c.body), wedge(1, 10, 6, 7, 15, L + 1, '-x', c.roof, null, MR), box(4, 10, 7, 11, 13, 7, c.body), wedge(4, 10, 7, 7, 13, 7, '-x', c.body, null, MR));
      for (let z = 10; z <= L - 3; z += 4) P.push(box(2, 3, z, 2, 7, z + 1, '#c9a227', 'glass', MR));
      P.push(box(4, 0, 1, 11, TH, 7, c.body), box(6, 0, 1, 9, 4, 1, WOOD, 'wood'), cyl(7.5, 4, 1, 2, 1, 'z', WOOD, 'wood'), box(5, 0, 0, 10, 0, 0, STONE, 'stone'),
        cyl(7.5, TH - 6, 1, 1.6, 1, 'z', WHITE), box(7, TH - 6, 0, 8, TH - 6, 0, TRIM), box(4, TH - 3, 1, 11, TH - 1, 7, AIR), box(5, TH - 3, 2, 10, TH - 1, 6, c.body), box(6, TH - 3, 1, 9, TH - 1, 7, AIR), box(4, TH - 3, 3, 11, TH - 1, 5, AIR), box(7, TH - 2, 3, 8, TH - 1, 4, GOLD, 'metal'),
        cone(7.5, TH + 1, 4, 4.4, f.small ? 6 : 11, 'y', c.roof), box(7, TH + (f.small ? 7 : 12), 4, 8, TH + (f.small ? 10 : 15), 4, GOLD, 'metal'), box(6, TH + (f.small ? 9 : 14), 4, 9, TH + (f.small ? 9 : 14), 4, GOLD, 'metal'));
      return P;
    },
    note: (c, f) => (f.small ? 'Eine Kapelle' : 'Eine Kirche') + ' mit Glockenturm, Uhr, bunten Fenstern und Spitzdach.' });
  T('tower', { de: 'Turm', g: 'm', words: ['=turm', 'turme', 'wachturm', 'burgturm', 'aussichtsturm', 'steinturm', 'zauberturm', 'prinzessinnenturm', 'tower', 'watchtower', 'rapunzelturm', 'magierturm'],
    slots: { body: ['#9c9a94', 'turm|stein|mauer|wand|tower|walls?'], roof: ['#3a5fb0', SYN.roof], flag: ['#c0392b', 'flagge|fahne|flag'] },
    feats: { roof: ['spitzdach', 'dach', 'zauberturm', 'prinzessinnenturm', 'rapunzelturm', 'magierturm', 'spitze', 'roof'] },
    size: (f) => [13, f.roof ? 40 : 30, 13],
    build(c, f) {
      const P = [cyl(6, 0, 6, 5.4, 24, 'y', c.body, 'stone'), box(5, 0, 0, 7, 4, 1, WOOD, 'wood'), box(6, 9, 0, 6, 10, 1, GLASSC, 'glass'), box(6, 15, 0, 6, 16, 1, GLASSC, 'glass'), box(0, 13, 6, 1, 14, 6, GLASSC, 'glass', MR), box(6, 19, 12, 6, 20, 12, GLASSC, 'glass'), cyl(6, 24, 6, 6.2, 1, 'y', c.body, 'stone')];
      if (f.roof) P.push(cone(6, 25, 6, 6.4, 13, 'y', c.roof), line(6, 37, 6, 6, 40, 6, 0.3, TRIM, 'metal'), box(6, 39, 6, 6, 40, 8, c.flag));
      else P.push(...crown(6, 25, 6, 6.2, c.body, 'stone'), line(6, 25, 6, 6, 30, 6, 0.3, TRIM, 'metal'), box(6, 28, 7, 6, 30, 10, c.flag));
      return P;
    },
    note: (c, f) => 'Ein runder Steinturm' + (f.roof ? ' mit spitzem Dach' : ' mit Zinnen') + ' und Fahne.' });
  T('skyscraper', { de: 'Wolkenkratzer', g: 'm', words: ['wolkenkratzer', 'skyscraper', 'turmhochhaus', 'burotum', 'buroturm', 'glasturm', 'tower block'],
    slots: { body: ['#3a3d42', 'rahmen|gebaude|fassade|turm|frame|body|wolkenkratzer'], glass: ['#7fb8ef', SYN.glass] },
    size: [14, 56, 14],
    build(c) {
      const P = [box(0, 0, 0, 13, 47, 13, c.body)];
      for (let y = 1; y < 47; y += 3) P.push(box(1, y, 0, 12, y + 1, 0, c.glass, 'glass'), box(1, y, 13, 12, y + 1, 13, c.glass, 'glass'), box(0, y, 1, 0, y + 1, 12, c.glass, 'glass'), box(13, y, 1, 13, y + 1, 12, c.glass, 'glass'));
      P.push(box(4, 0, 0, 9, 3, 0, GLASSC, 'glass'), box(2, 48, 2, 11, 50, 11, c.body), box(4, 51, 4, 9, 52, 9, c.body), line(6.5, 52, 6.5, 6.5, 56, 6.5, 0.4, RIM, 'metal'), box(6, 56, 6, 7, 56, 7, TAIL, 'light'));
      return P;
    },
    note: () => 'Ein Wolkenkratzer mit Glasfassade, Stufen oben und Antenne.' });
  T('eiffel', { de: 'Eiffelturm', g: 'm', words: ['eiffelturm', 'eiffel tower', 'eiffel'],
    slots: { body: ['#6b4f3a', 'turm|stahl|tower|body|eiffelturm'] },
    size: [25, 52, 25],
    build(c) {
      const P = [];
      for (const [x, z] of [[0, 0], [24, 0], [0, 24], [24, 24]]) P.push(line(x, 0, z, 12 + (x ? 3 : -3), 18, 12 + (z ? 3 : -3), 1.1, c.body, 'metal'), line(12 + (x ? 3 : -3), 18, 12 + (z ? 3 : -3), 12 + (x ? 1 : -1), 36, 12 + (z ? 1 : -1), 0.7, c.body, 'metal'));
      P.push(box(5, 8, 5, 19, 9, 19, c.body, 'metal'), box(8, 8, 8, 16, 9, 16, AIR), box(8, 18, 8, 16, 19, 16, c.body, 'metal'), box(10, 36, 10, 14, 37, 14, c.body, 'metal'), cyl(12, 37, 12, 1, 10, 'y', c.body, 'metal'), line(12, 47, 12, 12, 52, 12, 0.35, RIM, 'metal'));
      for (const z of [0, 24]) P.push(line(6, 0, z, 12, 7, z, 0.6, c.body, 'metal'), line(18, 0, z, 12, 7, z, 0.6, c.body, 'metal'));
      return P;
    },
    note: () => 'Ein Eiffelturm aus Stahl — mit zwei Plattformen.' });
  T('tvtower', { de: 'Fernsehturm', g: 'm', words: ['fernsehturm', 'funkturm', 'sendeturm', 'tv tower', 'tv turm', 'space needle'],
    slots: { body: ['#c8ccd2', 'turm|schaft|tower|body'], ball: ['#c0c7cf', 'kugel|kuppel|ball|sphere'] },
    size: [15, 60, 15],
    build: (c) => [cyl(7, 0, 7, 3.2, 4, 'y', c.body), cyl(7, 4, 7, 2.2, 32, 'y', c.body), ball(7, 40, 7, 7, 6, 7, c.ball, 'metal'), cyl(7, 39, 7, 7.3, 2, 'y', GLASSC, 'glass'), cyl(7, 46, 7, 1.4, 6, 'y', c.body), line(7, 52, 7, 7, 60, 7, 0.5, '#c0392b'), line(7, 55, 7, 7, 57, 7, 0.6, WHITE)],
    note: () => 'Ein Fernsehturm mit Kugel und Antenne.' });
  T('bridge', { de: 'Brücke', g: 'f', words: ['brucke', 'brucken', 'bogenbrucke', 'steinbrucke', 'holzbrucke', 'hangebrucke', 'bridge', 'viadukt', 'aquadukt', 'golden gate'],
    slots: { body: ['#9c9a94', 'brucke|stein|bridge|body|bogen|pfeiler'], deck: ['#6e6c66', 'weg|fahrbahn|deck|boden|road'], cable: ['#c0392b', 'seil|seile|kabel|cables?|turme|towers?'] },
    feats: { wood: ['holzbrucke', 'holz', 'wooden', 'wood'], suspension: ['hangebrucke', 'suspension', 'golden gate', 'seilbrucke'] },
    def: (f) => (f.wood ? { body: '#8b5a2b', deck: '#a0703a' } : f.suspension ? { body: '#8a8f96' } : {}),
    size: (f) => [48, f.suspension ? 28 : 15, 10],
    build(c, f) {
      const m = f.wood ? 'wood' : 'stone';
      if (f.suspension) {
        const P = [box(0, 8, 1, 47, 9, 8, c.deck), box(0, 10, 1, 47, 10, 1, c.cable), box(0, 10, 8, 47, 10, 8, c.cable)];
        for (const x of [11, 36]) P.push(box(x - 1, 0, 0, x + 1, 27, 1, c.cable), box(x - 1, 0, 8, x + 1, 27, 9, c.cable), box(x - 1, 25, 0, x + 1, 26, 9, c.cable), box(x - 1, 0, 2, x + 1, 7, 7, c.body, 'stone'));
        for (const z of [1, 8]) { P.push(line(0, 10, z, 11, 27, z, 0.4, c.cable), line(11, 27, z, 23.5, 12, z, 0.4, c.cable), line(23.5, 12, z, 36, 27, z, 0.4, c.cable), line(36, 27, z, 47, 10, z, 0.4, c.cable)); for (let x = 3; x < 46; x += 3) { const top = x < 11 ? 10 + 17 * x / 11 : x < 23.5 ? 27 - 15 * (x - 11) / 12.5 : x < 36 ? 12 + 15 * (x - 23.5) / 12.5 : 27 - 17 * (x - 36) / 11; P.push(line(x, 10, z, x, top, z, 0.3, c.cable)); } }
        return P;
      }
      const P = [box(0, 0, 0, 47, 10, 9, c.body, m), cyl(12, 0, 0, 7.5, 10, 'z', AIR), cyl(35, 0, 0, 7.5, 10, 'z', AIR), box(4.5, 0, 0, 19.5, 0, 9, AIR), box(27.5, 0, 0, 42.5, 0, 9, AIR), box(0, 11, 0, 47, 11, 9, c.deck, m), box(0, 12, 0, 47, 13, 0, c.body, m), box(0, 12, 9, 47, 13, 9, c.body, m)];
      for (const x of [0, 47]) P.push(box(x, 12, 0, x, 15, 0, c.body, m), box(x, 12, 9, x, 15, 9, c.body, m));
      if (f.wood) for (let x = 3; x < 47; x += 4) P.push(box(x, 12, 0, x, 15, 0, c.body, m), box(x, 12, 9, x, 15, 9, c.body, m));
      return P;
    },
    nameOf: (f) => (f.suspension ? ['Hängebrücke', 'f'] : f.wood ? ['Holzbrücke', 'f'] : null),
    note: (c, f) => f.suspension ? 'Eine Hängebrücke mit zwei Pylonen und Tragseilen.' : f.wood ? 'Eine Holzbrücke mit Geländer.' : 'Eine Steinbrücke mit zwei Bögen.' });
  T('fountain', { de: 'Brunnen', g: 'm', words: ['brunnen', 'springbrunnen', 'zierbrunnen', 'marktbrunnen', 'fountain', 'wasserspiel'],
    slots: { body: ['#c8c2b4', 'brunnen|stein|becken|rand|basin|stone|fountain'], water: ['#3fa7d6', 'wasser|water'] },
    size: [19, 13, 19],
    build: (c) => [cyl(9, 0, 9, 9, 2, 'y', c.body, 'stone'), cyl(9, 1, 9, 8, 1, 'y', c.water, 'water'), cyl(9, 2, 9, 9, 1, 'y', c.body, 'stone'), cyl(9, 2, 9, 8, 1, 'y', AIR), cyl(9, 1, 9, 2, 6, 'y', c.body, 'stone'),
      cyl(9, 7, 9, 4.6, 1, 'y', c.body, 'stone'), cyl(9, 8, 9, 4.6, 1, 'y', c.body, 'stone'), cyl(9, 8, 9, 3.7, 1, 'y', c.water, 'water'), cyl(9, 8, 9, 1, 3, 'y', c.body, 'stone'), cyl(9, 11, 9, 0.6, 2, 'y', c.water, 'water'), ball(9, 12.5, 9, 1.4, 0.8, 1.4, c.water, 'water')],
    note: () => 'Ein Springbrunnen mit zwei Becken.' });
  T('well', { de: 'Ziehbrunnen', g: 'm', words: ['ziehbrunnen', 'wunschbrunnen', 'wishing well', 'well', 'dorfbrunnen', 'schopfbrunnen'],
    slots: { body: [STONE, 'brunnen|stein|stone|body|mauer'], roof: ['#8e3b2e', SYN.roof] },
    size: [13, 14, 13],
    build: (c) => [cyl(6, 0, 6, 4.6, 4, 'y', c.body, 'stone'), cyl(6, 1, 6, 3.3, 3, 'y', AIR), cyl(6, 1, 6, 3.3, 1, 'y', '#3fa7d6', 'water'),
      box(1, 4, 6, 1, 10, 6, WOOD, 'wood', MR), line(1, 8, 6, 11, 8, 6, 0.35, WOOD, 'wood'), line(6, 8, 6, 6, 5, 6, 0.2, '#c8b07a'), box(5, 4, 5, 7, 5, 7, '#7a5a3a', 'wood'), wedge(0, 10, 3, 6, 13, 9, '-x', c.roof, null, MR), line(11, 8, 6, 12, 7, 6, 0.3, TRIM, 'metal')],
    note: () => 'Ein Ziehbrunnen mit Dach, Seil und Eimer.' });
  T('treehouse', { de: 'Baumhaus', g: 'n', words: ['baumhaus', 'baumhauser', 'tree house', 'treehouse', 'baumhutte'],
    slots: { body: ['#a0703a', 'haus|hutte|wand|wande|walls?|house|holz'], roof: ['#7a3b2e', SYN.roof], leaves: [LEAF, SYN.leaves], trunk: ['#6b4a2b', 'stamm|baum|trunk'] },
    size: [24, 38, 24],
    build: (c) => [cyl(12, 0, 13, 2.6, 30, 'y', c.trunk, 'wood'), line(12, 21, 13, 4, 27, 17, 0.9, c.trunk, 'wood'), line(12, 23, 13, 20, 28, 9, 0.9, c.trunk, 'wood'),
      ball(12, 31, 13, 10, 6, 10, c.leaves, 'leaves'), ball(4, 28, 17, 4.5, 3.5, 4.5, c.leaves, 'leaves'), ball(20, 29, 9, 4.5, 3.5, 4.5, c.leaves, 'leaves'), ball(12, 35, 13, 6, 3, 6, c.leaves, 'leaves'),
      box(3, 11, 4, 20, 11, 21, '#8b5a2b', 'wood'), box(3, 12, 4, 3, 13, 21, '#7a4a2a', 'wood', MR), box(3, 12, 21, 20, 13, 21, '#7a4a2a', 'wood'), box(3, 12, 4, 20, 13, 4, '#7a4a2a', 'wood'), box(10, 12, 4, 13, 13, 4, AIR),
      box(6, 12, 8, 17, 18, 18, c.body, 'wood'), box(10, 12, 8, 13, 16, 8, '#2a1a10'), box(14, 15, 8, 16, 16, 8, GLASSC, 'glass'), box(7, 15, 8, 8, 16, 8, GLASSC, 'glass'), box(6, 15, 11, 6, 16, 14, GLASSC, 'glass', MR),
      wedge(5, 19, 7, 11, 23, 19, '-x', c.roof, null, MR), box(11, 19, 7, 12, 23, 19, c.roof), box(7, 19, 8, 16, 19, 18, c.body, 'wood'),
      line(10, 0, 1, 10, 11, 3.5, 0.3, '#7a4a2a', 'wood'), line(13, 0, 1, 13, 11, 3.5, 0.3, '#7a4a2a', 'wood'), ...[2, 4, 6, 8, 10].map(y => line(10, y, 1 + y / 4.4, 13, y, 1 + y / 4.4, 0.25, '#7a4a2a', 'wood'))],
    note: () => 'Ein Baumhaus mit Plattform, Geländer, Leiter und Hütte unter der Baumkrone.' });
  T('tent', { de: 'Zelt', g: 'n', words: ['=zelt', 'zelte', 'campingzelt', 'tent', 'tents', 'tipi', 'tippi', 'indianerzelt', 'teepee', 'wigwam'],
    slots: { body: ['#e67e22', 'zelt|plane|stoff|tent|body'], pole: [WOOD, 'stange|stangen|stab|poles?'] },
    feats: { tipi: ['tipi', 'tippi', 'indianerzelt', 'teepee', 'wigwam'] },
    def: (f) => (f.tipi ? { body: '#e2d3b0' } : {}),
    nameOf: (f) => (f.tipi ? ['Tipi', 'n'] : null),
    size: (f) => (f.tipi ? [13, 18, 13] : [12, 8, 15]),
    build(c, f) {
      if (f.tipi) return [cone(6, 0, 6, 6.2, 15, 'y', c.body), cyl(6, 1, 6, 5, 4, 'y', AIR), cone(6, 0, 1, 2.2, 4, 'y', AIR), box(4, 0, 0, 8, 2, 3, AIR), cone(6, 0, 6, 6.2, 1, 'y', c.body), box(5, 0, 0, 7, 3, 2, AIR),
        line(6, 12, 6, 3, 17, 3, 0.35, c.pole, 'wood'), line(6, 12, 6, 9, 17, 3, 0.35, c.pole, 'wood'), line(6, 12, 6, 6, 18, 9, 0.35, c.pole, 'wood'), cyl(6, 8, 6, 3.6, 1, 'y', '#c0392b'), cyl(6, 5, 6, 4.6, 1, 'y', '#2e6fd8')];
      return [wedge(0, 0, 0, 5, 7, 14, '-x', c.body, null, MR), box(5, 0, 0, 6, 7, 14, c.body), wedge(2, 0, 0, 5, 5, 1, '-x', '#2a2420', null, MR), box(5, 0, 0, 6, 5, 1, '#2a2420'), wedge(3, 0, 0, 5, 4, 0, '-x', AIR, null, MR), box(5, 0, 0, 6, 4, 0, AIR), box(5, 7, -1, 6, 8, -1, c.pole, 'wood'), box(5, 7, 15, 6, 8, 15, c.pole, 'wood'), box(5, 0, 1, 6, 0, 13, '#3a3d42')];
    },
    note: (c, f) => f.tipi ? 'Ein Tipi mit Stangen und bunten Streifen.' : 'Ein Zelt mit offenem Eingang.' });
  T('circus', { de: 'Zirkuszelt', g: 'n', words: ['zirkuszelt', 'zirkus', 'circus', 'festzelt', 'bierzelt', 'zirkusse'],
    slots: { body: ['#c0392b', 'zelt|wand|stoff|tent|body|zirkus'], stripe: [WHITE, SYN.stripe], flag: ['#f1c40f', 'flagge|fahne|flag'] },
    size: [25, 22, 25],
    build(c) {
      const P = [];
      for (let a = 0; a < 16; a++) { const t = a * Math.PI / 8; P.push(line(12 + 11.5 * Math.cos(t), 0, 12 + 11.5 * Math.sin(t), 12 + 11.5 * Math.cos(t), 8, 12 + 11.5 * Math.sin(t), 0.9, a % 2 ? c.stripe : c.body)); }
      P.push(cyl(12, 0, 12, 11, 9, 'y', c.body), box(10, 0, 0, 14, 6, 3, AIR), wedge(10, 6, 0, 12, 8, 3, '-x', AIR), wedge(12, 6, 0, 14, 8, 3, '+x', AIR));
      for (let k = 0; k < 6; k++) P.push(cone(12, 9 + k * 1.6, 12, 12.6 - k * 2.1, 2, 'y', k % 2 ? c.stripe : c.body));
      P.push(cone(12, 9, 12, 12.6, 10, 'y', c.body), cone(12, 10, 12, 10.4, 6, 'y', c.stripe), cone(12, 9, 12, 12.6, 3, 'y', c.body), line(12, 18, 12, 12, 22, 12, 0.3, TRIM, 'metal'), box(12, 20, 13, 12, 22, 15, c.flag));
      return P;
    },
    note: () => 'Ein Zirkuszelt mit Streifen und Fahne.' });
  T('igloo', { de: 'Iglu', g: 'n', words: ['iglu', 'iglus', 'igloo', 'schneehaus', 'eishaus'],
    slots: { body: ['#eef6fb', 'iglu|schnee|eis|snow|ice|body'] },
    size: [17, 9, 21],
    build: (c) => [ball(8, 0, 12, 8, 8, 8, c.body, null, UP), ball(8, 0, 12, 6.6, 6.6, 6.6, AIR, null, UP), cyl(8, 0, 1, 3.4, 6, 'z', c.body, null, UP), cyl(8, 0, 0, 2.2, 8, 'z', AIR, null, UP), cyl(8, 0, 8, 2.2, 1, 'z', '#2a3a48', null, UP), box(2, 0, 6, 14, 0, 18, '#dfeaf2'), box(4, 2, 12, 12, 2, 12, '#cfe0ea'), box(3, 4, 12, 13, 4, 12, '#cfe0ea')],
    note: () => 'Ein Iglu aus Schnee mit Eingangstunnel.' });
  T('pyramid', { de: 'Pyramide', g: 'f', words: ['pyramide', 'pyramiden', 'pyramid', 'stufenpyramide', 'maya tempel', 'aztekentempel', 'mayapyramide'],
    slots: { body: ['#d9bd7e', 'pyramide|stein|sand|pyramid|body'], top: [GOLD, 'spitze|top|tempel|temple'] },
    feats: { steps: ['stufenpyramide', 'maya', 'azteken', 'stufen', 'steps', 'aztec'] },
    nameOf: (f) => (f.steps ? ['Stufenpyramide', 'f'] : null),
    size: (f) => [25, f.steps ? 15 : 13, 25],
    build(c, f) {
      const P = [];
      if (f.steps) { for (let k = 0; k < 6; k++) P.push(box(k * 2, k * 2, k * 2, 24 - k * 2, k * 2 + 1, 24 - k * 2, c.body, 'stone')); P.push(box(10, 0, 0, 14, 11, 11, '#c2a46a', 'stone'), box(9, 12, 9, 15, 15, 15, c.top), box(11, 12, 9, 13, 14, 9, AIR)); for (let y = 0; y <= 11; y++) P.push(box(10, y, Math.min(11, y), 14, y, Math.min(11, y), '#b7995e', 'stone')); }
      else { for (let k = 0; k < 13; k++) P.push(box(k, k, k, 24 - k, k, 24 - k, c.body, 'stone')); P.push(box(12, 12, 12, 12, 12, 12, c.top, 'metal'), box(11, 0, 0, 13, 2, 0, '#3a2a20')); }
      return P;
    },
    note: (c, f) => f.steps ? 'Eine Stufenpyramide mit Treppe und Tempel oben.' : 'Eine Pyramide mit goldener Spitze.' });
  T('temple', { de: 'Tempel', g: 'm', words: ['tempel', 'temple', 'griechischer tempel', 'akropolis', 'parthenon', 'saulentempel', 'pantheon'],
    slots: { body: ['#ece6da', 'tempel|marmor|stein|saulen|columns?|marble|temple|body'], roof: ['=body', SYN.roof + '|giebel'] },
    size: [26, 18, 18],
    build(c) {
      const P = [box(0, 0, 0, 25, 0, 17, '#cfc8ba', 'stone'), box(1, 1, 1, 24, 1, 16, c.body, 'stone')];
      for (let i = 0; i < 7; i++) P.push(cyl(2 + i * 3.5, 2, 2, 0.75, 10, 'y', c.body, 'stone'), cyl(2 + i * 3.5, 2, 15, 0.75, 10, 'y', c.body, 'stone'));
      for (const z of [5.5, 9, 12.5]) P.push(cyl(2, 2, z, 0.75, 10, 'y', c.body, 'stone', MR));
      P.push(box(6, 2, 6, 19, 11, 11, '#ddd5c6', 'stone'), box(1, 12, 1, 24, 13, 16, c.body, 'stone'), wedge(1, 14, 1, 12, 17, 16, '-x', c.roof, 'stone', MR), box(12, 14, 1, 13, 17, 16, c.roof, 'stone'), box(11, 2, 5, 14, 8, 5, '#6b4a2b'), box(11, 2, 6, 14, 8, 6, '#6b4a2b'));
      return P;
    },
    note: () => 'Ein griechischer Tempel mit Säulen und Giebeldach.' });
  T('ferris', { de: 'Riesenrad', g: 'n', words: ['riesenrad', 'riesenrader', 'ferris wheel', 'ferriswheel', 'london eye'],
    slots: { body: ['#d0d6de', 'rad|ring|gestell|wheel|body|rahmen'], cabin: ['#c0392b', 'gondel|gondeln|kabine|kabinen|cabins?|gondolas?'] },
    size: [33, 35, 11],
    build(c) {
      const P = [cyl(16, 18, 3, 15, 1, 'z', c.body, 'metal', { inner: 14 }), cyl(16, 18, 7, 15, 1, 'z', c.body, 'metal', { inner: 14 }), cyl(16, 18, 2, 1.6, 7, 'z', TRIM, 'metal'),
        line(4, 0, 1, 16, 18, 2, 0.6, c.body, 'metal'), line(28, 0, 1, 16, 18, 2, 0.6, c.body, 'metal'), line(4, 0, 9, 16, 18, 8, 0.6, c.body, 'metal'), line(28, 0, 9, 16, 18, 8, 0.6, c.body, 'metal'), box(2, 0, 0, 30, 0, 10, '#8a8f96')];
      const K = [c.cabin, '#2e6fd8', '#f1c40f', '#27ae60', '#8e44ad', '#e67e22', '#1abc9c', '#e8478f'];
      for (let a = 0; a < 10; a++) { const t = a * Math.PI / 5 + 0.3, x = 16 + 14.5 * Math.cos(t), y = 18 + 14.5 * Math.sin(t); P.push(line(16, 18, 3, x, y, 3, 0.3, c.body, 'metal'), line(16, 18, 7, x, y, 7, 0.3, c.body, 'metal'), box(Math.round(x) - 1, Math.round(y) - 3, 3, Math.round(x) + 1, Math.round(y) - 1, 7, K[a % K.length]), box(Math.round(x), Math.round(y) - 2, 3, Math.round(x), Math.round(y) - 2, 7, GLASSC, 'glass')); }
      return P;
    },
    note: () => 'Ein Riesenrad mit zehn bunten Gondeln.' });
  T('carousel', { de: 'Karussell', g: 'n', words: ['karussell', 'karussells', 'carousel', 'merry go round', 'kinderkarussell', 'pferdekarussell'],
    slots: { body: ['#c0392b', 'dach|zelt|roof|karussell|body'], stripe: [WHITE, SYN.stripe], horse: [WHITE, 'pferd|pferde|pferdchen|horses?'] },
    size: [21, 16, 21],
    build(c) {
      const P = [cyl(10, 0, 10, 10, 1, 'y', '#e8d9b0'), cyl(10, 1, 10, 1.4, 11, 'y', GOLD, 'metal'), cyl(10, 11, 10, 10.4, 1, 'y', c.stripe)];
      for (let k = 0; k < 4; k++) P.push(cone(10, 12 + k, 10, 10.6 - k * 2.6, 2, 'y', k % 2 ? c.stripe : c.body));
      P.push(cone(10, 12, 10, 10.6, 5, 'y', c.body), line(10, 16, 10, 10, 18, 10, 0.3, GOLD, 'metal'));
      for (let a = 0; a < 6; a++) { const t = a * Math.PI / 3 + 0.3, x = 10 + 7 * Math.cos(t), z = 10 + 7 * Math.sin(t); P.push(line(x, 1, z, x, 11, z, 0.3, GOLD, 'metal'), ball(x, 5, z, 1.2, 1.4, 1.2, a % 2 ? c.horse : '#7a4a2a'), ball(x + 1.1 * Math.cos(t + 1.57), 6.5, z + 1.1 * Math.sin(t + 1.57), 0.8, 1, 0.8, a % 2 ? c.horse : '#7a4a2a')); }
      return P;
    },
    note: () => 'Ein Karussell mit Pferdchen und gestreiftem Dach.' });
  T('doghouse', { de: 'Hundehütte', g: 'f', words: ['hundehutte', 'hundehutten', 'hundehaus', 'doghouse', 'dog house', 'kennel'],
    slots: { body: ['#c0392b', 'hutte|wand|wande|walls?|body|haus'], roof: ['#5a3b2a', SYN.roof] },
    size: [12, 11, 13],
    build: (c) => [box(1, 0, 1, 10, 6, 12, c.body, 'wood'), box(1, 7, 1, 10, 7, 12, c.body, 'wood'), wedge(1, 7, 1, 5, 9, 12, '-x', c.body, 'wood', MR), wedge(0, 7, 0, 5, 10, 13, '-x', c.roof, null, MR), box(4, 0, 1, 7, 4, 1, '#2a1a10'), cyl(5.5, 4, 1, 1.5, 1, 'z', '#2a1a10'), box(4, 8, 0, 7, 8, 0, WHITE), box(4, 0, 2, 7, 0, 3, '#3a2a20')],
    note: () => 'Eine Hundehütte mit Spitzdach und Namensschild.' });
  T('birdhouse', { de: 'Vogelhaus', g: 'n', words: ['vogelhaus', 'vogelhauschen', 'vogelhauser', 'nistkasten', 'futterhaus', 'birdhouse', 'bird house', 'vogelvilla'],
    slots: { body: ['#c8a165', 'haus|kasten|wand|body|walls?'], roof: ['#3f7a4a', SYN.roof] },
    size: [9, 18, 9],
    build: (c) => [cyl(4, 0, 4, 0.8, 11, 'y', '#6b4a2b', 'wood'), box(1, 10, 1, 7, 15, 7, c.body, 'wood'), wedge(0, 15, 0, 4, 18, 8, '-x', c.roof, null, MR), cyl(4, 13, 1, 1, 1, 'z', '#2a1a10'), line(4, 11, 1, 4, 11, -1, 0.3, '#6b4a2b', 'wood')],
    note: () => 'Ein Vogelhaus auf einem Pfahl.' });
  T('stall', { de: 'Marktstand', g: 'm', words: ['marktstand', 'marktstande', 'verkaufsstand', 'obststand', 'gemusestand', 'imbissstand', 'market stall', 'stall', 'booth', 'jahrmarktstand', 'losbude', 'bude', 'buden'],
    slots: { body: ['#a0703a', 'stand|theke|tisch|counter|body|holz'], roof: ['#c0392b', SYN.roof + '|markise|plane|canopy'], stripe: [WHITE, SYN.stripe] },
    size: [14, 11, 9],
    build(c) {
      const P = [box(1, 0, 2, 12, 4, 7, c.body, 'wood'), box(1, 4, 2, 12, 4, 7, '#c8a165', 'wood'), box(1, 0, 8, 1, 8, 8, WOOD, 'wood', MR), box(1, 0, 1, 1, 8, 1, WOOD, 'wood', MR)];
      for (let x = 0; x < 14; x++) P.push(wedge(x, 8, 0, x, 10, 9, '-z', x % 2 ? c.stripe : c.roof));
      const F = ['#e74c3c', '#f39c12', '#f1c40f', '#27ae60', '#8e44ad'];
      for (let i = 0; i < 10; i++) P.push(ball(2.5 + (i % 5) * 2, 5, 3.5 + (i / 5 | 0) * 2, 0.8, 0.7, 0.8, F[(i * 3) % F.length]));
      return P;
    },
    note: () => 'Ein Marktstand mit gestreiftem Dach und Obst.' });
  T('swing', { de: 'Schaukel', g: 'f', words: ['schaukel', 'schaukeln', 'swing', 'swings', 'kinderschaukel', 'doppelschaukel'],
    slots: { body: ['#c0392b', 'gestell|rahmen|frame|body|stangen'], seat: ['#2e6fd8', 'sitz|sitze|brett|seats?'] },
    size: [18, 13, 9],
    build: (c) => [line(1, 0, 0, 2, 12, 4, 0.5, c.body, 'metal', MR), line(1, 0, 8, 2, 12, 4, 0.5, c.body, 'metal', MR), line(2, 12, 4, 15, 12, 4, 0.55, c.body, 'metal'), line(6, 12, 4, 6, 3, 4, 0.2, '#888888', 'metal', MR), line(9, 12, 4, 9, 3, 4, 0.2, '#888888', 'metal', MR), box(5, 3, 3, 9, 3, 5, c.seat, null, MR)],
    note: () => 'Eine Doppelschaukel.' });
  T('slide', { de: 'Rutsche', g: 'f', words: ['rutsche', 'rutschen', 'slide', 'wasserrutsche', 'rutschbahn', 'kletterturm', 'spielturm'],
    slots: { body: ['#f1c40f', 'rutsche|bahn|slide|body'], frame: ['#2e6fd8', 'turm|gestell|leiter|frame|ladder|tower'], roof: ['#c0392b', SYN.roof] },
    size: [9, 15, 24],
    build(c) {
      const P = [box(1, 0, 14, 1, 12, 14, c.frame, null, MR), box(1, 0, 21, 1, 12, 21, c.frame, null, MR), box(1, 7, 14, 7, 7, 21, '#a0703a', 'wood'), box(1, 8, 21, 7, 9, 21, c.frame), box(1, 8, 14, 1, 9, 21, c.frame, null, MR), wedge(0, 12, 13, 4, 14, 22, '-x', c.roof, null, MR), box(4, 12, 13, 4, 14, 22, c.roof)];
      for (let z = 0; z <= 13; z++) { const y = Math.round(7 * z / 13); P.push(box(2, y, z, 6, y, z, c.body), box(2, y + 1, z, 2, y + 1, z, c.body, null, MR)); }
      P.push(box(2, 0, 22, 2, 7, 22, '#a0703a', 'wood', MR), ...[1, 3, 5].map(y => box(2, y, 22, 6, y, 22, '#a0703a', 'wood')));
      return P;
    },
    note: () => 'Eine Rutsche mit Spielturm, Dach und Leiter.' });
  T('lamp', { de: 'Laterne', g: 'f', words: ['laterne', 'laternen', 'strassenlaterne', 'strassenlampe', 'gaslaterne', 'lamp post', 'street lamp', 'streetlight', 'lantern', 'stehlampe'],
    slots: { body: ['#2a2a2a', 'mast|pfahl|laterne|pole|body'], lamp: [LAMP, 'licht|lampe|light|leuchte'] },
    size: [7, 18, 7],
    build: (c) => [cyl(3, 0, 3, 1.6, 1, 'y', c.body, 'metal'), cyl(3, 1, 3, 0.7, 13, 'y', c.body, 'metal'), box(1, 14, 1, 5, 14, 5, c.body, 'metal'), box(2, 15, 2, 4, 16, 4, c.lamp, 'light'), box(1, 15, 1, 1, 16, 1, c.body, 'metal', MR), box(1, 15, 5, 1, 16, 5, c.body, 'metal', MR), cone(3, 17, 3, 3, 2, 'y', c.body, 'metal')],
    note: () => 'Eine Straßenlaterne, die leuchtet.' });
  T('bench', { de: 'Bank', g: 'f', words: ['parkbank', 'sitzbank', 'gartenbank', 'holzbank', '=bank', 'bench', 'benches', 'banke'],
    slots: { body: ['#a0703a', 'bank|sitz|latten|holz|seat|body'], frame: ['#2a2a2a', 'gestell|beine|fusse|frame|legs?'] },
    size: [14, 7, 5],
    build: (c) => [box(1, 0, 1, 1, 2, 3, c.frame, 'metal', MR), box(1, 3, 1, 1, 6, 4, c.frame, 'metal', MR), box(0, 3, 0, 13, 3, 0, c.body, 'wood'), box(0, 3, 2, 13, 3, 2, c.body, 'wood'), box(0, 5, 4, 13, 5, 4, c.body, 'wood'), box(0, 6, 4, 13, 6, 4, AIR), box(0, 3, 1, 13, 3, 1, c.body, 'wood')],
    note: () => 'Eine Parkbank.' });
  T('mailbox', { de: 'Briefkasten', g: 'm', words: ['briefkasten', 'briefkasten', 'postkasten', 'mailbox', 'postbox', 'letterbox'],
    slots: { body: ['#f5c400', 'kasten|briefkasten|box|body'], pole: ['#3a3d42', 'pfahl|pfosten|post|pole'] },
    size: [6, 12, 6],
    build: (c) => [cyl(3, 0, 3, 0.7, 6, 'y', c.pole, 'metal'), box(1, 6, 1, 5, 11, 5, c.body), cyl(3, 11, 1, 2.1, 5, 'z', c.body), box(2, 9, 0, 4, 9, 0, TRIM), box(2, 7, 0, 4, 7, 0, '#2e6fd8')],
    note: () => 'Ein Briefkasten mit Einwurfschlitz.' });

  // ---------------------------------------------------------------- pictures with depth (hearts, stars, letters, photos)
  const CH = (n) => String.fromCharCode(48 + n);
  // idxAt(x, y) → a palette index (1…) or 0, y = 0 the top row. The thickness grows toward the middle of the shape (a
  // cushion), or stays dmax everywhere (flat).
  function reliefPart(w, h, idxAt, pal, dmax, flat) {
    const D = new Float32Array(w * h), INF = 1e9, at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : D[y * w + x]);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) D[y * w + x] = idxAt(x, y) ? INF : 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if (D[i]) D[i] = Math.min(D[i], at(x - 1, y) + 3, at(x, y - 1) + 3, at(x - 1, y - 1) + 4, at(x + 1, y - 1) + 4); }
    for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { const i = y * w + x; if (D[i]) D[i] = Math.min(D[i], at(x + 1, y) + 3, at(x, y + 1) + 3, at(x + 1, y + 1) + 4, at(x - 1, y + 1) + 4); }
    let mx = 0; for (const v of D) if (v > mx && v < INF) mx = v;
    const px = [], half = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = idxAt(x, y), u = mx ? D[y * w + x] / mx : 0; px.push(CH(c)); half.push(CH(c ? (flat ? dmax : Math.max(0, Math.round(dmax * Math.sqrt(u)))) : 0)); }
    return { relief: { at: [0, 0, 0], w, h, d: 2 * dmax + 1, pal, px: px.join(''), half: half.join('') } };
  }
  // a little picture in text: one character per pixel, cols maps characters to colours ('.' and ' ' are empty)
  function bitmap(rows, cols, dmax, flat) {
    const pal = [], ix = {};
    for (const k in cols) { if (!(cols[k] in ix)) { ix[cols[k]] = pal.length + 1; pal.push(cols[k]); } }
    const w = Math.max(...rows.map(r => r.length)), h = rows.length;
    return reliefPart(w, h, (x, y) => { const ch = rows[y][x]; return ch && cols[ch] ? ix[cols[ch]] : 0; }, pal, dmax, flat);
  }
  B.bitmap = bitmap; B.reliefPart = reliefPart;
  // another thing of the library as parts of this one: made at its own size, scaled by k, moved by d
  function xform(parts, k, d) {
    const P = (v, i) => v * k + d[i];
    return parts.map((p) => {
      const q = Object.assign({}, p);
      for (const key of ['box', 'wedge', 'line']) if (p[key]) q[key] = [P(p[key][0], 0), P(p[key][1], 1), P(p[key][2], 2), P(p[key][3], 0), P(p[key][4], 1), P(p[key][5], 2)];
      if (p.cyl) q.cyl = [P(p.cyl[0], 0), P(p.cyl[1], 1), P(p.cyl[2], 2), p.cyl[3] * k, Math.max(1, p.cyl[4] * k)];
      if (p.ball) q.ball = [P(p.ball[0], 0), P(p.ball[1], 1), P(p.ball[2], 2), p.ball[3] * k, p.ball[4] * k, p.ball[5] * k];
      if (p.cone) q.cone = [P(p.cone[0], 0), P(p.cone[1], 1), P(p.cone[2], 2), p.cone[3] * k, Math.max(1, p.cone[4] * k)];
      if (p.line) q.r = Math.max(0.3, (p.r || 0.5) * k);
      if (p.inner) q.inner = p.inner * k;
      if (p.clip) q.clip = [P(p.clip[0], 0), P(p.clip[1], 1), P(p.clip[2], 2), P(p.clip[3], 0), P(p.clip[4], 1), P(p.clip[5], 2)];
      return q;
    });
  }
  function sub(id, k, d, colors, feats) {
    const T = B.lib(id), rc = { type: id, colors: colors || {}, feats: feats || {} }, f = featsOf(T, rc), c = colorsOf(T, f, rc), sz = typeof T.size === 'function' ? T.size(f, rc) : T.size;
    return xform(unmirror(T.build(c, f, rc), sz[0]), k, d);
  }

  // ---------------------------------------------------------------- nature
  CAT = 'nature';
  T('tree', { de: 'Baum', g: 'm', words: ['=baum', 'baume', 'laubbaum', 'apfelbaum', 'obstbaum', 'kirschbaum', 'kirschblute', 'kirschbluten', 'sakura', 'birke', 'birken', 'eiche', 'eichen', 'buche', 'linde', 'ahorn', 'kastanienbaum', 'trauerweide', '=weide', 'herbstbaum', 'tree', 'trees', 'oak', 'birch', 'maple', 'willow', 'apple tree', 'cherry tree', 'blossom tree', 'bonsai', 'zitronenbaum', 'orangenbaum', 'mammutbaum'],
    slots: { leaves: [LEAF, SYN.leaves + '|baum|tree|blatterkrone'], trunk: ['#6b4a2b', SYN.trunk], fruit: ['#d0302a', 'apfel|apfeln|fruchte|fruchten|fruit|fruits|kirschen|obst|zitronen|orangen'] },
    feats: { cherry: ['kirschbaum', 'kirschblute', 'kirschbluten', 'sakura', 'blossom', 'bluhend', 'bluten', 'blute'], apple: ['apfelbaum', 'apfel', 'obstbaum', 'apple', 'apples', 'zitronenbaum', 'orangenbaum', 'fruchte', 'fruit'], autumn: ['herbst', 'herbstlich', 'herbstbaum', 'autumn', 'fall', 'ahorn', 'maple'], birch: ['birke', 'birken', 'birch'], oak: ['eiche', 'eichen', 'oak', 'linde', 'buche', 'kastanienbaum', 'mammutbaum', 'alt', 'alte', 'old'], willow: ['trauerweide', '=weide', 'willow'], bare: ['kahl', 'kahle', 'kahler', 'blattlos', 'abgestorben', 'tot', 'tote', 'toter', 'bare', 'dead', 'winterbaum'], bonsai: ['bonsai'] },
    def: (f, rc) => (f.cherry ? { leaves: '#f4a6c6' } : f.autumn ? { leaves: '#d35400' } : f.birch ? { leaves: '#7cb342', trunk: '#ece8e0' } : f.willow ? { leaves: '#8bc34a' } : /zitrone|lemon/.test((rc && rc.raw) || '') ? { fruit: '#f1c40f' } : /orange/.test((rc && rc.raw) || '') ? { fruit: '#e67e22' } : {}),
    nameOf: (f) => (f.bare ? ['Kahler Baum', 'm'] : f.cherry ? ['Kirschbaum', 'm'] : f.apple ? ['Apfelbaum', 'm'] : f.birch ? ['Birke', 'f'] : f.oak ? ['Eiche', 'f'] : f.willow ? ['Trauerweide', 'f'] : f.bonsai ? ['Bonsai', 'm'] : f.autumn ? ['Herbstbaum', 'm'] : null),
    size: (f) => [f.oak ? 23 : 19, f.willow ? 22 : 24, f.oak ? 23 : 19],
    build(c, f) {
      const o = f.oak ? 2 : 0, cx = 9 + o, cz = 9 + o, P = [], L = c.leaves, tr = c.trunk;
      if (f.bonsai) P.push(cyl(cx, 0, cz, 5, 3, 'y', '#7a4a3a'), cyl(cx, 3, cz, 5.4, 1, 'y', '#8a5a4a'), cyl(cx, 3, cz, 4.4, 1, 'y', '#5a4030'));
      const y0 = f.bonsai ? 4 : 0;
      P.push(cyl(cx, y0, cz, f.oak ? 2.2 : f.birch ? 1.1 : 1.5, f.willow ? 13 : 12, 'y', tr, 'wood'));
      if (f.birch) for (const [y, dx] of [[2, -1], [4, 1], [6, -1], [9, 1], [11, -1]]) P.push(box(cx + dx, y0 + y, cz - 1.6, cx + dx, y0 + y, cz - 1.6, '#2a2a2a'));
      P.push(line(cx, y0 + 7, cz, cx - 5, y0 + 12, cz + 1, f.oak ? 1 : 0.7, tr, 'wood'), line(cx, y0 + 8, cz, cx + 5, y0 + 13, cz - 1, f.oak ? 1 : 0.7, tr, 'wood'), line(cx, y0 + 9, cz, cx, y0 + 14, cz - 5, 0.6, tr, 'wood'), line(cx, y0 + 9, cz, cx + 1, y0 + 14, cz + 5, 0.6, tr, 'wood'));
      if (f.bare) { P.push(line(cx - 5, y0 + 12, cz + 1, cx - 7, y0 + 17, cz + 2, 0.45, tr, 'wood'), line(cx + 5, y0 + 13, cz - 1, cx + 7, y0 + 18, cz - 2, 0.45, tr, 'wood'), line(cx, y0 + 12, cz, cx, y0 + 21, cz, 0.6, tr, 'wood'), line(cx, y0 + 16, cz, cx + 3, y0 + 20, cz + 3, 0.4, tr, 'wood'), line(cx, y0 + 15, cz, cx - 3, y0 + 19, cz - 3, 0.4, tr, 'wood')); return P; }
      const AUT = ['#d35400', '#e67e22', '#f1c40f', '#c0392b', '#e67e22', '#d35400'], col = (i) => (f.autumn && L === '#d35400' ? AUT[i % AUT.length] : L);
      const W = f.oak ? 1.25 : 1, crown = [[0, 16, 0, 7.5, 5.5, 7.5], [-4.5, 13.5, 1, 4.5, 3.5, 4.5], [4.5, 14, -1, 4.5, 3.5, 4.5], [0, 14, -5, 4.5, 3.5, 3.5], [0, 14.5, 5, 4.5, 3.5, 3.5], [0, 20, 0, 5, 3.5, 5]];
      crown.forEach(([dx, y, dz, rx, ry, rz], i) => P.push(ball(cx + dx * W, y0 + y, cz + dz * W, rx * W, ry, rz * W, col(i), 'leaves')));
      if (f.cherry) for (const [dx, y, dz] of [[-3, 19, -3], [4, 17, 4], [-6, 15, 3], [6, 16, -3], [1, 21, 2]]) P.push(ball(cx + dx, y0 + y, cz + dz, 1.6, 1.3, 1.6, '#ffd9e8', 'leaves'));
      if (f.apple) for (const [dx, y, dz] of [[-4, 12, -4], [5, 13, -4], [-1, 11, -6], [3, 15, -7], [-7, 14, 0], [7, 15, 2], [0, 18, -6], [-3, 17, -6], [5, 18, -4]]) P.push(ball(cx + dx * W, y0 + y, cz + dz * W, 0.7, 0.7, 0.7, c.fruit));
      if (f.willow) for (let a = 0; a < 14; a++) { const t = a * Math.PI / 7, x = cx + 7.2 * Math.cos(t), z = cz + 7.2 * Math.sin(t); P.push(line(x, y0 + 15, z, x * 1.02 - cx * 0.02, y0 + 4 + (a % 3), z * 1.02 - cz * 0.02, 0.5, L, 'leaves')); }
      return P;
    },
    note: (c, f) => f.bare ? 'Ein kahler Baum mit Ästen.' : f.cherry ? 'Ein blühender Kirschbaum.' : f.apple ? 'Ein Obstbaum mit Früchten.' : f.willow ? 'Eine Trauerweide mit hängenden Zweigen.' : f.bonsai ? 'Ein Bonsai im Topf.' : f.autumn ? 'Ein Baum in Herbstfarben.' : 'Ein Laubbaum mit runder Krone.' });
  T('pine', { de: 'Tanne', g: 'f', words: ['tanne', 'tannen', 'tannenbaum', 'fichte', 'fichten', 'kiefer', 'nadelbaum', 'nadelbaume', 'weihnachtsbaum', 'christbaum', 'pine', 'fir', 'spruce', 'christmas tree', 'conifer'],
    slots: { leaves: ['#245c34', SYN.leaves + '|tanne|tannenbaum|fichte|zweige'], trunk: ['#5a3b24', SYN.trunk], balls: ['#d0302a', 'kugeln|kugel|baubles|ornaments|schmuck|deko'], star: [GOLD, 'stern|spitze|star'] },
    feats: { xmas: ['weihnachtsbaum', 'christbaum', 'christmas', 'weihnacht', 'weihnachten', 'geschmuckt', 'geschmuckter', 'kugeln', 'lichterkette', 'xmas', 'decorated'], snow: ['schnee', 'verschneit', 'verschneite', 'verschneiter', 'snow', 'snowy', 'winter'] },
    nameOf: (f) => (f.xmas ? ['Weihnachtsbaum', 'm'] : f.snow ? ['Verschneite Tanne', 'f'] : null),
    size: (f) => [15, f.xmas ? 22 : 20, 15],
    build(c, f) {
      const P = [cyl(7, 0, 7, 1.2, 4, 'y', c.trunk, 'wood')], tiers = [[2, 7.4, 6], [6.5, 6, 5.5], [10.5, 4.6, 5], [14, 3.2, 4.5]];
      tiers.forEach(([y, r, h], i) => { P.push(cone(7, y, 7, r, h, 'y', i % 2 ? shade(c.leaves, 1.18) : c.leaves, 'leaves')); if (f.snow) P.push(cone(7, y + h * 0.5, 7, r * 0.55 + 0.3, h * 0.5, 'y', '#f4f8fb')); });
      if (f.xmas) {
        const K = [c.balls, GOLD, '#2e6fd8', c.balls, '#f4f4f2'];
        tiers.forEach(([y, r], ti) => { const n = Math.max(3, Math.round(r * 1.1)); for (let a = 0; a < n; a++) { const t = a * 2 * Math.PI / n + ti; P.push(ball(7 + (r - 0.9) * Math.cos(t), y + 1, 7 + (r - 0.9) * Math.sin(t), 0.6, 0.6, 0.6, K[(a + ti) % K.length], a % 2 ? 'light' : null)); } });
        P.push(ball(7, 19, 7, 1, 1, 0.6, c.star, 'light'), box(6, 18, 7, 8, 20, 7, c.star, 'light'), box(2, 0, 1, 4, 2, 3, '#c0392b'), box(3, 0, 1, 3, 2, 3, GOLD), box(9, 0, 2, 12, 1, 4, '#2e6fd8'), box(10, 0, 2, 10, 1, 4, WHITE));
      }
      return P;
    },
    note: (c, f) => f.xmas ? 'Ein geschmückter Weihnachtsbaum mit Kugeln, Stern und Geschenken.' : f.snow ? 'Eine verschneite Tanne.' : 'Eine Tanne.' });
  T('palm', { de: 'Palme', g: 'f', words: ['palme', 'palmen', 'palm', 'palm tree', 'kokospalme', 'palmtree'],
    slots: { leaves: ['#4caf50', SYN.leaves + '|palmwedel|wedel|fronds?'], trunk: ['#a07850', SYN.trunk], nuts: ['#6b4a2b', 'nusse|kokosnusse|kokosnuss|coconuts?'] },
    size: [21, 20, 17],
    build(c) {
      const P = [];
      for (let i = 0; i < 8; i++) P.push(cyl(8 + i * 0.32, i * 2, 8, 1.15, 2, 'y', i % 2 ? c.trunk : '#8a6640', 'wood'));
      const tx = 10.6, ty = 16, tz = 8;
      for (let a = 0; a < 7; a++) { const t = a * 2 * Math.PI / 7 + 0.2, mx = tx + 4 * Math.cos(t), mz = tz + 4 * Math.sin(t); P.push(line(tx, ty, tz, mx, ty + 1.6, mz, 0.65, c.leaves, 'leaves'), line(mx, ty + 1.6, mz, tx + 8.5 * Math.cos(t), ty - 3, tz + 8.5 * Math.sin(t), 0.55, c.leaves, 'leaves')); }
      P.push(ball(tx, ty + 0.5, tz, 1.4, 1, 1.4, c.leaves, 'leaves'), ball(tx - 1, ty - 1, tz - 0.6, 0.8, 0.8, 0.8, c.nuts), ball(tx + 0.8, ty - 1.2, tz - 0.8, 0.8, 0.8, 0.8, c.nuts), ball(tx, ty - 1, tz + 1, 0.8, 0.8, 0.8, c.nuts));
      return P;
    },
    note: () => 'Eine Palme mit Kokosnüssen.' });
  T('bush', { de: 'Busch', g: 'm', words: ['busch', 'busche', 'strauch', 'straucher', 'rosenbusch', 'beerenstrauch', 'hecke', 'hecken', 'bush', 'shrub', 'hedge', 'gestrupp'],
    slots: { leaves: ['#3d7a3a', SYN.leaves + '|busch|strauch|hecke|bush'], flowers: ['#d0302a', 'blumen|bluten|rosen|beeren|flowers?|berries|roses'] },
    feats: { hedge: ['hecke', 'hecken', 'hedge'], roses: ['rosenbusch', 'rosen', 'roses', 'bluten', 'blumen', 'bluhend', 'flowers'], berries: ['beeren', 'beerenstrauch', 'berries', 'himbeer', 'brombeer', 'johannisbeer'] },
    nameOf: (f) => (f.hedge ? ['Hecke', 'f'] : f.roses ? ['Rosenbusch', 'm'] : null),
    size: (f) => (f.hedge ? [22, 6, 4] : [13, 8, 12]),
    build(c, f) {
      if (f.hedge) { const P = [box(0, 0, 0, 21, 4, 3, c.leaves, 'leaves'), cyl(0, 4, 1.5, 1.6, 22, 'x', c.leaves, 'leaves')]; if (f.roses || f.berries) for (let x = 1; x < 21; x += 3) P.push(ball(x, 2 + (x % 2) * 2, 0, 0.6, 0.6, 0.6, c.flowers)); return P; }
      const P = [ball(6, 3, 6, 4.4, 3.2, 4.4, c.leaves, 'leaves'), ball(2.8, 2.4, 7, 2.8, 2.4, 2.8, c.leaves, 'leaves'), ball(9.4, 2.4, 5, 2.8, 2.4, 2.8, c.leaves, 'leaves'), ball(6, 5.4, 6.4, 3, 2.4, 3, c.leaves, 'leaves'), ball(6, 2.5, 2.4, 2.8, 2.2, 2.2, c.leaves, 'leaves')];
      if (f.roses || f.berries) for (const [x, y, z] of [[3, 4, 3], [7, 6, 3.5], [10, 4, 3], [5, 2, 1], [8, 2.5, 1.5], [2, 3, 6], [11, 3, 7], [6, 7, 7]]) P.push(ball(x, y, z, f.berries ? 0.5 : 0.8, f.berries ? 0.5 : 0.8, f.berries ? 0.5 : 0.8, c.flowers));
      return P;
    },
    note: (c, f) => f.hedge ? 'Eine Hecke.' : f.roses ? 'Ein Rosenbusch.' : f.berries ? 'Ein Beerenstrauch.' : 'Ein runder Busch.' });
  T('flower', { de: 'Blume', g: 'f', words: ['blume', 'blumen', 'blute', 'sonnenblume', 'sonnenblumen', '=rose', 'rosen', 'tulpe', 'tulpen', 'ganseblumchen', 'margerite', 'mohnblume', 'lilie', 'flower', 'flowers', 'sunflower', 'tulip', 'daisy', 'blumentopf', 'topfblume', 'topfpflanze', 'pflanze', 'plant'],
    slots: { petals: ['#e8478f', 'blute|bluten|blutenblatter|blatter|petals?|blume|rose|tulpe'], center: ['#f1c40f', 'mitte|innen|center|centre|stempel'], pot: ['#b5562f', 'topf|blumentopf|pot|vase'] },
    feats: { sun: ['sonnenblume', 'sonnenblumen', 'sunflower'], rose: ['=rose', 'rosen'], tulip: ['tulpe', 'tulpen', 'tulip'], daisy: ['ganseblumchen', 'margerite', 'daisy'], pot: ['topf', 'blumentopf', 'topfblume', 'topfpflanze', 'pot', 'vase', 'im topf'] },
    def: (f) => (f.sun ? { petals: '#f5c400', center: '#5a3b1a' } : f.rose ? { petals: '#c0182a' } : f.tulip ? { petals: '#e74c3c' } : f.daisy ? { petals: WHITE } : {}),
    nameOf: (f) => (f.sun ? ['Sonnenblume', 'f'] : f.rose ? ['Rose', 'f'] : f.tulip ? ['Tulpe', 'f'] : f.daisy ? ['Gänseblümchen', 'n'] : null),
    size: (f) => [f.sun ? 15 : 13, f.sun ? 22 : 17, 12],
    build(c, f) {
      const P = [], y0 = f.pot ? 4 : 0, top = y0 + (f.sun ? 17 : 12), G = '#3f8a3a';
      if (f.pot) P.push(cyl(6, 0, 6, 3, 4, 'y', c.pot), cyl(6, 3, 6, 3.6, 1, 'y', c.pot), cyl(6, 4, 6, 2.8, 1, 'y', '#5a4030'));
      P.push(line(6, y0, 6, 6, top, 6, f.sun ? 0.8 : 0.55, G, 'leaves'), ball(4, y0 + 4, 6, 2.2, 0.6, 1.1, G, 'leaves'), ball(8.2, y0 + 7, 6, 2.2, 0.6, 1.1, G, 'leaves'));
      if (f.rose) P.push(ball(6, top + 1, 6, 2.2, 2.4, 2.2, c.petals), ball(6, top + 2.4, 5.8, 1.2, 1, 1.2, '#8e1020'), ball(5, top + 0.5, 4.4, 1, 1.2, 0.6, c.petals), ball(7.2, top + 0.6, 4.6, 1, 1.1, 0.6, c.petals));
      else if (f.tulip) P.push(ball(6, top + 1.5, 6, 2, 2.6, 2, c.petals, null, { clip: [-99, -99, -99, 99, top + 3, 99] }), cone(4.8, top + 3, 6, 0.8, 2, 'y', c.petals), cone(7.2, top + 3, 6, 0.8, 2, 'y', c.petals), cone(6, top + 3, 4.8, 0.8, 2, 'y', c.petals), cone(6, top + 3, 7.2, 0.8, 2, 'y', c.petals));
      else {
        const n = f.sun ? 12 : 8, R = f.sun ? 3.9 : 2.8, cz = 5;
        for (let a = 0; a < n; a++) { const t = a * 2 * Math.PI / n; P.push(ball(6 + R * Math.cos(t), top + R * Math.sin(t), cz + 0.4, f.sun ? 1.4 : 1.5, f.sun ? 1.4 : 1.5, 0.7, c.petals)); }
        P.push(ball(6, top, cz, f.sun ? 2.6 : 1.5, f.sun ? 2.6 : 1.5, 1, c.center));
      }
      return P;
    },
    note: (c, f) => (f.sun ? 'Eine Sonnenblume' : f.rose ? 'Eine Rose' : f.tulip ? 'Eine Tulpe' : f.daisy ? 'Ein Gänseblümchen' : 'Eine Blume') + (f.pot ? ' im Topf.' : ' mit Blättern.') });
  T('mushroom', { de: 'Pilz', g: 'm', words: ['pilz', 'pilze', 'fliegenpilz', 'steinpilz', 'champignon', 'mushroom', 'mushrooms', 'toadstool', 'pilzhaus'],
    slots: { cap: ['#d0302a', 'hut|kappe|kopf|cap|pilz'], stem: ['#f3ead2', 'stiel|stamm|stem'], dots: [WHITE, 'punkte|tupfen|flecken|dots|spots'] },
    feats: { brown: ['steinpilz', 'braun', 'brown', 'marone'], white: ['champignon'] },
    def: (f) => (f.brown ? { cap: '#7a4a2a' } : f.white ? { cap: '#efe9df' } : {}),
    size: [15, 13, 15],
    build(c, f) {
      const P = [cyl(7, 0, 7, 2.4, 7, 'y', c.stem), cyl(7, 4, 7, 3, 1, 'y', c.stem), ball(7, 7, 7, 7, 5, 7, c.cap, null, { clip: [-99, 7, -99, 99, 99, 99] }), cyl(7, 7, 7, 6.6, 1, 'y', '#e8d9b0'), box(6, 2, 4, 6, 3, 4, '#3a2a20'), box(8, 2, 4, 8, 3, 4, '#3a2a20')];
      if (!f.brown && !f.white) for (const [a, e] of [[0, 0.5], [1.2, 0.35], [2.4, 0.6], [3.6, 0.3], [4.8, 0.5], [5.6, 0.25], [0.6, 1.1], [2.9, 1.0], [4.4, 0.95]]) P.push(ball(7 + 6.6 * Math.cos(a) * Math.cos(e), 7 + 4.7 * Math.sin(e), 7 + 6.6 * Math.sin(a) * Math.cos(e), 0.9, 0.6, 0.9, c.dots));
      return P;
    },
    note: (c, f) => f.brown ? 'Ein Steinpilz.' : f.white ? 'Ein Champignon.' : 'Ein Fliegenpilz mit weißen Punkten — und einer kleinen Tür.' });
  T('cactus', { de: 'Kaktus', g: 'm', words: ['kaktus', 'kakteen', 'kaktusse', 'cactus', 'cacti', 'saguaro'],
    slots: { body: ['#3e8e4a', 'kaktus|cactus|body|arme|arms?'], flower: ['#e8478f', 'blute|blume|flower|blossom'], pot: ['#b5562f', 'topf|pot'] },
    feats: { pot: ['topf', 'blumentopf', 'pot', 'im topf'], flower: ['blute', 'blume', 'bluhend', 'flower', 'blossom'] },
    size: [13, 18, 13],
    build(c, f) {
      const y0 = f.pot ? 4 : 0, P = [];
      if (f.pot) P.push(cyl(6, 0, 6, 3.6, 4, 'y', c.pot), cyl(6, 3, 6, 4.2, 1, 'y', c.pot));
      P.push(cyl(6, y0, 6, 2.3, 12, 'y', c.body), ball(6, y0 + 12, 6, 2.3, 1.6, 2.3, c.body), line(4, y0 + 5, 6, 1.4, y0 + 5, 6, 1.2, c.body), cyl(1.4, y0 + 5, 6, 1.2, 4, 'y', c.body), ball(1.4, y0 + 9, 6, 1.2, 1, 1.2, c.body),
        line(8, y0 + 8, 6, 10.6, y0 + 8, 6, 1.2, c.body), cyl(10.6, y0 + 8, 6, 1.2, 3, 'y', c.body), ball(10.6, y0 + 11, 6, 1.2, 1, 1.2, c.body));
      for (const y of [2, 5, 8, 11]) P.push(box(5, y0 + y, 3.6, 5, y0 + y, 3.6, '#f3ead2'), box(7, y0 + y + 1, 3.6, 7, y0 + y + 1, 3.6, '#f3ead2'));
      if (f.flower) P.push(ball(6, y0 + 14, 6, 1.4, 0.8, 1.4, c.flower));
      return P;
    },
    note: (c, f) => 'Ein Kaktus mit zwei Armen' + (f.flower ? ' und Blüte' : '') + (f.pot ? ' im Topf' : '') + '.' });
  T('rock', { de: 'Felsen', g: 'm', words: ['felsen', '=fels', 'findling', 'steinhaufen', 'felsbrocken', 'boulder', '=rock', 'rocks', '=stein', 'steine'],
    slots: { body: ['#8a8780', 'fels|felsen|stein|rock|body'], moss: ['#5d8a3a', 'moos|moss|gras'] },
    feats: { moss: ['moos', 'bemoost', 'moosig', 'moss', 'mossy'] },
    size: [16, 10, 14],
    build(c, f) {
      const P = [ball(6, 3, 7, 6, 4.4, 5, c.body, 'stone', UP), ball(11, 2, 5, 3.6, 2.6, 3.6, '#7d7a74', 'stone', UP), ball(3, 2, 10, 3, 2, 3, '#9c9a94', 'stone', UP), ball(8, 5.5, 7, 3.6, 2.8, 3, c.body, 'stone')];
      if (f.moss) P.push(ball(6.5, 7, 7, 3.4, 1.2, 3, c.moss, 'leaves'), ball(4, 6, 8, 2.4, 1, 2.4, c.moss, 'leaves'));
      return P;
    },
    note: (c, f) => 'Ein Felsen' + (f.moss ? ' mit Moos.' : '.') });
  T('crystal', { de: 'Kristall', g: 'm', words: ['kristall', 'kristalle', 'kristallen', 'edelstein', 'edelsteine', 'amethyst', 'diamant', 'diamanten', 'crystal', 'crystals', 'gem', 'gems', 'gemstone', 'quarz'],
    slots: { body: ['#a05bd6', 'kristall|kristalle|edelstein|crystals?|gems?|body'], rock: ['#5f5d58', 'stein|fels|rock|base|sockel'] },
    def: (f, rc) => (/diamant|diamond/.test((rc && rc.raw) || '') ? { body: '#bfefff' } : {}),
    size: [15, 16, 15],
    build(c) {
      const P = [ball(7, 0, 7, 6.5, 2.4, 6.5, c.rock, 'stone', UP)];
      for (const [x, z, r, h] of [[7, 7, 1.7, 11], [3.6, 8.5, 1.2, 7], [10.6, 6, 1.3, 8], [5.6, 3.6, 1.1, 5.5], [9.4, 10.5, 1.1, 6.5], [11.5, 10, 0.9, 4.5]]) P.push(cyl(x, 1, z, r, h, 'y', c.body, 'glass'), cone(x, 1 + h, z, r, Math.max(2, r * 1.8), 'y', c.body, 'glass'));
      return P;
    },
    note: () => 'Eine Gruppe leuchtender Kristalle auf einem Stein.' });
  T('mountain', { de: 'Berg', g: 'm', words: ['=berg', 'berge', 'gebirge', 'bergspitze', 'gipfel', 'mountain', 'mountains', 'vulkan', 'vulkane', 'volcano', 'hugel', 'hill', 'matterhorn'],
    slots: { body: ['#7d7a74', 'berg|fels|stein|hang|mountain|body|vulkan'], top: [WHITE, 'gipfel|spitze|schnee|snow|top|peak'], lava: ['#ff6a00', 'lava|magma|feuer'] },
    feats: { volcano: ['vulkan', 'vulkane', 'volcano', 'lava'], hill: ['hugel', 'hill', 'grun', 'gruner', 'grune', 'wiese'] },
    def: (f) => (f.volcano ? { body: '#4a3f3a' } : f.hill ? { body: '#5d9a3a' } : {}),
    nameOf: (f) => (f.volcano ? ['Vulkan', 'm'] : f.hill ? ['Hügel', 'm'] : null),
    size: (f) => (f.hill ? [33, 11, 33] : [33, 24, 33]),
    build(c, f) {
      if (f.hill) return [ball(16, 0, 16, 16, 10, 16, c.body, null, UP), ball(10, 0, 20, 8, 7, 8, '#6aa846', null, UP)];
      if (f.volcano) {
        const P = [cone(16, 0, 16, 16, 26, 'y', c.body, 'stone', { clip: [-99, 0, -99, 99, 17, 99] }), cyl(16, 13, 16, 4.6, 6, 'y', AIR), cyl(16, 13, 16, 4.6, 1, 'y', c.lava, 'light')];
        for (const [x, z] of [[16, 11.5], [12, 13], [20.5, 13.5]]) P.push(line(x, 17, z, 16 + (x - 16) * 3, 4, 16 + (z - 16) * 4.2, 0.8, c.lava, 'light'));
        P.push(ball(16, 21, 16, 3, 2, 3, '#8a8f96'), ball(18, 24, 17, 2.4, 1.8, 2.4, '#a8adb4'), ball(15, 26, 18, 2, 1.6, 2, '#c8ccd2'));
        return P;
      }
      return [cone(16, 0, 16, 16, 24, 'y', c.body, 'stone'), cone(7, 0, 20, 8, 12, 'y', '#8a8780', 'stone'), cone(25, 0, 12, 7, 10, 'y', '#8a8780', 'stone'), cone(16, 15, 16, 6.2, 9, 'y', c.top), cone(16, 0, 16, 16.6, 3, 'y', '#5d8a3a', 'leaves'), cone(7, 8, 20, 2.6, 4, 'y', c.top)];
    },
    note: (c, f) => f.volcano ? 'Ein Vulkan mit Lava im Krater und Rauch.' : f.hill ? 'Ein grüner Hügel.' : 'Ein Berg mit Schneegipfel.' });
  T('island', { de: 'Insel', g: 'f', words: ['insel', 'inseln', 'inselchen', 'schatzinsel', 'sudseeinsel', 'island', 'islands', 'palmeninsel', 'atoll'],
    slots: { body: ['#e8d29a', 'insel|sand|strand|island|beach|body'], water: ['#3fa7d6', 'wasser|meer|water|sea'] },
    feats: { treasure: ['schatz', 'schatzinsel', 'schatztruhe', 'treasure', 'truhe'], water: ['wasser', 'meer', 'water', 'sea', 'ozean'] }, on: { water: true },
    size: [30, 19, 28],
    build(c, f) {
      const P = [ball(14, 0, 13, 11, 3, 10, c.body, null, UP), ball(18, 0, 16, 6, 4, 6, '#d9c286', null, UP), ...sub('palm', 0.8, [8.5, 2.5, 7])];
      if (f.water) P.push(cyl(14, 0, 13, 15, 1, 'y', c.water, 'water', { inner: 10.5 }));
      if (f.treasure) P.push(box(17, 3, 9, 20, 5, 11, '#7a4a2a', 'wood'), box(17, 5, 9, 20, 5, 11, '#5a3a1a', 'wood'), box(18, 4, 9, 18, 4, 9, GOLD, 'metal'), ball(18.5, 6, 10, 1, 0.6, 0.8, GOLD, 'metal'));
      return P;
    },
    note: (c, f) => 'Eine kleine Insel mit Palme' + (f.treasure ? ' und Schatztruhe' : '') + '.' });
  T('forest', { de: 'Wald', g: 'm', words: ['=wald', 'walder', 'waldchen', 'mischwald', 'tannenwald', 'nadelwald', 'forest', 'woods', 'baumgruppe', 'hain'],
    slots: { leaves: [LEAF, SYN.leaves + '|wald|baume|trees'] },
    feats: { pines: ['tannenwald', 'nadelwald', 'tannen', 'fichten', 'pines'], mixed: ['mischwald'] },
    size: [44, 22, 40],
    build(c, f) {
      const P = [], spots = [[2, 4, 1], [16, 0, 0.9], [30, 3, 1.05], [8, 16, 0.85], [23, 14, 1.1], [36, 17, 0.8], [1, 27, 0.95], [15, 29, 1], [29, 28, 0.9]];
      spots.forEach(([x, z, k], i) => { const pine = f.pines || (!f.mixed ? i % 3 === 1 : i % 2 === 0); P.push(...(pine ? sub('pine', k, [x, 0, z]) : sub('tree', k * 0.85, [x, 0, z], { leaves: i % 4 === 3 ? '#4f8a3a' : c.leaves }))); });
      return P;
    },
    note: (c, f) => f.pines ? 'Ein kleiner Tannenwald.' : 'Ein kleiner Wald aus Laubbäumen und Tannen.' });
  T('cloud', { de: 'Wolke', g: 'f', words: ['wolke', 'wolken', 'regenwolke', 'gewitterwolke', 'cloud', 'clouds', 'raincloud'],
    slots: { body: ['#f4f6f8', 'wolke|cloud|body'] },
    feats: { rain: ['regen', 'regenwolke', 'rain', 'rainy', 'regnet'], storm: ['gewitter', 'gewitterwolke', 'blitz', 'storm', 'thunder', 'lightning'] },
    def: (f) => (f.rain || f.storm ? { body: '#8a929c' } : {}),
    size: (f) => [22, f.rain || f.storm ? 18 : 11, 12],
    build(c, f) {
      const y = f.rain || f.storm ? 7 : 0, P = [[8, 4, 6, 5, 3.5, 4.4], [13, 5, 6, 4.6, 4, 4.4], [4, 3.4, 6, 3.6, 3, 3.6], [10, 7.4, 6, 4, 3, 3.6], [17.4, 3.4, 6, 3.2, 2.6, 3.2]].map(([x, yy, z, a, b, d]) => ball(x, y + yy, z, a, b, d, c.body));
      if (f.rain) for (const [x, z] of [[4, 4], [8, 7], [12, 5], [16, 8], [6, 9], [14, 3]]) P.push(line(x, y, z, x, y - 6 + (x % 3), z, 0.3, '#3fa7d6', 'water'));
      if (f.storm) P.push(line(10, y, 4, 8, y - 3, 4, 0.5, '#ffe14d', 'light'), line(8, y - 3, 4, 11, y - 4, 4, 0.5, '#ffe14d', 'light'), line(11, y - 4, 4, 9, y - 7, 4, 0.5, '#ffe14d', 'light'));
      return P;
    },
    note: (c, f) => f.storm ? 'Eine Gewitterwolke mit Blitz.' : f.rain ? 'Eine Regenwolke.' : 'Eine weiße Wolke.' });
  T('rainbow', { de: 'Regenbogen', g: 'm', words: ['regenbogen', 'rainbow', 'rainbows'],
    slots: {},
    size: [37, 20, 6],
    build() {
      const K = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#3949ab', '#8e24aa'], P = [];
      K.forEach((col, i) => P.push(cyl(18, 1, 1, 16 - i, 2, 'z', col, null, { inner: 15 - i, clip: [-99, 1, -99, 99, 99, 99] })));
      for (const x of [2.5, 33.5]) P.push(ball(x, 2.5, 2, 3.2, 2.4, 2.4, '#f4f6f8'), ball(x + (x < 9 ? 2.6 : -2.6), 1.8, 2, 2.4, 1.8, 2, '#f4f6f8'), ball(x, 1, 2, 3.6, 1.2, 2.6, '#f4f6f8'));
      return P;
    },
    note: () => 'Ein Regenbogen in sieben Farben, der auf zwei Wolken steht.' });
  T('sun', { de: 'Sonne', g: 'f', words: ['sonne', 'sonnen', '=sun', 'sunshine', 'sonnenschein'],
    slots: { body: ['#ffcc33', 'sonne|sun|body|kugel'], rays: ['#ff9f1a', 'strahlen|rays'] },
    feats: { face: ['gesicht', 'lachend', 'lachende', 'face', 'smile', 'smiling', 'freundlich'] },
    size: [25, 25, 7],
    build(c, f) {
      const P = [ball(12, 12, 3, 7, 7, 3, c.body, 'light')];
      for (let a = 0; a < 12; a++) { const t = a * Math.PI / 6, L0 = 8.5, L1 = a % 2 ? 11 : 12.5; P.push(line(12 + L0 * Math.cos(t), 12 + L0 * Math.sin(t), 3, 12 + L1 * Math.cos(t), 12 + L1 * Math.sin(t), 3, a % 2 ? 0.6 : 0.9, c.rays, 'light')); }
      if (f.face) P.push(box(9, 13, 0, 10, 14, 0, '#3a2a20'), box(14, 13, 0, 15, 14, 0, '#3a2a20'), box(9, 9, 0, 15, 9, 0, '#3a2a20'), box(8, 10, 0, 8, 10, 0, '#3a2a20'), box(16, 10, 0, 16, 10, 0, '#3a2a20'), ball(7.5, 11, 0.5, 1, 0.8, 0.5, '#ff8c69'), ball(16.5, 11, 0.5, 1, 0.8, 0.5, '#ff8c69'));
      return P;
    },
    note: (c, f) => 'Eine leuchtende Sonne mit Strahlen' + (f.face ? ' und lachendem Gesicht.' : '.') });
  T('moon', { de: 'Mond', g: 'm', words: ['=mond', 'monde', 'halbmond', 'mondsichel', '=moon', 'crescent', 'vollmond'],
    slots: { body: ['#f3e9b0', 'mond|moon|body'] },
    feats: { full: ['vollmond', 'full moon', 'kugel', 'rund'] },
    size: [15, 15, 15],
    build: (c, f) => (f.full ? [ball(7, 7, 7, 7, 7, 7, '#d8d4c8', 'stone'), ball(4, 9, 1.2, 1.6, 1.6, 0.8, '#b8b4a8', 'stone'), ball(9, 4, 0.8, 2, 2, 0.8, '#b8b4a8', 'stone'), ball(10, 10, 1, 1.2, 1.2, 0.6, '#b8b4a8', 'stone')]
      : [ball(7, 7, 7, 7, 7, 3, c.body, 'light'), ball(11, 9, 7, 6.4, 6.4, 4, AIR)]),
    nameOf: (f) => (f.full ? ['Vollmond', 'm'] : null),
    note: (c, f) => f.full ? 'Ein Vollmond mit Kratern.' : 'Eine leuchtende Mondsichel.' });
  const STAR = ['.......X.......', '......XXX......', '......XXX......', '.....XXXXX.....', 'XXXXXXXXXXXXXXX', '.XXXXXXXXXXXXX.', '...XXXXXXXXX...', '....XXXXXXX....', '....XXXXXXX....', '...XXXXXXXXX...', '...XXXX.XXXX...', '..XXX.....XXX..', '..XX.......XX..', '.X...........X.'];
  T('star', { de: 'Stern', g: 'm', words: ['=stern', 'sterne', 'sternchen', 'weihnachtsstern', '=star', 'stars', 'goldstern'],
    slots: { body: ['#ffd23f', 'stern|star|body'] },
    size: [15, 14, 7],
    build: (c) => [Object.assign(bitmap(STAR, { X: c.body }, 3), { mat: 'light' })],
    note: () => 'Ein leuchtender Stern.' });
  const HEART = ['..XXX...XXX..', '.XXXXX.XXXXX.', 'XXXXXXXXXXXXX', 'XXXXXXXXXXXXX', 'XXXXXXXXXXXXX', '.XXXXXXXXXXX.', '..XXXXXXXXX..', '...XXXXXXX...', '....XXXXX....', '.....XXX.....', '......X......'];
  T('heart', { de: 'Herz', g: 'n', words: ['=herz', 'herzen', 'herzchen', 'heart', 'hearts', 'liebe', 'love'],
    slots: { body: ['#e0245e', 'herz|heart|body'] },
    size: [13, 11, 7],
    build: (c) => [bitmap(HEART, { X: c.body }, 3)],
    note: () => 'Ein rundes Herz.' });
  T('planet', { de: 'Planet', g: 'm', words: ['planet', 'planeten', 'saturn', 'jupiter', '=mars', 'erde', 'erdkugel', 'weltkugel', 'globus', 'earth', 'globe', 'neptun', 'uranus'],
    slots: { body: ['#e0b878', 'planet|kugel|body|saturn|jupiter'], ring: ['#c8a46a', 'ring|ringe|rings?'] },
    feats: { ring: ['saturn', 'ring', 'ringe', 'rings', 'uranus'], earth: ['erde', 'erdkugel', 'weltkugel', 'globus', 'earth', 'globe'], mars: ['=mars', 'roter planet'] }, on: { ring: true },
    def: (f) => (f.earth ? { body: '#2e6fd8' } : f.mars ? { body: '#c1440e' } : {}),
    nameOf: (f) => (f.earth ? ['Erde', 'f'] : f.mars ? ['Mars', 'm'] : null),
    build(c, f) {
      const ring = f.ring && !f.earth && !f.mars, P = [ball(11, 11, 11, 7, 7, 7, c.body)];
      if (f.earth) for (const [a, e, r] of [[0.3, 0.3, 3], [1.4, -0.2, 2.6], [2.6, 0.5, 3.2], [3.9, -0.4, 2.4], [5.2, 0.1, 2.8], [0.9, -0.7, 2]]) P.push(ball(11 + 6.6 * Math.cos(a) * Math.cos(e), 11 + 6.6 * Math.sin(e), 11 + 6.6 * Math.sin(a) * Math.cos(e), r, r * 0.8, r, '#3e9a4a'));
      if (f.earth) P.push(ball(11, 17.4, 11, 3.4, 1, 3.4, WHITE), ball(11, 4.6, 11, 3, 1, 3, WHITE));
      if (!f.earth && !f.mars) for (const y of [8, 13]) P.push(ball(11, 11, 11, 7.05, 7.05, 7.05, y === 8 ? '#c99a5a' : '#ecd0a0', null, { clip: [-99, y, -99, 99, y, 99] }));
      if (ring) P.push(cyl(11, 11, 11, 11, 1, 'y', c.ring, null, { inner: 8.6 }));
      return P;
    },
    size: [23, 15, 23],
    note: (c, f) => f.earth ? 'Die Erde mit Kontinenten und Polkappen.' : f.mars ? 'Der rote Planet.' : 'Ein Planet mit Ring.' });
  T('campfire', { de: 'Lagerfeuer', g: 'n', words: ['lagerfeuer', 'feuerstelle', 'campfire', 'bonfire', 'feuer', 'fire', 'grillfeuer'],
    slots: { flame: ['#ff7a00', 'flamme|flammen|feuer|flames?|fire'], logs: ['#6b4a2b', 'holz|scheite|logs?'] },
    size: [13, 9, 13],
    build(c) {
      const P = [];
      for (let a = 0; a < 10; a++) { const t = a * Math.PI / 5; P.push(ball(6 + 5 * Math.cos(t), 0.6, 6 + 5 * Math.sin(t), 1.1, 0.8, 1.1, a % 2 ? '#8a8780' : '#9c9a94', 'stone')); }
      P.push(line(3, 0.5, 6, 9, 0.5, 6, 0.7, c.logs, 'wood'), line(6, 0.5, 3, 6, 0.5, 9, 0.7, c.logs, 'wood'), line(4, 0, 4, 6, 4, 6, 0.5, c.logs, 'wood'), line(8, 0, 8, 6, 4, 6, 0.5, c.logs, 'wood'), line(8, 0, 4, 6, 4, 6, 0.5, c.logs, 'wood'),
        cone(6, 1, 6, 2.6, 5, 'y', c.flame, 'light'), cone(6, 1, 6, 1.5, 7.5, 'y', '#ffd23f', 'light'), cone(4.8, 1, 6.5, 1.2, 3.5, 'y', c.flame, 'light'), cone(7.2, 1, 5.5, 1.2, 4, 'y', c.flame, 'light'));
      return P;
    },
    note: () => 'Ein Lagerfeuer mit Steinkreis und Holzscheiten.' });
  T('pumpkin', { de: 'Kürbis', g: 'm', words: ['kurbis', 'kurbisse', 'kurbislaterne', 'halloweenkurbis', 'pumpkin', 'pumpkins', 'jack o lantern'],
    slots: { body: ['#e67e22', 'kurbis|pumpkin|body'], stem: ['#5a7a2a', 'stiel|stem'] },
    feats: { face: ['halloween', 'gesicht', 'kurbislaterne', 'grusel', 'gruselig', 'face', 'jack o lantern', 'leuchtend', 'spooky'] },
    size: [15, 12, 15],
    build(c, f) {
      const P = [ball(7, 5, 7, 7, 5, 7, c.body), ball(4.4, 5, 7, 4, 4.8, 5.6, '#d86d17'), ball(9.6, 5, 7, 4, 4.8, 5.6, '#d86d17'), ball(7, 5, 4.4, 5.6, 4.8, 4, '#d86d17'), ball(7, 5, 7, 6.2, 5.2, 6.2, c.body), cyl(7, 9.6, 7, 0.9, 2, 'y', c.stem), line(7, 11, 7, 8.6, 11.6, 7, 0.4, c.stem)];
      if (f.face) { const F = Object.assign({ paint: true }); for (const b of [[4, 6, 5, 7], [9, 6, 10, 7], [7, 5, 7, 5], [4, 3, 10, 3], [5, 2, 5, 2], [9, 2, 9, 2], [7, 2, 7, 2]]) P.push(box(b[0], b[1], 0, b[2], b[3], 3, '#ffcf4a', 'light', F)); }
      return P;
    },
    note: (c, f) => f.face ? 'Ein Halloween-Kürbis mit leuchtendem Gesicht.' : 'Ein Kürbis mit Stiel.' });

  // ---------------------------------------------------------------- animals
  CAT = 'animal';
  const PNT = { paint: true }, PMR = { paint: true, mirror: true };
  // a four-legged animal from its measures; the nose looks toward z = 0. Returns the parts and where things are.
  function quad(c, o) {
    const W = o.W, X = W + 2, cx = (X - 1) / 2, [hw, hh, hd] = o.head, P = [];
    const LH = o.LH, H = o.H, L = o.L, zb = o.zb, lw = o.lw || 2, top = LH + H - 1, back = zb + L - 1;
    const hx0 = cx - (hw - 1) / 2, hx1 = cx + (hw - 1) / 2, hy = o.hy, hz = o.hz || 0, B = c.body, Hd = c.head || B, Lg = c.legs || B;
    if (o.round) P.push(ball(cx, LH + H / 2 - 0.5, zb + L / 2 - 0.5, W / 2 + 0.2, H / 2 + 0.2, L / 2 + 0.2, B));
    else P.push(box(1, LH, zb, W, top, back, B));
    const li = o.legIn ?? 1, lx = o.legX ?? 0;
    for (const z of [zb + li, back - li - lw + 1]) { P.push(box(1 + lx, 0, z, lx + lw, LH - 1 + (o.round ? 2 : 0), z + lw - 1, Lg, null, MR)); if (c.paw) P.push(box(1 + lx, 0, z, lx + lw, 0, z + lw - 1, c.paw, null, MR)); }
    if (o.neck) P.push(line(cx, top - 1, zb + 1.5, cx, hy + 1, hz + hd - 1.5, o.neck, c.neck || B));
    P.push(box(hx0, hy, hz, hx1, hy + hh - 1, hz + hd - 1, Hd));
    if (o.snout) { const [sw, sh, sd, sy] = o.snout, nw = Math.min(sw, o.noseW || 2); P.push(box(cx - (sw - 1) / 2, hy + sy, hz - sd, cx + (sw - 1) / 2, hy + sy + sh - 1, hz - 1, c.snout || Hd)); if (o.nose !== false) P.push(box(cx - (nw - 1) / 2, hy + sy + sh - 1, hz - sd, cx + (nw - 1) / 2, hy + sy + sh - 1, hz - sd, c.nose || DARK)); }
    const ey = hy + hh - 1 - (o.eyeDown ?? 2), ex = hx0 + (o.eyeIn ?? 1);
    if (o.eyeSide) P.push(box(hx0, ey, hz + (o.eyeZ ?? 2), hx0, ey, hz + (o.eyeZ ?? 2), c.eyes || DARK, null, PMR));
    else if (o.eyeWhite) P.push(box(ex, ey, hz, ex, ey, hz, WHITE, null, MR), box(ex + 1, ey, hz, ex + 1, ey, hz, c.eyes || DARK, null, MR));
    else P.push(box(ex, ey, hz, ex, ey, hz, c.eyes || DARK, null, MR));
    const et = hy + hh, ez = o.earZ ?? hz + 1, E = c.ears || Hd;
    if (o.ears === 'up') P.push(box(hx0, et, ez, hx0 + 1, et + 1, ez, E, null, MR));
    if (o.ears === 'point') P.push(cone(hx0 + 0.5, et, ez + 0.5, 1.1, 3, 'y', E, null, MR));
    if (o.ears === 'flop') P.push(box(hx0 - 1, et - 4, ez, hx0 - 1, et - 1, ez + 1, E, null, MR));
    if (o.ears === 'side') P.push(box(hx0 - 1, et - 2, ez, hx0 - 1, et - 1, ez + 1, E, null, MR));
    if (o.ears === 'round') P.push(cyl(hx0 + 0.5, et + 0.2, ez, 1.4, 1, 'z', E, null, MR));
    if (o.ears === 'long') P.push(box(hx0 + 0.5, et, ez + 1, hx0 + 0.5, et + 5, ez + 1, E, null, MR), box(hx0 + 0.5, et + 1, ez, hx0 + 0.5, et + 4, ez, c.inner || '#f0b0b8', null, MR));
    if (o.ears === 'big') P.push(box(hx0 - 1, hy - 1, hz + 2, hx0 - 1, hy + hh, hz + hd + 1, E, null, MR));
    const T = c.tail || B, tl = o.tail;
    if (tl === 'up') P.push(line(cx, top, back, cx, top + 4, back + 2, 0.55, T));
    if (tl === 'cat') P.push(line(cx, top, back, cx, top + 2, back + 3, 0.55, T), line(cx, top + 2, back + 3, cx, top + 7, back + 3.5, 0.55, T));
    if (tl === 'down') P.push(line(cx, top, back, cx, LH, back + 2, 0.6, T));
    if (tl === 'horse') P.push(line(cx, top, back + 0.5, cx, LH + 1, back + 2.5, 0.95, T));
    if (tl === 'bushy') P.push(ball(cx, top - 1, back + 2.5, 1.7, 1.7, 3, T), ball(cx, top - 1.3, back + 5.2, 1.1, 1.1, 1.1, c.tip || WHITE));
    if (tl === 'short') P.push(ball(cx, top - 1, back + 0.6, 1.1, 1.1, 1.1, T));
    if (tl === 'puff') P.push(ball(cx, top - 1.5, back + 0.8, 1.6, 1.6, 1.4, c.tip || WHITE));
    if (tl === 'curl') P.push(line(cx, top - 1, back, cx, top + 1, back + 1.5, 0.45, T), line(cx, top + 1, back + 1.5, cx + 1, top + 0.2, back + 2.2, 0.45, T));
    if (tl === 'tuft') P.push(line(cx, top, back, cx, LH + 1, back + 1.5, 0.35, T), ball(cx, LH + 1, back + 1.5, 0.9, 1.3, 0.9, c.tuft || DARK));
    if (tl === 'thin') P.push(line(cx, top - 1, back, cx, 1, back + 3, 0.3, T), line(cx, 1, back + 3, cx + 2, 0.5, back + 6, 0.3, T));
    return { P, g: { cx, X, hx0, hx1, hy, hz, hd, hh, zb, back, top, LH, H, L, W, et } };
  }
  const furOf = (f, base) => (f.black ? '#2a2a2a' : f.white ? '#f2f0ea' : base);
  T('dog', { de: 'Hund', g: 'm', words: ['=hund', 'hunde', 'hundchen', 'welpe', 'welpen', 'dackel', 'dalmatiner', 'schaferhund', 'labrador', 'retriever', 'husky', 'mops', 'pudel', 'terrier', 'bello', 'wauwau', '=dog', 'dogs', 'puppy', 'doggy', 'hundi'],
    slots: { body: ['#c8a165', 'hund|fell|korper|body|dog|welpe|dackel'], ears: ['#a87a45', 'ohren|ohr|ears?'], collar: ['#c0392b', 'halsband|collar'] },
    feats: { dalmatian: ['dalmatiner', 'dalmatian', 'punkte', 'gepunktet', 'spots'], dachshund: ['dackel', 'dachshund', 'wiener'], shepherd: ['schaferhund', 'shepherd', 'wolf', 'husky'], puppy: ['welpe', 'welpen', 'hundchen', 'puppy', 'baby'] },
    def: (f) => (f.dalmatian ? { body: WHITE, ears: '#2a2a2a' } : f.dachshund ? { body: '#8b4a2a', ears: '#6b3a1a' } : f.shepherd ? { body: '#b07a3a', ears: '#3a2a20' } : {}),
    nameOf: (f) => (f.dalmatian ? ['Dalmatiner', 'm'] : f.dachshund ? ['Dackel', 'm'] : f.shepherd ? ['Schäferhund', 'm'] : f.puppy ? ['Welpe', 'm'] : null),
    size: (f) => [8, 13, f.dachshund ? 18 : 16],
    build(c, f) {
      const L = f.dachshund ? 14 : f.puppy ? 8 : 11, LH = f.dachshund ? 2 : f.puppy ? 3 : 4, hy = LH + 2;
      const { P, g } = quad(c, { W: 6, L, H: 5, LH, zb: 5, head: f.puppy ? [6, 6, 5] : [6, 5, 5], hy, hz: 2, snout: [4, 3, 2, 0], ears: f.shepherd ? 'point' : 'flop', earZ: 3, tail: f.shepherd ? 'bushy' : 'up' });
      P.push(box(g.hx0, hy, 6, g.hx1, hy + 1, 6, c.collar, null, PNT), box(3, hy - 0.4, 6, 4, hy - 0.4, 6, GOLD), box(2.5, hy + 0, 0, 4.5, hy + 0, 0, '#d05060'));
      if (f.dalmatian) for (const [x, y, z] of [[1, LH + 3, 7], [6, LH + 2, 10], [1, LH + 1, 12], [6, LH + 4, 14], [3.5, LH + 5, 9], [2, LH + 4, 15], [4.5, hy + 4, 2]]) P.push(ball(x, y, z, 1, 1, 1, '#1d1f22', null, PNT));
      if (f.shepherd) P.push(box(1, LH + 3, 6, 6, LH + 4, 5 + L - 2, '#2a2420', null, PNT));
      return P;
    },
    note: (c, f) => (f.dalmatian ? 'Ein Dalmatiner mit schwarzen Punkten' : f.dachshund ? 'Ein Dackel mit kurzen Beinen' : f.shepherd ? 'Ein Schäferhund' : f.puppy ? 'Ein kleiner Welpe' : 'Ein Hund mit Schlappohren') + ' und Halsband.' });
  T('cat', { de: 'Katze', g: 'f', words: ['katze', 'katzen', 'katzchen', 'kater', 'mieze', 'miezekatze', 'kitty', 'kitten', '=cat', 'cats', 'tiger', 'tigers', 'leopard', 'gepard', 'panther', 'jaguar'],
    slots: { body: ['#8a8f96', 'katze|kater|fell|korper|body|cat|tiger|mieze'], eyes: ['#7fbf3f', 'augen|auge|eyes?'], stripes: ['#3a3d42', 'streifen|stripes?|flecken|spots'] },
    feats: { tiger: ['tiger', 'tigers'], leopard: ['leopard', 'gepard', 'jaguar'], panther: ['panther'], stripes: ['streifen', 'getigert', 'gestreift', 'tabby', 'striped'], kitten: ['katzchen', 'kitten', 'baby', 'klein'] },
    def: (f) => (f.tiger ? { body: '#e8862a', stripes: '#1d1f22', eyes: '#f1c40f' } : f.leopard ? { body: '#e0b860', stripes: '#3a2a18', eyes: '#f1c40f' } : f.panther ? { body: '#1d1f22', eyes: '#f1c40f' } : {}),
    nameOf: (f) => (f.tiger ? ['Tiger', 'm'] : f.leopard ? ['Leopard', 'm'] : f.panther ? ['Panther', 'm'] : f.kitten ? ['Kätzchen', 'n'] : null),
    size: (f) => (f.tiger || f.leopard || f.panther ? [9, 13, 18] : [7, 13, 14]),
    build(c, f) {
      const big = f.tiger || f.leopard || f.panther;
      const o = big ? { W: 7, L: 13, H: 5, LH: 5, zb: 4, head: [5, 5, 4], hy: 7, hz: 1, snout: [3, 2, 1, 0], ears: 'round', tail: 'cat' } : { W: 5, L: 10, H: 4, LH: 3, zb: 3, head: [5, 5, 4], hy: 5, hz: 1, snout: [3, 2, 1, 0], ears: 'point', tail: 'cat' };
      const { P, g } = quad(Object.assign({}, c, { snout: big ? '#f2e2c8' : shade(c.body, 1.15), nose: '#e88a9a' }), o);
      if (f.tiger || f.stripes) for (let z = g.zb + 1; z < g.back; z += 2.5) P.push(box(1, g.top - (big ? 3 : 2), z, g.W, g.top, z, c.stripes, null, PNT));
      if (f.tiger) P.push(box(g.hx0, g.hy + 3, g.hz, g.hx0 + 1, g.hy + 3, g.hz + 3, c.stripes, null, PMR), box(g.cx - 0.5, g.hy + 4, g.hz, g.cx + 0.5, g.hy + 4, g.hz + 3, c.stripes, null, PNT));
      if (f.leopard) for (const [x, y, z] of [[1, 8, 6], [7, 7, 8], [1, 6, 11], [7, 9, 12], [4, 9, 7], [3, 9, 14], [1, 8, 15]]) P.push(ball(x, y, z, 0.8, 0.8, 0.8, c.stripes, null, PNT));
      return P;
    },
    note: (c, f) => f.tiger ? 'Ein Tiger mit Streifen.' : f.leopard ? 'Ein Leopard mit Flecken.' : f.panther ? 'Ein schwarzer Panther.' : 'Eine Katze mit Schnurrhaaren und langem Schwanz.' });
  function horseParts(c, f) {
    const pony = f.pony, LH = pony ? 6 : 9, top = LH + 5, hy = top + 3;
    const { P, g } = quad(c, { W: 6, L: 13, H: 6, LH, zb: 6, head: [4, 4, 7], hy, hz: 0, neck: 1.7, ears: 'up', earZ: 5, eyeSide: true, eyeZ: 3, tail: 'horse', snout: null });
    P.push(box(g.hx0, hy, 0, g.hx1, hy + 1, 1, c.snout || shade(c.body, 0.8)), box(2.5, hy + 1, 0, 2.5, hy + 1, 0, DARK, null, MR));
    const M = Array.isArray(c.mane) ? c.mane : [c.mane];
    for (let i = 0; i < 6; i++) { const t = i / 6, t2 = (i + 1) / 6; P.push(line(g.cx, top + 0.5 + t * (hy + 3 - top), 8.5 - t * 4, g.cx, top + 0.5 + t2 * (hy + 3 - top), 8.5 - t2 * 4, pony ? 1.1 : 0.8, M[i % M.length])); }
    P.push(box(g.hx0 + 1, hy + 4, 3, g.hx1 - 1, hy + 4, 5, M[0]));
    for (const z of [7, 16]) P.push(box(1, 0, z, 2, 0, z + 1, c.paw || '#3a2a20', null, MR));
    if (f.zebra) { for (let z = 7; z < 19; z += 2) P.push(box(1, LH, z, 6, top, z, DARK, null, PNT)); for (let y = 1; y < LH; y += 2) P.push(box(1, y, 6, 6, y, 19, DARK, null, PNT)); for (let y = top + 1; y < hy; y += 2) P.push(box(1, y, 3, 6, y, 9, DARK, null, PNT)); }
    if (f.horn) P.push(cone(g.cx, hy + 4, 1.5, 0.9, 5, 'y', c.horn || GOLD, 'metal'));
    return P;
  }
  T('horse', { de: 'Pferd', g: 'n', words: ['pferd', 'pferde', 'pferdchen', 'pony', 'ponys', 'fohlen', 'hengst', 'stute', 'schimmel', 'rappe', '=gaul', 'zebra', 'zebras', 'esel', 'horse', 'horses', 'pony', 'foal', 'donkey'],
    slots: { body: ['#8b5a2b', 'pferd|fell|korper|body|horse|pony|zebra|esel'], mane: ['#3a2a20', 'mahne|haare|schweif|mane|hair|tail'] },
    feats: { pony: ['pony', 'ponys', 'fohlen', 'foal', 'esel', 'donkey'], zebra: ['zebra', 'zebras'], white: ['schimmel'], black: ['rappe'], donkey: ['esel', 'donkey'] },
    def: (f) => (f.zebra ? { body: WHITE, mane: DARK } : f.white ? { body: '#f2f0ea', mane: '#d8d4cc' } : f.black ? { body: '#2a2422', mane: '#111111' } : f.donkey ? { body: '#8a8478', mane: '#4a4440' } : {}),
    nameOf: (f) => (f.zebra ? ['Zebra', 'n'] : f.donkey ? ['Esel', 'm'] : f.pony ? ['Pony', 'n'] : f.white ? ['Schimmel', 'm'] : null),
    size: (f) => [8, f.pony ? 22 : 25, 22],
    build: (c, f) => horseParts(c, f),
    note: (c, f) => f.zebra ? 'Ein Zebra mit Streifen.' : f.donkey ? 'Ein Esel.' : f.pony ? 'Ein Pony mit dicker Mähne.' : 'Ein Pferd mit Mähne, Schweif und Hufen.' });
  T('unicorn', { de: 'Einhorn', g: 'n', words: ['einhorn', 'einhorner', 'unicorn', 'unicorns', 'pegasus'],
    slots: { body: [WHITE, 'einhorn|fell|korper|body|unicorn'], horn: [GOLD, 'horn|horns?'], mane: [null, 'mahne|haare|mane|hair|schweif|tail'] },
    feats: { wings: ['flugel', 'pegasus', 'wings', 'fliegend'] },
    size: [8, 26, 22],
    build(c, f) {
      const rb = ['#ff6fa8', '#ffb347', '#fff275', '#7ee081', '#6fc3ff', '#b28dff'], P = horseParts(Object.assign({}, c, { mane: c.mane ? [c.mane] : rb, tail: c.mane || '#b28dff', paw: '#d4af37' }), { horn: true });
      if (f.wings) P.push(wedge(-4, 13, 9, 1, 19, 13, '-x', '#f4f4f2', null, MR), line(1, 14, 10, -4, 19, 11, 0.4, '#e8e0f0', null, MR));
      return P;
    },
    note: (c, f) => 'Ein Einhorn mit goldenem Horn und Regenbogenmähne' + (f.wings ? ' — und Flügeln.' : '.') });
  T('cow', { de: 'Kuh', g: 'f', words: ['=kuh', 'kuhe', 'kalb', 'kalber', 'rind', 'rinder', 'stier', 'bulle', 'ochse', '=cow', 'cows', 'cattle', 'bull', 'calf'],
    slots: { body: [WHITE, 'kuh|fell|korper|body|cow|rind'], spots: ['#1d1f22', 'flecken|punkte|spots?|patches'], snout: ['#f0a8b0', 'maul|nase|schnauze|snout|euter'] },
    feats: { bull: ['stier', 'bulle', 'ochse', 'bull'], brown: ['braunvieh', 'braun', 'brown', 'braune'] },
    def: (f) => (f.bull ? { body: '#5a3a24', spots: '#5a3a24' } : f.brown ? { body: '#8b5a2b', spots: WHITE } : {}),
    nameOf: (f) => (f.bull ? ['Stier', 'm'] : null),
    size: [10, 15, 19],
    build(c, f) {
      const { P, g } = quad(c, { W: 8, L: 14, H: 7, LH: 6, zb: 4, head: [6, 6, 4], hy: 8, hz: 1, snout: [6, 2, 1, 0], nose: false, ears: 'side', tail: 'tuft' });
      P.push(box(3, 9, 0, 3, 9, 0, '#7a4048', null, MR), box(1, 13, 2, 2, 14, 2, '#efe6cf', null, MR), box(1, 14, 2, 1, f.bull ? 15 : 14, 2, '#efe6cf', null, MR));
      if (!f.bull) P.push(box(3.5, 5, 13, 5.5, 5, 15, '#f0a8b0'));
      if (f.bull) P.push(cyl(4.5, 7.6, 0, 1, 1, 'z', GOLD, 'metal', { inner: 0.4 }));
      for (const [x, y, z, r] of [[1, 10, 7, 2], [8, 8, 12, 2.4], [4.5, 12, 15, 1.8], [1, 8, 15, 1.6], [8, 11, 6, 1.5], [4.5, 12, 9, 1.4]]) P.push(ball(x, y, z, r, r * 0.9, r, c.spots, null, PNT));
      return P;
    },
    note: (c, f) => f.bull ? 'Ein Stier mit Hörnern und Nasenring.' : 'Eine gefleckte Kuh mit Hörnern und Euter.' });
  T('pig', { de: 'Schwein', g: 'n', words: ['schwein', 'schweine', 'schweinchen', 'ferkel', 'sau', '=pig', 'pigs', 'piggy', 'piglet', 'wildschwein', 'boar'],
    slots: { body: ['#f5a6b8', 'schwein|haut|korper|body|pig|ferkel'], snout: ['#e88aa0', 'russel|schnauze|nase|snout'] },
    feats: { boar: ['wildschwein', 'boar', 'keiler'] },
    def: (f) => (f.boar ? { body: '#5a4232', snout: '#3a2a20' } : {}),
    nameOf: (f) => (f.boar ? ['Wildschwein', 'n'] : null),
    size: [10, 11, 16],
    build(c, f) {
      const { P } = quad(c, { W: 8, L: 11, H: 6, LH: 3, zb: 4, head: [6, 6, 4], hy: 4, hz: 1, snout: [4, 3, 1, 1], nose: false, ears: 'up', earZ: 2, tail: 'curl', eyeDown: 1 });
      P.push(box(4, 6, 0, 4, 6, 0, '#9a4a5a', null, MR));
      if (f.boar) P.push(line(3, 5, 0.5, 2.5, 7, -0.5, 0.35, WHITE, null, MR), box(1, 9, 5, 8, 10, 14, '#3a2a20', null, PNT));
      return P;
    },
    note: (c, f) => f.boar ? 'Ein Wildschwein mit Hauern.' : 'Ein rosa Schwein mit Ringelschwanz.' });
  T('sheep', { de: 'Schaf', g: 'n', words: ['schaf', 'schafe', 'schafchen', 'lamm', 'lammer', 'widder', 'ziege', 'ziegen', 'sheep', 'lamb', 'goat', 'alpaka', 'lama'],
    slots: { body: ['#f0ece2', 'wolle|fell|schaf|body|sheep|wool'], head: ['#3a3d42', 'kopf|gesicht|head|face|beine|legs'] },
    feats: { goat: ['ziege', 'ziegen', 'goat'], alpaca: ['alpaka', 'lama', 'alpaca', 'llama'] },
    def: (f) => (f.goat ? { body: '#e8e2d6', head: '#e8e2d6' } : f.alpaca ? { body: '#f2e2c4', head: '#f2e2c4' } : {}),
    nameOf: (f) => (f.goat ? ['Ziege', 'f'] : f.alpaca ? ['Alpaka', 'n'] : null),
    size: (f) => [10, f.alpaca ? 20 : 14, 16],
    build(c, f) {
      if (f.alpaca) { const { P } = quad(Object.assign({}, c, { legs: c.body }), { W: 6, L: 10, H: 6, LH: 6, zb: 5, head: [4, 4, 4], hy: 15, hz: 1, snout: [2, 2, 1, 0], neck: 1.6, ears: 'up', earZ: 3, tail: 'puff', round: true }); P.push(box(2, 0, 0, 7, 0, 0, AIR)); return P; }
      const { P, g } = quad(Object.assign({}, c, { legs: c.head }), { W: 8, L: 11, H: 7, LH: 5, zb: 4, head: [4, 5, 4], hy: 8, hz: 0, ears: 'side', tail: 'puff', round: !f.goat, eyeWhite: true, eyeIn: 0 });
      if (!f.goat) P.push(box(g.hx0, g.hy + 4, 1, g.hx1, g.hy + 5, 3, c.body), ball(2.5, 11, 7, 1.6, 1.3, 1.6, c.body, null, MR), ball(4.5, 12, 11, 1.6, 1.2, 1.6, c.body));
      else P.push(line(3, 13, 2, 2, 15, 5, 0.45, '#8a8478', null, MR), box(4, 7, 0, 5, 7, 1, '#d8d0c4'));
      return P;
    },
    note: (c, f) => f.goat ? 'Eine Ziege mit Hörnern und Bart.' : f.alpaca ? 'Ein flauschiges Alpaka.' : 'Ein wolliges Schaf.' });
  T('fox', { de: 'Fuchs', g: 'm', words: ['fuchs', 'fuchse', 'fuchschen', 'fox', 'foxes', 'wolf', 'wolfe', 'wolves'],
    slots: { body: ['#e0782a', 'fuchs|fell|korper|body|fox|wolf'], tip: [WHITE, 'spitze|brust|bauch|tip|chest'] },
    feats: { wolf: ['wolf', 'wolfe', 'wolves'] },
    def: (f) => (f.wolf ? { body: '#8a8f96', tip: '#e8e8e4' } : {}),
    nameOf: (f) => (f.wolf ? ['Wolf', 'm'] : null),
    size: [8, 13, 19],
    build(c, f) {
      const { P, g } = quad(Object.assign({}, c, { legs: f.wolf ? c.body : '#3a2a20', snout: c.tip, ears: c.body }), { W: 6, L: 10, H: 4, LH: 4, zb: 5, head: [6, 5, 4], hy: 6, hz: 2, snout: [2, 2, 2, 0], ears: 'point', earZ: 3, tail: 'bushy' });
      P.push(box(2, 4, 5, 5, 6, 5, c.tip, null, PNT), box(g.hx0, g.hy, g.hz, g.hx1, g.hy + 1, g.hz, c.tip, null, PNT), box(1, g.LH, 5, 2, g.LH, 5, c.body, null, MR));
      return P;
    },
    note: (c, f) => f.wolf ? 'Ein grauer Wolf mit buschigem Schwanz.' : 'Ein Fuchs mit spitzen Ohren und buschigem Schwanz.' });
  T('deer', { de: 'Hirsch', g: 'm', words: ['hirsch', 'hirsche', '=reh', 'rehe', 'rehkitz', 'kitz', 'elch', 'rentier', 'rentiere', 'deer', 'stag', 'reindeer', 'elk', 'moose', 'bambi'],
    slots: { body: ['#a0703a', 'fell|korper|body|hirsch|reh|deer'], antlers: ['#e0d0b0', 'geweih|antlers?|horner'] },
    feats: { antlers: ['hirsch', 'geweih', 'elch', 'rentier', 'stag', 'reindeer', 'antlers', 'moose', 'elk'], kid: ['kitz', 'rehkitz', 'bambi', 'fawn'], red: ['rentier', 'reindeer', 'rudolph', 'rote nase'] },
    def: (f) => (f.red ? { body: '#7a5a3a' } : {}),
    nameOf: (f) => (f.red ? ['Rentier', 'n'] : f.kid ? ['Rehkitz', 'n'] : f.antlers ? null : ['Reh', 'n']),
    size: [8, 25, 17],
    build(c, f) {
      const { P, g } = quad(c, { W: 6, L: 10, H: 5, LH: 8, lw: 1, legX: 1, zb: 5, head: [4, 4, 5], hy: 14, hz: 0, neck: 1.3, ears: 'up', earZ: 3, tail: 'puff' });
      P.push(box(2, 8, 6, 5, 8, 13, '#efe6cf', null, PNT), box(3, 14, 0, 4, 14, 0, DARK));
      if (f.antlers && !f.kid) P.push(line(2.5, 18, 3, 0.5, 22, 4, 0.45, c.antlers, null, MR), line(1.4, 20, 3.5, 2.5, 23, 2, 0.4, c.antlers, null, MR), line(0.8, 21.5, 3.8, -0.5, 24, 5, 0.4, c.antlers, null, MR));
      if (f.kid) for (const [x, y, z] of [[1, 11, 7], [1, 12, 10], [6, 11, 8], [6, 12, 11], [3.5, 12, 8]]) P.push(ball(x, y, z, 0.6, 0.6, 0.6, WHITE, null, PNT));
      if (f.red) P.push(box(3, 14, -1, 4, 15, 0, '#ff2020', 'light'));
      return P;
    },
    note: (c, f) => f.red ? 'Ein Rentier mit Geweih — und roter Nase.' : f.kid ? 'Ein Rehkitz mit weißen Tupfen.' : f.antlers ? 'Ein Hirsch mit Geweih.' : 'Ein Reh.' });
  T('bear', { de: 'Bär', g: 'm', words: ['=bar', 'baren', 'barchen', 'braunbar', 'eisbar', 'eisbaren', 'grizzly', 'panda', 'pandas', 'pandabar', 'koala', '=bear', 'bears', 'polar bear'],
    slots: { body: ['#6b4a2b', 'fell|korper|body|bar|bear|panda'], snout: ['#a07850', 'schnauze|maul|snout'] },
    feats: { panda: ['panda', 'pandas', 'pandabar'], polar: ['eisbar', 'eisbaren', 'polar'], koala: ['koala'] },
    def: (f) => (f.panda ? { body: WHITE, snout: WHITE } : f.polar ? { body: '#f2f0ea', snout: '#e8e4da' } : f.koala ? { body: '#9a9a9a', snout: '#9a9a9a' } : {}),
    nameOf: (f) => (f.panda ? ['Panda', 'm'] : f.polar ? ['Eisbär', 'm'] : f.koala ? ['Koala', 'm'] : null),
    size: [12, 17, 19],
    build(c, f) {
      const { P, g } = quad(Object.assign({}, c, f.panda ? { legs: DARK, ears: DARK } : {}), { W: 10, L: 13, H: 8, LH: 5, lw: 3, zb: 5, head: [8, 7, 6], hy: 8, hz: 2, snout: [4, 3, 2, 0], ears: 'round', earZ: 4, tail: 'short', eyeIn: 2 });
      if (f.panda) P.push(box(g.hx0 + 1, g.hy + 3, g.hz, g.hx0 + 2, g.hy + 5, g.hz, DARK, null, PMR), box(g.hx0 + 2, g.hy + 4, g.hz, g.hx0 + 2, g.hy + 4, g.hz, WHITE, null, PMR), box(1, 6, 7, 10, 13, 9, DARK, null, PNT));
      if (f.koala) P.push(box(g.hx0 - 1, g.et - 2, 3, g.hx0 - 1, g.et + 1, 6, '#c8c8c8', null, MR), box(4.5, 9, 0, 6.5, 11, 0, '#3a3d42'));
      return P;
    },
    note: (c, f) => f.panda ? 'Ein Panda — schwarz und weiß.' : f.polar ? 'Ein Eisbär.' : f.koala ? 'Ein Koala mit runden Ohren.' : 'Ein Braunbär mit runden Ohren.' });
  T('lion', { de: 'Löwe', g: 'm', words: ['lowe', 'lowen', 'lowin', 'lion', 'lions', 'lioness'],
    slots: { body: ['#d9a441', 'fell|korper|body|lowe|lion'], mane: ['#8b4a1a', 'mahne|mane|haare'] },
    feats: { female: ['lowin', 'lioness'] },
    nameOf: (f) => (f.female ? ['Löwin', 'f'] : null),
    size: [12, 17, 17],
    build(c, f) {
      const P0 = f.female ? [] : [ball(5.5, 12, 4.8, 5, 5.2, 3.4, c.mane)];
      const { P, g } = quad(Object.assign({}, c, { tuft: c.mane, ears: f.female ? c.body : c.mane }), { W: 8, L: 12, H: 6, LH: 6, zb: 5, head: [6, 6, 4], hy: 9, hz: 2, snout: [4, 2, 2, 0], ears: 'round', earZ: 3, tail: 'tuft' });
      if (!f.female) { P.splice(0, 0, ...P0); P.push(box(g.hx0, g.hy, g.hz, g.hx1, g.hy + 5, g.hz + 3, c.body), box(2.5, 13, 2, 2.5, 13, 2, DARK, null, MR), box(4, 9, 0, 5, 9, 0, DARK), box(4, 10, 0, 5, 10, 1, '#f2e2c8', null, PNT)); }
      return P;
    },
    note: (c, f) => f.female ? 'Eine Löwin.' : 'Ein Löwe mit großer Mähne.' });
  T('elephant', { de: 'Elefant', g: 'm', words: ['elefant', 'elefanten', 'elefantchen', 'elephant', 'elephants', 'mammut', 'mammoth', 'dumbo'],
    slots: { body: ['#8a8f96', 'haut|korper|body|elefant|elephant'], tusks: [WHITE, 'stosszahne|zahne|tusks?'] },
    feats: { mammoth: ['mammut', 'mammoth'] },
    def: (f) => (f.mammoth ? { body: '#6b4a2b' } : {}),
    nameOf: (f) => (f.mammoth ? ['Mammut', 'n'] : null),
    size: [14, 21, 22],
    build(c, f) {
      const { P, g } = quad(Object.assign({}, c, { paw: '#d8d0c0', ears: shade(c.body, 0.9) }), { W: 12, L: 15, H: 10, LH: 8, lw: 4, legIn: 0, zb: 5, head: [10, 9, 6], hy: 11, hz: 2, ears: 'big', tail: 'tuft', eyeDown: 3, eyeIn: 2 });
      P.push(line(g.cx, g.hy + 3, 1.5, g.cx, g.hy - 3, 1, 1.5, c.body), line(g.cx, g.hy - 3, 1, g.cx, 2, 0.5, 1.2, c.body), line(g.cx, 2, 0.5, g.cx, 1.2, -1.5, 1, c.body));
      P.push(line(g.cx - 2.5, g.hy + 1, 2, g.cx - 3, g.hy - 2, f.mammoth ? -2 : 0, f.mammoth ? 0.7 : 0.5, c.tusks, null, MR));
      if (f.mammoth) P.push(line(g.cx - 3, g.hy - 2, -2, g.cx - 2, g.hy, -4, 0.6, c.tusks, null, MR), box(1, 8, 5, 12, 18, 19, '#5a3a20', null, PNT));
      return P;
    },
    note: (c, f) => f.mammoth ? 'Ein Mammut mit langen Stoßzähnen.' : 'Ein Elefant mit Rüssel, großen Ohren und Stoßzähnen.' });
  T('giraffe', { de: 'Giraffe', g: 'f', words: ['giraffe', 'giraffen', 'giraffchen'],
    slots: { body: ['#e8b84a', 'fell|korper|body|giraffe'], spots: ['#9a5a2a', 'flecken|punkte|spots?'] },
    size: [8, 31, 15],
    build(c) {
      const { P, g } = quad(Object.assign({}, c, { tuft: '#5a3a1a' }), { W: 6, L: 9, H: 6, LH: 11, zb: 4, head: [4, 3, 5], hy: 26, hz: 0, neck: 1.4, ears: 'side', earZ: 3, tail: 'tuft', eyeDown: 1, eyeSide: true, eyeZ: 2 });
      P.push(cyl(2.5, 29, 3, 0.45, 2, 'y', '#7a4a2a', null, MR), ball(2.5, 31, 3, 0.7, 0.6, 0.7, '#5a3a1a', null, MR), box(2, 26, 0, 5, 26, 0, '#d8b080'));
      for (const [x, y, z] of [[1, 13, 6], [6, 14, 8], [1, 12, 10], [6, 12, 11], [3.5, 16, 7], [3.5, 16, 10], [1, 15, 9], [6, 16, 5]]) P.push(ball(x, y, z, 1.2, 1.1, 1.2, c.spots, null, PNT));
      for (let i = 0; i < 4; i++) { const t = (i + 0.5) / 4, y = 15 + t * 11.5, z = 5.5 - t * 2.5; P.push(ball(g.cx + (i % 2 ? 1.2 : -1.2), y, z, 0.9, 1, 0.9, c.spots, null, PNT)); }
      P.push(line(g.cx, 16, 7, g.cx, 26.5, 4.2, 0.5, '#9a5a2a'));
      return P;
    },
    note: () => 'Eine Giraffe mit langem Hals und Flecken.' });
  T('rabbit', { de: 'Hase', g: 'm', words: ['hase', 'hasen', 'haschen', 'kaninchen', 'hoppel', 'osterhase', 'bunny', 'rabbit', 'rabbits', 'hare'],
    slots: { body: ['#b8a898', 'fell|korper|body|hase|kaninchen|rabbit|bunny'], tip: [WHITE, 'schwanz|puschel|tail'] },
    feats: { easter: ['osterhase', 'ostern', 'easter'] },
    nameOf: (f) => (f.easter ? ['Osterhase', 'm'] : null),
    size: [8, 13, 12],
    build(c, f) {
      const { P } = quad(Object.assign({}, c, { nose: '#e88a9a' }), { W: 6, L: 8, H: 5, LH: 2, zb: 3, head: [4, 4, 4], hy: 5, hz: 1, snout: [2, 1, 1, 0], ears: 'long', earZ: 1, tail: 'puff', round: true });
      if (f.easter) P.push(box(5, 0, 0, 7, 3, 2, '#c8a165', 'wood'), ball(6, 4, 1, 0.8, 1, 0.8, '#ff6fa8'), ball(6.5, 4, 0.2, 0.7, 0.9, 0.7, '#6fc3ff'));
      return P;
    },
    note: (c, f) => f.easter ? 'Ein Osterhase mit Eierkorb.' : 'Ein Hase mit langen Ohren und Puschelschwanz.' });
  T('mouse', { de: 'Maus', g: 'f', words: ['=maus', 'mause', 'mauschen', 'ratte', 'ratten', 'hamster', 'meerschweinchen', 'mouse', 'mice', 'rat', 'guinea pig'],
    slots: { body: ['#9a9a9a', 'fell|korper|body|maus|mouse|hamster'] },
    feats: { hamster: ['hamster', 'meerschweinchen', 'guinea'] },
    def: (f) => (f.hamster ? { body: '#d8a060' } : {}),
    nameOf: (f) => (f.hamster ? ['Hamster', 'm'] : null),
    size: [6, 7, 15],
    build(c, f) {
      const { P } = quad(Object.assign({}, c, { nose: '#e88a9a', ears: '#e8b0b8', tail: '#e8b0b8' }), { W: 4, L: f.hamster ? 5 : 6, H: 3, LH: 1, lw: 1, zb: 2, head: [4, 3, 3], hy: 2, hz: 1, snout: [2, 1, 1, 0], ears: f.hamster ? null : 'round', earZ: 2, tail: f.hamster ? null : 'thin', round: true, eyeIn: 0 });
      if (f.hamster) P.push(box(1, 5, 2, 1, 5, 2, shade(c.body, 0.8), null, MR), ball(3.5, 2, 2.6, 1.4, 1, 0.8, '#f4e8d8', null, PNT));
      return P;
    },
    note: (c, f) => f.hamster ? 'Ein runder Hamster.' : 'Eine Maus mit runden Ohren und langem Schwanz.' });
  T('dino', { de: 'Dinosaurier', g: 'm', words: ['dinosaurier', '=dino', 'dinos', 't rex', 'trex', 'tyrannosaurus', 'raptor', 'velociraptor', 'dinosaur', 'dinosaurs', 'saurier'],
    slots: { body: ['#4e8a3e', 'haut|korper|body|dino|dinosaurier|saurier'], belly: ['#c8d090', 'bauch|belly'] },
    size: [14, 22, 33],
    build(c) {
      const B = c.body;
      return [ball(6.5, 12, 14, 4.5, 5, 6.5, B), ball(3.5, 9, 16, 2.2, 3.6, 3.2, B, null, MR), line(3.5, 7, 16, 3.5, 1, 15, 1.3, B, null, MR), box(2, 0, 12, 5, 0, 16, B, null, MR), box(2, 0, 11, 2, 0, 11, '#e8e0c0', null, MR),
        line(6.5, 12, 19, 6.5, 9, 26, 2.4, B), line(6.5, 9, 26, 6.5, 6, 32, 1.2, B), line(6.5, 14, 10, 6.5, 17, 7, 2.4, B),
        box(3, 15, 0, 10, 20, 8, B), box(3.5, 13, 1, 9.5, 14, 7, B), box(3, 14, 0, 10, 14, 6, DARK, null, PNT), box(4, 14, 0, 4, 14, 0, WHITE, null, MR), box(6, 14, 0, 6, 14, 0, WHITE, null, MR), box(3, 14, 2, 3, 14, 2, WHITE, null, PMR), box(3, 14, 4, 3, 14, 4, WHITE, null, PMR),
        box(3, 18, 3, 3, 19, 4, '#ffd23f', null, PMR), box(3, 18, 4, 3, 18, 4, DARK, null, PMR), box(5, 20, 1, 5, 20, 1, DARK, null, MR),
        line(4.5, 12, 9, 4, 10, 6.5, 0.6, B, null, MR), line(4, 10, 6.5, 4.5, 9.5, 5.5, 0.4, '#e8e0c0', null, MR), ball(6.5, 10, 11, 3.2, 3.2, 4.5, c.belly, null, PNT)];
    },
    note: () => 'Ein T-Rex mit großem Kopf, Zähnen und kleinen Armen.' });
  T('sauropod', { de: 'Langhals', g: 'm', words: ['langhals', 'langhalsdino', 'brachiosaurus', 'diplodocus', 'brontosaurus', 'sauropode', 'longneck', 'stegosaurus', 'triceratops'],
    slots: { body: ['#7a9a5a', 'haut|korper|body|dino|langhals'], plates: ['#c0603a', 'platten|stacheln|plates|horner|horns'] },
    feats: { stego: ['stegosaurus', 'platten', 'plates'], trike: ['triceratops', 'horner', 'horns'] },
    nameOf: (f) => (f.stego ? ['Stegosaurus', 'm'] : f.trike ? ['Triceratops', 'm'] : null),
    size: (f) => [12, f.stego || f.trike ? 16 : 27, 36],
    build(c, f) {
      const B = c.body, P = [ball(5.5, 9, 18, 5, 5, 8, B), cyl(2.5, 0, 13, 1.8, 7, 'y', B, null, MR), cyl(2.5, 0, 23, 1.8, 7, 'y', B, null, MR), line(5.5, 9, 25, 5.5, 6, 31, 2.2, B), line(5.5, 6, 31, 5.5, 3, 36, 1, B), ball(5.5, 6.5, 18, 3.5, 2.5, 6.5, shade(B, 1.2), null, PNT)];
      if (f.stego) { P.push(line(5.5, 9, 12, 5.5, 7, 6, 1.6, B), ball(5.5, 6.5, 4, 1.8, 1.8, 2.6, B), box(4.5, 7, 2, 4.5, 7, 2, DARK, null, MR)); for (let z = 11; z <= 28; z += 3) P.push(wedge(5, 12 + Math.max(0, 3 - Math.abs(z - 18) / 3), z, 6, 16 - Math.abs(z - 18) / 3, z + 2, '+z', c.plates)); P.push(line(5.5, 4, 35, 4, 6, 37, 0.4, '#e8e0c0', null, MR)); }
      else if (f.trike) P.push(line(5.5, 8, 12, 5.5, 7, 7, 2, B), box(2.5, 4, 1, 8.5, 9, 7, B), box(1.5, 7, 6, 9.5, 13, 7, c.plates), cone(3.5, 8.5, 1.5, 0.6, 5, '-z', '#efe6cf', null, MR), cone(5.5, 6, 1, 0.6, 3, '-z', '#efe6cf'), box(2.5, 7, 3, 2.5, 7, 3, DARK, null, MR));
      else P.push(line(5.5, 11, 12, 5.5, 22, 5, 1.8, B), ball(5.5, 23, 3.5, 1.9, 1.6, 3, B), box(4, 24, 2, 4, 24, 2, DARK, null, MR));
      return P;
    },
    note: (c, f) => f.stego ? 'Ein Stegosaurus mit Rückenplatten.' : f.trike ? 'Ein Triceratops mit drei Hörnern.' : 'Ein Langhals-Dinosaurier.' });
  T('dragon', { de: 'Drache', g: 'm', words: ['drache', 'drachen', 'drachenkind', 'feuerdrache', 'lindwurm', 'dragon', 'dragons', 'wyvern'],
    slots: { body: ['#2e8b3a', 'drache|haut|schuppen|korper|body|dragon'], wings: ['#c0392b', 'flugel|wings?'], belly: ['#e8d080', 'bauch|belly'] },
    feats: { fire: ['feuer', 'feuerdrache', 'fire', 'flammen', 'speit', 'spuckt', 'breathing'] },
    size: [27, 24, 36],
    build(c, f) {
      const B = c.body, P = [ball(13, 10, 18, 5.5, 5, 9, B), line(9.5, 9, 13, 9.5, 0, 12, 1.5, B, null, MR), line(9.5, 9, 23, 9.5, 0, 23, 1.8, B, null, MR), box(8, 0, 10, 11, 0, 12, '#e8e0c0', null, MR), box(8, 0, 21, 11, 0, 23, '#e8e0c0', null, MR),
        line(13, 12, 11, 13, 18, 6, 2, B), box(11, 17, 1, 15, 21, 7, B), box(11.5, 17, -1, 14.5, 19, 0, B), box(12, 19, -1, 12, 19, -1, DARK, null, MR), box(11, 20, 3, 11, 20, 3, '#ffd23f', 'light', PMR),
        line(12, 21, 6, 10.5, 24, 8.5, 0.5, '#e8e0c0', null, MR), line(13, 9, 26, 13, 6, 32, 2, B), line(13, 6, 32, 13, 3, 36, 1, B), wedge(12, 2, 35, 14, 5, 38, '+z', B),
        wedge(1, 14, 15, 10, 26, 16, '+x', c.wings, null, MR), line(11, 14, 15.5, 1, 26, 15.5, 0.65, B, null, MR), line(1, 26, 15.5, 3, 15, 16, 0.4, B, null, MR), ball(13, 7, 17, 4, 2.5, 7, c.belly, null, PNT)];
      for (let z = 9; z <= 30; z += 4) P.push(cone(13, z < 26 ? 15 - Math.abs(z - 17) / 4 : 9, z, 0.9, 2, 'y', '#e8e0c0'));
      if (f.fire) P.push(cone(13, 18, 0, 2.2, 9, '-z', '#ff7a00', 'light'), cone(13, 18, -1, 1.1, 6, '-z', '#ffd23f', 'light'));
      return P;
    },
    note: (c, f) => 'Ein Drache mit Flügeln, Hörnern und Stacheln' + (f.fire ? ', der Feuer speit.' : '.') });
  T('snake', { de: 'Schlange', g: 'f', words: ['schlange', 'schlangen', 'kobra', 'python', 'boa', 'snake', 'snakes', 'cobra', 'viper'],
    slots: { body: ['#5fa83a', 'haut|korper|body|schlange|snake'], pattern: ['#3a6a20', 'muster|flecken|streifen|pattern|spots'] },
    size: [20, 7, 19],
    build(c) {
      const P = [];
      for (let t = 0; t <= 1.001; t += 0.035) { const x = 10 + 7 * Math.sin(t * Math.PI * 2.4), z = 4 + t * 14; P.push(ball(x, 1.3, z, 1.4 - t * 0.5, 1.2 - t * 0.4, 1.4 - t * 0.5, Math.round(t * 28) % 4 === 0 ? c.pattern : c.body)); }
      P.push(line(10, 1.3, 4, 10, 4.5, 1.8, 1.2, c.body), ball(10, 5, 1, 1.9, 1.3, 2, c.body), box(8.5, 5.5, 0, 8.5, 5.5, 0, '#ffd23f', null, MR), line(10, 4.5, -0.8, 10, 4.3, -2.5, 0.25, '#d02020'));
      return P;
    },
    note: () => 'Eine Schlange, die sich schlängelt — mit gespaltener Zunge.' });
  T('turtle', { de: 'Schildkröte', g: 'f', words: ['schildkrote', 'schildkroten', 'wasserschildkrote', 'turtle', 'tortoise', 'turtles'],
    slots: { body: ['#5a7a3a', 'panzer|shell|schild'], skin: ['#8bb85a', 'haut|kopf|beine|skin|head|legs'] },
    size: [14, 8, 17],
    build: (c) => [ball(7, 2, 8, 6, 4.5, 7, c.body, null, { clip: [-99, 2, -99, 99, 99, 99] }), cyl(7, 1, 8, 6.3, 1, 'y', shade(c.body, 0.8)), ball(7, 3, 0.8, 1.8, 1.6, 2, c.skin), box(6, 3.5, -0.8, 6, 3.5, -0.8, DARK, null, MR), ball(2.4, 0.8, 4, 1.6, 1, 1.9, c.skin, null, MR), ball(2.4, 0.8, 12, 1.6, 1, 1.9, c.skin, null, MR), cone(7, 1.5, 15, 0.8, 2, '+z', c.skin),
      ...[[7, 6.3, 8], [4, 5, 6], [10, 5, 6], [4, 5, 10.5], [10, 5, 10.5], [7, 4.5, 3], [7, 4.5, 13]].map(([x, y, z]) => ball(x, y, z, 1.3, 0.8, 1.3, shade(c.body, 1.3), null, PNT))],
    note: () => 'Eine Schildkröte mit gemustertem Panzer.' });
  T('frog', { de: 'Frosch', g: 'm', words: ['frosch', 'frosche', 'froschkonig', 'krote', 'kroten', 'frog', 'frogs', 'toad'],
    slots: { body: ['#4caf50', 'haut|korper|body|frosch|frog'] },
    feats: { king: ['froschkonig', 'frog prince', 'krone'] },
    nameOf: (f) => (f.king ? ['Froschkönig', 'm'] : null),
    size: [13, 9, 12],
    build(c, f) {
      const P = [ball(6, 3, 6, 4.6, 3, 4.6, c.body), ball(3.8, 6, 3.2, 1.5, 1.5, 1.5, c.body, null, MR), ball(3.8, 6.4, 2, 1, 1, 0.6, WHITE, null, MR), box(3.5, 6.5, 1.3, 4, 6.5, 1.3, DARK, null, MR), box(3, 2.5, 1.4, 9, 2.5, 1.6, '#2a5a2a', null, PNT),
        line(3.5, 2, 3, 3, 0, 1.6, 0.6, c.body, null, MR), box(2, 0, 0.6, 4, 0, 1.6, c.body, null, MR), ball(1.8, 1.5, 8, 2, 1.5, 2.5, c.body, null, MR), box(0, 0, 6.5, 2, 0, 10, c.body, null, MR), ball(6, 1.5, 4.5, 3.2, 1.3, 2.6, '#c8e6a0', null, PNT)];
      if (f.king) P.push(cyl(6, 6, 6, 2, 2, 'y', GOLD, 'metal', { inner: 1.2 }), cone(4.5, 8, 6, 0.5, 1.5, 'y', GOLD, 'metal', MR), cone(6, 8, 4.5, 0.5, 1.5, 'y', GOLD, 'metal'));
      return P;
    },
    note: (c, f) => f.king ? 'Ein Froschkönig mit goldener Krone.' : 'Ein Frosch mit großen Augen.' });
  T('butterfly', { de: 'Schmetterling', g: 'm', words: ['schmetterling', 'schmetterlinge', 'falter', 'butterfly', 'butterflies', 'libelle', 'dragonfly'],
    slots: { wings: ['#ff8c1a', 'flugel|wings?|schmetterling'], wings2: ['#ffcd38', 'unterflugel|untere'], dots: ['#2a2a2a', 'punkte|muster|dots|spots|pattern'] },
    size: [21, 15, 4],
    build: (c) => [line(10, 2.5, 2, 10, 11, 2, 0.6, DARK), ball(10, 12, 2, 1.1, 1.1, 1.1, DARK), line(10, 12.5, 2, 8, 15, 2, 0.25, DARK, null, MR), box(8, 15, 2, 8, 15, 2, DARK, null, MR),
      ball(5.5, 9.5, 2, 4.6, 3.8, 0.6, c.wings, null, MR), ball(6.5, 4.5, 2, 3.4, 3, 0.6, c.wings2, null, MR), ball(4.5, 10.5, 2, 1.3, 1.3, 1, WHITE, null, PMR), ball(3, 8, 2, 0.9, 0.9, 1, c.dots, null, PMR), ball(6.5, 3.8, 2, 1, 1, 1, c.dots, null, PMR), ball(7.5, 8.5, 2, 0.8, 0.8, 1, c.dots, null, PMR)],
    note: () => 'Ein bunter Schmetterling.' });
  T('bee', { de: 'Biene', g: 'f', words: ['biene', 'bienen', 'bienchen', 'hummel', 'hummeln', 'wespe', 'bee', 'bees', 'bumblebee', 'wasp'],
    slots: { body: ['#f5c400', 'korper|body|biene|bee'], stripes: ['#1d1f22', 'streifen|stripes?'] },
    size: [12, 10, 14],
    build: (c) => [ball(6, 5, 8, 3.6, 3.6, 5, c.body), box(0, 0, 7, 12, 10, 7, c.stripes, null, PNT), box(0, 0, 10, 12, 10, 10, c.stripes, null, PNT), ball(6, 5.5, 2.6, 2.6, 2.6, 2.2, DARK), box(4.5, 6, 0.6, 5, 6.5, 0.6, WHITE, null, MR),
      line(5, 7.5, 2, 3.5, 10, 0.5, 0.25, DARK, null, MR), ball(3, 9.4, 7.5, 2.8, 0.6, 2.2, '#dff2ff', 'glass', MR), cone(6, 4.5, 12.6, 0.8, 2, '+z', DARK), line(4.5, 2, 6, 4, 0, 5, 0.25, DARK, null, MR), line(4.5, 2, 9, 4, 0, 10, 0.25, DARK, null, MR)],
    note: () => 'Eine Biene mit Streifen und Flügeln.' });
  T('ladybug', { de: 'Marienkäfer', g: 'm', words: ['marienkafer', 'gluckskafer', 'kafer', 'ladybug', 'ladybird', 'beetle', 'kaferchen'],
    slots: { body: ['#d0201e', 'panzer|flugel|korper|body|kafer'], dots: ['#1d1f22', 'punkte|dots|spots'] },
    size: [11, 6, 14],
    build: (c) => [ball(5, 0, 7.5, 5, 4.5, 6, c.body, null, UP), box(5, 0, 3, 5, 5, 14, c.dots, null, PNT), ball(5, 1.5, 1.4, 2.6, 1.8, 1.8, DARK), box(4, 2, 0, 4, 2, 0, WHITE, null, MR),
      ...[[2.4, 3, 5], [2, 2.6, 9], [3.2, 3.8, 11.5], [2.2, 1.6, 7]].map(([x, y, z]) => ball(x, y, z, 1, 1, 1, c.dots, null, PMR)), line(3, 0.5, 6, 0, 0, 5, 0.25, DARK, null, MR), line(3, 0.5, 9, 0, 0, 10, 0.25, DARK, null, MR)],
    note: () => 'Ein Marienkäfer mit schwarzen Punkten.' });
  T('spider', { de: 'Spinne', g: 'f', words: ['spinne', 'spinnen', 'tarantel', 'spider', 'spiders'],
    slots: { body: ['#2a2a2a', 'korper|body|spinne'] },
    size: [19, 7, 15],
    build(c) {
      const P = [ball(9, 3, 9, 3, 2.4, 3.6, c.body), ball(9, 3, 4.5, 2, 1.8, 2, c.body), box(8, 3.5, 2.6, 8, 3.5, 2.6, '#e02020', 'light', MR)];
      for (const [z, dz] of [[3.5, -3], [4.5, -1], [5.5, 1], [6.5, 3]]) P.push(line(8, 3, z, 4, 6, z + dz * 0.6, 0.35, c.body, null, MR), line(4, 6, z + dz * 0.6, 0.5, 0, z + dz * 1.3, 0.35, c.body, null, MR));
      return P;
    },
    note: () => 'Eine Spinne mit acht Beinen.' });
  T('snail', { de: 'Schnecke', g: 'f', words: ['schnecke', 'schnecken', 'weinbergschnecke', 'snail', 'snails'],
    slots: { body: ['#c8b08a', 'korper|body|schnecke'], shell: ['#b5652f', 'haus|schneckenhaus|shell'] },
    size: [9, 12, 16],
    build: (c) => [box(2, 0, 1, 6, 1, 15, c.body), line(4, 1, 2, 4, 4, 0.8, 1, c.body), line(3.4, 4.5, 1, 2.5, 7, 0.5, 0.3, c.body, null, MR), ball(2.5, 7.2, 0.5, 0.6, 0.6, 0.6, DARK, null, MR),
      ball(4, 6, 9, 3.4, 4.6, 4.6, c.shell), cyl(0, 6, 9, 3.4, 9, 'x', '#e8b070', null, { inner: 2.5, paint: true }), cyl(0, 6, 9, 1.4, 9, 'x', '#e8b070', null, PNT)],
    note: () => 'Eine Schnecke mit Schneckenhaus.' });
  T('octopus', { de: 'Krake', g: 'm', words: ['krake', 'kraken', 'oktopus', 'tintenfisch', 'octopus', 'squid', 'kalmar'],
    slots: { body: ['#d9534f', 'korper|body|krake|kopf|arme|tentakel'] },
    size: [21, 14, 21],
    build(c) {
      const P = [ball(10, 8, 10, 5, 5.5, 5, c.body), ball(7.6, 8, 5.4, 1.3, 1.5, 1, WHITE, null, MR), box(7.6, 7.6, 4.6, 8, 8, 4.6, DARK, null, MR)];
      for (let a = 0; a < 8; a++) { const t = a * Math.PI / 4 + Math.PI / 8, cs = Math.cos(t), sn = Math.sin(t); P.push(line(10 + 3 * cs, 4, 10 + 3 * sn, 10 + 7 * cs, 1, 10 + 7 * sn, 1.1, c.body), line(10 + 7 * cs, 1, 10 + 7 * sn, 10 + 9.5 * cs - sn * 1.5, 2, 10 + 9.5 * sn + cs * 1.5, 0.6, c.body)); }
      return P;
    },
    note: () => 'Ein Krake mit acht Armen.' });
  T('crab', { de: 'Krabbe', g: 'f', words: ['krabbe', 'krabben', '=krebs', 'krebse', 'hummer', 'crab', 'crabs', 'lobster'],
    slots: { body: ['#e04a2a', 'panzer|korper|body|krabbe|krebs'] },
    size: [19, 8, 13],
    build: (c) => [ball(9, 3, 7, 5, 2.4, 3.6, c.body), line(7.5, 4.5, 5, 7.5, 7, 4.5, 0.35, c.body, null, MR), ball(7.5, 7.2, 4.5, 0.7, 0.7, 0.7, DARK, null, MR),
      line(5, 3, 5, 2, 4, 2, 0.8, c.body, null, MR), ball(1.6, 4.5, 1.2, 1.6, 1.4, 1.4, c.body, null, MR), box(1, 4.5, -0.6, 2.4, 4.6, 0.2, AIR, null, MR),
      line(5, 2.5, 7, 0.5, 0, 6.5, 0.4, c.body, null, MR), line(5, 2.5, 8.5, 0.5, 0, 9.5, 0.4, c.body, null, MR), line(5.5, 2.5, 10, 1.5, 0, 12.5, 0.4, c.body, null, MR)],
    note: () => 'Eine Krabbe mit zwei Scheren.' });
  T('jellyfish', { de: 'Qualle', g: 'f', words: ['qualle', 'quallen', 'jellyfish', 'meduse'],
    slots: { body: ['#f4a6d0', 'schirm|korper|body|qualle'] },
    size: [13, 16, 13],
    build(c) {
      const P = [ball(6, 10, 6, 6, 5, 6, c.body, 'glass', { clip: [-99, 10, -99, 99, 99, 99] }), cyl(6, 10, 6, 6, 1, 'y', shade(c.body, 0.85), 'glass', { inner: 4.6 }), ball(6, 11.5, 6, 3, 2, 3, '#ffd6ef', 'light')];
      for (let a = 0; a < 7; a++) { const t = a * 2 * Math.PI / 7, x = 6 + 3.8 * Math.cos(t), z = 6 + 3.8 * Math.sin(t); P.push(line(x, 10, z, x + Math.cos(t + 1), 5, z + Math.sin(t + 1), 0.3, c.body, 'glass'), line(x + Math.cos(t + 1), 5, z + Math.sin(t + 1), x, 1 + (a % 3), z, 0.3, c.body, 'glass')); }
      return P;
    },
    note: () => 'Eine leuchtende Qualle.' });
  // fish and their kind: seen from the side, so the length runs left → right
  T('fish', { de: 'Fisch', g: 'm', words: ['fisch', 'fische', 'fischlein', 'goldfisch', 'clownfisch', 'kugelfisch', 'forelle', 'karpfen', 'fish', 'goldfish', 'clownfish', 'nemo'],
    slots: { body: ['#3fa7d6', 'korper|schuppen|body|fisch|fish'], fins: ['=body', 'flossen|flosse|fins?|schwanz|tail'] },
    feats: { gold: ['goldfisch', 'goldfish'], clown: ['clownfisch', 'clownfish', 'nemo'] },
    def: (f) => (f.gold ? { body: '#ff8c1a' } : f.clown ? { body: '#ff7a1a', fins: '#ff7a1a' } : {}),
    nameOf: (f) => (f.gold ? ['Goldfisch', 'm'] : f.clown ? ['Clownfisch', 'm'] : null),
    size: [18, 12, 6],
    build(c, f) {
      const P = [ball(7.5, 5.5, 2.5, 6.4, 4.4, 2.3, c.body), ball(14.5, 5.5, 2.5, 1.4, 2.5, 0.8, c.fins), line(13.5, 5.5, 2.5, 17, 9.5, 2.5, 0.9, c.fins), line(13.5, 5.5, 2.5, 17, 1.5, 2.5, 0.9, c.fins), line(17, 9.5, 2.5, 17, 1.5, 2.5, 0.6, c.fins),
        ball(7, 9.6, 2.5, 3, 1.4, 0.6, c.fins), ball(6, 1.6, 2.5, 1.6, 1, 0.5, c.fins), ball(3, 6.5, 0.6, 0.9, 0.9, 0.5, WHITE), box(3, 6.5, 0, 3, 6.5, 0, DARK), ball(3, 6.5, 4.4, 0.9, 0.9, 0.5, WHITE), box(3, 6.5, 5, 3, 6.5, 5, DARK), box(1, 4.5, 2, 1, 4.5, 3, DARK, null, PNT)];
      if (f.clown) for (const x of [4.5, 9]) P.push(box(x, 0, 0, x + 1, 12, 6, WHITE, null, PNT), box(x - 0.5, 0, 0, x - 0.5, 12, 6, DARK, null, PNT));
      return P;
    },
    note: (c, f) => f.clown ? 'Ein Clownfisch mit weißen Streifen.' : f.gold ? 'Ein Goldfisch.' : 'Ein Fisch mit Flossen.' });
  T('shark', { de: 'Hai', g: 'm', words: ['=hai', 'haie', 'haifisch', 'haifische', 'weisser hai', 'shark', 'sharks', 'hammerhai'],
    slots: { body: ['#7d8a96', 'haut|korper|body|hai|shark'], belly: [WHITE, 'bauch|belly'] },
    size: [31, 15, 9],
    build: (c) => [ball(14, 5.5, 4, 13, 4.5, 3.5, c.body), ball(13, 3, 4, 11, 2.6, 3.2, c.belly, null, PNT), wedge(12, 9, 3.5, 17, 15, 4.5, '+x', c.body), line(26, 6, 4, 30.5, 11.5, 4, 1.2, c.body), line(26, 5, 4, 29.5, 1.5, 4, 1, c.body),
      line(9, 3.5, 1.5, 12, 0.5, -1.5, 0.8, c.body), line(9, 3.5, 6.5, 12, 0.5, 9.5, 0.8, c.body), box(5, 6.5, 0.8, 5, 6.5, 0.8, DARK, null, PNT), box(5, 6.5, 7.2, 5, 6.5, 7.2, DARK, null, PNT),
      box(2, 3.5, 0, 6, 3.5, 8, '#3a2a2a', null, PNT), box(3, 3, 0, 3, 3, 8, WHITE, null, PNT), box(5, 3, 0, 5, 3, 8, WHITE, null, PNT), ...[8, 9, 10].map(x => box(x, 4.5, 0, x, 6, 8, shade(c.body, 0.7), null, PNT))],
    note: () => 'Ein Hai mit Rückenflosse und Zähnen.' });
  T('whale', { de: 'Wal', g: 'm', words: ['=wal', 'wale', 'walfisch', 'blauwal', 'pottwal', 'buckelwal', 'orca', 'killerwal', 'whale', 'whales'],
    slots: { body: ['#2e5f9a', 'haut|korper|body|wal|whale'], belly: ['#c8d8e8', 'bauch|belly'] },
    feats: { orca: ['orca', 'killerwal', 'schwertwal'] },
    def: (f) => (f.orca ? { body: '#1d1f22', belly: WHITE } : {}),
    nameOf: (f) => (f.orca ? ['Orca', 'm'] : null),
    size: [37, 19, 15],
    build(c, f) {
      const P = [ball(16, 6.5, 7, 15, 6.5, 6.5, c.body), ball(14, 2.5, 7, 13, 3, 5.6, c.belly, null, PNT), line(29, 7, 7, 35, 8.5, 7, 1.5, c.body), ball(35.5, 8.5, 7, 1.6, 0.8, 5.2, c.body), line(10, 3, 1.5, 14, 1, -1.5, 0.9, c.body), line(10, 3, 12.5, 14, 1, 15.5, 0.9, c.body),
        box(5, 7.5, 1, 5, 7.5, 1, DARK, null, PNT), box(5, 7.5, 13, 5, 7.5, 13, DARK, null, PNT), box(1, 4, 2, 9, 4, 12, '#1a3050', null, PNT)];
      if (f.orca) P.push(ball(6, 8.5, 2, 1.6, 0.9, 1, WHITE, null, PNT), ball(6, 8.5, 12, 1.6, 0.9, 1, WHITE, null, PNT), wedge(14, 12, 6.5, 17, 18, 7.5, '+x', c.body));
      else P.push(line(8, 13, 7, 8, 18, 7, 0.6, '#9fd6f5', 'water'), ball(8, 18.5, 7, 1.6, 0.8, 1.6, '#9fd6f5', 'water'), line(8, 17, 7, 6, 18.5, 7, 0.4, '#9fd6f5', 'water'), line(8, 17, 7, 10, 18.5, 7, 0.4, '#9fd6f5', 'water'));
      return P;
    },
    note: (c, f) => f.orca ? 'Ein Orca, schwarz-weiß.' : 'Ein Wal, der Wasser spritzt.' });
  T('dolphin', { de: 'Delfin', g: 'm', words: ['delfin', 'delfine', 'delphin', 'delphine', 'dolphin', 'dolphins', 'flipper'],
    slots: { body: ['#6f8fa8', 'haut|korper|body|delfin|dolphin'], belly: ['#dce6ee', 'bauch|belly'] },
    size: [27, 14, 9],
    build: (c) => [ball(12, 6, 4, 10.5, 4, 3.2, c.body), cone(2.2, 5.2, 4, 1.4, 3, '-x', c.body), ball(11, 3.6, 4, 9, 2.4, 2.8, c.belly, null, PNT), wedge(11, 9, 3.5, 15, 13.5, 4.5, '+x', c.body), line(21, 6.5, 4, 25, 8, 4, 1, c.body), ball(25.5, 8, 4, 1, 0.6, 3.5, c.body),
      line(9, 3.5, 1.5, 11, 1.5, 0, 0.7, c.body), line(9, 3.5, 6.5, 11, 1.5, 8, 0.7, c.body), box(4.5, 6.5, 1.2, 4.5, 6.5, 1.2, DARK, null, PNT), box(4.5, 6.5, 6.8, 4.5, 6.5, 6.8, DARK, null, PNT), box(1, 4.8, 3, 4, 4.8, 5, '#4a6278', null, PNT)],
    note: () => 'Ein Delfin.' });
  // birds
  T('chicken', { de: 'Huhn', g: 'n', words: ['=huhn', 'huhner', 'henne', 'hahn', 'hahne', 'kuken', 'chicken', 'hen', 'rooster', 'chick', 'gockel'],
    slots: { body: [WHITE, 'gefieder|federn|korper|body|huhn|henne|hahn'], comb: ['#d0201e', 'kamm|comb'] },
    feats: { rooster: ['hahn', 'rooster', 'gockel'], chick: ['kuken', 'chick', 'kuken'] },
    def: (f) => (f.rooster ? { body: '#a0522d' } : f.chick ? { body: '#ffe14d' } : {}),
    nameOf: (f) => (f.rooster ? ['Hahn', 'm'] : f.chick ? ['Küken', 'n'] : null),
    size: [10, 14, 12],
    build(c, f) {
      if (f.chick) return [ball(4.5, 3.5, 5, 3, 3, 3.2, c.body), ball(4.5, 7, 3.5, 2.2, 2.2, 2.2, c.body), cone(4.5, 7, 1.2, 0.6, 1.4, '-z', '#f39c12'), box(3.5, 7.8, 1.6, 3.5, 7.8, 1.6, DARK, null, MR), line(3.5, 0, 5, 3.5, 1, 5, 0.3, '#f39c12', null, MR), ball(1.6, 4, 5.5, 0.6, 1.6, 2, c.body, null, MR)];
      const P = [ball(4.5, 5, 6, 3.6, 3.4, 4.4, c.body), ball(4.5, 9, 3, 2.1, 2.3, 2.1, c.body), box(4, 11, 2, 5, 12, 4, c.comb), box(4, 12.5, 3, 5, 12.5, 3, c.comb), box(4, 7, 1, 5, 7.5, 1, c.comb), cone(4.5, 8.8, 1, 0.7, 1.6, '-z', '#f5b400'), box(2.5, 9.5, 2, 2.5, 9.5, 2, DARK, null, MR),
        ball(1.2, 5.5, 6.5, 0.8, 2.2, 3, shade(c.body, 0.92), null, MR), ball(4.5, 7.5, 10, 2, 2.5, 1.2, f.rooster ? '#1f5f3a' : c.body), line(3.5, 0, 6, 3.5, 2, 6, 0.35, '#f5b400', null, MR), box(3, 0, 4, 4, 0, 6, '#f5b400', null, MR)];
      if (f.rooster) P.push(line(4.5, 8, 10.5, 4.5, 11, 12, 0.7, '#1f5f3a'), line(4.5, 7, 10.5, 4.5, 9, 12.5, 0.6, '#c0392b'));
      return P;
    },
    note: (c, f) => f.rooster ? 'Ein stolzer Hahn.' : f.chick ? 'Ein flauschiges Küken.' : 'Ein Huhn mit rotem Kamm.' });
  T('duck', { de: 'Ente', g: 'f', words: ['=ente', 'enten', 'entchen', 'stockente', 'quietscheente', 'badeente', 'gummiente', 'gans', 'ganse', '=duck', 'ducks', 'duckling', 'rubber duck', 'goose'],
    slots: { body: [WHITE, 'gefieder|korper|body|ente|duck|gans'], head: ['=body', 'kopf|head'], beak: ['#f39c12', 'schnabel|beak|bill'] },
    feats: { rubber: ['quietscheente', 'badeente', 'gummiente', 'rubber'], mallard: ['stockente', 'mallard'], goose: ['gans', 'ganse', 'goose'] },
    def: (f) => (f.rubber ? { body: '#ffd400', head: '#ffd400', beak: '#ff7a00' } : f.mallard ? { body: '#9a8a70', head: '#2e7d32' } : {}),
    nameOf: (f) => (f.rubber ? ['Quietscheente', 'f'] : f.goose ? ['Gans', 'f'] : null),
    size: (f) => [10, f.goose ? 13 : 10, 14],
    build(c, f) {
      const g = f.goose ? 2.5 : 0, P = [ball(4.5, 4, 7, 3.6, 2.8, 5, c.body, null, f.rubber ? UP : null), ball(4.5, 8 + g, 3.2, 2.2, 2.2, 2.2, c.head), box(3.5, 7.2 + g, 0, 5.5, 7.8 + g, 1.4, c.beak), box(3, 8.6 + g, 2, 3, 8.6 + g, 2, DARK, null, MR), cone(4.5, 5.5, 11.5, 1.4, 2.5, '+z', c.body), ball(1.2, 4.6, 7.5, 0.8, 1.8, 3.4, shade(c.body, 0.9), null, MR)];
      if (g) P.push(line(4.5, 5.5, 4.5, 4.5, 9, 3.2, 1, c.body));
      if (!f.rubber) P.push(line(3.5, 0, 7, 3.5, 1.5, 7, 0.3, c.beak, null, MR), box(2.5, 0, 5, 4, 0, 7, c.beak, null, MR));
      if (f.mallard) P.push(cyl(4.5, 6.2, 3.6, 2.1, 1, 'y', WHITE, null, PNT));
      return P;
    },
    note: (c, f) => f.rubber ? 'Eine gelbe Quietscheente.' : f.goose ? 'Eine Gans.' : f.mallard ? 'Eine Stockente mit grünem Kopf.' : 'Eine Ente.' });
  T('owl', { de: 'Eule', g: 'f', words: ['eule', 'eulen', 'uhu', 'kauz', 'schneeeule', 'owl', 'owls'],
    slots: { body: ['#8b5a2b', 'gefieder|korper|body|eule|owl|federn'], eyes: ['#ffd23f', 'augen|eyes?'] },
    feats: { snow: ['schneeeule', 'snowy', 'weiss'] },
    def: (f) => (f.snow ? { body: '#f2f0ea' } : {}),
    size: [13, 14, 10],
    build: (c) => [ball(6, 5.5, 5, 4.2, 5.2, 4, c.body), ball(6, 4.5, 2.2, 3, 3.5, 2, shade(c.body, 1.5), null, PNT), ball(6, 10, 5, 3.6, 2.8, 3.4, c.body), cyl(4.4, 10, 1.4, 1.5, 1, 'z', c.eyes, null, MR), box(4.4, 10, 1.2, 4.4, 10, 1.2, DARK, null, MR), cone(6, 9, 1.6, 0.6, 1.5, '-z', '#e8a020'),
      cone(3.5, 12, 5, 0.9, 2, 'y', c.body, null, MR), ball(2, 6, 5.5, 1, 3.5, 2.6, shade(c.body, 0.8), null, MR), box(4.5, 0, 3, 5, 0, 4, '#e8a020', null, MR), line(-1, -0.5, 4.5, 13, -0.5, 4.5, 0.7, '#6b4a2b', 'wood')],
    note: () => 'Eine Eule mit großen Augen auf einem Ast.' });
  T('penguin', { de: 'Pinguin', g: 'm', words: ['pinguin', 'pinguine', 'penguin', 'penguins', 'kaiserpinguin'],
    slots: { body: ['#1d1f22', 'korper|rucken|body|pinguin|penguin'], belly: [WHITE, 'bauch|belly'] },
    size: [10, 15, 9],
    build: (c) => [ball(4.5, 6, 4.5, 4, 6, 3.8, c.body), ball(4.5, 5.5, 2.5, 3, 4.8, 2.4, c.belly, null, PNT), ball(4.5, 12, 4.5, 2.8, 2.4, 2.8, c.body), ball(4.5, 11.6, 2.4, 1.8, 1.4, 1, c.belly, null, PNT), cone(4.5, 11.4, 1.6, 0.7, 2, '-z', '#f39c12'), box(3.5, 12.4, 1.9, 3.5, 12.4, 1.9, DARK, null, MR),
      ball(0.7, 7, 4.5, 0.7, 3.5, 1.5, c.body, null, MR), box(2.5, 0, 1.5, 3.5, 0, 3.5, '#f39c12', null, MR), ball(4.5, 10.2, 3.2, 2.6, 0.5, 2.4, '#ffcc33', null, PNT)],
    note: () => 'Ein Pinguin.' });
  T('parrot', { de: 'Papagei', g: 'm', words: ['papagei', 'papageien', 'ara', 'wellensittich', 'kakadu', 'tukan', 'parrot', 'parrots', 'macaw', 'toucan', 'budgie'],
    slots: { body: ['#d0201e', 'gefieder|korper|body|papagei|parrot'], wings: ['#2e6fd8', 'flugel|wings?|schwanz|tail'] },
    feats: { toucan: ['tukan', 'toucan'] },
    def: (f) => (f.toucan ? { body: '#1d1f22', wings: '#1d1f22' } : {}),
    nameOf: (f) => (f.toucan ? ['Tukan', 'm'] : null),
    size: [10, 14, 11],
    build(c, f) {
      const P = [ball(4.5, 6, 4.5, 3, 4.5, 3, c.body), ball(4.5, 10.5, 3.8, 2.3, 2.3, 2.3, c.body), ball(3, 10.8, 2.8, 0.9, 0.9, 0.5, WHITE, null, MR), box(3, 10.8, 2.2, 3, 10.8, 2.2, DARK, null, MR),
        ball(1.6, 6, 5, 1, 3.6, 2.4, c.wings, null, MR), box(0, 6, 3, 9, 6.5, 7, '#ffcd38', null, PNT), line(4.5, 3, 7, 4.5, -3, 9, 1, c.wings), line(-1, 1.5, 4.5, 11, 1.5, 4.5, 0.6, '#6b4a2b', 'wood'), box(3.5, 2, 3.5, 3.5, 2.5, 4.5, '#8a8f96', null, MR)];
      if (f.toucan) P.push(ball(4.5, 10, 0.5, 1.3, 1.4, 2.6, '#ff8c1a'), ball(4.5, 9.8, -1.6, 0.8, 0.9, 0.9, '#1d1f22'), ball(4.5, 7.5, 2, 2, 1.8, 1.2, '#ffe14d', null, PNT));
      else P.push(ball(4.5, 9.8, 1.6, 1, 1.4, 1, '#f3ead2'), cone(4.5, 9.2, 1.2, 0.6, 1.4, '-y', '#2a2a2a'));
      return P;
    },
    note: (c, f) => f.toucan ? 'Ein Tukan mit großem Schnabel.' : 'Ein bunter Papagei auf einer Stange.' });
  T('eagle', { de: 'Adler', g: 'm', words: ['adler', 'seeadler', 'weisskopfseeadler', 'falke', 'habicht', 'bussard', 'eagle', 'falcon', 'hawk', 'greifvogel'],
    slots: { body: ['#5a3a20', 'gefieder|korper|body|adler|eagle'], head: [WHITE, 'kopf|head'] },
    feats: { flying: ['fliegend', 'fliegt', 'flying', 'ausgebreitet', 'spread'] },
    size: (f) => (f.flying ? [33, 9, 13] : [11, 15, 11]),
    build(c, f) {
      if (f.flying) return [ball(16, 4, 6, 2.6, 2.2, 5, c.body), ball(16, 4.5, 1, 2, 1.8, 2, c.head), cone(16, 4, -1, 0.8, 1.6, '-z', '#f5b400'), wedge(2, 4, 3, 14, 7, 9, '-x', c.body, null, MR), box(1, 5, 3, 3, 5, 9, shade(c.body, 0.7), null, MR), wedge(14, 3, 10, 18, 4, 14, '+z', c.head), box(14.5, 5, 0, 14.5, 5, 0, DARK, null, MR)];
      return [ball(5, 6, 5, 3.8, 5, 3.6, c.body), ball(5, 11, 3.6, 2.5, 2.3, 2.5, c.head), cone(5, 10.4, 1, 0.9, 2, '-z', '#f5b400'), cone(5, 10, 0, 0.5, 1, '-y', '#f5b400'), box(3.5, 11.5, 1.6, 3.5, 11.5, 1.6, DARK, null, MR),
        ball(1.4, 6.5, 5.5, 1.3, 4.5, 3, shade(c.body, 0.8), null, MR), ball(5, 1.8, 8, 2, 1, 2, WHITE), box(3.5, 0, 3, 4.5, 0.5, 4.5, '#f5b400', null, MR), line(-1, -0.4, 4, 12, -0.4, 4, 0.7, '#6b4a2b', 'wood')];
    },
    note: (c, f) => f.flying ? 'Ein Adler mit ausgebreiteten Flügeln.' : 'Ein Adler mit weißem Kopf auf einem Ast.' });
  T('flamingo', { de: 'Flamingo', g: 'm', words: ['flamingo', 'flamingos'],
    slots: { body: ['#f48fb1', 'gefieder|korper|body|flamingo'] },
    size: [9, 20, 11],
    build: (c) => [line(4, 0, 6, 4, 10, 6, 0.35, '#ec6f9a'), line(5, 10, 6, 6, 7, 8.5, 0.35, '#ec6f9a'), line(6, 7, 8.5, 5, 6, 6, 0.3, '#ec6f9a'), box(3, 0, 5, 5, 0, 6, '#ec6f9a'), ball(4.5, 12, 6, 3, 2.6, 4.2, c.body), ball(4.5, 12.5, 9.5, 2, 1.8, 1.6, c.body),
      line(4.5, 13, 3, 4.5, 16, 1.5, 0.7, c.body), line(4.5, 16, 1.5, 4.5, 18.5, 3, 0.7, c.body), ball(4.5, 19, 3, 1.4, 1.2, 1.6, c.body), cone(4.5, 18.4, 1.6, 0.7, 2, '-z', '#f3ead2'), box(4.5, 18, 0, 4.5, 18, 0, DARK), box(3.5, 19.3, 2.4, 3.5, 19.3, 2.4, DARK, null, MR)],
    note: () => 'Ein Flamingo auf einem Bein.' });
  T('swan', { de: 'Schwan', g: 'm', words: ['schwan', 'schwane', 'schwanchen', 'swan', 'swans'],
    slots: { body: [WHITE, 'gefieder|korper|body|schwan|swan'] },
    feats: { black: ['schwarz', 'black', 'schwarzer', 'schwarze'] },
    size: [11, 14, 14],
    build: (c) => [ball(5, 3, 8, 4, 3, 6, c.body, null, UP), ball(2, 5, 9, 1.2, 2.2, 4.5, shade(c.body, 0.95), null, MR), cone(5, 4, 13, 1.6, 2.5, '+z', c.body), line(5, 5, 4, 5, 10, 3.5, 1, c.body), line(5, 10, 3.5, 5, 12, 1.5, 0.9, c.body),
      ball(5, 12.3, 1.5, 1.2, 1, 1.8, c.body), cone(5, 12, -0.2, 0.7, 1.6, '-z', '#f39c12'), box(5, 12.3, 0.2, 5, 12.3, 0.2, DARK), box(4, 12.6, 1, 4, 12.6, 1, DARK, null, MR)],
    note: () => 'Ein Schwan mit gebogenem Hals.' });
  T('bird', { de: 'Vogel', g: 'm', words: ['vogel', 'vogelchen', 'spatz', 'spatzen', 'meise', 'amsel', 'rotkehlchen', 'blaumeise', 'kolibri', 'taube', 'tauben', 'krahe', 'rabe', 'bird', 'birds', 'sparrow', 'robin', 'pigeon', 'crow', 'raven', 'hummingbird'],
    slots: { body: ['#4a90d9', 'gefieder|federn|korper|body|vogel|bird'], belly: ['=body', 'bauch|brust|belly|chest'] },
    feats: { robin: ['rotkehlchen', 'robin'], sparrow: ['spatz', 'spatzen', 'sparrow'], crow: ['krahe', 'rabe', 'crow', 'raven', 'amsel'], dove: ['taube', 'tauben', 'pigeon', 'dove'] },
    def: (f) => (f.robin ? { body: '#7a5a3a', belly: '#ff7a3a' } : f.sparrow ? { body: '#8a6a4a', belly: '#d8c8b0' } : f.crow ? { body: '#1d1f22', belly: '#2a2a2e' } : f.dove ? { body: '#a8acb4', belly: '#c8ccd4' } : {}),
    nameOf: (f) => (f.robin ? ['Rotkehlchen', 'n'] : f.sparrow ? ['Spatz', 'm'] : f.crow ? ['Rabe', 'm'] : f.dove ? ['Taube', 'f'] : null),
    size: [10, 10, 12],
    build: (c) => [ball(4.5, 4.5, 5, 3, 3, 3.6, c.body), ball(4.5, 4, 2.6, 2.4, 2.4, 1.6, c.belly === c.body ? shade(c.body, 1.25) : c.belly, null, PNT), ball(4.5, 7.5, 2.8, 2.3, 2.2, 2.2, c.body), cone(4.5, 7.4, 0.8, 0.6, 1.5, '-z', '#f5b400'), box(3, 8, 1.4, 3, 8, 1.4, DARK, null, MR),
      ball(1.6, 4.8, 5.5, 0.8, 2, 2.8, shade(c.body, 0.8), null, MR), line(4.5, 5, 8, 4.5, 7, 11, 0.7, shade(c.body, 0.8)), line(3.5, 0, 5, 3.5, 2, 5, 0.25, '#f5b400', null, MR)],
    note: () => 'Ein kleiner Vogel.' });
  T('teddy', { de: 'Teddybär', g: 'm', words: ['teddy', 'teddys', 'teddybar', 'teddybaren', 'kuscheltier', 'stofftier', 'teddy bear', 'plush'],
    slots: { body: ['#b07a4a', 'fell|korper|body|teddy|bar'], bow: ['#d02040', 'schleife|halsband|bow|ribbon'] },
    size: [15, 17, 12],
    build: (c) => [ball(7, 5, 6, 4.5, 4.8, 4), ball(7, 5, 3, 3, 3.4, 1.4, shade(c.body, 1.3), null, PNT), ball(7, 11.5, 5.5, 3.6, 3.4, 3.4), ball(4, 14.5, 5.5, 1.3, 1.3, 0.9, null, null, MR), ball(4, 14.5, 4.8, 0.7, 0.7, 0.4, shade(c.body, 1.3), null, PMR), ball(7, 10.5, 2.2, 1.6, 1.2, 1),
      box(6.5, 11, 0.9, 7.5, 11, 0.9, DARK), box(5.5, 12.5, 2.3, 5.5, 12.5, 2.3, DARK, null, MR), ball(2.5, 6, 4.5, 1.6, 3, 1.6, null, null, MR), ball(4.5, 1.5, 2.5, 1.8, 1.6, 3, null, null, MR), ball(4.5, 1.5, 0, 1.2, 1.2, 0.5, shade(c.body, 1.3), null, PMR),
      box(5.5, 8.5, 2.6, 8.5, 9, 3, c.bow), ball(5.2, 8.7, 2.6, 1, 0.8, 0.5, c.bow, null, MR)].map(p => (p.color == null ? Object.assign(p, { color: c.body }) : p)),
    note: () => 'Ein Teddybär mit Schleife.' });
  T('monkey', { de: 'Affe', g: 'm', words: ['=affe', 'affen', 'affchen', 'schimpanse', 'gorilla', 'orang utan', 'monkey', 'monkeys', 'ape', 'chimp'],
    slots: { body: ['#7a4a2a', 'fell|korper|body|affe|monkey'], face: ['#e8c8a0', 'gesicht|face|bauch'] },
    feats: { gorilla: ['gorilla'] },
    def: (f) => (f.gorilla ? { body: '#2a2a2e', face: '#5a5a60' } : {}),
    nameOf: (f) => (f.gorilla ? ['Gorilla', 'm'] : null),
    size: [15, 16, 13],
    build: (c) => [ball(7, 5, 6, 3.8, 4.4, 3.4, c.body), ball(7, 4.8, 3.4, 2.4, 3, 1, c.face, null, PNT), ball(7, 10.8, 5.5, 3.2, 3, 3), ball(7, 10.2, 2.8, 2.4, 2, 1.2, c.face), ball(3.6, 11, 5.5, 1.2, 1.2, 0.8, c.face, null, MR), box(6, 11, 1.6, 6, 11, 1.6, DARK, null, MR), box(6.5, 9.4, 1.6, 7.5, 9.4, 1.6, '#5a3a2a'),
      line(4, 7.5, 5.5, 1.2, 3, 4, 0.9, c.body, null, MR), line(5, 1.5, 5, 4.5, 0, 2, 1, c.body, null, MR), line(7, 3, 9, 9.5, 2, 12, 0.5, c.body), line(9.5, 2, 12, 11.5, 6, 12.5, 0.5, c.body), line(11.5, 6, 12.5, 10.5, 8, 11.5, 0.5, c.body)].map(p => (p.color == null ? Object.assign(p, { color: c.body }) : p)),
    note: (c, f) => f.gorilla ? 'Ein Gorilla.' : 'Ein Affe mit langem Schwanz.' });

  // ---------------------------------------------------------------- people and figures (12 wide, the face toward z = 0)
  CAT = 'figure';
  const SKIN = '#f1c27d';
  function fig(c, o) {
    o = o || {};
    const P = [], S = c.skin || SKIN, sh = c.shirt || '#2e6fd8', pa = c.pants || '#2c3e66', so = c.shoes || '#3a2a20', hr = c.hair || '#5a3a20';
    const ly = o.short ? 4 : 8, ty = ly, hy = ty + 7;
    if (o.tail) P.push(line(5.5, ty + 1, 3.5, 5.5, 3, 5, 2.9, o.tail), line(5.5, 3, 5, 5.5, 1.2, 9, 2.1, o.tail), wedge(2, 0, 9, 9, 4, 12, '+z', o.fin || o.tail), box(3, 0, 10, 8, 0, 13, o.fin || o.tail));
    else if (o.dress) P.push(cone(5.5, 0, 3.5, 6.2, 22, 'y', o.dress, null, { clip: [-99, 1, -99, 99, ty + 1, 99] }), box(3, 0, 1, 4, 0, 4, so, null, MR));
    else P.push(box(2, 1, 2, 4, ly - 1, 5, pa, null, MR), box(2, 0, 1, 4, 0, 5, so, null, MR));
    P.push(box(2, ty, 2, 9, ty + 6, 5, sh));
    if (o.belt) P.push(box(2, ty, 2, 9, ty, 5, o.belt), box(5, ty, 1.6, 6, ty, 1.6, GOLD, 'metal'));
    const arm = c.sleeves || sh;
    P.push(box(0, ty + 1, 2, 1, ty + 6, 5, arm, null, MR), box(0, ty - 1, 2, 1, ty, 5, o.gloves || S, null, MR));
    P.push(box(2, hy, 0, 9, hy + 7, 7, S));
    const ey = hy + 3;
    if (o.eyes !== false) P.push(box(3, ey, 0, 4, ey + 1, 0, WHITE, null, MR), box(4, ey, 0, 4, ey + 1, 0, c.eyes || '#2a3a6a', null, MR));
    if (o.mouth !== false) P.push(box(4, hy + 1, 0, 7, hy + 1, 0, o.mouth || '#b5524a'));
    if (o.hair !== 'none') {
      P.push(box(2, hy + 7, 0, 9, hy + 8, 7, hr), box(2, hy + 2, 6, 9, hy + 7, 7, hr), box(2, hy + 5, 1, 2, hy + 7, 6, hr, null, MR), box(2, hy + 6, 0, 9, hy + 7, 0, hr));
      if (o.hair === 'long') P.push(box(1, ty + 2, 6, 10, hy + 8, 8, hr), box(1, hy + 1, 1, 1, hy + 8, 6, hr, null, MR));
      if (o.hair === 'bun') P.push(ball(5.5, hy + 9, 5, 1.8, 1.6, 1.8, hr));
      if (o.hair === 'wild') P.push(ball(5.5, hy + 8, 3.5, 5.6, 2.6, 5.4, hr), ball(1.8, hy + 6, 3.5, 1.8, 2.4, 3.4, hr, null, MR));
    }
    if (o.beard) P.push(box(3, o.longBeard ? ty + 1 : hy - 1, -1, 8, hy + 2, 0, o.beard), box(4, hy + 1, -1, 7, hy + 1, -1, o.mouth || '#b5524a'), box(2, hy + 1, 0, 2, hy + 3, 1, o.beard, null, MR));
    if (o.glasses) P.push(box(3, ey, -1, 4, ey + 1, -1, '#cfe8f6', 'glass', MR), box(5, ey + 1, -1, 6, ey + 1, -1, o.glasses), box(2, ey + 1, -1, 2, ey + 1, 3, o.glasses, null, MR));
    if (o.cape) P.push(box(1, Math.max(1, ty - 4), 6, 10, hy, 6, o.cape), box(1, hy, 5, 10, hy, 6, o.cape));
    return { P, g: { ty, hy, ly } };
  }
  // hats and things held, by name
  function hat(kind, hy, col, P) {
    const t = hy + 8;
    if (kind === 'crown') P.push(box(2, t, 0, 9, t + 1, 7, col, 'metal'), box(3, t, 1, 8, t + 1, 6, AIR), box(2, t + 2, 0, 2, t + 2, 0, col, 'metal', MR), box(5, t + 2, 0, 6, t + 3, 0, col, 'metal'), box(2, t + 2, 7, 2, t + 2, 7, col, 'metal', MR), box(5, t + 2, 7, 6, t + 2, 7, col, 'metal'), box(5, t, -0.4, 6, t, -0.4, '#d0201e', 'light'));
    if (kind === 'tiara') P.push(box(3, t, 0, 8, t, 0, col, 'metal'), box(5, t + 1, 0, 6, t + 2, 0, col, 'metal'), box(4, t + 1, 0, 4, t + 1, 0, col, 'metal', MR), box(5, t + 1, -0.3, 6, t + 1, -0.3, '#4ab0ff', 'light'));
    if (kind === 'point') P.push(cyl(5.5, t, 3.5, 6.6, 1, 'y', col), cone(5.5, t + 1, 3.5, 4.4, 9, 'y', col), cyl(5.5, t + 1, 3.5, 4.5, 1, 'y', '#c9a227'));
    if (kind === 'gnome') P.push(cone(5.5, t - 1, 3.5, 5, 11, 'y', col), line(5.5, t + 8, 3.5, 5.5, t + 10, 6, 0.6, col));
    if (kind === 'cap') P.push(box(2, t, 0, 9, t + 1, 7, col), box(2, t, -2, 9, t, -1, col));
    if (kind === 'police') P.push(box(1, t, -1, 10, t + 2, 8, col), box(2, t, -3, 9, t, -2, DARK), box(5, t + 1, -1.4, 6, t + 1, -1.4, GOLD, 'metal'));
    if (kind === 'helmet') P.push(box(1, hy - 1, -1, 10, t + 1, 8, col, 'metal'), box(3, hy + 3, -1, 8, hy + 3, -1, DARK), box(3, hy + 1, -1, 8, hy + 1, -1, '#3a3d42'), line(5.5, t + 2, 4, 5.5, t + 5, 7, 0.8, '#c0392b'));
    if (kind === 'fire') P.push(ball(5.5, t - 1, 3.5, 5, 3.6, 5, col, null, { clip: [-99, t - 1, -99, 99, 99, 99] }), box(1, t - 1, -1, 10, t - 1, 8, col), box(5, t, -1.6, 6, t + 1, -1.6, GOLD, 'metal'));
    if (kind === 'chef') P.push(cyl(5.5, t, 3.5, 3.6, 3, 'y', WHITE), ball(5.5, t + 4, 3.5, 4.4, 2.4, 4.4, WHITE));
    if (kind === 'santa') P.push(cyl(5.5, t, 3.5, 5.2, 1, 'y', WHITE), cone(5.5, t + 1, 3.5, 4.6, 6, 'y', col), line(5.5, t + 6, 3.5, 9, t + 4, 3.5, 0.9, col), ball(9.5, t + 3.2, 3.5, 1.3, 1.3, 1.3, WHITE));
    if (kind === 'cowboy') P.push(cyl(5.5, t, 3.5, 7, 1, 'y', col), box(3, t + 1, 1, 8, t + 3, 6, col), box(3, t + 1, 1, 8, t + 1, 6, DARK));
    if (kind === 'pirate') P.push(cyl(5.5, t, 3.5, 6.4, 1, 'y', col), box(2, t + 1, 1, 9, t + 3, 6, col), wedge(0, t + 1, 0, 3, t + 3, 7, '-x', col, null, MR), box(5, t + 2, 0.6, 6, t + 2, 0.6, WHITE));
    if (kind === 'astro') P.unshift(ball(5.5, hy + 4, 3.5, 5.6, 5.4, 5.6, '#bfe3ff', 'glass'));
    if (kind === 'witch') P.push(cyl(5.5, t, 3.5, 7, 1, 'y', col), cone(5.5, t + 1, 3.5, 4.2, 10, 'y', col), cyl(5.5, t + 1, 3.5, 4.3, 1, 'y', '#8e44ad'));
  }
  const sword = (ty) => [line(10.5, ty + 1, 0.5, 10.5, ty + 12, 0.5, 0.45, '#d8dde3', 'metal'), box(9, ty, 0, 12, ty, 1, GOLD, 'metal'), box(10, ty - 2, 0, 11, ty - 1, 1, '#5a3a20')];
  const FIGW = ['figur', 'figuren', 'person', 'personen', 'mensch', 'menschen', 'mann', 'manner', 'frau', 'frauen', 'junge', 'jungen', '=kind', 'kinder', 'madchen', 'oma', 'opa', 'mama', 'papa', 'mutter', 'vater', 'baby', 'spieler', 'spielerin', 'avatar', 'held', 'character', '=man', '=men', 'woman', 'women', 'boy', 'girl', 'kid', 'player', 'people', 'mich selbst', 'grossmutter', 'grossvater', 'lehrer', 'lehrerin', 'freund', 'freundin', 'schuler', 'schulerin'];
  T('person', { de: 'Figur', g: 'f', words: FIGW,
    slots: { shirt: ['#2e6fd8', 'shirt|tshirt|pulli|pullover|hemd|oberteil|jacke|top|kleid'], pants: ['#2c3e66', 'hose|hosen|jeans|pants|trousers|rock'], hair: ['#5a3a20', 'haare|haar|frisur|hair'], skin: [SKIN, 'haut|skin'], shoes: ['#3a2a20', 'schuhe|stiefel|shoes|boots'] },
    feats: { female: ['frau', 'frauen', 'madchen', 'oma', 'mama', 'mutter', 'woman', 'women', 'girl', 'grossmutter', 'lehrerin', 'freundin', 'spielerin', 'schulerin', 'lange haare', 'long hair'], old: ['oma', 'opa', 'grossmutter', 'grossvater', 'alt', 'alte', 'alter', 'old'], beard: ['bart', 'beard', 'opa', 'vollbart'], glasses: ['brille', 'glasses', 'oma', 'opa', 'lehrer', 'lehrerin'], cap: ['kappe', 'mutze', 'basecap', 'cap', 'baseballkappe'], dress: ['kleid', 'rock', 'dress', 'skirt'] },
    def: (f) => Object.assign({}, f.old ? { hair: '#c8c8c8' } : null, f.female ? { shirt: '#e8478f' } : null),
    nameOf: (f) => (f.old && f.female ? ['Oma', 'f'] : f.old ? ['Opa', 'm'] : f.female ? ['Frau', 'f'] : null),
    size: [12, 26, 9],
    build(c, f) {
      const { P, g } = fig(c, { hair: f.female ? (f.old ? 'bun' : 'long') : 'short', beard: f.beard ? c.hair : null, glasses: f.glasses ? '#2a2a2a' : null, dress: f.dress ? c.shirt : null });
      if (f.cap) hat('cap', g.hy, '#c0392b', P);
      return P;
    },
    note: (c, f) => 'Eine Figur' + (f.dress ? ' im Kleid' : '') + (f.glasses ? ' mit Brille' : '') + (f.beard ? ' und Bart' : '') + ' — Farben änderst du mit „Shirt rot", „Haare blond".' });
  T('knight', { de: 'Ritter', g: 'm', words: ['ritter', 'ritterin', 'knight', 'knights', 'krieger', 'soldat', 'warrior', 'paladin', 'gladiator', 'wikinger', 'viking'],
    slots: { shirt: ['#b8c0c8', 'rustung|armor|armour|panzer'], shield: ['#c0392b', 'schild|shield|wappen'], plume: ['#c0392b', 'feder|helmbusch|plume'] },
    feats: { viking: ['wikinger', 'viking'] },
    nameOf: (f) => (f.viking ? ['Wikinger', 'm'] : null),
    size: [14, 28, 10],
    build(c, f) {
      const { P, g } = fig(Object.assign({}, c, { pants: shade(c.shirt, 0.85), sleeves: c.shirt, shoes: '#5f6670' }), { hair: 'none', belt: '#5a3a20', gloves: '#5f6670', beard: f.viking ? '#d08a3a' : null });
      if (f.viking) P.push(ball(5.5, g.hy + 8, 3.5, 4.4, 2.6, 4.4, '#8a8f96', 'metal', { clip: [-99, g.hy + 7, -99, 99, 99, 99] }), cone(1, g.hy + 9, 3.5, 0.9, 4, 'y', '#efe6cf', null, MR));
      else hat('helmet', g.hy, c.shirt, P);
      P.push(...sword(g.ty), box(-1, g.ty - 1, 1, -1, g.ty + 6, 6, c.shield), box(-1.4, g.ty + 3, 3, -1.4, g.ty + 3, 4, GOLD, null, PNT), box(-1, g.ty + 1, 3.5, -1, g.ty + 5, 3.5, GOLD, null, PNT), box(-1, g.ty + 3, 1.5, -1, g.ty + 3, 5.5, GOLD, null, PNT));
      if (!f.viking) P.push(box(2, g.ty + 2, 1.6, 9, g.ty + 2, 1.6, c.plume));
      return P;
    },
    note: (c, f) => f.viking ? 'Ein Wikinger mit Hörnerhelm, Schwert und Schild.' : 'Ein Ritter in Rüstung, mit Helm, Schwert und Schild.' });
  T('royal', { de: 'König', g: 'm', words: ['konig', 'konige', 'konigin', 'prinz', 'prinzen', 'prinzessin', 'prinzessinnen', 'kaiser', 'kaiserin', 'king', 'queen', 'prince', 'princess', 'emperor'],
    slots: { shirt: ['#7a1f8c', 'gewand|kleid|mantel|robe|dress|kleidung'], cape: ['#c0182a', 'umhang|cape|mantel'], crown: [GOLD, 'krone|crown|diadem'], hair: ['#d8a840', 'haare|hair'] },
    feats: { female: ['konigin', 'prinzessin', 'prinzessinnen', 'kaiserin', 'queen', 'princess'], young: ['prinz', 'prinzen', 'prinzessin', 'prinzessinnen', 'prince', 'princess'] },
    def: (f) => (f.female && f.young ? { shirt: '#ff8fc4', cape: '#ffd1e8' } : f.female ? { shirt: '#5a2a8a' } : {}),
    nameOf: (f) => (f.female && f.young ? ['Prinzessin', 'f'] : f.female ? ['Königin', 'f'] : f.young ? ['Prinz', 'm'] : null),
    size: [12, 29, 9],
    build(c, f) {
      const { P, g } = fig(Object.assign({}, c, { pants: shade(c.shirt, 0.7) }), { hair: f.female ? 'long' : 'short', dress: f.female ? c.shirt : null, beard: !f.female && !f.young ? '#c8a050' : null, longBeard: false, cape: f.young && f.female ? null : c.cape, belt: f.female ? null : GOLD });
      hat(f.young && f.female ? 'tiara' : 'crown', g.hy, c.crown, P);
      if (!f.female) P.push(line(11, g.ty - 1, 1, 11, g.ty + 9, 1, 0.45, GOLD, 'metal'), ball(11, g.ty + 10, 1, 1, 1, 1, '#d0201e', 'light'));
      return P;
    },
    note: (c, f) => (f.female && f.young ? 'Eine Prinzessin im rosa Kleid mit Diadem.' : f.female ? 'Eine Königin mit Krone und Umhang.' : f.young ? 'Ein Prinz mit Krone und Zepter.' : 'Ein König mit Krone, Bart, Umhang und Zepter.') });
  T('astronaut', { de: 'Astronaut', g: 'm', words: ['astronaut', 'astronautin', 'astronauten', 'raumfahrer', 'kosmonaut', 'spaceman', 'raumanzug'],
    slots: { shirt: [WHITE, 'anzug|raumanzug|suit'], visor: ['#bfe3ff', 'helm|visier|helmet|visor'] },
    size: [13, 26, 10],
    build(c) {
      const { P, g } = fig(Object.assign({}, c, { pants: c.shirt, shoes: '#8a8f96' }), { hair: 'short', gloves: '#c8ccd2', belt: '#8a8f96' });
      hat('astro', g.hy, c.visor, P);
      P.push(box(2, g.ty, 6, 9, g.ty + 6, 7, '#c8ccd2'), box(3, g.ty + 3, 1.6, 4, g.ty + 4, 1.6, '#2e6fd8'), box(6, g.ty + 3, 1.6, 7, g.ty + 3, 1.6, '#d0201e', 'light'), box(6, g.ty + 4, 1.6, 7, g.ty + 4, 1.6, '#3fd04f', 'light'));
      return P;
    },
    note: () => 'Ein Astronaut im Raumanzug mit Glashelm und Rucksack.' });
  T('robot', { de: 'Roboter', g: 'm', words: ['roboter', 'robot', 'robots', 'robo', 'droide', 'droid', 'cyborg', 'android', 'mech', 'roboterin'],
    slots: { body: ['#a8b0b8', 'korper|body|blech|metall|roboter|robot|metal'], eyes: ['#3fe0ff', 'augen|eyes?|licht|lights?'], accent: ['#e67e22', 'akzent|details|streifen|accent'] },
    size: [14, 27, 9],
    build: (c) => [box(3, 0, 1, 5, 1, 6, c.accent, 'metal', MR), box(3, 2, 2, 4, 8, 5, shade(c.body, 0.8), 'metal', MR), box(2, 9, 1, 11, 17, 6, c.body, 'metal'), box(4, 11, 0.6, 9, 15, 0.6, '#3a3d42'), box(5, 14, 0.4, 5, 14, 0.4, c.eyes, 'light'), box(8, 14, 0.4, 8, 14, 0.4, '#ff4040', 'light'), box(5, 12, 0.4, 8, 12, 0.4, '#3fd04f', 'light'),
      box(0, 10, 2, 1, 17, 5, shade(c.body, 0.85), 'metal', MR), box(-0.6, 8, 2, 1, 9, 5, c.accent, 'metal', MR), cyl(1, 16, 3.5, 1.4, 1, 'x', c.accent, 'metal', MR), box(5, 18, 2, 8, 18, 5, '#5f6670', 'metal'),
      box(3, 19, 0, 10, 25, 7, c.body, 'metal'), box(4, 22, -0.4, 5, 23, -0.4, c.eyes, 'light', MR), box(5, 20, -0.4, 8, 20, -0.4, '#3a3d42'), box(2, 21, 2, 2, 23, 5, c.accent, 'metal', MR), line(6.5, 26, 3.5, 6.5, 28, 3.5, 0.3, '#5f6670', 'metal'), ball(6.5, 28.5, 3.5, 0.8, 0.8, 0.8, '#ff4040', 'light')],
    note: () => 'Ein Roboter mit Leuchtaugen, Antenne und Knöpfen.' });
  T('santa', { de: 'Weihnachtsmann', g: 'm', words: ['weihnachtsmann', 'weihnachtsmanner', 'nikolaus', 'santa', 'santa claus', 'father christmas', 'christkind'],
    slots: { shirt: ['#c8201e', 'mantel|anzug|jacke|suit|coat'] },
    size: [14, 30, 10],
    build(c) {
      const { P, g } = fig(Object.assign({}, c, { pants: c.shirt, shoes: DARK }), { hair: 'short', beard: WHITE, longBeard: true, belt: DARK, gloves: DARK });
      Object.assign(P[P.length - 1], {});
      hat('santa', g.hy, c.shirt, P);
      P.push(box(2, g.ty + 1, 1.6, 9, g.ty + 1, 1.6, WHITE, null, PNT), box(0, g.ty + 1, 1.6, 1, g.ty + 1, 5.4, WHITE, null, PMR), box(2, g.hy + 6, 0, 9, g.hy + 7, 7, WHITE, null, PNT), box(11, g.ty - 3, 3, 14, g.ty + 3, 7, '#8b5a2b'), ball(12.5, g.ty + 4, 5, 2, 1.4, 2, '#8b5a2b'));
      return P;
    },
    note: () => 'Der Weihnachtsmann mit Bart, Mütze und Geschenkesack.' });
  T('wizard', { de: 'Zauberer', g: 'm', words: ['zauberer', 'zauberin', 'magier', 'magierin', 'hexe', 'hexen', 'hexer', 'merlin', 'wizard', 'witch', 'mage', 'sorcerer', 'hexenmeister'],
    slots: { shirt: ['#2e4fa8', 'umhang|robe|mantel|gewand|kleid|robe|cloak'], hat: ['=shirt', 'hut|hat'], orb: ['#7fdfff', 'kugel|stab|orb|kristall|staff'] },
    feats: { witch: ['hexe', 'hexen', 'zauberin', 'magierin', 'witch'], broom: ['besen', 'broom'] },
    def: (f) => (f.witch ? { shirt: '#2a2230', orb: '#8b5a2b' } : {}),
    nameOf: (f) => (f.witch ? ['Hexe', 'f'] : null),
    size: [14, 34, 10],
    build(c, f) {
      const { P, g } = fig(Object.assign({}, c, { pants: c.shirt, skin: f.witch ? '#a8d08a' : SKIN, hair: f.witch ? '#2a2a2a' : '#c8c8c8' }), { hair: f.witch ? 'long' : 'short', dress: c.shirt, beard: f.witch ? null : WHITE, longBeard: true });
      hat(f.witch ? 'witch' : 'point', g.hy, c.hat, P);
      if (f.witch) P.push(line(-2, 1, 8, 13, 9, -2, 0.4, '#8b5a2b', 'wood'), cone(-3, 0.5, 9, 1.8, 4, '-x', '#d8b860'));
      else P.push(line(11.5, 0, 1, 11.5, g.hy + 6, 1, 0.45, '#6b4a2b', 'wood'), ball(11.5, g.hy + 7.5, 1, 1.5, 1.5, 1.5, c.orb, 'light'));
      if (!f.witch) for (const [x, y] of [[3, 3], [8, 5], [4, 7], [7, 2]]) P.push(box(x, y, 0, x, y, 2, '#ffd23f', 'light', PNT));
      return P;
    },
    note: (c, f) => f.witch ? 'Eine Hexe mit spitzem Hut und Besen.' : 'Ein Zauberer mit Sternenumhang, Spitzhut, Bart und leuchtendem Stab.' });
  T('pirate_man', { de: 'Pirat', g: 'm', words: ['=pirat', 'piratin', 'kapitan', 'captain', 'seerauber', 'freibeuter', 'buccaneer'],
    slots: { shirt: ['#c0392b', 'hemd|shirt|jacke|mantel|coat'], hat: ['#1d1f22', 'hut|hat'], pants: ['#2c3e66', 'hose|pants'] },
    size: [14, 28, 10],
    build(c) {
      const { P, g } = fig(Object.assign({}, c, { shoes: DARK, hair: '#2a2a2a' }), { hair: 'long', beard: '#2a2a2a', belt: '#5a3a20' });
      hat('pirate', g.hy, c.hat, P);
      P.push(box(7, g.hy + 3, -0.4, 8, g.hy + 4, -0.4, DARK), box(2, g.hy + 5, -0.4, 9, g.hy + 5, -0.4, DARK), ...sword(g.ty));
      for (let y = g.ty + 1; y <= g.ty + 6; y += 2) P.push(box(2, y, 1.6, 9, y, 1.6, WHITE, null, PNT));
      return P;
    },
    note: () => 'Ein Pirat mit Dreispitz, Augenklappe, Bart und Säbel.' });
  T('ghost', { de: 'Gespenst', g: 'n', words: ['gespenst', 'gespenster', '=geist', 'geister', 'spuk', 'ghost', 'ghosts', 'boo'],
    slots: { body: ['#f4f6f8', 'gespenst|geist|laken|body|ghost'] },
    size: [13, 18, 11],
    build(c) {
      const P = [ball(6, 11, 5, 5.5, 6, 5, c.body, 'light'), cyl(6, 2, 5, 5.5, 9, 'y', c.body, 'light'), ball(1, 9, 5, 1.6, 1.2, 1.4, c.body, 'light', MR)];
      for (let a = 0; a < 8; a++) { const t = a * Math.PI / 4; P.push(ball(6 + 4.6 * Math.cos(t), 1.5, 5 + 4.6 * Math.sin(t), 1.3, 1.6, 1.3, c.body, 'light')); }
      P.push(ball(4, 12.5, 0.6, 1, 1.6, 0.8, DARK, null, MR), ball(6, 9, 0.4, 1.2, 1.4, 0.8, DARK));
      return P;
    },
    note: () => 'Ein kleines Gespenst — es leuchtet im Dunkeln.' });
  T('snowman', { de: 'Schneemann', g: 'm', words: ['schneemann', 'schneemanner', 'schneefrau', 'snowman', 'snowmen', 'frosty'],
    slots: { body: ['#f4f8fb', 'schnee|korper|kugeln|body|snow'], scarf: ['#d0201e', 'schal|scarf'], hat: ['#1d1f22', 'hut|hat|zylinder'] },
    size: [17, 25, 13],
    build: (c) => [ball(8, 4, 6, 5.5, 4.5, 5.5, c.body), ball(8, 11, 6, 4.2, 3.6, 4.2, c.body), ball(8, 16.5, 6, 3, 3, 3, c.body), cone(8, 16.3, 3.2, 0.7, 3.5, '-z', '#ff7a1a'), box(6.6, 17.6, 3.1, 6.8, 17.8, 3.1, DARK, null, MR),
      ...[[11.6, 2.2], [10.4, 2], [9, 2.2]].map(([y, z]) => box(8, y, z, 8, y, z, DARK)), cyl(8, 13.6, 6, 3.4, 1, 'y', c.scarf, null, { inner: 2.2 }), box(9, 10, 2.2, 10, 13, 2.8, c.scarf),
      cyl(8, 19.2, 6, 4.2, 1, 'y', c.hat), cyl(8, 20, 6, 2.6, 4, 'y', c.hat), cyl(8, 20.4, 6, 2.65, 1, 'y', '#d0201e'),
      line(4, 12, 6, 0.5, 15, 6, 0.4, '#6b4a2b', null, MR), line(1.6, 14, 6, 0.5, 16, 7, 0.3, '#6b4a2b', null, MR)],
    note: () => 'Ein Schneemann mit Karottennase, Schal und Hut.' });
  T('police', { de: 'Polizist', g: 'm', words: ['polizist', 'polizistin', 'polizisten', 'polizei', 'police', 'policeman', 'policewoman', 'cop', 'sheriff', 'wachter'],
    slots: { shirt: ['#2c4a8a', 'uniform|hemd|shirt|jacke'], cap: ['#1d2a4a', 'mutze|kappe|cap|hut'] },
    feats: { female: ['polizistin', 'policewoman'] },
    nameOf: (f) => (f.female ? ['Polizistin', 'f'] : null),
    size: [12, 27, 11],
    build(c, f) {
      const { P, g } = fig(Object.assign({}, c, { pants: '#1d2a4a', shoes: DARK }), { hair: f.female ? 'long' : 'short', belt: DARK });
      hat('police', g.hy, c.cap, P);
      P.push(box(7, g.ty + 4, 1.6, 8, g.ty + 5, 1.6, GOLD, 'metal'), box(3, g.ty + 6, 1.6, 4, g.ty + 6, 1.6, WHITE));
      return P;
    },
    note: (c, f) => (f.female ? 'Eine Polizistin' : 'Ein Polizist') + ' in Uniform mit Mütze und Abzeichen.' });
  T('firefighter', { de: 'Feuerwehrmann', g: 'm', words: ['feuerwehrmann', 'feuerwehrfrau', 'feuerwehrleute', 'firefighter', 'fireman'],
    slots: { shirt: ['#3a3a30', 'anzug|jacke|uniform|suit|jacket'], helmet: ['#c8201e', 'helm|helmet'] },
    feats: { female: ['feuerwehrfrau'] },
    nameOf: (f) => (f.female ? ['Feuerwehrfrau', 'f'] : null),
    size: [14, 28, 10],
    build(c, f) {
      const { P, g } = fig(Object.assign({}, c, { pants: c.shirt, shoes: DARK }), { hair: f.female ? 'long' : 'short', gloves: '#3a3a30' });
      hat('fire', g.hy, c.helmet, P);
      for (const y of [g.ty + 1, g.ty + 4]) P.push(box(2, y, 1.6, 9, y, 1.6, '#e8e030', 'light', PNT), box(0, y, 1.6, 1, y, 5.4, '#e8e030', 'light', PMR));
      P.push(box(2, 2, 1.6, 4, 2, 1.6, '#e8e030', 'light', PMR), line(11, g.ty - 1, 1, 13, g.ty + 2, -2, 0.6, '#8a8f96', 'metal'));
      return P;
    },
    note: (c, f) => (f.female ? 'Eine Feuerwehrfrau' : 'Ein Feuerwehrmann') + ' mit Helm, Leuchtstreifen und Schlauch.' });
  T('doctor', { de: 'Ärztin', g: 'f', words: ['arzt', 'arztin', 'doktor', 'doktorin', 'doctor', 'krankenschwester', 'pfleger', 'nurse', 'tierarzt', 'tierarztin'],
    slots: { shirt: [WHITE, 'kittel|mantel|coat'], pants: ['#4a8ab0', 'hose|pants|scrubs'] },
    feats: { male: ['arzt', 'doktor', 'pfleger', 'tierarzt'] },
    nameOf: (f) => (f.male ? ['Arzt', 'm'] : null),
    size: [12, 26, 9],
    build(c, f) {
      const { P, g } = fig(c, { hair: f.male ? 'short' : 'long', glasses: f.male ? '#2a2a2a' : null });
      P.push(box(5, g.ty, 1.6, 6, g.ty + 6, 1.6, '#4a8ab0', null, PNT), line(3, g.ty + 6, 1.4, 5, g.ty + 2, 1.2, 0.3, '#2a2a2a'), ball(5, g.ty + 2, 1.2, 0.6, 0.6, 0.4, '#c0c7cf', 'metal'), box(7, g.ty + 3, 1.6, 8, g.ty + 4, 1.6, '#d0201e'));
      return P;
    },
    note: (c, f) => (f.male ? 'Ein Arzt' : 'Eine Ärztin') + ' mit Kittel und Stethoskop.' });
  T('cook', { de: 'Koch', g: 'm', words: ['=koch', 'koche', 'kochin', 'backer', 'backerin', 'chef', 'cook', 'baker', 'konditor'],
    slots: { shirt: [WHITE, 'jacke|schurze|apron|jacket'] },
    size: [12, 30, 10],
    build(c) {
      const { P, g } = fig(Object.assign({}, c, { pants: '#3a3d42' }), { hair: 'short' });
      hat('chef', g.hy, WHITE, P);
      P.push(box(3, g.ty - 3, 1.6, 8, g.ty + 4, 1.6, '#f0f0ee'), box(4, g.hy + 1.5, -0.4, 7, g.hy + 1.5, -0.4, '#3a2a20'), line(11, g.ty - 1, 2, 11, g.ty + 4, -1, 0.4, '#8a8f96', 'metal'), ball(11, g.ty + 4.5, -1.5, 1.2, 0.5, 1.2, '#8a8f96', 'metal'));
      return P;
    },
    note: () => 'Ein Koch mit hoher Mütze und Kochlöffel.' });
  T('ninja', { de: 'Ninja', g: 'm', words: ['ninja', 'ninjas', 'samurai', 'kampfer'],
    slots: { shirt: ['#1d1f22', 'anzug|kleidung|suit|ninja'], band: ['#c0392b', 'band|stirnband|gurtel|belt|headband'] },
    size: [14, 27, 11],
    build(c) {
      const { P, g } = fig(Object.assign({}, c, { pants: c.shirt, shoes: c.shirt, hair: c.shirt }), { hair: 'short', mouth: false, belt: c.band, gloves: c.shirt });
      P.push(box(2, g.hy, -0.2, 9, g.hy + 2, 0, c.shirt), box(2, g.hy + 5, -0.2, 9, g.hy + 5, 7.4, c.band, null, PNT), line(9, g.hy + 5, 7.5, 11, g.hy + 3, 9, 0.35, c.band), line(1, g.ty + 1, 6.5, 10, g.hy + 3, 6.5, 0.4, '#8a8f96', 'metal'), box(9, g.hy + 2, 6, 11, g.hy + 3, 7, '#5a3a20'));
      return P;
    },
    note: () => 'Ein Ninja mit Maske, Stirnband und Schwert auf dem Rücken.' });
  T('hero', { de: 'Superheld', g: 'm', words: ['superheld', 'superheldin', 'superhelden', 'superhero', 'superheroine', 'held mit umhang', 'superman', 'batman', 'spiderman'],
    slots: { shirt: ['#2e6fd8', 'anzug|kostum|suit|costume|shirt'], cape: ['#d0201e', 'umhang|cape'], emblem: ['#ffd23f', 'zeichen|logo|emblem|stern'] },
    feats: { female: ['superheldin', 'superheroine'] },
    nameOf: (f) => (f.female ? ['Superheldin', 'f'] : null),
    size: [13, 27, 9],
    build(c, f) {
      const { P, g } = fig(Object.assign({}, c, { pants: c.shirt, shoes: c.cape, hair: '#2a2a2a' }), { hair: f.female ? 'long' : 'short', belt: c.emblem, cape: c.cape, gloves: c.cape });
      P.push(box(2, g.hy + 3, -0.3, 9, g.hy + 4, -0.3, '#1d1f22'), box(3, g.hy + 3, -0.6, 4, g.hy + 4, -0.6, WHITE, null, MR), ...bitmapAt(['..X..', '.XXX.', 'XXXXX', '.X.X.'], c.emblem, 3.5, g.ty + 2, 1.6));
      return P;
    },
    note: (c, f) => (f.female ? 'Eine Superheldin' : 'Ein Superheld') + ' mit Umhang, Maske und Stern auf der Brust.' });
  T('clown', { de: 'Clown', g: 'm', words: ['clown', 'clowns', 'harlekin', 'spassmacher', 'jester'],
    slots: { shirt: ['#ffd23f', 'kostum|anzug|shirt|costume'], pants: ['#2e6fd8', 'hose|pants'], hair: ['#ff5a1f', 'haare|perucke|hair|wig'] },
    size: [14, 27, 10],
    build(c) {
      const { P, g } = fig(Object.assign({}, c, { skin: '#fbe9dc', shoes: '#d0201e' }), { hair: 'wild', mouth: '#d0201e' });
      P.push(ball(5.5, g.hy + 2.5, -0.4, 1, 1, 0.8, '#ff2020'), box(3, g.hy + 1, -0.1, 8, g.hy + 1, -0.1, '#d0201e'), box(2, 0, -1, 4, 0, 5, '#d0201e', null, MR), ball(5.5, g.ty + 4, 1.6, 0.8, 0.8, 0.5, '#d0201e'), ball(5.5, g.ty + 2, 1.6, 0.8, 0.8, 0.5, '#2e6fd8'), box(2, g.ty + 6, 1.4, 9, g.ty + 6, 1.4, WHITE));
      return P;
    },
    note: () => 'Ein Clown mit roter Nase, wilden Haaren und großen Schuhen.' });
  T('zombie', { de: 'Zombie', g: 'm', words: ['zombie', 'zombies', 'untoter', 'mumie', 'mummy'],
    slots: { skin: ['#7aa860', 'haut|skin|gesicht'], shirt: ['#3a7ab0', 'shirt|hemd|kleidung'] },
    feats: { mummy: ['mumie', 'mummy'] },
    nameOf: (f) => (f.mummy ? ['Mumie', 'f'] : null),
    size: [12, 26, 13],
    build(c, f) {
      const cc = f.mummy ? Object.assign({}, c, { skin: '#e8dcc0', shirt: '#e8dcc0', pants: '#e8dcc0', shoes: '#c8bca0', hair: '#e8dcc0' }) : Object.assign({}, c, { pants: '#4a3a6a', hair: '#2a3a2a' });
      const { P, g } = fig(cc, { hair: f.mummy ? 'none' : 'short', mouth: '#3a2020' });
      P.splice(P.findIndex(p => p.box && p.box[0] === 0 && p.box[1] === g.ty + 1), 2);
      P.push(box(0, g.ty + 5, -4, 1, g.ty + 6, 5, cc.shirt, null, MR), box(0, g.ty + 5, -5, 1, g.ty + 6, -5, cc.skin, null, MR));
      if (f.mummy) for (let y = 1; y < g.hy + 8; y += 2) P.push(box(-1, y, -6, 13, y, 9, '#c8bca0', null, PNT));
      else P.push(box(3, g.ty + 1, 1.6, 4, g.ty + 2, 1.6, cc.skin, null, PNT), box(7, 3, 1.6, 8, 4, 1.6, cc.skin, null, PNT));
      return P;
    },
    note: (c, f) => f.mummy ? 'Eine Mumie in Binden.' : 'Ein Zombie mit ausgestreckten Armen.' });
  T('vampire', { de: 'Vampir', g: 'm', words: ['vampir', 'vampire', 'vampirin', 'dracula', 'graf dracula'],
    slots: { cape: ['#1d1f22', 'umhang|cape|mantel'], shirt: ['#1d1f22', 'anzug|suit'] },
    size: [12, 27, 9],
    build(c) {
      const { P, g } = fig(Object.assign({}, c, { skin: '#e8e4ec', pants: c.shirt, hair: '#1d1f22', eyes: '#c0182a' }), { hair: 'short', cape: c.cape });
      P.push(box(1, g.ty - 4, 7, 10, g.hy, 7, '#a0101a'), box(1, g.hy, 5, 2, g.hy + 3, 7, c.cape, null, MR), box(3, g.ty + 4, 1.6, 8, g.ty + 6, 1.6, WHITE, null, PNT), box(5, g.ty + 4, 1.6, 6, g.ty + 4, 1.6, '#a0101a', null, PNT), box(4, g.hy, -0.2, 4, g.hy, -0.2, WHITE, null, MR));
      return P;
    },
    note: () => 'Ein Vampir mit Umhang und spitzen Zähnen.' });
  T('mermaid', { de: 'Meerjungfrau', g: 'f', words: ['meerjungfrau', 'meerjungfrauen', 'nixe', 'nixen', 'mermaid', 'mermaids', 'meermann', 'merman'],
    slots: { tail: ['#1abc9c', 'schwanz|flosse|fischschwanz|tail|fin'], hair: ['#e8452f', 'haare|hair'], top: ['#9b59b6', 'oberteil|muscheln|top|shells'] },
    size: [12, 25, 15],
    build(c) {
      const { P, g } = fig(Object.assign({}, c, { shirt: SKIN, sleeves: SKIN }), { hair: 'long', tail: c.tail, fin: shade(c.tail, 1.2) });
      P.push(ball(4, g.ty + 4, 1.6, 1.3, 1.1, 0.6, c.top, null, MR), ball(5.5, g.hy + 8.5, 3.5, 1, 0.7, 1, '#ff8fc4'));
      return P;
    },
    note: () => 'Eine Meerjungfrau mit Fischschwanz und langen Haaren.' });
  T('fairy', { de: 'Fee', g: 'f', words: ['=fee', 'feen', 'elfe', 'elfen', 'zahnfee', 'fairy', 'fairies', 'pixie', 'engel', 'engelchen', 'angel'],
    slots: { shirt: ['#b8f0d0', 'kleid|dress|gewand'], wings: ['#cdeaff', 'flugel|wings?'], hair: ['#f2d06a', 'haare|hair'] },
    feats: { angel: ['engel', 'engelchen', 'angel'] },
    def: (f) => (f.angel ? { shirt: WHITE } : {}),
    nameOf: (f) => (f.angel ? ['Engel', 'm'] : null),
    size: [18, 27, 12],
    build(c, f) {
      const { P, g } = fig(c, { hair: 'long', dress: c.shirt });
      P.unshift(ball(-1.5, g.ty + 8, 8, 3.2, 4.4, 0.7, c.wings, 'glass', MR), ball(-0.5, g.ty + 2, 8, 2.4, 3, 0.7, c.wings, 'glass', MR));
      if (f.angel) P.push(cyl(5.5, g.hy + 10, 3.5, 3.4, 1, 'y', GOLD, 'light', { inner: 2.4 }));
      else P.push(line(11, g.ty - 1, 1.5, 12.5, g.ty + 4, -1, 0.3, '#d8c8a0'), ball(12.7, g.ty + 4.5, -1.2, 1, 1, 0.6, '#ffe14d', 'light'));
      return P;
    },
    note: (c, f) => f.angel ? 'Ein Engel mit Flügeln und Heiligenschein.' : 'Eine Fee mit glitzernden Flügeln und Zauberstab.' });
  T('gnome', { de: 'Gartenzwerg', g: 'm', words: ['gartenzwerg', 'gartenzwerge', 'zwerg', 'zwerge', 'wichtel', 'kobold', 'gnome', 'dwarf', 'dwarves', 'leprechaun'],
    slots: { hat: ['#d0201e', 'mutze|hut|zipfelmutze|hat|cap'], shirt: ['#2e6fd8', 'hemd|jacke|shirt|kittel'], beard: [WHITE, 'bart|beard'] },
    size: [12, 26, 10],
    build(c) {
      const { P, g } = fig(Object.assign({}, c, { pants: '#6b4a2b', shoes: '#3a2a20', hair: c.beard }), { short: true, hair: 'short', beard: c.beard, longBeard: true, belt: '#3a2a20' });
      hat('gnome', g.hy, c.hat, P);
      P.push(line(11, g.ty - 1, 1, 11, g.ty + 6, 1, 0.4, '#8b5a2b', 'wood'), box(10, g.ty + 5, -1, 12, g.ty + 7, 0, '#8a8f96', 'metal'), ball(5.5, g.hy + 2.5, -0.5, 1, 0.9, 0.7, '#f0a080'));
      return P;
    },
    note: () => 'Ein Gartenzwerg mit Zipfelmütze, Bart und Schaufel.' });
  T('cowboy', { de: 'Cowboy', g: 'm', words: ['cowboy', 'cowboys', 'cowgirl', 'cowgirls', 'sheriff', 'western'],
    slots: { hat: ['#8b5a2b', 'hut|hat'], shirt: ['#c0392b', 'hemd|shirt'], vest: ['#6b4a2b', 'weste|vest'] },
    feats: { female: ['cowgirl', 'cowgirls'] },
    nameOf: (f) => (f.female ? ['Cowgirl', 'n'] : null),
    size: [16, 28, 13],
    build(c, f) {
      const { P, g } = fig(Object.assign({}, c, { pants: '#3a5a8a', shoes: '#5a3a20' }), { hair: f.female ? 'long' : 'short', belt: '#3a2a20' });
      hat('cowboy', g.hy, c.hat, P);
      P.push(box(2, g.ty + 1, 1.6, 3, g.ty + 6, 5.4, c.vest, null, PMR), box(2, g.ty + 1, 1.6, 9, g.ty + 6, 1.6, c.vest, null, PNT), box(4, g.ty + 1, 1.6, 7, g.ty + 6, 1.6, c.shirt, null, PNT), box(3, g.ty + 4, 1.4, 3, g.ty + 4, 1.4, GOLD, 'metal'));
      return P;
    },
    note: (c, f) => (f.female ? 'Ein Cowgirl' : 'Ein Cowboy') + ' mit Hut, Weste und Stiefeln.' });
  T('scarecrow', { de: 'Vogelscheuche', g: 'f', words: ['vogelscheuche', 'vogelscheuchen', 'scarecrow', 'strohpuppe'],
    slots: { shirt: ['#8a5a9a', 'hemd|jacke|shirt'], hat: ['#d8b860', 'hut|hat|stroh'] },
    size: [18, 30, 12],
    build(c) {
      const { P, g } = fig(Object.assign({}, c, { skin: '#e8d4a0', pants: '#5a6a8a', hair: '#e8c860', shoes: '#e8c860' }), { hair: 'wild', mouth: '#5a3a20', gloves: '#e8c860' });
      P.splice(P.findIndex(p => p.box && p.box[0] === 0 && p.box[1] === g.ty + 1), 2);
      P.push(box(-3, g.ty + 5, 2, 14, g.ty + 6, 5, c.shirt), box(-4, g.ty + 4, 2, -3, g.ty + 7, 5, '#e8c860', null, MR), line(5.5, -4, 3.5, 5.5, g.ty, 3.5, 0.6, '#6b4a2b', 'wood'), box(3, g.ty + 2, 1.6, 4, g.ty + 3, 1.6, '#c0392b', null, PNT), box(7, 4, 1.6, 8, 5, 1.6, '#2e9e4f', null, PNT));
      P.push(cyl(5.5, g.hy + 8, 3.5, 7, 1, 'y', c.hat), cone(5.5, g.hy + 9, 3.5, 3.6, 4, 'y', c.hat));
      return P;
    },
    note: () => 'Eine Vogelscheuche mit Strohhut auf einem Pfahl.' });
  T('statue', { de: 'Statue', g: 'f', words: ['statue', 'statuen', 'denkmal', 'denkmaler', 'skulptur', 'skulpturen', 'bronzefigur', 'steinfigur', 'monument', 'sculpture', 'reiterstandbild', 'standbild'],
    slots: { body: ['#9c9a94', 'stein|statue|bronze|marmor|stone|material'] },
    size: [14, 30, 11],
    build: (c) => sub('person', 1, [1, 3, 1]).concat([box(0, 0, 0, 13, 2, 10, '#7d7a74', 'stone'), box(1, 2, 1, 12, 2, 9, '#8a8780', 'stone')]),
    note: () => 'Eine Statue auf einem Sockel.' });
  // a little picture as boxes (emblems, signs)
  function bitmapAt(rows, col, x0, y0, z, mat) { const P = []; rows.forEach((r, i) => { for (let j = 0; j < r.length; j++) if (r[j] !== '.' && r[j] !== ' ') P.push(box(x0 + j, y0 + rows.length - 1 - i, z, x0 + j, y0 + rows.length - 1 - i, z, col, mat, PNT)); }); return P; }

  // ---------------------------------------------------------------- things
  CAT = 'thing';
  T('table', { de: 'Tisch', g: 'm', words: ['=tisch', 'tische', 'esstisch', 'holztisch', 'gartentisch', 'picknicktisch', 'schreibtisch', 'table', 'tables', 'desk'],
    slots: { body: ['#a0703a', 'tisch|platte|holz|table|body'], legs: ['=body', 'beine|fusse|legs?'] },
    feats: { set: ['gedeckt', 'gedeckter', 'set', 'teller', 'geschirr'], picnic: ['picknick', 'picknicktisch', 'picnic'] },
    size: (f) => [16, 8, f.picnic ? 16 : 10],
    build(c, f) {
      const P = [box(0, 7, 0, 15, 7, 9, c.body, 'wood'), box(1, 0, 1, 2, 6, 2, c.legs, 'wood', MR), box(1, 0, 7, 2, 6, 8, c.legs, 'wood', MR)];
      if (f.picnic) P.push(box(0, 4, -3, 15, 4, -2, c.body, 'wood'), box(0, 4, 11, 15, 4, 12, c.body, 'wood'), box(1, 0, -3, 1, 3, -2, c.legs, 'wood', MR), box(1, 0, 11, 1, 3, 12, c.legs, 'wood', MR));
      if (f.set) for (const x of [3, 12]) for (const z of [2.5, 6.5]) P.push(cyl(x, 8, z, 1.4, 1, 'y', WHITE), box(x + 1.6, 8, z, x + 1.6, 9, z, '#c0c7cf', 'metal'));
      if (f.set) P.push(cyl(7.5, 8, 4.5, 0.6, 3, 'y', '#c0392b'), ball(7.5, 11.5, 4.5, 0.5, 0.8, 0.5, '#ffd23f', 'light'));
      return P;
    },
    note: (c, f) => (f.picnic ? 'Ein Picknicktisch mit zwei Bänken' : 'Ein Tisch') + (f.set ? ', gedeckt mit Tellern und einer Kerze.' : '.') });
  T('chair', { de: 'Stuhl', g: 'm', words: ['stuhl', 'stuhle', 'sessel', 'thron', 'throne', 'chair', 'chairs', 'armchair', 'hocker', 'schaukelstuhl', 'liegestuhl'],
    slots: { body: ['#a0703a', 'stuhl|sessel|holz|chair|body|thron'], seat: ['=body', 'sitz|kissen|polster|seat|cushion'] },
    feats: { throne: ['thron', 'throne', 'konigsthron'] },
    def: (f) => (f.throne ? { body: GOLD, seat: '#c0182a' } : {}),
    nameOf: (f) => (f.throne ? ['Thron', 'm'] : null),
    size: (f) => (f.throne ? [10, 19, 10] : [8, 13, 8]),
    build(c, f) {
      if (f.throne) return [box(0, 0, 0, 9, 5, 9, c.body, 'metal'), box(1, 5, 0, 8, 6, 7, c.seat), box(0, 6, 8, 9, 17, 9, c.body, 'metal'), box(1, 7, 7.6, 8, 15, 7.6, c.seat), box(0, 6, 0, 0, 9, 7, c.body, 'metal', MR), cone(0.5, 17, 8.5, 0.8, 2, 'y', c.body, 'metal', MR), cone(4.5, 18, 8.5, 1, 2, 'y', c.body, 'metal'), box(4, 16, 7.4, 5, 16, 7.4, '#4ab0ff', 'light')];
      return [box(0, 5, 0, 7, 5, 7, c.seat, 'wood'), box(0, 0, 0, 0, 4, 0, c.body, 'wood', MR), box(0, 0, 7, 0, 4, 7, c.body, 'wood', MR), box(0, 6, 7, 0, 12, 7, c.body, 'wood', MR), box(0, 8, 7, 7, 8, 7, c.body, 'wood'), box(0, 11, 7, 7, 12, 7, c.body, 'wood')];
    },
    note: (c, f) => f.throne ? 'Ein goldener Thron mit rotem Polster.' : 'Ein Stuhl.' });
  T('sofa', { de: 'Sofa', g: 'n', words: ['sofa', 'sofas', 'couch', 'couchen', 'sitzecke', 'settee'],
    slots: { body: ['#3f6aa8', 'sofa|couch|stoff|polster|body'], cushions: ['=body', 'kissen|cushions?'] },
    size: [16, 9, 8],
    build: (c) => [box(0, 1, 0, 15, 3, 7, c.body), box(0, 4, 5, 15, 8, 7, c.body), box(0, 4, 0, 1, 6, 7, c.body, null, MR), box(2, 4, 0, 7, 4, 4, shade(c.cushions, 1.12)), box(8, 4, 0, 13, 4, 4, shade(c.cushions, 1.12)), box(0, 0, 0, 0, 0, 0, DARK, null, MR), box(0, 0, 7, 0, 0, 7, DARK, null, MR), box(3, 5, 4, 5, 7, 4, '#f1c40f'), box(10, 5, 4, 12, 7, 4, '#e74c3c')],
    note: () => 'Ein Sofa mit Kissen.' });
  T('bed', { de: 'Bett', g: 'n', words: ['=bett', 'betten', 'himmelbett', 'doppelbett', 'kinderbett', 'etagenbett', 'hochbett', 'bed', 'beds', 'bunk bed'],
    slots: { body: ['#8b5a2b', 'bett|rahmen|holz|bed|frame'], blanket: ['#2e6fd8', 'decke|bettdecke|blanket|bettwasche|duvet'] },
    feats: { canopy: ['himmelbett', 'canopy'], bunk: ['etagenbett', 'hochbett', 'bunk'] },
    nameOf: (f) => (f.canopy ? ['Himmelbett', 'n'] : f.bunk ? ['Etagenbett', 'n'] : null),
    size: (f) => [10, f.canopy ? 16 : f.bunk ? 15 : 9, 19],
    build(c, f) {
      const P = [box(0, 0, 0, 9, 2, 17, c.body, 'wood'), box(0, 3, 0, 9, 3, 17, WHITE), box(0, 4, 0, 9, 4, 12, c.blanket), box(1, 4, 14, 8, 5, 16, WHITE), box(0, 0, 17, 9, 8, 18, c.body, 'wood'), box(0, 0, 0, 9, 4, 0, c.body, 'wood')];
      if (f.canopy) P.push(box(0, 9, 0, 0, 15, 0, c.body, 'wood', MR), box(0, 9, 18, 0, 15, 18, c.body, 'wood', MR), box(0, 15, 0, 9, 15, 18, '#e8478f'), box(0, 12, 0, 0, 14, 17, '#f4a6c6', null, MR));
      if (f.bunk) P.push(box(0, 9, 0, 9, 10, 17, c.body, 'wood'), box(0, 11, 0, 9, 11, 12, '#c0392b'), box(1, 11, 14, 8, 12, 16, WHITE), box(0, 0, 0, 0, 14, 0, c.body, 'wood', MR), box(0, 8, 18, 9, 14, 18, c.body, 'wood'), ...[2, 4, 6, 8].map(y => box(9, y, -1, 9, y, 1, c.body, 'wood')));
      return P;
    },
    note: (c, f) => f.canopy ? 'Ein Himmelbett.' : f.bunk ? 'Ein Etagenbett.' : 'Ein Bett mit Decke und Kissen.' });
  T('shelf', { de: 'Bücherregal', g: 'n', words: ['regal', 'regale', 'bucherregal', 'bucherschrank', 'bucher', '=buch', 'bookshelf', 'bookcase', 'books', 'schrank', 'kleiderschrank', 'wardrobe', 'cupboard'],
    slots: { body: ['#8b5a2b', 'regal|schrank|holz|body|shelf'] },
    feats: { wardrobe: ['schrank', 'kleiderschrank', 'wardrobe', 'cupboard'] },
    nameOf: (f) => (f.wardrobe ? ['Schrank', 'm'] : null),
    size: [12, 17, 5],
    build(c, f) {
      if (f.wardrobe) return [box(0, 0, 0, 11, 16, 4, c.body, 'wood'), box(5.5, 1, 0, 5.5, 15, 0, shade(c.body, 0.7)), box(4, 8, -0.4, 4, 9, -0.4, GOLD, 'metal'), box(7, 8, -0.4, 7, 9, -0.4, GOLD, 'metal'), box(0, 16, 0, 11, 16, 4, shade(c.body, 0.8), 'wood')];
      const P = [box(0, 0, 0, 11, 16, 4, c.body, 'wood'), box(1, 1, 0, 10, 15, 3, AIR)], K = ['#c0392b', '#2e6fd8', '#27ae60', '#f1c40f', '#8e44ad', '#e67e22', '#1abc9c', '#ecf0f1'];
      for (const y of [5, 10]) P.push(box(1, y, 0, 10, y, 3, c.body, 'wood'));
      let i = 0; for (const y0 of [1, 6, 11]) for (let x = 1; x <= 10; x++) { const h = 2 + ((x * 7 + y0) % 3); if ((x + y0) % 5 === 0) continue; P.push(box(x, y0, 1, x, y0 + Math.min(h, 3), 3, K[i++ % K.length])); }
      return P;
    },
    note: (c, f) => f.wardrobe ? 'Ein Kleiderschrank.' : 'Ein Bücherregal voller bunter Bücher.' });
  T('tv', { de: 'Fernseher', g: 'm', words: ['fernseher', 'fernsehgerat', 'tv', 'television', 'bildschirm', 'monitor', 'computer', '=pc', 'laptop', 'notebook', 'spielkonsole', 'konsole', 'gaming pc'],
    slots: { body: ['#1d1f22', 'fernseher|gehause|rahmen|body|tv'], screen: ['#3fa7ff', 'bild|bildschirm|screen'] },
    feats: { computer: ['computer', '=pc', 'gaming pc', 'monitor'], laptop: ['laptop', 'notebook'] },
    nameOf: (f) => (f.laptop ? ['Laptop', 'm'] : f.computer ? ['Computer', 'm'] : null),
    size: (f) => (f.laptop ? [14, 9, 10] : [18, 14, f.computer ? 10 : 5]),
    build(c, f) {
      if (f.laptop) return [box(0, 0, 0, 13, 0, 9, '#8a8f96', 'metal'), box(1, 1, 1, 12, 1, 5, '#3a3d42'), box(0, 1, 9, 13, 8, 9, '#8a8f96', 'metal'), box(1, 2, 8.6, 12, 7, 8.6, c.screen, 'light')];
      const P = [box(0, 3, 1, 17, 13, 2, c.body), box(1, 4, 0.6, 16, 12, 0.6, c.screen, 'light'), box(7, 0, 1, 10, 2, 3, c.body), box(5, 0, 0, 12, 0, 4, c.body), box(3, 8, 0.4, 5, 10, 0.4, '#ffe14d', 'light', PNT), box(11, 5, 0.4, 14, 6, 0.4, '#3fd04f', 'light', PNT)];
      if (f.computer) P.push(box(2, 0, -6, 15, 0, -3, '#3a3d42'), box(17, 0, -5, 18, 0, -3, '#3a3d42'), box(19, 0, 2, 22, 9, 8, c.body), box(20, 7, 1.6, 21, 7, 1.6, '#3fd04f', 'light'));
      return P;
    },
    note: (c, f) => f.laptop ? 'Ein aufgeklappter Laptop.' : f.computer ? 'Ein Computer mit Bildschirm, Tastatur und Turm.' : 'Ein Fernseher.' });
  T('piano', { de: 'Klavier', g: 'n', words: ['klavier', 'klaviere', 'flugel', 'piano', 'keyboard', 'orgel'],
    slots: { body: ['#1d1f22', 'klavier|gehause|body|piano'] },
    size: [16, 12, 7],
    build(c) {
      const P = [box(0, 0, 3, 15, 11, 6, c.body), box(0, 5, 0, 15, 5, 3, c.body), box(1, 6, 0, 14, 6, 2, WHITE), box(0, 0, 0, 0, 5, 2, c.body, null, MR), box(5, 9, 2.6, 10, 10, 2.6, '#f3ead2')];
      for (let x = 1; x <= 14; x++) if (x % 7 !== 3 && x % 7 !== 0) P.push(box(x, 7, 1, x, 7, 2, DARK));
      return P;
    },
    note: () => 'Ein Klavier mit schwarzen und weißen Tasten.' });
  T('guitar', { de: 'Gitarre', g: 'f', words: ['gitarre', 'gitarren', 'e gitarre', 'guitar', 'guitars', 'geige', 'violine', 'cello', 'ukulele', 'bass'],
    slots: { body: ['#c0742a', 'gitarre|korpus|holz|body|guitar'], neck: ['#5a3a20', 'hals|griffbrett|neck'] },
    feats: { electric: ['e gitarre', 'elektrisch', 'electric', 'rock', 'bass'] },
    def: (f) => (f.electric ? { body: '#c0182a' } : {}),
    size: [10, 24, 3],
    build(c, f) {
      const P = [ball(4.5, 4.5, 1, 4.4, 4.2, 1.4, c.body), ball(4.5, 10, 1, 3.4, 3, 1.4, c.body), line(4.5, 11, 1, 4.5, 21, 1, 0.7, c.neck, 'wood'), box(3.5, 21, 0.5, 5.5, 23, 1.5, c.neck, 'wood'), box(3, 22, 0.5, 3, 22, 0.5, '#c0c7cf', null, MR), box(3, 2.5, 0, 6, 2.5, 0, DARK)];
      if (f.electric) P.push(box(3, 5, -0.2, 6, 6, -0.2, WHITE), box(3, 8, -0.2, 6, 8, -0.2, '#c0c7cf', 'metal'));
      else P.push(cyl(4.5, 7.5, -0.4, 1.4, 1, 'z', '#2a1a10', null, PNT), line(4, 3, -0.2, 4, 21, -0.2, 0.2, '#e8e8e8', null, PNT), line(5, 3, -0.2, 5, 21, -0.2, 0.2, '#e8e8e8', null, PNT));
      return P;
    },
    note: (c, f) => f.electric ? 'Eine E-Gitarre.' : 'Eine Gitarre.' });
  T('drums', { de: 'Schlagzeug', g: 'n', words: ['schlagzeug', 'trommel', 'trommeln', 'drums', 'drum', 'drumset', 'pauke'],
    slots: { body: ['#c0182a', 'trommeln|kessel|body|drums'] },
    size: [18, 12, 12],
    build: (c) => [cyl(9, 4, 3, 4, 5, 'z', c.body), cyl(9, 4, 2.6, 3.4, 1, 'z', WHITE), cyl(4.5, 4, 3, 2, 3, 'y', c.body), cyl(4.5, 7, 3, 2.1, 1, 'y', WHITE), cyl(7, 8.5, 5, 1.8, 2, 'y', c.body), cyl(11, 8.5, 5, 1.8, 2, 'y', c.body), cyl(14, 3, 6, 2.6, 4, 'y', c.body),
      line(2, 0, 7, 2, 10, 7, 0.3, '#c0c7cf', 'metal'), cyl(2, 10, 7, 2.8, 1, 'y', GOLD, 'metal'), line(16, 0, 4, 16, 9, 4, 0.3, '#c0c7cf', 'metal'), cyl(16, 9, 4, 2.4, 1, 'y', GOLD, 'metal'), box(6, 0, 8, 8, 3, 10, '#3a3a3a')],
    note: () => 'Ein Schlagzeug mit Trommeln und Becken.' });
  T('clock', { de: 'Standuhr', g: 'f', words: ['uhr', 'uhren', 'standuhr', 'wanduhr', 'kuckucksuhr', 'clock', 'clocks', 'grandfather clock', 'wecker'],
    slots: { body: ['#6b3a1a', 'gehause|uhr|holz|body|clock'], face: [WHITE, 'zifferblatt|face|ziffern'] },
    feats: { cuckoo: ['kuckucksuhr', 'kuckuck', 'cuckoo'], alarm: ['wecker', 'alarm'] },
    nameOf: (f) => (f.cuckoo ? ['Kuckucksuhr', 'f'] : f.alarm ? ['Wecker', 'm'] : null),
    size: (f) => (f.cuckoo ? [11, 14, 5] : f.alarm ? [10, 10, 5] : [8, 23, 5]),
    build(c, f) {
      if (f.alarm) return [cyl(5, 4.5, 1, 4, 3, 'z', '#c0392b'), cyl(5, 4.5, 0.6, 3.2, 1, 'z', c.face), box(5, 4.5, 0.2, 5, 7, 0.2, DARK), box(5, 4.5, 0.2, 7, 4.5, 0.2, DARK), ball(2, 8.5, 2, 1.4, 1, 1.4, GOLD, 'metal', MR), line(2.5, 1, 2, 1.5, -0.5, 2, 0.4, '#3a3a3a', null, MR)];
      if (f.cuckoo) return [box(1, 0, 1, 9, 9, 4, c.body, 'wood'), wedge(0, 9, 0, 5, 13, 5, '-x', '#4a2a10', 'wood', MR), cyl(5, 5, 0.6, 2.6, 1, 'z', c.face), box(5, 5, 0.2, 5, 7, 0.2, DARK), box(5, 5, 0.2, 6.5, 5, 0.2, DARK), box(4, 9, 0.4, 6, 10, 0.4, '#2a1a10'), ball(5, 9.8, 0, 0.8, 0.7, 0.8, '#ffd23f'), line(4, 0, 2.5, 4, -6, 2.5, 0.2, GOLD, null, MR), cone(4, -6, 2.5, 0.8, 2, '-y', '#4a2a10', null, MR)];
      return [box(0, 0, 0, 7, 22, 4, c.body, 'wood'), box(1, 1, 0, 6, 12, 0, '#4a2a10', 'wood'), line(3.5, 12, -0.2, 3.5, 5, -0.2, 0.25, GOLD, 'metal'), ball(3.5, 4.5, -0.3, 1.2, 1.2, 0.5, GOLD, 'metal'), cyl(3.5, 17, -0.2, 2.8, 1, 'z', c.face), box(3.5, 17, -0.6, 3.5, 19, -0.6, DARK), box(3.5, 17, -0.6, 5, 17, -0.6, DARK), wedge(0, 22, 0, 3.5, 24, 4, '-x', c.body, 'wood', MR)];
    },
    note: (c, f) => f.cuckoo ? 'Eine Kuckucksuhr mit Vogel und Gewichten.' : f.alarm ? 'Ein Wecker mit zwei Glocken.' : 'Eine Standuhr mit Pendel.' });
  T('chest', { de: 'Schatztruhe', g: 'f', words: ['truhe', 'truhen', 'schatztruhe', 'schatz', 'schatzkiste', 'chest', 'treasure', 'treasure chest'],
    slots: { body: ['#7a4a2a', 'truhe|kiste|holz|body|chest'], bands: [GOLD, 'beschlage|bander|metall|bands|lock|schloss'] },
    feats: { gold: ['schatz', 'gold', 'goldmunzen', 'treasure', 'munzen', 'voll'] }, on: { gold: true },
    size: [12, 10, 8],
    build(c, f) {
      const P = [box(0, 0, 0, 11, 5, 7, c.body, 'wood'), cyl(0, 6, 3.5, 3.6, 12, 'x', c.body, 'wood', { clip: [-99, 6, -99, 99, 99, 99] }), box(0, 5, 0, 11, 6, 7, c.body, 'wood')];
      for (const x of [1, 10]) P.push(box(x, 0, -0.2, x, 6, 7.2, c.bands, 'metal'), cyl(x, 6, 3.5, 3.8, 1, 'x', c.bands, 'metal', { clip: [-99, 6, -99, 99, 99, 99] }));
      P.push(box(5, 4, -0.4, 6, 6, -0.4, c.bands, 'metal'), box(5.5, 4.5, -0.6, 5.5, 4.5, -0.6, DARK));
      if (f.gold) P.push(ball(3, 6, 0, 1.2, 0.8, 1, GOLD, 'metal'), ball(8, 6.2, -0.2, 1, 0.7, 1, GOLD, 'metal'), ball(6.5, 6.6, -0.4, 0.8, 0.6, 0.8, '#d0201e', 'light'));
      return P;
    },
    note: (c, f) => 'Eine Schatztruhe mit Goldbeschlägen' + (f.gold ? ' und Münzen.' : '.') });
  T('barrel', { de: 'Fass', g: 'n', words: ['=fass', 'fasser', 'holzfass', 'weinfass', 'barrel', 'barrels', 'tonne', 'regentonne'],
    slots: { body: ['#8b5a2b', 'fass|holz|body|barrel'], rings: ['#3a3d42', 'ringe|reifen|rings|bands'] },
    size: [9, 11, 9],
    build: (c) => [ball(4, 5, 4, 4.4, 6, 4.4, c.body, 'wood', { clip: [-99, 0, -99, 99, 10, 99] }), ball(4, 5, 4, 4.5, 6, 4.5, c.rings, 'metal', { clip: [-99, 2, -99, 99, 2, 99] }), ball(4, 5, 4, 4.5, 6, 4.5, c.rings, 'metal', { clip: [-99, 8, -99, 99, 8, 99] }), cyl(4, 10, 4, 3, 1, 'y', shade(c.body, 0.8), 'wood')],
    note: () => 'Ein Holzfass mit Eisenringen.' });
  T('crate', { de: 'Kiste', g: 'f', words: ['kiste', 'kisten', 'holzkiste', 'karton', 'crate', 'crates', 'box', 'boxes', 'paket', 'kartons'],
    slots: { body: ['#c8a165', 'kiste|holz|body|crate|box'] },
    size: [8, 8, 8],
    build: (c) => [box(0, 0, 0, 7, 7, 7, c.body, 'wood'), box(0, 0, 0, 7, 7, 7, shade(c.body, 0.7), 'wood', { hollow: true, paint: true }), box(1, 1, 0, 6, 6, 7, c.body, 'wood', PNT), box(0, 1, 1, 7, 6, 6, c.body, 'wood', PNT), box(1, 0, 1, 6, 7, 6, c.body, 'wood', PNT), line(1, 1, -0.2, 6, 6, -0.2, 0.4, shade(c.body, 0.7), 'wood', PNT), line(-0.2, 1, 1, -0.2, 6, 6, 0.4, shade(c.body, 0.7), 'wood', PNT)],
    note: () => 'Eine Holzkiste.' });
  T('anchor', { de: 'Anker', g: 'm', words: ['anker', 'schiffsanker', 'anchor', 'anchors'],
    slots: { body: ['#3a3d42', 'anker|metall|body|anchor'] },
    size: [13, 17, 3],
    build: (c) => [cyl(6, 14.5, 1, 1.8, 1, 'z', c.body, 'metal', { inner: 1 }), line(6, 1, 1, 6, 13, 1, 0.75, c.body, 'metal'), line(2.5, 11, 1, 9.5, 11, 1, 0.6, c.body, 'metal'), cyl(6, 4.5, 1, 5.2, 1, 'z', c.body, 'metal', { inner: 4.2, clip: [-99, -99, -99, 99, 4.5, 99] }), cone(1, 4, 1, 1, 2.5, 'y', c.body, 'metal', MR)],
    note: () => 'Ein Schiffsanker.' });
  T('bell', { de: 'Glocke', g: 'f', words: ['glocke', 'glocken', 'kirchenglocke', 'glockchen', 'bell', 'bells'],
    slots: { body: [GOLD, 'glocke|metall|body|bell'] },
    size: [13, 13, 13],
    build: (c) => [ball(6, 7, 6, 4.4, 5, 4.4, c.body, 'metal', { clip: [-99, 6, -99, 99, 99, 99] }), cone(6, 1, 6, 6.2, 12, 'y', c.body, 'metal', { clip: [-99, 1, -99, 99, 7, 99] }), cyl(6, 1, 6, 6.2, 1, 'y', shade(c.body, 0.85), 'metal'), cyl(6, 1, 6, 5, 4, 'y', AIR), ball(6, 1.5, 6, 1.2, 1.2, 1.2, '#5f5d58', 'metal'), cyl(6, 11.5, 6, 1.2, 2, 'y', '#5f5d58', 'metal', { inner: 0.4 })],
    note: () => 'Eine goldene Glocke.' });
  T('umbrella', { de: 'Sonnenschirm', g: 'm', words: ['sonnenschirm', 'regenschirm', 'schirm', 'schirme', 'umbrella', 'parasol', 'strandschirm'],
    slots: { body: ['#e74c3c', 'schirm|stoff|bespannung|body|umbrella'], stripe: [WHITE, SYN.stripe] },
    feats: { rain: ['regenschirm', 'rain'] },
    nameOf: (f) => (f.rain ? ['Regenschirm', 'm'] : null),
    size: [17, 14, 17],
    build(c) {
      const P = [line(8, 0, 8, 8, 12, 8, 0.45, '#d8d0c0'), cone(8, 10, 8, 8.4, 4, 'y', c.body)];
      for (let a = 0; a < 8; a += 2) { const t = a * Math.PI / 4; P.push(wedge(8, 10, 8, 8 + 8.5 * Math.cos(t + 0.39), 13, 8 + 8.5 * Math.sin(t + 0.39), '+x', c.stripe, null, { paint: true })); }
      for (let a = 0; a < 8; a++) { const t = a * Math.PI / 4 + Math.PI / 8; P.push(line(8, 13.5, 8, 8 + 7.8 * Math.cos(t), 10, 8 + 7.8 * Math.sin(t), 0.6, a % 2 ? c.stripe : c.body)); }
      P.push(ball(8, 14, 8, 0.7, 0.7, 0.7, c.body));
      return P;
    },
    note: () => 'Ein gestreifter Schirm.' });
  T('gift', { de: 'Geschenk', g: 'n', words: ['geschenk', 'geschenke', 'geschenkbox', 'geschenkpaket', 'present', 'gift', 'gifts', 'presents', 'uberraschung'],
    slots: { body: ['#c0392b', 'geschenk|papier|box|body|gift'], ribbon: [GOLD, 'schleife|band|ribbon|bow'] },
    size: [11, 13, 11],
    build: (c) => [box(0, 0, 0, 10, 8, 10, c.body), box(0, 8, 0, 10, 9, 10, shade(c.body, 1.15)), box(4, 0, -0.2, 6, 9.2, 10.2, c.ribbon, null, PNT), box(-0.2, 0, 4, 10.2, 9.2, 6, c.ribbon, null, PNT), box(0, 0, 4, 10, 9, 6, c.ribbon, null, PNT), box(4, 0, 0, 6, 9, 10, c.ribbon, null, PNT),
      ball(3.5, 11, 5, 2, 1.5, 1, c.ribbon), ball(7.5, 11, 5, 2, 1.5, 1, c.ribbon), ball(5.5, 10.5, 5, 1, 1, 1, c.ribbon)],
    note: () => 'Ein Geschenk mit Schleife.' });
  T('trophy', { de: 'Pokal', g: 'm', words: ['pokal', 'pokale', 'tropha', 'siegerpokal', 'trophy', 'cup winner', 'medaille'],
    slots: { body: [GOLD, 'pokal|gold|body|trophy|cup'], base: ['#3a2a20', 'sockel|base|fuss'] },
    size: [13, 16, 7],
    build: (c) => [box(2, 0, 0, 10, 2, 6, c.base, 'wood'), cyl(6, 3, 3, 2.4, 1, 'y', c.body, 'metal'), cyl(6, 4, 3, 0.9, 3, 'y', c.body, 'metal'), ball(6, 10, 3, 4, 4, 3.4, c.body, 'metal', { clip: [-99, 7, -99, 99, 13, 99] }), cyl(6, 12, 3, 3.6, 2, 'y', c.body, 'metal', { inner: 2.6 }),
      cyl(2, 10.5, 3, 1.8, 1, 'z', c.body, 'metal', { inner: 1, clip: [-99, -99, -99, 2, 99, 99] }), cyl(10, 10.5, 3, 1.8, 1, 'z', c.body, 'metal', { inner: 1, clip: [10, -99, -99, 99, 99, 99] }), box(5, 1, -0.2, 7, 1, -0.2, '#c0c7cf', 'metal')],
    note: () => 'Ein goldener Siegerpokal.' });
  T('crown', { de: 'Krone', g: 'f', words: ['krone', 'kronen', 'konigskrone', 'diadem', 'crown', 'crowns', 'tiara'],
    slots: { body: [GOLD, 'krone|gold|body|crown'], gems: ['#d0201e', 'edelsteine|steine|juwelen|gems|jewels|rubine'] },
    size: [13, 10, 13],
    build(c) {
      const P = [cyl(6, 0, 6, 6, 4, 'y', c.body, 'metal', { inner: 4.8 }), cyl(6, 0, 6, 6.2, 1, 'y', shade(c.body, 0.85), 'metal', { inner: 4.6 })];
      for (let a = 0; a < 8; a++) { const t = a * Math.PI / 4; P.push(cone(6 + 5.4 * Math.cos(t), 4, 6 + 5.4 * Math.sin(t), 1.2, 4, 'y', c.body, 'metal'), ball(6 + 5.6 * Math.cos(t), 2, 6 + 5.6 * Math.sin(t), 0.7, 0.7, 0.7, a % 2 ? '#2e6fd8' : c.gems, 'light')); }
      P.push(ball(6, 2.5, 6, 4.6, 3, 4.6, '#a0101a', null, { clip: [-99, 2, -99, 99, 99, 99] }));
      return P;
    },
    note: () => 'Eine goldene Krone mit Edelsteinen.' });
  T('sword', { de: 'Schwert', g: 'n', words: ['schwert', 'schwerter', 'sabel', 'degen', 'zauberschwert', 'sword', 'swords', 'katana', 'axt', 'axe'],
    slots: { body: ['#d8dde3', 'klinge|schwert|blade|body'], hilt: [GOLD, 'griff|parierstange|hilt|handle'] },
    size: [9, 26, 3],
    build: (c) => [box(3, 7, 0.5, 5, 23, 1.5, c.body, 'metal'), box(4, 24, 0.5, 4, 25, 1.5, c.body, 'metal'), box(4, 8, 0.4, 4, 22, 0.4, shade(c.body, 0.8), 'metal', PNT), box(0, 5, 0, 8, 6, 2, c.hilt, 'metal'), box(3.5, 1, 0.5, 4.5, 4, 1.5, '#5a3a20'), ball(4, 0.5, 1, 1.2, 1, 1, c.hilt, 'metal'), box(4, 5.5, -0.4, 4, 5.5, -0.4, '#d0201e', 'light')],
    note: () => 'Ein Schwert mit goldener Parierstange.' });
  const SHIELD = ['XXXXXXXXXXX', 'XXXXXXXXXXX', 'XXXXXXXXXXX', 'XXXXXXXXXXX', 'XXXXXXXXXXX', 'XXXXXXXXXXX', 'XXXXXXXXXXX', '.XXXXXXXXX.', '.XXXXXXXXX.', '..XXXXXXX..', '...XXXXX...', '....XXX....', '.....X.....'];
  T('shield', { de: 'Ritterschild', g: 'm', words: ['schutzschild', 'ritterschild', 'wappenschild', 'wappen', 'shield', 'shields', 'crest'],
    slots: { body: ['#2e6fd8', 'schild|shield|body|grund'], emblem: [GOLD, 'wappen|zeichen|emblem|kreuz|cross|lowe'] },
    size: [11, 13, 3],
    build: (c) => [Object.assign(bitmap(SHIELD, { X: c.body }, 1, true)), box(5, 2, -1, 5, 10, 3, c.emblem, null, PNT), box(2, 8, -1, 8, 8, 3, c.emblem, null, PNT), box(0, 0, -1, 10, 12, 3, shade(c.body, 0.7), null, { paint: true, hollow: true })],
    note: () => 'Ein Ritterschild mit Wappen.' });
  // food
  T('cake', { de: 'Torte', g: 'f', words: ['torte', 'torten', 'kuchen', 'geburtstagstorte', 'geburtstagskuchen', 'hochzeitstorte', 'sahnetorte', 'cake', 'cakes', 'birthday cake', 'cupcake', 'muffin'],
    slots: { body: ['#f4a6c6', 'torte|kuchen|creme|zuckerguss|frosting|icing|body|cake'], base: ['#e8c48a', 'boden|teig|sponge|base'] },
    feats: { candles: ['geburtstag', 'geburtstagstorte', 'geburtstagskuchen', 'kerzen', 'birthday', 'candles'], wedding: ['hochzeitstorte', 'hochzeit', 'wedding', 'stockig'] },
    def: (f) => (f.wedding ? { body: WHITE } : {}),
    nameOf: (f) => (f.wedding ? ['Hochzeitstorte', 'f'] : f.candles ? ['Geburtstagstorte', 'f'] : null),
    size: (f) => [17, f.wedding ? 20 : 13, 17],
    build(c, f) {
      const P = [cyl(8, 0, 8, 8.4, 1, 'y', '#e8e8e8'), cyl(8, 1, 8, 7.4, 4, 'y', c.base), cyl(8, 5, 8, 7.6, 1, 'y', c.body), cyl(8, 6, 8, 5.4, 3, 'y', c.base), cyl(8, 9, 8, 5.6, 1, 'y', c.body)];
      for (let a = 0; a < 12; a++) { const t = a * Math.PI / 6; P.push(line(8 + 7.5 * Math.cos(t), 5, 8 + 7.5 * Math.sin(t), 8 + 7.5 * Math.cos(t), 3 + (a % 2), 8 + 7.5 * Math.sin(t), 0.5, c.body)); }
      let top = 10;
      if (f.wedding) { P.push(cyl(8, 10, 8, 3.6, 4, 'y', c.base), cyl(8, 14, 8, 3.8, 1, 'y', c.body), ball(8, 16, 8, 1.4, 1.4, 1.4, '#f4a6c6')); top = 15; }
      for (const [x, z] of [[5, 6], [11, 6], [8, 11], [6.5, 9], [10, 9.5]]) P.push(ball(x, top, z, 0.8, 0.8, 0.8, '#d0201e'));
      if (f.candles) for (const [x, z] of [[6, 7], [10, 7], [8, 9.5], [6, 11], [10, 11]]) P.push(cyl(x, top, z, 0.45, 3, 'y', ['#2e6fd8', '#f1c40f', '#27ae60', '#e8478f', '#8e44ad'][(x + z) % 5 | 0]), box(x, top + 3, z, x, top + 3, z, '#ffd23f', 'light'));
      return P;
    },
    note: (c, f) => f.wedding ? 'Eine dreistöckige Hochzeitstorte.' : f.candles ? 'Eine Geburtstagstorte mit Kerzen.' : 'Eine Torte mit Sahne und Kirschen.' });
  T('icecream', { de: 'Eis', g: 'n', words: ['=eis', 'eiswaffel', 'eistute', 'eiscreme', 'speiseeis', 'softeis', 'ice cream', 'icecream', 'gelato', 'eiskugel', 'eiskugeln'],
    slots: { body: ['#ff9fc4', 'eis|kugel|kugeln|scoops?|body|creme'], cone: ['#d9a35a', 'waffel|tute|cone|hornchen'] },
    size: [11, 21, 11],
    build(c) {
      const P = [cone(5, 9, 5, 3.4, 10, '-y', c.cone)];
      for (let y = 1; y < 9; y += 2) P.push(cone(5, 9, 5, 3.5, 10, '-y', shade(c.cone, 0.8), null, { paint: true, clip: [-99, y, -99, 99, y, 99] }));
      P.push(ball(5, 10.5, 5, 3.6, 2.8, 3.6, c.body), ball(5, 14.5, 5, 3.2, 2.6, 3.2, '#8b5a3c'), ball(5, 18, 5, 2.8, 2.3, 2.8, '#f3ead2'), ball(5, 20.5, 5, 0.9, 0.9, 0.9, '#d0201e'));
      return P;
    },
    note: () => 'Ein Eis in der Waffel — Erdbeer, Schoko und Vanille mit Kirsche.' });
  T('burger', { de: 'Burger', g: 'm', words: ['burger', 'hamburger', 'cheeseburger', 'hamburger', 'sandwich'],
    slots: { body: ['#d9963a', 'brotchen|bun|brot|body'] },
    size: [15, 12, 15],
    build: (c) => [cyl(7, 0, 7, 6.6, 2, 'y', c.body), cyl(7, 2, 7, 7, 1, 'y', '#6aa83a'), cyl(7, 3, 7, 6.8, 2, 'y', '#5a3220'), box(0.5, 5, 0.5, 13.5, 5, 13.5, '#f5c400'), cyl(7, 6, 7, 6.4, 1, 'y', '#d0302a'), ball(7, 7, 7, 6.8, 4.4, 6.8, c.body, null, { clip: [-99, 7, -99, 99, 99, 99] }),
      ...[[4, 10.6, 5], [9, 10.8, 4], [7, 11.2, 8], [4.5, 10.3, 9.5], [10, 10.2, 9]].map(([x, y, z]) => box(x, y, z, x, y, z, '#f8ecd0', null, PNT))],
    note: () => 'Ein Burger mit Salat, Käse und Tomate.' });
  T('pizza', { de: 'Pizza', g: 'f', words: ['pizza', 'pizzen', 'pizzas'],
    slots: { body: ['#f5c842', 'kase|cheese|body|pizza'] },
    size: [17, 3, 17],
    build(c) {
      const P = [cyl(8, 0, 8, 8.4, 1, 'y', '#d9a35a'), cyl(8, 1, 8, 8.4, 1, 'y', '#c8873a', null, { inner: 7.2 }), cyl(8, 1, 8, 7.2, 1, 'y', '#c0302a'), cyl(8, 1, 8, 6.6, 1, 'y', c.body)];
      for (const [x, z] of [[5, 5], [11, 5], [8, 8], [4, 10], [12, 10.5], [8, 12.5], [8, 3.5]]) P.push(cyl(x, 2, z, 1.2, 1, 'y', '#a0201a'));
      for (const [x, z] of [[6.5, 6.5], [10, 9], [5.5, 12]]) P.push(box(x, 2, z, x, 2, z, '#2e8a3a'));
      return P;
    },
    note: () => 'Eine Salamipizza.' });
  T('donut', { de: 'Donut', g: 'm', words: ['donut', 'donuts', 'doughnut', 'krapfen', 'berliner'],
    slots: { body: ['#f4a6c6', 'glasur|zuckerguss|icing|frosting|body'], dough: ['#d9a35a', 'teig|dough'] },
    size: [15, 5, 15],
    build(c) {
      const P = [cyl(7, 0, 7, 6.4, 1, 'y', c.dough, null, { inner: 2.8 }), cyl(7, 1, 7, 7, 2, 'y', c.dough, null, { inner: 2.2 }), cyl(7, 3, 7, 6.4, 1, 'y', c.body, null, { inner: 2.8 }), cyl(7, 2.6, 7, 6.8, 1, 'y', c.body, null, { inner: 2.4, paint: true })];
      const K = ['#ffd23f', '#2e6fd8', '#27ae60', WHITE, '#e74c3c'];
      for (let a = 0; a < 14; a++) { const t = a * 0.9, r = 3.8 + (a % 3) * 0.9; P.push(box(7 + r * Math.cos(t), 3, 7 + r * Math.sin(t), 7 + r * Math.cos(t), 3, 7 + r * Math.sin(t), K[a % K.length], null, PNT)); }
      return P;
    },
    note: () => 'Ein Donut mit rosa Glasur und Streuseln.' });
  T('apple', { de: 'Apfel', g: 'm', words: ['apfel', 'apfeln', 'birne', 'birnen', 'orange', 'orangen', 'zitrone', 'zitronen', 'kirsche', 'kirschen', 'apple', 'apples', 'pear', 'lemon', 'cherry', 'pfirsich', 'peach', 'obst', 'frucht'],
    slots: { body: ['#d0302a', 'apfel|schale|body|apple|birne|frucht'] },
    feats: { pear: ['birne', 'birnen', 'pear'], orange: ['orange', 'orangen'], lemon: ['zitrone', 'zitronen', 'lemon'], cherry: ['kirsche', 'kirschen', 'cherry'] },
    def: (f) => (f.pear ? { body: '#b8c83a' } : f.orange ? { body: '#f39c12' } : f.lemon ? { body: '#f5d800' } : f.cherry ? { body: '#a0101a' } : {}),
    nameOf: (f) => (f.pear ? ['Birne', 'f'] : f.orange ? ['Orange', 'f'] : f.lemon ? ['Zitrone', 'f'] : f.cherry ? ['Kirschen', 'f'] : null),
    size: (f) => (f.cherry ? [11, 12, 5] : [11, 13, 11]),
    build(c, f) {
      if (f.cherry) return [ball(2.5, 2.5, 2, 2.3, 2.3, 2.3, c.body), ball(8, 2.5, 2, 2.3, 2.3, 2.3, c.body), line(2.5, 4.5, 2, 5.5, 11, 2, 0.3, '#4a7a2a'), line(8, 4.5, 2, 5.5, 11, 2, 0.3, '#4a7a2a'), ball(6.8, 11, 2, 1.6, 0.6, 1, '#4caf50')];
      if (f.pear) return [ball(5, 4, 5, 4.6, 4.2, 4.6, c.body), ball(5, 8.5, 5, 2.8, 3, 2.8, c.body), cyl(5, 11, 5, 0.4, 2, 'y', '#5a3a20'), ball(6.5, 12.2, 5, 1.6, 0.5, 1, '#4caf50')];
      if (f.lemon) return [ball(5, 5, 5, 4.6, 3.6, 3.6, c.body), cone(0.5, 5, 5, 1, 1.5, '-x', c.body), cone(9.5, 5, 5, 1, 1.5, 'x', c.body)];
      return [ball(5, 5, 5, 5, 4.8, 5, c.body), cyl(5, 9, 5, 0.4, 3, 'y', '#5a3a20'), ball(6.8, 11, 5, 1.8, 0.5, 1.1, '#4caf50'), ball(3, 6.5, 1.2, 1, 1.2, 0.4, shade(c.body, 1.4), null, PNT)];
    },
    note: (c, f) => (f.pear ? 'Eine Birne.' : f.orange ? 'Eine Orange.' : f.lemon ? 'Eine Zitrone.' : f.cherry ? 'Zwei Kirschen am Stiel.' : 'Ein Apfel mit Blatt.') });
  T('banana', { de: 'Banane', g: 'f', words: ['banane', 'bananen', 'banana', 'bananas'],
    slots: { body: ['#f5d800', 'banane|schale|body|banana'] },
    size: [17, 8, 5],
    build(c) { const P = []; for (let t = 0; t <= 1.001; t += 0.06) { const a = Math.PI * (0.15 + 0.7 * t), x = 8 + 8 * Math.cos(a), y = 8 - 6 * Math.sin(a); P.push(ball(16 - x, y, 2, 1.8 - Math.abs(t - 0.5) * 1.6, 1.8 - Math.abs(t - 0.5) * 1.6, 1.8 - Math.abs(t - 0.5) * 1.6, t < 0.05 || t > 0.95 ? '#5a3a20' : c.body)); } return P; },
    note: () => 'Eine Banane.' });
  T('strawberry', { de: 'Erdbeere', g: 'f', words: ['erdbeere', 'erdbeeren', 'strawberry', 'strawberries', 'himbeere', 'himbeeren'],
    slots: { body: ['#e0202e', 'erdbeere|body|strawberry'] },
    size: [9, 11, 9],
    build: (c) => [ball(4, 5, 4, 4, 3.6, 4, c.body), cone(4, 4, 4, 3.6, 5, '-y', c.body), ...[[2, 6, 0.5], [5, 5, 0.3], [3, 3, 0.8], [6, 7, 0.7], [4, 7.5, 0.5], [1, 4, 2], [7, 4, 2], [4, 2, 1.5]].map(([x, y, z]) => box(x, y, z, x, y, z, '#ffe14d', null, PNT)),
      ball(4, 8.6, 4, 3.4, 0.8, 3.4, '#3e9a4a'), cyl(4, 9, 4, 0.5, 2, 'y', '#3e9a4a')],
    note: () => 'Eine Erdbeere.' });
  T('carrot', { de: 'Karotte', g: 'f', words: ['karotte', 'karotten', 'mohre', 'mohren', 'rube', 'ruben', 'carrot', 'carrots', 'radieschen'],
    slots: { body: ['#ff8c1a', 'karotte|mohre|rube|body|carrot'] },
    size: [7, 18, 7],
    build: (c) => [cone(3, 11, 3, 2.6, 12, '-y', c.body), line(3, 11, 3, 1, 17, 3, 0.4, '#3e9a4a'), line(3, 11, 3, 3, 18, 3, 0.4, '#3e9a4a'), line(3, 11, 3, 5, 17, 3.5, 0.4, '#3e9a4a'), ...[4, 6, 8].map(y => box(0, y, 0, 6, y, 6, shade(c.body, 0.85), null, PNT))],
    note: () => 'Eine Karotte mit Grün.' });
  T('egg', { de: 'Osterei', g: 'n', words: ['=ei', 'eier', 'osterei', 'ostereier', 'dinoi', 'drachenei', 'egg', 'eggs', 'easter egg'],
    slots: { body: ['#7fc8f8', 'ei|schale|body|egg'], stripes: ['#ff6fa8', 'streifen|muster|stripes?|pattern'] },
    feats: { plain: ['=ei', 'eier', 'egg', 'eggs', 'huhnerei'], dino: ['dinoi', 'drachenei', 'dragon egg', 'dino egg'] },
    def: (f) => (f.dino ? { body: '#5fa83a', stripes: '#3a6a20' } : f.plain ? { body: '#f2e6d2' } : {}),
    nameOf: (f) => (f.dino ? ['Drachenei', 'n'] : null),
    size: [9, 12, 9],
    build(c, f) {
      const P = [ball(4, 5, 4, 4, 4.4, 4, c.body), ball(4, 7.5, 4, 3.4, 3.8, 3.4, c.body)];
      if (!f.plain || f.dino) P.push(ball(4, 5, 4, 4.2, 4.6, 4.2, c.stripes, null, { paint: true, clip: [-99, 4, -99, 99, 4, 99] }), ball(4, 7.5, 4, 3.6, 4, 3.6, f.dino ? c.stripes : '#ffd23f', null, { paint: true, clip: [-99, 7, -99, 99, 7, 99] }), ball(4, 5, 4, 4.2, 4.6, 4.2, '#8e44ad', null, { paint: true, clip: [-99, 2, -99, 99, 2, 99] }));
      return P;
    },
    note: (c, f) => f.dino ? 'Ein geflecktes Drachenei.' : 'Ein bemaltes Osterei.' });
  T('cup', { de: 'Tasse', g: 'f', words: ['tasse', 'tassen', 'kaffeetasse', 'teetasse', 'becher', 'kaffee', 'tee', 'kakao', 'cup', 'mug', 'coffee', 'tea'],
    slots: { body: [WHITE, 'tasse|becher|body|cup|mug'], drink: ['#5a3220', 'kaffee|tee|kakao|getrank|drink|coffee'] },
    size: [11, 8, 8],
    build: (c) => [cyl(4, 0, 4, 3.6, 7, 'y', c.body), cyl(4, 2, 4, 2.8, 5, 'y', AIR), cyl(4, 5, 4, 2.8, 1, 'y', c.drink), cyl(8.4, 3.5, 4, 2, 1, 'z', c.body, null, { inner: 1, clip: [8, -99, -99, 99, 99, 99] }), box(3, 3, 0.3, 5, 4, 0.3, '#e74c3c', null, PNT), ball(4, 9, 4, 1, 1, 1, '#e8e8e8'), ball(4.6, 11, 4.2, 0.8, 0.8, 0.8, '#f0f0f0')],
    note: () => 'Eine dampfende Tasse.' });
  T('teapot', { de: 'Teekanne', g: 'f', words: ['teekanne', 'kanne', 'kaffeekanne', 'giesskanne', 'teapot', 'kettle', 'watering can'],
    slots: { body: ['#e8478f', 'kanne|body|teapot'] },
    feats: { watering: ['giesskanne', 'watering'] },
    def: (f) => (f.watering ? { body: '#3e9a4a' } : {}),
    nameOf: (f) => (f.watering ? ['Gießkanne', 'f'] : null),
    size: [15, 11, 9],
    build: (c, f) => (f.watering ? [cyl(8, 0, 4, 3.6, 7, 'y', c.body), line(5, 2, 4, 0, 7, 4, 0.6, c.body), cone(0, 7, 4, 1.2, 1.5, '-x', c.body), cyl(11.2, 4, 4, 2.6, 1, 'z', c.body, null, { inner: 1.6, clip: [11, -99, -99, 99, 99, 99] }), line(8, 7, 4, 8, 9, 4, 0.4, c.body), cyl(8, 9, 4, 3, 1, 'z', c.body, null, { inner: 2.2, clip: [-99, 9, -99, 99, 99, 99] })]
      : [ball(7, 4, 4, 4.4, 4, 4, c.body, null, UP), cyl(7, 7, 4, 2.6, 1, 'y', c.body), ball(7, 8.5, 4, 1, 1, 1, c.body), line(3, 3, 4, 0.5, 6, 4, 0.6, c.body), cyl(11.6, 4.5, 4, 2.2, 1, 'z', c.body, null, { inner: 1.2, clip: [11, -99, -99, 99, 99, 99] }), box(4, 3, 0, 10, 3, 0, WHITE, null, PNT), box(4, 5, 0, 10, 5, 0, WHITE, null, PNT)]),
    note: (c, f) => f.watering ? 'Eine Gießkanne.' : 'Eine Teekanne.' });
  T('bottle', { de: 'Flasche', g: 'f', words: ['flasche', 'flaschen', 'flaschenpost', 'bottle', 'bottles', 'trank', 'zaubertrank', 'potion', 'glas'],
    slots: { body: ['#3e9a4a', 'flasche|glas|body|bottle|trank'] },
    feats: { potion: ['trank', 'zaubertrank', 'potion', 'magisch'] },
    def: (f) => (f.potion ? { body: '#9b59b6' } : {}),
    nameOf: (f) => (f.potion ? ['Zaubertrank', 'm'] : null),
    size: [7, 14, 7],
    build: (c, f) => (f.potion ? [ball(3, 3.5, 3, 3.4, 3.4, 3.4, '#cfe8f6', 'glass'), ball(3, 3.2, 3, 2.6, 2.6, 2.6, c.body, 'light', { clip: [-99, -99, -99, 99, 4, 99] }), cyl(3, 6, 3, 1, 3, 'y', '#cfe8f6', 'glass'), cyl(3, 9, 3, 1.2, 1, 'y', '#8b5a2b', 'wood')]
      : [cyl(3, 0, 3, 2.6, 7, 'y', c.body, 'glass'), ball(3, 7, 3, 2.6, 1.6, 2.6, c.body, 'glass'), cyl(3, 8, 3, 1, 4, 'y', c.body, 'glass'), cyl(3, 12, 3, 1.1, 1, 'y', '#8b5a2b'), box(1, 2, 0.4, 5, 4, 0.4, '#f3ead2', null, PNT)]),
    note: (c, f) => f.potion ? 'Ein leuchtender Zaubertrank.' : 'Eine Flasche mit Etikett.' });
  T('lollipop', { de: 'Lutscher', g: 'm', words: ['lutscher', 'lolli', 'lollies', 'lollipop', 'bonbon', 'bonbons', 'zuckerstange', 'candy', 'sussigkeit', 'sussigkeiten', 'candy cane'],
    slots: { body: ['#ff5a9e', 'lutscher|lolli|bonbon|body|candy'], stripe: [WHITE, SYN.stripe] },
    feats: { cane: ['zuckerstange', 'candy cane'] },
    nameOf: (f) => (f.cane ? ['Zuckerstange', 'f'] : null),
    size: (f) => (f.cane ? [8, 18, 3] : [11, 18, 3]),
    build(c, f) {
      if (f.cane) { const P = [cyl(3, 14, 1, 3.2, 1, 'z', c.body, null, { inner: 1.8, clip: [-99, 14, -99, 99, 99, 99] }), line(6.2, 14, 1, 6.2, 11, 1, 0.75, c.body), line(-0.2, 14, 1, -0.2, 0, 1, 0.75, c.body)]; for (let y = 1; y < 14; y += 3) P.push(box(-1, y, 0, 1, y, 2, c.stripe, null, PNT)); return P; }
      const P = [line(5, 0, 1, 5, 9, 1, 0.4, WHITE)];
      for (let i = 0; i < 5; i++) P.push(cyl(5, 12.5, 0, 5 - i, 2, 'z', i % 2 ? c.stripe : c.body, null, { inner: Math.max(0, 4 - i) }));
      return P;
    },
    note: (c, f) => f.cane ? 'Eine rot-weiße Zuckerstange.' : 'Ein Lutscher mit Spirale.' });
  T('ball', { de: 'Ball', g: 'm', words: ['=ball', 'balle', 'fussball', 'basketball', 'wasserball', 'strandball', 'volleyball', 'tennisball', 'football', 'soccer ball', 'beach ball', 'kugel'],
    slots: { body: [WHITE, 'ball|body|kugel'], patches: ['#1d1f22', 'flecken|muster|patches|lines'] },
    feats: { basket: ['basketball'], beach: ['wasserball', 'strandball', 'beach ball'], tennis: ['tennisball'] },
    def: (f) => (f.basket ? { body: '#e8762a' } : f.tennis ? { body: '#d8e830' } : {}),
    nameOf: (f) => (f.basket ? ['Basketball', 'm'] : f.beach ? ['Wasserball', 'm'] : f.tennis ? ['Tennisball', 'm'] : ['Fußball', 'm']),
    size: [13, 13, 13],
    build(c, f) {
      const P = [ball(6, 6, 6, 6, 6, 6, c.body)];
      if (f.basket) P.push(ball(6, 6, 6, 6.2, 6.2, 6.2, c.patches, null, { paint: true, clip: [-99, 6, -99, 99, 6, 99] }), ball(6, 6, 6, 6.2, 6.2, 6.2, c.patches, null, { paint: true, clip: [6, -99, -99, 6, 99, 99] }), ball(6, 6, 6, 6.2, 6.2, 6.2, c.patches, null, { paint: true, clip: [-99, -99, 6, 99, 99, 6] }));
      else if (f.beach) { const K = ['#e74c3c', '#f1c40f', '#2e6fd8', WHITE]; for (let i = 0; i < 4; i++) P.push(ball(6, 6, 6, 6.2, 6.2, 6.2, K[i], null, { paint: true, clip: [i < 2 ? -99 : 6, -99, i % 2 ? -99 : 6, i < 2 ? 6 : 99, 99, i % 2 ? 6 : 99] })); }
      else if (f.tennis) P.push(cyl(6, 6, 6, 6.4, 1, 'x', WHITE, null, { inner: 5.4, paint: true }));
      else for (const [a, e] of [[0, 0], [1.26, 0], [2.51, 0], [3.77, 0], [5.03, 0], [0.63, 0.9], [1.9, 0.9], [3.14, 0.9], [4.4, 0.9], [5.65, 0.9], [0, 1.57], [0.63, -0.9], [1.9, -0.9], [3.14, -0.9], [4.4, -0.9], [5.65, -0.9]].filter((_, i) => i % 2 === 0 || i > 9)) P.push(ball(6 + 6 * Math.cos(a) * Math.cos(e), 6 + 6 * Math.sin(e), 6 + 6 * Math.sin(a) * Math.cos(e), 1.6, 1.6, 1.6, c.patches, null, PNT));
      return P;
    },
    note: (c, f) => (f.basket ? 'Ein Basketball.' : f.beach ? 'Ein bunter Wasserball.' : f.tennis ? 'Ein Tennisball.' : 'Ein Fußball.') });
  T('crane', { de: 'Kran', g: 'm', words: ['=kran', 'krane', 'baukran', 'turmdrehkran', 'crane', 'cranes', 'baustelle', 'construction'],
    slots: { body: ['#f1c40f', 'kran|turm|ausleger|body|crane'] },
    size: [36, 34, 6],
    build(c) {
      const P = [box(4, 0, 0, 10, 1, 6, '#8a8f96', 'stone')];
      for (const [x, z] of [[6, 2], [8, 2], [6, 4], [8, 4]]) P.push(line(x, 1, z, x, 28, z, 0.35, c.body, 'metal'));
      for (let y = 2; y < 28; y += 3) P.push(line(6, y, 2, 8, y + 3, 2, 0.3, c.body, 'metal'), line(6, y, 4, 8, y + 3, 4, 0.3, c.body, 'metal'), line(6, y + 1.5, 2, 6, y + 1.5, 4, 0.3, c.body, 'metal'));
      P.push(box(5, 27, 1, 9, 29, 5, c.body, 'metal'), box(9, 25, 1, 11, 28, 5, '#5f6670', 'metal'), box(10, 26, 0.6, 11, 27, 0.6, GLASSC, 'glass'), line(7, 30, 3, 35, 30, 3, 0.6, c.body, 'metal'), line(7, 28.5, 3, 34, 29.5, 3, 0.4, c.body, 'metal'), line(7, 33, 3, 33, 30, 3, 0.3, '#5f6670', 'metal'), line(7, 33, 3, 0, 30, 3, 0.3, '#5f6670', 'metal'), line(7, 29, 3, 7, 34, 3, 0.4, c.body, 'metal'),
        line(0, 30, 3, 6, 30, 3, 0.6, c.body, 'metal'), box(0, 26, 1, 3, 29, 5, '#8a8f96', 'stone'), line(26, 29.5, 3, 26, 14, 3, 0.2, '#3a3a3a'), box(25, 12, 2, 27, 13, 4, '#5f6670', 'metal'), cone(26, 12, 3, 0.8, 2, '-y', '#d0201e', 'metal'));
      return P;
    },
    note: () => 'Ein Baukran mit Ausleger, Gegengewicht und Haken.' });

  // ---------------------------------------------------------------- letters: a sign, a name, a word (5 × 7 font)
  const FONT = {
    A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14], D: [28, 18, 17, 17, 17, 18, 28], E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16],
    G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17], I: [14, 4, 4, 4, 4, 4, 14], J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
    M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17], O: [14, 17, 17, 17, 17, 17, 14], P: [30, 17, 17, 30, 16, 16, 16], Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17],
    S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4], U: [17, 17, 17, 17, 17, 17, 14], V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17],
    Y: [17, 17, 17, 10, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31], '0': [14, 17, 19, 21, 25, 17, 14], '1': [4, 12, 4, 4, 4, 4, 14], '2': [14, 17, 1, 2, 4, 8, 31], '3': [31, 2, 4, 2, 1, 17, 14],
    '4': [2, 6, 10, 18, 31, 2, 2], '5': [31, 16, 30, 1, 1, 17, 14], '6': [6, 8, 16, 30, 17, 17, 14], '7': [31, 1, 2, 4, 8, 8, 8], '8': [14, 17, 17, 14, 17, 17, 14], '9': [14, 17, 17, 15, 1, 2, 12],
    '!': [4, 4, 4, 4, 4, 0, 4], '?': [14, 17, 1, 2, 4, 0, 4], '-': [0, 0, 0, 31, 0, 0, 0], '.': [0, 0, 0, 0, 0, 12, 12], ',': [0, 0, 0, 0, 12, 4, 8], '+': [0, 4, 4, 31, 4, 4, 0], '&': [12, 18, 20, 8, 21, 18, 13],
    ':': [0, 12, 12, 0, 12, 12, 0], '#': [10, 10, 31, 10, 31, 10, 10], '♥': [0, 10, 31, 31, 14, 4, 0], 'Ä': [10, 0, 14, 17, 31, 17, 17], 'Ö': [10, 0, 14, 17, 17, 17, 14], 'Ü': [10, 0, 17, 17, 17, 17, 14],
  };
  // the words to write: what is quoted, or what follows "Schriftzug", "Aufschrift", "Schild mit", "Name" …
  const TEXTKEY = /\b(schriftzug|schrift|leuchtschrift|aufschrift|text|wort|buchstaben|namen?|namensschild|schild|banner|letters?|lettering|that says|saying|reading|words?)\b\s*[:=]?\s*/gi;
  B.textOf = function (raw) {
    raw = String(raw || '');
    const q = /[„"“'«»]([^"“”„'«»]{1,40})["“”'«»]/.exec(raw); if (q) return q[1].trim();
    let m, last = null; TEXTKEY.lastIndex = 0; while ((m = TEXTKEY.exec(raw))) last = TEXTKEY.lastIndex;
    if (last === null) return null;
    let t = raw.slice(last).split(/[,;\n]/)[0].trim().replace(/^(mit|with|der|dem|die|das|the|von|:)\s+/i, '').replace(/^(der|dem|die|das|aufschrift|namen?|text|wort)\s+/i, '');
    for (let k = 0; k < 3; k++) { const w = /\s+(in|aus|als|mit|ganz|sehr|made of|in the colou?r)?\s*([A-Za-zÄÖÜäöüß]+)$/.exec(t); if (!w) break; const word = B.norm(w[2]); if (B.colors(word).length || /^(holz|stein|gold|silber|metall|neon|leuchtend\w*|bunt\w*|gross\w*|klein\w*|riesig\w*|schild|blocken|blocks)$/.test(word)) t = t.slice(0, w.index); else break; }
    return t.trim().slice(0, 40) || null;
  };
  function textRows(text) {
    const lines = String(text || '').toUpperCase().replace(/ß/g, 'SS').replace(/[❤]/g, '♥').split(/\s*[\/|]\s*/).filter(Boolean).slice(0, 3).map(l => l.slice(0, 16));
    const W = Math.max(...lines.map(l => [...l].reduce((w, ch) => w + (ch === ' ' ? 3 : 6), -1)), 1), rows = [];
    lines.forEach((l, li) => {
      if (li) rows.push(''.padEnd(W, '.'), ''.padEnd(W, '.'));
      const R = Array.from({ length: 7 }, () => []);
      let first = true;
      for (const ch of l) { if (!first) for (const r of R) r.push('.'); first = false; if (ch === ' ') { for (const r of R) r.push('.', '.'); continue; } const g = FONT[ch] || FONT['?']; for (let y = 0; y < 7; y++) for (let b = 4; b >= 0; b--) R[y].push(g[y] >> b & 1 ? 'X' : '.'); }
      const pad = (W - R[0].length) >> 1;
      for (const r of R) rows.push(''.padEnd(pad, '.') + r.join('') + ''.padEnd(W - pad - r.length, '.'));
    });
    return rows;
  }
  T('letters', { de: 'Schriftzug', g: 'm', words: ['schriftzug', 'schriftzuge', 'leuchtschrift', 'aufschrift', 'buchstaben', 'namensschild', 'schild', 'schilder', 'ortsschild', 'banner', 'lettering', '=sign', 'signs', 'neonschild', 'willkommensschild'],
    slots: { body: ['#f5c400', 'buchstaben|schrift|text|letters|body'], board: ['#8b5a2b', 'schild|brett|tafel|board|hintergrund'] },
    feats: { board: ['schild', 'schilder', 'namensschild', 'ortsschild', 'willkommensschild', 'tafel', 'brett', 'board', '=sign', 'signs'], neon: ['leuchtschrift', 'neon', 'neonschild', 'leuchtend', 'leuchtet', 'glowing', 'leuchtende'] },
    def: (f) => (f.board ? { body: '#f4f4f2' } : f.neon ? { body: '#ff4fd8' } : {}),
    nameOf: (f) => (f.board ? ['Schild', 'n'] : null),
    size(f, rc) { const R = textRows((rc && rc.text) || 'HALLO'); return [R[0].length + (f.board ? 4 : 0), R.length + (f.board ? 9 : 0), f.board ? 4 : 3]; },
    fitOf: (S, size, f) => Math.round(Math.max(...size) * Math.max(1, Math.min(4, S * 0.32 / 7))),
    build(c, f, rc) {
      const R = textRows(rc.text || 'HALLO'), w = R[0].length, h = R.length, P = [];
      const letters = Object.assign(bitmap(R, { X: c.body }, 1, true), f.neon ? { mat: 'light' } : null);
      if (!f.board) { P.push(letters); return P; }
      letters.relief.at = [2, 7, 0];
      P.push(box(0, 5, 2, w + 3, h + 8, 3, c.board, 'wood'), box(0, 5, 1, w + 3, h + 8, 1, shade(c.board, 0.8), 'wood', { hollow: true }), letters, box(2, 0, 2.5, 3, 4, 2.5, c.board, 'wood'), box(w, 0, 2.5, w + 1, 4, 2.5, c.board, 'wood'));
      return P;
    },
    note: (c, f, rc) => (f.board ? 'Ein Schild mit „' : 'Der Schriftzug „') + (rc.text || 'HALLO') + '“' + (f.neon ? ', leuchtend.' : '.') });

  // ================================================================ photos
  const hexOf = (r, g, b) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  // a canvas → what the brain needs from it: the thing (its outline against the background), its colours
  B.photo = function (cv) {
    try {
      if (!cv || !cv.width || !cv.height || typeof document === 'undefined') return { ok: false };
      const f = Math.min(1, 128 / Math.max(cv.width, cv.height)), w = Math.max(1, Math.round(cv.width * f)), h = Math.max(1, Math.round(cv.height * f));
      const c2 = document.createElement('canvas'); c2.width = w; c2.height = h;
      const x = c2.getContext('2d'); x.drawImage(cv, 0, 0, w, h);
      return B.photoData(x.getImageData(0, 0, w, h).data, w, h);
    } catch (e) { return { ok: false }; }
  };
  B.photoData = function (d, w, h) {
    const N = w * h, px = (i) => [d[i * 4], d[i * 4 + 1], d[i * 4 + 2], d[i * 4 + 3]];
    const dist = (a, b) => Math.sqrt(2 * (a[0] - b[0]) ** 2 + 4 * (a[1] - b[1]) ** 2 + 3 * (a[2] - b[2]) ** 2) / 3;
    // the background: the colours along the border (see-through pixels always are background)
    const border = [];
    for (let x = 0; x < w; x++) { border.push(x); if (h > 1) border.push((h - 1) * w + x); }
    for (let y = 1; y < h - 1; y++) { border.push(y * w); if (w > 1) border.push(y * w + w - 1); }
    const bins = new Map();
    for (const i of border) { const p = px(i); if (p[3] < 128) continue; const k = (p[0] >> 5) << 6 | (p[1] >> 5) << 3 | (p[2] >> 5); const b = bins.get(k) || { n: 0, r: 0, g: 0, b: 0 }; b.n++; b.r += p[0]; b.g += p[1]; b.b += p[2]; bins.set(k, b); }
    const bg = [...bins.values()].filter(b => b.n >= border.length * 0.06).map(b => [b.r / b.n, b.g / b.n, b.b / b.n]);
    const isBg = new Uint8Array(N), q = [], like = (i) => { const p = px(i); return p[3] < 128 || bg.some(c => dist(p, c) < 26); };
    for (const i of border) if (!isBg[i] && like(i)) { isBg[i] = 1; q.push(i); }
    while (q.length) { const i = q.pop(), x = i % w, y = (i / w) | 0; for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) if (j >= 0 && !isBg[j] && like(j)) { isBg[j] = 1; q.push(j); } }
    let fg = 0; for (let i = 0; i < N; i++) if (!isBg[i]) fg++;
    // nothing stands out (the photo is filled by what it shows): all of it counts
    const cut = fg > N * 0.04 && fg < N * 0.97, mask = new Uint8Array(N);
    for (let i = 0; i < N; i++) mask[i] = cut ? 1 - isBg[i] : (d[i * 4 + 3] >= 128 ? 1 : 0);
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return { ok: false };
    // the colours of a band of rows: the biggest group of similar colours (colourful ones count more when asked)
    const colorIn = (ya, yb, colourful) => {
      const m = new Map();
      for (let y = Math.floor(y0 + (y1 - y0) * ya); y <= Math.ceil(y0 + (y1 - y0) * yb); y++) for (let x = x0; x <= x1; x++) {
        const i = y * w + x; if (!mask[i]) continue; const p = px(i), mx = Math.max(p[0], p[1], p[2]), mn = Math.min(p[0], p[1], p[2]);
        if (colourful !== 2 && mx < 40) continue;   // dark windows, shadows
        const k = (p[0] >> 5) << 6 | (p[1] >> 5) << 3 | (p[2] >> 5), b = m.get(k) || { n: 0, r: 0, g: 0, b: 0, s: 0 };
        b.n++; b.r += p[0]; b.g += p[1]; b.b += p[2]; b.s += mx ? (mx - mn) / mx : 0; m.set(k, b);
      }
      let best = null, bs = -1;
      for (const b of m.values()) { const sc = b.n * (colourful === 1 ? 0.25 + b.s / b.n : 1); if (sc > bs) { bs = sc; best = b; } }
      return best ? hexOf(best.r / best.n, best.g / best.n, best.b / best.n) : null;
    };
    return { ok: true, w, h, d, mask, box: [x0, y0, x1, y1], cut, aspect: (y1 - y0 + 1) / (x1 - x0 + 1), top: colorIn(0, 0.3, 0), mid: colorIn(0.4, 0.85, 0), main: colorIn(0, 1, 1) };
  };
  // a photo of anything else → a rounded relief in its colours (the outline from the photo, thicker in the middle)
  B.relief = function (ph, S, raw) {
    const [x0, y0, x1, y1] = ph.box, bw = x1 - x0 + 1, bh = y1 - y0 + 1, big = Math.max(bw, bh), T = Math.min(S, 96);
    const gw = Math.max(1, Math.round(bw * T / big)), gh = Math.max(1, Math.round(bh * T / big)), w = ph.w, d = ph.d;
    const cells = new Array(gw * gh).fill(null);
    for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
      const sx0 = x0 + Math.floor(gx * bw / gw), sx1 = x0 + Math.max(Math.floor(gx * bw / gw), Math.ceil((gx + 1) * bw / gw) - 1), sy0 = y0 + Math.floor(gy * bh / gh), sy1 = y0 + Math.max(Math.floor(gy * bh / gh), Math.ceil((gy + 1) * bh / gh) - 1);
      let n = 0, all = 0, r = 0, g = 0, b = 0;
      for (let y = sy0; y <= sy1; y++) for (let x = sx0; x <= sx1; x++) { all++; const i = y * w + x; if (!ph.mask[i]) continue; n++; r += d[i * 4]; g += d[i * 4 + 1]; b += d[i * 4 + 2]; }
      if (n * 2 >= all && n) cells[gy * gw + gx] = [r / n, g / n, b / n];
    }
    // at most 40 colours (each becomes the block nearest to it)
    const cnt = new Map();
    for (const c of cells) if (c) { const k = (c[0] >> 4) << 8 | (c[1] >> 4) << 4 | (c[2] >> 4); const e = cnt.get(k) || { n: 0, r: 0, g: 0, b: 0 }; e.n++; e.r += c[0]; e.g += c[1]; e.b += c[2]; cnt.set(k, e); }
    const top = [...cnt.values()].sort((a, b) => b.n - a.n).slice(0, 40).map(e => [e.r / e.n, e.g / e.n, e.b / e.n]);
    if (!top.length) throw { code: 'image_rejected' };
    const near = (c) => { let bi = 0, bd = Infinity; top.forEach((t, i) => { const dd = (t[0] - c[0]) ** 2 * 2 + (t[1] - c[1]) ** 2 * 4 + (t[2] - c[2]) ** 2 * 3; if (dd < bd) { bd = dd; bi = i; } }); return bi + 1; };
    const idx = cells.map(c => (c ? near(c) : 0)), dmax = clamp(Math.round(Math.min(gw, gh) * 0.16), 1, 8);
    const part = reliefPart(gw, gh, (x, y) => idx[y * gw + x], top.map(t => hexOf(t[0], t[1], t[2])), dmax, false);
    const name = (givenName(raw) || 'Foto-Modell').slice(0, 40);
    return { kind: 'model', model: { size: [gw, gh, 2 * dmax + 1], parts: [part], fit: Math.max(gw, gh, 2 * dmax + 1), name }, name, notes: 'Aus deinem Foto, mit runden Kanten. Schreib dazu, was es ist (z. B. „Auto“ oder „Haus“) — dann baue ich es richtig.', photo: true };
  };

  // ---------------------------------------------------------------- helpers for the place planner
  // does the wish want this? the last mention decides ("mit Kirche, …, ohne Kirche" → false); null: not mentioned
  B.wants = function (n, stems) {
    const re = Array.isArray(stems) ? stemRe(stems) : stems, toks = n.split(' ');
    let st = null; for (const [i] of hits(n, re)) st = !negated(toks, i);
    return st;
  };
  B.numBefore = function (n, stems) {
    const re = stemRe(stems), toks = n.split(' ');
    for (const [i] of hits(n, re)) for (const j of [i - 1, i - 2]) { const v = j >= 0 ? numOf(toks[j]) : null; if (v) return v; }
    return null;
  };
  // what the words say about houses (only what they say): style, roof and wall colours, materials, roof shape
  B.houseHints = function (n) {
    const D = HK().normalize(HK().DEFAULT), { spec } = houseWords(n, n, D, null, null), out = {};
    if (spec.style !== D.style) out.style = spec.style;
    if (spec.roof.color !== D.roof.color) out.roofColor = spec.roof.color;
    if (spec.roof.type !== D.roof.type) out.roofType = spec.roof.type;
    if (spec.walls.color !== D.walls.color) out.wallColor = spec.walls.color;
    if (spec.walls.material !== D.walls.material) out.wallMaterial = spec.walls.material;
    return out;
  };

  // ================================================================ the pipeline
  // ---------------------------------------------------------------- a recipe → shapes
  // recipe: {type, colors: {slot: '#hex'}, feats: {feature: true|false}, size: longest side, count, name}
  const moved = (p, d) => {
    const q = Object.assign({}, p);
    for (const k of ['box', 'wedge', 'line']) if (p[k]) q[k] = [p[k][0] + d[0], p[k][1] + d[1], p[k][2] + d[2], p[k][3] + d[0], p[k][4] + d[1], p[k][5] + d[2]];
    for (const k of ['cyl', 'ball', 'cone']) if (p[k]) q[k] = [p[k][0] + d[0], p[k][1] + d[1], p[k][2] + d[2]].concat(p[k].slice(3));
    if (p.relief) { const a = p.relief.at || [0, 0, 0]; q.relief = Object.assign({}, p.relief, { at: [a[0] + d[0], a[1] + d[1], a[2] + d[2]] }); }
    if (p.clip) q.clip = [p.clip[0] + d[0], p.clip[1] + d[1], p.clip[2] + d[2], p.clip[3] + d[0], p.clip[4] + d[1], p.clip[5] + d[2]];
    return q;
  };
  // mirrored parts → the part and its twin (copies side by side each stay symmetric on their own)
  function unmirror(parts, sizeX) {
    const mx = (x) => sizeX - 1 - x, out = [];
    for (const p of parts) {
      if (!p.mirror) { out.push(p); continue; }
      const a = Object.assign({}, p); delete a.mirror; out.push(a);
      const q = Object.assign({}, a), ax = String(p.axis || 'y');
      if (p.box) q.box = [mx(p.box[3]), p.box[1], p.box[2], mx(p.box[0]), p.box[4], p.box[5]];
      else if (p.wedge) { q.wedge = [mx(p.wedge[3]), p.wedge[1], p.wedge[2], mx(p.wedge[0]), p.wedge[4], p.wedge[5]]; q.down = p.down === '+x' ? '-x' : p.down === '-x' ? '+x' : p.down; }
      else if (p.line) q.line = [mx(p.line[0]), p.line[1], p.line[2], mx(p.line[3]), p.line[4], p.line[5]];
      else if (p.ball) q.ball = [mx(p.ball[0])].concat(p.ball.slice(1));
      else if (p.cyl) q.cyl = [ax.includes('x') ? mx(p.cyl[0]) - (Math.max(1, Math.round(p.cyl[4])) - 1) : mx(p.cyl[0])].concat(p.cyl.slice(1));
      else if (p.cone) { q.cone = [mx(p.cone[0])].concat(p.cone.slice(1)); if (ax.includes('x')) q.axis = ax[0] === '-' ? 'x' : '-x'; }
      if (p.clip) q.clip = [mx(p.clip[3]), p.clip[1], p.clip[2], mx(p.clip[0]), p.clip[4], p.clip[5]];
      out.push(q);
    }
    return out;
  }
  B.lib = (id) => LIB.find(d => d.id === id) || null;
  const mainOf = (T) => T.main || Object.keys(T.slots)[0];
  // the colours of a thing: its defaults, what its features change, what was asked; a slot written '=body' follows body
  function colorsOf(T, f, rc) {
    const c = {}, links = [];
    for (const k in T.slots) { const d = T.slots[k][0]; if (typeof d === 'string' && d[0] === '=') links.push([k, d.slice(1)]); else c[k] = d; }
    const fd = T.def ? T.def(f, rc) || {} : {};
    Object.assign(c, fd, rc.colors || {});
    for (const [k, from] of links) if (!(rc.colors && rc.colors[k]) && !(k in fd)) c[k] = c[from];
    return c;
  }
  const featsOf = (T, rc) => Object.assign({}, T.on || {}, rc.feats || {});
  // everything in one material, light and dark kept (a statue)
  function petrify(parts, base) {
    const lum = (h) => { const v = parseInt(String(h).slice(1), 16); return Number.isFinite(v) ? (0.299 * (v >> 16 & 255) + 0.587 * (v >> 8 & 255) + 0.114 * (v & 255)) / 255 : 0.6; };
    const metal = /^#(d4af37|c0c7cf|b87333|a0703a)$/i.test(base);
    return parts.map((p) => (p.color === AIR || p.mat === 'air' ? p : Object.assign({}, p, { color: shade(base, 0.72 + 0.45 * lum(p.color)), mat: metal ? 'metal' : 'stone' })));
  }
  const STATUE = /\b(statue|statuen|denkmal|skulptur|standbild|monument|sculpture|steinfigur|bronzefigur|goldfigur|aus stein|aus marmor|aus bronze|aus gold|versteinert\w*)\b/;
  B.buildModel = function (rc) {
    const T = B.lib(rc.type); if (!T) return null;
    const f = featsOf(T, rc), c = colorsOf(T, f, rc), sz = typeof T.size === 'function' ? T.size(f, rc) : T.size;
    let parts = T.build(c, f, rc) || [], size = sz.slice();
    if (T.id === 'statue' || (rc.statue && (T.cat === 'animal' || T.cat === 'figure'))) {
      parts = petrify(parts, c[mainOf(T)] && T.id === 'statue' ? c.body : (rc.colors && rc.colors[mainOf(T)]) || '#9c9a94');
      if (T.id !== 'statue') { parts.push(box(-1, -3, -1, sz[0], -1, sz[2], '#7d7a74', 'stone'), box(0, -1, 0, sz[0] - 1, -1, sz[2] - 1, '#8a8780', 'stone')); size = [sz[0] + 2, sz[1] + 3, sz[2] + 2]; }
    }
    const n = clamp(Math.round(rc.count || 1), 1, 6);
    if (n > 1) {
      const one = unmirror(parts, sz[0]), gap = Math.max(2, Math.round(sz[0] * 0.4)); parts = [];
      for (let i = 0; i < n; i++) for (const p of one) parts.push(moved(p, [i * (sz[0] + gap), 0, 0]));
      size = [sz[0] * n + gap * (n - 1), sz[1], sz[2]];
    }
    const S = clamp(Math.round(rc.size || 32), 6, 96);
    const fit = T.fitOf ? T.fitOf(S, size, f) : Math.round(S * Math.max(...size) / Math.max(...sz));
    return { size, parts, fit: Math.min(96, fit), name: rc.name || T.de };
  };
  const nounOf = (T, f) => (T.nameOf ? T.nameOf(f) : null) || [T.de, T.g];
  function modelResult(rc) {
    const T = B.lib(rc.type), f = featsOf(T, rc), c = colorsOf(T, f, rc), [noun, g] = nounOf(T, f);
    const st = rc.statue && (T.cat === 'animal' || T.cat === 'figure'), sc = st && rc.colors && rc.colors[mainOf(T)];
    const name = T.id === 'letters' ? '„' + String(rc.text || 'HALLO').slice(0, 24) + '“' : rc.own || (st ? noun + ' aus ' + (sc === '#d4af37' ? 'Gold' : sc === '#a0703a' || sc === '#b87333' ? 'Bronze' : sc === '#f4f4f2' || sc === '#f3ead2' ? 'Marmor' : sc === '#c0c7cf' ? 'Silber' : 'Stein') : rc.adj ? adjName(rc.adj, noun, g) : noun);
    rc.name = (rc.count > 1 ? rc.count + ' × ' : '') + name;
    const model = B.buildModel(rc);
    return { kind: 'model', model, recipe: rc, name: rc.name.slice(0, 40), notes: String((T.note ? T.note(c, f, rc) : '') || '').slice(0, 200) };
  }

  // ---------------------------------------------------------------- words → a recipe
  const SIZEUP = [[/\b(doppelt so gross|doppelt so hoch|twice as big|zweimal so gross)\b/, 2], [/\b(viel grosser|viel hoher|much bigger|way bigger|riesig|riesiger|riesengross|huge|giant)\b/, 1.7], [/\b(grosser|hoher|langer|bigger|larger|taller|longer|mehr gross|wachsen|wachse)\b/, 1.3],
    [/\b(halb so gross|half as big|half the size|halbieren)\b/, 0.5], [/\b(viel kleiner|much smaller|winzig|tiny)\b/, 0.55], [/\b(kleiner|niedriger|kurzer|smaller|shorter|lower)\b/, 0.77]];
  const sizeChange = (n) => { for (const [re, k] of SIZEUP) if (re.test(n)) return k; return 1; };
  function recipeWords(n, raw, T, at, rc, photo, editing) {
    const toks = n.split(' ');
    rc.type = T.id; rc.colors = rc.colors || {}; rc.feats = rc.feats || {};
    // features: "mit Leiter", "ohne Leiter", "Sportwagen"
    for (const k in T.featRe) for (const [i] of hits(n, T.featRe[k])) rc.feats[k] = !negated(toks, i);
    if (STATUE.test(n) && T.id !== 'statue') rc.statue = true;
    // colours: each to the part named next to it; a lone colour paints the main part, a second one the accent
    const targets = Object.keys(T.slotRe).filter(k => T.slotRe[k]).map(k => [k, T.slotRe[k]]);
    const { bound, free } = bindColors(toks, B.colors(n), targets), main = mainOf(T);
    for (const k in bound) { const slot = k.replace(/2$/, ''); if (T.slots[slot] && !(k !== slot && bound[slot])) rc.colors[slot] = bound[k].hex; }
    if (bound[main]) rc.adj = bound[main];
    if (free[0] && !bound[main]) { rc.colors[main] = free[0].hex; rc.adj = free[0]; }
    const alt = T.alt || null;
    if (free[1] && alt && !bound[alt]) { rc.colors[alt] = free[1].hex; if (T.altFeat) rc.feats[T.altFeat] = true; }
    // a photo: its main colour for the main part, unless the words chose one
    if (photo && photo.ok && photo.main && !bound[main] && !free[0] && !editing) rc.colors[main] = photo.main;
    // how many: "drei Bäume", "2 Autos"
    if (at >= 0) for (const j of [at - 1, at - 2]) { const v = j >= 0 ? numOf(toks[j]) : null; if (v && v > 1) { rc.count = clamp(v, 1, 6); break; } }
    // how big
    if (editing) { const k = sizeChange(n); if (k !== 1) rc.size = clamp(Math.round(rc.size * k), 8, 96); }
    else { const k = sizeWord(n); if (k !== 1) rc.size = clamp(Math.round(rc.size * k), 8, 96); }
    if (T.id === 'letters') { const t = B.textOf(raw); if (t) rc.text = t; else if (!rc.text) rc.text = 'HALLO'; }
    else { const own = givenName(raw); if (own) rc.own = own.slice(0, 40); }
    return rc;
  }
  function modelFrom(n, raw, hit, S, photo, carry) {
    const T = hit.T, rc = { type: T.id, colors: {}, feats: {}, size: S, count: 1 };
    if (carry) { const m0 = carry.main; if (m0 && T.slots[mainOf(T)]) rc.colors[mainOf(T)] = m0; if (carry.adj) rc.adj = carry.adj; rc.size = carry.size || S; }
    return modelResult(recipeWords(n, raw, T, hit.i, rc, photo, false));
  }

  // ---------------------------------------------------------------- which thing the words mean
  B.pick = function (n) {
    const h = B.houseKind(n);
    let m = null;
    for (const T of LIB) for (const [i, len, , st] of hits(n, T.re)) if (!m || i < m.i || (i === m.i && (st > m.st || (st === m.st && len > m.len)))) m = { T, i, len, st };
    if (h && (!m || h.i < m.i || (h.i === m.i && (h.st > m.st || (h.st === m.st && h.len >= m.len))))) return { house: h };
    return m ? { model: m } : null;
  };
  B.choose = function (n) {
    const pk = B.pick(n);
    if (pk && pk.model) { const tok = n.split(' ')[pk.model.i] || ''; if (tok.length - pk.model.st >= 4) { const fz = B.fuzzy(n); if (fz && fz.fuzzy && fz.fuzzy.meant.length > pk.model.st + 2) return fz; } }
    return pk || B.fuzzy(n);
  };
  // typos: "Feuerwerauto", "Leuchturm", "Drachen" — the closest known word, when it is close enough
  function dist(a, b, lim) {
    if (Math.abs(a.length - b.length) > lim) return lim + 1;
    let p2 = null, p = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const c = [i]; let best = i;
      for (let j = 1; j <= b.length; j++) {
        let v = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (p2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, p2[j - 2] + 1);
        c.push(v); if (v < best) best = v;
      }
      if (best > lim) return lim + 1;
      p2 = p; p = c;
    }
    return p[b.length];
  }
  let VOCAB = null;
  function vocab() {
    if (VOCAB) return VOCAB;
    VOCAB = [];
    for (const T of LIB) for (const w of T.words) { const x = w.replace(/^=/, ''); if (/^[a-z]{4,}$/.test(x)) VOCAB.push([x, T.words[0].replace(/^=/, '')]); }
    for (const H of HOUSES) for (const w of H.stems) { const x = w.replace(/^=/, ''); if (/^[a-z]{4,}$/.test(x)) VOCAB.push([x, H.stems[0].replace(/^=/, '')]); }
    return VOCAB;
  }
  const FILLER = /^(bitte|baue|bau|baut|bauen|mach|mache|machen|macht|erstell\w*|zeichne\w*|ich|mir|mich|will|mochte|hatte|gern|gerne|haben|habe|soll|sollte|ganz|sehr|einen|einem|einer|eines|eine|ein|der|die|das|den|dem|des|und|oder|mit|ohne|aus|auf|fur|von|vom|zum|zur|nach|neben|vor|hinter|unter|uber|wie|aber|auch|noch|nur|mal|doch|this|that|build|make|please|with|without|the|and|from|for|some|want|like|would|could|neu|neue|neues|neuer|schon|schones|schoner|schone|toll\w*|cool\w*|super|richtig|echt\w*|klein\w*|gross\w*|riesig\w*|winzig\w*|mittel\w*|hoch|hohe\w*|lang\w*|kurz\w*|breit\w*|dick\w*|dunn\w*|bunt\w*|farbig\w*|alt\w*|modern\w*|danke|hallo|hi|hey)$/;
  B.fuzzy = function (n) {
    const toks = n.split(' ').filter(t => t.length >= 4 && !FILLER.test(t) && !numOf(t) && !B.colors(t).length);
    let best = null;
    for (const t of toks) for (const [w, key] of vocab()) {
      if (t.length < 5 || w[0] !== t[0]) continue;
      const lim = t.length < 8 ? 1 : 2, d = dist(t, w, lim);
      if (d <= lim && (!best || d < best.d || (d === best.d && w.length > best.w.length))) best = { d, w, key, t };
    }
    if (!best) return null;
    const pk = B.pick(B.norm(best.w)); if (pk) pk.fuzzy = { said: best.t, meant: best.w };
    return pk;
  };

  // ---------------------------------------------------------------- what to offer when it is not known
  const GROUPS = [
    [/\b(tier|tiere|tieren|animal|animals|haustier\w*|zoo|wildtier\w*|vieh)\b/, ['dog', 'cat', 'horse', 'unicorn', 'elephant', 'giraffe', 'penguin', 'dragon']],
    [/\b(fahrzeug\w*|vehicle\w*|fahren|verkehr|strasse)\b/, ['car', 'firetruck', 'bus', 'tractor', 'digger', 'train', 'motorbike', 'truck']],
    [/\b(wasser|meer|see|ozean|hafen|ocean|sea|boot\w*|schiff\w*)\b/, ['sailboat', 'pirate', 'ship', 'submarine', 'lighthouse', 'whale', 'boat', 'cruise']],
    [/\b(pflanze\w*|natur|garten|wald|plant\w*|nature|forest|wiese)\b/, ['tree', 'pine', 'palm', 'flower', 'mushroom', 'cactus', 'bush', 'rock']],
    [/\b(figur\w*|person\w*|mensch\w*|held\w*|charakter\w*|character\w*|leute|people|freund\w*)\b/, ['person', 'knight', 'king', 'astronaut', 'robot', 'wizard', 'pirate_man', 'snowman']],
    [/\b(essen|food|lecker|suss\w*|snack\w*|nachtisch|dessert|kuchen)\b/, ['cake', 'icecream', 'burger', 'donut', 'pizza', 'apple']],
    [/\b(gebaude|building|bauwerk|wahrzeichen|landmark|denkmal|sehenswurdig\w*)\b/, ['lighthouse', 'castle', 'church', 'windmill', 'tower', 'bridge', 'fountain', 'pyramid']],
  ];
  const STARTERS = ['firetruck', 'lighthouse', 'dragon', 'pirate', 'unicorn', 'tree', 'castle', 'rocket', 'sailboat', 'robot', 'windmill', 'car', 'elephant', 'snowman'];
  B.suggest = function (n) {
    let ids = null;
    for (const [re, list] of GROUPS) if (re.test(n || '')) { ids = list; break; }
    if (!ids) { let h = 0; for (const ch of String(n || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0; ids = STARTERS.slice(h % STARTERS.length).concat(STARTERS.slice(0, h % STARTERS.length)); }
    const out = ids.map(id => B.lib(id)).filter(Boolean).slice(0, 6).map(T => T.de);
    if (!/(tier|fahrzeug|pflanze|figur|essen)/.test(n || '')) out.push('Villa mit Pool');
    return out;
  };
  // the word that was not understood (for "„X“ kenne ich noch nicht")
  function unknownWord(n, raw) {
    const toks = n.split(' ').filter(t => t.length >= 3 && !FILLER.test(t) && !numOf(t) && !B.colors(t).length && t !== ',');
    if (!toks.length) return String(raw || '').trim().slice(0, 30);
    const t = toks.sort((a, b) => b.length - a.length)[0], m = new RegExp('\\b' + t.split('').join('[\\wäöüß]?'), 'i').exec(raw || '');
    return (m ? String(raw).slice(m.index).split(/[\s,.;!?]/)[0] : t).slice(0, 30);
  }

  // ---------------------------------------------------------------- changes to what is there
  const HOUSEPART = /\b(dach\w*|wand|wande|fassade\w*|fenster\w*|tur|turen|haustur|etage\w*|stock\w*|geschoss\w*|stockwerk\w*|kamin|schornstein|balkon\w*|garage\w*|terrasse\w*|zaun|saule\w*|gaube\w*|pool|garten|veranda|vordach|solar\w*|zimmer|raume|roof|walls?|windows?|doors?|floors?|chimney|balcony|garden|fence|shutters?|laden|fensterladen|ziegel\w*|holz\w*|stein\w*|putz|fachwerk|modern\w*|klassisch\w*|rustikal\w*|breiter|tiefer|schmaler)\b/;
  const NEWTHING = /\b(daraus|stattdessen|lieber|instead|verwandl\w*|verwandel\w*|wandle|wandel|turn it into|make it a|mach\w* (es|das|ihn|sie|daraus) (zu|zum|zur|ein|eine|einen)|soll ein\w* .* werden|soll (zu|zum|zur) .* werden)\b/;
  B.houseTouch = (n) => HOUSEPART.test(n);
  function editOf(n, raw, base, S, photo) {
    const pk = n ? B.pick(n) : null;
    if (base.kind === 'house') {
      const spec = base.spec || base;
      if (pk && pk.model && (NEWTHING.test(n) || !HOUSEPART.test(n))) return modelFrom(n, raw, pk.model, S, photo, null);
      if (!n && !(photo && photo.ok)) return null;
      const r = B.house(raw, HK().normalize(spec), photo);
      if (JSON.stringify(r.spec) !== JSON.stringify(HK().normalize(spec))) return r;
      const fz = B.fuzzy(n); if (fz && fz.model) return modelFrom(n, raw, fz.model, S, photo, null);
      return null;
    }
    const rc0 = base.recipe && B.lib(base.recipe.type) ? base.recipe : null, T0 = rc0 && B.lib(rc0.type);
    const carry = rc0 ? { main: rc0.colors && rc0.colors[mainOf(T0)], adj: rc0.adj, size: rc0.size } : null;
    if (pk && pk.house && (NEWTHING.test(n) || !rc0 || pk.house.H.id !== 'cottage' || /\b(haus|house|gebaude|building)\b/.test(n))) return B.house(raw, null, photo);
    if (pk && pk.model && (!rc0 || pk.model.T.id !== rc0.type)) return modelFrom(n, raw, pk.model, S, photo, carry);
    if (rc0) {
      const before = JSON.stringify(rc0), rc = JSON.parse(before);
      recipeWords(n, raw, T0, -1, rc, photo, true);
      // "noch einer" / "nur einer": how many
      if (/\b(noch (ein|eine|einer|eins|einen)|one more|another)\b/.test(n)) rc.count = clamp((rc.count || 1) + 1, 1, 6);
      if (/\b(nur (ein|eine|einer|eins|einen)|just one|only one)\b/.test(n)) rc.count = 1;
      if (JSON.stringify(rc) !== before) return modelResult(rc);
      const fz = B.fuzzy(n); if (fz && fz.model && fz.model.T.id !== rc0.type) return modelFrom(n, raw, fz.model, S, photo, carry);
      if (fz && fz.house) return B.house(raw, null, photo);
      return null;
    }
    // something without a recipe (a photo model, or made before): it can still grow and shrink
    const k = sizeChange(n);
    if (k !== 1 && base.model) { const fit = clamp(Math.round((base.model.fit || S) * k), 8, 96); return Object.assign({}, base, { model: Object.assign({}, base.model, { fit }), notes: base.notes }); }
    const fz = B.fuzzy(n); if (fz && fz.model) return modelFrom(n, raw, fz.model, S, photo, null);
    return null;
  }

  // ---------------------------------------------------------------- one wish
  // design({text, image (a canvas), size, base (the design to change), want: 'house'}) → the design, or throws
  // {code: 'empty' | 'unknown' | 'nochange' | 'image_rejected', word, suggestions}
  B.design = function (req) {
    req = req || {};
    const raw = String(req.text || '').slice(0, 2000), n = B.norm(raw);
    const S = clamp(Math.round(+req.size || 32), 8, 96);
    const photo = req.photo || (req.image ? B.photo(req.image) : null);
    if (!n && !(photo && photo.ok)) throw { code: req.image ? 'image_rejected' : 'empty' };
    if (req.base) {
      const r = editOf(n, raw, req.base, S, photo); if (r) return r;
      if (!(photo && photo.ok)) throw { code: 'nochange', suggestions: req.base.kind === 'house' ? ['Dach blau', 'drei Etagen', 'mit Pool', 'ohne Kamin', 'größer'] : (B.lib(req.base.recipe && req.base.recipe.type) ? hintsFor(B.lib(req.base.recipe.type)) : ['größer', 'kleiner']) };
    }
    const pk = n ? B.choose(n) : null;
    if (req.want === 'house' && !(pk && pk.model)) return B.house(raw, null, photo);
    if (pk && pk.house) return B.house(raw, null, photo);
    if (pk && pk.model) { const r = modelFrom(n, raw, pk.model, S, photo, null); if (pk.fuzzy) r.fuzzy = pk.fuzzy; return r; }
    if (photo && photo.ok) return B.relief(photo, S, raw);
    if (n && HOUSEPART.test(n)) return B.house(raw, null, photo);
    throw { code: 'unknown', word: unknownWord(n, raw), suggestions: B.suggest(n) };
  };
  // what can be changed on a thing: a few of its parts and features, as ready-made wishes
  function hintsFor(T) {
    const out = [];
    const slots = Object.keys(T.slots), cols = ['rot', 'blau', 'grün', 'gelb', 'schwarz', 'weiß'];
    for (let i = 0; i < slots.length && out.length < 2; i++) { const re = T.slots[slots[i]][1]; if (!re) continue; const w = re.split('|')[0]; out.push(w[0].toUpperCase() + w.slice(1) + ' ' + cols[(i * 2 + 1) % cols.length]); }
    for (const k in (T.feats || {})) { const w = T.feats[k][0].replace(/^=/, ''); out.push(((T.on || {})[k] ? 'ohne ' : 'mit ') + w[0].toUpperCase() + w.slice(1)); if (out.length >= 4) break; }
    out.push('größer');
    return out;
  }
  B.hintsFor = (id) => (B.lib(id) ? hintsFor(B.lib(id)) : []);
})();
