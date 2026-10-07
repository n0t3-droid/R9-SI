// builds every catalogue house (both mirror states) into a recorder and checks block names, room overlaps and door reachability
require('./load_shared.js');
const VG = VR.VillageGen, PLAN = VG.plan2, R = VR.R;
let bad = 0;
const unknown = new Map();
for (const cat of PLAN.CATALOGUE) for (const mirror of [false, true]) for (const skinId of cat.skins.filter((x, i, a) => a.indexOf(x) === i)) {
  const [w, d] = cat.lot;
  const rec = []; const names = new Set();
  const L = VG.makeLot((x, y, z, s) => rec.push(x, y, z, s), 0, 0, 0);
  const P0 = L.P;
  L.P = (u, y, v, name, pr) => { if (name && !R.byName[name]) unknown.set(name, (unknown.get(name) || 0) + 1); if (name) names.add(name); return P0(u, y, v, name, pr); };
  const lot = { w, d, F: 90, r: 0, ox: 0, oz: 0, kind: 'home' };
  let info;
  try { info = PLAN.build(L, lot, { rng: new VR.RNG(1234 + (mirror ? 7 : 0)), ground: () => 88, beds: 3, mirror, skin: skinId }); }
  catch (e) { console.log('EXC', cat.lot, mirror, skinId, e.stack.split('\n').slice(0, 4).join(' | ')); bad++; continue; }
  const H = info.plan;
  // rooms must not overlap and must stay inside the interior; every room with `to` must have a door
  const errs = [];
  for (const fl of H.floors) {
    const seen = new Map();
    for (const r of fl.rooms) {
      if (r.u0 < 1 || r.v0 < 1 || r.u1 > H.w - 2 || r.v1 > H.d - 2) errs.push('outside ' + r.type);
      for (let v = r.v0 - 1; v <= r.v1; v++) for (let u = r.u0 - 1; u <= r.u1; u++) { const k = u + ',' + v; const inside = u >= r.u0 && v >= r.v0; if (inside) { if (seen.has(k)) errs.push('overlap ' + r.type + '/' + seen.get(k)); seen.set(k, r.type); } }
      if (r.to && !r.doors.some(dr => true)) errs.push('nodoor ' + r.type + '->' + r.to);
    }
    // rooms separated by exactly one wall: adjacent rooms touching directly (no wall) is an error
    for (const a of fl.rooms) for (const b of fl.rooms) if (a !== b) { if (a.u1 + 1 === b.u0 && !(a.v1 < b.v0 || b.v1 < a.v0)) errs.push('touch ' + a.type + '|' + b.type); if (a.v1 + 1 === b.v0 && !(a.u1 < b.u0 || b.u1 < a.u0)) errs.push('touch ' + a.type + '|' + b.type); }
  }
  const rooms = H.floors.map(f => f.rooms.map(r => r.type + (r.doors.length ? '' : '!')).join(',')).join(' | ');
  console.log(`${cat.lot.join('x')} ${H.family.padEnd(11)} ${skinId.padEnd(10)} ${mirror ? 'M' : ' '} ops ${String(rec.length / 4).padStart(6)} beds ${info.beds.length} seats ${String(info.seats.length).padStart(2)} work ${info.work.map(w => w[0]).join('/')} roof ${info.roofTop - 90} ${errs.length ? 'ERR ' + errs.slice(0, 6).join(', ') : ''}`);
  if (errs.length) bad++;
  if (mirror && skinId === cat.skins[0]) console.log('     rooms:', rooms);
}
const unk = [...unknown.entries()].map(([k, v]) => k + '×' + v).join(', ');
console.log('unknown blocks:', unk || 'none');
if (unk) bad++;   // a block name the registry does not know is a failure
console.log(bad ? 'FAILED ' + bad : 'ALL OK');
process.exit(bad ? 1 : 0);
