// ============================================================================
// n-names · VR.Names — the one table of the game's names (docs/design/names.md, the naming bible; plan
// docs/superpowers/plans/2026-10-31-n-names.md; test/names.js §6). Main thread and workers.
//   RENAME        display renames (old word → new word, per language): VR.I18N applies them to every table value when
//                 a table is added and to the fallback texts of tx()/t() — ids, keys and saves never change
//   PEOPLES       one sound per people: Herzwelt's folk (hand lists, German first) and the five native peoples
//                 (syllables; endings for grown-ups, children, elders; family and place endings)
//   pool(kind)    { first, kids, elders, sur } — the names a village of that people gives (cached; ≥ 200 full names)
//   place(kind, seed, n)  a native village's or town's name in its people's tongue
//   village(seed) a Herzwelt village's name (German compounds: Lindenau, Rosenbrunn …), the same in both languages
//   star(seed)    a soft star name (4–11 letters)
//   blocked(w)    fiction, brands, famous characters and rude words (German and English): never generated
//   reserved(w)   the story's, the sky's and the peoples' own names: never given to a villager, a pet or a star
// Everything here is our own: syllables we chose, words of the German language; each hand-picked name was searched
// (test/names.js lists the searches).
// ============================================================================
(function (VR) {
  'use strict';
  const N = VR.Names = {};
  const h01 = (a, b, c) => { let h = Math.imul((a | 0) ^ 0x3c6ef372, 0x297a2d39) ^ Math.imul((b | 0) + 0x632be5ab, 0x85ebca6b) ^ Math.imul((c | 0) + 0x1b873593, 0xc2b2ae35); h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15; return (h >>> 0) / 4294967296; };
  const pick = (L, seed, i, salt) => L[Math.floor(h01(seed, i, salt) * L.length)];
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  // ---------------------------------------------------------------- the renames (display only)
  // [regex, new] per language, applied in this order. The ids stay (amarant, zinn, opal, the keys g.eco.sp.*).
  N.RENAME = {
    // (f-polish6, R56-14: the trailer's city — the first name a new player reads — German in a German HUD; English keeps it)
    de: [[/\bAmarant(?!h)/g, 'Turmalin'], [/\bGlutani/g, 'Glimari'], [/\bNivari/g, 'Isveli'], [/\bNova Haven\b/g, 'Palmenhafen']],
    en: [[/\bAmaranth\b/g, 'Tourmaline'], [/\bAmarant(?!h)/g, 'Tourmaline'], [/\bGlutani/g, 'Glimari'], [/\bNivari/g, 'Isveli']],
  };
  const ANY = /\bAmarant|\bGlutani|\bNivari|\bNova Haven\b/;
  N.fixText = function (lang, s) {
    if (typeof s !== 'string' || !ANY.test(s)) return s;
    for (const [re, to] of (N.RENAME[lang] || N.RENAME.en)) s = s.replace(re, to);
    return s;
  };
  // a name shown as it is stored (a village's site name, a place label): in the language of the moment
  N.shown = function (s, lang) {
    if (typeof s !== 'string' || !ANY.test(s)) return s;
    const I = VR.I18N; return N.fixText(lang || (I && I.lang === 'de' ? 'de' : 'en'), s);
  };
  N.fixTable = function (lang, table) {
    for (const k in table) {
      const v = table[k];
      if (typeof v === 'string') { if (ANY.test(v)) table[k] = N.fixText(lang, v); }
      else if (Array.isArray(v)) for (let i = 0; i < v.length; i++) if (typeof v[i] === 'string' && ANY.test(v[i])) v[i] = N.fixText(lang, v[i]);
    }
    return table;
  };

  // ---------------------------------------------------------------- what is never generated
  // whole-word: famous characters of films, series, games and books, brands; (the star list of galaxy.js adds the
  // bright stars and the fictional worlds)
  const EXACT = ('nemo dory paul elsa anna olaf ariel simba nala moana maui merida belle aurora jasmine mulan rapunzel bambi dumbo ' +
    'stitch lilo wall eve buzz woody yoda luke leia han rey finn poe kylo vader frodo sam bilbo gandalf arwen legolas harry ron ' +
    'hermine hermione dobby link zelda mario luigi peach yoshi toad sonic tails pikachu eevee ash misty brock kirby samus lara ' +
    'geralt ciri aloy kratos sora riku cloud tifa aerith zidane garnet vivi eiko quina freya steiner leon ada chell glados shrek ' +
    'fiona momo ronja pippi michel emil karlsson heidi maja willi flip pumuckl urmel jim lukas nils alfons benjamin bibi tina elmo ' +
    'ernie bert grobi oscar kermit piggy gonzo barbie ken lego haribo milka nutella kinder duplo pixar disney marvel thor loki hulk ' +
    'groot rocket gamora drax thanos vision wanda natasha tony steve bucky peter miles gwen bruce clark diana barry batman joker ' +
    'robin alfred lois lana kara zod nova vega tesla apple google amazon alexa siri cortana halo pac steam valve sega atari nike ' +
    'adidas puma audi opel bmw mini fanta sprite kia seat skoda dacia lada volvo saab ikea aldi lidl rewe edeka osram bosch miele ' +
    'braun nivea tempo tesa uhu persil lenor dove axe canon nikon sony asus acer dell otto lyra arya sansa bran jon tyrion khal ' +
    'aang katara sokka zuko toph korra naruto sasuke goku vegeta totoro kiki chihiro haku ponyo luna neville draco severus albus ' +
    'sirius remus tonks pumba timon rafiki zazu scar kovu kiara sven kristoff hans tiana mowgli baloo bagheera kaa raya sisu ' +
    'mirabel bruno lotte lotti fiete pelle thea bendix wolfram hedwig moritz till linus wilma smilla hanni nanni krümel puck ' +
    'kalle pauli nuki kuddel wuschel knopf hummel pusteblume rosenheim rosenthal silbersee sternberg amarant amaranth glutani ' +
    'zippel purzel fussel wispel hörbe hoerbe nivari nivarian sylvari ussr seven eleven sesy kira light ryuk dune mars luna terra gaia sol eden zeus hera odin').split(' ');
  // inside any longer word: rude or cruel words in German and English, and a few names that must never show through
  const SUB = ['nazi', 'hitler', 'sex', 'fuck', 'shit', 'fick', 'hure', 'nutte', 'kack', 'scheis', 'piss', 'penis', 'porn', 'mord',
    'kill', 'satan', 'teufel', 'bitch', 'cock', 'dick', 'fotze', 'spast', 'ussr', 'isis', 'kkk', 'arsch', 'dumm', 'doof', 'blöd',
    'kotz', 'sau', 'tod', 'tot', 'mist', 'pups', 'furz', 'ass', 'gay', 'neger', 'pipi', 'popo', 'kaka', 'pupu', 'homo', 'mami', 'papi', 'mama', 'papa', 'baby', 'oma', 'opa', 'jude', 'hass', 'nigg', 'krieg', 'gift', 'blut',
    'kot', 'cum', 'tit', 'anal', 'slut', 'whore', 'rape', 'hell', 'damn', 'god', 'gott', 'jesus', 'allah', 'pimp', 'drug', 'koks',
    'amarant', 'glutan', 'nivar'];
  const EX = new Set(EXACT), SUBRE = new RegExp(SUB.join('|'));
  N.blocked = function (w) {
    const l = String(w).toLowerCase();
    if (EX.has(l) || SUBRE.test(l)) return true;
    return !!(VR.Galaxy && VR.Galaxy.blocked && VR.Galaxy.blocked(w));
  };
  // the game's own names (the story's speakers, the sky, the peoples, the places of the story, the outposts)
  const RES = new Set(('funke lumi ilka oskar selma jonte anselm solgani ariveli selkatun dumarin ylosenis flimmi echo helia ' +
    'herzwelt heartworld turmalin tourmaline aquamarin aquamarine zinnober cinnabar opal basalt ocker ochre bernstein amber ' +
    'cölestin celestine wellari dunelin glimari regoli isveli weißstadt heliataler sternglut ringstation spaltmond glutsee ' +
    'rostschlucht nordwiese kupferhang sternwiese frühlicht silbergrat funkenfeld weitblick glimmerhöhe abendtau wolkenrast ' +
    'lichtung steinbogen bernsteinkamm himmelsau westhain taufeld rosenschleier glutwiege türkisherz lichtwiege ' +
    'flausel tüpfel zwirbel dusel silbrin flöckchen borke mohnbühl lerchenbühl sonnenhof kleehof lindenhof mohnhof hallklamm morgenhain').split(' '));
  N.reserved = (w) => RES.has(String(w).toLowerCase());
  const ok = (w) => w.length >= 2 && !N.blocked(w) && !N.reserved(w) && !/(.)\1\1/.test(w) && !/[^aeiouyäöü]{3}/.test(w.toLowerCase().replace(/^(sch|ch|th|sh)/, ''));

  // ---------------------------------------------------------------- the peoples
  // sound: what the names should feel like (the naming bible tells each people's story)
  N.PEOPLES = {
    // Herzwelt: the trailer's folk. German first, fairy-tale and old-fashioned, short and easy; the families are named
    // after the land round their houses (nature compounds); children go by their pet names, elders by the old names
    herz: {
      de: 'Herzweltler', en: 'Heartworlders', sound: 'warm, homely German: Greta Lindenblatt, Hannes Moosbach',
      first: ['Alma', 'Anton', 'Arvid', 'Benno', 'Berta', 'Birte', 'Carla', 'Dora', 'Edda', 'Emmi', 'Enno', 'Fenja', 'Finja',
        'Frida', 'Frido', 'Fritz', 'Gesa', 'Greta', 'Gustav', 'Hanne', 'Hannes', 'Hauke', 'Henni', 'Henrik', 'Hinnerk', 'Ida',
        'Imke', 'Jakob', 'Janne', 'Jannis', 'Johanna', 'Joris', 'Juna', 'Karl', 'Kasimir', 'Konrad', 'Lorin', 'Lene', 'Leopold',
        'Liesel', 'Lisbeth', 'Lorenz', 'Malin', 'Marta', 'Mats', 'Matti', 'Merle', 'Mila', 'Minna', 'Nele', 'Niklas', 'Ole', 'Paula',
        'Quirin', 'Rieke', 'Romy', 'Ruben', 'Svea', 'Tilda', 'Tjark', 'Torben', 'Ulla', 'Valentin', 'Veit', 'Wendelin', 'Wiebke',
        'Xaver', 'Annik', 'Jorinde', 'Hedda'],
      kids: ['Bo', 'Bommel', 'Fine', 'Fips', 'Floh', 'Fritzi', 'Hannchen', 'Jule', 'Juli', 'Lenchen', 'Lillo', 'Lu', 'Ludi',
        'Matz', 'Mieke', 'Mimi', 'Mo', 'Paule', 'Pips', 'Sternchen', 'Tilli', 'Tobi', 'Tupfi', 'Wichtel', 'Wim', 'Zippi', 'Ebbi',
        'Nelli', 'Kerlchen', 'Mausi'],
      elders: ['Adalbert', 'Adelheid', 'Amalie', 'Bertram', 'Eberhard', 'Friedhelm', 'Gisela', 'Gerhild', 'Gebhard', 'Hildegard',
        'Hubertus', 'Ingeborg', 'Irmgard', 'Kunigunde', 'Leberecht', 'Luitpold', 'Mechthild', 'Ottilie', 'Philippa', 'Reinhold',
        'Rosemarie', 'Theodora', 'Ulrich', 'Vinzenz', 'Waltraud', 'Wendula', 'Wilhelmine', 'Notburga'],
      sur: ['Apfelgrün', 'Birkenhain', 'Brombeer', 'Distelfink', 'Eichenlaub', 'Eschenhain', 'Fliederbusch', 'Glockenblum',
        'Goldammer', 'Hagebutt', 'Haselnuss', 'Heckenrose', 'Holunder', 'Honigtau', 'Kirschbaum', 'Kleeblatt', 'Lerchenfeld',
        'Lindenblatt', 'Mohnfeld', 'Moosbach', 'Morgentau', 'Mühlbach', 'Nussbaum', 'Quellenhof', 'Rosenhag', 'Silberbach',
        'Sommerfeld', 'Sonnenkamp', 'Sonnentau', 'Tannenzapf', 'Wacholder', 'Weidenkorb', 'Weißdorn', 'Wiesengrund', 'Wolkenstein',
        'Zaunkönig', 'Ahornblatt', 'Blauberg', 'Steinbach', 'Ringelblum'],
    },
    // The five native peoples: a name is a head (A — every people has its own heads, so no two peoples share a name)
    // and a tail: B for the grown-ups, K for the children (short, sing-song), E for the elders (long, stately), F for
    // the families (the house's name), L for the places. Heads end in a vowel or a soft consonant, tails begin with a
    // consonant: every join is easy to say.
    // the Wellari of Aquamarin's islands: the sea's own people — soft, vowel-rich, like waves on sand (Liwen, Marel)
    aqua: {
      de: 'Wellari', en: 'Wellari', sound: 'soft and flowing: l m n w s and open vowels — waves on sand',
      A: ['Li', 'Ma', 'Ne', 'Wa', 'Sa', 'Mi', 'Lu', 'Na', 'Ise', 'Ari', 'Ela', 'Ori', 'Sha', 'The', 'Ve', 'Io'],
      B: ['wen', 'rel', 'lia', 'mar', 'sel', 'na', 'rin', 'lis', 'ruel', 'sa', 'mira', 'wa'],
      K: ['li', 'mi', 'lu', 'ni', 'po', 'wi'], E: ['mareth', 'veliar', 'thamar', 'meriel', 'sorine', 'lune', 'wanne', 'resa'],
      F: ['nami', 'rasel', 'loweth', 'marin', 'shalu', 'venor', 'wellin', 'sira'], L: ['mar', 'lune', 'wel', 'sela', 'thal', 'nore'],
    },
    // the Dunelin of Ocker's dunes: warm and earthy, round sounds, a slow walk under a red sky (Dumarin, Hobek)
    ocker: {
      de: 'Dunelin', en: 'Dunelin', sound: 'warm and earthy: d b m r k h and round a o u — footsteps on warm sand',
      A: ['Da', 'Du', 'Ba', 'Bo', 'Ka', 'Ko', 'Ru', 'Mu', 'Ra', 'Ha', 'Ho', 'Ta', 'Za', 'Om', 'Ur', 'Ame'],
      B: ['rin', 'mar', 'dun', 'bek', 'sim', 'hal', 'kar', 'tem', 'ra', 'nu', 'bo', 'rik'],
      K: ['bu', 'ko', 'mo', 'ti', 'pu', 'ki'], E: ['mirun', 'barak', 'hadem', 'oruk', 'kemar', 'sabir', 'tumar', 'dahar'],
      F: ['bekar', 'dunar', 'hadin', 'oshir', 'rumab', 'kesim', 'talun', 'barun'], L: ['kar', 'dun', 'mesa', 'barra', 'hum', 'tob'],
    },
    // the Glimari of Zinnober's sulfur plains (was Glutani): their crests glimmer like embers — bright, crackling,
    // quick (Fiora, Solven); after German „glimmen", to glow
    zinn: {
      de: 'Glimari', en: 'Glimari', sound: 'bright and crackling: f l r s t k and quick i a o — sparks over embers',
      A: ['Fi', 'Fa', 'Ri', 'So', 'Te', 'Va', 'Zi', 'Ar', 'Or', 'Gli', 'Fla', 'Ti', 'Pi', 'Sol', 'Kir', 'Tal'],
      B: ['ra', 'ven', 'kan', 'lis', 'ro', 'zar', 'fen', 'tari', 'lo', 'kai', 'vio', 'sen'],
      K: ['fi', 'ki', 'zi', 'pi', 'ti', 'pa'], E: ['ombar', 'varis', 'elgor', 'riska', 'koran', 'tefar', 'sulvan', 'farion'],
      F: ['vash', 'korr', 'fell', 'rast', 'tix', 'renn', 'zarin', 'lohr'], L: ['flar', 'zor', 'kesh', 'rion', 'vel', 'fira'],
    },
    // the Regoli of Basalt's craters: they live in round domes under a black sky — deep, round, humming (Selkatun, Bomun)
    basalt: {
      de: 'Regoli', en: 'Regoli', sound: 'deep and round: m n g d b and o u — a hum inside a stone dome',
      A: ['Re', 'Ro', 'Go', 'Gu', 'Mo', 'Do', 'Be', 'No', 'Nu', 'Lo', 'Tu', 'Ul', 'Bu', 'Gom', 'Dro', 'Mur'],
      B: ['mun', 'dor', 'bel', 'gon', 'mo', 'lun', 'kum', 'rod', 'tun', 'bo', 'nem', 'gol'],
      K: ['bo', 'mu', 'po', 'pu', 'nu', 'lo'], E: ['moram', 'undor', 'belkun', 'gorrel', 'umbor', 'degon', 'tarun', 'lomund'],
      F: ['dom', 'gor', 'mund', 'bel', 'rod', 'goth', 'berun', 'kolm'], L: ['krat', 'dom', 'mund', 'olm', 'ruk', 'bom'],
    },
    // the Isveli of Opal's ice (was Nivari): clear and crisp like frost on glass — bright i e y, s v l k (Ylosenis,
    // Silka); after „Eis", ice
    opal: {
      de: 'Isveli', en: 'Isveli', sound: 'clear and crisp: s v l k f and bright i e y — frost singing on glass',
      A: ['I', 'Is', 'Ve', 'Vi', 'Sel', 'Sil', 'Ly', 'Yl', 'Fe', 'Ni', 'Ki', 'Se', 'Ys', 'El', 'Sy', 'Eli'],
      B: ['vi', 'ka', 'sen', 'lin', 'ris', 'vel', 'ya', 'fen', 'kis', 'vie', 'ra', 'sil'],
      K: ['li', 'fi', 'pi', 'ni', 'ki', 'sy'], E: ['velvar', 'syren', 'sande', 'korvel', 'skil', 'vane', 'lisvin', 'frida'],
      F: ['vik', 'fjel', 'sen', 'dal', 'skar', 'kel', 'lind', 'vist'], L: ['frost', 'krist', 'ven', 'lys', 'mir', 'skel'],
    },
    // the Flausel of the enchanted places (a-fairy): the small forest folk under the Slumber Tree. German first,
    // tiny and whispery: given names are little sounds of the wood ending in -el (Huschel, Tröpfel, Summsel), children
    // by a -i (Hupfi, Tauli), elders by the beards and roots of old trees (Murmelbart, Flechtenbart), families after
    // the small things of the forest floor (Moostupf, Tauperle). Searched 2026-10-31: names of children's books'
    // characters were left out (Fussel, Zippel, Purzel, Wispel — a figure of Mörike's, Hörbe, Wuschel, Mümmelmann)
    flausel: {
      de: 'Flausel', en: 'Flausel', sound: 'tiny and whispery: -el, -i, beards and roots — the forest floor',
      first: ['Tummel', 'Huschel', 'Trippel', 'Wuppel', 'Bimmel', 'Tröpfel', 'Flitzel', 'Krispel', 'Nuppel', 'Kribbel',
        'Zwinkel', 'Glimpel', 'Rupfel', 'Dimpel', 'Lupfel', 'Moosel', 'Knöpfel', 'Pimsel', 'Wimmel', 'Hupsel', 'Lirpel',
        'Schwirrel', 'Summsel', 'Tapsel', 'Nimmel', 'Silpel', 'Brummsel', 'Pelzel', 'Sprenkel'],
      kids: ['Flitz', 'Hupfi', 'Wipsi', 'Tropfi', 'Nuppi', 'Wurzli', 'Sprossi', 'Knospi', 'Tauli', 'Perli', 'Farni',
        'Pilzi', 'Beerli', 'Halmi', 'Flaumi', 'Sämi'],
      elders: ['Murmelbart', 'Flechtenbart', 'Rindenhold', 'Moosgrau', 'Wurzelweis', 'Farnwalt', 'Eichelgrau', 'Knorzel',
        'Nebelbart', 'Silberflaum', 'Tannengrau', 'Harzwalt', 'Pilzhold', 'Zapfenweis', 'Mooswalt', 'Steinflaum'],
      sur: ['Moostupf', 'Tauperle', 'Pilzhut', 'Kleestiel', 'Eichelhut', 'Distelflaum', 'Farnwedel', 'Beerenkorb',
        'Wurzelzopf', 'Blütenstaub', 'Mooskissen', 'Nebeltropf', 'Glühwurm', 'Haselkern', 'Rindenmoos', 'Tannenzopf',
        'Blattgrün', 'Fingerhut', 'Wiesenflaum', 'Butterblum'],
    },
  };
  // the order the codex shows the peoples in (codex.js „Völker"): where you meet them
  N.PEOPLE_ORDER = ['herz', 'flausel', 'aqua', 'zinn', 'opal', 'basalt', 'ocker'];
  // a Flausel's name for a folk sprite of a place (fairy.js): seeded by the place, the same every visit
  N.flausel = function (seed, i) { const L = N.pool('flausel').first, a = Math.floor(h01(seed | 0, 0, 0x91) * L.length); return L[(a + (i | 0) * 7) % L.length]; };   // (two folk of one place never share one)
  // a people's codex card: a few of its names (two grown-ups with their families, a child, an elder)
  N.sample = function (kind, seed) {
    const P = N.pool(kind); if (!P) return [];
    const s = seed | 0, a = pick(P.first, s, 1, 0xa1), b = pick(P.first, s, 2, 0xa2), e = pick(P.elders, s, 3, 0xa3);
    return [a + ' ' + pick(P.sur, s, 4, 0xa4), (b === a ? P.first[(P.first.indexOf(b) + 1) % P.first.length] : b) + ' ' + pick(P.sur, s, 5, 0xa5), pick(P.kids, s, 6, 0xa6), e];
  };

  // ---------------------------------------------------------------- the Heartland's sites (o-wander's Wanderbuch)
  // the trailer's landmarks keep the names the quests use (Tor-Tempel, Turmzitadelle, Bergstation …); the places that
  // had only a kind word (Hügeldorf, Bauernhof ×4, Schlucht, Hain) get proper names, one form in both languages, as
  // real places keep theirs: lang keys g.wd.site.<id> (n-names), the kind's word as the fallback
  N.SITES = { hills_w: 'Mohnbühl', hills_e: 'Lerchenbühl', farm_c: 'Sonnenhof', farm_w: 'Kleehof', farm_n: 'Lindenhof',
    farm_e: 'Mohnhof', canyon: 'Hallklamm', east: 'Morgenhain' };

  // a name of a people's tongue: form = 'first' | 'kid' | 'elder' | 'sur' | 'place' (n ≥ 3: a town, one tail more)
  const TAIL = { first: 'B', kid: 'K', elder: 'E', sur: 'F', place: 'L' };
  N.word = function (kind, seed, form, n) {
    const P = N.PEOPLES[kind]; if (!P || !P.A) return '';
    const join = (w, t) => { const l = w.toLowerCase(); if (t.indexOf(l.slice(-2)) === 0 || t.indexOf(l) === 0) return null; return l.slice(-1) === t.charAt(0) ? w + t.slice(1) : w + t; };
    let w = pick(P.A, seed, 0, 0x61);
    if (form === 'place' && ((n || 2) >= 3 || h01(seed, 3, 0x62) < 0.4)) w = join(w, pick(P.B, seed, 2, 0x63));
    if (w) w = join(w, pick(P[TAIL[form] || 'B'], seed, 7, 0x6a));
    if (!w) return '';   // (a stutter: Ve·veliar, Sil·sil — the caller draws again)
    // smooth the seams: no doubled letters at a join (Ise·sel → Isesel stays, Ra·ar → Rar)
    w = w.replace(/([aeiouy])\1/g, '$1').replace(/([^aeiouy])\1\1/g, '$1$1');
    return cap(w.slice(0, 12).toLowerCase());
  };

  const POOLS = {};
  const salt = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h | 0; };
  N.pool = function (kind) {
    if (POOLS[kind]) return POOLS[kind];
    const P = N.PEOPLES[kind]; if (!P) return null;
    if (!P.A) return (POOLS[kind] = { first: P.first, kids: P.kids, elders: P.elders, sur: P.sur });
    const seen = new Set();
    const gen = (form, n, s0) => { const out = []; for (let k = 0; out.length < n && k < n * 60; k++) { const w = N.word(kind, s0 * 977 + k * 7919, form); if (w.length >= 3 && w.length <= 12 && ok(w) && !seen.has(w)) { seen.add(w); out.push(w); } } return out; };
    const s = salt(kind);
    return (POOLS[kind] = { first: gen('first', 48, s ^ 0x11), kids: gen('kid', 24, s ^ 0x22), elders: gen('elder', 24, s ^ 0x44), sur: gen('sur', 32, s ^ 0x33) });
  };
  N.place = function (kind, seed, n) {
    if (kind === 'herz' || kind === 'flausel') return N.village(seed);
    for (let k = 0; k < 24; k++) { const w = N.word(kind, (seed | 0) + k * 104729, 'place', n || 2); if (w.length >= 4 && ok(w)) return w; }
    return N.PEOPLES[kind] ? N.PEOPLES[kind].A[0] + N.PEOPLES[kind].L[0] : '';
  };

  // ---------------------------------------------------------------- Herzwelt's villages
  // a tree, a flower, a bird or the sky's light + a word of the land (Au, Bach, Brunn, Hain …): Lindenau, Mohnbrunn,
  // Lerchenhain. Proper names: the same in both languages, as real towns keep theirs
  const VPRE = ['Linden', 'Rosen', 'Birken', 'Erlen', 'Mohn', 'Klee', 'Sonnen', 'Stern', 'Moos', 'Bienen', 'Apfel', 'Eichen',
    'Weiden', 'Lerchen', 'Glocken', 'Silber', 'Honig', 'Wiesen', 'Tannen', 'Kirsch', 'Quell', 'Hasel', 'Flieder', 'Ahorn',
    'Lilien', 'Finken', 'Sommer', 'Morgen', 'Rotdorn', 'Holler'];
  const VSUF = ['au', 'bach', 'brunn', 'feld', 'hain', 'tal', 'furt', 'hof', 'heim', 'dorf', 'grund', 'born', 'winkel', 'berg',
    'see', 'steg', 'bühl', 'wald', 'wiese', 'mühle'];
  N.VPRE = VPRE; N.VSUF = VSUF;
  N.village = function (seed) {
    for (let k = 0; k < 16; k++) {
      const a = pick(VPRE, seed, k, 0x71), b = pick(VSUF, seed, k, 0x72);
      const w = a + b;
      if (w.length <= 12 && !/eee/.test(w) && a.toLowerCase().indexOf(b) < 0 && !N.blocked(w) && !N.reserved(w)) return w;
    }
    return 'Lindenau';
  };

  // ---------------------------------------------------------------- r-chronik: places named by what happened there
  // a German compound of the event's word (or a word of the mood) and a word of the land, with its English twin and
  // the preposition each language puts before it: Fuchshain · Fox Grove („im Fuchshain“ · „in Fox Grove“), Mohnwiese ·
  // Poppy Meadow („auf der Mohnwiese“), Nebelsee · Mist Lake („am Nebelsee“). Plain words of both languages; the
  // deny list keeps famous fictional places out (test/chronik.js)
  const CH_PRE = {
    fox: [['Fuchs', 'Fox']], deer: [['Reh', 'Deer'], ['Hirsch', 'Hart']], sheep: [['Lamm', 'Lamb'], ['Schaf', 'Sheep']], boar: [['Keiler', 'Boar']],
    fell: [['Eichen', 'Oak'], ['Sturm', 'Storm']], storm: [['Sturm', 'Storm'], ['Donner', 'Thunder'], ['Wind', 'Wind']],
    rain: [['Regen', 'Rain'], ['Tau', 'Dew'], ['Quell', 'Spring']], bloom: [['Mohn', 'Poppy'], ['Blüten', 'Blossom'], ['Glocken', 'Bell'], ['Klee', 'Clover']],
    snow: [['Schnee', 'Snow'], ['Frost', 'Frost']],
    mood: [['Nebel', 'Mist'], ['Mond', 'Moon'], ['Lerchen', 'Lark'], ['Gold', 'Golden'], ['Morgen', 'Dawn'], ['Stern', 'Star'], ['Sommer', 'Summer'], ['Abend', 'Evening'], ['Bienen', 'Bee'], ['Finken', 'Finch'], ['Wolken', 'Cloud'], ['Silber', 'Silver']],
  };
  // [German word, English word, German preposition, English preposition]
  const CH_LAND = {
    meadow: [['wiese', 'Meadow', 'auf der', 'on'], ['au', 'Lea', 'in der', 'on'], ['feld', 'Field', 'auf dem', 'in'], ['hang', 'Slope', 'am', 'on']],
    forest: [['hain', 'Grove', 'im', 'in'], ['wald', 'Wood', 'im', 'in'], ['lichtung', 'Glade', 'auf der', 'in'], ['grund', 'Hollow', 'im', 'in']],
    water: [['see', 'Lake', 'am', 'at'], ['ufer', 'Shore', 'am', 'on'], ['weiher', 'Pond', 'am', 'at'], ['bucht', 'Bay', 'in der', 'in']],
    cold: [['höhe', 'Heights', 'auf der', 'on'], ['kamm', 'Ridge', 'auf dem', 'on'], ['halde', 'Scree', 'an der', 'on'], ['grat', 'Crest', 'am', 'on']],
    dry: [['heide', 'Heath', 'in der', 'on'], ['steppe', 'Steppe', 'in der', 'on'], ['senke', 'Dell', 'in der', 'in'], ['flur', 'Flats', 'auf der', 'on']],
    shore: [['strand', 'Strand', 'am', 'on'], ['düne', 'Dunes', 'auf der', 'on'], ['ufer', 'Shore', 'am', 'on'], ['bucht', 'Cove', 'in der', 'in']],
  };
  const CH_DENY = /^(silbersee|düsterwald|auenland|bruchtal|nebelberge|fangorn|sturmhöhe|schattenwald|mondsee|silberwald)$/i;
  N.CH_PRE = CH_PRE; N.CH_LAND = CH_LAND;
  N.chronikPlace = function (kind, land, seed) {
    const L = CH_LAND[land] || CH_LAND.meadow, own = CH_PRE[kind];
    for (let k = 0; k < 24; k++) {
      const pool = own && h01(seed, k, 0x7a) < 0.6 ? own : CH_PRE.mood;
      const a = pick(pool, seed, k, 0x7b), b = pick(L, seed, k, 0x7c);
      const al = a[0].toLowerCase();
      if (al.slice(-2) === b[0].slice(0, 2) || al.slice(-1) === b[0].charAt(0) && /[aeiouäöü]/.test(b[0].charAt(0))) continue;
      const de = a[0] + b[0], en = a[1] + ' ' + b[1];
      if (de.length > 16 || CH_DENY.test(de) || N.blocked(de) || N.reserved(de) || N.blocked(en)) continue;
      return { de, en, inDe: b[2] + ' ' + de, inEn: b[3] + ' ' + en };
    }
    return { de: 'Lindenhain', en: 'Linden Grove', inDe: 'im Lindenhain', inEn: 'in Linden Grove' };
  };

  // ---------------------------------------------------------------- the stars
  const SON = ['A', 'Ae', 'Be', 'Ca', 'Da', 'E', 'Fa', 'Fe', 'Ha', 'I', 'Ka', 'La', 'Le', 'Li', 'Lo', 'Lu', 'Ma', 'Me', 'Mi',
    'Na', 'Ne', 'No', 'O', 'Pe', 'Ri', 'Ro', 'Sa', 'Se', 'Si', 'Ta', 'Te', 'Ti', 'U', 'Va', 'Ve', 'Vi', 'Ya', 'Za', 'Ze'];
  const SMID = ['l', 'r', 'n', 'm', 's', 'v', 'th', 'nd', 'ld', 'll', 'nn', 'sh', 'r', 'l'];
  const SVOW = ['a', 'e', 'i', 'o', 'ia', 'ei', 'ae', 'a', 'e', 'i'];
  const SEND = ['n', 'ra', 'ris', 'nor', 'lan', 'mir', 'dis', 'ven', 'rin', 'sa', 'na', 'va', 'wen', 'lia', 'mara', 'lis', 'ne',
    'thea', 'sel', 'dra', 'la', 'mel', 'vane', 'rys', 'tis', 'lon', 'l', 's'];
  // a star is never called like a villager of any people, nor shaped like a native place (a people's head + place
  // ending: Ma·thal, Ta·mesa) — test/name_clash.js
  let GIVEN = null, PLACE_RE = null;
  const peopleLike = (w) => {
    if (!GIVEN) { GIVEN = new Set(); for (const k in N.PEOPLES) { const P = N.pool(k); for (const x of P.first.concat(P.kids, P.elders)) GIVEN.add(x.toLowerCase()); } }
    const l = w.toLowerCase(); if (GIVEN.has(l)) return true;
    if (!PLACE_RE) PLACE_RE = Object.keys(N.PEOPLES).filter(k => N.PEOPLES[k].A).map(k => new RegExp('^(?:' + N.PEOPLES[k].A.map(a => a.toLowerCase()).join('|') + ').*(?:' + N.PEOPLES[k].L.join('|') + ')$'));
    for (const re of PLACE_RE) if (re.test(l)) return true;
    return false;
  };
  N.peopleLike = peopleLike;
  N.star = function (seed, used) {
    for (let k = 0; k < 40; k++) {
      const s = (seed | 0) ^ Math.imul(k + 1, 0x9e3779b1), f = h01(s, 0, 0x81);
      const on = pick(SON, s, 1, 0x82), m = pick(SMID, s, 2, 0x83), v = pick(SVOW, s, 3, 0x84), e = pick(SEND, s, 4, 0x85);
      let w = f < 0.75 ? on + m + v + e : on + m + v + pick(['l', 'n', 'r', 'v', 'm'], s, 5, 0x86) + pick(SVOW, s, 6, 0x87) + e;
      w = cap(w.toLowerCase());
      if (w.length < 4 || w.length > (f < 0.75 ? 11 : 9) || !/^[A-Z][a-z]+$/.test(w) || N.blocked(w) || N.reserved(w) || peopleLike(w) || (used && used.has(w))) continue;
      if (used) used.add(w);
      return w;
    }
    return null;
  };
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
