// ✨ Genie without Claude: the answer parser and the shapes → blocks rasteriser (geometry only; colours need textures)
global.window = global; global.self = global;
const VR = require('/home/claude/vr/test/load_shared.js');
require('/home/claude/vr/src/studio/housekit.js');
require('/home/claude/vr/src/studio/genie.js');
const G = VR.Genie, KEEP = 0xffff;
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('✗', m); } else console.log('✓', m); };
const filled = (g) => { const out = new Set(); for (let y = 0; y < g.sy; y++) for (let z = 0; z < g.sz; z++) for (let x = 0; x < g.sx; x++) { const s = g.blocks[(y * g.sz + z) * g.sx + x]; if (s && s !== KEEP) out.add(x + ',' + y + ',' + z); } return out; };
const at = (g, x, y, z) => g.blocks[(y * g.sz + z) * g.sx + x];
// boxes: inclusive corners, trimmed to what is filled
{ const g = G.raster({ parts: [{ box: [2, 0, 1, 5, 2, 3], color: '#ff0000' }] }); ok(g.sx === 4 && g.sy === 3 && g.sz === 3 && g.n === 36, 'a box fills its corners inclusive and the grid is trimmed to it (' + [g.sx, g.sy, g.sz, g.n] + ')'); }
// a cylinder along x (a wheel): round in y–z, len long in x
{ const g = G.raster({ parts: [{ cyl: [0, 3, 3, 2, 2], axis: 'x', color: '#000' }] }); ok(g.sx === 2 && g.sy === 5 && g.sz === 5 && !filled(g).has('0,0,0') && filled(g).has('0,2,2'), 'a cylinder along x: 2 long, round (corners empty) — ' + [g.sx, g.sy, g.sz, g.n]); }
// a cone pointing up narrows to its tip
{ const g = G.raster({ parts: [{ cone: [4, 0, 4, 3, 6], axis: 'y', color: '#0f0' }] }); const f = filled(g); let low = 0, high = 0; for (const k of f) { const y = +k.split(',')[1]; if (y === 0) low++; if (y === g.sy - 1) high++; } ok(g.sy === 6 && low > high * 4 && high >= 1, 'a cone narrows from ' + low + ' cells at the base to ' + high + ' at the tip'); }
// a wedge sloping down toward the front (−z): full height at the back
{ const g = G.raster({ parts: [{ wedge: [0, 0, 0, 0, 3, 3], down: '-z', color: '#00f' }] }); ok(at(g, 0, 3, 3) !== KEEP && at(g, 0, 3, 0) === KEEP && at(g, 0, 0, 0) !== KEEP, 'a wedge is high at the back and low at the front'); }
// a line (capsule) between two points
{ const g = G.raster({ parts: [{ line: [0, 0, 0, 6, 6, 0], r: 0.5, color: '#888' }] }); const f = filled(g); ok(f.has('0,0,0') && f.has('3,3,0') && f.has('6,6,0') && !f.has('6,0,0') && !f.has('0,6,0'), 'a line runs diagonally from corner to corner (' + f.size + ' cells)'); }
// mirror: the left wheel is built again on the right
{
  const g = G.raster({ size: [9, 4, 10], parts: [{ box: [1, 1, 0, 7, 3, 9], color: '#c00' }, { cyl: [0, 1, 2, 1, 1], axis: 'x', color: '#111', mirror: true }, { ball: [2, 3, 0, 0.6, 0.6, 0.6], color: '#ff0', mat: 'light', mirror: true }] });
  const f = filled(g); let sym = true;
  for (const k of f) { const [x, y, z] = k.split(',').map(Number); if (!f.has((g.sx - 1 - x) + ',' + y + ',' + z)) { sym = false; break; } }
  ok(g.sx === 9 && sym, 'mirror: a body with a wheel and a lamp on the left comes out symmetric (' + g.sx + ' wide)');
}
// "air" carves the model but never the world around it
{ const g = G.raster({ parts: [{ box: [0, 0, 0, 4, 4, 4], color: '#999' }, { box: [1, 1, 1, 3, 3, 3], color: 'air' }, { box: [8, 8, 8, 9, 9, 9], color: 'air' }] }); let air = 0, keep = 0; for (const s of g.blocks) { if (s === 0) air++; if (s === KEEP) keep++; } ok(g.sx === 5 && air === 27 && keep === 0, 'carving: 27 cells of air inside, nothing outside (' + [g.sx, air, keep] + ')'); }
// hollow keeps only the shell
{ const g = G.raster({ parts: [{ box: [0, 0, 0, 5, 5, 5], color: '#999', hollow: true }] }); ok(g.n === 216 - 64, 'hollow: only the shell (' + g.n + ')'); }
// coordinates below 0 are shifted in; a huge answer is scaled down to the limit
{ const g = G.raster({ parts: [{ box: [-3, -2, -1, 2, 1, 1], color: '#999' }] }); ok(g.sx === 6 && g.sy === 4 && g.sz === 3, 'negative coordinates are shifted into the grid'); }
{ const g = G.raster({ parts: [{ box: [0, 0, 0, 299, 9, 9], color: '#999' }] }, { max: 96 }); ok(g.sx === 96 && g.sy <= 4, 'a 300-long answer is scaled to 96 (' + [g.sx, g.sy, g.sz] + ')'); }
// rubbish parts are skipped, an answer without any usable part is null
{ const g = G.raster({ parts: [{ box: [0, 0, 0, 'x', 1, 1] }, { blob: 1 }, null, { box: [0, 0, 0, 1, 1, 1], color: '#fff' }] }); ok(g && g.n === 8, 'broken parts are skipped'); ok(G.raster({ parts: [{ sphere: 1 }] }) === null, 'nothing usable → null'); }
// the parser: a house is a house, a model a model, nonsense an error
{
  const h = G.parse({ kind: 'house', name: 'Haus', width: 99, roof: { type: 'gable' }, extras: ['pool', 'nope'] });
  ok(h.kind === 'house' && h.spec.width === 31 && h.spec.extras.join() === 'pool', 'a house answer is normalised (' + h.spec.width + ', ' + h.spec.extras + ')');
  const h2 = G.parse({ roof: { type: 'hip' }, walls: { material: 'brick' } });
  ok(h2.kind === 'house' && h2.spec.roof.type === 'hip', 'a house without "kind" is still recognised');
  const m = G.parse([{ kind: 'model', name: 'Auto', size: [5, 4, 9], parts: [{ box: [0, 0, 0, 4, 2, 8], color: '#f00' }] }]);
  ok(m.kind === 'model' && m.name === 'Auto' && m.model.parts.length === 1, 'a model answer (even inside an array)');
  let threw = null; try { G.parse({ kind: 'model', parts: [] }); } catch (e) { threw = e.code; }
  ok(threw === 'invalid_json', 'a model without parts → invalid_json');
}
// no Claude anywhere: always available, no prompt, no sampling
{
  const src = require('fs').readFileSync('/home/claude/vr/src/studio/genie.js', 'utf8');
  ok(typeof G.prompt === 'undefined' && typeof G.askRaw === 'undefined' && !/claude\.use|\bsample\b/.test(src), 'the Genie never asks Claude (no prompt, no sample)');
  ok(G.available() instanceof Promise && /LOCAL = Object\.freeze\(\{ local: true, images: true/.test(src), 'the Genie is always available, photos included');
}
// rings and clipped parts: a ring is hollow, a clipped ball is a dome
{ const g = G.raster({ parts: [{ cyl: [5, 0, 5, 5, 1], axis: 'y', inner: 3.5, color: '#999' }] }); let mid = g.blocks[(0 * g.sz + 5) * g.sx + 5]; ok(g.sx === 11 && mid === KEEP, 'a ring has nothing in its middle'); }
{ const g = G.raster({ parts: [{ ball: [5, 0, 5, 5, 5, 5], color: '#999', clip: [-99, 0, -99, 99, 99, 99] }] }); ok(g.sy === 6 && g.sx === 11, 'a ball cut at the ground is a dome (' + [g.sx, g.sy, g.sz] + ')'); }
// paint only recolours, fit scales up
{ const g = G.raster({ parts: [{ box: [0, 0, 0, 3, 3, 3], color: '#ff0000' }, { box: [2, 2, 2, 9, 9, 9], color: '#0000ff', paint: true }] }); ok(g.sx === 4 && g.n === 64, 'paint never adds blocks (' + [g.sx, g.n] + ')'); }
{ const g = G.raster({ parts: [{ box: [0, 0, 0, 3, 1, 1], color: '#999' }], fit: 16 }); ok(g.sx === 16 && g.sy === 8, 'fit scales a small plan up (' + [g.sx, g.sy, g.sz] + ')'); }
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
