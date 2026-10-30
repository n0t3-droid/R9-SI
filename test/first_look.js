// f-first — the first impression (plan docs/superpowers/plans/2026-10-30-f-first.md; review docs/reviews/v0.52.md R53-01…09)
//   1. the HUD's item names in the player's language: the common blocks and items have g.it.<id> in both tables; in German
//      VR.itemName gives the table's word, in English the data's own name (unchanged); every other block in German goes
//      through names_de.js (no raw English data name for the 30 kit/terrain ids)
//   2. one prompt per key: while a story card stands, the Aktion's prompt and Funke's line carry no [V] (the card owns it)
//   3. the arrival is short in wall time on any machine (a slow frame rate does not stretch it) and any key ends it in
//      every phase; it is over ≤ FI.MAX_WALL seconds after its start
//   4. the pause menu: five at the top (Weiterspielen, Tagebuch/Codex, Foto, Einstellungen, Speichern & zum Start) and
//      „Mehr …" with the rest
//   5. an Abenteuer world's start: the spawn near its first outpost (≈ 200–300 m, facing it), the morning
//   6. the title: the land shown only finished (or in its haze)
// usage: bash test/wt_run.sh first_look.js 300 — prints ALL OK or FAILED n
const path = require('path');
require('./dom_stub.js');
{ const ce = document.createElement.bind(document); document.createElement = (t) => { const e = ce(t); if (!e.style) e.style = {}; return e; }; }
let CLOCK = 0; global.performance = { now: () => CLOCK };
const V = require('./load_shared.js');
require('../src/main/i18n.js');
require('../src/main/lang_en.js');
require('../src/main/lang_de.js');
require('../src/shared/names_de.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const I = VR.I18N, de = I.dict.de, en = I.dict.en;
const inLang = (l, f) => { const was = I.lang; I.lang = l; try { return f(); } finally { I.lang = was; } };

console.log('1 · item names in the player\'s language (R53-02)');
{
  const COMMON = ['grass_block', 'dirt', 'stone', 'cobblestone', 'sand', 'oak_log', 'oak_planks', 'oak_leaves', 'glass', 'stone_bricks', 'bricks',
    'quartz_block', 'torch', 'lantern', 'crafting_table', 'chest', 'oak_door', 'oak_stairs', 'oak_slab', 'water_bucket', 'apple', 'bread',
    'wooden_pickaxe', 'wooden_axe', 'tech_panel', 'hull_plating', 'landing_pad', 'cherry_leaves', 'violet_crystal_block', 'vx_lamppost'];
  const noKey = COMMON.filter(id => typeof de['g.it.' + id] !== 'string' || typeof en['g.it.' + id] !== 'string');
  check(!noKey.length, COMMON.length + ' common ids have g.it.<id> in both tables' + (noKey.length ? ': ' + noKey.join(', ') : ''));
  const deN = inLang('de', () => COMMON.map(id => [id, VR.itemName(id)])), enN = inLang('en', () => COMMON.map(id => [id, VR.itemName(id)]));
  const notDe = deN.filter(([id, n]) => n !== de['g.it.' + id] || n === VR.itemDef(id).name && !/^(Neon|Sand|Basalt|Lava|Obsidian)\b/.test(n));
  check(!notDe.length, 'German: ' + deN.slice(0, 8).map(x => x[1]).join(' · ') + ' …' + (notDe.length ? ' — not German: ' + notDe.map(x => x.join('=')).join(', ') : ''));
  check(inLang('de', () => VR.itemName('grass_block')) === 'Grasblock', 'the critic\'s „Grass Block" reads „' + inLang('de', () => VR.itemName('grass_block')) + '" in German');
  const raw = (id) => { const d = VR.itemDef(id); return d.block ? d.block.display : d.name; };
  const enDiff = enN.filter(([id, n]) => n !== raw(id));
  check(!enDiff.length, 'English keeps the data\'s names (' + enN.slice(0, 5).map(x => x[1]).join(' · ') + ')' + (enDiff.length ? ': ' + enDiff.map(x => x.join('=')).join(', ') : ''));
  // the keys' English is the data's name (a renamed block keeps both in step)
  const stale = Object.keys(en).filter(k => k.indexOf('g.it.') === 0 && VR.itemDef(k.slice(5)) && en[k] !== raw(k.slice(5)));
  check(!stale.length, 'every g.it.* English text is its data name' + (stale.length ? ': ' + stale.join(', ') : ''));
  const orphan = Object.keys(de).filter(k => k.indexOf('g.it.') === 0 && !VR.itemDef(k.slice(5)));
  check(!orphan.length, 'every g.it.* key names an existing item' + (orphan.length ? ': ' + orphan.join(', ') : ''));
  // the rest goes through names_de.js in German: the share of block names that still carry an English word falls
  const R = VR.R, all = Object.values(R.byName).filter(t => t.display && !(t.o && t.o.hidden));
  let eng = 0; for (const t of all) { let miss = 0; VR.NamesDE.translate(t.display, (x, k) => { if (k === 'miss') miss++; }); if (miss) eng++; }
  const share = eng / all.length;
  console.log('    names_de.js: ' + eng + ' of ' + all.length + ' block names keep an English word (' + (share * 100).toFixed(1) + ' %)');
  check(share < 0.5, 'fewer than half of all block names keep an English word in German (' + (share * 100).toFixed(1) + ' %; v042: 77 %)');
  check(inLang('en', () => VR.itemName('egg_sky_ray')) === 'Cloud Ray Egg' && inLang('en', () => VR.itemName('laser_blaster')) === 'Calm Beam', 'English item names stay (Cloud Ray Egg, Calm Beam)');
}

console.log('3 · the arrival on the wall clock (R53-06)');
{
  for (const f of ['wowmoment.js', 'first.js']) require('../src/main/' + f);
  const FI = VR.First;
  const mkG = (wowOn) => {
    const g = { input: { pressed: new Set(), keys: new Set(), mouse: { clicked: [] } }, settings: { wowMoments: wowOn }, hideHud: false, meta: {} };
    // a stand-in for the wow moment's actor: RISE + HOLD + FALL = 4 s of its own clock, stop() ends it
    g.wow = { active: null, t: 0, wait: 0, start(v) { this.active = v; this.t = 0; }, stop() { this.active = null; }, skip() { this.t = 2.6; }, update(dt) { if (!this.active) return; this.t += dt; if (this.t >= 4) this.active = null; } };
    return g;
  };
  // a slow machine: 3 frames a second, the game's dt clamped to 0.1 (game.js)
  const run = (wowOn, keyAt, hold) => {
    const g = mkG(wowOn), A = new FI.Arrival(g, { vista: { id: 'v', wow: true, eye: [0, 0, 0], yaw: 0, pitch: 0, fov: 40 } });
    g.arrival = A; CLOCK = 1000; A.begin(); const t0 = CLOCK;
    let n = 0;
    while (A.phase !== 'done' && n < 600) {
      CLOCK += 333; n++;
      const t = (CLOCK - t0) / 1000;
      g.input.pressed.clear(); if (keyAt !== undefined && t >= keyAt && t < keyAt + 0.34) { g.input.pressed.add('KeyW'); }
      if (hold !== undefined && t >= hold) g.input.keys.add('KeyW');
      g.wow.update(0.1); A.update(0.1);
    }
    return { wall: (CLOCK - t0) / 1000, frames: n, done: A.phase === 'done', hud: g.hideHud };
  };
  const a = run(true), b = run(false), c = run(true, 1.0), d = run(true, undefined, 3.0);
  check(a.done && a.wall <= FI.MAX_WALL + 0.4, 'at 3 fps with the wow moment: over after ' + a.wall.toFixed(1) + ' s of wall time (≤ ' + FI.MAX_WALL + ' s; v042: ' + ((FI.PRE + 4) / 0.1 / 3).toFixed(0) + ' s)');
  check(b.done && b.wall <= FI.PRE + 0.4, 'without the moment: over after ' + b.wall.toFixed(1) + ' s (the veil\'s ' + FI.PRE + ' s)');
  check(c.done && c.wall <= 1.0 + FI.SKIP + 0.8, 'a key at 1 s: over after ' + c.wall.toFixed(1) + ' s');
  check(d.done && d.wall <= 3.0 + 0.7, 'W held from 3 s (in the moment): over after ' + d.wall.toFixed(1) + ' s');
  check(!a.hud && !c.hud, 'the HUD is back after it (hideHud restored)');
}

console.log('2 · one prompt per key; 4 · the pause menu\'s five (R53-05, R53-04)');
{
  global.VR.UI = global.VR.UI || null;
  require('../src/main/firstlook.js');
  const FL = VR.FirstLook, S = VR.Story = VR.Story || {};
  const had = S.offer; let offer = null; S.offer = () => offer;
  const g = {};
  check(FL.keyFree(g) === true, 'no card: the Aktion\'s prompt may name V');
  offer = { id: 'c1.b1' };
  check(FL.keyFree(g) === false, 'a card stands: the prompt waits (the card owns V)');
  S.offer = had;
  const sel = FL.PRIMARY.map(s => s[0]);
  check(FL.PRIMARY.length === 5 && sel[0].includes('resume') && sel[3].includes('settings') && sel[4].includes('quit') && FL.PRIMARY[1].join().includes('journal') && FL.PRIMARY[1].join().includes('codex'), 'the pause menu\'s top: five slots — ' + FL.PRIMARY.map(s => s.map(x => x.replace(/\[data-act="|"\]/g, '')).join('/')).join(' · '));
  check(typeof de['g.pause.more'] === 'string' && typeof en['g.pause.more'] === 'string' && de['g.pause.less'] && en['g.pause.less'], '„' + de['g.pause.more'] + '" / „' + de['g.pause.less'] + '" in both tables');
  check(!/\{key\}|\[/.test(de['story.offer.card'] + en['story.offer.card']), 'Funke\'s offer beside the card names no key: „' + de['story.offer.card'] + '"');
  const fs = require('fs'), story = fs.readFileSync(path.join(__dirname, '..', 'src/main/story.js'), 'utf8'), ctx = fs.readFileSync(path.join(__dirname, '..', 'src/main/ctx.js'), 'utf8');
  check(/cardText \|\| text/.test(story) && /VR\.FirstLook\.keyFree\(g\)/.test(ctx), 'story.js speaks the line without the key, ctx.js asks keyFree before its prompt');
}

console.log('5 · an Abenteuer world starts near its first outpost, in the morning (R53-09)');
{
  const t0 = Date.now(), rows = [];
  for (const seed of [4242, 12345, 777, 99, 2026]) {
    const g = V.makeGen('overworld', seed, { vgen: 14 });
    const sp = g.findSpawn(), r = g.outpostApproach(sp[0], sp[2]);
    const far = g.nearestOutpost(sp[0], sp[2]);
    const near = r ? g.nearestOutpost(r.pos[0], r.pos[2]) : null;
    const dn = near ? Math.hypot(near.x - r.pos[0], near.z - r.pos[2]) : -1;
    const fwd = r ? [-Math.sin(r.yaw), -Math.cos(r.yaw)] : [0, 0], to = r ? [r.out[0] - r.pos[0], r.out[2] - r.pos[2]] : [0, 0];
    const cos = r ? (fwd[0] * to[0] + fwd[1] * to[1]) / (Math.hypot(to[0], to[1]) || 1) : 0;
    rows.push({ seed, from: far ? Math.round(Math.hypot(far.x - sp[0], far.z - sp[2])) : -1, d: r ? r.d : -1, dn: Math.round(dn), cos: +cos.toFixed(3) });
  }
  console.log('    ' + rows.map(r => 'seed ' + r.seed + ': the generator\'s spawn ' + r.from + ' m → start ' + r.dn + ' m').join(' · ') + ' (' + (Date.now() - t0) + ' ms)');
  check(rows.every(r => r.d >= 200 && r.d <= 300 && r.dn >= 0 && r.dn <= 300), 'every seed: the start 200–300 m from an outpost, and no nearer one is farther (' + rows.map(r => r.dn).join(', ') + ' m)');
  check(rows.every(r => r.cos > 0.999), 'the start faces the outpost');
  const FI = VR.First;
  check(FI.ADV_TOD === FI.GOLD_AM && (12000 - FI.ADV_TOD) / 20 / 60 >= 5, 'the morning: tick ' + FI.ADV_TOD + ' — ' + ((12000 - FI.ADV_TOD) / 20 / 60).toFixed(1) + ' minutes of day ahead (the evening golden hour: ' + ((12000 - FI.GOLD) / 20 / 60).toFixed(1) + ')');
  check(FI.advWorld({ adventure: { on: true } }) && !FI.advWorld({}) , 'an Abenteuer world is known by its record (or its create choice)');
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
