// v0.39 ✏️ Bearbeiten → Varianten (VR.Variants, src/studio/variants.js): the same block family in other colours and
// materials — found from the names (same shape: kind and properties), so the roof stays a roof that can be turned,
// a Vollton block stays a full block (no slabs, stairs or gloss twins mixed in).
require('./load_shared.js');
require('../src/studio/variants.js');
const V = VR.Variants, R = VR.R;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
check(!!V && typeof V.family === 'function', 'VR.Variants.family exists');
if (!V || !V.family) { console.log('FAILED ' + fails); process.exit(1); }
const roof = V.family('vx_roof_slate');
console.log('  roof', roof.join(' '));
check(roof.length === 12 && roof.every(n => /^vx_roof_/.test(n)) && roof.includes('vx_roof_red') && roof.includes('vx_roof_slate'), 'vx_roof_slate → the 12 roof colours (itself included)');
const vt = V.family('vollton_white');
check(vt.length === 40 && vt.every(n => /^vollton_/.test(n) && !/_gloss$|_slab$|_stairs$/.test(n)) && vt.includes('vollton_light_grey') && vt.includes('vollton_signal_red'), 'vollton_white → the 40 Vollton colours, no gloss / slab / stairs twins (' + vt.length + ')');
const vg = V.family('vollton_white_gloss');
check(vg.length === 40 && vg.every(n => /_gloss$/.test(n)), 'vollton_white_gloss → the 40 glossy ones (' + vg.length + ')');
const co = V.family('white_concrete');
check(co.length >= 12 && co.every(n => /_concrete$/.test(n)) && co.includes('black_concrete'), 'white_concrete → the concrete colours (' + co.length + ')');
const st = V.family('oak_stairs');
const kind = (n) => R.byName[n].o.kind;
check(st.length >= 6 && st.every(n => /_stairs$/.test(n) && kind(n) === kind('oak_stairs')), 'oak_stairs → other stairs, all stairs (' + st.length + ')');
check(Array.isArray(V.family('air')) && Array.isArray(V.family('no_such_block')), 'nothing to offer: an empty list, no error');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
