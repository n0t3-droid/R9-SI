// plans a modern town in node: counts lots by kind, ops, and times the plan
require('./load_shared.js');
const VG = VR.VillageGen;
const seed = +(process.env.SEED || 424242), vgen = +(process.env.VGEN || 5);
const gen = new VR.OverworldGen(seed >>> 0, { vgen });
let sites = [];
for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) { const s = VG.site(gen, i, j); if (s && s.style === 'modern') sites.push([i, j, s]); }
console.log('modern sites', sites.length, sites.slice(0, 6).map(([i, j, s]) => `${i},${j}@${s.x},${s.z}`).join(' '));
const N = +(process.env.N || 3);
for (const [i, j, s] of sites.slice(0, N)) {
  const t0 = Date.now();
  const plan = VG.plan(gen, s);
  const dt = Date.now() - t0;
  const kinds = {}; for (const w of plan.work) kinds[w.kind] = (kinds[w.kind] || 0) + 1;
  let ops = 0; for (const [k, b] of plan.chunks) ops += (b.ops ? b.ops.length / 4 : 0);
  const fams = {}; for (const h of plan.homes) { const f = (h.skin || '?'); fams[f] = (fams[f] || 0) + 1; }
  console.log(`site ${i},${j} r=${s.rad} plan ${dt} ms homes ${plan.homes.length} lots ${plan.lots.length} work ${JSON.stringify(kinds)} skins ${JSON.stringify(fams)} chunks ${plan.chunks.size} ops ${ops}`);
}
