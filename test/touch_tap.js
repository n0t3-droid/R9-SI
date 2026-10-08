// A touch button tapped between two frames (pointerdown and pointerup before the next update) still counts as held
// for that frame: the ⤒ button's tap must make the player jump (test/controls.mjs §touch). The release is kept until
// the frame ends (input.tRelease), so down('Space') sees the jump once.
//   bash test/wt_run.sh touch_tap.js
require('./load_shared.js');
require('./dom_stub.js');
require('../src/main/binds.js');
require('../src/main/pad.js');
require('../src/main/input.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const canvas = { addEventListener() {}, requestPointerLock: null };
navigator.getGamepads = () => [];
VR.Binds.current = new VR.Binds.Bindings();
const inp = new VR.Input(canvas);
// the touch layer's press and release, as touch.js does them
const press = (id) => { inp.tDown.add(id); inp.tPressed.add(id); };
const release = (id) => { if (inp.tRelease) inp.tRelease.add(id); else inp.tDown.delete(id); };
inp.beginFrame(1 / 60);
press('jump'); release('jump');                         // a tap, both within one frame
check(inp.down('Space') === true, 'a tap within one frame: Space is down for that frame');
check(inp.hit('Space') === true, 'and hit once');
inp.endFrame();
inp.beginFrame(1 / 60);
check(inp.down('Space') === false, 'the next frame: released');
check(inp.hit('Space') === false, 'and not hit again');
inp.endFrame();
// a hold over several frames stays down until the release's frame ends
inp.beginFrame(1 / 60); press('jump'); check(inp.down('Space'), 'held: frame 1 down'); inp.endFrame();
inp.beginFrame(1 / 60); check(inp.down('Space'), 'held: frame 2 down'); release('jump'); check(inp.down('Space'), 'released mid-frame: still down this frame'); inp.endFrame();
inp.beginFrame(1 / 60); check(!inp.down('Space'), 'the frame after the release: up'); inp.endFrame();
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);
