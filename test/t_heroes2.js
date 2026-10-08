// Round 2 of the trailer's heroes and the street's budget, without GL (src/shared/folkcrowd.js):
//  · the cap of the people in view: keepNearest keeps exactly the cap smallest squared distances, in order, and never
//    allocates (it works on a fixed buffer), for every preset the cap is 8 (Very Low), 12 (Low) or 16;
//  · the dusk: each person walks home at its own time inside the window, about half of them by 11800;
//  · the plaza: one person in eight, stable per person;
//  · the aim: a hero with the 'aim' act holds its blaster raised to the chest; the other heroes keep their hold.
//   bash test/wt_run.sh t_heroes2.js
const V = require('./load_shared.js');
const C = V.Crowd, FA = V.FolkAnim;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };

// ---------------------------------------------------------------- the cap of the people in view
{
  let seed = 12345;
  const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 4294967296; };
  let good = true, n = 0;
  for (let trial = 0; trial < 300; trial++) {
    const cap = 1 + Math.floor(rnd() * 16), count = Math.floor(rnd() * 60);
    const d2 = [];
    for (let i = 0; i < count; i++) d2.push(Math.floor(rnd() * 400) * 1.5);   // with ties
    const buf = new Float64Array(16);
    let nn = 0;
    for (const v of d2) nn = C.keepNearest(buf, nn, cap, v);
    const want = d2.slice().sort((a, b) => a - b).slice(0, cap);
    if (nn !== Math.min(cap, count)) good = false;
    for (let i = 0; i < nn; i++) if (buf[i] !== want[i]) good = false;
    n++;
  }
  check(good, `keepNearest keeps the cap smallest squared distances in order (${n} random sets, ties included)`);
  const b = new Float64Array(4); let k = 0;
  for (const v of [9, 4, 7, 1, 8, 2]) k = C.keepNearest(b, k, 4, v);
  check(k === 4 && b[0] === 1 && b[1] === 2 && b[2] === 4 && b[3] === 7, 'keepNearest(cap 4) of 9,4,7,1,8,2 → 1,2,4,7');
}
check(C.streetCap('potato') === 8, 'the Very Low preset draws at most 8 people in view');
check(C.streetCap('low') === 12, 'the Low preset draws at most 12 people in view');
check(C.streetCap('balanced') === 16 && C.streetCap('high') === 16 && C.streetCap('ultra') === 16, 'the other presets draw at most 16 people in view');
check(C.streetCap(undefined) === 16, 'without a preset the cap is 16');

// ---------------------------------------------------------------- the dusk and the plaza (per person, stable)
{
  const [lo, hi] = C.STREET.dusk;
  let inside = true, byDusk = 0, plaza = 0, N = 2000;
  for (let s = 1; s <= N; s++) {
    const h = C.homeAt(s * 7919);
    if (!(h >= lo && h < hi)) inside = false;
    if (h <= 11800) byDusk++;
    if (C.plazaPerson(s * 7919)) plaza++;
  }
  check(inside, `every person walks home inside the dusk window [${lo}, ${hi})`);
  const share = byDusk / N;
  check(share > 0.3 && share < 0.7, `about half of the people are home by 11800 (${(share * 100).toFixed(0)} %)`);
  const ps = plaza / N;
  check(ps > 0.09 && ps < 0.16, `one person in eight goes to the plaza (${(ps * 100).toFixed(1)} %)`);
  check(C.homeAt(4242) === C.homeAt(4242) && C.plazaPerson(4242) === C.plazaPerson(4242), 'the numbers of a person are the same in every session');
  let u = true; for (let s = 0; s < 500; s++) { const x = C.unit(s, 3); if (!(x >= 0 && x < 1)) u = false; }
  check(u, 'C.unit lies in [0, 1)');
}

// ---------------------------------------------------------------- the aim: the blaster raised, the hold kept by the others
{
  const mk = (act) => C.newHero({ id: 'x' + act, pos: [0, 81, 0], yaw: Math.PI, act }, { skin: 0, hair: 0, hs: 'short', age: 'adult', role: 'hero', shirt: 0x2452D8, pants: 0x1B3A88, shoes: 0xF07E1E, suit2: 0xF07E1E, suit3: 0xF4F6FA, helm: 1, beard: false, freckles: false, eye: 0x2A4A7A, kidHat: null, elderHat: null, dress: false, dressCol: 0, emblem: 0, lashes: false, tool: 'blaster' });
  const aimH = mk('aim'), holdH = mk('hold');
  check(aimH.aim === true && holdH.aim === false, 'a hero with act "aim" is flagged; a hold is not');
  let arm = 0, armHold = 0, finite = true;
  for (let i = 0; i < 40; i++) {
    C.stepHero(aimH, 1 / 30, [0, 81, 9]); C.stepHero(holdH, 1 / 30, [0, 81, 9]);
    const P = C.heroPose(aimH, 1 / 30), Q = C.heroPose(holdH, 1 / 30);
    arm = P.arm_r[0]; armHold = Q.arm_r[0];
    for (const v of [P.arm_r[0], P.fore_r[0], Q.arm_r[0], Q.fore_r[0]]) if (!Number.isFinite(v)) finite = false;
  }
  check(finite, 'the aim and hold poses are finite');
  check(arm > 1.1 && arm < 1.35, `the blaster is raised to the chest (arm ${arm.toFixed(2)} rad)`);
  check(armHold > 0.85 && armHold < 1.1, `the hold keeps the blaster at the hip (arm ${armHold.toFixed(2)} rad)`);
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
