// The trailer's shots D and E in the generated world (TRAILER.md §4, docs/trailer/README.md): the portal veil in its
// opening, the hall's octagon rings around the pad, the runway's light bars, the air the two heroes stand in, the
// console lights, the spawns the temple's chunks hand out (the crew, the hangar shuttle), and the hall's animation
// gating (Animierte Anzeigen off = nothing blinks, nothing is spent).
//   bash test/wt_run.sh t_temple.js 300
const V = require('./load_shared.js');
const R = V.R, HEART = V.Heart, TG = V.TempleGen;
let fails = 0; const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ok   ' : '  FAIL ') + msg); };
const st = (name) => R.byName[name].defaultState;
// vgen 6: the trailer's temple (new worlds); the vgen 5 section below shows that older worlds keep the HEAD temple
const g = V.makeGen('overworld', 4242, { vgen: 6 });
const tp = TG.build(g), Y = tp.base.pad.y - 1, B = tp.chunks;
// the block state the temple puts at (x, y, z) in the chunk map B: the last override, else the last fill that covers the cell (undefined = not the temple's)
const atIn = (B, x, y, z) => {
  const b = B.get((x >> 4) + ',' + (z >> 4)); if (!b) return undefined;
  for (let i = b.o.length - 4; i >= 0; i -= 4) if (b.o[i] === x && b.o[i + 1] === y && b.o[i + 2] === z) return b.o[i + 3];
  let r; for (let i = 0; i < b.f.length; i += 5) if (b.f[i] === x && b.f[i + 1] === z && y >= b.f[i + 2] && y <= b.f[i + 3]) r = b.f[i + 4];
  return r;
};
const at = (x, y, z) => atIn(B, x, y, z);
console.log('the Gate Temple, shot D');
check(Y === HEART.PLAT, `the temple floor sits at the plateau (y ${Y} = ${HEART.PLAT})`);
check(at(0, Y + 1, 20) === st('portal_veil'), 'the portal opening (centre, bottom row) is the portal veil');
check(at(0, Y + 8, 20) === st('portal_veil'), 'the portal veil fills the opening up to row 8');
check(at(7, Y + 5, 20) !== st('portal_veil'), 'the veil stops inside the frame (x 7 is frame, not veil)');
check(at(0, Y, 44) === st('temple_light_bar') && at(0, Y, 36) === st('temple_light_bar'), 'the runway carries orange light bars down its centre (every 8 blocks)');
check(at(0, Y, 45) === st('vx_floor_deck'), 'between the light bars the runway is dark deck plate');
// the veil in the mesher: its faces go to the translucent pass as the PORTAL kind (the shader's veil branch), and each
// corner carries its distance to the veil's rim (u = distance × 16): 0 on the frame, about 6 in the middle of the gate
{
  const PAD = V.MESH_PAD, PS = V.MESH_PS, PSS = PS * PS;
  const veilLayer = R.T.tex[st('portal_veil') * 6] & 0xfff;
  const meshAt = (CX, CZ, sy) => {
    const cols = {};
    for (let cz = -1; cz <= 1; cz++) for (let cx = -1; cx <= 1; cx++) { const c = g.generate(CX + cx, CZ + cz); c.light = V.computeColumnLight(c.blocks, true); cols[cx + ',' + cz] = c; }
    const blocks = new Uint16Array(PSS * PS), light = new Uint16Array(PSS * PS), z2 = new Uint16Array(PSS);
    for (let y = -PAD; y < 16 + PAD; y++) for (let z = -PAD; z < 16 + PAD; z++) for (let x = -PAD; x < 16 + PAD; x++) {
      const wy = sy * 16 + y, c = cols[Math.floor(x / 16) + ',' + Math.floor(z / 16)], lx = ((x % 16) + 16) % 16, lz = ((z % 16) + 16) % 16;
      const pi = (y + PAD) * PSS + (z + PAD) * PS + (x + PAD), i = (wy << 8) | (lz << 4) | lx; blocks[pi] = c.blocks[i]; light[pi] = c.light[i];
    }
    return V.meshSection({ blocks, light, grass: z2, foliage: z2, water: z2, sy, ox: CX * 16, oz: CZ * 16, smooth: true, fancyLeaves: true, vxLod: true });
  };
  // the gate (x −6 … 6, y 81 … 93, z 20) lies in the chunks x −1 and 0 of the chunk row z 1, in section 5 (y 80 … 95)
  const verts = [];
  for (const CX of [-1, 0]) {
    const r = meshAt(CX, 1, 5), a = r.trans || [];
    for (let o = 0; o < a.length; o += 8) if ((a[o + 3] & 0xfff) === veilLayer) verts.push({ x: a[o] / 2048 - 4 + CX * 16, y: a[o + 1] / 2048 - 4 + 80, z: a[o + 2] / 2048 - 4 + 16, kind: (a[o + 5] >> 8) & 7, d: (a[o + 4] & 255) / 16 });
  }
  check(verts.length > 300, `the veil's faces are in the translucent pass (${verts.length} vertices)`);
  check(verts.every(v => v.kind === 3), `every veil face is the PORTAL kind, so the shader's veil branch draws it (${verts.filter(v => v.kind !== 3).length} are not)`);
  const front = verts.filter(v => Math.abs(v.z - 21) < 1e-3 || Math.abs(v.z - 20) < 1e-3);
  const dMax = Math.max(...front.map(v => v.d)), dMin = Math.min(...front.map(v => v.d));
  check(dMin === 0 && dMax >= 5 && dMax <= 7.5, `the rim distance runs from 0 at the frame to the middle of the gate (${dMin} … ${dMax})`);
  const at0 = (x, y) => front.filter(v => Math.abs(v.x - x) < 1e-3 && Math.abs(v.y - y) < 1e-3).map(v => v.d);
  check(at0(0, 81).every(d => d === 0) && at0(0, 82).every(d => d === 1), `on the bottom row the corners on the floor are 0, the ones a block up are 1 (${at0(0, 81)} / ${at0(0, 82)})`);
  check(at0(0, 87).every(d => d >= 5.5), `the middle of the gate is far from the rim (${at0(0, 87)})`);
}
console.log('the Hangar Hall, shot E');
const HZ = -10;
check(at(5, Y, HZ) === st('vx_floor_plaza_line') && at(8, Y, HZ) === st('vx_floor_plaza_line'), 'the octagon rings around the pad (radius 5 and 8) are light lines');
check(at(0, Y, HZ) === st('vx_floor_pad'), 'the centre is the landing pad ring');
const crew = TG.crew(Y);
check(crew.length === 2, 'two heroes stand in the hall');
for (const [x, y, z] of crew) {
  const fx = Math.floor(x), fz = Math.floor(z);
  check(Math.abs(x) <= 10 && z > HEART.TEMPLE.back && z < HEART.TEMPLE.front, `hero at (${x}, ${z}) is inside the hall`);
  check(at(fx, y, fz) === 0 && at(fx, y + 1, fz) === 0, `hero at (${x}, ${z}) stands in air, not in a console or stool`);
  const fl = at(fx, y - 1, fz);
  check(fl !== undefined && fl !== 0, `hero at (${x}, ${z}) stands on the hall floor`);
}
check(crew[0][3] !== crew[1][3], 'the two heroes face the pad from either side (their yaws differ)');
const lights = TG.consoleLights(Y);
check(lights.length === 12, `12 console lights (6 per row, both rows): ${lights.length}`);
check(lights.every(([x, y, z]) => Math.abs(x) >= 6 && Math.abs(x) <= 8 && y > Y + 1 && y < Y + 3 && z >= -4 && z <= 7), 'the lights sit on the console tops (block centres 6.5 / 7.5)');
// the hexagonal corridor from the back door to the city (shot E, t1_21): air inside, hex panels on both sides
const zc = HEART.TEMPLE.back - 4;
check(at(0, Y + 4, zc) === 0 && at(0, Y + 7, zc) === 0, 'the corridor is open air from the back door (7 high)');
check([-4, 4].every(x => [Y + 2, Y + 5].every(y => at(x, y, zc) === st('vx_tech_hex') || at(x, y, zc) === st('vx_tech_dark_strip'))), 'both corridor walls are the hangar panels');
check(at(0, Y + 8, zc) === st('vx_hex_light_cyan') || at(0, Y + 8, zc) === st('vx_tech_gray'), 'the corridor ceiling carries the hex light row');
// the corridor's city end is the portal as a window (t3_04): a veil in a 7 × 7 octagon, framed by orange light bars
const zx = HEART.TEMPLE.back - 9;
check(at(0, Y + 1, zx) === st('portal_veil') && at(0, Y + 4, zx) === st('portal_veil') && at(3, Y + 4, zx) === st('portal_veil') && at(-3, Y + 4, zx) === st('portal_veil') && at(0, Y + 7, zx) === st('portal_veil'), 'the corridor ends in a veil across its opening');
check(at(3, Y + 1, zx) === st('temple_light_bar') && at(-3, Y + 7, zx) === st('temple_light_bar'), 'the veil is an octagon: its corners are orange light bars');
check([-4, 4].every(x => [Y + 1, Y + 4, Y + 6].every(y => at(x, y, zx) === st('temple_light_bar'))) && at(0, Y + 8, zx) === st('temple_light_bar'), 'an orange light frame runs round the veil');
check(at(0, Y + 4, zx + 1) === 0 && at(0, Y + 4, zx - 1) !== st('portal_veil'), 'the veil is one block thick');
console.log('spawns the temple hands to its chunks');
const pad = tp.base.pad;
const builder = HEART.builders.find(f => f.toString().includes('tp.base.pad'));
check(!!builder, 'the temple has its chunk builder');
const spawnsIn = (cx, cz) => { const out = { blocks: new Uint16Array(65536) }; try { builder(g, cx, cz, out); } catch (e) { return { err: String(e) }; } return out.spawns || []; };
const pcx = pad.x >> 4, pcz = pad.z >> 4;
const hangar = spawnsIn(pcx, pcz).filter(s => s[0] === 'starship');
check(hangar.length === 1 && hangar[0][6] === 'hangar', 'the pad ship is spawned flagged as the hangar\'s');
const crewSpawns = [];
for (const [x, , z] of crew) { const s = spawnsIn(x >> 4, z >> 4).filter(q => q[0] === 'hallcrew'); crewSpawns.push(...s); }
check(crewSpawns.length === 2, `the crew comes with the chunks they stand in (${crewSpawns.length} spawns)`);
console.log('older worlds (vgen 5) keep the temple they were made with');
const g5 = V.makeGen('overworld', 4242, { vgen: 5 }), B5 = TG.build(g5).chunks;
const at5 = (x, y, z) => atIn(B5, x, y, z);
check(at5(0, Y, 36) !== st('temple_light_bar') && at5(0, Y, 44) !== st('temple_light_bar'), 'vgen 5: no landing-strip lights on the runway');
check(at5(-4, Y + 2, zc) !== st('vx_tech_hex') && at5(4, Y + 2, zc) !== st('vx_tech_hex'), 'vgen 5: the back-door path has no hex walls');
check(at5(0, Y + 4, zx) !== st('portal_veil'), 'vgen 5: no veil at the end of the back-door path');
const spawnsOld = (cx, cz) => { const out = { blocks: new Uint16Array(65536) }; builder(g5, cx, cz, out); return out.spawns || []; };
check(spawnsOld(pcx, pcz).every(s => s[0] !== 'starship' || s.length === 6), 'vgen 5: the pad ship keeps its seed\'s archetype (no hangar flag)');
check(crew.every(([x, , z]) => spawnsOld(x >> 4, z >> 4).every(s => s[0] !== 'hallcrew')), 'vgen 5: no hall crew');
console.log('the hall\'s animation gating (hall.js)');
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../src/main/hall.js'), 'utf8');
VR.Folk = VR.Folk || { heroLook: (o) => ({ suit: o.suit, tool: o.tool }) };
new Function('VR', src)(VR);
const mkGame = (anim, px) => { const calls = []; return { calls, g: { time: 0, player: { pos: [px, Y + 1, -10] }, settings: { anim }, particles: { glow: (...a) => calls.push(a) } } }; };
const hall0 = { spawns: [['hallcrew', crew[0][0], crew[0][1], crew[0][2], crew[0][3], 0, 1, 0, 0], ['hallcrew', crew[1][0], crew[1][1], crew[1][2], crew[1][3], 6, 4, 2, 1]] };
const run = (anim, px, secs) => { const m = mkGame(anim, px); const h = new VR.Hall(m.g); h.onColumnLoaded(hall0); h.onColumnLoaded(hall0); for (let t = 0; t < secs; t += 1 / 30) h.update(1 / 30); return { n: m.calls.length, crew: h.crew.length }; };
const on = run(true, 0, 3), off = run(false, 0, 3), far = run(true, 90, 3);
check(on.crew === 2, 'a crew member that loads twice is placed once');
check(on.n > 20, `with Animierte Anzeigen on, the consoles blink near the hall (${on.n} blinks in 3 s)`);
check(off.n === 0, 'with Animierte Anzeigen off nothing blinks');
check(far.n === 0, 'far from the hall nothing blinks (no cost in the city)');

// ---------------------------------------------------------------- the crew's walk to the corridor's city end (t2_20, t1_21)
console.log('the crew walks out to the corridor\'s city end and back (hall.js Hall.patrol)');
{
  const padShip = V.Starship.build(pad.seed, 'shuttle', {});
  const occ = padShip.occ, org = padShip.meta.origin;
  // the parked hangar shuttle (pad x 0, z −10, yaw 0): is the world point inside one of its occupied cells?
  const inShip = (x, y, z) => { const i = Math.floor(x - pad.x - org[0]), j = Math.floor(y - pad.y - org[1]), k = Math.floor(z - pad.z - org[2]); return i >= 0 && j >= 0 && k >= 0 && i < occ.bx && j < occ.by && k < occ.bz && !!occ.occ[(j * occ.bz + k) * occ.bx + i]; };
  for (const [side, c] of [[1, crew.find(q => q[0] > 0)], [-1, crew.find(q => q[0] < 0)]]) {
    const P0 = VR.Hall.patrol(0, side, c[3]), T = P0.T;
    let bad = null, blocked = null, maxV = 0, prev = null, exitT = 0, consoleT = 0, exitYaw = 0, deepest = 0;
    for (let t = 0; t < T; t += 0.05) {
      const p = VR.Hall.patrol(t, side, c[3]);
      if (prev) maxV = Math.max(maxV, Math.hypot(p.x - prev.x, p.z - prev.z) / 0.05);
      prev = p;
      deepest = Math.min(deepest, p.z);
      if (p.phase === 'exit') { exitT += 0.05; exitYaw = p.yaw; }
      if (p.phase === 'console') { consoleT += 0.05; if (p.x !== c[0] || p.z !== c[2] || p.yaw !== c[3]) bad = bad || `console spot ${p.x},${p.z}`; }
      // the body (0.35 m about its middle, 1.9 m tall) stands in air on a floor, clear of the parked shuttle
      for (const dx of [-0.35, 0.35]) for (const dz of [-0.35, 0.35]) {
        const bx = Math.floor(p.x + dx), bz = Math.floor(p.z + dz);
        if (at(bx, Y + 1, bz) !== 0 || at(bx, Y + 2, bz) !== 0) blocked = blocked || `t ${t.toFixed(1)} (${p.x.toFixed(1)}, ${p.z.toFixed(1)}): ${at(bx, Y + 1, bz)}/${at(bx, Y + 2, bz)}`;
        if (!at(bx, Y, bz)) blocked = blocked || `t ${t.toFixed(1)}: no floor at (${bx}, ${bz})`;
        for (const y of [Y + 1.1, Y + 1.9]) if (inShip(p.x + dx, y, p.z + dz)) bad = bad || `t ${t.toFixed(1)} (${p.x.toFixed(1)}, ${p.z.toFixed(1)}) walks into the parked shuttle`;
      }
    }
    check(!blocked, `side ${side}: every step stands in air on the floor (${blocked || 'hall, back door, corridor'})`);
    check(!bad, `side ${side}: the walk keeps clear of the parked shuttle and starts at the console spot (${bad || 'ok'})`);
    check(maxV <= 1.7, `side ${side}: a walking pace (${maxV.toFixed(2)} m/s at most)`);
    check(consoleT >= 15, `side ${side}: ${consoleT.toFixed(0)} s at the consoles, facing the pad`);
    check(deepest <= HEART.TEMPLE.back - 6 && exitT >= 10 && Math.abs(exitYaw) < 1e-6, `side ${side}: ${exitT.toFixed(0)} s at the corridor's city end (z ${deepest}), looking out north at the city`);
  }
}

// ---------------------------------------------------------------- the Gate Temple's shuttle (hangarflight.js)
console.log('the shuttle\'s loop: down the runway, in through the mouth, onto the pad and round again (hangarflight.js)');
new Function('VR', fs.readFileSync(path.join(__dirname, '../src/main/hangarflight.js'), 'utf8'))(VR);
{
  const HF = VR.HangarFlight, S = HF.SCALE, span = 7.5 * S, len = 11.75 * S, tall = 8 * S, turnR = Math.hypot(span, len);
  const OPEN = [3, 4, 5, 6, 6, 6, 6, 6, 6, 6, 5, 4, 3];
  for (const variant of ['hall', 'apron']) {
    const plan = HF.plan(variant), T = plan.T, dt = 1 / 60;
    let jump = 0, vmax = 0, prev = null, lowPass = Infinity, overRunway = Infinity, mouthBad = null, hallBad = null, touch = null, dwell = 0, best = 0, dwellAt = null, phases = new Set();
    for (let t = 0; t < T; t += dt) {
      const s = HF.at(plan, t), p = s.pos;
      phases.add(s.phase);
      if (prev) { const v = Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]) / dt; vmax = Math.max(vmax, v); if (v > 40) jump++; }
      prev = p.slice();
      const ox = Math.abs(p[0] - HF.AX);
      // low over the plaza on the way in, never scraping it
      if (ox < 6 && p[2] > 40 && p[2] < 140) overRunway = Math.min(overRunway, p[1] - HF.DECK);
      if (ox < 6 && p[2] > 40 && p[2] < 80 && (s.phase === 'air' || s.phase === 'in') && Math.cos(s.yaw) > 0.9) lowPass = Math.min(lowPass, -(p[1] - HF.DECK));
      // through the mouth: the hull inside the octagon's rows
      if (p[2] > 19 && p[2] < 22 + len && p[2] - len < 21) {
        for (let y = Math.floor(p[1]); y <= Math.floor(p[1] + tall); y++) { const o = OPEN[y - HF.DECK]; if (o === undefined || ox + span > o + 0.5) mouthBad = mouthBad || `t ${t.toFixed(1)}: row y ${y} (half-width ${o}) vs hull ${(ox + span).toFixed(2)}`; }
      }
      // in the hall: within its walls (half-width 10.5 about x 0.5) and under the chamfers (y 91); turning, its whole circle
      if (p[2] < 19) { const r = s.phase === 'turn' ? turnR : span; if (ox + r > 10.5 || p[1] + tall > 91) hallBad = hallBad || `t ${t.toFixed(1)} ${s.phase}: reach ${(ox + r).toFixed(2)}, top ${(p[1] + tall).toFixed(1)}`; }
      // the apron variant stays outside: its nose (or its turning circle) never reaches the temple's face (z 21)
      if (variant === 'apron' && p[2] < 70) { const reach = s.phase === 'turn' ? turnR : len; if (p[2] - reach < 21.5) touch = touch || `t ${t.toFixed(1)}: z ${(p[2] - reach).toFixed(2)}`; }
      // the dwell on the pad: gear down, standing still on the deck
      if (Math.abs(p[1] - HF.DECK) < 0.01 && s.speed < 0.05 && s.gear > 0.99) { dwell += dt; best = Math.max(best, dwell); dwellAt = p.slice(); } else dwell = 0;
    }
    const e = HF.at(plan, T - 1e-4).pos, b = HF.at(plan, 0).pos;
    check(Math.hypot(e[0] - b[0], e[1] - b[1], e[2] - b[2]) < 0.05 && !jump, `${variant}: one closed loop of ${T.toFixed(0)} s without a jump (end to start ${Math.hypot(e[0] - b[0], e[1] - b[1], e[2] - b[2]).toFixed(3)} m)`);
    check(vmax <= 32, `${variant}: at most ${vmax.toFixed(1)} m/s (a shuttle, not a fighter)`);
    check(overRunway >= 2.5 && -lowPass <= 8, `${variant}: over the runway it never drops below ${overRunway.toFixed(1)} m; its last 40 m in it skims the plaza at ${(-lowPass).toFixed(1)} m at most (t3_03)`);
    check(best >= 4.5 && dwellAt && Math.abs(dwellAt[2] - (variant === 'hall' ? HF.PADZ : HF.APRONZ)) < 0.01, `${variant}: ${best.toFixed(1)} s on the ${variant === 'hall' ? 'pad' : 'runway in front of the mouth'} with its gear down (z ${dwellAt && dwellAt[2]})`);
    check(['in', 'settle', 'pad', 'lift', 'turn', 'out', 'air'].every(q => phases.has(q)), `${variant}: in, settle, pad, lift, turn, out and the air loop (${[...phases].join(' ')})`);
    if (variant === 'hall') { check(!mouthBad, `hall: the hull passes the 13 × 13 mouth without touching its frame (${mouthBad || 'clear'})`); check(!hallBad, `hall: inside, the shuttle and its turn stay clear of the walls and the chamfers (${hallBad || 'clear'})`); }
    else check(!touch, `apron: it lands and turns in front of the temple without touching it (${touch || 'clear'})`);
  }
  // high over the canyon's mesas in every world (the Heartland's composition is the same, its mesas vary with the seed)
  const plan = HF.plan('hall');
  let clear = Infinity, where = null;
  for (const seed of [4242, 1, 777, 31337, 2026]) {
    const gs = V.makeGen('overworld', seed, { vgen: 6 });
    for (let t = plan.ground; t < plan.T; t += 0.25) { const p = HF.at(plan, t).pos; if (p[2] < 145) continue; const gy = gs.surfaceY(Math.floor(p[0]), Math.floor(p[2])); if (p[1] - gy < clear) { clear = p[1] - gy; where = [seed, Math.round(p[0]), Math.round(p[2])]; } }
  }
  check(clear >= 10, `over the canyon it keeps ${clear.toFixed(1)} m above the ground at least (seed ${where[0]}, at ${where[1]}, ${where[2]})`);

  // the actor in a game: Animierte Anzeigen and the distance decide whether anything runs
  const veil = st('portal_veil');
  const mkGame = (o) => {
    const calls = { design: 0, trail: 0, part: 0, draw: 0 };
    const meta = { exhaust: [[-0.95, 3.35, 11.6, 0.72], [0.95, 3.35, 11.6, 0.72], [0, 2.25, 11.6, 0.72]], length: 23, width: 15, height: 8, bounds: [-7.5, 0, -11.25, 7.5, 8, 11.75] };
    const home = { hangar: true, state: 'parked', pos: [0, 81, -10], hidden: false, hitbox: () => [-7.5, 81.3, -21.25, 7.5, 89, 1.75] };
    const other = o.other ? { state: 'parked', pos: [0, 81, -10], hidden: false } : null;
    const SS = { ships: other ? [other] : [home], pilot: null, designs: new Map(), design(seed, arch, pal) { calls.design++; const d = { key: seed + ':' + arch + ':' + pal, meta, gpu: { hull: {}, glass: {} } }; this.designs.set(d.key, d); return d; }, begin: () => ({ u: {} }), drawOne: () => { calls.draw++; }, end: () => {}, lightAt: () => ({ sky: 1, bl: [0, 0, 0] }) };
    const g = { state: 'play', dim: 'overworld', settings: { anim: o.anim }, player: { pos: o.player || [0.5, 81, 0] }, world: { getBlock: (x, y, z) => (o.temple !== false && x === 0 && y === 81 && z === 20 ? veil : 0) }, starships: SS, trails: { engine: () => { calls.trail++; } }, particles: { spawn: () => { calls.part++; } } };
    return { g, calls, home, SS };
  };
  const runA = (o, secs) => { const m = mkGame(o), a = new HF.Actor(m.g); for (let t = 0; t < secs; t += 1 / 30) a.update(1 / 30); return Object.assign(m, { a }); };
  const r1 = runA({ anim: true }, 6);
  check(r1.calls.design === 1 && r1.a.active && r1.a.variant === 'hall' && r1.home.hidden && r1.calls.trail > 0, `near the temple with the animation on: the shuttle flies (design built once, engines ${r1.calls.trail}, the parked one is out flying: hidden ${r1.home.hidden})`);
  const r2 = runA({ anim: false }, 6);
  check(r2.calls.design === 0 && !r2.a.active && r2.calls.trail === 0 && r2.calls.part === 0 && !r2.home.hidden, 'Animierte Anzeigen off (Very Low): nothing is built, flown or spent; the parked shuttle stays on the pad');
  const r3 = runA({ anim: true, player: [0.5, 81, -200] }, 6);
  check(r3.calls.design === 0 && !r3.a.active && r3.calls.trail === 0, 'in the city, 220 blocks from the mouth: nothing runs (no cost)');
  const r4 = runA({ anim: true, temple: false }, 6);
  check(!r4.a.active && r4.calls.design === 0, 'no Gate Temple (another world type): no shuttle');
  const r5 = runA({ anim: true, other: true }, 6);
  check(r5.a.variant === 'apron' && r5.SS.ships.every(s => !s.hidden), 'another ship on the pad (an older world\'s pad ship): it lands on the runway instead and hides nothing');
  // switching the animation off again brings the parked shuttle back
  r1.g.settings.anim = false; r1.g.player.pos = [30, 81, 40]; r1.a.update(1 / 30);
  check(!r1.home.hidden && !r1.a.active, 'the animation switched off: the parked shuttle is back on its pad');
}
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);
