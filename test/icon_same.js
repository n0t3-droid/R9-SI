// Icons stay the same (iconperf): the speed-ups in the icon pass (VM.icon reads the occupied voxels once) and in the
// model builder (Builder.extrude makes its 2-D test once per cross-section) must not change a single voxel or icon cell.
// Every model in VM.MODELS hashes to the values in test/icon_same.json: the voxels decoded to packed colours (so the
// palette's index order does not matter) and the 8³ icon grid. The file is written from the build before the change
// (the first run writes it, as test/modern_ids.json is written); then every run compares.
require('./load_shared.js');
const fs = require('fs');
const VM = VR.VM;
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const FILE = '/home/claude/vr/test/icon_same.json';

// FNV-1a over 32-bit words
const hashWords = (arr) => { let h = 0x811c9dc5 | 0; for (let i = 0; i < arr.length; i++) { h ^= arr[i]; h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16).padStart(8, '0'); };
const volHash = (m) => {
  const n = m.VW * m.VH * m.VD, words = new Uint32Array(n), vol = m.vol, P = m.pal;
  for (let i = 0; i < n; i++) words[i] = P[vol[i]];
  return hashWords(words);
};

const names = Object.keys(VM.MODELS).sort();
const now = {};
const t0 = performance.now();
for (const name of names) {
  const m = VM.MODELS[name];
  VM.materialize(m);
  const icon = VM.icon({ model: m });
  now[name] = [volHash(m), hashWords(icon)];
}
const ms = performance.now() - t0;
console.log('models', names.length, 'hashed in', ms.toFixed(0), 'ms');

if (!fs.existsSync(FILE)) {
  fs.writeFileSync(FILE, JSON.stringify(now, null, 0).replace(/\],"/g, '],\n"').replace(/^\{/, '{\n').replace(/\}$/, '\n}\n'));
  console.log('  wrote the baseline', FILE, '(' + names.length + ' models)');
}
const base = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const bad = names.filter(n => !base[n] || base[n][0] !== now[n][0] || base[n][1] !== now[n][1]);
const missing = Object.keys(base).filter(n => !VM.MODELS[n]);
check(!bad.length, 'every model keeps its voxels and icon cell for cell (' + names.length + ' models)' + (bad.length ? ' — changed: ' + bad.slice(0, 6).join(', ') : ''));
check(!missing.length, 'no model of the baseline is gone' + (missing.length ? ' — ' + missing.slice(0, 4).join(', ') : ''));

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
