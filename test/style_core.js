// World style core (v0.34): rules on generated columns, player edits kept on reconcile, prop carry,
// multiplayer filter, history, water colour.
require('./load_shared.js');
const R = VR.R, T = R.T, WS = VR.WorldStyle;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const nameOf = (s) => s ? R.types[T.type[s]].name : 'air';
const st = (n) => R.byName[n].defaultState;

// a column with houses and trees: look around a village of the default overworld
const g = VR.makeGen('overworld', 12345, {});
let col = null, at = null;
const want = (b) => { let pl = 0, lv = 0; for (let i = 0; i < b.length; i++) { const n = b[i] && R.types[T.type[b[i]]].name; if (!n) continue; if (/_planks$/.test(n)) pl++; if (/_leaves$/.test(n)) lv++; } return pl > 20 && lv > 5; };
outer: for (let r = 0; r < 40; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
  if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
  const c = g.generate(dx, dz); if (want(c.blocks)) { col = c; at = [dx, dz]; break outer; }
}
check(!!col, 'found a column with planks and leaves at ' + at);
const raw = col.blocks;
const count = (b, re) => { let n = 0; for (let i = 0; i < b.length; i++) if (b[i] && re.test(nameOf(b[i]))) n++; return n; };
const plankName = (() => { const m = {}; for (let i = 0; i < raw.length; i++) { const n = nameOf(raw[i]); if (/_planks$/.test(n)) m[n] = (m[n] || 0) + 1; } return Object.entries(m).sort((a, b) => b[1] - a[1])[0][0]; })();
const leafName = (() => { const m = {}; for (let i = 0; i < raw.length; i++) { const n = nameOf(raw[i]); if (/_leaves$/.test(n)) m[n] = (m[n] || 0) + 1; } return Object.entries(m).sort((a, b) => b[1] - a[1])[0][0]; })();
const plankTo = plankName === 'crimson_planks' ? 'warped_planks' : 'crimson_planks', leafTo = leafName === 'cherry_leaves' ? 'azalea_leaves' : 'cherry_leaves';
check(!!R.byName[plankTo] && !!R.byName[leafTo], `targets exist: ${plankName}→${plankTo}, ${leafName}→${leafTo}`);

// 1. compile + applyGen
const rules = [[plankName, plankTo], [leafName, leafTo], ['grass_block', 'moss_block']];
check(WS.check(plankName, plankTo) === '' && WS.check(leafName, leafTo) === '' && WS.check('grass_block', 'moss_block') === '', 'rules are valid');
const map = WS.compile(rules);
check(map && map.length === R.stateCount, 'state map compiled');
const gen = WS.applyGen(raw.slice(), map);
check(count(gen, new RegExp('^' + plankName + '$')) === 0 && count(gen, new RegExp('^' + plankTo + '$')) === count(raw, new RegExp('^' + plankName + '$')) + count(raw, new RegExp('^' + plankTo + '$')), 'every ' + plankName + ' became ' + plankTo);
check(count(gen, new RegExp('^' + leafName + '$')) === 0, 'every ' + leafName + ' replaced');
// leaves keep their distance/persistent props, stairs keep facing/half
const lf = R.byName[leafName], lt = R.byName[leafTo];
let propOk = true; for (let s = lf.base; s < lf.base + lf.nstates; s++) { const d = map[s]; for (const p of Object.keys(lt.propIndex || {})) if (lf.has(p) && lt.get(d, p) !== lf.get(s, p)) propOk = false; }
check(propOk, 'leaf props carried over');
const sf = R.byName.oak_stairs, sm = WS.compile([['oak_stairs', 'spruce_stairs']]), stt = R.byName.spruce_stairs;
let stOk = true; for (let s = sf.base; s < sf.base + sf.nstates; s++) { const d = sm[s]; if (T.type[d] !== stt.id) stOk = false; for (const p of ['facing', 'half', 'shape']) if (sf.has(p) && stt.get(d, p) !== sf.get(s, p)) stOk = false; }
check(stOk, 'stairs keep facing / half / shape');

// 2. reconcile: a saved column made under no rules (sv 0) with player edits
const saved = raw.slice();
const idxOf = (re, k) => { let n = 0; for (let i = 0; i < raw.length; i++) if (raw[i] && re.test(nameOf(raw[i]))) { if (n++ === k) return i; } return -1; };
const pi = idxOf(new RegExp('^' + plankName + '$'), 3);   // a plank the player replaced with gold
saved[pi] = st('gold_block');
let ai = -1; for (let i = raw.length - 1; i >= 0; i--) if (!raw[i]) { ai = i; break; }   // air where the player put a plank
saved[ai] = st(plankName);
const pj = idxOf(new RegExp('^' + plankName + '$'), 5);   // a plank the player broke
saved[pj] = 0;
const n1 = WS.reconcile(saved, raw, null, map);
check(n1 > 0, 'reconcile changed ' + n1 + ' cells');
check(saved[pi] === st('gold_block'), 'player block (gold) kept');
check(saved[ai] === st(plankName), 'player-placed ' + plankName + ' kept (not generated there)');
check(saved[pj] === 0, 'broken plank stays broken');
let rest = 0; for (let i = 0; i < raw.length; i++) if (i !== pi && i !== ai && i !== pj && saved[i] !== gen[i]) rest++;
check(rest === 0, 'everything else matches the styled generation');
// 3. a new version of the rules: back to the original for the plank rule, the leaf rule stays
const style1 = WS.next(null, rules, '#c84aa0');
check(style1.sv === 1 && style1.hist[1], 'version 1 with history');
const rules2 = [[leafName, leafTo]];
const style2 = WS.next(style1, rules2, null);
check(style2.sv === 2 && JSON.stringify(style2.hist[1]) === JSON.stringify(rules), 'version 2 keeps version 1 in its history');
check(JSON.stringify(WS.rulesAt(style2, 1)) === JSON.stringify(rules) && JSON.stringify(WS.rulesAt(style2, 2)) === JSON.stringify(rules2) && WS.rulesAt(style2, 0).length === 0, 'rulesAt finds every version');
const n2 = WS.reconcile(saved, raw, WS.compile(WS.rulesAt(style2, 1)), WS.compile(style2.rules));
check(n2 > 0 && saved[pi] === st('gold_block') && saved[ai] === st(plankName), 'second reconcile: player edits still kept');
check(count(saved, new RegExp('^' + plankTo + '$')) === count(raw, new RegExp('^' + plankTo + '$')), 'planks back to the original');
check(count(saved, new RegExp('^' + leafName + '$')) === 0, 'leaf rule still there');
check(count(saved, /^moss_block$/) === count(raw, /^moss_block$/), 'ground rule undone');
const style3 = WS.next(style2, rules2, '#123456');
check(style3.sv === 2 && style3.water === '#123456', 'water only: same version');

// 4. multiplayer: only buildings, furniture, items, trees
check(WS.check('grass_block', 'moss_block', true) === 'mp' && WS.check('water', 'lava', true) === 'mp' && WS.check('stone', 'andesite', true) === 'mp', 'ground / water / stone rules stay single-player');
check(WS.check(plankName, plankTo, true) === '' && WS.check(leafName, leafTo, true) === '' && WS.check('oak_log', 'birch_log', true) === '', 'buildings and trees allowed with friends');
const eff = WS.effective(style1, true);
check(eff.sv === -1 && eff.water === null && eff.rules.length === 2 && eff.mp, 'effective MP style: negative version, no water, ground rule gone');
check(JSON.stringify(WS.rulesAt(eff, -1)) === JSON.stringify(eff.rules), 'rulesAt(-sv) = the filtered rules');
check(WS.effective(style1, false).sv === 1 && WS.effective(style1, false).rules.length === 3, 'alone: every rule');

// 5. shapes that can't swap
check(WS.check('oak_door', 'oak_planks') === 'shape' && WS.check('oak_door', 'spruce_door') === '', 'doors only to doors');
check(WS.check('oak_planks', 'oak_planks') === 'bad' && WS.check('nope', 'oak_planks') === 'bad', 'bad rules refused');
const water = new Uint16Array(256); WS.applyWater(water, '#ff0000');
check(water[0] === VR.rgb565(255, 0, 0), 'water colour as RGB565');

console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);
