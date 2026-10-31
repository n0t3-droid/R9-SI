// u-worlds3 · the native species and their worlds up close (plan docs/superpowers/plans/2026-10-31-u-worlds3.md):
//   a · faces of their own: no person's brows, nose and lips on a native (voxel and smooth path), five different faces
//   b · species tools for the role tools (both paths)
//   c · the chains of three quests, the teachings, the language (natives.js), the greeting, the lang keys
//   d · the plazas: bgen 3's village plans as pinned (shipped), bgen 4's with benches, quieter paving, the monument's foot
//   bash test/wt_run.sh worlds3.js 300
require('./dom_stub.js');
const V = require('./load_shared.js');
require('../src/main/i18n.js'); require('../src/main/lang_en.js'); require('../src/main/lang_de.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const part = (name) => process.argv.length < 3 || process.argv.includes(name);
const KINDS = ['aqua', 'ocker', 'zinn', 'basalt', 'opal'];
const c255 = (v) => Math.max(0, Math.min(255, Math.round(v)));
const mix = (a, b, t) => (c255(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t) << 16) | (c255(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t) << 8) | c255((a & 255) * (1 - t) + (b & 255) * t);
const cols = (G) => { const s = new Set(); for (let i = 0; i < G.c.length; i++) if (G.c[i]) s.add(G.c[i] & 0xffffff); return s; };
const H32 = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };

let Folk = null;
if (part('a') || part('b')) {
  require('../src/shared/smoothvox.js'); require('../src/shared/folksmooth.js');
  require('../src/main/voxmodels.js'); require('../src/main/villagers.js'); require('../src/main/folkmodel.js');
  require('../src/main/villages.js'); require('../src/main/festival.js'); require('../src/main/worldlife.js');
  Folk = VR.Folk;
}
if (part('a')) {
  console.log('a · faces of their own');
  const sigs = [];
  for (const k of KINDS) {
    const L = Folk.look(77, 'farmer', 'adult', null, 'sp:' + k), skin = L.skin;
    const hi = Folk.buildHiRes(L), head = hi.parts.head.grid || hi.parts.head.g || hi.parts.head, hc = cols(head);
    const lipV = mix(skin, 0xB04C58, 0.85), lipS = mix(skin, 0xB04C58, 0.4);
    check(!hc.has(lipV) && !hc.has(lipS), `${k}: the voxel head without a person's lips`);
    const fd = Folk.buildFine(L), fine = fd.fine || (fd.parts && fd.parts.fine);
    const F = fine && fine.head; const fc = F ? cols(F) : new Set();
    const lipL = mix(skin, 0xC86A78, 0.42), browC = mix(skin, 0x3A2A20, 0.45);
    check(!!F && F.face && F.face.kind === k && !fc.has(lipL) && !fc.has(browC), `${k}: the smooth face is the species' own (no lips, no brows) — ${F && F.face ? F.face.kind : '-'}`);
    check(!!(fine && fine.lids && fine.mouth && cols(fine.lids).size && cols(fine.mouth).size), `${k}: it blinks and talks`);
    sigs.push([...fc].sort().join(','));
  }
  check(new Set(sigs).size === 5, 'five different smooth faces');
  // a person keeps a person's face
  const P = Folk.look(77, 'farmer', 'adult', null, 'v'), pf = Folk.buildFine(P).fine;
  check(pf && pf.head.face && !pf.head.face.kind, 'a person keeps a person\'s face');
}
if (part('b')) {
  console.log('b · species tools');
  const tools = KINDS.map(k => Folk.toolOf(Folk.look(91, 'farmer', 'adult', null, 'sp:' + k)));
  check(new Set(tools).size === 5 && tools.every(t => Folk.SPECIES_TOOL && Object.values(Folk.SPECIES_TOOL).includes(t)), 'five species tools: ' + tools.join(', '));
  for (const k of KINDS) {
    const L = Folk.look(91, 'trader', 'adult', null, 'sp:' + k), fd = Folk.buildFine(L), hi = Folk.buildHiRes(L), hum = Folk.buildHiRes(Object.assign({}, L, { tool: 'hoe', species: undefined }));
    const arm = (d) => { const G = d.parts.fore_r.grid || d.parts.fore_r.g || d.parts.fore_r; let n = 0; for (const v of G.c) if (v) n++; return n; };
    check(!!fd.parts.item_r && arm(hi) !== arm(hum), `${k}: holds its ${Folk.toolOf(L)} (smooth and voxel)`);
  }
  check(Folk.toolOf(Folk.look(91, 'farmer', 'child', null, 'sp:aqua')) === null, 'children hold nothing');
}
if (part('c')) {
  console.log('c · the chains, the teachings, the language');
  require('../src/main/natives.js');
  const N = VR.Natives, R = VR.R;
  check(!!N && KINDS.every(k => N.LANG[k] && N.LANG[k].length === 4 && N.TEACH[k] && N.CHAIN[k] && N.CHAIN[k].length === 3), 'every species: 4 words, a teaching, 3 quests');
  const words = KINDS.flatMap(k => N.LANG[k].map(w => w.w));
  check(new Set(words).size === 20, 'twenty different words: ' + words.join(' '));
  const kindsT = new Set(KINDS.map(k => N.TEACH[k].type));
  check(kindsT.has('recipe') && kindsT.has('pieces') && kindsT.has('gadget'), 'teachings: a recipe, a building set, a gadget');
  const has = (id) => !!(R.byName[id] || (VR.ITEMS && VR.ITEMS[id]));
  for (const k of KINDS) {
    const T = N.TEACH[k];
    const ok = T.type === 'pieces' ? T.pieces.length >= 6 && T.pieces.every(p => has(p.slice(2))) : T.ins.every(has) && has(T.out);
    check(ok && has(N.CHAIN[k][1].item), `${k}: the teaching's things exist (${T.type}) and the gift ${N.CHAIN[k][1].item}`);
  }
  // a chain played through: three natives greeted → the gift → the culture moment → taught
  const meta = {}, k = 'aqua';
  const inv = { have: { glass: 10 }, count(id) { return this.have[id] || 0; }, remove(id, n) { this.have[id] -= n; return true; }, add(id, n) { this.have[id] = (this.have[id] || 0) + n; }, changed: false };
  check(N.step(meta, k) === 0, 'starts at the greeting');
  N.talked(meta, k, 'p1'); N.talked(meta, k, 'p1'); N.talked(meta, k, 'p2');
  check(N.step(meta, k) === 0 && N.rec(meta, k).met.length === 2, 'the same native twice counts once');
  const ev = N.talked(meta, k, 'p3');
  check(N.step(meta, k) === 1 && ev && ev.done === 0, 'three natives greeted: the first quest done');
  check(N.give(meta, k, { count: () => 0, remove() { return false; } }) === false && N.step(meta, k) === 1, 'no gift without the things');
  const need = N.CHAIN[k][1]; inv.have[need.item] = need.n + 1;
  check(N.give(meta, k, inv) === true && N.step(meta, k) === 2 && inv.have[need.item] === 1, 'the gift handed over: the second quest done');
  check(!N.learned(meta, k), 'not taught yet');
  const r3 = N.cult(meta, k, inv);
  check(r3 && N.step(meta, k) === 3 && N.learned(meta, k), 'the culture moment: taught');
  // the recipe works once taught, not before
  const T = N.TEACH.aqua, grid = T.ins.map(id => ({ id, n: 1 }));
  check(!!N.match(grid, 3, meta) && N.match(grid, 3, {}) === null, 'the recipe works once taught, not before');
  check(N.match(grid.concat([{ id: 'stone', n: 1 }]), 3, meta) === null, 'only with exactly its things');
  // the words: one more each time you meet them; the greeting line has a word and its translation
  const g1 = N.greeting(meta, 'zinn', 3);
  check(/Glu|Kai|Van|Pel/.test(g1.text) && g1.word && g1.word.w && N.known(meta, 'zinn').length >= 1, 'the greeting: ' + g1.text);
  // the greeting gesture: each species its own, it fades out
  const P0 = () => { const o = {}; for (const j of ['hips', 'body', 'head', 'arm_l', 'arm_r', 'fore_l', 'fore_r', 'leg_l', 'leg_r', 'shin_l', 'shin_r']) o[j] = [0, 0, 0, 0, 0, 0]; return o; };
  const gp = KINDS.map(k2 => { const P = P0(); N.greetPose(P, k2, 0.5); return JSON.stringify(P); });
  const end = P0(); N.greetPose(end, 'aqua', 1);
  check(new Set(gp).size === 5 && JSON.stringify(end) === JSON.stringify(P0()), 'five greetings of their own, done at the end');
  // the hush: others near the player step back to 7–9 m
  const pl = [0, 0, 0], spot = N.hushSpot([2, 0, 1], pl);
  check(Math.hypot(spot[0], spot[2]) >= 7 && Math.hypot(spot[0], spot[2]) <= 9.01, 'the others make room (' + Math.hypot(spot[0], spot[2]).toFixed(1) + ' m)');
  // the lang keys
  const miss = N.keys().filter(key => !(key in VR.I18N.dict.de) || !(key in VR.I18N.dict.en));
  check(miss.length === 0, 'the lang keys in both tables' + (miss.length ? ': ' + miss.slice(0, 5).join(', ') : ''));
  // saved worlds stay valid: an odd record is ignored
  const bad = { natives: { aqua: 'x', zinn: { s: 'q', met: 5 } } };
  check(N.step(bad, 'aqua') === 0 && N.step(bad, 'zinn') === 0 && N.talked(bad, 'zinn', 'a') !== undefined, 'an odd record is read as new');
}
if (part('d')) {
  console.log('d · the plazas');
  const E = VR.WorldEco, D = VR.DimReg, SEED = 4242;
  const PIN3 = {"aqua":"b21101ab","ocker":"36e3e853","zinn":"38bd195c","basalt":"2bc08de5","opal":"1c9edbbe"};   // (bgen 3 as v0.54 shipped it)
  const got = {};
  for (const k of KINDS) {
    const g3 = D.get(k).gen(SEED, { bgen: { [k]: 3 } }), e3 = E.of(g3), s = e3.sites[0];
    const p3 = e3.planOf(s); got[k] = H32(JSON.stringify(p3.ops));
    check(process.argv.includes('--write') || got[k] === PIN3[k], `${k}: bgen 3's village as shipped (${got[k]})`);
    const g4 = D.get(k).gen(SEED, { bgen: { [k]: 4 } }), e4 = E.of(g4), p4 = e4 && e4.planOf(e4.sites[0]);
    check(p4 && p4.plaza.seats && p4.plaza.seats.length >= 8 && p4.plaza.foot >= 8 && p4.plaza.lanterns >= 4, `${k}: bgen 4's plaza — ${p4 && p4.plaza.seats ? p4.plaza.seats.length : 0} seats, the monument's foot ${p4 && p4.plaza.foot}, ${p4 && p4.plaza.lanterns} lanterns`);
    const pav = E.KINDS[k].species.kit;
    check(!!(pav.pave4 && pav.pave4.length === 2 && pav.pave4.every(n => VR.R.byName[n])), `${k}: two calm paving tones ${pav.pave4 ? pav.pave4.join(' / ') : ''}`);
  }
  if (process.argv.includes('--write')) console.log('  PIN3 = ' + JSON.stringify(got));
  check(VR.Bodies.BGEN >= 4, 'bgen 4 is the bodies\' current version');
}
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);
