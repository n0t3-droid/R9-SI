// every VM model compiles, every part paints + meshes, boxes exist; reports mesh cost per state
require('./load_shared.js');
const R = VR.R, VX = VR.VX, VM = VR.VM;
let n = 0, parts = 0, quads = 0, errs = [], bytes = 0, maxQ = 0, maxName = '';
const names = Object.keys(VM.MODELS);
const t0 = Date.now();
for (const name of names) {
  const t = R.byName[name]; if (!t) { errs.push('no block ' + name); continue; }
  const m = VM.MODELS[name]; parts += m.parts.length; bytes += m.vol.byteLength + m.pal.byteLength;
  for (let s = t.base; s < t.base + t.nstates; s++) {
    try {
      const g = VX.iconGrid(s); if (!g) errs.push('icon ' + name);
      const bx = VX.boxes(s, false); if (!bx.length) errs.push('box ' + name);
      // paint + mesh through the public path
      const sp = VX.spec(s); VM.paint(sp, { part: t.get(s, 'part'), facing: t.get(s, 'facing') });
      const q = VX.meshGridN(VX.gridFor(sp.res), sp.res, 0, 0); const nq = q.length / 27; quads += nq; n++;
      if (nq > maxQ) { maxQ = nq; maxName = name; }
      // every quad must stay inside the block and carry sane UVs (8-bit)
      for (let k = 0; k < q.length; k += 27) for (let v = 0; v < 4; v++) { const o = k + 3 + v * 6; if (q[o] < 0 || q[o] > 32 || q[o + 1] < 0 || q[o + 1] > 32 || q[o + 2] < 0 || q[o + 2] > 32 || q[o + 3] < 0 || q[o + 3] > 255 || q[o + 4] < 0 || q[o + 4] > 255) { errs.push('quad range ' + name); break; } }
    } catch (e) { errs.push(name + ': ' + e.message); }
  }
}
const ms = Date.now() - t0;
console.log('models', names.length, 'parts', parts, 'states', n, 'avg quads/state', (quads / n).toFixed(1), 'max', maxQ, '(' + maxName + ')', 'volume data', (bytes / 1048576).toFixed(1) + ' MB', 'paint+mesh', (ms / n).toFixed(2), 'ms/state');
if (errs.length) console.log('  ✗ ' + errs.slice(0, 8).join(' | '));
console.log(errs.length ? 'FAILED ' + errs.length : 'ALL OK');
process.exit(errs.length ? 1 : 0);
