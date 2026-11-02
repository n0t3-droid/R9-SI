// f-polish9 · the self-reviews of o-wander3 and f-quiet2 (docs/superpowers/plans/2026-11-02-f-polish9.md):
//   a · the tale's ending hug: FolkAnim's embrace — both arms round the partner (the wrists behind its back), an adult
//       down on both knees to a child (the hips lowered, the heads level), the tale's scene uses it
//   b · the scene's lens: a palm's fronds (props, not blocks) count as taken; bystanders near the lens step aside
//   c · one event clock: VR.Regie.busy holds a start the Regie knows of but nobody has seen yet, a vista coming, a foe
//       about to engage; the wander director's beats, the story's acts and the encounters ask it
//   d · a Baustelle that stands within the spacing of its rise is told once (its standing), not twice
// Run: bash test/wt_run.sh polish9.js 300
require('./dom_stub.js');
const V = require('./load_shared.js');
globalThis.VR = V;
require('../src/shared/smoothvox.js'); require('../src/shared/folksmooth.js');
require('../src/main/voxmodels.js'); require('../src/main/villagers.js'); require('../src/main/folkmodel.js');
for (const f of ['i18n', 'lang_en', 'lang_de']) require(__dirname + '/../src/main/' + f + '.js');
require('../src/main/villages.js'); require('../src/main/folk3.js'); require('../src/main/tale_end.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const f2 = (v) => (+v).toFixed(2);
const Folk = V.Folk, FA = V.FolkAnim;
const find = (age) => { for (let s = 1; s < 3000; s++) { const q = Folk.look(s, 'crafter', age, null, null); if (q && q.age === age) return q; } return null; };

console.log('a · the embrace');
{
  const rot = (q) => FA.rotYXZ(q[0] || 0, q[1] || 0, q[2] || 0, new Float64Array(9));
  const mul = (a, b) => { const o = new Float64Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]; return o; };
  const mv = (R, v) => [R[0] * v[0] + R[1] * v[1] + R[2] * v[2], R[3] * v[0] + R[4] * v[1] + R[5] * v[2], R[6] * v[0] + R[7] * v[1] + R[8] * v[2]];
  // the wrist of side s in the person's root frame (model units, the origin on the ground under the hips, −z ahead)
  const wrist = (G, P, s) => {
    const sx = s === 'l' ? -1 : 1, A = G.arm, Rb = mul(rot(P.hips), rot(P.body)), Ra = rot(P['arm_' + s]), Rf = rot(P['fore_' + s]);
    const e = mv(Ra, [0, -A.L1, 0]), f = mv(mul(Ra, Rf), [0, -A.L2, 0]);
    const wb = [sx * A.x + e[0] + f[0], A.y + e[1] + f[1], e[2] + f[2]], w = mv(Rb, wb);
    return [w[0], w[1] + G.hip + (P.hips[4] || 0), w[2]];
  };
  const head = (G, P) => { const Rb = mul(rot(P.hips), rot(P.body)), h = mv(Rb, [0, G.arm.y + 6, 0]); return h[1] + G.hip + (P.hips[4] || 0); };
  const La = find('adult'), Lk = find('child');
  check(!!La && !!Lk && typeof FA.embrace === 'function', 'FolkAnim.embrace, an adult and a child');
  if (La && Lk && FA.embrace) {
    const Ga = Folk.gaitFor(La), Gk = Folk.gaitFor(Lk), Ua = 1 / Ga.bpu, Uk = 1 / Gk.bpu;
    // an adult kneels to a child: the two middles 0.22 block apart
    const gap = 0.22, Pa = {}, Pk = {};
    const dropA = FA.embrace(Ga, { gap, kneel: true, h: 0.72, depth: 0.08, wide: 2 }, Pa), missA = FA.embrace.miss;
    const hA = (Ga.hip - dropA) / Ua;
    FA.embrace(Gk, { gap, h: (hA * Ua + Ga.thigh * 0.2 + Ga.arm.y * 0.62) / Ua, depth: 0.1, wide: 4.6 }, Pk); const missK = FA.embrace.miss;
    const wl = wrist(Ga, Pa, 'l'), wr = wrist(Ga, Pa, 'r');
    console.log(`    kneeling: hips ${f2(hA)} block (standing ${f2(Ga.hip / Ua)}), wrists z ${f2(wl[2] / Ua)} · ${f2(wr[2] / Ua)} block, x ${f2(wl[0] / Ua)} · ${f2(wr[0] / Ua)}, y ${f2(wl[1] / Ua)} · ${f2(wr[1] / Ua)}; miss ${f2(missA)} · child ${f2(missK)} units`);
    check(dropA / Ua >= 0.3 && Pa.shin_l[0] < -1.4 && Pa.shin_r[0] < -1.4, `the adult down on both knees: the hips ${f2(dropA / Ua)} block lower, the shins back (${f2(Pa.shin_l[0])} rad)`);
    check(-wl[2] / Ua > gap && -wr[2] / Ua > gap && Math.abs(wl[0] - wr[0]) / Ua < 0.3, `both of the adult's wrists behind the child's back (beyond its middle ${gap} block ahead, ${f2(Math.abs(wl[0] - wr[0]) / Ua)} block apart)`);
    check(missA <= 1 && missK <= 4, `the arms reach round (the solve's miss ${f2(missA)} / ${f2(missK)} units)`);
    const hdA = head(Ga, Pa) / Ua, hdK = head(Gk, Pk) / Uk, hdS = (Ga.hip + Ga.arm.y + 6) / Ua;
    check(Math.abs(hdA - hdK) <= 0.25 && hdS - hdK > 0.45, `the heads level: kneeling ${f2(hdA)} block, the child's ${f2(hdK)} (standing the adult's was ${f2(hdS)})`);
    const kl = wrist(Gk, Pk, 'l'), kr = wrist(Gk, Pk, 'r');
    check(kl[1] / Uk > (Gk.hip + Gk.arm.y - 4) / Uk && -kl[2] / Uk > 0.1 && -kr[2] / Uk > 0.1 && kl[0] < 0 && kr[0] > 0, `the child's arms round the adult's shoulders (wrists ${f2(-kl[2] / Uk)} · ${f2(-kr[2] / Uk)} block ahead, at ${f2(kl[1] / Uk)} block)`);
    // two adults: chest to chest, both arms round, standing
    const Pb = {}; const d0 = FA.embrace(Ga, { gap: 0.3, h: 1.15, depth: 0.1, wide: 2.4 }, Pb);
    const bl = wrist(Ga, Pb, 'l'), br = wrist(Ga, Pb, 'r');
    check(d0 === 0 && -bl[2] / Ua > 0.3 && -br[2] / Ua > 0.3 && FA.embrace.miss <= 1, `two adults: standing, both wrists behind the other's back (${f2(-bl[2] / Ua)} · ${f2(-br[2] / Ua)} block ahead; miss ${f2(FA.embrace.miss)})`);
    // the state: FA.pose with a.hugO in the 'hug' state gives the embrace (no allocation once warm)
    const ag = { seedW: 3, hugO: { gap, kneel: true, h: 0.72, depth: 0.08, wide: 2 } }, out = {};
    for (let k = 0; k < 40; k++) FA.pose(ag, 'hug', 1 / 30, 0, 0, false, out, undefined, Ga);
    check(Math.abs(out.hips[4] + dropA) < 0.5 && Math.abs(out.shin_l[0] - Pa.shin_l[0]) < 0.05, `the 'hug' state with a.hugO poses the embrace (hips ${f2(out.hips[4])})`);
    const ag2 = { seedW: 3 }, out2 = {};
    for (let k = 0; k < 40; k++) FA.pose(ag2, 'hug', 1 / 30, 0, 0, false, out2, undefined, Ga);
    check(Math.abs(out2.hips[4]) < 1e-9 && Math.abs(out2.arm_l[0] - 1.25) < 0.05, 'without a.hugO the old hug clip (folkjoy\'s greeting hugs unchanged)');
  }
}

console.log('b · the scene\'s lens');
{
  const TE = V.TaleEnd, R = V.R;
  check(!!TE && typeof TE.solidOf === 'function' && typeof TE.asideOf === 'function' && typeof TE.hugOf === 'function', 'TaleEnd.solidOf, asideOf, hugOf');
  if (TE && TE.solidOf) {
    const stem = R.byName.vx_palm_trunk.defaultState, crown = R.byName.vx_palm_crown.defaultState;
    // a palm 4 m east of the pair: its trunk 64…69, its crown at 70; flat ground under y 64
    const blocks = new Map(); for (let y = 64; y < 70; y++) blocks.set(`4,${y},0`, stem); blocks.set('4,70,0', crown);
    const w = { getBlock: (x, y, z) => (y < 64 ? 1 : blocks.get(`${x},${y},${z}`) || 0) };
    const g = { world: w };
    const old = TE.solidOf(g), now = TE.solidOf(g, [0.5, 64, 0.5]);
    check(!old(5.5, 69.5, 1.5) && now(5.5, 69.5, 1.5) && now(2.2, 68.6, -1) && !now(0.5, 66, 0.5) && !now(4.5, 66.2, 4.5), `a palm's fronds count as taken round its crown (${TE.stats.crowns} crown), the pair's own place and the open ground do not`);
    const F3 = V.Folk3;
    if (F3 && F3.frameGroup) {
      const shot = F3.frameGroup(now, [0.5, 64, 0.5], 0.9, { pref: 0 });
      let clear = !!shot;
      if (shot) for (let k = 0; k <= 20; k++) { const u = k / 20, q = [shot.P[0] + (0.5 - shot.P[0]) * u, shot.P[1] + (65 - shot.P[1]) * u, shot.P[2] + (0.5 - shot.P[2]) * u]; if (now(q[0], q[1], q[2])) clear = false; }
      check(clear && !now(shot.P[0], shot.P[1] + 0.6, shot.P[2]), `the pair framed with no frond on the way or over the lens (the lens at ${shot ? shot.P.map(f2).join(', ') : '—'})`);
    }
    // the bystanders: one 1 m beside the lens, one on the line, one beside the pair, one far off
    const P = [0, 65.6, 6], M = [0, 64, 0], mk = (x, z) => ({ pos: [x, 64, z], vel: [0, 0, 0] });
    const a1 = mk(1, 5.5), a2 = mk(0.2, 3), a3 = mk(1.2, 0.3), a4 = mk(8, 8), gv = mk(0, 0.2), pt = mk(0, -0.2);
    const out = TE.asideOf([a1, a2, a3, a4, gv, pt], [gv, pt], P, M);
    const offLine = (a) => Math.abs(a.teAside[0]) >= TE.ASIDE.to - 0.01;
    check(out.length === 2 && out.indexOf(a1) >= 0 && out.indexOf(a2) >= 0 && offLine(a1) && offLine(a2) && !a3.teAside && !a4.teAside && !gv.teAside, `the bystanders before the lens step aside (${out.length}: to ${out.map(a => a.teAside.map(f2).join(',')).join(' · ')}), not those beside the pair or far off`);
    const kid = mk(0, 0), ad = mk(0.22, 0); kid.kid = true;
    const H = TE.hugOf(ad, kid);
    check(H[0].kneel && !H[1].kneel && Math.abs(H[0].gap - 0.22) < 1e-9 && TE.GAPS.hugKid <= 0.25 && TE.GAPS.hug <= 0.35, `an adult kneels to a child (gap ${f2(H[0].gap)}), the child does not; the gaps close (${TE.GAPS.hug} · ${TE.GAPS.hugKid})`);
  }
}

console.log(fails ? `FAILED ${fails}` : 'ALL OK');
