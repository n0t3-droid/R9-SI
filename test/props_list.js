// The smooth props' anchor list (t-smooth): the mesher hands over one anchor per prop instance when the job asks for smooth
// props — one per palm crown (the crown's bottom centre part, p303), one for a bare trunk top — and gives the prop blocks
// no voxel geometry; without the option the list does not exist and the voxel palm is meshed as before.
//   bash test/wt_run.sh props_list.js
require('./load_shared.js');
require('../src/main/props.js');
const R = VR.R, P = VR.Plants, PR = VR.Props, VM = VR.VM;
let fails = 0; const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };

// a 20³ padded section (16 + 2 on each side), the palm built in its middle by the same P.palm the generator uses
const PS = VR.MESH_PS || 20, PSS = PS * PS, PAD = VR.MESH_PAD || 2;
const at = (x, y, z) => (y + PAD) * PSS + (z + PAD) * PS + (x + PAD);
function section(place, smoothProps) {
  const blocks = new Uint16Array(PS * PS * PS), light = new Uint16Array(PS * PS * PS).fill(0xF000);
  const put = (x, y, z, s) => { blocks[at(x, y, z)] = s; };
  place(put);
  const job = { blocks, light, grass: new Uint16Array(PS * PS), foliage: new Uint16Array(PS * PS), water: new Uint16Array(PS * PS),
    sy: 0, ox: 0, oz: 0, smooth: true, fancyLeaves: true, vxLod: true, vxDetail: true };
  if (smoothProps !== undefined) job.smoothProps = smoothProps;
  return job;
}
const streamsOf = (r) => ['opaque', 'cutout', 'trans', 'vx', 'vxFar'].map(k => (r[k] ? r[k].length : 0));

// 1. a palm of trunk 4 and its crown: one crown anchor, no trunk anchor, the palm's blocks give no voxel quads
{
  const place = (put) => P.palm(put, 8, 2, 8, 4);
  const off = VR.meshSection(section(place));
  check(off.props === undefined, 'without the option the mesher writes no prop list');
  const on = VR.meshSection(section(place, true));
  check(on.props instanceof Int32Array, 'with the option the mesher writes a prop list');
  const n = on.props ? on.props.length / 6 : 0;
  check(n === 1, 'one palm, one anchor (' + n + ')');
  const a = on.props ? Array.from(on.props.slice(0, 6)) : [];
  // the crown's bottom centre is the block above the trunk top: world (8, 6, 8), kind 1 (palm), facing 0, full sky light
  check(a[0] === 8 && a[1] === 6 && a[2] === 8, 'the anchor sits on the crown centre (' + a.slice(0, 3).join(',') + ')');
  check(a[3] === PR.KIND.palm && a[4] === 0 && a[5] === 0xF000, 'the anchor is a palm with the light of its block (kind ' + a[3] + ', light 0x' + (a[5] || 0).toString(16) + ')');
  const sOff = streamsOf(off), sOn = streamsOf(on);
  check(sOff.some(x => x > 0), 'the voxel palm has geometry without the option (' + sOff.join('/') + ')');
  check(sOn.every(x => x === 0), 'the smooth palm has no voxel geometry (' + sOn.join('/') + ')');
}

// 2. a bare trunk (no crown above it): the air above its top is the anchor of kind 2 (palm_trunk); a stack of three gives one
{
  const place = (put) => { for (let y = 3; y < 6; y++) put(8, y, 8, R.S('vx_palm_trunk')); };
  const r = VR.meshSection(section(place, true));
  const n = r.props ? r.props.length / 6 : -1;
  check(n === 1, 'a bare trunk stack has one anchor (' + n + ')');
  const a = r.props ? Array.from(r.props.slice(0, 6)) : [];
  check(a[0] === 8 && a[1] === 6 && a[2] === 8 && a[3] === PR.KIND.palm_trunk, 'the trunk anchor is the air above the top, kind palm_trunk (' + a.slice(0, 4).join(',') + ')');
  check(streamsOf(r).every(x => x === 0), 'a bare trunk gives no voxel geometry with the option');
}

// 3. a palm trunk top that stands on the next section's floor: the top row is an anchor only when no crown is above
{
  const place = (put) => { for (let y = 10; y < 16; y++) put(4, y, 4, R.S('vx_palm_trunk')); put(4, 15 + 1, 4, R.S('vm_palm_crown', { part: 'p303', facing: 0 })); };
  const r = VR.meshSection(section(place, true));
  const kinds = r.props ? Array.from({ length: r.props.length / 6 }, (_, i) => r.props[i * 6 + 3]) : [];
  check(kinds.length === 0, 'a trunk with its crown in the padding above the section gives no trunk anchor (' + kinds.join(',') + ')');
}

// 4. the Nova Haven plot (vgen 7, seed 4242): the centre chunk's sections give one crown anchor per crown part p303 and one
// anchor per bare trunk top (none here: every trunk has its crown); the anchors are counted from the section's own blocks
{
  const g = new VR.OverworldGen(4242, { vgen: 7 });
  const cols = {};
  const getCol = (cx, cz) => { const k = cx + ',' + cz; if (!cols[k]) { const c = g.generate(cx, cz); c.light = VR.computeColumnLight(c.blocks, true); cols[k] = c; } return cols[k]; };
  const CX = 0, CZ = -8;   // the middle of the plot
  const crownStates = new Set([0, 1, 2, 3].map(f => R.S('vm_palm_crown', { part: 'p303', facing: f })));
  const trunk = R.byName.vx_palm_trunk.base, crown = R.byName.vm_palm_crown, isPalm = (s) => s >= crown.base && s < crown.base + crown.nstates;
  let anchors = 0, kind1 = 0, kind2 = 0, crowns = 0, bare = 0, wrong = 0;
  for (let sy = 0; sy < 16; sy++) {
    const blocks = new Uint16Array(PS * PS * PS), light = new Uint16Array(PS * PS * PS);
    for (let y = -PAD; y < 16 + PAD; y++) for (let z = -PAD; z < 16 + PAD; z++) for (let x = -PAD; x < 16 + PAD; x++) {
      const wy = sy * 16 + y, cx = CX + Math.floor(x / 16), cz = CZ + Math.floor(z / 16);
      const lx = ((x % 16) + 16) % 16, lz = ((z % 16) + 16) % 16, pi = at(x, y, z);
      if (wy < 0 || wy > 255) { light[pi] = wy > 255 ? 0xF000 : 0; continue; }
      const c = getCol(cx, cz), i = (wy << 8) | (lz << 4) | lx;
      blocks[pi] = c.blocks[i]; light[pi] = c.light[i];
    }
    for (let y = 0; y < 16; y++) for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const s = blocks[at(x, y, z)];
      if (crownStates.has(s)) crowns++;
      else if (s === trunk && blocks[at(x, y + 1, z)] !== trunk && !isPalm(blocks[at(x, y + 1, z)])) bare++;   // a trunk top with no palm above
    }
    const job = { blocks, light, grass: new Uint16Array(PS * PS), foliage: new Uint16Array(PS * PS), water: new Uint16Array(PS * PS), sy, ox: CX * 16, oz: CZ * 16, smooth: true, fancyLeaves: true, vxLod: true, vxDetail: true, smoothProps: true };
    const list = VR.meshSection(job).props || new Int32Array(0);
    for (let i = 0; i < list.length; i += 6) { anchors++; if (list[i + 3] === PR.KIND.palm) kind1++; else if (list[i + 3] === PR.KIND.palm_trunk) kind2++; else wrong++; }
  }
  console.log('    the centre chunk of the plot: ' + crowns + ' crown parts p303, ' + bare + ' bare trunk tops, ' + anchors + ' anchors (' + kind1 + ' palm, ' + kind2 + ' palm_trunk)');
  check(crowns >= 1, 'the centre chunk of the plot has palms (' + crowns + ' crowns)');
  check(kind1 === crowns, 'one anchor per palm crown (' + kind1 + ' of ' + crowns + ')');
  check(kind2 === bare, 'one anchor per bare trunk top (' + kind2 + ' of ' + bare + ')');
  check(wrong === 0, 'every anchor has a known kind');
}

// 5. the furniture (job.smoothProps is a mask: 1 the plants, 2 the furniture, true = the plants): a sofa, a bed, a lamp
// and a dining chair placed by VM.put give one anchor each (their part 0, with its facing and light) and no voxel
// geometry when the mask asks for the furniture; with the plants alone they are meshed as before
{
  const G = VR.PROP_GROUP || { plants: 1, furniture: 2 };
  const L = [['vm_sofa_navy', 2, 1, 3, 2], ['vm_bed_grey', 9, 1, 3, 1], ['vm_floor_lamp', 13, 1, 12, 0], ['vm_dining_chair_oak', 4, 1, 10, 3]];
  const place = (put) => { for (const [nm, x, y, z, f] of L) VM.put((xx, yy, zz, n2, pr) => put(xx, yy, zz, R.S(n2, pr)), x, y, z, nm, f); };
  const plantsOnly = VR.meshSection(section(place, G.plants)), legacy = VR.meshSection(section(place, true)), none = VR.meshSection(section(place));
  const furn = VR.meshSection(section(place, G.furniture)), both = VR.meshSection(section(place, G.plants | G.furniture));
  const geo = (r) => streamsOf(r).reduce((a, b) => a + b, 0);
  check(geo(plantsOnly) > 0 && geo(plantsOnly) === geo(none) && geo(legacy) === geo(none), 'with the plants alone (or true) the furniture is meshed as voxels, as without the option (' + geo(none) + ' words)');
  check(plantsOnly.props && plantsOnly.props.length === 0, 'and gives no furniture anchors');
  check(geo(furn) === 0 && geo(both) === 0, 'with the furniture asked for, the pieces give no voxel geometry');
  const n = furn.props ? furn.props.length / 6 : 0;
  check(n === L.length, 'one anchor per piece (' + n + ' of ' + L.length + ')');
  let ok = 0;
  for (const [nm, x, y, z, f] of L) {
    const kind = VR.PROP_FURN0 + VR.PROP_FURN.indexOf(nm);
    for (let i = 0; i < n; i++) { const a = furn.props.slice(i * 6, i * 6 + 6); if (a[0] === x && a[1] === y && a[2] === z && a[3] === kind && a[4] === f && a[5] === 0xF000) ok++; }
  }
  check(ok === L.length, 'each anchor is the piece\'s part 0 with its kind, its facing and its light (' + ok + ' of ' + L.length + ')');
  check(both.props && both.props.length === furn.props.length, 'plants and furniture together give the same furniture anchors');
}

// 6. the villages' pieces: a row of three white sofas facing north joins (the row bits on each anchor's facing), a bed
// gives one anchor at its foot (part 0)
{
  const place = (put) => { for (const x of [4, 5, 6]) put(x, 1, 8, R.S('vx_sofa_white', { facing: 0 })); put(10, 1, 6, R.S('vx_bed_blue', { facing: 0, part: 0 })); put(10, 1, 5, R.S('vx_bed_blue', { facing: 0, part: 1 })); };
  const r = VR.meshSection(section(place, (VR.PROP_GROUP || {}).furniture || 2));
  const L = r.props ? Array.from({ length: r.props.length / 6 }, (_, i) => Array.from(r.props.slice(i * 6, i * 6 + 6))) : [];
  const sofa = VR.PROP_FURN0 + VR.PROP_FURN.indexOf('vx_sofa_white'), bed = VR.PROP_FURN0 + VR.PROP_FURN.indexOf('vx_bed_blue');
  const at = (x) => (L.find(a => a[3] === sofa && a[0] === x) || [])[4];
  check(at(4) === 4 && at(5) === 12 && at(6) === 8, 'the sofa row: the west end joins east (bit 2), the middle both ways, the east end west (' + [at(4), at(5), at(6)].join(',') + ')');
  const beds = L.filter(a => a[3] === bed);
  check(beds.length === 1 && beds[0][0] === 10 && beds[0][2] === 6, 'the bed gives one anchor, at its foot (' + beds.map(a => a.slice(0, 3).join(',')).join(' ') + ')');
  check(streamsOf(r).every(x => x === 0), 'the village pieces give no voxel geometry with the furniture asked for');
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
