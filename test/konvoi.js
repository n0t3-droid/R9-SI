// a-konvoi · playing together across worlds without a browser (docs/superpowers/plans/2026-10-30-a-konvoi.md §3): the
// messages and their checker, the thin dead-reckoned space presence and the bytes a guest sends in a whole cruise and in
// orbit (≤ 2 KB/s), the formation, the roster, the emote's pace, the lang keys, the hooks in mp.js / travel.js /
// cruise.js / game.js.
// Run: node test/konvoi.js   (bash test/wt_run.sh konvoi.js 300 in a worktree)
const fs = require('fs');
const VR = require('./load_shared.js');
globalThis.VR = VR;
const ROOT = __dirname + '/../';
require(ROOT + 'src/main/cruise.js');
require(ROOT + 'src/main/konvoi.js');
const K = VR.Konvoi, CR = VR.Cruise, U = VR.Universe, S = U.home;
let fails = 0;
const check = (ok, msg, info) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg + (info !== undefined ? '  (' + info + ')' : '')); };
check(!!K && typeof K.check === 'function' && typeof K.gate === 'function', 'VR.Konvoi is there');
if (!K || !K.check) { console.log('FAILED ' + fails); process.exit(1); }

console.log('(a) the messages and the checker');
{
  const tm = K.travelMsg('opal', [12.345, 140.04, -77.77], 'R9', 'ship');
  check(tm.dim === 'opal' && tm.at[0] === 12.3 && tm.at[2] === -77.8 && tm.h === 'R9' && JSON.stringify(tm).length < 120, 'the travel message {dim, at, h, via}: at to 0.1 m, small', JSON.stringify(tm));
  const c = K.check('travel', tm);
  check(c && c.dim === 'opal' && c.at.length === 3, 'a travel message passes the checker');
  check(K.check('travel', { dim: '<script>', at: [0, 0, 0] }) === null, 'a travel message with a junk world is refused');
  check(K.check('travel', { dim: 'opal', at: [0, NaN, 0] }).at === null, 'a junk place becomes null (the guest uses the host\'s spawn)');
  check(K.check('travel', { dim: 'opal', h: 'x'.repeat(5000) }) === null, 'a message over 4 KiB is refused');
  check(K.check('travel', { dim: 'opal', h: 'Bö<b>se\u0007 Name, sehr lang und noch länger' }).h.indexOf('<') < 0, 'a name is cleaned (no markup, no control characters, ≤ 24)');
  const sp = { f: 'helia', r: [1, 2, 3], v: [0.1, 0.2, 0.3], q: [0, 0, 0, 1], t: 12.5, c: 0 };
  const cr = K.check('konvoi', { k: 'cruise', to: 'opal', sp, o: ['p1', 'p2', 42] });
  check(cr && cr.to === 'opal' && cr.sp && cr.o.length === 2, 'cruise {to, sp, o}: the order of the guests (strings only)');
  check(K.check('konvoi', { k: 'cruise', to: 'opal', sp: { f: 'helia', r: [1, 2], v: [0, 0, 0], q: [0, 0, 0, 1], t: 0 } }).sp === null, 'a broken sp is dropped');
  check(K.check('konvoi', { k: 'along', y: 1, d: 'overworld', i: 99 }).i === 7, 'along {y, d, i}: the slot clamped');
  check(K.check('konvoi', { k: 'arrived', d: 'opal' }).d === 'opal' && K.check('konvoi', { k: 'arrived' }) === null, 'arrived {d}');
  const fr = K.check('konvoi', { k: 'freed', id: '120_-48', b: [1, 2, 3], r: { xp: 40, taler: -5 } });
  check(fr && fr.r.xp === 40 && fr.r.taler === 0, 'freed {id, b, r}: a reward never negative', JSON.stringify(fr));
  check(K.check('konvoi', { k: 'story', id: 'c2.b1', ch: 2, a: 'offer' }).a === 'offer' && K.check('konvoi', { k: 'story', id: 'c2.b1', ch: 2, a: 'delete' }) === null, 'story {id, ch, a}: offer · watch · later only');
  check(K.check('konvoi', { k: 'emote', e: 'wave' }).e === 'wave' && K.check('konvoi', { k: 'emote', e: 'text', t: 'hallo' }) === null, 'emote: the three of the wheel only (no free text — kind-safe)');
  check(K.check('konvoi', { k: 'chat', t: 'hi' }) === null && K.check('konvoi', null) === null && K.check('other', { k: 'emote', e: 'wave' }) === null, 'unknown kinds and topics are refused');
}

console.log('(b) the space presence: thin, dead-reckoned — the bytes a guest sends in a whole cruise');
const SS = 'w-' + 'a'.repeat(38);   // (the longest session id mp.js makes)
const presOf = (sp) => ({ pl: K.thin({ n: 'Buddy-Explorer', p: [1234.56, 260.4, -987.65], v: { s: 4242, a: 'shuttle', pa: null }, lk: [3, 2, 1, 4, 1] }, sp), role: 'guest', ss: SS });
{
  const st0 = S.state(0), h = st0.b.herz, P0 = [h.r[0] + S.body('herz').R + 3063, h.r[1], h.r[2]], V0 = [h.v[0], h.v[1] + 7700, h.v[2]];
  const cl = CR.closest('herz', 'opal', 0, 3 * 86400, 600);
  const st = S.state(cl.t), hb = st.b.herz, R = S.body('herz').R;
  const P = [hb.r[0] + R + 3063, hb.r[1], hb.r[2]], V = [hb.v[0], hb.v[1] + Math.sqrt(S.body('herz').mu / (R + 3063)), hb.v[2]];
  void P0; void V0;
  const c = CR.create(P, V, 'herz', 'opal', cl.t, [1, 0, 0]);
  const G = { last: null }, q = [0, 0, 0, 1];
  let bytes = 0, n = 0, tick = 0, vPrev = null, acc = [0, 0, 0], full = 0, maxGap = 0, lastSent = c.t;
  const hh = 1 / 60;
  for (let i = 0; i < 60 * 600 && c.phase !== 'done'; i++) {
    CR.step(c, hh);
    tick += hh;
    if (tick < 0.1 - 1e-9) continue;
    tick = 0;
    if (vPrev) for (let k = 0; k < 3; k++) acc[k] += ((c.V[k] - vPrev[k]) / 0.1 - acc[k]) * 0.5;
    vPrev = Array.from(c.V);
    const sp = K.spOf({ frame: 'helia', r: c.P, v: c.V, t: c.t, coast: false }, q, acc);
    full += K.bytes(presOf(sp));
    if (!K.gate(G, sp)) continue;
    maxGap = Math.max(maxGap, c.t - lastSent); lastSent = c.t;
    G.last = sp; bytes += K.bytes(presOf(sp)); n++;
  }
  const T0 = c.total, bps = bytes / T0, fps = full / T0;
  console.log(`    the cruise Herzwelt → Opal: ${T0.toFixed(1)} s, ${n} presences (${(n / T0).toFixed(1)} Hz), ${Math.round(bps)} B/s — every tick would be ${Math.round(fps)} B/s; the longest gap ${maxGap.toFixed(2)} s`);
  check(c.phase === 'done', 'the simulated cruise arrives');
  check(bps <= K.KBPS, `a guest in the cruise sends ≤ 2 KB/s (${Math.round(bps)} B/s)`);
  check(maxGap <= K.BEAT + 0.11, `and at least once a second (${maxGap.toFixed(2)} s)`);
  check(fps > bps, `dead reckoning saves bytes (${Math.round(fps)} → ${Math.round(bps)} B/s)`);
  // the error a friend sees between two presences: the prediction against the true way, at most the tolerance
  let worst = 0, over = 0, ticks = 0; const G2 = { last: null }; const c2 = CR.create(P, V, 'herz', 'opal', cl.t, [1, 0, 0]); tick = 0; vPrev = null; acc = [0, 0, 0];
  for (let i = 0; i < 60 * 600 && c2.phase !== 'done'; i++) {
    CR.step(c2, hh); tick += hh; if (tick < 0.1 - 1e-9) continue; tick = 0;
    if (vPrev) for (let k = 0; k < 3; k++) acc[k] += ((c2.V[k] - vPrev[k]) / 0.1 - acc[k]) * 0.5;
    vPrev = Array.from(c2.V);
    const sp = K.spOf({ frame: 'helia', r: c2.P, v: c2.V, t: c2.t, coast: false }, q, acc);
    if (G2.last) { const p = K.predict(G2.last, sp.t - G2.last.t); const e = Math.hypot(p[0] - sp.r[0], p[1] - sp.r[1], p[2] - sp.r[2]) / (4 + 0.002 * Math.hypot(...sp.v)); worst = Math.max(worst, e); ticks++; if (e > 2) over++; }
    if (K.gate(G2, sp)) G2.last = sp;
  }
  check(over / ticks < 0.05, `between two presences the friend's guess stays within twice the tolerance (4 m + 0.2 % of the speed) in ${(100 - 100 * over / ticks).toFixed(1)} % of the ticks (the drive's punch: one tick off, worst ${worst.toFixed(0)}×, then sent)`);
}
{
  // in orbit round Opal: the conic, once (then every 10 s)
  const B = S.body('opal'), r0 = B.R + 3000, v0 = Math.sqrt(B.mu / r0), G = { last: null };
  const pred = (L, dt, out) => { U.coast(L.r, L.v, B.mu, dt, out, [0, 0, 0]); return out; };
  let bytes = 0, n = 0; const r = new Float64Array(3), v = new Float64Array(3);
  for (let t = 0; t <= 120; t += 0.1) {
    U.coast([r0, 0, 0], [0, v0, 0], B.mu, t, r, v);
    const sp = K.spOf({ frame: 'opal', r, v, t, coast: true }, [0, 0, 0, 1], null);
    if (K.gate(G, sp, pred)) { G.last = sp; bytes += K.bytes(presOf(sp)); n++; }
  }
  check(n <= 14 && bytes / 120 < 100, `a coasting ship sends its conic once (then every 10 s): ${n} in 2 min, ${(bytes / 120).toFixed(0)} B/s`);
  const G3 = { last: null }; let n3 = 0;
  for (let t = 0; t <= 2; t += 0.02) { const sp = K.spOf({ frame: 'opal', r: [r0 + t * 1000, 0, 0], v: [1000, 0, 0], t, coast: false }, [0, 0, 0, 1], [60, 0, 0]); if (K.gate(G3, sp)) { G3.last = sp; n3++; } }
  check(n3 <= 21, `at most 10 a second (${n3} in 2 s of a ship speeding up)`);
}

console.log('(c) the formation and the frames');
{
  const offs = [0, 1, 2, 3].map(K.FORM);
  let minD = 1e9; for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) minD = Math.min(minD, Math.hypot(offs[i][0] - offs[j][0], offs[i][1] - offs[j][1], offs[i][2] - offs[j][2]));
  check(offs.every(o => Math.hypot(...o) >= 40 && Math.hypot(...o) < 80 && o[2] > 0), 'every slot 40–80 m from the leader, behind it', JSON.stringify(offs));
  check(minD >= 30, `no two followers closer than 30 m (${minD.toFixed(0)} m)`);
  // a frame: east, up, south as columns (row-major) — local → system → local is the identity
  const a = 0.7, b = 0.3, e = [Math.cos(a), Math.sin(a), 0], u = [-Math.sin(a) * Math.cos(b), Math.cos(a) * Math.cos(b), Math.sin(b)];
  const s = [e[1] * u[2] - e[2] * u[1], e[2] * u[0] - e[0] * u[2], e[0] * u[1] - e[1] * u[0]];
  const L = [e[0], u[0], s[0], e[1], u[1], s[1], e[2], u[2], s[2]];
  const o = [40, 0, 25], sy = K.toSys(L, o), back = K.toLocal(L, sy);
  check(Math.hypot(back[0] - 40, back[1], back[2] - 25) < 1e-9 && Math.abs(Math.hypot(...sy) - Math.hypot(...o)) < 1e-9, 'K.toSys / K.toLocal: one the other\'s inverse, lengths kept');
  const sp = K.sysPos(S, 'opal', [10, 0, 0], 0), ob = S.state(0).b.opal.r;
  check(Math.abs(sp[0] - ob[0] - 10) < 1e-6 && K.sysPos(S, 'helia', [5, 6, 7], 0)[2] === 7, 'K.sysPos: a body frame\'s place in the system');
}

console.log('(d) who is where, the emotes');
{
  const rows = K.roster('opal', [{ name: 'Mia', d: 'overworld', dist: 5 }, { name: 'R9', host: true, d: 'opal', dist: 310 }, { name: 'Ben', d: 'opal', dist: 12 }, { name: 'Ida', d: 'space', dist: 1e7 }]);
  check(rows[0].name === 'R9' && rows[1].name === 'Ben' && rows[3].dist === null && rows[2].dist === null, 'the host first, then those here by distance, the others (no distance) last', rows.map(r => r.name).join(' '));
  check(/R9 ★ · .* · 310 m/.test(rows[0].txt) && /Ben · .* · 12 m/.test(rows[1].txt), 'a row: name · world · distance', rows[0].txt);
  check(K.dist(1500) === '1.5 km' && K.dist(42) === '42 m', 'distances in m and km');
  const st = {}; check(K.emoteOk(st, 10) && !K.emoteOk(st, 11) && K.emoteOk(st, 11.6), 'one emote per 1.5 s');
}

console.log('(e) the lang keys, the hooks');
{
  const src = fs.readFileSync(ROOT + 'src/main/konvoi.js', 'utf8');
  const keys = new Set(); for (const m of src.matchAll(/T\('(g\.kv\.[a-zA-Z.]+)'/g)) keys.add(m[1]);
  for (const e of K.EMOTES) keys.add('g.kv.e.' + e);
  for (const a of ['offer', 'watch', 'later']) keys.add('g.kv.story.' + a);
  keys.delete('g.kv.e.'); keys.delete('g.kv.story.');
  const de = fs.readFileSync(ROOT + 'src/main/lang_de.js', 'utf8'), en = fs.readFileSync(ROOT + 'src/main/lang_en.js', 'utf8');
  const miss = [...keys].filter(k => de.indexOf("'" + k + "'") < 0 || en.indexOf("'" + k + "'") < 0);
  check(keys.size >= 20 && !miss.length, `every player-facing text in both tables (${keys.size} keys)`, miss.join(' '));
  const has = (f, s) => fs.readFileSync(ROOT + f, 'utf8').indexOf(s) >= 0;
  check(has('src/main/travel.js', 'VR.Konvoi.hostTravel(g, trip, arrive)') && has('src/main/travel.js', '&& !VR.Konvoi'), 'travel.js: the host with guests keeps the room, takes them along');
  check(has('src/main/cruise.js', 'VR.Konvoi.guestLand(g, c)'), 'cruise.js: a guest\'s descent ends in the host\'s trip');
  check(has('src/main/game.js', 'VR.Konvoi.dimOk(wel.dim)'), 'game.js: a guest starts in the host\'s world');
  check(has('src/main/mp.js', 'VR.Konvoi.spacePose(this.g, a)') && has('src/main/mp.js', 'a.away'), 'mp.js: ships in space beside one\'s own; those in another world not drawn');
  check(has('build.js', "MAIN.push('konvoi')"), 'build.js: konvoi.js in the game');
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
