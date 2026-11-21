// Nicht vor deinen Augen (the owner, 21 Nov: birds as black dots, foxes, boats and picnic people "spawn randomly" in the
// view). Things of the living world come into being out of sight, or — when they must stand where you look — fade in
// softly over AP.T seconds (an ordered dither, resolved by the TSR) and fade out the same way.
//   a  VR.Appear.k(o): 0 at an object's first draw, 1 after AP.T s; out(o) fades it back to 0 over AP.T
//   b  the shared vox draw passes VR.Appear.cur to the shader (u_appear) — and the vox program has it only from Low up
//      (APPEAR), so Very Low's programs stay what they were
//   c  a bird flock starts where the eye does not look (AirLife.flockStart): its first bird outside the view cone
//   d  a village's boat is moored before it sails (Folklife: the boat waits at the launch; a trip takes it and brings it
//      back; a moored boat no longer vanishes after four minutes)
//   e  the picnic blanket is laid when someone reaches the spot (Folk4.blanketK), not before
const V = require('./load_shared.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
global.performance = global.performance || { now: () => Date.now() };
for (const f of ['eventlog', 'lifekit']) { try { require('../src/main/' + f + '.js'); } catch (e) { console.log('     (load ' + f + ': ' + e.message + ')'); } }
const AP = V.Appear;
check(!!AP && typeof AP.k === 'function', 'a  VR.Appear exists');
if (AP) {
  let t = 100; AP.now = () => t;
  const o = {};
  const k0 = AP.k(o); t += AP.T / 2; const k1 = AP.k(o); t += AP.T; const k2 = AP.k(o);
  check(k0 === 0 && Math.abs(k1 - 0.5) < 1e-9 && k2 === 1, 'a  fades in: ' + [k0, k1, k2].join(' → '));
  AP.out(o); const k3 = AP.k(o); t += AP.T / 2; const k4 = AP.k(o); t += AP.T; const k5 = AP.k(o);
  check(k3 === 1 && Math.abs(k4 - 0.5) < 1e-9 && k5 === 0 && AP.gone(o), 'a  fades out: ' + [k3, k4, k5].join(' → '));
  check(AP.k(null) === 1 && AP.cur === 1, 'a  nothing given: whole');
}
// b
const fs = require('fs');
const sh = fs.readFileSync(__dirname + '/../src/main/shaders.js', 'utf8'), rd = fs.readFileSync(__dirname + '/../src/main/renderer.js', 'utf8'), en = fs.readFileSync(__dirname + '/../src/main/entities.js', 'utf8');
const vox = sh.slice(sh.indexOf('S.VOX_FS = `'), sh.indexOf('`', sh.indexOf('S.VOX_FS = `') + 14));
check(/#ifdef APPEAR[\s\S]*u_appear[\s\S]*#endif/.test(vox) && !/u_appear/.test(vox.replace(/#ifdef APPEAR[\s\S]*?#endif/g, '')), 'b  the vox shader reads u_appear only under APPEAR');
check(/P\.vox = GL\.program\(S\.VOX_VS, S\.VOX_FS, 'vox', [^)]*APPEAR/.test(rd) && /lite/.test(rd.match(/P\.vox = GL\.program\([^\n]*/)[0]), 'b  the vox program gets APPEAR, never on Very Low');
check(/u_appear/.test(en), 'b  the shared draw sets u_appear');
// c
for (const f of ['particles', 'airlife']) { try { require('../src/main/' + f + '.js'); } catch (e) { console.log('     (load ' + f + ': ' + e.message + ')'); } }
const AL = V.AirLife;
check(!!AL && typeof AL.flockStart === 'function', 'c  AirLife.flockStart exists');
if (AL && AL.flockStart) {
  let bad = 0, n = 0;
  for (let yaw = 0; yaw < 6.28; yaw += 0.4) for (let s = 0; s < 6; s++) {
    const fwd = [-Math.sin(yaw), 0, -Math.cos(yaw)], eye = [10, 70, -4];
    let r = s * 0.137 + 0.01; const rnd = () => (r = (r * 9301 + 0.4927) % 1);
    const st = AL.flockStart(eye, fwd, 1.2, rnd);
    n++;
    if (!st) continue;
    const dx = st.x - eye[0], dz = st.z - eye[2], d = Math.hypot(dx, dz);
    const ang = Math.acos((dx * fwd[0] + dz * fwd[2]) / d);
    if (ang < 1.2 + 0.15) bad++;
    // it crosses the view later (the flight passes the eye)
    const pass = (eye[0] - st.x) * st.dx + (eye[2] - st.z) * st.dz;
    if (pass < 20) bad++;
  }
  check(bad === 0, 'c  every flock starts outside the view cone and flies past the eye (' + n + ' cases, ' + bad + ' bad)');
}
// d, e
const fl = fs.readFileSync(__dirname + '/../src/main/folklife.js', 'utf8'), f4 = fs.readFileSync(__dirname + '/../src/main/folk4.js', 'utf8');
check(/P\.mooredBoat/.test(fl) && !/this\.time - \(b\.moored \|\| 0\) < 240/.test(fl), 'd  a moored boat waits at the launch and is not dropped after 240 s');
check(/blanketK/.test(f4), 'e  the blanket waits for its people');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
