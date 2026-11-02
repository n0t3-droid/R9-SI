// u-wild2 · Tiere zum Liebhaben — the rules with no game in them (src/shared/wildbond.js, VR.WildBond):
//  (a) coats: Young's activator–inhibitor cells give each kind its pattern — the same seed the same coat (byte for
//      byte), another seed another one; spots are many small blobs, stripes fewer long bands, both with contrast;
//      a coat costs a few ms (once per variant, cached)
//  (b) springs: an ear or a tail released from a swing settles (bounded, no blow-up at a 0.5 s frame)
//  (c) a family: a mother walking a curve, three babies each following the one ahead — after a minute they walk in
//      a line, each within ~1.6 gaps of the one ahead, in order, never on top of each other
//  (d) meeting you: calm grazers lift their heads as you pass; shy ones hide when you come, peek when you wait;
//      curious ones come closer and sniff when you stand still; food in your hand brings even a shy one; fast running
//      sends the shy off; nothing ever attacks
//  (e) trust: one treat → curious, two → trusting (follows 90 s), three → a friend; treats within 4 s do not count
//  (f) dusk and rain: rest at dusk, shelter in rain
//  (g) visits: a friend comes to your door by day when you are home and its time has come, then not for 4–8 min
//  (h) the save (meta.wildBonds): friends only, a round trip keeps kind, seed and treats; bad records are dropped
//  (i) thinking is throttled by distance (0.25 s near, never beyond 48 blocks)
//   bash test/wt_run.sh wild_bond.js 300
const VR = require('./load_shared.js');
require('../src/shared/wildbond.js');
const B = VR.WildBond;
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const N = B.N;
const blobs = (o) => {
  const seen = new Uint8Array(N * N), sizes = [];
  for (let i = 0; i < N * N; i++) {
    if (seen[i] || o[i] < 128) continue;
    const st = [i]; seen[i] = 1; let s = 0, x0 = 99, x1 = -99, y0 = 99, y1 = -99;
    while (st.length) {
      const j = st.pop(); s++; const x = j % N, y = (j / N) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const q = ((y + dy + N) % N) * N + (x + dx + N) % N; if (!seen[q] && o[q] >= 128) { seen[q] = 1; st.push(q); } }
    }
    sizes.push(s);
  }
  return sizes;
};
const sd = (o) => { let m = 0; for (const v of o) m += v; m /= o.length; let s = 0; for (const v of o) s += (v - m) ** 2; return Math.sqrt(s / o.length); };

console.log('(a) coats');
{
  const a = B.coat(7, 'spots'), b = B.coat(7, 'spots'), c = B.coat(8, 'spots');
  check(a.length === N * N && Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0, 'the same seed gives the same coat, byte for byte');
  check(Buffer.compare(Buffer.from(a), Buffer.from(c)) !== 0, 'another seed gives another coat');
  let spotsN = 0, spotsMean = 0, stripeMean = 0, ok = true;
  for (let s = 1; s <= 6; s++) {
    const sp = blobs(B.coat(s, 'spots')), st = blobs(B.coat(s, 'stripes'));
    spotsN += sp.length; spotsMean += sp.reduce((x, y) => x + y, 0) / Math.max(1, sp.length);
    stripeMean += st.reduce((x, y) => x + y, 0) / Math.max(1, st.length);
    for (const p of ['spots', 'stripes', 'dapples']) if (sd(B.coat(s, p)) < 40) ok = false;
  }
  check(spotsN / 6 >= 4, `spots are many blobs (${(spotsN / 6).toFixed(1)} a coat, ≥ 4)`);
  check(stripeMean / 6 > spotsMean / 6 * 1.5, `stripes are longer bands than spots (mean blob ${(stripeMean / 6).toFixed(0)} vs ${(spotsMean / 6).toFixed(0)} cells)`);
  check(ok, 'every coat has contrast (σ ≥ 40 of 255)');
  const s1 = B.coatSpec('glimmer_deer', 2, true), s2 = B.coatSpec('glimmer_deer', 2, true), s3 = B.coatSpec('glimmer_deer', 2, false);
  check(s1 && Buffer.compare(Buffer.from(s1.tex), Buffer.from(s2.tex)) === 0 && s1.k > s3.k, 'a kind\'s variant is fixed; a fawn\'s spots are stronger than its mother\'s');
  check(Object.keys(B.KINDS).every(k => B.coatSpec(k, 0, false) && B.PATTERNS[B.KINDS[k].coat]), 'every kind has a coat');
  const t0 = process.hrtime.bigint(); for (let i = 0; i < 12; i++) B.coat(100 + i, ['spots', 'stripes', 'dapples'][i % 3]);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 12;
  check(ms < 6, `a coat takes ${ms.toFixed(1)} ms (< 6, once per variant)`);
  check(B.sample(a, -3, 5, 40) === B.sample(a, -3, 5, 40) && B.mix(0x000000, 0xffffff, 0.5) === 0x808080, 'sampling wraps; colours mix');
}

console.log('(b) springs');
{
  const s = { x: 0.8, v: 0 }; let peak = 0;
  for (let i = 0; i < 240; i++) { B.spring(s, 0, 9, 0.35, 1 / 60); peak = Math.max(peak, Math.abs(s.x)); }
  check(Math.abs(s.x) < 0.02 && peak <= 0.8 + 1e-9, `a released ear swings and settles (after 4 s ${s.x.toFixed(3)})`);
  const s2 = { x: 1, v: 0 }; for (let i = 0; i < 20; i++) B.spring(s2, 0, 9, 0.35, 0.5);
  check(Number.isFinite(s2.x) && Math.abs(s2.x) < 0.05, 'stable at 0.5 s frames');
}

console.log('(c) a family in a line');
{
  const mom = { pos: [0, 0, 0], yaw: 0 }, kids = [0, 1, 2].map(i => ({ pos: [3 + i * 2, 0, 5 - i], yaw: 0 }));
  const out = [0, 0, 0], dt = 1 / 20, speed = 1.6;
  for (let t = 0; t < 60; t += dt) {
    // the mother walks a big slow circle
    mom.yaw += 0.08 * dt;
    mom.pos[0] += -Math.sin(mom.yaw) * speed * 0.55 * dt; mom.pos[2] += -Math.cos(mom.yaw) * speed * 0.55 * dt;
    let ahead = mom;
    for (const k of kids) {
      B.follow(k.pos, ahead.pos, ahead.yaw, out);
      const dx = out[0] - k.pos[0], dz = out[1] - k.pos[2], d = Math.hypot(dx, dz);
      if (out[2] > 0 && d > 1e-6) { const v = Math.min(d / dt, speed * 0.55 * out[2]); k.pos[0] += dx / d * v * dt; k.pos[2] += dz / d * v * dt; k.yaw = Math.atan2(-dx, -dz); }
      ahead = k;
    }
  }
  let ok = true, minGap = 99; let ahead = mom;
  for (const k of kids) { const d = Math.hypot(k.pos[0] - ahead.pos[0], k.pos[2] - ahead.pos[2]); if (d > B.GAP * 1.6) ok = false; minGap = Math.min(minGap, d); ahead = k; }
  const dm = kids.map(k => Math.hypot(k.pos[0] - mom.pos[0], k.pos[2] - mom.pos[2]));
  check(ok, 'each baby walks within 1.6 gaps of the one ahead');
  check(dm[0] < dm[1] && dm[1] < dm[2], `in order behind the mother (${dm.map(d => d.toFixed(2)).join(' < ')})`);
  check(minGap > 0.4, `never on top of each other (closest ${minGap.toFixed(2)} blocks)`);
}

console.log('(d) meeting you');
{
  const c = (o) => Object.assign({ d: 6, speed: 0, still: 0, food: false, trust: 0 }, o);
  check(B.react('bloom_sheep', c({ d: 6, speed: 2.5 })) === 'alert' && B.react('bloom_sheep', c({ d: 20, speed: 2.5 })) === 'none', 'a grazing sheep lifts its head as you walk past (and not from 20 blocks)');
  check(B.react('moss_cat', c({ d: 5, speed: 2.5 })) === 'hide' && B.react('moss_cat', c({ d: 8, still: 4 })) === 'peek', 'a shy kitten hides when you come and peeks when you wait');
  check(B.react('glimmer_fox', c({ d: 9, still: 2 })) === 'approach' && B.react('glimmer_fox', c({ d: 1.2, still: 3 })) === 'sniff', 'a curious fox comes closer when you stand still, then sniffs');
  check(B.react('glimmer_deer', c({ d: 9, still: 3, food: true })) === 'approach' && B.react('glimmer_deer', c({ d: 9, still: 1, food: true })) !== 'approach', 'food in your hand brings even a shy deer — after a little patience');
  check(B.react('glimmer_deer', c({ d: 4, speed: 5.6 })) === 'flee', 'running at a shy deer sends it off');
  const all = new Set(); for (const k in B.KINDS) for (const d of [0.5, 2, 5, 9, 13]) for (const sp of [0, 2, 6]) for (const st of [0, 2, 5]) for (const f of [false, true]) for (const tr of [0, 1, 2, 3]) all.add(B.react(k, c({ d, speed: sp, still: st, food: f, trust: tr })));
  check([...all].every(a => ['flee', 'hide', 'peek', 'alert', 'approach', 'sniff', 'none'].includes(a)), 'only peaceful answers, never an attack: ' + [...all].sort().join(' '));
  check(B.react('glimmer_deer', c({ d: 3, trust: 2 })) === 'approach', 'a trusting animal comes to you without food');
}

console.log('(e) trust');
{
  const b = B.bond('glimmer_deer', 5);
  check(b.state === 'wild' && !B.follows(b), 'a new animal is wild');
  check(B.feed(b, 10) && b.state === 'curious', 'one treat → curious');
  check(!B.feed(b, 12) && b.fed === 1, 'a second treat within 4 s does not count');
  check(B.feed(b, 15) && b.state === 'trusting' && B.follows(b), 'two → trusting: it follows you');
  for (let i = 0; i < 100; i++) B.tick(b, 1);
  check(!B.follows(b) && b.state === 'trusting', 'after 90 s it stops following (and still trusts you)');
  check(B.feed(b, 200) && b.state === 'friend', 'three → a friend');
  check(B.takes('glimmer_deer', 'apple') && !B.takes('glimmer_deer', 'raw_cod') && B.takes('moss_cat', 'raw_cod'), 'each kind takes its own foods');
}

console.log('(f) dusk and rain');
check(B.settle({ night: 0.5, rain: 0 }) === 'rest' && B.settle({ night: 0, rain: 0.8 }) === 'shelter' && B.settle({ night: 0, rain: 0 }) === null, 'rest at dusk, shelter in rain, otherwise about');

console.log('(g) visits');
{
  const f = B.bond('bloom_sheep', 3); f.fed = 3; f.state = 'friend'; f.nextVisit = 0;
  check(B.visitDue(f, { now: 10, day: true, atHome: true, visiting: false }), 'a friend comes to your door by day when you are home');
  check(!B.visitDue(f, { now: 10, day: false, atHome: true }) && !B.visitDue(f, { now: 10, day: true, atHome: false }) && !B.visitDue(f, { now: 10, day: true, atHome: true, visiting: true }), 'not at night, not when you are away, not two at once');
  const nx = B.visited(f, 10, 0.5);
  check(nx >= 10 + 240 && nx <= 10 + 480 && !B.visitDue(f, { now: 100, day: true, atHome: true }), 'then not for 4–8 minutes');
}

console.log('(h) the save');
{
  const f = B.bond('glimmer_fox', 77); f.fed = 4; f.state = 'friend';
  const w = B.bond('moss_boar', 3); w.fed = 1;
  const s = B.serialize([f, w, null, { kind: 'dragon', fed: 9 }]);
  check(s.length === 1 && s[0].kind === 'glimmer_fox' && s[0].seed === 77 && s[0].fed === 4, 'friends only are saved (kind, seed, treats)');
  const back = B.deserialize(JSON.parse(JSON.stringify(s)));
  check(back.length === 1 && back[0].state === 'friend' && back[0].seed === 77, 'a round trip keeps them');
  let threw = false, r = null; try { r = B.deserialize([1, 'x', { kind: 'moss_cat', fed: 'a' }, { kind: 'moss_cat', fed: 2 }, { kind: '__proto__', fed: 5 }]); } catch (e) { threw = true; }
  check(!threw && r.length === 0 && B.deserialize(null).length === 0, 'bad records are dropped, never thrown');
  const many = []; for (let i = 0; i < 9; i++) { const b = B.bond('bloom_sheep', i); b.fed = 3; many.push(b); }
  check(B.serialize(many).length === B.MAX, `at most ${B.MAX} friends`);
}

console.log('(i) thinking by distance');
check(B.thinkEvery(25) === 0.25 && B.thinkEvery(900) === 0.6 && B.thinkEvery(2000) === 1.5 && B.thinkEvery(60 * 60) === Infinity, 'near 0.25 s, mid 0.6 s, far 1.5 s, beyond 48 blocks never');

console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);
