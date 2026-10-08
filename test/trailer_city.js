// The trailer's Palm City, glass villas and terraced hills (vgen 6, TRAILER.md §3.2–3.3, docs/trailer shots F and G): the
// generated blocks of the city carry what the frames show — tall palms with fronds, glass villas (glass walls to the
// garden, white gloss floor, cove strips, a round cyan-ringed pad, floating glass steps) — and the green hills behind the
// city are cut into 2-block terraces with white villas on the treads. Older worlds (vgen 5) keep their smooth hills
// (test/gen_same.js holds their hash).
const V = require('./load_shared.js');
const fs = require('fs');
let fails = 0; const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const R = V.R, TT = R.T;
const nm = (b) => b ? R.types[TT.type[b]].name : '.';
const t0 = Date.now();
// the chunks of a window, generated once: key "cx,cz" → blocks
function window_(g, cx0, cx1, cz0, cz1) {
  const m = new Map();
  for (let cx = cx0; cx <= cx1; cx++) for (let cz = cz0; cz <= cz1; cz++) m.set(cx + ',' + cz, g.generate(cx, cz).blocks);
  return m;
}
const at = (m, x, y, z) => { const b = m.get((x >> 4) + ',' + (z >> 4)); if (!b || y < 0 || y > 255) return 0; return b[(y << 8) | ((z & 15) << 4) | (x & 15)]; };

// ---------------------------------------------------------------- the Palm City (shot F, G): chunks −6…6 × −14…−3
const g6 = V.makeGen('overworld', 4242, { vgen: 6 });
const city = window_(g6, -6, 6, -14, -3);
const counts = {}, floating = [], crowns = [];
for (const [key, blocks] of city) {
  const [cx, cz] = key.split(',').map(Number);
  for (let col = 0; col < 256; col++) {
    const lx = col & 15, lz = col >> 4, x = cx * 16 + lx, z = cz * 16 + lz;
    for (let y = 0; y < 256; y++) {
      const b = blocks[(y << 8) | col];
      if (!b) continue;
      const n = nm(b);
      counts[n] = (counts[n] || 0) + 1;
      if (n === 'vx_palm_crown') crowns.push([x, y, z]);
      if (n === 'glass' && at(city, x, y - 1, z) === 0 && y > 80) floating.push([x, y, z]);
    }
  }
}
const c = (n) => counts[n] || 0;
console.log('  the Palm City window: ' + [...city.keys()].length + ' chunks, scanned in ' + (Date.now() - t0) + ' ms');
check(c('vx_palm_crown') >= 8 && c('vx_palm_frond') >= 40, `tall palms with fronds: ${c('vx_palm_crown')} crowns, ${c('vx_palm_frond')} frond blocks`);
// every crown has a trunk under it at least 7 blocks tall, and its fronds reach out around it
let tallOK = 0, reachOK = 0;
for (const [x, y, z] of crowns) {
  // the trunk: 7+ trunk blocks in the 14 below the crown (a neighbour's frond or base can take one block of a trunk)
  let k = 0; for (let j = 1; j <= 14; j++) if (nm(at(city, x, y - j, z)) === 'vx_palm_trunk') k++;
  if (k >= 7) tallOK++;
  let fr = 0; for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) for (let dy = -2; dy <= 1; dy++) { if (nm(at(city, x + dx, y + dy, z + dz)) === 'vx_palm_frond') fr++; }
  if (fr >= 6) reachOK++;
}
check(crowns.length > 0 && tallOK === crowns.length, `every palm has a trunk of 7+ blocks (${tallOK} of ${crowns.length})`);
check(crowns.length > 0 && reachOK >= Math.ceil(crowns.length * 0.8), `the fronds spread round the crown (${reachOK} of ${crowns.length} with 6+ frond blocks near)`);
check(c('glass') >= 3 && floating.length >= 3, `floating glass steps: ${floating.length} glass blocks with air under them`);
check(c('vx_glass_wall') >= 60, `glass villas: ${c('vx_glass_wall')} glass wall blocks to the garden`);
check(c('white_concrete') >= 60, `white gloss floors: ${c('white_concrete')} blocks`);
check(c('vx_tech_white_strip') >= 40, `cove light strips on the walls: ${c('vx_tech_white_strip')} blocks`);
check(c('vx_floor_pad') >= 9 && c('vx_hex_light_cyan') >= 3, `round cyan pads (${c('vx_floor_pad')}) and cyan hex lights (${c('vx_hex_light_cyan')})`);
check(c('vx_bed_white') >= 2 && c('vx_sofa_white') >= 2, `the glass villas are furnished: ${c('vx_bed_white')} beds, ${c('vx_sofa_white')} white sofas`);

// ---------------------------------------------------------------- the terraces (shot F: t3_07–t3_09): a line across the hills
const TERRAIN = new Set(['grass_block', 'dirt', 'stone', 'deepstone']);
function topLine(g, z, x0, x1) {
  const cz = Math.floor(z / 16), cx0 = Math.floor(x0 / 16), cx1 = Math.floor(x1 / 16);
  const win = window_(g, cx0, cx1, cz, cz);
  const tops = [];
  for (let x = x0; x <= x1; x++) {
    let top = -1, above = null;
    for (let y = 200; y > 60; y--) { const n = nm(at(win, x, y, z)); if (TERRAIN.has(n)) { top = y; above = nm(at(win, x, y + 1, z)); break; } }
    tops.push([x, top, above]);
  }
  return tops;
}
const line6 = topLine(g6, -330, -200, 200);
const hills = line6.filter(t => t[1] >= 88);
const odd = hills.filter(t => t[1] % 2 !== 0).length;
const grassAbove = hills.filter(t => t[2] === 'grass_block').length;
let runs = 0, flat3 = 0, risers = 0;
for (let i = 1; i < line6.length; i++) {
  const a = line6[i - 1][1], b = line6[i][1];
  if (a >= 88 && b >= 88 && a !== b) risers++;
}
for (let i = 0; i < line6.length;) { let j = i; while (j + 1 < line6.length && line6[j + 1][1] === line6[i][1]) j++; if (line6[i][1] >= 88 && j - i + 1 >= 3) flat3++; runs++; i = j + 1; }
console.log(`  the hills along z −330: ${hills.length} columns on the slopes, ${flat3} treads of 3+ blocks, ${risers} risers`);
check(hills.length >= 40, `the hills rise above the foot (${hills.length} columns at 88+)`);
check(odd <= Math.max(2, hills.length * 0.04), `the tops sit on 2-block steps (${odd} odd tops of ${hills.length})`);
check(flat3 >= 5 && risers >= 5, `the slopes are terraced: ${flat3} flat treads, ${risers} risers`);
check(grassAbove === 0, `the cut is clean: no wild grass left above a tread (${grassAbove})`);
// the same line in a vgen-5 world keeps the smooth hills (odd tops, no treads)
const g5 = V.makeGen('overworld', 4242, { vgen: 5 });
const line5 = topLine(g5, -330, -200, 200);
const hills5 = line5.filter(t => t[1] >= 88), odd5 = hills5.filter(t => t[1] % 2 !== 0).length;
check(hills5.length === 0 || odd5 > hills5.length * 0.2, `vgen 5 keeps its smooth hills (${odd5} of ${hills5.length} tops are odd)`);
// the villas and palms on the terraces
const hillWin = window_(g6, -17, 17, -27, -13);
let villaWin = 0, palmsH = 0;
for (const blocks of hillWin.values()) for (let i = 0; i < blocks.length; i++) { const b = blocks[i]; if (!b) continue; const n = nm(b); if (n === 'vx_window_tech') villaWin++; else if (n === 'vx_palm_crown') palmsH++; }
check(villaWin >= 20, `white villas stand on the terraces: ${villaWin} city-window blocks in the hills (${palmsH} palms)`);

// ---------------------------------------------------------------- the default world is vgen 6
const src = fs.readFileSync(__dirname + '/../src/main/game.js', 'utf8');
check(/dim: 'overworld', vgen: 6 \}/.test(src), 'new worlds are made as vgen 6 (src/main/game.js)');

console.log('  ' + (Date.now() - t0) + ' ms');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
