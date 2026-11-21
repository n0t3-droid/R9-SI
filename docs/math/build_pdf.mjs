// Builds docs/R9-SI_Mathematik_und_Physik.pdf from docs/math/r9si_mathematik.html: the formulas typeset with KaTeX (server
// side, so the page needs no script), the hero picture from docs/media, a table of contents from the chapter headings,
// printed by headless Chromium. usage: KATEX=<dir with node_modules/katex> node docs/math/build_pdf.mjs
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { chromium } from '/home/dev/.npm-global/lib/node_modules/playwright/index.mjs';
const ROOT = new URL('../../', import.meta.url).pathname;
const require = createRequire(import.meta.url);
const KDIR = process.env.KATEX || path.join(ROOT, 'node_modules');
const katex = require(path.join(KDIR, 'katex'));
const kcss = fs.readFileSync(path.join(KDIR, 'katex/dist/katex.min.css'), 'utf8')
  .replace(/url\(fonts\//g, 'url(file://' + path.join(KDIR, 'katex/dist/fonts/'));
let src = fs.readFileSync(path.join(ROOT, 'docs/math/r9si_mathematik.html'), 'utf8');
const version = process.env.VERSION || (() => { try { return require('child_process').execSync('git describe --tags --abbrev=0', { cwd: ROOT }).toString().trim(); } catch (e) { return ''; } })();
const hero = process.env.HERO || path.join(ROOT, 'docs/media/shot_vista.jpg');
// formulas
let nF = 0;
const tex = (s, display) => { nF++; return katex.renderToString(s, { displayMode: display, throwOnError: true, strict: 'ignore', output: 'html' }); };
src = src.replace(/<!--[\s\S]*?-->/, '');
src = src.replace(/\\\[([\s\S]+?)\\\]/g, (m, t) => '<div class="eq">' + tex(t, true) + '</div>');
src = src.replace(/\\\(([\s\S]+?)\\\)/g, (m, t) => tex(t, false));
// the table of contents from the h2 headings
const toc = [];
src.replace(/<h2 id="([^"]+)">([^<]+)<\/h2>/g, (m, id, t) => { toc.push(`<li><a href="#${id}">${t}</a></li>`); return m; });
src = src.replace('{{TOC}}', '<ol class="tocl">' + toc.join('') + '</ol>').replace('{{VERSION}}', version).replace('{{DATE}}', new Date().toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' }))
  .replace(/\{\{MEDIA\}\}/g, 'file://' + path.join(ROOT, 'docs/media/')).replace('{{HERO}}', fs.existsSync(hero) ? 'file://' + hero : '');
const css = `
@page { size: A4; margin: 18mm 17mm 18mm 17mm; }
@page :first { margin: 0; }
:root { --ink:#1b2130; --soft:#5b6478; --acc:#0f8a8f; --acc2:#e0752f; --line:#dfe3ea; --tint:#f3f6f9; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: 'DejaVu Serif', Georgia, serif; color: var(--ink); font-size: 10.4pt; line-height: 1.5; margin: 0; }
h1, h2, h3, .kicker, .sub, table, .src, .box b, .tocl { font-family: 'DejaVu Sans', Arial, sans-serif; }
.cover { height: 297mm; width: 210mm; position: relative; page-break-after: always; background: #0c1220; color: #fff; overflow: hidden; }
.cover-img { position: absolute; inset: 0; background-size: cover; background-position: 26% center; }
.cover-img::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(8,12,24,0.05) 30%, rgba(8,12,24,0.92) 78%); }
.cover-text { position: absolute; left: 18mm; right: 18mm; bottom: 24mm; }
.kicker { letter-spacing: 0.14em; text-transform: uppercase; font-size: 9.5pt; color: #7fe3e6; }
.cover h1 { font-size: 64pt; margin: 4mm 0 2mm; letter-spacing: -0.02em; line-height: 1; border: 0; }
.sub { font-size: 19pt; font-weight: 300; max-width: 150mm; line-height: 1.25; }
.meta { margin-top: 9mm; font-size: 9.5pt; color: #c9d2e4; }
.toc { page-break-after: always; }
.tocl { list-style: none; columns: 2; column-gap: 10mm; padding-left: 5mm; font-size: 11pt; line-height: 1.9; }
.tocl a { color: var(--ink); text-decoration: none; }
h2 { font-size: 18pt; color: var(--ink); margin: 0 0 3mm; padding-top: 2mm; border-top: 3px solid var(--acc); page-break-before: always; page-break-after: avoid; }
.toc h2 { page-break-before: auto; }
h3 { font-size: 11.8pt; color: var(--acc); margin: 6mm 0 1.5mm; page-break-after: avoid; }
.lead { font-size: 11.6pt; color: var(--soft); font-style: italic; margin-top: 0; }
.src { font-size: 8pt; color: var(--acc2); margin: -1mm 0 2mm; letter-spacing: 0.02em; }
.src::before { content: 'Quelle: '; color: var(--soft); }
.eq { margin: 2.6mm 0; padding: 2.2mm 3mm; background: var(--tint); border-left: 2px solid var(--acc); overflow: hidden; page-break-inside: avoid; }
.eq .katex-display { margin: 0; }
.katex { font-size: 1.04em; }
table { border-collapse: collapse; width: 100%; margin: 3mm 0; font-size: 9pt; page-break-inside: avoid; }
th { text-align: left; background: #1b2130; color: #fff; padding: 1.6mm 2.5mm; font-weight: 600; }
td { padding: 1.4mm 2.5mm; border-bottom: 1px solid var(--line); }
tr:nth-child(odd) td { background: #fafbfc; }
.box, .note { background: #fff6ee; border: 1px solid #f2d2b8; border-radius: 2mm; padding: 3mm 4mm; margin: 4mm 0; font-size: 9.6pt; page-break-inside: avoid; }
.note { background: var(--tint); border-color: var(--line); }
code { font-family: 'DejaVu Sans Mono', monospace; font-size: 0.88em; background: #eef1f5; padding: 0 1mm; border-radius: 1mm; }
.gallery { page-break-after: always; } .gallery h2.nob { page-break-before: auto; } .g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 2mm; } .g2 img { width: 100%; display: block; border-radius: 1mm; }
.small { font-size: 8.4pt; color: var(--soft); }
`;
const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>R9-SI · Mathematik und Physik</title><style>${kcss}</style><style>${css}</style></head><body>${src}</body></html>`;
const tmp = path.join(process.env.TMPDIR || '/tmp', 'r9si_math_build.html');
fs.writeFileSync(tmp, html);
const out = path.join(ROOT, 'docs/R9-SI_Mathematik_und_Physik.pdf');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 665, height: 1000 } });   // (the A4 column: 210 − 2 × 17 mm at 96 dpi)
await page.goto('file://' + tmp, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
// a formula wider than the column is scaled to fit (never cut)
const fitted = await page.evaluate(() => { let n = 0; for (const e of document.querySelectorAll('.eq')) { const bs = e.querySelectorAll('.katex-html > .base'); if (!bs.length) continue; let l = Infinity, r = -Infinity; for (const b of bs) { const q = b.getBoundingClientRect(); l = Math.min(l, q.left); r = Math.max(r, q.right); } const avail = e.clientWidth - 26; const w = r - l; if (w > avail) { e.style.fontSize = (100 * avail / w).toFixed(1) + '%'; n++; } } return n; });
console.log('scaled to fit: ' + fitted);
await page.pdf({ path: out, format: 'A4', printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true,
  headerTemplate: '<div></div>',
  footerTemplate: '<div style="width:100%;font-family:DejaVu Sans,Arial;font-size:7.5pt;color:#8a93a6;padding:0 17mm;display:flex;justify-content:space-between"><span>R9-SI · Mathematik und Physik</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>' });
await browser.close();
console.log('PDF: ' + out + ' · ' + nF + ' formulas · ' + (fs.statSync(out).size / 1024).toFixed(0) + ' KB');
