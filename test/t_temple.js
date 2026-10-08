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
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);
