// f-sky5 (docs/superpowers/plans/2026-10-29-f-sky5.md; docs/reviews/v0.51.md R52-03, R52-04, R52-11) · node:
//  a · the weather and the light traffic: a 'dry' act running when the rain comes ends — the balloon sinks and lands
//      within 25 s (it never flies on through the rain), the birds and the flights leave; none starts while it rains
//  b · the golden land clear: the isles' fog banks fade near the eye (S3.mistNear: none within 60 blocks, full from 180 —
//      the sheet over the canyon floor); at the golden hour the far air (L2.airGold: the aerial perspective's and the end
//      fog's colour) a blue-lilac darker than the horizon, away from the sun bluer than beside it; the valley haze no
//      denser than f-sky4's
//  c · the storm deck (S3.deck): in a storm the cumulus sprites dissolve into the sky's deck (their share ≤ 0.25), the
//      deck's base a charcoal (≤ 0.45 of a fair cloud's top), the rain shafts on, the lit edge only where the sun can
//      break (by day, the storm not total); fair weather: the sprites whole, no deck
//  d · Amarant (bodytex.js): the band edge contrast — the 95th percentile of the CIELAB ΔE between the texture's latitude
//      rows 1.4° apart (|lat| ≤ 70°) — at most half of v0.51's 36.2; 5–7 broad bands (the zone/belt turns of the
//      profile's L* against its 40° mean within ±60°: 4–8 crossings … counted as bands), ≥ 4 hues (30° bins of h*);
//      the ground sky's giant (shaders.js gasGiant): the stripes' sin(lat · 22) gone outside Very Low (LITE keeps v0.48's)
//  e · the costs: Very Low's values — no deck, no fade, the giant's LITE path unchanged (vl_programs.js and frame_cost.js
//      pin its programs and its frame)
//   bash test/wt_run.sh sky5.js 300
const V = require('./load_shared.js');
global.window = global.window || {};
global.performance = global.performance || { now: () => Date.now() };
const SRC = __dirname + '/../src/';
for (const f of ['lifekit', 'lifedirector', 'light2', 'sky3']) require(SRC + 'main/' + f + '.js');
require(SRC + 'shared/bodytex.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const LD = V.LifeDirector, S3 = V.Sky3, L2 = V.Light2, BT = V.BodyTex;

// ---------------------------------------------------------------- a · the rain sends the balloon down
console.log('a · the weather and the light traffic');
{
  const R = V.R, st = (n) => R.byName[n].defaultState, STONE = st('stone');
  const getBlock = (x, y, z) => (y <= 80 ? STONE : 0);
  V.Folk = V.Folk || {}; V.Folk.look = V.Folk.look || ((seed, role) => ({ role })); V.Folk.model = V.Folk.model || (() => ({ def: {} }));
  V.getVoxModel = V.getVoxModel || (() => ({ def: { radius: 1 }, parts: {} }));
  V.Companions = V.Companions || { poseOf: () => ({}) };
  const mk = (tod) => ({ state: 'play', dim: 'overworld', settings: { preset: 'high' }, meta: { seed: 4242, vgen: 9, type: 'default' }, time: 0,
    env: { day: 1, ticks: tod, timeOfDay: tod, E: { sunDir: [0.4, 0.6, -0.69], night: 0, rain: 0, windDir: [1, 0], wind: 1 } },
    player: { pos: [0, 81, 14], yaw: 0 }, cam: { x: 0, y: 82.6, z: 14, yaw: 0 },
    world: { getBlock, topAt: () => 80 },
    particles: { spawn() { return 0; }, spark() {}, splash() {}, glow() {} },
    audio: { ctx: { currentTime: 0 }, tone() {} },
    traffic: { ships: [], spawnFlight(o) { this.ships.push({ tag: o.over ? o.over.tag : o.near && o.near.tag }); } },
    villages: { known: new Map(), festivalNear: () => null, F: { rockets: [] }, festState() { return this.F; } },
    entities: { beginVox: () => ({ u: {} }), drawModel() {}, lightAt: () => ({ sky: 1, bl: [0, 0, 0] }), sunShade: () => 0 } });
  const g = mk(7000), A = new LD.Actor(g); A.auto = false; A.update(0.05);
  const started = A.force('balloon');
  check(started && A.events.some(e => e.kind === 'balloon'), 'the balloon starts in dry weather');
  for (let i = 0; i < 100; i++) { g.time += 0.05; A.update(0.05); }
  const b = A.events.find(e => e.kind === 'balloon'), y0 = b ? b.pos[1] : 0;
  g.env.E.rain = 0.8;   // the rain comes
  let t = 0, minY = y0, gone = false;
  for (; t < 40; t += 0.05) { g.time += 0.05; A.update(0.05); const e = A.events.find(q => q.kind === 'balloon'); if (!e) { gone = true; break; } minY = Math.min(minY, e.pos[1]); }
  check(gone && t <= 25, `in the rain the balloon goes within 25 s (${gone ? t.toFixed(1) + ' s' : 'still flying after 40 s'})`);
  check(minY < y0 - 6 && minY <= 80 + 6, `it sinks and lands, not vanishes in the air (from ${y0.toFixed(0)} down to ${minY.toFixed(0)}, the ground 80)`);
  check(!LD.allowed('balloon', { place: 'hills', hour: 'morning', wet: true, tier: 2, has: {} }) && LD.allowed('balloon', { place: 'hills', hour: 'morning', wet: false, tier: 2, has: {} }), 'no balloon starts while it rains');
  const wetDry = ['balloon', 'flyover', 'flyby', 'birds', 'skyray', 'pigeons'].filter(n => LD.ACTS[n] && LD.ACTS[n].wx === 'dry');
  check(wetDry.length === 6, `the balloon, the flights, the birds, the sky rays and the pigeons are dry-weather acts (${wetDry.join(', ')})`);
  // a flight's act ends in the rain too (its ship flies its pass out: the traffic's own)
  g.env.E.rain = 0; A.events.length = 0; for (let i = 0; i < 20; i++) { g.time += 0.05; A.update(0.05); }
  const f = A.force('flyover'), nf = A.events.filter(e => e.kind === 'flyover').length;
  g.env.E.rain = 0.8; for (let i = 0; i < 200; i++) { g.time += 0.05; A.update(0.05); }
  check(!f || (nf === 1 && !A.events.some(e => e.kind === 'flyover')), `a flyover's act ends when the rain comes (started ${f}, ${A.events.filter(e => e.kind === 'flyover').length} left)`);
}

// ---------------------------------------------------------------- b · the golden land clear
console.log('b · the golden land clear');
{
  check(typeof S3.mistNear === 'function', 'S3.mistNear exists');
  if (S3.mistNear) {
    check(S3.mistNear(20) === 0 && S3.mistNear(60) === 0 && S3.mistNear(180) === 1 && S3.mistNear(400) === 1 && S3.mistNear(120) > 0.2 && S3.mistNear(120) < 0.8,
      `the fog banks fade near the eye: ${[20, 60, 120, 180, 400].map(d => d + ' → ' + S3.mistNear(d).toFixed(2)).join(', ')}`);
    check(/mistNear|c3MistNear/.test(S3.glslPuff()), 'the puff shader (CLOUD3) fades the mist by the distance');
  }
  check(typeof L2.airGold === 'function', 'L2.airGold exists (the golden far air)');
  if (L2.airGold) {
    const away = L2.airGold(0), side = L2.airGold(1), hor = [1.44, 1.15, 1.65];   // (PAL.gold's luminous horizon, f-sky4)
    const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    check(lum(away) < lum(hor) * 0.5 && away[2] > away[0] * 1.4, `away from the sun a blue-lilac, darker than the horizon (${away.map(v => v.toFixed(2))}, luma ${lum(away).toFixed(2)} vs ${lum(hor).toFixed(2)})`);
    check(side[0] / side[2] > away[0] / away[2] && lum(side) > lum(away), `beside the sun paler and warmer (${side.map(v => v.toFixed(2))})`);
    check(L2.AIRGOLD && L2.AIRGOLD.k > 0.5, `the golden hour's far air takes it (share ${L2.AIRGOLD && L2.AIRGOLD.k})`);
  }
  check(L2.FOG.gold[0] <= 0.0016, `the golden valley haze no denser than f-sky4's (${L2.FOG.gold[0]})`);
  check(/u_l2Air/.test(L2.glslCommon ? L2.glslCommon() : ''), 'l2Fog (AIR2, Low and up) mixes the golden far air');
}

// ---------------------------------------------------------------- c · the storm deck
console.log('c · the storm deck');
{
  check(typeof S3.deck === 'function', 'S3.deck exists');
  if (S3.deck) {
    const fair = S3.deck({ rain: 0, cloudCover: 0.3, sunDir: [0.3, 0.7, 0.6] }), storm = S3.deck({ rain: 1, cloudCover: 0.95, sunDir: [0.3, 0.7, 0.6] }), night = S3.deck({ rain: 1, cloudCover: 0.95, sunDir: [0.3, -0.7, 0.6] });
    const light = S3.cloudLight({ rain: 0, cloudCover: 0.3, sunDir: [0.3, 0.7, 0.6] });
    const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], top = lum(light.top) + lum(light.sun);
    check(fair.puff === 1 && fair.on === 0, `fair weather: the sprites whole, no deck (puff ${fair.puff}, deck ${fair.on})`);
    check(storm.on === 1 && storm.puff <= 0.25, `a storm: the deck closed, the sprites dissolve into it (deck ${storm.on}, puff ${storm.puff.toFixed(2)})`);
    check(lum(storm.base) <= 0.45 * top, `the deck's base a charcoal (luma ${lum(storm.base).toFixed(3)} ≤ 0.45 × a fair top's ${top.toFixed(3)})`);
    check(storm.shafts > 0.4 && fair.shafts === 0, `the rain shafts under the deck (${storm.shafts.toFixed(2)})`);
    check(storm.edge > 0 && night.edge === 0, `the lit edge where the sun breaks by day, none at night (${storm.edge.toFixed(2)} / ${night.edge})`);
    check(S3.U4.includes('u_s3Deck2') && /u_s3Deck2/.test(S3.glslSky ? S3.glslSky() : ''), 'the sky program reads the deck (u_s3Deck2)');
  }
}

// ---------------------------------------------------------------- d · Amarant's soft bands
console.log('d · Amarant');
{
  const lab = (c) => { const f = (u) => { u /= 255; return u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4; }; const R = f(c[0]), G = f(c[1]), B = f(c[2]);
    let X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047, Y = 0.2126 * R + 0.7152 * G + 0.0722 * B, Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
    const g = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116); X = g(X); Y = g(Y); Z = g(Z); return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)]; };
  const w = 512, h = 256, r = BT.job({ type: 'bodytex', body: 'amarant', w, h, y0: 0, y1: h });
  const rows = [];
  for (let j = 0; j < h; j++) { const s = [0, 0, 0]; for (let i = 0; i < w; i++) for (let k = 0; k < 3; k++) s[k] += r.a[(j * w + i) * 4 + k]; rows.push(lab(s.map(v => v / w))); }
  const latOf = (j) => 90 - (j + 0.5) / h * 180, d = [];
  for (let j = 0; j + 2 < h; j++) if (Math.abs(latOf(j + 1)) <= 70) { const a = rows[j], b = rows[j + 2]; d.push(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])); }
  d.sort((a, b) => a - b);
  const p95 = d[Math.floor(d.length * 0.95)];
  check(p95 <= 36.2 / 2, `the band edge contrast ${p95.toFixed(1)} ≤ half of v0.51's 36.2`);
  // the bands: the L* profile against its 40° running mean, within ±60° — its sign changes are the band edges
  const win = Math.round(40 / 180 * h), Ls = rows.map(x => x[0]);
  let turns = 0, prev = 0;
  for (let j = 0; j < h; j++) {
    if (Math.abs(latOf(j)) > 60) continue;
    let s = 0, n = 0; for (let q = Math.max(0, j - (win >> 1)); q < Math.min(h, j + (win >> 1)); q++) { s += Ls[q]; n++; }
    const dv = Ls[j] - s / n, sg = Math.abs(dv) < 1.2 ? prev : Math.sign(dv);
    if (prev && sg && sg !== prev) turns++;
    if (sg) prev = sg;
  }
  check(turns >= 4 && turns <= 8, `5–7 broad bands within ±60° (${turns} band edges)`);
  const hues = new Set(rows.filter((_, j) => Math.abs(latOf(j)) < 80).map(x => Math.floor((Math.atan2(x[2], x[1]) * 180 / Math.PI + 360) % 360 / 30)));
  check(hues.size >= 4, `≥ 4 hues (${hues.size} of the 30° bins of h*)`);
  const fs = require('fs'), sh = fs.readFileSync(SRC + 'main/shaders.js', 'utf8'), gg = sh.slice(sh.indexOf('vec4 gasGiant('), sh.indexOf('vec4 gasGiant(') + 4000);
  const lite = gg.match(/#ifdef LITE([\s\S]*?)#else([\s\S]*?)#endif/);
  check(!!lite && /sin\(lat \* 22\.0/.test(lite[1]) && !/sin\(lat \* 22\.0/.test(lite[2]), 'the ground sky\'s giant: the hard stripes only on Very Low (LITE: v0.48\'s), soft bands above it');
}

// ---------------------------------------------------------------- e · Very Low
console.log('e · Very Low');
{
  if (S3.deck) {
    S3.use && S3.use({ sky3: 0, cloudVol: false });
    const vl = S3.deck({ rain: 1, cloudCover: 0.95, sunDir: [0.3, 0.7, 0.6] });
    check(vl.on === 0 && vl.puff === 1, `Very Low (sky3 0, cloudVol off): no deck, the sprites as before (deck ${vl.on}, puff ${vl.puff})`);
    S3.use && S3.use({ sky3: 2, cloudVol: true });
  }
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
