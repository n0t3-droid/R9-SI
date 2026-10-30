// t-hangar (docs/superpowers/plans/2026-10-29-t-hangar.md): the Hangar Hall and the Gate Temple of a vgen-14 world —
// the gate's glow in concentric rings, the gatehouse, the dark stone, the navy hall with its bay and coffer, the
// round-icon screens and the console desks, the hero craft on the pad — and a vgen-13 world's temple as it was.
//   bash test/wt_run.sh t_hangar.js 300
const V = require('./load_shared.js');
const R = V.R, VM = V.VM;
let bad = 0;
const ok = (c, m) => { if (!c) bad++; console.log((c ? '  ok   ' : '  FAIL ') + m); };
const Y = V.Heart.PLAT;
const world = (vgen) => {
  const g = V.makeGen('overworld', 4242, { vgen }), cache = new Map();
  return {
    g, at(x, y, z) {
      const cx = x >> 4, cz = z >> 4, k = cx + ',' + cz;
      let c = cache.get(k); if (!c) { c = g.generate(cx, cz); cache.set(k, c); }
      return c.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)];
    },
    spawns(cx, cz) { return g.generate(cx, cz).spawns || []; },
  };
};
const name = (s) => s ? R.types[R.T.type[s]].name : 'air';
const count = (W, x0, x1, y0, y1, z0, z1, pred) => { let n = 0; for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) if (pred(name(W.at(x, y, z)))) n++; return n; };

console.log('t_hangar — the blocks');
for (const n of ['vx_hangar_navy', 'vx_hangar_navy_amber', 'vx_floor_hangar', 'vx_floor_hangar_line', 'vm_hangar_screen', 'vm_hangar_screen_b', 'vm_hangar_console', 'temple_stone_dark', 'temple_pilaster_dark', 'amber_window_tall', 'gate_glow'])
  ok(!!R.byName[n], 'registered: ' + n);
ok(R.types.filter(t => !/^(sulfur_red|so2_frost|ocker_dust|carbon_rubble|nickel_iron|ice_nodule|glowspar)$/.test(t.name)).pop().name === 'gate_glow', 'the pieces are the last block types (after the Leuchtfeuer; u-moons2: only Zinnober\'s two after them)');
// the screen's face looks into the hall: facing 1 (the west wall) puts the glowing face east of the back plate
{
  const m = VM.MODELS.vm_hangar_screen; VM.materialize(m);
  const p = m.parts[0]; VM.paintPart(m, p, 1);
  const G = V.VX.gridFor(16), I = V.VX.I16; let back = -1, face = -1;
  for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) for (let z = 0; z < 16; z++) { const v = G[I(x, y, z)]; if (!v) continue; if (v & V.VX.EMIS) face = Math.max(face, x); else back = back < 0 ? x : Math.min(back, x); }
  ok(back >= 0 && face > back && back <= 1, `facing 1: the back plate against the west side (x ${back}), the glowing face east of it (x ${face})`);
}

console.log('vgen 14 — the Gate Temple');
const W = world(14), O = world(13);
ok(name(W.at(0, Y + 7, 20)) === 'gate_glow' && name(O.at(0, Y + 7, 20)) === 'portal_veil', `the gate's glow fills the portal (${name(W.at(0, Y + 7, 20))}; vgen 13: ${name(O.at(0, Y + 7, 20))})`);
{
  const rings = new Set(); for (let x = -6; x <= 6; x++) for (let y = Y + 1; y <= Y + 13; y++) { const s = W.at(x, y, 20); if (name(s) === 'gate_glow') rings.add(R.types[R.T.type[s]].get(s, 'ring')); }
  ok(rings.size === 4, `four rings of glow (${[...rings].sort().join(', ')})`);
}
ok(name(W.at(0, Y + 3, 22)) === 'air' && name(W.at(12, Y + 5, 23)) !== 'air' && name(O.at(12, Y + 5, 23)) === 'air', `the gatehouse stands out on the plaza, open through the gate (${name(W.at(12, Y + 5, 23))})`);
ok(name(W.at(0, Y, 30)) === name(O.at(0, Y, 30)), 'the runway runs on in front of it');
ok(count(W, -22, 22, Y + 1, Y + 20, 20, 20, n => n === 'amber_window_tall') > 20 && count(W, -22, 22, Y + 1, Y + 20, 20, 20, n => n === 'amber_window') === 0, 'the tall amber windows on the front, no grid windows');
ok(count(W, -22, 22, Y + 1, Y + 44, -30, 23, n => n === 'temple_stone' || n === 'temple_stone_smooth') === 0, 'no slate stone left on the central block');
ok(count(W, -22, 22, Y + 1, Y + 20, 21, 21, n => n === 'temple_pilaster_dark') > 20, 'the pilasters stand out of the front face');

console.log('vgen 14 — the Hangar Hall');
const HZ = -10;
ok(name(W.at(12, Y + 2, HZ)) === 'air' && name(O.at(12, Y + 2, HZ)) !== 'air', 'the bay opens round the pad (x 12 is hall)');
ok(name(W.at(0, Y + 18, HZ)) === 'air' && name(O.at(0, Y + 18, HZ)) !== 'air', 'the coffer rises over the pad');
ok(count(W, -9, 9, Y + 16, Y + 19, HZ - 9, HZ + 9, n => n === 'neon_cyan') > 40, 'its risers are rings of cyan light');
ok(count(W, -14, 14, Y + 1, Y + 15, HZ - 14, HZ + 14, n => n === 'vx_hangar_navy') > 150, 'navy walls');
ok(count(W, -11, 11, Y, Y, -30, 10, n => n === 'vx_floor_hangar') > 300 && count(W, -12, 12, Y, Y, HZ - 12, HZ + 12, n => n === 'vx_floor_hangar_line') > 60, 'the tile deck with its octagon light lines');
const scr = count(W, -12, 12, Y + 4, Y + 7, -16, 8, n => n === 'vm_hangar_screen' || n === 'vm_hangar_screen_b');
ok(scr === 8 * 20, `eight framed screens of 5 × 4 (${scr} cells)`);
ok(count(W, -7, 7, Y + 1, Y + 1, -4, 5, n => n === 'vm_hangar_console') === 20, 'two rows of five console desks');
ok(count(W, -12, 12, Y + 1, Y + 15, -40, 20, n => n === 'vx_holo_screen') === 0, 'no wall of holo noise');
{
  const sp = W.spawns(0, -1).find(s => s[0] === 'starship');
  ok(sp && sp[6] === 'hangar' && sp[7] === 'hero', `the pad's craft is the hero craft (${JSON.stringify(sp)})`);
  const so = O.spawns(0, -1).find(s => s[0] === 'starship');
  ok(so && so.length === 7, 'a vgen-13 world keeps its shuttle');
}

console.log('the hero craft');
{
  const SS = V.Starship;
  const d = SS.build(0x5e7a11, 'hero', { palette: 'starforge' }), s = SS.build(0x5e7a11, 'shuttle', { palette: 'starforge' });
  const m = d.meta, n = s.meta;
  ok(m.arch === 'hero' && m.palette === 'starforge' && m.cockpit && m.exhaust.length === 3 && m.gear.length === 4, `it builds: the Starforge palette, a cockpit, ${m.exhaust.length} engines, ${m.gear.length} feet`);
  ok(m.length <= n.length + 1.5 && m.width <= n.width + 1.5 && m.height <= n.height + 1, `the shuttle's size (${m.width} × ${m.height} × ${m.length} m against ${n.width} × ${n.height} × ${n.length})`);
  ok(!SS.archetypes.includes('hero') && SS.pickArch(new V.RNG(7)) !== 'hero', 'not offered in the shipyard, never picked at random (the temple\'s own)');
  ok(SS.build(0x5e7a11, 'hero', {}).meta.palette === 'starforge', 'white and orange, whatever palette is asked');
}
console.log('the hero craft flies the gate loop (hangarflight.js)');
{
  const fs = require('fs'), path = require('path');
  new Function('VR', fs.readFileSync(path.join(__dirname, '../src/main/hangarflight.js'), 'utf8'))(VR);
  const HF = VR.HangarFlight, glow = R.byName.gate_glow.state({ ring: 0 });
  const archs = [];
  const meta = { exhaust: [[0, 3, 11, 0.7]], length: 22, width: 15, height: 8, bounds: [-7.5, 0, -11, 7.5, 8, 11] };
  const home = { hangar: true, state: 'parked', pos: [0, 81, -10], hidden: false, d: { arch: 'hero' }, hitbox: () => [-7.5, 81.3, -21, 7.5, 89, 1] };
  const SS = { ships: [home], pilot: null, designs: new Map(), design(seed, arch, pal) { archs.push(arch); const d = { key: seed + ':' + arch + ':' + pal, arch, meta, gpu: { hull: {}, glass: {} } }; this.designs.set(d.key, d); return d; }, begin: () => ({ u: {} }), drawOne: () => {}, end: () => {}, lightAt: () => ({ sky: 1, bl: [0, 0, 0] }) };
  const g = { state: 'play', dim: 'overworld', settings: { anim: true }, player: { pos: [0.5, 81, 0] }, world: { getBlock: (x, y, z) => (x === 0 && y === 81 && z === 20 ? glow : 0) }, starships: SS, trails: { engine: () => {} }, particles: { spawn: () => {} } };
  const a = new HF.Actor(g); for (let t = 0; t < 6; t += 1 / 30) a.update(1 / 30);
  ok(a.active && home.hidden, 'a vgen-14 gate (its glow at the mouth) starts the loop, the parked craft is one of the two');
  ok(archs.length === 2 && archs.includes('hero') && archs.includes('shuttle'), `the hangar's own flies as the hero craft, the visitor as a shuttle, each built once (${archs.join(', ')})`);
}
console.log(bad ? `FAILED ${bad}` : 'ALL OK');
process.exitCode = bad ? 1 : 0;
