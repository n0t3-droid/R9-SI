// Saving must survive a database that fails: a column whose save was refused (storage full) stays modified and is
// saved again next time — and comes back from memory meanwhile; a connection that is gone switches the store to
// memory once instead of failing every save; a world's meta stays listed. Driven in node with a fake IndexedDB.
//   bash test/wt_run.sh store_fail.js
require('./load_shared.js');
require('../src/main/storage.js');
let fail = 0;
const check = (ok, what) => { console.log((ok ? 'OK   ' : 'FAIL ') + what); if (!ok) fail++; };
// ---- a fake database: every request settles on the next tick; `mode` says how it behaves ----
const DB = { mode: 'ok', rows: new Map(), worlds: new Map() };
const req = (fn) => { const r = {}; setTimeout(() => { try { const v = fn(); r.result = v; r.onsuccess && r.onsuccess(); } catch (e) { r.error = e; r.onerror && r.onerror(); } }, 0); return r; };
const fakeDb = {
  transaction(store) {
    if (DB.mode === 'closed') { const e = new Error('The database connection is closing'); e.name = 'InvalidStateError'; throw e; }
    return { objectStore() { return {
      put(rec, k) { return req(() => { if (DB.mode === 'full') { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; } if (k === undefined) DB.worlds.set(rec.id, rec); else DB.rows.set(k, rec); }); },
      get(k) { return req(() => DB.rows.get(k)); },
      getAll() { return req(() => [...DB.worlds.values()]); },
      getAllKeys() { return req(() => [...DB.rows.keys()]); },
      delete() { return req(() => {}); },
    }; } };
  },
};
global.window = { dispatchEvent() {} }; global.CustomEvent = class {};
const tick = () => new Promise(r => setTimeout(r, 5));
(async () => {
  const st = new VR.Store();
  st.db = fakeDb; st.ok = true; st.bind('w1');
  const col = { cx: 3, cz: -2, blocks: new Uint16Array(65536), blockEntities: new Map(), sv: 0, modified: true };
  col.blocks[1234] = 7;
  // 1. a good save
  await st.saveColumn('overworld', col);
  check(col.modified === false && DB.rows.has('w1:overworld:3:-2'), 'a column saves and is clean');
  // 2. the storage is full: the save is refused
  col.blocks[1234] = 9; col.modified = true; DB.mode = 'full';
  await st.saveColumn('overworld', col); await tick();
  check(col.modified === true, 'a refused save leaves the column modified (the next autosave tries again)');
  const back = await st.loadColumn('overworld', 3, -2);
  check(back && back[1234] === 9, 'meanwhile the column comes back from memory with the latest blocks');
  // 3. room again: the next save goes through and the memory copy is dropped
  DB.mode = 'ok';
  await st.saveColumn('overworld', col); await tick();
  check(col.modified === false && DB.rows.get('w1:overworld:3:-2').b && st.mem.chunks.size === 0, 'the next save goes through and the memory copy is dropped');
  // 4. the connection is gone: the store switches to memory once and the game goes on
  DB.mode = 'closed';
  col.blocks[7] = 3; col.modified = true;
  await st.saveColumn('overworld', col);
  check(st.ok === false, 'a closed connection switches the store to memory');
  check(col.modified === true || st.mem.chunks.has('w1:overworld:3:-2'), 'nothing is lost: the column is kept');
  col.modified = true;
  await st.saveColumn('overworld', col);
  const again = await st.loadColumn('overworld', 3, -2);
  check(again && again[7] === 3 && col.modified === false, 'saves and loads carry on in memory');
  // 5. a world's meta stays listed when the database fails
  const st2 = new VR.Store(); st2.db = fakeDb; st2.ok = true; DB.mode = 'ok';
  await st2.saveWorld({ id: 'wA', name: 'Alpha' });
  DB.mode = 'full';
  await st2.saveWorld({ id: 'wB', name: 'Beta' });
  DB.mode = 'ok';
  const list = await st2.listWorlds();
  check(list.some(w => w.id === 'wA') && list.some(w => w.id === 'wB'), 'a world whose meta could not be written is still in the list (from memory)');
  console.log(fail ? `FAIL ${fail}` : 'OK — saving survives a failing database');
  process.exit(fail ? 1 : 0);
})();
