// f-polish4 (docs/superpowers/plans/2026-10-31-f-polish4.md) — the node half:
//   a · the lamplighter's lantern: a look with tool 'lantern' builds a glowing hanging lantern in the right hand (hi-res
//       and smooth-path grids), carried (the gait hangs it); the natives' swap at night and back by day
//   bash test/wt_run.sh polish4.js 300
require('./dom_stub.js');
require('./load_shared.js');
require('../src/main/i18n.js'); require('../src/main/lang_en.js'); require('../src/main/lang_de.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const part = (name) => process.argv.length < 3 || process.argv.includes(name);

if (part('a')) {
  console.log('a · the lamplighter\'s lantern');
  require('../src/shared/smoothvox.js'); require('../src/shared/folksmooth.js');
  require('../src/main/voxmodels.js'); require('../src/main/villagers.js'); require('../src/main/folkmodel.js');
  require('../src/main/villages.js'); require('../src/main/festival.js'); require('../src/main/worldlife.js');
  require('../src/main/natives.js');
  const Folk = VR.Folk, N = VR.Natives;
  const L0 = Folk.look(4711, 'farmer', 'adult');
  if (Folk.speciesLook) Folk.speciesLook(L0, (k) => (k * 2654435761) >>> 0, 'adult', 'aqua');
  const L1 = N.lanternLook(L0);
  check(L1.tool === 'lantern' && L0.tool !== 'lantern' && Folk.lookKey(L1) !== Folk.lookKey(L0), 'the lantern look is a copy with its own key (day: ' + L0.tool + ')');
  // (the hi-res voxel self draws the hand's thing into the forearm; the smooth path's rig has its own item_r)
  const glow = (m, k) => { const it = m.parts && m.parts[k]; const g = it && (it.grid || it); if (!g || !g.get) return -1; let n = 0; for (let y = 0; y < g.sy; y++) for (let z = 0; z < g.sz; z++) for (let x = 0; x < g.sx; x++) { const v = g.get(x, y, z); if (v && (v & 0xffffff) === Folk.LANTERN_GLOW && ((v >> 24) & 1)) n++; } return n; };
  const hi = Folk.buildHiRes(L1), hd = Folk.buildHiRes(L0), fn = Folk.buildFine(L1);
  const nh = glow(hi, 'fore_r'), nf = Math.max(glow(fn, 'item_r'), glow(fn, 'fore_r'));
  check(nh >= 8 && glow(hd, 'fore_r') <= 0, 'hi-res: the right hand holds the lantern\'s glowing glass (' + nh + ' flame voxels; by day ' + glow(hd, 'fore_r') + ')');
  check(nf >= 8, 'the smooth path\'s rig: the lantern in the hand (' + nf + ' flame voxels; parts ' + Object.keys(fn.parts).filter(k => /item/.test(k)).join(',') + ')');
  const G = Folk.gaitFor(L1);
  check(G && G.carry === 'lantern', 'the gait carries it hanging from the fist (' + (G && G.carry) + ')');
  // the swap: the round's look at night, the day's look back; the cached models dropped
  const a = { p: { id: 'x', look: L0 }, mdl: [1, 1], fg: {}, gait: {} };
  check(N.carryLantern(a, true) && a.p.look.tool === 'lantern' && a.mdl === null && a.gait === undefined, 'at night the lamplighter takes up the lantern (models re-keyed)');
  check(!N.carryLantern(a, true), 'held: no second swap');
  check(N.carryLantern(a, false) && a.p.look === L0 && a.p.look.tool === L0.tool, 'by day the own thing back (' + a.p.look.tool + ')');
  check(!N.carryLantern({ p: { look: L0 }, kid: true }, true), 'a child carries none');
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
