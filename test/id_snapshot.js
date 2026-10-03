// Saved worlds store raw Uint16 state ids with no name table (storage.js): every block type must keep its id range
// forever. This compares the registry with test/id_snapshot.json — [name, base, nstates] of every type in the shipped
// order — and checks that types added since only come after the snapshot's last state.
//   node test/id_snapshot.js           check
//   node test/id_snapshot.js --write   record the current registry (only when a release intentionally appends types)
require('./load_shared.js');
const fs = require('fs');
const R = VR.R;
const FILE = '/home/claude/vr/test/id_snapshot.json';
const now = R.types.map(t => [t.name, t.base, t.nstates]);
if (process.argv.includes('--write')) {
  fs.writeFileSync(FILE, '[\n' + now.map(r => JSON.stringify(r)).join(',\n') + '\n]\n');
  console.log('wrote', now.length, 'types,', R.stateCount, 'states');
  process.exit(0);
}
const snap = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const errs = [];
let end = 1;
for (const [name, base, n] of snap) {
  end = Math.max(end, base + n);
  const t = R.byName[name];
  if (!t) { errs.push('missing ' + name); continue; }
  if (t.base !== base || t.nstates !== n) errs.push(`${name}: was [${base}, ${n}] now [${t.base}, ${t.nstates}]`);
}
const known = new Set(snap.map(r => r[0]));
const added = R.types.filter(t => !known.has(t.name));
for (const t of added) if (t.base < end) errs.push(`new type ${t.name} at ${t.base} sits inside the shipped id range (< ${end})`);
console.log('snapshot', snap.length, 'types, states 1…' + (end - 1), '· now', R.types.length, 'types,', R.stateCount, 'states · appended', added.length, 'types (' + (R.stateCount - end) + ' states)');
console.log(errs.length ? 'FAIL ' + errs.length + '\n  ' + errs.slice(0, 12).join('\n  ') : 'OK — every shipped block keeps its state ids');
process.exit(errs.length ? 1 : 0);
