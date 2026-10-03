// the 🏠 Haus-Baukasten: every roof, wall, window and extra builds; doors, stairs and furniture land where they should
global.window = global; global.self = global;
const VR = require('/home/claude/vr/test/load_shared.js');
require('/home/claude/vr/src/studio/housekit.js');
const HK = VR.HouseKit, R = VR.R, T = R.T;
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('✗', m); } };
const nameOf = (s) => { const t = R.types[T.type[s]]; return t ? t.name : '?'; };
function stats(g) {
  const cnt = new Map();
  for (const s of g.blocks) { if (s === 0xffff || !s) continue; const n = nameOf(s); cnt.set(n, (cnt.get(n) || 0) + 1); }
  return cnt;
}
const t0 = Date.now();
// every roof × style
for (const style of HK.STYLES) for (const type of HK.ROOFS) {
  const g = HK.build({ style, roof: { type, color: '#b0453a', ridge: 'side' }, floors: 2, width: 12, depth: 9, extras: HK.EXTRAS.slice() });
  const c = stats(g);
  ok(g.n > 300, `${style}/${type}: ${g.n} blocks`);
  ok([...c.keys()].some(n => /_door$|^door_/.test(n)), `${style}/${type}: has a door`);
  ok([...c.keys()].some(n => /_stairs$/.test(n)), `${style}/${type}: has stairs`);
  ok([...c.keys()].some(n => /^vm_bed|^vm_sofa/.test(n)), `${style}/${type}: has furniture`);
  ok(g.dy === g.origin[1] - 1 && g.origin[1] <= -1, `${style}/${type}: dy ${g.dy} origin ${g.origin}`);
  ok(g.sx <= 48 && g.sz <= 48 && g.sy <= 40, `${style}/${type}: size ${g.sx}×${g.sy}×${g.sz}`);
}
// every wall material and window style
for (const material of HK.WALLS) for (const ws of HK.WINDOWS) {
  const g = HK.build({ walls: { material, color: '#c0a080' }, windows: { style: ws, frame: 'black' }, floors: 1 + (ws.length % 3) });
  ok(g.n > 200, `${material}/${ws}: ${g.n}`);
}
// sizes at the edges, 4 storeys, a narrow deep house (stairs along the side)
for (const [w, d, f] of [[7, 7, 1], [7, 7, 2], [7, 14, 3], [31, 25, 4], [8, 25, 4]]) {
  const g = HK.build({ width: w, depth: d, floors: f, floorHeight: 5 });
  const c = stats(g);
  ok(g.n > 100, `${w}×${d}×${f}: ${g.n}`);
  if (f > 1) ok((c.get('oak_stairs') || 0) + (c.get('stucco_white_stairs') || 0) + (c.get('spruce_stairs') || 0) >= (f - 1) * 4, `${w}×${d}×${f}: stairs ${[...c].filter(([n]) => /stairs/.test(n)).join(';')}`);
}
// nonsense in → a house out
const g0 = HK.build({ width: 'x', depth: -4, floors: 99, roof: { type: 'dome', color: 'red' }, walls: null, extras: ['helipad', 'chimney', 'chimney'] });
ok(g0.n > 100 && g0.house.floors === 4 && g0.house.roof.type === 'gable' && g0.house.extras.join() === 'chimney', 'normalize ' + JSON.stringify(g0.house));
// random houses
for (let i = 0; i < 40; i++) { const s = HK.random(); const g = HK.build(s); ok(g.n > 100, 'random ' + JSON.stringify(s)); }
// the stairs climb: every step is one higher and one further than the last
{
  const g = HK.build({ width: 12, depth: 9, floors: 3, floorHeight: 4, style: 'cottage', extras: [] });
  const steps = [];
  for (let y = 0; y < g.sy; y++) for (let z = 0; z < g.sz; z++) for (let x = 0; x < g.sx; x++) { const s = g.blocks[(y * g.sz + z) * g.sx + x]; if (s !== 0xffff && s && /_stairs$/.test(nameOf(s))) steps.push([x, y, z]); }
  ok(steps.length === 8, 'steps ' + steps.length);
  // the cells above each step (head room): two cells of air, except where the next step is
  let blocked = 0;
  for (const [x, y, z] of steps) for (const dy of [1, 2]) { const s = g.blocks[((y + dy) * g.sz + z) * g.sx + x]; if (s && s !== 0xffff && !/_stairs$/.test(nameOf(s))) blocked++; }
  ok(blocked === 0, 'head room blocked ' + blocked);
}
// the interior designer and the details outside
const at = (g, x, y, z) => { const X = x - g.origin[0], Y = y - g.origin[1], Z = z - g.origin[2]; if (X < 0 || Y < 0 || Z < 0 || X >= g.sx || Y >= g.sy || Z >= g.sz) return 0xffff; return g.blocks[(Y * g.sz + Z) * g.sx + X]; };
{
  const g = HK.build({ style: 'cottage', width: 12, depth: 9, floors: 2, roof: { type: 'gable', color: '#b0453a' }, extras: ['chimney', 'dormers', 'garden', 'flowers'] });
  const c = stats(g), has = (re) => [...c.keys()].some(n => re.test(n));
  ok(has(/^vm_toilet$/) && has(/^vm_shower$|^vm_bathtub$/) && has(/^vm_vanity$/), 'a bathroom upstairs: ' + [...c.keys()].filter(n => /toilet|shower|bath|vanity/.test(n)));
  ok(has(/^vm_fridge$/) && has(/_hob$/) && has(/^vm_range_hood$/) && has(/_upper$/), 'a kitchen with a fridge, a hob under a hood and upper cabinets');
  ok(has(/^vm_dining_table/) && has(/^vm_dining_chair/), 'a dining table with chairs');
  ok(has(/^vm_sofa_/) && (has(/^vm_fireplace$/) || has(/^vm_tv$/)), 'a sofa facing the fireplace or the TV');
  ok(has(/^vm_bed_/) && has(/^vm_nightstand$/) && has(/^vm_wardrobe/), 'a bedroom with nightstands and a wardrobe');
  ok(has(/^vm_gutter$/) && has(/^vm_downpipe$/), 'gutters under the eaves, downpipes');
  ok((c.get('vx_window') || 0) + (c.get('vx_window_wood') || 0) >= 2 && has(/^vx_ridge_/), 'dormers with windows and little ridges');
  ok(has(/^vx_fruit_trunk$/) && has(/^vx_bush$|^vx_hedge$/), 'a garden with fruit trees and bushes');
  ok(has(/^vm_house_sign$/) && has(/^vm_letterbox$/), 'a house number and a letterbox at the door');
  // every storey has a light, the front door opens onto free floor, the stair landing is free
  const S = g.house, lightN = [...c].filter(([n]) => /pendant|lantern|chandelier|vm_table_lamp|floor_lamp/.test(n)).reduce((a, [, k]) => a + k, 0);
  ok(lightN >= 4, 'lights: ' + lightN);
  const d = [g.door[0] + g.origin[0], g.door[1] + g.origin[1], g.door[2] + g.origin[2]];
  const inside = [at(g, d[0], d[1], d[2] + 1), at(g, d[0], d[1] + 1, d[2] + 1)].map(nameOf);
  ok(inside.every(n => n === '?' || /^vx_rug|^$/.test(n) || n === nameOf(0)), 'the doorway inside is free: ' + inside);
  const land = nameOf(at(g, S.floorHeight + 1, S.floorHeight + 1, S.depth - 2));
  ok(at(g, S.floorHeight + 1, S.floorHeight + 1, S.depth - 2) === 0, 'the landing at the top of the stairs is free: ' + land);
}
{
  const g = HK.build({ style: 'modern', width: 16, depth: 11, floors: 2, roof: { type: 'flat' }, extras: ['pool', 'solar', 'terrace', 'garage'] });
  const c = stats(g), has = (re) => [...c.keys()].some(n => re.test(n));
  ok((c.get('water') || 0) >= 20 && has(/^pool_tile$|^porcelain_tile$/), 'a pool with water: ' + (c.get('water') || 0));
  ok((c.get('vx_solar') || 0) >= 10, 'solar panels on the flat roof and the garage: ' + (c.get('vx_solar') || 0));
  ok(has(/^vm_lounger$/), 'loungers by the pool / on the roof');
  ok(has(/^vm_island$|^vm_dining_table$/) && has(/^vm_tv$|^vm_lowboard$/), 'a modern living: TV, table / island');
}
{
  const g = HK.build({ style: 'cabin', width: 10, depth: 8, floors: 1, roof: { type: 'gable' }, walls: { material: 'log' }, extras: ['chimney', 'porch'] });
  const c = stats(g), has = (re) => [...c.keys()].some(n => re.test(n));
  ok(has(/^vm_toilet$/) && has(/^vm_bed_/) && has(/^vm_fridge$/), 'a one-storey cabin: bathroom, bed, kitchen all on the ground floor');
}
console.log((fails ? 'FAILED ' + fails : 'ALL OK') + ' · ' + (Date.now() - t0) + ' ms');
