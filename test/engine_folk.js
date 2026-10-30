// e-engine (docs/superpowers/plans/2026-10-30-e-engine.md) · the villagers' path tables (villagers.js caches: walkable and
// standable for every block state — 30 000 collision shapes) were built at the first path of a session: the flight's
// worst frame (a 300 ms frame of play, villages.goTo, in the engine bench's profile). Now a slice at a time while the
// world loads (VR.Folk.warm(ms), game.loadingFrame).
//  1. built in 3 ms slices: the same tables as built at once (every state)
//  2. no slice much over its budget (the longest ≤ 40 ms: one state's shape can be a model built, on a loaded machine)
//  3. a path asked for halfway is the same path, and it builds only the states it meets (e-perf2: before, it finished the
//     30 000 at once — run 1 of e-perf2's gate still found a 100–120 ms villages.goTo on Very Low)
//   bash test/wt_run.sh engine_folk.js
const V = require('./load_shared.js');
global.window = undefined;
const path = require.resolve('../src/main/villagers.js');
let fail = 0;
const check = (ok, what, info) => { console.log((ok ? 'OK   ' : 'FAIL ') + what + (info !== undefined ? '  (' + info + ')' : '')); if (!ok) fail++; };
const fresh = () => { delete require.cache[path]; require(path); return V.Folk; };
const n = V.R.T.type.length;
const table = (F) => { const a = new Uint8Array(n * 2); for (let s = 0; s < n; s++) { a[s] = F.passable(s); a[n + s] = F.standable(s); } return a; };
const w = { getBlock: (x, y, z) => (y < 64 ? 1 : (x === 5 && y < 66) ? 1 : 0) };
// at once (as before)
let F = fresh();
let t0 = performance.now(); const full = table(F); const tFull = performance.now() - t0;
const p0 = JSON.stringify(F.findPath(w, [0, 64, 0], [12, 64, 9], { max: 1800, partial: true }).path);
// in slices
F = fresh();
check(typeof F.warm === 'function' && typeof F.warmed === 'function', 'VR.Folk.warm / warmed exist');
let slices = 0, worst = 0;
if (F.warm) while (!F.warmed() && slices < 100000) { const a = performance.now(); F.warm(3); worst = Math.max(worst, performance.now() - a); slices++; }
const sliced = F.warm ? table(F) : new Uint8Array(0);
let same = sliced.length === full.length; for (let i = 0; same && i < full.length; i++) if (sliced[i] !== full[i]) same = false;
check(same, `in ${slices} slices of 3 ms: the same tables for all ${n} states (at once: ${tFull.toFixed(0)} ms)`);
check(slices > 1 && worst <= 40, 'no slice much over its budget', `the longest ${worst.toFixed(1)} ms`);
// halfway, then a path
F = fresh();
if (F.warm) F.warm(0.2);
const half = F.warmed ? !F.warmed() : false;
const p1 = JSON.stringify(F.findPath(w, [0, 64, 0], [12, 64, 9], { max: 1800, partial: true }).path);
check(half && p1 === p0 && !F.warmed(), 'a path asked for halfway: the same path, the tables not finished at once (only the states it met)');
// a fresh one: a path alone, in a world of three states
F = fresh();
t0 = performance.now(); const p2 = JSON.stringify(F.findPath(w, [0, 64, 0], [12, 64, 9], { max: 1800, partial: true }).path); const tPath = performance.now() - t0;
check(p2 === p0 && !F.warmed(), 'the first path of a session (no warming): the same path, without building every state\'s table', `${tPath.toFixed(1)} ms, at once ${tFull.toFixed(0)} ms`);
console.log(fail ? `FAILED ${fail}` : 'ALL OK');
process.exit(fail ? 1 : 0);
