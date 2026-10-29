// R9 build · the player pages without comments and indentation (f-build, docs/superpowers/plans/2026-10-23-f-build.md,
// review R50-09: 1.8 MB of comment lines went to every player). build.js writes every player page through Strip.page;
// dist/index.debug.html keeps the source text.
//   Strip.js(src[, opts])  one script: comments and layout out, every token as it was; the GLSL in template literals
//                          without its comments and indentation. Every newline stays, so the stripped page has the debug
//                          page's line numbers (a stack trace or a shader compile error maps 1:1).
//                          opts.info (an object) receives { glsl: n, glslAt: [source offsets of the GLSL quasis] };
//                          opts.module: the script is a module (no HTML-like comments there).
//   Strip.page(html)       every inline classic or js-worker script of a page through Strip.js, the rest byte for byte.
// The browser's parser decides what the code means; this tokenizer only has to agree with it on where comments,
// strings, template literals and regular expressions begin and end (test/strip.js holds it to acorn's tokens over every
// source file). A token that does not end (a string, a template, a comment, a regular expression) throws: the build
// stops rather than ship a page that does not parse.
(function (root) {
  'use strict';

  // keywords after which an expression begins (a "/" there starts a regular expression)
  const KW_EXPR = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await', 'extends']);
  // the heads whose closing ")" is followed by a statement (where "/" starts a regular expression)
  const KW_CTRL = new Set(['if', 'while', 'for', 'with']);

  // ASCII classes: 1 identifier start, 2 identifier part, 4 blank (outside ASCII: the Unicode blanks; the rest of
  // the non-ASCII characters outside strings and comments are identifier characters)
  const CC = new Uint8Array(128);
  for (let c = 0; c < 128; c++) {
    if ((c >= 97 && c <= 122) || (c >= 65 && c <= 90) || c === 36 || c === 95 || c === 92) CC[c] |= 3;
    if (c >= 48 && c <= 57) CC[c] |= 2;
    if (c === 32 || c === 9 || c === 11 || c === 12) CC[c] |= 4;
  }
  const isWs = (c) => (c < 128 ? (CC[c] & 4) !== 0 : c === 0xA0 || c === 0xFEFF || c === 0x1680 || (c >= 0x2000 && c <= 0x200A) || c === 0x202F || c === 0x205F || c === 0x3000);
  const isNl = (c) => c === 10 || c === 13 || c === 0x2028 || c === 0x2029;
  const isDigit = (c) => c >= 48 && c <= 57;
  const isIdStart = (c) => (c < 128 ? (CC[c] & 1) !== 0 : !isWs(c) && !isNl(c));
  const isIdPart = (c) => (c < 128 ? (CC[c] & 2) !== 0 : !isWs(c) && !isNl(c));

  // ---------------------------------------------------------------- GLSL in a template literal
  // a template is GLSL when a line starts with a GLSL declaration or directive, and it holds no HTML tag and no URL
  const GLSL_LINE = /(?:^|\n)[ \t]*(?:#[ \t]*(?:version|define|undef|ifdef|ifndef|if|elif|else|endif|extension|pragma)\b|precision[ \t]+(?:lowp|mediump|highp)\b|uniform[ \t]+\w|layout[ \t]*\(|(?:(?:flat|smooth|centroid|invariant)[ \t]+)*(?:in|out|varying|attribute)[ \t]+(?:(?:lowp|mediump|highp)[ \t]+)?(?:float|int|uint|bool|[iub]?vec[234]|mat[234](?:x[234])?)\b|(?:(?:lowp|mediump|highp)[ \t]+)?(?:void|float|int|uint|bool|[iub]?vec[234]|mat[234])[ \t]+\w+[ \t]*\()/;
  const NOT_GLSL = /<\/?[A-Za-z][\w-]*(?:\s+[\w-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*\s*\/?>|:\/\//;
  const looksGLSL = (text) => GLSL_LINE.test(text) && !NOT_GLSL.test(text);

  // one quasi (the raw text between ` or } and ${ or `) of a GLSL template: comments that end inside it, the
  // indentation, the trailing blanks — out; the newlines, every escape and everything else as it was. A comment that runs
  // into ${…} or the closing backtick stays (the next piece's first line would come alive), and so does one with a
  // backslash in it (an escape there may be a cooked newline or a line continuation).
  function glslPart(raw) {
    let o = '', line = '', i = 0, atStart = false;
    const n = raw.length;
    const oddBackslashes = (s) => { let k = s.length - 1, b = 0; while (k >= 0 && s.charCodeAt(k) === 92) { b++; k--; } return (b & 1) === 1; };
    const flush = (nl) => {
      let t = line.replace(/[ \t]+$/, '');
      if (t !== line && oddBackslashes(t)) t = line;   // never leave a backslash at the end (it would join the lines)
      o += t + nl; line = '';
    };
    while (i < n) {
      const c = raw.charCodeAt(i);
      if (c === 10 || c === 13) {
        const nl = c === 13 && raw.charCodeAt(i + 1) === 10 ? '\r\n' : raw[i];
        const continued = oddBackslashes(line);         // "\" + newline: a line continuation, not a newline of the GLSL
        flush(nl); i += nl.length; atStart = !continued;
        continue;
      }
      if (atStart && (c === 32 || c === 9)) { i++; continue; }
      atStart = false;
      if (c === 47 && raw.charCodeAt(i + 1) === 47) {
        let j = i; while (j < n && raw.charCodeAt(j) !== 10 && raw.charCodeAt(j) !== 13) j++;
        const body = raw.slice(i, j);
        if (j < n && body.indexOf('\\') < 0) { i = j; continue; }
        line += body; i = j; continue;
      }
      if (c === 47 && raw.charCodeAt(i + 1) === 42) {
        const j = raw.indexOf('*/', i + 2);
        const body = raw.slice(i, j < 0 ? n : j + 2);
        if (j >= 0 && body.indexOf('\\') < 0) {
          let nls = 0; for (let k = 0; k < body.length; k++) { const e = body.charCodeAt(k); if (e === 10 || (e === 13 && body.charCodeAt(k + 1) !== 10)) nls++; }
          if (nls) { for (let k = 0; k < nls; k++) { flush('\n'); } atStart = true; } else line += ' ';
          i = j + 2; continue;
        }
        line += body; i += body.length; continue;
      }
      if (c === 92) { line += raw.slice(i, i + 2); i += 2; continue; }
      line += raw[i]; i++;
    }
    return o + line;   // the last line runs into ${…} or the closing backtick: as it is
  }

  // ---------------------------------------------------------------- the JavaScript tokenizer
  // The output is the source copied in runs: a run breaks only where something is dropped (blanks at a line's ends,
  // a comment, more than one blank between two tokens) or replaced (a GLSL template's text, a CR LF).
  function stripJS(src, opts) {
    opts = opts || {};
    const htmlComments = !opts.module;
    const n = src.length;
    const out = [];         // the pieces: source runs, ' ', '\n', and the template parts' places ({ t, p })
    const tpls = [];        // per template literal: { parts: [raw], at: [source offsets], tagged, glsl }
    const braces = [];      // 'b' a block, 'o' an expression brace, or a number: the template whose ${ it is
    const parens = [];      // true: the head of if / while / for / with
    let runStart = 0, runEnd = 0, lineHasCode = false;
    // what the last significant token allows: a regular expression next (reOK), a block for "{" (blockOK), a control
    // head for "(" (ctrlNext); afterDot: the next word is a property name
    let reOK = true, blockOK = true, ctrlNext = false, afterDot = false;
    let i = 0;
    const flush = () => { if (runEnd > runStart) out.push(src.slice(runStart, runEnd)); };
    // a token at [a, b): what was skipped before it (blanks, comments) becomes one space between two tokens of a line
    // (a single blank stays in the run) and nothing at a line's start
    const tok = (a, b) => {
      if (a !== runEnd) {
        if (!lineHasCode) { flush(); runStart = a; }
        else if (a - runEnd !== 1 || src.charCodeAt(runEnd) !== 32) { flush(); out.push(' '); runStart = a; }
      }
      runEnd = b; lineHasCode = true;
    };
    const fail = (what, at) => { const ln = src.slice(0, at).split('\n').length; throw new Error(what + ' at line ' + ln + ': ' + JSON.stringify(src.slice(at, at + 60))); };
    const skipLine = (j) => { while (j < n && !isNl(src.charCodeAt(j))) j++; return j; };
    // a template part from j (right after ` or }): its raw text up to ` (the end) or ${ (an interpolation)
    const tplPart = (j, id) => {
      const s = j, T = tpls[id];
      for (;;) {
        if (j >= n) fail('unterminated template literal', s);
        const e = src.charCodeAt(j);
        if (e === 92) { j += 2; continue; }
        if (e === 96 || (e === 36 && src.charCodeAt(j + 1) === 123)) break;
        j++;
      }
      flush(); T.parts.push(src.slice(s, j)); T.at.push(s); out.push({ t: id, p: T.parts.length - 1 });
      runStart = j; lineHasCode = true; afterDot = false; ctrlNext = false;
      if (src.charCodeAt(j) === 96) {
        runEnd = j + 1;
        T.glsl = !T.tagged && opts.glsl !== false && looksGLSL(T.parts.join(''));
        reOK = false; blockOK = true;
        return j + 1;
      }
      runEnd = j + 2; braces.push(id); reOK = true; blockOK = false;
      return j + 2;
    };

    if (src.charCodeAt(0) === 35 && src.charCodeAt(1) === 33) i = skipLine(0);   // #! at the very start
    while (i < n) {
      const c = src.charCodeAt(i);
      if (c === 10 || c === 0x2028 || c === 0x2029) {   // a newline: always kept (the trailing blanks before it are not)
        if (i !== runEnd) { flush(); runStart = i; }
        runEnd = ++i; lineHasCode = false;
        continue;
      }
      if (c === 13) { flush(); out.push('\n'); i = src.charCodeAt(i + 1) === 10 ? i + 2 : i + 1; runStart = runEnd = i; lineHasCode = false; continue; }
      if (isWs(c)) { i++; continue; }
      const d = src.charCodeAt(i + 1);
      // ---- comments: skipped (a block comment over several lines leaves as many newlines)
      if (c === 47 && d === 47) { i = skipLine(i + 2); continue; }
      if (c === 47 && d === 42) {
        const j = src.indexOf('*/', i + 2);
        if (j < 0) fail('unterminated comment', i);
        let nls = 0;
        for (let k = i + 2; k < j; k++) { const e = src.charCodeAt(k); if (e === 10 || e === 0x2028 || e === 0x2029 || (e === 13 && src.charCodeAt(k + 1) !== 10)) nls++; }
        i = j + 2;
        if (nls) { flush(); out.push(nls === 1 ? '\n' : '\n'.repeat(nls)); runStart = runEnd = i; lineHasCode = false; }
        continue;
      }
      if (htmlComments && c === 60 && d === 33 && src.charCodeAt(i + 2) === 45 && src.charCodeAt(i + 3) === 45) { i = skipLine(i + 4); continue; }   // <!-- (a classic script's comment)
      if (htmlComments && !lineHasCode && c === 45 && d === 45 && src.charCodeAt(i + 2) === 62) { i = skipLine(i + 3); continue; }   // --> at a line's start
      // ---- strings
      if (c === 39 || c === 34) {
        let j = i + 1;
        for (;;) {
          if (j >= n) fail('unterminated string', i);
          const e = src.charCodeAt(j);
          if (e === 92) { j += src.charCodeAt(j + 1) === 13 && src.charCodeAt(j + 2) === 10 ? 3 : 2; continue; }
          if (e === c) { j++; break; }
          if (e === 10 || e === 13) fail('unterminated string', i);
          j++;
        }
        tok(i, j); i = j; reOK = false; blockOK = true; ctrlNext = false; afterDot = false;
        continue;
      }
      // ---- template literals
      if (c === 96) {
        const id = tpls.length;
        tpls.push({ parts: [], at: [], tagged: !reOK && !afterDot, glsl: false });   // after a value: a tagged template, kept as it is
        tok(i, i + 1);
        i = tplPart(i + 1, id);
        continue;
      }
      // ---- a regular expression or a division
      if (c === 47) {
        if (reOK) {
          let j = i + 1, cls = false;
          for (;;) {
            if (j >= n) fail('unterminated regular expression', i);
            const e = src.charCodeAt(j);
            if (e === 92) { j += 2; continue; }
            if (isNl(e)) fail('unterminated regular expression', i);
            if (cls) { if (e === 93) cls = false; } else if (e === 91) cls = true; else if (e === 47) break;
            j++;
          }
          j++;
          while (j < n && isIdPart(src.charCodeAt(j))) j++;
          tok(i, j); i = j; reOK = false; blockOK = true; ctrlNext = false; afterDot = false;
          continue;
        }
        tok(i, i + 1); i++; reOK = true; blockOK = false; ctrlNext = false; afterDot = false;
        continue;
      }
      // ---- numbers
      if (isDigit(c) || (c === 46 && isDigit(d))) {
        let j = i;
        if (c === 48 && (d === 120 || d === 88 || d === 111 || d === 79 || d === 98 || d === 66)) { j += 2; while (j < n && isIdPart(src.charCodeAt(j))) j++; }
        else {
          while (j < n && (isDigit(src.charCodeAt(j)) || src.charCodeAt(j) === 95)) j++;
          if (src.charCodeAt(j) === 46) { j++; while (j < n && (isDigit(src.charCodeAt(j)) || src.charCodeAt(j) === 95)) j++; }
          const e = src.charCodeAt(j);
          if (e === 101 || e === 69) { j++; if (src.charCodeAt(j) === 43 || src.charCodeAt(j) === 45) j++; while (j < n && isDigit(src.charCodeAt(j))) j++; }
          if (src.charCodeAt(j) === 110) j++;   // BigInt
        }
        tok(i, j); i = j; reOK = false; blockOK = true; ctrlNext = false; afterDot = false;
        continue;
      }
      // ---- words: identifiers, keywords, private names
      if (isIdStart(c) || (c === 35 && isIdStart(d))) {
        let j = c === 35 ? i + 1 : i;
        while (j < n) {
          const e = src.charCodeAt(j);
          if (e === 92) { if (src.charCodeAt(j + 2) === 123) { const k = src.indexOf('}', j); j = k < 0 ? n : k + 1; } else j += 6; continue; }   // \uXXXX, \u{…}
          if (!isIdPart(e)) break;
          j++;
        }
        tok(i, j);
        if (afterDot || c === 35) { reOK = false; blockOK = true; ctrlNext = false; }
        else { const w = src.slice(i, j); reOK = KW_EXPR.has(w); blockOK = !(reOK && w !== 'do' && w !== 'else'); ctrlNext = KW_CTRL.has(w); }
        i = j; afterDot = false;
        continue;
      }
      // ---- punctuators
      if (c === 123) {   // {
        braces.push(blockOK ? 'b' : 'o');
        tok(i, i + 1); i++; reOK = true; blockOK = true; ctrlNext = false; afterDot = false;
        continue;
      }
      if (c === 125) {   // }
        const top = braces.length ? braces.pop() : 'b';
        if (typeof top === 'number') {   // back into the template (the blanks before this } are dropped)
          if (i !== runEnd) { flush(); runStart = i; }
          runEnd = i + 1; lineHasCode = true;
          i = tplPart(i + 1, top);
          continue;
        }
        tok(i, i + 1); i++; reOK = top === 'b'; blockOK = true; ctrlNext = false; afterDot = false;
        continue;
      }
      if (c === 40) { parens.push(ctrlNext); tok(i, i + 1); i++; reOK = true; blockOK = false; ctrlNext = false; afterDot = false; continue; }
      if (c === 41) { const ctrl = parens.length ? parens.pop() : false; tok(i, i + 1); i++; reOK = ctrl; blockOK = true; ctrlNext = false; afterDot = false; continue; }
      if (c === 93) { tok(i, i + 1); i++; reOK = false; blockOK = true; ctrlNext = false; afterDot = false; continue; }
      if ((c === 43 || c === 45) && d === c) { tok(i, i + 2); i += 2; reOK = false; blockOK = true; ctrlNext = false; afterDot = false; continue; }   // ++ --
      if (c === 61 && d === 62) { tok(i, i + 2); i += 2; reOK = true; blockOK = true; ctrlNext = false; afterDot = false; continue; }   // =>
      if (c === 46 && d === 46 && src.charCodeAt(i + 2) === 46) { tok(i, i + 3); i += 3; reOK = true; blockOK = false; ctrlNext = false; afterDot = false; continue; }   // ...
      if (c === 46) { tok(i, i + 1); i++; reOK = false; blockOK = true; ctrlNext = false; afterDot = true; continue; }
      if (c === 63 && d === 46 && !isDigit(src.charCodeAt(i + 2))) { tok(i, i + 2); i += 2; reOK = false; blockOK = true; ctrlNext = false; afterDot = true; continue; }   // ?.
      if (c === 59) { tok(i, i + 1); i++; reOK = true; blockOK = true; ctrlNext = false; afterDot = false; continue; }
      if (c === 58) { tok(i, i + 1); i++; reOK = true; blockOK = false; ctrlNext = false; afterDot = false; continue; }
      // every other punctuator, one character at a time (they keep their spacing, so nothing joins)
      tok(i, i + 1); i++; reOK = true; blockOK = false; ctrlNext = false; afterDot = false;
    }
    if (braces.some(b => typeof b === 'number')) fail('unterminated template literal', n);
    flush();

    // the templates' parts: as they were, or stripped GLSL
    let glsl = 0;
    const glslAt = [];
    for (const T of tpls) if (T.glsl) { glsl++; for (const a of T.at) glslAt.push(a); }
    if (opts.info) { opts.info.glsl = glsl; opts.info.glslAt = glslAt; opts.info.templates = tpls.length; }
    for (let k = 0; k < out.length; k++) {
      const p = out[k];
      if (typeof p !== 'string') { const T = tpls[p.t]; out[k] = T.glsl ? glslPart(T.parts[p.p]) : T.parts[p.p]; }
    }
    return out.join('');
  }
  // ---------------------------------------------------------------- pages
  // the HTML parser's script-data states (HTML spec 13.2.5.4–13.2.5.30): a script must not end "double escaped"
  // (<!-- … <script …), or its </script> would not close it — stripping only removes text, but it must not remove a -->
  // that closed such a state
  function scriptState(text) {
    let st = 'data';
    const s = text.toLowerCase(), n = s.length;
    const tagAt = (i, name) => s.startsWith(name, i) && /[\s/>]/.test(s[i + name.length] || '>');
    for (let i = 0; i < n; i++) {
      const c = s[i];
      if (st === 'data') { if (s.startsWith('<!--', i)) { st = 'esc'; i += 3; } continue; }
      if (st === 'esc') {
        if (s.startsWith('-->', i)) { st = 'data'; i += 2; continue; }
        if (c === '<' && tagAt(i + 1, 'script')) { st = 'dbl'; i += 6; }
        continue;
      }
      if (st === 'dbl') {
        if (s.startsWith('-->', i)) { st = 'data'; i += 2; continue; }
        if (c === '<' && s[i + 1] === '/' && tagAt(i + 2, 'script')) { st = 'esc'; i += 7; }
      }
    }
    return st;
  }
  // what an inline <script>'s attributes make of it: 'classic', 'module', or null (an external script, or data)
  function scriptKind(attrs) {
    if (/\bsrc\s*=/i.test(attrs)) return null;
    const ty = (/\btype\s*=\s*["']?([^"'\s>]+)/i.exec(attrs) || [])[1];
    if (!ty || /^(text\/javascript|application\/javascript|text\/js-worker)$/i.test(ty)) return 'classic';
    return /^module$/i.test(ty) ? 'module' : null;
  }
  // one inline script of a page: its stripped code, or null when it is not JavaScript (then it stays as it is)
  function stripScript(attrs, code, opts) {
    const kind = scriptKind(attrs);
    if (!kind) return null;
    const out = stripJS(code, Object.assign({}, opts, { module: kind === 'module' }));
    if (scriptState(out) === 'dbl' && scriptState(code) !== 'dbl') throw new Error('stripping would leave a script "double escaped" (<!-- <script): ' + attrs);
    return out;
  }
  const SCRIPT_RE = /(<script\b([^>]*)>)([\s\S]*?)(<\/script\s*>)/gi;
  function stripPage(html, opts) {
    return html.replace(SCRIPT_RE, (m, open, attrs, code, close) => { const out = stripScript(attrs, code, opts); return out === null ? m : open + out + close; });
  }

  const Strip = { js: stripJS, page: stripPage, script: stripScript, kind: scriptKind, SCRIPT_RE, looksGLSL, glslPart, scriptState };
  if (typeof module !== 'undefined' && module.exports) module.exports = Strip;
  else root.R9Strip = Strip;
})(typeof globalThis !== 'undefined' ? globalThis : this);
