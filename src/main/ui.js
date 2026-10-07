// ============================================================================
// UI: title (live panorama), worlds, create world, loading, HUD, inventories,
// pause, settings, death, chat/commands, toasts, tooltips, codex.
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // the player's language (lang_de.js / lang_en.js): T a text, TL a list of lines; static panels carry data-t keys
  const T = (k, v, fb) => (VR.I18N ? VR.I18N.t(k, v, fb) : (fb !== undefined ? fb : k)), TL = (k) => (VR.I18N && VR.I18N.list ? VR.I18N.list(k) : []);
  // the start screen's splash line (Profi): TL('g.title.splashes')
  // the loading tips: TL('g.load.tips')
  // (the invitation steps and the offline note are in the tables: g.mp.inviteHow, g.mp.off)
  // the creative palette's tabs: their names are g.cat.<key> in the tables
  const CAT_TABS = ['fav', 'build', 'modern', 'vmodern', 'blueprints', 'arch', 'vtech', 'vlife', 'vshop', 'nature', 'func', 'volt', 'tech', 'tools', 'combat', 'food', 'items', 'spawn', 'search'];

  class UI {
    constructor(game) {
      this.game = game;
      this.root = $('#ui');
      this.cursor = null; // stack held by mouse
      this.blocking = false; this.typing = false;
      this.screen = null;
      this.hudSlots = [];
      this.settingsTab = 'graphics';
      this.build();
    }
    build() {
      const r = this.root;
      r.innerHTML = `
      <div id="title" class="screen">
        <div class="logo">R9&#8209;SI</div>
        <div class="tagline">Voxel Realm · Starforge Edition</div>
        <div class="splash" style="margin-left:360px;margin-top:-10px" id="splash"></div>
        <div class="menu">
          <button class="btn primary" data-act="play">Play</button>
          <button class="btn" data-act="quick">Quick Start · Creative</button>
          <button class="btn" data-act="settings">Settings</button>
          <button class="btn studio" data-act="studio" title="Häuser umbauen, Items verschönern, deine Welten planen — Update übernimmt alles ins Spiel">R9 Studio · Crafter · Welt</button>
        </div>
        <div id="studionote" class="studionote"></div>
        <div id="mphosts" class="mphosts"></div>
        <div id="titlenote" class="titlenote"></div>
        <div class="foot"><span id="gpuinfo"></span><span>Original voxel game · inspired by the block sandbox genre</span></div>
      </div>
      <div id="worlds" class="screen"><div class="panel box">
        <h2>Select World</h2>
        <div class="worldlist" id="worldlist"></div>
        <div class="row gap" style="flex-wrap:wrap">
          <button class="btn primary small" data-act="playsel" id="playsel" disabled>Play Selected</button>
          <button class="btn small" data-act="create">Create New World</button>
          <button class="btn small" data-act="studiosel" id="studiosel" disabled title="Place houses and furniture in this world in R9 Studio">Plan in R9 Studio</button>
          <button class="btn small danger" data-act="delete" id="delsel" disabled>Delete</button>
          <button class="btn small" data-act="back">Back</button>
        </div>
      </div></div>
      <div id="create" class="screen"><div class="panel box">
        <h2>Create New World</h2>
        <div class="field"><label>World name</label><input type="text" id="cw_name" value="New World" maxlength="40"></div>
        <div class="field"><label>Game mode</label><div class="seg" id="cw_mode">
          <button data-v="survival">Survival<small>Gather, craft, survive</small></button>
          <button data-v="creative" class="on">Creative<small>Unlimited blocks, flight</small></button>
          <button data-v="zen">Zen Builder<small>Unbothered: no mobs, no damage</small></button></div></div>
        <div class="field"><label>Difficulty</label><div class="seg" id="cw_diff">
          <button data-v="peaceful">Peaceful</button><button data-v="easy">Easy</button><button data-v="normal" class="on">Normal</button><button data-v="hard">Hard</button></div></div>
        <div class="field"><label>World type</label><div class="seg" id="cw_type">
          <button data-v="default" class="on">Realm</button><button data-v="large">Large Biomes</button><button data-v="amplified">Amplified</button><button data-v="flat">Flat</button></div></div>
        <div class="field"><label>Seed (optional)</label><input type="text" id="cw_seed" placeholder="Leave blank for random"></div>
        <div class="row gap" style="flex-wrap:wrap">
          <label class="row gap note"><input type="checkbox" id="cw_cheats" checked> Commands</label>
          <label class="row gap note"><input type="checkbox" id="cw_keep"> Keep inventory</label>
          <label class="row gap note"><input type="checkbox" id="cw_kit" checked> Starter kit</label>
        </div>
        <div class="hr"></div>
        <div class="row gap"><button class="btn primary" data-act="docreate">Create World</button><button class="btn small" data-act="toworlds">Cancel</button></div>
      </div></div>
      <div id="loading" class="screen">
        <div class="logo" style="font-size:64px">R9&#8209;SI</div>
        <div id="loadmsg" style="margin:26px 0 12px;font-size:18px;letter-spacing:2px" data-t="g.load.world"></div>
        <div class="bar"><div id="loadbar"></div></div>
        <div class="tip" id="loadtip"></div>
      </div>
      <div id="hud">
        <div id="crosshair"></div>
        <div id="hotbar"></div>
        <div id="stats"><div class="meter" id="hearts"></div><div class="meter" id="food"></div></div>
        <div class="meter" id="air" style="position:absolute;bottom:102px;left:50%;transform:translateX(18px)"></div>
        <div id="xpbar"><div></div></div><div id="xplvl"></div>
        <div id="itemname"></div>
        <div id="debug"></div><div id="fps"></div>
        <div id="toasts"></div>
        <div id="chatlog"></div>
        <div id="modebadge"></div>
        <div id="hint"></div>
        <canvas id="minimap" width="180" height="180"></canvas><div id="compass"></div>
        <div id="vehiclehud"></div>
      </div>
      <input type="text" id="chatin" maxlength="200" autocomplete="off">
      <div id="pause" class="screen"><div class="panel box col gap" style="align-items:stretch;min-width:340px">
        <h2 style="text-align:center" data-t="g.pause.title"></h2>
        <button class="btn primary" data-act="resume" data-t="g.pause.resume"></button>
        <button class="btn studio" data-act="studiolive" id="studiolive" data-t="g.pause.studio" data-tt="g.pause.studioTip"></button>
        <div id="mppanel" class="col gap"></div>
        <div class="row gap"><button class="btn" data-act="gohome" style="flex:1" data-t="g.pause.home"></button><button class="btn" data-act="sethome" style="flex:1" data-t="g.pause.spawn" data-tt="g.pause.spawnTip"></button></div>
        <div id="zenpanel" class="col gap"></div>
        <button class="btn" data-act="codex" data-t="g.pause.codex"></button>
        <button class="btn" data-act="photo" data-t="g.pause.photo"></button>
        <button class="btn" data-act="settings" data-t="g.pause.settings"></button>
        <button class="btn" data-act="quit" data-t="g.pause.quit"></button>
        <div class="note" style="text-align:center" id="pausenote"></div>
      </div></div>
      <div id="settings" class="screen"><div class="panel box" style="min-width:min(640px,94vw)">
        <h2 data-t="g.set.title"></h2>
        <div class="tabs" id="settabs"></div>
        <div id="setbody"></div>
        <div class="hr"></div>
        <button class="btn small" data-act="setback" data-t="g.set.done"></button>
      </div></div>
      <div id="inventory" class="screen"><div class="panel" id="invpanel"></div></div>
      <div id="death" class="screen"><h1 data-t="g.death.title"></h1><div id="deathmsg" style="margin:12px 0 26px;color:#ffd0d0;font-size:20px"></div>
        <div class="row gap"><button class="btn primary" data-act="respawn" data-t="g.death.respawn"></button><button class="btn" data-act="quit" data-t="g.death.toTitle"></button></div></div>
      <div id="codex" class="screen"><div class="panel box" style="min-width:min(900px,94vw)"><h2 data-t="g.codex.title"></h2><div class="note" id="codexsum"></div><div class="hr"></div><div class="codexgrid" id="codexgrid"></div><div class="hr"></div><button class="btn small" data-act="codexback" data-t="g.btn.back"></button></div></div>
      <div id="shipyard" class="screen"><div class="panel box" style="min-width:min(900px,96vw)">
        <h2 data-t="g.sy.title"></h2>
        <div class="row gap" style="align-items:flex-start;flex-wrap:wrap">
          <div class="col gap" id="sy_types" style="min-width:150px"></div>
          <canvas id="sy_canvas" width="560" height="360" style="width:min(560px,90vw);border-radius:12px;background:radial-gradient(ellipse at 50% 40%,#1b2544,#070a14)"></canvas>
          <div class="col gap" style="min-width:210px;max-width:260px">
            <div id="sy_name" style="font-family:var(--display);font-size:18px;color:var(--gold)"></div>
            <div id="sy_stats" class="note"></div>
            <div class="field"><label data-t="g.sy.paint"></label><select id="sy_paint"></select></div>
            <button class="btn small" data-act="syRandom" data-t="g.sy.random"></button>
            <button class="btn primary" data-act="syBuild" data-t="g.sy.launch"></button>
            <label class="row gap note"><input type="checkbox" id="sy_blocks"> <span data-t="g.sy.blocks"></span></label>
            <div class="note" data-t="g.sy.note"></div>
          </div>
        </div>
        <div class="hr"></div><button class="btn small" data-act="syClose" data-t="g.btn.close"></button>
      </div></div>
      <div id="mapscreen" class="screen"><div class="panel box col" style="align-items:center"><h2 data-t="g.map.title"></h2><canvas id="bigmap" width="640" height="640" style="width:min(640px,80vw,68vh);height:min(640px,80vw,68vh);border-radius:12px;image-rendering:pixelated;margin:10px 0"></canvas><div class="note" data-t="g.map.note"></div></div></div>
      <div id="cursor"><canvas width="48" height="48"></canvas><div class="cnt"></div></div>
      <div id="tooltip"></div>`;
      this.retext();
      // the language switches live: static texts again, the open panel rebuilt, the HUD badge and hint renewed
      if (VR.I18N && VR.I18N.on) VR.I18N.on(() => this.onLang());
      // bind buttons
      r.addEventListener('click', (e) => { const b = e.target.closest('[data-act]'); if (b) { this.game.audio.play('click'); this.act(b.dataset.act, b); } });
      for (const id of ['cw_mode', 'cw_diff', 'cw_type']) $('#' + id).addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; for (const x of b.parentNode.children) x.classList.toggle('on', x === b); });
      { const sp = TL('g.title.splashes'); this.splashI = Math.floor(Math.random() * Math.max(1, sp.length)); $('#splash').textContent = sp[this.splashI] || ''; }
      // hotbar
      const hb = $('#hotbar');
      for (let i = 0; i < 9; i++) { const s = el('div', 'slot'); s.innerHTML = `<span class="num">${i + 1}</span><canvas width="48" height="48"></canvas><span class="cnt"></span><div class="dur" style="display:none"><i></i></div>`; hb.appendChild(s); this.hudSlots.push(s); }
      // chat input
      const ci = $('#chatin');
      ci.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') { const v = ci.value.trim(); ci.value = ''; this.closeChat(); if (v) this.game.chat(v); }
        else if (e.key === 'Escape') this.closeChat();
      });
      window.addEventListener('mousemove', (e) => { this.mx = e.clientX; this.my = e.clientY; this.moveCursor(); });
      this.meterIcons();
    }
    // static texts (data-t / data-th / data-tt) from the tables of the chosen language
    retext() { if (VR.I18N && VR.I18N.retext) VR.I18N.retext(this.root); }
    onLang() {
      this.retext();
      { const sp = TL('g.title.splashes'), e = $('#splash'); if (e && sp.length) e.textContent = sp[(this.splashI || 0) % sp.length]; }
      const lh = $('#lockhint'); if (lh) lh.textContent = T('g.hud.lock');
      this.lastName = undefined; this.vhud = null;
      if (this.game.player) this.updateHUD(true);
      if (this.screen === 'settings') this.showSettings();
      else if (this.screen === 'inventory') this.renderInventory();
      else if (this.screen === 'pause') this.pause();
      else if (this.screen === 'codex') this.showCodex();
      else if (this.screen === 'shipyard') this.renderShipyard();
      else if (this.screen === 'death' && this.deathCause !== undefined) this.showDeath(this.deathCause);
    }
    meterIcons() {
      const mk = (draw) => { const c = document.createElement('canvas'); c.width = 9; c.height = 9; const x = c.getContext('2d'); draw(x); return c.toDataURL(); };
      const heart = (col, half) => (x) => { const px = [[1, 0], [2, 0], [6, 0], [7, 0], [0, 1], [3, 1], [5, 1], [8, 1], [0, 2], [4, 2], [8, 2], [0, 3], [8, 3], [1, 4], [7, 4], [2, 5], [6, 5], [3, 6], [5, 6], [4, 7]]; x.fillStyle = '#1a0306'; for (const [a, b] of px) x.fillRect(a, b, 1, 1); x.fillStyle = col; const fill = [[1, 1], [2, 1], [6, 1], [7, 1], [1, 2], [2, 2], [3, 2], [5, 2], [6, 2], [7, 2], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [3, 5], [4, 5], [5, 5], [4, 6]]; for (const [a, b] of fill) if (!half || a <= 4) x.fillRect(a, b, 1, 1); x.fillStyle = 'rgba(255,255,255,.7)'; if (col !== '#2a0a10') x.fillRect(2, 2, 1, 1); };
      const drum = (col, half) => (x) => { x.fillStyle = '#1a0d04'; x.fillRect(1, 1, 7, 7); x.fillStyle = col; for (let yy = 2; yy < 7; yy++) for (let xx = 2; xx < 7; xx++) if (!half || xx >= 4) x.fillRect(xx, yy, 1, 1); x.fillStyle = '#f0e0c0'; if (col !== '#2a1a0a') { x.fillRect(6, 0, 2, 2); } };
      const bubble = (x) => { x.fillStyle = '#9ad8ff'; x.beginPath(); x.arc(4.5, 4.5, 3.5, 0, 6.28); x.fill(); x.fillStyle = '#fff'; x.fillRect(3, 3, 1, 1); };
      this.ico = { h: mk(heart('#ff2a3a')), hh: mk(heart('#ff2a3a', true)), he: mk(heart('#2a0a10')), f: mk(drum('#c8742a')), fh: mk(drum('#c8742a', true)), fe: mk(drum('#2a1a0a')), b: mk(bubble) };
    }
    // ---------------------------------------------------------------- screens
    show(id) {
      for (const s of this.root.querySelectorAll('.screen')) s.classList.toggle('on', s.id === id);
      this.screen = id;
      const g = this.game;
      this.blocking = !!id && id !== 'hud';
      g.input.captured = !this.blocking && g.state === 'play';
      if (this.blocking) { g.input.releaseLock(); this.hideTooltip(); }
      $('#hud').classList.toggle('on', g.state === 'play');
      if (id !== 'inventory' && this.cursor) this.returnCursor();
      this.updateCursor();
    }
    hideAll() { this.show(null); }
    act(a, b) {
      const g = this.game;
      switch (a) {
        case 'play': this.showWorlds(); break;
        case 'quick': g.createWorld({ name: 'Creative ' + new Date().toLocaleDateString(), mode: 'creative', difficulty: 'peaceful', type: 'default', seed: '', cheats: true, kit: true }); break;
        case 'settings': this.prevScreen = this.screen; this.showSettings(); break;
        case 'studio': try { location.href = 'studio.html' + (location.search || ''); } catch (e) { /* no studio page next to this one */ } break;
        case 'studioimport': {
          // a 📦 r9-paket from the separate R9 Studio page (its storage is not this page's) — the file (📂) or its text
          // pasted (the older text export too): favourites, designs and Bauteile are merged in (VR.Pack)
          const n = $('#studionote'); if (!n || !VR.Custom) break;
          if (n.querySelector('textarea')) break;
          const ta = document.createElement('textarea'); ta.className = 'studioxfer'; ta.placeholder = T('g.title.importPh'); ta.setAttribute('aria-label', T('g.title.packIn'));
          const ok = document.createElement('button'); ok.className = 'btn tiny take'; ok.textContent = T('g.title.take');
          ok.onclick = () => this.studioTake(ta.value);
          const file = document.createElement('button'); file.className = 'btn tiny'; file.dataset.act = 'studiofile'; file.textContent = T('g.title.file');
          n.appendChild(ta); n.appendChild(ok); n.appendChild(file); ta.focus();
          break;
        }
        case 'studiofile': {
          let inp = document.getElementById('studioFileIn');
          if (!inp) { inp = document.createElement('input'); inp.type = 'file'; inp.id = 'studioFileIn'; inp.accept = '.json,application/json'; inp.style.display = 'none'; document.body.appendChild(inp); inp.onchange = () => { const f = inp.files && inp.files[0]; inp.value = ''; if (f) f.text().then((t) => this.studioTake(t), () => this.titleNote(T('g.title.unreadable'))); }; }
          inp.click();
          break;
        }
        case 'studioreset': {
          // two clicks: arm, then confirm (no browser dialogs in an embedded page)
          if (!VR.Custom) break;
          if (this._studioArm && Date.now() - this._studioArm < 4000) { this._studioArm = 0; g.reloadCustom({ v: 1, houses: {}, models: {} }); this.titleNote(T('g.title.resetDone')); }
          else { this._studioArm = Date.now(); const bt = this.root.querySelector('[data-act="studioreset"]'); if (bt) bt.textContent = T('g.title.resetSure'); }
          break;
        }
        case 'setback': this.show(this.prevScreen === 'pause' ? 'pause' : 'title'); this.game.saveSettings(); break;
        case 'back': this.show('title'); break;
        case 'create': this.show('create'); $('#cw_name').value = 'New World'; $('#cw_seed').value = ''; break;
        case 'toworlds': this.showWorlds(); break;
        case 'docreate': {
          const pick = (id) => $('#' + id + ' .on').dataset.v;
          const mode = pick('cw_mode');
          g.createWorld({ name: $('#cw_name').value.trim() || T('start.newWorldName'), mode, difficulty: mode === 'zen' ? 'peaceful' : pick('cw_diff'), type: pick('cw_type'), seed: $('#cw_seed').value.trim(), cheats: $('#cw_cheats').checked, keep: $('#cw_keep').checked, kit: $('#cw_kit').checked });
          break;
        }
        case 'playsel': if (this.selWorld) g.loadWorld(this.selWorld); break;
        case 'studiosel': if (this.selWorld) location.href = 'studio.html' + location.search + '#world/' + encodeURIComponent(this.selWorld.id); break;
        case 'delete': if (this.selWorld) { if (b.dataset.confirm) { g.store.deleteWorld(this.selWorld.id).then(() => this.showWorlds()); } else { b.dataset.confirm = '1'; b.textContent = 'Click again to delete'; } } break;
        case 'resume': this.resume(); break;
        case 'studiolive': if (!g.openStudio()) this.hint(T('g.pause.studioGuest'), 2400); break;
        case 'sethome': if (g.setSpawnHere()) { this.hint(T('g.pause.spawnSet'), 2600); if (this.chatLine) this.chatLine(T('g.pause.spawnSetChat'), '#9affd8'); } break;
        case 'quit': g.quitToTitle(); break;
        case 'respawn': g.player.respawn(); this.resume(); break;
        case 'gohome': this.resume(); g.goHome(); break;
        case 'codex': this.showCodex(); break;
        case 'codexback': this.show('pause'); break;
        case 'photo': g.photoMode(true); break;
        case 'syRandom': this.sySeed = (Math.random() * 4294967295) >>> 0; this.renderShipyard(); break;
        case 'syBuild': {
          const asBlocks = $('#sy_blocks').checked;
          this.resume();
          if (asBlocks && VR.ShipGen && g.gadgets) { const arch = VR.ShipGen.ARCH[this.syArch] ? this.syArch : null; g.gadgets.summonDesign(VR.ShipGen.design(this.sySeed, arch, { palette: null }), g.player); }
          else if (g.starships) g.starships.placeInFront(this.sySeed, this.syArch, this.syPaint || null, g.player);
          break;
        }
        case 'syClose': this.resume(); break;
        case 'zenTime': g.zenFreezeTime = !g.zenFreezeTime; this.buildZenPanel(); break;
        case 'zenWeather': g.zenFreezeWeather = !g.zenFreezeWeather; if (g.zenFreezeWeather) { g.env.rainTarget = 0; } this.buildZenPanel(); break;
        case 'zenNoclip': g.player.noclip = !g.player.noclip; if (g.player.noclip) g.player.flying = true; this.buildZenPanel(); break;
      }
    }
    resume() { this.show(null); const g = this.game; g.input.captured = true; g.input.requestLock(); }
    async showWorlds() {
      this.show('worlds');
      const list = (await this.game.store.listWorlds()).sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
      const wl = $('#worldlist'); wl.innerHTML = '';
      this.selWorld = null; $('#playsel').disabled = true; $('#delsel').disabled = true; $('#studiosel').disabled = true; $('#delsel').textContent = 'Delete'; delete $('#delsel').dataset.confirm;
      if (!list.length) wl.innerHTML = '<div class="note">No worlds yet — create one!</div>';
      for (const w of list) {
        const d = el('div', 'world', `<div><div class="n">${esc(w.name)}</div><div class="m">${w.mode === 'zen' ? 'Zen Builder' : w.mode[0].toUpperCase() + w.mode.slice(1)} · ${esc(w.difficulty)} · seed ${w.seed}</div></div><div class="m">${w.lastPlayed ? new Date(w.lastPlayed).toLocaleString() : ''}</div>`);
        d.onclick = () => { for (const x of wl.children) x.classList.remove('sel'); d.classList.add('sel'); this.selWorld = w; $('#playsel').disabled = false; $('#delsel').disabled = false; $('#studiosel').disabled = !!w.guest; };
        d.ondblclick = () => this.game.loadWorld(w);
        wl.appendChild(d);
      }
    }
    loading(msg, frac) {
      if (this.screen !== 'loading') { this.show('loading'); this.tipTimer = 0; }
      $('#loadmsg').textContent = msg;
      $('#loadbar').style.width = Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%';
      if (!this.tipAt || performance.now() - this.tipAt > 4500) { this.tipAt = performance.now(); const tips = TL('g.load.tips'); $('#loadtip').textContent = tips.length ? tips[Math.floor(Math.random() * tips.length)] : ''; }
    }
    // ---------------------------------------------------------------- HUD
    updateHUD(force) {
      const g = this.game, p = g.player;
      if (!p) return;
      // mouse fell back to drag-to-look (lock refused): invite a click to grab it again
      const inp = g.input, needLock = g.state === 'play' && !this.blocking && inp.captured && !inp.locked && inp.dragLook && !inp.lockFailed && !g.hideHud;
      if (needLock !== this.lockHintOn) { this.lockHintOn = needLock; let lh = $('#lockhint'); if (!lh) { lh = document.createElement('div'); lh.id = 'lockhint'; lh.textContent = T('g.hud.lock'); this.root.appendChild(lh); } lh.style.display = needLock ? 'block' : 'none'; }
      const inv = p.inv;
      if (inv.changed || force) {
        inv.changed = false;
        for (let i = 0; i < 9; i++) this.paintSlot(this.hudSlots[i], inv.slots[i]);
        this.hudSlots.forEach((s, i) => s.classList.toggle('sel', i === inv.sel));
        const h = inv.held;
        const nm = $('#itemname');
        const name = h ? VR.itemName(h.id) : '';
        if (name !== this.lastName) { this.lastName = name; nm.textContent = name; nm.style.opacity = name ? 1 : 0; clearTimeout(this.nameT); this.nameT = setTimeout(() => nm.style.opacity = 0, 2200); }
      }
      const surv = p.mode === 'survival';
      $('#stats').style.display = surv ? 'flex' : 'none';
      $('#xpbar').style.display = surv ? 'block' : 'none';
      $('#xplvl').style.display = surv && p.level > 0 ? 'block' : 'none';
      if (surv) {
        const key = Math.ceil(p.health) + ':' + p.food + ':' + Math.ceil(p.air / 30) + ':' + p.level + ':' + Math.floor(p.xp * 100);
        if (key !== this.statKey || force) {
          this.statKey = key;
          const hs = [], fs = [];
          for (let i = 0; i < 10; i++) { const v = p.health - i * 2; hs.push(`<i style="background-image:url(${v >= 2 ? this.ico.h : v >= 1 ? this.ico.hh : this.ico.he})"></i>`); }
          for (let i = 9; i >= 0; i--) { const v = p.food - i * 2; fs.push(`<i style="background-image:url(${v >= 2 ? this.ico.f : v >= 1 ? this.ico.fh : this.ico.fe})"></i>`); }
          $('#hearts').innerHTML = hs.join(''); $('#food').innerHTML = fs.join('');
          const bubbles = Math.ceil(p.air / 30);
          $('#air').innerHTML = p.air < 300 ? new Array(Math.max(0, bubbles)).fill(`<i style="background-image:url(${this.ico.b})"></i>`).join('') : '';
          $('#xpbar > div').style.width = (p.xp * 100) + '%'; $('#xplvl').textContent = p.level;
        }
      }
      const mb = $('#modebadge');
      const badge = p.mode === 'zen' ? T('g.hud.zen') : p.mode === 'creative' ? T('g.hud.creative') : '';
      if (mb.textContent !== badge || force) { mb.textContent = badge; mb.style.display = badge ? 'block' : 'none'; }
    }
    paintSlot(s, st) {
      const cv = s.querySelector('canvas'), cnt = s.querySelector('.cnt'), dur = s.querySelector('.dur');
      const id = st ? st.id : null;
      if (cv._id !== id) { cv._id = id; if (id) this.game.icons.paint(cv, id); else cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); }
      cnt.textContent = st && st.n > 1 ? st.n : '';
      const d = st ? VR.itemDef(st.id) : null;
      if (d && d.dur && st.dmg) { dur.style.display = 'block'; const f = 1 - st.dmg / d.dur; const i = dur.firstChild; i.style.width = (f * 100) + '%'; i.style.background = `hsl(${f * 120},90%,50%)`; }
      else if (dur) dur.style.display = 'none';
    }
    debug(text) { const d = $('#debug'); if (text === null) { d.style.display = 'none'; return; } d.style.display = 'block'; d.textContent = text; }
    fps(text) { const f = $('#fps'); if (text === null) { f.style.display = 'none'; return; } f.style.display = 'block'; f.textContent = text; }
    hint(text, ms) { const h = $('#hint'); if (!text) { h.style.display = 'none'; return; } h.textContent = text; h.style.display = 'block'; clearTimeout(this.hintT); if (ms) this.hintT = setTimeout(() => h.style.display = 'none', ms); }
    vehicleHud(text) { const v = $('#vehiclehud'); if (!text) { if (this.vhud !== null) { this.vhud = null; v.style.display = 'none'; } return; } if (text !== this.vhud) { this.vhud = text; v.style.display = 'block'; v.innerHTML = text; } }
    showShot(url) {
      let d = $('#shot');
      if (!d) { d = el('div'); d.id = 'shot'; document.getElementById('app').appendChild(d); }
      d.innerHTML = `<img alt="Screenshot" src="${url}"><div class="note">${esc(T('g.hud.shotNote'))}</div>`;
      d.style.display = 'block';
      d.onclick = () => { d.style.display = 'none'; };
      clearTimeout(this.shotT); this.shotT = setTimeout(() => { d.style.display = 'none'; }, 10000);
    }
    toast(title, text, iconId) {
      const t = el('div', 'toast');
      if (iconId) { const c = document.createElement('canvas'); c.width = 40; c.height = 40; this.game.icons.paint(c, iconId, 40); t.appendChild(c); }
      const d = el('div', '', `<b>${esc(title)}</b>${esc(text)}`); t.appendChild(d);
      $('#toasts').appendChild(t);
      this.game.audio.play('toast');
      setTimeout(() => { t.style.transition = 'opacity .5s, transform .5s'; t.style.opacity = 0; t.style.transform = 'translateX(40px)'; setTimeout(() => t.remove(), 600); }, 4200);
    }
    chatLine(text, color) {
      const log = $('#chatlog');
      const d = el('div'); d.textContent = text; if (color) d.style.color = color;
      log.appendChild(d);
      while (log.children.length > 10) log.firstChild.remove();
      setTimeout(() => { d.style.opacity = 0; setTimeout(() => d.remove(), 1000); }, 9000);
    }
    openChat(prefix) {
      const ci = $('#chatin'); ci.style.display = 'block'; ci.value = prefix || ''; this.typing = true;
      this.game.input.releaseLock(); this.game.input.captured = false;
      setTimeout(() => ci.focus(), 0);
    }
    closeChat() { const ci = $('#chatin'); ci.style.display = 'none'; ci.blur(); this.typing = false; if (!this.blocking) { this.game.input.captured = true; this.game.input.requestLock(); } }
    showDeath(cause) { const known = ['fall', 'lava', 'drown', 'void', 'starve', 'fire', 'mob', 'explosion', 'laser']; this.deathCause = cause; $('#deathmsg').textContent = T('g.death.msg', { how: T('g.death.' + (known.includes(cause) ? cause : 'died')) }); this.show('death'); }
    // ---------------------------------------------------------------- pause & zen
    pause() {
      if (this.game.state !== 'play') return;
      this.show('pause');
      { const b = $('#studiolive'); if (b) b.style.display = this.game.meta && this.game.meta.guest ? 'none' : ''; }
      this.buildZenPanel();
      this.buildMpPanel();
      const g = this.game;
      $('#pausenote').textContent = T('g.pause.note', { name: g.meta.name, seed: g.meta.seed });
    }
    // ---------------------------------------------------------------- multiplayer menus
    renderHosts() {
      const box = $('#mphosts'); if (!box) return;
      const mp = this.game.mp;
      box.innerHTML = '';
      const head = el('div', 'mphead');
      const mpT = '<b>' + esc(T('g.title.mp')) + '</b> · ';
      if (!mp || mp.status === 'connecting') { head.innerHTML = '<span class="dot wait"></span>' + mpT + esc(T('g.mp.connecting')); box.appendChild(head); return; }
      if (!mp.ready) { head.innerHTML = '<span class="dot off"></span>' + mpT + esc(T('g.title.mpOff')); box.appendChild(head); box.appendChild(el('div', 'note', T('g.mp.off'))); return; }
      const online = mp.online || [];
      head.innerHTML = '<span class="dot"></span>' + mpT + (online.length ? esc(T(online.length > 1 ? 'g.title.mpOnlineN' : 'g.title.mpOnline1', { n: online.length })) + ' ' + online.map(o => esc(o.name)).join(', ') : esc(T('g.title.mpNone')));
      box.appendChild(head);
      const list = mp.hostList().filter(h => !h.isMe);
      if (!list.length) {
        const d = document.createElement('details'); d.className = 'invitebox';
        d.innerHTML = '<summary>' + esc(T('g.mp.invite')) + '</summary>' + T('g.mp.inviteHow');
        box.appendChild(d);
        return;
      }
      for (const h of list) {
        const row = el('div', 'mphost');
        const txt = el('div', ''); txt.innerHTML = '<span class="dot"></span>';
        const b = document.createElement('b'); b.textContent = h.name; txt.appendChild(b);
        txt.appendChild(document.createTextNode(' ' + T('g.title.isPlaying') + ' '));
        const i = document.createElement('i'); i.textContent = h.world || T('g.title.aWorld'); txt.appendChild(i);
        txt.appendChild(document.createTextNode(' · ' + T(h.mode === 'zen' ? 'g.mode.zen' : h.mode === 'survival' ? 'g.mode.survival' : 'g.mode.creative')));
        const btn = el('button', 'btn primary small'); btn.textContent = T('g.title.join');
        btn.onclick = () => { if (this.game.state === 'title') this.game.mp.join(h); };
        row.appendChild(txt); row.appendChild(btn); box.appendChild(row);
      }
    }
    // R9 Studio designs in use (title screen): how many houses / items the player re-built, and a way back to the originals
    studioNote() {
      const n = $('#studionote'); if (!n || !VR.Custom) return;
      const c = VR.Custom.count();
      if (!c.houses && !c.models) { n.innerHTML = `<button class="btn tiny" data-act="studioimport" title="${esc(T('g.title.packInT'))}">${esc(T('g.title.packIn'))}</button>`; return; }
      const escH = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
      const names = Object.values(VR.CUSTOM.houses || {}).map(h => h.name).filter(Boolean).slice(0, 3).map(escH).join(', ');
      n.innerHTML = `<b>R9 Studio</b> · ${esc(T(c.houses === 1 ? 'g.title.house1' : 'g.title.houseN', { n: c.houses }))}${names ? ' (' + names + ')' : ''} · ${esc(T(c.models === 1 ? 'g.title.item1' : 'g.title.itemN', { n: c.models }))} <button class="btn tiny" data-act="studioimport">${esc(T('g.title.import'))}</button><button class="btn tiny" data-act="studioreset">${esc(T('g.title.originals'))}</button>`;
    }
    // a 📦 r9-paket (or the older text export): ★ added (blocks and items, blueprints too), the newer design wins,
    // Bauteile added unless the same — then the designs are applied here
    studioTake(text) {
      const g = this.game, pk = VR.Pack ? VR.Pack.read(text) : null;
      if (!pk) { this.titleNote(T('g.title.notPack')); return false; }
      const r = VR.Pack.merge(pk);
      g.reloadCustom();
      this.titleNote(T(r.ok ? 'g.title.taken' : 'g.title.takenFull', { what: r.text }));
      return r.ok;
    }
    titleNote(msg) { const n = $('#titlenote'); if (!n) return; n.textContent = msg || ''; clearTimeout(this.titleNoteT); if (msg) this.titleNoteT = setTimeout(() => { n.textContent = ''; }, 12000); }
    buildMpPanel() {
      const g = this.game, mp = g.mp, box = $('#mppanel'); if (!box) return;
      box.innerHTML = '';
      const head = el('div', 'subtitle', esc(T('g.mp.title'))); box.appendChild(head);
      if (!mp || mp.status === 'connecting') { box.appendChild(el('div', 'note', esc(T('g.mp.connecting')))); return; }
      if (!mp.ready) { box.appendChild(el('div', 'note', T('g.mp.off'))); return; }
      const list = mp.players();
      const addRow = (name, extra, label, fn) => {
        const row = el('div', 'mprow');
        const t = el('div', ''); const b = document.createElement('b'); b.textContent = name; t.appendChild(b); if (extra) t.appendChild(document.createTextNode(' ' + extra));
        row.appendChild(t);
        if (label) { const btn = el('button', 'btn small', esc(label)); btn.onclick = () => { this.resume(); fn(); }; row.appendChild(btn); }
        box.appendChild(row);
      };
      if (mp.isHost) {
        if (!list.length) { box.appendChild(el('div', 'note', esc(T('g.mp.canJoin')) + ((mp.online || []).length ? T('g.mp.onlineJoin', { names: mp.online.map(o => esc(o.name)).join(', ') }) : esc(T('g.mp.nobody'))))); const d = document.createElement('details'); d.className = 'invitebox'; d.innerHTML = '<summary>' + esc(T('g.mp.invite')) + '</summary>' + T('g.mp.inviteHow'); box.appendChild(d); }
        for (const q of list) addRow(q.name, T('g.mp.away', { n: Math.round(q.dist) }), T('g.mp.call'), () => mp.summon(q.peer));
      } else if (mp.isClient) {
        const h = list.find(q => q.host);
        addRow(mp.hostName || T('g.mp.host'), h ? T('g.mp.awayHost', { n: Math.round(h.dist) }) : T('g.mp.hostTag'), T('g.mp.tpTo', { name: mp.hostName || T('g.mp.host') }), () => mp.teleportToHost());
        for (const q of list) if (!q.host) addRow(q.name, T('g.mp.away', { n: Math.round(q.dist) }), T('g.mp.goThere'), () => mp.teleportTo(q.peer));
        box.appendChild(el('div', 'note', esc(T('g.mp.guestNote', { name: mp.hostName || T('g.mp.friend') }))));
      } else if (g.meta && !g.meta.guest && g.settings.mpHost === false) {
        box.appendChild(el('div', 'note', esc(T('g.mp.noJoin'))));
      } else {
        box.appendChild(el('div', 'note', esc(T('g.mp.connecting'))));
      }
    }
    buildZenPanel() {
      const g = this.game, zp = $('#zenpanel');
      if (!g.player || g.player.mode === 'survival') { zp.innerHTML = ''; return; }
      const on = (v) => v ? ' primary' : '';
      zp.innerHTML = `<div class="subtitle">${esc(T('g.zen.tools', { mode: T(g.player.mode === 'zen' ? 'g.mode.zen' : 'g.mode.creative') }))}</div>
        <div class="row gap"><button class="btn small${on(g.zenFreezeTime)}" data-act="zenTime" style="flex:1">${esc(T(g.zenFreezeTime ? 'g.zen.timeOn' : 'g.zen.timeOff'))}</button>
        <button class="btn small${on(g.zenFreezeWeather)}" data-act="zenWeather" style="flex:1">${esc(T(g.zenFreezeWeather ? 'g.zen.wxOn' : 'g.zen.wxOff'))}</button>
        <button class="btn small${on(g.player.noclip)}" data-act="zenNoclip" style="flex:1">${esc(T(g.player.noclip ? 'g.zen.ghostOn' : 'g.zen.ghostOff'))}</button></div>
        <div class="field"><label>${esc(T('g.zen.tod'))}</label><input type="range" min="0" max="23999" step="100" id="zentod" value="${Math.round(g.env.timeOfDay)}"></div>`;
      $('#zentod').oninput = (e) => { g.env.setTime(+e.target.value); };
    }
    // ---------------------------------------------------------------- settings
    showSettings() {
      this.show('settings');
      const tabs = [['graphics', T('g.set.graphics')], ['controls', T('g.set.controls')], ['audio', T('g.set.audio')], ['game', T('g.set.game')], ['lang', T('g.lang.title')]];
      const st = $('#settabs'); st.innerHTML = '';
      for (const [k, n] of tabs) { const b = el('button', k === this.settingsTab ? 'on' : ''); b.textContent = n; b.dataset.tab = k; b.onclick = () => { this.settingsTab = k; this.showSettings(); }; st.appendChild(b); }
      const S = this.game.settings, body = $('#setbody');
      body.innerHTML = '';
      const slider = (key, label, min, max, step, fmt, onch) => {
        const d = el('div', 'field'); d.innerHTML = `<label>${esc(label)}: <span class="val">${esc(fmt(S[key]))}</span></label><input type="range" min="${min}" max="${max}" step="${step}" value="${S[key]}">`;
        const inp = d.querySelector('input'), val = d.querySelector('.val');
        inp.oninput = () => { S[key] = +inp.value; val.textContent = fmt(S[key]); if (onch) onch(); this.game.applySettings(key); };
        body.appendChild(d);
      };
      const toggle = (key, label) => { const d = el('label', 'row gap note', `<input type="checkbox" ${S[key] ? 'checked' : ''}> ${esc(label)}`); d.style.margin = '6px 0'; d.querySelector('input').onchange = (e) => { S[key] = e.target.checked; this.game.applySettings(key); }; body.appendChild(d); };
      const pct = (v) => Math.round(v * 100) + '%', pickV = (key) => (v) => TL(key)[v] || '';
      if (this.settingsTab === 'graphics') {
        const seg = el('div', 'seg');
        const PRESET = { potato: 'g.set.pVeryLow', low: 'g.set.pLow', balanced: 'g.set.pBalanced', high: 'g.set.pHigh', ultra: 'g.set.pUltra' };
        for (const p of ['potato', 'low', 'balanced', 'high', 'ultra']) { const b = el('button', S.preset === p ? 'on' : ''); b.textContent = T(PRESET[p]); b.title = p === 'potato' ? T('g.set.pVeryLowTip') : ''; b.onclick = () => { this.game.applyPreset(p); this.showSettings(); }; seg.appendChild(b); }
        const f = el('div', 'field'); f.innerHTML = '<label></label>'; f.firstChild.textContent = T('g.set.preset'); f.appendChild(seg); body.appendChild(f);
        // the block look (also /look): Klassisch / Classic — every block on its own, like the original game — or Nahtlos / Seamless
        const lk = el('div', 'seg'), cur = S.look === 'seamless' ? 'seamless' : 'classic', LT = (k) => this.game.lookText(k);
        for (const k of ['classic', 'seamless']) {
          const b = el('button', cur === k ? 'on' : ''); b.textContent = LT(k); b.title = LT(k + 'Tip'); b.dataset.look = k;
          b.onclick = () => { S.look = k; this.game.applySettings('look'); this.game.saveSettings(); this.showSettings(); }; lk.appendChild(b);
        }
        const lf = el('div', 'field'); lf.innerHTML = '<label></label>'; lf.firstChild.textContent = LT('label'); lf.appendChild(lk); body.appendChild(lf);
        slider('renderDist', T('g.set.renderDist'), 3, 24, 1, (v) => T('g.set.chunks', { v, m: v * 16 }));
        slider('horizon', T('g.set.horizon'), 0, 4, 1, pickV('g.set.horizonV'));
        slider('scale', T('g.set.scale'), 0.4, 1, 0.05, pct);
        slider('shadows', T('g.set.shadows'), 0, 3, 1, pickV('g.set.shadowsV'));
        slider('clouds', T('g.set.clouds'), 0, 2, 1, pickV('g.set.cloudsV'));
        slider('particles', T('g.set.particles'), 0, 2, 1, pickV('g.set.particlesV'));
        slider('magic', T('g.set.magic'), 0, 1, 0.05, pct);
        for (const k of ['sunShadows', 'sharpen', 'tsr', 'bloom', 'rays', 'fxaa', 'fancyLeaves', 'dynRes', 'lite', 'showFps']) toggle(k, T('g.set.' + k));
        const r = this.game.renderer;
        const note = el('div', 'note', T('g.set.gpuNote', { gpu: esc(VR.GL.rendererName || ''), r: r ? r.w + '×' + r.h : '?', s: r ? r.W + '×' + r.H : '?', tsr: S.tsr ? T('g.set.gpuTsr') : '', dyn: S.dynRes ? T('g.set.gpuDyn') : '' })); note.style.marginTop = '10px'; body.appendChild(note);
      } else if (this.settingsTab === 'controls') {
        slider('fov', T('g.set.fov'), 50, 110, 1, (v) => v + '°');
        slider('sens', T('g.set.sens'), 0.2, 3, 0.05, pct);
        toggle('invertY', T('g.set.invertY')); toggle('viewBob', T('g.set.viewBob'));
        body.appendChild(el('div', 'note', T('g.set.keys')));
      } else if (this.settingsTab === 'audio') {
        slider('volMaster', T('g.set.volMaster'), 0, 1, 0.05, pct);
        slider('volSfx', T('g.set.volSfx'), 0, 1, 0.05, pct);
        slider('volMusic', T('g.set.volMusic'), 0, 1, 0.05, pct);
        slider('volAmbient', T('g.set.volAmbient'), 0, 1, 0.05, pct);
      } else if (this.settingsTab === 'lang') {
        this.buildLangPanel(body);
      } else {
        const nf = el('div', 'field'); nf.innerHTML = '<label></label><input type="text" maxlength="24">'; nf.firstChild.textContent = T('g.set.name'); nf.lastChild.placeholder = T('g.set.namePh');
        const ni = nf.querySelector('input'); ni.value = S.playerName || ''; ni.onchange = () => { S.playerName = ni.value.replace(/[<>]/g, '').trim().slice(0, 24); this.game.saveSettings(); if (this.game.mp) this.game.mp.setLobby(); };
        ni.addEventListener('keydown', (e) => e.stopPropagation());
        body.appendChild(nf);
        // ---- your hero (third person with F5, and what friends see)
        const Folk = VR.Folk;
        if (Folk && Folk.HERO_SUITS) {
          const H = this.game.heroOpts();
          const hex = (c) => '#' + ('000000' + (c >>> 0).toString(16)).slice(-6);
          const row = (label, items, key, paint) => {
            const f = el('div', 'field'); f.innerHTML = '<label></label>'; f.firstChild.textContent = label;
            const wrap = el('div', 'row gap'); wrap.style.flexWrap = 'wrap';
            items.forEach((it, i) => {
              const b = el('button', 'swatch' + ((H[key] | 0) === i ? ' on' : ''), paint ? '' : esc(it));
              if (paint) b.style.background = paint(it); b.title = typeof it === 'object' && it.name ? it.name : String(it);
              b.onclick = () => { H[key] = i; this.game.saveSettings(); if (this.game.mp) this.game.mp.publish(true); this.showSettings(); };
              wrap.appendChild(b);
            });
            f.appendChild(wrap); body.appendChild(f);
          };
          body.appendChild(el('div', 'note', T('g.set.heroNote')));
          row(T('g.set.suit'), Folk.HERO_SUITS, 'suit', (su) => `linear-gradient(135deg, ${hex(su.c)} 0 62%, ${hex(su.a)} 62% 100%)`);
          row(T('g.set.hair'), Folk.HAIR, 'hair', (c) => hex(c));
          row(T('g.set.hairStyle'), Folk.HAIR_STYLES, 'hs', null);
          row(T('g.set.skin'), Folk.SKIN, 'skin', (c) => hex(c));
          body.appendChild(el('div', 'hr'));
        }
        if (S.mpHost === undefined) S.mpHost = true;
        toggle('mpHost', T('g.set.mpHost'));
        toggle('showCoords', T('g.set.showCoords')); toggle('minimap', T('g.set.minimap')); toggle('toasts', T('g.set.toasts'));
        body.appendChild(el('div', 'note', esc(T('g.set.storageNote'))));
      }
    }
    // 🌐 the language: Deutsch / English switch live (also /lang de|en); the other languages of the module are
    // "soon" — shown in Profi, Einfach hides them (r9si.ui.pro)
    buildLangPanel(body) {
      const I = VR.I18N; if (!I) return;
      const ready = I.langs.filter(l => I.ready(l[0])).map(l => l[0]);   // the languages with a table (de, en)
      const cur = ready.includes(I.lang) ? I.lang : 'en';
      const seg = el('div', 'seg'); seg.id = 'langseg';
      for (const code of ready) {
        const b = el('button', cur === code ? 'on' : ''); b.dataset.lang = code; b.textContent = I.info(code)[1]; b.lang = code;
        b.onclick = () => { if (I.lang !== code) I.set(code); else this.showSettings(); };
        seg.appendChild(b);
      }
      const f = el('div', 'field'); f.innerHTML = '<label></label>'; f.firstChild.textContent = T('g.lang.title'); f.appendChild(seg); body.appendChild(f);
      const showSoon = VR.UIPrefs ? !!VR.UIPrefs.get().pro : true;   // (Einfach / Profi: r9si.ui)
      if (showSoon) {
        const soon = el('div', 'row gap langsoon'); soon.style.flexWrap = 'wrap';
        for (const [code, name] of I.langs) { if (ready.includes(code)) continue; const b = el('button', 'btn tiny'); b.disabled = true; b.lang = code; b.textContent = name + ' · ' + T('g.lang.soon'); soon.appendChild(b); }
        body.appendChild(soon);
      }
      body.appendChild(el('div', 'note', esc(T('g.lang.note'))));
    }
    // ---------------------------------------------------------------- codex
    showCodex() {
      this.show('codex');
      const g = this.game, cx = g.codex;
      const grid = $('#codexgrid'); grid.innerHTML = '';
      const entries = cx.list();
      $('#codexsum').textContent = T('g.codex.sum', { found: entries.filter(e => e.found).length, all: entries.length });
      let cat = null;
      for (const e of entries) {
        if (e.cat && e.cat !== cat) { cat = e.cat; const inCat = entries.filter(x => x.cat === cat); grid.appendChild(el('div', 'codexcat', `${esc(cat)} <span class="note">${inCat.filter(x => x.found).length}/${inCat.length}</span>`)); }
        const d = el('div', 'codexitem' + (e.found ? '' : ' locked'));
        if (e.icon && e.found && VR.itemDef(e.icon)) { const c = document.createElement('canvas'); c.width = 32; c.height = 32; g.icons.paint(c, e.icon, 32); c.style.float = 'right'; d.appendChild(c); }
        d.appendChild(el('div', '', `<b>${esc(e.found ? e.name : '???')}</b><div class="note">${esc(e.found ? e.desc : e.hint)}</div>`));
        grid.appendChild(d);
      }
    }
    // ---------------------------------------------------------------- shipyard
    openShipyard() {
      if (!VR.ShipGen) return;
      this.show('shipyard');
      if (!this.syArch) this.syArch = 'interceptor';
      if (!this.sySeed) this.sySeed = (Math.random() * 4294967295) >>> 0;
      const sel = $('#sy_paint');
      if (!sel.options.length) {
        sel.appendChild(el('option', '', esc(T('g.sy.designer')))); sel.options[0].value = '';
        for (const p of VR.Starship.PAL) { const o = el('option', '', esc(p.name)); o.value = p.key; sel.appendChild(o); }
        sel.onchange = () => { this.syPaint = sel.value || null; this.renderShipyard(); };
      }
      this.renderShipyard();
    }
    renderShipyard() {
      const SS = VR.Starship, box = $('#sy_types'), g = this.game;
      box.innerHTML = '';
      for (const k of SS.archetypes) { const b = el('button', 'btn small' + (k === this.syArch ? ' primary' : ''), esc(SS.ARCH[k].label)); b.onclick = () => { this.syArch = k; this.renderShipyard(); }; box.appendChild(b); }
      $('#sy_name').textContent = T('g.sy.designing');
      { const o = $('#sy_paint').options[0]; if (o) o.textContent = T('g.sy.designer'); }
      $('#sy_stats').textContent = '';
      const cv = $('#sy_canvas'), req = this.syReq = (this.syReq || 0) + 1;
      const pool = g.pool; let wi = 0; pool.workers.forEach((wk, i) => { if (wk.inflight < pool.workers[wi].inflight) wi = i; });
      pool.direct(wi, { type: 'starship', seed: this.sySeed, arch: this.syArch, palette: this.syPaint || null, preview: [cv.width, cv.height] }, null, (m) => {
        if (req !== this.syReq || m.type !== 'starship') return;
        const md = m.meta;
        $('#sy_name').textContent = md.name;
        $('#sy_stats').innerHTML = T('g.sy.stats', { label: esc(md.label), paint: esc(md.paletteName), l: md.length, w: md.width, h: md.height, engines: md.exhaust.length, guns: md.guns.length ? T('g.sy.guns', { n: md.guns.length }) : '', tris: Math.round(md.tris).toLocaleString(), speed: md.speed, seed: md.seed });
        const ctx = cv.getContext('2d'); ctx.clearRect(0, 0, cv.width, cv.height);
        if (m.preview) ctx.putImageData(new ImageData(new Uint8ClampedArray(m.preview.rgba.buffer), m.preview.w, m.preview.h), 0, 0);
      });
    }
    // ---------------------------------------------------------------- inventory
    openInventory(kind, data) {
      const g = this.game;
      this.invKind = kind || (g.player.creative ? 'creative' : 'survival');
      this.invData = data || null;
      this.show('inventory');
      this.renderInventory();
    }
    closeInventory() { if (this.screen === 'inventory') { if (this.game.onInventoryClose) this.game.onInventoryClose(this.invKind, this.invData); this.returnCursor(); this.resume(); } }
    renderInventory() {
      const g = this.game, p = g.player, panel = $('#invpanel');
      panel.innerHTML = '';
      const wrap = el('div', 'invwrap');
      panel.appendChild(wrap);
      const left = el('div', 'col');
      wrap.appendChild(left);
      const k = this.invKind;
      if (k === 'creative') {
        const tabs = el('div', 'tabs');
        this.creativeTab = this.creativeTab || 'build';
        for (const key of CAT_TABS) { const b = el('button', key === this.creativeTab ? 'on' : ''); b.textContent = T('g.cat.' + key); b.dataset.cat = key; b.onclick = () => { this.creativeTab = key; this.renderInventory(); }; tabs.appendChild(b); }
        left.appendChild(tabs);
        if (this.creativeTab === 'search') {
          const s = el('input', 'search'); s.type = 'text'; s.placeholder = T('g.inv.searchPh'); s.value = this.searchText || '';
          s.oninput = () => { this.searchText = s.value; this.fillPalette(pal); };
          s.onkeydown = (e) => e.stopPropagation();
          left.appendChild(s);
          setTimeout(() => s.focus(), 0);
        }
        const pal = el('div', 'palette grid'); pal.style.gridTemplateColumns = 'repeat(12, 52px)';
        left.appendChild(pal);
        this.fillPalette(pal);
        // ★ favourites are shared with the R9 Studio (Teile, Crafter, Werkbank …): a change there shows here
        if (VR.Favs && !this._favSub) this._favSub = VR.Favs.on(() => { if (this.screen === 'inventory' && this.invKind === 'creative') { const pl = document.querySelector('#invpanel .palette'); if (this.creativeTab === 'fav' && pl) this.fillPalette(pl); else if (pl) this.markFavs(pl); } });
        left.appendChild(el('div', 'subtitle', esc(T('g.inv.hotbar'))));
        left.appendChild(this.slotGrid(p.inv.slots, 0, 9, 9, 'inv'));
        left.appendChild(el('div', 'note', T('g.inv.paletteNote')));
      } else {
        const top = el('div', 'row gap'); top.style.alignItems = 'flex-start';
        left.appendChild(top);
        // armor
        const armor = el('div', 'grid'); armor.style.gridTemplateColumns = '52px';
        for (let i = 0; i < 4; i++) armor.appendChild(this.slotEl(p.inv.armor, i, 'armor'));
        top.appendChild(armor);
        const craftN = k === 'craft' ? 3 : 2;
        if (k === 'survival' || k === 'craft') {
          const grid = this.craftGrid || (this.craftGrid = new Array(9).fill(null));
          if (this.craftN !== craftN) { this.returnCraft(); this.craftGrid = new Array(9).fill(null); this.craftN = craftN; }
          const box = el('div', 'col'); box.appendChild(el('div', 'subtitle', esc(T(craftN === 3 ? 'g.inv.craftTable' : 'g.inv.crafting'))));
          const row = el('div', 'craft');
          const cg = el('div', 'grid'); cg.style.gridTemplateColumns = `repeat(${craftN}, 52px)`;
          for (let i = 0; i < craftN * craftN; i++) cg.appendChild(this.slotEl(this.craftGrid, i, 'craft'));
          row.appendChild(cg); row.appendChild(el('div', 'arrow', '➜'));
          const out = this.slotEl([g.craftResult(this.craftGrid, craftN)], 0, 'craftout'); row.appendChild(out);
          box.appendChild(row); top.appendChild(box);
        } else if (k === 'chest') {
          const box = el('div', 'col'); box.appendChild(el('div', 'subtitle', esc(this.invData.title || T('g.inv.chest'))));
          box.appendChild(this.slotGrid(this.invData.items, 0, this.invData.items.length, 9, 'chest'));
          top.appendChild(box);
        } else if (k === 'furnace') {
          const f = this.invData;
          const box = el('div', 'col'); box.appendChild(el('div', 'subtitle', esc(f.title || T('g.inv.furnace'))));
          const row = el('div', 'craft');
          const colA = el('div', 'grid'); colA.style.gridTemplateColumns = '52px';
          colA.appendChild(this.slotEl(f.items, 0, 'furnace')); const flame = el('div', 'note', f.burn > 0 ? '🔥' : '·'); flame.style.textAlign = 'center'; colA.appendChild(flame); colA.appendChild(this.slotEl(f.items, 1, 'furnace'));
          row.appendChild(colA); row.appendChild(el('div', 'arrow', `➜ <small class="note">${Math.round((f.progress || 0) * 100)}%</small>`)); row.appendChild(this.slotEl(f.items, 2, 'furnace'));
          box.appendChild(row); top.appendChild(box);
          this.furnaceTimer = setTimeout(() => { if (this.screen === 'inventory' && this.invKind === 'furnace') this.renderInventory(); }, 500);
        }
        left.appendChild(el('div', 'subtitle', esc(T('g.inv.title'))));
        left.appendChild(this.slotGrid(p.inv.slots, 9, 36, 9, 'inv'));
        const hb = this.slotGrid(p.inv.slots, 0, 9, 9, 'inv'); hb.style.marginTop = '8px';
        left.appendChild(hb);
      }
    }
    fillPalette(pal) {
      pal.innerHTML = '';
      const items = this.game.creativeItems(this.creativeTab, this.searchText);
      const frag = document.createDocumentFragment();
      for (const id of items) {
        const s = el('div', 'slot'); s.innerHTML = '<canvas width="48" height="48"></canvas>'; s.dataset.id = id;
        s.onmousedown = (e) => { e.preventDefault(); this.paletteClick(id, e); };
        s.onmouseenter = () => this.showTooltip(id); s.onmouseleave = () => this.hideTooltip();
        // ☆ in the corner (on hover): a favourite, the same as in the R9 Studio
        if (VR.Favs) { const fb = el('span', 'favS'); fb.onmousedown = (e) => { e.preventDefault(); e.stopPropagation(); this.toggleFav(id); }; s.appendChild(fb); }
        frag.appendChild(s);
        // paint lazily, a few per frame (pumpIcons)
        (this._iconQ || (this._iconQ = [])).push([s.firstChild, id]);
      }
      pal.appendChild(frag);
      this.pumpIcons();
      this.markFavs(pal);
      if (this.creativeTab === 'fav' && !items.length) { const n = el('div', 'note', T('g.inv.noFavs')); n.style.gridColumn = '1 / -1'; n.style.padding = '10px 4px'; pal.appendChild(n); }
      pal.onmousedown = (e) => { if (e.target === pal && this.cursor) { this.cursor = null; this.updateCursor(); } };
    }
    // palette icons paint in small batches, about 6 ms per frame: a tab of hundreds of models (each builds its voxels
    // on first use) never stalls a frame on a small PC; slots that left the screen are skipped
    pumpIcons() {
      if (this._iconPump) return;
      const step = () => {
        const q = this._iconQ || [], t0 = performance.now();
        while (q.length && performance.now() - t0 < 6) { const [cv, id] = q.shift(); if (cv.isConnected) this.game.icons.paint(cv, id); }
        this._iconPump = q.length ? requestAnimationFrame(step) : 0;
      };
      this._iconPump = requestAnimationFrame(step);
    }
    // ★ marks on the palette slots
    markFavs(pal) {
      const F = VR.Favs; if (!F) return;
      for (const s of pal.querySelectorAll('.slot[data-id]')) { const on = F.has(s.dataset.id), b = s.querySelector('.favS'); s.classList.toggle('fav', on); if (b) { b.textContent = on ? '★' : '☆'; b.title = T(on ? 'g.inv.favOff' : 'g.inv.favOn'); } }
    }
    toggleFav(id) {
      const F = VR.Favs; if (!F || !id) return false;
      const on = F.toggle(id);
      this.hint(T(on ? 'g.inv.favAdded' : 'g.inv.favRemoved', { name: VR.itemName(id) }), 1600);
      const pal = document.querySelector('#invpanel .palette');
      if (pal) { if (this.creativeTab === 'fav') this.fillPalette(pal); else this.markFavs(pal); }
      return on;
    }
    paletteClick(id, e) {
      const p = this.game.player;
      if (this.cursor) { this.cursor = null; this.updateCursor(); return; }
      const n = e.button === 2 || e.shiftKey ? VR.maxStack(id) : (e.button === 1 ? VR.maxStack(id) : 1);
      if (e.shiftKey) { const slot = p.inv.slots.findIndex((s, i) => i < 9 && !s); p.inv.slots[slot >= 0 ? slot : p.inv.sel] = { id, n: VR.maxStack(id) }; p.inv.changed = true; this.renderInventory(); this.updateHUD(true); return; }
      this.cursor = { id, n: e.button === 0 ? VR.maxStack(id) : n };
      this.updateCursor();
    }
    slotGrid(arr, from, to, cols, kind) {
      const g = el('div', 'grid'); g.style.gridTemplateColumns = `repeat(${cols}, 52px)`;
      for (let i = from; i < to; i++) g.appendChild(this.slotEl(arr, i, kind));
      return g;
    }
    slotEl(arr, i, kind) {
      const s = el('div', 'slot'); s.innerHTML = '<canvas width="48" height="48"></canvas><span class="cnt"></span><div class="dur" style="display:none"><i></i></div>';
      this.paintSlot(s, arr[i]);
      s.onmousedown = (e) => { e.preventDefault(); this.slotClick(arr, i, kind, e); this.renderInventory(); this.updateHUD(true); };
      s.onmouseenter = () => { if (arr[i]) this.showTooltip(arr[i].id, arr[i]); };
      s.onmouseleave = () => this.hideTooltip();
      return s;
    }
    slotClick(arr, i, kind, e) {
      const g = this.game, p = g.player;
      p.inv.changed = true;
      if (kind === 'craftout') {
        const res = g.craftResult(this.craftGrid, this.craftN);
        if (!res) return;
        if (e.shiftKey) { let guard = 0; while (guard++ < 64) { const r2 = g.craftResult(this.craftGrid, this.craftN); if (!r2 || p.inv.add(r2.id, r2.n) < r2.n) break; g.consumeCraft(this.craftGrid, this.craftN); } return; }
        if (this.cursor && (this.cursor.id !== res.id || this.cursor.n + res.n > VR.maxStack(res.id))) return;
        if (this.cursor) this.cursor.n += res.n; else this.cursor = { id: res.id, n: res.n };
        g.consumeCraft(this.craftGrid, this.craftN);
        g.codex && g.codex.onCraft(res.id);
        this.updateCursor();
        return;
      }
      const st = arr[i];
      if (e.shiftKey && st) {
        // quick move between hotbar/inventory/container
        if (kind === 'inv') {
          if (this.invKind === 'chest') { this.moveInto(this.invData.items, 0, this.invData.items.length, arr, i); }
          else { const hot = i < 9; this.moveInto(p.inv.slots, hot ? 9 : 0, hot ? 36 : 9, arr, i); }
        } else { this.moveInto(p.inv.slots, 0, 36, arr, i); }
        return;
      }
      if (kind === 'armor' && this.cursor) { const d = VR.itemDef(this.cursor.id); if (!d || d.slot !== i) return; }
      const cur = this.cursor;
      if (e.button === 2) {
        if (cur && (!st || st.id === cur.id) && (!st || st.n < VR.maxStack(cur.id))) { if (!st) arr[i] = { id: cur.id, n: 1, dmg: cur.dmg }; else st.n++; cur.n--; if (!cur.n) this.cursor = null; }
        else if (!cur && st) { const h = Math.ceil(st.n / 2); this.cursor = { id: st.id, n: h, dmg: st.dmg }; st.n -= h; if (!st.n) arr[i] = null; }
      } else {
        if (cur && st && cur.id === st.id && !st.dmg) { const k = Math.min(VR.maxStack(st.id) - st.n, cur.n); st.n += k; cur.n -= k; if (!cur.n) this.cursor = null; }
        else { arr[i] = cur || null; this.cursor = st || null; }
      }
      this.updateCursor();
    }
    moveInto(dst, a, b, src, i) {
      const st = src[i]; if (!st) return;
      const max = VR.maxStack(st.id);
      for (let k = a; k < b && st.n > 0; k++) { const d = dst[k]; if (d && d.id === st.id && d.n < max && !d.dmg && !st.dmg) { const m = Math.min(max - d.n, st.n); d.n += m; st.n -= m; } }
      for (let k = a; k < b && st.n > 0; k++) if (!dst[k]) { dst[k] = { id: st.id, n: st.n, dmg: st.dmg }; st.n = 0; }
      if (st.n <= 0) src[i] = null;
    }
    returnCursor() { if (!this.cursor) return; const p = this.game.player; if (p && !p.creative) { const left = this.cursor.n - p.inv.add(this.cursor.id, this.cursor.n); if (left > 0) this.game.dropStack && this.game.dropStack({ id: this.cursor.id, n: left }); } this.cursor = null; this.updateCursor(); this.returnCraft(); }
    returnCraft() { const p = this.game.player; if (!this.craftGrid || !p) return; for (let i = 0; i < 9; i++) { const s = this.craftGrid[i]; if (s) { p.inv.add(s.id, s.n); this.craftGrid[i] = null; } } }
    updateCursor() {
      const c = $('#cursor');
      if (!this.cursor || this.screen !== 'inventory') { c.style.display = 'none'; return; }
      c.style.display = 'block';
      this.game.icons.paint(c.firstChild, this.cursor.id);
      c.lastChild.textContent = this.cursor.n > 1 ? this.cursor.n : '';
      this.moveCursor();
    }
    moveCursor() { const c = $('#cursor'); if (c.style.display === 'block') { c.style.left = (this.mx - 22) + 'px'; c.style.top = (this.my - 22) + 'px'; } const t = $('#tooltip'); if (t.style.display === 'block') { t.style.left = (this.mx + 16) + 'px'; t.style.top = (this.my + 12) + 'px'; } }
    showTooltip(id, st) {
      const t = $('#tooltip'); const d = VR.itemDef(id);
      this.hoverId = id;
      if (!d) return;
      let extra = '';
      const bt = R.byName[id];
      if (bt && bt.group) extra = `<small>${esc(bt.group)}</small>`;
      if (d.food) extra += `<small>${esc(T('g.tip.food', { n: d.food / 2 }))}</small>`;
      if (d.tool) extra += `<small>${esc(T('g.tip.tool', { tool: d.tool, tier: d.tier || 0, dur: d.dur ? ' · ' + (d.dur - ((st && st.dmg) || 0)) + '/' + d.dur : '' }))}</small>`;
      if (d.armor) extra += `<small>${esc(T('g.tip.armor', { n: d.armor }))}</small>`;
      if (VR.Favs && this.screen === 'inventory') extra += `<small>${esc(T(VR.Favs.has(id) ? 'g.tip.favOn' : 'g.tip.favOff'))}</small>`;
      t.innerHTML = `${esc(d.name)}${extra}`;
      t.style.display = 'block'; this.moveCursor();
    }
    hideTooltip() { $('#tooltip').style.display = 'none'; this.hoverId = null; }
  }
  VR.UI = UI;
})(VR);
