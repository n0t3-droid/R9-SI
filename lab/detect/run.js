// ============================================================================
// R9-SI Lab · der Suchlauf: viele Welten, alle Spürhunde, die schlimmsten Fälle mit Bild.
// The scan: for each seed, the places nearest the spawn (villages and towns) and the sky isles round it go through the
// detectors (detectors.js); every find is kept, the worst of each kind get a picture (a map from above and, for crowns, an
// iso view). → lab/out/scan.json (+ lab/out/crops/*.png), read by report.js.
//   node lab/lab.js scan --seeds 3616214791,12345 --vgen 21 [--only roads,doors,crowns,floating,plants,rails] [--sites 4] [--samples 6]
// ============================================================================
'use strict';
const fs = require('fs'), path = require('path');
const W = require('../lib/world.js'), D = require('./detectors.js'), P = require('../lib/png.js');
const PICS = 3;   // pictures per kind and seed (the worst cases)

// the sky isles near (x, z): one entry per isle (its centre, radius and top), the biggest first
function islesNear(g, x, z, r, n) {
  const seen = new Map();
  for (let dz = -r; dz <= r; dz += 24) for (let dx = -r; dx <= r; dx += 24) {
    const I = g.islandAt && g.islandAt(x + dx, z + dz);
    if (!I || I.k < 0.5 || !I.isle || I.isle.designed) continue;
    const k = Math.round(I.isle.x) + ',' + Math.round(I.isle.z);
    if (!seen.has(k)) seen.set(k, { x: Math.round(I.isle.x), z: Math.round(I.isle.z), r: Math.ceil(I.isle.r), top: I.top });
  }
  return [...seen.values()].sort((a, b) => b.r - a.r).slice(0, n);
}

module.exports = async function run(o) {
  const only = o.only ? new Set(o.only) : null, want = (k) => !only || only.has(k);
  const out = { made: new Date().toISOString(), vgen: o.vgen, seeds: [], finds: [] };
  const cropDir = path.join(path.dirname(o.out), 'crops');
  fs.mkdirSync(cropDir, { recursive: true });
  for (const seed of o.seeds) {
    const t0 = Date.now(), g = W.gen(seed, o.vgen);
    const sp = g.findSpawn ? g.findSpawn() : [0, 80, 0];
    const S = { seed, spawn: sp.map(Math.round), places: [], isles: [], counts: {}, checked: {}, ms: 0 };
    const add = (f, where) => { f.seed = seed; f.where = where; out.finds.push(f); S.counts[f.kind] = (S.counts[f.kind] || 0) + 1; };
    const checked = (k, n) => { S.checked[k] = (S.checked[k] || 0) + n; };
    // ---- the places
    for (const site of W.sitesNear(g, sp[0], sp[2], 2500).slice(0, o.sites)) {
      const plan = W.plan(g, site), py = plan.plaza ? plan.plaza.y : g.surfaceY(site.x, site.z) + 1, cx = plan.plaza ? plan.plaza.x : site.x, cz = plan.plaza ? plan.plaza.z : site.z;
      const where = `${site.name} (${site.style})`, rr = Math.min(site.rad || 100, 72);
      const box = { x0: cx - rr, x1: cx + rr, z0: cz - rr, z1: cz + rr, y0: py - 14, y1: py + 34 };
      S.places.push({ name: site.name, style: site.style, x: cx, z: cz, y: py });
      // (the home city, Nova Haven, draws its own kerbs and turning circles in the lanes, the hall city its stairs at a road's end: design)
      if (want('roads')) { const r = D.roads(g, plan); checked('road cells', r.lane); r.finds.filter((f) => !((site.home || site.style === 'hall') && f.kind === 'road-obstacle')).forEach((f) => add(f, where)); }
      if (want('doors')) { const r = D.doors(g, plan); checked('doors', r.doors); r.finds.forEach((f) => add(f, where)); }
      if (want('crowns')) { const r = D.crowns(g, box); checked('crowns', r.clusters); r.finds.forEach((f) => add(f, where)); }
      if (want('floating')) D.floating(g, box).finds.forEach((f) => add(f, where));
      if (want('plants')) D.plantsOnPaving(g, box).finds.forEach((f) => add(f, where));
    }
    // ---- the railways between the places within 1500 blocks
    if (want('rails')) { const r = D.rails(g, sp[0], sp[2], 1500); checked('railway lines', r.lines); r.finds.forEach((f) => add(f, f.info.replace(/^the railway (.*?) runs.*$/, 'railway $1'))); }
    // ---- the sky isles
    for (const I of islesNear(g, sp[0], sp[2], 900, o.samples)) {
      const where = `sky isle at X ${I.x} · Z ${I.z}`, rr = I.r + 8;
      const box = { x0: I.x - rr, x1: I.x + rr, z0: I.z - rr, z1: I.z + rr, y0: I.top - 16, y1: I.top + 26 };
      S.isles.push(I);
      if (want('crowns')) { const r = D.crowns(g, box); checked('crowns', r.clusters); r.finds.forEach((f) => add(f, where)); }
      if (want('floating')) D.floating(g, box).finds.forEach((f) => add(f, where));
    }
    // ---- the worst of each kind with a picture
    const kinds = [...new Set(out.finds.filter((f) => f.seed === seed).map((f) => f.kind))];
    for (const k of kinds) {
      const list = out.finds.filter((f) => f.seed === seed && f.kind === k).sort((a, b) => b.score - a.score);
      // (one picture per neighbourhood: finds within 12 blocks of a pictured one share its picture)
      const shot = [];
      for (const f of list) {
        if (shot.length >= PICS) break;
        const near = shot.find((s) => Math.hypot(s.x - f.x, s.z - f.z) < 12);
        if (near) { f.pic = near.pic; continue; }
        const r = 14, img = require('../tools/map.js')({ g, x0: f.x - r, x1: f.x + r, z0: f.z - r, z1: f.z + r, px: 8, yCap: f.y + 12 });
        // a ring round the find's cell
        ring(img, r * 8, r * 8, 8);
        const file = `${seed}-${k}-${shot.length}.png`;
        P.save(img, path.join(cropDir, file)); f.pic = 'crops/' + file;
        if (k.startsWith('crown')) {
          const iso = P.trim(require('../tools/iso.js')({ g, x0: f.x - 9, x1: f.x + 9, z0: f.z - 9, z1: f.z + 9, y0: f.y - 10, y1: f.y + 8, view: 'south', W: 520, H: 420 }));
          const fi = `${seed}-${k}-${shot.length}-iso.png`; P.save(iso, path.join(cropDir, fi)); f.iso = 'crops/' + fi;
        }
        shot.push(f);
      }
    }
    S.ms = Date.now() - t0;
    out.seeds.push(S);
    console.log(`seed ${seed} (vgen ${o.vgen}): ${S.places.length} places, ${S.isles.length} isles, ${Object.entries(S.counts).map(([k, v]) => k + ' ' + v).join(' · ') || 'no finds'}  [${(S.ms / 1000).toFixed(1)} s]`);
  }
  fs.mkdirSync(path.dirname(o.out), { recursive: true });
  fs.writeFileSync(o.out, JSON.stringify(out, null, 1));
  console.log('wrote', o.out, '·', out.finds.length, 'finds');
  return out;
};
// a red square ring round the cell at pixel (x, y), size px
function ring(img, x, y, px) {
  const c = [230, 40, 60, 255];
  for (let t = -2; t < px + 2; t++) for (const [a, b] of [[x + t, y - 2], [x + t, y + px + 1], [x - 2, y + t], [x + px + 1, y + t]]) {
    if (a < 0 || b < 0 || a >= img.w || b >= img.h) continue;
    img.data.set(c, (b * img.w + a) * 4);
  }
}
