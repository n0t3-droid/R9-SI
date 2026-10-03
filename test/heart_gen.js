// generator smoke test for the Heartland: climate/biome at key points, temple ops, chunk timings
const V = require('./load_shared.js');
const g = new V.OverworldGen(4242, { vgen: 3 });
const pts = { origin: [0, 0], plazaEnd: [0, 140], city: [0, -140], hills: [0, -320], canyon: [0, 300], canyon2: [120, 400], citadel: [-420, 380], station: [-380, -150], isles: [330, 140], far: [900, 0] };
for (const k in pts) { const [x, z] = pts[k]; const cl = g.climateAt(x, z); const h = g.surfaceY(x, z); console.log(k.padEnd(9), 'H', h, 'biome', V.BIOMES[g.biomeFor(cl, h)].key, 'heart', cl.heart.toFixed(2), 'ember', (cl.ember || 0).toFixed(2), 'canyon', (cl.canyon || 0).toFixed(2), 'river', cl.river.toFixed(2)); }
const site = V.VillageGen.site(g, 0, -1); console.log('home site', site && { x: site.x, z: site.z, rad: site.rad, style: site.style, name: site.name });
let t0 = Date.now(); const tp = V.TempleGen.build(g); console.log('temple built in', Date.now() - t0, 'ms; chunks', tp.chunks.size, 'spawn', tp.base.spawn);
t0 = Date.now(); const plan = V.VillageGen.plan(g, site); console.log('city plan in', Date.now() - t0, 'ms; homes', plan.homes.length, 'work', plan.work.length, 'roads', plan.roads.length, 'base', !!plan.base);
console.log('spawn', g.findSpawn());
for (const [cx, cz] of [[0, 0], [0, -1], [-1, 1], [2, 5], [0, -9], [20, 8], [-26, 24]]) { t0 = Date.now(); const out = g.generate(cx, cz); let n = 0; for (let i = 0; i < out.blocks.length; i++) if (out.blocks[i]) n++; console.log('chunk', cx, cz, 'in', Date.now() - t0, 'ms blocks', n, 'spawns', (out.spawns || []).map(s => s[0]).join(',')); }
