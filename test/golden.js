// f-golden (docs/superpowers/plans/2026-10-30-f-golden.md; docs/reviews/v0.52.md R53-11) · node:
//  a · the golden sky's structure (S3.goldSky → u_s3Gold): on at the golden hour in clear weather, off at noon, at night,
//      in the rain and where the sky's level is off (Very Low); its GLSL only under SKY3 (Very Low's program untouched:
//      vl_programs.js pins it)
//  b · the isles' banks only over the void (Clouds.fogBanks(cam, ground)): a bank whose ground lies within 24 blocks under
//      it is not drawn, over a deep floor (or unknown ground) it stays; all within the archipelago's reach
//  c · the golden cumulus with volume: their shaded base a lilac clearly darker than the lit top (the frames' white over
//      lilac shade), bluer than it
//  d · the storm's leftovers: behind the closed deck the sprites' share 0 (only the near scud stays, within S3.DECK.near
//      blocks), the isles' banks gone in the rain
//   bash test/wt_run.sh golden.js 300
const V = require('./load_shared.js');
global.window = global.window || {};
global.performance = global.performance || { now: () => Date.now() };
const SRC = __dirname + '/../src/';
for (const f of ['light2', 'sky3', 'clouds']) require(SRC + 'main/' + f + '.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const S3 = V.Sky3, C = V.Clouds;
const sunAt = (deg) => { const r = deg * Math.PI / 180; return [0.95 * Math.cos(r), Math.sin(r), 0.31 * Math.cos(r)]; };
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

console.log('a · the golden sky\'s structure');
{
  S3.use({ sky3: 2, cloudVol: true });
  const has = typeof S3.goldSky === 'function';
  check(has, 'S3.goldSky exists');
  if (has) {
    const g = S3.goldSky({ sunDir: sunAt(7), rain: 0, cloudCover: 0.2 }, []), noon = S3.goldSky({ sunDir: sunAt(30), rain: 0, cloudCover: 0.2 }, []);
    const night = S3.goldSky({ sunDir: sunAt(-20), rain: 0, cloudCover: 0.2 }, []), wet = S3.goldSky({ sunDir: sunAt(7), rain: 1, cloudCover: 0.9 }, []);
    check(g[0] >= 0.5, `on at the golden hour (${g[0].toFixed(2)})`);
    check(noon[0] === 0 && night[0] === 0 && wet[0] === 0, `off at noon, at night and in the rain (${noon[0]}, ${night[0]}, ${wet[0]})`);
    S3.use({ sky3: 0, cloudVol: false });
    check(S3.goldSky({ sunDir: sunAt(7), rain: 0, cloudCover: 0.2 })[0] === 0, 'off where the sky\'s level is off (Very Low)');
    S3.use({ sky3: 2, cloudVol: true });
    check(S3.U4.includes('u_s3Gold'), 'u_s3Gold is one of the sky\'s uniforms');
    const txt = S3.glslSky();
    check(/u_s3Gold/.test(txt) && /vec3 s3Gold\(/.test(txt), 'the GLSL has s3Gold (in the SKY3 text only)');
  }
}

console.log('b · the isles\' banks only over the void');
{
  const cam = { x: 330, z: 140 };
  const all = C.fogBanks(cam), land = C.fogBanks(cam, (x, z) => 100), deep = C.fogBanks(cam, (x, z) => 40), unknown = C.fogBanks(cam, () => -1);
  check(all.length >= 4, `the banks without a ground test (${all.length})`);
  check(land.length === 0, `none over land within 24 blocks under them (${land.length})`);
  check(deep.length === all.length && unknown.length === all.length, `all over a deep floor or unknown ground (${deep.length}, ${unknown.length} of ${all.length})`);
  // the ground under a bank's centre is not enough: its body reaches 0.6 of its radius out
  const edge = C.fogBanks(cam, (x, z) => (Math.hypot(x - all[0][0], z - all[0][2]) > 20 && Math.hypot(x - all[0][0], z - all[0][2]) < all[0][3] ? 100 : 40));
  check(!edge.some(b => b[0] === all[0][0] && b[2] === all[0][2]), 'a bank whose rim lies over land is not drawn');
  check(all.every(s => Math.hypot(s[0] - C.FOG.x, s[2] - C.FOG.z) <= C.FOG.reach + 0.01), `within the archipelago's reach (${C.FOG.reach})`);
}

console.log('c · the golden cumulus with volume');
{
  S3.use({ sky3: 2, cloudVol: true });
  const L = S3.cloudLight({ rain: 0, cloudCover: 0.2, sunDir: sunAt(7) });
  const top = L.top.map((v, i) => v + L.sun[i] * 0.5);
  check(lum(L.low) <= 0.4 * lum(top), `the base's shade ≤ 0.4 of the lit top (${(lum(L.low) / lum(top)).toFixed(2)})`);
  check(L.low[2] > L.low[0] * 1.3, `the base a lilac-blue (${L.low.map(v => v.toFixed(2)).join(', ')})`);
}

console.log('d · the storm\'s leftovers');
{
  S3.use({ sky3: 2, cloudVol: true });
  const storm = S3.deck({ rain: 1, cloudCover: 0.95, sunDir: [0.3, 0.7, 0.6] }), fair = S3.deck({ rain: 0, cloudCover: 0.3, sunDir: [0.3, 0.7, 0.6] });
  check(storm.puff === 0 && storm.near > 0 && storm.scud > 0, `behind the deck the sprites' share 0, the near scud within ${storm.near} blocks (${storm.scud})`);
  check(fair.puff === 1, `fair weather: the sprites whole (${fair.puff})`);
  check(S3.mistK({ rain: 1, cloudCover: 0.95, sunDir: [0.3, 0.7, 0.6] }) === 0, 'the isles\' banks gone in the rain');
  check(S3.mistK({ rain: 0, cloudCover: 0.3, sunDir: [0.3, 0.7, 0.6] }) === 1, 'and there at noon in fair weather');
  S3.use({ sky3: 0, cloudVol: false });
  const vl = S3.deck({ rain: 1, cloudCover: 0.95, sunDir: [0.3, 0.7, 0.6] });
  check(vl.puff === 1 && vl.on === 0, 'Very Low: no deck, its sprites as they were');
}

console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);
