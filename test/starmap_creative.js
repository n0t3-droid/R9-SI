// w-golden · the star map in a creative world: there the drive's range is "everywhere" (worldlife.js: 1e6 ly), and
// (1) Galaxy.systemsNear(N, p, 1e6) walked (2·50 000 + 1)³ grid cells of 20 ly — O hung the game for good (found by
// test/golden.mjs's star map shot; the stack: draw → Exo.interesting → systemsNear); now the walk is clipped to the
// cells the disc has. (2) The map's range sphere (src/main/starmap.js, VR.StarMapSphere): the map drew a circle of that radius in pixels — millions of
// pixels round — with a fill: the software canvas spun for minutes and the game hung on O (found by test/golden.mjs's
// star map shot and the monkey's O key). The sphere is drawn only when it fits a few screens; bigger, the whole map is in
// reach and gets the faint tint alone.   node test/starmap_sphere.js
require('./load_shared.js');
require('../src/main/starmap.js');
let fails = 0; const check = (ok, m) => { if (!ok) { fails++; console.log('  ✗ ' + m); } else console.log('  ✓ ' + m); };
const S = VR.StarMapSphere;
const G = VR.Galaxy, N = G.build(4242);
{ const t = Date.now(), all = G.systemsNear(N, N.list[0].p, 1e6), ms = Date.now() - t, ref = G.systemsNear(N, N.list[0].p, 1000);
  check(ms < 200 && all.length === N.list.length, `systemsNear within 1e6 ly: every system (${all.length} of ${N.list.length}) in ${ms} ms`);
  check(ref.length === all.length && ref.every((q, i) => q.idx === all[i].idx), 'the same list, nearest first, as within 1000 ly');
  const n30 = G.systemsNear(N, N.list[0].p, 30), brute = N.list.filter(s => Math.hypot(s.p[0] - N.list[0].p[0], s.p[1] - N.list[0].p[1], s.p[2] - N.list[0].p[2]) <= 30).length;
  check(n30.length === brute && n30.length > 3, `within 30 ly as before: ${n30.length} (brute force ${brute})`);
  const far = G.systemsNear(N, [5000, 0, 5000], 50); check(Array.isArray(far) && far.length === 0, 'far outside the disc: none, at once'); }
check(typeof S === 'function', 'VR.StarMapSphere is there (the map draws its sphere by it)');
if (typeof S === 'function') {
  check(S(120, 1280, 720) === 'ring', 'the 30-ly sphere on screen (120 px): the ring and its fill');
  check(S(1e6 * 900 / 40, 640, 360) === 'all', 'creative (1e6 ly, 22 million px): no circle, the whole map tinted');
  check(S(4 * 1280 + 1, 1280, 720) === 'all' && S(4 * 1280 - 1, 1280, 720) === 'ring', 'the line: four screens');
  check(S(-5, 640, 360) === 'none' && S(NaN, 640, 360) === 'none' && S(Infinity, 640, 360) === 'all', 'behind the eye / no number: nothing; infinite: the tint');
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
