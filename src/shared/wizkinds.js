// ============================================================================
// ✨ What the wizard offers (W2) — VR.WizKinds, the same in the game and the
// R9 Studio. „Was?": big picture tiles — 🏠 Haus (the Baukasten), the R9 Forge's
// 🏢 Hochhaus · 🏰 Burg · 🌉 Brücke · 🌳 Park, 🛋 Möbel (the furniture models),
// the Genie's kinds 🚗 Fahrzeug · 🐘 Tier · 🧍 Figur · 🌲 Natur · 🧸 Ding, and
// „✚ Mehr" (Turm, Halle, Stadion, Mauer, Raumschiff, Gebäude, Katalog, Ort,
// Foto). „Wie?": six variants of a tile (six(tile, {seed, sub})), the next six
// with another seed (🎲), a typed wish (wish(text) → its tile and six) and a
// change of the lit one in words (change(thing, text): „höher", „rotes Dach").
// A thing: {key, src: 'forge'|'kit'|'genie'|'model'|'house', name, ding?, dna?,
// spec?, design?} — grid(thing) builds its blocks on this thread (the pages
// build Forge pieces in their worker), libItem(grid, …) keeps them as a
// Bauteil (r9si.library: a palette and run-length coded cells).
// Nothing here touches a world. The Genie and the Baukasten are the Studio's
// own modules (VR.GenieBrain, VR.Genie, VR.HouseKit); the game compiles them on
// the first ✨ (VR.GenieLazy) — without them their tiles fall back to the Forge.
// ============================================================================
(function (VR) {
  'use strict';
  const K = VR.WizKinds = {};
  const Fg = () => VR.Forge, GB = () => VR.GenieBrain, GN = () => VR.Genie, HK = () => VR.HouseKit;
  const genieOK = () => !!(GB() && GN() && HK());
  const KEEP = 0xffff;
  const hashStr = (s) => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rng = (seed) => { let s = (seed >>> 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };

  // ---------------------------------------------------------------- the tiles: [table key, Deutsch, English]
  const TILES = [
    { id: 'haus', icon: '🏠', src: 'kit', label: ['wiz.t.haus', 'Haus', 'House'] },
    { id: 'hochhaus', icon: '🏢', src: 'forge', forge: 'tower', label: ['wiz.t.hochhaus', 'Hochhaus', 'Skyscraper'] },
    { id: 'burg', icon: '🏰', src: 'forge', forge: 'castle', label: ['wiz.t.burg', 'Burg', 'Castle'] },
    { id: 'bruecke', icon: '🌉', src: 'forge', forge: 'bridge', label: ['wiz.t.bruecke', 'Brücke', 'Bridge'] },
    { id: 'park', icon: '🌳', src: 'forge', forge: 'park', label: ['wiz.t.park', 'Park', 'Park'] },
    { id: 'moebel', icon: '🛋', src: 'model', label: ['wiz.t.moebel', 'Möbel', 'Furniture'] },
    { id: 'fahrzeug', icon: '🚗', src: 'genie', cat: 'vehicle', label: ['wiz.t.fahrzeug', 'Fahrzeug', 'Vehicle'] },
    { id: 'tier', icon: '🐘', src: 'genie', cat: 'animal', label: ['wiz.t.tier', 'Tier', 'Animal'] },
    { id: 'figur', icon: '🧍', src: 'genie', cat: 'figure', label: ['wiz.t.figur', 'Figur', 'Figure'] },
    { id: 'natur', icon: '🌲', src: 'genie', cat: 'nature', label: ['wiz.t.natur', 'Natur', 'Nature'] },
    { id: 'ding', icon: '🧸', src: 'genie', cat: 'thing', label: ['wiz.t.ding', 'Ding', 'Thing'] },
    { id: 'mehr', icon: '✚', src: 'more', label: ['wiz.t.mehr', 'Mehr', 'More'] },
  ];
  const MORE = [
    { id: 'turm', icon: '🗼', src: 'forge', forge: 'lookout', label: ['wiz.t.turm', 'Turm', 'Tower'] },
    { id: 'raumschiff', icon: '🚀', src: 'forge', forge: 'shuttle', label: ['wiz.t.raumschiff', 'Raumschiff', 'Spaceship'] },
    { id: 'stadion', icon: '🏟', src: 'forge', forge: 'stadium', label: ['wiz.t.stadion', 'Stadion', 'Stadium'] },
    { id: 'halle', icon: '🏛', src: 'forge', forge: 'hall', label: ['wiz.t.halle', 'Halle', 'Hall'] },
    { id: 'mauer', icon: '🧱', src: 'forge', forge: 'wall', label: ['wiz.t.mauer', 'Mauer', 'Wall'] },
    { id: 'gebaeude', icon: '⛪', src: 'genie', cat: 'building', label: ['wiz.t.gebaeude', 'Gebäude', 'Building'] },
    { id: 'katalog', icon: '📖', src: 'house', label: ['wiz.t.katalog', 'Villen', 'Villas'] },
    { id: 'ort', icon: '🏘', src: 'studio', studio: 'site', label: ['wiz.t.ort', 'Ort', 'Place'] },
    { id: 'foto', icon: '📷', src: 'studio', studio: 'photo', label: ['wiz.t.foto', 'Foto', 'Photo'] },
  ];
  K.TILES = TILES; K.MORE = MORE;
  K.tiles = () => TILES.slice();
  K.more = () => MORE.slice();
  K.tile = (id) => TILES.find(t => t.id === id) || MORE.find(t => t.id === id) || null;
  const FORGE_TILE = {}; for (const t of TILES.concat(MORE)) if (t.forge) FORGE_TILE[t.forge] = t.id;
  const CAT_TILE = {}; for (const t of TILES.concat(MORE)) if (t.cat) CAT_TILE[t.cat] = t.id;
  K.forgeTile = (type) => FORGE_TILE[type] || null;

  // ---------------------------------------------------------------- the Forge: six variants of a type
  const fname = (dna) => String(Fg().describe(dna, true) || '').replace(/^\S+\s/, '');
  const forgeThing = (dna) => ({ key: 'f:' + dna, src: 'forge', dna, ding: 'f:' + dna, name: fname(dna) });
  // six that look different on a small picture: the base, then each in another material, one size nudged up or down,
  // a spaceship of another kind, a new seed for the details
  function forgeVariants(base, n) {
    const F = Fg(), P = F.parse(base); if (!P) return [];
    const t = F.type(P.type), out = [F.dna(P)], seen = new Set(out);
    const dims = t.params.filter(p => p.dim && p.max > p.min), si = Math.max(0, t.styles.findIndex(s => s.id === P.style));
    const kind = t.params.find(p => p.names && p.max > p.min);
    for (let k = 1; out.length < n && k < n * 6; k++) {
      const Q = { type: P.type, params: Object.assign({}, P.params), style: P.style, seed: (hashStr(base + ':' + k) & 0xffff) || 1 };
      if (t.styles.length > 1) Q.style = t.styles[(si + k) % t.styles.length].id;
      // (a named choice — a spaceship's kind, a tower's roof — every other one; a size every time there are sizes)
      if (kind && (!dims.length || k % 2 === 0)) Q.params[kind.k] = kind.min + ((P.params[kind.k] - kind.min + k) % (kind.max - kind.min + 1));
      if (dims.length) {
        const p = dims[(k - 1) % dims.length], v = P.params[p.k], step = Math.max(p.step || 1, Math.round(v / 5), Math.round((p.max - p.min) / 14));
        Q.params[p.k] = Math.max(p.min, Math.min(p.max, v + ((k & 1) ? 1 : -1) * step * Math.ceil((k + 1) / (2 * dims.length))));
      }
      const d = F.dna(Q); if (!d || seen.has(d)) continue;
      seen.add(d); out.push(d);
    }
    return out;
  }
  function forgeSix(type, seed, base) {
    const F = Fg(), t = F && F.type(type); if (!t) return [];
    let dna = base;
    if (!dna) { const st = t.styles[(Math.max(1, seed) - 1) % t.styles.length].id; dna = F.dna(type, {}, seed <= 1 ? 1 : (hashStr(type + ':' + seed) & 0xffff) || 1, st); }
    return forgeVariants(dna, 6).map(forgeThing);
  }

  // ---------------------------------------------------------------- the Baukasten: six houses (a style, or mixed)
  const STYLES = [['cottage', '🏡', ['wiz.s.cottage', 'Landhaus', 'Country']], ['modern', '🏙', ['wiz.s.modern', 'Modern', 'Modern']], ['classic', '🏛', ['wiz.s.classic', 'Klassisch', 'Classic']], ['cabin', '🛖', ['wiz.s.cabin', 'Hütte', 'Cabin']]];
  const kitThing = (spec) => ({ key: 'k:' + hashStr(JSON.stringify(spec)).toString(36), src: 'kit', spec, name: spec.name || 'Haus' });
  function houseSix(seed, style) {
    const H = HK(); if (!H) return null;
    const out = [], seen = new Set();
    for (let k = 0; out.length < 6 && k < 400; k++) {
      const spec = H.random(rng(hashStr('haus:' + seed + ':' + k)));
      if (style && spec.style !== style) continue;
      if (!style && out.length < 4 && out.some(t => t.spec.style === spec.style) && k < 60) continue;   // (mixed: the first four in four styles)
      const j = JSON.stringify(spec); if (seen.has(j)) continue; seen.add(j);
      out.push(kitThing(spec));
    }
    return out;
  }

  // ---------------------------------------------------------------- the Genie: six things of a kind, six of one thing
  const FIRST = {
    vehicle: ['firetruck', 'car', 'bus', 'tractor', 'digger', 'train'],
    animal: ['dog', 'cat', 'horse', 'unicorn', 'elephant', 'dragon'],
    figure: ['knight', 'astronaut', 'robot', 'wizard', 'royal', 'snowman'],
    nature: ['tree', 'palm', 'flower', 'mushroom', 'cactus', 'rock'],
    thing: ['cake', 'gift', 'trophy', 'crown', 'chest', 'ball'],
    building: ['lighthouse', 'windmill', 'church', 'treehouse', 'pyramid', 'ferris'],
  };
  const catList = (cat) => { const B = GB(); if (!B) return []; const all = B.LIB.filter(T => T.cat === cat).map(T => T.id), first = (FIRST[cat] || []).filter(id => all.includes(id)); return first.concat(all.filter(id => !first.includes(id))); };
  // one thing as the Genie designs it from words (its proper name: „Blaues Feuerwehrauto")
  const genieThing = (design) => ({ key: 'g:' + hashStr(JSON.stringify(design.recipe || design.model || design.name)).toString(36), src: 'genie', design, name: design.name || 'Ding' });
  function designOf(text, base) { const B = GB(); try { return B.design({ text, base }); } catch (e) { return null; } }
  function genieSix(cat, seed) {
    const B = GB(); if (!B) return null;
    const ids = catList(cat); if (!ids.length) return [];
    const from = ((Math.max(1, seed) - 1) * 6) % ids.length, out = [];
    for (let k = 0; out.length < 6 && k < ids.length; k++) {
      const T = B.lib(ids[(from + k) % ids.length]); if (!T) continue;
      const d = designOf(T.de); if (d && d.kind === 'model' && d.recipe && d.recipe.type === T.id) out.push(genieThing(d));
    }
    return out;
  }
  // six of one thing: as it comes, then five others — another colour on its main part, every other one with a feature
  // switched (the Genie's own words, so the names read „Blaues Feuerwehrauto", „Gelber Bus ohne …")
  // (no orange: the Genie reads it as the fruit)
  const COLORS = [['rot', '#c0392b'], ['blau', '#2f6fd6'], ['grün', '#3a9a4a'], ['gelb', '#e8c22a'], ['lila', '#8e44ad'], ['türkis', '#1abc9c'], ['rosa', '#ff9fc4'], ['schwarz', '#2a2a2a'], ['weiß', '#f2f2f2'], ['braun', '#7a4a2a']];
  const hexD = (a, b) => { const p = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; try { const x = p(a), y = p(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); } catch (e) { return 999; } };
  function thingSix(type, seed) {
    const B = GB(), T = B && B.lib(type); if (!T) return [];
    const main = T.main || Object.keys(T.slots)[0], def = T.slots[main] && T.slots[main][0], word = T.de;
    const cols = COLORS.filter(([, hx]) => !(typeof def === 'string' && def[0] === '#' && hexD(def, hx) < 90));
    const feats = Object.keys(T.feats || {}), on = T.on || {};
    const r = rng(hashStr(type + ':' + seed)), start = seed <= 1 ? 0 : Math.floor(r() * cols.length);
    const out = [], seen = new Set(), names = new Set();
    // (a colour the Genie does not put into the name — „lila" — goes after it: no two cards read the same)
    const add = (d, cw) => {
      if (!d || d.kind !== 'model' || d.recipe.type !== T.id) return; const k = JSON.stringify(d.recipe); if (seen.has(k)) return; seen.add(k);
      const th = genieThing(d); if (names.has(th.name) && cw) th.name = th.name + ' · ' + cw; names.add(th.name); out.push(th);
    };
    if (seed <= 1) add(designOf(word));
    for (let k = 0; out.length < 6 && k < cols.length * 2; k++) {
      const [cw] = cols[(start + k) % cols.length];
      let text = cw + ' ' + word;
      if (feats.length && k % 2 === 1) { const f = feats[(k >> 1) % feats.length], w = String(T.feats[f][0]).replace(/^=/, ''); text += (on[f] ? ' ohne ' : ' mit ') + w; }
      add(designOf(text), cw);
    }
    return out.slice(0, 6);
  }

  // ---------------------------------------------------------------- Möbel: the furniture models by kind
  // [id, icon, label, which models, which of them first]
  const FURN = [
    ['sofa', '🛋', ['wiz.m.sofa', 'Sofa', 'Sofa'], /^vm_(sofa|living_sofa|chaise|armchair|outdoor_sofa|garden_sofa)/, /^vm_sofa_/],
    ['bett', '🛏', ['wiz.m.bett', 'Bett', 'Bed'], /^vm_(bed|sleep_(boxspring|ledbed)|bunk_bed)/, /^vm_bed_/],
    ['tisch', '🍽', ['wiz.m.tisch', 'Tisch', 'Table'], /^vm_(dining_table|coffee_table|side_table|desk|office_desk|garden_table|shop_table)/, /^vm_(dining_table|coffee)/],
    ['stuhl', '🪑', ['wiz.m.stuhl', 'Stuhl', 'Chair'], /chair|stool|_bench|^vm_bench/, /^vm_(dining_chair|bench)/],
    ['lampe', '💡', ['wiz.m.lampe', 'Lampe', 'Lamp'], /lamp|^vm_light_|pendant|chandelier|lantern/, /^vm_(floor|arc|table)_lamp/],
    ['pflanze', '🪴', ['wiz.m.pflanze', 'Pflanze', 'Plant'], /^vm_(plant|monstera|olive|planter)/, /^vm_(monstera|olive)/],
    ['kueche', '🍳', ['wiz.m.kueche', 'Küche', 'Kitchen'], /^vm_(kitchen|fridge|island|range_hood|dishwasher)/, /^vm_(fridge|island)$/],
    ['bad', '🛁', ['wiz.m.bad', 'Bad', 'Bath'], /^vm_(bath|toilet|shower|vanity|towel)/, /^vm_(bathtub|toilet|shower|vanity)$/],
    ['garten', '🌳', ['wiz.m.garten', 'Garten', 'Garden'], /^vm_(garden|lounger|bbq|parasol|fire_pit)/, /^vm_(lounger|bbq|parasol|fire_pit)$/],
  ];
  const modelName = (n) => { const R = VR.R, t = R && R.byName[n]; return (t && (t.display || (t.o && t.o.display))) || n.replace(/^vm_/, '').replace(/_/g, ' '); };
  const modelThing = (n) => ({ key: 'm:' + n, src: 'model', ding: 'm:' + n, model: n, name: modelName(n) });
  function furnSix(sub, seed) {
    const VM = VR.VM; if (!VM) return [];
    const f = FURN.find(x => x[0] === sub) || FURN[0], all = Object.keys(VM.MODELS).filter(n => f[3].test(n)).sort(), names = all.filter(n => f[4].test(n)).concat(all.filter(n => !f[4].test(n)));
    if (!names.length) return [];
    const from = ((Math.max(1, seed) - 1) * 6) % names.length, out = [];
    for (let k = 0; k < Math.min(6, names.length); k++) out.push(modelThing(names[(from + k) % names.length]));
    return out;
  }
  // ---------------------------------------------------------------- the villas of the catalogue (h:)
  // (the villa catalogue: the game has it on its page; the Studio hands its list in — K.catalog() → [{i, name}])
  function villaSix(seed) {
    const P = VR.VillageGen && VR.VillageGen.plan2, cat = P && P.CATALOGUE ? P.CATALOGUE.map((c, i) => ({ i, name: c.name })) : (K.catalog ? K.catalog() : null);
    if (!cat || !cat.length) return [];
    const from = ((Math.max(1, seed) - 1) * 6) % cat.length, out = [];
    for (let k = 0; k < Math.min(6, cat.length); k++) { const c = cat[(from + k) % cat.length]; out.push({ key: 'h:' + c.i, src: 'house', ding: 'h:' + c.i, index: c.i, name: c.name }); }
    return out;
  }

  // ---------------------------------------------------------------- six of a tile
  // → {tile, things, chips?: [{id, icon, label}], sub?, studio?}
  K.six = function (id, o) {
    o = o || {};
    const t = K.tile(id), seed = Math.max(1, o.seed | 0 || 1); if (!t) return { tile: id, things: [] };
    if (t.src === 'forge') return { tile: id, things: forgeSix(t.forge, seed, o.base) };
    if (t.src === 'model') { const sub = o.sub || 'sofa'; return { tile: id, sub, things: furnSix(sub, seed), chips: FURN.map(([fid, icon, label]) => ({ id: fid, icon, label })) }; }
    if (t.src === 'house') return { tile: id, things: villaSix(seed) };
    if (t.src === 'studio') return { tile: id, things: [], studio: t.studio };
    if (t.src === 'kit') {
      const things = houseSix(seed, o.sub || null);
      if (!things) return { tile: id, things: forgeSix('house', seed) };   // (no Baukasten here: the Forge's houses)
      return { tile: id, sub: o.sub || null, things, chips: STYLES.map(([sid, icon, label]) => ({ id: sid, icon, label })) };
    }
    if (t.src === 'genie') {
      if (o.type) return { tile: id, type: o.type, things: thingSix(o.type, seed) };
      const things = genieSix(t.cat, seed);
      return { tile: id, things: things || [] };
    }
    return { tile: id, things: [] };
  };

  // ---------------------------------------------------------------- a typed wish → its tile and six
  // furniture words alone (no colour) are the real models; a colour makes it the Genie's („rotes Sofa")
  const FURN_WORDS = [['sofa', /\b(sofa|sofas|couch|couches|sessel|armchair)\b/], ['bett', /\b(bett|betten|bed|beds)\b/], ['tisch', /\b(tisch|tische|table|tables|schreibtisch|desk)\b/], ['stuhl', /\b(stuhl|stuhle|chair|chairs|hocker|stool)\b/], ['lampe', /\b(lampe|lampen|lamp|lamps|leuchte)\b/], ['pflanze', /\b(pflanze|pflanzen|plant|plants|zimmerpflanze)\b/], ['kueche', /\b(kuche|kitchen|herd|kuhlschrank|fridge)\b/], ['bad', /\b(bad|badezimmer|bath|bathroom|badewanne|dusche|toilette|klo)\b/]];
  // the Genie's own landmarks win over the Forge's generic types (a Leuchtturm is the Genie's lighthouse, a Turm the Forge's)
  const GENIE_OWN = /^(lighthouse|windmill|turbine|church|eiffel|tvtower|fountain|well|treehouse|tent|circus|igloo|pyramid|temple|ferris|carousel|doghouse|birdhouse|stall|swing|slide|lamp|bench|mailbox)$/;
  K.wish = function (text) {
    const raw = String(text || '').trim(); if (!raw) return { error: 'empty' };
    const F = Fg(), B = GB(), n = F ? F.norm(raw) : raw.toLowerCase();
    const colour = B ? B.colors(n).length > 0 : false;
    if (!colour) for (const [sub, re] of FURN_WORDS) if (re.test(n)) return Object.assign(K.six('moebel', { sub }), { wish: raw });
    const fty = F ? F.typeOf(n) : null;
    const gp = B ? B.pick(n) : null, gmodel = gp && gp.model;
    const genieFirst = gmodel && GENIE_OWN.test(gmodel.T.id);
    const houseWish = fty ? fty.id === 'house' : !!(gp && gp.house);   // (a Hochhaus is the Forge's, though it ends in -haus)
    if (fty && !genieFirst && !(houseWish && B && HK()) && FORGE_TILE[fty.id]) {
      const base = F.fromText(raw); if (base) return { tile: FORGE_TILE[fty.id], things: forgeVariants(base, 6).map(forgeThing), wish: raw };
    }
    if (B && HK()) {
      const d = designOf(raw);
      if (d && d.kind === 'house') {
        const lit = kitThing(HK().normalize(d.spec)), rest = (houseSix(hashStr(raw) & 0xffff, d.spec.style) || []).filter(t => t.key !== lit.key).slice(0, 5);
        return { tile: 'haus', sub: d.spec.style, things: [lit].concat(rest), chips: STYLES.map(([sid, icon, label]) => ({ id: sid, icon, label })), wish: raw };
      }
      if (d && d.kind === 'model' && d.recipe && B.lib(d.recipe.type)) {
        const T = B.lib(d.recipe.type), six = thingSix(T.id, 1);
        // the wish itself first (its colours and features), then the others
        const lit = genieThing(d), rest = six.filter(t => JSON.stringify(t.design.recipe) !== JSON.stringify(d.recipe)).slice(0, 5);
        return { tile: CAT_TILE[T.cat] || 'ding', type: T.id, things: [lit].concat(rest), wish: raw };
      }
      if (d && d.kind === 'model') return { tile: 'ding', things: [genieThing(d)], wish: raw };   // (a photo relief)
    }
    if (fty && FORGE_TILE[fty.id]) { const base = F.fromText(raw); if (base) return { tile: FORGE_TILE[fty.id], things: forgeVariants(base, 6).map(forgeThing), wish: raw }; }
    const sug = B && B.suggest ? B.suggest(n) : [];
    return { error: 'unknown', suggestions: sug.length >= 3 ? sug : ['Hochhaus', 'Burg', 'Brücke', 'Park', 'Sofa'] };
  };

  // ---------------------------------------------------------------- „✨ Sag, was anders sein soll": the lit one changed
  K.change = function (thing, text) {
    const raw = String(text || '').trim(); if (!thing || !raw) return null;
    if (thing.src === 'forge') {
      const F = Fg(), n = F.norm(raw), ty = F.typeOf(n);
      const dna = ty && ty.id !== F.parse(thing.dna).type ? F.fromText(raw) : F.tweak(thing.dna, raw);
      return dna && dna !== thing.dna ? forgeThing(dna) : null;
    }
    if (thing.src === 'kit' && GB()) {
      const d = designOf(raw, Object.assign({ kind: 'house' }, thing.spec));
      if (d && d.kind === 'house') return kitThing(HK().normalize(d.spec));
      if (d && d.kind === 'model') return genieThing(d);
      return null;
    }
    if (thing.src === 'genie' && GB()) { const d = designOf(raw, thing.design); return d ? (d.kind === 'house' ? kitThing(HK().normalize(d.spec)) : genieThing(d)) : null; }
    return null;
  };

  // ---------------------------------------------------------------- blocks
  // {sx, sy, sz, blocks (0xFFFF keeps the world), dy} — null for furniture and villas (their pictures are the page's)
  K.grid = function (thing) {
    if (!thing) return null;
    try {
      if (thing.src === 'forge') { const g = Fg().build(thing.dna); return { sx: g.sx, sy: g.sy, sz: g.sz, blocks: g.blocks, dy: g.dy | 0 }; }
      if (thing.src === 'kit' && HK()) { const g = HK().build(thing.spec); return { sx: g.sx, sy: g.sy, sz: g.sz, blocks: g.blocks, dy: g.dy | 0, n: g.n }; }
      if (thing.src === 'genie' && GN()) { const d = thing.design, g = GN().raster(Object.assign({ name: d.name }, d.model), { set: 'all' }); return g ? { sx: g.sx, sy: g.sy, sz: g.sz, blocks: g.blocks, dy: g.dy | 0, n: g.n } : null; }
    } catch (e) { if (typeof console !== 'undefined') console.warn('wizard grid', e); }
    return null;
  };
  // a grid as a Bauteil for 'r9si.library' (the Werkbank's format: 0 keeps the world, 1 is air, then portable states)
  K.libItem = function (g, o) {
    o = o || {};
    const CU = VR.Custom, pal = [0, 'air'], map = new Map(), idx = new Uint16Array(g.blocks.length);
    for (let i = 0; i < g.blocks.length; i++) { const s = g.blocks[i]; if (s === KEEP) continue; if (!s) { idx[i] = 1; continue; } let k = map.get(s); if (k === undefined) { k = pal.length; pal.push(CU.portable(s)); map.set(s, k); } idx[i] = k; }
    const it = { id: o.id || 'b' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36), name: String(o.name || 'Bauteil').slice(0, 40), t: Date.now(), sx: g.sx, sy: g.sy, sz: g.sz, dy: g.dy | 0, pal, rle: CU.b64(CU.vrle(idx)) };
    if (o.origin) it.origin = o.origin;
    if (o.thumb) it.thumb = o.thumb;
    return it;
  };
  K.hashStr = hashStr;
})(typeof VR !== 'undefined' ? VR : (self.VR = self.VR || {}));
