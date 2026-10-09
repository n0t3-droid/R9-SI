// ============================================================================
// R9 Studio · ✦ Formen — shape tools for the Crafter (t-form; the owner: „Nutze oder implementiere alle nötigen Tools, die
// du im Editor benötigst, um Shape und Form trotz Voxel verändern, manipulieren und meinen Wünschen entsprechend ändern
// und verbessern zu können")
//   Drehkörper   a profile of 6–12 points dragged in a side panel, revolved round the model's vertical axis (a vase, a
//                lamp foot, a column) — solid, or a shell with a wall
//   Extrusion    a path clicked into the top view, swept with a round or a square section of a chosen width (pipes,
//                rails, curved light lines, handrails)
//   Abrunden     a bevel of radius 1–4 voxels on the convex edges inside the selection (two corners clicked on the model;
//                none: the whole model). In every plane the convex corners are cut to a quarter circle; the radius is at
//                most half the local thickness, so a thin part keeps its shape
//   Kugel · Zylinder · Kegel   with a radius in quarter voxels, placed on the clicked face
// Every tool writes through the Crafter's vApply: one undo step, the design stays voxel (the smooth surface is a look).
// ✦ Glatt — a model's surface-nets surface (src/shared/smoothvox.js, made in the Studio's worker): on every model card and
// in the 3-D view (Möbel, Fassade and the Crafter, where it follows every edit); per model, remembered in this browser.
// The voxel functions (FT.ops) need no page: test/formtools.js runs them in node.
// ============================================================================
(function () {
  'use strict';
  const VRx = typeof VR !== 'undefined' ? VR : (typeof self !== 'undefined' ? self.VR : null);
  if (!VRx) return;
  const FT = VRx.FormTools = VRx.FormTools || {};

  // ================================================================ the voxel functions: lists of [x, y, z, value]
  const ops = FT.ops = {};
  // inside a polygon [[a, b], …] (even-odd)
  const inPoly = ops.inPoly = (P, a, b) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const ai = P[i][0], bi = P[i][1], aj = P[j][0], bj = P[j][1]; if ((bi > b) !== (bj > b) && a < (aj - ai) * (b - bi) / (bj - bi) + ai) c = !c; } return c; };
  // Drehkörper: profile [[r, y], …] in voxels (r from the axis, y from the floor), closed along the axis, revolved round
  // the vertical through o.axis ([x, z], default the footprint's centre); o.wall > 0: a shell that thick, its floor closed
  ops.lathe = function (dims, profile, v, o) {
    o = o || {};
    const out = []; if (!profile || profile.length < 2) return out;
    const cx = o.axis ? o.axis[0] : dims.VW / 2, cz = o.axis ? o.axis[1] : dims.VD / 2;
    const P = [[0, profile[0][1]]].concat(profile.map(p => [Math.max(0, p[0]), p[1]]), [[0, profile[profile.length - 1][1]]]);
    let y0 = Infinity, y1 = -Infinity, rm = 0; for (const [r, y] of P) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); rm = Math.max(rm, r); }
    const wall = o.wall || 0;
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(dims.VH, Math.ceil(y1)); y++) {
      const yc = y + 0.5;
      for (let z = Math.max(0, Math.floor(cz - rm - 1)); z < Math.min(dims.VD, Math.ceil(cz + rm + 1)); z++) for (let x = Math.max(0, Math.floor(cx - rm - 1)); x < Math.min(dims.VW, Math.ceil(cx + rm + 1)); x++) {
        const r = Math.hypot(x + 0.5 - cx, z + 0.5 - cz);
        if (!inPoly(P, r, yc)) continue;
        if (wall > 0 && yc > y0 + wall && inPoly(P, r + wall, yc)) continue;   // deep inside: the hollow
        out.push([x, y, z, v]);
      }
    }
    return out;
  };
  // the signed distance of (x, y) ≥ 0 to a rounded rectangle of half sizes hx, hy and corner radius r
  const rrSdf = (x, y, hx, hy, r) => { const qx = x - hx + r, qy = y - hy + r; return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r; };
  // Extrusion entlang Pfad: path [[x, y, z], …] in voxels, section { shape: 'circle' | 'box', w (width), h (the box's
  // height), round (the box's corner radius) }. A round section is a chain of capsules (round ends and joints); a square
  // one runs flat across its ends and overlaps itself half a width at every joint
  ops.extrude = function (dims, path, sec, v) {
    const out = []; if (!path || path.length < 2) return out;
    const VW = dims.VW, VH = dims.VH, VD = dims.VD, seen = new Uint8Array(VW * VH * VD);
    const box = sec.shape === 'box', w2 = sec.w / 2, h2 = (box ? (sec.h || sec.w) : sec.w) / 2, rr = Math.max(0, Math.min(sec.round === undefined ? 1 : sec.round, w2, h2)), ext = Math.max(w2, h2) + 1;
    for (let i = 0; i + 1 < path.length; i++) {
      const a = path[i], b = path[i + 1], tx = b[0] - a[0], ty = b[1] - a[1], tz = b[2] - a[2], L = Math.hypot(tx, ty, tz);
      if (L < 1e-6) continue;
      const ux = tx / L, uy = ty / L, uz = tz / L;
      // the section's frame: s across (level), q up (s × t)
      let sx = -uz, sz = ux; const sl = Math.hypot(sx, sz); if (sl < 1e-6) { sx = 1; sz = 0; } else { sx /= sl; sz /= sl; }
      const qx = 0 * uz - sz * uy, qy = sz * ux - sx * uz, qz = sx * uy - 0 * ux;
      const e0 = i > 0 ? w2 : 0, e1 = i + 2 < path.length ? w2 : 0;
      const bx0 = Math.max(0, Math.floor(Math.min(a[0], b[0]) - ext)), bx1 = Math.min(VW - 1, Math.ceil(Math.max(a[0], b[0]) + ext));
      const by0 = Math.max(0, Math.floor(Math.min(a[1], b[1]) - ext)), by1 = Math.min(VH - 1, Math.ceil(Math.max(a[1], b[1]) + ext));
      const bz0 = Math.max(0, Math.floor(Math.min(a[2], b[2]) - ext)), bz1 = Math.min(VD - 1, Math.ceil(Math.max(a[2], b[2]) + ext));
      for (let y = by0; y <= by1; y++) for (let z = bz0; z <= bz1; z++) for (let x = bx0; x <= bx1; x++) {
        const i3 = (y * VD + z) * VW + x; if (seen[i3]) continue;
        const dx = x + 0.5 - a[0], dy = y + 0.5 - a[1], dz = z + 0.5 - a[2], pr = dx * ux + dy * uy + dz * uz;
        let inside;
        if (!box) { const c = Math.max(0, Math.min(L, pr)), ox = dx - c * ux, oy = dy - c * uy, oz = dz - c * uz; inside = ox * ox + oy * oy + oz * oz <= w2 * w2; }
        else {
          if (pr < -e0 || pr > L + e1) continue;
          const ox = dx - pr * ux, oy = dy - pr * uy, oz = dz - pr * uz;
          inside = rrSdf(Math.abs(ox * sx + oz * sz), Math.abs(ox * qx + oy * qy + oz * qz), w2, h2, rr) <= 0;
        }
        if (inside) { seen[i3] = 1; out.push([x, y, z, v]); }
      }
    }
    return out;
  };
  // Abrunden: the voxels to take away ([x, y, z, 0]) inside box [x0, y0, z0, x1, y1, z1] (inclusive). For a voxel and each
  // plane (xy, xz, yz) and each of its four diagonal directions: the runs of matter from the voxel to the surface along
  // both axes; when both end within the radius, the voxel sits in a convex corner of that plane and goes when its centre
  // lies outside the quarter circle. The radius is at most half the local thickness along both axes (a 2-voxel plate keeps
  // its edges: radius 1 takes no whole voxel). V: the volume (0 = empty), dims { VW, VH, VD }
  ops.bevel = function (V, dims, box, r) {
    const VW = dims.VW, VH = dims.VH, VD = dims.VD, out = [];
    const at = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < VW && y < VH && z < VD && V[(y * VD + z) * VW + x] !== 0;
    const run = (x, y, z, dx, dy, dz) => { let n = 0; while (n < 256 && at(x, y, z)) { n++; x += dx; y += dy; z += dz; } return n; };
    const AX = [[1, 0, 0], [0, 1, 0], [0, 0, 1]], PAIRS = [[0, 1], [0, 2], [1, 2]];
    const x0 = Math.max(0, box[0]), y0 = Math.max(0, box[1]), z0 = Math.max(0, box[2]), x1 = Math.min(VW - 1, box[3]), y1 = Math.min(VH - 1, box[4]), z1 = Math.min(VD - 1, box[5]);
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      if (!at(x, y, z)) continue;
      let cut = false;
      for (let p = 0; p < 3 && !cut; p++) {
        const A = AX[PAIRS[p][0]], B = AX[PAIRS[p][1]];
        const ap = run(x, y, z, A[0], A[1], A[2]), am = run(x, y, z, -A[0], -A[1], -A[2]), bp = run(x, y, z, B[0], B[1], B[2]), bm = run(x, y, z, -B[0], -B[1], -B[2]);
        const re = Math.min(r, (ap + am - 1) / 2, (bp + bm - 1) / 2);
        if (re <= 0) continue;
        for (const da of [ap - 0.5, am - 0.5]) { for (const db of [bp - 0.5, bm - 0.5]) { if (da < re && db < re && (re - da) * (re - da) + (re - db) * (re - db) > re * re) { cut = true; break; } } if (cut) break; }
      }
      if (cut) out.push([x, y, z, 0]);
    }
    return out;
  };
  // Kugel · Zylinder · Kegel: the centre (Kugel) or the middle of the base (Zylinder, Kegel; they stand up along +y) in
  // voxels, a radius in any fraction of a voxel; a voxel is set when its centre lies inside
  const prim = (dims, test, x0, x1, y0, y1, z0, z1, v) => {
    const out = [];
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(dims.VH - 1, Math.ceil(y1)); y++) for (let z = Math.max(0, Math.floor(z0)); z <= Math.min(dims.VD - 1, Math.ceil(z1)); z++) for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(dims.VW - 1, Math.ceil(x1)); x++) if (test(x + 0.5, y + 0.5, z + 0.5)) out.push([x, y, z, v]);
    return out;
  };
  ops.sphere = (dims, c, r, v) => prim(dims, (x, y, z) => (x - c[0]) ** 2 + (y - c[1]) ** 2 + (z - c[2]) ** 2 <= r * r, c[0] - r, c[0] + r, c[1] - r, c[1] + r, c[2] - r, c[2] + r, v);
  ops.cylinder = (dims, c, r, h, v) => prim(dims, (x, y, z) => y >= c[1] && y < c[1] + h && (x - c[0]) ** 2 + (z - c[2]) ** 2 <= r * r, c[0] - r, c[0] + r, c[1], c[1] + h, c[2] - r, c[2] + r, v);
  ops.cone = (dims, c, r, h, v) => prim(dims, (x, y, z) => { if (y < c[1] || y >= c[1] + h) return false; const rr = r * (1 - (y - c[1]) / h); return (x - c[0]) ** 2 + (z - c[2]) ** 2 <= rr * rr; }, c[0] - r, c[0] + r, c[1], c[1] + h, c[2] - r, c[2] + r, v);
  // the default profiles: a vase (eight points) — r, y as fractions of the model's half width and height
  FT.VASE = [[0.42, 0], [0.5, 0.06], [0.72, 0.3], [0.8, 0.46], [0.62, 0.68], [0.36, 0.82], [0.34, 0.92], [0.46, 1]];

  // ================================================================ the Studio
  if (typeof window === 'undefined' || !window.__studioCore) return;
  const C = window.__studioCore, { S, HOOK, $, $$ } = C, VM = VRx.VM, SV = VRx.SmoothVox;
  const TX = (k, v, de, en) => (VRx.I18N && VRx.I18N.tx ? VRx.I18N.tx(k, v, de, en) : String(de).replace(/\{(\w+)\}/g, (m, x) => (v && v[x] !== undefined ? v[x] : m)));
  const CR = () => VRx.Crafter;

  // ---------------------------------------------------------------- ✦ Glatt: per model, remembered in this browser
  const GKEY = 'r9si.studio.glatt';
  let glatt = new Set();
  try { glatt = new Set(JSON.parse(localStorage.getItem(GKEY) || '[]')); } catch (e) { glatt = new Set(); }
  const saveG = () => { try { localStorage.setItem(GKEY, JSON.stringify([...glatt])); } catch (e) { /* only this session */ } };
  FT.isGlatt = (name) => glatt.has(name);
  FT.setGlatt = function (name, on) {
    if (on) glatt.add(name); else glatt.delete(name);
    saveG();
    for (const b of $$('.glattb[data-g="' + name + '"]')) { b.classList.toggle('on', !!on); }
    for (const c of $$('#list .card')) { const id = c.dataset.name || c.dataset.bid || c.dataset.fid; if (id === name) FT.cardThumb(c, name); }
    viewButton();
  };
  // the worker's surface-nets mesh in the Studio's layout: a model by name (its saved design), or a volume (the Crafter's
  // edit); the facing turns it like the view's voxel mesh (VM.footprint's quarter turns)
  let wq = Promise.resolve();
  function smoothOf(src) {
    const msg = src.name && !src.vol ? { type: 'smoothvox', name: src.name, layout: 'studio', ver: src.ver | 0 } : { type: 'smoothvox', layout: 'studio', vol: src.vol, pal: src.pal, VW: src.VW, VH: src.VH, VD: src.VD, res: src.res };
    const p = wq.then(() => C.call(msg)); wq = p.catch(() => null);
    return p.then((m) => (m && m.type === 'smoothvox' && m.verts ? { verts: m.verts, glass: m.glass, tri: m.tri, quads: m.quads, smooth: true } : null));
  }
  FT.turn = function (mesh, W, D, q) {
    q = ((q % 4) + 4) % 4; if (!q) return mesh;
    const out = { verts: mesh.verts.slice(), glass: mesh.glass.slice(), tri: mesh.tri, quads: mesh.quads, smooth: true };
    for (const a of [out.verts, out.glass]) for (let o = 0; o < a.length; o += 15) {
      let x = a[o], z = a[o + 2], nx = a[o + 3], nz = a[o + 5], w = W, d = D;
      for (let r = 0; r < q; r++) { const t = x; x = d - z; z = t; const tn = nx; nx = -nz; nz = tn; const tw = w; w = d; d = tw; }
      a[o] = x; a[o + 2] = z; a[o + 3] = nx; a[o + 5] = nz;
    }
    return out;
  };
  // a card's picture: the smooth render when ✦ is on, the voxel one when it is off
  FT.cardThumb = function (card, name) {
    const m = VM.MODELS[name]; if (!m || !card) return;
    const swap = (cv) => { const old = card.querySelector('canvas.th, div.th'); if (!old) return; cv.className = 'th'; old.replaceWith(cv); };
    if (!glatt.has(name)) { const th = C.THUMB.get(name) || (C.thumbOf && C.thumbOf(name)); if (th) { const cc = th.cloneNode(true); cc.getContext('2d').drawImage(th, 0, 0); swap(cc); } card.classList.remove('glatt'); return; }
    card.classList.add('glatt');
    smoothOf({ name }).then((mesh) => {
      if (!mesh || !glatt.has(name)) return;
      const sz = [m.W, m.H, m.D], sc = { type: 'model', name, model: m, mesh, center: [sz[0] / 2, sz[1] / 2, sz[2] / 2], span: Math.max(sz[0], sz[1], sz[2]), size: sz };
      C.uploadVM(mesh);
      const cv = C.renderThumb(sc, 192, 144, { yaw: 2.42, pitch: 0.4, dist: (sc.span * 2.4 + 2.2) * 0.62 });
      if (S.scene && S.scene.mesh) C.uploadVM(S.scene.mesh);   // the view's buffers back
      swap(cv);
    });
  };
  // the ✦ on a card (a click toggles the look; it does not select the card)
  FT.glattButton = function (name, card) {
    const b = document.createElement('button'); b.className = 'glattb' + (glatt.has(name) ? ' on' : ''); b.dataset.g = name; b.textContent = '✦';
    b.title = TX('ft.glatt.tip', null, 'Glatt: die runde Oberfläche zeigen — nur ein Look, das Design bleibt Voxel', 'Smooth: show the round surface — a look only, the design stays voxels');
    b.onclick = (e) => { e.stopPropagation(); FT.setGlatt(name, !glatt.has(name)); };
    if (card && glatt.has(name)) setTimeout(() => FT.cardThumb(card, name), 0);
    return b;
  };
  // ✦ Glatt in the 3-D view's tool bar (a model or the Crafter's item)
  const sceneModel = () => { const sc = S.scene; return sc && (sc.type === 'model' || sc.type === 'vedit') ? sc.name : null; };
  function viewButton() {
    const vt = $('#viewTools'); if (!vt) return;
    let g = $('#glattView');
    if (!g) {
      g = document.createElement('div'); g.className = 'grp'; g.id = 'glattView';
      const b = document.createElement('button'); b.id = 'glattT'; b.textContent = '✦ ' + TX('ft.glatt', null, 'Glatt', 'Smooth');
      b.title = TX('ft.glatt.tip', null, 'Glatt: die runde Oberfläche zeigen — nur ein Look, das Design bleibt Voxel', 'Smooth: show the round surface — a look only, the design stays voxels');
      b.onclick = () => { const n = sceneModel(); if (n) FT.setGlatt(n, !glatt.has(n)); };
      g.appendChild(b); vt.insertBefore(g, vt.firstChild);
    }
    const n = sceneModel();
    g.style.display = n ? '' : 'none';
    $('#glattT').classList.toggle('on', !!(n && glatt.has(n)));
  }
  // the view follows: a model (or the Crafter's item, after every edit) with ✦ on shows its smooth mesh; the voxel mesh
  // stays at hand for ✦ off. One worker job at a time; an edit while one runs asks again for the newest scene
  let busy = null, lastScene = null;
  function tickGlatt() {
    const sc = S.scene;
    if (sc !== lastScene) { lastScene = sc; viewButton(); }
    if (!sc || (sc.type !== 'model' && sc.type !== 'vedit') || !sc.mesh) return;
    const on = glatt.has(sc.name);
    if (!on) { if (sc.mesh.smooth && sc.voxMesh) { sc.mesh = sc.voxMesh; C.uploadVM(sc.mesh); } return; }
    if (sc.mesh.smooth) return;
    if (sc.smoothMesh) { sc.voxMesh = sc.mesh; sc.mesh = sc.smoothMesh; C.uploadVM(sc.mesh); return; }
    if (busy) return;
    const m = sc.model, src = sc.type === 'vedit' ? { vol: m.vol, pal: m.pal, VW: m.VW, VH: m.VH, VD: m.VD, res: m.res } : { name: sc.name };
    busy = sc;
    smoothOf(src).then((mesh) => {
      busy = null;
      if (!mesh) return;
      const q = sc.type === 'model' ? S.facing | 0 : 0;
      sc.smoothMesh = FT.turn(mesh, m.W, m.D, q);
      if (S.scene === sc && glatt.has(sc.name) && !sc.mesh.smooth) { sc.voxMesh = sc.mesh; sc.mesh = sc.smoothMesh; C.uploadVM(sc.mesh); }
    }).catch(() => { busy = null; });
  }
  const prevTick = HOOK.tick;
  HOOK.tick = function () { const r = prevTick ? prevTick() : false; try { tickGlatt(); } catch (e) { /* a look never stops the Studio */ } return r; };
  FT.smoothOf = smoothOf;

  // ---------------------------------------------------------------- ✦ Formen in the Crafter's item panel
  const TOOLS = [['lathe', '⟲', 'ft.lathe', 'Drehkörper', 'Lathe'], ['extrude', '〰', 'ft.extrude', 'Extrusion', 'Extrusion'], ['bevel', '◠', 'ft.bevel', 'Abrunden', 'Round off'],
    ['sphere', '●', 'ft.sphere', 'Kugel', 'Sphere'], ['cylinder', '▮', 'ft.cylinder', 'Zylinder', 'Cylinder'], ['cone', '▲', 'ft.cone', 'Kegel', 'Cone']];
  const ST = FT.state = { tool: null, profile: null, path: [], shape: 'circle', w: 4, h: 4, level: null, wall: 0, r: 2, pr: 3, ph: 8, sel: null, selA: null, item: null };
  const it = () => CR() && CR().item;
  const curVoxel = () => { const i = it(), c = parseInt(i.color.slice(1), 16); return (VM.M[i.mat] || VM.M.matte)(c) >>> 0; };
  const dims = () => { const i = it(); return { VW: i.VW, VH: i.VH, VD: i.VD }; };
  // a new item: its own profile, path and selection
  function fresh() {
    const i = it(); if (!i || ST.item === i.name) return;
    ST.item = i.name; ST.path = []; ST.sel = null; ST.selA = null; ST.level = Math.round(i.VH / 2);
    const R = Math.min(i.VW, i.VD) / 2, H = i.VH;
    ST.profile = FT.VASE.map(([r, y]) => [Math.round(r * R * 0.9 * 4) / 4, Math.round(y * H * 4) / 4]);
    ST.w = Math.max(2, Math.round(i.res / 8)); ST.h = ST.w; ST.pr = Math.max(1.5, i.res / 8); ST.ph = Math.round(i.res / 3);
  }
  function apply(list, what) {
    const C2 = CR(); if (!C2 || !it()) return 0;
    if (!list.length) { C2.tip(TX('ft.none', null, 'Hier gibt es nichts zu formen', 'Nothing to shape here'), false); return 0; }
    C2.vApply(list);
    C2.tip(TX('ft.done', { n: list.length, what }, '{what}: {n} Voxel geformt — Strg+Z nimmt es zurück', '{what}: {n} voxels shaped — Ctrl+Z takes it back'), true);
    return list.length;
  }
  FT.applyTool = function (tool, arg) {
    fresh(); const i = it(); if (!i) return 0;
    const D = dims(), v = curVoxel(), name = (TOOLS.find(t => t[0] === tool) || [])[3] || tool;
    if (tool === 'lathe') return apply(ops.lathe(D, ST.profile, v, { wall: ST.wall }), name);
    if (tool === 'extrude') return apply(ops.extrude(D, ST.path.map(p => [p[0], ST.level + 0.5, p[1]]), { shape: ST.shape, w: ST.w, h: ST.h }, v), name);
    if (tool === 'bevel') { const b = ST.sel || [0, 0, 0, i.VW - 1, i.VH - 1, i.VD - 1]; return apply(ops.bevel(i.V, D, b, ST.r), name); }
    if (tool === 'sphere' || tool === 'cylinder' || tool === 'cone') {
      const c = arg; if (!c) return 0;
      return apply(tool === 'sphere' ? ops.sphere(D, [c[0] + 0.5, c[1] + 0.5, c[2] + 0.5], ST.pr, v) : ops[tool](D, [c[0] + 0.5, c[1], c[2] + 0.5], ST.pr, ST.ph, v), name);
    }
    return 0;
  };
  // a click on the model (crafter.js voxelClick asks first): the selection's corners, the place of a sphere, cylinder, cone
  const FDX = [1, -1, 0, 0, 0, 0], FDY = [0, 0, 1, -1, 0, 0], FDZ = [0, 0, 0, 0, 1, -1];
  FT.click = function (hv, button) {
    if (!ST.tool || !it() || button === 1) return false;
    if (ST.tool === 'bevel') {
      const c = [hv.x, hv.y, hv.z];
      if (!ST.selA || ST.sel) { ST.selA = c; ST.sel = null; CR().tip(TX('ft.sel.b', null, 'Ecke 1 — jetzt die zweite Ecke', 'Corner 1 — now the second corner'), true); }
      else { const a = ST.selA; ST.sel = [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.min(a[2], c[2]), Math.max(a[0], c[0]), Math.max(a[1], c[1]), Math.max(a[2], c[2])]; ST.selA = null; CR().tip(TX('ft.sel.ok', { n: (ST.sel[3] - ST.sel[0] + 1) + ' × ' + (ST.sel[4] - ST.sel[1] + 1) + ' × ' + (ST.sel[5] - ST.sel[2] + 1) }, 'Auswahl {n} Voxel', 'Selection {n} voxels'), true); }
      C.list(); return true;
    }
    if (ST.tool === 'sphere' || ST.tool === 'cylinder' || ST.tool === 'cone') { FT.applyTool(ST.tool, [hv.x + FDX[hv.face], hv.y + FDY[hv.face], hv.z + FDZ[hv.face]]); return true; }
    return false;   // the profile and the path are drawn in the panel: a click on the model paints as before
  };
  // the selection box in the view (crafter.js HOOK.overlay, item mode)
  FT.overlay = function (segs) {
    const i = it(); if (!i || ST.tool !== 'bevel') return;
    const b = ST.sel || (ST.selA ? [...ST.selA, ...ST.selA] : null); if (!b) return;
    const r = i.res, x0 = b[0] / r, y0 = b[1] / r, z0 = b[2] / r, x1 = (b[3] + 1) / r, y1 = (b[4] + 1) / r, z1 = (b[5] + 1) / r, c = [1, 0.62, 0.2];
    const P = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]];
    for (const [a, b2] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) segs.push(...P[a], ...P[b2], c[0], c[1], c[2]);
  };

  // the panel (crafter.js itemTools asks at its end): the six tools and the chosen one's settings
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
  function seg(items, cur, fn) { const d = el('div', 'seg'); for (const [v, label] of items) { const b = el('button', v === cur ? 'on' : '', label); b.onclick = () => { fn(v); C.list(); }; d.appendChild(b); } return d; }
  function slider(label, min, max, step, val, fn) {
    const d = el('div', 'ftrow'), l = el('span', '', label), r = document.createElement('input'), o = el('b', '', String(val));
    r.type = 'range'; r.min = min; r.max = max; r.step = step; r.value = val;
    r.oninput = () => { const v = +r.value; o.textContent = String(v); fn(v); };
    d.append(l, r, o); return d;
  }
  FT.panel = function (root) {
    if (!it()) return;
    fresh();
    const g = el('div', 'grp', '✦ ' + TX('ft.group', null, 'Formen', 'Shapes')); root.appendChild(g);
    const d = el('div', 'seg ftools');
    for (const [id, ic, k, de, en] of TOOLS) { const b = el('button', ST.tool === id ? 'on' : ''); b.dataset.ft = id; b.innerHTML = '<i>' + ic + '</i>'; b.appendChild(document.createTextNode(TX(k, null, de, en))); b.onclick = () => { ST.tool = ST.tool === id ? null : id; C.list(); }; d.appendChild(b); }
    root.appendChild(d);
    const t = ST.tool; if (!t) { root.appendChild(el('div', 'note dim', TX('ft.note', null, 'Formen schreiben Voxel: Strg+Z nimmt sie zurück, das Design bleibt Voxel. ✦ Glatt zeigt die runde Oberfläche.', 'Shapes write voxels: Ctrl+Z takes them back, the design stays voxels. ✦ Smooth shows the round surface.'))); return; }
    const box = el('div', 'ftbox'); root.appendChild(box);
    const applyB = () => { const b = el('button', 'pri ftapply', '✦ ' + TX('ft.apply', null, 'Anwenden', 'Apply')); b.dataset.act = 'ft-apply'; b.onclick = () => FT.applyTool(ST.tool); return b; };
    const i = it();
    if (t === 'lathe') {
      box.appendChild(el('div', 'note dim', TX('ft.lathe.tip', null, 'Ziehe die Punkte: das Profil dreht sich um die Mitte des Modells', 'Drag the points: the profile turns round the model\'s centre')));
      box.appendChild(profileCanvas());
      const row = el('div', 'seg');
      const add = el('button', '', '+ ' + TX('ft.pt', null, 'Punkt', 'Point')); add.onclick = () => { if (ST.profile.length >= 12) return; const p = ST.profile, a = p[p.length - 2], b = p[p.length - 1]; p.splice(p.length - 1, 0, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]); C.list(); };
      const del = el('button', '', '− ' + TX('ft.pt', null, 'Punkt', 'Point')); del.onclick = () => { if (ST.profile.length <= 6) return; ST.profile.splice(ST.profile.length - 2, 1); C.list(); };
      row.append(add, del); box.appendChild(row);
      box.appendChild(el('div', 'grp', TX('ft.wall', null, 'Wand', 'Wall')));
      box.appendChild(seg([[0, TX('ft.solid', null, 'voll', 'solid')], [1, '1'], [2, '2'], [3, '3']], ST.wall, (v) => { ST.wall = v; }));
      box.appendChild(applyB());
    } else if (t === 'extrude') {
      box.appendChild(el('div', 'note dim', TX('ft.path.tip', null, 'Klicke Punkte in die Draufsicht, ziehe sie, Rechtsklick nimmt den letzten weg', 'Click points into the top view, drag them, a right click takes the last away')));
      box.appendChild(pathCanvas());
      box.appendChild(seg([['circle', TX('ft.round', null, 'Rund', 'Round')], ['box', TX('ft.square', null, 'Kantig', 'Square')]], ST.shape, (v) => { ST.shape = v; }));
      box.appendChild(slider(TX('ft.width', null, 'Breite', 'Width'), 1, Math.max(4, Math.round(i.res / 2)), 0.5, ST.w, (v) => { ST.w = v; }));
      if (ST.shape === 'box') box.appendChild(slider(TX('ft.height', null, 'Höhe', 'Height'), 1, Math.max(4, Math.round(i.res / 2)), 0.5, ST.h, (v) => { ST.h = v; }));
      box.appendChild(slider(TX('ft.level', null, 'Ebene', 'Level'), 0, i.VH - 1, 1, ST.level, (v) => { ST.level = v; }));
      const row = el('div', 'seg'); const clr = el('button', '', TX('ft.clearPath', null, 'Pfad leeren', 'Clear the path')); clr.onclick = () => { ST.path = []; C.list(); }; row.appendChild(clr); box.appendChild(row);
      box.appendChild(applyB());
    } else if (t === 'bevel') {
      box.appendChild(el('div', 'grp', TX('ft.radius', null, 'Radius', 'Radius')));
      box.appendChild(seg([[1, '1'], [2, '2'], [3, '3'], [4, '4']], ST.r, (v) => { ST.r = v; }));
      const s = ST.sel ? (ST.sel[3] - ST.sel[0] + 1) + ' × ' + (ST.sel[4] - ST.sel[1] + 1) + ' × ' + (ST.sel[5] - ST.sel[2] + 1) : TX('ft.sel.all', null, 'das ganze Modell', 'the whole model');
      box.appendChild(el('div', 'note dim', TX('ft.sel', { s }, 'Auswahl: {s} — klicke zwei Ecken auf dem Modell', 'Selection: {s} — click two corners on the model')));
      if (ST.sel) { const row = el('div', 'seg'); const b = el('button', '', TX('ft.sel.clear', null, 'Auswahl weg', 'Clear the selection')); b.onclick = () => { ST.sel = null; ST.selA = null; C.list(); }; row.appendChild(b); box.appendChild(row); }
      box.appendChild(applyB());
    } else {
      box.appendChild(el('div', 'note dim', TX('ft.place.tip', null, 'Klicke auf das Modell: dort entsteht die Form', 'Click the model: the shape appears there')));
      box.appendChild(slider(TX('ft.radius', null, 'Radius', 'Radius'), 0.5, Math.max(4, i.res / 2), 0.25, ST.pr, (v) => { ST.pr = v; }));
      if (t !== 'sphere') box.appendChild(slider(TX('ft.height', null, 'Höhe', 'Height'), 1, i.VH, 1, ST.ph, (v) => { ST.ph = v; }));
    }
  };
  // the profile: r across (0 … half the footprint), y up (0 … the height); drag a point
  function profileCanvas() {
    const i = it(), W = 220, H = 180, cv = el('canvas', 'ftcv'); cv.width = W; cv.height = H; cv.dataset.ft = 'profile';
    const R = Math.min(i.VW, i.VD) / 2, M = 12, sx = (W - 2 * M) / R, sy = (H - 2 * M) / i.VH;
    const toPx = (p) => [M + p[0] * sx, H - M - p[1] * sy], fromPx = (x, y) => [Math.max(0, Math.min(R, Math.round((x - M) / sx * 4) / 4)), Math.max(0, Math.min(i.VH, Math.round((H - M - y) / sy * 4) / 4))];
    const draw = () => {
      const g = cv.getContext('2d'); g.fillStyle = '#0b1118'; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(120,150,180,.18)'; g.lineWidth = 1;
      for (let y = 0; y <= i.VH; y += Math.max(1, i.res / 4)) { const p = toPx([0, y]); g.beginPath(); g.moveTo(M, p[1]); g.lineTo(W - M, p[1]); g.stroke(); }
      g.strokeStyle = 'rgba(56,230,255,.5)'; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(M, M); g.lineTo(M, H - M); g.stroke(); g.setLineDash([]);   // the axis
      const P = ST.profile;
      g.fillStyle = 'rgba(56,230,255,.12)'; g.beginPath(); g.moveTo(...toPx([0, P[0][1]])); for (const p of P) g.lineTo(...toPx(p)); g.lineTo(...toPx([0, P[P.length - 1][1]])); g.closePath(); g.fill();
      g.strokeStyle = '#38e6ff'; g.lineWidth = 2; g.beginPath(); P.forEach((p, k) => { const q = toPx(p); if (k) g.lineTo(...q); else g.moveTo(...q); }); g.stroke();
      g.fillStyle = '#ffd27a'; for (const p of P) { const q = toPx(p); g.beginPath(); g.arc(q[0], q[1], 4.5, 0, Math.PI * 2); g.fill(); }
    };
    let drag = -1;
    cv.onpointerdown = (e) => { const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * W / r.width, y = (e.clientY - r.top) * H / r.height; let best = -1, bd = 14; ST.profile.forEach((p, k) => { const q = toPx(p), dd = Math.hypot(q[0] - x, q[1] - y); if (dd < bd) { bd = dd; best = k; } }); drag = best; if (drag >= 0) cv.setPointerCapture(e.pointerId); };
    cv.onpointermove = (e) => { if (drag < 0) return; const r = cv.getBoundingClientRect(); ST.profile[drag] = fromPx((e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height); draw(); };
    cv.onpointerup = () => { drag = -1; };
    draw(); return cv;
  }
  // the path: the model's footprint from above (x across, z down), a click adds a point, drag moves one, a right click
  // takes the last away
  function pathCanvas() {
    const i = it(), W = 220, H = Math.round(220 * Math.min(1.4, i.VD / i.VW)), cv = el('canvas', 'ftcv'); cv.width = W; cv.height = H; cv.dataset.ft = 'path';
    const M = 10, sx = (W - 2 * M) / i.VW, sz = (H - 2 * M) / i.VD;
    const toPx = (p) => [M + p[0] * sx, M + p[1] * sz], fromPx = (x, y) => [Math.max(0, Math.min(i.VW, Math.round((x - M) / sx * 2) / 2)), Math.max(0, Math.min(i.VD, Math.round((y - M) / sz * 2) / 2))];
    const draw = () => {
      const g = cv.getContext('2d'); g.fillStyle = '#0b1118'; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(120,150,180,.18)';
      for (let x = 0; x <= i.VW; x += i.res) { g.beginPath(); g.moveTo(M + x * sx, M); g.lineTo(M + x * sx, H - M); g.stroke(); }
      for (let z = 0; z <= i.VD; z += i.res) { g.beginPath(); g.moveTo(M, M + z * sz); g.lineTo(W - M, M + z * sz); g.stroke(); }
      const P = ST.path;
      g.strokeStyle = 'rgba(56,230,255,.35)'; g.lineWidth = Math.max(2, ST.w * sx); g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); P.forEach((p, k) => { const q = toPx(p); if (k) g.lineTo(...q); else g.moveTo(...q); }); g.stroke();
      g.strokeStyle = '#38e6ff'; g.lineWidth = 1.5; g.beginPath(); P.forEach((p, k) => { const q = toPx(p); if (k) g.lineTo(...q); else g.moveTo(...q); }); g.stroke();
      g.fillStyle = '#ffd27a'; for (const p of P) { const q = toPx(p); g.beginPath(); g.arc(q[0], q[1], 4, 0, Math.PI * 2); g.fill(); }
    };
    let drag = -1;
    const at = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
    cv.oncontextmenu = (e) => { e.preventDefault(); ST.path.pop(); draw(); };
    cv.onpointerdown = (e) => {
      if (e.button === 2) return;
      const [x, y] = at(e); let best = -1, bd = 10; ST.path.forEach((p, k) => { const q = toPx(p), dd = Math.hypot(q[0] - x, q[1] - y); if (dd < bd) { bd = dd; best = k; } });
      if (best < 0 && ST.path.length < 16) { ST.path.push(fromPx(x, y)); best = ST.path.length - 1; }
      drag = best; if (drag >= 0) cv.setPointerCapture(e.pointerId); draw();
    };
    cv.onpointermove = (e) => { if (drag < 0) return; const [x, y] = at(e); ST.path[drag] = fromPx(x, y); draw(); };
    cv.onpointerup = () => { drag = -1; };
    draw(); return cv;
  }
  // the look of the new controls
  const css = document.createElement('style');
  css.textContent = '.ftools button{min-width:0;padding:4px 6px}.ftools button i{margin-right:4px;font-style:normal}.ftbox{margin:4px 0 8px}.ftcv{display:block;width:100%;max-width:240px;border:1px solid var(--line);border-radius:6px;margin:4px 0;cursor:crosshair;touch-action:none}.ftrow{display:flex;align-items:center;gap:6px;margin:4px 0;font-size:12px}.ftrow input{flex:1}.ftrow b{min-width:28px;text-align:right}.ftapply{margin-top:6px;width:100%}'
    + '.card .glattb{position:absolute;top:6px;left:6px;z-index:2;border:0;border-radius:6px;padding:1px 6px;background:rgba(10,14,20,.7);color:var(--mute);font-size:13px;cursor:pointer;opacity:.55;transition:opacity .15s}.card:hover .glattb,.card .glattb.on{opacity:1}.card .glattb.on{color:#38e6ff;background:rgba(56,230,255,.18)}@media (hover: none){.card .glattb{opacity:1}}.card.glatt .th{filter:saturate(1.05)}';
  document.head.appendChild(css);
  setTimeout(viewButton, 0);
})();
