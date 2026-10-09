// ============================================================================
// R9 Model Studio v2 — the live catalogue and editor for everything the villa
// builder places: whole catalogue houses (built by the game's villa generator,
// lit and meshed by the game's mesher in a worker, with every furniture and
// facade model inside them listed and clickable), the furniture pack and the
// facade kit (compiled exactly as the game does, rendered with the game's
// material textures), and the model language editor. Everything runs in the
// page; nothing is sent anywhere.
// ============================================================================
(function () {
  'use strict';
  const VM = VR.VM, VX = VR.VX, TX = VR.TX, R = VR.R;
  const $ = (s) => document.querySelector(s), $$ = (s) => Array.from(document.querySelectorAll(s));
  const QU = VX.QU || 32;
  const fmt = (n) => (n || 0).toLocaleString('de-DE');

  // ---------------------------------------------------------------- catalogue tables
  // the catalogue houses (index = PLAN.CATALOGUE order in gen_plan.js)
  const HOUSES = [
    { i: 0, name: 'Villa R9 180', sub: 'Stadtvilla 18×16 · Doppelgarage · Walmdach', fam: 'stadtvilla' },
    { i: 1, name: 'Villa R9 160', sub: 'Stadtvilla 16×15 · Doppelgarage', fam: 'stadtvilla' },
    { i: 2, name: 'Villa R9 140', sub: 'Stadtvilla 14×14 · Doppelgarage', fam: 'stadtvilla' },
    { i: 3, name: 'Villa Belfronte', sub: 'Klassizistisch · Portikus · Ecktürme · Mansarddach', fam: 'belportale' },
    { i: 4, name: 'Beau Lac', sub: 'Am See · Säulenfront · Doppeltreppe · Pool', fam: 'sanssoucis' },
    { i: 5, name: 'Torre Ocra', sub: 'Mediterran · Rundturm · Loggia · Terracotta', fam: 'toscana' },
    { i: 6, name: 'Bungalow R9', sub: 'Eingeschossig · Walmdach · Garage', fam: 'bungalow' },
    { i: 7, name: 'Palais Étoile', sub: 'Palast · Doppeltreppe · Schwimmhalle · Kino', fam: 'palais' },
    { i: 8, name: 'Villa R9 130', sub: 'Stadtvilla 13×13 · Doppelgarage', fam: 'stadtvilla' },
    { i: 9, name: 'Villa R9 130 Carport', sub: 'Stadtvilla 13×13 · Carport', fam: 'stadtvilla' },
    { i: 10, name: 'Villa R9 Compact', sub: 'Stadtvilla 13×13 · ohne Garage', fam: 'stadtvilla' },
    { i: 11, name: 'Villa Nova', sub: VR.I18N && VR.I18N.tx ? VR.I18N.tx('g.bp.nova.sub', null, 'Die Villa aus dem Trailer · Terrassen · Glastreppen · Lichtsockel', 'The villa from the trailer · terraces · glass stairs · light pad') : 'Die Villa aus dem Trailer · Terrassen · Glastreppen · Lichtsockel', fam: 'trailer' },
  ];
  const FAMS = [['all', 'Alle'], ['stadtvilla', 'Stadtvilla'], ['belportale', 'Klassik'], ['sanssoucis', 'See'], ['toscana', 'Turm'], ['bungalow', 'Bungalow'], ['palais', 'Palais'], ['trailer', 'Trailer']];
  const SKIN_COL = { signus: '#f1efe9', grey: '#9ea4ab', sand: '#e2d3b0', mediterran: '#efd9b5', bauhaus: '#2b2f36', klinker: '#f4f1ea', pult: '#e8e4dc', blacklabel: '#1b1d22', classic: '#f0e4c8', lake: '#f6f3ee', toscana: '#d9a35f', glas: '#fbfbf8', glasnacht: '#3a3d42', nova: '#9a9ea3' };
  const SKIN_NAME = { signus: 'Weiß · Anthrazit', grey: 'Grau', sand: 'Sand', mediterran: 'Mediterran', bauhaus: 'Bauhaus · Flachdach', klinker: 'Klinker', pult: 'Pultdach', blacklabel: 'Schwarzkubus', classic: 'Klassik', lake: 'See', toscana: 'Ocker · Terracotta', glas: 'Glashaus · Vollton weiß', glasnacht: 'Glashaus · Anthrazit', nova: 'Nova · Stein, Orange, Türkis' };
  // furniture categories (a model may sit in several)
  const CATS = [
    ['all', 'Alle', null],
    ['seat', 'Sofas & Sessel', /sofa|chaise|armchair/],
    ['table', 'Tische', /coffee_table|side_table|dining_table|console|garden_table|island/],
    ['chair', 'Stühle & Bänke', /dining_chair|stool|office_chair|bench|dining_bench|garden_chair/],
    ['kitchen', 'Küche', /kitchen|island|fridge|washer|range_hood|dishwasher/],
    ['sleep', 'Schlafen', /bed_|bed$|bunk|nightstand|wardrobe|dresser|curtain/],
    ['bath', 'Bad', /bathtub|vanity|toilet|shower|towel|laundry/],
    ['work', 'Arbeit & Medien', /desk|office_chair|lowboard|tv$|bookshelf|wall_shelf/],
    ['light', 'Licht', /lamp|pendant|chandelier/],
    ['deco', 'Deko & Pflanzen', /art_|mirror|sculpture|bar_cart|fireplace|piano|coat_rack|sideboard|toy_box|monstera|olive|planter/],
    ['garden', 'Garten', /lounger|garden_|bbq|planter|parasol|fire_pit|outdoor/],
  ];
  const FCATS = [['all', 'Alle', null], ['win', 'Fenster', /win_/], ['roof', 'Dachrand', /gutter|downpipe/], ['entry', 'Eingang', /lantern|house_sign|letterbox|garage/]];
  const isFacade = (n) => /^vm_(win_|gutter|downpipe|wall_lantern|house_sign|letterbox|garage_door)/.test(n);
  const catsOf = (n) => (isFacade(n) ? FCATS : CATS).filter(c => c[2] && c[2].test(n)).map(c => c[0]);
  const HELP = `Koordinaten: Modell-Einheiten, 16 = ein Block (halbe Einheiten erlaubt — das Raster ist 32 Voxel pro Block).
x quer, y hoch, z nach hinten (Front = −z, facing 0).
def(name, display, { size: [W, H, D] Blöcke, build(b, M) {…}, light: [r,g,b], sound, hard, seat, bed })

Primitive (halboffen: x0 ≤ x < x1):
  b.box(x0,y0,z0, x1,y1,z1, mat)        Quader
  b.rbox(…, r, mat)                     alle Kanten gerundet (Kissen)
  b.pbox(…, r, mat)                     im Grundriss gerundet (Tischplatte)
  b.cushion(…, r, mat, naht)            Kissen mit eingedrückter Naht
  b.cyl('y'|'x'|'z', a, b, r, c0, c1, mat)  Zylinder (Achse, Mittelpunkt, Radius, von, bis)
  b.tube(achse, a, b, r, wand, c0, c1, mat)  Rohr / Lampenschirm
  b.sphere(cx,cy,cz, r, mat)  b.ellipsoid(cx,cy,cz, rx,ry,rz, mat)
  b.lathe(cx, cz, [[y, r], …], mat, wand)   Drehkörper (Vasen, Schirme, konische Beine)
  b.extrude([[a,b],…], 'z'|'x'|'y', c0, c1, mat)   Profil-Extrusion
  b.beam(x0,y0, x1,y1, z0,z1, dicke, mat)  schräger Balken
  b.rod(x0,y0,z0, x1,y1,z1, r, mat)      Stab zwischen zwei Punkten
  b.legs(x0,z0, x1,z1, s, y0,y1, mat)    vier eckige Beine
  b.roundLegs(x0,z0, x1,z1, einzug, r0, r1, y0,y1, mat)  vier konische Rundbeine
  b.cut(…)  b.mirrorX()  b.mirrorZ()  b.repeat(n, dx,dy,dz, fn)

Materialien (M.*) — Farbe + Oberflächen-Textur aus dem Spiel:
  fabric(c) velvet(c) Stoffgewebe · leather(c) Narbenleder · wood(c) Maserung · marble(c) Adern
  metal(c) gebürstet · stone(c) concrete(c) · plant(c) Blattadern
  matte(c) gloss(c) light(c) glass(c) chrome() ohne Textur · fn((x,y,z)=>voxel)
Paletten: FAB.charcoal/cream/taupe/sage/navy/mustard/white/rose/olive · WOOD.walnut/oak/ash/black/smoked · COL.*

Häuser: Architektur → ein Haus wählen. Rechts unter „Bausteine“ steht alles, woraus es gebaut ist —
jedes Möbel- und Fassadenmodell mit Stückzahl (anklicken öffnet es), jeder Blocktyp. Unten links die Etagen:
„Etage 1/2“ schneidet das Haus über dieser Etage auf, damit man die Räume von oben sieht.`;

  // ---------------------------------------------------------------- state
  const S = { mode: 'arch', scene: null, cam: { yaw: 2.42, pitch: 0.42, dist: 0 }, facing: 0, grid: true, flat: false, autorot: false, clipY: 1e9, filter: '', cat: 'all', from: null, houseSel: null, cutLevel: 0, invY: false };
  // dragging moves the view like the hand moves: down = the camera goes down / looks up (⇅ turns it round, remembered per browser)
  try { S.invY = localStorage.getItem('r9si.studio.invY') === '1'; } catch (e) { /* storage blocked */ }
  S.vy = () => (S.invY ? -1 : 1);
  // the mouse speed for turning the view (0.4 … 2, "Maus-Tempo"), remembered like ⇅
  S.sens = 1; try { const v = parseFloat(localStorage.getItem('r9si.studio.sens')); if (v > 0.2 && v < 3) S.sens = v; } catch (e) { /* */ }
  const HOOK = {};             // the Crafter (crafter.js) plugs in here: overlay, pointer, key, list, chips, parts, hud, mode, crumb
  // the standalone Studio (published on its own: its own storage, no game behind it) says so wherever it matters
  const SA = !!window.__R9_STANDALONE;
  // a write the browser's storage refused: one signal for the whole page (space.js shows "⚠ Browser-Speicher voll")
  const full = (what) => { try { window.dispatchEvent(new CustomEvent('r9-storage-full', { detail: { what: what || '' } })); } catch (e) { /* */ } };
  const HOUSE = new Map();      // index → { data, gpu, name, thumb }
  const THUMB = new Map();      // model name → canvas
  const BLOCKS = new Map();     // block name → { gpu, thumb }
  let texInfo = null;           // the game's texture arrays (from the worker)

  // ---------------------------------------------------------------- boot log & status
  const bootLines = [];
  function log(text, done) {
    const el = $('#bootLog');
    if (done !== undefined && bootLines.length) { const last = bootLines[bootLines.length - 1]; last.classList.remove('now'); last.innerHTML = last.dataset.t + ' <b>' + done + '</b>'; return; }
    for (const l of bootLines) l.classList.remove('now');
    const d = document.createElement('div'); d.className = 'now'; d.dataset.t = '> ' + text; d.textContent = '> ' + text; el.appendChild(d); bootLines.push(d);
    while (bootLines.length > 7) { const o = bootLines.shift(); o.remove(); }
  }
  const bar = (f) => { $('#bootBar').style.width = Math.round(f * 100) + '%'; };
  function sys(text, state) { $('#sysText').textContent = text; const d = $('#sysDot'); d.className = 'dot' + (state ? ' ' + state : ''); }

  // ---------------------------------------------------------------- mesh a VM model (all parts, facing f) with the game's mesher
  const LAYERS = ['vx_smooth', 'vx_smooth_gloss', 'vx_glass', 'vx_holo', 'vx_mat_fabric', 'vx_mat_leather', 'vx_mat_wood', 'vx_mat_marble', 'vx_mat_metal', 'vx_mat_plant', 'vx_mat_stone'];
  const MATL = [0, 4, 5, 6, 7, 8, 9, 10];
  const STRIDE = 15;
  function meshModel(model, f) {
    const verts = [], glassVerts = [];
    const fp = VM.footprint(model, f);
    let tri = 0, quads = 0;
    const NRM = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    for (const [dx, dy, dz, i] of fp) {
      VM.paintFull(model, i, f);
      const q = VX.meshGridN(VX.gridFor(model.res), model.res, 0, 0);
      for (let k = 0; k < q.length; k += 27) {
        const d = q[k], col = q[k + 1] & 0xffff, fl = q[k + 2];
        const r = ((col >> 11) & 31) / 31, g = ((col >> 5) & 63) / 63, b = (col & 31) / 31;
        const n = NRM[d];
        const glass = (fl & 2) !== 0, matId = (fl >> 4) & 7;
        const layer = glass ? 2 : matId ? MATL[matId] : (fl & 8) ? 3 : (fl & 4) ? 1 : 0;
        const flags = (fl & 1) | (glass ? 2 : 0) | ((fl & 128) ? 4 : 0);
        const target = glass ? glassVerts : verts;
        const vs = [];
        for (let v = 0; v < 4; v++) { const o = k + 3 + v * 6; vs.push([dx + q[o] / QU, dy + q[o + 1] / QU, dz + q[o + 2] / QU, q[o + 3] / 16, q[o + 4] / 16, q[o + 5]]); }
        for (const idx of [0, 1, 2, 0, 2, 3]) { const p = vs[idx]; target.push(p[0], p[1], p[2], n[0], n[1], n[2], r, g, b, p[3], p[4], 1 - p[5] * 0.18, d, layer, flags); }
        tri += 2; quads++;
      }
    }
    return { verts: new Float32Array(verts), glass: new Float32Array(glassVerts), tri, quads, fp };
  }

  // ---------------------------------------------------------------- WebGL: two pipelines (VM models · game sections), one context
  let gl, progVM, progSec, locVM = {}, locSec = {}, texAlb, texMat, texAlbG, texMatG, texLum = null, fbo = null;
  const VS = `#version 300 es
  layout(location=0) in vec3 p; layout(location=1) in vec3 n; layout(location=2) in vec3 c; layout(location=3) in vec2 uv; layout(location=4) in float ao; layout(location=5) in float face; layout(location=6) in float layer; layout(location=7) in float flags;
  uniform mat4 u_vp; uniform vec3 u_off; out vec3 vN; out vec3 vC; out vec2 vUV; out float vAO; flat out int vFace; flat out float vLayer; flat out int vFlags; out vec3 vP;
  void main() { vec3 w = p + u_off; gl_Position = u_vp * vec4(w, 1.0); vN = n; vC = c; vUV = uv; vAO = ao; vFace = int(face + 0.5); vLayer = layer; vFlags = int(flags + 0.5); vP = w; }`;
  const FS = `#version 300 es
  precision highp float; precision highp sampler2DArray;
  in vec3 vN; in vec3 vC; in vec2 vUV; in float vAO; flat in int vFace; flat in float vLayer; flat in int vFlags; in vec3 vP;
  uniform vec3 u_light; uniform vec3 u_eye; uniform sampler2DArray u_alb; uniform sampler2DArray u_mat; uniform float u_flat; uniform float u_galpha; out vec4 o;
  const vec3 TANG[6] = vec3[6](vec3(0,0,-1), vec3(0,0,1), vec3(1,0,0), vec3(1,0,0), vec3(1,0,0), vec3(-1,0,0));
  const vec3 BITN[6] = vec3[6](vec3(0,-1,0), vec3(0,-1,0), vec3(0,0,1), vec3(0,0,-1), vec3(0,-1,0), vec3(0,-1,0));
  void main() {
    vec2 fu = fract(vUV);
    if ((vFlags & 4) != 0) fu = vec2(fu.y, 1.0 - fu.x);
    vec4 alb = texture(u_alb, vec3(fu, vLayer));
    vec4 mat = texture(u_mat, vec3(fu, vLayer));
    if (u_flat > 0.5) { alb = vec4(1.0, 1.0, 1.0, alb.a); mat = vec4(0.5, 0.5, 0.85, 0.0); }
    bool glass = (vFlags & 2) != 0;
    vec3 base = glass ? vC : alb.rgb * vC;
    vec3 N = normalize(vN);
    vec2 nxy = (mat.rg * 2.0 - 1.0) * 0.9;
    vec3 n = normalize(N * sqrt(max(0.0, 1.0 - dot(nxy, nxy))) + TANG[vFace] * nxy.x + BITN[vFace] * nxy.y);
    float rough = mat.b;
    vec3 L = normalize(u_light), V = normalize(u_eye - vP), H = normalize(L + V);
    float d = max(0.0, dot(n, L));
    float fill = max(0.0, dot(n, normalize(vec3(-0.6, 0.3, -0.5)))) * 0.22;
    float amb = 0.36 + 0.16 * n.y;
    float spec = pow(max(0.0, dot(n, H)), mix(90.0, 6.0, rough)) * mix(0.9, 0.06, rough);
    float fres = pow(1.0 - max(0.0, dot(n, V)), 4.0) * (1.0 - rough) * 0.25;
    vec3 col = base * (amb + d * 0.72 + fill) * vAO + vec3(spec + fres) * (0.6 + 0.4 * vAO);
    if ((vFlags & 1) != 0) col = vC * 1.35 + 0.08;
    o = vec4(col, glass ? u_galpha : 1.0);
  }`;
  // the game's section format: 8 × u16 per vertex (see mesher.js) with the game's texture arrays
  const SVS = `#version 300 es
  layout(location=0) in vec3 a_pos; layout(location=1) in uint a_w3; layout(location=2) in uint a_uvp; layout(location=3) in uint a_w5; layout(location=4) in uint a_light; layout(location=5) in uint a_tint;
  uniform mat4 u_vp; uniform vec3 u_origin; uniform vec3 u_pre; uniform vec2 u_rc; uniform vec3 u_t;
  out vec3 v_p; out vec2 v_uv; flat out uint v_w3; flat out uint v_w5; out float v_sky; out vec3 v_block; out float v_ao; out vec3 v_tint;
  void main() {
    // instances (the World mode's placed houses) are turned in quarter steps about Y and moved: p = rot(local − pre) + t
    vec3 q = u_origin + a_pos / 2048.0 - 4.0 - u_pre;
    vec3 p = vec3(u_rc.x * q.x - u_rc.y * q.z, q.y, u_rc.y * q.x + u_rc.x * q.z) + u_t; v_p = p;
    v_uv = vec2(float(a_uvp & 255u), float(a_uvp >> 8u)) / 16.0; v_w3 = a_w3; v_w5 = a_w5;
    v_sky = float(a_light >> 12u) / 15.0; v_block = vec3(float((a_light >> 8u) & 15u), float((a_light >> 4u) & 15u), float(a_light & 15u)) / 15.0;
    v_ao = float((a_w5 >> 3u) & 3u);
    v_tint = pow(vec3(float((a_tint >> 11u) & 31u) / 31.0, float((a_tint >> 5u) & 63u) / 63.0, float(a_tint & 31u) / 31.0), vec3(2.2));
    gl_Position = u_vp * vec4(p, 1.0);
  }`;
  const SFS = `#version 300 es
  precision highp float; precision highp sampler2DArray;
  ${(VR.Looks && VR.Looks.GLSL) || 'uniform highp sampler2D u_avgLum; bool lookOn(uint w5) { return false; } vec3 lookRecolor(vec3 a, float l, vec3 c) { return a; }'}
  in vec3 v_p; in vec2 v_uv; flat in uint v_w3; flat in uint v_w5; in float v_sky; in vec3 v_block; in float v_ao; in vec3 v_tint;
  uniform sampler2DArray u_alb; uniform sampler2DArray u_mat; uniform vec3 u_light; uniform vec3 u_eye; uniform float u_clipY; uniform float u_cutout; uniform float u_flat; uniform float u_alpha; uniform vec2 u_rc; uniform vec3 u_mul;
  out vec4 o;
  vec3 rY(vec3 v) { return vec3(u_rc.x * v.x - u_rc.y * v.z, v.y, u_rc.y * v.x + u_rc.x * v.z); }
  const vec3 NORMALS[6] = vec3[6](vec3(1,0,0), vec3(-1,0,0), vec3(0,1,0), vec3(0,-1,0), vec3(0,0,1), vec3(0,0,-1));
  const vec3 TANG[6] = vec3[6](vec3(0,0,-1), vec3(0,0,1), vec3(1,0,0), vec3(1,0,0), vec3(1,0,0), vec3(-1,0,0));
  const vec3 BITN[6] = vec3[6](vec3(0,-1,0), vec3(0,-1,0), vec3(0,0,1), vec3(0,0,-1), vec3(0,-1,0), vec3(0,-1,0));
  float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
  void main() {
    if (v_p.y > u_clipY) discard;
    uint face = v_w5 & 7u;
    bool noshade = ((v_w5 >> 11u) & 1u) == 1u, emissiveFace = ((v_w5 >> 12u) & 1u) == 1u;
    float layer = float(v_w3 & 4095u);
    uint rot = (v_w3 >> 12u) & 3u;
    vec2 fu = fract(v_uv);
    if (((v_w5 >> 14u) & 1u) == 1u) {
      // connected glass: one tile per face, the frame mirrored away on the edges that join the same glass
      fu = clamp(v_uv, vec2(0.5 / 32.0), vec2(1.0 - 0.5 / 32.0));
      uint cm = ((v_w5 >> 5u) & 7u) | ((v_w5 >> 12u) & 8u); const float W = 2.0 / 32.0;
      if ((cm & 1u) != 0u && fu.y < W) fu.y = 2.0 * W - fu.y;
      if ((cm & 4u) != 0u && fu.y > 1.0 - W) fu.y = 2.0 * (1.0 - W) - fu.y;
      if ((cm & 8u) != 0u && fu.x < W) fu.x = 2.0 * W - fu.x;
      if ((cm & 2u) != 0u && fu.x > 1.0 - W) fu.x = 2.0 * (1.0 - W) - fu.x;
    }
    if (((v_w3 >> 14u) & 1u) == 1u) rot = (rot + uint(hash13(floor(v_p - rY(NORMALS[face]) * 0.02)) * 4.0)) & 3u;
    if (rot == 1u) fu = vec2(fu.y, 1.0 - fu.x); else if (rot == 2u) fu = vec2(1.0 - fu.x, 1.0 - fu.y); else if (rot == 3u) fu = vec2(1.0 - fu.y, fu.x);
    vec4 alb = texture(u_alb, vec3(fu, layer));
    if (u_cutout > 0.5 && alb.a < 0.5) discard;
    vec4 mat = texture(u_mat, vec3(fu, layer));
    // a recoloured block (B1 „🎨 Aussehen", the game's own formula: src/shared/looks.js)
    if (lookOn(v_w5)) alb.rgb = lookRecolor(alb.rgb, layer, v_tint); else if (u_cutout > 0.5) alb.rgb *= v_tint; else alb.rgb = mix(alb.rgb, alb.rgb * v_tint, alb.a);
    if (u_flat > 0.5) { alb.rgb = vec3(0.75); mat = vec4(0.5, 0.5, 0.85, 0.0); }
    vec3 N = rY(NORMALS[face]);
    if (((v_w5 >> 13u) & 1u) == 1u) { vec3 gn = normalize(cross(dFdx(v_p), dFdy(v_p))); if (gn.y < 0.0) gn = -gn; N = gn; }
    vec2 nxy = (mat.rg * 2.0 - 1.0) * 0.8;
    vec3 n = normalize(N * sqrt(max(0.0, 1.0 - dot(nxy, nxy))) + rY(TANG[face]) * nxy.x + rY(BITN[face]) * nxy.y);
    if (noshade) n = vec3(0.0, 1.0, 0.0);
    float rough = mat.b, emis = mat.a;
    float sky = v_sky, skyL = sky * sky * (3.0 - 2.0 * sky);
    vec3 blockL = pow(v_block, vec3(1.7)) * 1.2;
    float ao = 1.0 - v_ao * 0.2;
    float faceShade = face == 2u ? 1.0 : face == 3u ? 0.55 : (face <= 1u ? 0.8 : 0.9);
    vec3 L = normalize(u_light), V = normalize(u_eye - v_p);
    float ndl = noshade ? 0.65 : max(dot(n, L), 0.0);
    float outdoors = smoothstep(0.45, 0.95, sky);
    vec3 direct = vec3(1.05, 1.0, 0.92) * ndl * outdoors * 0.95;
    vec3 amb = vec3(0.42, 0.46, 0.56) * (0.25 + 0.75 * skyL) * mix(0.62, 1.0, faceShade);
    vec3 lighting = (amb + direct) * ao + blockL * ao + vec3(0.02);
    vec3 col = alb.rgb * lighting;
    if (rough < 0.75 && ndl > 0.0) { vec3 H = normalize(L + V); col += vec3(pow(max(dot(n, H), 0.0), mix(160.0, 12.0, rough)) * (1.0 - rough) * 1.2 * outdoors); }
    if (emis > 0.02 || emissiveFace) col = mix(col, alb.rgb * 1.6, emissiveFace ? max(emis, 0.85) : emis);
    o = vec4(pow(col * u_mul, vec3(1.0 / 2.2)), u_alpha);
  }`;
  function program(vs, fs) {
    const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(x)); return x; };
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }
  let vbo, vboG, gridBuf = null, gridN = 0;
  function initGL() {
    const cv = $('#view');
    gl = cv.getContext('webgl2', { antialias: true, alpha: false, preserveDrawingBuffer: false });
    if (!gl) { sys('WebGL2 nicht verfügbar', 'err'); return false; }
    progVM = program(VS, FS); progSec = program(SVS, SFS);
    for (const u of ['u_vp', 'u_off', 'u_light', 'u_eye', 'u_alb', 'u_mat', 'u_flat', 'u_galpha']) locVM[u] = gl.getUniformLocation(progVM, u);
    gl.useProgram(progVM); gl.uniform1f(locVM.u_galpha, 0.45);
    for (const u of ['u_vp', 'u_origin', 'u_alb', 'u_mat', 'u_light', 'u_eye', 'u_clipY', 'u_cutout', 'u_flat', 'u_alpha', 'u_pre', 'u_rc', 'u_t', 'u_mul', 'u_avgLum']) locSec[u] = gl.getUniformLocation(progSec, u);
    vbo = gl.createBuffer(); vboG = gl.createBuffer();
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
    buildVxTextures();
    return true;
  }
  // the VX material tiles (fabric, leather, wood, …) → two texture arrays for the model pipeline
  function buildVxTextures() {
    const N = TX.N, L = LAYERS.length, alb = new Uint8Array(N * N * 4 * L), mat = new Uint8Array(N * N * 4 * L);
    LAYERS.forEach((nm, l) => { const rec = VR.TEXREC[nm]; if (!rec) return; TX.toArrays(rec(), alb, mat, l * N * N * 4); });
    const mk = (data) => {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
      gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, N, N, L, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
      gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
      return t;
    };
    texAlb = mk(alb); texMat = mk(mat);
  }
  // the game's block textures (from the worker's forge): albedo is sRGB, material = normal.xy / roughness / emissive
  function uploadGameTextures(tex) {
    const mk = (levels, srgb) => {
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
      gl.texStorage3D(gl.TEXTURE_2D_ARRAY, tex.levels, srgb ? gl.SRGB8_ALPHA8 : gl.RGBA8, tex.size, tex.size, tex.layers);
      for (let lv = 0; lv < tex.levels; lv++) { const n = tex.size >> lv; gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, lv, 0, 0, 0, n, n, tex.layers, gl.RGBA, gl.UNSIGNED_BYTE, levels[lv]); }
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
      return t;
    };
    texAlbG = mk(tex.albedo, true); texMatG = mk(tex.material, false);
    texInfo = tex;
    // the average luminance per layer for recoloured blocks (64 × 64 R32F; filled for the layers a look uses: setAvgLum)
    texLum = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texLum);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, 64, 64, 0, gl.RED, gl.FLOAT, new Float32Array(4096).fill(0.5));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    if (VR.LookPanel && VR.LookPanel.texReady) VR.LookPanel.texReady();
  }
  function setAvgLum(table) { if (!gl || !texLum || !table) return; gl.bindTexture(gl.TEXTURE_2D, texLum); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 64, 64, gl.RED, gl.FLOAT, table); }
  function uploadVM(mesh) {
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, mesh.verts, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, vboG); gl.bufferData(gl.ARRAY_BUFFER, mesh.glass, gl.STATIC_DRAW);
  }
  // section meshes (opaque / cutout / trans) of a house or a block → GPU
  function uploadSections(sections) {
    return sections.map(s => {
      const layers = [s.opaque, s.cutout, s.trans].map(d => { if (!d || !d.length) return null; const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, d, gl.STATIC_DRAW); return { b, n: d.length / 8 }; });
      return { ox: s.ox, oy: s.oy, oz: s.oz, layers };
    });
  }
  function freeSections(gpu) { for (const s of gpu) for (const l of s.layers) if (l) gl.deleteBuffer(l.b); }
  const mat = {
    persp: (fov, asp, n, f) => { const t = 1 / Math.tan(fov / 2); return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]; },
    look: (e, c) => { const z = norm([e[0] - c[0], e[1] - c[1], e[2] - c[2]]), x = norm(cross([0, 1, 0], z)), y = cross(z, x); return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1]; },
    mul: (a, b) => { const o = new Array(16).fill(0); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) o[j * 4 + i] += a[k * 4 + i] * b[j * 4 + k]; return o; },
  };
  const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  function buildGrid(size) {
    const L = []; const s = size;
    const line = (x0, z0, x1, z1) => { for (const [x, z] of [[x0, z0], [x1, z1]]) L.push(x, 0, z, 0, 1, 0, 0.24, 0.3, 0.38, 0, 0, 1, 2, 0, 1); };
    for (let i = -s; i <= s; i++) { line(i, -s, i, s); line(-s, i, s, i); }
    gridBuf = gridBuf || gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, gridBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(L), gl.STATIC_DRAW); gridN = L.length / STRIDE;
  }
  function attrsVM() { const S4 = STRIDE * 4; const set = (i, n, o) => { gl.enableVertexAttribArray(i); gl.vertexAttribPointer(i, n, gl.FLOAT, false, S4, o * 4); }; set(0, 3, 0); set(1, 3, 3); set(2, 3, 6); set(3, 2, 9); set(4, 1, 11); set(5, 1, 12); set(6, 1, 13); set(7, 1, 14); }
  function attrsSec() { gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.UNSIGNED_SHORT, false, 16, 0); for (let i = 1; i <= 5; i++) { gl.enableVertexAttribArray(i); gl.vertexAttribIPointer(i, 1, gl.UNSIGNED_SHORT, 16, 4 + i * 2); } }
  // camera for a scene: orbit around its centre
  function camFor(sc, cam, W, H) {
    if (cam.fly) {
      // the Crafter's free camera: a position and a look direction (yaw 0 looks toward −z, pitch up is positive)
      const f = cam.fly, d = [-Math.sin(f.yaw) * Math.cos(f.pitch), Math.sin(f.pitch), -Math.cos(f.yaw) * Math.cos(f.pitch)];
      const eye = f.pos.slice(), tgt = [eye[0] + d[0], eye[1] + d[1], eye[2] + d[2]];
      const wide = sc && sc.type === 'world';
      const fov = f.fov || 0.9;   // the player view takes the game's field of view
      return { eye, vp: mat.mul(mat.persp(fov, W / H, wide ? 0.25 : 0.05, wide ? 1500 : 600), mat.look(eye, tgt)), fov, target: tgt };
    }
    const [cx, cy, cz] = sc.center, span = sc.span;
    const dist = cam.dist || span * (sc.type === 'house' ? 2.35 : 2.4) + 2.2;
    const eye = [cx + Math.cos(cam.pitch) * Math.sin(cam.yaw) * dist, cy + Math.sin(cam.pitch) * dist, cz + Math.cos(cam.pitch) * Math.cos(cam.yaw) * dist];
    const near = sc.type === 'world' ? Math.max(0.3, dist * 0.004) : 0.05;
    return { eye, vp: mat.mul(mat.persp(0.75, W / H, near, Math.max(200, dist * 4)), mat.look(eye, [cx, cy, cz])), fov: 0.75, target: [cx, cy, cz] };
  }
  function drawScene(sc, cam, W, H, opts) {
    gl.viewport(0, 0, W, H);
    // the player view (Crafter → Spieler) has the game's daylight sky; the editor keeps its dark stage
    if (opts.main && cam.fly && cam.fly.player) gl.clearColor(0.56, 0.74, 0.93, 1); else gl.clearColor(0.03, 0.038, 0.052, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (!sc) return;
    const { eye, vp } = camFor(sc, cam, W, H);
    const light = [0.55, 1, 0.4];
    for (let i = 0; i < 8; i++) gl.disableVertexAttribArray(i);
    if (sc.type === 'model' || sc.type === 'vedit') {
      gl.useProgram(progVM); gl.uniformMatrix4fv(locVM.u_vp, false, new Float32Array(vp)); gl.uniform3f(locVM.u_off, 0, 0, 0); gl.uniform3f(locVM.u_light, light[0], light[1], light[2]); gl.uniform3f(locVM.u_eye, eye[0], eye[1], eye[2]);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, texAlb); gl.uniform1i(locVM.u_alb, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D_ARRAY, texMat); gl.uniform1i(locVM.u_mat, 1);
      gl.uniform1f(locVM.u_flat, S.flat ? 1 : 0);
      if (S.grid && !opts.noGrid) { gl.uniform1f(locVM.u_flat, 0); gl.uniform3f(locVM.u_off, sc.center[0], 0, sc.center[2]); gl.bindBuffer(gl.ARRAY_BUFFER, gridBuf); attrsVM(); gl.drawArrays(gl.LINES, 0, gridN); gl.uniform3f(locVM.u_off, 0, 0, 0); gl.uniform1f(locVM.u_flat, S.flat ? 1 : 0); }
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo); attrsVM(); gl.drawArrays(gl.TRIANGLES, 0, sc.mesh.verts.length / STRIDE);
      if (sc.mesh.glass.length) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.bindBuffer(gl.ARRAY_BUFFER, vboG); attrsVM(); gl.drawArrays(gl.TRIANGLES, 0, sc.mesh.glass.length / STRIDE); gl.depthMask(true); gl.disable(gl.BLEND); }
    } else {
      if (!texAlbG) return;
      if (S.grid && !opts.noGrid && !sc.noGrid) {
        gl.useProgram(progVM); gl.uniformMatrix4fv(locVM.u_vp, false, new Float32Array(vp)); gl.uniform3f(locVM.u_light, light[0], light[1], light[2]); gl.uniform3f(locVM.u_eye, eye[0], eye[1], eye[2]); gl.uniform1f(locVM.u_flat, 0);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, texAlb); gl.uniform1i(locVM.u_alb, 0); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D_ARRAY, texMat); gl.uniform1i(locVM.u_mat, 1);
        gl.uniform3f(locVM.u_off, sc.center[0], sc.groundY, sc.center[2]); gl.bindBuffer(gl.ARRAY_BUFFER, gridBuf); attrsVM(); gl.drawArrays(gl.LINES, 0, gridN);
        for (let i = 0; i < 8; i++) gl.disableVertexAttribArray(i);
      }
      gl.useProgram(progSec); gl.uniformMatrix4fv(locSec.u_vp, false, new Float32Array(vp)); gl.uniform3f(locSec.u_light, light[0], light[1], light[2]); gl.uniform3f(locSec.u_eye, eye[0], eye[1], eye[2]);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, texAlbG); gl.uniform1i(locSec.u_alb, 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D_ARRAY, texMatG); gl.uniform1i(locSec.u_mat, 1);
      if (texLum && locSec.u_avgLum) { gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, texLum); gl.uniform1i(locSec.u_avgLum, 2); gl.activeTexture(gl.TEXTURE0); }
      gl.uniform1f(locSec.u_clipY, opts.clipY !== undefined ? opts.clipY : 1e9); gl.uniform1f(locSec.u_flat, S.flat ? 1 : 0); gl.uniform1f(locSec.u_alpha, 1);
      const xf = (pre, rc, t, mul) => { gl.uniform3f(locSec.u_pre, pre[0], pre[1], pre[2]); gl.uniform2f(locSec.u_rc, rc[0], rc[1]); gl.uniform3f(locSec.u_t, t[0], t[1], t[2]); gl.uniform3f(locSec.u_mul, mul[0], mul[1], mul[2]); };
      const ID3 = [0, 0, 0], ID2 = [1, 0], ONE = [1, 1, 1];
      const cull = sc.cull || null;
      const pass = (li, cutout) => {
        gl.uniform1f(locSec.u_cutout, cutout ? 1 : 0); xf(ID3, ID2, ID3, ONE);
        for (const s of sc.gpu) { const l = s.layers[li]; if (!l) continue; if (cull && !cull(s)) continue; gl.uniform3f(locSec.u_origin, s.ox + sc.off[0], s.oy + sc.off[1], s.oz + sc.off[2]); gl.bindBuffer(gl.ARRAY_BUFFER, l.b); attrsSec(); gl.drawArrays(gl.TRIANGLES, 0, l.n); }
        if (sc.instances) for (const ins of sc.instances) { xf(ins.pre, ins.rc, ins.t, ins.mul || ONE); for (const s of ins.gpu) { const l = s.layers[li]; if (!l) continue; gl.uniform3f(locSec.u_origin, s.ox, s.oy, s.oz); gl.bindBuffer(gl.ARRAY_BUFFER, l.b); attrsSec(); gl.drawArrays(gl.TRIANGLES, 0, l.n); } }
        xf(ID3, ID2, ID3, ONE);
      };
      pass(0, false);
      gl.disable(gl.CULL_FACE); pass(1, true); gl.enable(gl.CULL_FACE);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.uniform1f(locSec.u_alpha, 0.55); pass(2, false); gl.depthMask(true); gl.disable(gl.BLEND);
    }
    if (opts.main && HOOK.overlay) HOOK.overlay(sc, eye, vp, W, H);
  }
  // lines in the model pipeline (overlays: selection box, lot outline, height marks): [x0,y0,z0, x1,y1,z1, r,g,b, …]
  let lineBuf = null;
  function drawLines(segs, vp, eye, depth) {
    const n = segs.length / 9; if (!n) return;
    const L = new Float32Array(n * 2 * STRIDE);
    for (let i = 0; i < n; i++) for (let e = 0; e < 2; e++) {
      const o = (i * 2 + e) * STRIDE, k = i * 9;
      L[o] = segs[k + e * 3]; L[o + 1] = segs[k + e * 3 + 1]; L[o + 2] = segs[k + e * 3 + 2]; L[o + 4] = 1;
      L[o + 6] = segs[k + 6]; L[o + 7] = segs[k + 7]; L[o + 8] = segs[k + 8]; L[o + 11] = 1; L[o + 12] = 2; L[o + 14] = 1;
    }
    for (let i = 0; i < 8; i++) gl.disableVertexAttribArray(i);
    gl.useProgram(progVM); gl.uniformMatrix4fv(locVM.u_vp, false, new Float32Array(vp)); gl.uniform3f(locVM.u_off, 0, 0, 0); gl.uniform3f(locVM.u_light, 0.55, 1, 0.4); gl.uniform3f(locVM.u_eye, eye[0], eye[1], eye[2]); gl.uniform1f(locVM.u_flat, 0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, texAlb); gl.uniform1i(locVM.u_alb, 0); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D_ARRAY, texMat); gl.uniform1i(locVM.u_mat, 1);
    lineBuf = lineBuf || gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf); gl.bufferData(gl.ARRAY_BUFFER, L, gl.DYNAMIC_DRAW); attrsVM();
    if (depth === false) gl.disable(gl.DEPTH_TEST);
    gl.drawArrays(gl.LINES, 0, n * 2);
    gl.enable(gl.DEPTH_TEST);
  }
  // overlay quads (the paint preview): q = [x0,y0,z0, x1,y1,z1, x2,y2,z2, x3,y3,z3, r,g,b] per quad, uploaded once
  function quadMesh(q) {
    const n = q.length / 15; if (!n) return null;
    const V = new Float32Array(n * 6 * STRIDE), ord = [0, 1, 2, 0, 2, 3];
    for (let i = 0; i < n; i++) for (let k = 0; k < 6; k++) {
      const o = (i * 6 + k) * STRIDE, c = i * 15, v = c + ord[k] * 3;
      V[o] = q[v]; V[o + 1] = q[v + 1]; V[o + 2] = q[v + 2]; V[o + 4] = 1;
      V[o + 6] = q[c + 12]; V[o + 7] = q[c + 13]; V[o + 8] = q[c + 14]; V[o + 11] = 1; V[o + 12] = 2; V[o + 14] = 3;
    }
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, V, gl.STATIC_DRAW);
    return { buf, n: n * 6 };
  }
  function freeQuadMesh(m) { if (m && m.buf) gl.deleteBuffer(m.buf); }
  function drawQuadMesh(m, vp, eye, alpha, xray) {
    if (!m || !m.n) return;
    for (let i = 0; i < 8; i++) gl.disableVertexAttribArray(i);
    gl.useProgram(progVM); gl.uniformMatrix4fv(locVM.u_vp, false, new Float32Array(vp)); gl.uniform3f(locVM.u_off, 0, 0, 0); gl.uniform3f(locVM.u_eye, eye[0], eye[1], eye[2]); gl.uniform1f(locVM.u_flat, 0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, texAlb); gl.uniform1i(locVM.u_alb, 0); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D_ARRAY, texMat); gl.uniform1i(locVM.u_mat, 1);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.buf); attrsVM();
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false); gl.disable(gl.CULL_FACE);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2, -4);
    if (xray) { gl.disable(gl.DEPTH_TEST); gl.uniform1f(locVM.u_galpha, xray); gl.drawArrays(gl.TRIANGLES, 0, m.n); gl.enable(gl.DEPTH_TEST); }
    gl.uniform1f(locVM.u_galpha, alpha); gl.drawArrays(gl.TRIANGLES, 0, m.n);
    gl.disable(gl.POLYGON_OFFSET_FILL); gl.depthMask(true); gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE); gl.uniform1f(locVM.u_galpha, 0.45);
  }
  // ---------------------------------------------------------------- the camera feel (v0.33.1): one controller for every view.
  // Dragging turns the view 1:1 (speed = Maus-Tempo), the wheel zooms TO the point under the pointer (that point stays
  // under it, and it becomes the new centre to turn about), Shift / middle drag pans so the ground follows the pointer,
  // a double-click flies to the clicked spot. Zoom and fly-to ease in over a fifth of a second.
  const clampP = (p) => (S.scene && S.scene.type === 'world' ? Math.max(-0.2, Math.min(1.5, p)) : Math.max(-1.2, Math.min(1.45, p)));
  const baseDist = (sc) => sc.span * (sc.type === 'house' ? 2.35 : 2.4) + 2.2;
  let camAnim = null;
  const CAM = {
    rotate(dx, dy) { camAnim = camAnim && camAnim.keepAngles ? camAnim : null; S.cam.yaw += dx * 0.0065 * S.sens; S.cam.pitch = clampP(S.cam.pitch - dy * 0.0065 * S.sens * S.vy()); },
    pan(dx, dy) {
      const sc = S.scene; if (!sc || !sc.center) return; camAnim = null;
      const cv = $('#view'), cam = camFor(sc, S.cam, cv.clientWidth || 1, cv.clientHeight || 1), eye = cam.eye, tg = cam.target;
      const fw = vnorm([tg[0] - eye[0], tg[1] - eye[1], tg[2] - eye[2]]), rt = vnorm(vcross(fw, [0, 1, 0])), up = vcross(rt, fw);
      // world units per pixel at the centre's depth: the point under the pointer follows it
      const k = Math.hypot(tg[0] - eye[0], tg[1] - eye[1], tg[2] - eye[2]) * 2 * Math.tan(cam.fov / 2) / Math.max(1, cv.clientHeight);
      for (let a = 0; a < 3; a++) sc.center[a] += (-rt[a] * dx + up[a] * dy) * k;
    },
    // a point in the scene for the pointer (the view's own pick, else the plane through the centre)
    pointAt(e) {
      const sc = S.scene; if (!sc || !sc.center) return null;
      if (HOOK.pickPoint) { const p = HOOK.pickPoint(e); if (p) return p; }
      const r = rayAt(e); if (!r) return null;
      const cam = camFor(sc, S.cam, 1, 1), d = Math.hypot(cam.target[0] - cam.eye[0], cam.target[1] - cam.eye[1], cam.target[2] - cam.eye[2]);
      return [r.o[0] + r.d[0] * d, r.o[1] + r.d[1] * d, r.o[2] + r.d[2] * d];
    },
    zoomAt(e, deltaY) {
      const sc = S.scene; if (!sc || !sc.center) return;
      const base = baseDist(sc), d0 = camAnim ? camAnim.d1 : (S.cam.dist || base), c0 = camAnim ? camAnim.c1 : sc.center.slice();
      const f = Math.max(0.55, Math.min(1.8, Math.exp(deltaY * 0.0016)));
      const d1 = Math.max(0.6, Math.min(base * 4, d0 * f)), k = d1 / d0;
      const p = (e && !S.cam.fly) ? CAM.pointAt(e) : null;
      // scale the view about the pointed point: it stays where it is on the screen
      const c1 = p ? [p[0] + (c0[0] - p[0]) * k, p[1] + (c0[1] - p[1]) * k, p[2] + (c0[2] - p[2]) * k] : c0;
      animate(c1, d1);
    },
    focus(e) { const sc = S.scene; if (!sc || !sc.center) return; const p = CAM.pointAt(e); if (!p) return; const d0 = S.cam.dist || baseDist(sc); animate(p, Math.min(d0, Math.max(6, sc.span * 0.45))); },
    animating: () => !!camAnim,
  };
  function animate(c1, d1) {
    const sc = S.scene; if (!sc) return;
    const now = performance.now(), d0 = S.cam.dist || baseDist(sc);
    camAnim = { t0: now, dur: 190, c0: sc.center.slice(), c1, d0, d1 };
  }
  function stepCam() {
    if (!camAnim || !S.scene || !S.scene.center) { camAnim = null; return; }
    const a = camAnim, t = Math.min(1, (performance.now() - a.t0) / a.dur), e = 1 - Math.pow(1 - t, 3);
    for (let i = 0; i < 3; i++) S.scene.center[i] = a.c0[i] + (a.c1[i] - a.c0[i]) * e;
    S.cam.dist = a.d0 + (a.d1 - a.d0) * e;
    if (t >= 1) camAnim = null;
  }
  const vnorm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const vcross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  function rayAt(e) {
    const cv = $('#view'), r = cv.getBoundingClientRect(); if (!S.scene) return null;
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1, ny = 1 - ((e.clientY - r.top) / r.height) * 2;
    const cam = camFor(S.scene, S.cam, r.width, r.height), eye = cam.eye, tg = cam.target;
    const fw = vnorm([tg[0] - eye[0], tg[1] - eye[1], tg[2] - eye[2]]), rt = vnorm(vcross(fw, [0, 1, 0])), up = vcross(rt, fw);
    const th = Math.tan(cam.fov / 2), asp = r.width / r.height;
    return { o: eye, d: vnorm([fw[0] + rt[0] * nx * th * asp + up[0] * ny * th, fw[1] + rt[1] * nx * th * asp + up[1] * ny * th, fw[2] + rt[2] * nx * th * asp + up[2] * ny * th]) };
  }
  // resolution follows the frame time: a slow PC renders fewer pixels and stays responsive
  let resK = 1, frameMs = 16, lastFrame = 0;
  function draw() {
    if (!gl) return;
    const cv = $('#view'), W = cv.clientWidth, H = cv.clientHeight;
    if (!W || !H) return;
    const now = performance.now(); if (lastFrame) frameMs = frameMs * 0.9 + Math.min(200, now - lastFrame) * 0.1; lastFrame = now;
    if (frameMs > 34 && resK > 0.55) resK = Math.max(0.55, resK - 0.05); else if (frameMs < 20 && resK < 1) resK = Math.min(1, resK + 0.02);
    const dpr = Math.min(2, devicePixelRatio || 1) * resK;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    drawScene(S.scene, S.cam, cv.width, cv.height, { clipY: S.clipY, main: true });
  }
  function loop() { if (S.autorot) S.cam.yaw += 0.004; stepCam(); if (HOOK.tick) HOOK.tick(); draw(); requestAnimationFrame(loop); }
  // off-screen renders for the catalogue cards
  function renderThumb(sc, w, h, cam) {
    if (!fbo) { fbo = { fb: gl.createFramebuffer(), tex: gl.createTexture(), rb: gl.createRenderbuffer(), w: 0, h: 0 }; }
    if (fbo.w !== w || fbo.h !== h) {
      gl.bindTexture(gl.TEXTURE_2D, fbo.tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.bindRenderbuffer(gl.RENDERBUFFER, fbo.rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fbo.tex, 0); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, fbo.rb);
      fbo.w = w; fbo.h = h;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.fb);
    drawScene(sc, cam || { yaw: 0.72, pitch: 0.42, dist: 0 }, w, h, { noGrid: true });
    const px = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const c = document.createElement('canvas'); c.width = w; c.height = h; c.className = 'th';
    const img = c.getContext('2d').createImageData(w, h);
    for (let y = 0; y < h; y++) img.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
    c.getContext('2d').putImageData(img, 0, 0);
    return c;
  }

  // ---------------------------------------------------------------- scenes
  function sceneModel(name) {
    const m = VM.MODELS[name]; if (!m) return null;
    const t0 = performance.now();
    const mesh = meshModel(m, S.facing);
    const sz = VM.size(name, S.facing);
    return { type: 'model', name, model: m, mesh, center: [sz[0] / 2, sz[1] / 2, sz[2] / 2], span: Math.max(sz[0], sz[1], sz[2]), size: sz, ms: performance.now() - t0 };
  }
  function sceneHouse(h) {
    const d = h.data, [sx, sy, sz] = d.dims, [hx, hz, hw, hd] = d.house;
    return { type: 'house', index: h.index, name: h.name, data: d, gpu: h.gpu, off: [0, 0, 0], center: [hx + hw / 2, d.floorY + (d.roofTop - d.floorY) * 0.45, hz + hd / 2], span: Math.max(hw, hd, d.roofTop - d.floorY) * 1.15, groundY: d.floorY };
  }
  function sceneBlock(name, gpu) { return { type: 'block', name, gpu, off: [-1, -1, -1], center: [0.5, 0.5, 0.5], span: 1.1, groundY: 0 }; }
  function setScene(sc) {
    S.scene = sc; S.cam.dist = 0; S.clipY = 1e9; S.cutLevel = 0;
    if (!sc) return;
    camAnim = null; if (sc.center && !sc.home) sc.home = sc.center.slice();
    if (sc.type === 'model' || sc.type === 'vedit') { uploadVM(sc.mesh); buildGrid(Math.max(sc.model.W, sc.model.D) + 2); if (S.cam.yaw === 0.72) S.cam.yaw = 2.42; }
    else if (sc.type === 'house' || sc.type === 'craft') { buildGrid(Math.ceil(sc.span) + 6); S.cam.yaw = 0.72; S.cam.pitch = 0.36; }
    else if (sc.type !== 'world') buildGrid(3);
    hud(); houseTools(); location.hash = sc.type === 'world' ? 'world' : sc.type === 'house' ? 'h/' + sc.index : sc.type === 'model' ? 'm/' + sc.name : sc.type === 'craft' ? 'craft/h/' + sc.index : sc.type === 'vedit' ? 'craft/m/' + sc.name : 'b/' + sc.name;
  }
  function hud() {
    if (HOOK.hud && HOOK.hud()) return;
    const sc = S.scene; if (!sc) { $('#hudName').textContent = '—'; $('#hudMeta').textContent = ''; return; }
    if (sc.type === 'model') { const m = sc.model; $('#hudName').textContent = VR.dispName(m.display); $('#hudMeta').innerHTML = `<b>${m.W}×${m.H}×${m.D}</b> Blöcke · <b>${m.parts.length}</b> Teile · <b>${fmt(m.vox)}</b> Voxel · 1/${m.res} · <b>${fmt(sc.mesh.quads)}</b> Flächen · ${sc.ms.toFixed(0)} ms`; }
    else if (sc.type === 'house') { const d = sc.data; $('#hudName').textContent = sc.name; $('#hudMeta').innerHTML = `<b>${d.house[2]}×${d.house[3]}</b> Haus auf <b>${d.lot[0]}×${d.lot[1]}</b> · <b>${d.storeys}</b> Etagen · <b>${SKIN_NAME[d.skin] ? SKIN_NAME[d.skin].split(' ·')[0] : d.skin}</b>${d.mirrored ? ' · gespiegelt' : ''} · <b>${fmt(d.blocksTotal)}</b> Blöcke · <b>${d.models.length}</b> Modelle`; }
    else { const t = R.byName[sc.name]; $('#hudName').textContent = t ? (t.display || t.o.display || sc.name) : sc.name; $('#hudMeta').innerHTML = `Block <b>${sc.name}</b>`; }
  }
  function houseTools() {
    const el = $('#houseTools'); el.innerHTML = '';
    const sc = S.scene; if (!sc || (sc.type !== 'house' && sc.type !== 'craft')) return;
    const d = sc.data;
    const g = document.createElement('div'); g.className = 'grp';
    const lbl = document.createElement('span'); lbl.className = 'lbl'; lbl.textContent = 'SCHNITT'; g.appendChild(lbl);
    const opts = [['Komplett', 0]];
    for (let k = d.storeys; k >= 1; k--) opts.push([k === 1 ? 'Erdgeschoss' : k + '. Etage', k]);
    for (const [n, k] of opts) { const b = document.createElement('button'); b.textContent = n; b.className = S.cutLevel === k ? 'on' : ''; b.onclick = () => { S.cutLevel = k; S.clipY = k ? d.floorY + k * d.storeyH - 1.05 : 1e9; houseTools(); }; g.appendChild(b); }
    el.appendChild(g);
    if (sc.type === 'craft') return;   // the Crafter edits one fixed variant
    const g2 = document.createElement('div'); g2.className = 'grp';
    const l2 = document.createElement('span'); l2.className = 'lbl'; l2.textContent = 'SKIN'; g2.appendChild(l2);
    for (const sk of d.skins.filter((v, i, a) => a.indexOf(v) === i)) { const b = document.createElement('button'); b.className = 'sw' + (sk === d.skin ? ' on' : ''); b.title = SKIN_NAME[sk] || sk; b.innerHTML = `<i style="background:${SKIN_COL[sk] || '#888'}"></i>`; b.onclick = () => rebuildHouse(sc.index, { skin: sk, mirror: d.mirrored }); g2.appendChild(b); }
    const bm = document.createElement('button'); bm.textContent = '⇋'; bm.title = 'Grundriss spiegeln'; bm.className = d.mirrored ? 'on' : ''; bm.onclick = () => rebuildHouse(sc.index, { skin: d.skin, mirror: !d.mirrored }); g2.appendChild(bm);
    el.appendChild(g2);
    const g3 = document.createElement('div'); g3.className = 'grp';
    const bc = document.createElement('button'); bc.className = 'craft'; bc.dataset.act = 'edit'; bc.innerHTML = '✏️ Bearbeiten'; bc.title = SA ? 'Im Crafter umbauen, mit allen Items — 💾 Speichern behält es' : 'Im Crafter umbauen, mit allen Items — „Ins Spiel“ übernimmt es'; bc.onclick = () => setMode('craft'); g3.appendChild(bc);
    if (d.custom) { const tag = document.createElement('span'); tag.className = 'lbl mine'; tag.textContent = 'EIGENES DESIGN'; g3.appendChild(tag); }
    el.appendChild(g3);
  }

  // ---------------------------------------------------------------- the worker: textures, houses, blocks
  let W = null, wid = 1; const wcb = new Map(), wpart = new Map();
  function workerStart() {
    const src = document.getElementById('worker-src').textContent;
    W = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    W.onmessage = (e) => { const m = e.data; if (m.type === 'log') { console.log('[worker]', m.msg); return; } if (m.part) { const p = wpart.get(m.id); if (p) p(m); return; } const cb = wcb.get(m.id); if (cb) { wcb.delete(m.id); wpart.delete(m.id); cb(m); } };
    W.onerror = (e) => { console.error('worker', e.message || e); sys('Worker-Fehler: ' + (e.message || ''), 'err'); };
    W.postMessage({ type: 'init', seed: 1, opts: {}, custom: VR.Custom ? (VR.Custom.load() || null) : null });
    // the block look from the game's settings (Klassisch / Nahtlos): here as in the game, before the first texture and mesh
    let look = 'seamless'; try { look = JSON.parse(localStorage.getItem('r9si.settings') || '{}').look === 'classic' ? 'classic' : 'seamless'; } catch (e) { /* default */ }
    if (VR.setLook) VR.setLook(look);
    W.postMessage({ type: 'look', mode: look });
    // the looks and variant slots of this browser (B1): the worker meshes blocks and houses with them
    if (VR.Looks) W.postMessage({ type: 'looks', data: VR.Looks.current() });
  }
  const call = (msg, tr) => new Promise((res) => { msg.id = wid++; wcb.set(msg.id, res); W.postMessage(msg, tr || []); });
  // a call whose answer comes in parts (onPart for each, the promise for the last)
  const callP = (msg, onPart, tr) => new Promise((res) => { msg.id = wid++; wcb.set(msg.id, res); wpart.set(msg.id, onPart); W.postMessage(msg, tr || []); });

  async function forgeTextures() {
    log('Texturen schmieden (Blöcke, Fassaden, Böden …)');
    const t0 = performance.now();
    const tex = await call({ type: 'textures', bevel: 1, bevelAll: !!(VR.LOOK && VR.LOOK.rim) });
    if (tex.type !== 'textures') { log('Texturen', 'FEHLER'); sys('Texturen fehlgeschlagen', 'err'); return false; }
    uploadGameTextures(tex);
    log('Texturen schmieden', fmt(tex.layers) + ' Layer · ' + ((performance.now() - t0) / 1000).toFixed(1) + ' s');
    return true;
  }
  async function buildHouse(i, o) {
    const h = HOUSES[i];
    const m = await call({ type: 'house', index: i, seed: 7, beds: 3, skin: o && o.skin, mirror: o && o.mirror });
    if (m.type !== 'house') { console.error(m.msg); return null; }
    const old = HOUSE.get(i); if (old && old.gpu) freeSections(old.gpu);
    const rec = { index: i, name: h.name, data: m, gpu: uploadSections(m.sections), thumb: null };
    m.sections = null;
    HOUSE.set(i, rec);
    { const sc = sceneHouse(rec); rec.thumb = renderThumb(sc, 320, 180, { yaw: 0.72, pitch: 0.34, dist: sc.span * 1.6 + 2 }); }
    return rec;
  }
  async function buildAllHouses() {
    for (let k = 0; k < HOUSES.length; k++) {
      const h = HOUSES[k];
      sys(`baue ${h.name} (${k + 1}/${HOUSES.length})`);
      const t0 = performance.now();
      const rec = await buildHouse(k);
      if (rec) { log(`Haus ${k + 1}/${HOUSES.length} · ${h.name}`, ((performance.now() - t0) / 1000).toFixed(1) + ' s'); updateHouseCard(k); }
      if (k === 0 && S.mode === 'arch' && !S.scene) selectHouse(0);
      bar(0.4 + 0.6 * (k + 1) / HOUSES.length);
    }
    sys(`${Object.keys(VM.MODELS).length} Modelle · ${HOUSE.size} Häuser · ${texInfo ? fmt(texInfo.layers) + ' Texturen' : ''}`, 'ok');
    if (S.scene && S.scene.type === 'model') parts();
  }
  async function rebuildHouse(i, o) {
    sys(`baue ${HOUSES[i].name} neu …`);
    const rec = await buildHouse(i, o);
    if (!rec) { sys('Bau fehlgeschlagen', 'err'); return; }
    updateHouseCard(i);
    if (S.scene && S.scene.type === 'house' && S.scene.index === i) { const keep = { yaw: S.cam.yaw, pitch: S.cam.pitch, dist: S.cam.dist, cut: S.cutLevel }; setScene(sceneHouse(rec)); S.cam.yaw = keep.yaw; S.cam.pitch = keep.pitch; S.cam.dist = keep.dist; if (keep.cut) { S.cutLevel = keep.cut; S.clipY = rec.data.floorY + keep.cut * rec.data.storeyH - 1.05; houseTools(); } parts(); }
    sys(`${Object.keys(VM.MODELS).length} Modelle · ${HOUSE.size} Häuser`, 'ok');
  }
  // a block whose look changed (B1): its preview is meshed again
  // (the block on screen keeps its old buffers until the new mesh is there: freeing them at once left the view binding
  // deleted buffers — INVALID_OPERATION, a black view — for as long as the worker took)
  let staleGpu = null;
  function forgetBlock(name) {
    const b = BLOCKS.get(name); if (!b) return;
    BLOCKS.delete(name);
    if (S.scene && S.scene.type === 'block' && S.scene.gpu === b.gpu) { if (staleGpu && staleGpu !== b.gpu) freeSections(staleGpu); staleGpu = b.gpu; } else freeSections(b.gpu);
  }
  async function showBlock(name) {
    let b = BLOCKS.get(name);
    if (!b) { const m = await call({ type: 'blockmesh', name }); if (m.type !== 'blockmesh') return; b = { gpu: uploadSections(m.sections) }; BLOCKS.set(name, b); }
    setScene(sceneBlock(name, b.gpu));
    if (staleGpu && staleGpu !== b.gpu) { freeSections(staleGpu); staleGpu = null; }
    parts();
  }

  // ---------------------------------------------------------------- models
  function compileAll() {
    VM.MODELS = {};
    const out = {};
    for (const d of VM.DEFS) { try { const m = VM.compile(d.name, d.o); if (m.parts.length) { m.display = d.display; m.def = d; out[d.name] = m; } } catch (e) { console.warn(d.name, e); } }
    VM.MODELS = out;
    if (VR.Custom) { try { VR.Custom.apply(VR.Custom.load()); } catch (e) { console.warn('studio designs', e); } }
    if (VR.Looks && VR.Looks.remodel) { try { VR.Looks.remodel(); } catch (e) { console.warn('model variants', e); } }   // (B1: var_k models from these)
    return out;
  }
  function thumbOf(name) {
    let c = THUMB.get(name); if (c) return c;
    const keepF = S.facing; S.facing = 0;
    const sc = sceneModel(name); S.facing = keepF;
    if (!sc) return null;
    uploadVM(sc.mesh);
    c = renderThumb(sc, 192, 144, { yaw: 2.42, pitch: 0.4, dist: (sc.span * 2.4 + 2.2) * 0.62 });
    if (S.scene && (S.scene.type === 'model' || S.scene.type === 'vedit')) uploadVM(S.scene.mesh);   // the view's buffers back
    THUMB.set(name, c); return c;
  }
  // thumbnails are rendered a few per frame as their cards scroll into view
  const thumbQ = [];
  let thumbIO = null;
  function queueThumb(card, name) {
    if (!thumbIO) thumbIO = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { thumbQ.push(e.target); thumbIO.unobserve(e.target); } }, { root: null, rootMargin: '240px' });
    card.dataset.thumb = name; thumbIO.observe(card);
  }
  function pumpThumbs() {
    let n = 0;
    while (thumbQ.length && n < 3) {
      const card = thumbQ.shift(); if (!card.isConnected) continue;
      const c = thumbOf(card.dataset.thumb); if (!c) continue;
      const old = card.querySelector('.th'); const cc = c.cloneNode(true); cc.getContext('2d').drawImage(c, 0, 0); cc.className = 'th';
      if (old) old.replaceWith(cc); else card.prepend(cc);
      n++;
    }
    requestAnimationFrame(pumpThumbs);
  }
  function selectModel(name, from) {
    const sc = sceneModel(name); if (!sc) return;
    S.from = from || null;
    setScene(sc);
    for (const el of $$('#list .card')) el.classList.toggle('on', el.dataset.name === name);
    $('#src').value = sourceOf(sc.model.def);
    parts(); crumb();
  }
  function selectHouse(i) {
    const rec = HOUSE.get(i); S.from = null; crumb();
    if (rec && rec.stale) { rec.stale = false; rebuildHouse(i, { skin: rec.data.skin, mirror: rec.data.mirrored }); }   // a look changed since it was built (B1)
    for (const el of $$('#list .card')) el.classList.toggle('on', el.dataset.house === String(i));
    if (!rec) { S.pendingHouse = i; return; }
    S.pendingHouse = null;
    setScene(sceneHouse(rec)); parts();
  }
  function sourceOf(d) {
    const src = window.__FURN_SRC || '';
    const i = src.indexOf("'" + d.name + "'");
    if (i < 0) return `// ${d.name}: aus einer Hilfsfunktion erzeugt — Quelle im Reiter „Datei“\n` + d.o.build.toString();
    let a = src.lastIndexOf('\n', i) + 1; let depth = 0, j = i, started = false;
    for (; j < src.length; j++) { const ch = src[j]; if (ch === '{') { depth++; started = true; } else if (ch === '}') { depth--; if (started && depth === 0) { break; } } }
    const end = src.indexOf('\n', j);
    return src.slice(a, end < 0 ? src.length : end).trim();
  }

  // ---------------------------------------------------------------- the left side: chips + cards
  function chips() {
    if (HOOK.chips && HOOK.chips()) return;
    const el = $('#chips'); el.innerHTML = '';
    const set = S.mode === 'arch' ? FAMS.map(f => [f[0], f[1]]) : (S.mode === 'facade' ? FCATS : CATS).map(c => [c[0], c[1]]);
    const names = Object.keys(VM.MODELS).filter(n => S.mode === 'facade' ? isFacade(n) : !isFacade(n));
    set.splice(1, 0, ['fav', '★ Favoriten']);   // the same ★ as everywhere (a whole house is its blueprint: blueprint_<i>)
    const favs = new Set(VR.Favs ? VR.Favs.list() : []);
    for (const [id, label] of set) {
      const b = document.createElement('button'); b.className = S.cat === id ? 'on' : ''; b.dataset.fcat = id;
      let n = 0;
      if (S.mode === 'arch') n = id === 'all' ? HOUSES.length : id === 'fav' ? HOUSES.filter(h => favs.has(favHouse(h.i))).length : HOUSES.filter(h => h.fam === id).length;
      else n = id === 'all' ? names.length : id === 'fav' ? names.filter(x => favs.has(x)).length : names.filter(x => catsOf(x).includes(id)).length;
      b.innerHTML = label + '<b>' + n + '</b>';
      b.onclick = () => { S.cat = id; chips(); list(); };
      el.appendChild(b);
    }
  }
  function crumb() {
    const el = $('#crumb'); el.innerHTML = '';
    if (HOOK.crumb && HOOK.crumb(el)) return;
    if (!S.from) return;
    const b = document.createElement('button'); b.textContent = VR.I18N && VR.I18N.tx ? VR.I18N.tx('g.studio.backTo', { name: S.from.name }, '← zurück zu {name}', '← back to {name}') : '← zurück zu ' + S.from.name;
    b.onclick = () => { const i = S.from.index; S.from = null; setMode('arch'); selectHouse(i); };
    el.appendChild(b);
  }
  function list() {
    if (HOOK.list && HOOK.list()) return;
    const el = $('#list'); el.innerHTML = ''; el.classList.toggle('houses', S.mode === 'arch'); el.classList.remove('palette');
    const f = S.filter;
    if (S.mode === 'arch') {
      let k = 0;
      const favL = VR.Favs ? VR.Favs.list() : [], fs = new Set(favL);
      let hs = HOUSES.filter(h => S.cat === 'all' || (S.cat === 'fav' ? fs.has(favHouse(h.i)) : h.fam === S.cat));
      if (S.cat === 'fav') hs = hs.slice().sort((a, b) => favL.indexOf(favHouse(a.i)) - favL.indexOf(favHouse(b.i)));
      for (const h of hs) {
        if (f && !(h.name + ' ' + h.sub + ' ' + h.fam).toLowerCase().includes(f)) continue;
        const c = document.createElement('div'); c.className = 'card house' + (S.scene && S.scene.type === 'house' && S.scene.index === h.i ? ' on' : ''); c.dataset.house = h.i; c.style.animationDelay = (k++ * 35) + 'ms';
        c.innerHTML = `<div class="cap"><div class="n">${h.name}</div><div class="s">${h.sub}</div></div>`;
        c.onclick = () => selectHouse(h.i);
        houseCardButtons(c, h.i);
        el.appendChild(c); updateHouseCard(h.i, c);
      }
      if (S.cat === 'fav' && !hs.length) { const d = document.createElement('div'); d.className = 'note dim'; d.textContent = 'Noch keine Lieblingshäuser — der ☆ an einer Karte legt sie hierher' + (SA ? '. 📦 Mitnehmen bringt sie ins Spiel.' : ', und im Spiel liegen sie im ★-Tab als Bauplan.'); el.appendChild(d); }
      return;
    }
    const favs = VR.Favs ? VR.Favs.list() : [];
    const hiddenVar = (n) => { const t = R.byName[n]; return !!(t && t.o && Number.isInteger(t.o.varSlot) && !t.cat); };   // (B1: a hidden or empty variant slot)
    let names = Object.keys(VM.MODELS).filter(n => !hiddenVar(n)).filter(n => S.mode === 'facade' ? isFacade(n) : !isFacade(n)).filter(n => (S.cat === 'all' || (S.cat === 'fav' ? favs.includes(n) : catsOf(n).includes(S.cat))) && (!f || n.includes(f) || VM.MODELS[n].display.toLowerCase().includes(f) || catsOf(n).join(' ').includes(f)));
    if (S.cat === 'fav') names = names.sort((a, b) => favs.indexOf(a) - favs.indexOf(b));
    const groups = new Map();
    for (const n of names) { const g = VM.MODELS[n].display.split(' ·')[0].replace(/\s*\d+"?$/, ''); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(n); }
    let k = 0;
    for (const [g, arr] of groups) {
      if (arr.length > 1) { const h = document.createElement('div'); h.className = 'grp'; h.textContent = g; el.appendChild(h); }
      for (const n of arr) {
        const m = VM.MODELS[n];
        const c = document.createElement('div'); c.className = 'card' + (S.scene && S.scene.type === 'model' && S.scene.name === n ? ' on' : ''); c.dataset.name = n; c.style.animationDelay = (Math.min(k++, 24) * 25) + 'ms';
        const th = THUMB.get(n);
        if (th) { const cc = th.cloneNode(true); cc.getContext('2d').drawImage(th, 0, 0); cc.className = 'th'; c.appendChild(cc); } else { const ph = document.createElement('div'); ph.className = 'th'; c.appendChild(ph); queueThumb(c, n); }
        const nm = arr.length > 1 && m.display.includes(' · ') ? m.display.slice(m.display.indexOf(' · ') + 3) : m.display;
        c.insertAdjacentHTML('beforeend', `<div class="cap"><div class="n" title="${m.display}">${nm}</div><div class="s">${m.W}×${m.H}×${m.D} · ${m.parts.length} Teile · 1/${m.res}</div></div>`);
        c.onclick = () => selectModel(n);
        if (VR.StudioCatalog) c.appendChild(VR.StudioCatalog.favButton(n, () => { chips(); if (S.cat === 'fav') list(); }));
        el.appendChild(c);
      }
    }
    if (!names.length) { const d = document.createElement('div'); d.className = S.cat === 'fav' && !f ? 'note dim' : 'grp'; d.textContent = S.cat === 'fav' && !f ? (SA ? 'Noch keine Favoriten hier — der ☆ an einer Karte legt sie hierher. Sie gelten überall im Studio — 📦 Mitnehmen bringt sie ins Spiel.' : 'Noch keine Favoriten hier — der ☆ an einer Karte legt sie hierher. Sie gelten überall: Teile, Crafter, Werkbank, Welt, Spiel.') : 'nichts gefunden'; el.appendChild(d); }
  }
  // a whole catalogue house as a favourite: its blueprint item (the game's ★ tab takes it as it is)
  const favHouse = (i) => 'blueprint_' + i;
  // ☆ and ✏️ on a house card (a click on them does not select the card)
  function houseCardButtons(c, i) {
    const CATL = VR.StudioCatalog;
    if (CATL && CATL.favButton) c.appendChild(CATL.favButton(favHouse(i), () => { chips(); if (S.cat === 'fav') list(); }));
    const e = document.createElement('button'); e.className = 'editb'; e.textContent = '✏️'; e.title = 'Bearbeiten — im Crafter umbauen';
    e.onclick = (ev) => { ev.stopPropagation(); selectHouse(i); editHouse(i); };   // (the card it was opened from is the one to come back to)
    c.appendChild(e);
  }
  // ✏️ a house / a model: the Crafter on it (it remembers where it was opened from)
  function editHouse(i) { if (VR.Crafter) { VR.Crafter.want = { kind: 'house', idx: i }; setMode('craft'); } }
  function editModel(n) { if (VR.Crafter) { VR.Crafter.want = { kind: 'item', name: n }; setMode('craft'); } }
  function updateHouseCard(i, card) {
    card = card || $(`#list .card[data-house="${i}"]`); if (!card) return;
    const rec = HOUSE.get(i);
    for (const old of card.querySelectorAll('.th, .pend')) old.remove();
    const sk = card.querySelector('.skins'); if (sk) sk.remove();
    if (!rec) { const p = document.createElement('div'); p.className = 'pend'; p.innerHTML = '<div><i></i>wird gebaut …</div>'; card.prepend(p); const ph = document.createElement('div'); ph.className = 'th'; card.prepend(ph); return; }
    const c = rec.thumb.cloneNode(true); c.getContext('2d').drawImage(rec.thumb, 0, 0); c.className = 'th'; card.prepend(c);
    const skins = document.createElement('div'); skins.className = 'skins';
    for (const s of rec.data.skins.filter((v, j, a) => a.indexOf(v) === j)) { const d = document.createElement('i'); d.style.background = SKIN_COL[s] || '#888'; d.title = SKIN_NAME[s] || s; d.className = s === rec.data.skin ? 'on' : ''; d.onclick = (e) => { e.stopPropagation(); selectHouse(i); rebuildHouse(i, { skin: s, mirror: rec.data.mirrored }); }; skins.appendChild(d); }
    card.appendChild(skins);
    if (S.pendingHouse === i) selectHouse(i);
  }

  // ---------------------------------------------------------------- the right side: what it is made of
  function swatch(name) {
    const t = R.byName[name]; if (!t || !texInfo || !texInfo.avgColor) return '#2a3340';
    const layer = R.T.tex[t.defaultState * 6 + 2] & 0xfff, a = texInfo.avgColor;
    const g = (v) => Math.round(Math.pow(Math.max(0, Math.min(1, v)), 1 / 2.2) * 255);
    return `rgb(${g(a[layer * 4])},${g(a[layer * 4 + 1])},${g(a[layer * 4 + 2])})`;
  }
  const blockDisplay = (name) => { const t = R.byName[name]; return t ? (t.display || (t.o && t.o.display) || name) : name; };
  function parts() {
    if (HOOK.parts && HOOK.parts()) return;
    const el = $('#partsBody'); el.innerHTML = ''; el.classList.remove('empty');
    const sc = S.scene; if (!sc) { el.classList.add('empty'); el.textContent = 'Wähle links ein Haus oder ein Modell.'; return; }
    const H = (t, b) => { const d = document.createElement('div'); d.className = 'ph'; d.innerHTML = t + (b !== undefined ? ' <b>' + b + '</b>' : ''); el.appendChild(d); };
    const CATL = VR.StudioCatalog;
    // a row in the house's list: a hover lights it up in the house (where is it?), a click finds it in its catalogue
    const hover = (p, id) => { if (!CATL || !CATL.preview) return; p.onmouseenter = () => CATL.preview(id); p.onmouseleave = () => CATL.preview(null); };
    if (sc.type === 'house') {
      const d = sc.data;
      if (CATL) CATL.pickCard(el, sc);
      H('Haus');
      const kv = document.createElement('div'); kv.className = 'kv';
      kv.innerHTML = `<span>Familie</span><b>${d.family}</b><span>Skin</span><b>${SKIN_NAME[d.skin] || d.skin}</b><span>Haus</span><b>${d.house[2]} × ${d.house[3]} Blöcke · ${d.storeys} Etagen</b><span>Grundstück</span><b>${d.lot[0]} × ${d.lot[1]}</b><span>Ausstattung</span><b>${d.beds} Betten · ${d.seats} Sitzplätze · ${d.desks} Schreibtische · ${d.cars} Autos</b><span>Blöcke gesetzt</span><b>${fmt(d.blocksTotal)}</b><span>Bauzeit</span><b>Plan ${d.ms.build.toFixed(0)} ms · Mesh ${(d.ms.mesh / 1000).toFixed(1)} s</b>`;
      el.appendChild(kv);
      H('Räume');
      for (const lv of d.rooms) { const r = document.createElement('div'); r.className = 'rooms'; r.innerHTML = `<span class="lv">${lv.level === 0 ? 'EG' : lv.level + '. OG'}</span>` + lv.rooms.map(x => `<span title="${x.u1 - x.u0 + 1}×${x.v1 - x.v0 + 1}">${x.type}</span>`).join(''); el.appendChild(r); }
      const furn = d.models.filter(([n]) => !isFacade(n)), fac = d.models.filter(([n]) => isFacade(n));
      const row = (n, cnt, k) => {
        const m = VM.MODELS[n]; const p = document.createElement('div'); p.className = 'part'; p.style.animationDelay = (Math.min(k, 30) * 18) + 'ms';
        const th = THUMB.get(n); if (th) { const c = th.cloneNode(true); c.getContext('2d').drawImage(th, 0, 0); c.className = 'th'; p.appendChild(c); } else { const ph = document.createElement('div'); ph.className = 'th'; p.appendChild(ph); queueThumb(p, n); }
        p.insertAdjacentHTML('beforeend', `<div class="n">${m ? m.display : n}<small>${m ? m.W + '×' + m.H + '×' + m.D + ' · ' + m.parts.length + ' Teile' : n}</small></div><div class="c">${cnt}</div>`);
        p.onclick = () => { if (CATL && CATL.preview) CATL.preview(null); setMode(isFacade(n) ? 'facade' : 'furn', true); selectModel(n, { index: sc.index, name: sc.name }); };
        hover(p, n); el.appendChild(p);
      };
      H('Möbel', furn.reduce((a, b) => a + b[1], 0) + ' Stück · ' + furn.length + ' Modelle'); furn.forEach(([n, c], k) => row(n, c, k));
      H('Fassade', fac.reduce((a, b) => a + b[1], 0) + ' Stück · ' + fac.length + ' Modelle'); fac.forEach(([n, c], k) => row(n, c, k));
      H('Blöcke', d.blocks.length + ' Typen');
      d.blocks.forEach(([n, c], k) => { const p = document.createElement('div'); p.className = 'part'; p.dataset.bid = n; p.style.animationDelay = (Math.min(k, 30) * 12) + 'ms'; p.innerHTML = `<div class="sw" style="background:${swatch(n)}"></div><div class="n">${blockDisplay(n)}<small>${n}</small></div><div class="c">${fmt(c)}</div>`; p.onclick = () => { if (CATL && CATL.preview) CATL.preview(null); if (CATL) CATL.open('block', n, { index: sc.index, name: sc.name }); else showBlock(n); }; hover(p, n); el.appendChild(p); });
      return;
    }
    if (sc.type === 'model') {
      const m = sc.model;
      { const b = document.createElement('button'); b.className = 'cbtn pri'; b.dataset.act = 'edit'; b.innerHTML = '✏️ Bearbeiten'; b.title = 'Im Crafter: Farben, Materialien und Form Voxel für Voxel ändern'; b.onclick = () => editModel(m.name); const r = document.createElement('div'); r.className = 'crow'; r.appendChild(b); el.appendChild(r); }
      if (CATL) CATL.actions(el, m.name, { model: true });
      if (VR.Custom && VR.CUSTOM && VR.CUSTOM.models && VR.CUSTOM.models[m.name]) { const t = document.createElement('div'); t.className = 'note good'; t.textContent = SA ? 'Eigenes Design — in diesem Studio gespeichert.' : 'Eigenes Design aktiv — so steht es im Spiel.'; el.appendChild(t); }
      H('Modell');
      const kv = document.createElement('div'); kv.className = 'kv';
      const mats = new Set(); for (const q of [sc.mesh]) void q; // (materials are in the quads; keep the readout short)
      kv.innerHTML = `<span>Name</span><b>${m.name}</b><span>Größe</span><b>${m.W} × ${m.H} × ${m.D} Blöcke</b><span>Auflösung</span><b>1/${m.res} Block (${m.res}³ Voxel je Block)</b><span>Teile</span><b>${m.parts.length}</b><span>Voxel</span><b>${fmt(m.vox)}</b><span>Flächen</span><b>${fmt(sc.mesh.quads)} (${fmt(sc.mesh.tri)} Dreiecke)</b><span>Kategorien</span><b>${catsOf(m.name).map(id => ((isFacade(m.name) ? FCATS : CATS).find(c => c[0] === id) || [])[1]).filter(Boolean).join(', ') || '—'}</b>`;
      el.appendChild(kv);
      void mats;
      // where the catalogue houses use it
      const used = [];
      for (const rec of HOUSE.values()) { const hit = rec.data.models.find(([n]) => n === m.name); if (hit) used.push([rec, hit[1]]); }
      H('Verbaut in', used.length ? used.length + ' Häusern' : (HOUSE.size < HOUSES.length ? 'Häuser werden noch gebaut …' : 'keinem Katalog-Haus'));
      used.sort((a, b) => b[1] - a[1]).forEach(([rec, cnt], k) => {
        const p = document.createElement('div'); p.className = 'part used'; p.style.animationDelay = (k * 18) + 'ms';
        const c = rec.thumb.cloneNode(true); c.getContext('2d').drawImage(rec.thumb, 0, 0); c.className = 'th'; p.appendChild(c);
        p.insertAdjacentHTML('beforeend', `<div class="n">${rec.name}<small>${houseSub(rec.index)}</small></div><div class="c">${cnt}</div>`);
        p.title = 'Das Haus öffnen — das Modell leuchtet darin auf';
        p.onclick = () => { setMode('arch'); selectHouse(rec.index); if (CATL) CATL.pickId(m.name); };
        usedActs(p, rec, m.name);
        el.appendChild(p);
      });
      return;
    }
    const used = [];
    for (const rec of HOUSE.values()) { const hit = rec.data.blocks.find(([n]) => n === sc.name); if (hit) used.push([rec, hit[1]]); }
    if (CATL) CATL.actions(el, sc.name);
    H('Block'); const kv = document.createElement('div'); kv.className = 'kv';
    const kinds = CATL ? CATL.kindsOf(sc.name).filter(k => k !== 'other').map(k => CATL.kindLabel(k)).join(' · ') : '';
    kv.innerHTML = `<span>Anzeige</span><b>${blockDisplay(sc.name)}</b><span>Name</span><b>${sc.name}</b>` + (kinds ? `<span>Art</span><b>${kinds}</b>` : ''); el.appendChild(kv);
    H('Verbaut in', used.length ? used.length + ' Häusern' : (HOUSE.size < HOUSES.length ? 'Häuser werden noch gebaut …' : 'keinem Katalog-Haus'));
    used.sort((a, b) => b[1] - a[1]).forEach(([rec, cnt], k) => { const p = document.createElement('div'); p.className = 'part used'; p.style.animationDelay = (k * 18) + 'ms'; p.title = 'Das Haus öffnen — der Block leuchtet darin auf'; const c = rec.thumb.cloneNode(true); c.getContext('2d').drawImage(rec.thumb, 0, 0); c.className = 'th'; p.appendChild(c); p.insertAdjacentHTML('beforeend', `<div class="n">${rec.name}<small>${houseSub(rec.index)}</small></div><div class="c">${fmt(cnt)}</div>`); p.onclick = () => { const id = sc.name; setMode('arch'); selectHouse(rec.index); if (CATL) CATL.pickId(id); }; usedActs(p, rec, sc.name); el.appendChild(p); });
  }
  const houseSub = (i) => { const h = HOUSES.find(x => x.i === i); return h ? h.sub : ''; };
  // a "Verbaut in" row: ⚒ that house in the Crafter with it in the hand · 🎨 all of it in that house → something else
  function usedActs(p, rec, id) {
    p.dataset.house = rec.index;
    const box = document.createElement('span'); box.className = 'uacts';
    const b1 = document.createElement('button'); b1.className = 'cbtn mini'; b1.dataset.act = 'usedCraft'; b1.textContent = '⚒'; b1.title = 'Im Crafter öffnen — mit diesem Teil in der Hand, 🖌 Malen bereit';
    b1.onclick = (e) => { e.stopPropagation(); if (VR.StudioCatalog && VR.StudioCatalog.preview) VR.StudioCatalog.preview(null); if (VR.Crafter && VR.Crafter.openWith) VR.Crafter.openWith(rec.index, id); };
    const b2 = document.createElement('button'); b2.className = 'cbtn mini'; b2.dataset.act = 'usedPaint'; b2.textContent = '🎨'; b2.title = 'Alles davon in diesem Haus ersetzen — durch eine Variante oder ein anderes Teil';
    b2.onclick = (e) => {
      e.stopPropagation();
      const open = p.nextElementSibling && p.nextElementSibling.classList.contains('varPick'); for (const x of $$('#partsBody .varPick')) x.remove();
      if (open || !VR.Variants || !VR.Variants.picker) return;
      p.after(VR.Variants.picker({ id, houseName: rec.name, onPick: (to) => { if (VR.StudioCatalog && VR.StudioCatalog.preview) VR.StudioCatalog.preview(null); VR.Crafter.replaceIn(rec.index, id, to); } }));
    };
    box.appendChild(b1); box.appendChild(b2); p.appendChild(box);
  }

  // ---------------------------------------------------------------- live editing: run the edited definition (or the whole file)
  function runSource(text, whole) {
    try {
      if (whole) { VM.DEFS.length = 0; new Function('VR', text)(VR); window.__FURN_SRC = text; }
      else { const fn = new Function('VR', 'VM', 'M', 'def', 'FAB', 'WOOD', 'COL', text); VM.DEFS.length = 0; fn(VR, VM, VM.M, VM.define, VM.PAL.FAB, VM.PAL.WOOD, VM.PAL.COL); const edited = VM.DEFS.slice(); VM.DEFS.length = 0; new Function('VR', window.__FURN_SRC)(VR); for (const e of edited) { const i = VM.DEFS.findIndex(d => d.name === e.name); if (i >= 0) VM.DEFS[i] = e; else VM.DEFS.push(e); } window.__FURN_SRC = window.__FURN_SRC.replace(sourceOf(edited[0] || { name: '\u0000', o: { build: () => 0 } }), text.trim()); }
      compileAll(); THUMB.clear(); chips(); list();
      const keep = S.scene && S.scene.type === 'model' && VM.MODELS[S.scene.name] ? S.scene.name : null;
      if (keep) selectModel(keep, S.from);
      $('#msg').textContent = 'OK — ' + Object.keys(VM.MODELS).length + ' Modelle'; $('#msg').className = 'ok';
      if (W) call({ type: 'furnsrc', text: window.__FURN_SRC }).then((m) => { if (m.updated) { for (const i of HOUSE.keys()) rebuildHouse(i, { skin: HOUSE.get(i).data.skin, mirror: HOUSE.get(i).data.mirrored }); } });
    } catch (e) { $('#msg').textContent = 'Fehler: ' + e.message; $('#msg').className = 'err'; console.error(e); }
  }

  // ---------------------------------------------------------------- modes & wiring
  const MODES = {};   // extra modes (the World mode registers itself): { enter, leave }
  function setMode(m, quiet) {
    if (S.mode !== m && MODES[S.mode] && MODES[S.mode].leave) MODES[S.mode].leave();
    if (HOOK.leave && S.mode === 'craft' && m !== 'craft') HOOK.leave();
    if (m === 'craft') { if (HOOK.enter) HOOK.enter(); return; }
    if (MODES[m] && MODES[m].enter) { MODES[m].enter(); return; }
    S.mode = m; S.cat = 'all';
    for (const b of $$('nav.modes button[data-mode]')) b.classList.toggle('on', b.dataset.mode === m);
    chips(); list();
    if (quiet) return;
    const last = VR.Crafter && VR.Crafter.last; if (VR.Crafter) VR.Crafter.last = null;
    if (m === 'arch') { const cur = S.scene && S.scene.type === 'house' ? S.scene.index : last && last.kind === 'house' ? last.idx : 0; selectHouse(cur || 0); }
    else { const names = Object.keys(VM.MODELS).filter(n => m === 'facade' ? isFacade(n) : !isFacade(n)); const cur = S.scene && S.scene.type === 'model' && names.includes(S.scene.name) ? S.scene.name : last && last.kind === 'item' && names.includes(last.name) ? last.name : names[0]; if (cur) selectModel(cur); }
  }
  function ui() {
    $('#helpText').textContent = HELP;
    log('WebGL2 · Materialtexturen');
    if (!initGL()) { $('#studio').classList.remove('boot'); return; }
    log('WebGL2 · Materialtexturen', 'ok');
    log('Modelle kompilieren (Möbel + Fassade)');
    const t0 = performance.now(); compileAll(); log('Modelle kompilieren', Object.keys(VM.MODELS).length + ' · ' + ((performance.now() - t0) / 1000).toFixed(1) + ' s'); bar(0.25);
    $('#file').value = window.__FURN_SRC || '';
    const cv = $('#view'); let drag = null;
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('pointerdown', (e) => { if (HOOK.pointer && HOOK.pointer(e, 'down')) return; drag = [e.clientX, e.clientY, e.button === 1]; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', (e) => { if (HOOK.pointer && HOOK.pointer(e, 'move')) return; if (!drag) return; const dx = e.clientX - drag[0], dy = e.clientY - drag[1]; if (drag[2] || e.shiftKey) CAM.pan(dx, dy); else CAM.rotate(dx, dy); drag = [e.clientX, e.clientY, drag[2]]; });
    cv.addEventListener('pointerup', (e) => { if (HOOK.pointer && HOOK.pointer(e, 'up')) return; drag = null; });
    cv.addEventListener('pointerleave', (e) => { if (HOOK.pointer) HOOK.pointer(e, 'leave'); });
    cv.addEventListener('dblclick', (e) => { if (HOOK.dblclick && HOOK.dblclick(e)) return; CAM.focus(e); });
    cv.addEventListener('wheel', (e) => { e.preventDefault(); if (HOOK.wheel && HOOK.wheel(e)) return; if (!S.scene) return; CAM.zoomAt(e, e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY); }, { passive: false });
    for (const b of $$('[data-face]')) b.onclick = () => { S.facing = +b.dataset.face; for (const x of $$('[data-face]')) x.classList.toggle('on', x === b); if (S.scene && S.scene.type === 'model') selectModel(S.scene.name, S.from); };
    $('#rot').onclick = () => { S.autorot = !S.autorot; $('#rot').classList.toggle('on', S.autorot); };
    $('#gridT').onclick = () => { S.grid = !S.grid; $('#gridT').classList.toggle('on', S.grid); };
    $('#texT').onclick = () => { S.flat = !S.flat; $('#texT').classList.toggle('on', S.flat); };
    $('#invY').classList.toggle('on', S.invY);
    $('#invY').onclick = () => { S.invY = !S.invY; $('#invY').classList.toggle('on', S.invY); try { localStorage.setItem('r9si.studio.invY', S.invY ? '1' : '0'); } catch (e) { /* */ } sys(S.invY ? 'Maus hoch/runter umgekehrt' : 'Maus hoch/runter normal', 'ok'); };
    $('#home').onclick = () => { camAnim = null; if (S.scene && S.scene.home) S.scene.center = S.scene.home.slice(); S.cam.dist = 0; S.cam.yaw = S.scene && (S.scene.type === 'house' || S.scene.type === 'craft') ? 0.72 : 2.42; S.cam.pitch = S.scene && (S.scene.type === 'house' || S.scene.type === 'craft') ? 0.36 : 0.42; };
    // Maus-Tempo: five steps, remembered
    { const b = $('#sensT'); if (b) { const steps = [0.5, 0.75, 1, 1.4, 2]; const show = () => { b.innerHTML = '🖱<b>' + (S.sens < 0.7 ? '◔' : S.sens < 0.9 ? '◑' : S.sens < 1.2 ? '◕' : S.sens < 1.7 ? '●' : '⦿') + '</b>'; b.title = 'Maus-Tempo ' + Math.round(S.sens * 100) + ' % (klicken: schneller · Rechtsklick: langsamer)'; };
      const set = (d) => { let i = steps.findIndex(v => v >= S.sens - 0.01); if (i < 0) i = 2; i = Math.max(0, Math.min(steps.length - 1, i + d)); S.sens = steps[i]; try { localStorage.setItem('r9si.studio.sens', String(S.sens)); } catch (e) { /* */ } show(); sys('Maus-Tempo ' + Math.round(S.sens * 100) + ' %', 'ok'); };
      b.onclick = () => set(S.sens >= 2 ? -4 : 1); b.oncontextmenu = (e) => { e.preventDefault(); set(-1); }; show(); } }
    $('#search').oninput = () => { S.filter = $('#search').value.trim().toLowerCase(); list(); };
    window.addEventListener('keydown', (e) => { if (HOOK.key && !/TEXTAREA|INPUT/.test(document.activeElement.tagName) && !document.querySelector('#imagine.on, #imPad, #hub.on') && HOOK.key(e, true)) { e.preventDefault(); return; } if (e.key === '/' && document.activeElement !== $('#search') && !/TEXTAREA|INPUT/.test(document.activeElement.tagName)) { e.preventDefault(); $('#search').focus(); $('#search').select(); } if (e.key === 'Escape' && document.activeElement === $('#search')) { $('#search').value = ''; S.filter = ''; list(); $('#search').blur(); } });
    window.addEventListener('keyup', (e) => { if (HOOK.key) HOOK.key(e, false); });
    for (const b of $$('nav.modes button[data-mode]')) if (!b.disabled) b.onclick = () => setMode(b.dataset.mode);
    $('#run').onclick = () => runSource($('#src').value, false);
    $('#runAll').onclick = () => runSource($('#file').value, true);
    $('#copy').onclick = () => { navigator.clipboard && navigator.clipboard.writeText($('#src').value); $('#msg').textContent = 'kopiert'; $('#msg').className = 'ok'; };
    for (const t of $$('.tab')) t.onclick = () => { for (const x of $$('.tab')) x.classList.toggle('on', x === t); for (const p of $$('.pane')) p.classList.toggle('on', p.id === t.dataset.pane); };
    // ⚙ Profi: the model source, the whole file, the log and the model language are tools for developers
    // (W1: one switch for everything — r9si.ui via VR.UIPrefs, which keeps r9si.studio.pro mirrored)
    { const pb = $('.tabs .proT'); let pro = false; try { pro = localStorage.getItem('r9si.studio.pro') === '1'; } catch (e) { /* */ }
      const set = (on) => { pro = on; $('#studio').classList.toggle('pro', on); if (pb) { pb.classList.toggle('on', on); pb.title = on ? 'Entwickler-Reiter ausblenden' : 'Werkzeuge für Entwickler: Modell-Quelle, ganze Datei, Log, Modell-Sprache'; }
        if (!on && $('.tab.on.pro')) { for (const x of $$('.tab')) x.classList.toggle('on', x.dataset.pane === 'parts'); for (const p of $$('.pane')) p.classList.toggle('on', p.id === 'parts'); } };
      if (VR.UIPrefs) { pro = VR.UIPrefs.get().pro; VR.UIPrefs.on((p) => set(p.pro)); }
      set(pro);
      if (pb) pb.onclick = () => { if (VR.UIPrefs) VR.UIPrefs.set({ pro: !VR.UIPrefs.get().pro }); else { set(!pro); try { localStorage.setItem('r9si.studio.pro', pro ? '1' : '0'); } catch (e) { /* */ } } }; }
    // deep link: #h/<index> · #m/<model> · else the first house
    const h = (location.hash || '').slice(1);
    if (h.startsWith('m/') && VM.MODELS[h.slice(2)]) { setMode(isFacade(h.slice(2)) ? 'facade' : 'furn', true); selectModel(h.slice(2)); }
    else { setMode('arch', true); S.pendingHouse = h.startsWith('h/') ? Math.max(0, Math.min(HOUSES.length - 1, +h.slice(2) || 0)) : 0; }
    loop(); pumpThumbs();
    // the worker: textures first (the boot screen waits for them), then every house in the background
    workerStart();
    sys('Texturen …');
    forgeTextures().then((ok) => {
      bar(0.4); $('#studio').classList.remove('boot');
      if (!ok) return;
      if (S.pendingHouse !== null && S.pendingHouse !== undefined) { const i = S.pendingHouse; HOUSES.unshift(...HOUSES.splice(i, 1)); }   // the wanted house first
      buildAllHouses().then(() => { HOUSES.sort((a, b) => a.i - b.i); if (S.mode === 'arch') { chips(); list(); } });
    });
  }
  window.__st = S; window.__studio = { HOUSE, THUMB, selectHouse, selectModel, setMode, renderThumb };
  window.__studioCore = { SA, full, editHouse, editModel, favHouse, CAM, post: (m) => W && W.postMessage(m), S, HOOK, HOUSES, HOUSE, THUMB, $, $$, fmt, call: (m, tr) => call(m, tr), callP: (m, p, tr) => callP(m, p, tr), MODES, renderThumb: (sc, w, h, cam) => renderThumb(sc, w, h, cam), thumbOf: (n) => thumbOf(n), uploadSections, freeSections, camFor, drawLines, quadMesh, freeQuadMesh, drawQuadMesh, setScene, sceneHouse, sceneModel, meshModel, uploadVM, buildGrid, hud, houseTools, parts, list, chips, sys, crumb, setMode, selectHouse, selectModel, rebuildHouse, isFacade, catsOf, CATS, FCATS, showBlock, forgetBlock, setAvgLum, BLOCKS, swatch, blockDisplay, texInfo: () => texInfo, view: () => $('#view'), gl: () => gl };
  window.addEventListener('load', ui);
})();
