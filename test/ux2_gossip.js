// f-ux2 — the friendship moments finished (plan docs/superpowers/plans/2026-11-02-f-ux2.md), the glue on a small fake
// village: (1) the deed greeting is a person's first word (VR.Gossip.hello, asked by villages.js before the plain
// „Hallo"), the neighbours only wave while it stands; (2) the children's play staged: the machine kneels, the hero walks
// up and taps it, the machine rises, both cheer, then their day goes on; (3) a friend's visit in person: a guest walks to
// your door, chats when you come, sets the basket's gift down, walks away and is gone; without you: the gift and a note.
//   bash test/wt_run.sh ux2_gossip.js 300
const V = require('./load_shared.js');
for (const f of ['i18n', 'lang_en', 'lang_de']) require(__dirname + '/../src/main/' + f + '.js');
require('../src/main/voxmodels.js'); require('../src/main/villagers.js'); require('../src/main/folkmodel.js');
require('../src/main/villages.js'); require('../src/main/folklife.js');
global.document = { getElementById: () => null, querySelector: () => null };
require('../src/main/gossip.js');
const G = V.Gossip, D = G.DAY;
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
class Ag { constructor(vil, p, pos) { this.vil = vil; this.p = p; this.pos = pos.slice(); this.vel = [0, 0, 0]; this.kid = p.age === 'child'; this.speed = 2.2; this.greeted = false; this.bubble = null; this.pose = 'stand'; this.act = null; } say(t, d) { this.bubble = { text: t, t: d }; } }
const vil = { id: 'v1', name: 'Nordwiese', plan: { x: 0, z: 0 }, fams: [{ surname: 'Berg' }], st: { met: [] }, agents: [], people: [], active: true };
const pp = (id, age) => ({ id, seed: id * 7919, name: 'P' + id, fam: 0, age: age || 'adult', look: {} });
for (let i = 1; i <= 6; i++) vil.people.push(pp(i, i >= 5 ? 'child' : 'adult'));
const at = [[2, 0], [5, 2], [-6, 3], [9, -4], [12, 8], [14, 8]];
for (let i = 0; i < 6; i++) vil.agents.push(new Ag(vil, vil.people[i], [at[i][0], 64, at[i][1]]));
const far = { id: 'v2', name: 'Talheim', plan: { x: 600, z: 0 }, fams: [{ surname: 'Moos' }], st: { met: [] }, agents: [], people: [pp(21)], active: false };
const g = { meta: { seed: 1 }, settings: { playerName: 'Ida' }, env: { day: 3, timeOfDay: 2000 }, player: { pos: [0, 64, 0], inv: null }, world: { isLoaded: () => true }, ui: null };
const Vm = { g, agents: vil.agents.slice(), known: new Map([['v1', vil], ['v2', far]]), talking: null,
  goTo(a, x, y, z, near) { const tx = Math.floor(x) + 0.5, tz = Math.floor(z) + 0.5, dx = tx - a.pos[0], dz = tz - a.pos[2], L = Math.hypot(dx, dz); if (L < (near || 0.6)) return true; const s = Math.min(L, 0.3); a.pos[0] += dx / L * s; a.pos[2] += dz / L * s; return false; } };
const rec = G.rec(g);
const t0 = 3 * D + 1000; G.note(rec, 'freed', { t: t0 - 500, x: 10, z: 0, pl: 'Funkturm', key: 'o1' });
console.log('1 · the deed greeting replaces the first hello; the neighbours wave');
const A = vil.agents[0], B = vil.agents[1], C = vil.agents[2];
check(G.hello(Vm, A) === true && A.bubble && G.log[G.log.length - 1].what === 'greet', 'A\'s first word is the deed greeting: „' + (A.bubble ? A.bubble.text : '') + '"');
check(B.greeted && !B.bubble && C.greeted && !C.bubble && B.waveT > 0, 'the neighbours within 12 m only wave (no bubble beside it)');
const D4 = vil.agents[3]; D4.pos = [3, 64, 3];
check(G.hello(Vm, D4) === true && !D4.bubble, 'while it stands (6 s) another first hello is only a wave');
G.calmT = 0;
check(G.hello(Vm, D4) === true && D4.bubble && /Funkturm|Leucht|Licht|beacon/i.test(D4.bubble.text + 'Licht'), 'later: the next person greets by the deed too');
G.calmT = 0;
check(G.hello(Vm, A) === false, 'a deed greets each person once — then the plain hello');
console.log('2 · the children\'s play');
const k1 = vil.agents[4], k2 = vil.agents[5];
const d = G.heard(rec, { id: 'overworld/v1', x: 0, z: 0, dim: 'overworld' }, t0)[0];
G.stagePlay(Vm, k1, k2, d);
check(k2.pose === 'sitground' && k2.bubble && Vm._gsPlay.ph === 'walk', 'the machine kneels and rumbles: „' + (k2.bubble ? k2.bubble.text : '') + '"');
k1.pos = [8, 64, 8]; k2.pos = [12, 64, 8];
const seen = ['walk'], said = [];
for (let i = 0; i < 300 && Vm._gsPlay; i++) { G.runPlay(Vm, k2, 0.05); G.runPlay(Vm, k1, 0.05); const P0 = Vm._gsPlay; if (P0 && seen[seen.length - 1] !== P0.ph) seen.push(P0.ph); const L = G.log[G.log.length - 1]; if (L && (L.what === 'kid' || L.what === 'kid2') && said.indexOf(L.what) < 0) said.push(L.what); if (P0 && P0.ph === 'tap' && !seen.near) seen.near = Math.hypot(k1.pos[0] - k2.pos[0], k1.pos[2] - k2.pos[2]); }
check(seen.join(',') === 'walk,tap,rise', 'the phases: ' + seen.join(' → ') + ' → done');
check(seen.near < 1.9, 'the hero walked up to the machine (' + (seen.near || 0).toFixed(2) + ' m) before the tap');
check(said.join(',') === 'kid,kid2', 'the hero\'s line, then the machine\'s answer');
check(!Vm._gsPlay && !k1.act && !k2.act && k2.pose === 'stand', 'then their day goes on (no act, standing)');
console.log('3 · a friend\'s visit in person');
const notes = []; V.Quiet = { note: (t) => notes.push(t) };
const gifts = []; V.MoveIn = { groundAt: () => 64, rec: () => ({ gifts }) };
const f = { name: 'P21', sur: 'Moos', vid: 'v2', vn: 'Talheim', likes: 'bread' };
const door = [40, 64, 40]; g.player.pos = [41, 64, 37];
check(G.startVisit(Vm, 'overworld/21', f, door, { at: [40.5, 64, 40.5], item: 'bread', n: 2 }) === true, 'the visit starts');
const J = Vm._gsVisit, gst = J.a;
check(J.guest && Vm.agents.indexOf(gst) >= 0 && gst.p.look.tool === 'basket' && gst.p.name === 'P21', 'a guest with their own name and a basket');
check(Math.hypot(gst.pos[0] - door[0], gst.pos[2] - door[2]) > 25, 'they start about 30 m out (' + Math.hypot(gst.pos[0] - door[0], gst.pos[2] - door[2]).toFixed(0) + ' m)');
const ph = ['walk']; let lines = 0;
for (let i = 0; i < 4000 && Vm._gsVisit; i++) { G.runVisit(Vm, gst, 0.05); const j = Vm._gsVisit; if (j && ph[ph.length - 1] !== j.ph) ph.push(j.ph); }
lines = G.log.filter(x => x.what === 'visit').length;
check(ph.join(',') === 'walk,wait,chat,leave', 'walk → wait → chat → leave (' + ph.join(', ') + ')');
check(lines >= 2 && lines <= 3, 'they greet you and chat (' + lines + ' lines)');
check(gifts.length === 1 && !notes.length, 'the basket\'s gift at your door, no note needed');
check(!Vm._gsVisit && Vm.agents.indexOf(gst) < 0, 'they walked away and are gone');
// without you
g.player.pos = [400, 64, 400];
G.startVisit(Vm, 'overworld/21', f, door, { at: [40.5, 64, 40.5], item: 'bread', n: 2 });
const ph2 = ['walk'];
for (let i = 0; i < 4000 && Vm._gsVisit; i++) { G.runVisit(Vm, Vm._gsVisit.a, 0.05); const j = Vm._gsVisit; if (j && ph2[ph2.length - 1] !== j.ph) ph2.push(j.ph); }
check(ph2.join(',') === 'walk,wait,leave' && gifts.length === 2 && notes.length === 1, 'nobody home: they wait, leave the gift and a note (' + ph2.join(', ') + ')');
check(G.startVisit(Vm, 'overworld/99', f, door, {}) === false, 'no person to send: false (the old note stays the fallback)');
console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
