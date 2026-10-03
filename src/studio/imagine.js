// ============================================================================
// R9 Studio · 🖼 Bild → 3D (v0.35): pictures become blocks.
// 🧱 Blockbild — a picture (a photo, pixel art, a logo) as a wall or a floor of
//    blocks in the colours that fit best (all blocks, wool & concrete, Vollton,
//    terracotta, stone & wood), the background cut away, with relief if you like.
// 🧊 3D aus Ansichten — the front, the side and (if you have it) the top of
//    something — drawn here or photographed — and the Studio carves the shape out
//    of a block of voxels (what every view sees as "inside" stays) and paints it
//    with the colours of the views. A car, a house, a statue, a ship.
// 🏠 Haus — the Haus-Baukasten: style, size, floors, roof, walls, windows, door
//    and extras as buttons; the house comes with rooms, stairs and furniture.
// ✨ Genie — a photo, a sketch or a sentence; the Genie's own brain (right here in
//    the page, no account, no limit) makes a plan of it: a house for the
//    Baukasten, or one of 170+ things built from shapes in the colours asked for.
// The result lands in the Werkbank's hand: place it in the world, or keep it as a
// Bauteil.
// ============================================================================
(function () {
  'use strict';
  const C = window.__studioCore, WM = VR.StudioWorld; if (!C || !WM) return;
  const { $ } = C;
  const R = VR.R, KEEP = 0xffff;
  const L = (k, de, v) => (VR.I18N && VR.I18N.t ? VR.I18N.t(k, v, de) : String(de).replace(/\{(\w+)\}/g, (m, x) => (v && v[x] !== undefined ? v[x] : m)));
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const BC = () => VR.BlockColors;
  const IM = WM.imagine = {
    mode: 'flat',
    flat: { img: null, width: 64, orient: 'wall', set: 'all', bg: true, dither: false, relief: 0, tol: 22 },
    solid: { front: null, side: null, top: null, height: 32, depth: 0, set: 'all', tol: 22, hollow: true, flipSide: false },
    house: null, genie: { text: '', img: null, size: 32, status: '', last: null, hist: [], t0: 0, want: null, chips: null, chipMode: 'new', word: '' }, aiOK: { local: true, images: true }, hkWish: '',
    result: null, cam: { yaw: 0.72, pitch: 0.42, dist: 0 }, camFront: { yaw: 3.75, pitch: 0.42, dist: 0 }, gpu: null, ver: 0,
    pj: { kit: null, genie: null, site: null }, pjShot: null, kitManual: false,   // 🕘 the projects the dialog writes to
  };
  const HK = () => VR.HouseKit, GN = () => VR.Genie;
  const camOf = () => (IM.mode === 'house' || IM.mode === 'genie' ? IM.camFront : IM.cam);
  // the Genie thinks right here in the page: always there, for everybody
  const GB = () => VR.GenieBrain;

  // ---------------------------------------------------------------- pictures in
  async function loadImage(file) {
    if (!file) return null;
    let bmp = null;
    try { bmp = await createImageBitmap(file); } catch (e) {
      bmp = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = URL.createObjectURL(file); });
    }
    const max = 768, k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(bmp.width * k)); cv.height = Math.max(1, Math.round(bmp.height * k));
    const x = cv.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(bmp, 0, 0, cv.width, cv.height);
    return cv;
  }
  // what is the thing and what is the background: transparency if the picture has it, otherwise the colour around the
  // border, cut away where it touches the border (a white car on a white background keeps its white roof inside)
  function cutout(cv, tol) {
    const w = cv.width, h = cv.height, d = cv.getContext('2d').getImageData(0, 0, w, h).data, m = new Uint8Array(w * h);
    let alpha = false; for (let i = 0; i < w * h; i++) if (d[i * 4 + 3] < 250) { alpha = true; break; }
    if (alpha) { for (let i = 0; i < w * h; i++) m[i] = d[i * 4 + 3] >= 128 ? 1 : 0; return m; }
    const lab = (i) => VR.BlockColors.toLab(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
    // the background: the most common colour cell along the border
    const cells = new Map(), border = [];
    for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x); for (let y = 0; y < h; y++) border.push(y * w, y * w + w - 1);
    for (const i of border) { const k = (d[i * 4] >> 4) << 8 | (d[i * 4 + 1] >> 4) << 4 | (d[i * 4 + 2] >> 4); cells.set(k, (cells.get(k) || 0) + 1); }
    let bk = 0, bn = -1; for (const [k, n] of cells) if (n > bn) { bn = n; bk = k; }
    const bg = VR.BlockColors.toLab(((bk >> 8) & 15) * 16 + 8, ((bk >> 4) & 15) * 16 + 8, (bk & 15) * 16 + 8);
    const near = (i) => { const q = lab(i); return (q[0] - bg[0]) ** 2 + (q[1] - bg[1]) ** 2 + (q[2] - bg[2]) ** 2 < tol * tol; };
    m.fill(1);
    const st = []; for (const i of border) if (m[i] && near(i)) { m[i] = 0; st.push(i); }
    while (st.length) { const i = st.pop(), x = i % w, y = (i / w) | 0; for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) if (j >= 0 && m[j] && near(j)) { m[j] = 0; st.push(j); } }
    return m;
  }
  // the thing alone, cropped to it and scaled to w × h: colours (RGBA, alpha = inside)
  function fit(cv, mask, w, h, flip) {
    const W = cv.width, H = cv.height; let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (mask[y * W + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return null;
    const src = document.createElement('canvas'); src.width = W; src.height = H;
    const sx = src.getContext('2d'); sx.drawImage(cv, 0, 0);
    const id = sx.getImageData(0, 0, W, H); for (let i = 0; i < W * H; i++) if (!mask[i]) id.data[i * 4 + 3] = 0; sx.putImageData(id, 0, 0);
    const out = document.createElement('canvas'); out.width = w; out.height = h;
    const ox = out.getContext('2d'); ox.imageSmoothingQuality = 'high';
    if (flip) { ox.translate(w, 0); ox.scale(-1, 1); }
    ox.drawImage(src, x0, y0, x1 - x0 + 1, y1 - y0 + 1, 0, 0, w, h);
    return { data: ox.getImageData(0, 0, w, h).data, aspect: (x1 - x0 + 1) / (y1 - y0 + 1) };
  }
  const aspectOf = (cv, mask) => { const W = cv.width, H = cv.height; let x0 = W, y0 = H, x1 = -1, y1 = -1; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (mask[y * W + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return x1 < 0 ? 1 : (x1 - x0 + 1) / (y1 - y0 + 1); };

  // ---------------------------------------------------------------- 🧱 a picture as blocks
  function buildFlat() {
    const P = IM.flat; if (!P.img || !BC() || !BC().ready()) return null;
    const mask = P.bg ? cutout(P.img, P.tol) : new Uint8Array(P.img.width * P.img.height).fill(1);
    const asp = P.bg ? aspectOf(P.img, mask) : P.img.width / P.img.height;
    const w = Math.max(2, Math.min(256, P.width | 0)), h = Math.max(1, Math.min(256, Math.round(w / Math.max(0.05, asp))));
    const f = P.bg ? fit(P.img, mask, w, h) : (() => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(P.img, 0, 0, w, h); return { data: x.getImageData(0, 0, w, h).data }; })();
    if (!f) return null;
    const px = f.data, err = P.dither ? new Float32Array(w * h * 3) : null, cells = new Uint16Array(w * h), depth = new Uint8Array(w * h);
    const face = P.orient === 'floor' ? 'top' : 'side';
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; if (px[i * 4 + 3] < 128) continue;
      let r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
      if (err) { r = Math.max(0, Math.min(255, r + err[i * 3])); g = Math.max(0, Math.min(255, g + err[i * 3 + 1])); b = Math.max(0, Math.min(255, b + err[i * 3 + 2])); }
      const s = BC().nearest(r | 0, g | 0, b | 0, P.set, face); cells[i] = s;
      if (P.relief) depth[i] = Math.round((0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2]) / 255 * P.relief);
      if (err) {
        const c = BC().colorOf(s, face), er = r - c[0], eg = g - c[1], eb = b - c[2];
        const add = (xx, yy, k) => { if (xx < 0 || yy < 0 || xx >= w || yy >= h) return; const j = (yy * w + xx) * 3; err[j] += er * k; err[j + 1] += eg * k; err[j + 2] += eb * k; };
        add(x + 1, y, 7 / 16); add(x - 1, y + 1, 3 / 16); add(x, y + 1, 5 / 16); add(x + 1, y + 1, 1 / 16);
      }
    }
    const D = (P.relief | 0) + 1;
    const g = P.orient === 'floor' ? { sx: w, sy: D, sz: h } : { sx: w, sy: h, sz: D };
    g.blocks = new Uint16Array(g.sx * g.sy * g.sz).fill(KEEP);
    let n = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const s = cells[y * w + x]; if (!s) continue;
      const d = P.relief ? depth[y * w + x] : 0;
      for (let k = 0; k <= d; k++) {
        // a wall stands in x–y (the picture's top up, its relief toward the viewer, −z); a floor lies in x–z
        const i = P.orient === 'floor' ? (k * g.sz + y) * g.sx + x : ((h - 1 - y) * g.sz + (D - 1 - k)) * g.sx + x;
        g.blocks[i] = s; n++;
      }
    }
    g.n = n; g.name = L('im.flatName', 'Blockbild {w}×{h}', { w, h });
    return g;
  }

  // ---------------------------------------------------------------- 🧊 a shape out of its views
  function buildSolid() {
    const P = IM.solid; if (!P.front || !BC() || !BC().ready()) return null;
    const H = Math.max(4, Math.min(128, P.height | 0));
    const mf = cutout(P.front, P.tol), af = aspectOf(P.front, mf), W = Math.max(1, Math.min(160, Math.round(H * af)));
    const front = fit(P.front, mf, W, H);
    let D, side = null, top = null;
    if (P.side) { const ms = cutout(P.side, P.tol), as = aspectOf(P.side, ms); D = Math.max(1, Math.min(160, Math.round(H * as))); side = fit(P.side, ms, D, H, P.flipSide); }
    else D = Math.max(1, Math.min(160, P.depth ? P.depth | 0 : Math.max(1, Math.round(W * 0.45))));
    if (P.top) { const mt = cutout(P.top, P.tol); top = fit(P.top, mt, W, D); }
    if (!front) return null;
    const inF = (x, y) => front.data[((H - 1 - y) * W + x) * 4 + 3] >= 128;
    const inS = (z, y) => !side || side.data[((H - 1 - y) * D + z) * 4 + 3] >= 128;
    const inT = (x, z) => !top || top.data[((D - 1 - z) * W + x) * 4 + 3] >= 128;
    const g = { sx: W, sy: H, sz: D }, N = W * H * D, solid = new Uint8Array(N), idx = (x, y, z) => (y * D + z) * W + x;
    for (let y = 0; y < H; y++) for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) if (inF(x, y) && inS(z, y) && inT(x, z)) solid[idx(x, y, z)] = 1;
    // colours from the view that sees the face (front for −z/+z, side for ±x, top for +y)
    const col = (img, w, i) => [img.data[i * 4], img.data[i * 4 + 1], img.data[i * 4 + 2]];
    g.blocks = new Uint16Array(N).fill(KEEP);
    let n = 0;
    for (let y = 0; y < H; y++) for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
      const i = idx(x, y, z); if (!solid[i]) continue;
      const open = (dx, dy, dz) => { const a = x + dx, b = y + dy, c = z + dz; return a < 0 || b < 0 || c < 0 || a >= W || b >= H || c >= D || !solid[idx(a, b, c)]; };
      const ff = open(0, 0, -1) || open(0, 0, 1), fs = open(-1, 0, 0) || open(1, 0, 0), ft = open(0, 1, 0), fb = open(0, -1, 0);
      if (P.hollow && !(ff || fs || ft || fb)) continue;
      let c, face = 'side';
      if (ft && top) { c = col(top, W, (D - 1 - z) * W + x); face = 'top'; }
      else if (fs && side && !ff) c = col(side, D, (H - 1 - y) * D + z);
      else c = col(front, W, (H - 1 - y) * W + x);
      if (ft && !top) face = 'top';
      g.blocks[i] = BC().nearest(c[0], c[1], c[2], P.set, face); n++;
    }
    g.n = n; g.name = L('im.solidName', '3D-Modell {w}×{h}×{d}', { w: W, h: H, d: D });
    return g;
  }

  // ---------------------------------------------------------------- the preview: the result meshed and photographed
  function preview() {
    const g = IM.result, cv = $('#imPrev'); if (!cv) return;
    const x = cv.getContext('2d');
    if (!g || !g.n) { x.clearRect(0, 0, cv.width, cv.height); IM.shown = false; return; }
    // until the first picture is there: say that it is coming (the Studio's worker may still be busy with the world)
    if (!IM.shown) { x.fillStyle = '#07090d'; x.fillRect(0, 0, cv.width, cv.height); x.fillStyle = '#56708a'; x.font = '600 15px system-ui, sans-serif'; x.textAlign = 'center'; x.fillText('⏳ ' + L('im.prevWait', 'Vorschau wird gebaut …'), cv.width / 2, cv.height / 2); }
    const ver = ++IM.ver, b = g.blocks.slice(); for (let i = 0; i < b.length; i++) if (b[i] === KEEP) b[i] = 0;
    C.call({ type: 'clip_mesh', sx: g.sx, sy: g.sy, sz: g.sz, blocks: b }, [b.buffer]).then((m) => {
      if (m.type !== 'clip_mesh' || ver !== IM.ver) return;
      if (IM.gpu) C.freeSections(IM.gpu);
      IM.gpu = C.uploadSections(m.sections);
      shoot();
    });
  }
  function shoot() {
    const g = IM.result, cv = $('#imPrev'); if (!g || !IM.gpu || !cv) return;
    const sc = { type: 'clip', gpu: IM.gpu, off: [-1, -1, -1], center: [g.sx / 2, g.sy / 2, g.sz / 2], span: Math.max(g.sx, g.sy, g.sz) * 0.62, instances: [] };
    const shot = C.renderThumb(sc, cv.width, cv.height, camOf());
    const x = cv.getContext('2d'); x.clearRect(0, 0, cv.width, cv.height); x.drawImage(shot, 0, 0); IM.shown = true;
    // 🕘: the picture of the project that just changed
    const P = VR.Projects;
    if (P && IM.pjShot && ((IM.mode === 'house' && IM.pjShot === IM.pj.kit) || (IM.mode === 'genie' && IM.pjShot === IM.pj.genie))) { P.thumb(IM.pjShot, cv, 'contain'); IM.pjShot = null; }
  }
  let runT = 0;
  function run() {
    clearTimeout(runT);
    runT = setTimeout(() => {
      if (!BC() || !BC().ready()) { info(L('im.wait', 'Die Blockfarben werden noch gemischt …')); runT = setTimeout(run, 600); return; }
      const t0 = performance.now();
      let g = null;
      try {
        if (IM.mode === 'flat') g = buildFlat();
        else if (IM.mode === 'solid') g = buildSolid();
        else if (IM.mode === 'house') { if (!IM.house) IM.house = HK().normalize(HK().DEFAULT); g = HK().build(IM.house); }
        else if (IM.mode === 'genie') { const z = IM.genie.last; g = !z ? null : z.kind === 'house' ? HK().build(z.spec) : GN().raster(Object.assign({ name: z.name }, z.model), { set: IM.solid.set }); }
        else if (IM.mode === 'site') { siteMap(); return; }
      } catch (e) { console.warn('imagine', e); }
      IM.result = g;
      const need = { flat: L('im.needImg', 'Ein Bild hineinziehen, einfügen (Strg+V) oder öffnen'), solid: L('im.needFront', 'Mindestens die Vorderansicht: hineinziehen, öffnen oder malen'), house: '', genie: L('gn.need', 'Beschreibe oder zeig, was entstehen soll — dann ✨') }[IM.mode];
      const extra = g && g.house ? ` · ${g.house.floors} ${L('hk.floorsN', 'Etagen')}` : '';
      info(g && g.n ? `<b>${esc(g.name || '')}</b> · ${g.sx} × ${g.sy} × ${g.sz} · ${g.n.toLocaleString('de-DE')} ${L('im.blocks', 'Blöcke')}${extra} · ${Math.round(performance.now() - t0)} ms` : need);
      const ok = $('#imOk'); if (ok) ok.disabled = !(g && g.n);
      preview();
    }, 120);
  }
  const info = (h) => { const e = $('#imInfo'); if (e) e.innerHTML = h; };

  // ---------------------------------------------------------------- the dialog
  // where a picture goes in the open mode (a photo dropped on the house tab goes to the Genie, or becomes a Blockbild)
  function slotFor() {
    if (IM.mode === 'house') { IM.mode = 'genie'; IM.genie.want = 'house'; }
    if (IM.mode === 'genie') return 'genie';
    return IM.mode === 'flat' ? 'flat' : (IM.solid.front ? (IM.solid.side ? 'top' : 'side') : 'front');
  }
  const slotGet = (slot) => (slot === 'flat' ? IM.flat.img : slot === 'genie' ? IM.genie.img : IM.solid[slot]);
  const slotSet = (slot, cv) => { if (slot === 'flat') IM.flat.img = cv; else if (slot === 'genie') IM.genie.img = cv; else IM.solid[slot] = cv; };
  function open(file, mode) {
    let el = $('#imagine');
    if (!el) { el = document.createElement('div'); el.id = 'imagine'; $('#studio').appendChild(el); }
    if (!IM.restored) { IM.restored = true; restoreLast(); }
    if (mode) IM.mode = mode;
    el.classList.add('on');
    draw();
    if (file) take(file, slotFor());
    else run();
  }
  function close() { kitFlush(); const el = $('#imagine'); if (el) el.classList.remove('on'); if (IM.gpu) { C.freeSections(IM.gpu); IM.gpu = null; } }
  async function take(file, slot) {
    const cv = await loadImage(file); if (!cv) return;
    slotSet(slot, cv);
    draw(); if (slot !== 'genie') run();
  }
  function pick(slot) {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = () => { const f = inp.files && inp.files[0]; if (f) take(f, slot); };
    inp.click();
  }
  const SLOTS = [['front', 'im.front', 'Vorne'], ['side', 'im.side', 'Seite (vorne links)'], ['top', 'im.top', 'Oben (vorne unten)']];
  // ---------------------------------------------------------------- 🏠 the Baukasten's choices
  const STY = [['cottage', '🏡', 'hk.s.cottage', 'Landhaus'], ['modern', '🏢', 'hk.s.modern', 'Modern'], ['classic', '🏛', 'hk.s.classic', 'Klassisch'], ['cabin', '🪵', 'hk.s.cabin', 'Hütte']];
  const ROOFT = [['gable', '⌂', 'hk.r.gable', 'Satteldach'], ['hip', '◇', 'hk.r.hip', 'Walmdach'], ['flat', '▭', 'hk.r.flat', 'Flachdach'], ['shed', '◿', 'hk.r.shed', 'Pultdach'], ['pyramid', '△', 'hk.r.pyramid', 'Zeltdach'], ['mansard', '⛫', 'hk.r.mansard', 'Mansarde']];
  const WALLM = [['plaster', 'hk.w.plaster', 'Putz'], ['brick', 'hk.w.brick', 'Ziegel'], ['wood', 'hk.w.wood', 'Holz'], ['stone', 'hk.w.stone', 'Stein'], ['timber', 'hk.w.timber', 'Fachwerk'], ['log', 'hk.w.log', 'Blockhaus'], ['concrete', 'hk.w.concrete', 'Beton'], ['glass', 'hk.w.glass', 'Glas']];
  const WINS = [['small', 'hk.n.small', 'klein'], ['std', 'hk.n.std', 'normal'], ['tall', 'hk.n.tall', 'hoch'], ['wide', 'hk.n.wide', 'breit'], ['panorama', 'hk.n.panorama', 'Panorama'], ['arch', 'hk.n.arch', 'Bogen'], ['round', 'hk.n.round', 'rund']];
  const FRAMES = [['white', 'hk.f.white', 'weiß'], ['black', 'hk.f.black', 'schwarz'], ['wood', 'hk.f.wood', 'Holz']];
  const DOORP = [['left', '◧', 'hk.d.left', 'links'], ['center', '▣', 'hk.d.center', 'Mitte'], ['right', '◨', 'hk.d.right', 'rechts']];
  const DOORK = [['wood', 'hk.k.wood', 'Holz'], ['glass', 'hk.k.glass', 'Glas'], ['double', 'hk.k.double', 'Doppel'], ['modern', 'hk.k.modern', 'Modern']];
  const EXTRA = [['chimney', '🔥', 'hk.x.chimney', 'Kamin'], ['porch', '⛱', 'hk.x.porch', 'Vordach'], ['balcony', '🌅', 'hk.x.balcony', 'Balkon'], ['garage', '🚗', 'hk.x.garage', 'Garage'], ['terrace', '🪑', 'hk.x.terrace', 'Terrasse'], ['fence', '🚧', 'hk.x.fence', 'Zaun'], ['columns', '🏛', 'hk.x.columns', 'Säulen'], ['flowers', '🌼', 'hk.x.flowers', 'Blumen'], ['dormers', '🪟', 'hk.x.dormers', 'Gauben'], ['garden', '🌳', 'hk.x.garden', 'Garten'], ['pool', '🏊', 'hk.x.pool', 'Pool'], ['solar', '☀️', 'hk.x.solar', 'Solar']];
  const ROOFC = ['#b0453a', '#c8693f', '#4f5663', '#2a2d33', '#3f63a8', '#2f8c8a', '#4e7f46', '#8e6a45', '#d2b060', '#e2e7ee', '#7a55c8', '#e58fb0'];
  const WALLC = ['#f1ece0', '#eeddb8', '#f3bf9a', '#b3d6ee', '#b5e2c4', '#f4e09a', '#efb3b8', '#a84e3a', '#9c9a94', '#8a5e36', '#3a3d42', '#f4f4f2'];
  const SHUTC = ['#5e9a6a', '#4f7fb8', '#b5423a', '#3e9c98', '#e7b84a', '#7a55c8'];
  const getP = (o, path) => path.split('.').reduce((a, k) => (a ? a[k] : undefined), o);
  const setP = (o, path, v) => { const ks = path.split('.'), last = ks.pop(); let t = o; for (const k of ks) { if (!t[k] || typeof t[k] !== 'object') t[k] = {}; t = t[k]; } t[last] = v; };
  function houseLeft() {
    if (!IM.house) IM.house = HK().normalize(HK().DEFAULT);
    const H = IM.house;
    const seg = (path, list, iconAt) => list.map((e) => { const v = e[0], on = String(getP(H, path)) === String(v); const lab = iconAt ? `${e[1]} ${esc(L(e[2], e[3]))}` : esc(L(e[1], e[2])); return `<button data-hs="${path}" data-v="${v}" class="${on ? 'on' : ''}" title="${esc(iconAt ? L(e[2], e[3]) : L(e[1], e[2]))}">${lab}</button>`; }).join('');
    const sw = (path, cols) => cols.map(c => `<button class="sw${(getP(H, path) || '').toLowerCase() === c ? ' on' : ''}" data-hcol="${path}" data-v="${c}" style="background:${c}" title="${c}"></button>`).join('') + `<input type="color" data-hcolor="${path}" value="${getP(H, path) || '#ffffff'}" title="${L('hk.own', 'Eigene Farbe')}">`;
    const floors = [1, 2, 3, 4].map(n => `<button data-hs="floors" data-v="${n}" class="${H.floors === n ? 'on' : ''}">${n}</button>`).join('');
    const busy = GN() && GN().busy();
    const ai = `<div class="hkAi"><input id="hkWish" value="${esc(IM.hkWish)}" placeholder="${esc(L('hk.wishPh', '✨ Sag, was anders sein soll — z. B. „rotes Dach, drei Etagen, mit Pool“'))}"><button id="hkWishGo" class="cbtn pri" ${busy ? 'disabled' : ''}>✨</button>${busy ? `<button id="gnStop" class="cbtn" title="${L('gn.stop', 'Stopp')}">■</button>` : ''}</div>${IM.genie.status && IM.genie.from === 'house' ? `<div id="gnStatus" class="gnStatus">${IM.genie.status}</div>` : ''}`;
    return `<div class="hkTop"><input class="hkName" value="${esc(H.name)}" maxlength="40" title="${L('hk.name', 'Name')}"><button data-hk="new" title="${L('hk.newT', 'Ein neues Haus anfangen — das jetzige bleibt unter 🕘 Weitermachen')}">＋</button><button data-hk="random" title="${L('hk.randomT', 'Ein zufälliges Haus — so oft du willst')}">🎲 ${L('hk.random', 'Zufall')}</button><button data-mode="genie" data-want="house" title="${L('hk.fromAiT', 'Ein Foto von einem Haus → das Genie baut es nach, mit Zimmern und Möbeln')}">📷 ${L('hk.fromAi', 'Aus Foto')}</button></div>${ai}
      <div class="hkRow"><span>${L('hk.style', 'Stil')}</span><div class="imSeg">${seg('style', STY, true)}</div></div>
      <div class="hkRow"><span>${L('hk.size', 'Größe')}</span><div class="hkSize"><label>${L('hk.width', 'Breite')} <b id="hkWv">${H.width}</b><input type="range" min="7" max="31" value="${H.width}" data-hn="width"></label><label>${L('hk.depth', 'Tiefe')} <b id="hkDv">${H.depth}</b><input type="range" min="7" max="25" value="${H.depth}" data-hn="depth"></label></div></div>
      <div class="hkRow"><span>${L('hk.floors', 'Etagen')}</span><div class="imSeg">${floors}<label class="hkChk"><input type="checkbox" data-hc="tall" ${H.floorHeight >= 5 ? 'checked' : ''}> ${L('hk.tall', 'hohe Räume')}</label></div></div>
      <div class="hkRow"><span>${L('hk.roof', 'Dach')}</span><div class="imSeg">${seg('roof.type', ROOFT, true)}</div></div>
      <div class="hkRow"><span></span><div class="hkCols">${sw('roof.color', ROOFC)}${H.roof.type === 'gable' ? `<label class="hkChk"><input type="checkbox" data-hc="ridge" ${H.roof.ridge === 'front' ? 'checked' : ''}> ${L('hk.gableFront', 'Giebel vorne')}</label>` : ''}</div></div>
      <div class="hkRow"><span>${L('hk.walls', 'Wände')}</span><div class="imSeg">${seg('walls.material', WALLM)}</div></div>
      <div class="hkRow"><span></span><div class="hkCols">${sw('walls.color', WALLC)}<span class="hkLab">${L('hk.accent', 'Akzent')}</span><input type="color" data-hcolor="accent" value="${H.accent}"></div></div>
      <div class="hkRow"><span>${L('hk.windows', 'Fenster')}</span><div class="imSeg">${seg('windows.style', WINS)}</div></div>
      <div class="hkRow"><span></span><div class="imSeg">${seg('windows.frame', FRAMES)}<span class="hkLab">${L('hk.shutters', 'Läden')}</span><button class="sw none${H.windows.shutters ? '' : ' on'}" data-hcol="windows.shutters" data-v="" title="${L('hk.none', 'keine')}">∅</button>${SHUTC.map(c => `<button class="sw${H.windows.shutters === c ? ' on' : ''}" data-hcol="windows.shutters" data-v="${c}" style="background:${c}"></button>`).join('')}</div></div>
      <div class="hkRow"><span>${L('hk.door', 'Tür')}</span><div class="imSeg">${seg('door.position', DOORP, true)}${seg('door.kind', DOORK)}<input type="color" data-hcolor="door.color" value="${H.door.color}" title="${L('hk.doorColor', 'Farbe der Tür')}"></div></div>
      <div class="hkRow"><span>${L('hk.extras', 'Extras')}</span><div class="imSeg">${EXTRA.map(([id, ic, k, de]) => `<button data-hx="${id}" class="${H.extras.includes(id) ? 'on' : ''}"${id === 'balcony' && H.floors < 2 ? ' disabled title="' + L('hk.needFloors', 'ab 2 Etagen') + '"' : ''}>${ic} ${esc(L(k, de))}</button>`).join('')}</div></div>
      <div class="imChecks"><label><input type="checkbox" data-hc="interior" ${H.interior ? 'checked' : ''}> ${L('hk.interior', 'Eingerichtet: Küche, Sofa, Betten, Treppen, Lampen')}</label></div>`;
  }
  // ---------------------------------------------------------------- 🏘 a whole place
  function siteLeft() {
    const SITE = WM.site, busy = GN() && GN().busy(), WB = WM.wb, sel = WB && WB.selBox ? WB.selBox() : null;
    if (!SITE.area || SITE.world !== WM.world) { SITE.prepare(SITE.size, false); SITE.world = WM.world; SITE.plan = null; SITE.placed = null; SITE.hist = []; }
    const sizes = [[48, 'S'], [64, 'M'], [96, 'L']].map(([n, t]) => `<button data-ssize="${n}" class="${!SITE.useSel && SITE.size === n ? 'on' : ''}" title="${n} × ${n}">${t}</button>`).join('') + (sel ? `<button data-ssize="sel" class="${SITE.useSel ? 'on' : ''}" title="${L('st.selT', 'Deine Auswahl in der Werkbank')}">▣ ${L('st.sel', 'Auswahl')}</button>` : '');
    const P = SITE.plan, Q = SITE.placed;
    const sum = P && Q ? `<div class="gnNote">🏘 <b>${esc(P.name)}</b>${P.notes ? ' — ' + esc(P.notes) : ''}<br><span class="dim">${Q.houses.length} ${L('st.houses', 'Häuser')}${Q.models.length ? ' · ' + Q.models.length + ' ' + L('st.landmarks', 'Wahrzeichen') : ''} · ${P.paths.length} ${L('st.paths', 'Wege')} · ${P.trees.length} ${L('st.trees', 'Bäume')} · ${P.props.length} ${L('st.props', 'Dinge')}${Q.skipped.length ? ' · ⚠ ' + L('st.skipped', '{n} passten nicht hin: {w}', { n: Q.skipped.length, w: esc(Q.skipped.slice(0, 3).join(', ')) }) : ''}</span>${Q.houses.length ? '<div class="stHouses">' + Q.houses.map(h => `<span><i style="background:${h.spec.roof.color}"></i>${esc(h.label || h.spec.name)}</span>`).join('') + '</div>' : ''}</div>` : '';
    return `<textarea id="stText" rows="3" placeholder="${esc(L('st.ph', 'Was soll hier entstehen? z. B. „Fischerdorf mit Hafen, Marktplatz und sechs Häusern“, „moderne Villensiedlung am Hang“, „Bergdorf mit Kapelle und Feldern“'))}">${esc(SITE.text)}</textarea>
      <div class="gnChips">${STCHIPS.map(c => `<button class="chip" data-schip="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      <div class="gnRow"><span>${L('st.area', 'Gebiet')}</span><div class="imSeg">${sizes}</div></div>
      <div class="imActs"><button id="stGo" class="cbtn pri" ${busy ? 'disabled' : ''}>✨ ${L('st.go', 'Ort planen')}</button><button id="stRnd" class="cbtn" ${busy ? 'disabled' : ''} title="${L('st.rndT', 'Ein Dorf nach Zufall — so oft du willst')}">🎲 ${L('st.rnd', 'Dorf würfeln')}</button>${P ? `<button id="stEdit" class="cbtn pri2" ${busy ? 'disabled' : ''} title="${L('st.editT', 'Den Ort so ändern, wie du es schreibst — z. B. „mit Kirche“, „mehr Häuser“, „ohne Felder“')}">✏️ ${L('gn.edit', 'Ändern')}</button>` : ''}${SITE.hist.length && !busy ? `<button id="stBack" class="cbtn">⟲ ${SITE.hist.length}</button>` : ''}${busy ? `<button id="gnStop" class="cbtn">■ ${L('gn.stop', 'Stopp')}</button>` : ''}</div>
      <div id="gnStatus" class="gnStatus">${SITE.status || ''}</div>
      ${sum}
      <p class="dim">${L('st.how', 'Das Gebiet liegt dort, wo die Kamera hinschaut (oder deine Auswahl). Ich lese Höhen, Wasser, Fels und Bäume und plane den Ort passend dazu — jedes Haus mit Zimmern und Möbeln, dazu Wege, Plätze, Felder, Stege, Kirchen, Leuchttürme und Mühlen, wenn du sie willst.')}</p>`;
  }
  function siteMap() {
    const SITE = WM.site, cv = $('#imPrev'); if (!cv || !SITE.area) return;
    SITE.drawMap(cv, SITE.area, SITE.sv, SITE.plan, SITE.placed);
    const A = SITE.area, inf = $('#imInfo');
    if (inf) inf.innerHTML = `<b>${A.w} × ${A.d}</b> · ${L('st.at', 'bei')} ${A.x0 + (A.w >> 1)} · ${A.z0 + (A.d >> 1)} · ${L('st.height', 'Höhen')} ${SITE.sv.base}–${SITE.sv.max}${SITE.sv.water >= 0 ? ' · 🌊' : ''}`;
  }
  async function siteWish(change) {
    const SITE = WM.site, G = GN(); if (!G || G.busy()) return;
    const t = $('#stText'); if (t) SITE.text = t.value;
    if (!SITE.text.trim()) { SITE.status = '✍️ ' + L('st.needText', 'Schreib, was hier entstehen soll.'); draw(); return; }
    const t0 = performance.now(); let chars = 0;
    const show = () => { SITE.status = '✨ ' + L('st.thinking', 'Ich lese das Gelände und plane …'); const st = $('#gnStatus'); if (st) st.innerHTML = SITE.status; };
    clearInterval(tick); tick = setInterval(show, 1000);
    const p = SITE.ask(SITE.text, change, (kind, n) => { if (kind === 'text') { chars = n; show(); } });
    show(); draw();
    try {
      const plan = await p;
      const Q = SITE.setPlan(plan);
      SITE.status = '✓ ' + L('st.planned', 'Geplant: {h} Häuser — sieh dir die Karte an, dann ✓ Bauen.', { h: Q.houses.length }) + (Q.skipped.length ? ' ' + L('st.skippedN', '({n} passten nicht hin.)', { n: Q.skipped.length }) : '');
      siteSave(false);
    } catch (e) {
      const x = G.explain(e);
      SITE.status = (e && e.code === 'cancelled' ? '■ ' : '⚠ ') + esc(x.text);
    } finally { clearInterval(tick); }
    if ($('#imagine') && $('#imagine').classList.contains('on')) { draw(); run(); }
  }
  // ---------------------------------------------------------------- ✨ the Genie's side
  // words that mean a whole place rather than one thing
  // (German compounds: "Fischerdorf", "Hafenstadt" — but a "Stadtvilla" is one house)
  const PLACE_RE = /(dorf|dörfer|stadt(?!villa)|städt|siedlung|viertel|quartier|hafen|marktplatz|village|town|city|settlement|harbou?r|hamlet|neighbou?rhood)|\bort\b/i;
  // ready-made wishes: to start with, after a wish that was not understood, and to change what is there
  const STARTS = ['Feuerwehrauto mit Leiter', 'Leuchtturm', 'Drache, der Feuer speit', 'Einhorn', 'Piratenschiff', 'Villa mit Pool', 'großer Kirschbaum', 'Burg', 'Rakete', 'rotes Sportauto', 'Schild mit Willkommen', 'Gartenzwerg', 'Riesenrad', 'Weihnachtsbaum'];
  const STCHIPS = ['Fischerdorf mit Hafen und Booten', 'Bergdorf mit Kapelle', 'Bauernhof mit Feldern', 'moderne Siedlung mit Pools', 'Kleinstadt mit Marktplatz', 'Burg mit Dorf'];
  function chipsFor(z) {
    if (!z) return null;
    if (z.kind === 'house') return ['Dach blau', 'drei Etagen', 'mit Pool', 'ohne Kamin', 'größer', 'modern'];
    if (z.photo) return null;
    const B = GB(); return B && z.recipe ? B.hintsFor(z.recipe.type) : ['größer', 'kleiner'];
  }
  function genieLeft() {
    const Gs = IM.genie, busy = GN() && GN().busy(), z = Gs.last, B = GB();
    const img = Gs.img ? `<img src="${Gs.img.toDataURL()}" alt="">` : '<i>📷</i>';
    const slot = `<div class="imSlot" data-slot="genie"><span class="t">${Gs.want === 'house' ? L('gn.photoHouse', '📷 Foto von einem Haus — ich baue es nach') : L('gn.photo', 'Foto oder Skizze (wenn du willst)')}</span>${img}<div class="b"><button data-open="genie">📂 ${L('im.open', 'Öffnen')}</button><button data-draw="genie">✏️ ${L('gn.sketchB', 'Skizzieren')}</button>${Gs.img ? '<button data-clear="genie">✕</button>' : ''}</div></div>`;
    const sizes = [[16, 'S'], [32, 'M'], [48, 'L'], [72, 'XL']].map(([n, t]) => `<button data-gsize="${n}" class="${Gs.size === n ? 'on' : ''}" title="${n} ${L('im.blocks', 'Blöcke')}">${t}</button>`).join('');
    // the chips: what did not work → ideas; a design → changes to it; nothing yet → things to try
    let chips = Gs.chips, mode = Gs.chipMode;
    if (!chips) { const c = chipsFor(z); if (c) { chips = c; mode = 'edit'; } else { chips = STARTS.slice((Gs.hist.length * 3) % STARTS.length).concat(STARTS).slice(0, 6); mode = 'new'; } }
    const chipHtml = chips.map(c => `<button class="chip" data-gchip="${esc(c)}" data-gmode="${mode}">${mode === 'edit' ? '✏️ ' : ''}${esc(c)}</button>`).join('')
      + (Gs.word && mode === 'new' ? `<button class="chip" data-gchip="${esc('Schriftzug ' + Gs.word)}" data-gmode="new">🔤 ${L('gn.asText', 'Als Schriftzug')}</button>` : '')
      + (z && z.photo && Gs.img ? `<button class="chip" data-gchip="" data-gmode="house">🏠 ${L('gn.asHouse', 'Als Haus bauen')}</button>` : '');
    return `${slot}
      <textarea id="gnText" rows="3" placeholder="${esc(z ? L('gn.ph2', 'Neuer Wunsch — oder was soll anders werden? z. B. „Dach blau“, „größere Räder“, „mit Garage“') : L('gn.ph', 'Was soll entstehen? z. B. „rotes Landhaus mit Holzbalkon“, „Feuerwehrauto“, „Leuchtturm“, „Kirschbaum“'))}">${esc(Gs.text)}</textarea>
      <div class="gnChips">${chipHtml}</div>
      <div class="gnRow"><span>${L('gn.size', 'Größe')}</span><div class="imSeg">${sizes}</div></div>
      <div class="imActs"><button id="gnGo" class="cbtn pri" ${busy ? 'disabled' : ''}>✨ ${z ? L('gn.goNew', 'Neu erschaffen') : L('gn.go', 'Erschaffen')}</button>${z ? `<button id="gnEdit" class="cbtn pri2" ${busy ? 'disabled' : ''} title="${L('gn.editT', 'Ändert das, was da ist, so wie du es schreibst')}">✏️ ${L('gn.edit', 'Ändern')}</button>` : ''}${Gs.hist.length && !busy ? `<button id="gnBack" class="cbtn" title="${L('gn.backT', 'Zur vorigen Version')}">⟲ ${Gs.hist.length}</button>` : ''}${busy ? `<button id="gnStop" class="cbtn">■ ${L('gn.stop', 'Stopp')}</button>` : ''}</div>
      <div id="gnStatus" class="gnStatus">${Gs.status || ''}</div>
      <button id="gnToSite" class="cbtn" style="display:${WM.world && PLACE_RE.test(Gs.text) ? '' : 'none'}">🏘 ${L('gn.toSite', 'Das ist ein ganzer Ort — im Gelände planen')}</button>
      ${z ? `<div class="gnNote">${z.kind === 'house' ? '🏠' : '🧩'} <b>${esc(z.name || '')}</b>${z.notes ? ' — ' + esc(z.notes) : ''}</div>` : ''}
      ${z && z.kind === 'house' ? `<button data-mode="house" class="cbtn">🏠 ${L('gn.tune', 'Im Baukasten anpassen')}</button>` : ''}
      <p class="dim">${L('gn.how2', 'Das Genie kennt {n} Dinge — Fahrzeuge, Schiffe, Tiere, Figuren, Gebäude, Pflanzen, Essen, Schriftzüge — und baut Häuser mit Zimmern. Farben, Größe und Extras sagst du einfach dazu. Alles passiert hier im Spiel: ohne Konto, ohne Limit.', { n: B ? B.LIB.length + '+' : '170+' })}</p>`;
  }
  function draw() {
    const el = $('#imagine'); if (!el) return;
    const P = IM.mode === 'flat' ? IM.flat : IM.solid;
    const sets = (VR.BlockColors ? VR.BlockColors.SETS : [['all', 'Alle Blöcke']]).map(([id, de]) => `<button data-set="${id}" class="${P.set === id ? 'on' : ''}">${esc(L('im.set.' + id, de))}</button>`).join('');
    const thumb = (cv) => cv ? `<img src="${cv.toDataURL()}" alt="">` : '<i>＋</i>';
    let left = '';
    if (IM.mode === 'site' && !WM.world) IM.mode = 'house';
    if (IM.mode === 'house') left = houseLeft();
    else if (IM.mode === 'genie') left = genieLeft();
    else if (IM.mode === 'site') left = siteLeft();
    else if (IM.mode === 'flat') {
      left = `<div class="imSlot big" data-slot="flat">${thumb(IM.flat.img)}<div class="b"><button data-open="flat">📂 ${L('im.open', 'Öffnen')}</button><button data-draw="flat">✏️ ${L('im.draw', 'Malen')}</button>${IM.flat.img ? `<button data-clear="flat">✕</button>` : ''}</div></div>
        <label>${L('im.orient', 'Ausrichtung')}</label><div class="imSeg"><button data-orient="wall" class="${P.orient === 'wall' ? 'on' : ''}">🧱 ${L('im.wall', 'Wand')}</button><button data-orient="floor" class="${P.orient === 'floor' ? 'on' : ''}">▭ ${L('im.floor', 'Boden')}</button></div>
        <label>${L('im.width', 'Breite')} <b id="imWv">${P.width}</b></label><input type="range" min="8" max="256" step="1" value="${P.width}" data-k="width">
        <label>${L('im.relief', 'Relief (hell = vorne)')} <b id="imRv">${P.relief || L('im.flatOff', 'flach')}</b></label><input type="range" min="0" max="8" step="1" value="${P.relief}" data-k="relief">
        <div class="imChecks"><label><input type="checkbox" data-c="bg" ${P.bg ? 'checked' : ''}> ${L('im.bg', 'Hintergrund weg')}</label><label><input type="checkbox" data-c="dither" ${P.dither ? 'checked' : ''}> ${L('im.dither', 'Rastern (feinere Farben)')}</label></div>`;
    } else {
      left = '<div class="imSlots">' + SLOTS.map(([id, k, de]) => `<div class="imSlot" data-slot="${id}"><span class="t">${esc(L(k, de))}</span>${thumb(IM.solid[id])}<div class="b"><button data-open="${id}" title="${L('im.open', 'Öffnen')}">📂</button><button data-draw="${id}" title="${L('im.draw', 'Malen')}">✏️</button>${id === 'side' && IM.solid.side ? `<button data-flip="side" class="${P.flipSide ? 'on' : ''}" title="${L('im.flip', 'Spiegeln')}">↔</button>` : ''}${IM.solid[id] ? `<button data-clear="${id}">✕</button>` : ''}</div></div>`).join('') + '</div>'
        + `<label>${L('im.height', 'Höhe in Blöcken')} <b id="imHv">${P.height}</b></label><input type="range" min="6" max="96" step="1" value="${P.height}" data-k="height">`
        + (IM.solid.side ? '' : `<label>${L('im.depth', 'Tiefe (ohne Seitenansicht)')} <b id="imDv">${P.depth || L('im.auto', 'automatisch')}</b></label><input type="range" min="0" max="64" step="1" value="${P.depth}" data-k="depth">`)
        + `<div class="imChecks"><label><input type="checkbox" data-c="hollow" ${P.hollow ? 'checked' : ''}> ${L('im.hollow', 'Innen hohl (weniger Blöcke)')}</label></div>`;
    }
    const pictures = IM.mode === 'flat' || IM.mode === 'solid';
    const setsRow = pictures || (IM.mode === 'genie' && IM.genie.last && IM.genie.last.kind === 'model') ? `<label>${L('im.blocksFrom', 'Blöcke')}</label><div class="imSeg sets">${sets}</div>` : '';
    const tolRow = pictures ? `<label>${L('im.tol', 'Hintergrund-Toleranz')} <b id="imTv">${P.tol}</b></label><input type="range" min="4" max="60" step="1" value="${P.tol}" data-k="tol">` : '';
    const SITE = WM.site, siteMode = IM.mode === 'site';
    const how = { site: '', flat: L('im.flatHow', 'Fotos, Pixel-Art, Logos: der Hintergrund fällt weg, jede Farbe wird der Block, der ihr am nächsten kommt.'), solid: L('im.solidHow', 'Zeichne oder fotografiere dein Ding von vorne und von der Seite (gleiche Höhe) — das Studio schnitzt die Form heraus und malt sie mit den Farben der Bilder an. Ohne Seitenansicht wird die Vorderansicht ausgestochen.'), house: L('hk.how', 'Jede Wahl baut das Haus sofort neu — mit Zimmern, Treppe und Möbeln. Fertig? „In die Werkbank“, auf die Welt zeigen, klicken. R dreht es.'), genie: '' }[IM.mode];
    const modes = [['flat', '🧱', 'im.flat', 'Blockbild'], ['solid', '🧊', 'im.solid', '3D aus Ansichten'], ['house', '🏠', 'hk.tab', 'Haus'], ['genie', '✨', 'gn.tab', 'Genie'], ['site', '🏘', 'st.tab', 'Ort']].filter(m => m[0] !== 'site' || WM.world);
    el.innerHTML = `<div class="imBox"><header><b>✨ ${L('im.title2', 'Erschaffen')}</b><div class="imModes">${modes.map(([id, ic, k, de]) => `<button data-mode="${id}" class="${IM.mode === id ? 'on' : ''}">${ic} ${esc(L(k, de))}</button>`).join('')}</div><button class="x" data-close>✕</button></header>
      <div class="imBody"><div class="imLeft ${IM.mode}">${left}${setsRow}${tolRow}</div>
      <div class="imRight">${siteMode ? `<canvas id="imPrev" class="map" width="440" height="440"></canvas><div id="imInfo" class="dim"></div>
        <div class="imActs"><button id="stBuild" class="cbtn pri" ${SITE && SITE.placed && (SITE.placed.houses.length || SITE.plan.paths.length) && !(GN() && GN().busy()) ? '' : 'disabled'}>✓ ${L('st.build', 'Bauen')}</button><button id="stHere" class="cbtn" title="${L('st.hereT', 'Das Gebiet neu ausmessen — dort, wo die Kamera jetzt hinschaut')}">📍 ${L('st.here', 'Hier ausmessen')}</button></div>
        <p class="dim">${L('st.how2', 'Gebaut wird erst mit ✓ Bauen: der Boden unter jedem Haus wird geebnet, Wege folgen dem Gelände, über Wasser werden es Stege. Alles ist ein Schritt — ⟲ Zurück in der Werkbank nimmt es wieder weg.')}</p></div></div></div>` : `<canvas id="imPrev" width="420" height="320" title="${L('im.rotate', 'Ziehen dreht')}"></canvas><div id="imInfo" class="dim"></div>
        <div class="imActs">${WM.world ? `<button id="imOk" class="cbtn pri" disabled>✓ ${L('im.ok', 'In die Werkbank')}</button>` : ''}<button id="imLib" class="cbtn${WM.world ? '' : ' pri'}">🧩 ${L('im.lib', 'Als Bauteil')}</button>${WM.world ? '' : `<button class="cbtn" data-exp="schem" title="${L('wb.expSchem', 'Für WorldEdit, Amulet, Axiom, MCEdit')}">⬇ .schem</button><button class="cbtn" data-exp="vox" title="${L('wb.expVox', 'Für MagicaVoxel')}">⬇ .vox</button><button class="cbtn" data-exp="json" title="${L('wb.expJson', 'Als R9-Bauteil')}">⬇ .json</button>`}</div>
        ${WM.world ? '' : `<p class="dim">${L('im.noWorld', 'Keine Welt offen: behalte es als Bauteil oder speichere es als Datei. Im Spiel (Pause → R9 Studio) setzt du es mit der Werkbank in deine Welt.')}</p>`}
        ${how ? `<p class="dim">${how}</p>` : ''}</div></div></div>`}`;
    IM.shown = false;
    // wiring
    el.querySelector('[data-close]').onclick = close;
    el.onclick = (e) => { if (e.target === el) close(); };
    for (const b of el.querySelectorAll('[data-mode]')) b.onclick = () => { if (b.dataset.mode === 'genie') IM.genie.want = b.dataset.want || null; IM.mode = b.dataset.mode; if (IM.mode === 'house' && IM.genie.last && IM.genie.last.kind === 'house' && b.closest('.imLeft')) { kitFlush(); IM.house = HK().normalize(IM.genie.last.spec); IM.pj.kit = null; } draw(); run(); };
    for (const b of el.querySelectorAll('[data-set]')) b.onclick = () => { P.set = b.dataset.set; if (IM.mode === 'genie') IM.solid.set = b.dataset.set; draw(); run(); };
    for (const b of el.querySelectorAll('[data-orient]')) b.onclick = () => { IM.flat.orient = b.dataset.orient; draw(); run(); };
    for (const b of el.querySelectorAll('[data-open]')) b.onclick = (e) => { e.stopPropagation(); pick(b.dataset.open); };
    for (const b of el.querySelectorAll('[data-draw]')) b.onclick = (e) => { e.stopPropagation(); pad(b.dataset.draw); };
    for (const b of el.querySelectorAll('[data-clear]')) b.onclick = (e) => { e.stopPropagation(); slotSet(b.dataset.clear, null); draw(); if (b.dataset.clear !== 'genie') run(); };
    for (const b of el.querySelectorAll('[data-flip]')) b.onclick = (e) => { e.stopPropagation(); IM.solid.flipSide = !IM.solid.flipSide; draw(); run(); };
    for (const r of el.querySelectorAll('input[type=range][data-k]')) r.oninput = () => { P[r.dataset.k] = +r.value; const lab = { width: '#imWv', relief: '#imRv', height: '#imHv', depth: '#imDv', tol: '#imTv' }[r.dataset.k]; const v = $(lab); if (v) v.textContent = r.dataset.k === 'relief' && !+r.value ? L('im.flatOff', 'flach') : r.dataset.k === 'depth' && !+r.value ? L('im.auto', 'automatisch') : r.value; run(); };
    for (const c of el.querySelectorAll('input[type=checkbox][data-c]')) c.onchange = () => { P[c.dataset.c] = c.checked; run(); };
    // 🏠 the Baukasten
    const H = IM.house, again = () => { IM.house = HK().normalize(IM.house); kitChanged(true); draw(); run(); };
    for (const b of el.querySelectorAll('[data-hs]')) b.onclick = () => { const path = b.dataset.hs, v = b.dataset.v; setP(H, path, path === 'floors' ? +v : v); if (path === 'style') { const d = HK().normalize({ style: v }); H.floorHeight = d.floorHeight; } again(); };
    for (const b of el.querySelectorAll('[data-hcol]')) b.onclick = () => { setP(H, b.dataset.hcol, b.dataset.v || null); again(); };
    for (const c of el.querySelectorAll('input[type=color][data-hcolor]')) { c.oninput = () => { setP(H, c.dataset.hcolor, c.value); IM.house = HK().normalize(H); kitChanged(true); run(); }; c.onchange = () => again(); }
    for (const r of el.querySelectorAll('input[type=range][data-hn]')) r.oninput = () => { H[r.dataset.hn] = +r.value; const v = $(r.dataset.hn === 'width' ? '#hkWv' : '#hkDv'); if (v) v.textContent = r.value; IM.house = HK().normalize(H); kitChanged(true); run(); };
    for (const b of el.querySelectorAll('[data-hx]')) b.onclick = () => { const x = b.dataset.hx, i = H.extras.indexOf(x); if (i >= 0) H.extras.splice(i, 1); else H.extras.push(x); again(); };
    for (const c of el.querySelectorAll('input[type=checkbox][data-hc]')) c.onchange = () => { const k = c.dataset.hc; if (k === 'tall') H.floorHeight = c.checked ? 5 : 4; else if (k === 'ridge') H.roof.ridge = c.checked ? 'front' : 'side'; else if (k === 'interior') H.interior = c.checked; again(); };
    const nm = el.querySelector('.hkName'); if (nm) nm.oninput = () => { H.name = nm.value.slice(0, 40) || L('hk.house', 'Haus'); kitChanged(true); run(); };
    const rnd = el.querySelector('[data-hk="random"]'); if (rnd) rnd.onclick = () => { IM.house = HK().random(); kitChanged(false); draw(); run(); };
    const nw = el.querySelector('[data-hk="new"]'); if (nw) nw.onclick = () => { kitFlush(); IM.house = HK().normalize(HK().DEFAULT); IM.pj.kit = null; IM.kitManual = false; IM.hkWish = ''; draw(); run(); };
    // ✨ the Genie
    const toSite = $('#gnToSite'); if (toSite) toSite.onclick = () => { WM.site.text = IM.genie.text; IM.mode = 'site'; draw(); run(); };
    const tx = $('#gnText'); if (tx) { tx.oninput = () => { IM.genie.text = tx.value; const h = $('#gnToSite'); if (h) h.style.display = WM.world && PLACE_RE.test(tx.value) ? '' : 'none'; }; tx.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) wish(IM.genie.last && !e.shiftKey ? 'edit' : 'new'); }; }
    for (const b of el.querySelectorAll('[data-gsize]')) b.onclick = () => { IM.genie.size = +b.dataset.gsize; draw(); };
    for (const b of el.querySelectorAll('[data-gchip]')) b.onclick = () => { const Gs = IM.genie, m = b.dataset.gmode; if (m === 'house') { wish('photoHouse'); return; } Gs.text = b.dataset.gchip; wish(m === 'edit' ? 'edit' : 'new'); };
    const go = $('#gnGo'); if (go) go.onclick = () => wish('new');
    const ed = $('#gnEdit'); if (ed) ed.onclick = () => wish('edit');
    const bk = $('#gnBack'); if (bk) bk.onclick = () => { const Gs = IM.genie, p = Gs.hist.pop(); if (!p) return; Gs.last = p; if (p.kind === 'house') { kitFlush(); IM.house = HK().normalize(p.spec); IM.pj.kit = null; } Gs.status = '⟲ ' + L('gn.backDone', 'Vorige Version'); genieSave(false); draw(); run(); };
    const stop = $('#gnStop'); if (stop) stop.onclick = () => GN().stop();
    const hw = $('#hkWish'); if (hw) { hw.oninput = () => { IM.hkWish = hw.value; }; hw.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') wish('house'); }; }
    const hg = $('#hkWishGo'); if (hg) hg.onclick = () => wish('house');
    // 🏘 Ort
    const stT = $('#stText'); if (stT) { stT.oninput = () => { SITE.text = stT.value; }; stT.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) siteWish(!!SITE.plan && !e.shiftKey); }; }
    for (const b of el.querySelectorAll('[data-ssize]')) b.onclick = () => { if (b.dataset.ssize === 'sel') { SITE.useSel = true; } else { SITE.useSel = false; SITE.size = +b.dataset.ssize; } SITE.prepare(SITE.size, SITE.useSel); SITE.plan = null; SITE.placed = null; SITE.status = ''; draw(); run(); };
    for (const b of el.querySelectorAll('[data-schip]')) b.onclick = () => { SITE.text = b.dataset.schip; siteWish(false); };
    const sg = $('#stGo'); if (sg) sg.onclick = () => siteWish(false);
    const se = $('#stEdit'); if (se) se.onclick = () => siteWish(true);
    const sr = $('#stRnd'); if (sr) sr.onclick = () => { SITE.seed = (SITE.seed * 1103515245 + 12345 + Date.now()) >>> 0; const Q = SITE.setPlan(SITE.random(SITE.area, SITE.sv, SITE.seed)); SITE.status = '🎲 ' + L('st.rolled', '{h} Häuser um einen Platz — ✓ Bauen, oder noch einmal würfeln.', { h: Q.houses.length }); siteSave(false); draw(); run(); };
    const sb = $('#stBack'); if (sb) sb.onclick = () => { if (SITE.back()) { SITE.status = '⟲ ' + L('gn.backDone', 'Vorige Version'); siteSave(false); draw(); run(); } };
    const sh = $('#stHere'); if (sh) sh.onclick = () => { SITE.prepare(SITE.size, SITE.useSel); if (SITE.plan) SITE.placed = SITE.layout(SITE.plan, SITE.area, SITE.sv); SITE.status = '📍 ' + L('st.measured', 'Neu ausgemessen.'); draw(); run(); };
    const sB = $('#stBuild'); if (sB) sB.onclick = () => { const n = SITE.commit(); if (n) { siteSave(true); SITE.status = '✓ ' + L('st.built', '{name} gebaut — {n} Blöcke. ⟲ Zurück in der Werkbank nimmt es wieder weg.', { name: esc(SITE.plan.name), n: n.toLocaleString('de-DE') }); close(); WM.tipW('🏘 ' + SITE.plan.name + ' · ' + n.toLocaleString('de-DE') + ' ' + L('im.blocks', 'Blöcke'), true); } };
    // a picture dropped on a slot goes there
    for (const s of el.querySelectorAll('.imSlot')) {
      s.ondragover = (e) => { e.preventDefault(); s.classList.add('drop'); };
      s.ondragleave = () => s.classList.remove('drop');
      s.ondrop = (e) => { e.preventDefault(); e.stopPropagation(); s.classList.remove('drop'); const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) take(f, s.dataset.slot); };
    }
    // the preview turns when you drag it
    const pv = $('#imPrev'); let drag = null;
    pv.onpointerdown = (e) => { if (IM.mode === 'site') return; drag = [e.clientX, e.clientY]; pv.setPointerCapture(e.pointerId); };
    pv.onpointermove = (e) => { if (!drag) return; const cm = camOf(); cm.yaw -= (e.clientX - drag[0]) * 0.01; cm.pitch = Math.max(-0.2, Math.min(1.4, cm.pitch + (e.clientY - drag[1]) * 0.01)); drag = [e.clientX, e.clientY]; shoot(); };
    pv.onpointerup = () => { drag = null; };
    const ok = $('#imOk'); if (ok) ok.onclick = () => { const g = IM.result; if (!g || !g.n || !WM.wb || !WM.world) return; WM.wb.setClip({ sx: g.sx, sy: g.sy, sz: g.sz, blocks: g.blocks.slice(), name: g.name, dy: g.dy || 0 }); close(); if (C.S && C.S.mode !== 'world') C.setMode('world'); if (WM.tab !== 'bench') { WM.tab = 'bench'; WM.refresh(); } WM.wb.setTool('paste'); WM.tipW('✨ ' + g.name + ' — ' + L('im.place', 'zeig auf die Welt und klick · R dreht'), true); };
    for (const b of el.querySelectorAll('[data-exp]')) b.onclick = () => { const g = IM.result; if (!g || !g.n || !WM.wb) return; WM.wb.setClip({ sx: g.sx, sy: g.sy, sz: g.sz, blocks: g.blocks.slice(), name: g.name, dy: g.dy || 0 }); WM.wb.exportClip(b.dataset.exp); };
    const lib = $('#imLib'); if (lib) lib.onclick = () => { const g = IM.result; if (!g || !g.n || !WM.wb) return; WM.wb.setClip({ sx: g.sx, sy: g.sy, sz: g.sz, blocks: g.blocks.slice(), name: g.name, dy: g.dy || 0 }); WM.wb.libAdd(); };
    if (IM.mode === 'site') siteMap();
    else if (IM.result) preview();
  }
  // ---------------------------------------------------------------- ✨ one wish
  // mode 'new': a new design from the words (and the photo); 'edit': the current design changed as the words say;
  // 'house': the 🏠 tab's house changed as its ✨ line says (the answer lands back in the Baukasten);
  // 'photoHouse': the photo once more, as a house
  let tick = 0;
  async function wish(mode) {
    mode = mode || 'new';
    const Gs = IM.genie, G = GN(); if (!G || G.busy()) return;
    const hw = $('#hkWish'); if (hw) IM.hkWish = hw.value;   // (the Genie's words are kept as they are typed)
    const text = mode === 'house' ? IM.hkWish : mode === 'photoHouse' ? '' : Gs.text;
    if (!String(text || '').trim() && !((mode === 'new' || mode === 'photoHouse') && Gs.img)) { Gs.from = mode === 'house' ? 'house' : 'genie'; Gs.status = '✍️ ' + L('gn.needSome', 'Erst ein Foto, eine Skizze oder ein paar Worte.'); draw(); return; }
    const base = mode === 'edit' ? Gs.last : mode === 'house' ? Object.assign({ kind: 'house' }, HK().normalize(IM.house)) : null;
    Gs.from = mode === 'house' ? 'house' : 'genie';
    Gs.status = '✨ ' + (base ? L('gn.changing', 'Ich ändere es …') : L('gn.thinking', 'Einen Moment …'));
    const p = G.ask({ text, image: mode === 'house' ? null : Gs.img, size: Gs.size, base, want: mode === 'photoHouse' ? 'house' : mode === 'new' ? Gs.want : null });
    draw();
    try {
      const r = await p;
      if (Gs.last) { Gs.hist.push(Gs.last); if (Gs.hist.length > 12) Gs.hist.shift(); }
      Gs.last = r; Gs.chips = null; Gs.word = '';
      const said = r.fuzzy ? L('gn.understood', 'Ich habe „{a}“ als „{b}“ verstanden.', { a: esc(r.fuzzy.said), b: esc(r.fuzzy.meant) }) + ' ' : '';
      Gs.status = '✓ ' + said + (base ? L('gn.changed', 'Geändert.') + ' ' : '') + (r.kind === 'house' ? L('gn.house', 'Ein Haus — mit Zimmern, Treppe und Möbeln. Drehen: im Bild ziehen.') : r.photo ? L('gn.photoDone', 'Aus deinem Foto. Schreib dazu, was es ist — dann baue ich es richtig.') : L('gn.model', 'Fertig — drehen: im Bild ziehen.'));
      if (r.kind === 'house') { if (mode !== 'house') { kitFlush(); IM.pj.kit = null; } IM.house = HK().normalize(r.spec); if (mode === 'house') IM.hkWish = ''; }
      else if (mode === 'house') IM.mode = 'genie';   // asked for something that is not a house: show it where models live
      // 🕘: the Baukasten's own wish changes its house; everything else is a Genie project (new, or the one you change)
      if (mode === 'house' && r.kind === 'house') kitChanged(true); else genieSave(mode !== 'edit');
      if (mode !== 'house') { IM.camFront.yaw = 3.75; IM.camFront.pitch = 0.42; }
    } catch (e) {
      const x = G.explain(e);
      Gs.status = (e && e.code === 'cancelled' ? '■ ' : '💡 ') + esc(x.text);
      Gs.chips = x.chips && x.chips.length ? x.chips : null; Gs.chipMode = e && e.code === 'nochange' ? 'edit' : 'new'; Gs.word = x.word || '';
      if (mode === 'house') IM.mode = 'genie';
    } finally { clearInterval(tick); }
    if ($('#imagine') && $('#imagine').classList.contains('on')) { draw(); run(); }
  }
  // ✨ Erschaffen in the top bar: the dialog from any mode (the Genie first)
  document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('[data-create]'); if (!b) return; e.preventDefault(); open(null, IM.opened ? IM.mode : 'genie'); IM.opened = true; });
  // paste a picture into the open dialog
  window.addEventListener('paste', (e) => {
    const el = $('#imagine'); if (!el || !el.classList.contains('on')) return;
    const it = [...((e.clipboardData && e.clipboardData.items) || [])].find(i => /^image\//.test(i.type));
    if (it) { e.preventDefault(); e.stopPropagation(); const f = it.getAsFile(); if (f) take(f, slotFor()); }
  }, true);
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') { const el = $('#imagine'); if (el && el.classList.contains('on') && !$('#imPad') && !(VR.Projects && VR.Projects.isOpen && VR.Projects.isOpen())) { e.stopPropagation(); close(); } } }, true);

  // ---------------------------------------------------------------- ✏️ the drawing pad
  function pad(slot) {
    let el = $('#imPad'); if (el) el.remove();
    el = document.createElement('div'); el.id = 'imPad'; $('#studio').appendChild(el);
    const S = 320, st = { color: '#d94a3a', size: 10, tool: 'pen', mirror: false };
    const PAL = ['#1d1f22', '#ffffff', '#9a9a9a', '#d94a3a', '#e88c2c', '#f2d34a', '#5bb34a', '#2f8f6a', '#3f76e4', '#7a4fd0', '#d0479c', '#8a5a32', '#c9a26b', '#a7d6f0'];
    el.innerHTML = `<div class="padBox"><header><b>✏️ ${L('im.draw', 'Malen')} · ${esc(slot === 'genie' ? L('gn.sketch', 'Skizze für das Genie') : L((SLOTS.find(s => s[0] === slot) || ['', 'im.flat', 'Blockbild'])[1], (SLOTS.find(s => s[0] === slot) || ['', '', 'Bild'])[2]))}</b><button class="x" data-x>✕</button></header>
      <div class="padRow"><div class="padTools"><button data-t="pen" class="on">✏️</button><button data-t="fill">🪣</button><button data-t="erase">🧽</button><button data-m title="${L('im.mirror', 'Spiegeln links/rechts')}">⇋</button><button data-clear>🗑</button></div>
      <canvas width="${S}" height="${S}"></canvas>
      <div class="padPal">${PAL.map(c => `<button style="background:${c}" data-c="${c}"></button>`).join('')}<input type="color" value="${st.color}"><label>${L('im.size', 'Größe')}<input type="range" min="2" max="40" value="${st.size}"></label></div></div>
      <div class="imActs"><button class="cbtn pri" data-ok>✓ ${L('im.use', 'Übernehmen')}</button><span class="dim">${L('im.padHow', 'Malen auf leerem Grund — der leere Teil ist der Hintergrund.')}</span></div></div>`;
    const cv = el.querySelector('canvas'), x = cv.getContext('2d');
    const prev = slotGet(slot); if (prev) x.drawImage(prev, 0, 0, S, S);
    const at = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * S / r.width, (e.clientY - r.top) * S / r.height]; };
    let last = null;
    const line = (a, b) => { x.globalCompositeOperation = st.tool === 'erase' ? 'destination-out' : 'source-over'; x.strokeStyle = st.color; x.lineWidth = st.size; x.lineCap = 'round'; for (const m of st.mirror ? [false, true] : [false]) { x.beginPath(); x.moveTo(m ? S - a[0] : a[0], a[1]); x.lineTo(m ? S - b[0] : b[0], b[1]); x.stroke(); } x.globalCompositeOperation = 'source-over'; };
    const fill = (p) => {
      const id = x.getImageData(0, 0, S, S), d = id.data, i0 = (Math.floor(p[1]) * S + Math.floor(p[0])) * 4, t = [d[i0], d[i0 + 1], d[i0 + 2], d[i0 + 3]];
      const c = st.color.match(/\w\w/g).map(h => parseInt(h, 16)), same = (i) => Math.abs(d[i] - t[0]) + Math.abs(d[i + 1] - t[1]) + Math.abs(d[i + 2] - t[2]) + Math.abs(d[i + 3] - t[3]) < 24;
      if (same(i0) && d[i0] === c[0] && d[i0 + 1] === c[1] && d[i0 + 2] === c[2] && d[i0 + 3] === 255) return;
      const q = [i0 / 4]; const seen = new Uint8Array(S * S); seen[i0 / 4] = 1;
      while (q.length) { const k = q.pop(), i = k * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255; const px = k % S, py = (k / S) | 0; for (const n of [px > 0 ? k - 1 : -1, px < S - 1 ? k + 1 : -1, py > 0 ? k - S : -1, py < S - 1 ? k + S : -1]) if (n >= 0 && !seen[n] && same(n * 4)) { seen[n] = 1; q.push(n); } }
      x.putImageData(id, 0, 0);
    };
    cv.onpointerdown = (e) => { cv.setPointerCapture(e.pointerId); const p = at(e); if (st.tool === 'fill') { fill(p); return; } last = p; line(p, [p[0] + 0.01, p[1]]); };
    cv.onpointermove = (e) => { if (!last) return; const p = at(e); line(last, p); last = p; };
    cv.onpointerup = () => { last = null; };
    for (const b of el.querySelectorAll('[data-t]')) b.onclick = () => { st.tool = b.dataset.t; for (const o of el.querySelectorAll('[data-t]')) o.classList.toggle('on', o === b); };
    el.querySelector('[data-m]').onclick = (e) => { st.mirror = !st.mirror; e.target.classList.toggle('on', st.mirror); };
    el.querySelector('[data-clear]').onclick = () => x.clearRect(0, 0, S, S);
    for (const b of el.querySelectorAll('[data-c]')) b.onclick = () => { st.color = b.dataset.c; el.querySelector('input[type=color]').value = st.color; if (st.tool === 'erase') st.tool = 'pen'; };
    el.querySelector('input[type=color]').oninput = (e) => { st.color = e.target.value; };
    el.querySelector('input[type=range]').oninput = (e) => { st.size = +e.target.value; };
    const done = () => el.remove();
    el.querySelector('[data-x]').onclick = done;
    el.querySelector('[data-ok]').onclick = () => { const out = document.createElement('canvas'); out.width = S; out.height = S; out.getContext('2d').drawImage(cv, 0, 0); slotSet(slot, out); done(); draw(); if (slot !== 'genie') run(); };
  }
  // ---------------------------------------------------------------- 🕘 Weitermachen: Baukasten houses, Genie designs and planned places are projects
  // A Baukasten house becomes a project with its first change; 🎲 on a house you shaped by hand starts a new one (yours
  // stays), 🎲 again only rolls that new one. Every new Genie design is a project, "✏️ Ändern" and ⟲ change it. Every
  // plan for a place is one (per world and spot), ✓ Bauen marks it built.
  let kitT = 0;
  function kitChanged(manual) {
    const P = VR.Projects; if (!P || !IM.house) return;
    const cur = IM.pj.kit && P.get(IM.pj.kit);
    if (!cur || (manual === false && (cur.manual || IM.kitManual))) {
      kitFlush();
      // a new house gets a name of its own in the list ("Landhaus 2")
      const taken = new Set(P.list().filter(x => x.p.kind === 'kit').map(x => x.p.name));
      if (taken.has(IM.house.name)) { const base = IM.house.name.replace(/ \d+$/, ''); let k = 2; while (taken.has(base + ' ' + k)) k++; IM.house.name = (base + ' ' + k).slice(0, 40); const nm = $('#imagine .hkName'); if (nm) nm.value = IM.house.name; }
      IM.pj.kit = P.newId('k'); IM.kitManual = !!manual;
      P.put(IM.pj.kit, { kind: 'kit', name: IM.house.name, manual: IM.kitManual });
    } else if (manual) IM.kitManual = true;
    IM.pjShot = IM.pj.kit;
    clearTimeout(kitT); kitT = setTimeout(kitSave, 600);
  }
  function kitSave() {
    clearTimeout(kitT); kitT = 0;
    const P = VR.Projects, H = IM.house; if (!P || !H || !IM.pj.kit) return;
    P.put(IM.pj.kit, { kind: 'kit', name: H.name, manual: !!IM.kitManual, info: { floors: H.floors, w: H.width, d: H.depth, style: H.style } });
    P.setData(IM.pj.kit, { v: 1, spec: H, wish: IM.hkWish || '' });
  }
  function kitFlush() { if (kitT) kitSave(); }
  function genieSave(fresh) {
    const P = VR.Projects, Gs = IM.genie, z = Gs.last; if (!P || !z) return;
    if (fresh || !IM.pj.genie || !P.get(IM.pj.genie)) IM.pj.genie = P.newId('g');
    P.put(IM.pj.genie, { kind: 'genie', name: z.name || L('gn.tab', 'Genie'), info: { kind: z.kind } });
    P.setData(IM.pj.genie, { v: 1, last: z, hist: Gs.hist.slice(-6), text: Gs.text || '', size: Gs.size });
    IM.pjShot = IM.pj.genie;
  }
  function siteSave(built) {
    const P = VR.Projects, SITE = WM.site; if (!P || !SITE || !SITE.plan || !SITE.area || !WM.world) return;
    const A = SITE.area, cur = IM.pj.site && P.get(IM.pj.site), ca = cur && cur.ref && cur.ref.area;
    const same = ca && cur.ref.world === WM.world.id && ca.x0 === A.x0 && ca.z0 === A.z0 && ca.w === A.w && ca.d === A.d;
    if (!same) IM.pj.site = P.newId('s');
    P.put(IM.pj.site, { kind: 'site', name: SITE.plan.name || L('st.tab', 'Ort'), ref: { world: WM.world.id, worldName: WM.world.name || '', area: { x0: A.x0, z0: A.z0, w: A.w, d: A.d } }, built: !!built, info: { houses: SITE.placed ? SITE.placed.houses.length : 0 } });
    P.setData(IM.pj.site, { v: 1, text: SITE.text || '', size: SITE.size, plan: SITE.plan, hist: SITE.hist.slice(-4) });
    // its picture: the map
    const cv = $('#imPrev'); if (cv && IM.mode === 'site' && $('#imagine') && $('#imagine').classList.contains('on')) { siteMap(); P.thumb(IM.pj.site, cv, 'contain'); }
  }
  // the first time the dialog opens: the Baukasten house and the Genie design you worked on last are there again
  function restoreLast() {
    const P = VR.Projects; if (!P) return;
    let all = []; try { all = P.list(); } catch (e) { return; }
    if (!IM.house) { const k = all.find(x => x.p.kind === 'kit' && !x.p.done), d = k && P.data(k.p.id); if (d && d.spec) { IM.house = HK().normalize(d.spec); IM.hkWish = d.wish || ''; IM.pj.kit = k.p.id; IM.kitManual = !!k.p.manual; } }
    if (!IM.genie.last) { const g = all.find(x => x.p.kind === 'genie' && !x.p.done), d = g && P.data(g.p.id); if (d && d.last) { Object.assign(IM.genie, { last: d.last, hist: Array.isArray(d.hist) ? d.hist : [], text: d.text || '', size: d.size || 32 }); IM.pj.genie = g.p.id; } }
  }
  const isOn = () => { const el = $('#imagine'); return !!(el && el.classList.contains('on')); };
  if (VR.Projects) {
    const P = VR.Projects;
    P.kind('kit', {
      icon: '🏡', label: L('pj.k.kit', 'Baukasten'),
      state(p) { const i = p.info || {}; return { live: true, status: '', sub: [i.floors ? i.floors + ' ' + L('hk.floorsN', 'Etagen') : '', i.w && i.d ? i.w + ' × ' + i.d : ''].filter(Boolean).join(' · ') }; },
      open(p) {
        const d = P.data(p.id); if (!d || !d.spec) { C.sys(L('pj.gone', '„{n}“ ist nicht mehr da', { n: P.nameOf(p) }), 'err'); return; }
        kitFlush(); if (!IM.restored) { IM.restored = true; restoreLast(); } IM.opened = true;
        IM.house = HK().normalize(d.spec); IM.hkWish = d.wish || ''; IM.pj.kit = p.id; IM.kitManual = !!p.manual;
        open(null, 'house');
      },
      rename(p, name) {
        if (!name) return; name = name.slice(0, 40);
        const d = P.data(p.id); if (d && d.spec) { d.spec.name = name; P.setData(p.id, d); }
        p.name = name; p.label = '';
        if (IM.pj.kit === p.id && IM.house) { IM.house.name = name; if (isOn() && IM.mode === 'house') { draw(); run(); } }
      },
      discard(p) { if (IM.pj.kit === p.id) { clearTimeout(kitT); kitT = 0; IM.pj.kit = null; } P.remove(p.id); },
    });
    P.kind('genie', {
      icon: '✨', label: L('pj.k.genie', 'Genie'),
      state(p) { return { live: true, status: '', sub: p.info && p.info.kind === 'house' ? L('pj.genieHouse', 'Haus') : L('pj.genieModel', 'Modell') }; },
      open(p) {
        const d = P.data(p.id); if (!d || !d.last) { C.sys(L('pj.gone', '„{n}“ ist nicht mehr da', { n: P.nameOf(p) }), 'err'); return; }
        kitFlush(); if (!IM.restored) { IM.restored = true; restoreLast(); } IM.opened = true;
        Object.assign(IM.genie, { last: d.last, hist: Array.isArray(d.hist) ? d.hist : [], text: d.text || '', size: d.size || 32, status: '', img: null, chips: null, word: '' });
        if (d.last.kind === 'house') { IM.house = HK().normalize(d.last.spec); IM.pj.kit = null; }
        IM.pj.genie = p.id;
        open(null, 'genie');
      },
      rename(p, name) {
        if (!name) return; name = name.slice(0, 40);
        const d = P.data(p.id); if (d && d.last) { d.last.name = name; P.setData(p.id, d); }
        p.name = name; p.label = '';
        if (IM.pj.genie === p.id && IM.genie.last) { IM.genie.last.name = name; if (isOn() && IM.mode === 'genie') draw(); }
      },
      discard(p) { if (IM.pj.genie === p.id) IM.pj.genie = null; P.remove(p.id); },
    });
    P.kind('site', {
      icon: '🏘', label: L('pj.k.site', 'Ort'),
      state(p) { const i = p.info || {}; return { live: !!(p.ref && p.ref.world), status: p.built ? 'built' : 'plan', sub: [i.houses ? i.houses + ' ' + L('st.houses', 'Häuser') : '', p.ref && p.ref.worldName ? '🌍 ' + p.ref.worldName : ''].filter(Boolean).join(' · ') }; },
      async open(p) {
        const d = P.data(p.id); if (!d || !d.plan || !WM.openId) { C.sys(L('pj.gone', '„{n}“ ist nicht mehr da', { n: P.nameOf(p) }), 'err'); return; }
        const w = await WM.openId(p.ref.world);
        if (!w) { C.sys(L('pj.noWorld', 'Die Welt „{n}“ gibt es hier nicht', { n: p.ref.worldName || '?' }), 'err'); return; }
        const SITE = WM.site, box = WM.regionBox(), A = p.ref.area;
        const inside = !!(A && box && A.x0 >= box[0] && A.z0 >= box[2] && A.x0 + A.w <= box[3] && A.z0 + A.d <= box[5]);
        Object.assign(SITE, { world: WM.world, size: d.size || 64, useSel: false, text: d.text || '', hist: Array.isArray(d.hist) ? d.hist : [], plan: null, placed: null });
        if (inside) { SITE.area = { x0: A.x0, z0: A.z0, w: A.w, d: A.d }; SITE.sv = SITE.survey(SITE.area); } else SITE.prepare(SITE.size, false);
        if (!SITE.area) return;
        SITE.plan = d.plan; SITE.placed = SITE.layout(d.plan, SITE.area, SITE.sv);
        SITE.status = p.built ? '✓ ' + L('pj.siteBuilt', 'Gebaut.') : inside ? '' : '📍 ' + L('pj.siteMoved', 'Die Gegend um dich ist jetzt eine andere — neu ausgemessen, wo die Kamera hinschaut.');
        // the camera looks at the place
        const sc = C.S.scene;
        if (sc && sc.type === 'world') { const cx = SITE.area.x0 + SITE.area.w / 2, cz = SITE.area.z0 + SITE.area.d / 2, gy = WM.groundAt(Math.floor(cx), Math.floor(cz)); sc.center = [cx, gy || sc.center[1], cz]; C.S.cam.dist = Math.max(40, SITE.area.w * 1.3); C.S.cam.pitch = 0.95; }
        if (!IM.restored) { IM.restored = true; restoreLast(); }
        IM.pj.site = p.id; IM.opened = true;
        open(null, 'site');
      },
      rename(p, name) {
        if (!name) return; name = name.slice(0, 60);
        const d = P.data(p.id); if (d && d.plan) { d.plan.name = name; P.setData(p.id, d); }
        p.name = name; p.label = '';
        const SITE = WM.site; if (IM.pj.site === p.id && SITE && SITE.plan) { SITE.plan.name = name; if (isOn() && IM.mode === 'site') draw(); }
      },
      discard(p) { if (IM.pj.site === p.id) IM.pj.site = null; P.remove(p.id); },
    });
    P.onFlush(() => kitFlush());
  }
  Object.assign(IM, { open, close, take, run, buildFlat, buildSolid, wish, kitSave, kitChanged });
})();
