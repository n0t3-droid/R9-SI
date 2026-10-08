// ============================================================================
// 🪞 Spiegel-Bauen in the game (wave 2, W-C). The mode (⇧M — M alone stays the Weltkarte —, the HUD chip, the pause
// menu's creative tools, /spiegel), its centre (the block you point at; aim near an edge for "between two blocks"),
// the copies of every block the hand places or breaks, and the axis guide the renderer draws (renderer.drawGuide).
// Where the copies go and what state each gets is VR.Mirror (src/shared/mirror.js); the copies themselves go through
// the world's normal edit path (world.setBlock … 4): saved with the column, sent to the other players by the world
// listener like any edit, seen by the sim and the villages. The hand plays its sound and particles once; the copies
// make none. Kreativ and Zen only — Überleben gets a kind hint.
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R, F = VR.F, MI = VR.Mirror;
  const tx = (k, v, de, en) => (VR.I18N ? VR.I18N.tx(k, v, de, en) : String(de !== undefined ? de : k).replace(/\{(\w+)\}/g, (m, n) => (v && v[n] !== undefined ? v[n] : m)));
  const modeLabel = (m) => (m === 'x' ? tx('g.mirror.x', null, 'X', 'X') : m === 'z' ? tx('g.mirror.z', null, 'Z', 'Z') : m === 'xz' ? tx('g.mirror.xz', null, '4-fach', '4-way') : m === 'r8' ? tx('g.mirror.r8', null, '8-fach', '8-way') : tx('g.mirror.off', null, 'aus', 'off'));
  const WORDS = { x: 'x', z: 'z', 4: 'xz', xz: 'xz', '4-fach': 'xz', '4-way': 'xz', 8: 'r8', r8: 'r8', '8-fach': 'r8', '8-way': 'r8', rund: 'r8', round: 'r8', aus: null, off: null, 0: null };
  const CENTRE_REACH = 32;   // the centre can be set on the ground a little further away than the hand reaches
  const FAR = 96;            // an edit further from the centre (blocks, along x or z) is not mirrored: no copies land far away by surprise
  // aiming near an edge of the face you look at (a quarter block) puts the axis between the two blocks there
  const snap = (p, b) => { const f = p - b; return f < 0.25 ? 2 * b : f > 0.75 ? 2 * b + 2 : 2 * b + 1; };

  class MirrorBuild {
    constructor(game) {
      this.g = game;
      this.mode = null;            // null (aus) | 'x' | 'z' | 'xz' | 'r8'
      this.c2x = 1; this.c2z = 1;  // the centre, doubled: odd = on a block, even = between two
      this.gy = 0;                 // the ground the guide stands on
      this.pulse = 0;              // the plane glows a moment after a mirrored edit
      this.busy = false;
      this.stats = { placed: 0, broken: 0, skipped: 0 };
      // the guide the renderer draws: allocated once, refilled only when the mirror changes (G.ver)
      this.G = {
        verts: new Float32Array(MI.GUIDE_FLOATS), ver: 0, ox: 0, oy: 0, oz: 0,
        parts: [{ at: 0, n: 0, c: [0.35, 0.95, 1.0, 0.16] }, { at: 0, n: 0, c: [0.78, 1.0, 1.0, 0.92] }, { at: 0, n: 0, c: [0.4, 0.92, 1.0, 0.07] }],
      };
      this.res = {};
      this.chip = null; this.chipSig = -1;
      // the language switches live: the chip is written again (one listener for every world of the session)
      if (!MirrorBuild.langHooked && VR.I18N && VR.I18N.on) { MirrorBuild.langHooked = true; VR.I18N.on(() => { const m = VR.game && VR.game.mirror; if (m) m.chipSig = -1; }); }
    }
    // the mirror works: a mode, a player in Kreativ or Zen
    active() { const p = this.g.player; return !!(this.mode && p && p.creative && !p.dead); }
    label(m) { return modeLabel(m === undefined ? this.mode : m); }
    say(text, ms) { const ui = this.g.ui; if (ui && ui.hint) ui.hint(text, ms || 2600); }
    survivalHint() { this.say(tx('g.mirror.survival', null, '🪞 Spiegel-Bauen ist ein Werkzeug für Kreativ und Zen — dort entsteht jeder Block auch gespiegelt.', '🪞 Mirror building is a tool for Creative and Zen — there every block appears mirrored too.'), 3800); }

    // ---------------------------------------------------------------- switching
    // ⇧M (game.handleKeys): Überleben → the hint; else the next mode (aus → X → Z → 4-fach → 8-fach → aus)
    key() { const p = this.g.player; if (!p) return; if (!p.creative) { this.survivalHint(); return; } this.cycle(); }
    // the next mode; switched on, the centre goes where you point
    cycle() { this.set(MI.next(this.mode), !this.mode); }
    set(mode, recentre) {
      mode = MI.MODES.indexOf(mode) >= 0 ? mode : null;
      if (mode && (recentre || !this.mode)) this.centre();
      this.mode = mode;
      this.rebuild();
      this.chipSig = -1; this.hud();
      if (!mode) { this.say(tx('g.mirror.offHint', null, '🪞 Spiegel aus', '🪞 Mirror off'), 1800); return; }
      const name = this.label() + (mode === 'r8' ? ' ' + tx('g.mirror.round', null, '(rund)', '(round)') : '');
      this.say(tx('g.mirror.on', { mode: name }, '🪞 Spiegel {mode} — was du setzt oder abbaust, passiert auch gespiegelt · ⇧M wechselt', '🪞 Mirror {mode} — what you place or break happens mirrored too · ⇧M switches'), 3200);
    }
    // /spiegel [x|z|4|8|aus] (/mirror): a mode straight away, the centre where you point; no word: like ⇧M
    command(a) {
      const p = this.g.player; if (!p) return;
      if (!p.creative) { this.survivalHint(); return; }
      const w = String((a && a[0]) || '').toLowerCase();
      if (!w) { this.cycle(); return; }
      if (!Object.prototype.hasOwnProperty.call(WORDS, w)) { if (this.g.ui) this.g.ui.chatLine(tx('g.mirror.usage', null, '🪞 /spiegel x · z · 4 · 8 · aus — die Mitte ist der Block, auf den du zeigst', '🪞 /mirror x · z · 4 · 8 · off — the centre is the block you point at'), '#cfe6ff'); return; }
      this.set(WORDS[w], true);
    }
    // the centre: the block you point at (aim near one of its edges: between it and its neighbour there), else the
    // block under you; the guide stands on the top of the block you point at, or at your feet
    centre() {
      const g = this.g, p = g.player, w = g.world; if (!p || !w) return;
      const e = p.eyePos(), d = p.lookDir();
      const hit = VR.PHYS.raycast((x, y, z) => w.getBlock(x, y, z), e[0], e[1], e[2], d[0], d[1], d[2], CENTRE_REACH, { nb: (x, y, z, k) => w.getBlock(x + VR.HF_DX[k], y, z + VR.HF_DZ[k]) });
      if (hit) {
        const f = hit.face;
        this.c2x = f === 0 || f === 1 ? 2 * hit.x + 1 : snap(hit.px, hit.x);
        this.c2z = f === 4 || f === 5 ? 2 * hit.z + 1 : snap(hit.pz, hit.z);
        this.gy = f === 2 ? hit.y + 1 : (p.onGround ? Math.floor(p.pos[1] + 0.01) : hit.y);
      } else {
        this.c2x = 2 * Math.floor(p.pos[0]) + 1; this.c2z = 2 * Math.floor(p.pos[2]) + 1; this.gy = Math.floor(p.pos[1] + 0.01);
      }
    }
    // the centre this mode works with (8-fach: both on a block or both between)
    centreNow() { return MI.center(this.mode, this.c2x, this.c2z); }
    // an edit this far from the centre is not mirrored (a hint now and then says why)
    tooFar(x, z) {
      if (Math.max(Math.abs(2 * x + 1 - this.c2x), Math.abs(2 * z + 1 - this.c2z)) <= 2 * FAR) return false;
      const now = Date.now();
      if (!(now - (this.farAt || 0) < 8000)) { this.farAt = now; this.say(tx('g.mirror.far', null, '🪞 Weit weg vom Spiegel: hier wird nichts gespiegelt · /spiegel 4 setzt ihn hierher', '🪞 Far from the mirror: nothing is mirrored here · /mirror 4 moves it here'), 3600); }
      return true;
    }

    // ---------------------------------------------------------------- the copies
    // the hand placed these cells (player.afterPlace): every copy that fits goes in, a piece whole or not at all
    onPlace(cells, player) {
      if (!this.active() || this.busy || !cells || !cells.length || this.tooFar(cells[0].x, cells[0].z)) return 0;
      const g = this.g, w = g.world, T = R.T;
      const c = this.centreNow(), groups = MI.copies(this.mode, c[0], c[1], cells);
      let n = 0;
      this.busy = true;
      try {
        for (const gr of groups) {
          if (!this.fits(gr, player)) { this.stats.skipped++; continue; }
          for (const q of gr) {
            const prev = w.getBlock(q.x, q.y, q.z);
            if (!w.setBlock(q.x, q.y, q.z, q.state, 4 | (VR.SB_EDIT || 0))) continue;
            if (prev && (T.flags[prev] & F.WATER) && (T.flags[q.state] & F.WATERLOG) === 0 && g.onFluidDisplaced) g.onFluidDisplaced(q.x, q.y, q.z, prev);
          }
          n++;
        }
      } finally { this.busy = false; }
      if (n) { this.stats.placed += n; this.pulse = 1; }
      return n;
    }
    // can a copy go in? every cell loaded, free (or a single slab of the same kind that becomes double), not in the
    // player or an animal, a plant on soil
    fits(gr, player) {
      const w = this.g.world, T = R.T;
      for (let i = 0; i < gr.length; i++) {
        const q = gr[i];
        if (q.y < 0 || q.y >= VR.MAXY || !w.col(q.x >> 4, q.z >> 4)) return false;
        const cur = w.getBlock(q.x, q.y, q.z);
        if (cur && !(T.flags[cur] & F.REPLACE) && !this.slabJoin(cur, q.state)) return false;
        if (player && player.placeBlocked && player.placeBlocked(q.x, q.y, q.z, q.state)) return false;
        if (i === 0 && (T.flags[q.state] & F.PLANT) && VR.Place && !VR.Place.soilOK(R.types[T.type[q.state]], w, q.x, q.y, q.z)) return false;
      }
      return true;
    }
    slabJoin(cur, s) {
      const T = R.T; if (T.type[cur] !== T.type[s]) return false;
      const t = R.types[T.type[s]];
      return !!t && t.o.kind === 'slab' && t.get(s, 'type') === 2 && t.get(cur, 'type') !== 2;
    }
    // the hand broke a block (player.breakBlock): at every mirrored spot whatever is there goes too (not air, not water)
    // — a door, a bed or a model first looks for its own kind in the mirrored footprint; breakMulti takes the rest
    onBreak(x, y, z, s, player) {
      if (!this.active() || this.busy || !player || !player.removeBlock || this.tooFar(x, z)) return 0;
      const g = this.g, w = g.world, T = R.T, type = R.types[T.type[s]];
      if (!type) return 0;
      const cells = this.pieceCells(x, y, z, s, type), c = this.centreNow(), done = new Set([x + ',' + y + ',' + z]);
      let n = 0;
      this.busy = true;
      try {
        for (const t of MI.transforms(this.mode)) {
          let at = null;
          if (cells.length > 1) for (const q of cells) { const p = MI.pos(t, c[0], c[1], q[0], q[2]), cur = w.getBlock(p[0], q[1], p[1]); if (cur && T.type[cur] === type.id) { at = [p[0], q[1], p[1]]; break; } }
          if (!at) { const p = MI.pos(t, c[0], c[1], x, z); at = [p[0], y, p[1]]; }
          const k = at[0] + ',' + at[1] + ',' + at[2];
          if (done.has(k)) continue;
          done.add(k);
          const cur = w.getBlock(at[0], at[1], at[2]);
          if (!cur || (T.flags[cur] & F.FLUID)) continue;
          player.removeBlock(at[0], at[1], at[2], cur);
          n++;
        }
      } finally { this.busy = false; }
      if (n) { this.stats.broken += n; this.pulse = 1; }
      return n;
    }
    // the cells of the piece a broken block belonged to ([x, y, z], the broken one first)
    pieceCells(x, y, z, s, type) {
      const out = [[x, y, z]], o = type.o;
      if ((o.kind === 'door' || o.tall) && type.has('half')) out.push([x, y + (type.get(s, 'half') ? -1 : 1), z]);
      else if (o.kind === 'bed' && type.has('part')) { const f = type.get(s, 'facing'), d = type.get(s, 'part') ? -1 : 1; out.push([x + VR.HF_DX[f] * d, y, z + VR.HF_DZ[f] * d]); }
      else if (VR.VM && VR.VM.MODELS && VR.VM.MODELS[type.name] && type.has('part')) {
        for (const q of VR.VM.partCells(VR.VM.MODELS[type.name], type.get(s, 'facing'), type.get(s, 'part'), x, y, z)) if (q[0] !== x || q[1] !== y || q[2] !== z) out.push(q);
      }
      return out;
    }

    // ---------------------------------------------------------------- every frame
    update(dt) {
      if (this.pulse > 0) this.pulse = Math.max(0, this.pulse - dt * 1.4);
      const p = this.g.player;
      if (this.mode && p && !p.creative) { this.mode = null; this.rebuild(); }   // back to Überleben: the mirror goes off
      this.hud();
    }
    // the guide for the renderer (the same object every frame), or null
    guide() {
      if (!this.active() || this.g.hideHud || this.g.photo) return null;
      this.G.parts[2].c[3] = 0.07 + 0.17 * this.pulse;
      return this.G;
    }
    rebuild() {
      const G = this.G;
      if (!this.mode) { G.parts[0].n = G.parts[1].n = G.parts[2].n = 0; G.ver++; return; }
      const r = MI.guide(this.mode, G.verts, this.res), c = this.centreNow();
      G.parts[0].at = r.halo[0]; G.parts[0].n = r.halo[1];
      G.parts[1].at = r.core[0]; G.parts[1].n = r.core[1];
      G.parts[2].at = r.plane[0]; G.parts[2].n = r.plane[1];
      G.ox = c[0] / 2; G.oy = this.gy; G.oz = c[1] / 2;
      G.ver++;
    }
    // the HUD chip (Einfach and Profi, Kreativ and Zen): 🪞 Spiegeln when off, 🪞 4-fach when on; a click switches
    hud() {
      const g = this.g, p = g.player, show = !!(p && p.creative && g.state === 'play' && !g.hideHud);
      const sig = (show ? 1 : 0) | ((MI.MODES.indexOf(this.mode) + 1) << 1);
      if (sig === this.chipSig) return;
      this.chipSig = sig;
      if (typeof document === 'undefined') return;
      let el = this.chip || document.getElementById('mirrorchip');
      if (!el) {
        const hud = document.getElementById('hud'); if (!hud) return;
        el = document.createElement('button'); el.id = 'mirrorchip'; el.type = 'button';
        hud.appendChild(el);
      }
      if (el !== this.chip) {
        this.chip = el;
        el.onclick = (e) => { e.preventDefault(); e.stopPropagation(); const gg = VR.game || g; if (gg.mirror) gg.mirror.key(); if (gg.audio) gg.audio.play('click'); };
        // the press stays on the chip: without a pointer lock (drag-to-look) a release reaching the window would count
        // as a click on the world and break the block under the crosshair
        el.onmousedown = el.onmouseup = (e) => e.stopPropagation();
      }
      el.textContent = '🪞 ' + (this.mode ? this.label() : tx('g.mirror.name', null, 'Spiegeln', 'Mirror'));
      el.title = tx('g.mirror.tip', null, 'Spiegel-Bauen (⇧M): jeder Block, den du setzt oder abbaust, entsteht auch gespiegelt', 'Mirror building (⇧M): every block you place or break appears mirrored too');
      el.classList.toggle('on', !!this.mode);
      el.style.display = show ? 'block' : 'none';
    }
    // the pause menu's button text (ui.buildZenPanel)
    pauseLabel() { return tx('g.mirror.pause', { mode: this.label() }, '🪞 Spiegel: {mode}', '🪞 Mirror: {mode}'); }
  }
  VR.MirrorBuild = MirrorBuild;
})(VR);
