// ============================================================================
// FolkGPU (t-folk, the owner: „natürlich keine Lego-Villagers, wir wollen schon Realismus") — the villagers drawn smooth.
// A villager's look goes to a worker, which builds its rig (folkmodel.js buildPerson: real proportions at 32 voxels a
// block — the rig's files are in the worker's bundle), cuts every part's grid to what it holds, makes it a surface-nets
// mesh (folksmooth.js, kept in its LRU by the grid's hash: the villagers share sleeves, trousers and shoes) and hands back
// ONE buffer for the whole person, each vertex naming its part, with the rig's joints.
// t-folk2 (the owner's next look: one draw a person): every smooth person's mesh lives in ONE arena — a vertex buffer and
// a 32-bit index buffer, first-fit ranges grown by copy — and their bones in a float texture, a row a person (FG.MAXB
// matrices, then the person's light), so the whole crowd is ONE multiDrawElementsWEBGL: the people's own program (FOLK_VS
// / FOLK_FS below) takes its row by gl_DrawID. Without WEBGL_multi_draw: one drawElements a person, the row a uniform.
// The parts are shared only some 2.5× between a town's people (their colours are baked), so an instanced draw per shared
// part would have stayed ~5 draws a person; the arena makes it one draw for everyone.
// The same light as the voxel people (the vox program's shading, the CPU's terrain shade, the block light), and the eye's
// own: the eye's vertices (folksmooth.js marks them) take the light's brightness, not its colour — the whites stay white
// by a lantern and at dusk.
// Until its mesh is there a villager shows its voxel self; beyond NEAR blocks it is the half-resolution voxel LOD as
// before. The switch: Echte Menschen (settings.smoothFolk; off on Very Low and Low — game.js PRESETS — where nothing
// here runs and no program is compiled). The meshes live on the GPU while they are used: past MAX_BYTES the ones not
// drawn for a while go (asked again when needed).
// Public: VR.FolkGPU.on(game) · recFor(look) · want(game, rec, d2) · queue(rec, pos, yaw, pose, light, opts) ·
// flush(r, E, cam) · stats · clear(gl) · Ranges (the arena's allocator, node-tested)
// ============================================================================
(function (VR) {
  'use strict';
  const FG = VR.FolkGPU = {
    NEAR: 24,            // smooth within this many blocks (the voxel LOD beyond, as villages.js draws it)
    ASK: 30,             // a mesh is asked for from this distance (ready before the person reaches NEAR)
    PER_FRAME: 4,        // new requests a frame (a request is a look posted: the worker builds and meshes)
    INFLIGHT: 8,         // requests in the worker queue at most
    MAX_BYTES: 32 << 20, // the GPU meshes kept (a person ~ 0.1–0.2 MB)
    KEEP_MS: 4000,       // a mesh drawn within this time is never evicted
    MAXB: 20,            // bones a person at most (the smooth rig: 13 parts, the hands, what they hold)
    recs: new Map(), bytes: 0, inflight: 0, asked: 0, frame: -1,
    stats: { asked: 0, got: 0, failed: 0, workerMs: 0, buildMs: 0, hits: 0, miss: 0, bytes: 0, drawn: 0, tris: 0, evicted: 0, people: 0, draws: 0, full: 0 },
    items: [], n: 0,
  };
  const BW = FG.BW = FG.MAXB * 4 + 2;   // the bone texture's row: the matrices (4 texels each), the light (2 texels)
  // the switch (Very Low and Low: off, game.js PRESETS)
  FG.on = (g) => !!(g && g.settings && g.settings.smoothFolk && VR.FolkSmooth && VR.Folk && VR.Folk.buildPerson && g.world && g.world.pool);

  // ---------------------------------------------------------------- a look's record
  // state: 0 not asked · 1 asked · 2 ready · 3 failed (three failures: the voxel self stays)
  FG.recFor = function (look) {
    const key = VR.Folk.lookKey(look);
    let rec = FG.recs.get(key);
    if (!rec) { rec = { key, look, state: 0, fails: 0, vOff: -1, nv: 0, iOff: -1, count: 0, bytes: 0, used: 0, def: null }; FG.recs.set(key, rec); }
    return rec;
  };
  FG.ready = (rec) => !!rec && rec.state === 2;

  // ---------------------------------------------------------------- asking the worker
  // d2: the squared distance; called by the draw for a person in view within ASK blocks
  FG.want = function (g, rec, d2) {
    if (!rec || rec.state !== 0 || rec.fails >= 3) return false;
    if (FG.frame !== g.frame) { FG.frame = g.frame; FG.asked = 0; }
    if (FG.asked >= FG.PER_FRAME || FG.inflight >= FG.INFLIGHT || d2 > FG.ASK * FG.ASK) return false;
    if (rec.look && rec.look.role === 'hero') { rec.state = 3; rec.fails = 3; return false; }   // (the trailer heroes keep their own build)
    FG.asked++;
    // the worker builds the rig from the look, cuts and meshes its parts (folksmooth.js FS.personFromLook): the main
    // thread only posts the look (building the grids here cost some 6 ms a person, cutting and hashing them as much)
    rec.state = 1; FG.inflight++; FG.stats.asked++;
    g.world.pool.submit({ type: 'folkmesh', look: rec.look }, null, (m) => FG.got(g, rec, m), 8 + d2 / 256);
    return true;
  };
  FG.got = function (g, rec, m) {
    FG.inflight = Math.max(0, FG.inflight - 1);
    if (!m || m.type !== 'folkmesh' || !m.data || !m.idx || !m.rig) { rec.fails++; rec.state = rec.fails >= 3 ? 3 : 0; FG.stats.failed++; return; }
    const r = g && g.renderer, gl = r && r.gl;
    if (!gl) { rec.state = 0; return; }
    if (m.rig.order && m.rig.order.length > FG.MAXB) { rec.fails = 3; rec.state = 3; FG.stats.failed++; return; }
    rec.def = m.rig;   // (what the draw needs of the rig: its units, layout, joints and order)
    if (!FG.upload(gl, rec, m)) return;
    FG.stats.buildMs += m.buildMs || 0;
    FG.stats.got++; FG.stats.workerMs += m.ms || 0; FG.stats.hits += m.hits | 0; FG.stats.miss += m.miss | 0; FG.stats.lru = Math.max(FG.stats.lru || 0, m.cacheBytes || 0);
  };

  // ---------------------------------------------------------------- the arena's ranges (first fit, neighbours merged)
  // Ranges(cap): alloc(n) → the offset or −1 · release(off, n) · grow(cap) (the new tail free) · free (sorted [off, len])
  class Ranges {
    constructor(cap) { this.cap = cap; this.free = cap > 0 ? [[0, cap]] : []; this.used = 0; }
    alloc(n) {
      const F = this.free;
      for (let i = 0; i < F.length; i++) { const f = F[i]; if (f[1] < n) continue; const off = f[0]; f[0] += n; f[1] -= n; if (!f[1]) F.splice(i, 1); this.used += n; return off; }
      return -1;
    }
    release(off, n) {
      if (n <= 0) return;
      const F = this.free; let i = 0;
      while (i < F.length && F[i][0] < off) i++;
      F.splice(i, 0, [off, n]); this.used -= n;
      // (with the next, then with the previous)
      if (i + 1 < F.length && F[i][0] + F[i][1] === F[i + 1][0]) { F[i][1] += F[i + 1][1]; F.splice(i + 1, 1); }
      if (i > 0 && F[i - 1][0] + F[i - 1][1] === F[i][0]) { F[i - 1][1] += F[i][1]; F.splice(i, 1); }
    }
    grow(cap) { if (cap <= this.cap) return; const add = cap - this.cap, old = this.cap; this.cap = cap; this.used += add; this.release(old, add); }
    largest() { let m = 0; for (const f of this.free) m = Math.max(m, f[1]); return m; }
  }
  FG.Ranges = Ranges;

  // ---------------------------------------------------------------- the arena: one vertex buffer, one index buffer
  // 20 bytes a vertex (the voxel models' layout: position, normal, the bone in the pad byte, colour) and Uint32 indices
  // already offset by the person's first vertex (multiDrawElements has no base vertex)
  const AR = FG.ar = { vbo: null, ibo: null, vao: null, v: null, i: null, gl: null };
  const V0 = 1 << 17, I0 = 1 << 19, VMAX = (FG.MAX_BYTES * 1.5 / 20) | 0, IMAX = (FG.MAX_BYTES * 1.5 / 4) | 0;
  function attrs(gl) {
    gl.bindVertexArray(AR.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, AR.vbo);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.BYTE, true, 20, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, 20, 16);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.UNSIGNED_BYTE, false, 20, 15);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, AR.ibo);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
  }
  function arenaInit(gl) {
    if (AR.vao && AR.gl === gl) return true;
    AR.gl = gl; AR.vao = gl.createVertexArray(); AR.vbo = gl.createBuffer(); AR.ibo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, AR.vbo); gl.bufferData(gl.ARRAY_BUFFER, V0 * 20, gl.STATIC_DRAW);
    gl.bindVertexArray(null); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, AR.ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, I0 * 4, gl.STATIC_DRAW); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    AR.v = new Ranges(V0); AR.i = new Ranges(I0);
    attrs(gl);
    return true;
  }
  // a bigger buffer of a kind ('v' or 'i'), the old one copied in; false past the cap
  function arenaGrow(gl, kind, need) {
    const R = AR[kind], unit = kind === 'v' ? 20 : 4, max = kind === 'v' ? VMAX : IMAX;
    const cap = Math.min(max, Math.max(R.cap * 2, R.cap + need * 2));
    if (cap <= R.cap) return false;
    const old = kind === 'v' ? AR.vbo : AR.ibo, nu = gl.createBuffer(), T = kind === 'v' ? gl.ARRAY_BUFFER : gl.ELEMENT_ARRAY_BUFFER;
    // (bound to its own target first: WebGL 2 fixes a buffer's type at its first binding — an index buffer first bound
    // as a copy target could never hold indices)
    gl.bindVertexArray(null);
    gl.bindBuffer(T, nu); gl.bufferData(T, cap * unit, gl.STATIC_DRAW); gl.bindBuffer(T, null);
    gl.bindBuffer(gl.COPY_WRITE_BUFFER, nu);
    gl.bindBuffer(gl.COPY_READ_BUFFER, old); gl.copyBufferSubData(gl.COPY_READ_BUFFER, gl.COPY_WRITE_BUFFER, 0, 0, R.cap * unit);
    gl.bindBuffer(gl.COPY_READ_BUFFER, null); gl.bindBuffer(gl.COPY_WRITE_BUFFER, null);
    gl.deleteBuffer(old);
    if (kind === 'v') AR.vbo = nu; else AR.ibo = nu;
    R.grow(cap); attrs(gl);
    FG.stats.grown = (FG.stats.grown || 0) + 1;
    return true;
  }
  // n of a kind: from the free ranges, else by growing, else by evicting what has not been drawn for a while
  function arenaAlloc(gl, kind, n) {
    let off = AR[kind].alloc(n);
    if (off < 0 && arenaGrow(gl, kind, n)) off = AR[kind].alloc(n);
    if (off < 0) { evict(gl, performance.now(), true); off = AR[kind].alloc(n); }
    return off;
  }
  FG.upload = function (gl, rec, m) {
    FG.free(gl, rec);
    arenaInit(gl);
    const nv = m.nv, ni = m.idx.length;
    const vOff = arenaAlloc(gl, 'v', nv); if (vOff < 0) { rec.state = 0; FG.stats.full++; return false; }
    const iOff = arenaAlloc(gl, 'i', ni); if (iOff < 0) { AR.v.release(vOff, nv); rec.state = 0; FG.stats.full++; return false; }
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, AR.vbo); gl.bufferSubData(gl.ARRAY_BUFFER, vOff * 20, m.data);
    const ix = new Uint32Array(ni), I = m.idx; for (let k = 0; k < ni; k++) ix[k] = I[k] + vOff;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, AR.ibo); gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, iOff * 4, ix); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    rec.vOff = vOff; rec.nv = nv; rec.iOff = iOff; rec.count = ni;
    rec.bytes = nv * 20 + ni * 4; rec.state = 2; rec.used = performance.now();
    FG.bytes += rec.bytes; FG.stats.bytes = FG.bytes; FG.stats.people++;
    return true;
  };
  FG.free = function (gl, rec) {
    if (rec.vOff < 0) return;
    if (AR.v) { AR.v.release(rec.vOff, rec.nv); AR.i.release(rec.iOff, rec.count); }
    rec.vOff = -1; rec.iOff = -1; FG.bytes -= rec.bytes; rec.bytes = 0; FG.stats.bytes = FG.bytes; FG.stats.people--;
  };
  // every mesh back to the worker's care (a lost context, the tests' „before" picture)
  FG.clear = function (gl) {
    for (const rec of FG.recs.values()) { if (gl) FG.free(gl, rec); rec.state = 0; rec.fails = 0; }
    FG.recs.clear(); FG.inflight = 0;
    if (gl && AR.vao && AR.gl === gl) { gl.deleteVertexArray(AR.vao); gl.deleteBuffer(AR.vbo); gl.deleteBuffer(AR.ibo); }
    AR.vao = AR.vbo = AR.ibo = null; AR.v = AR.i = null; AR.gl = null; FG.bytes = 0; FG.stats.bytes = 0; FG.stats.people = 0;
  };
  // past MAX_BYTES (or with the arena full: hard) the meshes not drawn for KEEP_MS go, the longest unused first
  function evict(gl, now, hard) {
    if (!hard && FG.bytes <= FG.MAX_BYTES) return;
    const old = [];
    for (const rec of FG.recs.values()) if (rec.state === 2 && now - rec.used > FG.KEEP_MS) old.push(rec);
    old.sort((a, b) => a.used - b.used);
    const goal = hard ? FG.bytes * 0.7 : FG.MAX_BYTES * 0.85;
    for (const rec of old) { if (FG.bytes <= goal) break; FG.free(gl, rec); rec.state = 0; FG.stats.evicted++; }
  }

  // ---------------------------------------------------------------- the bones: a float texture, a row a person
  const BT = FG.bt = { tex: null, rows: 0, data: null, gl: null };
  function bonesTex(gl, n) {
    if (BT.tex && BT.gl === gl && BT.rows >= n) return BT;
    const rows = Math.max(64, 1 << Math.ceil(Math.log2(Math.max(1, n))));
    if (BT.tex && BT.gl === gl) gl.deleteTexture(BT.tex);
    BT.gl = gl; BT.rows = rows; BT.data = new Float32Array(BW * 4 * rows);
    BT.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, BT.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, BW, rows, 0, gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return BT;
  }
  FG.BONE_UNIT = 10;

  // ---------------------------------------------------------------- the people's program
  // FOLK_VS: the bone's matrix from the person's row (gl_DrawID under multi-draw, u_person without), the person's light
  // from the row's end; FOLK_FS: the vox program's light (soft wrap, sky and ground, a rim, the block light, the CPU's
  // terrain shade), the eye's neutral light, the emissive bytes
  const FOLK_VS = (multi) => `${multi ? '#extension GL_ANGLE_multi_draw : require' : ''}
layout(location=0) in vec3 a_pos;
layout(location=1) in vec3 a_normal;
layout(location=2) in vec4 a_color;
layout(location=3) in float a_bone;
uniform mat4 u_viewProj;
uniform highp sampler2D u_bones;
#ifdef MULTIDRAW
#define PERSON gl_DrawID
#else
uniform int u_person;
#define PERSON u_person
#endif
out vec3 v_n;
out vec4 v_color;
out vec3 v_rel;
flat out vec4 v_light;
flat out vec3 v_bl;
#ifdef SUN
uniform mat4 u_shadowMat;
out vec4 v_shadow;
#endif
void main() {
  int b = int(a_bone + 0.5) * 4, p = PERSON;
  mat4 M = mat4(texelFetch(u_bones, ivec2(b, p), 0), texelFetch(u_bones, ivec2(b + 1, p), 0), texelFetch(u_bones, ivec2(b + 2, p), 0), texelFetch(u_bones, ivec2(b + 3, p), 0));
  vec4 wp = M * vec4(a_pos, 1.0);
  v_rel = wp.xyz;
  v_n = mat3(M) * a_normal;
  v_color = vec4(pow(a_color.rgb, vec3(2.2)), a_color.a);
  v_light = texelFetch(u_bones, ivec2(${BW - 2}, p), 0);
  v_bl = texelFetch(u_bones, ivec2(${BW - 1}, p), 0).xyz;
#ifdef SUN
  v_shadow = u_shadowMat * vec4(wp.xyz + normalize(v_n) * 0.04, 1.0);
#endif
  gl_Position = u_viewProj * wp;
}`;
  const FOLK_FS = () => `
${'__COMMON__'}
in vec3 v_n;
in vec4 v_color;
in vec3 v_rel;
flat in vec4 v_light;   // the sky light, the terrain's shade (0 sun … 1 shaded), the hurt flash, no fog
flat in vec3 v_bl;      // the block light
#ifdef SUN
// t-folk2: the people receive the shadow map (the frame's copy with the people in it: a person in a building's or another's
// shadow is in it) — the terrain's four taps; the bias a little over the depth the people were written nearer the light
uniform highp sampler2DShadow u_shadowMap;
uniform float u_shadowTexel;
uniform vec2 u_shadowOff;
uniform float u_sunBias;
in vec4 v_shadow;
float folkSun() {
  vec3 sc = v_shadow.xyz / v_shadow.w * 0.5 + 0.5;
  if (sc.x <= 0.001 || sc.x >= 0.999 || sc.y <= 0.001 || sc.y >= 0.999 || sc.z >= 1.0) return 1.0;
  float t = u_shadowTexel, b = u_sunBias;
  vec2 su = fract(sc.xy + u_shadowOff);
  float s = texture(u_shadowMap, vec3(su + vec2(-0.6, -0.6) * t, sc.z - b));
  s += texture(u_shadowMap, vec3(su + vec2(0.6, -0.6) * t, sc.z - b));
  s += texture(u_shadowMap, vec3(su + vec2(-0.6, 0.6) * t, sc.z - b));
  s += texture(u_shadowMap, vec3(su + vec2(0.6, 0.6) * t, sc.z - b));
  return s * 0.25;
}
#endif
out vec4 o;
void main() {
  vec3 alb = v_color.rgb;
  // (the alpha byte: 255 emissive, 128 the eye — folksmooth.js)
  float em = step(0.75, v_color.a), eye = step(0.25, v_color.a) * (1.0 - em);
  vec3 n = normalize(v_n);
  float sunUp = smoothstep(-0.12, 0.12, u_sunDir.y);
  vec3 L = sunUp > 0.001 ? u_sunDir : u_moonDir;
  vec3 lc = sunUp > 0.001 ? u_sunColor * sunUp : u_moonColor;
  float sk = v_light.x * v_light.x;
  float outdoor = smoothstep(0.5, 0.95, v_light.x);
  float wrapL = max((dot(n, L) + 0.3) / 1.3, 0.0);
  vec3 hemi = mix(u_ambSky * vec3(0.62, 0.56, 0.5), u_ambSky * 1.06, n.y * 0.5 + 0.5);
#ifdef LIGHT2
  hemi = l2Hemi(n) * 1.04; wrapL = l2Wrap(dot(n, L), u_l2K.w);   // t-light2: the hemisphere, the skin's softer wrap
#endif
#ifdef SUN
  float sun = (1.0 - v_light.y) * (outdoor > 0.0 ? folkSun() : 1.0);
#else
  float sun = 1.0 - v_light.y;
#endif
  vec3 light = hemi * sk + lc * wrapL * outdoor * 0.9 * sun + pow(v_bl, vec3(1.7)) * 1.35 * u_blockLightTint + 0.03;
#ifdef LIGHT2
  light = hemi * sk + lc * wrapL * outdoor * 0.9 * sun + l2Pool(v_bl) + 0.03;   // t-light2: the lamps' pools
#endif
  // t-folk2: an eye takes the light's brightness, not its colour, and a little of its own — the whites stay white (a
  // shade cool) by a lantern and at dusk, the iris dark (the owner: amber eyes under warm light)
  if (eye > 0.5) { float l = dot(light, vec3(0.2126, 0.7152, 0.0722)); light = mix(light, vec3(l) * vec3(0.95, 0.985, 1.05), 0.85) + vec3(0.045, 0.05, 0.058); }
  vec3 col = alb * light;
  vec3 V = normalize(-v_rel);
  float rim = pow(1.0 - max(dot(n, V), 0.0), 3.0);
  col += (u_skyHorizon * 0.5 + lc * 0.08) * rim * 0.22 * sk * alb;
  // u-folk2: a soft warm rim where the sun stands behind the person (the golden edge of a cartoon film's people against
  // the light) — a few ALU, the smooth people only (Echte Menschen: off on Very Low and Low)
  float back = smoothstep(0.1, 0.9, dot(L, -V));
  col += lc * (0.35 + 0.65 * alb) * rim * back * 0.55 * outdoor * sun;
  col += lc * pow(max(dot(n, normalize(L + V)), 0.0), 28.0) * 0.05 * outdoor;
  col = mix(col, alb * 2.2, em);
  col = mix(col, vec3(1.0, 0.2, 0.15), v_light.z * 0.6);
  if (v_light.w < 0.5) col = applyFog(col, v_rel, length(v_rel));
  o = vec4(col, 1.0);
}`;
  // (sun: the variant that reads the shadow map — the 'map' mode's)
  FG.program = function (r, sun) {
    const P = r.P, key = sun ? 'folk2s' : 'folk2';
    if (P[key] !== undefined) return P[key];
    const multi = !!(VR.GL.ext && VR.GL.ext.multiDraw), S = VR.SHADERS;
    try { P[key] = VR.GL.program(FOLK_VS(multi), FOLK_FS().replace('__COMMON__', S.COMMON), sun ? 'folkSun' : 'folk', (multi ? ['MULTIDRAW'] : []).concat(sun ? ['SUN'] : [])); P[key].multi = multi; }
    catch (e) { console.error(e); P[key] = null; }
    return P[key];
  };

  // ---------------------------------------------------------------- the draw
  // The people of a frame are queued while the voxel ones are drawn (villages.js), then drawn here at once: their rows
  // written (the rig's matrices — folksmooth.js rigMats, the same as entities.js drawModel builds — and the light), the
  // texture updated, one multi-draw over their ranges of the arena
  FG.queue = function (rec, pos, yaw, pose, light, opts) {
    let it = FG.items[FG.n];
    if (!it) it = FG.items[FG.n] = { rec: null, pos: [0, 0, 0], yaw: 0, pose: null, sky: 0, bl: [0, 0, 0], opts: null };
    it.rec = rec; it.pos[0] = pos[0]; it.pos[1] = pos[1]; it.pos[2] = pos[2]; it.yaw = yaw; it.pose = pose;
    it.sky = light.sky; it.bl[0] = light.bl[0]; it.bl[1] = light.bl[1]; it.bl[2] = light.bl[2]; it.opts = opts;
    FG.n++;
  };
  const IDENT = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const base = new Float32Array(16), mats = {};
  let counts = new Int32Array(64), offsets = new Int32Array(64);
  // the rows of the queued people (camera-relative), into BT.data; → the number written (the ready ones, in order)
  FG.rows = function (cam, n) {
    const m4 = VR.mat4, FS = VR.FolkSmooth, D = BT.data;
    let k = 0;
    for (let i = 0; i < n; i++) {
      const it = FG.items[i], rec = it.rec, def = rec.def, o = it.opts || {};
      if (rec.state !== 2 || !def) continue;
      base.set(IDENT);
      m4.translate(base, base, it.pos[0] - cam.x, it.pos[1] - cam.y, it.pos[2] - cam.z);
      m4.rotY(base, base, it.yaw);
      if (o.roll) m4.rotZ(base, base, o.roll);
      if (o.pitch) m4.rotX(base, base, o.pitch);
      const s = (o.scale || 1) / (def.unit || 32);
      m4.scale(base, base, s, s, s);
      FS.rigMats(def, base, it.pose, mats);
      const order = def.order, hide = o.hide, row = k * BW * 4;
      for (let b = 0; b < order.length && b < FG.MAXB; b++) {
        const M = mats[order[b]], off = row + b * 16;
        if (!M) continue;
        for (let q = 0; q < 16; q++) D[off + q] = M[q];
        // a hidden part (the lids while the eyes are open, the talking mouth, a seated guest's bag): its vertices fall onto
        // its pivot
        // (u-folk2: the expressions `joy` and `wow` are hidden unless o.expr names one — every other caller stays as it was)
        const nm = order[b];
        if ((hide && hide[nm]) || ((nm === 'joy' || nm === 'wow') && o.expr !== nm) || (nm === 'faceFar' && !o.far)) for (let q = 0; q < 12; q++) D[off + q] = 0;
        else if (nm === 'lids' && o.lidUp) { D[off + 12] += M[4] * o.lidUp; D[off + 13] += M[5] * o.lidUp; D[off + 14] += M[6] * o.lidUp; }   // (u-folk3: a mood's lids — lifted, the eye half covered; the far face from 6 m)
      }
      const L = row + (BW - 2) * 4;
      D[L] = it.sky; D[L + 1] = o.shade || 0; D[L + 2] = o.flash || 0; D[L + 3] = o.noFog ? 1 : 0;
      D[L + 4] = it.bl[0]; D[L + 5] = it.bl[1]; D[L + 6] = it.bl[2]; D[L + 7] = 0;
      if (k >= counts.length) { const c = new Int32Array(counts.length * 2); c.set(counts); counts = c; const f = new Int32Array(offsets.length * 2); f.set(offsets); offsets = f; }
      counts[k] = rec.count; offsets[k] = rec.iOff * 4;
      if (SM.pos.length < (k + 1) * 3) { const q = new Float64Array(SM.pos.length * 2 + 48); q.set(SM.pos); SM.pos = q; }
      SM.pos[k * 3] = it.pos[0]; SM.pos[k * 3 + 1] = it.pos[1]; SM.pos[k * 3 + 2] = it.pos[2];
      rec.used = performance.now();
      k++;
    }
    return k;
  };
  FG.flush = function (r, E, cam) {
    const n = FG.n; FG.n = 0;
    FG.stats.drawn = 0; FG.stats.tris = 0; FG.stats.draws = 0;
    if (!n) return 0;
    const gl = r.gl, sun = !!(FG.game && FG.shadowMode(FG.game.settings, r.q) === 'map' && r.shadowValid && r.shadowTex), p = FG.program(r, sun);
    if (!p || !AR.vao) { if (!p) for (let i = 0; i < n; i++) FG.items[i].rec.state = 3; return 0; }
    bonesTex(gl, n);
    const k = FG.rows(cam, n);
    if (!k) return 0;
    gl.activeTexture(gl.TEXTURE0 + FG.BONE_UNIT); gl.bindTexture(gl.TEXTURE_2D, BT.tex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, BW, k, gl.RGBA, gl.FLOAT, BT.data, 0);
    gl.useProgram(p.p); r.common(p, E);
    gl.uniformMatrix4fv(p.u.u_viewProj, false, r.viewProj);
    gl.uniform1i(p.u.u_bones, FG.BONE_UNIT);
    if (sun) {
      gl.uniformMatrix4fv(p.u.u_shadowMat, false, r.shadowMat);
      gl.uniform1f(p.u.u_shadowTexel, 1 / (r.shadowSize || 1024));
      const o = r.shadowOff; gl.uniform2f(p.u.u_shadowOff, o ? o[0] : 0, o ? o[1] : 0);
      const M = r.shadowMat, zr = 0.5 * Math.hypot(M[2], M[6], M[10]);
      gl.uniform1f(p.u.u_sunBias, 0.0006 + (FG.SHADOW_EPS + 0.12) * zr);
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, r.shadowRead || r.shadowTex); gl.uniform1i(p.u.u_shadowMap, 3);
    }
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE);
    gl.bindVertexArray(AR.vao);
    const ext = p.multi ? VR.GL.ext.multiDraw : null;
    let tris = 0; for (let i = 0; i < k; i++) tris += counts[i] / 3;
    if (ext) { ext.multiDrawElementsWEBGL(gl.TRIANGLES, counts, 0, gl.UNSIGNED_INT, offsets, 0, k); FG.stats.draws = 1; }
    else { for (let i = 0; i < k; i++) { gl.uniform1i(p.u.u_person, i); gl.drawElements(gl.TRIANGLES, counts[i], gl.UNSIGNED_INT, offsets[i]); } FG.stats.draws = k; }
    gl.bindVertexArray(null);
    FG.stats.drawn = k; FG.stats.tris = tris;
    if (r.stats) { r.stats.draws += FG.stats.draws; r.stats.tris += tris; }
    // (the casters of the next frame's shadow pass: these rows, ranges and places, seen from this camera)
    SM.n = k; SM.at = r.frameNo; SM.cam[0] = cam.x; SM.cam[1] = cam.y; SM.cam[2] = cam.z; SM.counts = counts; SM.offsets = offsets;
    evict(gl, performance.now());
    return k;
  };

  // ---------------------------------------------------------------- t-folk2: the people in the shadow map
  // The owner: the shadows are blots. The people cast and receive the shadow map's shadows like the props — but the map is
  // kept for many frames (renderer.js renderShadows / the Schatten-Takt), and a moving person drawn into it would leave
  // its shadow behind. So the people get a copy: a second depth texture D of the map's size. When the map changed (a new
  // render, tiles redrawn, the maps swapped) D takes all of it (a blit), else only the rectangles last frame's people
  // covered come back from the map; then every smooth person drawn last frame (within NEAR) is drawn into D — one
  // multi-draw, depth only, with last frame's bones moved to this frame's camera (the pass runs before this frame's
  // poses: a planted foot does not move, so the contact is exact). The terrain, the props and the people read D for the
  // frame (renderer.js: shadowRead). The receivers subtract a bias of 0.0006 (some 0.3 blocks) before they compare: the
  // people are written that much nearer the light (and 0.04 blocks more), so the ground finds their shadow at their feet.
  // On the toroidal map (Schatten-Takt: REPEAT, an offset) the people are written at the wrapped texels, in up to four
  // shifted copies where they straddle the wrap.
  // The modes (FG.shadowMode): 'map' with a shadow map, the smooth people and the switch (Balanced and up); 'ellipse' the
  // soft blot stretched from the sun where there is no map but the drop shadows are on (Low; the voxel people when Echte
  // Menschen is off); 'none' on Very Low (as v0.46: it never had one).
  const SM = FG.sm = { at: -9, tex: null, fb: null, size: 0, gl: null, src: null, renders: -1, wrap: 0, n: 0, cam: [0, 0, 0], counts: null, offsets: null, pos: new Float64Array(48), rects: [], prog: undefined, frames: 0, full: 0 };
  FG.shadowMode = function (s, q) {
    if (!s) return 'none';
    if (s.smoothFolk && (s.folkShadow === undefined || !!s.folkShadow) && q && q.shadows > 0) return 'map';
    return q && q.dropShadow ? 'ellipse' : 'none';
  };
  FG.SHADOW_EPS = 0.04;   // blocks the people are written nearer the light than the receivers' bias asks
  const CAST_VS = (multi) => `${multi ? '#extension GL_ANGLE_multi_draw : require' : ''}
layout(location=0) in vec3 a_pos;
layout(location=3) in float a_bone;
uniform highp sampler2D u_bones;
uniform mat4 u_shadowW;
uniform vec3 u_shift;
uniform float u_zBias;
#ifdef MULTIDRAW
#define PERSON gl_DrawID
#else
uniform int u_person;
#define PERSON u_person
#endif
void main() {
  int b = int(a_bone + 0.5) * 4, p = PERSON;
  mat4 M = mat4(texelFetch(u_bones, ivec2(b, p), 0), texelFetch(u_bones, ivec2(b + 1, p), 0), texelFetch(u_bones, ivec2(b + 2, p), 0), texelFetch(u_bones, ivec2(b + 3, p), 0));
  vec4 wp = M * vec4(a_pos, 1.0);
  gl_Position = u_shadowW * vec4(wp.xyz + u_shift, 1.0);
  gl_Position.z -= u_zBias * gl_Position.w;
}`;
  const CAST_FS = `
out vec4 o;
void main() { o = vec4(1.0); }`;
  function castProgram(r) {
    const P = r.P;
    if (P.folkCast !== undefined) return P.folkCast;
    const multi = !!(VR.GL.ext && VR.GL.ext.multiDraw);
    try { P.folkCast = VR.GL.program(CAST_VS(multi), CAST_FS, 'folkCast', multi ? ['MULTIDRAW'] : []); P.folkCast.multi = multi; }
    catch (e) { console.error(e); P.folkCast = null; }
    return P.folkCast;
  }
  function ensureCopy(gl, size, wrap) {
    if (SM.tex && SM.gl === gl && SM.size === size) { if (SM.wrap !== wrap) { gl.bindTexture(gl.TEXTURE_2D, SM.tex); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap); SM.wrap = wrap; } return true; }
    FG.dropCopy(gl);
    const GL = VR.GL;
    SM.tex = GL.tex2D(size, size, gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, { filter: gl.LINEAR, compare: true, wrap });
    SM.fb = GL.fbo([], SM.tex);
    if (!SM.fb) { gl.deleteTexture(SM.tex); SM.tex = null; return false; }
    SM.gl = gl; SM.size = size; SM.wrap = wrap; SM.src = null; SM.rects.length = 0;
    return true;
  }
  FG.dropCopy = function (gl) { if (SM.tex && gl) { gl.deleteTexture(SM.tex); if (SM.fb) gl.deleteFramebuffer(SM.fb); } SM.tex = null; SM.fb = null; SM.size = 0; SM.src = null; SM.rects.length = 0; };
  // the write matrices: the lookup matrix, moved by the toroidal offset (and −2 on an axis where a copy wraps), the NDC
  // the receivers' texel would have
  const W = new Float32Array(16), ndc = [0, 0];
  const toNdc = (M, x, y, z, o) => { o[0] = M[0] * x + M[4] * y + M[8] * z + M[12]; o[1] = M[1] * x + M[5] * y + M[9] * z + M[13]; return o; };
  // → true when D is the frame's map (r.shadowRead set): called by renderer.js right after its shadowFrame
  FG.castShadows = function (r, E, cam) {
    r.shadowRead = null;
    const g = FG.game, gl = r.gl;
    // (the casters are last frame's flush: none drawn then — no villagers near, the switch off — none cast now)
    if (!g || FG.shadowMode(g.settings, r.q) !== 'map' || !r.shadowValid || !r.shadowTex || !r.shadowFB || !SM.n || SM.at !== r.frameNo - 1 || !AR.vao || !BT.tex) { if (SM.tex && (!g || FG.shadowMode(g.settings, r.q) !== 'map')) FG.dropCopy(gl); return false; }
    const p = castProgram(r); if (!p) return false;
    const t0 = performance.now(), size = r.shadowSize, wrap = r.sht ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    if (!ensureCopy(gl, size, wrap)) return false;
    const M = r.shadowMat, off = r.shadowOff || [0, 0];
    // the people's footprints (the root raised 0.9, ± 1.3 blocks) in the write NDC, and which wrapped copies they need
    const tpb = 0.5 * size * Math.hypot(M[0], M[4], M[8]), rad = 1.3 * tpb * 2 / size;   // (texels a block; the radius in NDC)
    let need = 0;   // bits: 1 copy (0,0), 2 (−2,0), 4 (0,−2), 8 (−2,−2)
    const fx = [], fy = [];
    for (let i = 0; i < SM.n; i++) {
      toNdc(M, SM.pos[i * 3] - cam.x, SM.pos[i * 3 + 1] + 0.9 - cam.y, SM.pos[i * 3 + 2] - cam.z, ndc);
      const bx = ndc[0] + 2 * off[0], by = ndc[1] + 2 * off[1];
      fx.push(bx); fy.push(by);
      const x0 = bx - rad < 1, x1 = bx + rad > 1, y0 = by - rad < 1, y1 = by + rad > 1;
      if (x0 && y0) need |= 1; if (x1 && y0) need |= 2; if (x0 && y1) need |= 4; if (x1 && y1) need |= 8;
    }
    // the map changed since the last copy: all of it; else last frame's rectangles back
    const renders = r.stats.shadowRenders || 0, changed = SM.src !== r.shadowTex || SM.renders !== renders || (r.sht && r.sht.drawn > 0);
    gl.disable(gl.SCISSOR_TEST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, r.shadowFB); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, SM.fb);
    if (changed) { gl.blitFramebuffer(0, 0, size, size, 0, 0, size, size, gl.DEPTH_BUFFER_BIT, gl.NEAREST); SM.full++; }
    else for (const q of SM.rects) gl.blitFramebuffer(q[0], q[1], q[2], q[3], q[0], q[1], q[2], q[3], gl.DEPTH_BUFFER_BIT, gl.NEAREST);
    SM.src = r.shadowTex; SM.renders = renders;
    // this frame's rectangles (texels), per copy: the union of the people's footprints
    SM.rects.length = 0;
    for (let c = 0; c < 4; c++) {
      if (!(need & (1 << c))) continue;
      const sx = c & 1 ? -2 : 0, sy = c & 2 ? -2 : 0;
      let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
      for (let i = 0; i < fx.length; i++) { a0 = Math.min(a0, fx[i] + sx - rad); a1 = Math.max(a1, fx[i] + sx + rad); b0 = Math.min(b0, fy[i] + sy - rad); b1 = Math.max(b1, fy[i] + sy + rad); }
      const X0 = Math.max(0, Math.floor((a0 * 0.5 + 0.5) * size) - 2), X1 = Math.min(size, Math.ceil((a1 * 0.5 + 0.5) * size) + 2), Y0 = Math.max(0, Math.floor((b0 * 0.5 + 0.5) * size) - 2), Y1 = Math.min(size, Math.ceil((b1 * 0.5 + 0.5) * size) + 2);
      if (X1 > X0 && Y1 > Y0) SM.rects.push([X0, Y0, X1, Y1, sx, sy]);
    }
    // the people into D: depth only, last frame's bones moved to this camera, written nearer the light by the bias
    gl.bindFramebuffer(gl.FRAMEBUFFER, SM.fb);
    gl.viewport(0, 0, size, size);
    // (the culling and the polygon offset as the map's own pass left them, after this one)
    const cull0 = gl.isEnabled(gl.CULL_FACE), poly0 = gl.isEnabled(gl.POLYGON_OFFSET_FILL);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); gl.disable(gl.CULL_FACE); gl.disable(gl.POLYGON_OFFSET_FILL);
    gl.useProgram(p.p);
    gl.activeTexture(gl.TEXTURE0 + FG.BONE_UNIT); gl.bindTexture(gl.TEXTURE_2D, BT.tex); gl.uniform1i(p.u.u_bones, FG.BONE_UNIT);
    gl.uniform3f(p.u.u_shift, SM.cam[0] - cam.x, SM.cam[1] - cam.y, SM.cam[2] - cam.z);
    const zr = 0.5 * Math.hypot(M[2], M[6], M[10]);   // (window depth a block)
    gl.uniform1f(p.u.u_zBias, 2 * (0.0006 + FG.SHADOW_EPS * zr));
    gl.bindVertexArray(AR.vao);
    const ext = p.multi ? VR.GL.ext.multiDraw : null;
    let draws = 0;
    for (const q of SM.rects) {
      W.set(M); const tx = 2 * off[0] + q[4], ty = 2 * off[1] + q[5];
      // (W = T(tx, ty, 0) · M: the translation's x and y rows take tx·w and ty·w)
      for (let k = 0; k < 4; k++) { W[k * 4] += tx * M[k * 4 + 3]; W[k * 4 + 1] += ty * M[k * 4 + 3]; }
      gl.uniformMatrix4fv(p.u.u_shadowW, false, W);
      if (ext) { ext.multiDrawElementsWEBGL(gl.TRIANGLES, SM.counts, 0, gl.UNSIGNED_INT, SM.offsets, 0, SM.n); draws++; }
      else for (let i = 0; i < SM.n; i++) { gl.uniform1i(p.u.u_person, i); gl.drawElements(gl.TRIANGLES, SM.counts[i], gl.UNSIGNED_INT, SM.offsets[i]); draws++; }
    }
    gl.bindVertexArray(null);
    if (cull0) gl.enable(gl.CULL_FACE); if (poly0) gl.enable(gl.POLYGON_OFFSET_FILL);
    r.shadowRead = SM.tex;
    SM.frames++;
    FG.stats.castMs = performance.now() - t0; FG.stats.castDraws = draws; FG.stats.casters = SM.n; FG.stats.castRects = SM.rects.length;
    if (r.stats) r.stats.draws += draws;
    return true;
  };

  // ---------------------------------------------------------------- the people's shadows on the ground
  // A soft dark ellipse under each person drawn (smooth or voxel) within SH_D blocks, stretched away from the sun the lower
  // it stands, multiplied over the ground: one instanced draw for all of them, with Echte Menschen (the shadow map is
  // kept for many frames — moving people in it would leave their shadows behind — and the people take the CPU's terrain
  // shade for their own light, as before). k: the shadow's depth (weaker in the shade of the terrain, at night).
  FG.SH_D = 32;
  const SH_VS = `
layout(location=0) in vec2 a_corner;
layout(location=1) in vec4 a_inst;
layout(location=2) in float a_k;
uniform mat4 u_viewProj;
uniform vec3 u_light;
uniform float u_kMul;
out vec2 v_q;
out float v_a;
void main() {
  // (a negative radius: the round contact shadow under the soles — not stretched from the sun, t-folk2)
  float rr = abs(a_inst.w);
  vec2 s = -normalize(u_light.xz + vec2(1e-4, 0.0));
  float len = a_inst.w < 0.0 ? 1.0 : clamp(0.5 / max(0.12, u_light.y), 1.0, 2.6);
  vec2 t = vec2(-s.y, s.x);
  vec2 c = a_inst.xz + s * rr * (len - 1.0) * 0.85;
  vec2 p = c + s * a_corner.y * rr * len + t * a_corner.x * rr;
  v_q = a_corner;
  v_a = a_k * u_kMul * (1.0 - smoothstep(22.0, 32.0, length(vec3(p.x, a_inst.y, p.y))));
  gl_Position = u_viewProj * vec4(p.x, a_inst.y + 0.03, p.y, 1.0);
}`;
  const SH_FS = `
in vec2 v_q;
in float v_a;
out vec4 o;
void main() { float r = dot(v_q, v_q); if (r > 1.0) discard; float a = 1.0 - r; o = vec4(0.0, 0.0, 0.0, a * a * v_a); }`;
  const SH = { n: 0, data: new Float32Array(5 * 64), vao: null, vbo: null, ibuf: null, cap: 0, prog: undefined };
  FG.shadow = function (pos, cam, r, k) {
    const d = SH.data, n = SH.n;
    if ((n + 1) * 5 > d.length) { const b = new Float32Array(d.length * 2); b.set(d); SH.data = b; }
    const o = n * 5, D = SH.data;
    D[o] = pos[0] - cam.x; D[o + 1] = pos[1] - cam.y; D[o + 2] = pos[2] - cam.z; D[o + 3] = r; D[o + 4] = k;
    SH.n = n + 1;
  };
  FG.drawShadows = function (r, E) {
    const n = SH.n; SH.n = 0;
    if (!n) return 0;
    const gl = r.gl;
    if (SH.prog === undefined) { try { SH.prog = VR.GL.program(SH_VS, SH_FS, 'folkShadow'); } catch (e) { console.error(e); SH.prog = null; } }
    const p = SH.prog; if (!p) return 0;
    if (!SH.vao) {
      SH.vao = gl.createVertexArray(); gl.bindVertexArray(SH.vao);
      SH.vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, SH.vbo); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
      SH.ibuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, SH.ibuf);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 20, 0); gl.vertexAttribDivisor(1, 1);
      gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 20, 16); gl.vertexAttribDivisor(2, 1);
      gl.bindVertexArray(null);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, SH.ibuf);
    if (SH.cap < SH.data.length) { gl.bufferData(gl.ARRAY_BUFFER, SH.data.byteLength, gl.DYNAMIC_DRAW); SH.cap = SH.data.length; }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, SH.data, 0, n * 5);
    gl.useProgram(p.p);
    gl.uniformMatrix4fv(p.u.u_viewProj, false, r.viewProj);
    const sun = E.sunDir[1] > 0.02, L = sun ? E.sunDir : E.moonDir;
    gl.uniform3f(p.u.u_light, L[0], Math.max(0.05, L[1]), L[2]);
    // (by day the sun's; at dusk it fades; by night a faint one under the moon)
    gl.uniform1f(p.u.u_kMul, sun ? 0.45 + 0.55 * Math.min(1, (E.sunDir[1] - 0.02) / 0.2) : 0.4);   // (the contact shadows are drawn with it as well)
    gl.enable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -2);
    gl.bindVertexArray(SH.vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
    gl.bindVertexArray(null);
    gl.disable(gl.POLYGON_OFFSET_FILL); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.BLEND); gl.depthMask(true); gl.enable(gl.CULL_FACE);
    if (r.stats) r.stats.draws++;
    FG.stats.shadows = n;
    return n;
  };

  // ---------------------------------------------------------------- the settings (⚙ Bild · Dinge & Effekte)
  if (VR.Settings && VR.Settings.add) {
    VR.Settings.add({ key: 'smoothFolk', g: 'img', sec: 'objects', t: 'switch', lab: 'g.set.smoothFolk', tip: 'g.set.smoothFolk.tip', cost: 'mid', def: true });
    // (t-folk2: the people in the shadow map — their copy of the map and one depth draw a frame; needs the shadows on)
    VR.Settings.add({ key: 'folkShadow', g: 'img', sec: 'objects', t: 'switch', lab: 'g.set.folkShadow', tip: 'g.set.folkShadow.tip', cost: 'mid', def: true });
  }
})(VR);
