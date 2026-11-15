// f-spawn · a companion told to stay, stays (src/shared/pets.js P.parked · src/main/companions.js steer, wish, release).
// The owner (15 Nov): „an animal is tied to me, it comes along where I go". A sitting companion appeared beside its
// player as soon as the ground it sat on was no longer loaded — "stay" held for a few chunks only.
//   a  P.parked: a sitting companion on ground that is not loaded is parked (kept, not moved); a following or a
//      sleeping one is not (those come to you), nor one that sits on loaded ground
//   b  steer: a sitting companion whose ground unloads keeps its place, however far its player is; it is not moved
//   c  steer: a following companion whose ground unloads appears beside its player (as before)
//   d  a parked companion that fell below the world is still rescued (never lost)
//   e  whistling (P.call) for a parked companion brings it to you
//   f  release: the animal is nobody's any more — not saved as a companion, it keeps its place
//   g  the box's wishes: "stay here" and "follow me" set the state whatever it was
//   h  the texts of the box and the hints are in both language tables
//   bash test/wt_run.sh pets_stay.js
const VR = require('./load_shared.js');
for (const f of ['i18n', 'lang_en', 'lang_de']) require(__dirname + '/../src/main/' + f + '.js');
require('../src/shared/pets.js');
global.window = global.window || {};
global.document = global.document || { getElementById: () => null };
require('../src/main/companions.js');
const P = VR.Pets, C = VR.Companions;
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; console.log('  ✗ ' + msg); } else console.log('  ✓ ' + msg); };

// ---------------------------------------------------------------- a  the rule
check(typeof P.parked === 'function', 'a  P.parked exists');
if (typeof P.parked !== 'function') { console.log('FAILED ' + fails); process.exit(1); }
check(P.parked({ state: 'sit' }, false) === true, 'a  sitting on ground that is not loaded: parked');
check(P.parked({ state: 'sit' }, true) === false && P.parked({ state: 'follow' }, false) === false && P.parked({ state: 'sleep' }, false) === false, 'a  sitting on loaded ground, following, sleeping: not parked');

// ---------------------------------------------------------------- a made-up game (no world loaded round the pet)
const mk = (state, loaded) => {
  const hints = [], toasts = [];
  const g = {
    player: { pos: [500, 70, 500], vel: [0, 0, 0], onGround: true, spawn: [0, 70, 0] },
    world: { isLoaded: (x, z) => (loaded ? true : Math.hypot(x - 500, z - 500) < 64), getBlock: (x, y, z) => (y < 70 ? 1 : 0) },
    env: { E: { night: 0 } }, entities: { mobs: [] }, particles: null, audio: { play() {} },
    ui: { hint: (t) => hints.push(t), toast: (a, b) => toasts.push([a, b]), typing: false, show() {}, resume() {} },
  };
  const co = new C(g, null);
  const m = { kind: 'moss_cat', id: 7, pos: [0.5, 70, 0.5], vel: [0, 0, 0], yaw: 0, h: 0.6, onGround: true, walk: 0, walkAmt: 0, ai: { moving: false }, def: { speed: 3 } };
  m.pet = { name: 'Mira', state, seed: 1, pos: m.pos, idle: 0, clock: 0, progD: Infinity, progT: 0, thinkT: 0, thinkDt: 0, path: null, pi: 0, goal: null, fails: 0, wig: 0, sitK: 0, sleepK: 0 };
  g.entities.mobs.push(m);
  return { g, co, m, hints, toasts };
};
// the standing cells next to the player (companions.spotNear asks VR.Folk)
VR.Folk = VR.Folk || {};
VR.Folk.passable = VR.Folk.passable || ((b) => (b ? 0 : 1));
VR.Folk.standable = VR.Folk.standable || ((b) => !!b);
VR.Folk.findPath = VR.Folk.findPath || (() => null);
const far = (m, g) => Math.hypot(m.pos[0] - g.player.pos[0], m.pos[2] - g.player.pos[2]);

// ---------------------------------------------------------------- b  told to stay: it stays
{
  const { g, co, m } = mk('sit', false);
  for (let i = 0; i < 600; i++) co.steer(m, 1 / 30, far(m, g) ** 2);
  check(m.pos[0] === 0.5 && m.pos[2] === 0.5 && m.pet.state === 'sit', `b  20 s, its ground not loaded, its player 700 m away: it sits where it was told (${m.pos[0]}, ${m.pos[2]}, ${m.pet.state})`);
}
// ---------------------------------------------------------------- c  following: it comes
{
  const { g, co, m, hints } = mk('follow', false);
  co.steer(m, 1 / 30, far(m, g) ** 2);
  check(far(m, g) < 6, `c  a follower whose ground unloads appears beside its player (${far(m, g).toFixed(1)} m)`);
  check(hints.length === 1 && /Mira/.test(hints[0]), 'c  … and the first time a line says how to make it stay or set it free (' + (hints[0] || '').slice(0, 60) + '…)');
  m.pos[0] = 0.5; m.pos[2] = 0.5; co.steer(m, 1 / 30, far(m, g) ** 2);
  check(hints.length === 1, 'c  … once a session, not every time');
}
// ---------------------------------------------------------------- d  below the world: rescued
{
  const { g, co, m } = mk('sit', false);
  m.pos[1] = -9; co.steer(m, 1 / 30, far(m, g) ** 2);
  check(m.pos[1] > 60 && far(m, g) < 6, 'd  a sitting companion that fell below the world is brought back to its player (never lost)');
}
// ---------------------------------------------------------------- e  whistle
{
  const { g, co, m } = mk('sit', false);
  co.steer(m, 1 / 30, far(m, g) ** 2);
  co.call();
  for (let i = 0; i < 60; i++) co.steer(m, 1 / 30, far(m, g) ** 2);
  check(m.pet.state === 'follow' && far(m, g) < 6, `e  whistling brings a parked companion to you (${m.pet.state}, ${far(m, g).toFixed(1)} m)`);
}
// ---------------------------------------------------------------- f  release
{
  const { g, co, m, toasts } = mk('follow', true);
  check(typeof co.release === 'function', 'f  release exists');
  const saved = () => { const meta = {}; co.beforeSave(meta); return (meta.companions || []).length; };
  const before = saved();
  co.release(m);
  check(m.pet === null && co.pets().length === 0, 'f  set free: it is nobody\'s companion any more');
  check(m.pos[0] === 0.5 && m.pos[2] === 0.5, 'f  … it keeps its place');
  check(toasts.length === 1 && /Mira/.test(toasts[0][0]), 'f  … and a line says so (' + (toasts[0] && toasts[0][0]) + ')');
  check(before === 1 && saved() === 0, `f  … it is no longer among the companions that are saved (${before} → ${saved()})`);
  co.release(m);
  check(toasts.length === 1, 'f  setting a wild animal free does nothing');
}
// ---------------------------------------------------------------- g  the box's wishes
{
  const { co, m } = mk('follow', true);
  co.rename = m; co.renameIn = { value: 'Mira', blur() {} };
  co.wish('sit');
  check(m.pet.state === 'sit' && co.rename === null, 'g  "Bleib hier" in the box: it sits, the box closes');
  co.rename = m; co.wish('sit');
  check(m.pet.state === 'sit', 'g  "Bleib hier" for one that sits already: it still sits (no toggle)');
  co.rename = m; co.wish('follow');
  check(m.pet.state === 'follow', 'g  "Folge mir": it follows');
}
// ---------------------------------------------------------------- h  texts
{
  const keys = ['g.pet.boxHow', 'g.pet.stay', 'g.pet.follow', 'g.pet.free', 'g.pet.freed', 'g.pet.freedSub', 'g.pet.teleHint'];
  const L = VR.I18N, miss = [];
  for (const lang of ['de', 'en']) for (const k of keys) { const t = L.dict[lang] && L.dict[lang][k]; if (typeof t !== 'string' || !t) miss.push(lang + ':' + k); }
  check(miss.length === 0, 'h  every new text is in both tables' + (miss.length ? ' — missing ' + miss.join(', ') : ''));
}
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
