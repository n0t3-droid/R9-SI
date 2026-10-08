// The smooth props' anchors over several chunks of the vgen 7 town (t-smooth): every section of six chunks around the plot's
// middle gives one anchor per palm crown part p303 inside the section and one per bare trunk top; each anchor stands on its
// block (a crown part for a palm, the air above a trunk top for a bare trunk), in the section's own column. Props of other
// sections (the padding) are left to their own section.
//   bash test/wt_run.sh props_chunks.js
require('./load_shared.js');
require('../src/main/props.js');
const R = VR.R, PR = VR.Props;
let fails = 0; const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };

const PS = VR.MESH_PS || 20, PSS = PS * PS, PAD = VR.MESH_PAD || 2;
const at = (x, y, z) => (y + PAD) * PSS + (z + PAD) * PS + (x + PAD);
const g = new VR.OverworldGen(4242, { vgen: 7 });
const cols = {};
const getCol = (cx, cz) => { const k = cx + ',' + cz; if (!cols[k]) { const c = g.generate(cx, cz); c.light = VR.computeColumnLight(c.blocks, true); cols[k] = c; } return cols[k]; };
const trunk = R.byName.vx_palm_trunk.base, crown = R.byName.vm_palm_crown;
const crownStates = new Set([0, 1, 2, 3].map(f => R.S('vm_palm_crown', { part: 'p303', facing: f })));
const isPalm = (s) => s >= crown.base && s < crown.base + crown.nstates;
const CHUNKS = [[0, -8], [1, -8], [0, -9], [-1, -7], [1, -10], [-2, -8]];

let totalCrowns = 0;
for (const [CX, CZ] of CHUNKS) {
  let anchors = 0, kind1 = 0, kind2 = 0, crowns = 0, bare = 0, wrong = 0, offBlock = 0;
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
      else if (s === trunk && blocks[at(x, y + 1, z)] !== trunk && !isPalm(blocks[at(x, y + 1, z)])) bare++;
    }
    const job = { blocks, light, grass: new Uint16Array(PS * PS), foliage: new Uint16Array(PS * PS), water: new Uint16Array(PS * PS),
      sy, ox: CX * 16, oz: CZ * 16, smooth: true, fancyLeaves: true, vxLod: true, vxDetail: true, smoothProps: true };
    const list = VR.meshSection(job).props || new Int32Array(0);
    for (let i = 0; i < list.length; i += 6) {
      anchors++;
      const kind = list[i + 3], lx = list[i] - job.ox, ly = list[i + 1] - sy * 16, lz = list[i + 2] - job.oz;
      const inside = lx >= 0 && lx < 16 && ly >= 0 && ly < 16 && lz >= 0 && lz < 16;
      if (kind === PR.KIND.palm) {
        kind1++;
        if (!inside || !crownStates.has(blocks[at(lx, ly, lz)])) offBlock++;
      } else if (kind === PR.KIND.palm_trunk) {
        kind2++;
        if (!inside || blocks[at(lx, ly - 1, lz)] !== trunk || isPalm(blocks[at(lx, ly, lz)])) offBlock++;
      } else wrong++;
    }
  }
  console.log(`    chunk ${CX},${CZ}: ${crowns} crown parts p303, ${bare} bare trunk tops, ${anchors} anchors (${kind1} palm, ${kind2} palm_trunk)`);
  totalCrowns += crowns;
  check(kind1 === crowns, `chunk ${CX},${CZ}: one anchor per palm crown (${kind1} of ${crowns})`);
  check(kind2 === bare, `chunk ${CX},${CZ}: one anchor per bare trunk top (${kind2} of ${bare})`);
  check(wrong === 0 && offBlock === 0, `chunk ${CX},${CZ}: every anchor has a known kind and stands on its block (${wrong} unknown, ${offBlock} off)`);
}
check(totalCrowns >= 5, `the six chunks hold palm crowns to test (${totalCrowns})`);
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
