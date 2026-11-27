// ============================================================================
// R9-SI Lab · der Bericht: was die Spürhunde fanden und wie der PC-Emulator lief — eine HTML-Seite ohne Netz.
// The report: what the detectors found (one or more scans, side by side — before and after a generator version) and how
// the PC emulator ran (frame rates, frame times, Smart Quality's steps, the forecast's error), as one self-contained HTML
// page (pictures inlined), German first.
//   node lab/lab.js report [--in lab/out/scan21.json,lab/out/scan22.json] [--emu lab/out/emu.json] [--out lab/out/report.html]
// ============================================================================
'use strict';
const fs = require('fs'), path = require('path');
const KINDS = {
  'road-bump': ['Erde auf der Straße', 'ground on the road', 'Ein Hof über der Straße füllte Erde auf das Pflaster.', 'A yard above its street filled earth onto the paving.'],
  'road-hole': ['Loch in der Straße', 'hole in the road', 'Eine Zelle der Straßenbreite blieb nackter Boden.', 'A cell of the road\'s width stayed bare ground.'],
  'road-obstacle': ['Hindernis auf der Fahrbahn', 'obstacle in a lane', 'Laterne, Palme, Hecke oder Hofpflaster steht in der Fahrbahn.', 'A lamp, palm, hedge or yard paving stands in a lane.'],
  'rail-in-town': ['Bahn mitten im Ort', 'railway inside a place', 'Die Himmelsbahn rampt durch Straßen und Häuser hinab.', 'The sky rail ramps down through streets and houses.'],
  'door-high': ['Tür zu hoch', 'door too high', 'Auf dem Weg aus der Tür fällt der Boden zwei Blöcke oder mehr.', 'The ground drops two blocks or more on the way out of the door.'],
  'door-walled': ['Tür zugemauert', 'door walled in', 'Auf dem Weg aus der Tür stehen feste Blöcke.', 'Solid blocks stand on the way out of the door.'],
  'door-wet': ['Tür ins Wasser', 'door into water', 'Der Platz vor der Tür liegt im Wasser (im Becken des Brunnens).', 'The spot in front of the door lies in water (the fountain\'s basin).'],
  'crowns-fused': ['Kronen verwachsen', 'crowns grown together', 'Zwei Baumarten teilen eine Krone.', 'Two kinds of tree share one crown.'],
  'crown-floating': ['Krone in der Luft', 'floating crown', 'Laub ohne Stamm und ohne Halt.', 'Leaves with no trunk and nothing under them.'],
  'plant-on-paving': ['Pflanze auf Pflaster', 'plant on paving', 'Gras oder Blume steht auf einem Weg.', 'Grass or a flower stands on a path.'],
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const n0 = (x) => (x === null || x === undefined ? '–' : String(x));
function img(file, dir) {
  try { const p = path.isAbsolute(file) ? file : path.join(dir, file); return 'data:image/png;base64,' + fs.readFileSync(p).toString('base64'); } catch (e) { return null; }
}
// a small line chart (inline SVG): series [{ values, color, label }], y from 0
function chart(series, w, h, yMax, unit) {
  const n = Math.max(...series.map((s) => s.values.length)); if (!n) return '';
  const top = yMax || Math.max(1, ...series.flatMap((s) => s.values.filter(Number.isFinite)));
  const X = (i) => 34 + (i / Math.max(1, n - 1)) * (w - 40), Y = (v) => h - 18 - Math.min(1, v / top) * (h - 28);
  let g = `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img"><line x1="34" y1="${h - 18}" x2="${w - 6}" y2="${h - 18}" class="axis"/><text x="30" y="${Y(top) + 4}" class="tick" text-anchor="end">${Math.round(top)}${unit || ''}</text><text x="30" y="${h - 14}" class="tick" text-anchor="end">0</text>`;
  for (const s of series) {
    const pts = s.values.map((v, i) => Number.isFinite(v) ? `${X(i).toFixed(1)},${Y(v).toFixed(1)}` : null).filter(Boolean).join(' ');
    g += `<polyline fill="none" stroke="${s.color}" stroke-width="1.6" points="${pts}"><title>${esc(s.label)}</title></polyline>`;
  }
  return g + '</svg>';
}

module.exports = function report(o) {
  const scans = String(o.scan || '').split(',').filter(Boolean).filter((f) => fs.existsSync(f)).map((f) => ({ f, d: JSON.parse(fs.readFileSync(f, 'utf8')) }));
  const emu = o.emu && fs.existsSync(o.emu) ? JSON.parse(fs.readFileSync(o.emu, 'utf8')) : null;
  let body = '';
  // ---- the detectors
  if (scans.length) {
    const kinds = [...new Set(scans.flatMap((s) => s.d.finds.map((f) => f.kind)))].sort((a, b) => Object.keys(KINDS).indexOf(a) - Object.keys(KINDS).indexOf(b));
    body += `<section><h2>Spürhunde <span class="en">Detectors</span></h2><p>${scans.map((s) => `<b>vgen ${s.d.vgen}</b>: ${s.d.seeds.length} Welten · ${s.d.seeds.reduce((a, x) => a + x.places.length, 0)} Orte · ${s.d.seeds.reduce((a, x) => a + x.isles.length, 0)} Himmelsinseln`).join(' &nbsp;|&nbsp; ')}</p>`;
    body += '<table><thead><tr><th>Fund <span class="en">find</span></th>' + scans.map((s) => `<th class="num">vgen ${s.d.vgen}</th>`).join('') + '</tr></thead><tbody>';
    for (const k of kinds) {
      const K = KINDS[k] || [k, k, '', ''];
      body += `<tr><td><b>${esc(K[0])}</b> <span class="en">${esc(K[1])}</span><div class="sub">${esc(K[2])} <span class="en">${esc(K[3])}</span></div></td>` + scans.map((s) => { const c = s.d.finds.filter((f) => f.kind === k).length; return `<td class="num ${c ? 'bad' : 'good'}">${c}</td>`; }).join('') + '</tr>';
    }
    const checked = {}; for (const s of scans) for (const x of s.d.seeds) for (const [k, v] of Object.entries(x.checked || {})) { checked[s.d.vgen] = checked[s.d.vgen] || {}; checked[s.d.vgen][k] = (checked[s.d.vgen][k] || 0) + v; }
    body += `<tr class="foot"><td>geprüft <span class="en">checked</span></td>` + scans.map((s) => `<td class="num sub">${Object.entries(checked[s.d.vgen] || {}).map(([k, v]) => `${v} ${esc(k)}`).join('<br>')}</td>`).join('') + '</tr></tbody></table>';
    // the worst cases with their pictures (from the first scan that has finds of the kind)
    for (const k of kinds) {
      const s = scans.find((x) => x.d.finds.some((f) => f.kind === k && f.pic)); if (!s) continue;
      const dir = path.dirname(s.f), shown = new Set(), cards = [];
      for (const f of s.d.finds.filter((x) => x.kind === k && x.pic).sort((a, b) => b.score - a.score)) {
        if (shown.has(f.pic) || cards.length >= 3) continue; shown.add(f.pic);
        const a = img(f.pic, dir), b = f.iso ? img(f.iso, dir) : null;
        cards.push(`<figure>${a ? `<img src="${a}" alt="">` : ''}${b ? `<img src="${b}" alt="">` : ''}<figcaption><b>${esc(f.where)}</b> · X ${f.x} · Y ${f.y} · Z ${f.z}<br>${esc(f.info)} <span class="sub">(seed ${f.seed}, vgen ${s.d.vgen})</span></figcaption></figure>`);
      }
      if (cards.length) body += `<h3>${esc((KINDS[k] || [k])[0])} <span class="en">${esc((KINDS[k] || [k, k])[1])}</span></h3><div class="figs">${cards.join('')}</div>`;
    }
    body += '</section>';
  }
  // ---- the PC emulator
  if (emu) {
    body += `<section><h2>PC-Emulator <span class="en">PC emulator</span></h2><p>${esc(emu.version)} · Seed ${esc(emu.seed)} (vgen ${emu.vgen}) · ${emu.seconds} s je Szene <span class="en">per scene</span> · Smart Quality an <span class="en">on</span>. <span class="sub">Gebremst wird der Prozessor (Chromes CPU-Drosselung); das Bild zeichnet SwiftShader in Software — die Zahlen vergleichen Builds und Profile, sie versprechen nichts für einen echten PC. <span class="en">The processor is slowed (Chrome's CPU throttling); SwiftShader draws the picture in software — the numbers compare builds and profiles, they promise nothing for a real PC.</span></span></p>`;
    for (const p of emu.profiles) {
      body += `<div class="card"><h3>${esc(p.de || p.id)} <span class="en">${esc(p.en || p.id)}</span> <span class="sub">CPU ÷${p.cpu} · ${p.w}×${p.h} · ${esc(p.preset)} · Laden <span class="en">load</span> ${n0(p.loadS)} s</span></h3>`;
      body += '<table><thead><tr><th>Szene <span class="en">scene</span></th><th class="num">fps</th><th class="num">Frame p50</th><th class="num">p95</th><th class="num">Ruckler <span class="en">hitches</span></th><th>Smart Quality</th><th class="num">Vorhersage <span class="en">forecast</span></th><th class="num">Land fertig <span class="en">land drawn</span></th></tr></thead><tbody>';
      for (const s of p.scenes) {
        const S = s.summary;
        const steps = S.steps.length ? S.steps.map((x) => `${x.kind === 'down' ? '↓' : '↑'}${esc(x.to || '∅')} <span class="sub">@${x.t}s</span>`).join(' ') : '–';
        body += `<tr><td>${esc(s.id)}</td><td class="num">${n0(S.fps)}</td><td class="num">${n0(S.frameP50)} ms</td><td class="num">${n0(S.frameP95)} ms</td><td class="num">${S.hitches}</td><td>${steps}${S.early ? ` <span class="sub">· früh <span class="en">early</span> ${S.early}</span>` : ''}${S.held ? ` <span class="sub">· gehalten <span class="en">held</span> ${S.held}</span>` : ''}</td><td class="num">${S.forecast.n ? `±${n0(S.forecast.maeMs)} ms <span class="sub">(${S.forecast.biasMs > 0 ? '+' : ''}${n0(S.forecast.biasMs)})</span>` : '–'}</td><td class="num">${S.shownMean !== undefined && S.shownMean !== null ? `${S.shownMean} % <span class="sub">(≥ ${n0(S.shownMin)} %)</span>` : '–'}</td></tr>`;
      }
      body += '</tbody></table><div class="charts">';
      for (const s of p.scenes) {
        const ft = s.samples.map((x) => (x.dts.length ? x.dts.reduce((a, b) => a + b, 0) / x.dts.length : NaN));
        const depth = s.samples.map((x) => x.stack.length * 10);
        body += `<div><div class="sub">${esc(s.id)}: Frame-Zeit <span class="en">frame time</span> (ms) · <span style="color:var(--accent2)">Stufen ×10 <span class="en">rungs ×10</span></span></div>${chart([{ values: ft, color: 'var(--accent)', label: 'frame ms' }, { values: depth, color: 'var(--accent2)', label: 'Smart Quality rungs ×10' }], 360, 120, null, '')}</div>`;
      }
      if (p.pruef && p.pruef.lines) body += `<div class="sub" style="margin-top:8px"><b>/prüfstand</b> <span class="en">test bench</span>:<br>${p.pruef.lines.map(esc).join('<br>')}</div>`;
      body += '</div>' + (p.errors && p.errors.length ? `<p class="bad">Fehler <span class="en">errors</span>: ${p.errors.slice(0, 3).map(esc).join('<br>')}</p>` : '') + '</div>';
    }
    body += '</section>';
  }
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>R9-SI Lab Bericht</title><style>
:root{--bg:#f6f7f9;--fg:#1d2330;--sub:#5b6474;--card:#fff;--line:#dfe3ea;--accent:#2f6fde;--accent2:#d9822b;--good:#1f8a4c;--bad:#c2410c}
@media (prefers-color-scheme:dark){:root{--bg:#12151b;--fg:#e6e9ef;--sub:#9aa3b2;--card:#1b2029;--line:#2c3340;--accent:#6ea0ff;--accent2:#f0a451;--good:#4cc282;--bad:#ff8a5c}}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif}main{max-width:1080px;margin:0 auto;padding:24px 16px}
h1{font-size:26px;margin:0 0 4px}h2{margin:28px 0 8px;font-size:20px}h3{margin:18px 0 8px;font-size:16px}.en{color:var(--sub);font-weight:400}.sub{color:var(--sub);font-size:13px}
table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:8px;overflow:hidden;margin:8px 0}th,td{padding:7px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}th{font-size:13px;color:var(--sub);font-weight:600}
.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.good{color:var(--good)}.bad{color:var(--bad)}.foot td{font-size:12px}
.figs{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}figure{margin:0;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:8px}figure img{max-width:100%;display:block;margin:0 auto 6px;image-rendering:pixelated}figcaption{font-size:13px}
.card{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:4px 14px 12px;margin:12px 0}.card table{border:none}
.charts{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px}.chart{width:100%;height:auto}.chart .axis{stroke:var(--line)}.chart .tick{fill:var(--sub);font-size:10px}
</style></head><body><main><h1>R9-SI Lab · Bericht <span class="en">report</span></h1><div class="sub">${esc(new Date().toISOString().slice(0, 16).replace('T', ' '))} UTC</div>${body || '<p>Noch keine Daten. <span class="en">No data yet.</span></p>'}</main></body></html>`;
  fs.mkdirSync(path.dirname(o.out), { recursive: true });
  fs.writeFileSync(o.out, html);
  console.log('wrote', o.out, Math.round(html.length / 1024) + ' KB');
  return o.out;
};
