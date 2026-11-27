#!/usr/bin/env node
// ============================================================================
// R9-SI Lab — das Testlabor des Spiels (Weltlabor, Spürhunde, PC-Emulator, Berichte). Ein Einstieg für alles:
// The game's test lab (world lab, detectors, PC emulator, reports). One entry point:
//   node lab/lab.js map      --seed S [--vgen V] (--at X,Z | --place NAME) [--r 40] [--px 6] [--ycap 120] [--out file.png]
//   node lab/lab.js iso      --seed S [--vgen V] (--at X,Z | --place NAME) [--r 24] [--y0 Y --y1 Y] [--view south] [--out ...]
//   node lab/lab.js compare  --seed S --vgen A,B (--at X,Z | --place NAME) [--kind map|iso] [--out ...]
//   node lab/lab.js places   --seed S [--vgen V] [--at X,Z] [--r 2000]        the villages and towns near a point
//   node lab/lab.js scan     [--seeds a,b,c] [--vgen V] [--only roads,doors,crowns,floating,plants,rails] [--out lab/out/scan.json]
//   node lab/lab.js report   [--in scan21.json,scan22.json] [--emu lab/out/emu.json] [--out lab/out/report.html]
//   node lab/lab.js why      --seed S [--vgen V] --at X,Y,Z                 which generator line put that block there
//   bash lab/emu/run.sh      [--profiles office,old-laptop,potato] [--scenes town,sea,flight]   (the PC emulator: a browser)
// Without --vgen: the version a new world gets (read from src/main/game.js).
// ============================================================================
'use strict';
const path = require('path');
const args = process.argv.slice(2), cmd = args[0];
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 && i + 1 < args.length ? args[i + 1] : d; };
const OUT = path.join(__dirname, 'out');
function where(W, g) {
  const at = opt('at'), place = opt('place');
  if (place) { const s = W.findSite(g, { name: place, r: +opt('search', 4000) }); if (!s) throw new Error('no place called ' + place + ' within 4000 blocks of 0, 0'); const p = W.plan(g, s); return { x: p.plaza ? p.plaza.x : s.x, z: p.plaza ? p.plaza.z : s.z, y: p.plaza ? p.plaza.y : null, site: s, plan: p }; }
  if (at) { const [x, z] = at.split(',').map(Number); return { x, z, y: null }; }
  return { x: 0, z: 0, y: null };
}
async function main() {
  if (!cmd || cmd === 'help' || cmd === '--help') { console.log(require('fs').readFileSync(__filename, 'utf8').split('\n').filter(l => l.startsWith('//')).slice(1).join('\n').split('\n// ====')[0].split('\n').map(l => l.slice(3)).join('\n')); return; }
  const W = require('./lib/world.js'), P = require('./lib/png.js');
  const seed = +opt('seed', 3616214791), vg = opt('vgen') ? opt('vgen').split(',').map(Number) : [W.newestVgen()];
  if (cmd === 'places') {
    const g = W.gen(seed, vg[0]), c = where(W, g), r = +opt('r', 2000);
    for (const s of W.sitesNear(g, c.x, c.z, r)) console.log(`${s.name.padEnd(16)} ${String(s.style).padEnd(8)} X ${s.x} · Z ${s.z}   (${Math.round(Math.hypot(s.x - c.x, s.z - c.z))} m)`);
    return;
  }
  if (cmd === 'map' || cmd === 'iso' || cmd === 'compare') {
    const kind = cmd === 'compare' ? opt('kind', 'map') : cmd, imgs = [];
    for (const v of vg) {
      const g = W.gen(seed, v), c = where(W, g), r = +opt('r', kind === 'iso' ? 24 : 40);
      if (kind === 'map') imgs.push(require('./tools/map.js')({ g, x0: c.x - r, x1: c.x + r, z0: c.z - r, z1: c.z + r, px: +opt('px', 6), yCap: opt('ycap') !== undefined ? +opt('ycap') : (c.y ? c.y + 40 : 255) }));
      else {
        const yb = c.y || W.top(g, c.x, c.z, 200).y;
        imgs.push(P.trim(require('./tools/iso.js')({ g, x0: c.x - r, x1: c.x + r, z0: c.z - r, z1: c.z + r, y0: +opt('y0', yb - 10), y1: +opt('y1', yb + 26), view: opt('view', 'south'), W: +opt('w', 1200), H: +opt('h', 900) })));
      }
    }
    const img = imgs.length > 1 ? P.row(imgs, 16) : imgs[0];
    const out = opt('out', path.join(OUT, `${cmd}-${seed}-${vg.join('-')}.png`));
    P.save(img, out); console.log('wrote', out, img.w + '×' + img.h);
    return;
  }
  if (cmd === 'scan') { await require('./detect/run.js')({ seeds: (opt('seeds', '3616214791,12345,53,777,424242,2024')).split(',').map(Number), vgen: vg[0], only: opt('only') ? opt('only').split(',') : null, out: opt('out', path.join(OUT, 'scan.json')), sites: +opt('sites', 4), samples: +opt('samples', 6) }); return; }
  if (cmd === 'why') {
    const [x, y, z] = opt('at', '0,64,0').split(',').map(Number);
    const r = require('./tools/why.js')({ seed, vgen: vg[0], x, y, z, dy: +opt('dy', 3) });
    if (!r.site) { console.log('no village or town covers X ' + x + ' · Z ' + z + ' (block there: ' + r.block + ')'); return; }
    console.log(`${r.site.name} (${r.site.style}) · block at ${x},${y},${z}: ${r.block}\n  column: ${r.column.join(' ')}`);
    for (const e of r.events) console.log(`  ${e.kind === 'fill' ? 'fill ' + e.y0 + '..' + e.y1 : 'put  ' + e.y}  ${e.block.padEnd(22)} ← ${e.at.join(' ← ')}`);
    return;
  }
  if (cmd === 'report') { require('./report/report.js')({ scan: opt('in', path.join(OUT, 'scan.json')), emu: opt('emu', path.join(OUT, 'emu.json')), out: opt('out', path.join(OUT, 'report.html')) }); return; }
  console.log('unknown command: ' + cmd + ' (node lab/lab.js help)');
}
main().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
