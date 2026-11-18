// Ferne nach Bildpunkten (horizon.js Horizon.screenK): the far land's split follows the picture's pixel height and fov
//   a  a 1080-line picture at 70°: 1 (today's detail); bigger screens never more than 1
//   b  a 743-line window: about 0.69; a narrow fov (zoom) needs more detail than a wide one
//   c  never below SCREEN_MIN (0.5); nonsense input → 1
const V = require('./load_shared.js');
global.VR.FarRing = null;
require('../src/main/horizon.js');
const H = V.Horizon; let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const f70 = 70 * Math.PI / 180;
check(Math.abs(H.screenK(1080, f70) - 1) < 0.01 && H.screenK(2160, f70) === 1, 'a  1080 lines: ' + H.screenK(1080, f70).toFixed(3) + ', 2160: 1');
const k743 = H.screenK(743, f70); check(Math.abs(k743 - 0.69) < 0.02, 'b  743 lines: ' + k743.toFixed(3));
check(H.screenK(743, 40 * Math.PI / 180) > H.screenK(743, 90 * Math.PI / 180), 'b  zoomed in needs more detail than a wide view');
check(H.screenK(200, f70) === 0.5 && H.screenK(0) === 1 && H.screenK(NaN) === 1, 'c  floor 0.5, nonsense → 1');
console.log(fails ? 'FAILED ' + fails : 'ALL OK'); process.exit(fails ? 1 : 0);
