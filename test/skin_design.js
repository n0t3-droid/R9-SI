// v0.39: a design that only chooses another facade (skin) or the mirrored plan is a design too — the Studio keeps it,
// and the game's villa builder builds that catalogue house in that variant (before, the choice never reached the game).
require('./load_shared.js');
const VG = VR.VillageGen, PLAN = VG.plan2, C = VR.Custom;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const cat = PLAN.CATALOGUE[1], skins = cat.skins.filter((v, i, a) => a.indexOf(v) === i);
const skin0 = skins[new VR.RNG(7).int(cat.skins.length)] || cat.skins[new VR.RNG(7).int(cat.skins.length)];
const other = skins.find(s => s !== skin0);
C.apply({ v: 1, houses: { 1: { v: 2, name: cat.name, index: 1, seed: 7, beds: 3, skin: other, mirror: true, n: 0, t: 1 } }, models: {} });
check(!!C.houseFor(1) && C.skinOnly && C.skinOnly(C.houseFor(1)), 'a facade-only design counts as a design (houseFor, skinOnly)');
const build = (o) => { const ops = []; const L = VG.makeLot((x, y, z, s) => ops.push(x, y, z, s), 5, 5, 0); const info = PLAN.build(L, { w: cat.lot[0], d: cat.lot[1], F: 8, r: 0, ox: 5, oz: 5, kind: 'home' }, Object.assign({ rng: new VR.RNG(99), ground: () => 7, beds: 3, index: 1 }, o)); return { info, n: ops.length / 4 }; };
let r = null, err = null;
try { r = build({}); } catch (e) { err = e; }
check(!err && r && r.info, 'the villa builder builds the house with it (no error' + (err ? ': ' + err.message : '') + ')');
check(r && r.info.skin === other && r.info.custom, 'in the chosen facade (' + other + ', the catalogue would pick ' + skin0 + ')');
const plain = build({ noCustom: true });
check(r && r.n > 1000 && Math.abs(r.n - plain.n) < plain.n, 'a whole house, block for block (' + (r && r.n) + ' blocks)');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
