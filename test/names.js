// u-stars · the names of the neighbourhood (docs/superpowers/plans/2026-10-30-u-stars.md): every star name comes from
// our own syllable tables (galaxy.js), none is one of the block list — fiction (films, series, games, books), brands,
// the bright stars' own names — not even inside a longer name; the names are unique and readable. The four nebulae's
// names are hand-picked; each was looked up on the web on 2026-10-30 (searches for the names with "Spiel", "Marke",
// "Nebel", "game", "novel": no game, book, brand or place of that name came up).
// Run: node test/names.js   (bash test/wt_run.sh names.js 300 in a worktree)
const VR = require('./load_shared.js');
const G = VR.Galaxy;
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
const HAND = { Rosenschleier: 'Rose Veil', Glutwiege: 'Ember Cradle', 'Türkisherz': 'Turquoise Heart', Lichtwiege: 'Light Cradle' };
let all = 0, bad = [], dup = 0, odd = [];
for (const seed of [1, 53, 777, 2026, 31337]) {
  const N = G.build(seed), seen = new Set();
  for (const s of N.list) {
    all++;
    if (seen.has(s.name)) dup++; seen.add(s.name);
    if (G.blocked(s.name) && !s.home) bad.push(s.name);
    if (!/^[A-Z][a-z]{3,10}$/.test(s.name) && !s.home) odd.push(s.name);
  }
  check(N.nebs.every((n, i) => n.name && n.name.de === Object.keys(HAND)[i] && n.name.en === HAND[n.name.de]), 'seed ' + seed + ': the nebulae carry the hand-picked names');
}
check(bad.length === 0, 'no generated name is on the block list', bad.slice(0, 5).join(' ') || all + ' names');
check(dup === 0, 'every name once per neighbourhood', dup);
check(odd.length === 0, 'readable: one word, 4–11 letters', odd.slice(0, 5).join(' '));
for (const n of ['Tatooine', 'Vulcan', 'Arrakis', 'Vega', 'Gallifreyan', 'Pandora']) check(G.blocked(n), 'the block list catches ' + n);
check(!G.blocked('Velmira') && !G.blocked('Sastosa'), 'ordinary generated names pass');
for (const h of Object.keys(HAND)) check(!G.blocked(h), 'the hand-picked ' + h + ' is not blocked');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
