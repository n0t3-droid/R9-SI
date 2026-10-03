// dumps the furniture placed in one villa (SEL catalogue index, SKIN, MIRROR) room by room, as an ASCII floor map per storey
require('./load_shared.js');
const VG = VR.VillageGen, PLAN = VG.plan2, R = VR.R;
const SEL = +(process.env.SEL || 0), skinId = process.env.SKIN || null, mirror = process.env.MIRROR === '1';
const cat = PLAN.CATALOGUE[SEL]; const [w, d] = cat.lot;
const placed = new Map();   // "u,y,v" → name
const L = VG.makeLot(() => {}, 0, 0, 0); const P0 = L.P;
L.P = (u, y, v, name, pr) => { if (name) placed.set(u + ',' + y + ',' + v, { name, pr }); else placed.delete(u + ',' + y + ',' + v); return P0(u, y, v, name, pr); };
const info = PLAN.build(L, { w, d, F: 90, r: 0, ox: 0, oz: 0, kind: 'home' }, { rng: new VR.RNG(1234 + (mirror ? 7 : 0)), ground: () => 88, beds: 3, mirror, skin: skinId || cat.skins[0] });
const H = info.plan, SH = H.sh;
const sym = new Map(); let next = 0; const abc = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const code = (name) => { if (!sym.has(name)) sym.set(name, abc[next++ % abc.length]); return sym.get(name); };
for (const fl of H.floors) {
  const y = 90 + fl.y + 1; console.log('\n-- storey', H.floors.indexOf(fl), 'rooms:', fl.rooms.map(r => r.type + ' ' + r.u0 + '..' + r.u1 + '/' + r.v0 + '..' + r.v1).join(' | '));
  for (let v = 0; v < d; v++) { let line = ''; for (let u = 0; u < w; u++) { const p = placed.get(u + ',' + y + ',' + v); const q = placed.get(u + ',' + (y + 1) + ',' + v); line += p ? (p.name.startsWith('vm_') || p.name.startsWith('vx_') ? code(p.name) : '#') : q && (q.name.startsWith('vm_') || q.name.startsWith('vx_')) ? code(q.name).toUpperCase() === code(q.name) ? '+' : '^' : '.'; } console.log(line); }
}
console.log('\nlegend:', [...sym.entries()].map(([n, c]) => c + '=' + n.replace(/^v[mx]_/, '')).join('  '));
