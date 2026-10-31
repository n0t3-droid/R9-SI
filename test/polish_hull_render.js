// f-polish: the boss's hull, a-boss2's | ours, rendered from its voxels in node (a side view, three-quarter light) and
// the same at its size from 60 m in a pale haze (the self-review's picture) → test/shots/polish_hull_model_{before,after}.png
//   node test/polish_hull_render.js        (needs python3 + PIL for the PNGs)       regress: skip  (a picture maker)
require('./dom_stub.js');
const V = require('./load_shared.js');
const fs = require('fs'), path = require('path'), cp = require('child_process');
const SRC = path.join(__dirname, '../src/');
require(SRC + 'shared/rpg.js'); require(SRC + 'main/voxmodels.js'); const hadF = !!V.Foes; if (!hadF) V.Foes = {}; require(SRC + 'main/rpg_boss.js'); if (!hadF) delete V.Foes;
const out = path.join(__dirname, 'shots'); fs.mkdirSync(out, { recursive: true });
const W = 52, H = 86, PX = 7;
for (const [k, tag] of [['rpg_walker2_base', 'before'], ['rpg_walker2', 'after']]) {
  const d = V.VOXMODELS[k](), img = new Float32Array(W * H * 3), zb = new Float32Array(W * H).fill(-1e9);
  for (const name of ['hull', 'tower', 'mast', 'lantern', 'visor', 'core', 'leg_fl', 'leg_fr', 'leg_bl', 'leg_br', 'knee']) {
    const pt = d.parts[name]; if (!pt) continue; const g = pt.grid;
    const lays = name === 'knee' ? [[-9, 12, -8], [9, 12, -8], [-9, 12, 8], [9, 12, 8]] : [d.layout[name]];
    for (const L of lays) for (let y = 0; y < g.sy; y++) for (let z = 0; z < g.sz; z++) for (let x = 0; x < g.sx; x++) {
      const v = g.c[g.i(x, y, z)]; if (!v) continue;
      const wx = L[0] + x - g.ox, wy = L[1] + y - g.oy, wz = L[2] + z - g.oz;
      // a three-quarter view: the screen's x from x and z, depth toward the viewer (−z, +x)
      const sx = Math.round(W / 2 + (wx * 0.8 - wz * 0.6)), sy = Math.round(H - 6 - wy - (wx * 0.6 + wz * 0.8) * 0.18), dep = -wz * 0.8 - wx * 0.6;
      if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
      const o = sy * W + sx; if (dep < zb[o]) continue; zb[o] = dep;
      const em = (v >> 24) & 1, sh = em ? 1.25 : 0.55 + 0.45 * Math.min(1, Math.max(0, (wy - 10) / 40)) * 0.6 + 0.25;
      img[o * 3] = ((v >> 16) & 255) * sh; img[o * 3 + 1] = ((v >> 8) & 255) * sh; img[o * 3 + 2] = (v & 255) * sh;
    }
  }
  const sky = [228, 230, 232];
  // full size (×PX) on a hazy sky | the 60-m size (each voxel ~0.4 px at 960 px wide, 75°: shown ×4 blocky) with 35 % haze
  const big = Buffer.alloc(W * PX * H * PX * 3), small = Buffer.alloc(W * PX * H * PX * 3), S = 4;
  for (let y = 0; y < H * PX; y++) for (let x = 0; x < W * PX; x++) {
    const o = Math.floor(y / PX) * W + Math.floor(x / PX), q = (y * W * PX + x) * 3, has = zb[o] > -1e9;
    for (let c = 0; c < 3; c++) big[q + c] = has ? Math.min(255, img[o * 3 + c]) : sky[c];
    // the small: average over S×S voxel cells, then hazed
    const cx = Math.floor(x / (PX * S)) * S, cy = Math.floor(y / (PX * S)) * S;
    for (let c = 0; c < 3; c++) { let s = 0; for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const oo = (cy + j) * W + cx + i; s += oo < W * H && zb[oo] > -1e9 ? Math.min(255, img[oo * 3 + c]) : sky[c]; } small[q + c] = Math.round((s / (S * S)) * 0.65 + sky[c] * 0.35); }
  }
  const raw = path.join(out, 'polish_hull_model_' + tag + '.rgb'), raw2 = raw.replace('.rgb', '_60m.rgb');
  fs.writeFileSync(raw, big); fs.writeFileSync(raw2, small);
  cp.execFileSync('python3', ['-c', `from PIL import Image\nimport sys\nw,h=${W * PX},${H * PX}\na=Image.frombytes('RGB',(w,h),open(sys.argv[1],'rb').read()); b=Image.frombytes('RGB',(w,h),open(sys.argv[2],'rb').read())\ns=Image.new('RGB',(w*2+8,h),(12,12,16)); s.paste(a,(0,0)); s.paste(b,(w+8,0)); s.save(sys.argv[3])`, raw, raw2, path.join(out, 'polish_hull_model_' + tag + '.png')]);
  fs.unlinkSync(raw); fs.unlinkSync(raw2);
  console.log('  📷 polish_hull_model_' + tag + '.png');
}
process.exit(0);
