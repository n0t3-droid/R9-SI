// regress: skip — marketing pictures for the README and the press page (docs/media/): the game's own Ultra look at a
// moderate view distance (SwiftShader has two cores), six places of seed 53 at their best hour, each frame drawn
// several times so the R9 Super Resolution's history settles, read straight from the canvas.
//   → docs/media/shot_<name>.jpg (W × H, default 1920 × 1080) and docs/media/shots.json (poses, hours, timings)
// usage: nohup bash test/wt_run.sh marketing_shots.mjs 3600 > .tmp_tests/mk.log 2>&1 &
//   W=1920 H=1080 · RD=8 · ONLY=vista,isles · PRESET=ultra
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
import sharp from '/home/dev/.npm-global/lib/node_modules/sharp/lib/index.js';
import fs from 'fs';
const ROOT = new URL('../', import.meta.url).pathname;
const OUT = process.env.OUT || ROOT + 'docs/media/';
fs.mkdirSync(OUT, { recursive: true });
const VW = +(process.env.W || 1920), VH = +(process.env.H || 1080), RD = +(process.env.RD || 8), PRESET = process.env.PRESET || 'ultra';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;
const T0 = Date.now(), secs = () => ((Date.now() - T0) / 1000).toFixed(0) + ' s';
const EYE = 1.62;
// the places (seed 53, vgen 12: the critic's photo picks, test/critic_photo.mjs PICK_SEED 4949)
let SHOTS = [
  { name: 'vista', de: 'Ankunftsblick zur goldenen Stunde', x: 287.3, z: -192.3, at: [2.3, 120.4, -15], tod: 10498 },
  { name: 'isles', de: 'Himmelsinseln am Tag', x: 115.3, z: 26.4, at: [220.8, 176.9, 106], tod: 8200 },
  { name: 'pond', de: 'Teich am Morgen', x: -219.6, z: -179.5, at: [-232, 80.5, -182], tod: 5599 },
  { name: 'pier', de: 'Am Steg', feet: 66.2, x: 270.4, z: 73.9, at: [285, 63.5, 80], tod: 6451 },
  { name: 'citadel', de: 'Turmzitadelle bei Nacht', x: -307.6, z: -233.1, at: [-419.6, 215.1, 380], tod: 18098 },
  { name: 'aurora', de: 'Nova Haven bei Nacht', x: -18.3, z: -130.0, at: [5.9, 158.5, -290], tod: 19492, aurora: true },
];
if (process.env.SHOTS_JSON) SHOTS = JSON.parse(process.env.SHOTS_JSON);   // (a list of {name, de, x, z, at, tod} of its own)
if (ONLY) SHOTS = SHOTS.filter(s => ONLY.includes(s.name));
const aimAt = (x, y, z, at) => { const dx = at[0] - x, dy = at[1] - y, dz = at[2] - z; return [Math.atan2(-dx, -dz), Math.atan2(dy, Math.hypot(dx, dz))]; };

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: VW, height: VH }, locale: 'de-DE' });
const logs = []; page.on('pageerror', e => logs.push(e.message)); page.on('console', m => { if (m.type() === 'error') logs.push(m.text().slice(0, 300)); });
await page.goto('file://' + ROOT + 'dist/index.html');
const ev = (f, a) => page.evaluate(f, a), wait = (ms) => page.waitForTimeout(ms);
for (let i = 0; i < 240; i++) { await wait(500); if (await ev(() => !!(window.VR && VR.game && VR.game.state === 'title'))) break; }
await ev(([p, rd, set]) => { const g = VR.game; g.applyPreset(p); g.settings.dynRes = false; g.settings.renderDist = rd; Object.assign(g.settings, set); g.applySettings('*'); }, [PRESET, RD, JSON.parse(process.env.SET_JSON || '{}')]);
await ev(`VR.game.createWorld({name:'Galerie',mode:'creative',difficulty:'peaceful',type:'default',seed:'53',cheats:true})`);
for (let i = 0; i < 300; i++) { await wait(500); if (await ev(() => VR.game.state === 'play')) break; }
console.log('world (' + secs() + ')');
await ev(() => {
  const g = VR.game; window.requestAnimationFrame = () => 0; g.hideHud = true; g.zenFreezeTime = true; g.zenFreezeWeather = true; g.settings.wowMoments = false;
  if (g.arrival && g.arrival.skip) { try { g.arrival.skip(); } catch (e) { /* none */ } }
  const st = document.createElement('style'); st.textContent = '#hint,#hints,#lockhint,#ui .toast{display:none !important}'; document.head.appendChild(st);
});
const auroraDay = await ev(() => { const S3 = VR.Sky3, s = VR.game.env.wx ? VR.game.env.wx.seed : 0; if (!S3 || !S3.auroraNight) return null; for (let n = 1; n < 80; n++) if (S3.auroraNight(s, n) > 0) return n; return null; });
// the loop without drawing (streaming, simulation), and with drawing (the picture)
const frames = (n, draw) => ev(([n, draw]) => { const g = VR.game, r = g.renderer; if (!r._render) { r._render = r.render; r.render = function (F) { if (!window.__draw) { this.setupCamera(F.cam); return; } return this._render(F); }; } window.__draw = draw; for (let i = 0; i < n; i++) { g.last = performance.now() - 33; g.loop(performance.now()); } window.__draw = false; }, [n, draw]);
const settle = async (maxS) => { const t0 = Date.now(); for (let i = 0; ; i++) { if (i % 200 === 0 && i) console.log("    settle " + i + " " + Math.round((Date.now() - t0) / 1000) + " s"); await frames(6, false); await wait(80); const q = await ev(() => { const g = VR.game, w = g.world; let dirty = 0; for (const c of w.cols.values()) for (const s of c.sec) if ((s.dirty || s.pending) && s.count > 0) dirty++; return { dirty, busy: g.pool.busy | 0, pend: w.pending.size, up: w.uploadQ ? w.uploadQ.size || w.uploadQ.length || 0 : 0 }; }); if ((i > 6 && !q.dirty && !q.busy && !q.pend && !q.up) || (Date.now() - t0) / 1000 > maxS) return q; } };
// (the world never quite rests at Ultra on two cores: the far land keeps a section or two in flight; the cap ends it)
const groundY = (x, z) => ev(([x, z]) => { const w = VR.game.world, R = VR.R, F = VR.F; for (let y = 230; y > 30; y--) { const s = w.getBlock(Math.floor(x), y, Math.floor(z)); if (s && (R.T.flags[s] & (F.OPAQUE | F.FLUID)) && !(R.T.flags[s] & F.LEAVES)) return y; } return 80; }, [x, z]);
const rec = { preset: PRESET, rd: RD, size: [VW, VH], shots: [] };
for (const S of SHOTS) {
  const t1 = Date.now();
  await ev(([x, z]) => { const p = VR.game.player; p.flying = true; p.noclip = true; p.teleport(x, 160, z); }, [S.x, S.z]);
  await settle(240);
  const feet = S.feet !== undefined ? S.feet : (await groundY(S.x, S.z)) + 1;
  let [yaw, pitch] = aimAt(S.x, feet + EYE, S.z, S.at);
  // nothing solid round the eye or in the first blocks of the view (critic_photo.mjs's rule): up, else back along the view
  const C2 = await ev(([x, y, z, yaw, pitch]) => {
    const w = VR.game.world, R = VR.R, F = VR.F;
    const fl = (x, y, z) => { const s = w.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)); return s ? R.T.flags[s] : 0; };
    const cp = Math.cos(pitch), dx = -Math.sin(yaw) * cp, dy = Math.sin(pitch), dz = -Math.cos(yaw) * cp, hx = Math.hypot(dx, dz) || 1;
    const box = (x, y, z) => { for (const b of [-0.6, 0, 0.9]) for (let a = -1; a <= 1; a++) for (let c = -1; c <= 1; c++) if (fl(x + a * 0.9, y + b, z + c * 0.9) & F.SOLID) return false; return true; };
    const ray1 = (x, y, z, ex, ez, far) => { for (let t = 0.5; t <= far; t += 0.25) if (fl(x + ex * t, y + dy * t, z + ez * t) & (F.OPAQUE | F.LEAVES | F.SOLID)) return false; return true; };
    // (v0.55.92: the centre and ±18° clear for 24 blocks — a big crown beside the eye filled half the vista before)
    const ray = (x, y, z) => { if (!ray1(x, y, z, dx, dz, 24)) return false; for (const a of [-0.31, 0.31]) { const c = Math.cos(a), s = Math.sin(a); if (!ray1(x, y, z, dx * c - dz * s, dx * s + dz * c, 18)) return false; } return true; };
    for (let back = 0; back <= 12; back += 2) { const bx = x - dx / hx * back, bz = z - dz / hx * back; for (let up = 0; up <= 24; up++) if (box(bx, y + up, bz) && ray(bx, y + up, bz)) return { x: bx, y: y + up, z: bz }; }
    return { x, y, z };
  }, [S.x, feet + EYE, S.z, yaw, pitch]);
  S.x = C2.x; S.z = C2.z; const feet2 = C2.y - EYE; [yaw, pitch] = aimAt(S.x, feet2 + EYE, S.z, S.at);
  await ev(([x, y, z, yaw, pitch, tod, aur, ad]) => { const g = VR.game, E = g.env, p = g.player; if (aur && ad) E.day = ad; E.setTime(tod); if (E.wx && E.wx.force) E.wx.force('klar'); E.rain = 0; E.rainTarget = 0; p.teleport(x, y, z); p.yaw = p.viewYaw = yaw; p.pitch = pitch; p.vel = [0, 0, 0]; }, [S.x, feet2, S.z, yaw, pitch, S.tod, !!S.aurora, auroraDay]);
  const q = await settle(240);
  await frames(90, false);   // three seconds of life: animals, clouds, water
  await ev((tod) => VR.game.env.setTime(tod), S.tod);
  await frames(14, true);    // the history of the super resolution, the shadow map, the reflections
  const url = await ev(() => { const g = VR.game; g.last = performance.now() - 33; window.__draw = true; g.loop(performance.now()); window.__draw = false; return g.renderer.gl.canvas.toDataURL('image/png'); });
  const buf = Buffer.from(url.split(',')[1], 'base64');
  await sharp(buf).jpeg({ quality: 92, mozjpeg: true }).toFile(OUT + 'shot_' + S.name + '.jpg');
  const r = { name: S.name, de: S.de, pos: [S.x, feet, S.z], yaw, pitch, tod: S.tod, settle: q, s: Math.round((Date.now() - t1) / 1000) };
  rec.shots.push(r); fs.writeFileSync(OUT + 'shots.json', JSON.stringify(rec, null, 1));
  console.log('  ✓ ' + S.name + ' — ' + S.de + ' (' + r.s + ' s, ' + secs() + ')');
}
if (logs.length) console.log('page errors: ' + logs.slice(0, 3).join(' | '));
await browser.close();
console.log('ALL OK');
