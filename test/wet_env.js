// F2 · the wet look's state (node): the puddles (env.js, E.puddle) fill in the rain within about half a minute and dry
// with a four-minute time constant after it stops; with the wetGround setting off (Very Low) no puddle and no wet
// reaches the shader. The rain itself is the weather's (weather.js): the test forces it.
const V = require('./load_shared.js');
require('../src/main/skybodies.js'); require('../src/main/weather.js'); require('../src/main/env.js');   // (env.update reads VR.SkyBodies since t-clouds)
let bad = 0;
const ok = (c, msg) => { if (!c) { bad++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const on = { dim: 'overworld', biome: null, eyeSky: 1, wetOn: true, lowK: 0, freezeWeather: false, freezeTime: true };
const env = new V.Env();
env.wx.force('regen');
for (let i = 0; i < 900; i++) env.update(0.1, on);            // 90 s of rain
ok(env.rain > 0.9 && env.puddle > 0.9 && env.puddle <= 1, `puddles fill in 90 s of rain (${env.puddle.toFixed(3)})`);
ok(Math.abs(env.E.puddle - env.puddle) < 1e-9 && env.E.wet > 0.9, `the shader gets the puddles and the wet (E.puddle ${env.E.puddle.toFixed(3)}, E.wet ${env.E.wet.toFixed(2)})`);
const filled = env.puddle;
env.wx.force('klar');
for (let i = 0; i < 1200; i++) env.update(0.1, on);           // 120 s dry: about 1/e² of the fill is left after 240 s, 1/e after 240 s
for (let i = 0; i < 1200; i++) env.update(0.1, on);
ok(env.rain < 0.05 && env.puddle > 0.25 * filled && env.puddle < 0.45 * filled, `puddles dry over minutes (${env.puddle.toFixed(3)} after 240 s dry, from ${filled.toFixed(3)})`);
for (let i = 0; i < 9000; i++) env.update(0.1, on);           // 15 min more: nearly dry
ok(env.puddle < 0.03, `dry after a quarter hour (${env.puddle.toFixed(4)})`);
const off = new V.Env();
off.wx.force('regen');
const offO = Object.assign({}, on, { wetOn: false });
for (let i = 0; i < 900; i++) off.update(0.1, offO);
ok(off.puddle > 0.9 && off.E.puddle === 0 && off.E.wet === 0, `with wetGround off (Very Low) the shader sees no puddle and no wet (state ${off.puddle.toFixed(2)})`);
console.log(bad ? 'FAILED ' + bad : 'ALL OK');
process.exit(bad ? 1 : 0);
