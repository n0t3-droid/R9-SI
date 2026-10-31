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
if (part('b')) {
  console.log('b · the spawn\'s step back: not given up while the cell behind is not loaded');
  require('../src/main/first2.js');
  const F = VR.First2, R = VR.R;
  const pave = (() => { for (let s = 1; s < R.T.type.length; s++) if (F.PAVE_RE.test((R.types[R.T.type[s]] || {}).name || '') && (R.T.flags[s] & VR.F.SOLID)) return s; return 0; })();
  let loaded = false;
  const world = { isLoaded: () => loaded, getBlock: (x, y, z) => (y === 70 ? pave : 0) };
  const p = { pos: [10.5, 71, 20.5], spawn: [10.5, 71, 20.5], teleport(x, y, z) { this.pos = [x, y, z]; } };
  const g = { meta: { vistaId: 'v1' }, arrival: { v: { u: [0, 1] } }, player: p, world };
  check(pave > 0 && F.vistaBack(g) === null && !g.meta.f4back && F.backWhy === 'unloaded', 'the loading screen\'s call before the cell is there: asked again later (' + F.backWhy + ')');
  loaded = true;
  const r = F.vistaBack(g);
  check(r && g.meta.f4back === 1 && Math.abs(p.pos[2] - 19.5) < 1e-9 && F.backWhy === 'back', 'the next call steps back on the way (' + JSON.stringify(r) + ', ' + F.backWhy + ')');
  const sid = (re) => { for (let s = 1; s < R.T.type.length; s++) { const n = (R.types[R.T.type[s]] || {}).name || ''; if (re.test(n) && (R.T.flags[s] & VR.F.SOLID)) return s; } return 0; };
  const bricks = sid(/^bricks$/), grass = sid(/^grass_block$/);
  const try2 = (under) => { const w2 = { isLoaded: () => true, getBlock: (x, y, z) => (y === 70 ? under : 0) }, p2 = { pos: [10.5, 71, 20.5], spawn: [10.5, 71, 20.5], teleport(x, y, z) { this.pos = [x, y, z]; } }; return F.vistaBack({ meta: { vistaId: 'v1' }, arrival: { v: { u: [0, 1] } }, player: p2, world: w2 }); };
  check(bricks && try2(bricks) && F.backWhy === 'back', 'a walk of bricks (the feet\'s own paving behind): one block back');
  check(grass && try2(grass) === null && /^stays:grass/.test(F.backWhy), 'grass under the feet and behind: stays (' + F.backWhy + ')');
}
if (part('c')) {
  console.log('c · the citadel\'s beam only on the Heartland (the station café\'s white orbs)');
  require('../src/main/vents.js');
  const C = VR.Heart.CITADEL, n = { s: 0 };
  const g = { dim: 'stn.ring', meta: { vgen: 12, type: 'default' }, settings: { preset: 'high', motion: false }, particles: { spawn() { n.s++; }, glow() { n.s++; } } };
  const V = new VR.Vents(g), eye = [C.x + 10, 65, C.z + 10];
  for (let i = 0; i < 30; i++) V.update(0.033, eye);
  const inStation = n.s; n.s = 0; g.dim = 'overworld';
  for (let i = 0; i < 30; i++) V.update(0.033, eye);
  check(inStation === 0 && n.s > 10, 'the beam\'s sparks: in the Ringstation ' + inStation + ', on the Heartland ' + n.s);
  n.s = 0; g.meta.type = 'flat'; for (let i = 0; i < 30; i++) V.update(0.033, eye);
  check(n.s === 0, 'a flat world has no citadel: ' + n.s);
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
