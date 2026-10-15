// t-material · the wet world (plan docs/superpowers/plans/2026-10-15-t-material.md, step 3), no browser:
//  a · the drying curve (wet.js VR.Wet): the ground wets within ~20 s of rain, a drizzle less; after the rain it dries over
//      ten minutes (wet after 2, 5, 10 min); puddles fill within ~45 s of a proper rain (none in a drizzle) and dry with it,
//      shrinking from their edges (the mask's threshold)
//  b · how much a material darkens wet: soil, sand, stone a lot; polish, tiles, metal, glass hardly
//  c · env.js hands the model to the shaders (E.wet, E.puddle) and keeps it after the rain; none with the switch off
//  d · the drops from the eaves: under an overhang's edge while the roof is wet, none when dry or without particles
//  e · the shader text: the wet look sits in the PBR path (open sky only, walls in streaks, puddles by the fill's edge,
//      rain rings in them)
//   bash test/wt_run.sh wet.js 300
require('./dom_stub.js');
const V = require('./load_shared.js');
require('../src/main/wet.js');
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
const W = V.Wet;

console.log('a · the drying curve');
{
  const s = W.state();
  for (let t = 0; t < 20; t++) W.step(s, 1, 1);
  check(s.wet >= 0.9, 'the ground is wet within 20 s of a full rain', s.wet.toFixed(3));
  for (let t = 0; t < 25; t++) W.step(s, 1, 1);
  check(s.pud >= 0.8, 'the puddles are full within 45 s', s.pud.toFixed(3));
  for (let t = 0; t < 3600; t++) W.step(s, 1, 1);
  const at = {};
  for (let t = 1; t <= 900; t++) { W.step(s, 0, 1); if ([60, 120, 300, 600, 900].includes(t)) at[t] = [+s.wet.toFixed(3), +s.pud.toFixed(3)]; }
  console.log('     after the rain (s → [wet, puddles]):', JSON.stringify(at));
  check(at[120][0] > 0.45 && at[300][0] > 0.15 && at[300][0] < 0.35, 'two minutes after the rain the ground is still wet, after five a little', `${at[120][0]}, ${at[300][0]}`);
  check(at[600][0] <= 0.06 && at[600][1] <= 0.06, 'after ten minutes it is dry (≤ 6 %)', JSON.stringify(at[600]));
  check(at[900][0] < 0.015, 'after fifteen nothing is left', at[900][0]);
  const d = W.state(); for (let t = 0; t < 300; t++) W.step(d, 0.15, 1);
  check(d.wet > 0.15 && d.wet < 0.3 && d.pud === 0, 'a drizzle wets the ground a little and makes no puddles', `${d.wet.toFixed(3)} / ${d.pud}`);
  const big = W.edge(1), mid = W.edge(0.5), small = W.edge(0.05);
  check(big > mid && mid > small, 'the puddles shrink from their edges as they dry (the mask threshold falls with the fill)', `${big} > ${mid} > ${small}`);
  // a frame's step is stable at any frame time (0 … 10 s clamps)
  const a = W.state(), b = W.state(); for (let t = 0; t < 60; t++) W.step(a, 1, 1); for (let t = 0; t < 3600; t++) W.step(b, 1, 1 / 60);
  check(Math.abs(a.wet - b.wet) < 1e-3 && Math.abs(a.pud - b.pud) < 1e-3, 'the curve does not depend on the frame rate', `${a.wet.toFixed(4)} vs ${b.wet.toFixed(4)}`);
}

console.log('b · how materials darken wet');
{
  const soil = W.darken(0.95, 0), stone = W.darken(0.85, 0), marble = W.darken(0.12, 0.6), tile = W.darken(0.28, 0.55), metal = W.darken(0.3, 0);
  console.log(`     soil ${soil.toFixed(2)} · stone ${stone.toFixed(2)} · marble ${marble.toFixed(2)} · gloss tile ${tile.toFixed(2)} · metal ${metal.toFixed(2)}`);
  check(soil >= 0.35 && stone >= 0.25, 'soil, sand and stone soak water and darken');
  check(marble < 0.02 && tile < 0.02 && metal < 0.02, 'polish, gloss tiles and metal shed it');
}

console.log('c · env.js');
{
  require('../src/main/weather.js'); require('../src/main/skybodies.js'); require('../src/main/env.js');
  const env = new V.Env();
  const o = { dim: 'overworld', eyeSky: 1, renderDist: 8, wetOn: true, freezeTime: true };
  env.wx.force('regen'); for (let i = 0; i < 1200; i++) env.update(0.1, o);
  const rainy = { wet: env.E.wet, pud: env.E.puddle, rain: env.E.rain };
  env.wx.force('klar'); for (let i = 0; i < 1200; i++) env.update(0.1, o);   // two minutes
  const after = { wet: env.E.wet, pud: env.E.puddle, rain: env.E.rain };
  console.log('     rain', JSON.stringify(rainy), '· two minutes later', JSON.stringify(after));
  check(rainy.wet > 0.8 && rainy.pud > 0.6, 'in the rain the ground is wet and the puddles fill');
  check(after.rain < 0.05 && after.wet > 0.3 && after.pud > 0.25, 'two minutes after it the rain has stopped but the ground is still wet (it was dry at once before)');
  const off = Object.assign({}, o, { wetOn: false }); env.wx.force('regen'); for (let i = 0; i < 600; i++) env.update(0.1, off);
  check(env.E.wet === 0 && env.E.puddle === 0, 'with the switch off (Very Low) nothing is wet');
}

console.log('d · the drops from the eaves');
{
  const R = V.R, solid = R.byName.stone.defaultState;
  // a roof of one block's thickness over (0…5, y 10, 0…5) with its edge row at z = 5 overhanging (air under it)
  const blocks = new Map(); const key = (x, y, z) => x + ',' + y + ',' + z;
  for (let x = 0; x < 6; x++) for (let z = 0; z < 6; z++) blocks.set(key(x, 10, z), solid);
  for (let x = 0; x < 6; x++) for (let y = 0; y < 10; y++) blocks.set(key(x, y, 0), solid);   // a wall at z = 0
  const world = { getBlock: (x, y, z) => blocks.get(key(x, y, z)) || 0, isLoaded: () => true, topAt: (x, z) => { for (let y = 40; y >= 0; y--) if (blocks.get(key(x, y, z))) return y; return 0; } };
  let n = 0; const particles = { spawn: () => { n++; return 0; } };
  const g = { env: { E: { wet: 1, rain: 1 } }, particles, world, player: { pos: [3, 6, 3] }, settings: { particles: 2 } };
  for (let i = 0; i < 120; i++) W.drips(g, 1 / 30);
  check(g._eaves && g._eaves.length > 0 && n > 0, 'drops fall from the roof\'s edges in the rain', `${g._eaves.length} eaves, ${n} drops in 4 s`);
  const eaveOk = g._eaves.every(([x, y, z, ox, oz]) => { const bx = Math.floor(x - ox * 0.42), bz = Math.floor(z - oz * 0.42); return y === 10 && !world.getBlock(bx, 9, bz) && !world.getBlock(bx + ox, 10, bz + oz) && (bx === 0 || bx === 5 || bz === 5); });
  check(eaveOk && g._eaves.length === 14, 'only from the roof\'s outer edges with air under them (not the ceiling over the room, not over the wall)', g._eaves.length);
  n = 0; g.env.E.wet = 0.1; for (let i = 0; i < 120; i++) W.drips(g, 1 / 30);
  check(n === 0, 'none once the roof is dry');
  n = 0; g.env.E.wet = 1; g.settings.particles = 0; for (let i = 0; i < 120; i++) W.drips(g, 1 / 30);
  check(n === 0, 'none without particles (Very Low)');
}

console.log('e · the shader text');
{
  global.self = global; require('../src/shared/water_wave.js'); require('../src/main/shaders.js');
  const fs = V.SHADERS.TERRAIN_FS, i = fs.indexOf('t-material · the wet world'), j = fs.lastIndexOf('#ifdef PBR', i), k = fs.indexOf('#endif', i);
  check(i > 0 && j > 0 && j > fs.lastIndexOf('#endif', i), 'the wet look sits inside #ifdef PBR');
  const blk = fs.slice(i, k);
  check(/v_sky/.test(blk) && /u_puddle/.test(blk) && /streak/.test(blk), 'it reads the open sky, the walls\' streaks and the puddles\' fill');
  check(/pudRing\(/.test(fs) && fs.indexOf('vec2 pudRing(') > fs.lastIndexOf('#ifdef PBR', fs.indexOf('vec2 pudRing(')), 'rain rings in the puddles (PBR only)');
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
