// ============================================================================
// R9-SI Lab · Herkunft: welche Zeile des Generators hat diesen Block gesetzt?
// Provenance: which line of the generator put this block there. The place whose plan covers the column is planned again
// with the generator's tracer on (VillageGen.trace, gen_village.js), and every op and fill that touches the column is
// listed in the order the chunk applies them (fills first, then ops) with the source lines that made it.
//   why({ seed, vgen, x, y, z }) → { site, block, events: [{ kind, y | y0..y1, block, at: ['gen_village.js:842', …] }] }
//   node lab/lab.js why --seed 3616214791 --vgen 22 --at 953,75,-314
// ============================================================================
'use strict';
const W = require('../lib/world.js');
module.exports = function why(o) {
  const g = W.gen(o.seed, o.vgen), VG = W.VR.VillageGen;
  const site = W.sitesNear(g, o.x, o.z, 400).find((s) => Math.hypot(s.x - o.x, s.z - o.z) <= (s.rad || 100) + 8);
  if (!site) return { site: null, block: W.name(W.block(g, o.x, o.y, o.z)), events: [] };
  const events = [];
  const frames = () => (new Error().stack || '').split('\n').slice(3)
    .map((l) => (/\/src\/shared\/([\w.]+):(\d+)/.exec(l) || [])).filter((m) => m[1]).map((m) => m[1] + ':' + m[2]).slice(0, 5);
  VG.trace = (kind, x, y, z, s, y1) => {
    if (x !== o.x || z !== o.z) return;
    if (kind === 'put' && o.y !== undefined && Math.abs(y - o.y) > (o.dy || 3)) return;
    if (kind === 'fill' && o.y !== undefined && (o.y < y - (o.dy || 3) || o.y > y1 + (o.dy || 3))) return;
    events.push(kind === 'put' ? { kind, y, block: W.name(s), at: frames() } : { kind, y0: y, y1, block: W.name(s), at: frames() });
  };
  try {
    if (g._vilPlans) g._vilPlans.delete(site.id);
    if (g._vilBuild) g._vilBuild.delete(site.id);
    VG.plan(g, site);
  } finally { VG.trace = null; }
  // the chunk applies every fill before any op (VG.apply)
  const ordered = events.filter((e) => e.kind === 'fill').concat(events.filter((e) => e.kind === 'put'));
  const col = [];
  for (let y = (o.y || 64) - 4; y <= (o.y || 64) + 4; y++) { const s = W.block(g, o.x, y, o.z); if (s) col.push(y + ':' + W.name(s)); }
  return { site: { name: site.name, style: site.style, x: site.x, z: site.z }, block: o.y !== undefined ? W.name(W.block(g, o.x, o.y, o.z)) : null, column: col, events: ordered };
};
