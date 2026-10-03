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

  // ---------------------------------------------------------------- registration: after Vollton (blocks6.js) — VR.BL.late
  // runs in load order at the end of blocks4.js; a re-run of this file (the Studio's editor) registers nothing new
  if (VR.BL && !(VR.R && VR.R.T)) { VR.BL.late = VR.BL.late || []; VR.BL.late.push(() => VM.registerLate(NAMES)); }
  void mix;
})(VR);
