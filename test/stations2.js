// u-stations2 (docs/superpowers/plans/2026-10-31-u-stations2.md): the Ringstation looks real and lives.
//  a · the ring's mesh: panels, warm windows, docking lights — no all-cyan look
//  b · the station generator's version in the save (sgen): new worlds 2, a save that stood in a station keeps 1; sgen 1
//      generates byte-identical to v0.54 (pinned), sgen 2 the dressed hall (no white tiles, a café, plants, crates)
//  c · the deck life: ≥ 4 people in the hall at every moment, tiered (Very Low 4, no drone), pure on the world clock,
//      every figure on free floor (or a seat) of the dressed hall, moving smoothly, their routines
//   bash test/wt_run.sh stations2.js 300
const V = require('./load_shared.js');
global.window = global.window || { addEventListener() {} };
global.performance = global.performance || { now: () => Date.now() };
const fs = require('fs'), path = require('path'), crypto = require('crypto');
for (const f of ['peace', 'lifekit', 'padlife', 'stations']) { const p = path.join(__dirname, '..', 'src', 'main', f + '.js'); if (fs.existsSync(p)) require(p); }
let fails = 0;
const check = (ok, what) => { console.log((ok ? '  ✓ ' : '  ✗ ') + what); if (!ok) fails++; };
const STN = V.Stations, Fo = V.Forge, STA = Fo && Fo.Station, R = V.R;
check(!!STN && !!STA, 'VR.Stations and the Forge station load');
const nm = (s) => (s ? R.types[R.T.type[s]].name : 'air');

console.log('a · the ring outside');
{
  const ok = typeof STN.ringGrid === 'function';
  check(ok, 'the ring\'s grid is built in the pure part (node)');
  if (ok) {
    const G = STN.ringGrid(), cnt = {}; let all = 0;
    for (const s of G.blocks) if (s) { all++; const n = nm(s); cnt[n] = (cnt[n] || 0) + 1; }
    const cy = (cnt.neon_cyan || 0) / all;
    check(cy <= 0.02, `cyan ${(cy * 100).toFixed(1)} % of the ring's ${all} blocks (≤ 2 %: no all-cyan toy)`);
    check((cnt.window_warm || 0) >= 400, `warm windows: ${cnt.window_warm || 0}`);
    check((cnt.beacon_red || 0) >= 8 && (cnt.neon_lime || 0) >= 4, `docking lights: ${cnt.beacon_red || 0} red, ${cnt.neon_lime || 0} green`);
    // the top face: panels of more than one kind
    const top = {}; for (let z = 0; z < 96; z++) for (let x = 0; x < 96; x++) { let y = 31; for (; y >= 0; y--) if (G.blocks[(y * G.sz + z) * G.sx + x]) break; if (y >= 4 && y <= 9) { const r = Math.hypot(x + 0.5 - 48, z + 0.5 - 48); if (r > 37.5 && r < 42.5) { const n = nm(G.blocks[(y * G.sz + z) * G.sx + x]); top[n] = (top[n] || 0) + 1; } } }
    const kinds = Object.keys(top).filter(k => top[k] > 80);
    check(kinds.length >= 3, 'the ring\'s top in panels: ' + Object.entries(top).map(([k, v]) => k + ' ' + v).join(', '));
    const gate = STN.gateGrid(); let gc = 0, gn = 0; for (const s of gate.blocks) if (s) { gn++; if (nm(s) === 'neon_cyan') gc++; }
    check(gc <= 4 && gn >= 28, `the guide gates: dark frames with ${gc} cyan lights`);
  }
}

console.log('b · the station generator\'s version (sgen)');
const hashGen = (id, opts) => { const G = V.makeGen(id, 5, opts), B = G.box; let s = ''; for (let cx = Math.floor(B.x0 / 16); cx <= Math.floor((B.x0 + B.sx) / 16); cx++) for (let cz = Math.floor(B.z0 / 16); cz <= Math.floor((B.z0 + B.sz) / 16); cz++) { const b = G.generate(cx, cz).blocks; s += crypto.createHash('sha1').update(Buffer.from(b.buffer, b.byteOffset, b.byteLength)).digest('hex').slice(0, 16); } return crypto.createHash('sha1').update(s).digest('hex').slice(0, 16); };
{
  check(STN.SGEN === 2 && typeof STN.stampS === 'function', 'STN.SGEN 2, STN.stampS');
  if (STN.stampS) {
    const m0 = {}; STN.stampS(m0);
    const m1 = { dim: 'overworld', pos: { 'stn.ring': [0, 64, 0] } }; STN.stampS(m1);
    const m2 = { dim: 'stn.basalt' }; STN.stampS(m2);
    const m3 = { universe: { sgen: 1 } }; STN.stampS(m3);
    const m4 = { guest: true }; STN.stampS(m4);
    check(m0.universe.sgen === 2 && m1.universe.sgen === 1 && m2.universe.sgen === 1 && m3.universe.sgen === 1 && !m4.universe, `a new save 2; one that stood in a station 1 (${m1.universe.sgen}, ${m2.universe.sgen}); a stamped one keeps its own; a guest is not stamped`);
  }
  const PIN = { 'stn.ring': '1f23377e4292dc81', 'stn.basalt': 'c0166967b5e63370' };
  const h1 = hashGen('stn.ring', {}), h1b = hashGen('stn.ring', { bgen: { stn: 1 } }), h2 = hashGen('stn.ring', { bgen: { stn: 2 } });
  check(h1 === PIN['stn.ring'] && h1b === PIN['stn.ring'], `sgen 1 (and no sgen): the Ringstation byte-identical to v0.54 (${h1}, ${h1b})`);
  check(h2 !== h1, `sgen 2: the dressed hall (${h2})`);
  check(hashGen('stn.basalt', { bgen: { stn: 2 } }) === PIN['stn.basalt'], 'the outposts unchanged');
}

console.log('c · the dressed hall');
let g2 = null;
{
  check(typeof STA.grid === 'function', 'STA.grid(k, v)');
  g2 = STA.grid && STA.grid(0, 2);
  const g1 = STA.grid && STA.grid(0, 1);
  if (g2 && g1) {
    const B = STA.box(0), P = STA.place(0);
    const at = (g, x, y, z) => { const gx = x - B.x0, gy = y - B.y0, gz = z - B.z0; return gx < 0 || gy < 0 || gz < 0 || gx >= g.sx || gy >= g.sy || gz >= g.sz ? 0 : g.blocks[(gy * g.sz + gz) * g.sx + gx]; };
    const floor = (g) => { const c = {}; for (let x = -20; x <= 20; x++) for (let z = -6; z <= 14; z++) { const n = nm(at(g, x, STA.FY - 1, z)); c[n] = (c[n] || 0) + 1; } return c; };
    const f1 = floor(g1), f2 = floor(g2);
    check((f1.vx_tech_hex_white || 0) > 500 && !f2.vx_tech_hex_white && (f2.vx_floor_oak || 0) > 400, `the hall's floor: white tiles ${f1.vx_tech_hex_white} → oak ${f2.vx_floor_oak || 0} (plates ${f2.stn_gravplate || 0})`);
    const count = (g, re, x0, x1, y0, y1, z0, z1) => { let n = 0; for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) if (re.test(nm(at(g, x, y, z)))) n++; return n; };
    const H = (re) => count(g2, re, -20, 20, STA.FY, STA.FY + 8, -6, 14);
    check(H(/^vx_counter$/) >= 3 && H(/^vx_stool/) >= 4 && H(/^vx_table$/) >= 2, `a café: counter ${H(/^vx_counter$/)}, stools ${H(/^vx_stool/)}, tables ${H(/^vx_table$/)}`);
    check(H(/tall_plant|potplant|strelitzia/) >= 8 && H(/rug/) >= 12 && H(/floorlamp/) >= 2, `plants ${H(/tall_plant|potplant|strelitzia/)}, rugs ${H(/rug/)}, warm lamps ${H(/floorlamp/)}`);
    check(count(g2, /vx_crate/, -34, 34, STA.FY, STA.FY + 3, -60, -8) >= 4, 'crates on the deck: ' + count(g2, /vx_crate/, -34, 34, STA.FY, STA.FY + 3, -60, -8));
    let glass = 0; for (let x = P.window.x0; x <= P.window.x1; x++) for (let y = P.window.y0; y <= P.window.y1; y++) if (/glass|viewport/.test(nm(at(g2, x, y, P.window.z)))) glass++;
    const W = Fo.walkable(g2, [P.spawn[0] - 0.5 - B.x0 | 0, P.spawn[1] - B.y0, P.spawn[2] - 0.5 - B.z0 | 0]);
    const reach = (p) => W.reach.has((Math.floor(p[0]) - B.x0) + ',' + (p[1] - B.y0) + ',' + (Math.floor(p[2]) - B.z0));
    const near = (p) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => reach([p[0] + a, p[1], p[2] + b]));
    check(glass > 220 && reach(P.berth) && near([P.counter[0] - 1, STA.FY, P.counter[2]]) && P.cabins.every(c => near(c.inside)) && near(P.garden) && near(P.control), `still walkable: the window (${glass} panes), the berth, the counter, the cabins, the garden, the control room`);
    check(STA.place(0).echo && !Fo.solidish(at(g2, Math.floor(P.echo[0]), STA.FY, Math.floor(P.echo[2]))) && !Fo.solidish(at(g1, Math.floor(P.echo[0]), STA.FY, Math.floor(P.echo[2]))), 'Echo\'s spot in the hall\'s open middle is free floor (both versions)');
    // c · the deck life
    console.log('d · the deck life');
    const ok = typeof STN.deckLife === 'function';
    check(ok, 'STN.deckLife(t, tier, out)');
    if (ok) {
      const inHall = (p) => p[0] >= -20 && p[0] <= 21 && p[2] >= -6 && p[2] <= 15;
      const stats = [0, 1, 2].map(() => ({ minHall: 99, folk: 0, drones: 0, bad: [], states: {}, jump: 0 }));
      for (let tier = 0; tier <= 2; tier++) {
        const S = stats[tier]; let prev = null;
        for (let t = 1000; t < 1600; t += 0.25) {
          const L = STN.deckLife(t, tier, []);
          const folk = L.filter(q => q.kind === 'folk'), dr = L.filter(q => q.kind === 'drone');
          S.folk = Math.max(S.folk, folk.length); S.drones = Math.max(S.drones, dr.length);
          S.minHall = Math.min(S.minHall, folk.filter(q => inHall(q.pos)).length);
          for (const q of folk) {
            const x = Math.floor(q.pos[0]), y = Math.floor(q.pos[1] + 0.01), z = Math.floor(q.pos[2]), feet = at(g2, x, y, z), below = at(g2, x, y - 1, z), head = at(g2, x, y + 1, z);
            const seat = /stool|bench|sofa|chair/.test(nm(feet)) || /stool|bench|sofa|chair/.test(nm(below));
            const fine = q.state === 'sit' ? seat : (!Fo.solidish(feet) && Fo.solidish(below) && !Fo.solidish(head));
            if (!fine && S.bad.length < 4) S.bad.push(`${q.role} ${q.state} at ${q.pos.map(v => v.toFixed(1))} (${nm(below)}/${nm(feet)}/${nm(head)})`);
            S.states[q.role + ':' + q.state] = 1;
          }
          for (const q of dr) { if (Fo.solidish(at(g2, Math.floor(q.pos[0]), Math.floor(q.pos[1]), Math.floor(q.pos[2]))) && S.bad.length < 4) S.bad.push('drone ' + q.role + ' in a block'); }
          if (prev) for (let i = 0; i < L.length; i++) { const a = prev[i], b = L[i]; if (a && a.role === b.role) S.jump = Math.max(S.jump, Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1], a.pos[2] - b.pos[2])); }
          prev = L.map(q => ({ role: q.role, pos: q.pos.slice() }));
        }
      }
      check(stats.every(S => S.minHall >= 4), `≥ 4 people in the hall at every moment (min per tier: ${stats.map(S => S.minHall).join(' / ')})`);
      check(stats[0].folk === 4 && stats[0].drones === 0 && stats[1].drones === 1 && stats[2].drones === 2 && stats[2].folk >= 8, `tiered: Very Low ${stats[0].folk} + ${stats[0].drones} drones, Low ${stats[1].folk} + ${stats[1].drones}, High ${stats[2].folk} + ${stats[2].drones}`);
      check(stats.every(S => !S.bad.length), 'every figure on free floor or a seat, the drones in the air' + stats.map(S => S.bad.join('; ')).filter(Boolean).map(s => ' — ' + s).join(''));
      check(stats.every(S => S.jump < 1.0), `no figure jumps (max ${stats.map(S => S.jump.toFixed(2)).join(' / ')} m in 0.25 s)`);
      const st = stats[2].states, need = ['barista:work', 'barista:talk', 'guest:sit', 'watcher:point', 'watcher:idle', 'docker:carry', 'walker:idle'];
      check(need.every(k => st[k]), 'the routines: ' + Object.keys(st).sort().join(' ') + (need.filter(k => !st[k]).length ? ' — missing ' + need.filter(k => !st[k]).join(' ') : ''));
      const a = JSON.stringify(STN.deckLife(1234.5, 2, [])), b = (STN.deckLife(99, 2, []), JSON.stringify(STN.deckLife(1234.5, 2, [])));
      check(a === b, 'pure: the same moment, the same deck (host and guest)');
      const talk = STN.deckLife(1100, 2, []).filter(q => q.role === 'guest');
      check(talk.length === 2 && talk.every(q => q.state === 'sit'), 'two café guests at a table');
    }
  }
}
console.log('e · texts');
{
  const de = fs.readFileSync(path.join(__dirname, '..', 'src', 'main', 'lang_de.js'), 'utf8'), en = fs.readFileSync(path.join(__dirname, '..', 'src', 'main', 'lang_en.js'), 'utf8');
  const keys = STN.keys(), miss = keys.filter(k => !de.includes('"' + k + '"') || !en.includes('"' + k + '"'));
  check(!miss.length, `${keys.length} texts in both tables` + (miss.length ? ' — missing ' + miss.slice(0, 6).join(' ') : ''));
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
