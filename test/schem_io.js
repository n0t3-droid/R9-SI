// v0.35 files: a piece with stairs, a door, logs, Vollton → .schem → back (every state the same); → .vox → back (colours);
// → .json → back; a vanilla structure .nbt and a litematic made by hand read right; zip structure sane.
require('./load_shared.js');
require('../src/shared/schem.js');
const R = VR.R, SC = VR.Schem, KEEP = SC.KEEP;
let fails = 0; const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const st = (n, p) => { const t = R.byName[n]; return p ? t.state(Object.assign(t.decode(t.defaultState), p)) : t.defaultState; };
const nm = (s) => s === KEEP ? 'keep' : s ? R.types[R.T.type[s]].name + JSON.stringify(R.types[R.T.type[s]].decode(s)) : 'air';
(async () => {
  const g = { sx: 4, sy: 3, sz: 2, blocks: new Uint16Array(24) };
  const put = (x, y, z, s) => { g.blocks[(y * g.sz + z) * g.sx + x] = s; };
  put(0, 0, 0, st('oak_stairs', { facing: 1, half: 1 })); put(1, 0, 0, st('oak_door', { facing: 2, half: 0, hinge: 1 })); put(1, 1, 0, st('oak_door', { facing: 2, half: 1, hinge: 1 }));
  put(2, 0, 0, st('oak_log', { axis: 1 })); put(3, 0, 1, st('vollton_coral')); put(0, 2, 1, st('glass')); put(3, 2, 1, st('oak_slab', { type: 1 }));
  // .schem
  const bytes = await SC.writeSchem(g, 'Test');
  check(SC.isGzip(bytes), '.schem is gzipped NBT (' + bytes.length + ' bytes)');
  const back = await SC.read('t.schem', bytes);
  let same = back.sx === 4 && back.sy === 3 && back.sz === 2; const diffs = [];
  for (let i = 0; i < 24; i++) if (back.blocks[i] !== g.blocks[i]) { same = false; diffs.push(nm(g.blocks[i]) + ' → ' + nm(back.blocks[i])); }
  check(same, '.schem round trip keeps every block and its turn' + (diffs.length ? ': ' + diffs.slice(0, 3).join(' | ') : ''));
  check(Object.keys(back.unknown).length === 0, 'no unknown blocks');
  const ids = [SC.toId(st('oak_stairs', { facing: 1, half: 1 })), SC.toId(st('oak_door', { facing: 2, half: 1, hinge: 1, open: 1 })), SC.toId(st('vollton_coral'))];
  console.log('    ids', JSON.stringify(ids));
  check(/^minecraft:oak_stairs\[facing=east,half=top\]$/.test(ids[0]) && /half=upper/.test(ids[1]) && /open=true/.test(ids[1]) && /^r9si:vollton_coral$/.test(ids[2]), 'Minecraft names out (door upper/true), R9 blocks as r9si:');
  // a vanilla structure file
  const N = SC.nbt;
  const sn = SC.nbtWrite('', N.comp({ DataVersion: N.int(3465), size: N.list(3, [N.int(2), N.int(1), N.int(1)]), palette: N.list(10, [N.comp({ Name: N.str('minecraft:spruce_stairs'), Properties: N.comp({ facing: N.str('west'), half: N.str('bottom'), shape: N.str('straight'), waterlogged: N.str('false') }) }), N.comp({ Name: N.str('minecraft:mystery_block') })]), blocks: N.list(10, [N.comp({ pos: N.list(3, [N.int(0), N.int(0), N.int(0)]), state: N.int(0) }), N.comp({ pos: N.list(3, [N.int(1), N.int(0), N.int(0)]), state: N.int(1) })]) }));
  const s2 = await SC.read('t.nbt', await SC.gzip(sn));
  check(nm(s2.blocks[0]) === nm(st('spruce_stairs', { facing: 3, half: 0 })) && s2.unknown['minecraft:mystery_block'] === 1, 'a vanilla structure .nbt reads (stairs facing west), unknown blocks are counted');
  // a litematic with 3 palette entries (2 bits per cell), 3×1×1
  const longs = new BigInt64Array(1); longs[0] = BigInt(0 | (1 << 2) | (2 << 4));
  const lit = SC.nbtWrite('', N.comp({ Regions: N.comp({ r: N.comp({ Position: N.comp({ x: N.int(0), y: N.int(0), z: N.int(0) }), Size: N.comp({ x: N.int(3), y: N.int(1), z: N.int(1) }), BlockStatePalette: N.list(10, [N.comp({ Name: N.str('minecraft:air') }), N.comp({ Name: N.str('minecraft:stone') }), N.comp({ Name: N.str('minecraft:oak_planks') })]), BlockStates: { t: 12, v: longs } }) }) }));
  let litOk = true; try { const l = await SC.read('t.litematic', lit); litOk = nm(l.blocks[0]) === 'air' && /^stone/.test(nm(l.blocks[1])) && /^oak_planks/.test(nm(l.blocks[2])); } catch (e) { litOk = false; console.log('    litematic:', e.message); }
  check(litOk, 'a litematic reads (packed block states)');
  // .vox: colours of known blocks out and back
  const colors = new Map([[st('vollton_coral'), [230, 90, 80]], [st('oak_planks'), [160, 120, 70]], [st('glass'), [200, 230, 240]]]);
  const vg = { sx: 3, sy: 2, sz: 2, blocks: new Uint16Array(12) }; vg.blocks[0] = st('vollton_coral'); vg.blocks[5] = st('oak_planks'); vg.blocks[11] = st('glass');
  const vox = SC.writeVox(vg, (s) => colors.get(s) || [128, 128, 128]);
  const vb = await SC.read('t.vox', vox, (r, gg, b) => { for (const [s, c] of colors) if (c[0] === r && c[1] === gg && c[2] === b) return s; return st('stone'); });
  let vsame = vb.sx === 3 && vb.sy === 2 && vb.sz === 2; for (let i = 0; i < 12; i++) if ((vb.blocks[i] === KEEP ? 0 : vb.blocks[i]) !== vg.blocks[i]) vsame = false;
  check(vsame, '.vox round trip (colours → the same blocks, same places)');
  // json
  const j = SC.toJSON(g, 'X'), jb = await SC.read('x.json', new TextEncoder().encode(JSON.stringify(j)));
  let jsame = true; for (let i = 0; i < 24; i++) if (jb.blocks[i] !== g.blocks[i]) jsame = false;
  check(jsame && jb.name === 'X', '.json (Bauteil) round trip');
  // zip
  const z = SC.zip([{ name: 'a.schem', data: bytes }, { name: 'a.vox', data: vox }]);
  check(new DataView(z.buffer).getUint32(0, true) === 0x04034b50 && new DataView(z.buffer).getUint32(z.length - 22, true) === 0x06054b50, 'zip has local headers and the end record');
  console.log(fails ? `FAILED ${fails}` : 'ALL OK');
  process.exit(fails ? 1 : 0);
})();
