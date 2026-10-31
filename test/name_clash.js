// n-names: no name collides — every proper name a player meets (both tables, the data, the generators) names one
// thing only, no generated name (villagers of the seven peoples, Herzwelt's villages, the stars, the Flausel) is a
// fixed name of the game, and no fixed name is on VR.Names' block list (fiction, brands, rude words).
// Plan docs/superpowers/plans/2026-10-31-n-names.md; the bible docs/design/names.md.
//   bash test/wt_run.sh name_clash.js 300
require('./load_shared.js');
require('../src/shared/pets.js');
require('../src/main/i18n.js');
require('../src/main/lang_en.js');
require('../src/main/lang_de.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const N = VR.Names, de = VR.I18N.dict.de, en = VR.I18N.dict.en;
const one = (v) => (Array.isArray(v) ? v[0] : v);

// ---------------------------------------------------------------- the fixed names, by what they name
const fixed = [];   // [what, word]
const put = (what, w) => { if (typeof w === 'string' && w.trim()) fixed.push([what, w.trim()]); };
for (const b of VR.Universe.HELIA.bodies) { put('body', b.name.de); put('body', b.name.en); }
for (const t of [de, en]) {
  for (const k in t) {
    if (/^g\.eco\.sp\./.test(k)) put('people', t[k]);
    else if (/^story\.who\./.test(k)) put('speaker', String(t[k]).replace(/^(Opa|Grandpa|Meisterin|Chief|Kapitän|Captain|Mutter|Mother) /, ''));
    else if (/^g\.fairy\.who\./.test(k) && !/folk/.test(k)) put('speaker', String(t[k]).replace(/^(Mutter|Mother) /, ''));
    else if (/^g\.fairy\.place\./.test(k)) put('place', t[k]);
    else if (/^g\.lib\.n\./.test(k)) put('outpost', t[k]);
    else if (/^g\.wd\.site\./.test(k)) put('site', t[k]);
    else if (/^story\.c\d+\.title$/.test(k)) put('chapter', t[k]);
    else if (/^g\.codex\.p\./.test(k) && Array.isArray(t[k])) put('people', String(t[k][0]).replace(/^(Die|The) /, ''));
  }
}
for (const n of VR.Galaxy.NEB_NAMES) { put('nebula', n.de); put('nebula', n.en); }
for (const k in VR.Pets.KINDS) for (const n of VR.Pets.KINDS[k].names) put('pet', n);
// a chapter may carry its speaker's name (ch. 1 „Funke", ch. 11 „Echo"); a people's codex card names the people;
// a site of the Wanderbuch may be a trailer city's or temple's name (Nova Haven, Tor-Tempel)
const SAME = { 'chapter|speaker': 1, 'people|people': 1, 'site|place': 0 };
const by = {}; for (const [what, w] of fixed) { const l = w.toLowerCase(); (by[l] = by[l] || new Set()).add(what); }
const clash = Object.keys(by).filter(w => { const s = [...by[w]].sort(); if (s.length < 2) return false; return !(s.length === 2 && SAME[s.join('|')]); });
check(fixed.length >= 120 && !clash.length, fixed.length + ' fixed names (sky, peoples, speakers, Flausel, Märchenorte, outposts, sites, chapters, nebulae, pets): no word names two things' + (clash.length ? ': ' + clash.map(w => w + ' (' + [...by[w]].join('/') + ')').join(', ') : ''));
// (the one-word names; a phrase of ordinary words — a chapter title — was searched as a whole, test/names.js)
const blk = [...new Set(fixed.map(f => f[1]))].filter(w => !/ /.test(w) && N.blocked(w) && !N.reserved(w));   // (the block list's substrings are for coined words: „glass" holds „ass")
check(!blk.length, 'no fixed name (or a word of it) is on the block list' + (blk.length ? ': ' + blk.join(', ') : ''));

// ---------------------------------------------------------------- the generated names
const KINDS = ['herz', 'flausel', 'aqua', 'ocker', 'zinn', 'basalt', 'opal'];
const givenBy = {}, hit = [];
for (const k of KINDS) {
  const P = N.pool(k);
  for (const w of P.first.concat(P.kids, P.elders)) { const l = w.toLowerCase(); if (by[l]) hit.push(k + ' ' + w + ' (' + [...by[l]].join('/') + ')'); (givenBy[l] = givenBy[l] || new Set()).add(k); }
}
check(!hit.length, 'no villager or Flausel is called like a fixed name' + (hit.length ? ': ' + hit.slice(0, 10).join(', ') : ''));
const shared = Object.keys(givenBy).filter(w => givenBy[w].size > 1);
check(!shared.length, Object.keys(givenBy).length + ' given names of seven peoples: none shared by two peoples' + (shared.length ? ': ' + shared.join(', ') : ''));
const vil = new Set(); for (let i = 0; i < 800; i++) vil.add(N.village(i * 104729 + 7));
const vHit = [...vil].filter(w => by[w.toLowerCase()] || givenBy[w.toLowerCase()]);
check(!vHit.length, vil.size + ' Herzwelt villages: none is a fixed name or a given name' + (vHit.length ? ': ' + vHit.join(', ') : ''));
const nat = new Set(); for (const k of ['aqua', 'ocker', 'zinn', 'basalt', 'opal']) for (let i = 0; i < 200; i++) nat.add(N.place(k, i * 7919 + 13));
const nHit = [...nat].filter(w => by[w.toLowerCase()] || vil.has(w));
check(!nHit.length, nat.size + ' native places: none is a fixed name or a Herzwelt village' + (nHit.length ? ': ' + nHit.slice(0, 8).join(', ') : ''));
const stars = new Set(), sHit = [];
for (const seed of [1, 53, 777, 20261031]) for (const s of VR.Galaxy.build(seed).list) if (!s.home) { const l = String(s.name).toLowerCase(); stars.add(s.name); if (by[l] || givenBy[l] || vil.has(s.name) || nat.has(s.name)) sHit.push(s.name); }
check(!sHit.length, stars.size + ' star names of four neighbourhoods: none is a fixed name, a given name or a place' + (sHit.length ? ': ' + sHit.join(', ') : ''));
// the Flausel of the tree villages: two folk of one place never share a name
let dup = 0; for (let i = 0; i < 300; i++) if (N.flausel(i * 31337, 0) === N.flausel(i * 31337, 1)) dup++;
check(!dup, 'two Flausel of one tree village never share a name (300 villages)');

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
