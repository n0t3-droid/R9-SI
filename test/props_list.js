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

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
