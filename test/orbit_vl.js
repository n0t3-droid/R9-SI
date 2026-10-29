// f-rules · Very Low in orbit costs what v0.50 cost (review docs/reviews/v0.51.md R52-02; plan
// docs/superpowers/plans/2026-10-29-f-rules.md §2). u-orbitlod's planet program grew its Low-and-up looks (the aurora,
// the limb's sunset layers, the windy sunglint, the land's detail, the cloud's fine noise) behind `u_air.z` — a uniform
// the driver cannot fold, so Very Low's program kept their code. Now Very Low draws Herzwelt with its own program
// herz_vl, where the tier is the constant 0.0 (AIRZ) and those branches compile away. Checks:
//   1. herz_vl exists, its tier is the constant 0.0 and it reads no u_air.z; herz and ptile keep the uniform
//   2. SH.progFor picks herz_vl for a tier-0 Herzwelt draw (u_air[2] = 0), herz from Low up, the others unchanged
//   3. both draw loops (spacescene.js, spaceflight.js) ask SH.progFor; the climb's cut wraps herz_vl as it wraps herz
//   bash test/wt_run.sh orbit_vl.js 300
const fs = require('fs'), path = require('path');
const V = require('./load_shared.js');
require('../src/main/space_shaders.js');
const SH = V.SpaceShaders, ROOT = path.join(__dirname, '..');
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };

console.log('1 · the programs');
const P = SH.programs();
check(P.herz_vl && /#define AIRZ 0\.0/.test(P.herz_vl.fs) && !/u_air\.z/.test(P.herz_vl.fs), 'herz_vl: the tier a constant 0.0, no u_air.z in it');
check(/#define AIRZ u_air\.z/.test(P.herz.fs) && /#define AIRZ u_air\.z/.test(P.ptile.fs), 'herz and ptile keep the tier as the uniform');
const nIf = (P.herz_vl.fs.match(/AIRZ > [01]\.5/g) || []).length;
check(nIf >= 8, nIf + ' Low-and-up branches fold to false on Very Low');
console.log('2 · the choice');
const d = (prog, tier) => ({ prog, u: { u_air: [0, 1, tier, 0.05] } });
check(SH.progFor && SH.progFor(d('herz', 0)) === 'herz_vl' && SH.progFor(d('herz', 1)) === 'herz' && SH.progFor(d('herz', 3)) === 'herz' && SH.progFor(d('moon', 0)) === 'moon' && SH.progFor({ prog: 'bg', u: {} }) === 'bg', 'herz_vl at tier 0, herz from Low up, other programs as they were');
console.log('3 · the draw loops');
const ss = fs.readFileSync(path.join(ROOT, 'src/main/spacescene.js'), 'utf8'), sf = fs.readFileSync(path.join(ROOT, 'src/main/spaceflight.js'), 'utf8');
check(/program\(SH_progFor\(d\)\)|program\(VR\.SpaceShaders\.progFor\(d\)\)/.test(ss) && /prog\(VR\.SpaceShaders\.progFor\(d\)\)/.test(sf), 'spacescene.js and spaceflight.js draw with SH.progFor(d)');
check(/name === 'herz' \|\| name === 'herz_vl'/.test(sf), 'the climb\'s cut (wrapFS) wraps herz_vl too');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
