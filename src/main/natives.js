// ============================================================================
// u-worlds3 · VR.Natives — the native species up close (plan docs/superpowers/plans/2026-10-31-u-worlds3.md):
//   · their language: four invented words per species (hello, thanks, friend, farewell — our own, built from each
//     species' syllables; web-searched: no brand or product of these names), learnt one by one as you meet them and
//     shown with their meaning
//   · talking to a native: they turn to you, greet in their own way (greetPose, 2.4 s) and say a word with a line of
//     their culture; the others within 7 m make room (7–9 m) while the talk lasts and a few seconds after
//   · 📷 in a native village: the people within 14 m of the photo camera hold still (20 s at most)
//   · on the plaza they stand round the monument at 4–6 m (not inside it)
//   · a chain of three quests per species — greet three of them · bring a gift from home · join their culture moment —
//     and what they teach: Wellari the tide lantern's recipe, Dunelin the dune building set (Bauhand ★), Glutani the
//     glowing obsidian's recipe, Regoli the Geo Scanner (one given and its recipe), Nivari the frost building set
// The records: meta.natives = {[kind]: {s: 0…3, met: [pid…], w: [word indices known]}} (additive; an odd record reads
// as new). Cost 🟢: nothing per frame but a few comparisons per villager in a native village.
// ============================================================================
(function (VR) {
  'use strict';
  const T = (k, v) => (VR.I18N ? VR.I18N.t(k, v) : k);
  const N = VR.Natives = {};
  const KINDS = N.KINDS = ['aqua', 'ocker', 'zinn', 'basalt', 'opal'];
  const MEAN = N.MEAN = ['hello', 'thanks', 'friend', 'bye'];
  const W = (a) => a.map((w, i) => ({ w, mean: MEAN[i] }));
  N.LANG = {
    aqua: W(['Lunavel', 'Marithi', 'Nelisa', 'Shavelun']),
    ocker: W(['Duraka', 'Tesulmar', 'Holgek', 'Zeromur']),
    zinn: W(['Glusoleta', 'Kaitiro', 'Vanuret', 'Pelorumi']),
    basalt: W(['Remunel', 'Sovitorn', 'Kathelo', 'Golixis']),
    opal: W(['Nivasen', 'Feltoril', 'Kelmia', 'Suvinha']),
  };
  N.TEACH = {
    aqua: { type: 'recipe', ins: ['glass', 'sea_pickle', 'kelp'], out: 'tide_lantern', n: 2 },
    ocker: { type: 'pieces', set: 'ocker', pieces: ['b:terracotta', 'b:red_sandstone', 'b:smooth_red_sandstone', 'b:orange_stained_glass', 'b:acacia_planks', 'b:lantern', 'b:amber_crystal_block', 'b:orange_wool'] },
    zinn: { type: 'recipe', ins: ['obsidian', 'magma_block'], out: 'glowing_obsidian', n: 2 },
    basalt: { type: 'gadget', ins: ['iron_ingot', 'copper_ingot', 'azure_crystal_block'], out: 'scanner', n: 1 },
    opal: { type: 'pieces', set: 'opal', pieces: ['b:packed_ice', 'b:blue_ice', 'b:snow_block', 'b:light_blue_stained_glass', 'b:spruce_planks', 'b:rose_crystal_block', 'b:lantern', 'b:vx_lamppost_crystal'] },
  };
  // the three quests: greet three natives · bring the gift · join the culture moment
  N.CHAIN = {
    aqua: [{ k: 'greet', n: 3 }, { k: 'give', item: 'glass', n: 6 }, { k: 'cult' }],
    ocker: [{ k: 'greet', n: 3 }, { k: 'give', item: 'oak_log', n: 8 }, { k: 'cult' }],
    zinn: [{ k: 'greet', n: 3 }, { k: 'give', item: 'ice', n: 6 }, { k: 'cult' }],
    basalt: [{ k: 'greet', n: 3 }, { k: 'give', item: 'bread', n: 4 }, { k: 'cult' }],
    opal: [{ k: 'greet', n: 3 }, { k: 'give', item: 'poppy', n: 6 }, { k: 'cult' }],
  };
  N.GREET_S = 2.4; N.HUSH_R = 7; N.HUSH_D = 8; N.PHOTO_R = 14; N.PHOTO_S = 20;

  // ---------------------------------------------------------------- the pure core (test/worlds3.js c)
  const isRec = (r) => !!r && typeof r === 'object' && !Array.isArray(r);
  N.rec = function (meta, kind) {
    if (!meta) return { s: 0, met: [], w: [] };
    const all = isRec(meta.natives) ? meta.natives : (meta.natives = {});
    let r = all[kind];
    if (!isRec(r) || !(r.s >= 0 && r.s <= 3) || !Array.isArray(r.met) || !Array.isArray(r.w)) r = all[kind] = { s: 0, met: [], w: [] };
    return r;
  };
  N.step = (meta, kind) => N.rec(meta, kind).s;
  N.learned = (meta, kind) => N.rec(meta, kind).s >= 3;
  N.known = (meta, kind) => N.rec(meta, kind).w.filter(i => N.LANG[kind] && N.LANG[kind][i]).map(i => N.LANG[kind][i]);
  // a native greeted: counted once each; the third finishes the first quest → {done: 0}
  N.talked = function (meta, kind, pid) {
    const r = N.rec(meta, kind), Q = N.CHAIN[kind]; if (!Q) return null;
    if (r.s !== 0) return {};
    if (pid !== undefined && !r.met.includes(String(pid))) r.met.push(String(pid));
    if (r.met.length >= Q[0].n) { r.s = 1; return { done: 0 }; }
    return { n: r.met.length };
  };
  // the gift handed over (the second quest): true when given
  N.give = function (meta, kind, inv) {
    const r = N.rec(meta, kind), q = N.CHAIN[kind] && N.CHAIN[kind][1];
    if (!q || r.s !== 1 || !inv || inv.count(q.item) < q.n) return false;
    inv.remove(q.item, q.n); if ('changed' in inv) inv.changed = true;
    r.s = 2; return true;
  };
  // the culture moment joined (the third quest) → taught; the gadget given
  N.cult = function (meta, kind, inv) {
    const r = N.rec(meta, kind); if (r.s !== 2) return null;
    r.s = 3;
    const Tt = N.TEACH[kind];
    if (Tt && Tt.type === 'gadget' && inv && inv.add) { inv.add(Tt.out, 1); inv.changed = true; }
    return { taught: kind };
  };
  // the taught recipes (shapeless: exactly their things, one each)
  N.match = function (grid, n, meta) {
    if (!meta || !grid) return null;
    const ids = []; for (let i = 0; i < grid.length; i++) { const s = grid[i]; if (s && s.id) ids.push(s.id); }
    if (!ids.length) return null;
    for (const kind of KINDS) {
      const Tt = N.TEACH[kind]; if (!Tt.ins || !N.learned(meta, kind) || Tt.ins.length !== ids.length) continue;
      const left = ids.slice(); let ok = true;
      for (const w of Tt.ins) { const i = left.indexOf(w); if (i < 0) { ok = false; break; } left.splice(i, 1); }
      if (ok) return { id: Tt.out, n: Tt.n };
    }
    return null;
  };
  // the greeting: the next word not yet known (hello first), else one by h; its line in their culture
  N.greeting = function (meta, kind, h) {
    const L = N.LANG[kind]; if (!L) return null;
    const r = N.rec(meta, kind);
    let i = 0; while (i < L.length && r.w.includes(i)) i++;
    const fresh = i < L.length; if (!fresh) i = ((h >>> 0) % L.length);
    if (fresh) r.w.push(i);
    const word = L[i];
    return { word, fresh, text: T('g.nat.greet', { w: word.w, mean: T('g.nat.mean.' + word.mean), line: T('g.nat.line.' + kind) }) };
  };
  // the greeting's gesture, f: 0 → 1 over GREET_S (adds to the pose; nothing at its ends)
  N.greetPose = function (P, kind, f) {
    if (!(f > 0 && f < 1) || !P.body) return;
    const w = Math.sin(f * Math.PI), add = (j, i, v) => { const q = P[j]; if (q) q[i] += v; };
    if (kind === 'aqua') {   // both hands raised before the chest, fluttering like fins, the body swaying
      add('arm_l', 0, 1.1 * w); add('arm_r', 0, 1.1 * w); add('fore_l', 0, 0.9 * w); add('fore_r', 0, 0.9 * w);
      add('fore_l', 2, Math.sin(f * 40) * 0.35 * w); add('fore_r', 2, -Math.sin(f * 40 + 0.7) * 0.35 * w); add('body', 2, Math.sin(f * 9) * 0.08 * w);
    } else if (kind === 'ocker') {   // the long neck bowed, the arms opened wide
      add('head', 0, -0.55 * w); add('body', 0, -0.12 * w); add('arm_l', 2, -0.95 * w); add('arm_r', 2, 0.95 * w);
    } else if (kind === 'zinn') {    // the hands together before the chest, then opened to you (the warmth shared)
      const o = f > 0.55 ? (f - 0.55) / 0.45 : 0;
      add('arm_l', 0, 1.0 * w); add('arm_r', 0, 1.0 * w); add('fore_l', 0, 1.1 * w * (1 - o)); add('fore_r', 0, 1.1 * w * (1 - o));
      add('arm_l', 2, -0.6 * o * w); add('arm_r', 2, 0.6 * o * w);
    } else if (kind === 'basalt') {  // two happy hops, the arms up and out
      add('hips', 4, Math.abs(Math.sin(f * Math.PI * 4)) * 2.4 * w); add('arm_l', 0, 1.5 * w); add('arm_r', 0, 1.5 * w); add('arm_l', 2, -0.9 * w); add('arm_r', 2, 0.9 * w);
    } else {                          // a hand to the chest, a slow deep bow
      add('body', 0, -0.35 * w); add('head', 0, -0.2 * w); add('arm_r', 0, 0.9 * w); add('fore_r', 0, 1.2 * w); add('arm_r', 2, -0.25 * w);
    }
  };
  // where someone near the player waits during a talk: on the line from the player through them, HUSH_D away
  N.hushSpot = function (pos, pl) {
    let dx = pos[0] - pl[0], dz = pos[2] - pl[2]; const d = Math.hypot(dx, dz);
    if (d < 0.05) { dx = 1; dz = 0; } else { dx /= d; dz /= d; }
    return [pl[0] + dx * N.HUSH_D, pos[1], pl[2] + dz * N.HUSH_D];
  };
  // someone inside the monument (a stuck villager is put back on its goal — the plaza's middle — in the monument's
  // solid shell; the Nivari's vault has an open way under it): out on the ring, 4.5 m from the middle → [x, z] or null
  N.offMonument = function (pos, pz, kind) {
    if (kind === 'opal' || !pz) return null;
    const cx = pz.x + 0.5, cz = pz.z + 0.5, dx = pos[0] - cx, dz = pos[2] - cz, d = Math.hypot(dx, dz);
    if (d >= 2.4 || Math.abs(pos[1] - pz.y) > 3) return null;
    const an = d > 0.05 ? Math.atan2(dz, dx) : 0.7;
    return [cx + Math.cos(an) * 4.5, cz + Math.sin(an) * 4.5];
  };
  // the quest's text for the talk panel
  N.status = function (meta, kind) {
    const r = N.rec(meta, kind), sp = T('g.eco.sp.' + kind), Q = N.CHAIN[kind];
    const words = N.known(meta, kind).map(o => o.w + ' (' + T('g.nat.mean.' + o.mean) + ')').join(' · ');
    const wl = words ? '\n' + T('g.nat.words', { list: words }) : '';
    if (r.s === 0) return T('g.nat.q0', { sp, n: r.met.length, of: Q[0].n }) + wl;
    if (r.s === 1) return T('g.nat.q1', { sp, n: Q[1].n, item: VR.itemName ? VR.itemName(Q[1].item) : Q[1].item, why: T('g.nat.why.' + kind) }) + wl;
    if (r.s === 2) return T('g.nat.q2', { sp, what: T('g.eco.cult.' + kind) }) + wl;
    return T('g.nat.q3', { sp, what: N.teachText(kind) }) + wl;
  };
  N.teachText = function (kind) {
    const Tt = N.TEACH[kind], nm = (id) => (VR.itemName ? VR.itemName(id) : id);
    if (Tt.type === 'pieces') return T('g.nat.teach.pieces', { name: T('g.nat.set.' + kind), n: Tt.pieces.length });
    if (Tt.type === 'gadget') return T('g.nat.teach.gadget', { item: nm(Tt.out), ins: Tt.ins.map(nm).join(' + ') });
    return T('g.nat.teach.recipe', { ins: Tt.ins.map(nm).join(' + '), n: Tt.n, out: nm(Tt.out) });
  };
  N.keys = function () {
    const k = ['g.nat.greet', 'g.nat.words', 'g.nat.opt', 'g.nat.give', 'g.nat.short', 'g.nat.thanks', 'g.nat.q0', 'g.nat.q1', 'g.nat.q2', 'g.nat.q3', 'g.nat.done0', 'g.nat.learnt', 'g.nat.teach.recipe', 'g.nat.teach.pieces', 'g.nat.teach.gadget'];
    for (const m of MEAN) k.push('g.nat.mean.' + m);
    for (const kind of KINDS) { k.push('g.nat.line.' + kind, 'g.nat.why.' + kind); if (N.TEACH[kind].type === 'pieces') k.push('g.nat.set.' + kind); }
    return k;
  };

  // ---------------------------------------------------------------- the game's side
  const kindOfA = (a) => (a && a.p && a.p.look && a.p.look.species) || null;
  const H = (s) => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  N.taught = function (g, kind) {
    const Tt = N.TEACH[kind];
    if (Tt.type === 'pieces' && VR.Favs && VR.Favs.addMany) VR.Favs.addMany(Tt.pieces.filter(id => VR.R && VR.R.byName[id.slice(2)]));
    if (g && g.ui && g.ui.toast) g.ui.toast('🗝 ' + T('g.nat.learnt', { sp: T('g.eco.sp.' + kind) }), N.teachText(kind));
    if (g && g.player && g.player.inv) g.player.inv.changed = true;
  };
  // the culture moment's join counts as the third quest
  const WL = VR.WorldLife;
  if (WL && WL.cultJoin && !WL.cultJoin.__nat) {
    const cj = WL.cultJoin;
    WL.cultJoin = function (g, vil) {
      const r = cj.apply(this, arguments);
      const kind = vil && vil.plan && vil.plan.species;
      if (r && kind && g && N.cult(g.meta || (g.meta = {}), kind, g.player && g.player.inv)) N.taught(g, kind);
      return r;
    };
    WL.cultJoin.__nat = true;
  }
  // the greeting's gesture over the pose (villages.js pose() → WL.idle, its last argument the villager)
  if (WL && WL.idle && !WL.idle.__nat) {
    const id0 = WL.idle;
    WL.idle = function (P, kind, t, wa, state, a) { id0.apply(this, arguments); if (a && a.greetT > 0) N.greetPose(P, kind, 1 - a.greetT / N.GREET_S); };
    WL.idle.__nat = true;
  }
  // the taught recipes at the crafting grid
  const C = VR.Crafting;
  if (C && C.match && !C.match.__nat) {
    const m0 = C.match;
    C.match = function (grid, n) { const g = VR.game, r = g && g.meta && g.meta.natives ? N.match(grid, n, g.meta) : null; return r || m0.apply(this, arguments); };
    C.match.__nat = true;
  }
  const Vs = VR.Villages;
  if (Vs && !Vs.prototype.__nat) {
    const VP = Vs.prototype; VP.__nat = true;
    const ua = VP.updateAgent;
    VP.updateAgent = function (a, dt, tod) {
      if (a.greetT > 0) a.greetT -= dt;
      const vil = a.vil, kind = vil && vil.plan && vil.plan.species;
      if (!kind) return ua.call(this, a, dt, tod);
      const g = this.g, pl = g.player.pos;
      const still = () => { a.t += dt; if (a.bubble) { a.bubble.t -= dt; if (a.bubble.t <= 0) a.bubble = null; } a.vel[0] = 0; a.vel[2] = 0; a.walkAmt += (0 - a.walkAmt) * Math.min(1, dt * 6); };
      // the one you talk to: turned to you, standing
      if (this.talking === a) {
        still();
        let dy = Math.atan2(-(pl[0] - a.pos[0]), -(pl[2] - a.pos[2])) - a.yaw; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
        a.yaw += dy * Math.min(1, dt * 6); a.lookAt = pl;
        return;
      }
      // 📷: the people near the camera hold still for a picture
      const pc = g.photoCam;
      if (pc && pc.on && pc.s) {
        if ((a.photoT = (a.photoT || 0) + dt) < N.PHOTO_S && (a.pos[0] - pc.s.x) ** 2 + (a.pos[2] - pc.s.z) ** 2 < N.PHOTO_R * N.PHOTO_R) { still(); return; }
      } else a.photoT = 0;
      // making room during a talk
      if (a.hush) {
        if (this.talking) a.hush.t = Math.max(a.hush.t, 4);
        a.hush.t -= dt;
        if (a.hush.t > 0) {
          a.t += dt; if (a.bubble) { a.bubble.t -= dt; if (a.bubble.t <= 0) a.bubble = null; }
          a.steer = [a.hush.spot[0], a.hush.spot[2]]; a.path = null;
          a.lookAt = this.talking ? this.talking.pos : null;
          this.move(a, dt); return;
        }
        a.hush = null; a.lookAt = null;
      }
      // the plaza's ring: round the monument, not in it (4–6 m from the middle)
      const act = a.act, pz = vil.plan.plaza;
      { const o = N.offMonument(a.pos, pz, kind); if (o) { a.pos[0] = o[0]; a.pos[2] = o[1]; a.pos[1] = pz.y; a.path = null; } }
      if (act && act.type === 'plaza' && act.spot && act.spot.length === 3 && pz) {
        const dx = act.spot[0] + 0.5 - (pz.x + 0.5), dz = act.spot[2] + 0.5 - (pz.z + 0.5), d = Math.hypot(dx, dz);
        if (d < 3.9) { const an = d > 0.1 ? Math.atan2(dz, dx) : (H(a.p.id) % 628) / 100, r = 4 + (H(a.p.id + 'r') % 20) / 10; act.spot[0] = Math.floor(pz.x + 0.5 + Math.cos(an) * r); act.spot[2] = Math.floor(pz.z + 0.5 + Math.sin(an) * r); }
      }
      return ua.call(this, a, dt, tod);
    };
    const ot = VP.openTalk;
    VP.openTalk = function (a) {
      const r = ot.apply(this, arguments);
      const kind = kindOfA(a); if (!kind || !N.LANG[kind]) return r;
      const g = this.g, meta = g.meta || (g.meta = {}), pl = g.player.pos;
      const gr = N.greeting(meta, kind, H(a.p.id + ':' + ((this.time || 0) | 0)));
      if (gr) { this.talkText(gr.text); a.say(gr.word.w + '!', 2.5); }
      a.greetT = N.GREET_S; a.path = null;
      const ev = N.talked(meta, kind, a.p.id);
      if (ev && ev.done === 0 && g.ui && g.ui.chatLine) g.ui.chatLine('🗝 ' + T('g.nat.done0', { sp: T('g.eco.sp.' + kind), item: VR.itemName ? VR.itemName(N.CHAIN[kind][1].item) : N.CHAIN[kind][1].item, n: N.CHAIN[kind][1].n }), '#ffd98a');
      // the others make room
      for (const o of a.vil.agents) {
        if (o === a || o.pose === 'sleep' || o.inBoat) continue;
        if ((o.pos[0] - pl[0]) ** 2 + (o.pos[2] - pl[2]) ** 2 < N.HUSH_R * N.HUSH_R) o.hush = { t: 6, spot: N.hushSpot(o.pos, pl) };
      }
      return r;
    };
    const to = VP.talkOptions;
    VP.talkOptions = function (a) {
      const r = to.apply(this, arguments);
      const kind = kindOfA(a); if (!kind || !N.LANG[kind] || typeof document === 'undefined') return r;
      const box = document.getElementById('tk_opts'); if (!box) return r;
      const g = this.g, meta = g.meta || (g.meta = {});
      const mk = (label, fn) => { const b = document.createElement('button'); b.className = 'btn small'; b.textContent = label; b.onclick = () => { this.chirp(a); fn(); }; return b; };
      box.insertBefore(mk(T('g.nat.opt', { sp: T('g.eco.sp.' + kind) }), () => {
        this.talkText(N.status(meta, kind));
        if (N.step(meta, kind) === 1 && !box.querySelector('[data-natgive]')) {
          const q = N.CHAIN[kind][1];
          const b = mk(T('g.nat.give', { n: q.n, item: VR.itemName ? VR.itemName(q.item) : q.item }), () => {
            const inv = g.player && g.player.inv;
            if (N.give(meta, kind, inv)) { this.talkText(T('g.nat.thanks', { w: N.LANG[kind][1].w, mean: T('g.nat.mean.thanks'), what: T('g.eco.cult.' + kind) })); a.greetT = N.GREET_S; b.remove(); if (g.ui.updateHUD) g.ui.updateHUD(true); }
            else this.talkText(T('g.nat.short', { have: inv ? inv.count(q.item) : 0, n: q.n }));
          });
          b.setAttribute('data-natgive', '1'); box.insertBefore(b, box.children[1] || null);
        }
      }), box.firstChild);
      return r;
    };
  }
})(VR);
