// v0.55.61 · Nur Himmel beim Start (a player's report): on a GPU with 16 texture units, Ultra's terrain programs
// with the Schattenuhr's two volumes need 18 → the link fails, the terrain is never drawn, only the sky. Now:
//   a  a link failure for too many texture units turns the Schattenuhr off for this session (CV.short): CV.on false,
//      no SUNCLOCK define any more; any other failure leaves it as it was
//   b  the next updateClockVol rebuilds the programs once (the terrain is back the frame after)
//   f  the clock, the sky and the lamps share ONE 3-D texture (192 layers): one texture unit, not two
//   c  GL: a deferred program's failed link calls GL.onLinkFail(name, message) before it throws
//   d  a body's sky (BODYSKY: its u_bsAir uses unit 5, the clock volume's) never gets SUNCLOCK
//   e  the frame's errors: each different message once in the chat, with where it came from
const V = require('./load_shared.js');
require('../src/shared/sunclock.js');
global.VR.Renderer = function () {}; const RP = V.Renderer.prototype;
let built = 0; RP.buildPrograms = function () { built++; };
RP.updateHorizonish = null;
global.VR.GL = { defineHook: null };
require('../src/main/clockvol.js');
const CV = V.ClockVol, GL = V.GL;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
check(typeof CV.linkFail === 'function', 'a  CV.linkFail exists');
if (CV.linkFail) {
  const UN = 'Link failed terrainCut: FRAGMENT shader texture image units count exceeds MAX_TEXTURE_IMAGE_UNITS(16)';
  CV.linkFail('fxaa', UN);
  check(!CV.short, 'a  too many units in another program leaves the Schattenuhr');
  CV.linkFail('fxaa', 'Shader compile failed: syntax error');
  check(!CV.short && CV.on({}), 'a  another failure leaves it');
  CV.linkFail('terrainCut', UN); CV.linkFail('terrain', UN);   // (both programs of one build: one step)
  check(CV.short === 1 && CV.on({}), 'a  step 1: the Schattenuhr stays (' + CV.short + ')');
  const d1 = GL.defineHook('terrain', ['SHADOWS', 'HSHADOW']);
  check(d1.includes('SUNCLOCK') && !d1.includes('HSHADOW'), 'a  step 1: the height-map shadows give way (the clock covers its window) — ' + d1.join(','));
  check(GL.defineHook('water', ['HSHADOW']).includes('HSHADOW'), 'a  other programs keep theirs');
  const r = Object.create(RP); r.cvKey = 1; r.P = {};
  CV.rebuildIfShort(r); CV.rebuildIfShort(r);
  check(built === 1, 'b  the programs rebuilt once (' + built + ')');
  CV.linkFail('terrain', UN);
  check(CV.short === 2 && !CV.on({}), 'a  step 2 (still too many): the Schattenuhr off for this session');
  check(!GL.defineHook('terrain', ['SHADOWS', 'HSHADOW']).includes('SUNCLOCK'), 'a  no SUNCLOCK define any more');
  CV.rebuildIfShort(r);
  check(built === 2 && r.cvKey === 0, 'b  rebuilt again (' + built + ')');
  CV.short = 0; CV.pending = false;
}
check(!GL.defineHook('terrain', ['BODYSKY']).includes('SUNCLOCK'), 'd  BODYSKY: no SUNCLOCK');
check(GL.defineHook('terrain', ['SHADOWS']).includes('SUNCLOCK'), 'd  the overworld keeps it');
// c  gl.js deferProgram with a stub context that fails to link
{
  global.VR.GL = undefined; delete V.GL;
  require('../src/main/gl.js');
  const G = V.GL; let seen = null; G.onLinkFail = (n, m) => { seen = [n, m]; };
  G.gl = { createProgram: () => ({}), createShader: () => ({}), shaderSource() {}, compileShader() {}, attachShader() {}, linkProgram() {}, getProgramParameter: () => false, getShaderParameter: () => true, getProgramInfoLog: () => 'texture image units count exceeds MAX_TEXTURE_IMAGE_UNITS(16)', LINK_STATUS: 1, COMPILE_STATUS: 2, VERTEX_SHADER: 3, FRAGMENT_SHADER: 4 };
  const p = G.deferProgram('vs', 'fs', 'opaque');
  let threw = false; try { void p.p; } catch (e) { threw = true; }
  check(threw && seen && seen[0] === 'opaque' && /TEXTURE_IMAGE_UNITS/.test(seen[1]), 'c  GL.onLinkFail(name, message) before the throw');
}
// f  one volume
{
  const sh = require('fs').readFileSync(__dirname + '/../src/main/shaders.js', 'utf8');
  check(!/u_skyVol/.test(sh), 'f  no u_skyVol in the shaders (the clock volume holds all three)');
}
// e  game.frameError
{
  const src = require('fs').readFileSync(__dirname + '/../src/main/game.js', 'utf8');
  check(/frameError\(e\)\s*\{/.test(src) && /errSeen/.test(src), 'e  game.frameError: each message once');
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
