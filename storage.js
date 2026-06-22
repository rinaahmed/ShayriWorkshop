/* IndexedDB persistence — schema v2.
 * v2 change: keyPath is now "id" (= surface + "|" + translit) with a surface index,
 * so a single written form can hold multiple readings (different translit/weight/meaning).
 * Migration from v1 (keyPath: surface) happens in onupgradeneeded. */

const DB_NAME    = "shayari-behr";
const DB_VERSION = 2;
const STORE_DICT  = "dictionary";
const STORE_CACHE = "misraCache";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = ev => {
      const db  = ev.target.result;
      const tr  = ev.target.transaction;
      const old = ev.oldVersion;

      if (old === 0) {
        // Fresh install: v2 schema
        const ds = db.createObjectStore(STORE_DICT, { keyPath: "id" });
        ds.createIndex("surface", "surface", { unique: false });
        db.createObjectStore(STORE_CACHE, { keyPath: "key" });

      } else if (old === 1) {
        // Migrate v1 (keyPath: "surface") → v2 (keyPath: "id" + surface index).
        // Must do it inside this upgrade transaction.
        const oldStore  = tr.objectStore(STORE_DICT);
        const getAllReq = oldStore.getAll();
        getAllReq.onsuccess = () => {
          const rows = getAllReq.result || [];
          db.deleteObjectStore(STORE_DICT);
          const newStore = db.createObjectStore(STORE_DICT, { keyPath: "id" });
          newStore.createIndex("surface", "surface", { unique: false });
          for (const e of rows) {
            const id = (e.surface || '') + '|' + (e.translit || '');
            try { newStore.add({ ...e, id }); } catch (_) {}
          }
        };
        getAllReq.onerror = () => {
          try { db.deleteObjectStore(STORE_DICT); } catch (_) {}
          const newStore = db.createObjectStore(STORE_DICT, { keyPath: "id" });
          newStore.createIndex("surface", "surface", { unique: false });
        };
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function tx(db, store, mode) {
  return db.transaction(store, mode).objectStore(store);
}

// ── Dictionary ────────────────────────────────────────────────────────────────

// All readings (entries) for a surface word — may be 0, 1, or many.
async function dictGetReadings(surface) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const idx = tx(db, STORE_DICT, "readonly").index("surface");
    const r = idx.getAll(surface);
    r.onsuccess = () => resolve(r.result || []);
    r.onerror   = () => reject(r.error);
  });
}

// Single reading by composite id.
async function dictGetById(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const r = tx(db, STORE_DICT, "readonly").get(id);
    r.onsuccess = () => resolve(r.result || null);
    r.onerror   = () => reject(r.error);
  });
}

// Bulk lookup. Returns { reads: {surface → [entry, ...]}, misses: [surface, ...] }
async function dictGetManyReadings(surfaces) {
  const reads = {}, misses = [];
  for (const s of surfaces) {
    const entries = await dictGetReadings(s);
    if (entries.length) reads[s] = entries;
    else misses.push(s);
  }
  return { reads, misses };
}

// Write/update. Auto-computes id from surface+translit if absent.
async function dictPut(entry) {
  const id = entry.id || ((entry.surface || '') + '|' + (entry.translit || ''));
  const full = { ...entry, id };
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const r = tx(db, STORE_DICT, "readwrite").put(full);
    r.onsuccess = () => resolve(full);
    r.onerror   = () => reject(r.error);
  });
}

// Delete a specific reading by id.
async function dictDelete(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const r = tx(db, STORE_DICT, "readwrite").delete(id);
    r.onsuccess = () => resolve(true);
    r.onerror   = () => reject(r.error);
  });
}

async function dictAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const r = tx(db, STORE_DICT, "readonly").getAll();
    r.onsuccess = () => resolve(r.result || []);
    r.onerror   = () => reject(r.error);
  });
}

// Load seed once — never clobbers a confirmed reading.
async function dictSeed(seedJson) {
  for (const e of (seedJson.entries || [])) {
    const id = (e.surface || '') + '|' + (e.translit || '');
    const existing = await dictGetById(id);
    if (existing && existing.confirmed) continue;
    await dictPut({ ...e, id });
  }
}

async function dictExport() {
  const entries = await dictAll();
  return { version: 2, exportedAt: new Date().toISOString(), entries };
}

async function dictImport(json, { overwriteConfirmed = false } = {}) {
  for (const e of (json.entries || [])) {
    const id = e.id || ((e.surface || '') + '|' + (e.translit || ''));
    const existing = await dictGetById(id);
    if (existing && existing.confirmed && !overwriteConfirmed) continue;
    await dictPut({ ...e, id });
  }
}

// ── Misra cache ───────────────────────────────────────────────────────────────

function hashLine(normalizedLine) {
  let h = 0x811c9dc5;
  for (let i = 0; i < normalizedLine.length; i++) {
    h ^= normalizedLine.charCodeAt(i);
    h  = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

async function cacheGet(normalizedLine) {
  const db  = await openDB();
  const key = hashLine(normalizedLine);
  return new Promise((resolve, reject) => {
    const r = tx(db, STORE_CACHE, "readonly").get(key);
    r.onsuccess = () => resolve(r.result ? r.result.value : null);
    r.onerror   = () => reject(r.error);
  });
}

async function cachePut(normalizedLine, value) {
  const db  = await openDB();
  const key = hashLine(normalizedLine);
  return new Promise((resolve, reject) => {
    const r = tx(db, STORE_CACHE, "readwrite").put({ key, line: normalizedLine, value, at: Date.now() });
    r.onsuccess = () => resolve(true);
    r.onerror   = () => reject(r.error);
  });
}

// Clear entirely on any dictionary write — cache is a speed opt, not source of truth.
async function cacheClear() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const r = tx(db, STORE_CACHE, "readwrite").clear();
    r.onsuccess = () => resolve(true);
    r.onerror   = () => reject(r.error);
  });
}

const Storage = {
  dictGetReadings, dictGetById, dictGetManyReadings,
  dictPut, dictDelete, dictAll, dictSeed, dictExport, dictImport,
  hashLine, cacheGet, cachePut, cacheClear,
};
if (typeof window !== "undefined") window.Storage = Storage;
