/* IndexedDB persistence for Shayari Workshop.
 * dictionary  — surface → { translit, morae?, note, source, confirmed }
 * misraCache  — hash(normalized line) → full scan result
 * Ported from reference/storage.reference.js — keep the schema. */

const DB_NAME    = "shayari-behr";
const DB_VERSION = 1;
const STORE_DICT  = "dictionary";
const STORE_CACHE = "misraCache";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = ev => {
      const db = ev.target.result;
      if (!db.objectStoreNames.contains(STORE_DICT))
        db.createObjectStore(STORE_DICT,  { keyPath: "surface" });
      if (!db.objectStoreNames.contains(STORE_CACHE))
        db.createObjectStore(STORE_CACHE, { keyPath: "key" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function tx(db, store, mode) {
  return db.transaction(store, mode).objectStore(store);
}

async function dictGet(surface) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const r = tx(db, STORE_DICT, "readonly").get(surface);
    r.onsuccess = () => resolve(r.result || null);
    r.onerror   = () => reject(r.error);
  });
}

async function dictGetMany(surfaces) {
  const hits = {}, misses = [];
  for (const s of surfaces) {
    const e = await dictGet(s);
    if (e) hits[s] = e; else misses.push(s);
  }
  return { hits, misses };
}

async function dictPut(entry) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const r = tx(db, STORE_DICT, "readwrite").put(entry);
    r.onsuccess = () => resolve(entry);
    r.onerror   = () => reject(r.error);
  });
}

async function dictDelete(surface) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const r = tx(db, STORE_DICT, "readwrite").delete(surface);
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

async function dictSeed(seedJson) {
  for (const e of (seedJson.entries || [])) {
    const existing = await dictGet(e.surface);
    if (existing && existing.confirmed) continue;
    await dictPut(e);
  }
}

async function dictExport() {
  const entries = await dictAll();
  return { version: 1, exportedAt: new Date().toISOString(), entries };
}

async function dictImport(json, { overwriteConfirmed = false } = {}) {
  for (const e of (json.entries || [])) {
    const existing = await dictGet(e.surface);
    if (existing && existing.confirmed && !overwriteConfirmed) continue;
    await dictPut(e);
  }
}

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

async function cacheClear() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const r = tx(db, STORE_CACHE, "readwrite").clear();
    r.onsuccess = () => resolve(true);
    r.onerror   = () => reject(r.error);
  });
}

const Storage = {
  dictGet, dictGetMany, dictPut, dictDelete, dictAll, dictSeed, dictExport, dictImport,
  hashLine, cacheGet, cachePut, cacheClear,
};
if (typeof window !== "undefined") window.Storage = Storage;
