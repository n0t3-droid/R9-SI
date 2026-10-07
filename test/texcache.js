// The block texture cache (v0.40). The worker forges the block textures in 1-2.5 s on a low-end PC; their result is kept
// in IndexedDB ('r9si-cache') and reused by later starts and look switches while everything they depend on is the same:
// the build's texture code, the registry's layer names and masks, the bevel settings. Node: the worker bundle of
// dist/index.html runs in the global scope as the browser runs it, and the cache talks to a fake IndexedDB that copies
// records as the real one does (structured clone, requests answer on the next tick).
//   bash test/wt_run.sh texcache.js 300
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
let fail = 0;
const check = (ok, what) => { console.log((ok ? 'OK   ' : 'FAIL ') + what); if (!ok) fail++; };
const build = (root) => execFileSync(process.execPath, ['build.js'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
const hashIn = (html) => { const m = /VR\.TEX_SRC_HASH = "([0-9a-f]+)"/.exec(html); return m ? m[1] : null; };
const workerIn = (html) => { const m = /<script type="text\/js-worker" id="worker-src">([\s\S]*?)<\/script>/.exec(html); return m ? m[1].replace(/<\\\/script/gi, '</script') : null; };
const dig = (t) => { const h = crypto.createHash('sha256'); for (const a of [...t.albedo, ...t.material, t.avgColor, t.noise]) h.update(Buffer.from(a.buffer, a.byteOffset, a.byteLength)); return h.digest('hex').slice(0, 20); };
const bytesEq = (a, b) => a.byteLength === b.byteLength && Buffer.compare(Buffer.from(a.buffer, a.byteOffset, a.byteLength), Buffer.from(b.buffer, b.byteOffset, b.byteLength)) === 0;
const same = (a, b) => a.layers === b.layers && a.levels === b.levels && a.size === b.size && a.albedo.length === b.albedo.length &&
  a.albedo.every((x, i) => bytesEq(x, b.albedo[i])) && a.material.every((x, i) => bytesEq(x, b.material[i])) &&
  bytesEq(a.avgColor, b.avgColor) && bytesEq(a.noise, b.noise) && JSON.stringify(a.missing) === JSON.stringify(b.missing);

(async () => {
  // ---- the build injects a hash of the texture code into the game
  build(ROOT);
  const html = fs.readFileSync(path.join(ROOT, 'dist', 'index.html'), 'utf8');
  const hash = hashIn(html);
  check(/^[0-9a-f]{16}$/.test(hash || ''), 'the build injects the texture hash into the game page (' + hash + ')');

  // ---- the hash follows the texture code (recipes, shared tables) and not the UI
  const tmp = path.join(ROOT, '.tmp_tests', 'texkey_' + process.pid);
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });
  fs.cpSync(path.join(ROOT, 'src'), path.join(tmp, 'src'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'build.js'), path.join(tmp, 'build.js'));
  const tweak = (rel, fn) => { const p = path.join(tmp, rel), orig = fs.readFileSync(p, 'utf8'); fs.writeFileSync(p, fn(orig)); return () => fs.writeFileSync(p, orig); };
  const hashOfCopy = () => { build(tmp); return hashIn(fs.readFileSync(path.join(tmp, 'dist', 'index.html'), 'utf8')); };
  check(!!hash && hashOfCopy() === hash, 'the same sources give the same hash');
  let undo = tweak('src/main/tex_recipes2.js', (s) => s + '\n// a recipe changed\n');
  check(!!hash && hashOfCopy() !== hash, 'a changed recipe file changes the hash');
  undo();
  undo = tweak('src/shared/voxarch.js', (s) => s + '\n// a shared colour table changed\n');
  check(!!hash && hashOfCopy() !== hash, 'a changed shared file (the block tables) changes the hash');
  undo();
  undo = tweak('src/main/ui.js', (s) => s + '\n// a UI change\n');
  check(!!hash && hashOfCopy() === hash, 'a UI-only change keeps the hash, so the cache survives it');
  undo();
  fs.rmSync(tmp, { recursive: true, force: true });

  // ---- the forge: the worker bundle, as the browser runs it
  globalThis.self = globalThis;
  let last = null;
  globalThis.postMessage = (m) => { last = m; };
  (0, eval)(workerIn(html));
  const forge = (bevelAll) => { self.onmessage({ data: { type: 'textures', id: 1, bevel: 1, bevelAll } }); return last; };
  const fresh = forge(true);
  check(fresh && fresh.type === 'textures', 'the worker forges the block textures (' + (fresh && fresh.layers) + ' layers)');
  const again = forge(true), seam = forge(false);
  check(dig(again) === dig(fresh), 'a second forge gives the same bytes: the build is deterministic');
  check(dig(seam) !== dig(fresh), 'the Nahtlos look (no rim) forges other textures');
  check(fresh.layers === VR.R.texNames.length && fresh.levels === VR.TEX_LEVELS && fresh.size === VR.TX.N &&
    fresh.noise.length === VR.TEX_NOISE * VR.TEX_NOISE * 4, 'the output matches the registry: layers, mip levels, size, noise');
  check(fresh.albedo[0] instanceof Uint8Array && fresh.avgColor instanceof Float32Array, 'the arrays keep their types');

  // ---- the cache, as the page loads it (main thread)
  const cacheFile = path.join(ROOT, 'src', 'main', 'tex_cache.js');
  if (!fs.existsSync(cacheFile)) { check(false, 'src/main/tex_cache.js exists'); process.exit(1); }
  const cacheSrc = fs.readFileSync(cacheFile, 'utf8');
  const loadCache = () => (0, eval)(cacheSrc);   // a new instance: no database connection kept from before
  VR.TEX_SRC_HASH = hash;
  loadCache();
  const K = (bevelAll, bevel = 1) => VR.TexCache.key({ bevel, bevelAll });
  const kRim = K(true), kSeam = K(false);
  check(!!kRim && !!kSeam && kRim.id !== kSeam.id && kRim.text !== kSeam.text, 'the look (rim flag) selects another entry');
  check(K(true, 0.5).text !== kRim.text, 'the bevel strength is part of the key');
  VR.R.texNames.push('zz_test_layer'); const kName = K(true); VR.R.texNames.pop();
  check(kName.text !== kRim.text, 'a new layer name changes the key');
  const origMasks = VR.textureMasks;
  VR.textureMasks = () => { const m = origMasks(); m.cut[7] ^= 1; return m; };
  const kMask = K(true); VR.textureMasks = origMasks;
  check(kMask.text !== kRim.text, 'a changed cube or cutout layer changes the key');
  check(K(true).id === kRim.id && K(true).text === kRim.text, 'the same inputs give the same key');
  VR.TEX_SRC_HASH = hash.replace(/^./, (c) => (c === '0' ? '1' : '0'));
  check(K(true).text !== kRim.text, 'another build hash changes the key');
  VR.TEX_SRC_HASH = undefined;
  check(K(true) === null, 'without a build hash there is no cache');
  VR.TEX_SRC_HASH = hash;

  // ---- a fake IndexedDB: records copied on write and read; every request answers on the next tick
  const DB = new Map();
  const fakeIDB = {
    open() {
      const req = { result: null, error: null, onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null };
      setTimeout(() => {
        req.result = {
          objectStoreNames: { contains: () => true }, close() {}, onversionchange: null,
          transaction() { return { oncomplete: null, onerror: null, onabort: null, objectStore() { return {
            get(k) { const r = { result: undefined, onsuccess: null, onerror: null }; setTimeout(() => { if (DB.has(k)) r.result = structuredClone(DB.get(k)); r.onsuccess && r.onsuccess({ target: r }); }, 0); return r; },
            put(v, k) { const r = { result: undefined, onsuccess: null, onerror: null }; setTimeout(() => { DB.set(k, structuredClone(v)); r.onsuccess && r.onsuccess({ target: r }); }, 0); return r; },
          }; } }; },
        };
        if (req.onupgradeneeded) req.onupgradeneeded({ target: req });
        if (req.onsuccess) req.onsuccess({ target: req });
      }, 0);
      return req;
    },
  };
  globalThis.indexedDB = fakeIDB; loadCache();
  const key = K(true), keySeam = K(false);
  check(await VR.TexCache.put(key, fresh) === true && DB.has(key.id), 'the forge output is stored under the key');
  const hit = await VR.TexCache.get(key);
  check(!!hit && hit.type === 'textures' && same(hit, fresh), 'a later read gives back the same arrays: albedo, material, averages, noise, names');
  check(!!hit && hit.albedo[0] instanceof Uint8Array && hit.avgColor instanceof Float32Array, 'the cached arrays keep their types');
  await VR.TexCache.put(keySeam, seam);
  const hR = await VR.TexCache.get(key), hS = await VR.TexCache.get(keySeam);
  check(!!hR && dig(hR) === dig(fresh) && !!hS && dig(hS) === dig(seam), 'each look keeps its own textures');

  // damaged or stale records are misses (and the next forge overwrites them)
  const good = structuredClone(DB.get(key.id));
  const bad = (f) => { const r = structuredClone(good); f(r); DB.set(key.id, r); return VR.TexCache.get(key); };
  check(await bad((r) => { r.albedo[2] = r.albedo[2].slice(0, 100); }) === null, 'a truncated mip level is ignored');
  check(await bad((r) => { r.material = r.material.slice(0, 2); }) === null, 'a record with missing mip levels is ignored');
  check(await bad((r) => { r.text += ' '; }) === null, 'a record of another key (other names, masks or build) is ignored');
  check(await bad((r) => { r.size = 64; }) === null, 'a record of another texture size is ignored');
  check(await bad((r) => { delete r.noise; }) === null, 'a record without the noise texture is ignored');
  check(await bad((r) => { r.avgColor = new Float32Array(3); }) === null, 'a record with short averages is ignored');
  DB.set(key.id, structuredClone(good));
  check(!!(await VR.TexCache.get(key)), 'the good record reads again');

  // a forge bigger than the cap is not stored
  DB.clear();
  check(VR.TexCache.MAX_BYTES === 40 * 1024 * 1024, 'the cap is 40 MB');
  check(await VR.TexCache.put(key, { ...fresh, albedo: [new Uint8Array(VR.TexCache.MAX_BYTES + 1)] }) === false && !DB.has(key.id), 'an output over the cap is not stored');

  // a database that never answers is a miss after the timeout
  globalThis.indexedDB = { open() { return {}; } }; loadCache();
  const t0 = Date.now(), nv = await VR.TexCache.get(K(true), 150), dt = Date.now() - t0;
  check(nv === null && dt >= 120 && dt < 1000, 'a read that never answers is a miss after the timeout (' + dt + ' ms)');
  check(VR.TexCache.READ_MS === 500, 'the read waits at most 500 ms by default');

  // no IndexedDB (an old browser), a blocked one, a failing one (a private window): a miss, nothing stored, no error
  const cases = [
    ['no IndexedDB', undefined],
    ['IndexedDB.open throws', { open() { throw new Error('SecurityError: storage blocked'); } }],
    ['IndexedDB.open fails', { open() { const r = { onerror: null }; setTimeout(() => r.onerror && r.onerror({}), 0); return r; } }],
  ];
  for (const [what, idb] of cases) {
    globalThis.indexedDB = idb; loadCache();
    let threw = false, got = 'x', stored = 'x';
    try { got = await VR.TexCache.get(K(true)); stored = await VR.TexCache.put(K(true), fresh); } catch (e) { threw = true; }
    check(!threw && got === null && stored === false, what + ': a miss and no store, no error');
  }
  globalThis.indexedDB = undefined;

  console.log(fail ? 'FAILED ' + fail : 'all texture cache checks passed\nALL OK');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
