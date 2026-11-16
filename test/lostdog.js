// f-spawn · the lost dog asks, it does not cling (src/main/wander.js: W.DOG, W.dogNew, W.dogStep).
// The owner (15 Nov): „an animal is tied to me, it comes along where I go". The Wanderregisseur's lost dog followed
// whoever came within 3 m for fifteen minutes and appeared beside them whenever they got 40 m ahead. The rules now:
//   a  it waits (sits, whimpers) until you come close; then, with a village to bring it to, it follows
//   b  bringing it home: as long as you keep getting nearer its village it never gives up, however long the way
//   c  you go somewhere else: after PATIENCE seconds of your walking without getting nearer, it stays behind
//   d  standing still (building, looking) does not use up its patience
//   e  you fly or ride ahead (more than LEAVE m): it stays behind at once — it never appears beside you
//   f  after it stayed behind it does not follow again while you stand beside it; walk off and come back: it does
//   g  no village known: it does not follow at all — it is glad, and after a moment goes its own way
//   h  the texts are in both language tables
//   bash test/wt_run.sh lostdog.js
const V = require('./load_shared.js');
for (const f of ['i18n', 'lang_en', 'lang_de']) require(__dirname + '/../src/main/' + f + '.js');
global.window = global.window || {};
global.performance = global.performance || { now: () => Date.now() };
for (const f of ['lifekit', 'lifedirector', 'wander']) require(__dirname + '/../src/main/' + f + '.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };
const W = V.Wander;
check(!!W.DOG && typeof W.dogNew === 'function' && typeof W.dogStep === 'function', 'the dog\'s rules exist (W.DOG, W.dogNew, W.dogStep)');
if (!W.dogStep) { console.log('FAILED ' + fails); process.exit(1); }
const D = W.DOG, dt = 0.1;
// a walk: f(t) → { dd, dHome, moved } per step; returns the events with their times
const walk = (s, secs, f, t0) => { const ev = []; for (let i = 0; i < Math.round(secs / dt); i++) { const t = (t0 || 0) + i * dt, c = f(t), e = W.dogStep(s, dt, c.dd, c.dHome, c.moved); if (e) ev.push([e, +t.toFixed(1)]); } return ev; };
const names = (ev) => ev.map(e => e[0]).join(',');

// ---------------------------------------------------------------- a  it waits, then follows
{
  const s = W.dogNew();
  let ev = walk(s, 20, () => ({ dd: 12, dHome: 200, moved: 0.4 }));
  check(ev.length === 0 && s.mode === 'wait', 'a  it waits while you are 12 m away');
  ev = walk(s, 1, () => ({ dd: D.NEAR - 0.2, dHome: 200, moved: 0.4 }));
  check(names(ev) === 'follow' && s.mode === 'follow', 'a  you come close: it follows (' + names(ev) + ')');
}
// ---------------------------------------------------------------- b  bringing it home: never gives up
{
  const s = W.dogNew(); walk(s, 0.2, () => ({ dd: 2, dHome: 600, moved: 0 }));
  // 600 m at 4 m/s with a detour every minute (10 s sideways, no gain) — until the village's edge at 40 m (there the child waits)
  let last = 600;
  const ev = walk(s, 168, (t) => { const gained = 4 * (Math.floor(t / 60) * 50 + Math.min(50, t % 60)); last = 600 - gained; return { dd: 2.5, dHome: last, moved: 4 * dt }; });
  check(last < 45, 'b  (the walk ends at the village: ' + last.toFixed(0) + ' m)');
  check(ev.length === 0 && s.mode === 'follow', 'b  600 m to its village with a short detour every minute: it follows all the way (' + (names(ev) || 'no event') + ')');
}
// ---------------------------------------------------------------- c  somewhere else: it stays behind
{
  const s = W.dogNew(); walk(s, 0.2, () => ({ dd: 2, dHome: 200, moved: 0 }));
  const ev = walk(s, 120, (t) => ({ dd: 2.5, dHome: 200 + 4 * t, moved: 4 * dt }));   // walking away from its village
  check(names(ev) === 'stay' && Math.abs(ev[0][1] - D.PATIENCE) < 1 && s.mode === 'wait', `c  you walk away from its village: it stays behind after ${ev[0] && ev[0][1]} s (PATIENCE ${D.PATIENCE})`);
  check(D.PATIENCE >= 15 && D.PATIENCE <= 45, 'c  its patience is between 15 and 45 s of your walking (' + D.PATIENCE + ')');
  // sideways (the distance to the village stays) is no gain either
  const s2 = W.dogNew(); walk(s2, 0.2, () => ({ dd: 2, dHome: 200, moved: 0 }));
  const ev2 = walk(s2, 120, () => ({ dd: 2.5, dHome: 200, moved: 4 * dt }));
  check(names(ev2) === 'stay', 'c  walking round its village at the same distance: it stays behind too');
}
// ---------------------------------------------------------------- d  standing still costs no patience
{
  const s = W.dogNew(); walk(s, 0.2, () => ({ dd: 2, dHome: 200, moved: 0 }));
  const ev = walk(s, 600, () => ({ dd: 1.5, dHome: 200, moved: 0 }));
  check(ev.length === 0 && s.mode === 'follow', 'd  ten minutes standing still (building): it waits with you');
}
// ---------------------------------------------------------------- e  you fly ahead: it stays, at once
{
  const s = W.dogNew(); walk(s, 0.2, () => ({ dd: 2, dHome: 400, moved: 0 }));
  const ev = walk(s, 5, (t) => ({ dd: 2 + 12 * t, dHome: 400 - 12 * t, moved: 12 * dt }));   // 12 m/s toward the village even
  check(names(ev) === 'stay' && ev[0][1] < 2.2, `e  you fly ahead at 12 m/s: it stays behind after ${ev[0] && ev[0][1]} s (more than LEAVE ${D.LEAVE} m ahead)`);
  check(D.LEAVE >= 16 && D.LEAVE <= 30, 'e  LEAVE is a distance a walker never reaches by accident (16–30 m: ' + D.LEAVE + ')');
}
// ---------------------------------------------------------------- f  it does not cling after staying behind
{
  const s = W.dogNew(); walk(s, 0.2, () => ({ dd: 2, dHome: 200, moved: 0 }));
  walk(s, 60, () => ({ dd: 2.5, dHome: 200, moved: 4 * dt }));
  check(s.mode === 'wait', 'f  (it stayed behind)');
  let ev = walk(s, 30, () => ({ dd: 2.5, dHome: 200, moved: 4 * dt }));
  check(ev.length === 0 && s.mode === 'wait', 'f  you stand and walk beside it: it does not follow again by itself');
  ev = walk(s, 3, () => ({ dd: D.REARM + 1, dHome: 200, moved: 4 * dt }));
  ev = ev.concat(walk(s, 3, () => ({ dd: 2, dHome: 190, moved: 4 * dt })));
  check(names(ev) === 'follow', 'f  you walk off and come back to it: it follows again (your choice)');
}
// ---------------------------------------------------------------- g  no village: glad, then its own way
{
  const s = W.dogNew();
  const ev = walk(s, 60, () => ({ dd: 2, dHome: Infinity, moved: 4 * dt }));
  check(names(ev) === 'glad,gone' && s.mode === 'gone', 'g  no village to bring it to: it is glad and goes its own way (' + names(ev) + ')');
  check(ev[1] && ev[1][1] - ev[0][1] <= 15, 'g  … within a quarter of a minute');
}
// ---------------------------------------------------------------- h  texts
{
  const keys = ['g.wd.pet.follow', 'g.wd.pet.home', 'g.wd.pet.stay', 'g.wd.pet.staySub', 'g.wd.pet.glad', 'g.wd.pet.gladSub'];
  const L = V.I18N, miss = [];
  for (const lang of ['de', 'en']) for (const k of keys) { const t = L.dict[lang] && L.dict[lang][k]; if (typeof t !== 'string' || !t) miss.push(lang + ':' + k); }
  check(miss.length === 0, 'h  every text of the dog is in both tables' + (miss.length ? ' — missing ' + miss.join(', ') : ''));
  check(keys.every(k => W.keys().includes(k)), 'h  … and named in W.keys (the language test sees them)');
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
