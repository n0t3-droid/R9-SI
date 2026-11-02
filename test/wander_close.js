// r-v058: closing the Wanderbuch must leave no screen open (M / J / the story card need !ui.screen)
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'main', 'wander.js'), 'utf8');
let fail = 0; const check = (ok, msg) => { console.log((ok ? '  ✓ ' : '  ✗ ') + msg); if (!ok) fail++; };
const m = src.match(/W\.close = function \(g\) \{([^\n]*)\};/);
check(!!m, 'W.close found');
check(m && !/show\('hud'\)/.test(m[1]), "W.close does not leave ui.screen = 'hud'");
// behaviour: a stand-in ui
global.self = global; global.VR = global.VR || {};
const ui = { screen: 'wanderbuch', show(s) { this.screen = s; }, resume() { this.show(null); } };
const close = new Function('g', m[1]);
close({ ui });
check(ui.screen === null, 'after closing, no screen is open (' + ui.screen + ')');
console.log(fail ? 'FAILED ' + fail : 'ALL OK');
