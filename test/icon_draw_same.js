// The voxel icons' drawing (Icons.drawVoxels, src/main/icons.js) makes the same canvas calls, with the same numbers, in the
// same order, as the version it replaced (iconperf: no array per voxel any more). A picture is its canvas calls, so equal calls
// mean equal pixels. refDrawVoxels below is the earlier version, kept as the reference; every voxel item of the registry
// (the Modern Living pack and the older voxel blocks) is checked.
require('./load_shared.js');
require('/home/claude/vr/src/main/icons.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };

// the reference: the drawing as it was before the rewrite
function refDrawVoxels(ctx, s) {
  const G = VR.VX.iconGrid(s);
  if (!G) return;
  const P = VR.VX.PRESENT, E = VR.VX.EMIS, GL = VR.VX.GLASS;
  const at = (x, y, z) => (x < 0 || y < 0 || z < 0 || x > 7 || y > 7 || z > 7) ? 0 : G[(y * 8 + z) * 8 + x];
  const open = (v) => !(v & P) || (v & GL);
  const S = (X, Y, Z) => [32 + 28 * (X - Z) / 8, 3 + 14 * (X + Z) / 8 + 29 * (1 - Y / 8)];
  const order = [];
  for (let y = 0; y < 8; y++) for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) if (at(x, y, z) & P) order.push([x + y + z, x, y, z]);
  order.sort((a, b) => a[0] - b[0]);
  const poly = (pts, col) => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath(); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = 0.6; ctx.fill(); ctx.stroke(); };
  const rgb = (v, k) => { const e = (v & E) ? 1.25 : 1; return `rgb(${Math.min(255, ((v >> 16) & 255) * k * e) | 0},${Math.min(255, ((v >> 8) & 255) * k * e) | 0},${Math.min(255, (v & 255) * k * e) | 0})`; };
  for (const [, x, y, z] of order) {
    const v = at(x, y, z);
    const glass = (v & GL) !== 0;
    const col = (k) => glass ? `rgba(190,230,255,${0.35 + k * 0.2})` : rgb(v, k);
    if (open(at(x, y + 1, z)) || (glass && !(at(x, y + 1, z) & GL))) poly([S(x, y + 1, z), S(x + 1, y + 1, z), S(x + 1, y + 1, z + 1), S(x, y + 1, z + 1)], col(1));
    if (open(at(x, y, z + 1)) || (glass && !(at(x, y, z + 1) & GL))) poly([S(x, y, z + 1), S(x + 1, y, z + 1), S(x + 1, y + 1, z + 1), S(x, y + 1, z + 1)], col(0.8));
    if (open(at(x + 1, y, z)) || (glass && !(at(x + 1, y, z) & GL))) poly([S(x + 1, y, z), S(x + 1, y, z + 1), S(x + 1, y + 1, z + 1), S(x + 1, y + 1, z)], col(0.64));
  }
}

// a fake 2-D context that writes down every call and every property it is given
function recorder() {
  const log = [], ctx = {};
  for (const k of ['fillStyle', 'strokeStyle', 'lineWidth']) Object.defineProperty(ctx, k, { set(v) { log.push(k + '=' + v); }, get() { return undefined; } });
  ctx.beginPath = () => { log.push('beginPath'); };
  ctx.moveTo = (x, y) => { log.push('moveTo ' + x + ' ' + y); };
  ctx.lineTo = (x, y) => { log.push('lineTo ' + x + ' ' + y); };
  ctx.closePath = () => { log.push('closePath'); };
  ctx.fill = () => { log.push('fill'); };
  ctx.stroke = () => { log.push('stroke'); };
  return { ctx, log };
}

{
  const T = VR.R.T, SH = VR.SHAPE;
  const states = [...new Set(VR.R.types.filter(t => t && t.defaultState !== undefined && T.shape[t.defaultState] === SH.VOXEL).map(t => t.defaultState))];
  const pack = VR.R.types.filter(t => t.o && t.o.modern).map(t => t.defaultState);
  let calls = 0, same = 0, packSame = 0;
  for (const s of states) {
    const a = recorder(), b = recorder();
    refDrawVoxels(a.ctx, s);
    VR.Icons.prototype.drawVoxels.call(null, b.ctx, s);
    calls += a.log.length;
    if (a.log.join('\n') === b.log.join('\n')) { same++; if (pack.includes(s)) packSame++; }
    else if (fails < 5) console.log('    differs at state ' + s + ': ' + a.log.length + ' calls against ' + b.log.length);
  }
  const packVoxel = pack.filter(s => states.includes(s)).length;
  check(states.length >= 200 && same === states.length, 'the voxel drawing makes the same canvas calls for all ' + states.length + ' voxel items (' + same + ' same, ' + calls + ' calls)');
  check(packVoxel >= 230 && packSame === packVoxel, 'the Modern Living pack too (' + packSame + ' of ' + packVoxel + ' voxel items)');
}

// the sliced drawing (VR.voxelIconSteps, one voxel per step) makes the same calls as the one-go drawing, for every voxel item
{
  const T = VR.R.T, SH = VR.SHAPE;
  const states = [...new Set(VR.R.types.filter(t => t && t.defaultState !== undefined && T.shape[t.defaultState] === SH.VOXEL).map(t => t.defaultState))];
  let same = 0, multi = 0, maxSteps = 0;
  for (const s of states) {
    const a = recorder(), b = recorder();
    refDrawVoxels(a.ctx, s);
    const it = VR.voxelIconSteps(b.ctx, s); let steps = 0, r;
    do { r = it.next(); steps++; } while (!r.done);
    if (steps > 1) multi++;
    if (steps > maxSteps) maxSteps = steps;
    if (a.log.join('\n') === b.log.join('\n')) same++;
  }
  check(same === states.length && multi > 600, 'drawn one voxel per step, the same calls for all ' + states.length + ' items (' + multi + ' took several steps, the most ' + maxSteps + ')');
}

// Icons.stepIcon with a budget that is spent after every step (the pump's frames): a Modern Living picture is complete after
// some calls, and the canvas it leaves is the one-go picture; get() then returns that canvas
{
  const made = [];
  global.document = { createElement: () => { const r = recorder(); made.push(r); return { width: 0, height: 0, getContext: () => r.ctx }; } };
  const ic = new VR.Icons({ albedo: [new Uint8Array(4)], size: 1 });
  const ids = VR.R.types.filter(t => t.o && t.o.modern && VR.R.T.shape[t.defaultState] === VR.SHAPE.VOXEL).map(t => t.name).slice(0, 12);
  let same = 0, sliced = 0, cached = 0;
  for (const id of ids) {
    const s = VR.R.byName[id].defaultState, want = recorder();
    VR.Icons.prototype.drawVoxels.call(null, want.ctx, s);
    const n0 = made.length; let done = false, calls = 0;
    while (!done) { done = ic.stepIcon(id, () => false); calls++; }
    if (calls > 1) sliced++;
    const got = made[made.length - 1];
    if (made.length === n0 + 1 && got.log.join('\n') === want.log.join('\n')) same++;
    if (ic.get(id) && ic.stepIcon(id, () => false) === true) cached++;
  }
  global.document = undefined; delete global.document;
  check(same === ids.length && cached === ids.length && sliced > 0, 'stepIcon paints the same picture (' + same + ' of ' + ids.length + ', ' + sliced + ' of them in several slices) and keeps it cached (' + cached + ')');
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
