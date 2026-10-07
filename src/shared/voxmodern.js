// ============================================================================
// Modern Living — the big modern item pack (v0.39), in the creative tab
// "Modern Living" and the Studio (✨ Modern in 🧱 Teile, Möbel categories).
// 236 items in 12 sets: Licht · Smart Home · Küche · Wohnen · Schlafen · Bad ·
// Pflanzen · Büro & Technik · Garten & Pool · Mobilität · Laden & Café · Deko &
// Kunst, every item made by a parametric builder in the model language
// (voxmodel.js) at real scale (seat 7–7.5 units, table 12, counter 15, bar
// 17–18, bed top 8–9; 16 units = one block = 1 m; front = −z).
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
  const M = VM.M, sh = VR.VX.sh;

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
  // a torus lying flat (a pool ring, a life buoy): centre, ring radius R, tube radius r (grid-exact)
  function torus(b, cx, cy, cz, R, r, m) {
    const S = b.S;
    for (let y = Math.floor((cy - r) * S); y < Math.ceil((cy + r) * S); y++) for (let z = Math.floor((cz - R - r) * S); z < Math.ceil((cz + R + r) * S); z++) for (let x = Math.floor((cx - R - r) * S); x < Math.ceil((cx + R + r) * S); x++) {
      const px = (x + 0.5) / S - cx, py = (y + 0.5) / S - cy, pz = (z + 0.5) / S - cz, q = Math.hypot(px, pz) - R;
      if (q * q + py * py <= r * r) b.set(x, y, z, m);
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
    // a round plate on the wall, a short arm and a drum shade; the light leaves both ends (glowing caps top and bottom)
    const m = f === 'white' ? M.gloss(P.white) : M.metal(P.black), glow = M.light(0xFFF0D4);
    b.pbox(5.5, 5.5, 15, 10.5, 14.5, 16, 0.5, m); b.box(7.5, 9.5, 12, 8.5, 10.5, 15.5, m);
    b.lathe(8, 11, [[4, 1.5], [5, 2.4], [8, 2.7], [11, 2.7], [14, 2.4], [15, 1.5]], m);
    b.cyl('y', 8, 11, 1.3, 3.5, 4, glow); b.cyl('y', 8, 11, 1.3, 15, 15.5, glow);
  } }));
  def('light', 'wall', 'swingarm_brass', 'Wall Lamp Swing Arm · brass', Object.assign({}, LAMP, { mount: 'wall', res: 32, size: [1, 1, 1], col: 'brass', light: [12, 10, 7], build: (b) => {
    const m = M.metal(P.brass);
    b.pbox(6.5, 10, 15, 9.5, 14, 16, 0.5, m); b.rod(8, 12, 15, 8, 12, 8.5, 0.5, m); b.sphere(8, 12, 8.5, 0.8, m);   // wall plate, arm, joint
    b.rod(8, 12, 8.5, 6, 12, 4.5, 0.5, m); b.rod(6, 12, 4.5, 6, 10.5, 4.5, 0.5, m);
    b.lathe(6, 4.5, [[6.5, 2.6], [7.5, 2.4], [8.5, 1.8], [9.5, 1.1], [10.5, 0.6]], m);           // the reading shade
    b.cyl('y', 6, 4.5, 2, 6, 6.5, M.light(glowW));
  } }));
  def('light', 'wall', 'ledbar_white', 'Wall Lamp LED Bar · white', Object.assign({}, LAMP, { mount: 'wall', res: 32, size: [1, 1, 1], col: 'white', light: [12, 12, 11], build: (b) => {
    // a white housing on two wall feet, with the glowing diffuser on its front face
    b.box(1, 11, 15, 15, 13.5, 16, M.gloss(P.white)); b.box(3, 10, 15.5, 4.5, 11, 16, M.gloss(P.white)); b.box(11.5, 10, 15.5, 13, 11, 16, M.gloss(P.white));
    b.box(1.5, 11.25, 14, 14.5, 12.25, 15, M.light(0xFFF6EA));
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
    // a round chrome dial on a white backplate: a dark glass face with a glowing ring and a readout
    b.cyl('z', 8, 8.5, 2.7, 15.25, 16, M.gloss(0xE8E6E0));
    b.cyl('z', 8, 8.5, 2.3, 14.25, 15.25, M.chrome());
    b.cyl('z', 8, 8.5, 1.9, 13.75, 14.25, M.gloss(0x0E1218));
    b.tube('z', 8, 8.5, 1.85, 0.4, 13.75, 14.25, M.light(0xFF8A3A));
    b.box(7.25, 7.75, 13.75, 8.75, 9.25, 14.25, M.light(0xFFC08A));
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
    // a black plate on the wall: a glass lens in a glowing ring, a steel call button and the status light
    b.pbox(6, 3.5, 15, 10, 14, 16, 1.2, M.gloss(P.black));
    b.cyl('z', 8, 9, 1.3, 14, 15, M.glass(0x3A4A5A)); b.tube('z', 8, 9, 1.9, 0.5, 14, 15, M.light(0x5CC8F0));
    b.cyl('z', 8, 5.8, 0.9, 14, 15, M.metal(P.steel));
    b.box(7.5, 12.3, 14.5, 8.5, 12.9, 15, M.light(0x4AE08A));
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
    // a white wall unit on a dark plinth: a raised front panel, cooling slats under it, three status lights on top
    b.pbox(2, 2, 13, 14, 21, 16, 1, M.gloss(P.white)); b.box(2.5, 0.5, 13.5, 13.5, 2, 15.5, M.metal(P.graphite));
    b.box(3.5, 14, 12, 12.5, 16.5, 13, M.gloss(0xE4E2DC));
    for (let k = 0; k < 4; k++) b.box(4.5, 6 + k * 1.5, 12, 11.5, 6.6 + k * 1.5, 13, M.metal(P.graphite));
    for (const x of [5.5, 8, 10.5]) b.box(x - 0.5, 18.3, 12.5, x + 0.5, 19.2, 13.2, M.light(0x4AE08A));
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
    // a smooth electric kettle: a black base, a rounded white belly and shoulder, a spout, a loop handle and a black lid
    const w = M.gloss(P.white), k = M.gloss(P.black);
    b.cyl('y', 8, 8, 2.6, 0, 0.8, k);
    b.lathe(8, 8, [[0.8, 2.5], [2, 2.9], [5, 3.0], [6.8, 2.7], [7.8, 2.1], [8.6, 1.5]], w);
    b.cyl('y', 8, 8, 1.5, 8.6, 9, k); b.cyl('y', 8, 8, 0.5, 9, 9.8, k);
    b.rod(11, 2.5, 8, 13.5, 5, 8, 0.7, w); b.rod(13.5, 5, 8, 13.8, 5.6, 8, 0.7, w);
    b.tube('z', 4.1, 5.6, 2.2, 0.7, 7.25, 8.75, k);
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
  def('kitchen', 'winecooler', 'black', 'Wine Cooler · under counter', Object.assign({}, AP, { col: 'black', light: [4, 3, 2], build: (b) => {
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
    // a canopy that slopes in toward the front (steel), a flue up to the ceiling, two lights under the steel lip
    const k = M.metal(P.black), st = M.metal(0x4A4E54);
    b.box(6, 10, 7, 10, 16, 9, k);                                                         // the flue
    b.extrude([[2, 10], [14, 10], [12, 5], [4, 5]], 'x', 2, 14, k);
    b.recolor(2, 5, 8.5, 14, 10, 14, st);                                                  // the sloping front is steel
    b.extrude([[4, 5], [12, 5], [11.5, 4.5], [4.5, 4.5]], 'x', 2.5, 13.5, st);
    for (const x of [5, 11]) b.box(x - 1, 3.5, 6.5, x + 1, 4.5, 9, M.light(0xFFF0D4));
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
    // a drum pouf in chunky knit: a rounded edge, two darker rib bands and a lighter top
    b.lathe(8, 8, [[0, 4.2], [0.5, 4.7], [1.5, 4.8], [6, 4.8], [6.7, 4.5], [7, 3.8]], M.fabric(P.mustard));
    for (const y of [2, 4]) b.recolor(0, y, 0, 16, y + 1, 16, M.fabric(sh(P.mustard, 0.84)));
    b.recolor(0, 6, 0, 16, 7, 16, M.fabric(sh(P.mustard, 1.08)));
  } }));
  // lounge chairs
  def('living', 'lounge', 'shell', 'Lounge Chair · walnut shell', Object.assign({}, LIV, { size: [1, 1, 1], col: 'walnut', sound: 'wood', build: (b) => {
    // a low club chair: a walnut tub with a leather seat cushion (seat at 7.5), a curved back, arms and four splayed legs
    const wd = M.wood(P.walnut), le = M.leather(0x1E1F22);
    for (const [x, z, fx, fz] of [[3, 4.5, 1.5, 2.5], [13, 4.5, 14.5, 2.5], [3, 11.5, 1.5, 13.5], [13, 11.5, 14.5, 13.5]]) b.rod(x, 3.5, z, fx, 0.5, fz, 0.6, wd);
    b.rbox(2, 3.5, 2.5, 14, 5.5, 13, 1, wd);
    b.extrude([[11.5, 5], [13.5, 4.5], [15, 13.5], [14, 15], [12.5, 13.5], [11.5, 7]], 'x', 2.5, 13.5, wd);   // the curved back (z, y)
    b.cushion(2.5, 5.5, 3, 13.5, 7.5, 12.5, 1, le, true);
    b.rbox(1, 5, 3.5, 3, 9, 12.5, 0.75, wd); b.rbox(13, 5, 3.5, 15, 9, 12.5, 0.75, wd);
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
  def('living', 'mediawall', 'oak', 'Media Wall · oak slats', Object.assign({}, LIV, { cats: ['living'], seat: false, mount: 'wall', size: [3, 2, 1], col: 'oak', sound: 'wood', toggle: true, light: [6, 7, 9], build: (b) => {
    for (let x = 0; x < 48; x += 2) b.box(x, 0, 15, x + 1.5, 32, 16, M.wood(P.oak));
    b.box(0, 0, 15.5, 48, 32, 16, M.wood(sh(P.oak, 0.7)));
    b.box(2, 3, 9, 46, 7.5, 15, M.wood(P.walnut)); for (const x of [2, 13, 24, 35]) b.box(x + 0.5, 3.5, 8.5, x + 11, 7, 9, M.wood(sh(P.walnut, 0.9)));
    b.box(2.5, 2.5, 9.5, 45.5, 3, 14.5, M.light(0xFFE2B0));                                             // LED under the lowboard
    mediaTV(b, 9, 13, 39, 29);
    b.lathe(5, 12, [[7.5, 1.4], [9, 2], [11.5, 1.4], [12.5, 1.6]], M.gloss(P.white), 0.5); b.sphere(42, 9, 12, 1.5, M.gloss(P.terracotta)); b.box(30, 7.5, 10, 36, 8.5, 14, M.gloss(0x1E2024));
  } }));
  def('living', 'mediawall', 'fireplace', 'Media Wall · fireplace', Object.assign({}, LIV, { cats: ['living'], seat: false, mount: 'wall', size: [3, 2, 1], col: 'sand', sound: 'stone', toggle: true, light: [12, 7, 3], build: (b) => {
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
    // two round side tables side by side, a white marble one (top at 8) and a black one (top at 6), each on three brass legs
    // under a brass ring at the edge of the top
    const br = M.metal(P.brass);
    for (const [cx, cz, r, h, top] of [[5.5, 5.5, 4.4, 8, 0xEAEAEC], [11.5, 11.5, 3.3, 6, 0x2A2C30]]) {
      b.cyl('y', cx, cz, r, h - 0.75, h, M.marble(top)); b.tube('y', cx, cz, r, 0.5, h - 1.25, h - 0.75, br);
      for (let k = 0; k < 3; k++) { const a = k * 2.1 + 0.4; b.rod(cx + Math.cos(a) * (r - 1), h - 1.25, cz + Math.sin(a) * (r - 1), cx + Math.cos(a) * (r - 1.6), 0.5, cz + Math.sin(a) * (r - 1.6), 0.4, br); }
    }
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
  // (a round bowl: a white rim and wall, a grey-blue floor and a drain, so it reads as a basin, not a cupcake)
  function vessel(b, cx, cz, y, tapMat) {
    b.lathe(cx, cz, [[y, 2.4], [y + 0.6, 3.1], [y + 1.6, 3.5], [y + 2.2, 3.6], [y + 2.5, 3.6]], M.gloss(P.white), 0.6);
    b.cyl('y', cx, cz, 2.6, y, y + 0.4, M.gloss(0xB4C2CC)); b.cyl('y', cx, cz, 0.55, y + 0.4, y + 0.9, M.metal(0x6A7078));
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
    // a wall behind it with the flush plate, an oval bowl up to its rim, a seat ring on top, the water dug into the bowl
    const m = k === 'white' ? M.gloss(c) : M.matte(c);
    b.box(1, 0, 13, 15, 16, 16, M.stone(0xD8D4CC)); b.box(5.5, 11, 12.5, 10.5, 13.5, 13, M.metal(k === 'white' ? 0x2A2C30 : P.brass));
    ellRingFill(b, 8, 9, 2.7, 3.8, 0, 2.4, m);                         // the pedestal, set back from the bowl
    ellRingFill(b, 8, 8.6, 3.5, 4.4, 2.4, 5.6, m);                     // the bowl, to its rim
    ellRingFill(b, 8, 8.6, 4.2, 5.0, 5.6, 6.5, m);                     // the seat ring
    ellRingFill(b, 8, 8.6, 2.6, 3.4, 4.6, 6.6, 0);                     // dug out: the opening through seat and bowl
    ellRingFill(b, 8, 8.6, 2.6, 3.4, 4.6, 4.9, M.gloss(0x9ED0EC));     // the water
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
    // a round backlit mirror: the glow spills out behind a chrome frame that stands proud of the glass, with a glint
    b.tube('z', 8, 9, 6.6, 1, 15.25, 16, M.light(0xF4F6FF));                  // the halo, behind the frame
    b.tube('z', 8, 9, 6, 1, 14, 15.25, M.chrome());                           // the chrome frame
    b.cyl('z', 8, 9, 5, 14.5, 15.25, M.gloss(0xC8DCE8));                      // the glass
    b.rod(5.2, 11.5, 14.5, 7.4, 10.2, 14.5, 0.4, M.gloss(0xFFFFFF));          // a glint across it
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
  // a flat leaf blade from base B along U (length L, widest about the middle at W) in the plane of U and V: rasterised
  // voxel by voxel in a band at least one voxel thick, so it can lean any way without breaking up
  function leafBlade(b, B, U, V, L, W, m) {
    const S = b.S, ul = Math.hypot(U[0], U[1], U[2]), u = U.map(c => c / ul);
    const dv = V[0] * u[0] + V[1] * u[1] + V[2] * u[2], vv = V.map((c, i) => c - u[i] * dv), vl = Math.hypot(vv[0], vv[1], vv[2]), v = vv.map(c => c / vl);
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const h = (Math.abs(n[0]) + Math.abs(n[1]) + Math.abs(n[2])) / 2 + 0.01;   // half the band
    const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    for (const s of [0, L]) for (const a of [-W / 2, W / 2]) for (const d of [-h, h]) for (let k = 0; k < 3; k++) {
      const c = B[k] + u[k] * s + v[k] * a + n[k] * d; lo[k] = Math.min(lo[k], c); hi[k] = Math.max(hi[k], c);
    }
    for (let z = Math.floor(lo[2] * S); z < Math.ceil(hi[2] * S); z++) for (let y = Math.floor(lo[1] * S); y < Math.ceil(hi[1] * S); y++) for (let x = Math.floor(lo[0] * S); x < Math.ceil(hi[0] * S); x++) {
      const p = [(x + 0.5) / S - B[0], (y + 0.5) / S - B[1], (z + 0.5) / S - B[2]];
      const s = p[0] * u[0] + p[1] * u[1] + p[2] * u[2];
      if (s < 0 || s > L) continue;
      const a = p[0] * v[0] + p[1] * v[1] + p[2] * v[2], d = p[0] * n[0] + p[1] * n[1] + p[2] * n[2], q = s / L;
      if (Math.abs(a) <= (W / 2) * 2 * Math.sqrt(q * (1 - q)) && Math.abs(d) <= h) b.set(x, y, z, m);
    }
  }
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
      // broad paddle leaves on long stalks fanning out of the pot; the flower stands above them on its own stalk
      for (let k = 0; k < 8; k++) {
        const a = k * 0.8 + 0.3, r = 1.6 + (k % 3) * 0.7, top = 17 + (k % 4) * 2.4, ca = Math.cos(a), sa = Math.sin(a), tx = 8 + ca * r, tz = 8 + sa * r;
        b.rod(8, y, 8, tx, top, tz, 0.75, M.plant(0x4E7A3A));
        leafBlade(b, [tx, top, tz], [ca * 0.87, 0.49, sa * 0.87], [-sa, 0, ca], 5, 4.2, M.plant(k % 2 ? LEAF : LEAF2));
      }
      b.rod(8, y, 8, 9.5, 27, 9, 0.6, M.plant(0x4E7A3A));
      b.extrude([[9, 26.4], [13.2, 28.8], [14.6, 27.8], [11, 25.8]], 'z', 8.5, 9.5, M.matte(0xF08A2A));    // the orange bract
      b.extrude([[11.2, 27.2], [15.4, 30.2], [14.2, 28.3], [11.8, 26.8]], 'z', 8.5, 9.5, M.matte(0x5A6AD8)); // the blue petals
    }],
    ['palm', 'Kentia Palm', 2, (b, y) => {
      for (let k = 0; k < 7; k++) {
        const a = k * Math.PI * 2 / 7 + 0.2, dx = Math.cos(a), dz = Math.sin(a), lift = 3 + (k % 3) * 2.5;
        let px = 8, py = y, pz = 8;
        for (let s2 = 1; s2 <= 7; s2++) { const nx = 8 + dx * s2 * 1.05, ny = y + lift + s2 * 4.2 - s2 * s2 * 0.45, nz = 8 + dz * s2 * 1.05; b.rod(px, py, pz, nx, ny, nz, 0.75, M.plant(0x5A7A3A)); if (s2 > 1) b.ellipsoid(nx, ny - 0.75, nz, 2.6 * Math.abs(dz) + 0.6, 0.6, 2.6 * Math.abs(dx) + 0.6, M.plant(s2 % 2 ? LEAF : LEAF2)); px = nx; py = ny; pz = nz; }
      }
    }],
    ['rubber', 'Rubber Plant', 2, (b, y) => {
      // a stem with big glossy leaves spiralling up it, each a flat blade leaning out and up, two greens; a red bud on top
      b.lathe(8, 8, [[y, 1], [27.5, 0.7]], M.plant(0x5A4A3A));
      for (let k = 0; k < 9; k++) {
        const a = k * 2.4, h = y + 2.5 + k * 2.2, ca = Math.cos(a), sa = Math.sin(a), phi = 0.55 - k * 0.04;
        leafBlade(b, [8 + ca * 0.5, h, 8 + sa * 0.5], [ca * Math.cos(phi), Math.sin(phi), sa * Math.cos(phi)], [-sa, 0, ca], 5.8, 3.6, M.gloss(k % 2 ? 0x2F6B3C : 0x3F7F48));
      }
      b.ellipsoid(8, 27.8, 8, 1, 1.6, 1, M.plant(0x8A3A3A));
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

  // ================================================================ BÜRO & TECHNIK — desks, chairs, the gaming corner, the office
  const OF = { cats: ['office'], res: 32, sound: 'wood', hard: 0.8 };
  // a monitor on an arm clamped to the back of a desk top at y (screen centre x, width w)
  function monitor(b, cx, y, w, z) {
    z = z === undefined ? 12 : z;
    b.box(cx - 0.5, y, 14, cx + 0.5, y + 7, 15, M.metal(P.black)); b.box(cx - 0.5, y + 5.5, z + 0.5, cx + 0.5, y + 6.5, 14, M.metal(P.black));
    b.box(cx - w / 2, y + 3, z - 0.5, cx + w / 2, y + 9, z + 0.5, M.gloss(0x141518)); screenUI(b, cx - w / 2 + 0.5, y + 3.5, cx + w / 2 - 0.5, y + 8.5, z - 0.5, 'desk');
  }
  // a height-adjustable frame: two T-legs (feet, telescopic columns) under a top at y
  function liftFrame(b, x0, x1, y, m) {
    for (const x of [x0 + 2, x1 - 4]) { b.box(x, 0, 3.5, x + 2, 1, 14.5, m); b.box(x + 0.25, 1, 8, x + 1.75, y - 1, 9.5, m); b.box(x, 1, 7.75, x + 2, Math.min(y - 1, 7), 9.75, m); }
    b.box(x0 + 2, y - 1, 8, x1 - 2, y - 0.5, 9.5, m);
  }
  const deskTop = (b, x0, x1, y, mat) => b.pbox(x0, y, 3, x1, y + 1, 15, 0.5, mat);
  def('office', 'desk', 'oak', 'Desk · height adjustable oak', Object.assign({}, OF, { size: [2, 2, 1], col: 'oak', build: (b) => {
    liftFrame(b, 0, 32, 11.5, M.metal(P.black)); deskTop(b, 0.5, 31.5, 11.5, M.wood(P.oak));
    monitor(b, 16, 12.5, 11);
    b.rbox(11, 12.5, 5, 21, 13, 8, 0.25, M.gloss(0x2A2D33)); b.rbox(22, 12.5, 5.5, 23.5, 13, 7.5, 0.25, M.gloss(0x2A2D33));
    b.box(27, 12.5, 11, 29, 13, 13, M.metal(P.black)); b.rod(28, 13, 12, 28, 18, 12, 0.5, M.metal(P.black)); b.box(25, 18, 9, 29, 18.5, 13, M.metal(P.black)); b.box(25.5, 17.5, 9.5, 28.5, 18, 12.5, M.light(0xFFF4E4));   // LED desk lamp
    b.lathe(4, 11, [[12.5, 1.6], [14.5, 2], [16, 1.6]], M.gloss(P.terracotta), 0.4); b.sphere(4, 17.5, 11, 2, M.plant(P.leaf));
    b.lathe(7.5, 6, [[12.5, 0.8], [14.5, 0.8]], M.gloss(P.white));
  } }));
  def('office', 'desk', 'standing', 'Standing Desk · white raised', Object.assign({}, OF, { size: [2, 2, 1], col: 'white', build: (b) => {
    liftFrame(b, 0, 32, 17, M.gloss(P.white)); deskTop(b, 0.5, 31.5, 17, M.gloss(P.white));
    monitor(b, 12, 18, 10); monitor(b, 23, 18, 10);
    b.rbox(13, 18, 5, 22, 18.5, 8, 0.25, M.gloss(P.white)); b.box(3, 18, 5, 9, 18.5, 9.5, M.metal(P.steel)); b.box(3, 18.5, 9, 9, 22.5, 9.5, M.metal(P.steel)); b.box(3.5, 18.75, 8.5, 8.5, 22, 9, M.light(0x2A4A6A));   // a laptop
    b.box(26, 0, 4, 31, 1, 13, M.matte(0x3A3D44));                                                    // an anti-fatigue mat
  } }));
  def('office', 'desk', 'gaming', 'Gaming Desk · RGB', Object.assign({}, OF, { size: [2, 2, 1], col: 'black', toggle: true, light: [8, 3, 13], build: (b) => {
    const m = M.metal(P.black);
    for (const x of [1, 29]) { b.box(x, 0, 3.5, x + 2, 11, 5, m); b.box(x, 0, 13, x + 2, 11, 14.5, m); b.box(x, 0, 3.5, x + 2, 1, 14.5, m); }
    b.box(0.5, 11, 3, 31.5, 12, 15, M.matte(0x1E1F22)); b.box(0.5, 10.5, 2.5, 31.5, 11, 3, M.light(0xB04AF0));                  // RGB strip along the front
    b.box(2, 12, 3.5, 30, 12.25, 10, M.matte(0x2A2C30));                                                                         // the desk mat
    b.box(15.5, 12, 13, 16.5, 19, 14, m); for (const [x0, x1, z0, z1] of [[5, 11, 13.5, 12], [11, 21, 12, 12], [21, 27, 12, 13.5]]) { b.extrude([[x0, z0], [x1, z1], [x1, z1 + 0.5], [x0, z0 + 0.5]], 'y', 15, 21, M.gloss(0x141518)); }   // a curved ultrawide
    b.box(11, 15.5, 11.5, 21, 20.5, 12, M.light(0x3A1E5A)); b.box(6, 15.5, 12.5, 10.5, 20.5, 13, M.light(0x1E3A5A)); b.box(21.5, 15.5, 12.5, 26, 20.5, 13, M.light(0x1E3A5A));
    b.rbox(10, 12.25, 5, 19, 12.75, 7.5, 0.25, M.gloss(0x141518)); for (let x = 10.5; x < 18.5; x += 1) b.box(x, 12.5, 5.5, x + 0.5, 13, 7, M.light([0xF04A4A, 0xF0B04A, 0x4AF07A, 0x4AB0F0, 0xB04AF0][(x | 0) % 5]));
    b.rbox(21, 12.25, 5.5, 22.5, 12.75, 7.5, 0.25, M.gloss(0x141518)); b.box(3, 12, 10, 4, 16, 11, m); b.rbox(2.5, 15, 9.5, 4.5, 17, 11.5, 0.5, M.gloss(0x2A2C30));   // mouse, headset stand
  } }));
  def('office', 'chair', 'mesh', 'Office Chair · ergonomic mesh', Object.assign({}, OF, { size: [1, 1, 1], col: 'black', seat: true, sound: 'metal', build: (b) => {
    const m = M.metal(P.black);
    for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5 + 0.3; b.rod(8, 1, 8, 8 + Math.cos(a) * 6, 1, 8 + Math.sin(a) * 6, 0.6, m); b.sphere(8 + Math.cos(a) * 6, 0.5, 8 + Math.sin(a) * 6, 0.6, M.gloss(0x111214)); }
    b.cyl('y', 8, 8, 0.8, 1, 6.5, M.chrome()); b.box(5, 6.5, 5, 11, 7, 11, m);
    b.cushion(2.5, 7, 2, 13.5, 8.5, 13, 1, M.fabric(0x2E3136), true);
    b.box(7, 7, 12.5, 9, 10, 14, m); b.rbox(3, 9.5, 12.5, 13, 16, 14, 1, M.fabric(0x3A3F48)); b.box(3.5, 10, 12, 12.5, 15.5, 12.5, M.fabric(0x25282D));   // mesh back
    for (const x of [2.5, 13]) { b.box(x, 7, 7.5, x + 0.5, 11, 8.5, m); b.rbox(x - 0.5, 11, 4.5, x + 1, 11.75, 10.5, 0.25, M.gloss(0x111214)); }
  } }));
  def('office', 'chair', 'gaming', 'Gaming Chair · black red', Object.assign({}, OF, { size: [1, 2, 1], col: 'black', seat: true, sound: 'metal', build: (b) => {
    const m = M.metal(P.black), le = M.leather(0x1E1F22), red = M.leather(0xB8322A);
    for (let k = 0; k < 5; k++) { const a = k * Math.PI * 2 / 5 + 0.3; b.rod(8, 1, 8, 8 + Math.cos(a) * 6, 1, 8 + Math.sin(a) * 6, 0.6, m); }
    b.cyl('y', 8, 8, 0.8, 1, 6.5, M.chrome());
    b.cushion(2.5, 6.5, 2, 13.5, 8.5, 13, 1, le, true); b.cushion(2, 7, 2, 4, 10, 12, 0.75, red, false); b.cushion(12, 7, 2, 14, 10, 12, 0.75, red, false);   // bucket seat wings
    b.cushion(3, 8.5, 12.5, 13, 21.5, 14.5, 1, le, true); b.cushion(2.5, 9, 12, 4, 19, 14.5, 0.75, red, false); b.cushion(12, 9, 12, 13.5, 19, 14.5, 0.75, red, false);
    b.box(6, 19, 12, 10, 20.5, 12.5, red); b.cut(5, 17.5, 12, 6, 18.5, 15); b.cut(10, 17.5, 12, 11, 18.5, 15);      // belt slots, a pillow
    for (const x of [1.5, 13.5]) b.rbox(x, 10.5, 5, x + 1, 11.25, 10, 0.25, M.gloss(0x111214));
  } }));
  // a showcase case (56 cm): panoramic glass front and side, so the lit parts inside show
  def('office', 'pc', 'rgb', 'PC Tower · RGB glass', Object.assign({}, OF, { size: [1, 1, 1], col: 'black', toggle: true, light: [7, 4, 12], sound: 'metal', build: (b) => {
    const k = M.metal(P.black), glass = M.glass(0x5A5E68);
    b.box(5.5, 0.5, 4, 10.5, 9.5, 12, k); for (const [x, z] of [[5.5, 4], [10, 4], [5.5, 11.5], [10, 11.5]]) b.box(x, 0, z, x + 0.5, 0.5, z + 0.5, M.matte(0x111214));
    b.cut(5.5, 1, 4, 10, 9, 11.5); b.box(5.5, 1, 4, 10, 9, 4.5, glass); b.box(5.5, 1, 4.5, 6, 9, 11.5, glass);              // the glass: front and side, no pillar
    b.box(9.5, 3, 5, 10, 9, 11.5, M.matte(0x1E2024));                                                                         // the motherboard
    b.box(6, 1, 4.5, 10, 3, 11.5, M.metal(P.graphite)); b.box(7, 1.5, 4.5, 9, 2, 5, M.light(0xF0F0FF));                     // the PSU shroud, its lit logo
    b.box(7, 4, 6, 9.5, 5.5, 11.5, M.metal(0x3A3D44)); b.box(7, 5, 6, 7.5, 5.5, 11, M.light(0x4AB0F0));                    // the graphics card, its RGB edge
    b.box(8.5, 6.5, 7, 9.5, 8, 8.5, M.metal(0x2A2C30)); b.tube('x', 7.25, 7.75, 0.75, 0.5, 8, 8.5, M.light(0xB04AF0));     // the pump with its ring
    for (const z of [9.5, 10.5]) { b.box(8.5, 6, z, 9.5, 8.5, z + 0.5, M.metal(0x2A2C30)); b.box(8.5, 8, z, 9.5, 8.5, z + 0.5, M.light(0x4AF07A)); }   // RAM
    for (const y of [4.75, 7.5]) { b.tube('z', 8, y, 1.25, 0.5, 4.5, 5, M.light(0xB04AF0)); b.cyl('z', 8, y, 0.5, 4.5, 5, M.gloss(0x2A2C30)); }   // the fans behind the front glass
    b.box(9, 9.5, 4.5, 9.5, 10, 5, M.light(0xF0F0FF));                                                                         // the power button
  } }));
  def('office', 'bookcase', 'cubes', 'Bookcase · cube grid oak', Object.assign({}, OF, { cats: ['office', 'storage', 'living'], size: [2, 2, 1], col: 'oak', build: (b) => {
    const o = M.wood(P.oak);
    for (let k = 0; k <= 4; k++) { b.box(0.5 + k * 7.6, 0, 8, 1.5 + k * 7.6, 31, 16, o); b.box(0.5, k * 7.6, 8, 31.9, k * 7.6 + 1, 16, o); }
    const fill = [['b', 4], ['x', P.sage], ['p'], ['b', 3], ['x', P.cream], ['b', 5], ['v'], ['x', P.terracotta], ['b', 4], ['p'], ['x', P.graphite], ['b', 3], ['v'], ['x', P.sand], ['b', 5], ['p']];
    let i = 0;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const x = 1.5 + c * 7.6, y = 1 + r * 7.6, it = fill[i++];
      if (it[0] === 'b') books(b, x + 0.5, y, 10, it[1] + 2);
      else if (it[0] === 'x') b.box(x + 0.5, y, 9.5, x + 6, y + 5, 15.5, M.fabric(it[1]));
      else if (it[0] === 'p') { b.box(x + 2, y, 10.5, x + 4.5, y + 2.5, 13, M.gloss(P.white)); b.box(x + 1.5, y + 2.5, 10, x + 5, y + 5, 13.5, M.plant(P.leaf)); }
      else { b.box(x + 2.5, y, 11, x + 4.5, y + 4.5, 13, M.gloss(P.sky)); b.box(x + 3, y + 4.5, 11.5, x + 4, y + 5.5, 12.5, M.gloss(P.sky)); }
    }
  } }));
  def('office', 'filing', 'white', 'Filing Cabinet · white', Object.assign({}, OF, { cats: ['office', 'storage'], size: [1, 1, 1], col: 'white', ui: 'chest', sound: 'metal', build: (b) => {
    b.box(3.5, 1, 2, 12.5, 11.5, 14, M.gloss(P.white)); for (const [x, z] of [[4, 2.5], [11.5, 2.5], [4, 13], [11.5, 13]]) b.sphere(x + 0.25, 0.5, z + 0.25, 0.5, M.gloss(0x2A2C30));
    for (const [y0, y1] of [[1.5, 4.5], [5, 8], [8.5, 11]]) { b.box(4, y0, 1.5, 12, y1, 2, M.gloss(P.white)); b.box(6, y1 - 1, 1, 10, y1 - 0.5, 1.5, M.metal(P.graphite)); }
    b.cushion(4, 11.5, 2.5, 12, 13, 13.5, 0.75, M.fabric(P.sage), true);
  } }));
  def('office', 'printer', 'cabinet', 'Printer Cabinet · laser', Object.assign({}, OF, { cats: ['office', 'storage'], size: [1, 1, 1], col: 'graphite', ui: 'chest', sound: 'metal', build: (b) => {
    b.box(1, 0.5, 2.5, 15, 8.5, 15.5, M.matte(P.graphite)); b.box(1.5, 1, 2, 7.75, 8, 2.5, M.matte(sh(P.graphite, 1.1))); b.box(8.25, 1, 2, 14.5, 8, 2.5, M.matte(sh(P.graphite, 1.1)));
    b.box(2.5, 8.5, 4, 13.5, 13, 14, M.gloss(0xE8E8E4)); b.box(2.5, 11.5, 4, 13.5, 13, 14, M.gloss(0x3A3D44)); b.box(3.5, 9.5, 3.5, 12.5, 10.5, 4, M.gloss(0x3A3D44));
    b.box(4, 13, 6, 12, 13.5, 11, M.matte(0xF8F8F4)); b.box(10.5, 12, 3.5, 12.5, 12.5, 4, M.light(0x4AE08A));
  } }));
  def('office', 'meeting', 'oak', 'Meeting Table · oak', Object.assign({}, OF, { cats: ['office', 'table'], size: [3, 1, 2], col: 'oak', build: (b) => {
    b.pbox(0.5, 11, 3, 47.5, 12, 29, 2, M.wood(P.oak)); b.box(1, 10.5, 3.5, 47, 11, 28.5, M.wood(sh(P.oak, 0.85)));
    for (const x of [10, 36]) { b.box(x - 1, 0, 12, x + 1, 10.5, 20, M.metal(P.black)); b.box(x - 1.5, 0, 8, x + 1.5, 1, 24, M.metal(P.black)); }
    b.box(20, 12, 14, 28, 12.5, 18, M.metal(P.graphite)); for (const x of [21, 23, 25]) b.box(x, 12.5, 15.5, x + 1, 12.75, 16.5, M.matte(P.black));   // the cable box
    for (const [x, z, f] of [[10, 7, 0], [36, 25, 1]]) { b.box(x - 3, 12, z - 2, x + 3, 12.5, z + 2, M.metal(P.steel)); b.box(x - 3, 12.5, z + (f ? -2 : 1.5), x + 3, 16, z + (f ? -1.5 : 2), M.metal(P.steel)); b.box(x - 2.5, 13, z + (f ? -1.5 : 1), x + 2.5, 15.5, z + (f ? -1 : 1.5), M.light(0x2A4A6A)); }
    for (const [x, z] of [[18, 8], [30, 24], [42, 8], [6, 24]]) b.lathe(x, z, [[12, 0.8], [14.5, 0.8]], M.glass(0xD8ECF4), 0.3);
  } }));
  def('office', 'whiteboard', 'mobile', 'Whiteboard · mobile', Object.assign({}, OF, { size: [2, 2, 1], col: 'white', sound: 'metal', build: (b) => {
    const m = M.metal(P.steel);
    for (const x of [2, 29]) { b.box(x, 1, 7.5, x + 1, 30, 8.5, m); b.box(x - 0.5, 0.5, 4, x + 1.5, 1, 12, m); b.sphere(x + 0.5, 0.5, 4.5, 0.5, M.gloss(0x111214)); b.sphere(x + 0.5, 0.5, 11.5, 0.5, M.gloss(0x111214)); }
    b.box(3, 10, 7.5, 29, 29, 8.5, m); b.box(3.5, 10.5, 7, 28.5, 28.5, 7.5, M.gloss(0xFAFAF8));
    b.box(18, 26, 6.5, 27, 26.5, 7, M.matte(0x2F55C8)); for (const [x, h, c] of [[25, 4, 0x2F55C8], [22.5, 7, 0xC0443A], [20, 5.5, 0x3E8A4A], [17.5, 9, 0x2F55C8]]) b.box(x, 13, 6.5, x + 1.5, 13 + h, 7, M.matte(c));
    b.box(5, 22, 6.5, 14, 22.5, 7, M.matte(0x2A2D33)); b.box(7, 19, 6.5, 14, 19.5, 7, M.matte(0x2A2D33)); b.box(6, 16, 6.5, 14, 16.5, 7, M.matte(0x2A2D33));
    b.box(4, 9.5, 6.5, 28, 10, 8.5, m); b.box(20, 10, 6.75, 22, 10.5, 7.25, M.matte(0xC0443A)); b.box(23, 10, 6.75, 25, 10.5, 7.25, M.matte(0x2F55C8));
  } }));
  def('office', 'booth', 'acoustic', 'Phone Booth · acoustic', Object.assign({}, OF, { size: [1, 2, 1], col: 'graphite', toggle: true, light: [11, 10, 8], sound: 'wool', build: (b) => {
    const felt = M.fabric(0x5A5E64);
    b.box(0, 0, 0, 16, 1, 16, M.matte(P.graphite)); b.box(0, 30, 0, 16, 32, 16, M.matte(P.graphite));
    b.box(0, 1, 0, 1.5, 30, 16, felt); b.box(14.5, 1, 0, 16, 30, 16, felt); b.box(1.5, 1, 14.5, 14.5, 30, 16, felt);
    b.box(1.5, 1, 0, 14.5, 30, 0.5, M.glass(0xC8DCE4)); b.box(1.5, 1, 0, 2, 30, 1, M.metal(P.black)); b.box(14, 1, 0, 14.5, 30, 1, M.metal(P.black)); b.box(12.5, 13, 0, 13, 18, 1, M.metal(P.black));
    b.box(2, 9, 8, 14, 12.5, 14.5, M.fabric(P.mustard)); b.box(2, 1, 9, 14, 9, 14.5, M.matte(P.graphite)); b.box(2, 18.5, 11, 14, 19, 14.5, M.wood(P.oak));
    b.box(5, 29.5, 5, 11, 30, 11, M.light(0xFFF0D8)); b.box(3, 19, 12, 8, 19.5, 14, M.metal(P.steel));
  } }));
  def('office', 'rack', 'server', 'Server Rack · 42U', Object.assign({}, OF, { size: [1, 2, 1], col: 'black', light: [2, 5, 3], sound: 'metal', hard: 1.5, build: (b) => {
    b.box(2, 0, 1.5, 14, 32, 15, M.metal(P.black)); b.box(2.5, 1, 1, 13.5, 31, 1.5, M.glass(0x2A2E36));
    for (let y = 2; y < 30; y += 1.5) { b.box(3, y, 2, 13, y + 1, 2.5, M.metal(0x2E3136)); if ((y * 7) % 3 < 2) b.box(11, y + 0.25, 1.5, 11.5, y + 0.75, 2, M.light((y * 13) % 5 ? 0x4AE08A : 0xF0B04A)); if ((y * 5) % 4 < 1) b.box(4, y + 0.25, 1.5, 7, y + 0.75, 2, M.light(0x4AB0F0)); }
  } }));
  def('office', 'screen', 'mobile', 'Video Screen · rolling stand', Object.assign({}, OF, { size: [2, 2, 1], col: 'black', sound: 'metal', build: (b) => {
    const m = M.metal(P.black);
    b.box(6, 0.5, 3, 26, 1.5, 13, m); for (const [x, z] of [[6.5, 3.5], [25, 3.5], [6.5, 12], [25, 12]]) b.sphere(x + 0.25, 0.5, z + 0.25, 0.5, M.gloss(0x111214));
    for (const x of [11, 20]) b.box(x, 1.5, 8, x + 1, 26, 9, m); b.box(12, 6, 7.5, 20, 7, 9.5, M.gloss(0x2A2C30));
    b.box(1, 12, 7, 31, 30, 8, M.gloss(0x141518)); b.box(1.5, 12.5, 6.5, 30.5, 29.5, 7, M.light(0x1E3A5A));
    for (let k = 0; k < 4; k++) { const x = 2.5 + k * 7; b.box(x, 13.5, 6, x + 6.5, 20.5, 6.5, M.light([0x3A5A7A, 0x5A4A3A, 0x3A6A5A, 0x6A5A7A][k])); b.sphere(x + 3.25, 18, 6, 1.5, M.light(0xD8B8A0)); }
    b.box(10, 21.5, 6, 22, 28.5, 6.5, M.light(0x4A6A8A)); b.sphere(16, 26, 6, 2, M.light(0xD8B8A0));
  } }));
  def('office', 'panel', 'felt', 'Acoustic Panels · felt hex', Object.assign({}, OF, { cats: ['office', 'deco'], size: [2, 1, 1], col: 'sage', mount: 'wall', solid: false, sound: 'wool', build: (b) => {
    const hex = (cx, cy, r) => { const p = []; for (let k = 0; k < 6; k++) p.push([cx + Math.cos(k * Math.PI / 3) * r, cy + Math.sin(k * Math.PI / 3) * r]); return p; };
    const cols = [P.sage, P.olive, P.cream, P.sage, 0x7E8A76, P.olive, P.cream];
    let k = 0; for (let c = 0; c < 6; c++) for (let r = 0; r < 2; r++) { const cx = 3.5 + c * 5, cy = 4.5 + r * 6 + (c % 2) * 3; if (cy + 2.6 > 16) continue; b.extrude(hex(cx, cy, 2.8), 'z', 14.5 - (k % 3) * 0.5, 16, M.fabric(cols[k++ % cols.length])); }
  } }));
  def('office', 'laptopdesk', 'walnut', 'Laptop Desk · walnut', Object.assign({}, OF, { size: [1, 1, 1], col: 'walnut', ui: 'chest', build: (b) => {
    const w = M.wood(P.walnut);
    for (const [x, z] of [[1.5, 4.5], [13.5, 4.5], [1.5, 13.5], [13.5, 13.5]]) b.lathe(x + 0.5, z + 0.5, [[0, 0.6], [11, 0.75]], w);
    b.pbox(1, 11, 4, 15, 12, 15, 0.5, w); b.box(3, 9.5, 4.5, 13, 11, 14.5, w); b.box(3.5, 9.75, 4, 12.5, 10.75, 4.5, M.wood(sh(P.walnut, 0.88)));
    b.box(4, 12, 6, 12, 12.5, 11, M.metal(P.steel)); b.box(4, 12.5, 10.5, 12, 16, 11, M.metal(P.steel)); b.box(4.5, 13, 10, 11.5, 15.5, 10.5, M.light(0x2A4A6A));
    b.lathe(13.5, 7, [[12, 0.9], [14, 0.9]], M.gloss(P.white)); b.lathe(2.5, 12.5, [[12, 0.9], [13.5, 1.1]], M.gloss(P.terracotta)); b.sphere(2.5, 14.5, 12.5, 1.3, M.plant(P.leaf));
  } }));
  def('office', 'printer3d', 'enclosed', '3D Printer · enclosed', Object.assign({}, OF, { size: [1, 1, 1], col: 'black', sound: 'metal', build: (b) => {
    b.box(2, 0, 3, 14, 4, 14, M.wood(P.oak)); b.box(2.5, 0, 3.5, 3, 4, 13.5, M.wood(P.oak));
    b.box(3, 4, 4, 13, 14.5, 13.5, M.metal(P.black)); b.cut(3.5, 5, 4, 12.5, 13.5, 13); b.box(3.5, 5, 4, 12.5, 13.5, 4.5, M.glass(0xE8D0B8));
    b.box(4, 5, 5, 12, 5.5, 12.5, M.metal(0x6A7078)); b.box(4, 11.5, 8, 12, 12, 9, M.metal(0x9AA0A6)); b.box(7, 10.5, 7.5, 9, 11.5, 9.5, M.metal(P.steel));
    b.lathe(8, 9, [[5.5, 1.8], [7, 1.5], [8.5, 0.9]], M.gloss(0xF07E1E)); b.box(9.5, 4.5, 3.5, 12.5, 5.5, 4, M.light(0x4AB0F0));
  } }));
  def('office', 'vending', 'coffee', 'Coffee Machine · office', Object.assign({}, OF, { cats: ['office', 'kitchen'], size: [1, 2, 1], col: 'anthracite', light: [3, 4, 5], sound: 'metal', hard: 1.2, build: (b) => {
    b.box(1.5, 0, 4, 14.5, 28, 15, M.metal(P.anthracite)); b.box(1.5, 27, 3.5, 14.5, 28, 15, M.metal(P.steel));
    b.box(3, 16, 3.5, 13, 24, 4, M.gloss(0x141518)); screenUI(b, 3.5, 16.5, 12.5, 23.5, 3.5, 'tiles');
    b.box(5, 8, 3.5, 11, 13, 4, M.gloss(0x141518)); b.cut(5.5, 8.5, 3.5, 10.5, 12.5, 6); b.box(5.5, 8.5, 6, 10.5, 12.5, 6.5, M.light(0x5A4A3A)); b.lathe(8, 5, [[8.5, 0.8], [10.5, 1]], M.gloss(P.white));
    b.box(3, 2, 3.5, 13, 6, 4, M.metal(sh(P.anthracite, 1.2))); b.box(10, 26, 3, 13, 26.5, 3.5, M.light(0x4AE08A));
  } }));
  def('office', 'pinboard', 'cork', 'Pinboard · cork', Object.assign({}, OF, { cats: ['office', 'deco'], size: [2, 1, 1], col: 'sand', mount: 'wall', solid: false, sound: 'wood', build: (b) => {
    b.box(1, 2, 15, 31, 14, 16, M.wood(P.oak)); b.box(1.5, 2.5, 14.5, 30.5, 13.5, 15, M.matte(0xC09A6A));
    const notes = [[3, 9, 0xF4E07A], [7, 4, 0xF2F2EE], [10.5, 8.5, 0x8AB4D4], [15, 4.5, 0xF2F2EE], [18, 9, 0xF0A0B0], [22.5, 4, 0xD8F0A0], [26, 8, 0xF2F2EE]];
    for (const [x, y, c] of notes) { b.box(x, y, 14, x + 3, y + 3.5, 14.5, M.matte(c)); b.box(x + 1.25, y + 2.5, 13.5, x + 1.75, y + 3, 14, M.gloss([0xC0443A, 0x2F55C8, 0x3E8A4A][(x | 0) % 3])); }
    b.box(13, 9, 14, 17, 12.5, 14.5, M.matte(0x5A7A9A));
  } }));
  def('office', 'lockers', 'sage', 'Office Lockers · sage', Object.assign({}, OF, { cats: ['office', 'storage'], size: [2, 2, 1], col: 'sage', ui: 'chest', sound: 'metal', build: (b) => {
    b.box(0.5, 0, 4, 31.5, 30, 16, M.metal(sh(P.sage, 0.85))); b.box(0.5, 0, 4, 31.5, 1, 15.5, M.matte(DARK));
    for (let c = 0; c < 4; c++) for (let r = 0; r < 3; r++) {
      const x = 1 + c * 7.6, y = 1.5 + r * 9.5;
      b.box(x, y, 3.5, x + 7.1, y + 9, 4, M.metal(P.sage)); b.box(x + 5.5, y + 3.5, 3, x + 6, y + 5.5, 3.5, M.metal(P.black));
      for (let s = 0; s < 2; s++) b.box(x + 1.5, y + 6.5 + s * 1, 3, x + 4.5, y + 7 + s * 1, 3.5, M.metal(sh(P.sage, 0.75)));
    }
  } }));

  // ================================================================ GARTEN & POOL — outdoor living, the pool, the garden
  const GA = { cats: ['garden'], res: 32, sound: 'wood', hard: 0.8 };
  const WATER = 0x7AC8E8;
  def('garden', 'hottub', 'cedar', 'Hot Tub · cedar', Object.assign({}, GA, { size: [2, 1, 2], col: 'oak', light: [2, 6, 8], build: (b) => {
    const c = M.wood(0xA8704A), cd = M.wood(0x8A5A3A);
    b.pbox(0, 0, 3, 32, 14, 32, 1, c); for (let x = 1; x < 32; x += 2) b.recolor(x, 0, 2.5, x + 0.5, 14, 3.5, cd); for (let z = 4; z < 32; z += 2) { b.recolor(-1, 0, z, 0.5, 14, z + 0.5, cd); b.recolor(31.5, 0, z, 33, 14, z + 0.5, cd); }
    b.pbox(2, 3, 5, 30, 14, 30, 3, 0); b.pbox(2, 3, 5, 30, 12, 30, 3, M.gloss(WATER)); b.box(2.5, 13.5, 5.5, 29.5, 14, 6, M.wood(0xC08A5A));
    for (const [x, z] of [[8, 12], [24, 12], [16, 24], [8, 22], [24, 22]]) b.cyl('y', x, z, 0.75, 11.5, 12, M.light(0xA8F0FF));   // jets glowing under water
    b.box(10, 0, 0, 22, 4.5, 3, c); b.box(10, 4.5, 1.5, 22, 5, 3, cd);                                                // the step
    b.box(26, 14, 26, 31, 14.5, 31, M.matte(0x3A3D44)); b.box(26.5, 14.5, 26.5, 30.5, 15, 30.5, M.light(0x4AE08A));     // control panel
  } }));
  def('garden', 'poolladder', 'steel', 'Pool Ladder · steel', Object.assign({}, GA, { size: [1, 2, 1], col: 'chrome', solid: false, sound: 'metal', build: (b) => {
    const c = M.chrome();
    for (const x of [3, 13]) { b.rod(x, 0, 8, x, 18, 8, 0.6, c); for (let k = 0; k <= 8; k++) { const a = k * Math.PI / 8; const a2 = (k + 1) * Math.PI / 8; if (k < 8) b.rod(x, 18 + Math.sin(a) * 4, 8 + (1 - Math.cos(a)) * 3.75, x, 18 + Math.sin(a2) * 4, 8 + (1 - Math.cos(a2)) * 3.75, 0.6, c); } b.rod(x, 18, 15.5, x, 14, 15.5, 0.6, c); }
    for (const y of [3, 8, 13]) b.box(3, y, 6, 13, y + 0.75, 9, M.metal(P.steel));
  } }));
  def('garden', 'poolshower', 'teak', 'Pool Shower · teak', Object.assign({}, GA, { size: [1, 2, 1], col: 'chrome', sound: 'metal', build: (b) => {
    for (let x = 1; x < 15; x += 1.5) b.box(x, 0, 1, x + 1, 1, 15, M.wood(0xA8865A)); b.box(1, 0, 3, 15, 0.5, 4, M.wood(0x8A6A48)); b.box(1, 0, 12, 15, 0.5, 13, M.wood(0x8A6A48));
    b.cyl('y', 8, 13, 0.9, 1, 30, M.chrome()); b.rod(8, 30, 13, 8, 30, 7, 0.75, M.chrome()); b.cyl('y', 8, 7, 3, 29, 29.5, M.chrome()); b.cyl('y', 8, 7, 2.6, 28.5, 29, M.metal(0x9AA0A6));
    b.cyl('z', 8, 16, 1, 12, 12.5, M.chrome()); b.rod(8, 14, 12.5, 8, 13, 11, 0.5, M.chrome());
  } }));
  // the ring is a torus; the neck rises from its front in an S, the head looks ahead, the tail stands up at the back
  def('garden', 'poolfloat', 'flamingo', 'Pool Float · flamingo', Object.assign({}, GA, { res: 16, size: [1, 1, 1], col: 'blush', solid: false, sound: 'wool', hard: 0.2, build: (b) => {
    const pk = M.gloss(0xF28AB0);
    torus(b, 8, 1.75, 8.5, 4.4, 1.75, pk);
    const neck = [[8, 2.5, 4.5], [8, 5.5, 3.6], [8, 8.5, 4.4], [8, 10.5, 6], [8, 12.5, 6.2], [8, 13.5, 5]];
    for (let k = 0; k + 1 < neck.length; k++) b.rod(...neck[k], ...neck[k + 1], 0.9, pk);
    b.ellipsoid(8, 13.5, 4.8, 1.3, 1.2, 1.7, pk);                                                       // the head
    b.rod(8, 13.5, 3.5, 8, 12.5, 2.5, 0.6, M.gloss(0xF6F2EA)); b.rod(8, 12.5, 2.5, 8, 11.5, 2.5, 0.5, M.gloss(0x1E2024));   // the beak, its black tip
    for (const x of [6, 9]) b.box(x, 13, 4, x + 1, 14, 5, M.gloss(0x1E2024));                            // eyes
    b.extrude([[12, 2.5], [15.5, 6], [15.5, 4.5], [14.5, 2.5]], 'x', 7, 9, pk);                          // the tail
  } }));
  // a pool lounger, 2 m: teak rails and slats, a raised back on a prop, wheels at the head end, white cushions
  def('garden', 'lounger', 'teak', 'Sun Lounger · teak', Object.assign({}, GA, { cats: ['garden', 'seat'], size: [2, 1, 1], col: 'oak', seat: true, build: (b) => {
    const t = M.wood(0xA8865A), td = M.wood(0x8A6A48), cu = M.fabric(0xF2F0EA);
    for (const z of [2.5, 12.5]) b.box(1, 3.5, z, 30, 5, z + 1, t);                                        // the side rails
    for (let x = 1.5; x < 21; x += 1.5) b.box(x, 4.5, 3.5, x + 1, 5, 12.5, t);                              // slats
    for (const z of [2.5, 12.5]) { b.box(1.5, 0, z, 3, 3.5, z + 1, td); b.box(24.5, 0, z, 26, 3.5, z + 1, td); }   // legs
    for (const z of [1.5, 13.5]) { b.cyl('z', 28.5, 2, 2, z, z + 1, M.matte(0x2A2C30)); b.cyl('z', 28.5, 2, 1, z - 0.5, z + 1.5, td); }   // wheels
    b.beam(21, 5, 29.5, 15, 3.5, 12.5, 1, t); b.beam(25, 5, 27, 11.5, 6, 10, 1, td);                       // the raised back, its prop
    b.cushion(1.5, 5, 3.5, 21.5, 6.5, 12.5, 0.75, cu, true); b.beam(20, 6, 28.5, 15.75, 3.5, 12.5, 1.5, cu);
    b.rbox(14, 6.5, 4.5, 19, 7.5, 11.5, 0.5, M.fabric(P.sage)); b.box(14, 6.5, 6, 19, 7.5, 6.5, M.fabric(0xF2F0EA));   // a folded towel
  } }));
  def('garden', 'daybed', 'canopy', 'Daybed · canopy', Object.assign({}, GA, { cats: ['garden', 'seat'], size: [2, 2, 2], col: 'white', seat: true, sound: 'wool', build: (b) => {
    const fr = M.wood(0xA8865A), cloth = M.fabric(0xF2F0EA);
    for (const [x, z] of [[0.5, 0.5], [30.5, 0.5], [0.5, 30.5], [30.5, 30.5]]) b.box(x, 0, z, x + 1, 30, z + 1, fr);
    for (const z of [0.5, 30.5]) b.box(0.5, 29, z, 31.5, 30, z + 1, fr); for (const x of [0.5, 30.5]) b.box(x, 29, 0.5, x + 1, 30, 31.5, fr);
    b.box(1.5, 2, 1.5, 30.5, 4.5, 30.5, fr); b.cushion(2, 4.5, 2, 30, 8, 30, 1.25, M.fabric(0xE8E2D4), true);
    for (let k = 0; k < 4; k++) b.cushion(3 + k * 6.5, 7.5, 25, 8.5 + k * 6.5, 13, 29.5, 1.5, M.fabric([0xE8E2D4, P.sage, 0xE8E2D4, P.terracotta][k]), true);
    b.box(1.5, 29, 1.5, 30.5, 29.5, 30.5, cloth);
    for (const z of [1.25, 31]) for (let x = 1.5; x < 30.5; x += 0.5) { const f = Math.sin(x * 0.9) * 0.6; if (x > 6 && x < 26) continue; b.box(x, 3, z - 0.5 + f, x + 0.5, 29, z + f, cloth); }
  } }));
  for (const [id, label, W] of [['sofa', 'Garden Sofa', 2], ['chair', 'Garden Lounge Chair', 1]]) def('garden', id, 'rope', label + ' · teak & rope', Object.assign({}, GA, { cats: ['garden', 'seat'], size: [W, 1, 1], col: 'sand', seat: true, build: (b) => {
    const X = W * 16, t = M.wood(0xA8865A), rope = M.fabric(0xD9CDB4), ropeD = M.fabric(0xBFB298);
    for (const x of [0.5, X - 2]) { b.box(x, 0, 1, x + 1.5, 9.5, 2.5, t); b.box(x, 0, 12.5, x + 1.5, 13, 14, t); b.box(x, 9.5, 0.5, x + 1.5, 10.5, 14, t); b.box(x, 2, 2.5, x + 1.5, 9.5, 12.5, rope); for (let y = 2.5; y < 9.5; y += 1.5) b.recolor(x - 1, y, 2.5, x + 2.5, y + 0.5, 12.5, ropeD); }
    b.box(2, 2, 2, X - 2, 3, 13, t); b.box(2, 3, 12.5, X - 2, 13, 14, rope); for (let y = 3.5; y < 13; y += 1.5) b.recolor(2, y, 12, X - 2, y + 0.5, 14.5, ropeD); b.box(2, 12.5, 12.5, X - 2, 13.5, 14, t);
    const n = W, w = (X - 4) / n;
    for (let k = 0; k < n; k++) { b.cushion(2 + k * w + 0.25, 3, 2, 2 + (k + 1) * w - 0.25, 6, 12.5, 1, M.fabric(0xEDE6D8), true); b.cushion(2 + k * w + 0.5, 6, 9.5, 2 + (k + 1) * w - 0.5, 12, 12.5, 1, M.fabric(0xEDE6D8), true); }
    b.extrude([[X / 2 - 2.5, 6], [X / 2 - 2, 10], [X / 2 + 2, 10], [X / 2 + 2.5, 6]], 'z', 8, 9.5, M.fabric(P.olive));
  } }));
  def('garden', 'dining', 'teak', 'Garden Dining Set · teak', Object.assign({}, GA, { cats: ['garden', 'table'], size: [3, 1, 2], col: 'oak', build: (b) => {
    const t = M.wood(0xA8865A), td = M.wood(0x8A6A48), m = M.metal(P.anthracite), cu = M.fabric(0xE8E2D4);
    for (let z = 8; z < 24; z += 2) b.box(4, 11, z, 44, 12, z + 1.5, t); b.box(4, 10.5, 8, 44, 11, 24, td);
    for (const [x, z] of [[5, 9], [42, 9], [5, 22], [42, 22]]) b.box(x, 0, z, x + 1, 10.5, z + 1, m);
    for (const x of [10, 24, 38]) for (const [z, f] of [[1, 1], [31, -1]]) {
      const z0 = f > 0 ? 1 : 25, z1 = f > 0 ? 7 : 31;
      b.box(x - 4, 0, z0, x - 3, 7, z0 + 1, m); b.box(x + 3, 0, z0, x + 4, 7, z0 + 1, m); b.box(x - 4, 0, z1 - 1, x - 3, 7, z1, m); b.box(x + 3, 0, z1 - 1, x + 4, 7, z1, m);
      b.box(x - 4, 6.5, z0, x + 4, 7, z1, m); b.cushion(x - 3.5, 7, z0 + 0.5, x + 3.5, 8.5, z1 - 0.5, 0.5, cu, false);
      const zb = f > 0 ? z0 : z1 - 1; b.box(x - 4, 7, zb, x + 4, 13, zb + 1, M.fabric(0xD9CDB4)); for (let y = 7.5; y < 13; y += 1.5) b.recolor(x - 4, y, zb - 0.5, x + 4, y + 0.5, zb + 1.5, M.fabric(0xBFB298));
    }
    b.lathe(24, 16, [[12, 2.4], [13, 3], [13.5, 3]], M.concrete(0x8E8E8A), 0.5); for (let k = 0; k < 5; k++) b.sphere(24 + Math.cos(k * 1.3) * 1.4, 13.5, 16 + Math.sin(k * 1.3) * 1.4, 1, M.plant(k % 2 ? 0x7E9A62 : 0x5E8A52));
  } }));
  // a louvered aluminium pergola: four posts and a slatted roof 2.8 m up, an LED strip under the beams (switches)
  const PERG = [[0, 0, 0], [2, 0, 0], [0, 0, 2], [2, 0, 2], [0, 1, 0], [2, 1, 0], [0, 1, 2], [2, 1, 2]];
  for (let x = 0; x < 3; x++) for (let z = 0; z < 3; z++) PERG.push([x, 2, z]);
  def('garden', 'pergola', 'louvered', 'Pergola · louvered anthracite', Object.assign({}, GA, { res: 16, size: [3, 3, 3], cells: PERG, col: 'anthracite', toggle: true, light: [11, 10, 8], sound: 'metal', hard: 1.5, build: (b) => {
    const m = M.metal(P.anthracite);
    for (const [x, z] of [[1, 1], [45, 1], [1, 45], [45, 45]]) b.box(x, 0, z, x + 2, 45, z + 2, m);
    for (const z of [1, 45]) b.box(1, 41, z, 47, 45, z + 2, m); for (const x of [1, 45]) b.box(x, 41, 1, x + 2, 45, 47, m);
    for (let z = 4; z < 45; z += 3) b.box(3, 43, z, 45, 44, z + 2, M.metal(sh(P.anthracite, 1.15)));
    for (const z of [3, 44]) b.box(3, 40, z, 45, 41, z + 1, M.light(0xFFE2B0)); for (const x of [3, 44]) b.box(x, 40, 4, x + 1, 41, 44, M.light(0xFFE2B0));
  } }));
  // a square parasol, 3 m: a weighted base and the pole in the middle column, the canopy over all nine cells 2 m up
  // (a stepped roof two voxels thick, so no gap opens between the steps; seams run to the corners)
  const PARA = [[1, 0, 1], [1, 1, 1]];
  for (let x = 0; x < 3; x++) for (let z = 0; z < 3; z++) PARA.push([x, 2, z]);
  for (const [v, c, cs] of [['sand', 0xE6D9BC, 0xCDBF9F], ['terracotta', 0xC4704F, 0xA85C40]]) def('garden', 'parasol', v, 'Parasol · square ' + v, Object.assign({}, GA, { res: 16, size: [3, 3, 3], cells: PARA, col: v, sound: 'wool', build: (b) => {
    const pole = M.wood(0xA8865A), cloth = M.fabric(c), seam = M.fabric(cs);
    b.box(19, 0, 19, 29, 1, 29, M.concrete(0x8E8E8A)); b.box(21, 1, 21, 27, 2, 27, M.concrete(0x7E7E7A));   // the weighted base
    b.box(23, 2, 23, 25, 40, 25, pole); b.box(22, 14, 22, 26, 15, 26, M.metal(P.steel));                       // the pole, the crank collar
    for (let x = 1; x < 47; x++) for (let z = 1; z < 47; z++) {
      const d = Math.min(x - 1, 46 - x, z - 1, 46 - z), y = 33 + Math.floor(d * 0.28);
      b.box(x, d ? y : 32, z, x + 1, y + 2, z + 1, x === z || x + z === 47 ? seam : cloth);                  // the edge hangs down a flap
    }
    b.box(22, 41, 22, 26, 42, 26, pole);                                                                       // the finial
  } }));
  def('garden', 'firetable', 'concrete', 'Fire Table · concrete', Object.assign({}, GA, { cats: ['garden', 'table'], size: [2, 1, 1], col: 'concrete', toggle: true, light: [13, 8, 3], sound: 'stone', hard: 1.2, build: (b) => {
    b.pbox(1, 0, 2, 31, 6.5, 14, 0.5, M.concrete(0x8E8E8A)); b.box(1.5, 6.5, 2.5, 30.5, 7, 13.5, M.concrete(0xA09E9A));
    b.box(8, 7, 5.5, 24, 7.5, 10.5, M.gloss(0x1E2024)); for (let x = 9; x < 23; x += 1) b.box(x, 7.5, 6.5 + ((x * 3) % 3) * 0.5, x + 1, 8, 9.5, M.gloss(0x3A3D44));
    for (let k = 0; k < 9; k++) { const x = 9 + k * 1.6, h = 1.5 + ((k * 5) % 4) * 0.8; b.extrude([[x, 8], [x + 1.6, 8], [x + 1, 8 + h], [x + 0.5, 8 + h * 0.6]], 'z', 7.5, 8.5, M.light(k % 2 ? 0xFF8A2A : 0xFFB84A)); }
    b.box(7.5, 7, 5, 24.5, 11.5, 5.5, M.glass(0xE8F0F4)); b.box(7.5, 7, 10.5, 24.5, 11.5, 11, M.glass(0xE8F0F4)); b.box(7.5, 7, 5.5, 8, 11.5, 10.5, M.glass(0xE8F0F4)); b.box(24, 7, 5.5, 24.5, 11.5, 10.5, M.glass(0xE8F0F4));
  } }));
  def('garden', 'outdoorkitchen', 'grill', 'Outdoor Kitchen · grill station', Object.assign({}, GA, { cats: ['garden', 'kitchen'], size: [3, 2, 1], skip: [[0, 1, 0]], col: 'anthracite', ui: 'chest', sound: 'metal', hard: 1.2, build: (b) => {
    const a = M.metal(P.anthracite), s = M.metal(P.steel);
    b.box(0, 1, 2, 48, 14, 16, a); b.box(0.5, 0, 3, 47.5, 1, 15.5, M.matte(DARK)); b.box(0, 14, 0, 48, 15, 16, M.stone(0x3A3C40));
    for (const [x0, x1] of [[0, 16], [32, 48]]) { b.box(x0 + 0.5, 1.5, 1.5, x1 - 0.5, 13.5, 2, M.metal(sh(P.anthracite, 1.2))); b.box(x0 + 5, 12, 1, x1 - 5, 12.5, 1.5, s); }
    b.box(16.5, 1.5, 1.5, 31.5, 13.5, 2, s); b.box(18, 10.5, 1, 30, 11, 1.5, M.metal(P.black)); for (const x of [19, 22, 25, 28]) b.cyl('z', x, 8, 0.75, 1, 1.5, M.metal(P.black));
    b.box(17, 15, 3, 31, 17.5, 15, s); b.box(17, 17.5, 13, 31, 23, 15.5, s); b.box(18, 18, 12.5, 30, 22.5, 13, M.metal(0x4A4E54)); b.rod(18.5, 23.5, 14.5, 29.5, 23.5, 14.5, 0.5, M.metal(P.black));   // the grill with its open lid
    for (let x = 18; x < 30.5; x += 1.5) b.box(x, 17.5, 4, x + 0.5, 18, 12.5, M.metal(0x2A2C30));
    b.box(35, 11, 4, 45, 15, 12, s); b.cut(35.5, 11.5, 4.5, 44.5, 15, 11.5); tap(b, M.metal(P.black), 40, 14);
    b.rbox(4, 15, 5, 12, 15.5, 11, 0.25, M.wood(P.walnut));
  } }));
  def('garden', 'kamado', 'green', 'Kamado Grill · green', Object.assign({}, GA, { res: 16, size: [1, 1, 1], col: 'forest', sound: 'stone', hard: 1, build: (b) => {
    const g = M.gloss(0x2E5A3E), m = M.metal(P.black);
    for (const [x, z] of [[3, 3], [12, 3], [3, 12], [12, 12]]) b.box(x, 0, z, x + 1, 6, z + 1, m); b.box(3, 2, 3, 13, 2.5, 13, m); b.box(3, 5, 3, 13, 6, 13, m);
    b.ellipsoid(8, 9.5, 8, 4.5, 4.2, 4.5, g); b.box(3.5, 9.25, 3.5, 12.5, 9.75, 12.5, M.metal(P.black)); b.cyl('y', 8, 8, 1.2, 13.5, 14.5, m);
    b.box(6, 9, 2, 10, 10, 3, M.wood(P.oak)); b.box(0, 8, 5, 3.5, 9, 11, M.wood(P.oak)); b.box(12.5, 8, 5, 16, 9, 11, M.wood(P.oak));
    b.cyl('z', 8, 12, 0.9, 3.25, 3.75, M.chrome());
  } }));
  def('garden', 'raisedbed', 'corten', 'Raised Bed · corten', Object.assign({}, GA, { res: 16, size: [2, 1, 1], col: 'rust', sound: 'metal', build: (b) => {
    b.box(0.5, 0, 1.5, 31.5, 8, 14.5, M.metal(0x8A4A2A)); b.box(1, 7, 2, 31, 7.5, 14, M.matte(0x4A3626));
    for (let k = 0; k < 6; k++) { const x = 4 + k * 4.5; b.sphere(x, 9, 5, 1.8, M.plant(k % 2 ? 0x6AA84A : 0x8AC86A)); }
    for (const x of [6, 15, 24]) { b.box(x, 7.5, 10, x + 1, 15.5, 11, M.wood(P.oak)); b.sphere(x + 0.5, 11, 10.5, 2, M.plant(P.leaf)); b.box(x + 1.5, 9.5, 9, x + 2.5, 10.5, 10, M.gloss(0xD8322A)); b.box(x - 1.5, 12, 10, x - 0.5, 13, 11, M.gloss(0xD8322A)); b.box(x + 1, 13, 11, x + 2, 14, 12, M.gloss(0xE89A2A)); }
  } }));
  def('garden', 'bollard', 'black', 'Garden Light · bollard', Object.assign({}, GA, { size: [1, 1, 1], col: 'black', toggle: true, light: [12, 10, 7], sound: 'metal', solid: false, build: (b) => {
    b.box(5.5, 0, 5.5, 10.5, 9, 10.5, M.metal(P.black)); b.box(5.5, 9, 5.5, 10.5, 11, 10.5, M.light(0xFFE2B0)); b.box(5, 11, 5, 11, 12, 11, M.metal(P.black));
  } }));
  def('garden', 'mower', 'robot', 'Robot Mower · with dock', Object.assign({}, GA, { size: [1, 1, 1], col: 'anthracite', sound: 'metal', build: (b) => {
    b.pbox(3, 0.5, 2, 13, 3.5, 11, 2, M.gloss(0x3A3D44)); b.pbox(4, 3.5, 3, 12, 4, 10, 1.5, M.gloss(0xF07E1E)); b.box(6, 4, 4, 10, 4.5, 6, M.gloss(0x111214)); b.box(7.5, 4, 3.5, 8.5, 4.5, 4, M.light(0x4AE08A));
    for (const [x, z] of [[3, 8.5], [12.5, 8.5]]) b.cyl('x', 1.5, z, 1.5, x, x + 0.5, M.matte(0x1A1A1C));
    b.box(3, 0, 12, 13, 0.5, 16, M.gloss(0x3A3D44)); b.box(6, 0.5, 14, 10, 4, 15.5, M.gloss(0x3A3D44)); b.box(7, 3, 13.5, 9, 3.5, 14, M.light(0x4AE08A));
  } }));
  def('garden', 'hammock', 'stand', 'Hammock · on a stand', Object.assign({}, GA, { cats: ['garden', 'seat'], size: [3, 1, 1], col: 'sand', seat: true, sound: 'wool', build: (b) => {
    const w = M.wood(0xA8865A), cloth = M.fabric(0xE8D8B8), str = M.fabric(0xC09A6A);
    let px = 1, py = 14;
    for (let k = 1; k <= 24; k++) { const t = k / 24, x = 1 + t * 46, y = 1 + (1 - Math.sin(t * Math.PI)) * 13; b.rod(px, py, 8, x, y, 8, 0.75, w); px = x; py = y; }   // the curved stand, low in the middle
    b.box(16, 0, 3, 18, 1.5, 13, w); b.box(30, 0, 3, 32, 1.5, 13, w);
    for (let x = 6; x < 42; x += 0.5) { const t = (x - 24) / 18, y = 6 + t * t * 6; b.box(x, y, 4.5, x + 0.5, y + 0.5, 11.5, ((x * 2) | 0) % 6 < 3 ? cloth : str); }
    b.rod(3, 11, 8, 6, 12, 8, 0.35, str); b.rod(45, 11, 8, 42, 12, 8, 0.35, str); b.cushion(7, 7.5, 5, 12, 9.5, 11, 1, M.fabric(P.sage), false);
  } }));
  def('garden', 'eggchair', 'rattan', 'Hanging Egg Chair · rattan', Object.assign({}, GA, { cats: ['garden', 'seat'], res: 16, size: [1, 2, 1], col: 'sand', seat: true, sound: 'wood', build: (b) => {
    const m = M.metal(P.black), r = M.wood(0xC8A878), rd = M.wood(0xA8885A);
    b.cyl('y', 8, 8, 6.5, 0, 1, m);                                                                   // the round base under the egg
    b.box(7, 1, 14, 9, 28, 16, m); b.box(7, 28, 7, 9, 30, 16, m); b.box(7.5, 22, 7.5, 8.5, 28, 8.5, m);   // the pole behind, the arm over the top, the chain
    b.ellipsoid(8, 13.5, 8, 6.5, 8.5, 5.5, r); b.ellipsoid(8, 13.5, 7.5, 5.5, 7.5, 4.5, 0);              // the rattan shell, hollow
    b.cut(0, 8.5, 0, 16, 20, 6.5);                                                                        // the opening at the front
    for (let y = 6; y < 22; y += 2) b.recolor(0, y, 0, 16, y + 1, 16, rd);                                // woven bands
    b.cushion(4, 7, 4, 12, 9, 11.5, 1, M.fabric(0xF2F0EA), true); b.cushion(4.5, 9, 9.5, 11.5, 17, 11.5, 1, M.fabric(0xF2F0EA), true);
  } }));
  def('garden', 'fountain', 'stone', 'Water Feature · stone bowl', Object.assign({}, GA, { res: 16, size: [1, 1, 1], col: 'stone', light: [3, 6, 8], sound: 'stone', hard: 1.2, build: (b) => {
    const s = M.stone(0xA8A49C);
    b.cyl('y', 8, 8, 3, 0, 5, s); b.lathe(8, 8, [[5, 3], [6, 6], [8, 7.5], [8.5, 7.5]], s); b.cyl('y', 8, 8, 6.5, 7, 8.5, 0); b.cyl('y', 8, 8, 6.5, 7, 7.5, M.gloss(WATER));
    b.cyl('y', 8, 8, 0.75, 7, 11, M.stone(0x8A8680)); b.cyl('y', 8, 8, 0.75, 11, 12, M.glass(0xC8F0FF)); b.cyl('y', 8, 8, 1.5, 7, 7.5, M.light(0xA8E8FF));
    for (const [x, z] of [[4, 6], [11, 10], [6, 11.5]]) b.sphere(x, 7.5, z, 0.75, M.stone(0x6E6C66));
  } }));

  // ================================================================ MOBILITÄT — bikes, scooters, charging, the street
  const MO = { cats: ['mobility'], res: 32, sound: 'metal', hard: 1 };
  // a wheel in the x-y plane (bikes run along x): tyre, rim, hub
  function wheel(b, cx, cy, r, z0, z1) { b.tube('z', cx, cy, r, 0.75, z0, z1, M.matte(0x1A1A1C)); b.tube('z', cx, cy, r - 0.75, 0.5, z0 + 0.25, z1 - 0.25, M.metal(P.steel)); b.cyl('z', cx, cy, 0.75, z0 - 0.25, z1 + 0.25, M.metal(P.graphite)); for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3; b.rod(cx - Math.cos(a) * (r - 1), cy - Math.sin(a) * (r - 1), (z0 + z1) / 2, cx + Math.cos(a) * (r - 1), cy + Math.sin(a) * (r - 1), (z0 + z1) / 2, 0.4, M.metal(P.steel)); } }
  def('mobility', 'ebike', 'city', 'E-Bike · city sage', Object.assign({}, MO, { size: [2, 1, 1], col: 'sage', build: (b) => {
    const f = M.gloss(P.sage), m = M.metal(P.black);
    wheel(b, 6.5, 6, 5.75, 7.5, 8.5); wheel(b, 25.5, 6, 5.75, 7.5, 8.5);
    b.rod(25.5, 6, 8, 22.5, 14, 8, 0.6, f); b.rod(22.5, 14, 8, 13, 5.5, 8, 0.75, f); b.rod(13, 5.5, 8, 6.5, 6, 8, 0.6, f); b.rod(13, 5.5, 8, 11, 12, 8, 0.6, f); b.rod(11, 12, 8, 6.5, 6, 8, 0.5, f);
    b.box(14, 6.5, 7, 19, 9, 9, M.gloss(P.graphite));                                                   // the battery
    b.box(9.5, 12, 6.5, 13, 13, 9.5, M.leather(0x6A4A30)); b.rod(22.5, 14, 8, 21, 15.5, 8, 0.5, m); b.box(20.5, 15.5, 4, 21.5, 16, 12, m);   // saddle, handlebar
    b.box(1, 11, 6.5, 8, 11.5, 9.5, m); b.rod(3, 11, 8, 6.5, 6, 8, 0.4, m);                              // rear rack
    b.box(24, 11.5, 5.5, 29, 15.5, 10.5, M.wood(0xC8A878)); b.cut(24.5, 12, 6, 28.5, 15.5, 10); b.cyl('z', 23, 13.5, 0.75, 7.5, 8.5, M.light(0xFFF4D8));   // basket, headlight
    b.cyl('z', 6.5, 6, 1.5, 9, 9.5, M.metal(P.graphite));
  } }));
  def('mobility', 'cargobike', 'box', 'Cargo Bike · box', Object.assign({}, MO, { size: [2, 1, 1], col: 'oak', build: (b) => {
    const f = M.gloss(P.anthracite);
    wheel(b, 5, 5.5, 5.25, 7.5, 8.5); wheel(b, 27.5, 4, 3.5, 7.5, 8.5);
    b.rod(5, 5.5, 8, 11, 13, 8, 0.6, f); b.rod(11, 13, 8, 15, 6, 8, 0.75, f); b.rod(15, 6, 8, 5, 5.5, 8, 0.6, f); b.rod(15, 6, 8, 27.5, 4, 8, 0.75, f); b.rod(16, 7, 8, 16.5, 15.5, 8, 0.6, f);
    b.box(10, 13, 6.5, 13, 14, 9.5, M.leather(0x2A2C30)); b.box(16, 15.5, 4, 17, 16, 12, M.metal(P.black));
    b.box(19, 4, 3, 31, 11.5, 13, M.wood(0xC8A878)); b.cut(19.5, 4.5, 3.5, 30.5, 11.5, 12.5); b.box(19.5, 5, 3.5, 30.5, 7, 12.5, M.fabric(P.navy));   // the box with a bench cushion
    b.box(19.5, 11.5, 12.5, 30.5, 12, 13, M.wood(0xA8885A));
  } }));
  def('mobility', 'escooter', 'kick', 'E-Scooter · kick', Object.assign({}, MO, { size: [1, 1, 1], col: 'black', build: (b) => {
    const m = M.metal(P.black);
    b.pbox(2.5, 1, 7, 13, 2, 9, 0.5, m); b.box(4, 2, 7.25, 11, 2.25, 8.75, M.matte(0x3A3D44));
    for (const x of [2.5, 13.5]) { b.tube('z', x, 1.5, 1.5, 0.5, 7.5, 8.5, M.matte(0x1A1A1C)); b.cyl('z', x, 1.5, 0.75, 7.5, 8.5, M.metal(P.graphite)); }
    b.rod(13, 2, 8, 12, 14, 8, 0.6, m); b.box(11.5, 14, 4, 12.5, 14.75, 12, m); b.box(11.25, 13.5, 7.25, 12, 14, 8.75, M.light(0x5CC8F0)); b.cyl('x', 13.5, 8, 0.6, 12.5, 13.25, M.light(0xFFF4D8));
    b.box(2, 3.5, 7.25, 3.5, 4, 8.75, M.light(0xF04A4A));
  } }));
  // two sharing scooters parked nose-in at a charging rail (status lights), a lit sign at the end
  def('mobility', 'scooterdock', 'sharing', 'Scooter Dock · sharing', Object.assign({}, MO, { size: [2, 1, 1], col: 'graphite', light: [2, 6, 4], build: (b) => {
    const g = M.metal(P.graphite), teal = M.gloss(0x2E9C8A), k = M.metal(P.black);
    b.box(0.5, 0, 12.5, 31.5, 1, 15.5, g);                                                                  // the rail on the ground
    for (const x of [9, 21.5]) {
      b.box(x - 1.5, 1, 13, x + 1.5, 7, 15, g); b.box(x - 0.5, 4.5, 12.5, x + 0.5, 6.5, 13, M.light(0x4AE08A));   // the charging post, its status light
      b.pbox(x - 1, 1, 2.5, x + 1, 2, 12, 0.5, teal); b.box(x - 0.5, 2, 3.5, x + 0.5, 2.5, 11, M.matte(0x3A3D44));   // the deck, its grip
      for (const z of [2.5, 12]) { b.tube('x', 1.5, z, 1.5, 0.5, x - 0.5, x + 0.5, M.matte(0x1A1A1C)); b.cyl('x', 1.5, z, 0.75, x - 0.5, x + 0.5, g); }   // wheels
      b.rod(x, 2, 11.5, x, 13.5, 10.5, 0.6, teal); b.box(x - 3.5, 13.5, 10, x + 3.5, 14.5, 11, k); b.box(x - 0.5, 13.5, 9.5, x + 0.5, 14, 10, M.light(0x5CC8F0));   // stem, bar, display
      b.box(x - 0.5, 2.5, 2, x + 0.5, 3, 2.5, M.light(0xF04A4A));                                           // the tail light
    }
    b.box(28.5, 1, 13.5, 29.5, 10.5, 14.5, M.metal(P.steel)); b.box(27, 10.5, 13, 31, 15.5, 14, teal); b.box(27.5, 11, 12.5, 30.5, 15, 13, M.light(0xEAF8F4));   // the sign
    b.box(28, 11.5, 12, 30, 12, 12.5, M.matte(0x1E2024)); b.box(29.5, 12, 12, 30, 14.5, 12.5, M.matte(0x1E2024)); b.box(28.5, 14, 12, 30, 14.5, 12.5, M.matte(0x1E2024));   // a scooter on it
  } }));
  def('mobility', 'wallbox', 'ev', 'Wallbox · EV charger', Object.assign({}, MO, { size: [1, 1, 1], col: 'white', mount: 'wall', solid: false, build: (b) => {
    b.pbox(4.5, 6, 13.5, 11.5, 14, 16, 1, M.gloss(P.white)); b.cyl('z', 8, 11, 1.6, 13, 13.5, M.gloss(0x1E2024)); b.tube('z', 8, 11, 1.6, 0.5, 12.5, 13, M.light(0x4AE08A));
    for (let k = 0; k < 4; k++) b.tube('z', 8, 3.5, 2.6 - k * 0.1, 0.5, 14 - k * 0.6, 14.5 - k * 0.6, M.matte(0x1E2024));   // the coiled cable
    b.rod(8, 6, 14.5, 8, 4, 14.5, 0.5, M.matte(0x1E2024)); b.box(11.5, 8, 14, 13, 10.5, 16, M.gloss(0x1E2024));
  } }));
  def('mobility', 'charger', 'pillar', 'Charging Pillar · EV', Object.assign({}, MO, { size: [1, 2, 1], col: 'white', light: [3, 7, 10], hard: 1.5, build: (b) => {
    b.box(3, 0, 4, 13, 1, 12, M.concrete(0x8E8E8A)); b.pbox(4.5, 1, 5, 11.5, 27, 11, 1, M.gloss(P.white)); b.box(4.5, 26, 5, 11.5, 27.5, 11, M.light(0x5CC8F0));
    b.box(5.5, 17, 4.5, 10.5, 22.5, 5, M.gloss(0x141518)); screenUI(b, 6, 17.5, 10, 22, 4.5, 'tiles');
    for (const x of [3.5, 12.5]) { b.box(x - 0.5, 11, 6.5, x + 0.5, 14, 9.5, M.gloss(0x1E2024)); b.rod(x, 11, 8, x, 4, 8, 0.6, M.matte(0x1E2024)); }
    b.box(5.5, 9, 4.5, 10.5, 9.5, 5, M.light(0x4AE08A));
  } }));
  def('mobility', 'bikerack', 'steel', 'Bike Rack · steel hoops', Object.assign({}, MO, { size: [3, 1, 1], col: 'steel', build: (b) => {
    for (let k = 0; k < 4; k++) { const x = 4 + k * 13.3; b.box(x - 4, 0, 7.5, x - 3, 9, 8.5, M.metal(P.steel)); b.box(x + 3, 0, 7.5, x + 4, 9, 8.5, M.metal(P.steel)); b.tube('z', x, 9, 4, 1, 7.5, 8.5, M.metal(P.steel)); b.cut(x - 5, 0, 7, x + 5, 9, 9); b.box(x - 4, 0, 7.5, x - 3, 9, 8.5, M.metal(P.steel)); b.box(x + 3, 0, 7.5, x + 4, 9, 8.5, M.metal(P.steel)); }
    b.box(0, 0, 7, 48, 0.5, 9, M.metal(P.graphite));
  } }));
  def('mobility', 'moped', 'retro', 'E-Moped · retro mint', Object.assign({}, MO, { size: [2, 1, 1], col: 'sage', build: (b) => {
    const mint = M.gloss(0x9ED8C4);
    b.rbox(0.5, 4.5, 5, 14.5, 11.5, 11, 2.5, mint);                                                      // the rounded rear body (the wheel shows under it)
    const arc = [];
    for (let i = 0; i <= 10; i++) { const a = Math.PI * (0.05 + 0.9 * i / 10); arc.push([25.5 + Math.cos(a) * 4.4, 3.5 + Math.sin(a) * 4.4]); }
    for (let i = 10; i >= 0; i--) { const a = Math.PI * (0.05 + 0.9 * i / 10); arc.push([25.5 + Math.cos(a) * 3.6, 3.5 + Math.sin(a) * 3.6]); }
    b.extrude(arc, 'z', 6.5, 9.5, mint);                                                                  // the front mudguard
    for (const x of [6, 25.5]) { b.tube('z', x, 3.5, 3.5, 1.25, 7, 9, M.matte(0x1A1A1C)); b.cyl('z', x, 3.5, 2.25, 7.25, 8.75, M.chrome()); }
    b.box(13, 3.5, 5.5, 21.5, 4.5, 10.5, M.matte(0x3A3D44));                                             // the floorboard
    b.extrude([[20, 3.5], [22.5, 3.5], [25.5, 12], [25.5, 14], [24, 14], [21.5, 6]], 'z', 4.5, 11.5, mint);   // the leg shield, up to the headset
    b.cushion(2, 10.5, 5.5, 13, 12.5, 10.5, 1, M.leather(0x6A4A30), true);
    b.box(23.5, 14, 4.5, 27, 15.5, 11.5, mint); b.box(24.5, 15.5, 2.5, 25.5, 16, 13.5, M.chrome());        // the headset, the handlebar
    b.cyl('x', 14.75, 8, 1.2, 27, 27.5, M.chrome()); b.cyl('x', 14.75, 8, 0.8, 27.5, 28, M.light(0xFFF4D8));   // the round headlamp
    b.box(0.5, 8, 7, 1, 9, 9, M.light(0xF04A4A));                                                          // the tail light
  } }));
  def('mobility', 'busshelter', 'glass', 'Bus Shelter · glass', Object.assign({}, MO, { size: [3, 2, 1], col: 'anthracite', light: [6, 7, 9], hard: 1.5, build: (b) => {
    const m = M.metal(P.anthracite);
    for (const x of [0.5, 46.5]) b.box(x, 0, 12, x + 1, 30, 13, m); b.box(23.5, 0, 12, 24.5, 30, 13, m);
    b.box(0, 30, 2, 48, 31.5, 16, m); b.box(0.5, 29.5, 3, 47.5, 30, 15, M.light(0xEAF2FF));
    b.box(1.5, 2, 12.25, 23.5, 29, 12.75, M.glass(0xD6ECF4)); b.box(24.5, 2, 12.25, 34, 29, 12.75, M.glass(0xD6ECF4));
    b.box(34, 1, 11.5, 46.5, 29, 13.5, m); b.box(35, 3, 11, 45.5, 27, 11.5, M.light(0x2A4A6A)); b.box(36, 5, 10.5, 44.5, 20, 11, M.light(0x3A6A5A)); b.sphere(40, 16, 10.5, 2.5, M.light(0xF2B544));   // the lit ad panel
    b.box(4, 7, 8, 30, 7.5, 12, M.wood(P.oak)); for (const x of [6, 28]) b.box(x, 0, 9.5, x + 1, 7, 10.5, m);
    b.box(2, 25, 11.5, 12, 28, 12, M.gloss(0x2E5A88)); b.box(3, 26, 11, 11, 27, 11.5, M.matte(P.white));
  } }));
  def('mobility', 'parcellocker', 'smart', 'Parcel Locker · smart', Object.assign({}, MO, { cats: ['mobility', 'smart', 'storage'], size: [2, 2, 1], col: 'mustard', ui: 'chest', hard: 1.5, build: (b) => {
    const y = M.gloss(P.mustard), g = M.gloss(0x5A5E64);
    b.box(0, 0, 4, 32, 29, 16, g); b.box(0, 29, 1, 32, 31, 16, g);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 5; r++) { if (c === 1 && r >= 2 && r <= 3) continue; const x = 0.5 + c * 7.9, yy = 1 + r * 5.6; b.box(x, yy, 3.5, x + 7.4, yy + 5.1, 4, y); b.box(x + 6, yy + 2, 3, x + 6.5, yy + 3, 3.5, M.metal(P.black)); }
    b.box(8.4, 12.2, 3.5, 15.8, 22.4, 4, g); screenUI(b, 9, 16, 15, 21.5, 3.5, 'tiles'); b.box(10, 13, 3, 14, 14.5, 3.5, M.gloss(0x1E2024));
    b.box(0.5, 28.5, 1.5, 31.5, 29, 3.5, M.light(0xFFF4E0));
  } }));
  def('mobility', 'bikeshed', 'wood', 'Bike Shed · green roof', Object.assign({}, MO, { cats: ['mobility', 'garden', 'storage'], size: [2, 2, 1], col: 'oak', ui: 'chest', sound: 'wood', build: (b) => {
    const w = M.wood(0xB08A5A), wd = M.wood(0x8A6A48);
    b.box(0, 0, 1, 32, 24, 16, w); for (let x = 0; x < 32; x += 2) b.recolor(x, 0, 0.5, x + 0.5, 24, 1.5, wd); for (let x = 0.5; x < 32; x += 2) b.recolor(x, 0, 0.5, x + 0.5, 24, 1.5, wd);
    b.box(15.75, 0, 0.5, 16.25, 24, 1, M.metal(P.black)); b.box(13.5, 11, 0, 14, 14, 0.5, M.metal(P.black)); b.box(18, 11, 0, 18.5, 14, 0.5, M.metal(P.black));
    b.extrude([[0, 24], [32, 24], [32, 26], [0, 28]], 'z', 0, 16, wd);
    b.extrude([[0, 28], [32, 26], [32, 27.5], [0, 29.5]], 'z', 0.5, 15.5, M.plant(0x6A8A4A)); for (let k = 0; k < 14; k++) b.sphere(2 + k * 2.2, 29 - k * 0.14, 3 + (k * 5) % 10, 0.75, M.plant([0xE8B83A, 0xD87AA0, 0x8AA05A][k % 3]));
  } }));
  def('mobility', 'rack', 'skate', 'Skateboard & Helmet · wall rack', Object.assign({}, MO, { cats: ['mobility', 'deco'], size: [1, 1, 1], col: 'walnut', mount: 'wall', solid: false, sound: 'wood', build: (b) => {
    b.box(2, 9, 15, 14, 10.5, 16, M.wood(P.walnut)); for (const x of [4, 12]) b.box(x - 0.5, 8.5, 13, x + 0.5, 10, 15, M.metal(P.black));
    b.pbox(1, 6.5, 12.5, 15, 7, 15, 1, M.wood(0xC8A878)); b.box(1.5, 7, 12.5, 14.5, 7.25, 15, M.matte(0x1E2024));
    for (const x of [3, 13]) { b.cyl('y', x, 13, 0.75, 6, 6.5, M.gloss(0xF2E8D0)); b.cyl('y', x, 14.5, 0.75, 6, 6.5, M.gloss(0xF2E8D0)); }
    b.ellipsoid(8, 12.5, 13, 3.5, 3, 3, M.gloss(P.terracotta)); b.cut(0, 10.5, 0, 16, 12, 16); b.box(5, 10.5, 12, 11, 11, 14, M.matte(0x2A2C30));
  } }));

  // ================================================================ LADEN & CAFÉ — the coffee bar, the shop floor, the bakery
  const SH = { cats: ['shop'], res: 32, sound: 'wood', hard: 1 };
  // a neon word from straight tube strokes [[x0, y0, x1, y1], …] at depth z (letters 3 wide, 5 high)
  const GLYPH = {
    C: [[0, 0, 3, 0], [0, 0, 0, 5], [0, 5, 3, 5]], O: [[0, 0, 3, 0], [0, 0, 0, 5], [3, 0, 3, 5], [0, 5, 3, 5]], F: [[0, 0, 0, 5], [0, 5, 3, 5], [0, 2.5, 2.5, 2.5]],
    E: [[0, 0, 3, 0], [0, 0, 0, 5], [0, 5, 3, 5], [0, 2.5, 2.5, 2.5]], A: [[0, 0, 0, 5], [3, 0, 3, 5], [0, 5, 3, 5], [0, 2.5, 3, 2.5]], R: [[0, 0, 0, 5], [0, 5, 3, 5], [3, 2.5, 3, 5], [0, 2.5, 3, 2.5], [1.5, 2.5, 3, 0]],
    T: [[0, 5, 3, 5], [1.5, 0, 1.5, 5]], S: [[0, 0, 3, 0], [3, 0, 3, 2.5], [0, 2.5, 3, 2.5], [0, 2.5, 0, 5], [0, 5, 3, 5]], P: [[0, 0, 0, 5], [0, 5, 3, 5], [3, 2.5, 3, 5], [0, 2.5, 3, 2.5]], N: [[0, 0, 0, 5], [3, 0, 3, 5], [0, 5, 3, 0]],
  };
  // (read from the front, +x runs to the viewer's left: the word is laid out from xr toward −x, each glyph mirrored)
  function neonWord(b, word, xr, y, z, c) {
    for (const ch of word) {
      for (const [a0, b0, a1, b1] of GLYPH[ch] || []) {
        const p0 = xr - a0 - 0.5, p1 = xr - a1 - 0.5;
        if (a0 === a1 || b0 === b1) b.box(Math.min(p0, p1), y + Math.min(b0, b1), z, Math.max(p0, p1) + 0.5, y + Math.max(b0, b1) + 0.5, z + 0.5, M.light(c));
        else b.rod(p0 + 0.25, y + b0 + 0.25, z + 0.25, p1 + 0.25, y + b1 + 0.25, z + 0.25, 0.3, M.light(c));
      }
      xr -= 4.5;
    }
  }
  def('shop', 'counter', 'espresso', 'Café Counter · espresso bar', Object.assign({}, SH, { cats: ['shop', 'kitchen'], size: [3, 2, 1], col: 'terracotta', ui: 'chest', build: (b) => {
    b.box(0, 0, 1.5, 48, 14, 16, M.matte(P.terracotta)); for (let x = 1; x < 48; x += 2) b.recolor(x, 0.5, 1, x + 0.5, 14, 2, M.matte(sh(P.terracotta, 0.85)));   // fluted tiles
    b.box(0, 0, 1, 48, 0.5, 16, M.matte(DARK)); b.box(0, 14, 0, 48, 15, 16, M.stone(0xE6E0D6));
    b.box(6, 15, 8, 18, 22, 14, M.metal(P.steel)); b.box(6, 22, 8, 18, 22.5, 14, M.metal(sh(P.steel, 0.9))); for (const x of [9, 15]) { b.cyl('y', x, 7.5, 1, 18, 19.5, M.chrome()); b.rod(x, 18, 7.5, x, 18, 5, 0.5, M.matte(P.black)); }
    b.box(7, 15, 5, 17, 15.5, 8, M.metal(0x6A7078)); for (const x of [8, 11, 14]) b.lathe(x, 10, [[22.5, 0.8], [24, 0.9]], M.gloss(P.white));
    b.cyl('y', 22, 11, 1.5, 15, 20, M.matte(P.black)); b.lathe(22, 11, [[20, 1.2], [21, 2], [23, 2]], M.glass(0xC8B8A0), 0.3);
    for (let k = 0; k < 4; k++) b.lathe(27, 12, [[15 + k * 1.25, 1], [16 + k * 1.25, 1.2]], M.gloss(P.white), 0.3);
    b.box(36, 15, 6, 42, 15.5, 10, M.metal(P.graphite)); b.box(36.5, 15.5, 9.5, 41.5, 19.5, 10, M.metal(P.graphite)); b.box(37, 16, 9, 41, 19, 9.5, M.light(0x2A4A6A));   // the till
    b.lathe(45, 6, [[15, 1.2], [18, 1.2]], M.glass(0xE8F4FA), 0.3); b.box(44.25, 15.5, 5.25, 45.75, 16.5, 6.75, M.matte(0x6A9A5A));
  } }));
  def('shop', 'pastry', 'glass', 'Pastry Display · glass', Object.assign({}, SH, { size: [2, 1, 1], col: 'white', light: [8, 7, 5], build: (b) => {
    b.box(0, 0, 2, 32, 9, 16, M.gloss(P.white)); b.box(0, 0, 1.5, 32, 0.5, 16, M.matte(DARK)); b.box(0, 9, 2, 32, 9.5, 16, M.stone(0xE6E0D6));
    b.extrude([[2, 9.5], [2.5, 9.5], [3.5, 15.5], [3, 15.5]], 'x', 0.5, 31.5, M.glass(0xE0F0F8)); b.box(0.5, 9.5, 2, 1, 15.5, 15, M.glass(0xE0F0F8)); b.box(31, 9.5, 2, 31.5, 15.5, 15, M.glass(0xE0F0F8)); b.box(0.5, 15.5, 3, 31.5, 16, 15, M.metal(P.steel));
    b.box(1, 12, 6, 31, 12.5, 14.5, M.glass(0xE8F4FA)); b.box(1, 15, 6, 31, 15.5, 14.5, M.light(0xFFF4E0));
    for (let k = 0; k < 7; k++) { const x = 3 + k * 4; b.cyl('y', x, 10, 1.6, 9.5, 11, M.matte([0xE8C8A0, 0x6A3A22, 0xF2D0D8, 0xD8A86A][k % 4])); b.cyl('y', x, 10, 1.6, 11, 11.25, M.gloss([0xF2F0EA, 0x4A2A16, 0xE8A0B0, 0xC8884A][k % 4])); }
    for (let k = 0; k < 6; k++) { const x = 4 + k * 4.5; b.ellipsoid(x, 13.25, 10, 1.6, 0.75, 1, M.matte(0xD8A050)); }
  } }));
  def('shop', 'table', 'marble', 'Café Table · round marble', Object.assign({}, SH, { cats: ['shop', 'table'], size: [1, 1, 1], col: 'white', sound: 'stone', build: (b) => {
    const m = M.metal(P.black);
    b.cyl('y', 8, 8, 4, 0, 0.5, m); b.cyl('y', 8, 8, 0.75, 0.5, 11, m); b.cyl('y', 8, 8, 2, 10.5, 11, m); b.cyl('y', 8, 8, 5, 11, 12, M.marble(0xEEEDEA));
    b.cyl('y', 6, 7, 1.2, 12, 12.5, M.gloss(P.white)); b.lathe(6, 7, [[12.5, 0.6], [13.5, 0.7]], M.gloss(P.white)); b.box(9, 12, 9, 10, 12.25, 11, M.metal(P.steel));
  } }));
  def('shop', 'chair', 'bentwood', 'Café Chair · bentwood', Object.assign({}, SH, { cats: ['shop', 'seat'], size: [1, 1, 1], col: 'walnut', seat: true, build: (b) => {
    const w = M.wood(P.walnut);
    for (const [x, z] of [[4, 4], [12, 4], [4.5, 12], [11.5, 12]]) b.rod(x, 0, z, 8 + (x - 8) * 0.8, 7, 8 + (z - 8) * 0.8, 0.5, w);
    b.tube('y', 8, 8, 3.5, 0.75, 4, 4.5, w); b.cyl('y', 8, 8, 4.4, 7, 7.75, M.wood(sh(P.walnut, 1.1)));
    b.tube('z', 8, 12.5, 3.5, 0.75, 11.5, 12.5, w); b.cut(0, 0, 11, 16, 12.5, 13);                                     // the bent top hoop
    b.rod(4.75, 7.5, 12, 4.75, 12.75, 12, 0.5, w); b.rod(11.25, 7.5, 12, 11.25, 12.75, 12, 0.5, w); b.rod(4.75, 10.5, 12, 11.25, 10.5, 12, 0.5, w);
  } }));
  def('shop', 'bartable', 'high', 'Bar Table · high', Object.assign({}, SH, { cats: ['shop', 'table'], size: [1, 2, 1], col: 'black', sound: 'metal', build: (b) => {
    const m = M.metal(P.black);
    b.cyl('y', 8, 8, 4.5, 0, 0.5, m); b.cyl('y', 8, 8, 0.9, 0.5, 17, m); b.cyl('y', 8, 8, 5.5, 17, 18, M.wood(P.oak)); b.tube('y', 8, 8, 3, 0.5, 4, 4.5, M.metal(P.brass));
    b.lathe(10, 9, [[18, 0.8], [20, 0.7], [21, 0.4]], M.glass(0xD8ECF4), 0.3);
  } }));
  def('shop', 'barstool', 'velvet', 'Bar Stool · green velvet', Object.assign({}, SH, { cats: ['shop', 'seat'], size: [1, 1, 1], col: 'forest', seat: true, build: (b) => {
    const m = M.metal(P.black);
    for (const [x, z] of [[4.5, 4.5], [11.5, 4.5], [4.5, 11.5], [11.5, 11.5]]) b.rod(x, 0, z, 8 + (x - 8) * 0.7, 11, 8 + (z - 8) * 0.7, 0.5, m);
    b.tube('y', 8, 8, 3.6, 0.6, 4.5, 5, M.metal(P.brass));
    b.cyl('y', 8, 8, 3.8, 11, 11.5, m); b.lathe(8, 8, [[11.5, 4], [12.5, 4.2], [13.5, 4]], M.velvet(0x2E5843));
  } }));
  def('shop', 'menuboard', 'chalk', 'Menu Board · chalk', Object.assign({}, SH, { cats: ['shop', 'deco'], size: [2, 1, 1], col: 'black', mount: 'wall', solid: false, build: (b) => {
    b.box(1, 1, 15, 31, 15, 16, M.wood(P.oak)); b.box(1.5, 1.5, 14.5, 30.5, 14.5, 15, M.matte(0x2A2D2C));
    neonWord(b, 'CAFE', 25, 10, 14, 0xF2F0EA); b.box(8, 9, 14, 25, 9.5, 14.5, M.matte(0xF2C84A));
    for (let r = 0; r < 4; r++) { const y = 7 - r * 1.75; b.box(29 - 6 - (r * 5) % 7, y, 14, 29, y + 0.5, 14.5, M.matte(0xE8E2D4)); b.box(3, y, 14, 6, y + 0.5, 14.5, M.matte(0xF2C84A)); if (r % 2) b.box(11 - r, y, 14, 15, y + 0.5, 14.5, M.matte(0xE8E2D4)); }
  } }));
  def('shop', 'neon', 'coffee', 'Neon Sign · coffee', Object.assign({}, SH, { cats: ['shop', 'deco', 'light'], size: [2, 1, 1], col: 'blush', mount: 'wall', toggle: true, light: [13, 6, 9], solid: false, sound: 'glass', build: (b) => {
    b.box(1, 3, 15.5, 31, 13, 16, M.glass(0xE8F0F4));
    neonWord(b, 'COFFEE', 29, 5.5, 15, 0xFF6AA8);
    b.box(4, 4, 15, 28, 4.5, 15.5, M.light(0xFFB84A));                                             // an amber line under the word
  } }));
  def('shop', 'neon', 'open', 'Neon Sign · open', Object.assign({}, SH, { cats: ['shop', 'deco', 'light'], size: [2, 1, 1], col: 'sky', mount: 'wall', toggle: true, light: [12, 6, 8], solid: false, sound: 'glass', build: (b) => {
    const blue = M.light(0x4AB0F0);
    b.box(2.5, 2, 15.5, 29.5, 14, 16, M.glass(0xE8F0F4));                                              // the clear backing
    b.box(5, 3, 15, 27, 3.5, 15.5, blue); b.box(5, 12.5, 15, 27, 13, 15.5, blue); b.box(3.5, 4.5, 15, 4, 11, 15.5, blue); b.box(28, 4.5, 15, 28.5, 11, 15.5, blue);
    for (const [x0, y0, x1, y1] of [[3.75, 4.5, 5, 3.25], [28.25, 4.5, 27, 3.25], [3.75, 11, 5, 12.75], [28.25, 11, 27, 12.75]]) b.rod(x0, y0, 15.25, x1, y1, 15.25, 0.3, blue);   // rounded corners
    neonWord(b, 'OPEN', 24.5, 5.5, 15, 0xFF4A5A);
  } }));
  def('shop', 'shelf', 'grocery', 'Shop Shelf · groceries', Object.assign({}, SH, { cats: ['shop', 'storage'], size: [2, 2, 1], col: 'oak', ui: 'chest', build: (b) => {
    const o = M.wood(P.oak);
    b.box(0.5, 0, 14.5, 31.5, 28, 16, M.wood(sh(P.oak, 0.85))); for (const x of [0.5, 31]) b.box(x, 0, 6, x + 0.5, 28, 16, o);
    const prod = [0xC0443A, 0xF2C84A, 0x3E8A4A, 0xF2F0EA, 0x2F55C8, 0xE89A2A, 0x8A5AC8, 0x6A3A22];
    for (let r = 0; r < 4; r++) {
      const y = 1 + r * 7; b.box(0.5, y - 1, 6, 31.5, y, 15, o);
      for (let x = 1.5, k = r * 3; ; k++) { const w = 2 + (k % 3), h = 3 + (k % 4) * 0.75; if (x + w > 30.5) break; if (r % 2) { b.lathe(x + w / 2, 10, [[y, w / 2 - 0.25], [y + h * 0.7, w / 2 - 0.25], [y + h, w / 4]], M.gloss(prod[k % 8]), 0); } else b.box(x, y, 7.5, x + w, y + h, 13, M.matte(prod[k % 8])); x += w + 0.5; }
    }
  } }));
  def('shop', 'displaytable', 'retail', 'Display Table · folded shirts', Object.assign({}, SH, { size: [2, 1, 1], col: 'oak', build: (b) => {
    const o = M.wood(P.oak);
    b.box(1, 9, 2, 31, 10, 14, o); for (const x of [2, 29]) b.box(x, 0, 3, x + 1, 9, 13, o); b.box(3, 3, 7.5, 29, 4, 8.5, o);
    const cl = [0xE8E2D4, 0x253350, 0x97A88F, 0xB9664B, 0x2B2E33, 0xD9AFA6];
    for (let k = 0; k < 6; k++) { const x = 3 + (k % 3) * 9, z = k < 3 ? 3.5 : 8.5; for (let s = 0; s < 3 + (k % 2); s++) b.box(x, 10 + s * 0.75, z, x + 7, 10.5 + s * 0.75, z + 4.5, M.fabric(cl[(k + s) % 6])); }
    b.box(13, 10, 12, 19, 14, 13, M.wood(P.walnut)); b.box(13.5, 10.5, 11.5, 18.5, 13.5, 12, M.matte(0xF2F0EA));
  } }));
  def('shop', 'checkout', 'retail', 'Checkout Counter · retail', Object.assign({}, SH, { size: [2, 2, 1], col: 'white', ui: 'chest', build: (b) => {
    b.box(0, 0.5, 2, 32, 14, 16, M.gloss(P.white)); b.box(0, 0, 3, 32, 0.5, 15, M.matte(DARK)); b.box(0, 14, 1, 32, 15, 16, M.wood(P.oak));
    b.box(0, 6, 1.5, 32, 7, 2, M.wood(P.oak));
    b.box(20, 15, 8, 27, 15.5, 12, M.metal(P.graphite)); b.box(20.5, 15.5, 11.5, 26.5, 20, 12, M.metal(P.graphite)); b.box(21, 16, 11, 26, 19.5, 11.5, M.light(0x2A4A6A));   // POS screen
    b.box(15, 15, 6, 17.5, 15.5, 9, M.gloss(0x1E2024)); b.box(15.5, 15.5, 6.5, 17, 15.75, 8, M.light(0x5CC8F0));                        // card reader
    b.box(3, 15, 4, 11, 19, 10, M.matte(0xD8C8A8)); b.box(4, 19, 5, 10, 19.5, 9, M.matte(0xD8C8A8));                                    // a paper bag
  } }));
  // a boutique dress form on a tripod: an elliptic body built layer by layer, a summer dress with a belt and straps
  def('shop', 'mannequin', 'dress', 'Mannequin · summer dress', Object.assign({}, SH, { res: 16, size: [1, 2, 1], col: 'white', sound: 'wood', build: (b) => {
    const k = M.metal(P.black), form = M.fabric(0xEFE9DE), dress = M.fabric(0xD8A8A0);
    b.cyl('y', 8, 8, 3.5, 0, 1, k); b.cyl('y', 8, 8, 2.5, 1, 2, k); b.cyl('y', 8, 8, 0.75, 2, 12, M.metal(P.brass));   // the round foot, the brass column
    // [y, half width, half depth]: the hem, hips, waist, bust, shoulders, the neck
    const prof = [[8, 5.2, 4.4], [12, 4.4, 3.6], [15.5, 3.7, 2.8], [17.5, 3, 2.2], [19.5, 3.4, 2.5], [21, 3.6, 2.6], [22.5, 3.9, 2.1], [23.25, 3.2, 1.7], [23.75, 1.2, 1.1], [25, 0.9, 0.9]];
    for (let y = 8, i = 0; y < 25; y += 1) {
      while (i + 2 < prof.length && prof[i + 1][0] <= y) i++;
      const [ya, xa, za] = prof[i], [yb, xb, zb] = prof[i + 1], t = Math.min(1, Math.max(0, (y + 0.5 - ya) / (yb - ya)));
      ellRingFill(b, 8, 8, xa + (xb - xa) * t, za + (zb - za) * t, y, y + 1, y < 21 ? dress : form);
    }
    b.recolor(0, 17, 0, 16, 18, 16, M.fabric(0xF2F0EA));                                               // the belt
    for (const x of [6, 9]) b.recolor(x, 21, 0, x + 1, 23, 16, dress);                                   // straps over the shoulders
    b.cyl('y', 8, 8, 1.2, 25, 26, M.wood(P.walnut)); b.cyl('y', 8, 8, 0.75, 26, 27, M.wood(P.walnut));    // the neck cap and its knob
  } }));
  // a boutique rail: a brass frame on a travertine plinth, garments on walnut hangers (seen edge-on, as they hang), shoes
  const GARMENT = {
    shirt: [[6, 24], [10, 24], [10.8, 22.5], [10.5, 15], [5.5, 15], [5.2, 22.5]],
    dress: [[6.5, 24], [9.5, 24], [10, 21.5], [9.5, 18], [11, 9.5], [5, 9.5], [6.5, 18], [6, 21.5]],
    coat: [[5.8, 24], [10.2, 24], [11, 22], [11, 11], [5, 11], [5, 22]],
  };
  def('shop', 'rail', 'brass', 'Clothing Rail · brass boutique', Object.assign({}, SH, { cats: ['shop', 'storage'], size: [2, 2, 1], col: 'brass', sound: 'metal', build: (b) => {
    const br = M.metal(P.brass);
    b.pbox(0.5, 0, 4, 31.5, 1.5, 12, 1, M.stone(0xD9CBB0));                                                 // the travertine plinth
    for (const x of [2, 29]) b.box(x, 1.5, 7.5, x + 1, 26, 8.5, br); b.cyl('x', 25.5, 8, 0.5, 2, 30, br);  // the frame, the bar
    const look = [['shirt', 0xE8E2D4], ['dress', 0xB9664B], ['coat', 0x2B2E33], ['shirt', 0x97A88F], ['dress', 0xD8ADA4], ['shirt', 0xF2F0EA], ['coat', 0x253350], ['dress', 0xCF9F3A]];
    look.forEach(([kind, c], k) => {
      const x = 4 + k * 3;
      b.extrude(GARMENT[kind], 'x', x, x + 1.5, M.fabric(c));
      b.box(x, 24, 5.5, x + 1.5, 24.5, 10.5, M.wood(P.walnut)); b.box(x + 0.5, 24.5, 7.5, x + 1, 25.5, 8.5, br);   // the hanger and its hook
    });
    b.box(4.5, 19, 4.5, 5, 20.5, 5, M.matte(0xF2F0EA));                                                     // a price tag
    for (const x of [7, 10]) b.rbox(x, 1.5, 5, x + 2, 3, 9, 0.5, M.leather(0x2A2C30));                      // a pair of shoes
  } }));
  def('shop', 'drinksfridge', 'glass', 'Drinks Fridge · glass door', Object.assign({}, SH, { cats: ['shop', 'kitchen'], size: [1, 2, 1], col: 'black', light: [6, 8, 10], ui: 'chest', sound: 'metal', build: (b) => {
    b.box(0.5, 0, 2, 15.5, 31, 16, M.metal(P.black)); b.cut(1.5, 2, 2, 14.5, 26, 15); b.box(1.5, 2, 14.5, 14.5, 26, 15, M.light(0xDCEEFF));
    for (let r = 0; r < 4; r++) { const y = 2.5 + r * 6; b.box(1.5, y - 0.5, 3, 14.5, y, 14.5, M.glass(0xE8F4FA)); for (let k = 0; k < 6; k++) { const x = 2.5 + k * 2; if (r % 2) b.box(x, y, 5, x + 1.5, y + 3, 6.5, M.gloss([0xC0443A, 0x2F55C8, 0xE8E8E8, 0x3E8A4A][k % 4])); else { b.box(x, y, 5, x + 1.5, y + 3.5, 6.5, M.glass([0x6A3A1A, 0x2A6A3A, 0xC8A24A][k % 3])); b.box(x + 0.5, y + 3.5, 5.5, x + 1, y + 4.5, 6, M.glass([0x6A3A1A, 0x2A6A3A, 0xC8A24A][k % 3])); } } }
    b.box(1, 1.5, 1.5, 15, 26.5, 2, M.glass(0xC8DCE8)); b.box(13, 8, 1, 13.5, 20, 1.5, M.metal(P.steel));
    b.box(0.5, 27, 1.5, 15.5, 30.5, 2, M.light(0xC0443A)); b.box(3, 28, 1, 13, 29.5, 1.5, M.light(0xF2F0EA));
  } }));
  // a snack machine: a lit window with five rows of snacks, the pay panel (screen, keypad, card reader), the flap below
  def('shop', 'vending', 'snacks', 'Vending Machine · snacks', Object.assign({}, SH, { cats: ['shop', 'office'], size: [1, 2, 1], col: 'anthracite', light: [5, 6, 8], sound: 'metal', hard: 1.5, build: (b) => {
    b.box(0.5, 0.5, 2, 15.5, 30, 16, M.metal(P.anthracite)); b.box(1, 0, 2.5, 15, 0.5, 15.5, M.matte(DARK));
    b.cut(1.5, 9, 2, 11, 27.5, 13); b.box(1.5, 9, 2, 11, 27.5, 2.5, M.glass(0xD8E8F0)); b.box(1.5, 27, 3, 11, 27.5, 12.5, M.light(0xEAF4FF));   // the window, its light
    const snack = [0xC0443A, 0xF2C84A, 0x3E8A4A, 0x2F55C8, 0xE89A2A, 0x8A5AC8, 0xF2F0EA, 0x6A3A22];
    for (let r = 0; r < 5; r++) {
      const y = 9.5 + r * 3.5; b.box(1.5, y, 3, 11, y + 0.5, 12.5, M.metal(P.steel));
      for (let c = 0; c < 4; c++) { const x = 2 + c * 2.25, h = 2 + ((c + r) % 3) * 0.5; b.box(x, y + 0.5, 3.5, x + 1.5, y + 0.5 + h, 6, M.gloss(snack[(r * 3 + c) % 8])); }
    }
    b.box(11.5, 9, 1.5, 15, 27.5, 2, M.metal(sh(P.anthracite, 1.25)));                                       // the pay panel
    screenUI(b, 12, 21.5, 14.5, 26, 1.5, 'tiles');
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) b.box(12 + c, 15 + r * 1.25, 1, 12.5 + c, 15.5 + r * 1.25, 1.5, M.light(0xE8E8F0));   // the keypad
    b.box(12, 11.5, 1, 14.5, 13.5, 1.5, M.gloss(0x1E2024)); b.box(12.5, 12, 0.5, 14, 13, 1, M.light(0x4AE08A));   // the card reader
    b.box(1.5, 3, 1.5, 11, 7, 2, M.gloss(0x1E2024)); b.box(3, 6, 1, 9.5, 6.5, 1.5, M.metal(P.steel));             // the pick-up flap
    b.box(0.5, 28, 1.5, 15.5, 30, 2, M.light(0xF2B544)); b.box(3, 28.5, 1, 13, 29.5, 1.5, M.light(0x2A2C30));       // the lit header
  } }));
  def('shop', 'icecream', 'freezer', 'Gelato Freezer · glass', Object.assign({}, SH, { size: [2, 1, 1], col: 'white', light: [6, 7, 9], build: (b) => {
    b.box(0, 0, 2, 32, 10, 16, M.gloss(P.white)); b.box(0, 0, 1.5, 32, 0.5, 16, M.matte(DARK)); b.cut(1, 7, 4, 31, 10, 15);
    const gel = [0xF2E8C8, 0x6A3A22, 0xF2A0B8, 0x9ED89A, 0xF2D24A, 0xC0443A, 0xE8E0F0, 0x8A5A3A];
    for (let k = 0; k < 8; k++) { const x = 1.5 + (k % 4) * 7.4, z = k < 4 ? 4.5 : 9.5; b.box(x, 7, z, x + 7, 8.5, z + 5, M.metal(P.steel)); b.ellipsoid(x + 3.5, 8.75, z + 2.5, 3, 0.9, 2, M.matte(gel[k])); }
    b.extrude([[3, 10], [3.5, 10], [4.5, 15], [4, 15]], 'x', 0.5, 31.5, M.glass(0xE0F0F8)); b.box(0.5, 10, 4, 1, 15, 15, M.glass(0xE0F0F8)); b.box(31, 10, 4, 31.5, 15, 15, M.glass(0xE0F0F8));
    b.box(0.5, 14.5, 4, 31.5, 15, 15, M.light(0xEAF4FF));
  } }));
  def('shop', 'kiosk', 'touch', 'Self-Order Kiosk · touch', Object.assign({}, SH, { cats: ['shop', 'smart'], size: [1, 2, 1], col: 'white', light: [3, 4, 6], sound: 'metal', build: (b) => {
    b.box(3, 0, 5, 13, 1, 11, M.gloss(P.graphite)); b.box(6.5, 1, 7.5, 9.5, 14, 9.5, M.gloss(P.white));
    b.box(3.5, 13, 7, 12.5, 29, 9.5, M.gloss(P.white)); b.box(4, 13.5, 6.5, 12, 28.5, 7, M.gloss(0x141518)); screenUI(b, 4.5, 16, 11.5, 28, 6.5, 'tiles');
    b.box(5.5, 14, 6.5, 10.5, 15, 7, M.gloss(0x1E2024)); b.box(6, 14, 6, 7, 14.5, 6.5, M.light(0x4AE08A));
  } }));
  def('shop', 'booth', 'bench', 'Booth Bench · green velvet', Object.assign({}, SH, { cats: ['shop', 'seat', 'living'], size: [2, 1, 1], col: 'forest', seat: true, sound: 'wool', build: (b) => {
    const v = M.velvet(0x2E5843), vd = M.velvet(0x264A38);
    b.box(0, 0, 3, 32, 6, 16, M.wood(P.oak)); b.box(0, 0, 2.5, 32, 0.5, 16, M.matte(DARK));
    b.cushion(0.5, 6, 1.5, 31.5, 8, 13, 1, v, true); b.box(0, 6, 13, 32, 16, 16, M.wood(P.oak));
    for (let k = 0; k < 8; k++) b.cushion(0.5 + k * 3.9, 8, 12, 0.5 + (k + 1) * 3.9 - 0.25, 16, 13.5, 0.75, k % 2 ? v : vd, false);
  } }));
  def('shop', 'breadshelf', 'bakery', 'Bread Shelf · bakery', Object.assign({}, SH, { cats: ['shop', 'kitchen'], res: 16, size: [2, 2, 1], col: 'oak', build: (b) => {
    const o = M.wood(0xB08A5A);
    b.box(0, 0, 15, 32, 30, 16, o); for (const x of [0, 31]) b.box(x, 0, 4, x + 1, 30, 16, o);
    for (let r = 0; r < 3; r++) {
      const y = 2 + r * 9.5; b.extrude([[4, y], [15, y + 2.5], [15, y + 3], [4, y + 0.5]], 'x', 0.5, 31.5, o); b.box(0.5, y, 3.5, 31.5, y + 2, 4.5, o);
      for (let k = 0; k < 6; k++) { const x = 3 + k * 5; if (r === 1) b.rod(x - 1, y + 2, 6, x + 1.5, y + 4.5, 13.5, 0.9, M.matte(0xC88A3A)); else b.ellipsoid(x, y + 2 + (k % 2) * 0.5 + 1.2, 8 + (k % 3) * 2, 2, 1.4, 1.8, M.matte(r ? 0x8A5A2A : 0xD8A050)); }
    }
  } }));
  def('shop', 'pizzaoven', 'wood', 'Pizza Oven · wood fired', Object.assign({}, SH, { cats: ['shop', 'kitchen', 'garden'], res: 16, size: [2, 2, 1], col: 'terracotta', toggle: true, light: [14, 8, 3], sound: 'stone', hard: 1.5, build: (b) => {
    b.ellipsoid(16, 13, 9, 12, 12, 7, M.matte(P.terracotta)); b.cut(0, 0, 0, 32, 13, 16);                        // the dome (its upper half)
    b.box(0.5, 0, 1, 31.5, 12, 16, M.stone(0x9A948A)); for (let y = 3; y < 12; y += 3) b.recolor(0, y, 0.5, 32, y + 0.5, 1.5, M.stone(0x7E7870));
    b.box(0, 12, 0, 32, 13, 16, M.concrete(0xB4B0A6));
    b.extrude([[10, 13], [22, 13], [22, 18], [16, 21], [10, 18]], 'z', 0.5, 4, M.stone(0x6E6A64)); b.extrude([[11.5, 13], [20.5, 13], [20.5, 17.5], [16, 19.5], [11.5, 17.5]], 'z', 0.5, 4.5, 0);
    for (let k = 0; k < 6; k++) b.extrude([[12 + k * 1.4, 13], [13.4 + k * 1.4, 13], [12.9 + k * 1.4, 15 + (k % 3)]], 'z', 6, 8, M.light(k % 2 ? 0xFF8A2A : 0xFFB84A));
    b.box(14.5, 19, 11, 17.5, 30, 14, M.metal(P.black)); b.box(14, 29, 10.5, 18, 30, 14.5, M.metal(P.black));
    b.cut(3, 2, 1, 29, 10, 11); b.box(3, 2, 10, 29, 10, 11, M.stone(0x5A564F));                                  // the log niche in the base
    for (let r = 0; r < 3; r++) for (let k = 0; k < 9 - r; k++) b.cyl('z', 4.5 + r * 1.3 + k * 2.6, 3.2 + r * 2.3, 1.1, 1.5, 10.5, M.wood(r % 2 ? 0x8A6A48 : 0x7A5A3A));   // stacked logs
  } }));

  // ================================================================ DEKO & KUNST — sculptures, canvases, neon, things to love
  const DK = { cats: ['deco'], res: 32, sound: 'wood', hard: 0.6 };
  def('deco', 'sculpture', 'ring', 'Sculpture · bronze ring', Object.assign({}, DK, { size: [1, 2, 1], col: 'sand', sound: 'stone', build: (b) => {
    b.box(3, 0, 3, 13, 9, 13, M.stone(0xD9CBB0)); b.box(2.5, 8.5, 2.5, 13.5, 9, 13.5, M.stone(0xC8B898));
    b.tube('z', 8, 19.5, 6.5, 2, 7, 9, M.metal(0x8A6A3A)); b.box(7, 9, 7, 9, 13.5, 9, M.metal(0x8A6A3A));
  } }));
  const canvasArt = (b, x0, y0, x1, y1, paint) => { b.box(x0, y0, 14.5, x1, y1, 16, M.matte(0xF4F0E8)); b.box(x0, y0, 14.5, x1, y0 + 0.5, 16, M.wood(P.oak)); paint(x0 + 0.5, y0 + 0.5, x1 - 0.5, y1 - 0.5); };
  def('deco', 'canvas', 'triptych', 'Canvas · triptych arcs', Object.assign({}, DK, { size: [3, 1, 1], col: 'terracotta', mount: 'wall', solid: false, build: (b) => {
    const C = [[P.terracotta, P.sand], [P.sage, P.cream], [P.mustard, P.terracotta]];
    for (let k = 0; k < 3; k++) { const x0 = 2 + k * 15; canvasArt(b, x0, 2, x0 + 13, 14, (a0, c0, a1, c1) => {
      const cx = (a0 + a1) / 2 + (k - 1) * 1.5, arc = []; for (let i = 0; i <= 12; i++) { const a = i * Math.PI / 12; arc.push([cx + Math.cos(a) * 5, c0 + Math.sin(a) * 5]); }
      b.extrude(arc, 'z', 14, 14.5, M.matte(C[k][0]));
      b.box(a0 + 2, c1 - 3.5, 14, a0 + 4, c1 - 1.5, 14.5, M.matte(C[k][1])); b.box(a0, c0, 14, a1, c0 + 0.5, 14.5, M.matte(0x2B2E33)); }); }
  } }));
  def('deco', 'canvas', 'large', 'Canvas · colour fields', Object.assign({}, DK, { size: [2, 2, 1], col: 'navy', mount: 'wall', solid: false, build: (b) => {
    canvasArt(b, 2, 4, 30, 28, (a0, c0, a1, c1) => {
      b.box(a0, c0, 14, a1, c0 + 9, 14.5, M.matte(P.navy)); b.box(a0, c0 + 9, 14, a1, c0 + 16, 14.5, M.matte(0xD8A060)); b.box(a0, c0 + 16, 14, a1, c1, 14.5, M.matte(P.blush));
      b.cyl('z', 21, c0 + 14, 3.5, 13.5, 14, M.matte(0xE8E2D4)); b.box(4, c0 + 8.5, 13.5, 26, c0 + 9.5, 14, M.matte(P.terracotta));
    });
  } }));
  // stems fan out of a tall ceramic vase; each plume is a soft spindle along its stem
  def('deco', 'vase', 'pampas', 'Floor Vase · pampas grass', Object.assign({}, DK, { res: 16, size: [1, 2, 1], col: 'cream', build: (b) => {
    b.lathe(8, 8, [[0, 2.4], [1.5, 3.3], [6, 3.5], [9, 2.6], [11, 1.6], [12.5, 1.5], [13, 1.8]], M.matte(0xE8E2D4));
    for (let k = 0; k < 9; k++) {
      const a = k * Math.PI * 2 / 9 + 0.3, s = 3 + (k % 3) * 1.6, base = [8, 12.5, 8], tip = [8 + Math.cos(a) * s, 30 - s * 1.3 - (k % 2) * 1.5, 8 + Math.sin(a) * s * 0.8];
      const at = (t) => base.map((v, i) => v + (tip[i] - v) * t);
      b.rod(...base, ...at(0.5), 0.6, M.plant(0xB8A070));
      const plume = M.fabric(k % 2 ? 0xE8D8B8 : 0xDCC8A0);
      b.rod(...at(0.5), ...at(0.9), 1.4, plume); b.rod(...at(0.45), ...at(1), 0.9, plume);
    }
  } }));
  // three ceramics on a travertine tray: a sage bottle, a cream moon vase, a terracotta cylinder with a dried branch
  def('deco', 'vases', 'trio', 'Vases · ceramic trio', Object.assign({}, DK, { size: [1, 1, 1], col: 'sage', sound: 'stone', build: (b) => {
    b.pbox(1.5, 0, 3, 14.5, 0.5, 13.5, 1.5, M.stone(0xD9CBB0));
    const sage = M.gloss(P.sage); b.cyl('y', 5, 9, 2.4, 0.5, 7, sage); b.cyl('y', 5, 9, 1.6, 7, 8, sage); b.cyl('y', 5, 9, 0.75, 8, 12.5, sage);   // a bottle
    b.cyl('y', 10.5, 6.5, 3, 0.5, 4.5, M.matte(0xE8E2D4)); b.cyl('y', 10.5, 6.5, 2, 4.5, 5, M.matte(0xE8E2D4)); b.cyl('y', 10.5, 6.5, 1.5, 4, 5, 0);   // a low bowl vase
    b.tube('y', 10.5, 11.5, 1.2, 0.5, 0.5, 6, M.matte(P.terracotta));                                          // a tall cylinder
    const twig = M.wood(0x8A6A48);
    b.rod(10.5, 1, 11.5, 9.5, 12, 12.5, 0.3, twig); b.rod(9.8, 8.5, 12.2, 12, 11, 13, 0.3, twig); b.rod(10, 10, 12.3, 8.5, 13, 11.5, 0.3, twig);
    for (const [x, y, z] of [[9.5, 12.5, 12.5], [12, 11.5, 13], [8.5, 13.5, 11.5], [11, 10, 12.7]]) b.sphere(x, y, z, 0.6, M.plant(0xC8A878));
  } }));
  def('deco', 'neon', 'wave', 'Neon Art · wave', Object.assign({}, DK, { cats: ['deco', 'light'], size: [2, 1, 1], col: 'sky', mount: 'wall', toggle: true, light: [6, 10, 14], solid: false, sound: 'glass', build: (b) => {
    b.box(1, 3, 15.5, 31, 13, 16, M.glass(0xE8F0F4));
    let px = 3, py = 8; for (let k = 1; k <= 28; k++) { const x = 3 + k, y = 8 + Math.sin(k * 0.45) * 3; b.rod(px, py, 15, x, y, 15, 0.4, M.light(0x5CC8F0)); px = x; py = y; }
    px = 3; py = 6; for (let k = 1; k <= 28; k++) { const x = 3 + k, y = 6 + Math.sin(k * 0.45 + 1.4) * 2; b.rod(px, py, 15, x, y, 15, 0.4, M.light(0xFF6AA8)); px = x; py = y; }
  } }));
  def('deco', 'mirror', 'sunburst', 'Mirror · brass sunburst', Object.assign({}, DK, { size: [1, 1, 1], col: 'brass', mount: 'wall', solid: false, sound: 'glass', build: (b) => {
    for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8; b.rod(8 + Math.cos(a) * 3.5, 8 + Math.sin(a) * 3.5, 15.5, 8 + Math.cos(a) * (k % 2 ? 6 : 7.5), 8 + Math.sin(a) * (k % 2 ? 6 : 7.5), 15.5, 0.4, M.metal(P.brass)); }
    b.cyl('z', 8, 8, 3.6, 15, 16, M.metal(P.brass)); b.cyl('z', 8, 8, 3, 14.5, 15, M.gloss(0xC8DCE8));
  } }));
  def('deco', 'candles', 'tray', 'Candles · on a stone tray', Object.assign({}, DK, { cats: ['deco', 'light'], size: [1, 1, 1], col: 'cream', toggle: true, light: [11, 7, 3], solid: false, sound: 'stone', build: (b) => {
    b.pbox(3, 0, 4, 13, 0.5, 12, 1, M.stone(0x6E6C66));
    for (const [x, z, h] of [[5.5, 7, 4.5], [8.5, 9, 3], [10.5, 6.5, 2]]) { b.cyl('y', x, z, 1.3, 0.5, 0.5 + h, M.matte(0xF2EADA)); b.box(x - 0.25, 0.5 + h, z - 0.25, x + 0.25, 1 + h, z + 0.25, M.matte(0x2A2420)); b.box(x - 0.25, 1 + h, z - 0.25, x + 0.25, 2 + h, z + 0.25, M.light(0xFFB84A)); }
  } }));
  def('deco', 'divider', 'rattan', 'Room Divider · oak & cane', Object.assign({}, DK, { cats: ['deco', 'living'], size: [2, 2, 1], col: 'oak', build: (b) => {
    const o = M.wood(P.oak), cane = M.wood(0xD9C08A);
    const panels = [[1, 6, 10.5], [11.5, 9, 9], [22, 6, 10.5]];
    for (const [x, z0, z1] of panels) { const w = 9.5; b.extrude([[x, z0], [x + w, z1], [x + w, z1 + 1], [x, z0 + 1]], 'y', 0, 28, o); b.extrude([[x + 1, z0 + (z1 - z0) * 0.1], [x + w - 1, z0 + (z1 - z0) * 0.9], [x + w - 1, z0 + (z1 - z0) * 0.9 + 0.5], [x + 1, z0 + (z1 - z0) * 0.1 + 0.5]], 'y', 1.5, 26.5, cane); }
    for (const y of [9, 18]) b.recolor(0, y, 0, 32, y + 0.5, 16, o);
  } }));
  // an antique globe: parchment land painted onto a blue sea (caps of the sphere), a brass meridian, a tripod
  def('deco', 'globe', 'brass', 'Floor Globe · brass', Object.assign({}, DK, { res: 16, size: [1, 1, 1], col: 'brass', sound: 'metal', build: (b) => {
    const br = M.metal(P.brass), S = b.S, C = [8, 10, 8];
    b.cyl('y', 8, 8, 3, 0, 1, br); b.lathe(8, 8, [[1, 1.5], [2, 0.8], [3.5, 0.8], [4.5, 1.4]], br);         // the round foot, the turned column
    b.sphere(8, 10, 8, 4.5, M.gloss(0x4A78A8));
    const caps = [[-0.3, 0.45, -0.85, 0.5], [0.05, -0.25, -1, 0.42], [0.95, 0.25, -0.2, 0.45], [0.75, -0.45, -0.45, 0.3], [-0.85, 0.3, 0.3, 0.5], [-0.3, 0.9, 0.2, 0.35]].map(([x, y, z, r]) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l, Math.cos(r)]; });
    const land = M.gloss(0xD8C08A);
    b.recolor(3, 5, 3, 13, 15, 13, (x, y, z) => {
      const d = [(x + 0.5) / S - C[0], (y + 0.5) / S - C[1], (z + 0.5) / S - C[2]], l = Math.hypot(...d) || 1;
      return caps.some(c => (d[0] * c[0] + d[1] * c[1] + d[2] * c[2]) / l > c[3]) ? land : M.gloss(0x4A78A8);
    });
    b.tube('z', 8, 10, 5.5, 1, 7.5, 8.5, br);                                                         // the meridian ring
  } }));
  def('deco', 'bust', 'marble', 'Bust · white marble', Object.assign({}, DK, { res: 16, size: [1, 2, 1], col: 'white', sound: 'stone', hard: 1, build: (b) => {
    const m = M.marble(0xEEEDEA);
    b.box(4, 0, 4, 12, 15, 12, M.stone(0x3A3C40)); b.box(3.5, 14, 3.5, 12.5, 15, 12.5, M.stone(0x2E3034));
    b.ellipsoid(8, 18, 8.5, 4.5, 3, 3, m); b.cyl('y', 8, 8.5, 1.5, 19, 22, m); b.ellipsoid(8, 25, 8, 2.75, 3.5, 3, m); b.ellipsoid(8, 26.5, 9, 2.75, 2.25, 2.5, M.marble(0xE2E0DA));
    b.box(7.5, 24.5, 4.5, 8.5, 26, 5.5, m);
  } }));
  def('deco', 'macrame', 'wall', 'Macramé · wall hanging', Object.assign({}, DK, { res: 16, size: [1, 2, 1], col: 'cream', mount: 'wall', solid: false, sound: 'wool', build: (b) => {
    const c = M.fabric(0xEDE6D8), cd = M.fabric(0xD8CDB8);
    b.cyl('x', 26.5, 15.5, 0.75, 1, 15, M.wood(P.walnut));
    for (let x = 3; x < 13; x++) { const bottom = 6 + Math.abs(x + 0.5 - 8) * 1.2; b.box(x, bottom, 14, x + 1, 26, 15, (x % 2) ? c : cd); }   // cords in a V
    for (const [y, w] of [[23, 5], [20, 4], [17, 3], [14, 2]]) b.box(8 - w, y, 13, 8 + w, y + 1, 14, cd);                         // knotted rows
  } }));
  def('deco', 'record', 'walnut', 'Record Player · walnut console', Object.assign({}, DK, { size: [1, 1, 1], col: 'walnut', build: (b) => {
    const w = M.wood(P.walnut);
    for (const [x, z] of [[2, 3], [13, 3], [2, 13], [13, 13]]) b.box(x, 0, z, x + 1, 4, z + 1, M.metal(P.black));
    b.box(1, 4, 2, 15, 11, 15, w); b.cut(2, 5, 2, 14, 10, 14); b.box(2, 5, 13.5, 14, 10, 14.5, w);
    for (let x = 2.5; x < 13.5; x += 0.75) b.box(x, 5, 4, x + 0.5, 9.5, 13, M.matte([0x2A2D33, 0xC0443A, 0xE8B83A, 0x2F55C8, 0xF2F0EA][Math.round(x * 4) % 5]));
    b.box(1.5, 11, 2.5, 14.5, 12, 14.5, M.wood(sh(P.walnut, 1.15))); b.cyl('y', 7, 8.5, 4.5, 12, 12.5, M.gloss(0x111214)); b.cyl('y', 7, 8.5, 1.4, 12.5, 12.75, M.matte(0xC0443A));
    b.rod(13, 12.5, 12, 10, 12.75, 7, 0.4, M.chrome()); b.cyl('y', 13, 12, 0.75, 12, 13, M.chrome());
  } }));
  def('deco', 'aquarium', 'cabinet', 'Aquarium · on a cabinet', Object.assign({}, DK, { cats: ['deco', 'living'], size: [2, 2, 1], col: 'sky', toggle: true, light: [4, 8, 11], sound: 'glass', build: (b) => {
    b.box(0.5, 0, 3, 31.5, 12, 15, M.wood(P.walnut)); b.box(1, 1, 2.5, 15.75, 11.5, 3, M.wood(sh(P.walnut, 0.9))); b.box(16.25, 1, 2.5, 31, 11.5, 3, M.wood(sh(P.walnut, 0.9)));
    b.box(1, 12, 3.5, 31, 27, 14.5, M.glass(0x9ED8F0)); b.box(1, 12, 3.5, 31, 13, 14.5, M.stone(0xD9CBB0)); b.box(1, 27, 3, 31, 28.5, 15, M.metal(P.black)); b.box(2, 26.5, 5, 30, 27, 13, M.light(0xE8F8FF));
    for (const [x, h] of [[4, 9], [7, 6], [24, 11], [27.5, 7], [14, 5]]) for (let k = 0; k < 3; k++) b.box(x + k * 0.75, 13, 11 - k, x + k * 0.75 + 0.5, 13 + h - k * 1.5, 11.5 - k, M.plant([0x3E8A4A, 0x5AAE5A, 0x2E6A3A][k]));
    b.ellipsoid(19, 13.5, 9, 2.5, 1, 2, M.stone(0x6E6C66));
    for (const [x, y, z, c] of [[10, 20, 8, 0xF07E1E], [20, 22, 7, 0x5CC8F0], [16, 17, 10, 0xF2C84A], [25, 19, 9, 0xF07E1E]]) { b.ellipsoid(x, y, z, 1.4, 0.75, 0.5, M.gloss(c)); b.box(x + 1, y - 0.5, z - 0.25, x + 2, y + 0.5, z + 0.25, M.gloss(c)); }
  } }));

  // ---------------------------------------------------------------- registration: after Vollton (blocks6.js) — VR.BL.late
  // runs in load order at the end of blocks4.js; a re-run of this file (the Studio's editor) registers nothing new
  if (VR.BL && !(VR.R && VR.R.T)) { VR.BL.late = VR.BL.late || []; VR.BL.late.push(() => VM.registerLate(NAMES)); }
})(VR);
