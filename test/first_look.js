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
require('./load_shared.js');
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

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
