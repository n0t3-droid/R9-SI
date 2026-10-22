// The shops of the Abenteuer (a-quests; plan docs/superpowers/plans/2026-10-22-a-quests.md, spec
// docs/superpowers/specs/2026-10-22-abenteuer-design.md §4). Every rule a check:
//   1. the four shops and who keeps them (the cashier → Supermarkt, the smith → Werkstatt, the pilot → Hangar, the
//      builder → Baumarkt); every id in every catalogue exists in the game
//   2. the supermarket sells the groceries catalogue at its own prices (groceries.js 50–77, VR.SHOP)
//   3. buying: the Sterntaler paid, the things in the backpack; too few Taler (how many are missing), a full backpack,
//      an upgrade step by step to its top, a one-step module bought once, a kit as a whole or not at all
//   4. selling: the Werkstatt and the Hangar buy metals and crystals (A§4's prices); the supermarket buys nothing; in
//      Kreativ / Zen nobody buys (everything is free there); nothing to sell
//   5. no real money anywhere: integers, never below zero, no currency words
//   6. the glue in a stub page: the shop buttons in the talk only in Abenteuer worlds and only for shopkeepers, the
//      screen with the keeper and the Taler, a purchase through the UI, a refusal said in plain words, the cashier's
//      invitation at the till once per visit
//   7. every text key in both tables
//   bash test/wt_run.sh shop.js 300
const DOM = require('./dom_stub.js');
require('./load_shared.js');
require('../src/shared/groceries.js');
require('../src/shared/adventure.js');
require('../src/main/i18n.js');
require('../src/main/lang_en.js');
require('../src/main/lang_de.js');
require('../src/main/settings_reg.js');
let fails = 0;
const check = (ok, msg) => { if (!ok) fails++; console.log((ok ? '  ✓ ' : '  ✗ ') + msg); };
const fs = require('fs'), path = require('path');
if (!fs.existsSync(path.join(__dirname, '../src/main/shop.js'))) { console.log('  ✗ src/main/shop.js missing'); console.log('FAILED 1'); process.exit(1); }
require('../src/main/shop.js');
const S = VR.Shop, Adv = VR.Adv, J = (o) => JSON.stringify(o);
if (!S || !S.buy) { console.log('  ✗ VR.Shop missing'); console.log('FAILED 1'); process.exit(1); }
// a backpack like player.js's Inventory (36 slots, stacks by VR.maxStack)
class Inv {
  constructor() { this.slots = new Array(36).fill(null); this.changed = false; }
  add(id, n) { const max = VR.maxStack(id); let left = n; for (let i = 0; i < 36 && left > 0; i++) { const s = this.slots[i]; if (s && s.id === id && s.n < max && !s.dmg) { const k = Math.min(max - s.n, left); s.n += k; left -= k; } } for (let i = 0; i < 36 && left > 0; i++) if (!this.slots[i]) { const k = Math.min(max, left); this.slots[i] = { id, n: k }; left -= k; } this.changed = true; return n - left; }
  count(id) { let c = 0; for (const s of this.slots) if (s && s.id === id) c += s.n; return c; }
  remove(id, n) { for (let i = 35; i >= 0 && n > 0; i--) { const s = this.slots[i]; if (s && s.id === id) { const k = Math.min(s.n, n); s.n -= k; n -= k; if (!s.n) this.slots[i] = null; } } this.changed = true; return n === 0; }
}
const me0 = (taler) => { const m = Adv.fresh({ on: true }).me; m.taler = taler; return m; };

// ---------------------------------------------------------------- 1 · the shops and their keepers
console.log('1 · the shops');
check(J(S.SHOPS) === J(['supermarkt', 'werkstatt', 'hangar', 'baumarkt']), 'four shops: ' + S.SHOPS.join(', '));
check(S.shopOf('cashier') === 'supermarkt' && S.shopOf('clerk') === 'supermarkt' && S.shopOf('smith') === 'werkstatt' && S.shopOf('pilot') === 'hangar' && S.shopOf('operator') === 'hangar' && S.shopOf('builder') === 'baumarkt' && S.shopOf('farmer') === null, 'their keepers: cashier and clerk, smith, pilot and flight controller, builder; a farmer keeps none');
{
  const bad = [];
  for (const sh of S.SHOPS) for (const e of S.catalog(sh)) {
    if (!(e.price > 0) || e.price !== Math.floor(e.price)) bad.push(sh + ':' + e.key + ' price');
    if (e.kind === 'item' && !(VR.itemDef(e.id) || VR.R.byName[e.id])) bad.push(sh + ':' + e.id);
    if (e.kind === 'kit' && !e.parts.every(([id, n]) => (VR.itemDef(id) || VR.R.byName[id]) && n > 0)) bad.push(sh + ':' + e.key + ' parts');
    if (e.kind === 'up' && !Adv.PRICES[e.id]) bad.push(sh + ':' + e.id + ' upgrade');
  }
  const n = S.SHOPS.map(sh => sh + ' ' + S.catalog(sh).length).join(', ');
  check(!bad.length, 'every catalogue entry exists in the game and has a whole price (' + n + ')' + (bad.length ? ': ' + bad.slice(0, 10).join(', ') : ''));
  const ups = new Set(); for (const sh of ['werkstatt', 'hangar']) for (const e of S.catalog(sh)) if (e.kind === 'up') ups.add(e.id);
  check(Object.keys(Adv.PRICES).every(k => ups.has(k)), 'every upgrade of A§4 is sold (the Werkstatt: suit modules and boots; the Hangar: engine, shield, jump core, Funke\'s modules)');
  check(S.catalog('baumarkt').length >= 5 && S.catalog('baumarkt').every(e => e.kind === 'kit'), 'the Baumarkt sells building kits (' + S.catalog('baumarkt').map(e => e.id).join(', ') + ')');
}

// ---------------------------------------------------------------- 2 · the supermarket's prices
console.log('2 · the supermarket: the groceries catalogue at its prices');
{
  const C = VR.SHOP.CATS, cat = S.catalog('supermarkt');
  let all = 0, ok = 0;
  for (const k in C) for (const [id, p] of C[k].products) { all++; const e = cat.find(x => x.key === k + ':' + id); if (e && e.price === p && e.id === id && e.cat === k) ok++; }
  check(all > 100 && ok === all, 'every product of every category at the category\'s price (' + ok + ' of ' + all + ')');
  const nonPromo = cat.filter(e => e.cat !== 'promo');
  check(nonPromo.every(e => e.price === VR.SHOP.price(e.id)), 'outside the offers the price is VR.SHOP.price (groceries.js)');
  check(cat.filter(e => e.cat === 'promo').some(e => e.price < VR.SHOP.price(e.id)), 'the offers are cheaper (Angebote)');
  check(S.quote(me0(10), 'supermarkt', 'bakery:bread').price === 3, 'bread costs 3 Sterntaler');
}

// ---------------------------------------------------------------- 3 · buying
console.log('3 · buying');
{
  let me = me0(10), inv = new Inv();
  let r = S.buy(me, inv, 'supermarkt', 'bakery:bread', 'survival');
  check(r.ok && me.taler === 7 && inv.count('bread') === 1, 'bread: 3 Taler paid, one bread in the backpack (' + me.taler + ' left)');
  me = me0(2); inv = new Inv();
  r = S.buy(me, inv, 'supermarkt', 'bakery:cake_slice', 'survival');
  check(!r.ok && r.why === 'poor' && r.missing === 2 && me.taler === 2 && inv.count('cake_slice') === 0, 'too few Taler: refused, 2 missing, nothing taken (' + J(r) + ')');
  me = me0(500); inv = new Inv(); for (let i = 0; i < 36; i++) inv.slots[i] = { id: 'cobblestone', n: 64 };
  r = S.buy(me, inv, 'supermarkt', 'bakery:bread', 'survival');
  check(!r.ok && r.why === 'full' && me.taler === 500, 'a full backpack: refused before paying');
  inv.slots[35] = { id: 'bread', n: 63 };
  r = S.buy(me, inv, 'supermarkt', 'bakery:bread', 'survival');
  check(r.ok && inv.count('bread') === 64, 'a stack with room left takes it');
  // upgrades step by step
  me = me0(10000); inv = new Inv();
  const steps = []; for (let i = 0; i < 4; i++) { const q = S.buy(me, inv, 'hangar', 'up:engine', 'survival'); steps.push(q.ok ? q.price : q.why); }
  check(J(steps) === J([600, 1500, 3500, 'max']) && me.owned.engine === 3 && me.taler === 10000 - 5600, 'the engine: 600, 1,500, 3,500 — then the top step (' + steps.join(', ') + ')');
  check(S.quote(me, 'hangar', 'up:engine').max === true, 'the quote says the top step is reached');
  const h1 = S.buy(me, inv, 'werkstatt', 'up:suitHeat', 'survival'), h2 = S.buy(me, inv, 'werkstatt', 'up:suitHeat', 'survival');
  check(h1.ok && h1.price === 800 && !h2.ok && h2.why === 'owned', 'the heat module: bought once (800), then „schon gekauft"');
  check(Adv.upgrade(me).cruise === 1 + 0.15 * 3 && Adv.upgrade(me).suit.heat, 'the upgrades work through VR.Adv.upgrade (cruise ×1.45, heat protected)');
  const sh = S.buy(me0(499), new Inv(), 'hangar', 'up:shield', 'survival');
  check(!sh.ok && sh.why === 'poor' && sh.missing === 1, 'the shield\'s first step needs 500: one missing');
  // a kit as a whole
  me = me0(1000); inv = new Inv();
  const kit = S.catalog('baumarkt')[0];
  r = S.buy(me, inv, 'baumarkt', kit.key, 'survival');
  check(r.ok && kit.parts.every(([id, n]) => inv.count(id) === n) && me.taler === 1000 - kit.price, 'a kit: all its parts (' + kit.parts.map(p => p[1] + ' × ' + p[0]).join(', ') + ') for ' + kit.price);
  inv = new Inv(); for (let i = 0; i < 35; i++) inv.slots[i] = { id: 'cobblestone', n: 64 };
  const t0 = me.taler; r = S.buy(me, inv, 'baumarkt', kit.key, 'survival');
  check(!r.ok && r.why === 'full' && me.taler === t0 && kit.parts.every(([id]) => inv.count(id) === 0), 'a kit that does not fit: nothing paid, nothing given');
  check(!S.buy(me, new Inv(), 'baumarkt', 'kit:nope', 'survival').ok && S.buy(me, new Inv(), 'baumarkt', 'kit:nope', 'survival').why === 'unknown', 'an unknown thing: refused');
  check(!S.buy(me, new Inv(), 'supermarkt', 'up:engine', 'survival').ok, 'a shop sells only its own catalogue (no engine at the supermarket)');
}

// ---------------------------------------------------------------- 4 · selling
console.log('4 · selling');
{
  let me = me0(0), inv = new Inv(); inv.add('iron_ingot', 10); inv.add('gold_ingot', 2);
  let r = S.sell(me, inv, 'werkstatt', 'iron_ingot', 10, 'survival');
  check(r.ok && r.got === 20 && me.taler === 20 && inv.count('iron_ingot') === 0, 'ten iron ingots at the Werkstatt: 20 Sterntaler (2 each, A§4)');
  r = S.sell(me, inv, 'hangar', 'gold_ingot', 5, 'survival');
  check(r.ok && r.got === 12 && inv.count('gold_ingot') === 0, 'gold at the Hangar: 6 each — only what you have (2 of 5)');
  r = S.sell(me, inv, 'werkstatt', 'iron_ingot', 1, 'survival');
  check(!r.ok && r.why === 'none', 'nothing left to sell: said so');
  inv.add('iron_ingot', 3);
  r = S.sell(me, inv, 'supermarkt', 'iron_ingot', 3, 'survival');
  check(!r.ok && r.why === 'nobuy' && inv.count('iron_ingot') === 3, 'the supermarket buys nothing');
  r = S.sell(me, inv, 'werkstatt', 'iron_ingot', 3, 'creative');
  check(!r.ok && r.why === 'mode' && inv.count('iron_ingot') === 3, 'in Kreativ nobody buys (everything is free there)');
  r = S.sell(me, inv, 'werkstatt', 'iron_ingot', 3, 'zen');
  check(!r.ok && r.why === 'mode', 'nor in Zen');
  r = S.sell(me, inv, 'werkstatt', 'cobblestone', 1, 'survival');
  check(!r.ok && r.why === 'nobuy', 'cobblestone is not bought');
  const list = S.sellable('werkstatt', inv);
  check(list.length === 1 && list[0].id === 'iron_ingot' && list[0].have === 3 && list[0].price === 2, 'the sell list shows what you have and its price (' + J(list) + ')');
  inv.add('crystal_shard_violet', 2);
  check(S.sellable('hangar', inv).some(e => e.id === 'crystal_shard_violet' && e.price === 8), 'crystal shards: 8 each');
}

// ---------------------------------------------------------------- 5 · never real money
console.log('5 · never real money');
{
  const me = me0(5), r = S.buy(me, new Inv(), 'supermarkt', 'pharmacy:first_aid_kit', 'survival');
  check(!r.ok && me.taler === 5 && Number.isInteger(me.taler), 'a first aid kit (30) with 5 Taler: refused, the Taler never go below zero and stay whole');
  const src = fs.readFileSync(path.join(__dirname, '../src/main/shop.js'), 'utf8').replace(/\/\/.*$/gm, '');
  check(!/€|\bEUR\b|\bUSD\b|\$\s*\d|real money|echtes Geld kaufen|in-app|checkout|payment/i.test(src), 'no currency, no purchase with money in the code');
  const de = VR.I18N.dict.de, en = VR.I18N.dict.en, txt = S.keys().map(k => (de[k] || '') + ' ' + (en[k] || '')).join(' ');
  check(!/€|\$|EUR|USD|Euro|Dollar/.test(txt), 'nor in the texts');
}

// ---------------------------------------------------------------- 6 · the glue (stub page)
console.log('6 · the glue (stub page)');
for (const id of ['hud', 'app', 'ui']) { const e = DOM.mkEl('div'); e.setAttribute('id', id); DOM.body.appendChild(e); }
const talk = DOM.mkEl('div'); talk.setAttribute('id', 'talk'); DOM.body.appendChild(talk);
for (const id of ['tk_text', 'tk_opts']) { const e = DOM.mkEl('div'); e.setAttribute('id', id); talk.appendChild(e); }
require('../src/main/adventure.js');
const A = VR.Adventure;
{
  const meta = { id: 'w1', name: 'S', difficulty: 'peaceful', mode: 'survival', created: Date.now() - 1e7 };
  const inv = new Inv();
  const g = VR.game = { state: 'play', meta, settings: {}, player: { pos: [0, 70, 0], spawn: [0, 70, 0], mode: 'survival', inv, eyePos() { return [0, 71.6, 0]; }, lookDir: () => [0, 0, -1] }, env: { day: 2, timeOfDay: 3000 }, ui: { screen: null, toasts: [], toast(a, b) { this.toasts.push(a + ' ' + b); }, hint() {}, show(id) { this.screen = id; }, resume() { this.screen = null; } }, icons: null, audio: { play() {}, tone() {} }, particles: { glow() {}, spark() {} }, saveMeta() { return Promise.resolve(); } };
  A.bind();
  const vil = { id: '1_2', name: 'Lindenau', st: { rep: 0 } };
  const mkA = (role, nm) => ({ vil, p: { id: '1_2:0:' + nm.length, name: nm, role, seed: nm.length * 31 }, get role() { return this.p.role; }, say(t) { this.said = t; }, pos: [3, 70, 3] });
  const cashier = mkA('cashier', 'Mira'), pilot = mkA('pilot', 'Oren'), farmer = mkA('farmer', 'Juno');
  const mgr = { g, talking: null, talkText(s) { this.last = s; }, talkOptions() {}, chirp() {} };
  const opts = DOM.body.querySelector('#tk_opts');
  const btns = () => opts.children.filter(b => b.dataset && b.dataset.shop);
  opts.children.length = 0; S.talkButtons(mgr, cashier, opts);
  check(btns().length === 0, 'a builder\'s world: the cashier is decoration (no shop button)');
  A.setOn(true);
  opts.children.length = 0; S.talkButtons(mgr, cashier, opts);
  check(btns().length === 1 && btns()[0].dataset.shop === 'supermarkt', 'an Abenteuer world: the cashier has „🛒 Einkaufen"');
  opts.children.length = 0; S.talkButtons(mgr, farmer, opts);
  check(btns().length === 0, 'a farmer keeps no shop');
  opts.children.length = 0; S.talkButtons(mgr, pilot, opts);
  check(btns().length === 1 && btns()[0].dataset.shop === 'hangar', 'the pilot keeps the Hangar');
  btns()[0].click();
  check(g.ui.screen === 'shop' && DOM.body.querySelector('#shop'), 'the Hangar opens as a screen (#shop)');
  const panel = DOM.body.querySelector('#shop .panel');
  check(panel && /Hangar/.test(panel.innerHTML) && /Oren/.test(panel.innerHTML) && /Sterntaler/.test(panel.innerHTML), 'with its keeper and the Sterntaler you have');
  A.rec.me.taler = 700;
  S.render();
  const r1 = S.act('buy', 'up:engine');
  check(r1 && r1.ok && A.rec.me.taler === 100 && A.rec.me.owned.engine === 1, 'buying the engine through the screen: 600 paid, step 1');
  const r2 = S.act('buy', 'up:engine');
  check(r2 && !r2.ok && r2.why === 'poor' && /1\.?400|1400/.test(S.lastMsg || ''), 'the next step: refused — „' + S.lastMsg + '"');
  S.close();
  check(g.ui.screen !== 'shop', 'closed');
  // the cashier's invitation at the till: once per visit
  const said = []; cashier.say = (t) => said.push(t);
  g.player.pos = [3, 70, 5];
  S.till(mgr, cashier, { cashier: [3, 70, 3], lane: [4, 70, 3] }, 0.5); S.till(mgr, cashier, { cashier: [3, 70, 3], lane: [4, 70, 3] }, 0.5);
  check(said.length === 1, 'the cashier invites you once when you come to the till: „' + said[0] + '"');
  A.setOn(false); said.length = 0; S.reset && S.reset();
  S.till(mgr, cashier, { cashier: [3, 70, 3], lane: [4, 70, 3] }, 0.5);
  check(said.length === 0, 'a builder\'s world: the cashier stays quiet');
}

// ---------------------------------------------------------------- 7 · the texts
console.log('7 · the texts');
{
  const de = VR.I18N.dict.de, en = VR.I18N.dict.en, keys = S.keys();
  const miss = keys.filter(k => !(k in de) || !(k in en));
  check(keys.length > 30 && !miss.length, 'every key the shops use is in both tables (' + keys.length + ')' + (miss.length ? ': missing ' + miss.slice(0, 12).join(', ') : ''));
}

console.log(fails ? 'FAILED ' + fails : 'ALL OK');
process.exit(fails ? 1 : 0);
