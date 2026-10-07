const V = require('./load_shared.js');
const R = V.R, SG = V.ShipGen;
const colorOf = (s) => {
  const t = R.types[R.T.type[s]], n = t.name;
  const C = V.COLOR_HEX;
  for (const c in C) if (n.startsWith(c + '_concrete') || n.startsWith(c + '_stained_glass') || n.startsWith(c + '_bed')) { const h = C[c]; return [(h >> 16) & 255, (h >> 8) & 255, h & 255, n.includes('glass') ? 150 : 255]; }
  const T = { hull_plating: [228, 232, 238], hull_plating_gray: [150, 156, 166], hull_plating_dark: [58, 62, 72], hull_stripe_orange: [240, 120, 40], hull_stripe_blue: [60, 130, 230], viewport: [150, 210, 255, 150], neon_cyan: [80, 250, 255], neon_magenta: [255, 80, 220], neon_amber: [255, 190, 60], neon_lime: [160, 255, 80], neon_white: [255, 255, 255], thruster: [90, 90, 100], helm: [80, 200, 255], pilot_seat: [120, 60, 60], console: [70, 120, 160], light_panel: [255, 255, 220], cargo_crate: [170, 130, 70], reactor_core: [90, 220, 255], energy_conduit: [80, 180, 230], metal_grate: [110, 115, 120], orange_terracotta: [180, 95, 50], hazard_stripes: [230, 200, 40], violet_crystal_block: [170, 90, 255], azure_crystal_block: [90, 180, 255], antenna: [160, 160, 170], satellite_dish: [220, 220, 225], turret: [70, 75, 85], holo_projector: [60, 90, 120], ladder: [150, 110, 60], crafting_table: [150, 100, 60], furnace: [110, 110, 110], barrel: [140, 100, 60], chest: [160, 110, 50] };
  const c = T[n] || [200, 0, 200]; return c.length === 3 ? [...c, 255] : c;
};
const out = [];
let bad = 0;
for (const arch of [...SG.archetypes]) {
  const stats = [];
  for (let k = 0; k < 40; k++) {
    const seed = 1000 + k * 7919;
    const t0 = Date.now();
    const bp = SG.design(seed, arch);
    const ms = Date.now() - t0;
    const probs = [];
    if (!bp.helm) probs.push('no helm');
    let seat = null;
    const idx = (x, y, z) => (y * bp.sz + z) * bp.sx + x;
    for (let y = 0; y < bp.sy; y++) for (let z = 0; z < bp.sz; z++) for (let x = 0; x < bp.sx; x++) { const s = bp.blocks[idx(x, y, z)]; if (s && R.types[R.T.type[s]].name === 'pilot_seat' && bp.helm && Math.abs(x - bp.helm[0]) + Math.abs(y - bp.helm[1]) + Math.abs(z - bp.helm[2]) <= 2) seat = [x, y, z]; }
    if (!seat) probs.push('no seat near helm');
    else { const above = bp.blocks[idx(seat[0], seat[1] + 1, seat[2])]; if (above && (R.T.flags[above] & V.F.SOLID)) probs.push('seat head blocked by ' + R.types[R.T.type[above]].name); }
    if (bp.thrusters < 1) probs.push('no thrusters');
    if (probs.length) { bad++; console.log(arch, seed, probs.join(', ')); }
    stats.push([bp.count, bp.sx, bp.sy, bp.sz, bp.thrusters, ms]);
    if (k < 3) {
      const cells = [];
      for (let y = 0; y < bp.sy; y++) for (let z = 0; z < bp.sz; z++) for (let x = 0; x < bp.sx; x++) { const s = bp.blocks[idx(x, y, z)]; if (s) cells.push([x, y, z, ...colorOf(s)]); }
      out.push({ name: bp.name + ' (' + bp.label + ', ' + bp.paletteName + ')', sx: bp.sx, sy: bp.sy, sz: bp.sz, cells });
    }
  }
  const avg = (i) => (stats.reduce((a, s) => a + s[i], 0) / stats.length).toFixed(1);
  const max = (i) => Math.max(...stats.map(s => s[i]));
  console.log(arch.padEnd(12), 'blocks', avg(0), 'size', avg(1) + 'x' + avg(2) + 'x' + avg(3), 'maxW', max(1), 'maxL', max(3), 'thr', avg(4), 'ms', avg(5));
}
console.log('problems', bad);
const SHIPS = require('path').join(__dirname, '..', 'test', 'ships');   // the output folder (gitignored) may not exist yet
require('fs').mkdirSync(SHIPS, { recursive: true });
require('fs').writeFileSync(SHIPS + '/designs.json', JSON.stringify(out));
console.log(bad ? 'FAILED ' + bad : 'ALL OK');
process.exit(bad ? 1 : 0);
