// ============================================================================
// R9 Forge (🏭) — architecture by symbol. A short DNA string names a type, its
// parameters, a material style and a seed ("tower:f42,w18,d18,glas,c2#9f3a");
// every generator turns one into a block grid, deterministically, in any
// thread: the Studio's worker (previews, the ghost), the game's worker (the
// plan {kind:'forge', dna} is rebuilt from the DNA alone) and node (tests).
// This file is the core: the type registry, DNA ↔ parameters, the German /
// English text parser ("Hochhaus 40 Stockwerke mit Dachgarten", "modern house
// two floors flat roof"), nearby variants for a 3 × 3 grid, "höher / breiter /
// mehr Glas" tweaks, a German description, and the grid → ops helpers the
// placers use. The generators register themselves (forge_*.js).
// Grid: {sx, sy, sz, blocks: Uint16Array[(y*sz+z)*sx+x], dy} — 0xFFFF keeps
// the world, 0 is air; world y = F + dy + gy; u = x, v = z, the front is v = 0.
// ============================================================================
(function (VR) {
  'use strict';
  const Forge = VR.Forge = { types: [], TYPES: {}, gens: {}, KEEP: 0xFFFF };
  // the words a shape says (titles, describe): the tables (g.fg.*) when the language module is there, else the German
  Forge.tx = function (key, vars, de, en) {
    if (VR.I18N && VR.I18N.tx) return VR.I18N.tx(key, vars, de, en);
    return String(de).replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] !== undefined ? vars[k] : m));
  };
  const KEEP = 0xFFFF;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const tx = (k, v, de, en) => (VR.I18N && VR.I18N.tx ? VR.I18N.tx(k, v, de, en) : String(de).replace(/\{(\w+)\}/g, (m, x) => (v && v[x] !== undefined ? v[x] : m)));
  Forge.tx = tx;

  // ---------------------------------------------------------------- the registry
  // def: {id, icon, name, en, params:[{k, label, min, max, def, step?, dim?, words?:{value: [stems]}}], styles:[{id, name, words:[stems]}],
  //       level (the game levels the lot), terrain (the build wants a ground profile), sh (storey height), lot(P) → [W, D],
  //       title(P) → what this one is called (Hängebrücke, Werkhalle …; else name), describe(P) → [parts]}
  Forge.register = function (def, build) {
    if (Forge.TYPES[def.id]) { Forge.types.splice(Forge.types.indexOf(Forge.TYPES[def.id]), 1); }
    const t = Object.assign({ level: true, terrain: false, params: [], styles: [] }, def);
    t.byKey = {}; for (const p of t.params) t.byKey[p.k] = p;
    t.param = (k) => t.byKey[k] || null;
    t.style = (id) => t.styles.find(s => s.id === id) || null;
    Forge.TYPES[t.id] = t; Forge.types.push(t); Forge.gens[t.id] = build;
    return t;
  };
  Forge.type = (id) => Forge.TYPES[id] || null;
  const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

  // ---------------------------------------------------------------- DNA ↔ parameters
  // "type:k12,k3,style,k1#hexseed" — keys are single letters; unknown tokens are ignored, values clamped to the ranges
  Forge.parse = function (dna) {
    if (dna && typeof dna === 'object' && dna.type) return Forge.normalize(dna);
    if (typeof dna !== 'string') return null;
    const m = /^\s*([a-z]+)\s*:?\s*([^#]*)(?:#([0-9a-fA-F]{1,8}))?\s*$/.exec(dna);
    if (!m) return null;
    const t = Forge.TYPES[m[1]]; if (!t) return null;
    const P = { type: t.id, params: {}, style: null, seed: m[3] ? parseInt(m[3], 16) >>> 0 : 1 };
    for (const tok of m[2].split(/[,\s]+/)) {
      if (!tok) continue;
      const kv = /^([a-z])(-?\d+)$/.exec(tok);
      if (kv && t.byKey[kv[1]]) { P.params[kv[1]] = +kv[2]; continue; }
      if (t.style(tok)) P.style = tok;
    }
    return Forge.normalize(P);
  };
  // defaults filled, values clamped and rounded to the step, the style a real one
  Forge.normalize = function (P) {
    const t = Forge.TYPES[P.type]; if (!t) return null;
    const out = { type: t.id, params: {}, style: t.style(P.style) ? P.style : t.styles[0].id, seed: (P.seed >>> 0) || 1 };
    for (const p of t.params) {
      let v = P.params && P.params[p.k] !== undefined && Number.isFinite(+P.params[p.k]) ? +P.params[p.k] : p.def;
      if (p.step) v = p.min + Math.round((v - p.min) / p.step) * p.step;   // on the grid min, min + step, … (3, 5, 7)
      out.params[p.k] = clamp(Math.round(v), p.min, p.max);
    }
    return out;
  };
  // the canonical string: dimension params, the style, the other params (defaults left out), the seed in hex
  Forge.dna = function (type, params, seed, style) {
    const P = typeof type === 'object' ? Forge.normalize(type) : Forge.normalize({ type, params: params || {}, seed, style });
    if (!P) return null;
    const t = Forge.TYPES[P.type], a = [], b = [];
    for (const p of t.params) { const v = P.params[p.k]; if (v === p.def) continue; (p.dim ? a : b).push(p.k + v); }
    return t.id + ':' + a.concat([P.style], b).join(',') + '#' + P.seed.toString(16);
  };
  Forge.rng = (P, salt) => new VR.RNG(((P.seed >>> 0) ^ hashStr(P.type + ':' + (salt || ''))) >>> 0);

  // ---------------------------------------------------------------- build
  const FLAT = { ground: () => -1, depth: 48 };
  Forge.env = (env) => Object.assign({}, FLAT, env || {});
  Forge.build = function (dna, env) {
    const P = Forge.parse(dna); if (!P) throw new Error('Forge: unknown DNA ' + dna);
    const t = Forge.TYPES[P.type], E = Forge.env(env);
    const t0 = now();
    const g = Forge.gens[P.type](P, E, t);
    const meta = g.meta = Object.assign({ type: P.type, name: t.name, lot: [g.sx, g.sz], anchor: [g.sx >> 1, 0], doors: [], floors: [], sh: t.sh || 4, top: g.sy + g.dy - 1, bottom: g.dy, level: !!t.level, terrain: !!t.terrain, front: 0 }, g.meta || {});
    meta.dna = Forge.dna(P); meta.ms = now() - t0;
    let n = 0; const b = g.blocks; for (let i = 0; i < b.length; i++) if (b[i] !== KEEP) n++; meta.n = n;
    return g;
  };
  const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
  // the footprint and the placer's needs without a build
  Forge.meta = function (dna) {
    const P = Forge.parse(dna); if (!P) return null;
    const t = Forge.TYPES[P.type], lot = t.lot ? t.lot(P) : [P.params.w || 16, P.params.d || 16];
    return { type: t.id, name: t.name, icon: t.icon, lot, level: !!t.level, terrain: !!t.terrain, dna: Forge.dna(P) };
  };
  // FNV-1a over the dimensions and every block
  Forge.hash = function (g) {
    let h = 2166136261;
    const mix = (v) => { h ^= v & 255; h = Math.imul(h, 16777619); h ^= (v >>> 8) & 255; h = Math.imul(h, 16777619); };
    mix(g.sx); mix(g.sy); mix(g.sz); mix(g.dy & 0xffff);
    for (let i = 0; i < g.blocks.length; i++) mix(g.blocks[i]);
    return h >>> 0;
  };
  // every non-keep cell as [u, y, v, state] (y relative to the placement floor) — what the game's placer builds.
  // clearTo: the placer of a levelled lot clears rows 0 … clearTo itself, so air there needs no op (a stadium sends a
  // fifth of its cells, the main thread compares a fifth)
  Forge.ops = function (g, clearTo) {
    const b = g.blocks, sx = g.sx, sz = g.sz, c0 = clearTo === undefined ? -1 : clearTo;
    const skip = (s, y) => s === KEEP || (s === 0 && y >= 0 && y <= c0);
    let n = 0;
    for (let y = 0; y < g.sy; y++) { const yy = y + g.dy, row = y * sz * sx; for (let i = 0; i < sz * sx; i++) if (!skip(b[row + i], yy)) n++; }
    const ops = new Int32Array(n * 4); let k = 0;
    for (let y = 0; y < g.sy; y++) for (let z = 0; z < sz; z++) for (let x = 0; x < sx; x++) { const s = b[(y * sz + z) * sx + x]; if (skip(s, y + g.dy)) continue; ops[k++] = x; ops[k++] = y + g.dy; ops[k++] = z; ops[k++] = s; }
    return ops;
  };
  // the rows the game's levelling clears on a lot anyway (blueprints.js planAt: the piece's volume up to 24 rows)
  Forge.CLEARED = (top) => Math.min(top + 2, 23);
  // the grid as it stands in the world: on a levelled lot the placer clears those rows, so keep-world there is air
  // (what a walk from the street has to go through: the forecourt, the yard, the path to the door)
  Forge.asPlaced = function (g) {
    const M = g.meta || {}; if (!M.level) return g;
    const c0 = Forge.CLEARED(M.top), b = g.blocks.slice(), n = g.sx * g.sz;
    for (let y = 0; y < g.sy; y++) { const yy = y + g.dy; if (yy < 0 || yy > c0) continue; for (let i = y * n; i < (y + 1) * n; i++) if (b[i] === KEEP) b[i] = 0; }
    return Object.assign({}, g, { blocks: b });
  };
  // the game worker's job: {dna, ground?: Int16Array(W·D) (the terrain under the lot, rows relative to the floor, 99 =
  // unknown), W, D} → {type:'forge', ops: Int32Array [u, y, v, state]…, lot, top, bottom, level, terrain, name, doors,
  // floors, roof} — every non-keep cell, y relative to the floor; air included (it clears) except where the levelling of
  // the lot clears anyway
  Forge.job = function (m) {
    const meta = Forge.meta(m.dna);
    if (!meta) return { type: 'forge', id: m.id, error: 'unknown dna' };
    let env = null;
    if (m.ground && meta.terrain) { const W = m.W, D = m.D, gr = m.ground; env = { ground: (u, v) => { const g = gr[Math.max(0, Math.min(D - 1, v)) * W + Math.max(0, Math.min(W - 1, u))]; return g === 99 ? -1 : g; }, depth: 48 }; }
    const g = Forge.build(m.dna, env), M = g.meta, ops = Forge.ops(g, M.level ? Forge.CLEARED(M.top) : undefined);
    return { type: 'forge', id: m.id, dna: m.dna, ops, lot: M.lot, house: [0, 0, g.sx, g.sz], top: M.top, bottom: g.dy, level: M.level, terrain: M.terrain, name: M.name, n: M.n, doors: M.doors, floors: M.floors, roof: M.roof === undefined ? null : M.roof, ms: M.ms };
  };
  // [start, end) chunks of at most `max` cells
  Forge.slices = function (n, max) { const out = []; for (let i = 0; i < n; i += max) out.push([i, Math.min(n, i + max)]); if (!out.length) out.push([0, 0]); return out; };

  // ---------------------------------------------------------------- words
  // lower case, umlauts folded ("Brücke", "Bruecke", "Brucke" are one word), punctuation spaced — the ✨ Genie's reading
  // (VR.GenieBrain.norm, in the Studio) and this copy of it (the game's worker, node) say the same word for word
  const ownNorm = (t) => String(t || '').toLowerCase()
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss').replace(/[éèê]/g, 'e').replace(/[àâá]/g, 'a').replace(/[óô]/g, 'o')
    .replace(/(\d)\s*[x×*]\s*(\d)/g, '$1 x $2')
    .replace(/\bblue/g, 'blau').replace(/(statue|uell|uett|fondue|revue|true|glue|value|rescue|tissue|avenue|shoe|canoe|oboe|poet|aero|israel)/g, (m) => m.toUpperCase())
    .replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/(^|[^aeq])ue/g, '$1u').toLowerCase()
    .replace(/[,;:.!?()\n]+/g, ' , ').replace(/[^a-z0-9#,\s]/g, ' ').replace(/\s+/g, ' ').replace(/^( ?, ?)+|( ?, ?)+$/g, '').trim();
  const norm = (t) => (VR.GenieBrain && VR.GenieBrain.norm ? VR.GenieBrain.norm(t) : ownNorm(t));
  Forge.norm = norm; Forge.ownNorm = ownNorm;
  const NUMW = { ein: 1, eine: 1, einen: 1, einem: 1, einer: 1, eins: 1, one: 1, a: 1, zwei: 2, two: 2, drei: 3, three: 3, vier: 4, four: 4, funf: 5, five: 5, sechs: 6, six: 6, sieben: 7, seven: 7, acht: 8, eight: 8, neun: 9, nine: 9, zehn: 10, ten: 10, elf: 11, eleven: 11, zwolf: 12, twelve: 12, funfzehn: 15, fifteen: 15, zwanzig: 20, twenty: 20, dreissig: 30, thirty: 30, vierzig: 40, forty: 40, funfzig: 50, fifty: 50, sechzig: 60, sixty: 60, hundert: 100, hundred: 100, dutzend: 12 };
  const numOf = (w) => (/^\d+$/.test(w) ? +w : NUMW[w] !== undefined ? NUMW[w] : null);
  // a stem list → one regex: long stems may end a compound ("Bürohochhaus"), short ones start a word; German plural endings allowed
  // ("~haus": a short stem that may end a compound too — Holzhaus, Wachturm; at the same start the longer word wins)
  function stemRe(stems) {
    const one = (s) => s.replace(/^~/, '').replace(/ /g, ' ?');
    const long = stems.filter(s => s.length >= 5 || s[0] === '~').map(one), short = stems.filter(s => s.length < 5 && s[0] !== '~').map(s => '\\b' + one(s));
    const parts = [];
    if (long.length) parts.push('(?:' + long.join('|') + ')(?:s|e|en|n|es|er|ern)?\\b');
    if (short.length) parts.push('(?:' + short.join('|') + ')(?:s|e|en|n|es|er|ern)?\\b');
    return new RegExp(parts.join('|') || '(?!)', 'g');
  }
  Forge.stemRe = stemRe;
  // every match: {at, len}
  const hits = (n, re) => { const out = []; re.lastIndex = 0; let m; while ((m = re.exec(n))) { out.push({ at: m.index, len: m[0].length }); if (!m[0].length) re.lastIndex++; } return out; };
  const tokAt = (n, at) => { let k = 0; for (let j = 0; j < at; j++) if (n[j] === ' ') k++; return k; };
  const NEG = /^(ohne|kein|keine|keinen|keiner|keinem|no|without|nicht|weg|entferne|remove)$/;
  const negated = (toks, i) => { for (let k = 1; k <= 3 && i - k >= 0; k++) { if (NEG.test(toks[i - k])) return true; if (/^(mit|und|plus|with|and|,)$/.test(toks[i - k])) return false; } return false; };
  // type words — the earliest match wins, at the same start the longest ("Hochhaus" beats "haus", "Markthalle" beats "halle")
  const TYPE_WORDS = {
    tower: ['hochhaus', 'hochhauser', 'wolkenkratzer', 'skyscraper', 'skyscrapers', 'tower block', 'high rise', 'highrise', 'buroturm', 'wohnturm', 'wohnblock', 'burohaus', 'office tower', 'apartment tower', 'apartment block', 'hotelturm', 'turmhaus', 'hochhausturm'],
    lookout: ['aussichtsturm', 'aussichtsturme', 'wachturm', 'watchtower', 'lookout', 'lookout tower', '~turm', 'tower', 'leuchtturm', 'funkturm'],
    house: ['~haus', 'house', 'home', 'villa', 'bungalow', 'einfamilienhaus', 'wohnhaus', 'gartenhaus', 'kubus', 'cube', 'stadtvilla', 'ferienhaus', 'strandhaus'],
    bridge: ['brucke', 'brucken', 'bridge', 'viadukt', 'viaduct', 'hangebrucke', 'bogenbrucke', 'balkenbrucke', '~steg', 'footbridge', 'suspension bridge', 'arch bridge'],
    hall: ['halle', 'markthalle', 'hall', 'market hall', 'lagerhalle', 'warehouse', 'depot', 'bahnhofshalle', 'werkhalle', 'fabrikhalle', 'hangar'],
    castle: ['~burg', 'schloss', 'castle', 'festung', 'fortress', 'kastell', 'burgen', 'ritterburg'],
    shuttle: ['shuttle', 'raumschiff', 'spaceship', 'starship', 'raumfahre', 'schiff', 'ship', 'raumjager', 'frachter', 'freighter', 'gunship', 'dropship', 'interceptor'],
    park: ['~park', 'garten', 'garden', 'grunanlage', 'spielplatz', 'playground', 'stadtpark', 'parkanlage'],
    wall: ['mauer', 'wall', '~zaun', 'fence', 'hecke', 'hedge', 'stadtmauer', 'gartenzaun', 'lattenzaun', 'gartenmauer', 'steinmauer'],
    stadium: ['stadion', 'arena', 'stadium', 'fussballstadion', 'leichtathletikstadion', 'sportplatz', 'sports ground'],
  };
  const TYPE_RE = {}; for (const k in TYPE_WORDS) TYPE_RE[k] = stemRe(TYPE_WORDS[k]);
  Forge.typeOf = function (n) {
    let best = null;
    for (const id in TYPE_RE) { if (!Forge.TYPES[id]) continue; for (const h of hits(n, TYPE_RE[id])) if (!best || h.at < best.at || (h.at === best.at && h.len > best.len)) best = { id, at: h.at, len: h.len }; }
    // a compound ending ("…haus", "…turm") inside a word that is one letter off a longer type word is that word misspelt:
    // "Hochaus" is a Hochhaus, "Holzhaus" stays a house
    if (best && best.at > 0 && n[best.at - 1] !== ' ') {
      const s0 = n.lastIndexOf(' ', best.at) + 1, e0 = n.indexOf(' ', best.at), word = n.slice(s0, e0 < 0 ? n.length : e0), fz = fuzzyType(word, 1);
      if (fz && fz.meant.length > best.len && fz.id !== best.id) return Object.assign(fz, { at: s0 });
    }
    return best || fuzzyType(n);
  };
  // a typo in the type word ("Hochaus", "Wolkenkrazer", "Hängebrüke"): one letter off — two in long words — still names
  // it (the first letter has to be right; only when no type word is written correctly)
  function editDist(a, b, lim) {
    if (Math.abs(a.length - b.length) > lim) return lim + 1;
    let prev = []; for (let j = 0; j <= b.length; j++) prev.push(j);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i]; let low = i;
      for (let j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); if (cur[j] < low) low = cur[j]; }
      if (low > lim) return lim + 1;
      prev = cur;
    }
    return prev[b.length];
  }
  function fuzzyType(n, maxLim) {
    let best = null, at = 0;
    for (const t of n.split(' ')) {
      if (t.length >= 5 && /^[a-z]+$/.test(t)) {
        const lim = Math.min(maxLim || 2, t.length < 8 ? 1 : 2);
        for (const id in TYPE_WORDS) { if (!Forge.TYPES[id]) continue; for (const w of TYPE_WORDS[id]) { if (w.length < 5 || w.includes(' ') || w[0] !== t[0]) continue; const d = editDist(t, w, lim); if (d <= lim && (!best || d < best.d)) best = { id, at, len: t.length, d, said: t, meant: w }; } }
      }
      at += t.length + 1;
    }
    return best;
  }
  // materials: generic words → style ids (a type takes the first of its own styles named, else the first generic one it has)
  const MAT_WORDS = [['glas', ['glas', 'glass', 'glasfassade', 'verglast', 'curtain wall', 'glasturm']], ['beton', ['beton', 'concrete', 'sichtbeton', 'zement', 'brutalist']], ['backstein', ['backstein', 'ziegel', 'klinker', 'brick', 'bricks', 'ziegelstein', 'mauerwerk', 'rotklinker']], ['holz', ['holz', 'wood', 'wooden', 'timber', 'holzern', 'bretter', 'planken', 'balken']], ['sandstein', ['sandstein', 'sandstone', 'kalkstein', 'limestone', 'travertin']], ['stein', ['stein', 'stone', 'granit', 'granite', 'naturstein', 'bruchstein', 'steinern', 'marmor', 'marble']], ['fels', ['fels', 'felsen', 'rock', 'feldstein', 'fieldstone', 'kopfstein', 'cobble']], ['dunkel', ['dunkel', 'dunkle', 'dunklen', 'dunklem', 'dunkler', 'dunkles', 'dark', 'schwarz', 'black', 'finster', 'grim']], ['tech', ['tech', 'techno', 'sci fi', 'scifi', 'futuristisch', 'futuristic', 'starforge', 'raumstation', 'hightech', 'neon']], ['stahl', ['stahl', 'steel', 'metall', 'metal', 'eisen', 'iron']], ['metall', ['metall', 'metal', 'eisen', 'iron', 'stahl', 'steel', 'gitter']], ['weiss', ['weiss', 'white', 'putz', 'stucco', 'plaster', 'hell', 'bright']], ['anthrazit', ['anthrazit', 'anthracite', 'graphit', 'schwarz', 'black', 'dunkel', 'dark', 'grau', 'grey', 'gray']], ['japan', ['japan', 'japanisch', 'japanese', 'zen', 'kirsch', 'cherry', 'asiatisch', 'asian']], ['stadt', ['stadt', 'urban', 'city', 'stadtisch', 'modern']], ['landhaus', ['landhaus', 'rustikal', 'rustic', 'country', 'landlich', 'dorf', 'village']], ['wild', ['wild', 'wiese', 'meadow', 'natur', 'nature', 'wald', 'forest']]];
  // (a material may also begin a compound: "Holzhaus", "Glasturm", "Steinmauer", "Stadtpark")
  const MAT_RE = MAT_WORDS.map(([id, stems]) => ({ id, re: stemRe(stems), pre: new RegExp('\\b(?:' + stems.map(x => x.replace(/ /g, ' ?')).join('|') + ')', 'g') }));
  function styleOf(n, t) {
    let best = null;
    const take = (id, h) => { if (!best || h.at < best.at || (h.at === best.at && h.len > best.len)) best = { id, at: h.at, len: h.len }; };
    for (const s of t.styles) { const re = s.re || (s.re = stemRe(s.words || [s.id])); for (const h of hits(n, re)) take(s.id, h); }
    for (const m of MAT_RE) { if (!t.style(m.id)) continue; for (const h of hits(n, m.re)) take(m.id, h); for (const h of hits(n, m.pre)) take(m.id, h); }
    return best ? best.id : null;
  }
  // numbers that go with a unit word: "40 Stockwerke", "60 lang", "zwei Etagen", "30 hoch", "über 80 Blöcke"
  const UNITS = [
    ['f', /\b(\d+|[a-z]+) ?(stockwerk|stockwerke|stockwerken|etage|etagen|geschoss|geschosse|geschossen|floor|floors|storey|storeys|story|stories|level|levels|stock)\b/],
    ['f2', /\b(\d+|[a-z]+) ?(stockig|geschossig|etagig|storey|story)\w*/],
    ['l', /\b(\d+|[a-z]+) ?(lang|long|meter|metern|m lang|blocke|blocks|block|weit|span|spannweite|felder)\b/],
    ['l', /\buber (\d+)\b/],
    ['w', /\b(\d+|[a-z]+) ?(breit|wide|width|spuren|spurig)\b/],
    ['h', /\b(\d+|[a-z]+) ?(hoch|high|tall|height|hohe)\b/],
    ['t', /\b(\d+|[a-z]+) ?(turme|turmen|towers)\b/],
    ['n', /\b(\d+) x (\d+)\b/],
  ];
  // feature words per type: [param, value, stems] — "mit X" sets, "ohne X" sets the opposite (0, or the default when value is 0)
  const FEATS = {
    tower: [['c', 1, ['dachgarten', 'roof garden', 'rooftop garden', 'dachterrasse', 'garten']], ['c', 2, ['helipad', 'heliport', 'hubschrauber', 'helicopter', 'landeplatz']], ['c', 3, ['spitze', 'antenne', 'spire', 'mast', 'turmspitze', 'needle']], ['c', 0, ['flachdach', 'flat roof', 'flaches dach']], ['u', 1, ['wohnung', 'wohnungen', 'apartment', 'apartments', 'wohnen', 'wohnturm', 'appartement', 'flats', 'hotel']], ['u', 0, ['buro', 'buros', 'office', 'offices', 'buroturm', 'firma']], ['p', 3, ['sockel', 'podium', 'podest', 'plinth']], ['s', 2, ['staffel', 'staffelung', 'setback', 'setbacks', 'zuruckgesetzt', 'stufen', 'stepped', 'terrassen', 'terraced']]],
    house: [['r', 0, ['flachdach', 'flat roof', 'flat']], ['r', 1, ['pultdach', 'pult', 'shed roof', 'mono pitch', 'monopitch', 'schragdach', 'sloped roof']], ['t', 1, ['terrasse', 'terrace', 'patio', 'veranda', 'deck']], ['c', 1, ['carport', 'garage', 'stellplatz', 'parkplatz']], ['b', 1, ['balkon', 'balkone', 'balcony', 'balconies']], ['p', 1, ['pool', 'schwimmbad', 'swimming pool', 'schwimmbecken']], ['g', 2, ['panorama', 'panoramafenster', 'glasfront', 'viel glas', 'bodentief', 'bodentiefe', 'floor to ceiling', 'glass front', 'glass walls', 'glaswande', 'ganz aus glas']], ['g', 0, ['kleine fenster', 'small windows', 'wenig glas', 'little glass', 'normale fenster']]],
    bridge: [['k', 2, ['hangebrucke', 'hange', 'suspension', 'seile', 'kabel', 'cables', 'cable', 'pylon', 'pylone']], ['k', 1, ['bogen', 'bogenbrucke', 'arch', 'arched', 'arches', 'viadukt', 'viaduct', 'aquadukt']], ['k', 0, ['balken', 'balkenbrucke', 'beam', 'girder', 'trager', 'flach', 'flat']], ['r', 1, ['strasse', 'strassen', 'road', 'autos', 'auto', 'cars', 'car', 'autobahn', 'fahrbahn', 'highway', 'verkehr']], ['r', 0, ['weg', 'fussweg', 'fussganger', 'path', 'footpath', 'footbridge', 'steg', 'pedestrian', 'holzsteg', 'walkway']], ['m', 1, ['laterne', 'laternen', 'lampe', 'lampen', 'lamps', 'lamp', 'lights', 'licht', 'beleuchtet', 'lit']], ['m', 0, ['unbeleuchtet', 'ohne licht', 'dark']]],
    lookout: [['k', 0, ['gitter', 'lattice', 'fachwerk', 'stahlfachwerk', 'gerust', 'truss', 'offen', 'open']], ['k', 1, ['massiv', 'solid', 'gemauert', 'stein', 'stone', 'rund', 'round', 'leuchtturm']], ['r', 1, ['dach', 'roof', 'uberdacht', 'covered', 'hutte']], ['r', 0, ['ohne dach', 'no roof', 'offene plattform', 'open platform']], ['p', 7, ['grosse plattform', 'big platform', 'large platform', 'breite plattform']]],
    hall: [['m', 1, ['markt', 'market', 'stande', 'stalls', 'stall', 'marktstande', 'markthalle', 'bazaar', 'basar', 'verkauf', 'laden']], ['m', 0, ['leer', 'empty', 'lager', 'lagerhalle', 'depot', 'warehouse', 'hangar', 'werkstatt', 'workshop', 'werkhalle', 'fabrikhalle', 'fabrik', 'factory', 'industriehalle', 'industrie', 'produktion', 'maschinen']], ['c', 1, ['saulen', 'saule', 'columns', 'column', 'pfeiler', 'pillars', 'arkaden']], ['c', 0, ['stutzenfrei', 'ohne saulen', 'no columns', 'freitragend']]],
    castle: [['k', 1, ['bergfried', 'keep', 'donjon', 'palas', 'wohnturm', 'hauptturm', 'burgfried']], ['k', 0, ['ohne bergfried', 'no keep', 'ringmauer', 'nur mauern']], ['t', 1, ['rund', 'runde', 'round', 'rundturm', 'rundturme', 'round towers']], ['t', 0, ['eckig', 'eckige', 'square', 'quadratisch', 'viereckig', 'square towers']]],
    shuttle: [['a', 0, ['shuttle', 'fahre', 'raumfahre', 'transporter']], ['a', 1, ['interceptor', 'jager', 'raumjager', 'fighter', 'abfangjager']], ['a', 2, ['gunship', 'kanonenboot', 'kampfschiff', 'warship']], ['a', 3, ['racer', 'renner', 'rennschiff', 'racing']], ['a', 4, ['dropship', 'lander', 'landungsschiff', 'landefahre']], ['a', 5, ['frachter', 'freighter', 'cargo', 'frachtschiff', 'transportschiff', 'hauler']], ['p', 1, ['landeplatz', 'landing pad', 'pad', 'plattform', 'platform', 'landebahn']], ['h', 1, ['hangar', 'halle', 'uberdacht', 'covered', 'dach', 'roof']], ['s', 1, ['bodenstation', 'station', 'kontrollraum', 'leitstand', 'control', 'tankstelle', 'fuel']], ['g', 1, ['gangway', 'rampe', 'ramp', 'treppe', 'stairs', 'einstieg']], ['m', 1, ['leuchtfeuer', 'beacons', 'beacon', 'lichter', 'lights', 'lampen']]],
    park: [['p', 1, ['teich', 'pond', 'see', 'lake', 'weiher', 'wasser', 'water', 'ententeich']], ['f', 1, ['brunnen', 'fountain', 'springbrunnen', 'wasserspiel']], ['t', 3, ['viele baume', 'many trees', 'wald', 'forest', 'waldchen', 'dicht', 'dense', 'baumreich']], ['t', 1, ['wenige baume', 'few trees', 'wiese', 'meadow', 'rasen', 'lawn', 'licht', 'offen', 'open']]],
    wall: [['k', 1, ['zaun', 'fence', 'lattenzaun', 'gartenzaun', 'holzzaun', 'picket', 'gitterzaun', 'eisenzaun']], ['k', 2, ['hecke', 'hedge', 'buchsbaum', 'buchs', 'hedgerow']], ['k', 0, ['mauer', 'wall', 'stadtmauer', 'steinmauer', 'gartenmauer', 'ziegelmauer']], ['g', 1, ['tor', 'gate', 'tur', 'door', 'gartentor', 'durchgang', 'opening', 'eingang']]],
    stadium: [['r', 1, ['dach', 'roof', 'uberdacht', 'covered']], ['r', 0, ['offen', 'open', 'ohne dach']], ['k', 1, ['leichtathletik', 'leichtathletikstadion', 'laufbahn', 'athletics', 'running track', 'tartanbahn', 'olympia', 'olympic']], ['k', 0, ['fussball', 'fussballstadion', 'football', 'soccer', 'fussballfeld']]],
  };
  const FEAT_RE = {}; for (const id in FEATS) FEAT_RE[id] = FEATS[id].map(([k, v, stems]) => ({ k, v, re: stemRe(stems) }));
  // size words: klein ×0.62 · groß ×1.4 · riesig ×2 — and "hoch / tall / niedrig" for the height alone
  function sizeWord(n) {
    if (/\b(riesig\w*|riesen\w*|gigantisch\w*|enorm\w*|huge|giant|gigantic|massiv\w*|monumental\w*|mega)\b/.test(n)) return { k: 2 };
    if (/\b(winzig\w*|mini|tiny|klitzeklein\w*)\b/.test(n)) return { k: 0.45 };
    if (/\b(klein|kleine|kleinen|kleiner|kleines|small|little)\b/.test(n)) return { k: 0.62 };
    if (/\b(niedrig\w*|low|flach|flache|flaches|flacher)\b/.test(n)) return { k: 0.62, up: true };
    if (/\b(gross|grosse|grossen|grosser|grosses|big|large|machtig\w*|mighty|grand)\b/.test(n)) return { k: 1.4 };
    if (/\b(hoch|hohe|hohen|hoher|hohes|tall|high)\b/.test(n)) return { k: 1.4, up: true };
    return { k: 1 };
  }
  // the parameters a size word scales (the type's main dimensions), and its height alone
  const SIZE_KEYS = { tower: ['f', 'w', 'd'], house: ['w', 'd'], bridge: ['l'], lookout: ['h'], hall: ['l', 'w'], castle: ['w', 'd'], shuttle: [], park: ['w', 'd'], wall: ['l'], stadium: ['l', 'w'] };
  const UP_KEYS = { tower: ['f'], house: ['f'], lookout: ['h'], hall: ['h'], castle: ['h'], wall: ['h'], stadium: ['t'] };
  // the words of a wish applied to a parameter set
  function applyWords(n, raw, P, t) {
    const toks = n.split(' ');
    const set = (k, v) => { if (t.byKey[k]) P.params[k] = v; };
    // numbers with units ("a tall …" and "ein hoher …" are no numbers: an article counts only for floors — "ein Stockwerk")
    let rest = n;
    const pinned = new Set();
    for (const [key, re] of UNITS) {
      const m = re.exec(n); if (!m) continue;
      if (key === 'n') { set('w', +m[1]); set('d', +m[2]); pinned.add('w'); pinned.add('d'); rest = rest.replace(m[0], ' '); continue; }
      const v = numOf(m[1]); if (v === null) continue;
      if (!/^\d+$/.test(m[1]) && (m[1] === 'a' || ((key !== 'f' && key !== 'f2') && v < 2))) continue;
      rest = rest.replace(m[0], ' '); pinned.add(key === 'f2' ? 'f' : key);
      if (key === 'f' || key === 'f2') { if (t.byKey.f) set('f', v); else if (t.id === 'lookout') set('h', v * 4); continue; }
      if (key === 'h') { if (t.byKey.h) set('h', v); else if (t.id === 'tower') set('f', Math.max(4, Math.round(v / 4))); continue; }
      if (key === 'l') { if (t.byKey.l) set('l', v); else if (t.byKey.d && !t.byKey.w) set('d', v); continue; }
      set(key, v);
    }
    // size words (only where no number pinned that parameter; the words a unit used — "3 hoch" — are not read again)
    const sw = sizeWord(rest), k = sw.k;
    if (k !== 1) for (const key of (sw.up ? UP_KEYS : SIZE_KEYS)[t.id] || []) { const p = t.byKey[key]; if (!p || pinned.has(key) || (key === 'f' && pinned.has('h'))) continue; const base = P.params[key] !== undefined ? P.params[key] : p.def; P.params[key] = clamp(Math.round(base * (key === 'f' && k > 1 ? Math.min(k, 1.6) : k)), p.min, p.max); }
    // features (negation within three words: "ohne Balkon", "kein Pool")
    for (const f of FEAT_RE[t.id] || []) for (const h of hits(n, f.re)) {
      const neg = negated(toks, tokAt(n, h.at)), p = t.byKey[f.k]; if (!p) continue;
      if (!neg) P.params[f.k] = f.v;
      else P.params[f.k] = f.v === 0 ? p.def : (p.min === 0 && p.max === 1 ? 0 : (f.v === p.def ? p.min : p.def));
    }
    const st = styleOf(n, t); if (st) P.style = st;
    const sd = /#([0-9a-f]{1,8})\b/.exec(n); if (sd) P.seed = parseInt(sd[1], 16) >>> 0;
    return P;
  }
  // a wish in German or English → DNA (null when no type is named and no base is given)
  Forge.fromText = function (text, base) {
    const raw = String(text || ''), n = norm(raw);
    const B = base ? Forge.parse(base) : null;
    const ty = Forge.typeOf(n);
    if (!ty && !B) return null;
    const t = Forge.TYPES[ty ? ty.id : B.type];
    const P = B && B.type === t.id ? { type: t.id, params: Object.assign({}, B.params), style: B.style, seed: B.seed } : { type: t.id, params: {}, style: null, seed: B ? B.seed : (hashStr(n) & 0xffff) || 1 };
    if (!B) { const sd = /#([0-9a-f]{1,8})\b/.exec(n); if (!sd) P.seed = (hashStr(n) & 0xffff) || 1; }
    applyWords(n, raw, P, t);
    return Forge.dna(P);
  };
  // relative changes on an existing DNA: höher, niedriger, breiter, schmaler, länger, kürzer, größer, kleiner, mehr Glas, mehr/weniger Stockwerke/Bäume …
  const REL = [
    [/\b(hoher|taller|higher|mehr hohe)\b/, (P, t) => grow(P, t, t.byKey.f ? 'f' : 'h', 1.25)],
    [/\b(niedriger|lower|flacher|shorter|weniger hoch)\b/, (P, t) => grow(P, t, t.byKey.f ? 'f' : 'h', 0.8)],
    [/\b(breiter|wider|broader)\b/, (P, t) => { grow(P, t, 'w', 1.25); if (!t.byKey.w) grow(P, t, 'p', 1.3); }],
    [/\b(schmaler|narrower|slimmer|dunner|thinner)\b/, (P, t) => { grow(P, t, 'w', 0.8); if (!t.byKey.w) grow(P, t, 'p', 0.75); }],
    [/\b(langer|longer)\b/, (P, t) => grow(P, t, t.byKey.l ? 'l' : 'd', 1.25)],
    [/\b(kurzer|shorter)\b/, (P, t) => grow(P, t, t.byKey.l ? 'l' : 'd', 0.8)],
    [/\b(tiefer|deeper)\b/, (P, t) => grow(P, t, 'd', 1.25)],
    [/\b(grosser|bigger|larger)\b/, (P, t) => { for (const k of SIZE_KEYS[t.id] || []) grow(P, t, k, 1.25); }],
    [/\b(kleiner|smaller)\b/, (P, t) => { for (const k of SIZE_KEYS[t.id] || []) grow(P, t, k, 0.8); }],
    [/\b(mehr glas|more glass|glasiger|verglaster)\b/, (P, t) => { if (t.style('glas')) P.style = 'glas'; if (t.byKey.g) grow(P, t, 'g', 1, 1); }],
    [/\b(weniger glas|less glass)\b/, (P, t) => { if (t.byKey.g) grow(P, t, 'g', 1, -1); else if (P.style === 'glas' && t.styles[1]) P.style = t.styles[1].id; }],
    [/\b(mehr (stockwerke|etagen|geschosse|floors|storeys))\b/, (P, t) => grow(P, t, 'f', 1, 4)],
    [/\b(weniger (stockwerke|etagen|geschosse|floors|storeys))\b/, (P, t) => grow(P, t, 'f', 1, -4)],
    [/\b(mehr (baume|trees))\b/, (P, t) => grow(P, t, 't', 1, 1)],
    [/\b(weniger (baume|trees))\b/, (P, t) => grow(P, t, 't', 1, -1)],
    [/\b(mehr (turme|towers))\b/, (P, t) => grow(P, t, 't', 1, 1)],
    [/\b(mehr (saulen|columns))\b/, (P, t) => grow(P, t, 'c', 1, 1)],
    [/\b(anders|andere|other|another|neu wurfeln|wurfeln|random|zufall)\b/, (P) => { P.seed = ((P.seed * 1103515245 + 12345) >>> 0) & 0xffff || 1; }],
  ];
  function grow(P, t, k, mul, add) { const p = t.byKey[k]; if (!p) return; const v = P.params[k] !== undefined ? P.params[k] : p.def; let nv = Math.round(v * mul) + (add || 0); if (mul !== 1 && nv === v) nv = v + (mul > 1 ? 1 : -1); P.params[k] = clamp(nv, p.min, p.max); }
  Forge.tweak = function (dna, text) {
    const B = Forge.parse(dna); if (!B) return dna;
    const n = norm(text), ty = Forge.typeOf(n);
    const t = Forge.TYPES[ty && ty.id !== B.type ? ty.id : B.type];
    const P = t.id === B.type ? { type: t.id, params: Object.assign({}, B.params), style: B.style, seed: B.seed } : { type: t.id, params: {}, style: null, seed: B.seed };
    // the relative words act once: "höher" makes it taller — it is not read again as "hoher" (a size word) after that
    let rest = n;
    for (const [re, fn] of REL) if (re.test(n)) { fn(P, t); rest = rest.replace(new RegExp(re.source, 'g'), ' '); }
    applyWords(rest.replace(/\s+/g, ' ').trim(), text, P, t);
    return Forge.dna(P);
  };
  // n nearby variants for a 3 × 3 grid: the DNA itself first, then other seeds, every other one with a nudged dimension, every third with the next style
  Forge.variants = function (dna, n) {
    const B = Forge.parse(dna); if (!B) return [];
    const t = Forge.TYPES[B.type], out = [Forge.dna(B)], seen = new Set(out), dims = t.params.filter(p => p.dim && p.max > p.min);
    let seed = B.seed >>> 0;
    for (let k = 1; k < (n || 9); k++) {
      seed = (((seed ^ (k * 0x9e3779b9)) * 1103515245 + 12345) >>> 0) & 0xffff; if (!seed) seed = k;
      const P = { type: B.type, params: Object.assign({}, B.params), style: B.style, seed };
      // the nudge is relative (a sixth of the value, at least a 24th of the range): 30 floors → 25 / 35, 12 → 9 / 15
      if (k % 2 === 1 && dims.length) { const p = dims[(k >> 1) % dims.length], v = B.params[p.k], step = Math.max(p.step || 1, Math.round(v / 6), Math.round((p.max - p.min) / 24)), dir = ((k >> 1) & 1) ? 1 : -1; P.params[p.k] = clamp(v + dir * step, p.min, p.max); if (P.params[p.k] === v) P.params[p.k] = clamp(v - dir * step, p.min, p.max); }
      if (k % 3 === 0 && t.styles.length > 1) { const i = t.styles.findIndex(s => s.id === B.style); P.style = t.styles[(i + (k / 3)) % t.styles.length].id; }
      let d = Forge.dna(P); let guard = 0;
      while (seen.has(d) && guard++ < 16) { P.seed = (P.seed + 1) & 0xffff || 1; d = Forge.dna(P); }
      seen.add(d); out.push(d);
    }
    return out;
  };
  // "Hochhaus · 42 Stockwerke · 18 × 18 · Glas · Helipad"
  Forge.describe = function (dna, short) {
    const P = Forge.parse(dna); if (!P) return '';
    const t = Forge.TYPES[P.type], st = t.style(P.style);
    const parts = (t.describe ? t.describe(P, st) : []).filter(Boolean);
    const head = (short ? t.icon + ' ' : '') + (t.title ? t.title(P) : t.name);   // what it is, by its parameters
    return short ? head + (parts[0] ? ' · ' + parts[0] : '') : [head].concat(parts, st ? [st.name] : []).join(' · ');
  };
})(VR);
