// f-quiet3 · the golden shots' order dependence, pinned (docs/superpowers/plans/2026-11-02-f-quiet3.md)
// The cause of v042's golden FAILED 2 after f-quiet2: not the game — the wow moment fires in neither build during the
// run and the camera's yaw at the hud shot is the same (6.28) in v0.55.25 and v042 (probe: test/golden_q3probe.mjs).
//   1. hud: golden.mjs steps the game with drawing off and took the page's picture without drawing at the spawn — the
//      canvas held the shot before (a full run: the citadel's towers, which the reference shows; ONLY=vista,hud: the
//      gate hall) → hud now draws the world at the spawn (grabGL) before page.screenshot
//   2. vista: ready() gave up after its settle rounds even when the world had not settled (sections meshing, far tiles in
//      flight — under load: a black hole in the foreground) → it keeps settling (G.READY_MS) and a shot says UNSETTLED
// usage: node test/golden_order.js  (GOLDEN=<path> checks another copy of golden.mjs)
'use strict';
const fs = require('fs'), path = require('path');
const G = require(path.join(__dirname, 'golden_wait.js'));
let fails = 0;
const ok = (c, m) => { if (c) console.log('  ✓ ' + m); else { fails++; console.log('  ✗ ' + m); } };
const clean = { state: 'play', busy: 0, pend: 0, dirty: 0, up: 0, lod: 0 };
ok(G.settledOk(clean, 3), 'a clean world counts as settled (round 3)');
ok(!G.settledOk(clean, 2), 'never in the first three rounds');
ok(!G.settledOk(Object.assign({}, clean, { dirty: 2, lod: 6 }), 40), 'the ONLY=vista run\'s state (2 sections, 6 far tiles in flight) is not settled');
for (const k of ['busy', 'pend', 'dirty', 'up', 'lod']) ok(!G.settledOk(Object.assign({}, clean, { [k]: 1 }), 9), k + ' > 0 is not settled');
ok(!G.settledOk({ state: 'title' }, 9) && !G.settledOk(null, 9), 'not in play / no state: not settled');
ok(G.READY_MS >= 20000 && G.READY_MS <= 120000, 'ready keeps settling 20–120 s (' + G.READY_MS + ' ms)');
const src = fs.readFileSync(process.env.GOLDEN || path.join(__dirname, 'golden.mjs'), 'utf8');
const hud = (src.match(/await timed\('hud'[\s\S]*?\n\}\);/) || [''])[0];
const iDraw = hud.indexOf('await grabGL()'), iShot = hud.indexOf('page.screenshot(');
ok(hud && iShot > 0, 'golden.mjs has the hud shot');
ok(iDraw > 0 && iDraw < iShot, 'hud draws the world at the spawn before the page\'s picture (not the canvas of the shot before)');
const iCalm = hud.indexOf('await calm()');
ok(iCalm > 0 && iCalm < iDraw && /Hints/.test(hud), 'hud pins the calm HUD (the pointers faded after the HUD is shown, no 🧭 hint card) before it draws');
const ready = (src.match(/const ready = [^\n]*/) || [''])[0];
ok(/G\.settledOk/.test(src) && /READY_MS/.test(ready) && /while \(!\(s && s\.ok\)/.test(ready), 'ready() settles until settled (not a fixed number of rounds)');
ok(/UNSETTLED/.test(src), 'a picture of an unsettled world says so in its note');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
