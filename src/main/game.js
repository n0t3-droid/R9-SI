// ============================================================================
// Game: boot, title panorama, world lifecycle, main loop, interactions,
// commands, settings & presets, photo mode.
// ============================================================================
(function (VR) {
  'use strict';
  const R = VR.R, F = VR.F;
  const PRESETS = {
    potato: { renderDist: 4, scale: 0.55, shadows: 0, clouds: 1, particles: 0, bloom: false, rays: false, fxaa: false, fancyLeaves: false, dynRes: true, magic: 0.3, horizon: 2, sunShadows: false, tsr: true, vxLod: 12, lite: true, sharpen: true, folk: 32, slow: true, wetGround: false },
    low: { renderDist: 6, scale: 0.75, shadows: 0, clouds: 1, particles: 1, bloom: true, rays: false, fxaa: false, fancyLeaves: false, dynRes: true, magic: 0.6, horizon: 4, sunShadows: true, tsr: true, vxLod: 28, lite: false, folk: 64, slow: false, wetGround: true },
    balanced: { renderDist: 10, scale: 0.9, shadows: 1, clouds: 2, particles: 2, bloom: true, rays: false, fxaa: true, fancyLeaves: true, dynRes: true, magic: 0.8, horizon: 4, sunShadows: true, tsr: true, vxLod: 44, lite: false, folk: 100, slow: false, wetGround: true },
    high: { renderDist: 14, scale: 1, shadows: 2, clouds: 2, particles: 2, bloom: true, rays: true, fxaa: true, fancyLeaves: true, dynRes: true, magic: 0.85, horizon: 4, sunShadows: true, tsr: true, vxLod: 64, lite: false, folk: 100, slow: false, wetGround: true },
    ultra: { renderDist: 16, scale: 1, shadows: 3, clouds: 2, particles: 2, bloom: true, rays: true, fxaa: true, fancyLeaves: true, dynRes: false, magic: 0.9, horizon: 4, sunShadows: true, tsr: true, vxLod: 96, lite: false, folk: 120, slow: false, wetGround: true },
  };
  // look: the block look (v0.39) — 'classic' (Klassisch, every block on its own like the original game; the default,
  // also for players whose saved settings predate it) or 'seamless' (Nahtlos: smooth hills, joined glass)
  // atmosphere (A1): wx = Wetter (normal · calm = Ruhig, clear and cloudy only · off), natSound = Natur-Klänge
  // (synth · off), wetGround = the ground darkens in the rain (off on Very Low)
  const DEFAULTS = Object.assign({ preset: 'balanced', fov: 72, sens: 1, invertY: false, viewBob: true, volMaster: 0.8, volSfx: 0.9, volMusic: 0.45, volAmbient: 0.6, showFps: false, showCoords: false, minimap: true, toasts: true, look: 'classic', wx: 'normal', natSound: 'synth', wetGround: true }, PRESETS.balanced);
  const SHADOW_RES = [0, 1024, 2048, 3072];
  const SHADOW_DIST = [0, 40, 64, 96];

  class Game {
    constructor() {
      this.state = 'boot';
      this.canvas = document.getElementById('gl');
      this.settings = this.loadSettings();
      this.time = 0; this.frame = 0;
      this.zenFreezeTime = false; this.zenFreezeWeather = false;
      this.damageFlash = 0; this.skyBright = 1;
      this.hideHud = false; this.debugOn = false; this.camMode = 0;
    }
    loadSettings() {
      let s = {};
      try { s = JSON.parse(localStorage.getItem('r9si.settings') || '{}'); } catch (e) { s = {}; }
      const out = Object.assign({}, DEFAULTS, s);
      if (!s.preset) { // auto-pick a preset by cores & memory now, refined by the GPU name once the context exists (see boot)
        const cores = navigator.hardwareConcurrency || 4, mem = navigator.deviceMemory || 8;
        out.preset = (cores <= 2 || mem <= 2) ? 'potato' : cores <= 4 ? 'low' : 'balanced';
        out.autoPreset = true;
        Object.assign(out, PRESETS[out.preset]);
      }
      return out;
    }
    saveSettings() { try { localStorage.setItem('r9si.settings', JSON.stringify(this.settings)); } catch (e) { /* ignore */ } }
    applyPreset(p) { this.settings.preset = p; Object.assign(this.settings, PRESETS[p]); this.applySettings('*'); this.saveSettings(); }
    applySettings(key) {
      const S = this.settings, r = this.renderer;
      if (key !== '*' && ['renderDist', 'scale', 'shadows', 'clouds', 'particles', 'bloom', 'rays', 'fxaa', 'magic', 'dynRes', 'fancyLeaves', 'horizon', 'sunShadows', 'sharpen', 'tsr', 'vxLod', 'lite', 'wetGround'].includes(key)) S.preset = 'custom';
      if (S.horizon === undefined) S.horizon = PRESETS[S.preset] ? PRESETS[S.preset].horizon : 2;
      if (S.sunShadows === undefined) S.sunShadows = true;
      if (S.sharpen === undefined) S.sharpen = true;
      if (S.tsr === undefined) S.tsr = true;
      // sun rays through the heightmap reach as far as the loaded land (shadow maps only cover the near field)
      const hDist = Math.min(160, Math.max(56, S.renderDist * 16 * 0.75));
      if (r) r.setQuality({ scale: S.scale, shadows: SHADOW_RES[S.shadows], shadowDist: SHADOW_DIST[S.shadows], shadowEvery: 1, bloom: S.bloom, rays: S.rays, fxaa: S.fxaa, clouds: S.clouds, magic: S.magic, horizon: S.horizon, hshadow: !!S.sunShadows, hshadowDist: hDist, sharpen: S.sharpen ? (S.lite ? 0.5 : 0.35) : 0, tsr: !!S.tsr, vxLod: S.vxLod || 48, lite: !!S.lite });
      this.folkBase = S.folk || 100; this.slowBase = !!S.slow;
      if (this.horizon) this.horizon.setLevel(S.horizon);
      if (this.aq && this.aq.stack.length) this.aqApply(this.aq, S, this.world);   // re-lay the smart-quality overrides over the new settings
      if (this.world) { this.world.renderDist = Math.max(5, S.renderDist - (this.aq && this.aq.over && this.aq.over.rd || 0)); if (key === 'fancyLeaves' || key === '*') { this.world.fancyLeaves = S.fancyLeaves; this.remeshAll(); } }
      if (this.input) { this.input.sensitivity = 0.0024 * S.sens; this.input.invertY = S.invertY; }
      if (this.audio) this.audio.setVolumes({ master: S.volMaster, sfx: S.volSfx, music: S.volMusic, ambient: S.volAmbient });
      // atmosphere switches: Wetter (the sky's weather, its sound and bolts) and Natur-Klänge (birds, crickets, water, wind)
      if (this.env && this.env.wx) this.env.wx.setMode(S.wx);
      if (this.ambience) this.ambience.setOptions({ nature: S.natSound !== 'off', weather: S.wx !== 'off' });
      if (this.particles) this.particles.budget = [0.25, 0.6, 1][S.particles];
      if (this.ui) { this.ui.fps(S.showFps ? '' : null); }
      this.applyLook();
    }
    // ---------------------------------------------------------------- the block look (v0.39)
    // Klassisch / Nahtlos (Settings → Graphics → Blöcke, /look): the registry flags here and in every worker, a re-mesh,
    // and the cube textures with or without the rim on the seamless materials. A guest sees the host's look.
    lookMode() { const m = (this.meta && this.meta.guest && this.hostLook) || this.settings.look; return m === 'seamless' ? 'seamless' : 'classic'; }
    applyLook() {
      const mode = this.lookMode();
      if (!VR.setLook || this.lookSent === mode) return false;
      VR.setLook(mode); this.lookSent = mode;
      if (this.pool) this.pool.broadcast({ type: 'look', mode });
      this.remeshAll();
      if (this.gadgets && this.gadgets.blue) this.gadgets.blue.reset();   // the ghosts of blueprints in hand follow the look
      if (this.tex && this.texRim !== VR.LOOK.rim) this.reloadTextures();
      return true;
    }
    // rebuild the block textures in a worker and upload them into the existing texture arrays; the icons follow
    reloadTextures() {
      const rim = VR.LOOK.rim, req = this.texReq = (this.texReq || 0) + 1;
      this.pool.direct(0, { type: 'textures', bevel: 1, bevelAll: rim }, null, (tex) => {
        const r = this.renderer, gl = r && r.gl;
        if (req !== this.texReq || tex.type !== 'textures' || !gl || !r.texAlbedo || tex.layers !== r.layers) return;
        for (const [t, lv] of [[r.texAlbedo, tex.albedo], [r.texMaterial, tex.material]]) {
          gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
          for (let i = 0; i < tex.levels; i++) { const n = tex.size >> i; gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, i, 0, 0, 0, n, n, tex.layers, gl.RGBA, gl.UNSIGNED_BYTE, lv[i]); }
        }
        Object.assign(this.tex, { albedo: tex.albedo, material: tex.material, avgColor: tex.avgColor }); this.texRim = rim;
        if (VR.LOOK.rim !== rim) { this.reloadTextures(); return; }   // switched again while these were built: once more
        if (this.icons) { this.icons.alb = tex.albedo[0]; this.icons.cache.clear(); this.icons.faceCache.clear(); }
        if (this.player && this.player.inv) this.player.inv.changed = true;
        if (this.ui && this.ui.updateHUD && this.state === 'play') this.ui.updateHUD(true);
      });
    }
    lookCommand(arg) {
      const say = (m, c) => this.ui.chatLine(m, c || '#cfe6ff');
      const m = { classic: 'classic', klassisch: 'classic', seamless: 'seamless', nahtlos: 'seamless' }[String(arg || '').toLowerCase()];
      if (!m) { say(this.lookText('label') + ': ' + this.lookText(this.settings.look === 'seamless' ? 'seamless' : 'classic') + ' · /look classic | seamless'); return; }
      this.settings.look = m; this.applySettings('look'); this.saveSettings();
      say(this.lookText(m + 'Say'), '#9affd8');
      if (this.meta && this.meta.guest && this.hostLook && this.hostLook !== m) say(this.lookText('host'), '#ffd27a');
    }
    // the look's words in the player's language (German or English; the other languages read the English). Without
    // the language module (i18n.js) German players are told by the Studio's language choice, else by the browser's.
    lookText(k) {
      const L = {
        label: ['Blöcke', 'Blocks'], classic: ['Klassisch', 'Classic'], seamless: ['Nahtlos', 'Seamless'],
        classicTip: ['Wie im Original: jeder Block mit eigenen Kanten, Hügel in Blockstufen, Glas und Muster pro Block', 'Like the original: every block with its own edges, hills in one-block steps, glass and patterns per block'],
        seamlessTip: ['Sanfte Hänge, verbundene Panoramafenster und Wandteile, nahtlose Putz- und Volltonflächen', 'Smooth slopes, joined panorama windows and wall pieces, seamless plaster and Vollton surfaces'],
        classicSay: ['Blöcke: Klassisch — jeder Block mit eigenen Kanten, Hügel in Stufen.', 'Blocks: Classic — every block with its own edges, hills in steps.'],
        seamlessSay: ['Blöcke: Nahtlos — sanfte Hänge, verbundenes Glas, nahtlose Materialien.', 'Blocks: Seamless — smooth slopes, joined glass, seamless materials.'],
        host: ['In dieser Welt gilt der Look des Hosts.', "In this world the host's look applies."],
      }[k] || [k, k];
      if (VR.I18N) return VR.I18N.tx('g.look.' + k, null, L[0], L[1]);
      let de = false; try { const s = localStorage.getItem('r9si.lang'); de = s ? s === 'de' : /^de\b/i.test(navigator.language || ''); } catch (e) { /* storage blocked */ }
      return de ? L[0] : L[1];
    }
    // the player's hero look (Settings → Character); a random one is rolled on first start
    heroOpts() {
      const S = this.settings;
      if (!S.hero || typeof S.hero !== 'object') { S.hero = VR.Folk && VR.Folk.randomHero ? VR.Folk.randomHero((Math.random() * 1e9) | 0) : { suit: 0, hair: 0, hs: 0, skin: 0 }; this.saveSettings(); }
      return S.hero;
    }
    remeshAll() { if (!this.world) return; for (const c of this.world.cols.values()) for (const s of c.sec) { s.dirty = true; s.ver++; } }
    // the Studio saved new designs (another tab of the same page): workers and icons pick them up, models re-mesh;
    // houses appear in towns generated from now on (unchanged towns rebuild themselves when the world is reloaded)
    reloadCustom(data) {
      if (!VR.Custom) return;
      if (data) VR.Custom.save(data);
      // only furniture / facade designs change what already stands (every piece is re-meshed); a house design is for
      // the towns built from now on — saving one must not re-mesh the whole world
      const sig = (d) => { const m = (d && d.models) || {}; return JSON.stringify(Object.keys(m).sort().map(k => [k, m[k] && m[k].t, m[k] && m[k].rle ? m[k].rle.length : 0])); };
      const before = this.customSig !== undefined ? this.customSig : sig(VR.CUSTOM);
      VR.Custom.apply(data || VR.Custom.load());
      const after = this.customSig = sig(VR.CUSTOM);
      if (this.pool) this.pool.broadcast({ type: 'custom', custom: VR.CUSTOM });
      if (after !== before) { if (this.icons) this.icons.cache.clear(); this.remeshAll(); }
      if (this.gadgets && this.gadgets.blue) this.gadgets.blue.reset();
      const n = VR.Custom.count();
      if (this.ui && this.ui.toast && this.state === 'play') this.ui.toast('R9 Studio', `${n.houses} eigene Häuser · ${n.models} eigene Items übernommen`);
      if (this.ui && this.ui.studioNote) this.ui.studioNote();
    }

    // ---------------------------------------------------------------- boot
    async boot() {
      try { this.renderer = new VR.Renderer(this.canvas); }
      catch (e) { this.fatal('This game needs WebGL 2. ' + e.message); return; }
      // the graphics context can be taken away (a driver reset, the GPU out of memory on a small machine, a tab
      // in the background too long): everything on the GPU is gone. The world is saved and the page starts again —
      // seconds, and nothing lost — instead of a black view that never comes back.
      this.canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        if (this.glLost) return;
        this.glLost = true;
        console.warn('WebGL context lost — saving and reloading');
        try { this.ui && this.ui.loading && this.ui.loading('Graphics were lost — saving…', 0.5); } catch (err) { /* the page may be half gone */ }
        const save = this.state === 'play' && this.meta && !this.meta.guest && this.world ? Promise.all([this.saveMeta(), this.world.saveAll()]) : Promise.resolve();
        Promise.race([save.catch(() => {}), new Promise((r) => setTimeout(r, 4000))]).then(() => { try { location.reload(); } catch (err) { /* nothing more to do */ } });
      }, false);
      this.input = new VR.Input(this.canvas);
      this.audio = new VR.Audio();
      this.env = new VR.Env();
      this.ambience = VR.Ambience ? new VR.Ambience(this.audio) : null;
      this.env.wx.onThunder = (d) => { if (this.ambience) this.ambience.thunder(d); };
      this.store = new VR.Store();
      this.ui = new VR.UI(this);
      this.mp = VR.MP ? new VR.MP(this) : null;
      if (this.mp) this.mp.init();
      this.ui.loading('Forging textures…', 0.05);
      const unlockAudio = () => { this.audio.resume(); };
      window.addEventListener('pointerdown', unlockAudio); window.addEventListener('keydown', unlockAudio);
      await this.store.open();
      // the player's R9 Studio designs (houses re-built in the Crafter, repainted furniture) — same-origin storage
      if (VR.Custom) { try { VR.Custom.apply(VR.Custom.load()); } catch (e) { console.warn('studio designs', e); } }
      window.addEventListener('storage', (e) => {
        if (VR.Custom && e.key === VR.Custom.KEY) this.reloadCustom();
        if (e.key && e.key.startsWith('r9si.plans.') && this.gadgets && this.gadgets.blue && e.key === this.gadgets.blue.plansKey()) this.gadgets.blue.loadPlans();
        // the Studio's Werkbank sent block changes for this world: build them now
        if (e.key && VR.Edits && this.meta && !this.meta.guest && e.key === VR.Edits.listKey(this.meta.id) && this.gadgets && this.gadgets.blue) this.gadgets.blue.editT = 0;
        // the Studio changed this world's style (another tab of the same page)
        if (e.key && VR.WorldStyle && this.meta && !this.meta.guest && e.key === VR.WorldStyle.key(this.meta.id)) this.applyStyle();
      });
      const n = Math.max(2, Math.min(6, (navigator.hardwareConcurrency || 4) - 1));
      const src = document.getElementById('worker-src').textContent;
      this.pool = new VR.WorkerPool(src, n);
      this.pool.maxInflight = 2;
      this.titleSeed = 0x7a3c21 ^ (Math.floor(Math.random() * 6) * 0x1111);
      this.pool.broadcast({ type: 'init', seed: this.titleSeed, opts: {}, custom: VR.CUSTOM });
      // the block look before the first texture and the first mesh
      if (VR.setLook) { VR.setLook(this.lookMode()); this.lookSent = VR.LOOK.mode; this.pool.broadcast({ type: 'look', mode: VR.LOOK.mode }); }
      // the textures are forged in a worker; a worker that fails (out of memory on a very small machine) is tried
      // once more on another, then the game says so instead of waiting forever behind the loading screen
      const forge = (wi) => new Promise((res) => this.pool.direct(wi, { type: 'textures', bevel: 1, bevelAll: !!(VR.LOOK && VR.LOOK.rim) }, null, res));
      let tex = await forge(0);
      if (tex.type !== 'textures') { console.warn('textures failed once:', tex.msg); tex = await forge(this.pool.workers.length > 1 ? 1 : 0); }
      if (tex.type !== 'textures') { this.fatal('The block textures could not be built (' + (tex.msg || 'worker failed') + '). Close other tabs and reload.'); return; }
      if (tex.missing && tex.missing.length) console.warn('Missing textures:', tex.missing);
      this.tex = tex; this.texRim = !!(VR.LOOK && VR.LOOK.rim);
      tex.noise = tex.noise;
      this.renderer.init(tex);
      this.icons = new VR.Icons(tex);
      this.particles = new VR.Particles(this);
      this.trails = VR.Trails ? new VR.Trails(this) : null;
      this.director = VR.Director ? new VR.Director(this) : null;
      this.cockpit = VR.Cockpit ? new VR.Cockpit(this) : null;
      this.horizon = VR.Horizon ? new VR.Horizon(this) : null;
      // first run: weak or old GPUs (integrated / mobile / software renderers) start on Very Low or Low
      if (this.settings.autoPreset) {
        const gpu = String(VR.GL.rendererName || ''), cur = this.settings.preset;
        const weak = /SwiftShader|llvmpipe|Mesa|Mali-[4T]|Mali-G[0-6]\d\b|Adreno \(TM\) [3-5]|PowerVR|Intel\(R\) HD Graphics( [2-5]\d{3})?\b|Intel\(R\) HD Graphics [2-5]\d{2}\b|GMA|Apple A[0-9]\b/i.test(gpu);
        const mid = /Intel\(R\) (UHD|Iris)|Intel\(R\) HD Graphics 6|Adreno \(TM\) 6|Mali-G7|Radeon\(TM\) (Vega|Graphics)|GeForce (9|GT |MX)/i.test(gpu);
        const want = weak ? 'potato' : mid && cur !== 'potato' ? 'low' : cur;
        if (want !== cur) { this.settings.preset = want; Object.assign(this.settings, PRESETS[want]); }
        this.settings.autoPreset = false; this.saveSettings();
      }
      this.applySettings('*');
      document.getElementById('gpuinfo').textContent = (VR.GL.rendererName || 'WebGL2') + (this.renderer.multi ? ' · multi-draw' : '');
      window.addEventListener('resize', () => this.renderer.resize(false));
      this.last = performance.now();
      requestAnimationFrame((t) => this.loop(t));
      // ▶ Spielen in the R9 Studio comes here as index.html#play=<world>: that world opens directly, no title
      const playId = (/[#&]play=([^&]+)/.exec(location.hash || '') || [])[1];
      if (playId) { try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* */ } this.playWorldId(decodeURIComponent(playId)); }
      else this.startTitle();
    }
    fatal(msg) {
      document.getElementById('ui').innerHTML = `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;color:#e8f0ff;font-family:sans-serif;text-align:center;padding:20px"><h2>R9-SI can't start</h2><div>${msg}</div><div style="color:#93a4c4">Try an up-to-date Chrome, Edge or Firefox with hardware acceleration enabled.</div></div>`;
    }

    // ---------------------------------------------------------------- title panorama
    startTitle() {
      this.state = 'title';
      this.teardownWorld();
      this.pool.broadcast({ type: 'init', seed: this.titleSeed, opts: { vgen: 5 }, custom: VR.CUSTOM });
      this.world = new VR.World(this, { dim: 'overworld', seed: this.titleSeed, genOpts: { vgen: 5 }, pool: this.pool, renderer: this.renderer, renderDist: Math.min(this.settings.renderDist, 8) });
      this.world.fancyLeaves = this.settings.fancyLeaves;
      this.titleCam = { x: 0.5, y: 110, z: 0.5, yaw: 0, pitch: -0.12, fov: 70 * Math.PI / 180 };
      this.env.wx.setSeed(null);                       // the title has no weather: the panorama stays as it was
      this.env.setTime(12800 + Math.random() * 1200); // golden hour → dusk: planets rising
      this.pool.direct(0, { type: 'spawn', dim: 'overworld' }, null, (m) => {
        const p = m.pos || [0.5, 100, 0.5];
        this.titleCam.x = p[0]; this.titleCam.z = p[2]; this.titleCam.y = p[1] + 22; this.titleBase = p;
      });
      this.ui.show('title');
      if (this.ui.studioNote) this.ui.studioNote();
      this.starships = VR.Starships ? new VR.Starships(this, { title: true }) : null;
      this.traffic = VR.Traffic ? new VR.Traffic(this) : null;
      if (this.traffic) this.traffic.t = 2.5;
    }
    teardownWorld() {
      if (this.world) { this.world.destroy(); this.world = null; }
      this.pool && this.pool.clear();
      this.entities = null; this.player = null; this.sim = null; this.gadgets = null; this.vehicleCam = null; this.raidActive = false;
      if (this.traffic) { this.traffic.destroy(); this.traffic = null; }
      if (this.starships) { this.starships.destroy(); this.starships = null; }
      if (this.villages) { this.villages.destroy(); this.villages = null; }
      if (this.trams) { this.trams.destroy(); this.trams = null; }
      if (this.horizon) this.horizon.reset();
      if (this.furnaces) this.furnaces.clear();
      this.renderer && (this.renderer.visDirty = true);
    }

    // ---------------------------------------------------------------- world lifecycle
    async createWorld(o) {
      const seedStr = o.seed;
      let seed = seedStr ? (/^-?\d+$/.test(seedStr) ? (parseInt(seedStr, 10) >>> 0) : VR.seedFromString(seedStr)) : (Math.floor(Math.random() * 4294967295) >>> 0);
      const meta = { id: 'w' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36), name: o.name, seed, mode: o.mode, difficulty: o.difficulty, type: o.type, cheats: o.cheats !== false, keep: !!o.keep, kit: o.kit !== false, created: Date.now(), lastPlayed: Date.now(), player: null, time: 1000, dim: 'overworld', vgen: 5 }; // vgen 2: bigger villages with farmsteads & a supermarket · 3: the Heartland (TRAILER.md) · 4: modern towns · 5: villa-scale towns in 640-block cells
      await this.store.saveWorld(meta);
      this.startWorld(meta, true);
    }
    async loadWorld(meta) { meta.lastPlayed = Date.now(); await this.store.saveWorld(meta); this.startWorld(meta, false); }
    async startWorld(meta, fresh) {
      this.ui.loading('Preparing world…', 0.02);
      this.teardownWorld();
      this.meta = meta;
      this.store.bind(meta.id);
      this.difficulty = meta.difficulty;
      this.keepInventory = meta.keep;
      const genOpts = { worldType: meta.type === 'flat' ? 'flat' : meta.type, vgen: meta.vgen || 1 };
      this.style = this.styleNow(); this.styleKey = this.styleSig(this.style);
      this.pool.broadcast({ type: 'init', seed: meta.seed, opts: genOpts, custom: VR.CUSTOM, style: this.style });
      const dim = meta.type === 'flat' ? 'flat' : (meta.dim || 'overworld');
      this.dim = dim;
      const savedKeys = await this.store.savedKeys(dim);
      this.world = new VR.World(this, { dim, seed: meta.seed, genOpts, pool: this.pool, renderer: this.renderer, store: this.store, savedKeys, renderDist: this.settings.renderDist });
      this.world.fancyLeaves = this.settings.fancyLeaves;
      this.player = new VR.Player(this);
      this.player.mode = meta.mode;
      this.env.setTime(meta.time || 1000);
      this.env.day = meta.day || 0;
      this.env.wx.setSeed(meta.seed);                   // the world's weather: the same for the host and every guest
      this.zenFreezeTime = !!meta.zenFreezeTime; this.zenFreezeWeather = !!meta.zenFreezeWeather;
      const entry = this.pendingEntry || 'title'; this.pendingEntry = null;
      if (meta.player) this.player.load(meta.player);
      else {
        const pos = await new Promise((res) => this.pool.direct(0, { type: 'spawn', dim }, null, (m) => res(m.pos || [0.5, 100, 0.5])));
        this.player.teleport(pos[0], pos[1] + 0.2, pos[2]);
        this.player.spawn = [pos[0], pos[1] + 0.2, pos[2]];
        this.player.yaw = pos[3] !== undefined ? pos[3] : Math.random() * Math.PI * 2;
        this.giveKit(meta);
      }
      this.landOnEntry(entry, !meta.player);
      this.sim = VR.Sim ? new VR.Sim(this) : null;
      this.entities = VR.Entities ? new VR.Entities(this) : null;
      this.codex = VR.Codex ? new VR.Codex(this, meta) : { onCraft() {}, list() { return []; }, update() {} };
      if (VR.installCraftingHooks) VR.installCraftingHooks(this);
      this.gadgets = VR.Gadgets ? new VR.Gadgets(this) : null;
      this.map = VR.MapView ? (this.map || new VR.MapView(this)) : null;
      if (this.traffic) this.traffic.destroy();
      if (this.starships) this.starships.destroy();
      this.starships = VR.Starships ? new VR.Starships(this) : null;
      this.traffic = VR.Traffic ? new VR.Traffic(this) : null;
      this.villages = VR.Villages ? new VR.Villages(this, meta) : null;
      if (this.trams) this.trams.destroy();
      this.trams = VR.Trams ? new VR.Trams(this) : null;
      this.world.listeners.push(this);
      if (this.mp) this.world.listeners.push(this.mp);
      this.state = 'loading';
      this.loadStart = performance.now(); this.nearReadyAt = 0;
    }
    // ---------------------------------------------------------------- the world's style (v0.34)
    // rules "this block → that block" and a water colour for everything the game generates, set in the R9 Studio
    // (◍ Welt → 🎨 Stil); with friends in the world only the rules multiplayer allows (buildings, furniture, trees)
    styleNow() {
      const WS = VR.WorldStyle; if (!WS || !this.meta) return null;
      if (this.meta.guest) return this.guestStyle ? WS.effective(this.guestStyle, false) : null;
      const raw = WS.load(this.meta.id); if (!raw) return null;
      const mpOn = !!(this.mp && this.mp.isHost && this.mp.remote && this.mp.remote.size > 0);
      return WS.effective(raw, mpOn);
    }
    styleSig(st) { return st ? JSON.stringify([st.sv, st.rules, st.water]) : ''; }
    applyStyle(quiet) {
      const st = this.styleNow(), sig = this.styleSig(st);
      if (sig === this.styleKey) return false;
      this.styleKey = sig; this.style = st;
      this.pool.broadcast({ type: 'style', style: st });
      if (this.world && (this.state === 'play' || this.state === 'loading')) this.world.restyle();
      if (!quiet && this.ui && this.ui.toast && this.state === 'play') this.ui.toast(VR.I18N ? VR.I18N.tx('g.style.title', null, 'Welt-Stil', 'World style') : 'World style', st && st.rules && st.rules.length ? (VR.I18N ? VR.I18N.tx('g.style.on', { n: st.rules.length }, '{n} Ersetzungen aktiv', '{n} replacements active') : st.rules.length + ' replacements active') : (VR.I18N ? VR.I18N.tx('g.style.off', null, 'Original', 'Original') : 'Original'));
      return true;
    }
    // ---------------------------------------------------------------- R9 Studio over the running game (v0.35)
    // The pause menu opens the Studio on this world (its Werkbank) in a layer above the game: the world is saved first
    // (the Studio reads it from the save), the game stops drawing meanwhile, and everything the Studio changed — Werkbank
    // edits, plans, the world's style, designs — is in the world the moment you come back. A host that does not allow
    // frames gets the Studio in this window instead.
    openStudio() {
      if (this.state !== 'play' || !this.meta || this.meta.guest || this.studioOpen) return false;
      this.studioOpen = true;
      this.ui.show(null);
      try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) { /* */ }
      const url = 'studio.html' + (location.search || '') + '#world/' + encodeURIComponent(this.meta.id) + '/bench';
      const go = (fr) => {
        fr.src = url; fr.classList.add('on');
        const t0 = Date.now();
        const probe = () => {
          if (!this.studioOpen) return;
          let ok = false, broken = false;
          try { const d = fr.contentWindow && fr.contentWindow.document; ok = !!(d && d.getElementById('studio')); broken = !d || /^chrome-error|^about:neterror/.test(String(fr.contentWindow.location.href)); } catch (e) { broken = true; }
          if (ok) { try { fr.contentWindow.focus(); } catch (e) { /* */ } return; }
          if (broken || Date.now() - t0 > 15000) { this.closeStudio(true); location.href = url; return; }
          setTimeout(probe, 300);
        };
        setTimeout(probe, 500);
      };
      Promise.resolve().then(() => this.saveMeta()).then(() => this.world.saveAll()).catch(() => { /* the Studio reads what is saved */ }).then(() => {
        if (!this.studioOpen) return;
        let fr = document.getElementById('studioFrame');
        if (!fr) { fr = document.createElement('iframe'); fr.id = 'studioFrame'; fr.title = 'R9 Studio'; fr.setAttribute('allow', 'pointer-lock; fullscreen; clipboard-read; clipboard-write'); document.getElementById('app').appendChild(fr); }
        go(fr);
      });
      return true;
    }
    closeStudio(silent, o) {
      if (!this.studioOpen) return;
      const fr = document.getElementById('studioFrame');
      if (fr) { fr.classList.remove('on'); setTimeout(() => { if (!this.studioOpen && fr) fr.src = 'about:blank'; }, 60); }
      this.studioOpen = false;
      this.last = performance.now();
      // what the Studio did, in the world now
      const b = this.gadgets && this.gadgets.blue;
      if (b) { b.loadPlans(); for (let i = 0; i < 10; i++) { b.editT = 0; b.tickEdits(0); } b.planT = 0; }
      this.applyStyle(true);
      // 📍 the newest thing the Studio set into this world: you stand in front of it (else you play on where you were)
      if (!silent && this.state === 'play' && this.landOnEntry('overlay', false) !== 'none') this.saveMeta();
      if (!silent && this.state === 'play') { if (o && o.play) this.ui.resume(); else this.ui.pause(); }
    }
    // ---------------------------------------------------------------- 📍 where you come in (v0.38)
    // from the Studio's ▶: in front of the newest thing you set into this world (looking at it), or at your spawn point
    // when there is nothing new · over the open game (the Studio's overlay): the new thing, or on where you were · from
    // the title: where you were. Always on a free spot — a house the Studio set onto it meanwhile never traps you.
    landOnEntry(entry, isNew) {
      const p = this.player, m = this.meta; if (!p || !m || m.guest) return 'none';
      const LD = VR.Landing, o = LD ? LD.read(m.id) : {};
      if (LD && LD.freshSpawn(o, m)) { p.spawn = o.spawn.pos.slice(0, 3); p.spawnBed = null; m.spawnAt = o.spawn.at; }
      const fresh = !!(LD && LD.fresh(o, m));
      if (o.landing) m.seenLanding = Math.max(m.seenLanding || 0, o.landing.at || 0);
      const toNew = () => { const L = o.landing; p.flying = false; p.safeTeleport(L.pos[0], L.pos[1], L.pos[2], { keep: true, yaw: L.yaw, pitch: L.pitch }); this.revealPending = Array.isArray(L.box) ? { box: L.box, label: L.label || '' } : null; if (!this.revealPending && this.ui.toast) this.ui.toast('R9 Studio', '✨ ' + (L.label || 'Neu')); return 'new'; };
      let r = 'here';
      if (entry === 'studio') {
        if (fresh) r = toNew();
        else { const sp = Array.isArray(p.spawn) && p.spawn.every(Number.isFinite) ? p.spawn : this.worldSpawn(); p.flying = false; p.safeTeleport(sp[0], sp[1], sp[2], { keep: true, bed: p.spawnBed || null }); r = 'spawn'; }
      } else if (entry === 'overlay') {
        if (fresh) r = toNew(); else { p.unstick(); r = 'stay'; }
      } else if (!isNew) p.safeTeleport(p.pos[0], p.pos[1], p.pos[2], { keep: true, fly: p.flying, yaw: p.yaw, pitch: p.pitch });
      this.landedBy = r;
      return r;
    }
    // ✨ the arrival: a short flight from high up and a little to the side down to your own eyes, looking at the new
    // thing — then the view is yours (any key or click skips it). Starts once you stand there.
    reveal() {
      const R0 = this.revealPending; this.revealPending = null;
      const p = this.player, b = R0 && R0.box; if (!b || !p || !this.director) return false;
      const eye = [p.pos[0], p.pos[1] + p.eye, p.pos[2]];
      const c = [(b[0] + b[3] + 1) / 2, b[1] + (b[4] - b[1] + 1) * 0.5, (b[2] + b[5] + 1) / 2];
      const size = Math.max(b[3] - b[0] + 1, b[4] - b[1] + 1, b[5] - b[2] + 1);
      let hx = eye[0] - c[0], hz = eye[2] - c[2]; const hl = Math.hypot(hx, hz) || 1; hx /= hl; hz /= hl;
      const a = 0.55, rx = hx * Math.cos(a) - hz * Math.sin(a), rz = hx * Math.sin(a) + hz * Math.cos(a);
      const back = hl + size * 1.1 + 8, start = [c[0] + rx * back, Math.min((VR.MAXY || 250) - 4, c[1] + size * 0.8 + 10), c[2] + rz * back];
      const ld = p.lookDir(), end = [eye[0] + ld[0] * 12, eye[1] + ld[1] * 12, eye[2] + ld[2] * 12];
      const fov = this.settings && this.settings.fov ? this.settings.fov : 72;
      this.lastReveal = { label: R0.label, at: Date.now() };
      return this.director.play([{ name: 'reveal', dur: 2.6, fov, keys: [[0, start, c], [2.6, eye, end]], caption: '✨ ' + (R0.label || ''), capSmall: true }], { quick: true, skipAny: true, noFadeOut: true });
    }
    // a world by its id (the Studio's ▶): this one is saved first
    async playWorldId(id) {
      try { if (this.meta && !this.meta.guest && this.world && this.state === 'play') { await this.saveMeta(); await this.world.saveAll(); } } catch (e) { console.warn(e); }
      let meta = null; try { meta = (await this.store.listWorlds()).find(w => w && w.id === id); } catch (e) { meta = null; }
      if (!meta) { if (this.state !== 'title') this.startTitle(); this.ui.hint('That world is not here (any more).', 3200); return false; }
      this.pendingEntry = 'studio';
      await this.loadWorld(meta);
      return true;
    }
    // ▶ Spielen in the Studio over the game: this world → close the Studio, land, play on; another world → open that one
    studioPlay(id) {
      if (id && this.meta && id !== this.meta.id) { this.closeStudio(true); this.playWorldId(id); return true; }
      this.closeStudio(false, { play: true });
      return true;
    }
    // 📍 in the pause menu: your spawn point is where you stand
    setSpawnHere() {
      const p = this.player; if (!p || p.dead || !this.meta || this.meta.guest) return false;
      p.spawn = [Math.floor(p.pos[0]) + 0.5, Math.floor(p.pos[1] + 0.01), Math.floor(p.pos[2]) + 0.5]; p.spawnBed = null;
      this.saveMeta();
      return true;
    }
    // the world's own spawn (where it started), used when a bed is gone or you are lost
    worldSpawn() {
      const m = this.meta || {};
      if (Array.isArray(m.worldSpawn) && m.worldSpawn.length >= 3) return m.worldSpawn.slice(0, 3);
      if (this.player && Array.isArray(this.player.spawn)) return this.player.spawn.slice(0, 3);
      return [0.5, 100, 0.5];
    }
    goHome() {
      const p = this.player; if (!p || p.dead) return;
      if (this.gadgets && this.gadgets.riding) { this.ui.chatLine('Land or get off first.', '#ff8a8a'); return; }
      const sp = p.spawn && p.spawn.every(v => isFinite(v)) ? p.spawn : this.worldSpawn();
      p.safeTeleport(sp[0], sp[1], sp[2], { bed: p.spawnBed || null });
      this.ui.chatLine(p.spawnBed ? 'Home to your bed.' : 'Home to the world spawn.', '#9affd8');
    }
    // join a friend's world: same seed, their edits streamed in, nothing saved here
    startGuestWorld(wel, mp) {
      this.ui.loading('Joining ' + (mp.hostName || 'your friend') + '…', 0.05);
      this.teardownWorld();
      const W = wel.w || {};
      const meta = { id: 'guest-' + String(W.id || 'x').replace(/[^a-z0-9]/gi, '').slice(0, 30), guest: true, name: (W.name || 'World') + ' · with ' + (mp.hostName || 'friend'), seed: (W.seed >>> 0), mode: ['survival', 'creative', 'zen'].includes(W.mode) ? W.mode : 'creative', difficulty: W.difficulty || 'normal', type: W.type || 'default', cheats: !!W.cheats, keep: !!W.keep, kit: true, time: +wel.time || 1000, day: +wel.day || 0, dim: 'overworld', worldSpawn: Array.isArray(wel.home) ? wel.home : null, vgen: +W.vgen || 1 };
      this.meta = meta;
      this.hostLook = wel.look === 'seamless' || wel.look === 'classic' ? wel.look : null; this.applyLook();   // the host's block look
      this.difficulty = meta.difficulty; this.keepInventory = meta.keep;
      const genOpts = { worldType: meta.type === 'flat' ? 'flat' : meta.type, vgen: meta.vgen || 1 };
      // the host's world style, as multiplayer allows it (buildings, furniture, trees — the land stays shared)
      this.guestStyle = wel.style && typeof wel.style === 'object' ? wel.style : null;
      this.style = this.styleNow(); this.styleKey = this.styleSig(this.style);
      this.pool.broadcast({ type: 'init', seed: meta.seed, opts: genOpts, custom: VR.CUSTOM, style: this.style });
      const dim = meta.type === 'flat' ? 'flat' : 'overworld';
      this.dim = dim;
      this.world = new VR.World(this, { dim, seed: meta.seed, genOpts, pool: this.pool, renderer: this.renderer, store: null, savedKeys: new Set(), renderDist: this.settings.renderDist });
      this.world.fancyLeaves = this.settings.fancyLeaves;
      this.player = new VR.Player(this);
      this.player.mode = meta.mode;
      this.env.setTime(meta.time); this.env.day = meta.day;
      this.env.wx.setSeed(meta.seed); this.env.wx.force(VR.WX.KINDS.includes(wel.wx) ? wel.wx : null);   // the host's forced weather, if any
      this.zenFreezeTime = false; this.zenFreezeWeather = false;
      const sp = Array.isArray(wel.spawn) ? wel.spawn : [0.5, 100, 0.5, 0, 0];
      this.player.teleport(sp[0] + 1.2, sp[1], sp[2] + 0.6);
      this.player.safeTeleport(sp[0] + 1.2, sp[1], sp[2] + 0.6, { fly: !!sp[4] });
      this.player.yaw = +sp[3] || 0;
      this.player.spawn = meta.worldSpawn ? meta.worldSpawn.slice(0, 3) : [sp[0], sp[1], sp[2]];
      this.giveKit(meta);
      this.sim = VR.Sim ? new VR.Sim(this) : null;
      this.entities = VR.Entities ? new VR.Entities(this) : null;
      this.codex = VR.Codex ? new VR.Codex(this, meta) : { onCraft() {}, list() { return []; }, update() {} };
      if (VR.installCraftingHooks) VR.installCraftingHooks(this);
      this.gadgets = VR.Gadgets ? new VR.Gadgets(this) : null;
      this.map = VR.MapView ? (this.map || new VR.MapView(this)) : null;
      if (this.traffic) this.traffic.destroy();
      if (this.starships) this.starships.destroy();
      this.starships = VR.Starships ? new VR.Starships(this) : null;
      this.traffic = VR.Traffic ? new VR.Traffic(this) : null;
      this.villages = VR.Villages ? new VR.Villages(this, meta) : null;
      if (this.trams) this.trams.destroy();
      this.trams = VR.Trams ? new VR.Trams(this) : null;
      this.world.listeners.push(this);
      this.world.listeners.push(mp);
      this.state = 'loading';
      this.loadStart = performance.now(); this.nearReadyAt = 0;
    }
    leaveGuestWorld(msg) {
      if (this.mp) this.mp.clearSession();
      this.hostLook = null; this.applyLook();   // back to my own block look
      try { if (this.starships) this.starships.shutdown(); if (this.gadgets) this.gadgets.shutdown(); } catch (e) { console.warn(e); }
      this.input.releaseLock();
      this.startTitle();
      if (msg) this.ui.titleNote(msg);
    }
    giveKit(meta) {
      const inv = this.player.inv;
      if (meta.mode !== 'survival') {
        const kit = ['grass_block', 'oak_planks', 'stone_bricks', 'glass', 'violet_crystal_block', 'hull_plating', 'neon_cyan', 'lantern', 'oak_log'];
        kit.forEach((id, i) => { if (R.byName[id] || VR.ITEMS[id]) inv.slots[i] = { id, n: 64 }; });
        const extra = ['builder_wand', 'laser_blaster', 'jetpack', 'hoverbike', 'shuttle_beacon', 'torch', 'azure_crystal_cluster', 'water_bucket', 'tech_panel', 'landing_pad', 'cherry_leaves', 'quartz_block'];
        extra.forEach((id, i) => { if (R.byName[id] || VR.ITEMS[id]) inv.slots[9 + i] = { id, n: VR.maxStack(id) }; });
      } else if (meta.kit) {
        inv.add('wooden_pickaxe', 1); inv.add('wooden_axe', 1); inv.add('bread', 6); inv.add('torch', 12); inv.add('apple', 3);
      }
      inv.changed = true;
    }
    saveMeta() {
      if (!this.meta || !this.player) return Promise.resolve();
      if (this.meta.guest) { if (this.mp) this.mp.sendPdata(); return Promise.resolve(); }
      if (this.mp && this.mp.isHost) this.mp.savePending();
      const m = this.meta;
      m.player = this.player.toJSON(); m.time = this.env.ticks; m.day = this.env.day; m.lastPlayed = Date.now(); m.dim = this.dim;
      m.zenFreezeTime = this.zenFreezeTime; m.zenFreezeWeather = this.zenFreezeWeather;
      if (this.codex && this.codex.toJSON) m.codex = this.codex.toJSON();
      if (this.gadgets) this.gadgets.beforeSave(m);
      if (this.starships) this.starships.beforeSave(m);
      if (this.villages) this.villages.beforeSave(m);
      return this.store.saveWorld(m);
    }
    async quitToTitle() {
      if (this.meta && this.meta.guest) { if (this.mp) this.mp.leave(); this.leaveGuestWorld(); return; }
      if (this.mp && this.mp.isHost) this.mp.stopHosting();
      this.ui.loading('Saving…', 0.5);
      try { if (this.starships) this.starships.shutdown(); if (this.gadgets) this.gadgets.shutdown(); } catch (e) { console.warn(e); }
      try { await this.saveMeta(); await this.world.saveAll(); } catch (e) { console.warn(e); }
      this.input.releaseLock();
      this.startTitle();
    }

    // world listener hooks
    onBlockChanged(x, y, z, old, s) { if (this.sim && !(this.mp && this.mp.isClient)) this.sim.onBlockChanged(x, y, z, old, s); if (this.gadgets) this.gadgets.onBlockChanged(x, y, z, old, s); if (this.villages) this.villages.onBlockChanged(x, y, z, old, s); }
    onColumnLoaded(c) { if (this.sim && this.sim.onColumnLoaded) this.sim.onColumnLoaded(c); if (this.entities && this.entities.onColumnLoaded) this.entities.onColumnLoaded(c); if (this.villages) this.villages.onColumnLoaded(c); if (this.starships) this.starships.onColumnLoaded(c); if (this.gadgets) this.gadgets.onColumnLoaded(c); }

    // ---------------------------------------------------------------- main loop
    loop(t) {
      if (this.glLost) return;   // the context is gone: no more frames (the page reloads)
      requestAnimationFrame((tt) => this.loop(tt));
      let dt = (t - this.last) / 1000; this.last = t;
      if (!(dt > 0)) dt = 0.016;
      dt = Math.min(dt, 0.1);
      this.frame++;
      // main-thread time per frame vs. the frame interval: when the CPU is the bottleneck, lowering the
      // resolution only blurs the picture — the sim budget shrinks instead
      const tj0 = performance.now();
      if (this.jsMs === undefined) this.jsMs = 8;
      this.cpuBound = this.jsMs > Math.max(9, dt * 1000 * 0.72) && dt > 1 / 55;
      this.fpsAcc = (this.fpsAcc || 0) + dt; this.fpsN = (this.fpsN || 0) + 1;
      if (this.fpsAcc > 0.5) { this.fps = this.fpsN / this.fpsAcc; this.fpsAcc = 0; this.fpsN = 0; }
      try {
        if (this.cockpit && this.state !== 'play') this.cockpit.updateHud(0, true);
        if (this.state === 'title') this.titleFrame(dt);
        else if (this.state === 'loading') this.loadingFrame(dt);
        else if (this.state === 'play') { if (!this.studioOpen) this.playFrame(dt); }
        if (this.mp) this.mp.update(dt);
      } catch (e) { console.error(e); if (!this.errShown) { this.errShown = true; this.ui && this.ui.chatLine && this.ui.chatLine('Error: ' + e.message, '#ff8a8a'); } }
      this.input.endFrame();
      this.jsMs += (performance.now() - tj0 - this.jsMs) * 0.08;
    }
    // ---------------------------------------------------------------- R9 Smart Quality
    // The old "dynamic resolution" blurred the picture whenever the frame rate dropped — and near villages
    // that often did not even help, because the main thread (villagers, meshing) was the bottleneck, not
    // the GPU. This controller measures both sides (GPU time from the timer-query extension, main-thread
    // time from the loop) and climbs two ladders instead:
    //   GPU ladder: shadow map every other frame → god rays off → shorter furniture-detail radius →
    //               smaller shadow map → simple clouds → (only then) a small resolution step, sharpened →
    //               shorter far horizon → one chunk less
    //   CPU ladder: sim/mesh budgets → villagers drawn closer only → fewer mesh jobs per frame → chunks
    // Every step is probed: if it does not buy frame rate it is undone and the other ladder is tried.
    // Everything is undone again when the frame rate has been fine for a while. The user's settings never change.
    smartQuality(dt, S, w) {
      const r = this.renderer, hz = this.horizon;
      const aq = this.aq || (this.aq = { g: 0, c: 0, hold: 0, good: 0, stack: [], bad: {}, backoff: 6, hzBase: -1, winT: 0, winN: 0, probe: null, over: null });
      if (!S.dynRes || !this.fps) {
        if (aq.stack.length) this.aqReset(aq, S, w);
        this.cpuBound = (this.jsMs > Math.max(9, dt * 1000 * 0.72) && dt > 1 / 55) || !!this.slowBase;
        this.folkDist = this.folkBase || 100;
        return;
      }
      const target = 55, budget = 1000 / target;
      const gpuMs = r.gpuMs, jsMs = this.jsMs;
      // who is the bottleneck? measured when the browser exposes GPU timing, estimated otherwise
      let gpuBound, cpuBound;
      if (gpuMs !== undefined) { gpuBound = gpuMs > budget * 0.85 && gpuMs >= jsMs * 0.9; cpuBound = jsMs > budget * 0.7 && jsMs > gpuMs * 0.8; }
      else { cpuBound = jsMs > Math.max(9, dt * 1000 * 0.6) && dt > 1 / 55; gpuBound = !cpuBound; }
      this.cpuBound = cpuBound || aq.c > 0 || !!this.slowBase;
      aq.gpuBound = gpuBound; aq.cpuBound = cpuBound;
      // a smoothed 2 s frame-rate window for decisions (the HUD fps is a 0.5 s window)
      aq.winT += dt; aq.winN++;
      if (aq.winT >= 2) { aq.fpsWin = aq.winN / aq.winT; aq.winT = 0; aq.winN = 0; }
      const fps = aq.fpsWin || this.fps;
      aq.hold = Math.max(0, aq.hold - dt);
      const now = this.time;
      // probe result: did the last step help?
      if (aq.probe && aq.hold <= 0) {
        const pr = aq.probe; aq.probe = null;
        const gain = fps / Math.max(1, pr.fps0);
        if (gain < 1.06 && fps < target - 4) {
          // no gain: undo it, remember that this ladder does not help right now
          aq.bad[pr.kind] = now;
          this.aqPop(aq, S, w);
          aq.hold = 1.5;
        }
      }
      const gLadder = this.aqGpuRungs(S), cLadder = this.aqCpuRungs(S);
      // a frame-rate cap (vsync at 30 Hz, battery saver, a background tab) is not a bottleneck: both sides idle
      const capped = gpuMs !== undefined && fps > 0 && (gpuMs + jsMs) < (1000 / fps) * 0.55;
      const struggling = fps < target - 8 && !capped && this.time > 4, fine = fps > target + 3 || capped;
      if (struggling && aq.hold <= 0 && !aq.probe) {
        aq.good = 0;
        // preferred ladder: the measured bottleneck, unless that ladder just proved useless
        const gOk = aq.g < gLadder.length && !(aq.bad.g && now - aq.bad.g < 30);
        const cOk = aq.c < cLadder.length && !(aq.bad.c && now - aq.bad.c < 30);
        let kind = null;
        if (gpuBound && gOk) kind = 'g'; else if (cpuBound && cOk) kind = 'c'; else if (gOk) kind = 'g'; else if (cOk) kind = 'c';
        if (kind) { this.aqPush(aq, kind, S, w); aq.probe = { kind, fps0: fps }; aq.hold = 2.5; }
      } else if (fine && aq.stack.length) {
        aq.good += dt;
        if (aq.good > aq.backoff && aq.hold <= 0) {
          this.aqPop(aq, S, w); aq.good = 0; aq.hold = 3; aq.upT = now;
        }
      } else if (!fine) aq.good = 0;
      // fell back within 8 s of a step up: wait longer next time (up to a minute)
      if (aq.upT && struggling && now - aq.upT < 8) { aq.backoff = Math.min(60, aq.backoff * 2); aq.upT = 0; }
      else if (aq.upT && now - aq.upT > 20) { aq.backoff = Math.max(6, aq.backoff * 0.7); aq.upT = 0; }
    }
    aqGpuRungs(S) {
      const R = SHADOW_RES[S.shadows] || 0, D = SHADOW_DIST[S.shadows] || 0;
      const floor = S.tsr ? 0.78 : 0.85;
      const list = [
        (o) => { o.shadowEvery = 2; },
        (o) => { o.rays = false; },
        (o) => { o.vxLod = Math.max(16, Math.round((S.vxLod || 48) * 0.6)); },
        (o) => { if (R) { o.shadows = Math.max(512, R / 2); o.shadowDist = Math.max(24, D * 0.7); } },
        (o) => { o.clouds = Math.min(S.clouds, 1); o.vxLod = Math.max(16, Math.round((S.vxLod || 48) * 0.4)); },
        (o) => { o.scale = Math.max(floor, S.scale - 0.1); o.sharpen = Math.max(S.sharpen ? 0.35 : 0, 0.45); },
        (o) => { o.scale = Math.max(floor - 0.08, S.scale - 0.2); o.sharpen = 0.55; },
        (o) => { o.hz = 1; },
        (o) => { o.rd = 1; },
        (o) => { o.rd = 2; },
      ];
      return list;
    }
    aqCpuRungs(S) {
      return [
        (o) => { o.sim = 1; },
        (o) => { o.folkDist = 56; },
        (o) => { o.mesh = 3; o.folkDist = 44; },
        (o) => { o.rd = 1; },
        (o) => { o.rd = 2; },
      ];
    }
    aqPush(aq, kind, S, w) { if (kind === 'g') aq.g++; else aq.c++; aq.stack.push(kind); this.aqApply(aq, S, w); if (VR.AQ_TRACE) console.log('aq push', kind, aq.stack.join(''), 'fps', (aq.fpsWin || this.fps || 0).toFixed(0), 't', this.time.toFixed(1)); }
    aqPop(aq, S, w) { const k = aq.stack.pop(); if (!k) return; if (k === 'g') aq.g--; else aq.c--; this.aqApply(aq, S, w); if (VR.AQ_TRACE) console.log('aq pop', k, aq.stack.join(''), 'fps', (aq.fpsWin || this.fps || 0).toFixed(0), 't', this.time.toFixed(1)); }
    aqReset(aq, S, w) { aq.g = 0; aq.c = 0; aq.stack.length = 0; aq.probe = null; this.aqApply(aq, S, w); }
    aqApply(aq, S, w) {
      const o = {}, gL = this.aqGpuRungs(S), cL = this.aqCpuRungs(S);
      for (let i = 0; i < aq.g; i++) gL[i](o);
      for (let i = 0; i < aq.c; i++) cL[i](o);
      // renderer overrides
      const ro = {};
      for (const k of ['shadowEvery', 'rays', 'vxLod', 'shadows', 'shadowDist', 'clouds', 'scale', 'sharpen']) if (o[k] !== undefined) ro[k] = o[k];
      this.renderer.setOverride(Object.keys(ro).length ? ro : null);
      // world / sim overrides
      const rdBase = S.renderDist;
      const rd = Math.max(5, rdBase - (o.rd || 0));
      if (w && w.renderDist !== rd) w.renderDist = rd;
      if (w) w.meshBudget = o.mesh || 6;
      this.folkDist = Math.min(this.folkBase || 100, o.folkDist || 100);
      this.simSlow = !!o.sim || !!this.slowBase;
      const hz = this.horizon;
      if (hz) {
        if (o.hz) { if (aq.hzBase < 0) { aq.hzBase = hz.level; if (hz.level > 1) hz.setLevel(hz.level - 1); } }
        else if (aq.hzBase >= 0) { hz.setLevel(aq.hzBase); aq.hzBase = -1; }
      }
      aq.over = o;
    }
    farFor(w, extra) { const hf = this.horizon ? this.horizon.farPlane() : 0; return Math.max(w.renderDist * 16 + (extra || 200), hf); }
    envFor(pos, dt, extra) {
      const w = this.world;
      const b = w ? VR.BIOMES[w.biomeAt(Math.floor(pos[0]), Math.floor(pos[2]))] : null;
      const eye = w ? w.getLight(Math.floor(pos[0]), Math.floor(pos[1]), Math.floor(pos[2])) : 0xf000;
      const hz = this.horizon && this.horizon.enabled() ? this.horizon.radius : 0;
      return this.env.update(dt, Object.assign({ dim: this.dim || 'overworld', biome: b, eyeSky: (eye >>> 12) / 15, renderDist: w ? w.renderDist : 8, horizon: hz, lowK: this.ambience ? this.ambience.lowK : 0, wetOn: !!this.settings.wetGround, freezeTime: this.zenFreezeTime, freezeWeather: this.zenFreezeWeather }, extra || {}));
    }
    titleFrame(dt) {
      const c = this.titleCam, w = this.world;
      if (!w) return;
      c.yaw += dt * 0.035;
      if (this.titleBase) {
        const r = 6;
        c.x = this.titleBase[0] + Math.sin(this.time * 0.02) * r; c.z = this.titleBase[2] + Math.cos(this.time * 0.02) * r;
      }
      this.time += dt;
      this.env.ticks += dt * 12; // slow time-lapse for the panorama
      w.update(c.x, c.y, c.z, performance.now());
      const E = this.envFor([c.x, c.y, c.z], dt, { freezeTime: true });
      this.particles.update(dt, [c.x, c.y, c.z]);
      if (this.traffic && this.pool) this.traffic.update(dt);
      if (this.trails) this.trails.update(dt);
      const tr = this.traffic;
      if (this.horizon) this.horizon.update(c);
      this.renderer.render({ cam: Object.assign({ far: this.farFor(w) }, c), world: w, env: E, horizon: this.horizon, particles: this.particles, drawOpaque: tr ? (r, E2) => tr.draw(r, E2, 'opaque') : null, drawTranslucent: tr ? (r, E2) => { tr.draw(r, E2, 'trans'); if (this.trails) this.trails.draw(r, E2); } : null });
    }
    loadingFrame(dt) {
      const p = this.player, w = this.world;
      w.update(p.pos[0], p.pos[1], p.pos[2], performance.now());
      // progress: columns within radius 3 loaded + meshed near player
      const pcx = Math.floor(p.pos[0]) >> 4, pcz = Math.floor(p.pos[2]) >> 4;
      let need = 0, have = 0;
      const R0 = 2;
      for (let dz = -R0; dz <= R0; dz++) for (let dx = -R0; dx <= R0; dx++) {
        need += 2;
        const c = w.col(pcx + dx, pcz + dz);
        if (c) { have++; let meshed = true; for (const s of c.sec) if (s.dirty || s.pending) { meshed = false; break; } if (meshed) have++; }
      }
      // … and the coarse far-horizon ring (the whole radius in big tiles) so the world is complete to the horizon on the first frame
      const hz = this.horizon && this.horizon.enabled() ? this.horizon : null;
      const coarse = hz ? (hz.stats.coarse === undefined ? 0 : hz.stats.coarse) : 1;
      const near = have / need, frac = near * 0.8 + coarse * 0.2;
      if (near >= 1 && !this.nearReadyAt) this.nearReadyAt = performance.now();
      this.ui.loading(near < 0.5 ? 'Generating terrain…' : near < 1 ? 'Building meshes…' : 'Preloading the horizon…', 0.05 + frac * 0.95);
      const E = this.envFor(p.eyePos(), dt);
      const lcam = { x: p.pos[0], y: p.pos[1] + p.eye, z: p.pos[2], yaw: p.yaw, pitch: p.pitch, fov: this.settings.fov * Math.PI / 180, far: this.farFor(w) };
      if (this.horizon) this.horizon.update(lcam);
      this.renderer.render({ cam: lcam, world: w, env: E, horizon: this.horizon });
      // the coarse horizon is worth a few seconds of waiting, not more (slow machines fill it in while playing)
      if (frac >= 1 || (near >= 1 && performance.now() - this.nearReadyAt > 6000) || performance.now() - this.loadStart > 25000) {
        this.nearReadyAt = 0;
        // settle the player on the ground if spawn height was approximate
        if (!this.meta.player && !this.meta.guest) { let y = Math.floor(p.pos[1]); while (y < 250 && VR.PHYS.overlaps((x, yy, z) => w.getBlock(x, yy, z), p.pos[0] - 0.3, y, p.pos[2] - 0.3, p.pos[0] + 0.3, y + 1.8, p.pos[2] + 0.3)) y++; p.pos[1] = y; p.spawn = p.pos.slice(); }
        if (!this.meta.guest && !Array.isArray(this.meta.worldSpawn)) this.meta.worldSpawn = (this.meta.player && Array.isArray(this.meta.player.spawn) && !this.meta.player.spawnBed ? this.meta.player.spawn : p.spawn).slice(0, 3);
        this.state = 'play';
        if (this.mp && !this.meta.guest) this.mp.startHosting();
        this.ui.show(null);
        this.input.captured = true;
        this.ui.updateHUD(true);
        if (this.meta.guest) this.ui.chatLine(`You joined ${this.mp ? this.mp.hostName : 'your friend'}'s world! Esc → Multiplayer to teleport to them · T to chat`, '#9affd8');
        else this.ui.chatLine(`Welcome to ${this.meta.name}. Click the view to look around · E inventory · Esc menu`, '#9ad8ff');
        if (this.player.mode === 'zen') this.ui.chatLine('Zen Builder: no mobs, no damage, no hunger. Freeze time & weather in the Esc menu.', '#b8ffcf');
        this.autosaveAt = performance.now() + 60000;
      }
    }
    playFrame(dt) {
      const g = this, p = this.player, w = this.world, input = this.input;
      this.time += dt;
      this.handleKeys();
      const gad = this.gadgets, driving = gad && gad.controlling;
      if (this.entities && !this.ui.blocking && !driving) this.entities.playerAttack();
      if (driving) gad.drive(dt, input, this.ui.blocking);
      else if (this.director && this.director.active) { /* the director moves the player */ }
      else if (!this.ui.blocking || this.ui.screen === null) {
        // ✨ arrived in front of something new: the flight starts a moment later (the Studio's blocks are built by then)
        if (this.revealPending && !p.hold && !this.studioOpen && !this.ui.screen && (this.revealWait = (this.revealWait || 0) + dt) > 0.4) { this.revealWait = 0; this.reveal(); }
        else { if (gad) gad.preUpdate(dt, input, p); p.update(dt, input); }
      }
      if (this.sim && !(this.mp && this.mp.isClient)) this.sim.update(dt);
      if (this.entities) this.entities.update(dt);
      if (this.villages) this.villages.update(dt);
      if (gad) gad.tick(dt);
      if (this.starships) this.starships.update(dt);
      if (this.traffic) this.traffic.update(dt);
      if (this.director) this.director.update(dt);
      if (this.trams) this.trams.update(dt);
      if (this.tickFurnaces) this.tickFurnaces(dt);
      w.update(p.pos[0], p.pos[1], p.pos[2], performance.now());
      const eye = p.eyePos();
      const headState = w.getBlock(Math.floor(eye[0]), Math.floor(eye[1]), Math.floor(eye[2]));
      const underwater = !!(R.T.flags[headState] & F.WATER) || p.aetherAt(headState);
      let waterColor = null;
      if (underwater) { const c = w.col(Math.floor(eye[0]) >> 4, Math.floor(eye[2]) >> 4); if (c) { const v = c.water[((Math.floor(eye[2]) & 15) << 4) | (Math.floor(eye[0]) & 15)]; waterColor = [((v >> 11) & 31) / 31 * 0.5, ((v >> 5) & 63) / 63 * 0.6, (v & 31) / 31 * 0.7]; } }
      const inLava = !!(R.T.flags[headState] & F.LAVA);
      const E = this.envFor(eye, dt, { underwater: underwater || inLava, waterColor: inLava ? [0.9, 0.3, 0.05] : waterColor, freezeTime: this.zenFreezeTime && p.mode !== 'survival', freezeWeather: this.zenFreezeWeather && p.mode !== 'survival' });
      this.skyBright = Math.max(0.12, Math.min(1, E.ambSky[1] * 1.6));
      this.particles.update(dt, eye);
      if (this.trails) this.trails.update(dt);
      // camera
      const S = this.settings;
      const bob = S.viewBob && !p.flying ? p.bobAmt : 0;
      const bx = Math.sin(p.bob * 2) * 0.035 * bob, by = Math.abs(Math.cos(p.bob * 2)) * 0.05 * bob;
      let cam = { x: eye[0] + Math.cos(p.yaw) * bx, y: eye[1] + by + (p.stepSmooth || 0), z: eye[2] - Math.sin(p.yaw) * bx, yaw: p.yaw, pitch: p.pitch, roll: bob * Math.sin(p.bob * 2) * 0.004, fov: (S.fov * (1 + p.fovKick)) * Math.PI / 180 * (this.zoom ? 0.3 : 1), far: this.farFor(w, 220) };
      if (this.vehicleCam) { const vc = this.vehicleCam(cam); if (vc) cam = vc; }
      if (this.director && this.director.active) { const dc = this.director.cam(cam); if (dc) cam = dc; }
      if (!cam.fixed && (this.camMode === 1 || this.camMode === 2)) {
        const d = this.camMode === 1 ? 4 : -4, dir = p.lookDir();
        const ray = VR.PHYS.raycast((x, y, z) => w.getBlock(x, y, z), eye[0], eye[1], eye[2], -dir[0] * Math.sign(d), -dir[1] * Math.sign(d), -dir[2] * Math.sign(d), Math.abs(d));
        const dist = ray ? Math.max(0.5, ray.dist - 0.3) : Math.abs(d);
        cam.x = eye[0] - dir[0] * dist * Math.sign(d); cam.y = eye[1] - dir[1] * dist * Math.sign(d); cam.z = eye[2] - dir[2] * dist * Math.sign(d);
        if (this.camMode === 2) { cam.yaw += Math.PI; cam.pitch = -cam.pitch; }
      }
      this.cam = cam;
      // selection / crack
      const t = p.target;
      const outline = t && !this.hideHud ? { x: t.x, y: t.y, z: t.z, boxes: t.boxes || VR.PHYS.selection(t.state) } : null;
      const crack = p.breaking && t ? { x: t.x, y: t.y, z: t.z, boxes: t.boxes || VR.PHYS.selection(t.state), layer: R.texIndex['destroy#' + Math.min(9, Math.floor(p.breaking.p * 10))] } : null;
      // precipitation (heights around camera)
      let precip = null;
      if ((E.rain > 0.01 || E.snow > 0.01) && (this.dim === 'overworld' || this.dim === 'drift')) {
        // height field for rain occlusion: refreshed when the camera moved a few blocks or every ~20 frames
        if (!this.hmap) { this.hmap = new Uint8Array(128 * 128); this.hmapAt = null; }
        let dirty = false;
        const hx = Math.floor(cam.x) - 64, hz = Math.floor(cam.z) - 64;
        if (!this.hmapAt || Math.abs(this.hmapAt[0] - hx) > 6 || Math.abs(this.hmapAt[1] - hz) > 6 || this.frame % 20 === 0) {
          for (let z = 0; z < 128; z++) for (let x = 0; x < 128; x++) this.hmap[z * 128 + x] = w.topAt(hx + x, hz + z);
          this.hmapAt = [hx, hz]; dirty = true;
        }
        const b = VR.BIOMES[w.biomeAt(Math.floor(cam.x), Math.floor(cam.z))];
        // snow where the weather says snow, and where it is cold enough for rain to fall as snow
        const coldHere = b && (b.precip === 'snow' || (b.temp - Math.max(0, cam.y - 90) * 0.0025) < 0.15);
        const dry = b && b.precip === 'none';
        const snow = E.snow > E.rain || (coldHere && E.rain > 0.01);
        // the particle budget follows the Particles setting: Very Low draws about a third of the drops
        precip = { amount: dry ? 0 : Math.max(E.rain, E.snow), snow, budget: [0.3, 0.6, 1][S.particles | 0] || 1, heights: this.hmap, hx: this.hmapAt[0], hz: this.hmapAt[1], hox: this.hmapAt[0], hoz: this.hmapAt[1], dirty };
      }
      this.damageFlash = Math.max(0, this.damageFlash - dt * 2.5);
      // R9 Smart Quality: keeps the picture sharp when the frame rate drops
      this.smartQuality(dt, S, w);
      if (this.horizon) this.horizon.update(cam);
      this.renderer.render({
        cam, world: w, env: E, horizon: this.horizon, underwater: underwater || inLava, particles: this.particles, outline, crack, precip,
        damage: this.damageFlash * 0.8 + (p.mode === 'survival' && p.health <= 4 ? 0.25 + Math.sin(this.time * 4) * 0.1 : 0),
        photo: this.photo,
        outlines: gad && !this.hideHud ? gad.outlines() : null,
        drawOpaque: (r, E2) => { if (this.entities) this.entities.draw(r, E2, cam); if (this.villages) this.villages.draw(r, E2, cam); if (this.mp) this.mp.draw(r, E2, cam); if (this.gadgets) this.gadgets.drawShip(r, E2, 'opaque'); if (this.starships) this.starships.draw(r, E2, 'opaque'); if (this.traffic) this.traffic.draw(r, E2, 'opaque'); },
        drawTranslucent: (r, E2) => { if (this.entities && this.entities.drawTranslucent) this.entities.drawTranslucent(r, E2, cam); if (this.gadgets) this.gadgets.drawShip(r, E2, 'trans'); if (this.starships) this.starships.draw(r, E2, 'trans'); if (this.traffic) this.traffic.draw(r, E2, 'trans'); if (this.trails) this.trails.draw(r, E2); },
        drawHand: this.camMode === 0 && !this.hideHud && this.entities && this.entities.drawHand ? (r, E2) => this.entities.drawHand(r, E2, cam) : null,
      });
      if (this.cockpit) this.cockpit.updateHud(dt);
      // audio
      // ambience (ambience.js): the wind, the rain and thunder, the birds, crickets and water of this place
      if (this.ambience) this.ambience.update(dt, { w, eye, E, biome: VR.BIOMES[w.biomeAt(Math.floor(eye[0]), Math.floor(eye[2]))], speed: p.flying ? Math.hypot(p.vel[0], p.vel[2]) : 0, underwater: underwater || inLava });
      const skyAtEye = (w.getLight(Math.floor(eye[0]), Math.floor(eye[1]), Math.floor(eye[2])) >>> 12);
      this.audio.updateMusic(dt, { night: E.night, cave: skyAtEye < 4 && eye[1] < 60, danger: this.raidActive, space: this.dim === 'drift' || cam.y > 180, festival: !!(this.villages && this.villages.festivalNear && this.villages.festivalNear()), enabled: true });
      // HUD
      this.ui.updateHUD();
      if (this.debugOn) this.ui.debug(this.debugText(cam, E));
      if (S.showFps) this.ui.fps(Math.round(this.fps || 0) + ' fps');
      if (this.codex && this.codex.update) this.codex.update(dt);
      if (this.map) this.map.update(dt);
      if (performance.now() > this.autosaveAt) { this.autosaveAt = performance.now() + 60000; this.saveMeta(); this.world.saveAll(); }
    }
    debugText(cam, E) {
      const p = this.player, w = this.world, r = this.renderer;
      const x = Math.floor(p.pos[0]), y = Math.floor(p.pos[1]), z = Math.floor(p.pos[2]);
      const b = VR.BIOMES[w.biomeAt(x, z)];
      const l = w.getLight(x, y, z);
      const t = p.target, ts = t ? R.types[R.T.type[t.state]] : null;
      const aq = this.aq || {};
      return `R9-SI  ${Math.round(this.fps || 0)} fps  scale ${Math.round(r.q.scale * 100)}%  js ${(this.jsMs || 0).toFixed(1)} ms${r.gpuMs !== undefined ? '  gpu ' + r.gpuMs.toFixed(1) + ' ms' : ''}  smart ${aq.stack ? 'G' + aq.g + ' C' + aq.c + (aq.gpuBound ? ' gpu-bound' : aq.cpuBound ? ' cpu-bound' : '') : 'off'}\n` +
        `XYZ ${p.pos[0].toFixed(2)} / ${p.pos[1].toFixed(2)} / ${p.pos[2].toFixed(2)}\nChunk ${x >> 4} ${z >> 4}  Facing ${['N', 'E', 'S', 'W'][VR.Place.playerFacing(p.yaw)]}\n` +
        `Biome ${b ? b.name : '?'}  Light sky ${l >>> 12} rgb ${(l >> 8) & 15},${(l >> 4) & 15},${l & 15}\n` +
        `Time ${Math.floor(this.env.timeOfDay)} day ${this.env.day}  rain ${E.rain.toFixed(2)}  snow ${E.snow.toFixed(2)}  wind ${E.wind.toFixed(1)}\n` +
        `Weather ${this.env.wx.info()}  fog ${this.env.wx.v.fog.toFixed(2)}  bolts ${this.env.wx.strikes}  slot ends in ${Math.max(0, Math.round((this.env.wx.slotEnd - this.env.wx.ticks) / 1200))} min` + (this.ambience ? `\nAmbience ${this.ambience.info()}` : '') + '\n' +
        `Sections ${r.stats.sections} draws ${r.stats.draws} tris ${(r.stats.tris / 1000).toFixed(0)}k  GPU ${r.gpuMemoryMB().toFixed(0)} MB\n` +
        `Columns ${w.cols.size} pending ${w.pending.size} jobs ${this.pool.busy}` + (this.horizon && this.horizon.enabled() ? `  Horizon ${this.horizon.stats.tiles} tiles ${this.horizon.stats.drawn} drawn ${(this.horizon.stats.tris / 1000).toFixed(0)}k tris ${this.horizon.stats.mb.toFixed(0)} MB` : '') + '\n' +
        (ts ? `Target ${ts.name} ${JSON.stringify(ts.decode(t.state))}` : '');
    }
    handleKeys() {
      const i = this.input, ui = this.ui;
      if (ui.typing) return;
      if (i.hit('Escape')) {
        if (this.director && this.director.active) { this.director.stop(); return; }
        if (this.photo) { this.photoMode(false); return; }
        if (ui.screen === 'inventory') ui.closeInventory();
        else if (ui.screen === 'pause') ui.resume();
        else if (ui.screen === 'settings' || ui.screen === 'codex') ui.show('pause');
        else if (ui.screen === 'mapscreen' || ui.screen === 'shipyard') ui.resume();
        else if (ui.screen === 'talk') { if (this.villages) this.villages.closeTalk(); else ui.resume(); }
        else if (!ui.screen) ui.pause();
        return;
      }
      if (i.hit('KeyE') && this.player && !this.player.dead) { if (ui.screen === 'inventory') ui.closeInventory(); else if (!ui.screen) ui.openInventory(); return; }
      if (i.hit('KeyM') && this.map) { if (ui.screen === 'mapscreen') { ui.resume(); return; } if (!ui.screen) { this.map.openBig(); return; } }
      // F over an item in the inventory: ★ favourite (shared with the R9 Studio)
      if (ui.screen === 'inventory' && i.hit('KeyF') && ui.hoverId && ui.toggleFav) { ui.toggleFav(ui.hoverId); return; }
      if (ui.screen) return;
      if (i.hit('KeyN') && this.gadgets && !this.gadgets.controlling) { const p = this.player; this.gadgets.addWaypoint(Math.floor(p.pos[0]), Math.floor(p.pos[1]), Math.floor(p.pos[2])); }
      if (i.hit('KeyT') || i.hit('Enter')) { ui.openChat(''); return; }
      if (i.hit('Slash')) { ui.openChat('/'); return; }
      if (i.hit('F1')) { this.hideHud = !this.hideHud; document.getElementById('hud').style.visibility = this.hideHud ? 'hidden' : 'visible'; }
      if (i.hit('F2')) this.screenshot();
      if (i.hit('F3')) { this.debugOn = !this.debugOn; if (!this.debugOn) ui.debug(null); }
      if (i.hit('F5')) this.camMode = (this.camMode + 1) % 3;
      if (i.hit('KeyP')) this.photoMode(true);
      if (i.hit('KeyQ') && this.player.inv.held) this.dropHeld(i.down('ControlLeft'));
      this.zoom = i.down('KeyC') && this.player.inv.held && this.player.inv.held.id === 'spyglass';
    }
    screenshot() {
      // grab the next rendered frame; show it in an overlay (downloads are blocked inside embedded viewers)
      this.shotPending = true;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        this.shotPending = false;
        let url = null;
        try { url = this.canvas.toDataURL('image/png'); } catch (e) { url = null; }
        if (!url) { this.ui.chatLine('Screenshot not available here.', '#ff8a8a'); return; }
        this.ui.showShot(url);
        this.audio.play('click');
        if (this.codex && this.codex.event) this.codex.event('shot');
        /*DL*/let embedded = true; try { embedded = window.self !== window.top; } catch (e) { embedded = true; }
        if (!embedded) { try { const a = document.createElement('a'); a.href = url; a.download = 'r9si-' + Date.now() + '.png'; a.click(); } catch (e) { /* overlay only */ } }/*/DL*/
      }));
    }
    photoMode(on) {
      if (on) { this.photo = { vignette: 0.35, saturation: 1.18 }; document.getElementById('app').classList.add('photo-hide'); this.ui.show(null); this.input.captured = true; this.ui.hint('Photo mode — F2 to capture · Esc to exit', 3500); }
      else { this.photo = null; document.getElementById('app').classList.remove('photo-hide'); }
    }
    dropHeld(all) {
      const p = this.player, h = p.inv.held; if (!h) return;
      const n = all ? h.n : 1;
      if (this.dropStack) this.dropStack({ id: h.id, n, dmg: h.dmg }, true);
      if (!p.creative || true) { h.n -= n; if (h.n <= 0) p.inv.slots[p.inv.sel] = null; p.inv.changed = true; }
    }

    // ---------------------------------------------------------------- creative palette
    creativeItems(tab, search) {
      if (!this._cat) {
        const cats = {};
        const push = (c, id) => { (cats[c] || (cats[c] = [])).push(id); };
        for (const t of R.types) {
          if (!t.cat || t.o.noItem) continue;
          let c = t.cat;
          if (t.group && /Starforge|Realm/.test(t.group)) c = t.group.indexOf('Starforge') >= 0 ? 'tech' : c;
          if (c === 'creative') c = 'func';
          push(c, t.name);
        }
        for (const it of VR.ITEM_LIST) push(it.cat === 'tech' ? 'tech' : it.cat, it.id);
        this._cat = cats;
      }
      // ★ the favourites from here and from the R9 Studio (only what exists as an item)
      if (tab === 'fav') return VR.Favs ? VR.Favs.list().filter(id => (R.byName[id] && !R.byName[id].o.noItem && R.byName[id].cat) || (VR.ITEMS && VR.ITEMS[id])) : [];
      if (tab === 'search') {
        const q = (search || '').toLowerCase().trim();
        const all = [];
        for (const c in this._cat) for (const id of this._cat[c]) { if (!q || id.indexOf(q.replace(/ /g, '_')) >= 0 || VR.itemName(id).toLowerCase().indexOf(q) >= 0) all.push(id); }
        return all.slice(0, 600);
      }
      return this._cat[tab] || [];
    }
    craftResult(grid, n) { return VR.Crafting ? VR.Crafting.match(grid, n) : null; }
    consumeCraft(grid, n) { const r = this.craftResult(grid, n); if (VR.Crafting) VR.Crafting.consume(grid, n); if (r && this.codex && this.codex.onCraft) this.codex.onCraft(r.id); }

    // ---------------------------------------------------------------- interactions
    interactBlock(x, y, z, s, p) {
      const w = this.world, t = R.types[R.T.type[s]];
      if (!t) return false;
      const k = t.o.kind;
      if (k === 'door' || k === 'trapdoor' || k === 'gate') {
        if (t.o.ironDoor) return false;
        const ns = t.with(s, 'open', t.get(s, 'open') ? 0 : 1);
        w.setBlock(x, y, z, ns, 4);
        if (k === 'door') { const oy = t.get(s, 'half') ? -1 : 1; const o2 = w.getBlock(x, y + oy, z); if (R.T.type[o2] === t.id) w.setBlock(x, y + oy, z, t.with(o2, 'open', t.get(ns, 'open')), 4); }
        this.audio.play('door');
        if (this.sim) this.sim.onBlockChanged(x, y, z, s, ns);
        return true;
      }
      if (k === 'lever') { const ns = t.with(s, 'powered', t.get(s, 'powered') ? 0 : 1); w.setBlock(x, y, z, ns, 4); this.audio.play('click'); return true; }
      if (k === 'button') { if (t.get(s, 'powered')) return true; w.setBlock(x, y, z, t.with(s, 'powered', 1), 4); this.audio.play('click'); if (this.sim) this.sim.schedule(x, y, z, t.o.pulse || 20, 'unpress'); return true; }
      // Modern Living (voxmodern.js): a lamp switches on / off — every part of the model at once; a cupboard opens one
      // container for the whole model, kept at its anchor part
      if ((t.o.toggle || t.o.ui === 'chest') && t.o.vxModel && t.has('part') && VR.VM && VR.VM.MODELS[t.name]) {
        const cells = VR.VM.partCells(VR.VM.MODELS[t.name], t.get(s, 'facing'), t.get(s, 'part'), x, y, z);
        if (t.o.toggle && t.has('lit')) {
          const lit = t.get(s, 'lit') ? 0 : 1;
          const facing = t.get(s, 'facing');
          cells.forEach(([bx, by, bz], i) => { const bs = w.getBlock(bx, by, bz); if (R.T.type[bs] === t.id && t.get(bs, 'facing') === facing && t.get(bs, 'part') === i) w.setBlock(bx, by, bz, t.with(bs, 'lit', lit), 4); });
          this.audio.play('click');
          return true;
        }
        if (t.o.ui === 'chest' && this.openContainer) { this.openContainer(cells[0][0], cells[0][1], cells[0][2], t); return true; }
      }
      if (this.sim && this.sim.interact && this.sim.interact(x, y, z, s, t, p)) return true;
      if (t.o.ui === 'craft' || t.name === 'crafting_table') { this.ui.openInventory('craft'); return true; }
      return false;
    }
    useItem(def, stack, t, p) {
      if (this.gadgets && this.gadgets.use && this.gadgets.use(def, stack, t, p)) return true;
      if (def.use === 'bucket' && t) {
        const w = this.world;
        if (def.fluid) {
          let x = t.x, y = t.y, z = t.z;
          if (!(R.T.flags[t.state] & F.REPLACE)) { x += VR.DX[t.face]; y += VR.DY[t.face]; z += VR.DZ[t.face]; }
          const fl = R.byName[def.fluid]; if (!fl) return false;
          w.setBlock(x, y, z, fl.defaultState, 4);
          this.audio.play('splash');
          if (!p.creative) { stack.id = 'bucket'; p.inv.changed = true; }
          return true;
        }
        return false;
      }
      return false;
    }
    dropsFor(x, y, z, s, hdef) {
      const t = R.types[R.T.type[s]];
      if (!t || t.o.dropsNothing) return;
      const d = t.o.drops;
      let id = t.name, n = 1;
      if (d === 'seeds_chance') { if (Math.random() < 0.125) { id = 'wheat_seeds'; } else return; }
      else if (typeof d === 'string') id = d;
      else if (Array.isArray(d)) { id = d[0]; n = d[1] + Math.floor(Math.random() * ((d[2] || d[1]) - d[1] + 1)); }
      if (R.T.flags[s] & F.LEAVES) { if (!(hdef && hdef.tool === 'shears')) { if (Math.random() < 0.05) { id = /cherry|azalea|mangrove|jungle|spruce|birch|acacia|dark_oak|pale|poplar/.test(t.name) ? 'stick' : 'apple'; } else return; } }
      if (t.o.kind === 'slab' && t.get(s, 'type') === 2) n = 2;
      if (!VR.itemDef(id)) return;
      if (this.dropStack) this.dropStack({ id, n }, false, [x + 0.5, y + 0.5, z + 0.5]);
      else this.player.inv.add(id, n);
    }
    breakMulti(x, y, z, s) {
      const w = this.world, t = R.types[R.T.type[s]];
      if (t.o.kind === 'door' || t.o.tall) { const oy = t.get(s, 'half') ? -1 : 1; if (R.T.type[w.getBlock(x, y + oy, z)] === t.id) w.setBlock(x, y + oy, z, 0, 4); }
      if ((t.o.kind === 'model' || t.o.vxModel) && VR.VM && VR.VM.MODELS[t.name]) {
        // a VX16 model: find its anchor from the broken part's offset, then clear every part
        const f = t.get(s, 'facing'), pi = t.get(s, 'part'), m = VR.VM.MODELS[t.name], fp = VR.VM.footprint(m, f);
        const me = fp.find(o => o[3] === pi) || [0, 0, 0, 0];
        const ax = x - me[0], ay = y - me[1], az = z - me[2];
        for (const [dx, dy, dz] of fp) { const bx = ax + dx, by = ay + dy, bz = az + dz; if (bx === x && by === y && bz === z) continue; if (R.T.type[w.getBlock(bx, by, bz)] === t.id) w.setBlock(bx, by, bz, 0, 4); }
      }
      if (t.o.kind === 'bed') { const f = t.get(s, 'facing'), head = t.get(s, 'part'); const d = head ? -1 : 1; const ox = x + VR.HF_DX[f] * d, oz = z + VR.HF_DZ[f] * d; if (R.T.type[w.getBlock(ox, y, oz)] === t.id) w.setBlock(ox, y, oz, 0, 4); }
    }

    // ---------------------------------------------------------------- chat & commands
    // /wetter <klar|bewölkt|nebel|regen|gewitter|schnee|auto>: the sky now, or auto = the world's own schedule again
    wetterCommand(a) {
      const say = (m, c) => this.ui.chatLine(m, c || '#cfe6ff'), wx = this.env.wx;
      if (this.mp && this.mp.isClient) { say('Das Wetter bestimmt der Gastgeber.', '#ffcf8a'); return; }
      const word = (a || []).join(' ').trim();
      if (!word) { say('Wetter: ' + wx.info() + ' · /wetter klar|bewölkt|nebel|regen|gewitter|schnee|auto'); return; }
      const kind = VR.WX.parse(word);
      if (kind === null) { say('Das Wetter kenne ich nicht. Nimm: klar · bewölkt · nebel · regen · gewitter · schnee · auto', '#ff8a8a'); return; }
      if (kind === 'auto') { wx.force(null); say('Wetter: wie es der Zeitplan der Welt will.'); }
      else { wx.force(kind); say('Wetter: ' + VR.WX.label(kind)); }
    }
    chat(text) {
      if (!text.startsWith('/')) { if (this.mp && this.mp.active) this.mp.chat(text); else this.ui.chatLine('<You> ' + text); return; }
      { // commands everyone may use, cheats or not
        const [c0, ...a0] = text.slice(1).split(/\s+/);
        const say0 = (m, c) => this.ui.chatLine(m, c || '#cfe6ff');
        if (c0 === 'home') { this.goHome(); return; }
        if (c0 === 'look') { this.lookCommand(a0[0]); return; }
        if (c0 === 'spawn') { const ws = this.worldSpawn(); this.player.safeTeleport(ws[0], ws[1], ws[2]); say0('To the world spawn.'); return; }
        if (c0 === 'help' && this.meta && !this.meta.cheats && this.player.mode === 'survival') { say0('Home & friends: /home · /sethome · /spawn · /players · /tphost (guest) · /call <name> (host)'); return; }
        if (c0 === 'sethome') { const p = this.player; p.spawn = p.pos.slice(); p.spawnBed = null; say0('Home set here.'); return; }
        if (c0 === 'players' || c0 === 'list') { const L = this.mp && this.mp.active ? this.mp.players() : []; say0(L.length ? 'Here: you, ' + L.map(q => q.name + (q.host ? ' (host)' : '') + ' ' + Math.round(q.dist) + 'm').join(', ') : 'Only you here.'); return; }
        if (c0 === 'tphost' && this.mp && this.mp.isClient) { this.mp.teleportToHost(); return; }
        if (c0 === 'call' && this.mp && this.mp.isHost) { const n = (a0.join(' ') || '').toLowerCase(); const q = this.mp.players().find(x => !n || x.name.toLowerCase().startsWith(n)); if (q) this.mp.summon(q.peer); else say0('No player called ' + n, '#ff8a8a'); return; }
      }
      if (this.meta && !this.meta.cheats && this.player.mode === 'survival') { this.ui.chatLine('Commands are disabled in this world.', '#ff8a8a'); return; }
      const [cmd, ...a] = text.slice(1).split(/\s+/);
      const p = this.player, say = (m, c) => this.ui.chatLine(m, c || '#cfe6ff');
      const TIMES = { day: 1000, noon: 6000, sunset: 12000, dusk: 12500, night: 13000, midnight: 18000, sunrise: 23000, dawn: 23500 };
      switch (cmd) {
        case 'help': say('/time set <day|noon|night|midnight|n> · /wetter <klar|bewölkt|nebel|regen|gewitter|schnee|auto> · /gamemode <survival|creative|zen> · /tp x y z · /give <item> [n] · /locate <biome|outpost|village> · /seed · /spawn · /kill · /fly <speed> · /summon <mob> · /render <chunks> · /freeze'); say('Build: /pos1 /pos2 · /fill <block> · /walls · /hollow · /clear · /replace <a> <b> · /copy /paste /rotate /undo · /sphere <block> <r> · /hsphere · /cyl <block> <r> <h> · /hcyl'); say('Houses: /haus — the villa catalogue as blueprints (/haus <n> puts one in your hand, RMB builds it where you look; ★ = your R9 Studio design)'); say('Fun: /shuttle · /bike · /meteor · /raid · /wp <name> · /wpclear · /land'); say('Villages: /locate village · right-click a villager to talk, trade and help'); say('Home & friends: /home · /sethome · /spawn · /players · /tphost (guest) · /call <name> (host)'); break;
        case 'time': { const v = a[0] === 'set' ? a[1] : a[0]; const n = TIMES[v] !== undefined ? TIMES[v] : parseInt(v, 10); if (!isNaN(n)) { this.env.setTime(n); say('Time set to ' + n); } break; }
        case 'wetter': case 'weather': this.wetterCommand(a); break;
        case 'gamemode': case 'gm': { const m = { s: 'survival', c: 'creative', z: 'zen', 0: 'survival', 1: 'creative', survival: 'survival', creative: 'creative', zen: 'zen' }[a[0]]; if (m) { p.setMode(m); say('Game mode: ' + m); } break; }
        case 'tp': if (a.length >= 3) { const v = a.map((s, i) => s.startsWith('~') ? p.pos[i] + (parseFloat(s.slice(1)) || 0) : parseFloat(s)); if (p.teleport(v[0], v[1], v[2])) say('Teleported.'); else say('/tp x y z — numbers, please (~ for here).', '#ff8a8a'); } break;
        case 'give': { const id = a[0], n = parseInt(a[1] || '1', 10) || 1; if (VR.itemDef(id)) { p.inv.add(id, n); say('Gave ' + n + ' ' + VR.itemName(id)); } else say('Unknown item: ' + id, '#ff8a8a'); break; }
        case 'seed': say('Seed: ' + this.meta.seed); break;
        case 'kill': p.damage(1000, 'void'); break;
        case 'fly': p.flySpeed = Math.max(0.2, Math.min(8, parseFloat(a[0]) || 1)); say('Fly speed ' + p.flySpeed); break;
        case 'trailer': case 'cinema': if (this.director && this.director.play('trailer')) say('Director: rolling the trailer — Esc to stop'); else say('The trailer plays in a Heartland world (worlds made from v0.19 on).'); break;
        case 'render': this.settings.renderDist = Math.max(3, Math.min(24, parseInt(a[0], 10) || 8)); this.applySettings('renderDist'); say('Render distance ' + this.settings.renderDist); break;
        case 'freeze': this.zenFreezeTime = !this.zenFreezeTime; say('Time ' + (this.zenFreezeTime ? 'frozen' : 'flowing')); break;
        case 'locate': this.pool.direct(0, { type: 'locate', dim: this.dim, biome: a[0], x: Math.floor(p.pos[0]), z: Math.floor(p.pos[2]) }, null, (m) => { if (m.pos) say(`${a[0]} at ${m.pos[0]} ${m.pos[1]} ${m.pos[2]} — /tp ${m.pos[0]} ${m.pos[1] + 2} ${m.pos[2]}`); else say('Not found nearby.', '#ff8a8a'); }); break;
        case 'summon': if (this.entities && this.entities.summon) { if (!this.entities.summon(a[0], p.pos[0] + Math.sin(-p.yaw) * 3, p.pos[1], p.pos[2] - Math.cos(p.yaw) * 3)) say('Unknown mob', '#ff8a8a'); } break;
        default: if (this.extraCommand && this.extraCommand(cmd, a)) break; say('Unknown command. Try /help', '#ff8a8a');
      }
    }
  }
  VR.Game = Game;
})(VR);
