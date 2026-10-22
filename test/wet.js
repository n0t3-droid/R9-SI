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

console.log('f · rain under glass (t-polish2): a face is open to the rain above its column\'s top rain-stopping block');
{
  // (t-material's gap: the wet look asked the sky light, and glass passes it — Weißstadt's street under its glass vault got
  //  wet and grew puddles though the rain particles stop at the vault. The rain's own height map decides now)
  const R = V.R, Fl = V.F, st = (n) => R.byName[n].defaultState;
  check(typeof W.blocksRain === 'function' && typeof W.rainTop === 'function' && typeof W.faceOpen === 'function' && typeof W.fillMap === 'function', 'VR.Wet has the column test (blocksRain, rainTop, faceOpen, fillMap)');
  if (typeof W.blocksRain === 'function') {
    check(['glass', 'frosted_glass', 'glass_pane', 'stone', 'oak_leaves', 'water'].every(n => W.blocksRain(st(n))) && !W.blocksRain(0) && !W.blocksRain(st('short_grass')) && !W.blocksRain(st('torch')), 'glass, panes, stone, leaves and water stop the rain; air, grass tufts and torches do not');
    // the same rule as the column heights the world keeps (world.js: SOLID | FLUID | LEAVES) and the rain particles stop at
    let diff = 0; for (let s = 1; s < R.T.flags.length; s++) if (W.blocksRain(s) !== !!(R.T.flags[s] & (Fl.SOLID | Fl.FLUID | Fl.LEAVES))) diff++;
    check(diff === 0, 'the rule is the world\'s column heights\' rule for every state', diff + ' states differ');
    // a small world: a floor at y 10 over x 0…9, a glass roof at y 16 over x 0…3, a leaf at (6, 14), a wall at x 9 up to 13
    const B = new Map(), key = (x, y, z) => x + ',' + y + ',' + z;
    for (let x = 0; x < 10; x++) for (let z = 0; z < 4; z++) B.set(key(x, 10, z), st('stone'));
    for (let x = 0; x < 4; x++) for (let z = 0; z < 4; z++) B.set(key(x, 16, z), st('glass'));
    for (let z = 0; z < 4; z++) { B.set(key(6, 14, z), st('oak_leaves')); for (let y = 11; y <= 13; y++) B.set(key(9, y, z), st('stone')); }
    const get = (x, y, z) => B.get(key(x, y, z)) || 0, top = (x, z) => W.rainTop(get, x, z, 40, 0);
    check(top(1, 1) === 16 && top(5, 1) === 10 && top(6, 1) === 14 && top(9, 1) === 13 && top(20, 20) === -1, 'the column\'s top: the glass roof, the floor, the leaf, the wall, none', [top(1, 1), top(5, 1), top(6, 1), top(9, 1), top(20, 20)].join(' · '));
    check(!W.faceOpen(top, 1, 10, 1, 0, 1, 0) && W.faceOpen(top, 5, 10, 1, 0, 1, 0), 'the floor under the glass roof stays dry, the floor in the open gets the rain');
    check(!W.faceOpen(top, 6, 10, 1, 0, 1, 0), 'under a leaf the floor stays dry (the canopy holds the rain, as the particles stop at it)');
    check(W.faceOpen(top, 9, 12, 1, -1, 0, 0) && W.faceOpen(top, 9, 12, 1, 1, 0, 0), 'a wall\'s faces are open where the cell in front of them is open to the sky');
    check(!W.faceOpen(top, 4, 11, 1, -1, 0, 0), 'a wall face whose cell in front lies under the glass roof stays dry');
    // the map (game.js): the 128² window's texels are the columns' tops, clamped to the R8 range
    const cols = new Map(), Hc = new Uint16Array(256); Hc.fill(300); cols.set('0,0', { height: Hc });
    const w = { col: (cx, cz) => cols.get(cx + ',' + cz) || null, topAt: (x, z) => { const c = w.col(x >> 4, z >> 4); return c ? c.height[((z & 15) << 4) | (x & 15)] : 0; } };
    const out = new Uint8Array(128 * 128); W.fillMap(w, -64, -64, out);
    check(out[64 * 128 + 64] === 255 && out[0] === 0, 'the map holds the columns\' tops round the camera, clamped to 255 (an R8 map wrapped above y 255)', out[64 * 128 + 64] + ' · ' + out[0]);
    // the hall city (seed 53, the meadow site of cell (−2, −1), vgen 9+): the plan's blocks applied, its street under the
    // frosted glass vault closed, the forecourt before its entrance end open
    const VG = V.VillageGen, g = new V.OverworldGen(53, { worldType: 'default', vgen: 11 }), s = VG.site(g, -2, -1);
    if (s && s.style === 'hall') {
      const plan = VG.plan(g, s), H = plan.hall, cmap = new Map(), ROT = [(u, v) => [u, v], (u, v) => [-v, u], (u, v) => [-u, -v], (u, v) => [v, -u]];
      const colOf = (x, z) => { const k = x * 65536 + z; let c = cmap.get(k); if (!c) { c = new Int32Array(256); cmap.set(k, c); } return c; };
      for (const b of plan.chunks.values()) {
        for (let i = 0; i < b.f.length; i += 5) { const c = colOf(b.f[i], b.f[i + 1]); for (let y = Math.max(1, b.f[i + 2]); y <= Math.min(254, b.f[i + 3]); y++) c[y] = b.f[i + 4]; }
        for (let i = 0; i < b.o.length; i += 4) { const y = b.o[i + 1]; if (y >= 1 && y <= 254) colOf(b.o[i], b.o[i + 2])[y] = b.o[i + 3]; }
      }
      const getH = (x, y, z) => { const c = cmap.get(x * 65536 + z); return c ? Math.max(0, c[y]) : 0; }, topH = (x, z) => W.rainTop(getH, x, z, 254, 1);
      const W2 = (u, v) => { const q = ROT[H.r](u, v); return [H.cx + q[0], H.cz + q[1]]; };
      let under = 0, wetUnder = 0;
      for (let v = -70; v <= 36; v += 2) for (let u = -3; u <= 3; u++) { if (Math.abs(v) <= 13) continue; const [x, z] = W2(u, v); under++; if (W.faceOpen(topH, x, H.F, z, 0, 1, 0)) wetUnder++; }
      // the paths out of the two gates in the long walls, at the floor's level outside the hall
      let fore = 0, wetFore = 0;
      for (const sg of [-1, 1]) for (let a = 50; a <= 60; a++) for (let v = -3; v <= 3; v++) { const [x, z] = W2(sg * a, v); if (topH(x, z) !== H.F) continue; fore++; if (W.faceOpen(topH, x, H.F, z, 0, 1, 0)) wetFore++; }
      check(under > 250 && wetUnder === 0, `the hall city's street under its glass vault stays dry in the rain (${wetUnder} of ${under} street cells open)`);
      check(fore > 50 && wetFore === fore, `the paths out of its gates get the rain (${wetFore} of ${fore} cells open)`);
    } else check(false, 'the hall city of seed 53 at cell (−2, −1)');
  }
  // the shader: the wet look asks the rain's map (PBR only: Very Low's programs never see it)
  const fs = V.SHADERS.TERRAIN_FS, i = fs.indexOf('t-material · the wet world'), k = fs.indexOf('#endif', i), blk = fs.slice(i, k);
  check(/rainOpen\(/.test(blk) && /float rainOpen\(/.test(fs) && fs.indexOf('float rainOpen(') > fs.lastIndexOf('#ifdef PBR', fs.indexOf('float rainOpen(')) && fs.indexOf('uniform sampler2D u_rainTop') > fs.lastIndexOf('#ifdef PBR', fs.indexOf('uniform sampler2D u_rainTop')), 'the wet look asks the rain\'s height map (rainOpen, u_rainTop: inside #ifdef PBR)');
  const R2 = fs.slice(fs.indexOf('float rainOpen('), fs.indexOf('}', fs.indexOf('float rainOpen(')) + 1);
  check(/u_rainMap\.z/.test(R2) && /N \* 0\.5/.test(R2) && /texelFetch\(u_rainTop/.test(R2), 'a face reads the cell in front of it; without this frame\'s map the sky light alone decides');
  // the renderer binds it on a unit no other sampler of the terrain programs uses (common, bindTerrainTextures, bindRainMap)
  const src = require('fs').readFileSync(__dirname + '/../src/main/renderer.js', 'utf8');
  const body = (head) => { const a = src.indexOf(head), b = src.indexOf('\n    }\n', a); return a > 0 && b > a ? src.slice(a, b) : ''; };
  const text = body('    common(p, E) {') + body('    bindTerrainTextures(p) {') + body('    bindRainMap(p) {'), units = {};
  for (const m of text.matchAll(/uniform1i\(p\.u\.(u_\w+), (\d+)\)/g)) (units[m[2]] = units[m[2]] || new Set()).add(m[1]);
  check(units['9'] && units['9'].size === 1 && units['9'].has('u_rainTop') && /bindRainMap\(p\)/.test(body('    bindTerrainTextures(p) {')), 'the rain\'s map sits on unit 9 of the terrain programs, alone, bound with the others', units['9'] ? [...units['9']].join(', ') : 'none');
  // and game.js hands it over only while the ground is wet on a PBR tier (never on Very Low: no wet ground, no PBR)
  const gsrc = require('fs').readFileSync(__dirname + '/../src/main/game.js', 'utf8');
  check(/wetMap = \(E\.wet > 0\.001 \|\| E\.puddle > 0\.001\) && !!rq && \(rq\.pbr \| 0\) >= 1 && !rq\.lite/.test(gsrc) && /precip, rainMap,/.test(gsrc), 'game.js keeps the map while the ground is wet (PBR tiers only) and hands it to the renderer');
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
