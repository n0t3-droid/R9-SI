// ============================================================================
// 🔍 Block finden (a-builder; plan docs/superpowers/plans/2026-10-30-a-builder.md §2.2): the pure part of the creative
// picker — the search over both languages and the id (umlauts folded, every word of the query must match, ranked: a
// whole word before a word start before a part of a compound before a loose subsequence; the plain block before its
// slab, stairs, wall), the eight material families and sixteen colours (by the words of the id, our own lists), and the
// recent list (the last blocks placed or picked, newest first; kept in this browser under r9si.recent).
// VR.PickFind: fold(s) · index(ids, namesOf) · searchIndex(idx, q, max) · search(ids, q, namesOf, max) ·
// familyOf(id, emit) · colourOf(id) · filter(ids, {family, colour}, emitOf) · pushRecent(list, id, max) ·
// recent() · noteRecent(id) · FAMILIES · COLOURS. No DOM in the pure part (test/pickfind.js).
// ============================================================================
(function (VR) {
  'use strict';
  const PF = VR.PickFind = {};
  const SPELL = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };
  PF.fold = (s) => String(s == null ? '' : s).toLowerCase().replace(/[äöüß]/g, (c) => SPELL[c]).normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  const VARIANT = { slab: 1, stairs: 1, wall: 1, fence: 1, carpet: 1, pane: 1, gate: 1, gloss: 1, pillar: 1 };

  // ---- the search
  PF.index = function (ids, namesOf) {
    const out = new Array(ids.length);
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i], hays = [];
      const ns = namesOf ? namesOf(id) : null;
      if (ns) for (const n of ns) if (n) hays.push(PF.fold(n));
      hays.push(PF.fold(id));
      let len = 1e9; const words = [];
      for (const h of hays) { len = Math.min(len, h.length); for (const w of h.split(/[\s\-/]+/)) if (w) words.push(w); }
      const idw = id.split('_'); let variant = false; for (const w of idw) if (VARIANT[w]) variant = true;
      out[i] = { id, words, hays: hays.map(h => h.replace(/ /g, '')), len, variant, first: hays[0] ? hays[0].split(' ')[0] : '' };
    }
    return out;
  };
  const subseq = (q, s) => { let j = 0; for (let i = 0; i < s.length && j < q.length; i++) if (s.charCodeAt(i) === q.charCodeAt(j)) j++; return j === q.length; };
  const tokenScore = (e, t) => {
    let best = 0;
    const W = e.words;
    for (let i = 0; i < W.length; i++) {
      const w = W[i];
      if (w === t) return 100;
      if (best < 70 && w.startsWith(t)) best = 70;
      else if (best < 40 && t.length >= 3 && w.indexOf(t) > 0) best = 40;
    }
    if (!best && t.length >= 3) for (const h of e.hays) if (h.charCodeAt(0) === t.charCodeAt(0) && subseq(t, h)) { best = 10; break; }
    return best;
  };
  PF.searchIndex = function (idx, q, max) {
    const toks = PF.fold(q).split(' ').filter(Boolean), lim = max || 600;
    if (!toks.length) return idx.slice(0, lim).map(e => e.id);
    const hits = [];
    for (let i = 0; i < idx.length; i++) {
      const e = idx[i]; let sc = 0;
      for (let k = 0; k < toks.length; k++) { const s = tokenScore(e, toks[k]); if (!s) { sc = 0; break; } sc += s; }
      if (!sc) continue;
      if (e.first === toks[0]) sc += 8;   // the name begins with the first word: „Stein" before „Steinziegel"
      if (e.variant) sc -= 15;            // the plain block before its slab and stairs
      sc -= e.len * 0.5;
      hits.push([sc, i]);
    }
    hits.sort((a, b) => b[0] - a[0] || a[1] - b[1]);
    const out = []; for (let i = 0; i < hits.length && i < lim; i++) out.push(idx[hits[i][1]].id);
    return out;
  };
  PF.search = (ids, q, namesOf, max) => PF.searchIndex(PF.index(ids, namesOf), q, max);

  // ---- the families (the words of the id; the order decides: oak leaves are a plant, a lantern of iron is a light)
  PF.FAMILIES = [
    { id: 'wood', icon: '🪵', de: 'Holz', en: 'Wood' },
    { id: 'stone', icon: '🪨', de: 'Stein', en: 'Stone' },
    { id: 'brick', icon: '🧱', de: 'Ziegel', en: 'Brick' },
    { id: 'glass', icon: '🪟', de: 'Glas', en: 'Glass' },
    { id: 'metal', icon: '⚙️', de: 'Metall', en: 'Metal' },
    { id: 'plant', icon: '🌿', de: 'Pflanzen', en: 'Plants' },
    { id: 'light', icon: '💡', de: 'Licht', en: 'Light' },
    { id: 'ground', icon: '⛰️', de: 'Boden', en: 'Ground' },
  ];
  const set = (s) => { const o = {}; for (const w of s.split(' ')) o[w] = 1; return o; };
  const WORDS = [
    ['light', set('lamp lantern torch light glow glowstone beacon candle neon sconce chandelier led lightstrip spotlight lamppost streetlight firefly')],
    ['glass', set('glass window pane glazing skylight')],
    ['plant', set('leaves leaf flower flowers grass moss fern vine vines sapling bush tulip rose mushroom plant plants reed reeds cactus lily hedge ivy poppy dandelion orchid daisy lilac peony sunflower wheat crop roots kelp seagrass coral petals shrub bloom blossom azalea lichen')],
    ['metal', set('iron copper gold steel metal chain bars grate aluminium aluminum chrome brass bronze tin zinc titanium anvil rail rails')],
    ['brick', set('brick bricks clinker tile tiles')],
    ['wood', set('log logs wood planks plank stalk hyphae bamboo bookshelf timber beam oak spruce birch jungle acacia mangrove cherry poplar walnut pine teak')],
    ['stone', set('stone cobblestone cobbled granite diorite andesite deepstone tuff basalt scoria slate marble flagstone cinnabar sulfur tidestone emberrock voidstone lilacite quartz sandstone stucco concrete terracotta plaster obsidian asphalt calcite rock pebble cobble boulder')],
    ['ground', set('dirt sand gravel clay mud snow ice soil podzol path farmland mycelium loam')],
  ];
  PF.familyOf = function (id, emit) {
    const ws = String(id).split('_');
    if (emit > 0) return 'light';
    for (const [f, S] of WORDS) for (const w of ws) if (S[w] || (f === 'stone' && w.length > 5 && w.endsWith('stone'))) return f;
    return 'other';
  };
  PF.COLOURS = [
    { id: 'white', hex: '#f2f2ee', de: 'Weiß', en: 'White' }, { id: 'light_gray', hex: '#a9aaa6', de: 'Hellgrau', en: 'Light grey' },
    { id: 'gray', hex: '#5a5e62', de: 'Grau', en: 'Grey' }, { id: 'black', hex: '#1d1e22', de: 'Schwarz', en: 'Black' },
    { id: 'brown', hex: '#7a5232', de: 'Braun', en: 'Brown' }, { id: 'red', hex: '#b3312c', de: 'Rot', en: 'Red' },
    { id: 'orange', hex: '#e8792a', de: 'Orange', en: 'Orange' }, { id: 'yellow', hex: '#f2cd36', de: 'Gelb', en: 'Yellow' },
    { id: 'lime', hex: '#7cc62e', de: 'Hellgrün', en: 'Lime' }, { id: 'green', hex: '#4f6b25', de: 'Grün', en: 'Green' },
    { id: 'cyan', hex: '#178b93', de: 'Türkis', en: 'Cyan' }, { id: 'light_blue', hex: '#4fa8de', de: 'Hellblau', en: 'Light blue' },
    { id: 'blue', hex: '#33449c', de: 'Blau', en: 'Blue' }, { id: 'purple', hex: '#7a2fb0', de: 'Lila', en: 'Purple' },
    { id: 'magenta', hex: '#bd45b6', de: 'Magenta', en: 'Magenta' }, { id: 'pink', hex: '#ee90ad', de: 'Rosa', en: 'Pink' },
  ];
  const CBY = {}; for (const c of PF.COLOURS) CBY[c.id] = c;
  PF.colourOf = function (id) {
    const ws = String(id).split('_');
    for (let i = 0; i < ws.length; i++) {
      if ((ws[i] === 'light' || ws[i] === 'dark') && ws[i + 1]) { const two = ws[i] + '_' + ws[i + 1]; if (CBY[two]) return two; }
      if (ws[i] === 'grey') return 'gray';
      if (CBY[ws[i]]) return ws[i];
    }
    return null;
  };
  PF.filter = function (ids, o, emitOf) {
    const out = [];
    for (const id of ids) {
      if (o.family && PF.familyOf(id, emitOf ? emitOf(id) : 0) !== o.family) continue;
      if (o.colour && PF.colourOf(id) !== o.colour) continue;
      out.push(id);
    }
    return out;
  };

  // ---- the recent list
  PF.RECENT_MAX = 12;
  PF.pushRecent = function (list, id, max) {
    if (!id) return list;
    const out = [id]; for (const x of list) if (x !== id && out.length < (max || PF.RECENT_MAX)) out.push(x);
    return out;
  };
  const KEY = 'r9si.recent';
  let rec = null;
  PF.recent = function () {
    if (rec) return rec;
    rec = [];
    try { const o = JSON.parse((typeof localStorage !== 'undefined' && localStorage.getItem(KEY)) || '[]'); if (Array.isArray(o)) rec = o.filter(x => typeof x === 'string').slice(0, PF.RECENT_MAX); } catch (e) { rec = []; }
    return rec;
  };
  PF.noteRecent = function (id) {
    const before = PF.recent();
    if (before[0] === id) return;
    rec = PF.pushRecent(before, id, PF.RECENT_MAX);
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(rec)); } catch (e) { /* full or blocked: this page only */ }
  };
})(VR);
