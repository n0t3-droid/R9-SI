// ============================================================================
// R9 Studio · 🧱 Teile, 🎯 Finden, ★ Favoriten (v0.37)
// 🧱 Teile — every block of the game in one catalogue, by what it is for: roofs,
//    lights, windows & glass, doors, walls, floors, stairs, rails & columns,
//    garden & nature, decoration, colours — with search and ★ Favoriten.
// 🎯 in Architektur: a tap on a house finds what is there. All of it lights up in
//    the house; the right side shows it (picture, name, how many, ★) with
//    "🔍 Im Katalog" (the catalogue opens on it — "← zurück" returns to the house)
//    and "⚒ Benutzen" (into the Crafter's hand, in this house).
// ★ the same favourites everywhere (VR.Favs): here, in Möbel / Fassade, the
//    Crafter's palette, the Werkbank, the world's furniture, the game's inventory.
// ============================================================================
(function () {
  'use strict';
  const C = window.__studioCore; if (!C) return;
  const { S, HOOK, $, $$ } = C;
  const R = VR.R, T = R.T, VM = VR.VM, VX = VR.VX, PH = VR.PHYS;
  const FV = () => VR.Favs;
  const L = (k, de, v) => (VR.I18N && VR.I18N.t ? VR.I18N.t(k, v, de) : String(de).replace(/\{(\w+)\}/g, (m, x) => (v && v[x] !== undefined ? v[x] : m)));
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const CAT = VR.StudioCatalog = { cat: 'all', sel: null, pick: null, lastHouse: null, edit: false, restore: null };
  const SA = !!C.SA;

  // ---------------------------------------------------------------- every block, by what it is for
  const KINDS = [['fav', '★', 'Favoriten'], ['all', '', 'Alle'], ['roof', '🏠', 'Dach'], ['light', '💡', 'Licht'], ['glass', '🪟', 'Fenster & Glas'], ['door', '🚪', 'Türen'], ['wall', '🧱', 'Wände'], ['floor', '🟫', 'Böden'], ['stairs', '🪜', 'Treppen & Stufen'], ['rail', '🏛', 'Geländer & Säulen'], ['garden', '🌳', 'Garten & Natur'], ['deco', '🪴', 'Deko & Dinge'], ['color', '🎨', 'Farben'], ['other', '…', 'Sonstiges']];
  KINDS.splice(2, 0, ['modern', '✨', 'Modern']);   // the Modern Living pack (voxmodern.js): its models show here with their pictures
  const RX = [
    ['roof', /roof|(^|_)hip(_|$)|ridge|gutter|downpipe|shingle|thatch|chimney|(^|_)eaves?(_|$)|dormer|skylight|soffit|fascia/],
    ['glass', /glass|window|_pane$|_panes$|skylight|panorama/],
    ['door', /door|trapdoor|_gate$|^gate_/],
    ['stairs', /_stairs$|_slab$|_step$|_steps$|ladder/],
    ['rail', /fence|(^|_)rails?(_|$)|railing|balust|column|pillar|_post$|_bars$|pergola|banister/],
    ['color', /^vollton_|_wool$|_concrete$|_terracotta$|_stained_glass|_carpet$/],
    ['garden', /hedge|bush|flower|plant|_tree|crown|trunk|frond|palm|grass|leaves|sapling|vine|moss|fern|planter|urn|fountain|garden|lawn|^dirt|_dirt$|sand$|gravel|soil|mud|farmland|wheat|carrot|potato|crop|_log$|_wood$|water|lily|cactus|mushroom|reed|seagrass|kelp|coral|^stone$|cobblestone|_ore$|snow|(^|_)ice$|pumpkin|melon|(^|_)hay(_|$)|boulder|pond/],
    ['floor', /floor|deck|parquet|carpet|rug|paver|terrazzo|porcelain|tile|planks|herringbone|path$|_path|mosaic|linoleum/],
    ['wall', /stucco|plaster|brick|clinker|concrete|panel|cladding|siding|stone|trim|cornice|wall|bossed|stacked|travertine|marble|granite|timber|cement|facade|_block$|bricks$|metal|steel|copper/],
  ];
  const LIGHTRX = /lamp|lantern|(^|_)lights?(_|$)|light_?bar|(^|_)led(_|$)|(^|_)spot(_|$)|spotlight|chandelier|pendant|glowstone|torch|candle|neon|sconce|beacon|froglight/;
  const NOTLIGHT = /^(light_gray|light_blue)_|_(light_gray|light_blue)(_|$)/;
  let ENT = null, BYID = null;
  function entries() {
    if (ENT) return ENT;
    ENT = []; BYID = new Map();
    for (const t of R.types) {
      if (!t || !t.cat || t.o.noItem || t.o.cutOf || t.name === 'air') continue;
      if (t.o.modern && VM.MODELS[t.name]) { const e = { id: t.name, t, kinds: t.o.toggle ? ['modern', 'light'] : ['modern'] }; ENT.push(e); BYID.set(t.name, e); continue; }
      if (VM.MODELS[t.name]) continue;   // furniture and facade pieces live in Möbel and Fassade
      if (t.o.kind === 'model' && t.has && t.has('part') && !(VX.spec && VX.spec(t.defaultState))) continue;
      const n = t.name, kinds = [];
      if ((T.emit && T.emit[t.defaultState] > 0) || (LIGHTRX.test(n) && !NOTLIGHT.test(n))) kinds.push('light');
      for (const [k, re] of RX) if (re.test(n) && !kinds.includes(k)) kinds.push(k);
      if (!kinds.length && /^vx_/.test(n)) kinds.push('deco');
      if (!kinds.length) kinds.push('other');
      const e = { id: n, t, kinds }; ENT.push(e); BYID.set(n, e);
    }
    return ENT;
  }
  // a whole catalogue house as a favourite: blueprint_<i>
  const houseOf = (id) => { const m = /^blueprint_(\d+)$/.exec(id || ''); if (!m) return null; const h = C.HOUSES.find(x => x.i === +m[1]); return h || null; };
  const disp = (id) => { const t = R.byName[id]; if (VM.MODELS[id]) return VM.MODELS[id].display; const h = houseOf(id); if (h) return h.name; if (t) return t.display || (t.o && t.o.display) || id; return VR.ITEMS && VR.ITEMS[id] ? VR.ITEMS[id].name || id : id; };
  const kindLabel = (k) => { const e = KINDS.find(x => x[0] === k); return e ? (e[1] ? e[1] + ' ' : '') + L('cat.' + k, e[2]) : k; };
  CAT.kindsOf = (id) => { entries(); const e = BYID.get(id); return e ? e.kinds : []; };

  // ---------------------------------------------------------------- search: whole words first, German words too
  // ("lampe", "dach", "fenster", "weiß" find what is called lamp, roof, window, white); "led" is not "chiseled"
  const DE = { lampe: 'lamp', lampen: 'lamp', leuchte: 'light lamp', licht: 'light', strahler: 'spot', laterne: 'lantern', fackel: 'torch', kerze: 'candle', kronleuchter: 'chandelier',
    fenster: 'window pane glass', glas: 'glass', scheibe: 'pane glass', tur: 'door', tuer: 'door', tor: 'gate door', treppe: 'stairs', stufe: 'slab step stairs', stufen: 'slab step stairs', leiter: 'ladder',
    dach: 'roof', dachziegel: 'roof tile', ziegel: 'tile brick roof', first: 'ridge', schindel: 'shingle', stroh: 'thatch', rinne: 'gutter', schornstein: 'chimney', kamin: 'chimney fireplace',
    wand: 'wall', mauer: 'wall brick', putz: 'plaster stucco', stein: 'stone', backstein: 'brick', klinker: 'clinker brick', beton: 'concrete', marmor: 'marble', granit: 'granite', holz: 'wood planks oak',
    leiste: 'trim', gesims: 'cornice trim', sims: 'cornice trim', streifen: 'strip', band: 'band strip', saule: 'column pillar', saeule: 'column pillar', pfeiler: 'pillar', gelander: 'rail railing balustrade', gelaender: 'rail railing balustrade', zaun: 'fence',
    boden: 'floor', parkett: 'parquet', fliese: 'tile', fliesen: 'tile', kachel: 'tile', teppich: 'carpet rug', terrasse: 'deck terrace', weg: 'path', pflaster: 'paver cobble',
    pflanze: 'plant', blume: 'flower', blumen: 'flower', baum: 'tree log', busch: 'bush', hecke: 'hedge', gras: 'grass', rasen: 'grass lawn', erde: 'dirt soil', sand: 'sand', kies: 'gravel', wasser: 'water', eis: 'ice', schnee: 'snow', blatter: 'leaves', blaetter: 'leaves',
    weiss: 'white', schwarz: 'black', rot: 'red', blau: 'blue', grun: 'green', gruen: 'green', gelb: 'yellow', grau: 'gray grey', braun: 'brown', rosa: 'pink', lila: 'purple violet', tuerkis: 'teal cyan', turkis: 'teal cyan', gold: 'gold', silber: 'silver', hell: 'light', dunkel: 'dark',
    metall: 'metal', stahl: 'steel', kupfer: 'copper', eisen: 'iron', wolle: 'wool', regal: 'shelf', tisch: 'table', stuhl: 'chair', bett: 'bed', schrank: 'cabinet wardrobe', kuche: 'kitchen', kueche: 'kitchen', bad: 'bath' };
  const fold = (t) => String(t).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
  const toksOf = new Map();
  const toks = (id) => { let t = toksOf.get(id); if (!t) { t = fold(id + ' ' + disp(id)).split(/[\s_\-·,.()/]+/).filter(Boolean); toksOf.set(id, t); } return t; };
  function wordScore(id, w) {
    let best = 0;
    for (const t of toks(id)) { if (t === w) return 3; if (t.startsWith(w)) best = Math.max(best, 2); else if (w.length >= 4 && t.includes(w)) best = Math.max(best, 1); }
    return best;
  }
  // a German word's meaning, also when it is inflected ("weiße", "roten", "Fenstern", "Lampen")
  const deOf = (w) => { for (const v of [w, w.replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u')]) for (const c of [v, v.replace(/(en|er|es|em|e|n|s)$/, ''), v.replace(/(e|n|s)$/, '')]) if (c.length >= 2 && DE[c]) return DE[c]; return null; };
  // how well an id fits the words (0 = not at all): every word must fit, by itself or as its German meaning
  CAT.score = function (id, q) {
    const words = fold(q).split(/\s+/).filter(Boolean); if (!words.length) return 1;
    let sc = 0;
    for (const w of words) {
      let b = wordScore(id, w);
      const de = deOf(w);
      if (de) for (const e of de.split(' ')) b = Math.max(b, wordScore(id, e) - 0.5);
      if (!b) { const kk = CAT.kindsOf(id).map(k => fold(kindLabel(k))); if (kk.some(k => k.includes(w))) b = 0.5; }
      if (!b) return 0;
      sc += b;
    }
    return sc;
  };
  // ids that fit, best first (also used by the Crafter and the Werkbank)
  CAT.search = function (ids, q) { const r = []; for (const id of ids) { const sc = CAT.score(id, q); if (sc > 0) r.push([id, sc]); } r.sort((a, b) => b[1] - a[1]); return r.map(x => x[0]); };
  CAT.kindLabel = kindLabel;
  CAT.entries = entries;

  // ---------------------------------------------------------------- pictures: the game's own item icons, a few per frame
  let icons = null;
  const iconOf = (id) => { if (!icons) { const ti = C.texInfo(); if (!ti || !VR.Icons) return null; icons = new VR.Icons(ti); } try { return icons.get(id); } catch (e) { return null; } };
  const iq = [];
  (function pump() {
    let n = 0;
    while (iq.length && n < 16) {
      const [cv, id] = iq[0]; if (!cv.isConnected) { iq.shift(); continue; }
      const ic = iconOf(id); if (!ic && !C.texInfo()) break;
      iq.shift(); n++;
      if (!ic) continue;
      const x = cv.getContext('2d'); x.imageSmoothingEnabled = false; x.clearRect(0, 0, cv.width, cv.height);
      const s = Math.min(cv.width, cv.height) * 0.78; x.drawImage(ic, (cv.width - s) / 2, (cv.height - s) / 2, s, s);
    }
    requestAnimationFrame(pump);
  })();
  // the ✨ Modern models: their rendered pictures come one or two per frame (each model is built on first use)
  const mq = [];
  (function pumpModels() {
    const t0 = performance.now();
    while (mq.length && performance.now() - t0 < 10) {
      const [cv, id] = mq.shift(); if (!cv.isConnected) continue;
      const th = C.thumbOf ? C.thumbOf(id) : null; if (!th) continue;
      const x = cv.getContext('2d'), k = Math.min(cv.width / th.width, cv.height / th.height), w = th.width * k, h = th.height * k;
      x.clearRect(0, 0, cv.width, cv.height); x.drawImage(th, (cv.width - w) / 2, (cv.height - h) / 2, w, h);
    }
    requestAnimationFrame(pumpModels);
  })();
  function picture(id, w, h) {
    if (VM.MODELS[id] && R.byName[id] && R.byName[id].o.modern) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; mq.push([cv, id]); return cv; }
    if (VM.MODELS[id]) { const th = C.thumbOf ? C.thumbOf(id) : null; if (th) { const c = th.cloneNode(true); c.getContext('2d').drawImage(th, 0, 0); return c; } }
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; iq.push([cv, id]); return cv;
  }
  CAT.picture = picture;

  // ---------------------------------------------------------------- hooks: answer while it is about us, else pass on
  function wrap(name, fn) { const prev = HOOK[name]; HOOK[name] = function (...a) { const r = fn.apply(null, a); if (r) return r; return prev ? prev.apply(null, a) : false; }; }

  // ---------------------------------------------------------------- the 🧱 Teile mode
  let lazyIO = null;
  C.MODES.parts = {
    enter() {
      S.mode = 'parts'; S.cat = CAT.cat || 'all'; S.from = CAT.openFrom || null; CAT.openFrom = null;
      for (const b of $$('nav.modes button')) b.classList.toggle('on', b.dataset.mode === 'parts');
      C.chips(); C.list();
      // back from the Crafter to a favourite model or house shown here
      if (CAT.restore) { const r = CAT.restore; CAT.restore = null; r(); return; }
      const first = $('#list .card[data-bid]'), id = CAT.sel || (first ? first.dataset.bid : entries()[0] && entries()[0].id);
      if (id) select(id);
    },
  };
  // ★ every favourite this Studio can show: blocks, furniture, whole houses, items (newest first)
  const favAll = () => { entries(); return (FV() ? FV().list() : []).filter(id => BYID.has(id) || VM.MODELS[id] || houseOf(id) || (VR.ITEMS && VR.ITEMS[id])); };
  wrap('chips', function () {
    if (S.mode !== 'parts') return false;
    const el = $('#chips'); el.innerHTML = '';
    const E = entries();
    for (const [id, ic, de] of KINDS) {
      const n = id === 'all' ? E.length : id === 'fav' ? favAll().length : E.filter(e => e.kinds.includes(id)).length;
      if (!n && id !== 'fav' && id !== 'all') continue;
      const b = document.createElement('button'); b.className = S.cat === id ? 'on' : ''; b.dataset.pcat = id;
      b.innerHTML = (ic ? ic + ' ' : '') + esc(L('cat.' + id, de)) + '<b>' + n + '</b>';
      b.onclick = () => { S.cat = CAT.cat = id; C.chips(); C.list(); };
      el.appendChild(b);
    }
    return true;
  });
  wrap('list', function () {
    if (S.mode !== 'parts') return false;
    const el = $('#list'); el.innerHTML = ''; el.classList.remove('houses', 'palette');
    const f = (S.filter || '').trim(), favs = new Set(FV() ? FV().list() : []);
    if (S.cat === 'fav' && !f) { favList(el, lazyObs(el)); return true; }
    let arr = entries().filter(e => (S.cat === 'all' ? true : S.cat === 'fav' ? favs.has(e.id) : e.kinds.includes(S.cat)));
    if (f) { const hit = CAT.search(entries().map(e => e.id), f); arr = hit.map(id => BYID.get(id)); }
    if (S.cat === 'fav') { const order = FV() ? FV().list() : []; arr.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)); }
    let k = 0;
    // the pictures are made when a card scrolls into view (hundreds of canvases at once would weigh on a small PC)
    lazyObs(el);
    for (const e of arr.slice(0, 800)) {
      const c = document.createElement('div'); c.className = 'card blk' + (CAT.sel === e.id && S.scene && S.scene.type === 'block' ? ' on' : ''); c.dataset.bid = e.id; c.style.animationDelay = (Math.min(k++, 24) * 18) + 'ms';
      if (lazyIO) { const ph = document.createElement('div'); ph.className = 'th ph'; c.appendChild(ph); lazyIO.observe(c); } else { const cv = picture(e.id, 128, 84); cv.className = 'th'; c.appendChild(cv); }
      c.insertAdjacentHTML('beforeend', `<div class="cap"><div class="n" title="${esc(disp(e.id))}">${esc(disp(e.id))}</div><div class="s">${esc(e.kinds.filter(x => x !== 'other').map(kindLabel).join(' · ') || e.id)}</div></div>`);
      c.appendChild(favButton(e.id, () => { if (S.cat === 'fav') C.list(); C.chips(); }));
      c.onclick = () => select(e.id);
      el.appendChild(c);
    }
    if (!arr.length) { const d = document.createElement('div'); d.className = 'note dim'; d.textContent = S.cat === 'fav' ? noFavText() : L('cat.none', 'nichts gefunden'); el.appendChild(d); }
    return true;
  });
  // the pictures are made when a card scrolls into view (blocks: the game's icon; furniture: a rendered thumbnail)
  function lazyObs(el) {
    if (!lazyIO && 'IntersectionObserver' in window) lazyIO = new IntersectionObserver((es) => { for (const en of es) if (en.isIntersecting) { const c = en.target; lazyIO.unobserve(c); const ph = c.querySelector('.th.ph'); if (ph) { const cv = picture(c.dataset.bid || c.dataset.pic, 128, 84); cv.className = 'th'; ph.replaceWith(cv); } } }, { root: el, rootMargin: '300px' });
    return lazyIO;
  }
  const noFavText = () => (SA ? L('cat.noFavSA', 'Noch keine Favoriten — der ☆ an einem Teil, einem Möbel oder einem Haus legt es hierher. Sie gelten überall in diesem Studio; 📦 Mitnehmen bringt sie ins Spiel.')
    : L('cat.noFav2', 'Noch keine Favoriten — der ☆ an einem Teil, einem Möbel oder einem Haus legt es hierher, und dann findest du es überall wieder: im Crafter, in der Werkbank, im Spiel.'));
  // ★ Favoriten in Teile: every favourite — blocks, furniture, whole houses — with its picture and ✏️
  function favList(el, lazy) {
    const ids = favAll();
    if (!ids.length) { const d = document.createElement('div'); d.className = 'note dim'; d.textContent = noFavText(); el.appendChild(d); return; }
    let k = 0;
    for (const id of ids) {
      const blk = BYID.get(id), mod = VM.MODELS[id], hs = houseOf(id);
      const c = document.createElement('div'); c.className = 'card blk fav' + (S.scene && ((S.scene.type === 'block' && S.scene.name === id) || (S.scene.type === 'model' && S.scene.name === id) || (hs && S.scene.type === 'house' && S.scene.index === hs.i)) ? ' on' : '');
      c.dataset.fid = id; if (blk) c.dataset.bid = id; c.style.animationDelay = (Math.min(k++, 24) * 18) + 'ms';
      let pic = null;
      if (hs) { const rec = C.HOUSE.get(hs.i); if (rec && rec.thumb) { pic = document.createElement('canvas'); pic.width = rec.thumb.width; pic.height = rec.thumb.height; pic.getContext('2d').drawImage(rec.thumb, 0, 0); } }
      if (!pic && lazy && !hs) { pic = document.createElement('div'); pic.className = 'th ph'; c.dataset.pic = id; c.appendChild(pic); lazy.observe(c); }
      else { if (!pic) pic = picture(id, 128, 84); pic.className = 'th'; c.appendChild(pic); }
      const kind = hs ? '🏠 ' + L('cat.house', 'Haus') : mod ? (C.isFacade(id) ? '▤ ' + L('mode.facade', 'Fassade') : '▣ ' + L('mode.furn', 'Möbel')) : blk ? blk.kinds.filter(x => x !== 'other').map(kindLabel).join(' · ') || id : L('cat.item', 'Gegenstand');
      c.insertAdjacentHTML('beforeend', `<div class="cap"><div class="n" title="${esc(disp(id))}">${esc(disp(id))}</div><div class="s">${esc(kind)}</div></div>`);
      c.appendChild(favButton(id, () => { C.chips(); C.list(); }));
      if (blk || mod || hs) {
        const e = document.createElement('button'); e.className = 'editb'; e.textContent = '✏️'; e.title = L('cat.edit', 'Bearbeiten');
        // (the card it was opened from is shown first: ← back returns to it)
        e.onclick = (ev) => { ev.stopPropagation(); for (const x of $$('#list .card[data-fid]')) x.classList.toggle('on', x === c); if (hs) { C.selectHouse(hs.i); C.editHouse(hs.i); } else if (mod) { C.selectModel(id); C.editModel(id); } else { CAT.edit = true; select(id); } };
        c.appendChild(e);
      }
      c.onclick = () => { for (const x of $$('#list .card[data-fid]')) x.classList.toggle('on', x === c); if (blk) select(id); else if (mod) C.selectModel(id); else if (hs) C.selectHouse(hs.i); };
      el.appendChild(c);
    }
  }
  // a ☆ on a card: a click makes it a favourite (or not), the card is not selected by it
  function favButton(id, after) {
    const b = document.createElement('button'); const on = FV() && FV().has(id);
    const onT = SA ? L('fav.onSA', 'Zu den Favoriten — überall im Studio wiederzufinden') : L('fav.on', 'Zu den Favoriten — überall wiederzufinden');
    b.className = 'favb' + (on ? ' on' : ''); b.textContent = on ? '★' : '☆'; b.title = on ? L('fav.off', 'Aus den Favoriten nehmen') : onT;
    b.onclick = (ev) => {
      ev.stopPropagation(); if (!FV()) return;
      const now = FV().toggle(id); b.classList.toggle('on', now); b.textContent = now ? '★' : '☆'; b.title = now ? L('fav.off', 'Aus den Favoriten nehmen') : onT;
      if (FV().ok === false) C.sys('⚠ ' + disp(id) + ' — ' + L('fav.unsaved', 'nur bis zum Schließen: Browser-Speicher voll'), 'err');
      else C.sys(now ? '★ ' + disp(id) + ' — ' + L('fav.added', 'bei den Favoriten') : '☆ ' + disp(id) + ' — ' + L('fav.removed', 'nicht mehr bei den Favoriten'), 'ok');
      if (after) after(now);
    };
    return b;
  }
  CAT.favButton = favButton;
  async function select(id) {
    CAT.sel = id;
    for (const c of $$('#list .card[data-bid]')) c.classList.toggle('on', c.dataset.bid === id);
    const card = [...$$('#list .card[data-bid]')].find(c => c.dataset.bid === id); if (card && card.scrollIntoView) card.scrollIntoView({ block: 'nearest' });
    if (VM.MODELS[id]) { const sc = C.sceneModel(id); if (sc) { C.setScene(sc); C.parts(); C.crumb(); return; } }   // a ✨ Modern model: the whole model
    await C.showBlock(id);
    C.crumb();
  }
  CAT.select = select;
  // open a block (or a model) in its catalogue, with "← zurück" to where it came from
  CAT.open = function (kind, id, from) {
    if (kind === 'model' || VM.MODELS[id]) { C.setMode(C.isFacade(id) ? 'facade' : 'furn', true); C.selectModel(id, from || null); return; }
    entries();
    CAT.sel = id; CAT.cat = (BYID.get(id) && BYID.get(id).kinds[0]) || 'all'; if (CAT.cat === 'other') CAT.cat = 'all';
    if (S.mode === 'parts') { S.from = from || null; S.cat = CAT.cat; C.chips(); C.list(); select(id); } else { CAT.openFrom = from || null; C.setMode('parts'); }
  };
  // ⚒ Benutzen: into the Crafter's hand — in the house it came from (or the last one looked at)
  CAT.use = function (id) {
    const CR = VR.Crafter; if (!CR) return;
    CR.hot[CR.slot] = id; CR.recent = [id].concat((CR.recent || []).filter(x => x !== id)).slice(0, 40);
    // a house it came from (or one shown in Architektur) → that house in the Crafter
    const here = S.from && Number.isFinite(S.from.index) ? S.from.index : S.scene && S.scene.type === 'house' && S.mode === 'arch' ? S.scene.index : null;
    // a world open in the Welt mode → the Werkbank's hand (the same hotbar), right there in the world
    const WM = VR.StudioWorld;
    if (here === null && WM && WM.world && WM.region && WM.wb) {
      WM.tab = 'bench'; C.setMode('world');
      C.sys('✋ ' + disp(id) + ' — ' + L('cat.inHandWb', 'liegt in der Hand der Werkbank: Rechtsklick setzt es'), 'ok');
      return;
    }
    const idx = here !== null ? here : CAT.lastHouse;
    if (Number.isFinite(idx)) CR.want = { kind: 'house', idx };
    C.setMode('craft');
    C.sys('✋ ' + disp(id) + ' — ' + L('cat.inHand2', 'liegt in der Hand: Rechtsklick setzt es'), 'ok');
  };
  // the buttons the right side shows for one block or model
  CAT.actions = function (el, id, opt) {
    const isModel = !!(opt && opt.model);
    const r = document.createElement('div'); r.className = 'crow catAct';
    if (!isModel) {
      const eb = document.createElement('button'); eb.className = 'cbtn pri' + (CAT.edit ? ' on' : ''); eb.dataset.act = 'edit'; eb.innerHTML = '✏️ ' + L('cat.edit', 'Bearbeiten'); eb.title = L('cat.editT', 'Varianten: dasselbe in anderen Farben und Materialien — und 🎨 alles davon in einem Haus ersetzen');
      eb.onclick = () => { CAT.edit = !CAT.edit; C.parts(); };
      r.appendChild(eb);
    }
    const fb = favButton(id, () => { if (S.mode === 'parts') { C.chips(); if (S.cat === 'fav') C.list(); else { const cb = [...$$('#list .card[data-bid]')].find(c => c.dataset.bid === id); if (cb) { const s = cb.querySelector('.favb'); const on = FV().has(id); s.classList.toggle('on', on); s.textContent = on ? '★' : '☆'; } } } });
    fb.className = 'cbtn' + (FV() && FV().has(id) ? ' on' : ''); fb.textContent = (FV() && FV().has(id) ? '★ ' : '☆ ') + L('fav.btn', 'Favorit');
    const fbClick = fb.onclick; fb.onclick = (ev) => { fbClick(ev); const on = FV().has(id); fb.className = 'cbtn' + (on ? ' on' : ''); fb.textContent = (on ? '★ ' : '☆ ') + L('fav.btn', 'Favorit'); };
    const ub = document.createElement('button'); ub.className = 'cbtn pro'; ub.innerHTML = '✋ ' + L('cat.use', 'Benutzen'); ub.title = L('cat.useT', 'In die Hand nehmen und im Crafter damit bauen'); ub.onclick = () => CAT.use(id);
    r.appendChild(ub); r.appendChild(fb); el.appendChild(r);
    if (!isModel && CAT.edit) editBox(el, id);
  };
  // ✏️ for a block: the Varianten (a click selects one) and 🎨 — all of it in a house where it is used, replaced
  function editBox(el, id) {
    const V = VR.Variants; if (!V) return;
    const fam = V.family(id), ids = fam.length ? fam : V.similar(id, 24);
    const show = ids.length > 64 ? ids.slice(0, 64).concat(ids.slice(0, 64).includes(id) ? [] : [id]) : ids;
    if (show.length > 1) el.appendChild(V.strip(show, id, (v) => { CAT.edit = true; select(v); }, '✏️ ' + (fam.length ? L('var.variants', 'Varianten') : L('var.similar', 'Ähnliche')) + ' <b>' + ids.length + '</b>'));
    else { const n = document.createElement('div'); n.className = 'note dim'; n.textContent = L('var.noneHere', 'Von diesem Block gibt es keine Varianten.'); el.appendChild(n); }
    // 🎨 the houses it is in: replace all of it there (the same as 🎨 in "Verbaut in")
    const used = []; for (const rec of C.HOUSE.values()) { const hit = rec.data.blocks.find(([n]) => n === id); if (hit) used.push(rec); }
    if (!used.length) return;
    const row = document.createElement('div'); row.className = 'varHouses'; row.innerHTML = `<span>🎨 ${esc(L('var.inHouse', 'Alles davon ersetzen in:'))}</span>`;
    for (const rec of used) {
      const b = document.createElement('button'); b.className = 'cbtn mini'; b.dataset.house = rec.index; b.textContent = rec.name;
      b.onclick = () => { for (const x of $$('#partsBody .varPick')) x.remove(); row.after(V.picker({ id, houseName: rec.name, onPick: (to) => VR.Crafter.replaceIn(rec.index, id, to) })); };
      row.appendChild(b);
    }
    el.appendChild(row);
  }

  // ---------------------------------------------------------------- 🎯 tap a house: find what is there
  const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  function rayFromMouse(e) {
    const cv = C.view(), r = cv.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1, ny = 1 - ((e.clientY - r.top) / r.height) * 2;
    const cam = C.camFor(S.scene, S.cam, r.width, r.height), eye = cam.eye, tg = cam.target;
    const fw = norm([tg[0] - eye[0], tg[1] - eye[1], tg[2] - eye[2]]), rt = norm(cross(fw, [0, 1, 0])), up = cross(rt, fw), th = Math.tan(cam.fov / 2), asp = r.width / r.height;
    return { o: eye, d: norm([fw[0] + rt[0] * nx * th * asp + up[0] * ny * th, fw[1] + rt[1] * nx * th * asp + up[1] * ny * th, fw[2] + rt[2] * nx * th * asp + up[2] * ny * th]) };
  }
  const HDX = [0, 1, 0, -1], HDZ = [-1, 0, 1, 0];
  // decorations without a selection box (LED strips, pictures, pendant lamps, curtains …): the box around their voxels
  const visCache = new Map();
  function boxesOf(s, nb) {
    const b = PH.selection(s, nb); if (b && b.length) return b;
    let v = visCache.get(s);
    if (v === undefined) {
      v = null;
      try {
        const G = VX.spec && VX.spec(s) && VX.iconGrid ? VX.iconGrid(s) : null;
        if (G && G.length) {
          const n = Math.round(Math.cbrt(G.length)), P = VX.PRESENT; let x0 = n, y0 = n, z0 = n, x1 = -1, y1 = -1, z1 = -1;
          for (let y = 0; y < n; y++) for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) if (G[(y * n + z) * n + x] & P) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (z < z0) z0 = z; if (x > x1) x1 = x; if (y > y1) y1 = y; if (z > z1) z1 = z; }
          if (x1 >= 0) v = [[x0 / n, y0 / n, z0 / n, (x1 + 1) / n, (y1 + 1) / n, (z1 + 1) / n]];
        }
      } catch (e) { v = null; }
      visCache.set(s, v);
    }
    return v || b || [];
  }
  // the first thing the ray meets in the house's block grid (against each block's real shape; above the cut is hidden)
  function pickIn(d, ray) {
    const [sx, sy, sz] = d.dims, g = d.grid, get = (x, y, z) => (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz ? 0 : g[(y * sz + z) * sx + x]);
    const [ox, oy, oz] = ray.o, [dx, dy, dz] = ray.d;
    const hb = PH.rayBox(ox, oy, oz, dx, dy, dz, [0, 0, 0, sx, sy, sz], 0, 0, 0); if (!hb) return null;
    const t0 = Math.max(0, hb[0]);
    const px = ox + dx * (t0 + 1e-4), py = oy + dy * (t0 + 1e-4), pz = oz + dz * (t0 + 1e-4);
    let x = Math.floor(px), y = Math.floor(py), z = Math.floor(pz);
    const stx = dx > 0 ? 1 : -1, sty = dy > 0 ? 1 : -1, stz = dz > 0 ? 1 : -1, tdx = Math.abs(1 / dx), tdy = Math.abs(1 / dy), tdz = Math.abs(1 / dz);
    let tx = (dx > 0 ? (x + 1 - px) : (px - x)) * tdx, ty = (dy > 0 ? (y + 1 - py) : (py - y)) * tdy, tz = (dz > 0 ? (z + 1 - pz) : (pz - z)) * tdz;
    // thin things (LED strips, rails, panes, trims) are easy to miss with a finger: a ray that passes close by one
    // (within 0.2 of a block) before it meets anything else takes the thin thing
    let near = null;
    const M = 0.2, thin = (b) => b[3] - b[0] < 0.5 || b[4] - b[1] < 0.5 || b[5] - b[2] < 0.5;
    for (let i = 0; i < 900; i++) {
      if (x < -1 || y < -1 || z < -1 || x > sx || y > sy || z > sz) break;
      const s = get(x, y, z);
      if (s && y < S.clipY) {
        const boxes = boxesOf(s, (k) => get(x + HDX[k], y, z + HDZ[k]));
        for (const b of boxes) { const r = PH.rayBox(ox, oy, oz, dx, dy, dz, b, x, y, z); if (r) return near || { x, y, z, state: s }; }
        if (!near) for (const b of boxes) { if (thin(b) && PH.rayBox(ox, oy, oz, dx, dy, dz, [b[0] - M, b[1] - M, b[2] - M, b[3] + M, b[4] + M, b[5] + M], x, y, z)) { near = { x, y, z, state: s, near: true }; break; } }
      }
      if (tx < ty && tx < tz) { x += stx; tx += tdx; } else if (ty < tz) { y += sty; ty += tdy; } else { z += stz; tz += tdz; }
    }
    return near;
  }
  const modelOf = (s) => { const sp = VX.spec ? VX.spec(s) : null; return sp && sp.kind === 'model' && sp.model ? sp.model.name : null; };
  function glow(sc, id, isModel) {
    const d = sc.data, [sx, sy, sz] = d.dims, g = d.grid, sel = new Uint8Array(g.length), memo = new Map();
    const tIdx = !isModel && R.byName[id] ? T.type[R.byName[id].defaultState] : -1;
    let cells = 0;
    for (let i = 0; i < g.length; i++) {
      const s = g[i]; if (!s) continue;
      let m = memo.get(s);
      if (m === undefined) { const mn = modelOf(s); m = isModel ? mn === id : !mn && T.type[s] === tIdx; memo.set(s, m); }
      if (m) { sel[i] = 1; cells++; }
    }
    // the outside of all of it, as one see-through glow
    const q = [], col = [0.22, 0.92, 1], e = 0.02, on = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < sx && y < sy && z < sz && sel[(y * sz + z) * sx + x];
    const face = (a, b, c2, d2) => { q.push(...a, ...b, ...c2, ...d2, ...col); };
    for (let y = 0; y < sy && q.length < 15 * 60000; y++) for (let z = 0; z < sz; z++) for (let x = 0; x < sx; x++) {
      if (!sel[(y * sz + z) * sx + x]) continue;
      const x0 = x - e, y0 = y - e, z0 = z - e, x1 = x + 1 + e, y1 = y + 1 + e, z1 = z + 1 + e;
      if (!on(x, y + 1, z)) face([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]);
      if (!on(x, y - 1, z)) face([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]);
      if (!on(x + 1, y, z)) face([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]);
      if (!on(x - 1, y, z)) face([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]);
      if (!on(x, y, z + 1)) face([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]);
      if (!on(x, y, z - 1)) face([x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]);
    }
    const count = isModel ? ((d.models.find(([nm]) => nm === id) || [0, cells])[1]) : cells;
    return { count, cells, mesh: C.quadMesh(q) };
  }
  const isModelIn = (sc, id) => !!VM.MODELS[id] || !!((sc.data.models || []).find(([n]) => n === id));
  function setPick(sc, id, isModel, quiet) {
    if (CAT.pick && CAT.pick.mesh) C.freeQuadMesh(CAT.pick.mesh);
    const gl2 = glow(sc, id, isModel);
    CAT.pick = { id, isModel, house: sc.index, houseName: sc.name, grid: sc.data.grid, count: gl2.count, cells: gl2.cells, mesh: gl2.mesh };
    CAT.lastHouse = sc.index;
    if (!quiet) C.parts();
  }
  // a hover over a row of the house's list lights that part up for a moment (desktop; a tap on a row opens it)
  let pv = null, pvT = 0;
  CAT.preview = function (id) {
    clearTimeout(pvT);
    pvT = setTimeout(() => {
      const sc = S.scene;
      if (!id || !sc || sc.type !== 'house' || !sc.data.grid) { if (pv) { C.freeQuadMesh(pv.mesh); pv = null; } return; }
      if (pv && pv.id === id && pv.house === sc.index && pv.grid === sc.data.grid) return;
      if (pv) C.freeQuadMesh(pv.mesh);
      pv = { id, house: sc.index, grid: sc.data.grid, mesh: glow(sc, id, isModelIn(sc, id)).mesh };
    }, id ? 50 : 80);
  };
  function clearPick() { if (CAT.pick && CAT.pick.mesh) C.freeQuadMesh(CAT.pick.mesh); CAT.pick = null; if (S.scene && S.scene.type === 'house') C.parts(); }
  CAT.clearPick = clearPick;
  CAT.pickAt = function (e) {
    const sc = S.scene; if (!sc || sc.type !== 'house') return null;
    const d = sc.data; if (!d || !d.grid) { C.sys(L('cat.wait', 'Das Haus wird noch gebaut …')); return null; }
    const hit = pickIn(d, rayFromMouse(e));
    if (!hit) { clearPick(); return null; }
    const mn = modelOf(hit.state), id = mn || R.types[T.type[hit.state]].name;
    if (CAT.pick && CAT.pick.id === id && CAT.pick.house === sc.index) { clearPick(); return null; }   // a second tap lets go
    setPick(sc, id, !!mn);
    return id;
  };
  CAT.pickId = (id) => { const sc = S.scene; if (!sc || sc.type !== 'house' || !sc.data.grid) return false; setPick(sc, id, isModelIn(sc, id)); return true; };
  // what is under the pointer, without picking it: the id, or null
  CAT.probe = function (e) {
    const sc = S.scene; if (!sc || sc.type !== 'house' || !sc.data || !sc.data.grid) return null;
    const hit = pickIn(sc.data, rayFromMouse(e)); if (!hit) return null;
    return modelOf(hit.state) || R.types[T.type[hit.state]].name;
  };
  // with a mouse: the name of what is under the pointer floats next to it, so a tap is no guess
  let tipEl = null, tipT = 0, tipLast = '';
  const hideTip = () => { if (tipEl && tipLast) { tipEl.classList.remove('on'); tipLast = ''; } };
  function showTip(e) {
    const now = performance.now(); if (now - tipT < 70) return; tipT = now;
    const id = CAT.probe(e);
    if (!id) { hideTip(); return; }
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.id = 'pickTip'; document.body.appendChild(tipEl); }
    if (id !== tipLast) { tipEl.textContent = '🎯 ' + disp(id); tipLast = id; }
    tipEl.style.left = Math.min(window.innerWidth - 220, e.clientX + 14) + 'px'; tipEl.style.top = (e.clientY + 18) + 'px'; tipEl.classList.add('on');
  }
  let down = null;
  wrap('pointer', function (e, type) {
    if (S.mode !== 'arch' || !S.scene || S.scene.type !== 'house') { hideTip(); return false; }
    if (type === 'down') { hideTip(); down = { x: e.clientX, y: e.clientY, b: e.button, t: performance.now() }; return false; }
    if (type === 'up' && down) { const p = down; down = null; if (p.b === 0 && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 6 && performance.now() - p.t < 700) CAT.pickAt(e); }
    if (type === 'move') { if (e.buttons || e.pointerType === 'touch') hideTip(); else showTip(e); }
    if (type === 'leave') hideTip();
    return false;
  });
  wrap('overlay', function (sc, eye, vp) {
    if (S.mode !== 'arch' || !sc || sc.type !== 'house') { hideTip(); return false; }
    const P = pv && pv.house === sc.index && pv.grid === sc.data.grid ? pv : CAT.pick && CAT.pick.house === sc.index && CAT.pick.grid === sc.data.grid ? CAT.pick : null;
    if (P && P.mesh) C.drawQuadMesh(P.mesh, vp, eye, 0.42, 0.16);
    return false;
  });
  wrap('key', function (e, down2) {
    if (down2 && e.key === 'Escape' && CAT.pick && S.mode === 'arch') { clearPick(); return true; }
    return false;
  });
  // the card at the top of a house's parts: what was tapped (or how to tap)
  CAT.pickCard = function (el, sc) {
    if (CAT.pick && CAT.pick.house === sc.index && sc.data.grid && CAT.pick.grid !== sc.data.grid) setPick(sc, CAT.pick.id, CAT.pick.isModel, true);
    const P = CAT.pick;
    if (!P || P.house !== sc.index) {
      const n = document.createElement('div'); n.className = 'note dim pickHint'; n.innerHTML = '🎯 ' + L('cat.hint', 'Tipp auf ein Teil im Haus — alles davon leuchtet auf, und ich zeige es dir im Katalog.'); el.appendChild(n); return;
    }
    const box = document.createElement('div'); box.className = 'pickCard';
    const pic = picture(P.id, 120, 90); pic.className = 'th'; box.appendChild(pic);
    const kinds = P.isModel ? [] : CAT.kindsOf(P.id).filter(k => k !== 'other').map(kindLabel);
    box.insertAdjacentHTML('beforeend', `<div class="pc"><div class="n">${esc(disp(P.id))}</div><div class="s">${P.count.toLocaleString('de-DE')}× ${esc(L('cat.inHouse', 'in diesem Haus'))}${kinds.length ? ' · ' + esc(kinds.join(' · ')) : ''}</div><div class="s mono">${esc(P.id)}</div></div>`);
    const x = document.createElement('button'); x.className = 'x'; x.textContent = '✕'; x.title = L('cat.clear', 'Loslassen (Esc)'); x.onclick = () => clearPick(); box.appendChild(x);
    el.appendChild(box);
    const r = document.createElement('div'); r.className = 'crow catAct';
    const find = document.createElement('button'); find.className = 'cbtn pri'; find.innerHTML = '🔍 ' + L('cat.find', 'Im Katalog'); find.title = L('cat.findT', 'Den Katalog genau dort öffnen — „← zurück“ bringt dich hierher'); find.onclick = () => CAT.open(P.isModel ? 'model' : 'block', P.id, { index: sc.index, name: sc.name });
    const use = document.createElement('button'); use.className = 'cbtn'; use.innerHTML = '✋ ' + L('cat.use', 'Benutzen'); use.title = L('cat.useT', 'In die Hand nehmen und im Crafter damit bauen'); use.onclick = () => { S.from = { index: sc.index, name: sc.name }; CAT.use(P.id); };
    const fb = favButton(P.id); fb.className = 'cbtn' + (FV() && FV().has(P.id) ? ' on' : ''); fb.textContent = (FV() && FV().has(P.id) ? '★ ' : '☆ ') + L('fav.btn', 'Favorit');
    const fc = fb.onclick; fb.onclick = (ev) => { fc(ev); const on = FV().has(P.id); fb.className = 'cbtn' + (on ? ' on' : ''); fb.textContent = (on ? '★ ' : '☆ ') + L('fav.btn', 'Favorit'); };
    r.appendChild(find); r.appendChild(use); r.appendChild(fb); el.appendChild(r);
  };
  // favourites changed elsewhere (the game, another tab): the open catalogue follows
  if (FV()) FV().on(() => { if (S.mode === 'parts' || S.mode === 'furn' || S.mode === 'facade' || S.mode === 'arch') { C.chips(); if (S.cat === 'fav') C.list(); } });
})();
