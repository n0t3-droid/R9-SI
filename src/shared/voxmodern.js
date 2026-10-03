// ============================================================================
// Modern Living — the big modern item pack (v0.39), in the creative tab
// "Modern Living" and the Studio (✨ Modern in 🧱 Teile, Möbel categories).
// Sets: Licht · Smart Home · Küche · Wohnen · Schlafen · Bad · Pflanzen (and
// more to come), every item made by a parametric builder in the model
// language (voxmodel.js) at real scale (seat 7–7.5 units, table 12, counter 15,
// bar 17–18, bed top 8–9; 16 units = one block = 1 m; front = −z).
// Registered LATE (VR.BL.late, after Vollton): every older block keeps its
// state ids, so saved worlds stay intact. LAZY: an item registers from its
// declared cells and one colour of the shared palette; its voxels are built on
// first use (a paint, an icon, the Studio) — boot and memory stay small on
// low-end PCs. Lamps switch on and off with a right click; cupboards open.
// ids vm_<set>_<item>_<variant> · display "Family · variant".
// ============================================================================
(function (VR) {
  'use strict';
  const VM = VR.VM;
  if (!VM || !VR.VX) return;
  const M = VM.M, sh = VR.VX.sh, mix = VR.VX.mix;

  // ---------------------------------------------------------------- the shared palette
  // every item registers with one of these colours (its far / particle tint: at most one texture layer per colour);
  // the builders paint with them too, so the sets match each other
  const P = VM.MODERN_PALETTE = {
    white: 0xF3F2EE, cream: 0xE8E2D4, greige: 0xC8C0B2, sand: 0xD6C6A8, taupe: 0x9A8C7E, stone: 0xB4B6B8,
    concrete: 0x8E8E8A, graphite: 0x41454B, anthracite: 0x2B2E33, black: 0x17181B,
    oak: 0xC59B68, walnut: 0x5C3F2E, ash: 0xDDCBA9,
    brass: 0xC9A24A, copper: 0xB8714A, chrome: 0xD6DCE2, steel: 0xA8AEB5,
    sage: 0x97A88F, olive: 0x6E7451, forest: 0x2E5843, navy: 0x253350, petrol: 0x285B66, terracotta: 0xB9664B,
    rust: 0x974B33, mustard: 0xCF9F3A, blush: 0xD8ADA4, sky: 0x8AB4D4, leaf: 0x3E7D44, warm: 0xFFD58C, screen: 0x1A2636,
  };
  // the Studio's categories for the pack (German labels; Möbel chips, Teile)
  VM.MODERN_CATS = { light: 'Licht', smart: 'Smart Home', kitchen: 'Küche', living: 'Wohnen', sleep: 'Schlafen', bath: 'Bad', plant: 'Pflanzen', office: 'Büro & Technik', garden: 'Garten & Pool', mobility: 'Mobilität', shop: 'Laden & Café', deco: 'Deko & Kunst', seat: 'Sofas & Sessel', table: 'Tische', storage: 'Schränke & Stauraum' };
  const NAMES = VM.MODERN_NAMES = [];
  // def('light', 'pendant', 'globe_brass', 'Pendant Globe · brass', { size, res, col: 'brass', build, … })
  function def(set, item, variant, display, o) {
    const name = 'vm_' + set + '_' + item + '_' + variant;
    const col = typeof o.col === 'string' ? P[o.col] : o.col;
    if (col === undefined) throw new Error('modern pack: ' + name + ' needs a palette colour');
    VM.define(name, display, Object.assign({ res: 16, sound: 'wood', hard: 0.8 }, o, { late: true, lazy: true, col, cat: 'vmodern', cats: o.cats || [set], meta: { modern: true, set, mount: o.mount || 'floor' } }));
    NAMES.push(name);
    return name;
  }
  VM.modernDef = def;

  // ---------------------------------------------------------------- small shared kit
  const glowW = 0xFFF1DA;                                                     // opal glass, a warm white glow
  const finish = (f) => f === 'chrome' ? M.chrome() : f === 'white' ? M.gloss(P.white) : f === 'sage' ? M.gloss(P.sage) : M.metal(P[f]);
  const cordOf = (f) => (f === 'white' || f === 'chrome' ? M.matte(0xE8E8E4) : M.matte(0x1A1A1C));
  // a ceiling canopy and a cord down to y (pendants)
  const canopy = (b, f, y) => { const w = b.S >= 2 ? 0.25 : 0.5; b.cyl('y', 8, 8, 1.6, 15, 16, finish(f)); b.box(8 - w, y, 8 - w, 8 + w, 15, 8 + w, cordOf(f)); };
  // an ellipse ring in the x-y plane (bladeless fans, mirrors), w thick, from z0 to z1 (grid-exact)
  function ellRing(b, cx, cy, rx, ry, w, z0, z1, m) {
    const S = b.S;
    for (let y = Math.floor((cy - ry) * S); y < Math.ceil((cy + ry) * S); y++) for (let x = Math.floor((cx - rx) * S); x < Math.ceil((cx + rx) * S); x++) {
      const px = (x + 0.5) / S - cx, py = (y + 0.5) / S - cy;
      const o = (px / rx) ** 2 + (py / ry) ** 2, i = (px / Math.max(0.1, rx - w)) ** 2 + (py / Math.max(0.1, ry - w)) ** 2;
      if (o <= 1 && i > 1) for (let z = Math.round(z0 * S); z < Math.round(z1 * S); z++) b.set(x, y, z, m);
    }
  }
  // an elliptic slab in the x-z plane (oval table tops, tubs, round rugs), grid-exact
  function ellRingFill(b, cx, cz, rx, rz, y0, y1, m) {
    const S = b.S;
    for (let z = Math.floor((cz - rz) * S); z < Math.ceil((cz + rz) * S); z++) for (let x = Math.floor((cx - rx) * S); x < Math.ceil((cx + rx) * S); x++) {
      const px = (x + 0.5) / S - cx, pz = (z + 0.5) / S - cz;
      if ((px / rx) ** 2 + (pz / rz) ** 2 <= 1) for (let y = Math.round(y0 * S); y < Math.round(y1 * S); y++) b.set(x, y, z, m);
    }
  }
  // a row of n upright books from x along +x, standing at y, z..z+3.5
  const BOOKC = [0x2F55C8, 0xC0443A, 0xE8B83A, 0x3E8A4A, 0x2A2D33, 0xE8E2D4, 0x8A5AC8, 0xB9664B];
  function books(b, x, y, z, n) { for (let k = 0; k < n; k++) { const w = k % 2 ? 1 : 0.5, h = 3.5 + (k % 3) * 0.5; b.box(x, y, z, x + w, y + h, z + 3.5, M.matte(BOOKC[(k * 3) % 8])); x += w; } }
  // a little screen user interface: a dark glass face with glowing tiles (x0..x1, y0..y1 at depth z, facing −z)
  function screenUI(b, x0, y0, x1, y1, z, kind) {
    b.box(x0, y0, z, x1, y1, z + 0.5, M.gloss(0x0E1218));
    const w = x1 - x0, h = y1 - y0;
    if (kind === 'thermo') { b.cyl('z', (x0 + x1) / 2, (y0 + y1) / 2, Math.min(w, h) * 0.36, z - 0.5, z, M.light(0xFF8A3A)); b.cyl('z', (x0 + x1) / 2, (y0 + y1) / 2, Math.min(w, h) * 0.22, z - 0.5, z, M.gloss(0x0E1218)); return; }
    b.box(x0 + 0.5, y0 + 0.5, z - 0.5, x1 - 0.5, y1 - 0.5, z, M.light(0x1C3352));                  // the lit display
    const tiles = [0xF2B544, 0x5CC8F0, 0x7ED98A, 0xF26D6D, 0xE8E8F0, 0xB48CF2];
    const cols = Math.max(2, Math.round(w / 2)), rows = Math.max(1, Math.round(h / 2.5));
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const tx = x0 + 1 + c * ((w - 2) / cols), ty = y0 + 1 + r * ((h - 2) / rows);
      if ((r * cols + c) % 3 === 2 && kind !== 'tiles') continue;
      b.box(tx, ty, z - 0.5, tx + Math.max(0.5, (w - 2) / cols - 0.5), ty + Math.max(0.5, (h - 2) / rows - 0.5), z, M.light(tiles[(r * cols + c) % tiles.length]));
    }
  }

  // ================================================================ LICHT — lamps (all switch on and off)
  const LAMP = { cats: ['light'], toggle: true, sound: 'metal', hard: 0.4, solid: false };
  // pendants: five shapes in their finishes, hanging from the ceiling (res 32 for round shades)
  const PENDANTS = [
    ['globe', 'Globe', ['brass', 'black', 'chrome'], (b, f) => {
      canopy(b, f, 10);
      b.cyl('y', 8, 8, 1.1, 9, 10.5, finish(f));                                                // cap
      b.sphere(8, 6, 8, 3.6, M.light(glowW));                                                   // the opal globe
    }],
    // a dome shade (solid: its glowing diffuser closes it underneath — cheap to mesh, no gaps on the slope)
    ['dome', 'Dome', ['black', 'white', 'sage'], (b, f) => {
      canopy(b, f, 9);
      b.lathe(8, 8, [[4, 5.4], [4.5, 5.3], [5.5, 4.9], [6.5, 4.2], [7.5, 3.2], [8.5, 1.9], [9.5, 0.9]], finish(f));
      b.cyl('y', 8, 8, 4.6, 3.5, 4, M.light(glowW)); b.tube('y', 8, 8, 5.4, 0.8, 3.5, 4, finish(f));
    }],
    ['cone', 'Cone', ['terracotta', 'concrete'], (b, f) => {
      const m = f === 'terracotta' ? M.matte(P.terracotta) : M.concrete(P.concrete);
      canopy(b, 'black', 11);
      b.lathe(8, 8, [[3, 4.4], [5, 3.5], [7, 2.6], [9, 1.7], [11, 0.9]], m);
      b.cyl('y', 8, 8, 3.6, 2.5, 3, M.light(glowW)); b.tube('y', 8, 8, 4.4, 0.8, 2.5, 3, m);
    }],
    ['tube', 'Tube', ['black', 'brass'], (b, f) => {
      canopy(b, f, 12);
      b.cyl('y', 8, 8, 2.4, 3.5, 12, finish(f));
      b.cyl('y', 8, 8, 1.9, 3.5, 4, M.light(glowW));                                            // the lens at the bottom
    }],
    // a ring of light on three straight cords
    ['halo', 'Halo', ['black', 'brass'], (b, f) => {
      for (let k = 0; k < 3; k++) { const a = k * Math.PI * 2 / 3 + 0.5, x = Math.round((8 + Math.cos(a) * 6.6) * 2) / 2, z = Math.round((8 + Math.sin(a) * 6.6) * 2) / 2; b.box(x - 0.25, 7, z - 0.25, x + 0.25, 15.5, z + 0.25, cordOf(f)); b.cyl('y', x, z, 0.9, 15.5, 16, finish(f)); }
      b.tube('y', 8, 8, 7.2, 1, 6, 7, finish(f));                                              // the ring
      b.tube('y', 8, 8, 7, 0.6, 5.5, 6, M.light(0xFFF4E4));                                    // the LED strip underneath
    }],
  ];
  for (const [id, fam, fins, build, res] of PENDANTS) for (const f of fins) {
    def('light', 'pendant', id + '_' + f, 'Pendant ' + fam + ' · ' + f, Object.assign({}, LAMP, { mount: 'ceiling', res: res || 32, size: [1, 1, 1], col: f, light: id === 'halo' ? [13, 13, 12] : [14, 12, 8], build: (b) => build(b, f) }));
  }
  // floor lamps: an opal globe on a slim stem, and an uplighter bowl
  for (const f of ['brass', 'black']) def('light', 'floor', 'globe_' + f, 'Floor Lamp Globe · ' + f, Object.assign({}, LAMP, { res: 32, size: [1, 2, 1], col: f, light: [14, 12, 8], build: (b) => {
    b.lathe(8, 8, [[0, 4.2], [0.5, 4.2], [1, 3.6], [1.2, 0.9]], M.marble(f === 'brass' ? 0xE6E4E0 : 0x2A2C30));
    b.cyl('y', 8, 8, 0.5, 1, 23.5, finish(f)); b.cyl('y', 8, 8, 1.2, 23, 24.5, finish(f));
    b.sphere(8, 27.5, 8, 3.8, M.light(glowW));
  } }));
  for (const f of ['black', 'white']) def('light', 'floor', 'uplight_' + f, 'Floor Uplight · ' + f, Object.assign({}, LAMP, { res: 32, size: [1, 2, 1], col: f, light: [13, 12, 9], build: (b) => {
    const m = f === 'white' ? M.gloss(P.white) : M.metal(P.black);
    b.pbox(5, 0, 5, 11, 1, 11, 1, m); b.box(7.5, 1, 7.5, 8.5, 27, 8.5, m);
    b.lathe(8, 8, [[26.5, 1], [27.5, 3.4], [28.5, 4.8], [29.5, 5.4]], m);
    b.cyl('y', 8, 8, 4.6, 29, 29.5, M.light(0xFFF0D4));                                          // the light thrown up out of the bowl
  } }));
  // table lamps: the mushroom (opal / sage / terracotta) and a globe on a brass foot
  for (const [f, label] of [['white', 'opal'], ['sage', 'sage'], ['terracotta', 'terracotta']]) def('light', 'table', 'mushroom_' + f, 'Table Lamp Mushroom · ' + label, Object.assign({}, LAMP, { res: 32, size: [1, 1, 1], col: f, light: [12, 10, 7], build: (b) => {
    const shade = f === 'white' ? M.light(glowW) : f === 'sage' ? M.gloss(P.sage) : M.gloss(P.terracotta), body = f === 'white' ? M.gloss(P.white) : shade;
    b.cyl('y', 8, 8, 2.4, 0, 0.5, body); b.cyl('y', 8, 8, 0.6, 0.5, 5, body);                  // foot and stem
    b.lathe(8, 8, [[5, 3.6], [5.5, 3.6], [6, 3.4], [6.5, 3], [7, 2.4], [7.5, 1.6], [8, 0.6]], shade);
    if (f !== 'white') b.cyl('y', 8, 8, 3, 4.5, 5, M.light(glowW));                            // the glowing rim underneath
  } }));
  def('light', 'table', 'globe_brass', 'Table Lamp Globe · brass', Object.assign({}, LAMP, { res: 32, size: [1, 1, 1], col: 'brass', light: [12, 10, 7], build: (b) => {
    b.cyl('y', 8, 8, 2.2, 0, 0.5, M.metal(P.brass)); b.cyl('y', 8, 8, 0.6, 0.5, 3, M.metal(P.brass)); b.cyl('y', 8, 8, 1.3, 3, 3.5, M.metal(P.brass));
    b.sphere(8, 6, 8, 2.8, M.light(glowW));
  } }));
  // wall lamps (they hang on the wall behind them, +z)
  for (const f of ['black', 'white']) def('light', 'wall', 'updown_' + f, 'Wall Lamp Up-Down · ' + f, Object.assign({}, LAMP, { mount: 'wall', res: 32, size: [1, 1, 1], col: f, light: [12, 11, 8], build: (b) => {
    const m = f === 'white' ? M.gloss(P.white) : M.metal(P.black);
    b.box(6.5, 7.5, 15.5, 9.5, 12.5, 16, m); b.box(7.5, 9.5, 12.5, 8.5, 10.5, 15.5, m);
    b.cyl('y', 8, 11, 1.8, 6.5, 13.5, m);
    b.cyl('y', 8, 11, 1.3, 6, 6.5, M.light(0xFFF0D4)); b.cyl('y', 8, 11, 1.3, 13.5, 14, M.light(0xFFF0D4));
  } }));
  def('light', 'wall', 'swingarm_brass', 'Wall Lamp Swing Arm · brass', Object.assign({}, LAMP, { mount: 'wall', res: 32, size: [1, 1, 1], col: 'brass', light: [12, 10, 7], build: (b) => {
    const m = M.metal(P.brass);
    b.pbox(6.5, 10, 15, 9.5, 14, 16, 0.5, m); b.rod(8, 12, 15, 8, 12, 8.5, 0.5, m); b.sphere(8, 12, 8.5, 0.8, m);   // wall plate, arm, joint
    b.rod(8, 12, 8.5, 6, 12, 4.5, 0.5, m); b.rod(6, 12, 4.5, 6, 10.5, 4.5, 0.5, m);
    b.lathe(6, 4.5, [[6.5, 2.6], [7.5, 2.4], [8.5, 1.8], [9.5, 1.1], [10.5, 0.6]], m);           // the reading shade
    b.cyl('y', 6, 4.5, 2, 6, 6.5, M.light(glowW));
  } }));
  def('light', 'wall', 'ledbar_white', 'Wall Lamp LED Bar · white', Object.assign({}, LAMP, { mount: 'wall', res: 32, size: [1, 1, 1], col: 'white', light: [12, 12, 11], build: (b) => {
    b.box(1, 11.5, 14, 15, 13, 16, M.gloss(P.white)); b.box(7, 10, 15.5, 9, 11.5, 16, M.gloss(P.white));
    b.box(1.5, 11, 14.5, 14.5, 11.5, 15.5, M.light(0xFFF6EA));
  } }));

  // ================================================================ SMART HOME
  const SM = { cats: ['smart'], sound: 'metal', hard: 0.6 };
  // smart speakers: fabric over a round body, a glowing ring on top
  for (const [k, c] of [['charcoal', P.graphite], ['sand', P.sand]]) def('smart', 'speaker', k, 'Smart Speaker · ' + k, Object.assign({}, SM, { res: 32, size: [1, 1, 1], col: k === 'sand' ? 'sand' : 'graphite', sound: 'wool', build: (b) => {
    b.lathe(8, 8, [[0, 1.9], [0.5, 2.1], [3.5, 2.1], [4, 1.9]], M.fabric(c));
    b.cyl('y', 8, 8, 1.8, 4, 4.5, M.matte(sh(c, 0.8))); b.tube('y', 8, 8, 1.4, 0.5, 4, 4.5, M.light(0x6EC8FF));
  } }));
  def('smart', 'speaker', 'pillar', 'Smart Speaker · pillar', Object.assign({}, SM, { res: 32, size: [1, 1, 1], col: 'graphite', sound: 'wool', build: (b) => {
    b.pbox(4.5, 0, 4.5, 11.5, 0.5, 11.5, 1, M.metal(P.black));
    b.lathe(8, 8, [[0.5, 2.6], [1, 2.8], [14, 2.8], [14.5, 2.5]], M.fabric(P.graphite));
    b.cyl('y', 8, 8, 2.4, 14.5, 15, M.gloss(0x1E2024)); b.tube('y', 8, 8, 1.8, 0.5, 14.5, 15, M.light(0xF2F2FF));
  } }));
  def('smart', 'display', 'hub', 'Smart Display · 10 inch', Object.assign({}, SM, { res: 32, size: [1, 1, 1], col: 'white', build: (b) => {
    b.rbox(4, 0, 6.5, 12, 2.5, 10, 1, M.fabric(P.cream));                                       // the speaker base
    b.beam(5, 2, 5, 7.5, 7.6, 8.4, 1.5, M.gloss(P.white)); b.beam(11, 2, 11, 7.5, 7.6, 8.4, 1.5, M.gloss(P.white));
    b.box(2.5, 2.5, 6, 13.5, 8.5, 7, M.gloss(P.white)); screenUI(b, 3, 3, 13, 8, 5.5, 'tiles');
  } }));
  def('smart', 'panel', 'wall', 'Smart Wall Panel · white', Object.assign({}, SM, { mount: 'wall', res: 32, size: [1, 1, 1], col: 'white', solid: false, build: (b) => {
    b.box(5, 8, 15, 11, 12.5, 16, M.gloss(P.white)); screenUI(b, 5.5, 8.5, 10.5, 12, 14.5, 'tiles');
  } }));
  def('smart', 'thermostat', 'round', 'Smart Thermostat · round', Object.assign({}, SM, { mount: 'wall', res: 32, size: [1, 1, 1], col: 'chrome', solid: false, build: (b) => {
    b.cyl('z', 8, 9.5, 1.7, 14.5, 16, M.chrome()); b.cyl('z', 8, 9.5, 1.3, 14, 14.5, M.gloss(0x0E1218));
    b.tube('z', 8, 9.5, 1.0, 0.5, 13.5, 14, M.light(0xFF8A3A)); b.box(7.5, 9, 13.5, 8.5, 10, 14, M.light(0xFFC08A));
  } }));
  def('smart', 'router', 'wifi', 'WiFi Router · black', Object.assign({}, SM, { res: 32, size: [1, 1, 1], col: 'black', build: (b) => {
    b.pbox(4, 0.5, 5.5, 12, 2, 10.5, 0.5, M.gloss(P.black)); b.box(4.5, 0, 6, 11.5, 0.5, 10, M.matte(0x2A2C30));
    for (let x = 5; x < 11.5; x += 1) b.box(x, 1.5, 5, x + 0.5, 2, 5.5, M.light(x < 8 ? 0x4AE08A : 0x5CC8F0));
    for (const x of [4.5, 6.5, 9.5, 11.5]) { b.box(x - 0.25, 2, 9.75, x + 0.25, 6.5, 10.25, M.matte(P.black)); b.box(x - 0.5, 1.5, 9.5, x + 0.5, 2.5, 10.5, M.matte(P.black)); }
  } }));
  def('smart', 'mesh', 'node', 'Mesh WiFi · node', Object.assign({}, SM, { res: 32, size: [1, 1, 1], col: 'white', build: (b) => {
    b.lathe(8, 8, [[0, 2], [0.5, 2.2], [4, 2.2], [4.5, 1.8]], M.gloss(P.white)); b.cyl('y', 8, 8, 0.5, 4.5, 5, M.light(0x5CC8F0));
  } }));
  def('smart', 'doorbell', 'video', 'Video Doorbell · black', Object.assign({}, SM, { mount: 'wall', res: 32, size: [1, 1, 1], col: 'black', solid: false, build: (b) => {
    b.pbox(7, 7.5, 15, 9, 12, 16, 0.5, M.gloss(P.black));
    b.cyl('z', 8, 11, 0.5, 14.5, 15, M.glass(0x3A4A5A)); b.tube('z', 8, 8.5, 0.8, 0.5, 14.5, 15, M.light(0x5CC8F0));
  } }));
  def('smart', 'camera', 'dome', 'Security Camera · dome', Object.assign({}, SM, { mount: 'ceiling', res: 32, size: [1, 1, 1], col: 'white', solid: false, build: (b) => {
    b.cyl('y', 8, 8, 3, 15, 16, M.gloss(P.white)); b.lathe(8, 8, [[12.5, 1.6], [13.5, 2.4], [14.5, 2.6], [15, 2.6]], M.glass(0x2A3440));
    b.cyl('y', 8, 8, 0.8, 13, 13.5, M.gloss(0x111214));
  } }));
  def('smart', 'camera', 'bullet', 'Security Camera · bullet', Object.assign({}, SM, { mount: 'wall', res: 32, size: [1, 1, 1], col: 'white', solid: false, build: (b) => {
    b.box(6.5, 11.5, 15.5, 9.5, 14.5, 16, M.gloss(P.white)); b.rod(8, 13, 15.5, 8, 12.5, 12.5, 0.5, M.gloss(P.white));
    b.cyl('z', 8, 12, 1.4, 7, 13, M.gloss(P.white)); b.cyl('z', 8, 12, 1.4, 6, 7, M.gloss(P.black)); b.cyl('z', 8, 12, 0.8, 5.5, 6, M.glass(0x2A3440));
    b.box(6, 13.5, 6, 10, 14, 12, M.gloss(P.white));                                            // sun visor
  } }));
  def('smart', 'vacuum', 'robot', 'Robot Vacuum · with dock', Object.assign({}, SM, { res: 32, size: [1, 1, 1], col: 'anthracite', build: (b) => {
    b.cyl('y', 8, 7.5, 5.2, 0, 1.5, M.gloss(P.anthracite)); b.cyl('y', 8, 7.5, 1.2, 1.5, 2.5, M.gloss(0x111214)); b.cyl('y', 8, 7.5, 0.5, 2.5, 3, M.light(0x5CC8F0));
    b.tube('y', 8, 7.5, 5.3, 0.5, 0, 1, M.matte(0x111214));
    b.box(4.5, 0, 13.5, 11.5, 4.5, 15.5, M.gloss(P.white)); b.box(5, 0, 12.5, 11, 0.5, 13.5, M.gloss(P.white)); b.box(7, 3.5, 13.2, 9, 4, 13.5, M.light(0x4AE08A));
  } }));
  for (const [k, c] of [['white', P.white], ['grey', P.stone]]) def('smart', 'purifier', k, 'Air Purifier · ' + k, Object.assign({}, SM, { res: 16, size: [1, 1, 1], col: k === 'white' ? 'white' : 'stone', build: (b) => {
    b.cyl('y', 8, 8, 3.5, 0, 11, M.gloss(c));
    for (const y of [2, 4, 6]) b.recolor(0, y, 0, 16, y + 1, 16, M.gloss(sh(c, 0.8)));            // the air intake rings
    b.cyl('y', 8, 8, 2.5, 11, 12, M.matte(0x3A3D44)); b.tube('y', 8, 8, 3.5, 1, 11, 12, M.gloss(c));
    b.box(7, 9, 4, 9, 10, 5, M.light(0x5CC8F0));
  } }));
  def('smart', 'fan', 'tower', 'Bladeless Fan · tower', Object.assign({}, SM, { res: 32, size: [1, 2, 1], col: 'white', build: (b) => {
    b.lathe(8, 8, [[0, 2.4], [0.5, 2.5], [8, 2], [8.5, 1.6]], M.gloss(P.white));
    for (let y = 1.5; y < 7.5; y += 1) b.recolor(0, y, 0, 16, y + 0.5, 16, M.gloss(0xC8CCD0));
    ellRing(b, 8, 18, 3.4, 9.5, 1, 7, 9, M.gloss(P.white));
    b.box(7.5, 3, 5.5, 8.5, 3.5, 6, M.light(0x5CC8F0));
  } }));
  def('smart', 'heatpump', 'outdoor', 'Heat Pump · outdoor unit', Object.assign({}, SM, { res: 32, size: [1, 1, 1], col: 'white', hard: 1.5, build: (b) => {
    b.box(1, 0, 9, 3, 1, 15, M.metal(P.graphite)); b.box(13, 0, 9, 15, 1, 15, M.metal(P.graphite));      // feet
    b.pbox(0.5, 1, 8.5, 15.5, 13, 15.5, 0.5, M.gloss(P.white));
    b.cyl('z', 6.5, 7, 5, 8, 8.5, M.matte(0x2A2D33));                                             // the fan behind its grille
    for (const r of [2, 4.5]) b.tube('z', 6.5, 7, r + 0.5, 0.5, 7.5, 8, M.metal(P.graphite));
    b.box(1.5, 6.75, 7.5, 11.5, 7.25, 8, M.metal(P.graphite)); b.box(6.25, 2, 7.5, 6.75, 12, 8, M.metal(P.graphite));
    b.box(12.5, 2, 8, 15, 12, 8.5, M.gloss(sh(P.white, 0.9))); b.box(13, 10.5, 7.5, 14.5, 11, 8, M.light(0x4AE08A));
    b.box(0.5, 12.5, 8.5, 15.5, 13, 15.5, M.metal(P.graphite));
  } }));
  def('smart', 'battery', 'wall', 'Home Battery · 10 kwh', Object.assign({}, SM, { mount: 'wall', res: 32, size: [1, 2, 1], col: 'white', hard: 1.5, build: (b) => {
    b.pbox(2, 2, 13, 14, 21, 16, 1, M.gloss(P.white)); b.box(2.5, 1, 14, 13.5, 2, 15.5, M.metal(P.graphite));
    b.box(7.5, 5, 12.5, 8.5, 18, 13, M.light(0xE8F4FF)); b.box(6.5, 17.5, 12.5, 9.5, 18, 13, M.light(0x4AE08A));
  } }));
  def('smart', 'inverter', 'hybrid', 'Solar Inverter · hybrid', Object.assign({}, SM, { mount: 'wall', res: 32, size: [1, 1, 1], col: 'stone', hard: 1.2, build: (b) => {
    b.pbox(3.5, 5, 13, 12.5, 15, 16, 0.5, M.gloss(P.stone)); b.box(4, 13.5, 12.5, 12, 14.5, 13, M.matte(P.graphite));
    screenUI(b, 6, 10, 10, 12.5, 12.5, 'thermo');
    for (const [x, c] of [[5, 0x4AE08A], [6, 0xF2B544], [7, 0x5CC8F0]]) b.box(x, 8.5, 12.5, x + 0.5, 9, 13, M.light(c));
    for (const x of [5, 7, 9, 11]) b.box(x - 0.5, 0, 14, x + 0.5, 5, 15, M.matte(x < 8 ? 0x2A2D33 : 0xB04A3A));   // cable conduits
  } }));

  // ================================================================ KÜCHE — three new fronts on five units, appliances
  // units: a recessed plinth, the carcass, fronts with a shadow gap, a worktop 15 units up (94 cm) with a slim overhang
  const DARK = 0x26282C;
  const KSTYLE = {
    sage: { label: 'Sage', front: P.sage, top: () => M.wood(P.oak), handle: 'bar', hw: () => M.metal(P.brass), tap: () => M.metal(P.brass) },
    navy: { label: 'Navy', front: P.navy, top: () => M.marble(0xEEEDEA), handle: 'knob', hw: () => M.metal(P.brass), tap: () => M.chrome() },
    greige: { label: 'Greige', front: P.greige, top: () => M.stone(0x3A3C40), handle: 'grip', hw: () => M.metal(P.graphite), tap: () => M.metal(P.black) },
  };
  const plinth = (b, x0, x1, z0) => b.box(x0, 0, z0 === undefined ? 2.5 : z0, x1, 1.5, 16, M.matte(DARK));
  // a front from (x0, y0) to (x1, y1) at the front plane, with its handle; returns nothing
  function kfront(b, st, x0, y0, x1, y1, kind) {
    const m = M.matte(st.front), cx = (x0 + x1) / 2;
    if (st.handle === 'grip') { b.box(x0 + 0.5, y0 + 0.5, 0.5, x1, y1 - 1, 1.5, m); b.box(x0 + 0.5, y1 - 1, 1, x1, y1 - 0.5, 1.5, st.hw()); return; }
    b.box(x0 + 0.5, y0 + 0.5, 0.5, x1, y1, 1.5, m);
    const hy = kind === 'door' ? y1 - 2 : y1 - 1.5;
    if (st.handle === 'bar') b.box(cx - 3, hy - 0.5, 0, cx + 3, hy, 0.5, st.hw());
    else b.cyl('z', kind === 'door' ? x1 - 2 : cx, hy - 0.25, 0.5, 0, 0.5, st.hw());
  }
  const worktop = (b, st) => { b.box(0, 14, 0, 16, 15, 16, st.top()); };
  const carcass = (b, st, y1) => b.box(0, 1.5, 1.5, 16, y1 || 14, 16, M.matte(sh(st.front, 0.9)));
  function tap(b, m, x, z) { b.cyl('y', x, z, 0.5, 15, 20, m); b.rod(x, 20, z, x, 20, z - 4, 0.5, m); b.rod(x, 20, z - 4, x, 18.5, z - 4, 0.5, m); b.box(x + 0.5, 17, z - 0.5, x + 2, 17.5, z + 0.5, m); }
  const KUNITS = [
    ['drawers', 'drawers', [1, 1, 1], (b, st) => { plinth(b, 0, 16); carcass(b, st); kfront(b, st, 0, 1.5, 16, 5.5); kfront(b, st, 0, 5.5, 16, 9.5); kfront(b, st, 0, 9.5, 16, 14); worktop(b, st);
      b.rbox(2, 15, 3, 9, 15.5, 8, 0.25, M.wood(P.walnut)); b.lathe(12.5, 11, [[15, 1.4], [16, 1.4]], M.gloss(P.white)); }],
    ['sink', 'sink', [1, 2, 1], (b, st) => { plinth(b, 0, 16); carcass(b, st); kfront(b, st, 0, 1.5, 16, 14, 'door'); worktop(b, st);
      b.box(2.5, 11, 3, 13.5, 15, 12.5, M.metal(P.steel)); b.cut(3, 11.5, 3.5, 13, 15, 12); b.cyl('y', 8, 8, 0.5, 11.5, 12, M.metal(0x6A7078));
      tap(b, st.tap(), 8, 14); b.rbox(13.5, 15, 10, 15.5, 16.5, 13, 0.5, M.gloss(0xF4F0E8)); }],
    ['hob', 'hob', [1, 1, 1], (b, st) => { plinth(b, 0, 16); carcass(b, st); kfront(b, st, 0, 1.5, 16, 7.5); kfront(b, st, 0, 7.5, 16, 14); worktop(b, st);
      b.box(1.5, 15, 2.5, 14.5, 15.5, 13.5, M.gloss(0x141518));
      for (const [x, z, r] of [[5, 5.5, 2.5], [11, 5.5, 2], [5, 10.5, 2], [11, 10.5, 2.5]]) b.tube('y', x, z, r, 0.5, 15, 15.5, M.gloss(0x3A3D44));
      b.box(6.5, 15, 12.5, 9.5, 15.5, 13, M.light(0xFF6A3A));
      b.cyl('y', 11, 10.5, 2.2, 15.5, 16, M.metal(P.graphite)); b.box(13, 15.5, 10, 16, 16, 11, M.matte(P.black)); }],   // a frying pan
    ['tall', 'tall unit', [1, 2, 1], (b, st) => { plinth(b, 0, 16); carcass(b, st, 31.5); kfront(b, st, 0, 1.5, 16, 12, 'door');
      b.box(0.5, 12, 0.5, 16, 20, 1.5, M.gloss(0x17181B)); b.box(2, 13.5, 0.5, 14.5, 18, 1, M.glass(0x3A4652)); b.box(2.5, 14, 1, 14, 17.5, 1.5, M.light(0x5A3A1E)); b.box(2, 18.5, 0, 14.5, 19, 0.5, M.metal(P.steel)); b.box(11, 19, 0, 13, 19.5, 0.5, M.light(0x5CC8F0));   // the oven
      b.box(0.5, 20, 0.5, 16, 24.5, 1.5, M.gloss(0x17181B)); b.box(2, 21, 0.5, 12, 23.5, 1, M.glass(0x3A4652)); b.box(13, 22, 0, 14.5, 23, 0.5, M.light(0x5CC8F0));   // a steam oven
      kfront(b, st, 0, 24.5, 16, 31.5, 'door'); }],
    ['wall', 'wall cabinet', [1, 1, 1], (b, st) => { b.box(0, 6, 10, 16, 16, 16, M.matte(sh(st.front, 0.9))); b.box(0.5, 6.5, 9, 16, 16, 10, M.matte(st.front));
      if (st.handle === 'bar') b.box(5, 6.5, 8.5, 11, 7, 9, st.hw()); else if (st.handle === 'knob') b.cyl('z', 14, 7.5, 0.5, 8.5, 9, st.hw()); else b.box(0.5, 6, 9.5, 16, 6.5, 10, st.hw());
      b.box(1, 5.5, 10.5, 15, 6, 15.5, M.light(0xFFE2B0)); }],
  ];
  for (const [k, st] of Object.entries(KSTYLE)) for (const [u, label, size, build] of KUNITS) {
    def('kitchen', k, u, 'Kitchen ' + st.label + ' · ' + label, { res: 32, size, col: k, cats: ['kitchen', 'storage'], ui: 'chest', mount: u === 'wall' ? 'wall' : 'floor', sound: 'wood', hard: 1, build: (b) => build(b, st) });
  }
  // a counter-height island with a waterfall terrazzo top, oak fronts on the working side
  def('kitchen', 'island', 'terrazzo', 'Kitchen Island · terrazzo', { res: 32, size: [2, 2, 1], skip: [[0, 1, 0]], col: 'cream', cats: ['kitchen', 'table'], ui: 'chest', sound: 'stone', hard: 1.2, build: (b) => {
    const tz = M.stone(0xE6E0D6);
    b.box(1.5, 0, 2.5, 30.5, 1.5, 13.5, M.matte(DARK)); b.box(1, 1.5, 2, 31, 14, 14, M.wood(P.oak));
    for (let x = 1; x < 31; x += 1) if (x % 2) b.recolor(x, 2, 1.5, x + 0.5, 14, 2.5, M.wood(sh(P.oak, 0.88)));          // fluted oak
    b.box(0, 14, 0, 32, 15, 16, tz); b.box(0, 0, 0, 1, 14, 16, tz); b.box(31, 0, 0, 32, 14, 16, tz);                  // waterfall top
    for (let k = 0; k < 40; k++) { const x = (k * 7.3) % 31 + 0.5, z = (k * 5.1) % 15 + 0.5; b.box(x, 14.5, z, x + 0.5, 15, z + 0.5, M.stone([0x9A8C7E, 0xB9664B, 0x6E7451, 0x41454B][k % 4])); }   // terrazzo chips
    b.lathe(23, 9, [[15, 2.6], [16, 3.4], [17, 3.6], [17.5, 3.4]], M.gloss(P.white), 0.5); for (const [x, z, c] of [[22, 8.5, 0xE8B83A], [24, 9.5, 0x8AA05A], [23, 10, 0xC8442A]]) b.sphere(x, 17, z, 0.9, M.gloss(c));
  } });
  // appliances on the worktop (they stand at the bottom of their block — on a counter, a shelf or the floor)
  const AP = { cats: ['kitchen'], res: 32, size: [1, 1, 1], sound: 'metal', hard: 0.8 };
  def('kitchen', 'espresso', 'steel', 'Espresso Machine · steel', Object.assign({}, AP, { col: 'steel', build: (b) => {
    const s = M.metal(P.steel);
    b.pbox(3.5, 0, 6, 12.5, 7.5, 13, 0.5, s); b.box(3.5, 7.5, 6, 12.5, 8, 13, M.metal(sh(P.steel, 0.9)));
    b.box(4.5, 0, 3.5, 11.5, 0.5, 6, M.metal(0x6A7078)); b.box(5, 0.5, 4, 11, 1, 5.5, M.metal(0x4A4E54));                 // drip tray
    b.cyl('y', 8, 5.5, 1.1, 4, 5.5, M.chrome()); b.cyl('y', 8, 5.5, 0.9, 3.5, 4, M.chrome()); b.rod(8, 3.75, 5.5, 8, 3.75, 2, 0.5, M.matte(P.black));   // group head, portafilter
    b.cyl('z', 6, 6.5, 0.9, 5.5, 6, M.chrome()); b.cyl('z', 6, 6.5, 0.6, 5, 5.5, M.gloss(0xF4F0E8));               // pressure gauge
    b.rod(11.5, 6, 6, 11.5, 3, 5, 0.5, M.chrome()); b.box(11, 6, 5.5, 12, 6.5, 6, M.matte(P.black));               // steam wand
    b.lathe(6.5, 9, [[8, 0.8], [9.5, 1]], M.gloss(P.white)); b.lathe(9, 9.5, [[8, 0.8], [9.5, 1]], M.gloss(P.white));    // cups warming on top
    b.lathe(8, 4.75, [[0.5, 0.7], [1.5, 0.8]], M.gloss(P.white));
  } }));
  def('kitchen', 'kettle', 'white', 'Kettle · white', Object.assign({}, AP, { col: 'white', build: (b) => {
    b.cyl('y', 8, 8, 2.2, 0, 0.5, M.gloss(P.black)); b.lathe(8, 8, [[0.5, 2.1], [3, 2.1], [4.5, 1.6], [5, 1]], M.gloss(P.white));
    b.cyl('y', 8, 8, 0.6, 5, 5.5, M.gloss(P.black)); b.rod(10, 1.5, 8, 11.5, 2.5, 8, 0.5, M.gloss(P.white)); b.rod(11.5, 2.5, 8, 11.5, 4.5, 8, 0.5, M.gloss(P.white)); b.rod(11.5, 4.5, 8, 9.5, 5, 8, 0.5, M.gloss(P.white));
    b.rod(6, 3, 8, 4.5, 4.5, 8, 0.5, M.gloss(P.white));
  } }));
  def('kitchen', 'toaster', 'cream', 'Toaster · cream', Object.assign({}, AP, { col: 'cream', build: (b) => {
    b.rbox(4.5, 0, 6, 11.5, 4.5, 10, 1, M.gloss(0xEDE3CC)); b.cut(5.5, 3.5, 7, 10.5, 4.5, 7.5); b.cut(5.5, 3.5, 8.5, 10.5, 4.5, 9);
    b.box(5.5, 3, 7, 10.5, 5, 7.5, M.matte(0xC89A5A)); b.box(5.5, 3, 8.5, 10.5, 4.5, 9, M.matte(0xB0824A));                   // toast
    b.box(11.5, 2, 7.5, 12, 2.5, 8.5, M.chrome()); b.box(4.5, 0, 6, 11.5, 0.5, 10, M.chrome());
  } }));
  def('kitchen', 'microwave', 'black', 'Microwave · black', Object.assign({}, AP, { col: 'black', build: (b) => {
    b.pbox(3, 0, 5, 13, 5.5, 13, 0.5, M.gloss(P.black)); b.box(3.5, 0.5, 4.5, 10.5, 5, 5, M.glass(0x2A323C)); b.box(4, 1, 5, 10, 4.5, 5.5, M.light(0x3A2A18));
    b.box(11, 3.5, 4.5, 12.5, 4.5, 5, M.light(0x5CC8F0)); for (const y of [1.5, 2.5]) b.box(11.25, y, 4.5, 12.25, y + 0.5, 5, M.matte(0x3A3D44)); b.box(10, 1, 4, 10.5, 4.5, 4.5, M.chrome());
  } }));
  def('kitchen', 'mixer', 'red', 'Stand Mixer · red', Object.assign({}, AP, { col: 'rust', build: (b) => {
    const r = M.gloss(0xB8322A);
    b.pbox(4, 0, 6, 12, 1.5, 12, 1, r); b.pbox(9, 1.5, 7.5, 12, 6.5, 10.5, 1, r); b.pbox(3.5, 6.5, 7, 12.5, 9, 11, 1.5, r); b.box(4, 9, 7.5, 12, 9.5, 10.5, r);
    b.lathe(6.5, 9, [[1.5, 1.5], [2, 2.5], [4.5, 2.5], [5, 2.5]], M.metal(P.steel), 0.5); b.box(6, 3, 8.5, 7, 6.5, 9.5, M.chrome());
    b.box(12, 7, 8.5, 12.5, 8, 9.5, M.chrome());
  } }));
  def('kitchen', 'winecooler', 'black', 'Wine Cooler · under counter', Object.assign({}, AP, { col: 'black', light: [4, 3, 2], ui: undefined, build: (b) => {
    plinth(b, 0, 16); b.box(0, 1.5, 1.5, 16, 14, 16, M.matte(DARK)); b.box(0, 14, 0, 16, 15, 16, M.stone(0x3A3C40));
    b.cut(1.5, 2.5, 1.5, 14.5, 13, 15); b.box(1.5, 2.5, 14.5, 14.5, 13, 15, M.light(0x6A4A2E));                    // the lit back
    for (let y = 3; y < 12; y += 3) {                                                             // three racks of bottles, seen end-on
      b.box(1.5, y - 0.5, 2.5, 14.5, y, 14.5, M.wood(P.oak)); b.box(2, y, 5, 14, y + 2, 12, M.gloss(0x1E2A1E));
      let k = 0; for (let x = 2.5; x < 13.5; x += 2.25) b.box(x, y + 0.25, 4, x + 1.5, y + 1.75, 5, M.gloss(k++ % 2 ? 0x2E4A2A : 0x6A2028));
    }
    b.box(0.5, 1.5, 0.5, 16, 14, 1.5, M.metal(P.black)); b.cut(1.5, 2.5, 0.5, 14.5, 13, 1.5); b.box(1.5, 2.5, 1, 14.5, 13, 1.5, M.glass(0x6A7480));   // framed glass door
    b.box(12.5, 4, 0, 13, 11.5, 0.5, M.metal(P.steel));
  } }));
  def('kitchen', 'fridge', 'french', 'Fridge French Door · steel', Object.assign({}, AP, { size: [1, 2, 1], col: 'steel', ui: 'chest', build: (b) => {
    const s = M.metal(P.steel), g = M.metal(0x8E949A);
    b.box(0.5, 0.5, 3, 15.5, 30, 16, M.metal(sh(P.steel, 0.9))); b.box(1, 0, 3.5, 15, 0.5, 15.5, M.matte(DARK));
    b.box(0.5, 10, 2, 8, 30, 3, s); b.box(8, 10, 2, 15.5, 30, 3, s); b.box(7.75, 10, 1.5, 8.25, 30, 3, g);              // two doors
    b.box(0.5, 0.5, 2, 15.5, 9.5, 3, s); b.box(0.5, 9.5, 2.5, 15.5, 10, 3, g);                                        // freezer drawer
    b.rod(7, 14, 1.5, 7, 26, 1.5, 0.5, M.chrome()); b.rod(9, 14, 1.5, 9, 26, 1.5, 0.5, M.chrome()); b.rod(4, 8, 1.5, 12, 8, 1.5, 0.5, M.chrome());   // handles
    b.box(2, 18, 1.5, 6, 23.5, 2, M.gloss(0x17181B)); b.box(3, 21.5, 1, 5, 23, 1.5, M.light(0x5CC8F0)); b.box(3.5, 18.5, 1.5, 4.5, 20, 2, M.matte(0x3A3D44));   // water & ice
  } }));
  def('kitchen', 'coffeebar', 'oak', 'Coffee Bar · oak', Object.assign({}, AP, { size: [2, 2, 1], col: 'oak', ui: 'chest', light: [6, 5, 3], build: (b) => {
    const o = M.wood(P.oak), od = M.wood(sh(P.oak, 0.86));
    plinth(b, 0, 32); b.box(0, 1.5, 1.5, 32, 14, 16, od);
    for (const x0 of [0, 16]) { b.box(x0 + 0.5, 2, 0.5, x0 + 16, 14, 1.5, o); for (let x = x0 + 1.5; x < x0 + 15.5; x += 1) b.recolor(x, 2, 0.5, x + 0.5, 14, 1, od); b.box(x0 + 13, 7, 0, x0 + 13.5, 10, 0.5, M.metal(P.black)); }   // fluted doors
    b.box(0, 14, 0, 32, 15, 16, M.stone(0xE6E0D6)); b.box(0, 15, 15, 32, 31, 16, M.wood(sh(P.oak, 0.92)));                      // top, back panel
    for (const y of [21, 27]) { b.box(1, y, 9, 31, y + 0.5, 16, o); b.box(1.5, y - 0.5, 15, 30.5, y, 15.5, M.light(0xFFE2B0)); }      // shelves with LED
    for (let k = 0; k < 6; k++) { const x = 3 + k * 4.5; b.lathe(x, 12.5, [[21.5, 1.1], [23.5, 1.2]], M.gloss([P.white, P.sage, P.terracotta][k % 3])); }   // mugs
    for (let k = 0; k < 4; k++) { const x = 4 + k * 7; b.lathe(x, 12.5, [[27.5, 1.4], [31, 1.4]], M.glass(0xE8E0D0), 0.4); b.cyl('y', x, 12.5, 1.1, 27.5, 29.5, M.matte([0x5A3A22, 0xD8C8A8, 0x3A2416, 0xC8A060][k])); }   // jars
    // the espresso machine and a grinder on the counter
    b.pbox(4, 15, 7, 13, 22, 13.5, 0.5, M.metal(P.steel)); b.cyl('y', 8.5, 6, 1, 18.5, 20, M.chrome()); b.rod(8.5, 18.5, 6, 8.5, 18.5, 3, 0.5, M.matte(P.black)); b.box(5, 15, 4, 12, 15.5, 7, M.metal(0x6A7078));
    b.cyl('y', 18, 10, 1.6, 15, 20, M.matte(P.black)); b.lathe(18, 10, [[20, 1.2], [21, 2], [23, 2]], M.glass(0xC8B8A0), 0.3);
    b.rbox(22, 15, 6, 29, 15.5, 12, 0.25, M.wood(P.walnut)); for (const [x, z] of [[24, 8], [27, 9.5]]) b.lathe(x, z, [[15.5, 1], [17, 1.1]], M.gloss(P.white));
  } }));
  def('kitchen', 'hood', 'island', 'Island Hood · black', Object.assign({}, AP, { col: 'black', mount: 'ceiling', toggle: true, light: [11, 10, 8], build: (b) => {
    for (const [x, z] of [[4, 4], [12, 4], [4, 12], [12, 12]]) b.box(x - 0.25, 10, z - 0.25, x + 0.25, 16, z + 0.25, M.metal(P.black));
    b.pbox(2, 7, 2, 14, 10, 14, 0.5, M.metal(P.black)); b.box(2.5, 6.5, 2.5, 13.5, 7, 13.5, M.metal(0x4A4E54));
    for (const x of [5, 11]) b.box(x - 1, 6.5, 7, x + 1, 7, 9, M.light(0xFFF0D4));
  } }));
  for (const [k, seat, frame] of [['oak', M.leather(0x8A5A3A), M.wood(P.oak)], ['black', M.fabric(P.cream), M.metal(P.black)]]) def('kitchen', 'stool', k, 'Counter Stool · ' + k, Object.assign({}, AP, { col: k === 'oak' ? 'oak' : 'black', seat: true, sound: 'wood', build: (b) => {
    for (const [x, z] of [[4, 4], [11, 4], [4, 11], [11, 11]]) b.box(x, 0, z, x + 1, 10, z + 1, frame);
    b.box(4, 3.5, 4, 12, 4, 5, frame); b.box(4, 3.5, 11, 12, 4, 12, frame); b.box(4, 3.5, 5, 5, 4, 11, frame); b.box(11, 3.5, 5, 12, 4, 11, frame);   // footrest ring
    b.box(4, 9.5, 4, 12, 10, 12, frame);
    b.pbox(3.5, 10, 3.5, 12.5, 11.5, 12.5, 1, seat); b.pbox(4, 11.5, 11, 12, 14, 12.5, 0.5, seat); b.box(4.5, 11.5, 11.5, 5, 12, 12, frame); b.box(11, 11.5, 11.5, 11.5, 12, 12, frame);
  } }));

  // ================================================================ WOHNEN — sofas, the modular sofa, poufs, lounge chairs, media walls
  const FABRIC = {
    boucle: { label: 'bouclé', mat: (c) => M.fabric(c), col: 0xEDE6D8, reg: 'cream' },
    olive: { label: 'olive velvet', mat: (c) => M.velvet(c), col: 0x6E7451, reg: 'olive' },
    stone: { label: 'stone linen', mat: (c) => M.fabric(c), col: 0xB9B4AA, reg: 'stone' },
    cognac: { label: 'cognac leather', mat: (c) => M.leather(c), col: 0x9A5A32, reg: 'rust' },
    sage: { label: 'sage', mat: (c) => M.fabric(c), col: 0x97A88F, reg: 'sage' },
    graphite: { label: 'graphite', mat: (c) => M.fabric(c), col: 0x4A4D53, reg: 'graphite' },
    terracotta: { label: 'terracotta velvet', mat: (c) => M.velvet(c), col: 0xB9664B, reg: 'terracotta' },
  };
  const pillows = [0xCF9F3A, 0x253350, 0xB9664B, 0x97A88F, 0xE8E2D4];
  // the cloud sofa: everything soft and rounded, sitting low on a hidden plinth
  function cloudSofa(b, W, fb) {
    const f = fb.mat(fb.col), fd = fb.mat(sh(fb.col, 0.93));
    b.box(1.5, 0, 2, W - 1.5, 0.5, 13, M.matte(DARK));
    b.rbox(0, 0.5, 0, W, 5, 15, 1.5, fd); b.rbox(0, 0.5, 10.5, W, 13, 15, 2, fd);
    b.rbox(0, 0.5, 0, 4, 10, 15, 2, fd); b.rbox(W - 4, 0.5, 0, W, 10, 15, 2, fd);
    const n = Math.max(1, Math.round((W - 8) / 13)), w = (W - 8) / n;
    for (let k = 0; k < n; k++) { const x0 = 4 + k * w, x1 = x0 + w; b.rbox(x0 + 0.25, 4.5, 0.5, x1 - 0.25, 7.5, 11.5, 1.5, f); b.rbox(x0 + 0.25, 7, 8.5, x1 - 0.25, 14, 12, 2, f); }
  }
  // the tailored sofa: slim arms, tight cushions with piping, on slim legs
  function tailoredSofa(b, W, fb, leg) {
    const f = fb.mat(fb.col), fd = fb.mat(sh(fb.col, 0.9));
    const xs = W > 40 ? [2.5, W / 2, W - 2.5] : [2.5, W - 2.5];
    for (const x of xs) for (const z of [2.5, 12.5]) b.box(x - 0.5, 0, z - 0.5, x + 0.5, 2.5, z + 0.5, leg);
    b.pbox(0, 2.5, 0.5, W, 4.5, 15, 0.5, fd); b.pbox(0, 2.5, 12.5, W, 13, 15, 0.5, fd);
    b.pbox(0, 2.5, 0.5, 2, 10, 15, 0.5, fd); b.pbox(W - 2, 2.5, 0.5, W, 10, 15, 0.5, fd);
    const n = Math.max(1, Math.round((W - 4) / 14)), w = (W - 4) / n;
    for (let k = 0; k < n; k++) { const x0 = 2 + k * w, x1 = x0 + w; b.cushion(x0 + 0.25, 4.5, 1, x1 - 0.25, 7.5, 12.5, 0.75, f, true); b.cushion(x0 + 0.25, 7, 9.5, x1 - 0.25, 14, 12.5, 1, f, true); }
  }
  const throwP = (b, cx, z, w, c) => b.extrude([[cx - w / 2, 7.5], [cx - w / 2 + 0.5, 7.5 + w], [cx + w / 2 - 0.5, 7.5 + w], [cx + w / 2, 7.5]], 'z', z, z + 2, M.fabric(c));
  const LIV = { cats: ['living', 'seat'], res: 32, sound: 'wool', hard: 0.6, seat: true };
  for (const [k, style] of [['boucle', 'cloud'], ['olive', 'tailored'], ['stone', 'tailored'], ['cognac', 'tailored']]) {
    const fb = FABRIC[k];
    def('living', 'sofa2', k, 'Sofa 2-Seater · ' + fb.label, Object.assign({}, LIV, { size: [2, 1, 1], col: fb.reg, build: (b) => { if (style === 'cloud') cloudSofa(b, 32, fb); else tailoredSofa(b, 32, fb, k === 'cognac' ? M.metal(P.black) : M.wood(P.oak)); throwP(b, 9, 8, 5, pillows[(k.length) % 5]); } }));
  }
  for (const [k, style] of [['boucle', 'cloud'], ['terracotta', 'cloud'], ['sage', 'tailored'], ['graphite', 'tailored']]) {
    const fb = FABRIC[k];
    def('living', 'sofa3', k, 'Sofa 3-Seater · ' + fb.label, Object.assign({}, LIV, { size: [3, 1, 1], col: fb.reg, build: (b) => { if (style === 'cloud') cloudSofa(b, 48, fb); else tailoredSofa(b, 48, fb, M.metal(P.black)); throwP(b, 10, 8, 5.5, pillows[k.length % 5]); throwP(b, 38, 8, 5.5, pillows[(k.length + 2) % 5]); } }));
  }
  // the modular sofa: corner, middle, left and right arm, ottoman — put them together in any shape
  const MOD = [
    ['middle', 'middle', (b, f, fd) => { b.rbox(0, 0.5, 11, 16, 13, 15, 2, fd); b.rbox(0.25, 7, 8.5, 15.75, 14, 12, 2, f); }],
    ['corner', 'corner', (b, f, fd) => { b.rbox(0, 0.5, 11, 16, 13, 15, 2, fd); b.rbox(0, 0.5, 0, 4.5, 13, 15, 2, fd); b.rbox(0.25, 7, 8.5, 15.75, 14, 12, 2, f); b.rbox(3.5, 7, 0.25, 7, 14, 11.5, 2, f); }],
    ['armleft', 'left arm', (b, f, fd) => { b.rbox(0, 0.5, 11, 16, 13, 15, 2, fd); b.rbox(0, 0.5, 0, 4, 10, 15, 2, fd); b.rbox(0.25, 7, 8.5, 15.75, 14, 12, 2, f); }],
    ['armright', 'right arm', (b, f, fd) => { b.rbox(0, 0.5, 11, 16, 13, 15, 2, fd); b.rbox(12, 0.5, 0, 16, 10, 15, 2, fd); b.rbox(0.25, 7, 8.5, 15.75, 14, 12, 2, f); }],
    ['ottoman', 'ottoman', () => {}],
  ];
  for (const k of ['boucle', 'graphite']) for (const [id, label, extra] of MOD) {
    const fb = FABRIC[k];
    def('living', 'modular', id + '_' + k, 'Modular Sofa ' + (k === 'boucle' ? 'Bouclé' : 'Graphite') + ' · ' + label, Object.assign({}, LIV, { size: [1, 1, 1], col: fb.reg, build: (b) => {
      const f = fb.mat(fb.col), fd = fb.mat(sh(fb.col, 0.93));
      b.box(1.5, 0, 1.5, 14.5, 0.5, 14.5, M.matte(DARK)); b.rbox(0, 0.5, 0, 16, 5, 15, 1.5, fd);
      b.rbox(id === 'armleft' || id === 'corner' ? 3.5 : 0.25, 4.5, 0.5, id === 'armright' ? 12.5 : 15.75, 7.5, id === 'ottoman' ? 14.5 : 11.5, 1.5, f);
      extra(b, f, fd);
    } }));
  }
  // poufs
  def('living', 'pouf', 'boucle', 'Pouf · bouclé', Object.assign({}, LIV, { size: [1, 1, 1], col: 'cream', build: (b) => { b.lathe(8, 8, [[0, 3.6], [0.5, 4.2], [6, 4.4], [7, 3.8], [7.5, 2.5]], M.fabric(FABRIC.boucle.col)); } }));
  def('living', 'pouf', 'leather', 'Pouf · leather cube', Object.assign({}, LIV, { size: [1, 1, 1], col: 'rust', build: (b) => { b.cushion(4, 0, 4, 12, 7, 12, 1, M.leather(FABRIC.cognac.col), true); } }));
  def('living', 'pouf', 'knit', 'Pouf · chunky knit', Object.assign({}, LIV, { res: 16, size: [1, 1, 1], col: 'mustard', build: (b) => {
    b.lathe(8, 8, [[0, 3.8], [0.5, 4.3], [5.5, 4.4], [6.5, 3.6], [7, 2]], M.fabric(P.mustard));
    for (const y of [2, 4]) b.recolor(0, y, 0, 16, y + 1, 16, M.fabric(sh(P.mustard, 0.86)));
  } }));
  // lounge chairs
  def('living', 'lounge', 'shell', 'Lounge Chair · walnut shell', Object.assign({}, LIV, { size: [1, 1, 1], col: 'walnut', sound: 'wood', build: (b) => {
    const wd = M.wood(P.walnut), le = M.leather(0x1E1F22), m = M.metal(P.black);
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; b.rod(8, 0.5, 8, 8 + Math.cos(a) * 6, 0.5, 8 + Math.sin(a) * 6, 0.5, m); }
    b.cyl('y', 8, 8, 0.8, 0.5, 4, m);
    b.extrude([[2, 4], [12, 3.5], [12.5, 4.5], [2.5, 5.5]], 'x', 2, 14, wd);                           // seat shell (z, y)
    b.extrude([[11.5, 4], [12.5, 3.5], [15.5, 14.5], [14.5, 15]], 'x', 2, 14, wd);                     // back shell
    b.cushion(2.5, 5, 2, 13.5, 7, 12, 0.8, le, true); b.extrude([[10.5, 6], [12.5, 5.5], [14.5, 14], [12.5, 14.5]], 'x', 2.5, 13.5, le);
    b.box(1, 8.5, 3, 2.5, 9.5, 11, wd); b.box(13.5, 8.5, 3, 15, 9.5, 11, wd); b.box(1.5, 5, 10, 2.5, 8.5, 11, wd); b.box(13.5, 5, 10, 14.5, 8.5, 11, wd);
  } }));
  def('living', 'lounge', 'cocktail', 'Cocktail Chair · bouclé', Object.assign({}, LIV, { size: [1, 1, 1], col: 'cream', build: (b) => {
    const f = M.fabric(FABRIC.boucle.col), fd = M.fabric(sh(FABRIC.boucle.col, 0.93));
    b.cyl('y', 8, 8, 4.5, 0, 0.5, M.metal(P.brass));
    b.cyl('y', 8, 8, 6.4, 0.5, 5, fd);
    b.tube('y', 8, 8, 6.4, 2, 5, 12, fd); b.cut(0, 5, 0, 16, 16, 8);
    b.rbox(2.5, 4.5, 2, 13.5, 7.5, 12.5, 2, f);
  } }));
  def('living', 'lounge', 'cane', 'Lounge Chair · oak & cane', Object.assign({}, LIV, { size: [1, 1, 1], col: 'oak', sound: 'wood', build: (b) => {
    const o = M.wood(P.oak), cane = M.wood(0xD9C08A);
    for (const x of [1.5, 13.5]) { b.box(x, 0, 1.5, x + 1, 9, 2.5, o); b.box(x, 0, 12.5, x + 1, 9, 13.5, o); b.box(x, 8.5, 1, x + 1, 9.5, 14, o); b.box(x, 2, 2.5, x + 1, 3, 12.5, o); b.box(x + (x < 8 ? 0.25 : 0), 3, 2.5, x + 0.75, 8.5, 12.5, cane); }
    b.box(2.5, 3, 2, 13.5, 4, 13, o); b.beam(13, 3.5, 15.5, 15, 2.5, 13.5, 1, o);
    b.extrude([[12.5, 4], [13.5, 4], [15.5, 15], [14.5, 15]], 'x', 2.5, 13.5, cane);
    b.cushion(2.5, 4, 2, 13.5, 6.5, 12.5, 1, M.fabric(0xEDE6D8), true); b.extrude([[11, 6], [12.5, 6], [14.5, 14], [13, 14]], 'x', 3, 13, M.fabric(0xEDE6D8));
  } }));
  // the lit media walls (the LEDs and the screen switch off together)
  function mediaTV(b, x0, y0, x1, y1) {
    b.box(x0 - 0.5, y0 - 0.5, 15.5, x1 + 0.5, y1 + 0.5, 16, M.light(0xD8E8FF));                          // the LED halo behind
    b.box(x0, y0, 14.5, x1, y1, 15.5, M.gloss(0x111214));
    const sky = (y) => (y < y0 + (y1 - y0) * 0.55 ? 0x1E3A5A : 0x2E5A88);
    for (let y = y0 + 0.5; y < y1 - 0.5; y += 0.5) b.box(x0 + 0.5, y, 14, x1 - 0.5, y + 0.5, 14.5, M.light(sky(y)));
    b.extrude([[x0 + 0.5, y0 + 4], [x0 + 6, y0 + 8], [x0 + 11, y0 + 5], [x0 + 18, y0 + 9.5], [x0 + 24, y0 + 6], [x1 - 0.5, y0 + 8], [x1 - 0.5, y0 + 0.5], [x0 + 0.5, y0 + 0.5]], 'z', 13.5, 14, M.light(0x1E3A2A));
  }
  def('living', 'mediawall', 'oak', 'Media Wall · oak slats', Object.assign({}, LIV, { cats: ['living'], seat: false, mount: 'wall', size: [3, 2, 1], col: 'oak', sound: 'wood', toggle: true, light: [6, 7, 9], ui: undefined, build: (b) => {
    for (let x = 0; x < 48; x += 2) b.box(x, 0, 15, x + 1.5, 32, 16, M.wood(P.oak));
    b.box(0, 0, 15.5, 48, 32, 16, M.wood(sh(P.oak, 0.7)));
    b.box(2, 3, 9, 46, 7.5, 15, M.wood(P.walnut)); for (const x of [2, 13, 24, 35]) b.box(x + 0.5, 3.5, 8.5, x + 11, 7, 9, M.wood(sh(P.walnut, 0.9)));
    b.box(2.5, 2.5, 9.5, 45.5, 3, 14.5, M.light(0xFFE2B0));                                             // LED under the lowboard
    mediaTV(b, 9, 13, 39, 29);
    b.lathe(5, 12, [[7.5, 1.4], [9, 2], [11.5, 1.4], [12.5, 1.6]], M.gloss(P.white), 0.5); b.sphere(42, 9, 12, 1.5, M.gloss(P.terracotta)); b.box(30, 7.5, 10, 36, 8.5, 14, M.gloss(0x1E2024));
  } }));
  def('living', 'mediawall', 'fireplace', 'Media Wall · fireplace', Object.assign({}, LIV, { cats: ['living'], seat: false, mount: 'wall', size: [3, 2, 1], col: 'sand', sound: 'stone', toggle: true, light: [12, 7, 3], ui: undefined, build: (b) => {
    const st = M.stone(0xD6C6A8);
    b.box(0, 0, 9, 48, 32, 16, st); for (let y = 4; y < 32; y += 4) b.recolor(0, y, 8.5, 48, y + 0.5, 9.5, M.stone(sh(0xD6C6A8, 0.9)));
    b.cut(10, 2, 9, 38, 8, 13.5); b.box(10, 2, 13, 38, 8, 13.5, M.gloss(0x141518)); b.box(10, 2, 9, 38, 2.5, 13, M.gloss(0x141518));   // the fireplace opening
    for (let k = 0; k < 12; k++) { const x = 11 + k * 2.25, h = 2.5 + ((k * 7) % 5) * 0.6; b.extrude([[x, 2.5], [x + 2.25, 2.5], [x + 1.5, 2.5 + h], [x + 0.75, 2.5 + h * 0.7]], 'z', 10.5, 12, M.light(k % 2 ? 0xFF8A2A : 0xFFB84A)); }
    b.box(10, 2, 9, 38, 8, 9.5, M.glass(0xD8C8B8));
    b.cut(2, 12, 9, 7, 30, 13); b.cut(41, 12, 9, 46, 30, 13); for (const x0 of [2, 41]) for (const y of [17.5, 23.5]) b.box(x0, y, 9, x0 + 5, y + 0.5, 13, M.wood(P.walnut));   // niches with shelves
    b.lathe(4.5, 11, [[12, 1.2], [14.5, 1.6], [16.5, 1]], M.gloss(P.terracotta)); b.lathe(43.5, 11, [[18, 1.4], [21, 1.2]], M.gloss(P.white));
    b.box(2.5, 29.5, 9.5, 6.5, 30, 12.5, M.light(0xFFE2B0)); b.box(41.5, 29.5, 9.5, 45.5, 30, 12.5, M.light(0xFFE2B0));
    b.cut(9, 12, 9, 39, 30, 14); b.box(9, 12, 14, 39, 30, 16, st); mediaTV(b, 10, 13, 38, 29);
  } }));
  // tables, rugs and a wall shelf
  const TB = { cats: ['living', 'table'], res: 32, sound: 'stone', hard: 0.8 };
  def('living', 'coffeetable', 'travertine', 'Coffee Table · travertine', Object.assign({}, TB, { size: [1, 1, 1], col: 'sand', build: (b) => {
    const t = M.stone(0xD9CBB0); b.cyl('y', 8, 8, 4.5, 0, 5.5, t); b.cyl('y', 8, 8, 7.5, 5.5, 7, t);
    for (let k = 0; k < 5; k++) { const a = k * 2.4, r = 2 + (k % 4) * 1.2; b.box(8 + Math.cos(a) * r, 6.5, 8 + Math.sin(a) * r, 9 + Math.cos(a) * r, 7, 8.5 + Math.sin(a) * r, M.stone(0xC2B394)); }   // travertine pores
    b.lathe(5.5, 9, [[7, 1.4], [9, 1.8], [10.5, 1.2]], M.gloss(P.forest), 0.5); b.box(9, 7, 6, 13, 7.5, 9, M.matte(0xE8E2D4)); b.box(9.5, 7.5, 6.5, 12.5, 8, 8.5, M.matte(0x2A2D33));
  } }));
  def('living', 'coffeetable', 'walnut', 'Coffee Table · walnut oval', Object.assign({}, TB, { size: [2, 1, 1], col: 'walnut', sound: 'wood', build: (b) => {
    const w = M.wood(P.walnut);
    ellRingFill(b, 16, 8, 14, 6.5, 5.5, 6.5, w); b.box(6, 0, 6, 9, 5.5, 10, w); b.box(23, 0, 6, 26, 5.5, 10, w);
    b.lathe(20, 8, [[6.5, 1.6], [7.5, 2.2], [9, 1.2]], M.gloss(P.white), 0.4); b.rbox(9, 6.5, 6, 15, 7.5, 10, 0.4, M.wood(P.oak));
  } }));
  def('living', 'nesting', 'brass', 'Nesting Tables · brass', Object.assign({}, TB, { size: [1, 1, 1], col: 'brass', build: (b) => {
    const br = M.metal(P.brass);
    for (const [cx, cz, r, h, top] of [[6, 6, 4.5, 8, 0xEAEAEC], [10.5, 10.5, 4, 6, 0x2A2C30]]) { b.cyl('y', cx, cz, r, h - 1, h, M.marble(top)); for (let k = 0; k < 3; k++) { const a = k * 2.1 + 0.4; b.box(cx + Math.cos(a) * (r - 1) - 0.25, 0, cz + Math.sin(a) * (r - 1) - 0.25, cx + Math.cos(a) * (r - 1) + 0.25, h - 1, cz + Math.sin(a) * (r - 1) + 0.25, br); } }
  } }));
  def('living', 'rug', 'stripe', 'Rug · striped wool', Object.assign({}, TB, { cats: ['living', 'deco'], res: 16, size: [2, 1, 3], col: 'cream', sound: 'wool', hard: 0.2, solid: false, build: (b) => {
    b.box(0, 0, 0, 32, 1, 48, M.fabric(0xE8E2D4)); b.recolor(1, 0, 1, 31, 1, 2, M.fabric(0x2B2E33)); b.recolor(1, 0, 46, 31, 1, 47, M.fabric(0x2B2E33)); b.recolor(1, 0, 1, 2, 1, 47, M.fabric(0x2B2E33)); b.recolor(30, 0, 1, 31, 1, 47, M.fabric(0x2B2E33));
    for (const z of [10, 13, 33, 36]) b.recolor(4, 0, z, 28, 1, z + 1, M.fabric(0x9A8C7E));
  } }));
  def('living', 'rug', 'round', 'Rug · round sage', Object.assign({}, TB, { cats: ['living', 'deco'], res: 16, size: [2, 1, 2], col: 'sage', sound: 'wool', hard: 0.2, solid: false, build: (b) => {
    b.cyl('y', 16, 16, 15.5, 0, 1, M.fabric(P.sage)); b.tube('y', 16, 16, 15.5, 1, 0, 1, M.fabric(sh(P.sage, 0.8))); b.tube('y', 16, 16, 10, 1, 0, 1, M.fabric(0xE8E2D4));
  } }));
  def('living', 'shelf', 'oak', 'Wall Shelf System · oak', Object.assign({}, TB, { cats: ['living', 'storage'], mount: 'wall', size: [2, 2, 1], col: 'oak', sound: 'wood', build: (b) => {
    const o = M.wood(P.oak), m = M.metal(P.black);
    for (const x of [2, 15.5, 29]) b.box(x, 2, 15, x + 1, 31, 16, m);
    for (const y of [6, 13, 20, 27]) b.box(1, y, 9.5, 31, y + 1, 15, o);
    books(b, 3, 7, 10.5, 4); books(b, 18, 21, 10.5, 5);
    b.lathe(22, 12, [[7, 1.4], [9.5, 1.9], [11, 1.2]], M.gloss(P.terracotta), 0.5); b.lathe(6, 12, [[14, 1.8], [16, 2.2], [17.5, 2]], M.gloss(P.white), 0.5); b.sphere(6, 19, 12, 2.2, M.plant(P.leaf));
    b.box(20, 14, 13, 28, 19.5, 14, M.gloss(P.black)); b.box(20.5, 14.5, 12.5, 27.5, 19, 13, M.matte(0xD8C8A0));     // a framed print
    b.lathe(10, 12, [[28, 1.2], [30, 1.6], [31.5, 1]], M.gloss(P.sage), 0.4); b.lathe(26, 12, [[28, 1.6], [29, 2]], M.wood(P.walnut), 0.5);
  } }));

  // ================================================================ SCHLAFEN — boxspring and LED beds, wardrobes, vanities, benches
  const SL = { cats: ['sleep'], res: 32, sound: 'wool', hard: 0.6 };
  // bedding on a mattress top at y (the head at +z): a duvet folded back, two big pillows and two small ones
  function bedding(b, x0, x1, y, duvet, pil) {
    b.cushion(x0 + 0.5, y - 0.5, 0, x1 - 0.5, y + 1.5, 21, 1, M.fabric(duvet), true);
    b.cushion(x0 + 1, y + 0.5, 1, x1 - 1, y + 2, 7, 0.75, M.fabric(sh(duvet, 0.92)), false);
    const w = (x1 - x0 - 3) / 2;
    for (let k = 0; k < 2; k++) { const a = x0 + 1 + k * (w + 1); b.cushion(a, y, 22.5, a + w, y + 3.5, 29.5, 1.25, M.fabric(0xF6F4EE), true); b.cushion(a + 1.5, y + 2, 21.5, a + w - 1.5, y + 5, 25, 1, M.fabric(pil), true); }
  }
  // boxspring beds: a tall upholstered headboard (into the block above at the head end only)
  const BOXSPRING = [
    ['grey', 'stone', 0xB9B4AA, 0xF2F0EA, 0x97A88F, 'buttons'],
    ['navy', 'navy velvet', P.navy, 0xEDE8DE, P.mustard, 'channels'],
    ['sand', 'sand linen', P.sand, 0xF4F2EC, P.terracotta, 'wings'],
  ];
  for (const [k, label, c, duvet, pil, head] of BOXSPRING) def('sleep', 'boxspring', k, 'Boxspring Bed · ' + label, Object.assign({}, SL, { size: [2, 2, 2], skip: [[0, 1, 0], [1, 1, 0]], col: k === 'navy' ? 'navy' : k === 'grey' ? 'stone' : 'sand', bed: true, build: (b) => {
    const f = k === 'navy' ? M.velvet(c) : M.fabric(c), fd = k === 'navy' ? M.velvet(sh(c, 0.9)) : M.fabric(sh(c, 0.9));
    for (const [x, z] of [[2, 2], [29, 2], [2, 27], [29, 27]]) b.box(x, 0, z, x + 1, 1, z + 1, M.matte(P.black));
    b.cushion(1, 1, 0.5, 31, 6, 30, 0.75, fd, true); b.cushion(1.5, 6, 1, 30.5, 9, 29.5, 1, M.fabric(0xF4F2EC), true);
    bedding(b, 1.5, 30.5, 9, duvet, pil);
    b.cushion(0, 1, 29.5, 32, 22, 32, 1, f, true);
    if (head === 'channels') for (let x = 4; x < 31; x += 4) b.recolor(x - 0.5, 3, 29.5, x, 21, 30, M.velvet(sh(c, 0.75)));
    else if (head === 'buttons') { for (let y = 12; y < 21; y += 4) for (let x = 4 + ((y / 4) % 2) * 2; x < 30; x += 4) b.recolor(x, y, 29.5, x + 0.5, y + 0.5, 30, M.fabric(sh(c, 0.7))); }
    else { b.cushion(0, 1, 27, 3, 22, 32, 1, f, true); b.cushion(29, 1, 27, 32, 22, 32, 1, f, true); b.cut(0, 0, 0, 32, 32, 27); b.cushion(1, 1, 0.5, 31, 6, 30, 0.75, fd, true); b.cushion(1.5, 6, 1, 30.5, 9, 29.5, 1, M.fabric(0xF4F2EC), true); bedding(b, 1.5, 30.5, 9, duvet, pil); }
  } }));
  // floating LED beds: a platform on a hidden base with a glowing underside (switches like a lamp)
  for (const [k, wood, duvet] of [['walnut', P.walnut, 0xF2F0EA], ['oak', P.oak, P.sage]]) def('sleep', 'ledbed', k, 'LED Bed · ' + k, Object.assign({}, SL, { size: [2, 1, 2], col: k, bed: true, toggle: true, light: [8, 7, 5], build: (b) => {
    const w = M.wood(wood);
    b.box(4, 0, 4, 28, 2, 28, M.matte(DARK)); b.box(0, 2, 0, 32, 5, 32, w); b.box(2, 1.5, 2, 30, 2, 30, M.light(0xFFE2B0));
    b.cushion(1, 5, 1, 31, 8.5, 29.5, 1, M.fabric(0xF4F2EC), true); bedding(b, 1, 31, 8.5, duvet, 0xE8E2D4);
    b.box(0, 5, 29.5, 32, 15, 32, w); b.box(0, 15, 28.5, 32, 15.5, 32, w); b.box(1, 14.5, 29, 31, 15, 29.5, M.light(0xFFE2B0));
  } }));
  // wardrobes: 2 blocks wide and high, 60 cm deep
  def('sleep', 'wardrobe', 'glass', 'Wardrobe · smoked glass', Object.assign({}, SL, { cats: ['sleep', 'storage'], size: [2, 2, 1], col: 'black', ui: 'chest', sound: 'glass', light: [5, 4, 3], build: (b) => {
    const fr = M.metal(P.black);
    b.box(0, 0, 6, 32, 32, 16, M.wood(sh(P.walnut, 0.9))); b.cut(1, 1, 6, 31, 31, 15.5);
    b.box(1, 30, 7, 31, 30.5, 15, M.light(0xFFE2B0)); b.box(1, 26, 7, 31, 26.5, 15.5, M.wood(P.walnut)); b.box(1, 24, 10.5, 31, 24.5, 11, M.chrome());
    const cl = [0xE8E2D4, 0x2B2E33, 0x97A88F, 0xB9664B, 0x8AB4D4, 0xF2F0EA, 0x6E7451, 0x253350];
    for (let k = 0; k < 13; k++) { const x = 2 + k * 2.2; b.box(x, 11 + (k % 3), 8.5, x + 1.5, 24, 13, M.fabric(cl[k % 8])); }
    for (let x = 2; x < 30; x += 3.5) b.box(x, 1, 9, x + 2.5, 2.5, 14, M.leather(x % 7 ? 0x2A2C30 : 0x8A5A3A));       // shoes
    b.box(0, 0, 5.5, 32, 1, 6, fr); b.box(0, 31, 5.5, 32, 32, 6, fr); for (const x of [0, 15.5, 31]) b.box(x, 0, 5.5, x + 1, 32, 6, fr);
    b.box(1, 1, 5.5, 15.5, 31, 6, M.glass(0x5A626C)); b.box(16.5, 1, 5.5, 31, 31, 6, M.glass(0x5A626C));
    b.box(14, 12, 5, 14.5, 20, 5.5, fr); b.box(17.5, 12, 5, 18, 20, 5.5, fr);
  } }));
  def('sleep', 'wardrobe', 'fluted', 'Wardrobe · fluted oak', Object.assign({}, SL, { cats: ['sleep', 'storage'], size: [2, 2, 1], col: 'oak', ui: 'chest', sound: 'wood', build: (b) => {
    b.box(0, 0.5, 7, 32, 32, 16, M.wood(sh(P.oak, 0.9))); b.box(0.5, 0, 7.5, 31.5, 0.5, 15.5, M.matte(DARK));
    for (let k = 0; k < 4; k++) { const x0 = k * 8; b.box(x0 + 0.25, 0.5, 6, x0 + 8, 31.5, 7, M.wood(P.oak)); for (let x = x0 + 1; x < x0 + 7.5; x += 1) b.recolor(x, 0.5, 6, x + 0.5, 31.5, 6.5, M.wood(sh(P.oak, 0.86))); }
    for (const x of [7, 9, 23, 25]) b.box(x - 0.25, 12, 5.5, x + 0.25, 20, 6, M.metal(P.black));
  } }));
  def('sleep', 'wardrobe', 'white', 'Wardrobe · white handleless', Object.assign({}, SL, { cats: ['sleep', 'storage'], size: [2, 2, 1], col: 'white', ui: 'chest', sound: 'wood', build: (b) => {
    b.box(0, 1, 7, 32, 32, 16, M.matte(0xE8E6E0)); b.box(0.5, 0, 8, 31.5, 1, 15.5, M.matte(DARK));
    for (let k = 0; k < 4; k++) { const x0 = k * 8; b.box(x0 + 0.5, 1, 6, x0 + 8, 30.5, 7, M.gloss(P.white)); b.box(x0 + 0.5, 30.5, 6.5, x0 + 8, 31, 7, M.metal(P.graphite)); }
  } }));
  // vanities: the Hollywood mirror (its bulbs switch) and a walnut one with a brass mirror (its drawers open)
  def('sleep', 'vanity', 'hollywood', 'Vanity · hollywood', Object.assign({}, SL, { size: [1, 2, 1], col: 'white', toggle: true, light: [12, 11, 9], sound: 'wood', build: (b) => {
    const wt = M.gloss(P.white);
    for (const [x, z] of [[1, 7], [14, 7], [1, 14], [14, 14]]) b.box(x, 0, z, x + 1, 11, z + 1, M.metal(P.brass));
    b.box(0.5, 11, 6.5, 15.5, 12, 15.5, wt); b.box(1, 9, 7, 15, 11, 15, wt); b.box(5, 9.5, 6.5, 11, 10, 7, M.metal(P.brass));
    b.box(1.5, 16, 15, 14.5, 30, 16, wt); b.box(2.5, 17, 14.5, 13.5, 29, 15, M.gloss(0xC8DCE8));
    for (let y = 17.5; y < 29; y += 2.75) { b.sphere(2, y, 14.5, 0.75, M.light(0xFFF4E0)); b.sphere(14, y, 14.5, 0.75, M.light(0xFFF4E0)); }
    for (let x = 4.5; x < 12; x += 2.5) b.sphere(x, 29.5, 14.5, 0.75, M.light(0xFFF4E0));
    b.lathe(4, 12, [[12, 0.8], [14, 0.7], [14.5, 0.4]], M.glass(0xE8C8A0)); b.lathe(6, 13, [[12, 0.6], [13.5, 0.6]], M.gloss(P.blush)); b.rbox(10, 12, 9, 13, 12.5, 12, 0.25, M.matte(P.sand));
  } }));
  def('sleep', 'vanity', 'walnut', 'Vanity · walnut', Object.assign({}, SL, { size: [1, 2, 1], col: 'walnut', ui: 'chest', sound: 'wood', build: (b) => {
    const w = M.wood(P.walnut);
    b.box(0.5, 9, 6, 15.5, 12, 16, w); for (const x of [1, 14]) { b.box(x, 0, 6.5, x + 1, 9, 7.5, M.metal(P.black)); b.box(x, 0, 14.5, x + 1, 9, 15.5, M.metal(P.black)); }
    b.box(1.5, 9.5, 5.5, 7.5, 11.5, 6, M.wood(sh(P.walnut, 0.88))); b.box(8.5, 9.5, 5.5, 14.5, 11.5, 6, M.wood(sh(P.walnut, 0.88)));
    b.tube('z', 8, 22, 6.2, 0.7, 15, 16, M.metal(P.brass)); b.cyl('z', 8, 22, 5.5, 15.25, 15.75, M.gloss(0xC8DCE8));
    b.lathe(3, 12, [[12, 0.9], [14, 0.8], [14.5, 0.4]], M.glass(0xD8B8E0)); b.lathe(5, 13, [[12, 0.7], [13, 0.7]], M.gloss(P.black)); b.rbox(9, 12, 10, 14, 12.5, 14, 0.25, M.leather(0x6A4A30));
  } }));
  // benches, nightstands
  def('sleep', 'bench', 'boucle', 'Bed Bench · bouclé', Object.assign({}, SL, { size: [2, 1, 1], col: 'cream', seat: true, build: (b) => {
    for (const x of [3, 28]) for (const z of [5, 10]) b.box(x, 0, z, x + 1, 3, z + 1, M.metal(P.brass));
    b.rbox(1, 3, 3.5, 31, 7.5, 12.5, 1.5, M.fabric(0xEDE6D8));
  } }));
  def('sleep', 'bench', 'oak', 'Bed Bench · oak slats', Object.assign({}, SL, { size: [2, 1, 1], col: 'oak', seat: true, sound: 'wood', build: (b) => {
    const o = M.wood(P.oak);
    b.box(2, 0, 4, 4, 6.5, 12, o); b.box(28, 0, 4, 30, 6.5, 12, o); b.box(4, 2, 7.5, 28, 3, 8.5, o);
    for (let z = 4; z < 12; z += 1.5) b.box(1, 6.5, z, 31, 7.5, z + 1, o);
    b.rbox(20, 7.5, 5, 28, 8.5, 11, 0.4, M.fabric(P.cream)); b.rbox(20.5, 8.5, 5.5, 27.5, 9, 10.5, 0.25, M.fabric(P.sage));
  } }));
  def('sleep', 'nightstand', 'floating', 'Nightstand · floating oak', Object.assign({}, SL, { cats: ['sleep', 'storage'], size: [1, 1, 1], col: 'oak', ui: 'chest', mount: 'wall', sound: 'wood', build: (b) => {
    b.box(1.5, 6, 6, 14.5, 10.5, 16, M.wood(P.oak)); b.box(2, 6.5, 5.5, 14, 10, 6, M.wood(sh(P.oak, 0.9))); b.box(5, 8.5, 5, 11, 9, 5.5, M.metal(P.black));
    b.box(2, 5.5, 7, 14, 6, 15, M.light(0xFFE2B0)); books(b, 3, 10.5, 10, 3); b.lathe(11, 11, [[10.5, 1.2], [13, 1]], M.glass(0xE8F4FA), 0.3);
  } }));
  def('sleep', 'nightstand', 'travertine', 'Nightstand · travertine', Object.assign({}, SL, { size: [1, 1, 1], col: 'sand', sound: 'stone', build: (b) => {
    const t = M.stone(0xD9CBB0); b.cyl('y', 8, 8, 3, 0, 8, t); b.cyl('y', 8, 8, 5, 8, 9, t); b.cyl('y', 8, 8, 4, 0, 0.5, t);
    b.lathe(10, 7, [[9, 1.4], [10.5, 1.8], [12, 1.2]], M.gloss(P.sage), 0.4); b.rbox(4, 9, 6, 8, 9.5, 11, 0.25, M.matte(P.terracotta));
  } }));
  // a children's house bed, a clothes rail, an arched floor mirror
  def('sleep', 'housebed', 'oak', 'House Bed · oak', Object.assign({}, SL, { size: [1, 2, 2], col: 'oak', bed: true, sound: 'wood', build: (b) => {
    const o = M.wood(P.oak);
    b.box(0.5, 0, 0.5, 15.5, 2, 31.5, o); b.cushion(1, 2, 1, 15, 4.5, 31, 1, M.fabric(0xF4F2EC), true); bedding(b, 1, 15, 4.5, 0x8AB4D4, P.mustard);
    for (const z of [0, 30.5]) { b.box(0, 0, z, 1, 20, z + 1.5, o); b.box(15, 0, z, 16, 20, z + 1.5, o); b.beam(0.5, 19.5, 8, 28, z, z + 1.5, 1.2, o); b.beam(15.5, 19.5, 8, 28, z, z + 1.5, 1.2, o); }
    b.box(7.5, 27, 0, 8.5, 28, 32, o); b.box(0, 19.5, 0, 1, 20.5, 32, o); b.box(15, 19.5, 0, 16, 20.5, 32, o);
    for (let k = 0; k < 6; k++) b.sphere(2 + k * 2.4, 19 - (k % 2) * 0.6, 16, 0.5, M.light([0xFFD58C, 0xF2B544, 0xFFE8B0][k % 3]));    // a string of fairy lights
  } }));
  def('sleep', 'rail', 'black', 'Clothes Rail · black', Object.assign({}, SL, { cats: ['sleep', 'storage'], size: [2, 2, 1], col: 'black', sound: 'metal', build: (b) => {
    const m = M.metal(P.black);
    for (const x of [1, 30]) { b.box(x, 0, 4, x + 1, 26, 5, m); b.box(x, 0, 11, x + 1, 26, 12, m); b.box(x, 0, 4, x + 1, 1, 12, m); b.box(x, 25, 4, x + 1, 26, 12, m); }
    b.box(1, 24, 7.5, 31, 24.5, 8.5, m); b.box(2, 4, 4.5, 30, 4.5, 11.5, M.wood(P.oak));
    const cl = [0xE8E2D4, 0x2B2E33, 0x97A88F, 0xB9664B, 0x8AB4D4, 0x253350, 0xCF9F3A];
    for (let k = 0; k < 9; k++) { const x = 3 + k * 3; b.box(x, 11 + (k % 2) * 2, 5.5, x + 2.5, 23.5, 10.5, M.fabric(cl[k % 7])); b.box(x + 1, 23.5, 7.75, x + 1.5, 24.5, 8.25, m); }
    for (let x = 3; x < 29; x += 4) b.box(x, 4.5, 5, x + 3, 6, 11, M.leather(x % 8 ? 0x2A2C30 : 0xE8E2D4));
  } }));
  def('sleep', 'mirror', 'arch', 'Floor Mirror · arch oak', Object.assign({}, SL, { size: [1, 2, 1], col: 'oak', sound: 'glass', build: (b) => {
    const o = M.wood(P.oak), poly = [[2, 0]]; for (let k = 0; k <= 12; k++) { const a = Math.PI - k * Math.PI / 12; poly.push([8 + Math.cos(a) * 6, 24 + Math.sin(a) * 6]); } poly.push([14, 0]);
    b.extrude(poly, 'z', 13, 14.5, o); const inner = [[3, 1]]; for (let k = 0; k <= 12; k++) { const a = Math.PI - k * Math.PI / 12; inner.push([8 + Math.cos(a) * 5, 24 + Math.sin(a) * 5]); } inner.push([13, 1]);
    b.extrude(inner, 'z', 12.5, 13, M.gloss(0xC8DCE8));
  } }));

  // ================================================================ BAD — vanities, showers, WCs, ladders, mirrors, tubs
  const BA = { cats: ['bath'], res: 32, sound: 'stone', hard: 1 };
  // a vessel basin on a top at y (centre cx, cz) and a wall tap above it
  function vessel(b, cx, cz, y, tapMat) {
    b.lathe(cx, cz, [[y, 2.2], [y + 0.5, 3], [y + 2, 3.4], [y + 2.5, 3.4]], M.gloss(P.white), 0.5); b.cyl('y', cx, cz, 2.8, y, y + 0.5, M.gloss(P.white));
    b.cyl('y', cx, cz, 0.5, y + 0.5, y + 0.75, M.metal(0x6A7078));
    b.rod(cx, y + 3.5, 16, cx, y + 3.5, cz + 1.5, 0.5, tapMat); b.box(cx - 1, y + 2.75, 15.5, cx + 1, y + 4.5, 16, tapMat); b.box(cx + 1.5, y + 3.25, 15, cx + 2, y + 4, 16, tapMat);
  }
  for (const [k, label, body, top, tapM] of [['oak', 'oak', () => M.wood(P.oak), () => M.stone(0x3A3C40), () => M.metal(P.black)], ['white', 'white', () => M.gloss(P.white), () => M.marble(0xEEEDEA), () => M.chrome()]]) def('bath', 'doublevanity', k, 'Double Vanity · ' + label, Object.assign({}, BA, { size: [2, 1, 1], col: k === 'oak' ? 'oak' : 'white', ui: 'chest', mount: 'wall', build: (b) => {
    b.box(1, 5, 6.5, 31, 10, 16, body()); for (const x0 of [1, 16]) { b.box(x0 + 0.5, 5.5, 6, x0 + 15, 7.5, 6.5, body()); b.box(x0 + 0.5, 7.75, 6, x0 + 15, 9.75, 6.5, body()); b.box(x0 + 5, 9, 5.5, x0 + 10, 9.5, 6, M.metal(P.black)); }
    b.box(0.5, 10, 6, 31.5, 11, 16, top());
    vessel(b, 9, 10.5, 11, tapM()); vessel(b, 23, 10.5, 11, tapM());
    b.rbox(14, 11, 12, 18, 12, 15, 0.5, M.fabric(0xF4F0E8)); b.lathe(16, 13.5, [[12, 0.6], [14, 0.6], [14.5, 0.3]], M.gloss(P.sage));
  } }));
  def('bath', 'vanity', 'terrazzo', 'Vanity · terrazzo', Object.assign({}, BA, { size: [1, 1, 1], col: 'cream', ui: 'chest', mount: 'wall', build: (b) => {
    const tz = M.stone(0xE6E0D6);
    b.box(1, 6, 7, 15, 10, 16, M.wood(P.walnut)); b.box(1.5, 6.5, 6.5, 14.5, 9.5, 7, M.wood(sh(P.walnut, 0.9))); b.box(5.5, 8.5, 6, 10.5, 9, 6.5, M.metal(P.brass));
    b.box(0.5, 10, 6.5, 15.5, 11, 16, tz); for (let k = 0; k < 10; k++) b.box(1 + (k * 4.7) % 14, 10.5, 7 + (k * 3.3) % 8.5, 1.5 + (k * 4.7) % 14, 11, 7.5 + (k * 3.3) % 8.5, M.stone([0xB9664B, 0x6E7451, 0x41454B][k % 3]));
    vessel(b, 8, 11, 11, M.metal(P.brass)); b.rod(0.5, 8, 7, 0.5, 8, 15, 0.4, M.metal(P.brass));
  } }));
  def('bath', 'shower', 'grid', 'Walk-in Shower · black grid', Object.assign({}, BA, { size: [1, 2, 1], col: 'graphite', sound: 'glass', build: (b) => {
    b.box(0, 0, 0, 16, 0.5, 16, M.stone(0x8A8C8E)); b.box(2, 0.5, 13, 14, 0.75, 14, M.metal(0x4A4E54));                    // tray with a linear drain
    b.box(0, 0.5, 15, 16, 32, 16, M.stone(0x3E4146)); for (let y = 4; y < 32; y += 4) b.recolor(0, y, 15, 16, y + 0.25, 15.25, M.stone(0x34373C));
    b.box(0, 0.5, 0, 0.5, 30, 15, M.glass(0xD6ECF4)); for (const z of [0, 7.5, 14.5]) b.box(0, 0.5, z, 1, 30, z + 0.5, M.metal(P.black)); for (const y of [0.5, 10, 20, 29.5]) b.box(0, y, 0, 1, y + 0.5, 15, M.metal(P.black));
    b.box(7.5, 26, 9, 8.5, 31.5, 15, M.metal(P.black)); b.box(4, 25, 4, 12, 25.5, 12, M.metal(P.black)); b.box(4.5, 24.5, 4.5, 11.5, 25, 11.5, M.metal(0x4A4E54));   // the rain head
    b.box(10, 15, 14.5, 14, 16, 15, M.metal(P.black)); b.cyl('z', 11, 15.5, 0.75, 14, 14.5, M.metal(P.black)); b.cyl('z', 13, 15.5, 0.75, 14, 14.5, M.metal(P.black));
    b.box(3, 14, 14.5, 7, 17, 15, M.stone(0x2E3136)); b.lathe(4, 14.75, [[14, 0.5], [15.5, 0.5]], M.gloss(P.white)); b.lathe(6, 14.75, [[14, 0.5], [16, 0.5]], M.gloss(P.sage));
  } }));
  def('bath', 'showercolumn', 'brass', 'Shower Column · brushed brass', Object.assign({}, BA, { size: [1, 2, 1], col: 'brass', mount: 'wall', solid: false, sound: 'metal', build: (b) => {
    const br = M.metal(P.brass);
    b.box(7.5, 12, 15, 8.5, 31, 16, br); b.box(7.5, 30.5, 9, 8.5, 31.5, 16, br); b.cyl('y', 8, 9, 3.5, 29.5, 30.5, br); b.cyl('y', 8, 9, 3, 29, 29.5, M.metal(0x8A7A50));
    b.pbox(6, 14, 14, 10, 16, 16, 0.5, br); b.cyl('z', 6.5, 15, 0.75, 13.5, 14, br); b.cyl('z', 9.5, 15, 0.75, 13.5, 14, br);
    b.rod(10, 18, 15, 10, 26, 14.5, 0.4, br); b.cyl('z', 10, 26.5, 0.9, 13.5, 14.5, br);
  } }));
  for (const [k, label, c] of [['white', 'rimless white', P.white], ['black', 'matte black', 0x2A2C30]]) def('bath', 'wc', k, 'WC · ' + label, Object.assign({}, BA, { size: [1, 1, 1], col: k, build: (b) => {
    const m = k === 'white' ? M.gloss(c) : M.matte(c);
    b.box(1, 0, 13, 15, 16, 16, M.stone(0xD8D4CC)); b.box(5.5, 11, 12.5, 10.5, 13.5, 13, M.metal(k === 'white' ? 0x2A2C30 : P.brass));
    b.pbox(4, 5.5, 3, 12, 9, 13, 3.5, m); b.pbox(4.5, 4, 5, 11.5, 5.5, 13, 3, m); b.pbox(5.25, 8, 4, 10.75, 9, 11, 2.5, 0); b.pbox(5.25, 7, 4, 10.75, 8, 11, 2.5, M.gloss(0xDDE8EE));
    b.pbox(4, 9, 3, 12, 9.5, 12.5, 3.5, m);
    b.box(13.5, 7, 12, 14, 8, 13, M.metal(P.black)); b.cyl('x', 7.5, 10.5, 1.4, 13.5, 15.5, M.matte(0xF6F4EE));   // a roll holder
  } }));
  for (const [k, wood] of [['oak', () => M.wood(P.oak)], ['black', () => M.metal(P.black)]]) def('bath', 'ladder', k, 'Towel Ladder · ' + k, Object.assign({}, BA, { size: [1, 2, 1], col: k, sound: 'wood', build: (b) => {
    const w = wood();
    b.beam(2, 0, 2, 29, 9, 10.5, 1, w); b.beam(14, 0, 14, 29, 9, 10.5, 1, w);
    for (let k2 = 0; k2 < 5; k2++) { const y = 5 + k2 * 5.5, z = 9 + (y / 29) * 0; b.box(2, y, z, 14, y + 0.75, z + 1.5, w); }
    b.extrude([[3, 21], [13, 21], [13, 15.5], [3, 15.5]], 'z', 8.5, 9, M.fabric(0xEDE6D8)); b.box(3, 21, 8.5, 13, 21.75, 11, M.fabric(0xEDE6D8)); b.extrude([[3.5, 21], [12.5, 21], [12.5, 17], [3.5, 17]], 'z', 11, 11.5, M.fabric(0xEDE6D8));
    b.box(3, 10.5, 8.5, 13, 11, 11, M.fabric(P.sage)); b.box(3, 7.5, 8.5, 13, 10.5, 9, M.fabric(P.sage));
  } }));
  def('bath', 'mirrorcabinet', 'led', 'Mirror Cabinet · backlit', Object.assign({}, BA, { size: [1, 1, 1], col: 'chrome', mount: 'wall', toggle: true, light: [11, 11, 11], sound: 'glass', build: (b) => {
    b.box(1, 3, 12, 15, 15, 16, M.gloss(P.white)); b.box(1.5, 3.5, 11.5, 15, 14.5, 12, M.gloss(0xC8DCE8)); b.box(7.75, 3.5, 11, 8.25, 14.5, 11.5, M.metal(0x9AA0A6));
    b.box(1, 2.5, 12.5, 15, 3, 15.5, M.light(0xF4F6FF)); b.box(1, 15, 12.5, 15, 15.5, 15.5, M.light(0xF4F6FF));
  } }));
  def('bath', 'mirror', 'round', 'Mirror · round backlit', Object.assign({}, BA, { size: [1, 1, 1], col: 'chrome', mount: 'wall', toggle: true, light: [10, 10, 10], sound: 'glass', solid: false, build: (b) => {
    b.cyl('z', 8, 9, 6, 15.5, 16, M.light(0xF4F6FF)); b.cyl('z', 8, 9, 5.5, 14.5, 15.5, M.gloss(0xC8DCE8));
  } }));
  def('bath', 'washertower', 'white', 'Washer Tower · white', Object.assign({}, BA, { size: [1, 2, 1], col: 'white', ui: 'chest', sound: 'metal', build: (b) => {
    for (const y0 of [0.5, 14]) {
      b.rbox(1, y0, 3, 15, y0 + 13, 16, 0.75, M.gloss(P.white)); b.box(1.5, y0 + 10.5, 2.5, 14.5, y0 + 12.5, 3, M.gloss(0x2A2D33)); b.box(10, y0 + 11, 2, 13.5, y0 + 12, 2.5, M.light(0x5CC8F0));
      b.tube('z', 8, y0 + 5.5, 4.5, 0.75, 2, 3, M.chrome()); b.cyl('z', 8, y0 + 5.5, 3.75, 2.25, 3, M.glass(0x3A4E66));
    }
    b.box(0, 27.5, 3, 16, 28, 16, M.wood(P.oak)); b.lathe(4.5, 9, [[28, 2.6], [31.5, 2.8]], M.wood(0xC8A878), 0.5); b.lathe(11.5, 9, [[28, 1], [31, 1]], M.gloss(P.sage));
  } }));
  def('bath', 'tub', 'oval', 'Bathtub · oval white', Object.assign({}, BA, { size: [2, 1, 1], col: 'white', build: (b) => {
    ellRingFill(b, 16, 8, 15, 7, 0, 9.5, M.gloss(P.white)); ellRingFill(b, 16, 8, 13.5, 5.5, 3, 9.5, 0); ellRingFill(b, 16, 8, 13.5, 5.5, 3, 7.5, M.gloss(0x9ED0EC));
    b.cyl('y', 31, 2, 0.6, 0, 14, M.metal(P.black)); b.rod(31, 14, 2, 27.5, 14, 2, 0.5, M.metal(P.black)); b.rod(27.5, 14, 2, 27.5, 12, 2, 0.5, M.metal(P.black));
    b.rbox(3, 9.5, 5, 8, 11, 11, 0.5, M.fabric(0xF4F0E8));
  } }));
  def('bath', 'tub', 'stone', 'Bathtub · stone', Object.assign({}, BA, { size: [2, 1, 1], col: 'concrete', build: (b) => {
    b.pbox(0.5, 0, 0.5, 31.5, 9, 15.5, 2.5, M.concrete(0xA9A6A0)); b.pbox(2, 2.5, 2, 30, 9, 14, 2, 0); b.pbox(2, 2.5, 2, 30, 7, 14, 2, M.gloss(0x9ED0EC));
    b.box(14, 9, 13.5, 18, 9.5, 15.5, M.metal(P.black)); b.rod(16, 9.5, 14.5, 16, 10.5, 12.5, 0.5, M.metal(P.black));
    b.box(22, 9, 0.5, 29, 9.5, 3, M.wood(P.oak)); b.lathe(24, 1.75, [[9.5, 0.6], [11, 0.6]], M.gloss(P.white)); b.cyl('y', 27, 1.75, 0.6, 9.5, 10.5, M.light(0xFFE2A0));
  } }));
  def('bath', 'stool', 'teak', 'Bath Stool · teak', Object.assign({}, BA, { size: [1, 1, 1], col: 'oak', seat: true, sound: 'wood', build: (b) => {
    const t = M.wood(0xA8865A);
    b.box(4, 0, 5, 5, 7, 11, t); b.box(11, 0, 5, 12, 7, 11, t); b.box(5, 2, 7.5, 11, 3, 8.5, t);
    for (let x = 3.5; x < 12.5; x += 1.5) b.box(x, 7, 4.5, x + 1, 8, 11.5, t);
    b.rbox(5, 8, 6, 10, 9, 10, 0.4, M.fabric(0xF4F0E8));
  } }));
  def('bath', 'radiator', 'black', 'Towel Radiator · black', Object.assign({}, BA, { size: [1, 2, 1], col: 'black', mount: 'wall', sound: 'metal', build: (b) => {
    const m = M.metal(P.black);
    b.box(3, 2, 14.5, 4, 28, 15.5, m); b.box(12, 2, 14.5, 13, 28, 15.5, m); for (let y = 3; y < 28; y += 1.5) b.box(4, y, 14.75, 12, y + 0.75, 15.25, m);
    b.box(3, 2, 15.5, 4, 3, 16, m); b.box(12, 26.5, 15.5, 13, 27.5, 16, m);
    b.extrude([[4, 20], [12, 20], [12, 14], [4, 14]], 'z', 14, 14.5, M.fabric(0xD9AFA6)); b.box(4, 20, 14, 12, 20.75, 16, M.fabric(0xD9AFA6));
  } }));

  // ================================================================ PFLANZEN — seven species in a concrete or a terracotta pot
  // a pot of radius r and height h (its soil at h - 0.5); returns the soil height
  function pot(b, kind, r, h) {
    if (kind === 'concrete') { b.lathe(8, 8, [[0, r - 0.5], [h, r]], M.concrete(0x9C9C98)); }
    else { b.lathe(8, 8, [[0, r - 1], [h - 1.5, r - 0.25], [h - 1.5, r + 0.5], [h, r + 0.5]], M.matte(P.terracotta)); }
    b.cyl('y', 8, 8, r - 0.75, h - 1, h, M.matte(0x4A3626));
    return h - 0.5;
  }
  const LEAF = 0x3E7D44, LEAF2 = 0x5A9A4E, LEAFD = 0x2E5A34;
  const PLANTS = [
    ['fig', 'Fiddle Leaf Fig', 2, (b, y) => {
      b.lathe(8, 8, [[y, 1], [20, 0.8]], M.wood(0x6A5A44)); b.rod(8, 17, 8, 5.5, 22, 7, 0.8, M.wood(0x6A5A44)); b.rod(8, 19, 8, 10.5, 24, 9, 0.8, M.wood(0x6A5A44));
      for (let k = 0; k < 26; k++) {
        const a = k * 2.4, h = 12 + (k * 0.62) % 16, r = 1.5 + ((k * 7) % 5) * 0.9, cx = 8 + Math.cos(a) * r, cz = 8 + Math.sin(a) * r, c = M.plant([LEAF, LEAF2, LEAFD][k % 3]);
        if (k & 1) b.ellipsoid(cx, h, cz, 0.8, 2.6, 2.2, c); else b.ellipsoid(cx, h, cz, 2.2, 2.6, 0.8, c);
      }
    }],
    ['snake', 'Snake Plant', 1, (b, y) => {
      const L = [[6, 7, 9], [9, 7, 11], [7.5, 9, 11.5], [5.5, 9.5, 8], [10, 9, 9.5], [8, 6, 10.5], [10.5, 6.5, 7.5], [6.5, 5.5, 7]];
      for (const [x, z, h] of L) { b.box(x, y, z, x + 1, y + h, z + 1, M.plant(LEAFD)); b.box(x, y + 1, z, x + 1, y + h - 2, z + 1, M.plant(0x4E7A3A)); b.box(x, y + h - 2, z, x + 1, y + h - 1, z + 1, M.plant(0xB8B04A)); }
    }],
    ['strelitzia', 'Bird of Paradise', 2, (b, y) => {
      for (let k = 0; k < 9; k++) {
        const a = k * 0.72 + 0.3, r = 2.5 + (k % 3) * 1.5, top = 17 + (k % 4) * 2.8, tx = 8 + Math.cos(a) * r, tz = 8 + Math.sin(a) * r;
        b.rod(8, y, 8, tx, top - 4, tz, 0.75, M.plant(0x4E7A3A));
        if (Math.abs(Math.cos(a)) > Math.abs(Math.sin(a))) b.ellipsoid(tx, top, tz, 0.8, 4.5, 2.3, M.plant(k % 3 ? LEAF : LEAF2)); else b.ellipsoid(tx, top, tz, 2.3, 4.5, 0.8, M.plant(k % 3 ? LEAFD : LEAF));
      }
      b.extrude([[10, 23], [13.5, 24.5], [12, 23.5]], 'z', 8, 9, M.matte(0xF08A2A)); b.extrude([[10, 23.5], [12.5, 26], [11, 23.5]], 'z', 8, 9, M.matte(0x5A6AD8));   // the flower
    }],
    ['palm', 'Kentia Palm', 2, (b, y) => {
      for (let k = 0; k < 7; k++) {
        const a = k * Math.PI * 2 / 7 + 0.2, dx = Math.cos(a), dz = Math.sin(a), lift = 3 + (k % 3) * 2.5;
        let px = 8, py = y, pz = 8;
        for (let s2 = 1; s2 <= 7; s2++) { const nx = 8 + dx * s2 * 1.05, ny = y + lift + s2 * 4.2 - s2 * s2 * 0.45, nz = 8 + dz * s2 * 1.05; b.rod(px, py, pz, nx, ny, nz, 0.75, M.plant(0x5A7A3A)); if (s2 > 1) b.ellipsoid(nx, ny - 0.75, nz, 2.6 * Math.abs(dz) + 0.6, 0.6, 2.6 * Math.abs(dx) + 0.6, M.plant(s2 % 2 ? LEAF : LEAF2)); px = nx; py = ny; pz = nz; }
      }
    }],
    ['rubber', 'Rubber Plant', 2, (b, y) => {
      b.lathe(8, 8, [[y, 1], [27, 0.8]], M.plant(0x5A4A3A));
      for (let k = 0; k < 14; k++) { const a = k * 2.2, h = y + 3 + k * 1.45, cx = 8 + Math.cos(a) * 2.6, cz = 8 + Math.sin(a) * 2.6, ax = Math.abs(Math.cos(a)) > 0.7; b.ellipsoid(cx, h, cz, ax ? 2.6 : 1.5, 0.75, ax ? 1.5 : 2.6, M.plant(k % 2 ? 0x2A4430 : 0x36553A)); }
      b.ellipsoid(8, 27.5, 8, 1, 1.8, 1, M.plant(0x8A3A3A));
    }],
    ['zz', 'ZZ Plant', 1, (b, y) => {
      for (let k = 0; k < 6; k++) {
        const a = k * 1.05, tx = 8 + Math.cos(a) * 3, tz = 8 + Math.sin(a) * 3, top = y + 7 + (k % 3);
        b.rod(8, y, 8, tx, top, tz, 0.75, M.plant(0x3E5A2E));
        for (let s = 2; s <= 4; s++) { const t = s / 5, lx = 8 + (tx - 8) * t, ly = y + (top - y) * t, lz = 8 + (tz - 8) * t; b.ellipsoid(lx + 1, ly, lz, 1.3, 0.75, 1, M.plant(LEAF)); b.ellipsoid(lx - 1, ly, lz, 1.3, 0.75, 1, M.plant(LEAF2)); }
        b.ellipsoid(tx, top + 0.5, tz, 1, 1.25, 1, M.plant(LEAF));
      }
    }],
    ['cactus', 'Column Cactus', 2, (b, y) => {
      const c = M.plant(0x4E7E5A), c2 = M.plant(0x3E6A4A);
      b.cyl('y', 8, 8, 2, y, 26, c); for (const [x, z] of [[6, 8], [10, 8], [8, 6], [8, 10]]) b.recolor(x, y, z, x + 0.5, 26, z + 0.5, c2);
      b.sphere(8, 26, 8, 1.8, c);
      b.rod(9.5, y + 9, 8, 12.5, y + 10, 8, 1, c); b.cyl('y', 12.5, 8, 1.2, y + 10, y + 16, c); b.sphere(12.5, y + 16, 8, 1.1, c);
      b.rod(6.5, y + 12, 8, 4, y + 13, 8, 1, c); b.cyl('y', 4, 8, 1.1, y + 13, y + 18, c); b.sphere(4, y + 18, 8, 1, c);
      b.sphere(8, 27.5, 8, 0.8, M.matte(0xE8B8C8));
    }],
  ];
  for (const [id, name, H, grow] of PLANTS) for (const [pk, plabel] of [['concrete', 'concrete pot'], ['terracotta', 'terracotta pot']]) {
    def('plant', id, pk, name + ' · ' + plabel, { res: 16, size: [1, H, 1], col: 'leaf', cats: ['plant'], sound: 'grass', hard: 0.3, build: (b) => {
      const y = pot(b, pk, H > 1 ? 4.5 : 3.5, H > 1 ? 7 : 5);
      grow(b, y);
    } });
  }

  // ---------------------------------------------------------------- registration: after Vollton (blocks6.js) — VR.BL.late
  // runs in load order at the end of blocks4.js; a re-run of this file (the Studio's editor) registers nothing new
  if (VR.BL && !(VR.R && VR.R.T)) { VR.BL.late = VR.BL.late || []; VR.BL.late.push(() => VM.registerLate(NAMES)); }
  void mix;
})(VR);
