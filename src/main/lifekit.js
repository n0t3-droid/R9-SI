// ============================================================================
// LifeKit (t-life, docs/superpowers/plans/2026-10-09-t-life.md): the small tools the living world's actors share —
// a hash in [0, 1), a polyline you can walk along (the point and the heading d metres in), a folk figure drawn with the
// villagers' rig and clips (folkmodel.js, folkanim.js: a pilot, a lamplighter, a musician, a child), the companions'
// quadruped pose for a cat or a dog that is nobody's pet, and the voxel models of the actors that have none yet (the
// hot-air balloon, the hover-cart, a ball, a lute, the market's goods and awning). Presentation only: nothing here is a
// block, nothing is saved, nothing collides. Every model is our own, built from boxes and ellipsoids here.
// ============================================================================
(function (VR) {
  'use strict';
  const LK = VR.LifeKit = {};
  const TAU = Math.PI * 2;
  // a hash of up to three integers in [0, 1) (the same in every browser: the director and the pads are multiplayer-consistent)
  LK.h = function (a, b, c) {
    let h = Math.imul((a | 0) ^ 0x2c1b3c6d, 0x297a2d39) ^ Math.imul((b | 0) + 0x632be5ab, 0x85ebca6b) ^ Math.imul((c | 0) + 0x5bd1e995, 0xc2b2ae35);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  };
  LK.wrap = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
  LK.smooth = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
  LK.yawOf = (dx, dz) => Math.atan2(-dx, -dz);   // the heading of a direction (the models face −z)

  // ---------------------------------------------------------------- a walkable polyline
  LK.path = function (pts) {
    const s = [0];
    for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]));
    return { pts, s, L: s[s.length - 1] };
  };
  // the point d metres along the path and its heading: out = [x, y, z, yaw]
  LK.along = function (P, d, out) {
    out = out || [0, 0, 0, 0];
    const p = P.pts, s = P.s, n = p.length;
    if (n === 1) { out[0] = p[0][0]; out[1] = p[0][1]; out[2] = p[0][2]; out[3] = 0; return out; }
    let i = 1;
    while (i < n - 1 && s[i] < d) i++;
    const a = p[i - 1], b = p[i], L = s[i] - s[i - 1] || 1e-6, u = Math.max(0, Math.min(1, (d - s[i - 1]) / L));
    out[0] = a[0] + (b[0] - a[0]) * u; out[1] = a[1] + (b[1] - a[1]) * u; out[2] = a[2] + (b[2] - a[2]) * u;
    out[3] = (Math.abs(b[0] - a[0]) + Math.abs(b[2] - a[2]) > 1e-6) ? LK.yawOf(b[0] - a[0], b[2] - a[2]) : (out[3] || 0);
    return out;
  };

  // ---------------------------------------------------------------- folk figures (the villagers' rig)
  // a = { look, pos, yaw, state (a FolkAnim clip: idle · talk · crouch · point · wave · work · carry · cheer · sit),
  //       walk (metres walked: the stride's phase), walkAmt (0 … 1), run, kid, talking, headYaw }
  LK.folk = function (seed, role, age, style) { const F = VR.Folk; return F && F.look ? F.look(seed >>> 0, role, age || 'adult', null, style) : null; };
  LK.drawFolk = function (g, r, prog, a, cam, t) {
    const ent = g.entities, Folk = VR.Folk, FA = VR.FolkAnim;
    if (!ent || !Folk || !FA || !a.look) return false;
    const dx = a.pos[0] - cam.x, dy = a.pos[1] - cam.y, dz = a.pos[2] - cam.z, d2 = dx * dx + dz * dz;
    if (d2 > 72 * 72) return false;
    if (!VR.mat4.boxInFrustum(r.planes, dx - 1, dy - 0.3, dz - 1, dx + 1, dy + 2.2, dz + 1)) return false;
    const far = d2 > 24 * 24, mk = far ? 1 : 0;
    const model = a.mdl && a.mdl[mk] ? a.mdl[mk] : ((a.mdl = a.mdl || [null, null])[mk] = Folk.model(r.gl, a.look, far));
    if (!model) return false;
    const dt = Math.min(0.5, Math.max(0, t - (a.poseT === undefined ? t : a.poseT))); a.poseT = t;
    const P = FA.pose(a, a.state || 'idle', dt, (a.walk || 0) * 3, a.walkAmt || 0, !!a.run, a.poseOut || (a.poseOut = {}));
    if (a.headYaw && P.head) P.head[1] += a.headYaw;
    if (a.shadeT === undefined || t - a.shadeT > 0.3) { a.shade = ent.sunShade(a.pos, 1.2); a.shadeT = t; }
    const light = ent.lightAt(a.pos[0], a.pos[1] + 1.2, a.pos[2]);
    const dp = a.dpos || (a.dpos = [0, 0, 0]);
    dp[0] = a.pos[0]; dp[1] = a.pos[1] - (a.state === 'crouch' ? (a.kid ? 0.14 : 0.24) : a.state === 'sit' ? (a.kid ? 0.2 : 0.3) : 0); dp[2] = a.pos[2];
    const blink = ((t * 0.37 + (a.seed || 0)) % 4) < 0.12, mouth = !!a.talking && Math.sin(t * 13 + (a.seed || 0)) > 0.1;
    ent.drawModel(r, prog, model, dp, cam, a.yaw, P, light, { scale: a.scale || (a.kid ? 0.82 : 1), shade: a.shade, hide: { lids: far || !blink, mouth: far || !mouth } });
    return true;
  };

  // ---------------------------------------------------------------- a cat or a dog that is nobody's pet
  // (the companions' quadruped pose: walk, sit; drink = standing with the head down)
  LK.quadPose = function (q, t) {
    const C = VR.Companions;
    q.pet = q.pet || { state: 'follow' };
    q.pet.state = q.state === 'sit' ? 'sit' : 'follow';
    const P = C && C.poseOf ? C.poseOf(q, t) : {};
    if (q.state === 'drink' && P.head) { P.head[0] = -0.75 + Math.sin(t * 9) * 0.06; if (P.body) P.body[0] = -0.12; }
    return P;
  };
  LK.drawQuad = function (g, r, prog, q, cam, t) {
    const ent = g.entities; if (!ent) return false;
    const dx = q.pos[0] - cam.x, dy = q.pos[1] - cam.y, dz = q.pos[2] - cam.z;
    if (dx * dx + dz * dz > 60 * 60 || !VR.mat4.boxInFrustum(r.planes, dx - 1, dy - 0.3, dz - 1, dx + 1, dy + 1.2, dz + 1)) return false;
    const model = VR.getVoxModel(r.gl, q.kind); if (!model) return false;
    const light = ent.lightAt(q.pos[0], q.pos[1] + 0.5, q.pos[2]);
    ent.drawModel(r, prog, model, q.pos, cam, q.yaw, LK.quadPose(q, t), light, { shade: 0 });
    return true;
  };
  // a plain model (balloon, cart, ball …) at pos with yaw; opts: scale, pitch, roll
  LK.drawModel = function (g, r, prog, kind, pos, yaw, cam, opts) {
    const ent = g.entities; if (!ent) return false;
    const model = VR.getVoxModel(r.gl, kind); if (!model) return false;
    const R0 = (model.def.radius || 2) * ((opts && opts.scale) || 1);
    const dx = pos[0] - cam.x, dy = pos[1] - cam.y, dz = pos[2] - cam.z;
    if (!VR.mat4.boxInFrustum(r.planes, dx - R0, dy - R0, dz - R0, dx + R0, dy + R0 * 2, dz + R0)) return false;
    const light = opts && opts.light ? opts.light : ent.lightAt(pos[0], pos[1] + 1, pos[2]);
    ent.drawModel(r, prog, model, pos, cam, yaw, opts && opts.pose ? opts.pose : null, light, Object.assign({ shade: 0 }, opts || {}));
    return true;
  };

  // ---------------------------------------------------------------- the actors' models (our own; VR.VOXMODELS, built on first use)
  const M = VR.VOXMODELS;
  const Grid = VR.VoxGrid;
  if (M && Grid) {
    const part = (sx, sy, sz, pv, fn) => { const gr = new Grid(sx, sy, sz, pv[0], pv[1], pv[2]); fn(gr); return { grid: gr, pivot: [0, 0, 0] }; };
    // the hot-air balloon (1 voxel = 1/3 m): a striped envelope 10 m wide and 12 m tall, its mouth, the ropes, a wicker
    // basket 1.7 m wide with a burner whose flame glows (the 'flame' part flickers: the director scales it)
    M.life_balloon = () => {
      const st = [0xE8483A, 0xF6D24A, 0xF4F0E6, 0x3A7AD8, 0xF08A2A, 0x5ABF6A];
      const env = part(32, 40, 32, [16, 0, 16], (gr) => {
        for (let y = 0; y < 40; y++) for (let z = 0; z < 32; z++) for (let x = 0; x < 32; x++) {
          const yy = y / 39;   // 0 the mouth … 1 the crown
          // the teardrop: a narrow mouth widening to the belly at 60 % of the height, a round crown
          const rad = 15.5 * (yy < 0.6 ? 0.28 + 0.72 * Math.sin(Math.PI / 2 * yy / 0.6) : Math.sqrt(Math.max(0, 1 - Math.pow((yy - 0.6) / 0.4, 2))));
          const dx = x + 0.5 - 16, dz = z + 0.5 - 16, d = Math.hypot(dx, dz);
          if (d > rad || d < rad - 1.6) continue;   // a shell (the inside is never seen)
          const gore = Math.floor(((Math.atan2(dz, dx) + Math.PI) / TAU) * 12) % 6;
          gr.set(x, y, z, yy > 0.93 ? 0xF4F0E6 : st[gore], 0);
        }
      });
      const basket = part(6, 4, 6, [3, 0, 3], (gr) => { gr.box(0, 0, 0, 5, 3, 5, (x, y, z) => ((x + y + z) & 1 ? 0x9A6A3A : 0x7A4E28)); gr.box(1, 3, 1, 4, 3, 4, 0x4A3220); });
      const ropes = part(14, 8, 14, [7, 0, 7], (gr) => { for (let y = 0; y < 8; y++) { const k = Math.round(2 + y * 0.6); for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) gr.set(7 + sx * Math.min(6, k), y, 7 + sz * Math.min(6, k), 0x3A2A1E); } });
      const flame = part(3, 4, 3, [1, 0, 1], (gr) => { gr.box(0, 0, 0, 2, 1, 2, 0xFF8A1A, { emis: 1 }); gr.set(1, 2, 1, 0xFFD24A, 1); gr.set(1, 3, 1, 0xFFF2A0, 1); });
      return { unit: 3, radius: 7, parts: { basket, ropes, flame, envelope: env }, layout: { basket: [0, 0, 0], ropes: [0, 4, 0], flame: [0, 5, 0], envelope: [0, 11, 0] } };
    };
    // the hover-cart (1 voxel = 1/8 m): a white bed 3 m long on a glowing cyan skirt, crates of produce, an orange canopy
    M.life_cart = () => ({
      unit: 8, radius: 2.4, parts: {
        body: part(14, 15, 26, [7, 0, 13], (gr) => {
          gr.box(1, 1, 0, 12, 3, 25, 0xECEFF3, { shade: 0.06 }); gr.box(0, 0, 1, 13, 0, 24, 0x3AF0FF, { emis: 1 });
          gr.box(1, 4, 0, 12, 6, 1, 0xC4CAD2); gr.box(1, 4, 24, 12, 6, 25, 0xC4CAD2); gr.box(0, 4, 0, 0, 6, 25, 0xC4CAD2); gr.box(13, 4, 0, 13, 6, 25, 0xC4CAD2);
          gr.box(2, 4, 3, 5, 7, 7, 0x9A6A3A); gr.box(2, 8, 3, 5, 8, 7, 0xE8483A); gr.box(7, 4, 3, 11, 7, 8, 0x9A6A3A); gr.box(7, 8, 3, 11, 8, 8, 0xF6D24A);
          gr.box(2, 4, 12, 6, 7, 17, 0x8A5A30); gr.box(2, 8, 12, 6, 8, 17, 0x5ABF6A); gr.box(8, 4, 13, 11, 6, 19, 0x9A6A3A); gr.box(8, 7, 13, 11, 7, 19, 0xF08A2A);
          for (const [x, z] of [[1, 1], [12, 1], [1, 24], [12, 24]]) gr.box(x, 7, z, x, 12, z, 0x6A707A);
          gr.box(0, 13, 0, 13, 13, 25, (x, y, z) => ((z >> 2) & 1 ? 0xF08A2A : 0xF4F0E6)); gr.box(0, 12, 0, 13, 12, 0, 0xF08A2A); gr.box(0, 12, 25, 13, 12, 25, 0xF08A2A);
          gr.box(5, 2, 0, 8, 2, 0, 0xFFF4D8, { emis: 1 });
        }),
      }, layout: { body: [0, 0, 0] },
    });
    // a ball (1 voxel = 1/16 m): red and white
    M.life_ball = () => ({ unit: 16, radius: 0.3, parts: { body: part(6, 6, 6, [3, 0, 3], (gr) => gr.ell(3, 3, 3, 2.9, 2.9, 2.9, (x, y) => (y > 2 ? 0xE8483A : 0xF4F0E6))) }, layout: { body: [0, 0, 0] } });
    // a lute (1 voxel = 1/16 m): a round body, a neck, a sound hole
    M.life_lute = () => ({ unit: 16, radius: 0.6, parts: { body: part(7, 4, 14, [3, 0, 3], (gr) => { gr.ell(3, 2, 3, 3.2, 1.6, 3.4, 0xB0743A); gr.set(3, 3, 3, 0x2A1A10); gr.box(3, 2, 7, 3, 2, 13, 0x6A4422); gr.box(2, 2, 12, 4, 2, 13, 0x4A2E18); }) }, layout: { body: [0, 0, 0] } });
    // the market's goods (1 voxel = 1/8 m): crates of fruit and vegetables and two jars, set on a stall's counter
    M.life_goods = () => ({
      unit: 8, radius: 1.2, parts: {
        body: part(16, 5, 8, [8, 0, 4], (gr) => {
          const fruit = [0xE8483A, 0xF6D24A, 0x5ABF6A, 0xF08A2A];
          for (let k = 0; k < 4; k++) { const x0 = k * 4; gr.box(x0, 0, 0, x0 + 3, 1, 7, 0x9A6A3A); gr.box(x0, 2, 0, x0 + 3, 2, 7, (x, y, z) => ((x + z) & 1 ? fruit[k] : VR.LifeKit.shade(fruit[k], 0.8))); }
          gr.box(1, 3, 2, 2, 4, 3, 0xD8E8F0); gr.box(13, 3, 4, 14, 4, 5, 0xC8A050);
        }),
      }, layout: { body: [0, 0, 0] },
    });
    // the market's awning (1 voxel = 1/8 m): a striped canvas 3 m wide that rolls out from its roller (the director scales
    // its depth from 0 to 1)
    M.life_awning = () => ({ unit: 8, radius: 2, parts: { body: part(24, 2, 12, [12, 0, 0], (gr) => { gr.box(0, 0, 0, 23, 0, 11, (x) => ((x >> 1) & 1 ? 0xE8483A : 0xF4F0E6)); gr.box(0, 1, 11, 23, 1, 11, (x) => ((x >> 1) & 1 ? 0xC8382A : 0xE4E0D6)); gr.box(0, 0, 0, 23, 1, 0, 0x6A707A); }) }, layout: { body: [0, 0, 0] } });
  }
  LK.shade = (c, k) => { const r = Math.min(255, ((c >> 16) & 255) * k) | 0, g = Math.min(255, ((c >> 8) & 255) * k) | 0, b = Math.min(255, (c & 255) * k) | 0; return (r << 16) | (g << 8) | b; };
})(VR);
