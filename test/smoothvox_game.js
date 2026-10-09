// Glatt-Modelle in the game (t-form): the path from a placed model piece to its surface-nets mesh in the furniture pass.
//   1. the eligible pieces: every VM model without a hand-built mesh, no joiners, no plants pack; a switch has a second
//      entry for its dark look; the list is the registry's (the same in every thread)
//   2. a section with a sideboard, a lit and a switched-off lamp and a hand-built sofa, „Glatte Möbel" on, nothing ready:
//      the mesher draws the pieces' voxels (the output is exactly the one without smoothvox.js), the sofa is an anchor,
//      the section wants the sideboard and both lamp looks
//   3. the main thread asks the pool (a fake one: the job runs here as a worker would), registers the meshes in props.js,
//      sets the ready bits and makes the waiting section dirty
//   4. the section meshed again with the job's ready bits: one anchor per piece (part 0, its facing, its kind), their voxels
//      gone, no more wants; the anchor's centre and turn are props.js furnPlace's, the mesh is the registered one
//   5. Very Low (no smooth furniture): the mesh output is byte for byte the one without smoothvox.js
//   6. a design changed in the Studio (custom.js refreshModel): the model is not ready any more, asked again as version 1
//   bash test/wt_run.sh smoothvox_game.js 300
require('./load_shared.js');
require('../src/shared/smoothvox.js');
require('../src/main/props.js');
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const SV = VR.SmoothVox, VM = VR.VM, R = VR.R, PR = VR.Props;
let fails = 0; const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };

// ---------------------------------------------------------------- 1. the list
console.log('1. the eligible pieces');
const A = SV.autoTables();
const names = new Set(A.list.map(e => e.name));
const furn = new Set(VR.PROP_FURN);
check(A.n > 250, `${names.size} models (${A.n} entries with the switched-off looks) get a smooth mesh`);
check([...names].every(n => !furn.has(n)), 'no piece with a hand-built mesh is in the list (hand-built meshes win)');
check(![...names].some(n => /^vm_(win_|gutter|downpipe|garage_door|nova_tread|palm_crown|tree_round|tuft_grass)/.test(n)), 'no joiner (windows, gutters, downpipes, the garage door, the Nova tread) and no plants-pack piece');
check(['vm_sideboard', 'vm_piano', 'vm_fridge', 'vm_curtain', 'vm_nova_pad', 'vm_living_sofa3_sage'].every(n => names.has(n)), 'the sideboard, the piano, the fridge, the curtain, the Nova pad, the Modern Living sofa are in it');
const lampName = A.list.find(e => e.off).name;
check(SV.indexOf(lampName, true) === SV.indexOf(lampName, false) + 1, `a switch has two entries, lit and dark (${lampName})`);
check(SV.AUTO0 === PR.AUTO0 && SV.AUTO0 > 255, 'the auto kinds start at ' + SV.AUTO0 + ' in both files');

// ---------------------------------------------------------------- the section
const PS = VR.MESH_PS || 20, PSS = PS * PS, PAD = VR.MESH_PAD || 2;
const at = (x, y, z) => (y + PAD) * PSS + (z + PAD) * PS + (x + PAD);
function section() {
  const blocks = new Uint16Array(PS * PS * PS), light = new Uint16Array(PS * PS * PS).fill(0xF000);
  const S = (n, pr) => R.byName[n].state(pr);
  for (let z = -PAD; z < 16 + PAD; z++) for (let x = -PAD; x < 16 + PAD; x++) blocks[at(x, 0, z)] = S('stone');
  const put = (name, x, y, z, f, extra) => VM.put((xx, yy, zz, nm, pr) => { blocks[at(xx, yy, zz)] = S(nm, pr); }, x, y, z, name, f, extra);
  put('vm_sideboard', 3, 1, 4, 1);                     // 3 × 1 × 1, turned a quarter (it runs along z)
  put(lampName, 8, 1, 3, 0, { lit: 1 }); put(lampName, 10, 1, 3, 0, { lit: 0 });
  put('vm_sofa_cream', 6, 1, 10, 2);                   // hand-built (round I)
  return { blocks, light, grass: new Uint16Array(PSS), foliage: new Uint16Array(PSS), water: new Uint16Array(PSS), sy: 4, ox: 32, oz: 48, smooth: true, fancyLeaves: true, vxLod: true, vxDetail: true, smoothProps: 2 };
}
const hashOf = (r) => { const h = crypto.createHash('sha1'); for (const k of ['opaque', 'cutout', 'trans', 'vx', 'vxFar', 'props']) { const a = r[k]; h.update(k + (a ? a.length : -1)); if (a) h.update(Buffer.from(a.buffer, a.byteOffset, a.byteLength)); } return h.digest('hex').slice(0, 16); };
// the same section meshed in a node without smoothvox.js (the reference: the mesher as it was)
function reference(smoothProps) {
  const src = `require(${JSON.stringify(__dirname + '/load_shared.js')}); const S = VR.MESH_PS || 20, PSS = S * S, P = VR.MESH_PAD || 2;` +
    `const job = JSON.parse(process.argv[1]); for (const k of ['blocks', 'light']) job[k] = Uint16Array.from(job[k]); for (const k of ['grass', 'foliage', 'water']) job[k] = new Uint16Array(PSS);` +
    `const r = VR.meshSection(job); const h = require('crypto').createHash('sha1'); for (const k of ['opaque', 'cutout', 'trans', 'vx', 'vxFar', 'props']) { const a = r[k]; h.update(k + (a ? a.length : -1)); if (a) h.update(Buffer.from(a.buffer, a.byteOffset, a.byteLength)); } console.log(h.digest('hex').slice(0, 16));`;
  const j = section(); j.smoothProps = smoothProps;
  return execFileSync(process.execPath, ['-e', src, JSON.stringify(Object.assign({}, j, { blocks: Array.from(j.blocks), light: Array.from(j.light), grass: null, foliage: null, water: null }))], { encoding: 'utf8', maxBuffer: 1 << 26 }).trim();
}
const kindsIn = (props) => { const out = []; for (let i = 0; props && i < props.length; i += 6) out.push({ x: props[i], y: props[i + 1], z: props[i + 2], kind: props[i + 3], f: props[i + 4] }); return out; };

// ---------------------------------------------------------------- 2. nothing ready
console.log('2. nothing ready yet');
const job0 = section();
SV.tagJob(job0);
check(job0.svReady && job0.svReady.bits && job0.svReady.bits.length === Math.ceil(A.n / 8), 'the job carries the ready bits (' + (job0.svReady ? job0.svReady.bits.length : 0) + ' bytes)');
const w0 = SV.prep(structuredClone(job0));
const r0 = VR.meshSection(job0), k0 = kindsIn(r0.props);
const iSide = SV.indexOf('vm_sideboard', false), iLit = SV.indexOf(lampName, false), iOff = SV.indexOf(lampName, true);
check(w0 && w0.includes(iSide) && w0.includes(iLit) && w0.includes(iOff) && w0.length === 3, `the section wants the sideboard and both lamp looks (${JSON.stringify(w0)})`);
check(!k0.some(a => a.kind >= SV.AUTO0), 'no smooth anchor before the meshes are there');
check(k0.some(a => a.kind === PR.FURN0 + VR.PROP_FURN.indexOf('vm_sofa_cream')), 'the hand-built sofa is an anchor as before');
const ref2 = reference(2);
check(hashOf(r0) === ref2, `the mesh is the one without smoothvox.js: the pieces keep their voxel look (${hashOf(r0)} = ${ref2})`);

// ---------------------------------------------------------------- 3. the main thread asks, registers, marks dirty
console.log('3. ask, register, mark dirty');
const asked = [];
const sec = { dirty: false, ver: 3 }, col = { key: 777, sec: [] }; col.sec[4] = sec;
const world = { pool: { submit: (msg, tr, cb, prio) => asked.push({ msg, cb, prio }) }, cols: new Map([[777, col]]), dead: false };
SV.want(w0, world, col, 4);
SV.want(w0, world, col, 4);   // a second answer with the same wants asks nothing more
check(asked.length === 3 && asked.every(a => a.msg.type === 'smoothvox'), `three jobs asked once each (${asked.map(a => a.msg.name + (a.msg.off ? ':off' : '')).join(', ')})`);
let jobMs = 0;
for (const a of asked) {
  const t0 = Date.now(); const r = SV.job(structuredClone(a.msg)); jobMs += Date.now() - t0;
  const tr = r.transfer; delete r.transfer; r.type = 'smoothvox';
  check(tr.length >= 4 && r.near && r.near.verts instanceof Float32Array, `${a.msg.name}${a.msg.off ? ' (dark)' : ''}: ${r.near.nv} vertices, ${r.near.nt} triangles, ${tr.length} buffers to transfer, ${r.ms.toFixed(1)} ms`);
  a.cb(structuredClone(r));
}
check(SV.isReady(SV.ready.bits, iSide) && SV.isReady(SV.ready.bits, iLit) && SV.isReady(SV.ready.bits, iOff), 'their ready bits are set');
check(sec.dirty && sec.ver === 4 + 2, `the waiting section is dirty again (ver ${sec.ver})`);
check(PR.AUTO[SV.AUTO0 + iSide] && PR.furnModel(PR.AUTO[SV.AUTO0 + iSide].model).near.nv > 0, 'props.js knows the sideboard\'s kind and holds its mesh');
// a cache hit: the same model again comes from the worker's LRU
const again = SV.job({ type: 'smoothvox', name: 'vm_sideboard', off: false, ver: 0 }); delete again.transfer;
check(again.ms < 5 && SV.cache.map.size >= 3, `the worker keeps the meshes (a second ask: ${again.ms.toFixed(2)} ms, ${SV.cache.map.size} in the cache)`);

// ---------------------------------------------------------------- 4. meshed again, ready
console.log('4. meshed again with the ready bits');
const job1 = section(); SV.tagJob(job1);
const j1 = structuredClone(job1);   // (what the worker receives)
const w1 = SV.prep(j1);
const r1 = VR.meshSection(j1), k1 = kindsIn(r1.props);
const autos = k1.filter(a => a.kind >= SV.AUTO0);
check(!w1, 'no more wants');
const side = autos.find(a => a.kind === SV.AUTO0 + iSide), lit = autos.find(a => a.kind === SV.AUTO0 + iLit), dark = autos.find(a => a.kind === SV.AUTO0 + iOff);
check(autos.length === 3 && side && lit && dark, `one anchor per piece (${autos.length}: sideboard, lit lamp, dark lamp)`);
check(side && side.x === 32 + 3 && side.y === 64 + 1 && side.z === 48 + 4 && (side.f & 3) === 1, `the sideboard's anchor is its part 0 with its facing (${side && [side.x, side.y, side.z, side.f].join(',')})`);
check(r1.vx.length < r0.vx.length, `their voxels are gone from the detail stream (${r0.vx.length / 8} → ${r1.vx.length / 8} vertices)`);
check(k1.some(a => a.kind === PR.FURN0 + VR.PROP_FURN.indexOf('vm_sofa_cream')), 'the hand-built sofa is still its own anchor');
// the anchor's placement: props.js anchorData = furnPlace with the model's size and part 0's cell
if (side) {
  const out = new Float64Array(12); PR.anchorData(side.kind, side.x, side.y, side.z, 0xF000, out, 0, side.f);
  const P = [0, 0, 0, 0]; PR.furnPlace([3, 1, 1], side.x, side.y, side.z, side.f, P, [0, 0]);
  const fp = VM.footprint(VM.MODELS.vm_sideboard, 1); let mx = 0, mz = 0; for (const [dx, , dz] of fp) { mx += side.x + dx + 0.5; mz += side.z + dz + 0.5; } mx /= fp.length; mz /= fp.length;
  check(Math.abs(out[0] - mx) < 1e-9 && Math.abs(out[2] - mz) < 1e-9 && Math.abs(out[3] - Math.PI / 2) < 1e-9, `the instance stands on the centre of the sideboard's cells (${out[0]}, ${out[2]}), turned a quarter`);
  check(PR.furnKey(side.kind, side.f) === PR.AUTO[side.kind].model, 'furnKey finds its model (' + PR.furnKey(side.kind, side.f) + ')');
}
// the lamp's two looks: the dark one has no glowing vertex
if (lit && dark) { const glow = (k) => { const m = PR.furnModel(PR.furnKey(k, 0)).near; let n = 0; for (let i = 0; i < m.nv; i++) if (m.verts[i * 14 + 11] === SV.MAT.light) n++; return n; }; check(glow(lit.kind) > 0 && glow(dark.kind) === 0, `the lit lamp glows (${glow(lit.kind)} vertices), the dark one does not (${glow(dark.kind)})`); }

// ---------------------------------------------------------------- 5. Very Low
console.log('5. Very Low (no smooth furniture)');
const jp = section(); jp.smoothProps = 0; SV.tagJob(jp);
check(!jp.svReady, 'a Very Low job carries nothing');
check(SV.prep(jp) === null, 'and prepares nothing');
const rp = VR.meshSection(jp), ref0 = reference(0);
check(hashOf(rp) === ref0, `its mesh is byte for byte the one without smoothvox.js (${hashOf(rp)} = ${ref0})`);

// ---------------------------------------------------------------- 6. a design changed
console.log('6. a design changed');
const v0 = SV.verOf('vm_sideboard');
VR.Custom.refreshModel(VM.MODELS.vm_sideboard);
check(!SV.isReady(SV.ready.bits, iSide) && SV.verOf('vm_sideboard') === v0 + 1, 'the sideboard is not ready any more, its next mesh is version ' + SV.verOf('vm_sideboard'));
const job2 = section(); SV.tagJob(job2); const j2 = structuredClone(job2); const w2 = SV.prep(j2); const r2 = VR.meshSection(j2);
check(w2 && w2.includes(iSide) && !kindsIn(r2.props).some(a => a.kind === SV.AUTO0 + iSide), 'the section draws its voxels again and wants the new version');
asked.length = 0; SV.want(w2, world, col, 4);
check(asked.length === 1 && asked[0].msg.name === 'vm_sideboard' && asked[0].msg.ver === v0 + 1, 'it is asked for again as version ' + (asked[0] ? asked[0].msg.ver : '?'));
// an answer of the old version is not taken
asked[0].cb(Object.assign({ type: 'smoothvox', ver: v0 }, (() => { const r = SV.job({ name: 'vm_sideboard', ver: v0 }); delete r.transfer; return r; })()));
check(!SV.isReady(SV.ready.bits, iSide), 'an answer for the old design is not taken');

console.log(`    the three worker jobs took ${jobMs} ms`);
console.log(fails ? `FAILED ${fails}` : 'ALL OK');
process.exit(fails ? 1 : 0);
